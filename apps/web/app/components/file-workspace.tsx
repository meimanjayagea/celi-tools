"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowRight, Check, CircleAlert, Download, FileArchive, FileInput, Files, LoaderCircle, Search, Server, Trash2, Upload, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { COMPRESS_METHODS, CONVERTER_GROUPS, FILE_LIMITS, conversionTargets, converterGroup, formatBytes, validateSelection } from "@celi/file-tools";
import { fileApiEndpoint } from "../lib/file-api";

type Result = { url: string; name: string; size: number; original: number; notes: string[]; cleanupPath: string };
async function getFileAccessToken(signal?: AbortSignal) {
  const response = await fetch("/api/files/access-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store", credentials: "same-origin", signal });
  const payload = await response.json();
  if (!response.ok || typeof payload.token !== "string") throw new Error(payload.error || "Sesi file tidak tersedia. Silakan masuk kembali.");
  return payload.token as string;
}

export default function FileWorkspace({ mode }: { mode: "convert" | "compress" }) {
  const { t } = useLanguage();
  const converting = mode === "convert";
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState(converting ? "pdf" : "zip");
  const [preset, setPreset] = useState("balanced");
  const [engines, setEngines] = useState<Record<string, boolean> | null>(null);
  const [capabilityError, setCapabilityError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => fetch(fileApiEndpoint("capabilities"), { signal: controller.signal, cache: "no-store", credentials: "same-origin" }))
      .then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; })
      .then(value => { setEngines(value.engines); setCapabilityError(""); })
      .catch(caught => { if (caught.name !== "AbortError") setCapabilityError("Server file belum siap. Coba periksa kembali beberapa saat lagi."); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => { if (result?.url.startsWith("blob:")) URL.revokeObjectURL(result.url); }, [result]);

  const choices = useMemo(() => converting
    ? conversionTargets(files.map(file => file.name), engines || {})
    : COMPRESS_METHODS.filter(method => engines?.[method.engine] !== false).map(method => method.id), [converting, files, engines]);
  const selected = choices.includes(target) ? target : choices[0] || "";
  const selectedMethod = COMPRESS_METHODS.find(method => method.id === selected);
  const groups = [...new Set(files.map(file => converterGroup(file.name)?.id))];
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const selectionError = files.length ? validateSelection(files, mode, selected, engines || {}) : "";
  const accepts = CONVERTER_GROUPS.flatMap(group => group.inputs.map(extension => "." + extension)).join(",");
  const savings = result && result.original ? (1 - result.size / result.original) * 100 : 0;
  const archiveFormats = ["ZIP", "TAR.GZ", "GZIP", "BZIP2", "XZ"];
  const optimizedFormats: Record<string, string> = { image: "WEBP", pdf: "PDF", audio: "MP3", video: "MP4" };
  const formatRows = [
    ...(!converting ? [{ id: "all", label: "Semua jenis file", inputs: ["Semua ekstensi"], outputs: archiveFormats, engine: "archive" }] : []),
    ...CONVERTER_GROUPS.map(group => ({
      id: group.id, label: group.label, inputs: group.inputs.map(extension => extension.toUpperCase()),
      outputs: converting ? group.outputs.map(extension => extension.toUpperCase()) : optimizedFormats[group.id] ? [optimizedFormats[group.id]] : archiveFormats,
      engine: converting || optimizedFormats[group.id] ? group.engine : "archive",
    })),
  ].filter(row => [t(row.label), ...row.inputs.map(t), ...row.outputs].join(" ").toLowerCase().includes(search.trim().toLowerCase()));

  const resetResult = () => { setResult(null); setError(""); };
  const addFiles = (incoming: File[]) => {
    if (pending) return;
    const next = [...files, ...incoming];
    if (next.length > FILE_LIMITS.maxFiles) { setError("Maksimum 10 file per proses."); return; }
    if (next.reduce((sum, file) => sum + file.size, 0) > FILE_LIMITS.maxBytes) { setError("Total file melebihi 100 MB. Kurangi jumlah atau ukuran file."); return; }
    setFiles(next); resetResult();
  };
  const dropped = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); };
  const processFiles = async () => {
    const issue = validateSelection(files, mode, selected, engines || {});
    if (issue || !engines) { setError(issue || "Tunggu pemeriksaan server selesai."); return; }
    const controller = new AbortController();
    request.current = controller;
    setPending(true); resetResult();
    const uploadedFiles: { pathname: string; name: string; size: number }[] = [];
    try {
      if (process.env.NODE_ENV === "development") {
        const body = new FormData();
        files.forEach(file => body.append("files", file));
        body.append("target", selected); body.append("preset", preset);
        const response = await fetch(fileApiEndpoint(mode), { method: "POST", body, signal: controller.signal, credentials: "same-origin" });
        if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || "File tidak dapat diproses."); }
        const blob = await response.blob();
        let notes: string[] = [];
        try { const bytes = Uint8Array.from(atob(response.headers.get("X-File-Notes") || ""), char => char.charCodeAt(0)); notes = JSON.parse(new TextDecoder().decode(bytes)); } catch {}
        const encoded = response.headers.get("Content-Disposition")?.split("filename*=UTF-8''")[1];
        const name = encoded ? decodeURIComponent(encoded) : "celi-result.zip";
        if (!controller.signal.aborted) setResult({ url: URL.createObjectURL(blob), cleanupPath: "", name, size: blob.size, original: total, notes });
        return;
      }
      const uploadResults = await Promise.allSettled(files.map(async file => {
        const safeName = (file.name.replaceAll("\\", "/").split("/").at(-1)?.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180) || "file").replace(/^\.{1,2}$/, "file");
        const stored = await upload(`celi-input/${crypto.randomUUID()}/${safeName}`, file, {
          access: "private", handleUploadUrl: "/api/files/upload", multipart: file.size > 5 * 1024 * 1024,
          contentType: file.type || "application/octet-stream", abortSignal: controller.signal,
        });
        const entry = { pathname: stored.pathname, name: file.name, size: file.size };
        uploadedFiles.push(entry);
        return entry;
      }));
      const failedUpload = uploadResults.find(result => result.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;
      const uploaded = uploadResults.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      const accessToken = await getFileAccessToken(controller.signal);
      const response = await fetch(fileApiEndpoint(mode), {
        method: "POST", signal: controller.signal, credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ files: uploaded, target: selected, preset }),
      });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || "File tidak dapat diproses."); }
      const payload = await response.json();
      if (!controller.signal.aborted) setResult({ url: payload.downloadUrl, cleanupPath: payload.cleanupPath, name: payload.name, size: payload.size, original: total, notes: payload.notes || [] });
    } catch (caught) {
      if (uploadedFiles.length) {
        try {
          const accessToken = await getFileAccessToken();
          await Promise.all(uploadedFiles.map(file => fetch(fileApiEndpoint("compress").replace("/compress", "/delete"), {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ pathname: file.pathname }), credentials: "same-origin",
          }).catch(() => {})));
        } catch {}
      }
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Koneksi terputus. File belum dapat diproses.");
    } finally { if (!controller.signal.aborted) setPending(false); }
  };

  return <main className="file-workspace tool-page">
    <div className="page-heading"><span className="eyebrow">FILE WORKSPACE</span><h1>{converting ? t("Format yang tepat. Tanpa repot.") : t("Lebih ringan. Lebih mudah dibagikan.")}</h1><p>{converting ? t("Ubah gambar, dokumen, data, audio, dan video ke format yang Anda butuhkan.") : t("Optimalkan ukuran file atau gabungkan berbagai jenis file dalam satu arsip.")}</p></div>
    <div className="file-server-status" role="status"><Server size={15} />{engines ? t("Server pemrosesan siap") : capabilityError ? t("Server belum tersedia") : t("Memeriksa ketersediaan server…")}<span>{t("Maks. 10 file · total 100 MB")}</span></div>
    {capabilityError && <div className="alert alert-error" role="alert"><CircleAlert size={18}/><span>{t(capabilityError)}</span><button className="text-button" onClick={() => setRefresh(value => value + 1)}>{t("Periksa lagi")}</button></div>}
    <div className="file-workspace-grid">
      <section className="panel file-upload-panel" aria-labelledby="file-input-title">
        <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">01</span><div><h2 id="file-input-title">{t("Pilih file Anda")}</h2><p>{t("Satu file atau beberapa sekaligus")}</p></div></div>{files.length > 0 && <button className="icon-button" disabled={pending} aria-label={t("Hapus semua file")} onClick={() => { setFiles([]); resetResult(); }}><Trash2 size={17}/></button>}</div>
        <div className={`file-dropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!pending) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropped}>
          <span className="file-drop-icon">{converting ? <FileInput size={29}/> : <FileArchive size={29}/>}</span>
          <h3>{t("Tarik file ke sini")}</h3><p>{t("atau pilih langsung dari perangkat Anda")}</p>
          <button className="secondary-button" disabled={pending} onClick={() => input.current?.click()}><Upload size={16}/>{t("Pilih file")}</button>
          <input type="file" ref={input} hidden multiple accept={converting ? accepts : undefined} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }}/>
          <small>{converting ? t("Format gambar, PDF, Office, data, audio & video") : t("Semua jenis file untuk ZIP, TAR.GZ, GZIP, BZIP2 & XZ")}</small>
        </div>
        {files.length > 0 && <div className="file-queue" aria-label={t("File terpilih")}>{files.map((file, index) => <div className="file-queue-row" key={index}><span className="file-extension">{file.name.split(".").pop()?.slice(0,5).toUpperCase() || "FILE"}</span><div><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)} · {t(converterGroup(file.name)?.label || "File lainnya")}</small></div><button className="icon-button" disabled={pending} aria-label={t("Hapus") + " " + file.name} onClick={() => { setFiles(files.filter((_, item) => item !== index)); resetResult(); }}><X size={15}/></button></div>)}<div className="file-queue-total"><span>{files.length} {t("file dipilih")}</span><strong>{formatBytes(total)}</strong></div></div>}
      </section>
      <section className="panel file-options-panel" aria-labelledby="file-settings-title">
        <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">02</span><div><h2 id="file-settings-title">{converting ? t("Atur hasil konversi") : t("Pilih cara kompresi")}</h2><p>{t("Sesuaikan dengan kebutuhan Anda")}</p></div></div></div>
        <div className="file-options-body"><label htmlFor="file-target">{converting ? t("Format tujuan") : t("Metode kompresi")}</label><select id="file-target" disabled={pending || (converting && !choices.length)} value={selected} onChange={event => { setTarget(event.target.value); resetResult(); }}>{!choices.length && <option value="">{files.length ? t("Tidak ada format tujuan yang sesuai") : t("Pilih file terlebih dahulu")}</option>}{choices.map(choice => <option key={choice} value={choice}>{converting ? choice.toUpperCase() : t(COMPRESS_METHODS.find(method => method.id === choice)?.label || "")}</option>)}</select>
          <label htmlFor="file-preset">{t("Preset kualitas")}</label><select id="file-preset" disabled={pending} value={preset} onChange={event => { setPreset(event.target.value); resetResult(); }}><option value="small">{t("Ukuran kecil")}</option><option value="balanced">{t("Seimbang (disarankan)")}</option><option value="quality">{t("Kualitas tinggi")}</option></select><small className="file-setting-hint">{t("Preset memengaruhi gambar, audio, video, dan optimasi PDF. Arsip ZIP/TAR.GZ/GZIP/BZIP2/XZ menggunakan kompresi lossless.")}</small>
          {!converting && selectedMethod && <div className="file-format-note"><CircleAlert size={16}/><p>{t(selectedMethod.note)}</p></div>}
          {converting && groups.filter(Boolean).map(id => <div className="file-format-note" key={id}><CircleAlert size={16}/><p>{t(CONVERTER_GROUPS.find(group => group.id === id)?.note || "")}</p></div>)}
          {selectionError && <p className="file-selection-error" role="status">{t(selectionError)}</p>}
          <button className="primary-button file-process-button" disabled={pending || !files.length || !engines || !!selectionError} onClick={processFiles}>{pending ? <><LoaderCircle size={17} className="spin"/>{t("Memproses file…")}</> : <>{converting ? <Files size={17}/> : <FileArchive size={17}/>} {converting ? t("Konversi file") : t("Kompres file")}<ArrowRight size={17}/></>}</button>
          <p className="file-privacy"><Server size={14}/>{t("File disimpan sementara secara privat untuk diproses. Hasil akan dihapus setelah diunduh atau paling lambat 24 jam. Proses batch maksimum 4 menit.")}</p>
        </div>
      </section>
    </div>
    {pending && <div className="file-processing" role="status"><LoaderCircle size={23} className="spin"/><div><strong>{t("Sedang menyiapkan hasil Anda")}</strong><p>{t("Konversi video atau dokumen besar membutuhkan waktu lebih lama. Biarkan halaman ini tetap terbuka.")}</p></div></div>}
    {error && <div className="alert alert-error" role="alert"><CircleAlert size={18}/><span>{t(error)}</span></div>}
    {result && <section className="file-result" aria-label={t("Hasil pemrosesan")}><div className="file-result-heading"><span className="file-result-check"><Check size={22}/></span><div><h2>{t("File Anda sudah siap")}</h2><p>{result.name}{result.cleanupPath ? t(" · tautan unduh berlaku 1 jam") : ""}</p></div><a href={result.url} download={result.cleanupPath ? undefined : result.name} className="primary-button" onClick={() => { if (result.cleanupPath) window.setTimeout(() => { void (async () => { try { const accessToken = await getFileAccessToken(); await fetch(fileApiEndpoint("compress").replace("/compress", "/delete"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ pathname: result.cleanupPath }), credentials: "same-origin" }); } catch {} })(); }, 5 * 60 * 1000); }}><Download size={17}/>{t("Unduh hasil")}</a></div><div className="file-result-stats"><div><span>{t("Ukuran awal")}</span><strong>{formatBytes(result.original)}</strong></div><ArrowRight size={19}/><div><span>{t("Ukuran hasil")}</span><strong>{formatBytes(result.size)}</strong></div><div className={savings > 0 ? "file-saved" : "file-larger"}><strong>{Math.abs(savings).toLocaleString("id-ID", { maximumFractionDigits:1 })}% {savings >= 0 ? t("lebih kecil") : t("lebih besar")}</strong><span>{t("Ukuran berdasarkan hasil aktual")}</span></div></div>{result.notes.map((note, index) => <p key={index} className="file-result-note"><CircleAlert size={14}/>{t(note)}</p>)}</section>}
    <section className="file-supported" aria-labelledby="supported-title">
      <div className="file-supported-heading"><div><h2 id="supported-title">{t("Format yang didukung")}</h2><p>{converting ? t("Pilihan tujuan mengikuti jenis file sumber dan engine yang tersedia.") : t("ZIP dan arsip lossless menerima semua jenis file; optimasi khusus mengikuti format sumber.")}</p></div><label className="file-format-search"><Search size={16}/><input aria-label={t("Cari format file")} value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Cari PDF, MP4, DOCX…")}/></label></div>
      <div className="file-format-table-wrap" role="region" aria-label={t("Tabel format yang didukung")} tabIndex={0}>
        <table className="file-format-table">
          <caption className="sr-only">{converting ? t("Format sumber dan tujuan konversi") : t("Format sumber dan hasil kompresi")}</caption>
          <thead><tr><th scope="col">{t("Jenis file")}</th><th scope="col">{t("Format sumber")}</th><th scope="col">{converting ? t("Format tujuan") : t("Hasil kompresi / arsip")}</th><th scope="col">{t("Status engine")}</th></tr></thead>
          <tbody>{formatRows.map(row => <tr key={row.id}><th scope="row">{t(row.label)}</th><td>{row.inputs.map(t).join(", ")}</td><td>{row.outputs.join(", ")}</td><td><span className={`file-engine-status${!engines || !engines[row.engine] ? " unavailable" : ""}`}>{!engines ? t("Memeriksa…") : engines[row.engine] ? t("Tersedia") : t("Belum tersedia")}</span></td></tr>)}</tbody>
        </table>
        {formatRows.length === 0 && <p className="file-format-empty" role="status">{t("Tidak ada format yang cocok dengan “")}{search}{t("”. Coba ekstensi atau jenis file lain.")}</p>}
      </div>
      <p className="file-table-scroll-hint">{t("Geser tabel ke samping untuk melihat semua kolom.")}</p>
      <p className="file-support-footer">{t("Ekstensi yang sama dapat memakai codec atau struktur berbeda. File rusak, terenkripsi, sangat besar, atau berisi resource eksternal dapat ditolak dengan pesan kesalahan. Format lain tetap dapat dimasukkan ke arsip.")}</p>
    </section>
  </main>;
}


"use client";
import { useLanguage } from "./language-provider";
import { useAppDialog } from "./app-dialog";
import RacePanel from "./race-panel";
import Image from "next/image";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";
import { ArrowUpRight, Braces, CircleAlert, Plus, Send, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { parseCurl, parseCurlPaste, parseRequestJson, replaceQuery, validateRequest, applyAuthorization, sanitizeSavedRequest, createDynamicVariables, resolveApiVariables, runApiScript, type ApiAuthorization, type ImportedRequest, type RequestRow } from "../lib/api-client.mjs";

type Tab = "params" | "headers" | "body" | "authorization" | "pre-script" | "tests";
type SavedRequest = ImportedRequest & { id: string; preScript: string; testScript: string };
type Collection = { id: string; name: string; folders: { id: string; name: string; requests: SavedRequest[] }[] };
const storageKey = "celi-tools:api-collections:v1";
type ResponseResult = { status: number; statusText: string; milliseconds: number; bytes: number; headers: RequestRow[]; text: string; base64: string; contentType: string; previewType: string | null; truncated: boolean };
const emptyRow = (): RequestRow => ({ key: "", value: "" });
const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const maxImportBytes = 1024 * 1024;

function KeyValueEditor({ label, rows, onChange }: { label: string; rows: RequestRow[]; onChange: (rows: RequestRow[]) => void }) {
  const { t } = useLanguage();
  const update = (index: number, patch: Partial<RequestRow>) => onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <div className="api-table">
    <div className="api-table-head" aria-hidden="true"><span>KEY</span><span>VALUE</span><span /></div>
    {rows.map((row, index) => <div className="api-table-row" key={index}>
      <input aria-label={`${t(label)} ${t("Key")} ${index + 1}`} placeholder={t("Key")} value={row.key} onChange={event => update(index, { key: event.target.value })} />
      <input aria-label={`${t(label)} ${t("Value")} ${index + 1}`} placeholder={t("Value")} value={row.value} onChange={event => update(index, { value: event.target.value })} />
      <button type="button" className="icon-button api-remove" aria-label={`${t("Hapus")} ${t(label)} ${index + 1}`} onClick={() => onChange(rows.length === 1 ? [emptyRow()] : rows.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
    </div>)}
    <button type="button" className="api-add-row" onClick={() => onChange([...rows, emptyRow()])}><Plus size={15} /> {t("Tambah ")}{t(label)}</button>
  </div>;
}

export default function ApiClient() {
  const { t } = useLanguage();
  const { ask, dialog } = useAppDialog();
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<RequestRow[]>([emptyRow()]);
  const [params, setParams] = useState<RequestRow[]>([emptyRow()]);
  const [body, setBody] = useState("");
  const [bodyMode, setBodyMode] = useState<"raw" | "binary" | "multipart">("raw");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [fieldName, setFieldName] = useState("file");
  const [activeTab, setActiveTab] = useState<Tab>("params");
  const [auth, setAuth] = useState<ApiAuthorization>({ type: "none" });
  const [preScript, setPreScript] = useState("");
  const [testScript, setTestScript] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<{ name: string; passed: boolean }[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionError, setCollectionError] = useState("");
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [response, setResponse] = useState<ResponseResult | null>(null);
  const [responseView, setResponseView] = useState<"body" | "headers">("body");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [imports, setImports] = useState<ImportedRequest[]>([]);
  const [importError, setImportError] = useState("");
  const [pasteMessage, setPasteMessage] = useState<{ text: string; error: boolean; warning?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && raw.length < 2_000_000) {
        const saved: unknown = JSON.parse(raw);
        if (Array.isArray(saved) && saved.every(item => item && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.folders) && item.folders.every((folder: { id?: unknown; name?: unknown; requests?: unknown }) => typeof folder.id === "string" && typeof folder.name === "string" && Array.isArray(folder.requests)))) setTimeout(() => setCollections(saved as Collection[]), 0);
      }
    } catch { /* Malformed or unavailable local storage is ignored. */ }
  }, []);
  function persistCollections(next: Collection[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setCollections(next); setCollectionError(""); }
    catch { setCollectionError("Koleksi tidak dapat disimpan di browser."); }
  }
  async function addCollection() {
    const name = await ask({ title: "Buat koleksi", description: "Beri nama koleksi untuk mengelompokkan request.", inputLabel: "Nama koleksi", confirmLabel: "Buat koleksi" });
    if (name) persistCollections([...collections, { id: crypto.randomUUID(), name: name.slice(0, 100), folders: [] }]);
  }
  async function addFolder(collection: Collection) {
    const name = await ask({ title: "Buat folder", description: "Beri nama folder untuk menyimpan request dalam koleksi ini.", inputLabel: "Nama folder", confirmLabel: "Buat folder" });
    if (name) persistCollections(collections.map(item => item.id === collection.id ? { ...item, folders: [...item.folders, { id: crypto.randomUUID(), name: name.slice(0, 100), requests: [] }] } : item));
  }
  async function saveRequest(collection: Collection, folderId: string) {
    const name = await ask({ title: "Simpan request", description: "Beri nama request agar mudah ditemukan kembali.", inputLabel: "Nama request", confirmLabel: "Simpan" });
    if (!name) return;
    const request: SavedRequest = { ...sanitizeSavedRequest({ name: name.slice(0, 100), method, url, headers, body }), id: crypto.randomUUID(), preScript, testScript };
    persistCollections(collections.map(item => item.id === collection.id ? { ...item, folders: item.folders.map(folder => folder.id === folderId ? { ...folder, requests: [...folder.requests, request] } : folder) } : item));
  }
  function loadSaved(request: SavedRequest) { applyImport(request); setAuth({ type: "none" }); setPreScript(request.preScript || ""); setTestScript(request.testScript || ""); setTestResults([]); }


  function updateUrl(value: string) {
    setUrl(value);
    try {
      const parsed = new URL(value);
      const next = Array.from(parsed.searchParams, ([key, val]) => ({ key, value: val }));
      setParams(next.length ? next : [emptyRow()]);
    } catch { /* Preserve rows while the user is still entering an address. */ }
  }

  function updateParams(rows: RequestRow[]) {
    setParams(rows);
    try { setUrl(replaceQuery(url, rows)); } catch { /* Apply the rows when a valid URL is supplied. */ }
  }

  function applyImport(request: ImportedRequest) {
    setBodyMode("raw"); setRequestFile(null);
    setAuth({ type: "none" }); setPreScript(""); setTestScript(""); setTestResults([]);
    setMethod(request.method); updateUrl(request.url);
    setHeaders(request.headers.length ? request.headers : [emptyRow()]);
    setBody(request.body); setResponse(null); setError("");
    setImportOpen(false); setImports([]); setImportText(""); setImportError("");
    setPasteMessage(request.ignoredHeaders?.length ? { text: request.ignoredHeaders.join(", "), error: false, warning: true } : null);
  }

  function handleUrlPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!/^\s*curl(?:\s|$)/.test(text)) { setPasteMessage(null); return; }
    event.preventDefault();
    try {
      const request = parseCurlPaste(text, { server: true });
      if (!request) return;
      applyImport(request);
      if (!request.ignoredHeaders?.length) setPasteMessage({ text: "cURL berhasil diimpor. Periksa request sebelum mengirim.", error: false });
    } catch (cause) {
      setPasteMessage({ text: cause instanceof Error ? cause.message : "Impor gagal.", error: true });
    }
  }

  function importRequest() {
    try {
      const text = importText.trim();
      if (!text) throw new Error("Tempel cURL atau JSON terlebih dahulu.");
      if (new TextEncoder().encode(text).byteLength > maxImportBytes) throw new Error("Impor dibatasi hingga 1 MB.");
      const requests = /^curl(?:\s|$)/.test(text) ? [parseCurl(text, { server: true })] : parseRequestJson(text);
      if (requests.length === 1) applyImport(requests[0]);
      else { setImports(requests); setImportError(""); }
    } catch (cause) { setImports([]); setImportError(cause instanceof Error ? cause.message : "Impor gagal."); }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > maxImportBytes) { setImportError("Impor dibatasi hingga 1 MB."); return; }
    try { setImportText(await file.text()); setImports([]); setImportError(""); }
    catch { setImportError("File tidak dapat dibaca."); }
  }

  function prepareRequest() {
      const dynamic = createDynamicVariables();
      const runVariables = runApiScript(preScript, { ...variables, ...dynamic }, null).variables;
      setVariables(Object.fromEntries(Object.entries(runVariables).filter(([key]) => !Object.hasOwn(dynamic, key))));
      const sourceUrl = resolveApiVariables(url, runVariables);
      const resolvedParams = params.map(row => ({ key: resolveApiVariables(row.key, runVariables), value: resolveApiVariables(row.value, runVariables) }));
      const composedUrl = resolvedParams.some(row => row.key.trim()) ? replaceQuery(sourceUrl, resolvedParams) : sourceUrl;
      const resolvedHeaders = headers.map(row => ({ key: resolveApiVariables(row.key, runVariables), value: resolveApiVariables(row.value, runVariables) }));
      const resolvedAuth = { ...auth, token: resolveApiVariables(auth.token || "", runVariables), username: resolveApiVariables(auth.username || "", runVariables), password: resolveApiVariables(auth.password || "", runVariables), key: resolveApiVariables(auth.key || "", runVariables), value: resolveApiVariables(auth.value || "", runVariables) };
      const input = applyAuthorization({ name: "Request", method, url: composedUrl, headers: resolvedHeaders, body: resolveApiVariables(body, runVariables) }, resolvedAuth);
      return { request: input, runVariables };
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setError(""); setResponse(null); setTestResults([]);
    let prepared: ReturnType<typeof prepareRequest>;
    try { prepared = prepareRequest(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Request tidak valid."); return; }
    const { request, runVariables } = prepared;
    const abortController = new AbortController();
    controller.current = abortController;
    const timer = setTimeout(() => abortController.abort("timeout"), 60_000);
    setSending(true);
    try {
      let file;
      if (bodyMode !== "raw") {
        if (!requestFile || requestFile.size < 1 || requestFile.size > 512 * 1024) throw new Error("Pilih file berukuran maksimal 512 KB.");
        const bytes = new Uint8Array(await requestFile.arrayBuffer());
        let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
        file = { name: requestFile.name, contentType: requestFile.type || "application/octet-stream", base64: btoa(binary), mode: bodyMode, fieldName };
      }
      const res = await fetch("/api/api-client/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, body: file ? "" : request.body, file }), signal: abortController.signal });
      const result = await res.json();
      if (!res.ok) throw new Error(typeof result.error === "string" ? result.error : "Request tidak berhasil.");
      setResponse(result); setResponseView("body");
      try { const checked = runApiScript(testScript, runVariables, result); const dynamicKeys = createDynamicVariables(); setVariables(Object.fromEntries(Object.entries(checked.variables).filter(([key]) => !Object.hasOwn(dynamicKeys, key)))); setTestResults(checked.tests); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Skrip test tidak valid."); }
    } catch (cause) {
      setError(abortController.signal.aborted
        ? abortController.signal.reason === "timeout" ? "Request melewati batas 60 detik." : "Request dibatalkan."
        : cause instanceof Error ? cause.message : "API tidak dapat dijangkau.");
    } finally { clearTimeout(timer); controller.current = null; setSending(false); }
  }

  function downloadResponse(result: ResponseResult) {
    const binary = atob(result.base64);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const address = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const link = document.createElement("a");
    const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "application/pdf": "pdf", "application/json": "json", "text/plain": "txt", "application/zip": "zip" };
    link.href = address; link.download = `response.${extensions[result.contentType] || "bin"}`; link.click();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "params", label: "Query Params", count: params.filter(row => row.key.trim()).length },
    { id: "headers", label: "Headers", count: headers.filter(row => row.key.trim()).length },
    { id: "authorization", label: "Authorization" },
    { id: "body", label: "Body" },
    { id: "pre-script", label: "Pre-request Script" },
    { id: "tests", label: "Tests" },
  ];
  return <main className="tool-page api-client-page">
    {dialog}
    <div className="page-heading api-client-heading"><div><span className="eyebrow">API CLIENT</span><h1>{t("Request lebih mudah, respons lebih jelas.")}</h1><p>{t("Kirim request dan periksa respons API dalam satu ruang kerja.")}</p></div><button type="button" className="secondary-button" onClick={() => setImportOpen(!importOpen)} aria-expanded={importOpen} aria-controls="api-import"><Upload size={16} /> {t("Impor cURL / JSON")}</button></div>
    <section className="panel api-collections"><div className="api-section-heading"><div><h2>{t("Koleksi")}</h2><p>{t("Simpan dan kelompokkan request di browser ini.")}</p></div><div className="api-collection-actions"><button type="button" className="secondary-button" onClick={() => setCollectionsOpen(!collectionsOpen)} aria-expanded={collectionsOpen}>{collectionsOpen ? t("Tutup") : t("Buka koleksi")}</button><button type="button" className="secondary-button" onClick={() => void addCollection()}><Plus size={15}/>{t("Koleksi")}</button></div></div>
      {collectionsOpen && <div className="api-collection-list"><p>{t("Authorization dan header rahasia umum tidak disimpan. Periksa URL, body, dan skrip sebelum menyimpan karena dapat berisi data sensitif.")}</p>{collectionError && <p role="alert">{t(collectionError)}</p>}{collections.length === 0 && <p>{t("Belum ada koleksi. Buat koleksi untuk mulai.")}</p>}{collections.map(collection => <details key={collection.id}><summary>{collection.name}</summary><div className="api-collection-actions"><button type="button" onClick={() => void addFolder(collection)}>+ {t("Folder")}</button><button type="button" onClick={async () => { const name = await ask({ title: "Ganti nama koleksi", description: "Masukkan nama baru untuk koleksi ini.", inputLabel: "Nama koleksi", initialValue: collection.name, confirmLabel: "Simpan" }); if (name) persistCollections(collections.map(item => item.id === collection.id ? { ...item, name: name.slice(0, 100) } : item)); }}>{t("Ganti nama")}</button><button type="button" onClick={async () => { if (await ask({ title: "Hapus koleksi?", description: "Koleksi, folder, dan semua request di dalamnya akan dihapus dari browser ini.", confirmLabel: "Hapus koleksi", destructive: true })) persistCollections(collections.filter(item => item.id !== collection.id)); }}>{t("Hapus")}</button></div>{collection.folders.map(folder => <details key={folder.id}><summary>{folder.name}</summary><div className="api-collection-actions"><button type="button" onClick={() => void saveRequest(collection, folder.id)}>+ {t("Simpan request")}</button><button type="button" onClick={async () => { const name = await ask({ title: "Ganti nama folder", description: "Masukkan nama baru untuk folder ini.", inputLabel: "Nama folder", initialValue: folder.name, confirmLabel: "Simpan" }); if (name) persistCollections(collections.map(item => item.id === collection.id ? { ...item, folders: item.folders.map(entry => entry.id === folder.id ? { ...entry, name: name.slice(0, 100) } : entry) } : item)); }}>{t("Ganti nama")}</button><button type="button" onClick={async () => { if (await ask({ title: "Hapus folder?", description: "Folder dan semua request di dalamnya akan dihapus dari browser ini.", confirmLabel: "Hapus folder", destructive: true })) persistCollections(collections.map(item => item.id === collection.id ? { ...item, folders: item.folders.filter(entry => entry.id !== folder.id) } : item)); }}>{t("Hapus")}</button></div>{folder.requests.map(item => <div className="api-saved-row" key={item.id}><button type="button" onClick={() => loadSaved(item)}><strong>{item.method}</strong> {item.name}</button><button type="button" aria-label={`${t("Perbarui dari editor")} ${item.name}`} onClick={() => { const updated = { ...sanitizeSavedRequest({ name: item.name, method, url, headers, body }), id: item.id, preScript, testScript }; persistCollections(collections.map(entry => entry.id === collection.id ? { ...entry, folders: entry.folders.map(group => group.id === folder.id ? { ...group, requests: group.requests.map(saved => saved.id === item.id ? updated : saved) } : group) } : entry)); }}>{t("Perbarui dari editor")}</button><button type="button" aria-label={`${t("Ganti nama")} ${item.name}`} onClick={async () => { const name = await ask({ title: "Ganti nama request", description: "Masukkan nama baru untuk request ini.", inputLabel: "Nama request", initialValue: item.name, confirmLabel: "Simpan" }); if (name) persistCollections(collections.map(entry => entry.id === collection.id ? { ...entry, folders: entry.folders.map(group => group.id === folder.id ? { ...group, requests: group.requests.map(saved => saved.id === item.id ? { ...saved, name: name.slice(0, 100) } : saved) } : group) } : entry)); }}>{t("Ganti nama")}</button><button type="button" aria-label={`${t("Hapus")} ${item.name}`} onClick={async () => { if (await ask({ title: "Hapus request?", description: "Request tersimpan ini akan dihapus dari browser ini.", confirmLabel: "Hapus request", destructive: true })) persistCollections(collections.map(entry => entry.id === collection.id ? { ...entry, folders: entry.folders.map(group => group.id === folder.id ? { ...group, requests: group.requests.filter(saved => saved.id !== item.id) } : group) } : entry)); }}><Trash2 size={15}/></button></div>)}</details>)}</details>)}</div>}
    </section>
    {importOpen && <section className="panel api-import" id="api-import" aria-labelledby="api-import-title"><div className="api-section-heading"><div><h2 id="api-import-title">{t("Impor request")}</h2><p>{t("Tempel cURL, request JSON, atau koleksi Postman. Hapus autentikasi Postman dari JSON dan isi header secara manual; ganti juga variabel environment.")}</p></div><button type="button" className="icon-button" aria-label={t("Tutup impor")} onClick={() => setImportOpen(false)}><X size={17} /></button></div>
      <textarea aria-label={t("cURL atau JSON untuk diimpor")} className="api-import-input" value={importText} onChange={event => { setImportText(event.target.value); setImports([]); setImportError(""); }} placeholder={'curl https://api.example.com/users\n\natau {"method":"GET","url":"https://api.example.com/users"}'} spellCheck={false} />
      <div className="api-import-actions"><button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> {t("Pilih file")}</button><input ref={fileInput} hidden type="file" accept=".json,.txt,application/json,text/plain" onChange={importFile} /><button type="button" className="primary-button" onClick={importRequest}>{t("Baca request")}</button><span>{t("Maks. 1 MB")}</span></div>
      {importError && <p className="api-inline-error" role="alert">{t(importError)}</p>}
      {imports.length > 0 && <div className="api-import-list"><p>{t("Pilih request dari koleksi:")}</p>{imports.map((item, index) => <button type="button" key={`${item.name}-${index}`} onClick={() => applyImport(item)}><strong>{item.method}</strong><span>{item.name}</span><ArrowUpRight size={15} /></button>)}</div>}
    </section>}
    <section className="panel api-request" aria-labelledby="api-request-title"><div className="api-section-heading"><div><span className="api-kicker">01 / REQUEST</span><h2 id="api-request-title">{t("Siapkan request")}</h2></div><span className="api-private"><ShieldCheck size={15} /> {t("Simpan secara manual")}</span></div>
      <form className="api-send-bar" onSubmit={send}><label className="sr-only" htmlFor="api-method">{t("Metode HTTP")}</label><select id="api-method" value={method} onChange={event => setMethod(event.target.value)}>{methods.map(item => <option key={item}>{item}</option>)}</select><label className="sr-only" htmlFor="api-url">URL API</label><input id="api-url" type="text" inputMode="url" value={url} onPaste={handleUrlPaste} onChange={event => { setPasteMessage(null); updateUrl(event.target.value); }} placeholder="https://api.example.com/v1/resource" autoComplete="off" spellCheck={false} required />{sending ? <button type="button" className="secondary-button" onClick={() => controller.current?.abort()}>{t("Batalkan")}</button> : <button className="primary-button" type="submit"><Send size={16} /> {t("Send")}</button>}</form>
      {pasteMessage && <p className={pasteMessage.error ? "api-paste-message api-inline-error" : "api-paste-message"} role={pasteMessage.error ? "alert" : "status"}>{pasteMessage.warning ? <>{t("cURL diimpor. Data berikut tidak disalin karena dikendalikan browser:")} {pasteMessage.text}. {t("Respons dapat berbeda. Periksa CORS pada server tujuan.")}</> : t(pasteMessage.text)}</p>}
      <div className="api-tabs" role="tablist" aria-label={t("Pengaturan request")} onKeyDown={event => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return; event.preventDefault(); const index = tabs.findIndex(tab => tab.id === activeTab); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; setActiveTab(tabs[next].id); document.getElementById(`api-tab-${tabs[next].id}`)?.focus(); }}>{tabs.map(tab => <button type="button" role="tab" id={`api-tab-${tab.id}`} key={tab.id} aria-controls="api-request-panel" aria-selected={tab.id === activeTab} tabIndex={tab.id === activeTab ? 0 : -1} className={tab.id === activeTab ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{t(tab.label)}{!!tab.count && <span>{tab.count}</span>}</button>)}</div>
      <div id="api-request-panel" role="tabpanel" aria-labelledby={`api-tab-${activeTab}`} className="api-request-content">{activeTab === "params" ? <KeyValueEditor label="parameter" rows={params} onChange={updateParams} /> : activeTab === "headers" ? <KeyValueEditor label="header" rows={headers} onChange={setHeaders} /> : activeTab === "authorization" ? <div className="api-auth-editor"><label>{t("Jenis authorization")}<select value={auth.type} onChange={event => setAuth({ type: event.target.value as ApiAuthorization["type"] })}><option value="none">{t("Tanpa authorization")}</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="api-key">API Key</option></select></label>{auth.type === "bearer" && <label>Token<input type="password" autoComplete="off" value={auth.token || ""} onChange={event => setAuth({ ...auth, token: event.target.value })}/></label>}{auth.type === "basic" && <><label>Username<input autoComplete="off" value={auth.username || ""} onChange={event => setAuth({ ...auth, username: event.target.value })}/></label><label>Password<input type="password" autoComplete="new-password" value={auth.password || ""} onChange={event => setAuth({ ...auth, password: event.target.value })}/></label></>}{auth.type === "api-key" && <><label>{t("Key")}<input value={auth.key || ""} onChange={event => setAuth({ ...auth, key: event.target.value })}/></label><label>{t("Value")}<input type="password" autoComplete="off" value={auth.value || ""} onChange={event => setAuth({ ...auth, value: event.target.value })}/></label><label>{t("Tambahkan ke")}<select value={auth.placement || "header"} onChange={event => setAuth({ ...auth, placement: event.target.value as "header" | "query" })}><option value="header">Header</option><option value="query">Query Params</option></select></label></>}</div> : activeTab === "pre-script" || activeTab === "tests" ? <div className="api-body-editor"><div><strong>{activeTab === "pre-script" ? "Pre-request Script" : "Tests"}</strong></div><p>{t("Subset aman: satu perintah per baris. JavaScript bebas, jaringan, dan akses DOM tidak didukung.")}</p><textarea aria-label={activeTab === "pre-script" ? "Pre-request Script" : "Tests"} value={activeTab === "pre-script" ? preScript : testScript} onChange={event => activeTab === "pre-script" ? setPreScript(event.target.value) : setTestScript(event.target.value)} placeholder={activeTab === "pre-script" ? 'pm.environment.set("id", "42");' : 'pm.test("Status 200", () => pm.response.to.have.status(200));'} spellCheck={false}/><p>{t("Gunakan variabel sebagai {{nama}} di URL, header, atau body. Variabel hanya disimpan selama halaman terbuka.")}</p></div> : <div className="api-body-editor"><div><strong>Body</strong><label>{t("Jenis body")} <select value={bodyMode} onChange={event => setBodyMode(event.target.value as "raw" | "binary" | "multipart")}><option value="raw">Raw</option><option value="binary">Binary file</option><option value="multipart">Form-data file</option></select></label></div>{bodyMode === "raw" ? <><textarea aria-label="Request body" placeholder={'{\n  "name": "Celi"\n}'} value={body} onChange={event => setBody(event.target.value)} spellCheck={false} /><p>{t("Jika body valid JSON dan Content-Type kosong, application/json ditambahkan.")}</p></> : <div className="api-file-editor"><label>{t("Pilih file")}<input type="file" onChange={event => setRequestFile(event.target.files?.[0] || null)} /></label>{bodyMode === "multipart" && <label>{t("Nama field")}<input value={fieldName} onChange={event => setFieldName(event.target.value)} /></label>}<p>{t("Maksimum 512 KB. File dipindai sebelum dikirim; jika pemindai tidak tersedia, file ditolak.")}</p></div>}<p>{t("Variabel: {{timestamp}}, {{timestemp}}, {{localdate}}, {{$timestamp}}, {{$isoTimestamp}}, {{$guid}}.")}</p></div>}</div>
    </section>
    <RacePanel prepareRequest={() => { if (bodyMode !== "raw") throw new Error("Uji race belum mendukung file."); return validateRequest(prepareRequest().request); }} />
    <section className="panel api-response" aria-labelledby="api-response-title"><div className="api-section-heading"><div><span className="api-kicker">02 / RESPONSE</span><h2 id="api-response-title">{t("Respons")}</h2></div>{response && <div className="api-response-meta"><span className={`api-status ${response.status >= 200 && response.status < 300 ? "is-success" : "is-error"}`}>{response.status} {response.statusText}</span><span>{response.milliseconds.toLocaleString("id-ID")} ms</span><span>{response.truncated ? "≥ " : ""}{response.bytes.toLocaleString("id-ID")} byte</span></div>}</div>
      {error ? <div className="api-empty api-error" role="alert"><CircleAlert size={26} /><strong>{t("Request belum berhasil")}</strong><p>{t(error)}</p></div> : response ? <div className="api-response-body"><div className="api-tabs" role="group" aria-label={t("Bagian respons")}><button type="button" className={responseView === "body" ? "active" : ""} aria-pressed={responseView === "body"} onClick={() => setResponseView("body")}>Body</button><button type="button" className={responseView === "headers" ? "active" : ""} aria-pressed={responseView === "headers"} onClick={() => setResponseView("headers")}>{t("Headers")} <span>{response.headers.length}</span></button></div>{responseView === "headers" ? <dl className="api-response-headers">{response.headers.map((row, index) => <div key={`${row.key}-${index}`}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl> : <><div className="api-response-caption">BODY {response.truncated && <span>{t("· Respons dipotong pada 2 MiB")}</span>}</div><div className="api-response-actions"><span>{response.contentType}</span>{response.base64 && <button type="button" className="secondary-button" onClick={() => downloadResponse(response)}>{t("Unduh respons")}</button>}</div>{response.previewType && !response.truncated ? <Image className="api-response-image" src={`data:${response.previewType};base64,${response.base64}`} width={800} height={600} unoptimized alt={t("Pratinjau gambar respons")} /> : response.text ? <pre><code>{response.text}</code></pre> : <p className="api-response-file">{response.base64 ? t("Respons berupa file biner. Unduh untuk melihat isinya.") : t("(Respons kosong)")}</p>}</>}</div> : <div className="api-empty"><Braces size={28} /><strong>{sending ? t("Menunggu respons…") : t("Respons akan tampil di sini")}</strong><p>{sending ? t("Request sedang diproses oleh API tujuan.") : t("Masukkan URL dan tekan Send untuk memulai.")}</p></div>}
    </section>
    {testResults.length > 0 && <section className="panel api-test-results"><h2>{t("Hasil test")}</h2>{testResults.map((test, index) => <p key={index}>{test.passed ? "✓" : "✕"} {test.name}</p>)}</section>}
    <div className="workspace-help"><ShieldCheck size={18} /><p><strong>{t("Request dikirim melalui server.")}</strong> {t("Hanya alamat publik yang diizinkan. Cookie dan header hanya dikirim ke tujuan; redirect otomatis tidak diikuti. Uji race tetap berjalan di browser dan memerlukan CORS.")}</p></div>
  </main>;
}

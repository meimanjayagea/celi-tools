"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Clock3, Square } from "lucide-react";
import { runRace, validateRaceOptions, type RaceResult } from "../lib/api-race.mjs";
import { useLanguage } from "./language-provider";

type RequestSnapshot = { url: string; method: string; headers: Headers; body?: string };
type Phase = "idle" | "scheduled" | "running";

/** Run a one-time bounded batch using a snapshot of the current request. */
export default function RacePanel({ prepareRequest }: { prepareRequest: () => RequestSnapshot }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("10");
  const [schedule, setSchedule] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scheduledAt, setScheduledAt] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [error, setError] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); controller.current?.abort(); }; }, []);

  async function execute(request: RequestSnapshot, total: number) {
    timer.current = null;
    if (!alive.current) return;
    const batch = new AbortController(); controller.current = batch;
    setScheduledAt(null); setPhase("running"); setProgress(0);
    try {
      const summary = await runRace(request, { count: total, signal: batch.signal, onProgress: completed => { if (alive.current && (completed === total || completed % 10 === 0)) setProgress(completed); } });
      if (alive.current) { setProgress(summary.completed); setResult(summary); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Pengujian tidak dapat dijalankan."); }
    finally { active.current = false; controller.current = null; if (alive.current) setPhase("idle"); }
  }
  function start() {
    if (active.current) return;
    setError(""); setResult(null);
    try {
      const options = validateRaceOptions({ count: Number(count), schedule });
      const request = prepareRequest();
      active.current = true;
      if (options.scheduledAt !== null) {
        setScheduledAt(options.scheduledAt); setPhase("scheduled");
        timer.current = setTimeout(() => { void execute(request, options.count); }, options.scheduledAt - Date.now());
      } else void execute(request, options.count);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request tidak valid."); }
  }
  function cancel() {
    if (phase === "scheduled") { if (timer.current) clearTimeout(timer.current); timer.current = null; active.current = false; setScheduledAt(null); setPhase("idle"); setError("Jadwal pengujian dibatalkan."); }
    else controller.current?.abort();
  }
  return <section className="panel race-panel" aria-labelledby="race-title">
    <div className="api-section-heading"><div><h2 id="race-title"><Activity size={18}/>{t("Uji race condition")}</h2><p>{t("Kirim request yang disiapkan secara paralel untuk mengamati hasilnya.")}</p></div><button type="button" className="secondary-button" aria-expanded={open} aria-controls="race-content" onClick={() => setOpen(!open)}>{open ? t("Tutup") : t("Buka pengujian")}</button></div>
    {open && <div className="race-content" id="race-content">
      <p className="race-hint">{t("Uji hanya sistem yang Anda miliki atau diizinkan. Request dapat mengubah data; browser dan server dapat mengantre koneksi, sehingga waktu tiba tidak dijamin bersamaan.")}</p>
      <div className="race-fields"><label>{t("Jumlah request")}<input type="number" min="1" max="1000" step="1" value={count} disabled={phase !== "idle"} onChange={event => setCount(event.target.value)}/><small>{t("1–1.000 request per pengujian")}</small></label><label>{t("Jadwal sekali (opsional)")}<input type="datetime-local" step="1" value={schedule} disabled={phase !== "idle"} onInput={event => setSchedule(event.currentTarget.value)}/><small>{t("Kosongkan untuk menjalankan sekarang; maksimum 24 jam.")}</small></label></div>
      <p className="race-hint">{t("Biarkan halaman terbuka. Browser dapat menunda jadwal pada tab latar belakang. Pengaturan dan kredensial hanya disimpan di memori; tutup atau muat ulang halaman untuk membatalkan.")}</p>
      <p className="race-hint">{t("Pre-request script dijalankan sekali saat pengujian disiapkan; tab Tests tidak dijalankan untuk setiap respons. Bandingkan data server untuk memastikan adanya race condition.")}</p>
      <div className="race-actions">{phase === "idle" ? <button type="button" className="primary-button" onClick={start}><Activity size={16}/>{schedule ? t("Jadwalkan pengujian") : t("Jalankan pengujian")}</button> : <button type="button" className="secondary-button" onClick={cancel}><Square size={15}/>{phase === "scheduled" ? t("Batalkan jadwal") : t("Hentikan pengujian")}</button>}
      {phase === "scheduled" && scheduledAt && <span role="status"><Clock3 size={15}/>{t("Dijadwalkan:")} {new Date(scheduledAt).toLocaleString(language === "en" ? "en-US" : "id-ID")}</span>}{phase === "running" && <span role="status">{t("Selesai:")} {progress} / {count}</span>}</div>
      {error && <p className="api-inline-error race-error" role="alert">{t(error)}</p>}
      {result && <div className="race-results" role="status"><h3>{t("Hasil pengujian")}</h3><p>{result.canceled ? t("Dihentikan.") : result.timedOut ? t("Batas waktu 60 detik tercapai.") : t("Pengujian selesai.")} {t("Selesai:")} {result.completed}/{result.count} · {result.durationMs} ms</p><div className="race-result-grid"><div><strong>{result.networkErrors}</strong><span>{t("Gagal dijangkau / CORS")}</span></div><div><strong>{result.aborted}</strong><span>{t("Dibatalkan / batas waktu")}</span></div><div><strong>{result.averageMs === null ? "—" : `${result.averageMs} ms`}</strong><span>{t("Rata-rata respons")}</span></div><div><strong>{result.minMs === null ? "—" : `${result.minMs}–${result.maxMs} ms`}</strong><span>{t("Tercepat – terlambat")}</span></div></div><div className="race-statuses"><strong>{t("Status HTTP")}</strong>{Object.keys(result.statuses).length ? Object.entries(result.statuses).sort(([a],[b]) => Number(a)-Number(b)).map(([status,total]) => <span key={status}>{status}: {total}</span>) : <span>—</span>}</div><p>{t("Waktu diukur hingga header respons diterima. Isi respons tidak disimpan.")}</p></div>}
    </div>}
  </section>;
}

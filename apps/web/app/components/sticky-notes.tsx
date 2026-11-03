"use client";
import { useLanguage } from "./language-provider";

import { Bell, BellRing, LoaderCircle, Plus, Search, StickyNote as StickyIcon, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StickyDateTimePicker from "./sticky-date-time-picker";

type Note = { id: string; content: string; positionX: number; positionY: number; color: string; tags: string[]; reminderAt: string | null; createdAt: string; updatedAt: string };
const colors = ["yellow", "blue", "pink", "green", "purple"] as const;
const colorNames: Record<string, string> = { yellow: "Kuning", blue: "Biru", pink: "Merah muda", green: "Hijau", purple: "Ungu" };
const errorMessage = (data: unknown) => data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Terjadi kesalahan. Coba lagi.";

export default function StickyNotes() {
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const canvasRef = useRef<HTMLDivElement>(null);
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingChanges = useRef(new Map<string, Partial<Note>>());
  const saveQueue = useRef(new Map<string, Promise<void>>());
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [removing, setRemoving] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sticky-notes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data));
      setNotes(data.notes);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Catatan belum dapat dimuat."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    const timers = pending.current;
    return () => { clearTimeout(timer); timers.forEach(clearTimeout); };
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => setPermission("Notification" in window ? Notification.permission : "unsupported"), 0);
    return () => clearTimeout(timer);
  }, []);

  const save = useCallback(async (id: string, changes: Partial<Note>) => {
    const response = await fetch(`/api/sticky-notes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data));
  }, []);

  const enqueueSave = useCallback((id: string, changes: Partial<Note>) => {
    const previous = saveQueue.current.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => save(id, changes)).catch(err => {
      setError(err instanceof Error ? err.message : "Catatan belum tersimpan.");
    });
    saveQueue.current.set(id, next);
    void next.finally(() => { if (saveQueue.current.get(id) === next) saveQueue.current.delete(id); });
  }, [save]);

  const scheduleSave = useCallback((id: string, changes: Partial<Note>) => {
    setNotes(current => current.map(note => note.id === id ? { ...note, ...changes } : note));
    pendingChanges.current.set(id, { ...pendingChanges.current.get(id), ...changes });
    const previous = pending.current.get(id);
    if (previous) clearTimeout(previous);
    pending.current.set(id, setTimeout(() => {
      pending.current.delete(id);
      const queuedChanges = pendingChanges.current.get(id);
      pendingChanges.current.delete(id);
      if (queuedChanges) enqueueSave(id, queuedChanges);
    }, 450));
  }, [enqueueSave]);
  const flushSave = useCallback((id: string, changes: Partial<Note> = {}) => {
    const timer = pending.current.get(id);
    if (timer) clearTimeout(timer);
    pending.current.delete(id);
    const queuedChanges = { ...pendingChanges.current.get(id), ...changes };
    pendingChanges.current.delete(id);
    if (Object.keys(queuedChanges).length) enqueueSave(id, queuedChanges);
  }, [enqueueSave]);

  const addNote = async () => {
    setBusy(true); setError("");
    const rows = Math.floor(notes.length / 4);
    const note = { content: "", positionX: 24 + (notes.length % 4) * 224, positionY: 24 + rows * 224, color: colors[notes.length % colors.length], tags: [] as string[], reminderAt: null };
    try {
      const response = await fetch("/api/sticky-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note) });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data));
      setNotes(current => [data.note, ...current]);
      setNotice("Catatan baru dibuat.");
      setTimeout(() => setNotice(""), 2500);
    } catch (err) { setError(err instanceof Error ? err.message : "Catatan belum dapat dibuat."); }
    finally { setBusy(false); }
  };

  const deleteNote = async (id: string) => {
    const timer = pending.current.get(id);
    if (timer) clearTimeout(timer);
    pending.current.delete(id);
    pendingChanges.current.delete(id);
    setRemoving(current => current.includes(id) ? current : [...current, id]);
    await new Promise(resolve => setTimeout(resolve, 190));
    try {
      await saveQueue.current.get(id)?.catch(() => {});
      const response = await fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data));
      setNotes(current => current.filter(note => note.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : "Catatan belum dapat dihapus."); }
    finally { setRemoving(current => current.filter(noteId => noteId !== id)); }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    try { setPermission(await Notification.requestPermission()); }
    catch { setError("Izin notifikasi tidak dapat diminta dari browser ini."); }
  };
  useEffect(() => {
    if (permission !== "granted") return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/sticky-notes/reminders", { method: "POST", cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json();
        for (const reminder of data.reminders as { id: string; content: string }[]) {
          if (!stopped) new Notification(t("Pengingat Celi Tools"), { body: reminder.content.trim().slice(0, 180) || t("Catatan yang Anda jadwalkan sudah waktunya.") });
        }
      } catch { /* Retry on the next interval; notification polling is best effort. */ }
    };
    void check();
    const timer = setInterval(check, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [permission, t]);

  const tags = useMemo(() => [...new Set(notes.flatMap(note => note.tags))].sort((a, b) => a.localeCompare(b, "id")), [notes]);
  const shown = useMemo(() => notes.filter(note => note.content.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")) && (!activeTag || note.tags.includes(activeTag))), [notes, search, activeTag]);
  const canvasHeight = Math.max(330, ...shown.map(note => note.positionY + 290));
  const canvasWidth = Math.max(0, ...shown.map(note => note.positionX + 286));

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, note: Note) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    drag.current = { id: note.id, dx: event.clientX - rect.left - note.positionX, dy: event.clientY - rect.top - note.positionY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.round(event.clientX - rect.left - drag.current.dx));
    const y = Math.max(0, Math.round(event.clientY - rect.top - drag.current.dy));
    setNotes(current => current.map(note => note.id === drag.current?.id ? { ...note, positionX: x, positionY: y } : note));
  };
  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const note = notes.find(item => item.id === drag.current?.id);
    if (note) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const positionX = Math.max(0, Math.round(event.clientX - rect.left - drag.current.dx));
        const positionY = Math.max(0, Math.round(event.clientY - rect.top - drag.current.dy));
        scheduleSave(note.id, { positionX, positionY });
      }
    }
    drag.current = null;
  };

  return <main className="sticky-page">
    <section className="sticky-heading"><div><span className="eyebrow">{t("RUANG KERJA PRIBADI")}</span><h1>Sticky Note</h1><p>{t("Simpan ide, atur posisi, dan beri pengingat pada catatan Anda.")}</p></div>
      <div className="sticky-heading-actions"><button className="secondary-button" onClick={requestNotifications} disabled={permission === "unsupported"} title={permission === "granted" ? t("Notifikasi aktif") : t("Aktifkan notifikasi browser")}>{permission === "granted" ? <BellRing size={17}/> : <Bell size={17}/>}<span>{permission === "granted" ? t("Notifikasi aktif") : permission === "unsupported" ? t("Notifikasi tidak didukung") : t("Aktifkan notifikasi")}</span></button><button className="primary-button" onClick={addNote} disabled={busy}><Plus size={18}/>{busy ? t("Menyimpan…") : t("Catatan baru")}</button></div>
    </section>
    <section className="sticky-toolbar" aria-label={t("Pencarian dan filter catatan")}><label className="sticky-search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Cari isi catatan…")} aria-label={t("Cari isi catatan")} /></label><label className="sticky-tag-filter"><span>Tag</span><select value={activeTag} onChange={event => setActiveTag(event.target.value)} aria-label={t("Filter berdasarkan tag")}><option value="">{t("Semua tag")}</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label><span className="sticky-count">{shown.length} {t("catatan")}</span></section>
    {error && <p role="alert" className="alert alert-error sticky-alert">{t(error)}</p>}{notice && <p role="status" className="alert alert-success sticky-alert">{t(notice)}</p>}
    {permission !== "granted" && permission !== "unsupported" && <p className="sticky-reminder-hint">{t("Pengingat browser berjalan saat halaman ini terbuka. Aktifkan notifikasi agar catatan dapat memberi tahu Anda.")}</p>}
    {loading ? <div className="sticky-loading"><LoaderCircle className="spin" size={20}/> {t("Memuat catatan…")}</div> : shown.length ? <div className="sticky-board-scroll"><div ref={canvasRef} className="sticky-canvas" style={{ minHeight: canvasHeight, width: `max(100%, ${canvasWidth}px)` }}>
      {shown.map(note => <article key={note.id} className={`sticky-note sticky-note-${note.color}${removing.includes(note.id) ? " is-removing" : ""}`} style={{ left: note.positionX, top: note.positionY }}>
        <header className="sticky-note-header"><button className="sticky-drag-handle" aria-label={t("Geser catatan")} title={t("Geser catatan")} onPointerDown={event => startDrag(event, note)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><StickyIcon size={15}/><span>{t("Geser")}</span></button><div className="sticky-color-picker" aria-label={t("Warna catatan")}>{colors.map(color => <button type="button" key={color} aria-label={`${t("Warna")} ${t(colorNames[color])}`} aria-pressed={note.color === color} className={`sticky-color-dot sticky-dot-${color}`} onClick={() => scheduleSave(note.id, { color })}/>)}</div><button className="sticky-icon-action" aria-label={t("Hapus catatan")} title={t("Hapus catatan")} onClick={() => void deleteNote(note.id)}><Trash2 size={16}/></button></header>
        <textarea className="sticky-note-text" value={note.content} maxLength={5000} placeholder={t("Tulis ide Anda…")} aria-label={t("Isi catatan")} onChange={event => scheduleSave(note.id, { content: event.target.value })} onBlur={event => flushSave(note.id, { content: event.target.value })}/>
        <label className="sticky-field"><span>{t("Tag, pisahkan dengan koma")}</span><input key={`${note.id}:${note.tags.join(",")}`} defaultValue={note.tags.join(", ")} maxLength={250} aria-label={t("Tag catatan")} placeholder={t("Kerja, Pribadi")} onBlur={event => { const value = event.target.value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 10); if (value.join("\0") !== note.tags.join("\0")) scheduleSave(note.id, { tags: value }); }}/></label>
        <StickyDateTimePicker value={note.reminderAt} onChange={reminderAt => scheduleSave(note.id, { reminderAt })} />
        <footer className="sticky-note-footer"><span>{t("Dibuat ")}{new Date(note.createdAt).toLocaleDateString(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>{note.reminderAt && <Bell size={13} aria-label={t("Pengingat aktif")}/>}</footer>
      </article>)}
    </div></div> : <div className="sticky-empty"><StickyIcon size={32}/><h2>{search || activeTag ? t("Tidak ada catatan yang cocok") : t("Belum ada catatan")}</h2><p>{search || activeTag ? t("Ubah kata pencarian atau filter tag.") : t("Buat catatan pertama untuk mulai mengumpulkan ide.")}</p>{!search && !activeTag && <button className="primary-button" onClick={addNote}><Plus size={18}/>{t("Buat catatan pertama")}</button>}{(search || activeTag) && <button className="secondary-button" onClick={() => { setSearch(""); setActiveTag(""); }}><X size={16}/>{t("Hapus filter")}</button>}</div>}
    <p className="sticky-privacy"><span>{t("Catatan pribadi")}</span> {t("· Tersimpan aman di akun Anda dan hanya dapat diakses setelah masuk.")}</p>
  </main>;
}

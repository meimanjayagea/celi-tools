"use client";
import { useLanguage } from "./language-provider";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Copy, Check, CodeXml, FileInput, LockKeyhole, StickyNote, Waypoints } from "lucide-react";
import { WORKSPACES } from "../lib/workspaces";
import { SAMPLE_JSON } from "../lib/sample";
const workspaces = WORKSPACES;
type NoteSummary = { id: string; content: string; tags: string[]; reminderAt: string | null; updatedAt: string };
const quickActions = [
  { href: "/json", label: "Buka JSON Workspace", icon: CodeXml },
  { href: "/crypto", label: "Buka Crypto Tools", icon: LockKeyhole },
  { href: "/converter", label: "Buka File Converter", icon: FileInput },
  { href: "/api-client", label: "Buka API Client", icon: Waypoints },
];
export default function Dashboard() {
  const { t } = useLanguage();
    const [openWorkspace, setOpenWorkspace] = useState<string | null>(workspaces[0].href);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [notes, setNotes] = useState<NoteSummary[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [notesError, setNotesError] = useState(false);
    useEffect(() => {
      let active = true;
      const loadNotes = async () => {
        try {
          const response = await fetch("/api/sticky-notes", { cache: "no-store", credentials: "same-origin" });
          if (!response.ok) throw new Error("Catatan belum dapat dimuat.");
          const data = await response.json();
          if (!Array.isArray(data.notes)) throw new Error("Invalid notes response");
          if (active) setNotes(data.notes.slice(0, 3));
        } catch {
          if (active) { setNotes([]); setNotesError(true); }
        } finally {
          if (active) setNotesLoading(false);
        }
      };
      const timer = window.setTimeout(() => { void loadNotes(); }, 0);
      return () => { active = false; window.clearTimeout(timer); };
    }, []);
    return <main className="dashboard">
    <section className="dashboard-hero"><div><h1>{t("Satu workspace. Banyak yang beres.")}</h1><p>{t("Konversi file, ringankan ukuran, rapikan JSON, kumpulkan catatan, dan olah teks. Pilih tools yang Anda butuhkan, selesaikan pekerjaan tanpa berpindah aplikasi.")}</p><Link href="/converter" className="primary-button hero-action">{t("Mulai konversi file ")}<ArrowRight size={19}/></Link></div><Image src="/images/workspace-hero.webp" width={390} height={260} alt={t("Ilustrasi workspace kode dan keamanan data")} priority className="hero-illustration" unoptimized/></section>
    <section className="dashboard-control" aria-labelledby="dashboard-control-title">
      <div className="dashboard-control-heading"><div><span className="eyebrow">{t("RINGKASAN WORKSPACE")}</span><h2 id="dashboard-control-title">{t("Lanjutkan pekerjaan Anda")}</h2></div><Link href="/sticky-notes" className="dashboard-control-link">{t("Semua catatan")}<ArrowRight size={15}/></Link></div>
      <div className="dashboard-control-grid">
        <section className="dashboard-recent-notes" aria-labelledby="dashboard-notes-title"><div className="dashboard-control-card-title"><span className="dashboard-control-icon"><StickyNote size={18}/></span><div><h3 id="dashboard-notes-title">{t("Catatan terbaru")}</h3><p>{t("Catatan pribadi Anda")}</p></div></div>
          {notesLoading ? <p className="dashboard-control-empty" role="status">{t("Memuat catatan…")}</p> : notesError ? <p className="dashboard-control-empty" role="status">{t("Catatan belum dapat dimuat. Buka Sticky Note untuk mencoba lagi.")}</p> : notes.length ? <ul>{notes.map(note => <li key={note.id}><Link href="/sticky-notes"><strong>{note.content.trim().split("\n")[0] || t("Catatan tanpa judul")}</strong><span>{note.tags.slice(0, 2).map(tag => `#${tag}`).join(" · ") || new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></Link></li>)}</ul> : <p className="dashboard-control-empty">{t("Belum ada catatan. Buat sticky note pertama Anda.")}</p>}
        </section>
        <section className="dashboard-quick-actions" aria-labelledby="dashboard-actions-title"><div className="dashboard-control-card-title"><span className="dashboard-control-icon"><ArrowRight size={18}/></span><div><h3 id="dashboard-actions-title">{t("Aksi cepat")}</h3><p>{t("Pilih tool dan langsung mulai")}</p></div></div><div className="dashboard-action-list">{quickActions.map(({ href, label, icon: Icon }) => <Link key={href} href={href}><Icon size={17}/><span>{t(label)}</span><ArrowRight size={14}/></Link>)}</div></section>
      </div>
    </section>
    <section className="workspace-directory" aria-labelledby="workspace-title"><h2 id="workspace-title">{t("Pilih ruang kerja yang Anda butuhkan")}</h2><p className="section-description">{t("Enam ruang kerja untuk menyiapkan file, data, catatan, dan request API.")}</p>
      <div className="workspace-accordion">{workspaces.map(({ title, href, icon: Icon, description, features, tools }) => {
        const expanded = openWorkspace === href;
        const id = `workspace-${href.slice(1)}`;
        return <article className={`workspace-card${expanded ? " is-open" : ""}`} key={href}>
          <h3 className="workspace-card-heading"><button type="button" id={`${id}-trigger`} className="workspace-card-trigger" aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={() => setOpenWorkspace(expanded ? null : href)}>
            <span className="workspace-card-icon" aria-hidden="true"><Icon size={27} strokeWidth={1.7}/></span>
            <span className="workspace-card-label"><span>{title}</span><small>{t(features[0])}</small></span>
            <ChevronDown className="workspace-card-chevron" size={20} aria-hidden="true"/>
          </button></h3>
          <div className="workspace-card-panel" id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!expanded}>
            <p>{t(description)}</p><div className="tool-tags">{tools.map(tool => <Link href={tool.href} key={tool.label}>{t(tool.label)}</Link>)}</div>
            <Link href={href} className="workspace-card-action">{t("Buka ")}{title}<ArrowRight size={16} aria-hidden="true"/></Link>
          </div>
        </article>;
      })}</div>
    </section>
    <section className="dashboard-sample" aria-labelledby="sample-title"><h2 id="sample-title">{t("Mulai dengan contoh JSON")}</h2><p className="section-description">{t("Gunakan contoh berikut untuk langsung mencoba fitur di JSON Workspace.")}</p><div className="sample-code"><div className="sample-code-header"><span>{t("Contoh JSON")}</span><button onClick={async () => { try {
        await navigator.clipboard.writeText(SAMPLE_JSON);
        setCopied(true);
        setError("");
        setTimeout(() => setCopied(false), 1800);
    }
    catch {
        setError("Clipboard tidak tersedia. Anda dapat memilih dan menyalin teks contoh.");
    } }}>{copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? t("Tersalin") : t("Salin contoh")}</button></div><div className="sample-code-body">{SAMPLE_JSON.split("\n").map((line, i) => <div key={i}><span className="sample-line-number" aria-hidden="true">{i + 1}</span><code>{line.split(/("(?:[^"\\]|\\.)*")/g).map((part, j, parts) => <span key={j} className={part.startsWith('"') ? (parts[j + 1]?.trim().startsWith(":") ? "syntax-key" : "syntax-string") : ""}>{part}</span>)}</code></div>)}</div></div><p className="sr-only" role="status">{copied ? t("Contoh JSON disalin") : t(error)}</p></section>
    <footer className="page-footer"><span>celimanapp <span>·</span> PORTAL TOOLS</span><span>{t("Ubah file. Ringankan ukuran. Rapikan data.")}</span></footer>
  </main>;
}

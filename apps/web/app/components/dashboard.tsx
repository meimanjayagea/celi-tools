"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, Copy, Check } from "lucide-react";
import { WORKSPACES } from "../lib/workspaces";
import { SAMPLE_JSON } from "../lib/sample";
const workspaces = WORKSPACES;
export default function Dashboard() {
    const [openWorkspace, setOpenWorkspace] = useState<string | null>(workspaces[0].href);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    return <main className="dashboard">
    <section className="dashboard-hero"><div><h1>Satu workspace. Banyak yang beres.</h1><p>Konversi file, ringankan ukuran, rapikan JSON, kumpulkan catatan, dan olah teks. Pilih tools yang Anda butuhkan, selesaikan pekerjaan tanpa berpindah aplikasi.</p><Link href="/converter" className="primary-button hero-action">Mulai konversi file <ArrowRight size={19}/></Link></div><Image src="/images/workspace-hero.webp" width={390} height={260} alt="Ilustrasi workspace kode dan keamanan data" priority className="hero-illustration" unoptimized/></section>
    <section className="workspace-directory" aria-labelledby="workspace-title"><h2 id="workspace-title">Pilih ruang kerja yang Anda butuhkan</h2><p className="section-description">Enam ruang kerja untuk menyiapkan file, data, catatan, dan request API.</p>
      <div className="workspace-accordion">{workspaces.map(({ title, href, icon: Icon, description, features, tools }) => {
        const expanded = openWorkspace === href;
        const id = `workspace-${href.slice(1)}`;
        return <article className={`workspace-card${expanded ? " is-open" : ""}`} key={href}>
          <h3 className="workspace-card-heading"><button type="button" id={`${id}-trigger`} className="workspace-card-trigger" aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={() => setOpenWorkspace(expanded ? null : href)}>
            <span className="workspace-card-icon" aria-hidden="true"><Icon size={27} strokeWidth={1.7}/></span>
            <span className="workspace-card-label"><span>{title}</span><small>{features[0]}</small></span>
            <ChevronDown className="workspace-card-chevron" size={20} aria-hidden="true"/>
          </button></h3>
          <div className="workspace-card-panel" id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!expanded}>
            <p>{description}</p><div className="tool-tags">{tools.map(tool => <Link href={tool.href} key={tool.label}>{tool.label}</Link>)}</div>
            <Link href={href} className="workspace-card-action">Buka {title}<ArrowRight size={16} aria-hidden="true"/></Link>
          </div>
        </article>;
      })}</div>
    </section>
    <section className="dashboard-sample" aria-labelledby="sample-title"><h2 id="sample-title">Mulai dengan contoh JSON</h2><p className="section-description">Gunakan contoh berikut untuk langsung mencoba fitur di JSON Workspace.</p><div className="sample-code"><div className="sample-code-header"><span>Contoh JSON</span><button onClick={async () => { try {
        await navigator.clipboard.writeText(SAMPLE_JSON);
        setCopied(true);
        setError("");
        setTimeout(() => setCopied(false), 1800);
    }
    catch {
        setError("Clipboard tidak tersedia. Anda dapat memilih dan menyalin teks contoh.");
    } }}>{copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? "Tersalin" : "Salin contoh"}</button></div><div className="sample-code-body">{SAMPLE_JSON.split("\n").map((line, i) => <div key={i}><span className="sample-line-number" aria-hidden="true">{i + 1}</span><code>{line.split(/("(?:[^"\\]|\\.)*")/g).map((part, j, parts) => <span key={j} className={part.startsWith('"') ? (parts[j + 1]?.trim().startsWith(":") ? "syntax-key" : "syntax-string") : ""}>{part}</span>)}</code></div>)}</div></div><p className="sr-only" role="status">{copied ? "Contoh JSON disalin" : error}</p></section>
    <footer className="page-footer"><span>CELI TOOLS <span>·</span> PORTAL TOOLS</span><span>Ubah file. Ringankan ukuran. Rapikan data.</span></footer>
  </main>;
}

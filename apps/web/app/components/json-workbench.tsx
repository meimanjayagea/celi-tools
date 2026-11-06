"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { stringify as stringifyYaml } from "yaml";
import { AlignLeft, Upload, Download, Copy, Printer, Wrench, Trash2, ChevronDown, Check, CircleAlert, CodeXml, Sparkles, Minimize2, ArrowDownAZ } from "lucide-react";
import { cleanJson, fixJson, formatJson, minifyJson, sortKeys, parseJson, toCsv, toXml } from "../lib/json-tools.mjs";
import { SAMPLE_JSON } from "../lib/sample";
type OutputTab = "tree" | "graph" | "json" | "xml" | "csv" | "yaml";
const tabs: {
    id: OutputTab;
    label: string;
}[] = [{ id: "tree", label: "Tree" }, { id: "graph", label: "Graph" }, { id: "json", label: "JSON" }, { id: "xml", label: "XML" }, { id: "csv", label: "CSV" }, { id: "yaml", label: "YAML" }];
function Icon({ name }: {
    name: string;
}) { const icons: Record<string, typeof Check> = { format: AlignLeft, upload: Upload, download: Download, copy: Copy, print: Printer, fix: Wrench, clear: Trash2, chevron: ChevronDown, check: Check, error: CircleAlert, code: CodeXml, spark: Sparkles }; const Component = icons[name] || CodeXml; return <Component size={17} aria-hidden="true"/>; }
function TypeBadge({ value }: {
    value: unknown;
}) {
    const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    return <span className={`type-badge type-${type}`}>{type}</span>;
}
function TreeNode({ name, value, depth = 0, path }: {
    name: string;
    value: unknown;
    depth?: number;
    path: string;
}) {
    const [expanded, setExpanded] = useState(depth < 2);
    const branch = value !== null && typeof value === "object";
    const entries = branch ? Object.entries(value as Record<string, unknown>) : [];
    const compactValue = Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`;
    const display = typeof value === "string" ? `"${value}"` : String(value);
    return (<div className="tree-node" style={{ "--depth": depth } as React.CSSProperties}>
      <div className="tree-row">
        {branch ? <button className={`tree-toggle ${expanded ? "is-open" : ""}`} onClick={() => setExpanded(!expanded)} aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}><Icon name="chevron"/></button> : <span className="tree-toggle-placeholder"/>}
        <span className="tree-key">{name}</span>
        {branch ? <button className="tree-branch-value" onClick={() => setExpanded(!expanded)}>{compactValue}</button> : <span className={`tree-value value-${typeof value}`}>{display}</span>}
        <TypeBadge value={value}/>
      </div>
      {branch && expanded && entries.length > 0 && <div className="tree-children">{entries.map(([childName, child], index) => <TreeNode key={`${path}.${childName}.${index}`} name={Array.isArray(value) ? `[${index}]` : childName} value={child} depth={depth + 1} path={`${path}.${childName}`}/>)}</div>}
    </div>);
}
function TreeView({ value }: {
    value: unknown;
}) {
    return <div className="tree-view"><TreeNode name="root" value={value} path="root"/></div>;
}
function GraphNode({ name, value, depth = 0, path }: {
    name: string;
    value: unknown;
    depth?: number;
    path: string;
}) {
    const [expanded, setExpanded] = useState(depth < 2);
    const branch = value !== null && typeof value === "object";
    const entries = branch ? Object.entries(value as Record<string, unknown>) : [];
    const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    const preview = branch ? `${Array.isArray(value) ? "Array" : "Object"} · ${entries.length} ${entries.length === 1 ? "item" : "items"}` : typeof value === "string" ? `“${value}”` : String(value);
    return (<div className="graph-node-wrap">
      <button className={`graph-card graph-${type}`} onClick={() => branch && setExpanded(!expanded)} aria-expanded={branch ? expanded : undefined}>
        <span className="graph-card-top"><span className="graph-name">{name}</span><TypeBadge value={value}/></span>
        <span className="graph-preview">{preview}</span>
        {branch && <span className="graph-expand">{expanded ? "−" : "+"}</span>}
      </button>
      {branch && expanded && entries.length > 0 && <div className="graph-children">{entries.map(([key, child], index) => <GraphNode key={`${path}.${key}.${index}`} name={Array.isArray(value) ? `[${index}]` : key} value={child} depth={depth + 1} path={`${path}.${key}`}/>)}</div>}
    </div>);
}
function GraphView({ value }: {
    value: unknown;
}) {
    return <div className="graph-view"><GraphNode name="root" value={value} path="root"/></div>;
}
export default function JsonWorkbench() {
  const { t } = useLanguage();
    const [input, setInput] = useState(SAMPLE_JSON);
    const [committed, setCommitted] = useState(SAMPLE_JSON);
    const [activeTab, setActiveTab] = useState<OutputTab>("tree");
    const [indent, setIndent] = useState(2);
    const [auto, setAuto] = useState(true);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState("");
    const [fileName, setFileName] = useState("data.json");
    const [copied, setCopied] = useState(false);
    const [editorShare, setEditorShare] = useState(1);
    const [resizing, setResizing] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const workbench = useRef<HTMLElement>(null);
    const parsed = useMemo(() => parseJson(committed), [committed]);
    const formatted = useMemo(() => parsed.error ? "" : JSON.stringify(parsed.value, null, indent), [parsed, indent]);
    const converted = useMemo(() => {
        if (parsed.error || !committed.trim())
            return { text: "", error: "" };
        try {
            return { text: activeTab === "xml" ? toXml(parsed.value) : activeTab === "csv" ? toCsv(parsed.value) : activeTab === "yaml" ? stringifyYaml(parsed.value) : formatted, error: "" };
        }
        catch (error) {
            return { text: "", error: error instanceof Error ? error.message : "Konversi gagal." };
        }
    }, [parsed, committed, activeTab, formatted]);
    const extension = ["xml", "csv", "yaml"].includes(activeTab) ? activeTab : "json";
    const stale = input !== committed;
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const view = params.get("view");
            if (tabs.some(tab => tab.id === view))
                setActiveTab(view as OutputTab);
            let text = SAMPLE_JSON;
            try {
                text = localStorage.getItem("celi-tools:last-json") ?? SAMPLE_JSON;
            }
            catch { }
            setInput(text);
            setCommitted(text);
            setReady(true);
            const remote = params.get("url");
            if (remote) {
                fetch(remote).then(r => { if (!r.ok)
                    throw new Error(String(r.status)); return r.text(); }).then(value => {
                    if (!cancelled) {
                        setInput(value);
                        setCommitted(value);
                        setNotice("JSON berhasil dimuat dari URL.");
                    }
                }).catch(() => { if (!cancelled)
                    setNotice("URL tidak dapat dimuat. Periksa alamat dan izin CORS."); });
            }
        }, 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, []);
    useEffect(() => {
        if (!ready)
            return;
        const timer = setTimeout(() => { try {
            localStorage.setItem("celi-tools:last-json", input);
        }
        catch { } }, 300);
        return () => clearTimeout(timer);
    }, [input, ready]);
    const update = (text: string) => { setInput(text); if (auto)
        setCommitted(text); setNotice(""); setCopied(false); };
    const transform = (operation: "format" | "fix" | "clean" | "minify" | "sort") => {
        try {
            const next = operation === "format" ? formatJson(input, indent) : operation === "fix" ? fixJson(input, indent) : operation === "minify" ? minifyJson(input) : JSON.stringify(operation === "clean" ? cleanJson(JSON.parse(input)) : sortKeys(JSON.parse(input)), null, indent);
            setInput(next);
            setCommitted(next);
            setNotice(operation === "fix" ? "Sintaks JSON diperbaiki. Periksa hasil sebelum digunakan." : operation === "clean" ? "Nilai kosong dihapus." : "JSON berhasil diperbarui.");
        }
        catch (error) {
            setCommitted(input);
            setNotice(error instanceof Error ? error.message : "JSON tidak valid.");
        }
    };
    const validate = () => { setCommitted(input); setNotice(parseJson(input).error ? "JSON tidak valid. Periksa detail kesalahan." : "JSON valid. Tidak ada kesalahan sintaks."); };
    const download = () => {
        if (!converted.text || stale)
            return;
        const url = URL.createObjectURL(new Blob([converted.text], { type: extension === "json" ? "application/json" : "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        setNotice("Hasil berhasil diunduh.");
    };
    const upload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => { const text = String(reader.result ?? ""); setInput(text); setCommitted(text); setFileName(file.name); setNotice("File berhasil dibuka."); };
        reader.onerror = () => setNotice("File tidak dapat dibaca.");
        reader.readAsText(file);
        event.target.value = "";
    };
    const valid = !parsed.error && !!committed.trim();
    const resizePanels = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (window.innerWidth <= 1150) return;
        const rect = workbench.current?.getBoundingClientRect();
        if (!rect) return;
        const share = Math.max(25, Math.min(75, ((event.clientX - rect.left) / rect.width) * 100));
        setEditorShare(share / (100 - share));
    };
    const resizeFromKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Home") { event.preventDefault(); setEditorShare(1 / 3); }
        else if (event.key === "End") { event.preventDefault(); setEditorShare(3); }
        else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setEditorShare(value => {
                const share = Math.max(25, Math.min(75, (value / (1 + value) * 100) + (event.key === "ArrowLeft" ? -2 : 2)));
                return share / (100 - share);
            });
        }
    };
    return <main className="tool-page">
    <div className="page-heading"><span className="eyebrow">JSON WORKSPACE</span><h1>{t("Format, validasi, pahami.")}</h1><p>{t("Rapikan data, jelajahi strukturnya, dan konversi ke format yang Anda butuhkan.")}</p></div>
    <div className="tool-heading-meta"><span className={`validation-pill ${valid ? "is-valid" : committed.trim() ? "is-invalid" : ""}`}>{valid ? <Check size={15}/> : <CircleAlert size={15}/>}{!committed.trim() ? t("Menunggu JSON") : valid ? t("JSON valid") : t("JSON tidak valid")}</span><span className="privacy-note">{t("Input terakhir disimpan di browser ini")}</span></div>
    <section ref={workbench} className="workbench" style={{ "--json-left-share": `${editorShare}fr`, "--json-right-share": `${1 / editorShare}fr` } as React.CSSProperties} aria-label={t("Workspace JSON")}>
      <div className="panel editor-panel">
        <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">01</span><div><h2>Input</h2><p>{t("Tempel JSON atau buka file")}</p></div></div><button className="subtle-button" onClick={() => { setInput(SAMPLE_JSON); setCommitted(SAMPLE_JSON); setNotice("Contoh JSON dimuat."); }}>{t("Contoh")}</button></div>
        <div className="editor-toolbar"><div className="toolbar-group"><button className="toolbar-button" onClick={() => fileInput.current?.click()}><Upload size={16}/>Upload</button><input ref={fileInput} hidden type="file" accept=".json,.txt,application/json,text/plain" onChange={upload}/><button className="toolbar-button" onClick={() => transform("fix")}><Wrench size={16}/>Fix JSON</button></div><label className="select-label">{t("Indentasi")}<select aria-label={t("Indentasi JSON")} value={indent} onChange={event => setIndent(Number(event.target.value))}><option value={2}>{t("2 spasi")}</option><option value={3}>{t("3 spasi")}</option><option value={4}>{t("4 spasi")}</option></select></label></div>
        <textarea className="json-editor" aria-label={t("Editor JSON")} value={input} onChange={e => update(e.target.value)} spellCheck={false} placeholder={t("Tempel JSON Anda di sini…")} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        transform("format");
    } }}/>
        <div className="editor-footer"><span>{input.split("\n").length} {t("baris · ")}{input.length.toLocaleString("id-ID")} {t("karakter")}</span><button className="text-button" onClick={() => { setInput(""); setCommitted(""); setNotice("Editor dikosongkan."); }}><Trash2 size={14}/>{t("Kosongkan")}</button></div>
        <div className="editor-actions"><button className="primary-button" onClick={() => transform("format")}><AlignLeft size={17}/>Format JSON <kbd>Ctrl ↵</kbd></button><button className="secondary-button" onClick={validate}><Check size={16}/>{t("Validasi")}</button><button className="secondary-button" onClick={() => transform("clean")}><Sparkles size={16}/>Clean</button></div>
        <div className="editor-extras"><button className="toolbar-button" onClick={() => transform("minify")}><Minimize2 size={15}/>Minify</button><button className="toolbar-button" onClick={() => transform("sort")}><ArrowDownAZ size={15}/>{t("Urutkan key")}</button><label className="auto-row"><input type="checkbox" checked={auto} onChange={e => { setAuto(e.target.checked); if (e.target.checked)
        setCommitted(input); }}/>{t("Update otomatis")}</label></div>
      </div>
      <div className={`json-splitter${resizing ? " is-dragging" : ""}`} role="separator" aria-orientation="vertical" aria-label={t("Atur lebar panel editor JSON")} aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(editorShare / (1 + editorShare) * 100)} tabIndex={0} onKeyDown={resizeFromKeyboard} onPointerDown={event => { if (window.innerWidth <= 1150) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setResizing(true); resizePanels(event); }} onPointerMove={event => { if (resizing) resizePanels(event); }} onPointerUp={event => { setResizing(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={() => setResizing(false)} />
      <div className="panel output-panel">
        <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">02</span><div><h2>{t("Hasil")}</h2><p>{t("Jelajahi dan ekspor data")}</p></div></div><button className="icon-button" aria-label={t("Cetak hasil JSON")} disabled={!valid || stale || !!converted.error} onClick={() => window.print()}><Printer size={17}/></button></div>
        <div className="output-tabs" role="tablist" aria-label={t("Format output")} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const i = tabs.findIndex(tab => tab.id === activeTab);
        const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        setActiveTab(tabs[next].id);
        document.getElementById("tab-" + tabs[next].id)?.focus();
    } }}>{tabs.map(tab => <button id={"tab-" + tab.id} key={tab.id} role="tab" tabIndex={activeTab === tab.id ? 0 : -1} aria-selected={activeTab === tab.id} aria-controls="json-output" className={`output-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); setCopied(false); }}>{tab.label}</button>)}</div>
        <div className="output-toolbar"><span className="output-filename">{fileName.replace(/\.[^.]+$/, "")}.{extension}</span><div className="toolbar-group"><button className="toolbar-button" disabled={!converted.text || stale} onClick={async () => { try {
        await navigator.clipboard.writeText(converted.text);
        setCopied(true);
        setNotice("Hasil disalin.");
    }
    catch {
        setNotice("Clipboard tidak tersedia.");
    } }}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? t("Tersalin") : t("Salin")}</button><button className="toolbar-button" disabled={!converted.text || stale} onClick={download}><Download size={15}/>{t("Simpan")}</button></div></div>
        <div id="json-output" role="tabpanel" aria-labelledby={"tab-" + activeTab} tabIndex={0} className={`output-content ${activeTab === "graph" ? "graph-content" : ""}`}>
          {parsed.error && committed.trim() ? <div className="empty-state error-state"><CircleAlert size={30}/><h3>{t("JSON belum dapat dibaca")}</h3><p>{t(parsed.error.message)}</p><span>{t("Baris ")}{parsed.error.line}{t(", kolom ")}{parsed.error.column}</span><button className="secondary-button" onClick={() => transform("fix")}>{t("Coba Fix JSON")}</button></div> : !committed.trim() ? <div className="empty-state"><CodeXml size={30}/><h3>{t("Preview tampil di sini")}</h3><p>{t("Tempel JSON atau muat contoh untuk memulai.")}</p></div> : converted.error ? <div className="empty-state error-state" role="alert"><CircleAlert size={30}/><h3>{t("Konversi tidak tersedia")}</h3><p>{t(converted.error)}</p></div> : activeTab === "tree" ? <TreeView value={parsed.value}/> : activeTab === "graph" ? <GraphView value={parsed.value}/> : <pre className="code-output"><code>{converted.text}</code></pre>}
        </div>
        <div className="output-footer">{stale ? <span className="status-warning">{t("Input berubah. Klik Validasi untuk memperbarui hasil.")}</span> : valid && !converted.error ? t("Hasil sesuai input terbaru") : t("Menunggu input yang valid")}</div>
      </div>
    </section>
    <p className="notice-line" role="status">{t(notice)}</p>
    <div className="workspace-help"><CodeXml size={18}/><p><strong>{t("Data tetap dalam kendali Anda.")}</strong> {t("Pemrosesan JSON berjalan di browser. Impor URL akan menghubungi alamat yang Anda tentukan.")}</p></div>
    <div className="print-only"><pre>{converted.text}</pre></div>
  </main>;
}

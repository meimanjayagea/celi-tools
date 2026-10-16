"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { stringify as stringifyYaml } from "yaml";
import { cleanJson, fixJson, formatJson, toCsv, toXml } from "../lib/json-tools.mjs";
import { TOOL_MENU_GROUPS } from "../lib/tool-menu.mjs";

type OutputTab = "tree" | "graph" | "json" | "xml" | "csv" | "yaml";
type ParseResult = { value: unknown; error: null } | { value: null; error: { message: string; line: number; column: number } };

const SAMPLE = `{
  "InsuranceCompanies": {
    "Top Insurance Companies": [
      { "No": "1", "Name": "Berkshire Hathaway ( BRK.A)", "Market Capitalization": "$308 billion" },
      { "No": "2", "Name": "JPMorgan Chase (JPM)", "Market Capitalization": "$412 billion" },
      { "No": "3", "Name": "Apple Inc. (AAPL)", "Market Capitalization": "$3.4 trillion" }
    ],
    "source": "investopedia.com",
    "Time": "Feb 2025"
  }
}`;

const tabs: { id: OutputTab; label: string }[] = [
  { id: "tree", label: "Tree view" },
  { id: "graph", label: "Graph view" },
  { id: "json", label: "JSON" },
  { id: "xml", label: "XML" },
  { id: "csv", label: "CSV" },
  { id: "yaml", label: "YAML" },
];

function getParseResult(text: string): ParseResult {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Invalid JSON";
    const positionMatch = message.match(/position\s+(\d+)/i);
    const position = positionMatch ? Number(positionMatch[1]) : Math.max(0, text.length - 1);
    const before = text.slice(0, position).split("\n");
    return {
      value: null,
      error: { message: message.replace(/\s+at position\s+\d+.*$/i, ""), line: before.length, column: before.at(-1)!.length + 1 },
    };
  }
}

function Icon({ name }: { name: "format" | "upload" | "download" | "copy" | "print" | "fix" | "clear" | "chevron" | "check" | "error" | "code" | "spark" }) {
  const paths: Record<typeof name, ReactNode> = {
    format: <><path d="M4 7h16M7 4v6m10-6v6M5 13h14M8 13v7m8-7v7" /><path d="M4 20h16" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5h14v-5" /></>,
    download: <><path d="M12 4v12m0 0 5-5m-5 5-5-5" /><path d="M5 20h14" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    print: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /><path d="M17 11h.01" /></>,
    fix: <><path d="m14 6 4 4M4 20l7-7m-1-6 5-5 6 6-5 5M5 8l3-3 5 5-3 3z" /></>,
    clear: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    error: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function TypeBadge({ value }: { value: unknown }) {
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  return <span className={`type-badge type-${type}`}>{type}</span>;
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && /\.(apng|avif|gif|jpe?g|png|svg|webp)(?:$|\?)/i.test(url.href);
  } catch {
    return false;
  }
}

function TreeNode({ name, value, depth = 0, path }: { name: string; value: unknown; depth?: number; path: string }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const branch = value !== null && typeof value === "object";
  const entries = branch ? Object.entries(value as Record<string, unknown>) : [];
  const compactValue = Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`;
  const display = typeof value === "string" ? `"${value}"` : String(value);
  const image = isImageUrl(value);
  return (
    <div className="tree-node" style={{ "--depth": depth } as React.CSSProperties}>
      <div className="tree-row">
        {branch ? <button className={`tree-toggle ${expanded ? "is-open" : ""}`} onClick={() => setExpanded(!expanded)} aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}><Icon name="chevron" /></button> : <span className="tree-toggle-placeholder" />}
        <span className="tree-key">{name}</span>
        {branch ? <button className="tree-branch-value" onClick={() => setExpanded(!expanded)}>{compactValue}</button> : <span className={`tree-value value-${typeof value}`}>{display}</span>}
        <TypeBadge value={value} />
        {image && <span className="image-hover" aria-label="Image preview"><span className="image-indicator">↗</span><span className="image-preview"><Image src={value} alt="Preview of JSON image URL" width={170} height={120} unoptimized /></span></span>}
      </div>
      {branch && expanded && entries.length > 0 && <div className="tree-children">{entries.map(([childName, child], index) => <TreeNode key={`${path}.${childName}.${index}`} name={Array.isArray(value) ? `[${index}]` : childName} value={child} depth={depth + 1} path={`${path}.${childName}`} />)}</div>}
    </div>
  );
}

function TreeView({ value }: { value: unknown }) {
  return <div className="tree-view"><TreeNode name="root" value={value} path="root" /></div>;
}

function GraphNode({ name, value, depth = 0, path }: { name: string; value: unknown; depth?: number; path: string }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const branch = value !== null && typeof value === "object";
  const entries = branch ? Object.entries(value as Record<string, unknown>) : [];
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const preview = branch ? `${Array.isArray(value) ? "Array" : "Object"} · ${entries.length} ${entries.length === 1 ? "item" : "items"}` : typeof value === "string" ? `“${value}”` : String(value);
  return (
    <div className="graph-node-wrap">
      <button className={`graph-card graph-${type}`} onClick={() => branch && setExpanded(!expanded)} aria-expanded={branch ? expanded : undefined}>
        <span className="graph-card-top"><span className="graph-name">{name}</span><TypeBadge value={value} /></span>
        <span className="graph-preview">{preview}</span>
        {branch && <span className="graph-expand">{expanded ? "−" : "+"}</span>}
      </button>
      {branch && expanded && entries.length > 0 && <div className="graph-children">{entries.map(([key, child], index) => <GraphNode key={`${path}.${key}.${index}`} name={Array.isArray(value) ? `[${index}]` : key} value={child} depth={depth + 1} path={`${path}.${key}`} />)}</div>}
    </div>
  );
}

function GraphView({ value }: { value: unknown }) {
  return <div className="graph-view"><GraphNode name="root" value={value} path="root" /></div>;
}

export default function JsonWorkbench() {
  const [input, setInput] = useState(SAMPLE);
  const [committedInput, setCommittedInput] = useState(SAMPLE);
  const [activeTab, setActiveTab] = useState<OutputTab>("tree");
  const [indent, setIndent] = useState(2);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("data.json");
  const [restored, setRestored] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const parsed = useMemo(() => getParseResult(committedInput), [committedInput]);
  const inputLines = input.split("\n").length;
  const formatted = useMemo(() => parsed.error ? "" : JSON.stringify(parsed.value, null, indent), [parsed, indent]);
  const conversion = useMemo(() => {
    if (parsed.error) return "";
    try {
      if (activeTab === "xml") return toXml(parsed.value);
      if (activeTab === "csv") return toCsv(parsed.value);
      if (activeTab === "yaml") return stringifyYaml(parsed.value);
      return formatted;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to convert this JSON.";
    }
  }, [activeTab, formatted, parsed]);
  const fileExtension = activeTab === "xml" || activeTab === "csv" || activeTab === "yaml" ? activeTab : "json";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("celi-tools:last-json");
        if (stored) {
          setInput(stored);
          setCommittedInput(stored);
        }
      } catch { /* Storage may be disabled by the browser. */ }
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem("celi-tools:last-json", input); } catch { /* Keep the editor usable without storage. */ }
  }, [input, restored]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const remote = new URLSearchParams(window.location.search).get("url");
    if (!remote) return;
    let cancelled = false;
    fetch(remote).then((response) => {
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      return response.text();
    }).then((text) => {
      if (cancelled) return;
      setInput(text);
      setCommittedInput(text);
      setFileName(remote.split("/").at(-1) || "remote.json");
      setNotice("JSON loaded from URL");
    }).catch((error: unknown) => {
      if (!cancelled) setNotice(error instanceof Error ? `Could not load URL: ${error.message}` : "Could not load URL.");
    });
    return () => { cancelled = true; };
  }, []);

  const updateInput = (value: string) => {
    setInput(value);
    if (autoUpdate) setCommittedInput(value);
    setNotice("");
  };

  const format = () => {
    try {
      const next = formatJson(input, indent);
      setInput(next);
      setCommittedInput(next);
      setNotice("JSON formatted successfully");
    } catch {
      setCommittedInput(input);
      setNotice("JSON is invalid — check the highlighted error");
    }
  };

  const fix = () => {
    try {
      const next = fixJson(input, indent);
      setInput(next);
      setCommittedInput(next);
      setNotice("JSON repaired successfully");
    } catch (error) {
      setCommittedInput(input);
      const message = error instanceof Error ? error.message : "Could not repair this JSON";
      setNotice(`Could not repair JSON: ${message}`);
    }
  };

  const clean = () => {
    const result = getParseResult(input);
    if (result.error) {
      setCommittedInput(input);
      setNotice(`Cannot clean invalid JSON · line ${result.error.line}, column ${result.error.column}`);
      return;
    }
    const next = JSON.stringify(cleanJson(result.value), null, indent);
    setInput(next);
    setCommittedInput(next);
    setNotice("Empty values removed");
  };

  const validate = () => {
    setCommittedInput(input);
    const result = getParseResult(input);
    setNotice(result.error ? `Invalid JSON · line ${result.error.line}, column ${result.error.column}` : "Valid JSON · no syntax errors");
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setInput(text);
      setCommittedInput(text);
      setFileName(file.name);
      setNotice(`${file.name} loaded`);
    };
    reader.onerror = () => setNotice("Could not read that file");
    reader.readAsText(file);
    event.target.value = "";
  };

  const download = (content: string, extension: string) => {
    const blob = new Blob([content], { type: extension === "json" ? "application/json" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.[^.]+$/, "") || "data"}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${extension.toUpperCase()} file downloaded`);
  };

  const copy = async () => {
    if (!conversion) return;
    try {
      await navigator.clipboard.writeText(conversion);
      setCopied(true);
      setNotice("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice("Clipboard access is unavailable in this browser");
    }
  };

  const clear = () => {
    setInput("");
    setCommittedInput("");
    setNotice("Editor cleared");
  };

  const loadSample = () => {
    setInput(SAMPLE);
    setCommittedInput(SAMPLE);
    setFileName("insurance-companies.json");
    setNotice("Sample JSON loaded");
  };

  const runToolAction = (action: string) => {
    setSidebarOpen(false);
    switch (action) {
      case "format": format(); break;
      case "validate": validate(); break;
      case "fix": fix(); break;
      case "clean": clean(); break;
      case "tree": case "graph": case "json": case "xml": case "csv": case "yaml":
        setActiveTab(action);
        break;
      case "upload": fileInput.current?.click(); break;
      case "download":
        try { download(formatJson(input, indent), "json"); }
        catch { setCommittedInput(input); setNotice("JSON is invalid — fix the syntax before downloading"); }
        break;
      case "print": window.print(); break;
    }
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      format();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = `${input.slice(0, start)}  ${input.slice(end)}`;
    updateInput(next);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 2;
    });
  };

  const result = parsed.error ? null : parsed.value;
  const valid = !parsed.error;
  const outputTitle = activeTab === "tree" || activeTab === "graph" ? "JSON structure" : `${activeTab.toUpperCase()} output`;
  const printContent = activeTab === "tree" || activeTab === "graph" ? formatted : conversion;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Celi Tools home"><span className="brand-mark"><span>C</span></span><span>Celi Tools</span></a>
        <div className="topbar-center"><button className="mobile-menu-toggle" type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><span className="mobile-menu-icon" aria-hidden="true">☰</span><span>JSON Tools</span><Icon name="chevron" /></button></div>
        <div className="topbar-actions"><span className="local-chip"><span className="local-dot" />Runs locally</span><button className="icon-button" title="Load sample JSON" onClick={loadSample}><Icon name="spark" /></button></div>
      </header>

      <div className="app-body">
        {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close JSON tools navigation" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="Tool navigation">
          <div className="sidebar-scroll">
            <button className="sidebar-heading" type="button" aria-expanded={toolsExpanded} onClick={() => setToolsExpanded((expanded) => !expanded)}><span className="sidebar-heading-mark">{}</span><span>JSON Tools</span><Icon name="chevron" /></button>
            {toolsExpanded && <nav className="sidebar-nav" aria-label="JSON tool menu">
              <button className="sidebar-link sidebar-current" type="button" aria-current="page" onClick={() => { setSidebarOpen(false); editorRef.current?.focus(); }}><span className="sidebar-current-dot" />JSON Formatter</button>
              {TOOL_MENU_GROUPS.map((group) => <section className="sidebar-group" key={group.title} aria-label={group.title}>
                <h2>{group.title}</h2>
                {group.items.map((item) => item.id === "indent" ? <label className="sidebar-setting" key={item.id}><span>{item.label}</span><select aria-label="JSON indentation" value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value={2}>2 spaces</option><option value={3}>3 spaces</option><option value={4}>4 spaces</option></select></label>
                  : item.id === "auto-update" ? <label className="sidebar-setting" key={item.id}><span>{item.label}</span><span className={`toggle sidebar-toggle ${autoUpdate ? "toggle-on" : ""}`}><input aria-label="Auto update preview" type="checkbox" checked={autoUpdate} onChange={(event) => { setAutoUpdate(event.target.checked); if (event.target.checked) setCommittedInput(input); }} /><span /></span></label>
                    : <button className="sidebar-link" type="button" key={item.id} onClick={() => runToolAction(item.id)}><span className="sidebar-link-icon">{item.id === "format" ? "{}" : item.id === "validate" ? "✓" : item.id === "fix" ? "✳" : item.id === "clean" ? "⌁" : item.id === "tree" ? "≡" : item.id === "graph" ? "◇" : item.id === "json" ? "{}" : item.id === "xml" ? "<>" : item.id === "csv" ? "▦" : item.id === "yaml" ? "Y" : item.id === "upload" ? "↑" : item.id === "download" ? "↓" : "⎙"}</span><span>{item.label}</span></button>)}
              </section>)}
            </nav>}
          </div>
          <div className="sidebar-footer"><span className="sidebar-footer-dot" />Works offline · data stays local</div>
        </aside>
        <main className="app-content">
      <section className="intro">
        <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-dot" />JSON WORKSPACE</div><h1>Format, validate, understand.</h1><p>Make messy JSON readable. Inspect data, fix syntax, and convert it into the format you need.</p></div>
        <div className="intro-meta"><span className={`validation-pill ${valid && committedInput.trim() ? "is-valid" : committedInput.trim() ? "is-invalid" : "is-empty"}`}><Icon name={valid ? "check" : "error"} />{!committedInput.trim() ? "Waiting for JSON" : valid ? "Valid JSON" : "Invalid JSON"}</span><span className="privacy-note">Your data stays in this browser</span></div>
      </section>

      <section className="workbench" aria-label="JSON formatter workspace">
        <div className="editor-panel panel">
          <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">01</span><div><h2>Input</h2><p>Paste JSON or open a file</p></div></div><div className="panel-heading-actions"><button className="subtle-button" onClick={loadSample}>Example <Icon name="chevron" /></button><button className="icon-button small" title="Clear editor" onClick={clear}><Icon name="clear" /></button></div></div>
          <div className="editor-toolbar"><div className="toolbar-group"><button className="toolbar-button" onClick={() => fileInput.current?.click()}><Icon name="upload" />Upload</button><input ref={fileInput} type="file" accept=".json,.txt,application/json,text/plain" onChange={handleFile} hidden /><button className="toolbar-button" onClick={fix} title="Try to repair common JSON mistakes"><Icon name="fix" />Fix JSON</button></div><label className="select-label">INDENT<select value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value={2}>2 spaces</option><option value={3}>3 spaces</option><option value={4}>4 spaces</option></select><Icon name="chevron" /></label></div>
          <div className="editor-frame"><div className="line-numbers" aria-hidden="true">{Array.from({ length: inputLines }, (_, index) => <span className={parsed.error?.line === index + 1 ? "line-error" : ""} key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} aria-label="JSON input editor" spellCheck={false} autoCapitalize="off" autoCorrect="off" className="json-editor" value={input} onChange={(event) => updateInput(event.target.value)} onKeyDown={onEditorKeyDown} placeholder={'Paste your JSON here…\n\nTry an example or open a .json file.'} /></div>
          <div className="editor-footer"><span className={`editor-status ${valid && committedInput.trim() ? "status-good" : committedInput.trim() ? "status-bad" : ""}`}><span className="status-indicator" />{!committedInput.trim() ? "No input" : valid ? "JSON is valid" : `Syntax error · Ln ${parsed.error?.line}, Col ${parsed.error?.column}`}</span><span>{input.length.toLocaleString()} chars</span></div>
          <div className="editor-actions"><button className="primary-button" onClick={format}><Icon name="format" />Format JSON<span className="button-shortcut">Ctrl ↵</span></button><button className="secondary-button" onClick={validate}><Icon name="check" />Validate</button><button className="secondary-button" onClick={clean}><Icon name="spark" />Clean</button><button className="secondary-button clear-button" onClick={clear}>Clear</button></div>
          <label className="auto-row"><span className={`toggle ${autoUpdate ? "toggle-on" : ""}`}><input type="checkbox" checked={autoUpdate} onChange={(event) => { setAutoUpdate(event.target.checked); if (event.target.checked) setCommittedInput(input); }} /><span /></span><span><strong>Auto update</strong><small>Refresh the preview as you type</small></span></label>
        </div>

        <div className="output-panel panel">
          <div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">02</span><div><h2>Explore</h2><p>{outputTitle} · {valid && committedInput.trim() ? "Ready to inspect" : "Waiting for valid JSON"}</p></div></div><div className="panel-heading-actions"><button className="icon-button small" title="Print JSON" onClick={() => window.print()}><Icon name="print" /></button><button className="icon-button small" title="Download current output" onClick={() => conversion && download(conversion, fileExtension)} disabled={!conversion}><Icon name="download" /></button></div></div>
          <div className="output-tabs" role="tablist" aria-label="JSON output format">{tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={`output-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
          <div className="output-toolbar"><div className="output-filename"><span className="file-type-icon">{fileExtension === "json" ? "{}" : fileExtension === "xml" ? "<>" : fileExtension === "csv" ? "▦" : "Y"}</span><span>{fileName.replace(/\.[^.]+$/, "")}.{fileExtension}</span><span className="output-badge">{activeTab === "tree" || activeTab === "graph" ? "VIEW" : fileExtension.toUpperCase()}</span></div><div className="toolbar-group"><button className="toolbar-button compact" onClick={copy} disabled={!conversion}><Icon name="copy" />{copied ? "Copied" : "Copy"}</button><button className="toolbar-button compact" onClick={() => conversion && download(conversion, fileExtension)} disabled={!conversion}><Icon name="download" />Save</button></div></div>
          <div className={`output-content ${activeTab === "graph" ? "graph-content" : ""}`}>
            {parsed.error && committedInput.trim() ? <div className="empty-state error-state"><span className="empty-icon"><Icon name="error" /></span><h3>Couldn’t parse this JSON</h3><p>{parsed.error.message}</p><div className="error-location">Line {parsed.error.line}, column {parsed.error.column}</div><button className="fix-suggestion" onClick={fix}><Icon name="fix" />Try fixing it</button></div>
              : !committedInput.trim() ? <div className="empty-state"><span className="empty-icon"><Icon name="code" /></span><h3>Your preview appears here</h3><p>Paste JSON in the editor, validate it, or load the example.</p><button className="fix-suggestion" onClick={loadSample}><Icon name="spark" />Load example JSON</button></div>
              : activeTab === "tree" && result !== null ? <TreeView value={result} />
              : activeTab === "graph" && result !== null ? <GraphView value={result} />
              : <pre className={`code-output output-${activeTab}`}><code>{conversion}</code></pre>}
          </div>
          <div className="output-footer"><span><span className={`status-indicator ${valid && committedInput.trim() ? "good" : ""}`} />{valid && committedInput.trim() ? "Preview is up to date" : "Waiting for valid input"}</span><div className="output-footer-actions"><button onClick={() => download(formatted, "json")} disabled={!valid || !committedInput.trim()}><Icon name="download" />JSON</button><button onClick={() => window.print()}><Icon name="print" />Print</button></div></div>
        </div>
      </section>

      <div className="notice-line" role="status" aria-live="polite">{notice && <><span className="notice-check">✓</span>{notice}</>}</div>
      <section className="feature-strip"><div><span className="feature-number">01</span><span><strong>Validate & fix</strong><small>Catch syntax errors and repair common mistakes.</small></span></div><div><span className="feature-number">02</span><span><strong>Explore the structure</strong><small>Expand nested objects and arrays with ease.</small></span></div><div><span className="feature-number">03</span><span><strong>Convert & export</strong><small>Switch between JSON, XML, CSV and YAML.</small></span></div></section>
      <footer className="page-footer"><span>CELI TOOLS <span>·</span> JSON FORMATTER</span><span>Free to use. Your data never leaves your device.</span></footer>
      <div className="print-only"><pre>{printContent}</pre></div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowUpRight, Braces, CircleAlert, Plus, Send, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { executeApiRequest, parseCurl, parseRequestJson, replaceQuery, validateRequest, type ImportedRequest, type RequestRow } from "../lib/api-client.mjs";

type Tab = "params" | "headers" | "body";
type ResponseResult = { status: number; statusText: string; milliseconds: number; bytes: number; text: string; truncated: boolean };
const emptyRow = (): RequestRow => ({ key: "", value: "" });
const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const maxImportBytes = 1024 * 1024;

function KeyValueEditor({ label, rows, onChange }: { label: string; rows: RequestRow[]; onChange: (rows: RequestRow[]) => void }) {
  const update = (index: number, patch: Partial<RequestRow>) => onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <div className="api-table">
    <div className="api-table-head" aria-hidden="true"><span>KEY</span><span>VALUE</span><span /></div>
    {rows.map((row, index) => <div className="api-table-row" key={index}>
      <input aria-label={`${label} key ${index + 1}`} placeholder="Key" value={row.key} onChange={event => update(index, { key: event.target.value })} />
      <input aria-label={`${label} value ${index + 1}`} placeholder="Value" value={row.value} onChange={event => update(index, { value: event.target.value })} />
      <button type="button" className="icon-button api-remove" aria-label={`Hapus ${label} ${index + 1}`} onClick={() => onChange(rows.length === 1 ? [emptyRow()] : rows.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
    </div>)}
    <button type="button" className="api-add-row" onClick={() => onChange([...rows, emptyRow()])}><Plus size={15} /> Tambah {label}</button>
  </div>;
}

export default function ApiClient() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<RequestRow[]>([emptyRow()]);
  const [params, setParams] = useState<RequestRow[]>([emptyRow()]);
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("params");
  const [response, setResponse] = useState<ResponseResult | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [imports, setImports] = useState<ImportedRequest[]>([]);
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

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
    setMethod(request.method); updateUrl(request.url);
    setHeaders(request.headers.length ? request.headers : [emptyRow()]);
    setBody(request.body); setResponse(null); setError("");
    setImportOpen(false); setImports([]); setImportText(""); setImportError("");
  }

  function importRequest() {
    try {
      const text = importText.trim();
      if (!text) throw new Error("Tempel cURL atau JSON terlebih dahulu.");
      if (new TextEncoder().encode(text).byteLength > maxImportBytes) throw new Error("Impor dibatasi hingga 1 MB.");
      const requests = /^curl(?:\s|$)/.test(text) ? [parseCurl(text)] : parseRequestJson(text);
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

  async function send(event: FormEvent) {
    event.preventDefault();
    setError(""); setResponse(null);
    let request: ReturnType<typeof validateRequest>;
    try {
      const composedUrl = params.some(row => row.key.trim()) ? replaceQuery(url, params) : url;
      request = validateRequest({ method, url: composedUrl, headers, body });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request tidak valid."); return; }
    const abortController = new AbortController();
    controller.current = abortController;
    const timer = setTimeout(() => abortController.abort("timeout"), 60_000);
    setSending(true);
    try {
      setResponse(await executeApiRequest(request, abortController.signal));
    } catch {
      setError(abortController.signal.aborted
        ? abortController.signal.reason === "timeout" ? "Request melewati batas 60 detik." : "Request dibatalkan."
        : "API tidak dapat dijangkau. Periksa URL, koneksi, HTTPS, dan izin CORS pada server tujuan.");
    } finally { clearTimeout(timer); controller.current = null; setSending(false); }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "params", label: "Query Params", count: params.filter(row => row.key.trim()).length },
    { id: "headers", label: "Headers", count: headers.filter(row => row.key.trim()).length },
    { id: "body", label: "Body" },
  ];
  return <main className="tool-page api-client-page">
    <div className="page-heading api-client-heading"><div><span className="eyebrow">API CLIENT</span><h1>Request lebih mudah, respons lebih jelas.</h1><p>Kirim request dan periksa respons API dalam satu ruang kerja.</p></div><button type="button" className="secondary-button" onClick={() => setImportOpen(!importOpen)} aria-expanded={importOpen} aria-controls="api-import"><Upload size={16} /> Impor cURL / JSON</button></div>
    {importOpen && <section className="panel api-import" id="api-import" aria-labelledby="api-import-title"><div className="api-section-heading"><div><h2 id="api-import-title">Impor request</h2><p>Tempel cURL, request JSON, atau koleksi Postman. Hapus autentikasi Postman dari JSON dan isi header secara manual; ganti juga variabel environment.</p></div><button type="button" className="icon-button" aria-label="Tutup impor" onClick={() => setImportOpen(false)}><X size={17} /></button></div>
      <textarea aria-label="cURL atau JSON untuk diimpor" className="api-import-input" value={importText} onChange={event => { setImportText(event.target.value); setImports([]); setImportError(""); }} placeholder={'curl https://api.example.com/users\n\natau {"method":"GET","url":"https://api.example.com/users"}'} spellCheck={false} />
      <div className="api-import-actions"><button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Pilih file</button><input ref={fileInput} hidden type="file" accept=".json,.txt,application/json,text/plain" onChange={importFile} /><button type="button" className="primary-button" onClick={importRequest}>Baca request</button><span>Maks. 1 MB</span></div>
      {importError && <p className="api-inline-error" role="alert">{importError}</p>}
      {imports.length > 0 && <div className="api-import-list"><p>Pilih request dari koleksi:</p>{imports.map((item, index) => <button type="button" key={`${item.name}-${index}`} onClick={() => applyImport(item)}><strong>{item.method}</strong><span>{item.name}</span><ArrowUpRight size={15} /></button>)}</div>}
    </section>}
    <section className="panel api-request" aria-labelledby="api-request-title"><div className="api-section-heading"><div><span className="api-kicker">01 / REQUEST</span><h2 id="api-request-title">Siapkan request</h2></div><span className="api-private"><ShieldCheck size={15} /> Tidak disimpan</span></div>
      <form className="api-send-bar" onSubmit={send}><label className="sr-only" htmlFor="api-method">Metode HTTP</label><select id="api-method" value={method} onChange={event => setMethod(event.target.value)}>{methods.map(item => <option key={item}>{item}</option>)}</select><label className="sr-only" htmlFor="api-url">URL API</label><input id="api-url" type="url" value={url} onChange={event => updateUrl(event.target.value)} placeholder="https://api.example.com/v1/resource" autoComplete="off" spellCheck={false} required />{sending ? <button type="button" className="secondary-button" onClick={() => controller.current?.abort()}>Batalkan</button> : <button className="primary-button" type="submit"><Send size={16} /> Send</button>}</form>
      <div className="api-tabs" role="tablist" aria-label="Pengaturan request" onKeyDown={event => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return; event.preventDefault(); const index = tabs.findIndex(tab => tab.id === activeTab); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; setActiveTab(tabs[next].id); document.getElementById(`api-tab-${tabs[next].id}`)?.focus(); }}>{tabs.map(tab => <button type="button" role="tab" id={`api-tab-${tab.id}`} key={tab.id} aria-controls="api-request-panel" aria-selected={tab.id === activeTab} tabIndex={tab.id === activeTab ? 0 : -1} className={tab.id === activeTab ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}{!!tab.count && <span>{tab.count}</span>}</button>)}</div>
      <div id="api-request-panel" role="tabpanel" aria-labelledby={`api-tab-${activeTab}`} className="api-request-content">{activeTab === "params" ? <KeyValueEditor label="parameter" rows={params} onChange={updateParams} /> : activeTab === "headers" ? <KeyValueEditor label="header" rows={headers} onChange={setHeaders} /> : <div className="api-body-editor"><div><strong>JSON body</strong><span>Untuk POST, PUT, PATCH, dan DELETE</span></div><textarea aria-label="Request body JSON" placeholder={'{\n  "name": "Celi"\n}'} value={body} onChange={event => setBody(event.target.value)} spellCheck={false} /><p>Jika Content-Type kosong, application/json ditambahkan saat body dikirim.</p></div>}</div>
    </section>
    <section className="panel api-response" aria-labelledby="api-response-title"><div className="api-section-heading"><div><span className="api-kicker">02 / RESPONSE</span><h2 id="api-response-title">Respons</h2></div>{response && <div className="api-response-meta"><span className={`api-status ${response.status >= 200 && response.status < 300 ? "is-success" : "is-error"}`}>{response.status} {response.statusText}</span><span>{response.milliseconds.toLocaleString("id-ID")} ms</span><span>{response.truncated ? "≥ " : ""}{response.bytes.toLocaleString("id-ID")} byte</span></div>}</div>
      {error ? <div className="api-empty api-error" role="alert"><CircleAlert size={26} /><strong>Request belum berhasil</strong><p>{error}</p></div> : response ? <div className="api-response-body"><div className="api-response-caption">BODY {response.truncated && <span>· Respons dipotong pada 2 MiB</span>}</div><pre><code>{response.text || "(Respons kosong)"}</code></pre></div> : <div className="api-empty"><Braces size={28} /><strong>{sending ? "Menunggu respons…" : "Respons akan tampil di sini"}</strong><p>{sending ? "Request sedang diproses oleh API tujuan." : "Masukkan URL dan tekan Send untuk memulai."}</p></div>}
    </section>
    <div className="workspace-help"><ShieldCheck size={18} /><p><strong>Request dikirim langsung dari browser.</strong> Server tujuan harus mengizinkan CORS; cookie sesi tidak disertakan. Header dan body hanya tersimpan selama halaman terbuka.</p></div>
  </main>;
}

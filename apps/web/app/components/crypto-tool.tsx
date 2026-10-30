"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Check, Copy, Download, Hash, LockKeyhole, CodeXml, Play, Trash2, CircleAlert } from "lucide-react";
import { base64Encode, base64Decode, hashText, aesEncrypt, aesDecrypt, rot13, caesarCipher, urlEncode, urlDecode, toBinary, fromBinary, toHex, fromHex } from "../lib/crypto-tools.mjs";
const TOOLS = [
    { id: "base64-encode", label: "Base64 Encode", group: "Encoding" }, { id: "base64-decode", label: "Base64 Decode", group: "Encoding" },
    { id: "md5", label: "MD5 Hash", group: "Hash" }, { id: "sha1", label: "SHA-1 Hash", group: "Hash" }, { id: "sha256", label: "SHA-256 Hash", group: "Hash" }, { id: "sha512", label: "SHA-512 Hash", group: "Hash" },
    { id: "aes-encrypt", label: "AES Encrypt", group: "Enkripsi" }, { id: "aes-decrypt", label: "AES Decrypt", group: "Enkripsi" },
    { id: "rot13", label: "ROT13", group: "Cipher klasik" }, { id: "caesar", label: "Caesar Cipher", group: "Cipher klasik" },
    { id: "url-encode", label: "URL Encode", group: "Encoding" }, { id: "url-decode", label: "URL Decode", group: "Encoding" },
    { id: "binary", label: "Teks ke Biner", group: "Encoding" }, { id: "binary-decode", label: "Biner ke Teks", group: "Encoding" },
    { id: "hex", label: "Teks ke Hex", group: "Encoding" }, { id: "hex-decode", label: "Hex ke Teks", group: "Encoding" },
] as const;
type ToolMode = typeof TOOLS[number]["id"];
const PAIRS: Partial<Record<ToolMode, ToolMode>> = { "base64-encode": "base64-decode", "base64-decode": "base64-encode", "aes-encrypt": "aes-decrypt", "aes-decrypt": "aes-encrypt", "url-encode": "url-decode", "url-decode": "url-encode", binary: "binary-decode", "binary-decode": "binary", hex: "hex-decode", "hex-decode": "hex", rot13: "rot13" };
export default function CryptoTool() {
    const [mode, setMode] = useState<ToolMode>("base64-encode");
    const [input, setInput] = useState("");
    const [password, setPassword] = useState("");
    const [shift, setShift] = useState(13);
    const [output, setOutput] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [run, setRun] = useState(0);
    const requestId = useRef(0);
    const needsPassword = mode.startsWith("aes-");
    const isHash = ["md5", "sha1", "sha256", "sha512"].includes(mode);
    useEffect(() => { const timer = setTimeout(() => { const selected = new URLSearchParams(window.location.search).get("tool"); if (TOOLS.some(t => t.id === selected))
        setMode(selected as ToolMode); }, 0); return () => clearTimeout(timer); }, []);
    useEffect(() => {
        const id = ++requestId.current;
        const timer = setTimeout(async () => {
            setOutput("");
            setError("");
            setCopied(false);
            if (!input) {
                setLoading(false);
                return;
            }
            if (needsPassword && !password) {
                setError("Isi kata sandi untuk menjalankan AES.");
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                let result = "";
                switch (mode) {
                    case "base64-encode":
                        result = base64Encode(input);
                        break;
                    case "base64-decode":
                        result = base64Decode(input);
                        break;
                    case "md5":
                        result = await hashText("MD5", input);
                        break;
                    case "sha1":
                        result = await hashText("SHA-1", input);
                        break;
                    case "sha256":
                        result = await hashText("SHA-256", input);
                        break;
                    case "sha512":
                        result = await hashText("SHA-512", input);
                        break;
                    case "aes-encrypt":
                        result = await aesEncrypt(input, password);
                        break;
                    case "aes-decrypt":
                        result = await aesDecrypt(input, password);
                        break;
                    case "rot13":
                        result = rot13(input);
                        break;
                    case "caesar":
                        result = caesarCipher(input, shift);
                        break;
                    case "url-encode":
                        result = urlEncode(input);
                        break;
                    case "url-decode":
                        result = urlDecode(input);
                        break;
                    case "binary":
                        result = toBinary(input);
                        break;
                    case "binary-decode":
                        result = fromBinary(input);
                        break;
                    case "hex":
                        result = toHex(input);
                        break;
                    case "hex-decode":
                        result = fromHex(input);
                        break;
                }
                if (id === requestId.current)
                    setOutput(result);
            }
            catch (caught) {
                if (id === requestId.current)
                    setError(caught instanceof Error ? caught.message : "Gagal memproses teks.");
            }
            finally {
                if (id === requestId.current)
                    setLoading(false);
            }
        }, 250);
        return () => { clearTimeout(timer); };
    }, [input, mode, password, shift, needsPassword, run]);
    const invalidate = () => { requestId.current++; setOutput(""); setCopied(false); setError(""); setLoading(false); };
    const selected = TOOLS.find(t => t.id === mode)!;
    return <main className="tool-page">
  <div className="page-heading"><span className="eyebrow">CRYPTO TOOLS</span><h1>Encoding, hash, dan enkripsi.</h1><p>Ubah teks dan lindungi data dengan tools yang berjalan langsung di browser.</p></div>
  <div className="crypto-layout">
   <aside className="tool-rail" aria-label="Pilihan tools Crypto">{["Encoding", "Hash", "Enkripsi", "Cipher klasik"].map(group => <section key={group}><h2>{group}</h2>{TOOLS.filter(t => t.group === group).map(tool => <button key={tool.id} className={mode === tool.id ? "selected" : ""} aria-pressed={mode === tool.id} onClick={() => { invalidate(); setMode(tool.id); }}>{tool.group === "Hash" ? <Hash size={16}/> : tool.group === "Enkripsi" ? <LockKeyhole size={16}/> : <CodeXml size={16}/>} {tool.label}</button>)}</section>)}</aside>
   <div className="crypto-workspace">
    <div className="crypto-toolbar"><label>Pilih alat<select value={mode} onChange={e => { invalidate(); setMode(e.target.value as ToolMode); }}>{TOOLS.map(tool => <option value={tool.id} key={tool.id}>{tool.label}</option>)}</select></label>{needsPassword && <label>Kata sandi<input type="password" value={password} onChange={e => { invalidate(); setPassword(e.target.value); }} autoComplete="off" placeholder="Masukkan kata sandi AES"/></label>}{mode === "caesar" && <label>Geser (1–25)<input type="number" min={1} max={25} value={shift} onChange={e => { invalidate(); setShift(Math.min(25, Math.max(1, Number(e.target.value) || 1))); }}/></label>}</div>
    <div className="crypto-panels">
     <section className="panel"><div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">01</span><div><h2>Input</h2><p>Teks untuk {selected.label}</p></div></div><button className="icon-button" aria-label="Kosongkan input Crypto" onClick={() => { invalidate(); setInput(""); }}><Trash2 size={17}/></button></div><textarea aria-label="Input Crypto" className="crypto-textarea" value={input} onChange={e => { invalidate(); setInput(e.target.value); }} placeholder="Masukkan teks yang ingin diproses…" spellCheck={false}/><div className="editor-footer"><span>{input.length} karakter</span><button className="toolbar-button" onClick={async () => { try {
        const text = await navigator.clipboard.readText();
        invalidate();
        setInput(text);
    }
    catch {
        setError("Clipboard tidak tersedia. Tempel teks dengan Ctrl+V.");
    } }}>Tempel dari clipboard</button></div></section>
     <section className="panel"><div className="panel-heading"><div className="panel-title-wrap"><span className="panel-index">02</span><div><h2>Hasil</h2><p>{selected.label}</p></div></div>{PAIRS[mode] && <button className="icon-button" aria-label="Gunakan hasil untuk operasi sebaliknya" title="Gunakan hasil untuk operasi sebaliknya" disabled={!output || loading} onClick={() => { const text = output; invalidate(); setInput(text); setMode(PAIRS[mode]!); }}><ArrowRightLeft size={17}/></button>}</div><textarea aria-label="Hasil Crypto" className="crypto-textarea" value={output} readOnly placeholder={loading ? "Memproses…" : "Hasil pemrosesan muncul di sini."} spellCheck={false}/><div className="editor-footer"><span>{output.length} karakter</span><div className="toolbar-group"><button className="toolbar-button" disabled={!output || loading} onClick={async () => { try {
        await navigator.clipboard.writeText(output);
        setCopied(true);
    }
    catch {
        setError("Hasil tidak dapat disalin. Pilih teks dan gunakan Ctrl+C.");
    } }}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Tersalin" : "Salin"}</button><button className="toolbar-button" disabled={!output || loading} onClick={() => { const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `celi-${mode}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }}><Download size={15}/>Simpan</button></div></div></section>
    </div>
    <div className="crypto-actions"><button className="primary-button" disabled={!input || loading || (needsPassword && !password)} onClick={() => setRun(n => n + 1)}><Play size={16}/>{loading ? "Memproses…" : "Proses teks"}</button><span role="status">{loading ? "Memproses data Anda…" : "Hasil diperbarui otomatis saat input berubah."}</span></div>
    {error && <div className="alert alert-error" role="alert"><CircleAlert size={18}/>{error}</div>}
    <div className="workspace-help"><LockKeyhole size={19}/><p>{isHash ? "Hash bersifat satu arah dan tidak dapat didekripsi." : needsPassword ? "AES-256-GCM menggunakan kata sandi Anda. Simpan hasil dan kata sandi secara terpisah; kata sandi tidak disimpan oleh portal." : mode === "rot13" || mode === "caesar" ? "Cipher klasik ditujukan untuk pembelajaran, bukan perlindungan data sensitif." : "Encoding mengubah representasi teks dan dapat dibalik. Encoding tidak melindungi data dengan kata sandi."}{["md5", "sha1"].includes(mode) && " MD5 dan SHA-1 hanya untuk kompatibilitas; gunakan SHA-256 untuk kebutuhan hash baru."}</p></div>
   </div>
  </div>
 </main>;
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
export const metadata: Metadata = { title: "celimanapp — Dashboard Themes Showcase" };
type Theme = { id: string; label: string; badge: string; bg: string; sidebarBg: string; cardBg: string; text: string; muted: string; border: string; accent: string; accentSoft: string; chart1: string; chart2: string; inputBg: string; shadow: string; };
const THEMES: Theme[] = [
{ id: "light", label: "Default Light Theme", badge: "Top Left • Light • #2563EB", bg: "#ffffff", sidebarBg: "#f1f5f9", cardBg: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#e2e8f0", accent: "#2563eb", accentSoft: "#eff6ff", chart1: "#2563eb", chart2: "#0ea5e9", inputBg: "#f8fafc", shadow: "0 10px 25px rgba(15,23,42,0.08)" },
{ id: "dark", label: "Dark Mode Theme", badge: "Top Right • Dark • #111827", bg: "#111827", sidebarBg: "#1F2937", cardBg: "#1F2937", text: "#f9fafb", muted: "#9ca3af", border: "#374151", accent: "#38bdf8", accentSoft: "rgba(56,189,248,0.12)", chart1: "#38bdf8", chart2: "#818cf8", inputBg: "#111827", shadow: "0 10px 30px rgba(0,0,0,0.5)" },
{ id: "forest", label: "Forest Green Theme", badge: "Bottom Left • Forest • #059669", bg: "#F3F4F6", sidebarBg: "#e6f4ec", cardBg: "#ffffff", text: "#064e3b", muted: "#6b8f7f", border: "#d1e7d9", accent: "#059669", accentSoft: "#ecfdf5", chart1: "#059669", chart2: "#84cc16", inputBg: "#f0fdf4", shadow: "0 10px 25px rgba(6,78,59,0.08)" },
{ id: "sunset", label: "Sunset Orange Theme", badge: "Bottom Right • Sunset • #ea580c", bg: "#fff7ed", sidebarBg: "#ffedd5", cardBg: "#ffffff", text: "#431407", muted: "#b45309", border: "#fed7aa", accent: "#ea580c", accentSoft: "#fff7ed", chart1: "#ea580c", chart2: "#f59e0b", inputBg: "#fffbeb", shadow: "0 10px 25px rgba(234,88,12,0.12)" },
];
function BrandMark() {
return <Image src="/brand.svg" width={26} height={26} alt="" />;
}
function Spark({ color, id, d }: { color: string; id: string; d: string }) {
return (<svg viewBox="0 0 200 56" width="100%" height="50" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${d} L200,56 L0,56 Z`} fill={`url(#${id})`} /><path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="168" cy="16" r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" /></svg>);
}
function Mock({ t }: { t: Theme }) {
const dark = t.id === "dark";
return (
<div style={{ background: t.bg, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.border}`, boxShadow: t.shadow, fontFamily: "var(--font-sans)" }}>
<div style={{ display: "flex", gap: 6, padding: "10px 14px", borderBottom: `1px solid ${t.border}`, background: dark ? "#0b1220" : "#f8fafc", alignItems: "center" }}>
<span style={{ width: 10, height: 10, borderRadius: 99, background: "#f87171" }} /><span style={{ width: 10, height: 10, borderRadius: 99, background: "#fbbf24" }} /><span style={{ width: 10, height: 10, borderRadius: 99, background: "#34d399" }} />
<span style={{ marginLeft: 10, fontSize: 11, color: t.muted, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: "2px 10px", flex: 1 }}>/dashboard</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
<span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 14, color: t.text }}><BrandMark />celimanapp</span>
<span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{["Dashboard","JSON Tools","Crypto Tools","File Converter","Settings"].map((l,i)=>(<span key={l} style={{ fontSize: 11, fontWeight: i===0?700:500, color: i===0?t.accent:t.muted, background: i===0?t.accentSoft:"transparent", border: `1px solid ${i===0?t.accent:"transparent"}`, padding: "5px 9px", borderRadius: 8 }}>{l}</span>))}</span>
<span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ fontSize: 11, color: t.muted, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px" }}>Search…</span>
<span style={{ width: 26, height: 26, borderRadius: 99, background: t.accent, color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>SC</span>
<span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Sarah C.</span>
</span>
</div>
<div style={{ display: "flex", minHeight: 380 }}>
<aside style={{ width: 148, background: t.sidebarBg, borderRight: `1px solid ${t.border}`, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
{[["Dashboard",1],["JSON Tools",0],["Crypto Tools",0],["File Converter",0],["Settings",0]].map(([lb,ac])=>(<div key={String(lb)} style={{ fontSize: 11.5, fontWeight: ac?700:500, color: ac?t.accent:t.muted, background: ac?t.cardBg:"transparent", border: `1px solid ${ac?t.border:"transparent"}`, borderRadius: 9, padding: "8px 9px" }}>{lb}</div>))}
<div style={{ marginTop: "auto", background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: 9 }}><div style={{ fontSize: 11, fontWeight: 800, color: t.text }}>Pro usage</div><div style={{ height: 6, background: t.accentSoft, borderRadius: 99, marginTop: 7, overflow: "hidden" }}><div style={{ width: "72%", height: "100%", background: t.accent }} /></div><div style={{ fontSize: 10, color: t.muted, marginTop: 5 }}>7.2k / 10k ops</div></div>
</aside>
<main style={{ flex: 1, padding: 14, minWidth: 0 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>Welcome back, Sarah!</div><div style={{ fontSize: 11.5, color: t.muted }}>Today across JSON, Crypto and Files.</div></div><span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: t.accent, borderRadius: 99, padding: "6px 12px" }}>+ New Task</span></div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}><div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 11 }}><div style={{ fontSize: 11.5, fontWeight: 800, color: t.text }}>JSON Formatter</div><div style={{ fontSize: 9.5, color: t.muted }}>Feather Icons</div></div>
<div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}><b style={{ fontSize: 12, color: t.text }}>JSON Validator</b><span style={{ float: "right", fontSize: 9, fontWeight: 800, color: t.accent, background: t.accentSoft, padding: "3px 8px", borderRadius: 99 }}>VALID</span><pre style={{ margin: "9px 0 0", background: dark?"#0b1220":t.accentSoft, border: `1px solid ${t.border}`, borderRadius: 8, padding: 9, fontSize: 10, color: t.text, fontFamily: "var(--font-mono)" }}>{`{\n "user": "sarah",\n "ops": 7218\n}`}</pre></div>
<div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}><b style={{ fontSize: 12, color: t.text }}>BTC / USD $67,842</b><div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>+2.4% today</div><div style={{ marginTop: 6, border: `1px solid ${t.border}`, borderRadius: 8, padding: 5, background: dark?"#0b1220":t.accentSoft }}><Spark id={`${t.id}b`} color={t.chart1} d="M0,44 C25,42 35,28 55,30 C75,32 85,18 105,20 C125,22 135,10 168,16 L200,12" /></div></div>
<div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}><b style={{ fontSize: 12, color: t.text }}>ETH / USD $3,521</b><div style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>+1.8% today</div><div style={{ marginTop: 6, border: `1px solid ${t.border}`, borderRadius: 8, padding: 5, background: dark?"#0b1220":t.accentSoft }}><Spark id={`${t.id}e`} color={t.chart2} d="M0,40 C30,38 45,22 70,26 C95,30 110,14 135,18 C155,21 165,12 168,16 L200,10" /></div></div>
<div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}><b style={{ fontSize: 12, color: t.text }}>File Converter</b><span style={{ float: "right", fontSize: 9, fontWeight: 800, color: t.accent, background: t.accentSoft, padding: "3px 8px", borderRadius: 99 }}>3 QUEUED</span><div style={{ marginTop: 9 }}>{[["report.json.csv","86%"],["logo.webp","64%"],["data.yaml","32%"]].map(([n,p])=>(<div key={String(n)} style={{ marginTop: 6 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.muted }}><span>{n}</span><span style={{ color: t.text }}>{p}</span></div><div style={{ height: 6, background: t.accentSoft, border: `1px solid ${t.border}`, borderRadius: 99, marginTop: 3 }}><div style={{ width: String(p), height: "100%", background: t.accent, borderRadius: 99 }} /></div></div>))}</div></div>
</div></main></div></div>);
}
export default function Page() {
return (<div style={{ background: "#e5e7eb", minHeight: "100vh", padding: 24, fontFamily: "var(--font-sans)" }}><div style={{ maxWidth: 1280, margin: "0 auto" }}>
<div style={{ background: "#0f172a", color: "#fff", borderRadius: 16, padding: 20, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}><span style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}><BrandMark />celimanapp</span><b>Dashboard Themes — Portfolio Display</b><span style={{ color: "#cbd5e1", fontSize: 13 }}>Light / Dark #111827 #1F2937 / Forest #F3F4F6 / Sunset — Manrope / IBM Plex Mono, vector, charts</span><Link href="/" style={{ marginLeft: "auto", background: "#38bdf8", color: "#0f172a", fontWeight: 800, fontSize: 13, padding: "9px 14px", borderRadius: 10, textDecoration: "none" }}>Open live app</Link></div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(480px,1fr))", gap: 20, marginTop: 20 }}>{THEMES.map((t)=>(<div key={t.id}><div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}><span style={{ fontSize: 12, fontWeight: 800, background: "#fff", border: "1px solid #cbd5e1", padding: "5px 11px", borderRadius: 99 }}>{t.label}</span><span style={{ fontSize: 12, color: "#475569" }}>{t.badge}</span></div><Mock t={t} /></div>))}</div>
<div style={{ marginTop: 14, fontSize: 12, color: "#475569", textAlign: "center" }}>Composite on neutral gray — sidebar + header + search + Sarah C. — JSON / BTC / ETH / Converter — blue / neon / emerald / orange</div>
</div></div>);
}





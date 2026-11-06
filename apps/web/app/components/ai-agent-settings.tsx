"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Plus, Save, ShieldCheck, Trash2, Waypoints } from "lucide-react";
import { useLanguage } from "./language-provider";

type Profile = { id:string; name:string; provider:string; modelId:string; baseUrl:string|null; isActive:boolean; hasApiKey:boolean };
type Form = { id?:string; name:string; provider:string; modelId:string; baseUrl:string; apiKey:string; isActive:boolean };
const empty:Form = { name:"", provider:"openai", modelId:"gpt-4.1-mini", baseUrl:"", apiKey:"", isActive:false };

export default function AiAgentSettings() {
  const { t } = useLanguage();
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [form,setForm] = useState<Form>(empty);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const fetchProfiles = useCallback(async () => {
    const response = await fetch("/api/ai-agent/config",{cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("Konfigurasi AI belum tersedia."));
    return data.profiles as Profile[];
  },[t]);
  const load = useCallback(async () => {
    setError("");
    try { setProfiles(await fetchProfiles()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Konfigurasi AI belum tersedia.")); }
    finally { setLoading(false); }
  },[fetchProfiles,t]);
  useEffect(()=>{ let active=true; fetchProfiles().then(data=>{if(active)setProfiles(data);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:t("Konfigurasi AI belum tersedia."));}).finally(()=>{if(active)setLoading(false);}); return()=>{active=false;}; },[fetchProfiles,t]);
  const save = async (event:React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,baseUrl:form.provider==="openai-compatible"?form.baseUrl:undefined,apiKey:form.apiKey||undefined})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||t("Perubahan tidak dapat disimpan.")); setForm({...empty}); setNotice(t("Konfigurasi tersimpan.")); await load(); }
    catch(cause){setError(cause instanceof Error?cause.message:t("Perubahan tidak dapat disimpan."));} finally{setBusy(false);}
  };
  const edit = (profile:Profile) => setForm({id:profile.id,name:profile.name,provider:profile.provider,modelId:profile.modelId,baseUrl:profile.baseUrl||"",apiKey:"",isActive:profile.isActive});
  const remove = async (id:string) => { if(!window.confirm(t("Hapus konfigurasi provider ini?"))) return; setBusy(true); setError(""); try{const response=await fetch("/api/ai-agent/config",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.error);setNotice(t("Konfigurasi dihapus."));if(form.id===id)setForm({...empty});await load();}catch(cause){setError(cause instanceof Error?cause.message:t("Profil tidak dapat dihapus."));}finally{setBusy(false);} };
  const test = async (id:string) => {setBusy(true);setError("");setNotice("");try{const response=await fetch("/api/ai-agent/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.error);setNotice(t("Koneksi provider berhasil."));}catch(cause){setError(cause instanceof Error?cause.message:t("Provider tidak merespons."));}finally{setBusy(false);}};
  return <section className="ai-settings-page">
    <header className="page-heading"><div><span className="eyebrow">{t("Pengaturan")}</span><h1><Waypoints size={25}/>{t("AI Agent")}</h1><p>{t("Atur penyedia AI untuk bantuan penggunaan celimanapp.")}</p></div></header>
    <div className="ai-privacy-note"><ShieldCheck size={19}/><span>{t("Kunci API dienkripsi di database dan tidak pernah ditampilkan kembali. Chat hanya menjawab tentang penggunaan celimanapp; tidak membaca catatan, file, atau request Anda.")}</span></div>
    {notice&&<div className="ai-flash success" role="status"><Check size={17}/>{notice}</div>}{error&&<div className="ai-flash error" role="alert">{error}</div>}
    <div className="ai-settings-grid">
      <form className="panel ai-profile-form" onSubmit={save}><h2>{form.id?t("Ubah provider"):t("Tambah provider")}</h2>
        <label>{t("Nama profil")}<input required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>{t("Provider")}<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value,modelId:e.target.value==="anthropic"?"claude-sonnet-4-5":e.target.value==="google"?"gemini-2.5-flash":"gpt-4.1-mini"})}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
        <label>{t("Model ID")}<input required maxLength={160} pattern="[a-zA-Z0-9._:/-]+" value={form.modelId} onChange={e=>setForm({...form,modelId:e.target.value})}/></label>
        {form.provider==="openai-compatible"&&<label>{t("Base URL (HTTPS publik)")}<input required type="url" placeholder="https://api.example.com/v1" value={form.baseUrl} onChange={e=>setForm({...form,baseUrl:e.target.value})}/></label>}
        <label>{t("API key")}<input type="password" autoComplete="new-password" value={form.apiKey} onChange={e=>setForm({...form,apiKey:e.target.value})} placeholder={form.id?t("Kosongkan untuk mempertahankan key tersimpan"):"sk-…"}/></label>
        <label className="ai-checkbox"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>{t("Aktifkan provider ini")}</label>
        <div className="ai-form-actions"><button className="primary-button" disabled={busy||loading}><Save size={16}/>{busy?t("Menyimpan…"):t("Simpan")}</button>{form.id&&<button type="button" className="secondary-button" onClick={()=>setForm({...empty})}>{t("Batal")}</button>}</div>
      </form>
      <section className="panel ai-profiles"><header><h2>{t("Provider tersimpan")}</h2><button className="secondary-button" onClick={()=>setForm({...empty})}><Plus size={16}/>{t("Baru")}</button></header>
        {loading?<p className="ai-empty"><LoaderCircle size={18} className="spin"/>{t("Memuat…")}</p>:profiles.length===0?<p className="ai-empty">{t("Belum ada provider. Tambahkan konfigurasi untuk mengaktifkan chat.")}</p>:profiles.map(profile=><article className="ai-profile-row" key={profile.id}><div className="ai-profile-details"><strong>{profile.name}</strong><span>{profile.provider} · {profile.modelId}</span><small>{profile.hasApiKey?t("API key tersimpan"):t("API key belum diatur")} · {profile.isActive?t("Aktif"):t("Tidak aktif")}</small></div><div className="ai-profile-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void test(profile.id)}>{t("Uji")}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>edit(profile)}>{t("Ubah")}</button><button type="button" className="icon-button" disabled={busy} aria-label={t("Hapus provider")} onClick={()=>void remove(profile.id)}><Trash2 size={16}/></button></div></article>)}
      </section>
    </div>
  </section>;
}

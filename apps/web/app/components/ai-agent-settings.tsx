"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, LoaderCircle, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Waypoints } from "lucide-react";
import { useLanguage } from "./language-provider";

type Provider="openai"|"anthropic"|"google"|"groq"|"xai"|"openrouter"|"opencode-zen"|"hermes"|"openai-compatible";
type Profile={id:string;name:string;provider:Provider;modelId:string;baseUrl:string|null;isActive:boolean;fallbackOrder:number;hasApiKey:boolean;createdAt:string};
type Form={id?:string;name:string;provider:Provider;modelId:string;baseUrl:string;apiKey:string;isActive:boolean};
type Model={id:string;name:string;isFree:boolean|null};
type ModelFilter="all"|"free"|"paid";
const providers:Array<{id:Provider;label:string;needsUrl?:boolean}>=[
  {id:"openai",label:"OpenAI"},
  {id:"anthropic",label:"Anthropic"},
  {id:"google",label:"Google Gemini"},
  {id:"groq",label:"Groq"},
  {id:"xai",label:"xAI Grok"},
  {id:"openrouter",label:"OpenRouter"},
  {id:"opencode-zen",label:"OpenCode Zen"},
  {id:"hermes",label:"Hermes API",needsUrl:true},
  {id:"openai-compatible",label:"OpenAI-compatible",needsUrl:true},
];
const empty:Form={name:"",provider:"openai",modelId:"",baseUrl:"",apiKey:"",isActive:false};

export default function AiAgentSettings() {
  const {t}=useLanguage();
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [form,setForm]=useState<Form>(empty);
  const [models,setModels]=useState<Model[]>([]);
  const [modelSearch,setModelSearch]=useState("");
  const [modelFilter,setModelFilter]=useState<ModelFilter>("all");
  const [modelListOpen,setModelListOpen]=useState(false);
  const modelPickerRef=useRef<HTMLDivElement>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [modelsBusy,setModelsBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const fetchProfiles=useCallback(async()=>{
    const response=await fetch("/api/ai-agent/config",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||t("Konfigurasi AI belum tersedia."));
    return data.profiles as Profile[];
  },[t]);
  const load=useCallback(async()=>{
    setError("");
    try{setProfiles(await fetchProfiles());}
    catch(cause){setError(cause instanceof Error?cause.message:t("Konfigurasi AI belum tersedia."));}
    finally{setLoading(false);}
  },[fetchProfiles,t]);
  useEffect(()=>{let active=true;fetchProfiles().then(data=>{if(active)setProfiles(data);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:t("Konfigurasi AI belum tersedia."));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[fetchProfiles,t]);
  useEffect(()=>{
    if(!modelListOpen)return;
    const onPointerDown=(event:PointerEvent)=>{if(!modelPickerRef.current?.contains(event.target as Node))setModelListOpen(false);};
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setModelListOpen(false);};
    document.addEventListener("pointerdown",onPointerDown);
    document.addEventListener("keydown",onKeyDown);
    return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
  },[modelListOpen]);

  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setError("");setNotice("");
    if(!form.modelId){setError(t("Pilih model sebelum menyimpan."));return;}
    setBusy(true);
    try{
      const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,baseUrl:providers.find(item=>item.id===form.provider)?.needsUrl?form.baseUrl:undefined,apiKey:form.apiKey||undefined})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||t("Perubahan tidak dapat disimpan."));
      setForm({...empty});setModels([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);setNotice(t("Konfigurasi tersimpan."));await load();
    }catch(cause){setError(cause instanceof Error?cause.message:t("Perubahan tidak dapat disimpan."));}
    finally{setBusy(false);}
  };
  const edit=(profile:Profile)=>{
    setForm({id:profile.id,name:profile.name,provider:profile.provider,modelId:profile.modelId,baseUrl:profile.baseUrl||"",apiKey:"",isActive:profile.isActive});
    setModels([{id:profile.modelId,name:profile.modelId,isFree:null}]);setModelSearch("");setModelFilter("all");setModelListOpen(false);setError("");setNotice("");
  };
  const fetchModels=async()=>{
    setModelsBusy(true);setError("");setNotice("");setModels([]);setModelSearch("");setModelListOpen(false);
    try{
      const saved=profiles.find(profile=>profile.id===form.id);
      const sameSavedEndpoint=saved&&saved.provider===form.provider&&(saved.baseUrl||"")===form.baseUrl&&saved.hasApiKey&&!form.apiKey;
      const payload=sameSavedEndpoint?{profileId:saved.id}:{provider:form.provider,baseUrl:providers.find(item=>item.id===form.provider)?.needsUrl?form.baseUrl:undefined,apiKey:form.apiKey};
      const response=await fetch("/api/ai-agent/models",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||t("Daftar model tidak dapat dimuat."));
      const availableModels=Array.isArray(data.models)?data.models as Model[]:[];
      setModels(availableModels);setModelListOpen(availableModels.length>0);setNotice(availableModels.length?t("Daftar model dimuat."):t("Provider belum menampilkan model chat yang didukung."));
    }catch(cause){setError(cause instanceof Error?cause.message:t("Daftar model tidak dapat dimuat."));}
    finally{setModelsBusy(false);}
  };
  const canFetchModels=Boolean(form.apiKey.trim()||profiles.some(profile=>profile.id===form.id&&profile.hasApiKey&&profile.provider===form.provider&&(profile.baseUrl||"")===form.baseUrl));
  const remove=async(id:string)=>{
    if(!window.confirm(t("Hapus konfigurasi provider ini?")))return;
    setBusy(true);setError("");
    try{const response=await fetch("/api/ai-agent/config",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.error);setNotice(t("Konfigurasi dihapus."));if(form.id===id)clearForm();await load();}
    catch(cause){setError(cause instanceof Error?cause.message:t("Profil tidak dapat dihapus."));}
    finally{setBusy(false);}
  };
  const test=async(id:string)=>{
    setBusy(true);setError("");setNotice("");
    try{const response=await fetch("/api/ai-agent/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.error);setNotice(t("Koneksi provider berhasil."));}
    catch(cause){setError(cause instanceof Error?cause.message:t("Provider tidak merespons."));}
    finally{setBusy(false);}
  };
  const toggle=async(profile:Profile)=>{
    setBusy(true);setError("");setNotice("");
    try{const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...profile,isActive:!profile.isActive})});const data=await response.json();if(!response.ok)throw new Error(data.error||t("Perubahan tidak dapat disimpan."));setNotice(t(profile.isActive?"Provider dinonaktifkan.":"Provider diaktifkan."));await load();}
    catch(cause){setError(cause instanceof Error?cause.message:t("Perubahan tidak dapat disimpan."));}
    finally{setBusy(false);}
  };
  const move=async(profileId:string,direction:-1|1)=>{
    const ordered=[...profiles].sort((a,b)=>a.fallbackOrder-b.fallbackOrder||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    const from=ordered.findIndex(item=>item.id===profileId);const to=from+direction;
    if(from<0||to<0||to>=ordered.length)return;
    [ordered[from],ordered[to]]=[ordered[to],ordered[from]];
    setBusy(true);setError("");setNotice("");
    try{const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reorder",profileIds:ordered.map(item=>item.id)})});const data=await response.json();if(!response.ok)throw new Error(data.error||t("Urutan provider tidak dapat disimpan."));await load();}
    catch(cause){setError(cause instanceof Error?cause.message:t("Urutan provider tidak dapat disimpan."));}
    finally{setBusy(false);}
  };
  const selectProvider=(provider:Provider)=>{
    const selected=providers.find(item=>item.id===provider)!;
    setForm(current=>({...current,provider,modelId:"",baseUrl:selected.needsUrl?current.baseUrl:""}));setModels([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);
  };
  const modelOptions=models.filter(model=>`${model.id} ${model.name}`.toLowerCase().includes(modelSearch.toLowerCase())).filter(model=>modelFilter==="all"||(modelFilter==="free"&&model.isFree===true)||(modelFilter==="paid"&&model.isFree===false));
  const modelCostLabel=(model:Model)=>model.isFree===true?t("Gratis"):model.isFree===false?t("Berbayar"):t("Tarif tidak diketahui");
  const selectedModel=models.find(model=>model.id===form.modelId);
  const clearForm=()=>{setForm({...empty});setModels([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);};

  return <section className="ai-settings-page">
    <header className="page-heading"><div><span className="eyebrow">{t("Pengaturan")}</span><h1><Waypoints size={25}/>{t("AI Agent")}</h1><p>{t("Atur penyedia AI untuk bantuan penggunaan celimanapp.")}</p></div></header>
    <div className="ai-privacy-note"><ShieldCheck size={19}/><span>{t("Kunci API dienkripsi di database dan tidak pernah ditampilkan kembali. Chat hanya menjawab tentang penggunaan celimanapp; tidak membaca catatan, file, atau request Anda.")}</span></div>
    {notice&&<div className="ai-flash success" role="status"><Check size={17}/>{notice}</div>}{error&&<div className="ai-flash error" role="alert">{error}</div>}
    <div className="ai-settings-grid">
      <form className="panel ai-profile-form" onSubmit={save}>
        <h2>{form.id?t("Ubah provider"):t("Tambah provider")}</h2>
        <label>{t("Nama profil")}<input required maxLength={80} value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label>
        <label>{t("Provider")}<select disabled={modelsBusy} value={form.provider} onChange={event=>selectProvider(event.target.value as Provider)}>{providers.map(provider=><option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
        {providers.find(item=>item.id===form.provider)?.needsUrl&&<label>{t("Base URL (HTTPS publik)")}<input disabled={modelsBusy} required type="url" placeholder={form.provider==="hermes"?"https://hermes.example.com/v1":"https://api.example.com/v1"} value={form.baseUrl} onChange={event=>setForm({...form,baseUrl:event.target.value})}/></label>}
        <label>{t("API key")}<input disabled={modelsBusy} type="password" autoComplete="new-password" value={form.apiKey} onChange={event=>setForm({...form,apiKey:event.target.value})} placeholder={form.id?t("Kosongkan untuk mempertahankan key tersimpan"):"sk-…"}/></label>
        <div className="ai-model-picker" ref={modelPickerRef}>
          <label>{t("Model AI")}</label>
          <div className="ai-model-fetch-row">
            <button type="button" className={`ai-model-trigger${modelListOpen?" is-open":""}`} disabled={!models.length} aria-haspopup="listbox" aria-expanded={modelListOpen} aria-controls="ai-model-options" onClick={()=>{setModelSearch("");setModelListOpen(open=>!open);}}>
              <span className="ai-model-trigger-text">{selectedModel?.name||form.modelId||t("Ambil model terlebih dahulu")}{form.modelId&&<small>{form.modelId}</small>}</span><ChevronDown size={17}/>
            </button>
            <button type="button" className="secondary-button" disabled={modelsBusy||!canFetchModels} onClick={()=>void fetchModels()}><RefreshCw size={15} className={modelsBusy?"spin":""}/>{modelsBusy?t("Memuat model…"):t("Get models")}</button>
            {modelListOpen&&<div className="ai-model-menu">
              <label className="ai-model-search"><Search size={16}/><input autoFocus type="search" aria-label={t("Cari model")} value={modelSearch} onChange={event=>setModelSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}} placeholder={t("Ketik untuk menyaring model…")}/></label>
              <div className="ai-model-options" id="ai-model-options" role="listbox" aria-label={t("Pilih model")}>
                {modelOptions.length?modelOptions.map(model=><button key={model.id} type="button" role="option" aria-selected={form.modelId===model.id} className={`ai-model-option${form.modelId===model.id?" is-selected":""}`} onClick={()=>{setForm(current=>({...current,modelId:model.id}));setModelSearch("");setModelListOpen(false);}}>
                  <span className="ai-model-option-copy"><strong>{model.name}</strong><code>{model.id}</code></span><span className={`ai-model-price${model.isFree===true?" is-free":model.isFree===false?" is-paid":""}`}>{modelCostLabel(model)}</span>
                </button>):<p className="ai-model-no-results">{t("Tidak ada model yang cocok dengan pencarian ini.")}</p>}
              </div>
              <small className="ai-model-count">{t("Jumlah model")}: {modelOptions.length} / {models.length}</small>
            </div>}
          </div>
          <div className="ai-model-filter" role="group" aria-label={t("Filter biaya model")}>
            {([["all","Semua"],["free","Gratis"],["paid","Berbayar"]] as const).map(([value,label])=><button key={value} type="button" className={`secondary-button${modelFilter===value?" is-selected":""}`} aria-pressed={modelFilter===value} disabled={!models.length} onClick={()=>setModelFilter(value)}>{t(label)}</button>)}
          </div>
          <small>{t("Kunci baru hanya dipakai sementara untuk mengambil daftar model.")} {t("Status gratis mengikuti label atau harga yang disediakan provider; model tanpa data harga ditandai tidak diketahui.")} {t("Model tanpa data harga hanya tampil di filter Semua.")}</small>
        </div>
        <label className="ai-checkbox"><input type="checkbox" checked={form.isActive} onChange={event=>setForm({...form,isActive:event.target.checked})}/>{t("Sertakan dalam fallback")}</label>
        <div className="ai-form-actions"><button className="primary-button" disabled={busy||loading}><Save size={16}/>{busy?t("Menyimpan…"):t("Simpan")}</button>{form.id&&<button type="button" className="secondary-button" onClick={clearForm}>{t("Batal")}</button>}</div>
      </form>
      <section className="panel ai-profiles"><header><h2>{t("Urutan provider fallback")}</h2><button type="button" className="secondary-button" onClick={clearForm}><Plus size={16}/>{t("Baru")}</button></header>
        <p className="ai-fallback-hint">{t("Maksimal empat provider aktif dicoba sesuai urutan. Fallback hanya untuk kuota atau gangguan sementara sebelum jawaban dimulai.")}</p>
        {loading?<p className="ai-empty"><LoaderCircle size={18} className="spin"/>{t("Memuat…")}</p>:profiles.length===0?<p className="ai-empty">{t("Belum ada provider. Tambahkan konfigurasi untuk mengaktifkan chat.")}</p>: [...profiles].sort((a,b)=>a.fallbackOrder-b.fallbackOrder||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map((profile,index)=><article className={`ai-profile-row${profile.isActive?" is-enabled":""}`} key={profile.id}>
          <div className="ai-order-controls"><button type="button" className="icon-button" disabled={busy||index===0} aria-label={t("Naikkan urutan")} onClick={()=>void move(profile.id,-1)}><ArrowUp size={15}/></button><span>{index+1}</span><button type="button" className="icon-button" disabled={busy||index===profiles.length-1} aria-label={t("Turunkan urutan")} onClick={()=>void move(profile.id,1)}><ArrowDown size={15}/></button></div>
          <div className="ai-profile-details"><strong>{profile.name}</strong><span>{providers.find(item=>item.id===profile.provider)?.label||profile.provider} · {profile.modelId}</span><small>{profile.hasApiKey?t("API key tersimpan"):t("API key belum diatur")} · {profile.isActive?t("Termasuk fallback"):t("Dinonaktifkan")}</small></div>
          <div className="ai-profile-actions"><button type="button" className="secondary-button" disabled={busy||!profile.hasApiKey} onClick={()=>void test(profile.id)}>{t("Uji")}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>edit(profile)}>{t("Ubah")}</button><button type="button" className="secondary-button" disabled={busy||!profile.hasApiKey} onClick={()=>void toggle(profile)}>{t(profile.isActive?"Nonaktifkan":"Aktifkan")}</button><button type="button" className="icon-button" disabled={busy} aria-label={t("Hapus provider")} onClick={()=>void remove(profile.id)}><Trash2 size={16}/></button></div>
        </article>)}
      </section>
    </div>
  </section>;
}

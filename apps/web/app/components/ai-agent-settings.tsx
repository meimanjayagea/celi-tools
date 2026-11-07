"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, LoaderCircle, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Waypoints, X } from "lucide-react";
import { useLanguage } from "./language-provider";
import { countModelFilters, filterModels } from "../lib/ai-agent/model-filter.mjs";

type Provider="openai"|"anthropic"|"google"|"groq"|"xai"|"openrouter"|"opencode-zen"|"hermes"|"openai-compatible";
type Profile={id:string;name:string;provider:Provider;modelId:string;baseUrl:string|null;isActive:boolean;fallbackOrder:number;hasApiKey:boolean;createdAt:string};
type Form={id?:string;name:string;provider:Provider;modelId:string;baseUrl:string;apiKey:string;isActive:boolean};
type Model={id:string;name:string;isFree:boolean|null};
type ModelFilter="all"|"free"|"paid"|"unknown";
const providers:Array<{id:Provider;label:string;needsUrl?:boolean}>=[
  {id:"openai",label:"OpenAI"},{id:"anthropic",label:"Anthropic"},{id:"google",label:"Google Gemini"},{id:"groq",label:"Groq"},{id:"xai",label:"xAI Grok"},{id:"openrouter",label:"OpenRouter"},{id:"opencode-zen",label:"OpenCode Zen"},{id:"hermes",label:"Hermes API",needsUrl:true},{id:"openai-compatible",label:"OpenAI-compatible",needsUrl:true},
];
const empty:Form={name:"",provider:"openai",modelId:"",baseUrl:"",apiKey:"",isActive:false};

export default function AiAgentSettings() {
  const {t}=useLanguage();
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [formOpen,setFormOpen]=useState(false);
  const formDialogRef=useRef<HTMLDialogElement>(null);
  const [form,setForm]=useState<Form>(empty);
  const [models,setModels]=useState<Model[]>([]);
  const [selectedModelIds,setSelectedModelIds]=useState<string[]>([]);
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
    const dialog=formDialogRef.current;
    if(!dialog)return;
    if(formOpen&&!dialog.open)dialog.showModal();
    else if(!formOpen&&dialog.open)dialog.close();
  },[formOpen]);
  useEffect(()=>{
    if(!modelListOpen)return;
    const onPointerDown=(event:PointerEvent)=>{if(!modelPickerRef.current?.contains(event.target as Node))setModelListOpen(false);};
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setModelListOpen(false);};
    document.addEventListener("pointerdown",onPointerDown);document.addEventListener("keydown",onKeyDown);
    return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
  },[modelListOpen]);

  const clearForm=()=>{setForm({...empty});setModels([]);setSelectedModelIds([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);setError("");setNotice("");setFormOpen(false);};
  const addProvider=()=>{clearForm();setFormOpen(true);};
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setError("");setNotice("");
    if(!selectedModelIds.length){setError(t("Pilih model sebelum menyimpan."));return;}
    if(!form.id&&!form.apiKey.trim()){setError(t("API key wajib diisi untuk provider baru."));return;}
    setBusy(true);
    try{
      const payload={...form,baseUrl:providers.find(item=>item.id===form.provider)?.needsUrl?form.baseUrl:undefined,apiKey:form.apiKey||undefined,...(!form.id?{modelIds:selectedModelIds}:{modelId:selectedModelIds[0]})};
      const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||t("Perubahan tidak dapat disimpan."));
      const savedCount=Array.isArray(data.profiles)?data.profiles.length:1;
      clearForm();setNotice(savedCount>1?t("Konfigurasi tersimpan untuk beberapa model."):t("Konfigurasi tersimpan."));await load();
    }catch(cause){setError(cause instanceof Error?cause.message:t("Perubahan tidak dapat disimpan."));}
    finally{setBusy(false);}
  };
  const edit=(profile:Profile)=>{
    setForm({id:profile.id,name:profile.name,provider:profile.provider,modelId:profile.modelId,baseUrl:profile.baseUrl||"",apiKey:"",isActive:profile.isActive});
    setModels([{id:profile.modelId,name:profile.modelId,isFree:null}]);setSelectedModelIds([profile.modelId]);setModelSearch("");setModelFilter("all");setModelListOpen(false);setError("");setNotice("");setFormOpen(true);
  };
  const fetchModels=async()=>{
    setModelsBusy(true);setError("");setNotice("");setModels([]);setSelectedModelIds([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);
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
    const from=ordered.findIndex(item=>item.id===profileId);const to=from+direction;if(from<0||to<0||to>=ordered.length)return;
    [ordered[from],ordered[to]]=[ordered[to],ordered[from]];setBusy(true);setError("");setNotice("");
    try{const response=await fetch("/api/ai-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reorder",profileIds:ordered.map(item=>item.id)})});const data=await response.json();if(!response.ok)throw new Error(data.error||t("Urutan provider tidak dapat disimpan."));await load();}
    catch(cause){setError(cause instanceof Error?cause.message:t("Urutan provider tidak dapat disimpan."));}
    finally{setBusy(false);}
  };
  const selectProvider=(provider:Provider)=>{
    const selected=providers.find(item=>item.id===provider)!;
    setForm(current=>({...current,provider,modelId:"",baseUrl:selected.needsUrl?current.baseUrl:""}));setModels([]);setSelectedModelIds([]);setModelSearch("");setModelFilter("all");setModelListOpen(false);
  };
  const toggleModel=(modelId:string)=>setSelectedModelIds(current=>current.includes(modelId)?current.filter(id=>id!==modelId):[...current,modelId]);
  const modelOptions=filterModels(models,modelSearch,modelFilter);
  const modelFilterCounts=countModelFilters(models);
  const modelCostLabel=(model:Model)=>model.isFree===true?t("Gratis"):model.isFree===false?t("Berbayar"):t("Tarif tidak diketahui");
  const selectedModels=models.filter(model=>selectedModelIds.includes(model.id));
  const sortedProfiles=[...profiles].sort((a,b)=>a.fallbackOrder-b.fallbackOrder||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));

  return <section className="ai-settings-page">
    <header className="page-heading"><div><span className="eyebrow">{t("Pengaturan")}</span><h1><Waypoints size={25}/>{t("AI Agent")}</h1><p>{t("Atur penyedia AI untuk bantuan penggunaan celimanapp.")}</p></div></header>
    <div className="ai-privacy-note"><ShieldCheck size={19}/><span>{t("Kunci API dienkripsi di database dan tidak pernah ditampilkan kembali. Chat hanya menjawab tentang penggunaan celimanapp; tidak membaca catatan, file, atau request Anda.")}</span></div>
    {notice&&!formOpen&&<div className="ai-flash success" role="status"><Check size={17}/>{notice}</div>}{error&&!formOpen&&<div className="ai-flash error" role="alert">{error}</div>}
    <div className="ai-settings-grid">
      <dialog ref={formDialogRef} className="ai-provider-dialog" aria-labelledby="ai-provider-dialog-title" onCancel={event=>{event.preventDefault();clearForm();}} onClick={event=>{if(event.target===formDialogRef.current)clearForm();}}>
      <form className="ai-profile-form" onSubmit={save}>
        <header className="ai-provider-dialog-header"><div><span className="eyebrow">{t("AI Agent")}</span><h2 id="ai-provider-dialog-title">{form.id?t("Ubah provider"):t("Tambah provider")}</h2><p>{t("Atur penyedia AI untuk bantuan penggunaan celimanapp.")}</p></div><button type="button" className="app-dialog-close" aria-label={t("Tutup dialog")} onClick={clearForm}><X size={18}/></button></header>
        {error&&<div className="ai-flash error" role="alert">{error}</div>}
        <label>{t("Nama profil")}<input required maxLength={80} value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label>
        <label>{t("Provider")}<select disabled={modelsBusy||Boolean(form.id)} value={form.provider} onChange={event=>selectProvider(event.target.value as Provider)}>{providers.map(provider=><option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
        {providers.find(item=>item.id===form.provider)?.needsUrl&&<label>{t("Base URL (HTTPS publik)")}<input disabled={modelsBusy} required type="url" placeholder={form.provider==="hermes"?"https://hermes.example.com/v1":"https://api.example.com/v1"} value={form.baseUrl} onChange={event=>setForm({...form,baseUrl:event.target.value})}/></label>}
        <label>{t("API key")}<input disabled={modelsBusy} required={!form.id} type="password" autoComplete="new-password" value={form.apiKey} onChange={event=>setForm({...form,apiKey:event.target.value})} placeholder={form.id?t("Kosongkan untuk mempertahankan key tersimpan"):"sk-…"}/></label>
        <div className="ai-model-picker" ref={modelPickerRef}>
          <label>{t("Model AI")}</label>
          <div className="ai-model-fetch-row">
            <button type="button" className={`ai-model-trigger${modelListOpen?" is-open":""}`} disabled={!models.length} aria-haspopup="listbox" aria-expanded={modelListOpen} aria-controls="ai-model-options" onClick={()=>{setModelSearch("");setModelListOpen(open=>!open);}}>
              <span className="ai-model-trigger-text">{selectedModelIds.length?t("Model dipilih {count}").replace("{count}",String(selectedModelIds.length)):form.modelId||t("Ambil model terlebih dahulu")}<small>{selectedModelIds.length?selectedModels.map(model=>model.name).join(", "):form.modelId}</small></span><ChevronDown size={17}/>
            </button>
            <button type="button" className="secondary-button" disabled={modelsBusy||!canFetchModels} onClick={()=>void fetchModels()}><RefreshCw size={15} className={modelsBusy?"spin":""}/>{modelsBusy?t("Memuat model…"):t("Get models")}</button>
            {modelListOpen&&<div className="ai-model-menu">
              <label className="ai-model-search"><Search size={16}/><input autoFocus type="search" aria-label={t("Cari model")} value={modelSearch} onChange={event=>setModelSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}} placeholder={t("Ketik untuk menyaring model…")}/></label>
              <div className="ai-model-options" id="ai-model-options" role="listbox" aria-multiselectable={!form.id} aria-label={t("Pilih model")}>
                {modelOptions.length?modelOptions.map(model=><button key={model.id} type="button" role="option" aria-selected={selectedModelIds.includes(model.id)} className={`ai-model-option${selectedModelIds.includes(model.id)?" is-selected":""}`} onClick={()=>{if(form.id){setSelectedModelIds([model.id]);setForm(current=>({...current,modelId:model.id}));setModelListOpen(false);}else toggleModel(model.id);}}>
                  <span className={`ai-model-check${selectedModelIds.includes(model.id)?" is-selected":""}`}>{selectedModelIds.includes(model.id)&&<Check size={12}/>}</span><span className="ai-model-option-copy"><strong>{model.name}</strong><code>{model.id}</code></span><span className={`ai-model-price${model.isFree===true?" is-free":model.isFree===false?" is-paid":""}`}>{modelCostLabel(model)}</span>
                </button>):<p className="ai-model-no-results">{modelSearch.trim()?t("Tidak ada model yang cocok dengan pencarian ini."):modelFilter==="free"||modelFilter==="paid"?modelFilterCounts.unknown?t("Provider tidak memberikan informasi harga untuk mengelompokkan model ini. Lihat filter Belum diketahui."):t("Tidak ada model pada filter biaya ini."):t("Tidak ada model pada filter ini.")}</p>}
              </div>
              <small className="ai-model-count">{t("Jumlah model")}: {modelOptions.length} / {models.length} · {t("Model dipilih {count}").replace("{count}",String(selectedModelIds.length))}</small>
            </div>}
          </div>
          <div className="ai-model-filter" role="group" aria-label={t("Filter biaya model")}>
            {([ ["all","Semua"],["free","Gratis"],["paid","Berbayar"],["unknown","Belum diketahui"] ] as const).map(([value,label])=><button key={value} type="button" className={`secondary-button${modelFilter===value?" is-selected":""}`} aria-pressed={modelFilter===value} disabled={!models.length} onClick={()=>{setModelFilter(value);setModelSearch("");setModelListOpen(true);}}>{t(label)} <span className="ai-model-filter-count">{modelFilterCounts[value]}</span></button>)}
          </div>
          {selectedModelIds.length>0&&<div className="ai-selected-models" aria-live="polite">{selectedModels.map(model=><span key={model.id}>{model.name}<button type="button" aria-label={`${t("Hapus model")}: ${model.name}`} onClick={()=>toggleModel(model.id)}><Trash2 size={12}/></button></span>)}</div>}
          <small>{form.id?t("Pilih satu model untuk memperbarui profil."):t("Pilih satu atau beberapa model. Setiap model akan menjadi baris profil sendiri dengan key provider yang sama.")} {t("Kunci baru hanya dipakai sementara untuk mengambil daftar model.")} {t("Status gratis mengikuti label atau harga yang disediakan provider; model tanpa data harga ditandai tidak diketahui.")}</small>
        </div>
        <label className="ai-checkbox"><input type="checkbox" checked={form.isActive} onChange={event=>setForm({...form,isActive:event.target.checked})}/>{t("Sertakan dalam fallback")}</label>
        <div className="app-dialog-actions"><button type="button" className="secondary-button" onClick={clearForm}>{t("Batal")}</button><button className="primary-button" disabled={busy||loading}><Save size={16}/>{busy?t("Menyimpan…"):!form.id&&selectedModelIds.length>1?t("Simpan model {count}").replace("{count}",String(selectedModelIds.length)):t("Simpan")}</button></div>
      </form>
      </dialog>
      <section className="panel ai-profiles"><header><div><h2>{t("Urutan provider fallback")}</h2><p>{profiles.length} {t("profil tersimpan")}</p></div><button type="button" className="primary-button" aria-haspopup="dialog" aria-expanded={formOpen} onClick={addProvider}><Plus size={16}/>{t("Tambah provider")}</button></header>
        <p className="ai-fallback-hint">{t("Maksimal empat provider aktif dicoba sesuai urutan. Fallback hanya untuk kuota atau gangguan sementara sebelum jawaban dimulai.")}</p>
        {loading?<p className="ai-empty"><LoaderCircle size={18} className="spin"/>{t("Memuat…")}</p>:profiles.length===0?<p className="ai-empty">{t("Belum ada provider. Tambahkan konfigurasi untuk mengaktifkan chat.")}</p>:<div className="ai-provider-table-scroll"><table className="ai-provider-table"><thead><tr><th>{t("Nama profil")}</th><th>{t("Provider / Model")}</th><th>{t("Status")}</th><th>{t("Urutan")}</th><th><span className="sr-only">{t("Aksi")}</span></th></tr></thead><tbody>{sortedProfiles.map((profile,index)=><tr key={profile.id}>
          <td className="ai-table-name"><strong>{profile.name}</strong></td>
          <td className="ai-table-model"><span>{providers.find(item=>item.id===profile.provider)?.label||profile.provider}</span><code title={profile.modelId}>{profile.modelId}</code></td>
          <td><span className={`ai-status-pill${profile.isActive?" is-active":""}`}>{profile.isActive?t("Aktif"):t("Tidak aktif")}</span><small className="ai-key-state">{profile.hasApiKey?t("API key tersimpan"):t("API key belum diatur")}</small></td>
          <td><div className="ai-order-controls"><button type="button" className="icon-button" disabled={busy||index===0} aria-label={t("Naikkan urutan")} onClick={()=>void move(profile.id,-1)}><ArrowUp size={15}/></button><span>{index+1}</span><button type="button" className="icon-button" disabled={busy||index===profiles.length-1} aria-label={t("Turunkan urutan")} onClick={()=>void move(profile.id,1)}><ArrowDown size={15}/></button></div></td>
          <td><div className="ai-profile-actions"><button type="button" className="secondary-button" disabled={busy||!profile.hasApiKey} onClick={()=>void test(profile.id)}>{t("Uji")}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>edit(profile)}>{t("Ubah")}</button><button type="button" className="secondary-button" disabled={busy||!profile.hasApiKey} onClick={()=>void toggle(profile)}>{t(profile.isActive?"Nonaktifkan":"Aktifkan")}</button><button type="button" className="icon-button" disabled={busy} aria-label={t("Hapus provider")} onClick={()=>void remove(profile.id)}><Trash2 size={15}/></button></div></td>
        </tr>)}</tbody></table></div>}
      </section>
    </div>
  </section>;
}

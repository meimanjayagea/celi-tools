"use client";
import { useEffect, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Bot, MessageCircle, Send, Square, Trash2, X } from "lucide-react";
import { useLanguage } from "./language-provider";

export default function AiHelpChat(){
  const {t}=useLanguage();
  const [open,setOpen]=useState(false);
  const [available,setAvailable]=useState(false);
  const [draft,setDraft]=useState("");
  const [availabilityLoaded,setAvailabilityLoaded]=useState(false);
  const {messages,status,error,sendMessage,stop,setMessages}=useChat({transport:new DefaultChatTransport({api:"/api/ai-agent/chat"})});
  useEffect(()=>{const controller=new AbortController();fetch("/api/ai-agent/access",{cache:"no-store",signal:controller.signal}).then(async response=>({response,data:await response.json()})).then(({response,data})=>{if(response.ok)setAvailable(Boolean(data.available));setAvailabilityLoaded(true);}).catch(()=>setAvailabilityLoaded(true));return()=>controller.abort();},[]);
  useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[open]);
  const busy=status==="submitted"||status==="streaming";
  const submit=(event:React.FormEvent)=>{event.preventDefault();const text=draft.trim();if(!text||busy)return;setDraft("");void sendMessage({text});};
  return <div className="ai-chat-root"><button className="ai-chat-launcher" aria-label={open?t("Tutup bantuan AI"):t("Buka bantuan AI")} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<MessageCircle size={21}/>}<span>{t("Bantuan AI")}</span></button>
    {open&&<section className="ai-chat-panel" role="dialog" aria-modal="false" aria-label={t("Bantuan AI celimanapp")}><header><div><span className="ai-chat-avatar"><Bot size={19}/></span><div><strong>{t("Bantuan celimanapp")}</strong><small>{available?t("Siap membantu"):t("Belum dikonfigurasi")}</small></div></div><div><button className="icon-button" aria-label={t("Hapus percakapan")} onClick={()=>setMessages([])}><Trash2 size={16}/></button><button className="icon-button" aria-label={t("Tutup bantuan AI")} onClick={()=>setOpen(false)}><X size={17}/></button></div></header>
      <div className="ai-chat-messages" aria-live="polite">{messages.length===0&&<div className="ai-chat-welcome"><Bot size={28}/><strong>{t("Ada yang bisa saya bantu?")}</strong><p>{t("Tanyakan cara menggunakan fitur celimanapp.")}</p></div>}{messages.map(message=><div className={`ai-chat-message ${message.role}`} key={message.id}><span>{message.parts.filter(part=>part.type==="text").map((part,index)=>part.type==="text"?<span key={`${message.id}-${index}`}>{part.text}</span>:null)}</span></div>)}{busy&&<div className="ai-chat-thinking">{t("Menyiapkan jawaban…")}</div>}{error&&<div className="ai-chat-error" role="alert">{t("Jawaban belum dapat dimuat. Periksa koneksi lalu coba lagi.")}</div>}{availabilityLoaded&&!available&&<div className="ai-chat-unavailable">{t("Layanan bantuan AI belum diaktifkan. Coba lagi nanti.")}</div>}</div>
      <form className="ai-chat-composer" onSubmit={submit}><textarea rows={2} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t("Tulis pertanyaan…")} aria-label={t("Tulis pertanyaan")}/>{busy?<button type="button" className="ai-chat-send stop" onClick={()=>void stop()} aria-label={t("Hentikan jawaban")}><Square size={16}/></button>:<button className="ai-chat-send" disabled={!draft.trim()||!available} aria-label={t("Kirim pesan")}><Send size={16}/></button>}</form>
    </section>}</div>;
}

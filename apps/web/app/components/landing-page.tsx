"use client";
import React from "react";
import { useLanguage } from "./language-provider";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CodeXml, Zap, Shield, Clock, Layers } from "lucide-react";
import { WORKSPACES, CATEGORY_LABELS, type ToolCategory } from "../lib/workspaces";

export default function LandingPage() {
  const { t } = useLanguage();

  const categories: ToolCategory[] = ["file", "data", "security", "productivity"];

  return <main className="landing-page">
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="public-eyebrow landing-eyebrow">
          <span className="local-indicator"/>{t("FILE & DATA, BERES DALAM SATU WORKSPACE")}
        </span>
        <h1 className="landing-hero-title">{t("Ubah file. Rapikan data.")}<br/><span className="landing-hero-title-accent">{t("Kerja jadi lebih ringan.")}</span></h1>
        <p className="landing-hero-desc">{t("Konversi format, perkecil ukuran file, jelajahi JSON, dan olah teks. celimanapp menyatukan pekerjaan kecil yang sering menyita waktu, agar Anda bisa lanjut ke hal berikutnya.")}</p>
        <div className="landing-actions"><Link href="/login" className="primary-button landing-cta-primary">{t("Mulai dengan Google ")}<ArrowRight size={18}/></Link><Link href="#tools" className="secondary-button landing-cta-secondary">Lihat semua workspace <ArrowRight size={17}/></Link></div>
        <div className="landing-reassurance"><div className="reassurance-item"><Check size={15}/><span>{t("Tanpa instalasi")}</span></div><div className="reassurance-item"><Zap size={15}/><span>Proses langsung di browser</span></div><div className="reassurance-item"><Shield size={15}/><span>Enam workspace dalam satu portal</span></div><div className="reassurance-item"><Clock size={15}/><span>Simpan waktu, selesaikan lebih banyak</span></div></div>
      </div>
      <div className="landing-visual"><Image src="/images/workspace-hero.webp" width={620} height={413} alt={t("Ilustrasi workspace untuk mengolah kode dan melindungi data")} priority unoptimized className="landing-hero-image"/><div className="landing-visual-caption"><CodeXml size={19}/><span>{t("Lebih sedikit berpindah tools.")}<br/><strong>{t("Lebih banyak pekerjaan selesai.")}</strong></span></div><div className="landing-hero-badge"><Layers size={16}/><span>Satu akun untuk semua workspace</span></div></div>
    </section>

    <section className="landing-value-props" aria-labelledby="landing-value-title">
      <div className="landing-section-heading landing-value-heading"><span className="eyebrow">Mengapa celimanapp?</span><h2 id="landing-value-title">Dibuat untuk pekerjaan Anda, bukan sebaliknya.</h2><p>Semua tools yang Anda butuhkan dalam satu portal. Tanpa ribet, tanpa berpindah aplikasi.</p></div>
      <div className="landing-value-grid">
        <div className="landing-value-card"><div className="landing-value-icon"><Zap size={24}/></div><h3>Cepat dan langsung</h3><p>Mulai bekerja segera setelah login. Semua tools siap pakai tanpa konfigurasi.</p></div>
        <div className="landing-value-card"><div className="landing-value-icon"><Shield size={24}/></div><h3>Aman di browser Anda</h3><p>Proses file dan data langsung di browser. Tidak disimpan ke server tanpa izin Anda.</p></div>
        <div className="landing-value-card"><div className="landing-value-icon"><Layers size={24}/></div><h3>Satu portal, banyak kegunaan</h3><p>Dari konversi file hingga request API, semuanya ada di satu tempat terpadu.</p></div>
      </div>
    </section>

    <section className="landing-tools" id="tools" aria-labelledby="landing-tools-title">
      <div className="landing-section-heading landing-tools-heading"><span className="eyebrow">Pilih workspace Anda</span><h2 id="landing-tools-title">Enam workspace untuk setiap kebutuhan pekerjaan</h2><p>Konversi, kompresi, JSON, Crypto, catatan, dan API Client. Pilih yang cocok untuk Anda.</p></div>
      <div className="landing-tool-categories">
        {categories.map((catId) => {
          const cat = CATEGORY_LABELS[catId];
          const items = WORKSPACES.filter((w) => w.category === catId);
          return <div key={catId} className="landing-tool-category"><div className="landing-tool-category-header"><span className="landing-tool-category-icon">{React.createElement(cat.icon, { size: 20 })}</span><span className="landing-tool-category-title">{cat.label}</span></div><div className="landing-tool-category-grid">{items.map((w) => <article key={w.href} className="landing-tool landing-tool-hover"><div className="landing-tool-badge">{React.createElement(w.icon, { size: 24 })}</div><h3>{w.title}</h3><p>{w.description}</p><ul className="landing-tool-features">{w.features.map((feature) => <li key={feature}><Check size={14}/>{feature}</li>)}</ul><Link href={w.href} className="landing-tool-cta">Buka {w.title} <ArrowRight size={16}/></Link></article>)}</div></div>;
        })}
      </div>
    </section>

    <section className="landing-start"><div className="landing-start-copy"><span className="eyebrow">Siap mulai?</span><h2>{t("File lebih siap. Pekerjaan lebih singkat.")}</h2><p>{t("Masuk dengan Google untuk membuka semua workspace. Akun baru dibuat otomatis saat login pertama.")}</p></div><Link href="/login" className="primary-button landing-cta-final">{t("Masuk dengan Google ")}<ArrowRight size={18}/></Link></section>
  </main>;
}

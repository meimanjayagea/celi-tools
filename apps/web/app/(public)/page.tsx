import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CodeXml } from "lucide-react";
import { WORKSPACES } from "../lib/workspaces";
export const metadata: Metadata = {
    title: "Celi Tools — Konversi file, kompres, dan olah data",
    description: "Konversi dan kompres file, rapikan JSON, serta olah teks dengan tools encoding dan kriptografi dalam satu portal.",
};
export default function LandingPage() {
    return <main className="landing-page">
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="public-eyebrow"><span className="local-indicator"/>FILE & DATA, BERES DALAM SATU WORKSPACE</span>
        <h1>Ubah file. Rapikan data.<br /><span>Kerja jadi lebih ringan.</span></h1>
        <p>Konversi format, perkecil ukuran file, jelajahi JSON, dan olah teks. Celi Tools menyatukan pekerjaan kecil yang sering menyita waktu, agar Anda bisa lanjut ke hal berikutnya.</p>
        <div className="landing-actions"><Link href="/login" className="primary-button">Masuk dengan Google <ArrowRight size={18}/></Link><Link href="#tools" className="secondary-button">Lihat workspace</Link></div>
        <div className="landing-reassurance"><span><Check size={15}/>Tanpa instalasi</span><span><Check size={15}/>Empat workspace dalam satu portal</span></div>
      </div>
      <div className="landing-visual"><Image src="/images/workspace-hero.webp" width={620} height={413} alt="Ilustrasi workspace untuk mengolah kode dan melindungi data" priority unoptimized/><div className="landing-visual-caption"><CodeXml size={19}/><span>Lebih sedikit berpindah tools.<br /><strong>Lebih banyak pekerjaan selesai.</strong></span></div></div>
    </section>
    <section className="landing-tools" id="tools" aria-labelledby="landing-tools-title">
      <div className="landing-section-heading"><span className="eyebrow">KENALI WORKSPACE ANDA</span><h2 id="landing-tools-title">Tools yang tepat, saat Anda membutuhkannya.</h2><p>Konversi, kompresi, JSON, dan Crypto. Pilih yang Anda butuhkan, ikuti alurnya, unduh hasilnya.</p></div>
      <div className="landing-tool-grid">{WORKSPACES.map(({title,href,icon:Icon,description,features})=><article className="landing-tool" key={href}><span className="landing-tool-icon"><Icon size={27}/></span><h3>{title}</h3><p>{description}</p><ul>{features.map(feature=><li key={feature}><Check size={16}/>{feature}</li>)}</ul><Link href={href}>Buka {title} <ArrowRight size={17}/></Link></article>)}</div>
    </section>
    <section className="landing-start"><div><span className="eyebrow">SIAP MULAI?</span><h2>File lebih siap. Pekerjaan lebih singkat.</h2><p>Masuk dengan Google untuk membuka semua workspace. Akun baru dibuat otomatis saat login pertama.</p></div><Link href="/login" className="primary-button">Masuk dengan Google <ArrowRight size={18}/></Link></section>
  </main>;
}

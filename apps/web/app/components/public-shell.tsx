"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-provider";
import { LanguageToggle, useLanguage } from "./language-provider";
import { useAuth } from "./auth-provider";
export default function PublicShell({ children }: {
    children: React.ReactNode;
}) {
  const { t } = useLanguage();
    const path = usePathname();
    const { user } = useAuth();
    return <div className="public-site">
    <a className="skip-link" href="#public-content">{t("Lewati ke konten")}</a>
    <header className="public-header"><div className="public-header-inner">
      <Link href="/" className="public-brand" aria-label={t("Celi Tools beranda")}><Image src="/brand.svg" width={34} height={34} alt=""/><span>CELI TOOLS</span></Link>
      <nav className="public-navigation" aria-label={t("Navigasi publik")}><Link href="/" aria-current={path === "/" ? "page" : undefined}>{t("Beranda")}</Link><Link href="/#tools">Tools</Link></nav>
      <div className="public-header-actions"><LanguageToggle /><ThemeToggle />{user ? <Link href="/dashboard" className="primary-button">{t("Buka portal")}</Link> : <Link href="/login" className="primary-button" aria-current={path === "/login" ? "page" : undefined}>{t("Masuk")}</Link>}</div>
    </div></header>
    <div id="public-content" tabIndex={-1}>{children}</div>
    <footer className="public-footer"><span>CELI TOOLS</span><span>{t("Ubah file. Ringankan ukuran. Rapikan data.")}</span><Link href="/">{t("Kembali ke beranda")}</Link></footer>
  </div>;
}

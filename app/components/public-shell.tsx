"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-provider";
import { useAuth } from "./auth-provider";
export default function PublicShell({ children }: {
    children: React.ReactNode;
}) {
    const path = usePathname();
    const { user } = useAuth();
    return <div className="public-site">
    <a className="skip-link" href="#public-content">Lewati ke konten</a>
    <header className="public-header"><div className="public-header-inner">
      <Link href="/" className="public-brand" aria-label="Celi Tools beranda"><Image src="/brand.svg" width={34} height={34} alt=""/><span>CELI TOOLS</span></Link>
      <nav className="public-navigation" aria-label="Navigasi publik"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Beranda</Link><Link href="/#tools">Tools</Link></nav>
      <div className="public-header-actions"><ThemeToggle />{user ? <Link href="/dashboard" className="primary-button">Buka portal</Link> : <><Link href="/login" className={`public-login ${path === "/login" ? "active" : ""}`} aria-current={path === "/login" ? "page" : undefined}>Masuk</Link><Link href="/register" className="primary-button public-register" aria-current={path === "/register" ? "page" : undefined}>Daftar</Link></>}</div>
    </div></header>
    <div id="public-content" tabIndex={-1}>{children}</div>
    <footer className="public-footer"><span>CELI TOOLS</span><span>Ubah file. Ringankan ukuran. Rapikan data.</span><Link href="/">Kembali ke beranda</Link></footer>
  </div>;
}

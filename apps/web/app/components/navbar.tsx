"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { CodeXml, Home, LockKeyhole, Settings2, FileInput, FileArchive, Menu, X, ChevronRight, LogOut, LogIn, StickyNote, Waypoints } from "lucide-react";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-provider";
import { LanguageToggle, useLanguage } from "./language-provider";
const links = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/sticky-notes", label: "Sticky Note", icon: StickyNote },
    { href: "/api-client", label: "API Client", icon: Waypoints },
    { href: "/json", label: "JSON Workspace", icon: CodeXml },
    { href: "/crypto", label: "Crypto Tools", icon: LockKeyhole },
    { href: "/converter", label: "File Converter", icon: FileInput },
    { href: "/compress", label: "File Compress", icon: FileArchive },
    { href: "/preferences", label: "Preferensi", icon: Settings2 },
];
export default function Navbar({ children }: {
    children: ReactNode;
}) {
  const { t } = useLanguage();
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useAuth();
    const [open, setOpen] = useState(false);
    const [authError, setAuthError] = useState("");
    useEffect(() => {
        if (!open)
            return;
        const sidebar = document.getElementById("portal-navigation");
        const targets = sidebar?.querySelectorAll<HTMLElement>('a[href], button');
        targets?.[0]?.focus();
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                setOpen(false);
            if (event.key === "Tab" && targets?.length) {
                const first = targets[0], last = targets[targets.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("keydown", escape); document.getElementById("navigation-toggle")?.focus(); };
    }, [open]);
    const title = links.find((link) => link.href === pathname)?.label || (pathname === "/login" ? "Akun" : "Showcase");
    return <div className="portal">
    <a className="skip-link" href="#portal-content">{t("Lewati ke konten")}</a>
    {open && <button className="nav-backdrop" aria-label={t("Tutup navigasi")} onClick={() => setOpen(false)}/>}
    <aside className={`portal-sidebar ${open ? "is-open" : ""}`} aria-label={t("Navigasi utama")} id="portal-navigation">
      <button className="icon-button drawer-close" aria-label={t("Tutup menu")} onClick={() => setOpen(false)}><X size={17}/></button>
      <Link href="/" className="portal-brand" onClick={() => setOpen(false)}><Image src="/brand.svg" width={34} height={34} alt=""/><span>CELI TOOLS</span></Link>
      <nav>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`portal-nav-link ${pathname === href ? "active" : ""} ${href === "/preferences" ? "nav-preferences" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon size={21}/><span>{t(label)}</span></Link>)}</nav>
      <div className="sidebar-bottom"><span className="local-indicator"/>{t("File & data, satu tempat")}<small>{t("Ubah. Ringankan. Rapikan.")}</small></div>
    </aside>
    <div className="portal-main" inert={open || undefined}>
      <header className="portal-header">
        <button id="navigation-toggle" className="icon-button mobile-menu" aria-label={open ? t("Tutup navigasi") : t("Buka navigasi")} aria-expanded={open} aria-controls="portal-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        <Link href="/dashboard" className="mobile-portal-brand" aria-label="Dashboard"><Image src="/brand.svg" width={30} height={30} alt=""/><span>CELI TOOLS</span></Link>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/dashboard" aria-label="Dashboard"><Home size={17}/></Link><ChevronRight size={14}/><span>{t(title)}</span></nav>
        <div className="header-actions"><LanguageToggle /><ThemeToggle />
          {user ? <details className="account-menu"><summary aria-label={user.email || t("Akun")}><span className="avatar">{(user.email || "A")[0].toUpperCase()}</span><span className="account-label">{user.email?.split("@")[0] || "Akun"}</span><ChevronRight size={14}/></summary><div className="account-dropdown"><span>{user.email}</span><button onClick={async () => {
                try {
                    await signOut({ redirect: false });
                    router.replace("/");
                } catch {
                    setAuthError("Gagal keluar. Silakan coba lagi.");
                }
            }}><LogOut size={16}/>{t("Keluar")}</button></div></details> : <Link href="/login" className="account-login" aria-label={t("Masuk")}><span className="avatar"><LogIn size={18}/></span><span>{loading ? t("Memuat…") : t("Masuk")}</span></Link>}
        </div>
      </header>
      {authError && <p className="alert alert-error" role="alert">{t(authError)}</p>}
      <div id="portal-content" className="portal-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}

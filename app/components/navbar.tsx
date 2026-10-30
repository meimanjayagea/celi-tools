"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CodeXml, Home, LockKeyhole, Settings2, FileInput, FileArchive, Menu, X, ChevronRight, LogOut, LogIn } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClientSupabase } from "../lib/supabase";
import { ThemeToggle } from "./theme-provider";
const links = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/converter", label: "File Converter", icon: FileInput },
    { href: "/compress", label: "File Compress", icon: FileArchive },
    { href: "/json", label: "JSON Workspace", icon: CodeXml },
    { href: "/crypto", label: "Crypto Tools", icon: LockKeyhole },
    { href: "/preferences", label: "Preferensi", icon: Settings2 },
];
export default function Navbar({ children }: {
    children: ReactNode;
}) {
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
    <a className="skip-link" href="#portal-content">Lewati ke konten</a>
    {open && <button className="nav-backdrop" aria-label="Tutup navigasi" onClick={() => setOpen(false)}/>}
    <aside className={`portal-sidebar ${open ? "is-open" : ""}`} aria-label="Navigasi utama" id="portal-navigation">
      <button className="icon-button drawer-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={17}/></button>
      <Link href="/" className="portal-brand" onClick={() => setOpen(false)}><Image src="/brand.svg" width={34} height={34} alt=""/><span>CELI TOOLS</span></Link>
      <nav>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`portal-nav-link ${pathname === href ? "active" : ""} ${href === "/preferences" ? "nav-preferences" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon size={21}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><span className="local-indicator"/>File & data, satu tempat<small>Ubah. Ringankan. Rapikan.</small></div>
    </aside>
    <div className="portal-main" inert={open || undefined}>
      <header className="portal-header">
        <button id="navigation-toggle" className="icon-button mobile-menu" aria-label={open ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={open} aria-controls="portal-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/dashboard" aria-label="Dashboard"><Home size={17}/></Link><ChevronRight size={14}/><span>{title}</span></nav>
        <div className="header-actions"><ThemeToggle />
          {user ? <details className="account-menu"><summary><span className="avatar">{(user.email || "A")[0].toUpperCase()}</span><span className="account-label">{user.email?.split("@")[0] || "Akun"}</span><ChevronRight size={14}/></summary><div className="account-dropdown"><span>{user.email}</span><button onClick={async () => {
                const { error } = await createClientSupabase().auth.signOut();
                if (error)
                    setAuthError("Gagal keluar. Silakan coba lagi.");
                else
                    router.replace("/");
            }}><LogOut size={16}/>Keluar</button></div></details> : <Link href="/login" className="account-login"><span className="avatar"><LogIn size={18}/></span><span>{loading ? "Memuat…" : "Masuk"}</span></Link>}
        </div>
      </header>
      {authError && <p className="alert alert-error" role="alert">{authError}</p>}
      <div id="portal-content" className="portal-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}

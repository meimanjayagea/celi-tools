"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { CodeXml, Home, LockKeyhole, Settings2, FileInput, FileArchive, Menu, X, ChevronRight, LogOut, LogIn, StickyNote, Waypoints, User, Mail, Shield } from "lucide-react";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-provider";
import { LanguageToggle, useLanguage } from "./language-provider";
const GROUP_LABELS: Record<string, string> = {
    workspace: "Workspace",
    tools: "Tools",
    settings: "Pengaturan",
  };

  const links = [
    { group: "workspace", href: "/dashboard", label: "Dashboard", icon: Home },
    { group: "workspace", href: "/sticky-notes", label: "Sticky Note", icon: StickyNote },
    { group: "workspace", href: "/api-client", label: "API Client", icon: Waypoints },
    { group: "tools", href: "/json", label: "JSON Workspace", icon: CodeXml },
    { group: "tools", href: "/crypto", label: "Crypto Tools", icon: LockKeyhole },
    { group: "tools", href: "/converter", label: "File Converter", icon: FileInput },
    { group: "tools", href: "/compress", label: "File Compress", icon: FileArchive },
    { group: "settings", href: "/preferences", label: "Preferensi", icon: Settings2 },
  ];
export default function Navbar({ children }: {
    children: ReactNode;
}) {
  const { t } = useLanguage();
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useAuth();
    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const menu = document.querySelector(".account-menu");
            if (menu && !menu.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [profileOpen]);
    const title = links.find((link) => link.href === pathname)?.label || (pathname === "/login" ? "Akun" : "Showcase");

    const groups = links.reduce<Record<string, typeof links>>((acc, link) => {
        if (!acc[link.group]) acc[link.group] = [];
        acc[link.group].push(link);
        return acc;
    }, {});
    return <div className="portal">
    <a className="skip-link" href="#portal-content">{t("Lewati ke konten")}</a>
    {open && <button className="nav-backdrop" aria-label={t("Tutup navigasi")} onClick={() => setOpen(false)}/>}
    <aside className={`portal-sidebar ${open ? "is-open" : ""}`} aria-label={t("Navigasi utama")} id="portal-navigation">
      <button className="icon-button drawer-close" aria-label={t("Tutup menu")} onClick={() => setOpen(false)}><X size={17}/></button>
      <Link href="/" className="portal-brand" onClick={() => setOpen(false)}><Image src="/brand.svg" width={34} height={34} alt=""/><span>celimanapp</span></Link>
      <nav>
        {Object.entries(groups).map(([groupId, items]) => (
          <section key={groupId} className="sidebar-section">
            <span className="sidebar-section-label">{t(GROUP_LABELS[groupId] || groupId)}</span>
            {items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`portal-nav-link ${pathname === href ? "active" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon size={20}/><span>{t(label)}</span></Link>
            ))}
          </section>
        ))}
      </nav>
      <div className="sidebar-bottom"><span className="local-indicator"/>{t("File & data, satu tempat")}<small>{t("Ubah. Ringankan. Rapikan.")}</small></div>
    </aside>
    <div className="portal-main" inert={open || undefined}>
      <header className="portal-header">
        <button id="navigation-toggle" className="icon-button mobile-menu" aria-label={open ? t("Tutup navigasi") : t("Buka navigasi")} aria-expanded={open} aria-controls="portal-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        <Link href="/dashboard" className="mobile-portal-brand" aria-label="Dashboard"><Image src="/brand.svg" width={30} height={30} alt=""/><span>celimanapp</span></Link>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/dashboard" aria-label="Dashboard"><Home size={17}/></Link><ChevronRight size={14}/><span>{t(title)}</span></nav>
        <div className="header-actions"><LanguageToggle /><ThemeToggle />
          {user ? (
            <div className="account-menu" onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}>
              <button className="account-trigger" aria-label={user.email || t("Akun")} aria-expanded={profileOpen}><span className="avatar">{ (user.email || "A")[0].toUpperCase() }</span><span className="account-label">{user.email?.split("@")[0] || "Akun"}</span><ChevronRight size={14} className="account-chevron"/></button>
              {profileOpen && (
                <div className="account-dropdown account-dropdown-open">
                  <div className="account-profile-header">
                    <span className="avatar account-profile-avatar">{ (user.email || "A")[0].toUpperCase() }</span>
                    <div className="account-profile-info">
                      <span className="account-profile-name">{user.email?.split("@")[0] || "Pengguna"}</span>
                      <span className="account-profile-email">{user.email}</span>
                    </div>
                  </div>
                  <div className="account-divider"></div>
                  <button className="account-dropdown-item" onClick={() => { setProfileOpen(false); }}><User size={16}/><span>{t("Profil")}</span></button>
                  <button className="account-dropdown-item" onClick={() => { setProfileOpen(false); router.replace("/preferences"); }}><Shield size={16}/><span>{t("Pengaturan Akun")}</span></button>
                  <button className="account-dropdown-item" onClick={() => { setProfileOpen(false); }}><Mail size={16}/><span>{t("Notifikasi")}</span></button>
                  <div className="account-divider"></div>
                  <button className="account-dropdown-item account-dropdown-item-danger" onClick={async () => {
                    try {
                        await signOut({ redirect: false });
                        router.replace("/");
                    } catch {
                        setAuthError("Gagal keluar. Silakan coba lagi.");
                    }
                  }}><LogOut size={16}/>{t("Keluar")}</button>
                </div>
              )}
            </div>
          ) : <Link href="/login" className="account-login" aria-label={t("Masuk")}><span className="avatar"><LogIn size={18}/></span><span>{loading ? t("Memuat…") : t("Masuk")}</span></Link>}
        </div>
      </header>
      {authError && <p className="alert alert-error" role="alert">{t(authError)}</p>}
      <div id="portal-content" className="portal-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}

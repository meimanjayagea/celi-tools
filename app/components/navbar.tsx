"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { createClientSupabase } from "../lib/supabase";

type ThemeId = "light" | "dark" | "ocean" | "forest";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof document === "undefined") return "light";
    const stored = localStorage.getItem("celi-theme") as ThemeId | null;
    if (stored && ["light", "dark", "ocean", "forest"].includes(stored)) {
      return stored;
    }
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr && ["light", "dark", "ocean", "forest"].includes(attr)) {
      return attr as ThemeId;
    }
    return "light";
  });

  const handleThemeChange = useCallback((next: ThemeId) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("celi-theme", next);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClientSupabase();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="topbar" aria-label="Top navigation">
      <div className="brand-area">
        <Link href="/" className="brand" aria-label="Celi Tools home">
          <span className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span>C<span className="brand-accent">E</span>LI<span className="brand-accent">T</span>OOLS</span>
        </Link>
      </div>

      <div className="nav-center">
        <Link href="/" className="nav-link">Home</Link>
        <Link href="/login" className="nav-link">Login</Link>
      </div>

      <div className="nav-actions">
        <div className="theme-picker" role="group" aria-label="Theme">
          <button
            className={`theme-trigger ${theme === "light" ? "theme-active" : ""}`}
            onClick={() => handleThemeChange("light")}
            title="Light theme"
            aria-pressed={theme === "light"}
          >
            ☀️
          </button>
          <button
            className={`theme-trigger ${theme === "dark" ? "theme-active" : ""}`}
            onClick={() => handleThemeChange("dark")}
            title="Dark theme"
            aria-pressed={theme === "dark"}
          >
            🌙
          </button>
        </div>

        {user ? (
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <button
              className="signout-button"
              onClick={handleSignOut}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="login-button">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
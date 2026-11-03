"use client";
import { useLanguage } from "./language-provider";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { THEMES } from "../lib/themes.mjs";
const ThemeContext = createContext<{
    theme: string;
    changeTheme: (value: string) => void;
}>({ theme: "light", changeTheme: () => { } });
export function ThemeProvider({ children }: {
    children: ReactNode;
}) {
    const [theme, setTheme] = useState("light");
    useEffect(() => {
        const sync = () => {
            let value = "light";
            try {
                value = localStorage.getItem("celi-tools:theme") || localStorage.getItem("celi-theme") || "light";
            }
            catch { }
            if (!THEMES.some(item => item.id === value))
                value = "light";
            document.documentElement.dataset.theme = value;
            setTheme(value);
        };
        const timer = setTimeout(sync, 0);
        window.addEventListener("celi:theme", sync);
        window.addEventListener("storage", sync);
        return () => { clearTimeout(timer); window.removeEventListener("celi:theme", sync); window.removeEventListener("storage", sync); };
    }, []);
    const changeTheme = (value: string) => {
        if (!THEMES.some(item => item.id === value))
            return;
        setTheme(value);
        document.documentElement.dataset.theme = value;
        try {
            localStorage.setItem("celi-tools:theme", value);
        }
        catch { }
    };
    return <ThemeContext.Provider value={{ theme, changeTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function ThemeToggle() {
  const { t } = useLanguage();
    const { theme, changeTheme } = useTheme();
    return <div className="theme-switch" role="group" aria-label={t("Tema")}>
    <button type="button" onClick={() => changeTheme("light")} aria-label={t("Tema terang")} aria-pressed={theme === "light"}><Sun size={17}/></button>
    <button type="button" onClick={() => changeTheme("dark")} aria-label={t("Tema gelap")} aria-pressed={theme === "dark"}><Moon size={17}/></button>
  </div>;
}

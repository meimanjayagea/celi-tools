"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate } from "../lib/translations.mjs";

type Language = "id" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (message: string) => string };
const LanguageContext = createContext<LanguageContextValue>({ language: "id", setLanguage: () => {}, t: message => message });

/** Keeps the language preference in this browser and updates the document language. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>("id");
  useEffect(() => {
    const timer = setTimeout(() => {
      try { if (localStorage.getItem("celi-tools:language") === "en") setCurrentLanguage("en"); } catch { /* Browser storage may be unavailable. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((value: Language) => {
    setCurrentLanguage(value);
    try { localStorage.setItem("celi-tools:language", value); } catch { /* The current page still uses the selected language. */ }
  }, []);
  const t = useCallback((message: string) => translate(message, language), [language]);
  const context = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" role="group" aria-label={language === "id" ? "Pilih bahasa" : "Choose language"}>
    <button type="button" onClick={() => setLanguage("id")} aria-label="Bahasa Indonesia" aria-pressed={language === "id"} title="Bahasa Indonesia"><span aria-hidden="true">🇮🇩</span><span>ID</span></button>
    <button type="button" onClick={() => setLanguage("en")} aria-label="English" aria-pressed={language === "en"} title="English"><span aria-hidden="true">🇬🇧</span><span>EN</span></button>
  </div>;
}

"use client";
import { useLanguage } from "../../components/language-provider";
import { THEMES } from "../../lib/themes.mjs";
import { useState } from "react";
import { useTheme } from "../../components/theme-provider";
import { useAppDialog } from "../../components/app-dialog";
import { Check, Monitor, Moon, Sun, Waves, Trees } from "lucide-react";
export default function Preferences() {
  const { t } = useLanguage();
    const { theme, changeTheme } = useTheme();
    const { ask, dialog } = useAppDialog();
    const [message, setMessage] = useState("");
    const icons = [Sun, Moon, Waves, Trees];
    const swatches: Record<string, string[]> = { light: ["#f4f6fb", "#ffffff", "#3166e8"], dark: ["#111827", "#182234", "#86a7ff"], ocean: ["#f0f7fa", "#ffffff", "#087f9c"], forest: ["#f3f8f5", "#ffffff", "#087d59"] };
    return <main className="preferences-page">{dialog}<div className="page-heading"><span className="eyebrow">{t("PERSONALISASI")}</span><h1>{t("Preferensi workspace")}</h1><p>{t("Atur tampilan portal sesuai cara Anda bekerja.")}</p></div><section className="settings-section"><h2>{t("Tampilan")}</h2><p>{t("Pilihan tema berlaku untuk seluruh portal dan disimpan di browser ini.")}</p><div className="theme-options">{THEMES.map((option, i) => { const Icon = icons[i]; return <button key={option.id} className={`theme-option ${theme === option.id ? "selected" : ""}`} aria-pressed={theme === option.id} onClick={() => { changeTheme(option.id); setMessage("Tema berhasil diterapkan."); }}><Icon size={24}/><strong>{t(option.label)}</strong><small>{t(option.description)}</small><span className="theme-swatch-strip" aria-hidden="true">{swatches[option.id].map(color => <i key={color} style={{ backgroundColor: color }}/>)}</span>{theme === option.id && <Check size={17} className="theme-check"/>}</button>; })}</div></section><section className="settings-section"><h2><Monitor size={19}/> {t("Data di browser")}</h2><p>{t("Input JSON terakhir disimpan di browser agar Anda dapat melanjutkan pekerjaan. Password dan input Crypto tidak disimpan oleh portal.")}</p><button className="secondary-button" onClick={async () => {
            const confirmed = await ask({ title: "Hapus input JSON tersimpan?", description: "Input JSON terakhir di browser ini akan dihapus. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Hapus data", destructive: true });
            if (confirmed !== "confirmed") return;
            try {
                localStorage.removeItem("celi-tools:last-json");
                setMessage("Input JSON tersimpan telah dihapus. Editor akan memuat contoh saat dibuka kembali.");
            }
            catch {
                setMessage("Penyimpanan browser tidak tersedia.");
            }
        }}>{t("Hapus input JSON tersimpan")}</button></section><p className="notice-line" role="status">{t(message)}</p></main>;
}

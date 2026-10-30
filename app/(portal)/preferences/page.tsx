"use client";
import { THEMES } from "../../lib/themes.mjs";
import { useState } from "react";
import { useTheme } from "../../components/theme-provider";
import { Check, Monitor, Moon, Sun, Waves, Trees } from "lucide-react";
export default function Preferences() {
    const { theme, changeTheme } = useTheme();
    const [message, setMessage] = useState("");
    const icons = [Sun, Moon, Waves, Trees];
    return <main className="preferences-page"><div className="page-heading"><span className="eyebrow">PERSONALISASI</span><h1>Preferensi workspace</h1><p>Atur tampilan portal sesuai cara Anda bekerja.</p></div><section className="settings-section"><h2>Tampilan</h2><p>Pilihan tema berlaku untuk seluruh portal dan disimpan di browser ini.</p><div className="theme-options">{THEMES.map((option, i) => { const Icon = icons[i]; return <button key={option.id} className={`theme-option ${theme === option.id ? "selected" : ""}`} aria-pressed={theme === option.id} onClick={() => { changeTheme(option.id); setMessage("Tema berhasil diterapkan."); }}><Icon size={24}/><strong>{option.label}</strong><small>{option.description}</small>{theme === option.id && <Check size={17} className="theme-check"/>}</button>; })}</div></section><section className="settings-section"><h2><Monitor size={19}/> Data di browser</h2><p>Input JSON terakhir disimpan di browser agar Anda dapat melanjutkan pekerjaan. Password dan input Crypto tidak disimpan oleh portal.</p><button className="secondary-button" onClick={() => {
            try {
                localStorage.removeItem("celi-tools:last-json");
                setMessage("Input JSON tersimpan telah dihapus. Editor akan memuat contoh saat dibuka kembali.");
            }
            catch {
                setMessage("Penyimpanan browser tidak tersedia.");
            }
        }}>Hapus input JSON tersimpan</button></section><p className="notice-line" role="status">{message}</p></main>;
}

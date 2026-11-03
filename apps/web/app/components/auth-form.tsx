"use client";
import { useLanguage } from "./language-provider";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, CircleAlert, CodeXml, LoaderCircle, LockKeyhole } from "lucide-react";
import { useAuth } from "./auth-provider";
import { safeCallbackUrl } from "../lib/redirect-path";

type AuthStatus = { available: boolean; google: boolean };
const unavailable: AuthStatus = { available: false, google: false };

function AuthFeedback() {
  const { t } = useLanguage();
  const error = useSearchParams().get("error");
  if (!error) return null;
  return <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{t("Proses autentikasi tidak selesai. Coba masuk kembali.")}</span></div>;
}

export default function AuthForm({ callbackUrl: requestedCallbackUrl }: { callbackUrl?: string | string[] }) {
  const { t } = useLanguage();
  const callbackUrl = safeCallbackUrl(requestedCallbackUrl);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);

  useEffect(() => { if (user) router.replace(callbackUrl); }, [user, router, callbackUrl]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? await response.json() as AuthStatus : unavailable)
      .then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(() => { if (!controller.signal.aborted) setStatus(unavailable); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { busy.current = false; setPending(false); } };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const signInWithGoogle = async () => {
    if (!status?.google || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await signIn("google", { redirectTo: callbackUrl });
    } catch {
      setPending(false);
      busy.current = false;
    }
  };

  return <main className="public-auth-page">
    <section className="auth-introduction" aria-labelledby="auth-intro-title">
      <Link href="/" className="auth-back"><ArrowLeft size={16} />{t("Kembali ke beranda")}</Link>
      <div className="auth-intro-copy"><span className="eyebrow">celimanapp WORKSPACE</span><h2 id="auth-intro-title">{t("Lebih rapi datanya.")}<br /><span>{t("Lebih ringan kerjanya.")}</span></h2><p>{t("Konversi dan kompres file, rapikan JSON, serta olah teks. Empat workspace untuk membawa file dan data Anda dari berantakan menjadi siap digunakan.")}</p></div>
      <Image src="/images/workspace-hero.webp" width={500} height={333} alt="" className="auth-illustration" unoptimized />
      <div className="auth-intro-note"><CodeXml size={19} /><span>{t("Satu akun untuk semua workspace.")}<br /><strong>{t("Masuk aman dengan akun Google Anda.")}</strong></span></div>
    </section>
    <section className="auth-form-section" aria-label={t("Login akun")}>
      <div className="auth-form-card">
        <span className="auth-form-icon"><LockKeyhole size={24} /></span>
        <div className="auth-form-heading"><h1>{t("Masuk ke celimanapp")}</h1><p>{t("Gunakan akun Google Anda. Jika ini pertama kalinya, akun celimanapp akan dibuat otomatis.")}</p></div>
        {loading || user ? <div className="auth-session-status" role="status"><LoaderCircle size={19} className="spin" /><p>{user ? t("Membuka workspace Anda…") : t("Memeriksa sesi Anda…")}</p>{user && <Link href={callbackUrl} className="auth-link">{t("Lanjut ke workspace")}</Link>}</div> : <>
          <Suspense fallback={null}><AuthFeedback /></Suspense>
          {status && !status.available && <div className="auth-provider-notice" role="status"><CircleAlert size={17} /><div><p>{t("Login Google belum tersedia saat ini. Hubungi administrator atau coba lagi nanti.")}</p><button type="button" className="auth-link" onClick={() => { setStatus(null); setRefresh(value => value + 1); }}>{t("Periksa lagi")}</button></div></div>}
          {!status && <p className="auth-provider-hint" role="status">{t("Memeriksa layanan autentikasi…")}</p>}
          {status?.google && <button type="button" className="google-auth-button" onClick={signInWithGoogle} disabled={pending} aria-busy={pending}>
            {pending ? <LoaderCircle size={18} className="spin" /> : <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.5v-5.3H5.8a20 20 0 0 0 0 18.1l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.8 14.9l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>}
            {pending ? t("Menghubungkan ke Google…") : t("Lanjutkan dengan Google")}
          </button>}
          {status?.available && <p className="auth-provider-hint">{t("Akun baru dibuat otomatis setelah Anda menyetujui login Google.")}</p>}
        </>}
        <div className="account-form-note"><LockKeyhole size={14} /><p>{t("celimanapp tidak menyimpan kata sandi Google Anda. Autentikasi dilakukan langsung oleh Google.")}</p></div>
      </div>
    </section>
  </main>;
}

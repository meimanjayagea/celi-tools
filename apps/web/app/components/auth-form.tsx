"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Mail, LockKeyhole, LoaderCircle, CodeXml } from "lucide-react";
import { useAuth } from "./auth-provider";
import { safeCallbackUrl } from "../lib/redirect-path";

type Providers = { available: boolean; email: boolean; google: boolean; registration: boolean };
const unavailable: Providers = { available: false, email: false, google: false, registration: false };

function AuthFeedback() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>Proses autentikasi tidak selesai. Coba masuk kembali.</span></div>;
}

export default function AuthForm({ variant, callbackUrl: requestedCallbackUrl }: { variant: "login" | "register"; callbackUrl?: string | string[] }) {
  const registering = variant === "register";
  const callbackUrl = safeCallbackUrl(requestedCallbackUrl);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const coolingDown = cooldown > 0;
  const canRegister = !registering || providers?.registration === true;

  useEffect(() => { if (user) router.replace(callbackUrl); }, [user, router, callbackUrl]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? await response.json() as Providers : unavailable)
      .then(value => { if (!controller.signal.aborted) setProviders(value); })
      .catch(() => { if (!controller.signal.aborted) setProviders(unavailable); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { busy.current = false; setPending(false); } };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!providers?.email || !canRegister || coolingDown || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      const response = await signIn("email", {
        email: email.trim(),
        redirect: false,
        redirectTo: callbackUrl,
      });
      if (!response || response.error) throw new Error(response?.error || "email_request_failed");
      setSuccess(true);
      setCooldown(60);
    } catch {
      setError("Tautan belum dapat dikirim. Tunggu sebentar, periksa alamat email, lalu coba lagi.");
    } finally {
      setPending(false);
      busy.current = false;
    }
  };

  const signInWithGoogle = async () => {
    if (!providers?.google || !canRegister || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await signIn("google", { redirectTo: callbackUrl });
    } catch {
      setError("Login Google tidak dapat dimulai. Coba lagi atau gunakan tautan email.");
      setPending(false);
      busy.current = false;
    }
  };

  return <main className="public-auth-page">
    <section className="auth-introduction" aria-labelledby="auth-intro-title">
      <Link href="/" className="auth-back"><ArrowLeft size={16} />Kembali ke beranda</Link>
      <div className="auth-intro-copy"><span className="eyebrow">CELI TOOLS WORKSPACE</span><h2 id="auth-intro-title">Lebih rapi datanya.<br /><span>Lebih ringan kerjanya.</span></h2><p>Konversi dan kompres file, rapikan JSON, serta olah teks. Empat workspace untuk membawa file dan data Anda dari berantakan menjadi siap digunakan.</p></div>
      <Image src="/images/workspace-hero.png" width={500} height={333} alt="" className="auth-illustration" />
      <div className="auth-intro-note"><CodeXml size={19} /><span>Satu akun untuk semua workspace.<br /><strong>Masuk lebih mudah, tanpa kata sandi.</strong></span></div>
    </section>
    <section className="auth-form-section" aria-label={registering ? "Registrasi akun" : "Login akun"}>
      <div className="auth-form-card">
        <span className="auth-form-icon">{registering ? <Mail size={24} /> : <LockKeyhole size={24} />}</span>
        <div className="auth-form-heading"><h1>{registering ? "Satu akun. Banyak yang beres." : "Selamat datang kembali"}</h1><p>{registering ? "Buat akun dengan Google atau tautan verifikasi email." : "Masuk dengan Google atau tautan aman yang dikirim ke email Anda."}</p></div>
        {loading || user ? <div className="auth-session-status" role="status"><LoaderCircle size={19} className="spin" /><p>{user ? "Membuka workspace Anda…" : "Memeriksa sesi Anda…"}</p>{user && <Link href={callbackUrl} className="auth-link">Lanjut ke workspace</Link>}</div> : <>
          <Suspense fallback={null}><AuthFeedback /></Suspense>
          {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
          {providers && !providers.available && <div className="auth-provider-notice" role="status"><CircleAlert size={17} /><div><p>Layanan akun belum dikonfigurasi. Hubungi administrator atau coba lagi nanti.</p><button type="button" className="auth-link" onClick={() => { setProviders(null); setRefresh(value => value + 1); }}>Periksa lagi</button></div></div>}
          {!providers && <p className="auth-email-explanation" role="status">Memeriksa layanan autentikasi…</p>}
          {providers?.available && !canRegister && <p className="auth-provider-hint" role="status">Pendaftaran akun baru belum tersedia. Jika sudah memiliki akun, silakan <Link href="/login">masuk di sini</Link>.</p>}
          {providers?.google && <button type="button" className="google-auth-button" onClick={signInWithGoogle} disabled={pending || !canRegister} aria-busy={pending}>
            {pending ? <LoaderCircle size={18} className="spin" /> : <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.5v-5.3H5.8a20 20 0 0 0 0 18.1l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.8 14.9l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>}
            {registering ? "Daftar dengan Google" : "Lanjutkan dengan Google"}
          </button>}
          {providers?.email && <>
            {providers.google && <div className="auth-divider"><span>ATAU DENGAN EMAIL</span></div>}
            {!providers.google && <div className="auth-divider"><span>TAUTAN MASUK MELALUI EMAIL</span></div>}
            {success && <div className="auth-email-success" role="status"><span><Check size={19} /></span><div><strong>Periksa email Anda</strong><p>Jika permintaan dapat diproses, tautan masuk akan dikirim. Periksa inbox dan folder spam.</p><small>Tautan berlaku 10 menit dan hanya dapat digunakan sekali.</small></div></div>}
            <form onSubmit={submit} className="account-form" aria-busy={pending}>
              <fieldset disabled={pending}>
                <label htmlFor="auth-email">Alamat email</label>
                <div className="account-input"><Mail size={18} /><input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="nama@contoh.com" spellCheck={false} maxLength={254} /></div>
                <button type="submit" className="primary-button auth-submit" disabled={coolingDown || !providers?.email || !canRegister}>{pending ? <><LoaderCircle size={18} className="spin" />Mengirim tautan…</> : coolingDown ? `Kirim ulang dalam ${cooldown} detik` : <>{success ? "Kirim ulang tautan" : registering ? "Daftar dengan email" : "Kirim tautan masuk"}<ArrowRight size={18} /></>}</button>
              </fieldset>
            </form>
            <p className="auth-email-explanation">{registering ? "Akun dibuat setelah Anda membuka tautan verifikasi dari email." : "Belum memiliki akun? Anda dapat mendaftar menggunakan alamat email yang sama."}</p>
          </>}
          <p className="account-switch">{registering ? "Sudah punya akun?" : "Belum punya akun?"} <Link href={`${registering ? "/login" : "/register"}?callbackUrl=${encodeURIComponent(callbackUrl)}`}>{registering ? "Masuk di sini" : "Daftar sekarang"}</Link></p>
        </>}
        <div className="account-form-note"><LockKeyhole size={14} /><p>Tidak perlu membuat atau mengingat kata sandi. Gunakan email yang dapat Anda akses.</p></div>
      </div>
    </section>
  </main>;
}

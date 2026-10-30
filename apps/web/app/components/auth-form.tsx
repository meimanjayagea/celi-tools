"use client";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Mail, LockKeyhole, LoaderCircle, CodeXml } from "lucide-react";
import { useAuth } from "./auth-provider";
import { createClientSupabase } from "../lib/supabase";
import { authFeedback, googleAuthOptions, emailAuthOptions, authRequestError, isUnknownEmail } from "../lib/auth-tools.mjs";

type Providers = { available: boolean; google: boolean; email: boolean; registration: boolean };
const unavailable: Providers = { available: false, google: false, email: false, registration: false };

function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg>;
}

function AuthFeedback() {
  const code = useSearchParams().get("auth_error");
  return code ? <div className="alert alert-error" role="alert"><CircleAlert size={18}/><span>{authFeedback(code)}</span></div> : null;
}

export default function AuthForm({ variant }: { variant: "login" | "register" }) {
  const registering = variant === "register";
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const coolingDown = cooldown > 0;
  const canRegister = !registering || providers?.registration === true;

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/providers", { cache: "no-store", signal: controller.signal })
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
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { busy.current = false; setPending(null); } };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const begin = (method: "google" | "email") => {
    if (busy.current) return false;
    busy.current = true;
    setPending(method); setError(""); setSuccess(false);
    router.replace(registering ? "/register" : "/login", { scroll: false });
    return true;
  };
  const google = async () => {
    if (!providers?.google || !canRegister || !begin("google")) return;
    try {
      const { data, error: authError } = await createClientSupabase().auth.signInWithOAuth(googleAuthOptions(window.location.origin, variant));
      if (authError) throw authError;
      if (!data.url) throw new Error("OAuth URL missing");
      window.location.assign(data.url);
    } catch (caught) { setError(authRequestError(caught)); setPending(null); busy.current = false; }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!providers?.email || !canRegister || coolingDown || !begin("email")) return;
    try {
      const { error: authError } = await createClientSupabase().auth.signInWithOtp(emailAuthOptions(email, window.location.origin, variant));
      if (authError && !(isUnknownEmail(authError) && !registering)) throw authError;
      setSuccess(true); setCooldown(60);
    } catch (caught) { setError(authRequestError(caught)); }
    finally { setPending(null); busy.current = false; }
  };

  return <main className="public-auth-page">
    <section className="auth-introduction" aria-labelledby="auth-intro-title">
      <Link href="/" className="auth-back"><ArrowLeft size={16}/>Kembali ke beranda</Link>
      <div className="auth-intro-copy"><span className="eyebrow">CELI TOOLS WORKSPACE</span><h2 id="auth-intro-title">Lebih rapi datanya.<br/><span>Lebih ringan kerjanya.</span></h2><p>Konversi dan kompres file, rapikan JSON, serta olah teks. Empat workspace untuk membawa file dan data Anda dari berantakan menjadi siap digunakan.</p></div>
      <Image src="/images/workspace-hero.png" width={500} height={333} alt="" className="auth-illustration"/>
      <div className="auth-intro-note"><CodeXml size={19}/><span>Satu akun untuk semua workspace.<br/><strong>Masuk lebih mudah, tanpa kata sandi.</strong></span></div>
    </section>
    <section className="auth-form-section" aria-label={registering ? "Registrasi akun" : "Login akun"}>
      <div className="auth-form-card">
        <span className="auth-form-icon">{registering ? <Mail size={24}/> : <LockKeyhole size={24}/>}</span>
        <div className="auth-form-heading"><h1>{registering ? "Satu akun. Banyak yang beres." : "Selamat datang kembali"}</h1><p>{registering ? "Buat akun dengan Google atau tautan email. Mulai bekerja tanpa membuat kata sandi." : "Lanjutkan dengan Google atau terima tautan masuk di email Anda."}</p></div>
        {loading || user ? <div className="auth-session-status" role="status"><LoaderCircle size={19} className="spin"/><p>{user ? "Membuka dashboard Anda…" : "Memeriksa sesi Anda…"}</p>{user && <Link href="/dashboard" className="auth-link">Lanjut ke dashboard</Link>}</div> : <>
          <Suspense fallback={null}><AuthFeedback/></Suspense>
          {error && <div className="alert alert-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
          {providers && !providers.available && <div className="auth-provider-notice" role="status"><CircleAlert size={17}/><div><p>Layanan akun sedang belum tersedia. Coba periksa kembali beberapa saat lagi.</p><button type="button" className="auth-link" onClick={() => { setProviders(null); setRefresh(value => value + 1); }}>Periksa lagi</button></div></div>}
          {providers?.available && !canRegister && <p className="auth-provider-hint" role="status">Pendaftaran akun baru belum tersedia. Jika sudah memiliki akun, silakan <Link href="/login">masuk di sini</Link>.</p>}
          <button type="button" className="auth-google-button" disabled={!!pending || !providers?.google || !canRegister} onClick={google}>{pending === "google" ? <LoaderCircle size={19} className="spin"/> : <GoogleIcon/>}{pending === "google" ? "Menghubungkan ke Google…" : "Lanjutkan dengan Google"}</button>
          {!providers && <p className="auth-provider-hint" role="status">Memeriksa pilihan masuk…</p>}
          {providers?.available && !providers.google && <p className="auth-provider-hint">Google belum tersedia. {providers.email ? "Gunakan tautan email di bawah ini." : "Silakan coba kembali nanti."}</p>}
          <div className="auth-divider"><span>ATAU DENGAN EMAIL</span></div>
          {success && <div className="auth-email-success" role="status"><span><Check size={19}/></span><div><strong>Periksa email Anda</strong><p>{registering ? "Jika alamat email dapat digunakan, tautan untuk mengaktifkan akun akan dikirim." : "Jika email terdaftar, tautan masuk akan dikirim. Periksa inbox dan folder spam Anda."}</p><small>Gunakan tautan terbaru. Buka di browser yang sama jika Anda memakai tautan standar.</small></div></div>}
          <form onSubmit={submit} className="account-form" aria-busy={pending === "email"}>
            <fieldset disabled={!!pending || !providers?.email || !canRegister}>
              <label htmlFor="auth-email">Alamat email</label>
              <div className="account-input"><Mail size={18}/><input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="nama@contoh.com" spellCheck={false} maxLength={254}/></div>
              <button type="submit" className="primary-button auth-submit" disabled={coolingDown}>{pending === "email" ? <><LoaderCircle size={18} className="spin"/>Mengirim tautan…</> : coolingDown ? `Kirim ulang dalam ${cooldown} detik` : <>{success ? "Kirim ulang tautan" : registering ? "Daftar dengan email" : "Kirim tautan masuk"}<ArrowRight size={18}/></>}</button>
            </fieldset>
          </form>
          <p className="auth-email-explanation">{registering ? "Akun aktif setelah Anda mengonfirmasi email. Akun Google dibuat saat pertama kali masuk." : "Sudah memiliki akun dengan kata sandi? Gunakan alamat email yang sama untuk masuk lewat tautan."}</p>
          <p className="account-switch">{registering ? "Sudah punya akun?" : "Belum punya akun?"} <Link href={registering ? "/login" : "/register"}>{registering ? "Masuk di sini" : "Daftar sekarang"}</Link></p>
        </>}
        <div className="account-form-note"><LockKeyhole size={14}/><p>Tidak perlu membuat atau mengingat kata sandi. Gunakan email yang dapat Anda akses.</p></div>
      </div>
    </section>
  </main>;
}

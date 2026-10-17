"use client";

import Link from "next/link";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";
import { createClientSupabase } from "../lib/supabase";

type Mode = "password" | "otp" | "signup";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createClientSupabase();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (mode === "password") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        setSuccess("Login berhasil. Mengarahkan ke beranda…");
        setTimeout(() => router.push("/"), 800);
      } else if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Password dan konfirmasi password tidak cocok.");
        }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        setSuccess(
          "Akun berhasil dibuat. Silakan cek email Anda untuk konfirmasi."
        );
      } else if (mode === "otp") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
        });
        if (err) throw err;
        setSuccess(
          "Kode verifikasi telah dikirim ke email Anda. Cek inbox untuk masuk."
        );
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "Terjadi kesalahan. Coba lagi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Masuk ke Celi Tools</h1>
          <p>Jelajahi, format, dan konversi JSON dengan akun Anda.</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {mode === "password" || mode === "signup" ? (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@contoh.com"
              />

              {mode === "password" ? (
                <>
                  <label htmlFor="password">Kata Sandi</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </>
              ) : (
                <>
                  <label htmlFor="password">Kata Sandi</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                  />

                  <label htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@contoh.com"
              />
            </>
          )}

          <button type="submit" className="auth-button primary" disabled={loading}>
            {loading
              ? "Memproses…"
              : mode === "password"
                ? "Masuk"
                : mode === "otp"
                  ? "Kirim kode verifikasi"
                  : "Daftar"}
          </button>
        </form>

        <div className="auth-divider">
          <span>ATAU</span>
        </div>

        {mode !== "otp" && (
          <button
            type="button"
            className="auth-button otp-button"
            onClick={() => {
              setMode("otp");
              clearMessages();
            }}
          >
            Masuk dengan Magic Link (tanpa kata sandi)
          </button>
        )}

        {mode !== "password" && (
          <button
            type="button"
            className="auth-button text-button"
            onClick={() => {
              setMode("password");
              clearMessages();
            }}
          >
            Gunakan email dan kata sandi
          </button>
        )}

        {mode !== "signup" && (
          <p className="auth-footer">
            Belum punya akun?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setMode("signup");
                clearMessages();
              }}
            >
              Daftar sekarang
            </button>
          </p>
        )}

        {mode === "signup" && (
          <p className="auth-footer">
            Sudah punya akun?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setMode("password");
                clearMessages();
              }}
            >
              Masuk di sini
            </button>
          </p>
        )}

        <div className="auth-footer">
          <Link href="/" className="auth-link">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
import type { Metadata } from "next";
import AuthForm from "../../components/auth-form";
export const instant = false;
export const metadata: Metadata = { title: "Daftar — Celi Tools", description: "Buat akun Celi Tools dengan tautan verifikasi email, tanpa kata sandi." };
export default async function Page({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  return <AuthForm key="register" variant="register" callbackUrl={callbackUrl} />;
}

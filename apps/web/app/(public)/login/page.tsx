import type { Metadata } from "next";
import AuthForm from "../../components/auth-form";
export const instant = false;
export const metadata: Metadata = { title: "Masuk — Celi Tools", description: "Masuk ke Celi Tools dengan akun Google Anda." };
export default async function Page({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  return <AuthForm key="login" callbackUrl={callbackUrl} />;
}

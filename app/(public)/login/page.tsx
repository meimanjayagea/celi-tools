import type { Metadata } from "next";
import AuthForm from "../../components/auth-form";
export const metadata: Metadata = { title: "Masuk — Celi Tools", description: "Masuk ke Celi Tools dengan Google atau tautan email, tanpa kata sandi." };
export default function Page() { return <AuthForm key="login" variant="login" />; }

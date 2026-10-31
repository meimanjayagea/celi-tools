import type { Metadata } from "next";
import AuthForm from "../../components/auth-form";
export const metadata: Metadata = { title: "Daftar — Celi Tools", description: "Buat akun Celi Tools dengan tautan verifikasi email, tanpa kata sandi." };
export default function Page() { return <AuthForm key="register" variant="register" />; }

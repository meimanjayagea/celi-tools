import type { Metadata } from "next";
import FileWorkspace from "../../components/file-workspace";
import { requireAuth } from "../../lib/require-auth";
export const metadata: Metadata = { title: "File Compress — Celi Tools", description: "Optimalkan gambar, PDF, media, atau gabungkan berbagai jenis file menjadi arsip." };
export default async function Page() { await requireAuth("/compress"); return <FileWorkspace key="compress" mode="compress" />; }

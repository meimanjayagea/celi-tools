import type { Metadata } from "next";
import FileWorkspace from "../../components/file-workspace";
export const metadata: Metadata = { title: "File Converter — Celi Tools", description: "Konversi gambar, PDF, Office, data, audio, dan video dalam satu workspace." };
export default function Page() { return <FileWorkspace key="convert" mode="convert" />; }

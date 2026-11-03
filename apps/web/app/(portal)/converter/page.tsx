import type { Metadata } from "next";
import FileWorkspace from "../../components/file-workspace";
import { requireAuth } from "../../lib/require-auth";
export const metadata: Metadata = { title: "File Converter — celimanapp", description: "Konversi gambar, PDF, Office, data, audio, dan video dalam satu workspace." };
export default async function Page() { await requireAuth("/converter"); return <FileWorkspace key="convert" mode="convert" />; }

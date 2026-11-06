import type { Metadata } from "next";
import FileWorkspace from "../../components/file-workspace";
export const metadata: Metadata = { title: "File Converter — celimanapp", description: "Konversi gambar, PDF, Office, data, audio, dan video dalam satu workspace." };
export default function Page() { return <FileWorkspace key="convert" mode="convert" />; }

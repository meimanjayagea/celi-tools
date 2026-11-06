import type { Metadata } from "next";
import FileWorkspace from "../../components/file-workspace";
export const metadata: Metadata = { title: "File Compress — celimanapp", description: "Optimalkan gambar, PDF, media, atau gabungkan berbagai jenis file menjadi arsip." };
export default function Page() { return <FileWorkspace key="compress" mode="compress" />; }

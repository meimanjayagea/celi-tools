import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celi Tools",
  description: "Kumpulan tools untuk developer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="flex items-center justify-between border-b bg-white px-6 py-3">
          <Link href="/" className="font-bold">Celi Tools</Link>
          <div className="flex gap-4 text-sm">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/tools/json-beautify">JSON</Link>
            <Link href="/tools/api-docs">API Docs</Link>
            <Link href="/tools/diagram">Diagram</Link>
            <Link href="/profile">Profil</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

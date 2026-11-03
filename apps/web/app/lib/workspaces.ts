import { CodeXml, FileArchive, FileInput, LockKeyhole, StickyNote, Waypoints } from "lucide-react";

export type ToolCategory = "file" | "data" | "security" | "productivity";

const CATEGORY_LABELS: Record<ToolCategory, { label: string; description: string; icon: React.ComponentType<{ size?: number }> }> = {
  file: {
    label: "File Tools",
    description: "Ubah, ringankan, dan susun file Anda dalam satu tempat.",
    icon: FileInput,
  },
  data: {
    label: "Data Tools",
    description: "Rapikan JSON, jelajahi struktur data, dan ekspor ke berbagai format.",
    icon: CodeXml,
  },
  security: {
    label: "Security Tools",
    description: "Enkripsi data, buat hash, dan olah teks dengan aman langsung di browser.",
    icon: LockKeyhole,
  },
  productivity: {
    label: "Productivity Tools",
    description: "Catat ide, kirim request API, dan kelola tugas tanpa berpindah aplikasi.",
    icon: StickyNote,
  },
};

export const WORKSPACES = [
  {
    title: "File Converter",
    href: "/converter",
    category: "file" as ToolCategory,
    icon: FileInput,
    description: "Konversi gambar, PDF, dokumen Office, data, audio, dan video melalui satu alur yang jelas. Tanpa instalasi, langsung di browser.",
    features: ["Gambar, PDF & dokumen Office", "Data, audio & video", "Konversi satu file atau batch"],
    tools: [{ label: "Gambar & PDF", href: "/converter" }, { label: "Dokumen Office", href: "/converter" }, { label: "Audio & Video", href: "/converter" }, { label: "Data & Spreadsheet", href: "/converter" }],
  },
  {
    title: "File Compress",
    href: "/compress",
    category: "file" as ToolCategory,
    icon: FileArchive,
    description: "Perkecil ukuran file atau gabungkan berbagai jenis file dalam arsip. Ukuran hasil transparan sebelum Anda unduh.",
    features: ["ZIP, TAR.GZ, GZIP, BZIP2 & XZ", "Optimasi gambar, PDF, audio & video", "Bandingkan ukuran sebelum dan sesudah"],
    tools: [{ label: "Arsip semua jenis file", href: "/compress" }, { label: "Gambar & PDF", href: "/compress" }, { label: "Audio & Video", href: "/compress" }],
  },
  {
    title: "JSON Workspace",
    href: "/json",
    category: "data" as ToolCategory,
    icon: CodeXml,
    description: "Dari data yang berantakan menjadi struktur yang mudah dipahami. Format, validasi, perbaiki sintaks, lalu ekspor sesuai kebutuhan.",
    features: ["Format, validasi & perbaikan sintaks", "Eksplorasi Tree dan Graph", "Ekspor XML, CSV dan YAML"],
    tools: [{ label: "Format JSON", href: "/json" }, { label: "Tree & Graph", href: "/json?view=tree" }, { label: "JSON ke XML", href: "/json?view=xml" }, { label: "JSON ke CSV", href: "/json?view=csv" }, { label: "JSON ke YAML", href: "/json?view=yaml" }],
  },
  {
    title: "Crypto Tools",
    href: "/crypto",
    category: "security" as ToolCategory,
    icon: LockKeyhole,
    description: "Enkripsi dan dekripsi data, buat hash SHA, atau ubah representasi teks. Semua proses berjalan langsung di browser Anda.",
    features: ["Base64, URL, Hex & Biner", "Hash SHA-256 dan SHA-512", "Enkripsi & dekripsi AES"],
    tools: [{ label: "Base64 Encode", href: "/crypto?tool=base64-encode" }, { label: "Base64 Decode", href: "/crypto?tool=base64-decode" }, { label: "SHA-256", href: "/crypto?tool=sha256" }, { label: "AES Encrypt", href: "/crypto?tool=aes-encrypt" }, { label: "AES Decrypt", href: "/crypto?tool=aes-decrypt" }],
  },
  {
    title: "Sticky Note",
    href: "/sticky-notes",
    category: "productivity" as ToolCategory,
    icon: StickyNote,
    description: "Kumpulkan ide dalam catatan pribadi yang bisa dipindah, diberi warna, tag, dan pengingat melalui notifikasi browser.",
    features: ["Catatan privat tersimpan di akun", "Cari dan filter dengan tag", "Pengingat melalui notifikasi browser"],
    tools: [{ label: "Catatan pribadi", href: "/sticky-notes" }, { label: "Tag dan pencarian", href: "/sticky-notes" }, { label: "Pengingat", href: "/sticky-notes" }],
  },
  {
    title: "API Client",
    href: "/api-client",
    category: "productivity" as ToolCategory,
    icon: Waypoints,
    description: "Kirim request HTTP, atur parameter dan header, lalu baca respons langsung di browser. Impor cURL dan JSON dalam sekali klik.",
    features: ["GET, POST, PUT, DELETE & PATCH", "Impor cURL dan JSON", "Status, waktu dan body respons"],
    tools: [{ label: "Kirim request", href: "/api-client" }, { label: "Impor cURL / JSON", href: "/api-client" }],
  },
];

export { CATEGORY_LABELS };

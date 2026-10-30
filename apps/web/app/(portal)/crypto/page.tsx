import type { Metadata } from "next";
import CryptoTool from "../../components/crypto-tool";

export const metadata: Metadata = {
  title: "Enkripsi & Dekripsi — Celi Tools",
  description: "Enkripsi, dekripsi, hashing, dan encoding data di browser Anda. Data tidak pernah keluar dari perangkat.",
};

export default function CryptoPage() {
  return <CryptoTool />;
}
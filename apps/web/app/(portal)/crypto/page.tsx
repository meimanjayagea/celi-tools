import type { Metadata } from "next";
import CryptoTool from "../../components/crypto-tool";
import { requireAuth } from "../../lib/require-auth";
import { pathWithSearchParams } from "../../lib/redirect-path";

export const metadata: Metadata = {
  title: "Enkripsi & Dekripsi — celimanapp",
  description: "Enkripsi, dekripsi, hashing, dan encoding data di browser Anda. Data tidak pernah keluar dari perangkat.",
};

export default async function CryptoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth(pathWithSearchParams("/crypto", await searchParams));
  return <CryptoTool />;
}

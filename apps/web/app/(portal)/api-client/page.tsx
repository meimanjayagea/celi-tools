import type { Metadata } from "next";
import ApiClient from "../../components/api-client";
import { requireAuth } from "../../lib/require-auth";
import { pathWithSearchParams } from "../../lib/redirect-path";

export const metadata: Metadata = { title: "API Client — celimanapp", description: "Kirim dan periksa request API langsung dari browser." };

export default async function ApiClientPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth(pathWithSearchParams("/api-client", await searchParams));
  return <ApiClient />;
}

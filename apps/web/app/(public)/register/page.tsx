import { redirect } from "next/navigation";
import { pathWithSearchParams, safeCallbackUrl } from "../../lib/redirect-path";
export const instant = false;

export default async function Page({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  redirect(pathWithSearchParams("/login", { callbackUrl: safeCallbackUrl(callbackUrl) }));
}

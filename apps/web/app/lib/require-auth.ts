import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { safeCallbackUrl } from "./redirect-path";

export async function requireAuth(returnTo: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(returnTo))}`);
  }
}

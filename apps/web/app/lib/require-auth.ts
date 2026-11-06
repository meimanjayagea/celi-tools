import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../auth";
import { safeCallbackUrl } from "./redirect-path";

export async function requireAuth(returnTo: string) {
  await connection();
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl(returnTo))}`);
  }
}

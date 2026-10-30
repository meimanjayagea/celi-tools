import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./supabase-config";

/**
 * Route-handler client: request-local session and PKCE verifier, persisted in cookies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
}

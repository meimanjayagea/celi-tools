import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase-config";
let browserClient: SupabaseClient | undefined;

/**
 * Client-side Supabase client (for browser / client components).
 * Use this inside 'use client' components.
 */
export function createClientSupabase(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = supabaseConfig();
    browserClient = createBrowserClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: false } });
  }
  return browserClient;
}

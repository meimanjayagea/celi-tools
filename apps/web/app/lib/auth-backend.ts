import "server-only";
import { NextResponse } from "next/server";
import { completeAuth } from "./auth-tools.mjs";
import { createServerSupabase } from "./supabase-server";
import { supabaseConfig } from "./supabase-config";

export async function authCallbackResponse(request: Request, email = false) {
  const url = new URL(request.url);
  const result = await completeAuth(url.searchParams, createServerSupabase, email);
  const response = NextResponse.redirect(new URL(result.destination, url.origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

type Providers = { available: boolean; google: boolean; email: boolean; registration: boolean };
let cachedProviders: { expires: number; value: Providers } | undefined;
export async function authProviders() {
  if (cachedProviders && cachedProviders.expires > Date.now()) return cachedProviders.value;
  try {
    const { url, key } = supabaseConfig();
    const response = await fetch(url + "/auth/v1/settings", { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Auth settings unavailable");
    const settings = await response.json();
    const value = { available: true, google: settings.external?.google === true, email: settings.external?.email === true, registration: settings.disable_signup !== true };
    cachedProviders = { expires: Date.now() + 30000, value };
    return value;
  } catch {
    const value = { available: false, google: false, email: false, registration: false };
    cachedProviders = { expires: Date.now() + 5000, value };
    return value;
  }
}

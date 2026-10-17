import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client-side Supabase client (for browser / client components).
 * Use this inside 'use client' components.
 */
export function createClientSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
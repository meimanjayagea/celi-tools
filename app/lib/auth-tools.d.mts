import type { SupabaseClient, SignInWithOAuthCredentials, SignInWithPasswordlessCredentials } from "@supabase/supabase-js";
export function googleAuthOptions(origin: string, flow: "login" | "register"): SignInWithOAuthCredentials;
export function emailAuthOptions(email: string, origin: string, flow: "login" | "register"): SignInWithPasswordlessCredentials;
export function safeAuthNext(value: unknown): string;
export function authRedirectUrl(origin: string, flow: "login" | "register", method?: "google" | "email"): string;
export function authFeedback(code: string): string;
export function authRequestError(error: unknown): string;
export function isUnknownEmail(error: unknown): boolean;
export function completeAuth(params: URLSearchParams, getClient: () => Promise<SupabaseClient>, allowEmailToken?: boolean): Promise<{ destination: string; success: boolean }>;

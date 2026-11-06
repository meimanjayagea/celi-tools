import "server-only";
import { lookup } from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderProfile } from "./types";
import { assertNoRedirect, isPublicUnicastAddress, validateHttpsEndpoint } from "./endpoint-safety.mjs";

export type RuntimeProfile = ProviderProfile & { apiKey: string };

export function checkBaseUrl(value: string): URL {
  return validateHttpsEndpoint(value);
}

async function publicPinnedFetch(baseUrl: string): Promise<typeof fetch> {
  const url = checkBaseUrl(baseUrl);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => !isPublicUnicastAddress(address))) throw new Error("Endpoint harus mengarah ke alamat IP publik.");
  const selected = records[0];
  const agent = new Agent({ connect: { lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family) } });
  const pinnedFetch: typeof fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : input.toString());
    if (target.origin !== url.origin) throw new Error("Provider attempted an unexpected endpoint.");
    const response=await undiciFetch(target, { ...init, dispatcher: agent, redirect: "error", headersTimeout: 15_000, bodyTimeout: 30_000 } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
    return assertNoRedirect(response);
  };
  return pinnedFetch;
}

export function providerBaseUrl(provider: RuntimeProfile["provider"], customBaseUrl?: string | null): string {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "anthropic": return "https://api.anthropic.com/v1";
    case "google": return "https://generativelanguage.googleapis.com/v1beta";
    case "groq": return "https://api.groq.com/openai/v1";
    case "xai": return "https://api.x.ai/v1";
    case "openrouter": return "https://openrouter.ai/api/v1";
    case "opencode-zen": return "https://opencode.ai/zen/v1";
    case "hermes":
    case "openai-compatible":
      if (!customBaseUrl) throw new Error("URL provider belum diatur.");
      return checkBaseUrl(customBaseUrl).toString().replace(/\/$/, "");
  }
}

export async function publicFetchForProvider(provider: RuntimeProfile["provider"], customBaseUrl?: string | null) {
  return publicPinnedFetch(providerBaseUrl(provider, customBaseUrl));
}

export async function createProviderModel(profile: RuntimeProfile) {
  const baseURL = providerBaseUrl(profile.provider, profile.baseUrl);
  const fetch = await publicFetchForProvider(profile.provider, profile.baseUrl);
  switch (profile.provider) {
    case "openai": return createOpenAI({ apiKey: profile.apiKey, baseURL, fetch })(profile.modelId);
    case "anthropic": return createAnthropic({ apiKey: profile.apiKey, baseURL, fetch })(profile.modelId);
    case "google": return createGoogle({ apiKey: profile.apiKey, baseURL, fetch })(profile.modelId);
    case "groq":
    case "xai":
    case "openrouter":
    case "opencode-zen":
    case "hermes":
    case "openai-compatible": {
      const provider = createOpenAICompatible({ name: profile.provider, baseURL, apiKey: profile.apiKey, fetch });
      return provider.chatModel(profile.modelId);
    }
  }
}

export function validateProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Konfigurasi tidak valid.");
  const item = input as Record<string, unknown>;
  const providers = ["openai", "anthropic", "google", "groq", "xai", "openrouter", "opencode-zen", "hermes", "openai-compatible"];
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 80) throw new Error("Nama profil harus 1–80 karakter.");
  if (!providers.includes(String(item.provider))) throw new Error("Provider tidak didukung.");
  if (typeof item.modelId !== "string" || !/^[a-zA-Z0-9._:/-]{1,160}$/.test(item.modelId)) throw new Error("ID model tidak valid.");
  if (item.id !== undefined && (typeof item.id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.id))) throw new Error("ID profil tidak valid.");
  if (item.apiKey !== undefined && (typeof item.apiKey !== "string" || item.apiKey.length > 4096)) throw new Error("API key tidak valid.");
  if (item.isActive !== undefined && typeof item.isActive !== "boolean") throw new Error("Status aktif tidak valid.");
  let baseUrl: string | undefined;
  if (item.provider === "openai-compatible" || item.provider === "hermes") {
    if (typeof item.baseUrl !== "string") throw new Error("URL endpoint wajib diisi.");
    baseUrl = checkBaseUrl(item.baseUrl).toString();
  }
  if (item.fallbackOrder !== undefined && (!Number.isInteger(item.fallbackOrder) || Number(item.fallbackOrder) < 0 || Number(item.fallbackOrder) > 1000)) throw new Error("Urutan fallback tidak valid.");
  return { id: item.id as string | undefined, name: item.name.trim(), provider: item.provider as RuntimeProfile["provider"], modelId: item.modelId, baseUrl, apiKey: item.apiKey as string | undefined, isActive: item.isActive === true, fallbackOrder: item.fallbackOrder as number | undefined };
}

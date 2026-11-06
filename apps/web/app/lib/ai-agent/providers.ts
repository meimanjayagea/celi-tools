import "server-only";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderProfile } from "./types";

export type RuntimeProfile = ProviderProfile & { apiKey: string };

function checkBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) throw new Error("Endpoint harus HTTPS publik pada port standar.");
  return url;
}

async function publicPinnedFetch(baseUrl: string): Promise<typeof fetch> {
  const url = checkBaseUrl(baseUrl);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => {
    try { return ipaddr.process(address).range() !== "unicast"; } catch { return true; }
  })) throw new Error("Endpoint harus mengarah ke alamat IP publik.");
  const selected = records[0];
  const agent = new Agent({ connect: { lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family) } });
  const pinnedFetch: typeof fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : input.toString());
    if (target.origin !== url.origin) throw new Error("Provider attempted an unexpected endpoint.");
    return undiciFetch(target, { ...init, dispatcher: agent, redirect: "error", headersTimeout: 15_000, bodyTimeout: 30_000 } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
  };
  return pinnedFetch;
}

export async function createProviderModel(profile: RuntimeProfile) {
  switch (profile.provider) {
    case "openai": return createOpenAI({ apiKey: profile.apiKey })(profile.modelId);
    case "anthropic": return createAnthropic({ apiKey: profile.apiKey })(profile.modelId);
    case "google": return createGoogle({ apiKey: profile.apiKey })(profile.modelId);
    case "openai-compatible": {
      if (!profile.baseUrl) throw new Error("URL provider belum diatur.");
      const baseURL = checkBaseUrl(profile.baseUrl).toString().replace(/\/$/, "");
      const fetch = await publicPinnedFetch(baseURL);
      const provider = createOpenAICompatible({ name: "custom-provider", baseURL, apiKey: profile.apiKey, fetch });
      return provider.chatModel(profile.modelId);
    }
  }
}

export function validateProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Konfigurasi tidak valid.");
  const item = input as Record<string, unknown>;
  const providers = ["openai", "anthropic", "google", "openai-compatible"];
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 80) throw new Error("Nama profil harus 1–80 karakter.");
  if (!providers.includes(String(item.provider))) throw new Error("Provider tidak didukung.");
  if (typeof item.modelId !== "string" || !/^[a-zA-Z0-9._:/-]{1,160}$/.test(item.modelId)) throw new Error("ID model tidak valid.");
  if (item.id !== undefined && (typeof item.id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.id))) throw new Error("ID profil tidak valid.");
  if (item.apiKey !== undefined && (typeof item.apiKey !== "string" || item.apiKey.length > 4096)) throw new Error("API key tidak valid.");
  if (item.isActive !== undefined && typeof item.isActive !== "boolean") throw new Error("Status aktif tidak valid.");
  let baseUrl: string | undefined;
  if (item.provider === "openai-compatible") {
    if (typeof item.baseUrl !== "string") throw new Error("URL endpoint wajib diisi.");
    baseUrl = checkBaseUrl(item.baseUrl).toString();
  }
  return { id: item.id as string | undefined, name: item.name.trim(), provider: item.provider as RuntimeProfile["provider"], modelId: item.modelId, baseUrl, apiKey: item.apiKey as string | undefined, isActive: item.isActive === true };
}

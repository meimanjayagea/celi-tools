import "server-only";
import type { AiProvider } from "./types";
import { publicFetchForProvider, providerBaseUrl } from "./providers";
import { normalizeProviderModels, safeModelCatalogError } from "./catalog-normalize.mjs";
import { fetchCatalogPage } from "./catalog-http.mjs";

export type CatalogInput = { provider:AiProvider; apiKey:string; baseUrl?:string };

function nextPage(provider:AiProvider, payload:unknown):string|undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const item = payload as Record<string,unknown>;
  if (provider === "google" && typeof item.nextPageToken === "string") return item.nextPageToken;
  if ((provider === "openai" || provider === "anthropic") && item.has_more === true && Array.isArray(item.data)) {
    const last = item.data.at(-1) as { id?:unknown } | undefined;
    const cursor=provider==="anthropic"?item.last_id:last?.id;
    return typeof cursor === "string" ? cursor : undefined;
  }
  return undefined;
}

export async function fetchProviderModels(input:CatalogInput, fetchOverride?:typeof fetch):Promise<Array<{id:string;name:string}>> {
  if (!input.apiKey || input.apiKey.length > 4096) throw safeModelCatalogError();
  const baseUrl = providerBaseUrl(input.provider, input.baseUrl);
  const fetcher = fetchOverride ?? await publicFetchForProvider(input.provider, input.baseUrl);
  try {
    const models = new Map<string,{id:string;name:string}>();
    let token:string|undefined;
    for (let page=0; page<3 && models.size<200; page++) {
      const payload = await fetchCatalogPage({provider:input.provider,baseUrl,apiKey:input.apiKey,pageToken:token,fetchImpl:fetcher});
      for (const model of normalizeProviderModels(input.provider,payload)) {
        models.set(model.id,model);
        if (models.size>=200) break;
      }
      token=nextPage(input.provider,payload);
      if (!token) break;
    }
    return [...models.values()];
  } catch {
    throw safeModelCatalogError();
  }
}

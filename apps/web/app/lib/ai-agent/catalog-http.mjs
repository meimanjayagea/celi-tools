import { assertNoRedirect } from "./endpoint-safety.mjs";
import { readBoundedJson, safeModelCatalogError } from "./catalog-normalize.mjs";

export function providerCatalogUrl(provider, baseUrl, pageToken) {
  const url=new URL(`${baseUrl.replace(/\/$/,"")}/${provider==="xai"?"language-models":"models"}`);
  if(provider==="google"&&pageToken)url.searchParams.set("pageToken",pageToken);
  if(provider==="openai")url.searchParams.set("limit","200");
  if(provider==="anthropic") {
    url.searchParams.set("limit","100");
    if(pageToken)url.searchParams.set("after_id",pageToken);
  }
  if(provider==="openrouter")url.searchParams.set("output_modalities","text");
  if(pageToken&&provider!=="google"&&provider!=="anthropic")url.searchParams.set("after",pageToken);
  return url;
}

export function providerCatalogHeaders(provider,apiKey) {
  const headers=new Headers({Accept:"application/json"});
  if(provider==="anthropic") {
    headers.set("x-api-key",apiKey);
    headers.set("anthropic-version","2023-06-01");
  } else if(provider==="google") {
    headers.set("x-goog-api-key",apiKey);
  } else headers.set("Authorization",`Bearer ${apiKey}`);
  return headers;
}

export async function fetchCatalogPage({provider,baseUrl,apiKey,pageToken,fetchImpl=fetch,signal}) {
  try {
    const response=await fetchImpl(providerCatalogUrl(provider,baseUrl,pageToken),{
      method:"GET",
      headers:providerCatalogHeaders(provider,apiKey),
      redirect:"error",
      signal:signal??AbortSignal.timeout(12_000),
    });
    assertNoRedirect(response);
    if(!response.ok)throw safeModelCatalogError();
    return await readBoundedJson(response);
  } catch {
    throw safeModelCatalogError();
  }
}

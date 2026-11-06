const maxModels = 200;
const unsupported = /(?:embed|embedding|moderation|rerank|whisper|speech|audio|tts|transcri|image-gen|image_generation|gpt-image|imagen|dall-e|grok-imagine)/i;
const safePart = (value, limit) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit) : "";

export function normalizeProviderModels(provider, payload) {
  const source = provider === "google" ? payload?.models : (payload?.data ?? payload?.models);
  if (!Array.isArray(source)) return [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const rawId = item.id ?? item.name;
    const id = safePart(rawId, 160).replace(/^models\//, "");
    if (!id || !/^[a-zA-Z0-9._:/-]+$/.test(id) || unsupported.test(id)) continue;
    if (provider === "google" && Array.isArray(item.supportedGenerationMethods)
      && !item.supportedGenerationMethods.some((method) => String(method).toLowerCase() === "generatecontent")) continue;
    const inputModalities=item.input_modalities ?? item.architecture?.input_modalities;
    const outputModalities=item.output_modalities ?? item.architecture?.output_modalities;
    if (Array.isArray(inputModalities) && !inputModalities.some((modality)=>String(modality).toLowerCase()==="text")) continue;
    if (Array.isArray(outputModalities) && !outputModalities.some((modality)=>String(modality).toLowerCase()==="text")) continue;
    const modality = item.architecture?.modality;
    if (typeof modality === "string" && !/->[^ ]*text$/i.test(modality)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const name = safePart(item.display_name ?? item.displayName ?? item.name ?? item.id ?? id, 120) || id;
    result.push({ id, name });
    if (result.length >= maxModels) break;
  }
  return result;
}

export function safeModelCatalogError() {
  return new Error("Daftar model tidak dapat dimuat. Periksa API key, endpoint, dan akses provider.");
}

export async function readBoundedJson(response, maxBytes = 1_000_000) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw safeModelCatalogError();
  const reader = response.body?.getReader();
  if (!reader) throw safeModelCatalogError();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw safeModelCatalogError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw safeModelCatalogError();
  }
}

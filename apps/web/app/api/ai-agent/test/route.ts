import { createHash } from "node:crypto";
import { generateText } from "ai";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { isAiAgentAdmin } from "../../../lib/ai-agent/admin";
import { aiJson, hasSameOrigin, readAiJson, recordAiRequest } from "../../../lib/ai-agent/http";
import { testProfileSecret } from "../../../lib/ai-agent/repository";
import { createProviderModel } from "../../../lib/ai-agent/providers";

function upstreamStatus(error: unknown): number | undefined {
  const queue: unknown[] = [error];
  const seen = new Set<object>();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const item = value as Record<string, unknown>;
    for (const candidate of [item.statusCode, item.status, (item.response as { status?: unknown } | undefined)?.status]) {
      if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599) return candidate;
    }
    if (item.cause && typeof item.cause === "object") queue.push(item.cause);
    if (item.response && typeof item.response === "object") queue.push(item.response);
  }
  return undefined;
}

function safeProviderError(provider: string | undefined, status: number | undefined): string {
  if (provider === "openrouter" && status === 502) return "OpenRouter mengembalikan HTTP 502 (Bad Gateway). Jalur model yang dipilih tidak menghasilkan respons. Coba model lain dan periksa Activity OpenRouter untuk detail provider tujuan.";
  if (provider === "openrouter" && status === 402) return "OpenRouter mengembalikan HTTP 402. Periksa saldo kredit atau batas penggunaan akun OpenRouter.";
  if (provider === "openrouter" && status === 401) return "OpenRouter menolak API key (HTTP 401). Pastikan key masih aktif dan memiliki izin inference.";
  if (provider === "openrouter" && status === 403) return "OpenRouter menolak akses (HTTP 403). Periksa izin key, model, dan batasan akun.";
  if (provider === "openrouter" && status === 404) return "Model atau endpoint tidak ditemukan di OpenRouter (HTTP 404). Ambil daftar model terbaru lalu pilih kembali modelnya.";
  if (provider === "openrouter" && status === 429) return "Batas atau kuota OpenRouter tercapai (HTTP 429). Periksa kredit dan limit akun sebelum mencoba lagi.";
  if (provider === "openrouter" && status !== undefined && status >= 500) return `OpenRouter mengembalikan HTTP ${status}. Gangguan sementara pada gateway atau jalur model; coba model lain atau ulangi nanti.`;
  if (status !== undefined) return `Provider mengembalikan HTTP ${status}. Periksa API key, model, dan akses provider.`;
  return "Provider tidak merespons. Periksa API key, model, endpoint, dan koneksi provider.";
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  let provider: string | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id || !isAiAgentAdmin(session.user.email)) return aiJson({ error:"Akses admin diperlukan." }, 403);
    if (!pool) return aiJson({ error:"Layanan provider AI belum tersedia." }, 503);
    const limitKey = createHash("sha256").update(`ai-provider-test:${session.user.id}`).digest("hex");
    if (!(await recordAiRequest(pool, limitKey, 5)).rowCount) return aiJson({ error:"Batas pengujian tercapai. Coba lagi dalam satu menit." }, 429);
    const body = await readAiJson(request, 2000) as { id?:unknown };
    if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return aiJson({ error:"ID profil tidak valid." }, 400);
    const profile = await testProfileSecret(body.id);
    provider = profile.provider;
    const model = await createProviderModel(profile);
    const result = await generateText({ model, prompt:"Reply with exactly: celimanapp connection ok", maxOutputTokens:24, abortSignal:AbortSignal.timeout(20_000) });
    return aiJson({ ok:Boolean(result.text.trim()) });
  } catch (error) { return aiJson({ error:safeProviderError(provider,upstreamStatus(error)) }, 502); }
}

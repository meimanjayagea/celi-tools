import { createHash } from "node:crypto";
import { generateText } from "ai";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { isAiAgentAdmin } from "../../../lib/ai-agent/admin";
import { aiJson, hasSameOrigin, readAiJson, recordAiRequest } from "../../../lib/ai-agent/http";
import { testProfileSecret } from "../../../lib/ai-agent/repository";
import { createProviderModel } from "../../../lib/ai-agent/providers";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  try {
    const session = await auth();
    if (!session?.user?.id || !isAiAgentAdmin(session.user.email)) return aiJson({ error:"Akses admin diperlukan." }, 403);
    if (!pool) return aiJson({ error:"Layanan provider AI belum tersedia." }, 503);
    const limitKey = createHash("sha256").update(`ai-provider-test:${session.user.id}`).digest("hex");
    if (!(await recordAiRequest(pool, limitKey, 5)).rowCount) return aiJson({ error:"Batas pengujian tercapai. Coba lagi dalam satu menit." }, 429);
    const body = await readAiJson(request, 2000) as { id?:unknown };
    if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return aiJson({ error:"ID profil tidak valid." }, 400);
    const profile = await testProfileSecret(body.id);
    const model = await createProviderModel(profile);
    const result = await generateText({ model, prompt:"Reply with exactly: celimanapp connection ok", maxOutputTokens:24, abortSignal:AbortSignal.timeout(20_000) });
    return aiJson({ ok:Boolean(result.text.trim()) });
  } catch { return aiJson({ error:"Provider tidak merespons. Periksa model, API key, endpoint, dan koneksi provider." }, 502); }
}

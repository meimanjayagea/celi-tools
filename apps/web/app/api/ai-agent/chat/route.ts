import { createHash } from "node:crypto";
import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { HELP_INSTRUCTIONS } from "../../../lib/ai-agent/help-context";
import { aiJson, aiHeaders, hasSameOrigin, readAiJson, recordAiRequest } from "../../../lib/ai-agent/http";
import { getActiveProviderProfile } from "../../../lib/ai-agent/repository";
import { createProviderModel } from "../../../lib/ai-agent/providers";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  let session;
  try { session = await auth(); } catch { return aiJson({ error:"Autentikasi belum tersedia." }, 503); }
  if (!session?.user?.id) return aiJson({ error:"Silakan masuk terlebih dahulu." }, 401);
  if (!pool) return aiJson({ error:"Layanan bantuan AI belum tersedia." }, 503);
  let body: unknown;
  try { body = await readAiJson(request, 40_000); } catch { return aiJson({ error:"Pesan tidak valid atau terlalu besar." }, 400); }
  const messages = (body as { messages?:unknown })?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 12) return aiJson({ error:"Percakapan harus berisi 1–12 pesan terakhir." }, 400);
  const safeMessages: Array<{ role:"user"|"assistant"; content:string }> = [];
  let total = 0;
  for (const message of messages) {
    if (!message || !["user","assistant"].includes(message.role) || !Array.isArray(message.parts)) return aiJson({ error:"Format pesan tidak valid." }, 400);
    const text = message.parts.filter((part: { type?:string }) => part?.type === "text").map((part: { text?:unknown }) => typeof part.text === "string" ? part.text : "").join("");
    if (text.length > 4000) return aiJson({ error:"Satu pesan maksimal 4.000 karakter." }, 413);
    total += text.length;
    if (total > 12_000) return aiJson({ error:"Riwayat pesan terlalu panjang." }, 413);
    if (text.trim()) safeMessages.push({ role:message.role, content:text });
  }
  if (!safeMessages.length || safeMessages[safeMessages.length-1].role !== "user") return aiJson({ error:"Kirim pesan untuk memulai percakapan." }, 400);
  try {
    const key = createHash("sha256").update(`ai-help:${session.user.id}`).digest("hex");
    if (!(await recordAiRequest(pool, key, 10)).rowCount) return aiJson({ error:"Batas penggunaan tercapai. Coba lagi dalam satu menit." }, 429);
  } catch { return aiJson({ error:"Pembatas layanan bantuan AI belum tersedia." }, 503); }
  try {
    const profile = await getActiveProviderProfile();
    if (!profile) return aiJson({ error:"Bantuan AI belum dikonfigurasi. Hubungi administrator." }, 503);
    const model = await createProviderModel(profile);
    const result = streamText({ model, system:HELP_INSTRUCTIONS, messages:safeMessages, maxOutputTokens:800, abortSignal:request.signal });
    return createUIMessageStreamResponse({ stream:toUIMessageStream({ stream:result.stream }), headers:aiHeaders });
  } catch { return aiJson({ error:"Bantuan AI sementara tidak tersedia. Coba lagi nanti." }, 502);
  }
}

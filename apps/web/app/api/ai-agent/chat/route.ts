import { createHash, randomUUID } from "node:crypto";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { HELP_INSTRUCTIONS } from "../../../lib/ai-agent/help-context";
import { selectAiHelpSkill } from "../../../lib/ai-agent/skills";
import { aiJson, aiHeaders, hasSameOrigin, readAiJson, recordAiRequest } from "../../../lib/ai-agent/http";
import { appendAiHelpMemory, getAiHelpMemory, listEnabledProviderProfiles } from "../../../lib/ai-agent/repository";
import { createProviderTextStream, type RuntimeProviderProfile } from "../../../lib/ai-agent/failover";
import { uiStreamWithFallback } from "../../../lib/ai-agent/ui-stream.mjs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  let session;
  try { session = await auth(); } catch { return aiJson({ error:"Autentikasi belum tersedia." }, 503); }
  if (!session?.user?.id) return aiJson({ error:"Silakan masuk terlebih dahulu." }, 401);
  if (!pool) return aiJson({ error:"Layanan bantuan AI belum tersedia." }, 503);
  let body: unknown;
  try { body = await readAiJson(request, 40_000); } catch { return aiJson({ error:"Pesan tidak valid atau terlalu besar." }, 400); }
  const messages = (body as { messages?:unknown })?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 25) return aiJson({ error:"Percakapan terlalu panjang." }, 400);
  const lastMessage=messages[messages.length-1];
  if (!lastMessage || lastMessage.role!=="user" || !Array.isArray(lastMessage.parts)) return aiJson({ error:"Kirim pesan untuk memulai percakapan." },400);
  const userText=lastMessage.parts.filter((part:{type?:string})=>part?.type==="text").map((part:{text?:unknown})=>typeof part.text==="string"?part.text:"").join("").trim();
  if (!userText) return aiJson({ error:"Pesan tidak boleh kosong." },400);
  if (userText.length>4000) return aiJson({ error:"Satu pesan maksimal 4.000 karakter." },413);
  try {
    const key = createHash("sha256").update(`ai-help:${session.user.id}`).digest("hex");
    if (!(await recordAiRequest(pool, key, 10)).rowCount) return aiJson({ error:"Batas penggunaan tercapai. Coba lagi dalam satu menit." }, 429);
  } catch { return aiJson({ error:"Pembatas layanan bantuan AI belum tersedia." }, 503); }
  try {
    const [profiles,storedMemory] = await Promise.all([listEnabledProviderProfiles(),getAiHelpMemory(session.user.id)]);
    if (!profiles.length) return aiJson({ error:"Bantuan AI belum dikonfigurasi. Hubungi administrator." }, 503);
    const safeStoredMemory=storedMemory.filter((message)=>message.content.length<=4000).slice(-23);
    const userMessageId=randomUUID();
    const userMessage={id:userMessageId,role:"user" as const,content:userText,createdAt:new Date().toISOString()};
    const context=[...safeStoredMemory,userMessage];
    let contextLength=0;
    const boundedContext=context.reverse().filter((message)=>{if(contextLength+message.content.length>12_000)return false;contextLength+=message.content.length;return true;}).reverse();
    const safeMessages=boundedContext.map(({role,content})=>({role,content}));
    const skill=selectAiHelpSkill(userText);
    const system=skill?`${HELP_INSTRUCTIONS}\n\n${skill.instruction}`:HELP_INSTRUCTIONS;
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(42_000)]);
    const stream=createUIMessageStream<UIMessage>({
      execute:async({writer})=>uiStreamWithFallback({writer,profiles,signal,createStream:(profile)=>createProviderTextStream(profile as RuntimeProviderProfile,safeMessages,system,signal),onComplete:async({id,text})=>{try{await appendAiHelpMemory(session.user!.id!,[userMessage,{id,role:"assistant",content:text,createdAt:new Date().toISOString()}]);}catch{/* Keep the streamed answer available if memory persistence is temporarily unavailable. */}}}),
      onError:()=>"Bantuan AI sementara tidak tersedia. Coba lagi nanti.",
    });
    return createUIMessageStreamResponse({ stream, headers:aiHeaders });
  } catch { return aiJson({ error:"Bantuan AI sementara tidak tersedia. Coba lagi nanti." }, 502);
  }
}

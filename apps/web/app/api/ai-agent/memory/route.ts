import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { aiJson, hasSameOrigin } from "../../../lib/ai-agent/http";
import { clearAiHelpMemory, getAiHelpMemory } from "../../../lib/ai-agent/repository";

export async function GET() {
  try {
    const session=await auth();
    if (!session?.user?.id) return aiJson({ error:"Silakan masuk terlebih dahulu." },401);
    if (!pool) return aiJson({ error:"Penyimpanan konteks chat belum tersedia." },503);
    const messages=await getAiHelpMemory(session.user.id);
    return aiJson({ messages });
  } catch { return aiJson({ error:"Konteks chat belum dapat dimuat." },503); }
}

export async function DELETE(request:Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." },403);
  try {
    const session=await auth();
    if (!session?.user?.id) return aiJson({ error:"Silakan masuk terlebih dahulu." },401);
    if (!pool) return aiJson({ error:"Penyimpanan konteks chat belum tersedia." },503);
    await clearAiHelpMemory(session.user.id);
    return aiJson({ ok:true });
  } catch { return aiJson({ error:"Konteks chat belum dapat dihapus." },503); }
}

import { createHash } from "node:crypto";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { isAiAgentAdmin } from "../../../lib/ai-agent/admin";
import { aiJson, hasSameOrigin, readAiJson, recordAiRequest } from "../../../lib/ai-agent/http";
import { fetchProviderModels } from "../../../lib/ai-agent/catalog";
import { testProfileSecret } from "../../../lib/ai-agent/repository";
import { validateProfile } from "../../../lib/ai-agent/providers";

export async function POST(request:Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." },403);
  try {
    const session=await auth();
    if (!session?.user?.id || !isAiAgentAdmin(session.user.email)) return aiJson({ error:"Akses admin diperlukan." },403);
    if (!pool) return aiJson({ error:"Layanan katalog model belum tersedia." },503);
    const key=createHash("sha256").update(`ai-model-catalog:${session.user.id}`).digest("hex");
    if (!(await recordAiRequest(pool,key,20)).rowCount) return aiJson({ error:"Batas permintaan model tercapai. Coba lagi sebentar." },429);
    const body=await readAiJson(request,8_000) as Record<string,unknown>;
    let profile;
    if (body.profileId !== undefined) {
      if (typeof body.profileId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.profileId)) return aiJson({error:"ID profil tidak valid."},400);
      profile=await testProfileSecret(body.profileId);
    } else {
      const candidate=validateProfile({
        name:"Katalog model",
        provider:body.provider,
        modelId:"catalog-probe",
        baseUrl:body.baseUrl,
        apiKey:body.apiKey,
        isActive:false,
      });
      if (!candidate.apiKey) return aiJson({ error:"API key wajib diisi untuk memuat model." },400);
      profile={ ...candidate, apiKey:candidate.apiKey };
    }
    const models=await fetchProviderModels({provider:profile.provider,apiKey:profile.apiKey,baseUrl:profile.baseUrl ?? undefined});
    return aiJson({ models });
  } catch (error) {
    const invalidInput=error instanceof Error && /wajib|valid|endpoint|URL|aktifkan|tidak didukung/i.test(error.message);
    const message=invalidInput
      ? error.message
      : "Daftar model tidak dapat dimuat. Periksa API key, endpoint, dan akses provider.";
    return aiJson({ error:message },invalidInput?400:502);
  }
}

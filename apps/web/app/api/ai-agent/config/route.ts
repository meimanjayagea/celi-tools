import { auth } from "../../../../auth";
import { isAiAgentAdmin } from "../../../lib/ai-agent/admin";
import { aiJson, hasSameOrigin, readAiJson } from "../../../lib/ai-agent/http";
import { deleteProviderProfile, listProviderProfiles, reorderProviderProfiles, saveProviderProfile, saveProviderProfiles } from "../../../lib/ai-agent/repository";
import { validateProfile } from "../../../lib/ai-agent/providers";

async function authorize() {
  const session = await auth();
  return Boolean(session?.user?.id && isAiAgentAdmin(session.user.email));
}

export async function GET() {
  try {
    if (!await authorize()) return aiJson({ error:"Akses admin diperlukan." }, 403);
    return aiJson({ profiles:await listProviderProfiles(), encryptionReady:Boolean(process.env.AI_AGENT_CREDENTIALS_ENCRYPTION_KEY) });
  } catch { return aiJson({ error:"Konfigurasi AI belum tersedia. Periksa database dan environment." }, 503); }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  try {
    if (!await authorize()) return aiJson({ error:"Akses admin diperlukan." }, 403);
    const raw = await readAiJson(request, 12_000) as {action?:unknown;profileIds?:unknown;modelIds?:unknown;[key:string]:unknown};
    if (raw?.action === "reorder") {
      if (!Array.isArray(raw.profileIds) || raw.profileIds.length>100 || raw.profileIds.some((id)=>typeof id!=="string")) return aiJson({error:"Urutan provider tidak valid."},400);
      await reorderProviderProfiles(raw.profileIds as string[]);
      return aiJson({ok:true});
    }
    if (raw?.modelIds !== undefined) {
      if (raw.id !== undefined || !Array.isArray(raw.modelIds) || raw.modelIds.length < 1 || raw.modelIds.length > 20 || raw.modelIds.some((id) => typeof id !== "string") || new Set(raw.modelIds).size !== raw.modelIds.length) {
        return aiJson({error:"Pilih 1–20 model yang berbeda."},400);
      }
      const inputs = (raw.modelIds as string[]).map((modelId) => validateProfile({...raw,modelIds:undefined,modelId}));
      const profiles = await saveProviderProfiles(inputs);
      return aiJson({profiles});
    }
    const input = validateProfile(raw);
    return aiJson({ profile:await saveProviderProfile(input) });
  } catch (error) {
    const message = error instanceof Error && /karakter|wajib|valid|key|aktif|tidak ditemukan|endpoint/i.test(error.message) ? error.message : "Konfigurasi tidak dapat disimpan. Periksa database dan kunci enkripsi.";
    return aiJson({ error:message }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) return aiJson({ error:"Permintaan tidak diizinkan." }, 403);
  try {
    if (!await authorize()) return aiJson({ error:"Akses admin diperlukan." }, 403);
    const body = await readAiJson(request, 2000) as { id?:unknown };
    if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return aiJson({ error:"ID profil tidak valid." }, 400);
    await deleteProviderProfile(body.id);
    return aiJson({ ok:true });
  } catch { return aiJson({ error:"Profil tidak dapat dihapus." }, 503); }
}

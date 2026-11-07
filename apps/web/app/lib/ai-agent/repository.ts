import "server-only";
import { pool } from "../database";
import { decryptAiHelpMemory, decryptProviderKey, encryptAiHelpMemory, encryptProviderKey } from "./credentials";
import type { AiProvider, EncryptedSecret, ProviderProfile, SaveProfileInput, StoredProfile } from "./types";

type Row = { id:string; name:string; provider:AiProvider; model_id:string; base_url:string|null; api_key_ciphertext:Buffer|null; api_key_nonce:Buffer|null; api_key_tag:Buffer|null; encryption_version:1|null; is_active:boolean; fallback_order:number; created_at:Date; updated_at:Date };
export type AiHelpMessage = { id:string; role:"user"|"assistant"; content:string; createdAt:string };
const safe = (row: Row): StoredProfile => ({ id:row.id, name:row.name, provider:row.provider, modelId:row.model_id, baseUrl:row.base_url, isActive:row.is_active, fallbackOrder:row.fallback_order, hasApiKey:Boolean(row.api_key_ciphertext), createdAt:row.created_at.toISOString(), updatedAt:row.updated_at.toISOString(), secret:row.api_key_ciphertext ? { ciphertext:row.api_key_ciphertext, nonce:row.api_key_nonce!, tag:row.api_key_tag!, version:row.encryption_version! } : null });
const visible = (stored: StoredProfile): ProviderProfile => ({ id:stored.id, name:stored.name, provider:stored.provider, modelId:stored.modelId, baseUrl:stored.baseUrl, isActive:stored.isActive, fallbackOrder:stored.fallbackOrder, hasApiKey:stored.hasApiKey, createdAt:stored.createdAt, updatedAt:stored.updatedAt });

export async function listProviderProfiles(): Promise<ProviderProfile[]> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles ORDER BY fallback_order ASC, created_at ASC, id ASC`);
  return rows.map((row) => visible(safe(row)));
}

export async function getProviderProfile(id: string): Promise<StoredProfile | null> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles WHERE id = $1`, [id]);
  return rows[0] ? safe(rows[0]) : null;
}

export async function listEnabledProviderProfiles(): Promise<Array<ProviderProfile & { apiKey:string }>> {
  if (!pool) return [];
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles WHERE is_active ORDER BY fallback_order ASC, created_at ASC, id ASC`);
  return rows.flatMap((row) => {
    const profile = safe(row);
    if (!profile.secret) return [];
    const { secret, ...metadata } = profile;
    return [{ ...metadata, apiKey:decryptProviderKey(secret) }];
  });
}

/** Return the signed-in user's bounded, private help-chat context. */
export async function getAiHelpMemory(userId:string):Promise<AiHelpMessage[]> {
  if (!pool) throw new Error("AI help memory storage is unavailable.");
  let rows:{memory_ciphertext:Buffer;memory_nonce:Buffer;memory_tag:Buffer;encryption_version:1}[];
  try { ({rows}=await pool.query<{memory_ciphertext:Buffer;memory_nonce:Buffer;memory_tag:Buffer;encryption_version:1}>(`SELECT memory_ciphertext,memory_nonce,memory_tag,encryption_version FROM celi_app.ai_help_memories WHERE user_id=$1`,[userId])); }
  catch(error) { if ((error as {code?:string}).code==="42P01") return []; throw error; }
  if (!rows[0]) return [];
  let messages:unknown;
  try { messages=JSON.parse(decryptAiHelpMemory({ciphertext:rows[0].memory_ciphertext,nonce:rows[0].memory_nonce,tag:rows[0].memory_tag,version:rows[0].encryption_version})); } catch { throw new Error("AI help memory cannot be decrypted."); }
  if (!Array.isArray(messages)) return [];
  return messages.filter((item):item is AiHelpMessage => Boolean(item && typeof item === "object" && typeof item.id === "string" && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && typeof item.createdAt === "string"));
}

/** Append successful turns atomically and retain only the latest 24 short messages. */
export async function appendAiHelpMemory(userId:string, additions:AiHelpMessage[]):Promise<void> {
  if (!pool) throw new Error("AI help memory storage is unavailable.");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const emptyMemory=encryptAiHelpMemory("[]");
    await client.query(`INSERT INTO celi_app.ai_help_memories (user_id,memory_ciphertext,memory_nonce,memory_tag,encryption_version) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO NOTHING`,[userId,emptyMemory.ciphertext,emptyMemory.nonce,emptyMemory.tag,emptyMemory.version]);
    const { rows }=await client.query<{memory_ciphertext:Buffer;memory_nonce:Buffer;memory_tag:Buffer;encryption_version:1}>(`SELECT memory_ciphertext,memory_nonce,memory_tag,encryption_version FROM celi_app.ai_help_memories WHERE user_id=$1 FOR UPDATE`,[userId]);
    let current:unknown;
    try { current=JSON.parse(decryptAiHelpMemory({ciphertext:rows[0].memory_ciphertext,nonce:rows[0].memory_nonce,tag:rows[0].memory_tag,version:rows[0].encryption_version})); } catch { throw new Error("AI help memory cannot be decrypted."); }
    const previous=Array.isArray(current) ? current.filter((item):item is AiHelpMessage => Boolean(item && typeof item === "object" && typeof item.id === "string" && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && typeof item.createdAt === "string")) : [];
    const byId=new Map(previous.map((item)=>[item.id,item]));
    for (const item of additions) byId.set(item.id,item);
    const bounded=[...byId.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-24);
    let chars=0;
    const trimmed=bounded.reverse().filter((item)=>{if (chars+item.content.length>12_000) return false;chars+=item.content.length;return true;}).reverse();
    const encrypted=encryptAiHelpMemory(JSON.stringify(trimmed));
    await client.query(`UPDATE celi_app.ai_help_memories SET memory_ciphertext=$2,memory_nonce=$3,memory_tag=$4,encryption_version=$5,updated_at=now() WHERE user_id=$1`,[userId,encrypted.ciphertext,encrypted.nonce,encrypted.tag,encrypted.version]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK").catch(()=>{});throw error; }
  finally { client.release(); }
}

export async function clearAiHelpMemory(userId:string):Promise<void> {
  if (!pool) throw new Error("AI help memory storage is unavailable.");
  await pool.query(`DELETE FROM celi_app.ai_help_memories WHERE user_id=$1`,[userId]);
}

export async function saveProviderProfile(input: SaveProfileInput): Promise<ProviderProfile> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  const current = input.id ? await getProviderProfile(input.id) : null;
  if (input.id && !current) throw new Error("Provider profile not found.");
  const encrypted = input.apiKey ? encryptProviderKey(input.apiKey) : null;
  const secret: EncryptedSecret | null = encrypted ?? current?.secret ?? null;
  if (input.isActive && !secret) throw new Error("Tambahkan API key sebelum mengaktifkan provider.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let fallbackOrder=input.fallbackOrder ?? current?.fallbackOrder;
    if (fallbackOrder===undefined) {
      const { rows:[ordering] }=await client.query<{next_order:number}>(`SELECT COALESCE(MAX(fallback_order),-1)+1 AS next_order FROM celi_app.ai_provider_profiles`);
      fallbackOrder=ordering.next_order;
    }
    const { rows } = await client.query<Row>(`INSERT INTO celi_app.ai_provider_profiles
      (id,name,provider,model_id,base_url,api_key_ciphertext,api_key_nonce,api_key_tag,encryption_version,is_active,fallback_order,updated_at)
      VALUES (COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,provider=EXCLUDED.provider,model_id=EXCLUDED.model_id,base_url=EXCLUDED.base_url,
        api_key_ciphertext=EXCLUDED.api_key_ciphertext,api_key_nonce=EXCLUDED.api_key_nonce,api_key_tag=EXCLUDED.api_key_tag,
        encryption_version=EXCLUDED.encryption_version,is_active=EXCLUDED.is_active,fallback_order=EXCLUDED.fallback_order,updated_at=now() RETURNING *`,
      [input.id || null,input.name,input.provider,input.modelId,input.provider === "openai-compatible" || input.provider === "hermes" ? input.baseUrl || null : null,secret?.ciphertext || null,secret?.nonce || null,secret?.tag || null,secret?.version || null,input.isActive,fallbackOrder]);
    await client.query("COMMIT");
    return visible(safe(rows[0]));
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}

/** Save several model profiles for one provider in a single atomic operation. */
export async function saveProviderProfiles(inputs: SaveProfileInput[]): Promise<ProviderProfile[]> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  if (!inputs.length || inputs.length > 20 || inputs.some((input) => input.id || !input.apiKey) || new Set(inputs.map((input) => input.modelId)).size !== inputs.length) throw new Error("Daftar model tidak valid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows:[ordering] } = await client.query<{next_order:number}>(`SELECT COALESCE(MAX(fallback_order),-1)+1 AS next_order FROM celi_app.ai_provider_profiles`);
    const saved: ProviderProfile[] = [];
    for (const [index,input] of inputs.entries()) {
      const secret = input.apiKey ? encryptProviderKey(input.apiKey) : null;
      if (input.isActive && !secret) throw new Error("Tambahkan API key sebelum mengaktifkan provider.");
      const { rows } = await client.query<Row>(`INSERT INTO celi_app.ai_provider_profiles
        (id,name,provider,model_id,base_url,api_key_ciphertext,api_key_nonce,api_key_tag,encryption_version,is_active,fallback_order,updated_at)
        VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) RETURNING *`,
        [input.name,input.provider,input.modelId,input.provider === "openai-compatible" || input.provider === "hermes" ? input.baseUrl || null : null,secret?.ciphertext || null,secret?.nonce || null,secret?.tag || null,secret?.version || null,input.isActive,ordering.next_order + index]);
      saved.push(visible(safe(rows[0])));
    }
    await client.query("COMMIT");
    return saved;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}

export async function deleteProviderProfile(id: string): Promise<void> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  await pool.query(`DELETE FROM celi_app.ai_provider_profiles WHERE id = $1`, [id]);
}

export async function reorderProviderProfiles(ids:string[]):Promise<void> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  if (ids.length>100 || new Set(ids).size!==ids.length || ids.some((id)=>!/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Urutan provider tidak valid.");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount }=await client.query(`WITH ordered AS (
      SELECT id, ordinality - 1 AS position
      FROM unnest($1::uuid[]) WITH ORDINALITY AS item(id, ordinality)
    ) UPDATE celi_app.ai_provider_profiles AS profile
      SET fallback_order=ordered.position, updated_at=now()
      FROM ordered WHERE profile.id=ordered.id`,[ids]);
    if (rowCount!==ids.length) throw new Error("Urutan provider tidak valid.");
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); throw error; }
  finally { client.release(); }
}

export async function testProfileSecret(id: string) {
  const profile = await getProviderProfile(id);
  if (!profile?.secret) throw new Error("Provider API key belum dikonfigurasi.");
  const { secret, ...metadata } = profile;
  return { ...metadata, apiKey: decryptProviderKey(secret) };
}

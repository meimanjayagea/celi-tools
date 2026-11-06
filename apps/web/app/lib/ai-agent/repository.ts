import "server-only";
import { pool } from "../database";
import { decryptProviderKey, encryptProviderKey } from "./credentials";
import type { AiProvider, EncryptedSecret, ProviderProfile, SaveProfileInput, StoredProfile } from "./types";

type Row = { id:string; name:string; provider:AiProvider; model_id:string; base_url:string|null; api_key_ciphertext:Buffer|null; api_key_nonce:Buffer|null; api_key_tag:Buffer|null; encryption_version:1|null; is_active:boolean; created_at:Date; updated_at:Date };
const safe = (row: Row): StoredProfile => ({ id:row.id, name:row.name, provider:row.provider, modelId:row.model_id, baseUrl:row.base_url, isActive:row.is_active, hasApiKey:Boolean(row.api_key_ciphertext), createdAt:row.created_at.toISOString(), updatedAt:row.updated_at.toISOString(), secret:row.api_key_ciphertext ? { ciphertext:row.api_key_ciphertext, nonce:row.api_key_nonce!, tag:row.api_key_tag!, version:row.encryption_version! } : null });
const visible = (stored: StoredProfile): ProviderProfile => ({ id:stored.id, name:stored.name, provider:stored.provider, modelId:stored.modelId, baseUrl:stored.baseUrl, isActive:stored.isActive, hasApiKey:stored.hasApiKey, createdAt:stored.createdAt, updatedAt:stored.updatedAt });

export async function listProviderProfiles(): Promise<ProviderProfile[]> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles ORDER BY created_at DESC`);
  return rows.map((row) => visible(safe(row)));
}

export async function getProviderProfile(id: string): Promise<StoredProfile | null> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles WHERE id = $1`, [id]);
  return rows[0] ? safe(rows[0]) : null;
}

export async function getActiveProviderProfile(): Promise<(ProviderProfile & { apiKey: string }) | null> {
  if (!pool) return null;
  const { rows } = await pool.query<Row>(`SELECT * FROM celi_app.ai_provider_profiles WHERE is_active LIMIT 1`);
  if (!rows[0]) return null;
  const profile = safe(rows[0]);
  if (!profile.secret) return null;
  const { secret, ...metadata } = profile;
  return { ...metadata, apiKey: decryptProviderKey(secret) };
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
    if (input.isActive) await client.query(`UPDATE celi_app.ai_provider_profiles SET is_active = false WHERE is_active`);
    const { rows } = await client.query<Row>(`INSERT INTO celi_app.ai_provider_profiles
      (id,name,provider,model_id,base_url,api_key_ciphertext,api_key_nonce,api_key_tag,encryption_version,is_active,updated_at)
      VALUES (COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,provider=EXCLUDED.provider,model_id=EXCLUDED.model_id,base_url=EXCLUDED.base_url,
        api_key_ciphertext=EXCLUDED.api_key_ciphertext,api_key_nonce=EXCLUDED.api_key_nonce,api_key_tag=EXCLUDED.api_key_tag,
        encryption_version=EXCLUDED.encryption_version,is_active=EXCLUDED.is_active,updated_at=now() RETURNING *`,
      [input.id || null,input.name,input.provider,input.modelId,input.provider === "openai-compatible" ? input.baseUrl || null : null,secret?.ciphertext || null,secret?.nonce || null,secret?.tag || null,secret?.version || null,input.isActive]);
    await client.query("COMMIT");
    return visible(safe(rows[0]));
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}

export async function deleteProviderProfile(id: string): Promise<void> {
  if (!pool) throw new Error("AI provider storage is unavailable.");
  await pool.query(`DELETE FROM celi_app.ai_provider_profiles WHERE id = $1`, [id]);
}

export async function testProfileSecret(id: string) {
  const profile = await getProviderProfile(id);
  if (!profile?.secret) throw new Error("Provider API key belum dikonfigurasi.");
  const { secret, ...metadata } = profile;
  return { ...metadata, apiKey: decryptProviderKey(secret) };
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../apps/web/db/migrations/V004__ai_provider_fallback.sql", import.meta.url);

test("provider fallback migration preserves credentials and allows ordered enabled profiles", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS fallback_order\s+integer\s+NOT NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /DROP INDEX IF EXISTS celi_app\.ai_provider_one_active_idx/i);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS ai_provider_profiles_check2/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS ai_provider_fallback_order_idx/i);
  assert.match(sql, /ON celi_app\.ai_provider_profiles\s*\(is_active, fallback_order, created_at, id\)/i);
  assert.match(sql, /provider IN \([^)]*'groq'[^)]*'xai'[^)]*'hermes'[^)]*\)/i);
  for (const column of ["api_key_ciphertext", "api_key_nonce", "api_key_tag"]) {
    assert.doesNotMatch(sql, new RegExp(`DROP\\s+COLUMN[^;]*\\b${column}\\b`, "i"));
  }
});

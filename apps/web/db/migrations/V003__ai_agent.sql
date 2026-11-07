CREATE SCHEMA IF NOT EXISTS celi_app;

CREATE TABLE IF NOT EXISTS celi_app.ai_provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'openai-compatible')),
  model_id text NOT NULL CHECK (char_length(model_id) BETWEEN 1 AND 160),
  base_url text,
  api_key_ciphertext bytea,
  api_key_nonce bytea,
  api_key_tag bytea,
  encryption_version smallint,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((api_key_ciphertext IS NULL AND api_key_nonce IS NULL AND api_key_tag IS NULL AND encryption_version IS NULL)
      OR (api_key_ciphertext IS NOT NULL AND api_key_nonce IS NOT NULL AND api_key_tag IS NOT NULL AND encryption_version = 1)),
  CHECK (NOT is_active OR api_key_ciphertext IS NOT NULL),
  CHECK (provider = 'openai-compatible' OR base_url IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_one_active_idx
  ON celi_app.ai_provider_profiles (is_active) WHERE is_active;

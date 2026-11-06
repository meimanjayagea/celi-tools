ALTER TABLE celi_app.ai_provider_profiles
  ADD COLUMN IF NOT EXISTS fallback_order integer NOT NULL DEFAULT 0;

ALTER TABLE celi_app.ai_provider_profiles
  DROP CONSTRAINT IF EXISTS ai_provider_profiles_provider_check;

ALTER TABLE celi_app.ai_provider_profiles
  ADD CONSTRAINT ai_provider_profiles_provider_check CHECK (
    provider IN ('openai', 'anthropic', 'google', 'groq', 'xai', 'openrouter', 'opencode-zen', 'hermes', 'openai-compatible')
  );

ALTER TABLE celi_app.ai_provider_profiles
  DROP CONSTRAINT IF EXISTS ai_provider_profiles_base_url_check;

-- Migration 003 left this multi-column CHECK unnamed, so PostgreSQL assigned check2.
ALTER TABLE celi_app.ai_provider_profiles
  DROP CONSTRAINT IF EXISTS ai_provider_profiles_check2;

ALTER TABLE celi_app.ai_provider_profiles
  ADD CONSTRAINT ai_provider_profiles_base_url_check CHECK (
    provider IN ('openai-compatible', 'hermes') OR base_url IS NULL
  );

DROP INDEX IF EXISTS celi_app.ai_provider_one_active_idx;

CREATE INDEX IF NOT EXISTS ai_provider_fallback_order_idx
  ON celi_app.ai_provider_profiles (is_active, fallback_order, created_at, id);

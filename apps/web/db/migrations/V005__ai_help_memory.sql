CREATE TABLE IF NOT EXISTS celi_app.ai_help_memories (
  user_id text PRIMARY KEY REFERENCES celi_auth.users(id) ON DELETE CASCADE,
  memory_ciphertext bytea NOT NULL,
  memory_nonce bytea NOT NULL CHECK (octet_length(memory_nonce)=12),
  memory_tag bytea NOT NULL CHECK (octet_length(memory_tag)=16),
  encryption_version smallint NOT NULL CHECK (encryption_version=1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_help_memories_updated_at_idx
  ON celi_app.ai_help_memories (updated_at);

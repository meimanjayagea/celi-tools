-- Auth.js PostgreSQL adapter schema for passwordless email links.
-- Keep it in its own schema so shared databases can retain existing users/sessions tables.

CREATE SCHEMA IF NOT EXISTS celi_auth;

CREATE TABLE IF NOT EXISTS celi_auth.users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text,
  email text UNIQUE,
  "emailVerified" timestamptz,
  image text
);

CREATE TABLE IF NOT EXISTS celi_auth.accounts (
  id bigserial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES celi_auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS celi_auth.sessions (
  id bigserial PRIMARY KEY,
  "sessionToken" text NOT NULL UNIQUE,
  "userId" text NOT NULL REFERENCES celi_auth.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS celi_auth.verification_token (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS celi_auth.auth_email_rate_limits (
  email_hash char(64) PRIMARY KEY,
  last_sent_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS celi_auth.auth_ip_rate_limits (
  ip_hash char(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON celi_auth.sessions("userId");
CREATE INDEX IF NOT EXISTS verification_token_expires_idx ON celi_auth.verification_token(expires);
CREATE INDEX IF NOT EXISTS auth_email_rate_limits_sent_at_idx ON celi_auth.auth_email_rate_limits(last_sent_at);
CREATE INDEX IF NOT EXISTS auth_ip_rate_limits_window_idx ON celi_auth.auth_ip_rate_limits(window_started_at);

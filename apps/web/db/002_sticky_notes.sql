-- Private notes for authenticated Celi Tools users.
-- This migration is PostgreSQL-compatible and keeps application data separate from Auth.js.
CREATE SCHEMA IF NOT EXISTS celi_app;

CREATE TABLE IF NOT EXISTS celi_app.sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES celi_auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 5000),
  position_x integer NOT NULL DEFAULT 24 CHECK (position_x BETWEEN 0 AND 10000),
  position_y integer NOT NULL DEFAULT 24 CHECK (position_y BETWEEN 0 AND 10000),
  color text NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'pink', 'green', 'purple')),
  tags text[] NOT NULL DEFAULT '{}',
  reminder_at timestamptz,
  reminder_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(tags) <= 10)
);

CREATE INDEX IF NOT EXISTS sticky_notes_user_created_idx
  ON celi_app.sticky_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sticky_notes_due_reminders_idx
  ON celi_app.sticky_notes (reminder_at)
  WHERE reminder_at IS NOT NULL AND reminder_notified_at IS NULL;

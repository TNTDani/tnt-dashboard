-- Stable user identity table.
-- Exists independently of agency membership so that invite_codes.used_by_user_id
-- survives if an agency_users row is deleted (e.g. user is kicked from an agency).
-- The id is shared with agency_users.id for the same registrant.
CREATE TABLE IF NOT EXISTS users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service role bypasses RLS; all writes use supabaseAdmin.

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_codes (
  code              text        PRIMARY KEY,
  agency_id         uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role              text        NOT NULL DEFAULT 'member'
                                CHECK (role IN ('member', 'admin')),
  created_by        text        NOT NULL,       -- email of whoever seeded the code
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  used_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  used_at           timestamptz
);

CREATE INDEX IF NOT EXISTS invite_codes_agency_id_idx
  ON invite_codes (agency_id);

-- Partial index: speeds up unused-code lookups; consumed codes are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_unused_code_idx
  ON invite_codes (code)
  WHERE used_at IS NULL;

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service role bypasses RLS; all writes use supabaseAdmin.

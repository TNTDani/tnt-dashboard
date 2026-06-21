-- migration_accounts_pitch.sql
-- BD/CRM-laag: prospect-accounts, leads, gegenereerde pitches en bureau-positionering.
-- Zelfde multitenancy + RLS-patroon als migration_multitenant.sql.

CREATE TABLE IF NOT EXISTS accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  company_name        text NOT NULL,
  website             text,
  sector              text,
  size                text,
  location            text,
  linkedin            text,
  description         text,
  notes               text NOT NULL DEFAULT '',
  signals             jsonb NOT NULL DEFAULT '[]',
  enriched_at         timestamptz,
  converted_client_id uuid REFERENCES clients(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_agency_id_idx ON accounts(agency_id);

CREATE TABLE IF NOT EXISTS account_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL,
  seniority   text,
  linkedin    text,
  email       text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_leads_agency_id_idx ON account_leads(agency_id);
CREATE INDEX IF NOT EXISTS account_leads_account_id_idx ON account_leads(account_id);

CREATE TABLE IF NOT EXISTS account_pitches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES account_leads(id) ON DELETE CASCADE,
  content             jsonb NOT NULL,
  methodology_version text NOT NULL DEFAULT 'challenger-spiced-v1',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_pitches_agency_id_idx ON account_pitches(agency_id);
CREATE INDEX IF NOT EXISTS account_pitches_lead_id_idx ON account_pitches(lead_id);

-- Eén positioneringsprofiel per bureau (stuurt de hele pitch).
CREATE TABLE IF NOT EXISTS agency_positioning (
  agency_id      uuid PRIMARY KEY REFERENCES agencies(id),
  agency_name    text NOT NULL DEFAULT '',
  rep_name       text NOT NULL DEFAULT '',
  niche          text NOT NULL DEFAULT '',
  services       jsonb NOT NULL DEFAULT '[]',
  differentiator text NOT NULL DEFAULT '',
  proof_points   jsonb NOT NULL DEFAULT '[]',
  tone           text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS, identiek aan het bestaande agency-isolatiepatroon.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounts','account_leads','account_pitches','agency_positioning']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_agency_isolation" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "rls_agency_isolation" ON %I FOR ALL USING (
         current_agency_id() IS NULL OR agency_id = current_agency_id()
       ) WITH CHECK (
         current_agency_id() IS NULL OR agency_id = current_agency_id()
       )', tbl
    );
  END LOOP;
END;
$$;

-- migration_ats_relations.sql
-- ATS relational core: FK linkages, placement money fields, timeline_events.
-- Run in a single transaction in Supabase SQL editor.

-- ── 1. vacancies → accounts / account_leads ───────────────────────────────────
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES account_leads(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vacancies_account_id_idx ON vacancies(account_id);
CREATE INDEX IF NOT EXISTS vacancies_contact_id_idx ON vacancies(contact_id);

-- ── 2. placements: add relational FKs + money/status columns ─────────────────
ALTER TABLE placements
  ADD COLUMN IF NOT EXISTS account_id      uuid REFERENCES accounts(id)                   ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contact_id      uuid REFERENCES account_leads(id)               ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recruiter_id    uuid REFERENCES agency_users(id)                ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_id  uuid REFERENCES candidate_vacancy_matches(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date      date,
  ADD COLUMN IF NOT EXISTS invoice_status  text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS guarantee_until date;

CREATE INDEX IF NOT EXISTS placements_account_id_idx     ON placements(account_id);
CREATE INDEX IF NOT EXISTS placements_application_id_idx ON placements(application_id);

-- Make existing candidate_id / vacancy_id bare FKs explicit with RESTRICT
-- (they were added without ON DELETE in migration_multitenant.sql as bare uuid columns)
-- We can't add FK constraints after the fact without knowing if they already exist,
-- so we use a DO block to add only if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placements_candidate_id_fkey' AND conrelid = 'placements'::regclass
  ) THEN
    ALTER TABLE placements
      ADD CONSTRAINT placements_candidate_id_fkey
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placements_vacancy_id_fkey' AND conrelid = 'placements'::regclass
  ) THEN
    ALTER TABLE placements
      ADD CONSTRAINT placements_vacancy_id_fkey
        FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ── 3. candidate_vacancy_matches: no constraint change needed ─────────────────
-- Status text column already allows any value. New values in use:
--   'active' | 'on-hold' | 'submitted' | 'interviewing' | 'offer' | 'placed' | 'rejected' | 'withdrawn'
-- No migration required — the column is unconstrained text.

-- ── 4. timeline_events table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timeline_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  event_type     text        NOT NULL,
  summary        text        NOT NULL,
  -- soft references stored as text — no FK constraints (live id columns may be text or uuid)
  candidate_id   text,
  vacancy_id     text,
  account_id     text,
  lead_id        text,
  placement_id   text,
  application_id text,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_agency_id_idx    ON timeline_events(agency_id);
CREATE INDEX IF NOT EXISTS timeline_events_candidate_id_idx ON timeline_events(candidate_id);
CREATE INDEX IF NOT EXISTS timeline_events_vacancy_id_idx   ON timeline_events(vacancy_id);
CREATE INDEX IF NOT EXISTS timeline_events_account_id_idx   ON timeline_events(account_id);
CREATE INDEX IF NOT EXISTS timeline_events_placement_id_idx ON timeline_events(placement_id);
CREATE INDEX IF NOT EXISTS timeline_events_created_at_idx   ON timeline_events(created_at DESC);

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_agency_isolation" ON timeline_events;
CREATE POLICY "rls_agency_isolation" ON timeline_events
  FOR ALL
  USING (current_agency_id() IS NULL OR agency_id = current_agency_id())
  WITH CHECK (current_agency_id() IS NULL OR agency_id = current_agency_id());

-- ── 5. Backfill account_activities → timeline_events ─────────────────────────
INSERT INTO timeline_events (
  agency_id,
  event_type,
  summary,
  account_id,
  lead_id,
  metadata,
  created_at
)
SELECT
  aa.agency_id,
  'activity_logged',
  CASE aa.type
    WHEN 'email'    THEN 'Email — ' || aa.outcome
    WHEN 'call'     THEN 'Call — ' || aa.outcome
    WHEN 'linkedin' THEN 'LinkedIn — ' || aa.outcome
    WHEN 'meeting'  THEN 'Meeting — ' || aa.outcome
    ELSE aa.type || ' — ' || aa.outcome
  END,
  aa.account_id,
  aa.lead_id,
  jsonb_build_object(
    'source',       'account_activities_backfill',
    'activityId',   aa.id,
    'activityType', aa.type,
    'outcome',      aa.outcome,
    'note',         COALESCE(aa.note, '')
  ),
  aa.created_at
FROM account_activities aa
WHERE NOT EXISTS (
  SELECT 1 FROM timeline_events te
  WHERE (te.metadata->>'activityId') = aa.id::text
);

-- ── 6. Computed views ─────────────────────────────────────────────────────────

-- Revenue summary per account (sums fee_amount by invoice_status)
CREATE OR REPLACE VIEW account_revenue AS
SELECT
  p.account_id,
  p.agency_id,
  COUNT(*)                                                                AS placement_count,
  SUM(p.fee_amount)                                                       AS total_fees,
  SUM(CASE WHEN p.invoice_status = 'paid'    THEN p.fee_amount ELSE 0 END) AS collected_fees,
  SUM(CASE WHEN p.invoice_status = 'sent'    THEN p.fee_amount ELSE 0 END) AS invoiced_fees,
  SUM(CASE WHEN p.invoice_status = 'draft'   THEN p.fee_amount ELSE 0 END) AS draft_fees
FROM placements p
WHERE p.account_id IS NOT NULL
GROUP BY p.account_id, p.agency_id;

-- Open vacancy count per account
CREATE OR REPLACE VIEW account_vacancy_counts AS
SELECT
  v.account_id,
  v.agency_id,
  COUNT(*)                                                       AS total_vacancies,
  SUM(CASE WHEN v.status = 'open' THEN 1 ELSE 0 END)            AS open_vacancies,
  SUM(CASE WHEN v.status = 'placed' OR v.stage = 'placed' THEN 1 ELSE 0 END) AS placed_vacancies
FROM vacancies v
WHERE v.account_id IS NOT NULL
GROUP BY v.account_id, v.agency_id;

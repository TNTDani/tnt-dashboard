-- migration_pipeline_model.sql
-- Recruitment pipeline model: openings + vacancy close fields.
-- Run in Supabase SQL editor.

-- ── 1. Add openings + close fields to vacancies ──────────────────────────────
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS openings      int         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS close_reason  text,
  ADD COLUMN IF NOT EXISTS close_note    text,
  ADD COLUMN IF NOT EXISTS closed_at     timestamptz;

-- ── 2. Backfill: default all to open (already the default, but explicit) ─────
UPDATE vacancies SET status = 'open' WHERE status IS NULL OR status = '';

-- ── 3. View: filled count per vacancy (derived from placed matches) ───────────
CREATE OR REPLACE VIEW vacancy_fill_counts AS
SELECT
  m.vacancy_id,
  m.agency_id,
  COUNT(*) AS filled_count
FROM candidate_vacancy_matches m
WHERE m.status = 'placed'
GROUP BY m.vacancy_id, m.agency_id;

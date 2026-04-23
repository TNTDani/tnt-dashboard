-- ─────────────────────────────────────────────────────────────────────────────
-- vacancy_listings: persistent store for job-board sync
--
-- Run in Supabase SQL Editor (Database → SQL Editor → New query).
-- First-run after deploy: POST /api/sync-vacancies with the CRON_SECRET.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vacancy_listings (
  -- Stable primary key: sha256(source || '||' || url)[:40]
  -- Falls back to sha256(source || '||' || title || '||' || company)[:40]
  -- when URL is absent or non-http.
  id                TEXT        PRIMARY KEY,

  title             TEXT        NOT NULL,
  company           TEXT        NOT NULL,
  source            TEXT        NOT NULL,   -- VacancySourceId
  location          TEXT        NOT NULL,
  posted_at         TIMESTAMPTZ NOT NULL,
  description       TEXT        NOT NULL DEFAULT '',
  url               TEXT        NOT NULL,
  category          TEXT        NOT NULL,   -- VacancyCategory

  -- Sync tracking ──────────────────────────────────────────────────────────
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Incremented by age_vacancy_listings() for each sync run a listing is absent.
  -- Reset to 0 on upsert (listing reappeared).
  consecutive_misses INT        NOT NULL DEFAULT 0,

  -- 'active'  → seen in last sync run
  -- 'stale'   → missed 1–2 consecutive runs (source was healthy)
  -- 'gone'    → missed 3+ consecutive runs
  status            TEXT        NOT NULL DEFAULT 'active',

  -- Set the first time a 'gone' listing reappears. Never cleared.
  -- Badge logic should use a 14-day recency window: resurrected_at > NOW() - 14d.
  resurrected_at    TIMESTAMPTZ
);

-- Indexes ─────────────────────────────────────────────────────────────────────

-- Used by the aging UPDATE (WHERE source = ANY(...) AND last_seen_at < sync_started_at)
CREATE INDEX IF NOT EXISTS idx_vlisting_source_last_seen
  ON vacancy_listings (source, last_seen_at);

-- Used by the GET handler (WHERE status != 'gone' ORDER BY last_seen_at DESC)
CREATE INDEX IF NOT EXISTS idx_vlisting_status_last_seen
  ON vacancy_listings (status, last_seen_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- age_vacancy_listings(sync_started_at, succeeded_sources)
--
-- Called after each sync upsert pass. Increments consecutive_misses and
-- updates status ONLY for listings whose source ran successfully this round
-- but which were NOT refreshed (last_seen_at < sync_started_at).
--
-- Correction rationale: if a source errors out, its listings keep their
-- current miss count — they shouldn't be penalised for the source's downtime.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION age_vacancy_listings(
  sync_started_at   TIMESTAMPTZ,
  succeeded_sources TEXT[]
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  aged INT;
BEGIN
  UPDATE vacancy_listings
  SET
    consecutive_misses = consecutive_misses + 1,
    status = CASE
      WHEN consecutive_misses + 1 >= 3 THEN 'gone'
      ELSE 'stale'
    END
  WHERE last_seen_at < sync_started_at
    AND status != 'gone'                     -- don't re-penalise already-gone rows
    AND source = ANY(succeeded_sources);

  GET DIAGNOSTICS aged = ROW_COUNT;
  RETURN aged;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_source_stats()
--
-- Returns per-source aggregates used by the GET /api/vacancy-monitor handler
-- to compute sourceStatuses without a full table scan in application code.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_source_stats()
RETURNS TABLE(
  source          TEXT,
  max_last_seen   TIMESTAMPTZ,
  active_count    BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    source,
    MAX(last_seen_at)                                   AS max_last_seen,
    COUNT(*) FILTER (WHERE status != 'gone')            AS active_count
  FROM vacancy_listings
  GROUP BY source;
$$;

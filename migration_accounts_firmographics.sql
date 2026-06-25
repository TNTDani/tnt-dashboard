-- Migration: richer account fields (firmographics + commercial terms)
-- Idempotent — safe to re-run.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS niche          text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS founder        text,
  ADD COLUMN IF NOT EXISTS source         text,
  ADD COLUMN IF NOT EXISTS fee_agreement  jsonb;

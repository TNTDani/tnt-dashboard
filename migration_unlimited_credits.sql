-- Migration: unlimited credits flag
-- Adds an `unlimited` boolean to ai_credits.
-- When true: balance checks always pass, deductions are skipped, UI shows ∞.

ALTER TABLE ai_credits
  ADD COLUMN IF NOT EXISTS unlimited boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- After registering dani@orchard.works at app.orchard.works/register, run:
--
-- UPDATE ai_credits
--    SET unlimited = true
--  WHERE agency_id = (
--    SELECT id FROM agencies WHERE owner_email = 'dani@orchard.works'
--  );
-- ─────────────────────────────────────────────────────────────────────────────

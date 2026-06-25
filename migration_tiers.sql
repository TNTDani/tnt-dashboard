-- migration_tiers.sql
-- Change the default plan for new agencies from 'starter' to 'free'.
-- Existing agencies keep their current plan value.

ALTER TABLE agencies
  ALTER COLUMN plan SET DEFAULT 'free';

-- Backfill: any agency that was created before tiers existed and has NULL plan → 'free'.
UPDATE agencies
  SET plan = 'free'
  WHERE plan IS NULL;

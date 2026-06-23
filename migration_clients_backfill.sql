-- Migration: fold clients into accounts (slice 1)
-- 1. Extend the stage CHECK constraint to include 'client' and 'dormant'
-- 2. Back-fill one account row per client that has no linked account yet
-- Idempotent: safe to re-run.

-- Step 1 — extend stage constraint
-- Inline CHECK constraints are auto-named by Postgres; find and drop dynamically.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'accounts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%stage IN%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE accounts DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END;
$$;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_stage_check
  CHECK (stage IN ('new','contacted','engaged','meeting','won','lost','client','dormant'));

-- Step 2 — back-fill: one account per unlinked client
-- clients.company_name confirmed (migration_multitenant.sql line ~68)
INSERT INTO accounts (agency_id, company_name, stage, converted_client_id, created_at, updated_at)
SELECT
  c.agency_id,
  c.company_name,
  'client',
  c.id,
  now(),
  now()
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a WHERE a.converted_client_id = c.id
);

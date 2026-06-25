-- migration_credit_buckets.sql
-- Split the single ai_credits.balance into two named buckets:
--   allowance_credits  = monthly grant; refills up to plan cap each cycle
--   purchased_credits  = top-up purchases; never reset, stack above cap
--
-- Also adds plan + last_refill_at so the app can do lazy monthly refills.
-- The old `balance` column is kept for one release (NOT dropped here).

ALTER TABLE ai_credits ADD COLUMN IF NOT EXISTS allowance_credits integer NOT NULL DEFAULT 0;
ALTER TABLE ai_credits ADD COLUMN IF NOT EXISTS purchased_credits integer NOT NULL DEFAULT 0;
ALTER TABLE ai_credits ADD COLUMN IF NOT EXISTS plan             text     NOT NULL DEFAULT 'starter';
ALTER TABLE ai_credits ADD COLUMN IF NOT EXISTS last_refill_at  timestamptz NOT NULL DEFAULT now();

-- Faithful backfill: split existing balance into the two buckets.
-- allowance = min(balance, starter cap 150); purchased = remainder.
-- Total is preserved: allowance + purchased = old balance.
UPDATE ai_credits
  SET allowance_credits = LEAST(GREATEST(balance, 0), 150),
      purchased_credits = GREATEST(balance - 150, 0)
  WHERE allowance_credits = 0 AND purchased_credits = 0;

-- ── Atomic spend function ─────────────────────────────────────────────────────
-- Spends allowance first, then purchased. Returns new total, or -1 if insufficient.

CREATE OR REPLACE FUNCTION spend_credits(p_agency uuid, p_amount integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  a           integer;
  p           integer;
  from_allow  integer;
BEGIN
  SELECT allowance_credits, purchased_credits
    INTO a, p
    FROM ai_credits
   WHERE agency_id = p_agency
     FOR UPDATE;

  IF a + p < p_amount THEN
    RETURN -1;
  END IF;

  from_allow := LEAST(a, p_amount);

  UPDATE ai_credits
     SET allowance_credits = a - from_allow,
         purchased_credits = p - (p_amount - from_allow),
         updated_at        = now()
   WHERE agency_id = p_agency;

  RETURN (a + p) - p_amount;
END;
$$;

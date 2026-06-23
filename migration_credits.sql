-- migration_credits.sql
-- AI-credits: saldo per bureau + verbruikslog + atomische afschrijving.

CREATE TABLE IF NOT EXISTS ai_credits (
  agency_id  uuid PRIMARY KEY REFERENCES agencies(id),
  balance    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES agencies(id),
  user_email    text,
  feature       text NOT NULL,
  model         text,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  web_searches  integer NOT NULL DEFAULT 0,
  credits       integer NOT NULL DEFAULT 0,
  cost_usd      numeric(10,5) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_agency_idx ON ai_usage(agency_id, created_at DESC);

-- Atomische af-/bijschrijving. Positief bedrag = afschrijven (met saldo-check),
-- negatief bedrag = bijschrijven (refund/top-up). Geeft het nieuwe saldo terug,
-- of -1 als er onvoldoende saldo is.
CREATE OR REPLACE FUNCTION deduct_credits(p_agency uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE ai_credits
    SET balance = balance - p_amount, updated_at = now()
    WHERE agency_id = p_agency AND balance - p_amount >= 0
    RETURNING balance INTO new_balance;
  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_balance;
END;
$$;

-- RLS: tabellen alleen via service role (server). Geen client-toegang.
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage   ENABLE ROW LEVEL SECURITY;

-- Bestaande bureaus een startsaldo geven (pas aan / verwijder naar wens).
INSERT INTO ai_credits (agency_id, balance)
SELECT id, 500 FROM agencies
ON CONFLICT (agency_id) DO NOTHING;

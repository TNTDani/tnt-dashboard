-- Migration: BD stage + activity log
-- Run in Supabase SQL editor

-- 1. Stage column on accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'new'
  CHECK (stage IN ('new','contacted','engaged','meeting','won','lost'));

-- 2. Activities table
CREATE TABLE IF NOT EXISTS account_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL,
  account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id        UUID REFERENCES account_leads(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('call','email','linkedin','meeting','note')),
  outcome        TEXT NOT NULL CHECK (outcome IN ('no_answer','voicemail','gatekeeper','callback','meeting_booked','not_interested','note')),
  note           TEXT,
  next_step_date DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     TEXT
);

ALTER TABLE account_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_scope_activities" ON account_activities
  FOR ALL USING (
    agency_id = (
      SELECT agency_id FROM agency_users
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE INDEX IF NOT EXISTS idx_account_activities_account
  ON account_activities(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_activities_next_step
  ON account_activities(agency_id, next_step_date)
  WHERE next_step_date IS NOT NULL;

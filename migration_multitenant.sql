CREATE TABLE IF NOT EXISTS agencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_email text NOT NULL,
  plan        text NOT NULL DEFAULT 'starter',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agency_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'member',
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_users_agency_id_idx ON agency_users(agency_id);
CREATE INDEX IF NOT EXISTS agency_users_email_idx ON agency_users(email);

INSERT INTO agencies (id, name, owner_email, plan)
VALUES ('11111111-1111-1111-1111-111111111111', 'TrueNorth Talent', 'info@truenorthtalent.nl', 'pro')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS candidates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  first_name   text NOT NULL,
  job_role     text NOT NULL,
  current_company text NOT NULL,
  skills       jsonb NOT NULL DEFAULT '[]',
  status       text NOT NULL,
  vacancy_id   uuid,
  processed_cv jsonb,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  first_name           text NOT NULL,
  last_name            text NOT NULL,
  email                text NOT NULL,
  phone                text NOT NULL,
  location             text NOT NULL,
  postal_code          text NOT NULL,
  linkedin             text,
  job_title            text NOT NULL,
  branch               text NOT NULL,
  salary_expectation   numeric,
  status               text NOT NULL,
  notes                text NOT NULL DEFAULT '',
  timed_notes          jsonb NOT NULL DEFAULT '[]',
  documents            jsonb NOT NULL DEFAULT '[]',
  timeline             jsonb NOT NULL DEFAULT '[]',
  cv_file_name         text,
  cv_data              text,
  motivation_file_name text,
  motivation_data      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id          uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  company_name       text NOT NULL,
  website            text,
  sector             text NOT NULL,
  size               text NOT NULL,
  type               text NOT NULL,
  contact_name       text NOT NULL,
  contact_email      text NOT NULL,
  contact_phone      text NOT NULL,
  contact_role       text NOT NULL,
  location           text NOT NULL,
  linkedin           text,
  notes              text NOT NULL DEFAULT '',
  last_vacancy_scan  text,
  fee_agreement      jsonb NOT NULL DEFAULT '{}',
  guarantee_period   integer NOT NULL DEFAULT 0,
  timeline           jsonb NOT NULL DEFAULT '[]',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vacancies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  title           text NOT NULL,
  company         text NOT NULL,
  salary_min      numeric NOT NULL DEFAULT 0,
  salary_max      numeric NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'EUR',
  requirements    jsonb NOT NULL DEFAULT '[]',
  seniority_level text NOT NULL,
  description     text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'open',
  stage           text NOT NULL DEFAULT 'intake',
  stage_log       jsonb NOT NULL DEFAULT '[]',
  client_feedback jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS placements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  candidate_id        uuid NOT NULL,
  profile_id          uuid,
  candidate_name      text NOT NULL,
  job_title           text NOT NULL,
  vacancy_id          uuid,
  vacancy_title       text NOT NULL,
  company             text NOT NULL,
  placement_date      text NOT NULL,
  gross_annual_salary numeric NOT NULL DEFAULT 0,
  fee_percentage      numeric NOT NULL DEFAULT 0,
  fee_amount          numeric NOT NULL DEFAULT 0,
  payment_status      text NOT NULL DEFAULT 'pending',
  notes               text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id              uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  contact_type           text NOT NULL,
  contact_id             uuid NOT NULL,
  contact_name           text NOT NULL,
  contact_email          text NOT NULL,
  company                text NOT NULL,
  original_email_subject text NOT NULL DEFAULT '',
  last_contact_date      text NOT NULL,
  due_date               text NOT NULL,
  status                 text NOT NULL DEFAULT 'pending',
  snoozed_until          text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screening_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  candidate_id uuid NOT NULL,
  vacancy_id   uuid NOT NULL,
  score        integer NOT NULL DEFAULT 0,
  score_reason text,
  summary      text NOT NULL DEFAULT '',
  strengths    jsonb NOT NULL DEFAULT '[]',
  gaps         jsonb NOT NULL DEFAULT '[]',
  flag         text NOT NULL DEFAULT 'green',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sourcing_strategies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  job_title       text NOT NULL,
  skills          jsonb NOT NULL DEFAULT '[]',
  location        text NOT NULL,
  seniority_level text NOT NULL,
  salary_range    text NOT NULL DEFAULT '',
  vacancy_link    text,
  vacancy_id      uuid,
  profiles        jsonb NOT NULL DEFAULT '[]',
  boolean_search  text NOT NULL DEFAULT '',
  xray_search     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  week_number  integer NOT NULL,
  year         integer NOT NULL,
  start_date   text NOT NULL,
  end_date     text NOT NULL,
  metrics      jsonb NOT NULL DEFAULT '{}',
  notes        text NOT NULL DEFAULT '',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_vacancy_matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  candidate_id     uuid NOT NULL,
  vacancy_id       uuid NOT NULL,
  match_score      numeric,
  status           text NOT NULL DEFAULT 'active',
  notes            text NOT NULL DEFAULT '',
  interview_date   text,
  interview_time   text,
  interview_type   text,
  interview_outcome text,
  interview_notes  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id               uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id),
  title                   text NOT NULL,
  type                    text NOT NULL,
  start_time              timestamptz NOT NULL,
  end_time                timestamptz NOT NULL,
  candidate_id            uuid,
  candidate_name          text,
  vacancy_id              uuid,
  vacancy_title           text,
  client_id               uuid,
  client_name             text,
  location                text,
  notes                   text,
  reminder                integer,
  google_calendar_event_id text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE screening_results ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE sourcing_strategies ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE candidate_vacancy_matches ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS agency_id uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111' REFERENCES agencies(id);

CREATE INDEX IF NOT EXISTS candidates_agency_id_idx ON candidates(agency_id);
CREATE INDEX IF NOT EXISTS candidate_profiles_agency_id_idx ON candidate_profiles(agency_id);
CREATE INDEX IF NOT EXISTS clients_agency_id_idx ON clients(agency_id);
CREATE INDEX IF NOT EXISTS vacancies_agency_id_idx ON vacancies(agency_id);
CREATE INDEX IF NOT EXISTS placements_agency_id_idx ON placements(agency_id);
CREATE INDEX IF NOT EXISTS follow_ups_agency_id_idx ON follow_ups(agency_id);
CREATE INDEX IF NOT EXISTS screening_results_agency_id_idx ON screening_results(agency_id);
CREATE INDEX IF NOT EXISTS sourcing_strategies_agency_id_idx ON sourcing_strategies(agency_id);
CREATE INDEX IF NOT EXISTS weekly_reports_agency_id_idx ON weekly_reports(agency_id);
CREATE INDEX IF NOT EXISTS candidate_vacancy_matches_agency_id_idx ON candidate_vacancy_matches(agency_id);
CREATE INDEX IF NOT EXISTS calendar_events_agency_id_idx ON calendar_events(agency_id);

CREATE OR REPLACE FUNCTION current_agency_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb->>'agency_id',
    ''
  )::uuid
$$;

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agencies_anon_select" ON agencies;
CREATE POLICY "agencies_anon_select" ON agencies FOR SELECT USING (current_agency_id() IS NULL OR id = current_agency_id());
DROP POLICY IF EXISTS "agencies_anon_insert" ON agencies;
CREATE POLICY "agencies_anon_insert" ON agencies FOR INSERT WITH CHECK (true);

ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_users_anon_all" ON agency_users;
CREATE POLICY "agency_users_anon_all" ON agency_users FOR ALL USING (current_agency_id() IS NULL OR agency_id = current_agency_id());

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'candidates','candidate_profiles','clients','vacancies','placements',
    'follow_ups','screening_results','sourcing_strategies','weekly_reports',
    'candidate_vacancy_matches','calendar_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_agency_isolation" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "rls_agency_isolation" ON %I FOR ALL USING (
         current_agency_id() IS NULL OR agency_id = current_agency_id()
       ) WITH CHECK (
         current_agency_id() IS NULL OR agency_id = current_agency_id()
       )', tbl
    );
  END LOOP;
END;
$$;

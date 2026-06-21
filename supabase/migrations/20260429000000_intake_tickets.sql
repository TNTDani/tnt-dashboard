-- intake_tickets: persistent store for public intake form submissions.
-- All access via supabaseAdmin (service role) — no permissive RLS policies.

create table intake_tickets (
  id                   uuid        primary key default gen_random_uuid(),
  agency_id            uuid        not null references agencies(id) on delete cascade,
  status               text        not null default 'new'
                                   check (status in ('new', 'in-review', 'converted', 'declined')),

  -- Submission fields (mirror IntakeTicket in src/lib/types.ts)
  company_name         text        not null,
  contact_name         text        not null,
  contact_email        text        not null,
  role_title           text        not null,
  seniority_level      text        not null,
  salary_min           integer     not null default 0,
  salary_max           integer     not null default 0,
  work_type            text        not null,
  city                 text        not null default '',
  description          text        not null default '',
  source               text        not null default '',

  -- State flags
  confirmation_sent    boolean     not null default false,

  -- Conversion tracking (set when status → converted)
  converted_client_id  uuid,
  converted_vacancy_id uuid,

  -- Decline tracking (set when status → declined)
  declined_at          timestamptz,
  declined_reason      text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index intake_tickets_agency_id_idx on intake_tickets(agency_id);
create index intake_tickets_status_idx    on intake_tickets(status);

-- RLS on; no permissive policies — supabaseAdmin only.
alter table intake_tickets enable row level security;

-- Keep updated_at current on every row update.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger intake_tickets_updated_at
  before update on intake_tickets
  for each row execute procedure set_updated_at();

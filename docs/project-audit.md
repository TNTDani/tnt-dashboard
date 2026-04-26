# Orchard — Full Project Audit

## Database Overview

| Table | Purpose | Feature Area | RLS? |
|-------|---------|--------------|------|
| agencies | Organization/multi-tenant root | Auth & Multi-tenancy | Yes |
| agency_users | User accounts per agency | Auth & Multi-tenancy | Yes |
| users | Stable user identity (invite audit trail) | Auth & Multi-tenancy | Yes |
| invite_codes | Invitation tokens for team member signup | Auth & Multi-tenancy | Yes |
| candidates | Legacy candidate records (minimal use) | Candidates | Yes |
| candidate_profiles | Full candidate profiles with documents, timeline, notes | Candidates | Yes |
| clients | Client/prospect companies with contact & fee data | Clients/Prospects | Yes |
| vacancies | Manual job openings with stage tracking and feedback | Vacancies | Yes |
| vacancy_listings | Scraped listings from 10+ job boards (vacancy monitor) | Vacancies | Yes |
| candidate_vacancy_matches | Pipeline linking candidates to vacancies | Pipeline/Matching | Yes |
| placements | Completed placements with fee tracking | Placements | Yes |
| follow_ups | Follow-up reminders (client/candidate contacts) | Follow-ups | Yes |
| screening_results | AI-generated candidate-vacancy scoring | Screening | Yes |
| sourcing_strategies | Sourcing profiles and boolean search strategies | Sourcing | Yes |
| calendar_events | Interview/call/follow-up calendar events | Calendar | Yes |
| weekly_reports | Weekly performance metrics snapshots | Reports & Analytics | Yes |

**RLS Approach:** Row-Level Security enabled on all tenant-scoped tables; isolation via `agency_id` + `current_agency_id()` function.

---

## Feature Areas

### 1. Authentication & Multi-tenancy

**What it does:**
Email/password credentials stored in `agency_users` with bcrypt hashing. NextAuth.js JWT-based session (7-day default, extended to 7d if "remember me" checked). Invite-code signup: existing users can invite new members to their agency with a one-time link; new users registering must either create a new agency or join via code. All Supabase calls scoped by `agency_id` via RLS and `initDb(agencyId)` client-side setup.

**Key files:**
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth credentials provider
- `src/app/api/register/route.ts` — Sign-up (create agency or join via invite)
- `src/app/api/invites/` — Invite code generation/usage (2 routes)
- `src/lib/db.ts` — `initDb(agencyId)` + `requireAgencyId()` enforcement
- `migration_invite_codes.sql`, `migration_multitenant.sql`

**DB tables:** `agencies`, `agency_users`, `users`, `invite_codes`

**API routes:**
- `POST /api/auth/[...nextauth]` — NextAuth handler (login/logout)
- `POST /api/register` — New user registration
- `POST /api/invites` — Generate invite codes (admin only)
- `POST /api/invites/[code]` — Validate + consume invite

**Connections to other features:** Every feature uses `initDb(agencyId)` from session to scope reads/writes. Team page reads/manages agency_users.

**Gaps / Issues:**
- No RBAC beyond owner/admin/member — no per-feature permissions
- Role in JWT token goes stale if changed in DB; user must re-login for role changes to propagate
- Invite codes are single-use but no rate-limiting on code generation or failed attempts
- `invite_codes.expires_at` is nullable; no default expiry, codes can live forever unless manually set

---

### 2. Candidates

**What it does:**
Two candidate models exist: `Candidate` (lightweight, legacy) and `CandidateProfile` (full, current). Profiles hold name, email, phone, location, job title, branch, salary expectation, status (active/passive/placed), notes, timeline, and CV/motivation documents stored as base64. CV processing uses Claude to extract first name, current role/company, skills, experience, education, and professional summary with contact info stripped for privacy.

**Key files:**
- `src/app/api/process-cv/route.ts` — CV extraction via Claude (PDF or DOCX)
- `src/app/api/generate-cv/route.ts` — AI-generated candidate CV from form data
- `src/app/(dashboard)/candidates/` — UI pages
- `src/lib/db.ts` — `getCandidateProfiles()`, `saveCandidateProfiles()`
- `src/lib/pdfReports.ts` — Generate CV PDF

**DB tables:** `candidates`, `candidate_profiles`, `screening_results` (linked)

**API routes:**
- `POST /api/process-cv` — Extract CV to JSON via Claude (4096 tokens max)
- `POST /api/generate-cv` — Generate candidate CV from job description + skills
- `POST /api/screen-candidate` — Score candidate against vacancy
- `POST /api/match-candidates` — Batch score 30 candidates vs 1 vacancy

**Connections to other features:**
- Candidates link to vacancies via `candidate_vacancy_matches`
- Follow-ups can target candidates by `contactId`
- Pipeline/shortlist shows candidate-vacancy pairings
- Calendar events can reference `candidateId`

**Gaps / Issues:**
- Document storage as base64 in JSONB columns (inefficient, no file versioning, no CDN)
- No search/filtering for candidate list by skills, salary range, or location
- Candidate can be referenced via `candidate_id` (Candidate model) or `profile_id` (CandidateProfile model) — duplication risk with no validation they refer to the same person

---

### 3. Clients / Prospects

**See `docs/bd-audit.md` for detailed coverage.** Summary:

Client list with card grid, search, sector/type filters, "Cold" filter chip (no contact in 30+ days), and CSV import (Hunter.io format). Client detail page has three tabs: Overview (contact card, company details, fee agreement inline-edit, notes auto-save, quick actions, follow-up widget, timeline sidebar), Vacancies (linked by `vacancy.company === client.companyName` string match), and Timeline. Cold email generation via Claude scrapes the client website and auto-selects an angle (funding/pain-point/exclusivity). Follow-up records are auto-created with a 4-day due date on every email send or log.

**Key additional files:** `src/app/(dashboard)/clients/`, `src/app/api/generate-cold-email/route.ts`

**DB tables:** `clients`, `follow_ups` (contactId link), `vacancies` (string company match)

**Main gap:** No FK between `vacancies.company` and `clients.companyName` — rename either and the link silently breaks.

---

### 4. Vacancies

**What it does:**
Two vacancy models coexist. **Manual vacancies** (`vacancies` table) are created in the UI or via intake conversion, with title, company (string), salary range, requirements, seniority, description, status (open/closed/on-hold), and stage (intake → sourcing → screening → sent-to-client → interviewing → offer → placed). **Scraped vacancies** (`vacancy_listings`) are synced from 10 job board sources with staleness tracking. The vacancy monitor page serves persisted listings with per-source freshness status (36-hour staleness window). A website scanner scrapes client career pages and extracts listings via Claude.

**Key files:**
- `src/app/api/sync-vacancies/route.ts` — Core multi-source sync (560+ lines)
- `src/app/api/scan-vacancies/route.ts` — Website career page scraper + Claude extraction
- `src/app/api/parse-vacancy/route.ts` — Single listing parser
- `src/app/api/vacancy-monitor/route.ts` — Serve persisted listings
- `src/app/(dashboard)/vacancy-monitor/` — Monitor UI
- `src/app/(dashboard)/vacancies/` — Manual vacancy CRUD

**DB tables:** `vacancies` (manual), `vacancy_listings` (scraped, with `first_seen_at`, `last_seen_at`, `consecutive_misses`, `status`, `resurrected_at`)

**API routes:**
- `GET/POST /api/sync-vacancies` — Fetch 10 sources, upsert, age old listings
- `POST /api/scan-vacancies` — Scrape client website + extract via Claude (2048 tokens)
- `POST /api/parse-vacancy` — Extract details from single URL (512 tokens)
- `GET /api/vacancy-monitor` — Serve listings + source freshness stats

**Connections to other features:**
- Manual vacancies link to candidates via `candidate_vacancy_matches` (pipeline)
- Manual vacancies link to clients by string company name (brittle)
- Vacancies appear in calendar events; referenced in reports
- Sourcing strategies optionally reference a `vacancy_id`

**Gaps / Issues:**
- No FK between `vacancies.company` and `clients.companyName`
- Stale/gone aging relies on Supabase RPC `age_vacancy_listings()` (invoked externally)
- Sync touches 10 external APIs with no rate-limiting; Findwork requires API key (optional, silent failure if missing)
- Website scanner tries 30 hardcoded career page paths; complex SPAs may not render correctly

---

### 5. Placements

**What it does:**
Records completed placements linking candidate, vacancy, company, gross annual salary, fee percentage, and calculated fee amount. Payment status tracked as pending/invoiced/paid. Placements feed into reports KPIs and can be referenced in calendar events.

**Key files:**
- `src/app/(dashboard)/placements/page.tsx` — List + create
- `src/lib/db.ts` — `getPlacements()`, `savePlacements()`

**DB tables:** `placements` (`candidate_id`, `profile_id`, `vacancy_id` all nullable)

**API routes:** None dedicated; read/written via db.ts from the UI.

**Connections to other features:**
- Reports count placements for KPI metrics
- Calendar can show placement events

**Gaps / Issues:**
- No invoice generation or payment UI — only a status flag (pending/invoiced/paid)
- `candidate_id` and `profile_id` both optional and independent — no validation they refer to the same person
- No validation that `placement.company` matches a known client record

---

### 6. Calendar

**What it does:**
Multi-view calendar (week/month) for interviews, client calls, follow-ups, placements, and other events, each with a distinct colour category. Events can optionally link to a candidate, vacancy, and/or client via optional ID fields. Google Calendar OAuth integration pulls external events into the local calendar. A reminder field is stored per event (30/60/1440 minute options) but no notification delivery is implemented.

**Key files:**
- `src/app/(dashboard)/calendar/page.tsx` — Calendar UI (week/month views)
- `src/app/api/google-calendar/` — 3 routes: auth, callback, sync
- `src/lib/db.ts` — `getCalendarEvents()`, `saveCalendarEvent()`, `deleteCalendarEvent()`

**DB tables:** `calendar_events` (with optional `candidate_id`, `vacancy_id`, `client_id`; no FK constraints)

**API routes:**
- `GET /api/google-calendar/auth` — Initiate OAuth flow
- `GET /api/google-calendar/callback` — Exchange code for tokens (stored in localStorage)
- `POST /api/google-calendar/sync` — Fetch Google Calendar events and merge locally

**Connections to other features:**
- Candidate/vacancy/client detail pages can deep-link to new event creation via URL params
- Follow-up event type exists but is not auto-created when a follow-up record is saved
- Reports can count events by type

**Gaps / Issues:**
- Google Calendar sync is read-only — local events are never pushed back to Google
- Reminder field stored but no server or push notification system to act on it
- OAuth tokens stored in localStorage (device-specific, no auto-refresh, silent failure on expiry)
- No automatic calendar event creation when a follow-up is recorded

---

### 7. Follow-ups

**What it does:**
Pending follow-up records for candidates and clients with a due date, snooze capability, and status (pending/done/snoozed). Auto-created when an email is sent or logged (4-day default due date). A follow-up widget on the client detail page shows the current pending follow-up with Snooze 2d and Mark Done actions. No dedicated list page exists for reviewing all follow-ups across all contacts.

**Key files:**
- `src/lib/db.ts` — `getFollowUps()`, `saveFollowUps()` (replaceAll pattern)
- `src/app/(dashboard)/clients/[id]/page.tsx` — Follow-up widget

**DB tables:** `follow_ups` (`contact_type`, `contact_id`, `dueDate`, `status`, `snoozedUntil`)

**API routes:** None dedicated; read/written via db.ts.

**Connections to other features:**
- Auto-created by email send/log from EmailComposer
- Calendar has a `follow-up` event type (separate, not linked to follow-up records)
- Dashboard may surface pending follow-ups

**Gaps / Issues:**
- No dedicated `/follow-ups` global list page
- `replaceAll` write pattern — fetch all, modify, replace all — creates race conditions if two users modify follow-ups simultaneously
- Not integrated with calendar events (two siloed tracking systems)
- No due-date notification or alerting

---

### 8. Team Management

**What it does:**
Lists agency members with email, name, role (owner/admin/member), and join date. Owners can invite new members via a shareable invite code link. Members are removed via a DELETE endpoint (owner-only, with guards against self-removal and removing other owners).

**Key files:**
- `src/app/(dashboard)/team/page.tsx` — Team UI
- `src/app/api/team/members/route.ts` — GET list (admin/owner only)
- `src/app/api/team/members/[user_id]/route.ts` — DELETE member (owner only)
- `src/app/api/invites/` — Invite code generation/validation

**DB tables:** `agency_users`, `invite_codes`

**API routes:**
- `GET /api/team/members` — Fetch members (403 if not admin/owner)
- `DELETE /api/team/members/[user_id]` — Remove member (owner only)
- `POST /api/invites` — Generate invite code
- `POST /api/invites/[code]` — Redeem invite code during registration

**Connections to other features:** All features scope data by agency_id drawn from session user's agency.

**Gaps / Issues:**
- No way to change a member's role after signup (role set by invite, not editable in UI)
- No per-feature access control — role is global (owner/admin/member) only

---

### 9. Reports & Analytics

**What it does:**
Weekly report generation with manually-entered KPI snapshots: emails sent, reply rate, new prospects, calls booked, candidates sourced/screened/shortlisted, placements, fees invoiced/received. A notes field captures qualitative context. Charts (bar, line) visualise metrics over multiple weeks. PDF export available.

**Key files:**
- `src/app/(dashboard)/reports/page.tsx` — Reports UI (Recharts)
- `src/lib/pdfReports.ts` — PDF generation
- `src/lib/db.ts` — `getWeeklyReports()`, `saveWeeklyReports()`

**DB tables:** `weekly_reports` (`week_number`, `year`, `metrics: JSON`, `notes`)

**API routes:**
- `POST /api/generate-cv-pdf` — Generate PDF (used for both CVs and reports; misnamed)

**Connections to other features:**
- Pulls candidate/placement/screening counts for KPI context
- ISO 8601 week calculation used throughout

**Gaps / Issues:**
- All metrics are manually entered — no automated aggregation from activity data
- Metrics like "reply rate" and "calls booked" have no source-of-truth in the app
- PDF export endpoint is misnamed (`generate-cv-pdf` handles both CVs and reports)
- No scheduled delivery or email distribution of weekly reports

---

### 10. Email / Outreach

**What it does:**
Cold email generator via Claude scrapes a client's website (index + `/about`) and produces a personalised email with auto-selected angle (funding/pain-point/exclusivity) in English or Dutch, with a hardcoded Orchard signature. Four reusable templates cover common recruitment emails. The EmailComposer modal supports template selection, AI generation, a write/preview toggle, send via Gmail OAuth, or log-only mode (creates a timeline entry without sending). Every send or log auto-creates a follow-up record with a 4-day due date.

**Key files:**
- `src/app/api/generate-cold-email/route.ts` — Claude website scraper + email generation (1024 tokens)
- `src/app/api/gmail/send/route.ts` — Send via Gmail API
- `src/app/api/gmail/auth/route.ts` — OAuth initiate
- `src/app/api/gmail/callback/route.ts` — OAuth callback
- `src/app/api/gmail/messages/route.ts` — Fetch inbox (read-only)
- `src/lib/emailTemplates.ts` — Template definitions
- `src/lib/buildEmail.ts` — HTML email builder
- `src/components/EmailComposer.tsx` — Composer modal

**DB tables:** None (emails logged as timeline entries on client/candidate records)

**API routes:**
- `POST /api/generate-cold-email` — Website scrape + Claude generation
- `POST /api/gmail/send` — Send via Gmail
- `GET/POST /api/gmail/auth` + `/callback` — OAuth flow
- `GET /api/gmail/messages` — Fetch inbox preview

**Connections to other features:**
- EmailComposer used from client detail quick actions
- Follow-ups auto-created on every send/log
- Gmail OAuth tokens stored in localStorage

**Gaps / Issues:**
- Signature hardcoded as `info@orchard.io` in the API (not configurable)
- Gmail tokens stored in localStorage only — not synced across devices, no auto-refresh
- No email scheduling, open/click tracking, or unsubscribe management
- Website scraper text limit is 15 KB (may truncate relevant content)

---

### 11. Intake (public-facing)

**What it does:**
A public `/intake` form (no auth) lets companies submit vacancy intakes with company name, contact, job title, seniority, salary range, work type, city, description, and source. Submissions become tickets in the internal `/tickets` page. Tickets move through statuses (new → in-review → converted/declined). Converted tickets atomically create a Client (type: prospect) and Vacancy in Supabase.

**Key files:**
- `src/app/intake/page.tsx` — Public intake form
- `src/app/(dashboard)/tickets/page.tsx` — Internal ticket review UI
- `src/app/api/intake/route.ts` — POST (public) + GET (internal)
- `src/app/api/intake/[id]/route.ts` — PATCH ticket status/actions

**DB tables:** None — tickets stored in `data/tickets.json` (local file on server)

**API routes:**
- `POST /api/intake` — Submit public intake form
- `GET /api/intake` — Fetch all tickets (internal only)
- `PATCH /api/intake/[id]` — Mark reviewed, convert, or decline

**Connections to other features:**
- Convert creates `Client` (prospect) + `Vacancy` atomically via db.ts
- Vacancy `company` field set to ticket's `companyName` (string, no FK)

**Gaps / Issues:**
- **Tickets stored in a local JSON file** — not multi-region safe, not backed up, not in Supabase
- No spam prevention or rate-limiting on the public form
- Converted clients remain "prospect" until manually promoted
- No intake pipeline stages (e.g., qualification, proposal sent)

---

### 12. Imports & Exports

**What it does:**
CSV import for clients in Hunter.io format (company, contact, email, location, sector). PDF export of candidate CVs (from processed or generated CVs). PDF export of weekly reports. A ZIP builder exists for batch exports.

**Key files:**
- `src/components/CsvImportModal.tsx` — CSV import UI and parsing
- `src/lib/pdfReports.ts` — PDF generation
- `src/lib/zipBuilder.ts` — Batch ZIP export utility
- `src/app/api/generate-cv-pdf/route.ts` — PDF endpoint

**DB tables:** None (imports/exports are one-way operations)

**API routes:**
- `POST /api/generate-cv-pdf` — Generate PDF (handles both CVs and reports)

**Connections to other features:** CSV import on client list page; PDF exports triggered from detail pages.

**Gaps / Issues:**
- No bulk candidate import
- No Excel/XLSX support (CSV only for clients)
- ZIP export utility exists but usage is unclear
- PDF endpoint handles two distinct use cases (CVs and reports) under a misleading name

---

### 13. Settings / Configuration

**What it does:**
No dedicated settings page exists. OAuth token management (Gmail, Google Calendar) is handled via localStorage. The agency's plan field exists in the `agencies` table but has no UI to change it. User profile management is minimal.

**Key files:**
- `src/app/(dashboard)/layout.tsx` — App shell with sidebar navigation
- NextAuth session (profile info)

**DB tables:** `agencies` (plan field, no UI)

**Gaps / Issues:**
- No settings page for agency name, plan, or OAuth integrations
- Email signature hardcoded in API (not user-configurable)
- No audit log or activity tracking
- No API key management UI for 3rd-party integrations (Gmail, Google Calendar, Anthropic)
- No way to update user name or email after registration

---

### 14. AI Features (cross-cutting)

Every AI feature uses the Anthropic Claude API directly. All routes use `claude-sonnet-4-20250514`.

| Route | Tokens | What it does |
|-------|--------|-------------|
| `POST /api/process-cv` | 4096 | Extract CV to JSON — first name, role, skills, education, summary; strips contact info |
| `POST /api/generate-cv` | ~4096 | Generate a candidate CV document from job description + skills |
| `POST /api/screen-candidate` | 1024 | Score a candidate vs a vacancy (1–10, green/amber/red flag, strengths/gaps) |
| `POST /api/match-candidates` | 4096 | Batch score up to 30 candidates vs 1 vacancy in one call |
| `POST /api/source-candidates` | 4096 | Generate 6–8 sourcing profile archetypes + Boolean search + X-Ray Google string |
| `POST /api/generate-questions` | 2000 | Generate interview questions (5 technical, 3 gap, 3 behavioural, 2 culture) |
| `POST /api/generate-cold-email` | 1024 | Personalised cold email with website scraping and angle auto-selection |
| `POST /api/scan-vacancies` | 2048 | Extract vacancy listings from raw HTML of a careers page |
| `POST /api/parse-vacancy` | 512 | Parse job title, skills, seniority, salary, location from a single listing URL |

**No rate-limiting, token budgeting, cost tracking, or retry logic is implemented.** If Claude returns malformed JSON, most routes surface a 500 error with no retry.

**Gaps / Issues:**
- Model hardcoded across 9 routes — a single find-replace needed if model changes
- No fallback model or degraded mode when Claude API is unavailable
- No request deduplication (double-clicking a button can fire multiple API calls)
- No monthly budget or cost alerting

---

### 15. Sourcing

**What it does:**
The sourcing page lets users generate sourcing strategies for a job opening. Inputs are job title, required skills, location, seniority level, salary range, and an optional vacancy link. Claude generates 6–8 candidate profile archetypes (e.g., "Agency-Side Veteran", "Self-Taught Career Switcher"), each with key skills, where-to-find guidance (LinkedIn search URL, GitHub, communities), and a personalised outreach message. A Boolean search string for LinkedIn Recruiter and an X-Ray Google search string are also produced.

**Key files:**
- `src/app/(dashboard)/sourcing/page.tsx` — Sourcing UI
- `src/app/api/source-candidates/route.ts` — Strategy generation via Claude (4096 tokens)
- `src/lib/db.ts` — `getSourcingStrategies()`, `saveSourcingStrategies()`

**DB tables:** `sourcing_strategies` (`agency_id`, `job_title`, `skills`, `location`, `seniority_level`, `salary_range`, `vacancy_id`, `profiles: JSON`, `boolean_search`, `xray_search`)

**API routes:**
- `POST /api/source-candidates` — Generate strategy via Claude

**Connections to other features:**
- Strategies optionally reference a `vacancy_id`
- Outreach messages can be copied into EmailComposer manually (no direct integration)

**Gaps / Issues:**
- Profiles are suggestions only — no automation to pull candidates from LinkedIn or GitHub
- No tracking of which sourced candidates came from which strategy
- Strategies not reusable or templatable across similar roles

---

### 16. Additional Feature Surfaces

**Pipeline / Shortlist:**
The pipeline page shows all `candidate_vacancy_matches` entries. Candidates can be moved through stages (active → on-hold → rejected/placed). Interview date, type, and outcome are tracked on match records. A shortlist view shows candidates marked for a specific vacancy.

**Screening:**
The screening page lists `screening_results` (AI-scored candidate-vacancy pairings). Results show a score (1–10), a red/amber/green flag, summary, strengths, and gaps. Screening results feed into reports KPIs.

**CV Processor:**
A drag-and-drop CV upload page processes PDF or DOCX files via Claude, displays extracted data for review, and can save the result as a candidate profile.

**Fee Calculator:**
A stateless utility page that calculates placement fees from salary input and fee percentage. No persistence.

**Vacancy Watchlist:**
Client-side only (localStorage). Users can save interesting scraped listings with notes. No server-side persistence.

---

## Loose Ends

- **String FK fragility**: `vacancies.company` and `clients.companyName` linked by string — case-sensitive, no normalisation. Rename either silently breaks the Vacancies tab on the client detail page.

- **Intake ticket storage in local file**: `data/tickets.json` is a server-local JSON file — not safe for multi-region deployment, not backed up, not in Supabase. Concurrent writes could corrupt data.

- **Document storage as base64 in JSONB**: CV and motivation uploads stored as base64 strings in database columns — 4/3× the binary size, no versioning, no CDN delivery. Should be object storage (Vercel Blob, S3, etc.).

- **Role staleness in JWT**: If a user's role is changed in `agency_users`, their JWT still reflects the old role until they re-login. API routes re-check the DB on every request (correct enforcement) but the UI may display a stale role label.

- **Follow-up replaceAll race condition**: `saveFollowUps()` fetches all records, modifies, and replaces the entire set. Concurrent saves from two users will silently overwrite each other's changes.

- **No OAuth token auto-refresh**: Gmail and Google Calendar tokens stored in localStorage with no refresh flow. Token expiry causes silent failures — the UI shows "Gmail connected" but sends fail.

- **Reminder field is decorative**: `calendar_events.reminder_minutes` is stored but no server, cron job, or push notification system acts on it.

- **Public intake form has no rate-limiting or spam prevention**: Anyone can submit tickets without authentication or email verification.

- **No audit log**: No record of who changed what, when. Affects compliance and debugging.

- **PDF endpoint misnamed**: `POST /api/generate-cv-pdf` handles both candidate CV generation and weekly report PDF export under an ambiguous name.

- **Hardcoded values that should be configurable:**
  - Cold email signature: `Met vriendelijke groet / Kind regards, Orchard / info@orchard.io` (API-level, not user-editable)
  - AI model: `claude-sonnet-4-20250514` across all 9 AI routes (single find-replace needed for any model change)
  - Default follow-up due date: 4 days (hardcoded in EmailComposer)
  - Vacancy monitor staleness threshold: 36 hours (hardcoded in vacancy-monitor route)
  - Career page paths for website scanner: 30 hardcoded paths (misses custom paths)
  - Cold email website scrape limit: 15,000 characters

- **No request deduplication for AI calls**: Double-clicking "Generate Cold Email" or "Screen Candidate" fires multiple API calls simultaneously, incurring redundant API costs.

- **Vacancy watchlist is device-local**: Saved via localStorage only — not persisted to DB, not accessible from other devices or browsers.

- **Candidate model ambiguity**: `placements` references both `candidate_id` (Candidate model) and `profile_id` (CandidateProfile model) with no validation they refer to the same person. Two separate models for "a candidate" creates confusion.

- **No search/filter on candidate list**: Candidate list is static with no ability to filter by skill, location, salary expectation, or status.

- **Google Calendar sync read-only**: Local events created in the app are never pushed back to Google Calendar.

- **No settings page**: No UI to configure agency name, email signature, plan tier, or OAuth integrations. Everything is either hardcoded or buried in localStorage.

- **Weekly report metrics are manual**: KPIs like "reply rate" and "calls booked" require manual input — no automated aggregation from actual email/calendar activity data.

---

*Audit produced 2026-04-26. 16 Supabase tables. ~30 API routes. 9 Anthropic Claude call sites. External integrations: Gmail, Google Calendar, Anthropic Claude, 10 job board sources (8 unauthenticated scrapes + Findwork API key + Arbeitnow API).*

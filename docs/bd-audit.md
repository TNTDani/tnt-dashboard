# BD/Sales Features Audit — tnt-dashboard

## 1. Client/Prospect List (`/clients`)

**What exists:**
- Card grid with search (client-side, matches company name, contact name, sector, location)
- Filter chips: All / Prospect / Active / Inactive
- Sector dropdown filter
- "Add Client" modal (company name, sector, size, contact fields, fee agreement type)
- CSV import via Hunter.io format (CsvImportModal)
- No bulk actions, no delete from list page

**Client model:** `companyName`, `sector`, `size` (startup/small/medium/large/enterprise), `type` (prospect/active/inactive), primary contact (name/email/phone/role), `location`, `linkedin?`, `notes`, `feeAgreement` (standard/custom/retainer), `guaranteePeriod`, `timeline[]`, `lastVacancyScan?`

---

## 2. Client Detail Page (`/clients/[id]`)

**Three tabs:**

### Overview tab
- Primary Contact card (email/phone/role)
- Company Details (sector, size, location, linkedin, website)
- Fee Agreement — inline editable (type, custom % or retainer amounts)
- Notes — textarea, auto-saves on blur
- Quick Actions sidebar: Send Email button, Edit button, Change Type dropdown
- Follow-up reminder widget: shows active `pending` follow-up, Snooze 2d, Mark Done buttons
- Timeline sidebar (recent entries)

### Vacancies tab
- Lists vacancies where `vacancy.company === client.companyName` (string match — no FK)
- "Scan website for vacancies" button (VacancyScannerModal)
- Shows `lastVacancyScan` timestamp

### Timeline tab
- Full timeline with note types: `created`, `note`, `email_sent`, `status_change`, `meeting`, `placement`
- Add note inline

---

## 3. Outreach / Cold Email

**EmailComposer component** (modal, used from client detail Quick Actions):
- Template picker: 4 templates — Candidate Outreach, Introduction to Client, Interview Confirmation, Placement Confirmation (all support `{{candidateName}}`, `{{clientName}}`, `{{jobTitle}}`, `{{date}}` vars)
- **AI cold email generator**: `POST /api/generate-cold-email`
  - Scrapes client website (index + `/about`) and strips HTML
  - Uses `claude-sonnet-4-20250514`, 1024 max tokens
  - Auto-selects angle: funding / pain-point / exclusivity based on website signals
  - Supports English or Dutch
  - Returns `{ subject, body }` with Orchard signature hardcoded in prompt
- Send via Gmail (`/api/gmail/send`) or "Log Only" (creates timeline entry without sending)
- Write/Preview tab in body field (renders via `buildHtmlEmail()`)

**Follow-up auto-creation:** When any email is sent or logged, a `FollowUp` record is created with `dueDate = today + 4 days`, `status: 'pending'`.

---

## 4. Follow-up Tracking

**`FollowUp` model:**
- `contactType`: `'candidate' | 'client'`
- `contactId`, `contactName`, `contactEmail`, `company`
- `originalEmailSubject`, `lastContactDate`, `dueDate`
- `status`: `'pending' | 'done' | 'snoozed'`, `snoozedUntil?`

**Storage:** `follow_ups` Supabase table (`db.getFollowUps` / `db.saveFollowUps` using `replaceAll` pattern — full table replace per agency)

**Surfaces:**
- Follow-up widget on client detail page (shows the active pending follow-up)
- Calendar has a `follow-up` event type/color, but **no auto-calendar event is created** when a follow-up is recorded — they're separate
- No dedicated follow-ups list page (no `/follow-ups` route found)

---

## 5. Intake Pipeline (`/tickets`)

**Flow:** Public `/intake` form → intake tickets → internal review → convert or decline

**Ticket statuses:** `new` → `in-review` → `converted` / `declined`

**Actions per ticket:**
- Mark In Review
- Send Confirmation Email (hardcoded Gmail template, requires Gmail connected)
- **Convert to Client+Vacancy**: creates a `Client` (type: `'prospect'`) + `Vacancy` and writes both to Supabase; vacancy company is the ticket's `companyName` (string)
- Decline (optional decline email via Gmail)

**Gap:** Converted clients start as `prospect` type — there's no automated progression to `active`. That requires manually changing the type on the detail page.

---

## 6. Connections to Candidates / Vacancies / Calendar

| Link | How it works | Notes |
|---|---|---|
| Client → Vacancies | `vacancy.company === client.companyName` string match | Fragile — rename either and link breaks |
| Client → Calendar | `CalendarEvent.clientId?` + `clientName?`; deep-link via `?clientId=&clientName=` URL params | Works, but only if event was created from client context |
| Client → Follow-ups | `FollowUp.contactId === client.id` | Works correctly |
| Vacancy → Candidate | Via pipeline/shortlist (separate feature) | Not BD-specific |
| Intake → Client | Convert action creates Client + Vacancy atomically | Company name string used for vacancy link |

**No FK relationship exists between `vacancies.company` and `clients.companyName`** — this is the main structural gap. A vacancy renamed independently from its client (or a client renamed) will silently break the Vacancies tab count.

---

## Summary of Gaps / Missing Features

1. **No follow-ups list page** — no global view of all pending follow-ups across clients
2. **Vacancy ↔ Client link is by string, not FK** — brittle
3. **No pipeline kanban for client stages** — prospects don't have a deal-stage funnel (e.g. no "intro call booked → proposal sent → signed")
4. **Follow-up doesn't auto-create a calendar event** — tracking and scheduling are siloed
5. **Cold email signature is hardcoded** (`info@orchard.io`) in the API — not editable per user
6. **No "last contacted" column on the client list** — have to drill into each card to see recency

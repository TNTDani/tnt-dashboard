# Orchard Roadmap

## Done ✓
- Multi-tenant auth (NextAuth + bcrypt, agency-scoped via Supabase RLS)
- Credit metering — all AI routes charge credits; `deduct_credits` SQL function
- Model routing — extraction (CV parse, vacancy parse, scan) → Haiku; generation (pitch, email, questions) → Sonnet
- Hiring signals — vacancy_listings bridge; hiring badge on accounts list; live vacancies on account detail
- Clients folded into Accounts (slice 1) — stage model extended, back-fill migration, segmented list, drag-and-drop, multi-select bulk drag

## Next / In progress

### #1 — Stripe credit packs (infrastructure done, keys needed)
- `stripe` installed; checkout + webhook routes live at `/api/stripe/*`
- `/credits` page with pack selector
- Sidebar balance chip
- **Blocked on:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` in Vercel env vars

### #2 — Tune credit costs on real data
- Passive — needs ~2 weeks of `ai_usage` data
- Query: `SELECT feature, AVG(cost_usd / NULLIF(credits,0)) FROM ai_usage GROUP BY feature`
- Adjust `CREDIT_COST` map in `src/lib/credits.ts` once margin picture is clear

### #3 — Accounts × Clients slice 2 (unified detail page)
- Make the account detail page stage-aware: prospect view (signals / score / leads / pitch) AND client view (vacancies / candidates / matches delivery) on the same page
- BD history preserved above delivery data
- `/clients/[id]` pages can be retired once this ships

### #4 — Platform super-admin dashboard (`/admin`)
- A single login (`dani@orchard.works`) that can see all customer workspaces across the platform
- Scope: `platform_admin` role flag on `agency_users`; a separate RLS bypass route for admin queries
- Views: all agencies list, per-agency usage (credits consumed, AI calls, last active), MRR snapshot, churn signals (no login > 14 days)
- Does NOT expose customer data (candidates, vacancies) — only aggregate usage and billing metadata
- Prerequisite: Stripe (#1) so MRR is real; register `dani@orchard.works` workspace first

### #5 — Career-page monitor expansion
- Expand vacancy scraping beyond job boards to direct career pages
- Prerequisite: Stripe (#1) for credit top-up (scraping is expensive at scale)

### #6 — Twilio dialer
- Click-to-call from candidate / account / lead detail pages
- Call log auto-saved as account activity
- Independent of other items — can start any time

### #7 — Lusha → dialer autofill
- Enrich a contact via Lusha MCP, phone number prefills the dialer
- Depends on #6

## Parking lot (no timeline)
- Seat-tier pricing (Starter 1 seat / Growth 3 seats / Scale unlimited) once customer count warrants it
- White-label / Orchard for Platforms (multi-tenant reseller model)

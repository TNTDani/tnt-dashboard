# Orchard Strategy Notes

Last updated: April 2026

## Target customer

Small boutique recruitment agencies (2-10 recruiters), Netherlands-first, EU-broader.

## Pricing

**Single plan, €39 per user / month**, billed monthly.
**€29 per user / month** if billed annually (~25% discount).
EUR, no other currencies at launch.
14-day free trial, no credit card required.
Charging starts day 1 of public launch (after candidate bug + Stripe integration ship).

Reasoning:
- €39 sits between Manatal Enterprise (€35) and Recruit CRM (€49). Modern, well-designed, fairly priced — the boutique-agency-native positioning.
- €29 is too low (anchors as "Manatal but nicer"). €49 is too high without feature depth.
- No tiers at v1 — adds decision fatigue, signals enterprise game we're not playing.
- No free tier — recruitment tools are used daily by professionals; price is meaningless if it works. 14-day trial covers the same need.

## Positioning thesis

**BD-first recruitment OS for boutique agencies.**

Most ATS competitors (Bullhorn, Recruiterflow, Manatal, Loxo) treat business development as an afterthought — they're sourcing-and-pipeline tools with bolted-on CRMs. Boutique agencies don't have a candidate problem, they have a client problem. They live or die on job-order pipeline, not candidate pipeline. Orchard wins by taking BD seriously where competitors don't.

Secondary positioning angle: **the recruitment OS that doesn't require €11k/year in LinkedIn Recruiter spend.** 84% of recruiters think LinkedIn Recruiter ROI is poor; 68% still pay for it. Orchard's vacancy monitor + sourcing tools support a credible LinkedIn-replacement story.

## v2 product hypothesis: "Orchard Grow"

12-18 months post-launch, introduce a second tier at €89-99 per user / month built around BD:

- Hiring signal monitoring (which companies are actively hiring, as BD intel — repurpose vacancy_listings infrastructure)
- Prospect CRM with relationship tracking
- Outbound sequencing triggered by hiring signals
- Placement-based reverse BD (when you place X at company A, surface similar companies)
- Account scoring and prioritization

v1 stays "Orchard Source" at €39. Some agencies stay on Source forever (placement-focused). Others upgrade to Grow (growth-focused). Don't build Grow until 30-50 paying Source customers exist and v1 is stable.

## Pain points research (April 2026, public-internet sources)

Ranked by frequency and relevance to boutique agencies. Validate or dismiss in actual recruiter community conversations.

**Tier 1 — structural and boutique-specific:**
1. Cash flow gap between placement and 30-90 day client payment. 181 UK recruitment businesses entered liquidation in 6 months (Aug 2025), +18% YoY.
2. Client concentration risk — boutique agencies often have 70% of revenue from 1-3 clients.
3. Larger clients building internal TA functions, squeezing agency fees.

**Tier 2 — daily operational:**
4. Application overload from AI bot-generated CVs (75% of recruiters report significant volume increase).
5. LinkedIn Recruiter ROI skepticism — 84% question value, 68% still primary tool, up to 80% of tech budget.
6. Fragmented data across Bullhorn, spreadsheets, email, LinkedIn, head.
7. Performance visibility across team members — owners can't easily tell who's generating placements.

**Tier 3 — relationship:**
8. Candidate ghosting and dropouts.
9. Rude/abusive clients and rate pressure.
10. Specialization pressure on generalists.

**Tier 4 — under-served opportunity:**
11. Redeployment rate tracking for contract recruitment — only 6% of contract agencies track this; called "biggest missed opportunity" by Vincere. Validate before building around it.

## GTM strategy: communities-first

Target channels (in priority order):
1. **Recruitment Slackers** (Netherlands/Belgium origin, English-friendly, agency mix) — apply via Google form
2. **OneReq** (2,500+ TA pros, dedicated channels for sourcing/tools) — apply for access
3. **r/recruiting on Reddit** — daily reading, occasional contribution

Skip for now: LinkedIn Ads (€5-15 CPC, bad math at this stage), cold email blasts, conferences, hiring an SDR.

## 90-day community playbook

**Days 1-14: Lurking phase.**
- Apply to all three communities, get approved
- Read 2-3 weeks of backlog in each
- Note active/respected voices, recurring pain points, tool complaints
- Write nothing

**Days 15-45: Helpful contributor phase.**
- 3 thoughtful comments/week per community
- React/upvote frequently
- Don't mention Orchard at all
- DM people with genuine common ground

**Days 46-90: Earned visibility phase.**
- Update bio: "Building tools for boutique recruitment agencies"
- When directly relevant questions arise, answer fully + brief mention of Orchard
- Share genuinely useful build learnings (not promotional)
- DM curious people for design partner conversations

Target outcomes by day 90: ~5-10 recognized relationships per community, 2-4 design partner calls scheduled.

**Hard rules:**
- No pitching in the first month, ever
- No DMing strangers about Orchard
- No posting blog/site links for traffic
- 80% recruiter-to-recruiter, 20% builder-of-Orchard

## Founder advantage

Dani's background — 360° recruitment + commission-only sales + currently job-hunting BDR/SDR — is the credibility profile that lets Orchard sell to recruiters. Most SaaS founders building recruitment tools are software people who interviewed a few recruiters; Dani is the inverse. Lean into this in outreach, writing, and customer conversations: "tools I built because I know the problems firsthand."

## Personal action items (not punch list, not code)

- Apply to Recruitment Slackers (Google form) — kickoff today
- Apply to OneReq — kickoff today
- Sign up Stripe (Netherlands, individual/sole proprietor) — kicks off 1-3 day approval
- Generate Terms of Service + Privacy Policy via Termly free tier
- Build a 50-agency target list (Amsterdam/Rotterdam/Utrecht boutique agencies) — research only, no outreach yet

## What stays off the punch list

Everything in this document is strategic context, not build work. The active code punch list (in conversation memory) covers:
1. Debug candidate-write bug (BLOCKER)
2. Fix Vercel↔GitHub integration (BLOCKER)
3. Stripe + ToS/Privacy
4. Email invites
5. Member removal + role management UI
6. Per-user filter config
7. Export paths
8. CSV modal dark-theme cleanup

v2 BD features and Grow tier work do NOT belong on the punch list until v1 is shipped, paying customers exist, and feedback supports them.

// src/lib/pitchPrompt.ts
// Builds the cold-call pitch prompt in the fixed Challenger + SPICED structure.
// Parameterised on the agency's positioning (multi-tenant) and the output language.

import type { Account, AccountLead, AgencyPositioning, GeneratedPitch } from './accountTypes';

export const PITCH_MODEL = 'claude-sonnet-4-6';
export const METHODOLOGY_VERSION = 'challenger-spiced-v1';

// Languages offered for the pitch output.
export const PITCH_LANGUAGES: { code: string; label: string }[] = [
  { code: 'English', label: 'English' },
  { code: 'Dutch', label: 'Nederlands' },
  { code: 'German', label: 'Deutsch' },
  { code: 'French', label: 'Français' },
  { code: 'Spanish', label: 'Español' },
];

// Free heuristic: guess the pitch language from the account's location (no API call).
// Not stored data like universities/posts, just the company's country, which is the
// strongest cheap signal we already have.
export function suggestPitchLanguage(account: Pick<Account, 'location'>): string {
  const loc = (account.location ?? '').toLowerCase();
  if (/(netherlands|nederland|amsterdam|rotterdam|utrecht|den haag|eindhoven|\bnl\b)/.test(loc)) return 'Dutch';
  if (/(belgi|belgium|brussel|antwerp|gent|flanders|vlaanderen)/.test(loc)) return 'Dutch';
  if (/(germany|deutschland|berlin|munich|münchen|hamburg|cologne|köln|frankfurt)/.test(loc)) return 'German';
  if (/(france|paris|lyon|marseille|toulouse)/.test(loc)) return 'French';
  if (/(spain|españa|madrid|barcelona|valencia|sevilla)/.test(loc)) return 'Spanish';
  return 'English';
}

export function buildPitchSystemPrompt(language = 'English'): string {
  return `You are an experienced sales copywriter who writes cold-call pitches for recruitment agencies.
You work according to the Challenger Sale and SPICED. Write ALL output (every field, the pitch and the riedel) in ${language}.

== HARD RULES ==
- Respond ONLY with valid JSON matching the schema below. No markdown, no code fences, no text around it.
- No em-dashes. Use commas, periods or a colon.
- Bullets/lists only where the content is genuinely a list.
- NEVER invent a reference client. Use only the supplied proof points. If none fits, use the literal phrase for "similar companies" in ${language}. A proof point with "named": false must not be named.
- Pick ONE primary pain, based on the signals and the persona.
- Keep hooks and challenger questions fresh; never repeat one within the pitch.
- The challenger reframe brings an insight the persona has not named themselves.
- For a recruitment agency the strongest signal is hiring pressure: open roles, growth, acquisitions, leadership changes. Anchor the chosen pain there.

== THE FIXED STRUCTURE (fill every field) ==
1. analysis: company type, the chosen signal, the persona and why, the chosen primary pain, the chosen reference (a proof point or "similar companies"), and where the reframe lands. The hook and the "somewhat in order" branch must NOT use the same point.
2. summaryLine: one line summarising the angle.
3. opener: "Hi [first name], this is [repName] from [agencyName]..." short and human, in ${language}.
4. hook: teach + provoke in 1-2 sentences, with a flip at the end ("or would you say it already runs smoothly?") followed by deliberate silence.
5/6/7. branches:
   - yes: on "yes, that's a thing" -> confirming question, then probe how they handle it now.
   - somewhatOk: on "fairly in order" -> a NEW point landing on the Situation question, not a repeat of the hook.
   - no: on "no" -> short value/pitch + immediately the first probing question.
8. spicedFunnel: a sequence of {beat, question}:
   - Situation (number: open roles / time-to-hire)
   - Situation (current approach: internal team, other agencies, job boards)
   - Pain (clean, neutral question)
   - Impact (the challenger reframe with the new insight)
   - Compelling Event (why now, push urgency, accept no "someday")
   - Decision (who decides, what the process looks like)
9. finalChallenge: one confronting question.
10. close: proof (a proof point or "similar companies") + a small, time-bound meeting ask.
11. alternativePains: 2-3 other pains, each {pain, solution, reference}.
12. handoffChecklist: what the recruiter records after the call (number of roles, decision-maker, current suppliers, fee expectation, timing).
13. strategicNotes: short tactical points (multithreading, check for name confusion, next step).
+ riedel: the clean spoken version of opener through meeting-ask as a natural ${language} monologue, no labels.

== JSON SCHEMA ==
{
  "analysis": { "companyType": string, "signal": string, "persona": string, "chosenPain": string, "reference": string, "reframeLandsAt": string },
  "summaryLine": string,
  "opener": string,
  "hook": string,
  "branches": { "yes": string, "somewhatOk": string, "no": string },
  "spicedFunnel": [ { "beat": string, "question": string } ],
  "finalChallenge": string,
  "close": string,
  "alternativePains": [ { "pain": string, "solution": string, "reference": string } ],
  "handoffChecklist": [ string ],
  "strategicNotes": [ string ],
  "riedel": string
}`;
}

export function buildPitchUserPrompt(input: {
  positioning: AgencyPositioning;
  account: Account;
  lead: AccountLead;
  websiteText?: string;
  language?: string;
}): string {
  const { positioning, account, lead, websiteText, language = 'English' } = input;

  const proof = positioning.proofPoints.length
    ? positioning.proofPoints
        .map((p) => `- ${p.named ? p.label : `(do NOT use the name) ${p.label}`}: ${p.result}`)
        .join('\n')
    : '- (no proof points supplied, use "similar companies")';

  const signals = account.signals.length
    ? account.signals.map((s) => `- [${s.type}] ${s.summary}${s.date ? ` (${s.date})` : ''}`).join('\n')
    : '- (no signals, base it on the company profile/website below)';

  return `OUTPUT LANGUAGE: ${language}

== AGENCY (the seller) ==
Name: ${positioning.agencyName || '(not set)'}
Recruiter calling: ${positioning.repName || '(not set)'}
Niche: ${positioning.niche || '(not set)'}
Services: ${positioning.services.join(', ') || '(not set)'}
Differentiator / reframe core: ${positioning.differentiator || '(not set)'}
${positioning.tone ? `Tone of voice: ${positioning.tone}\n` : ''}Proof points:
${proof}

== ACCOUNT (the prospect company) ==
Name: ${account.companyName}
${account.sector ? `Industry: ${account.sector}\n` : ''}${account.size ? `Size: ${account.size}\n` : ''}${account.location ? `Location: ${account.location}\n` : ''}${account.description ? `Profile: ${account.description}\n` : ''}${account.notes ? `Notes: ${account.notes}\n` : ''}Signals:
${signals}
${websiteText ? `\nWebsite text (extra context):\n${websiteText}\n` : ''}
== LEAD (the persona being called) ==
Name: ${lead.name}
Role: ${lead.role}${lead.seniority ? ` (${lead.seniority})` : ''}

Generate the pitch now. Pick the most relevant primary pain based on the signals and the lead's role. Write all output in ${language}. Respond with the JSON only.`;
}

/** Strip fences and parse. Throws if not valid JSON. */
export function parsePitch(text: string): GeneratedPitch {
  const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/```/g, '').trim();
  return JSON.parse(clean) as GeneratedPitch;
}

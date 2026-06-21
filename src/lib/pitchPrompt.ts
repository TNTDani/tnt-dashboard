// src/lib/pitchPrompt.ts
// Bouwt de prompt voor de cold call pitch in de vaste Challenger + SPICED-structuur.
// Geparametriseerd op de positionering van het bureau (multi-tenant).

import type { Account, AccountLead, AgencyPositioning, GeneratedPitch } from './accountTypes';

export const PITCH_MODEL = 'claude-sonnet-4-6'; // zelfde als generate-cold-email; bump gerust naar nieuwere Sonnet
export const METHODOLOGY_VERSION = 'challenger-spiced-v1';

export function buildPitchSystemPrompt(): string {
  return `Je bent een ervaren sales-copywriter die cold call pitches schrijft voor recruitmentbureaus.
Je werkt volgens de Challenger Sale en SPICED. Je schrijft in het Nederlands.

== HARDE REGELS ==
- Antwoord UITSLUITEND met geldige JSON volgens het schema onderaan. Geen markdown, geen codeblok-fences, geen tekst eromheen.
- Geen em-dashes. Gebruik komma's, punten of een dubbele punt.
- Bullets/opsommingen alleen waar de inhoud echt opsommend is.
- Verzin NOOIT een referentieklant. Gebruik alleen de aangeleverde proof points. Is er geen passende, gebruik dan letterlijk "soortgelijke bedrijven". Een proof point met "named": false noem je niet bij naam.
- Kies EEN hoofdpijn, op basis van de signalen en de persona.
- Hooks en challenger-vragen blijven vers en komen nooit dubbel voor binnen de pitch.
- De challenger-reframe brengt een inzicht dat de persona zelf nog niet benoemd had.
- Voor een recruitmentbureau is het sterkste signaal de hiring-druk: open vacatures, groei, overnames, leiderschapswissel. Laat de gekozen pijn daarop aansluiten.

== DE VASTE STRUCTUUR (vul elk veld) ==
1. analysis: bedrijfstype, het gekozen signaal, de persona en waarom, de gekozen hoofdpijn, de gekozen referentie (proof point of "soortgelijke bedrijven"), en waar de reframe landt. Hook en "redelijk op orde"-branch pakken NIET hetzelfde punt.
2. summaryLine: 1 regel die de insteek samenvat.
3. opener: "Hoi [voornaam], je spreekt met [repName] van [agencyName]..." kort en menselijk.
4. hook: teach + provoke in 1-2 zinnen, met een flip aan het eind ("of zeg jij juist dat dat al strak loopt?") gevolgd door bewuste stilte.
5/6/7. branches:
   - yes: bij "ja, dat speelt" -> bevestigingsvraag, dan doorvragen op hun huidige aanpak.
   - somewhatOk: bij "redelijk op orde" -> een NIEUW punt dat op de Situatie-vraag landt, geen herhaling van de hook.
   - no: bij "nee" -> korte value/pitch + meteen de eerste doorvraag.
8. spicedFunnel: reeks {beat, question} in deze volgorde:
   - Situation (cijfer: aantal open rollen / time-to-hire)
   - Situation (huidige aanpak: intern team, andere bureaus, job boards)
   - Pain (schone, neutrale vraag)
   - Impact (de challenger-reframe met het nieuwe inzicht)
   - Compelling Event (waarom nu, push op urgentie, geen "ooit")
   - Decision (wie beslist, hoe ziet het proces eruit)
9. finalChallenge: 1 confronterende vraag.
10. close: bewijs (proof point of "soortgelijke bedrijven") + kleine, tijdgebonden meeting-ask.
11. alternativePains: 2-3 andere pijnen, elk {pain, solution, reference}.
12. handoffChecklist: wat de recruiter na de call vastlegt (aantal rollen, beslisser, huidige leveranciers, fee-verwachting, timing).
13. strategicNotes: korte tactische punten (multithreaden, naamverwarring checken, vervolgstap).
+ riedel: de schone gesproken versie van opener t/m meeting-ask als natuurlijke Nederlandse monoloog, zonder labels.

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
}): string {
  const { positioning, account, lead, websiteText } = input;

  const proof = positioning.proofPoints.length
    ? positioning.proofPoints
        .map((p) => `- ${p.named ? p.label : `(naam NIET gebruiken) ${p.label}`}: ${p.result}`)
        .join('\n')
    : '- (geen proof points aangeleverd, gebruik "soortgelijke bedrijven")';

  const signals = account.signals.length
    ? account.signals.map((s) => `- [${s.type}] ${s.summary}${s.date ? ` (${s.date})` : ''}`).join('\n')
    : '- (geen signalen, baseer je op het bedrijfsprofiel/website hieronder)';

  return `== BUREAU (de verkoper) ==
Naam: ${positioning.agencyName || '(niet ingesteld)'}
Recruiter die belt: ${positioning.repName || '(niet ingesteld)'}
Niche: ${positioning.niche || '(niet ingesteld)'}
Diensten: ${positioning.services.join(', ') || '(niet ingesteld)'}
Differentiator / reframe-kern: ${positioning.differentiator || '(niet ingesteld)'}
${positioning.tone ? `Tone of voice: ${positioning.tone}\n` : ''}Proof points:
${proof}

== ACCOUNT (het prospect-bedrijf) ==
Naam: ${account.companyName}
${account.sector ? `Branche: ${account.sector}\n` : ''}${account.size ? `Omvang: ${account.size}\n` : ''}${account.location ? `Locatie: ${account.location}\n` : ''}${account.description ? `Profiel: ${account.description}\n` : ''}${account.notes ? `Notities: ${account.notes}\n` : ''}Signalen:
${signals}
${websiteText ? `\nWebsite-tekst (voor extra context):\n${websiteText}\n` : ''}
== LEAD (de persona die gebeld wordt) ==
Naam: ${lead.name}
Rol: ${lead.role}${lead.seniority ? ` (${lead.seniority})` : ''}

Genereer nu de pitch. Kies de meest passende hoofdpijn op basis van de signalen en de rol van de lead. Antwoord uitsluitend met de JSON.`;
}

/** Strip fences en parse. Gooit als het geen geldige JSON is. */
export function parsePitch(text: string): GeneratedPitch {
  const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/```/g, '').trim();
  return JSON.parse(clean) as GeneratedPitch;
}

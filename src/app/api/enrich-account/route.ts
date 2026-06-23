// src/app/api/enrich-account/route.ts
// POST -> verkoopsignalen + contactpersonen via web_search (val terug op website).
// Gemeterd: deep (web search) kost meer credits dan quick (alleen website).

import { NextRequest, NextResponse } from 'next/server';
import { anthropic, MODEL, textOf, usageOf } from '@/lib/anthropic';
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';
import { normalizeUrl } from '@/lib/website';
import type { Signal, SuggestedPerson } from '@/lib/accountTypes';

export const maxDuration = 60;

const SCHEMA = `Antwoord UITSLUITEND met een JSON-object (niets erna, geen markdown):
{
  "signals": [ { "type": "open_role" | "funding" | "acquisition" | "leadership_change" | "expansion" | "competitor" | "other", "summary": string, "source": string, "date": string } ],
  "people": [ { "name": string, "role": string, "source": string, "linkedin": string } ]
}
Bij "people": alleen mensen relevant voor een recruitmentbureau (HR, talent acquisition, hiring managers, oprichters bij kleine bedrijven). Verzin geen namen.`;

interface EnrichResult {
  signals: Signal[];
  people: SuggestedPerson[];
}
interface Usage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}
const ZERO: Usage = { inputTokens: 0, outputTokens: 0, webSearches: 0 };

function parseResult(text: string): EnrichResult {
  const match = text.match(/\{[\s\S]*\}\s*$/) ?? text.match(/\{[\s\S]*\}/);
  if (!match) return { signals: [], people: [] };
  try {
    const parsed = JSON.parse(match[0]);
    return {
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
    };
  } catch {
    return { signals: [], people: [] };
  }
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
  } catch {
    return '';
  }
}

async function viaWebSearch(who: string): Promise<{ result: EnrichResult; usage: Usage }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
    messages: [
      {
        role: 'user',
        content: `Je verzamelt actuele verkoopsignalen en relevante contactpersonen over ${who}, voor een recruitmentbureau dat dit bedrijf als klant wil winnen.
Signalen: open vacatures (sterkste), groei/uitbreiding, funding, overnames, wissels in leiderschap, recruitment/HR-tooling.
Contactpersonen: wie is verantwoordelijk voor werving en aannames (HR, talent acquisition, hiring managers, bij kleine bedrijven de oprichter).
Verzin niets. Geen concrete vondsten, geef lege arrays.
${SCHEMA}`,
      },
    ],
  });
  return { result: parseResult(textOf(response.content)), usage: usageOf(response) };
}

async function viaWebsite(companyName: string, website: string): Promise<{ result: EnrichResult; usage: Usage }> {
  const base = normalizeUrl(website);
  const [home, careers, team] = await Promise.all([
    fetchText(base),
    fetchText(base + '/careers').then((t) => t || fetchText(base + '/vacatures')),
    fetchText(base + '/team').then((t) => t || fetchText(base + '/about') || fetchText(base + '/over-ons')),
  ]);
  const siteText = (home + '\n' + careers + '\n' + team).slice(0, 14000);
  if (!siteText.trim()) return { result: { signals: [], people: [] }, usage: ZERO };
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1536,
    messages: [
      {
        role: 'user',
        content: `Op basis van onderstaande website-tekst van ${companyName}: welke hiring/groei-signalen zie je, en welke contactpersonen die relevant zijn voor werving (HR, hiring managers, oprichters)? Verzin niets.

WEBSITE-TEKST:
${siteText}

${SCHEMA}`,
      },
    ],
  });
  return { result: parseResult(textOf(response.content)), usage: usageOf(response) };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    // Saldo-check op de duurste variant (deep).
    if ((await getBalance(agencyId)) < CREDIT_COST.enrich_deep) {
      return NextResponse.json(
        { error: `Insufficient credits. Enrichment costs up to ${CREDIT_COST.enrich_deep} credits.` },
        { status: 402 },
      );
    }

    const { companyName, website, location }: { companyName: string; website?: string; location?: string } =
      await req.json();
    if (!companyName) return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });

    const who = `${companyName}${location ? ` (${location})` : ''}${website ? `, website ${website}` : ''}`;

    let result: EnrichResult = { signals: [], people: [] };
    let usage: Usage = ZERO;
    try {
      ({ result, usage } = await viaWebSearch(who));
    } catch (e) {
      console.warn('web_search unavailable, falling back to website scrape:', String(e));
      if (website) ({ result, usage } = await viaWebsite(companyName, website));
    }

    // Alleen afschrijven als er echt een AI-call is gedaan. Deep (web search) vs quick.
    if (usage.inputTokens > 0 || usage.outputTokens > 0) {
      await chargeCredits({
        agencyId,
        userEmail: email,
        feature: usage.webSearches > 0 ? 'enrich_deep' : 'enrich_quick',
        model: MODEL,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        webSearches: usage.webSearches,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Enrich error:', err);
    return NextResponse.json({ signals: [], people: [] });
  }
}

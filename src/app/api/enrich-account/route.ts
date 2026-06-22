// src/app/api/enrich-account/route.ts
// POST -> verzamelt verkoopsignalen EN relevante contactpersonen (HR, hiring managers,
// talent leads) voor een account. Probeert eerst de web_search-tool; valt anders terug
// op de bedrijfswebsite. Geeft altijd { signals: [...], people: [...] } terug.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Signal, SuggestedPerson } from '@/lib/accountTypes';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const SCHEMA = `Antwoord UITSLUITEND met een JSON-object (niets erna, geen markdown):
{
  "signals": [ { "type": "open_role" | "funding" | "acquisition" | "leadership_change" | "expansion" | "competitor" | "other", "summary": string, "source": string, "date": string } ],
  "people": [ { "name": string, "role": string, "source": string, "linkedin": string } ]
}
Bij "people": alleen mensen die relevant zijn voor een recruitmentbureau (HR, talent acquisition, hiring managers, oprichters bij kleine bedrijven). Verzin geen namen.`;

interface EnrichResult {
  signals: Signal[];
  people: SuggestedPerson[];
}

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

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function normalizeUrl(website: string): string {
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url.replace(/\/$/, '');
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

async function viaWebSearch(who: string): Promise<EnrichResult> {
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
  return parseResult(textOf(response.content));
}

async function viaWebsite(companyName: string, website: string): Promise<EnrichResult> {
  const base = normalizeUrl(website);
  const [home, careers, team] = await Promise.all([
    fetchText(base),
    fetchText(base + '/careers').then((t) => t || fetchText(base + '/vacatures')),
    fetchText(base + '/team').then((t) => t || fetchText(base + '/about') || fetchText(base + '/over-ons')),
  ]);
  const siteText = (home + '\n' + careers + '\n' + team).slice(0, 14000);
  if (!siteText.trim()) return { signals: [], people: [] };
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
  return parseResult(textOf(response.content));
}

export async function POST(req: NextRequest) {
  try {
    const { companyName, website, location }: { companyName: string; website?: string; location?: string } =
      await req.json();
    if (!companyName) return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });

    const who = `${companyName}${location ? ` (${location})` : ''}${website ? `, website ${website}` : ''}`;

    let result: EnrichResult = { signals: [], people: [] };
    try {
      result = await viaWebSearch(who);
    } catch (e) {
      console.warn('web_search unavailable, falling back to website scrape:', String(e));
      if (website) result = await viaWebsite(companyName, website);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Enrich error:', err);
    return NextResponse.json({ signals: [], people: [] });
  }
}

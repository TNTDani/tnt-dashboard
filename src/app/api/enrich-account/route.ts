// src/app/api/enrich-account/route.ts
// POST -> verzamelt verkoopsignalen voor een account. Probeert eerst de web_search-tool
// van de Anthropic API (open vacatures, groei, funding, overnames, leiderschapswissels,
// concurrent-signalen). Is web search niet beschikbaar op de org, dan valt hij terug op
// het lezen van de bedrijfswebsite. Geeft altijd { signals: [...] } terug, nooit een harde fout.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Signal } from '@/lib/accountTypes';

export const maxDuration = 60; // web search kan even duren

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

const SCHEMA = `Antwoord UITSLUITEND met een JSON-array (niets erna, geen markdown):
[ { "type": "open_role" | "funding" | "acquisition" | "leadership_change" | "expansion" | "competitor" | "other", "summary": string, "source": string, "date": string } ]`;

function extractSignals(text: string): Signal[] {
  const match = text.match(/\[[\s\S]*\]\s*$/) ?? text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

async function viaWebSearch(who: string): Promise<Signal[]> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [
      {
        role: 'user',
        content: `Je verzamelt actuele verkoopsignalen over ${who} voor een recruitmentbureau dat dit bedrijf als klant wil winnen.
Zoek naar: open vacatures (sterkste signaal), groei/uitbreiding, funding, overnames, wissels in leiderschap (CFO/CHRO/Head of Talent), en signalen dat ze met recruitment/HR-tooling bezig zijn.
Verzin niets. Vind je niets concreets, geef een lege array.
${SCHEMA}`,
      },
    ],
  });
  return extractSignals(textOf(response.content));
}

async function viaWebsite(companyName: string, website: string): Promise<Signal[]> {
  const base = normalizeUrl(website);
  const [home, careers] = await Promise.all([
    fetchText(base),
    fetchText(base + '/careers').then((t) => t || fetchText(base + '/vacatures')),
  ]);
  const siteText = (home + '\n' + careers).slice(0, 12000);
  if (!siteText.trim()) return [];
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Op basis van onderstaande website-tekst van ${companyName}: welke concrete signalen wijzen op hiring-druk of groei (open vacatures, snelle groei, nieuwe locaties)? Verzin niets.

WEBSITE-TEKST:
${siteText}

${SCHEMA}`,
      },
    ],
  });
  return extractSignals(textOf(response.content));
}

export async function POST(req: NextRequest) {
  try {
    const { companyName, website, location }: { companyName: string; website?: string; location?: string } =
      await req.json();
    if (!companyName) return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });

    const who = `${companyName}${location ? ` (${location})` : ''}${website ? `, website ${website}` : ''}`;

    let signals: Signal[] = [];
    try {
      signals = await viaWebSearch(who);
    } catch (e) {
      // web search waarschijnlijk niet aan op de org -> val terug op de website
      console.warn('web_search unavailable, falling back to website scrape:', String(e));
      if (website) signals = await viaWebsite(companyName, website);
    }

    return NextResponse.json({ signals });
  } catch (err) {
    console.error('Enrich error:', err);
    // nooit een harde fout naar de client; lege signalen zodat de UI niet breekt
    return NextResponse.json({ signals: [] });
  }
}

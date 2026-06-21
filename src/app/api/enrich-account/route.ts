// src/app/api/enrich-account/route.ts
// POST -> verzamelt verkoopsignalen voor een account via de web_search-tool van de
// Anthropic API: open vacatures, groei/uitbreiding, funding, overnames, leiderschaps-
// wissels en concurrent-signalen. Geeft een Signal[] terug. Stateless: opslaan op het
// account doet de client via accountsDb.updateAccount.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Signal } from '@/lib/accountTypes';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      companyName,
      website,
      location,
    }: { companyName: string; website?: string; location?: string } = await req.json();

    if (!companyName) {
      return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });
    }

    const who = `${companyName}${location ? ` (${location})` : ''}${website ? `, website ${website}` : ''}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [
        {
          role: 'user',
          content: `Je verzamelt actuele verkoopsignalen over ${who} voor een recruitmentbureau dat dit bedrijf als klant wil winnen.

Zoek gericht naar:
- open vacatures / actieve werving (het sterkste signaal)
- snelle groei, nieuwe locaties of marktuitbreiding
- recente funding rounds
- overnames (door of van dit bedrijf)
- wissels in leiderschap (CFO, CHRO, Head of Talent, oprichters)
- signalen dat ze met recruitment of HR-tooling bezig zijn

Verzin niets. Gebruik alleen wat je in de zoekresultaten vindt. Vind je niets concreets, geef dan een lege array.

Sluit je antwoord af met UITSLUITEND een JSON-array (niets erna, geen markdown):
[ { "type": "open_role" | "funding" | "acquisition" | "leadership_change" | "expansion" | "competitor" | "other", "summary": string, "source": string, "date": string } ]`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // Pak het laatste JSON-array-blok (robuust tegen tekst/zoek-narratie ervoor).
    const match = text.match(/\[[\s\S]*\]\s*$/) ?? text.match(/\[[\s\S]*\]/);
    let signals: Signal[] = [];
    if (match) {
      try {
        signals = JSON.parse(match[0]);
      } catch {
        signals = [];
      }
    }

    return NextResponse.json({ signals });
  } catch (err) {
    console.error('Enrich error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

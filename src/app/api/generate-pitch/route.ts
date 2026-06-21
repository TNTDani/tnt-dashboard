// src/app/api/generate-pitch/route.ts
// POST -> genereert een Challenger + SPICED cold call pitch. Stateless:
// account + lead + positioning komen in de body (zelfde patroon als generate-cold-email).
// Opslaan gebeurt client-side via accountsDb.savePitch.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  PITCH_MODEL,
  buildPitchSystemPrompt,
  buildPitchUserPrompt,
  parsePitch,
} from '@/lib/pitchPrompt';
import type { Account, AccountLead, AgencyPositioning } from '@/lib/accountTypes';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function normalizeUrl(website: string): string {
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

async function fetchWebsiteText(website: string): Promise<string> {
  try {
    const res = await fetch(normalizeUrl(website), {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim()
      .slice(0, 8000);
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      positioning,
      account,
      lead,
    }: { positioning: AgencyPositioning; account: Account; lead: AccountLead } = await req.json();

    if (!account?.companyName || !lead?.name || !lead?.role) {
      return NextResponse.json({ error: 'Missing account or lead fields' }, { status: 400 });
    }

    // Geen signalen opgeslagen? Pak wat website-context als baseline (zoals de cold-email route).
    const websiteText =
      account.signals?.length === 0 && account.website ? await fetchWebsiteText(account.website) : undefined;

    const response = await anthropic.messages.create({
      model: PITCH_MODEL,
      max_tokens: 4096,
      system: buildPitchSystemPrompt(),
      messages: [{ role: 'user', content: buildPitchUserPrompt({ positioning, account, lead, websiteText }) }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    try {
      const pitch = parsePitch(text);
      return NextResponse.json(pitch);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 502 });
    }
  } catch (err) {
    console.error('Pitch generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

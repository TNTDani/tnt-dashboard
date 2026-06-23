// src/app/api/generate-pitch/route.ts
// POST -> genereert een Challenger + SPICED cold call pitch. Gemeterd: kost credits.

import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { PITCH_MODEL, buildPitchSystemPrompt, buildPitchUserPrompt, parsePitch } from '@/lib/pitchPrompt';
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';
import type { Account, AccountLead, AgencyPositioning } from '@/lib/accountTypes';

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
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    // Saldo-check vooraf.
    if ((await getBalance(agencyId)) < CREDIT_COST.pitch) {
      return NextResponse.json(
        { error: `Insufficient credits. A pitch costs ${CREDIT_COST.pitch} credits.` },
        { status: 402 },
      );
    }

    const {
      positioning,
      account,
      lead,
      language,
    }: { positioning: AgencyPositioning; account: Account; lead: AccountLead; language?: string } = await req.json();

    if (!account?.companyName || !lead?.name || !lead?.role) {
      return NextResponse.json({ error: 'Missing account or lead fields' }, { status: 400 });
    }

    const websiteText =
      account.signals?.length === 0 && account.website ? await fetchWebsiteText(account.website) : undefined;

    const response = await anthropic.messages.create({
      model: PITCH_MODEL,
      max_tokens: 4096,
      system: buildPitchSystemPrompt(language),
      messages: [{ role: 'user', content: buildPitchUserPrompt({ positioning, account, lead, websiteText, language }) }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    let pitch;
    try {
      pitch = parsePitch(text);
    } catch {
      // Parsefout: niets afschrijven.
      return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 502 });
    }

    // Geslaagd -> credits afschrijven + verbruik loggen.
    const { balance } = await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'pitch',
      model: PITCH_MODEL,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    });

    return NextResponse.json({ ...pitch, _creditsBalance: balance });
  } catch (err) {
    console.error('Pitch generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

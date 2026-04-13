import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function normalizeUrl(website: string): string {
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, '');
}

async function fetchWebsiteText(website: string): Promise<string> {
  const base = normalizeUrl(website);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
  };

  let html = '';
  try {
    const res = await fetch(base, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) html = await res.text();
  } catch {
    // ignore
  }

  // Also try /about page for more context
  let aboutHtml = '';
  try {
    const res = await fetch(base + '/about', { headers, signal: AbortSignal.timeout(5000) });
    if (res.ok) aboutHtml = await res.text();
  } catch {
    // ignore
  }

  const combined = (html + '\n' + aboutHtml)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 15000);

  return combined || `Website: ${website}`;
}

const SIGNATURE = `Met vriendelijke groet / Kind regards,

Orchard
info@orchard.io`;

export async function POST(req: NextRequest) {
  try {
    const {
      contactName,
      contactRole,
      companyName,
      website,
      language,
    }: {
      contactName: string;
      contactRole: string;
      companyName: string;
      website?: string;
      language: 'en' | 'nl';
    } = await req.json();

    if (!contactName || !companyName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const websiteText = website ? await fetchWebsiteText(website) : '';
    const firstName = contactName.split(' ')[0];
    const langInstruction = language === 'nl'
      ? 'Write the email in Dutch (Nederlands).'
      : 'Write the email in English.';

    const prompt = `You are a senior recruitment consultant at Orchard, a boutique tech recruitment agency.
Your job is to write a short, personalised cold outreach email to ${firstName} (${contactRole}) at ${companyName}.

COMPANY WEBSITE CONTENT:
${websiteText || `Company: ${companyName}${website ? `, Website: ${website}` : ''}`}

INSTRUCTIONS:
- ${langInstruction}
- Address ${firstName} by first name only
- Reference something specific about what ${companyName} builds, their mission, or recent activity (from the website content above)
- Keep it short: 5-7 lines maximum for the body (not counting greeting and sign-off)
- Choose ONE angle automatically based on company signals:
  * "Funding angle" if they recently raised funding or are scaling fast
  * "Pain point angle" if they are growing/hiring engineers at scale
  * "Exclusivity angle" for boutique/enterprise or niche companies
- End with a soft CTA: suggest a 15-minute call
- Do NOT use generic phrases like "I hope this email finds you well"
- Do NOT mention fees or percentages
- Sound human, warm, and confident — not salesy

SIGNATURE TO USE (always append exactly as-is):
${SIGNATURE}

Return ONLY valid JSON (no markdown):
{
  "subject": "<compelling subject line>",
  "body": "<full email body including greeting and signature>"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    let subject = '';
    let body = '';
    try {
      const parsed = JSON.parse(clean);
      subject = parsed.subject || '';
      body = parsed.body || '';
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({ subject, body });
  } catch (err) {
    console.error('Cold email generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

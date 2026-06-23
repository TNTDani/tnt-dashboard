import { NextRequest, NextResponse } from 'next/server';
import { anthropic, MODEL } from '@/lib/anthropic';
import { fetchWebsiteText } from '@/lib/website';
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';

const SIGNATURE = `Met vriendelijke groet / Kind regards,

Orchard
info@orchard.io`;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    if ((await getBalance(agencyId)) < CREDIT_COST.cold_email) {
      return NextResponse.json(
        { error: `Insufficient credits. This action costs ${CREDIT_COST.cold_email} credits.` },
        { status: 402 },
      );
    }

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
      model: MODEL,
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

    await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'cold_email',
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return NextResponse.json({ subject, body });
  } catch (err) {
    console.error('Cold email generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { anthropic, FAST_MODEL } from '@/lib/anthropic';
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 200) return null;
    return html;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
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
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    if ((await getBalance(agencyId)) < CREDIT_COST.vacancy_parse) {
      return NextResponse.json(
        { error: `Insufficient credits. This action costs ${CREDIT_COST.vacancy_parse} credits.` },
        { status: 402 },
      );
    }

    const { url }: { url: string } = await req.json();

    if (!url?.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const html = await fetchPage(url);
    if (!html) {
      return NextResponse.json({ error: 'Could not fetch the page. It may be blocking automated requests.' }, { status: 422 });
    }

    const pageText = stripHtml(html);

    const prompt = `You are a recruitment data extractor. Extract job details from the following vacancy page text.

PAGE URL: ${url}

PAGE TEXT:
${pageText}

Return ONLY valid JSON (no markdown, no explanation):
{
  "jobTitle": "<exact job title, or null if not found>",
  "skills": ["skill1", "skill2"],
  "seniorityLevel": "<one of: Junior, Medior, Senior, Lead, Principal, Manager, Director, VP, C-Level — infer from context, or null>",
  "salaryMin": <number in euros per year, or null>,
  "salaryMax": <number in euros per year, or null>,
  "location": "<city or city + country, or null>"
}

Rules:
- jobTitle: the primary role title exactly as stated
- skills: extract all mentioned technical skills, tools, languages, frameworks (max 15)
- seniorityLevel: infer from title and description; if ambiguous pick the closest match
- salaryMin / salaryMax: convert to annual euros if stated in other currencies or periods (monthly × 12); null if not mentioned
- location: prefer city name; include country only if outside Netherlands; null if fully remote or not mentioned
- Return null for any field you cannot confidently extract`;

    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(clean);

    await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'vacancy_parse',
      model: FAST_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('Parse vacancy error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ScannedVacancy {
  title: string;
  department: string;
  location: string;
  url: string;
}

const CAREER_PATHS = [
  '/careers',
  '/jobs',
  '/vacatures',
  '/en/careers',
  '/en/jobs',
  '/over-ons/werken-bij',
  '/werken-bij',
  '/work-with-us',
  '/join-us',
  '/working-at',
  '/career',
  '/job-openings',
  '/openings',
  '/join',
  '/nl/careers',
  '/about/careers',
];

function normalizeBase(website: string): string {
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  // Remove trailing slash and any path
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/$/, '');
  }
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Reject pages that are just redirects or near-empty
    if (html.length < 500) return null;
    return html;
  } catch {
    return null;
  }
}

function stripHtml(html: string, pageUrl: string): string {
  let text = html
    // Remove non-content blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Preserve hrefs before stripping tags so Claude can extract URLs
    .replace(/<a\s+[^>]*href=["']([^"']*?)["'][^>]*>/gi, ' [LINK:$1] ')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Clean up entities and whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s{3,}/g, '\n')
    .trim();

  // Prepend the page URL so Claude knows the base for relative links
  return `PAGE_URL: ${pageUrl}\n\n` + text.slice(0, 18000);
}

export async function POST(req: NextRequest) {
  try {
    const { website, companyName }: { website: string; companyName: string } = await req.json();

    if (!website) {
      return NextResponse.json({ error: 'No website URL provided' }, { status: 400 });
    }

    const base = normalizeBase(website);
    let pageUrl: string | null = null;
    let pageHtml: string | null = null;

    // Try career paths one by one, stop at first hit
    for (const path of CAREER_PATHS) {
      const url = base + path;
      const html = await tryFetch(url);
      if (html) {
        pageUrl = url;
        pageHtml = html;
        break;
      }
    }

    // Fall back to the homepage itself if nothing else worked
    if (!pageHtml) {
      pageHtml = await tryFetch(base);
      pageUrl = base;
    }

    if (!pageHtml || !pageUrl) {
      return NextResponse.json({
        error: `Could not reach ${base}. The site may be blocking automated requests.`,
        vacancies: [],
        scannedUrl: null,
      });
    }

    const pageText = stripHtml(pageHtml, pageUrl);

    const prompt = `You are a recruitment assistant. I have scraped the following text from a company's careers/jobs page. Extract all open job vacancies listed on this page.

COMPANY: ${companyName}
SCRAPED PAGE TEXT:
${pageText}

Return ONLY valid JSON (no markdown, no explanation):
{
  "vacancies": [
    {
      "title": "<exact job title>",
      "department": "<team/department, or empty string if unknown>",
      "location": "<city/country or 'Remote' or empty string if unknown>",
      "url": "<full URL to the vacancy page - use PAGE_URL as base for relative links, or empty string>"
    }
  ]
}

Rules:
- Only include real, specific job titles (not section headings like "Engineering" or "Join us")
- If you see NO job listings, return { "vacancies": [] }
- For relative links like /jobs/123, prepend the PAGE_URL host
- Keep "department" and "location" short (under 50 chars)
- Maximum 50 vacancies`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    let vacancies: ScannedVacancy[] = [];
    try {
      const parsed = JSON.parse(clean);
      vacancies = Array.isArray(parsed.vacancies) ? parsed.vacancies : [];
    } catch {
      // Claude returned something unparseable — return empty
    }

    return NextResponse.json({ vacancies, scannedUrl: pageUrl });
  } catch (err) {
    console.error('Vacancy scan error:', err);
    return NextResponse.json({ error: String(err), vacancies: [], scannedUrl: null }, { status: 500 });
  }
}

// Shared website-fetching helpers used by generate-pitch, enrich-account, generate-cold-email, scan-vacancies.

export function normalizeUrl(website: string): string {
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

export function stripHtml(html: string): string {
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
    .trim();
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
};

async function tryGet(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/** Fetches homepage + /about, strips HTML, returns up to 15 000 chars of text. */
export async function fetchWebsiteText(website: string): Promise<string> {
  const base = normalizeUrl(website);
  const [homeHtml, aboutHtml] = await Promise.all([
    tryGet(base),
    tryGet(base + '/about', 5000),
  ]);
  const combined = stripHtml(homeHtml + '\n' + aboutHtml).slice(0, 15000);
  return combined || `Website: ${website}`;
}

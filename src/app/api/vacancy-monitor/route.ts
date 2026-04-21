import { NextResponse } from "next/server";
import { VacancyListing, VacancyCategory, VacancySourceId } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

// ─── Types ────────────────────────────────────────────────────────────────────
type SourceStatus = "ok" | "error" | "empty" | "not_configured";

interface FetchResult {
  listings: VacancyListing[];
  status: SourceStatus;
  error?: string;
  count?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMEOUT = 15_000;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// ─── Category detection ───────────────────────────────────────────────────────
function detectCategory(text: string): VacancyCategory {
  const t = text.toLowerCase();
  if (/\b(bdr|sdr|account executive|sales|business development|account manager)\b/.test(t)) return "sales";
  if (/\b(ux|ui|user experience|user interface|product design|visual design|figma)\b/.test(t)) return "design";
  if (/\b(ai engineer|machine learning|ml engineer|data scientist|llm|deep learning|nlp|artificial intelligence)\b/.test(t)) return "ai";
  if (/\b(product manager|product owner|product lead|head of product)\b/.test(t)) return "product";
  if (/\b(software engineer|developer|frontend|backend|fullstack|devops|sre|typescript|react|python|java|node\.?js|golang|rust|kubernetes)\b/.test(t)) return "engineering";
  return "other";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 500);
}

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── NL location filter ───────────────────────────────────────────────────────
const NL_LOCATION = /netherlands|amsterdam|nederland|nl\b|den haag|rotterdam|utrecht|eindhoven/i;

function isNLJob(location: string, extra = ""): boolean {
  return NL_LOCATION.test(location) || NL_LOCATION.test(extra.slice(0, 300));
}

// ─── Role relevance filter ────────────────────────────────────────────────────
const RELEVANT = /developer|engineer|designer|sales|bdr|sdr|account executive|product manager|product owner|frontend|backend|fullstack|data scientist|machine learning|ai\b|devops|ux|ui\b|software/i;

function isRelevant(title: string, tags: string[] = []): boolean {
  return RELEVANT.test(title) || tags.some(t => RELEVANT.test(t));
}

// ─── Deduplication ────────────────────────────────────────────────────────────
function dedup(listings: VacancyListing[]): VacancyListing[] {
  const seen = new Set<string>();
  return listings.filter(l => {
    const key = `${l.title.toLowerCase().trim()}|${l.company.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1 — Arbeitnow (free, no auth)
// https://www.arbeitnow.com/api/job-board-api
// ─────────────────────────────────────────────────────────────────────────────
async function fetchArbeitnow(): Promise<FetchResult> {
  const source: VacancySourceId = "arbeitnow";
  try {
    const pages = await Promise.all([
      safeFetch("https://www.arbeitnow.com/api/job-board-api?page=1", { headers: HEADERS }),
      safeFetch("https://www.arbeitnow.com/api/job-board-api?page=2", { headers: HEADERS }),
    ]);

    type ArbJob = {
      slug: string; company_name: string; title: string;
      description: string; remote: boolean; url: string;
      tags: string[]; location: string; created_at: number;
    };
    const allJobs: ArbJob[] = [];
    for (const res of pages) {
      if (!res.ok) continue;
      const json = await res.json() as { data?: ArbJob[] };
      if (json.data) allJobs.push(...json.data);
    }

    if (allJobs.length === 0) return { listings: [], status: "empty", count: 0 };

    const listings: VacancyListing[] = allJobs
      .filter(j => isNLJob(j.location, j.description) && isRelevant(j.title, j.tags))
      .map(j => ({
        id: uuidv4(),
        title: j.title,
        company: j.company_name || "",
        source,
        location: j.location || "Netherlands",
        postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
        description: stripHtml(j.description),
        url: j.url,
        category: detectCategory(`${j.title} ${j.tags.join(" ")}`),
      }));

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2 — RemoteOK (free, no auth)
// https://remoteok.com/api
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRemoteOK(): Promise<FetchResult> {
  const source: VacancySourceId = "remoteok";
  try {
    const res = await safeFetch("https://remoteok.com/api", { headers: HEADERS });
    if (!res.ok) return { listings: [], status: "error", error: `HTTP ${res.status} ${res.statusText}`, count: 0 };

    const json = await res.json() as Array<{
      id?: string | number; company?: string; position?: string;
      tags?: string[]; description?: string; location?: string;
      original_url?: string; url?: string; date?: string; epoch?: number;
    }>;

    const jobs = Array.isArray(json) ? json.slice(1) : [];
    if (jobs.length === 0) return { listings: [], status: "empty", count: 0 };

    const listings: VacancyListing[] = jobs
      .filter(j =>
        j.position &&
        isNLJob(j.location || "", (j.tags || []).join(" ") + " " + (j.description || "")) &&
        isRelevant(j.position, j.tags || [])
      )
      .map(j => ({
        id: uuidv4(),
        title: j.position!,
        company: j.company || "",
        source,
        location: j.location || "Remote / Netherlands",
        postedAt: j.epoch
          ? new Date(j.epoch * 1000).toISOString()
          : j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
        description: stripHtml(j.description || ""),
        url: j.original_url || j.url || `https://remoteok.com/jobs/${j.id}`,
        category: detectCategory(`${j.position} ${(j.tags || []).join(" ")}`),
      }));

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3 — Jobicy (free, no auth, European remote jobs)
// https://jobicy.com/api/v2/remote-jobs?count=50&geo=netherlands&industry=tech
// ─────────────────────────────────────────────────────────────────────────────
async function fetchJobicy(): Promise<FetchResult> {
  const source: VacancySourceId = "jobicy";
  try {
    // Fetch multiple industry verticals in parallel
    const industries = ["tech", "design", "marketing"];
    const responses = await Promise.allSettled(
      industries.map(ind =>
        safeFetch(
          `https://jobicy.com/api/v2/remote-jobs?count=50&geo=netherlands&industry=${ind}`,
          { headers: HEADERS }
        )
      )
    );

    type JobicyJob = {
      id: number; url: string; jobTitle: string; companyName: string;
      jobGeo: string; jobIndustry: string[]; jobType: string[];
      jobExcerpt: string; jobDescription: string; pubDate: string;
    };

    const allJobs: JobicyJob[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      const json = await r.value.json() as { jobs?: JobicyJob[] };
      if (json.jobs) allJobs.push(...json.jobs);
    }

    if (allJobs.length === 0) return { listings: [], status: "empty", count: 0 };

    // Deduplicate by id
    const seen = new Set<number>();
    const unique = allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });

    const listings: VacancyListing[] = unique.map(j => ({
      id: uuidv4(),
      title: j.jobTitle,
      company: j.companyName || "",
      source,
      location: j.jobGeo || "Netherlands",
      postedAt: j.pubDate ? new Date(j.pubDate).toISOString() : new Date().toISOString(),
      description: stripHtml(j.jobExcerpt || j.jobDescription || ""),
      url: j.url,
      category: detectCategory(`${j.jobTitle} ${(j.jobIndustry || []).join(" ")} ${j.jobExcerpt || ""}`),
    }));

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 4 — Findwork (free API key required — findwork.dev/developers)
// GET https://findwork.dev/api/jobs/?location=amsterdam&ordering=-date
// Auth: Authorization: Token YOUR_KEY
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFindwork(): Promise<FetchResult> {
  const source: VacancySourceId = "findwork";
  const apiKey = process.env.FINDWORK_API_KEY;

  if (!apiKey) {
    return {
      listings: [],
      status: "not_configured",
      error: "FINDWORK_API_KEY not set — register free at findwork.dev/developers",
      count: 0,
    };
  }

  try {
    const res = await safeFetch(
      "https://findwork.dev/api/jobs/?location=amsterdam&ordering=-date",
      {
        headers: {
          ...HEADERS,
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    if (res.status === 401 || res.status === 403) {
      return {
        listings: [],
        status: "error",
        error: `API key rejected (HTTP ${res.status}) — check your FINDWORK_API_KEY`,
        count: 0,
      };
    }
    if (!res.ok) {
      return { listings: [], status: "error", error: `HTTP ${res.status} ${res.statusText}`, count: 0 };
    }

    type FindworkJob = {
      id: number; role: string; company_name: string;
      employment_type: string; keywords: string[]; date_posted: string;
      url: string; text: string; location: string; remote: boolean;
    };

    const json = await res.json() as { count?: number; results?: FindworkJob[] };
    const jobs = json.results || [];
    if (jobs.length === 0) return { listings: [], status: "empty", count: 0 };

    const listings: VacancyListing[] = jobs.map(j => ({
      id: uuidv4(),
      title: j.role,
      company: j.company_name || "",
      source,
      location: j.location || "Amsterdam",
      postedAt: j.date_posted ? new Date(j.date_posted).toISOString() : new Date().toISOString(),
      description: stripHtml(j.text || ""),
      url: j.url,
      category: detectCategory(`${j.role} ${(j.keywords || []).join(" ")}`),
    }));

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 5 — EuroJobs RSS feed
// https://www.eurojobs.com/search-results/?keywords=developer&location=amsterdam
// ─────────────────────────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  const cd = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cd) return cd[1].trim();
  const pl = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return pl ? pl[1].replace(/<[^>]+>/g, "").trim() : "";
}

function parseRSSItems(xml: string, source: VacancySourceId): VacancyListing[] {
  const items: VacancyListing[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];
    const title = extractXmlTag(raw, "title");
    if (!title) continue;
    const link = extractXmlTag(raw, "link") || extractXmlTag(raw, "guid");
    const desc = stripHtml(extractXmlTag(raw, "description"));
    const pubDate = extractXmlTag(raw, "pubDate") || extractXmlTag(raw, "dc:date");
    const location = extractXmlTag(raw, "location") || "Amsterdam";
    const company = extractXmlTag(raw, "author") || extractXmlTag(raw, "dc:creator") || "";

    let postedAt = new Date().toISOString();
    try { if (pubDate) postedAt = new Date(pubDate).toISOString(); } catch { /* ignore */ }

    items.push({
      id: uuidv4(),
      title,
      company,
      source,
      location,
      postedAt,
      description: desc,
      url: link || "",
      category: detectCategory(`${title} ${desc}`),
    });
  }
  return items;
}

async function fetchEuroJobs(): Promise<FetchResult> {
  const source: VacancySourceId = "eurojobs";
  const queries = ["developer amsterdam", "designer amsterdam", "engineer amsterdam", "sales amsterdam"];
  const rssHeaders = { ...HEADERS, Accept: "application/rss+xml, application/xml, text/xml, */*" };

  try {
    const urls = queries.map(
      q => `https://www.eurojobs.com/search-results/rss/?keywords=${encodeURIComponent(q)}&country=Netherlands`
    );

    const responses = await Promise.allSettled(urls.map(u => safeFetch(u, { headers: rssHeaders })));
    const allListings: VacancyListing[] = [];

    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      const text = await r.value.text();
      if (!text.includes("<item>")) continue;
      allListings.push(...parseRSSItems(text, source));
    }

    if (allListings.length === 0) {
      // Try alternate URL pattern
      const alt = await safeFetch(
        "https://www.eurojobs.com/rss/?keywords=engineer&location=netherlands",
        { headers: rssHeaders }
      );
      if (alt.ok) {
        const text = await alt.text();
        if (text.includes("<item>")) allListings.push(...parseRSSItems(text, source));
      }
    }

    return {
      listings: allListings,
      status: allListings.length > 0 ? "ok" : "empty",
      count: allListings.length,
      error: allListings.length === 0 ? "No RSS items returned — EuroJobs may have changed their feed URL" : undefined,
    };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 6 — Startup.jobs (free, no auth, startup-focused)
// https://startup.jobs/api/v1/jobs?location=amsterdam
// ─────────────────────────────────────────────────────────────────────────────
async function fetchStartupJobs(): Promise<FetchResult> {
  const source: VacancySourceId = "startupjobs";
  try {
    // Try multiple endpoint variations since the API is undocumented
    const urls = [
      "https://startup.jobs/api/v1/jobs?location=amsterdam&remote=false",
      "https://startup.jobs/api/v1/jobs?location=Netherlands",
      "https://startup.jobs/api/v1/jobs?location=amsterdam",
    ];

    let jobs: unknown[] = [];
    let lastError = "";

    for (const url of urls) {
      try {
        const res = await safeFetch(url, { headers: HEADERS });
        if (!res.ok) {
          lastError = `HTTP ${res.status} ${res.statusText}`;
          continue;
        }
        const json = await res.json() as unknown;
        // Handle various response shapes
        if (Array.isArray(json)) { jobs = json; break; }
        if (json && typeof json === "object") {
          const obj = json as Record<string, unknown>;
          const found = obj.jobs || obj.results || obj.data || obj.listings;
          if (Array.isArray(found)) { jobs = found; break; }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (jobs.length === 0) {
      return {
        listings: [],
        status: "empty",
        count: 0,
        error: lastError || "No jobs returned — startup.jobs API may have changed",
      };
    }

    const listings: VacancyListing[] = jobs
      .filter(j => j && typeof j === "object")
      .map(j => {
        const job = j as Record<string, unknown>;
        const company = (job.company && typeof job.company === "object")
          ? (job.company as Record<string, unknown>).name as string || ""
          : String(job.company || job.company_name || "");
        const title = String(job.title || job.job_title || job.name || "");
        const location = String(job.location || job.city || "Amsterdam");
        const url = String(job.url || job.apply_url || job.link || "");
        const desc = stripHtml(String(job.description || job.excerpt || job.summary || ""));
        const dateStr = String(job.created_at || job.date || job.published_at || "");
        let postedAt = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }
        return { id: uuidv4(), title, company, source, location, postedAt, description: desc, url, category: detectCategory(`${title} ${desc}`) };
      })
      .filter(j => j.title && j.url && isNLJob(j.location));

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 7 — Nationale Vacaturebank (free public API, no auth)
// GET https://api.nationalevacaturebank.nl/vacatures?q=...&location=Amsterdam&distance=25
// ─────────────────────────────────────────────────────────────────────────────
async function fetchNVB(): Promise<FetchResult> {
  const source: VacancySourceId = "nvb";
  const queries = [
    "software engineer",
    "UX designer",
    "BDR",
    "SDR",
    "product manager",
    "AI engineer",
  ];

  try {
    const responses = await Promise.allSettled(
      queries.map(q =>
        safeFetch(
          `https://api.nationalevacaturebank.nl/vacatures?q=${encodeURIComponent(q)}&location=Amsterdam&distance=25`,
          {
            headers: {
              ...HEADERS,
              Accept: "application/json",
              "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            },
          }
        )
      )
    );

    // NVB response shape — field names may be Dutch or English, handle both
    type NVBVacature = Record<string, unknown>;

    function str(obj: NVBVacature, ...keys: string[]): string {
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "object" && v !== null && "naam" in v) return String((v as Record<string, unknown>).naam || "").trim();
      }
      return "";
    }

    const allVacatures: NVBVacature[] = [];
    const seenIds = new Set<string>();

    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      let json: unknown;
      try { json = await r.value.json(); } catch { continue; }

      // Extract the array from whatever wrapper the API uses
      let items: NVBVacature[] = [];
      if (Array.isArray(json)) {
        items = json as NVBVacature[];
      } else if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const found = obj.vacatures ?? obj.results ?? obj.data ?? obj.items ?? obj.jobs;
        if (Array.isArray(found)) items = found as NVBVacature[];
      }

      for (const item of items) {
        // Use id, url, or title+company as dedup key
        const id = str(item, "id", "vacatureId", "uid");
        const key = id || `${str(item, "titel", "title", "functienaam")}|${str(item, "bedrijf", "werkgever", "company", "organisatie")}`;
        if (!key || seenIds.has(key)) continue;
        seenIds.add(key);
        allVacatures.push(item);
      }
    }

    if (allVacatures.length === 0) {
      return {
        listings: [],
        status: "empty",
        count: 0,
        error: "API returned 0 results — endpoint or parameters may have changed",
      };
    }

    const listings: VacancyListing[] = allVacatures
      .map(v => {
        const title    = str(v, "titel", "title", "functienaam", "jobtitle", "functie");
        const company  = str(v, "bedrijf", "werkgever", "company", "organisatie", "employer");
        const location = str(v, "locatie", "location", "standplaats", "plaats", "city") || "Amsterdam";
        const desc     = stripHtml(str(v, "omschrijving", "description", "samenvatting", "intro", "tekst"));
        const url      = str(v, "url", "vacatureUrl", "link", "detailUrl", "href", "applicationUrl");
        const dateStr  = str(v, "datum", "date", "publicatiedatum", "plaatsingsdatum", "created_at", "postedAt");
        let postedAt   = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }

        return { id: uuidv4(), title, company, source, location, postedAt, description: desc, url: url || "https://www.nationalevacaturebank.nl", category: detectCategory(`${title} ${desc}`) };
      })
      .filter(l => l.title.length > 0);

    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 8 — Wellfound (AngelList) — Amsterdam startups
// Public jobs feed — no auth required for public listings
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWellfound(): Promise<FetchResult> {
  const source: VacancySourceId = "wellfound";
  try {
    // Wellfound exposes a public JSON jobs feed; filter by Amsterdam startup roles
    const queries = ["amsterdam", "netherlands"];
    const allJobs: VacancyListing[] = [];

    for (const q of queries) {
      const res = await safeFetch(
        `https://wellfound.com/jobs/api/jobs?location=${encodeURIComponent(q)}`,
        {
          headers: {
            ...HEADERS,
            "X-Requested-With": "XMLHttpRequest",
            Referer: "https://wellfound.com/jobs",
          },
        }
      );
      if (!res.ok) continue;

      let json: unknown;
      try { json = await res.json(); } catch { continue; }

      // Extract jobs from various possible response shapes
      let jobs: unknown[] = [];
      if (Array.isArray(json)) {
        jobs = json;
      } else if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const found = obj.jobs ?? obj.results ?? obj.data ?? obj.startupRoles ?? obj.jobListings;
        if (Array.isArray(found)) jobs = found;
      }

      for (const j of jobs) {
        if (!j || typeof j !== "object") continue;
        const job = j as Record<string, unknown>;

        // Handle nested startup/company object
        let company = "";
        if (job.startup && typeof job.startup === "object") {
          company = String((job.startup as Record<string, unknown>).name || "");
        }
        company = company || String(job.company || job.company_name || "");

        const title = String(job.title || job.role || job.job_title || "");
        const location = String(job.location || job.city || "Amsterdam, Netherlands");
        if (!title) continue;
        if (!isNLJob(location)) continue;

        const url = (() => {
          const raw = String(job.url || job.apply_url || job.jobUrl || job.link || "");
          if (raw.startsWith("http")) return raw;
          if (raw.startsWith("/")) return `https://wellfound.com${raw}`;
          return `https://wellfound.com/jobs`;
        })();

        const dateStr = String(job.created_at || job.postedAt || job.published_at || "");
        let postedAt = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }

        const desc = stripHtml(String(job.description || job.excerpt || job.summary || ""));

        allJobs.push({
          id: uuidv4(),
          title,
          company,
          source,
          location,
          postedAt,
          description: desc,
          url,
          category: detectCategory(`${title} ${desc}`),
        });
      }
    }

    if (allJobs.length === 0) {
      return {
        listings: [],
        status: "empty",
        count: 0,
        error: "No results — Wellfound may require authentication for their jobs API",
      };
    }

    return { listings: allJobs, status: "ok", count: allJobs.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 9 — Greenhouse public job boards
// GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs
// No auth required — uses known Amsterdam tech company board tokens
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGreenhouse(): Promise<FetchResult> {
  const source: VacancySourceId = "greenhouse";

  // Amsterdam / Netherlands tech companies with public Greenhouse boards
  const COMPANIES = [
    "booking",          // Booking.com
    "adyen",            // Adyen
    "messagebird",      // MessageBird / Bird
    "mollie",           // Mollie
    "picnic",           // Picnic
    "sendcloud",        // Sendcloud
    "catawiki",         // Catawiki
    "channable",        // Channable
    "backbase",         // Backbase
    "templafy",         // Templafy
    "lightspeedpos",    // Lightspeed
    "miro",             // Miro (NL office)
    "takeaway",         // Just Eat Takeaway
    "elastic",          // Elastic (Amsterdam office)
  ];

  type GHJob = {
    id: number;
    title: string;
    updated_at: string;
    absolute_url: string;
    location: { name: string };
    departments?: { name: string }[];
    content?: string;
  };

  try {
    const responses = await Promise.allSettled(
      COMPANIES.map(co =>
        safeFetch(`https://boards-api.greenhouse.io/v1/boards/${co}/jobs?content=true`, { headers: HEADERS })
      )
    );

    const allListings: VacancyListing[] = [];

    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const co = COMPANIES[i];
      if (r.status !== "fulfilled" || !r.value.ok) continue;

      let json: unknown;
      try { json = await r.value.json(); } catch { continue; }

      let jobs: GHJob[] = [];
      if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        if (Array.isArray(obj.jobs)) jobs = obj.jobs as GHJob[];
      }

      for (const j of jobs) {
        const location = j.location?.name || "";
        if (!isNLJob(location)) continue;

        const dept = j.departments?.[0]?.name || "";
        allListings.push({
          id: uuidv4(),
          title: j.title,
          company: co.charAt(0).toUpperCase() + co.slice(1),
          source,
          location,
          postedAt: j.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(),
          description: stripHtml(j.content || ""),
          url: j.absolute_url || `https://boards.greenhouse.io/${co}`,
          category: detectCategory(`${j.title} ${dept}`),
        });
      }
    }

    if (allListings.length === 0) {
      return {
        listings: [],
        status: "empty",
        count: 0,
        error: "No NL-based roles found across Greenhouse company boards",
      };
    }

    return { listings: allListings, status: "ok", count: allListings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 10 — Lever public job boards
// GET https://api.lever.co/v0/postings/{company}?mode=json
// No auth required — uses known Amsterdam tech company board tokens
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLever(): Promise<FetchResult> {
  const source: VacancySourceId = "lever";

  // Amsterdam / Netherlands tech companies with public Lever boards
  const COMPANIES = [
    "netflix",          // Netflix (Amsterdam office)
    "datadog",          // Datadog (Amsterdam)
    "miro",             // Miro
    "typeform",         // Typeform (NL users)
    "contentful",       // Contentful (Berlin/Amsterdam)
    "personio",         // Personio (Amsterdam)
    "hotjar",           // Hotjar
    "vimeo",            // Vimeo
    "intercom",         // Intercom
    "gitlab",           // GitLab (remote-first, NL)
    "mercury",          // Mercury
    "vercel",           // Vercel (remote)
    "notion",           // Notion
    "figma",            // Figma (NL office)
  ];

  type LeverPosting = {
    id: string;
    text: string;                   // job title
    categories: { location?: string; team?: string; department?: string; commitment?: string };
    description?: string;
    descriptionPlain?: string;
    hostedUrl: string;
    createdAt: number;              // Unix ms
    workplaceType?: string;
  };

  try {
    const responses = await Promise.allSettled(
      COMPANIES.map(co =>
        safeFetch(`https://api.lever.co/v0/postings/${co}?mode=json`, { headers: HEADERS })
      )
    );

    const allListings: VacancyListing[] = [];

    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const co = COMPANIES[i];
      if (r.status !== "fulfilled" || !r.value.ok) continue;

      let jobs: LeverPosting[] = [];
      try {
        const json = await r.value.json() as unknown;
        if (Array.isArray(json)) jobs = json as LeverPosting[];
      } catch { continue; }

      for (const j of jobs) {
        const location = j.categories?.location || "";
        if (!isNLJob(location, j.descriptionPlain || "")) continue;

        const team = j.categories?.team || j.categories?.department || "";
        const desc = stripHtml(j.descriptionPlain || j.description || "");

        allListings.push({
          id: uuidv4(),
          title: j.text,
          company: co.charAt(0).toUpperCase() + co.slice(1),
          source,
          location: location || "Netherlands",
          postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
          description: desc,
          url: j.hostedUrl || `https://jobs.lever.co/${co}`,
          category: detectCategory(`${j.text} ${team} ${desc}`),
        });
      }
    }

    if (allListings.length === 0) {
      return {
        listings: [],
        status: "empty",
        count: 0,
        error: "No NL-based roles found across Lever company boards",
      };
    }

    return { listings: allListings, status: "ok", count: allListings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET() {
  const [arbeitnow, remoteok, jobicy, findwork, eurojobs, startupjobs, nvb, wellfound, greenhouse, lever] = await Promise.allSettled([
    fetchArbeitnow(),
    fetchRemoteOK(),
    fetchJobicy(),
    fetchFindwork(),
    fetchEuroJobs(),
    fetchStartupJobs(),
    fetchNVB(),
    fetchWellfound(),
    fetchGreenhouse(),
    fetchLever(),
  ]);

  const extract = (r: PromiseSettledResult<FetchResult>): FetchResult =>
    r.status === "fulfilled"
      ? r.value
      : { listings: [], status: "error", error: String((r as PromiseRejectedResult).reason), count: 0 };

  const results: Record<VacancySourceId, FetchResult> = {
    arbeitnow:   extract(arbeitnow),
    remoteok:    extract(remoteok),
    jobicy:      extract(jobicy),
    findwork:    extract(findwork),
    eurojobs:    extract(eurojobs),
    startupjobs: extract(startupjobs),
    nvb:         extract(nvb),
    wellfound:   extract(wellfound),
    greenhouse:  extract(greenhouse),
    lever:       extract(lever),
  };

  const raw: VacancyListing[] = (Object.values(results) as FetchResult[]).flatMap(r => r.listings);
  const listings = dedup(raw).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  const sourceStatuses = Object.fromEntries(
    (Object.entries(results) as [VacancySourceId, FetchResult][]).map(([k, v]) => [k, v.status])
  ) as Record<VacancySourceId, SourceStatus>;

  const sourceErrors = Object.fromEntries(
    (Object.entries(results) as [VacancySourceId, FetchResult][])
      .filter(([, v]) => v.error)
      .map(([k, v]) => [k, v.error!])
  ) as Partial<Record<VacancySourceId, string>>;

  const sourceCounts = Object.fromEntries(
    (Object.entries(results) as [VacancySourceId, FetchResult][]).map(([k, v]) => [k, v.count ?? 0])
  ) as Partial<Record<VacancySourceId, number>>;

  return NextResponse.json({ listings, sourceStatuses, sourceErrors, sourceCounts, fetchedAt: new Date().toISOString() });
}

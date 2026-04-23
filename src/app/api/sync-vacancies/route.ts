import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { VacancyListing, VacancyCategory, VacancySourceId } from "@/lib/types";

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

const SOURCE_IDS: VacancySourceId[] = [
  "arbeitnow", "remoteok", "jobicy", "findwork",
  "eurojobs", "startupjobs", "nvb", "wellfound",
  "greenhouse", "lever",
];

// ─── Stable ID ────────────────────────────────────────────────────────────────
// Produces a 40-char hex string from source + URL (or source + title + company
// as fallback). Deterministic across sync runs — enables upsert-based sync.

function stableId(source: string, url: string, title: string, company: string): string {
  const key = url?.startsWith("http")
    ? `${source}||${url}`
    : `${source}||${title.toLowerCase().trim()}||${company.toLowerCase().trim()}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

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

const NL_LOCATION = /netherlands|amsterdam|nederland|nl\b|den haag|rotterdam|utrecht|eindhoven/i;
function isNLJob(location: string, extra = ""): boolean {
  return NL_LOCATION.test(location) || NL_LOCATION.test(extra.slice(0, 300));
}

const RELEVANT = /developer|engineer|designer|sales|bdr|sdr|account executive|product manager|product owner|frontend|backend|fullstack|data scientist|machine learning|ai\b|devops|ux|ui\b|software/i;
function isRelevant(title: string, tags: string[] = []): boolean {
  return RELEVANT.test(title) || tags.some(t => RELEVANT.test(t));
}

// ─── Source fetchers ──────────────────────────────────────────────────────────
// Each returns a plain VacancyListing[] with temporary UUIDs as IDs.
// Stable IDs are computed after fetching via stableId().

async function fetchArbeitnow(): Promise<FetchResult> {
  const source: VacancySourceId = "arbeitnow";
  try {
    const pages = await Promise.all([
      safeFetch("https://www.arbeitnow.com/api/job-board-api?page=1", { headers: HEADERS }),
      safeFetch("https://www.arbeitnow.com/api/job-board-api?page=2", { headers: HEADERS }),
    ]);
    type ArbJob = { slug: string; company_name: string; title: string; description: string; remote: boolean; url: string; tags: string[]; location: string; created_at: number };
    const allJobs: ArbJob[] = [];
    for (const res of pages) {
      if (!res.ok) continue;
      const json = await res.json() as { data?: ArbJob[] };
      if (json.data) allJobs.push(...json.data);
    }
    if (allJobs.length === 0) return { listings: [], status: "empty", count: 0 };
    const listings: VacancyListing[] = allJobs
      .filter(j => isNLJob(j.location, j.description) && isRelevant(j.title, j.tags))
      .map(j => ({ id: "", title: j.title, company: j.company_name || "", source, location: j.location || "Netherlands", postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(), description: stripHtml(j.description), url: j.url, category: detectCategory(`${j.title} ${j.tags.join(" ")}`) }));
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchRemoteOK(): Promise<FetchResult> {
  const source: VacancySourceId = "remoteok";
  try {
    const res = await safeFetch("https://remoteok.com/api", { headers: HEADERS });
    if (!res.ok) return { listings: [], status: "error", error: `HTTP ${res.status}`, count: 0 };
    const json = await res.json() as Array<{ id?: string | number; company?: string; position?: string; tags?: string[]; description?: string; location?: string; original_url?: string; url?: string; date?: string; epoch?: number }>;
    const jobs = Array.isArray(json) ? json.slice(1) : [];
    if (jobs.length === 0) return { listings: [], status: "empty", count: 0 };
    const listings: VacancyListing[] = jobs
      .filter(j => j.position && isNLJob(j.location || "", (j.tags || []).join(" ") + " " + (j.description || "")) && isRelevant(j.position, j.tags || []))
      .map(j => ({ id: "", title: j.position!, company: j.company || "", source, location: j.location || "Remote / Netherlands", postedAt: j.epoch ? new Date(j.epoch * 1000).toISOString() : j.date ? new Date(j.date).toISOString() : new Date().toISOString(), description: stripHtml(j.description || ""), url: j.original_url || j.url || `https://remoteok.com/jobs/${j.id}`, category: detectCategory(`${j.position} ${(j.tags || []).join(" ")}`) }));
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchJobicy(): Promise<FetchResult> {
  const source: VacancySourceId = "jobicy";
  try {
    const industries = ["tech", "design", "marketing"];
    const responses = await Promise.allSettled(industries.map(ind => safeFetch(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=netherlands&industry=${ind}`, { headers: HEADERS })));
    type JobicyJob = { id: number; url: string; jobTitle: string; companyName: string; jobGeo: string; jobIndustry: string[]; jobExcerpt: string; jobDescription: string; pubDate: string };
    const allJobs: JobicyJob[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      const json = await r.value.json() as { jobs?: JobicyJob[] };
      if (json.jobs) allJobs.push(...json.jobs);
    }
    if (allJobs.length === 0) return { listings: [], status: "empty", count: 0 };
    const seen = new Set<number>();
    const unique = allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
    const listings: VacancyListing[] = unique.map(j => ({ id: "", title: j.jobTitle, company: j.companyName || "", source, location: j.jobGeo || "Netherlands", postedAt: j.pubDate ? new Date(j.pubDate).toISOString() : new Date().toISOString(), description: stripHtml(j.jobExcerpt || j.jobDescription || ""), url: j.url, category: detectCategory(`${j.jobTitle} ${(j.jobIndustry || []).join(" ")} ${j.jobExcerpt || ""}`) }));
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchFindwork(): Promise<FetchResult> {
  const source: VacancySourceId = "findwork";
  const apiKey = process.env.FINDWORK_API_KEY;
  if (!apiKey) return { listings: [], status: "not_configured", error: "FINDWORK_API_KEY not set", count: 0 };
  try {
    const res = await safeFetch("https://findwork.dev/api/jobs/?location=amsterdam&ordering=-date", { headers: { ...HEADERS, Authorization: `Token ${apiKey}` } });
    if (res.status === 401 || res.status === 403) return { listings: [], status: "error", error: `API key rejected (HTTP ${res.status})`, count: 0 };
    if (!res.ok) return { listings: [], status: "error", error: `HTTP ${res.status}`, count: 0 };
    type FindworkJob = { id: number; role: string; company_name: string; keywords: string[]; date_posted: string; url: string; text: string; location: string };
    const json = await res.json() as { results?: FindworkJob[] };
    const jobs = json.results || [];
    if (jobs.length === 0) return { listings: [], status: "empty", count: 0 };
    const listings: VacancyListing[] = jobs.map(j => ({ id: "", title: j.role, company: j.company_name || "", source, location: j.location || "Amsterdam", postedAt: j.date_posted ? new Date(j.date_posted).toISOString() : new Date().toISOString(), description: stripHtml(j.text || ""), url: j.url, category: detectCategory(`${j.role} ${(j.keywords || []).join(" ")}`) }));
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

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
    items.push({ id: "", title, company, source, location, postedAt, description: desc, url: link || "", category: detectCategory(`${title} ${desc}`) });
  }
  return items;
}

async function fetchEuroJobs(): Promise<FetchResult> {
  const source: VacancySourceId = "eurojobs";
  const rssHeaders = { ...HEADERS, Accept: "application/rss+xml, application/xml, text/xml, */*" };
  try {
    const queries = ["developer amsterdam", "designer amsterdam", "engineer amsterdam", "sales amsterdam"];
    const responses = await Promise.allSettled(queries.map(q => safeFetch(`https://www.eurojobs.com/search-results/rss/?keywords=${encodeURIComponent(q)}&country=Netherlands`, { headers: rssHeaders })));
    const allListings: VacancyListing[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      const text = await r.value.text();
      if (text.includes("<item>")) allListings.push(...parseRSSItems(text, source));
    }
    return { listings: allListings, status: allListings.length > 0 ? "ok" : "empty", count: allListings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchStartupJobs(): Promise<FetchResult> {
  const source: VacancySourceId = "startupjobs";
  try {
    const urls = ["https://startup.jobs/api/v1/jobs?location=amsterdam&remote=false", "https://startup.jobs/api/v1/jobs?location=Netherlands", "https://startup.jobs/api/v1/jobs?location=amsterdam"];
    let jobs: unknown[] = [];
    for (const url of urls) {
      try {
        const res = await safeFetch(url, { headers: HEADERS });
        if (!res.ok) continue;
        const json = await res.json() as unknown;
        if (Array.isArray(json)) { jobs = json; break; }
        if (json && typeof json === "object") {
          const obj = json as Record<string, unknown>;
          const found = obj.jobs || obj.results || obj.data || obj.listings;
          if (Array.isArray(found)) { jobs = found; break; }
        }
      } catch { /* try next */ }
    }
    if (jobs.length === 0) return { listings: [], status: "empty", count: 0 };
    const listings: VacancyListing[] = jobs
      .filter(j => j && typeof j === "object")
      .map(j => {
        const job = j as Record<string, unknown>;
        const company = (job.company && typeof job.company === "object") ? (job.company as Record<string, unknown>).name as string || "" : String(job.company || job.company_name || "");
        const title = String(job.title || job.job_title || job.name || "");
        const location = String(job.location || job.city || "Amsterdam");
        const url = String(job.url || job.apply_url || job.link || "");
        const desc = stripHtml(String(job.description || job.excerpt || job.summary || ""));
        const dateStr = String(job.created_at || job.date || job.published_at || "");
        let postedAt = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }
        return { id: "", title, company, source, location, postedAt, description: desc, url, category: detectCategory(`${title} ${desc}`) };
      })
      .filter(j => j.title && j.url && isNLJob(j.location));
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchNVB(): Promise<FetchResult> {
  const source: VacancySourceId = "nvb";
  const queries = ["software engineer", "UX designer", "BDR", "SDR", "product manager", "AI engineer"];
  try {
    const responses = await Promise.allSettled(queries.map(q => safeFetch(`https://api.nationalevacaturebank.nl/vacatures?q=${encodeURIComponent(q)}&location=Amsterdam&distance=25`, { headers: { ...HEADERS, Accept: "application/json", "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8" } })));
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
      let items: NVBVacature[] = [];
      if (Array.isArray(json)) { items = json as NVBVacature[]; }
      else if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const found = obj.vacatures ?? obj.results ?? obj.data ?? obj.items ?? obj.jobs;
        if (Array.isArray(found)) items = found as NVBVacature[];
      }
      for (const item of items) {
        const id = str(item, "id", "vacatureId", "uid");
        const key = id || `${str(item, "titel", "title", "functienaam")}|${str(item, "bedrijf", "werkgever", "company")}`;
        if (!key || seenIds.has(key)) continue;
        seenIds.add(key);
        allVacatures.push(item);
      }
    }
    if (allVacatures.length === 0) return { listings: [], status: "empty", count: 0 };
    const listings: VacancyListing[] = allVacatures
      .map(v => {
        const title    = str(v, "titel", "title", "functienaam", "jobtitle", "functie");
        const company  = str(v, "bedrijf", "werkgever", "company", "organisatie", "employer");
        const location = str(v, "locatie", "location", "standplaats", "plaats", "city") || "Amsterdam";
        const desc     = stripHtml(str(v, "omschrijving", "description", "samenvatting", "intro", "tekst"));
        const url      = str(v, "url", "vacatureUrl", "link", "detailUrl", "href", "applicationUrl") || "https://www.nationalevacaturebank.nl";
        const dateStr  = str(v, "datum", "date", "publicatiedatum", "plaatsingsdatum", "created_at");
        let postedAt   = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }
        return { id: "", title, company, source, location, postedAt, description: desc, url, category: detectCategory(`${title} ${desc}`) };
      })
      .filter(l => l.title.length > 0);
    return { listings, status: listings.length > 0 ? "ok" : "empty", count: listings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchWellfound(): Promise<FetchResult> {
  const source: VacancySourceId = "wellfound";
  try {
    const queries = ["amsterdam", "netherlands"];
    const allJobs: VacancyListing[] = [];
    for (const q of queries) {
      const res = await safeFetch(`https://wellfound.com/jobs/api/jobs?location=${encodeURIComponent(q)}`, { headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: "https://wellfound.com/jobs" } });
      if (!res.ok) continue;
      let json: unknown;
      try { json = await res.json(); } catch { continue; }
      let jobs: unknown[] = [];
      if (Array.isArray(json)) { jobs = json; }
      else if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const found = obj.jobs ?? obj.results ?? obj.data ?? obj.startupRoles ?? obj.jobListings;
        if (Array.isArray(found)) jobs = found;
      }
      for (const j of jobs) {
        if (!j || typeof j !== "object") continue;
        const job = j as Record<string, unknown>;
        let company = "";
        if (job.startup && typeof job.startup === "object") company = String((job.startup as Record<string, unknown>).name || "");
        company = company || String(job.company || job.company_name || "");
        const title = String(job.title || job.role || job.job_title || "");
        const location = String(job.location || job.city || "Amsterdam, Netherlands");
        if (!title || !isNLJob(location)) continue;
        const rawUrl = String(job.url || job.apply_url || job.jobUrl || job.link || "");
        const url = rawUrl.startsWith("http") ? rawUrl : rawUrl.startsWith("/") ? `https://wellfound.com${rawUrl}` : "https://wellfound.com/jobs";
        const dateStr = String(job.created_at || job.postedAt || job.published_at || "");
        let postedAt = new Date().toISOString();
        try { if (dateStr) postedAt = new Date(dateStr).toISOString(); } catch { /* ignore */ }
        allJobs.push({ id: "", title, company, source, location, postedAt, description: stripHtml(String(job.description || job.excerpt || "")), url, category: detectCategory(title) });
      }
    }
    return { listings: allJobs, status: allJobs.length > 0 ? "ok" : "empty", count: allJobs.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchGreenhouse(): Promise<FetchResult> {
  const source: VacancySourceId = "greenhouse";
  const COMPANIES = ["booking", "adyen", "messagebird", "mollie", "picnic", "sendcloud", "catawiki", "channable", "backbase", "templafy", "lightspeedpos", "miro", "takeaway", "elastic"];
  type GHJob = { id: number; title: string; updated_at: string; absolute_url: string; location: { name: string }; departments?: { name: string }[]; content?: string };
  try {
    const responses = await Promise.allSettled(COMPANIES.map(co => safeFetch(`https://boards-api.greenhouse.io/v1/boards/${co}/jobs?content=true`, { headers: HEADERS })));
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
        allListings.push({ id: "", title: j.title, company: co.charAt(0).toUpperCase() + co.slice(1), source, location, postedAt: j.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(), description: stripHtml(j.content || ""), url: j.absolute_url || `https://boards.greenhouse.io/${co}`, category: detectCategory(`${j.title} ${dept}`) });
      }
    }
    return { listings: allListings, status: allListings.length > 0 ? "ok" : "empty", count: allListings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

async function fetchLever(): Promise<FetchResult> {
  const source: VacancySourceId = "lever";
  const COMPANIES = ["netflix", "datadog", "miro", "typeform", "contentful", "personio", "hotjar", "vimeo", "intercom", "gitlab", "mercury", "vercel", "notion", "figma"];
  type LeverPosting = { id: string; text: string; categories: { location?: string; team?: string; department?: string }; description?: string; descriptionPlain?: string; hostedUrl: string; createdAt: number };
  try {
    const responses = await Promise.allSettled(COMPANIES.map(co => safeFetch(`https://api.lever.co/v0/postings/${co}?mode=json`, { headers: HEADERS })));
    const allListings: VacancyListing[] = [];
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const co = COMPANIES[i];
      if (r.status !== "fulfilled" || !r.value.ok) continue;
      let jobs: LeverPosting[] = [];
      try { const json = await r.value.json() as unknown; if (Array.isArray(json)) jobs = json as LeverPosting[]; } catch { continue; }
      for (const j of jobs) {
        const location = j.categories?.location || "";
        if (!isNLJob(location, j.descriptionPlain || "")) continue;
        const team = j.categories?.team || j.categories?.department || "";
        allListings.push({ id: "", title: j.text, company: co.charAt(0).toUpperCase() + co.slice(1), source, location: location || "Netherlands", postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(), description: stripHtml(j.descriptionPlain || j.description || ""), url: j.hostedUrl || `https://jobs.lever.co/${co}`, category: detectCategory(`${j.text} ${team}`) });
      }
    }
    return { listings: allListings, status: allListings.length > 0 ? "ok" : "empty", count: allListings.length };
  } catch (err) {
    return { listings: [], status: "error", error: err instanceof Error ? err.message : String(err), count: 0 };
  }
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

async function runSync(): Promise<NextResponse> {
  const syncStartedAt = new Date().toISOString();

  // 1. Fetch all sources in parallel
  const settled = await Promise.allSettled([
    fetchArbeitnow(), fetchRemoteOK(), fetchJobicy(), fetchFindwork(),
    fetchEuroJobs(), fetchStartupJobs(), fetchNVB(), fetchWellfound(),
    fetchGreenhouse(), fetchLever(),
  ]);

  // 2. Track which sources succeeded (ok or empty — not error/not_configured)
  //    Only listings from succeeded sources will be candidates for aging.
  const succeededSources: VacancySourceId[] = [];
  const listingMap = new Map<string, VacancyListing>(); // stable_id → listing

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const sourceId = SOURCE_IDS[i];
    const result: FetchResult = r.status === "fulfilled"
      ? r.value
      : { listings: [], status: "error", error: String((r as PromiseRejectedResult).reason), count: 0 };

    if (result.status !== "error" && result.status !== "not_configured") {
      succeededSources.push(sourceId);
    }

    for (const listing of result.listings) {
      const sid = stableId(listing.source, listing.url, listing.title, listing.company);
      if (!listingMap.has(sid)) {
        listingMap.set(sid, { ...listing, id: sid });
      }
    }
  }

  if (listingMap.size === 0) {
    return NextResponse.json({ ok: true, upserted: 0, aged: 0, succeeded: succeededSources, syncStartedAt });
  }

  // 3. Fetch existing row states for the stable IDs we're about to upsert
  //    Needed to preserve first_seen_at and detect resurrections in JS.
  const stableIds = Array.from(listingMap.keys());
  const { data: existingRows } = await supabaseAdmin
    .from("vacancy_listings")
    .select("id, status, resurrected_at, first_seen_at")
    .in("id", stableIds);

  const existingMap = new Map(
    (existingRows ?? []).map(r => [r.id as string, r as { id: string; status: string; resurrected_at: string | null; first_seen_at: string }])
  );

  // 4. Build upsert rows
  const now = new Date().toISOString();
  const upsertRows = Array.from(listingMap.entries()).map(([sid, listing]) => {
    const ex = existingMap.get(sid);
    return {
      id: sid,
      title: listing.title,
      company: listing.company,
      source: listing.source,
      location: listing.location,
      posted_at: listing.postedAt,
      description: listing.description,
      url: listing.url,
      category: listing.category,
      first_seen_at: ex?.first_seen_at ?? now,
      last_seen_at: now,
      consecutive_misses: 0,
      status: "active",
      // resurrected_at is set permanently the first time a 'gone' listing reappears.
      // Never overwritten once set (badge logic uses a 14-day recency window).
      resurrected_at: ex
        ? (ex.status === "gone" && !ex.resurrected_at ? now : ex.resurrected_at ?? null)
        : null,
    };
  });

  // 5. Batch upsert (200 rows per request to stay within PostgREST limits)
  const BATCH = 200;
  let upsertErrors = 0;
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const { error } = await supabaseAdmin
      .from("vacancy_listings")
      .upsert(upsertRows.slice(i, i + BATCH), { onConflict: "id" });
    if (error) {
      console.error("[sync-vacancies] upsert error:", error.message);
      upsertErrors++;
    }
  }

  // 6. Age listings from succeeded sources that weren't seen in this run.
  //    Only sources in succeededSources are eligible — if a source errored,
  //    its listings keep their current miss count unchanged.
  const { data: aged, error: ageError } = await supabaseAdmin.rpc("age_vacancy_listings", {
    sync_started_at: syncStartedAt,
    succeeded_sources: succeededSources,
  });
  if (ageError) console.error("[sync-vacancies] age error:", ageError.message);

  return NextResponse.json({
    ok: true,
    upserted: upsertRows.length,
    upsertErrors,
    aged: aged ?? 0,
    succeeded: succeededSources,
    failed: SOURCE_IDS.filter(s => !succeededSources.includes(s)),
    syncStartedAt,
  });
}

// ─── Route handlers ───────────────────────────────────────────────────────────
// GET  — invoked by Vercel cron (Authorization: Bearer <CRON_SECRET>)
// POST — manual trigger (same auth, useful for first-run bootstrap post-deploy)

function checkAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // misconfigured — refuse
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

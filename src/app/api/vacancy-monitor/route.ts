import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { VacancyListing, VacancySourceId } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceStatus = "ok" | "error" | "empty" | "stale";

const ALL_SOURCES: VacancySourceId[] = [
  "arbeitnow", "remoteok", "jobicy", "findwork",
  "eurojobs", "startupjobs", "nvb", "wellfound",
  "greenhouse", "lever",
];

// A source's last_seen_at must be within this window to be considered 'ok'.
const FRESHNESS_MS = 36 * 60 * 60 * 1000; // 36 hours

// ─── GET /api/vacancy-monitor ─────────────────────────────────────────────────
// Serves persisted listings from Supabase (populated by /api/sync-vacancies).
// Returns active + stale listings; 'gone' rows are excluded.
//
// sourceStatuses are derived from MAX(last_seen_at) per source — not from
// listing counts — so a source that's been broken for weeks shows as 'stale'
// even if it still has old rows in the database.

export async function GET() {
  // 1. Fetch non-gone listings (active + stale), newest first
  const { data: rows, error: listError } = await supabaseAdmin
    .from("vacancy_listings")
    .select("id, title, company, source, location, posted_at, description, url, category, status, consecutive_misses, first_seen_at, last_seen_at, resurrected_at")
    .neq("status", "gone")
    .order("last_seen_at", { ascending: false })
    .limit(600);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const listings: VacancyListing[] = (rows ?? []).map(r => ({
    id: r.id,
    title: r.title,
    company: r.company,
    source: r.source as VacancySourceId,
    location: r.location,
    postedAt: r.posted_at,
    description: r.description,
    url: r.url,
    category: r.category,
    // Optional persistence fields — only present when served from DB
    status: r.status,
    consecutiveMisses: r.consecutive_misses,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    resurrectedAt: r.resurrected_at ?? undefined,
  }));

  // 2. Compute sourceStatuses from MAX(last_seen_at) per source via RPC.
  //    Using an aggregated query rather than counting rows prevents false 'ok'
  //    for sources that haven't successfully synced in days.
  const { data: statsRows } = await supabaseAdmin.rpc("get_source_stats") as {
    data: { source: string; max_last_seen: string; active_count: number }[] | null;
  };

  const threshold = new Date(Date.now() - FRESHNESS_MS);
  const sourceStatuses: Partial<Record<VacancySourceId, SourceStatus>> = {};
  const sourceCounts: Partial<Record<VacancySourceId, number>> = {};

  // Default all sources to 'empty' (no DB rows at all = never synced)
  for (const src of ALL_SOURCES) {
    sourceStatuses[src] = "empty";
    sourceCounts[src] = 0;
  }

  for (const row of statsRows ?? []) {
    const src = row.source as VacancySourceId;
    const maxSeen = new Date(row.max_last_seen);
    sourceStatuses[src] = maxSeen > threshold ? "ok" : "stale";
    sourceCounts[src] = Number(row.active_count);
  }

  return NextResponse.json({
    listings,
    sourceStatuses,
    sourceCounts,
    fetchedAt: new Date().toISOString(),
    fromDb: true,
  });
}

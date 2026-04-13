"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";
import {
  VacancyListing, VacancyCategory, VacancySourceId,
  WatchlistItem, VacancyMonitorCache, Client, TimelineEntry, FeeAgreement,
} from "@/lib/types";
import {
  RefreshCw, Search, Bookmark, BookmarkCheck, Plus, ExternalLink,
  Wifi, WifiOff, Clock, Building2, Loader2, X, SlidersHorizontal,
  CheckCircle2, Star, Inbox, Eye, EyeOff, Send, AlertCircle,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<VacancySourceId, string> = {
  arbeitnow:   "Arbeitnow",
  remoteok:    "RemoteOK",
  jobicy:      "Jobicy",
  findwork:    "Findwork",
  eurojobs:    "EuroJobs",
  startupjobs: "Startup.jobs",
  nvb:         "Nationale Vacaturebank",
};

const SOURCE_COLORS: Record<VacancySourceId, string> = {
  arbeitnow:   "bg-violet-500/20 text-violet-400",
  remoteok:    "bg-green-500/20 text-green-400",
  jobicy:      "bg-blue-500/20 text-blue-400",
  findwork:    "bg-cyan-500/20 text-cyan-400",
  eurojobs:    "bg-amber-500/20 text-amber-400",
  startupjobs: "bg-rose-500/20 text-rose-400",
  nvb:         "bg-orange-500/20 text-orange-400",
};

const CATEGORY_LABELS: Record<VacancyCategory, string> = {
  sales:       "Sales",
  design:      "Design",
  engineering: "Engineering",
  ai:          "AI / ML",
  product:     "Product",
  other:       "Other",
};

const CAT_COLORS: Record<VacancyCategory, string> = {
  sales:       "text-amber-400",
  design:      "text-pink-400",
  engineering: "text-blue-400",
  ai:          "text-purple-400",
  product:     "text-teal-400",
  other:       "text-[#94a3b8]",
};

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferWebsite(url: string, company: string): string {
  // Try to extract a company website from the listing URL
  // e.g. "https://jobs.coolblue.nl/..." -> "https://coolblue.nl"
  const domain = extractDomain(url);
  const compSlug = company.toLowerCase().replace(/\s+/g, "");
  if (domain.includes(compSlug) || compSlug.includes(domain.split(".")[0])) {
    return `https://${domain}`;
  }
  return "";
}

// ─── Category sector map ───────────────────────────────────────────────────────
const CAT_TO_SECTOR: Record<VacancyCategory, string> = {
  sales:       "Technology",
  design:      "Technology",
  engineering: "Technology",
  ai:          "Technology",
  product:     "Technology",
  other:       "Other",
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#4CAF50] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
      <CheckCircle2 size={16} />
      {message}
    </div>
  );
}

// ─── Source status bar ─────────────────────────────────────────────────────────
function SourceStatusBar({
  statuses, errors, counts, lastFetched,
}: {
  statuses: Record<VacancySourceId, "ok" | "error" | "empty" | "not_configured">;
  errors?: Partial<Record<VacancySourceId, string>>;
  counts?: Partial<Record<VacancySourceId, number>>;
  lastFetched: string | null;
}) {
  const allSources = Object.keys(SOURCE_LABELS) as VacancySourceId[];
  const working = allSources.filter(s => statuses[s] === "ok").length;

  return (
    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#2D4A2D] text-xs font-semibold">Source Status</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            working > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {working}/{allSources.length} working
          </span>
        </div>
        {lastFetched && (
          <span className="text-[#6B7280] text-xs flex items-center gap-1">
            <Clock size={11} />
            {daysAgo(lastFetched) === "Today"
              ? `Today at ${new Date(lastFetched).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : daysAgo(lastFetched)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {allSources.map(src => {
          const s = statuses[src];
          const err = errors?.[src];
          const count = counts?.[src] ?? 0;

          const icon =
            s === "ok"             ? "✅" :
            s === "error"          ? "❌" :
            s === "not_configured" ? "🔑" :
                                     "⚪";

          const rowStyle =
            s === "ok"             ? "bg-green-500/5 border-green-500/15" :
            s === "error"          ? "bg-red-500/5 border-red-500/15" :
            s === "not_configured" ? "bg-amber-500/5 border-amber-500/15" :
                                     "bg-[#FFFFFF] border-[rgba(45,74,45,0.15)]";

          return (
            <div key={src} className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-xs ${rowStyle}`}>
              <span className="flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#2D4A2D] font-medium">{SOURCE_LABELS[src]}</span>
                  {s === "ok" && (
                    <span className="text-green-400">{count} jobs found</span>
                  )}
                  {s === "empty" && (
                    <span className="text-[#6B7280]">0 matching jobs</span>
                  )}
                  {s === "not_configured" && (
                    <span className="text-amber-400 font-medium">API key required</span>
                  )}
                  {s === "error" && (
                    <span className="text-red-400 font-medium">Error</span>
                  )}
                </div>
                {err && (
                  <p className="text-[#94a3b8] mt-0.5 break-all">{err}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vacancy card ─────────────────────────────────────────────────────────────
function VacancyCard({
  listing, isInSystem, isWatchlisted, onAddProspect, onToggleWatchlist,
}: {
  listing: VacancyListing;
  isInSystem: boolean;
  isWatchlisted: boolean;
  onAddProspect: (l: VacancyListing) => void;
  onToggleWatchlist: (l: VacancyListing) => void;
}) {
  return (
    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-5 hover:border-[#6B7280] transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[listing.source]}`}>
              {SOURCE_LABELS[listing.source]}
            </span>
            <span className={`text-[10px] font-semibold ${CAT_COLORS[listing.category]}`}>
              {CATEGORY_LABELS[listing.category]}
            </span>
            {isInSystem && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-[#4CAF50]/15 text-[#4CAF50] px-2 py-0.5 rounded-full">
                <CheckCircle2 size={9} /> In system
              </span>
            )}
          </div>
          <h3 className="text-[#2D4A2D] font-semibold text-sm leading-snug">
            {listing.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[#94a3b8] text-xs">
            {listing.company && (
              <span className="flex items-center gap-1">
                <Building2 size={11} />
                {listing.company}
              </span>
            )}
            {listing.company && listing.location && <span>·</span>}
            <span>{listing.location}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[#6B7280] text-xs">{daysAgo(listing.postedAt)}</p>
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <p className="text-[#94a3b8] text-xs leading-relaxed mb-4 line-clamp-2">
          {listing.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#2D4A2D] text-xs border border-[rgba(45,74,45,0.15)] hover:border-[#6B7280] px-3 py-1.5 rounded-md transition-colors"
        >
          <ExternalLink size={11} /> View vacancy
        </a>

        <button
          onClick={() => onToggleWatchlist(listing)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            isWatchlisted
              ? "bg-[#2D4A2D]/20 border-[#2D4A2D]/30 text-[#3D6B3D]"
              : "border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:border-[#6B7280]"
          }`}
        >
          {isWatchlisted ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
          {isWatchlisted ? "Watchlisted" : "Watchlist"}
        </button>

        {!isInSystem && (
          <button
            onClick={() => onAddProspect(listing)}
            className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors ml-auto"
          >
            <Plus size={11} /> Add as Prospect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Watchlist card ────────────────────────────────────────────────────────────
function WatchlistCard({
  item, onRemove, onToggleContacted,
}: {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onToggleContacted: (id: string) => void;
}) {
  return (
    <div className={`bg-[#FFFFFF] border rounded-xl p-5 transition-colors ${
      item.contacted ? "border-[#4CAF50]/30" : "border-[rgba(45,74,45,0.15)] hover:border-[#6B7280]"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[item.listing.source]}`}>
              {SOURCE_LABELS[item.listing.source]}
            </span>
            {item.contacted && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-[#4CAF50]/15 text-[#4CAF50] px-2 py-0.5 rounded-full">
                <Send size={9} /> Contacted
              </span>
            )}
          </div>
          <h3 className="text-[#2D4A2D] font-semibold text-sm">{item.listing.title}</h3>
          <p className="text-[#94a3b8] text-xs mt-0.5">
            {item.listing.company && `${item.listing.company} · `}{item.listing.location}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-[#6B7280] hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <a
          href={item.listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#2D4A2D] text-xs border border-[rgba(45,74,45,0.15)] px-3 py-1.5 rounded-md transition-colors"
        >
          <ExternalLink size={11} /> View
        </a>
        <button
          onClick={() => onToggleContacted(item.id)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            item.contacted
              ? "border-[#4CAF50]/30 bg-[#4CAF50]/10 text-[#4CAF50]"
              : "border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D]"
          }`}
        >
          {item.contacted ? <CheckCircle2 size={11} /> : <Send size={11} />}
          {item.contacted ? "Contacted" : "Mark contacted"}
        </button>
        <span className="text-[#6B7280] text-xs ml-auto">Saved {daysAgo(item.savedAt)}</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VacancyMonitorPage() {
  const router = useRouter();

  const [listings,      setListings]      = useState<VacancyListing[]>([]);
  const [watchlist,     setWatchlist]     = useState<WatchlistItem[]>([]);
  const [cache,         setCache]         = useState<VacancyMonitorCache | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [tab,           setTab]           = useState<"listings" | "watchlist">("listings");
  const [toast,         setToast]         = useState<string | null>(null);

  // Filters
  const [search,        setSearch]        = useState("");
  const [catFilter,     setCatFilter]     = useState<VacancyCategory | "all">("all");
  const [dateFilter,    setDateFilter]    = useState<"all" | "today" | "week" | "month">("all");
  const [sourceFilter,  setSourceFilter]  = useState<VacancySourceId | "all">("all");
  const [hideInSystem,  setHideInSystem]  = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);
  const [clientNames,   setClientNames]   = useState<Set<string>>(new Set());

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadFromCache = useCallback(() => {
    const cached = storage.getVacancyMonitorCache();
    if (cached) {
      setCache(cached);
      setListings(cached.listings);
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async (force = false) => {
    // Check if cache is still fresh
    if (!force) {
      const cached = storage.getVacancyMonitorCache();
      if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MAX_AGE_MS) {
        setCache(cached);
        setListings(cached.listings);
        return;
      }
    }

    setLoading(true);
    try {
      const res  = await fetch("/api/vacancy-monitor");
      const data = await res.json() as {
        listings: VacancyListing[];
        sourceStatuses: Record<VacancySourceId, "ok" | "error" | "empty" | "not_configured">;
        sourceErrors?: Partial<Record<VacancySourceId, string>>;
        sourceCounts?: Partial<Record<VacancySourceId, number>>;
        fetchedAt: string;
      };

      const newCache: VacancyMonitorCache = {
        listings:       data.listings,
        fetchedAt:      data.fetchedAt,
        sourceStatuses: data.sourceStatuses,
        sourceErrors:   data.sourceErrors,
        sourceCounts:   data.sourceCounts,
      };

      storage.saveVacancyMonitorCache(newCache);
      setCache(newCache);
      setListings(data.listings);
    } catch {
      // If fetch fails, keep existing cache
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWatchlist(storage.getVacancyWatchlist());
    db.getClients().then(cs => setClientNames(new Set(cs.map(c => c.companyName.toLowerCase().trim()))));
    const hadCache = loadFromCache();
    if (!hadCache) refresh();

    // Auto-refresh every 24 hours
    autoRefreshRef.current = setInterval(() => refresh(), CACHE_MAX_AGE_MS);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [loadFromCache, refresh]);

  // ── Client companies for "in system" detection ─────────────────────────────
  function isInSystem(listing: VacancyListing): boolean {
    if (!listing.company) return false;
    const co = listing.company.toLowerCase().trim();
    return clientNames.has(co) ||
      [...clientNames].some(c => c.includes(co) || co.includes(c));
  }

  // ── Watchlist helpers ──────────────────────────────────────────────────────
  const isWatchlisted = (id: string) => watchlist.some(w => w.listing.id === id);

  const toggleWatchlist = (listing: VacancyListing) => {
    const exists = isWatchlisted(listing.id);
    let updated: WatchlistItem[];
    if (exists) {
      updated = watchlist.filter(w => w.listing.id !== listing.id);
      setToast("Removed from watchlist");
    } else {
      updated = [
        ...watchlist,
        { id: uuidv4(), listing, savedAt: new Date().toISOString(), contacted: false, notes: "" },
      ];
      setToast("Added to watchlist");
    }
    setWatchlist(updated);
    storage.saveVacancyWatchlist(updated);
  };

  const removeFromWatchlist = (id: string) => {
    const updated = watchlist.filter(w => w.id !== id);
    setWatchlist(updated);
    storage.saveVacancyWatchlist(updated);
  };

  const toggleContacted = (id: string) => {
    const updated = watchlist.map(w =>
      w.id === id ? { ...w, contacted: !w.contacted } : w
    );
    setWatchlist(updated);
    storage.saveVacancyWatchlist(updated);
  };

  // ── Add as Prospect ────────────────────────────────────────────────────────
  const addAsProspect = (listing: VacancyListing) => {
    const now = new Date().toISOString();
    const timeline: TimelineEntry[] = [
      {
        id: uuidv4(),
        type: "created",
        content: `Added as prospect via Vacancy Monitor — found on ${SOURCE_LABELS[listing.source]}`,
        createdAt: now,
      },
    ];
    const feeAgreement: FeeAgreement = { type: "standard" };
    const newClient: Client = {
      id: uuidv4(),
      companyName:   listing.company || "Unknown Company",
      website:       inferWebsite(listing.url, listing.company) || undefined,
      sector:        CAT_TO_SECTOR[listing.category] || "Technology",
      size:          "medium",
      type:          "prospect",
      contactName:   "",
      contactEmail:  "",
      contactPhone:  "",
      contactRole:   "",
      location:      listing.location,
      notes:         `Found via ${SOURCE_LABELS[listing.source]} on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.\n\nOpen vacancy: ${listing.title}\n${listing.url}`,
      feeAgreement,
      guaranteePeriod: 3,
      timeline,
      createdAt: now,
      updatedAt: now,
    };

    db.getClients().then(existing => db.saveClients([...existing, newClient]));
    setToast("Added to prospects!");
    setTimeout(() => router.push(`/clients/${newClient.id}`), 800);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = listings.filter(l => {
    if (catFilter    !== "all" && l.category !== catFilter)   return false;
    if (sourceFilter !== "all" && l.source   !== sourceFilter) return false;
    if (hideInSystem && isInSystem(l)) return false;

    if (dateFilter !== "all") {
      const posted = new Date(l.postedAt).getTime();
      const now    = Date.now();
      if (dateFilter === "today"  && now - posted > 86400000)         return false;
      if (dateFilter === "week"   && now - posted > 7 * 86400000)     return false;
      if (dateFilter === "month"  && now - posted > 30 * 86400000)    return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return (
        l.title.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalInSystem = filtered.filter(l => isInSystem(l)).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Vacancy Monitor</h1>
          <p className="text-[#94a3b8] mt-1">Amsterdam Sales, Design, Tech &amp; AI roles — updated daily</p>
        </div>
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Fetching…</>
            : <><RefreshCw size={14} /> Refresh</>
          }
        </button>
      </div>

      {/* Source statuses */}
      {cache && (
        <SourceStatusBar
          statuses={cache.sourceStatuses}
          errors={cache.sourceErrors}
          counts={cache.sourceCounts}
          lastFetched={cache.fetchedAt}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#FFFFFF] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("listings")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "listings" ? "bg-[#2D4A2D] text-white" : "text-[#94a3b8] hover:text-[#2D4A2D]"
          }`}
        >
          <Eye size={13} />
          All Listings
          {listings.length > 0 && (
            <span className="bg-white/20 text-xs px-1.5 rounded-full">{listings.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("watchlist")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "watchlist" ? "bg-[#2D4A2D] text-white" : "text-[#94a3b8] hover:text-[#2D4A2D]"
          }`}
        >
          <Star size={13} />
          Watchlist
          {watchlist.length > 0 && (
            <span className={`text-xs px-1.5 rounded-full ${tab === "watchlist" ? "bg-white/20" : "bg-[rgba(45,74,45,0.15)]"}`}>
              {watchlist.length}
            </span>
          )}
        </button>
      </div>

      {/* ── ALL LISTINGS tab ─────────────────────────────────────────────── */}
      {tab === "listings" && (
        <>
          {/* Filter bar */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4 mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by keyword, company…"
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg pl-9 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                />
              </div>

              {/* Category */}
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value as VacancyCategory | "all")}
                className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
              >
                <option value="all">All roles</option>
                {(Object.keys(CATEGORY_LABELS) as VacancyCategory[]).map(k => (
                  <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                ))}
              </select>

              {/* Date */}
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as "all" | "today" | "week" | "month")}
                className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
              >
                <option value="all">Any date</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>

              {/* Source */}
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as VacancySourceId | "all")}
                className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
              >
                <option value="all">All sources</option>
                {(Object.keys(SOURCE_LABELS) as VacancySourceId[]).map(k => (
                  <option key={k} value={k}>{SOURCE_LABELS[k]}</option>
                ))}
              </select>

              {/* Hide in system toggle */}
              <button
                onClick={() => setHideInSystem(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
                  hideInSystem
                    ? "bg-[#2D4A2D]/20 border-[#2D4A2D]/30 text-[#3D6B3D]"
                    : "border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D]"
                }`}
              >
                {hideInSystem ? <EyeOff size={12} /> : <Eye size={12} />}
                Hide in-system
              </button>
            </div>

            {/* Result count */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[rgba(45,74,45,0.15)]">
              <span className="text-[#6B7280] text-xs">
                {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
                {search || catFilter !== "all" || dateFilter !== "all" || sourceFilter !== "all"
                  ? " (filtered)" : ""}
              </span>
              {totalInSystem > 0 && (
                <span className="text-[#4CAF50] text-xs flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  {totalInSystem} already in your client database
                </span>
              )}
            </div>
          </div>

          {/* Listings grid */}
          {loading && listings.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-16 text-center">
              <Loader2 size={32} className="text-[#2D4A2D] mx-auto mb-3 animate-spin" />
              <p className="text-[#94a3b8] text-sm">Fetching from Arbeitnow, RemoteOK, Jobicy, Findwork, EuroJobs &amp; Startup.jobs…</p>
              <p className="text-[#6B7280] text-xs mt-1">This takes around 10–20 seconds</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-12 text-center">
              <Inbox size={32} className="text-[rgba(45,74,45,0.15)] mx-auto mb-3" />
              <p className="text-[#94a3b8] text-sm">
                {listings.length === 0
                  ? "No vacancies found. Try refreshing."
                  : "No results match your filters."}
              </p>
              {listings.length > 0 && (
                <button
                  onClick={() => { setSearch(""); setCatFilter("all"); setDateFilter("all"); setSourceFilter("all"); setHideInSystem(false); }}
                  className="text-[#2D4A2D] text-xs mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(l => (
                <VacancyCard
                  key={l.id}
                  listing={l}
                  isInSystem={isInSystem(l)}
                  isWatchlisted={isWatchlisted(l.id)}
                  onAddProspect={addAsProspect}
                  onToggleWatchlist={toggleWatchlist}
                />
              ))}
            </div>
          )}

          {/* All sources failed/unconfigured notice */}
          {cache && Object.values(cache.sourceStatuses).every(s => s !== "ok") && !loading && (
            <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-sm font-medium">No sources returned results</p>
                <p className="text-[#94a3b8] text-xs mt-1">
                  Check the source status panel above for per-source error messages and debug info.
                  Arbeitnow, RemoteOK, Jobicy, EuroJobs, and Startup.jobs need no API keys.
                  Findwork requires a free key from findwork.dev/developers (add as FINDWORK_API_KEY).
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── WATCHLIST tab ────────────────────────────────────────────────── */}
      {tab === "watchlist" && (
        <div className="space-y-3">
          {watchlist.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-12 text-center">
              <Star size={32} className="text-[rgba(45,74,45,0.15)] mx-auto mb-3" />
              <p className="text-[#94a3b8] text-sm">Your watchlist is empty.</p>
              <p className="text-[#6B7280] text-xs mt-1">
                Bookmark interesting vacancies from the listings tab.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#94a3b8] text-sm">
                  {watchlist.filter(w => w.contacted).length} of {watchlist.length} contacted
                </p>
              </div>
              {watchlist.map(item => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  onRemove={removeFromWatchlist}
                  onToggleContacted={toggleContacted}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

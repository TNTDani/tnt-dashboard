"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { db, initDb } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  CandidateProfile,
  VacancyListing,
  WatchlistItem,
  Vacancy,
  CandidateVacancyMatch,
  VacancySourceId,
} from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  ChevronDown,
  Check,
  ExternalLink,
  BookmarkPlus,
  BookmarkCheck,
  Users,
  Briefcase,
  MapPin,
  Clock,
  TrendingUp,
  Filter,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Plus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = "select-candidate" | "loading" | "results";

interface ScoredListing extends VacancyListing {
  score: number;
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ["Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];

const LOADING_STEPS = [
  "Reading candidate profile...",
  "Building vacancy search criteria...",
  "Scanning job boards...",
  "Scoring matches...",
];

const SOURCE_LABELS: Record<VacancySourceId, string> = {
  arbeitnow:   "Arbeitnow",
  remoteok:    "RemoteOK",
  jobicy:      "Jobicy",
  findwork:    "Findwork",
  eurojobs:    "EuroJobs",
  startupjobs: "Startup.jobs",
  nvb:         "NVB",
  wellfound:   "Wellfound",
  greenhouse:  "Greenhouse",
  lever:       "Lever",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

// ─── ProgressSteps ───────────────────────────────────────────────────────────

function ProgressSteps({ step }: { step: Step }) {
  const steps = [
    { id: "select-candidate", label: "Select Candidate" },
    { id: "loading", label: "Searching" },
    { id: "results", label: "Results" },
  ];
  const activeIdx = step === "select-candidate" ? 0 : step === "loading" ? 1 : 2;

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-150"
                style={{
                  background: done || active ? "#2D4A2D" : "rgba(45,74,45,0.12)",
                  color: done || active ? "#fff" : "#6B7280",
                }}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: active || done ? "#2D4A2D" : "#6B7280" }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-3 h-px w-10 transition-colors duration-150"
                style={{ background: done ? "#2D4A2D" : "rgba(45,74,45,0.15)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CandidateCombobox ───────────────────────────────────────────────────────

function CandidateCombobox({
  candidates,
  value,
  onChange,
}: {
  candidates: CandidateProfile[];
  value: CandidateProfile | null;
  onChange: (c: CandidateProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.jobTitle.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  function handleSelect(c: CandidateProfile) {
    onChange(c);
    setQuery(`${c.firstName} ${c.lastName}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "#6B7280" }}
        />
        <input
          type="text"
          placeholder="Search candidates..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange(null as unknown as CandidateProfile);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all duration-150"
          style={{
            background: "#fff",
            border: "1px solid rgba(45,74,45,0.15)",
            color: "#2D4A2D",
          }}
        />
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "#6B7280" }}
        />
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
            style={{
              background: "#fff",
              border: "1px solid rgba(45,74,45,0.12)",
            }}
          >
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelect(c)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[rgba(45,74,45,0.05)] transition-colors duration-100"
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#2D4A2D" }}>
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="text-xs" style={{ color: "#6B7280" }}>
                      {c.jobTitle}
                      {c.location ? ` · ${c.location}` : ""}
                    </div>
                  </div>
                  {value?.id === c.id && (
                    <Check size={14} style={{ color: "#2D4A2D" }} />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {open && filtered.length === 0 && query.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 w-full mt-1 rounded-xl px-4 py-3 text-sm shadow-lg"
            style={{
              background: "#fff",
              border: "1px solid rgba(45,74,45,0.12)",
              color: "#6B7280",
            }}
          >
            No candidates found
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ConfirmationCard ────────────────────────────────────────────────────────

function ConfirmationCard({
  candidate,
  onStart,
}: {
  candidate: CandidateProfile;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl p-5 mt-4"
      style={{
        background: "#fff",
        border: "1px solid rgba(45,74,45,0.1)",
        borderLeft: "4px solid #2D4A2D",
      }}
    >
      <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>
        Finding vacancies for
      </div>
      <div className="text-base font-semibold mb-1" style={{ color: "#2D4A2D" }}>
        {candidate.firstName} {candidate.lastName}
      </div>
      <div className="text-sm mb-4 flex flex-wrap gap-2 items-center" style={{ color: "#6B7280" }}>
        <span className="flex items-center gap-1">
          <Briefcase size={12} />
          {candidate.jobTitle}
        </span>
        {candidate.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {candidate.location}
          </span>
        )}
        {candidate.salaryExpectation && (
          <span className="flex items-center gap-1">
            <TrendingUp size={12} />
            €{candidate.salaryExpectation.toLocaleString()}
          </span>
        )}
      </div>
      <button
        onClick={onStart}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
        style={{ background: "#2D4A2D", color: "#fff" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#3D6B3D")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#2D4A2D")}
      >
        Find Vacancies
        <ArrowLeft size={14} className="rotate-180" />
      </button>
    </motion.div>
  );
}

// ─── LoadingSequence ─────────────────────────────────────────────────────────

function LoadingSequence({
  currentStep,
  listingCount,
}: {
  currentStep: number;
  listingCount: number;
}) {
  const steps = LOADING_STEPS.map((label, i) => {
    let display = label;
    if (i === 2 && currentStep >= 2)
      display = "Fetching from 10 job boards...";
    if (i === 3 && currentStep >= 3 && listingCount > 0)
      display = `Scoring ${listingCount} listings against candidate profile...`;
    return display;
  });

  return (
    <div className="space-y-3">
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {done ? (
                <CheckCircle2 size={18} style={{ color: "#2D4A2D" }} />
              ) : active ? (
                <Loader2 size={18} className="animate-spin" style={{ color: "#2D4A2D" }} />
              ) : (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ background: "rgba(45,74,45,0.15)" }}
                />
              )}
            </div>
            <span
              className="text-sm transition-colors duration-150"
              style={{
                color: done ? "#2D4A2D" : active ? "#2D4A2D" : "#94a3b8",
                fontWeight: active ? 500 : 400,
              }}
            >
              {label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── MatchScoreBadge ─────────────────────────────────────────────────────────

function MatchScoreBadge({ score }: { score: number }) {
  let bg: string;
  let color: string;

  if (score >= 80) {
    bg = "#a8e6cf";
    color = "#2D4A2D";
  } else if (score >= 60) {
    bg = "rgba(245,158,11,0.1)";
    color = "#f59e0b";
  } else {
    bg = "rgba(148,163,184,0.1)";
    color = "#94a3b8";
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: bg, color }}
    >
      {score}% match
    </span>
  );
}

// ─── SourceStatusBar ─────────────────────────────────────────────────────────

function SourceStatusBar({
  statuses,
  counts,
}: {
  statuses: Partial<Record<VacancySourceId, string>>;
  counts: Partial<Record<VacancySourceId, number>>;
}) {
  const sources = Object.keys(SOURCE_LABELS) as VacancySourceId[];
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {sources.map((src) => {
        const status = statuses[src];
        const count = counts[src] ?? 0;
        if (!status) return null;
        const ok = status === "ok";
        const err = status === "error";
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{
              background: ok
                ? "rgba(168,230,207,0.25)"
                : err
                ? "rgba(239,68,68,0.1)"
                : "rgba(148,163,184,0.1)",
              color: ok ? "#2D4A2D" : err ? "#ef4444" : "#94a3b8",
              border: `1px solid ${ok ? "rgba(45,74,45,0.2)" : err ? "rgba(239,68,68,0.2)" : "rgba(148,163,184,0.2)"}`,
            }}
          >
            {ok ? "✓" : err ? "×" : "—"}
            {" "}
            {SOURCE_LABELS[src]}
            {ok && count > 0 ? ` (${count})` : ""}
          </span>
        );
      })}
    </div>
  );
}

// ─── FilterPanel ─────────────────────────────────────────────────────────────

function FilterPanel({
  minScore,
  setMinScore,
  locationFilter,
  setLocationFilter,
  sourceFilter,
  setSourceFilter,
  sources,
  totalCount,
  filteredCount,
}: {
  minScore: number;
  setMinScore: (v: number) => void;
  locationFilter: string;
  setLocationFilter: (v: string) => void;
  sourceFilter: Set<string>;
  setSourceFilter: (v: Set<string>) => void;
  sources: string[];
  totalCount: number;
  filteredCount: number;
}) {
  const scoreOptions = [
    { label: "All matches", value: 0 },
    { label: "60%+", value: 60 },
    { label: "75%+", value: 75 },
    { label: "90%+", value: 90 },
  ];

  const locationOptions = [
    { label: "All", value: "all" },
    { label: "Amsterdam", value: "amsterdam" },
    { label: "Remote", value: "remote" },
    { label: "Netherlands", value: "netherlands" },
  ];

  function toggleSource(src: string) {
    const next = new Set(sourceFilter);
    if (next.has(src)) next.delete(src);
    else next.add(src);
    setSourceFilter(next);
  }

  return (
    <div
      className="rounded-xl p-4 space-y-5 sticky top-4"
      style={{
        background: "#fff",
        border: "1px solid rgba(45,74,45,0.1)",
      }}
    >
      <div className="flex items-center gap-2">
        <Filter size={14} style={{ color: "#2D4A2D" }} />
        <span className="text-sm font-semibold" style={{ color: "#2D4A2D" }}>
          Filters
        </span>
      </div>

      {/* Match score */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: "#6B7280" }}>
          Match score
        </div>
        <div className="space-y-1.5">
          {scoreOptions.map((o) => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer">
              <div
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-100"
                style={{
                  borderColor: minScore === o.value ? "#2D4A2D" : "rgba(45,74,45,0.3)",
                  background: minScore === o.value ? "#2D4A2D" : "transparent",
                }}
                onClick={() => setMinScore(o.value)}
              >
                {minScore === o.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <span
                className="text-sm cursor-pointer"
                style={{ color: minScore === o.value ? "#2D4A2D" : "#6B7280" }}
                onClick={() => setMinScore(o.value)}
              >
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <div className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: "#6B7280" }}>
          Location
        </div>
        <div className="space-y-1.5">
          {locationOptions.map((o) => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer">
              <div
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-100"
                style={{
                  borderColor: locationFilter === o.value ? "#2D4A2D" : "rgba(45,74,45,0.3)",
                  background: locationFilter === o.value ? "#2D4A2D" : "transparent",
                }}
                onClick={() => setLocationFilter(o.value)}
              >
                {locationFilter === o.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <span
                className="text-sm cursor-pointer"
                style={{ color: locationFilter === o.value ? "#2D4A2D" : "#6B7280" }}
                onClick={() => setLocationFilter(o.value)}
              >
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Source */}
      {sources.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: "#6B7280" }}>
            Source
          </div>
          <div className="space-y-1.5">
            {sources.map((src) => {
              const checked = sourceFilter.has(src);
              return (
                <label
                  key={src}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => toggleSource(src)}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center border transition-colors duration-100"
                    style={{
                      borderColor: checked ? "#2D4A2D" : "rgba(45,74,45,0.3)",
                      background: checked ? "#2D4A2D" : "transparent",
                    }}
                  >
                    {checked && <Check size={10} color="#fff" />}
                  </div>
                  <span className="text-sm" style={{ color: "#6B7280" }}>
                    {SOURCE_LABELS[src as VacancySourceId] ?? src}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Count */}
      <div
        className="text-xs pt-3 border-t"
        style={{ borderColor: "rgba(45,74,45,0.08)", color: "#6B7280" }}
      >
        Showing{" "}
        <span className="font-semibold" style={{ color: "#2D4A2D" }}>
          {filteredCount}
        </span>{" "}
        of{" "}
        <span className="font-semibold" style={{ color: "#2D4A2D" }}>
          {totalCount}
        </span>
      </div>
    </div>
  );
}

// ─── VacancyCard ─────────────────────────────────────────────────────────────

function VacancyCard({
  listing,
  isWatchlisted,
  onToggleWatchlist,
  onAddToPipeline,
  onSendToCandidate,
  addingToPipeline,
  alreadyAdded,
}: {
  listing: ScoredListing;
  candidateId: string;
  candidateName: string;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  onAddToPipeline: () => void;
  onSendToCandidate: () => void;
  addingToPipeline: boolean;
  alreadyAdded: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-shadow duration-150 hover:shadow-md"
      style={{
        background: "#fff",
        border: "1px solid rgba(45,74,45,0.1)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold leading-snug truncate"
            style={{ color: "#2D4A2D", fontSize: 15 }}
          >
            {listing.title}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
            {listing.company}
          </div>
        </div>
        <MatchScoreBadge score={listing.score} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#6B7280" }}>
        {listing.location && (
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {listing.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Briefcase size={11} />
          {SOURCE_LABELS[listing.source] ?? listing.source}
        </span>
        {listing.postedAt && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {daysAgo(listing.postedAt)}
          </span>
        )}
      </div>

      {/* AI reason */}
      {listing.reason && (
        <div className="text-xs italic" style={{ color: "#6B7280" }}>
          Why it matches: {listing.reason}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            background: "#2D4A2D",
            color: "#fff",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#3D6B3D")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2D4A2D")}
        >
          View <ExternalLink size={11} />
        </a>

        <button
          onClick={onAddToPipeline}
          disabled={addingToPipeline || alreadyAdded}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 disabled:opacity-60"
          style={{
            background: alreadyAdded ? "rgba(168,230,207,0.3)" : "rgba(45,74,45,0.08)",
            color: alreadyAdded ? "#2D4A2D" : "#2D4A2D",
          }}
        >
          {addingToPipeline ? (
            <Loader2 size={11} className="animate-spin" />
          ) : alreadyAdded ? (
            <CheckCircle2 size={11} />
          ) : (
            <Plus size={11} />
          )}
          {alreadyAdded ? "Added" : "Add to pipeline"}
        </button>

        <button
          onClick={onSendToCandidate}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            background: "rgba(45,74,45,0.08)",
            color: "#2D4A2D",
          }}
        >
          <Mail size={11} />
          Send
        </button>

        <button
          onClick={onToggleWatchlist}
          className="ml-auto p-1.5 rounded-lg transition-colors duration-150"
          style={{
            background: isWatchlisted ? "rgba(168,230,207,0.3)" : "rgba(45,74,45,0.06)",
            color: isWatchlisted ? "#2D4A2D" : "#6B7280",
          }}
          title={isWatchlisted ? "Remove from watchlist" : "Save to watchlist"}
        >
          {isWatchlisted ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
        </button>
      </div>
    </div>
  );
}

// ─── SendToCandidateModal ─────────────────────────────────────────────────────

function SendToCandidateModal({
  listing,
  candidate,
  onClose,
}: {
  listing: ScoredListing;
  candidate: CandidateProfile;
  onClose: () => void;
}) {
  const subject = `New vacancy: ${listing.title} at ${listing.company}`;
  const defaultBody = `Hi ${candidate.firstName},

I found a vacancy that matches your profile perfectly: ${listing.title} at ${listing.company}, ${listing.location}.

Here's the link: ${listing.url}

Let me know if you'd like to discuss this opportunity.

Best regards`;

  const [body, setBody] = useState(defaultBody);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const full = `To: ${candidate.email}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: "#fff", border: "1px solid rgba(45,74,45,0.12)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-base" style={{ color: "#2D4A2D" }}>
              Send to {candidate.firstName} {candidate.lastName}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              {candidate.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[rgba(45,74,45,0.07)] transition-colors"
          >
            <X size={16} style={{ color: "#6B7280" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>
              Subject
            </label>
            <input
              readOnly
              value={subject}
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "rgba(45,74,45,0.04)",
                border: "1px solid rgba(45,74,45,0.12)",
                color: "#2D4A2D",
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "#6B7280" }}>
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
              style={{
                background: "#fff",
                border: "1px solid rgba(45,74,45,0.15)",
                color: "#2D4A2D",
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{ background: "#2D4A2D", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#3D6B3D")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2D4A2D")}
          >
            {copied ? <Check size={14} /> : <Mail size={14} />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{
              background: "rgba(45,74,45,0.08)",
              color: "#2D4A2D",
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VacancyMonitorPage() {
  const { data: session } = useSession();
  const agencyId = (session?.user as { agencyId?: string })?.agencyId;
  const router = useRouter();

  const [step, setStep] = useState<Step>("select-candidate");
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingCount, setLoadingCount] = useState(0);
  const [listings, setListings] = useState<VacancyListing[]>([]);
  const [scored, setScored] = useState<ScoredListing[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<Partial<Record<VacancySourceId, string>>>({});
  const [sourceCounts, setSourceCounts] = useState<Partial<Record<VacancySourceId, number>>>({});
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [addedToPipeline, setAddedToPipeline] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [sendModal, setSendModal] = useState<ScoredListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual form mode
  const [manualMode, setManualMode] = useState(false);
  const [manualJobTitle, setManualJobTitle] = useState("");
  const [manualSkills, setManualSkills] = useState<string[]>([]);
  const [manualSkillInput, setManualSkillInput] = useState("");
  const [manualSeniority, setManualSeniority] = useState("Senior");
  const [manualSalaryMin, setManualSalaryMin] = useState("");
  const [manualSalaryMax, setManualSalaryMax] = useState("");
  const [manualLocation, setManualLocation] = useState("Amsterdam");

  // Filters
  const [minScore, setMinScore] = useState(0);
  const [locationFilter, setLocationFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (agencyId) {
      initDb(agencyId);
      db.getCandidateProfiles().then(setCandidates).catch(() => {});
    }
    setWatchlist(storage.getVacancyWatchlist());
  }, [agencyId]);

  async function handleStart() {
    if (!selectedCandidate && !manualMode) return;
    if (manualMode && !manualJobTitle.trim()) return;
    setStep("loading");
    setError(null);
    setLoadingStep(0);

    try {
      await new Promise((r) => setTimeout(r, 500));
      setLoadingStep(1);
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep(2);

      const vmRes = await fetch("/api/vacancy-monitor");
      if (!vmRes.ok) throw new Error("Failed to fetch job listings");
      const vmData = await vmRes.json();
      setListings(vmData.listings);
      setSourceStatuses(vmData.sourceStatuses);
      setSourceCounts(vmData.sourceCounts);
      setLoadingCount(vmData.listings.length);

      setLoadingStep(3);

      const candidatePayload = selectedCandidate
        ? {
            jobTitle: selectedCandidate.jobTitle,
            skills: [],
            location: selectedCandidate.location,
            salaryExpectation: selectedCandidate.salaryExpectation,
            branch: selectedCandidate.branch,
          }
        : {
            jobTitle: manualJobTitle.trim(),
            skills: manualSkills,
            location: manualLocation.trim(),
            salaryExpectation: manualSalaryMin ? Number(manualSalaryMin) : undefined,
            branch: manualSeniority,
          };

      const matchRes = await fetch("/api/match-vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: candidatePayload,
          listings: vmData.listings,
        }),
      });

      if (!matchRes.ok) throw new Error("Scoring failed");
      const { matches } = await matchRes.json();

      const scoreMap = new Map(
        matches.map((m: { listingId: string; score: number; reason: string }) => [m.listingId, m])
      );
      const scoredListings: ScoredListing[] = vmData.listings.map((l: VacancyListing) => {
        const match = scoreMap.get(l.id) as { score: number; reason: string } | undefined;
        return { ...l, score: match?.score ?? 0, reason: match?.reason ?? "" };
      });

      scoredListings.sort((a, b) => b.score - a.score);
      setScored(scoredListings);

      const activeSources = new Set(
        Object.entries(vmData.sourceStatuses)
          .filter(([, s]) => s === "ok")
          .map(([k]) => k)
      );
      setSourceFilter(activeSources);

      setStep("results");
    } catch (err) {
      setError(String(err));
      setStep("select-candidate");
    }
  }

  async function handleAddToPipeline(listing: ScoredListing) {
    if (!selectedCandidate) return;
    setAddingId(listing.id);
    try {
      const allVacancies = await db.getVacancies();
      const newVacancy: Vacancy = {
        id: uuidv4(),
        title: listing.title,
        company: listing.company,
        salaryMin: 0,
        salaryMax: 0,
        currency: "EUR",
        requirements: [],
        seniorityLevel: "",
        description: listing.description,
        status: "open",
        stage: "sourcing",
        stageLog: [],
        clientFeedback: [],
        createdAt: new Date().toISOString(),
      };
      await db.saveVacancies([...allVacancies, newVacancy]);

      const match: CandidateVacancyMatch = {
        id: uuidv4(),
        candidateId: selectedCandidate.id,
        vacancyId: newVacancy.id,
        matchScore: listing.score,
        status: "active",
        notes: `Added from vacancy monitor. AI match reason: ${listing.reason}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveMatch(match);

      setAddedToPipeline((prev) => new Set([...prev, listing.id]));
    } catch (err) {
      console.error("Add to pipeline failed:", err);
    } finally {
      setAddingId(null);
    }
  }

  function handleToggleWatchlist(listing: ScoredListing) {
    const current = storage.getVacancyWatchlist();
    const exists = current.find((w) => w.id === listing.id);
    let updated: WatchlistItem[];
    if (exists) {
      updated = current.filter((w) => w.id !== listing.id);
    } else {
      updated = [
        ...current,
        {
          id: listing.id,
          listing,
          savedAt: new Date().toISOString(),
          contacted: false,
          notes: "",
        },
      ];
    }
    storage.saveVacancyWatchlist(updated);
    setWatchlist(updated);
  }

  const filteredScored = useMemo(() => {
    return scored.filter((l) => {
      if (l.score < minScore) return false;
      if (locationFilter === "amsterdam" && !/amsterdam/i.test(l.location)) return false;
      if (locationFilter === "remote" && !/remote/i.test(l.location)) return false;
      if (
        locationFilter === "netherlands" &&
        !/netherlands|nederland|amsterdam|rotterdam|utrecht|eindhoven/i.test(l.location)
      )
        return false;
      if (sourceFilter.size > 0 && !sourceFilter.has(l.source)) return false;
      return true;
    });
  }, [scored, minScore, locationFilter, sourceFilter]);

  const activeSources = useMemo(
    () =>
      Object.entries(sourceStatuses)
        .filter(([, s]) => s === "ok")
        .map(([k]) => k),
    [sourceStatuses]
  );

  // ── Render: select-candidate ──────────────────────────────────────────────

  if (step === "select-candidate") {
    return (
      <div className="min-h-screen px-6 py-10" style={{ background: "#EDEDEB" }}>
        <div className="mx-auto" style={{ maxWidth: 560 }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h1
              className="font-semibold mb-1"
              style={{ fontSize: 28, color: "#2D4A2D" }}
            >
              Find Vacancies
            </h1>
            <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
              Select a candidate and Orchard will find matching open roles online
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 rounded-xl px-4 py-3 mb-5 text-sm"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444",
                }}
              >
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {!manualMode ? (
                <motion.div key="combobox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {candidates.length === 0 ? (
                    <div
                      className="rounded-xl p-6 text-center"
                      style={{ background: "#fff", border: "1px solid rgba(45,74,45,0.1)" }}
                    >
                      <Users size={32} className="mx-auto mb-3" style={{ color: "rgba(45,74,45,0.25)" }} />
                      <p className="text-sm font-medium mb-1" style={{ color: "#2D4A2D" }}>No candidates yet</p>
                      <p className="text-xs mb-4" style={{ color: "#6B7280" }}>Add candidates to your CRM to use the vacancy monitor</p>
                      <Link
                        href="/candidates/new"
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                        style={{ background: "#2D4A2D", color: "#fff" }}
                      >
                        <Plus size={14} /> Add candidate
                      </Link>
                    </div>
                  ) : (
                    <>
                      <CandidateCombobox
                        candidates={candidates}
                        value={selectedCandidate}
                        onChange={setSelectedCandidate}
                      />
                      <AnimatePresence>
                        {selectedCandidate && (
                          <ConfirmationCard candidate={selectedCandidate} onStart={handleStart} />
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setManualMode(true)}
                      className="text-xs transition-colors duration-150 underline underline-offset-2"
                      style={{ color: "#6B7280" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#2D4A2D")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
                    >
                      Or start without a candidate →
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}>
                  {/* Back link */}
                  <button
                    onClick={() => setManualMode(false)}
                    className="flex items-center gap-1.5 text-xs mb-5 transition-colors"
                    style={{ color: "#6B7280" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#2D4A2D")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
                  >
                    <ArrowLeft size={12} /> Back to candidate selector
                  </button>

                  {/* Manual form */}
                  <div
                    className="p-5 rounded-xl flex flex-col gap-4"
                    style={{ background: "#fff", border: "1.5px solid rgba(45,74,45,0.15)" }}
                  >
                    {/* Job title / role type */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Job Title / Role Type *</label>
                      <input
                        type="text"
                        value={manualJobTitle}
                        onChange={(e) => setManualJobTitle(e.target.value)}
                        placeholder="e.g. Senior Backend Engineer"
                        className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                        style={{ border: "1.5px solid rgba(45,74,45,0.15)", color: "#2D4A2D" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#2D4A2D")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(45,74,45,0.15)")}
                      />
                    </div>

                    {/* Key skills tags */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Key Skills</label>
                      <div
                        className="w-full bg-white rounded-xl px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 items-center cursor-text"
                        style={{ border: "1.5px solid rgba(45,74,45,0.15)" }}
                        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
                      >
                        {manualSkills.map((skill) => (
                          <span key={skill} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#a8e6cf", color: "#2D4A2D" }}>
                            {skill}
                            <button onClick={() => setManualSkills((s) => s.filter((x) => x !== skill))} className="hover:opacity-70 leading-none">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={manualSkillInput}
                          onChange={(e) => setManualSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === ",") && manualSkillInput.trim()) {
                              e.preventDefault();
                              const val = manualSkillInput.trim().replace(/,$/, "");
                              if (val && !manualSkills.includes(val)) setManualSkills((s) => [...s, val]);
                              setManualSkillInput("");
                            }
                            if (e.key === "Backspace" && !manualSkillInput && manualSkills.length > 0) {
                              setManualSkills((s) => s.slice(0, -1));
                            }
                          }}
                          placeholder={manualSkills.length === 0 ? "Type skill and press Enter…" : ""}
                          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
                          style={{ color: "#2D4A2D" }}
                        />
                      </div>
                    </div>

                    {/* Seniority + Location row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Seniority</label>
                        <select
                          value={manualSeniority}
                          onChange={(e) => setManualSeniority(e.target.value)}
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none appearance-none transition-colors"
                          style={{ border: "1.5px solid rgba(45,74,45,0.15)", color: "#2D4A2D" }}
                        >
                          {SENIORITY_LEVELS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Location</label>
                        <input
                          type="text"
                          value={manualLocation}
                          onChange={(e) => setManualLocation(e.target.value)}
                          placeholder="Amsterdam"
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                          style={{ border: "1.5px solid rgba(45,74,45,0.15)", color: "#2D4A2D" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#2D4A2D")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(45,74,45,0.15)")}
                        />
                      </div>
                    </div>

                    {/* Salary expectation */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Salary Expectation (€)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={manualSalaryMin}
                          onChange={(e) => setManualSalaryMin(e.target.value)}
                          placeholder="Min e.g. 60000"
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                          style={{ border: "1.5px solid rgba(45,74,45,0.15)", color: "#2D4A2D" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#2D4A2D")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(45,74,45,0.15)")}
                        />
                        <input
                          type="number"
                          value={manualSalaryMax}
                          onChange={(e) => setManualSalaryMax(e.target.value)}
                          placeholder="Max e.g. 85000"
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                          style={{ border: "1.5px solid rgba(45,74,45,0.15)", color: "#2D4A2D" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#2D4A2D")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(45,74,45,0.15)")}
                        />
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleStart}
                      disabled={!manualJobTitle.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-1"
                      style={{ background: manualJobTitle.trim() ? "#2D4A2D" : "rgba(45,74,45,0.3)", cursor: manualJobTitle.trim() ? "pointer" : "not-allowed" }}
                      onMouseOver={(e) => { if (manualJobTitle.trim()) e.currentTarget.style.background = "#3D6B3D"; }}
                      onMouseOut={(e) => { if (manualJobTitle.trim()) e.currentTarget.style.background = "#2D4A2D"; }}
                    >
                      <Search size={15} /> Find Vacancies
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="min-h-screen px-6 py-10 flex flex-col" style={{ background: "#EDEDEB" }}>
        <div className="mx-auto w-full" style={{ maxWidth: 480 }}>
          <button
            onClick={() => setStep("select-candidate")}
            className="flex items-center gap-1.5 text-sm mb-8 transition-colors duration-150"
            style={{ color: "#6B7280" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#2D4A2D")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <ProgressSteps step={step} />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl p-8"
            style={{
              background: "#fff",
              border: "1px solid rgba(45,74,45,0.1)",
            }}
          >
            <h2 className="font-semibold text-lg mb-6" style={{ color: "#2D4A2D" }}>
              Searching for vacancies…
            </h2>
            <LoadingSequence currentStep={loadingStep} listingCount={loadingCount} />
            <p className="text-xs mt-6" style={{ color: "#94a3b8" }}>
              Fetching from 7 job boards and scoring matches
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Render: results ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "#EDEDEB" }}>
      {/* Top */}
      <div className="mb-6">
        <button
          onClick={() => {
            setStep("select-candidate");
            setScored([]);
          }}
          className="flex items-center gap-1.5 text-sm mb-4 transition-colors duration-150"
          style={{ color: "#6B7280" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#2D4A2D")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
        >
          <ArrowLeft size={14} />
          Back to search
        </button>

        <h1 className="font-semibold text-xl" style={{ color: "#2D4A2D" }}>
          Found{" "}
          <span
            className="px-2 py-0.5 rounded-md text-base"
            style={{ background: "#a8e6cf", color: "#2D4A2D" }}
          >
            {filteredScored.length}
          </span>{" "}
          vacancies matching{" "}
          {selectedCandidate
            ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}`
            : "candidate"}
        </h1>

        <SourceStatusBar statuses={sourceStatuses} counts={sourceCounts} />
      </div>

      {/* Body */}
      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <FilterPanel
            minScore={minScore}
            setMinScore={setMinScore}
            locationFilter={locationFilter}
            setLocationFilter={setLocationFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            sources={activeSources}
            totalCount={scored.length}
            filteredCount={filteredScored.length}
          />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {filteredScored.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl p-10 text-center"
              style={{
                background: "#fff",
                border: "1px solid rgba(45,74,45,0.1)",
              }}
            >
              <Search
                size={36}
                className="mx-auto mb-3"
                style={{ color: "rgba(45,74,45,0.2)" }}
              />
              <p className="text-base font-semibold mb-1" style={{ color: "#2D4A2D" }}>
                No matches found with current filters
              </p>
              <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
                Try lowering the minimum match score
              </p>
              <button
                onClick={() => setMinScore(0)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{ background: "#2D4A2D", color: "#fff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#3D6B3D")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2D4A2D")}
              >
                Show all matches
              </button>
            </motion.div>
          ) : (
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
              {filteredScored.map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                >
                  <VacancyCard
                    listing={listing}
                    candidateId={selectedCandidate?.id ?? ""}
                    candidateName={
                      selectedCandidate
                        ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}`
                        : ""
                    }
                    isWatchlisted={watchlist.some((w) => w.id === listing.id)}
                    onToggleWatchlist={() => handleToggleWatchlist(listing)}
                    onAddToPipeline={() => handleAddToPipeline(listing)}
                    onSendToCandidate={() => setSendModal(listing)}
                    addingToPipeline={addingId === listing.id}
                    alreadyAdded={addedToPipeline.has(listing.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Send modal */}
      <AnimatePresence>
        {sendModal && selectedCandidate && (
          <SendToCandidateModal
            listing={sendModal}
            candidate={selectedCandidate}
            onClose={() => setSendModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

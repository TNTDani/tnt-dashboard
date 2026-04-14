"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { db, initDb } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  CandidateProfile, Vacancy, FollowUp, Placement, RecentItem,
} from "@/lib/types";
import {
  UserCircle, Briefcase, Building2, ArrowLeft, Search, Plus,
  ChevronRight, Clock, Users, TrendingUp, Bell,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "home" | "candidates" | "vacancies";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAND_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active:  { bg: "rgba(76,175,80,0.1)",   text: "#4CAF50" },
  passive: { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b" },
  placed:  { bg: "rgba(45,74,45,0.1)",    text: "#3D6B3D" },
};

const VAC_STATUS_LABEL: Record<string, string> = {
  open: "Active", "on-hold": "Prospected", closed: "Filled",
};
const VAC_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:     { bg: "rgba(76,175,80,0.1)",    text: "#4CAF50" },
  "on-hold": { bg: "rgba(45,74,45,0.1)",    text: "#3D6B3D" },
  closed:   { bg: "rgba(148,163,184,0.1)", text: "#94a3b8" },
};

const STAGE_ORDER = [
  "intake", "sourcing", "screening",
  "sent-to-client", "interviewing", "offer", "placed",
];

const RECENT_ICON: Record<RecentItem["type"], React.ElementType> = {
  candidate: UserCircle, vacancy: Briefcase, client: Building2,
};

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

// ── Filter Pill ───────────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: active ? "#2D4A2D" : "#FFFFFF",
        color: active ? "white" : "#6B7280",
        border: `1px solid ${active ? "#2D4A2D" : "rgba(45,74,45,0.15)"}`,
      }}
    >
      {children}
    </button>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, Icon,
}: {
  label: string;
  value: string | number;
  Icon: React.ElementType;
}) {
  return (
    <div
      className="bg-white rounded-xl p-4 text-center"
      style={{ border: "1px solid rgba(45,74,45,0.1)" }}
    >
      <Icon size={14} className="text-[#6B7280] mx-auto mb-1.5" />
      <p className="text-[22px] font-semibold text-[#2D4A2D] leading-none">{value}</p>
      <p className="text-[11px] text-[#6B7280] mt-1 leading-tight">{label}</p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession();
  const agencyId = session?.user?.agencyId;

  const [view, setView] = useState<View>("home");
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Finder state
  const [candSearch, setCandSearch] = useState("");
  const [candFilter, setCandFilter] = useState<"all" | "active" | "passive" | "placed">("all");
  const [vacSearch, setVacSearch] = useState("");
  const [vacFilter, setVacFilter] = useState<"all" | "open" | "on-hold" | "closed">("all");

  // Recent items — from localStorage, no auth needed
  useEffect(() => {
    setRecentItems(storage.getRecentItems().slice(0, 3));
  }, []);

  // Entity data — requires agencyId
  useEffect(() => {
    if (!agencyId) return;
    initDb(agencyId);
    Promise.all([
      db.getCandidateProfiles(),
      db.getVacancies(),
      db.getFollowUps(),
      db.getPlacements(),
    ])
      .then(([profs, vacs, fups, pls]) => {
        setCandidates(profs);
        setVacancies(vacs);
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        setFollowUps(fups.filter((f) => f.status !== "done" && new Date(f.dueDate) <= now));
        setPlacements(pls);
      })
      .catch(() => {});
  }, [agencyId]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const activeVacanciesCount = vacancies.filter((v) => v.status === "open").length;
  const activeCandidatesCount = candidates.filter((c) => c.status === "active").length;
  const followUpsCount = followUps.length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRevenue = placements
    .filter((p) => new Date(p.placementDate) >= monthStart)
    .reduce((sum, p) => sum + (p.feeAmount || 0), 0);
  const revenueLabel =
    monthlyRevenue >= 1000
      ? `€${Math.round(monthlyRevenue / 1000)}k`
      : monthlyRevenue > 0
      ? `€${monthlyRevenue}`
      : "—";

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((c) => {
        const q = candSearch.toLowerCase();
        if (
          q &&
          !`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) &&
          !(c.jobTitle || "").toLowerCase().includes(q) &&
          !(c.branch || "").toLowerCase().includes(q)
        )
          return false;
        if (candFilter !== "all" && c.status !== candFilter) return false;
        return true;
      }),
    [candidates, candSearch, candFilter]
  );

  const filteredVacancies = useMemo(
    () =>
      vacancies.filter((v) => {
        const q = vacSearch.toLowerCase();
        if (
          q &&
          !v.title.toLowerCase().includes(q) &&
          !v.company.toLowerCase().includes(q)
        )
          return false;
        if (vacFilter !== "all" && v.status !== vacFilter) return false;
        return true;
      }),
    [vacancies, vacSearch, vacFilter]
  );

  // ── Date string ───────────────────────────────────────────────────────────

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      <AnimatePresence mode="wait">
        {/* ─────────────────────────── HOME ──────────────────────────────── */}
        {view === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Focus header */}
            <div className="text-center mb-10 mt-2">
              <h1 className="text-[28px] font-medium text-[#2D4A2D] leading-tight">
                What&apos;s your focus today?
              </h1>
              <p className="text-[#6B7280] text-sm mt-1.5">{dateStr}</p>
            </div>

            {/* Main tiles */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10">
              {/* Find Candidates */}
              <motion.button
                whileHover={{
                  y: -3,
                  boxShadow: "0 8px 24px rgba(45,74,45,0.12)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView("candidates")}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="group relative overflow-hidden text-left rounded-2xl p-10 w-full sm:w-[280px] flex-shrink-0 cursor-pointer"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(45,74,45,0.12)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(45,74,45,0.04) 0%, transparent 40%)",
                  }}
                />
                <UserCircle
                  size={48}
                  className="text-[#2D4A2D] mb-5 relative z-10"
                  strokeWidth={1.5}
                />
                <h2 className="text-[18px] font-medium text-[#2D4A2D] leading-tight relative z-10">
                  Find Candidates
                </h2>
                <p className="text-[#6B7280] text-[13px] mt-1.5 relative z-10">
                  Search, track and engage talent
                </p>
              </motion.button>

              {/* Find Vacancies */}
              <motion.button
                whileHover={{
                  y: -3,
                  boxShadow: "0 8px 24px rgba(45,74,45,0.12)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView("vacancies")}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="group relative overflow-hidden text-left rounded-2xl p-10 w-full sm:w-[280px] flex-shrink-0 cursor-pointer"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(45,74,45,0.12)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(45,74,45,0.04) 0%, transparent 40%)",
                  }}
                />
                <Briefcase
                  size={48}
                  className="text-[#2D4A2D] mb-5 relative z-10"
                  strokeWidth={1.5}
                />
                <h2 className="text-[18px] font-medium text-[#2D4A2D] leading-tight relative z-10">
                  Find Vacancies
                </h2>
                <p className="text-[#6B7280] text-[13px] mt-1.5 relative z-10">
                  Add roles and manage pipelines
                </p>
              </motion.button>
            </div>

            {/* Continue where you left off */}
            {recentItems.length > 0 && (
              <div className="mb-8 max-w-[600px] mx-auto">
                <h2 className="text-[#2D4A2D] text-sm font-medium mb-3">
                  Continue where you left off
                </h2>
                <div className="flex flex-col gap-2">
                  {recentItems.map((item) => {
                    const Icon = RECENT_ICON[item.type];
                    return (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 transition-all group"
                        style={{
                          border: "1px solid rgba(45,74,45,0.1)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.25)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.1)";
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(45,74,45,0.1)" }}
                        >
                          <Icon size={14} className="text-[#2D4A2D]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[#2D4A2D] text-sm font-medium truncate">
                            {item.name}
                          </p>
                          <p className="text-[#6B7280] text-xs capitalize">{item.type}</p>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-[#6B7280] group-hover:text-[#2D4A2D] transition-colors flex-shrink-0"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick stats bar */}
            <div className="max-w-[600px] mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Active vacancies" value={activeVacanciesCount} Icon={Briefcase} />
                <StatCard label="Active candidates" value={activeCandidatesCount} Icon={Users} />
                <StatCard label="Follow-ups due" value={followUpsCount} Icon={Bell} />
                <StatCard label="Revenue this month" value={revenueLabel} Icon={TrendingUp} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─────────────────────── CANDIDATES FINDER ─────────────────────── */}
        {view === "candidates" && (
          <motion.div
            key="candidates"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Back + header */}
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] text-sm mb-5 transition-colors"
            >
              <ArrowLeft size={14} /> Back to home
            </button>

            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-medium text-[#2D4A2D]">Candidates</h1>
                <p className="text-[#6B7280] text-sm mt-0.5">
                  {filteredCandidates.length} of {candidates.length}
                </p>
              </div>
              <Link
                href="/candidates"
                className="text-[#2D4A2D] text-sm font-medium hover:underline"
              >
                Open full view →
              </Link>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />
              <input
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#2D4A2D] placeholder-[#6B7280] focus:outline-none transition-colors"
                style={{
                  border: "1px solid rgba(45,74,45,0.15)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
                placeholder="Search candidates by name, skill or location..."
                value={candSearch}
                onChange={(e) => setCandSearch(e.target.value)}
              />
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "active", label: "Available" },
                  { key: "passive", label: "Passive" },
                  { key: "placed", label: "Placed" },
                ] as const
              ).map((f) => (
                <FilterPill
                  key={f.key}
                  active={candFilter === f.key}
                  onClick={() => setCandFilter(f.key)}
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>

            {/* Candidate grid */}
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-20">
                <UserCircle
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: "rgba(45,74,45,0.2)" }}
                />
                <p className="text-[#2D4A2D] font-medium mb-1">
                  {candidates.length === 0 ? "No candidates yet" : "No results"}
                </p>
                {candidates.length === 0 && (
                  <Link
                    href="/candidates"
                    className="inline-flex items-center gap-1.5 mt-3 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={14} /> Add your first candidate →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCandidates.map((c, i) => {
                  const ss =
                    CAND_STATUS_STYLE[c.status] ?? CAND_STATUS_STYLE.active;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025, duration: 0.2 }}
                    >
                      <Link
                        href={`/candidates/${c.id}`}
                        className="block bg-white rounded-xl p-4 transition-all group"
                        style={{
                          border: "1px solid rgba(45,74,45,0.1)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.25)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                            "0 4px 12px rgba(0,0,0,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.1)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                            "0 1px 4px rgba(0,0,0,0.04)";
                        }}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                            style={{
                              background: "rgba(45,74,45,0.12)",
                              color: "#2D4A2D",
                            }}
                          >
                            {c.firstName.charAt(0)}
                            {c.lastName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[#2D4A2D] font-medium text-sm truncate group-hover:text-[#3D6B3D] transition-colors">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="text-[#6B7280] text-xs truncate">
                              {c.jobTitle}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                            style={{ background: ss.bg, color: ss.text }}
                          >
                            {c.status}
                          </span>
                        </div>
                        {c.branch && (
                          <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-3">
                            <Briefcase size={10} />
                            <span>{c.branch}</span>
                          </div>
                        )}
                        <div
                          className="w-full text-center text-[#2D4A2D] text-xs font-medium py-1.5 rounded-lg transition-colors"
                          style={{ border: "1px solid rgba(45,74,45,0.15)" }}
                        >
                          View profile
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─────────────────────── VACANCIES FINDER ──────────────────────── */}
        {view === "vacancies" && (
          <motion.div
            key="vacancies"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Back + header */}
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] text-sm mb-5 transition-colors"
            >
              <ArrowLeft size={14} /> Back to home
            </button>

            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-medium text-[#2D4A2D]">Vacancies</h1>
                <p className="text-[#6B7280] text-sm mt-0.5">
                  {filteredVacancies.length} of {vacancies.length}
                </p>
              </div>
              <Link
                href="/vacancies"
                className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={13} /> Add vacancy
              </Link>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />
              <input
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#2D4A2D] placeholder-[#6B7280] focus:outline-none transition-colors"
                style={{
                  border: "1px solid rgba(45,74,45,0.15)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
                placeholder="Search vacancies by title, client or stage..."
                value={vacSearch}
                onChange={(e) => setVacSearch(e.target.value)}
              />
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "open", label: "Active" },
                  { key: "on-hold", label: "Prospected" },
                  { key: "closed", label: "Filled" },
                ] as const
              ).map((f) => (
                <FilterPill
                  key={f.key}
                  active={vacFilter === f.key}
                  onClick={() => setVacFilter(f.key)}
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>

            {/* Vacancy grid */}
            {filteredVacancies.length === 0 ? (
              <div className="text-center py-20">
                <Briefcase
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: "rgba(45,74,45,0.2)" }}
                />
                <p className="text-[#2D4A2D] font-medium mb-1">
                  {vacancies.length === 0 ? "No vacancies yet" : "No results"}
                </p>
                {vacancies.length === 0 && (
                  <Link
                    href="/vacancies"
                    className="inline-flex items-center gap-1.5 mt-3 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={14} /> Add your first vacancy →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredVacancies.map((v, i) => {
                  const ss =
                    VAC_STATUS_STYLE[v.status] ?? VAC_STATUS_STYLE["on-hold"];
                  const days = daysOpen(v.createdAt);
                  const stageIdx = STAGE_ORDER.indexOf(v.stage ?? "intake");

                  return (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025, duration: 0.2 }}
                    >
                      <Link
                        href="/vacancies"
                        className="block bg-white rounded-xl p-4 transition-all group"
                        style={{
                          border: "1px solid rgba(45,74,45,0.1)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.25)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                            "0 4px 12px rgba(0,0,0,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "rgba(45,74,45,0.1)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                            "0 1px 4px rgba(0,0,0,0.04)";
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-[#2D4A2D] font-medium text-sm truncate group-hover:text-[#3D6B3D] transition-colors">
                              {v.title}
                            </p>
                            <p className="text-[#6B7280] text-xs truncate mt-0.5">
                              {v.company}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: ss.bg, color: ss.text }}
                          >
                            {VAC_STATUS_LABEL[v.status]}
                          </span>
                        </div>

                        {/* Stage progress bar */}
                        <div className="flex items-center gap-0.5 mb-3">
                          {STAGE_ORDER.map((_, si) => (
                            <div
                              key={si}
                              className="flex-1 h-1 rounded-full"
                              style={{
                                background:
                                  si <= stageIdx
                                    ? "#2D4A2D"
                                    : "rgba(45,74,45,0.12)",
                              }}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {days}d open
                          </span>
                          {(v.clientFeedback?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Users size={10} />
                              {v.clientFeedback.length} candidates
                            </span>
                          )}
                        </div>

                        <div
                          className="w-full text-center text-[#2D4A2D] text-xs font-medium py-1.5 rounded-lg transition-colors"
                          style={{ border: "1px solid rgba(45,74,45,0.15)" }}
                        >
                          View vacancy
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { db, initDb } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  CandidateProfile, Vacancy, FollowUp, Placement, RecentItem,
} from "@/lib/types";
import {
  UserCircle, Briefcase, Building2, ArrowLeft, Search, Plus,
  ChevronRight, Clock, Users, TrendingUp, Bell, ArrowRight,
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
  open:      { bg: "rgba(76,175,80,0.1)",   text: "#4CAF50" },
  "on-hold": { bg: "rgba(45,74,45,0.1)",    text: "#3D6B3D" },
  closed:    { bg: "rgba(148,163,184,0.1)", text: "#94a3b8" },
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

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function CandidatesIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="18" r="9" fill="rgba(45,74,45,0.1)" stroke="#2D4A2D" strokeWidth="1.5" />
      <path d="M11 44c0-8.284 6.716-15 15-15s15 6.716 15 15" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="42" cy="10" r="2.5" fill="#2D4A2D" opacity="0.35" />
      <circle cx="47" cy="19" r="1.75" fill="#2D4A2D" opacity="0.25" />
      <circle cx="39" cy="5"  r="1.75" fill="#2D4A2D" opacity="0.25" />
      <line x1="42" y1="10" x2="34" y2="16" stroke="#2D4A2D" strokeWidth="0.75" opacity="0.25" />
      <line x1="42" y1="10" x2="47" y2="19" stroke="#2D4A2D" strokeWidth="0.75" opacity="0.25" />
      <line x1="42" y1="10" x2="39" y2="5"  stroke="#2D4A2D" strokeWidth="0.75" opacity="0.25" />
    </svg>
  );
}

function VacanciesIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect x="8" y="22" width="36" height="23" rx="5" fill="rgba(45,74,45,0.1)" stroke="#2D4A2D" strokeWidth="1.5" />
      <path d="M20 22v-4a2 2 0 012-2h8a2 2 0 012 2v4" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="33" x2="44" y2="33" stroke="#2D4A2D" strokeWidth="1.25" opacity="0.4" />
      <path d="M36 20 Q41 14 47 20" stroke="#2D4A2D" strokeWidth="1.25" fill="none" opacity="0.3" strokeLinecap="round" />
      <path d="M38 17 Q43 9  49 17" stroke="#2D4A2D" strokeWidth="1.25" fill="none" opacity="0.18" strokeLinecap="round" />
      <circle cx="36" cy="20" r="2" fill="#2D4A2D" opacity="0.5" />
    </svg>
  );
}

// ── Spotlight Card ─────────────────────────────────────────────────────────────

function SpotlightCard({
  children,
  onClick,
  delay = 0,
  isExiting = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  delay?: number;
  isExiting?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [spot, setSpot] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setSpot({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      className="group"
      initial={{ opacity: 0, y: 20 }}
      animate={isExiting ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
      whileHover={!isExiting ? { y: -6, scale: 1.01 } : undefined}
      whileTap={!isExiting ? { scale: 0.96, transition: { duration: 0.08 } } : undefined}
      transition={
        isExiting
          ? { duration: 0.2, ease: "easeIn" }
          : { duration: 0.5, delay, ease: "easeOut" }
      }
      style={{
        // whileHover has its own spring-feel transition below
        ...(isExiting ? {} : {}),
      }}
      onMouseMove={onMouseMove}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Outer shell — CSS transitions for colour/shadow, Motion for transform */}
      <div
        style={{
          width: 320,
          height: 220,
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          borderRadius: 20,
          background: isHovered ? "#FAFAF9" : "#FFFFFF",
          border: `1px solid ${isHovered ? "rgba(45,74,45,0.4)" : "rgba(45,74,45,0.15)"}`,
          boxShadow: isHovered
            ? "0 20px 40px rgba(45,74,45,0.15)"
            : "0 2px 8px rgba(45,74,45,0.06)",
          transition: "border-color 200ms, background 200ms, box-shadow 200ms",
        }}
      >
        {/* Spotlight glow — follows cursor */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            background: isHovered
              ? `radial-gradient(220px circle at ${spot.x}px ${spot.y}px, rgba(45,74,45,0.07), transparent 80%)`
              : "transparent",
          }}
        />

        {/* Left accent line — slides in on hover */}
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            top: 16,
            bottom: 16,
            width: 3,
            borderRadius: 99,
            background: "#2D4A2D",
            originY: 0.5,
            zIndex: 1,
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={isHovered ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            padding: "20px 24px 22px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
    </motion.div>
  );
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const agencyId = session?.user?.agencyId;

  const [view, setView] = useState<View>("home");
  const [isExiting, setIsExiting] = useState(false);

  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  const [candSearch, setCandSearch] = useState("");
  const [candFilter, setCandFilter] = useState<"all" | "active" | "passive" | "placed">("all");
  const [vacSearch, setVacSearch] = useState("");
  const [vacFilter, setVacFilter] = useState<"all" | "open" | "on-hold" | "closed">("all");

  useEffect(() => {
    setRecentItems(storage.getRecentItems().slice(0, 3));
  }, []);

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

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeVacanciesCount   = vacancies.filter((v) => v.status === "open").length;
  const activeCandidatesCount  = candidates.filter((c) => c.status === "active").length;
  const followUpsCount         = followUps.length;

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

  // ── Filtered lists ─────────────────────────────────────────────────────────

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

  // ── Date string ────────────────────────────────────────────────────────────

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Navigation with exit animation ────────────────────────────────────────

  const handleTileClick = useCallback(
    (href: string) => {
      setIsExiting(true);
      setTimeout(() => router.push(href), 220);
    },
    [router]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Global cursor-blink keyframe */}
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 0.55 }
          50%       { opacity: 0 }
        }
      `}</style>

      <AnimatePresence mode="wait">

        {/* ───────────────────────────── HOME ────────────────────────────── */}
        {view === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Dot grid — fixed behind content */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundImage:
                  "radial-gradient(circle, rgba(45,74,45,0.08) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>

              {/* ── Heading ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -10 : 0 }}
                transition={{ duration: isExiting ? 0.2 : 0.4, ease: "easeOut" }}
                className="text-center mb-10 mt-2"
              >
                <h1
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: "#2D4A2D",
                    lineHeight: 1.2,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  What&apos;s your focus today?
                  {/* Terminal cursor */}
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 26,
                      background: "#2D4A2D",
                      borderRadius: 1,
                      verticalAlign: "middle",
                      animation: "cursor-blink 1.2s step-end infinite",
                    }}
                  />
                </h1>
                <p style={{ color: "#6B7280", fontSize: 14, marginTop: 6 }}>{dateStr}</p>
              </motion.div>

              {/* ── Tiles ── */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 32,
                  marginBottom: 40,
                }}
              >
                {/* Find Candidates → /sourcing */}
                <SpotlightCard
                  onClick={() => handleTileClick("/sourcing")}
                  delay={0.15}
                  isExiting={isExiting}
                >
                  <CandidatesIcon />
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#2D4A2D",
                        background: "#a8e6cf",
                        padding: "2px 8px",
                        borderRadius: 99,
                        letterSpacing: "0.3px",
                      }}
                    >
                      AI-Powered
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: "#2D4A2D",
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    Find Candidates
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    Search, source and engage<br />the right talent for any role
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#2D4A2D",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-150 group-hover:translate-x-1"
                    />
                  </div>
                </SpotlightCard>

                {/* Find Vacancies → /vacancy-monitor */}
                <SpotlightCard
                  onClick={() => handleTileClick("/vacancy-monitor")}
                  delay={0.25}
                  isExiting={isExiting}
                >
                  <VacanciesIcon />
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#2D4A2D",
                        background: "#a8e6cf",
                        padding: "2px 8px",
                        borderRadius: 99,
                        letterSpacing: "0.3px",
                      }}
                    >
                      Live Market Data
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: "#2D4A2D",
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    Find Vacancies
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    Discover open roles and<br />build your client pipeline
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#2D4A2D",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-150 group-hover:translate-x-1"
                    />
                  </div>
                </SpotlightCard>
              </div>

              {/* ── Continue where you left off ── */}
              {recentItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -8 : 0 }}
                  transition={{
                    duration: isExiting ? 0.18 : 0.5,
                    delay: isExiting ? 0 : 0.5,
                    ease: "easeOut",
                  }}
                  className="mb-8 max-w-[700px] mx-auto"
                >
                  <p
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      color: "#6B7280",
                      marginBottom: 12,
                      textAlign: "center",
                    }}
                  >
                    Continue where you left off
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    {recentItems.map((item) => {
                      const Icon = RECENT_ICON[item.type];
                      return (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={item.href}
                          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid rgba(45,74,45,0.2)",
                            color: "#2D4A2D",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#2D4A2D";
                            e.currentTarget.style.color = "#FFFFFF";
                            e.currentTarget.style.borderColor = "#2D4A2D";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#FFFFFF";
                            e.currentTarget.style.color = "#2D4A2D";
                            e.currentTarget.style.borderColor = "rgba(45,74,45,0.2)";
                          }}
                        >
                          <Icon size={13} />
                          <span>{item.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              opacity: 0.55,
                              textTransform: "capitalize",
                            }}
                          >
                            {item.type}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Quick stats row ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isExiting ? 0 : 1 }}
                transition={{
                  duration: isExiting ? 0.18 : 0.5,
                  delay: isExiting ? 0 : 0.4,
                  ease: "easeOut",
                }}
                className="max-w-[672px] mx-auto"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    background: "#FFFFFF",
                    borderRadius: 16,
                    border: "1px solid rgba(45,74,45,0.08)",
                    overflow: "hidden",
                  }}
                >
                  {(
                    [
                      { label: "Active vacancies",  value: activeVacanciesCount,  Icon: Briefcase  },
                      { label: "Active candidates",  value: activeCandidatesCount, Icon: Users      },
                      { label: "Follow-ups due",     value: followUpsCount,        Icon: Bell       },
                      { label: "Revenue this month", value: revenueLabel,          Icon: TrendingUp },
                    ] as const
                  ).map((stat, i) => (
                    <div
                      key={stat.label}
                      style={{ display: "flex", alignItems: "stretch", flex: 1 }}
                    >
                      {i > 0 && (
                        <div
                          style={{
                            width: 1,
                            background: "rgba(45,74,45,0.08)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div
                        style={{
                          flex: 1,
                          padding: "14px 10px",
                          textAlign: "center",
                        }}
                      >
                        <stat.Icon
                          size={13}
                          style={{ color: "#6B7280", margin: "0 auto 5px" }}
                        />
                        <p
                          style={{
                            fontSize: 20,
                            fontWeight: 600,
                            color: "#2D4A2D",
                            lineHeight: 1,
                          }}
                        >
                          {stat.value}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 4,
                            lineHeight: 1.3,
                          }}
                        >
                          {stat.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          </motion.div>
        )}

        {/* ──────────────────────── CANDIDATES FINDER ─────────────────────── */}
        {view === "candidates" && (
          <motion.div
            key="candidates"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
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
              <Link href="/candidates" className="text-[#2D4A2D] text-sm font-medium hover:underline">
                Open full view →
              </Link>
            </div>

            <div className="relative mb-4">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#2D4A2D] placeholder-[#6B7280] focus:outline-none transition-colors"
                style={{ border: "1px solid rgba(45,74,45,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                placeholder="Search candidates by name, skill or location..."
                value={candSearch}
                onChange={(e) => setCandSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  { key: "all",     label: "All"       },
                  { key: "active",  label: "Available" },
                  { key: "passive", label: "Passive"   },
                  { key: "placed",  label: "Placed"    },
                ] as const
              ).map((f) => (
                <FilterPill key={f.key} active={candFilter === f.key} onClick={() => setCandFilter(f.key)}>
                  {f.label}
                </FilterPill>
              ))}
            </div>

            {filteredCandidates.length === 0 ? (
              <div className="text-center py-20">
                <UserCircle size={40} className="mx-auto mb-3" style={{ color: "rgba(45,74,45,0.2)" }} />
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
                  const ss = CAND_STATUS_STYLE[c.status] ?? CAND_STATUS_STYLE.active;
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
                        style={{ border: "1px solid rgba(45,74,45,0.1)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(45,74,45,0.25)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow  = "0 4px 12px rgba(0,0,0,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(45,74,45,0.1)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow  = "0 1px 4px rgba(0,0,0,0.04)";
                        }}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                            style={{ background: "rgba(45,74,45,0.12)", color: "#2D4A2D" }}
                          >
                            {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[#2D4A2D] font-medium text-sm truncate group-hover:text-[#3D6B3D] transition-colors">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="text-[#6B7280] text-xs truncate">{c.jobTitle}</p>
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
                            <Briefcase size={10} /><span>{c.branch}</span>
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

        {/* ──────────────────────── VACANCIES FINDER ──────────────────────── */}
        {view === "vacancies" && (
          <motion.div
            key="vacancies"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
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

            <div className="relative mb-4">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#2D4A2D] placeholder-[#6B7280] focus:outline-none transition-colors"
                style={{ border: "1px solid rgba(45,74,45,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                placeholder="Search vacancies by title, client or stage..."
                value={vacSearch}
                onChange={(e) => setVacSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  { key: "all",      label: "All"        },
                  { key: "open",     label: "Active"     },
                  { key: "on-hold",  label: "Prospected" },
                  { key: "closed",   label: "Filled"     },
                ] as const
              ).map((f) => (
                <FilterPill key={f.key} active={vacFilter === f.key} onClick={() => setVacFilter(f.key)}>
                  {f.label}
                </FilterPill>
              ))}
            </div>

            {filteredVacancies.length === 0 ? (
              <div className="text-center py-20">
                <Briefcase size={40} className="mx-auto mb-3" style={{ color: "rgba(45,74,45,0.2)" }} />
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
                  const ss = VAC_STATUS_STYLE[v.status] ?? VAC_STATUS_STYLE["on-hold"];
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
                        style={{ border: "1px solid rgba(45,74,45,0.1)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(45,74,45,0.25)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow  = "0 4px 12px rgba(0,0,0,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(45,74,45,0.1)";
                          (e.currentTarget as HTMLAnchorElement).style.boxShadow  = "0 1px 4px rgba(0,0,0,0.04)";
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-[#2D4A2D] font-medium text-sm truncate group-hover:text-[#3D6B3D] transition-colors">
                              {v.title}
                            </p>
                            <p className="text-[#6B7280] text-xs truncate mt-0.5">{v.company}</p>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: ss.bg, color: ss.text }}
                          >
                            {VAC_STATUS_LABEL[v.status]}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 mb-3">
                          {STAGE_ORDER.map((_, si) => (
                            <div
                              key={si}
                              className="flex-1 h-1 rounded-full"
                              style={{ background: si <= stageIdx ? "#2D4A2D" : "rgba(45,74,45,0.12)" }}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {days}d open
                          </span>
                          {(v.clientFeedback?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Users size={10} /> {v.clientFeedback.length} candidates
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

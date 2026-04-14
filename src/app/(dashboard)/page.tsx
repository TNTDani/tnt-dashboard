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
  Clock, Users, TrendingUp, Bell,
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

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

// ── Inline SVG icons (from HTML prototype) ────────────────────────────────────

function CandidatesIcon() {
  return (
    <svg className="tile-icon" width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="22" cy="18" r="8" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M8 42c0-7.732 6.268-14 14-14h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="36" cy="36" r="9" stroke="currentColor" strokeWidth="1.8" opacity="0.5"/>
      <line x1="43" y1="43" x2="47" y2="47" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="36" cy="32" r="1.5" fill="currentColor" opacity="0.4"/>
      <circle cx="32" cy="38" r="1.5" fill="currentColor" opacity="0.4"/>
      <circle cx="40" cy="38" r="1.5" fill="currentColor" opacity="0.4"/>
      <line x1="36" y1="33.5" x2="32" y2="36.5" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
      <line x1="36" y1="33.5" x2="40" y2="36.5" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
    </svg>
  );
}

function VacanciesIcon() {
  return (
    <svg className="tile-icon" width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect x="10" y="16" width="32" height="26" rx="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M18 16V12a2 2 0 012-2h12a2 2 0 012 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="26" cy="29" r="7" stroke="currentColor" strokeWidth="1.4" opacity="0.45"/>
      <circle cx="26" cy="29" r="4" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
      <circle cx="26" cy="29" r="1.5" fill="currentColor" opacity="0.6"/>
      <line x1="26" y1="22" x2="26" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      <line x1="26" y1="36" x2="26" y2="38" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      <line x1="19" y1="29" x2="17" y2="29" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      <line x1="33" y1="29" x2="35" y2="29" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
    </svg>
  );
}

// Small icons for continue pills — matching HTML prototype types
function PillPersonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 10c0-2.2 1.8-4 4-4h1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function PillBriefcaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="4" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 4V3a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function PillBuildingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="7" x2="4" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6" y1="7" x2="6" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="8" y1="7" x2="8" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

const PILL_ICON: Record<RecentItem["type"], React.ReactNode> = {
  candidate: <PillPersonIcon />,
  vacancy:   <PillBriefcaseIcon />,
  client:    <PillBuildingIcon />,
};

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
  // Percentage-based coords, matching HTML prototype's approach
  const [spot, setSpot] = useState({ x: "50", y: "50" });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - r.left) / r.width  * 100).toFixed(1),
      y: ((e.clientY - r.top)  / r.height * 100).toFixed(1),
    });
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
      onMouseMove={onMouseMove}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{ color: "#2D4A2D" }}  // currentColor base for SVGs
    >
      <div
        style={{
          width: 300,
          minHeight: 210,
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          borderRadius: 20,
          padding: "28px 24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: isHovered ? "#FAFAF9" : "#FFFFFF",
          border: `1px solid ${isHovered ? "rgba(45,74,45,0.4)" : "rgba(45,74,45,0.15)"}`,
          boxShadow: isHovered
            ? "0 20px 40px rgba(45,74,45,0.15)"
            : "0 2px 8px rgba(45,74,45,0.06)",
          transition: "border-color 200ms cubic-bezier(0.34,1.56,0.64,1), background 200ms ease, box-shadow 200ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Spotlight — opacity-only transition, gradient always set at last position */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 20,
            pointerEvents: "none",
            background: `radial-gradient(circle 140px at ${spot.x}% ${spot.y}%, rgba(45,74,45,0.09) 0%, transparent 70%)`,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        />

        {/* Left accent line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 20,
            bottom: 20,
            width: 3,
            background: "#2D4A2D",
            borderRadius: "0 2px 2px 0",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 180ms ease",
          }}
        />

        {/* Content (sits above spotlight) */}
        <div style={{ position: "relative", zIndex: 1, display: "contents" }}>
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

  const activeVacanciesCount  = vacancies.filter((v) => v.status === "open").length;
  const activeCandidatesCount = candidates.filter((c) => c.status === "active").length;
  const followUpsCount        = followUps.length;

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
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 0; }
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
            {/* Dot grid — fixed, behind everything */}
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

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "60px 24px 0",
              }}
            >
              {/* ── Heading ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -10 : 0 }}
                transition={{ duration: isExiting ? 0.2 : 0.4, ease: "easeOut" }}
                style={{ textAlign: "center", marginBottom: 36 }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 400,
                    color: "#2D4A2D",
                    lineHeight: 1.2,
                    fontFamily: "var(--font-dm-serif, serif)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  What&apos;s your focus today?
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 28,
                      background: "#2D4A2D",
                      marginLeft: 4,
                      borderRadius: 1,
                      verticalAlign: "middle",
                      animation: "cursor-blink 1.1s step-end infinite",
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6, letterSpacing: "0.2px" }}>
                  {dateStr}
                </div>
              </motion.div>

              {/* ── Tiles ── */}
              <div
                style={{
                  display: "flex",
                  gap: 28,
                  alignItems: "stretch",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  marginBottom: 32,
                }}
              >
                {/* Find Candidates → /sourcing */}
                <SpotlightCard
                  onClick={() => handleTileClick("/sourcing")}
                  delay={0.15}
                  isExiting={isExiting}
                >
                  <CandidatesIcon />
                  {/* Badge */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#a8e6cf", color: "#2D4A2D", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, width: "fit-content", letterSpacing: "0.1px" }}>
                    <span style={{ width: 5, height: 5, background: "#2D4A2D", borderRadius: "50%", opacity: 0.6, flexShrink: 0 }} />
                    AI-Powered
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#2D4A2D", lineHeight: 1.2 }}>
                    Find Candidates
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, flex: 1 }}>
                    Search, source and engage the right talent for any role
                  </div>
                  {/* Arrow — gap & line grow via group-hover */}
                  <div
                    className="flex items-center text-[rgba(45,74,45,0.5)] group-hover:text-[#2D4A2D] transition-colors duration-200"
                    style={{ gap: 6, fontSize: 12, fontWeight: 500, marginTop: 4 }}
                  >
                    <span>Explore talent</span>
                    <span
                      className="h-px bg-current opacity-40 transition-all duration-200"
                      style={{ flex: "none", width: 32 }}
                      ref={(el) => {
                        if (el) {
                          el.closest(".group")?.addEventListener("mouseenter", () => { el.style.width = "44px"; });
                          el.closest(".group")?.addEventListener("mouseleave", () => { el.style.width = "32px"; });
                        }
                      }}
                    />
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </SpotlightCard>

                {/* Find Vacancies → /vacancy-monitor */}
                <SpotlightCard
                  onClick={() => handleTileClick("/vacancy-monitor")}
                  delay={0.25}
                  isExiting={isExiting}
                >
                  <VacanciesIcon />
                  {/* Badge */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#a8e6cf", color: "#2D4A2D", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, width: "fit-content", letterSpacing: "0.1px" }}>
                    <span style={{ width: 5, height: 5, background: "#2D4A2D", borderRadius: "50%", opacity: 0.6, flexShrink: 0 }} />
                    Live Market Data
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#2D4A2D", lineHeight: 1.2 }}>
                    Find Vacancies
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, flex: 1 }}>
                    Discover open roles and build your client pipeline
                  </div>
                  {/* Arrow */}
                  <div
                    className="flex items-center text-[rgba(45,74,45,0.5)] group-hover:text-[#2D4A2D] transition-colors duration-200"
                    style={{ gap: 6, fontSize: 12, fontWeight: 500, marginTop: 4 }}
                  >
                    <span>Browse roles</span>
                    <span
                      className="h-px bg-current opacity-40 transition-all duration-200"
                      style={{ flex: "none", width: 32 }}
                      ref={(el) => {
                        if (el) {
                          el.closest(".group")?.addEventListener("mouseenter", () => { el.style.width = "44px"; });
                          el.closest(".group")?.addEventListener("mouseleave", () => { el.style.width = "32px"; });
                        }
                      }}
                    />
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </SpotlightCard>
              </div>

              {/* ── Continue where you left off ── */}
              {recentItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -8 : 0 }}
                  transition={{ duration: isExiting ? 0.18 : 0.5, delay: isExiting ? 0 : 0.5, ease: "easeOut" }}
                  style={{ textAlign: "center", width: "100%", maxWidth: 660, marginBottom: 28 }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "1.5px",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Continue where you left off
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {recentItems.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-[7px] transition-all duration-150"
                        style={{
                          background: "white",
                          border: "1px solid rgba(45,74,45,0.2)",
                          borderRadius: 999,
                          padding: "7px 14px",
                          fontSize: 12,
                          color: "#2D4A2D",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#2D4A2D";
                          e.currentTarget.style.color = "white";
                          e.currentTarget.style.borderColor = "#2D4A2D";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.color = "#2D4A2D";
                          e.currentTarget.style.borderColor = "rgba(45,74,45,0.2)";
                        }}
                      >
                        {PILL_ICON[item.type]}
                        {item.name}
                        <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2, textTransform: "capitalize" }}>
                          · {item.type}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Stats bar card ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -6 : 0 }}
                transition={{ duration: isExiting ? 0.18 : 0.45, delay: isExiting ? 0 : 0.6, ease: "easeOut" }}
                style={{
                  width: "100%",
                  maxWidth: 660,
                  background: "#fff",
                  borderRadius: 16,
                  border: "0.5px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 2px 8px rgba(45,74,45,0.05)",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  overflow: "hidden",
                  marginBottom: 32,
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
                    style={{
                      padding: "18px 20px",
                      textAlign: "center",
                      borderRight: i < 3 ? "0.5px solid rgba(45,74,45,0.08)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(45,74,45,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <stat.Icon size={15} color="#2D4A2D" strokeWidth={1.8} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#2D4A2D", lineHeight: 1.1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#6B7280", lineHeight: 1.3, textAlign: "center" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* ── Bottom grid: Recent pipeline + Open vacancies ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -6 : 0 }}
                transition={{ duration: isExiting ? 0.18 : 0.5, delay: isExiting ? 0 : 0.75, ease: "easeOut" }}
                style={{
                  width: "100%",
                  maxWidth: 660,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                  marginBottom: 40,
                }}
              >
                {/* Recent pipeline */}
                <div style={{ background: "#fff", borderRadius: 16, border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(45,74,45,0.05)", overflow: "hidden" }}>
                  <div style={{ padding: "16px 18px 12px", borderBottom: "0.5px solid rgba(45,74,45,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#2D4A2D", letterSpacing: "-0.1px" }}>Recent pipeline</span>
                    <Link href="/candidates" style={{ fontSize: 11, color: "#6DC88A", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
                  </div>
                  {candidates.length === 0 ? (
                    <div style={{ padding: "28px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#6B7280" }}>No candidates yet</p>
                      <Link href="/candidates" style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: "#fff", background: "#2D4A2D", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>+ Add candidate</Link>
                    </div>
                  ) : (
                    <div>
                      {candidates.slice(0, 4).map((c, i) => {
                        const ss = CAND_STATUS_STYLE[c.status] ?? CAND_STATUS_STYLE.active;
                        return (
                          <Link
                            key={c.id}
                            href={`/candidates/${c.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 18px",
                              borderBottom: i < Math.min(candidates.length, 4) - 1 ? "0.5px solid rgba(45,74,45,0.06)" : "none",
                              textDecoration: "none",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(45,74,45,0.03)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(45,74,45,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2D4A2D", flexShrink: 0 }}>
                              {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#2D4A2D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.firstName} {c.lastName}</div>
                              <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.jobTitle || c.branch || "—"}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: ss.bg, color: ss.text, flexShrink: 0, textTransform: "capitalize" }}>{c.status}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Open vacancies */}
                <div style={{ background: "#fff", borderRadius: 16, border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(45,74,45,0.05)", overflow: "hidden" }}>
                  <div style={{ padding: "16px 18px 12px", borderBottom: "0.5px solid rgba(45,74,45,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#2D4A2D", letterSpacing: "-0.1px" }}>Open vacancies</span>
                    <Link href="/vacancies" style={{ fontSize: 11, color: "#6DC88A", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
                  </div>
                  {vacancies.filter(v => v.status === "open").length === 0 ? (
                    <div style={{ padding: "28px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#6B7280" }}>No open vacancies</p>
                      <Link href="/vacancies" style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: "#fff", background: "#2D4A2D", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>+ Add vacancy</Link>
                    </div>
                  ) : (
                    <div>
                      {vacancies.filter(v => v.status === "open").slice(0, 4).map((v, i, arr) => (
                        <Link
                          key={v.id}
                          href={`/vacancies`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 18px",
                            borderBottom: i < arr.length - 1 ? "0.5px solid rgba(45,74,45,0.06)" : "none",
                            textDecoration: "none",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(45,74,45,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(45,74,45,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Briefcase size={13} color="#2D4A2D" strokeWidth={1.8} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#2D4A2D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                            <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.company} · {daysOpen(v.createdAt)}d open</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "rgba(76,175,80,0.1)", color: "#4CAF50", flexShrink: 0 }}>Active</span>
                        </Link>
                      ))}
                    </div>
                  )}
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
                  { key: "all",     label: "All"        },
                  { key: "open",    label: "Active"     },
                  { key: "on-hold", label: "Prospected" },
                  { key: "closed",  label: "Filled"     },
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/db";
import { Candidate, Vacancy, FollowUp } from "@/lib/types";
import { Users, Briefcase, TrendingUp, CheckCircle, FileText, Zap, Clock, AlertCircle, Bell, Send, Check, Moon } from "lucide-react";
import Link from "next/link";
import EmailComposer from "@/components/EmailComposer";
import CalendarWidget from "@/components/CalendarWidget";
import { TimelineEntry } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  sourced:     { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  screened:    { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
  shortlisted: { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
  interviewed: { bg: "rgba(45,74,45,0.15)",  text: "#3D6B3D" },
  placed:      { bg: "rgba(76,175,80,0.15)",  text: "#4CAF50" },
};

function getEffectiveDueDate(f: FollowUp): Date {
  if (f.status === "snoozed" && f.snoozedUntil) return new Date(f.snoozedUntil);
  return new Date(f.dueDate);
}

function getFollowUpBucket(f: FollowUp): "overdue" | "today" | "week" | "future" {
  const due = getEffectiveDueDate(f);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.floor((dueDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "future";
}

function daysSinceContact(f: FollowUp): number {
  return Math.floor((Date.now() - new Date(f.lastContactDate).getTime()) / 86400000);
}

function daysUntilDue(f: FollowUp): number {
  const due = getEffectiveDueDate(f);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.floor((dueDay.getTime() - today.getTime()) / 86400000);
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ── FollowUpItem ──────────────────────────────────────────────────────────────

interface FollowUpItemProps {
  followUp: FollowUp;
  bucket: "overdue" | "today" | "week";
  onDone: (id: string) => void;
  onSnooze: (id: string) => void;
  onSendFollowUp: (followUp: FollowUp) => void;
}

function FollowUpItem({ followUp, bucket, onDone, onSnooze, onSendFollowUp }: FollowUpItemProps) {
  const days = daysSinceContact(followUp);
  const daysLeft = daysUntilDue(followUp);

  const accentColor =
    bucket === "overdue" ? "#EF4444" : bucket === "today" ? "#F59E0B" : "#6B7280";
  const dueBadgeText =
    bucket === "overdue"
      ? `${Math.abs(daysLeft)}d overdue`
      : bucket === "today"
      ? "Due today"
      : `Due in ${daysLeft}d`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative rounded-xl p-4 transition-all"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${accentColor}22`,
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#2D4A2D] text-sm font-medium">{followUp.contactName}</span>
            <span className="text-[#6B7280] text-xs">·</span>
            <span className="text-[#6B7280] text-xs">{followUp.company}</span>
          </div>
          <p className="text-[#6B7280] text-xs truncate mt-0.5">Re: {followUp.originalEmailSubject}</p>
          <p className="text-[#6B7280] text-xs mt-0.5">
            {days === 0 ? "Contacted today" : `${days}d since last contact`}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {dueBadgeText}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onSendFollowUp(followUp)}
          className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          <Send size={11} /> Send Follow-up
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onSnooze(followUp.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#2D4A2D] text-xs transition-colors"
          style={{ background: "rgba(45,74,45,0.08)", border: "1px solid rgba(45,74,45,0.15)" }}
        >
          <Moon size={11} /> Snooze 2d
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onDone(followUp.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#4CAF50] text-xs transition-colors"
          style={{ background: "rgba(45,74,45,0.08)", border: "1px solid rgba(45,74,45,0.15)" }}
        >
          <Check size={11} /> Done
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  }),
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFollowUp, setComposerFollowUp] = useState<FollowUp | null>(null);

  const loadFollowUps = useCallback(async () => {
    const all = await db.getFollowUps();
    const pending = all
      .filter((f) => f.status !== "done")
      .filter((f) => getFollowUpBucket(f) !== "future");
    pending.sort(
      (a, b) => getEffectiveDueDate(a).getTime() - getEffectiveDueDate(b).getTime()
    );
    setFollowUps(pending);
  }, []);

  useEffect(() => {
    db.getCandidates().then(setCandidates);
    db.getVacancies().then(setVacancies);
    loadFollowUps();
  }, [loadFollowUps]);

  const handleDone = (id: string) => {
    db.getFollowUps().then((all) => {
      db.saveFollowUps(all.map((f) => (f.id === id ? { ...f, status: "done" as const } : f)));
      loadFollowUps();
    });
  };

  const handleSnooze = (id: string) => {
    db.getFollowUps().then((all) => {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + 2);
      db.saveFollowUps(
        all.map((f) =>
          f.id === id
            ? { ...f, status: "snoozed" as const, snoozedUntil: snoozedUntil.toISOString() }
            : f
        )
      );
      loadFollowUps();
    });
  };

  const handleSendFollowUp = (followUp: FollowUp) => {
    setComposerFollowUp(followUp);
    setComposerOpen(true);
  };

  const handleFollowUpSent = (entry: TimelineEntry) => {
    if (composerFollowUp) {
      db.getFollowUps().then((all) => {
        db.saveFollowUps(
          all.map((f) => (f.id === composerFollowUp.id ? { ...f, status: "done" as const } : f))
        );
      });
    }
    loadFollowUps();
    void entry;
  };

  // Derived
  const placed = candidates.filter((c) => c.status === "placed").length;
  const openVacancies = vacancies.filter((v) => v.status === "open").length;
  const activeInPipeline = candidates.filter((c) => c.status !== "placed").length;

  const stats = [
    {
      label: "Total Candidates",
      value: candidates.length,
      icon: Users,
      color: "#3D6B3D",
      accent: "rgba(45,74,45,0.15)",
      href: "/candidates",
    },
    {
      label: "Open Vacancies",
      value: openVacancies,
      icon: Briefcase,
      color: "#60a5fa",
      accent: "rgba(59,130,246,0.15)",
      href: "/vacancies",
    },
    {
      label: "Active in Pipeline",
      value: activeInPipeline,
      icon: TrendingUp,
      color: "#fbbf24",
      accent: "rgba(245,158,11,0.15)",
      href: "/pipeline",
    },
    {
      label: "Placements Made",
      value: placed,
      icon: CheckCircle,
      color: "#4CAF50",
      accent: "rgba(76,175,80,0.15)",
      href: "/placements",
    },
  ];

  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const overdueFollowUps = followUps.filter((f) => getFollowUpBucket(f) === "overdue");
  const todayFollowUps = followUps.filter((f) => getFollowUpBucket(f) === "today");
  const weekFollowUps = followUps.filter((f) => getFollowUpBucket(f) === "week");
  const totalDue = overdueFollowUps.length + todayFollowUps.length + weekFollowUps.length;

  return (
    <div>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-[#2D4A2D] tracking-tight">Dashboard</h1>
        <p className="text-[#6B7280] text-sm mt-1">Pipeline Overview</p>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {stats.map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} custom={i}>
            <Link href={s.href} className="group block h-full">
              <motion.div
                whileHover={{ y: -2, boxShadow: `0 8px 24px ${s.color}18` }}
                transition={{ duration: 0.2 }}
                className="h-full rounded-xl p-5 cursor-pointer transition-colors"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(45,74,45,0.12)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}40`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(45,74,45,0.12)";
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[#6B7280] text-xs font-medium tracking-wide">{s.label}</span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: s.accent }}
                  >
                    <s.icon size={15} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-3xl font-semibold" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-[#6B7280] text-xs mt-2 group-hover:text-[#6B7280] transition-colors">
                  View all →
                </p>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Follow-ups */}
      {totalDue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.35 }}
          className="rounded-xl p-5 mb-6"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(239,68,68,0.18)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)" }}
              >
                <Bell size={16} className="text-[#EF4444]" />
              </div>
              <div>
                <h2 className="text-[#2D4A2D] font-semibold text-sm">Follow-ups</h2>
                <p className="text-[#6B7280] text-xs">
                  {totalDue} {totalDue === 1 ? "contact needs" : "contacts need"} attention
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {overdueFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={12} className="text-[#EF4444]" />
                  <span className="text-[#EF4444] text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Overdue
                  </span>
                </div>
                <div className="space-y-2">
                  {overdueFollowUps.map((f) => (
                    <FollowUpItem
                      key={f.id}
                      followUp={f}
                      bucket="overdue"
                      onDone={handleDone}
                      onSnooze={handleSnooze}
                      onSendFollowUp={handleSendFollowUp}
                    />
                  ))}
                </div>
              </div>
            )}
            {todayFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={12} className="text-[#F59E0B]" />
                  <span className="text-[#F59E0B] text-[10px] font-semibold uppercase tracking-[0.08em]">
                    Due Today
                  </span>
                </div>
                <div className="space-y-2">
                  {todayFollowUps.map((f) => (
                    <FollowUpItem
                      key={f.id}
                      followUp={f}
                      bucket="today"
                      onDone={handleDone}
                      onSnooze={handleSnooze}
                      onSendFollowUp={handleSendFollowUp}
                    />
                  ))}
                </div>
              </div>
            )}
            {weekFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={12} className="text-[#6B7280]" />
                  <span className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-[0.08em]">
                    This Week
                  </span>
                </div>
                <div className="space-y-2">
                  {weekFollowUps.map((f) => (
                    <FollowUpItem
                      key={f.id}
                      followUp={f}
                      bucket="week"
                      onDone={handleDone}
                      onSnooze={handleSnooze}
                      onSendFollowUp={handleSendFollowUp}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Bottom row: Recent Candidates + Quick Actions + Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
      >
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Candidates */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(45,74,45,0.12)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#2D4A2D] font-semibold text-sm">Recent Candidates</h2>
              <Link
                href="/pipeline"
                className="text-[#2D4A2D] hover:text-[#3D6B3D] text-xs font-medium transition-colors"
              >
                View all →
              </Link>
            </div>
            {recentCandidates.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(45,74,45,0.1)" }}
                >
                  <Users size={20} className="text-[#2D4A2D]" />
                </div>
                <p className="text-[#6B7280] text-sm mb-1">No candidates yet</p>
                <Link
                  href="/cv-processor"
                  className="text-[#2D4A2D] hover:text-[#3D6B3D] text-xs font-medium transition-colors"
                >
                  Process your first CV →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCandidates.map((c) => {
                  const vacancy = vacancies.find((v) => v.id === c.vacancyId);
                  const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.sourced;
                  return (
                    <motion.div
                      key={c.id}
                      whileHover={{ x: 2 }}
                      className="flex items-center gap-3 py-2.5 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                      style={{ borderBottom: "1px solid rgba(45,74,45,0.08)" }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                        style={{ background: "rgba(45,74,45,0.15)", color: "#3D6B3D" }}
                      >
                        {c.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[#2D4A2D] text-sm font-medium truncate">{c.firstName}</p>
                        <p className="text-[#6B7280] text-xs truncate">
                          {c.currentRole}
                          {vacancy ? ` · ${vacancy.title}` : ""}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 uppercase"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {c.status}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(45,74,45,0.12)",
            }}
          >
            <h2 className="text-[#2D4A2D] font-semibold text-sm mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                {
                  href: "/cv-processor",
                  icon: FileText,
                  label: "Process a CV",
                  sub: "Upload and reformat with AI",
                  color: "#3D6B3D",
                  accent: "rgba(45,74,45,0.15)",
                },
                {
                  href: "/screening",
                  icon: Zap,
                  label: "Screen a Candidate",
                  sub: "Score against a vacancy",
                  color: "#fbbf24",
                  accent: "rgba(245,158,11,0.12)",
                },
                {
                  href: "/vacancies",
                  icon: Briefcase,
                  label: "Add a Vacancy",
                  sub: "Post a new open role",
                  color: "#60a5fa",
                  accent: "rgba(59,130,246,0.12)",
                },
                {
                  href: "/pipeline",
                  icon: Users,
                  label: "View Pipeline",
                  sub: "Track all candidates",
                  color: "#4CAF50",
                  accent: "rgba(76,175,80,0.12)",
                },
              ].map((a) => (
                <Link key={a.href} href={a.href}>
                  <motion.div
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group"
                    style={{ border: "1px solid rgba(45,74,45,0.1)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "rgba(45,74,45,0.06)";
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        "rgba(45,74,45,0.25)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "";
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        "rgba(45,74,45,0.1)";
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: a.accent }}
                    >
                      <a.icon size={15} style={{ color: a.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#2D4A2D] text-sm font-medium truncate">{a.label}</p>
                      <p className="text-[#6B7280] text-xs truncate">{a.sub}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Widget */}
        <div className="lg:col-span-1">
          <CalendarWidget />
        </div>
      </motion.div>

      {/* Follow-up email composer */}
      {composerFollowUp && (
        <EmailComposer
          isOpen={composerOpen}
          onClose={() => {
            setComposerOpen(false);
            setComposerFollowUp(null);
          }}
          defaultTo={composerFollowUp.contactEmail}
          defaultSubject={`Follow-up: ${composerFollowUp.originalEmailSubject}`}
          defaultBody={`Hi ${composerFollowUp.contactName.split(" ")[0]},\n\nI wanted to follow up on my previous email regarding ${composerFollowUp.originalEmailSubject}.\n\nI'd love to connect and discuss this further. Are you available for a brief call this week?\n\nBest regards,\nDani\nOrchard`}
          followUpConfig={{
            contactType: composerFollowUp.contactType,
            contactId: composerFollowUp.contactId,
            contactName: composerFollowUp.contactName,
            company: composerFollowUp.company,
          }}
          onSent={handleFollowUpSent}
        />
      )}
    </div>
  );
}

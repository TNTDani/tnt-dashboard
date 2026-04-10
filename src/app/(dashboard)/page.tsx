"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import { Candidate, Vacancy, FollowUp } from "@/lib/types";
import { Users, Briefcase, TrendingUp, CheckCircle, FileText, Zap, Clock, AlertCircle, Bell, Send, Check, Moon } from "lucide-react";
import Link from "next/link";
import EmailComposer from "@/components/EmailComposer";
import CalendarWidget from "@/components/CalendarWidget";
import { TimelineEntry } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

const STATUS_COLORS: Record<string, string> = {
  sourced: "bg-[#94a3b8]",
  screened: "bg-[#3b82f6]",
  shortlisted: "bg-[#f59e0b]",
  interviewed: "bg-[#7C3AED]",
  placed: "bg-[#10b981]",
};

function getEffectiveDueDate(f: FollowUp): Date {
  if (f.status === 'snoozed' && f.snoozedUntil) return new Date(f.snoozedUntil);
  return new Date(f.dueDate);
}

function getFollowUpBucket(f: FollowUp): 'overdue' | 'today' | 'week' | 'future' {
  const due = getEffectiveDueDate(f);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'future';
}

function daysSinceContact(f: FollowUp): number {
  const last = new Date(f.lastContactDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / 86400000);
}

function daysUntilDue(f: FollowUp): number {
  const due = getEffectiveDueDate(f);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.floor((dueDay.getTime() - today.getTime()) / 86400000);
}

interface FollowUpItemProps {
  followUp: FollowUp;
  bucket: 'overdue' | 'today' | 'week';
  onDone: (id: string) => void;
  onSnooze: (id: string) => void;
  onSendFollowUp: (followUp: FollowUp) => void;
}

function FollowUpItem({ followUp, bucket, onDone, onSnooze, onSendFollowUp }: FollowUpItemProps) {
  const days = daysSinceContact(followUp);
  const daysLeft = daysUntilDue(followUp);

  const borderColor = bucket === 'overdue' ? 'border-red-500/30' : bucket === 'today' ? 'border-amber-500/30' : 'border-[#1e3a5f]';
  const dotColor = bucket === 'overdue' ? 'bg-red-500' : bucket === 'today' ? 'bg-amber-500' : 'bg-[#94a3b8]';
  const dueBadge = bucket === 'overdue'
    ? `${Math.abs(daysLeft)}d overdue`
    : bucket === 'today'
    ? 'Due today'
    : `Due in ${daysLeft}d`;
  const dueBadgeColor = bucket === 'overdue'
    ? 'bg-red-500/20 text-red-400'
    : bucket === 'today'
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-[#1e3a5f] text-[#94a3b8]';

  return (
    <div className={`border ${borderColor} rounded-lg p-3 bg-[#0a1628]`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-medium">{followUp.contactName}</span>
              <span className="text-[#4a6fa5] text-xs">·</span>
              <span className="text-[#94a3b8] text-xs">{followUp.company}</span>
            </div>
            <p className="text-[#4a6fa5] text-xs truncate mt-0.5">Re: {followUp.originalEmailSubject}</p>
            <p className="text-[#4a6fa5] text-xs mt-0.5">{days === 0 ? 'Contacted today' : `${days}d since last contact`}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${dueBadgeColor}`}>
          {dueBadge}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          onClick={() => onSendFollowUp(followUp)}
          className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        >
          <Send size={11} /> Send Follow-up
        </button>
        <button
          onClick={() => onSnooze(followUp.id)}
          className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-3 py-1.5 rounded-md text-xs transition-colors"
        >
          <Moon size={11} /> Snooze 2d
        </button>
        <button
          onClick={() => onDone(followUp.id)}
          className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#10b981]/20 text-[#94a3b8] hover:text-[#10b981] px-3 py-1.5 rounded-md text-xs transition-colors"
        >
          <Check size={11} /> Done
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFollowUp, setComposerFollowUp] = useState<FollowUp | null>(null);

  const loadFollowUps = useCallback(async () => {
    const all = await db.getFollowUps();
    const pending = all.filter(f => f.status !== 'done');
    const relevant = pending.filter(f => {
      const bucket = getFollowUpBucket(f);
      return bucket !== 'future';
    });
    relevant.sort((a, b) => getEffectiveDueDate(a).getTime() - getEffectiveDueDate(b).getTime());
    setFollowUps(relevant);
  }, []);

  useEffect(() => {
    db.getCandidates().then(setCandidates);
    db.getVacancies().then(setVacancies);
    loadFollowUps();
  }, [loadFollowUps]);

  const handleDone = (id: string) => {
    db.getFollowUps().then(all => {
      db.saveFollowUps(all.map(f => f.id === id ? { ...f, status: 'done' as const } : f));
      loadFollowUps();
    });
  };

  const handleSnooze = (id: string) => {
    db.getFollowUps().then(all => {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + 2);
      db.saveFollowUps(all.map(f => f.id === id
        ? { ...f, status: 'snoozed' as const, snoozedUntil: snoozedUntil.toISOString() }
        : f
      ));
      loadFollowUps();
    });
  };

  const handleSendFollowUp = (followUp: FollowUp) => {
    setComposerFollowUp(followUp);
    setComposerOpen(true);
  };

  const handleFollowUpSent = (entry: TimelineEntry) => {
    // Mark original follow-up done (the new one is created by EmailComposer via followUpConfig)
    if (composerFollowUp) {
      db.getFollowUps().then(all => {
        db.saveFollowUps(all.map(f => f.id === composerFollowUp.id ? { ...f, status: 'done' as const } : f));
      });
    }
    loadFollowUps();
    void entry; // suppress unused warning - entry is handled by EmailComposer's followUpConfig
  };

  const placed = candidates.filter(c => c.status === "placed").length;
  const openVacancies = vacancies.filter(v => v.status === "open").length;
  const activeInPipeline = candidates.filter(c => c.status !== "placed").length;

  const stats = [
    { label: "Total Candidates", value: candidates.length, icon: Users,        color: "text-[#7C3AED]", bg: "bg-[#7C3AED20]", href: "/candidates" },
    { label: "Open Vacancies",   value: openVacancies,     icon: Briefcase,    color: "text-[#3b82f6]", bg: "bg-[#3b82f620]", href: "/vacancies" },
    { label: "Active in Pipeline", value: activeInPipeline, icon: TrendingUp,  color: "text-[#f59e0b]", bg: "bg-[#f59e0b20]", href: "/pipeline" },
    { label: "Placements Made",  value: placed,             icon: CheckCircle, color: "text-[#10b981]", bg: "bg-[#10b98120]", href: "/placements" },
  ];

  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const overdueFollowUps = followUps.filter(f => getFollowUpBucket(f) === 'overdue');
  const todayFollowUps = followUps.filter(f => getFollowUpBucket(f) === 'today');
  const weekFollowUps = followUps.filter(f => getFollowUpBucket(f) === 'week');
  const totalDue = overdueFollowUps.length + todayFollowUps.length + weekFollowUps.length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#94a3b8] mt-1">TrueNorth Talent — Internal Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 cursor-pointer transition-all duration-200 hover:brightness-125 hover:border-[#2a4f7a]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#94a3b8] text-sm">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Follow-ups Section */}
      {totalDue > 0 && (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ef444420] flex items-center justify-center">
                <Bell size={16} className="text-[#ef4444]" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Follow-ups</h2>
                <p className="text-[#94a3b8] text-xs">{totalDue} {totalDue === 1 ? 'contact needs' : 'contacts need'} follow-up</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {overdueFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} className="text-red-400" />
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">Overdue</span>
                </div>
                <div className="space-y-2">
                  {overdueFollowUps.map(f => (
                    <FollowUpItem key={f.id} followUp={f} bucket="overdue" onDone={handleDone} onSnooze={handleSnooze} onSendFollowUp={handleSendFollowUp} />
                  ))}
                </div>
              </div>
            )}

            {todayFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} className="text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Due Today</span>
                </div>
                <div className="space-y-2">
                  {todayFollowUps.map(f => (
                    <FollowUpItem key={f.id} followUp={f} bucket="today" onDone={handleDone} onSnooze={handleSnooze} onSendFollowUp={handleSendFollowUp} />
                  ))}
                </div>
              </div>
            )}

            {weekFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} className="text-[#94a3b8]" />
                  <span className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider">Coming Up This Week</span>
                </div>
                <div className="space-y-2">
                  {weekFollowUps.map(f => (
                    <FollowUpItem key={f.id} followUp={f} bucket="week" onDone={handleDone} onSnooze={handleSnooze} onSendFollowUp={handleSendFollowUp} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Candidates */}
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Candidates</h2>
            <Link href="/pipeline" className="text-[#7C3AED] text-sm hover:text-[#6d28d9]">View all →</Link>
          </div>
          {recentCandidates.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="text-[#1e3a5f] mx-auto mb-2" />
              <p className="text-[#94a3b8] text-sm">No candidates yet</p>
              <Link href="/cv-processor" className="text-[#7C3AED] text-sm mt-1 inline-block">Process your first CV →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCandidates.map((c) => {
                const vacancy = vacancies.find(v => v.id === c.vacancyId);
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#1e3a5f] last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium">{c.firstName}</p>
                      <p className="text-[#94a3b8] text-xs">{c.currentRole}{vacancy ? ` · ${vacancy.title}` : ""}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { href: "/cv-processor", icon: FileText, label: "Process a CV", sub: "Upload and reformat with AI", color: "text-[#7C3AED]", bg: "bg-[#7C3AED20]" },
              { href: "/screening", icon: Zap, label: "Screen a Candidate", sub: "Score against a vacancy", color: "text-[#f59e0b]", bg: "bg-[#f59e0b20]" },
              { href: "/vacancies", icon: Briefcase, label: "Add a Vacancy", sub: "Post a new open role", color: "text-[#3b82f6]", bg: "bg-[#3b82f620]" },
              { href: "/pipeline", icon: Users, label: "View Pipeline", sub: "Track all candidates", color: "text-[#10b981]", bg: "bg-[#10b98120]" },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-[#1e3a5f] hover:border-[#7C3AED] hover:bg-[#7C3AED08] transition-all duration-200 group">
                <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>
                  <a.icon size={16} className={a.color} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium group-hover:text-[#7C3AED] transition-colors">{a.label}</p>
                  <p className="text-[#94a3b8] text-xs">{a.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        </div>
        {/* Calendar widget */}
        <div className="lg:col-span-1">
          <CalendarWidget />
        </div>
      </div>

      {/* Follow-up EmailComposer */}
      {composerFollowUp && (
        <EmailComposer
          isOpen={composerOpen}
          onClose={() => { setComposerOpen(false); setComposerFollowUp(null); }}
          defaultTo={composerFollowUp.contactEmail}
          defaultSubject={`Follow-up: ${composerFollowUp.originalEmailSubject}`}
          defaultBody={`Hi ${composerFollowUp.contactName.split(' ')[0]},\n\nI wanted to follow up on my previous email regarding ${composerFollowUp.originalEmailSubject}.\n\nI'd love to connect and discuss this further. Are you available for a brief call this week?\n\nBest regards,\nDani\nTrueNorth Talent`}
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

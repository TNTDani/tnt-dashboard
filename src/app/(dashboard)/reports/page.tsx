"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import {
  WeeklyReport, WeeklyReportMetrics,
  CandidateProfile, Client, Candidate,
  ScreeningResult, Placement, SourcingStrategy,
} from "@/lib/types";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart2, Download, FileText, Plus, Sparkles, AlertCircle,
  ChevronDown, ChevronUp, Edit3, Check, X as XIcon,
} from "lucide-react";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekEnd(weekStart: Date): Date {
  const sun = new Date(weekStart);
  sun.setDate(weekStart.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 0 })}`;
}

function weekLabel(r: WeeklyReport) {
  return `W${r.weekNumber} ${r.year}`;
}

function inRange(dateStr: string, start: Date, end: Date) {
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

// ─── Metric computation ───────────────────────────────────────────────────────
function computeMetrics(
  weekStart: Date,
  weekEnd: Date,
  profiles: CandidateProfile[],
  clients: Client[],
  candidates: Candidate[],
  screenings: ScreeningResult[],
  placements: Placement[],
  strategies: SourcingStrategy[],
): WeeklyReportMetrics {
  let emailsSent = 0;
  [...profiles, ...clients].forEach(item => {
    (item.timeline || []).forEach(entry => {
      if (entry.type === "email_sent" && inRange(entry.createdAt, weekStart, weekEnd)) {
        emailsSent++;
      }
    });
  });

  const newProspects        = profiles.filter(p => inRange(p.createdAt, weekStart, weekEnd)).length;
  const candidatesSourced   = strategies.filter(s => inRange(s.createdAt, weekStart, weekEnd)).length;
  const candidatesScreened  = screenings.filter(s => inRange(s.createdAt, weekStart, weekEnd)).length;
  const shortlistedCandidates = candidates.filter(
    c => c.status === "shortlisted" && inRange(c.createdAt, weekStart, weekEnd)
  ).length;

  const weekPlacements = placements.filter(p => inRange(p.createdAt, weekStart, weekEnd));
  const placementsMade = weekPlacements.length;
  const feesInvoiced   = weekPlacements
    .filter(p => p.paymentStatus === "invoiced" || p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);
  const feesReceived   = weekPlacements
    .filter(p => p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);

  return {
    emailsSent, replyRate: 0, newProspects, callsBooked: 0,
    candidatesSourced, candidatesScreened, shortlistedCandidates,
    placementsMade, feesInvoiced, feesReceived,
  };
}

// ─── Chart theme ──────────────────────────────────────────────────────────────
const CHART_STYLE = { backgroundColor: "transparent", fontSize: 11 };
const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(45,74,45,0.12)",
  borderRadius: 10,
  color: "#2D4A2D",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};
const axisColor = "#94a3b8";

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportReportPDF(r: WeeklyReport) {
  const m = r.metrics;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Orchard — W${r.weekNumber} ${r.year} Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .header { background: #FFFFFF; color: white; padding: 28px 36px 22px; }
  .header-logo { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #2D4A2D; text-transform: uppercase; margin-bottom: 4px; }
  .header-title { font-size: 20px; font-weight: 700; }
  .header-sub { font-size: 12px; color: #94a3b8; margin-top: 3px; }
  .body { padding: 28px 36px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
  .card-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 4px; }
  .card-value { font-size: 28px; font-weight: 800; color: #2D4A2D; }
  .card-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #2D4A2D; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .row span:first-child { color: #475569; }
  .row span:last-child { font-weight: 600; color: #1e293b; }
  .notes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px; color: #475569; line-height: 1.6; margin-top: 20px; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; background: #FFFFFF; color: #94a3b8; font-size: 10px; padding: 9px 36px; display: flex; justify-content: space-between; }
</style></head><body>
<div class="header">
  <div class="header-logo">Orchard</div>
  <div class="header-title">Weekly Report — Week ${r.weekNumber}, ${r.year}</div>
  <div class="header-sub">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)} · Generated ${fmtDate(r.generatedAt)}</div>
</div>
<div class="body">
  <div class="grid">
    <div class="card"><div class="card-label">Emails Sent</div><div class="card-value">${m.emailsSent}</div></div>
    <div class="card"><div class="card-label">Reply Rate</div><div class="card-value">${m.replyRate}%</div></div>
    <div class="card"><div class="card-label">New Prospects</div><div class="card-value">${m.newProspects}</div></div>
    <div class="card"><div class="card-label">Calls Booked</div><div class="card-value">${m.callsBooked}</div></div>
  </div>
  <div class="section-label">Recruitment Activity</div>
  <div class="row"><span>Candidates Sourced</span><span>${m.candidatesSourced}</span></div>
  <div class="row"><span>Candidates Screened</span><span>${m.candidatesScreened}</span></div>
  <div class="row"><span>Shortlisted</span><span>${m.shortlistedCandidates}</span></div>
  <div class="row"><span>Placements Made</span><span>${m.placementsMade}</span></div>
  <div class="section-label" style="margin-top:20px">Revenue</div>
  <div class="row"><span>Fees Invoiced</span><span>${fmtMoney(m.feesInvoiced)}</span></div>
  <div class="row"><span>Fees Received</span><span>${fmtMoney(m.feesReceived)}</span></div>
  ${r.notes ? `<div class="notes"><strong>Notes:</strong> ${r.notes}</div>` : ""}
</div>
<div class="footer">
  <span>Orchard — Confidential</span>
  <span>W${r.weekNumber} ${r.year}</span>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(reports: WeeklyReport[]) {
  const headers = [
    "Week", "Year", "Start Date", "End Date",
    "Emails Sent", "Reply Rate %", "New Prospects", "Calls Booked",
    "Candidates Sourced", "Candidates Screened", "Shortlisted",
    "Placements Made", "Fees Invoiced (€)", "Fees Received (€)",
  ];
  const rows = reports.map(r => [
    r.weekNumber, r.year, r.startDate.split("T")[0], r.endDate.split("T")[0],
    r.metrics.emailsSent, r.metrics.replyRate, r.metrics.newProspects, r.metrics.callsBooked,
    r.metrics.candidatesSourced, r.metrics.candidatesScreened, r.metrics.shortlistedCandidates,
    r.metrics.placementsMade, r.metrics.feesInvoiced, r.metrics.feesReceived,
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `TNT_Analytics_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Month helpers ─────────────────────────────────────────────────────────────
function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ─── Metric row component ─────────────────────────────────────────────────────
function MetricRow({
  label, value, editable, prefix = "", suffix = "",
  onChange,
}: {
  label: string; value: number; editable?: boolean;
  prefix?: string; suffix?: string;
  onChange?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && onChange) onChange(n);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(45,74,45,0.06)] last:border-0">
      <span className="text-[#6B7280] text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              autoFocus
              type="number"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              className="w-20 bg-white border border-[#2D4A2D] rounded-lg px-2 py-0.5 text-[#2D4A2D] text-sm text-right focus:outline-none"
            />
            <button onClick={commit} className="text-[#4CAF50] hover:text-[#3D9B40]"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="text-[#94a3b8] hover:text-[#2D4A2D]"><XIcon size={13} /></button>
          </>
        ) : (
          <>
            <span className="text-[#2D4A2D] font-semibold text-sm">
              {prefix}{typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}{suffix}
            </span>
            {editable && onChange && (
              <button
                onClick={() => { setDraft(String(value)); setEditing(true); }}
                className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors"
              >
                <Edit3 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Report card ─────────────────────────────────────────────────────────────
function ReportCard({
  report, onUpdate, onDelete,
}: {
  report: WeeklyReport;
  onUpdate: (r: WeeklyReport) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = report.metrics;

  const updateMetric = (key: keyof WeeklyReportMetrics, val: number) => {
    onUpdate({ ...report, metrics: { ...m, [key]: val } });
  };

  const updateNotes = (notes: string) => onUpdate({ ...report, notes });

  return (
    <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAFAF9] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#2D4A2D]/10 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-[#2D4A2D]" />
          </div>
          <div>
            <p className="text-[#2D4A2D] font-semibold text-sm">Week {report.weekNumber}, {report.year}</p>
            <p className="text-[#6B7280] text-xs mt-0.5">{fmtDate(report.startDate)} – {fmtDate(report.endDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 mr-2">
          <div className="text-right hidden sm:block">
            <p className="text-[#94a3b8] text-xs">Emails</p>
            <p className="text-[#2D4A2D] text-sm font-semibold">{m.emailsSent}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[#94a3b8] text-xs">Placements</p>
            <p className="text-[#2D4A2D] text-sm font-semibold">{m.placementsMade}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[#94a3b8] text-xs">Revenue</p>
            <p className="text-[#4CAF50] text-sm font-semibold">{fmtMoney(m.feesReceived)}</p>
          </div>
          {expanded
            ? <ChevronUp size={16} className="text-[#94a3b8]" />
            : <ChevronDown size={16} className="text-[#94a3b8]" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[rgba(45,74,45,0.08)] px-5 py-5">
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <p className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-widest mb-3">Outreach</p>
                  <MetricRow label="Emails Sent"  value={m.emailsSent} />
                  <MetricRow label="Reply Rate"   value={m.replyRate}   editable suffix="%" onChange={v => updateMetric("replyRate",   v)} />
                  <MetricRow label="Calls Booked" value={m.callsBooked} editable          onChange={v => updateMetric("callsBooked", v)} />
                </div>
                <div>
                  <p className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-widest mb-3">Recruitment</p>
                  <MetricRow label="New Prospects" value={m.newProspects} />
                  <MetricRow label="Sourced"       value={m.candidatesSourced} />
                  <MetricRow label="Screened"      value={m.candidatesScreened} />
                  <MetricRow label="Shortlisted"   value={m.shortlistedCandidates} />
                  <MetricRow label="Placements"    value={m.placementsMade} />
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-widest mb-3">Revenue</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FAFAF9] rounded-xl border border-[rgba(45,74,45,0.08)] p-3">
                    <p className="text-[#6B7280] text-xs mb-1">Fees Invoiced</p>
                    <p className="text-[#2D4A2D] font-bold text-lg">{fmtMoney(m.feesInvoiced)}</p>
                  </div>
                  <div className="bg-[#FAFAF9] rounded-xl border border-[rgba(45,74,45,0.08)] p-3">
                    <p className="text-[#6B7280] text-xs mb-1">Fees Received</p>
                    <p className="text-[#4CAF50] font-bold text-lg">{fmtMoney(m.feesReceived)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-widest mb-2">Notes</p>
                <textarea
                  value={report.notes}
                  onChange={e => updateNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#94a3b8] focus:outline-none focus:border-[#2D4A2D] transition-colors resize-none"
                  placeholder="Add notes for this week…"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportReportPDF(report)}
                  className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                >
                  <Download size={12} /> Download PDF
                </button>
                <button
                  onClick={() => { if (confirm("Delete this report?")) onDelete(report.id); }}
                  className="flex items-center gap-1.5 text-[#6B7280] hover:text-red-400 px-3 py-1.5 rounded-xl text-xs transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-5">
      <h3 className="text-[#2D4A2D] font-semibold text-sm mb-5">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [reports,    setReports]    = useState<WeeklyReport[]>([]);
  const [autoPrompt, setAutoPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"reports" | "analytics">("reports");
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);

  const loadReports = useCallback(() => {
    db.getWeeklyReports().then(all => {
      setReports([...all].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    });
  }, []);

  useEffect(() => {
    loadReports();
    db.getCandidates().then(setAllCandidates);

    const today = new Date();
    if (today.getDay() === 1) {
      const lastWeekStart = getWeekStart(new Date(today.getTime() - 7 * 86400000));
      db.getWeeklyReports().then(all => {
        const exists = all.some(
          r => r.startDate.startsWith(lastWeekStart.toISOString().split("T")[0])
        );
        if (!exists) setAutoPrompt(true);
      });
    }
  }, [loadReports]);

  const generateReport = (forPreviousWeek = false) => {
    setGenerating(true);
    const ref = forPreviousWeek
      ? new Date(Date.now() - 7 * 86400000)
      : new Date();
    const weekStart = getWeekStart(ref);
    const weekEnd   = getWeekEnd(weekStart);
    const weekNum   = getISOWeek(weekStart);
    const year      = weekStart.getFullYear();

    Promise.all([
      db.getWeeklyReports(),
      db.getCandidateProfiles(),
      db.getClients(),
      db.getCandidates(),
      db.getScreenings(),
      db.getPlacements(),
      db.getSourcingStrategies(),
    ]).then(([existing, profiles, clients, candidates, screenings, placements, strategies]) => {
      const already = existing.find(r => r.weekNumber === weekNum && r.year === year);
      if (already) {
        alert(`A report for W${weekNum} ${year} already exists.`);
        setGenerating(false);
        return;
      }

      const metrics = computeMetrics(
        weekStart, weekEnd,
        profiles, clients, candidates, screenings, placements, strategies,
      );

      const report: WeeklyReport = {
        id: uuidv4(),
        weekNumber: weekNum,
        year,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        metrics,
        notes: "",
        generatedAt: new Date().toISOString(),
      };

      db.saveWeeklyReports([...existing, report]).then(() => {
        loadReports();
        setAutoPrompt(false);
        setGenerating(false);
      });
    });
  };

  const updateReport = (updated: WeeklyReport) => {
    db.getWeeklyReports().then(all => {
      db.saveWeeklyReports(all.map(r => r.id === updated.id ? updated : r)).then(loadReports);
    });
  };

  const deleteReport = (id: string) => {
    db.getWeeklyReports().then(all => {
      db.saveWeeklyReports(all.filter(r => r.id !== id)).then(loadReports);
    });
  };

  // Chart data
  const chartReports = [...reports].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const weeklyData = chartReports.slice(-16).map(r => ({
    name: weekLabel(r),
    emails:     r.metrics.emailsSent,
    replyRate:  r.metrics.replyRate,
    sourced:    r.metrics.candidatesSourced,
    placements: r.metrics.placementsMade,
  }));

  const monthlyMap: Record<string, { invoiced: number; received: number; placements: number }> = {};
  chartReports.forEach(r => {
    const mk = monthKey(r.startDate);
    if (!monthlyMap[mk]) monthlyMap[mk] = { invoiced: 0, received: 0, placements: 0 };
    monthlyMap[mk].invoiced   += r.metrics.feesInvoiced;
    monthlyMap[mk].received   += r.metrics.feesReceived;
    monthlyMap[mk].placements += r.metrics.placementsMade;
  });
  const monthlyData = Object.entries(monthlyMap).slice(-12).map(([mk, v]) => ({
    name: monthLabel(mk),
    invoiced:   Math.round(v.invoiced),
    received:   Math.round(v.received),
    placements: v.placements,
  }));

  const candidates = allCandidates;
  const statusOrder = ["sourced", "screened", "shortlisted", "interviewed", "placed"] as const;
  const funnelData = statusOrder.map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    count: candidates.filter(c => c.status === s).length,
  }));

  const totals = reports.reduce((acc, r) => ({
    emails:     acc.emails     + r.metrics.emailsSent,
    prospects:  acc.prospects  + r.metrics.newProspects,
    sourced:    acc.sourced    + r.metrics.candidatesSourced,
    screened:   acc.screened   + r.metrics.candidatesScreened,
    placements: acc.placements + r.metrics.placementsMade,
    invoiced:   acc.invoiced   + r.metrics.feesInvoiced,
    received:   acc.received   + r.metrics.feesReceived,
  }), { emails: 0, prospects: 0, sourced: 0, screened: 0, placements: 0, invoiced: 0, received: 0 });

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Reports & Analytics</h1>
          <p className="text-[#6B7280] mt-1">Weekly activity reports and performance charts</p>
        </div>
        <div className="flex items-center gap-2">
          {reports.length > 0 && activeTab === "analytics" && (
            <button
              onClick={() => exportCSV(reports)}
              className="flex items-center gap-1.5 bg-white border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D]/30 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <button
            onClick={() => generateReport(false)}
            disabled={generating}
            className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
              : <><Plus size={14} /> Generate This Week</>}
          </button>
        </div>
      </motion.div>

      {/* Auto-prompt banner */}
      <AnimatePresence>
        {autoPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="bg-[#2D4A2D]/8 border border-[rgba(45,74,45,0.2)] rounded-2xl px-5 py-4 mb-6 flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={16} className="text-[#2D4A2D]" />
              <div>
                <p className="text-[#2D4A2D] text-sm font-medium">It's Monday — generate last week's report?</p>
                <p className="text-[#6B7280] text-xs mt-0.5">Auto-detected that last week's report is missing.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateReport(true)}
                disabled={generating}
                className="bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-colors"
              >
                Generate
              </button>
              <button onClick={() => setAutoPrompt(false)} className="text-[#6B7280] hover:text-[#2D4A2D] p-1 rounded-lg hover:bg-[#2D4A2D]/8 transition-colors">
                <XIcon size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 w-fit border border-[rgba(45,74,45,0.12)]">
        {(["reports", "analytics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "bg-[#2D4A2D] text-white shadow-sm"
                : "text-[#6B7280] hover:text-[#2D4A2D]"
            }`}
          >
            {tab === "reports" ? (
              <span className="flex items-center gap-1.5"><FileText size={13} />{tab}</span>
            ) : (
              <span className="flex items-center gap-1.5"><BarChart2 size={13} />{tab}</span>
            )}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-12 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2D4A2D]/8 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={20} className="text-[#2D4A2D]/30" />
              </div>
              <p className="text-[#2D4A2D] font-medium mb-1">No reports yet</p>
              <p className="text-[#6B7280] text-sm">Generate your first weekly report above.</p>
            </motion.div>
          ) : (
            reports.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ReportCard report={r} onUpdate={updateReport} onDelete={deleteReport} />
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {reports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-10 text-center">
              <p className="text-[#6B7280] text-sm">Generate at least one report to see analytics.</p>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Emails",    value: totals.emails,               color: "text-[#2D4A2D]" },
                  { label: "Sourced",          value: totals.sourced,              color: "text-[#2D4A2D]" },
                  { label: "Placements",       value: totals.placements,           color: "text-[#4CAF50]" },
                  { label: "Revenue Received", value: fmtMoney(totals.received),   color: "text-[#4CAF50]" },
                ].map((k, i) => (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-5"
                  >
                    <p className="text-[#6B7280] text-xs mb-2">{k.label}</p>
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ChartCard title="Emails Sent per Week">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weeklyData} style={CHART_STYLE} barCategoryGap="30%">
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(45,74,45,0.04)" }} />
                      <Bar dataKey="emails" fill="#2D4A2D" radius={[4, 4, 0, 0]} name="Emails" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Reply Rate per Week (%)">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weeklyData} style={CHART_STYLE}>
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 10 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Reply Rate"]} />
                      <Line type="monotone" dataKey="replyRate" stroke="#2D4A2D" strokeWidth={2} dot={{ fill: "#2D4A2D", r: 3 }} name="Reply %" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Candidates Sourced per Week">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weeklyData} style={CHART_STYLE} barCategoryGap="30%">
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="sourced" fill="#4CAF50" radius={[4, 4, 0, 0]} name="Sourced" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Placements per Month">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyData} style={CHART_STYLE} barCategoryGap="30%">
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="placements" fill="#2D4A2D" radius={[4, 4, 0, 0]} name="Placements" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Revenue per Month — Invoiced vs Received (€)">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyData} style={CHART_STYLE} barCategoryGap="25%">
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtMoney(Number(v))]} />
                      <Legend wrapperStyle={{ color: "#6B7280", fontSize: 11 }} />
                      <Bar dataKey="invoiced" fill="#2D4A2D" radius={[4, 4, 0, 0]} name="Invoiced" />
                      <Bar dataKey="received" fill="#4CAF50" radius={[4, 4, 0, 0]} name="Received" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Pipeline Funnel (All Time)">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={funnelData} layout="vertical" style={CHART_STYLE}>
                      <XAxis type="number" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#2D4A2D" radius={[0, 4, 4, 0]} name="Candidates" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

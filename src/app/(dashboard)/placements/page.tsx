"use client";

import { useEffect, useState } from "react";
import { Placement } from "@/lib/types";
import { db } from "@/lib/db";
import {
  Trophy, Pencil, X, Check, Euro,
  Clock, FileText, Banknote,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:  { label: "Pending",  bg: "bg-[#94a3b8]/15", text: "text-[#94a3b8]",  dot: "bg-[#94a3b8]"  },
  invoiced: { label: "Invoiced", bg: "bg-[#3b82f6]/15", text: "text-[#3b82f6]",  dot: "bg-[#3b82f6]"  },
  paid:     { label: "Paid",     bg: "bg-[#10b981]/15", text: "text-[#10b981]",  dot: "bg-[#10b981]"  },
};

const FEE_PRESETS = ["18", "20", "22"] as const;

function fmt(n: number) {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Edit modal state ─────────────────────────────────────────────────────────

interface EditForm {
  salary: string;
  feePreset: string;
  customFee: string;
  paymentStatus: Placement["paymentStatus"];
  notes: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [editing, setEditing] = useState<Placement | null>(null);
  const [form, setForm] = useState<EditForm>({
    salary: "", feePreset: "20", customFee: "", paymentStatus: "pending", notes: "",
  });

  useEffect(() => {
    db.getPlacements().then(data =>
      setPlacements(data.sort(
        (a, b) => new Date(b.placementDate).getTime() - new Date(a.placementDate).getTime()
      ))
    );
  }, []);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalPlacements = placements.length;
  const totalInvoiced   = placements
    .filter(p => p.paymentStatus === "invoiced" || p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);
  const totalReceived   = placements
    .filter(p => p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);
  const outstanding     = placements
    .filter(p => p.paymentStatus === "invoiced")
    .reduce((s, p) => s + p.feeAmount, 0);

  // ── Edit helpers ─────────────────────────────────────────────────────────────
  const openEdit = (p: Placement) => {
    const preset = FEE_PRESETS.includes(String(p.feePercentage) as any)
      ? String(p.feePercentage)
      : "custom";
    setForm({
      salary: String(p.grossAnnualSalary),
      feePreset: preset,
      customFee: preset === "custom" ? String(p.feePercentage) : "",
      paymentStatus: p.paymentStatus,
      notes: p.notes,
    });
    setEditing(p);
  };

  const saveEdit = () => {
    if (!editing) return;
    const salary = parseFloat(form.salary) || 0;
    const feePct = form.feePreset === "custom"
      ? parseFloat(form.customFee) || 0
      : parseFloat(form.feePreset);
    const feeAmount = Math.round(salary * (feePct / 100) * 100) / 100;

    const updated = placements.map(p =>
      p.id === editing.id
        ? { ...p, grossAnnualSalary: salary, feePercentage: feePct, feeAmount,
            paymentStatus: form.paymentStatus, notes: form.notes,
            updatedAt: new Date().toISOString() }
        : p
    );
    setPlacements(updated);
    db.savePlacements(updated);
    setEditing(null);
  };

  // Live fee in modal
  const modalSalary = parseFloat(form.salary) || 0;
  const modalFeePct = form.feePreset === "custom"
    ? parseFloat(form.customFee) || 0
    : parseFloat(form.feePreset);
  const modalFee = Math.round(modalSalary * (modalFeePct / 100) * 100) / 100;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (placements.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <Trophy size={22} className="text-[#10b981]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Placements</h1>
            <p className="text-[#94a3b8] text-sm mt-0.5">Track fees and payment status for every confirmed placement</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Trophy size={40} className="text-[#1e3a5f] mb-4" />
          <p className="text-white font-medium mb-1">No placements yet</p>
          <p className="text-[#94a3b8] text-sm">Move a candidate to the "Placed" stage in the Pipeline to record a placement.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Trophy size={22} className="text-[#10b981]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Placements</h1>
          <p className="text-[#94a3b8] text-sm mt-0.5">Track fees and payment status for every confirmed placement</p>
        </div>
      </div>

      {/* ── Totals bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94a3b8] text-xs">Total Placements</span>
            <Trophy size={14} className="text-[#10b981]" />
          </div>
          <p className="text-2xl font-bold text-white">{totalPlacements}</p>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94a3b8] text-xs">Total Invoiced</span>
            <FileText size={14} className="text-[#3b82f6]" />
          </div>
          <p className="text-2xl font-bold text-[#3b82f6]">{fmt(totalInvoiced)}</p>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94a3b8] text-xs">Total Received</span>
            <Banknote size={14} className="text-[#10b981]" />
          </div>
          <p className="text-2xl font-bold text-[#10b981]">{fmt(totalReceived)}</p>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94a3b8] text-xs">Outstanding</span>
            <Clock size={14} className="text-[#f59e0b]" />
          </div>
          <p className="text-2xl font-bold text-[#f59e0b]">{fmt(outstanding)}</p>
        </div>
      </div>

      {/* ── Placements list ─────────────────────────────────────────────────── */}
      <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[#1e3a5f] text-[#4a6fa5] text-xs font-semibold uppercase tracking-wider">
          <span>Candidate</span>
          <span>Vacancy / Company</span>
          <span>Date</span>
          <span>Salary</span>
          <span>Fee</span>
          <span>Status</span>
          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#1e3a5f]">
          {placements.map(p => {
            const sc = STATUS_CONFIG[p.paymentStatus];
            return (
              <div
                key={p.id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-[#0a1628] transition-colors group"
              >
                {/* Candidate */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] text-xs font-bold flex-shrink-0">
                    {p.candidateName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.candidateName}</p>
                    <p className="text-[#94a3b8] text-xs truncate">{p.jobTitle || "—"}</p>
                  </div>
                </div>

                {/* Vacancy / Company */}
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{p.vacancyTitle || "—"}</p>
                  <p className="text-[#94a3b8] text-xs truncate">{p.company || "—"}</p>
                </div>

                {/* Date */}
                <p className="text-[#94a3b8] text-sm">{fmtDate(p.placementDate)}</p>

                {/* Salary */}
                <div>
                  <p className="text-white text-sm font-medium">
                    {p.grossAnnualSalary > 0 ? fmt(p.grossAnnualSalary) : "—"}
                  </p>
                  {p.grossAnnualSalary > 0 && (
                    <p className="text-[#4a6fa5] text-xs">per year</p>
                  )}
                </div>

                {/* Fee */}
                <div>
                  <p className="text-[#10b981] text-sm font-semibold">
                    {p.feeAmount > 0 ? fmt(p.feeAmount) : "—"}
                  </p>
                  {p.feePercentage > 0 && (
                    <p className="text-[#4a6fa5] text-xs">{p.feePercentage}%</p>
                  )}
                </div>

                {/* Status badge */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                  {p.notes && (
                    <p className="text-[#4a6fa5] text-[10px] mt-0.5 truncate max-w-[120px]" title={p.notes}>
                      {p.notes}
                    </p>
                  )}
                </div>

                {/* Edit */}
                <button
                  onClick={() => openEdit(p)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white transition-all"
                  title="Edit placement"
                >
                  <Pencil size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                  <Pencil size={12} className="text-[#10b981]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm leading-none">Edit Placement</h2>
                  <p className="text-[#94a3b8] text-xs mt-0.5">{editing.candidateName} — {editing.vacancyTitle || editing.company}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="text-[#94a3b8] hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              {/* Salary */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Gross Annual Salary (€)</label>
                <input
                  type="number"
                  className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                />
              </div>

              {/* Fee % */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-2">Fee Percentage</label>
                <div className="grid grid-cols-4 gap-2">
                  {[...FEE_PRESETS, "custom"].map(p => (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, feePreset: p }))}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        form.feePreset === p
                          ? "bg-[#7C3AED] text-white"
                          : "bg-[#112244] border border-[#1e3a5f] text-[#94a3b8] hover:border-[#7C3AED] hover:text-white"
                      }`}
                    >
                      {p === "custom" ? "Custom" : `${p}%`}
                    </button>
                  ))}
                </div>
                {form.feePreset === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                      placeholder="e.g. 21.5"
                      value={form.customFee}
                      onChange={e => setForm(f => ({ ...f, customFee: e.target.value }))}
                    />
                    <span className="text-[#94a3b8] text-sm flex-shrink-0">%</span>
                  </div>
                )}
              </div>

              {/* Live fee calculation */}
              <div className={`rounded-lg px-4 py-3 border ${
                modalSalary > 0 ? "bg-[#10b981]/10 border-[#10b981]/30" : "bg-[#112244] border-[#1e3a5f]"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#94a3b8] text-xs mb-0.5">Calculated Fee</p>
                    <p className={`text-xl font-bold ${modalSalary > 0 ? "text-[#10b981]" : "text-[#4a6fa5]"}`}>
                      {modalSalary > 0 ? fmt(modalFee) : "—"}
                    </p>
                  </div>
                  {modalSalary > 0 && (
                    <div className="text-right">
                      <p className="text-[#94a3b8] text-xs">{fmt(modalSalary)}</p>
                      <p className="text-[#94a3b8] text-xs">× {modalFeePct}%</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment status */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-2">Payment Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STATUS_CONFIG) as Placement["paymentStatus"][]).map(s => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setForm(f => ({ ...f, paymentStatus: s }))}
                        className={`py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                          form.paymentStatus === s
                            ? `${sc.bg} ${sc.text} border border-current`
                            : "bg-[#112244] border border-[#1e3a5f] text-[#94a3b8] hover:border-[#7C3AED] hover:text-white"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${form.paymentStatus === s ? sc.dot : "bg-[#94a3b8]"}`} />
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Notes</label>
                <textarea
                  className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
                  rows={2}
                  placeholder="e.g. invoice sent 01-04-2026, payment due 30 days"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-[#1e3a5f] text-[#94a3b8] hover:text-white hover:bg-[#2a4f7a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold transition-colors"
              >
                <Check size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

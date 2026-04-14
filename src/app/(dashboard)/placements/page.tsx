"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Placement } from "@/lib/types";
import { db } from "@/lib/db";
import {
  Trophy, Pencil, X, Check, FileText, Banknote, Clock, Search,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:  { label: "Pending",  bg: "bg-[#F3F4F6]",          text: "text-[#6B7280]",  dot: "bg-[#9CA3AF]"  },
  invoiced: { label: "Invoiced", bg: "bg-[rgba(59,130,246,0.10)]", text: "text-[#3b82f6]",  dot: "bg-[#3b82f6]"  },
  paid:     { label: "Paid",     bg: "bg-[rgba(45,74,45,0.10)]",   text: "text-[#2D4A2D]",  dot: "bg-[#4CAF50]"  },
};

const FEE_PRESETS = ["18", "20", "22"] as const;

type StatusFilter = "all" | Placement["paymentStatus"];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    db.getPlacements().then(data =>
      setPlacements(data.sort(
        (a, b) => new Date(b.placementDate).getTime() - new Date(a.placementDate).getTime()
      ))
    );
  }, []);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalPlacements = placements.length;
  const totalInvoiced = placements
    .filter(p => p.paymentStatus === "invoiced" || p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);
  const totalReceived = placements
    .filter(p => p.paymentStatus === "paid")
    .reduce((s, p) => s + p.feeAmount, 0);
  const avgFee = totalPlacements > 0
    ? Math.round(placements.reduce((s, p) => s + p.feeAmount, 0) / totalPlacements)
    : 0;

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = placements.filter(p => {
    const matchesSearch =
      !search.trim() ||
      p.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      (p.vacancyTitle || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.company || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Placements</h1>
          <p className="text-[#6B7280] text-sm mt-1">Track fees and payment status for every confirmed placement</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(45,74,45,0.08)] flex items-center justify-center mb-4">
            <Trophy size={24} className="text-[rgba(45,74,45,0.30)]" />
          </div>
          <p className="text-[#2D4A2D] font-semibold mb-1">No placements yet</p>
          <p className="text-[#6B7280] text-sm max-w-xs">
            Move a candidate to the "Placed" stage in the Pipeline to record a placement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D4A2D]">Placements</h1>
        <p className="text-[#6B7280] text-sm mt-1">Track fees and payment status for every confirmed placement</p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Placed",
            value: String(totalPlacements),
            icon: <Trophy size={15} className="text-[#2D4A2D]" />,
            valueClass: "text-[#2D4A2D]",
          },
          {
            label: "Total Invoiced",
            value: fmt(totalInvoiced),
            icon: <FileText size={15} className="text-[#3b82f6]" />,
            valueClass: "text-[#3b82f6]",
          },
          {
            label: "Total Paid",
            value: fmt(totalReceived),
            icon: <Banknote size={15} className="text-[#2D4A2D]" />,
            valueClass: "text-[#2D4A2D]",
          },
          {
            label: "Avg Fee",
            value: avgFee > 0 ? fmt(avgFee) : "—",
            icon: <Clock size={15} className="text-[#6B7280]" />,
            valueClass: "text-[#2D4A2D]",
          },
        ].map(stat => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(45,74,45,0.10)" }}
            className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[#6B7280] text-xs font-medium">{stat.label}</span>
              <div className="w-7 h-7 rounded-lg bg-[rgba(45,74,45,0.06)] flex items-center justify-center">
                {stat.icon}
              </div>
            </div>
            <p className={`text-2xl font-bold ${stat.valueClass}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl pl-9 pr-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
            placeholder="Search candidate, vacancy or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 bg-white border border-[rgba(45,74,45,0.12)] rounded-xl p-1">
          {(["all", "pending", "invoiced", "paid"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-[#2D4A2D] text-white"
                  : "text-[#6B7280] hover:text-[#2D4A2D]"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Placements list ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.paymentStatus];
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(45,74,45,0.10)" }}
                whileTap={{ scale: 0.99 }}
                className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl px-5 py-4 group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-sm font-bold flex-shrink-0">
                    {p.candidateName.charAt(0)}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[#2D4A2D] text-sm font-bold truncate">{p.candidateName}</p>
                        <p className="text-[#6B7280] text-xs truncate mt-0.5">
                          {p.vacancyTitle || p.jobTitle || "—"}
                        </p>
                      </div>
                      {/* Fee — prominent */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[#2D4A2D] text-lg font-bold leading-none">
                          {p.feeAmount > 0 ? fmt(p.feeAmount) : "—"}
                        </p>
                        {p.feePercentage > 0 && (
                          <p className="text-[#6B7280] text-xs mt-0.5">{p.feePercentage}% fee</p>
                        )}
                      </div>
                    </div>

                    {/* Second row */}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      {p.company && (
                        <span className="text-[#6B7280] text-xs">{p.company}</span>
                      )}
                      <span className="text-[#9CA3AF] text-xs">·</span>
                      <span className="text-[#9CA3AF] text-xs">{fmtDate(p.placementDate)}</span>
                      {p.grossAnnualSalary > 0 && (
                        <>
                          <span className="text-[#9CA3AF] text-xs">·</span>
                          <span className="text-[#6B7280] text-xs">{fmt(p.grossAnnualSalary)} / yr</span>
                        </>
                      )}
                    </div>

                    {/* Third row: status + edit */}
                    <div className="flex items-center justify-between mt-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {p.notes && (
                          <p className="text-[#9CA3AF] text-xs truncate max-w-[180px]" title={p.notes}>
                            {p.notes}
                          </p>
                        )}
                        <button
                          onClick={() => openEdit(p)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[#6B7280] hover:text-[#2D4A2D] text-xs font-medium bg-[rgba(45,74,45,0.06)] hover:bg-[rgba(45,74,45,0.12)] px-2.5 py-1.5 rounded-lg transition-all"
                          title="Edit placement"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && placements.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[#2D4A2D] font-medium mb-1">No results</p>
            <p className="text-[#6B7280] text-sm">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.08)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center">
                    <Pencil size={13} className="text-[#2D4A2D]" />
                  </div>
                  <div>
                    <h2 className="text-[#2D4A2D] font-semibold text-sm leading-none">Edit Placement</h2>
                    <p className="text-[#6B7280] text-xs mt-0.5">
                      {editing.candidateName} — {editing.vacancyTitle || editing.company}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditing(null)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5 space-y-4">
                {/* Salary */}
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Gross Annual Salary (€)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={form.salary}
                    onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                  />
                </div>

                {/* Fee % */}
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-2">Fee Percentage</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[...FEE_PRESETS, "custom"].map(p => (
                      <button
                        key={p}
                        onClick={() => setForm(f => ({ ...f, feePreset: p }))}
                        className={`py-2 rounded-xl text-sm font-medium transition-all ${
                          form.feePreset === p
                            ? "bg-[#2D4A2D] text-white"
                            : "bg-white border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:border-[#2D4A2D] hover:text-[#2D4A2D]"
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
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        placeholder="e.g. 21.5"
                        value={form.customFee}
                        onChange={e => setForm(f => ({ ...f, customFee: e.target.value }))}
                      />
                      <span className="text-[#6B7280] text-sm flex-shrink-0">%</span>
                    </div>
                  )}
                </div>

                {/* Live fee calculation */}
                <div className={`rounded-xl px-4 py-3 border transition-all ${
                  modalSalary > 0
                    ? "bg-[rgba(45,74,45,0.06)] border-[rgba(45,74,45,0.18)]"
                    : "bg-white border-[rgba(45,74,45,0.10)]"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#6B7280] text-xs mb-0.5">Calculated Fee</p>
                      <p className={`text-xl font-bold ${modalSalary > 0 ? "text-[#2D4A2D]" : "text-[#9CA3AF]"}`}>
                        {modalSalary > 0 ? fmt(modalFee) : "—"}
                      </p>
                    </div>
                    {modalSalary > 0 && (
                      <div className="text-right">
                        <p className="text-[#6B7280] text-xs">{fmt(modalSalary)}</p>
                        <p className="text-[#6B7280] text-xs">× {modalFeePct}%</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment status */}
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-2">Payment Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(STATUS_CONFIG) as Placement["paymentStatus"][]).map(s => {
                      const sc = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => setForm(f => ({ ...f, paymentStatus: s }))}
                          className={`py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                            form.paymentStatus === s
                              ? `${sc.bg} ${sc.text} border border-current`
                              : "bg-white border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:border-[#2D4A2D] hover:text-[#2D4A2D]"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${form.paymentStatus === s ? sc.dot : "bg-[#9CA3AF]"}`} />
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Notes</label>
                  <textarea
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors resize-none"
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
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold transition-colors"
                >
                  <Check size={14} /> Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

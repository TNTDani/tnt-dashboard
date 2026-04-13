"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Candidate, Client, Placement, PipelineStatus, Vacancy, CandidateProfile } from "@/lib/types";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, Briefcase, GitMerge, ListChecks, Trophy } from "lucide-react";
import AddToPipelineModal from "@/components/AddToPipelineModal";

const COLUMNS: { status: PipelineStatus; label: string; color: string; bg: string }[] = [
  { status: "sourced",     label: "Sourced",     color: "text-[#94a3b8]", bg: "bg-[#94a3b830]" },
  { status: "screened",    label: "Screened",    color: "text-[#3b82f6]", bg: "bg-[#3b82f630]" },
  { status: "shortlisted", label: "Shortlisted", color: "text-[#f59e0b]", bg: "bg-[#f59e0b30]" },
  { status: "interviewed", label: "Interviewed", color: "text-[#2D4A2D]", bg: "bg-[#2D4A2D30]" },
  { status: "placed",      label: "Placed",      color: "text-[#4CAF50]", bg: "bg-[#4CAF5030]" },
];

const FEE_PRESETS = ["18", "20", "22"] as const;

export default function PipelinePage() {
  return (
    <Suspense>
      <Pipeline />
    </Suspense>
  );
}

function Pipeline() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stageFilter, setStageFilter] = useState<PipelineStatus | null>(
    (searchParams.get("filter") as PipelineStatus) ?? null
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", currentRole: "", currentCompany: "", skills: "", vacancyId: "" });

  // Smart suggestion state
  const [suggestedProfile, setSuggestedProfile] = useState<CandidateProfile | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  // Placement confirmation modal
  const [placementTarget, setPlacementTarget] = useState<Candidate | null>(null);
  const [placementForm, setPlacementForm] = useState({
    salary: "",
    feePreset: "20" as string,
    customFee: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      db.getCandidates(),
      db.getVacancies(),
      db.getClients(),
      db.getCandidateProfiles(),
    ]).then(([pipelineCandidates, fetchedVacancies, fetchedClients, fetchedProfiles]) => {
      setCandidates(pipelineCandidates);
      setVacancies(fetchedVacancies);
      setClients(fetchedClients);

      const lastId = storage.getLastViewedCandidate();
      if (lastId) {
        const profile = fetchedProfiles.find(p => p.id === lastId);
        if (profile) {
          const alreadyIn = pipelineCandidates.some(c => (c as any).profileId === lastId);
          if (!alreadyIn) {
            setSuggestedProfile(profile);
            setShowSuggestion(true);
          }
        }
      }
    });
  }, []);

  const save = (data: Candidate[]) => {
    setCandidates(data);
    db.saveCandidates(data);
  };

  const moveCandidate = (id: string, status: PipelineStatus) => {
    save(candidates.map(c => c.id === id ? { ...c, status } : c));
  };

  // Intercept moves to "placed" — show confirmation modal instead
  const requestMove = (candidate: Candidate, status: PipelineStatus) => {
    if (status === "placed") {
      // Pre-fill fee % from client agreement
      const vacancy = vacancies.find(v => v.id === candidate.vacancyId);
      const client = vacancy ? clients.find(c => c.companyName === vacancy.company) : null;
      let feePreset = "20";
      if (client?.feeAgreement.type === "custom" && client.feeAgreement.customPercentage) {
        const pct = String(client.feeAgreement.customPercentage);
        feePreset = FEE_PRESETS.includes(pct as any) ? pct : "custom";
      }
      setPlacementForm({
        salary: "",
        feePreset,
        customFee: client?.feeAgreement.customPercentage
          ? String(client.feeAgreement.customPercentage)
          : "",
        notes: "",
      });
      setPlacementTarget(candidate);
    } else {
      moveCandidate(candidate.id, status);
    }
  };

  const confirmPlacement = () => {
    if (!placementTarget) return;
    const salary = parseFloat(placementForm.salary) || 0;
    const feePct = placementForm.feePreset === "custom"
      ? parseFloat(placementForm.customFee) || 0
      : parseFloat(placementForm.feePreset);
    const feeAmount = Math.round(salary * (feePct / 100) * 100) / 100;

    // Move candidate to placed
    moveCandidate(placementTarget.id, "placed");

    // Create placement record
    const vacancy = vacancies.find(v => v.id === placementTarget.vacancyId);
    const placement: Placement = {
      id: uuidv4(),
      candidateId: placementTarget.id,
      profileId: (placementTarget as any).profileId,
      candidateName: placementTarget.firstName,
      jobTitle: placementTarget.currentRole,
      vacancyId: placementTarget.vacancyId,
      vacancyTitle: vacancy?.title ?? "",
      company: vacancy?.company ?? placementTarget.currentCompany ?? "",
      placementDate: new Date().toISOString(),
      grossAnnualSalary: salary,
      feePercentage: feePct,
      feeAmount,
      paymentStatus: "pending",
      notes: placementForm.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.getPlacements().then(existing => db.savePlacements([...existing, placement]));
    setPlacementTarget(null);
  };

  const addCandidate = () => {
    if (!form.firstName.trim()) return;
    const c: Candidate = {
      id: uuidv4(),
      firstName: form.firstName.trim(),
      currentRole: form.currentRole,
      currentCompany: form.currentCompany,
      skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      status: "sourced",
      vacancyId: form.vacancyId || undefined,
      createdAt: new Date().toISOString(),
    };
    save([...candidates, c]);
    setForm({ firstName: "", currentRole: "", currentCompany: "", skills: "", vacancyId: "" });
    setShowAdd(false);
  };

  const removeCandidate = (id: string) => save(candidates.filter(c => c.id !== id));

  const handleDrop = (e: React.DragEvent, status: PipelineStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("candidateId");
    if (id) {
      const candidate = candidates.find(c => c.id === id);
      if (candidate) requestMove(candidate, status);
    }
    setDragging(null);
  };

  // Live fee calculation for the modal
  const modalSalary = parseFloat(placementForm.salary) || 0;
  const modalFeePct = placementForm.feePreset === "custom"
    ? parseFloat(placementForm.customFee) || 0
    : parseFloat(placementForm.feePreset);
  const modalFeeAmount = Math.round(modalSalary * (modalFeePct / 100) * 100) / 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Candidate Pipeline</h1>
          <p className="text-[#94a3b8] mt-1">{candidates.length} candidates across {COLUMNS.length} stages</p>
        </div>
        <div className="flex items-center gap-3">
          {stageFilter && (
            <button
              onClick={() => setStageFilter(null)}
              className="flex items-center gap-1.5 bg-[#4CAF50]/10 border border-[#4CAF50]/30 text-[#4CAF50] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#4CAF50]/20 transition-colors"
            >
              Showing: {stageFilter} <X size={12} />
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
          >
            <Plus size={16} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Add to Pipeline modal (from suggestion) */}
      {showPipelineModal && suggestedProfile && (
        <AddToPipelineModal
          profile={suggestedProfile}
          vacancies={vacancies}
          onClose={() => setShowPipelineModal(false)}
          onAdded={() => {
            db.getCandidates().then(setCandidates);
            setShowSuggestion(false);
            setShowPipelineModal(false);
          }}
        />
      )}

      {/* Add manual candidate modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-t-xl sm:rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[#2D4A2D] font-semibold">Add Candidate</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-[#2D4A2D]"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {[
                { key: "firstName", label: "First Name *", placeholder: "e.g. Sarah" },
                { key: "currentRole", label: "Current Role", placeholder: "e.g. Senior Software Engineer" },
                { key: "currentCompany", label: "Current Company", placeholder: "e.g. Acme Corp" },
                { key: "skills", label: "Skills (comma separated)", placeholder: "React, Node.js, TypeScript" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">{label}</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Assign to Vacancy</label>
                <select
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                  value={form.vacancyId}
                  onChange={e => setForm(f => ({ ...f, vacancyId: e.target.value }))}
                >
                  <option value="">— No vacancy —</option>
                  {vacancies.filter(v => v.status === "open").map(v => (
                    <option key={v.id} value={v.id}>{v.title} @ {v.company}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={addCandidate} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold py-2.5 rounded-lg transition-all duration-200">Add</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-all duration-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Placement confirmation modal */}
      {placementTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-t-xl sm:rounded-xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#4CAF50]/20 flex items-center justify-center">
                  <Trophy size={13} className="text-[#4CAF50]" />
                </div>
                <div>
                  <h2 className="text-[#2D4A2D] font-semibold text-sm leading-none">Confirm Placement</h2>
                  <p className="text-[#94a3b8] text-xs mt-0.5">
                    {placementTarget.firstName}
                    {placementTarget.vacancyId && vacancies.find(v => v.id === placementTarget.vacancyId)
                      ? ` → ${vacancies.find(v => v.id === placementTarget.vacancyId)!.title}`
                      : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => setPlacementTarget(null)} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
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
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                  placeholder="e.g. 75000"
                  value={placementForm.salary}
                  onChange={e => setPlacementForm(f => ({ ...f, salary: e.target.value }))}
                />
              </div>

              {/* Fee % */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-2">Fee Percentage</label>
                <div className="grid grid-cols-4 gap-2">
                  {[...FEE_PRESETS, "custom"].map(p => (
                    <button
                      key={p}
                      onClick={() => setPlacementForm(f => ({ ...f, feePreset: p }))}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        placementForm.feePreset === p
                          ? "bg-[#2D4A2D] text-white"
                          : "bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:border-[#2D4A2D] hover:text-[#2D4A2D]"
                      }`}
                    >
                      {p === "custom" ? "Custom" : `${p}%`}
                    </button>
                  ))}
                </div>
                {placementForm.feePreset === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      placeholder="e.g. 21.5"
                      value={placementForm.customFee}
                      onChange={e => setPlacementForm(f => ({ ...f, customFee: e.target.value }))}
                    />
                    <span className="text-[#94a3b8] text-sm flex-shrink-0">%</span>
                  </div>
                )}
              </div>

              {/* Live fee calculation */}
              <div className={`rounded-lg px-4 py-3 border ${
                modalSalary > 0
                  ? "bg-[#4CAF50]/10 border-[#4CAF50]/30"
                  : "bg-[#FFFFFF] border-[rgba(45,74,45,0.15)]"
              }`}>
                <p className="text-[#94a3b8] text-xs mb-0.5">Calculated Fee</p>
                <p className={`text-xl font-bold ${modalSalary > 0 ? "text-[#4CAF50]" : "text-[#6B7280]"}`}>
                  {modalSalary > 0
                    ? `€${modalFeeAmount.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : "Enter salary to calculate"}
                </p>
                {modalSalary > 0 && (
                  <p className="text-[#94a3b8] text-xs mt-0.5">
                    €{modalSalary.toLocaleString("nl-NL")} × {modalFeePct}%
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Notes (optional)</label>
                <textarea
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors resize-none"
                  rows={2}
                  placeholder="e.g. start date 01-05-2026, offer confirmed by email"
                  value={placementForm.notes}
                  onChange={e => setPlacementForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setPlacementTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:bg-[#6B7280] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPlacement}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-[#4CAF50] hover:bg-[#0d9e6e] text-white font-semibold transition-colors"
              >
                <Trophy size={14} /> Confirm Placement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart suggestion banner */}
      {showSuggestion && suggestedProfile && (
        <div className="flex items-center gap-4 mb-6 bg-[#FFFFFF] border border-[#2D4A2D]/40 rounded-xl px-5 py-3.5">
          <div className="w-8 h-8 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
            {suggestedProfile.firstName.charAt(0)}{suggestedProfile.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#2D4A2D] text-sm font-medium leading-none mb-0.5">
              Recently viewed: {suggestedProfile.firstName} {suggestedProfile.lastName}
            </p>
            <p className="text-[#94a3b8] text-xs truncate">
              {suggestedProfile.jobTitle || suggestedProfile.branch || "Candidate"} — not yet in the pipeline
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowPipelineModal(true)}
              className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <GitMerge size={12} /> Add to Pipeline
            </button>
            <button
              onClick={() => { setShowSuggestion(false); storage.clearLastViewedCandidate(); }}
              className="text-[#94a3b8] hover:text-[#2D4A2D] p-1 rounded transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.filter(col => !stageFilter || col.status === stageFilter).map((col) => {
          const colCandidates = candidates.filter(c => c.status === col.status);
          return (
            <div
              key={col.status}
              className="flex-shrink-0 w-56"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${col.bg}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.bg} ${col.color}`}>{colCandidates.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[200px]">
                {colCandidates.map((c) => {
                  const vacancy = vacancies.find(v => v.id === c.vacancyId);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("candidateId", c.id); setDragging(c.id); }}
                      onDragEnd={() => setDragging(null)}
                      className={`bg-[#FFFFFF] border rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 group ${
                        dragging === c.id ? "opacity-50 border-[#2D4A2D]" : "border-[rgba(45,74,45,0.15)] hover:border-[#2D4A2D40]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#2D4A2D30] flex items-center justify-center text-[#2D4A2D] text-xs font-bold">
                            {c.firstName.charAt(0)}
                          </div>
                          <span className="text-[#2D4A2D] text-sm font-medium">{c.firstName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {col.status !== "shortlisted" && col.status !== "placed" && (
                            <button
                              onClick={() => moveCandidate(c.id, "shortlisted")}
                              title="Move to Shortlist"
                              className="text-[#f59e0b] hover:text-[#fbbf24] transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <ListChecks size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => removeCandidate(c.id)}
                            className="text-[rgba(45,74,45,0.15)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      {c.currentRole && <p className="text-[#94a3b8] text-xs mb-1 truncate">{c.currentRole}</p>}
                      {c.currentCompany && <p className="text-[#9CA3AF] text-xs truncate">{c.currentCompany}</p>}
                      {vacancy && (
                        <div className="mt-2 pt-2 border-t border-[rgba(45,74,45,0.15)]">
                          <p className="text-[#2D4A2D] text-[10px] flex items-center gap-1 truncate">
                            <Briefcase size={10} />{vacancy.title}
                          </p>
                        </div>
                      )}
                      {c.skills.slice(0, 2).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.skills.slice(0, 2).map((s, i) => (
                            <span key={i} className="text-[#94a3b8] text-[10px] bg-[#FFFFFF] px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                          {c.skills.length > 2 && <span className="text-[#9CA3AF] text-[10px]">+{c.skills.length - 2}</span>}
                        </div>
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-[rgba(45,74,45,0.15)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter(c2 => c2.status !== col.status).map(c2 => (
                          <button
                            key={c2.status}
                            onClick={() => requestMove(c, c2.status)}
                            className={`text-[9px] px-1.5 py-0.5 rounded ${c2.bg} ${c2.color} hover:opacity-80 transition-opacity flex-1 truncate`}
                          >
                            {c2.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

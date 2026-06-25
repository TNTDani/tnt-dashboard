"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { Candidate, Client, PipelineStatus, Vacancy, CandidateProfile, CandidateVacancyMatch } from "@/lib/types";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, Briefcase, GitMerge, ListChecks, ChevronRight } from "lucide-react";
import AddToPipelineModal from "@/components/AddToPipelineModal";

const COLUMNS: { status: PipelineStatus; label: string }[] = [
  { status: "sourced",     label: "Sourced"     },
  { status: "screened",    label: "Screened"    },
  { status: "shortlisted", label: "Shortlisted" },
  { status: "interviewed", label: "Interviewed" },
  { status: "placed",      label: "Placed"      },
];

export default function PipelinePage() {
  return (
    <Suspense>
      <Pipeline />
    </Suspense>
  );
}

function Pipeline() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const agencyId = (session?.user as { agencyId?: string } | undefined)?.agencyId;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [matches, setMatches] = useState<CandidateVacancyMatch[]>([]);
  const [showCongrats, setShowCongrats] = useState(false);
  const [stageFilter, setStageFilter] = useState<PipelineStatus | null>(
    (searchParams.get("filter") as PipelineStatus) ?? null
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStatus | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", currentRole: "", currentCompany: "", skills: "", vacancyId: "" });

  // Smart suggestion state
  const [suggestedProfile, setSuggestedProfile] = useState<CandidateProfile | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  useEffect(() => {
    Promise.all([
      db.getCandidates(),
      db.getVacancies(),
      db.getClients(),
      db.getCandidateProfiles(),
      db.getMatches(),
    ]).then(([pipelineCandidates, fetchedVacancies, fetchedClients, fetchedProfiles, fetchedMatches]) => {
      setCandidates(pipelineCandidates);
      setVacancies(fetchedVacancies);
      setClients(fetchedClients);
      setMatches(fetchedMatches);

      const lastId = agencyId ? storage.getLastViewedCandidate(agencyId) : null;
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

  const requestMove = async (candidate: Candidate, status: PipelineStatus) => {
    if (status !== 'placed') {
      moveCandidate(candidate.id, status);
      return;
    }

    // Move the pipeline card immediately
    moveCandidate(candidate.id, 'placed');

    // Trigger placement via match (requires a profileId + vacancyId)
    const profileId = (candidate as any).profileId as string | undefined;
    const recruiterId = (session?.user as any)?.id as string | undefined;
    if (!profileId || !candidate.vacancyId) return;

    const existingMatch = matches.find(m =>
      m.vacancyId === candidate.vacancyId && m.candidateId === profileId
    );
    const matchToUse: CandidateVacancyMatch = existingMatch ?? {
      id: uuidv4(),
      candidateId: profileId,
      vacancyId: candidate.vacancyId,
      status: 'active' as const,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const prevStatus = existingMatch?.status;
    const updatedMatch: CandidateVacancyMatch = { ...matchToUse, status: 'placed' as const, updatedAt: new Date().toISOString() };

    try {
      const { placementCreated } = await db.saveMatch(updatedMatch, prevStatus, { recruiterId });
      setMatches(prev => {
        const idx = prev.findIndex(m => m.id === updatedMatch.id);
        return idx >= 0 ? prev.map(m => m.id === updatedMatch.id ? updatedMatch : m) : [...prev, updatedMatch];
      });
      if (placementCreated) setShowCongrats(true);
    } catch (e) {
      console.warn('[requestMove] saveMatch failed:', e);
    }
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
      if (candidate) void requestMove(candidate, status);
    }
    setDragging(null);
    setDragOver(null);
  };

  const totalActive = candidates.filter(c => c.status !== "placed").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Pipeline</h1>
          <span className="bg-[rgba(45,74,45,0.08)] text-[#2D4A2D] text-xs font-semibold px-2.5 py-1 rounded-full">
            {totalActive} active
          </span>
        </div>
        <div className="flex items-center gap-3">
          {stageFilter && (
            <button
              onClick={() => setStageFilter(null)}
              className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.08)] border border-[rgba(45,74,45,0.15)] text-[#2D4A2D] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[rgba(45,74,45,0.14)] transition-colors"
            >
              {stageFilter} <X size={12} />
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            <Plus size={15} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Add to Pipeline modal (from suggestion) */}
      {showPipelineModal && suggestedProfile && (
        <AddToPipelineModal
          profile={suggestedProfile}
          vacancies={vacancies}
          agencyId={agencyId}
          onClose={() => setShowPipelineModal(false)}
          onAdded={() => {
            db.getCandidates().then(setCandidates);
            setShowSuggestion(false);
            setShowPipelineModal(false);
          }}
        />
      )}

      {/* Smart suggestion banner */}
      <AnimatePresence>
        {showSuggestion && suggestedProfile && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-4 mb-5 bg-[rgba(45,74,45,0.06)] border border-[rgba(45,74,45,0.18)] rounded-2xl px-5 py-3.5"
          >
            <div className="w-8 h-8 rounded-full bg-[#2D4A2D]/15 flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
              {suggestedProfile.firstName.charAt(0)}{suggestedProfile.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#2D4A2D] text-sm font-semibold leading-none mb-0.5">
                Recently viewed: {suggestedProfile.firstName} {suggestedProfile.lastName}
              </p>
              <p className="text-[#6B7280] text-xs truncate">
                {suggestedProfile.jobTitle || suggestedProfile.branch || "Candidate"} — not yet in the pipeline
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowPipelineModal(true)}
                className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
              >
                <GitMerge size={12} /> Add to Pipeline
              </button>
              <button
                onClick={() => { setShowSuggestion(false); if (agencyId) storage.clearLastViewedCandidate(agencyId); }}
                className="text-[#6B7280] hover:text-[#2D4A2D] p-1 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.filter(col => !stageFilter || col.status === stageFilter).map((col) => {
          const colCandidates = candidates.filter(c => c.status === col.status);
          const isOver = dragOver === col.status;
          return (
            <div
              key={col.status}
              className="flex-shrink-0 w-60"
              onDragOver={e => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 mb-3">
                <span className="text-[#2D4A2D] text-sm font-semibold">{col.label}</span>
                <span className="bg-[rgba(45,74,45,0.08)] text-[#2D4A2D] text-xs font-semibold px-2 py-0.5 rounded-full">
                  {colCandidates.length}
                </span>
              </div>

              {/* Column drop zone */}
              <div
                className={`min-h-[300px] rounded-2xl p-2 space-y-2 transition-all duration-150 ${
                  isOver
                    ? "bg-[rgba(45,74,45,0.06)] border-2 border-dashed border-[#2D4A2D]"
                    : "bg-[rgba(45,74,45,0.04)] border-2 border-transparent"
                }`}
              >
                <AnimatePresence initial={false}>
                  {colCandidates.map((c) => {
                    const vacancy = vacancies.find(v => v.id === c.vacancyId);
                    const colIndex = COLUMNS.findIndex(col2 => col2.status === col.status);
                    const nextCol = COLUMNS[colIndex + 1];
                    return (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: dragging === c.id ? 0.45 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(45,74,45,0.10)" }}
                        whileTap={{ scale: 0.98 }}
                        draggable
                        onDragStart={(e) => { (e as unknown as React.DragEvent).dataTransfer.setData("candidateId", c.id); setDragging(c.id); }}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        className="bg-white border border-[rgba(45,74,45,0.12)] rounded-xl p-3.5 cursor-grab active:cursor-grabbing group"
                      >
                        {/* Card top row */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
                              {c.firstName.charAt(0)}
                            </div>
                            <span className="text-[#2D4A2D] text-sm font-semibold truncate">{c.firstName}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {col.status !== "shortlisted" && col.status !== "placed" && (
                              <button
                                onClick={() => moveCandidate(c.id, "shortlisted")}
                                title="Move to Shortlist"
                                className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors p-0.5 rounded"
                              >
                                <ListChecks size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => removeCandidate(c.id)}
                              className="text-[#6B7280] hover:text-red-400 transition-colors p-0.5 rounded"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Role / Company */}
                        {c.currentRole && (
                          <p className="text-[#6B7280] text-xs mb-0.5 truncate">{c.currentRole}</p>
                        )}
                        {c.currentCompany && (
                          <p className="text-[#9CA3AF] text-xs truncate">{c.currentCompany}</p>
                        )}

                        {/* Vacancy pill */}
                        {vacancy && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 bg-[rgba(45,74,45,0.08)] text-[#2D4A2D] text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-full">
                              <Briefcase size={9} />
                              {vacancy.title}
                            </span>
                          </div>
                        )}

                        {/* Skills */}
                        {c.skills.slice(0, 2).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.skills.slice(0, 2).map((s, i) => (
                              <span key={i} className="text-[#6B7280] text-[10px] bg-[rgba(45,74,45,0.05)] px-1.5 py-0.5 rounded-md">
                                {s}
                              </span>
                            ))}
                            {c.skills.length > 2 && (
                              <span className="text-[#9CA3AF] text-[10px]">+{c.skills.length - 2}</span>
                            )}
                          </div>
                        )}

                        {/* Move to next stage button */}
                        {nextCol && (
                          <div className="mt-2.5 pt-2.5 border-t border-[rgba(45,74,45,0.08)] opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => void requestMove(c, nextCol.status)}
                              className="w-full flex items-center justify-center gap-1 text-[#2D4A2D] text-[11px] font-medium bg-[rgba(45,74,45,0.06)] hover:bg-[rgba(45,74,45,0.12)] rounded-lg py-1.5 transition-colors"
                            >
                              Move to {nextCol.label} <ChevronRight size={11} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {colCandidates.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-[#9CA3AF] text-xs">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add manual candidate modal */}
      <AnimatePresence>
        {showAdd && (
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
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[#2D4A2D] font-semibold text-base">Add Candidate</h2>
                <button onClick={() => setShowAdd(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { key: "firstName", label: "First Name *", placeholder: "e.g. Sarah" },
                  { key: "currentRole", label: "Current Role", placeholder: "e.g. Senior Software Engineer" },
                  { key: "currentCompany", label: "Current Company", placeholder: "e.g. Acme Corp" },
                  { key: "skills", label: "Skills (comma separated)", placeholder: "React, Node.js, TypeScript" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-[#6B7280] text-xs font-medium block mb-1.5">{label}</label>
                    <input
                      className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[#6B7280] text-xs font-medium block mb-1.5">Assign to Vacancy</label>
                  <select
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
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
                <button
                  onClick={addCandidate}
                  className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D] py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Congratulations popup */}
      <AnimatePresence>
        {showCongrats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCongrats(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260 }}
              className="bg-white rounded-2xl p-8 max-w-xs w-full text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-xl font-bold text-[#2D4A2D] mb-2">Congratulations!</h2>
              <p className="text-[#6B7280] text-sm mb-6">Onto many more!</p>
              <button
                onClick={() => setShowCongrats(false)}
                className="bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold px-8 py-2.5 rounded-xl transition-colors text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

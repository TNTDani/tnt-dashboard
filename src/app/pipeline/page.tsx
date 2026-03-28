"use client";

import { useEffect, useState } from "react";
import { Candidate, Vacancy, PipelineStatus, CandidateProfile } from "@/lib/types";
import { storage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, Briefcase, GitMerge, UserCircle, ListChecks } from "lucide-react";
import AddToPipelineModal from "@/components/AddToPipelineModal";

const COLUMNS: { status: PipelineStatus; label: string; color: string; bg: string }[] = [
  { status: "sourced",     label: "Sourced",     color: "text-[#94a3b8]", bg: "bg-[#94a3b830]" },
  { status: "screened",    label: "Screened",    color: "text-[#3b82f6]", bg: "bg-[#3b82f630]" },
  { status: "shortlisted", label: "Shortlisted", color: "text-[#f59e0b]", bg: "bg-[#f59e0b30]" },
  { status: "interviewed", label: "Interviewed", color: "text-[#7C3AED]", bg: "bg-[#7C3AED30]" },
  { status: "placed",      label: "Placed",      color: "text-[#10b981]", bg: "bg-[#10b98130]" },
];

export default function Pipeline() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", currentRole: "", currentCompany: "", skills: "", vacancyId: "" });

  // Smart suggestion state
  const [suggestedProfile, setSuggestedProfile] = useState<CandidateProfile | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  useEffect(() => {
    const pipelineCandidates = storage.getCandidates();
    setCandidates(pipelineCandidates);
    setVacancies(storage.getVacancies());

    // Check if there's a recently viewed profile not yet in the pipeline
    const lastId = storage.getLastViewedCandidate();
    if (lastId) {
      const profiles = storage.getCandidateProfiles();
      const profile = profiles.find(p => p.id === lastId);
      if (profile) {
        const alreadyIn = pipelineCandidates.some(c => (c as any).profileId === lastId);
        if (!alreadyIn) {
          setSuggestedProfile(profile);
          setShowSuggestion(true);
        }
      }
    }
  }, []);

  const save = (data: Candidate[]) => {
    setCandidates(data);
    storage.saveCandidates(data);
  };

  const moveCandidate = (id: string, status: PipelineStatus) => {
    save(candidates.map(c => c.id === id ? { ...c, status } : c));
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
    if (id) moveCandidate(id, status);
    setDragging(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Candidate Pipeline</h1>
          <p className="text-[#94a3b8] mt-1">{candidates.length} candidates across {COLUMNS.length} stages</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
        >
          <Plus size={16} /> Add Candidate
        </button>
      </div>

      {/* Add to Pipeline modal (from suggestion) */}
      {showPipelineModal && suggestedProfile && (
        <AddToPipelineModal
          profile={suggestedProfile}
          vacancies={vacancies}
          onClose={() => setShowPipelineModal(false)}
          onAdded={() => {
            setCandidates(storage.getCandidates());
            setShowSuggestion(false);
            setShowPipelineModal(false);
          }}
        />
      )}

      {/* Add manual candidate modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Add Candidate</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
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
                    className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Assign to Vacancy</label>
                <select
                  className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
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
              <button onClick={addCandidate} className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-all duration-200">Add</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-[#1e3a5f] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-all duration-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Smart suggestion banner */}
      {showSuggestion && suggestedProfile && (
        <div className="flex items-center gap-4 mb-6 bg-[#0d1f3c] border border-[#7C3AED]/40 rounded-xl px-5 py-3.5">
          <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] text-xs font-bold flex-shrink-0">
            {suggestedProfile.firstName.charAt(0)}{suggestedProfile.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium leading-none mb-0.5">
              Recently viewed: {suggestedProfile.firstName} {suggestedProfile.lastName}
            </p>
            <p className="text-[#94a3b8] text-xs truncate">
              {suggestedProfile.jobTitle || suggestedProfile.branch || 'Candidate'} — not yet in the pipeline
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowPipelineModal(true)}
              className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <GitMerge size={12} /> Add to Pipeline
            </button>
            <button
              onClick={() => { setShowSuggestion(false); storage.clearLastViewedCandidate(); }}
              className="text-[#94a3b8] hover:text-white p-1 rounded transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
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
                      className={`bg-[#0d1f3c] border rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 group ${
                        dragging === c.id ? "opacity-50 border-[#7C3AED]" : "border-[#1e3a5f] hover:border-[#7C3AED40]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#7C3AED30] flex items-center justify-center text-[#7C3AED] text-xs font-bold">
                            {c.firstName.charAt(0)}
                          </div>
                          <span className="text-white text-sm font-medium">{c.firstName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {col.status !== "shortlisted" && (
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
                            className="text-[#1e3a5f] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      {c.currentRole && <p className="text-[#94a3b8] text-xs mb-1 truncate">{c.currentRole}</p>}
                      {c.currentCompany && <p className="text-[#4a6080] text-xs truncate">{c.currentCompany}</p>}
                      {vacancy && (
                        <div className="mt-2 pt-2 border-t border-[#1e3a5f]">
                          <p className="text-[#7C3AED] text-[10px] flex items-center gap-1 truncate">
                            <Briefcase size={10} />{vacancy.title}
                          </p>
                        </div>
                      )}
                      {c.skills.slice(0, 2).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.skills.slice(0, 2).map((s, i) => (
                            <span key={i} className="text-[#94a3b8] text-[10px] bg-[#112244] px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                          {c.skills.length > 2 && <span className="text-[#4a6080] text-[10px]">+{c.skills.length - 2}</span>}
                        </div>
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-[#1e3a5f] opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter(c2 => c2.status !== col.status).map(c2 => (
                          <button
                            key={c2.status}
                            onClick={() => moveCandidate(c.id, c2.status)}
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

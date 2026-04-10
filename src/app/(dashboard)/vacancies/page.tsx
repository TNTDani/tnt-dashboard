"use client";

import { useEffect, useState } from "react";
import { Vacancy, Candidate, CandidateProfile } from "@/lib/types";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  Plus, X, Briefcase, Users, ChevronDown, ChevronUp,
  Sparkles, Loader2, CheckCircle2, AlertCircle, MinusCircle,
  GitPullRequest,
} from "lucide-react";
import type { CandidateMatch } from "@/app/api/match-candidates/route";

const SENIORITY_LEVELS = ["Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];
const STATUS_OPTS: Vacancy["status"][] = ["open", "on-hold", "closed"];
const STATUS_STYLES: Record<string, string> = {
  open: "text-[#10b981] bg-[#10b98120] border-[#10b98140]",
  "on-hold": "text-[#f59e0b] bg-[#f59e0b20] border-[#f59e0b40]",
  closed: "text-[#94a3b8] bg-[#94a3b820] border-[#94a3b840]",
};

const FLAG_CONFIG: Record<CandidateMatch["flag"], { icon: React.ElementType; bar: string; badge: string; label: string }> = {
  green: { icon: CheckCircle2, bar: "bg-[#10b981]", badge: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30", label: "Strong Match" },
  amber: { icon: AlertCircle,  bar: "bg-[#f59e0b]", badge: "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30", label: "Possible Fit"  },
  red:   { icon: MinusCircle,  bar: "bg-[#ef4444]", badge: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30", label: "Poor Fit"      },
};

const EMPTY_FORM = {
  title: "", company: "", salaryMin: "", salaryMax: "", currency: "EUR",
  requirements: "", seniorityLevel: "Senior", description: "", status: "open" as Vacancy["status"],
};

export default function Vacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Matching state
  const [matchingVacancy, setMatchingVacancy] = useState<Vacancy | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [addedToPipeline, setAddedToPipeline] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      db.getVacancies(),
      db.getCandidates(),
      db.getCandidateProfiles(),
    ]).then(([vacancies, candidates, profiles]) => {
      setVacancies(vacancies);
      setCandidates(candidates);
      setProfiles(profiles);
    });
  }, []);

  const save = (data: Vacancy[]) => { setVacancies(data); db.saveVacancies(data); };

  const addVacancy = () => {
    if (!form.title.trim() || !form.company.trim()) return;
    const v: Vacancy = {
      id: uuidv4(),
      title: form.title.trim(),
      company: form.company.trim(),
      salaryMin: parseInt(form.salaryMin) || 0,
      salaryMax: parseInt(form.salaryMax) || 0,
      currency: form.currency,
      requirements: form.requirements.split("\n").map(r => r.trim()).filter(Boolean),
      seniorityLevel: form.seniorityLevel,
      description: form.description.trim(),
      status: form.status,
      createdAt: new Date().toISOString(),
    };
    save([...vacancies, v]);
    setForm(EMPTY_FORM);
    setShowAdd(false);
  };

  const updateStatus = (id: string, status: Vacancy["status"]) => {
    save(vacancies.map(v => v.id === id ? { ...v, status } : v));
  };

  const removeVacancy = (id: string) => save(vacancies.filter(v => v.id !== id));
  const getCandidates = (vacancyId: string) => candidates.filter(c => c.vacancyId === vacancyId);

  // ── Matching ───────────────────────────────────────────────────────────────
  const openMatching = async (vacancy: Vacancy) => {
    if (profiles.length === 0) {
      setMatchError("No candidate profiles found. Add candidates via the Candidates page first.");
      setMatchingVacancy(vacancy);
      setMatches([]);
      return;
    }
    setMatchingVacancy(vacancy);
    setMatches([]);
    setMatchError(null);
    setAddedToPipeline(new Set());
    setMatchLoading(true);

    try {
      const res = await fetch("/api/match-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacancy, candidates: profiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match failed");
      setMatches(data.matches);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Failed to match candidates");
    } finally {
      setMatchLoading(false);
    }
  };

  const addCandidateToPipeline = (match: CandidateMatch, vacancy: Vacancy) => {
    const profile = profiles.find(p => p.id === match.candidateId);
    if (!profile) return;

    db.getCandidates().then(existing => {
      const alreadyIn = existing.some(c => (c as Candidate & { profileId?: string }).profileId === profile.id && c.vacancyId === vacancy.id);
      if (alreadyIn) {
        setAddedToPipeline(prev => new Set([...prev, match.candidateId]));
        return;
      }

      const newCandidate: Candidate & { profileId: string } = {
        id: uuidv4(),
        profileId: profile.id,
        firstName: `${profile.firstName} ${profile.lastName}`,
        currentRole: profile.jobTitle,
        currentCompany: "",
        skills: [],
        status: "sourced",
        vacancyId: vacancy.id,
        createdAt: new Date().toISOString(),
      };

      const updated = [...existing, newCandidate];
      db.saveCandidates(updated);
      setCandidates(updated);
      setAddedToPipeline(prev => new Set([...prev, match.candidateId]));
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Vacancy Manager</h1>
          <p className="text-[#94a3b8] mt-1">{vacancies.filter(v => v.status === "open").length} open roles</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
        >
          <Plus size={16} /> Add Vacancy
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">New Vacancy</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Job Title *</label>
                  <input className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="e.g. Senior Backend Engineer"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Company *</label>
                  <input className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="e.g. Acme Corp"
                    value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Min Salary</label>
                  <input className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="70000" type="number"
                    value={form.salaryMin} onChange={e => setForm(f => ({ ...f, salaryMin: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Max Salary</label>
                  <input className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="95000" type="number"
                    value={form.salaryMax} onChange={e => setForm(f => ({ ...f, salaryMax: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Currency</label>
                  <select className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {["EUR", "GBP", "USD"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Seniority Level</label>
                <select className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                  value={form.seniorityLevel} onChange={e => setForm(f => ({ ...f, seniorityLevel: e.target.value }))}>
                  {SENIORITY_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Requirements (one per line)</label>
                <textarea className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
                  rows={4} placeholder={"5+ years React experience\nNode.js / TypeScript\nAWS experience\nFlexible to work in Amsterdam"}
                  value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} />
              </div>
              <div>
                <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">Description</label>
                <textarea className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
                  rows={3} placeholder="Brief role overview..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={addVacancy} className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-all">Add Vacancy</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-[#1e3a5f] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Vacancy list */}
      {vacancies.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <Briefcase size={40} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-[#94a3b8]">No vacancies yet. Add your first open role.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => {
            const vCandidates = getCandidates(v.id);
            const isExpanded = expanded === v.id;
            return (
              <div key={v.id} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#7C3AED20] flex items-center justify-center">
                      <Briefcase size={18} className="text-[#7C3AED]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{v.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[v.status]}`}>{v.status}</span>
                        <span className="text-[#4a6080] text-xs">{v.seniorityLevel}</span>
                      </div>
                      <p className="text-[#94a3b8] text-sm mt-0.5">{v.company} · {v.currency} {v.salaryMin.toLocaleString()}–{v.salaryMax.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[#94a3b8] text-sm">
                      <Users size={14} />
                      <span>{vCandidates.length}</span>
                    </div>
                    <button
                      onClick={() => openMatching(v)}
                      className="flex items-center gap-1.5 bg-[#7C3AED]/15 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/30 hover:border-[#7C3AED]/60 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      title="Find matching candidates with AI"
                    >
                      <Sparkles size={12} /> Find Matches
                    </button>
                    <select
                      value={v.status}
                      onChange={e => updateStatus(v.id, e.target.value as Vacancy["status"])}
                      className="bg-[#112244] border border-[#1e3a5f] rounded-lg px-2 py-1 text-[#94a3b8] text-xs focus:outline-none focus:border-[#7C3AED] transition-colors"
                    >
                      {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => removeVacancy(v.id)} className="text-[#1e3a5f] hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : v.id)} className="text-[#94a3b8] hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#1e3a5f] p-5 grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">Requirements</p>
                      <ul className="space-y-1">
                        {v.requirements.map((r, i) => (
                          <li key={i} className="text-[#94a3b8] text-sm flex gap-2">
                            <span className="text-[#7C3AED] mt-0.5">·</span>{r}
                          </li>
                        ))}
                      </ul>
                      {v.description && (
                        <div className="mt-3">
                          <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-1">Description</p>
                          <p className="text-[#94a3b8] text-sm">{v.description}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">Assigned Candidates ({vCandidates.length})</p>
                      {vCandidates.length === 0 ? (
                        <p className="text-[#4a6080] text-sm">No candidates assigned yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {vCandidates.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-[#112244] rounded-lg px-3 py-2">
                              <span className="text-white text-sm">{c.firstName}</span>
                              <span className="text-[#94a3b8] text-xs">{c.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Match Drawer ──────────────────────────────────────────────────── */}
      {matchingVacancy && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/50" onClick={() => setMatchingVacancy(null)} />

          {/* Drawer */}
          <div className="w-[480px] bg-[#0d1f3c] border-l border-[#1e3a5f] h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1e3a5f] flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={15} className="text-[#7C3AED]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm leading-tight">AI Candidate Matching</h2>
                  <p className="text-[#94a3b8] text-xs mt-0.5 truncate max-w-[280px]">
                    {matchingVacancy.title} at {matchingVacancy.company}
                  </p>
                </div>
              </div>
              <button onClick={() => setMatchingVacancy(null)} className="text-[#94a3b8] hover:text-white transition-colors flex-shrink-0 mt-0.5">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {matchLoading && (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <Loader2 size={28} className="text-[#7C3AED] animate-spin" />
                  <div className="text-center">
                    <p className="text-white text-sm font-medium">Analysing {profiles.length} candidates...</p>
                    <p className="text-[#94a3b8] text-xs mt-1">Claude is scoring each candidate against the vacancy requirements</p>
                  </div>
                </div>
              )}

              {matchError && !matchLoading && (
                <div className="m-5 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg p-4">
                  <p className="text-[#ef4444] text-sm">{matchError}</p>
                </div>
              )}

              {!matchLoading && !matchError && matches.length === 0 && profiles.length > 0 && (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
                  <Users size={32} className="text-[#1e3a5f]" />
                  <p className="text-[#94a3b8] text-sm">No results yet.</p>
                </div>
              )}

              {!matchLoading && matches.length > 0 && (
                <div className="p-4 space-y-3">
                  {/* Summary bar */}
                  <div className="flex items-center gap-3 mb-4">
                    {(["green", "amber", "red"] as const).map(flag => {
                      const count = matches.filter(m => m.flag === flag).length;
                      const cfg = FLAG_CONFIG[flag];
                      return (
                        <div key={flag} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${cfg.badge}`}>
                          <cfg.icon size={11} />
                          {count} {cfg.label}
                        </div>
                      );
                    })}
                  </div>

                  {matches.map((match) => {
                    const profile = profiles.find(p => p.id === match.candidateId);
                    if (!profile) return null;
                    const cfg = FLAG_CONFIG[match.flag];
                    const isAdded = addedToPipeline.has(match.candidateId);

                    return (
                      <div key={match.candidateId} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl overflow-hidden">
                        {/* Score bar */}
                        <div className="h-1 bg-[#1e3a5f]">
                          <div className={`h-full ${cfg.bar} transition-all`} style={{ width: `${match.score}%` }} />
                        </div>

                        <div className="p-4">
                          {/* Name + score */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] text-xs font-bold flex-shrink-0">
                                {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-medium">{profile.firstName} {profile.lastName}</p>
                                <p className="text-[#94a3b8] text-xs truncate">{profile.jobTitle} · {profile.location}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                {match.score}%
                              </span>
                            </div>
                          </div>

                          {/* Headline */}
                          <p className="text-[#94a3b8] text-xs mb-3 leading-relaxed">{match.headline}</p>

                          {/* Strengths + concerns */}
                          {match.strengths.length > 0 && (
                            <div className="mb-2">
                              {match.strengths.map((s, i) => (
                                <div key={i} className="flex items-start gap-1.5 mb-1">
                                  <span className="text-[#10b981] text-xs mt-0.5 flex-shrink-0">+</span>
                                  <span className="text-[#94a3b8] text-xs">{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {match.concerns.length > 0 && (
                            <div className="mb-3">
                              {match.concerns.map((c, i) => (
                                <div key={i} className="flex items-start gap-1.5 mb-1">
                                  <span className="text-[#f59e0b] text-xs mt-0.5 flex-shrink-0">–</span>
                                  <span className="text-[#94a3b8] text-xs">{c}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add to pipeline */}
                          <button
                            onClick={() => addCandidateToPipeline(match, matchingVacancy)}
                            disabled={isAdded}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                              isAdded
                                ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 cursor-default"
                                : "bg-[#7C3AED]/15 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/30 hover:border-[#7C3AED]/60"
                            }`}
                          >
                            {isAdded ? (
                              <><CheckCircle2 size={12} /> Added to Pipeline</>
                            ) : (
                              <><GitPullRequest size={12} /> Add to Pipeline</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {!matchLoading && matches.length > 0 && (
              <div className="px-5 py-3 border-t border-[#1e3a5f] flex-shrink-0">
                <p className="text-[#4a6fa5] text-[10px] text-center">
                  Scored {matches.length} of {profiles.length} candidates · Powered by Claude
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

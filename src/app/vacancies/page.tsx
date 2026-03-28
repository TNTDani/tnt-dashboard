"use client";

import { useEffect, useState } from "react";
import { Vacancy, Candidate } from "@/lib/types";
import { storage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, Briefcase, Users, ChevronDown, ChevronUp } from "lucide-react";

const SENIORITY_LEVELS = ["Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];
const STATUS_OPTS: Vacancy["status"][] = ["open", "on-hold", "closed"];
const STATUS_STYLES: Record<string, string> = {
  open: "text-[#10b981] bg-[#10b98120] border-[#10b98140]",
  "on-hold": "text-[#f59e0b] bg-[#f59e0b20] border-[#f59e0b40]",
  closed: "text-[#94a3b8] bg-[#94a3b820] border-[#94a3b840]",
};

const EMPTY_FORM = {
  title: "", company: "", salaryMin: "", salaryMax: "", currency: "EUR",
  requirements: "", seniorityLevel: "Senior", description: "", status: "open" as Vacancy["status"],
};

export default function Vacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setVacancies(storage.getVacancies());
    setCandidates(storage.getCandidates());
  }, []);

  const save = (data: Vacancy[]) => { setVacancies(data); storage.saveVacancies(data); };

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
    </div>
  );
}

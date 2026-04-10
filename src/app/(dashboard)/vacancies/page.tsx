"use client";

import { useEffect, useState, useMemo } from "react";
import { Vacancy, Candidate, CandidateProfile, SourcingStrategy, Client } from "@/lib/types";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  Plus, X, Briefcase, Users,
  Sparkles, Loader2, CheckCircle2, AlertCircle, MinusCircle,
  GitPullRequest, Pencil, Trash2, Eye, Search, Filter,
  CalendarDays, Building2, LayoutGrid,
} from "lucide-react";
import type { CandidateMatch } from "@/app/api/match-candidates/route";

// ── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ["Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];
const SENIORITY_FILTER_GROUPS = ["Junior/Medior", "Senior", "Management"];
const STATUS_OPTS: Vacancy["status"][] = ["open", "on-hold", "closed"];

const STATUS_LABEL: Record<Vacancy["status"], string> = {
  open: "Active",
  "on-hold": "Prospected",
  closed: "Filled",
};

const STATUS_STYLES: Record<Vacancy["status"], string> = {
  open:     "text-[#10b981] bg-[#10b98118] border-[#10b98140]",
  "on-hold":"text-[#a78bfa] bg-[#7C3AED18] border-[#7C3AED40]",
  closed:   "text-[#94a3b8] bg-[#94a3b818] border-[#94a3b840]",
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function seniorityGroup(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("junior") || l.includes("mid") || l.includes("medior")) return "Junior/Medior";
  if (l.includes("senior") || l.includes("lead") || l.includes("principal")) return "Senior";
  return "Management";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InputCls(extra = "") {
  return `w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors ${extra}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">{children}</label>;
}

// Reusable vacancy form fields (Add + Edit share the same layout)
function VacancyFormFields({
  form,
  setForm,
  clients,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  clients: Client[];
}) {
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const filteredClients = clients.filter(c =>
    c.companyName.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Job Title *</Label>
          <input className={InputCls()} placeholder="e.g. Senior Backend Engineer"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <Label>Company *</Label>
          <div className="relative">
            <input className={InputCls()} placeholder="e.g. Acme Corp"
              value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              onFocus={() => setShowClientPicker(true)}
              onBlur={() => setTimeout(() => setShowClientPicker(false), 150)}
            />
            {showClientPicker && clients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                <div className="px-2 pt-2 pb-1">
                  <input
                    className="w-full bg-[#112244] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs placeholder-[#4a6080] focus:outline-none"
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    onMouseDown={e => e.preventDefault()}
                  />
                </div>
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => {
                      setForm(f => ({ ...f, company: c.companyName }));
                      setShowClientPicker(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#1e3a5f] transition-colors"
                  >
                    <span className="block">{c.companyName}</span>
                    <span className="text-[#4a6080] text-xs">{c.sector}</span>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="px-3 py-2 text-[#4a6080] text-xs">No clients found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Min Salary</Label>
          <input className={InputCls()} placeholder="70000" type="number"
            value={form.salaryMin} onChange={e => setForm(f => ({ ...f, salaryMin: e.target.value }))} />
        </div>
        <div>
          <Label>Max Salary</Label>
          <input className={InputCls()} placeholder="95000" type="number"
            value={form.salaryMax} onChange={e => setForm(f => ({ ...f, salaryMax: e.target.value }))} />
        </div>
        <div>
          <Label>Currency</Label>
          <select className={InputCls()}
            value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {["EUR", "GBP", "USD"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Seniority Level</Label>
          <select className={InputCls()}
            value={form.seniorityLevel} onChange={e => setForm(f => ({ ...f, seniorityLevel: e.target.value }))}>
            {SENIORITY_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select className={InputCls()}
            value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Vacancy["status"] }))}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label>Required Skills / Requirements (one per line)</Label>
        <textarea className={InputCls("resize-none")} rows={4}
          placeholder={"5+ years React experience\nNode.js / TypeScript\nAWS experience"}
          value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} />
      </div>

      <div>
        <Label>Description</Label>
        <textarea className={InputCls("resize-none")} rows={3}
          placeholder="Brief role overview..."
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Vacancy["status"] }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Vacancy Card ──────────────────────────────────────────────────────────────

function VacancyCard({
  vacancy,
  candidateCount,
  onView,
  onEdit,
  onDelete,
  onMatch,
}: {
  vacancy: Vacancy;
  candidateCount: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatch: () => void;
}) {
  const date = new Date(vacancy.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 flex flex-col gap-4 hover:border-[#2a4a7f] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#7C3AED20] flex items-center justify-center flex-shrink-0">
            <Briefcase size={16} className="text-[#7C3AED]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight truncate">{vacancy.title}</h3>
            <p className="text-[#94a3b8] text-xs mt-0.5 truncate">{vacancy.company}</p>
          </div>
        </div>
        <StatusBadge status={vacancy.status} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[#4a6fa5] text-xs bg-[#112244] px-2 py-1 rounded">{vacancy.seniorityLevel}</span>
        <span className="text-[#94a3b8] text-xs">
          {vacancy.currency} {vacancy.salaryMin.toLocaleString()}–{vacancy.salaryMax.toLocaleString()}
        </span>
        <span className="text-[#4a6080] text-xs flex items-center gap-1">
          <Users size={11} /> {candidateCount}
        </span>
        <span className="text-[#4a6080] text-xs flex items-center gap-1 ml-auto">
          <CalendarDays size={11} /> {date}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-[#1e3a5f]">
        <button
          onClick={onView}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white border border-[#1e3a5f] hover:border-[#2a4a7f] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <Eye size={11} /> View
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white border border-[#1e3a5f] hover:border-[#2a4a7f] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={onMatch}
          className="flex items-center gap-1.5 bg-[#7C3AED]/15 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/30 hover:border-[#7C3AED]/60 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <Sparkles size={11} /> Match
        </button>
        <button
          onClick={onDelete}
          className="ml-auto text-[#1e3a5f] hover:text-red-400 transition-colors p-1.5"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Vacancies() {
  // Data
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [sourcingStrategies, setSourcingStrategies] = useState<SourcingStrategy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // UI
  const [activeTab, setActiveTab] = useState<"all" | "specific">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [viewingVacancy, setViewingVacancy] = useState<Vacancy | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // All Vacancies filters
  const [allStatusFilter, setAllStatusFilter] = useState<Vacancy["status"] | "all">("all");

  // Specific Vacancies filters
  const [specStatus, setSpecStatus] = useState<Vacancy["status"] | "all">("all");
  const [specCompany, setSpecCompany] = useState("");
  const [specSector, setSpecSector] = useState("");
  const [specSeniority, setSpecSeniority] = useState("");
  const [specSalaryMin, setSpecSalaryMin] = useState("");
  const [specSalaryMax, setSpecSalaryMax] = useState("");
  const [specDateOrder, setSpecDateOrder] = useState<"newest" | "oldest">("newest");
  const [specKeyword, setSpecKeyword] = useState("");

  // AI Matching
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
      db.getSourcingStrategies(),
      db.getClients(),
    ]).then(([v, c, p, s, cl]) => {
      setVacancies(v);
      setCandidates(c);
      setProfiles(p);
      setSourcingStrategies(s);
      setClients(cl);
    });
  }, []);

  const save = (data: Vacancy[]) => { setVacancies(data); db.saveVacancies(data); };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    active:     vacancies.filter(v => v.status === "open").length,
    prospected: vacancies.filter(v => v.status === "on-hold").length,
    filled:     vacancies.filter(v => v.status === "closed").length,
  }), [vacancies]);

  // ── Derived filter options ─────────────────────────────────────────────────

  const uniqueCompanies = useMemo(() =>
    [...new Set(vacancies.map(v => v.company))].sort(), [vacancies]);

  const uniqueSectors = useMemo(() =>
    [...new Set(clients.map(c => c.sector).filter(Boolean))].sort(), [clients]);

  // Sector lookup: match vacancy company to a client's sector
  const companySectorMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => { map[c.companyName.toLowerCase()] = c.sector; });
    return map;
  }, [clients]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

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

  const openEdit = (v: Vacancy) => {
    setEditForm({
      title: v.title,
      company: v.company,
      salaryMin: String(v.salaryMin),
      salaryMax: String(v.salaryMax),
      currency: v.currency,
      requirements: v.requirements.join("\n"),
      seniorityLevel: v.seniorityLevel,
      description: v.description,
      status: v.status,
    });
    setEditingVacancy(v);
  };

  const saveEdit = () => {
    if (!editingVacancy || !editForm.title.trim() || !editForm.company.trim()) return;
    const updated: Vacancy = {
      ...editingVacancy,
      title: editForm.title.trim(),
      company: editForm.company.trim(),
      salaryMin: parseInt(editForm.salaryMin) || 0,
      salaryMax: parseInt(editForm.salaryMax) || 0,
      currency: editForm.currency,
      requirements: editForm.requirements.split("\n").map(r => r.trim()).filter(Boolean),
      seniorityLevel: editForm.seniorityLevel,
      description: editForm.description.trim(),
      status: editForm.status,
    };
    save(vacancies.map(v => v.id === editingVacancy.id ? updated : v));
    // Refresh viewing vacancy if it's the same one
    if (viewingVacancy?.id === editingVacancy.id) setViewingVacancy(updated);
    setEditingVacancy(null);
  };

  const removeVacancy = (id: string) => {
    save(vacancies.filter(v => v.id !== id));
    if (viewingVacancy?.id === id) setViewingVacancy(null);
  };

  const getCandidatesForVacancy = (id: string) => candidates.filter(c => c.vacancyId === id);
  const getStrategiesForVacancy = (id: string) => sourcingStrategies.filter(s => s.vacancyId === id);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const allFiltered = useMemo(() => {
    return vacancies.filter(v =>
      allStatusFilter === "all" || v.status === allStatusFilter
    );
  }, [vacancies, allStatusFilter]);

  const specFiltered = useMemo(() => {
    let result = [...vacancies];
    if (specStatus !== "all") result = result.filter(v => v.status === specStatus);
    if (specCompany) result = result.filter(v => v.company.toLowerCase().includes(specCompany.toLowerCase()));
    if (specSector) result = result.filter(v => {
      const sector = companySectorMap[v.company.toLowerCase()];
      return sector?.toLowerCase().includes(specSector.toLowerCase());
    });
    if (specSeniority) result = result.filter(v => seniorityGroup(v.seniorityLevel) === specSeniority);
    if (specSalaryMin) result = result.filter(v => v.salaryMax >= parseInt(specSalaryMin));
    if (specSalaryMax) result = result.filter(v => v.salaryMin <= parseInt(specSalaryMax));
    if (specKeyword) {
      const kw = specKeyword.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(kw) || v.description.toLowerCase().includes(kw)
      );
    }
    result.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return specDateOrder === "newest" ? diff : -diff;
    });
    return result;
  }, [vacancies, specStatus, specCompany, specSector, specSeniority, specSalaryMin, specSalaryMax, specDateOrder, specKeyword, companySectorMap]);

  // ── AI Matching ───────────────────────────────────────────────────────────

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

  // ── Renders ───────────────────────────────────────────────────────────────

  const displayedVacancies = activeTab === "all" ? allFiltered : specFiltered;

  const filterInputCls = "bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vacancy Manager</h1>
          <p className="text-[#94a3b8] mt-1">{stats.active} active · {stats.filled} filled · {stats.prospected} prospected</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
        >
          <Plus size={16} /> Add Vacancy
        </button>
      </div>

      {/* Tab tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${
            activeTab === "all"
              ? "bg-[#7C3AED]/15 border-[#7C3AED]/50 text-white"
              : "bg-[#0d1f3c] border-[#1e3a5f] text-[#94a3b8] hover:border-[#2a4a7f]"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === "all" ? "bg-[#7C3AED]/30" : "bg-[#112244]"}`}>
            <LayoutGrid size={18} className={activeTab === "all" ? "text-[#7C3AED]" : "text-[#4a6fa5]"} />
          </div>
          <div>
            <p className="font-semibold text-sm">All Vacancies</p>
            <p className="text-xs mt-0.5 text-[#4a6fa5]">Browse and filter by status</p>
          </div>
          <span className={`ml-auto text-xl font-bold ${activeTab === "all" ? "text-[#7C3AED]" : "text-[#1e3a5f]"}`}>
            {vacancies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("specific")}
          className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${
            activeTab === "specific"
              ? "bg-[#7C3AED]/15 border-[#7C3AED]/50 text-white"
              : "bg-[#0d1f3c] border-[#1e3a5f] text-[#94a3b8] hover:border-[#2a4a7f]"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === "specific" ? "bg-[#7C3AED]/30" : "bg-[#112244]"}`}>
            <Filter size={18} className={activeTab === "specific" ? "text-[#7C3AED]" : "text-[#4a6fa5]"} />
          </div>
          <div>
            <p className="font-semibold text-sm">Specific Vacancies</p>
            <p className="text-xs mt-0.5 text-[#4a6fa5]">Advanced filters &amp; search</p>
          </div>
          <span className={`ml-auto text-xl font-bold ${activeTab === "specific" ? "text-[#7C3AED]" : "text-[#1e3a5f]"}`}>
            {specFiltered.length}
          </span>
        </button>
      </div>

      {/* ── ALL VACANCIES PANEL ─────────────────────────────────────────────── */}
      {activeTab === "all" && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Active", value: stats.active, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20" },
              { label: "Prospected", value: stats.prospected, color: "text-[#a78bfa]", bg: "bg-[#7C3AED]/10", border: "border-[#7C3AED]/20" },
              { label: "Filled", value: stats.filled, color: "text-[#94a3b8]", bg: "bg-[#94a3b8]/10", border: "border-[#94a3b8]/20" },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className={`${bg} border ${border} rounded-xl px-4 py-3 flex items-center justify-between`}>
                <span className="text-[#94a3b8] text-sm">{label}</span>
                <span className={`${color} text-xl font-bold`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-2 mb-5">
            {(["all", ...STATUS_OPTS] as const).map(s => (
              <button
                key={s}
                onClick={() => setAllStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  allStatusFilter === s
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                    : "border-[#1e3a5f] text-[#94a3b8] hover:text-white hover:border-[#2a4a7f]"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── SPECIFIC VACANCIES PANEL ────────────────────────────────────────── */}
      {activeTab === "specific" && (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={14} className="text-[#7C3AED]" />
            <span className="text-white text-sm font-semibold">Filters</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Status</label>
              <select className={filterInputCls} value={specStatus} onChange={e => setSpecStatus(e.target.value as Vacancy["status"] | "all")}>
                <option value="all">All Statuses</option>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Company</label>
              <div className="relative">
                <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
                <input
                  list="company-suggestions"
                  className={`${filterInputCls} pl-8`}
                  placeholder="Search company..."
                  value={specCompany}
                  onChange={e => setSpecCompany(e.target.value)}
                />
                <datalist id="company-suggestions">
                  {uniqueCompanies.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            {/* Sector */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Branch / Sector</label>
              <select className={filterInputCls} value={specSector} onChange={e => setSpecSector(e.target.value)}>
                <option value="">All Sectors</option>
                {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Seniority */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Seniority</label>
              <select className={filterInputCls} value={specSeniority} onChange={e => setSpecSeniority(e.target.value)}>
                <option value="">All Levels</option>
                {SENIORITY_FILTER_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Salary min */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Min Salary (€)</label>
              <input type="number" className={filterInputCls} placeholder="e.g. 50000"
                value={specSalaryMin} onChange={e => setSpecSalaryMin(e.target.value)} />
            </div>

            {/* Salary max */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Max Salary (€)</label>
              <input type="number" className={filterInputCls} placeholder="e.g. 120000"
                value={specSalaryMax} onChange={e => setSpecSalaryMax(e.target.value)} />
            </div>

            {/* Date order */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Date Posted</label>
              <select className={filterInputCls} value={specDateOrder} onChange={e => setSpecDateOrder(e.target.value as "newest" | "oldest")}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Keyword */}
            <div>
              <label className="text-[#94a3b8] text-xs block mb-1">Keyword Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
                <input
                  className={`${filterInputCls} pl-8`}
                  placeholder="Title or description..."
                  value={specKeyword}
                  onChange={e => setSpecKeyword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Active filter count */}
          {[specStatus !== "all", specCompany, specSector, specSeniority, specSalaryMin, specSalaryMax, specKeyword].filter(Boolean).length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1e3a5f]">
              <span className="text-[#7C3AED] text-xs">
                {specFiltered.length} result{specFiltered.length !== 1 ? "s" : ""} found
              </span>
              <button
                onClick={() => {
                  setSpecStatus("all"); setSpecCompany(""); setSpecSector("");
                  setSpecSeniority(""); setSpecSalaryMin(""); setSpecSalaryMax("");
                  setSpecKeyword(""); setSpecDateOrder("newest");
                }}
                className="text-[#4a6fa5] hover:text-white text-xs transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Vacancy Grid ─────────────────────────────────────────────────────── */}
      {displayedVacancies.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <Briefcase size={40} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-[#94a3b8]">
            {vacancies.length === 0 ? "No vacancies yet. Add your first open role." : "No vacancies match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedVacancies.map(v => (
            <VacancyCard
              key={v.id}
              vacancy={v}
              candidateCount={getCandidatesForVacancy(v.id).length}
              onView={() => setViewingVacancy(v)}
              onEdit={() => openEdit(v)}
              onDelete={() => removeVacancy(v.id)}
              onMatch={() => openMatching(v)}
            />
          ))}
        </div>
      )}

      {/* ── ADD VACANCY MODAL ─────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">New Vacancy</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
            </div>
            <VacancyFormFields form={form} setForm={setForm} clients={clients} />
            <div className="flex gap-3 mt-5">
              <button onClick={addVacancy} className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-all">
                Add Vacancy
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-[#1e3a5f] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT VACANCY MODAL ────────────────────────────────────────────────── */}
      {editingVacancy && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold">Edit Vacancy</h2>
                <p className="text-[#4a6fa5] text-xs mt-0.5">{editingVacancy.title}</p>
              </div>
              <button onClick={() => setEditingVacancy(null)} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
            </div>
            <VacancyFormFields form={editForm} setForm={setEditForm} clients={clients} />
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-all">
                Save Changes
              </button>
              <button onClick={() => setEditingVacancy(null)} className="flex-1 border border-[#1e3a5f] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW VACANCY DETAIL ───────────────────────────────────────────────── */}
      {viewingVacancy && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setViewingVacancy(null)} />
          <div className="w-[520px] bg-[#0d1f3c] border-l border-[#1e3a5f] h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1e3a5f] flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-white font-semibold">{viewingVacancy.title}</h2>
                    <StatusBadge status={viewingVacancy.status} />
                  </div>
                  <p className="text-[#94a3b8] text-sm">{viewingVacancy.company}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setViewingVacancy(null); openEdit(viewingVacancy); }}
                    className="flex items-center gap-1.5 bg-[#112244] hover:bg-[#1e3a5f] text-[#94a3b8] hover:text-white border border-[#1e3a5f] px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button onClick={() => setViewingVacancy(null)} className="text-[#94a3b8] hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[#4a6fa5] text-xs bg-[#112244] px-2 py-1 rounded">{viewingVacancy.seniorityLevel}</span>
                <span className="text-[#94a3b8] text-xs">
                  {viewingVacancy.currency} {viewingVacancy.salaryMin.toLocaleString()}–{viewingVacancy.salaryMax.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Description */}
              {viewingVacancy.description && (
                <div>
                  <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">Description</p>
                  <p className="text-[#94a3b8] text-sm leading-relaxed">{viewingVacancy.description}</p>
                </div>
              )}

              {/* Requirements */}
              {viewingVacancy.requirements.length > 0 && (
                <div>
                  <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">Requirements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingVacancy.requirements.map((r, i) => (
                      <span key={i} className="text-xs bg-[#112244] border border-[#1e3a5f] text-[#94a3b8] px-2 py-1 rounded">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sourcing Strategies */}
              {(() => {
                const strategies = getStrategiesForVacancy(viewingVacancy.id);
                if (strategies.length === 0) return null;
                return (
                  <div>
                    <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">
                      Sourcing {strategies.length > 1 ? `Strategies (${strategies.length})` : "Strategy"}
                    </p>
                    <div className="space-y-2">
                      {strategies.map(s => (
                        <div key={s.id} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white text-sm font-medium">{s.jobTitle}</span>
                            <span className="text-[#4a6080] text-xs">
                              {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {s.skills.slice(0, 5).map((sk, i) => (
                              <span key={i} className="text-[10px] bg-[#7C3AED20] text-[#a78bfa] px-1.5 py-0.5 rounded">{sk}</span>
                            ))}
                            {s.skills.length > 5 && <span className="text-[10px] text-[#4a6080]">+{s.skills.length - 5}</span>}
                          </div>
                          <p className="text-[#4a6080] text-xs">{s.profiles.length} profile type{s.profiles.length !== 1 ? "s" : ""} · {s.seniorityLevel}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Assigned Candidates */}
              {(() => {
                const vCandidates = getCandidatesForVacancy(viewingVacancy.id);
                return (
                  <div>
                    <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">
                      Assigned Candidates ({vCandidates.length})
                    </p>
                    {vCandidates.length === 0 ? (
                      <p className="text-[#4a6080] text-sm">No candidates assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {vCandidates.map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-[#112244] rounded-lg px-3 py-2">
                            <span className="text-white text-sm">{c.firstName}</span>
                            <span className="text-[#94a3b8] text-xs capitalize">{c.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#1e3a5f] flex-shrink-0">
              <button
                onClick={() => openMatching(viewingVacancy)}
                className="w-full flex items-center justify-center gap-2 bg-[#7C3AED]/15 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/30 hover:border-[#7C3AED]/60 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                <Sparkles size={14} /> Find Matching Candidates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI MATCH DRAWER ────────────────────────────────────────────────────── */}
      {matchingVacancy && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/50" onClick={() => setMatchingVacancy(null)} />
          <div className="w-[480px] bg-[#0d1f3c] border-l border-[#1e3a5f] h-full flex flex-col shadow-2xl overflow-hidden">
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

                  {matches.map(match => {
                    const profile = profiles.find(p => p.id === match.candidateId);
                    if (!profile) return null;
                    const cfg = FLAG_CONFIG[match.flag];
                    const isAdded = addedToPipeline.has(match.candidateId);
                    return (
                      <div key={match.candidateId} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl overflow-hidden">
                        <div className="h-1 bg-[#1e3a5f]">
                          <div className={`h-full ${cfg.bar} transition-all`} style={{ width: `${match.score}%` }} />
                        </div>
                        <div className="p-4">
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
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{match.score}%</span>
                          </div>
                          <p className="text-[#94a3b8] text-xs mb-3 leading-relaxed">{match.headline}</p>
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
                          <button
                            onClick={() => addCandidateToPipeline(match, matchingVacancy)}
                            disabled={isAdded}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                              isAdded
                                ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 cursor-default"
                                : "bg-[#7C3AED]/15 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/30 hover:border-[#7C3AED]/60"
                            }`}
                          >
                            {isAdded ? <><CheckCircle2 size={12} /> Added to Pipeline</> : <><GitPullRequest size={12} /> Add to Pipeline</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

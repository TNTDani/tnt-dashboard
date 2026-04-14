"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Vacancy, Candidate, CandidateProfile, SourcingStrategy, Client,
  CandidateVacancyMatch, VacancyStage, ClientFeedback,
} from "@/lib/types";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import {
  Plus, X, Briefcase, Users,
  Sparkles, Loader2, CheckCircle2, AlertCircle, MinusCircle,
  GitPullRequest, Pencil, Trash2, Eye, Search, Filter,
  CalendarDays, Building2, LayoutGrid, ThumbsUp, ThumbsDown,
  Minus, UserCircle, Link as LinkIcon, MapPin,
} from "lucide-react";
import type { CandidateMatch } from "@/app/api/match-candidates/route";
import VacancyStageBar from "@/components/VacancyStageBar";

// ── Constants ─────────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ["Junior", "Mid-level", "Senior", "Lead", "Manager", "Director", "VP", "C-Level"];
const SENIORITY_FILTER_GROUPS = ["Junior/Medior", "Senior", "Management"];
const STATUS_OPTS: Vacancy["status"][] = ["open", "on-hold", "closed"];
const STATUS_LABEL: Record<Vacancy["status"], string> = { open: "Active", "on-hold": "Prospected", closed: "Filled" };
const STATUS_STYLES: Record<Vacancy["status"], string> = {
  open:     "text-[#16a34a] bg-[#dcfce7] border-[#86efac]",
  "on-hold":"text-[#2D4A2D] bg-[#e8f0e8] border-[#a3c4a3]",
  closed:   "text-[#6B7280] bg-[#f3f4f6] border-[#d1d5db]",
};
const MATCH_STATUS_STYLES: Record<CandidateVacancyMatch["status"], string> = {
  active:    "text-[#16a34a] bg-[#dcfce7] border-[#86efac]",
  "on-hold": "text-[#d97706] bg-[#fef3c7] border-[#fcd34d]",
  rejected:  "text-[#dc2626] bg-[#fee2e2] border-[#fca5a5]",
  placed:    "text-[#2D4A2D] bg-[#e8f0e8] border-[#a3c4a3]",
};
const FEEDBACK_STATUS_STYLES: Record<ClientFeedback["status"], string> = {
  pending:   "text-[#6B7280] bg-[#f3f4f6]",
  interview: "text-[#2563eb] bg-[#dbeafe]",
  rejected:  "text-[#dc2626] bg-[#fee2e2]",
  offer:     "text-[#16a34a] bg-[#dcfce7]",
};
const FLAG_CONFIG: Record<CandidateMatch["flag"], { icon: React.ElementType; bar: string; badge: string; label: string }> = {
  green: { icon: CheckCircle2, bar: "bg-[#4CAF50]", badge: "bg-[#dcfce7] text-[#16a34a] border-[#86efac]", label: "Strong Match" },
  amber: { icon: AlertCircle,  bar: "bg-[#f59e0b]", badge: "bg-[#fef3c7] text-[#d97706] border-[#fcd34d]", label: "Possible Fit"  },
  red:   { icon: MinusCircle,  bar: "bg-[#ef4444]", badge: "bg-[#fee2e2] text-[#dc2626] border-[#fca5a5]", label: "Poor Fit"      },
};
const EMPTY_FORM = {
  title: "", company: "", salaryMin: "", salaryMax: "", currency: "EUR",
  requirements: "", seniorityLevel: "Senior", description: "", status: "open" as Vacancy["status"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function seniorityGroup(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("junior") || l.includes("mid") || l.includes("medior")) return "Junior/Medior";
  if (l.includes("senior") || l.includes("lead") || l.includes("principal")) return "Senior";
  return "Management";
}
function InputCls(extra = "") {
  return `w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors ${extra}`;
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[#6B7280] text-xs uppercase tracking-wider font-medium block mb-1.5">{children}</label>;
}

// ── Form Fields ───────────────────────────────────────────────────────────────

function VacancyFormFields({
  form, setForm, clients,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  clients: Client[];
}) {
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const filteredClients = clients.filter(c => c.companyName.toLowerCase().includes(clientSearch.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              onBlur={() => setTimeout(() => setShowClientPicker(false), 150)} />
            {showClientPicker && clients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[rgba(45,74,45,0.15)] rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                <div className="px-2 pt-2 pb-1">
                  <input className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs placeholder-[#9CA3AF] focus:outline-none"
                    placeholder="Search clients..." value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    onMouseDown={e => e.preventDefault()} />
                </div>
                {filteredClients.map(c => (
                  <button key={c.id} type="button" onMouseDown={() => { setForm(f => ({ ...f, company: c.companyName })); setShowClientPicker(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.06)] transition-colors">
                    <span className="block">{c.companyName}</span>
                    <span className="text-[#9CA3AF] text-xs">{c.sector}</span>
                  </button>
                ))}
                {filteredClients.length === 0 && <p className="px-3 py-2 text-[#9CA3AF] text-xs">No clients found</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><Label>Min Salary</Label><input className={InputCls()} placeholder="70000" type="number" value={form.salaryMin} onChange={e => setForm(f => ({ ...f, salaryMin: e.target.value }))} /></div>
        <div><Label>Max Salary</Label><input className={InputCls()} placeholder="95000" type="number" value={form.salaryMax} onChange={e => setForm(f => ({ ...f, salaryMax: e.target.value }))} /></div>
        <div><Label>Currency</Label><select className={InputCls()} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>{["EUR","GBP","USD"].map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Seniority Level</Label><select className={InputCls()} value={form.seniorityLevel} onChange={e => setForm(f => ({ ...f, seniorityLevel: e.target.value }))}>{SENIORITY_LEVELS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div><Label>Status</Label><select className={InputCls()} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Vacancy["status"] }))}>{STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
      </div>
      <div><Label>Required Skills / Requirements (one per line)</Label><textarea className={InputCls("resize-none")} rows={4} placeholder={"5+ years React experience\nNode.js / TypeScript"} value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} /></div>
      <div><Label>Description</Label><textarea className={InputCls("resize-none")} rows={3} placeholder="Brief role overview..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
    </div>
  );
}

function StatusBadge({ status }: { status: Vacancy["status"] }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

// ── Vacancy Card ──────────────────────────────────────────────────────────────

function VacancyCard({ vacancy, candidateCount, matchCount, onView, onEdit, onDelete, onMatch }: {
  vacancy: Vacancy; candidateCount: number; matchCount: number;
  onView: () => void; onEdit: () => void; onDelete: () => void; onMatch: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(vacancy.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const reqPreview = vacancy.requirements.slice(0, 3);

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 12px 24px rgba(45,74,45,0.10)" }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] overflow-hidden flex flex-col relative cursor-pointer"
      onClick={onView}
    >
      {/* Left accent bar */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ originY: 0.5 }}
            className="absolute left-0 top-0 bottom-0 w-1 bg-[#2D4A2D] rounded-l-2xl z-10"
          />
        )}
      </AnimatePresence>

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Top row: title + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[rgba(45,74,45,0.08)] flex items-center justify-center flex-shrink-0">
              <Briefcase size={16} className="text-[#2D4A2D]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[#2D4A2D] font-bold text-sm leading-tight truncate">{vacancy.title}</h3>
              <p className="text-[#6B7280] text-xs mt-0.5 truncate flex items-center gap-1">
                <Building2 size={10} className="flex-shrink-0" />{vacancy.company}
              </p>
            </div>
          </div>
          <StatusBadge status={vacancy.status} />
        </div>

        {/* Stage bar */}
        <VacancyStageBar stage={vacancy.stage ?? "intake"} compact />

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#2D4A2D] text-[11px] font-medium bg-[rgba(45,74,45,0.08)] px-2 py-0.5 rounded-full">
            {vacancy.seniorityLevel}
          </span>
          {(vacancy.salaryMin > 0 || vacancy.salaryMax > 0) && (
            <span className="text-[#6B7280] text-[11px]">
              {vacancy.currency} {vacancy.salaryMin.toLocaleString()}–{vacancy.salaryMax.toLocaleString()}
            </span>
          )}
          <span className="text-[#9CA3AF] text-[11px] flex items-center gap-1">
            <Users size={10} /> {candidateCount}
          </span>
          {matchCount > 0 && (
            <span className="text-[#2D4A2D] text-[11px] flex items-center gap-1">
              <LinkIcon size={10} /> {matchCount} matched
            </span>
          )}
          <span className="text-[#9CA3AF] text-[11px] flex items-center gap-1 ml-auto">
            <CalendarDays size={10} /> {date}
          </span>
        </div>

        {/* Requirements preview */}
        {reqPreview.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reqPreview.map((r, i) => (
              <span key={i} className="text-[10px] text-[#6B7280] bg-[#f9fafb] border border-[rgba(45,74,45,0.08)] px-2 py-0.5 rounded-full truncate max-w-[140px]">{r}</span>
            ))}
            {vacancy.requirements.length > 3 && (
              <span className="text-[10px] text-[#9CA3AF]">+{vacancy.requirements.length - 3}</span>
            )}
          </div>
        )}

        {/* Action buttons — shown on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 pt-2 border-t border-[rgba(45,74,45,0.08)]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={onMatch} className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors">
                <Sparkles size={11} /> AI Match
              </button>
              <button onClick={onEdit} className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] border border-[rgba(45,74,45,0.15)] hover:border-[rgba(45,74,45,0.3)] px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all">
                <Pencil size={11} /> Edit
              </button>
              <a href={`/sourcing?vacancyId=${vacancy.id}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] border border-[rgba(45,74,45,0.15)] hover:border-[rgba(45,74,45,0.3)] px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all">
                <Search size={11} /> Source
              </a>
              <button onClick={onDelete} className="ml-auto text-[rgba(45,74,45,0.2)] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Vacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [sourcingStrategies, setSourcingStrategies] = useState<SourcingStrategy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [matches, setMatches] = useState<CandidateVacancyMatch[]>([]);

  const [activeTab, setActiveTab] = useState<"all" | "specific">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [viewingVacancy, setViewingVacancy] = useState<Vacancy | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // All Vacancies filters
  const [allStatusFilter, setAllStatusFilter] = useState<Vacancy["status"] | "all">("all");
  const [allSearch, setAllSearch] = useState("");
  const [allSeniority, setAllSeniority] = useState("");

  // Specific Vacancies filters
  const [specStatus, setSpecStatus] = useState<Vacancy["status"] | "all">("all");
  const [specCompany, setSpecCompany] = useState("");
  const [specSector, setSpecSector] = useState("");
  const [specSeniority, setSpecSeniority] = useState("");
  const [specSalaryMin, setSpecSalaryMin] = useState("");
  const [specSalaryMax, setSpecSalaryMax] = useState("");
  const [specDateOrder, setSpecDateOrder] = useState<"newest" | "oldest">("newest");
  const [specKeyword, setSpecKeyword] = useState("");

  // Vacancy detail sub-tabs
  const [detailTab, setDetailTab] = useState<"overview" | "matches" | "feedback">("overview");
  const [matchFilter, setMatchFilter] = useState<CandidateVacancyMatch["status"] | "all">("all");
  const [addMatchSearch, setAddMatchSearch] = useState("");
  const [showAddMatch, setShowAddMatch] = useState(false);

  // AI Matching
  const [matchingVacancy, setMatchingVacancy] = useState<Vacancy | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [aiMatches, setAiMatches] = useState<CandidateMatch[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [addedToPipeline, setAddedToPipeline] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      db.getVacancies(), db.getCandidates(), db.getCandidateProfiles(),
      db.getSourcingStrategies(), db.getClients(), db.getMatches(),
    ]).then(([v, c, p, s, cl, m]) => {
      setVacancies(v); setCandidates(c); setProfiles(p);
      setSourcingStrategies(s); setClients(cl); setMatches(m);
    });
  }, []);

  const save = (data: Vacancy[]) => { setVacancies(data); db.saveVacancies(data); };

  const stats = useMemo(() => ({
    active:     vacancies.filter(v => v.status === "open").length,
    prospected: vacancies.filter(v => v.status === "on-hold").length,
    filled:     vacancies.filter(v => v.status === "closed").length,
  }), [vacancies]);

  const uniqueCompanies = useMemo(() => [...new Set(vacancies.map(v => v.company))].sort(), [vacancies]);
  const uniqueSectors = useMemo(() => [...new Set(clients.map(c => c.sector).filter(Boolean))].sort(), [clients]);
  const companySectorMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => { map[c.companyName.toLowerCase()] = c.sector; });
    return map;
  }, [clients]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addVacancy = () => {
    if (!form.title.trim() || !form.company.trim()) return;
    const v: Vacancy = {
      id: uuidv4(), title: form.title.trim(), company: form.company.trim(),
      salaryMin: parseInt(form.salaryMin) || 0, salaryMax: parseInt(form.salaryMax) || 0,
      currency: form.currency,
      requirements: form.requirements.split("\n").map(r => r.trim()).filter(Boolean),
      seniorityLevel: form.seniorityLevel, description: form.description.trim(),
      status: form.status, stage: "intake", stageLog: [], clientFeedback: [],
      createdAt: new Date().toISOString(),
    };
    save([...vacancies, v]);
    setForm(EMPTY_FORM); setShowAdd(false);
  };

  const openEdit = (v: Vacancy) => {
    setEditForm({ title: v.title, company: v.company, salaryMin: String(v.salaryMin),
      salaryMax: String(v.salaryMax), currency: v.currency,
      requirements: v.requirements.join("\n"), seniorityLevel: v.seniorityLevel,
      description: v.description, status: v.status });
    setEditingVacancy(v);
  };

  const saveEdit = () => {
    if (!editingVacancy || !editForm.title.trim() || !editForm.company.trim()) return;
    const updated: Vacancy = { ...editingVacancy, title: editForm.title.trim(),
      company: editForm.company.trim(), salaryMin: parseInt(editForm.salaryMin) || 0,
      salaryMax: parseInt(editForm.salaryMax) || 0, currency: editForm.currency,
      requirements: editForm.requirements.split("\n").map(r => r.trim()).filter(Boolean),
      seniorityLevel: editForm.seniorityLevel, description: editForm.description.trim(),
      status: editForm.status };
    save(vacancies.map(v => v.id === editingVacancy.id ? updated : v));
    if (viewingVacancy?.id === editingVacancy.id) setViewingVacancy(updated);
    setEditingVacancy(null);
  };

  const removeVacancy = (id: string) => {
    save(vacancies.filter(v => v.id !== id));
    if (viewingVacancy?.id === id) setViewingVacancy(null);
  };

  const handleStageChange = (vacancy: Vacancy, newStage: VacancyStage, newLog: typeof vacancy.stageLog) => {
    const updated = { ...vacancy, stage: newStage, stageLog: newLog };
    save(vacancies.map(v => v.id === vacancy.id ? updated : v));
    if (viewingVacancy?.id === vacancy.id) setViewingVacancy(updated);
  };

  // ── Matches ───────────────────────────────────────────────────────────────

  const vacancyMatches = (vacancyId: string) => matches.filter(m => m.vacancyId === vacancyId);

  const addMatch = async (profile: CandidateProfile) => {
    if (!viewingVacancy) return;
    const existing = matches.find(m => m.candidateId === profile.id && m.vacancyId === viewingVacancy.id);
    if (existing) return;
    const m: CandidateVacancyMatch = {
      id: uuidv4(), candidateId: profile.id, vacancyId: viewingVacancy.id,
      status: "active", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await db.saveMatch(m);
    setMatches(prev => [...prev, m]);
    setShowAddMatch(false); setAddMatchSearch("");
  };

  const updateMatch = async (id: string, patch: Partial<CandidateVacancyMatch>) => {
    const existing = matches.find(m => m.id === id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await db.saveMatch(updated);
    setMatches(prev => prev.map(m => m.id === id ? updated : m));
  };

  const removeMatch = async (id: string) => {
    await db.deleteMatch(id);
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  // ── Client feedback ───────────────────────────────────────────────────────

  const updateClientFeedback = (vacancy: Vacancy, updated: ClientFeedback[]) => {
    const v = { ...vacancy, clientFeedback: updated };
    save(vacancies.map(x => x.id === v.id ? v : x));
    if (viewingVacancy?.id === v.id) setViewingVacancy(v);
  };

  // ── AI Matching ───────────────────────────────────────────────────────────

  const openMatching = async (vacancy: Vacancy) => {
    if (profiles.length === 0) {
      setMatchError("No candidate profiles found. Add candidates first.");
      setMatchingVacancy(vacancy); setAiMatches([]); return;
    }
    setMatchingVacancy(vacancy); setAiMatches([]); setMatchError(null);
    setAddedToPipeline(new Set()); setMatchLoading(true);
    try {
      const res = await fetch("/api/match-candidates", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacancy, candidates: profiles }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match failed");
      setAiMatches(data.matches);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Failed to match candidates");
    } finally { setMatchLoading(false); }
  };

  const addCandidateToPipeline = (match: CandidateMatch, vacancy: Vacancy) => {
    const profile = profiles.find(p => p.id === match.candidateId);
    if (!profile) return;
    db.getCandidates().then(existing => {
      const alreadyIn = existing.some(c => (c as Candidate & { profileId?: string }).profileId === profile.id && c.vacancyId === vacancy.id);
      if (alreadyIn) { setAddedToPipeline(prev => new Set([...prev, match.candidateId])); return; }
      const newCandidate: Candidate & { profileId: string } = {
        id: uuidv4(), profileId: profile.id,
        firstName: `${profile.firstName} ${profile.lastName}`, currentRole: profile.jobTitle,
        currentCompany: "", skills: [], status: "sourced", vacancyId: vacancy.id,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing, newCandidate];
      db.saveCandidates(updated); setCandidates(updated);
      setAddedToPipeline(prev => new Set([...prev, match.candidateId]));
    });
  };

  // ── Recent items tracking ─────────────────────────────────────────────────

  const openVacancyDetail = (v: Vacancy) => {
    setViewingVacancy(v);
    setDetailTab("overview");
    storage.addRecentItem({ type: "vacancy", id: v.id, name: v.title, href: "/vacancies", viewedAt: new Date().toISOString() });
    storage.addActivityItem({ type: "vacancy", id: v.id, name: v.title, href: "/vacancies", lastAction: "Viewed", timestamp: new Date().toISOString() });
  };

  // ── Filters ───────────────────────────────────────────────────────────────

  const allFiltered = useMemo(() => {
    let r = vacancies.filter(v => allStatusFilter === "all" || v.status === allStatusFilter);
    if (allSearch) { const q = allSearch.toLowerCase(); r = r.filter(v => v.title.toLowerCase().includes(q) || v.company.toLowerCase().includes(q)); }
    if (allSeniority) r = r.filter(v => seniorityGroup(v.seniorityLevel) === allSeniority);
    return r;
  }, [vacancies, allStatusFilter, allSearch, allSeniority]);

  const specFiltered = useMemo(() => {
    let r = [...vacancies];
    if (specStatus !== "all") r = r.filter(v => v.status === specStatus);
    if (specCompany) r = r.filter(v => v.company.toLowerCase().includes(specCompany.toLowerCase()));
    if (specSector) r = r.filter(v => companySectorMap[v.company.toLowerCase()]?.toLowerCase().includes(specSector.toLowerCase()));
    if (specSeniority) r = r.filter(v => seniorityGroup(v.seniorityLevel) === specSeniority);
    if (specSalaryMin) r = r.filter(v => v.salaryMax >= parseInt(specSalaryMin));
    if (specSalaryMax) r = r.filter(v => v.salaryMin <= parseInt(specSalaryMax));
    if (specKeyword) { const kw = specKeyword.toLowerCase(); r = r.filter(v => v.title.toLowerCase().includes(kw) || v.description.toLowerCase().includes(kw)); }
    r.sort((a, b) => { const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); return specDateOrder === "newest" ? d : -d; });
    return r;
  }, [vacancies, specStatus, specCompany, specSector, specSeniority, specSalaryMin, specSalaryMax, specDateOrder, specKeyword, companySectorMap]);

  const displayedVacancies = activeTab === "all" ? allFiltered : specFiltered;
  const filterInputCls = "bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors";

  const filteredProfilesForMatch = profiles.filter(p => {
    const q = addMatchSearch.toLowerCase();
    if (!q) return true;
    return `${p.firstName} ${p.lastName} ${p.jobTitle}`.toLowerCase().includes(q);
  }).filter(p => !matches.some(m => m.candidateId === p.id && m.vacancyId === viewingVacancy?.id)).slice(0, 8);

  return (
    <div>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Vacancies</h1>
          <span className="bg-[rgba(45,74,45,0.10)] text-[#2D4A2D] text-sm font-semibold px-3 py-0.5 rounded-full">
            {vacancies.length}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#2D4A2D] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#3D6B3D] transition-colors"
        >
          <Plus size={15} /> Add Vacancy
        </button>
      </motion.div>

      {/* ── Tab tiles ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 gap-4 mb-6"
      >
        {[
          { id: "all" as const, label: "All Vacancies", sub: "Browse and filter by status", icon: LayoutGrid, count: vacancies.length },
          { id: "specific" as const, label: "Specific Vacancies", sub: "Advanced filters & search", icon: Filter, count: specFiltered.length },
        ].map(({ id, label, sub, icon: Icon, count }) => (
          <motion.button
            key={id}
            whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(45,74,45,0.08)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left ${
              activeTab === id
                ? "bg-white border-[#2D4A2D] shadow-sm"
                : "bg-white border-[rgba(45,74,45,0.12)] hover:border-[rgba(45,74,45,0.3)]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === id ? "bg-[rgba(45,74,45,0.10)]" : "bg-[#f9fafb]"}`}>
              <Icon size={18} className={activeTab === id ? "text-[#2D4A2D]" : "text-[#6B7280]"} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${activeTab === id ? "text-[#2D4A2D]" : "text-[#374151]"}`}>{label}</p>
              <p className="text-xs mt-0.5 text-[#6B7280]">{sub}</p>
            </div>
            <span className={`ml-auto text-xl font-bold ${activeTab === id ? "text-[#2D4A2D]" : "text-[rgba(45,74,45,0.2)]"}`}>{count}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ── All Vacancies panel ── */}
      <AnimatePresence mode="wait">
        {activeTab === "all" && (
          <motion.div
            key="all-panel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Active", value: stats.active, color: "text-[#16a34a]", bg: "bg-[#dcfce7]", border: "border-[#86efac]" },
                { label: "Prospected", value: stats.prospected, color: "text-[#2D4A2D]", bg: "bg-[#e8f0e8]", border: "border-[#a3c4a3]" },
                { label: "Filled", value: stats.filled, color: "text-[#6B7280]", bg: "bg-[#f3f4f6]", border: "border-[#d1d5db]" },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-2xl px-4 py-3 flex items-center justify-between`}>
                  <span className="text-[#6B7280] text-sm">{label}</span>
                  <span className={`${color} text-xl font-bold`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {/* Search input */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                  placeholder="Search vacancies..."
                  value={allSearch}
                  onChange={e => setAllSearch(e.target.value)}
                />
              </div>
              {/* Status chips */}
              <div className="flex items-center gap-1.5">
                {(["all", ...STATUS_OPTS] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setAllStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      allStatusFilter === s
                        ? "bg-[#2D4A2D] border-[#2D4A2D] text-white"
                        : "bg-white border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)]"
                    }`}
                  >
                    {s === "all" ? "All" : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {/* Seniority filter */}
              <select
                className="bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                value={allSeniority}
                onChange={e => setAllSeniority(e.target.value)}
              >
                <option value="">All Levels</option>
                {SENIORITY_FILTER_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </motion.div>
        )}

        {/* ── Specific Vacancies panel ── */}
        {activeTab === "specific" && (
          <motion.div
            key="specific-panel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-5 mb-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Filter size={14} className="text-[#2D4A2D]" />
              <span className="text-[#2D4A2D] text-sm font-semibold">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="text-[#6B7280] text-xs block mb-1">Status</label>
                <select className={filterInputCls} value={specStatus} onChange={e => setSpecStatus(e.target.value as Vacancy["status"] | "all")}>
                  <option value="all">All Statuses</option>{STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Company</label>
                <div className="relative"><Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input list="company-suggestions" className={`${filterInputCls} pl-8`} placeholder="Search company..." value={specCompany} onChange={e => setSpecCompany(e.target.value)} />
                  <datalist id="company-suggestions">{uniqueCompanies.map(c => <option key={c} value={c} />)}</datalist></div></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Branch / Sector</label>
                <select className={filterInputCls} value={specSector} onChange={e => setSpecSector(e.target.value)}>
                  <option value="">All Sectors</option>{uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Seniority</label>
                <select className={filterInputCls} value={specSeniority} onChange={e => setSpecSeniority(e.target.value)}>
                  <option value="">All Levels</option>{SENIORITY_FILTER_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Min Salary (€)</label><input type="number" className={filterInputCls} placeholder="e.g. 50000" value={specSalaryMin} onChange={e => setSpecSalaryMin(e.target.value)} /></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Max Salary (€)</label><input type="number" className={filterInputCls} placeholder="e.g. 120000" value={specSalaryMax} onChange={e => setSpecSalaryMax(e.target.value)} /></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Date Posted</label>
                <select className={filterInputCls} value={specDateOrder} onChange={e => setSpecDateOrder(e.target.value as "newest" | "oldest")}>
                  <option value="newest">Newest First</option><option value="oldest">Oldest First</option></select></div>
              <div><label className="text-[#6B7280] text-xs block mb-1">Keyword</label>
                <div className="relative"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input className={`${filterInputCls} pl-8`} placeholder="Title or description..." value={specKeyword} onChange={e => setSpecKeyword(e.target.value)} /></div></div>
            </div>
            {[specStatus !== "all", specCompany, specSector, specSeniority, specSalaryMin, specSalaryMax, specKeyword].filter(Boolean).length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[rgba(45,74,45,0.10)]">
                <span className="text-[#2D4A2D] text-xs">{specFiltered.length} result{specFiltered.length !== 1 ? "s" : ""} found</span>
                <button onClick={() => { setSpecStatus("all"); setSpecCompany(""); setSpecSector(""); setSpecSeniority(""); setSpecSalaryMin(""); setSpecSalaryMax(""); setSpecKeyword(""); setSpecDateOrder("newest"); }} className="text-[#6B7280] hover:text-[#2D4A2D] text-xs transition-colors">Clear all filters</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vacancy Grid ── */}
      {displayedVacancies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-16 text-center"
        >
          <Briefcase size={40} className="mx-auto mb-3 text-[rgba(45,74,45,0.15)]" />
          <p className="text-[#6B7280]">
            {vacancies.length === 0 ? "No vacancies yet. Add your first open role." : "No vacancies match your filters."}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {displayedVacancies.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <VacancyCard
                  vacancy={v}
                  candidateCount={candidates.filter(c => c.vacancyId === v.id).length}
                  matchCount={vacancyMatches(v.id).length}
                  onView={() => openVacancyDetail(v)}
                  onEdit={() => openEdit(v)}
                  onDelete={() => removeVacancy(v.id)}
                  onMatch={() => openMatching(v)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── ADD MODAL ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[#2D4A2D] font-bold text-lg">New Vacancy</h2>
                <button onClick={() => setShowAdd(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"><X size={18} /></button>
              </div>
              <VacancyFormFields form={form} setForm={setForm} clients={clients} />
              <div className="flex gap-3 mt-5">
                <button onClick={addVacancy} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold py-2.5 rounded-xl transition-colors">Add Vacancy</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)] py-2.5 rounded-xl transition-all">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT MODAL ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingVacancy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[#2D4A2D] font-bold text-lg">Edit Vacancy</h2>
                  <p className="text-[#6B7280] text-xs mt-0.5">{editingVacancy.title}</p>
                </div>
                <button onClick={() => setEditingVacancy(null)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"><X size={18} /></button>
              </div>
              <VacancyFormFields form={editForm} setForm={setEditForm} clients={clients} />
              <div className="flex gap-3 mt-5">
                <button onClick={saveEdit} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-semibold py-2.5 rounded-xl transition-colors">Save Changes</button>
                <button onClick={() => setEditingVacancy(null)} className="flex-1 border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)] py-2.5 rounded-xl transition-all">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VIEW DETAIL DRAWER ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingVacancy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex"
          >
            <div className="flex-1 bg-black/40" onClick={() => setViewingVacancy(null)} />
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-[580px] bg-white border-l border-[rgba(45,74,45,0.12)] h-full flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-[rgba(45,74,45,0.10)] flex-shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-[#2D4A2D] font-bold">{viewingVacancy.title}</h2>
                      <StatusBadge status={viewingVacancy.status} />
                    </div>
                    <p className="text-[#6B7280] text-sm">{viewingVacancy.company} · {viewingVacancy.seniorityLevel} · {viewingVacancy.currency} {viewingVacancy.salaryMin.toLocaleString()}–{viewingVacancy.salaryMax.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        const url = `/calendar?new=1&type=client-call&vacancyId=${viewingVacancy.id}&vacancyTitle=${encodeURIComponent(viewingVacancy.title)}&clientName=${encodeURIComponent(viewingVacancy.company)}`;
                        window.location.href = url;
                      }}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    >
                      <CalendarDays size={11} /> Schedule Call
                    </button>
                    <button onClick={() => { setViewingVacancy(null); openEdit(viewingVacancy); }} className="flex items-center gap-1.5 bg-white hover:bg-[rgba(45,74,45,0.06)] text-[#6B7280] hover:text-[#2D4A2D] border border-[rgba(45,74,45,0.15)] px-3 py-1.5 rounded-xl text-xs font-medium transition-all"><Pencil size={11} /> Edit</button>
                    <button onClick={() => setViewingVacancy(null)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"><X size={16} /></button>
                  </div>
                </div>
                {/* Stage tracker */}
                <div className="pt-1">
                  <VacancyStageBar
                    stage={viewingVacancy.stage ?? "intake"}
                    stageLog={viewingVacancy.stageLog ?? []}
                    onStageChange={(s, log) => handleStageChange(viewingVacancy, s, log)}
                  />
                </div>
                {/* Sub-tabs */}
                <div className="flex gap-1">
                  {(["overview", "matches", "feedback"] as const).map(t => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${detailTab === t ? "bg-[#2D4A2D] text-white" : "text-[#6B7280] hover:text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.06)]"}`}>
                      {t === "matches" ? `Matches (${vacancyMatches(viewingVacancy.id).length})` : t === "feedback" ? `Client Feedback (${(viewingVacancy.clientFeedback ?? []).length})` : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* ── OVERVIEW TAB ── */}
                {detailTab === "overview" && (
                  <>
                    {viewingVacancy.description && (
                      <div>
                        <p className="text-[#2D4A2D] text-xs font-bold uppercase tracking-wider mb-2">Description</p>
                        <p className="text-[#6B7280] text-sm leading-relaxed">{viewingVacancy.description}</p>
                      </div>
                    )}
                    {viewingVacancy.requirements.length > 0 && (
                      <div>
                        <p className="text-[#2D4A2D] text-xs font-bold uppercase tracking-wider mb-2">Requirements</p>
                        <div className="flex flex-wrap gap-1.5">
                          {viewingVacancy.requirements.map((r, i) => (
                            <span key={i} className="text-xs bg-[#f9fafb] border border-[rgba(45,74,45,0.10)] text-[#6B7280] px-2 py-1 rounded-lg">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {sourcingStrategies.filter(s => s.vacancyId === viewingVacancy.id).length > 0 && (
                      <div>
                        <p className="text-[#2D4A2D] text-xs font-bold uppercase tracking-wider mb-2">Sourcing Strategies</p>
                        {sourcingStrategies.filter(s => s.vacancyId === viewingVacancy.id).map(s => (
                          <div key={s.id} className="bg-[#f9fafb] border border-[rgba(45,74,45,0.10)] rounded-xl p-3 mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[#2D4A2D] text-sm font-medium">{s.jobTitle}</span>
                              <span className="text-[#9CA3AF] text-xs">{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">{s.skills.slice(0, 5).map((sk, i) => <span key={i} className="text-[10px] bg-[rgba(45,74,45,0.08)] text-[#2D4A2D] px-1.5 py-0.5 rounded-full">{sk}</span>)}{s.skills.length > 5 && <span className="text-[10px] text-[#9CA3AF]">+{s.skills.length - 5}</span>}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {candidates.filter(c => c.vacancyId === viewingVacancy.id).length > 0 && (
                      <div>
                        <p className="text-[#2D4A2D] text-xs font-bold uppercase tracking-wider mb-2">Pipeline Candidates</p>
                        {candidates.filter(c => c.vacancyId === viewingVacancy.id).map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-[#f9fafb] rounded-xl px-3 py-2 mb-1">
                            <span className="text-[#2D4A2D] text-sm">{c.firstName}</span>
                            <span className="text-[#6B7280] text-xs capitalize">{c.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── MATCHES TAB ── */}
                {detailTab === "matches" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {(["all", "active", "on-hold", "rejected", "placed"] as const).map(s => (
                          <button key={s} onClick={() => setMatchFilter(s)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all capitalize ${matchFilter === s ? "bg-[#2D4A2D] text-white" : "text-[#6B7280] hover:text-[#2D4A2D] bg-[#f3f4f6]"}`}>
                            {s === "all" ? "All" : s}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowAddMatch(s => !s)} className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.08)] hover:bg-[rgba(45,74,45,0.14)] text-[#2D4A2D] border border-[rgba(45,74,45,0.20)] px-3 py-1.5 rounded-xl text-xs font-medium transition-all">
                        <Plus size={11} /> Add Match
                      </button>
                    </div>

                    {/* Add match search */}
                    <AnimatePresence>
                      {showAddMatch && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="bg-[#f9fafb] border border-[rgba(45,74,45,0.12)] rounded-2xl p-3 overflow-hidden"
                        >
                          <div className="relative mb-2">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                            <input autoFocus className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                              placeholder="Search candidates by name or role..." value={addMatchSearch} onChange={e => setAddMatchSearch(e.target.value)} />
                          </div>
                          {filteredProfilesForMatch.length === 0
                            ? <p className="text-[#9CA3AF] text-xs text-center py-3">{addMatchSearch ? "No candidates found" : "Type to search candidates"}</p>
                            : filteredProfilesForMatch.map(p => (
                              <button key={p.id} onClick={() => addMatch(p)}
                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors text-left">
                                <div className="w-7 h-7 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
                                  {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                                </div>
                                <div><p className="text-[#2D4A2D] text-xs font-medium">{p.firstName} {p.lastName}</p><p className="text-[#9CA3AF] text-[10px]">{p.jobTitle}</p></div>
                                <Plus size={12} className="ml-auto text-[#2D4A2D]" />
                              </button>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Match list */}
                    {vacancyMatches(viewingVacancy.id)
                      .filter(m => matchFilter === "all" || m.status === matchFilter)
                      .map(m => {
                        const profile = profiles.find(p => p.id === m.candidateId);
                        if (!profile) return null;
                        return (
                          <div key={m.id} className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
                                  {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[#2D4A2D] text-sm font-medium">{profile.firstName} {profile.lastName}</p>
                                  <p className="text-[#9CA3AF] text-xs">{profile.jobTitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {m.matchScore && <span className="text-xs font-bold text-[#2D4A2D]">{m.matchScore}%</span>}
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${MATCH_STATUS_STYLES[m.status]}`}>{m.status}</span>
                                <button onClick={() => removeMatch(m.id)} className="text-[rgba(45,74,45,0.2)] hover:text-red-400 transition-colors"><X size={12} /></button>
                              </div>
                            </div>
                            {/* Status + interview controls */}
                            <div className="flex gap-2 mb-2">
                              <select value={m.status} onChange={e => updateMatch(m.id, { status: e.target.value as CandidateVacancyMatch["status"] })}
                                className="bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1 text-[#2D4A2D] text-xs focus:outline-none">
                                {(["active","on-hold","rejected","placed"] as const).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            {/* Interview section */}
                            <div className="border-t border-[rgba(45,74,45,0.08)] pt-3 mt-3 grid grid-cols-2 gap-2">
                              <div><label className="text-[#9CA3AF] text-[10px] block mb-1">Interview Date</label>
                                <input type="date" value={m.interviewDate ?? ""} onChange={e => updateMatch(m.id, { interviewDate: e.target.value })}
                                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none" /></div>
                              <div><label className="text-[#9CA3AF] text-[10px] block mb-1">Interview Type</label>
                                <select value={m.interviewType ?? ""} onChange={e => updateMatch(m.id, { interviewType: e.target.value as CandidateVacancyMatch["interviewType"] })}
                                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none">
                                  <option value="">—</option><option value="teams">Teams</option><option value="on-site">On-site</option><option value="phone">Phone</option>
                                </select></div>
                              <div><label className="text-[#9CA3AF] text-[10px] block mb-1">Outcome</label>
                                <select value={m.interviewOutcome ?? ""} onChange={e => {
                                  const outcome = e.target.value as CandidateVacancyMatch["interviewOutcome"];
                                  updateMatch(m.id, { interviewOutcome: outcome });
                                  if (outcome === "positive" && viewingVacancy.stage !== "offer" && viewingVacancy.stage !== "placed") {
                                    handleStageChange(viewingVacancy, "offer", [...(viewingVacancy.stageLog ?? []), { id: uuidv4(), stage: "offer" as VacancyStage, changedAt: new Date().toISOString(), note: "Auto-advanced: positive interview outcome" }]);
                                  }
                                }}
                                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none">
                                  <option value="">—</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="second-interview">Second Interview</option>
                                </select></div>
                              <div><label className="text-[#9CA3AF] text-[10px] block mb-1">Notes</label>
                                <input value={m.interviewNotes ?? ""} onChange={e => updateMatch(m.id, { interviewNotes: e.target.value })} placeholder="Interview notes..."
                                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none placeholder-[#9CA3AF]" /></div>
                            </div>
                          </div>
                        );
                      })}
                    {vacancyMatches(viewingVacancy.id).filter(m => matchFilter === "all" || m.status === matchFilter).length === 0 && !showAddMatch && (
                      <div className="text-center py-10">
                        <UserCircle size={32} className="mx-auto mb-2 text-[rgba(45,74,45,0.15)]" />
                        <p className="text-[#9CA3AF] text-sm">No matches yet. Click &ldquo;Add Match&rdquo; to link candidates.</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── CLIENT FEEDBACK TAB ── */}
                {detailTab === "feedback" && (
                  <>
                    <p className="text-[#6B7280] text-xs">Track client reactions for each candidate sent to this vacancy.</p>
                    {vacancyMatches(viewingVacancy.id).map(m => {
                      const profile = profiles.find(p => p.id === m.candidateId);
                      if (!profile) return null;
                      const fb = (viewingVacancy.clientFeedback ?? []).find(f => f.candidateId === m.candidateId);

                      const saveFeedback = (patch: Partial<ClientFeedback>) => {
                        const existing = viewingVacancy.clientFeedback ?? [];
                        const now = new Date().toISOString();
                        if (fb) {
                          updateClientFeedback(viewingVacancy, existing.map(f => f.candidateId === m.candidateId ? { ...f, ...patch, updatedAt: now } : f));
                        } else {
                          const newFb: ClientFeedback = {
                            id: uuidv4(), candidateId: m.candidateId,
                            candidateName: `${profile.firstName} ${profile.lastName}`,
                            reaction: null, notes: "", status: "pending", interviewRequested: false,
                            createdAt: now, updatedAt: now, ...patch,
                          };
                          updateClientFeedback(viewingVacancy, [...existing, newFb]);
                        }
                      };

                      return (
                        <div key={m.candidateId} className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-xs font-bold">
                                {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                              </div>
                              <div><p className="text-[#2D4A2D] text-sm font-medium">{profile.firstName} {profile.lastName}</p><p className="text-[#9CA3AF] text-[10px]">{profile.jobTitle}</p></div>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${FEEDBACK_STATUS_STYLES[fb?.status ?? "pending"]}`}>{fb?.status ?? "pending"}</span>
                          </div>
                          {/* Reaction */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[#9CA3AF] text-xs">Reaction:</span>
                            {([
                              { val: "positive" as const, icon: ThumbsUp, color: "text-[#16a34a]", bg: "bg-[#dcfce7] border-[#86efac]" },
                              { val: "maybe" as const, icon: Minus, color: "text-[#d97706]", bg: "bg-[#fef3c7] border-[#fcd34d]" },
                              { val: "negative" as const, icon: ThumbsDown, color: "text-[#dc2626]", bg: "bg-[#fee2e2] border-[#fca5a5]" },
                            ].map(({ val, icon: Icon, color, bg }) => (
                              <button key={val} onClick={() => saveFeedback({ reaction: val })}
                                className={`p-1.5 rounded-xl border transition-all ${fb?.reaction === val ? `${bg} ${color}` : "border-[rgba(45,74,45,0.15)] text-[#9CA3AF] hover:border-[rgba(45,74,45,0.3)]"}`}>
                                <Icon size={13} />
                              </button>
                            )))}
                          </div>
                          {/* Status */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div><label className="text-[#9CA3AF] text-[10px] block mb-1">Status</label>
                              <select value={fb?.status ?? "pending"} onChange={e => saveFeedback({ status: e.target.value as ClientFeedback["status"] })}
                                className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none">
                                <option value="pending">Pending</option><option value="interview">Interview</option><option value="rejected">Rejected</option><option value="offer">Offer</option>
                              </select></div>
                            <div className="flex items-end">
                              <button onClick={() => saveFeedback({ interviewRequested: !fb?.interviewRequested, status: !fb?.interviewRequested ? "interview" : fb.status })}
                                className={`w-full py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${fb?.interviewRequested ? "bg-blue-50 border-blue-200 text-blue-600" : "border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:border-[rgba(45,74,45,0.3)]"}`}>
                                {fb?.interviewRequested ? "✓ Interview Requested" : "Request Interview"}
                              </button>
                            </div>
                          </div>
                          {/* Notes */}
                          <textarea value={fb?.notes ?? ""} onChange={e => saveFeedback({ notes: e.target.value })} placeholder="Client feedback notes..." rows={2}
                            className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-xs placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors" />
                        </div>
                      );
                    })}
                    {vacancyMatches(viewingVacancy.id).length === 0 && (
                      <div className="text-center py-10"><p className="text-[#9CA3AF] text-sm">Add candidates to matches first to track client feedback.</p></div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[rgba(45,74,45,0.10)] flex-shrink-0">
                <button onClick={() => openMatching(viewingVacancy)} className="w-full flex items-center justify-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  <Sparkles size={14} /> Find Matching Candidates with AI
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI MATCH DRAWER ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {matchingVacancy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex"
          >
            <div className="flex-1 bg-black/40" onClick={() => setMatchingVacancy(null)} />
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-[480px] bg-white border-l border-[rgba(45,74,45,0.12)] h-full flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-[rgba(45,74,45,0.10)] flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[rgba(45,74,45,0.08)] flex items-center justify-center">
                    <Sparkles size={15} className="text-[#2D4A2D]" />
                  </div>
                  <div>
                    <h2 className="text-[#2D4A2D] font-bold text-sm">AI Candidate Matching</h2>
                    <p className="text-[#6B7280] text-xs mt-0.5 truncate max-w-[280px]">{matchingVacancy.title} at {matchingVacancy.company}</p>
                  </div>
                </div>
                <button onClick={() => setMatchingVacancy(null)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors mt-0.5"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {matchLoading && (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 size={28} className="text-[#2D4A2D] animate-spin" />
                    <div className="text-center">
                      <p className="text-[#2D4A2D] text-sm font-medium">Analysing {profiles.length} candidates...</p>
                      <p className="text-[#6B7280] text-xs mt-1">Scoring against vacancy requirements</p>
                    </div>
                  </div>
                )}
                {matchError && !matchLoading && (
                  <div className="m-5 bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-red-600 text-sm">{matchError}</p>
                  </div>
                )}
                {!matchLoading && aiMatches.length > 0 && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      {(["green","amber","red"] as const).map(flag => {
                        const count = aiMatches.filter(m => m.flag === flag).length;
                        const cfg = FLAG_CONFIG[flag];
                        return (
                          <div key={flag} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium ${cfg.badge}`}>
                            <cfg.icon size={11} />{count} {cfg.label}
                          </div>
                        );
                      })}
                    </div>
                    {aiMatches.map(match => {
                      const profile = profiles.find(p => p.id === match.candidateId);
                      if (!profile) return null;
                      const cfg = FLAG_CONFIG[match.flag];
                      const isAdded = addedToPipeline.has(match.candidateId);
                      return (
                        <motion.div
                          key={match.candidateId}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl overflow-hidden"
                        >
                          <div className="h-1 bg-[#f3f4f6]">
                            <div className={`h-full ${cfg.bar} transition-all`} style={{ width: `${match.score}%` }} />
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[rgba(45,74,45,0.10)] flex items-center justify-center text-[#2D4A2D] text-xs font-bold">
                                  {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[#2D4A2D] text-sm font-bold">{profile.firstName} {profile.lastName}</p>
                                  <p className="text-[#6B7280] text-xs">{profile.jobTitle} · {profile.location}</p>
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{match.score}%</span>
                            </div>
                            <p className="text-[#6B7280] text-xs mb-3">{match.headline}</p>
                            {match.strengths.map((s, i) => (
                              <div key={i} className="flex gap-1.5 mb-1">
                                <span className="text-[#16a34a] text-xs font-bold">+</span>
                                <span className="text-[#6B7280] text-xs">{s}</span>
                              </div>
                            ))}
                            {match.concerns.map((c, i) => (
                              <div key={i} className="flex gap-1.5 mb-1">
                                <span className="text-[#d97706] text-xs font-bold">–</span>
                                <span className="text-[#6B7280] text-xs">{c}</span>
                              </div>
                            ))}
                            <button
                              onClick={() => addCandidateToPipeline(match, matchingVacancy)}
                              disabled={isAdded}
                              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold mt-2 transition-all ${
                                isAdded
                                  ? "bg-[#dcfce7] text-[#16a34a] border border-[#86efac] cursor-default"
                                  : "bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white"
                              }`}
                            >
                              {isAdded ? <><CheckCircle2 size={12} /> Added to Pipeline</> : <><GitPullRequest size={12} /> Add to Pipeline</>}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
              {!matchLoading && aiMatches.length > 0 && (
                <div className="px-5 py-3 border-t border-[rgba(45,74,45,0.10)] flex-shrink-0">
                  <p className="text-[#6B7280] text-[10px] text-center">Scored {aiMatches.length} of {profiles.length} candidates · Powered by Claude</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

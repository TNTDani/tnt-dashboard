"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Candidate, CandidateProfile, Vacancy, ScreeningResult, ProcessedCV } from "@/lib/types";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  Zap, Upload, Loader2, AlertCircle, CheckCircle,
  Download, ClipboardCopy, Check, MessageSquare,
  Search, X, UserCircle, ToggleLeft, ToggleRight, UserPlus,
} from "lucide-react";
import {
  generateScreeningReportHTML,
  generateInterviewGuideHTML,
  questionsToPlainText,
} from "@/lib/pdfReports";
import type { InterviewQuestion } from "@/app/api/generate-questions/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLAG_STYLES = {
  green: { bg: "bg-[#4CAF5015]", border: "border-[#4CAF5030]", text: "text-[#4CAF50]", dot: "bg-[#4CAF50]" },
  amber: { bg: "bg-[#f59e0b15]", border: "border-[#f59e0b30]", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]" },
  red:   { bg: "bg-[#ef444415]", border: "border-[#ef444430]", text: "text-[#ef4444]", dot: "bg-[#ef4444]" },
};

function scoreLabel(score: number): string {
  if (score >= 9) return "Strong Match";
  if (score >= 7) return "Good Match";
  if (score >= 5) return "Potential Match";
  return "Weak Match";
}

const CATEGORY_LABELS: Record<string, string> = {
  technical:   "Technical / Role-Specific",
  gap:         "Probing the Gaps",
  behavioural: "Behavioural (STAR)",
  culture:     "Culture Fit",
};

const CATEGORY_STYLES: Record<string, string> = {
  technical:   "bg-purple-50 text-purple-700 border-purple-200",
  gap:         "bg-amber-50 text-amber-700 border-amber-200",
  behavioural: "bg-green-50 text-green-700 border-green-200",
  culture:     "bg-blue-50 text-blue-700 border-blue-200",
};

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-[#4CAF5015] text-[#4CAF50] border border-[#4CAF5030]",
  passive: "bg-[#f59e0b15] text-[#f59e0b] border border-[#f59e0b30]",
  placed:  "bg-purple-50 text-purple-600 border border-purple-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Screening() {
  // Data
  const [pipelineCandidates, setPipelineCandidates] = useState<Candidate[]>([]);
  const [profiles, setProfiles]     = useState<CandidateProfile[]>([]);
  const [vacancies, setVacancies]   = useState<Vacancy[]>([]);
  const [screenings, setScreenings] = useState<ScreeningResult[]>([]);

  // Mode: existing candidate or new upload
  const [mode, setMode] = useState<"existing" | "upload">("existing");

  // Existing candidate selector
  const [search, setSearch]                   = useState("");
  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<CandidateProfile | null>(null);
  const [loadingProfileCV, setLoadingProfileCV] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Upload mode
  const [uploadedCV, setUploadedCV] = useState<ProcessedCV | null>(null);
  const [uploading, setUploading]   = useState(false);

  // Vacancy + run
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [screening, setScreening]             = useState(false);
  const [result, setResult]                   = useState<ScreeningResult | null>(null);
  const [error, setError]                     = useState("");

  // Interview questions
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);
  const [qError, setQError]       = useState("");
  const [copied, setCopied]       = useState(false);

  // Add to database (after upload screening)
  const [showAddToDb, setShowAddToDb] = useState(false);
  const [addedToDb, setAddedToDb]     = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", jobTitle: "", branch: "",
  });

  useEffect(() => {
    Promise.all([
      db.getCandidates(),
      db.getCandidateProfiles(),
      db.getVacancies(),
      db.getScreenings(),
    ]).then(([candidates, candidateProfiles, fetchedVacancies, fetchedScreenings]) => {
      setPipelineCandidates(candidates);
      setProfiles(candidateProfiles);
      setVacancies(fetchedVacancies);
      setScreenings(fetchedScreenings);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filtered candidate list ─────────────────────────────────────────────────

  const filteredProfiles = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      (p.jobTitle || "").toLowerCase().includes(q) ||
      (p.branch || "").toLowerCase().includes(q)
    );
  });

  // ── Load a profile's CV ─────────────────────────────────────────────────────

  const loadProfileCV = async (profile: CandidateProfile) => {
    setError("");
    setUploadedCV(null);

    // 1. Check if a linked pipeline candidate has a processedCV already
    const linked = pipelineCandidates.find(c => (c as any).profileId === profile.id);
    if (linked?.processedCV) {
      setUploadedCV(linked.processedCV);
      return;
    }

    // 2. If the profile has raw cvData, send it through the processor
    if (profile.cvData && profile.cvFileName) {
      setLoadingProfileCV(true);
      try {
        const byteStr = atob(profile.cvData);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        const mime = profile.cvFileName.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const file = new File([bytes], profile.cvFileName, { type: mime });
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/process-cv", { method: "POST", body: fd });
        const json = await res.json();
        if (res.ok && json.success) {
          setUploadedCV(json.data);
        } else {
          setError("Could not read this candidate's CV. Try uploading it manually.");
        }
      } catch {
        setError("Could not read this candidate's CV. Try uploading it manually.");
      } finally {
        setLoadingProfileCV(false);
      }
      return;
    }

    // 3. No CV data available
    setError("This candidate has no CV on file. Upload their CV on their profile page first.");
  };

  // ── Select a profile from dropdown ─────────────────────────────────────────

  const selectProfile = (profile: CandidateProfile) => {
    setSelectedProfile(profile);
    setSearch(`${profile.firstName} ${profile.lastName}`);
    setDropdownOpen(false);
    loadProfileCV(profile);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setSearch("");
    setUploadedCV(null);
    setError("");
  };

  // ── CV upload (new candidate) ───────────────────────────────────────────────

  const uploadAndProcess = async (file: File) => {
    setUploading(true);
    setError("");
    setUploadedCV(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process-cv", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Processing failed");
      setUploadedCV(json.data);
      // Pre-fill the add-to-db form
      const cv: ProcessedCV = json.data;
      const parts = cv.firstName.trim().split(" ");
      setAddForm({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: "",
        phone: "",
        jobTitle: cv.currentRole || "",
        branch: "",
      });
      setAddedToDb(false);
      setShowAddToDb(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  // ── Get active CV ───────────────────────────────────────────────────────────

  const getCV = (): ProcessedCV | null => uploadedCV;

  // ── Run screening ───────────────────────────────────────────────────────────

  const runScreening = async () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!cv || !vacancy) { setError("Please select both a candidate CV and a vacancy."); return; }

    setScreening(true);
    setError("");
    setResult(null);
    setQuestions(null);
    setShowAddToDb(false);
    try {
      const res = await fetch("/api/screen-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, vacancy }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Screening failed");

      const screeningResult: ScreeningResult = {
        id: uuidv4(),
        candidateId: selectedProfile?.id ?? "uploaded",
        vacancyId: selectedVacancy,
        ...json.result,
        createdAt: new Date().toISOString(),
      };
      const updated = [...screenings, screeningResult];
      setScreenings(updated);
      db.saveScreenings(updated);
      setResult(screeningResult);

      // Prompt to add to DB if this was a fresh upload
      if (mode === "upload" && !addedToDb) {
        setShowAddToDb(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setScreening(false);
    }
  };

  // ── Save new candidate to database ──────────────────────────────────────────

  const saveToDatabase = () => {
    const cv = getCV();
    if (!addForm.firstName || !cv) return;
    const now = new Date().toISOString();
    const newProfile: CandidateProfile = {
      id: uuidv4(),
      firstName: addForm.firstName,
      lastName: addForm.lastName,
      email: addForm.email,
      phone: addForm.phone,
      location: "",
      postalCode: "",
      jobTitle: addForm.jobTitle,
      branch: addForm.branch,
      status: "active",
      notes: "",
      timedNotes: [],
      documents: [],
      timeline: [{
        id: uuidv4(),
        type: "created",
        content: "Added from AI Screening",
        createdAt: now,
      }],
      createdAt: now,
      updatedAt: now,
    };
    db.getCandidateProfiles().then(allProfiles => {
      const updated = [...allProfiles, newProfile];
      db.saveCandidateProfiles(updated);
      setProfiles(updated);
    });
    setAddedToDb(true);
    setShowAddToDb(false);
  };

  // ── Download report / questions ─────────────────────────────────────────────

  const downloadReport = () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!result || !cv || !vacancy) return;
    openPrintWindow(generateScreeningReportHTML(result, cv, vacancy));
  };

  const generateQuestions = async () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!result || !cv || !vacancy) return;
    setLoadingQs(true);
    setQError("");
    setQuestions(null);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, vacancy, gaps: result.gaps, strengths: result.strengths }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Generation failed");
      setQuestions(json.questions);
    } catch (e) {
      setQError(String(e));
    } finally {
      setLoadingQs(false);
    }
  };

  const downloadGuide = () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!questions || !cv || !vacancy) return;
    openPrintWindow(generateInterviewGuideHTML(questions, cv, vacancy));
  };

  const copyToClipboard = async () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!questions || !cv || !vacancy) return;
    await navigator.clipboard.writeText(questionsToPlainText(questions, cv, vacancy));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const cv = getCV();
  const vacancy = vacancies.find(v => v.id === selectedVacancy);
  const orderedCategories: InterviewQuestion["category"][] = ["technical", "gap", "behavioural", "culture"];
  const canScreen = !!cv && !!selectedVacancy && !loadingProfileCV;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#2D4A2D] flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">AI Screening Agent</h1>
        </div>
        <p className="text-[#6B7280] mt-1 ml-12">Score candidates against open vacancies with Claude AI.</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Input panel ──────────────────────────────────────────────────── */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >

          {/* ── Step 1: Candidate ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#2D4A2D] text-white text-xs font-bold flex items-center justify-center">1</span>
                <h2 className="text-[#2D4A2D] font-semibold text-sm">Candidate CV</h2>
              </div>
              {/* Mode toggle */}
              <button
                onClick={() => {
                  const next = mode === "existing" ? "upload" : "existing";
                  setMode(next);
                  setUploadedCV(null);
                  setSelectedProfile(null);
                  setSearch("");
                  setError("");
                }}
                className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#2D4A2D] transition-colors"
              >
                {mode === "existing"
                  ? <><ToggleLeft size={16} className="text-[#2D4A2D]" /> Upload new CV</>
                  : <><ToggleRight size={16} className="text-[#2D4A2D]" /> Select existing</>
                }
              </button>
            </div>

            {/* ── Existing candidate search ─────────────────────────────── */}
            {mode === "existing" && (
              <div className="space-y-3">
                <div className="relative" ref={dropdownRef}>
                  <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 transition-colors ${
                    dropdownOpen ? "border-[#2D4A2D]" : "border-[rgba(45,74,45,0.15)]"
                  }`}>
                    {selectedProfile ? (
                      <div className="w-5 h-5 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] text-[10px] font-bold flex-shrink-0">
                        {selectedProfile.firstName.charAt(0)}
                      </div>
                    ) : (
                      <Search size={14} className="text-[#9CA3AF] flex-shrink-0" />
                    )}
                    <input
                      className="flex-1 bg-transparent text-[#2D4A2D] text-sm placeholder-[#9CA3AF] outline-none"
                      placeholder="Search candidates by name or role…"
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value);
                        setDropdownOpen(true);
                        if (selectedProfile && e.target.value !== `${selectedProfile.firstName} ${selectedProfile.lastName}`) {
                          setSelectedProfile(null);
                          setUploadedCV(null);
                        }
                      }}
                      onFocus={() => setDropdownOpen(true)}
                    />
                    {(search || selectedProfile) && (
                      <button onClick={clearProfile} className="text-[#9CA3AF] hover:text-[#2D4A2D] transition-colors flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown list */}
                  <AnimatePresence>
                    {dropdownOpen && filteredProfiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl overflow-hidden z-20 shadow-lg max-h-64 overflow-y-auto"
                      >
                        {filteredProfiles.slice(0, 20).map(p => (
                          <button
                            key={p.id}
                            onMouseDown={() => selectProfile(p)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2D4A2D]/5 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#2D4A2D]/10 flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
                              {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[#2D4A2D] text-sm font-medium leading-none mb-0.5">
                                {p.firstName} {p.lastName}
                              </p>
                              <p className="text-[#6B7280] text-xs truncate">{p.jobTitle || p.branch || "—"}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[p.status] ?? "bg-[rgba(45,74,45,0.08)] text-[#6B7280]"}`}>
                              {p.status}
                            </span>
                          </button>
                        ))}
                        {profiles.length === 0 && (
                          <div className="px-4 py-6 text-center text-[#6B7280] text-sm">
                            <UserCircle size={24} className="mx-auto mb-2 text-[rgba(45,74,45,0.2)]" />
                            No candidates in your database yet
                          </div>
                        )}
                      </motion.div>
                    )}

                    {dropdownOpen && filteredProfiles.length === 0 && search.trim() && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl px-4 py-4 text-center z-20 shadow-lg"
                      >
                        <p className="text-[#6B7280] text-sm">No candidates match &ldquo;{search}&rdquo;</p>
                        <button
                          onMouseDown={() => { setMode("upload"); setDropdownOpen(false); setSearch(""); }}
                          className="mt-2 text-[#2D4A2D] text-xs hover:underline"
                        >
                          Upload a new CV instead →
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {profiles.length === 0 && !dropdownOpen && (
                  <p className="text-[#6B7280] text-xs">
                    No candidates yet.{" "}
                    <button onClick={() => setMode("upload")} className="text-[#2D4A2D] hover:underline">Upload a CV</button> to get started.
                  </p>
                )}
              </div>
            )}

            {/* ── Upload mode ───────────────────────────────────────────── */}
            {mode === "upload" && (
              <div
                onClick={() => document.getElementById("screen-upload")?.click()}
                className="border border-dashed border-[rgba(45,74,45,0.2)] hover:border-[#2D4A2D] rounded-xl p-5 text-center cursor-pointer transition-all hover:bg-[#2D4A2D]/5"
              >
                <input
                  id="screen-upload" type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadAndProcess(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-[#2D4A2D]">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Processing…</span>
                  </div>
                ) : uploadedCV ? (
                  <div className="flex items-center justify-center gap-2 text-[#4CAF50]">
                    <CheckCircle size={16} />
                    <span className="text-sm font-medium">{uploadedCV.firstName} · CV ready</span>
                  </div>
                ) : (
                  <div className="text-[#6B7280] text-sm">
                    <Upload size={18} className="mx-auto mb-1.5 text-[#2D4A2D]" />
                    Drop a PDF or Word file
                  </div>
                )}
              </div>
            )}

            {/* CV loading state */}
            {loadingProfileCV && (
              <div className="flex items-center gap-2 text-[#6B7280] text-sm mt-3">
                <Loader2 size={14} className="animate-spin text-[#2D4A2D]" />
                Loading CV from profile…
              </div>
            )}

            {/* CV preview card */}
            <AnimatePresence>
              {cv && !loadingProfileCV && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 p-3 bg-[#4CAF5015] rounded-xl border border-[#4CAF5030]"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-[#4CAF50] flex-shrink-0" />
                    <div>
                      <p className="text-[#2D4A2D] text-sm font-medium leading-none">{cv.firstName}</p>
                      <p className="text-[#6B7280] text-xs mt-0.5">{cv.currentRole}{cv.skills.length > 0 && ` · ${cv.skills.slice(0, 3).join(", ")}`}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Step 2: Vacancy ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-6 h-6 rounded-full bg-[#2D4A2D] text-white text-xs font-bold flex items-center justify-center">2</span>
              <h2 className="text-[#2D4A2D] font-semibold text-sm">Select Vacancy</h2>
            </div>
            {vacancies.filter(v => v.status === "open").length === 0 ? (
              <p className="text-[#6B7280] text-sm">No open vacancies. <a href="/vacancies" className="text-[#2D4A2D] hover:underline">Add one first →</a></p>
            ) : (
              <select
                className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                value={selectedVacancy}
                onChange={e => setSelectedVacancy(e.target.value)}
              >
                <option value="">— Select a vacancy —</option>
                {vacancies.filter(v => v.status === "open").map(v => (
                  <option key={v.id} value={v.id}>{v.title} @ {v.company}</option>
                ))}
              </select>
            )}
            <AnimatePresence>
              {vacancy && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 p-3 bg-[#2D4A2D]/5 rounded-xl border border-[rgba(45,74,45,0.12)]"
                >
                  <p className="text-[#2D4A2D] text-sm font-medium">{vacancy.title}</p>
                  <p className="text-[#6B7280] text-xs mt-0.5">{vacancy.seniorityLevel} · {vacancy.currency} {vacancy.salaryMin.toLocaleString()}–{vacancy.salaryMax.toLocaleString()}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-[#ef4444] bg-[#ef444415] border border-[#ef444430] rounded-xl px-4 py-3"
              >
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Run button */}
          <button
            onClick={runScreening}
            disabled={screening || !canScreen}
            className="w-full flex items-center justify-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            {screening ? (
              <><Loader2 size={18} className="animate-spin" /> Screening with Claude…</>
            ) : (
              <><Zap size={18} /> Run AI Screening</>
            )}
          </button>
        </motion.div>

        {/* ── Result panel ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {/* Empty state */}
            {!result && !screening && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-12 text-center flex flex-col items-center justify-center"
                style={{ minHeight: 320 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#2D4A2D]/5 flex items-center justify-center mb-4">
                  <Zap size={28} className="text-[rgba(45,74,45,0.3)]" />
                </div>
                <p className="text-[#2D4A2D] font-medium mb-1">Ready to screen</p>
                <p className="text-[#6B7280] text-sm">Select a candidate and vacancy, then run the agent</p>
              </motion.div>
            )}

            {/* Loading state */}
            {screening && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-12 text-center flex flex-col items-center justify-center"
                style={{ minHeight: 320 }}
              >
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full border-2 border-[#2D4A2D]/10 flex items-center justify-center">
                    <Loader2 size={26} className="text-[#2D4A2D] animate-spin" />
                  </div>
                </div>
                <p className="text-[#2D4A2D] font-medium mb-1">Claude is evaluating the candidate…</p>
                <p className="text-[#6B7280] text-sm">Scoring against role requirements</p>
              </motion.div>
            )}

            {/* Result */}
            {result && !screening && (() => {
              const flagStyle = FLAG_STYLES[result.flag];
              const scoreColor = result.score >= 7 ? "text-[#4CAF50]" : result.score >= 5 ? "text-[#f59e0b]" : "text-[#ef4444]";
              const barColor   = result.score >= 7 ? "bg-[#4CAF50]" : result.score >= 5 ? "bg-[#f59e0b]" : "bg-[#ef4444]";
              const label = scoreLabel(result.score);
              return (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Score card */}
                  <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] overflow-hidden">
                    <div className={`p-5 border-b border-[rgba(45,74,45,0.08)] ${flagStyle.bg} ${flagStyle.border} border`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${flagStyle.bg} ${flagStyle.border} ${flagStyle.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${flagStyle.dot}`} />
                            {label}
                          </span>
                          <p className="text-[#6B7280] text-xs mt-2">{cv?.firstName} → {vacancy?.title}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-5xl font-bold ${scoreColor}`}>{result.score}</p>
                          <p className="text-[#6B7280] text-xs">/ 10</p>
                        </div>
                      </div>
                      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${result.score * 10}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      {result.scoreReason && (
                        <p className={`mt-3 text-xs ${flagStyle.text} opacity-80 italic`}>{result.scoreReason}</p>
                      )}
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Summary */}
                      <div>
                        <p className="text-[#2D4A2D] text-xs font-bold uppercase tracking-wider mb-2">Recruiter Summary</p>
                        <p className="text-[#6B7280] text-sm leading-relaxed">{result.summary}</p>
                      </div>

                      {/* Strengths */}
                      {result.strengths.length > 0 && (
                        <div>
                          <p className="text-[#4CAF50] text-xs font-bold uppercase tracking-wider mb-2">Strengths</p>
                          <ul className="space-y-1.5">
                            {result.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[#6B7280]">
                                <CheckCircle size={13} className="text-[#4CAF50] mt-0.5 flex-shrink-0" />{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gaps */}
                      {result.gaps.length > 0 && (
                        <div>
                          <p className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider mb-2">Gaps / Concerns</p>
                          <ul className="space-y-1.5">
                            {result.gaps.map((g, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[#6B7280]">
                                <AlertCircle size={13} className="text-[#f59e0b] mt-0.5 flex-shrink-0" />{g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={downloadReport}
                          className="flex items-center gap-1.5 bg-[#2D4A2D]/8 hover:bg-[#2D4A2D]/15 text-[#2D4A2D] px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-[rgba(45,74,45,0.12)]"
                        >
                          <Download size={13} />
                          Download Report
                        </button>
                        <button
                          onClick={generateQuestions}
                          disabled={loadingQs}
                          className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                        >
                          {loadingQs ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                          {loadingQs ? "Generating…" : "Generate Interview Questions"}
                        </button>
                      </div>

                      <button
                        onClick={() => { setResult(null); setQuestions(null); setShowAddToDb(false); }}
                        className="w-full border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)] py-2 rounded-xl text-sm transition-all"
                      >
                        Screen another candidate
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* ── Add to database prompt ────────────────────────────────── */}
          <AnimatePresence>
            {showAddToDb && !addedToDb && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-[rgba(45,74,45,0.2)] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.08)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#2D4A2D]/10 flex items-center justify-center">
                      <UserPlus size={13} className="text-[#2D4A2D]" />
                    </div>
                    <div>
                      <p className="text-[#2D4A2D] text-sm font-semibold leading-none">Add to your database?</p>
                      <p className="text-[#6B7280] text-xs mt-0.5">Save this candidate for future use</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddToDb(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                    <X size={15} />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">First Name *</label>
                      <input
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.firstName}
                        onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="Jane"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">Last Name</label>
                      <input
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.lastName}
                        onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Smith"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">Email</label>
                      <input
                        type="email"
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.email}
                        onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="jane@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">Phone</label>
                      <input
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.phone}
                        onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+31 6 ..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">Job Title</label>
                      <input
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.jobTitle}
                        onChange={e => setAddForm(f => ({ ...f, jobTitle: e.target.value }))}
                        placeholder="Senior Developer"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1">Branch</label>
                      <input
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={addForm.branch}
                        onChange={e => setAddForm(f => ({ ...f, branch: e.target.value }))}
                        placeholder="IT"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 px-5 pb-4">
                  <button
                    onClick={() => setShowAddToDb(false)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)] transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={saveToDatabase}
                    disabled={!addForm.firstName}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus size={14} />
                    Save to Database
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Added to DB confirmation */}
          <AnimatePresence>
            {addedToDb && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 px-4 py-3 bg-[#4CAF5015] border border-[#4CAF5030] rounded-xl text-[#4CAF50] text-sm"
              >
                <Check size={16} className="flex-shrink-0" />
                <span>Candidate saved to your database.</span>
                <a href="/candidates" className="ml-auto text-xs underline opacity-70 hover:opacity-100 flex-shrink-0">View →</a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Interview Questions ───────────────────────────────────── */}
          <AnimatePresence>
            {(loadingQs || qError || questions) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.08)]">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={15} className="text-[#2D4A2D]" />
                    <span className="text-[#2D4A2D] font-semibold text-sm">Interview Questions</span>
                    {questions && <span className="text-[#6B7280] text-xs">· {questions.length} questions</span>}
                  </div>
                  {questions && (
                    <div className="flex gap-2">
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-[rgba(45,74,45,0.06)] hover:bg-[rgba(45,74,45,0.12)] text-[#2D4A2D] transition-colors border border-[rgba(45,74,45,0.12)]"
                      >
                        {copied ? <Check size={12} className="text-[#4CAF50]" /> : <ClipboardCopy size={12} />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={downloadGuide}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white transition-colors"
                      >
                        <Download size={12} />
                        PDF Guide
                      </button>
                    </div>
                  )}
                </div>

                {loadingQs && (
                  <div className="flex items-center justify-center py-12 gap-3 text-[#6B7280]">
                    <Loader2 size={18} className="animate-spin text-[#2D4A2D]" />
                    <span className="text-sm">Claude is generating tailored questions…</span>
                  </div>
                )}

                {qError && (
                  <div className="m-4 flex items-center gap-2 text-[#ef4444] bg-[#ef444415] border border-[#ef444430] rounded-xl px-4 py-3">
                    <AlertCircle size={14} />
                    <span className="text-sm">{qError}</span>
                  </div>
                )}

                {questions && (
                  <div className="p-5 space-y-1">
                    {orderedCategories.map(cat => {
                      const qs = questions.filter(q => q.category === cat);
                      if (!qs.length) return null;
                      return (
                        <div key={cat} className="mb-5">
                          <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border mb-3 ${CATEGORY_STYLES[cat]}`}>
                            {CATEGORY_LABELS[cat]}
                          </div>
                          <div className="space-y-3">
                            {qs.map((q, i) => (
                              <div key={i} className="pl-3 border-l-2 border-[rgba(45,74,45,0.12)]">
                                <p className="text-[#2D4A2D] text-sm font-medium leading-snug mb-1">
                                  {i + 1}. {q.question}
                                </p>
                                <p className="text-[#6B7280] text-xs leading-relaxed">
                                  <span className="text-[#6B7280] font-medium">Listen for: </span>
                                  {q.listenFor}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Recent screenings ─────────────────────────────────────── */}
          <AnimatePresence>
            {screenings.length > 0 && !result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-4"
              >
                <p className="text-[#6B7280] text-xs font-bold uppercase tracking-wider mb-3">Recent Screenings</p>
                <div className="space-y-2">
                  {[...screenings].reverse().slice(0, 5).map((s) => {
                    const v = vacancies.find(v => v.id === s.vacancyId);
                    const flag = FLAG_STYLES[s.flag];
                    const label = scoreLabel(s.score);
                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${flag.dot}`} />
                          <span className="text-[#6B7280] text-xs">{v?.title || "Unknown role"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] ${flag.text} opacity-70`}>{label}</span>
                          <span className={`text-xs font-bold ${flag.text}`}>{s.score}/10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

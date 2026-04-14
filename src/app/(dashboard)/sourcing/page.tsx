"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { db, initDb } from "@/lib/db";
import { storage } from "@/lib/storage";
import { Vacancy, SourcingStrategy, SourcingProfileDescription } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import {
  ArrowLeft, Search, ChevronDown, Check, Copy, ExternalLink,
  ChevronRight, ChevronUp, Save, Zap, Users, Globe, GitBranch,
  Link2, BookOpen, MessageSquare, X
} from "lucide-react";

type Step = "select-vacancy" | "loading" | "results";

const LOADING_STEPS = [
  "Reading vacancy requirements...",
  "Building ideal candidate profile...",
  "Generating search strategies...",
  "Scanning the market...",
];

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
function ProgressBar({ step }: { step: Step }) {
  const steps: { id: Step | "generating"; label: string }[] = [
    { id: "select-vacancy", label: "Select Vacancy" },
    { id: "generating", label: "Generating" },
    { id: "results", label: "Results" },
  ];
  const activeIdx = step === "select-vacancy" ? 0 : step === "loading" ? 1 : 2;

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors"
                style={{
                  background: done || active ? "#2D4A2D" : "rgba(45,74,45,0.12)",
                  color: done || active ? "#fff" : "#6B7280",
                }}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: active ? "#2D4A2D" : done ? "#2D4A2D" : "#6B7280" }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-3 h-px w-10 transition-colors"
                style={{ background: done ? "#2D4A2D" : "rgba(45,74,45,0.15)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VacancyCombobox
// ---------------------------------------------------------------------------
function VacancyCombobox({
  vacancies,
  selected,
  onSelect,
}: {
  vacancies: Vacancy[];
  selected: Vacancy | null;
  onSelect: (v: Vacancy) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = vacancies.filter(
    (v) =>
      v.title.toLowerCase().includes(query.toLowerCase()) ||
      v.company.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <div
        className="w-full flex items-center gap-2 bg-white border rounded-xl px-4 py-3 cursor-pointer transition-colors"
        style={{
          border: open ? "1.5px solid #2D4A2D" : "1.5px solid rgba(45,74,45,0.15)",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <Search size={16} color="#6B7280" />
        <input
          type="text"
          className="flex-1 bg-transparent text-sm outline-none text-[#2D4A2D] placeholder-[#6B7280]"
          placeholder="Search vacancies..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && filtered.length > 0) {
              onSelect(filtered[0]);
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <ChevronDown size={16} color="#6B7280" className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border overflow-hidden"
            style={{ border: "1.5px solid rgba(45,74,45,0.12)", maxHeight: 280, overflowY: "auto" }}
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#6B7280]">No vacancies found</div>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.id}
                  className="w-full text-left px-4 py-3 hover:bg-[rgba(45,74,45,0.06)] transition-colors flex items-center justify-between group"
                  onClick={() => {
                    onSelect(v);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-[#2D4A2D]">{v.title}</div>
                    <div className="text-xs text-[#6B7280]">{v.company}</div>
                  </div>
                  {selected?.id === v.id && <Check size={14} color="#2D4A2D" />}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingSequence
// ---------------------------------------------------------------------------
function LoadingSequence({ stepIdx }: { stepIdx: number }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[400px] mx-auto">
      <div className="w-12 h-12 rounded-full border-2 border-[rgba(45,74,45,0.2)] border-t-[#2D4A2D] animate-spin" />
      <div className="w-full flex flex-col gap-3">
        {LOADING_STEPS.map((label, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          if (i > stepIdx) return null;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: done ? "#2D4A2D" : active ? "rgba(45,74,45,0.15)" : "transparent",
                }}
              >
                {done ? (
                  <Check size={11} color="#fff" />
                ) : active ? (
                  <div className="w-2 h-2 rounded-full bg-[#2D4A2D] animate-pulse" />
                ) : null}
              </div>
              <span
                className="text-sm"
                style={{ color: done ? "#2D4A2D" : active ? "#2D4A2D" : "#6B7280", fontWeight: active ? 500 : 400 }}
              >
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchStringCard
// ---------------------------------------------------------------------------
function SearchStringCard({
  title,
  content,
  openUrl,
  icon,
}: {
  title: string;
  content: string;
  openUrl?: string;
  icon: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: "1.5px solid rgba(45,74,45,0.1)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(45,74,45,0.08)" }}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-[#2D4A2D]">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-[rgba(45,74,45,0.08)] text-[#6B7280]"
            title="Copy"
          >
            {copied ? <Check size={12} color="#2D4A2D" /> : <Copy size={12} />}
            <span style={{ color: copied ? "#2D4A2D" : undefined }}>{copied ? "Copied!" : "Copy"}</span>
          </button>
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#6B7280] hover:bg-[rgba(45,74,45,0.08)] transition-colors"
              title="Open"
            >
              <ExternalLink size={12} />
              <span>Open</span>
            </a>
          )}
        </div>
      </div>
      <pre
        className="text-xs rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "#f8f9fa",
          border: "1.5px solid rgba(45,74,45,0.15)",
          color: "#2D4A2D",
        }}
      >
        {content}
      </pre>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ProfileCard
// ---------------------------------------------------------------------------
function ProfileCard({ profile, idx }: { profile: SourcingProfileDescription; idx: number }) {
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyOutreach = () => {
    navigator.clipboard.writeText(profile.outreachMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformIcons: Record<string, React.ReactNode> = {
    linkedin: <Link2 size={13} />,
    github: <GitBranch size={13} />,
    stackoverflow: <BookOpen size={13} />,
    slack: <MessageSquare size={13} />,
    discord: <MessageSquare size={13} />,
  };

  const getPlatformIcon = (community: string) => {
    const lower = community.toLowerCase();
    for (const [key, icon] of Object.entries(platformIcons)) {
      if (lower.includes(key)) return icon;
    }
    return <Globe size={13} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.06 }}
      className="bg-white rounded-xl p-5 flex flex-col gap-4"
      style={{ border: "1.5px solid rgba(45,74,45,0.1)" }}
    >
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold" style={{ color: "#2D4A2D" }}>{profile.title}</h3>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "#6B7280" }}>{profile.backgroundDescription}</p>
      </div>

      {/* Key Skills */}
      {profile.keySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.keySkills.map((skill, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#a8e6cf", color: "#2D4A2D" }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Where to find */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Where to find</span>
        <div className="flex flex-wrap gap-2">
          <a
            href={profile.whereToFind.linkedinSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80"
            style={{ background: "#EBF5FF", color: "#0077B5" }}
          >
            <Link2 size={12} />
            Search LinkedIn →
          </a>
          {profile.whereToFind.githubSearch && (
            <a
              href={profile.whereToFind.githubSearch}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80"
              style={{ background: "rgba(45,74,45,0.08)", color: "#2D4A2D" }}
            >
              <GitBranch size={12} />
              GitHub
            </a>
          )}
        </div>
        {profile.whereToFind.communities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {profile.whereToFind.communities.map((c, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(45,74,45,0.06)", color: "#6B7280" }}
              >
                {getPlatformIcon(c)}
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Outreach message */}
      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "rgba(45,74,45,0.08)" }}>
        <button
          onClick={() => setOutreachOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>
            Outreach Message
          </span>
          <div className="flex items-center gap-1">
            {outreachOpen ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />}
          </div>
        </button>
        <AnimatePresence>
          {outreachOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2">
                <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{profile.outreachMessage}</p>
                <button
                  onClick={handleCopyOutreach}
                  className="self-start flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(45,74,45,0.08)", color: "#2D4A2D" }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy message"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function SourcingContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("select-vacancy");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [strategy, setStrategy] = useState<SourcingStrategy | null>(null);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const apiResultRef = useRef<SourcingStrategy | null>(null);
  const stepsShownRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Init db and load vacancies
  useEffect(() => {
    const agencyId = (session?.user as { agencyId?: string })?.agencyId;
    if (!agencyId) return;
    initDb(agencyId);
    db.getVacancies()
      .then((vs) => setVacancies(vs.filter((v) => v.status === "open")))
      .catch(console.error);
  }, [session]);

  // Auto-select from URL param
  useEffect(() => {
    const vacancyId = searchParams.get("vacancyId");
    if (vacancyId && vacancies.length > 0) {
      const found = vacancies.find((v) => v.id === vacancyId);
      if (found) setSelectedVacancy(found);
    }
  }, [searchParams, vacancies]);

  // Advance loading steps
  const startLoadingSteps = useCallback(() => {
    stepsShownRef.current = 0;
    setLoadingStepIdx(0);
    intervalRef.current = setInterval(() => {
      stepsShownRef.current += 1;
      setLoadingStepIdx(stepsShownRef.current);
      if (stepsShownRef.current >= LOADING_STEPS.length - 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // If API already returned, go to results
        if (apiResultRef.current) {
          setStrategy(apiResultRef.current);
          setStep("results");
        }
      }
    }, 600);
  }, []);

  const handleFindCandidates = useCallback(async () => {
    if (!selectedVacancy) return;
    setError(null);
    setStep("loading");
    startLoadingSteps();

    try {
      const salaryRange =
        selectedVacancy.salaryMin && selectedVacancy.salaryMax
          ? `${selectedVacancy.currency ?? "€"}${selectedVacancy.salaryMin.toLocaleString()} - ${selectedVacancy.currency ?? "€"}${selectedVacancy.salaryMax.toLocaleString()}`
          : "Not specified";

      const res = await fetch("/api/source-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: selectedVacancy.title,
          skills: selectedVacancy.requirements ?? [],
          location: "",
          seniorityLevel: selectedVacancy.seniorityLevel ?? "",
          salaryRange,
          vacancyLink: "",
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const result = data.result as { profiles: SourcingProfileDescription[]; booleanSearch: string; xraySearch: string };

      const newStrategy: SourcingStrategy = {
        id: uuidv4(),
        jobTitle: selectedVacancy.title,
        skills: selectedVacancy.requirements ?? [],
        location: "",
        seniorityLevel: selectedVacancy.seniorityLevel ?? "",
        salaryRange,
        vacancyId: selectedVacancy.id,
        profiles: result.profiles,
        booleanSearch: result.booleanSearch,
        xraySearch: result.xraySearch,
        createdAt: new Date().toISOString(),
      };

      apiResultRef.current = newStrategy;

      // If steps already done, go to results immediately
      if (stepsShownRef.current >= LOADING_STEPS.length - 1) {
        setStrategy(newStrategy);
        setStep("results");
      }
      // Otherwise the interval will pick it up
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setError(String(err));
      setStep("select-vacancy");
    }
  }, [selectedVacancy, startLoadingSteps]);

  const handleSave = async () => {
    if (!strategy) return;
    setSaving(true);
    try {
      const existing = await db.getSourcingStrategies();
      await db.saveSourcingStrategies([...existing, strategy]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    apiResultRef.current = null;
    stepsShownRef.current = 0;
    setStep("select-vacancy");
    setStrategy(null);
    setError(null);
  };

  // Build search URLs
  const linkedinBooleanUrl = strategy
    ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(strategy.booleanSearch)}`
    : "";
  const googleXrayUrl = strategy
    ? `https://www.google.com/search?q=${encodeURIComponent(strategy.xraySearch)}`
    : "";
  const githubUrl = strategy?.profiles?.[0]?.whereToFind?.githubSearch ?? "";

  const salaryLabel =
    selectedVacancy && selectedVacancy.salaryMin && selectedVacancy.salaryMax
      ? `${selectedVacancy.currency ?? "€"}${selectedVacancy.salaryMin.toLocaleString()} – ${selectedVacancy.currency ?? "€"}${selectedVacancy.salaryMax.toLocaleString()}`
      : null;

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: "#EDEDEB" }}>
      <div className="max-w-5xl mx-auto">
        {/* Progress bar */}
        <ProgressBar step={step} />

        {/* ---------------------------------------------------------------- */}
        {/* STEP 1: Select Vacancy                                           */}
        {/* ---------------------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {step === "select-vacancy" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mx-auto mt-2"
              style={{ maxWidth: 560 }}
            >
              <h1 className="text-[28px] font-semibold mb-1" style={{ color: "#2D4A2D" }}>
                Find Candidates
              </h1>
              <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
                Select a vacancy and Orchard will find matching candidates online
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-4 flex items-start gap-3 p-4 rounded-xl text-sm"
                  style={{ background: "#FEF2F2", border: "1.5px solid rgba(239,68,68,0.2)", color: "#991B1B" }}
                >
                  <X size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium">Something went wrong.</span>
                    <p className="mt-0.5 text-xs opacity-80">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="hover:opacity-70">
                    <X size={14} />
                  </button>
                </motion.div>
              )}

              <VacancyCombobox
                vacancies={vacancies}
                selected={selectedVacancy}
                onSelect={setSelectedVacancy}
              />

              <div className="mt-3 text-center">
                <button
                  onClick={() => {
                    setSelectedVacancy(null);
                    handleFindCandidates();
                  }}
                  className="text-xs text-[#6B7280] hover:text-[#2D4A2D] transition-colors underline underline-offset-2"
                >
                  Or start without a vacancy →
                </button>
              </div>

              <AnimatePresence>
                {selectedVacancy && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 p-4 rounded-xl"
                    style={{ background: "#fff", border: "1.5px solid rgba(45,74,45,0.15)" }}
                  >
                    <p className="text-base font-semibold mb-1" style={{ color: "#2D4A2D" }}>
                      Searching for: {selectedVacancy.title}
                    </p>
                    <p className="text-[13px] mb-4" style={{ color: "#6B7280" }}>
                      {selectedVacancy.company}
                      {selectedVacancy.seniorityLevel ? ` · ${selectedVacancy.seniorityLevel}` : ""}
                      {salaryLabel ? ` · ${salaryLabel}` : ""}
                    </p>
                    <button
                      onClick={handleFindCandidates}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ background: "#2D4A2D" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#3D6B3D")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "#2D4A2D")}
                    >
                      Find Candidates
                      <ChevronRight size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* STEP 2: Loading                                                  */}
          {/* -------------------------------------------------------------- */}
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mx-auto mt-2"
              style={{ maxWidth: 480 }}
            >
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm mb-8 transition-colors"
                style={{ color: "#6B7280" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#2D4A2D")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
              >
                <ArrowLeft size={15} />
                Back
              </button>

              <div className="flex flex-col items-center text-center gap-8 py-8">
                <LoadingSequence stepIdx={loadingStepIdx} />
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  This usually takes 15–20 seconds
                </p>
              </div>
            </motion.div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* STEP 3: Results                                                  */}
          {/* -------------------------------------------------------------- */}
          {step === "results" && strategy && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "#2D4A2D" }}>
                    Strategies for: {strategy.jobTitle}
                  </h2>
                  {selectedVacancy && (
                    <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{selectedVacancy.company}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="text-sm transition-colors"
                    style={{ color: "#6B7280" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#2D4A2D")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
                  >
                    Change
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: saved ? "#4CAF50" : "#2D4A2D", opacity: saving ? 0.7 : 1 }}
                    onMouseOver={(e) => { if (!saved) e.currentTarget.style.background = "#3D6B3D"; }}
                    onMouseOut={(e) => { if (!saved) e.currentTarget.style.background = "#2D4A2D"; }}
                  >
                    {saved ? (
                      <>
                        <Check size={15} />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        {saving ? "Saving…" : "Save Strategy"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Strings */}
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} color="#2D4A2D" />
                  <h3 className="text-base font-semibold" style={{ color: "#2D4A2D" }}>Search Strings</h3>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  <SearchStringCard
                    title="LinkedIn Boolean"
                    content={strategy.booleanSearch}
                    openUrl={linkedinBooleanUrl}
                    icon={<Link2 size={14} color="#0077B5" />}
                  />
                  <SearchStringCard
                    title="Google X-Ray"
                    content={strategy.xraySearch}
                    openUrl={googleXrayUrl}
                    icon={<Globe size={14} color="#2D4A2D" />}
                  />
                  {githubUrl && (
                    <SearchStringCard
                      title="GitHub"
                      content={githubUrl}
                      openUrl={githubUrl}
                      icon={<GitBranch size={14} color="#2D4A2D" />}
                    />
                  )}
                </div>
              </section>

              {/* Candidate Profiles */}
              <section className="pb-24">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} color="#2D4A2D" />
                  <h3 className="text-base font-semibold" style={{ color: "#2D4A2D" }}>Candidate Profiles</h3>
                </div>
                <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
                  {strategy.profiles.length} profile type{strategy.profiles.length !== 1 ? "s" : ""} generated
                </p>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {strategy.profiles.map((profile, i) => (
                    <ProfileCard key={i} profile={profile} idx={i} />
                  ))}
                </div>
              </section>

              {/* Sticky footer */}
              <div
                className="fixed bottom-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-40"
                style={{ background: "rgba(237,237,235,0.92)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(45,74,45,0.1)" }}
              >
                <div className="text-sm" style={{ color: "#6B7280" }}>
                  {selectedVacancy ? (
                    <>Linked to <span className="font-medium text-[#2D4A2D]">{selectedVacancy.title}</span></>
                  ) : (
                    "No vacancy linked"
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: saved ? "#4CAF50" : "#2D4A2D", opacity: saving ? 0.7 : 1 }}
                  onMouseOver={(e) => { if (!saved) e.currentTarget.style.background = "#3D6B3D"; }}
                  onMouseOut={(e) => { if (!saved) e.currentTarget.style.background = "#2D4A2D"; }}
                >
                  {saved ? (
                    <><Check size={15} /> Saved</>
                  ) : (
                    <><Save size={15} /> {saving ? "Saving…" : "Save sourcing strategy"}</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SourcingPage() {
  return (
    <Suspense fallback={<div />}>
      <SourcingContent />
    </Suspense>
  );
}

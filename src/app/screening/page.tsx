"use client";

import { useEffect, useState } from "react";
import { Candidate, Vacancy, ScreeningResult, ProcessedCV } from "@/lib/types";
import { storage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import {
  Zap, Upload, Loader2, AlertCircle, CheckCircle,
  Download, ClipboardCopy, Check, MessageSquare,
} from "lucide-react";
import {
  generateScreeningReportHTML,
  generateInterviewGuideHTML,
  questionsToPlainText,
} from "@/lib/pdfReports";
import type { InterviewQuestion } from "@/app/api/generate-questions/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLAG_STYLES = {
  green: { bg: "bg-[#10b98120]", border: "border-[#10b98150]", text: "text-[#10b981]", label: "Strong Match",   dot: "bg-[#10b981]" },
  amber: { bg: "bg-[#f59e0b20]", border: "border-[#f59e0b50]", text: "text-[#f59e0b]", label: "Partial Match",  dot: "bg-[#f59e0b]" },
  red:   { bg: "bg-[#ef444420]", border: "border-[#ef444450]", text: "text-[#ef4444]", label: "Poor Match",     dot: "bg-[#ef4444]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  technical:   "Technical / Role-Specific",
  gap:         "Probing the Gaps",
  behavioural: "Behavioural (STAR)",
  culture:     "Culture Fit",
};

const CATEGORY_STYLES: Record<string, string> = {
  technical:   "bg-purple-500/10 text-purple-300 border-purple-500/20",
  gap:         "bg-amber-500/10 text-amber-300 border-amber-500/20",
  behavioural: "bg-green-500/10 text-green-300 border-green-500/20",
  culture:     "bg-blue-500/10 text-blue-300 border-blue-500/20",
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
  const [candidates, setCandidates]   = useState<Candidate[]>([]);
  const [vacancies, setVacancies]     = useState<Vacancy[]>([]);
  const [screenings, setScreenings]   = useState<ScreeningResult[]>([]);

  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedVacancy, setSelectedVacancy]     = useState("");
  const [uploadedCV, setUploadedCV]   = useState<ProcessedCV | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [screening, setScreening]     = useState(false);
  const [result, setResult]           = useState<ScreeningResult | null>(null);
  const [error, setError]             = useState("");

  // Interview questions state
  const [questions, setQuestions]     = useState<InterviewQuestion[] | null>(null);
  const [loadingQs, setLoadingQs]     = useState(false);
  const [qError, setQError]           = useState("");
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    setCandidates(storage.getCandidates());
    setVacancies(storage.getVacancies());
    setScreenings(storage.getScreenings());
  }, []);

  // ── CV upload ──────────────────────────────────────────────────────────────

  const uploadAndProcess = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process-cv", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Processing failed");
      setUploadedCV(json.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const getCV = (): ProcessedCV | null => {
    if (uploadedCV) return uploadedCV;
    const candidate = candidates.find(c => c.id === selectedCandidate);
    return candidate?.processedCV || null;
  };

  // ── Run screening ──────────────────────────────────────────────────────────

  const runScreening = async () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!cv || !vacancy) { setError("Please select both a candidate CV and a vacancy."); return; }

    setScreening(true);
    setError("");
    setResult(null);
    setQuestions(null);
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
        candidateId: selectedCandidate || "uploaded",
        vacancyId: selectedVacancy,
        ...json.result,
        createdAt: new Date().toISOString(),
      };
      const updated = [...screenings, screeningResult];
      setScreenings(updated);
      storage.saveScreenings(updated);
      setResult(screeningResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setScreening(false);
    }
  };

  // ── Download screening report ──────────────────────────────────────────────

  const downloadReport = () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!result || !cv || !vacancy) return;
    openPrintWindow(generateScreeningReportHTML(result, cv, vacancy));
  };

  // ── Generate interview questions ───────────────────────────────────────────

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

  // ── Download interview guide ───────────────────────────────────────────────

  const downloadGuide = () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!questions || !cv || !vacancy) return;
    openPrintWindow(generateInterviewGuideHTML(questions, cv, vacancy));
  };

  // ── Copy to clipboard ──────────────────────────────────────────────────────

  const copyToClipboard = async () => {
    const cv = getCV();
    const vacancy = vacancies.find(v => v.id === selectedVacancy);
    if (!questions || !cv || !vacancy) return;
    await navigator.clipboard.writeText(questionsToPlainText(questions, cv, vacancy));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cv = getCV();
  const vacancy = vacancies.find(v => v.id === selectedVacancy);
  const orderedCategories: InterviewQuestion["category"][] = ["technical", "gap", "behavioural", "culture"];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">AI Screening Agent</h1>
        <p className="text-[#94a3b8] mt-1">Score candidates against open vacancies with Claude AI.</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Input panel ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Candidate */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Step 1 — Select Candidate CV</h2>
            <div className="space-y-3">
              {candidates.filter(c => c.processedCV).length > 0 && (
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">From Pipeline</label>
                  <select
                    className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={selectedCandidate}
                    onChange={e => { setSelectedCandidate(e.target.value); setUploadedCV(null); }}
                  >
                    <option value="">— Select a candidate —</option>
                    {candidates.filter(c => c.processedCV).map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} — {c.currentRole}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#1e3a5f]" />
                <span className="text-[#4a6080] text-xs">or upload a CV</span>
                <div className="flex-1 h-px bg-[#1e3a5f]" />
              </div>

              <div
                onClick={() => document.getElementById("screen-upload")?.click()}
                className="border border-dashed border-[#1e3a5f] hover:border-[#7C3AED] rounded-lg p-4 text-center cursor-pointer transition-all"
              >
                <input
                  id="screen-upload" type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setSelectedCandidate(""); uploadAndProcess(f); }
                  }}
                />
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-[#7C3AED]">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Processing…</span>
                  </div>
                ) : uploadedCV ? (
                  <div className="flex items-center justify-center gap-2 text-[#10b981]">
                    <CheckCircle size={16} />
                    <span className="text-sm">{uploadedCV.firstName} · CV ready</span>
                  </div>
                ) : (
                  <div className="text-[#94a3b8] text-sm">
                    <Upload size={16} className="mx-auto mb-1" />
                    Upload PDF or Word
                  </div>
                )}
              </div>
            </div>

            {cv && (
              <div className="mt-3 p-3 bg-[#112244] rounded-lg border border-[#1e3a5f]">
                <p className="text-white text-sm font-medium">{cv.firstName}</p>
                <p className="text-[#94a3b8] text-xs">{cv.currentRole} · {cv.skills.slice(0, 3).join(", ")}</p>
              </div>
            )}
          </div>

          {/* Vacancy */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Step 2 — Select Vacancy</h2>
            {vacancies.filter(v => v.status === "open").length === 0 ? (
              <p className="text-[#94a3b8] text-sm">No open vacancies. <a href="/vacancies" className="text-[#7C3AED]">Add one first →</a></p>
            ) : (
              <select
                className="w-full bg-[#112244] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                value={selectedVacancy}
                onChange={e => setSelectedVacancy(e.target.value)}
              >
                <option value="">— Select a vacancy —</option>
                {vacancies.filter(v => v.status === "open").map(v => (
                  <option key={v.id} value={v.id}>{v.title} @ {v.company}</option>
                ))}
              </select>
            )}
            {vacancy && (
              <div className="mt-3 p-3 bg-[#112244] rounded-lg border border-[#1e3a5f]">
                <p className="text-white text-sm font-medium">{vacancy.title}</p>
                <p className="text-[#94a3b8] text-xs">{vacancy.seniorityLevel} · {vacancy.currency} {vacancy.salaryMin.toLocaleString()}–{vacancy.salaryMax.toLocaleString()}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            onClick={runScreening}
            disabled={screening || !cv || !selectedVacancy}
            className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all"
          >
            {screening ? (
              <><Loader2 size={18} className="animate-spin" /> Screening with Claude…</>
            ) : (
              <><Zap size={18} /> Run AI Screening</>
            )}
          </button>
        </div>

        {/* ── Result panel ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!result && !screening && (
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-12 text-center flex flex-col items-center justify-center" style={{ minHeight: 320 }}>
              <Zap size={40} className="text-[#1e3a5f] mb-3" />
              <p className="text-[#94a3b8]">Screening results will appear here</p>
              <p className="text-[#4a6080] text-sm mt-1">Select a candidate and vacancy, then run the agent</p>
            </div>
          )}

          {screening && (
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-12 text-center flex flex-col items-center justify-center" style={{ minHeight: 320 }}>
              <Loader2 size={40} className="text-[#7C3AED] animate-spin mb-3" />
              <p className="text-white font-medium">Claude is evaluating the candidate…</p>
              <p className="text-[#94a3b8] text-sm mt-1">Scoring against role requirements</p>
            </div>
          )}

          {result && !screening && (() => {
            const flagStyle = FLAG_STYLES[result.flag];
            const scoreColor = result.score >= 8 ? "text-[#10b981]" : result.score >= 5 ? "text-[#f59e0b]" : "text-[#ef4444]";
            const barColor   = result.score >= 8 ? "bg-[#10b981]" : result.score >= 5 ? "bg-[#f59e0b]" : "bg-[#ef4444]";
            return (
              <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
                {/* Score header */}
                <div className={`p-5 border-b border-[#1e3a5f] ${flagStyle.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${flagStyle.dot}`} />
                        <span className={`text-sm font-bold ${flagStyle.text}`}>{flagStyle.label}</span>
                      </div>
                      <p className="text-[#94a3b8] text-xs">{cv?.firstName} → {vacancy?.title}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-4xl font-bold ${scoreColor}`}>{result.score}</p>
                      <p className="text-[#94a3b8] text-xs">/ 10</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#112244] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${result.score * 10}%` }} />
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Summary */}
                  <div>
                    <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-2">Recruiter Summary</p>
                    <p className="text-[#94a3b8] text-sm leading-relaxed">{result.summary}</p>
                  </div>

                  {/* Strengths */}
                  {result.strengths.length > 0 && (
                    <div>
                      <p className="text-[#10b981] text-xs font-bold uppercase tracking-wider mb-2">Strengths</p>
                      <ul className="space-y-1.5">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#94a3b8]">
                            <CheckCircle size={13} className="text-[#10b981] mt-0.5 flex-shrink-0" />{s}
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
                          <li key={i} className="flex items-start gap-2 text-sm text-[#94a3b8]">
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
                      className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download size={13} />
                      Download Report
                    </button>
                    <button
                      onClick={generateQuestions}
                      disabled={loadingQs}
                      className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      {loadingQs ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                      {loadingQs ? "Generating…" : "Generate Interview Questions"}
                    </button>
                  </div>

                  <button
                    onClick={() => { setResult(null); setQuestions(null); }}
                    className="w-full border border-[#1e3a5f] text-[#94a3b8] hover:text-white hover:border-[#94a3b8] py-2 rounded-lg text-sm transition-all"
                  >
                    Screen another candidate
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Interview Questions ──────────────────────────────────────── */}
          {(loadingQs || qError || questions) && (
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-[#7C3AED]" />
                  <span className="text-white font-semibold text-sm">Interview Questions</span>
                  {questions && (
                    <span className="text-[#4a6fa5] text-xs">· {questions.length} questions</span>
                  )}
                </div>
                {questions && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white transition-colors"
                    >
                      {copied ? <Check size={12} className="text-[#10b981]" /> : <ClipboardCopy size={12} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={downloadGuide}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6d28d9] text-white transition-colors"
                    >
                      <Download size={12} />
                      PDF Guide
                    </button>
                  </div>
                )}
              </div>

              {loadingQs && (
                <div className="flex items-center justify-center py-12 gap-3 text-[#94a3b8]">
                  <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
                  <span className="text-sm">Claude is generating tailored questions…</span>
                </div>
              )}

              {qError && (
                <div className="m-4 flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
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
                      <div key={cat} className="mb-4">
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border mb-3 ${CATEGORY_STYLES[cat]}`}>
                          {CATEGORY_LABELS[cat]}
                        </div>
                        <div className="space-y-3">
                          {qs.map((q, i) => (
                            <div key={i} className="pl-3 border-l-2 border-[#1e3a5f]">
                              <p className="text-white text-sm font-medium leading-snug mb-1">
                                {i + 1}. {q.question}
                              </p>
                              <p className="text-[#4a6fa5] text-xs leading-relaxed">
                                <span className="text-[#94a3b8] font-medium">Listen for: </span>
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
            </div>
          )}

          {/* History */}
          {screenings.length > 0 && !result && (
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
              <p className="text-[#94a3b8] text-xs font-bold uppercase tracking-wider mb-3">Recent Screenings</p>
              <div className="space-y-2">
                {[...screenings].reverse().slice(0, 5).map((s) => {
                  const v = vacancies.find(v => v.id === s.vacancyId);
                  const flag = FLAG_STYLES[s.flag];
                  return (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${flag.dot}`} />
                        <span className="text-[#94a3b8] text-xs">{v?.title || "Unknown role"}</span>
                      </div>
                      <span className={`text-xs font-bold ${flag.text}`}>{s.score}/10</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

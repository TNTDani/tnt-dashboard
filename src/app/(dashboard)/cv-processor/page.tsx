"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ProcessedCV, Candidate } from "@/lib/types";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  Upload, FileText, Download, Check, Loader2, AlertCircle,
  User, Briefcase, GraduationCap, Code, X,
} from "lucide-react";

type Step = "upload" | "processing" | "result" | "error";

export default function CVProcessor() {
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessedCV | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const ok = f.type.includes("pdf") || f.type.includes("word") || f.name.endsWith(".docx") || f.name.endsWith(".doc");
    if (!ok) { setError("Please upload a PDF or Word document."); return; }
    setFile(f);
    setError("");
  };

  const processCV = async () => {
    if (!file) return;
    setStep("processing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process-cv", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Processing failed");
      setResult(json.data);
      setStep("result");
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  };

  const saveToDatabase = () => {
    if (!result) return;
    const candidate: Candidate = {
      id: uuidv4(),
      firstName: result.firstName,
      currentRole: result.currentRole,
      currentCompany: result.currentCompany,
      skills: result.skills,
      status: "sourced",
      createdAt: new Date().toISOString(),
      processedCV: result,
    };
    db.getCandidates().then(existing => db.saveCandidates([...existing, candidate]));
    setSaved(true);
  };

  const downloadDocx = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: result }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TNT_${result.firstName}_CV.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/generate-cv-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: result }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TNT_${result.firstName}_CV.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setResult(null);
    setError("");
    setSaved(false);
  };

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
            <FileText size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">CV Processor</h1>
        </div>
        <p className="text-[#6B7280] mt-1 ml-12">Upload a candidate CV — Claude AI extracts, anonymises and reformats it.</p>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── Upload / Error step ─────────────────────────────────────────── */}
        {(step === "upload" || step === "error") && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl space-y-4"
          >
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`bg-white rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-[#2D4A2D] bg-[#2D4A2D]/5"
                  : "border-[rgba(45,74,45,0.2)] hover:border-[#2D4A2D] hover:bg-[#2D4A2D]/[0.03]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center transition-colors ${
                dragOver ? "bg-[#2D4A2D]/15" : "bg-[#2D4A2D]/8"
              }`}>
                <Upload size={28} className="text-[#2D4A2D]" />
              </div>
              <p className="text-[#2D4A2D] font-semibold text-base mb-1.5">
                {file ? file.name : "Drop a CV here or click to browse"}
              </p>
              <p className="text-[#6B7280] text-sm">PDF or Word (.docx) — max 10MB</p>
            </div>

            {/* Error message */}
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

            {/* Selected file preview */}
            <AnimatePresence>
              {file && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#2D4A2D]/8 flex items-center justify-center">
                      <FileText size={16} className="text-[#2D4A2D]" />
                    </div>
                    <div>
                      <p className="text-[#2D4A2D] text-sm font-medium">{file.name}</p>
                      <p className="text-[#6B7280] text-xs">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-[#6B7280] hover:text-[#ef4444] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Process button */}
            <button
              onClick={processCV}
              disabled={!file}
              className="w-full bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Process CV with Claude AI
            </button>
          </motion.div>
        )}

        {/* ── Processing step ─────────────────────────────────────────────── */}
        {step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl"
          >
            <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-14 text-center">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#2D4A2D]/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={28} className="text-[#2D4A2D] animate-spin" />
                </div>
              </div>
              <p className="text-[#2D4A2D] font-semibold text-base mb-1.5">Analysing CV…</p>
              <p className="text-[#6B7280] text-sm">Extracting information and anonymising candidate data</p>
            </div>
          </motion.div>
        )}

        {/* ── Result step ─────────────────────────────────────────────────── */}
        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-3 gap-6"
          >
            {/* CV Preview */}
            <div className="col-span-2 bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl overflow-hidden">
              {/* CV Header */}
              <div className="bg-[#2D4A2D] px-6 py-5">
                <p className="text-white/50 text-xs tracking-widest uppercase font-semibold">Orchard</p>
                <h2 className="text-white text-2xl font-bold mt-1">{result.firstName}</h2>
                <p className="text-white/70 text-sm mt-0.5">{result.currentRole} · {result.currentCompany}</p>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[600px]">
                {/* Summary */}
                <div>
                  <h3 className="text-[#2D4A2D] text-xs font-bold tracking-widest uppercase mb-2 pb-1.5 border-b border-[rgba(45,74,45,0.1)]">
                    Professional Summary
                  </h3>
                  <p className="text-[#6B7280] text-sm leading-relaxed">{result.professionalSummary}</p>
                </div>

                {/* Skills */}
                {result.skills.length > 0 && (
                  <div>
                    <h3 className="text-[#2D4A2D] text-xs font-bold tracking-widest uppercase mb-3 pb-1.5 border-b border-[rgba(45,74,45,0.1)]">
                      Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {result.skills.map((s, i) => (
                        <span
                          key={i}
                          className="bg-[#4CAF5015] text-[#2D4A2D] text-xs px-2.5 py-1 rounded-full border border-[#4CAF5030] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {result.experience.length > 0 && (
                  <div>
                    <h3 className="text-[#2D4A2D] text-xs font-bold tracking-widest uppercase mb-3 pb-1.5 border-b border-[rgba(45,74,45,0.1)]">
                      Experience
                    </h3>
                    <div className="space-y-5">
                      {result.experience.map((e, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-[rgba(45,74,45,0.12)]">
                          <div className="flex items-baseline justify-between mb-1">
                            <p className="text-[#2D4A2D] text-sm font-semibold">
                              {e.title} <span className="text-[#6B7280] font-normal">· {e.company}</span>
                            </p>
                            <p className="text-[#6B7280] text-xs flex-shrink-0 ml-2">{e.startDate} – {e.endDate}</p>
                          </div>
                          <ul className="space-y-1">
                            {e.responsibilities.map((r, j) => (
                              <li key={j} className="text-[#6B7280] text-xs flex gap-2">
                                <span className="text-[#2D4A2D]/40 mt-0.5 flex-shrink-0">·</span>{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {result.education.length > 0 && (
                  <div>
                    <h3 className="text-[#2D4A2D] text-xs font-bold tracking-widest uppercase mb-2 pb-1.5 border-b border-[rgba(45,74,45,0.1)]">
                      Education
                    </h3>
                    <div className="space-y-2">
                      {result.education.map((edu, i) => (
                        <p key={i} className="text-[#2D4A2D] text-sm">
                          <span className="font-medium">{edu.degree}</span>
                          <span className="text-[#6B7280]"> · {edu.institution} · {edu.year}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Actions panel */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-5">
                <h3 className="text-[#2D4A2D] font-semibold mb-4 text-sm">Actions</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={downloadDocx}
                      disabled={downloading}
                      className="flex items-center justify-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-60 text-white font-semibold py-2.5 px-3 rounded-xl transition-colors text-sm"
                    >
                      {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      .docx
                    </button>
                    <button
                      onClick={downloadPdf}
                      disabled={downloadingPdf}
                      className="flex items-center justify-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-60 text-white font-semibold py-2.5 px-3 rounded-xl transition-colors text-sm"
                    >
                      {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      PDF
                    </button>
                  </div>

                  <button
                    onClick={saveToDatabase}
                    disabled={saved}
                    className="w-full flex items-center justify-center gap-2 bg-[#4CAF5015] hover:bg-[#4CAF5025] disabled:opacity-60 text-[#4CAF50] font-semibold py-2.5 px-4 rounded-xl border border-[#4CAF5030] transition-colors"
                  >
                    {saved ? <Check size={16} /> : <User size={16} />}
                    {saved ? "Saved to Pipeline" : "Save to Pipeline"}
                  </button>

                  <button
                    onClick={reset}
                    className="w-full flex items-center justify-center gap-2 text-[#6B7280] hover:text-[#2D4A2D] py-2.5 px-4 rounded-xl border border-[rgba(45,74,45,0.12)] hover:border-[rgba(45,74,45,0.3)] transition-all text-sm"
                  >
                    Process another CV
                  </button>
                </div>
              </div>

              {/* Extracted stats */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-5">
                <h3 className="text-[#2D4A2D] font-semibold mb-3 text-sm">Extracted</h3>
                <div className="space-y-2">
                  {[
                    { icon: Briefcase, label: "Roles", value: result.experience.length },
                    { icon: GraduationCap, label: "Qualifications", value: result.education.length },
                    { icon: Code, label: "Skills", value: result.skills.length },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-[#6B7280]">
                        <s.icon size={14} />
                        {s.label}
                      </div>
                      <span className="text-[#2D4A2D] font-semibold">{s.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[rgba(45,74,45,0.08)]">
                  <p className="text-[#4CAF50] text-xs flex items-center gap-1.5">
                    <Check size={12} /> Contact details removed
                  </p>
                  <p className="text-[#4CAF50] text-xs flex items-center gap-1.5 mt-1">
                    <Check size={12} /> First name only retained
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

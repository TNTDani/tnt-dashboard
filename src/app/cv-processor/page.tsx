"use client";

import { useState, useRef } from "react";
import { ProcessedCV, Candidate } from "@/lib/types";
import { storage } from "@/lib/storage";
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
    const candidates = storage.getCandidates();
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
    storage.saveCandidates([...candidates, candidate]);
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

  const reset = () => {
    setStep("upload");
    setFile(null);
    setResult(null);
    setError("");
    setSaved(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">CV Processor</h1>
        <p className="text-[#94a3b8] mt-1">Upload a candidate CV — Claude AI extracts, anonymises and reformats it.</p>
      </div>

      {/* Upload step */}
      {(step === "upload" || step === "error") && (
        <div className="max-w-2xl">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
              dragOver ? "border-[#7C3AED] bg-[#7C3AED10]" : "border-[#1e3a5f] hover:border-[#7C3AED] hover:bg-[#7C3AED08]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <Upload size={40} className="mx-auto mb-4 text-[#7C3AED]" />
            <p className="text-white font-medium mb-1">
              {file ? file.name : "Drop a CV here or click to browse"}
            </p>
            <p className="text-[#94a3b8] text-sm">PDF or Word (.docx) — max 10MB</p>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {file && !error && (
            <div className="mt-4 flex items-center justify-between bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-[#7C3AED]" />
                <div>
                  <p className="text-white text-sm font-medium">{file.name}</p>
                  <p className="text-[#94a3b8] text-xs">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[#94a3b8] hover:text-red-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          <button
            onClick={processCV}
            disabled={!file}
            className="mt-4 w-full bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Process CV with Claude AI
          </button>
        </div>
      )}

      {/* Processing */}
      {step === "processing" && (
        <div className="max-w-2xl">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-12 text-center">
            <Loader2 size={40} className="mx-auto mb-4 text-[#7C3AED] animate-spin" />
            <p className="text-white font-medium mb-1">Claude is reading the CV…</p>
            <p className="text-[#94a3b8] text-sm">Extracting information and removing contact details</p>
          </div>
        </div>
      )}

      {/* Result */}
      {step === "result" && result && (
        <div className="grid grid-cols-3 gap-6">
          {/* CV Preview */}
          <div className="col-span-2 bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
            {/* CV Header */}
            <div className="bg-[#7C3AED] px-6 py-4">
              <p className="text-white/70 text-xs tracking-widest uppercase font-semibold">True North Talent</p>
              <h2 className="text-white text-2xl font-bold mt-1">{result.firstName}</h2>
              <p className="text-white/80 text-sm mt-0.5">{result.currentRole} · {result.currentCompany}</p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[600px]">
              {/* Summary */}
              <div>
                <h3 className="text-[#7C3AED] text-xs font-bold tracking-widest uppercase mb-2 pb-1 border-b border-[#1e3a5f]">Professional Summary</h3>
                <p className="text-[#94a3b8] text-sm leading-relaxed">{result.professionalSummary}</p>
              </div>

              {/* Experience */}
              {result.experience.length > 0 && (
                <div>
                  <h3 className="text-[#7C3AED] text-xs font-bold tracking-widest uppercase mb-3 pb-1 border-b border-[#1e3a5f]">Experience</h3>
                  <div className="space-y-4">
                    {result.experience.map((e, i) => (
                      <div key={i}>
                        <div className="flex items-baseline justify-between">
                          <p className="text-white text-sm font-semibold">{e.title} <span className="text-[#94a3b8] font-normal">· {e.company}</span></p>
                          <p className="text-[#94a3b8] text-xs flex-shrink-0 ml-2">{e.startDate} – {e.endDate}</p>
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {e.responsibilities.map((r, j) => (
                            <li key={j} className="text-[#94a3b8] text-xs flex gap-2">
                              <span className="text-[#7C3AED] mt-0.5 flex-shrink-0">·</span>{r}
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
                  <h3 className="text-[#7C3AED] text-xs font-bold tracking-widest uppercase mb-2 pb-1 border-b border-[#1e3a5f]">Education</h3>
                  {result.education.map((edu, i) => (
                    <p key={i} className="text-[#e2e8f0] text-sm"><span className="font-medium">{edu.degree}</span> <span className="text-[#94a3b8]">· {edu.institution} · {edu.year}</span></p>
                  ))}
                </div>
              )}

              {/* Skills */}
              {result.skills.length > 0 && (
                <div>
                  <h3 className="text-[#7C3AED] text-xs font-bold tracking-widest uppercase mb-2 pb-1 border-b border-[#1e3a5f]">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skills.map((s, i) => (
                      <span key={i} className="bg-[#7C3AED20] text-[#a78bfa] text-xs px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions panel */}
          <div className="space-y-4">
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={downloadDocx}
                  disabled={downloading}
                  className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
                >
                  {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Download .docx
                </button>
                <button
                  onClick={saveToDatabase}
                  disabled={saved}
                  className="w-full flex items-center justify-center gap-2 bg-[#10b98120] hover:bg-[#10b98130] disabled:opacity-60 text-[#10b981] font-semibold py-2.5 px-4 rounded-lg border border-[#10b98140] transition-all duration-200"
                >
                  {saved ? <Check size={16} /> : <User size={16} />}
                  {saved ? "Saved to Pipeline" : "Save to Pipeline"}
                </button>
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 text-[#94a3b8] hover:text-white py-2.5 px-4 rounded-lg border border-[#1e3a5f] hover:border-[#94a3b8] transition-all duration-200 text-sm"
                >
                  Process another CV
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 text-sm">Extracted</h3>
              <div className="space-y-2">
                {[
                  { icon: Briefcase, label: "Roles", value: result.experience.length },
                  { icon: GraduationCap, label: "Qualifications", value: result.education.length },
                  { icon: Code, label: "Skills", value: result.skills.length },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-[#94a3b8]">
                      <s.icon size={14} />
                      {s.label}
                    </div>
                    <span className="text-white font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#1e3a5f]">
                <p className="text-[#10b981] text-xs flex items-center gap-1.5">
                  <Check size={12} /> Contact details removed
                </p>
                <p className="text-[#10b981] text-xs flex items-center gap-1.5 mt-1">
                  <Check size={12} /> First name only retained
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

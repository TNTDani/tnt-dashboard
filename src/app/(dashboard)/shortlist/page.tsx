"use client";

import { useEffect, useRef, useState } from "react";
import { Candidate, CandidateProfile, Vacancy, Client, ProcessedCV } from "@/lib/types";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { buildZip } from "@/lib/zipBuilder";
import {
  ListChecks, Download, Mail, Briefcase, X, Check,
  AlertCircle, Loader2, Send, Upload, FileText,
  Phone, MapPin, Clock, ChevronRight, UserCircle,
} from "lucide-react";

// ─── Extended type ────────────────────────────────────────────────────────────

interface ShortlistCandidate extends Candidate {
  profileId?: string;
}

interface SendModalState {
  vacancyId: string;
  vacancyTitle: string;
  company: string;
  clientEmail: string;
  candidateCount: number;
}

// ─── Timeline entry mini-renderer ─────────────────────────────────────────────

function TimelineItem({ entry }: { entry: { type: string; content: string; createdAt: string } }) {
  const dot: Record<string, string> = {
    note: "bg-[#2D4A2D]",
    email_sent: "bg-[#3b82f6]",
    status_change: "bg-[#f59e0b]",
    cv_upload: "bg-[#4CAF50]",
    motivation_upload: "bg-[#4CAF50]",
    created: "bg-[#94a3b8]",
  };
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot[entry.type] ?? "bg-[#94a3b8]"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[#94a3b8] text-xs leading-relaxed">{entry.content}</p>
        <p className="text-[#6B7280] text-[10px] mt-0.5">
          {new Date(entry.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShortlistPage() {
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [sendModal, setSendModal] = useState<SendModalState | null>(null);
  const [sending, setSending] = useState(false);
  const [sendDone, setSendDone] = useState(false);
  const [gmailTokens, setGmailTokens] = useState<string | null>(null);

  // CV upload modal (quick, from "No CV data" badge)
  const [uploadTarget, setUploadTarget] = useState<ShortlistCandidate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slide-over panel
  const [panelCandidate, setPanelCandidate] = useState<ShortlistCandidate | null>(null);
  const [panelProfile, setPanelProfile] = useState<CandidateProfile | null>(null);
  const [panelUploading, setPanelUploading] = useState(false);
  const [panelUploadError, setPanelUploadError] = useState("");
  const [panelNotes, setPanelNotes] = useState("");
  const [panelNotesSaved, setPanelNotesSaved] = useState(false);
  const panelFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      db.getCandidates(),
      db.getVacancies(),
      db.getClients(),
    ]).then(([allCandidates, allVacancies, allClients]) => {
      setCandidates((allCandidates as ShortlistCandidate[]).filter(c => c.status === "shortlisted"));
      setVacancies(allVacancies);
      setClients(allClients);
    });
    setGmailTokens(storage.getGmailToken());
  }, []);

  // ── Grouping ────────────────────────────────────────────────────────────────

  const groups = (() => {
    const map = new Map<string, ShortlistCandidate[]>();
    for (const c of candidates) {
      const key = c.vacancyId ?? "__unassigned__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  })();

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleGroupSelect = (ids: string[]) => {
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  // ── Remove from shortlist ───────────────────────────────────────────────────

  const removeFromShortlist = (id: string) => {
    db.getCandidates().then(all => {
      const updated = all.map(c => c.id === id ? { ...c, status: "screened" as const } : c);
      db.saveCandidates(updated);
      setCandidates((updated as ShortlistCandidate[]).filter(c => c.status === "shortlisted"));
    });
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (panelCandidate?.id === id) setPanelCandidate(null);
  };

  // ── CV processing (shared logic) ─────────────────────────────────────────────

  const processAndSaveCV = async (file: File, candidateId: string): Promise<ProcessedCV | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/process-cv", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Processing failed");

    const processedCV: ProcessedCV = json.data;

    // Persist processedCV on the pipeline candidate
    const allCandidates = await db.getCandidates();
    const updatedAll = allCandidates.map(c => c.id === candidateId ? { ...c, processedCV } : c);
    db.saveCandidates(updatedAll);

    // Refresh local candidate list
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, processedCV } : c) as ShortlistCandidate[]);

    // Refresh panel if it's showing this candidate
    setPanelCandidate(prev => prev?.id === candidateId ? { ...prev, processedCV } as ShortlistCandidate : prev);

    return processedCV;
  };

  // Quick upload (from badge click)
  const handleQuickUpload = async (file: File) => {
    if (!uploadTarget) return;
    setUploading(true);
    setUploadError("");
    try {
      await processAndSaveCV(file, uploadTarget.id);
      setUploadTarget(null);
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  // Panel upload
  const handlePanelUpload = async (file: File) => {
    if (!panelCandidate) return;
    setPanelUploading(true);
    setPanelUploadError("");
    try {
      await processAndSaveCV(file, panelCandidate.id);
    } catch (e) {
      setPanelUploadError(String(e));
    } finally {
      setPanelUploading(false);
    }
  };

  // ── Slide-over panel ────────────────────────────────────────────────────────

  const openPanel = (candidate: ShortlistCandidate) => {
    setPanelCandidate(candidate);
    setPanelUploadError("");
    setPanelNotesSaved(false);
    if (candidate.profileId) {
      db.getCandidateProfiles().then(profiles => {
        const profile = profiles.find(p => p.id === candidate.profileId) ?? null;
        setPanelProfile(profile);
        setPanelNotes(profile?.notes ?? candidate.notes ?? "");
      });
    } else {
      setPanelProfile(null);
      setPanelNotes(candidate.notes ?? "");
    }
  };

  const closePanel = () => {
    setPanelCandidate(null);
    setPanelProfile(null);
  };

  const savePanelNotes = () => {
    if (!panelCandidate) return;
    if (panelProfile) {
      db.getCandidateProfiles().then(allProfiles => {
        db.saveCandidateProfiles(
          allProfiles.map(p => p.id === panelProfile.id
            ? { ...p, notes: panelNotes, updatedAt: new Date().toISOString() }
            : p
          )
        );
      });
    } else {
      db.getCandidates().then(all => {
        db.saveCandidates(all.map(c => c.id === panelCandidate.id ? { ...c, notes: panelNotes } : c));
      });
    }
    setPanelNotesSaved(true);
    setTimeout(() => setPanelNotesSaved(false), 2000);
  };

  // ── Convert & Download ──────────────────────────────────────────────────────

  const convertAndDownload = async (vacancyId: string, vacancyTitle: string) => {
    const group = groups.get(vacancyId) ?? [];
    const toConvert = group.filter(c => selected.has(c.id) && c.processedCV);
    if (toConvert.length === 0) return;

    setConverting(prev => new Set(prev).add(vacancyId));
    try {
      const zipEntries: { filename: string; data: Uint8Array }[] = [];
      for (const candidate of toConvert) {
        const res = await fetch("/api/generate-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv: candidate.processedCV }),
        });
        if (!res.ok) continue;
        zipEntries.push({
          filename: `${candidate.firstName} - Orchard.docx`,
          data: new Uint8Array(await res.arrayBuffer()),
        });
      }
      if (zipEntries.length === 0) return;

      const zipBytes = buildZip(zipEntries);
      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${vacancyTitle} - Shortlist - ${today}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(prev => new Set(prev).add(vacancyId));
    } finally {
      setConverting(prev => { const n = new Set(prev); n.delete(vacancyId); return n; });
    }
  };

  // ── Send to client ──────────────────────────────────────────────────────────

  const openSendModal = (vacancyId: string) => {
    const vacancy = vacancies.find(v => v.id === vacancyId);
    if (!vacancy) return;
    const client = clients.find(c => c.companyName === vacancy.company);
    const group = groups.get(vacancyId) ?? [];
    const count = group.filter(c => selected.has(c.id)).length || group.length;
    setSendModal({ vacancyId, vacancyTitle: vacancy.title, company: vacancy.company,
      clientEmail: client?.contactEmail ?? "", candidateCount: count });
    setSendDone(false);
  };

  const sendEmail = async () => {
    if (!sendModal || !gmailTokens) return;
    setSending(true);
    const { vacancyTitle, company, clientEmail, candidateCount } = sendModal;
    const body = [
      `Dear ${company} team,`, "",
      `Please find attached the shortlist of ${candidateCount} candidate${candidateCount !== 1 ? "s" : ""} for the ${vacancyTitle} role.`, "",
      "Each profile has been carefully reviewed and presented in our Orchard format. Please see the attached ZIP file.", "",
      "We look forward to your feedback.", "", "Best regards,", "Orchard",
    ].join("\n");
    try {
      const tokens = JSON.parse(gmailTokens);
      await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, to: clientEmail,
          subject: `Shortlist — ${vacancyTitle} — Orchard`, body }),
      });
      setSendDone(true);
    } catch { /* silent */ } finally { setSending(false); }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (candidates.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <ListChecks size={22} className="text-[#2D4A2D]" />
          <div>
            <h1 className="text-2xl font-bold text-[#2D4A2D]">Shortlist</h1>
            <p className="text-[#94a3b8] text-sm mt-0.5">Candidates moved to the Shortlisted stage</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ListChecks size={40} className="text-[rgba(45,74,45,0.15)] mb-4" />
          <p className="text-[#2D4A2D] font-medium mb-1">No shortlisted candidates yet</p>
          <p className="text-[#94a3b8] text-sm">Move candidates to the "Shortlisted" stage in the Pipeline to see them here.</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ListChecks size={22} className="text-[#2D4A2D]" />
          <div>
            <h1 className="text-2xl font-bold text-[#2D4A2D]">Shortlist</h1>
            <p className="text-[#94a3b8] text-sm mt-0.5">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} across {groups.size} group{groups.size !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-8">
        {Array.from(groups.entries()).map(([vacancyKey, groupCandidates]) => {
          const vacancy = vacancyKey === "__unassigned__" ? null : vacancies.find(v => v.id === vacancyKey);
          const client = vacancy ? clients.find(c => c.companyName === vacancy.company) : null;
          const groupIds = groupCandidates.map(c => c.id);
          const allGroupSelected = groupIds.every(id => selected.has(id));
          const selectedInGroup = groupCandidates.filter(c => selected.has(c.id));
          const convertableInGroup = selectedInGroup.filter(c => c.processedCV);
          const isConverting = converting.has(vacancyKey);
          const isDownloaded = downloaded.has(vacancyKey);

          return (
            <div key={vacancyKey} className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)]">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={allGroupSelected}
                    onChange={() => toggleGroupSelect(groupIds)}
                    className="w-4 h-4 accent-[#2D4A2D] cursor-pointer" />
                  <div>
                    {vacancy ? (
                      <>
                        <p className="text-[#2D4A2D] font-semibold text-sm">{vacancy.title}</p>
                        <p className="text-[#94a3b8] text-xs flex items-center gap-1">
                          <Briefcase size={11} /> {vacancy.company}
                          {client && <span className="text-[#6B7280]"> · {client.contactName}</span>}
                        </p>
                      </>
                    ) : (
                      <p className="text-[#94a3b8] font-semibold text-sm">Unassigned</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#6B7280] text-xs">{groupCandidates.length} candidate{groupCandidates.length !== 1 ? "s" : ""}</span>
                  {vacancy && (
                    <>
                      <button
                        onClick={() => convertAndDownload(vacancyKey, vacancy.title)}
                        disabled={isConverting || convertableInGroup.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          convertableInGroup.length === 0
                            ? "bg-[#FFFFFF] text-[#6B7280] cursor-not-allowed"
                            : isConverting
                            ? "bg-[#2D4A2D]/50 text-white cursor-wait"
                            : "bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white"
                        }`}
                      >
                        {isConverting
                          ? <><Loader2 size={12} className="animate-spin" /> Converting…</>
                          : <><Download size={12} /> Convert & Download ZIP</>}
                      </button>
                      {isDownloaded && (
                        <button
                          onClick={() => openSendModal(vacancyKey)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4CAF50]/20 hover:bg-[#4CAF50]/30 text-[#4CAF50] transition-colors"
                        >
                          <Send size={12} /> Send to {client?.contactName ?? vacancy.company}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Candidate rows */}
              <div className="divide-y divide-[rgba(45,74,45,0.15)]">
                {groupCandidates.map(candidate => {
                  const isSelected = selected.has(candidate.id);
                  const hasCV = !!candidate.processedCV;

                  return (
                    <div
                      key={candidate.id}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isSelected ? "bg-[#2D4A2D]/5" : "hover:bg-[#FFFFFF]"}`}
                    >
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(candidate.id)}
                        className="w-4 h-4 accent-[#2D4A2D] cursor-pointer flex-shrink-0" />

                      <div className="w-8 h-8 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] text-xs font-bold flex-shrink-0">
                        {candidate.firstName.charAt(0)}
                      </div>

                      {/* Clickable name → slide-over */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => openPanel(candidate)}
                          className="text-[#2D4A2D] text-sm font-medium hover:text-[#3D6B3D] transition-colors flex items-center gap-1 group/name"
                        >
                          {candidate.firstName}
                          <ChevronRight size={12} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-[#2D4A2D]" />
                        </button>
                        {candidate.currentRole && (
                          <p className="text-[#94a3b8] text-xs truncate">{candidate.currentRole}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* CV badge — "No CV data" is clickable */}
                        {hasCV ? (
                          <span className="flex items-center gap-1 text-[#4CAF50] text-[10px] bg-[#4CAF50]/10 px-2 py-0.5 rounded-full">
                            <Check size={10} /> CV ready
                          </span>
                        ) : (
                          <button
                            onClick={() => { setUploadTarget(candidate); setUploadError(""); }}
                            className="flex items-center gap-1 text-[#f59e0b] text-[10px] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 px-2 py-0.5 rounded-full cursor-pointer transition-all"
                            title="Click to upload CV"
                          >
                            <Upload size={10} /> No CV data
                          </button>
                        )}

                        {candidate.skills.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-[#94a3b8] text-[10px] bg-[#FFFFFF] px-1.5 py-0.5 rounded hidden sm:inline">{s}</span>
                        ))}

                        <button onClick={() => removeFromShortlist(candidate.id)} title="Remove from shortlist"
                          className="text-[rgba(45,74,45,0.15)] hover:text-red-400 transition-colors p-1 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning strip */}
              {selectedInGroup.length > 0 && convertableInGroup.length < selectedInGroup.length && (
                <div className="px-5 py-3 border-t border-[rgba(45,74,45,0.15)] flex items-center gap-2 text-[#f59e0b] text-xs bg-[#f59e0b]/5">
                  <AlertCircle size={13} />
                  {selectedInGroup.length - convertableInGroup.length} selected candidate
                  {selectedInGroup.length - convertableInGroup.length !== 1 ? "s have" : " has"} no CV —
                  click the badge to upload, or open their profile to add one.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Quick CV upload modal (from badge) ─────────────────────────────── */}
      {uploadTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center">
                  <Upload size={13} className="text-[#2D4A2D]" />
                </div>
                <div>
                  <p className="text-[#2D4A2D] font-semibold text-sm leading-none">Upload CV</p>
                  <p className="text-[#94a3b8] text-xs mt-0.5">{uploadTarget.firstName}</p>
                </div>
              </div>
              <button onClick={() => setUploadTarget(null)} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-5">
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleQuickUpload(f); e.target.value = ""; }} />

              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-8 text-center transition-all ${
                  uploading
                    ? "border-[#2D4A2D]/40 cursor-wait"
                    : "border-[rgba(45,74,45,0.15)] hover:border-[#2D4A2D] cursor-pointer"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-[#2D4A2D]">
                    <Loader2 size={24} className="animate-spin" />
                    <p className="text-sm">Processing CV…</p>
                    <p className="text-xs text-[#94a3b8]">Extracting candidate data</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#94a3b8]">
                    <FileText size={24} className="text-[rgba(45,74,45,0.15)]" />
                    <p className="text-sm font-medium">Drop CV here or click to browse</p>
                    <p className="text-xs">PDF, DOC or DOCX</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-3 flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle size={13} /> {uploadError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-over panel backdrop ───────────────────────────────────────── */}
      {panelCandidate && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={closePanel}
        />
      )}

      {/* ── Slide-over panel ────────────────────────────────────────────────── */}
      <div className={`fixed inset-y-0 right-0 z-50 w-[460px] bg-[#FFFFFF] border-l border-[rgba(45,74,45,0.15)] shadow-2xl flex flex-col transform transition-transform duration-300 ${
        panelCandidate ? "translate-x-0" : "translate-x-full"
      }`}>
        {panelCandidate && (
          <>
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] font-bold flex-shrink-0">
                  {panelCandidate.firstName.charAt(0)}
                  {panelProfile ? panelProfile.lastName.charAt(0) : ""}
                </div>
                <div>
                  <p className="text-[#2D4A2D] font-semibold">
                    {panelProfile
                      ? `${panelProfile.firstName} ${panelProfile.lastName}`
                      : panelCandidate.firstName}
                  </p>
                  <p className="text-[#94a3b8] text-xs">
                    {panelCandidate.currentRole || panelProfile?.jobTitle || "—"}
                  </p>
                </div>
              </div>
              <button onClick={closePanel} className="p-1.5 rounded-lg bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Panel body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* Contact info (from profile) */}
              {panelProfile && (panelProfile.email || panelProfile.phone || panelProfile.location) && (
                <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4 space-y-2.5">
                  <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">Contact</p>
                  {panelProfile.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail size={13} className="text-[#2D4A2D] flex-shrink-0" />
                      <a href={`mailto:${panelProfile.email}`} className="text-[#94a3b8] text-sm hover:text-[#2D4A2D] transition-colors truncate">
                        {panelProfile.email}
                      </a>
                    </div>
                  )}
                  {panelProfile.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone size={13} className="text-[#2D4A2D] flex-shrink-0" />
                      <span className="text-[#94a3b8] text-sm">{panelProfile.phone}</span>
                    </div>
                  )}
                  {panelProfile.location && (
                    <div className="flex items-center gap-2.5">
                      <MapPin size={13} className="text-[#2D4A2D] flex-shrink-0" />
                      <span className="text-[#94a3b8] text-sm">{panelProfile.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Professional details */}
              {(panelProfile?.branch || panelProfile?.salaryExpectation || panelCandidate.skills.length > 0) && (
                <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4 space-y-2.5">
                  <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">Professional</p>
                  {panelProfile?.branch && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#94a3b8] text-xs">Branch</span>
                      <span className="text-[#2D4A2D] text-sm">{panelProfile.branch}</span>
                    </div>
                  )}
                  {panelProfile?.salaryExpectation && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#94a3b8] text-xs">Salary expectation</span>
                      <span className="text-[#2D4A2D] text-sm">€{panelProfile.salaryExpectation.toLocaleString("nl-NL")}</span>
                    </div>
                  )}
                  {panelCandidate.skills.length > 0 && (
                    <div>
                      <span className="text-[#94a3b8] text-xs block mb-1.5">Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {panelCandidate.skills.map((s, i) => (
                          <span key={i} className="text-[#94a3b8] text-[10px] bg-[#FFFFFF] px-2 py-0.5 rounded border border-[rgba(45,74,45,0.15)]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CV section */}
              <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
                <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider mb-3">CV / Document</p>
                {panelCandidate.processedCV ? (
                  <div className="flex items-center gap-3 p-3 bg-[#4CAF50]/10 border border-[#4CAF50]/30 rounded-lg">
                    <Check size={16} className="text-[#4CAF50] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#4CAF50] text-sm font-medium">CV Ready</p>
                      <p className="text-[#94a3b8] text-xs">
                        {panelCandidate.processedCV.currentRole} · {panelCandidate.processedCV.skills.slice(0, 3).join(", ")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input ref={panelFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePanelUpload(f); e.target.value = ""; }} />
                    <div
                      onClick={() => !panelUploading && panelFileRef.current?.click()}
                      className={`border border-dashed rounded-lg p-5 text-center transition-all ${
                        panelUploading
                          ? "border-[#2D4A2D]/40 cursor-wait"
                          : "border-[rgba(45,74,45,0.15)] hover:border-[#2D4A2D] cursor-pointer"
                      }`}
                    >
                      {panelUploading ? (
                        <div className="flex items-center justify-center gap-2 text-[#2D4A2D]">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">Processing…</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-[#94a3b8]">
                          <Upload size={18} className="text-[#6B7280]" />
                          <p className="text-xs font-medium">Upload CV (PDF or Word)</p>
                        </div>
                      )}
                    </div>
                    {panelUploadError && (
                      <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle size={11} /> {panelUploadError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">Notes</p>
                  {panelNotesSaved && (
                    <span className="flex items-center gap-1 text-[#4CAF50] text-[10px]">
                      <Check size={10} /> Saved
                    </span>
                  )}
                </div>
                <textarea
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
                  rows={4}
                  placeholder="Internal notes about this candidate…"
                  value={panelNotes}
                  onChange={e => setPanelNotes(e.target.value)}
                />
                <button
                  onClick={savePanelNotes}
                  className="mt-2 text-xs text-[#2D4A2D] hover:text-[#3D6B3D] transition-colors"
                >
                  Save notes
                </button>
              </div>

              {/* Timeline (from profile) */}
              {panelProfile && panelProfile.timeline.length > 0 && (
                <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
                  <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider mb-3">
                    Timeline
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {[...panelProfile.timeline]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(entry => (
                        <TimelineItem key={entry.id} entry={entry} />
                      ))}
                  </div>
                </div>
              )}

              {/* No profile note */}
              {!panelProfile && (
                <div className="flex items-center gap-2 text-[#6B7280] text-xs bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl px-4 py-3">
                  <UserCircle size={13} />
                  <span>
                    This candidate was added manually. <a href="/candidates" className="text-[#2D4A2D] hover:underline">View all candidate profiles →</a>
                  </span>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(45,74,45,0.15)]">
              <button
                onClick={closePanel}
                className="w-full px-4 py-2.5 rounded-lg text-sm bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] transition-colors"
              >
                Back to Shortlist
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Send to Client modal ──────────────────────────────────────────────── */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)]">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[#2D4A2D]" />
                <h2 className="text-[#2D4A2D] font-semibold text-sm">Send Shortlist to Client</h2>
              </div>
              <button onClick={() => setSendModal(null)} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">To</label>
                <input
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D]"
                  value={sendModal.clientEmail}
                  onChange={e => setSendModal(m => m ? { ...m, clientEmail: e.target.value } : null)}
                  placeholder="client@company.com"
                />
                {!sendModal.clientEmail && (
                  <p className="text-[#f59e0b] text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> No client email found — enter manually
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Subject</label>
                <input readOnly
                  className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none"
                  value={`Shortlist — ${sendModal.vacancyTitle} — Orchard`}
                />
              </div>
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Body preview</label>
                <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#94a3b8] text-xs leading-relaxed whitespace-pre-line">
                  {`Dear ${sendModal.company} team,\n\nPlease find attached the shortlist of ${sendModal.candidateCount} candidate${sendModal.candidateCount !== 1 ? "s" : ""} for the ${sendModal.vacancyTitle} role.\n\nEach profile has been carefully reviewed and presented in our Orchard format. Please see the attached ZIP file.\n\nWe look forward to your feedback.\n\nBest regards,\nOrchard`}
                </div>
                <p className="text-[#6B7280] text-[11px] mt-1.5">Remember to attach the ZIP file you downloaded.</p>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-[rgba(45,74,45,0.15)]">
              <button onClick={() => setSendModal(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm bg-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:bg-[#6B7280] transition-colors">
                Cancel
              </button>
              {sendDone ? (
                <div className="flex-1 flex items-center justify-center gap-2 bg-[#4CAF50]/20 text-[#4CAF50] rounded-lg text-sm">
                  <Check size={14} /> Sent!
                </div>
              ) : gmailTokens ? (
                <button onClick={sendEmail} disabled={sending || !sendModal.clientEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? "Sending…" : "Send via Gmail"}
                </button>
              ) : (
                <a href={`mailto:${sendModal.clientEmail}?subject=${encodeURIComponent(`Shortlist — ${sendModal.vacancyTitle} — Orchard`)}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium transition-colors"
                  onClick={() => setSendModal(null)}>
                  <Mail size={14} /> Open in Mail
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

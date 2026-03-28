"use client";

import { useEffect, useState } from "react";
import { Candidate, Vacancy, Client, ProcessedCV } from "@/lib/types";
import { storage } from "@/lib/storage";
import { buildZip } from "@/lib/zipBuilder";
import {
  ListChecks, Download, Mail, Briefcase, X, Check,
  AlertCircle, Loader2, Send,
} from "lucide-react";

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

export default function ShortlistPage() {
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState<Set<string>>(new Set()); // vacancyId converting
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set()); // vacancyId downloaded
  const [sendModal, setSendModal] = useState<SendModalState | null>(null);
  const [sending, setSending] = useState(false);
  const [sendDone, setSendDone] = useState(false);
  const [gmailTokens, setGmailTokens] = useState<string | null>(null);

  useEffect(() => {
    const all = storage.getCandidates() as ShortlistCandidate[];
    setCandidates(all.filter(c => c.status === "shortlisted"));
    setVacancies(storage.getVacancies());
    setClients(storage.getClients());
    setGmailTokens(storage.getGmailToken());
  }, []);

  // Group candidates by vacancyId (null = unassigned)
  const groups = (() => {
    const map = new Map<string, ShortlistCandidate[]>();
    for (const c of candidates) {
      const key = c.vacancyId ?? "__unassigned__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  })();

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroupSelect = (ids: string[]) => {
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const removeFromShortlist = (id: string) => {
    const all = storage.getCandidates();
    const updated = all.map(c => c.id === id ? { ...c, status: "screened" as const } : c);
    storage.saveCandidates(updated);
    setCandidates((updated as ShortlistCandidate[]).filter(c => c.status === "shortlisted"));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  // Convert selected candidates in this vacancy group to True North CVs and download as ZIP
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

        const buf = await res.arrayBuffer();
        zipEntries.push({
          filename: `${candidate.firstName} - True North Talent.docx`,
          data: new Uint8Array(buf),
        });
      }

      if (zipEntries.length === 0) return;

      const zipBytes = buildZip(zipEntries);
      const today = new Date().toISOString().slice(0, 10);
      const zipName = `${vacancyTitle} - Shortlist - ${today}.zip`;

      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);

      setDownloaded(prev => new Set(prev).add(vacancyId));
    } finally {
      setConverting(prev => { const n = new Set(prev); n.delete(vacancyId); return n; });
    }
  };

  const openSendModal = (vacancyId: string) => {
    const vacancy = vacancies.find(v => v.id === vacancyId);
    if (!vacancy) return;
    const client = clients.find(c => c.companyName === vacancy.company);
    const group = groups.get(vacancyId) ?? [];
    const count = group.filter(c => selected.has(c.id)).length || group.length;

    setSendModal({
      vacancyId,
      vacancyTitle: vacancy.title,
      company: vacancy.company,
      clientEmail: client?.contactEmail ?? "",
      candidateCount: count,
    });
    setSendDone(false);
  };

  const sendEmail = async () => {
    if (!sendModal || !gmailTokens) return;
    setSending(true);

    const { vacancyTitle, company, clientEmail, candidateCount } = sendModal;
    const subject = `Shortlist — ${vacancyTitle} — True North Talent`;
    const body = [
      `Dear ${company} team,`,
      "",
      `Please find attached the shortlist of ${candidateCount} candidate${candidateCount !== 1 ? "s" : ""} for the ${vacancyTitle} role.`,
      "",
      "Each profile has been carefully reviewed and presented in our True North Talent format. Please attach the ZIP file you downloaded.",
      "",
      "We look forward to your feedback.",
      "",
      "Best regards,",
      "True North Talent",
    ].join("\n");

    try {
      const tokens = JSON.parse(gmailTokens);
      await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, to: clientEmail, subject, body }),
      });
      setSendDone(true);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <ListChecks size={22} className="text-[#7C3AED]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Shortlist</h1>
            <p className="text-[#94a3b8] text-sm mt-0.5">Candidates moved to the Shortlisted stage</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ListChecks size={40} className="text-[#1e3a5f] mb-4" />
          <p className="text-white font-medium mb-1">No shortlisted candidates yet</p>
          <p className="text-[#94a3b8] text-sm">Move candidates to the "Shortlisted" stage in the Pipeline to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ListChecks size={22} className="text-[#7C3AED]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Shortlist</h1>
            <p className="text-[#94a3b8] text-sm mt-0.5">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} across {groups.size} group{groups.size !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

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
            <div key={vacancyKey} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    onChange={() => toggleGroupSelect(groupIds)}
                    className="w-4 h-4 accent-[#7C3AED] cursor-pointer"
                  />
                  <div>
                    {vacancy ? (
                      <>
                        <p className="text-white font-semibold text-sm">{vacancy.title}</p>
                        <p className="text-[#94a3b8] text-xs flex items-center gap-1">
                          <Briefcase size={11} /> {vacancy.company}
                          {client && <span className="text-[#4a6fa5]"> · {client.contactName}</span>}
                        </p>
                      </>
                    ) : (
                      <p className="text-[#94a3b8] font-semibold text-sm">Unassigned</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#4a6fa5] text-xs">{groupCandidates.length} candidate{groupCandidates.length !== 1 ? "s" : ""}</span>

                  {vacancy && (
                    <>
                      <button
                        onClick={() => convertAndDownload(vacancyKey, vacancy.title)}
                        disabled={isConverting || convertableInGroup.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          convertableInGroup.length === 0
                            ? "bg-[#0a1628] text-[#4a6fa5] cursor-not-allowed"
                            : isConverting
                            ? "bg-[#7C3AED]/50 text-white cursor-wait"
                            : "bg-[#7C3AED] hover:bg-[#6d28d9] text-white"
                        }`}
                      >
                        {isConverting ? (
                          <><Loader2 size={12} className="animate-spin" /> Converting…</>
                        ) : (
                          <><Download size={12} /> Convert & Download ZIP</>
                        )}
                      </button>

                      {isDownloaded && (
                        <button
                          onClick={() => openSendModal(vacancyKey)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] transition-colors"
                        >
                          <Send size={12} />
                          Send to {client?.contactName ?? vacancy.company}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Candidate cards */}
              <div className="divide-y divide-[#1e3a5f]">
                {groupCandidates.map(candidate => {
                  const isSelected = selected.has(candidate.id);
                  const hasCV = !!candidate.processedCV;

                  return (
                    <div
                      key={candidate.id}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                        isSelected ? "bg-[#7C3AED]/5" : "hover:bg-[#0a1628]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(candidate.id)}
                        className="w-4 h-4 accent-[#7C3AED] cursor-pointer flex-shrink-0"
                      />

                      <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] text-xs font-bold flex-shrink-0">
                        {candidate.firstName.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{candidate.firstName}</p>
                        {candidate.currentRole && (
                          <p className="text-[#94a3b8] text-xs truncate">{candidate.currentRole}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasCV ? (
                          <span className="flex items-center gap-1 text-[#10b981] text-[10px] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                            <Check size={10} /> CV ready
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#f59e0b] text-[10px] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">
                            <AlertCircle size={10} /> No CV data
                          </span>
                        )}

                        {candidate.skills.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-[#94a3b8] text-[10px] bg-[#112244] px-1.5 py-0.5 rounded hidden sm:inline">
                            {s}
                          </span>
                        ))}

                        <button
                          onClick={() => removeFromShortlist(candidate.id)}
                          title="Remove from shortlist"
                          className="text-[#1e3a5f] hover:text-red-400 transition-colors p-1 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CV warning */}
              {selectedInGroup.length > 0 && convertableInGroup.length < selectedInGroup.length && (
                <div className="px-5 py-3 border-t border-[#1e3a5f] flex items-center gap-2 text-[#f59e0b] text-xs bg-[#f59e0b]/5">
                  <AlertCircle size={13} />
                  {selectedInGroup.length - convertableInGroup.length} selected candidate{selectedInGroup.length - convertableInGroup.length !== 1 ? "s have" : " has"} no processed CV — run CV Processor first, then re-add to pipeline.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send to Client modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[#7C3AED]" />
                <h2 className="text-white font-semibold text-sm">Send Shortlist to Client</h2>
              </div>
              <button onClick={() => setSendModal(null)} className="text-[#94a3b8] hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">To</label>
                <input
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED]"
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
                <input
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED]"
                  value={`Shortlist — ${sendModal.vacancyTitle} — True North Talent`}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Body preview</label>
                <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-[#94a3b8] text-xs leading-relaxed whitespace-pre-line">
                  {`Dear ${sendModal.company} team,\n\nPlease find attached the shortlist of ${sendModal.candidateCount} candidate${sendModal.candidateCount !== 1 ? "s" : ""} for the ${sendModal.vacancyTitle} role.\n\nEach profile has been carefully reviewed and presented in our True North Talent format. Please see the attached ZIP file.\n\nWe look forward to your feedback.\n\nBest regards,\nTrue North Talent`}
                </div>
                <p className="text-[#4a6fa5] text-[11px] mt-1.5">
                  Remember to attach the ZIP file you downloaded.
                </p>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-[#1e3a5f]">
              <button
                onClick={() => setSendModal(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#1e3a5f] text-[#94a3b8] hover:text-white hover:bg-[#2a4f7a] transition-colors"
              >
                Cancel
              </button>
              {sendDone ? (
                <div className="flex-1 flex items-center justify-center gap-2 bg-[#10b981]/20 text-[#10b981] rounded-lg text-sm">
                  <Check size={14} /> Sent!
                </div>
              ) : gmailTokens ? (
                <button
                  onClick={sendEmail}
                  disabled={sending || !sendModal.clientEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? "Sending…" : "Send via Gmail"}
                </button>
              ) : (
                <a
                  href={`mailto:${sendModal.clientEmail}?subject=${encodeURIComponent(`Shortlist — ${sendModal.vacancyTitle} — True North Talent`)}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-medium transition-colors"
                  onClick={() => setSendModal(null)}
                >
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

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CandidateProfile, TimelineEntry, FollowUp,
  TimestampedNote, CandidateDocument, CandidateVacancyMatch, Vacancy,
} from '@/lib/types';
import { storage } from '@/lib/storage';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import VacancyStageBar from '@/components/VacancyStageBar';
import {
  ArrowLeft, Edit, Mail, Phone, MapPin, Link, Briefcase,
  Upload, Download, X, Check, ChevronDown, UserCircle, FileText, GitMerge, ListChecks,
  Bell, Clock, Moon, Pin, Trash2, Plus, Search, Zap, Star, CalendarDays,
} from 'lucide-react';
import Timeline from '@/components/Timeline';
import EmailComposer from '@/components/EmailComposer';
import AddToPipelineModal from '@/components/AddToPipelineModal';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  passive: 'bg-amber-500/20 text-amber-400',
  placed: 'bg-purple-500/20 text-purple-300',
};

const MATCH_STATUS_BADGE: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-400',
  'on-hold': 'bg-amber-500/20 text-amber-400',
  rejected: 'bg-red-500/20 text-red-400',
  placed: 'bg-purple-500/20 text-purple-300',
};

const BRANCHES = ['IT', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Healthcare', 'Legal', 'HR', 'Other'];
const DOC_LABELS: { display: string; value: CandidateDocument['label'] }[] = [
  { display: 'CV', value: 'cv' },
  { display: 'Motivation Letter', value: 'motivation' },
  { display: 'Portfolio', value: 'portfolio' },
  { display: 'References', value: 'references' },
  { display: 'Other', value: 'other' },
];

type Tab = 'Overview' | 'Notes' | 'Documents' | 'Matches';
const TABS: Tab[] = ['Overview', 'Notes', 'Documents', 'Matches'];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [pipelineAdded, setPipelineAdded] = useState(false);
  const [shortlistedInPipeline, setShortlistedInPipeline] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [editForm, setEditForm] = useState<Partial<CandidateProfile>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Notes tab
  const [noteInput, setNoteInput] = useState('');

  // Documents tab
  const [docLabel, setDocLabel] = useState<CandidateDocument['label']>('cv');

  // Matches tab
  const [matches, setMatches] = useState<CandidateVacancyMatch[]>([]);
  const [matchSearch, setMatchSearch] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchEdits, setMatchEdits] = useState<Record<string, Partial<CandidateVacancyMatch>>>({});

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const candidateRef = useRef<CandidateProfile | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      db.getCandidateProfiles(),
      db.getVacancies(),
      db.getFollowUps(),
      db.getCandidates(),
      db.getMatchesByCandidate(id),
    ]).then(([profiles, vacancyList, allFollowUps, pipelineCandidates, candidateMatches]) => {
      const found = profiles.find(p => p.id === id);
      if (found) {
        setCandidate(found);
        candidateRef.current = found;
        if (found.updatedAt) setLastSaved(new Date(found.updatedAt));
        // Track recent item
        storage.addRecentItem({
          type: 'candidate',
          id: found.id,
          name: `${found.firstName} ${found.lastName}`,
          href: `/candidates/${found.id}`,
          viewedAt: new Date().toISOString(),
        });
      }
      setVacancies(vacancyList);
      setMatches(candidateMatches);
      const activeFollowUp = allFollowUps.find(f => f.contactId === id && f.status !== 'done');
      setFollowUp(activeFollowUp || null);
      const alreadyIn = pipelineCandidates.some(c => (c as any).profileId === id);
      setPipelineAdded(alreadyIn);
      const isShortlisted = pipelineCandidates.some(c => (c as any).profileId === id && c.status === 'shortlisted');
      setShortlistedInPipeline(isShortlisted);
    });
    storage.setLastViewedCandidate(id);
  }, [id]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const persist = useCallback((updated: CandidateProfile) => {
    db.getCandidateProfiles().then(profiles => {
      const newProfiles = profiles.map(p => p.id === updated.id ? updated : p);
      db.saveCandidateProfiles(newProfiles);
    });
    setCandidate(updated);
    candidateRef.current = updated;
  }, []);

  const flashSaved = () => {
    const now = new Date();
    setLastSaved(now);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  // ── Timeline helpers ──────────────────────────────────────────────────────
  const addTimelineEntry = useCallback((entry: TimelineEntry) => {
    const current = candidateRef.current;
    if (!current) return;
    const updated = { ...current, timeline: [...current.timeline, entry], updatedAt: new Date().toISOString() };
    persist(updated);
  }, [persist]);

  const handleAddNote = (note: string) => {
    const entry: TimelineEntry = { id: uuidv4(), type: 'note', content: note, createdAt: new Date().toISOString() };
    addTimelineEntry(entry);
  };

  const handleStatusChange = (newStatus: CandidateProfile['status']) => {
    const current = candidateRef.current;
    if (!current) return;
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'status_change',
      content: `Status changed from ${current.status} to ${newStatus}`,
      createdAt: new Date().toISOString(),
      metadata: { from: current.status, to: newStatus },
    };
    persist({ ...current, status: newStatus, timeline: [...current.timeline, entry], updatedAt: new Date().toISOString() });
    setShowStatusMenu(false);
  };

  // ── Notes tab ────────────────────────────────────────────────────────────
  const handleAddTimedNote = () => {
    const content = noteInput.trim();
    if (!content || !candidateRef.current) return;
    const newNote: TimestampedNote = { id: uuidv4(), content, createdAt: new Date().toISOString(), pinned: false };
    const current = candidateRef.current;
    const updated = { ...current, timedNotes: [newNote, ...(current.timedNotes || [])], updatedAt: new Date().toISOString() };
    persist(updated);
    setNoteInput('');
    flashSaved();
  };

  const handlePinNote = (noteId: string) => {
    const current = candidateRef.current;
    if (!current) return;
    const updated = {
      ...current,
      timedNotes: (current.timedNotes || []).map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n),
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
  };

  const handleDeleteNote = (noteId: string) => {
    const current = candidateRef.current;
    if (!current) return;
    const updated = {
      ...current,
      timedNotes: (current.timedNotes || []).filter(n => n.id !== noteId),
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
  };

  const sortedNotes = (candidate?.timedNotes || []).slice().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // ── Documents tab ────────────────────────────────────────────────────────
  const handleFileUpload = async (type: 'cv' | 'motivation', file: File) => {
    const current = candidateRef.current;
    if (!current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const entry: TimelineEntry = {
        id: uuidv4(),
        type: type === 'cv' ? 'cv_upload' : 'motivation_upload',
        content: `${type === 'cv' ? 'CV' : 'Motivation letter'} uploaded: ${file.name}`,
        createdAt: new Date().toISOString(),
      };
      const updated: CandidateProfile = {
        ...current,
        ...(type === 'cv' ? { cvFileName: file.name, cvData: base64 } : { motivationFileName: file.name, motivationData: base64 }),
        timeline: [...current.timeline, entry],
        updatedAt: new Date().toISOString(),
      };
      persist(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleMultiDocUpload = (file: File, label: CandidateDocument['label']) => {
    const current = candidateRef.current;
    if (!current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const newDoc: CandidateDocument = {
        id: uuidv4(),
        label,
        fileName: file.name,
        data: base64,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      };
      const updated: CandidateProfile = {
        ...current,
        documents: [...(current.documents || []), newDoc],
        updatedAt: new Date().toISOString(),
      };
      persist(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDoc = (docId: string) => {
    const current = candidateRef.current;
    if (!current) return;
    const updated = { ...current, documents: (current.documents || []).filter(d => d.id !== docId), updatedAt: new Date().toISOString() };
    persist(updated);
  };

  const handleDownload = (type: 'cv' | 'motivation') => {
    if (!candidate) return;
    const data = type === 'cv' ? candidate.cvData : candidate.motivationData;
    const fileName = type === 'cv' ? candidate.cvFileName : candidate.motivationFileName;
    if (!data || !fileName) return;
    const link = document.createElement('a');
    link.href = `data:application/octet-stream;base64,${data}`;
    link.download = fileName;
    link.click();
  };

  const handleDownloadDoc = (doc: CandidateDocument) => {
    const link = document.createElement('a');
    link.href = `data:${doc.mimeType};base64,${doc.data}`;
    link.download = doc.fileName;
    link.click();
  };

  // ── Matches tab ──────────────────────────────────────────────────────────
  const filteredVacanciesForMatch = vacancies.filter(v => {
    const q = matchSearch.toLowerCase();
    if (!q) return true;
    return `${v.title} ${v.company}`.toLowerCase().includes(q);
  }).filter(v => !matches.some(m => m.vacancyId === v.id));

  const handleAddMatch = async (vacancyId: string) => {
    const newMatch: CandidateVacancyMatch = {
      id: uuidv4(),
      candidateId: id,
      vacancyId,
      status: 'active',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveMatch(newMatch);
    setMatches(prev => [...prev, newMatch]);
    setMatchSearch('');
  };

  const handleUpdateMatch = async (matchId: string) => {
    const edits = matchEdits[matchId];
    if (!edits) return;
    const existing = matches.find(m => m.id === matchId);
    if (!existing) return;
    const updated: CandidateVacancyMatch = { ...existing, ...edits, updatedAt: new Date().toISOString() };
    await db.saveMatch(updated);
    setMatches(prev => prev.map(m => m.id === matchId ? updated : m));
    setMatchEdits(prev => { const n = { ...prev }; delete n[matchId]; return n; });
  };

  const handleDeleteMatch = async (matchId: string) => {
    await db.deleteMatch(matchId);
    setMatches(prev => prev.filter(m => m.id !== matchId));
    if (expandedMatchId === matchId) setExpandedMatchId(null);
  };

  const patchMatchEdit = (matchId: string, patch: Partial<CandidateVacancyMatch>) => {
    setMatchEdits(prev => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));
  };

  // ── Pipeline helpers ─────────────────────────────────────────────────────
  const moveToShortlist = () => {
    db.getCandidates().then(all => {
      const linked = all.find(c => (c as any).profileId === id);
      if (linked) {
        db.saveCandidates(all.map(c => c.id === linked.id ? { ...c, status: 'shortlisted' as const } : c));
        setShortlistedInPipeline(true);
        setPipelineAdded(true);
      } else if (candidate) {
        const newEntry = {
          id: uuidv4(),
          profileId: id,
          firstName: `${candidate.firstName} ${candidate.lastName}`.trim(),
          currentRole: candidate.jobTitle || '',
          currentCompany: '',
          skills: candidate.branch ? [candidate.branch] : [],
          status: 'shortlisted' as const,
          createdAt: new Date().toISOString(),
        };
        db.saveCandidates([...all, newEntry]);
        setShortlistedInPipeline(true);
        setPipelineAdded(true);
      }
    });
  };

  // ── Edit modal ───────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (!candidate) return;
    setEditForm({ ...candidate });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    const current = candidateRef.current;
    if (!current || !editForm) return;
    persist({ ...current, ...editForm, updatedAt: new Date().toISOString() });
    setShowEdit(false);
  };

  // ── Follow-up ────────────────────────────────────────────────────────────
  const refreshFollowUp = useCallback(() => {
    db.getFollowUps().then(all => setFollowUp(all.find(f => f.contactId === id && f.status !== 'done') || null));
  }, [id]);

  const handleMarkFollowUpDone = () => {
    if (!followUp) return;
    db.getFollowUps().then(all => {
      db.saveFollowUps(all.map(f => f.id === followUp.id ? { ...f, status: 'done' as const } : f));
      refreshFollowUp();
    });
  };

  const handleSnoozeFollowUp = () => {
    if (!followUp) return;
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 2);
    db.getFollowUps().then(all => {
      db.saveFollowUps(all.map(f => f.id === followUp.id
        ? { ...f, status: 'snoozed' as const, snoozedUntil: snoozedUntil.toISOString() }
        : f));
      refreshFollowUp();
    });
  };

  const handleEmailSent = useCallback((entry: TimelineEntry) => {
    addTimelineEntry(entry);
    setTimeout(refreshFollowUp, 100);
  }, [addTimelineEntry, refreshFollowUp]);

  if (!candidate) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/candidates')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#2D4A2D] text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Candidates
        </button>
        <div className="text-center py-20">
          <UserCircle size={40} className="mx-auto mb-3 text-[rgba(45,74,45,0.15)]" />
          <p className="text-[#94a3b8]">Candidate not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Back nav */}
      <button
        onClick={() => router.push('/candidates')}
        className="flex items-center gap-2 text-[#94a3b8] hover:text-[#2D4A2D] text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Candidates
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-3 space-y-4">

          {/* Header card */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] font-bold text-xl flex-shrink-0">
                  {candidate.firstName.charAt(0)}{candidate.lastName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#2D4A2D]">{candidate.firstName} {candidate.lastName}</h1>
                  <p className="text-[#94a3b8] text-sm mt-0.5">{candidate.jobTitle}</p>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[candidate.status]}`}>
                    {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Edit size={14} /> Edit
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl overflow-hidden">
            <div className="flex border-b border-[rgba(45,74,45,0.15)]">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    activeTab === tab
                      ? 'text-[#2D4A2D] border-b-2 border-[#2D4A2D] bg-[#2D4A2D]/5'
                      : 'text-[#6B7280] hover:text-[#94a3b8]'
                  }`}
                >
                  {tab}
                  {tab === 'Notes' && (candidate.timedNotes?.length ?? 0) > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(45,74,45,0.15)] text-[10px]">
                      {candidate.timedNotes!.length}
                    </span>
                  )}
                  {tab === 'Documents' && ((candidate.documents?.length ?? 0) + (candidate.cvData ? 1 : 0) + (candidate.motivationData ? 1 : 0)) > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(45,74,45,0.15)] text-[10px]">
                      {(candidate.documents?.length ?? 0) + (candidate.cvData ? 1 : 0) + (candidate.motivationData ? 1 : 0)}
                    </span>
                  )}
                  {tab === 'Matches' && matches.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2D4A2D]/30 text-[#2D4A2D] text-[10px]">
                      {matches.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">

              {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
              {activeTab === 'Overview' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[#2D4A2D] font-semibold text-sm mb-3">Contact Information</p>
                    <div className="space-y-2.5">
                      {candidate.email && (
                        <div className="flex items-center gap-3">
                          <Mail size={14} className="text-[#2D4A2D] flex-shrink-0" />
                          <a href={`mailto:${candidate.email}`} className="text-[#94a3b8] text-sm hover:text-[#2D4A2D] transition-colors">
                            {candidate.email}
                          </a>
                        </div>
                      )}
                      {candidate.phone && (
                        <div className="flex items-center gap-3">
                          <Phone size={14} className="text-[#2D4A2D] flex-shrink-0" />
                          <span className="text-[#94a3b8] text-sm">{candidate.phone}</span>
                        </div>
                      )}
                      {(candidate.location || candidate.postalCode) && (
                        <div className="flex items-center gap-3">
                          <MapPin size={14} className="text-[#2D4A2D] flex-shrink-0" />
                          <span className="text-[#94a3b8] text-sm">
                            {[candidate.location, candidate.postalCode].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      )}
                      {candidate.linkedin && (
                        <div className="flex items-center gap-3">
                          <Link size={14} className="text-[#2D4A2D] flex-shrink-0" />
                          <a href={candidate.linkedin} target="_blank" rel="noreferrer" className="text-[#94a3b8] text-sm hover:text-[#2D4A2D] transition-colors truncate">
                            {candidate.linkedin}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[rgba(45,74,45,0.15)]" />

                  <div>
                    <p className="text-[#2D4A2D] font-semibold text-sm mb-3">Professional Details</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] text-xs">Branch</span>
                        <span className="text-[#2D4A2D] text-sm">{candidate.branch || '—'}</span>
                      </div>
                      <div className="border-t border-[rgba(45,74,45,0.15)]" />
                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] text-xs">Salary Expectation</span>
                        <span className="text-[#2D4A2D] text-sm">
                          {candidate.salaryExpectation
                            ? `€ ${candidate.salaryExpectation.toLocaleString('nl-NL')}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── NOTES TAB ────────────────────────────────────────────── */}
              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  {/* Add note */}
                  <div className="space-y-2">
                    <textarea
                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
                      rows={3}
                      placeholder="Write a note about this candidate..."
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddTimedNote(); }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[#6B7280] text-[11px]">⌘↵ to save</span>
                      <button
                        onClick={handleAddTimedNote}
                        disabled={!noteInput.trim()}
                        className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Plus size={12} /> Add Note
                      </button>
                    </div>
                    {savedFlash && (
                      <p className="flex items-center gap-1 text-green-400 text-xs">
                        <Check size={11} /> Note saved
                      </p>
                    )}
                  </div>

                  {/* Notes list */}
                  {sortedNotes.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[#6B7280] text-sm">No notes yet. Add the first one above.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedNotes.map(note => (
                        <div
                          key={note.id}
                          className={`group relative p-3.5 rounded-lg border text-sm ${
                            note.pinned
                              ? 'bg-[#2D4A2D]/8 border-[#2D4A2D]/30'
                              : 'bg-[#FFFFFF] border-[rgba(45,74,45,0.15)]'
                          }`}
                        >
                          {note.pinned && (
                            <span className="absolute top-2 right-10 text-[10px] text-[#2D4A2D] font-semibold uppercase tracking-wider">Pinned</span>
                          )}
                          <p className="text-[#94a3b8] leading-relaxed pr-8">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock size={10} className="text-[#6B7280]" />
                            <span className="text-[#6B7280] text-[11px]">
                              {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}
                              {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {/* Actions */}
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handlePinNote(note.id)}
                              title={note.pinned ? 'Unpin' : 'Pin to top'}
                              className="p-1 rounded text-[#6B7280] hover:text-[#2D4A2D] transition-colors"
                            >
                              <Pin size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              title="Delete note"
                              className="p-1 rounded text-[#6B7280] hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENTS TAB ────────────────────────────────────────── */}
              {activeTab === 'Documents' && (
                <div className="space-y-4">
                  {/* Legacy documents (CV + Motivation) */}
                  <div className="space-y-2">
                    {[
                      { type: 'cv' as const, label: 'CV', fileName: candidate.cvFileName, hasData: !!candidate.cvData },
                      { type: 'motivation' as const, label: 'Motivation Letter', fileName: candidate.motivationFileName, hasData: !!candidate.motivationData },
                    ].map(({ type, label, fileName, hasData }) => (
                      <div key={type} className="flex items-center justify-between p-3 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText size={15} className={type === 'cv' ? 'text-[#2D4A2D]' : 'text-orange-400'} />
                          <div>
                            <p className="text-[#2D4A2D] text-sm font-medium">{label}</p>
                            <p className="text-[#6B7280] text-xs">{fileName || 'No file uploaded'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasData && (
                            <button
                              onClick={() => handleDownload(type)}
                              className="flex items-center gap-1 text-[#94a3b8] hover:text-[#2D4A2D] text-xs transition-colors"
                            >
                              <Download size={12} /> Download
                            </button>
                          )}
                          <label className="flex items-center gap-1 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors">
                            <Upload size={11} /> Upload
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(type, f); e.target.value = ''; }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Additional documents */}
                  {(candidate.documents || []).map(doc => (
                    <div key={doc.id} className="group flex items-center justify-between p-3 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} className="text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[#2D4A2D] text-sm font-medium">{doc.label}</p>
                          <p className="text-[#6B7280] text-xs truncate">{doc.fileName} · {formatBytes(doc.fileSize)}</p>
                          <p className="text-[rgba(45,74,45,0.15)] text-[10px]">
                            {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="flex items-center gap-1 text-[#94a3b8] hover:text-[#2D4A2D] text-xs transition-colors"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-[#6B7280] hover:text-red-400 text-xs transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Upload new document */}
                  <div className="border border-dashed border-[rgba(45,74,45,0.15)] rounded-lg p-4">
                    <p className="text-[#94a3b8] text-xs font-medium mb-2">Upload additional document</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={docLabel}
                        onChange={e => setDocLabel(e.target.value as CandidateDocument['label'])}
                        className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      >
                        {DOC_LABELS.map(l => <option key={l.value} value={l.value}>{l.display}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors flex-1 justify-center">
                        <Upload size={12} /> Choose file
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleMultiDocUpload(f, docLabel); e.target.value = ''; }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MATCHES TAB ──────────────────────────────────────────── */}
              {activeTab === 'Matches' && (
                <div className="space-y-4">
                  {/* Add match search */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      placeholder="Search vacancies to match..."
                      value={matchSearch}
                      onChange={e => setMatchSearch(e.target.value)}
                    />
                    {matchSearch && filteredVacanciesForMatch.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-20 max-h-48 overflow-y-auto">
                        {filteredVacanciesForMatch.slice(0, 6).map(v => (
                          <button
                            key={v.id}
                            onClick={() => handleAddMatch(v.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[rgba(45,74,45,0.15)] transition-colors text-left"
                          >
                            <Briefcase size={12} className="text-[#2D4A2D] flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[#2D4A2D] text-xs font-medium truncate">{v.title}</p>
                              <p className="text-[#6B7280] text-[11px]">{v.company}</p>
                            </div>
                            <Plus size={12} className="text-[#6B7280] flex-shrink-0 ml-auto" />
                          </button>
                        ))}
                      </div>
                    )}
                    {matchSearch && filteredVacanciesForMatch.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg p-3 z-20">
                        <p className="text-[#6B7280] text-xs">No unmatched vacancies found</p>
                      </div>
                    )}
                  </div>

                  {/* Matches list */}
                  {matches.length === 0 ? (
                    <div className="py-8 text-center">
                      <Briefcase size={28} className="mx-auto mb-2 text-[rgba(45,74,45,0.15)]" />
                      <p className="text-[#6B7280] text-sm">No vacancy matches yet.</p>
                      <p className="text-[#9CA3AF] text-xs mt-1">Search above to link this candidate to a vacancy.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matches.map(match => {
                        const vacancy = vacancies.find(v => v.id === match.vacancyId);
                        if (!vacancy) return null;
                        const isExpanded = expandedMatchId === match.id;
                        const edits = matchEdits[match.id] || {};
                        const current = { ...match, ...edits };
                        const hasEdits = Object.keys(matchEdits[match.id] || {}).length > 0;

                        return (
                          <div key={match.id} className="border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden">
                            {/* Match header */}
                            <div className="flex items-center gap-3 p-3 bg-[#FFFFFF]">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[#2D4A2D] text-sm font-medium truncate">{vacancy.title}</p>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${MATCH_STATUS_BADGE[current.status]}`}>
                                    {current.status === 'on-hold' ? 'On Hold' : current.status.charAt(0).toUpperCase() + current.status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-[#6B7280] text-xs">{vacancy.company}</p>
                                <div className="mt-1.5 max-w-xs">
                                  <VacancyStageBar stage={vacancy.stage || 'intake'} compact />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => router.push(`/screening?candidateId=${id}&vacancyId=${vacancy.id}`)}
                                  title="Run AI Screening"
                                  className="flex items-center gap-1 bg-[#2D4A2D]/20 hover:bg-[#2D4A2D]/30 text-[#2D4A2D] px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                                >
                                  <Zap size={11} /> Screen
                                </button>
                                <button
                                  onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                  className="text-[#6B7280] hover:text-[#2D4A2D] p-1.5 rounded-lg hover:bg-[rgba(45,74,45,0.15)] transition-colors"
                                >
                                  <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMatch(match.id)}
                                  className="text-[#6B7280] hover:text-red-400 p-1.5 rounded-lg hover:bg-[rgba(45,74,45,0.15)] transition-colors"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="p-4 border-t border-[rgba(45,74,45,0.15)] bg-[#081525] space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Status */}
                                  <div>
                                    <label className="block text-[#94a3b8] text-[11px] font-medium mb-1">Match Status</label>
                                    <select
                                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                      value={current.status}
                                      onChange={e => patchMatchEdit(match.id, { status: e.target.value as CandidateVacancyMatch['status'] })}
                                    >
                                      <option value="active">Active</option>
                                      <option value="on-hold">On Hold</option>
                                      <option value="rejected">Rejected</option>
                                      <option value="placed">Placed</option>
                                    </select>
                                  </div>
                                  {/* Match score */}
                                  <div>
                                    <label className="block text-[#94a3b8] text-[11px] font-medium mb-1">Match Score</label>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                        value={current.matchScore ?? ''}
                                        placeholder="0–100"
                                        onChange={e => patchMatchEdit(match.id, { matchScore: e.target.value ? parseInt(e.target.value) : undefined })}
                                      />
                                      <Star size={12} className="text-[#6B7280] flex-shrink-0" />
                                    </div>
                                  </div>
                                </div>

                                {/* Interview */}
                                <div>
                                  <p className="text-[#94a3b8] text-[11px] font-medium mb-2">Interview</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[#6B7280] text-[10px] mb-1">Date</label>
                                      <input
                                        type="date"
                                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                        value={current.interviewDate || ''}
                                        onChange={e => patchMatchEdit(match.id, { interviewDate: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[#6B7280] text-[10px] mb-1">Time</label>
                                      <input
                                        type="time"
                                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                        value={current.interviewTime || ''}
                                        onChange={e => patchMatchEdit(match.id, { interviewTime: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[#6B7280] text-[10px] mb-1">Type</label>
                                      <select
                                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                        value={current.interviewType || ''}
                                        onChange={e => patchMatchEdit(match.id, { interviewType: (e.target.value || undefined) as CandidateVacancyMatch['interviewType'] })}
                                      >
                                        <option value="">— None —</option>
                                        <option value="phone">Phone</option>
                                        <option value="teams">Teams / Video</option>
                                        <option value="on-site">On-site</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[#6B7280] text-[10px] mb-1">Outcome</label>
                                      <select
                                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                        value={current.interviewOutcome || ''}
                                        onChange={e => patchMatchEdit(match.id, { interviewOutcome: (e.target.value || undefined) as CandidateVacancyMatch['interviewOutcome'] })}
                                      >
                                        <option value="">— Pending —</option>
                                        <option value="positive">Positive</option>
                                        <option value="negative">Negative</option>
                                        <option value="second-interview">Second Interview</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <label className="block text-[#6B7280] text-[10px] mb-1">Interview Notes</label>
                                    <textarea
                                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
                                      rows={2}
                                      placeholder="Notes from the interview..."
                                      value={current.interviewNotes || ''}
                                      onChange={e => patchMatchEdit(match.id, { interviewNotes: e.target.value })}
                                    />
                                  </div>
                                </div>

                                {/* Match notes */}
                                <div>
                                  <label className="block text-[#94a3b8] text-[11px] font-medium mb-1">Match Notes</label>
                                  <textarea
                                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-2 py-1.5 text-[#2D4A2D] text-xs placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
                                    rows={2}
                                    placeholder="Notes about this match..."
                                    value={current.notes || ''}
                                    onChange={e => patchMatchEdit(match.id, { notes: e.target.value })}
                                  />
                                </div>

                                {hasEdits && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateMatch(match.id)}
                                      className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white text-xs py-2 rounded-lg font-medium transition-colors"
                                    >
                                      Save Changes
                                    </button>
                                    <button
                                      onClick={() => setMatchEdits(prev => { const n = { ...prev }; delete n[match.id]; return n; })}
                                      className="bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] text-xs px-4 py-2 rounded-lg transition-colors"
                                    >
                                      Discard
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="xl:col-span-2 space-y-4">
          {/* Quick actions */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
            <p className="text-[#2D4A2D] font-semibold text-sm mb-3">Quick Actions</p>
            <div className="space-y-2">
              <button
                onClick={() => setShowEmail(true)}
                className="w-full flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Mail size={14} /> Send Email
              </button>

              <button
                onClick={() => router.push(
                  `/calendar?new=1&type=interview&candidateId=${id}&candidateName=${encodeURIComponent(`${candidate.firstName} ${candidate.lastName}`)}`
                )}
                className="w-full flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <CalendarDays size={14} /> Schedule Interview
              </button>

              {pipelineAdded ? (
                <div className="w-full flex items-center gap-2 bg-[#4CAF50]/10 border border-[#4CAF50]/30 text-[#4CAF50] px-4 py-2 rounded-lg text-sm">
                  <Check size={14} /> In Pipeline
                </div>
              ) : (
                <button
                  onClick={() => setShowPipelineModal(true)}
                  className="w-full flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <GitMerge size={14} /> Add to Pipeline
                </button>
              )}

              {shortlistedInPipeline ? (
                <div className="w-full flex items-center gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] px-4 py-2 rounded-lg text-sm">
                  <ListChecks size={14} /> On Shortlist
                </div>
              ) : (
                <button
                  onClick={moveToShortlist}
                  className="w-full flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <ListChecks size={14} /> Move to Shortlist
                </button>
              )}

              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(s => !s)}
                  className="w-full flex items-center justify-between gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} />
                    Change Status
                  </div>
                  <ChevronDown size={14} />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-10">
                    {(['active', 'passive', 'placed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[rgba(45,74,45,0.15)] ${candidate.status === s ? 'text-[#2D4A2D]' : 'text-[#94a3b8]'}`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                        {candidate.status === s && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Follow-up */}
          {followUp && (
            <div className={`bg-[#FFFFFF] border rounded-xl p-4 ${(() => {
              const effectiveDue = followUp.snoozedUntil ? new Date(followUp.snoozedUntil) : new Date(followUp.dueDate);
              const diffDays = Math.floor((effectiveDue.getTime() - Date.now()) / 86400000);
              if (followUp.status === 'snoozed') return 'border-[rgba(45,74,45,0.15)]';
              return diffDays < 0 ? 'border-red-500/30' : diffDays === 0 ? 'border-amber-500/30' : 'border-[rgba(45,74,45,0.15)]';
            })()}`}>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-[#2D4A2D]" />
                <p className="text-[#2D4A2D] font-semibold text-sm">Follow-up Reminder</p>
              </div>
              {(() => {
                const effectiveDate = followUp.snoozedUntil ? new Date(followUp.snoozedUntil) : new Date(followUp.dueDate);
                const diffDays = Math.floor((effectiveDate.getTime() - Date.now()) / 86400000);
                const daysSince = Math.floor((Date.now() - new Date(followUp.lastContactDate).getTime()) / 86400000);
                let statusLabel = '';
                let statusColor = '';
                if (diffDays < 0) { statusLabel = `${Math.abs(diffDays)}d overdue`; statusColor = 'text-red-400'; }
                else if (diffDays === 0) { statusLabel = 'Due today'; statusColor = 'text-amber-400'; }
                else { statusLabel = `Due in ${diffDays}d`; statusColor = 'text-[#94a3b8]'; }
                return (
                  <>
                    <p className="text-[#94a3b8] text-xs mb-1">Re: {followUp.originalEmailSubject}</p>
                    <p className="text-[#6B7280] text-xs mb-3">
                      {daysSince === 0 ? 'Contacted today' : `${daysSince}d since last contact`} · <span className={statusColor}>{statusLabel}</span>
                      {followUp.status === 'snoozed' && ' · Snoozed'}
                    </p>
                  </>
                );
              })()}
              <div className="flex gap-2">
                <button
                  onClick={handleSnoozeFollowUp}
                  className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-3 py-1.5 rounded-md text-xs transition-colors"
                >
                  <Moon size={11} /> Snooze 2d
                </button>
                <button
                  onClick={handleMarkFollowUpDone}
                  className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.15)] hover:bg-[#4CAF50]/20 text-[#94a3b8] hover:text-[#4CAF50] px-3 py-1.5 rounded-md text-xs transition-colors"
                >
                  <Check size={11} /> Mark Done
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <Timeline entries={candidate.timeline} onAddNote={handleAddNote} />
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[#2D4A2D] font-semibold">Edit Candidate</h2>
              <button onClick={() => setShowEdit(false)} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">First Name</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.firstName || ''} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Last Name</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.lastName || ''} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Email</label>
                  <input type="email" className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Phone</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Postal Code</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.postalCode || ''} onChange={e => setEditForm(f => ({ ...f, postalCode: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">LinkedIn</label>
                <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.linkedin || ''} onChange={e => setEditForm(f => ({ ...f, linkedin: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Job Title</label>
                  <input className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.jobTitle || ''} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Branch</label>
                  <select className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.branch || 'IT'} onChange={e => setEditForm(f => ({ ...f, branch: e.target.value }))}>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Salary Expectation (€)</label>
                  <input type="number" className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.salaryExpectation ?? ''} onChange={e => setEditForm(f => ({ ...f, salaryExpectation: e.target.value ? parseInt(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Status</label>
                  <select className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors" value={editForm.status || 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as CandidateProfile['status'] }))}>
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleEditSave} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium py-2.5 rounded-lg transition-colors text-sm">Save Changes</button>
              <button onClick={() => setShowEdit(false)} className="flex-1 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={showEmail}
        onClose={() => setShowEmail(false)}
        defaultTo={candidate.email}
        vars={{ candidateName: `${candidate.firstName} ${candidate.lastName}`, jobTitle: candidate.jobTitle }}
        followUpConfig={{ contactType: 'candidate', contactId: candidate.id, contactName: `${candidate.firstName} ${candidate.lastName}`, company: candidate.branch || '' }}
        onSent={handleEmailSent}
      />

      {/* Add to Pipeline modal */}
      {showPipelineModal && (
        <AddToPipelineModal
          profile={candidate}
          vacancies={vacancies}
          onClose={() => setShowPipelineModal(false)}
          onAdded={() => setPipelineAdded(true)}
        />
      )}
    </div>
  );
}

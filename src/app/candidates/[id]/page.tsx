'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CandidateProfile, TimelineEntry } from '@/lib/types';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowLeft, Edit, Mail, Phone, MapPin, Link, Briefcase,
  Upload, Download, X, Check, ChevronDown, UserCircle, FileText, GitMerge, ListChecks,
} from 'lucide-react';
import Timeline from '@/components/Timeline';
import EmailComposer from '@/components/EmailComposer';
import AddToPipelineModal from '@/components/AddToPipelineModal';
import { Vacancy } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  passive: 'bg-amber-500/20 text-amber-400',
  placed: 'bg-purple-500/20 text-purple-300',
};

const BRANCHES = ['IT', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Healthcare', 'Legal', 'HR', 'Other'];

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [pipelineAdded, setPipelineAdded] = useState(false);
  const [shortlistedInPipeline, setShortlistedInPipeline] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CandidateProfile>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const candidateRef = useRef<CandidateProfile | null>(null);

  useEffect(() => {
    const profiles = storage.getCandidateProfiles();
    const found = profiles.find(p => p.id === id);
    if (found) {
      setCandidate(found);
      candidateRef.current = found;
      setNotesValue(found.notes || '');
      if (found.updatedAt) setLastSaved(new Date(found.updatedAt));
    }
    setVacancies(storage.getVacancies());
    // Track last viewed so Pipeline page can suggest adding them
    storage.setLastViewedCandidate(id);
    // Check if already in pipeline
    const pipelineCandidates = storage.getCandidates();
    const alreadyIn = pipelineCandidates.some(c => (c as any).profileId === id);
    setPipelineAdded(alreadyIn);
    const isShortlisted = pipelineCandidates.some(c => (c as any).profileId === id && c.status === 'shortlisted');
    setShortlistedInPipeline(isShortlisted);
  }, [id]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  // Close status menu on outside click
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
    const profiles = storage.getCandidateProfiles();
    const newProfiles = profiles.map(p => p.id === updated.id ? updated : p);
    storage.saveCandidateProfiles(newProfiles);
    setCandidate(updated);
    candidateRef.current = updated;
  }, []);

  const handleNotesChange = (value: string) => {
    setNotesValue(value);
    // Debounce: save 1 second after the user stops typing
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const current = candidateRef.current;
      if (!current) return;
      const now = new Date();
      const updated = { ...current, notes: value, updatedAt: now.toISOString() };
      persist(updated);
      setLastSaved(now);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }, 1000);
  };

  const addTimelineEntry = useCallback((entry: TimelineEntry) => {
    if (!candidate) return;
    const updated = {
      ...candidate,
      timeline: [...candidate.timeline, entry],
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
  }, [candidate, persist]);

  const handleAddNote = (note: string) => {
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'note',
      content: note,
      createdAt: new Date().toISOString(),
    };
    addTimelineEntry(entry);
  };

  const handleStatusChange = (newStatus: CandidateProfile['status']) => {
    if (!candidate) return;
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'status_change',
      content: `Status changed from ${candidate.status} to ${newStatus}`,
      createdAt: new Date().toISOString(),
      metadata: { from: candidate.status, to: newStatus },
    };
    const updated = {
      ...candidate,
      status: newStatus,
      timeline: [...candidate.timeline, entry],
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
    setShowStatusMenu(false);
  };

  const handleFileUpload = async (type: 'cv' | 'motivation', file: File) => {
    if (!candidate) return;
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
        ...candidate,
        ...(type === 'cv' ? { cvFileName: file.name, cvData: base64 } : { motivationFileName: file.name, motivationData: base64 }),
        timeline: [...candidate.timeline, entry],
        updatedAt: new Date().toISOString(),
      };
      persist(updated);
    };
    reader.readAsDataURL(file);
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

  const moveToShortlist = () => {
    const all = storage.getCandidates();
    const linked = all.find(c => (c as any).profileId === id);
    if (linked) {
      const updated = all.map(c => c.id === linked.id ? { ...c, status: 'shortlisted' as const } : c);
      storage.saveCandidates(updated);
      setShortlistedInPipeline(true);
      setPipelineAdded(true);
    } else if (candidate) {
      // Not in pipeline yet — add directly as shortlisted
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
      storage.saveCandidates([...all, newEntry]);
      setShortlistedInPipeline(true);
      setPipelineAdded(true);
    }
  };

  const handleEdit = () => {
    if (!candidate) return;
    setEditForm({ ...candidate });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!candidate || !editForm) return;
    const updated: CandidateProfile = {
      ...candidate,
      ...editForm,
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
    setShowEdit(false);
  };

  if (!candidate) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/candidates')} className="flex items-center gap-2 text-[#94a3b8] hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Candidates
        </button>
        <div className="text-center py-20">
          <UserCircle size={40} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-[#94a3b8]">Candidate not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Top nav */}
      <button
        onClick={() => router.push('/candidates')}
        className="flex items-center gap-2 text-[#94a3b8] hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Candidates
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-3 space-y-4">
          {/* Header card */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#7C3AED30] flex items-center justify-center text-[#7C3AED] font-bold text-xl flex-shrink-0">
                  {candidate.firstName.charAt(0)}{candidate.lastName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {candidate.firstName} {candidate.lastName}
                  </h1>
                  <p className="text-[#94a3b8] text-sm mt-0.5">{candidate.jobTitle}</p>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[candidate.status]}`}>
                    {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Edit size={14} /> Edit
              </button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-4">Contact Information</p>
            <div className="space-y-3">
              {candidate.email && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[#7C3AED] flex-shrink-0" />
                  <a href={`mailto:${candidate.email}`} className="text-[#94a3b8] text-sm hover:text-white transition-colors">
                    {candidate.email}
                  </a>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[#7C3AED] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-sm">{candidate.phone}</span>
                </div>
              )}
              {(candidate.location || candidate.postalCode) && (
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-[#7C3AED] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-sm">
                    {[candidate.location, candidate.postalCode].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              {candidate.linkedin && (
                <div className="flex items-center gap-3">
                  <Link size={14} className="text-[#7C3AED] flex-shrink-0" />
                  <a href={candidate.linkedin} target="_blank" rel="noreferrer" className="text-[#94a3b8] text-sm hover:text-white transition-colors truncate">
                    {candidate.linkedin}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Professional */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-4">Professional Details</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs">Branch</span>
                <span className="text-white text-sm">{candidate.branch || '—'}</span>
              </div>
              <div className="border-t border-[#1e3a5f]" />
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs">Salary Expectation</span>
                <span className="text-white text-sm">
                  {candidate.salaryExpectation
                    ? `€ ${candidate.salaryExpectation.toLocaleString('nl-NL')}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Notes</p>
              {savedFlash && (
                <span className="flex items-center gap-1 text-green-400 text-xs animate-fade-in">
                  <Check size={12} /> Saved
                </span>
              )}
            </div>
            <textarea
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] resize-none transition-colors"
              rows={5}
              placeholder="Add internal notes about this candidate..."
              value={notesValue}
              onChange={e => handleNotesChange(e.target.value)}
            />
            <p className="text-[#4a6fa5] text-[11px] mt-1.5">
              {lastSaved
                ? `Last saved ${lastSaved.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} on ${lastSaved.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                : 'Not saved yet — start typing to save automatically'}
            </p>
          </div>

          {/* Documents */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-4">Documents</p>
            <div className="space-y-4">
              {/* CV */}
              <div className="flex items-center justify-between p-3 bg-[#0a1628] border border-[#1e3a5f] rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#7C3AED]" />
                  <div>
                    <p className="text-white text-sm font-medium">CV</p>
                    {candidate.cvFileName ? (
                      <p className="text-[#94a3b8] text-xs">{candidate.cvFileName}</p>
                    ) : (
                      <p className="text-[#4a6fa5] text-xs">No file uploaded</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {candidate.cvData && (
                    <button
                      onClick={() => handleDownload('cv')}
                      className="flex items-center gap-1 text-[#94a3b8] hover:text-white text-xs transition-colors"
                    >
                      <Download size={13} /> Download
                    </button>
                  )}
                  <label className="flex items-center gap-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors">
                    <Upload size={12} /> Upload
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload('cv', f); e.target.value = ''; }}
                    />
                  </label>
                </div>
              </div>

              {/* Motivation */}
              <div className="flex items-center justify-between p-3 bg-[#0a1628] border border-[#1e3a5f] rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-orange-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Motivation Letter</p>
                    {candidate.motivationFileName ? (
                      <p className="text-[#94a3b8] text-xs">{candidate.motivationFileName}</p>
                    ) : (
                      <p className="text-[#4a6fa5] text-xs">No file uploaded</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {candidate.motivationData && (
                    <button
                      onClick={() => handleDownload('motivation')}
                      className="flex items-center gap-1 text-[#94a3b8] hover:text-white text-xs transition-colors"
                    >
                      <Download size={13} /> Download
                    </button>
                  )}
                  <label className="flex items-center gap-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors">
                    <Upload size={12} /> Upload
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload('motivation', f); e.target.value = ''; }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="xl:col-span-2 space-y-4">
          {/* Quick actions */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-4">
            <p className="text-white font-semibold text-sm mb-3">Quick Actions</p>
            <div className="space-y-2">
              <button
                onClick={() => setShowEmail(true)}
                className="w-full flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Mail size={14} /> Send Email
              </button>

              {pipelineAdded ? (
                <div className="w-full flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] px-4 py-2 rounded-lg text-sm">
                  <Check size={14} /> In Pipeline
                </div>
              ) : (
                <button
                  onClick={() => setShowPipelineModal(true)}
                  className="w-full flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
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
                  className="w-full flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <ListChecks size={14} /> Move to Shortlist
                </button>
              )}

              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(s => !s)}
                  className="w-full flex items-center justify-between gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} />
                    Change Status
                  </div>
                  <ChevronDown size={14} />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg overflow-hidden z-10">
                    {(['active', 'passive', 'placed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#1e3a5f] ${candidate.status === s ? 'text-[#7C3AED]' : 'text-[#94a3b8]'}`}
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

          {/* Timeline */}
          <Timeline
            entries={candidate.timeline}
            onAddNote={handleAddNote}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Edit Candidate</h2>
              <button onClick={() => setShowEdit(false)} className="text-[#94a3b8] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">First Name</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.firstName || ''}
                    onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Last Name</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.lastName || ''}
                    onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.email || ''}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Phone</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.phone || ''}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.location || ''}
                    onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Postal Code</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.postalCode || ''}
                    onChange={e => setEditForm(f => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">LinkedIn</label>
                <input
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                  value={editForm.linkedin || ''}
                  onChange={e => setEditForm(f => ({ ...f, linkedin: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Job Title</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.jobTitle || ''}
                    onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Branch</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.branch || 'IT'}
                    onChange={e => setEditForm(f => ({ ...f, branch: e.target.value }))}
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Salary Expectation (€)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.salaryExpectation ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, salaryExpectation: e.target.value ? parseInt(e.target.value) : undefined }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Status</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={editForm.status || 'active'}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as CandidateProfile['status'] }))}
                  >
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleEditSave} className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                Save Changes
              </button>
              <button onClick={() => setShowEdit(false)} className="flex-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-colors text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={showEmail}
        onClose={() => setShowEmail(false)}
        defaultTo={candidate.email}
        vars={{
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          jobTitle: candidate.jobTitle,
        }}
        onSent={addTimelineEntry}
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

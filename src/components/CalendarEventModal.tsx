'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarEvent, CalendarEventType, EVENT_COLORS, CandidateProfile, Vacancy, Client } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { X, Search, Trash2, MapPin, FileText, Clock, Bell } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  prefill?: Partial<CalendarEvent>;
  candidates: CandidateProfile[];
  vacancies: Vacancy[];
  clients: Client[];
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  interview: 'Interview',
  'client-call': 'Client Call',
  'follow-up': 'Follow-up',
  placement: 'Placement / Offer',
  other: 'Other',
};

function toLocalDateTimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeValue(value: string): string {
  return new Date(value).toISOString();
}

export default function CalendarEventModal({ isOpen, onClose, event, prefill, candidates, vacancies, clients, onSave, onDelete }: Props) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 30) * 30, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60000);

  const emptyForm = (): CalendarEvent => ({
    id: uuidv4(),
    title: '',
    type: 'interview',
    startTime: defaultStart.toISOString(),
    endTime: defaultEnd.toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...prefill,
  });

  const [form, setForm] = useState<CalendarEvent>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Searchable dropdowns
  const [candidateSearch, setCandidateSearch] = useState('');
  const [vacancySearch, setVacancySearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showCandidateDrop, setShowCandidateDrop] = useState(false);
  const [showVacancyDrop, setShowVacancyDrop] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (event) {
      setForm({ ...event });
      setCandidateSearch(event.candidateName || '');
      setVacancySearch(event.vacancyTitle || '');
      setClientSearch(event.clientName || '');
    } else {
      const f = emptyForm();
      setForm(f);
      setCandidateSearch(prefill?.candidateName || '');
      setVacancySearch(prefill?.vacancyTitle || '');
      setClientSearch(prefill?.clientName || '');
    }
    setShowCandidateDrop(false);
    setShowVacancyDrop(false);
    setShowClientDrop(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen, onClose]);

  const patch = (p: Partial<CalendarEvent>) => setForm(f => ({ ...f, ...p, updatedAt: new Date().toISOString() }));

  const filteredCandidates = candidates.filter(c =>
    `${c.firstName} ${c.lastName} ${c.jobTitle}`.toLowerCase().includes(candidateSearch.toLowerCase())
  ).slice(0, 6);

  const filteredVacancies = vacancies.filter(v =>
    `${v.title} ${v.company}`.toLowerCase().includes(vacancySearch.toLowerCase())
  ).slice(0, 6);

  const filteredClients = clients.filter(c =>
    `${c.companyName} ${c.contactName}`.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 6);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete || !event) return;
    setDeleting(true);
    try { await onDelete(event.id); onClose(); }
    finally { setDeleting(false); }
  };

  const colors = EVENT_COLORS[form.type];

  return (
    <AnimatePresence>
    {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60"
        style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(45,74,45,0.12)' }}>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.solid}`} />
            <h2 className="text-[#2D4A2D] font-semibold text-sm">{event ? 'Edit Event' : 'New Event'}</h2>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(EVENT_COLORS) as CalendarEventType[]).map(t => {
              const c = EVENT_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => patch({ type: t })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    form.type === t ? `${c.bg} ${c.text} ${c.border}` : 'bg-[#FFFFFF] text-[#6B7280] border-[rgba(45,74,45,0.15)] hover:border-[#2a4a7f]'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${c.solid}`} />
                  {EVENT_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          {/* Title */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Title *</label>
            <input
              autoFocus
              className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
              placeholder={`e.g. Interview with John Doe`}
              value={form.title}
              onChange={e => patch({ title: e.target.value })}
            />
          </div>

          {/* Date/time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Start</label>
              <input
                type="datetime-local"
                className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                value={toLocalDateTimeValue(form.startTime)}
                onChange={e => {
                  const start = fromLocalDateTimeValue(e.target.value);
                  const startMs = new Date(start).getTime();
                  const endMs = new Date(form.endTime).getTime();
                  const duration = endMs - new Date(form.startTime).getTime();
                  patch({ startTime: start, endTime: new Date(startMs + Math.max(duration, 1800000)).toISOString() });
                }}
              />
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">End</label>
              <input
                type="datetime-local"
                className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                value={toLocalDateTimeValue(form.endTime)}
                onChange={e => patch({ endTime: fromLocalDateTimeValue(e.target.value) })}
              />
            </div>
          </div>

          {/* Linked candidate */}
          <div className="relative">
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Link Candidate</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                placeholder="Search candidates..."
                value={candidateSearch}
                onChange={e => { setCandidateSearch(e.target.value); setShowCandidateDrop(true); }}
                onFocus={() => setShowCandidateDrop(true)}
              />
              {form.candidateId && (
                <button
                  onClick={() => { patch({ candidateId: undefined, candidateName: undefined }); setCandidateSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {showCandidateDrop && candidateSearch && filteredCandidates.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-30 max-h-40 overflow-y-auto">
                {filteredCandidates.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      patch({ candidateId: c.id, candidateName: `${c.firstName} ${c.lastName}` });
                      setCandidateSearch(`${c.firstName} ${c.lastName}`);
                      setShowCandidateDrop(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[rgba(45,74,45,0.15)] transition-colors"
                  >
                    <p className="text-white text-xs font-medium">{c.firstName} {c.lastName}</p>
                    <p className="text-[#6B7280] text-[11px]">{c.jobTitle}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Linked vacancy */}
          <div className="relative">
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Link Vacancy</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                placeholder="Search vacancies..."
                value={vacancySearch}
                onChange={e => { setVacancySearch(e.target.value); setShowVacancyDrop(true); }}
                onFocus={() => setShowVacancyDrop(true)}
              />
              {form.vacancyId && (
                <button
                  onClick={() => { patch({ vacancyId: undefined, vacancyTitle: undefined }); setVacancySearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {showVacancyDrop && vacancySearch && filteredVacancies.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-30 max-h-40 overflow-y-auto">
                {filteredVacancies.map(v => (
                  <button
                    key={v.id}
                    onMouseDown={() => {
                      patch({ vacancyId: v.id, vacancyTitle: v.title });
                      setVacancySearch(v.title);
                      setShowVacancyDrop(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[rgba(45,74,45,0.15)] transition-colors"
                  >
                    <p className="text-white text-xs font-medium">{v.title}</p>
                    <p className="text-[#6B7280] text-[11px]">{v.company}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Linked client */}
          <div className="relative">
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Link Client</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg pl-8 pr-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                placeholder="Search clients..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                onFocus={() => setShowClientDrop(true)}
              />
              {form.clientId && (
                <button
                  onClick={() => { patch({ clientId: undefined, clientName: undefined }); setClientSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {showClientDrop && clientSearch && filteredClients.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-30 max-h-40 overflow-y-auto">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      patch({ clientId: c.id, clientName: c.companyName });
                      setClientSearch(c.companyName);
                      setShowClientDrop(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[rgba(45,74,45,0.15)] transition-colors"
                  >
                    <p className="text-white text-xs font-medium">{c.companyName}</p>
                    <p className="text-[#6B7280] text-[11px]">{c.contactName}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">
              <MapPin size={11} className="inline mr-1" />Location / Meeting Link
            </label>
            <input
              className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] transition-colors"
              placeholder="Office address or Teams/Zoom link..."
              value={form.location || ''}
              onChange={e => patch({ location: e.target.value || undefined })}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">
              <FileText size={11} className="inline mr-1" />Notes
            </label>
            <textarea
              className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
              rows={2}
              placeholder="Agenda, preparation notes..."
              value={form.notes || ''}
              onChange={e => patch({ notes: e.target.value || undefined })}
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">
              <Bell size={11} className="inline mr-1" />Reminder
            </label>
            <div className="flex gap-2">
              {([undefined, 30, 60, 1440] as const).map(v => (
                <button
                  key={String(v)}
                  onClick={() => patch({ reminder: v })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    form.reminder === v
                      ? 'bg-[#2D4A2D]/20 text-[#2D4A2D] border-[#2D4A2D]/50'
                      : 'bg-[#FFFFFF] text-[#6B7280] border-[rgba(45,74,45,0.15)] hover:border-[#2a4a7f]'
                  }`}
                >
                  {v === undefined ? 'None' : v === 30 ? '30 min' : v === 60 ? '1 hour' : '1 day'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(45,74,45,0.12)' }}>
          {event && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#EF4444] text-xs transition-colors mr-auto"
            >
              <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 text-[#6B7280] hover:text-[#2D4A2D] py-2.5 rounded-lg text-sm transition-colors"
            style={{ background: 'rgba(45,74,45,0.08)', border: '1px solid rgba(45,74,45,0.15)' }}
          >
            Cancel
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving...' : event ? 'Save Changes' : 'Create Event'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

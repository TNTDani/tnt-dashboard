'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Client, FeeAgreement, TimelineEntry, FollowUp } from '@/lib/types';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowLeft, Edit, Mail, Phone, MapPin, Globe, Building2,
  X, Check, ChevronDown, ExternalLink, Briefcase, ScanSearch,
  Bell, Moon,
} from 'lucide-react';
import Link from 'next/link';
import Timeline from '@/components/Timeline';
import EmailComposer from '@/components/EmailComposer';
import VacancyScannerModal from '@/components/VacancyScannerModal';

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  prospect: { bg: 'bg-blue-50', text: 'text-blue-600' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500' },
};
const TYPE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active Client',
  inactive: 'Inactive',
};

const SECTORS = ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Engineering', 'Legal', 'HR', 'Logistics', 'Retail', 'Education', 'Other'];
const SIZES: Client['size'][] = ['startup', 'small', 'medium', 'large', 'enterprise'];
const SIZE_LABELS: Record<Client['size'], string> = {
  startup: 'Startup',
  small: 'Small (<50)',
  medium: 'Medium (50-200)',
  large: 'Large (200-1000)',
  enterprise: 'Enterprise (1000+)',
};

const STANDARD_RATES = [
  { label: 'Junior / Medior', rate: 18 },
  { label: 'Senior', rate: 20 },
  { label: 'Management', rate: 22 },
];

const TABS = ['Overview', 'Vacancies', 'Timeline'] as const;
type Tab = typeof TABS[number];

const INPUT_CLASS = 'w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors';
const SELECT_CLASS = 'w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors';
const LABEL_CLASS = 'block text-[#6B7280] text-xs font-medium mb-1';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [notesValue, setNotesValue] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client> & { feeType?: FeeAgreement['type']; customPercentage?: string; retainerAmount?: string; retainerPercentage?: string }>({});
  const [vacancyCount, setVacancyCount] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [feeForm, setFeeForm] = useState<{ type: FeeAgreement['type']; customPercentage: string; retainerAmount: string; retainerPercentage: string }>({
    type: 'standard', customPercentage: '', retainerAmount: '', retainerPercentage: '',
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([db.getClients(), db.getFollowUps()]).then(([clients, allFollowUps]) => {
      const found = clients.find(c => c.id === id);
      if (found) {
        setClient(found);
        setNotesValue(found.notes);
        storage.addActivityItem({
          type: 'client',
          id: found.id,
          name: found.companyName,
          href: `/clients/${found.id}`,
          lastAction: 'Viewed',
          timestamp: new Date().toISOString(),
        });
      }
      const activeFollowUp = allFollowUps.find(f => f.contactId === id && f.status !== 'done');
      setFollowUp(activeFollowUp || null);
    });
  }, [id]);

  useEffect(() => {
    if (client) {
      db.getVacancies().then(vacancies => {
        setVacancyCount(vacancies.filter(v => v.company === client.companyName).length);
      });
    }
  }, [client]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const persist = useCallback((updated: Client) => {
    db.getClients().then(clients => {
      const newClients = clients.map(c => c.id === updated.id ? updated : c);
      db.saveClients(newClients);
    });
    setClient(updated);
  }, []);

  const handleNotesBlur = () => {
    if (!client) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const updated = { ...client, notes: notesValue, updatedAt: new Date().toISOString() };
      persist(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }, 500);
  };

  const addTimelineEntry = useCallback((entry: TimelineEntry) => {
    if (!client) return;
    const updated = {
      ...client,
      timeline: [...client.timeline, entry],
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
  }, [client, persist]);

  const handleAddNote = (note: string) => {
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'note',
      content: note,
      createdAt: new Date().toISOString(),
    };
    addTimelineEntry(entry);
  };

  const handleTypeChange = (newType: Client['type']) => {
    if (!client) return;
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'status_change',
      content: `Client type changed from ${TYPE_LABELS[client.type]} to ${TYPE_LABELS[newType]}`,
      createdAt: new Date().toISOString(),
      metadata: { from: client.type, to: newType },
    };
    const updated = { ...client, type: newType, timeline: [...client.timeline, entry], updatedAt: new Date().toISOString() };
    persist(updated);
    setShowTypeMenu(false);
  };

  const handleEdit = () => {
    if (!client) return;
    setEditForm({
      ...client,
      feeType: client.feeAgreement.type,
      customPercentage: client.feeAgreement.customPercentage?.toString() || '',
      retainerAmount: client.feeAgreement.retainerAmount?.toString() || '',
      retainerPercentage: client.feeAgreement.retainerPercentage?.toString() || '',
    });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!client || !editForm) return;
    const feeAgreement: FeeAgreement = {
      type: editForm.feeType || 'standard',
      ...(editForm.feeType === 'custom' && editForm.customPercentage ? { customPercentage: parseFloat(editForm.customPercentage) } : {}),
      ...(editForm.feeType === 'retainer' && editForm.retainerAmount ? { retainerAmount: parseFloat(editForm.retainerAmount) } : {}),
      ...(editForm.feeType === 'retainer' && editForm.retainerPercentage ? { retainerPercentage: parseFloat(editForm.retainerPercentage) } : {}),
    };
    const updated: Client = {
      ...client,
      companyName: editForm.companyName || client.companyName,
      website: editForm.website,
      sector: editForm.sector || client.sector,
      size: editForm.size || client.size,
      type: editForm.type || client.type,
      contactName: editForm.contactName || client.contactName,
      contactEmail: editForm.contactEmail || client.contactEmail,
      contactPhone: editForm.contactPhone || client.contactPhone,
      contactRole: editForm.contactRole || client.contactRole,
      location: editForm.location || client.location,
      guaranteePeriod: editForm.guaranteePeriod || client.guaranteePeriod,
      feeAgreement,
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
    setShowEdit(false);
  };

  const handleFeeSave = () => {
    if (!client) return;
    const feeAgreement: FeeAgreement = {
      type: feeForm.type,
      ...(feeForm.type === 'custom' && feeForm.customPercentage ? { customPercentage: parseFloat(feeForm.customPercentage) } : {}),
      ...(feeForm.type === 'retainer' && feeForm.retainerAmount ? { retainerAmount: parseFloat(feeForm.retainerAmount) } : {}),
      ...(feeForm.type === 'retainer' && feeForm.retainerPercentage ? { retainerPercentage: parseFloat(feeForm.retainerPercentage) } : {}),
    };
    const updated = { ...client, feeAgreement, updatedAt: new Date().toISOString() };
    persist(updated);
    setEditingFee(false);
  };

  const startEditFee = () => {
    if (!client) return;
    setFeeForm({
      type: client.feeAgreement.type,
      customPercentage: client.feeAgreement.customPercentage?.toString() || '',
      retainerAmount: client.feeAgreement.retainerAmount?.toString() || '',
      retainerPercentage: client.feeAgreement.retainerPercentage?.toString() || '',
    });
    setEditingFee(true);
  };

  const refreshFollowUp = useCallback(() => {
    db.getFollowUps().then(allFollowUps => {
      const active = allFollowUps.find(f => f.contactId === id && f.status !== 'done');
      setFollowUp(active || null);
    });
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
    db.getFollowUps().then(all => {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + 2);
      db.saveFollowUps(all.map(f => f.id === followUp.id
        ? { ...f, status: 'snoozed' as const, snoozedUntil: snoozedUntil.toISOString() }
        : f
      ));
      refreshFollowUp();
    });
  };

  const handleEmailSent = useCallback((entry: TimelineEntry) => {
    addTimelineEntry(entry);
    setTimeout(refreshFollowUp, 100);
  }, [addTimelineEntry, refreshFollowUp]);

  const handleVacanciesActivated = useCallback((newVacancies: import('@/lib/types').Vacancy[], scannedAt: string) => {
    db.getVacancies().then(existing => {
      db.saveVacancies([...existing, ...newVacancies]);
    });
    setVacancyCount(c => c + newVacancies.length);
    if (!client) return;
    const updated = { ...client, lastVacancyScan: scannedAt, updatedAt: new Date().toISOString() };
    persist(updated);
  }, [client, persist]);

  if (!client) {
    return (
      <div className="p-6 lg:p-8">
        <button
          onClick={() => router.push('/clients')}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#2D4A2D] text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Clients
        </button>
        <div className="text-center py-20">
          <Building2 size={40} className="mx-auto mb-3 text-[rgba(45,74,45,0.20)]" />
          <p className="text-[#6B7280]">Client not found</p>
        </div>
      </div>
    );
  }

  const badge = TYPE_BADGE[client.type];

  return (
    <div className="p-6 lg:p-8">
      {/* Back button */}
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] text-sm mb-6 transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Clients
      </button>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6 mb-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(45,74,45,0.08)] flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className="text-[#2D4A2D]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-[#2D4A2D] truncate">{client.companyName}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}>
                  {TYPE_LABELS[client.type]}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[#6B7280] text-sm">{client.sector} · {SIZE_LABELS[client.size]}</span>
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#6B7280] hover:text-[#2D4A2D] text-sm transition-colors"
                  >
                    <Globe size={12} />
                    {client.website}
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowEmail(true)}
              className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Mail size={14} /> Email
            </button>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 bg-white hover:bg-[rgba(45,74,45,0.06)] border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Edit size={14} /> Edit
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 mb-6 border-b border-[rgba(45,74,45,0.10)]">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#2D4A2D]'
                : 'text-[#6B7280] hover:text-[#2D4A2D]'
            }`}
          >
            {tab}
            {tab === 'Vacancies' && vacancyCount > 0 && (
              <span className="ml-1.5 bg-[rgba(45,74,45,0.10)] text-[#2D4A2D] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {vacancyCount}
              </span>
            )}
            {activeTab === tab && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2D4A2D] rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 xl:grid-cols-5 gap-4"
          >
            {/* Left column */}
            <div className="xl:col-span-3 space-y-4">
              {/* Primary Contact */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6">
                <p className="text-[#2D4A2D] font-semibold text-sm mb-4">Primary Contact</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[rgba(45,74,45,0.08)] flex items-center justify-center text-[#2D4A2D] text-sm font-bold flex-shrink-0">
                      {client.contactName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[#2D4A2D] text-sm font-medium">{client.contactName}</p>
                      <p className="text-[#6B7280] text-xs">{client.contactRole}</p>
                    </div>
                  </div>
                  {client.contactEmail && (
                    <div className="flex items-center gap-3">
                      <Mail size={14} className="text-[#2D4A2D] flex-shrink-0" />
                      <a href={`mailto:${client.contactEmail}`} className="text-[#6B7280] text-sm hover:text-[#2D4A2D] transition-colors">
                        {client.contactEmail}
                      </a>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div className="flex items-center gap-3">
                      <Phone size={14} className="text-[#2D4A2D] flex-shrink-0" />
                      <span className="text-[#6B7280] text-sm">{client.contactPhone}</span>
                    </div>
                  )}
                  {client.location && (
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-[#2D4A2D] flex-shrink-0" />
                      <span className="text-[#6B7280] text-sm">{client.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Details */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6">
                <p className="text-[#2D4A2D] font-semibold text-sm mb-4">Company Details</p>
                <div className="divide-y divide-[rgba(45,74,45,0.08)]">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#6B7280] text-xs">Sector</span>
                    <span className="text-[#2D4A2D] text-sm font-medium">{client.sector}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#6B7280] text-xs">Size</span>
                    <span className="text-[#2D4A2D] text-sm font-medium">{SIZE_LABELS[client.size]}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#6B7280] text-xs">Guarantee Period</span>
                    <span className="text-[#2D4A2D] text-sm font-medium">{client.guaranteePeriod} months</span>
                  </div>
                </div>
              </div>

              {/* Fee Agreement */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[#2D4A2D] font-semibold text-sm">Fee Agreement</p>
                  {!editingFee && (
                    <button onClick={startEditFee} className="text-[#2D4A2D] text-xs font-medium hover:text-[#3D6B3D] transition-colors">
                      Edit
                    </button>
                  )}
                </div>

                {editingFee ? (
                  <div className="space-y-3">
                    <div>
                      <label className={LABEL_CLASS}>Fee Type</label>
                      <select className={SELECT_CLASS} value={feeForm.type} onChange={e => setFeeForm(f => ({ ...f, type: e.target.value as FeeAgreement['type'] }))}>
                        <option value="standard">Standard</option>
                        <option value="custom">Custom %</option>
                        <option value="retainer">Retainer</option>
                      </select>
                    </div>
                    {feeForm.type === 'custom' && (
                      <div>
                        <label className={LABEL_CLASS}>Custom Percentage (%)</label>
                        <input type="number" className={INPUT_CLASS} value={feeForm.customPercentage} onChange={e => setFeeForm(f => ({ ...f, customPercentage: e.target.value }))} />
                      </div>
                    )}
                    {feeForm.type === 'retainer' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>Upfront (€)</label>
                          <input type="number" className={INPUT_CLASS} value={feeForm.retainerAmount} onChange={e => setFeeForm(f => ({ ...f, retainerAmount: e.target.value }))} />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>On Placement (%)</label>
                          <input type="number" className={INPUT_CLASS} value={feeForm.retainerPercentage} onChange={e => setFeeForm(f => ({ ...f, retainerPercentage: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleFeeSave} className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingFee(false)} className="bg-[rgba(45,74,45,0.08)] hover:bg-[rgba(45,74,45,0.14)] text-[#6B7280] hover:text-[#2D4A2D] px-3 py-1.5 rounded-lg text-xs transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[#2D4A2D] text-xs font-semibold uppercase tracking-wider mb-3">
                      {client.feeAgreement.type === 'standard' ? 'Standard Rates' : client.feeAgreement.type === 'custom' ? 'Custom Rate' : 'Retainer Agreement'}
                    </p>
                    {client.feeAgreement.type === 'standard' && (
                      <div className="space-y-2">
                        {STANDARD_RATES.map(r => (
                          <div key={r.label} className="flex items-center justify-between bg-[rgba(45,74,45,0.04)] border border-[rgba(45,74,45,0.08)] rounded-xl px-3 py-2">
                            <span className="text-[#6B7280] text-sm">{r.label}</span>
                            <span className="text-[#2D4A2D] font-semibold text-sm">{r.rate}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {client.feeAgreement.type === 'custom' && (
                      <div className="bg-[rgba(45,74,45,0.04)] border border-[rgba(45,74,45,0.08)] rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-[#6B7280] text-sm">Agreed percentage</span>
                        <span className="text-[#2D4A2D] font-semibold text-xl">{client.feeAgreement.customPercentage ?? '—'}%</span>
                      </div>
                    )}
                    {client.feeAgreement.type === 'retainer' && (
                      <div className="space-y-2">
                        <div className="bg-[rgba(45,74,45,0.04)] border border-[rgba(45,74,45,0.08)] rounded-xl px-3 py-2 flex items-center justify-between">
                          <span className="text-[#6B7280] text-sm">Upfront retainer</span>
                          <span className="text-[#2D4A2D] font-semibold text-sm">
                            {client.feeAgreement.retainerAmount ? `€ ${client.feeAgreement.retainerAmount.toLocaleString('nl-NL')}` : '—'}
                          </span>
                        </div>
                        <div className="bg-[rgba(45,74,45,0.04)] border border-[rgba(45,74,45,0.08)] rounded-xl px-3 py-2 flex items-center justify-between">
                          <span className="text-[#6B7280] text-sm">On placement</span>
                          <span className="text-[#2D4A2D] font-semibold text-sm">{client.feeAgreement.retainerPercentage ?? '—'}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#2D4A2D] font-semibold text-sm">Notes</p>
                  <AnimatePresence>
                    {savedFlash && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-emerald-600 text-xs"
                      >
                        <Check size={12} /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <textarea
                  className="w-full bg-[rgba(45,74,45,0.02)] border border-[rgba(45,74,45,0.12)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
                  rows={5}
                  placeholder="Internal notes about this client..."
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  onBlur={handleNotesBlur}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="xl:col-span-2 space-y-4">
              {/* Quick Actions */}
              <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-5">
                <p className="text-[#2D4A2D] font-semibold text-sm mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowEmail(true)}
                    className="w-full flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Mail size={14} /> Send Email
                  </button>

                  <div className="relative" ref={typeMenuRef}>
                    <button
                      onClick={() => setShowTypeMenu(s => !s)}
                      className="w-full flex items-center justify-between gap-2 bg-white hover:bg-[rgba(45,74,45,0.06)] border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] px-4 py-2.5 rounded-xl text-sm transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 size={14} />
                        Change Type
                      </div>
                      <ChevronDown size={14} />
                    </button>
                    <AnimatePresence>
                      {showTypeMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white border border-[rgba(45,74,45,0.12)] rounded-xl overflow-hidden z-10 shadow-lg shadow-[rgba(45,74,45,0.08)]"
                        >
                          {(['prospect', 'active', 'inactive'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => handleTypeChange(t)}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(45,74,45,0.06)] ${client.type === t ? 'text-[#2D4A2D] font-medium' : 'text-[#6B7280]'}`}
                            >
                              {TYPE_LABELS[t]}
                              {client.type === t && <Check size={12} className="inline ml-2" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Link
                    href="/vacancies"
                    className="w-full flex items-center gap-2 bg-white hover:bg-[rgba(45,74,45,0.06)] border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] px-4 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <Briefcase size={14} /> Add Vacancy
                  </Link>
                </div>
              </div>

              {/* Follow-up Status */}
              {followUp && (
                <div className={`bg-white border rounded-2xl p-5 ${
                  (() => {
                    const due = followUp.snoozedUntil ? new Date(followUp.snoozedUntil) : new Date(followUp.dueDate);
                    const diffDays = Math.floor((due.getTime() - Date.now()) / 86400000);
                    if (followUp.status === 'snoozed') return 'border-[rgba(45,74,45,0.12)]';
                    return diffDays < 0 ? 'border-red-200' : diffDays === 0 ? 'border-amber-200' : 'border-[rgba(45,74,45,0.12)]';
                  })()
                }`}>
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
                    if (diffDays < 0) { statusLabel = `${Math.abs(diffDays)}d overdue`; statusColor = 'text-red-500'; }
                    else if (diffDays === 0) { statusLabel = 'Due today'; statusColor = 'text-amber-500'; }
                    else { statusLabel = `Due in ${diffDays}d`; statusColor = 'text-[#6B7280]'; }
                    return (
                      <>
                        <p className="text-[#6B7280] text-xs mb-1">Re: {followUp.originalEmailSubject}</p>
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
                      className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.06)] hover:bg-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] px-3 py-1.5 rounded-lg text-xs transition-colors"
                    >
                      <Moon size={11} /> Snooze 2d
                    </button>
                    <button
                      onClick={handleMarkFollowUpDone}
                      className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    >
                      <Check size={11} /> Mark Done
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline preview in sidebar */}
              <Timeline
                entries={client.timeline}
                onAddNote={handleAddNote}
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'Vacancies' && (
          <motion.div
            key="vacancies"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[#2D4A2D] font-semibold text-sm">Open Vacancies</p>
                <span className="bg-[rgba(45,74,45,0.08)] text-[#2D4A2D] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {vacancyCount}
                </span>
              </div>
              <p className="text-[#6B7280] text-sm mb-1">
                {vacancyCount === 0
                  ? 'No vacancies linked to this client.'
                  : `${vacancyCount} vacanc${vacancyCount !== 1 ? 'ies' : 'y'} for ${client.companyName}`}
              </p>
              {client.lastVacancyScan && (
                <p className="text-[#6B7280] text-xs mb-4">
                  Last scanned: {new Date(client.lastVacancyScan).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <Link
                  href="/vacancies"
                  className="inline-flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <Briefcase size={14} />
                  View all vacancies
                </Link>
                {client.website && (
                  <button
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] text-sm transition-colors"
                  >
                    <ScanSearch size={14} />
                    Scan website for vacancies
                  </button>
                )}
              </div>
              {!client.website && (
                <p className="text-[#6B7280] text-xs mt-3">Add a website URL to enable scanning.</p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'Timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Timeline
              entries={client.timeline}
              onAddNote={handleAddNote}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[#2D4A2D] font-semibold">Edit Client</h2>
                <button onClick={() => setShowEdit(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Company Name</label>
                    <input className={INPUT_CLASS} value={editForm.companyName || ''} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Website</label>
                    <input className={INPUT_CLASS} value={editForm.website || ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Sector</label>
                    <select className={SELECT_CLASS} value={editForm.sector || ''} onChange={e => setEditForm(f => ({ ...f, sector: e.target.value }))}>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Size</label>
                    <select className={SELECT_CLASS} value={editForm.size || ''} onChange={e => setEditForm(f => ({ ...f, size: e.target.value as Client['size'] }))}>
                      {SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Type</label>
                    <select className={SELECT_CLASS} value={editForm.type || ''} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as Client['type'] }))}>
                      <option value="prospect">Prospect</option>
                      <option value="active">Active Client</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Location</label>
                    <input className={INPUT_CLASS} value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Guarantee Period (months)</label>
                    <input type="number" className={INPUT_CLASS} value={editForm.guaranteePeriod || ''} onChange={e => setEditForm(f => ({ ...f, guaranteePeriod: parseInt(e.target.value) || 3 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Contact Name</label>
                    <input className={INPUT_CLASS} value={editForm.contactName || ''} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Contact Role</label>
                    <input className={INPUT_CLASS} value={editForm.contactRole || ''} onChange={e => setEditForm(f => ({ ...f, contactRole: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Contact Email</label>
                    <input type="email" className={INPUT_CLASS} value={editForm.contactEmail || ''} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Contact Phone</label>
                    <input className={INPUT_CLASS} value={editForm.contactPhone || ''} onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleEditSave} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
                  Save Changes
                </button>
                <button onClick={() => setShowEdit(false)} className="flex-1 bg-[rgba(45,74,45,0.08)] hover:bg-[rgba(45,74,45,0.14)] text-[#6B7280] hover:text-[#2D4A2D] py-2.5 rounded-xl transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vacancy Scanner Modal */}
      {showScanner && client.website && (
        <VacancyScannerModal
          companyName={client.companyName}
          website={client.website}
          lastScanned={client.lastVacancyScan}
          onClose={() => setShowScanner(false)}
          onActivate={handleVacanciesActivated}
        />
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={showEmail}
        onClose={() => setShowEmail(false)}
        defaultTo={client.contactEmail}
        vars={{
          clientName: client.contactName,
        }}
        followUpConfig={{
          contactType: 'client',
          contactId: client.id,
          contactName: client.contactName,
          company: client.companyName,
        }}
        onSent={handleEmailSent}
        clientContactName={client.contactName}
        clientContactRole={client.contactRole}
        clientCompanyName={client.companyName}
        clientWebsite={client.website}
      />
    </div>
  );
}

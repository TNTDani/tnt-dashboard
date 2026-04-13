'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, FeeAgreement, TimelineEntry, FollowUp } from '@/lib/types';
import { db } from '@/lib/db';
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

const TYPE_BADGE: Record<string, string> = {
  prospect: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  inactive: 'bg-[#94a3b8]/20 text-[#94a3b8]',
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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
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
    // Persist vacancies
    db.getVacancies().then(existing => {
      db.saveVacancies([...existing, ...newVacancies]);
    });
    setVacancyCount(c => c + newVacancies.length);

    // Stamp last scan on the client
    if (!client) return;
    const updated = { ...client, lastVacancyScan: scannedAt, updatedAt: new Date().toISOString() };
    persist(updated);
  }, [client, persist]);

  if (!client) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/clients')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#2D4A2D] text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Clients
        </button>
        <div className="text-center py-20">
          <Building2 size={40} className="mx-auto mb-3 text-[rgba(45,74,45,0.15)]" />
          <p className="text-[#94a3b8]">Client not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button onClick={() => router.push('/clients')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#2D4A2D] text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Clients
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-3 space-y-4">
          {/* Header */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#2D4A2D20] flex items-center justify-center flex-shrink-0">
                  <Building2 size={24} className="text-[#2D4A2D]" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-[#2D4A2D]">{client.companyName}</h1>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[client.type]}`}>
                      {TYPE_LABELS[client.type]}
                    </span>
                  </div>
                  {client.website && (
                    <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#94a3b8] hover:text-[#2D4A2D] text-sm mt-1 transition-colors">
                      <Globe size={12} />
                      {client.website}
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
              <button onClick={handleEdit} className="flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors">
                <Edit size={14} /> Edit
              </button>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <p className="text-[#2D4A2D] font-semibold text-sm mb-4">Primary Contact</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2D4A2D20] flex items-center justify-center text-[#2D4A2D] text-sm font-bold flex-shrink-0">
                  {client.contactName.charAt(0)}
                </div>
                <div>
                  <p className="text-[#2D4A2D] text-sm font-medium">{client.contactName}</p>
                  <p className="text-[#94a3b8] text-xs">{client.contactRole}</p>
                </div>
              </div>
              {client.contactEmail && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[#2D4A2D] flex-shrink-0" />
                  <a href={`mailto:${client.contactEmail}`} className="text-[#94a3b8] text-sm hover:text-[#2D4A2D] transition-colors">
                    {client.contactEmail}
                  </a>
                </div>
              )}
              {client.contactPhone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[#2D4A2D] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-sm">{client.contactPhone}</span>
                </div>
              )}
              {client.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-[#2D4A2D] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-sm">{client.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Company card */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <p className="text-[#2D4A2D] font-semibold text-sm mb-4">Company Details</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs">Sector</span>
                <span className="text-[#2D4A2D] text-sm">{client.sector}</span>
              </div>
              <div className="border-t border-[rgba(45,74,45,0.15)]" />
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs">Size</span>
                <span className="text-[#2D4A2D] text-sm">{SIZE_LABELS[client.size]}</span>
              </div>
              <div className="border-t border-[rgba(45,74,45,0.15)]" />
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs">Guarantee Period</span>
                <span className="text-[#2D4A2D] text-sm">{client.guaranteePeriod} months</span>
              </div>
            </div>
          </div>

          {/* Fee Agreement */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#2D4A2D] font-semibold text-sm">Fee Agreement</p>
              {!editingFee && (
                <button onClick={startEditFee} className="text-[#2D4A2D] text-xs hover:text-[#3D6B3D] transition-colors">
                  Edit
                </button>
              )}
            </div>

            {editingFee ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Fee Type</label>
                  <select
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={feeForm.type}
                    onChange={e => setFeeForm(f => ({ ...f, type: e.target.value as FeeAgreement['type'] }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="custom">Custom %</option>
                    <option value="retainer">Retainer</option>
                  </select>
                </div>
                {feeForm.type === 'custom' && (
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-medium mb-1">Custom Percentage (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      value={feeForm.customPercentage}
                      onChange={e => setFeeForm(f => ({ ...f, customPercentage: e.target.value }))}
                    />
                  </div>
                )}
                {feeForm.type === 'retainer' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#94a3b8] text-xs font-medium mb-1">Upfront (€)</label>
                      <input
                        type="number"
                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={feeForm.retainerAmount}
                        onChange={e => setFeeForm(f => ({ ...f, retainerAmount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#94a3b8] text-xs font-medium mb-1">On Placement (%)</label>
                      <input
                        type="number"
                        className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        value={feeForm.retainerPercentage}
                        onChange={e => setFeeForm(f => ({ ...f, retainerPercentage: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleFeeSave} className="flex items-center gap-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    <Check size={12} /> Save
                  </button>
                  <button onClick={() => setEditingFee(false)} className="bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-3 py-1.5 rounded-lg text-xs transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#2D4A2D] text-xs font-semibold uppercase tracking-wider">
                    {client.feeAgreement.type === 'standard' ? 'Standard Rates' : client.feeAgreement.type === 'custom' ? 'Custom Rate' : 'Retainer Agreement'}
                  </span>
                </div>

                {client.feeAgreement.type === 'standard' && (
                  <div className="space-y-2">
                    {STANDARD_RATES.map(r => (
                      <div key={r.label} className="flex items-center justify-between bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2">
                        <span className="text-[#94a3b8] text-sm">{r.label}</span>
                        <span className="text-[#2D4A2D] font-semibold text-sm">{r.rate}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {client.feeAgreement.type === 'custom' && (
                  <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-[#94a3b8] text-sm">Agreed percentage</span>
                    <span className="text-[#2D4A2D] font-semibold text-xl">{client.feeAgreement.customPercentage ?? '—'}%</span>
                  </div>
                )}

                {client.feeAgreement.type === 'retainer' && (
                  <div className="space-y-2">
                    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-[#94a3b8] text-sm">Upfront retainer</span>
                      <span className="text-[#2D4A2D] font-semibold text-sm">
                        {client.feeAgreement.retainerAmount
                          ? `€ ${client.feeAgreement.retainerAmount.toLocaleString('nl-NL')}`
                          : '—'}
                      </span>
                    </div>
                    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-[#94a3b8] text-sm">On placement</span>
                      <span className="text-[#2D4A2D] font-semibold text-sm">{client.feeAgreement.retainerPercentage ?? '—'}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Open Vacancies */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#2D4A2D] font-semibold text-sm">Open Vacancies</p>
              <span className="bg-[#2D4A2D20] text-[#2D4A2D] text-xs font-semibold px-2 py-0.5 rounded-full">
                {vacancyCount}
              </span>
            </div>
            <p className="text-[#94a3b8] text-xs mb-1">
              {vacancyCount === 0 ? 'No vacancies linked to this client.' : `${vacancyCount} vacanc${vacancyCount !== 1 ? 'ies' : 'y'} for ${client.companyName}`}
            </p>
            {client.lastVacancyScan && (
              <p className="text-[#6B7280] text-xs mb-3">
                Last scanned: {new Date(client.lastVacancyScan).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Link
                href="/vacancies"
                className="inline-flex items-center gap-2 text-[#2D4A2D] hover:text-[#3D6B3D] text-sm transition-colors"
              >
                <Briefcase size={14} />
                View all vacancies →
              </Link>
              {client.website && (
                <button
                  onClick={() => setShowScanner(true)}
                  className="inline-flex items-center gap-1.5 text-[#94a3b8] hover:text-[#2D4A2D] text-sm transition-colors"
                >
                  <ScanSearch size={14} />
                  Scan website for vacancies
                </button>
              )}
            </div>
            {!client.website && (
              <p className="text-[#6B7280] text-xs mt-2">Add a website URL to enable scanning.</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#2D4A2D] font-semibold text-sm">Notes</p>
              {savedFlash && (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <Check size={12} /> Saved
                </span>
              )}
            </div>
            <textarea
              className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
              rows={5}
              placeholder="Internal notes about this client..."
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onBlur={handleNotesBlur}
            />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="xl:col-span-2 space-y-4">
          {/* Quick Actions */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
            <p className="text-[#2D4A2D] font-semibold text-sm mb-3">Quick Actions</p>
            <div className="space-y-2">
              <button
                onClick={() => setShowEmail(true)}
                className="w-full flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Mail size={14} /> Send Email
              </button>

              <div className="relative" ref={typeMenuRef}>
                <button
                  onClick={() => setShowTypeMenu(s => !s)}
                  className="w-full flex items-center justify-between gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={14} />
                    Change Type
                  </div>
                  <ChevronDown size={14} />
                </button>
                {showTypeMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden z-10">
                    {(['prospect', 'active', 'inactive'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[rgba(45,74,45,0.15)] ${client.type === t ? 'text-[#2D4A2D]' : 'text-[#94a3b8]'}`}
                      >
                        {TYPE_LABELS[t]}
                        {client.type === t && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href={`/vacancies`}
                className="w-full flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Briefcase size={14} /> Add Vacancy
              </Link>
            </div>
          </div>

          {/* Follow-up Status */}
          {followUp && (
            <div className={`bg-[#FFFFFF] border rounded-xl p-4 ${
              (() => {
                const due = followUp.snoozedUntil ? new Date(followUp.snoozedUntil) : new Date(followUp.dueDate);
                const diffDays = Math.floor((due.getTime() - Date.now()) / 86400000);
                if (followUp.status === 'snoozed') return 'border-[rgba(45,74,45,0.15)]';
                return diffDays < 0 ? 'border-red-500/30' : diffDays === 0 ? 'border-amber-500/30' : 'border-[rgba(45,74,45,0.15)]';
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
          <Timeline
            entries={client.timeline}
            onAddNote={handleAddNote}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-t-xl sm:rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[#2D4A2D] font-semibold">Edit Client</h2>
              <button onClick={() => setShowEdit(false)} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Company Name</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.companyName || ''}
                    onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Website</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.website || ''}
                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Sector</label>
                  <select
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.sector || ''}
                    onChange={e => setEditForm(f => ({ ...f, sector: e.target.value }))}
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Size</label>
                  <select
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.size || ''}
                    onChange={e => setEditForm(f => ({ ...f, size: e.target.value as Client['size'] }))}
                  >
                    {SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Type</label>
                  <select
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.type || ''}
                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value as Client['type'] }))}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active Client</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.location || ''}
                    onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Guarantee Period (months)</label>
                  <input
                    type="number"
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.guaranteePeriod || ''}
                    onChange={e => setEditForm(f => ({ ...f, guaranteePeriod: parseInt(e.target.value) || 3 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Contact Name</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.contactName || ''}
                    onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Contact Role</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.contactRole || ''}
                    onChange={e => setEditForm(f => ({ ...f, contactRole: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.contactEmail || ''}
                    onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Contact Phone</label>
                  <input
                    className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    value={editForm.contactPhone || ''}
                    onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleEditSave} className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                Save Changes
              </button>
              <button onClick={() => setShowEdit(false)} className="flex-1 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

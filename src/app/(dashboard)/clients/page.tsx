'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Client, FeeAgreement, TimelineEntry } from '@/lib/types';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Search, Building2, MapPin, User, Upload, Clock, ArrowUpDown } from 'lucide-react';
import CsvImportModal from '@/components/CsvImportModal';

const SECTORS = ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Engineering', 'Legal', 'HR', 'Logistics', 'Retail', 'Education', 'Other'];
const SIZES: Client['size'][] = ['startup', 'small', 'medium', 'large', 'enterprise'];
const SIZE_LABELS: Record<Client['size'], string> = {
  startup: 'Startup',
  small: 'Small (<50)',
  medium: 'Medium (50-200)',
  large: 'Large (200-1000)',
  enterprise: 'Enterprise (1000+)',
};

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

const EMPTY_FORM = {
  companyName: '',
  website: '',
  sector: 'Technology',
  size: 'medium' as Client['size'],
  type: 'prospect' as Client['type'],
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactRole: '',
  location: '',
  notes: '',
  feeType: 'standard' as FeeAgreement['type'],
  customPercentage: '',
  retainerAmount: '',
  retainerPercentage: '',
  guaranteePeriod: '3',
};

const CONTACT_TYPES = new Set<TimelineEntry['type']>(['email_sent', 'note']);
const COLD_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function lastContactMs(client: Client): number | null {
  if (!client.timeline?.length) return null;
  const entries = client.timeline
    .filter(e => CONTACT_TYPES.has(e.type))
    .map(e => new Date(e.createdAt).getTime());
  return entries.length ? Math.max(...entries) : null;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type FilterType = 'all' | Client['type'] | 'cold';

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'cold', label: 'Cold' },
];

const INPUT_CLASS = 'w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors';
const SELECT_CLASS = 'w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors';
const LABEL_CLASS = 'block text-[#6B7280] text-xs font-medium mb-1';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterSector, setFilterSector] = useState('');
  const [sortByContact, setSortByContact] = useState(false);

  useEffect(() => {
    db.getClients().then(setClients);
  }, []);

  const filtered = clients
    .filter(c => {
      const q = search.toLowerCase();
      if (q && !c.companyName.toLowerCase().includes(q) &&
        !c.contactName.toLowerCase().includes(q) &&
        !c.sector.toLowerCase().includes(q) &&
        !c.location.toLowerCase().includes(q)) return false;
      if (filterType === 'cold') {
        const lc = lastContactMs(c);
        if (lc !== null && Date.now() - lc < COLD_THRESHOLD_MS) return false;
      } else if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterSector && c.sector !== filterSector) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortByContact) return 0;
      const la = lastContactMs(a) ?? 0;
      const lb = lastContactMs(b) ?? 0;
      return la - lb; // oldest (smallest timestamp) first
    });

  const addClient = () => {
    if (!form.companyName.trim() || !form.contactName.trim()) return;
    const now = new Date().toISOString();
    const timeline: TimelineEntry[] = [{
      id: uuidv4(),
      type: 'created',
      content: 'Client record created',
      createdAt: now,
    }];

    const feeAgreement: FeeAgreement = {
      type: form.feeType,
      ...(form.feeType === 'custom' && form.customPercentage ? { customPercentage: parseFloat(form.customPercentage) } : {}),
      ...(form.feeType === 'retainer' && form.retainerAmount ? { retainerAmount: parseFloat(form.retainerAmount) } : {}),
      ...(form.feeType === 'retainer' && form.retainerPercentage ? { retainerPercentage: parseFloat(form.retainerPercentage) } : {}),
    };

    const newClient: Client = {
      id: uuidv4(),
      companyName: form.companyName.trim(),
      website: form.website.trim() || undefined,
      sector: form.sector,
      size: form.size,
      type: form.type,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      contactRole: form.contactRole.trim(),
      location: form.location.trim(),
      notes: '',
      feeAgreement,
      guaranteePeriod: parseInt(form.guaranteePeriod) || 3,
      timeline,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...clients, newClient];
    setClients(updated);
    db.saveClients(updated);
    setForm(EMPTY_FORM);
    setShowAdd(false);
  };

  const handleImport = (newClients: Client[]) => {
    const updated = [...clients, ...newClients];
    setClients(updated);
    db.saveClients(updated);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Clients</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">
            {filtered.length === clients.length
              ? `${clients.length} client${clients.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${clients.length} clients`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-white hover:bg-[rgba(45,74,45,0.06)] border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Upload size={15} /> Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl pl-9 pr-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors"
            placeholder="Search by company, contact, sector, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Sector filter */}
        <select
          className="bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
          value={filterSector}
          onChange={e => setFilterSector(e.target.value)}
        >
          <option value="">All Sectors</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Type filter chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilterType(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterType === f.value
                ? 'bg-[#2D4A2D] text-white'
                : 'bg-white border border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setSortByContact(s => !s)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            sortByContact
              ? 'bg-[#2D4A2D] text-white border-[#2D4A2D]'
              : 'bg-white border-[rgba(45,74,45,0.12)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D]'
          }`}
        >
          <ArrowUpDown size={13} />
          Oldest contact first
        </button>
      </div>

      {/* Results grid */}
      <AnimatePresence mode="wait">
        {clients.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-16 text-center"
          >
            <Building2 size={40} className="mx-auto mb-3 text-[rgba(45,74,45,0.20)]" />
            <p className="text-[#2D4A2D] font-semibold mb-1">No clients yet</p>
            <p className="text-[#6B7280] text-sm mb-5">Add your first client to get started.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={15} /> Add Client
            </button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-16 text-center"
          >
            <Search size={32} className="mx-auto mb-3 text-[rgba(45,74,45,0.20)]" />
            <p className="text-[#6B7280] text-sm">No clients match your filters.</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {filtered.map((c, i) => {
              const badge = TYPE_BADGE[c.type];
              const lc = lastContactMs(c);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.22 }}
                  whileHover={{ y: -3, boxShadow: '0 12px 24px rgba(45,74,45,0.10)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-5 cursor-pointer transition-colors group relative overflow-hidden"
                >
                  {/* Left green accent on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2D4A2D] rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[rgba(45,74,45,0.08)] flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} className="text-[#2D4A2D]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#2D4A2D] font-semibold text-sm truncate">{c.companyName}</p>
                        <span className="inline-flex items-center gap-1 mt-0.5">
                          <span className="text-[#6B7280] text-xs">{c.sector}</span>
                          <span className="text-[rgba(45,74,45,0.25)] text-xs">·</span>
                          <span className="text-[#6B7280] text-xs">{SIZE_LABELS[c.size]}</span>
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${badge.bg} ${badge.text}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-[52px]">
                    {c.contactName && (
                      <div className="flex items-center gap-1.5 text-[#6B7280] text-xs">
                        <User size={11} className="flex-shrink-0" />
                        <span className="truncate">{c.contactName}{c.contactRole ? ` · ${c.contactRole}` : ''}</span>
                      </div>
                    )}
                    {c.location && (
                      <div className="flex items-center gap-1.5 text-[#6B7280] text-xs">
                        <MapPin size={11} className="flex-shrink-0" />
                        <span className="truncate">{c.location}</span>
                      </div>
                    )}
                    {c.feeAgreement && c.feeAgreement.type !== 'standard' && (
                      <div className="flex items-center gap-1.5 text-[#6B7280] text-xs">
                        <span className="w-[11px] flex-shrink-0 flex items-center justify-center text-[10px]">%</span>
                        <span>
                          {c.feeAgreement.type === 'custom'
                            ? `Custom ${c.feeAgreement.customPercentage ?? ''}%`
                            : 'Retainer agreement'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs pt-0.5">
                      <Clock size={11} className="flex-shrink-0 text-[#6B7280]" />
                      {lc !== null ? (
                        <span className="text-[#6B7280]">Last contact: {relativeTime(lc)}</span>
                      ) : (
                        <span className="text-[rgba(45,74,45,0.35)]">Never contacted</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSV Import Modal */}
      {showImport && (
        <CsvImportModal
          existingClients={clients}
          onClose={() => setShowImport(false)}
          onImport={(newClients) => { handleImport(newClients); }}
        />
      )}

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAdd && (
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
              className="bg-white border border-[rgba(45,74,45,0.12)] rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[#2D4A2D] font-semibold text-base">Add New Client</h2>
                <button onClick={() => setShowAdd(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Company */}
                <div>
                  <p className="text-[#2D4A2D] text-xs font-semibold uppercase tracking-wider mb-3">Company</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Company Name *</label>
                      <input className={INPUT_CLASS} placeholder="Acme Corp" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Website</label>
                      <input className={INPUT_CLASS} placeholder="https://acme.com" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className={LABEL_CLASS}>Sector</label>
                      <select className={SELECT_CLASS} value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Size</label>
                      <select className={SELECT_CLASS} value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value as Client['size'] }))}>
                        {SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Type</label>
                      <select className={SELECT_CLASS} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Client['type'] }))}>
                        <option value="prospect">Prospect</option>
                        <option value="active">Active Client</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={LABEL_CLASS}>Location</label>
                    <input className={INPUT_CLASS} placeholder="Amsterdam" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-[#2D4A2D] text-xs font-semibold uppercase tracking-wider mb-3">Primary Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Contact Name *</label>
                      <input className={INPUT_CLASS} placeholder="Jane Smith" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Role</label>
                      <input className={INPUT_CLASS} placeholder="HR Manager" value={form.contactRole} onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className={LABEL_CLASS}>Email</label>
                      <input type="email" className={INPUT_CLASS} placeholder="jane@acme.com" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Phone</label>
                      <input className={INPUT_CLASS} placeholder="+31 20 123 4567" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Fee Agreement */}
                <div>
                  <p className="text-[#2D4A2D] text-xs font-semibold uppercase tracking-wider mb-3">Fee Agreement</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Fee Type</label>
                      <select className={SELECT_CLASS} value={form.feeType} onChange={e => setForm(f => ({ ...f, feeType: e.target.value as FeeAgreement['type'] }))}>
                        <option value="standard">Standard</option>
                        <option value="custom">Custom %</option>
                        <option value="retainer">Retainer</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Guarantee Period (months)</label>
                      <input type="number" className={INPUT_CLASS} placeholder="3" value={form.guaranteePeriod} onChange={e => setForm(f => ({ ...f, guaranteePeriod: e.target.value }))} />
                    </div>
                  </div>

                  {form.feeType === 'custom' && (
                    <div className="mt-3">
                      <label className={LABEL_CLASS}>Custom Percentage (%)</label>
                      <input type="number" className={INPUT_CLASS} placeholder="20" value={form.customPercentage} onChange={e => setForm(f => ({ ...f, customPercentage: e.target.value }))} />
                    </div>
                  )}

                  {form.feeType === 'retainer' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className={LABEL_CLASS}>Upfront Retainer (€)</label>
                        <input type="number" className={INPUT_CLASS} placeholder="5000" value={form.retainerAmount} onChange={e => setForm(f => ({ ...f, retainerAmount: e.target.value }))} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>On Placement (%)</label>
                        <input type="number" className={INPUT_CLASS} placeholder="12" value={form.retainerPercentage} onChange={e => setForm(f => ({ ...f, retainerPercentage: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={addClient}
                  disabled={!form.companyName.trim() || !form.contactName.trim()}
                  className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Add Client
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 bg-[rgba(45,74,45,0.08)] hover:bg-[rgba(45,74,45,0.14)] text-[#6B7280] hover:text-[#2D4A2D] py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

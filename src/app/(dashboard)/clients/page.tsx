'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client, FeeAgreement, TimelineEntry } from '@/lib/types';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Search, SlidersHorizontal, Building2, MapPin, User, Upload } from 'lucide-react';
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

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Filters
  const [filterType, setFilterType] = useState<'all' | Client['type']>('all');
  const [filterSector, setFilterSector] = useState('');
  const [filterSize, setFilterSize] = useState<'' | Client['size']>('');
  const [filterLocation, setFilterLocation] = useState('');

  useEffect(() => {
    db.getClients().then(setClients);
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    if (q && !c.companyName.toLowerCase().includes(q) &&
      !c.contactName.toLowerCase().includes(q) &&
      !c.sector.toLowerCase().includes(q) &&
      !c.location.toLowerCase().includes(q)) return false;
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterSector && c.sector !== filterSector) return false;
    if (filterSize && c.size !== filterSize) return false;
    if (filterLocation && !c.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    return true;
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

  const clearFilters = () => {
    setFilterType('all');
    setFilterSector('');
    setFilterSize('');
    setFilterLocation('');
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Clients</h1>
          <p className="text-[#94a3b8] text-sm">{filtered.length} of {clients.length} clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-[#0d1f3c] hover:bg-[#1e3a5f] border border-[#1e3a5f] hover:border-[#7C3AED40] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload size={16} /> Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
          <input
            className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
            placeholder="Search by company, contact, sector, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${showFilters ? 'bg-[#7C3AED20] border-[#7C3AED] text-[#7C3AED]' : 'bg-[#0d1f3c] border-[#1e3a5f] text-[#94a3b8] hover:text-white'}`}
        >
          <SlidersHorizontal size={15} />
          Filters
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Filter Clients</p>
            <button onClick={clearFilters} className="text-[#94a3b8] text-xs hover:text-white transition-colors">Clear all</button>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Type</label>
              <select
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                value={filterType}
                onChange={e => setFilterType(e.target.value as typeof filterType)}
              >
                <option value="all">All</option>
                <option value="prospect">Prospect</option>
                <option value="active">Active Client</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Sector</label>
              <select
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                value={filterSector}
                onChange={e => setFilterSector(e.target.value)}
              >
                <option value="">All Sectors</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Company Size</label>
              <select
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                value={filterSize}
                onChange={e => setFilterSize(e.target.value as typeof filterSize)}
              >
                <option value="">All Sizes</option>
                {SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
              <input
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="e.g. Amsterdam"
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {clients.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-white font-semibold mb-1">No clients yet</p>
          <p className="text-[#94a3b8] text-sm mb-4">Add your first client to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Client
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <Search size={32} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-[#94a3b8] text-sm">No clients match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/clients/${c.id}`)}
              className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 cursor-pointer hover:border-[#7C3AED40] transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#7C3AED20] flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-[#7C3AED]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm group-hover:text-[#7C3AED] transition-colors">
                      {c.companyName}
                    </p>
                    <p className="text-[#94a3b8] text-xs">{c.sector}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[c.type]}`}>
                  {TYPE_LABELS[c.type]}
                </span>
              </div>

              <div className="space-y-1.5">
                {c.contactName && (
                  <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
                    <User size={11} className="flex-shrink-0" />
                    <span className="truncate">{c.contactName} · {c.contactRole}</span>
                  </div>
                )}
                {c.location && (
                  <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{c.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
                  <Building2 size={11} className="flex-shrink-0" />
                  <span>{SIZE_LABELS[c.size]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <CsvImportModal
          existingClients={clients}
          onClose={() => setShowImport(false)}
          onImport={(newClients) => { handleImport(newClients); }}
        />
      )}

      {/* Add Client Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Add New Client</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Company info */}
              <p className="text-[#7C3AED] text-xs font-semibold uppercase tracking-wider">Company</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Company Name *</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="Acme Corp"
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Website</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="https://acme.com"
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Sector</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.sector}
                    onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Size</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value as Client['size'] }))}
                  >
                    {SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Type</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as Client['type'] }))}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active Client</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
                <input
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  placeholder="Amsterdam"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              {/* Contact */}
              <p className="text-[#7C3AED] text-xs font-semibold uppercase tracking-wider pt-1">Primary Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Contact Name *</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="Jane Smith"
                    value={form.contactName}
                    onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Role</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="HR Manager"
                    value={form.contactRole}
                    onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="jane@acme.com"
                    value={form.contactEmail}
                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Phone</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="+31 20 123 4567"
                    value={form.contactPhone}
                    onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Fee Agreement */}
              <p className="text-[#7C3AED] text-xs font-semibold uppercase tracking-wider pt-1">Fee Agreement</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Fee Type</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.feeType}
                    onChange={e => setForm(f => ({ ...f, feeType: e.target.value as FeeAgreement['type'] }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="custom">Custom %</option>
                    <option value="retainer">Retainer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Guarantee Period (months)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="3"
                    value={form.guaranteePeriod}
                    onChange={e => setForm(f => ({ ...f, guaranteePeriod: e.target.value }))}
                  />
                </div>
              </div>

              {form.feeType === 'custom' && (
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Custom Percentage (%)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="20"
                    value={form.customPercentage}
                    onChange={e => setForm(f => ({ ...f, customPercentage: e.target.value }))}
                  />
                </div>
              )}

              {form.feeType === 'retainer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-medium mb-1">Upfront Retainer (€)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                      placeholder="5000"
                      value={form.retainerAmount}
                      onChange={e => setForm(f => ({ ...f, retainerAmount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-medium mb-1">On Placement (%)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                      placeholder="12"
                      value={form.retainerPercentage}
                      onChange={e => setForm(f => ({ ...f, retainerPercentage: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={addClient}
                disabled={!form.companyName.trim() || !form.contactName.trim()}
                className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Add Client
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateProfile, TimelineEntry } from '@/lib/types';
import { db } from '@/lib/db';
import { geocodePostalCode, haversineDistance } from '@/lib/geocoding';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Search, SlidersHorizontal, UserCircle, MapPin, Briefcase, Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BRANCHES = ['IT', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Healthcare', 'Legal', 'HR', 'Other'];
const RADIUS_OPTIONS = [10, 25, 50, 100];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:  { bg: 'rgba(76,175,80,0.12)',  color: '#4CAF50' },
  passive: { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  placed:  { bg: 'rgba(45,74,45,0.15)', color: '#3D6B3D' },
};

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  postalCode: '',
  linkedin: '',
  jobTitle: '',
  branch: 'IT',
  salaryExpectation: '',
  status: 'active' as CandidateProfile['status'],
};

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | CandidateProfile['status']>('all');
  const [filterPostalCode, setFilterPostalCode] = useState('');
  const [filterRadius, setFilterRadius] = useState(25);

  // Geocoding
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Map<string, { lat: number; lng: number } | null>>(new Map());
  const [distanceFilter, setDistanceFilter] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    db.getCandidateProfiles().then(setCandidates);
  }, []);

  const applyDistanceFilter = useCallback(async () => {
    if (!filterPostalCode.trim()) {
      setDistanceFilter(new Map());
      return;
    }
    setIsGeocoding(true);
    try {
      // Geocode origin
      let origin = geocodeCache.get(filterPostalCode);
      if (origin === undefined) {
        origin = await geocodePostalCode(filterPostalCode);
        setGeocodeCache(prev => new Map(prev).set(filterPostalCode, origin ?? null));
      }
      if (!origin) {
        setDistanceFilter(new Map());
        setIsGeocoding(false);
        return;
      }

      // Geocode each candidate's postal code
      const newMap = new Map<string, number>();
      const toGeocode = candidates.filter(c => c.postalCode && !geocodeCache.has(c.postalCode));

      const results = await Promise.all(
        toGeocode.map(async c => {
          const coords = await geocodePostalCode(c.postalCode);
          return { postalCode: c.postalCode, coords };
        })
      );

      const newCache = new Map(geocodeCache);
      for (const r of results) {
        newCache.set(r.postalCode, r.coords);
      }
      setGeocodeCache(newCache);

      for (const c of candidates) {
        if (!c.postalCode) continue;
        const coords = newCache.get(c.postalCode);
        if (coords && origin) {
          const dist = haversineDistance(origin.lat, origin.lng, coords.lat, coords.lng);
          newMap.set(c.id, dist);
        }
      }
      setDistanceFilter(newMap);
    } finally {
      setIsGeocoding(false);
    }
  }, [filterPostalCode, candidates, geocodeCache]);

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase();
    if (q && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) &&
      !c.jobTitle.toLowerCase().includes(q) &&
      !c.branch.toLowerCase().includes(q)) return false;

    if (filterBranch && c.branch !== filterBranch) return false;
    if (filterJobTitle && !c.jobTitle.toLowerCase().includes(filterJobTitle.toLowerCase())) return false;
    if (filterLocation && !c.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;

    if (filterPostalCode.trim() && distanceFilter.size > 0) {
      const dist = distanceFilter.get(c.id);
      if (dist === undefined || dist > filterRadius) return false;
    }

    return true;
  });

  const addCandidate = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return;
    const now = new Date().toISOString();
    const timeline: TimelineEntry[] = [{
      id: uuidv4(),
      type: 'created',
      content: 'Candidate profile created',
      createdAt: now,
    }];
    const newCandidate: CandidateProfile = {
      id: uuidv4(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      postalCode: form.postalCode.trim(),
      linkedin: form.linkedin.trim() || undefined,
      jobTitle: form.jobTitle.trim(),
      branch: form.branch,
      salaryExpectation: form.salaryExpectation ? parseInt(form.salaryExpectation) : undefined,
      status: form.status,
      notes: '',
      timedNotes: [],
      documents: [],
      timeline,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...candidates, newCandidate];
    setCandidates(updated);
    db.saveCandidateProfiles(updated);
    setForm(EMPTY_FORM);
    setShowAdd(false);
  };

  const clearFilters = () => {
    setFilterBranch('');
    setFilterJobTitle('');
    setFilterLocation('');
    setFilterStatus('all');
    setFilterPostalCode('');
    setFilterRadius(25);
    setDistanceFilter(new Map());
  };

  const INP = "w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors";
  const INP_STYLE = { background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.2)' };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-semibold text-[#2D4A2D] tracking-tight">Candidates</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">{filtered.length} of {candidates.length} candidates</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Add Candidate
        </motion.button>
      </motion.div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            className={`${INP} pl-9`}
            style={INP_STYLE}
            placeholder="Search by name, job title, branch..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{
            background: showFilters ? 'rgba(45,74,45,0.12)' : '#FFFFFF',
            border: showFilters ? '1px solid rgba(45,74,45,0.4)' : '1px solid rgba(45,74,45,0.15)',
            color: showFilters ? '#3D6B3D' : '#6B7280',
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden mb-5"
        >
        <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.12)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#2D4A2D] font-medium text-sm">Filter Candidates</p>
            <button onClick={clearFilters} className="text-[#6B7280] text-xs hover:text-[#6B7280] transition-colors">Clear all</button>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Branch</label>
              <select
                className={INP}
                style={INP_STYLE}
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
              >
                <option value="">All Branches</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Job Title</label>
              <input
                className={INP}
                style={INP_STYLE}
                placeholder="e.g. Developer"
                value={filterJobTitle}
                onChange={e => setFilterJobTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Location</label>
              <input
                className={INP}
                style={INP_STYLE}
                placeholder="e.g. Amsterdam"
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Status</label>
              <select
                className={INP}
                style={INP_STYLE}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="passive">Passive</option>
                <option value="placed">Placed</option>
              </select>
            </div>
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Postal Code (Distance Filter)</label>
              <input
                className={INP}
                style={INP_STYLE}
                placeholder="e.g. 1234 AB"
                value={filterPostalCode}
                onChange={e => setFilterPostalCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[#6B7280] text-xs font-medium mb-1">Radius (km)</label>
              <div className="flex gap-2">
                <select
                  className={`flex-1 ${INP}`}
                  style={INP_STYLE}
                  value={filterRadius}
                  onChange={e => setFilterRadius(Number(e.target.value))}
                >
                  {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} km</option>)}
                </select>
                <button
                  onClick={applyDistanceFilter}
                  disabled={isGeocoding || !filterPostalCode.trim()}
                  className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isGeocoding ? <Loader2 size={13} className="animate-spin" /> : null}
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Table */}
      {candidates.length === 0 ? (
        <div className="rounded-xl p-20 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.12)' }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(45,74,45,0.1)' }}>
            <UserCircle size={28} className="text-[#2D4A2D]" />
          </div>
          <p className="text-[#2D4A2D] font-semibold mb-1">No candidates yet</p>
          <p className="text-[#6B7280] text-sm mb-5">Add your first candidate to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Add your first candidate →
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-16 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.12)' }}>
          <Search size={28} className="mx-auto mb-3 text-[#6B7280]" />
          <p className="text-[#6B7280] text-sm">No candidates match your filters.</p>
        </div>
      ) : (
        /* Clean table-row list */
        <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.12)' }}>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_120px_100px_32px] gap-4 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]"
            style={{ borderBottom: '1px solid rgba(45,74,45,0.1)' }}
          >
            <span>Candidate</span>
            <span>Location · Branch</span>
            <span>Salary</span>
            <span className="text-right">Status</span>
            <span />
          </div>
          {/* Rows */}
          <div>
            {filtered.map((c, i) => {
              const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.active;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => router.push(`/candidates/${c.id}`)}
                  className="grid grid-cols-[1fr_1fr_120px_100px_32px] gap-4 items-center px-5 py-3.5 cursor-pointer group transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(45,74,45,0.06)' : undefined }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(45,74,45,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{ background: 'rgba(45,74,45,0.15)', color: '#3D6B3D' }}
                    >
                      {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#2D4A2D] text-sm font-medium truncate group-hover:text-[#3D6B3D] transition-colors">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-[#6B7280] text-xs truncate">{c.jobTitle}</p>
                    </div>
                  </div>
                  {/* Location · Branch */}
                  <div className="min-w-0">
                    {c.location && (
                      <div className="flex items-center gap-1.5 text-[#6B7280] text-xs truncate">
                        <MapPin size={10} className="flex-shrink-0 text-[#6B7280]" />
                        <span className="truncate">{c.location}{c.postalCode ? ` · ${c.postalCode}` : ''}</span>
                      </div>
                    )}
                    {c.branch && (
                      <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mt-0.5">
                        <Briefcase size={10} className="flex-shrink-0" />
                        <span>{c.branch}</span>
                        {filterPostalCode.trim() && distanceFilter.has(c.id) && (
                          <span className="text-[#3D6B3D] font-medium">· ~{Math.round(distanceFilter.get(c.id)!)}km</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Salary */}
                  <div className="text-sm text-[#6B7280]">
                    {c.salaryExpectation ? `€${c.salaryExpectation.toLocaleString()}` : <span className="text-[#6B7280]">—</span>}
                  </div>
                  {/* Status */}
                  <div className="flex justify-end">
                    <span
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
                      style={{ background: ss.bg, color: ss.color }}
                    >
                      {c.status}
                    </span>
                  </div>
                  {/* Arrow */}
                  <ChevronRight size={14} className="text-[#6B7280] group-hover:text-[#3D6B3D] transition-colors" />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      <AnimatePresence>
      {showAdd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl shadow-black/60"
            style={{ background: '#FFFFFF', border: '1px solid rgba(45,74,45,0.2)' }}
          >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[#2D4A2D] font-semibold">Add New Candidate</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">First Name *</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Last Name *</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Phone</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="+31 6 12345678"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Location</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="Amsterdam"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Postal Code</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="1234 AB"
                    value={form.postalCode}
                    onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#6B7280] text-xs font-medium mb-1">LinkedIn</label>
                <input
                  className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin}
                  onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Job Title</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="Software Engineer"
                    value={form.jobTitle}
                    onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Branch</label>
                  <select
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none transition-colors"
                    style={INP_STYLE}
                    value={form.branch}
                    onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Salary Expectation (€)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors" style={INP_STYLE}
                    placeholder="70000"
                    value={form.salaryExpectation}
                    onChange={e => setForm(f => ({ ...f, salaryExpectation: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1">Status</label>
                  <select
                    className="w-full rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none transition-colors"
                    style={INP_STYLE}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as CandidateProfile['status'] }))}
                  >
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={addCandidate}
                disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Add Candidate
              </motion.button>
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 text-[#6B7280] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm"
                style={{ background: 'rgba(45,74,45,0.08)', border: '1px solid rgba(45,74,45,0.15)' }}
              >
                Cancel
              </button>
            </div>
          </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

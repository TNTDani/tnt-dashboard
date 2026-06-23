'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CandidateProfile, TimelineEntry } from '@/lib/types';
import { db, initDb } from '@/lib/db';
import { geocodePostalCode, haversineDistance } from '@/lib/geocoding';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Search, SlidersHorizontal, UserCircle, MapPin, Briefcase, Loader2, Euro, ChevronUp, ChevronDown, Mail, ArrowRight, Download } from 'lucide-react';

function exportCsv(rows: CandidateProfile[]) {
  const headers = ['First name', 'Last name', 'Email', 'Phone', 'Location', 'Job title', 'Branch', 'Status', 'Salary expectation', 'LinkedIn'];
  const lines = [
    headers.join(','),
    ...rows.map(c => [
      c.firstName, c.lastName, c.email, c.phone ?? '',
      c.location ?? '', c.jobTitle, c.branch, c.status,
      c.salaryExpectation ?? '', c.linkedin ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'candidates.csv'; a.click();
  URL.revokeObjectURL(url);
}
import { motion, AnimatePresence } from 'motion/react';

const BRANCHES = ['IT', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Healthcare', 'Legal', 'HR', 'Other'];
const RADIUS_OPTIONS = [10, 25, 50, 100];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:  { bg: 'rgba(76,175,80,0.12)',  color: '#22863a' },
  passive: { bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  placed:  { bg: 'rgba(45,74,45,0.15)',   color: '#3D6B3D' },
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

const INP = "w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors";
const SELECT = "w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors";

export default function CandidatesPage() {
  const router = useRouter();
  const { data: session } = useSession();
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

  // Sort
  type SortKey = 'name' | 'branch' | 'location' | 'salary' | 'status';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Geocoding
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Map<string, { lat: number; lng: number } | null>>(new Map());
  const [distanceFilter, setDistanceFilter] = useState<Map<string, number>>(new Map());

  const agencyId = session?.user?.agencyId;

  // Load persisted filters
  useEffect(() => {
    if (!agencyId) return;
    try {
      const saved = localStorage.getItem(`filters_candidates_${agencyId}`);
      if (saved) {
        const f = JSON.parse(saved);
        if (f.branch) setFilterBranch(f.branch);
        if (f.jobTitle) setFilterJobTitle(f.jobTitle);
        if (f.location) setFilterLocation(f.location);
        if (f.status) setFilterStatus(f.status);
        if (f.sortKey) setSortKey(f.sortKey);
        if (f.sortDir) setSortDir(f.sortDir);
      }
    } catch { /* ignore */ }
  }, [agencyId]);

  // Persist filters on change
  useEffect(() => {
    if (!agencyId) return;
    localStorage.setItem(`filters_candidates_${agencyId}`, JSON.stringify({
      branch: filterBranch, jobTitle: filterJobTitle, location: filterLocation,
      status: filterStatus, sortKey, sortDir,
    }));
  }, [agencyId, filterBranch, filterJobTitle, filterLocation, filterStatus, sortKey, sortDir]);

  useEffect(() => {
    if (!agencyId) return;
    initDb(agencyId);
    db.getCandidateProfiles().then(setCandidates).catch(() => {});
  }, [agencyId]);

  const applyDistanceFilter = useCallback(async () => {
    if (!filterPostalCode.trim()) {
      setDistanceFilter(new Map());
      return;
    }
    setIsGeocoding(true);
    try {
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

  const filtered = candidates
    .filter(c => {
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
    })
    .sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortKey === 'name') { av = `${a.firstName} ${a.lastName}`; bv = `${b.firstName} ${b.lastName}`; }
      else if (sortKey === 'branch') { av = a.branch ?? ''; bv = b.branch ?? ''; }
      else if (sortKey === 'location') { av = a.location ?? ''; bv = b.location ?? ''; }
      else if (sortKey === 'salary') {
        const diff = (a.salaryExpectation ?? 0) - (b.salaryExpectation ?? 0);
        return sortDir === 'asc' ? diff : -diff;
      }
      else if (sortKey === 'status') { av = a.status; bv = b.status; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
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

  const activeFilterCount = [
    filterBranch,
    filterJobTitle,
    filterLocation,
    filterStatus !== 'all' ? filterStatus : '',
    filterPostalCode,
  ].filter(Boolean).length;

  return (
    <div>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[#2D4A2D] tracking-tight">Candidates</h1>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: 'rgba(45,74,45,0.1)', color: '#2D4A2D' }}
          >
            {candidates.length}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => exportCsv(filtered)}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
          style={{ border: '1px solid rgba(45,74,45,0.2)', color: '#2D4A2D' }}
          title="Export to CSV"
        >
          <Download size={15} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#2D4A2D] text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-[#3D6B3D] transition-colors"
        >
          <Plus size={15} /> Add Candidate
        </motion.button>
      </motion.div>

      {/* ── Search + filter toggle ── */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
          <input
            className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl pl-9 pr-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors"
            placeholder="Search by name, job title, branch…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: showFilters ? 'rgba(45,74,45,0.1)' : '#FFFFFF',
            border: showFilters ? '1px solid rgba(45,74,45,0.35)' : '1px solid rgba(45,74,45,0.15)',
            color: showFilters ? '#2D4A2D' : '#6B7280',
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span
              className="rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: '#2D4A2D' }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Collapsible filter panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[#2D4A2D] font-medium text-sm">Filter Candidates</p>
                <button
                  onClick={clearFilters}
                  className="text-[#6B7280] text-xs hover:text-[#2D4A2D] transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Branch</label>
                  <select className={SELECT} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                    <option value="">All Branches</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Job Title</label>
                  <input
                    className={INP}
                    placeholder="e.g. Developer"
                    value={filterJobTitle}
                    onChange={e => setFilterJobTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Location</label>
                  <input
                    className={INP}
                    placeholder="e.g. Amsterdam"
                    value={filterLocation}
                    onChange={e => setFilterLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Status</label>
                  <select className={SELECT} value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Postal Code (Distance Filter)</label>
                  <input
                    className={INP}
                    placeholder="e.g. 1234 AB"
                    value={filterPostalCode}
                    onChange={e => setFilterPostalCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Radius (km)</label>
                  <div className="flex gap-2">
                    <select
                      className={`flex-1 ${SELECT}`}
                      value={filterRadius}
                      onChange={e => setFilterRadius(Number(e.target.value))}
                    >
                      {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} km</option>)}
                    </select>
                    <button
                      onClick={applyDistanceFilter}
                      disabled={isGeocoding || !filterPostalCode.trim()}
                      className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
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

      {/* ── Content ── */}
      {candidates.length === 0 ? (
        /* Empty state — no candidates at all */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-20 text-center"
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(45,74,45,0.1)' }}
          >
            <UserCircle size={28} className="text-[#2D4A2D]" />
          </div>
          <p className="text-[#2D4A2D] font-semibold mb-1">No candidates yet</p>
          <p className="text-[#6B7280] text-sm mb-5">Add your first candidate to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Add your first candidate
          </button>
        </motion.div>
      ) : filtered.length === 0 ? (
        /* Empty state — filters returned nothing */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-16 text-center"
        >
          <Search size={28} className="mx-auto mb-3 text-[#6B7280]" />
          <p className="text-[#2D4A2D] font-medium mb-1">No candidates match your filters</p>
          <p className="text-[#6B7280] text-sm">Try adjusting your search or clearing the filters.</p>
        </motion.div>
      ) : (
        /* ── Candidate data table ── */
        <div className="bg-white rounded-2xl border border-[rgba(20,33,26,0.08)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] items-center px-4 py-2.5 border-b border-[rgba(20,33,26,0.06)] bg-[#fafafa]">
            {[
              { key: 'name', label: 'Name' },
              { key: 'branch', label: 'Sector' },
              { key: 'location', label: 'Location' },
              { key: 'salary', label: 'Salary' },
              { key: 'status', label: 'Status' },
            ].map(col => (
              <button
                key={col.key}
                onClick={() => {
                  if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                  else { setSortKey(col.key as SortKey); setSortDir('asc'); }
                }}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#8a9a90] hover:text-[#2D4A2D] transition-colors text-left"
              >
                {col.label}
                <span className="flex flex-col gap-px">
                  <ChevronUp size={9} className={sortKey === col.key && sortDir === 'asc' ? 'text-[#2D4A2D]' : 'text-[rgba(20,33,26,0.2)]'} />
                  <ChevronDown size={9} className={sortKey === col.key && sortDir === 'desc' ? 'text-[#2D4A2D]' : 'text-[rgba(20,33,26,0.2)]'} />
                </span>
              </button>
            ))}
            <div />
          </div>

          {/* Table rows */}
          <div className="divide-y divide-[rgba(20,33,26,0.05)]">
            {filtered.map((c, i) => {
              const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.active;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  onClick={() => router.push(`/candidates/${c.id}`)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] items-center px-4 py-3 cursor-pointer group hover:bg-[rgba(45,74,45,0.02)] transition-colors relative"
                >
                  {/* Left moss accent on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#2D4A2D] opacity-0 group-hover:opacity-100 transition-opacity rounded-l" />

                  {/* Name + role */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ background: 'rgba(45,74,45,0.10)', color: '#2D4A2D' }}
                    >
                      {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#0f1711] text-sm font-medium leading-tight truncate group-hover:text-[#2D4A2D] transition-colors">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-[#8a9a90] text-xs truncate mt-0.5">{c.jobTitle || '—'}</p>
                    </div>
                  </div>

                  {/* Sector / branch */}
                  <div className="min-w-0">
                    {c.branch ? (
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium truncate max-w-full"
                        style={{ background: 'rgba(45,74,45,0.08)', color: '#2D4A2D' }}
                      >
                        {c.branch}
                      </span>
                    ) : (
                      <span className="text-[#8a9a90] text-xs">—</span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="min-w-0">
                    {c.location ? (
                      <div className="flex items-center gap-1 text-[#5a6a60] text-xs truncate">
                        <MapPin size={10} className="flex-shrink-0 text-[#8a9a90]" />
                        <span className="truncate">
                          {c.location}
                          {filterPostalCode.trim() && distanceFilter.has(c.id) && (
                            <span className="text-[#2D4A2D] font-medium"> · ~{Math.round(distanceFilter.get(c.id)!)}km</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#8a9a90] text-xs">—</span>
                    )}
                  </div>

                  {/* Salary */}
                  <div>
                    {c.salaryExpectation ? (
                      <div className="flex items-center gap-1 text-[#5a6a60] text-xs">
                        <Euro size={10} className="text-[#8a9a90]" />
                        <span>{c.salaryExpectation.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="text-[#8a9a90] text-xs">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                      style={{ background: ss.bg, color: ss.color }}
                    >
                      {c.status}
                    </span>
                  </div>

                  {/* Actions (hover-reveal) */}
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); window.location.href = `mailto:${c.email}`; }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8a9a90] hover:text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.08)] transition-colors"
                      title="Send email"
                    >
                      <Mail size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/candidates/${c.id}`); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8a9a90] hover:text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.08)] transition-colors"
                      title="View profile"
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Table footer */}
          <div className="px-4 py-2.5 border-t border-[rgba(20,33,26,0.06)] bg-[#fafafa]">
            <p className="text-[10px] text-[#8a9a90]">{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* ── Add Candidate Modal ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 bg-white border border-[rgba(45,74,45,0.2)]"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[#2D4A2D] font-semibold text-base">Add New Candidate</h2>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">First Name *</label>
                      <input
                        className={INP}
                        placeholder="First name"
                        value={form.firstName}
                        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Last Name *</label>
                      <input
                        className={INP}
                        placeholder="Last name"
                        value={form.lastName}
                        onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Email *</label>
                      <input
                        type="email"
                        className={INP}
                        placeholder="email@example.com"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Phone</label>
                      <input
                        className={INP}
                        placeholder="+31 6 12345678"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Location</label>
                      <input
                        className={INP}
                        placeholder="Amsterdam"
                        value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Postal Code</label>
                      <input
                        className={INP}
                        placeholder="1234 AB"
                        value={form.postalCode}
                        onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#6B7280] text-xs font-medium mb-1.5">LinkedIn</label>
                    <input
                      className={INP}
                      placeholder="https://linkedin.com/in/..."
                      value={form.linkedin}
                      onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Job Title</label>
                      <input
                        className={INP}
                        placeholder="Software Engineer"
                        value={form.jobTitle}
                        onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Branch</label>
                      <select
                        className={SELECT}
                        value={form.branch}
                        onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                      >
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Salary Expectation (€)</label>
                      <input
                        type="number"
                        className={INP}
                        placeholder="70000"
                        value={form.salaryExpectation}
                        onChange={e => setForm(f => ({ ...f, salaryExpectation: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Status</label>
                      <select
                        className={SELECT}
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

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={addCandidate}
                    disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                    className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Add Candidate
                  </motion.button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-2.5 rounded-xl transition-colors text-sm text-[#6B7280] hover:text-[#2D4A2D]"
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

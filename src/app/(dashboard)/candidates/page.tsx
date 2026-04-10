'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateProfile, TimelineEntry } from '@/lib/types';
import { db } from '@/lib/db';
import { geocodePostalCode, haversineDistance } from '@/lib/geocoding';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Search, SlidersHorizontal, UserCircle, MapPin, Briefcase, Loader2 } from 'lucide-react';

const BRANCHES = ['IT', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Healthcare', 'Legal', 'HR', 'Other'];
const RADIUS_OPTIONS = [10, 25, 50, 100];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  passive: 'bg-amber-500/20 text-amber-400',
  placed: 'bg-purple-500/20 text-purple-300',
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Candidates</h1>
          <p className="text-[#94a3b8] text-sm">{filtered.length} of {candidates.length} candidates</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Candidate
        </button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
          <input
            className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
            placeholder="Search by name, job title, branch..."
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
            <p className="text-white font-semibold text-sm">Filter Candidates</p>
            <button onClick={clearFilters} className="text-[#94a3b8] text-xs hover:text-white transition-colors">Clear all</button>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Branch</label>
              <select
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
              >
                <option value="">All Branches</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Job Title</label>
              <input
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="e.g. Developer"
                value={filterJobTitle}
                onChange={e => setFilterJobTitle(e.target.value)}
              />
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
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Status</label>
              <select
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
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
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Postal Code (Distance Filter)</label>
              <input
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="e.g. 1234 AB"
                value={filterPostalCode}
                onChange={e => setFilterPostalCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Radius (km)</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                  value={filterRadius}
                  onChange={e => setFilterRadius(Number(e.target.value))}
                >
                  {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} km</option>)}
                </select>
                <button
                  onClick={applyDistanceFilter}
                  disabled={isGeocoding || !filterPostalCode.trim()}
                  className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isGeocoding ? <Loader2 size={13} className="animate-spin" /> : null}
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {candidates.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <UserCircle size={40} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-white font-semibold mb-1">No candidates yet</p>
          <p className="text-[#94a3b8] text-sm mb-4">Add your first candidate to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Candidate
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-16 text-center">
          <Search size={32} className="mx-auto mb-3 text-[#1e3a5f]" />
          <p className="text-[#94a3b8] text-sm">No candidates match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/candidates/${c.id}`)}
              className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5 cursor-pointer hover:border-[#7C3AED40] hover:bg-[#0d1f3c] transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#7C3AED30] flex items-center justify-center text-[#7C3AED] font-bold text-sm flex-shrink-0">
                    {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm group-hover:text-[#7C3AED] transition-colors">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[#94a3b8] text-xs">{c.jobTitle}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
              </div>

              <div className="space-y-1.5">
                {c.location && (
                  <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{c.location}{c.postalCode ? ` · ${c.postalCode}` : ''}</span>
                  </div>
                )}
                {c.branch && (
                  <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
                    <Briefcase size={11} className="flex-shrink-0" />
                    <span>{c.branch}</span>
                  </div>
                )}
                {filterPostalCode.trim() && distanceFilter.has(c.id) && (
                  <div className="text-[10px] text-[#7C3AED] font-medium">
                    ~{Math.round(distanceFilter.get(c.id)!)} km away
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Add New Candidate</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#94a3b8] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">First Name *</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Last Name *</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Phone</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="+31 6 12345678"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Location</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="Amsterdam"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Postal Code</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="1234 AB"
                    value={form.postalCode}
                    onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">LinkedIn</label>
                <input
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin}
                  onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Job Title</label>
                  <input
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="Software Engineer"
                    value={form.jobTitle}
                    onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Branch</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                    value={form.branch}
                    onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
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
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="70000"
                    value={form.salaryExpectation}
                    onChange={e => setForm(f => ({ ...f, salaryExpectation: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Status</label>
                  <select
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
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
              <button
                onClick={addCandidate}
                disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Add Candidate
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

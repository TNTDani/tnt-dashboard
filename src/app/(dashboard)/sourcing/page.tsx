'use client';

import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { db } from '@/lib/db';
import { SourcingStrategy, SourcingProfileDescription } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import {
  Search, Sparkles, Loader2, X, Download, Save,
  MapPin, Briefcase, Link as LinkIcon, Users, Code, Globe,
  ChevronDown, ChevronUp, Copy, Check, ScanLine, AlertCircle,
} from 'lucide-react';

const SENIORITY_LEVELS = ['Junior', 'Medior', 'Senior', 'Lead', 'Principal', 'Manager', 'Director', 'VP', 'C-Level'];

interface FormState {
  jobTitle: string;
  skills: string[];
  location: string;
  seniorityLevel: string;
  salaryMin: string;
  salaryMax: string;
  vacancyLink: string;
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="min-h-[42px] w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 flex flex-wrap gap-1.5 cursor-text focus-within:border-[#2D4A2D] transition-colors"
      onClick={() => document.getElementById('tag-input')?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 bg-[#2D4A2D30] text-[#3D6B3D] text-xs px-2 py-0.5 rounded-md">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-[#2D4A2D] transition-colors">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        id="tag-input"
        type="text"
        className="flex-1 min-w-[120px] bg-transparent text-[#2D4A2D] text-sm placeholder-[#6B7280] outline-none"
        placeholder={tags.length === 0 ? placeholder : ''}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
      />
    </div>
  );
}

function ProfileCard({ profile, index }: { profile: SourcingProfileDescription; index: number }) {
  const [expanded, setExpanded] = useState(index < 2);
  const [copiedOutreach, setCopiedOutreach] = useState(false);

  const copyOutreach = () => {
    navigator.clipboard.writeText(profile.outreachMessage);
    setCopiedOutreach(true);
    setTimeout(() => setCopiedOutreach(false), 2000);
  };

  return (
    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#FFFFFF] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2D4A2D20] flex items-center justify-center text-[#2D4A2D] text-sm font-bold flex-shrink-0">
            {index + 1}
          </div>
          <div>
            <p className="text-[#2D4A2D] font-semibold text-sm">{profile.title}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {profile.keySkills.slice(0, 3).map((skill, i) => (
                <span key={i} className="text-[10px] bg-[rgba(45,74,45,0.15)] text-[#94a3b8] px-1.5 py-0.5 rounded">
                  {skill}
                </span>
              ))}
              {profile.keySkills.length > 3 && (
                <span className="text-[10px] text-[#6B7280]">+{profile.keySkills.length - 3} more</span>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#94a3b8] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#94a3b8] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[rgba(45,74,45,0.15)] pt-4">
          {/* Background */}
          <div>
            <p className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider mb-1.5">Ideal Background</p>
            <p className="text-[#94a3b8] text-sm leading-relaxed">{profile.backgroundDescription}</p>
          </div>

          {/* Key Skills */}
          <div>
            <p className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider mb-1.5">Key Skills to Look For</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.keySkills.map((skill, i) => (
                <span key={i} className="text-xs bg-[#2D4A2D20] text-[#3D6B3D] border border-[#2D4A2D30] px-2 py-0.5 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Where to Find */}
          <div>
            <p className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider mb-2">Where to Find Them</p>
            <div className="space-y-2">
              {profile.whereToFind.linkedinSearchUrl && (
                <a
                  href={profile.whereToFind.linkedinSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 hover:border-[#2D4A2D] transition-colors group"
                >
                  <Users size={14} className="text-[#0077b5] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-xs group-hover:text-[#2D4A2D] transition-colors truncate">LinkedIn Search →</span>
                </a>
              )}
              {profile.whereToFind.githubSearch && (
                <a
                  href={profile.whereToFind.githubSearch}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 hover:border-[#2D4A2D] transition-colors group"
                >
                  <Code size={14} className="text-[#94a3b8] flex-shrink-0" />
                  <span className="text-[#94a3b8] text-xs group-hover:text-[#2D4A2D] transition-colors">GitHub Search →</span>
                </a>
              )}
              {profile.whereToFind.communities.length > 0 && (
                <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe size={14} className="text-[#94a3b8]" />
                    <span className="text-[#94a3b8] text-xs font-medium">Communities & Platforms</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.whereToFind.communities.map((c, i) => (
                      <span key={i} className="text-xs bg-[rgba(45,74,45,0.15)] text-[#94a3b8] px-2 py-0.5 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Outreach Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider">Suggested Outreach Message</p>
              <button
                onClick={copyOutreach}
                className="flex items-center gap-1 text-[#94a3b8] hover:text-[#2D4A2D] text-xs transition-colors"
              >
                {copiedOutreach ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copiedOutreach ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg p-3">
              <p className="text-[#94a3b8] text-xs leading-relaxed whitespace-pre-wrap">{profile.outreachMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchStringCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-[#2D4A2D]" />
          <p className="text-[#2D4A2D] font-semibold text-sm">{title}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-3 py-1.5 rounded-md text-xs transition-colors"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg p-3">
        <p className="text-[#94a3b8] text-xs font-mono leading-relaxed break-all">{value}</p>
      </div>
    </div>
  );
}

type AutoFilledField = 'jobTitle' | 'skills' | 'location' | 'seniorityLevel' | 'salaryMin' | 'salaryMax';

function AutoFilledBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-[#2D4A2D20] text-[#3D6B3D] text-[10px] px-1.5 py-0.5 rounded ml-1.5 align-middle">
      <Sparkles size={9} />
      Auto-filled
    </span>
  );
}

export default function SourcingPage() {
  const [form, setForm] = useState<FormState>({
    jobTitle: '',
    skills: [],
    location: 'Amsterdam',
    seniorityLevel: 'Senior',
    salaryMin: '',
    salaryMax: '',
    vacancyLink: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SourcingStrategy | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingToVacancy, setSavingToVacancy] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [vacancySaved, setVacancySaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [autoFilled, setAutoFilled] = useState<Set<AutoFilledField>>(new Set());
  const [lastScannedUrl, setLastScannedUrl] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);

  const [vacancies, setVacancies] = useState<import('@/lib/types').Vacancy[]>([]);
  const [selectedVacancyForSourcing, setSelectedVacancyForSourcing] = useState('');

  useEffect(() => {
    db.getVacancies().then(all => {
      const open = all.filter(v => v.status === 'open');
      setVacancies(open);
      // Pre-select if vacancyId is in the URL
      const paramId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('vacancyId')
        : null;
      if (paramId) {
        const vac = open.find(v => v.id === paramId) ?? all.find(v => v.id === paramId);
        if (vac) {
          setSelectedVacancyForSourcing(vac.id);
          const filled = new Set<AutoFilledField>();
          setForm(prev => {
            const next = { ...prev };
            next.jobTitle = vac.title; filled.add('jobTitle');
            if (Array.isArray(vac.requirements) && vac.requirements.length > 0) {
              next.skills = vac.requirements.slice(0, 10); filled.add('skills');
            }
            if (vac.seniorityLevel && SENIORITY_LEVELS.includes(vac.seniorityLevel)) {
              next.seniorityLevel = vac.seniorityLevel; filled.add('seniorityLevel');
            }
            if (vac.salaryMin) { next.salaryMin = String(vac.salaryMin); filled.add('salaryMin'); }
            if (vac.salaryMax) { next.salaryMax = String(vac.salaryMax); filled.add('salaryMax'); }
            return next;
          });
          setAutoFilled(filled);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAutoFilled = (field: AutoFilledField) => {
    setAutoFilled(prev => { const next = new Set(prev); next.delete(field); return next; });
  };

  const scanVacancyUrl = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http') || trimmed === lastScannedUrl) return;
    setScanning(true);
    setScanError('');
    setLastScannedUrl(trimmed);
    try {
      const res = await fetch('/api/parse-vacancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      const r = data.result;
      const filled = new Set<AutoFilledField>();

      setForm(prev => {
        const next = { ...prev };
        if (r.jobTitle) { next.jobTitle = r.jobTitle; filled.add('jobTitle'); }
        if (Array.isArray(r.skills) && r.skills.length > 0) { next.skills = r.skills; filled.add('skills'); }
        if (r.location) { next.location = r.location; filled.add('location'); }
        if (r.seniorityLevel && SENIORITY_LEVELS.includes(r.seniorityLevel)) { next.seniorityLevel = r.seniorityLevel; filled.add('seniorityLevel'); }
        if (r.salaryMin) { next.salaryMin = String(Math.round(r.salaryMin)); filled.add('salaryMin'); }
        if (r.salaryMax) { next.salaryMax = String(Math.round(r.salaryMax)); filled.add('salaryMax'); }
        return next;
      });

      setAutoFilled(filled);
      if (filled.size === 0) setScanError('Could not extract details, please fill in manually');
    } catch {
      setScanError('Could not extract details, please fill in manually');
      setLastScannedUrl(''); // allow retry
    } finally {
      setScanning(false);
    }
  };

  const handleUrlPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.startsWith('http')) {
      // Update form first, then scan using the pasted value directly
      setForm(f => ({ ...f, vacancyLink: pasted }));
      scanVacancyUrl(pasted);
    }
  };

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    scanVacancyUrl(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobTitle.trim()) { setError('Job title is required.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    setSavedId(null);

    try {
      const salaryRange = form.salaryMin && form.salaryMax
        ? `€${form.salaryMin} - €${form.salaryMax}`
        : form.salaryMin
        ? `From €${form.salaryMin}`
        : form.salaryMax
        ? `Up to €${form.salaryMax}`
        : 'Not specified';

      const res = await fetch('/api/source-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: form.jobTitle,
          skills: form.skills,
          location: form.location,
          seniorityLevel: form.seniorityLevel,
          salaryRange,
          vacancyLink: form.vacancyLink,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate sourcing strategy');

      const strategy: SourcingStrategy = {
        id: uuidv4(),
        jobTitle: form.jobTitle,
        skills: form.skills,
        location: form.location,
        seniorityLevel: form.seniorityLevel,
        salaryRange,
        vacancyLink: form.vacancyLink || undefined,
        profiles: data.result.profiles,
        booleanSearch: data.result.booleanSearch,
        xraySearch: data.result.xraySearch,
        createdAt: new Date().toISOString(),
      };

      setResult(strategy);
      setSavedId(strategy.id);

      // Save to database (fire and forget)
      db.getSourcingStrategies().then(existing => db.saveSourcingStrategies([...existing, strategy]));

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const content = generateTextReport(result, date);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sourcing Strategy - ${result.jobTitle} - ${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = () => {
    if (!result) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = generateHTMLReport(result, date);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sourcing Strategy - ${result.jobTitle} - ${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToVacancy = () => {
    if (!result || !selectedVacancyId) return;
    db.getSourcingStrategies().then(existing => {
      const updated = existing.map(s => s.id === result.id ? { ...s, vacancyId: selectedVacancyId } : s);
      db.saveSourcingStrategies(updated);
    });
    setResult(prev => prev ? { ...prev, vacancyId: selectedVacancyId } : prev);
    setVacancySaved(true);
    setSavingToVacancy(false);
  };

  const handleVacancySelect = (vacancyId: string) => {
    setSelectedVacancyForSourcing(vacancyId);
    if (!vacancyId) return;
    const vac = vacancies.find(v => v.id === vacancyId);
    if (!vac) return;
    const filled = new Set<AutoFilledField>();
    setForm(prev => {
      const next = { ...prev };
      next.jobTitle = vac.title; filled.add('jobTitle');
      if (Array.isArray(vac.requirements) && vac.requirements.length > 0) {
        next.skills = vac.requirements.slice(0, 10); filled.add('skills');
      }
      if (vac.seniorityLevel && SENIORITY_LEVELS.includes(vac.seniorityLevel)) {
        next.seniorityLevel = vac.seniorityLevel; filled.add('seniorityLevel');
      }
      if (vac.salaryMin) { next.salaryMin = String(vac.salaryMin); filled.add('salaryMin'); }
      if (vac.salaryMax) { next.salaryMax = String(vac.salaryMax); filled.add('salaryMax'); }
      return next;
    });
    setAutoFilled(filled);
  };

  const selectedVacancyData = vacancies.find(v => v.id === selectedVacancyForSourcing);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D4A2D]">Source Candidates</h1>
        <p className="text-[#94a3b8] mt-1">AI-powered sourcing strategy generator</p>
      </div>

      {/* Vacancy selector */}
      {vacancies.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={15} className="text-[#2D4A2D]" />
            <h2 className="text-[#2D4A2D] font-semibold text-sm">Source for a Vacancy</h2>
            <span className="text-[#6B7280] text-xs">(optional — auto-fills the form below)</span>
          </div>
          <select
            className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
            value={selectedVacancyForSourcing}
            onChange={e => handleVacancySelect(e.target.value)}
          >
            <option value="">Select a vacancy to pre-fill…</option>
            {vacancies.map(v => (
              <option key={v.id} value={v.id}>{v.title} — {v.company}</option>
            ))}
          </select>
          {selectedVacancyData && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#3D6B3D] bg-[rgba(45,74,45,0.06)] rounded-lg px-3 py-2">
              <Sparkles size={12} />
              <span>Sourcing for: <strong>{selectedVacancyData.title}</strong> at <strong>{selectedVacancyData.company}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6 mb-6">
        <h2 className="text-[#2D4A2D] font-semibold mb-5">Role Requirements</h2>

        {/* Vacancy Link — placed first so auto-fill populates the fields below */}
        <div className="mb-4">
          <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
            <LinkIcon size={12} className="inline mr-1" />
            Link to Vacancy
            <span className="text-[#6B7280] ml-1">(optional — paste to auto-fill)</span>
          </label>
          <div className="relative">
            <input
              type="url"
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 pr-10 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none transition-colors ${
                scanning ? 'border-[#2D4A2D]/60 animate-pulse' : 'border-[rgba(45,74,45,0.15)] focus:border-[#2D4A2D]'
              }`}
              placeholder="Paste vacancy URL to auto-fill fields below..."
              value={form.vacancyLink}
              onChange={e => setForm(f => ({ ...f, vacancyLink: e.target.value }))}
              onPaste={handleUrlPaste}
              onBlur={handleUrlBlur}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {scanning
                ? <Loader2 size={14} className="text-[#2D4A2D] animate-spin" />
                : form.vacancyLink && <ScanLine size={14} className="text-[#6B7280]" />
              }
            </div>
          </div>
          {scanning && (
            <p className="text-[#2D4A2D] text-xs mt-1.5 flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Scanning vacancy...
            </p>
          )}
          {scanError && !scanning && (
            <p className="text-amber-400 text-xs mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> {scanError}
            </p>
          )}
          {!scanning && !scanError && autoFilled.size > 0 && (
            <p className="text-[#3D6B3D] text-xs mt-1.5 flex items-center gap-1">
              <Sparkles size={11} /> {autoFilled.size} field{autoFilled.size !== 1 ? 's' : ''} auto-filled from vacancy
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Job Title */}
          <div className="md:col-span-2">
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              <Briefcase size={12} className="inline mr-1" />
              Job Title *
              {autoFilled.has('jobTitle') && <AutoFilledBadge />}
            </label>
            <input
              type="text"
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors ${
                autoFilled.has('jobTitle') ? 'border-[#2D4A2D]/40' : 'border-[rgba(45,74,45,0.15)]'
              }`}
              placeholder="e.g. Senior Frontend Engineer"
              value={form.jobTitle}
              onChange={e => { clearAutoFilled('jobTitle'); setForm(f => ({ ...f, jobTitle: e.target.value })); }}
            />
          </div>

          {/* Skills */}
          <div className="md:col-span-2">
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              Required Skills
              {autoFilled.has('skills') && <AutoFilledBadge />}
              {!autoFilled.has('skills') && <span className="text-[#6B7280] ml-1">(press Enter or comma to add)</span>}
            </label>
            <div className={autoFilled.has('skills') ? 'ring-1 ring-[#2D4A2D]/30 rounded-lg' : ''}>
              <TagInput
                tags={form.skills}
                onChange={skills => { clearAutoFilled('skills'); setForm(f => ({ ...f, skills })); }}
                placeholder="e.g. React, TypeScript, Node.js..."
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              <MapPin size={12} className="inline mr-1" />
              Location
              {autoFilled.has('location') && <AutoFilledBadge />}
            </label>
            <input
              type="text"
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors ${
                autoFilled.has('location') ? 'border-[#2D4A2D]/40' : 'border-[rgba(45,74,45,0.15)]'
              }`}
              placeholder="Amsterdam"
              value={form.location}
              onChange={e => { clearAutoFilled('location'); setForm(f => ({ ...f, location: e.target.value })); }}
            />
          </div>

          {/* Seniority */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              Seniority Level
              {autoFilled.has('seniorityLevel') && <AutoFilledBadge />}
            </label>
            <select
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors ${
                autoFilled.has('seniorityLevel') ? 'border-[#2D4A2D]/40' : 'border-[rgba(45,74,45,0.15)]'
              }`}
              value={form.seniorityLevel}
              onChange={e => { clearAutoFilled('seniorityLevel'); setForm(f => ({ ...f, seniorityLevel: e.target.value })); }}
            >
              {SENIORITY_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Salary Range */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              Salary Min (€)
              {autoFilled.has('salaryMin') && <AutoFilledBadge />}
            </label>
            <input
              type="number"
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors ${
                autoFilled.has('salaryMin') ? 'border-[#2D4A2D]/40' : 'border-[rgba(45,74,45,0.15)]'
              }`}
              placeholder="60000"
              value={form.salaryMin}
              onChange={e => { clearAutoFilled('salaryMin'); setForm(f => ({ ...f, salaryMin: e.target.value })); }}
            />
          </div>
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              Salary Max (€)
              {autoFilled.has('salaryMax') && <AutoFilledBadge />}
            </label>
            <input
              type="number"
              className={`w-full bg-[#FFFFFF] border rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] transition-colors ${
                autoFilled.has('salaryMax') ? 'border-[#2D4A2D]/40' : 'border-[rgba(45,74,45,0.15)]'
              }`}
              placeholder="90000"
              value={form.salaryMax}
              onChange={e => { clearAutoFilled('salaryMax'); setForm(f => ({ ...f, salaryMax: e.target.value })); }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-gradient-to-r from-[#2D4A2D] to-[#3D6B3D] hover:from-[#3D6B3D] hover:to-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#2D4A2D]/20"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating strategy...
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Generate Sourcing Strategy
            </>
          )}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div ref={resultsRef} className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#2D4A2D] font-semibold text-lg">
                Sourcing Strategy — {result.jobTitle}
              </h2>
              <p className="text-[#94a3b8] text-sm mt-0.5">
                {result.seniorityLevel} · {result.location} · {result.salaryRange}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Save to Vacancy */}
              {!vacancySaved && vacancies.length > 0 && (
                savingToVacancy ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                      value={selectedVacancyId}
                      onChange={e => setSelectedVacancyId(e.target.value)}
                    >
                      <option value="">Select vacancy...</option>
                      {vacancies.map(v => (
                        <option key={v.id} value={v.id}>{v.title} — {v.company}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveToVacancy}
                      disabled={!selectedVacancyId}
                      className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Save size={14} /> Save
                    </button>
                    <button
                      onClick={() => setSavingToVacancy(false)}
                      className="text-[#94a3b8] hover:text-[#2D4A2D] px-2 py-2 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSavingToVacancy(true)}
                    className="flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Save size={14} /> Save to Vacancy
                  </button>
                )
              )}
              {vacancySaved && (
                <div className="flex items-center gap-1.5 text-green-400 text-sm">
                  <Check size={14} /> Saved to vacancy
                </div>
              )}
              <button
                onClick={handleDownloadHTML}
                className="flex items-center gap-2 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>

          {/* Candidate Profiles */}
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-[#2D4A2D]" />
              <h3 className="text-[#2D4A2D] font-semibold">Candidate Profiles ({result.profiles.length})</h3>
            </div>
            <div className="space-y-3">
              {result.profiles.map((profile, i) => (
                <ProfileCard key={i} profile={profile} index={i} />
              ))}
            </div>
          </div>

          {/* Search Strings */}
          <div className="grid grid-cols-1 gap-4">
            <SearchStringCard
              title="LinkedIn Recruiter Boolean Search"
              value={result.booleanSearch}
              icon={Users}
            />
            <SearchStringCard
              title="Google X-Ray Search (No Premium Required)"
              value={result.xraySearch}
              icon={Search}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function generateTextReport(result: SourcingStrategy, date: string): string {
  const lines: string[] = [
    `SOURCING STRATEGY — ${result.jobTitle.toUpperCase()}`,
    `Generated: ${date}`,
    `Location: ${result.location} | Seniority: ${result.seniorityLevel} | Salary: ${result.salaryRange}`,
    '',
    '═'.repeat(70),
    '',
    'CANDIDATE PROFILES',
    '─'.repeat(70),
    '',
  ];

  result.profiles.forEach((profile, i) => {
    lines.push(`${i + 1}. ${profile.title.toUpperCase()}`);
    lines.push('');
    lines.push('Background:');
    lines.push(profile.backgroundDescription);
    lines.push('');
    lines.push('Key Skills: ' + profile.keySkills.join(', '));
    lines.push('');
    lines.push('Where to Find:');
    if (profile.whereToFind.linkedinSearchUrl) lines.push(`  • LinkedIn: ${profile.whereToFind.linkedinSearchUrl}`);
    if (profile.whereToFind.githubSearch) lines.push(`  • GitHub: ${profile.whereToFind.githubSearch}`);
    if (profile.whereToFind.communities.length) lines.push(`  • Communities: ${profile.whereToFind.communities.join(', ')}`);
    lines.push('');
    lines.push('Outreach Message:');
    lines.push(profile.outreachMessage);
    lines.push('');
    lines.push('─'.repeat(70));
    lines.push('');
  });

  lines.push('LINKEDIN RECRUITER BOOLEAN SEARCH');
  lines.push('─'.repeat(70));
  lines.push(result.booleanSearch);
  lines.push('');
  lines.push('GOOGLE X-RAY SEARCH');
  lines.push('─'.repeat(70));
  lines.push(result.xraySearch);

  return lines.join('\n');
}

function generateHTMLReport(result: SourcingStrategy, date: string): string {
  const profilesHTML = result.profiles.map((profile, i) => `
    <div style="margin-bottom:32px;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
      <h3 style="color:#2D4A2D;margin:0 0 8px;">${i + 1}. ${profile.title}</h3>
      <p style="color:#475569;margin:0 0 12px;">${profile.backgroundDescription}</p>
      <p><strong>Key Skills:</strong> <span style="color:#3D6B3D;">${profile.keySkills.join(', ')}</span></p>
      <p><strong>Where to Find:</strong></p>
      <ul>
        ${profile.whereToFind.linkedinSearchUrl ? `<li><a href="${profile.whereToFind.linkedinSearchUrl}">LinkedIn Search</a></li>` : ''}
        ${profile.whereToFind.githubSearch ? `<li><a href="${profile.whereToFind.githubSearch}">GitHub Search</a></li>` : ''}
        ${profile.whereToFind.communities.map(c => `<li>${c}</li>`).join('')}
      </ul>
      <p><strong>Outreach Message:</strong></p>
      <blockquote style="background:#f8fafc;border-left:4px solid #2D4A2D;padding:12px;margin:0;white-space:pre-wrap;">${profile.outreachMessage}</blockquote>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sourcing Strategy — ${result.jobTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
  h1 { color: #2D4A2D; }
  h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .meta { color: #64748b; margin-bottom: 32px; }
  .search-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; word-break: break-all; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Sourcing Strategy — ${result.jobTitle}</h1>
<div class="meta">
  <strong>Generated:</strong> ${date} &nbsp;|&nbsp;
  <strong>Location:</strong> ${result.location} &nbsp;|&nbsp;
  <strong>Seniority:</strong> ${result.seniorityLevel} &nbsp;|&nbsp;
  <strong>Salary:</strong> ${result.salaryRange}
</div>

<h2>Candidate Profiles</h2>
${profilesHTML}

<h2>LinkedIn Recruiter Boolean Search</h2>
<div class="search-box">${result.booleanSearch}</div>

<h2>Google X-Ray Search</h2>
<div class="search-box">${result.xraySearch}</div>
</body>
</html>`;
}

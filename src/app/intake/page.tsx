'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

const SENIORITY = ['Junior/Medior', 'Senior', 'Management/Lead'] as const;
const WORK_TYPES = ['remote', 'hybrid', 'on-site'] as const;

const EMPTY = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  roleTitle: '',
  seniorityLevel: 'Senior' as typeof SENIORITY[number],
  salaryMin: '',
  salaryMax: '',
  workType: 'hybrid' as typeof WORK_TYPES[number],
  city: '',
  description: '',
  source: '',
};

export default function IntakePage() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof EMPTY, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salaryMin: parseInt(form.salaryMin) || 0,
          salaryMax: parseInt(form.salaryMax) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen bg-[#0a1628] flex flex-col"
    >
      {/* Google Fonts: Inter */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-6"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-8 py-5 border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
              <circle cx="24" cy="24" r="2.5" fill="white"/>
              <path d="M24 24 L21.5 8 L24 14 L26.5 8 Z" fill="white"/>
              <path d="M24 24 L26.5 40 L24 34 L21.5 40 Z" fill="rgba(255,255,255,0.3)"/>
              <line x1="24" y1="4.5" x2="24" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="43.5" y1="24" x2="40" y2="24" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="4.5" y1="24" x2="8" y2="24" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="24" y1="43.5" x2="24" y2="40" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">TrueNorth <span className="text-[#9d65f5]">Talent</span></p>
            <p className="text-[#4a6fa5] text-[10px] font-semibold tracking-widest uppercase mt-0.5">Amsterdam</p>
          </div>
        </div>
        <p className="text-[#94a3b8] text-xs hidden sm:block">Specialist Tech &amp; Management Recruitment</p>
      </header>

      {/* Main */}
      <main className="relative flex-1 flex flex-col items-center px-4 py-12">
        {submitted ? (
          /* ── Thank you state ── */
          <div className="w-full max-w-lg text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#7C3AED20] border border-[#7C3AED40] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={32} className="text-[#9d65f5]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-3">Request received!</h2>
            <p className="text-[#94a3b8] text-base leading-relaxed">
              Thank you! Dani will be in touch within 24 hours.
            </p>
            <p className="text-[#4a6fa5] text-sm mt-4">
              Questions? Email <a href="mailto:dani@truenorthtalent.nl" className="text-[#9d65f5] hover:underline">dani@truenorthtalent.nl</a>
            </p>
          </div>
        ) : (
          <div className="w-full max-w-xl">
            {/* Intro */}
            <div className="text-center mb-10">
              <h1 className="text-white text-3xl font-extrabold mb-2 tracking-tight">
                Submit a Hiring Request
              </h1>
              <p className="text-[#94a3b8] text-base">
                Tell us about the role. We'll be in touch within 24 hours.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Company + Contact name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Company name *</label>
                  <input
                    required
                    value={form.companyName}
                    onChange={e => set('companyName', e.target.value)}
                    placeholder="Acme Technologies"
                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Your name *</label>
                  <input
                    required
                    value={form.contactName}
                    onChange={e => set('contactName', e.target.value)}
                    placeholder="Jan de Vries"
                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Your email *</label>
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)}
                  placeholder="jan@company.com"
                  className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                />
              </div>

              {/* Role title */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Role title *</label>
                <input
                  required
                  value={form.roleTitle}
                  onChange={e => set('roleTitle', e.target.value)}
                  placeholder="Senior Backend Engineer"
                  className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                />
              </div>

              {/* Seniority */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Seniority level</label>
                <div className="grid grid-cols-3 gap-2">
                  {SENIORITY.map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => set('seniorityLevel', level)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                        form.seniorityLevel === level
                          ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                          : 'bg-[#0d1f3c] border-[#1e3a5f] text-[#94a3b8] hover:border-[#7C3AED40] hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Salary */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Salary range (€ / year)</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={form.salaryMin}
                    onChange={e => set('salaryMin', e.target.value)}
                    placeholder="Min — e.g. 70000"
                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                  />
                  <input
                    type="number"
                    value={form.salaryMax}
                    onChange={e => set('salaryMax', e.target.value)}
                    placeholder="Max — e.g. 90000"
                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                  />
                </div>
              </div>

              {/* Work type + City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Work type</label>
                  <div className="flex gap-2">
                    {WORK_TYPES.map(wt => (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => set('workType', wt)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border capitalize transition-all ${
                          form.workType === wt
                            ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                            : 'bg-[#0d1f3c] border-[#1e3a5f] text-[#94a3b8] hover:border-[#7C3AED40] hover:text-white'
                        }`}
                      >
                        {wt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">City</label>
                  <input
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    placeholder="Amsterdam"
                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">Role description *</label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Tell us about the role, the team, must-haves and nice-to-haves..."
                  className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors resize-none"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                  How did you hear about us? <span className="normal-case font-normal text-[#4a6fa5]">(optional)</span>
                </label>
                <input
                  value={form.source}
                  onChange={e => set('source', e.target.value)}
                  placeholder="LinkedIn, referral, cold email..."
                  className="w-full bg-[#0d1f3c] border border-[#1e3a5f] text-white placeholder-[#3d5a80] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED40] transition-colors"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm mt-2"
                style={{ boxShadow: '0 0 24px rgba(124,58,237,0.3)' }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Request'}
              </button>

            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-[#1e3a5f] px-8 py-4 flex items-center justify-between">
        <p className="text-[#4a6fa5] text-xs">TrueNorth Talent — Amsterdam</p>
        <p className="text-[#4a6fa5] text-xs">
          <a href="mailto:dani@truenorthtalent.nl" className="hover:text-[#94a3b8] transition-colors">
            dani@truenorthtalent.nl
          </a>
        </p>
      </footer>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, Radar, Globe, MapPin, UserPlus, Loader2 } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import PitchPanel from '@/components/PitchPanel';
import type { Account, AccountLead, AgencyPositioning, LeadSeniority, PitchRecord } from '@/lib/accountTypes';

const SENIORITIES: LeadSeniority[] = ['C-level', 'Director', 'Manager', 'Lead', 'Other'];
const EMPTY_POSITIONING: AgencyPositioning = { agencyName: '', repName: '', niche: '', services: [], differentiator: '', proofPoints: [] };

export default function AccountDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [account, setAccount] = useState<Account | null>(null);
  const [leads, setLeads] = useState<AccountLead[]>([]);
  const [positioning, setPositioning] = useState<AgencyPositioning>(EMPTY_POSITIONING);
  const [pitchByLead, setPitchByLead] = useState<Record<string, PitchRecord | null>>({});
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', role: '', seniority: 'Manager' as LeadSeniority, email: '', phone: '', linkedin: '' });

  useEffect(() => {
    (async () => {
      try {
        const acc = await accountsDb.getAccount(id);
        setAccount(acc);
        const [ls, pos] = await Promise.all([accountsDb.getLeads(id), accountsDb.getPositioning()]);
        setLeads(ls);
        if (pos) setPositioning(pos);
        const pitches: Record<string, PitchRecord | null> = {};
        await Promise.all(ls.map(async (l) => (pitches[l.id] = await accountsDb.getLatestPitch(l.id))));
        setPitchByLead(pitches);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function enrich() {
    if (!account) return;
    setEnriching(true);
    try {
      const res = await fetch('/api/enrich-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: account.website, companyName: account.companyName, location: account.location }),
      });
      const { signals } = await res.json();
      const enrichedAt = new Date().toISOString();
      await accountsDb.updateAccount(account.id, { signals, enrichedAt });
      setAccount({ ...account, signals, enrichedAt });
      toast.success(signals.length ? `${signals.length} signaal(en) gevonden` : 'Geen signalen gevonden');
    } catch {
      toast.error('Verrijken mislukt');
    } finally {
      setEnriching(false);
    }
  }

  async function addLead() {
    if (!account || !leadForm.name.trim() || !leadForm.role.trim()) return;
    const lead = await accountsDb.addLead({ accountId: account.id, ...leadForm });
    setLeads((l) => [...l, lead]);
    setLeadForm({ name: '', role: '', seniority: 'Manager', email: '', phone: '', linkedin: '' });
    setShowLead(false);
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: C.muted }}>Laden...</div>;
  if (!account) return <div className="p-8 text-sm" style={{ color: C.muted }}>Account niet gevonden.</div>;

  const positioningSet = positioning.agencyName || positioning.differentiator;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <button onClick={() => router.push('/accounts')} className="mb-4 inline-flex items-center gap-1 text-sm" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> Accounts
      </button>

      <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>
              {account.companyName}
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: C.muted }}>
              {account.sector && <span>{account.sector}</span>}
              {account.size && <span>{account.size}</span>}
              {account.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {account.location}
                </span>
              )}
              {account.website && (
                <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: C.primary }}>
                  <Globe size={13} /> website
                </a>
              )}
            </div>
          </div>
          <button
            onClick={enrich}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{ border: `1px solid ${C.border}`, color: C.primary }}
          >
            {enriching ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
            {enriching ? 'Zoeken...' : 'Verrijk signalen'}
          </button>
        </div>

        {account.signals.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
              Signalen
            </span>
            <div className="flex flex-wrap gap-2">
              {account.signals.map((s, i) => (
                <span key={i} className="rounded-lg px-2.5 py-1 text-xs" style={{ background: C.bg, color: C.primary }} title={s.summary}>
                  {s.type.replace('_', ' ')}: {s.summary.slice(0, 60)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!positioningSet && (
        <button
          onClick={() => router.push('/positioning')}
          className="mt-4 block w-full rounded-xl p-3 text-left text-sm"
          style={{ background: '#FEF3C7', color: '#92400E' }}
        >
          Stel je bureau-positionering in (niche, diensten, differentiator, proof points) voor scherpere pitches. Klik hier om dit nu te doen.
        </button>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: C.primary }}>
          Leads
        </h2>
        <button onClick={() => setShowLead(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: C.primary }}>
          <UserPlus size={15} /> Lead toevoegen
        </button>
      </div>

      <div className="mt-3 space-y-4">
        {leads.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>
            Nog geen leads. Voeg een contactpersoon toe om een pitch te genereren.
          </p>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium" style={{ color: C.primary }}>
                    {lead.name}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: C.muted }}>
                    {lead.role}
                    {lead.seniority ? ` · ${lead.seniority}` : ''}
                  </span>
                </div>
              </div>
              <PitchPanel account={account} lead={lead} positioning={positioning} initialPitch={pitchByLead[lead.id] ?? null} />
            </div>
          ))
        )}
      </div>

      {showLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowLead(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: C.primary }}>
                Lead toevoegen
              </h3>
              <button onClick={() => setShowLead(false)}>
                <X size={18} style={{ color: C.muted }} />
              </button>
            </div>
            <div className="space-y-3">
              <LField label="Naam *" value={leadForm.name} onChange={(v) => setLeadForm({ ...leadForm, name: v })} />
              <LField label="Rol *" value={leadForm.role} onChange={(v) => setLeadForm({ ...leadForm, role: v })} />
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
                  Seniority
                </label>
                <select
                  value={leadForm.seniority}
                  onChange={(e) => setLeadForm({ ...leadForm, seniority: e.target.value as LeadSeniority })}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  {SENIORITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <LField label="E-mail" value={leadForm.email} onChange={(v) => setLeadForm({ ...leadForm, email: v })} />
              <LField label="Telefoon" value={leadForm.phone} onChange={(v) => setLeadForm({ ...leadForm, phone: v })} />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button onClick={addLead} disabled={!leadForm.name.trim() || !leadForm.role.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: C.primary }}>
                <Plus size={14} /> Toevoegen
              </button>
              <button onClick={() => setShowLead(false)} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
        {label}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, Save, Trash2 } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import type { AgencyPositioning, ProofPoint } from '@/lib/accountTypes';

const EMPTY: AgencyPositioning = {
  agencyName: '',
  repName: '',
  niche: '',
  services: [],
  differentiator: '',
  proofPoints: [],
  tone: '',
};

export default function PositioningPage() {
  const router = useRouter();
  const [p, setP] = useState<AgencyPositioning>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceInput, setServiceInput] = useState('');

  useEffect(() => {
    accountsDb
      .getPositioning()
      .then((existing) => existing && setP({ ...EMPTY, ...existing }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addService() {
    const v = serviceInput.trim();
    if (!v) return;
    setP({ ...p, services: [...p.services, v] });
    setServiceInput('');
  }

  function addProof() {
    setP({ ...p, proofPoints: [...p.proofPoints, { label: '', result: '', named: false }] });
  }

  function updateProof(i: number, patch: Partial<ProofPoint>) {
    setP({ ...p, proofPoints: p.proofPoints.map((pp, idx) => (idx === i ? { ...pp, ...patch } : pp)) });
  }

  async function save() {
    setSaving(true);
    try {
      await accountsDb.savePositioning({
        ...p,
        proofPoints: p.proofPoints.filter((pp) => pp.label.trim() || pp.result.trim()),
      });
      toast.success('Positionering opgeslagen');
      router.push('/accounts');
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: C.muted }}>Laden...</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <button onClick={() => router.push('/accounts')} className="mb-4 inline-flex items-center gap-1 text-sm" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> Accounts
      </button>

      <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>
        Bureau-positionering
      </h1>
      <p className="mb-6 text-sm" style={{ color: C.muted }}>
        Dit stuurt elke gegenereerde pitch. Hoe scherper, hoe beter de pitch.
      </p>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bureaunaam" value={p.agencyName} onChange={(v) => setP({ ...p, agencyName: v })} />
          <Field label="Naam recruiter (in de opener)" value={p.repName} onChange={(v) => setP({ ...p, repName: v })} />
        </div>

        <Field label="Niche" value={p.niche} onChange={(v) => setP({ ...p, niche: v })} placeholder="bijv. tech & engineering werving in NL" />

        <div>
          <Label>Diensten</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {p.services.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: C.pill, color: C.pillText }}>
                {s}
                <button onClick={() => setP({ ...p, services: p.services.filter((_, idx) => idx !== i) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
              placeholder="bijv. werving & selectie"
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${C.border}` }}
            />
            <button onClick={addService} className="rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${C.border}`, color: C.primary }}>
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div>
          <Label>Differentiator / reframe-kern</Label>
          <textarea
            value={p.differentiator}
            onChange={(e) => setP({ ...p, differentiator: e.target.value })}
            rows={3}
            placeholder="Het inzicht dat je verkoopt. Bijv: split ATS/CRM-tools knippen de band tussen kandidaat en klant door, daar zit juist de waarde van een bureau."
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${C.border}` }}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Proof points</Label>
            <button onClick={addProof} className="inline-flex items-center gap-1 text-xs" style={{ color: C.primary }}>
              <Plus size={13} /> toevoegen
            </button>
          </div>
          <p className="mb-2 text-xs" style={{ color: C.muted }}>
            Echte resultaten. Zet &lsquo;naam tonen&rsquo; alleen aan als de klantnaam genoemd mag worden, anders wordt het &lsquo;soortgelijke bedrijven&rsquo;.
          </p>
          <div className="space-y-2">
            {p.proofPoints.map((pp, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: C.bg }}>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={pp.label}
                    onChange={(e) => updateProof(i, { label: e.target.value })}
                    placeholder="Label, bijv. SaaS-scaleup 120 fte"
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ border: `1px solid ${C.border}` }}
                  />
                  <input
                    value={pp.result}
                    onChange={(e) => updateProof(i, { result: e.target.value })}
                    placeholder="Resultaat, bijv. 3 senior devs in 5 weken"
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ border: `1px solid ${C.border}` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                    <input type="checkbox" checked={pp.named} onChange={(e) => updateProof(i, { named: e.target.checked })} />
                    Naam mag genoemd worden
                  </label>
                  <button onClick={() => setP({ ...p, proofPoints: p.proofPoints.filter((_, idx) => idx !== i) })} style={{ color: C.red }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Tone of voice (optioneel)" value={p.tone ?? ''} onChange={(v) => setP({ ...p, tone: v })} placeholder="bijv. direct, warm, geen verkooppraat" />

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: C.primary }}
        >
          <Save size={15} /> {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
      {children}
    </label>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}` }}
      />
    </div>
  );
}

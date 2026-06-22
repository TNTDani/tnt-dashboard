// src/components/MergeAccountsModal.tsx
// Salesforce-stijl samenvoegen: kies twee accounts, bepaal de master, en kies per
// veld welke waarde je houdt. Leads, pitches, signalen en contacten worden
// gecombineerd; de duplicate wordt verwijderd. Alleen admins (server-side afgedwongen).

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { X, GitMerge, ArrowRight } from 'lucide-react';
import { C } from '@/lib/ui';
import type { Account } from '@/lib/accountTypes';

interface Props {
  accounts: Account[];
  onClose: () => void;
  onMerged: () => void;
}

// Scalaire velden waarvoor je een waarde kiest. (key = DB-kolom, get = lezer)
const FIELDS: { key: string; label: string; get: (a: Account) => string }[] = [
  { key: 'company_name', label: 'Bedrijfsnaam', get: (a) => a.companyName },
  { key: 'website', label: 'Website', get: (a) => a.website ?? '' },
  { key: 'sector', label: 'Branche', get: (a) => a.sector ?? '' },
  { key: 'size', label: 'Omvang', get: (a) => a.size ?? '' },
  { key: 'location', label: 'Locatie', get: (a) => a.location ?? '' },
  { key: 'linkedin', label: 'LinkedIn', get: (a) => a.linkedin ?? '' },
  { key: 'description', label: 'Profiel', get: (a) => a.description ?? '' },
  { key: 'notes', label: 'Notities', get: (a) => a.notes ?? '' },
];

export default function MergeAccountsModal({ accounts, onClose, onMerged }: Props) {
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  // per veld: 'a' of 'b'
  const [choices, setChoices] = useState<Record<string, 'a' | 'b'>>({});
  const [merging, setMerging] = useState(false);

  const a = accounts.find((x) => x.id === aId) ?? null;
  const b = accounts.find((x) => x.id === bId) ?? null;
  const ready = a && b && a.id !== b.id;

  function choose(key: string, side: 'a' | 'b') {
    setChoices((c) => ({ ...c, [key]: side }));
  }

  async function merge() {
    if (!a || !b) return;
    setMerging(true);
    try {
      // master = A; B wordt opgeslokt. Per veld de gekozen kant pakken (default master/A).
      const fields: Record<string, string> = {};
      for (const f of FIELDS) {
        const side = choices[f.key] ?? 'a';
        fields[f.key] = side === 'a' ? f.get(a) : f.get(b);
      }
      const res = await fetch('/api/accounts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: a.id, duplicateId: b.id, fields }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Samenvoegen mislukt');
      toast.success('Accounts samengevoegd');
      onMerged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Samenvoegen mislukt');
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold" style={{ color: C.primary }}>
            <GitMerge size={18} /> Accounts samenvoegen
          </h2>
          <button onClick={onClose}>
            <X size={18} style={{ color: C.muted }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
              Master (blijft bestaan)
            </label>
            <select value={aId} onChange={(e) => setAId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }}>
              <option value="">Kies account</option>
              {accounts.filter((x) => x.id !== bId).map((x) => (
                <option key={x.id} value={x.id}>{x.companyName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
              Duplicate (wordt verwijderd)
            </label>
            <select value={bId} onChange={(e) => setBId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }}>
              <option value="">Kies account</option>
              {accounts.filter((x) => x.id !== aId).map((x) => (
                <option key={x.id} value={x.id}>{x.companyName}</option>
              ))}
            </select>
          </div>
        </div>

        {ready && (
          <>
            <p className="mt-4 text-xs" style={{ color: C.muted }}>
              Kies per veld welke waarde je houdt. Leads, pitches, signalen en contacten van beide worden gecombineerd.
            </p>
            <div className="mt-2 space-y-2">
              {FIELDS.map((f) => {
                const va = f.get(a!);
                const vb = f.get(b!);
                if (!va && !vb) return null;
                const side = choices[f.key] ?? 'a';
                return (
                  <div key={f.key} className="rounded-lg p-2.5" style={{ background: C.bg }}>
                    <div className="mb-1 text-xs font-medium" style={{ color: C.muted }}>{f.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => choose(f.key, 'a')}
                        className="rounded-lg px-2.5 py-1.5 text-left text-sm"
                        style={{ border: `1px solid ${side === 'a' ? C.primary : C.border}`, color: C.primary, background: side === 'a' ? C.pill : 'transparent' }}
                      >
                        {va || <span style={{ color: C.faint }}>leeg</span>}
                      </button>
                      <button
                        onClick={() => choose(f.key, 'b')}
                        className="rounded-lg px-2.5 py-1.5 text-left text-sm"
                        style={{ border: `1px solid ${side === 'b' ? C.primary : C.border}`, color: C.primary, background: side === 'b' ? C.pill : 'transparent' }}
                      >
                        {vb || <span style={{ color: C.faint }}>leeg</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button onClick={merge} disabled={merging} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: C.primary }}>
                <ArrowRight size={15} /> {merging ? 'Samenvoegen...' : 'Samenvoegen'}
              </button>
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
                Annuleren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

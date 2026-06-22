'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, X, Search, Building2, MapPin, Sparkles, Radar, SlidersHorizontal, GitMerge } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import { computeBuyingScore, scoreColor } from '@/lib/buyingScore';
import MergeAccountsModal from '@/components/MergeAccountsModal';
import type { Account } from '@/lib/accountTypes';

const SIZES: NonNullable<Account['size']>[] = ['startup', 'small', 'medium', 'large', 'enterprise'];
const EMPTY = { companyName: '', website: '', sector: '', size: 'medium' as Account['size'], location: '', linkedin: '', description: '', notes: '' };

export default function AccountsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = ['owner', 'admin'].includes(session?.user?.role ?? '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    accountsDb
      .getAccounts()
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function create() {
    if (!form.companyName.trim()) return;
    setSaving(true);
    try {
      const account = await accountsDb.addAccount({ ...form, signals: [], notes: form.notes });
      setAccounts((a) => [account, ...a]);
      setForm(EMPTY);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  const filtered = accounts.filter((a) => a.companyName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>
            Accounts
          </h1>
          <p className="text-sm" style={{ color: C.muted }}>
            Prospect-bedrijven in je BD-pijplijn
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && accounts.length >= 2 && (
            <button
              onClick={() => setShowMerge(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              style={{ border: `1px solid ${C.border}`, color: C.primary }}
            >
              <GitMerge size={15} /> Samenvoegen
            </button>
          )}
          <button
            onClick={() => router.push('/positioning')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ border: `1px solid ${C.border}`, color: C.primary }}
          >
            <SlidersHorizontal size={15} /> Positionering
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: C.primary }}
          >
            <Plus size={16} /> Nieuw account
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <Search size={16} style={{ color: C.faint }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op bedrijfsnaam"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: C.muted }}>
          Laden...
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
          Nog geen accounts. Voeg je eerste prospect-bedrijf toe.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => router.push(`/accounts/${a.id}`)}
              className="rounded-xl p-4 text-left transition hover:shadow-sm"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={18} style={{ color: C.primary }} />
                  <span className="font-medium" style={{ color: C.primary }}>
                    {a.companyName}
                  </span>
                </div>
                {a.signals.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: C.pill, color: C.pillText }}>
                    <Radar size={11} /> {a.signals.length}
                  </span>
                )}
              </div>
              {(() => {
                const sc = computeBuyingScore(a.signals);
                return (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: C.border }}>
                      <div className="h-full rounded-full" style={{ width: `${sc.score}%`, background: scoreColor(sc.label) }} />
                    </div>
                    <span className="text-xs" style={{ color: scoreColor(sc.label) }}>
                      Koopkans {sc.score}
                    </span>
                  </div>
                );
              })()}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: C.muted }}>
                {a.sector && <span>{a.sector}</span>}
                {a.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {a.location}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: C.primary }}>
                Nieuw account
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} style={{ color: C.muted }} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Bedrijfsnaam *" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
              <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="bijv. bedrijf.nl" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Branche" value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} />
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
                    Omvang
                  </label>
                  <select
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value as Account['size'] })}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ border: `1px solid ${C.border}` }}
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Field label="Locatie" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              <Field label="LinkedIn-pagina" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} placeholder="bijv. linkedin.com/company/..." />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={create}
                disabled={saving || !form.companyName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: C.primary }}
              >
                <Sparkles size={14} /> {saving ? 'Opslaan...' : 'Aanmaken'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
      {showMerge && (
        <MergeAccountsModal
          accounts={accounts}
          onClose={() => setShowMerge(false)}
          onMerged={() => {
            setShowMerge(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>
        {label}
      </label>
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

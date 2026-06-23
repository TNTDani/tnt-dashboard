'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, X, Search, Building2, MapPin, Sparkles, Radar, SlidersHorizontal, GitMerge, LayoutList, Kanban, Briefcase, LayoutGrid, Check, Download } from 'lucide-react';

function exportAccountsCsv(rows: Account[]) {
  const headers = ['Company', 'Website', 'Sector', 'Size', 'Location', 'Stage', 'Notes'];
  const lines = [
    headers.join(','),
    ...rows.map(a => [
      a.companyName, a.website ?? '', a.sector ?? '', a.size ?? '',
      a.location ?? '', a.stage ?? 'new', a.notes ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = 'accounts.csv'; el.click();
  URL.revokeObjectURL(url);
}
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import { computeBuyingScore, scoreColor } from '@/lib/buyingScore';
import { useT } from '@/lib/i18n';
import MergeAccountsModal from '@/components/MergeAccountsModal';
import { isClient } from '@/lib/accountTypes';
import type { Account, AccountStage } from '@/lib/accountTypes';

const SIZES: NonNullable<Account['size']>[] = ['startup', 'small', 'medium', 'large', 'enterprise'];
const BOARD_STAGES: AccountStage[] = ['new', 'contacted', 'engaged', 'meeting', 'client', 'dormant', 'lost'];

const STAGE_COLOR: Record<AccountStage, string> = {
  new: C.faint, contacted: C.blue, engaged: C.amber, meeting: C.green,
  won: C.green, client: C.green, dormant: C.faint, lost: C.red,
};

const PROSPECT_CHIPS: AccountStage[] = ['new', 'contacted', 'engaged', 'meeting', 'lost'];
const CLIENT_CHIPS: AccountStage[] = ['client', 'dormant', 'lost'];

type Segment = 'all' | 'prospects' | 'clients';

const EMPTY = { companyName: '', website: '', sector: '', size: 'medium' as Account['size'], location: '', linkedin: '', description: '', notes: '' };

function accountHref(a: Account): string {
  if (isClient(a) && a.convertedClientId) return `/clients/${a.convertedClientId}`;
  return `/accounts/${a.id}`;
}

export default function AccountsPage() {
  const t = useT();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = ['owner', 'admin'].includes(session?.user?.role ?? '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hiringCounts, setHiringCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [stageFilter, setStageFilter] = useState<AccountStage | null>(null);
  const [view, setView] = useState<'list' | 'grid' | 'board'>('list');
  const [showForm, setShowForm] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // ── Multi-select ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // ── Drag state ────────────────────────────────────────────────────────────────
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<Segment | null>(null);

  const agencyId = session?.user?.agencyId as string | undefined;

  // Persist + restore segment tab
  useEffect(() => {
    if (!agencyId) return;
    const saved = localStorage.getItem(`accounts_segment_${agencyId}`) as Segment | null;
    if (saved && ['all', 'prospects', 'clients'].includes(saved)) setSegment(saved);
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) return;
    localStorage.setItem(`accounts_segment_${agencyId}`, segment);
  }, [agencyId, segment]);

  const reload = useCallback(() => {
    setLoading(true);
    accountsDb.getAccounts().then(setAccounts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch('/api/accounts/hiring-signals')
      .then((r) => r.json())
      .then((d) => setHiringCounts(d))
      .catch(() => {});
  }, []);

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

  const prospectCount = accounts.filter((a) => !isClient(a)).length;
  const clientCount = accounts.filter((a) => isClient(a)).length;

  const chipStages = segment === 'clients' ? CLIENT_CHIPS
    : segment === 'prospects' ? PROSPECT_CHIPS
    : [...PROSPECT_CHIPS, 'client' as AccountStage, 'dormant' as AccountStage];

  function setSegmentAndClear(s: Segment) {
    setSegment(s);
    setStageFilter(null);
    setSelected(new Set());
  }

  const filtered = accounts.filter((a) => {
    if (!a.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    if (segment === 'prospects' && isClient(a)) return false;
    if (segment === 'clients' && !isClient(a)) return false;
    if (stageFilter) {
      const stage = a.stage ?? 'new';
      if ((stage === 'won' ? 'client' : stage) !== stageFilter) return false;
    }
    return true;
  });

  // ── Selection helpers ─────────────────────────────────────────────────────────
  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((a) => a.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────────
  function dragStageFor(account: Account, target: Segment): AccountStage | null {
    if (target === 'prospects' && isClient(account)) return 'new';
    if (target === 'clients' && !isClient(account)) return 'client';
    return null;
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    // Drag the whole selection if the card is part of it, otherwise just this card
    const ids = selected.has(id) && selected.size > 1 ? [...selected] : [id];
    setDraggingIds(ids);
    e.dataTransfer.effectAllowed = 'move';

    // Custom drag ghost showing count when >1
    if (ids.length > 1) {
      const ghost = document.createElement('div');
      ghost.textContent = `${ids.length} accounts`;
      ghost.style.cssText = 'position:fixed;top:-100px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;color:white;background:#2D4A2D;white-space:nowrap;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 20);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  }

  function handleDragEnd() {
    setDraggingIds([]);
    setDropTarget(null);
  }

  function anyCanDrop(ids: string[], target: Segment): boolean {
    return ids.some((id) => {
      const a = accounts.find((acc) => acc.id === id);
      return a ? dragStageFor(a, target) !== null : false;
    });
  }

  function handleDragOver(e: React.DragEvent, seg: Segment) {
    if (!draggingIds.length) return;
    if (!anyCanDrop(draggingIds, seg)) return;
    e.preventDefault();
    setDropTarget(seg);
  }

  function handleDrop(e: React.DragEvent, seg: Segment) {
    e.preventDefault();
    setDropTarget(null);
    if (!draggingIds.length) return;

    const updates: { id: string; stage: AccountStage }[] = [];
    for (const id of draggingIds) {
      const account = accounts.find((a) => a.id === id);
      if (!account) continue;
      const newStage = dragStageFor(account, seg);
      if (newStage) updates.push({ id, stage: newStage });
    }

    if (!updates.length) return;
    setDraggingIds([]);
    setSelected(new Set());

    // Optimistic update — revert all on error
    setAccounts((prev) =>
      prev.map((a) => {
        const u = updates.find((x) => x.id === a.id);
        return u ? { ...a, stage: u.stage } : a;
      }),
    );
    Promise.all(updates.map((u) => accountsDb.updateAccount(u.id, { stage: u.stage }))).catch(() => reload());
  }

  const anyDragging = draggingIds.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>Accounts</h1>
          <p className="text-sm" style={{ color: C.muted }}>
            {t('Prospect companies and active clients', 'Prospect-bedrijven en actieve klanten')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportAccountsCsv(filtered)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.primary }} title="Export to CSV">
            <Download size={15} />
          </button>
          {isAdmin && accounts.length >= 2 && (
            <button onClick={() => setShowMerge(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.primary }}>
              <GitMerge size={15} /> {t('Merge', 'Samenvoegen')}
            </button>
          )}
          <button onClick={() => router.push('/positioning')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.primary }}>
            <SlidersHorizontal size={15} /> {t('Positioning', 'Positionering')}
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: C.primary }}>
            <Plus size={16} /> {t('New account', 'Nieuw account')}
          </button>
        </div>
      </div>

      {/* Segment tabs + select-all bar */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {(['all', 'prospects', 'clients'] as Segment[]).map((seg) => {
            const label =
              seg === 'all' ? t('All', 'Alles') :
              seg === 'prospects' ? t(`Prospects (${prospectCount})`, `Prospects (${prospectCount})`) :
              t(`Clients (${clientCount})`, `Klanten (${clientCount})`);
            const isActive = segment === seg;
            const isOver = dropTarget === seg;
            return (
              <button
                key={seg}
                onClick={() => setSegmentAndClear(seg)}
                onDragOver={(e) => handleDragOver(e, seg)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, seg)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: isOver ? C.blue : isActive ? C.primary : 'transparent',
                  color: isOver || isActive ? 'white' : C.muted,
                  outline: isOver ? `2px solid ${C.blue}` : undefined,
                  transform: isOver ? 'scale(1.05)' : undefined,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Select-all / selection count */}
        {view !== 'board' && filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={selected.size === filtered.length ? clearSelection : selectAll}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ border: `1px solid ${C.border}`, color: selected.size === filtered.length ? C.primary : C.muted }}
            >
              {selected.size === filtered.length
                ? t('Deselect all', 'Alles deselecteren')
                : t('Select all', 'Alles selecteren')}
            </button>
            {selected.size > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1" style={{ background: `${C.primary}15`, color: C.primary }}>
                <Check size={11} />
                {t(`${selected.size} selected`, `${selected.size} geselecteerd`)}
                <button onClick={clearSelection} className="ml-0.5 hover:opacity-60">
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stage chips */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {chipStages.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(stageFilter === s ? null : s)}
            className="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
            style={{
              background: stageFilter === s ? `${STAGE_COLOR[s]}15` : 'transparent',
              border: `1px solid ${stageFilter === s ? STAGE_COLOR[s] : C.border}`,
              color: stageFilter === s ? STAGE_COLOR[s] : C.muted,
            }}
          >
            {t(s, s)}
          </button>
        ))}
      </div>

      {/* Search + view toggle */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search size={16} style={{ color: C.faint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search by company name', 'Zoek op bedrijfsnaam')}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <button onClick={() => setView('list')} className="px-3 py-2" style={{ background: view === 'list' ? C.primary : 'transparent', color: view === 'list' ? 'white' : C.muted }}>
            <LayoutList size={15} />
          </button>
          <button onClick={() => setView('grid')} className="px-3 py-2" style={{ background: view === 'grid' ? C.primary : 'transparent', color: view === 'grid' ? 'white' : C.muted }}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setView('board')} className="px-3 py-2" style={{ background: view === 'board' ? C.primary : 'transparent', color: view === 'board' ? 'white' : C.muted }}>
            <Kanban size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: C.muted }}>{t('Loading...', 'Laden...')}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
          {t('No accounts yet. Add your first prospect company.', 'Nog geen accounts. Voeg je eerste prospect-bedrijf toe.')}
        </div>
      ) : view === 'list' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <AccountCard key={a.id} account={a} onClick={() => router.push(accountHref(a))} t={t} hiringCounts={hiringCounts}
              selected={selected.has(a.id)} anySelected={selected.size > 0}
              dragging={draggingIds.includes(a.id)} anyDragging={anyDragging}
              onSelect={(e) => toggleSelect(e, a.id)}
              onDragStart={(e) => handleDragStart(e, a.id)} onDragEnd={handleDragEnd} />
          ))}
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => (
            <GridCard key={a.id} account={a} onClick={() => router.push(accountHref(a))} t={t} hiringCounts={hiringCounts}
              selected={selected.has(a.id)} anySelected={selected.size > 0}
              dragging={draggingIds.includes(a.id)} anyDragging={anyDragging}
              onSelect={(e) => toggleSelect(e, a.id)}
              onDragStart={(e) => handleDragStart(e, a.id)} onDragEnd={handleDragEnd} />
          ))}
        </div>
      ) : (
        <BoardView accounts={filtered} onCardClick={(a) => router.push(accountHref(a))} t={t} />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: C.primary }}>{t('New account', 'Nieuw account')}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: C.muted }} /></button>
            </div>
            <div className="space-y-3">
              <Field label={t('Company name *', 'Bedrijfsnaam *')} value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
              <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder={t('e.g. company.com', 'bijv. bedrijf.nl')} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Industry', 'Branche')} value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} />
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{t('Size', 'Omvang')}</label>
                  <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value as Account['size'] })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }}>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <Field label={t('Location', 'Locatie')} value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              <Field label={t('LinkedIn page', 'LinkedIn-pagina')} value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} placeholder={t('e.g. linkedin.com/company/...', 'bijv. linkedin.com/company/...')} />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button onClick={create} disabled={saving || !form.companyName.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: C.primary }}>
                <Sparkles size={14} /> {saving ? t('Saving...', 'Opslaan...') : t('Create', 'Aanmaken')}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
                {t('Cancel', 'Annuleren')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showMerge && (
        <MergeAccountsModal accounts={accounts} onClose={() => setShowMerge(false)} onMerged={() => { setShowMerge(false); reload(); }} />
      )}
    </div>
  );
}

// ── Token helper ──────────────────────────────────────────────────────────────
function hiringToken(name: string): string {
  const token = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(bv|nv|ltd|inc|llc|gmbh|ag|corp|group|holding|solutions|technologies|tech|systems|nederland|netherlands|nl)\b/g, ' ')
    .replace(/\s+/g, ' ').trim().split(' ').find((t) => t.length >= 3);
  return token ?? '';
}

// ── Shared card props ─────────────────────────────────────────────────────────
type CardProps = {
  account: Account;
  onClick: () => void;
  t: (en: string, nl: string) => string;
  hiringCounts: Record<string, number>;
  selected?: boolean;
  anySelected?: boolean;
  dragging?: boolean;
  anyDragging?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

// ── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onSelect, show }: { checked: boolean; onSelect?: (e: React.MouseEvent) => void; show: boolean }) {
  return (
    <div
      onClick={onSelect}
      className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-opacity"
      style={{
        opacity: show ? 1 : 0,
        background: checked ? C.primary : 'white',
        border: `1.5px solid ${checked ? C.primary : C.border}`,
        cursor: 'pointer',
      }}
    >
      {checked && <Check size={9} color="white" strokeWidth={3} />}
    </div>
  );
}

// ── GridCard ──────────────────────────────────────────────────────────────────
function GridCard({ account, onClick, t, hiringCounts, selected, anySelected, dragging, anyDragging, onSelect, onDragStart, onDragEnd }: CardProps) {
  const client = isClient(account);
  const score = computeBuyingScore(account.signals);
  const stage = account.stage ?? 'new';
  const displayStage = stage === 'won' ? 'client' : stage;
  const openRoles = hiringCounts[hiringToken(account.companyName)] ?? 0;
  const showCheckbox = !!anySelected || !!selected;

  return (
    <button draggable onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="rounded-xl p-3 text-left transition hover:shadow-sm cursor-grab active:cursor-grabbing group"
      style={{
        background: selected ? `${C.primary}08` : C.surface,
        border: `1px solid ${selected ? C.primary : C.border}`,
        opacity: (dragging || (anyDragging && selected)) ? 0.35 : 1,
      }}>
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Checkbox checked={!!selected} onSelect={onSelect} show={showCheckbox} />
          <Building2 size={14} style={{ color: C.primary, flexShrink: 0 }} />
          <span className="text-sm font-medium truncate" style={{ color: C.primary }}>{account.companyName}</span>
        </div>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] capitalize shrink-0" style={{ background: `${STAGE_COLOR[displayStage]}20`, color: STAGE_COLOR[displayStage] }}>
          {t(displayStage, displayStage)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {openRoles > 0 && <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: C.blue }}><Briefcase size={10} /> {openRoles}</span>}
        {!client && <span className="text-[10px]" style={{ color: scoreColor(score.label) }}>{score.score}</span>}
        {!client && account.signals.length > 0 && <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: C.muted }}><Radar size={10} /> {account.signals.length}</span>}
        {account.sector && <span className="text-[10px] truncate" style={{ color: C.muted }}>{account.sector}</span>}
      </div>
    </button>
  );
}

// ── AccountCard ───────────────────────────────────────────────────────────────
function AccountCard({ account, onClick, t, hiringCounts, selected, anySelected, dragging, anyDragging, onSelect, onDragStart, onDragEnd }: CardProps) {
  const client = isClient(account);
  const score = computeBuyingScore(account.signals);
  const stage = account.stage ?? 'new';
  const displayStage = stage === 'won' ? 'client' : stage;
  const openRoles = hiringCounts[hiringToken(account.companyName)] ?? 0;
  const showCheckbox = !!anySelected || !!selected;

  return (
    <button draggable onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="rounded-xl p-4 text-left transition hover:shadow-sm cursor-grab active:cursor-grabbing group"
      style={{
        background: selected ? `${C.primary}08` : C.surface,
        border: `1px solid ${selected ? C.primary : C.border}`,
        opacity: (dragging || (anyDragging && selected)) ? 0.35 : 1,
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Checkbox checked={!!selected} onSelect={onSelect} show={showCheckbox} />
          <Building2 size={18} style={{ color: C.primary }} />
          <span className="font-medium" style={{ color: C.primary }}>{account.companyName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {openRoles > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: C.blue }}>
              <Briefcase size={11} /> {openRoles}
            </span>
          )}
          {!client && account.signals.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: C.pill, color: C.pillText }}>
              <Radar size={11} /> {account.signals.length}
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-xs capitalize" style={{ background: `${STAGE_COLOR[displayStage]}20`, color: STAGE_COLOR[displayStage] }}>
            {t(displayStage, displayStage)}
          </span>
        </div>
      </div>

      {client ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs" style={{ color: C.muted }}>
            {openRoles > 0
              ? t(`${openRoles} open role${openRoles !== 1 ? 's' : ''} on boards`, `${openRoles} open vacature${openRoles !== 1 ? 's' : ''} op boards`)
              : t('No open roles on job boards', 'Geen open vacatures op boards')}
          </span>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: C.border }}>
            <div className="h-full rounded-full" style={{ width: `${score.score}%`, background: scoreColor(score.label) }} />
          </div>
          <span className="text-xs" style={{ color: scoreColor(score.label) }}>{t('Buying score', 'Koopkans')} {score.score}</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: C.muted }}>
        {account.sector && <span>{account.sector}</span>}
        {account.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {account.location}</span>}
      </div>
    </button>
  );
}

// ── BoardView ─────────────────────────────────────────────────────────────────
function BoardView({ accounts, onCardClick, t }: { accounts: Account[]; onCardClick: (a: Account) => void; t: (en: string, nl: string) => string }) {
  const byStage = Object.fromEntries(
    BOARD_STAGES.map((s) => [s, accounts.filter((a) => {
      const stage = a.stage ?? 'new';
      return (stage === 'won' ? 'client' : stage) === s;
    })]),
  );
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {BOARD_STAGES.map((stage) => {
        const items = byStage[stage];
        return (
          <div key={stage} className="w-56 shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold capitalize" style={{ color: STAGE_COLOR[stage] }}>{t(stage, stage)}</span>
              <span className="text-xs" style={{ color: C.faint }}>{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((a) => {
                const score = computeBuyingScore(a.signals);
                return (
                  <button key={a.id} onClick={() => onCardClick(a)} className="w-full rounded-xl p-3 text-left transition hover:shadow-sm" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium leading-snug" style={{ color: C.primary }}>{a.companyName}</span>
                      {!isClient(a) && <span className="text-xs font-semibold shrink-0" style={{ color: scoreColor(score.label) }}>{score.score}</span>}
                    </div>
                    {a.sector && <p className="mt-1 text-xs" style={{ color: C.muted }}>{a.sector}</p>}
                    {!isClient(a) && a.signals.length > 0 && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs" style={{ background: C.pill, color: C.pillText }}>
                        <Radar size={10} /> {a.signals.length}
                      </span>
                    )}
                  </button>
                );
              })}
              {items.length === 0 && (
                <div className="rounded-xl p-3 text-center text-xs" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.faint }}>
                  {t('empty', 'leeg')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
    </div>
  );
}

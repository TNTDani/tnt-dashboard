'use client';

// ClientValueCard — Card #2 of the Kansen screen.
// Per-account commercial scorecard: top clients vs time-sinks.
// Every label carries the figures that triggered it — no black-box verdicts.

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle, Loader2, ChevronDown, ChevronUp, ChevronsUpDown,
  Star, Clock, ChevronRight,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import {
  getClientScorecard,
  type ClientScorecard,
  type AccountScore,
} from '@/lib/clientScorecard';
import type { Vacancy, Placement } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000)     return `€${Math.round(n / 1_000)}k`;
  return `€${n.toLocaleString('nl-NL')}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortCol =
  | 'companyName'
  | 'vacancyCount'
  | 'placementCount'
  | 'bookedRevenue'
  | 'submissionCount'
  | 'conversion'
  | 'timeToFillDays';

function sortScores(scores: AccountScore[], col: SortCol, dir: 'asc' | 'desc'): AccountScore[] {
  return [...scores].sort((a, b) => {
    let va: number | string | null = a[col] as number | string | null;
    let vb: number | string | null = b[col] as number | string | null;

    // Nulls always last regardless of direction
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;

    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const na = va as number;
    const nb = vb as number;
    return dir === 'asc' ? na - nb : nb - na;
  });
}

// ── Sort header cell ──────────────────────────────────────────────────────────

function SortTh({
  col, current, dir, onSort, align = 'right', children,
}: {
  col: SortCol;
  current: SortCol;
  dir: 'asc' | 'desc';
  onSort: (c: SortCol) => void;
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const active = col === current;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2.5 text-xs font-medium text-[#9CA3AF] select-none cursor-pointer
        whitespace-nowrap hover:text-[#2D4A2D] transition-colors
        ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active
          ? (dir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)
          : <ChevronsUpDown size={11} className="opacity-30" />}
      </span>
    </th>
  );
}

// ── Insight chip ──────────────────────────────────────────────────────────────

function InsightChip({ score, t }: { score: AccountScore; t: (en: string, nl: string) => string }) {
  const isTop = score.insight === 'top';
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        isTop
          ? 'bg-[#f0f7f0] border-[#c6dfc6]'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {isTop
          ? <Star size={12} className="text-[#2D4A2D] fill-[#2D4A2D]" />
          : <Clock size={12} className="text-amber-500" />}
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isTop ? 'text-[#2D4A2D]' : 'text-amber-600'}`}>
          {isTop ? t('Top client', 'Top klant') : t('Costs time', 'Kost tijd')}
        </span>
      </div>
      <Link
        href={`/accounts/${score.accountId}`}
        className={`text-sm font-semibold hover:underline underline-offset-2 ${isTop ? 'text-[#2D4A2D]' : 'text-amber-700'}`}
      >
        {score.companyName}
      </Link>
      <p className="text-xs text-[#6B7280] mt-0.5">{score.insightReasons.join(' · ')}</p>
    </div>
  );
}

// ── Drill-down ────────────────────────────────────────────────────────────────

function DrillDown({
  vacancies,
  placements,
  t,
}: {
  vacancies: Vacancy[];
  placements: Placement[];
  t: (en: string, nl: string) => string;
}) {
  return (
    <div className="bg-[rgba(45,74,45,0.02)] border-t border-[rgba(45,74,45,0.06)] px-4 py-3 space-y-3">
      {/* Vacancies */}
      {vacancies.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
            {t('Vacancies', 'Vacatures')}
          </p>
          <div className="space-y-1">
            {vacancies.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs gap-2">
                <Link
                  href={`/vacancies?id=${v.id}`}
                  className="text-[#2D4A2D] hover:underline underline-offset-2 font-medium truncate"
                >
                  {v.title}
                </Link>
                <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium
                  ${v.status === 'open'   ? 'bg-emerald-50 text-emerald-600' :
                    v.status === 'filled' ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-100 text-gray-500'}`}
                >
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placements */}
      {placements.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
            {t('Placements', 'Plaatsingen')}
          </p>
          <div className="space-y-1">
            {placements.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {p.profileId ? (
                    <Link
                      href={`/candidates/${p.profileId}`}
                      className="text-[#2D4A2D] hover:underline underline-offset-2 font-medium truncate"
                    >
                      {p.candidateName}
                    </Link>
                  ) : (
                    <span className="text-[#374151] font-medium truncate">{p.candidateName}</span>
                  )}
                  <span className="text-[#9CA3AF] flex-shrink-0">{fmtDate(p.placementDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.feeAmount != null && p.feeAmount > 0 ? (
                    <span className="text-[#2D4A2D] font-semibold">{fmtEur(p.feeAmount)}</span>
                  ) : null}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${p.paymentStatus === 'paid'     ? 'bg-emerald-50 text-emerald-600' :
                      p.paymentStatus === 'invoiced' ? 'bg-blue-50 text-blue-600' :
                      'bg-amber-50 text-amber-600'}`}
                  >
                    {p.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vacancies.length === 0 && placements.length === 0 && (
        <p className="text-xs text-[#9CA3AF] italic">
          {t('No records found.', 'Geen records gevonden.')}
        </p>
      )}
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function AccountRow({
  score,
  isOpen,
  onToggle,
  t,
}: {
  score: AccountScore;
  isOpen: boolean;
  onToggle: () => void;
  t: (en: string, nl: string) => string;
}) {
  const conversionText = score.conversion !== null
    ? `${score.placementCount}/${score.submissionCount}`
    : '—';
  const conversionTitle = score.conversion !== null
    ? `${Math.round(score.conversion * 100)}%`
    : t('Insufficient data', 'Te weinig data');
  const ttfText = score.timeToFillDays !== null
    ? `${score.timeToFillDays}d`
    : '—';
  const ttfTitle = score.timeToFillDays === null
    ? t('Insufficient data (< 2 placements)', 'Te weinig data (< 2 plaatsingen)')
    : `${score.timeToFillDays} ${t('days average', 'dagen gemiddeld')}`;

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-[rgba(45,74,45,0.06)] last:border-0 hover:bg-[rgba(45,74,45,0.03)] transition-colors cursor-pointer group"
      >
        {/* Account name */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {score.insight === 'top' && (
              <Star size={10} className="text-[#2D4A2D] fill-[#2D4A2D] flex-shrink-0" />
            )}
            {score.insight === 'time_sink' && (
              <Clock size={10} className="text-amber-500 flex-shrink-0" />
            )}
            <Link
              href={`/accounts/${score.accountId}`}
              onClick={e => e.stopPropagation()}
              className="text-sm text-[#2D4A2D] font-medium hover:underline underline-offset-2"
            >
              {score.companyName}
            </Link>
          </div>
        </td>

        {/* Vacatures */}
        <td className="px-3 py-2.5 text-right text-sm text-[#374151] tabular-nums">
          {score.vacancyCount > 0 ? (
            <>
              {score.openVacancyCount > 0
                ? <><span className="text-[#2D4A2D] font-medium">{score.openVacancyCount}</span>
                    <span className="text-[#9CA3AF] text-xs">/{score.vacancyCount}</span>
                  </>
                : <span className="text-[#9CA3AF]">{score.vacancyCount}</span>}
            </>
          ) : '—'}
        </td>

        {/* Plaatsingen */}
        <td className="px-3 py-2.5 text-right text-sm tabular-nums">
          <span className={score.placementCount > 0 ? 'text-[#2D4A2D] font-medium' : 'text-[#9CA3AF]'}>
            {score.placementCount > 0 ? score.placementCount : '—'}
          </span>
        </td>

        {/* Booked revenue */}
        <td className="px-3 py-2.5 text-right text-sm tabular-nums">
          {score.bookedRevenue > 0
            ? <span className="text-[#2D4A2D] font-semibold">{fmtEur(score.bookedRevenue)}</span>
            : <span className="text-[#9CA3AF]">€0</span>}
        </td>

        {/* Conversie */}
        <td className="px-3 py-2.5 text-right text-xs tabular-nums" title={conversionTitle}>
          <span className={score.conversion !== null ? 'text-[#374151]' : 'text-[#9CA3AF]'}>
            {conversionText}
          </span>
        </td>

        {/* Doorlooptijd */}
        <td className="px-3 py-2.5 text-right text-xs tabular-nums" title={ttfTitle}>
          <span className={score.timeToFillDays !== null ? 'text-[#374151]' : 'text-[#9CA3AF]'}>
            {ttfText}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-[#9CA3AF] group-hover:text-[#2D4A2D] transition-colors">
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </td>
      </tr>

      {/* Drill-down row */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.tr
            key={`drill-${score.accountId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <td colSpan={7} className="p-0">
              <DrillDown vacancies={score.vacancies} placements={score.placements} t={t} />
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function ClientValueCard() {
  const t = useT();
  const [data, setData]         = useState<ClientScorecard | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [sortCol, setSortCol]   = useState<SortCol>('bookedRevenue');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [openId, setOpenId]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getClientScorecard()
      .then(setData)
      .catch(() => setError(t('Failed to load scorecard.', 'Ophalen mislukt.')))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortScores(data.accounts, sortCol, sortDir);
  }, [data, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6 flex items-center justify-center min-h-[160px]">
        <Loader2 size={20} className="animate-spin text-[#9CA3AF]" />
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6 flex items-center gap-3 text-[#9CA3AF]">
        <AlertCircle size={16} />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // ── Empty ──
  if (data.accounts.length === 0) {
    return (
      <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl px-4 py-8 text-center">
        <p className="text-sm text-[#9CA3AF]">
          {t('No accounts with vacancies or placements yet.', 'Nog geen accounts met vacatures of plaatsingen.')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[rgba(45,74,45,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-0.5">
          {t('Client value', 'Klantwaarde')}
        </p>
        <p className="text-sm text-[#6B7280]">
          {t('Which accounts generate revenue — and which cost more time than they return.',
             'Welke accounts leveren omzet op — en welke kosten meer tijd dan ze opbrengen.')}
        </p>
      </div>

      {/* ── Insight strip ── */}
      {(data.topClient || data.timeSink) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 py-3 border-b border-[rgba(45,74,45,0.08)] bg-[rgba(45,74,45,0.01)]">
          {data.topClient && <InsightChip score={data.topClient} t={t} />}
          {data.timeSink  && <InsightChip score={data.timeSink}  t={t} />}
        </div>
      )}

      {/* ── Sortable table ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(45,74,45,0.08)]">
              <SortTh col="companyName"    current={sortCol} dir={sortDir} onSort={handleSort} align="left">
                {t('Account', 'Account')}
              </SortTh>
              <SortTh col="vacancyCount"   current={sortCol} dir={sortDir} onSort={handleSort}>
                {t('Vacancies', 'Vacatures')}
              </SortTh>
              <SortTh col="placementCount" current={sortCol} dir={sortDir} onSort={handleSort}>
                {t('Placed', 'Geplaatst')}
              </SortTh>
              <SortTh col="bookedRevenue"  current={sortCol} dir={sortDir} onSort={handleSort}>
                {t('Booked', 'Booked')}
              </SortTh>
              <SortTh col="conversion"     current={sortCol} dir={sortDir} onSort={handleSort}>
                {t('Conversion', 'Conversie')}
              </SortTh>
              <SortTh col="timeToFillDays" current={sortCol} dir={sortDir} onSort={handleSort}>
                {t('Time-to-fill', 'Doorlooptijd')}
              </SortTh>
              {/* expand icon col — no sort */}
              <th className="px-3 py-2.5 w-6" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(score => (
              <AccountRow
                key={score.accountId}
                score={score}
                isOpen={openId === score.accountId}
                onToggle={() => setOpenId(prev => prev === score.accountId ? null : score.accountId)}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Honesty caveat ── */}
      <div className="px-4 py-2.5 border-t border-[rgba(45,74,45,0.06)]">
        <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
          {t(
            'Conversion and time-to-fill hidden below minimum data thresholds. Booked = paid placements only.',
            'Conversie en doorlooptijd verborgen onder minimum datapunten. Booked = uitsluitend betaalde plaatsingen.',
          )}
        </p>
      </div>
    </div>
  );
}

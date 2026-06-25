'use client';

// RevenuePipelineCard — Omzet-pipeline forecast (card #1 of the Kansen screen).
// Shows open-pipeline revenue by stage. Raw sum, no probability weighting.
// Drill-down on every row: exact candidates + derivation behind the total.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { getPipelineForecast, type PipelineForecast, type StageRow, type MatchDetail } from '@/lib/pipelineForecast';

// ── Stage visual config ───────────────────────────────────────────────────────

const STAGE_DOT: Record<string, string> = {
  submitted:     'bg-blue-400',
  interviewing:  'bg-amber-400',
  offer:         'bg-emerald-500',
  placed_unpaid: 'bg-[#2D4A2D]',
};

const STAGE_LABEL_WEIGHT: Record<string, string> = {
  placed_unpaid: 'font-semibold text-[#2D4A2D]',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000)     return `€${Math.round(n / 1_000)}k`;
  return `€${n.toLocaleString('nl-NL')}`;
}

// ── Drill-down table ──────────────────────────────────────────────────────────

function DrillDown({ matches, t }: { matches: MatchDetail[]; t: (en: string, nl: string) => string }) {
  if (matches.length === 0) {
    return (
      <p className="text-xs text-[#9CA3AF] px-4 py-3 italic">
        {t('No candidates in this stage.', 'Geen kandidaten in deze fase.')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[rgba(45,74,45,0.08)]">
            <th className="text-left px-4 py-2 text-[#9CA3AF] font-medium">
              {t('Candidate', 'Kandidaat')}
            </th>
            <th className="text-left px-4 py-2 text-[#9CA3AF] font-medium">
              {t('Vacancy', 'Vacature')}
            </th>
            <th className="text-left px-4 py-2 text-[#9CA3AF] font-medium hidden sm:table-cell">
              {t('Company', 'Bedrijf')}
            </th>
            <th className="text-right px-4 py-2 text-[#9CA3AF] font-medium">
              {t('Expected fee', 'Verwacht fee')}
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => (
            <tr
              key={m.matchId}
              className="border-b border-[rgba(45,74,45,0.05)] last:border-0 hover:bg-[rgba(45,74,45,0.03)] transition-colors"
            >
              <td className="px-4 py-2.5">
                {m.profileId ? (
                  <Link
                    href={`/candidates/${m.profileId}`}
                    className="text-[#2D4A2D] hover:underline underline-offset-2 font-medium"
                  >
                    {m.candidateName}
                  </Link>
                ) : (
                  <span className="text-[#2D4A2D] font-medium">{m.candidateName}</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {m.vacancyId ? (
                  <Link
                    href={`/vacancies?id=${m.vacancyId}`}
                    className="text-[#2D4A2D] hover:underline underline-offset-2"
                  >
                    {m.vacancyTitle}
                  </Link>
                ) : (
                  <span className="text-[#6B7280]">{m.vacancyTitle}</span>
                )}
              </td>
              <td className="px-4 py-2.5 hidden sm:table-cell">
                {m.accountId ? (
                  <Link
                    href={`/accounts/${m.accountId}`}
                    className="text-[#6B7280] hover:text-[#2D4A2D] hover:underline underline-offset-2"
                  >
                    {m.company}
                  </Link>
                ) : (
                  <span className="text-[#9CA3AF]">{m.company}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                {m.expectedFee != null ? (
                  <span className="text-[#2D4A2D] font-semibold">{fmtEur(m.expectedFee)}</span>
                ) : (
                  <span className="text-amber-500 text-[10px] font-medium">
                    {t('fee unknown', 'fee onbekend')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stage row ─────────────────────────────────────────────────────────────────

function StageRowItem({
  row,
  isOpen,
  onToggle,
  t,
}: {
  row: StageRow;
  isOpen: boolean;
  onToggle: () => void;
  t: (en: string, nl: string) => string;
}) {
  const labelCls = STAGE_LABEL_WEIGHT[row.status] ?? 'text-[#374151]';
  const dot = STAGE_DOT[row.status] ?? 'bg-gray-400';

  return (
    <div className="border-b border-[rgba(45,74,45,0.08)] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(45,74,45,0.03)] transition-colors text-left group"
      >
        {/* Stage dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />

        {/* Label + count */}
        <span className={`flex-1 text-sm ${labelCls}`}>
          {row.label}
        </span>
        <span className="text-xs text-[#9CA3AF] mr-2">
          {row.count} {t(row.count === 1 ? 'candidate' : 'candidates', row.count === 1 ? 'kandidaat' : 'kandidaten')}
        </span>

        {/* Fee */}
        <span className={`text-sm tabular-nums w-20 text-right ${row.status === 'placed_unpaid' ? 'text-[#2D4A2D] font-semibold' : 'text-[#374151]'}`}>
          {row.totalFee > 0 ? fmtEur(row.totalFee) : (row.count > 0 ? '—' : '')}
        </span>

        {/* Expand icon */}
        <span className="ml-2 text-[#9CA3AF] group-hover:text-[#2D4A2D] transition-colors flex-shrink-0">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Unknown fee warning inline */}
      {row.unknownFeeCount > 0 && !isOpen && (
        <p className="text-[10px] text-amber-500 px-4 pb-2 -mt-1">
          {t(`${row.unknownFeeCount} without fee info`, `${row.unknownFeeCount} zonder fee-info`)}
        </p>
      )}

      {/* Drill-down */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="drill"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden bg-[rgba(45,74,45,0.02)]"
          >
            <DrillDown matches={row.matches} t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function RevenuePipelineCard() {
  const t = useT();
  const [data, setData]             = useState<PipelineForecast | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [openStage, setOpenStage]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPipelineForecast()
      .then(setData)
      .catch(() => setError(t('Failed to load pipeline data.', 'Ophalen mislukt.')))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (status: string) =>
    setOpenStage(prev => (prev === status ? null : status));

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl p-6 flex items-center justify-center min-h-[180px]">
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

  const nonEmptyStages = data.stages.filter(s => s.count > 0);

  return (
    <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[rgba(45,74,45,0.08)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
              {t('Revenue pipeline', 'Omzet-pipeline')}
            </p>
            <p className="text-2xl font-bold text-[#2D4A2D] tabular-nums">
              {data.totalFee > 0 ? fmtEur(data.totalFee) : '—'}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {t('expected · open pipeline', 'verwacht · huidige open pipeline')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-[#374151] tabular-nums">{data.grandCount}</p>
            <p className="text-xs text-[#9CA3AF]">
              {t(data.grandCount === 1 ? 'candidate' : 'candidates', data.grandCount === 1 ? 'kandidaat' : 'kandidaten')}
            </p>
          </div>
        </div>

        {/* Honesty caveat — always visible */}
        <p className="text-[10px] text-[#9CA3AF] mt-2 leading-relaxed">
          {t(
            'Raw sum — no probability weighting. All open matches, no date filter.',
            'Ruwe som — geen kansweging. Alle open matches, geen datumfilter.',
          )}
        </p>
      </div>

      {/* ── Stage rows ── */}
      {nonEmptyStages.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] px-4 py-6 text-center">
          {t('No open candidates in the pipeline.', 'Geen open kandidaten in de pipeline.')}
        </p>
      ) : (
        <div>
          {data.stages.map(row => {
            if (row.count === 0) return null;
            return (
              <StageRowItem
                key={row.status}
                row={row}
                isOpen={openStage === row.status}
                onToggle={() => toggle(row.status)}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* ── Fee unknown row ── */}
      {data.totalUnknownCount > 0 && (
        <div className="px-4 py-3 border-t border-[rgba(45,74,45,0.06)] flex items-center gap-2">
          <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-[#9CA3AF]">
            {t(
              `fee not set — ${data.totalUnknownCount} candidate${data.totalUnknownCount !== 1 ? 's' : ''} excluded from total`,
              `fee niet ingesteld — ${data.totalUnknownCount} kandidaat${data.totalUnknownCount !== 1 ? 'en' : ''} niet meegeteld`,
            )}
          </p>
        </div>
      )}
    </div>
  );
}

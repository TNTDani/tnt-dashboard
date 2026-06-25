// src/lib/clientScorecard.ts
// Per-account commercial scorecard. All metrics are computed, none stored.
// Honesty rule: every € is traceable to a real record; insight labels carry
// the exact figures that triggered them. Unknown fees are surfaced, not guessed.

import { db } from '@/lib/db';
import { accountsDb } from '@/lib/accountsDb';
import type { Vacancy, CandidateVacancyMatch, Placement, Client } from '@/lib/types';
import type { Account } from '@/lib/accountTypes';
import { deriveFeeFromAgreement, deriveFeeFromClient, derivePlacementFee } from '@/lib/feeDerivation';

// ── Thresholds ────────────────────────────────────────────────────────────────

const TIME_TO_FILL_MIN_PLACEMENTS = 2;  // need ≥N to show avg (otherwise noisy)
const CONVERSION_MIN_SUBMISSIONS   = 3;  // need ≥N submissions to show ratio
const TIME_SINK_SUBMISSION_MIN     = 5;  // ≥N CVs sent with €0 booked → kost tijd
const TIME_SINK_VACANCY_MIN        = 3;  // OR ≥N vacancies with 0 placements → kost tijd

// ── Public types ──────────────────────────────────────────────────────────────

export interface AccountScore {
  accountId: string;
  companyName: string;
  vacancyCount: number;
  openVacancyCount: number;
  placementCount: number;
  bookedRevenue: number;       // sum of fees on paid placements
  forecastRevenue: number;     // pending/invoiced placements + open-match pipeline
  submissionCount: number;     // matches that reached submitted or beyond
  timeToFillDays: number | null; // null = fewer than TIME_TO_FILL_MIN_PLACEMENTS data points
  conversion: number | null;   // placements / submissionCount; null = insufficient data
  insight: 'top' | 'time_sink' | null;
  insightReasons: string[];    // human-readable figures behind the label
  // raw records for drill-down
  vacancies: Vacancy[];
  placements: Placement[];
}

export interface ClientScorecard {
  accounts: AccountScore[];    // only accounts that have ≥1 vacancy or ≥1 placement
  topClient: AccountScore | null;
  timeSink: AccountScore | null;
}

// ── Fee resolution helpers ────────────────────────────────────────────────────

type ResolveFeeFn = (vacancy: Vacancy) => number | null;

function buildFeeResolver(
  accountMap: Map<string, Account>,
  clientMap: Map<string, Client>,
): ResolveFeeFn {
  return (vacancy: Vacancy): number | null => {
    if (!vacancy.accountId) return null;
    const account = accountMap.get(vacancy.accountId);
    if (!account) return null;

    // Prefer fee agreement stored directly on the account (post-overhaul path).
    if (account.feeAgreement) {
      return deriveFeeFromAgreement(vacancy, account.feeAgreement as import('@/lib/types').FeeAgreement);
    }
    // Fallback: legacy convertedClientId → Client chain.
    if (account.convertedClientId) {
      const client = clientMap.get(account.convertedClientId);
      if (client) return deriveFeeFromClient(vacancy, client);
    }
    return null;
  };
}

// ── Statuses that represent a CV having been submitted to a client ────────────

// 'active' and 'on-hold' have not yet been introduced to the client.
const SUBMITTED_STATUSES = new Set<CandidateVacancyMatch['status']>([
  'submitted', 'interviewing', 'offer', 'placed', 'rejected', 'withdrawn',
]);

const OPEN_STATUSES = new Set<CandidateVacancyMatch['status']>([
  'submitted', 'interviewing', 'offer',
]);

// ── Main export ───────────────────────────────────────────────────────────────

export async function getClientScorecard(): Promise<ClientScorecard> {
  const [accounts, vacancies, matches, placements, clients] = await Promise.all([
    accountsDb.getAccounts(),
    db.getVacancies(),
    db.getMatches(),
    db.getPlacements(),
    db.getClients(),
  ]);

  const accountMap   = new Map<string, Account>(accounts.map(a => [a.id, a]));
  const clientMap    = new Map<string, Client>(clients.map(c => [c.id, c]));
  const vacancyMap   = new Map<string, Vacancy>(vacancies.map(v => [v.id, v]));
  const resolveFee   = buildFeeResolver(accountMap, clientMap);

  // Group vacancies by accountId
  const vacanciesByAccount = new Map<string, Vacancy[]>();
  for (const v of vacancies) {
    if (!v.accountId) continue;
    const arr = vacanciesByAccount.get(v.accountId) ?? [];
    arr.push(v);
    vacanciesByAccount.set(v.accountId, arr);
  }

  // Group placements by accountId (direct FK first; fall back via vacancyId)
  const placementsByAccount = new Map<string, Placement[]>();
  for (const p of placements) {
    const aid = p.accountId ?? (p.vacancyId ? vacancyMap.get(p.vacancyId)?.accountId : undefined);
    if (!aid) continue;
    const arr = placementsByAccount.get(aid) ?? [];
    arr.push(p);
    placementsByAccount.set(aid, arr);
  }

  // Group matches by vacancy accountId
  const matchesByAccount = new Map<string, CandidateVacancyMatch[]>();
  for (const m of matches) {
    if (!m.vacancyId) continue;
    const v = vacancyMap.get(m.vacancyId);
    if (!v?.accountId) continue;
    const arr = matchesByAccount.get(v.accountId) ?? [];
    arr.push(m);
    matchesByAccount.set(v.accountId, arr);
  }

  // ── Build per-account scores ───────────────────────────────────────────────

  const scores: AccountScore[] = [];

  for (const account of accounts) {
    const acctVacancies  = vacanciesByAccount.get(account.id) ?? [];
    const acctPlacements = placementsByAccount.get(account.id) ?? [];
    const acctMatches    = matchesByAccount.get(account.id) ?? [];

    // Skip accounts with no activity at all
    if (acctVacancies.length === 0 && acctPlacements.length === 0) continue;

    // ── Vacancy counts ──
    const vacancyCount     = acctVacancies.length;
    const openVacancyCount = acctVacancies.filter(v => v.status === 'open').length;

    // ── Placement counts ──
    const placementCount = acctPlacements.length;

    // ── Revenue: booked (paid) ──
    let bookedRevenue = 0;
    for (const p of acctPlacements) {
      if (p.paymentStatus !== 'paid') continue;
      const fee = derivePlacementFee(p) ?? 0;
      bookedRevenue += fee;
    }

    // ── Revenue: forecast (pending/invoiced placements + open-match pipeline) ──
    let forecastRevenue = 0;

    // Pending/invoiced placements
    for (const p of acctPlacements) {
      if (p.paymentStatus === 'paid') continue;
      let fee = derivePlacementFee(p);
      if (fee === null && p.vacancyId) {
        const v = vacancyMap.get(p.vacancyId);
        if (v) fee = resolveFee(v);
      }
      forecastRevenue += fee ?? 0;
    }

    // Open matches (submitted / interviewing / offer)
    for (const m of acctMatches) {
      if (!OPEN_STATUSES.has(m.status as CandidateVacancyMatch['status'])) continue;
      if (!m.vacancyId) continue;
      const v = vacancyMap.get(m.vacancyId);
      if (v) forecastRevenue += resolveFee(v) ?? 0;
    }

    // ── Submissions (CVs sent to this client) ──
    const submissionCount = acctMatches.filter(
      m => SUBMITTED_STATUSES.has(m.status as CandidateVacancyMatch['status'])
    ).length;

    // ── Time to fill (avg days: vacancy.createdAt → placement.placementDate) ──
    const filledPairs: { vacancyCreatedAt: string; placementDate: string }[] = [];
    for (const p of acctPlacements) {
      if (!p.vacancyId) continue;
      const v = vacancyMap.get(p.vacancyId);
      if (!v) continue;
      filledPairs.push({ vacancyCreatedAt: v.createdAt, placementDate: p.placementDate });
    }

    let timeToFillDays: number | null = null;
    if (filledPairs.length >= TIME_TO_FILL_MIN_PLACEMENTS) {
      const totalDays = filledPairs.reduce((sum, pair) => {
        const ms = new Date(pair.placementDate).getTime() - new Date(pair.vacancyCreatedAt).getTime();
        return sum + ms / (1000 * 60 * 60 * 24);
      }, 0);
      timeToFillDays = Math.round(totalDays / filledPairs.length);
    }

    // ── Conversion (placements / submissions) ──
    let conversion: number | null = null;
    if (submissionCount >= CONVERSION_MIN_SUBMISSIONS) {
      conversion = placementCount / submissionCount;
    }

    scores.push({
      accountId: account.id,
      companyName: account.companyName,
      vacancyCount,
      openVacancyCount,
      placementCount,
      bookedRevenue,
      forecastRevenue,
      submissionCount,
      timeToFillDays,
      conversion,
      insight: null,
      insightReasons: [],
      vacancies: acctVacancies,
      placements: acctPlacements,
    });
  }

  // ── Insight labeling ──────────────────────────────────────────────────────

  // Top client: must have at least one placement; highest booked revenue wins.
  const topCandidate = scores
    .filter(s => s.placementCount > 0)
    .sort((a, b) => b.bookedRevenue - a.bookedRevenue)[0] ?? null;

  // Time sink: €0 booked AND high effort (many CVs or many vacancies with no result).
  const timeSinkCandidate = scores
    .filter(s =>
      s.bookedRevenue === 0 &&
      (s.submissionCount >= TIME_SINK_SUBMISSION_MIN || s.vacancyCount >= TIME_SINK_VACANCY_MIN),
    )
    .sort((a, b) => (b.submissionCount + b.vacancyCount * 2) - (a.submissionCount + a.vacancyCount * 2))[0] ?? null;

  if (topCandidate) {
    topCandidate.insight = 'top';
    topCandidate.insightReasons = [
      `€${Math.round(topCandidate.bookedRevenue / 1000)}k booked`,
      `${topCandidate.vacancyCount} vacature${topCandidate.vacancyCount !== 1 ? 's' : ''}`,
      `${topCandidate.placementCount} plaatsing${topCandidate.placementCount !== 1 ? 'en' : ''}`,
    ];
  }

  if (timeSinkCandidate) {
    timeSinkCandidate.insight = 'time_sink';
    timeSinkCandidate.insightReasons = [
      `€0 booked`,
      `${timeSinkCandidate.vacancyCount} vacature${timeSinkCandidate.vacancyCount !== 1 ? 's' : ''}`,
      `${timeSinkCandidate.submissionCount} CV${timeSinkCandidate.submissionCount !== 1 ? "s" : ''} gestuurd`,
    ];
  }

  return {
    accounts: scores,
    topClient: topCandidate,
    timeSink: timeSinkCandidate,
  };
}

// src/lib/pipelineForecast.ts
// Derives expected revenue from open matches — no AI, no probability weighting.
// Honest rule: every € is traceable to a real record; unknown fees are surfaced, never guessed.

import { db } from '@/lib/db';
import { accountsDb } from '@/lib/accountsDb';
import type { Vacancy, CandidateVacancyMatch, Placement, CandidateProfile, Client } from '@/lib/types';
import type { Account } from '@/lib/accountTypes';

// ── Public types ──────────────────────────────────────────────────────────────

export interface MatchDetail {
  matchId: string;
  candidateId: string;
  profileId?: string;
  candidateName: string;
  vacancyId: string;
  vacancyTitle: string;
  company: string;
  accountId?: string;
  expectedFee: number | null; // null = fee unknown; never guessed
}

export interface StageRow {
  status: string;
  label: string;
  count: number;
  totalFee: number;       // sum of derivable fees only
  unknownFeeCount: number;
  matches: MatchDetail[];
}

export interface PipelineForecast {
  stages: StageRow[];
  totalFee: number;
  grandCount: number;
  totalUnknownCount: number;
}

// ── Internal constants ────────────────────────────────────────────────────────

// Standard placement fee percentages by seniority (agency standard rates).
const STANDARD_RATE_PCT: Record<string, number> = {
  'Junior': 18,
  'Medior': 18,
  'Junior/Medior': 18,
  'Senior': 20,
  'Management': 22,
  'Management/Lead': 22,
  'Lead': 22,
};

const STAGE_CONFIG: { status: string; label: string }[] = [
  { status: 'submitted',     label: 'CV ingestuurd' },
  { status: 'interviewing',  label: 'Interview' },
  { status: 'offer',         label: 'Offer' },
  { status: 'placed_unpaid', label: 'Geplaatst (te factureren)' },
];

const OPEN_STATUSES = new Set<CandidateVacancyMatch['status']>([
  'submitted', 'interviewing', 'offer',
]);

// ── Fee derivation ────────────────────────────────────────────────────────────

/**
 * Derive expected fee for an open match:
 * vacancy.salaryMin/Max midpoint × client.feeAgreement rate.
 * Returns null when any required piece is missing — never substitutes a default.
 */
function deriveFeeFromClient(vacancy: Vacancy, client: Client): number | null {
  const midpoint = (vacancy.salaryMin + vacancy.salaryMax) / 2;
  if (!midpoint || midpoint <= 0) return null;

  const fa = client.feeAgreement;
  if (!fa) return null;

  if (fa.type === 'custom' && fa.customPercentage) {
    return Math.round((fa.customPercentage / 100) * midpoint);
  }
  if (fa.type === 'retainer') {
    if (fa.retainerAmount) return fa.retainerAmount;
    if (fa.retainerPercentage) return Math.round((fa.retainerPercentage / 100) * midpoint);
  }
  if (fa.type === 'standard') {
    const rate = STANDARD_RATE_PCT[vacancy.seniorityLevel];
    if (rate) return Math.round((rate / 100) * midpoint);
  }
  return null;
}

/**
 * Derive expected fee from a Placement row (placed+unpaid):
 * Uses stored feeAmount first; falls back to feePercentage × grossAnnualSalary.
 */
function derivePlacementFee(p: Placement): number | null {
  if (p.feeAmount != null && p.feeAmount > 0) return p.feeAmount;
  if (p.feePercentage && p.grossAnnualSalary) {
    return Math.round((p.feePercentage / 100) * p.grossAnnualSalary);
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the open-pipeline revenue forecast.
 * Scope: ALL open matches + placed-but-unpaid placements.
 * No 90-day window (no expected-close-date field exists yet — would be dishonest to simulate).
 */
export async function getPipelineForecast(): Promise<PipelineForecast> {
  const [matches, vacancies, profiles, placements, clients, accounts] = await Promise.all([
    db.getMatches(),
    db.getVacancies(),
    db.getCandidateProfiles(),
    db.getPlacements(),
    db.getClients(),
    accountsDb.getAccounts(),
  ]);

  // Build lookup maps
  const vacancyMap  = new Map<string, Vacancy>(vacancies.map(v => [v.id, v]));
  const profileMap  = new Map<string, CandidateProfile>(profiles.map(p => [p.id, p]));
  const accountMap  = new Map<string, Account>(accounts.map(a => [a.id, a]));
  const clientMap   = new Map<string, Client>(clients.map(c => [c.id, c]));

  // Resolve Client from a Vacancy via the account→convertedClientId chain
  const resolveClient = (vacancy: Vacancy): Client | undefined => {
    if (!vacancy.accountId) return undefined;
    const account = accountMap.get(vacancy.accountId);
    if (!account?.convertedClientId) return undefined;
    return clientMap.get(account.convertedClientId);
  };

  // ── Open matches (submitted / interviewing / offer) ────────────────────────
  const stageMap = new Map<string, MatchDetail[]>(
    STAGE_CONFIG.map(c => [c.status, []])
  );

  for (const match of matches) {
    if (!OPEN_STATUSES.has(match.status as CandidateVacancyMatch['status'])) continue;

    const vacancy  = match.vacancyId ? vacancyMap.get(match.vacancyId) : undefined;
    const profile  = profileMap.get(match.candidateId);
    const candidateName = profile
      ? `${profile.firstName} ${profile.lastName}`
      : match.candidateId;

    let expectedFee: number | null = null;
    if (vacancy) {
      const client = resolveClient(vacancy);
      if (client) expectedFee = deriveFeeFromClient(vacancy, client);
    }

    stageMap.get(match.status)!.push({
      matchId: match.id,
      candidateId: match.candidateId,
      profileId: profile?.id,
      candidateName,
      vacancyId: match.vacancyId ?? '',
      vacancyTitle: vacancy?.title ?? '—',
      company: vacancy?.company ?? '—',
      accountId: vacancy?.accountId,
      expectedFee,
    });
  }

  // ── Placed + unpaid placements (won, fee not yet collected) ───────────────
  const placedUnpaid: MatchDetail[] = [];
  for (const p of placements) {
    if (p.paymentStatus === 'paid') continue; // booked revenue — out of forecast scope

    // Try placement-stored fee first; fall back to vacancy→client chain
    let expectedFee = derivePlacementFee(p);
    if (expectedFee === null && p.vacancyId) {
      const vacancy = vacancyMap.get(p.vacancyId);
      if (vacancy) {
        const client = resolveClient(vacancy);
        if (client) expectedFee = deriveFeeFromClient(vacancy, client);
      }
    }

    placedUnpaid.push({
      matchId: p.applicationId ?? p.id,
      candidateId: p.candidateId,
      profileId: p.profileId,
      candidateName: p.candidateName,
      vacancyId: p.vacancyId ?? '',
      vacancyTitle: p.vacancyTitle,
      company: p.company,
      accountId: p.accountId,
      expectedFee,
    });
  }
  stageMap.set('placed_unpaid', placedUnpaid);

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const stages: StageRow[] = STAGE_CONFIG.map(cfg => {
    const matchList = stageMap.get(cfg.status) ?? [];
    return {
      status: cfg.status,
      label: cfg.label,
      count: matchList.length,
      totalFee: matchList.reduce((s, m) => s + (m.expectedFee ?? 0), 0),
      unknownFeeCount: matchList.filter(m => m.expectedFee === null).length,
      matches: matchList,
    };
  });

  return {
    stages,
    totalFee:           stages.reduce((s, r) => s + r.totalFee, 0),
    grandCount:         stages.reduce((s, r) => s + r.count, 0),
    totalUnknownCount:  stages.reduce((s, r) => s + r.unknownFeeCount, 0),
  };
}

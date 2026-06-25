// src/lib/feeDerivation.ts
// Shared fee derivation logic — single source of truth for both pipelineForecast and
// clientScorecard. Honesty rule: returns null whenever required data is missing; never guesses.

import type { Vacancy, FeeAgreement, Client, Placement } from '@/lib/types';

// Standard placement fee percentages by seniority (agency standard rates).
export const STANDARD_RATE_PCT: Record<string, number> = {
  'Junior':          18,
  'Medior':          18,
  'Junior/Medior':   18,
  'Senior':          20,
  'Management':      22,
  'Management/Lead': 22,
  'Lead':            22,
};

/**
 * Derive expected fee from a vacancy + fee agreement.
 * Salary midpoint × the agreed rate. Returns null if any piece is missing.
 */
export function deriveFeeFromAgreement(
  vacancy: Vacancy,
  fa: FeeAgreement,
): number | null {
  const midpoint = (vacancy.salaryMin + vacancy.salaryMax) / 2;
  if (!midpoint || midpoint <= 0) return null;

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
 * Derive expected fee from a vacancy + Client row (legacy path via convertedClientId).
 */
export function deriveFeeFromClient(vacancy: Vacancy, client: Client): number | null {
  if (!client.feeAgreement) return null;
  return deriveFeeFromAgreement(vacancy, client.feeAgreement);
}

/**
 * Derive expected fee from a Placement row.
 * Uses stored feeAmount first; falls back to feePercentage × grossAnnualSalary.
 */
export function derivePlacementFee(p: Placement): number | null {
  if (p.feeAmount != null && p.feeAmount > 0) return p.feeAmount;
  if (p.feePercentage && p.grossAnnualSalary) {
    return Math.round((p.feePercentage / 100) * p.grossAnnualSalary);
  }
  return null;
}

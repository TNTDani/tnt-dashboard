// src/lib/credits.ts
// Credit accounting — two-bucket model:
//   allowance_credits  monthly grant, refills to plan cap each cycle
//   purchased_credits  top-up packs, stack above cap, never reset
//
// Spending draws from allowance first, then purchased (spend_credits rpc).
// Balance shown to user = allowance + purchased.
// All 11 AI routes call chargeCredits(); its signature is unchanged.

import { supabaseAdmin } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import type { PlanId } from '@/lib/plans';

// ── Feature credit costs ───────────────────────────────────────────────────────

export const CREDIT_COST = {
  pitch:             3,
  cold_email:        1,
  enrich_quick:      2,
  enrich_deep:       8,
  cv_parse:          1,
  vacancy_parse:     1,
  candidate_match:   2,
  screen:            2,
  questions:         2,
  source_candidates: 3,
  scan_vacancies:    1,
  match_vacancies:   1,
} as const;

export type Feature = keyof typeof CREDIT_COST;

// ── USD cost logging (not billing) ────────────────────────────────────────────

const RATES: Record<string, [number, number]> = {
  'claude-sonnet-4-6':          [3,  15],
  'claude-haiku-4-5-20251001':  [1,  5],
};
const WEB_SEARCH_USD = 0.01;

export function costUsd(model: string, inputTokens = 0, outputTokens = 0, webSearches = 0): number {
  const [inR, outR] = RATES[model] ?? [3, 15];
  return (inputTokens / 1e6) * inR + (outputTokens / 1e6) * outR + webSearches * WEB_SEARCH_USD;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function monthHasPassed(lastRefillAt: string | null | undefined): boolean {
  if (!lastRefillAt) return true;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 1);
  return new Date(lastRefillAt) <= cutoff;
}

// ── Lazy monthly refill ───────────────────────────────────────────────────────

/** Sets allowance_credits = plan cap when ≥ 1 month has passed since last refill.
 *  Never touches purchased_credits. Safe to call on every balance read (idempotent). */
export async function ensureRefill(agencyId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('ai_credits')
    .select('plan, last_refill_at, unlimited')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!data || data.unlimited) return;
  if (!monthHasPassed(data.last_refill_at)) return;

  const cap = PLANS[(data.plan ?? 'starter') as PlanId]?.creditCap ?? 0;
  await supabaseAdmin
    .from('ai_credits')
    .update({ allowance_credits: cap, last_refill_at: new Date().toISOString() })
    .eq('agency_id', agencyId);
}

// ── Balance reads ─────────────────────────────────────────────────────────────

/** Returns total spendable balance (allowance + purchased). Infinity for unlimited. */
export async function getBalance(agencyId: string): Promise<number> {
  await ensureRefill(agencyId);
  const { data } = await supabaseAdmin
    .from('ai_credits')
    .select('allowance_credits, purchased_credits, unlimited')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!data) return 0;
  if (data.unlimited) return Infinity;
  return (data.allowance_credits ?? 0) + (data.purchased_credits ?? 0);
}

export interface BalanceDetail {
  allowance: number;
  purchased: number;
  cap: number;
  total: number;
  unlimited: boolean;
  plan: string;
}

/** Full detail for the credits page UI. */
export async function getBalanceDetail(agencyId: string): Promise<BalanceDetail> {
  await ensureRefill(agencyId);
  const { data } = await supabaseAdmin
    .from('ai_credits')
    .select('allowance_credits, purchased_credits, plan, unlimited')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!data) return { allowance: 0, purchased: 0, cap: 0, total: 0, unlimited: false, plan: 'free' };
  if (data.unlimited) return { allowance: 0, purchased: 0, cap: 0, total: 0, unlimited: true, plan: data.plan ?? 'free' };

  const planId = (data.plan ?? 'starter') as PlanId;
  const cap = PLANS[planId]?.creditCap ?? 0;
  const allowance = data.allowance_credits ?? 0;
  const purchased = data.purchased_credits ?? 0;

  return { allowance, purchased, cap, total: allowance + purchased, unlimited: false, plan: planId };
}

// ── Charge (deduct) credits ───────────────────────────────────────────────────

interface ChargeInput {
  agencyId: string;
  userEmail: string;
  feature: Feature;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  webSearches?: number;
}

/** Deduct credits for a successful AI action and log usage.
 *  Returns { ok, balance, credits } — same shape as before so all 11 routes are untouched. */
export async function chargeCredits(p: ChargeInput): Promise<{ ok: boolean; balance: number; credits: number }> {
  const credits = CREDIT_COST[p.feature];

  // Fast unlimited check — no deduction needed.
  const { data: row } = await supabaseAdmin
    .from('ai_credits')
    .select('unlimited')
    .eq('agency_id', p.agencyId)
    .maybeSingle();

  let ok: boolean;
  let newBalance: number;

  if (row?.unlimited) {
    ok = true;
    newBalance = Infinity;
  } else {
    const { data: spendResult, error } = await supabaseAdmin.rpc('spend_credits', {
      p_agency: p.agencyId,
      p_amount: credits,
    });
    if (error) throw error;
    newBalance = (spendResult as number) ?? -1;
    ok = newBalance >= 0;
  }

  await supabaseAdmin.from('ai_usage').insert({
    agency_id:    p.agencyId,
    user_email:   p.userEmail,
    feature:      p.feature,
    model:        p.model ?? null,
    input_tokens:  p.inputTokens  ?? 0,
    output_tokens: p.outputTokens ?? 0,
    web_searches:  p.webSearches  ?? 0,
    credits:  ok ? credits : 0,
    cost_usd: costUsd(p.model ?? '', p.inputTokens, p.outputTokens, p.webSearches),
  });

  return { ok, balance: ok ? newBalance : 0, credits };
}

// ── Refund (failed AI action) ─────────────────────────────────────────────────

/** Refunds credits after a failed action: fills allowance up to cap first, rest to purchased. */
export async function refundCredits(agencyId: string, credits: number): Promise<void> {
  const { data } = await supabaseAdmin
    .from('ai_credits')
    .select('allowance_credits, purchased_credits, plan, unlimited')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!data || data.unlimited) return;

  const cap = PLANS[(data.plan ?? 'starter') as PlanId]?.creditCap ?? 0;
  const allowanceCurrent = data.allowance_credits ?? 0;
  const purchasedCurrent = data.purchased_credits ?? 0;

  const allowanceSpace = Math.max(0, cap - allowanceCurrent);
  const toAllowance    = Math.min(credits, allowanceSpace);
  const toPurchased    = credits - toAllowance;

  await supabaseAdmin
    .from('ai_credits')
    .update({
      allowance_credits: allowanceCurrent + toAllowance,
      purchased_credits: purchasedCurrent + toPurchased,
    })
    .eq('agency_id', agencyId);
}

// ── Add credits (top-up purchase) ─────────────────────────────────────────────

/** Adds credits to the PURCHASED bucket only. Returns new total balance. */
export async function addCredits(agencyId: string, credits: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from('ai_credits')
    .select('allowance_credits, purchased_credits')
    .eq('agency_id', agencyId)
    .maybeSingle();

  const allowance    = data?.allowance_credits ?? 0;
  const newPurchased = (data?.purchased_credits ?? 0) + credits;

  await supabaseAdmin
    .from('ai_credits')
    .update({ purchased_credits: newPurchased })
    .eq('agency_id', agencyId);

  return allowance + newPurchased;
}

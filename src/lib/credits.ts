// src/lib/credits.ts
// Credits-administratie. 1 credit = ~$0.02 onderliggende AI-kost; features kosten
// een vast aantal credits. Afschrijven is atomisch via de deduct_credits SQL-functie.

import { supabaseAdmin } from '@/lib/supabase';

export const CREDIT_COST = {
  pitch: 3,
  cold_email: 1,
  enrich_quick: 2,
  enrich_deep: 8,
  cv_parse: 1,
  vacancy_parse: 1,
  candidate_match: 2,
  screen: 2,
  questions: 2,
  source_candidates: 3,
  scan_vacancies: 1,
  match_vacancies: 1,
} as const;

export type Feature = keyof typeof CREDIT_COST;

// Alleen voor logging/reconciliatie (niet voor facturatie).
const RATES: Record<string, [number, number]> = {
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5-20251001': [1, 5],
};
const WEB_SEARCH_USD = 0.01; // $10 / 1000

export function costUsd(model: string, inputTokens = 0, outputTokens = 0, webSearches = 0): number {
  const [inR, outR] = RATES[model] ?? [3, 15];
  return (inputTokens / 1e6) * inR + (outputTokens / 1e6) * outR + webSearches * WEB_SEARCH_USD;
}

export async function getBalance(agencyId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('ai_credits').select('balance').eq('agency_id', agencyId).maybeSingle();
  return data?.balance ?? 0;
}

/** Atomisch: positief = afschrijven (met saldo-check), negatief = bijschrijven. -1 bij te weinig saldo. */
async function changeBalance(agencyId: string, amount: number): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', { p_agency: agencyId, p_amount: amount });
  if (error) throw error;
  return (data as number) ?? -1;
}

interface ChargeInput {
  agencyId: string;
  userEmail: string;
  feature: Feature;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  webSearches?: number;
}

/** Schrijf credits af voor een geslaagde AI-actie en log het verbruik. */
export async function chargeCredits(p: ChargeInput): Promise<{ ok: boolean; balance: number; credits: number }> {
  const credits = CREDIT_COST[p.feature];
  const balance = await changeBalance(p.agencyId, credits);
  const ok = balance >= 0;

  await supabaseAdmin.from('ai_usage').insert({
    agency_id: p.agencyId,
    user_email: p.userEmail,
    feature: p.feature,
    model: p.model ?? null,
    input_tokens: p.inputTokens ?? 0,
    output_tokens: p.outputTokens ?? 0,
    web_searches: p.webSearches ?? 0,
    credits: ok ? credits : 0,
    cost_usd: costUsd(p.model ?? '', p.inputTokens, p.outputTokens, p.webSearches),
  });

  return { ok, balance: ok ? balance : 0, credits };
}

/** Geef credits terug (bij mislukte actie). */
export async function refundCredits(agencyId: string, credits: number): Promise<void> {
  await changeBalance(agencyId, -credits);
}

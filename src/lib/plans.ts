// src/lib/plans.ts
// Single source of truth for paid plan metadata.
// UI pricing surfaces and grant logic both read from here — no numbers duplicated.

export const PLANS = {
  starter: { label: 'Starter', priceEur: 39, creditCap: 150,  seats: 3   },
  pro:     { label: 'Pro',     priceEur: 69, creditCap: 500,  seats: 15  },
  agency:  { label: 'Agency',  priceEur: 99, creditCap: 1500, seats: 999 },
} as const;

export type PlanId = keyof typeof PLANS;

/** Returns the plan config, falling back to a zero-cap stub for 'free'. */
export function getPlan(id: string | null | undefined): (typeof PLANS)[PlanId] | { label: string; priceEur: 0; creditCap: 0; seats: number } {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return { label: 'Free', priceEur: 0, creditCap: 0, seats: 999 };
}

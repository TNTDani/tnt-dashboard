// src/lib/tiers.ts
// Monthly subscription tier definitions.
// Free = no subscription; paid tiers give a credit allowance each billing cycle.

export type TierId = 'free' | 'starter' | 'pro' | 'agency';

export interface Tier {
  id: TierId;
  label: string;
  priceCents: number;
  priceLabel: string;
  credits: number; // credits added each month
  description: string;
  features: string[];
}

export const TIERS: Tier[] = [
  {
    id: 'free',
    label: 'Free',
    priceCents: 0,
    priceLabel: '€0/mo',
    credits: 0,
    description: 'Try Orchard without a subscription',
    features: [
      'Unlimited accounts, candidates, vacancies',
      'No AI credits included',
      'Buy top-up packs as needed',
    ],
  },
  {
    id: 'starter',
    label: 'Starter',
    priceCents: 3900,
    priceLabel: '€39/mo',
    credits: 150,
    description: 'For solo recruiters',
    features: [
      '150 AI credits per month',
      'CV parsing & cold emails',
      'Pitch generation',
      'Candidate screening',
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    priceCents: 6900,
    priceLabel: '€69/mo',
    credits: 500,
    description: 'For small teams',
    features: [
      '500 AI credits per month',
      'Everything in Starter',
      'Candidate sourcing & matching',
      'Vacancy matching',
    ],
  },
  {
    id: 'agency',
    label: 'Agency',
    priceCents: 9900,
    priceLabel: '€99/mo',
    credits: 1500,
    description: 'For growing agencies',
    features: [
      '1,500 AI credits per month',
      'Everything in Pro',
      'Signal enrichment',
      'Priority support',
    ],
  },
];

export function getTier(id: string | null | undefined): Tier {
  return TIERS.find(t => t.id === id) ?? TIERS[0];
}

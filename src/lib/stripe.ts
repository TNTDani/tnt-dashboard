// src/lib/stripe.ts
// Stripe client + credit pack definitions.
// Pack prices are in euro cents (Stripe uses the smallest currency unit).

import Stripe from 'stripe';

let _stripe: Stripe | undefined;

/** Returns a lazily-initialised Stripe client. Safe to import at build time. */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  /** Price in euro cents. */
  priceCents: number;
  /** Human-readable price string. */
  priceLabel: string;
  description: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_s',
    label: 'Starter',
    credits: 500,
    priceCents: 3900,
    priceLabel: '€39',
    description: '~500 CV parses or 166 cold emails',
  },
  {
    id: 'pack_m',
    label: 'Growth',
    credits: 2000,
    priceCents: 12900,
    priceLabel: '€129',
    description: 'Best value — ~2000 CV parses or 666 cold emails',
  },
  {
    id: 'pack_l',
    label: 'Scale',
    credits: 5000,
    priceCents: 27900,
    priceLabel: '€279',
    description: '~5000 CV parses or 1666 cold emails',
  },
];

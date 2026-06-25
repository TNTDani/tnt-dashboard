// POST /api/stripe/subscribe
// Creates a Stripe Checkout session for a monthly subscription tier.

import { NextRequest, NextResponse } from 'next/server';
import { requireCaller } from '@/lib/apiAuth';
import { getStripe } from '@/lib/stripe';
import { TIERS } from '@/lib/tiers';

export async function POST(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { planId } = await req.json();
  const tier = TIERS.find(t => t.id === planId && t.priceCents > 0);
  if (!tier) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });

  const origin = req.headers.get('origin') ?? 'https://app.orchard.works';

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: { name: `Orchard ${tier.label}` },
            unit_amount: tier.priceCents,
            recurring: { interval: 'month' },
          },
        },
      ],
      metadata: {
        agencyId: auth.caller.agencyId,
        plan: tier.id,
        credits: String(tier.credits),
      },
      success_url: `${origin}/credits?success=1`,
      cancel_url: `${origin}/credits?cancelled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/stripe/subscribe]', err);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}

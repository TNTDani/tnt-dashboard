// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for a credit pack purchase.
// Returns { url } to redirect the browser to Stripe's hosted checkout.

import { NextRequest, NextResponse } from 'next/server';
import { requireCaller } from '@/lib/apiAuth';
import { stripe, CREDIT_PACKS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agencyId } = auth.caller;

  const { packId } = await req.json();
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return NextResponse.json({ error: 'Unknown pack' }, { status: 400 });

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: pack.priceCents,
          product_data: {
            name: `Orchard Credits — ${pack.label} (${pack.credits.toLocaleString()} credits)`,
            description: pack.description,
          },
        },
      },
    ],
    metadata: {
      agencyId,
      packId: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${origin}/credits?success=1&pack=${pack.id}`,
    cancel_url: `${origin}/credits?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}

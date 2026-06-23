// POST /api/stripe/webhook
// Handles Stripe webhook events. Verifies the signature, then credits the agency
// balance when a checkout.session.completed event arrives.
//
// In Stripe dashboard, set the webhook endpoint to:
//   https://<your-domain>/api/stripe/webhook
// and subscribe to: checkout.session.completed

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { addCredits } from '@/lib/credits';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { agencyId, credits, packId } = session.metadata ?? {};

    if (!agencyId || !credits) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const creditAmount = parseInt(credits, 10);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return NextResponse.json({ error: 'Invalid credits value' }, { status: 400 });
    }

    await addCredits(agencyId, creditAmount);

    // Log the purchase for audit trail (negative cost = incoming revenue)
    await supabaseAdmin.from('ai_usage').insert({
      agency_id: agencyId,
      user_email: session.customer_email ?? 'stripe',
      feature: 'credit_purchase',
      model: null,
      input_tokens: 0,
      output_tokens: 0,
      web_searches: 0,
      credits: -creditAmount,
      cost_usd: -(session.amount_total ?? 0) / 100,
    });
  }

  return NextResponse.json({ received: true });
}

// POST /api/stripe/webhook
// Handles Stripe webhook events. Verifies the signature, then credits the agency
// balance when a checkout.session.completed event arrives.
//
// In Stripe dashboard, set the webhook endpoint to:
//   https://<your-domain>/api/stripe/webhook
// and subscribe to: checkout.session.completed

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { addCredits } from '@/lib/credits';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
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

    // If this is a subscription checkout (has plan in metadata), update the agency plan.
    if (session.metadata?.plan) {
      await supabaseAdmin.from('agencies').update({ plan: session.metadata.plan }).eq('id', agencyId);
    }

    // Log the purchase for audit trail (negative cost = incoming revenue)
    await supabaseAdmin.from('ai_usage').insert({
      agency_id: agencyId,
      user_email: session.customer_email ?? 'stripe',
      feature: packId ? 'credit_purchase' : 'subscription_purchase',
      model: null,
      input_tokens: 0,
      output_tokens: 0,
      web_searches: 0,
      credits: -creditAmount,
      cost_usd: -(session.amount_total ?? 0) / 100,
    });
  }

  // Handle recurring subscription billing — top up credits each billing cycle.
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as {
      billing_reason?: string;
      subscription?: string;
      customer_email?: string | null;
      amount_paid?: number;
      subscription_details?: { metadata?: Record<string, string> };
    };

    // Only handle renewal cycles, not the initial checkout (which fires checkout.session.completed).
    if (invoice.billing_reason !== 'subscription_cycle') {
      return NextResponse.json({ received: true });
    }

    const meta = invoice.subscription_details?.metadata ?? {};
    const { agencyId, credits, plan } = meta;

    if (!agencyId || !credits) {
      return NextResponse.json({ received: true });
    }

    const creditAmount = parseInt(credits, 10);
    if (!isNaN(creditAmount) && creditAmount > 0) {
      await addCredits(agencyId, creditAmount);

      if (plan) {
        await supabaseAdmin.from('agencies').update({ plan }).eq('id', agencyId);
      }

      await supabaseAdmin.from('ai_usage').insert({
        agency_id: agencyId,
        user_email: invoice.customer_email ?? 'stripe',
        feature: 'subscription_renewal',
        model: null,
        input_tokens: 0,
        output_tokens: 0,
        web_searches: 0,
        credits: -creditAmount,
        cost_usd: -(invoice.amount_paid ?? 0) / 100,
      });
    }
  }

  return NextResponse.json({ received: true });
}

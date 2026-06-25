'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap, CheckCircle, XCircle, Loader2, Check } from 'lucide-react';
import { C } from '@/lib/ui';
import { CREDIT_PACKS } from '@/lib/stripe';
import { PLANS } from '@/lib/plans';
import type { PlanId } from '@/lib/plans';
import type { BalanceDetail } from '@/lib/credits';
import { TIERS } from '@/lib/tiers';

export default function CreditsPage() {
  return (
    <Suspense>
      <CreditsContent />
    </Suspense>
  );
}

function CreditsContent() {
  const searchParams = useSearchParams();
  const success   = searchParams.get('success')   === '1';
  const cancelled = searchParams.get('cancelled') === '1';

  const [detail, setDetail]           = useState<BalanceDetail | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then((d: BalanceDetail) => setDetail(d))
      .catch(() => setDetail({ allowance: 0, purchased: 0, cap: 0, total: 0, unlimited: false, plan: 'free' }));
  }, [success]);

  async function buyPack(packId: string) {
    setLoadingPack(packId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      window.location.href = url;
    } finally {
      setLoadingPack(null);
    }
  }

  async function subscribe(planId: string) {
    setSubscribing(planId);
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      window.location.href = url;
    } finally {
      setSubscribing(null);
    }
  }

  const unlimited  = detail?.unlimited ?? false;
  const total      = detail?.total ?? null;
  const allowance  = detail?.allowance ?? 0;
  const purchased  = detail?.purchased ?? 0;
  const cap        = detail?.cap ?? 0;
  const currentPlan = (detail?.plan ?? 'free') as PlanId | 'free';

  const paidTiers = TIERS.filter(t => t.priceCents > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>Credits &amp; Plan</h1>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>
          Manage your subscription and AI credit balance.
        </p>
      </div>

      {/* Flash messages */}
      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#16a34a' }}>
          <CheckCircle size={16} className="flex-shrink-0" />
          Payment received — your credits have been added to your balance.
        </div>
      )}
      {cancelled && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626' }}>
          <XCircle size={16} className="flex-shrink-0" />
          Payment was cancelled — no charges made.
        </div>
      )}

      {/* Balance card */}
      <div className="mb-8 rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
              Current balance
            </p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tabular-nums" style={{ color: C.primary }}>
                {detail === null ? '—' : unlimited ? '∞' : total!.toLocaleString()}
              </span>
              <span className="mb-1 text-sm" style={{ color: C.muted }}>credits</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
              Plan
            </p>
            <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: 'rgba(45,74,45,0.12)', color: '#2D4A2D' }}>
              {PLANS[currentPlan as PlanId]?.label ?? 'Free'}
            </span>
          </div>
        </div>

        {/* Bucket breakdown */}
        {!unlimited && detail !== null && (
          <div className="mt-4 pt-4 flex gap-6 flex-wrap"
            style={{ borderTop: `1px solid ${C.border}` }}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
                Allowance
              </p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: C.primary }}>
                {allowance.toLocaleString()}
                {cap > 0 && (
                  <span className="font-normal text-xs ml-1" style={{ color: C.muted }}>
                    / {cap.toLocaleString()} cap
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
                Purchased
              </p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: C.primary }}>
                {purchased.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Subscription tiers */}
      {!unlimited && (
        <>
          <h2 className="text-base font-semibold mb-4" style={{ color: C.primary }}>Monthly plans</h2>
          <div className="grid gap-4 sm:grid-cols-3 mb-10">
            {paidTiers.map(tier => {
              const planMeta   = PLANS[tier.id as PlanId];
              const isCurrent  = tier.id === currentPlan;
              return (
                <div key={tier.id}
                  className="rounded-2xl p-5 flex flex-col gap-3"
                  style={{
                    background: isCurrent ? 'rgba(45,74,45,0.04)' : C.surface,
                    border:     isCurrent ? '1.5px solid #2D4A2D' : `1px solid ${C.border}`,
                  }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm" style={{ color: C.primary }}>{tier.label}</p>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#2D4A2D', color: '#fff' }}>
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold" style={{ color: C.primary }}>
                      €{planMeta.priceEur}<span className="text-sm font-normal" style={{ color: C.muted }}>/mo</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {planMeta.creditCap.toLocaleString()} credits/mo · up to {planMeta.seats === 999 ? 'unlimited' : planMeta.seats} seats
                    </p>
                  </div>

                  <ul className="flex flex-col gap-1.5 flex-1">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: C.muted }}>
                        <Check size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#2D4A2D' }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-1">
                    <button
                      onClick={() => subscribe(tier.id)}
                      disabled={isCurrent || subscribing !== null}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: isCurrent ? 'rgba(45,74,45,0.12)' : '#2D4A2D',
                        color:      isCurrent ? '#2D4A2D'             : '#fff',
                      }}>
                      {subscribing === tier.id
                        ? <><Loader2 size={13} className="animate-spin" /> Redirecting…</>
                        : isCurrent ? 'Active plan' : 'Subscribe'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Top-up packs / unlimited notice */}
      {unlimited ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-sm font-medium" style={{ color: C.muted }}>
            Your account has unlimited credits — no purchase needed.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-base font-semibold mb-4" style={{ color: C.primary }}>Top-up packs</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CREDIT_PACKS.map(pack => (
              <div key={pack.id}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div>
                  <p className="font-semibold" style={{ color: C.primary }}>{pack.label}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: C.primary }}>
                    {pack.credits.toLocaleString()}
                    <span className="text-sm font-normal ml-1" style={{ color: C.muted }}>credits</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{pack.description}</p>
                </div>
                <div className="mt-auto">
                  <p className="text-lg font-semibold mb-2" style={{ color: C.primary }}>{pack.priceLabel}</p>
                  <button
                    onClick={() => buyPack(pack.id)}
                    disabled={loadingPack !== null}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition-opacity"
                    style={{ background: C.primary }}>
                    {loadingPack === pack.id
                      ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                      : <><Zap size={14} /> Buy {pack.label}</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-center" style={{ color: C.faint }}>
            Payments processed by Stripe. Purchased credits are added instantly and never expire.
            Monthly allowance refills to your plan cap each billing cycle.
          </p>
        </>
      )}
    </div>
  );
}

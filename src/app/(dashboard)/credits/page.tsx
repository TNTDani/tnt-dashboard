'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { C } from '@/lib/ui';
import { CREDIT_PACKS } from '@/lib/stripe';

export default function CreditsPage() {
  return (
    <Suspense>
      <CreditsContent />
    </Suspense>
  );
}

function CreditsContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === '1';
  const cancelled = searchParams.get('cancelled') === '1';

  const [balance, setBalance] = useState<number | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/credits/balance')
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0));
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

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>Credits</h1>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>
          Buy AI credits to use features like CV parsing, cold emails, and candidate sourcing.
        </p>
      </div>

      {/* Flash messages */}
      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#16a34a' }}>
          <CheckCircle size={16} className="flex-shrink-0" />
          Payment received — your credits have been added to your balance.
        </div>
      )}
      {cancelled && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626' }}>
          <XCircle size={16} className="flex-shrink-0" />
          Payment was cancelled — no charges made.
        </div>
      )}

      {/* Balance chip */}
      <div className="mb-8 rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: C.muted }}>Current balance</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold tabular-nums" style={{ color: C.primary }}>
            {balance === null ? '—' : balance.toLocaleString()}
          </span>
          <span className="mb-1 text-sm" style={{ color: C.muted }}>credits</span>
        </div>
      </div>

      {/* Packs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
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
                style={{ background: C.primary }}
              >
                {loadingPack === pack.id ? (
                  <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                ) : (
                  <><Zap size={14} /> Buy {pack.label}</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: C.faint }}>
        Payments are processed by Stripe. Credits are added instantly after payment confirmation.
      </p>
    </div>
  );
}

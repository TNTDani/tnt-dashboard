// src/components/Dialer.tsx
// Docked dialer bottom-right (SalesLoft-style). Clicking a lead loads their number.
// Actual calling is not wired yet; see DIALER_HOWTO.md for the Twilio integration.

'use client';

import { useState } from 'react';
import { Phone, PhoneOff, X, Delete, ChevronDown } from 'lucide-react';
import { C } from '@/lib/ui';
import { useDialer } from '@/lib/dialer-context';
import { useT } from '@/lib/i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function Dialer() {
  const t = useT();
  const { number, leadName, open, setNumber, setOpen, clear } = useDialer();
  const [inCall, setInCall] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: C.primary }}
        aria-label={t('Open dialer', 'Open dialer')}
      >
        <Phone size={20} />
      </button>
    );
  }

  function press(k: string) {
    setNumber((number + k).slice(0, 20));
  }

  function startCall() {
    if (!number) return;
    // TODO: replace with Twilio Voice (see DIALER_HOWTO.md). UI state only for now.
    setInCall(true);
  }

  function endCall() {
    setInCall(false);
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-40 w-72 overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: C.primary }}>
        <span className="text-sm font-medium text-white">{inCall ? t('On call', 'In gesprek') : t('Dialer', 'Dialer')}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label={t('Minimise', 'Minimaliseer')}>
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {leadName && (
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs" style={{ color: C.muted }}>
              {leadName}
            </span>
            <button onClick={clear} className="text-xs" style={{ color: C.muted }} aria-label={t('Clear', 'Wissen')}>
              <X size={12} className="inline" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d+*#]/g, '').slice(0, 20))}
            placeholder={t('Number', 'Nummer')}
            className="w-full rounded-lg px-3 py-2 text-center text-lg tracking-wide outline-none"
            style={{ border: `1px solid ${C.border}`, color: C.primary }}
          />
          <button onClick={() => setNumber(number.slice(0, -1))} style={{ color: C.muted }} aria-label={t('Backspace', 'Backspace')}>
            <Delete size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="rounded-lg py-2.5 text-lg font-medium transition"
              style={{ background: C.bg, color: C.primary }}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {inCall ? (
            <button
              onClick={endCall}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white"
              style={{ background: '#C0392B' }}
            >
              <PhoneOff size={18} /> {t('Hang up', 'Ophangen')}
            </button>
          ) : (
            <button
              onClick={startCall}
              disabled={!number}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white disabled:opacity-40"
              style={{ background: C.primary }}
            >
              <Phone size={18} /> {t('Call', 'Bellen')}
            </button>
          )}
        </div>

        {inCall && (
          <p className="mt-2 text-center text-xs" style={{ color: C.muted }}>
            {t('Calling is not connected yet, see DIALER_HOWTO.md', 'Bellen is nog niet gekoppeld, zie DIALER_HOWTO.md')}
          </p>
        )}
      </div>
    </div>
  );
}

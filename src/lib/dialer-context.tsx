// src/lib/dialer-context.tsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface DialerState {
  number: string;
  leadName: string | null;
  open: boolean;
  setNumber: (n: string) => void;
  loadLead: (name: string, phone?: string) => void;
  setOpen: (o: boolean) => void;
  clear: () => void;
}

const DialerContext = createContext<DialerState | null>(null);

export function DialerProvider({ children }: { children: React.ReactNode }) {
  const [number, setNumber] = useState('');
  const [leadName, setLeadName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Wordt aangeroepen als je op een lead klikt: laadt het nummer (indien bekend) en opent de dialer.
  const loadLead = useCallback((name: string, phone?: string) => {
    setLeadName(name);
    setNumber(phone ?? '');
    setOpen(true);
  }, []);

  const clear = useCallback(() => {
    setNumber('');
    setLeadName(null);
  }, []);

  return (
    <DialerContext.Provider value={{ number, leadName, open, setNumber, loadLead, setOpen, clear }}>
      {children}
    </DialerContext.Provider>
  );
}

export function useDialer() {
  const ctx = useContext(DialerContext);
  if (!ctx) throw new Error('useDialer must be used within DialerProvider');
  return ctx;
}

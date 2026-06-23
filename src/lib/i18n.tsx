// src/lib/i18n.tsx
// Lichtgewicht i18n. UI strings via t(en, nl): Engels is de standaard, de vlag
// rechtsboven zet alles om naar Nederlands. Voorkeur wordt onthouden per browser.
// Nieuwe surfaces wrappen = zelfde patroon: t('English', 'Nederlands').

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Locale = 'en' | 'nl';

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (en: string, nl: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orchard_locale') as Locale | null;
      if (saved === 'en' || saved === 'nl') setLocaleState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('orchard_locale', l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((en: string, nl: string) => (locale === 'nl' ? nl : en), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) return { locale: 'en', setLocale: () => {}, t: (en) => en };
  return ctx;
}

/** Convenience: const t = useT(); t('Save', 'Opslaan') */
export function useT() {
  return useI18n().t;
}

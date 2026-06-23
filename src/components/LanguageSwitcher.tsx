// src/components/LanguageSwitcher.tsx
// Vlag-schakelaar rechtsboven. EN/NL. Onthoudt de keuze.

'use client';

import { useI18n, type Locale } from '@/lib/i18n';

const OPTIONS: { code: Locale; flag: string; label: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-black/10 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          onClick={() => setLocale(o.code)}
          aria-label={o.label}
          title={o.label}
          className="rounded-md px-1.5 py-0.5 text-base leading-none transition"
          style={{
            background: locale === o.code ? 'rgba(45,74,45,0.10)' : 'transparent',
            opacity: locale === o.code ? 1 : 0.5,
          }}
        >
          {o.flag}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Copy, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import { useT } from '@/lib/i18n';
import { PITCH_LANGUAGES, suggestPitchLanguage } from '@/lib/pitchPrompt';
import type { Account, AccountLead, AgencyPositioning, GeneratedPitch } from '@/lib/accountTypes';

interface Props {
  account: Account;
  lead: AccountLead;
  positioning: AgencyPositioning;
  initialPitch?: GeneratedPitch | null;
}

export default function PitchPanel({ account, lead, positioning, initialPitch }: Props) {
  const t = useT();
  const [pitch, setPitch] = useState<GeneratedPitch | null>(initialPitch ?? null);
  const [loading, setLoading] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [language, setLanguage] = useState<string>(suggestPitchLanguage(account));

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positioning, account, lead, language }),
      });
      if (!res.ok) throw new Error((await res.json()).error || t('Generation failed', 'Genereren mislukt'));
      const generated: GeneratedPitch = await res.json();
      setPitch(generated);
      await accountsDb.savePitch(account.id, lead.id, generated);
      toast.success(t('Pitch generated', 'Pitch gegenereerd'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Something went wrong', 'Er ging iets mis'));
    } finally {
      setLoading(false);
    }
  }

  function copyRiedel() {
    if (!pitch) return;
    navigator.clipboard.writeText(pitch.riedel);
    toast.success(t('Riedel copied', 'Riedel gekopieerd'));
  }

  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: C.primary }}>
          {t('Cold call pitch', 'Cold call pitch')}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ border: `1px solid ${C.border}` }} title={t('Pitch language', 'Pitchtaal')}>
            <Globe size={13} style={{ color: C.muted }} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs outline-none"
              style={{ color: C.primary }}
            >
              {PITCH_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: C.primary }}
          >
            <Sparkles size={14} />
            {loading ? t('Working...', 'Bezig...') : pitch ? t('Regenerate', 'Opnieuw') : t('Generate pitch', 'Genereer pitch')}
          </button>
        </div>
      </div>

      {!pitch && (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>
          {t(`This pitch will be written in ${language}. Change the language above if needed.`,
             `Deze pitch wordt geschreven in ${language}. Pas de taal hierboven aan indien nodig.`)}
        </p>
      )}

      {pitch && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg p-3" style={{ background: C.bg }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: C.muted }}>
                {t('Riedel (spoken)', 'Riedel (gesproken)')}
              </span>
              <button onClick={copyRiedel} className="text-xs" style={{ color: C.primary }}>
                <Copy size={13} className="inline" /> {t('copy', 'kopieer')}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: C.primary }}>
              {pitch.riedel}
            </p>
          </div>

          <button
            onClick={() => setShowFull((v) => !v)}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: C.muted }}
          >
            {showFull ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showFull ? t('Hide structure', 'Verberg structuur') : t('Show full structure', 'Toon volledige structuur')}
          </button>

          {showFull && <FullStructure pitch={pitch} />}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        {title}
      </h5>
      <div className="text-sm leading-relaxed" style={{ color: C.primary }}>
        {children}
      </div>
    </div>
  );
}

function FullStructure({ pitch }: { pitch: GeneratedPitch }) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-lg p-3" style={{ background: C.bg }}>
      <Section title={t('Analysis', 'Analyse')}>
        <ul className="space-y-0.5">
          <li>{t('Company type', 'Bedrijfstype')}: {pitch.analysis.companyType}</li>
          <li>{t('Signal', 'Signaal')}: {pitch.analysis.signal}</li>
          <li>{t('Persona', 'Persona')}: {pitch.analysis.persona}</li>
          <li>{t('Primary pain', 'Hoofdpijn')}: {pitch.analysis.chosenPain}</li>
          <li>{t('Reference', 'Referentie')}: {pitch.analysis.reference}</li>
          <li>{t('Reframe lands at', 'Reframe landt bij')}: {pitch.analysis.reframeLandsAt}</li>
        </ul>
      </Section>
      <Section title={t('Summary', 'Samenvatting')}>{pitch.summaryLine}</Section>
      <Section title={t('Opener', 'Opener')}>{pitch.opener}</Section>
      <Section title={t('Hook', 'Hook')}>{pitch.hook}</Section>
      <Section title={t('On yes', 'Bij ja')}>{pitch.branches.yes}</Section>
      <Section title={t('Somewhat in order', 'Redelijk op orde')}>{pitch.branches.somewhatOk}</Section>
      <Section title={t('On no', 'Bij nee')}>{pitch.branches.no}</Section>
      <Section title={t('SPICED funnel', 'SPICED-trechter')}>
        <ol className="list-decimal space-y-1 pl-4">
          {pitch.spicedFunnel.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{s.beat}:</span> {s.question}
            </li>
          ))}
        </ol>
      </Section>
      <Section title={t('Final challenge', 'Laatste challenge')}>{pitch.finalChallenge}</Section>
      <Section title={t('Close', 'Afsluiting')}>{pitch.close}</Section>
      <Section title={t('Other pains', 'Andere pijnen')}>
        <ul className="space-y-1">
          {pitch.alternativePains.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.pain}</span>: {p.solution}{' '}
              <span style={{ color: C.muted }}>({p.reference})</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('Handoff checklist', 'Handoff-checklist')}>
        <ul className="list-disc pl-4">
          {pitch.handoffChecklist.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </Section>
      <Section title={t('Strategic notes', 'Strategische punten')}>
        <ul className="list-disc pl-4">
          {pitch.strategicNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

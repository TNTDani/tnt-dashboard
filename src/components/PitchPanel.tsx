// src/components/PitchPanel.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import type { Account, AccountLead, AgencyPositioning, GeneratedPitch } from '@/lib/accountTypes';

interface Props {
  account: Account;
  lead: AccountLead;
  positioning: AgencyPositioning;
  initialPitch?: GeneratedPitch | null;
}

export default function PitchPanel({ account, lead, positioning, initialPitch }: Props) {
  const [pitch, setPitch] = useState<GeneratedPitch | null>(initialPitch ?? null);
  const [loading, setLoading] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positioning, account, lead }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Genereren mislukt');
      const generated: GeneratedPitch = await res.json();
      setPitch(generated);
      await accountsDb.savePitch(account.id, lead.id, generated);
      toast.success('Pitch gegenereerd');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  }

  function copyRiedel() {
    if (!pitch) return;
    navigator.clipboard.writeText(pitch.riedel);
    toast.success('Riedel gekopieerd');
  }

  return (
    <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: C.primary }}>
          Cold call pitch
        </span>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: C.primary }}
        >
          <Sparkles size={14} />
          {loading ? 'Bezig...' : pitch ? 'Opnieuw' : 'Genereer pitch'}
        </button>
      </div>

      {pitch && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg p-3" style={{ background: C.bg }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: C.muted }}>
                Riedel (gesproken)
              </span>
              <button onClick={copyRiedel} className="text-xs" style={{ color: C.primary }}>
                <Copy size={13} className="inline" /> kopieer
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
            {showFull ? 'Verberg structuur' : 'Toon volledige structuur'}
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
  return (
    <div className="space-y-3 rounded-lg p-3" style={{ background: C.bg }}>
      <Section title="Analyse">
        <ul className="space-y-0.5">
          <li>Bedrijfstype: {pitch.analysis.companyType}</li>
          <li>Signaal: {pitch.analysis.signal}</li>
          <li>Persona: {pitch.analysis.persona}</li>
          <li>Hoofdpijn: {pitch.analysis.chosenPain}</li>
          <li>Referentie: {pitch.analysis.reference}</li>
          <li>Reframe landt bij: {pitch.analysis.reframeLandsAt}</li>
        </ul>
      </Section>
      <Section title="Samenvatting">{pitch.summaryLine}</Section>
      <Section title="Opener">{pitch.opener}</Section>
      <Section title="Hook">{pitch.hook}</Section>
      <Section title="Bij ja">{pitch.branches.yes}</Section>
      <Section title="Redelijk op orde">{pitch.branches.somewhatOk}</Section>
      <Section title="Bij nee">{pitch.branches.no}</Section>
      <Section title="SPICED-trechter">
        <ol className="list-decimal space-y-1 pl-4">
          {pitch.spicedFunnel.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{s.beat}:</span> {s.question}
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Laatste challenge">{pitch.finalChallenge}</Section>
      <Section title="Afsluiting">{pitch.close}</Section>
      <Section title="Andere pijnen">
        <ul className="space-y-1">
          {pitch.alternativePains.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.pain}</span>: {p.solution}{' '}
              <span style={{ color: C.muted }}>({p.reference})</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Handoff-checklist">
        <ul className="list-disc pl-4">
          {pitch.handoffChecklist.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </Section>
      <Section title="Strategische punten">
        <ul className="list-disc pl-4">
          {pitch.strategicNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

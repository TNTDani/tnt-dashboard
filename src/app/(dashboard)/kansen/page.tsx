'use client';

// /kansen — Opportunities start screen.
// Card #1: Omzet-pipeline (RevenuePipelineCard).
// Card #2: Klantwaarde / Client value (ClientValueCard).
// Cards #3–5: see ORCHARD_OPPORTUNITIES_backlog.md.

import RevenuePipelineCard from '@/components/RevenuePipelineCard';
import ClientValueCard from '@/components/ClientValueCard';
import { useT } from '@/lib/i18n';

export default function KansenPage() {
  const t = useT();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#2D4A2D]">
          {t('Opportunities', 'Kansen')}
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-0.5">
          {t('What is in your pipeline right now?', 'Wat zit er nu in je pipeline?')}
        </p>
      </div>

      {/* Card 1 — Revenue pipeline (constrain to readable width) */}
      <div className="max-w-2xl">
        <RevenuePipelineCard />
      </div>

      {/* Card 2 — Client value scorecard */}
      <ClientValueCard />

      {/* Cards 3–5 will be added here */}
    </div>
  );
}

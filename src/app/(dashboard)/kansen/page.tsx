'use client';

// /kansen — Opportunities start screen.
// Card #1: Omzet-pipeline (RevenuePipelineCard).
// Cards #2–5 and the five-question home: see ORCHARD_OPPORTUNITIES_backlog.md.

import RevenuePipelineCard from '@/components/RevenuePipelineCard';
import { useT } from '@/lib/i18n';

export default function KansenPage() {
  const t = useT();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#2D4A2D]">
          {t('Opportunities', 'Kansen')}
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-0.5">
          {t('What is in your pipeline right now?', 'Wat zit er nu in je pipeline?')}
        </p>
      </div>

      {/* Card 1 — Revenue pipeline */}
      <RevenuePipelineCard />

      {/* Cards 2–5 will be added here */}
    </div>
  );
}

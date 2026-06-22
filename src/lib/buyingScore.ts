// src/lib/buyingScore.ts
// Deterministische score (0-100) die inschat hoe groot de kans is dat een bedrijf
// de diensten van het bureau zou afnemen, op basis van de verzamelde signalen.
// Voor een recruitmentbureau is hiring-druk het sterkste koopsignaal.

import type { Signal, SignalType } from './accountTypes';

const WEIGHTS: Record<SignalType, number> = {
  open_role: 22, // sterkste signaal; meerdere open rollen stapelen
  expansion: 16,
  funding: 15,
  leadership_change: 12, // nieuwe exec = nieuwe prioriteiten en aannames
  acquisition: 10,
  competitor: 8,
  other: 4,
};

export interface BuyingScore {
  score: number; // 0-100
  label: 'Hoog' | 'Gemiddeld' | 'Laag' | 'Geen signaal';
  factors: { label: string; points: number }[];
}

export function computeBuyingScore(signals: Signal[] = []): BuyingScore {
  if (!signals.length) {
    return { score: 0, label: 'Geen signaal', factors: [] };
  }

  const factors = signals.map((s) => ({
    label: `${s.type.replace('_', ' ')}: ${s.summary.slice(0, 50)}`,
    points: WEIGHTS[s.type] ?? WEIGHTS.other,
  }));

  const score = Math.min(
    100,
    factors.reduce((sum, f) => sum + f.points, 0),
  );

  const label: BuyingScore['label'] = score >= 65 ? 'Hoog' : score >= 35 ? 'Gemiddeld' : 'Laag';

  return { score, label, factors };
}

export function scoreColor(label: BuyingScore['label']): string {
  switch (label) {
    case 'Hoog':
      return '#1B7A3D';
    case 'Gemiddeld':
      return '#B7791F';
    case 'Laag':
      return '#9A6B3F';
    default:
      return '#6B7280';
  }
}

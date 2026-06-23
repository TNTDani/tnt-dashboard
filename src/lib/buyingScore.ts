// src/lib/buyingScore.ts
// Deterministic 0-100 score estimating how likely a company is to buy the agency's
// services, based on the collected signals. For a recruitment agency, hiring pressure
// is the strongest buying signal. Label is a neutral key; the UI translates it.

import type { Signal, SignalType } from './accountTypes';

const WEIGHTS: Record<SignalType, number> = {
  open_role: 22,
  expansion: 16,
  funding: 15,
  leadership_change: 12,
  acquisition: 10,
  competitor: 8,
  other: 4,
};

export type ScoreLabel = 'high' | 'medium' | 'low' | 'none';

export interface BuyingScore {
  score: number; // 0-100
  label: ScoreLabel;
  factors: { label: string; points: number }[];
}

export function computeBuyingScore(signals: Signal[] = []): BuyingScore {
  if (!signals.length) return { score: 0, label: 'none', factors: [] };

  const factors = signals.map((s) => ({
    label: `${s.type.replace('_', ' ')}: ${s.summary.slice(0, 50)}`,
    points: WEIGHTS[s.type] ?? WEIGHTS.other,
  }));

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  const label: ScoreLabel = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, label, factors };
}

export function scoreColor(label: ScoreLabel): string {
  switch (label) {
    case 'high':
      return '#1B7A3D';
    case 'medium':
      return '#B7791F';
    case 'low':
      return '#9A6B3F';
    default:
      return '#6B7280';
  }
}

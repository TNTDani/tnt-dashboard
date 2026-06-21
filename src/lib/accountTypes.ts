// src/lib/accountTypes.ts
// Domeintypes voor de BD/pitch-laag. CamelCase in TS, snake_case in Supabase
// (zie accountsDb.ts voor de mapping), net als bij Client in types.ts.

export type SignalType =
  | 'open_role'
  | 'funding'
  | 'acquisition'
  | 'leadership_change'
  | 'expansion'
  | 'competitor'
  | 'other';

export interface Signal {
  type: SignalType;
  summary: string;
  source?: string;
  date?: string;
}

export interface ProofPoint {
  /** "soortgelijk SaaS-bedrijf, 120 fte" of een echte klantnaam als die genoemd mag worden */
  label: string;
  result: string;
  /** false = naam NIET noemen, val terug op "soortgelijke bedrijven" */
  named: boolean;
}

export interface AgencyPositioning {
  agencyName: string;
  repName: string;
  niche: string;
  services: string[];
  differentiator: string;
  proofPoints: ProofPoint[];
  tone?: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  companyName: string;
  website?: string;
  sector?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  location?: string;
  linkedin?: string;
  description?: string;
  notes: string;
  signals: Signal[];
  enrichedAt?: string;
  /** gezet zodra dit account een Client wordt */
  convertedClientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadSeniority = 'C-level' | 'Director' | 'Manager' | 'Lead' | 'Other';

export interface AccountLead {
  id: string;
  accountId: string;
  name: string;
  role: string;
  seniority?: LeadSeniority;
  linkedin?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface GeneratedPitch {
  analysis: {
    companyType: string;
    signal: string;
    persona: string;
    chosenPain: string;
    reference: string;
    reframeLandsAt: string;
  };
  summaryLine: string;
  opener: string;
  hook: string;
  branches: { yes: string; somewhatOk: string; no: string };
  spicedFunnel: { beat: string; question: string }[];
  finalChallenge: string;
  close: string;
  alternativePains: { pain: string; solution: string; reference: string }[];
  handoffChecklist: string[];
  strategicNotes: string[];
  riedel: string;
}

export interface PitchRecord extends GeneratedPitch {
  id: string;
  accountId: string;
  leadId: string;
  methodologyVersion: string;
  createdAt: string;
}

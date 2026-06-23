// src/lib/accountTypes.ts

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

export interface SuggestedPerson {
  name: string;
  role: string;
  source?: string;
  linkedin?: string;
}

export interface ProofPoint {
  label: string;
  result: string;
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

export type AccountStage = 'new' | 'contacted' | 'engaged' | 'meeting' | 'won' | 'lost' | 'client' | 'dormant';

/** True when an account represents an active/former client.
 *  Purely stage-based so changing the stage to a prospect stage moves it back.
 *  'won' is a legacy alias kept for backward compat with existing rows. */
export function isClient(account: { stage?: AccountStage }): boolean {
  return account.stage === 'client' || account.stage === 'won' || account.stage === 'dormant';
}

export type ActivityType = 'call' | 'email' | 'linkedin' | 'meeting' | 'note';

export type ActivityOutcome =
  | 'no_answer'
  | 'voicemail'
  | 'gatekeeper'
  | 'callback'
  | 'meeting_booked'
  | 'not_interested'
  | 'note';

export interface Activity {
  id: string;
  accountId: string;
  leadId?: string;
  type: ActivityType;
  outcome: ActivityOutcome;
  note?: string;
  nextStepDate?: string;
  createdAt: string;
  createdBy?: string;
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
  stage?: AccountStage;
  signals: Signal[];
  keyPeople: SuggestedPerson[];
  enrichedAt?: string;
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

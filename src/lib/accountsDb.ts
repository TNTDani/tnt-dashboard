// src/lib/accountsDb.ts

import { supabase } from './supabase';
import { requireAgencyId } from './db';
import { v4 as uuidv4 } from 'uuid';
import { logEvent } from './timeline';
import type {
  Account,
  AccountLead,
  AgencyPositioning,
  GeneratedPitch,
  PitchRecord,
  Activity,
} from './accountTypes';
import { METHODOLOGY_VERSION } from './pitchPrompt';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Accounts ─────────────────────────────────────────────────────────────────
function rowToAccount(r: any): Account {
  return {
    id: r.id,
    companyName: r.company_name,
    website: r.website ?? undefined,
    sector: r.sector ?? undefined,
    size: r.size ?? undefined,
    location: r.location ?? undefined,
    linkedin: r.linkedin ?? undefined,
    description: r.description ?? undefined,
    notes: r.notes ?? '',
    stage: r.stage ?? 'new',
    signals: r.signals ?? [],
    keyPeople: r.key_people ?? [],
    enrichedAt: r.enriched_at ?? undefined,
    niche: r.niche ?? undefined,
    phone: r.phone ?? undefined,
    founder: r.founder ?? undefined,
    source: r.source ?? undefined,
    feeAgreement: r.fee_agreement ?? undefined,
    convertedClientId: r.converted_client_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function accountToRow(a: Partial<Account>) {
  const row: Record<string, unknown> = { agency_id: requireAgencyId() };
  if (a.id !== undefined) row.id = a.id;
  if (a.companyName !== undefined) row.company_name = a.companyName;
  if (a.website !== undefined) row.website = a.website ?? null;
  if (a.sector !== undefined) row.sector = a.sector ?? null;
  if (a.size !== undefined) row.size = a.size ?? null;
  if (a.location !== undefined) row.location = a.location ?? null;
  if (a.linkedin !== undefined) row.linkedin = a.linkedin ?? null;
  if (a.description !== undefined) row.description = a.description ?? null;
  if (a.notes !== undefined) row.notes = a.notes;
  if (a.stage !== undefined) row.stage = a.stage;
  if (a.signals !== undefined) row.signals = a.signals;
  if (a.keyPeople !== undefined) row.key_people = a.keyPeople;
  if (a.enrichedAt !== undefined) row.enriched_at = a.enrichedAt ?? null;
  if (a.niche !== undefined) row.niche = a.niche ?? null;
  if (a.phone !== undefined) row.phone = a.phone ?? null;
  if (a.founder !== undefined) row.founder = a.founder ?? null;
  if (a.source !== undefined) row.source = a.source ?? null;
  if (a.feeAgreement !== undefined) row.fee_agreement = a.feeAgreement ?? null;
  if (a.convertedClientId !== undefined) row.converted_client_id = a.convertedClientId ?? null;
  return row;
}

function rowToLead(r: any): AccountLead {
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    role: r.role,
    seniority: r.seniority ?? undefined,
    linkedin: r.linkedin ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    createdAt: r.created_at,
  };
}

// ── Activities ────────────────────────────────────────────────────────────────
function rowToActivity(r: any): Activity {
  return {
    id: r.id,
    accountId: r.account_id,
    leadId: r.lead_id ?? undefined,
    type: r.type,
    outcome: r.outcome,
    note: r.note ?? undefined,
    nextStepDate: r.next_step_date ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by ?? undefined,
  };
}

export const accountsDb = {
  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToAccount);
  },

  getAccount: async (id: string): Promise<Account | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToAccount(data) : null;
  },

  addAccount: async (
    a: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'signals' | 'keyPeople' | 'notes'> &
      Partial<Pick<Account, 'signals' | 'keyPeople' | 'notes'>>,
  ): Promise<Account> => {
    const id = uuidv4();
    const { data, error } = await supabase
      .from('accounts')
      .insert(accountToRow({ ...a, id, notes: a.notes ?? '', signals: a.signals ?? [], keyPeople: a.keyPeople ?? [] }))
      .select('*')
      .single();
    if (error) throw error;
    return rowToAccount(data);
  },

  updateAccount: async (id: string, patch: Partial<Account>): Promise<void> => {
    const agencyId = requireAgencyId();
    const { error } = await supabase
      .from('accounts')
      .update({ ...accountToRow(patch), updated_at: new Date().toISOString() })
      .eq('agency_id', agencyId)
      .eq('id', id);
    if (error) throw error;
  },

  deleteAccount: async (id: string): Promise<void> => {
    const agencyId = requireAgencyId();
    const { error } = await supabase.from('accounts').delete().eq('agency_id', agencyId).eq('id', id);
    if (error) throw error;
  },

  // Leads
  getLeads: async (accountId: string): Promise<AccountLead[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_leads')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('account_id', accountId)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToLead);
  },

  addLead: async (lead: Omit<AccountLead, 'id' | 'createdAt'>): Promise<AccountLead> => {
    const { data, error } = await supabase
      .from('account_leads')
      .insert({
        id: uuidv4(),
        agency_id: requireAgencyId(),
        account_id: lead.accountId,
        name: lead.name,
        role: lead.role,
        seniority: lead.seniority ?? null,
        linkedin: lead.linkedin ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToLead(data);
  },

  deleteLead: async (id: string): Promise<void> => {
    const agencyId = requireAgencyId();
    const { error } = await supabase.from('account_leads').delete().eq('agency_id', agencyId).eq('id', id);
    if (error) throw error;
  },

  // Pitches
  getLatestPitch: async (leadId: string): Promise<PitchRecord | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_pitches')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...(data.content as GeneratedPitch),
      id: data.id,
      accountId: data.account_id,
      leadId: data.lead_id,
      methodologyVersion: data.methodology_version,
      createdAt: data.created_at,
    };
  },

  savePitch: async (accountId: string, leadId: string, pitch: GeneratedPitch): Promise<PitchRecord> => {
    const { data, error } = await supabase
      .from('account_pitches')
      .insert({
        id: uuidv4(),
        agency_id: requireAgencyId(),
        account_id: accountId,
        lead_id: leadId,
        content: pitch,
        methodology_version: METHODOLOGY_VERSION,
      })
      .select('*')
      .single();
    if (error) throw error;
    return {
      ...pitch,
      id: data.id,
      accountId,
      leadId,
      methodologyVersion: data.methodology_version,
      createdAt: data.created_at,
    };
  },

  // Activities
  getActivities: async (accountId: string): Promise<Activity[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_activities')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToActivity);
  },

  addActivity: async (a: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> => {
    const id = uuidv4();
    const { data, error } = await supabase
      .from('account_activities')
      .insert({
        id,
        agency_id: requireAgencyId(),
        account_id: a.accountId,
        lead_id: a.leadId ?? null,
        type: a.type,
        outcome: a.outcome,
        note: a.note ?? null,
        next_step_date: a.nextStepDate ?? null,
        created_by: a.createdBy ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    const activity = rowToActivity(data);
    // fire-and-forget timeline event
    logEvent({
      eventType: 'activity_logged',
      summary: `${a.type} — ${a.outcome}`,
      accountId: a.accountId,
      leadId: a.leadId,
      metadata: {
        activityId: id,
        activityType: a.type,
        outcome: a.outcome,
        note: a.note ?? '',
      },
      createdBy: a.createdBy,
    });
    return activity;
  },

  // Returns earliest pending next_step per account (next_step_date set)
  getActivitiesWithNextStep: async (): Promise<Record<string, Activity>> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_activities')
      .select('*')
      .eq('agency_id', agencyId)
      .not('next_step_date', 'is', null)
      .order('next_step_date', { ascending: true });
    if (error) throw error;
    const map: Record<string, Activity> = {};
    for (const row of data ?? []) {
      if (!map[row.account_id]) map[row.account_id] = rowToActivity(row);
    }
    return map;
  },

  // Positionering (1 per bureau)
  getPositioning: async (): Promise<AgencyPositioning | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('agency_positioning')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      agencyName: data.agency_name,
      repName: data.rep_name,
      niche: data.niche,
      services: data.services ?? [],
      differentiator: data.differentiator,
      proofPoints: data.proof_points ?? [],
      tone: data.tone ?? undefined,
      updatedAt: data.updated_at,
    };
  },

  savePositioning: async (p: AgencyPositioning): Promise<void> => {
    const { error } = await supabase.from('agency_positioning').upsert({
      agency_id: requireAgencyId(),
      agency_name: p.agencyName,
      rep_name: p.repName,
      niche: p.niche,
      services: p.services,
      differentiator: p.differentiator,
      proof_points: p.proofPoints,
      tone: p.tone ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  // ── Computed helpers (rely on migration_ats_relations.sql views) ───────────

  /** Revenue summary for one account from the account_revenue view. */
  getAccountRevenue: async (accountId: string): Promise<{
    placementCount: number;
    totalFees: number;
    collectedFees: number;
    invoicedFees: number;
    draftFees: number;
  } | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_revenue')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      placementCount: data.placement_count ?? 0,
      totalFees:      data.total_fees     ?? 0,
      collectedFees:  data.collected_fees ?? 0,
      invoicedFees:   data.invoiced_fees  ?? 0,
      draftFees:      data.draft_fees     ?? 0,
    };
  },

  /** Vacancy counts for one account from the account_vacancy_counts view. */
  getAccountVacancyCounts: async (accountId: string): Promise<{
    totalVacancies: number;
    openVacancies: number;
    placedVacancies: number;
  } | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('account_vacancy_counts')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      totalVacancies:  data.total_vacancies  ?? 0,
      openVacancies:   data.open_vacancies   ?? 0,
      placedVacancies: data.placed_vacancies ?? 0,
    };
  },

  /** Current employer for a candidate: most recent placement's company. */
  getCurrentEmployer: async (candidateProfileId: string): Promise<{
    company: string;
    jobTitle: string;
    placementDate: string;
    accountId?: string;
  } | null> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('placements')
      .select('company, job_title, placement_date, account_id')
      .eq('agency_id', agencyId)
      .eq('profile_id', candidateProfileId)
      .order('placement_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      company:       data.company,
      jobTitle:      data.job_title,
      placementDate: data.placement_date,
      accountId:     data.account_id ?? undefined,
    };
  },
};

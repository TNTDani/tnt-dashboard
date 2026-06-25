// src/lib/timeline.ts
// logEvent() inserts a row into timeline_events.
// getTimeline() fetches events for a given entity, newest first.

import { supabase } from './supabase';
import { requireAgencyId } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { TimelineEvent } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToEvent(r: any): TimelineEvent {
  return {
    id: r.id,
    agencyId: r.agency_id,
    eventType: r.event_type,
    summary: r.summary,
    candidateId: r.candidate_id ?? undefined,
    vacancyId: r.vacancy_id ?? undefined,
    accountId: r.account_id ?? undefined,
    leadId: r.lead_id ?? undefined,
    placementId: r.placement_id ?? undefined,
    applicationId: r.application_id ?? undefined,
    metadata: r.metadata ?? {},
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
  };
}

export interface LogEventInput {
  eventType: string;
  summary: string;
  candidateId?: string;
  vacancyId?: string;
  accountId?: string;
  leadId?: string;
  placementId?: string;
  applicationId?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

/** Fire-and-forget: log a timeline event. Errors are swallowed so callers don't fail. */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const agencyId = requireAgencyId();
    const { error } = await supabase.from('timeline_events').insert({
      id: uuidv4(),
      agency_id: agencyId,
      event_type: input.eventType,
      summary: input.summary,
      candidate_id: input.candidateId ?? null,
      vacancy_id: input.vacancyId ?? null,
      account_id: input.accountId ?? null,
      lead_id: input.leadId ?? null,
      placement_id: input.placementId ?? null,
      application_id: input.applicationId ?? null,
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    });
    if (error) console.warn('[logEvent] insert failed:', error.message);
  } catch (e) {
    console.warn('[logEvent] error:', e);
  }
}

export type TimelineFilter = {
  candidateId?: string;
  vacancyId?: string;
  accountId?: string;
  leadId?: string;
  placementId?: string;
  applicationId?: string;
  limit?: number;
};

/** Fetch timeline events for one entity. Supply exactly one FK filter. */
export async function getTimeline(filter: TimelineFilter): Promise<TimelineEvent[]> {
  const agencyId = requireAgencyId();
  let q = supabase
    .from('timeline_events')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (filter.candidateId)  q = q.eq('candidate_id',  filter.candidateId);
  if (filter.vacancyId)    q = q.eq('vacancy_id',    filter.vacancyId);
  if (filter.accountId)    q = q.eq('account_id',    filter.accountId);
  if (filter.leadId)       q = q.eq('lead_id',       filter.leadId);
  if (filter.placementId)  q = q.eq('placement_id',  filter.placementId);
  if (filter.applicationId) q = q.eq('application_id', filter.applicationId);
  if (filter.limit)        q = q.limit(filter.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

import { supabase } from './supabase';
import {
  Candidate, CandidateProfile, Client, Vacancy, Placement,
  FollowUp, ScreeningResult, SourcingStrategy, WeeklyReport,
  CandidateVacancyMatch, CalendarEvent,
} from './types';
import { logEvent } from './timeline';

// ---------------------------------------------------------------------------
// Agency scope — call initDb(agencyId) once after the user session loads.
// ---------------------------------------------------------------------------
let _agencyId: string | null = null;

export function initDb(agencyId: string) {
  _agencyId = agencyId;
}

export function requireAgencyId(): string {
  if (!_agencyId) throw new Error('initDb() has not been called — agencyId is not set');
  return _agencyId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// syncAll replaces the old delete-then-insert replaceAll.
// Strategy: upsert first (data is never absent), then delete orphans.
// If the second step fails the table still has valid data; the next save will
// clean up the orphans. UUIDs are [0-9a-f-] only so the id list is safe.
async function syncAll(table: string, rows: Record<string, unknown>[]): Promise<void> {
  const agencyId = requireAgencyId();
  if (rows.length === 0) {
    const { error } = await supabase.from(table).delete().eq('agency_id', agencyId);
    if (error) throw error;
    return;
  }
  const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  const ids = rows.map((r) => r.id as string);
  const { error: delError } = await supabase
    .from(table)
    .delete()
    .eq('agency_id', agencyId)
    .not('id', 'in', `(${ids.join(',')})`);
  if (delError) throw delError;
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------
function candidateToRow(c: Candidate) {
  return {
    id: c.id,
    agency_id: requireAgencyId(),
    first_name: c.firstName,
    job_role: c.currentRole,
    current_company: c.currentCompany,
    skills: c.skills,
    status: c.status,
    vacancy_id: c.vacancyId ?? null,
    created_at: c.createdAt,
    processed_cv: c.processedCV ?? null,
    notes: c.notes ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCandidate(r: any): Candidate {
  return {
    id: r.id,
    firstName: r.first_name,
    currentRole: r.job_role,
    currentCompany: r.current_company,
    skills: r.skills ?? [],
    status: r.status,
    vacancyId: r.vacancy_id ?? undefined,
    createdAt: r.created_at,
    processedCV: r.processed_cv ?? undefined,
    notes: r.notes ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CandidateProfiles
// ---------------------------------------------------------------------------
function profileToRow(p: CandidateProfile) {
  return {
    id: p.id,
    agency_id: requireAgencyId(),
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email,
    phone: p.phone,
    location: p.location,
    postal_code: p.postalCode,
    linkedin: p.linkedin ?? null,
    job_title: p.jobTitle,
    branch: p.branch,
    salary_expectation: p.salaryExpectation ?? null,
    status: p.status,
    notes: p.notes,
    timed_notes: p.timedNotes ?? [],
    documents: p.documents ?? [],
    timeline: p.timeline,
    cv_file_name: p.cvFileName ?? null,
    cv_data: p.cvData ?? null,
    motivation_file_name: p.motivationFileName ?? null,
    motivation_data: p.motivationData ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProfile(r: any): CandidateProfile {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    location: r.location,
    postalCode: r.postal_code,
    linkedin: r.linkedin ?? undefined,
    jobTitle: r.job_title,
    branch: r.branch,
    salaryExpectation: r.salary_expectation ?? undefined,
    status: r.status,
    notes: r.notes,
    timedNotes: r.timed_notes ?? [],
    documents: r.documents ?? [],
    timeline: r.timeline ?? [],
    cvFileName: r.cv_file_name ?? undefined,
    cvData: r.cv_data ?? undefined,
    motivationFileName: r.motivation_file_name ?? undefined,
    motivationData: r.motivation_data ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
function clientToRow(c: Client) {
  return {
    id: c.id,
    agency_id: requireAgencyId(),
    company_name: c.companyName,
    website: c.website ?? null,
    sector: c.sector,
    size: c.size,
    type: c.type,
    contact_name: c.contactName,
    contact_email: c.contactEmail,
    contact_phone: c.contactPhone,
    contact_role: c.contactRole,
    location: c.location,
    linkedin: c.linkedin ?? null,
    notes: c.notes,
    last_vacancy_scan: c.lastVacancyScan ?? null,
    fee_agreement: c.feeAgreement,
    guarantee_period: c.guaranteePeriod,
    timeline: c.timeline,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToClient(r: any): Client {
  return {
    id: r.id,
    companyName: r.company_name,
    website: r.website ?? undefined,
    sector: r.sector,
    size: r.size,
    type: r.type,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    contactRole: r.contact_role,
    location: r.location,
    linkedin: r.linkedin ?? undefined,
    notes: r.notes,
    lastVacancyScan: r.last_vacancy_scan ?? undefined,
    feeAgreement: r.fee_agreement,
    guaranteePeriod: r.guarantee_period,
    timeline: r.timeline ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------
function vacancyToRow(v: Vacancy) {
  return {
    id: v.id,
    agency_id: requireAgencyId(),
    title: v.title,
    company: v.company,
    salary_min: v.salaryMin,
    salary_max: v.salaryMax,
    currency: v.currency,
    requirements: v.requirements,
    seniority_level: v.seniorityLevel,
    description: v.description,
    status: v.status,
    stage: v.stage ?? 'intake',
    stage_log: v.stageLog ?? [],
    client_feedback: v.clientFeedback ?? [],
    created_at: v.createdAt,
    account_id: v.accountId ?? null,
    contact_id: v.contactId ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVacancy(r: any): Vacancy {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    currency: r.currency,
    requirements: r.requirements ?? [],
    seniorityLevel: r.seniority_level,
    description: r.description,
    status: r.status,
    stage: r.stage ?? 'intake',
    stageLog: r.stage_log ?? [],
    clientFeedback: r.client_feedback ?? [],
    createdAt: r.created_at,
    accountId: r.account_id ?? undefined,
    contactId: r.contact_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------
function placementToRow(p: Placement) {
  return {
    id: p.id,
    agency_id: requireAgencyId(),
    candidate_id: p.candidateId,
    profile_id: p.profileId ?? null,
    candidate_name: p.candidateName,
    job_title: p.jobTitle,
    vacancy_id: p.vacancyId ?? null,
    vacancy_title: p.vacancyTitle,
    company: p.company,
    placement_date: p.placementDate,
    gross_annual_salary: p.grossAnnualSalary ?? null,
    fee_percentage: p.feePercentage ?? null,
    fee_amount: p.feeAmount ?? null,
    payment_status: p.paymentStatus,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    account_id: p.accountId ?? null,
    contact_id: p.contactId ?? null,
    recruiter_id: p.recruiterId ?? null,
    application_id: p.applicationId ?? null,
    start_date: p.startDate ?? null,
    invoice_status: p.invoiceStatus ?? 'draft',
    guarantee_until: p.guaranteeUntil ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPlacement(r: any): Placement {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    profileId: r.profile_id ?? undefined,
    candidateName: r.candidate_name,
    jobTitle: r.job_title,
    vacancyId: r.vacancy_id ?? undefined,
    vacancyTitle: r.vacancy_title,
    company: r.company,
    placementDate: r.placement_date,
    grossAnnualSalary: r.gross_annual_salary ?? undefined,
    feePercentage: r.fee_percentage ?? undefined,
    feeAmount: r.fee_amount ?? undefined,
    paymentStatus: r.payment_status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    accountId: r.account_id ?? undefined,
    contactId: r.contact_id ?? undefined,
    recruiterId: r.recruiter_id ?? undefined,
    applicationId: r.application_id ?? undefined,
    startDate: r.start_date ?? undefined,
    invoiceStatus: r.invoice_status ?? undefined,
    guaranteeUntil: r.guarantee_until ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// FollowUps
// ---------------------------------------------------------------------------
function followUpToRow(f: FollowUp) {
  return {
    id: f.id,
    agency_id: requireAgencyId(),
    contact_type: f.contactType,
    contact_id: f.contactId,
    contact_name: f.contactName,
    contact_email: f.contactEmail,
    company: f.company,
    original_email_subject: f.originalEmailSubject,
    last_contact_date: f.lastContactDate,
    due_date: f.dueDate,
    status: f.status,
    snoozed_until: f.snoozedUntil ?? null,
    created_at: f.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFollowUp(r: any): FollowUp {
  return {
    id: r.id,
    contactType: r.contact_type,
    contactId: r.contact_id,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    company: r.company,
    originalEmailSubject: r.original_email_subject,
    lastContactDate: r.last_contact_date,
    dueDate: r.due_date,
    status: r.status,
    snoozedUntil: r.snoozed_until ?? undefined,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// ScreeningResults
// ---------------------------------------------------------------------------
function screeningToRow(s: ScreeningResult) {
  return {
    id: s.id,
    agency_id: requireAgencyId(),
    candidate_id: s.candidateId,
    vacancy_id: s.vacancyId,
    score: s.score,
    score_reason: s.scoreReason ?? null,
    summary: s.summary,
    strengths: s.strengths,
    gaps: s.gaps,
    flag: s.flag,
    created_at: s.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScreening(r: any): ScreeningResult {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    vacancyId: r.vacancy_id,
    score: r.score,
    scoreReason: r.score_reason ?? undefined,
    summary: r.summary,
    strengths: r.strengths ?? [],
    gaps: r.gaps ?? [],
    flag: r.flag,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// SourcingStrategies
// ---------------------------------------------------------------------------
function sourcingToRow(s: SourcingStrategy) {
  return {
    id: s.id,
    agency_id: requireAgencyId(),
    job_title: s.jobTitle,
    skills: s.skills,
    location: s.location,
    seniority_level: s.seniorityLevel,
    salary_range: s.salaryRange,
    vacancy_link: s.vacancyLink ?? null,
    vacancy_id: s.vacancyId ?? null,
    profiles: s.profiles,
    boolean_search: s.booleanSearch,
    xray_search: s.xraySearch,
    created_at: s.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSourcing(r: any): SourcingStrategy {
  return {
    id: r.id,
    jobTitle: r.job_title,
    skills: r.skills ?? [],
    location: r.location,
    seniorityLevel: r.seniority_level,
    salaryRange: r.salary_range,
    vacancyLink: r.vacancy_link ?? undefined,
    vacancyId: r.vacancy_id ?? undefined,
    profiles: r.profiles ?? [],
    booleanSearch: r.boolean_search,
    xraySearch: r.xray_search,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// WeeklyReports
// ---------------------------------------------------------------------------
function reportToRow(r: WeeklyReport) {
  return {
    id: r.id,
    agency_id: requireAgencyId(),
    week_number: r.weekNumber,
    year: r.year,
    start_date: r.startDate,
    end_date: r.endDate,
    metrics: r.metrics,
    notes: r.notes,
    generated_at: r.generatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReport(r: any): WeeklyReport {
  return {
    id: r.id,
    weekNumber: r.week_number,
    year: r.year,
    startDate: r.start_date,
    endDate: r.end_date,
    metrics: r.metrics,
    notes: r.notes,
    generatedAt: r.generated_at,
  };
}

// ---------------------------------------------------------------------------
// CandidateVacancyMatches
// ---------------------------------------------------------------------------
function matchToRow(m: CandidateVacancyMatch) {
  return {
    id: m.id,
    agency_id: requireAgencyId(),
    candidate_id: m.candidateId,
    vacancy_id: m.vacancyId,
    match_score: m.matchScore ?? null,
    status: m.status,
    notes: m.notes,
    interview_date: m.interviewDate ?? null,
    interview_time: m.interviewTime ?? null,
    interview_type: m.interviewType ?? null,
    interview_outcome: m.interviewOutcome ?? null,
    interview_notes: m.interviewNotes ?? null,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMatch(r: any): CandidateVacancyMatch {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    vacancyId: r.vacancy_id,
    matchScore: r.match_score ?? undefined,
    status: r.status,
    notes: r.notes ?? '',
    interviewDate: r.interview_date ?? undefined,
    interviewTime: r.interview_time ?? undefined,
    interviewType: r.interview_type ?? undefined,
    interviewOutcome: r.interview_outcome ?? undefined,
    interviewNotes: r.interview_notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// CalendarEvents
// ---------------------------------------------------------------------------
function calendarEventToRow(e: CalendarEvent) {
  return {
    id: e.id,
    agency_id: requireAgencyId(),
    title: e.title,
    type: e.type,
    start_time: e.startTime,
    end_time: e.endTime,
    candidate_id: e.candidateId ?? null,
    candidate_name: e.candidateName ?? null,
    vacancy_id: e.vacancyId ?? null,
    vacancy_title: e.vacancyTitle ?? null,
    client_id: e.clientId ?? null,
    client_name: e.clientName ?? null,
    location: e.location ?? null,
    notes: e.notes ?? null,
    reminder: e.reminder ?? null,
    google_calendar_event_id: e.googleCalendarEventId ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCalendarEvent(r: any): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    startTime: r.start_time,
    endTime: r.end_time,
    candidateId: r.candidate_id ?? undefined,
    candidateName: r.candidate_name ?? undefined,
    vacancyId: r.vacancy_id ?? undefined,
    vacancyTitle: r.vacancy_title ?? undefined,
    clientId: r.client_id ?? undefined,
    clientName: r.client_name ?? undefined,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    reminder: r.reminder ?? undefined,
    googleCalendarEventId: r.google_calendar_event_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const db = {
  // Candidates
  getCandidates: async (): Promise<Candidate[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('candidates').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToCandidate);
  },
  saveCandidates: async (data: Candidate[]): Promise<void> => {
    await syncAll('candidates', data.map(candidateToRow));
  },

  // CandidateProfiles
  getCandidateProfiles: async (): Promise<CandidateProfile[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('candidate_profiles').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToProfile);
  },
  saveCandidateProfiles: async (data: CandidateProfile[]): Promise<void> => {
    await syncAll('candidate_profiles', data.map(profileToRow));
  },

  // Clients
  getClients: async (): Promise<Client[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('clients').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToClient);
  },
  saveClients: async (data: Client[]): Promise<void> => {
    await syncAll('clients', data.map(clientToRow));
  },

  // Vacancies
  getVacancies: async (): Promise<Vacancy[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('vacancies').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToVacancy);
  },
  saveVacancies: async (data: Vacancy[]): Promise<void> => {
    await syncAll('vacancies', data.map(vacancyToRow));
  },

  // Placements
  getPlacements: async (): Promise<Placement[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('placements').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToPlacement);
  },
  savePlacements: async (data: Placement[]): Promise<void> => {
    await syncAll('placements', data.map(placementToRow));
  },
  /** Upsert a single placement and log a timeline event. */
  savePlacement: async (p: Placement): Promise<void> => {
    const { error } = await supabase.from('placements').upsert(placementToRow(p));
    if (error) throw error;
    logEvent({
      eventType: 'placement_created',
      summary: `${p.candidateName} placed at ${p.company} — ${p.jobTitle}`,
      candidateId: p.profileId,
      vacancyId: p.vacancyId,
      accountId: p.accountId,
      placementId: p.id,
      applicationId: p.applicationId,
      metadata: {
        feeAmount: p.feeAmount,
        grossAnnualSalary: p.grossAnnualSalary,
        invoiceStatus: p.invoiceStatus ?? 'draft',
      },
    });
  },

  // FollowUps
  getFollowUps: async (): Promise<FollowUp[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('follow_ups').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToFollowUp);
  },
  saveFollowUps: async (data: FollowUp[]): Promise<void> => {
    await syncAll('follow_ups', data.map(followUpToRow));
  },

  // ScreeningResults
  getScreenings: async (): Promise<ScreeningResult[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('screening_results').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToScreening);
  },
  saveScreenings: async (data: ScreeningResult[]): Promise<void> => {
    await syncAll('screening_results', data.map(screeningToRow));
  },

  // SourcingStrategies
  getSourcingStrategies: async (): Promise<SourcingStrategy[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('sourcing_strategies').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToSourcing);
  },
  saveSourcingStrategies: async (data: SourcingStrategy[]): Promise<void> => {
    await syncAll('sourcing_strategies', data.map(sourcingToRow));
  },

  // WeeklyReports
  getWeeklyReports: async (): Promise<WeeklyReport[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('weekly_reports').select('*').eq('agency_id', agencyId).order('generated_at');
    if (error) throw error;
    return (data ?? []).map(rowToReport);
  },
  saveWeeklyReports: async (data: WeeklyReport[]): Promise<void> => {
    await syncAll('weekly_reports', data.map(reportToRow));
  },

  // CandidateVacancyMatches (individual upsert/delete — no replaceAll)
  getMatches: async (): Promise<CandidateVacancyMatch[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('candidate_vacancy_matches').select('*').eq('agency_id', agencyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToMatch);
  },
  getMatchesByCandidate: async (candidateId: string): Promise<CandidateVacancyMatch[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('candidate_vacancy_matches').select('*').eq('agency_id', agencyId).eq('candidate_id', candidateId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToMatch);
  },
  getMatchesByVacancy: async (vacancyId: string): Promise<CandidateVacancyMatch[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('candidate_vacancy_matches').select('*').eq('agency_id', agencyId).eq('vacancy_id', vacancyId).order('created_at');
    if (error) throw error;
    return (data ?? []).map(rowToMatch);
  },
  saveMatch: async (match: CandidateVacancyMatch, prevStatus?: string): Promise<void> => {
    const { error } = await supabase.from('candidate_vacancy_matches').upsert(matchToRow(match));
    if (error) throw error;
    const statusChanged = prevStatus !== undefined && prevStatus !== match.status;
    const isNew = prevStatus === undefined;
    const base = {
      candidateId: match.candidateId,
      vacancyId: match.vacancyId,
      applicationId: match.id,
    };
    if (isNew && match.status === 'submitted') {
      logEvent({ eventType: 'candidate_submitted', summary: 'Candidate submitted for vacancy', ...base, metadata: {} });
    } else if (statusChanged) {
      // Specific named events take priority over the generic one
      if (match.status === 'submitted') {
        logEvent({ eventType: 'candidate_submitted', summary: 'Candidate submitted for vacancy', ...base, metadata: { from: prevStatus } });
      } else if (match.status === 'offer') {
        logEvent({ eventType: 'offer_made', summary: `Offer made — moved from ${prevStatus}`, ...base, metadata: { from: prevStatus } });
      } else {
        logEvent({
          eventType: 'application_status_changed',
          summary: `Application status: ${prevStatus} → ${match.status}`,
          ...base,
          metadata: { from: prevStatus, to: match.status },
        });
      }
    }
  },
  deleteMatch: async (id: string): Promise<void> => {
    const agencyId = requireAgencyId();
    const { error } = await supabase.from('candidate_vacancy_matches').delete().eq('id', id).eq('agency_id', agencyId);
    if (error) throw error;
  },

  // CalendarEvents (individual upsert/delete — no replaceAll)
  getCalendarEvents: async (): Promise<CalendarEvent[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase.from('calendar_events').select('*').eq('agency_id', agencyId).order('start_time');
    if (error) throw error;
    return (data ?? []).map(rowToCalendarEvent);
  },
  getCalendarEventsByRange: async (start: string, end: string): Promise<CalendarEvent[]> => {
    const agencyId = requireAgencyId();
    const { data, error } = await supabase
      .from('calendar_events').select('*')
      .eq('agency_id', agencyId)
      .gte('start_time', start).lte('start_time', end).order('start_time');
    if (error) throw error;
    return (data ?? []).map(rowToCalendarEvent);
  },
  saveCalendarEvent: async (event: CalendarEvent): Promise<void> => {
    const { error } = await supabase.from('calendar_events').upsert(calendarEventToRow(event));
    if (error) throw error;
  },
  deleteCalendarEvent: async (id: string): Promise<void> => {
    const agencyId = requireAgencyId();
    const { error } = await supabase.from('calendar_events').delete().eq('id', id).eq('agency_id', agencyId);
    if (error) throw error;
  },
};

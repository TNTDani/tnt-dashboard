export type PipelineStatus = 'sourced' | 'screened' | 'shortlisted' | 'interviewed' | 'placed';

export interface WorkExperience {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
}

export interface ProcessedCV {
  firstName: string;
  currentRole: string;
  currentCompany: string;
  professionalSummary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  languages: string[];
  certifications: string[];
}

export interface Candidate {
  id: string;
  firstName: string;
  currentRole: string;
  currentCompany: string;
  skills: string[];
  status: PipelineStatus;
  vacancyId?: string;
  createdAt: string;
  processedCV?: ProcessedCV;
  notes?: string;
}

export interface Vacancy {
  id: string;
  title: string;
  company: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  requirements: string[];
  seniorityLevel: string;
  description: string;
  status: 'open' | 'closed' | 'on-hold';
  createdAt: string;
}

export interface ScreeningResult {
  id: string;
  candidateId: string;
  vacancyId: string;
  score: number;
  scoreReason?: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  flag: 'green' | 'amber' | 'red';
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  type: 'note' | 'email_sent' | 'status_change' | 'cv_upload' | 'motivation_upload' | 'created';
  content: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface CandidateProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  postalCode: string;
  linkedin?: string;
  jobTitle: string;
  branch: string;
  salaryExpectation?: number;
  status: 'active' | 'passive' | 'placed';
  notes: string;
  timeline: TimelineEntry[];
  cvFileName?: string;
  cvData?: string; // base64
  motivationFileName?: string;
  motivationData?: string; // base64
  createdAt: string;
  updatedAt: string;
}

export interface FeeAgreement {
  type: 'standard' | 'custom' | 'retainer';
  customPercentage?: number;
  retainerAmount?: number;
  retainerPercentage?: number;
}

export interface Client {
  id: string;
  companyName: string;
  website?: string;
  sector: string;
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  type: 'prospect' | 'active' | 'inactive';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactRole: string;
  location: string;
  linkedin?: string;
  notes: string;
  lastVacancyScan?: string;
  feeAgreement: FeeAgreement;
  guaranteePeriod: number;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Placement {
  id: string;
  candidateId: string;
  profileId?: string;
  candidateName: string;
  jobTitle: string;
  vacancyId?: string;
  vacancyTitle: string;
  company: string;
  placementDate: string;
  grossAnnualSalary: number;
  feePercentage: number;
  feeAmount: number;
  paymentStatus: 'pending' | 'invoiced' | 'paid';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeTicket {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  roleTitle: string;
  seniorityLevel: 'Junior/Medior' | 'Senior' | 'Management/Lead';
  salaryMin: number;
  salaryMax: number;
  workType: 'remote' | 'hybrid' | 'on-site';
  city: string;
  description: string;
  source: string;
  status: 'new' | 'in-review' | 'converted' | 'declined';
  confirmationSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface FollowUp {
  id: string;
  contactType: 'candidate' | 'client';
  contactId: string;
  contactName: string;
  contactEmail: string;
  company: string;
  originalEmailSubject: string;
  lastContactDate: string;
  dueDate: string;
  status: 'pending' | 'done' | 'snoozed';
  snoozedUntil?: string;
  createdAt: string;
}

export interface SourcingProfileDescription {
  title: string;
  backgroundDescription: string;
  keySkills: string[];
  whereToFind: {
    linkedinSearchUrl: string;
    githubSearch?: string;
    communities: string[];
  };
  outreachMessage: string;
}

export interface SourcingStrategy {
  id: string;
  jobTitle: string;
  skills: string[];
  location: string;
  seniorityLevel: string;
  salaryRange: string;
  vacancyLink?: string;
  vacancyId?: string;
  profiles: SourcingProfileDescription[];
  booleanSearch: string;
  xraySearch: string;
  createdAt: string;
}

export interface WeeklyReportMetrics {
  emailsSent: number;
  replyRate: number;        // % — manual entry
  newProspects: number;
  callsBooked: number;      // manual entry
  candidatesSourced: number;
  candidatesScreened: number;
  shortlistedCandidates: number;
  placementsMade: number;
  feesInvoiced: number;     // €
  feesReceived: number;     // €
}

export type VacancyCategory = 'sales' | 'design' | 'engineering' | 'ai' | 'product' | 'other';
export type VacancySourceId = 'arbeitnow' | 'remoteok' | 'jobicy' | 'findwork' | 'eurojobs' | 'startupjobs' | 'nvb';

export interface VacancyListing {
  id: string;
  title: string;
  company: string;
  source: VacancySourceId;
  location: string;
  postedAt: string;       // ISO string
  description: string;
  url: string;
  category: VacancyCategory;
}

export interface WatchlistItem {
  id: string;
  listing: VacancyListing;
  savedAt: string;
  contacted: boolean;
  notes: string;
}

export interface VacancyMonitorCache {
  listings: VacancyListing[];
  fetchedAt: string;
  sourceStatuses: Record<VacancySourceId, 'ok' | 'error' | 'empty' | 'not_configured'>;
  sourceErrors?: Partial<Record<VacancySourceId, string>>;
  sourceCounts?: Partial<Record<VacancySourceId, number>>;
}

export interface WeeklyReport {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;   // ISO — Monday
  endDate: string;     // ISO — Sunday
  metrics: WeeklyReportMetrics;
  notes: string;
  generatedAt: string;
}

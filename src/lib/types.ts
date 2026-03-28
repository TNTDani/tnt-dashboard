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
  notes: string;
  feeAgreement: FeeAgreement;
  guaranteePeriod: number;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

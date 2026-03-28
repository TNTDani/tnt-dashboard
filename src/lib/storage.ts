import { Candidate, Vacancy, ScreeningResult, CandidateProfile, Client } from './types';

const KEYS = {
  candidates: 'tnt_candidates',
  vacancies: 'tnt_vacancies',
  screenings: 'tnt_screenings',
  candidateProfiles: 'tnt_candidate_profiles',
  clients: 'tnt_clients',
  gmailToken: 'tnt_gmail_token',
  lastViewedCandidate: 'tnt_last_viewed_candidate',
};

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function getString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setString(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

export const storage = {
  getCandidates: (): Candidate[] => get<Candidate>(KEYS.candidates),
  saveCandidates: (data: Candidate[]) => set(KEYS.candidates, data),

  getVacancies: (): Vacancy[] => get<Vacancy>(KEYS.vacancies),
  saveVacancies: (data: Vacancy[]) => set(KEYS.vacancies, data),

  getScreenings: (): ScreeningResult[] => get<ScreeningResult>(KEYS.screenings),
  saveScreenings: (data: ScreeningResult[]) => set(KEYS.screenings, data),

  getCandidateProfiles: (): CandidateProfile[] => get<CandidateProfile>(KEYS.candidateProfiles),
  saveCandidateProfiles: (data: CandidateProfile[]) => set(KEYS.candidateProfiles, data),

  getClients: (): Client[] => get<Client>(KEYS.clients),
  saveClients: (data: Client[]) => set(KEYS.clients, data),

  getGmailToken: (): string | null => getString(KEYS.gmailToken),
  saveGmailToken: (token: string) => setString(KEYS.gmailToken, token),
  clearGmailToken: () => removeKey(KEYS.gmailToken),

  getLastViewedCandidate: (): string | null => getString(KEYS.lastViewedCandidate),
  setLastViewedCandidate: (id: string) => setString(KEYS.lastViewedCandidate, id),
  clearLastViewedCandidate: () => removeKey(KEYS.lastViewedCandidate),
};

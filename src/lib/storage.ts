import { WatchlistItem, VacancyMonitorCache, RecentItem } from './types';

// localStorage-only storage: device-specific / ephemeral data that doesn't
// need to sync across sessions or devices. All entity data (candidates,
// clients, vacancies, etc.) has moved to Supabase via src/lib/db.ts.

const KEYS = {
  gmailToken: 'tnt_gmail_token',
  calendarToken: 'tnt_calendar_token',
  lastViewedCandidate: 'tnt_last_viewed_candidate',
  vacancyWatchlist: 'tnt_vacancy_watchlist',
  vacancyMonitorCache: 'tnt_vacancy_monitor_cache',
  recentItems: 'tnt_recent_items',
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
  getGmailToken: (): string | null => getString(KEYS.gmailToken),
  saveGmailToken: (token: string) => setString(KEYS.gmailToken, token),
  clearGmailToken: () => removeKey(KEYS.gmailToken),

  getCalendarToken: (): object | null => {
    const raw = getString(KEYS.calendarToken);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  saveCalendarToken: (token: object) => setString(KEYS.calendarToken, JSON.stringify(token)),
  clearCalendarToken: () => removeKey(KEYS.calendarToken),

  getLastViewedCandidate: (): string | null => getString(KEYS.lastViewedCandidate),
  setLastViewedCandidate: (id: string) => setString(KEYS.lastViewedCandidate, id),
  clearLastViewedCandidate: () => removeKey(KEYS.lastViewedCandidate),

  getVacancyWatchlist: (): WatchlistItem[] => get<WatchlistItem>(KEYS.vacancyWatchlist),
  saveVacancyWatchlist: (data: WatchlistItem[]) => set(KEYS.vacancyWatchlist, data),

  getVacancyMonitorCache: (): VacancyMonitorCache | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(KEYS.vacancyMonitorCache);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  saveVacancyMonitorCache: (data: VacancyMonitorCache) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEYS.vacancyMonitorCache, JSON.stringify(data));
  },
  clearVacancyMonitorCache: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(KEYS.vacancyMonitorCache);
  },

  getRecentItems: (): RecentItem[] => get<RecentItem>(KEYS.recentItems),
  addRecentItem: (item: RecentItem) => {
    if (typeof window === 'undefined') return;
    const existing = get<RecentItem>(KEYS.recentItems);
    // Remove duplicate then prepend
    const filtered = existing.filter(r => !(r.type === item.type && r.id === item.id));
    set(KEYS.recentItems, [item, ...filtered].slice(0, 9));
  },
};

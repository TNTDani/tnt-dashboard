import { WatchlistItem, VacancyMonitorCache, RecentItem, ActivityItem } from './types';

// localStorage-only storage: device-specific / ephemeral data that doesn't
// need to sync across sessions or devices. All entity data (candidates,
// clients, vacancies, etc.) has moved to Supabase via src/lib/db.ts.
//
// All tenant-sensitive keys are scoped by agencyId so that two agencies on
// the same browser never bleed data into each other.

const KEYS = {
  gmailToken:          'tnt_gmail_token',
  calendarToken:       'tnt_calendar_token',
  // The following keys are PER-AGENCY — always pass agencyId when calling these:
  recentItems:         (agencyId: string) => `tnt_recent_items_${agencyId}`,
  activityItems:       (agencyId: string) => `tnt_activity_items_${agencyId}`,
  lastViewedCandidate: (agencyId: string) => `tnt_last_viewed_${agencyId}`,
  vacancyWatchlist:    (agencyId: string) => `tnt_vacancy_watchlist_${agencyId}`,
  vacancyMonitorCache: (agencyId: string) => `tnt_vacancy_monitor_cache_${agencyId}`,
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
  // ── Non-tenant keys (device-scoped, no agencyId needed) ──────────────────

  getGmailToken:    (): string | null => getString(KEYS.gmailToken),
  saveGmailToken:   (token: string)   => setString(KEYS.gmailToken, token),
  clearGmailToken:  ()                => removeKey(KEYS.gmailToken),

  getCalendarToken: (): object | null => {
    const raw = getString(KEYS.calendarToken);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  saveCalendarToken:  (token: object) => setString(KEYS.calendarToken, JSON.stringify(token)),
  clearCalendarToken: ()              => removeKey(KEYS.calendarToken),

  // ── Tenant-scoped keys (agencyId required) ────────────────────────────────

  getRecentItems: (agencyId: string): RecentItem[] =>
    get<RecentItem>(KEYS.recentItems(agencyId)),

  addRecentItem: (item: RecentItem, agencyId: string) => {
    if (typeof window === 'undefined') return;
    const existing = get<RecentItem>(KEYS.recentItems(agencyId));
    const filtered = existing.filter(r => !(r.type === item.type && r.id === item.id));
    set(KEYS.recentItems(agencyId), [item, ...filtered].slice(0, 9));
  },

  getActivityItems: (agencyId: string): ActivityItem[] =>
    get<ActivityItem>(KEYS.activityItems(agencyId)),

  addActivityItem: (item: ActivityItem, agencyId: string) => {
    if (typeof window === 'undefined') return;
    const existing = get<ActivityItem>(KEYS.activityItems(agencyId));
    const filtered = existing.filter(r => !(r.type === item.type && r.id === item.id));
    set(KEYS.activityItems(agencyId), [item, ...filtered].slice(0, 3));
  },

  getLastViewedCandidate: (agencyId: string): string | null =>
    getString(KEYS.lastViewedCandidate(agencyId)),

  setLastViewedCandidate: (id: string, agencyId: string) =>
    setString(KEYS.lastViewedCandidate(agencyId), id),

  clearLastViewedCandidate: (agencyId: string) =>
    removeKey(KEYS.lastViewedCandidate(agencyId)),

  getVacancyWatchlist: (agencyId: string): WatchlistItem[] =>
    get<WatchlistItem>(KEYS.vacancyWatchlist(agencyId)),

  saveVacancyWatchlist: (data: WatchlistItem[], agencyId: string) =>
    set(KEYS.vacancyWatchlist(agencyId), data),

  getVacancyMonitorCache: (agencyId: string): VacancyMonitorCache | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(KEYS.vacancyMonitorCache(agencyId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  saveVacancyMonitorCache: (data: VacancyMonitorCache, agencyId: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEYS.vacancyMonitorCache(agencyId), JSON.stringify(data));
  },

  clearVacancyMonitorCache: (agencyId: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(KEYS.vacancyMonitorCache(agencyId));
  },
};

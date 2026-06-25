'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { db, initDb } from '@/lib/db';
import { logEvent } from '@/lib/timeline';
import { storage } from '@/lib/storage';
import { CalendarEvent, CalendarEventType, EVENT_COLORS, CandidateProfile, Vacancy, Client } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import CalendarEventModal from '@/components/CalendarEventModal';
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw, LayoutGrid, List,
  Plus, Check, AlertCircle,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ── Date helpers ──────────────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date): boolean { return isSameDay(d, new Date()); }
function setTimeOnDate(base: Date, hour: number, min: number): Date {
  const r = new Date(base);
  r.setHours(hour, min, 0, 0);
  return r;
}
function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = getWeekStart(first);
  const weeks: Date[][] = [];
  let cur = new Date(start);
  while (cur <= last || weeks.length < 5) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur = addDays(cur, 1); }
    weeks.push(week);
    if (cur > last && weeks.length >= 5) break;
  }
  return weeks;
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function getDayEvents(day: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(e => isSameDay(new Date(e.startTime), day))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ── Event block for week view ─────────────────────────────────────────────────
function EventBlock({ event, onClick }: { event: CalendarEvent; onClick: (e: CalendarEvent) => void }) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
  const endMins = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
  const clampStart = Math.max(0, startMins);
  const clampEnd = Math.min((END_HOUR - START_HOUR) * 60, endMins);
  const top = (clampStart / 60) * HOUR_HEIGHT;
  const height = Math.max(22, ((clampEnd - clampStart) / 60) * HOUR_HEIGHT);
  const colors = EVENT_COLORS[event.type];
  const short = height < 36;

  return (
    <div
      className={`absolute inset-x-0.5 rounded-md border overflow-hidden cursor-pointer hover:brightness-125 transition-all ${colors.bg} ${colors.border}`}
      style={{ top, height }}
      onClick={e => { e.stopPropagation(); onClick(event); }}
    >
      <div className={`w-full h-0.5 ${colors.solid}`} />
      <div className="px-1.5 py-0.5">
        <p className={`${colors.text} font-semibold leading-tight truncate ${short ? 'text-[9px]' : 'text-[10px]'}`}>
          {event.title}
        </p>
        {!short && (
          <p className="text-[#6B7280] text-[9px] truncate">
            {formatTime(event.startTime)}
            {event.candidateName ? ` · ${event.candidateName}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({
  weekDays, events, onSlotClick, onEventClick,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  onSlotClick: (prefill: Partial<CalendarEvent>) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to current hour on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollTo = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMins = (y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(totalMins / 30) * 30;
    const hour = START_HOUR + Math.floor(snapped / 60);
    const min = snapped % 60;
    const clamped = Math.min(Math.max(hour, START_HOUR), END_HOUR - 1);
    const startTime = setTimeOnDate(day, clamped, min);
    const endTime = new Date(startTime.getTime() + 3600000);
    onSlotClick({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day header */}
      <div className="flex border-b border-[rgba(45,74,45,0.15)] flex-shrink-0 bg-white">
        <div className="w-14 flex-shrink-0" />
        {weekDays.map((day, i) => (
          <div key={i} className={`flex-1 text-center py-2 border-l border-[rgba(45,74,45,0.15)] ${isToday(day) ? 'bg-[#2D4A2D]/5' : ''}`}>
            <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider">{DAY_SHORT[i]}</p>
            <p className={`text-sm font-bold mt-0.5 w-7 h-7 mx-auto rounded-full flex items-center justify-center ${
              isToday(day) ? 'bg-[#2D4A2D] text-white' : 'text-[#2D4A2D]'
            }`}>
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
        <div className="flex" style={{ height: HOUR_HEIGHT * HOURS.length }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-[#6B7280] font-medium"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 6 }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, i) => {
            const dayEvents = getDayEvents(day, events);
            return (
              <div
                key={i}
                className={`flex-1 relative border-l border-[rgba(45,74,45,0.15)] cursor-crosshair ${isToday(day) ? 'bg-[#2D4A2D]/3' : ''}`}
                style={{ height: HOUR_HEIGHT * HOURS.length }}
                onClick={e => handleColumnClick(e, day)}
              >
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute inset-x-0 border-t border-[rgba(45,74,45,0.15)]/40" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`h-${h}`} className="absolute inset-x-0 border-t border-[rgba(45,74,45,0.15)]/20 border-dashed" style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}
                {/* Current time indicator */}
                {isToday(day) && (() => {
                  const now = new Date();
                  const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
                  if (mins < 0 || mins > (END_HOUR - START_HOUR) * 60) return null;
                  return (
                    <div className="absolute inset-x-0 flex items-center z-10 pointer-events-none" style={{ top: (mins / 60) * HOUR_HEIGHT }}>
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
                  );
                })()}
                {/* Events */}
                {dayEvents.map(event => (
                  <EventBlock key={event.id} event={event} onClick={onEventClick} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────────
function MonthView({
  year, month, events, onDayClick, onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const weeks = getMonthGrid(year, month);
  const currentMonth = month;

  return (
    <div className="flex flex-col flex-1">
      {/* Day header */}
      <div className="grid grid-cols-7 border-b border-[rgba(45,74,45,0.15)]">
        {DAY_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[rgba(45,74,45,0.15)] last:border-0">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentMonth;
              const today = isToday(day);
              const dayEvents = getDayEvents(day, events);
              const maxVisible = 3;
              const overflow = dayEvents.length - maxVisible;

              return (
                <div
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={`border-l border-[rgba(45,74,45,0.15)] first:border-l-0 p-1.5 cursor-pointer transition-colors min-h-[80px] ${
                    today ? 'bg-[#2D4A2D]/5' : 'hover:bg-[#FFFFFF]/50'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    today ? 'bg-[#2D4A2D] text-white' : 'text-[#94a3b8]'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxVisible).map(event => {
                      const colors = EVENT_COLORS[event.type];
                      return (
                        <div
                          key={event.id}
                          onClick={e => { e.stopPropagation(); onEventClick(event); }}
                          className={`w-full rounded px-1 py-0.5 text-[9px] font-medium truncate cursor-pointer hover:brightness-125 ${colors.bg} ${colors.text}`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${colors.solid}`} />
                          {event.title}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <p className="text-[#6B7280] text-[9px] pl-1">+{overflow} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const agencyId = session?.user?.agencyId;
  const [view, setView] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalPrefill, setModalPrefill] = useState<Partial<CalendarEvent>>({});
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Load data — wait for agencyId so requireAgencyId() doesn't throw
  useEffect(() => {
    if (!agencyId) return;
    initDb(agencyId);
    Promise.all([
      db.getCalendarEvents(),
      db.getCandidateProfiles(),
      db.getVacancies(),
      db.getClients(),
    ]).then(([evts, profs, vacs, clts]) => {
      setEvents(evts);
      setCandidates(profs);
      setVacancies(vacs);
      setClients(clts);
    }).catch(() => {});
    setCalendarConnected(!!storage.getCalendarToken());
  }, [agencyId]);

  // Read URL params for pre-fill (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      const prefill: Partial<CalendarEvent> = {
        type: (params.get('type') || 'other') as CalendarEventType,
      };
      if (params.get('candidateId')) {
        prefill.candidateId = params.get('candidateId')!;
        prefill.candidateName = decodeURIComponent(params.get('candidateName') || '');
      }
      if (params.get('clientId')) {
        prefill.clientId = params.get('clientId')!;
        prefill.clientName = decodeURIComponent(params.get('clientName') || '');
      }
      if (params.get('vacancyId')) {
        prefill.vacancyId = params.get('vacancyId')!;
        prefill.vacancyTitle = decodeURIComponent(params.get('vacancyTitle') || '');
      }
      if (params.get('title')) {
        prefill.title = decodeURIComponent(params.get('title') || '');
      }
      setModalPrefill(prefill);
      setSelectedEvent(null);
      setModalOpen(true);
      // Clean up params without page reload
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  // Derived: week days
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Derived: month grid info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (view === 'week') setCurrentDate(d => addDays(d, -7));
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === 'week') setCurrentDate(d => addDays(d, 7));
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // Header label
  const headerLabel = view === 'week'
    ? (() => {
        const start = weekDays[0];
        const end = weekDays[6];
        if (start.getMonth() === end.getMonth())
          return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
        return `${MONTH_NAMES[start.getMonth()]} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
      })()
    : `${MONTH_NAMES[month]} ${year}`;

  // Event CRUD
  const handleSaveEvent = async (event: CalendarEvent) => {
    const isNew = !events.some(e => e.id === event.id);
    await db.saveCalendarEvent(event);
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === event.id);
      return idx >= 0 ? prev.map(e => e.id === event.id ? event : e) : [...prev, event];
    });
    if (isNew && event.type === 'interview') {
      logEvent({
        eventType: 'interview_scheduled',
        summary: `Interview scheduled: ${event.title}`,
        candidateId: event.candidateId,
        vacancyId: event.vacancyId,
        metadata: {
          startTime: event.startTime,
          candidateName: event.candidateName ?? '',
          vacancyTitle: event.vacancyTitle ?? '',
          location: event.location ?? '',
        },
      });
    }

    // Push to Google Calendar if connected
    if (calendarConnected && !event.googleCalendarEventId) {
      const tokens = storage.getCalendarToken();
      if (tokens) {
        try {
          const res = await fetch('/api/google-calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens, pushEvents: [event] }),
          });
          const data = await res.json();
          if (data.created?.[0]?.googleId) {
            const updated = { ...event, googleCalendarEventId: data.created[0].googleId };
            await db.saveCalendarEvent(updated);
            setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
          }
        } catch { /* sync failure is non-fatal */ }
      }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    await db.deleteCalendarEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const openNewEvent = (prefill: Partial<CalendarEvent> = {}) => {
    setSelectedEvent(null);
    setModalPrefill(prefill);
    setModalOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalPrefill({});
    setModalOpen(true);
  };

  const handleDayClick = (day: Date) => {
    // Switch to week view for that day
    setCurrentDate(day);
    setView('week');
  };

  // Google Calendar connect
  const connectGoogleCalendar = () => {
    const popup = window.open('/api/google-calendar/auth', 'gcal_auth', 'width=600,height=700');
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'calendar_connected') {
        setCalendarConnected(true);
        popup?.close();
        window.removeEventListener('message', handler);
      }
    };
    window.addEventListener('message', handler);
  };

  // Sync with Google Calendar
  const handleSync = useCallback(async () => {
    const tokens = storage.getCalendarToken();
    if (!tokens) { connectGoogleCalendar(); return; }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const unsynced = events.filter(e => !e.googleCalendarEventId);
      const res = await fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, pushEvents: unsynced, since: new Date(Date.now() - 30 * 86400000).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      // Update local events with Google Calendar IDs
      let updatedEvents = [...events];
      for (const { localId, googleId } of data.created ?? []) {
        const updated = { ...updatedEvents.find(e => e.id === localId)!, googleCalendarEventId: googleId, updatedAt: new Date().toISOString() };
        await db.saveCalendarEvent(updated);
        updatedEvents = updatedEvents.map(e => e.id === localId ? updated : e);
      }

      // Import new Google Calendar events
      const existingGoogleIds = new Set(updatedEvents.map(e => e.googleCalendarEventId).filter(Boolean));
      const newGEvents = (data.googleEvents ?? []).filter((g: { googleId: string }) => !existingGoogleIds.has(g.googleId));
      for (const g of newGEvents) {
        const newEvent: CalendarEvent = {
          id: uuidv4(),
          title: g.title,
          type: 'other',
          startTime: g.startTime,
          endTime: g.endTime,
          location: g.location || undefined,
          notes: g.notes || undefined,
          googleCalendarEventId: g.googleId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.saveCalendarEvent(newEvent);
        updatedEvents = [...updatedEvents, newEvent];
      }

      setEvents(updatedEvents);
      setSyncMsg({ type: 'ok', text: `Synced — ${data.created?.length ?? 0} pushed, ${newGEvents.length} imported` });
    } catch (e) {
      setSyncMsg({ type: 'err', text: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, calendarConnected]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[rgba(45,74,45,0.15)] flex-shrink-0 bg-white">
        {/* Left: nav */}
        <div className="flex items-center gap-3">
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:border-[#2a4a7f] text-xs font-medium transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-[#2D4A2D] font-semibold text-sm">{headerLabel}</h2>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Desktop-only: sync message + Google Calendar + view toggle */}
          <div className="hidden sm:flex items-center gap-2">
            {syncMsg && (
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${
                syncMsg.type === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {syncMsg.type === 'ok' ? <Check size={11} /> : <AlertCircle size={11} />}
                {syncMsg.text}
              </span>
            )}

            {calendarConnected ? (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:border-[rgba(45,74,45,0.3)] text-xs transition-colors"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync Google'}
              </button>
            ) : (
              <button
                onClick={connectGoogleCalendar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:text-[#2D4A2D] hover:border-[#2D4A2D]/50 text-xs transition-colors"
              >
                <CalendarDays size={12} />
                Connect Google Calendar
              </button>
            )}

            <div className="flex items-center border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden">
              <button
                onClick={() => setView('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                  view === 'week' ? 'bg-[#2D4A2D] text-white' : 'text-[#6B7280] hover:text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.08)]'
                }`}
              >
                <List size={12} /> Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l border-[rgba(45,74,45,0.15)] ${
                  view === 'month' ? 'bg-[#2D4A2D] text-white' : 'text-[#6B7280] hover:text-[#2D4A2D] hover:bg-[rgba(45,74,45,0.08)]'
                }`}
              >
                <LayoutGrid size={12} /> Month
              </button>
            </div>
          </div>

          {/* Mobile-only: week/month icon toggle */}
          <div className="flex sm:hidden items-center border border-[rgba(45,74,45,0.15)] rounded-lg overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={`p-2 transition-colors ${
                view === 'week' ? 'bg-[#2D4A2D] text-white' : 'text-[#6B7280]'
              }`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setView('month')}
              className={`p-2 transition-colors border-l border-[rgba(45,74,45,0.15)] ${
                view === 'month' ? 'bg-[#2D4A2D] text-white' : 'text-[#6B7280]'
              }`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* New event — always visible */}
          <button
            onClick={() => openNewEvent()}
            className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New Event</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-2 border-b border-[rgba(45,74,45,0.15)] flex-shrink-0 bg-white overflow-x-auto">
        {(Object.entries(EVENT_COLORS) as [CalendarEventType, typeof EVENT_COLORS[keyof typeof EVENT_COLORS]][]).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${c.solid}`} />
            <span className={`text-[10px] font-medium ${c.text}`}>
              {type === 'interview' ? 'Interview' : type === 'client-call' ? 'Client Call' : type === 'follow-up' ? 'Follow-up' : type === 'placement' ? 'Placement' : 'Other'}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar body */}
      <div className="flex flex-col flex-1 overflow-hidden bg-[#EDEDEB]">
        {view === 'week' ? (
          <WeekView
            weekDays={weekDays}
            events={events}
            onSlotClick={openNewEvent}
            onEventClick={openEditEvent}
          />
        ) : (
          <MonthView
            year={year}
            month={month}
            events={events}
            onDayClick={handleDayClick}
            onEventClick={openEditEvent}
          />
        )}
      </div>

      {/* Event modal */}
      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); }}
        event={selectedEvent}
        prefill={modalPrefill}
        candidates={candidates}
        vacancies={vacancies}
        clients={clients}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { CalendarEvent, EVENT_COLORS } from '@/lib/types';
import { CalendarDays, Clock, ChevronRight } from 'lucide-react';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function CalendarWidget() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 4);
    db.getCalendarEventsByRange(start.toISOString(), end.toISOString())
      .then(setEvents)
      .catch(() => {});
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build day buckets: today + next 3 days
  const days = Array.from({ length: 4 }, (_, i) => addDays(today, i));
  const byDay = days.map(d => ({
    date: d,
    events: events
      .filter(e => isSameDay(new Date(e.startTime), d))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  const totalEvents = events.length;

  return (
    <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center">
            <CalendarDays size={15} className="text-[#7C3AED]" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Schedule</h2>
            <p className="text-[#94a3b8] text-xs">{totalEvents === 0 ? 'No events this week' : `${totalEvents} event${totalEvents !== 1 ? 's' : ''} coming up`}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/calendar')}
          className="flex items-center gap-1 text-[#7C3AED] hover:text-[#6d28d9] text-xs font-medium transition-colors"
        >
          View all <ChevronRight size={13} />
        </button>
      </div>

      {totalEvents === 0 ? (
        <div className="text-center py-6">
          <CalendarDays size={28} className="mx-auto mb-2 text-[#1e3a5f]" />
          <p className="text-[#4a6fa5] text-sm">No upcoming events</p>
          <button
            onClick={() => router.push('/calendar?new=1')}
            className="mt-2 text-[#7C3AED] hover:text-[#6d28d9] text-xs transition-colors"
          >
            + Schedule something
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {byDay.map(({ date, events: dayEvents }) => {
            if (dayEvents.length === 0) return null;
            const isToday = isSameDay(date, new Date());
            return (
              <div key={date.toISOString()}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isToday ? 'text-[#7C3AED]' : 'text-[#4a6fa5]'}`}>
                  {formatDayLabel(date)}
                </p>
                <div className="space-y-1.5">
                  {dayEvents.map(event => {
                    const colors = EVENT_COLORS[event.type];
                    return (
                      <button
                        key={event.id}
                        onClick={() => router.push('/calendar')}
                        className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border ${colors.border} ${colors.bg} hover:brightness-110 transition-all text-left`}
                      >
                        <div className={`w-1 h-full min-h-[28px] rounded-full ${colors.solid} flex-shrink-0 mt-0.5`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-xs font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-[#4a6fa5] text-[11px]">
                              <Clock size={9} />
                              {formatTime(event.startTime)}–{formatTime(event.endTime)}
                            </span>
                            {(event.candidateName || event.clientName) && (
                              <span className={`text-[11px] truncate ${colors.text}`}>
                                {event.candidateName || event.clientName}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => router.push('/calendar?new=1')}
        className="mt-4 w-full py-2 rounded-lg border border-dashed border-[#1e3a5f] text-[#4a6fa5] hover:text-white hover:border-[#7C3AED]/50 text-xs transition-all"
      >
        + New event
      </button>
    </div>
  );
}

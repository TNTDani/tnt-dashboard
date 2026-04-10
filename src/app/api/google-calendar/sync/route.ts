import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { tokens, pushEvents, since } = await req.json();

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 1. Push local events to Google Calendar (events without a googleCalendarEventId)
    const created: { localId: string; googleId: string }[] = [];
    for (const event of pushEvents ?? []) {
      try {
        const res = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: event.title,
            description: [
              event.candidateName ? `Candidate: ${event.candidateName}` : '',
              event.vacancyTitle ? `Vacancy: ${event.vacancyTitle}` : '',
              event.clientName ? `Client: ${event.clientName}` : '',
              event.notes ?? '',
            ].filter(Boolean).join('\n'),
            location: event.location || undefined,
            start: { dateTime: event.startTime },
            end: { dateTime: event.endTime },
            reminders: event.reminder
              ? { useDefault: false, overrides: [{ method: 'popup', minutes: event.reminder }] }
              : { useDefault: true },
          },
        });
        if (res.data.id) created.push({ localId: event.id, googleId: res.data.id });
      } catch (e) {
        console.error('[calendar/sync] push error:', e);
      }
    }

    // 2. Pull Google Calendar events created/updated since last sync
    const timeMin = since || new Date(Date.now() - 7 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 86400000).toISOString();
    const listRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const googleEvents = (listRes.data.items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => e.status !== 'cancelled' && e.start?.dateTime)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        googleId: e.id!,
        title: e.summary || '(No title)',
        startTime: e.start!.dateTime!,
        endTime: e.end?.dateTime || e.start!.dateTime!,
        location: e.location || null,
        notes: e.description || null,
      }));

    return NextResponse.json({ created, googleEvents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[calendar/sync] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

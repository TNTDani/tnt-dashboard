import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Add GOOGLE_CALENDAR_REDIRECT_URI to your .env.local, e.g.:
// GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3002/api/google-calendar/callback
// Also add this URI to your Google Cloud Console OAuth2 credentials.

export async function GET(req: NextRequest) {
  const loginHint = req.nextUrl.searchParams.get('login_hint') || undefined;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    prompt: 'select_account consent',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });

  return NextResponse.redirect(authUrl);
}

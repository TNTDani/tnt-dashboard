import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const loginHint = req.nextUrl.searchParams.get('login_hint') || undefined;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    prompt: 'select_account consent',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });

  return NextResponse.redirect(authUrl);
}

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3002/api/google-calendar/callback',
  );

  const { tokens } = await oauth2Client.getToken(code);

  const html = `
    <html><body>
    <script>
      localStorage.setItem('tnt_calendar_token', JSON.stringify(${JSON.stringify(tokens)}));
      window.opener?.postMessage({ type: 'calendar_connected' }, '*');
      window.close();
    </script>
    <p>Google Calendar connected! You can close this window.</p>
    </body></html>
  `;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}

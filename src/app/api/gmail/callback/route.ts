import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/gmail/callback'
  );

  const { tokens } = await oauth2Client.getToken(code);

  // Return HTML that saves token to localStorage and closes
  const html = `
    <html><body>
    <script>
      localStorage.setItem('tnt_gmail_token', JSON.stringify(${JSON.stringify(tokens)}));
      window.opener?.postMessage({ type: 'gmail_connected' }, '*');
      window.close();
    </script>
    <p>Connected! You can close this window.</p>
    </body></html>
  `;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}

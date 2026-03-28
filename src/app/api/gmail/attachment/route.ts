import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { tokens, messageId, attachmentId, filename, mimeType } = await req.json();
    if (!tokens) return NextResponse.json({ error: 'No tokens' }, { status: 401 });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = res.data.data;
    if (!data) return NextResponse.json({ error: 'No data' }, { status: 404 });

    const buffer = Buffer.from(data, 'base64url');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err: any) {
    console.error('Gmail attachment error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

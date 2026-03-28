import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// RFC 2047 B-encoding for non-ASCII characters in email headers
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

// Base64 body wrapped at 76 chars per MIME spec
function base64Body(text: string): string {
  const b64 = Buffer.from(text, 'utf-8').toString('base64');
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64;
}

export async function POST(req: NextRequest) {
  try {
    const { tokens, to, subject, body } = await req.json();

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const raw = [
      `From: dani@truenorthtalent.nl`,
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Body(body),
    ].join('\r\n');

    const encoded = Buffer.from(raw).toString('base64url');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Gmail send error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

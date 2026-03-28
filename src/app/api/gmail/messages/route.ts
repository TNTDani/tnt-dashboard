import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function makeOAuth2Client(tokens: object) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials(tokens);
  return client;
}

interface Attachment {
  id: string;          // Gmail attachmentId
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function extractBodyAndAttachments(
  payload: any,
  messageId: string
): { text: string; html: string; attachments: Attachment[] } {
  let text = '';
  let html = '';
  const attachments: Attachment[] = [];

  function walk(part: any) {
    if (!part) return;
    const mime: string = part.mimeType || '';
    const filename: string = part.filename || '';
    const data: string = part.body?.data || '';
    const attachmentId: string = part.body?.attachmentId || '';
    const size: number = part.body?.size || 0;

    if (filename && attachmentId) {
      // It's an attachment
      attachments.push({ id: attachmentId, messageId, filename, mimeType: mime, size });
    } else if (mime === 'text/plain' && data) {
      text = Buffer.from(data, 'base64url').toString('utf-8');
    } else if (mime === 'text/html' && data) {
      html = Buffer.from(data, 'base64url').toString('utf-8');
    }

    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { text, html, attachments };
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// POST /api/gmail/messages
// { tokens, tab }   → list
// { tokens, id }    → full single message
export async function POST(req: NextRequest) {
  try {
    const { tokens, tab, id, pageToken } = await req.json();
    if (!tokens) return NextResponse.json({ error: 'No tokens' }, { status: 401 });

    const auth = makeOAuth2Client(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    // ── Single message ──────────────────────────────────────────────────────
    if (id) {
      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const headers = msg.data.payload?.headers || [];
      const { text, html, attachments } = extractBodyAndAttachments(
        msg.data.payload,
        msg.data.id!
      );

      return NextResponse.json({
        id: msg.data.id,
        threadId: msg.data.threadId,
        labelIds: msg.data.labelIds || [],
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        text,
        html,
        snippet: msg.data.snippet || '',
        attachments,
      });
    }

    // ── Message list ────────────────────────────────────────────────────────
    const queryMap: Record<string, string> = {
      inbox: 'in:inbox',
      sent: 'in:sent',
      starred: 'is:starred',
    };
    const q = queryMap[tab || 'inbox'] || 'in:inbox';

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 25,
      ...(pageToken ? { pageToken } : {}),
    });

    const messageIds = listRes.data.messages || [];
    if (messageIds.length === 0) {
      return NextResponse.json({ messages: [], nextPageToken: null });
    }

    const metaResults = await Promise.all(
      messageIds.map((m: any) =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        })
      )
    );

    const messages = metaResults.map((res: any) => {
      const headers = res.data.payload?.headers || [];
      return {
        id: res.data.id,
        threadId: res.data.threadId,
        labelIds: res.data.labelIds || [],
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        snippet: res.data.snippet || '',
        unread: (res.data.labelIds || []).includes('UNREAD'),
      };
    });

    return NextResponse.json({ messages, nextPageToken: listRes.data.nextPageToken || null });
  } catch (err: any) {
    console.error('Gmail messages error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

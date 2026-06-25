// src/lib/mailer.ts
// Thin Resend wrapper for transactional emails.

import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendInviteEmail({
  to,
  agencyName,
  inviteCode,
  invitedBy,
  expiresAt,
}: {
  to: string;
  agencyName: string;
  inviteCode: string;
  invitedBy: string;
  expiresAt: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.orchard.works';
  const registerUrl = `${appUrl}/register`;
  const expires = new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  await getResend().emails.send({
    from: 'Orchard <noreply@orchard.works>',
    to,
    subject: `${invitedBy} invited you to join ${agencyName} on Orchard`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#0f1711;">
        <div style="margin-bottom:32px;">
          <span style="font-size:22px;font-weight:700;color:#2D4A2D;">Orchard</span>
        </div>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">You&apos;ve been invited</h1>
        <p style="font-size:15px;color:#5a6a60;margin:0 0 24px;">
          <strong>${invitedBy}</strong> has invited you to join <strong>${agencyName}</strong> on Orchard.
        </p>
        <div style="background:#f8faf8;border:1px solid #e0e8e0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <p style="font-size:12px;color:#8a9a90;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Your invite code</p>
          <code style="font-size:18px;font-family:monospace;letter-spacing:0.05em;color:#0f1711;">${inviteCode}</code>
          <p style="font-size:12px;color:#8a9a90;margin:8px 0 0;">Expires ${expires}</p>
        </div>
        <a href="${registerUrl}" style="display:inline-block;background:#2D4A2D;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Create your account →
        </a>
        <p style="font-size:12px;color:#aab8b0;margin-top:32px;">
          Go to <a href="${registerUrl}" style="color:#5a6a60;">${registerUrl}</a> and enter the invite code above to join your team.
        </p>
      </div>
    `,
  });
}

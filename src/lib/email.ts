// src/lib/email.ts
// Resend wrapper for transactional emails.
// All outbound mail goes through Resend — never through Workspace SMTP.

import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendInvite({
  to,
  inviteUrl,
  agencyName,
  inviterName,
}: {
  to: string;
  inviteUrl: string;
  agencyName: string;
  inviterName: string;
}): Promise<void> {
  // Extract the invite code from the URL for display (last segment after '=').
  const code = new URL(inviteUrl).searchParams.get('code') ?? inviteUrl;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;">
          <span style="font-size:22px;font-weight:700;color:#2D4A2D;letter-spacing:-0.3px;">Orchard</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;border:1px solid rgba(20,33,26,0.08);padding:36px 36px 32px;">

          <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#0f1711;">You&apos;ve been invited</p>
          <p style="margin:0 0 28px;font-size:15px;color:#5a6a60;line-height:1.6;">
            <strong style="color:#0f1711;">${inviterName}</strong> invited you to join
            <strong style="color:#0f1711;">${agencyName}</strong> on Orchard.
          </p>

          <!-- Code block -->
          <div style="background:#f4f7f4;border:1px solid rgba(45,74,45,0.15);border-radius:10px;padding:18px 22px;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#8a9a90;">Your invite code</p>
            <code style="font-size:17px;font-family:monospace;letter-spacing:0.04em;color:#0f1711;word-break:break-all;">${code}</code>
          </div>

          <!-- CTA -->
          <a href="${inviteUrl}"
             style="display:inline-block;background:#2D4A2D;color:#ffffff;font-size:14px;font-weight:600;
                    padding:13px 26px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
            Accept invitation →
          </a>

          <p style="margin:24px 0 0;font-size:12px;color:#aab8b0;line-height:1.6;">
            Or copy this link into your browser:<br>
            <a href="${inviteUrl}" style="color:#5a6a60;word-break:break-all;">${inviteUrl}</a>
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;font-size:11px;color:#aab8b0;text-align:center;">
          © 2026 Orchard · Built in Amsterdam
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${inviterName} invited you to join ${agencyName} on Orchard.\n\nYour invite code: ${code}\n\nAccept the invitation at:\n${inviteUrl}\n\n© 2026 Orchard`;

  await getResend().emails.send({
    from: 'Orchard <invites@orchard.works>',
    to,
    subject: `${inviterName} invited you to join ${agencyName} on Orchard`,
    html,
    text,
  });
}

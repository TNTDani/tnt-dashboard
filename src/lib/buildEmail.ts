/**
 * Shared HTML email builder — used by both API routes (server) and
 * EmailComposer preview (client). Pure string operations, no Node APIs.
 */

const COMPASS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" style="display:block;">
  <circle cx="22" cy="22" r="21" fill="#0d1b2a"/>
  <circle cx="22" cy="22" r="21" fill="none" stroke="#7C3AED" stroke-width="1.5"/>
  <path d="M22 7 L25.5 22 L22 19.5 L18.5 22 Z" fill="#7C3AED"/>
  <path d="M22 37 L18.5 22 L22 24.5 L25.5 22 Z" fill="#334155"/>
  <line x1="5" y1="22" x2="8" y2="22" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36" y1="22" x2="39" y2="22" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="22" cy="22" r="2.5" fill="white" opacity="0.9"/>
</svg>`;

/** Convert a plain-text email body to HTML paragraphs. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\n\n+/)
    .map(block => {
      const lines = block.replace(/\n/g, '<br>');
      return `<p style="margin:0 0 18px 0;">${lines}</p>`;
    })
    .join('');
}

/** Build the full HTML email from a plain-text body. */
export function buildHtmlEmail(plainBody: string): string {
  const htmlBody = textToHtml(plainBody);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Top accent bar -->
          <tr>
            <td style="background:#7C3AED;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 28px 48px;">
              <div style="color:#1a2b3c;font-size:15px;line-height:1.8;">
                ${htmlBody}
              </div>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 48px 40px 48px;">
              <div style="border-top:2px solid #7C3AED;margin-bottom:20px;opacity:0.35;"></div>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    ${COMPASS_SVG}
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-weight:700;color:#0d1b2a;font-size:15px;letter-spacing:-0.2px;line-height:1.2;">Dani Leeflang</div>
                    <div style="color:#64748b;font-size:13px;margin-top:4px;">Founder &middot; TrueNorth Talent</div>
                    <div style="margin-top:10px;">
                      <a href="mailto:dani@truenorthtalent.nl" style="color:#7C3AED;text-decoration:none;font-size:13px;">dani@truenorthtalent.nl</a>
                    </div>
                    <div style="color:#64748b;font-size:13px;margin-top:4px;">+31 6 40 20 99 66</div>
                    <div style="color:#94a3b8;font-size:12px;margin-top:4px;">truenorthtalent.nl <span style="color:#d1d5db;font-size:11px;">(coming soon)</span></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

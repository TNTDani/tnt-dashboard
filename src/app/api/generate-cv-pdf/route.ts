import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, degrees, PDFFont, PDFPage } from "pdf-lib";
import { ProcessedCV } from "@/lib/types";

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  purple:    rgb(0.486, 0.227, 0.929),  // #2D4A2D
  purpleDk:  rgb(0.380, 0.150, 0.780),  // darker purple for header bg
  navy:      rgb(0.051, 0.122, 0.235),  // #FFFFFF
  navyDeep:  rgb(0.051, 0.106, 0.165),  // #EDEDEB sidebar bg
  white:     rgb(1,     1,     1    ),
  lavender:  rgb(0.655, 0.545, 0.980),  // #a78bfa
  darkText:  rgb(0.067, 0.094, 0.153),  // #111827
  bodyText:  rgb(0.216, 0.255, 0.318),  // #374151
  midGray:   rgb(0.400, 0.440, 0.490),  // #6B7280
  lightGray: rgb(0.612, 0.639, 0.686),  // #9ca3af
  sideText:  rgb(0.796, 0.835, 0.882),  // #cbd5e1
  sideDim:   rgb(0.490, 0.550, 0.620),  // muted grey for "presented by"
  skillBg:   rgb(0.082, 0.180, 0.325),  // skill tag background
  divider:   rgb(0.118, 0.259, 0.435),  // rgba(45,74,45,0.15)
  mainBg:    rgb(1,     1,     1    ),  // white main content background
};

// ─── Layout constants ─────────────────────────────────────────────────────────
const PW = 595, PH = 842;   // A4 points
const HEAD_H = 60;           // header bar height
const FOOT_H = 28;           // footer bar height
const SB_W   = 178;          // sidebar width (~30%)
const SB_PL  = 18;           // sidebar left padding
const SB_PR  = 14;           // sidebar right padding
const SB_CW  = SB_W - SB_PL - SB_PR; // 146 — usable sidebar width
const MAIN_X = SB_W + 4;    // main col left x (p1)
const MAIN_R = PW - 22;     // main col right x
const MAIN_W = MAIN_R - MAIN_X; // ~391
const BODY_TOP = PH - HEAD_H;  // 782
const BODY_BOT = FOOT_H;       // 28

// ─── Word-wrap ────────────────────────────────────────────────────────────────
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = (text || "").split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(test, size) > maxW) {
      lines.push(cur); cur = w;
    } else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { cv }: { cv: ProcessedCV } = await req.json();

    const doc = await PDFDocument.create();
    const B = await doc.embedFont(StandardFonts.HelveticaBold);
    const R = await doc.embedFont(StandardFonts.Helvetica);
    const I = await doc.embedFont(StandardFonts.HelveticaOblique);

    // State
    let page!: PDFPage;
    let mainY  = 0;
    let sideY  = 0;
    let onP1   = true;
    let pageN  = 0;
    let fDone  = false;

    // ── Compass mark ─────────────────────────────────────────────────────────
    const drawCompass = (cx: number, cy: number, r: number, color = C.white) => {
      const s = r / 15.5;
      page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderColor: color, borderWidth: 1.3 });
      page.drawSvgPath("M17 4 L19.5 17 L17 14.5 L14.5 17 Z", {
        x: cx - 17 * s, y: cy + 17 * s, scale: s, color,
      });
    };

    // ── Watermark ─────────────────────────────────────────────────────────────
    const drawWatermark = () => {
      const wt = "CONFIDENTIAL";
      page.drawText(wt, {
        x: 110, y: 320, size: 52, font: B,
        color: C.purple, opacity: 0.03,
        rotate: degrees(45),
      });
    };

    // ── Footer ────────────────────────────────────────────────────────────────
    const doFooter = () => {
      if (fDone) return;
      fDone = true;
      page.drawRectangle({ x: 0, y: 0, width: PW, height: FOOT_H, color: C.navyDeep });
      const txt = "Orchard  ·  Confidential  ·  Not to be shared without written consent";
      const tw  = R.widthOfTextAtSize(txt, 7.5);
      page.drawText(txt, { x: (PW - tw) / 2, y: 8.5, size: 7.5, font: R, color: C.sideDim });
      if (pageN > 1) {
        const pn = `Page ${pageN}`;
        const pnW = R.widthOfTextAtSize(pn, 7.5);
        page.drawText(pn, { x: MAIN_R - pnW, y: 8.5, size: 7.5, font: R, color: C.divider });
      }
    };

    // ── Header ────────────────────────────────────────────────────────────────
    const doHeader = () => {
      // Full-width purple bar
      page.drawRectangle({ x: 0, y: BODY_TOP, width: PW, height: HEAD_H, color: C.purple });

      // Compass logo — left side
      const logoX = 26, logoY = BODY_TOP + HEAD_H / 2;
      drawCompass(logoX, logoY, 13);

      // "TRUENORTH TALENT" bold white, left
      page.drawText("TRUENORTH TALENT", {
        x: 48, y: BODY_TOP + HEAD_H / 2 + 4,
        size: 11, font: B, color: C.white,
      });

      // Tagline below brand name
      page.drawText("Specialist Tech, Product & Design Recruitment", {
        x: 48, y: BODY_TOP + HEAD_H / 2 - 9,
        size: 7.5, font: I, color: rgb(1, 1, 1),
        opacity: 0.78,
      });

      // Thin right-side separator accent
      page.drawLine({
        start: { x: PW - 200, y: BODY_TOP + 10 },
        end:   { x: PW - 200, y: PH - 10 },
        thickness: 0.5, color: rgb(1, 1, 1), opacity: 0.18,
      });
    };

    // ── New page ──────────────────────────────────────────────────────────────
    const newPage = () => {
      if (page) doFooter();
      pageN++;
      fDone = false;
      page  = doc.addPage([PW, PH]);
      drawWatermark();
      doHeader();

      if (pageN === 1) {
        onP1 = true;

        // Sidebar navy background
        page.drawRectangle({
          x: 0, y: BODY_BOT, width: SB_W, height: BODY_TOP - BODY_BOT,
          color: C.navyDeep,
        });

        // Sidebar right accent strip
        page.drawRectangle({
          x: SB_W, y: BODY_BOT, width: 2, height: BODY_TOP - BODY_BOT,
          color: C.divider,
        });

        // Main content white background
        page.drawRectangle({
          x: SB_W + 2, y: BODY_BOT, width: PW - SB_W - 2, height: BODY_TOP - BODY_BOT,
          color: C.mainBg,
        });

        sideY = BODY_TOP - 18;
        mainY = BODY_TOP - 18;

        // ── Sidebar top: logo + name + title + presented by ──────────────────
        // Compass (centered in sidebar)
        drawCompass(SB_W / 2, sideY - 10, 11, C.lavender);
        sideY -= 30;

        // Candidate name — large bold white
        const nameLines = wrap(cv.firstName || "Candidate", B, 20, SB_CW);
        for (const ln of nameLines) {
          if (sideY < BODY_BOT + 20) break;
          const lw = B.widthOfTextAtSize(ln, 20);
          page.drawText(ln, {
            x: SB_PL + Math.max(0, (SB_CW - lw) / 2),
            y: sideY, size: 20, font: B, color: C.white,
          });
          sideY -= 24;
        }
        sideY -= 2;

        // Current role — purple italic
        if (cv.currentRole) {
          const roleLines = wrap(cv.currentRole, I, 10, SB_CW);
          for (const ln of roleLines) {
            if (sideY < BODY_BOT + 14) break;
            const lw = I.widthOfTextAtSize(ln, 10);
            page.drawText(ln, {
              x: SB_PL + Math.max(0, (SB_CW - lw) / 2),
              y: sideY, size: 10, font: I, color: C.lavender,
            });
            sideY -= 14;
          }
        }

        // Current company — muted grey
        if (cv.currentCompany) {
          const coLines = wrap(cv.currentCompany, R, 8.5, SB_CW);
          for (const ln of coLines) {
            if (sideY < BODY_BOT + 12) break;
            const lw = R.widthOfTextAtSize(ln, 8.5);
            page.drawText(ln, {
              x: SB_PL + Math.max(0, (SB_CW - lw) / 2),
              y: sideY, size: 8.5, font: R, color: C.sideDim,
            });
            sideY -= 12;
          }
        }

        sideY -= 6;

        // "Presented by Orchard" — small grey italic
        const pby = "Presented by Orchard";
        const pbyW = I.widthOfTextAtSize(pby, 7.5);
        page.drawText(pby, {
          x: SB_PL + Math.max(0, (SB_CW - pbyW) / 2),
          y: sideY, size: 7.5, font: I, color: C.sideDim,
        });
        sideY -= 14;

        // Divider
        page.drawLine({
          start: { x: SB_PL, y: sideY }, end: { x: SB_W - SB_PR, y: sideY },
          thickness: 0.5, color: C.divider,
        });
        sideY -= 14;

      } else {
        onP1 = false;
        page.drawLine({
          start: { x: 40, y: BODY_TOP - 6 }, end: { x: MAIN_R, y: BODY_TOP - 6 },
          thickness: 0.5, color: C.divider,
        });
        mainY = BODY_TOP - 20;
      }
    };

    // ── Ensure space in main col ──────────────────────────────────────────────
    const ensureMain = (needed: number) => {
      if (mainY - needed < BODY_BOT + 14) newPage();
    };

    // ── Draw text in main col ─────────────────────────────────────────────────
    const SAFE_W = MAIN_W;
    const mText = (
      text: string, size: number, font: PDFFont,
      color: ReturnType<typeof rgb>, gap = 4.5, indent = 0,
    ) => {
      const lines = wrap(text, font, size, SAFE_W - indent - 6);
      for (const ln of lines) {
        ensureMain(size + gap);
        const x = (onP1 ? MAIN_X : 40) + indent;
        page.drawText(ln, { x, y: mainY, size, font, color });
        mainY -= size + gap;
      }
    };

    // ── Main section heading ──────────────────────────────────────────────────
    const mSection = (label: string) => {
      ensureMain(36);
      mainY -= 10;
      const x     = onP1 ? MAIN_X : 40;
      const ruleW  = onP1 ? MAIN_W : PW - 40 - 22;

      // Purple section label
      page.drawText(label.toUpperCase(), {
        x, y: mainY, size: 9.5, font: B, color: C.purple,
      });
      mainY -= 8;

      // Purple underline
      page.drawLine({
        start: { x, y: mainY }, end: { x: x + ruleW, y: mainY },
        thickness: 1.5, color: C.purple,
      });
      mainY -= 12;
    };

    // ── Sidebar section heading ────────────────────────────────────────────────
    const sSection = (label: string) => {
      if (sideY - 24 < BODY_BOT + 8) return;
      sideY -= 10;
      page.drawText(label.toUpperCase(), {
        x: SB_PL, y: sideY, size: 8, font: B, color: C.sideText,
      });
      sideY -= 6;
      page.drawLine({
        start: { x: SB_PL, y: sideY },
        end: { x: SB_W - SB_PR, y: sideY },
        thickness: 0.4, color: C.divider,
      });
      sideY -= 10;
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  BUILD DOCUMENT
    // ─────────────────────────────────────────────────────────────────────────
    newPage();

    // ════════════════════════════════════════════════════════════════════════
    //  SIDEBAR — Skills, Education, Languages
    // ════════════════════════════════════════════════════════════════════════

    // ── Key Skills ────────────────────────────────────────────────────────────
    if (cv.skills?.length) {
      sSection("Key Skills");

      const TAG_H   = 16;
      const TAG_PAD = 5;
      const TAG_GAPX = 3;
      const TAG_GAPY = 4;
      const TAG_MAXR = SB_W - SB_PR;

      let tagX = SB_PL;
      let rowY  = sideY;

      for (const skill of cv.skills) {
        const tw   = R.widthOfTextAtSize(skill, 7.5);
        const tagW = tw + TAG_PAD * 2;

        if (tagX + tagW > TAG_MAXR) {
          tagX = SB_PL;
          rowY -= TAG_H + TAG_GAPY;
          if (rowY - TAG_H < BODY_BOT + 8) break;
        }

        // Pill background
        page.drawRectangle({
          x: tagX, y: rowY - TAG_H + 5,
          width: tagW, height: TAG_H - 4,
          color: C.skillBg,
        });

        // Pill text
        page.drawText(skill, {
          x: tagX + TAG_PAD, y: rowY - TAG_H + 9,
          size: 7.5, font: R, color: C.sideText,
        });

        tagX += tagW + TAG_GAPX;
      }

      sideY = rowY - TAG_H - 10;
    }

    // ── Education ─────────────────────────────────────────────────────────────
    if (cv.education?.length) {
      sSection("Education");

      for (const edu of cv.education) {
        if (sideY < BODY_BOT + 38) break;

        const degLines = wrap(edu.degree || "", B, 8.5, SB_CW);
        for (const ln of degLines) {
          if (sideY < BODY_BOT + 10) break;
          page.drawText(ln, { x: SB_PL, y: sideY, size: 8.5, font: B, color: C.white });
          sideY -= 12;
        }

        const instLines = wrap(edu.institution || "", R, 8, SB_CW);
        for (const ln of instLines) {
          if (sideY < BODY_BOT + 10) break;
          page.drawText(ln, { x: SB_PL, y: sideY, size: 8, font: R, color: C.sideText });
          sideY -= 11;
        }

        if (edu.year) {
          page.drawText(edu.year, { x: SB_PL, y: sideY, size: 7.5, font: I, color: C.sideDim });
          sideY -= 9;
        }
        sideY -= 8;
      }
    }

    // ── Languages ─────────────────────────────────────────────────────────────
    if (cv.languages?.length) {
      sSection("Languages");
      for (const lang of cv.languages) {
        if (sideY < BODY_BOT + 18) break;
        // Bullet dot
        page.drawEllipse({
          x: SB_PL + 3, y: sideY - 1.5, xScale: 2.2, yScale: 2.2, color: C.lavender,
        });
        page.drawText(lang, { x: SB_PL + 11, y: sideY - 4, size: 8.5, font: R, color: C.sideText });
        sideY -= 14;
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MAIN CONTENT — Summary, Experience, Certifications
    // ════════════════════════════════════════════════════════════════════════

    // ── Professional Summary ──────────────────────────────────────────────────
    mSection("Professional Summary");
    mText(cv.professionalSummary || "", 9.5, R, C.bodyText, 5);
    mainY -= 8;

    // ── Professional Experience ───────────────────────────────────────────────
    if (cv.experience?.length) {
      mSection("Professional Experience");

      for (const exp of cv.experience) {
        ensureMain(56);
        mainY -= 2;

        const x    = onP1 ? MAIN_X : 40;
        const colW = onP1 ? MAIN_W : PW - 40 - 22;

        // Role band (light purple tint)
        const BAND_H = 26;
        page.drawRectangle({
          x, y: mainY - BAND_H + 4,
          width: colW, height: BAND_H,
          color: rgb(0.973, 0.961, 1.0),
        });

        // Purple left accent stripe
        page.drawRectangle({
          x, y: mainY - BAND_H + 4,
          width: 3, height: BAND_H,
          color: C.purple,
        });

        // Company name — bold dark (spec: company name bold)
        const compStr = exp.company || "";
        const compW = B.widthOfTextAtSize(compStr, 10.5);
        page.drawText(compStr, { x: x + 10, y: mainY - 3, size: 10.5, font: B, color: C.darkText });

        // Job title — purple (spec: job title in purple)
        if (exp.title) {
          const titleStr = `  ·  ${exp.title}`;
          const titleX   = x + 10 + compW;
          if (titleX + I.widthOfTextAtSize(titleStr, 9.5) < x + colW - 8) {
            page.drawText(titleStr, { x: titleX, y: mainY - 3, size: 9.5, font: I, color: C.purple });
          } else {
            // Job title on second line
            const tLines = wrap(exp.title, I, 9.5, colW - 14);
            page.drawText(tLines[0] || "", { x: x + 10, y: mainY - BAND_H + 8, size: 9.5, font: I, color: C.purple });
          }
        }

        // Date range — right-aligned, grey
        const dateStr = `${exp.startDate || ""}  –  ${exp.endDate || ""}`;
        const dateW   = I.widthOfTextAtSize(dateStr, 8);
        page.drawText(dateStr, {
          x: x + colW - 6 - dateW,
          y: mainY - BAND_H + 8,
          size: 8, font: I, color: C.midGray,
        });

        mainY -= BAND_H + 8;

        // Bullet responsibilities
        for (const r of (exp.responsibilities || [])) {
          const bLines = wrap(r, R, 9, SAFE_W - 16);
          for (let i = 0; i < bLines.length; i++) {
            ensureMain(9 + 3.5);
            const bx = onP1 ? MAIN_X : 40;
            if (i === 0) {
              page.drawEllipse({
                x: bx + 4.5, y: mainY + 4,
                xScale: 2.2, yScale: 2.2, color: C.purple,
              });
            }
            page.drawText(bLines[i], { x: bx + 13, y: mainY, size: 9, font: R, color: C.bodyText });
            mainY -= 9 + 3.5;
          }
        }
        mainY -= 8;
      }
    }

    // ── Certifications (main content) ─────────────────────────────────────────
    if (cv.certifications?.length) {
      mSection("Certifications");
      for (const cert of cv.certifications) {
        const cLines = wrap(cert, R, 9.5, SAFE_W - 14);
        for (let i = 0; i < cLines.length; i++) {
          ensureMain(9.5 + 3);
          const bx = onP1 ? MAIN_X : 40;
          if (i === 0) {
            page.drawEllipse({
              x: bx + 4.5, y: mainY + 4,
              xScale: 2.2, yScale: 2.2, color: C.purple,
            });
          }
          page.drawText(cLines[i], { x: bx + 13, y: mainY, size: 9.5, font: R, color: C.bodyText });
          mainY -= 9.5 + 3;
        }
        mainY -= 2;
      }
    }

    // Final footer
    doFooter();

    const pdfBytes = await doc.save();

    return new NextResponse(pdfBytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TNT_${cv.firstName || "CV"}_CV.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

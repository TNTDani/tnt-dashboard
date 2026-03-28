import { NextRequest, NextResponse } from "next/server";
import { ProcessedCV } from "@/lib/types";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, ShadingType, UnderlineType,
  Table, WidthType,
} from "docx";

// UnderlineType and Table/WidthType are imported to satisfy potential type usage;
// they are not directly referenced in JSX but kept for completeness.
void UnderlineType;
void Table;
void WidthType;

export async function POST(req: NextRequest) {
  try {
    const { cv }: { cv: ProcessedCV } = await req.json();

    const PURPLE = "7C3AED";
    const NAVY = "0a1628";
    const WHITE = "FFFFFF";

    const heading = (text: string) =>
      new Paragraph({
        spacing: { before: 280, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PURPLE, space: 4 } },
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            color: PURPLE,
            size: 22,
            font: "Calibri",
          }),
        ],
      });

    const bullet = (text: string) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text, size: 20, font: "Calibri", color: "374151" })],
      });

    const children: Paragraph[] = [
      // Purple header bar
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: PURPLE, fill: PURPLE },
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: "TRUE NORTH TALENT",
            bold: true,
            color: WHITE,
            size: 28,
            font: "Calibri",
          }),
        ],
      }),
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: "Specialist Tech & Management Recruitment",
            color: "a78bfa",
            size: 18,
            font: "Calibri",
            italics: true,
          }),
        ],
      }),

      // Spacer
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun("")] }),

      // Candidate name
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: cv.firstName, bold: true, size: 52, font: "Calibri", color: "111827" }),
        ],
      }),

      // Current role
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: cv.currentRole, size: 26, color: "6b7280", font: "Calibri", italics: true }),
          ...(cv.currentCompany ? [new TextRun({ text: `  ·  ${cv.currentCompany}`, size: 26, color: "9ca3af", font: "Calibri" })] : []),
        ],
      }),

      // "Presented by" note
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.SOLID, color: "f5f3ff", fill: "f5f3ff" },
        spacing: { before: 120, after: 200 },
        children: [
          new TextRun({
            text: "Presented exclusively by True North Talent | Confidential",
            size: 17,
            color: PURPLE,
            font: "Calibri",
            italics: true,
          }),
        ],
      }),

      // Professional Summary
      heading("Professional Summary"),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: cv.professionalSummary, size: 21, font: "Calibri", color: "374151" })],
      }),

      // Experience
      heading("Professional Experience"),
      ...cv.experience.flatMap((exp) => [
        new Paragraph({
          spacing: { before: 160, after: 40 },
          children: [
            new TextRun({ text: exp.title, bold: true, size: 22, font: "Calibri", color: "111827" }),
            new TextRun({ text: `  ·  ${exp.company}`, size: 22, font: "Calibri", color: "4b5563" }),
          ],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${exp.startDate} – ${exp.endDate}`, size: 19, color: "9ca3af", font: "Calibri", italics: true }),
          ],
        }),
        ...exp.responsibilities.map((r) => bullet(r)),
      ]),

      // Education
      heading("Education"),
      ...cv.education.map((edu) =>
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: edu.degree, bold: true, size: 21, font: "Calibri", color: "111827" }),
            new TextRun({ text: `  ·  ${edu.institution}`, size: 21, font: "Calibri", color: "4b5563" }),
            new TextRun({ text: `  ·  ${edu.year}`, size: 19, font: "Calibri", color: "9ca3af", italics: true }),
          ],
        })
      ),

      // Skills
      heading("Key Skills"),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: cv.skills.join("  ·  "), size: 20, font: "Calibri", color: "374151" }),
        ],
      }),

      // Certifications
      ...(cv.certifications.length > 0
        ? [heading("Certifications"), ...cv.certifications.map((c) => bullet(c))]
        : []),

      // Languages
      ...(cv.languages.length > 0
        ? [
            heading("Languages"),
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: cv.languages.join("  ·  "), size: 20, font: "Calibri", color: "374151" })],
            }),
          ]
        : []),

      // Footer
      new Paragraph({ spacing: { before: 400 }, children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.SOLID, color: PURPLE, fill: PURPLE },
        children: [
          new TextRun({
            text: "TRUE NORTH TALENT  ·  Confidential  ·  Not to be shared without consent",
            color: WHITE, size: 16, font: "Calibri",
          }),
        ],
      }),
    ];

    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="TNT_${cv.firstName}_CV.docx"`,
      },
    });
  } catch (err) {
    console.error("DOCX generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

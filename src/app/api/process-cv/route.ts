import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, FAST_MODEL } from "@/lib/anthropic";
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';

const EXTRACT_PROMPT = `You are an expert CV analyst for Orchard, a specialist tech recruitment firm.

Extract ALL information from this CV and return it as valid JSON.

CRITICAL RULES:
1. Remove ALL contact information: email addresses, phone numbers, home addresses, LinkedIn URLs, GitHub URLs, personal websites, portfolio links
2. Keep ONLY the candidate's FIRST NAME (not surname, not full name)
3. Do not include any identifying information beyond first name

Return ONLY this JSON structure (no markdown, no explanation):
{
  "firstName": "string (first name only)",
  "currentRole": "string (most recent job title)",
  "currentCompany": "string (most recent employer)",
  "professionalSummary": "string (2-3 sentence professional summary, written in third person)",
  "experience": [
    {
      "title": "string",
      "company": "string",
      "startDate": "string (e.g. Jan 2022)",
      "endDate": "string (e.g. Present or Mar 2024)",
      "responsibilities": ["string (concise bullet point)"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "string"
    }
  ],
  "skills": ["string"],
  "languages": ["string"],
  "certifications": ["string"]
}`;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    if ((await getBalance(agencyId)) < CREDIT_COST.cv_parse) {
      return NextResponse.json(
        { error: `Insufficient credits. This action costs ${CREDIT_COST.cv_parse} credits.` },
        { status: 402 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");

    let messages: Anthropic.MessageParam[];

    if (isPDF) {
      const base64 = buffer.toString("base64");
      messages = [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as Anthropic.DocumentBlockParam,
          { type: "text", text: EXTRACT_PROMPT },
        ],
      }];
    } else {
      // Word doc — extract text with mammoth
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      messages = [{
        role: "user",
        content: `${EXTRACT_PROMPT}\n\nCV TEXT:\n${result.value}`,
      }];
    }

    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 4096,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip any markdown code fences if present
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const data = JSON.parse(clean);

    await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'cv_parse',
      model: FAST_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("CV processing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

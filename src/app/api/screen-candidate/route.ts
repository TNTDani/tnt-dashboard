import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Vacancy, ProcessedCV } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { cv, vacancy }: { cv: ProcessedCV; vacancy: Vacancy } = await req.json();

    const prompt = `You are a senior recruiter at True North Talent. Score this candidate against the vacancy below.

VACANCY:
Title: ${vacancy.title}
Company: ${vacancy.company}
Seniority: ${vacancy.seniorityLevel}
Requirements: ${vacancy.requirements.join(", ")}
Description: ${vacancy.description}

CANDIDATE:
Name: ${cv.firstName}
Current Role: ${cv.currentRole} at ${cv.currentCompany}
Summary: ${cv.professionalSummary}
Skills: ${cv.skills.join(", ")}
Experience: ${cv.experience.map(e => `${e.title} at ${e.company} (${e.startDate} - ${e.endDate})`).join("; ")}
Education: ${cv.education.map(e => `${e.degree}, ${e.institution}`).join("; ")}

Respond ONLY with valid JSON (no markdown):
{
  "score": <integer 1-10>,
  "summary": "<2-3 sentence recruiter summary of candidate fit>",
  "strengths": ["<strength>", "<strength>", "<strength>"],
  "gaps": ["<gap or concern>"],
  "flag": "<green|amber|red>"
}

Scoring guide:
- 8-10 → green (strong match)
- 5-7  → amber (partial match, worth a conversation)
- 1-4  → red (poor match)`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Screening error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

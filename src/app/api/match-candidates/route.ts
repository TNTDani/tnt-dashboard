import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Vacancy, CandidateProfile } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CandidateMatch {
  candidateId: string;
  score: number;          // 0–100
  flag: "green" | "amber" | "red";
  headline: string;       // 1 sentence summary
  strengths: string[];    // 2–3 bullet points
  concerns: string[];     // 0–2 bullet points
}

export async function POST(req: NextRequest) {
  try {
    const {
      vacancy,
      candidates,
    }: { vacancy: Vacancy; candidates: CandidateProfile[] } = await req.json();

    if (!vacancy || !candidates?.length) {
      return NextResponse.json({ error: "Missing vacancy or candidates" }, { status: 400 });
    }

    // Limit to 30 candidates per batch to keep the prompt manageable
    const batch = candidates.slice(0, 30);

    const candidateLines = batch.map((c, i) =>
      `${i + 1}. ID="${c.id}" | Name: ${c.firstName} ${c.lastName} | Title: ${c.jobTitle} | Branch: ${c.branch} | Location: ${c.location} | Salary expectation: ${c.salaryExpectation ? `€${c.salaryExpectation.toLocaleString()}` : "not specified"} | Status: ${c.status} | Notes: ${c.notes?.slice(0, 200) || "none"}`
    ).join("\n");

    const salaryRange = vacancy.salaryMin || vacancy.salaryMax
      ? `${vacancy.currency} ${vacancy.salaryMin.toLocaleString()}–${vacancy.salaryMax.toLocaleString()}`
      : "not specified";

    const prompt = `You are a senior recruitment consultant scoring candidate-vacancy fit.

VACANCY:
- Role: ${vacancy.title} at ${vacancy.company}
- Seniority: ${vacancy.seniorityLevel}
- Salary range: ${salaryRange}
- Requirements: ${vacancy.requirements.join("; ")}
- Description: ${vacancy.description || "N/A"}

CANDIDATES (${batch.length} total):
${candidateLines}

For each candidate, return a JSON object with:
- candidateId: the exact ID string from the data
- score: integer 0–100 (fit score)
- flag: "green" (70+), "amber" (40–69), or "red" (<40)
- headline: one sentence explaining the fit or mismatch
- strengths: array of 2–3 short phrases about why they might work
- concerns: array of 0–2 short phrases about potential gaps

Return ONLY a valid JSON array. No markdown, no explanations:
[{ "candidateId": "...", "score": 85, "flag": "green", "headline": "...", "strengths": ["..."], "concerns": ["..."] }, ...]

Score calibration:
- 80–100: Strong match, most requirements align
- 60–79: Good candidate, minor gaps
- 40–59: Possible fit, significant gaps or uncertainties
- 0–39: Poor fit, key requirements missing`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const clean = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const matches: CandidateMatch[] = JSON.parse(clean);

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return NextResponse.json({ matches });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("match-candidates error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { Vacancy, ProcessedCV } from "@/lib/types";
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    if ((await getBalance(agencyId)) < CREDIT_COST.screen) {
      return NextResponse.json(
        { error: `Insufficient credits. This action costs ${CREDIT_COST.screen} credits.` },
        { status: 402 },
      );
    }

    const { cv, vacancy }: { cv: ProcessedCV; vacancy: Vacancy } = await req.json();

    const prompt = `You are a senior recruiter at Orchard. Score this candidate against the vacancy below.

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
  "score": <number 1-10, one decimal place allowed e.g. 7.5>,
  "scoreReason": "<one concise sentence explaining the score, e.g. 'Strong match — minor gap in years of experience only'>",
  "summary": "<2-3 sentence recruiter summary of candidate fit>",
  "strengths": ["<strength>", "<strength>", "<strength>"],
  "gaps": ["<gap or concern>"],
  "flag": "<green|amber|red>"
}

SCORING RULES — follow these precisely:

1. Start at 10 and subtract points for gaps:
   - Missing a must-have technical skill or required qualification: −2 to −3 per gap
   - Experience slightly under requirement (e.g. 2 yrs vs 3 yrs required): −0.5
   - Missing a nice-to-have: −0.5 or less
   - Completely wrong domain or level: −3 to −4

2. Transferable skills and adjacent experience count positively — do not penalise for skills the candidate has that are equivalent or closely related to the requirement.

3. Calibration benchmarks:
   - Candidate meets ~90%+ of requirements → 8–9
   - Candidate meets ~75% of requirements → 7–7.5
   - Candidate meets ~60% of requirements → 5.5–6.5
   - Candidate meets ~40% of requirements → 4–5
   - Poor fit, wrong domain or level → below 4

4. Flag assignment:
   - 9–10 → green  (Strong Match)
   - 7–8.9 → green (Good Match — still green, worth a strong push)
   - 5–6.9 → amber (Potential Match)
   - below 5 → red (Weak Match)

5. Never score below 5 unless there are multiple must-have gaps or a clear level/domain mismatch. Minor experience shortfalls alone should not drop a score below 6.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(clean);

    await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'screen',
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Screening error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

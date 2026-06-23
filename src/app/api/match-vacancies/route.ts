import { NextRequest, NextResponse } from "next/server";
import { anthropic, FAST_MODEL } from "@/lib/anthropic";
import { VacancyListing } from "@/lib/types";
import { requireCaller } from '@/lib/apiAuth';
import { getBalance, chargeCredits, CREDIT_COST } from '@/lib/credits';

interface CandidateInput {
  jobTitle: string;
  skills: string[];
  location: string;
  salaryExpectation?: number;
  branch: string;
}

export interface ScoreResult {
  listingId: string;
  score: number;
  reason: string;
}

const BATCH_SIZE = 12;

async function scoreBatch(candidate: CandidateInput, batch: VacancyListing[]): Promise<{ scores: ScoreResult[]; inputTokens: number; outputTokens: number }> {
  const listingsText = batch.map((l) =>
    `ID: ${l.id}\nTitle: ${l.title}\nCompany: ${l.company}\nLocation: ${l.location}\nDescription: ${l.description.slice(0, 300)}`
  ).join("\n---\n");

  const salaryText = candidate.salaryExpectation
    ? `€${Math.round(candidate.salaryExpectation / 1000)}k/yr`
    : "not specified";

  const prompt = `You are a recruitment expert. Score these job vacancies for this candidate.

CANDIDATE:
- Role: ${candidate.jobTitle}
- Skills: ${candidate.skills.length ? candidate.skills.join(", ") : "derived from role and branch"}
- Location: ${candidate.location}
- Salary expectation: ${salaryText}
- Industry/branch: ${candidate.branch}

Score each vacancy 0-100:
- 90-100: near-perfect match
- 70-89: strong match
- 50-69: reasonable match
- below 50: weak match

Consider: skills alignment (most important), seniority level, location compatibility, industry fit, salary alignment.

VACANCIES:
${listingsText}

Return ONLY a raw JSON array, no markdown, no explanation:
[{"listingId":"<exact id>","score":85,"reason":"Matches 4/5 skills, remote-friendly, salary likely aligned"}]`;

  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  const clean = text.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  try {
    return { scores: JSON.parse(clean) as ScoreResult[], inputTokens, outputTokens };
  } catch {
    return { scores: batch.map((l) => ({ listingId: l.id, score: 0, reason: "Scoring unavailable" })), inputTokens, outputTokens };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCaller(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { agencyId, email } = auth.caller;

    if ((await getBalance(agencyId)) < CREDIT_COST.match_vacancies) {
      return NextResponse.json(
        { error: `Insufficient credits. This action costs ${CREDIT_COST.match_vacancies} credits.` },
        { status: 402 },
      );
    }

    const { candidate, listings } = await req.json() as {
      candidate: CandidateInput;
      listings: VacancyListing[];
    };

    // Limit to 48 listings, process batches in parallel for speed
    const limited = listings.slice(0, 48);
    const batches: VacancyListing[][] = [];
    for (let i = 0; i < limited.length; i += BATCH_SIZE) {
      batches.push(limited.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map((b) => scoreBatch(candidate, b)));
    const matches = batchResults.flatMap((r) => r.scores);
    const totalInputTokens = batchResults.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = batchResults.reduce((sum, r) => sum + r.outputTokens, 0);

    await chargeCredits({
      agencyId,
      userEmail: email,
      feature: 'match_vacancies',
      model: FAST_MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    return NextResponse.json({ matches });
  } catch (err) {
    console.error("match-vacancies error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

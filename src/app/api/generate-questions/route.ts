import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ProcessedCV, Vacancy } from '@/lib/types';

const client = new Anthropic();

export interface InterviewQuestion {
  category: 'technical' | 'gap' | 'behavioural' | 'culture';
  question: string;
  listenFor: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      cv,
      vacancy,
      gaps,
      strengths,
    }: { cv: ProcessedCV; vacancy: Vacancy; gaps: string[]; strengths: string[] } =
      await req.json();

    if (!cv || !vacancy) {
      return NextResponse.json({ error: 'Missing cv or vacancy' }, { status: 400 });
    }

    const prompt = `You are a senior recruitment consultant at Orchard preparing an interview guide.

CANDIDATE PROFILE:
- Name: ${cv.firstName}
- Current role: ${cv.currentRole} at ${cv.currentCompany}
- Summary: ${cv.professionalSummary}
- Skills: ${cv.skills.join(', ')}
- Experience: ${cv.experience.map(e => `${e.title} at ${e.company} (${e.startDate}–${e.endDate})`).join('; ')}
- Education: ${cv.education.map(e => `${e.degree} from ${e.institution} (${e.year})`).join('; ')}

VACANCY:
- Role: ${vacancy.title} at ${vacancy.company}
- Seniority: ${vacancy.seniorityLevel}
- Requirements: ${vacancy.requirements.join(', ')}
- Description: ${vacancy.description}

SCREENING RESULTS:
- Strengths identified: ${strengths.join('; ')}
- Gaps / concerns: ${gaps.join('; ')}

Generate an interview guide with exactly these questions:
1. Five (5) technical/role-specific questions based on the vacancy requirements and role
2. Three (3) questions that specifically probe the gaps and concerns identified in the screening
3. Three (3) behavioural questions (STAR format) based on the candidate's background
4. Two (2) culture fit questions relevant to the company and role

For each question provide a concise "listenFor" note (1–2 sentences max) on what a strong answer sounds like.

Return ONLY a valid JSON array. No markdown, no explanation, just the array:
[
  {
    "category": "technical",
    "question": "...",
    "listenFor": "..."
  },
  ...
]

Categories must be exactly: "technical", "gap", "behavioural", or "culture".`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

    // Strip any markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const questions: InterviewQuestion[] = JSON.parse(cleaned);

    return NextResponse.json({ success: true, questions });
  } catch (err: any) {
    console.error('generate-questions error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

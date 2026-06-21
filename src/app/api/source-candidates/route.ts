import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { jobTitle, skills, location, seniorityLevel, salaryRange, vacancyLink } = await req.json();

    const prompt = `You are an expert talent sourcing strategist at a recruitment agency. Create a comprehensive sourcing strategy for the following role:

Job Title: ${jobTitle}
Required Skills: ${Array.isArray(skills) ? skills.join(', ') : skills}
Location: ${location || 'Amsterdam'}
Seniority Level: ${seniorityLevel}
Salary Range: ${salaryRange}
Vacancy Link: ${vacancyLink || 'N/A'}

Generate a JSON response with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "profiles": [
    {
      "title": "Short profile type name (e.g. 'The Agency-Side Veteran')",
      "backgroundDescription": "2-3 sentences describing the ideal background for this candidate type",
      "keySkills": ["skill1", "skill2", "skill3", "skill4"],
      "whereToFind": {
        "linkedinSearchUrl": "Full working LinkedIn search URL using site:linkedin.com/in and keywords",
        "githubSearch": "GitHub search URL if relevant to the role, otherwise empty string",
        "communities": ["specific community, forum, or platform name where these people gather", "another community"]
      },
      "outreachMessage": "Personalized 3-4 sentence outreach message tailored to this specific profile type. Make it compelling and relevant to their background."
    }
  ],
  "booleanSearch": "Full Boolean search string ready for LinkedIn Recruiter, using AND/OR/NOT operators and quotes for exact phrases",
  "xraySearch": "Full Google X-Ray search string using site:linkedin.com/in to find profiles without LinkedIn Premium"
}

Requirements:
- Generate 6-8 diverse and realistic candidate profile types that would genuinely fit this role
- Each profile should represent a genuinely different background or career path
- LinkedIn search URLs should be real Google search format: https://www.google.com/search?q=site:linkedin.com/in+"keyword"+AND+"skill"
- The Boolean search string should be immediately usable in LinkedIn Recruiter
- The X-Ray Google search should find real profiles
- Outreach messages should feel personal, not generic
- Consider profiles from: traditional backgrounds, career switchers, self-taught, agency vs in-house, different countries/remote, different company sizes`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Sourcing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

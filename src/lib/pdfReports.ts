import { ScreeningResult, ProcessedCV, Vacancy } from './types';
import type { InterviewQuestion } from '@/app/api/generate-questions/route';

const BRAND_PURPLE = '#7C3AED';
const BRAND_NAVY = '#0a1628';

function scoreColor(score: number) {
  if (score >= 8) return '#10b981';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function flagLabel(flag: 'green' | 'amber' | 'red') {
  return { green: 'Strong Match', amber: 'Partial Match', red: 'Poor Match' }[flag];
}

function baseStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
      @page { size: A4; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }

      .page { width: 210mm; min-height: 297mm; padding: 0; position: relative; }

      /* Header */
      .header { background: ${BRAND_NAVY}; color: white; padding: 28px 36px 24px; }
      .header-logo { font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: ${BRAND_PURPLE}; text-transform: uppercase; margin-bottom: 4px; }
      .header-title { font-size: 22px; font-weight: 700; color: #fff; }
      .header-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }

      /* Body */
      .body { padding: 28px 36px; }

      /* Score band */
      .score-band { display: flex; align-items: center; justify-content: space-between;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; }
      .score-number { font-size: 48px; font-weight: 800; line-height: 1; }
      .score-label { font-size: 11px; color: #64748b; }
      .score-meta p { font-size: 13px; color: #475569; margin-bottom: 2px; }
      .score-meta strong { color: #1e293b; }
      .bar-wrap { flex: 1; margin: 0 32px; }
      .bar-bg { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 99px; }

      /* Sections */
      .section { margin-bottom: 22px; }
      .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${BRAND_PURPLE}; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
      .section p { font-size: 13px; color: #475569; line-height: 1.7; }
      .list-item { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: #475569; margin-bottom: 6px; line-height: 1.5; }
      .dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }

      /* Footer */
      .footer { position: fixed; bottom: 0; left: 0; right: 0; background: ${BRAND_NAVY}; color: #94a3b8; font-size: 10px; padding: 10px 36px; display: flex; justify-content: space-between; }

      /* Interview guide specific */
      .category-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 6px 10px; border-radius: 4px; margin: 20px 0 12px; }
      .cat-technical { background: #ede9fe; color: #5b21b6; }
      .cat-gap       { background: #fef3c7; color: #92400e; }
      .cat-behavioural { background: #dcfce7; color: #166534; }
      .cat-culture   { background: #dbeafe; color: #1e40af; }
      .question-block { margin-bottom: 16px; padding-left: 12px; border-left: 3px solid #e2e8f0; }
      .question-text { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 5px; line-height: 1.5; }
      .listen-for { font-size: 11px; color: #64748b; line-height: 1.5; }
      .listen-label { font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
    </style>
  `;
}

export function generateScreeningReportHTML(
  result: ScreeningResult,
  cv: ProcessedCV,
  vacancy: Vacancy
): string {
  const sc = scoreColor(result.score);
  const date = new Date(result.createdAt).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const strengthsHTML = result.strengths
    .map(s => `<div class="list-item"><div class="dot" style="background:#10b981"></div><span>${s}</span></div>`)
    .join('');

  const gapsHTML = result.gaps
    .map(g => `<div class="list-item"><div class="dot" style="background:#f59e0b"></div><span>${g}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Screening Report — ${cv.firstName} / ${vacancy.title}</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-logo">TrueNorth Talent</div>
      <div class="header-title">AI Screening Report</div>
      <div class="header-sub">${cv.firstName} · ${vacancy.title} at ${vacancy.company} · ${date}</div>
    </div>

    <div class="body">
      <!-- Score band -->
      <div class="score-band">
        <div>
          <div class="score-number" style="color:${sc}">${result.score}</div>
          <div class="score-label">/ 10</div>
        </div>
        <div class="bar-wrap">
          <div class="bar-bg">
            <div class="bar-fill" style="width:${result.score * 10}%;background:${sc}"></div>
          </div>
          <div style="text-align:center;margin-top:4px;font-size:11px;font-weight:700;color:${sc}">
            ${flagLabel(result.flag)}
          </div>
        </div>
        <div class="score-meta">
          <p><strong>Candidate:</strong> ${cv.firstName}</p>
          <p><strong>Current role:</strong> ${cv.currentRole} at ${cv.currentCompany}</p>
          <p><strong>Vacancy:</strong> ${vacancy.title} · ${vacancy.seniorityLevel}</p>
          <p><strong>Company:</strong> ${vacancy.company}</p>
        </div>
      </div>

      <!-- Summary -->
      <div class="section">
        <div class="section-label">Recruiter Summary</div>
        <p>${result.summary}</p>
      </div>

      <!-- Strengths -->
      ${result.strengths.length > 0 ? `
      <div class="section">
        <div class="section-label" style="color:#10b981">Strengths</div>
        ${strengthsHTML}
      </div>` : ''}

      <!-- Gaps -->
      ${result.gaps.length > 0 ? `
      <div class="section">
        <div class="section-label" style="color:#f59e0b">Gaps / Concerns</div>
        ${gapsHTML}
      </div>` : ''}

      <!-- Candidate snapshot -->
      <div class="section">
        <div class="section-label">Candidate Snapshot</div>
        <p style="margin-bottom:6px"><strong>Skills:</strong> ${cv.skills.slice(0, 10).join(' · ')}</p>
        ${cv.experience.length > 0 ? `<p><strong>Experience:</strong> ${cv.experience.slice(0, 3).map(e => `${e.title} at ${e.company}`).join(' → ')}</p>` : ''}
      </div>
    </div>

    <div class="footer">
      <span>TrueNorth Talent — Confidential</span>
      <span>${date}</span>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical / Role-Specific',
  gap: 'Probing the Gaps',
  behavioural: 'Behavioural (STAR)',
  culture: 'Culture Fit',
};

export function generateInterviewGuideHTML(
  questions: InterviewQuestion[],
  cv: ProcessedCV,
  vacancy: Vacancy
): string {
  const date = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const order: InterviewQuestion['category'][] = ['technical', 'gap', 'behavioural', 'culture'];

  const sections = order.map(cat => {
    const qs = questions.filter(q => q.category === cat);
    if (!qs.length) return '';
    const catClass = `cat-${cat}`;
    const blocks = qs.map((q, i) => `
      <div class="question-block">
        <div class="question-text">${i + 1}. ${q.question}</div>
        <div class="listen-for"><span class="listen-label">Listen for: </span>${q.listenFor}</div>
      </div>`).join('');
    return `<div class="category-heading ${catClass}">${CATEGORY_LABELS[cat]}</div>${blocks}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${cv.firstName} — Interview Guide</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-logo">TrueNorth Talent</div>
      <div class="header-title">Interview Guide</div>
      <div class="header-sub">${cv.firstName} · ${vacancy.title} at ${vacancy.company} · ${date}</div>
    </div>

    <div class="body">
      <div class="section" style="margin-bottom:8px">
        <p style="font-size:12px;color:#64748b">
          This guide was generated by the TrueNorth Talent AI Screening Agent.
          Use it as a structured framework during your interview.
          Questions are tailored to the candidate's background and the role requirements.
        </p>
      </div>
      ${sections}
    </div>

    <div class="footer">
      <span>${cv.firstName} — Interview Guide · TrueNorth Talent</span>
      <span>${date}</span>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export function questionsToPlainText(
  questions: InterviewQuestion[],
  cv: ProcessedCV,
  vacancy: Vacancy
): string {
  const date = new Date().toLocaleDateString('nl-NL');
  const order: InterviewQuestion['category'][] = ['technical', 'gap', 'behavioural', 'culture'];

  const lines = [
    `INTERVIEW GUIDE — ${cv.firstName.toUpperCase()}`,
    `${vacancy.title} at ${vacancy.company}`,
    `Generated by TrueNorth Talent · ${date}`,
    '',
    '═'.repeat(60),
  ];

  order.forEach(cat => {
    const qs = questions.filter(q => q.category === cat);
    if (!qs.length) return;
    lines.push('');
    lines.push(CATEGORY_LABELS[cat].toUpperCase());
    lines.push('─'.repeat(40));
    qs.forEach((q, i) => {
      lines.push('');
      lines.push(`${i + 1}. ${q.question}`);
      lines.push(`   → Listen for: ${q.listenFor}`);
    });
  });

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('TrueNorth Talent — Confidential');

  return lines.join('\n');
}

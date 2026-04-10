export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string; // supports {{candidateName}}, {{clientName}}, {{jobTitle}}, {{date}} placeholders
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'candidate_outreach',
    name: 'Candidate Outreach',
    subject: 'Exciting opportunity — {{jobTitle}} at {{clientName}}',
    body: `Dear {{candidateName}},\n\nI came across your profile and wanted to reach out about an exciting opportunity as a {{jobTitle}} at {{clientName}}.\n\nI believe your background and experience would be a great fit for this role. I would love to connect and share more details about this position.\n\nWould you be open to a brief call this week?\n\nBest regards,\nDani\nTrueNorth Talent`,
  },
  {
    id: 'client_intro',
    name: 'Introduction to Client',
    subject: 'Candidate Introduction — {{candidateName}}',
    body: `Dear {{clientName}},\n\nI am pleased to introduce {{candidateName}}, a strong candidate for the {{jobTitle}} role.\n\nI have attached their CV for your review. {{candidateName}} brings relevant experience and I am confident they would be a valuable addition to your team.\n\nPlease let me know if you would like to arrange an interview or if you need any additional information.\n\nBest regards,\nDani\nTrueNorth Talent`,
  },
  {
    id: 'interview_confirmation',
    name: 'Interview Confirmation',
    subject: 'Interview Confirmation — {{jobTitle}}',
    body: `Dear {{candidateName}},\n\nThis is to confirm your interview for the {{jobTitle}} position on {{date}}.\n\nPlease ensure you arrive on time and bring a copy of your CV. If you have any questions beforehand, do not hesitate to reach out.\n\nWe look forward to meeting you!\n\nBest regards,\nDani\nTrueNorth Talent`,
  },
  {
    id: 'placement_confirmation',
    name: 'Placement Confirmation',
    subject: 'Placement Confirmed — {{candidateName}}',
    body: `Dear {{clientName}},\n\nWe are delighted to confirm the placement of {{candidateName}} as {{jobTitle}}.\n\nAs per our fee agreement, an invoice will follow shortly. The guarantee period begins on the start date.\n\nThank you for your trust in TrueNorth Talent. We wish {{candidateName}} every success in their new role.\n\nBest regards,\nDani\nTrueNorth Talent`,
  },
];

export function applyTemplate(template: EmailTemplate, vars: Record<string, string>): EmailTemplate {
  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    subject = subject.split(placeholder).join(value);
    body = body.split(placeholder).join(value);
  }

  return {
    ...template,
    subject,
    body,
  };
}

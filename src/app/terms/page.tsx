import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Orchard',
  description: 'Terms and conditions for using the Orchard recruitment platform.',
};

const EFFECTIVE_DATE = '1 July 2026';
const CONTACT_EMAIL = 'dani@orchard.works';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8faf8' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#5a6a60', fontSize: 14, marginBottom: 32 }}>
            ← Back to Orchard
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0f1711', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ color: '#8a9a90', fontSize: 14 }}>Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <Section>
          <p>
            These Terms of Service ("<strong>Terms</strong>") govern your access to and use of Orchard
            ("<strong>Service</strong>"), a SaaS recruitment platform operated by Orchard
            ("<strong>Orchard</strong>", "<strong>we</strong>", "<strong>us</strong>").
            By creating an account or using the Service you agree to these Terms. If you are using the
            Service on behalf of a recruitment agency or other organisation, you represent that you have
            authority to bind that organisation.
          </p>
        </Section>

        <H2>1. Definitions</H2>
        <Section>
          <Def term="Agency">The recruitment company or freelance recruiter that owns the workspace.</Def>
          <Def term="User">Any individual authorised by the Agency to access the workspace (owner, admin, or member).</Def>
          <Def term="Candidate data">Personal data relating to job candidates, including CVs, contact details, screening results, and notes.</Def>
          <Def term="Credits">Prepaid units consumed when AI features are used. One credit represents a fixed unit of AI compute cost.</Def>
          <Def term="AI features">Automated services powered by large language models, including CV parsing, pitch generation, cold-email drafting, candidate screening, candidate sourcing, vacancy matching, and signal enrichment.</Def>
        </Section>

        <H2>2. The Service</H2>
        <Section>
          <p>Orchard provides a multi-tenant recruitment CRM that includes:</p>
          <ul>
            <li>Candidate profile management, CV processing, and screening</li>
            <li>Account and pipeline management for prospect companies</li>
            <li>Vacancy management and candidate–vacancy matching</li>
            <li>AI-generated outreach (cold emails, pitches, interview questions)</li>
            <li>Hiring-signal monitoring via public job boards</li>
            <li>Team management with role-based access (owner / admin / member)</li>
            <li>Credit-based billing for AI features</li>
          </ul>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any time.
            We will provide reasonable notice of material changes where possible.
          </p>
        </Section>

        <H2>3. Accounts and Access</H2>
        <Section>
          <p>
            Each Agency has one workspace. The owner is responsible for all activity within the workspace,
            including activity by admins and members they invite. You must keep login credentials
            confidential and notify us immediately of any unauthorised access.
          </p>
          <p>
            You may not share login credentials between individuals. Each User must have their own account.
            We may suspend accounts that show signs of shared or automated login.
          </p>
        </Section>

        <H2>4. AI Features and Credits</H2>
        <Section>
          <p>
            AI features consume Credits from your agency&apos;s balance. The Credit cost per feature is
            shown in the platform and may be updated periodically. Credits are deducted only for
            successful AI responses. Failed requests are not charged.
          </p>
          <p>
            <strong>AI output is not guaranteed to be accurate.</strong> All AI-generated content
            (pitches, cold emails, screening summaries, match scores) is advisory only. You are solely
            responsible for reviewing AI output before using it with candidates, clients, or third parties.
            Orchard accepts no liability for decisions made on the basis of AI-generated content.
          </p>
          <p>
            Our AI features are powered by Anthropic&apos;s Claude models. By using AI features you
            acknowledge that your input data (vacancy descriptions, candidate summaries, company names)
            is transmitted to Anthropic&apos;s API for processing. Anthropic processes this data under
            its own API terms and does not use it to train its models.
          </p>
        </Section>

        <H2>5. Billing and Credits</H2>
        <Section>
          <p>
            Credits are purchased in packs via our payment processor (Stripe). Prices are displayed
            at the time of purchase and are inclusive of applicable taxes where required. All purchases
            are final; Credits are non-refundable except where required by applicable law.
          </p>
          <p>
            Credits do not expire while your account is active. If your account is terminated for breach
            of these Terms, any unused Credits are forfeited.
          </p>
          <p>
            We reserve the right to change Credit prices or pack sizes. Changes will be communicated
            at least 14 days in advance.
          </p>
        </Section>

        <H2>6. Data and Privacy</H2>
        <Section>
          <p>
            <strong>Your data.</strong> All data you enter into Orchard (candidate profiles, vacancies,
            accounts, notes, emails) is yours. We do not sell your data or use it to train AI models.
            Data is stored in the EU (Supabase, hosted on AWS eu-west-1).
          </p>
          <p>
            <strong>Candidate data.</strong> You are the data controller for any personal data you
            enter about candidates. You are responsible for ensuring you have a lawful basis under the
            GDPR (or applicable law) for processing candidate data, and for honouring candidates&apos;
            rights (access, deletion, rectification). We act as your data processor and will process
            candidate data only as instructed by you.
          </p>
          <p>
            <strong>Retention.</strong> We retain your data for as long as your account is active.
            Upon termination you may request a data export within 30 days; after that we may delete
            your data from our systems.
          </p>
          <p>
            Our full Privacy Policy is available at{' '}
            <Link href="/privacy" style={{ color: '#2D4A2D' }}>orchard.works/privacy</Link>.
          </p>
        </Section>

        <H2>7. Acceptable Use</H2>
        <Section>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Send unsolicited bulk emails or spam</li>
            <li>Process candidate data without a lawful basis under applicable data protection law</li>
            <li>Harass, discriminate against, or unfairly exclude candidates on protected characteristics</li>
            <li>Reverse-engineer, scrape, or systematically extract data from the platform</li>
            <li>Resell or sublicense access to the Service without our written consent</li>
            <li>Use AI features to generate misleading, defamatory, or harmful content</li>
            <li>Attempt to circumvent credit metering or access AI features without paying</li>
          </ul>
          <p>
            Violation of this section may result in immediate suspension or termination of your account.
          </p>
        </Section>

        <H2>8. Intellectual Property</H2>
        <Section>
          <p>
            Orchard and its underlying software, design, and brand are our intellectual property.
            We grant you a limited, non-exclusive, non-transferable licence to use the Service during
            your subscription.
          </p>
          <p>
            You retain ownership of all data you input. By using the Service you grant us a limited
            licence to process your data solely for the purpose of operating and improving the Service.
          </p>
        </Section>

        <H2>9. Limitation of Liability</H2>
        <Section>
          <p>
            To the maximum extent permitted by law, Orchard&apos;s total liability to you for any claim
            arising out of these Terms or your use of the Service is limited to the greater of
            (a) the total Credits or fees you paid us in the 3 months preceding the claim, or
            (b) €100.
          </p>
          <p>
            We are not liable for indirect, incidental, special, or consequential damages, including
            loss of revenue, loss of data, or loss of business opportunities, even if we have been
            advised of the possibility of such damages.
          </p>
          <p>
            Nothing in these Terms limits liability that cannot be limited under applicable law
            (including liability for fraud or gross negligence).
          </p>
        </Section>

        <H2>10. Termination</H2>
        <Section>
          <p>
            You may close your account at any time by contacting us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
          </p>
          <p>
            We may suspend or terminate your account immediately if you breach these Terms, if your
            Credits are exhausted and you do not purchase more within a reasonable period, or if we
            are required to do so by law.
          </p>
        </Section>

        <H2>11. Governing Law</H2>
        <Section>
          <p>
            These Terms are governed by the laws of the Netherlands. Any dispute that cannot be resolved
            amicably will be submitted to the exclusive jurisdiction of the competent court in Amsterdam,
            the Netherlands.
          </p>
        </Section>

        <H2>12. Changes to These Terms</H2>
        <Section>
          <p>
            We may update these Terms from time to time. We will notify you of material changes via
            email or an in-app notice at least 14 days before they take effect. Continued use of the
            Service after the effective date constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <H2>13. Contact</H2>
        <Section>
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f1711', marginTop: 40, marginBottom: 12 }}>
      {children}
    </h2>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#2a3a30', fontSize: 15, lineHeight: 1.75, marginBottom: 8 }}>
      <style>{`
        div > p { margin-bottom: 12px; }
        div > ul { padding-left: 20px; margin-bottom: 12px; }
        div > ul > li { margin-bottom: 6px; }
      `}</style>
      {children}
    </div>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <p style={{ marginBottom: 8 }}>
      <strong style={{ color: '#0f1711' }}>{term}:</strong>{' '}{children}
    </p>
  );
}

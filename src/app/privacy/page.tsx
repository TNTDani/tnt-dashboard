import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Orchard',
  description: 'How Orchard collects, uses, and protects your data.',
};

const EFFECTIVE_DATE = '1 July 2026';
const CONTACT_EMAIL = 'dani@orchard.works';
const CONTROLLER = 'Orchard';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8faf8' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <a href="/terms" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#5a6a60', fontSize: 14, marginBottom: 32 }}>
            ← Terms of Service
          </a>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0f1711', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: '#8a9a90', fontSize: 14 }}>Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <Section>
          <p>
            {CONTROLLER} ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>") operates the
            Orchard recruitment platform. This Privacy Policy explains what personal data we collect,
            why we collect it, how we use it, and your rights under the General Data Protection
            Regulation (GDPR) and other applicable law.
          </p>
          <p>
            Questions? Contact our privacy contact at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <H2>1. Who is the data controller?</H2>
        <Section>
          <p>
            {CONTROLLER} is the data controller for data relating to <strong>Users</strong> (the recruiters
            who log in to Orchard) and for data relating to the operation of the platform.
          </p>
          <p>
            For <strong>Candidate data</strong> entered by a recruitment agency into Orchard, the
            <strong> Agency</strong> is the data controller and Orchard acts as data processor.
            Each Agency is responsible for ensuring it has a lawful basis to process candidate data
            and for honouring candidates' rights. See Section 7 for more detail.
          </p>
        </Section>

        <H2>2. Data we collect about Users</H2>
        <Section>
          <p>When you register and use Orchard as a recruiter, we collect:</p>
          <Table rows={[
            ['Account data', 'Full name, work email address, bcrypt-hashed password, agency name, role (owner / admin / member)', 'Contract performance — needed to provide the Service'],
            ['Usage data', 'AI features used, credit credits consumed, feature timestamps, token counts, model used', 'Legitimate interest — billing accuracy, cost monitoring, abuse prevention'],
            ['Activity data', 'Pages visited, actions taken (e.g. vacancy created, candidate screened), session duration', 'Legitimate interest — product improvement and support'],
            ['Payment data', 'Stripe customer ID, pack purchases, payment status. We do not store card numbers — Stripe handles PCI-DSS compliance.', 'Contract performance — credit billing'],
            ['Technical data', 'IP address, browser type, device type, time zone', 'Legitimate interest — security and fraud prevention'],
          ]} />
        </Section>

        <H2>3. Data we collect about Candidates (on behalf of Agencies)</H2>
        <Section>
          <p>
            Recruiters enter candidate data into Orchard. As data processor we store and process
            this data solely on the Agency's instruction. Typical candidate data includes:
          </p>
          <ul>
            <li>Name, email address, phone number, location, postal code</li>
            <li>LinkedIn profile URL</li>
            <li>CV and motivation letter (uploaded documents)</li>
            <li>Job title, branch, salary expectation</li>
            <li>Notes and timed notes added by recruiters</li>
            <li>AI-generated screening summaries and match scores</li>
            <li>Timeline of recruiter interactions</li>
          </ul>
          <p>
            Candidates whose data is processed through Orchard should contact the relevant recruitment
            agency (the data controller) to exercise their GDPR rights.
          </p>
        </Section>

        <H2>4. AI features and third-party processors</H2>
        <Section>
          <p>
            Orchard's AI features are powered by <strong>Anthropic</strong> (Claude models).
            When you use an AI feature, relevant input data (e.g. a vacancy description, a candidate
            summary, a company name) is transmitted to Anthropic's API for processing. Anthropic does
            not use API data to train its models. Anthropic's data processing is governed by their
            <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2D4A2D' }}> Privacy Policy</a>.
          </p>
          <p>Our other key sub-processors:</p>
          <Table rows={[
            ['Supabase', 'Database and file storage', 'EU (AWS eu-west-1, Ireland)'],
            ['Anthropic', 'AI model inference', 'USA (API — no training use)'],
            ['Stripe', 'Payment processing', 'EU/USA (PCI-DSS compliant)'],
            ['Vercel', 'Application hosting and CDN', 'EU edge nodes'],
          ]} headers={['Sub-processor', 'Purpose', 'Location']} />
        </Section>

        <H2>5. How we use your data</H2>
        <Section>
          <p>We use User data to:</p>
          <ul>
            <li>Provide, maintain, and improve the Orchard platform</li>
            <li>Authenticate Users and enforce role-based access control</li>
            <li>Meter credit consumption and process payments</li>
            <li>Send transactional communications (e.g. payment receipts, invite codes)</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>
            We do not sell your data. We do not use your data for advertising.
            We do not share your data with third parties except the sub-processors listed in
            Section 4 and as required by law.
          </p>
        </Section>

        <H2>6. Data retention</H2>
        <Section>
          <Table rows={[
            ['Account and workspace data', 'Duration of active account + 30 days after closure'],
            ['AI usage logs (ai_usage)', '24 months (for billing reconciliation)'],
            ['Candidate data', 'Duration of active account + 30 days; earlier deletion on Agency request'],
            ['Payment records', '7 years (Dutch accounting law — Boekhoudbewaarplicht)'],
            ['Server logs and technical data', '90 days'],
          ]} headers={['Data type', 'Retention period']} />
          <p style={{ marginTop: 12 }}>
            After the retention period, data is deleted or anonymised. You may request earlier
            deletion as described in Section 8.
          </p>
        </Section>

        <H2>7. Candidate data — Agency responsibilities</H2>
        <Section>
          <p>
            If you are a recruitment agency using Orchard, you are the data controller for candidate
            data you enter. This means you must:
          </p>
          <ul>
            <li>Have a lawful basis (e.g. consent or legitimate interest) before entering a candidate's data</li>
            <li>Inform candidates that their data may be processed using AI tools</li>
            <li>Handle candidates' access, rectification, and deletion requests directly</li>
            <li>Not enter sensitive data (health, religion, ethnicity, etc.) unless strictly necessary and with explicit consent</li>
          </ul>
          <p>
            We will assist Agencies in meeting their obligations as required by the GDPR
            (Art. 28 processor obligations). A Data Processing Agreement (DPA) is available
            on request at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <H2>8. Your rights</H2>
        <Section>
          <p>Under GDPR you have the right to:</p>
          <Table rows={[
            ['Access', 'Request a copy of personal data we hold about you'],
            ['Rectification', 'Ask us to correct inaccurate data'],
            ['Erasure', 'Ask us to delete your data ("right to be forgotten")'],
            ['Restriction', 'Ask us to limit how we process your data'],
            ['Portability', 'Receive your data in a structured, machine-readable format'],
            ['Object', 'Object to processing based on legitimate interest'],
            ['Withdraw consent', 'Where processing is based on consent, withdraw it at any time'],
          ]} headers={['Right', 'What it means']} />
          <p style={{ marginTop: 12 }}>
            To exercise any right, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
            We will respond within 30 days. You also have the right to lodge a complaint with
            the Dutch data protection authority (Autoriteit Persoonsgegevens) at{' '}
            <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#2D4A2D' }}>autoriteitpersoonsgegevens.nl</a>.
          </p>
        </Section>

        <H2>9. Cookies and local storage</H2>
        <Section>
          <p>Orchard uses:</p>
          <Table rows={[
            ['Session cookie (next-auth.session-token)', 'Authentication — keeps you logged in', 'Session or 7 days (if "Remember me" selected)', 'Essential'],
            ['localStorage (filter preferences)', 'Remembers your filter and view settings per device', 'Until browser data is cleared', 'Functional'],
            ['localStorage (PWA cache)', 'Enables offline access to recently viewed data', 'Until browser data is cleared', 'Functional'],
          ]} headers={['Name / type', 'Purpose', 'Duration', 'Category']} />
          <p style={{ marginTop: 12 }}>
            We do not use advertising cookies or third-party tracking cookies.
          </p>
        </Section>

        <H2>10. Security</H2>
        <Section>
          <p>We protect your data using:</p>
          <ul>
            <li>Passwords hashed with bcrypt (cost factor 10)</li>
            <li>All data in transit encrypted via TLS 1.2+</li>
            <li>Row-level security (RLS) in Supabase ensuring each agency can only access its own data</li>
            <li>Role-based access control (owner / admin / member) within each workspace</li>
            <li>API authentication on every server route via JWT verification</li>
          </ul>
          <p>
            If you discover a security vulnerability, please disclose it responsibly to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <H2>11. Changes to this Policy</H2>
        <Section>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes via email or an in-app notice at least 14 days before they take effect.
            The current version is always available at orchard.works/privacy.
          </p>
        </Section>

        <H2>12. Contact</H2>
        <Section>
          <p>
            Privacy questions, data requests, or DPA enquiries:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2D4A2D' }}>{CONTACT_EMAIL}</a>
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

function Table({ rows, headers }: { rows: string[][]; headers?: string[] }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        {headers && (
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', background: 'rgba(45,74,45,0.06)', color: '#2D4A2D', fontWeight: 600, borderBottom: '1px solid rgba(20,33,26,0.1)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(20,33,26,0.06)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 12px', color: j === 0 ? '#0f1711' : '#5a6a60', fontWeight: j === 0 ? 500 : 400, verticalAlign: 'top' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

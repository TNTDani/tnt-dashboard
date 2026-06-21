/**
 * One-time migration: copy data/tickets.json → intake_tickets (Supabase).
 *
 * Run after applying the SQL migration:
 *   npx tsx --env-file=.env.local scripts/migrate-tickets.ts <agency_id>
 *
 * The agency_id argument is required because the old JSON file didn't store it.
 * Use your agency's UUID from the agencies table.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const agencyId = process.argv[2];
if (!agencyId) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/migrate-tickets.ts <agency_id>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const FILE = path.join(process.cwd(), 'data', 'tickets.json');

async function main() {
  if (!fs.existsSync(FILE)) {
    console.log('data/tickets.json not found — nothing to migrate.');
    return;
  }

  const raw = fs.readFileSync(FILE, 'utf-8');
  const tickets: Record<string, unknown>[] = JSON.parse(raw);

  if (tickets.length === 0) {
    console.log('data/tickets.json is empty — nothing to migrate.');
    return;
  }

  console.log(`Migrating ${tickets.length} ticket(s) to agency ${agencyId}…`);

  const rows = tickets.map((t) => ({
    id: t.id,
    agency_id: agencyId,
    status: t.status ?? 'new',
    company_name: t.companyName,
    contact_name: t.contactName,
    contact_email: t.contactEmail,
    role_title: t.roleTitle,
    seniority_level: t.seniorityLevel ?? 'Senior',
    salary_min: Number(t.salaryMin) || 0,
    salary_max: Number(t.salaryMax) || 0,
    work_type: t.workType ?? 'hybrid',
    city: t.city ?? '',
    description: t.description ?? '',
    source: t.source ?? '',
    confirmation_sent: t.confirmationSent ?? false,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }));

  const { error } = await supabase.from('intake_tickets').insert(rows);

  if (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${rows.length} ticket(s) successfully.`);
  console.log('You can now delete data/tickets.json.');
}

main();

// GET /api/accounts/hiring-signals
// Returns a map of normalized company token → open role count across all active vacancy_listings.
// Used by the accounts list page to show a "hiring" badge without N+1 queries.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCaller } from '@/lib/apiAuth';
import { searchToken } from '../[accountId]/live-vacancies/route';

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data } = await supabaseAdmin
    .from('vacancy_listings')
    .select('company')
    .neq('status', 'gone');

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const token = searchToken(row.company ?? '');
    if (token) counts[token] = (counts[token] ?? 0) + 1;
  }

  return NextResponse.json(counts);
}

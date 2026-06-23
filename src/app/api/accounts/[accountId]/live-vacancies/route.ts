// GET /api/accounts/[accountId]/live-vacancies
// Returns active vacancy_listings that match this account's company name.
// Used by the account detail page to surface open roles as potential signals.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCaller } from '@/lib/apiAuth';

/** Extracts the first meaningful token from a company name for fuzzy matching. */
function searchToken(name: string): string {
  const token = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(bv|nv|ltd|inc|llc|gmbh|ag|corp|group|holding|solutions|technologies|tech|systems|nederland|netherlands|nl)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .find((t) => t.length >= 3);
  return token ?? '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agencyId } = auth.caller;

  const { accountId } = await params;

  const { data: acc } = await supabaseAdmin
    .from('accounts')
    .select('company_name')
    .eq('id', accountId)
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (!acc) return NextResponse.json({ listings: [] });

  const token = searchToken(acc.company_name);
  if (!token) return NextResponse.json({ listings: [] });

  const { data } = await supabaseAdmin
    .from('vacancy_listings')
    .select('id, title, company, source, location, url, category, posted_at, last_seen_at')
    .neq('status', 'gone')
    .ilike('company', `%${token}%`)
    .order('last_seen_at', { ascending: false })
    .limit(20);

  // Map to camelCase
  const listings = (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    company: r.company as string,
    source: r.source as string,
    location: r.location as string,
    url: r.url as string,
    category: r.category as string,
    postedAt: r.posted_at as string,
    lastSeenAt: r.last_seen_at as string,
  }));

  return NextResponse.json({ listings, token });
}

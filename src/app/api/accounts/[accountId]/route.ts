// src/app/api/accounts/[accountId]/route.ts
// DELETE -> verwijdert een account. Alleen owner/admin. Re-checkt de rol server-side,
// zelfde patroon als de team-routes (getToken + supabaseAdmin + agency-scope).

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from('agency_users')
    .select('agency_id, role')
    .eq('email', token.email as string)
    .maybeSingle();

  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Alleen een admin kan accounts verwijderen.' }, { status: 403 });
  }

  // account_leads en account_pitches hebben ON DELETE CASCADE, dus die gaan mee.
  const { error } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('agency_id', caller.agency_id)
    .eq('id', accountId);

  if (error) {
    console.error('[DELETE /api/accounts/:id]', error);
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

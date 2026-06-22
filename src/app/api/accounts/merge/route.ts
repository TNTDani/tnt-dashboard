// src/app/api/accounts/merge/route.ts
// POST -> voegt twee accounts samen (Salesforce-stijl). Alleen owner/admin.
// Body: { masterId, duplicateId, fields } waarbij fields per veld de gekozen
// waarde bevat. Leads, pitches, signalen en key people van de duplicate gaan
// over naar de master; daarna wordt de duplicate verwijderd.

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '@/lib/supabase';

interface MergeBody {
  masterId: string;
  duplicateId: string;
  // gekozen scalaire veldwaarden voor de master (al opgelost client-side)
  fields: {
    company_name?: string;
    website?: string | null;
    sector?: string | null;
    size?: string | null;
    location?: string | null;
    linkedin?: string | null;
    description?: string | null;
    notes?: string;
  };
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from('agency_users')
    .select('agency_id, role')
    .eq('email', token.email as string)
    .maybeSingle();

  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Alleen een admin kan accounts samenvoegen.' }, { status: 403 });
  }

  const { masterId, duplicateId, fields }: MergeBody = await req.json();
  if (!masterId || !duplicateId || masterId === duplicateId) {
    return NextResponse.json({ error: 'Ongeldige accounts om samen te voegen.' }, { status: 400 });
  }
  const agencyId = caller.agency_id;

  // Beide accounts ophalen en valideren dat ze van dit bureau zijn.
  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('agency_id', agencyId)
    .in('id', [masterId, duplicateId]);

  if (fetchErr || !rows || rows.length !== 2) {
    return NextResponse.json({ error: 'Accounts niet gevonden.' }, { status: 404 });
  }
  const master = rows.find((r) => r.id === masterId)!;
  const dup = rows.find((r) => r.id === duplicateId)!;

  // Collecties samenvoegen (union, simpele dedup op JSON-string).
  const dedup = <T,>(arr: T[]) => {
    const seen = new Set<string>();
    return arr.filter((x) => {
      const k = JSON.stringify(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const signals = dedup([...(master.signals ?? []), ...(dup.signals ?? [])]);
  const keyPeople = dedup([...(master.key_people ?? []), ...(dup.key_people ?? [])]);

  // 1. Leads en pitches van de duplicate naar de master verplaatsen.
  const [{ error: leadErr }, { error: pitchErr }] = await Promise.all([
    supabaseAdmin.from('account_leads').update({ account_id: masterId }).eq('agency_id', agencyId).eq('account_id', duplicateId),
    supabaseAdmin.from('account_pitches').update({ account_id: masterId }).eq('agency_id', agencyId).eq('account_id', duplicateId),
  ]);
  if (leadErr || pitchErr) {
    console.error('[merge] reassign', leadErr, pitchErr);
    return NextResponse.json({ error: 'Samenvoegen mislukt bij verplaatsen leads/pitches.' }, { status: 500 });
  }

  // 2. Master bijwerken met de gekozen velden + samengevoegde collecties.
  const { error: updErr } = await supabaseAdmin
    .from('accounts')
    .update({ ...fields, signals, key_people: keyPeople, updated_at: new Date().toISOString() })
    .eq('agency_id', agencyId)
    .eq('id', masterId);
  if (updErr) {
    console.error('[merge] update master', updErr);
    return NextResponse.json({ error: 'Samenvoegen mislukt bij bijwerken master.' }, { status: 500 });
  }

  // 3. Duplicate verwijderen.
  const { error: delErr } = await supabaseAdmin.from('accounts').delete().eq('agency_id', agencyId).eq('id', duplicateId);
  if (delErr) {
    console.error('[merge] delete duplicate', delErr);
    return NextResponse.json({ error: 'Master bijgewerkt, maar verwijderen duplicate mislukt.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, masterId });
}

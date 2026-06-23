// src/app/api/credits/balance/route.ts
// GET -> huidig creditsaldo van het bureau van de ingelogde gebruiker.

import { NextRequest, NextResponse } from 'next/server';
import { requireCaller } from '@/lib/apiAuth';
import { getBalance } from '@/lib/credits';

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const balance = await getBalance(auth.caller.agencyId);
  return NextResponse.json({ balance });
}

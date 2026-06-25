// GET /api/credits/balance
// Returns the agency's credit balance with full bucket detail for the UI.

import { NextRequest, NextResponse } from 'next/server';
import { requireCaller } from '@/lib/apiAuth';
import { getBalanceDetail } from '@/lib/credits';

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const detail = await getBalanceDetail(auth.caller.agencyId);
  return NextResponse.json(detail);
}

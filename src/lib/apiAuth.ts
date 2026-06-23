// src/lib/apiAuth.ts
// Eén plek voor auth + rol-check in API-routes (vervangt de copy-paste).

import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface Caller {
  agencyId: string;
  role: string;
  email: string;
}

type AuthResult = { caller: Caller } | { error: string; status: 401 | 403 };

export async function requireCaller(req: NextRequest, opts?: { roles?: string[] }): Promise<AuthResult> {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return { error: 'Unauthorized', status: 401 };

  const { data: caller } = await supabaseAdmin
    .from('agency_users')
    .select('agency_id, role')
    .eq('email', token.email as string)
    .maybeSingle();

  if (!caller) return { error: 'Unauthorized', status: 401 };
  if (opts?.roles && !opts.roles.includes(caller.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { caller: { agencyId: caller.agency_id, role: caller.role, email: token.email as string } };
}

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '@/lib/supabase';
import { IntakeTicket } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTicket(r: any): IntakeTicket {
  return {
    id: r.id,
    companyName: r.company_name,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    roleTitle: r.role_title,
    seniorityLevel: r.seniority_level,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    workType: r.work_type,
    city: r.city ?? '',
    description: r.description ?? '',
    source: r.source ?? '',
    status: r.status,
    confirmationSent: r.confirmation_sent ?? false,
    convertedClientId: r.converted_client_id ?? undefined,
    convertedVacancyId: r.converted_vacancy_id ?? undefined,
    declinedAt: r.declined_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function patchToRow(patch: Partial<IntakeTicket>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    row.status = patch.status;
    if (patch.status === 'declined') row.declined_at = new Date().toISOString();
  }
  if (patch.confirmationSent !== undefined) row.confirmation_sent = patch.confirmationSent;
  if (patch.convertedClientId !== undefined) row.converted_client_id = patch.convertedClientId;
  if (patch.convertedVacancyId !== undefined) row.converted_vacancy_id = patch.convertedVacancyId;
  return row;
}

// ---------------------------------------------------------------------------
// PATCH /api/intake/[id]
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const patch = await req.json();
  const row = patchToRow(patch);

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('intake_tickets')
    .update(row)
    .eq('id', id)
    .eq('agency_id', token.agencyId as string) // scoped to caller's agency
    .select()
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[PATCH /api/intake/[id]]', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  return NextResponse.json(rowToTicket(data));
}

// ---------------------------------------------------------------------------
// DELETE /api/intake/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { error, count } = await supabaseAdmin
    .from('intake_tickets')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('agency_id', token.agencyId as string);

  if (error) {
    console.error('[DELETE /api/intake/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

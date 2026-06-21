import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '@/lib/supabase';
import { IntakeTicket } from '@/lib/types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 10 submissions per IP per hour.
// Per-instance only — acceptable for low-traffic public form.
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const hits = (rateLimitMap.get(ip) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= 10) return true;
  hits.push(now);
  rateLimitMap.set(ip, hits);
  return false;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// GET /api/intake — authenticated, returns tickets for the caller's agency
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('intake_tickets')
    .select('*')
    .eq('agency_id', token.agencyId as string)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/intake]', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(rowToTicket));
}

// ---------------------------------------------------------------------------
// POST /api/intake — public, creates a new ticket
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Honeypot — bots fill this field, humans don't see it
    if (body.websiteUrl) {
      // Silently return success to fool the bot
      return NextResponse.json({ success: true });
    }

    // Rate limit by IP
    const ip = getIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    const {
      agencyId, companyName, contactName, contactEmail, roleTitle,
      seniorityLevel, salaryMin, salaryMax, workType, city,
      description, source,
    } = body;

    // Validate required fields
    if (!agencyId || !companyName || !contactName || !contactEmail || !roleTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate agency exists
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('id', agencyId)
      .maybeSingle();

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Invalid agency' }, { status: 400 });
    }

    // Insert ticket
    const { data, error } = await supabaseAdmin
      .from('intake_tickets')
      .insert({
        agency_id: agencyId,
        company_name: String(companyName).trim(),
        contact_name: String(contactName).trim(),
        contact_email: String(contactEmail).trim().toLowerCase(),
        role_title: String(roleTitle).trim(),
        seniority_level: seniorityLevel || 'Senior',
        salary_min: Number(salaryMin) || 0,
        salary_max: Number(salaryMax) || 0,
        work_type: workType || 'hybrid',
        city: String(city || '').trim(),
        description: String(description || '').trim(),
        source: String(source || '').trim(),
        status: 'new',
        confirmation_sent: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/intake]', error);
      return NextResponse.json({ error: 'Failed to save ticket' }, { status: 500 });
    }

    return NextResponse.json({ success: true, ticket: rowToTicket(data) });
  } catch (err) {
    console.error('Intake POST error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

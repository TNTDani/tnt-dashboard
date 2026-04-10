import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { IntakeTicket } from '@/lib/types';
import { addTicket, readTickets } from '@/lib/ticketStorage';

export async function GET() {
  return NextResponse.json(readTickets());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      companyName, contactName, contactEmail, roleTitle,
      seniorityLevel, salaryMin, salaryMax, workType, city,
      description, source,
    } = body;

    if (!companyName || !contactName || !contactEmail || !roleTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ticket: IntakeTicket = {
      id: uuidv4(),
      companyName: String(companyName).trim(),
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      roleTitle: String(roleTitle).trim(),
      seniorityLevel: seniorityLevel || 'Senior',
      salaryMin: Number(salaryMin) || 0,
      salaryMax: Number(salaryMax) || 0,
      workType: workType || 'hybrid',
      city: String(city || '').trim(),
      description: String(description || '').trim(),
      source: String(source || '').trim(),
      status: 'new',
      confirmationSent: false,
      createdAt: now,
      updatedAt: now,
    };

    addTicket(ticket);

    return NextResponse.json({ success: true, ticket });
  } catch (err) {
    console.error('Intake POST error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

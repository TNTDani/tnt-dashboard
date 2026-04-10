import fs from 'fs';
import path from 'path';
import { IntakeTicket } from './types';

const FILE = path.join(process.cwd(), 'data', 'tickets.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf-8');
}

export function readTickets(): IntakeTicket[] {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function writeTickets(tickets: IntakeTicket[]): void {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(tickets, null, 2), 'utf-8');
}

export function addTicket(ticket: IntakeTicket): void {
  const tickets = readTickets();
  tickets.unshift(ticket); // newest first
  writeTickets(tickets);
}

export function updateTicket(id: string, patch: Partial<IntakeTicket>): IntakeTicket | null {
  const tickets = readTickets();
  const idx = tickets.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tickets[idx] = { ...tickets[idx], ...patch, updatedAt: new Date().toISOString() };
  writeTickets(tickets);
  return tickets[idx];
}

export function deleteTicket(id: string): boolean {
  const tickets = readTickets();
  const next = tickets.filter(t => t.id !== id);
  if (next.length === tickets.length) return false;
  writeTickets(next);
  return true;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { IntakeTicket, Client, Vacancy } from '@/lib/types';
import { storage } from '@/lib/storage';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  Inbox, ChevronDown, ChevronUp, X, ArrowRightCircle, XCircle,
  Mail, RefreshCw, Building2, Briefcase, Check, Loader2, Copy,
} from 'lucide-react';

type StatusFilter = 'all' | IntakeTicket['status'];

const STATUS_LABELS: Record<IntakeTicket['status'], string> = {
  new:       'New',
  'in-review': 'In Review',
  converted: 'Converted',
  declined:  'Declined',
};

const STATUS_STYLES: Record<IntakeTicket['status'], string> = {
  new:         'text-[#2D4A2D] bg-[rgba(168,230,207,0.3)] border-[rgba(168,230,207,0.5)]',
  'in-review': 'text-[#f59e0b] bg-[#f59e0b20] border-[#f59e0b40]',
  converted:   'text-[#4CAF50] bg-[#4CAF5020] border-[#4CAF5040]',
  declined:    'text-[#94a3b8] bg-[#94a3b820] border-[#94a3b840]',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtSalary(min: number, max: number) {
  if (!min && !max) return '—';
  const fmt = (n: number) => n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min || max);
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<IntakeTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Decline modal
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [sendDeclineEmail, setSendDeclineEmail] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intake');
      if (res.ok) setTickets(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, data: Partial<IntakeTicket>) => {
    const res = await fetch(`/api/intake/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated: IntakeTicket = await res.json();
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
    }
  };

  const markInReview = async (id: string) => {
    await patch(id, { status: 'in-review' });
  };

  const sendConfirmation = async (ticket: IntakeTicket) => {
    const gmailToken = storage.getGmailToken();
    if (!gmailToken) {
      alert('Connect Gmail first (via the Email page) to send confirmation emails.');
      return;
    }
    setActionLoading(ticket.id + '_confirm');
    try {
      const tokens = JSON.parse(gmailToken);
      const body = `Hi ${ticket.contactName},

Thank you for reaching out to Orchard.

We've received your request for a ${ticket.roleTitle} at ${ticket.companyName} and I'll be in touch within 24 hours to discuss next steps.

Best regards,
Dani Leeflang
Orchard
dani@orchard.io
+31 6 40 20 99 66`;

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          to: ticket.contactEmail,
          subject: `Your hiring request — ${ticket.roleTitle} at ${ticket.companyName}`,
          body,
        }),
      });
      if (res.ok) {
        await patch(ticket.id, { confirmationSent: true });
        alert('Confirmation email sent.');
      } else {
        alert('Failed to send email. Check Gmail connection.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const convertToClient = async (ticket: IntakeTicket) => {
    setActionLoading(ticket.id + '_convert');
    try {
      const now = new Date().toISOString();
      const clientId = uuidv4();

      const newClient: Client = {
        id: clientId,
        companyName: ticket.companyName,
        website: undefined,
        sector: 'Technology',
        size: 'startup',
        type: 'prospect',
        contactName: ticket.contactName,
        contactEmail: ticket.contactEmail,
        contactPhone: '',
        contactRole: '',
        location: ticket.city,
        notes: `Intake request submitted ${fmtDate(ticket.createdAt)}\n\nDescription:\n${ticket.description}${ticket.source ? `\n\nSource: ${ticket.source}` : ''}`,
        feeAgreement: { type: 'standard' },
        guaranteePeriod: 3,
        timeline: [{
          id: uuidv4(),
          type: 'created',
          content: `Client created from intake ticket — ${ticket.roleTitle}`,
          createdAt: now,
        }],
        createdAt: now,
        updatedAt: now,
      };

      const vacancyId = uuidv4();
      const newVacancy: Vacancy = {
        id: vacancyId,
        title: ticket.roleTitle,
        company: ticket.companyName,
        salaryMin: ticket.salaryMin,
        salaryMax: ticket.salaryMax,
        currency: 'EUR',
        requirements: [],
        seniorityLevel: ticket.seniorityLevel,
        description: [
          ticket.description,
          `Work type: ${ticket.workType}`,
          ticket.city ? `City: ${ticket.city}` : '',
        ].filter(Boolean).join('\n\n'),
        status: 'open',
        stage: 'intake' as const,
        stageLog: [],
        clientFeedback: [],
        createdAt: now,
      };

      await Promise.all([
        db.getClients().then(clients => db.saveClients([...clients, newClient])),
        db.getVacancies().then(vacancies => db.saveVacancies([...vacancies, newVacancy])),
      ]);

      await patch(ticket.id, { status: 'converted' });
      alert(`✓ Created client "${ticket.companyName}" and vacancy "${ticket.roleTitle}".`);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDecline = async () => {
    if (!declineId) return;
    const ticket = tickets.find(t => t.id === declineId);
    if (!ticket) return;

    setActionLoading(declineId + '_decline');
    try {
      if (sendDeclineEmail) {
        const gmailToken = storage.getGmailToken();
        if (gmailToken) {
          const tokens = JSON.parse(gmailToken);
          const body = `Hi ${ticket.contactName},

Thank you for reaching out to Orchard about the ${ticket.roleTitle} role at ${ticket.companyName}.

After careful consideration, we're unable to take on this search at this time. This may be due to capacity constraints or the role not being within our current focus areas.

We appreciate your interest and wish you success in your search.

Best regards,
Dani Leeflang
Orchard`;

          await fetch('/api/gmail/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokens,
              to: ticket.contactEmail,
              subject: `Re: Hiring request — ${ticket.roleTitle}`,
              body,
            }),
          });
        }
      }
      await patch(declineId, { status: 'declined' });
    } finally {
      setActionLoading(null);
      setDeclineId(null);
    }
  };

  const copyLink = () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/intake`
      : '/intake';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = tickets.filter(t => filter === 'all' || t.status === filter);
  const counts = {
    all: tickets.length,
    new: tickets.filter(t => t.status === 'new').length,
    'in-review': tickets.filter(t => t.status === 'in-review').length,
    converted: tickets.filter(t => t.status === 'converted').length,
    declined: tickets.filter(t => t.status === 'declined').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2D4A2D]">Intake Tickets</h1>
          <p className="text-[#94a3b8] mt-1">
            {counts.new > 0
              ? `${counts.new} new request${counts.new !== 1 ? 's' : ''} waiting`
              : 'Incoming hiring requests'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-[#FFFFFF] hover:bg-[rgba(45,74,45,0.15)] border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {copied ? <><Check size={14} className="text-green-400" /> Copied!</> : <><Copy size={14} /> Copy intake link</>}
          </button>
          <button
            onClick={load}
            className="p-2 bg-[#FFFFFF] hover:bg-[rgba(45,74,45,0.15)] border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Shareable link card */}
      <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-[#2D4A2D20] border border-[#2D4A2D40] flex items-center justify-center flex-shrink-0">
          <Inbox size={14} className="text-[#a8e6cf]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#2D4A2D] text-sm font-medium">Public intake form</p>
          <p className="text-[#94a3b8] text-xs truncate">
            Share this in cold emails: <span className="text-[#a8e6cf]">{typeof window !== 'undefined' ? window.location.origin : ''}/intake</span>
          </p>
        </div>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {(['all', 'new', 'in-review', 'converted', 'declined'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
              filter === s
                ? 'bg-[#2D4A2D] text-white'
                : 'bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:text-[#2D4A2D] hover:border-[#2D4A2D40]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as IntakeTicket['status']]}
            {' '}
            <span className={filter === s ? 'text-[#2D4A2D]/70' : 'text-[#6B7280]'}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center gap-3 text-[#94a3b8] py-16 justify-center">
          <Loader2 size={18} className="animate-spin" /> Loading tickets...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-16 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-[rgba(45,74,45,0.15)]" />
          <p className="text-[#2D4A2D] font-medium mb-1">No tickets yet</p>
          <p className="text-[#94a3b8] text-sm">Share the intake link to start receiving requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const isExpanded = expanded === ticket.id;
            return (
              <div
                key={ticket.id}
                className={`bg-[#FFFFFF] border rounded-xl transition-colors ${
                  ticket.status === 'new' ? 'border-[#2D4A2D40]' : 'border-[rgba(45,74,45,0.15)]'
                }`}
              >
                {/* Row */}
                <button
                  onClick={() => {
                    setExpanded(isExpanded ? null : ticket.id);
                    if (!isExpanded && ticket.status === 'new') markInReview(ticket.id);
                  }}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    ticket.status === 'new' ? 'bg-[#a8e6cf]' :
                    ticket.status === 'in-review' ? 'bg-[#f59e0b]' :
                    ticket.status === 'converted' ? 'bg-[#4CAF50]' : 'bg-[#6B7280]'
                  }`} />

                  <div className="flex-1 min-w-0 grid grid-cols-4 gap-3 items-center">
                    <div className="col-span-1">
                      <p className="text-[#2D4A2D] font-semibold text-sm truncate">{ticket.companyName}</p>
                      <p className="text-[#94a3b8] text-xs truncate">{ticket.contactName}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[#2D4A2D] text-sm truncate">{ticket.roleTitle}</p>
                      <p className="text-[#94a3b8] text-xs">{ticket.seniorityLevel}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[#94a3b8] text-xs">{fmtDate(ticket.createdAt)}</p>
                      <p className="text-[#6B7280] text-xs">{fmtSalary(ticket.salaryMin, ticket.salaryMax)}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-[#6B7280]">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[rgba(45,74,45,0.15)] px-4 py-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4 text-sm">
                      <div>
                        <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">Contact</p>
                        <p className="text-[#2D4A2D]">{ticket.contactName}</p>
                        <p className="text-[#a8e6cf] text-xs">{ticket.contactEmail}</p>
                      </div>
                      <div>
                        <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">Location &amp; Work type</p>
                        <p className="text-[#2D4A2D] capitalize">{ticket.workType}{ticket.city ? ` — ${ticket.city}` : ''}</p>
                      </div>
                      <div>
                        <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">Salary range</p>
                        <p className="text-[#2D4A2D]">{fmtSalary(ticket.salaryMin, ticket.salaryMax)}</p>
                      </div>
                      {ticket.source && (
                        <div>
                          <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">Source</p>
                          <p className="text-[#2D4A2D]">{ticket.source}</p>
                        </div>
                      )}
                      {ticket.description && (
                        <div className="col-span-2">
                          <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-1">Description</p>
                          <p className="text-[#94a3b8] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {ticket.status !== 'converted' && ticket.status !== 'declined' && (
                      <div className="flex items-center gap-2 pt-3 border-t border-[rgba(45,74,45,0.15)] flex-wrap">
                        {/* Confirm email */}
                        <button
                          onClick={() => sendConfirmation(ticket)}
                          disabled={!!actionLoading || ticket.confirmationSent}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            ticket.confirmationSent
                              ? 'bg-[#4CAF5020] text-[#4CAF50] border border-[#4CAF5040] cursor-default'
                              : 'bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] border border-[rgba(45,74,45,0.15)]'
                          }`}
                        >
                          {actionLoading === ticket.id + '_confirm'
                            ? <Loader2 size={12} className="animate-spin" />
                            : ticket.confirmationSent
                            ? <><Check size={12} /> Confirmation sent</>
                            : <><Mail size={12} /> Send confirmation</>
                          }
                        </button>

                        {/* Convert */}
                        <button
                          onClick={() => convertToClient(ticket)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                        >
                          {actionLoading === ticket.id + '_convert'
                            ? <Loader2 size={12} className="animate-spin" />
                            : <><ArrowRightCircle size={12} /> Convert to Client + Vacancy</>
                          }
                        </button>

                        {/* Decline */}
                        <button
                          onClick={() => { setDeclineId(ticket.id); setSendDeclineEmail(true); }}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-[rgba(45,74,45,0.15)] hover:bg-[#ef444420] hover:border-[#ef444440] text-[#94a3b8] hover:text-[#ef4444] border border-[rgba(45,74,45,0.15)] px-3 py-2 rounded-lg text-xs font-medium transition-colors ml-auto"
                        >
                          <XCircle size={12} /> Decline
                        </button>
                      </div>
                    )}

                    {/* Converted or declined state */}
                    {ticket.status === 'converted' && (
                      <div className="pt-3 border-t border-[rgba(45,74,45,0.15)] flex items-center gap-2">
                        <Building2 size={12} className="text-[#4CAF50]" />
                        <p className="text-[#4CAF50] text-xs">Converted — client and vacancy created in dashboard.</p>
                      </div>
                    )}
                    {ticket.status === 'declined' && (
                      <div className="pt-3 border-t border-[rgba(45,74,45,0.15)] flex items-center gap-2">
                        <X size={12} className="text-[#94a3b8]" />
                        <p className="text-[#94a3b8] text-xs">Declined.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decline modal */}
      {declineId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-[#2D4A2D] font-semibold mb-2">Decline request</h3>
            <p className="text-[#94a3b8] text-sm mb-4">
              This will mark the ticket as declined.
            </p>
            <label className="flex items-center gap-2.5 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={sendDeclineEmail}
                onChange={e => setSendDeclineEmail(e.target.checked)}
                className="w-4 h-4 accent-[#2D4A2D]"
              />
              <span className="text-sm text-[#94a3b8]">Send a polite rejection email</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={confirmDecline}
                disabled={!!actionLoading}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Decline'}
              </button>
              <button
                onClick={() => setDeclineId(null)}
                className="flex-1 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

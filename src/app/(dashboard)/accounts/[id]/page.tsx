'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, X, Radar, Globe, MapPin, UserPlus, Loader2,
  Link2, Phone, Trash2, UserCheck, Gauge, ClipboardList, Briefcase, ExternalLink,
} from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import { computeBuyingScore, scoreColor } from '@/lib/buyingScore';
import { useDialer } from '@/lib/dialer-context';
import { useT } from '@/lib/i18n';
import PitchPanel from '@/components/PitchPanel';
import LogActivityModal from '@/components/LogActivityModal';
import type {
  Account, AccountLead, AgencyPositioning, LeadSeniority, PitchRecord,
  SuggestedPerson, AccountStage, Activity, Signal,
} from '@/lib/accountTypes';
import { isClient } from '@/lib/accountTypes';
import { db, initDb } from '@/lib/db';
import type { Vacancy, CandidateVacancyMatch, Placement, TimelineEvent } from '@/lib/types';
import Link from 'next/link';
import { getTimeline } from '@/lib/timeline';

interface LiveVacancy {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string;
  url: string;
  category: string;
  postedAt: string;
}

const SENIORITIES: LeadSeniority[] = ['C-level', 'Director', 'Manager', 'Lead', 'Other'];
const EMPTY_POSITIONING: AgencyPositioning = { agencyName: '', repName: '', niche: '', services: [], differentiator: '', proofPoints: [] };
const STAGES: AccountStage[] = ['new', 'contacted', 'engaged', 'meeting', 'client', 'dormant', 'lost'];

const STAGE_COLOR: Record<AccountStage, string> = {
  new: C.faint,
  contacted: C.blue,
  engaged: C.amber,
  meeting: C.green,
  won: C.green,
  client: C.green,
  dormant: C.faint,
  lost: C.red,
};

const OUTCOME_ICON: Record<string, string> = {
  no_answer: '📵', voicemail: '📬', gatekeeper: '🚪', callback: '🔁',
  meeting_booked: '✅', not_interested: '❌', note: '📝',
};

export default function AccountDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = ['owner', 'admin'].includes(session?.user?.role ?? '');
  const agencyId = session?.user?.agencyId as string | undefined;
  const dialer = useDialer();
  const t = useT();
  const scoreLabelText = (k: string) =>
    k === 'high' ? t('High', 'Hoog') : k === 'medium' ? t('Medium', 'Gemiddeld') : k === 'low' ? t('Low', 'Laag') : t('No signal', 'Geen signaal');

  const [account, setAccount] = useState<Account | null>(null);
  const [clientVacancies, setClientVacancies] = useState<Vacancy[]>([]);
  const [matchesByVac, setMatchesByVac] = useState<Record<string, CandidateVacancyMatch[]>>({});
  const [revenue, setRevenue] = useState<Awaited<ReturnType<typeof accountsDb.getAccountRevenue>>>(null);
  const [accountPlacements, setAccountPlacements] = useState<Placement[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [leads, setLeads] = useState<AccountLead[]>([]);
  const [positioning, setPositioning] = useState<AgencyPositioning>(EMPTY_POSITIONING);
  const [pitchByLead, setPitchByLead] = useState<Record<string, PitchRecord | null>>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [liveVacancies, setLiveVacancies] = useState<LiveVacancy[]>([]);
  const [pushingSignals, setPushingSignals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [logLead, setLogLead] = useState<AccountLead | null | 'account'>(null);
  const [leadForm, setLeadForm] = useState({ name: '', role: '', seniority: 'Manager' as LeadSeniority, email: '', phone: '', linkedin: '' });

  useEffect(() => {
    (async () => {
      try {
        const acc = await accountsDb.getAccount(id);
        setAccount(acc);
        const [ls, pos, acts] = await Promise.all([
          accountsDb.getLeads(id),
          accountsDb.getPositioning(),
          accountsDb.getActivities(id),
        ]);
        setLeads(ls);
        if (pos) setPositioning(pos);
        setActivities(acts);
        const pitches: Record<string, PitchRecord | null> = {};
        await Promise.all(ls.map(async (l) => (pitches[l.id] = await accountsDb.getLatestPitch(l.id))));
        setPitchByLead(pitches);
        // Load live vacancies from job boards (non-blocking)
        fetch(`/api/accounts/${id}/live-vacancies`)
          .then((r) => r.json())
          .then((d) => setLiveVacancies(d.listings ?? []))
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!account || !agencyId || !isClient(account)) return;
    initDb(agencyId);
    // Load vacancies linked by FK first; fall back to company-name match for legacy data
    db.getVacancies().then((vacs) => {
      const linked = vacs.filter(
        (v) => v.accountId === account.id || v.company.toLowerCase() === account.companyName.toLowerCase(),
      );
      setClientVacancies(linked);
      Promise.all(linked.map((v) => db.getMatchesByVacancy(v.id))).then((all) => {
        const byVac: Record<string, CandidateVacancyMatch[]> = {};
        linked.forEach((v, i) => { byVac[v.id] = all[i]; });
        setMatchesByVac(byVac);
      });
    });
    // Load revenue summary
    accountsDb.getAccountRevenue(account.id).then(setRevenue).catch(() => {});
    // Load placements linked to this account
    db.getPlacements().then(all => setAccountPlacements(all.filter(p => p.accountId === account.id))).catch(() => {});
    // Load timeline
    getTimeline({ accountId: account.id, limit: 20 }).then(setTimeline).catch(() => {});
  }, [account, agencyId]);

  async function setStage(stage: AccountStage) {
    if (!account) return;
    await accountsDb.updateAccount(account.id, { stage });
    setAccount({ ...account, stage });
  }

  async function enrich() {
    if (!account) return;
    setEnriching(true);
    try {
      const res = await fetch('/api/enrich-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: account.website, companyName: account.companyName, location: account.location }),
      });
      if (!res.ok) throw new Error(t('Enrichment failed', 'Verrijken mislukt'));
      const data = await res.json();
      const signals = Array.isArray(data.signals) ? data.signals : [];
      const people: SuggestedPerson[] = Array.isArray(data.people) ? data.people : [];
      const enrichedAt = new Date().toISOString();
      await accountsDb.updateAccount(account.id, { signals, keyPeople: people, enrichedAt });
      setAccount({ ...account, signals, keyPeople: people, enrichedAt });
      toast.success(`${signals.length} ${t('signal(s)', 'signaal(en)')}, ${people.length} ${t('contact(s)', 'contact(en)')}`);
    } catch {
      toast.error(t('Enrichment failed', 'Verrijken mislukt'));
    } finally {
      setEnriching(false);
    }
  }

  async function addLead(values?: Partial<typeof leadForm>) {
    if (!account) return;
    const v = { ...leadForm, ...values };
    if (!v.name.trim() || !v.role.trim()) return;
    const lead = await accountsDb.addLead({ accountId: account.id, ...v });
    setLeads((l) => [...l, lead]);
    setLeadForm({ name: '', role: '', seniority: 'Manager', email: '', phone: '', linkedin: '' });
    setShowLead(false);
  }

  async function addPersonAsLead(person: SuggestedPerson) {
    if (!account) return;
    await addLead({ name: person.name, role: person.role, seniority: 'Other', linkedin: person.linkedin ?? '' });
    const keyPeople = (account.keyPeople ?? []).filter((p) => p.name !== person.name);
    await accountsDb.updateAccount(account.id, { keyPeople });
    setAccount({ ...account, keyPeople });
    toast.success(`${person.name} ${t('added as lead', 'toegevoegd als lead')}`);
  }

  async function deleteAccount() {
    if (!account) return;
    if (!confirm(t(`Delete "${account.companyName}"? This also removes its leads and pitches.`, `"${account.companyName}" verwijderen? Dit verwijdert ook de leads en pitches.`))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || t('Delete failed', 'Verwijderen mislukt'));
      toast.success(t('Account deleted', 'Account verwijderd'));
      router.push('/accounts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Delete failed', 'Verwijderen mislukt'));
      setDeleting(false);
    }
  }

  function handleActivitySaved(newStage?: AccountStage) {
    if (newStage && account) setAccount({ ...account, stage: newStage });
    accountsDb.getActivities(id).then(setActivities);
    setLogLead(null);
  }

  async function pushVacanciesAsSignals() {
    if (!account || liveVacancies.length === 0) return;
    setPushingSignals(true);
    try {
      const newSignals: Signal[] = liveVacancies.map((v) => ({
        type: 'open_role' as const,
        summary: v.title,
        source: v.source,
        date: v.postedAt ? v.postedAt.split('T')[0] : undefined,
      }));
      const existing = account.signals ?? [];
      const existingSummaries = new Set(existing.map((s) => s.summary));
      const toAdd = newSignals.filter((s) => !existingSummaries.has(s.summary));
      if (toAdd.length === 0) { toast.success(t('Already in signals', 'Al in signalen')); return; }
      const merged = [...existing, ...toAdd];
      await accountsDb.updateAccount(account.id, { signals: merged, enrichedAt: new Date().toISOString() });
      setAccount({ ...account, signals: merged });
      toast.success(`${toAdd.length} ${t('signal(s) added', 'signaal/signalen toegevoegd')}`);
    } catch {
      toast.error(t('Failed to add signals', 'Signalen toevoegen mislukt'));
    } finally {
      setPushingSignals(false);
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: C.muted }}>{t('Loading...', 'Laden...')}</div>;
  if (!account) return <div className="p-8 text-sm" style={{ color: C.muted }}>{t('Account not found.', 'Account niet gevonden.')}</div>;

  const positioningSet = positioning.agencyName || positioning.differentiator;
  const score = computeBuyingScore(account.signals);
  const linkedinUrl = account.linkedin
    ? account.linkedin.startsWith('http') ? account.linkedin : `https://${account.linkedin}`
    : null;
  const currentStage = account.stage ?? 'new';

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <button onClick={() => router.push('/accounts')} className="mb-4 inline-flex items-center gap-1 text-sm" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> Accounts
      </button>

      <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>
              {account.companyName}
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: C.muted }}>
              {account.sector && <span>{account.sector}</span>}
              {account.size && <span>{account.size}</span>}
              {account.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {account.location}
                </span>
              )}
              {account.website && (
                <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: C.primary }}>
                  <Globe size={13} /> website
                </a>
              )}
              {linkedinUrl && (
                <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: C.primary }}>
                  <Link2 size={13} /> LinkedIn
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enrich}
              disabled={enriching}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{ border: `1px solid ${C.border}`, color: C.primary }}
            >
              {enriching ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
              {enriching ? t('Searching...', 'Zoeken...') : t('Enrich signals', 'Verrijk signalen')}
            </button>
            {isAdmin && (
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                style={{ border: `1px solid ${C.border}`, color: '#C0392B' }}
              >
                <Trash2 size={14} /> {t('Delete', 'Verwijderen')}
              </button>
            )}
          </div>
        </div>

        {/* Stage selector */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className="rounded-full px-3 py-1 text-xs font-medium capitalize transition-all"
              style={{
                background: currentStage === s ? STAGE_COLOR[s] : 'transparent',
                color: currentStage === s ? 'white' : C.muted,
                border: `1px solid ${currentStage === s ? STAGE_COLOR[s] : C.border}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Buying score */}
        <div className="mt-4 flex items-center gap-4 rounded-xl p-4" style={{ background: C.bg }}>
          <div className="flex items-center gap-2">
            <Gauge size={18} style={{ color: scoreColor(score.label) }} />
            <div>
              <div className="text-xs" style={{ color: C.muted }}>{t('Buying score', 'Koopkans')}</div>
              <div className="text-lg font-semibold" style={{ color: scoreColor(score.label) }}>
                {score.score} <span className="text-sm font-normal">· {scoreLabelText(score.label)}</span>
              </div>
            </div>
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: C.border }}>
            <div className="h-full rounded-full" style={{ width: `${score.score}%`, background: scoreColor(score.label) }} />
          </div>
        </div>

        {(account.signals?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
              {t('Signals', 'Signalen')}
            </span>
            <div className="flex flex-wrap gap-2">
              {(account.signals ?? []).map((s, i) => (
                <span key={i} className="rounded-lg px-2.5 py-1 text-xs" style={{ background: C.bg, color: C.primary }} title={s.summary}>
                  {s.type.replace('_', ' ')}: {s.summary.slice(0, 60)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live vacancies from job boards */}
        {liveVacancies.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                <Briefcase size={12} />
                {t('Open roles on job boards', 'Open rollen op jobboards')}
                <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold" style={{ background: C.pill, color: C.pillText }}>
                  {liveVacancies.length}
                </span>
              </span>
              <button
                onClick={pushVacanciesAsSignals}
                disabled={pushingSignals}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                style={{ border: `1px solid ${C.border}`, color: C.primary }}
              >
                {pushingSignals ? <Loader2 size={11} className="animate-spin" /> : <Radar size={11} />}
                {t('Add all as signals', 'Voeg toe als signalen')}
              </button>
            </div>
            <div className="space-y-1">
              {liveVacancies.slice(0, 8).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: C.bg }}
                >
                  <span className="flex-1 truncate font-medium" style={{ color: C.primary }}>{v.title}</span>
                  <span className="rounded-full px-2 py-0.5 capitalize" style={{ background: 'rgba(45,74,45,0.08)', color: C.muted }}>
                    {v.category}
                  </span>
                  <span style={{ color: C.faint }}>{v.source}</span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: C.primary }}
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key people */}
      {(account.keyPeople?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            {t('Found contacts', 'Gevonden contactpersonen')}
          </h2>
          <div className="space-y-2">
            {(account.keyPeople ?? []).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: C.bg }}>
                <div>
                  <span className="font-medium" style={{ color: C.primary }}>{p.name}</span>
                  <span className="ml-2 text-sm" style={{ color: C.muted }}>{p.role}</span>
                </div>
                <button
                  onClick={() => addPersonAsLead(p)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
                  style={{ border: `1px solid ${C.border}`, color: C.primary }}
                >
                  <UserCheck size={13} /> {t('As lead', 'Als lead')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!positioningSet && (
        <button
          onClick={() => router.push('/positioning')}
          className="mt-4 block w-full rounded-xl p-3 text-left text-sm"
          style={{ background: '#FEF3C7', color: '#92400E' }}
        >
          {t('Set up your agency positioning for sharper pitches. Click here.', 'Stel je bureau-positionering in voor scherpere pitches. Klik hier.')}
        </button>
      )}

      {/* Leads */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: C.primary }}>
          {t('Leads', 'Leads')}
        </h2>
        <button onClick={() => setShowLead(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: C.primary }}>
          <UserPlus size={15} /> {t('Add lead', 'Lead toevoegen')}
        </button>
      </div>

      <div className="mt-3 space-y-4">
        {leads.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>
            {t('No leads yet. Add a contact to generate a pitch.', 'Nog geen leads. Voeg een contactpersoon toe om een pitch te genereren.')}
          </p>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium" style={{ color: C.primary }}>{lead.name}</span>
                  <span className="ml-2 text-sm" style={{ color: C.muted }}>
                    {lead.role}{lead.seniority ? ` · ${lead.seniority}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setLogLead(lead)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{ border: `1px solid ${C.border}`, color: C.primary }}
                  >
                    <ClipboardList size={13} /> {t('Log', 'Log')}
                  </button>
                  <button
                    onClick={() => dialer.loadLead(lead.name, lead.phone)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{ border: `1px solid ${C.border}`, color: lead.phone ? C.primary : C.muted }}
                  >
                    <Phone size={13} /> {t('Call', 'Bellen')}
                  </button>
                </div>
              </div>
              <PitchPanel account={account} lead={lead} positioning={positioning} initialPitch={pitchByLead[lead.id] ?? null} />
              {/* Vacancies where this lead is the hiring manager */}
              {(() => {
                const linkedVacs = clientVacancies.filter(v => v.contactId === lead.id);
                if (linkedVacs.length === 0) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {linkedVacs.map(v => (
                      <Link key={v.id} href={`/vacancies?id=${v.id}`} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full hover:opacity-80" style={{ background: `${C.primary}18`, color: C.primary }}>
                        <Briefcase size={10} /> {v.title}
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))
        )}
      </div>

      {/* Activity history */}
      {activities.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: C.primary }}>{t('Activity log', 'Activiteiten')}</h2>
            <button
              onClick={() => setLogLead('account')}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: C.primary }}
            >
              <ClipboardList size={13} /> {t('Log activity', 'Log activiteit')}
            </button>
          </div>
          <div className="space-y-2">
            {activities.slice(0, 8).map((act) => (
              <div key={act.id} className="flex items-start gap-3 rounded-lg p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <span className="text-base leading-none mt-0.5">{OUTCOME_ICON[act.outcome] ?? '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                    <span className="capitalize font-medium" style={{ color: C.primary }}>{act.type}</span>
                    <span>·</span>
                    <span>{act.outcome.replace(/_/g, ' ')}</span>
                    {act.nextStepDate && (
                      <span className="ml-auto" style={{ color: C.amber }}>→ {act.nextStepDate}</span>
                    )}
                  </div>
                  {act.note && <p className="mt-1 text-xs" style={{ color: C.muted }}>{act.note}</p>}
                  <p className="mt-0.5 text-xs" style={{ color: C.faint }}>
                    {new Date(act.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activities.length === 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setLogLead('account')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}
          >
            <ClipboardList size={14} /> {t('Log first activity', 'Log eerste activiteit')}
          </button>
        </div>
      )}

      {/* Add lead modal */}
      {showLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowLead(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: C.primary }}>{t('Add lead', 'Lead toevoegen')}</h3>
              <button onClick={() => setShowLead(false)}><X size={18} style={{ color: C.muted }} /></button>
            </div>
            <div className="space-y-3">
              <LField label={t('Name *', 'Naam *')} value={leadForm.name} onChange={(v) => setLeadForm({ ...leadForm, name: v })} />
              <LField label={t('Role *', 'Rol *')} value={leadForm.role} onChange={(v) => setLeadForm({ ...leadForm, role: v })} />
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{t('Seniority', 'Seniority')}</label>
                <select
                  value={leadForm.seniority}
                  onChange={(e) => setLeadForm({ ...leadForm, seniority: e.target.value as LeadSeniority })}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  {SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <LField label={t('Email', 'E-mail')} value={leadForm.email} onChange={(v) => setLeadForm({ ...leadForm, email: v })} />
              <LField label={t('Phone', 'Telefoon')} value={leadForm.phone} onChange={(v) => setLeadForm({ ...leadForm, phone: v })} />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button onClick={() => addLead()} disabled={!leadForm.name.trim() || !leadForm.role.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: C.primary }}>
                <Plus size={14} /> {t('Add', 'Toevoegen')}
              </button>
              <button onClick={() => setShowLead(false)} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
                {t('Cancel', 'Annuleren')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client delivery section */}
      {isClient(account) && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: C.primary }}>
              Client delivery
            </h2>
            {revenue && revenue.placementCount > 0 && (
              <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                <span>
                  <span className="font-semibold" style={{ color: C.primary }}>
                    €{revenue.totalFees.toLocaleString()}
                  </span>{' '}total fees
                </span>
                {revenue.collectedFees > 0 && (
                  <span>
                    <span className="font-semibold" style={{ color: C.green }}>
                      €{revenue.collectedFees.toLocaleString()}
                    </span>{' '}collected
                  </span>
                )}
                <span>{revenue.placementCount} placement{revenue.placementCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {clientVacancies.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No vacancies linked to this client yet.{' '}
              <Link href="/vacancies" style={{ color: C.primary }}>Add a vacancy</Link> and link it to this account.
            </p>
          ) : (
            <div className="space-y-3">
              {clientVacancies.map((vac) => {
                const matches = matchesByVac[vac.id] ?? [];
                const active = matches.filter((m) => ['active', 'on-hold', 'submitted', 'interviewing', 'offer'].includes(m.status));
                const placed = matches.filter((m) => m.status === 'placed');
                const statusLabel: Record<string, string> = { open: 'Active', 'on-hold': 'On hold', closed: 'Filled' };
                const statusColor: Record<string, string> = { open: C.green, 'on-hold': C.amber, closed: C.faint };
                return (
                  <Link key={vac.id} href={`/vacancies?id=${vac.id}`} className="block rounded-xl p-4 transition-colors" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: C.primary }}>{vac.title}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: C.muted }}>
                          {vac.stage.replace(/_/g, ' ')}
                        </p>
                        {(active.length > 0 || placed.length > 0) && (
                          <p className="text-xs mt-1.5" style={{ color: C.muted }}>
                            {active.length > 0 && `${active.length} in pipeline`}
                            {active.length > 0 && placed.length > 0 && ' · '}
                            {placed.length > 0 && `${placed.length} placed`}
                          </p>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${statusColor[vac.status]}22`, color: statusColor[vac.status] }}>
                        {statusLabel[vac.status] ?? vac.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Placements from this account */}
      {accountPlacements.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-3" style={{ color: C.primary }}>Placements</h2>
          <div className="space-y-2">
            {accountPlacements.map(p => {
              const invoiceColor = p.invoiceStatus === 'paid' ? C.green : p.invoiceStatus === 'sent' ? C.amber : C.faint;
              const invoiceLabel = p.invoiceStatus === 'paid' ? 'Paid' : p.invoiceStatus === 'sent' ? 'Invoiced' : 'Draft';
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex-1 min-w-0">
                    {p.profileId ? (
                      <Link href={`/candidates/${p.profileId}`} className="text-sm font-medium hover:underline underline-offset-2" style={{ color: C.primary }}>
                        {p.candidateName}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium" style={{ color: C.primary }}>{p.candidateName}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{p.jobTitle} · {p.placementDate}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <p className="text-sm font-semibold" style={{ color: C.primary }}>
                      {(p.feeAmount ?? 0) > 0 ? `€${p.feeAmount!.toLocaleString()}` : <span style={{ color: '#d97706', fontSize: '0.7rem' }}>Fee not set</span>}
                    </p>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${invoiceColor}22`, color: invoiceColor }}>
                      {invoiceLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified timeline feed */}
      {timeline.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-3" style={{ color: C.primary }}>Timeline</h2>
          <div className="space-y-2">
            {timeline.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: C.primary }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: C.primary }}>{ev.summary}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.faint }}>
                    {new Date(ev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log activity modal */}
      {logLead !== null && (
        <LogActivityModal
          accountId={account.id}
          currentStage={currentStage}
          lead={logLead === 'account' ? undefined : logLead}
          onClose={() => setLogLead(null)}
          onSaved={handleActivitySaved}
        />
      )}
    </div>
  );
}

function LField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
    </div>
  );
}

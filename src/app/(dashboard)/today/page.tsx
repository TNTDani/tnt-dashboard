'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CalendarClock, ClipboardList, Sparkles } from 'lucide-react';
import { C } from '@/lib/ui';
import { accountsDb } from '@/lib/accountsDb';
import { computeBuyingScore, scoreColor } from '@/lib/buyingScore';
import { useT } from '@/lib/i18n';
import LogActivityModal from '@/components/LogActivityModal';
import type { Account, Activity, AccountStage } from '@/lib/accountTypes';

const STAGE_COLOR: Record<string, string> = {
  new: C.faint, contacted: C.blue, engaged: C.amber, meeting: C.green, won: C.green, lost: C.red,
};

function whyNow(account: Account, nextStep?: Activity): string {
  if (nextStep) {
    const today = new Date().toISOString().slice(0, 10);
    const diff = Math.round((new Date(nextStep.nextStepDate!).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 0) return diff === 0 ? 'Follow-up due today' : `Follow-up overdue by ${-diff}d`;
  }
  if (account.signals?.length) return account.signals[0].summary.slice(0, 70);
  return 'No contact yet';
}

export default function TodayPage() {
  const t = useT();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nextSteps, setNextSteps] = useState<Record<string, Activity>>({});
  const [loading, setLoading] = useState(true);
  const [logFor, setLogFor] = useState<Account | null>(null);

  useEffect(() => {
    Promise.all([accountsDb.getAccounts(), accountsDb.getActivitiesWithNextStep()])
      .then(([accs, steps]) => {
        setAccounts(accs.filter((a) => a.stage !== 'won' && a.stage !== 'lost'));
        setNextSteps(steps);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const sorted = [...accounts].sort((a, b) => {
    const aStep = nextSteps[a.id];
    const bStep = nextSteps[b.id];
    const aOverdue = aStep?.nextStepDate && aStep.nextStepDate <= today ? 1 : 0;
    const bOverdue = bStep?.nextStepDate && bStep.nextStepDate <= today ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return computeBuyingScore(b.signals).score - computeBuyingScore(a.signals).score;
  });

  const dueCount = sorted.filter((a) => {
    const s = nextSteps[a.id];
    return s?.nextStepDate && s.nextStepDate <= today;
  }).length;

  if (loading) return <div className="p-8 text-sm" style={{ color: C.muted }}>{t('Loading...', 'Laden...')}</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: C.primary }}>{t('Today', 'Vandaag')}</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {dueCount > 0 && <span style={{ color: C.amber }}> · {dueCount} {t('due', 'vervallen')}</span>}
          {' · '}{sorted.length} {t('active', 'actief')}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
          {t('No active accounts.', 'Geen actieve accounts.')}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((account) => {
            const step = nextSteps[account.id];
            const isOverdue = step?.nextStepDate && step.nextStepDate <= today;
            const score = computeBuyingScore(account.signals);
            const stage = account.stage ?? 'new';
            return (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: C.surface,
                  border: `1px solid ${isOverdue ? C.amber : C.border}`,
                }}
              >
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/accounts/${account.id}`)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 size={14} style={{ color: C.primary }} />
                    <span className="font-medium text-sm" style={{ color: C.primary }}>{account.companyName}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs capitalize"
                      style={{ background: `${STAGE_COLOR[stage]}20`, color: STAGE_COLOR[stage] }}
                    >
                      {stage}
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        <CalendarClock size={11} /> {t('due', 'due')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs" style={{ color: C.muted }}>{whyNow(account, step)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(score.label) }}>{score.score}</span>
                  <button
                    onClick={() => setLogFor(account)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                    style={{ border: `1px solid ${C.border}`, color: C.primary }}
                  >
                    <ClipboardList size={13} /> {t('Log', 'Log')}
                  </button>
                  <button
                    onClick={() => router.push(`/accounts/${account.id}`)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white"
                    style={{ background: C.primary }}
                  >
                    <Sparkles size={13} /> {t('Open', 'Open')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logFor && (
        <LogActivityModal
          accountId={logFor.id}
          currentStage={logFor.stage ?? 'new'}
          onClose={() => setLogFor(null)}
          onSaved={(newStage?: AccountStage) => {
            if (newStage) setAccounts((prev) => prev.map((a) => a.id === logFor.id ? { ...a, stage: newStage } : a));
            accountsDb.getActivitiesWithNextStep().then(setNextSteps);
            setLogFor(null);
          }}
        />
      )}
    </div>
  );
}

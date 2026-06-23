'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { C } from '@/lib/ui';
import { useT } from '@/lib/i18n';
import { accountsDb } from '@/lib/accountsDb';
import type { ActivityType, ActivityOutcome, AccountStage, AccountLead } from '@/lib/accountTypes';

const OUTCOMES_BY_TYPE: Record<ActivityType, ActivityOutcome[]> = {
  call:     ['no_answer', 'voicemail', 'gatekeeper', 'callback', 'meeting_booked', 'not_interested'],
  email:    ['callback', 'meeting_booked', 'not_interested', 'note'],
  linkedin: ['callback', 'meeting_booked', 'not_interested', 'note'],
  meeting:  ['meeting_booked', 'callback', 'not_interested', 'note'],
  note:     ['note'],
};

// Stage to auto-advance to after certain outcomes
function nextStage(current: AccountStage, outcome: ActivityOutcome): AccountStage | null {
  if (outcome === 'meeting_booked' && ['new', 'contacted', 'engaged'].includes(current)) return 'meeting';
  if (['no_answer', 'voicemail', 'gatekeeper', 'callback'].includes(outcome) && current === 'new') return 'contacted';
  return null;
}

interface Props {
  accountId: string;
  currentStage: AccountStage;
  lead?: AccountLead;
  onClose: () => void;
  onSaved: (newStage?: AccountStage) => void;
}

export default function LogActivityModal({ accountId, currentStage, lead, onClose, onSaved }: Props) {
  const t = useT();
  const [type, setType] = useState<ActivityType>('call');
  const [outcome, setOutcome] = useState<ActivityOutcome>('no_answer');
  const [note, setNote] = useState('');
  const [nextStepDate, setNextStepDate] = useState('');
  const [saving, setSaving] = useState(false);

  const outcomes = OUTCOMES_BY_TYPE[type];
  const validOutcome: ActivityOutcome = outcomes.includes(outcome) ? outcome : outcomes[0];

  const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
    no_answer:       t('No answer', 'Geen gehoor'),
    voicemail:       'Voicemail',
    gatekeeper:      t('Gatekeeper', 'Doorverbinden'),
    callback:        t('Call back', 'Terugbellen'),
    meeting_booked:  t('Meeting booked', 'Meeting gepland'),
    not_interested:  t('Not interested', 'Geen interesse'),
    note:            t('Note', 'Notitie'),
  };

  async function save() {
    setSaving(true);
    try {
      await accountsDb.addActivity({
        accountId,
        leadId: lead?.id,
        type,
        outcome: validOutcome,
        note: note.trim() || undefined,
        nextStepDate: nextStepDate || undefined,
      });
      const advance = nextStage(currentStage, validOutcome);
      if (advance) await accountsDb.updateAccount(accountId, { stage: advance });
      toast.success(t('Activity logged', 'Activiteit gelogd'));
      onSaved(advance ?? undefined);
    } catch {
      toast.error(t('Failed to save', 'Opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: C.primary }}>
            {t('Log activity', 'Activiteit loggen')}
            {lead && <span className="ml-2 text-sm font-normal" style={{ color: C.muted }}>· {lead.name}</span>}
          </h3>
          <button onClick={onClose}><X size={16} style={{ color: C.muted }} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: C.muted }}>{t('Type', 'Type')}</label>
            <div className="flex flex-wrap gap-1.5">
              {(['call', 'email', 'linkedin', 'meeting', 'note'] as ActivityType[]).map((ty) => (
                <button
                  key={ty}
                  onClick={() => setType(ty)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize"
                  style={{
                    background: type === ty ? C.primary : 'transparent',
                    color: type === ty ? 'white' : C.primary,
                    border: `1px solid ${type === ty ? C.primary : C.border}`,
                  }}
                >
                  {ty}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: C.muted }}>{t('Outcome', 'Uitkomst')}</label>
            <div className="flex flex-wrap gap-1.5">
              {outcomes.map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: validOutcome === o ? C.primary : 'transparent',
                    color: validOutcome === o ? 'white' : C.primary,
                    border: `1px solid ${validOutcome === o ? C.primary : C.border}`,
                  }}
                >
                  {OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{t('Note (optional)', 'Notitie (optioneel)')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${C.border}` }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: C.muted }}>{t('Next step date (optional)', 'Volgende stap (optioneel)')}</label>
            <input
              type="date"
              value={nextStepDate}
              onChange={(e) => setNextStepDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${C.border}` }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: C.primary }}
          >
            {saving ? t('Saving...', 'Opslaan...') : t('Log', 'Loggen')}
          </button>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm" style={{ color: C.muted }}>
            {t('Cancel', 'Annuleren')}
          </button>
        </div>
      </div>
    </div>
  );
}

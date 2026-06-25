'use client';

import { useState } from 'react';
import { X, GitMerge } from 'lucide-react';
import { CandidateProfile, Vacancy, PipelineStatus, Candidate } from '@/lib/types';
import { storage } from '@/lib/storage';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const STAGES: { value: PipelineStatus; label: string }[] = [
  { value: 'sourced',     label: 'Sourced' },
  { value: 'screened',    label: 'Screened' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'placed',      label: 'Placed' },
];

interface Props {
  profile: CandidateProfile;
  vacancies: Vacancy[];
  onClose: () => void;
  onAdded: () => void;
  agencyId?: string;
}

export default function AddToPipelineModal({ profile, vacancies, onClose, onAdded, agencyId }: Props) {
  const [vacancyId, setVacancyId] = useState('');
  const [stage, setStage] = useState<PipelineStatus>('sourced');

  const openVacancies = vacancies.filter(v => v.status === 'open');

  function confirm() {
    const candidate: Candidate & { profileId: string } = {
      id: uuidv4(),
      profileId: profile.id,
      firstName: `${profile.firstName} ${profile.lastName}`.trim(),
      currentRole: profile.jobTitle || '',
      currentCompany: '',
      skills: profile.branch ? [profile.branch] : [],
      status: stage,
      vacancyId: vacancyId || undefined,
      createdAt: new Date().toISOString(),
    };

    db.getCandidates().then(existing => {
      const alreadyIn = existing.some(c => (c as any).profileId === profile.id);
      if (!alreadyIn) {
        db.saveCandidates([...existing, candidate]);
      }
      if (agencyId) storage.clearLastViewedCandidate(agencyId);
      onAdded();
      onClose();
    });
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm w-full p-0 gap-0 rounded-xl border border-[rgba(45,74,45,0.15)] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(45,74,45,0.15)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center">
              <GitMerge size={13} className="text-[#2D4A2D]" />
            </div>
            <h2 className="text-[#2D4A2D] font-semibold text-sm">Add to Pipeline</h2>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Candidate summary */}
          <div className="flex items-center gap-3 p-3 bg-[#F7F7F5] border border-[rgba(45,74,45,0.1)] rounded-lg">
            <div className="w-9 h-9 rounded-full bg-[#2D4A2D]/20 flex items-center justify-center text-[#2D4A2D] font-bold text-sm flex-shrink-0">
              {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
            </div>
            <div>
              <p className="text-[#2D4A2D] text-sm font-medium">{profile.firstName} {profile.lastName}</p>
              <p className="text-[#94a3b8] text-xs">{profile.jobTitle || profile.branch || '—'}</p>
            </div>
          </div>

          {/* Vacancy selector */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
              Assign to vacancy <span className="text-[#6B7280]">(optional)</span>
            </label>
            <select
              value={vacancyId}
              onChange={e => setVacancyId(e.target.value)}
              className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D]"
            >
              <option value="">— No vacancy —</option>
              {openVacancies.map(v => (
                <option key={v.id} value={v.id}>{v.title} @ {v.company}</option>
              ))}
            </select>
            {openVacancies.length === 0 && (
              <p className="text-[#6B7280] text-xs mt-1">No open vacancies. You can assign one later.</p>
            )}
          </div>

          {/* Stage selector */}
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">Starting stage</label>
            <div className="grid grid-cols-5 gap-1">
              {STAGES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStage(s.value)}
                  className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    stage === s.value
                      ? 'bg-[#2D4A2D] text-white'
                      : 'bg-white border border-[rgba(45,74,45,0.15)] text-[#94a3b8] hover:border-[#2D4A2D] hover:text-[#2D4A2D]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-[rgba(45,74,45,0.15)]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-[rgba(45,74,45,0.08)] text-[#6B7280] hover:text-[#2D4A2D] border border-[rgba(45,74,45,0.15)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <GitMerge size={13} />
            Add to Pipeline
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

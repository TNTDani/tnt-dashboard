'use client';

import { useState } from 'react';
import { MessageSquare, Mail, RefreshCw, FileText, Plus } from 'lucide-react';
import { TimelineEntry } from '@/lib/types';

interface TimelineProps {
  entries: TimelineEntry[];
  onAddNote: (note: string) => void;
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDate.getTime() === todayStart.getTime()) {
    return `Today at ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (entryDate.getTime() === yesterdayStart.getTime()) {
    return `Yesterday at ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

function EntryIcon({ type }: { type: TimelineEntry['type'] }) {
  switch (type) {
    case 'note':
      return (
        <div className="w-7 h-7 rounded-full bg-[#2D4A2D20] border border-[#2D4A2D40] flex items-center justify-center flex-shrink-0">
          <MessageSquare size={13} className="text-[#2D4A2D]" />
        </div>
      );
    case 'email_sent':
      return (
        <div className="w-7 h-7 rounded-full bg-[#3b82f620] border border-[#3b82f640] flex items-center justify-center flex-shrink-0">
          <Mail size={13} className="text-[#3b82f6]" />
        </div>
      );
    case 'status_change':
      return (
        <div className="w-7 h-7 rounded-full bg-[#4CAF5020] border border-[#4CAF5040] flex items-center justify-center flex-shrink-0">
          <RefreshCw size={13} className="text-[#4CAF50]" />
        </div>
      );
    case 'cv_upload':
    case 'motivation_upload':
      return (
        <div className="w-7 h-7 rounded-full bg-[#f97316_20] border border-[#f9731640] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.25)' }}>
          <FileText size={13} className="text-orange-400" />
        </div>
      );
    case 'created':
    default:
      return (
        <div className="w-7 h-7 rounded-full bg-[#94a3b820] border border-[#94a3b840] flex items-center justify-center flex-shrink-0">
          <Plus size={13} className="text-[#94a3b8]" />
        </div>
      );
  }
}

function entryTypeLabel(type: TimelineEntry['type']): string {
  switch (type) {
    case 'note': return 'Note';
    case 'email_sent': return 'Email sent';
    case 'status_change': return 'Status changed';
    case 'cv_upload': return 'CV uploaded';
    case 'motivation_upload': return 'Motivation letter uploaded';
    case 'created': return 'Record created';
    default: return 'Activity';
  }
}

export default function Timeline({ entries, onAddNote }: TimelineProps) {
  const [noteText, setNoteText] = useState('');
  const [adding, setAdding] = useState(false);

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleAdd = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText('');
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add note */}
      <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
        <p className="text-white font-semibold text-sm mb-3">Add Note</p>
        <textarea
          className="w-full bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-lg px-3 py-2 text-[#2D4A2D] text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#2D4A2D] resize-none transition-colors"
          rows={3}
          placeholder="Write a note..."
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onFocus={() => setAdding(true)}
        />
        {(adding || noteText) && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAdd}
              disabled={!noteText.trim()}
              className="bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Add Note
            </button>
            <button
              onClick={() => { setNoteText(''); setAdding(false); }}
              className="bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Timeline entries */}
      <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-xl p-4">
        <p className="text-white font-semibold text-sm mb-4">Activity Timeline</p>
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={28} className="text-[rgba(45,74,45,0.15)] mx-auto mb-2" />
            <p className="text-[#94a3b8] text-sm">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((entry, idx) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <EntryIcon type={entry.type} />
                  {idx < sorted.length - 1 && (
                    <div className="w-px flex-1 bg-[rgba(45,74,45,0.15)] mt-1 mb-0 min-h-[16px]" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-xs font-medium">{entryTypeLabel(entry.type)}</span>
                    <span className="text-[#6B7280] text-[10px]">{getRelativeTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-[#94a3b8] text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(entry.metadata).map(([k, v]) => (
                        <span key={k} className="text-[10px] bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] px-2 py-0.5 rounded text-[#94a3b8]">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

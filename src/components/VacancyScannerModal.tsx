'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Vacancy } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import {
  X, Loader2, RefreshCw, ExternalLink, Briefcase,
  CheckSquare, Square, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { ScannedVacancy } from '@/app/api/scan-vacancies/route';

interface Props {
  companyName: string;
  website: string;
  lastScanned?: string;
  onClose: () => void;
  onActivate: (vacancies: Vacancy[], scannedAt: string) => void;
}

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

export default function VacancyScannerModal({
  companyName,
  website,
  lastScanned,
  onClose,
  onActivate,
}: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [vacancies, setVacancies] = useState<ScannedVacancy[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scannedUrl, setScannedUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedAt, setScannedAt] = useState<string>(lastScanned ?? '');
  const [activated, setActivated] = useState(false);
  const didScan = useRef(false);

  const runScan = useCallback(async () => {
    setScanState('scanning');
    setErrorMsg('');
    setVacancies([]);
    setSelected(new Set());
    setActivated(false);

    try {
      const res = await fetch('/api/scan-vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website, companyName }),
      });
      const data = await res.json();

      if (data.error && !data.vacancies?.length) {
        setErrorMsg(data.error);
        setScanState('error');
        return;
      }

      const found: ScannedVacancy[] = data.vacancies ?? [];
      setVacancies(found);
      setScannedUrl(data.scannedUrl ?? '');
      const now = new Date().toISOString();
      setScannedAt(now);
      // Pre-select all
      setSelected(new Set(found.map((_, i) => i)));
      setScanState('done');
    } catch (err) {
      setErrorMsg(String(err));
      setScanState('error');
    }
  }, [website, companyName]);

  // Auto-start on mount
  useEffect(() => {
    if (!didScan.current) {
      didScan.current = true;
      runScan();
    }
  }, [runScan]);

  const toggleAll = () => {
    if (selected.size === vacancies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(vacancies.map((_, i) => i)));
    }
  };

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleActivate = () => {
    const now = new Date().toISOString();
    const newVacancies: Vacancy[] = Array.from(selected).map(i => {
      const sv = vacancies[i];
      return {
        id: uuidv4(),
        title: sv.title,
        company: companyName,
        salaryMin: 0,
        salaryMax: 0,
        currency: 'EUR',
        requirements: sv.department ? [sv.department] : [],
        seniorityLevel: 'Senior',
        description: [
          sv.department ? `Department: ${sv.department}` : '',
          sv.location ? `Location: ${sv.location}` : '',
          sv.url ? `Source: ${sv.url}` : '',
        ].filter(Boolean).join('\n'),
        status: 'open' as const,
        stage: 'intake' as const,
        stageLog: [],
        clientFeedback: [],
        createdAt: now,
      };
    });

    onActivate(newVacancies, scannedAt || now);
    setActivated(true);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">Vacancy Scanner</h2>
            {scannedAt && (
              <p className="text-[#94a3b8] text-xs mt-0.5">
                Last scanned: {formatDate(scannedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(scanState === 'done' || scanState === 'error') && (
              <button
                onClick={runScan}
                className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-[#1e3a5f] transition-colors"
              >
                <RefreshCw size={12} /> Rescan
              </button>
            )}
            <button onClick={onClose} className="text-[#94a3b8] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scanning state */}
        {scanState === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Loader2 size={32} className="text-[#7C3AED] animate-spin mb-4" />
            <p className="text-white font-medium">Scanning {companyName} for open roles...</p>
            {website && (
              <p className="text-[#94a3b8] text-xs mt-2 truncate max-w-xs">{website}</p>
            )}
          </div>
        )}

        {/* Error state */}
        {scanState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-4 max-w-md text-left">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 text-sm font-medium mb-1">Scan failed</p>
                <p className="text-red-400/70 text-xs">{errorMsg}</p>
              </div>
            </div>
            <button
              onClick={runScan}
              className="mt-4 flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}

        {/* Success — activated */}
        {scanState === 'done' && activated && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 size={40} className="text-green-400 mb-3" />
            <p className="text-white font-semibold text-lg mb-1">
              {selected.size} vacanc{selected.size !== 1 ? 'ies' : 'y'} activated
            </p>
            <p className="text-[#94a3b8] text-sm">They are now visible in the Vacancy Manager.</p>
            <button
              onClick={onClose}
              className="mt-6 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Results */}
        {scanState === 'done' && !activated && (
          <>
            <div className="flex-shrink-0 mb-3">
              {scannedUrl && (
                <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs mb-3">
                  <span>Scanned:</span>
                  <a
                    href={scannedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7C3AED] hover:underline flex items-center gap-0.5 truncate max-w-xs"
                  >
                    {scannedUrl} <ExternalLink size={10} />
                  </a>
                </div>
              )}

              {vacancies.length === 0 ? (
                <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-10 text-center">
                  <Briefcase size={32} className="mx-auto mb-3 text-[#1e3a5f]" />
                  <p className="text-white text-sm font-medium mb-1">No vacancies found</p>
                  <p className="text-[#94a3b8] text-xs">
                    The careers page may require JavaScript or use a job board embed.<br />
                    Try visiting the page directly.
                  </p>
                  {scannedUrl && (
                    <a
                      href={scannedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-[#7C3AED] hover:underline text-xs"
                    >
                      Open careers page <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">
                    {vacancies.length} open role{vacancies.length !== 1 ? 's' : ''} found
                  </p>
                  <button
                    onClick={toggleAll}
                    className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white text-xs transition-colors"
                  >
                    {selected.size === vacancies.length
                      ? <><CheckSquare size={13} /> Deselect all</>
                      : <><Square size={13} /> Select all</>
                    }
                  </button>
                </div>
              )}
            </div>

            {vacancies.length > 0 && (
              <>
                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0 mb-4">
                  {vacancies.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => toggle(i)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selected.has(i)
                          ? 'bg-[#7C3AED10] border-[#7C3AED40]'
                          : 'bg-[#0a1628] border-[#1e3a5f] hover:border-[#2a4f7a]'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {selected.has(i)
                          ? <CheckSquare size={16} className="text-[#7C3AED]" />
                          : <Square size={16} className="text-[#4a6fa5]" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium leading-snug truncate">{v.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {v.department && (
                            <span className="text-[#94a3b8] text-xs">{v.department}</span>
                          )}
                          {v.department && v.location && (
                            <span className="text-[#1e3a5f] text-xs">·</span>
                          )}
                          {v.location && (
                            <span className="text-[#94a3b8] text-xs">{v.location}</span>
                          )}
                        </div>
                      </div>
                      {v.url && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 text-[#4a6fa5] hover:text-[#7C3AED] transition-colors mt-0.5"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex gap-3 flex-shrink-0">
                  <button
                    onClick={handleActivate}
                    disabled={selected.size === 0}
                    className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Activate {selected.size > 0 ? `${selected.size} ` : ''}selected vacanc{selected.size !== 1 ? 'ies' : 'y'}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {vacancies.length === 0 && (
              <button
                onClick={onClose}
                className="w-full mt-4 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white py-2.5 rounded-lg transition-colors text-sm flex-shrink-0"
              >
                Close
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

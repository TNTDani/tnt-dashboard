'use client';

import { useCallback, useRef, useState } from 'react';
import { Client, FeeAgreement, TimelineEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

// ── Hunter.io column names ──────────────────────────────────────────────────
const COL = {
  firstName: 'First name',
  lastName: 'Last name',
  jobTitle: 'Job title',
  company: 'Company',
  email: 'Email address',
  website: 'Website',
  industry: 'Industry',
  companySize: 'Company size',
  city: 'City',
  country: 'Country',
  linkedin: 'LinkedIn URL',
  confidence: 'Confidence score',
} as const;

const SECTORS = ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Engineering', 'Legal', 'HR', 'Logistics', 'Retail', 'Education', 'Other'];

// Map Hunter.io industry → our sector list
function mapSector(industry: string): string {
  const i = industry.toLowerCase();
  if (i.includes('tech') || i.includes('software') || i.includes('it ') || i.includes('saas') || i.includes('internet')) return 'Technology';
  if (i.includes('financ') || i.includes('bank') || i.includes('invest') || i.includes('insurance') || i.includes('accounting')) return 'Finance';
  if (i.includes('health') || i.includes('medical') || i.includes('pharma') || i.includes('biotech')) return 'Healthcare';
  if (i.includes('market') || i.includes('advertis') || i.includes('media') || i.includes('pr ') || i.includes('public relation')) return 'Marketing';
  if (i.includes('engineer') || i.includes('manufactur') || i.includes('industrial') || i.includes('construction')) return 'Engineering';
  if (i.includes('legal') || i.includes('law')) return 'Legal';
  if (i.includes('human resource') || i.includes(' hr') || i.includes('recruit') || i.includes('staffing')) return 'HR';
  if (i.includes('logistic') || i.includes('transport') || i.includes('supply chain') || i.includes('shipping')) return 'Logistics';
  if (i.includes('retail') || i.includes('ecommerce') || i.includes('e-commerce') || i.includes('consumer')) return 'Retail';
  if (i.includes('educat') || i.includes('learning') || i.includes('training') || i.includes('school') || i.includes('universit')) return 'Education';
  return 'Other';
}

// Map Hunter.io company size string → our size enum
function mapSize(sizeStr: string): Client['size'] {
  const s = sizeStr.trim().replace(/,/g, '');
  const match = s.match(/^(\d+)/);
  if (!match) return 'medium';
  const n = parseInt(match[1]);
  if (n <= 10) return 'startup';
  if (n <= 50) return 'small';
  if (n <= 200) return 'medium';
  if (n <= 1000) return 'large';
  return 'enterprise';
}

// Minimal CSV parser — handles quoted fields with embedded commas/newlines
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r' && next === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; }
      else if (ch === '\n' || ch === '\r') { row.push(field); field = ''; rows.push(row); row = []; }
      else field += ch;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(cell => cell.trim()))
    .map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
      return obj;
    });
}

function col(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim();
}

interface ImportResult {
  imported: number;
  skippedLowConfidence: number;
  skippedDuplicates: number;
}

interface Props {
  existingClients: Client[];
  onClose: () => void;
  onImport: (newClients: Client[]) => void;
}

export default function CsvImportModal({ existingClients, onClose, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    setParseError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParseError('No data rows found. Make sure the file has a header row and at least one data row.');
        return;
      }
      // Check for expected Hunter.io columns
      const firstRow = rows[0];
      const missing = [COL.company, COL.email].filter(c => !(c in firstRow));
      if (missing.length > 0) {
        setParseError(`Missing expected columns: ${missing.join(', ')}. Make sure this is a Hunter.io export.`);
        return;
      }
      setParsedRows(rows);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const validCount = parsedRows.filter(r => {
    const confidence = parseFloat(col(r, COL.confidence));
    return isNaN(confidence) || confidence >= 70;
  }).length;

  const handleImport = () => {
    const existingCompanyNames = new Set(existingClients.map(c => c.companyName.toLowerCase().trim()));
    const existingEmails = new Set(existingClients.map(c => c.contactEmail.toLowerCase().trim()).filter(Boolean));

    let skippedLowConfidence = 0;
    let skippedDuplicates = 0;
    const newClients: Client[] = [];

    for (const row of parsedRows) {
      const confidence = parseFloat(col(row, COL.confidence));
      if (!isNaN(confidence) && confidence < 70) {
        skippedLowConfidence++;
        continue;
      }

      const companyName = col(row, COL.company);
      const email = col(row, COL.email).toLowerCase();

      if (!companyName) continue;

      if (
        existingCompanyNames.has(companyName.toLowerCase()) ||
        (email && existingEmails.has(email))
      ) {
        skippedDuplicates++;
        continue;
      }

      const firstName = col(row, COL.firstName);
      const lastName = col(row, COL.lastName);
      const contactName = [firstName, lastName].filter(Boolean).join(' ') || companyName;

      const city = col(row, COL.city);
      const country = col(row, COL.country);
      const location = [city, country].filter(Boolean).join(', ');

      const noteParts: string[] = ['Status: Not contacted'];
      if (!isNaN(confidence)) noteParts.push(`Hunter.io confidence: ${confidence}%`);
      const linkedin = col(row, COL.linkedin);

      const now = new Date().toISOString();
      const timeline: TimelineEntry[] = [{
        id: uuidv4(),
        type: 'created',
        content: 'Client imported from Hunter.io CSV',
        createdAt: now,
      }];

      const feeAgreement: FeeAgreement = { type: 'standard' };

      const newClient: Client = {
        id: uuidv4(),
        companyName: companyName.trim(),
        website: col(row, COL.website) || undefined,
        sector: mapSector(col(row, COL.industry)),
        size: mapSize(col(row, COL.companySize)),
        type: 'prospect',
        contactName,
        contactEmail: col(row, COL.email),
        contactPhone: '',
        contactRole: col(row, COL.jobTitle),
        location,
        linkedin: linkedin || undefined,
        notes: noteParts.join('\n'),
        feeAgreement,
        guaranteePeriod: 3,
        timeline,
        createdAt: now,
        updatedAt: now,
      };

      newClients.push(newClient);
      existingCompanyNames.add(companyName.toLowerCase());
      if (email) existingEmails.add(email);
    }

    onImport(newClients);
    setResult({ imported: newClients.length, skippedLowConfidence, skippedDuplicates });
  };

  // Preview rows (first 3)
  const previewRows = parsedRows.slice(0, 3);
  const previewCols = [COL.firstName, COL.lastName, COL.company, COL.email, COL.confidence];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[#FFFFFF] border border-[rgba(45,74,45,0.15)] rounded-t-xl sm:rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Import CSV</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#2D4A2D] transition-colors">
            <X size={18} />
          </button>
        </div>

        {result ? (
          /* ── Success state ── */
          <div className="text-center py-6">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
            <p className="text-white font-semibold text-lg mb-1">
              {result.imported} client{result.imported !== 1 ? 's' : ''} imported successfully
            </p>
            <div className="mt-3 space-y-1 text-sm text-[#94a3b8]">
              {result.skippedLowConfidence > 0 && (
                <p>{result.skippedLowConfidence} skipped (low confidence &lt;70%)</p>
              )}
              {result.skippedDuplicates > 0 && (
                <p>{result.skippedDuplicates} duplicate{result.skippedDuplicates !== 1 ? 's' : ''} skipped</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-6 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── Drop zone ── */}
            {!parsedRows.length && (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#2D4A2D] bg-[#2D4A2D10]'
                    : 'border-[rgba(45,74,45,0.15)] hover:border-[#2D4A2D40] hover:bg-[#FFFFFF]'
                }`}
              >
                <Upload size={32} className="mx-auto mb-3 text-[#6B7280]" />
                <p className="text-white text-sm font-medium mb-1">Drag & drop your Hunter.io CSV here</p>
                <p className="text-[#94a3b8] text-xs">or click to browse — .csv files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* ── Error ── */}
            {parseError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
                <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-xs">{parseError}</p>
              </div>
            )}

            {/* ── Preview ── */}
            {parsedRows.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={15} className="text-[#2D4A2D]" />
                  <span className="text-white text-sm font-medium">{fileName}</span>
                  <span className="text-[#94a3b8] text-xs ml-auto">{parsedRows.length} rows found</span>
                </div>

                <p className="text-[#94a3b8] text-xs font-medium mb-2 uppercase tracking-wider">Preview (first 3 rows)</p>
                <div className="overflow-x-auto rounded-lg border border-[rgba(45,74,45,0.15)] mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(45,74,45,0.15)]">
                        {previewCols.map(c => (
                          <th key={c} className="px-3 py-2 text-left text-[#94a3b8] font-medium whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => {
                        const confidence = parseFloat(col(row, COL.confidence));
                        const lowConf = !isNaN(confidence) && confidence < 70;
                        return (
                          <tr key={i} className={`border-b border-[rgba(45,74,45,0.15)] last:border-0 ${lowConf ? 'opacity-40' : ''}`}>
                            {previewCols.map(c => (
                              <td key={c} className="px-3 py-2 text-white truncate max-w-[120px]">
                                {c === COL.confidence && lowConf
                                  ? <span className="text-red-400">{col(row, c)}</span>
                                  : col(row, c) || <span className="text-[#6B7280]">—</span>
                                }
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary line */}
                <div className="text-xs text-[#94a3b8] mb-5 space-y-0.5">
                  <p>
                    <span className="text-white font-medium">{validCount}</span> rows with confidence ≥70% will be imported as Prospects.
                  </p>
                  {parsedRows.length - validCount > 0 && (
                    <p>{parsedRows.length - validCount} rows will be skipped (low confidence).</p>
                  )}
                  <p>Duplicates (same company name or email) will be skipped automatically.</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0}
                    className="flex-1 bg-[#2D4A2D] hover:bg-[#3D6B3D] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Import {validCount} lead{validCount !== 1 ? 's' : ''}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ── Cancel when no file yet ── */}
            {!parsedRows.length && !parseError && (
              <button
                onClick={onClose}
                className="w-full mt-4 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            )}
            {!parsedRows.length && parseError && (
              <button
                onClick={onClose}
                className="w-full mt-3 bg-[rgba(45,74,45,0.15)] hover:bg-[#6B7280] text-[#94a3b8] hover:text-[#2D4A2D] py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

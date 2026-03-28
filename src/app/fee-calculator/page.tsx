'use client';

import { useEffect, useState } from 'react';
import { Client, FeeAgreement } from '@/lib/types';
import { storage } from '@/lib/storage';
import { Calculator, Edit, Check, X } from 'lucide-react';

type SeniorityLevel = 'junior_medior' | 'senior' | 'management' | 'custom';

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string; rate: number | null }[] = [
  { value: 'junior_medior', label: 'Junior / Medior', rate: 18 },
  { value: 'senior', label: 'Senior', rate: 20 },
  { value: 'management', label: 'Management / Lead', rate: 22 },
  { value: 'custom', label: 'Custom', rate: null },
];

function fmtEur(n: number) {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const FEE_TYPE_LABELS: Record<FeeAgreement['type'], string> = {
  standard: 'Standard',
  custom: 'Custom',
  retainer: 'Retainer',
};

export default function FeeCalculatorPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [seniority, setSeniority] = useState<SeniorityLevel>('senior');
  const [customRate, setCustomRate] = useState('');
  const [guaranteePeriod, setGuaranteePeriod] = useState('3');

  // Inline edit for client fee
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFeeForm, setEditFeeForm] = useState<{ type: FeeAgreement['type']; customPercentage: string; retainerAmount: string; retainerPercentage: string; guaranteePeriod: string }>({
    type: 'standard', customPercentage: '', retainerAmount: '', retainerPercentage: '', guaranteePeriod: '3',
  });

  useEffect(() => {
    setClients(storage.getClients());
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Determine effective rate & guarantee
  const getEffectiveRate = (): number | null => {
    if (selectedClient) {
      const fee = selectedClient.feeAgreement;
      if (fee.type === 'standard') {
        const map: Record<SeniorityLevel, number> = {
          junior_medior: 18,
          senior: 20,
          management: 22,
          custom: parseFloat(customRate) || 0,
        };
        return map[seniority];
      }
      if (fee.type === 'custom') return fee.customPercentage ?? null;
      if (fee.type === 'retainer') return fee.retainerPercentage ?? null;
    }
    // No client — use seniority defaults
    if (seniority === 'custom') return parseFloat(customRate) || null;
    return SENIORITY_OPTIONS.find(o => o.value === seniority)?.rate ?? null;
  };

  const effectiveRate = getEffectiveRate();
  const effectiveGuarantee = selectedClient ? selectedClient.guaranteePeriod : parseInt(guaranteePeriod) || 3;
  const isRetainer = selectedClient?.feeAgreement.type === 'retainer';
  const retainerAmount = selectedClient?.feeAgreement.retainerAmount ?? 0;

  const minSal = parseFloat(salaryMin) || 0;
  const maxSal = parseFloat(salaryMax) || minSal;
  const midSal = (minSal + maxSal) / 2;

  const calcFee = (salary: number): number => {
    if (!effectiveRate || salary <= 0) return 0;
    return (salary * effectiveRate) / 100;
  };

  const feeAtMin = calcFee(minSal);
  const feeAtMax = calcFee(maxSal);
  const feeAtMid = calcFee(midSal);

  const hasRange = maxSal > minSal && minSal > 0;

  const startEditClient = (client: Client) => {
    setEditingClientId(client.id);
    setEditFeeForm({
      type: client.feeAgreement.type,
      customPercentage: client.feeAgreement.customPercentage?.toString() || '',
      retainerAmount: client.feeAgreement.retainerAmount?.toString() || '',
      retainerPercentage: client.feeAgreement.retainerPercentage?.toString() || '',
      guaranteePeriod: client.guaranteePeriod.toString(),
    });
  };

  const saveClientFee = (clientId: string) => {
    const feeAgreement: FeeAgreement = {
      type: editFeeForm.type,
      ...(editFeeForm.type === 'custom' && editFeeForm.customPercentage ? { customPercentage: parseFloat(editFeeForm.customPercentage) } : {}),
      ...(editFeeForm.type === 'retainer' && editFeeForm.retainerAmount ? { retainerAmount: parseFloat(editFeeForm.retainerAmount) } : {}),
      ...(editFeeForm.type === 'retainer' && editFeeForm.retainerPercentage ? { retainerPercentage: parseFloat(editFeeForm.retainerPercentage) } : {}),
    };
    const updated = clients.map(c =>
      c.id === clientId
        ? { ...c, feeAgreement, guaranteePeriod: parseInt(editFeeForm.guaranteePeriod) || 3, updatedAt: new Date().toISOString() }
        : c
    );
    setClients(updated);
    storage.saveClients(updated);
    setEditingClientId(null);
  };

  const isRateOverridden = selectedClient && selectedClient.feeAgreement.type !== 'standard';

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Fee Calculator</h1>
      <p className="text-[#94a3b8] text-sm mb-6">Calculate recruitment fees and manage client agreements</p>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
        {/* Calculator inputs */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#7C3AED20] flex items-center justify-center">
                <Calculator size={16} className="text-[#7C3AED]" />
              </div>
              <p className="text-white font-semibold text-sm">Calculator</p>
            </div>

            <div className="space-y-4">
              {/* Client selector */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">
                  Client {!selectedClient && <span className="text-[#4a6fa5]">(Standard rates)</span>}
                </label>
                <select
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                >
                  <option value="">— No client selected (standard rates) —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({FEE_TYPE_LABELS[c.feeAgreement.type]})
                    </option>
                  ))}
                </select>
                {selectedClient && (
                  <p className="text-[#94a3b8] text-xs mt-1">
                    Fee type: <span className="text-[#7C3AED]">{FEE_TYPE_LABELS[selectedClient.feeAgreement.type]}</span>
                    {' · '}Guarantee: <span className="text-[#7C3AED]">{selectedClient.guaranteePeriod} months</span>
                  </p>
                )}
              </div>

              {/* Salary range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Min Gross Annual Salary (€)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="60000"
                    value={salaryMin}
                    onChange={e => setSalaryMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Max Gross Annual Salary (€)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="80000"
                    value={salaryMax}
                    onChange={e => setSalaryMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Seniority */}
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-2">
                  Seniority Level
                  {isRateOverridden && <span className="ml-2 text-amber-400 text-[10px]">(overridden by client agreement)</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SENIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => !isRateOverridden && setSeniority(opt.value)}
                      disabled={!!isRateOverridden}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors text-left border ${
                        seniority === opt.value && !isRateOverridden
                          ? 'bg-[#7C3AED20] border-[#7C3AED] text-[#7C3AED]'
                          : 'bg-[#0a1628] border-[#1e3a5f] text-[#94a3b8] hover:border-[#7C3AED40]'
                      } ${isRateOverridden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      {opt.rate !== null && (
                        <span className="ml-2 text-[10px] opacity-70">{opt.rate}%</span>
                      )}
                    </button>
                  ))}
                </div>
                {seniority === 'custom' && !isRateOverridden && (
                  <div className="mt-2">
                    <input
                      type="number"
                      className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                      placeholder="Custom % e.g. 19"
                      value={customRate}
                      onChange={e => setCustomRate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Guarantee period (only if no client) */}
              {!selectedClient && (
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Guarantee Period (months)</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
                    placeholder="3"
                    value={guaranteePeriod}
                    onChange={e => setGuaranteePeriod(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
            <p className="text-white font-semibold text-sm mb-4">Fee Estimate</p>

            {minSal <= 0 ? (
              <div className="text-center py-8">
                <Calculator size={32} className="mx-auto mb-2 text-[#1e3a5f]" />
                <p className="text-[#94a3b8] text-sm">Enter a salary to see the fee</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Effective rate */}
                <div className="bg-[#0a1628] border border-[#7C3AED40] rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-[#94a3b8] text-sm">Effective rate</span>
                  <span className="text-[#7C3AED] font-bold text-xl">
                    {effectiveRate !== null ? `${effectiveRate}%` : '—'}
                  </span>
                </div>

                {/* Retainer */}
                {isRetainer && retainerAmount > 0 && (
                  <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-2 flex items-center justify-between">
                    <span className="text-[#94a3b8] text-xs">Upfront retainer</span>
                    <span className="text-white font-semibold text-sm">{fmtEur(retainerAmount)}</span>
                  </div>
                )}

                {/* Fee breakdown */}
                {effectiveRate !== null && (
                  <>
                    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-2 flex items-center justify-between">
                      <span className="text-[#94a3b8] text-xs">Fee at minimum</span>
                      <span className="text-white font-semibold text-sm">{fmtEur(feeAtMin)}</span>
                    </div>
                    {hasRange && (
                      <>
                        <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-2 flex items-center justify-between">
                          <span className="text-[#94a3b8] text-xs">Fee at midpoint</span>
                          <span className="text-white font-semibold text-sm">{fmtEur(feeAtMid)}</span>
                        </div>
                        <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-2 flex items-center justify-between">
                          <span className="text-[#94a3b8] text-xs">Fee at maximum</span>
                          <span className="text-[#10b981] font-semibold text-sm">{fmtEur(feeAtMax)}</span>
                        </div>

                        {/* Visual bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-[#94a3b8] mb-1">
                            <span>{fmtEur(feeAtMin)}</span>
                            <span>{fmtEur(feeAtMax)}</span>
                          </div>
                          <div className="h-2 bg-[#0a1628] border border-[#1e3a5f] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#10b981] rounded-full"
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Guarantee note */}
                <div className="mt-2 text-xs text-[#94a3b8] bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2">
                  Guarantee period: <span className="text-white font-medium">{effectiveGuarantee} months</span>
                </div>

                {isRetainer && (
                  <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    Retainer: {fmtEur(retainerAmount)} upfront + {effectiveRate}% on placement
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client fee agreements table */}
      <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6">
        <p className="text-white font-semibold text-sm mb-4">Client Fee Agreements</p>

        {clients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#94a3b8] text-sm">No clients yet. Add clients to manage their fee agreements.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Client</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Type</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Rate</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Guarantee</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id} className="border-b border-[#1e3a5f] last:border-0">
                    {editingClientId === client.id ? (
                      <td colSpan={5} className="py-3">
                        <div className="bg-[#0a1628] border border-[#7C3AED40] rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <div>
                              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Fee Type</label>
                              <select
                                className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                                value={editFeeForm.type}
                                onChange={e => setEditFeeForm(f => ({ ...f, type: e.target.value as FeeAgreement['type'] }))}
                              >
                                <option value="standard">Standard</option>
                                <option value="custom">Custom %</option>
                                <option value="retainer">Retainer</option>
                              </select>
                            </div>
                            {editFeeForm.type === 'custom' && (
                              <div>
                                <label className="block text-[#94a3b8] text-xs font-medium mb-1">%</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                                  value={editFeeForm.customPercentage}
                                  onChange={e => setEditFeeForm(f => ({ ...f, customPercentage: e.target.value }))}
                                />
                              </div>
                            )}
                            {editFeeForm.type === 'retainer' && (
                              <>
                                <div>
                                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Upfront (€)</label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                                    value={editFeeForm.retainerAmount}
                                    onChange={e => setEditFeeForm(f => ({ ...f, retainerAmount: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[#94a3b8] text-xs font-medium mb-1">Placement %</label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                                    value={editFeeForm.retainerPercentage}
                                    onChange={e => setEditFeeForm(f => ({ ...f, retainerPercentage: e.target.value }))}
                                  />
                                </div>
                              </>
                            )}
                            <div>
                              <label className="block text-[#94a3b8] text-xs font-medium mb-1">Guarantee (months)</label>
                              <input
                                type="number"
                                className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                                value={editFeeForm.guaranteePeriod}
                                onChange={e => setEditFeeForm(f => ({ ...f, guaranteePeriod: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => saveClientFee(client.id)}
                              className="flex items-center gap-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              onClick={() => setEditingClientId(null)}
                              className="flex items-center gap-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] px-3 py-1.5 rounded-lg text-xs transition-colors"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="py-3 pr-4">
                          <p className="text-white font-medium">{client.companyName}</p>
                          <p className="text-[#94a3b8] text-xs">{client.sector}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            client.feeAgreement.type === 'standard'
                              ? 'bg-blue-500/20 text-blue-400'
                              : client.feeAgreement.type === 'custom'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {FEE_TYPE_LABELS[client.feeAgreement.type]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#94a3b8]">
                          {client.feeAgreement.type === 'standard' && '18–22%'}
                          {client.feeAgreement.type === 'custom' && `${client.feeAgreement.customPercentage ?? '—'}%`}
                          {client.feeAgreement.type === 'retainer' && (
                            <span>
                              {client.feeAgreement.retainerAmount ? fmtEur(client.feeAgreement.retainerAmount) : '—'}
                              {' + '}
                              {client.feeAgreement.retainerPercentage ?? '—'}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[#94a3b8]">{client.guaranteePeriod}m</td>
                        <td className="py-3">
                          <button
                            onClick={() => startEditClient(client)}
                            className="flex items-center gap-1 text-[#7C3AED] hover:text-[#6d28d9] text-xs transition-colors"
                          >
                            <Edit size={12} /> Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

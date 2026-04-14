'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, FeeAgreement } from '@/lib/types';
import { db } from '@/lib/db';
import { Calculator, Edit, Check, X } from 'lucide-react';

type SeniorityLevel = 'junior_medior' | 'senior' | 'management' | 'custom';

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string; rate: number | null }[] = [
  { value: 'junior_medior', label: 'Junior / Medior', rate: 18 },
  { value: 'senior',        label: 'Senior',           rate: 20 },
  { value: 'management',    label: 'Management / Lead', rate: 22 },
  { value: 'custom',        label: 'Custom',            rate: null },
];

function fmtEur(n: number) {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const FEE_TYPE_LABELS: Record<FeeAgreement['type'], string> = {
  standard: 'Standard',
  custom:   'Custom',
  retainer: 'Retainer',
};

const FEE_TYPE_BADGE: Record<FeeAgreement['type'], string> = {
  standard: 'bg-[#2D4A2D]/10 text-[#2D4A2D]',
  custom:   'bg-[#f59e0b]/15 text-[#d97706]',
  retainer: 'bg-purple-100 text-purple-600',
};

export default function FeeCalculatorPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [seniority, setSeniority] = useState<SeniorityLevel>('senior');
  const [customRate, setCustomRate] = useState('');
  const [guaranteePeriod, setGuaranteePeriod] = useState('3');

  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFeeForm, setEditFeeForm] = useState<{
    type: FeeAgreement['type'];
    customPercentage: string;
    retainerAmount: string;
    retainerPercentage: string;
    guaranteePeriod: string;
  }>({
    type: 'standard', customPercentage: '', retainerAmount: '',
    retainerPercentage: '', guaranteePeriod: '3',
  });

  useEffect(() => {
    db.getClients().then(setClients);
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const getEffectiveRate = (): number | null => {
    if (selectedClient) {
      const fee = selectedClient.feeAgreement;
      if (fee.type === 'standard') {
        const map: Record<SeniorityLevel, number> = {
          junior_medior: 18, senior: 20, management: 22,
          custom: parseFloat(customRate) || 0,
        };
        return map[seniority];
      }
      if (fee.type === 'custom') return fee.customPercentage ?? null;
      if (fee.type === 'retainer') return fee.retainerPercentage ?? null;
    }
    if (seniority === 'custom') return parseFloat(customRate) || null;
    return SENIORITY_OPTIONS.find(o => o.value === seniority)?.rate ?? null;
  };

  const effectiveRate     = getEffectiveRate();
  const effectiveGuarantee = selectedClient ? selectedClient.guaranteePeriod : parseInt(guaranteePeriod) || 3;
  const isRetainer        = selectedClient?.feeAgreement.type === 'retainer';
  const retainerAmount    = selectedClient?.feeAgreement.retainerAmount ?? 0;
  const isRateOverridden  = selectedClient && selectedClient.feeAgreement.type !== 'standard';

  const minSal  = parseFloat(salaryMin) || 0;
  const maxSal  = parseFloat(salaryMax) || minSal;
  const midSal  = (minSal + maxSal) / 2;
  const hasRange = maxSal > minSal && minSal > 0;

  const calcFee = (salary: number): number => {
    if (!effectiveRate || salary <= 0) return 0;
    return (salary * effectiveRate) / 100;
  };

  const feeAtMin = calcFee(minSal);
  const feeAtMax = calcFee(maxSal);
  const feeAtMid = calcFee(midSal);

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
      ...(editFeeForm.type === 'custom' && editFeeForm.customPercentage
        ? { customPercentage: parseFloat(editFeeForm.customPercentage) } : {}),
      ...(editFeeForm.type === 'retainer' && editFeeForm.retainerAmount
        ? { retainerAmount: parseFloat(editFeeForm.retainerAmount) } : {}),
      ...(editFeeForm.type === 'retainer' && editFeeForm.retainerPercentage
        ? { retainerPercentage: parseFloat(editFeeForm.retainerPercentage) } : {}),
    };
    const updated = clients.map(c =>
      c.id === clientId
        ? { ...c, feeAgreement, guaranteePeriod: parseInt(editFeeForm.guaranteePeriod) || 3, updatedAt: new Date().toISOString() }
        : c
    );
    setClients(updated);
    db.saveClients(updated);
    setEditingClientId(null);
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-[#2D4A2D]">Fee Calculator</h1>
        <p className="text-[#6B7280] text-sm mt-1">Calculate recruitment fees and manage client agreements</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        {/* Calculator inputs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="xl:col-span-3"
        >
          <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-6">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#2D4A2D]/10 flex items-center justify-center">
                <Calculator size={16} className="text-[#2D4A2D]" />
              </div>
              <p className="text-[#2D4A2D] font-semibold">Calculator</p>
            </div>

            <div className="space-y-5">
              {/* Client selector */}
              <div>
                <label className="block text-[#6B7280] text-xs font-medium mb-1.5">
                  Client {!selectedClient && <span className="text-[#94a3b8]">(Standard rates)</span>}
                </label>
                <select
                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors appearance-none"
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
                  <p className="text-[#94a3b8] text-xs mt-1.5">
                    Fee type: <span className="text-[#2D4A2D] font-medium">{FEE_TYPE_LABELS[selectedClient.feeAgreement.type]}</span>
                    {' · '}Guarantee: <span className="text-[#2D4A2D] font-medium">{selectedClient.guaranteePeriod} months</span>
                  </p>
                )}
              </div>

              {/* Salary range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Min Gross Annual Salary (€)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#94a3b8] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    placeholder="60000"
                    value={salaryMin}
                    onChange={e => setSalaryMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Max Gross Annual Salary (€)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#94a3b8] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    placeholder="80000"
                    value={salaryMax}
                    onChange={e => setSalaryMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Seniority */}
              <div>
                <label className="block text-[#6B7280] text-xs font-medium mb-2">
                  Seniority Level
                  {isRateOverridden && (
                    <span className="ml-2 text-[#f59e0b] text-[10px] font-medium">(overridden by client agreement)</span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SENIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => !isRateOverridden && setSeniority(opt.value)}
                      disabled={!!isRateOverridden}
                      className={`px-3 py-2.5 rounded-xl text-sm transition-all text-left border ${
                        seniority === opt.value && !isRateOverridden
                          ? 'bg-[#2D4A2D]/10 border-[#2D4A2D]/40 text-[#2D4A2D]'
                          : 'bg-white border-[rgba(45,74,45,0.15)] text-[#6B7280] hover:border-[#2D4A2D]/30 hover:text-[#2D4A2D]'
                      } ${isRateOverridden ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      {opt.rate !== null && (
                        <span className="ml-2 text-[10px] opacity-60">{opt.rate}%</span>
                      )}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {seniority === 'custom' && !isRateOverridden && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 overflow-hidden"
                    >
                      <input
                        type="number"
                        className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#94a3b8] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                        placeholder="Custom % e.g. 19"
                        value={customRate}
                        onChange={e => setCustomRate(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Guarantee period */}
              {!selectedClient && (
                <div>
                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Guarantee Period (months)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm placeholder-[#94a3b8] focus:outline-none focus:border-[#2D4A2D] transition-colors"
                    placeholder="3"
                    value={guaranteePeriod}
                    onChange={e => setGuaranteePeriod(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fee result */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-2"
        >
          <div className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-6 h-full">
            <p className="text-[#2D4A2D] font-semibold mb-5">Fee Estimate</p>

            {minSal <= 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#2D4A2D]/8 flex items-center justify-center mb-3">
                  <Calculator size={20} className="text-[#2D4A2D]/30" />
                </div>
                <p className="text-[#6B7280] text-sm">Enter a salary to see the fee</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {/* Effective rate — hero */}
                <div className="bg-[#2D4A2D]/8 border border-[#2D4A2D]/20 rounded-2xl px-4 py-4 flex items-center justify-between">
                  <span className="text-[#6B7280] text-sm font-medium">Effective rate</span>
                  <span className="text-[#2D4A2D] font-bold text-3xl">
                    {effectiveRate !== null ? `${effectiveRate}%` : '—'}
                  </span>
                </div>

                {/* Retainer upfront */}
                {isRetainer && retainerAmount > 0 && (
                  <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-[#6B7280] text-xs">Upfront retainer</span>
                    <span className="text-[#2D4A2D] font-semibold text-sm">{fmtEur(retainerAmount)}</span>
                  </div>
                )}

                {effectiveRate !== null && (
                  <>
                    <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-[#6B7280] text-xs">Fee at minimum</span>
                      <span className="text-[#2D4A2D] font-semibold">{fmtEur(feeAtMin)}</span>
                    </div>

                    {hasRange && (
                      <>
                        <div className="bg-white border border-[rgba(45,74,45,0.12)] rounded-xl px-4 py-3 flex items-center justify-between">
                          <span className="text-[#6B7280] text-xs">Fee at midpoint</span>
                          <span className="text-[#2D4A2D] font-semibold">{fmtEur(feeAtMid)}</span>
                        </div>
                        <div className="bg-white border border-[#4CAF50]/30 rounded-xl px-4 py-3 flex items-center justify-between">
                          <span className="text-[#6B7280] text-xs">Fee at maximum</span>
                          <span className="text-[#4CAF50] font-semibold">{fmtEur(feeAtMax)}</span>
                        </div>

                        {/* Visual range bar */}
                        <div>
                          <div className="flex justify-between text-[10px] text-[#94a3b8] mb-1.5">
                            <span>{fmtEur(feeAtMin)}</span>
                            <span>{fmtEur(feeAtMax)}</span>
                          </div>
                          <div className="h-2 bg-[#2D4A2D]/8 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#2D4A2D] to-[#4CAF50] rounded-full w-full" />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Guarantee note */}
                <div className="text-xs text-[#6B7280] bg-[#2D4A2D]/5 rounded-xl px-3 py-2.5">
                  Guarantee period: <span className="text-[#2D4A2D] font-semibold">{effectiveGuarantee} months</span>
                </div>

                {isRetainer && (
                  <div className="text-xs text-[#d97706] bg-[#f59e0b]/8 border border-[#f59e0b]/20 rounded-xl px-3 py-2.5">
                    Retainer: {fmtEur(retainerAmount)} upfront + {effectiveRate}% on placement
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Client fee agreements */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] p-6"
      >
        <p className="text-[#2D4A2D] font-semibold mb-5">Client Fee Agreements</p>

        {clients.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[#6B7280] text-sm">No clients yet. Add clients to manage their fee agreements.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(45,74,45,0.08)]">
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Client</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Type</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Rate</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3 pr-4">Guarantee</th>
                  <th className="text-left text-[#94a3b8] text-xs font-medium pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id} className="border-b border-[rgba(45,74,45,0.06)] last:border-0">
                    {editingClientId === client.id ? (
                      <td colSpan={5} className="py-3">
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#FAFAF9] border border-[rgba(45,74,45,0.12)] rounded-2xl p-4"
                        >
                          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <div>
                              <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Fee Type</label>
                              <select
                                className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
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
                                <label className="block text-[#6B7280] text-xs font-medium mb-1.5">%</label>
                                <input
                                  type="number"
                                  className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                  value={editFeeForm.customPercentage}
                                  onChange={e => setEditFeeForm(f => ({ ...f, customPercentage: e.target.value }))}
                                />
                              </div>
                            )}
                            {editFeeForm.type === 'retainer' && (
                              <>
                                <div>
                                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Upfront (€)</label>
                                  <input
                                    type="number"
                                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                    value={editFeeForm.retainerAmount}
                                    onChange={e => setEditFeeForm(f => ({ ...f, retainerAmount: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Placement %</label>
                                  <input
                                    type="number"
                                    className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                    value={editFeeForm.retainerPercentage}
                                    onChange={e => setEditFeeForm(f => ({ ...f, retainerPercentage: e.target.value }))}
                                  />
                                </div>
                              </>
                            )}
                            <div>
                              <label className="block text-[#6B7280] text-xs font-medium mb-1.5">Guarantee (months)</label>
                              <input
                                type="number"
                                className="w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 text-[#2D4A2D] text-sm focus:outline-none focus:border-[#2D4A2D] transition-colors"
                                value={editFeeForm.guaranteePeriod}
                                onChange={e => setEditFeeForm(f => ({ ...f, guaranteePeriod: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => saveClientFee(client.id)}
                              className="flex items-center gap-1.5 bg-[#2D4A2D] hover:bg-[#3D6B3D] text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              onClick={() => setEditingClientId(null)}
                              className="flex items-center gap-1.5 bg-[#2D4A2D]/8 hover:bg-[#2D4A2D]/15 text-[#6B7280] hover:text-[#2D4A2D] px-3 py-1.5 rounded-xl text-xs transition-colors"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </motion.div>
                      </td>
                    ) : (
                      <>
                        <td className="py-3.5 pr-4">
                          <p className="text-[#2D4A2D] font-medium">{client.companyName}</p>
                          <p className="text-[#94a3b8] text-xs">{client.sector}</p>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${FEE_TYPE_BADGE[client.feeAgreement.type]}`}>
                            {FEE_TYPE_LABELS[client.feeAgreement.type]}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-[#6B7280] text-sm">
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
                        <td className="py-3.5 pr-4 text-[#6B7280] text-sm">{client.guaranteePeriod}m</td>
                        <td className="py-3.5">
                          <button
                            onClick={() => startEditClient(client)}
                            className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#2D4A2D] text-xs transition-colors px-2 py-1 rounded-lg hover:bg-[#2D4A2D]/5"
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
      </motion.div>
    </div>
  );
}

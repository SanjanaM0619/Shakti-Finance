import React, { useEffect, useState, useCallback } from 'react';
import { Scale, ArrowLeftRight, Home, Wallet, Plus, Trash2 } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { EntryKind, FinancialSummary, Transaction } from '../types';

const NON_OPERATING_KINDS: Array<{ value: EntryKind; label: string; help: string }> = [
  {
    value: 'household_withdrawal',
    label: 'Household Withdrawal',
    help: 'Money taken from business cash/UPI for family or personal expenses. Excluded from business expenses.',
  },
  {
    value: 'personal_contribution',
    label: 'Personal Contribution to Business',
    help: 'Your own family/personal funds put into the business. Increases available cash, not business revenue.',
  },
  {
    value: 'capital_contribution',
    label: 'Owner Capital Contribution',
    help: 'Initial or expansion owner capital added to the business.',
  },
  {
    value: 'loan_received',
    label: 'Business Loan Received',
    help: 'SHG, bank, or MUDRA loan funds received. Increases cash without inflating sales.',
  },
  {
    value: 'loan_repayment',
    label: 'Loan Repayment / EMI',
    help: 'Principal/EMI payment reducing available cash, tracked outside operating expenses.',
  },
  {
    value: 'account_transfer',
    label: 'Transfer Between Cash & Bank/UPI',
    help: 'Moving money between your cash box, UPI, and bank account. Neither income nor expense.',
  },
];

export const SeparationPage: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entryKind, setEntryKind] = useState<EntryKind>('household_withdrawal');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState(0);
  const [accountTarget, setAccountTarget] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [transferTo, setTransferTo] = useState<'cash' | 'upi' | 'bank'>('bank');
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [sumRes, txRes] = await Promise.all([
      apiFetch<FinancialSummary>('/api/finance/summary'),
      apiFetch<{ transactions: Transaction[] }>('/api/finance/transactions'),
    ]);
    setSummary(sumRes);
    setTransactions(
      txRes.transactions.filter((t) => t.entry_kind !== 'sale' && t.entry_kind !== 'expense')
    );
  }, []);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/finance/transactions', {
      method: 'POST',
      body: JSON.stringify({
        tx_date: txDate,
        entry_kind: entryKind,
        item_name: itemName,
        category: NON_OPERATING_KINDS.find((k) => k.value === entryKind)?.label || 'Adjustment',
        quantity: 1,
        unit_price: amount,
        amount,
        payment_method: accountTarget === 'bank' ? 'bank_transfer' : accountTarget,
        account_target: accountTarget,
        transfer_to_account: entryKind === 'account_transfer' ? transferTo : null,
      }),
    });
    setItemName('');
    setAmount(0);
    setMsg('Separated financial adjustment recorded accurately.');
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/finance/transactions/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const selectedMeta = NON_OPERATING_KINDS.find((k) => k.value === entryKind);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Household-Business Financial Separation Engine
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Clearly separates business operating profit from household withdrawals, personal capital,
          loans, and cash/bank transfers.
        </p>
      </div>

      {summary && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Business Revenue</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatInr(summary.totalRevenue)}</p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Operating Expenses</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatInr(summary.totalOperatingExpenses)}
            </p>
          </div>
          <div className="card-surface p-4 border-blue-200 bg-blue-50/40">
            <p className="text-xs font-medium text-blue-700">Operating Surplus (Profit)</p>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {formatInr(summary.operatingSurplus)}
            </p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-slate-400" /> Household Withdrawals
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatInr(summary.householdWithdrawals)}
            </p>
          </div>
          <div className="card-surface p-4 bg-blue-600 text-white">
            <p className="text-xs text-blue-100 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Available Business Cash
            </p>
            <p className="text-xl font-bold mt-1">{formatInr(summary.availableCash)}</p>
          </div>
        </section>
      )}

      {/* Accounting vs Cash Reconciliation Callout */}
      {summary && (
        <section className="card-surface p-5 border-blue-100 bg-blue-50/30 grid sm:grid-cols-3 gap-4 text-xs text-slate-700">
          <div>
            <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-blue-600" /> Profit vs Cash Clarity
            </p>
            <p>
              Operating Surplus ({formatInr(summary.operatingSurplus)}) measures business profitability
              before household drawings. Personal contributions ({formatInr(summary.personalContributions)})
              and loans ({formatInr(summary.loansReceived)}) adjust cash without distorting profit.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Account Cash Breakdown</p>
            <ul className="space-y-0.5">
              <li>Cash Box: <strong>{formatInr(summary.cashByAccount.cash)}</strong></li>
              <li>UPI / Wallet: <strong>{formatInr(summary.cashByAccount.upi)}</strong></li>
              <li>Bank Account: <strong>{formatInr(summary.cashByAccount.bank)}</strong></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-blue-600" /> Internal Transfers Volume
            </p>
            <p>
              {formatInr(summary.accountTransfersVolume)} transferred between Cash, UPI & Bank
              (zero impact on profit or total cash).
            </p>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 card-surface p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" /> Record Household / Capital Movement
          </h2>

          {msg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-text">Classification *</label>
              <select
                value={entryKind}
                onChange={(e) => setEntryKind(e.target.value as EntryKind)}
                className="input-field"
              >
                {NON_OPERATING_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              {selectedMeta && (
                <p className="text-[11px] text-slate-500 mt-1">{selectedMeta.help}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Date</label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label-text">Description *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Family groceries / Cash deposited to SBI"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">
                  {entryKind === 'account_transfer' ? 'From Account' : 'Account'}
                </label>
                <select
                  value={accountTarget}
                  onChange={(e) => setAccountTarget(e.target.value as any)}
                  className="input-field"
                >
                  <option value="cash">Cash Box</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank Account</option>
                </select>
              </div>
              {entryKind === 'account_transfer' && (
                <div>
                  <label className="label-text">To Account</label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash Box</option>
                  </select>
                </div>
              )}
            </div>

            <button type="submit" disabled={amount <= 0} className="btn-primary w-full">
              Record Separated Movement
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 space-y-6">
          {/* Monthly Movement Report */}
          {summary && summary.momTrends.length > 0 && (
            <div className="card-surface p-5 space-y-3">
              <h2 className="font-semibold text-slate-900">
                Monthly Household–Business Money Movement Report
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Month</th>
                      <th className="py-2 pr-3 text-right font-medium">Operating Surplus</th>
                      <th className="py-2 pr-3 text-right font-medium">Household Draw</th>
                      <th className="py-2 text-right font-medium">Personal Capital Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.momTrends.map((m) => (
                      <tr key={m.month}>
                        <td className="py-2 pr-3 font-semibold text-slate-800">{m.month}</td>
                        <td className="py-2 pr-3 text-right font-medium text-blue-700">
                          {formatInr(m.operatingSurplus)}
                        </td>
                        <td className="py-2 pr-3 text-right text-slate-800">
                          {formatInr(m.householdWithdrawals)}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {formatInr(m.personalContributions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recorded Non-operating Entries */}
          <div className="card-surface p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Non-Operating & Household Entries</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Classification</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 pr-3 text-xs text-slate-500">{t.tx_date}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{t.item_name}</td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700">
                          {t.entry_kind.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatInr(t.amount)}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

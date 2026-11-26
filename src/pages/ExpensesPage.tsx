import React, { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, Download, Plus, Trash2, Upload, Repeat } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { exportLedgerReportPdf, exportTransactionsCsv } from '../lib/exportUtils';
import { FinancialSummary, Transaction } from '../types';

const EXPENSE_CATEGORIES = [
  'Raw materials',
  'Packaging',
  'Transportation',
  'Electricity',
  'Rent',
  'Labour',
  'Marketing',
  'Equipment',
  'Maintenance',
  'Other business expenses',
];

export const ExpensesPage: React.FC = () => {
  const { businessProfile, isOnline, queueOfflineTx } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Raw materials');
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'credit'>('cash');
  const [supplierId, setSupplierId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paidNow, setPaidNow] = useState(0);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly'>('monthly');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ entry_kind: 'expense' });
    if (categoryFilter !== 'all') params.set('category', categoryFilter);

    const [txRes, sumRes, supRes] = await Promise.all([
      apiFetch<{ transactions: Transaction[] }>(`/api/finance/transactions?${params}`),
      apiFetch<FinancialSummary>('/api/finance/summary'),
      apiFetch<{ suppliers: Array<{ id: string; name: string }> }>('/api/finance/suppliers'),
    ]);
    setTransactions(txRes.transactions);
    setSummary(sumRes);
    setSuppliers(supRes.suppliers);
  }, [categoryFilter]);

  useEffect(() => {
    if (isOnline) loadData().catch(() => {});
  }, [isOnline, loadData]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      let receipt_path: string | null = null;
      if (receiptFile && isOnline) {
        const fd = new FormData();
        fd.append('receipt', receiptFile);
        const up = await apiFetch<{ receipt_path: string }>('/api/finance/transactions/receipt', {
          method: 'POST',
          body: fd,
        });
        receipt_path = up.receipt_path;
      }

      const payload = {
        tx_date: txDate,
        entry_kind: 'expense',
        item_name: itemName,
        category,
        quantity: 1,
        unit_price: amount,
        amount,
        payment_method: paymentMethod,
        supplier_id: supplierId || null,
        due_date: paymentMethod === 'credit' ? dueDate || null : null,
        paid_amount: paymentMethod === 'credit' ? paidNow : amount,
        is_recurring: isRecurring,
        recurring_interval: isRecurring ? recurringInterval : null,
        receipt_path,
        notes,
      };

      if (!isOnline) {
        queueOfflineTx(payload);
        setStatusMsg('Saved to offline queue. Receipt upload requires connectivity.');
      } else {
        await apiFetch('/api/finance/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatusMsg('Business expense recorded accurately.');
        await loadData();
      }

      setItemName('');
      setAmount(0);
      setPaidNow(0);
      setReceiptFile(null);
      setNotes('');
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/finance/transactions/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const maxCat = Math.max(1, ...(summary?.expenseByCategory.map((c) => c.amount) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Expense Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track operating costs, recurring overheads, supplier credit bills, and receipt uploads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportTransactionsCsv(transactions, 'shakti-expenses-report.csv')}
            className="btn-secondary text-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportLedgerReportPdf(
                'Expense Breakdown Report',
                businessProfile?.business_name || 'Shakti Enterprise',
                ['Date', 'Description', 'Category', 'Method', 'Amount (INR)'],
                transactions.map((t) => [t.tx_date, t.item_name, t.category, t.payment_method, t.amount]),
                `shakti-expenses-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
            className="btn-primary text-xs"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Form */}
        <section className="lg:col-span-4 card-surface p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" /> Record Business Expense
          </h2>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleSaveExpense} className="space-y-3">
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
                <label className="label-text">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Expense Description *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Groundnut Oil 25L Tin"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="input-field"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit">Unpaid Supplier Bill (Credit)</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div>
                  <label className="label-text">Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Supplier (Optional)</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-text">Paid Now (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={amount}
                      value={paidNow}
                      onChange={(e) => setPaidNow(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Payment Deadline</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                Recurring expense
              </label>
              {isRecurring && (
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value as 'weekly' | 'monthly')}
                  className="input-field w-auto text-xs py-1"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              )}
            </div>

            <div>
              <label className="label-text">Optional Receipt Photo / PDF</label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-blue-400 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="truncate">{receiptFile ? receiptFile.name : 'Choose receipt image or PDF'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="label-text">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note"
                className="input-field"
              />
            </div>

            <button type="submit" disabled={saving || amount <= 0} className="btn-primary w-full">
              {saving ? 'Saving...' : 'Save Business Expense'}
            </button>
          </form>
        </section>

        {/* Breakdown + Table */}
        <div className="lg:col-span-8 space-y-6">
          {summary && summary.expenseByCategory.length > 0 && (
            <section className="card-surface p-5 space-y-3">
              <h2 className="font-semibold text-slate-900 text-sm">Expense Breakdown by Category</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {summary.expenseByCategory.map((c) => (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{c.category}</span>
                      <span className="font-semibold text-slate-900">{formatInr(c.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (c.amount / maxCat) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Expense History</h2>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field w-auto text-xs py-1.5"
              >
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{tx.tx_date}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {tx.item_name}
                          {Number(tx.is_recurring) === 1 && (
                            <span title="Recurring expense" className="text-blue-600">
                              <Repeat className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {tx.receipt_path && (
                          <a
                            href={tx.receipt_path}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            View Receipt
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">{tx.category}</td>
                      <td className="py-2.5 pr-3 text-xs uppercase text-slate-600">{tx.payment_method}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatInr(tx.amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
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
          </section>
        </div>
      </div>
    </div>
  );
};

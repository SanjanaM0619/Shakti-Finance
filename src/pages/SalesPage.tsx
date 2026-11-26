import React, { useEffect, useState, useCallback } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, WifiOff } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { exportFinancialSummaryPdf, exportTransactionsCsv } from '../lib/exportUtils';
import { FinancialSummary, Transaction } from '../types';

const SALE_CATEGORIES = ['Snacks', 'Spices', 'Pickles', 'Tailoring', 'Handicrafts', 'Beauty Services', 'Retail', 'Product Sales', 'General'];

export const SalesPage: React.FC = () => {
  const { businessProfile, isOnline, queueOfflineTx } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);

  // Filters & report period
  const [periodTab, setPeriodTab] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'annual'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Snacks');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'credit'>('cash');
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paidNow, setPaidNow] = useState(0);
  const [notes, setNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const computedTotal = Math.round(quantity * unitPrice * 100) / 100;

  const applyPeriodTab = (tab: typeof periodTab) => {
    setPeriodTab(tab);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (tab === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (tab === 'daily') {
      setStartDate(today);
      setEndDate(today);
    } else if (tab === 'weekly') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    } else if (tab === 'monthly') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    } else if (tab === 'annual') {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    }
  };

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ entry_kind: 'sale' });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);

    const sumParams = new URLSearchParams();
    if (startDate) sumParams.set('startDate', startDate);
    if (endDate) sumParams.set('endDate', endDate);

    const [txRes, sumRes, custRes] = await Promise.all([
      apiFetch<{ transactions: Transaction[] }>(`/api/finance/transactions?${params}`),
      apiFetch<FinancialSummary>(`/api/finance/summary?${sumParams}`),
      apiFetch<{ customers: Array<{ id: string; name: string }> }>('/api/finance/customers'),
    ]);
    setTransactions(txRes.transactions);
    setSummary(sumRes);
    setCustomers(custRes.customers);
  }, [startDate, endDate, categoryFilter]);

  useEffect(() => {
    if (isOnline) loadData().catch(() => {});
  }, [isOnline, loadData]);

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setSaving(true);

    const payload = {
      tx_date: txDate,
      entry_kind: 'sale',
      item_name: itemName,
      category,
      quantity,
      unit_price: unitPrice,
      amount: computedTotal,
      payment_method: paymentMethod,
      customer_id: customerId || null,
      due_date: paymentMethod === 'credit' ? dueDate || null : null,
      paid_amount: paymentMethod === 'credit' ? paidNow : computedTotal,
      notes,
    };

    try {
      if (!isOnline) {
        queueOfflineTx(payload);
        setStatusMsg('Saved to offline queue. Will sync safely when internet returns.');
      } else {
        await apiFetch('/api/finance/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatusMsg('Sale recorded accurately in your business ledger.');
        await loadData();
      }
      setItemName('');
      setQuantity(1);
      setUnitPrice(0);
      setPaidNow(0);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Management & Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track cash, UPI, bank transfer, and customer credit sales with automatic totals.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportTransactionsCsv(transactions, 'shakti-sales-report.csv')}
            className="btn-secondary text-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() =>
              summary &&
              exportFinancialSummaryPdf(
                businessProfile?.business_name || 'Shakti Enterprise',
                summary,
                transactions,
                `Sales Report (${periodTab})`
              )
            }
            className="btn-primary text-xs"
          >
            <Download className="w-4 h-4" /> Export PDF P&L
          </button>
        </div>
      </div>

      {/* Report Period Summary Strip */}
      {summary && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Period Sales</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">{formatInr(summary.totalRevenue)}</p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Cash / UPI / Bank Collected</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {formatInr(
                (summary.salesByPaymentMethod.cash || 0) +
                  (summary.salesByPaymentMethod.upi || 0) +
                  (summary.salesByPaymentMethod.bank_transfer || 0)
              )}
            </p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Credit Sales Billed</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {formatInr(summary.salesByPaymentMethod.credit || 0)}
            </p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs text-slate-500">Period Operating Surplus</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {formatInr(summary.operatingSurplus)}
            </p>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Record Sale Form */}
        <section className="lg:col-span-4 card-surface p-5 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Record New Sale
            </h2>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3 h-3" /> Offline Ready
              </span>
            )}
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleRecordSale} className="space-y-3">
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
                  {SALE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-text">Product / Service Name *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Millet Chakli Packets"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Quantity *</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Unit Price (₹) *</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={unitPrice || ''}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  placeholder="85"
                  className="input-field"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">Calculated Total</span>
              <span className="text-lg font-bold text-blue-800">{formatInr(computedTotal)}</span>
            </div>

            <div>
              <label className="label-text">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="input-field"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit Sale (Customer Pays Later)</option>
              </select>
            </div>

            {paymentMethod === 'credit' && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <label className="label-text">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Walk-in / Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-text">Paid Now (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={computedTotal}
                      value={paidNow}
                      onChange={(e) => setPaidNow(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Due Date</label>
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

            <div>
              <label className="label-text">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order details"
                className="input-field"
              />
            </div>

            <button type="submit" disabled={saving || computedTotal <= 0} className="btn-primary w-full">
              {saving ? 'Saving...' : 'Save Sale Entry'}
            </button>
          </form>
        </section>

        {/* Sales History & Filters */}
        <section className="lg:col-span-8 card-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              {(['all', 'daily', 'weekly', 'monthly', 'annual'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => applyPeriodTab(tab)}
                  className={`px-2.5 py-1 rounded-md capitalize cursor-pointer ${
                    periodTab === tab ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field w-auto text-xs py-1.5"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field w-auto text-xs py-1.5"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field w-auto text-xs py-1.5"
              >
                <option value="all">All Categories</option>
                {SALE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Qty × Rate</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      No sales found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{tx.tx_date}</td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{tx.item_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {tx.category}
                          {tx.customer_name ? ` • ${tx.customer_name}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">
                        {tx.quantity} × {formatInr(tx.unit_price)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs uppercase text-slate-600">{tx.payment_method}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            tx.settlement_status === 'paid'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {tx.settlement_status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                        {formatInr(tx.amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

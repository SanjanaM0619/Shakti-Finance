import React, { useEffect, useState, useCallback } from 'react';
import { Truck, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';

interface SupplierRecord {
  id: string;
  name: string;
  phone: string;
  category: string;
  notes: string;
  outstanding: number;
  overdueAmount: number;
  openBills: Array<{ id: string; item_name: string; tx_date: string; due_date: string | null; amount: number; paid_amount: number }>;
  paymentHistory: Array<{ id: string; amount: number; payment_method: string; payment_date: string }>;
}

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Raw materials');
  const [notes, setNotes] = useState('');
  const [settlingBill, setSettlingBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('bank_transfer');

  const loadSuppliers = useCallback(async () => {
    const res = await apiFetch<{ suppliers: SupplierRecord[] }>('/api/finance/suppliers');
    setSuppliers(res.suppliers);
  }, []);

  useEffect(() => {
    loadSuppliers().catch(() => {});
  }, [loadSuppliers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/suppliers', {
      method: 'POST',
      body: JSON.stringify({ name, phone, category, notes }),
    });
    setName('');
    setPhone('');
    setNotes('');
    await loadSuppliers();
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingBill) return;
    await apiFetch(`/api/finance/transactions/${settlingBill.id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ amount: payAmount, payment_method: payMethod }),
    });
    setSettlingBill(null);
    await loadSuppliers();
  };

  const totalPayable = suppliers.reduce((s, sup) => s + sup.outstanding, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Ledger & Upcoming Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage suppliers, unpaid purchase bills, payment deadlines, and outgoing obligations.
          </p>
        </div>
        <div className="card-surface px-4 py-2.5 text-right">
          <p className="text-xs text-slate-500">Total Unpaid Supplier Bills</p>
          <p className="text-lg font-bold text-slate-900">{formatInr(totalPayable)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 card-surface p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" /> Add Supplier
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="label-text">Supplier Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Kaveri Wholesale Grains"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Supply Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Save Supplier</button>
          </form>
        </section>

        <section className="lg:col-span-8 space-y-4">
          {suppliers.map((s) => (
            <article key={s.id} className="card-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" /> {s.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.category} • {s.phone || 'No phone'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Payable Balance</p>
                  <p className="text-lg font-bold text-slate-900">{formatInr(s.outstanding)}</p>
                  {s.overdueAmount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Overdue: {formatInr(s.overdueAmount)}
                    </span>
                  ) : s.outstanding === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Clear
                    </span>
                  ) : null}
                </div>
              </div>

              {s.openBills.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Unpaid Purchase Bills</p>
                  {s.openBills.map((b) => {
                    const rem = b.amount - b.paid_amount;
                    const isOverdue = b.due_date && b.due_date < today;
                    return (
                      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <p className="font-medium text-slate-900">{b.item_name}</p>
                          <p className="text-slate-500">
                            Purchased: {b.tx_date} • Paid {formatInr(b.paid_amount)} of {formatInr(b.amount)} •{' '}
                            <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>
                              Deadline: {b.due_date || 'Not set'}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettlingBill(b);
                            setPayAmount(rem);
                          }}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Pay Bill ({formatInr(rem)})
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>

      {settlingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="card-surface max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900">Record Supplier Bill Payment</h3>
            <p className="text-xs text-slate-600">
              Bill: <strong>{settlingBill.item_name}</strong> (Remaining:{' '}
              {formatInr(settlingBill.amount - settlingBill.paid_amount)})
            </p>
            <form onSubmit={handleSettle} className="space-y-3">
              <div>
                <label className="label-text">Amount Paid (₹)</label>
                <input
                  type="number"
                  min={1}
                  max={settlingBill.amount - settlingBill.paid_amount}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="input-field"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSettlingBill(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

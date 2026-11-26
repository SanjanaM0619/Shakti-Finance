import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  notes: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  overdueAmount: number;
  openBills: Array<{ id: string; item_name: string; tx_date: string; due_date: string | null; amount: number; paid_amount: number }>;
  paymentHistory: Array<{ id: string; amount: number; payment_method: string; payment_date: string }>;
}

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [unlinkedBills, setUnlinkedBills] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Settlement modal state
  const [settlingBill, setSettlingBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('upi');

  const loadCustomers = useCallback(async () => {
    const res = await apiFetch<{ customers: CustomerRecord[]; unlinkedBills: any[] }>('/api/finance/customers');
    setCustomers(res.customers);
    setUnlinkedBills(res.unlinkedBills);
  }, []);

  useEffect(() => {
    loadCustomers().catch(() => {});
  }, [loadCustomers]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/customers', {
      method: 'POST',
      body: JSON.stringify({ name, phone, notes }),
    });
    setName('');
    setPhone('');
    setNotes('');
    await loadCustomers();
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingBill) return;
    await apiFetch(`/api/finance/transactions/${settlingBill.id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ amount: payAmount, payment_method: payMethod }),
    });
    setSettlingBill(null);
    await loadCustomers();
  };

  const today = new Date().toISOString().slice(0, 10);
  const totalReceivable = customers.reduce((s, c) => s + c.outstanding, 0) +
    unlinkedBills.reduce((s, b) => s + (b.amount - b.paid_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Credit & Receivables Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track pending customer payments, overdue balances, and partial settlements. Pending credit is excluded from Available Cash until received.
          </p>
        </div>
        <div className="card-surface px-4 py-2.5 text-right">
          <p className="text-xs text-slate-500">Total Pending Receivables</p>
          <p className="text-lg font-bold text-blue-700">{formatInr(totalReceivable)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 card-surface p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" /> Add Customer
          </h2>
          <form onSubmit={handleAddCustomer} className="space-y-3">
            <div>
              <label className="label-text">Customer / Shop Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Annapurna Bakery"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9880112233"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Regular wholesale buyer"
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Save Customer</button>
          </form>
        </section>

        <section className="lg:col-span-8 space-y-4">
          {customers.map((c) => (
            <article key={c.id} className="card-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" /> {c.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.phone || 'No phone'} {c.notes ? `• ${c.notes}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="text-lg font-bold text-slate-900">{formatInr(c.outstanding)}</p>
                  {c.overdueAmount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Overdue: {formatInr(c.overdueAmount)}
                    </span>
                  ) : c.outstanding === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Settled
                    </span>
                  ) : null}
                </div>
              </div>

              {c.openBills.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Open Credit Bills</p>
                  {c.openBills.map((b) => {
                    const rem = b.amount - b.paid_amount;
                    const isOverdue = b.due_date && b.due_date < today;
                    return (
                      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <p className="font-medium text-slate-900">{b.item_name}</p>
                          <p className="text-slate-500">
                            Date: {b.tx_date} • Paid {formatInr(b.paid_amount)} of {formatInr(b.amount)} •{' '}
                            <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>
                              Due: {b.due_date || 'Not set'}
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
                          Record Payment ({formatInr(rem)} due)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {c.paymentHistory.length > 0 && (
                <div className="border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Recent Payments Received</p>
                  <div className="flex flex-wrap gap-2">
                    {c.paymentHistory.slice(0, 4).map((p) => (
                      <span key={p.id} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {p.payment_date}: {formatInr(p.amount)} ({p.payment_method})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>

      {/* Settlement Modal */}
      {settlingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="card-surface max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900">Record Customer Payment</h3>
            <p className="text-xs text-slate-600">
              Invoice: <strong>{settlingBill.item_name}</strong> (Remaining balance:{' '}
              {formatInr(settlingBill.amount - settlingBill.paid_amount)})
            </p>
            <form onSubmit={handleSettle} className="space-y-3">
              <div>
                <label className="label-text">Amount Received (₹)</label>
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
                <label className="label-text">Received Via</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="input-field"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
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

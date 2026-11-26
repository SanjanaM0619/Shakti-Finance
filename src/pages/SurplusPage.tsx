import React, { useEffect, useState } from 'react';
import { PiggyBank, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

interface SurplusResponse {
  availableCash: number;
  distributableAfterObligations: number;
  accountsReceivablePending: number;
  note: string;
  recommended: {
    upcoming_obligations: number;
    emergency_reserves: number;
    business_reinvestment: number;
    personal_savings: number;
    flexible_spending: number;
  };
  saved: any;
  rationale: Array<{ bucket: string; key: string; amount: number; reason: string }>;
}

export const SurplusPage: React.FC = () => {
  const { language } = useAuth();
  const [data, setData] = useState<SurplusResponse | null>(null);
  const [plan, setPlan] = useState({
    upcoming_obligations: 0,
    emergency_reserves: 0,
    business_reinvestment: 0,
    personal_savings: 0,
    flexible_spending: 0,
    notes: '',
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SurplusResponse>('/api/finance/surplus').then((res) => {
      setData(res);
      const src = res.saved || res.recommended;
      setPlan({
        upcoming_obligations: src.upcoming_obligations || 0,
        emergency_reserves: src.emergency_reserves || 0,
        business_reinvestment: src.business_reinvestment || 0,
        personal_savings: src.personal_savings || 0,
        flexible_spending: src.flexible_spending || 0,
        notes: res.saved?.notes || '',
      });
    });
  }, []);

  if (!data) {
    return <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  const totalPlanned =
    plan.upcoming_obligations +
    plan.emergency_reserves +
    plan.business_reinvestment +
    plan.personal_savings +
    plan.flexible_spending;

  const diff = Math.round((data.availableCash - totalPlanned) * 100) / 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/surplus', {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
    setSavedMsg('Your custom surplus allocation plan is saved. No funds were moved automatically.');
  };

  const resetToRecommended = () => {
    setPlan((p) => ({ ...p, ...data.recommended }));
    setSavedMsg(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t(language, 'surplusTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t(language, 'surplusDesc')}
          </p>
        </div>
        <button type="button" onClick={resetToRecommended} className="btn-secondary text-xs">
          Reset to Engine Recommendation
        </button>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Advisory Planning Only — Manual Control</p>
          <p className="mt-0.5">{data.note}</p>
        </div>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {savedMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 card-surface p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-blue-600" /> Edit Your Cash Plan
            </h2>
            <span className="text-xs font-semibold text-blue-700">
              Available Cash: {formatInr(data.availableCash)}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            {[
              { key: 'upcoming_obligations', label: '1. Upcoming Business Obligations' },
              { key: 'emergency_reserves', label: '2. Emergency Reserves' },
              { key: 'business_reinvestment', label: '3. Business Reinvestment & Growth' },
              { key: 'personal_savings', label: '4. Personal & Family Savings' },
              { key: 'flexible_spending', label: '5. Flexible Operating Balance' },
            ].map((field) => (
              <div key={field.key}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700">{field.label}</label>
                  <span className="text-[11px] text-slate-500">
                    Suggested: {formatInr((data.recommended as any)[field.key])}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={(plan as any)[field.key]}
                  onChange={(e) => setPlan({ ...plan, [field.key]: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            ))}

            <div
              className={`p-3 rounded-lg border text-xs flex justify-between font-semibold ${
                diff < 0
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <span>Total Allocated: {formatInr(totalPlanned)}</span>
              <span>
                {diff >= 0 ? `Unallocated: ${formatInr(diff)}` : `Over-allocated by ${formatInr(Math.abs(diff))}`}
              </span>
            </div>

            <button type="submit" disabled={diff < 0} className="btn-primary w-full">
              Save Allocation Plan
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 space-y-3">
          <h2 className="font-semibold text-slate-900">Why Each Amount Was Suggested</h2>
          {data.rationale.map((item) => (
            <article key={item.key} className="card-surface p-4 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-slate-900">{item.bucket}</h3>
                <span className="text-sm font-bold text-blue-700">{formatInr(item.amount)}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

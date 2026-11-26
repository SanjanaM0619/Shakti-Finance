import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { FinancialSummary } from '../types';

export const HealthPage: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);

  useEffect(() => {
    apiFetch<FinancialSummary>('/api/finance/summary').then(setSummary).catch(() => {});
  }, []);

  if (!summary) {
    return <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  const indicators = [
    { label: '1. Total Business Revenue', value: formatInr(summary.totalRevenue), note: 'Includes billed sales' },
    { label: '2. Operating Expenses', value: formatInr(summary.totalOperatingExpenses), note: 'Excludes household drawings' },
    { label: '3. Gross Profit (COGS-based)', value: summary.grossProfit !== null ? formatInr(summary.grossProfit) : 'Insufficient COGS data', note: summary.costOfGoodsSold !== null ? `COGS: ${formatInr(summary.costOfGoodsSold)}` : 'Tag Raw materials/Packaging' },
    { label: '4. Net Operating Surplus', value: formatInr(summary.operatingSurplus), note: 'Before household & loan items' },
    { label: '5. Profit Margin', value: `${summary.profitMarginPct}%`, note: 'Operating surplus / Revenue' },
    { label: '6. Available Liquid Cash', value: formatInr(summary.availableCash), note: 'Collected cash + UPI + bank only' },
    { label: '7. Accounts Receivable', value: formatInr(summary.accountsReceivable), note: `Overdue: ${formatInr(summary.overdueReceivables)}` },
    { label: '8. Accounts Payable', value: formatInr(summary.accountsPayable), note: `Overdue: ${formatInr(summary.overduePayables)}` },
    { label: '9. Household Withdrawals', value: formatInr(summary.householdWithdrawals), note: 'Separated from operating cost' },
    { label: '10. Working Capital', value: formatInr(summary.workingCapital), note: 'Cash + Receivables - Payables' },
    { label: '11. Upcoming Obligations (30d)', value: formatInr(summary.upcomingObligations), note: 'Supplier bills + recurring + EMI' },
    { label: '12. Emergency Financial Buffer', value: formatInr(summary.emergencyBuffer), note: `${summary.emergencyBufferCoveragePct}% of ${formatInr(summary.emergencyReserveGoal)} goal` },
    { label: '13. MoM Revenue / Expense Trend', value: summary.revenueGrowthPct !== null ? `${summary.revenueGrowthPct >= 0 ? '+' : ''}${summary.revenueGrowthPct}% rev` : 'Need >=2 months', note: summary.expenseGrowthPct !== null ? `${summary.expenseGrowthPct >= 0 ? '+' : ''}${summary.expenseGrowthPct}% exp` : 'Record more history' },
  ];

  const statusColors =
    summary.health.status === 'Healthy'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : summary.health.status === 'Needs attention'
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-rose-50 border-rose-200 text-rose-900';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Intelligent Financial Health Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Transparent rule-based diagnosis of profitability, liquidity, obligations, and resilience.
        </p>
      </div>

      {/* Classification Banner */}
      <section className={`p-6 rounded-xl border ${statusColors} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">
                Financial Health Classification
              </p>
              <h2 className="text-2xl font-bold">{summary.health.status}</h2>
            </div>
          </div>
          {summary.health.score !== null && (
            <div className="bg-white/80 px-4 py-2 rounded-lg border border-current/15 text-center">
              <p className="text-[11px] font-medium opacity-80">Health Index</p>
              <p className="text-xl font-bold">{summary.health.score} / 100</p>
            </div>
          )}
        </div>
        <p className="text-sm font-medium">{summary.health.summary}</p>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          {summary.health.factors.map((f, i) => (
            <div key={i} className="bg-white/90 p-3.5 rounded-lg border border-slate-200/70 text-slate-800 text-xs flex items-start gap-2.5">
              {f.impact === 'positive' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : f.impact === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-slate-900">{f.label}</p>
                <p className="text-slate-600 mt-0.5">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 13 Financial Indicators Grid */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">All 13 Verified Financial Indicators</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {indicators.map((ind) => (
            <article key={ind.label} className="card-surface p-4 space-y-1">
              <p className="text-xs font-medium text-slate-500">{ind.label}</p>
              <p className="text-xl font-bold text-slate-900">{ind.value}</p>
              <p className="text-[11px] text-blue-700">{ind.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Accounting Assumptions */}
      <section className="card-surface p-5 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" /> Accounting Assumptions & Transparency
        </h3>
        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
          {summary.accountingAssumptions.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};

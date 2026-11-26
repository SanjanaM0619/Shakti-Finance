import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Receipt,
  Wallet,
  Scale,
  Users,
  Truck,
  Mic,
  ArrowRight,
  Activity,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { FinancialSummary, Transaction } from '../types';

export const DashboardPage: React.FC = () => {
  const { user, businessProfile, language } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<FinancialSummary>('/api/finance/summary'),
      apiFetch<{ transactions: Transaction[] }>('/api/finance/transactions'),
    ])
      .then(([sum, txRes]) => {
        setSummary(sum);
        setRecentTx(txRes.transactions.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const healthBadgeStyle =
    summary.health.status === 'Healthy'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : summary.health.status === 'Needs attention'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

  const maxBar = Math.max(
    1,
    ...summary.momTrends.map((m) => Math.max(m.revenue, m.expenses))
  );

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {businessProfile?.business_name || `${user?.name}'s Enterprise`}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Verified business performance, liquid cash position, and upcoming obligations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/voice" className="btn-primary">
            <Mic className="w-4 h-4" /> Voice Entry
          </Link>
          <Link to="/sales" className="btn-secondary">
            + Add Sale
          </Link>
          <Link to="/expenses" className="btn-secondary">
            + Add Expense
          </Link>
        </div>
      </div>

      {/* 6 Required Primary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Core Financial Metrics">
        <article className="card-surface p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(language, 'totalSales')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatInr(summary.totalRevenue)}</p>
            <p className="text-xs text-slate-500 mt-1">Last 30d: {formatInr(summary.last30Revenue)}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </article>

        <article className="card-surface p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(language, 'totalExpenses')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatInr(summary.totalOperatingExpenses)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Excludes {formatInr(summary.householdWithdrawals)} household draw
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
            <Receipt className="w-5 h-5" />
          </div>
        </article>

        <article className="card-surface p-5 flex items-start justify-between border-blue-200 bg-blue-50/30">
          <div>
            <p className="text-xs font-medium text-blue-700">{t(language, 'operatingSurplus')}</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {formatInr(summary.operatingSurplus)}
            </p>
            <p className="text-xs text-blue-600 mt-1">Margin: {summary.profitMarginPct}%</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-600 text-white">
            <Scale className="w-5 h-5" />
          </div>
        </article>

        <article className="card-surface p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(language, 'availableCash')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatInr(summary.availableCash)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Cash {formatInr(summary.cashByAccount.cash)} • UPI {formatInr(summary.cashByAccount.upi)} • Bank{' '}
              {formatInr(summary.cashByAccount.bank)}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Wallet className="w-5 h-5" />
          </div>
        </article>

        <Link to="/customers" className="card-surface p-5 flex items-start justify-between hover:border-blue-300 transition-colors">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(language, 'pendingCustomers')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatInr(summary.accountsReceivable)}
            </p>
            <p className={`text-xs mt-1 ${summary.overdueReceivables > 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
              Overdue: {formatInr(summary.overdueReceivables)} (excluded from cash)
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </Link>

        <Link to="/suppliers" className="card-surface p-5 flex items-start justify-between hover:border-blue-300 transition-colors">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(language, 'upcomingSuppliers')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatInr(summary.accountsPayable)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Due within 30d: {formatInr(summary.upcomingSupplierObligations30d)}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
            <Truck className="w-5 h-5" />
          </div>
        </Link>
      </section>

      {/* Health Summary & Monthly Revenue vs Expense Chart */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" /> Financial Health Check
            </h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${healthBadgeStyle}`}>
              {summary.health.status}
            </span>
          </div>
          <p className="text-sm text-slate-600">{summary.health.summary}</p>
          <ul className="space-y-2">
            {summary.health.factors.slice(0, 3).map((f, idx) => (
              <li key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">{f.label}: </span>
                {f.detail}
              </li>
            ))}
          </ul>
          <Link to="/health" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
            View all 13 financial health indicators <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>

        <section className="lg:col-span-7 card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Monthly Revenue vs Operating Expenses</h2>
              <p className="text-xs text-slate-500">Strictly separates business costs from household draws</p>
            </div>
            <Link to="/forecast" className="text-xs font-semibold text-blue-600 hover:underline">
              Open Cash Forecast →
            </Link>
          </div>

          {summary.momTrends.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Record sales and expenses to see monthly revenue and expense trends.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {summary.momTrends.map((m) => (
                <div key={m.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{m.month}</span>
                    <span className="text-slate-500">
                      Rev <strong className="text-blue-700">{formatInr(m.revenue)}</strong> • Exp{' '}
                      <strong className="text-slate-800">{formatInr(m.expenses)}</strong> • Surplus{' '}
                      <strong className="text-slate-900">{formatInr(m.operatingSurplus)}</strong>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${Math.min(100, (m.revenue / maxBar) * 100)}%` }}
                      />
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-slate-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (m.expenses / maxBar) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Transactions & Quick Links */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Ledger Activity</h2>
            <Link to="/separation" className="text-xs font-semibold text-blue-600 hover:underline">
              Full Business vs Home Ledger →
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No transactions yet. Use Voice Entry or add your first sale.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTx.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">{tx.tx_date}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{tx.item_name}</td>
                      <td className="py-2.5 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                          {tx.entry_kind.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600 uppercase">{tx.payment_method}</td>
                      <td
                        className={`py-2.5 text-right font-semibold whitespace-nowrap ${
                          tx.entry_kind === 'sale' ? 'text-blue-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.entry_kind === 'sale' ? '+' : '-'}
                        {formatInr(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-4 card-surface p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-600" /> Recommended Next Actions
          </h2>
          <div className="space-y-2.5">
            <Link
              to="/schemes"
              className="block p-3.5 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm font-semibold text-blue-800">Discover Govt Schemes</p>
              <p className="text-xs text-blue-700/80 mt-0.5">
                Check MUDRA, PMFME, Udyogini & KSFC eligibility
              </p>
            </Link>
            <Link
              to="/surplus"
              className="block p-3.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800">Plan Surplus Allocation</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Balance upcoming bills, emergency buffer & savings
              </p>
            </Link>
            <Link
              to="/readiness-report"
              className="block p-3.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800">Download Readiness Report</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Export PDF/CSV financial summary for bank discussions
              </p>
            </Link>
            {summary.overdueReceivables > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  You have {formatInr(summary.overdueReceivables)} in overdue customer payments.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

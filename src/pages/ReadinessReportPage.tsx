import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, ShieldAlert, AlertCircle, Landmark } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { exportReadinessReportPdf } from '../lib/exportUtils';

export const ReadinessReportPage: React.FC = () => {
  const [report, setReport] = useState<any | null>(null);

  useEffect(() => {
    apiFetch('/api/finance/readiness-report').then(setReport).catch(() => {});
  }, []);

  if (!report) {
    return <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  const bp = report.businessProfile || {};
  const fs = report.financialSummary || {};

  const exportCsvSummary = () => {
    const rows = [
      ['Section', 'Field', 'Value'],
      ['Business Profile', 'Entrepreneur Name', report.user?.name || ''],
      ['Business Profile', 'Business Name', bp.business_name || ''],
      ['Business Profile', 'Category & Stage', `${bp.category || ''} (${bp.enterprise_stage || ''})`],
      ['Business Profile', 'Location', `${bp.location || ''}, ${bp.state || ''}`],
      ['Business Profile', 'Udyam Status', bp.udyam_status || ''],
      ['Business Profile', 'Funding Requirement (INR)', bp.funding_requirement || 0],
      ['Business Profile', 'Expansion Objective', bp.growth_goals || ''],
      ['Financial Summary', 'Total Revenue (INR)', fs.totalRevenue || 0],
      ['Financial Summary', 'Operating Expenses (INR)', fs.totalOperatingExpenses || 0],
      ['Financial Summary', 'Operating Surplus (INR)', fs.operatingSurplus || 0],
      ['Financial Summary', 'Available Liquid Cash (INR)', fs.availableCash || 0],
      ['Financial Summary', 'Accounts Receivable (INR)', fs.accountsReceivable || 0],
      ['Financial Summary', 'Accounts Payable (INR)', fs.accountsPayable || 0],
      ['Financial Summary', 'Existing Loan Balance (INR)', bp.existing_loan_balance || 0],
      ['Cash Flow 30d', 'Projected Inflow (INR)', report.cashFlowProjection30d?.totalExpectedInflow || 0],
      ['Cash Flow 30d', 'Projected Outflow (INR)', report.cashFlowProjection30d?.totalExpectedOutflow || 0],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shakti-readiness-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Financial Readiness Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organized enterprise & ledger profile prepared for approaching banks, SHG federations, or scheme officers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsvSummary} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportReadinessReportPdf(report)}
            className="btn-primary text-xs"
          >
            <Download className="w-4 h-4" /> Download PDF Report
          </button>
        </div>
      </div>

      {/* Explicit Disclaimer */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p>{report.disclaimer}</p>
      </div>

      {report.missingInformation.length > 0 && (
        <section className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Missing Financial / Profile Information
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {report.missingInformation.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="card-surface p-6 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Enterprise & Funding Profile
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Entrepreneur</dt>
              <dd className="font-semibold text-slate-900">{report.user?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Business Name</dt>
              <dd className="font-semibold text-slate-900">{bp.business_name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Category & Stage</dt>
              <dd className="text-slate-800">{bp.category} ({bp.enterprise_stage}, {bp.area_type})</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Ownership / Udyam</dt>
              <dd className="text-slate-800">{bp.ownership_type} • Udyam: {bp.udyam_status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Existing Loan Balance / EMI</dt>
              <dd className="text-slate-800">
                {formatInr(bp.existing_loan_balance)} / {formatInr(bp.monthly_loan_emi)} per mo
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Target Funding Requirement</dt>
              <dd className="font-bold text-blue-700">{formatInr(bp.funding_requirement)}</dd>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <dt className="text-slate-500 mb-0.5">Expansion Objective</dt>
              <dd className="text-slate-800">{bp.growth_goals || 'Not specified'}</dd>
            </div>
          </dl>
        </section>

        <section className="card-surface p-6 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Verified P&L & Cash-Flow Position
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Recorded Business Revenue</dt>
              <dd className="font-semibold text-slate-900">{formatInr(fs.totalRevenue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Operating Expenses</dt>
              <dd className="font-semibold text-slate-900">{formatInr(fs.totalOperatingExpenses)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Operating Surplus & Margin</dt>
              <dd className="font-bold text-blue-700">
                {formatInr(fs.operatingSurplus)} ({fs.profitMarginPct}%)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Available Liquid Cash</dt>
              <dd className="font-semibold text-slate-900">{formatInr(fs.availableCash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Customer Receivables</dt>
              <dd className="text-slate-800">{formatInr(fs.accountsReceivable)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Supplier Liabilities</dt>
              <dd className="text-slate-800">{formatInr(fs.accountsPayable)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">30-Day Projected Cash</dt>
              <dd className="font-semibold text-slate-900">
                {formatInr(report.cashFlowProjection30d?.projectedEndBalance)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Relevant Schemes */}
      <section className="card-surface p-6 space-y-3">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" /> Matched Government Support Opportunities
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {report.relevantSchemes.map((s: any) => (
            <div key={s.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium shrink-0">
                  {s.outcome}
                </span>
              </div>
              <p className="text-slate-600">{s.financial_benefit}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

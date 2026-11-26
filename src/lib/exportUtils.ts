import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialSummary, Transaction } from '../types';

export function exportTransactionsCsv(transactions: Transaction[], filename = 'shakti-finance-ledger.csv') {
  const headers = [
    'Date',
    'Entry Kind',
    'Item / Description',
    'Category',
    'Quantity',
    'Unit Price (INR)',
    'Amount (INR)',
    'Payment Method',
    'Paid Amount (INR)',
    'Settlement Status',
    'Due Date',
    'Notes',
  ];

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((t) => [
    t.tx_date,
    t.entry_kind,
    t.item_name,
    t.category,
    t.quantity,
    t.unit_price,
    t.amount,
    t.payment_method,
    t.paid_amount,
    t.settlement_status,
    t.due_date || '',
    t.notes || '',
  ]);

  const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFinancialSummaryPdf(
  businessName: string,
  summary: FinancialSummary,
  transactions: Transaction[],
  periodLabel = 'All Recorded Periods'
) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(29, 78, 216);
  doc.text('Shakti Finance — Financial Report', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Enterprise: ${businessName || 'Women Micro-Enterprise'}`, 14, 26);
  doc.text(`Period: ${periodLabel}   |   Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [['Financial Indicator', 'Amount / Value']],
    body: [
      ['Total Business Revenue', `INR ${summary.totalRevenue.toLocaleString('en-IN')}`],
      ['Total Operating Expenses', `INR ${summary.totalOperatingExpenses.toLocaleString('en-IN')}`],
      ['Operating Surplus (Profit before drawings)', `INR ${summary.operatingSurplus.toLocaleString('en-IN')}`],
      ['Profit Margin', `${summary.profitMarginPct}%`],
      ['Available Business Cash (Cash + UPI + Bank)', `INR ${summary.availableCash.toLocaleString('en-IN')}`],
      ['Accounts Receivable (Pending Customer Credit)', `INR ${summary.accountsReceivable.toLocaleString('en-IN')}`],
      ['Accounts Payable (Unpaid Supplier Bills)', `INR ${summary.accountsPayable.toLocaleString('en-IN')}`],
      ['Household Withdrawals (Separated)', `INR ${summary.householdWithdrawals.toLocaleString('en-IN')}`],
      ['Personal / Capital Contributions', `INR ${summary.personalContributions.toLocaleString('en-IN')}`],
      ['Financial Health Classification', summary.health.status],
    ],
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Recent Transactions (up to 30 entries)', 14, finalY + 12);

  autoTable(doc, {
    startY: finalY + 16,
    head: [['Date', 'Type', 'Item', 'Category', 'Amount (INR)', 'Method']],
    body: transactions.slice(0, 30).map((t) => [
      t.tx_date,
      t.entry_kind,
      t.item_name,
      t.category,
      t.amount.toLocaleString('en-IN'),
      t.payment_method,
    ]),
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 8 },
  });

  doc.save(`shakti-finance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportReadinessReportPdf(report: any) {
  const doc = new jsPDF();
  doc.setFontSize(17);
  doc.setTextColor(29, 78, 216);
  doc.text('Business Financial Readiness Report', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Prepared via Shakti Finance | Generated: ${report.generatedAt.slice(0, 10)}`, 14, 24);

  const bp = report.businessProfile || {};
  const fs = report.financialSummary || {};

  autoTable(doc, {
    startY: 30,
    head: [['Business Profile', 'Details']],
    body: [
      ['Entrepreneur Name', report.user?.name || '—'],
      ['Business Name', bp.business_name || '—'],
      ['Category & Stage', `${bp.category || '—'} (${bp.enterprise_stage || '—'}, ${bp.area_type || '—'})`],
      ['Ownership & Registration', `${bp.ownership_type || '—'} | Udyam: ${bp.udyam_status || '—'} | GST: ${bp.gst_status || '—'}`],
      ['Location', `${bp.location || ''}, ${bp.state || ''}`],
      ['Funding Requirement', `INR ${(bp.funding_requirement || 0).toLocaleString('en-IN')}`],
      ['Expansion Objective', bp.growth_goals || '—'],
    ],
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8.5 },
  });

  const y1 = (doc as any).lastAutoTable?.finalY || 95;
  autoTable(doc, {
    startY: y1 + 8,
    head: [['Financial Summary', 'Verified Ledger Value']],
    body: [
      ['Recorded Revenue', `INR ${(fs.totalRevenue || 0).toLocaleString('en-IN')}`],
      ['Operating Expenses', `INR ${(fs.totalOperatingExpenses || 0).toLocaleString('en-IN')}`],
      ['Operating Surplus', `INR ${(fs.operatingSurplus || 0).toLocaleString('en-IN')} (${fs.profitMarginPct || 0}%)`],
      ['Available Liquid Cash', `INR ${(fs.availableCash || 0).toLocaleString('en-IN')}`],
      ['Customer Receivables', `INR ${(fs.accountsReceivable || 0).toLocaleString('en-IN')}`],
      ['Supplier Liabilities', `INR ${(fs.accountsPayable || 0).toLocaleString('en-IN')}`],
      ['Existing Loan Balance / Monthly EMI', `INR ${(bp.existing_loan_balance || 0).toLocaleString('en-IN')} / INR ${(bp.monthly_loan_emi || 0).toLocaleString('en-IN')}`],
    ],
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 8.5 },
  });

  const y2 = (doc as any).lastAutoTable?.finalY || 170;
  autoTable(doc, {
    startY: y2 + 8,
    head: [['Matched Government Support Opportunities', 'Type', 'Match Status']],
    body: (report.relevantSchemes || []).map((s: any) => [s.name, s.assistance_type, s.outcome]),
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8 },
  });

  const y3 = (doc as any).lastAutoTable?.finalY || 230;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const splitDisclaimer = doc.splitTextToSize(`Disclaimer: ${report.disclaimer}`, 180);
  doc.text(splitDisclaimer, 14, Math.min(275, y3 + 10));

  doc.save(`shakti-readiness-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

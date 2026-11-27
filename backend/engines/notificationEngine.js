import {
  Customer,
  NotificationRead,
  Scheme,
  SchemeApplication,
  Supplier,
  Transaction,
} from '../../database/models/index.js';
import { computeFinancialSummary } from './accountingEngine.js';
import { computeCashFlowForecast } from './forecastEngine.js';

export async function getUserNotifications(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const generated = [];
  const [summary, forecast, customers, suppliers, openSales, openBills, schemeApps, latestTx] =
    await Promise.all([
      computeFinancialSummary(userId),
      computeCashFlowForecast(userId, 30),
      Customer.find({ user_id: userId }).lean(),
      Supplier.find({ user_id: userId }).lean(),
      Transaction.find({
        user_id: userId,
        entry_kind: 'sale',
        due_date: { $ne: null, $lt: today },
        $expr: { $gt: ['$amount', '$paid_amount'] },
      }).lean(),
      Transaction.find({
        user_id: userId,
        entry_kind: 'expense',
        due_date: { $ne: null, $lte: in7Days },
        $expr: { $gt: ['$amount', '$paid_amount'] },
      }).lean(),
      SchemeApplication.find({
        user_id: userId,
        deadline_date: { $ne: null },
        status: { $in: ['bookmarked', 'preparing'] },
      }).lean(),
      Transaction.findOne({ user_id: userId }).sort({ tx_date: -1 }).lean(),
    ]);

  const customerMap = new Map(customers.map((c) => [c._id, c]));
  const supplierMap = new Map(suppliers.map((s) => [s._id, s]));

  for (const s of openSales) {
    const balance = Math.max(0, (Number(s.amount) || 0) - (Number(s.paid_amount) || 0));
    const cust = customerMap.get(s.customer_id);
    generated.push({
      id: `auto-overdue-cust-${s._id}`,
      type: 'overdue_customer',
      title: `Overdue payment from ${cust?.name || 'Customer'}`,
      message: `₹${Math.round(balance).toLocaleString('en-IN')} for "${s.item_name}" was due on ${s.due_date}.`,
      severity: 'high',
      action_url: '/customers',
      created_at: s.due_date,
    });
  }

  for (const b of openBills) {
    const balance = Math.max(0, (Number(b.amount) || 0) - (Number(b.paid_amount) || 0));
    const sup = supplierMap.get(b.supplier_id);
    const isOverdue = b.due_date < today;
    generated.push({
      id: `auto-supplier-bill-${b._id}`,
      type: 'supplier_due',
      title: isOverdue
        ? `Overdue supplier bill: ${sup?.name || b.item_name}`
        : `Upcoming supplier bill due ${b.due_date}`,
      message: `₹${Math.round(balance).toLocaleString('en-IN')} pending to ${sup?.name || 'Supplier'} for "${b.item_name}".`,
      severity: isOverdue ? 'high' : 'medium',
      action_url: '/suppliers',
      created_at: b.due_date,
    });
  }

  for (const w of forecast.warnings) {
    if (w.type === 'cash_shortage' || w.type === 'low_buffer') {
      generated.push({
        id: `auto-forecast-${w.type}-${w.date}`,
        type: 'cash_warning',
        title: w.title,
        message: w.reason,
        severity: w.severity,
        action_url: '/forecast',
        created_at: today,
      });
    }
  }

  if (summary.emergencyBufferCoveragePct < 50 && summary.availableCash > 0) {
    generated.push({
      id: 'auto-savings-goal',
      type: 'savings_goal',
      title: 'Emergency Reserve below 50% of target',
      message: `Your post-obligation buffer covers ${summary.emergencyBufferCoveragePct}% of your ₹${summary.emergencyReserveGoal.toLocaleString('en-IN')} emergency goal. Review Surplus Allocation.`,
      severity: 'info',
      action_url: '/surplus',
      created_at: today,
    });
  }

  if (schemeApps.length > 0) {
    const schemes = await Scheme.find({ _id: { $in: schemeApps.map((a) => a.scheme_id) } }).lean();
    const schemeMap = new Map(schemes.map((s) => [s._id, s]));
    for (const app of schemeApps) {
      if (app.deadline_date <= in7Days) {
        const sch = schemeMap.get(app.scheme_id);
        generated.push({
          id: `auto-scheme-deadline-${app._id}`,
          type: 'scheme_deadline',
          title: `Scheme deadline approaching: ${sch?.name || app.scheme_id}`,
          message: `Your saved target deadline is ${app.deadline_date}. Complete remaining document checklist items.`,
          severity: 'medium',
          action_url: `/schemes/${app.scheme_id}`,
          created_at: today,
        });
      }
    }
  }

  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  if (!latestTx?.tx_date || latestTx.tx_date < fiveDaysAgo) {
    generated.push({
      id: 'auto-missing-tx',
      type: 'missing_transactions',
      title: 'Keep your daily books up to date',
      message: 'No transactions recorded in the last 5 days. Use Voice Entry to quickly log recent sales or expenses.',
      severity: 'info',
      action_url: '/voice',
      created_at: today,
    });
  }

  const persistedReads = await NotificationRead.find({ user_id: userId }).lean();
  const readMap = new Map(persistedReads.map((r) => [r.notification_id, Boolean(r.is_read)]));

  return generated.map((n) => ({
    ...n,
    is_read: readMap.get(n.id) || false,
  }));
}

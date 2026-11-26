import { db } from '../db.js';
import { computeFinancialSummary } from './accountingEngine.js';
import { computeCashFlowForecast } from './forecastEngine.js';

/**
 * Generates real-time, actionable notifications derived directly from the
 * user's ledger state, forecast warnings, and scheme deadlines, combined with
 * persisted read/dismissed states.
 */
export function getUserNotifications(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const generated = [];
  const summary = computeFinancialSummary(userId);
  const forecast = computeCashFlowForecast(userId, 30);

  // 1. Overdue customer payments
  const overdueSales = db
    .prepare(`
      SELECT t.id, t.item_name, t.due_date, (t.amount - t.paid_amount) AS balance, c.name AS customer_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.user_id = ? AND t.entry_kind = 'sale' AND t.amount > t.paid_amount AND t.due_date IS NOT NULL AND t.due_date < ?
    `)
    .all(userId, today);

  for (const s of overdueSales) {
    generated.push({
      id: `auto-overdue-cust-${s.id}`,
      type: 'overdue_customer',
      title: `Overdue payment from ${s.customer_name || 'Customer'}`,
      message: `₹${Math.round(s.balance).toLocaleString('en-IN')} for "${s.item_name}" was due on ${s.due_date}.`,
      severity: 'high',
      action_url: '/customers',
      created_at: s.due_date,
    });
  }

  // 2. Upcoming supplier payment reminders (due within 7 days or overdue)
  const upcomingBills = db
    .prepare(`
      SELECT t.id, t.item_name, t.due_date, (t.amount - t.paid_amount) AS balance, s.name AS supplier_name
      FROM transactions t
      LEFT JOIN suppliers s ON s.id = t.supplier_id
      WHERE t.user_id = ? AND t.entry_kind = 'expense' AND t.amount > t.paid_amount AND t.due_date IS NOT NULL AND t.due_date <= ?
    `)
    .all(userId, in7Days);

  for (const b of upcomingBills) {
    const isOverdue = b.due_date < today;
    generated.push({
      id: `auto-supplier-bill-${b.id}`,
      type: 'supplier_due',
      title: isOverdue
        ? `Overdue supplier bill: ${b.supplier_name || b.item_name}`
        : `Upcoming supplier bill due ${b.due_date}`,
      message: `₹${Math.round(b.balance).toLocaleString('en-IN')} pending to ${b.supplier_name || 'Supplier'} for "${b.item_name}".`,
      severity: isOverdue ? 'high' : 'medium',
      action_url: '/suppliers',
      created_at: b.due_date,
    });
  }

  // 3. Cash-flow warnings from forecast engine
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

  // 4. Emergency savings goal reminder
  if (summary.emergencyBufferCoveragePct < 50 && summary.availableCash > 0) {
    generated.push({
      id: `auto-savings-goal`,
      type: 'savings_goal',
      title: 'Emergency Reserve below 50% of target',
      message: `Your post-obligation buffer covers ${summary.emergencyBufferCoveragePct}% of your ₹${summary.emergencyReserveGoal.toLocaleString('en-IN')} emergency goal. Review Surplus Allocation.`,
      severity: 'info',
      action_url: '/surplus',
      created_at: today,
    });
  }

  // 5. Scheme application deadline alerts
  const schemeApps = db
    .prepare(`
      SELECT a.id, a.scheme_id, a.deadline_date, s.name AS scheme_name
      FROM scheme_applications a
      JOIN schemes s ON s.id = a.scheme_id
      WHERE a.user_id = ? AND a.deadline_date IS NOT NULL AND a.status IN ('bookmarked', 'preparing')
    `)
    .all(userId);

  for (const app of schemeApps) {
    if (app.deadline_date <= in7Days) {
      generated.push({
        id: `auto-scheme-deadline-${app.id}`,
        type: 'scheme_deadline',
        title: `Scheme deadline approaching: ${app.scheme_name}`,
        message: `Your saved target deadline is ${app.deadline_date}. Complete remaining document checklist items.`,
        severity: 'medium',
        action_url: `/schemes/${app.scheme_id}`,
        created_at: today,
      });
    }
  }

  // 6. Missing recent transaction reminder
  const latestTx = db
    .prepare(`SELECT MAX(tx_date) AS latest FROM transactions WHERE user_id = ?`)
    .get(userId);
  if (!latestTx?.latest || latestTx.latest < new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)) {
    generated.push({
      id: `auto-missing-tx`,
      type: 'missing_transactions',
      title: 'Keep your daily books up to date',
      message: 'No transactions recorded in the last 5 days. Use Voice Entry to quickly log recent sales or expenses.',
      severity: 'info',
      action_url: '/voice',
      created_at: today,
    });
  }

  // Merge with read state stored in notifications table
  const persistedRows = db.prepare(`SELECT id, is_read FROM notifications WHERE user_id = ?`).all(userId);
  const readMap = new Map(persistedRows.map((r) => [r.id, Boolean(r.is_read)]));

  return generated.map((n) => ({
    ...n,
    is_read: readMap.get(n.id) || false,
  }));
}

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { computeFinancialSummary, ENTRY_KINDS } from '../engines/accountingEngine.js';
import { computeCashFlowForecast } from '../engines/forecastEngine.js';
import { computeSurplusRecommendation } from '../engines/surplusEngine.js';
import { evaluateSchemesForUser } from '../engines/schemeEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
    cb(null, `receipt-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();
router.use(requireAuth);

function mapMethodToAccount(method, explicitAccount) {
  if (explicitAccount && ['cash', 'upi', 'bank'].includes(explicitAccount)) return explicitAccount;
  if (method === 'upi') return 'upi';
  if (method === 'bank_transfer') return 'bank';
  return 'cash';
}

function createTransactionRecord(userId, body, source = 'manual') {
  const {
    client_tx_id = null,
    tx_date,
    entry_kind,
    item_name,
    category = 'General',
    quantity = 1,
    unit_price = 0,
    amount,
    payment_method = 'cash',
    account_target,
    transfer_to_account = null,
    customer_id = null,
    supplier_id = null,
    due_date = null,
    paid_amount,
    is_recurring = false,
    recurring_interval = null,
    receipt_path = null,
    notes = '',
  } = body || {};

  if (!ENTRY_KINDS.includes(entry_kind)) {
    throw new Error(`Invalid entry_kind: ${entry_kind}`);
  }
  const numQty = Number(quantity) || 1;
  const numUnitPrice = Number(unit_price) || 0;
  const computedAmount =
    amount !== undefined && amount !== null && Number(amount) > 0
      ? Number(amount)
      : numQty * numUnitPrice;

  if (!computedAmount || computedAmount <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }
  if (!item_name || !String(item_name).trim()) {
    throw new Error('Item or description is required.');
  }

  const safeDate = tx_date || new Date().toISOString().slice(0, 10);
  const safeMethod = ['cash', 'upi', 'bank_transfer', 'credit'].includes(payment_method)
    ? payment_method
    : 'cash';

  const actualPaid =
    safeMethod === 'credit'
      ? Math.min(computedAmount, Math.max(0, Number(paid_amount) || 0))
      : computedAmount;

  const settlementStatus =
    actualPaid >= computedAmount ? 'paid' : actualPaid > 0 ? 'partial' : 'unpaid';

  const id = uuidv4();
  const acc = mapMethodToAccount(safeMethod, account_target);

  db.prepare(`
    INSERT INTO transactions (
      id, user_id, client_tx_id, tx_date, entry_kind, item_name, category,
      quantity, unit_price, amount, payment_method, account_target, transfer_to_account,
      customer_id, supplier_id, due_date, paid_amount, settlement_status,
      is_recurring, recurring_interval, receipt_path, notes, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    client_tx_id,
    safeDate,
    entry_kind,
    String(item_name).trim(),
    category,
    numQty,
    numUnitPrice > 0 ? numUnitPrice : Math.round((computedAmount / numQty) * 100) / 100,
    Math.round(computedAmount * 100) / 100,
    safeMethod,
    acc,
    entry_kind === 'account_transfer' ? transfer_to_account || 'bank' : null,
    customer_id || null,
    supplier_id || null,
    due_date || null,
    Math.round(actualPaid * 100) / 100,
    settlementStatus,
    is_recurring ? 1 : 0,
    is_recurring ? recurring_interval || 'monthly' : null,
    receipt_path,
    notes || '',
    source
  );

  return db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
}

router.get('/summary', (req, res) => {
  const { startDate = null, endDate = null } = req.query;
  const summary = computeFinancialSummary(req.user.id, { startDate, endDate });
  return res.json(summary);
});

router.get('/transactions', (req, res) => {
  const { entry_kind, category, startDate, endDate, payment_method, search } = req.query;
  let sql = `
    SELECT t.*, c.name AS customer_name, s.name AS supplier_name
    FROM transactions t
    LEFT JOIN customers c ON c.id = t.customer_id
    LEFT JOIN suppliers s ON s.id = t.supplier_id
    WHERE t.user_id = ?
  `;
  const params = [req.user.id];

  if (entry_kind && entry_kind !== 'all') {
    sql += ` AND t.entry_kind = ?`;
    params.push(entry_kind);
  }
  if (category && category !== 'all') {
    sql += ` AND t.category = ?`;
    params.push(category);
  }
  if (payment_method && payment_method !== 'all') {
    sql += ` AND t.payment_method = ?`;
    params.push(payment_method);
  }
  if (startDate) {
    sql += ` AND t.tx_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND t.tx_date <= ?`;
    params.push(endDate);
  }
  if (search) {
    sql += ` AND (t.item_name LIKE ? OR t.category LIKE ? OR t.notes LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ` ORDER BY t.tx_date DESC, t.created_at DESC`;
  const rows = db.prepare(sql).all(...params);
  return res.json({ transactions: rows });
});

router.post('/transactions', (req, res) => {
  try {
    const created = createTransactionRecord(req.user.id, req.body, req.body?.source || 'manual');
    return res.status(201).json({ transaction: created });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/transactions/receipt', upload.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No receipt file uploaded.' });
  }
  return res.json({ receipt_path: `/uploads/${req.file.filename}` });
});

router.delete('/transactions/:id', (req, res) => {
  const result = db
    .prepare(`DELETE FROM transactions WHERE id = ? AND user_id = ?`)
    .run(req.params.id, req.user.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }
  return res.json({ deleted: true });
});

// Offline-first synchronization with duplicate prevention & conflict detection
router.post('/transactions/sync', (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const synced = [];
  const skippedDuplicates = [];
  const conflicts = [];

  for (const item of items) {
    if (!item.client_tx_id) {
      conflicts.push({ item, reason: 'Missing client_tx_id for safe offline idempotency.' });
      continue;
    }

    const existing = db
      .prepare(`SELECT * FROM transactions WHERE user_id = ? AND client_tx_id = ?`)
      .get(req.user.id, item.client_tx_id);

    if (existing) {
      if (
        Number(existing.amount) === Number(item.amount) &&
        existing.item_name === item.item_name &&
        existing.tx_date === item.tx_date
      ) {
        skippedDuplicates.push({ client_tx_id: item.client_tx_id, server_id: existing.id });
      } else {
        conflicts.push({
          client_tx_id: item.client_tx_id,
          reason: 'A record with this offline ID already exists with different values. Kept server record without overwriting.',
          serverRecord: existing,
          clientRecord: item,
        });
      }
      continue;
    }

    try {
      const created = createTransactionRecord(req.user.id, item, 'offline_sync');
      synced.push(created);
    } catch (err) {
      conflicts.push({ client_tx_id: item.client_tx_id, reason: err.message });
    }
  }

  return res.json({
    syncedCount: synced.length,
    duplicateCount: skippedDuplicates.length,
    conflictCount: conflicts.length,
    synced,
    skippedDuplicates,
    conflicts,
  });
});

// Customers & Credit Receivables
router.get('/customers', (req, res) => {
  const customers = db
    .prepare(`SELECT * FROM customers WHERE user_id = ? ORDER BY name ASC`)
    .all(req.user.id);

  const creditSales = db
    .prepare(`
      SELECT * FROM transactions
      WHERE user_id = ? AND entry_kind = 'sale' AND (payment_method = 'credit' OR amount > paid_amount)
      ORDER BY tx_date DESC
    `)
    .all(req.user.id);

  const payments = db
    .prepare(`SELECT * FROM settlement_payments WHERE user_id = ? AND party_type = 'customer' ORDER BY payment_date DESC`)
    .all(req.user.id);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = customers.map((c) => {
    const bills = creditSales.filter((s) => s.customer_id === c.id);
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPaid = bills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const overdueAmount = bills
      .filter((b) => b.amount > b.paid_amount && b.due_date && b.due_date < today)
      .reduce((sum, b) => sum + (Number(b.amount) - Number(b.paid_amount)), 0);

    return {
      ...c,
      totalBilled,
      totalPaid,
      outstanding,
      overdueAmount,
      openBills: bills.filter((b) => b.amount > b.paid_amount),
      paymentHistory: payments.filter((p) => p.party_id === c.id),
    };
  });

  // Also include walk-in credit sales without linked customer_id
  const unlinkedBills = creditSales.filter((s) => !s.customer_id && s.amount > s.paid_amount);

  return res.json({ customers: enriched, unlinkedBills });
});

router.post('/customers', (req, res) => {
  const { name, phone = '', notes = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO customers (id, user_id, name, phone, notes) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    req.user.id,
    name.trim(),
    phone.trim(),
    notes.trim()
  );
  return res.status(201).json({ customer: db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) });
});

// Suppliers & Unpaid Bills
router.get('/suppliers', (req, res) => {
  const suppliers = db
    .prepare(`SELECT * FROM suppliers WHERE user_id = ? ORDER BY name ASC`)
    .all(req.user.id);

  const bills = db
    .prepare(`
      SELECT * FROM transactions
      WHERE user_id = ? AND entry_kind = 'expense' AND (payment_method = 'credit' OR amount > paid_amount)
      ORDER BY tx_date DESC
    `)
    .all(req.user.id);

  const payments = db
    .prepare(`SELECT * FROM settlement_payments WHERE user_id = ? AND party_type = 'supplier' ORDER BY payment_date DESC`)
    .all(req.user.id);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = suppliers.map((s) => {
    const supBills = bills.filter((b) => b.supplier_id === s.id);
    const totalBilled = supBills.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPaid = supBills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const overdueAmount = supBills
      .filter((b) => b.amount > b.paid_amount && b.due_date && b.due_date < today)
      .reduce((sum, b) => sum + (Number(b.amount) - Number(b.paid_amount)), 0);

    return {
      ...s,
      totalBilled,
      totalPaid,
      outstanding,
      overdueAmount,
      openBills: supBills.filter((b) => b.amount > b.paid_amount),
      paymentHistory: payments.filter((p) => p.party_id === s.id),
    };
  });

  const unlinkedBills = bills.filter((b) => !b.supplier_id && b.amount > b.paid_amount);

  return res.json({ suppliers: enriched, unlinkedBills });
});

router.post('/suppliers', (req, res) => {
  const { name, phone = '', category = 'Raw materials', notes = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO suppliers (id, user_id, name, phone, category, notes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, name.trim(), phone.trim(), category, notes.trim());
  return res.status(201).json({ supplier: db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) });
});

// Record partial or full settlement against a credit sale or unpaid supplier bill
router.post('/transactions/:id/settle', (req, res) => {
  const tx = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user.id);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  const remaining = Math.max(0, Number(tx.amount) - Number(tx.paid_amount));
  const payAmount = Number(req.body?.amount) || 0;
  if (payAmount <= 0 || payAmount > remaining + 0.01) {
    return res.status(400).json({ error: `Payment amount must be between ₹1 and ₹${remaining}.` });
  }

  const newPaid = Math.min(Number(tx.amount), Number(tx.paid_amount) + payAmount);
  const newStatus = newPaid >= Number(tx.amount) ? 'paid' : 'partial';
  const method = req.body?.payment_method || 'cash';
  const payDate = req.body?.payment_date || new Date().toISOString().slice(0, 10);

  db.prepare(`
    UPDATE transactions SET paid_amount = ?, settlement_status = ?, account_target = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(newPaid, newStatus, mapMethodToAccount(method), tx.id, req.user.id);

  db.prepare(`
    INSERT INTO settlement_payments (id, user_id, transaction_id, party_type, party_id, amount, payment_method, payment_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    req.user.id,
    tx.id,
    tx.entry_kind === 'sale' ? 'customer' : 'supplier',
    tx.entry_kind === 'sale' ? tx.customer_id : tx.supplier_id,
    payAmount,
    method,
    payDate,
    req.body?.notes || ''
  );

  return res.json({ updated: db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(tx.id) });
});

// Cash-Flow Forecasting
router.get('/forecast', (req, res) => {
  const days = Number(req.query.days) || 30;
  return res.json(computeCashFlowForecast(req.user.id, days));
});

// Surplus Allocation Planner
router.get('/surplus', (req, res) => {
  return res.json(computeSurplusRecommendation(req.user.id));
});

router.put('/surplus', (req, res) => {
  const {
    upcoming_obligations = 0,
    emergency_reserves = 0,
    business_reinvestment = 0,
    personal_savings = 0,
    flexible_spending = 0,
    notes = '',
  } = req.body || {};

  db.prepare(`
    INSERT INTO surplus_allocations (
      user_id, upcoming_obligations, emergency_reserves, business_reinvestment,
      personal_savings, flexible_spending, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      upcoming_obligations = excluded.upcoming_obligations,
      emergency_reserves = excluded.emergency_reserves,
      business_reinvestment = excluded.business_reinvestment,
      personal_savings = excluded.personal_savings,
      flexible_spending = excluded.flexible_spending,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    req.user.id,
    Number(upcoming_obligations) || 0,
    Number(emergency_reserves) || 0,
    Number(business_reinvestment) || 0,
    Number(personal_savings) || 0,
    Number(flexible_spending) || 0,
    notes
  );

  return res.json(computeSurplusRecommendation(req.user.id));
});

// Business Pricing Calculator
router.get('/pricing', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM pricing_calculations WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user.id);
  return res.json({ calculations: rows });
});

router.post('/pricing', (req, res) => {
  const {
    product_name,
    batch_units = 1,
    raw_materials = 0,
    labour = 0,
    packaging = 0,
    transportation = 0,
    other_costs = 0,
    desired_selling_price = 0,
  } = req.body || {};

  if (!product_name || Number(batch_units) <= 0) {
    return res.status(400).json({ error: 'Product name and batch units (>0) are required.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO pricing_calculations (
      id, user_id, product_name, batch_units, raw_materials, labour, packaging, transportation, other_costs, desired_selling_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user.id,
    product_name.trim(),
    Number(batch_units),
    Number(raw_materials) || 0,
    Number(labour) || 0,
    Number(packaging) || 0,
    Number(transportation) || 0,
    Number(other_costs) || 0,
    Number(desired_selling_price) || 0
  );

  return res.status(201).json({ calculation: db.prepare(`SELECT * FROM pricing_calculations WHERE id = ?`).get(id) });
});

// Business Financial Readiness Report
router.get('/readiness-report', (req, res) => {
  const user = db.prepare(`SELECT id, name, mobile, email, location FROM users WHERE id = ?`).get(req.user.id);
  const profile = db.prepare(`SELECT * FROM business_profiles WHERE user_id = ?`).get(req.user.id) || {};
  const summary = computeFinancialSummary(req.user.id);
  const forecast = computeCashFlowForecast(req.user.id, 30);
  const matchedSchemes = evaluateSchemesForUser(req.user.id).filter(
    (s) => s.evaluation.outcome !== 'Currently ineligible'
  );

  const missingInformation = [];
  if (!profile.business_name) missingInformation.push('Business name is missing.');
  if (profile.udyam_status !== 'registered') missingInformation.push('Udyam registration number/status not yet completed.');
  if (summary.transactionCount < 10) missingInformation.push('Fewer than 10 recorded transactions; lenders typically review 3–6 months of regular cashbook history.');
  if (!profile.funding_requirement) missingInformation.push('Target funding requirement amount not specified.');
  if (!profile.growth_goals) missingInformation.push('Business expansion objective not filled in.');

  return res.json({
    generatedAt: new Date().toISOString(),
    user,
    businessProfile: profile,
    financialSummary: summary,
    cashFlowProjection30d: forecast.summary,
    relevantSchemes: matchedSchemes.map((s) => ({
      id: s.id,
      name: s.name,
      assistance_type: s.assistance_type,
      outcome: s.evaluation.outcome,
      financial_benefit: s.financial_benefit,
    })),
    missingInformation,
    disclaimer:
      'This Financial Readiness Report organizes your self-reported and bookkeeping records to prepare for lender or scheme discussions. It is NOT an official credit score, credit bureau report, or loan approval guarantee.',
  });
});

export default router;

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import {
  BusinessProfile,
  Customer,
  PricingCalculation,
  SettlementPayment,
  Supplier,
  SurplusAllocation,
  Transaction,
  User,
} from '../../database/models/index.js';
import { requireAuth } from '../middleware/auth.js';
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

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();
router.use(requireAuth);

function mapMethodToAccount(method, explicitAccount) {
  if (explicitAccount && ['cash', 'upi', 'bank'].includes(explicitAccount)) return explicitAccount;
  if (method === 'upi') return 'upi';
  if (method === 'bank_transfer') return 'bank';
  return 'cash';
}

async function createTransactionRecord(userId, body, source = 'manual') {
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

  const created = await Transaction.create({
    _id: id,
    user_id: userId,
    client_tx_id: client_tx_id || null,
    tx_date: safeDate,
    entry_kind,
    item_name: String(item_name).trim(),
    category,
    quantity: numQty,
    unit_price: numUnitPrice > 0 ? numUnitPrice : Math.round((computedAmount / numQty) * 100) / 100,
    amount: Math.round(computedAmount * 100) / 100,
    payment_method: safeMethod,
    account_target: acc,
    transfer_to_account: entry_kind === 'account_transfer' ? transfer_to_account || 'bank' : null,
    customer_id: customer_id || null,
    supplier_id: supplier_id || null,
    due_date: due_date || null,
    paid_amount: Math.round(actualPaid * 100) / 100,
    settlement_status: settlementStatus,
    is_recurring: is_recurring ? 1 : 0,
    recurring_interval: is_recurring ? recurring_interval || 'monthly' : null,
    receipt_path,
    notes: notes || '',
    source,
  });

  return created.toJSON();
}

router.get('/summary', async (req, res) => {
  const { startDate = null, endDate = null } = req.query;
  const summary = await computeFinancialSummary(req.user.id, { startDate, endDate });
  return res.json(summary);
});

router.get('/transactions', async (req, res) => {
  const { entry_kind, category, startDate, endDate, payment_method, search } = req.query;
  const filter = { user_id: req.user.id };

  if (entry_kind && entry_kind !== 'all') filter.entry_kind = entry_kind;
  if (category && category !== 'all') filter.category = category;
  if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;
  if (startDate || endDate) {
    filter.tx_date = {};
    if (startDate) filter.tx_date.$gte = startDate;
    if (endDate) filter.tx_date.$lte = endDate;
  }
  if (search) {
    const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ item_name: regex }, { category: regex }, { notes: regex }];
  }

  const [rows, customers, suppliers] = await Promise.all([
    Transaction.find(filter).sort({ tx_date: -1, created_at: -1 }).lean(),
    Customer.find({ user_id: req.user.id }).lean(),
    Supplier.find({ user_id: req.user.id }).lean(),
  ]);

  const custMap = new Map(customers.map((c) => [c._id, c.name]));
  const supMap = new Map(suppliers.map((s) => [s._id, s.name]));

  const transactions = rows.map((r) => ({
    ...r,
    id: r._id,
    customer_name: r.customer_id ? custMap.get(r.customer_id) || null : null,
    supplier_name: r.supplier_id ? supMap.get(r.supplier_id) || null : null,
  }));

  return res.json({ transactions });
});

router.post('/transactions', async (req, res) => {
  try {
    const created = await createTransactionRecord(req.user.id, req.body, req.body?.source || 'manual');
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

router.delete('/transactions/:id', async (req, res) => {
  const result = await Transaction.deleteOne({ _id: req.params.id, user_id: req.user.id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }
  return res.json({ deleted: true });
});

router.post('/transactions/sync', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const synced = [];
  const skippedDuplicates = [];
  const conflicts = [];

  for (const item of items) {
    if (!item.client_tx_id) {
      conflicts.push({ item, reason: 'Missing client_tx_id for safe offline idempotency.' });
      continue;
    }

    const existing = await Transaction.findOne({
      user_id: req.user.id,
      client_tx_id: item.client_tx_id,
    }).lean();

    if (existing) {
      if (
        Number(existing.amount) === Number(item.amount) &&
        existing.item_name === item.item_name &&
        existing.tx_date === item.tx_date
      ) {
        skippedDuplicates.push({ client_tx_id: item.client_tx_id, server_id: existing._id });
      } else {
        conflicts.push({
          client_tx_id: item.client_tx_id,
          reason:
            'A record with this offline ID already exists with different values. Kept server record without overwriting.',
          serverRecord: { ...existing, id: existing._id },
          clientRecord: item,
        });
      }
      continue;
    }

    try {
      const created = await createTransactionRecord(req.user.id, item, 'offline_sync');
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

router.get('/customers', async (req, res) => {
  const [customers, creditSales, payments] = await Promise.all([
    Customer.find({ user_id: req.user.id }).sort({ name: 1 }).lean(),
    Transaction.find({
      user_id: req.user.id,
      entry_kind: 'sale',
      $or: [{ payment_method: 'credit' }, { $expr: { $gt: ['$amount', '$paid_amount'] } }],
    })
      .sort({ tx_date: -1 })
      .lean(),
    SettlementPayment.find({ user_id: req.user.id, party_type: 'customer' })
      .sort({ payment_date: -1 })
      .lean(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = customers.map((c) => {
    const bills = creditSales
      .filter((s) => s.customer_id === c._id)
      .map((b) => ({ ...b, id: b._id }));
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPaid = bills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const overdueAmount = bills
      .filter((b) => b.amount > b.paid_amount && b.due_date && b.due_date < today)
      .reduce((sum, b) => sum + (Number(b.amount) - Number(b.paid_amount)), 0);

    return {
      ...c,
      id: c._id,
      totalBilled,
      totalPaid,
      outstanding,
      overdueAmount,
      openBills: bills.filter((b) => b.amount > b.paid_amount),
      paymentHistory: payments.filter((p) => p.party_id === c._id).map((p) => ({ ...p, id: p._id })),
    };
  });

  const unlinkedBills = creditSales
    .filter((s) => !s.customer_id && s.amount > s.paid_amount)
    .map((b) => ({ ...b, id: b._id }));

  return res.json({ customers: enriched, unlinkedBills });
});

router.post('/customers', async (req, res) => {
  const { name, phone = '', notes = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }
  const customer = await Customer.create({
    _id: uuidv4(),
    user_id: req.user.id,
    name: name.trim(),
    phone: phone.trim(),
    notes: notes.trim(),
  });
  return res.status(201).json({ customer: customer.toJSON() });
});

router.get('/suppliers', async (req, res) => {
  const [suppliers, bills, payments] = await Promise.all([
    Supplier.find({ user_id: req.user.id }).sort({ name: 1 }).lean(),
    Transaction.find({
      user_id: req.user.id,
      entry_kind: 'expense',
      $or: [{ payment_method: 'credit' }, { $expr: { $gt: ['$amount', '$paid_amount'] } }],
    })
      .sort({ tx_date: -1 })
      .lean(),
    SettlementPayment.find({ user_id: req.user.id, party_type: 'supplier' })
      .sort({ payment_date: -1 })
      .lean(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = suppliers.map((s) => {
    const supBills = bills
      .filter((b) => b.supplier_id === s._id)
      .map((b) => ({ ...b, id: b._id }));
    const totalBilled = supBills.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPaid = supBills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const overdueAmount = supBills
      .filter((b) => b.amount > b.paid_amount && b.due_date && b.due_date < today)
      .reduce((sum, b) => sum + (Number(b.amount) - Number(b.paid_amount)), 0);

    return {
      ...s,
      id: s._id,
      totalBilled,
      totalPaid,
      outstanding,
      overdueAmount,
      openBills: supBills.filter((b) => b.amount > b.paid_amount),
      paymentHistory: payments.filter((p) => p.party_id === s._id).map((p) => ({ ...p, id: p._id })),
    };
  });

  const unlinkedBills = bills
    .filter((b) => !b.supplier_id && b.amount > b.paid_amount)
    .map((b) => ({ ...b, id: b._id }));

  return res.json({ suppliers: enriched, unlinkedBills });
});

router.post('/suppliers', async (req, res) => {
  const { name, phone = '', category = 'Raw materials', notes = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }
  const supplier = await Supplier.create({
    _id: uuidv4(),
    user_id: req.user.id,
    name: name.trim(),
    phone: phone.trim(),
    category,
    notes: notes.trim(),
  });
  return res.status(201).json({ supplier: supplier.toJSON() });
});

router.post('/transactions/:id/settle', async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user_id: req.user.id });
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

  tx.paid_amount = newPaid;
  tx.settlement_status = newStatus;
  tx.account_target = mapMethodToAccount(method);
  await tx.save();

  await SettlementPayment.create({
    _id: uuidv4(),
    user_id: req.user.id,
    transaction_id: tx._id,
    party_type: tx.entry_kind === 'sale' ? 'customer' : 'supplier',
    party_id: tx.entry_kind === 'sale' ? tx.customer_id : tx.supplier_id,
    amount: payAmount,
    payment_method: method,
    payment_date: payDate,
    notes: req.body?.notes || '',
  });

  return res.json({ updated: tx.toJSON() });
});

router.get('/forecast', async (req, res) => {
  const days = Number(req.query.days) || 30;
  return res.json(await computeCashFlowForecast(req.user.id, days));
});

router.get('/surplus', async (req, res) => {
  return res.json(await computeSurplusRecommendation(req.user.id));
});

router.put('/surplus', async (req, res) => {
  const {
    upcoming_obligations = 0,
    emergency_reserves = 0,
    business_reinvestment = 0,
    personal_savings = 0,
    flexible_spending = 0,
    notes = '',
  } = req.body || {};

  await SurplusAllocation.findOneAndUpdate(
    { user_id: req.user.id },
    {
      $set: {
        _id: req.user.id,
        user_id: req.user.id,
        upcoming_obligations: Number(upcoming_obligations) || 0,
        emergency_reserves: Number(emergency_reserves) || 0,
        business_reinvestment: Number(business_reinvestment) || 0,
        personal_savings: Number(personal_savings) || 0,
        flexible_spending: Number(flexible_spending) || 0,
        notes,
      },
    },
    { upsert: true }
  );

  return res.json(await computeSurplusRecommendation(req.user.id));
});

router.get('/pricing', async (req, res) => {
  const rows = await PricingCalculation.find({ user_id: req.user.id })
    .sort({ created_at: -1 })
    .lean();
  return res.json({ calculations: rows.map((r) => ({ ...r, id: r._id })) });
});

router.post('/pricing', async (req, res) => {
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

  const calculation = await PricingCalculation.create({
    _id: uuidv4(),
    user_id: req.user.id,
    product_name: product_name.trim(),
    batch_units: Number(batch_units),
    raw_materials: Number(raw_materials) || 0,
    labour: Number(labour) || 0,
    packaging: Number(packaging) || 0,
    transportation: Number(transportation) || 0,
    other_costs: Number(other_costs) || 0,
    desired_selling_price: Number(desired_selling_price) || 0,
  });

  return res.status(201).json({ calculation: calculation.toJSON() });
});

router.get('/readiness-report', async (req, res) => {
  const [user, profile, summary, forecast, allMatched] = await Promise.all([
    User.findById(req.user.id).select('name mobile email location').lean(),
    BusinessProfile.findOne({ user_id: req.user.id }).lean(),
    computeFinancialSummary(req.user.id),
    computeCashFlowForecast(req.user.id, 30),
    evaluateSchemesForUser(req.user.id),
  ]);

  const bp = profile || {};
  const matchedSchemes = allMatched.filter((s) => s.evaluation.outcome !== 'Currently ineligible');

  const missingInformation = [];
  if (!bp.business_name) missingInformation.push('Business name is missing.');
  if (bp.udyam_status !== 'registered') {
    missingInformation.push('Udyam registration number/status not yet completed.');
  }
  if (summary.transactionCount < 10) {
    missingInformation.push(
      'Fewer than 10 recorded transactions; lenders typically review 3–6 months of regular cashbook history.'
    );
  }
  if (!bp.funding_requirement) missingInformation.push('Target funding requirement amount not specified.');
  if (!bp.growth_goals) missingInformation.push('Business expansion objective not filled in.');

  return res.json({
    generatedAt: new Date().toISOString(),
    user: user ? { ...user, id: user._id } : null,
    businessProfile: bp,
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

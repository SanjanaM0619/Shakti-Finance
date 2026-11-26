import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import { hashPassword } from './auth.js';

function daysAgoIso(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function daysFromNowIso(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export const DEMO_MOBILE = '9845012345';

export function seedDemoAccount() {
  const existing = db.prepare('SELECT id FROM users WHERE mobile = ?').get(DEMO_MOBILE);
  if (existing) {
    return existing.id;
  }

  const userId = 'demo-kavya-gruha-udyog';
  const passwordHash = hashPassword('shakti123');

  db.prepare(`
    INSERT INTO users (
      id, name, mobile, email, password_hash, preferred_language, location,
      consent_privacy, consent_notifications, consent_scheme_matching, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1)
  `).run(
    userId,
    'Kavya Gowda',
    DEMO_MOBILE,
    'kavya.gruhaudyog@example.in',
    passwordHash,
    'en',
    'Channapatna, Ramanagara, Karnataka'
  );

  db.prepare(`
    INSERT INTO business_profiles (
      user_id, business_name, category, description, location, state, area_type,
      established_date, enterprise_stage, ownership_type, approx_monthly_revenue,
      approx_monthly_expenses, employees_count, registration_status, gst_status,
      udyam_status, funding_requirement, growth_goals, existing_loan_balance,
      monthly_loan_emi, planned_household_withdrawal, emergency_reserve_goal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    'Kavya Gruha Udyog & Millet Snacks',
    'Food Processing',
    'Home-based millet snacks, chakli, spice powders, and traditional pickles sold to local bakeries, kirana stores, and weekend markets.',
    'Channapatna, Ramanagara',
    'Karnataka',
    'rural',
    '2023-06-15',
    'existing',
    'individual',
    42000,
    24500,
    2,
    'udyam_registered',
    'not_registered',
    'registered',
    180000,
    'Purchase an automatic pulverizer & sealing machine to supply 15 more kirana stores across Ramanagara.',
    22000,
    2500,
    4500,
    20000
  );

  db.prepare(`
    INSERT INTO scheme_eligibility_extra (
      user_id, social_category, annual_family_income, education_level, shg_member, bank_account_linked
    ) VALUES (?, 'obc', 165000, 'PUC / 12th Pass', 1, 1)
  `).run(userId);

  const customers = [
    { id: 'cust-lakshmi-store', name: 'Lakshmi Provision Store', phone: '9880112233', notes: 'Weekly snacks & masala buyer' },
    { id: 'cust-annapurna-bakery', name: 'Annapurna Bakery', phone: '9900445566', notes: 'Bulk chakli & nippat orders' },
    { id: 'cust-shanti-catering', name: 'Shanti Gruha Catering', phone: '9740223344', notes: 'Event spice packets' },
  ];

  const insertCustomer = db.prepare('INSERT INTO customers (id, user_id, name, phone, notes) VALUES (?, ?, ?, ?, ?)');
  for (const c of customers) {
    insertCustomer.run(c.id, userId, c.name, c.phone, c.notes);
  }

  const suppliers = [
    { id: 'sup-kaveri-grains', name: 'Kaveri Wholesale Grains', phone: '9844556677', category: 'Raw materials', notes: 'Ragi, rice flour, groundnuts' },
    { id: 'sup-nandi-pack', name: 'Nandi Packaging Traders', phone: '9611223344', category: 'Packaging', notes: 'Food-grade pouches & labels' },
    { id: 'sup-mahalakshmi-oil', name: 'Mahalakshmi Oil Mill', phone: '9448112299', category: 'Raw materials', notes: 'Cold-pressed groundnut oil' },
  ];

  const insertSupplier = db.prepare('INSERT INTO suppliers (id, user_id, name, phone, category, notes) VALUES (?, ?, ?, ?, ?, ?)');
  for (const s of suppliers) {
    insertSupplier.run(s.id, userId, s.name, s.phone, s.category, s.notes);
  }

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, user_id, client_tx_id, tx_date, entry_kind, item_name, category,
      quantity, unit_price, amount, payment_method, account_target, transfer_to_account,
      customer_id, supplier_id, due_date, paid_amount, settlement_status,
      is_recurring, recurring_interval, notes, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')
  `);

  // Opening capital contribution so cash balance is realistic
  insertTx.run(
    uuidv4(), userId, 'seed-cap-1', daysAgoIso(92), 'capital_contribution',
    'Opening Business Cash & Bank Reserve', 'Capital', 1, 14000, 14000,
    'bank_transfer', 'bank', null, null, null, null, 14000, 'paid', 0, null,
    'Initial separated business reserve'
  );

  // Build 90 days of realistic operational history for strong forecasting & analytics
  const sampleHistory = [
    // Month -3 (85 to 61 days ago)
    { days: 86, kind: 'sale', item: 'Millet Chakli Packs', cat: 'Snacks', qty: 45, price: 80, method: 'cash', acc: 'cash' },
    { days: 84, kind: 'expense', item: 'Ragi & Besan Flour Bulk', cat: 'Raw materials', qty: 1, price: 3200, method: 'upi', acc: 'upi', sup: 'sup-kaveri-grains' },
    { days: 81, kind: 'sale', item: 'Sambar & Rasam Powder', cat: 'Spices', qty: 30, price: 110, method: 'upi', acc: 'upi' },
    { days: 78, kind: 'expense', item: 'Food-grade Pouches', cat: 'Packaging', qty: 1, price: 950, method: 'upi', acc: 'upi', sup: 'sup-nandi-pack' },
    { days: 75, kind: 'sale', item: 'Weekend Market Retail Sales', cat: 'Snacks', qty: 60, price: 75, method: 'cash', acc: 'cash' },
    { days: 72, kind: 'household_withdrawal', item: 'Family Grocery & School Fee', cat: 'Household', qty: 1, price: 2800, method: 'cash', acc: 'cash' },
    { days: 70, kind: 'expense', item: 'Local Delivery Auto', cat: 'Transportation', qty: 1, price: 450, method: 'cash', acc: 'cash' },
    { days: 68, kind: 'sale', item: 'Bulk Nippat Order - Annapurna', cat: 'Snacks', qty: 55, price: 85, method: 'bank_transfer', acc: 'bank', cust: 'cust-annapurna-bakery' },
    { days: 65, kind: 'expense', item: 'Electricity Bill (Workshop)', cat: 'Electricity', qty: 1, price: 680, method: 'upi', acc: 'upi', rec: 1, int: 'monthly' },
    { days: 63, kind: 'expense', item: 'Helper Wages', cat: 'Labour', qty: 1, price: 2200, method: 'cash', acc: 'cash', rec: 1, int: 'monthly' },

    // Month -2 (60 to 31 days ago)
    { days: 58, kind: 'sale', item: 'Millet Mixture & Chakli', cat: 'Snacks', qty: 70, price: 85, method: 'upi', acc: 'upi' },
    { days: 55, kind: 'expense', item: 'Groundnut Oil 25L Tin', cat: 'Raw materials', qty: 1, price: 4100, method: 'bank_transfer', acc: 'bank', sup: 'sup-mahalakshmi-oil' },
    { days: 52, kind: 'sale', item: 'Mango & Lemon Pickle Jars', cat: 'Pickles', qty: 40, price: 140, method: 'cash', acc: 'cash' },
    { days: 49, kind: 'expense', item: 'Spices & Curry Leaves', cat: 'Raw materials', qty: 1, price: 2150, method: 'cash', acc: 'cash' },
    { days: 46, kind: 'sale', item: 'Lakshmi Store Supply', cat: 'Spices', qty: 45, price: 110, method: 'upi', acc: 'upi', cust: 'cust-lakshmi-store' },
    { days: 43, kind: 'loan_repayment', item: 'SHG Micro-Loan Monthly EMI', cat: 'Loan Repayment', qty: 1, price: 2500, method: 'bank_transfer', acc: 'bank', rec: 1, int: 'monthly' },
    { days: 41, kind: 'household_withdrawal', item: 'Medical & Home Expenses', cat: 'Household', qty: 1, price: 3200, method: 'upi', acc: 'upi' },
    { days: 38, kind: 'sale', item: 'Festival Gift Hampers', cat: 'Snacks', qty: 35, price: 220, method: 'upi', acc: 'upi' },
    { days: 35, kind: 'expense', item: 'Electricity Bill (Workshop)', cat: 'Electricity', qty: 1, price: 720, method: 'upi', acc: 'upi', rec: 1, int: 'monthly' },
    { days: 33, kind: 'expense', item: 'Helper Wages', cat: 'Labour', qty: 1, price: 2400, method: 'cash', acc: 'cash', rec: 1, int: 'monthly' },

    // Month -1 / Current Month (30 to 1 days ago)
    { days: 28, kind: 'sale', item: 'Millet Chakli & Kodubale', cat: 'Snacks', qty: 65, price: 90, method: 'upi', acc: 'upi' },
    { days: 25, kind: 'expense', item: 'Millet & Pulse Stock', cat: 'Raw materials', qty: 1, price: 3900, method: 'upi', acc: 'upi', sup: 'sup-kaveri-grains' },
    { days: 22, kind: 'sale', item: 'Shanti Catering Spice Supply', cat: 'Spices', qty: 50, price: 120, method: 'cash', acc: 'cash', cust: 'cust-shanti-catering' },
    { days: 19, kind: 'expense', item: 'Printed Labels & Stickers', cat: 'Packaging', qty: 1, price: 1350, method: 'upi', acc: 'upi', sup: 'sup-nandi-pack' },
    { days: 16, kind: 'sale', item: 'Annapurna Bakery Credit Order', cat: 'Snacks', qty: 60, price: 90, method: 'credit', acc: 'bank', cust: 'cust-annapurna-bakery', due: daysAgoIso(2), paid: 2000, status: 'partial' },
    { days: 14, kind: 'expense', item: 'Gas Cylinders & Frying Fuel', cat: 'Raw materials', qty: 2, price: 920, method: 'cash', acc: 'cash' },
    { days: 12, kind: 'loan_repayment', item: 'SHG Micro-Loan Monthly EMI', cat: 'Loan Repayment', qty: 1, price: 2500, method: 'bank_transfer', acc: 'bank', rec: 1, int: 'monthly' },
    { days: 10, kind: 'sale', item: 'Lakshmi Store Credit Order', cat: 'Pickles', qty: 30, price: 150, method: 'credit', acc: 'upi', cust: 'cust-lakshmi-store', due: daysFromNowIso(5), paid: 0, status: 'unpaid' },
    { days: 8, kind: 'expense', item: 'Cold-pressed Oil (Unpaid Bill)', cat: 'Raw materials', qty: 1, price: 4600, method: 'credit', acc: 'bank', sup: 'sup-mahalakshmi-oil', due: daysFromNowIso(6), paid: 1000, status: 'partial' },
    { days: 6, kind: 'household_withdrawal', item: 'Household Groceries & Electricity', cat: 'Household', qty: 1, price: 3000, method: 'cash', acc: 'cash' },
    { days: 5, kind: 'sale', item: 'Sunday Farmers Market Stall', cat: 'Snacks', qty: 52, price: 95, method: 'cash', acc: 'cash' },
    { days: 4, kind: 'expense', item: 'Electricity Bill (Workshop)', cat: 'Electricity', qty: 1, price: 790, method: 'upi', acc: 'upi', rec: 1, int: 'monthly' },
    { days: 3, kind: 'expense', item: 'Helper Wages', cat: 'Labour', qty: 1, price: 2500, method: 'cash', acc: 'cash', rec: 1, int: 'monthly' },
    { days: 2, kind: 'expense', item: 'Delivery Tempo & Cartons', cat: 'Transportation', qty: 1, price: 650, method: 'cash', acc: 'cash' },
    { days: 1, kind: 'sale', item: 'Direct WhatsApp UPI Orders', cat: 'Spices', qty: 28, price: 125, method: 'upi', acc: 'upi' },
  ];

  for (let i = 0; i < sampleHistory.length; i++) {
    const h = sampleHistory[i];
    const amount = Number((h.qty * h.price).toFixed(2));
    const isCredit = h.method === 'credit';
    const paidAmount = isCredit ? (h.paid ?? 0) : amount;
    const status = isCredit ? (h.status ?? 'unpaid') : 'paid';

    insertTx.run(
      uuidv4(),
      userId,
      `seed-tx-${i}`,
      daysAgoIso(h.days),
      h.kind,
      h.item,
      h.cat,
      h.qty,
      h.price,
      amount,
      h.method,
      h.acc,
      null,
      h.cust ?? null,
      h.sup ?? null,
      h.due ?? null,
      paidAmount,
      status,
      h.rec ?? 0,
      h.int ?? null,
      ''
    );
  }

  db.prepare(`
    INSERT INTO pricing_calculations (
      id, user_id, product_name, batch_units, raw_materials, labour, packaging, transportation, other_costs, desired_selling_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), userId, 'Millet Chakli (200g Pack)', 50, 1950, 500, 350, 200, 150, 90);

  db.prepare(`
    INSERT INTO scheme_applications (
      id, user_id, scheme_id, status, checklist_progress_json, notes, deadline_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    userId,
    'pmfme',
    'preparing',
    JSON.stringify({ 0: true, 1: true, 2: true, 3: false, 4: false }),
    'Getting machinery quote for automatic pulverizer from Bengaluru supplier.',
    daysFromNowIso(20)
  );

  return userId;
}

import { v4 as uuidv4 } from 'uuid';
import {
  User,
  BusinessProfile,
  SchemeEligibilityExtra,
  Customer,
  Supplier,
  Transaction,
  PricingCalculation,
  SchemeApplication,
} from '../models/index.js';
import { hashPassword } from '../../backend/middleware/auth.js';

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

export async function seedDemoAccount() {
  const existing = await User.findOne({ mobile: DEMO_MOBILE }).lean();
  if (existing) {
    return existing._id;
  }

  const userId = 'demo-kavya-gruha-udyog';
  const passwordHash = hashPassword('shakti123');

  await User.create({
    _id: userId,
    name: 'Kavya Gowda',
    mobile: DEMO_MOBILE,
    email: 'kavya.gruhaudyog@example.in',
    password_hash: passwordHash,
    preferred_language: 'en',
    location: 'Channapatna, Ramanagara, Karnataka',
    consent_privacy: true,
    consent_notifications: true,
    consent_scheme_matching: true,
    is_demo: true,
  });

  await BusinessProfile.create({
    _id: userId,
    user_id: userId,
    business_name: 'Kavya Gruha Udyog & Millet Snacks',
    category: 'Food Processing',
    description:
      'Home-based millet snacks, chakli, spice powders, and traditional pickles sold to local bakeries, kirana stores, and weekend markets.',
    location: 'Channapatna, Ramanagara',
    state: 'Karnataka',
    area_type: 'rural',
    established_date: '2023-06-15',
    enterprise_stage: 'existing',
    ownership_type: 'individual',
    approx_monthly_revenue: 42000,
    approx_monthly_expenses: 24500,
    employees_count: 2,
    registration_status: 'udyam_registered',
    gst_status: 'not_registered',
    udyam_status: 'registered',
    funding_requirement: 180000,
    growth_goals:
      'Purchase an automatic pulverizer & sealing machine to supply 15 more kirana stores across Ramanagara.',
    existing_loan_balance: 22000,
    monthly_loan_emi: 2500,
    planned_household_withdrawal: 4500,
    emergency_reserve_goal: 20000,
  });

  await SchemeEligibilityExtra.create({
    _id: userId,
    user_id: userId,
    social_category: 'obc',
    annual_family_income: 165000,
    education_level: 'PUC / 12th Pass',
    shg_member: true,
    bank_account_linked: true,
  });

  await Customer.insertMany([
    {
      _id: 'cust-lakshmi-store',
      user_id: userId,
      name: 'Lakshmi Provision Store',
      phone: '9880112233',
      notes: 'Weekly snacks & masala buyer',
    },
    {
      _id: 'cust-annapurna-bakery',
      user_id: userId,
      name: 'Annapurna Bakery',
      phone: '9900445566',
      notes: 'Bulk chakli & nippat orders',
    },
    {
      _id: 'cust-shanti-catering',
      user_id: userId,
      name: 'Shanti Gruha Catering',
      phone: '9740223344',
      notes: 'Event spice packets',
    },
  ]);

  await Supplier.insertMany([
    {
      _id: 'sup-kaveri-grains',
      user_id: userId,
      name: 'Kaveri Wholesale Grains',
      phone: '9844556677',
      category: 'Raw materials',
      notes: 'Ragi, rice flour, groundnuts',
    },
    {
      _id: 'sup-nandi-pack',
      user_id: userId,
      name: 'Nandi Packaging Traders',
      phone: '9611223344',
      category: 'Packaging',
      notes: 'Food-grade pouches & labels',
    },
    {
      _id: 'sup-mahalakshmi-oil',
      user_id: userId,
      name: 'Mahalakshmi Oil Mill',
      phone: '9448112299',
      category: 'Raw materials',
      notes: 'Cold-pressed groundnut oil',
    },
  ]);

  const txDocs = [
    {
      _id: uuidv4(),
      user_id: userId,
      client_tx_id: 'seed-cap-1',
      tx_date: daysAgoIso(92),
      entry_kind: 'capital_contribution',
      item_name: 'Opening Business Cash & Bank Reserve',
      category: 'Capital',
      quantity: 1,
      unit_price: 14000,
      amount: 14000,
      payment_method: 'bank_transfer',
      account_target: 'bank',
      paid_amount: 14000,
      settlement_status: 'paid',
      notes: 'Initial separated business reserve',
      source: 'seed',
    },
  ];

  const sampleHistory = [
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

    txDocs.push({
      _id: uuidv4(),
      user_id: userId,
      client_tx_id: `seed-tx-${i}`,
      tx_date: daysAgoIso(h.days),
      entry_kind: h.kind,
      item_name: h.item,
      category: h.cat,
      quantity: h.qty,
      unit_price: h.price,
      amount,
      payment_method: h.method,
      account_target: h.acc,
      transfer_to_account: null,
      customer_id: h.cust ?? null,
      supplier_id: h.sup ?? null,
      due_date: h.due ?? null,
      paid_amount: paidAmount,
      settlement_status: status,
      is_recurring: h.rec ?? 0,
      recurring_interval: h.int ?? null,
      notes: '',
      source: 'seed',
    });
  }

  await Transaction.insertMany(txDocs);

  await PricingCalculation.create({
    _id: uuidv4(),
    user_id: userId,
    product_name: 'Millet Chakli (200g Pack)',
    batch_units: 50,
    raw_materials: 1950,
    labour: 500,
    packaging: 350,
    transportation: 200,
    other_costs: 150,
    desired_selling_price: 90,
  });

  await SchemeApplication.create({
    _id: uuidv4(),
    user_id: userId,
    scheme_id: 'pmfme',
    status: 'preparing',
    checklist_progress_json: JSON.stringify({ 0: true, 1: true, 2: true, 3: false, 4: false }),
    notes: 'Getting machinery quote for automatic pulverizer from Bengaluru supplier.',
    deadline_date: daysFromNowIso(20),
  });

  return userId;
}

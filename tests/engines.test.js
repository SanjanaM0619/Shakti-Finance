import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;

const { connectDatabase, disconnectDatabase } = await import('../database/connection.js');
const { User, BusinessProfile, Transaction } = await import('../database/models/index.js');
const { seedSchemes } = await import('../database/seeds/seedSchemes.js');
const { seedDemoAccount } = await import('../database/seeds/seedDemo.js');
const { computeFinancialSummary } = await import('../backend/engines/accountingEngine.js');
const { computeCashFlowForecast } = await import('../backend/engines/forecastEngine.js');
const { computeSurplusRecommendation } = await import('../backend/engines/surplusEngine.js');
const { evaluateSchemesForUser } = await import('../backend/engines/schemeEngine.js');
const { deterministicParseTranscript } = await import('../backend/engines/voiceEngine.js');

let demoId;

test.before(async () => {
  await connectDatabase();
  await seedSchemes();
  demoId = await seedDemoAccount();
});

test.after(async () => {
  await disconnectDatabase();
});

test('Household-Business Financial Separation example from specification (MongoDB)', async () => {
  const userId = 'test-sep-user';
  await User.create({
    _id: userId,
    name: 'Anitha',
    mobile: '9999900001',
    password_hash: 'hash',
  });
  await BusinessProfile.create({
    _id: userId,
    user_id: userId,
    business_name: 'Anitha Snacks',
  });

  await Transaction.insertMany([
    { _id: 't1', user_id: userId, tx_date: '2026-11-01', entry_kind: 'sale', item_name: 'Snacks sales', category: 'Snacks', quantity: 1, unit_price: 15000, amount: 15000, payment_method: 'cash', account_target: 'cash', paid_amount: 15000, settlement_status: 'paid' },
    { _id: 't2', user_id: userId, tx_date: '2026-11-01', entry_kind: 'expense', item_name: 'Raw materials', category: 'Raw materials', quantity: 1, unit_price: 4000, amount: 4000, payment_method: 'cash', account_target: 'cash', paid_amount: 4000, settlement_status: 'paid' },
    { _id: 't3', user_id: userId, tx_date: '2026-11-01', entry_kind: 'expense', item_name: 'Transportation', category: 'Transportation', quantity: 1, unit_price: 500, amount: 500, payment_method: 'cash', account_target: 'cash', paid_amount: 500, settlement_status: 'paid' },
    { _id: 't4', user_id: userId, tx_date: '2026-11-01', entry_kind: 'expense', item_name: 'Electricity', category: 'Electricity', quantity: 1, unit_price: 500, amount: 500, payment_method: 'cash', account_target: 'cash', paid_amount: 500, settlement_status: 'paid' },
    { _id: 't5', user_id: userId, tx_date: '2026-11-01', entry_kind: 'household_withdrawal', item_name: 'Home withdrawal', category: 'Household', quantity: 1, unit_price: 3000, amount: 3000, payment_method: 'cash', account_target: 'cash', paid_amount: 3000, settlement_status: 'paid' },
    { _id: 't6', user_id: userId, tx_date: '2026-11-02', entry_kind: 'account_transfer', item_name: 'Cash deposit to bank', category: 'Transfer', quantity: 1, unit_price: 2000, amount: 2000, payment_method: 'cash', account_target: 'cash', transfer_to_account: 'bank', paid_amount: 2000, settlement_status: 'paid' },
  ]);

  const summary = await computeFinancialSummary(userId);
  assert.equal(summary.totalRevenue, 15000);
  assert.equal(summary.totalOperatingExpenses, 5000);
  assert.equal(summary.operatingSurplus, 10000);
  assert.equal(summary.householdWithdrawals, 3000);
  assert.equal(summary.remainingBusinessFundsAfterWithdrawals, 7000);
  assert.equal(summary.availableCash, 7000);
  assert.equal(summary.cashByAccount.cash, 5000);
  assert.equal(summary.cashByAccount.bank, 2000);
});

test('Credit sales are excluded from available cash until collected', async () => {
  const userId = 'test-credit-user';
  await User.create({
    _id: userId,
    name: 'Deepa',
    mobile: '9999900002',
    password_hash: 'hash',
  });
  await BusinessProfile.create({
    _id: userId,
    user_id: userId,
    business_name: 'Deepa Tailoring',
  });

  await Transaction.create({
    _id: 'c1',
    user_id: userId,
    tx_date: '2026-11-01',
    entry_kind: 'sale',
    item_name: 'Uniform Order',
    category: 'Tailoring',
    quantity: 1,
    unit_price: 10000,
    amount: 10000,
    payment_method: 'credit',
    account_target: 'bank',
    paid_amount: 2000,
    settlement_status: 'partial',
    due_date: '2026-10-15',
  });

  const summary = await computeFinancialSummary(userId);
  assert.equal(summary.totalRevenue, 10000);
  assert.equal(summary.availableCash, 2000);
  assert.equal(summary.accountsReceivable, 8000);
  assert.equal(summary.overdueReceivables, 8000);
});

test('Forecasting engine produces 7/30/90d forecasts and backtesting metrics for demo account', async () => {
  const f30 = await computeCashFlowForecast(demoId, 30);
  assert.equal(f30.horizonDays, 30);
  assert.equal(f30.points.length, 31);
  assert.equal(f30.isPreliminary, false);
  assert.ok(f30.methodology.backtestMetrics.maeInflow !== null);

  const f90 = await computeCashFlowForecast(demoId, 90);
  assert.equal(f90.horizonDays, 90);
  assert.equal(f90.points.length, 91);
});

test('Surplus engine and Scheme eligibility engine return valid structured classifications', async () => {
  const surplus = await computeSurplusRecommendation(demoId);
  assert.ok(surplus.availableCash > 0);
  assert.equal(surplus.rationale.length, 5);

  const schemes = await evaluateSchemesForUser(demoId);
  assert.ok(schemes.length >= 12);
  const pmegp = schemes.find((s) => s.id === 'pmegp');
  assert.equal(pmegp.evaluation.outcome, 'Currently ineligible');
});

test('Voice bilingual parser extracts multi-clause sales and expenses cleanly', () => {
  const parsed = deterministicParseTranscript(
    'Today I sold 20 packets of snacks for 2,000 rupees and spent 600 rupees buying ingredients.'
  );
  assert.equal(parsed.transactions.length, 2);
  assert.equal(parsed.transactions[0].entry_kind, 'sale');
  assert.equal(parsed.transactions[0].amount, 2000);
  assert.equal(parsed.transactions[1].entry_kind, 'expense');
  assert.equal(parsed.transactions[1].amount, 600);

  const kannada = deterministicParseTranscript('ಇಂದು 1500 ರೂಪಾಯಿ ಮಾರಾಟ ಮತ್ತು 400 ರೂಪಾಯಿ ಸಾಮಗ್ರಿ ಖರ್ಚು', 'kn');
  assert.equal(kannada.transactions.length, 2);
  assert.equal(kannada.transactions[0].entry_kind, 'sale');
  assert.equal(kannada.transactions[0].amount, 1500);
  assert.equal(kannada.transactions[1].entry_kind, 'expense');
  assert.equal(kannada.transactions[1].amount, 400);
});

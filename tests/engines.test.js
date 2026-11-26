import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Use isolated temp SQLite database for tests
const testDbPath = path.join(os.tmpdir(), `shakti_test_${Date.now()}.sqlite`);
process.env.SHAKTI_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { db } = await import('../server/db.js');
const { seedSchemes } = await import('../server/seedSchemes.js');
const { seedDemoAccount } = await import('../server/seedDemo.js');
const { computeFinancialSummary } = await import('../server/engines/accountingEngine.js');
const { computeCashFlowForecast } = await import('../server/engines/forecastEngine.js');
const { computeSurplusRecommendation } = await import('../server/engines/surplusEngine.js');
const { evaluateSchemesForUser } = await import('../server/engines/schemeEngine.js');
const { deterministicParseTranscript } = await import('../server/engines/voiceEngine.js');

seedSchemes();
const demoId = seedDemoAccount();

test('Household-Business Financial Separation example from specification', () => {
  const userId = 'test-sep-user';
  db.prepare(`INSERT INTO users (id, name, mobile, password_hash) VALUES (?, 'Anitha', '9999900001', 'hash')`).run(userId);
  db.prepare(`INSERT INTO business_profiles (user_id, business_name) VALUES (?, 'Anitha Snacks')`).run(userId);

  const insert = db.prepare(`
    INSERT INTO transactions (id, user_id, tx_date, entry_kind, item_name, category, quantity, unit_price, amount, payment_method, account_target, paid_amount, settlement_status)
    VALUES (?, ?, '2026-11-01', ?, ?, ?, 1, ?, ?, 'cash', 'cash', ?, 'paid')
  `);

  // Business sales: ₹15,000; Raw materials: ₹4,000; Transport: ₹500; Electricity: ₹500; Household withdrawal: ₹3,000
  insert.run('t1', userId, 'sale', 'Snacks sales', 'Snacks', 15000, 15000, 15000);
  insert.run('t2', userId, 'expense', 'Raw materials', 'Raw materials', 4000, 4000, 4000);
  insert.run('t3', userId, 'expense', 'Transportation', 'Transportation', 500, 500, 500);
  insert.run('t4', userId, 'expense', 'Electricity', 'Electricity', 500, 500, 500);
  insert.run('t5', userId, 'household_withdrawal', 'Home withdrawal', 'Household', 3000, 3000, 3000);
  // Transfer between cash and bank should NOT change revenue, expense, or total cash
  db.prepare(`
    INSERT INTO transactions (id, user_id, tx_date, entry_kind, item_name, category, quantity, unit_price, amount, payment_method, account_target, transfer_to_account, paid_amount, settlement_status)
    VALUES ('t6', ?, '2026-11-02', 'account_transfer', 'Cash deposit to bank', 'Transfer', 1, 2000, 2000, 'cash', 'cash', 'bank', 2000, 'paid')
  `).run(userId);

  const summary = computeFinancialSummary(userId);
  assert.equal(summary.totalRevenue, 15000);
  assert.equal(summary.totalOperatingExpenses, 5000);
  assert.equal(summary.operatingSurplus, 10000);
  assert.equal(summary.householdWithdrawals, 3000);
  assert.equal(summary.remainingBusinessFundsAfterWithdrawals, 7000);
  assert.equal(summary.availableCash, 7000);
  assert.equal(summary.cashByAccount.cash, 5000);
  assert.equal(summary.cashByAccount.bank, 2000);
});

test('Credit sales are excluded from available cash until collected', () => {
  const userId = 'test-credit-user';
  db.prepare(`INSERT INTO users (id, name, mobile, password_hash) VALUES (?, 'Deepa', '9999900002', 'hash')`).run(userId);
  db.prepare(`INSERT INTO business_profiles (user_id, business_name) VALUES (?, 'Deepa Tailoring')`).run(userId);

  db.prepare(`
    INSERT INTO transactions (id, user_id, tx_date, entry_kind, item_name, category, quantity, unit_price, amount, payment_method, account_target, paid_amount, settlement_status, due_date)
    VALUES ('c1', ?, '2026-11-01', 'sale', 'Uniform Order', 'Tailoring', 1, 10000, 10000, 'credit', 'bank', 2000, 'partial', '2026-10-15')
  `).run(userId);

  const summary = computeFinancialSummary(userId);
  assert.equal(summary.totalRevenue, 10000);
  assert.equal(summary.availableCash, 2000);
  assert.equal(summary.accountsReceivable, 8000);
  assert.equal(summary.overdueReceivables, 8000);
});

test('Forecasting engine produces 7/30/90d forecasts and backtesting metrics for demo account', () => {
  const f30 = computeCashFlowForecast(demoId, 30);
  assert.equal(f30.horizonDays, 30);
  assert.equal(f30.points.length, 31);
  assert.equal(f30.isPreliminary, false);
  assert.ok(f30.methodology.backtestMetrics.maeInflow !== null);

  const f90 = computeCashFlowForecast(demoId, 90);
  assert.equal(f90.horizonDays, 90);
  assert.equal(f90.points.length, 91);
});

test('Surplus engine and Scheme eligibility engine return valid structured classifications', () => {
  const surplus = computeSurplusRecommendation(demoId);
  assert.ok(surplus.availableCash > 0);
  assert.equal(surplus.rationale.length, 5);

  const schemes = evaluateSchemesForUser(demoId);
  assert.ok(schemes.length >= 8);
  const outcomes = new Set(schemes.map((s) => s.evaluation.outcome));
  assert.ok(
    outcomes.has('Potentially eligible') ||
      outcomes.has('Additional information required') ||
      outcomes.has('Currently ineligible')
  );
  // PMEGP is for NEW projects only, whereas demo business is 'existing' -> Currently ineligible
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
  assert.equal(parsed.transactions[0].quantity, 20);
  assert.equal(parsed.transactions[1].entry_kind, 'expense');
  assert.equal(parsed.transactions[1].amount, 600);
  assert.equal(parsed.transactions[1].category, 'Raw materials');

  const kannada = deterministicParseTranscript('ಇಂದು 1500 ರೂಪಾಯಿ ಮಾರಾಟ ಮತ್ತು 400 ರೂಪಾಯಿ ಸಾಮಗ್ರಿ ಖರ್ಚು', 'kn');
  assert.equal(kannada.transactions.length, 2);
  assert.equal(kannada.transactions[0].entry_kind, 'sale');
  assert.equal(kannada.transactions[0].amount, 1500);
  assert.equal(kannada.transactions[1].entry_kind, 'expense');
  assert.equal(kannada.transactions[1].amount, 400);
});

test.after(() => {
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

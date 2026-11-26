import { db } from '../db.js';

export const ENTRY_KINDS = [
  'sale',
  'expense',
  'household_withdrawal',
  'personal_contribution',
  'loan_received',
  'loan_repayment',
  'account_transfer',
  'capital_contribution',
  'adjustment',
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDaysIso(baseIso, days) {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic financial summary & health engine for a single tenant (userId).
 * Strictly separates business revenue/expenses from household withdrawals,
 * personal capital contributions, loans, and internal transfers.
 */
export function computeFinancialSummary(userId, options = {}) {
  const { startDate = null, endDate = null } = options;

  let query = `SELECT * FROM transactions WHERE user_id = ?`;
  const params = [userId];
  if (startDate) {
    query += ` AND tx_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND tx_date <= ?`;
    params.push(endDate);
  }
  query += ` ORDER BY tx_date DESC, created_at DESC`;

  const allTx = db.prepare(query).all(...params);
  const allUnfilteredTx =
    startDate || endDate
      ? db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY tx_date DESC`).all(userId)
      : allTx;

  const profile =
    db.prepare(`SELECT * FROM business_profiles WHERE user_id = ?`).get(userId) || {};

  const settlements = db
    .prepare(`SELECT * FROM settlement_payments WHERE user_id = ? ORDER BY payment_date DESC`)
    .all(userId);

  let totalRevenue = 0;
  let totalOperatingExpenses = 0;
  let costOfGoodsSold = 0;
  let hasCogsData = false;
  let householdWithdrawals = 0;
  let personalContributions = 0;
  let loansReceived = 0;
  let loanRepayments = 0;
  let accountTransfersVolume = 0;

  let accountsReceivable = 0;
  let overdueReceivables = 0;
  let accountsPayable = 0;
  let overduePayables = 0;
  let upcomingSupplierObligations30d = 0;

  const today = isoDate();
  const in30Days = addDaysIso(today, 30);

  const cashByAccount = { cash: 0, upi: 0, bank: 0 };
  const expenseByCategory = {};
  const salesByCategory = {};
  const salesByPaymentMethod = { cash: 0, upi: 0, bank_transfer: 0, credit: 0 };
  const monthlyMap = {};

  const COGS_CATEGORIES = new Set(['Raw materials', 'Packaging']);

  for (const tx of allTx) {
    const amount = Number(tx.amount) || 0;
    const paid = tx.payment_method === 'credit' ? Number(tx.paid_amount) || 0 : amount;
    const unpaid = Math.max(0, amount - paid);
    const monthKey = (tx.tx_date || today).slice(0, 7);

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthKey,
        revenue: 0,
        expenses: 0,
        householdWithdrawals: 0,
        personalContributions: 0,
      };
    }

    const acc = ['cash', 'upi', 'bank'].includes(tx.account_target) ? tx.account_target : 'cash';

    switch (tx.entry_kind) {
      case 'sale': {
        totalRevenue += amount;
        monthlyMap[monthKey].revenue += amount;
        salesByCategory[tx.category || 'General'] =
          (salesByCategory[tx.category || 'General'] || 0) + amount;
        const pm = tx.payment_method || 'cash';
        salesByPaymentMethod[pm] = (salesByPaymentMethod[pm] || 0) + amount;

        // Only received cash enters available cash! Credit unpaid stays in AR.
        cashByAccount[acc] += paid;
        if (unpaid > 0) {
          accountsReceivable += unpaid;
          if (tx.due_date && tx.due_date < today) {
            overdueReceivables += unpaid;
          }
        }
        break;
      }

      case 'expense': {
        totalOperatingExpenses += amount;
        monthlyMap[monthKey].expenses += amount;
        const cat = tx.category || 'Other business expenses';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
        if (COGS_CATEGORIES.has(cat)) {
          costOfGoodsSold += amount;
          hasCogsData = true;
        }

        cashByAccount[acc] -= paid;
        if (unpaid > 0) {
          accountsPayable += unpaid;
          if (tx.due_date && tx.due_date < today) {
            overduePayables += unpaid;
          }
          if (!tx.due_date || tx.due_date <= in30Days) {
            upcomingSupplierObligations30d += unpaid;
          }
        }
        break;
      }

      case 'household_withdrawal': {
        householdWithdrawals += amount;
        monthlyMap[monthKey].householdWithdrawals += amount;
        cashByAccount[acc] -= amount;
        break;
      }

      case 'personal_contribution':
      case 'capital_contribution': {
        personalContributions += amount;
        monthlyMap[monthKey].personalContributions += amount;
        cashByAccount[acc] += amount;
        break;
      }

      case 'loan_received': {
        loansReceived += amount;
        cashByAccount[acc] += amount;
        break;
      }

      case 'loan_repayment': {
        loanRepayments += amount;
        cashByAccount[acc] -= amount;
        break;
      }

      case 'account_transfer': {
        accountTransfersVolume += amount;
        const toAcc = ['cash', 'upi', 'bank'].includes(tx.transfer_to_account)
          ? tx.transfer_to_account
          : 'bank';
        cashByAccount[acc] -= amount;
        cashByAccount[toAcc] += amount;
        break;
      }

      case 'adjustment': {
        cashByAccount[acc] += amount;
        break;
      }
    }
  }

  // Compute all-time cash position if filtered by date, so availableCash is accurate
  let allTimeCash = round2(cashByAccount.cash + cashByAccount.upi + cashByAccount.bank);
  if (startDate || endDate) {
    const allSummary = computeAllTimeCashOnly(allUnfilteredTx);
    allTimeCash = allSummary.totalCash;
  }

  const operatingSurplus = round2(totalRevenue - totalOperatingExpenses);
  const grossProfit = hasCogsData ? round2(totalRevenue - costOfGoodsSold) : null;
  const profitMarginPct =
    totalRevenue > 0 ? round2((operatingSurplus / totalRevenue) * 100) : 0;

  const workingCapital = round2(allTimeCash + accountsReceivable - accountsPayable);
  const monthlyEmi = Number(profile.monthly_loan_emi) || 0;
  const plannedHousehold = Number(profile.planned_household_withdrawal) || 0;

  // Estimate monthly recurring expenses from flagged recurring expenses in last 45 days
  const recurringMonthlyExpenses = allUnfilteredTx
    .filter((t) => t.entry_kind === 'expense' && Number(t.is_recurring) === 1)
    .reduce((acc, t) => {
      // deduplicate by item_name using latest occurrence
      acc.set(t.item_name, Number(t.amount) || 0);
      return acc;
    }, new Map());
  let recurringEstimate = 0;
  for (const val of recurringMonthlyExpenses.values()) recurringEstimate += val;

  const upcomingObligations = round2(
    upcomingSupplierObligations30d + monthlyEmi + recurringEstimate
  );
  const netAfterObligationsAndHousehold = round2(
    allTimeCash - upcomingSupplierObligations30d - monthlyEmi - plannedHousehold
  );

  // Average daily operating outflow over last 30 days
  const thirtyDaysAgo = addDaysIso(today, -30);
  const last30Expenses = allUnfilteredTx
    .filter((t) => t.entry_kind === 'expense' && t.tx_date >= thirtyDaysAgo)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const last30Revenue = allUnfilteredTx
    .filter((t) => t.entry_kind === 'sale' && t.tx_date >= thirtyDaysAgo)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const avgDailyExpense = last30Expenses > 0 ? last30Expenses / 30 : totalOperatingExpenses / 90;
  const cashRunwayDays =
    avgDailyExpense > 0 ? Math.round(Math.max(0, allTimeCash) / avgDailyExpense) : null;

  const emergencyGoal = Number(profile.emergency_reserve_goal) || 15000;
  const emergencyBuffer = round2(Math.max(0, allTimeCash - upcomingSupplierObligations30d - monthlyEmi));
  const emergencyBufferCoveragePct =
    emergencyGoal > 0 ? round2(Math.min(100, (emergencyBuffer / emergencyGoal) * 100)) : 0;

  // Month-on-month trends sorted chronologically
  const momTrends = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      revenue: round2(m.revenue),
      expenses: round2(m.expenses),
      householdWithdrawals: round2(m.householdWithdrawals),
      operatingSurplus: round2(m.revenue - m.expenses),
    }));

  let revenueGrowthPct = null;
  let expenseGrowthPct = null;
  if (momTrends.length >= 2) {
    const prev = momTrends[momTrends.length - 2];
    const curr = momTrends[momTrends.length - 1];
    if (prev.revenue > 0) {
      revenueGrowthPct = round2(((curr.revenue - prev.revenue) / prev.revenue) * 100);
    }
    if (prev.expenses > 0) {
      expenseGrowthPct = round2(((curr.expenses - prev.expenses) / prev.expenses) * 100);
    }
  }

  // Explainable Financial Health Classification
  const health = classifyFinancialHealth({
    availableCash: allTimeCash,
    upcomingSupplierObligations30d,
    monthlyEmi,
    plannedHousehold,
    overdueReceivables,
    overduePayables,
    operatingSurplus,
    totalRevenue,
    profitMarginPct,
    expenseGrowthPct,
    revenueGrowthPct,
    emergencyBuffer,
    emergencyGoal,
    txCount: allTx.length,
  });

  // Business funds remaining after household withdrawals (strict separation metric)
  const remainingBusinessFundsAfterWithdrawals = round2(
    operatingSurplus + personalContributions - householdWithdrawals
  );

  return {
    period: { startDate, endDate },
    transactionCount: allTx.length,
    totalRevenue: round2(totalRevenue),
    totalOperatingExpenses: round2(totalOperatingExpenses),
    costOfGoodsSold: hasCogsData ? round2(costOfGoodsSold) : null,
    grossProfit,
    operatingSurplus,
    profitMarginPct,
    availableCash: allTimeCash,
    cashByAccount: {
      cash: round2(cashByAccount.cash),
      upi: round2(cashByAccount.upi),
      bank: round2(cashByAccount.bank),
    },
    accountsReceivable: round2(accountsReceivable),
    overdueReceivables: round2(overdueReceivables),
    accountsPayable: round2(accountsPayable),
    overduePayables: round2(overduePayables),
    householdWithdrawals: round2(householdWithdrawals),
    personalContributions: round2(personalContributions),
    loansReceived: round2(loansReceived),
    loanRepayments: round2(loanRepayments),
    accountTransfersVolume: round2(accountTransfersVolume),
    remainingBusinessFundsAfterWithdrawals,
    workingCapital,
    upcomingSupplierObligations30d: round2(upcomingSupplierObligations30d),
    upcomingObligations,
    plannedHouseholdWithdrawal: round2(plannedHousehold),
    monthlyLoanEmi: round2(monthlyEmi),
    netAfterObligationsAndHousehold,
    emergencyBuffer,
    emergencyReserveGoal: round2(emergencyGoal),
    emergencyBufferCoveragePct,
    cashRunwayDays,
    last30Revenue: round2(last30Revenue),
    last30Expenses: round2(last30Expenses),
    revenueGrowthPct,
    expenseGrowthPct,
    momTrends,
    expenseByCategory: Object.entries(expenseByCategory)
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    salesByCategory: Object.entries(salesByCategory)
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    salesByPaymentMethod,
    settlementCount: settlements.length,
    health,
    accountingAssumptions: [
      'Revenue is recognized on sale date (including credit sales), while Available Cash counts only collected payments.',
      'Household withdrawals and loan repayments are excluded from operating expenses and shown separately.',
      'Transfers between cash, UPI, and bank accounts do not affect revenue, expenses, or total cash.',
      hasCogsData
        ? 'Gross profit uses Raw materials and Packaging expenses as Cost of Goods Sold.'
        : 'Gross profit is omitted because no Raw materials or Packaging cost records were found.',
    ],
  };
}

function computeAllTimeCashOnly(allTx) {
  let total = 0;
  for (const tx of allTx) {
    const amount = Number(tx.amount) || 0;
    const paid = tx.payment_method === 'credit' ? Number(tx.paid_amount) || 0 : amount;
    switch (tx.entry_kind) {
      case 'sale':
      case 'personal_contribution':
      case 'capital_contribution':
      case 'loan_received':
      case 'adjustment':
        total += tx.entry_kind === 'sale' ? paid : amount;
        break;
      case 'expense':
      case 'household_withdrawal':
      case 'loan_repayment':
        total -= tx.entry_kind === 'expense' ? paid : amount;
        break;
    }
  }
  return { totalCash: round2(total) };
}

function classifyFinancialHealth(metrics) {
  const factors = [];
  let stressPoints = 0;
  let attentionPoints = 0;

  if (metrics.txCount < 3) {
    return {
      status: 'Needs attention',
      score: null,
      isPreliminary: true,
      summary:
        'Insufficient transaction history to verify profitability or financial stability. Record at least 5–10 sales and expenses for an accurate assessment.',
      factors: [
        {
          label: 'Data completeness',
          impact: 'warning',
          detail: `Only ${metrics.txCount} transaction(s) recorded so far. Incomplete books cannot confirm true profitability.`,
        },
      ],
    };
  }

  const obligations = metrics.upcomingSupplierObligations30d + metrics.monthlyEmi;
  const remainingAfterAll = metrics.availableCash - obligations - metrics.plannedHousehold;

  // Factor 1: Cash vs Upcoming Obligations & Household Draw
  if (metrics.availableCash <= 0 || remainingAfterAll < 0) {
    stressPoints += 2;
    factors.push({
      label: 'Cash vs upcoming obligations',
      impact: 'negative',
      detail: `Available cash is ₹${metrics.availableCash.toLocaleString('en-IN')}. After ₹${obligations.toLocaleString('en-IN')} in upcoming supplier/EMI obligations and ₹${metrics.plannedHousehold.toLocaleString('en-IN')} in planned household withdrawal, there is a shortfall of ₹${Math.abs(round2(remainingAfterAll)).toLocaleString('en-IN')}.`,
    });
  } else if (remainingAfterAll < obligations * 0.5) {
    attentionPoints += 1;
    factors.push({
      label: 'Tight post-obligation buffer',
      impact: 'warning',
      detail: `You have ₹${metrics.availableCash.toLocaleString('en-IN')} in cash, ₹${obligations.toLocaleString('en-IN')} in upcoming payments, and ₹${metrics.plannedHousehold.toLocaleString('en-IN')} in planned household draw—leaving ₹${round2(remainingAfterAll).toLocaleString('en-IN')} remaining.`,
    });
  } else {
    factors.push({
      label: 'Cash coverage',
      impact: 'positive',
      detail: `Available cash of ₹${metrics.availableCash.toLocaleString('en-IN')} covers upcoming obligations (₹${obligations.toLocaleString('en-IN')}) and planned household needs (₹${metrics.plannedHousehold.toLocaleString('en-IN')}), leaving ₹${round2(remainingAfterAll).toLocaleString('en-IN')}.`,
    });
  }

  // Factor 2: Overdue receivables & payables
  if (metrics.overdueReceivables > 0) {
    attentionPoints += 1;
    factors.push({
      label: 'Overdue customer payments',
      impact: 'warning',
      detail: `₹${metrics.overdueReceivables.toLocaleString('en-IN')} in customer credit is past its due date. Pending credit is NOT counted in available cash until collected.`,
    });
  }
  if (metrics.overduePayables > 0) {
    stressPoints += 1;
    factors.push({
      label: 'Overdue supplier bills',
      impact: 'negative',
      detail: `₹${metrics.overduePayables.toLocaleString('en-IN')} in supplier bills is overdue and requires immediate settlement or renegotiation.`,
    });
  }

  // Factor 3: Operating surplus & margin
  if (metrics.operatingSurplus < 0) {
    stressPoints += 2;
    factors.push({
      label: 'Negative operating surplus',
      impact: 'negative',
      detail: `Operating expenses exceed business revenue by ₹${Math.abs(metrics.operatingSurplus).toLocaleString('en-IN')}.`,
    });
  } else if (metrics.profitMarginPct < 10 && metrics.totalRevenue > 0) {
    attentionPoints += 1;
    factors.push({
      label: 'Thin operating margin',
      impact: 'warning',
      detail: `Operating margin is ${metrics.profitMarginPct}%. Minor raw material price increases could erase surplus.`,
    });
  } else if (metrics.totalRevenue > 0) {
    factors.push({
      label: 'Healthy operating margin',
      impact: 'positive',
      detail: `Operating surplus is ₹${metrics.operatingSurplus.toLocaleString('en-IN')} (${metrics.profitMarginPct}% margin before household drawings).`,
    });
  }

  // Factor 4: Expense growth vs Revenue growth
  if (metrics.expenseGrowthPct !== null && metrics.expenseGrowthPct > 20) {
    attentionPoints += 1;
    factors.push({
      label: 'Rising expenses',
      impact: 'warning',
      detail: `Operating expenses changed by +${metrics.expenseGrowthPct}% compared to the previous month.`,
    });
  }

  // Factor 5: Emergency reserve
  if (metrics.emergencyBuffer < metrics.emergencyGoal * 0.35) {
    attentionPoints += 1;
    factors.push({
      label: 'Low emergency buffer',
      impact: 'warning',
      detail: `Post-obligation reserve (₹${metrics.emergencyBuffer.toLocaleString('en-IN')}) is below 35% of your ₹${metrics.emergencyGoal.toLocaleString('en-IN')} target.`,
    });
  }

  let status = 'Healthy';
  if (stressPoints >= 2) {
    status = 'Financially stressed';
  } else if (stressPoints === 1 || attentionPoints >= 2) {
    status = 'Needs attention';
  }

  const score = Math.max(
    15,
    Math.min(98, 92 - stressPoints * 22 - attentionPoints * 10)
  );

  return {
    status,
    score,
    isPreliminary: false,
    summary:
      status === 'Healthy'
        ? 'Cash reserves comfortably cover near-term obligations and operating margins are positive.'
        : status === 'Needs attention'
          ? 'Core operations are active, but tight cash margins, overdue customer payments, or rising costs need attention.'
          : 'Immediate cash-flow pressure detected: obligations or operating losses exceed available liquid cash.',
    factors,
  };
}

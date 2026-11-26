import { db } from '../db.js';
import { computeFinancialSummary } from './accountingEngine.js';
import { computeCashFlowForecast } from './forecastEngine.js';
import { evaluateSchemesForUser } from './schemeEngine.js';

function fmtInr(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

/**
 * Explainable AI Financial Assistant Engine
 * Grounded strictly in verified SQLite financial calculations for the authenticated tenant.
 * Never calculates balances via LLM or fabricates records.
 */
export async function answerFinancialQuestion(userId, question) {
  const q = (question || '').trim();
  const lower = q.toLowerCase();

  const user = db.prepare(`SELECT name, preferred_language FROM users WHERE id = ?`).get(userId) || {};
  const profile = db.prepare(`SELECT * FROM business_profiles WHERE user_id = ?`).get(userId) || {};
  const summary = computeFinancialSummary(userId);
  const forecast30 = computeCashFlowForecast(userId, 30);

  const overdueCustomers = db
    .prepare(`
      SELECT c.name, c.phone, SUM(t.amount - t.paid_amount) AS balance, MIN(t.due_date) AS earliest_due
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.user_id = ? AND t.entry_kind = 'sale' AND t.amount > t.paid_amount
      GROUP BY COALESCE(t.customer_id, t.item_name)
      ORDER BY balance DESC
    `)
    .all(userId);

  const unpaidSuppliers = db
    .prepare(`
      SELECT s.name, SUM(t.amount - t.paid_amount) AS balance, MIN(t.due_date) AS earliest_due
      FROM transactions t
      LEFT JOIN suppliers s ON s.id = t.supplier_id
      WHERE t.user_id = ? AND t.entry_kind = 'expense' AND t.amount > t.paid_amount
      GROUP BY COALESCE(t.supplier_id, t.item_name)
      ORDER BY balance DESC
    `)
    .all(userId);

  // Extract optional equipment cost if asking affordability ("Can I afford ... 25000")
  const amountMatch = q.replace(/,/g, '').match(/\b(\d{3,8})\b/);
  const equipmentCost = amountMatch ? Number(amountMatch[1]) : null;

  const missingData = [];
  if (summary.transactionCount < 5) {
    missingData.push('Fewer than 5 transactions recorded — add daily sales & expenses for reliable trends.');
  }
  if (!profile.planned_household_withdrawal) {
    missingData.push('Monthly planned household withdrawal is not set in Business Profile.');
  }
  if (summary.costOfGoodsSold === null) {
    missingData.push('No Raw Materials / Packaging expenses tagged yet, so Gross Profit cannot be separated.');
  }

  let answer = '';
  let highlights = [];
  let nextSteps = [];
  let matchedIntent = 'general_summary';

  if (/profit|surplus|margin|earned|make this month/i.test(lower)) {
    matchedIntent = 'profit_analysis';
    const latestMonth = summary.momTrends[summary.momTrends.length - 1];
    answer = `Based on your verified records (${summary.transactionCount} transactions), your total recorded business revenue is ${fmtInr(summary.totalRevenue)} and operating expenses are ${fmtInr(summary.totalOperatingExpenses)}, leaving an operating surplus of ${fmtInr(summary.operatingSurplus)} (${summary.profitMarginPct}% margin).`;
    if (latestMonth) {
      answer += ` In the latest month (${latestMonth.month}), sales were ${fmtInr(latestMonth.revenue)}, expenses were ${fmtInr(latestMonth.expenses)}, and operating surplus was ${fmtInr(latestMonth.operatingSurplus)}.`;
    }
    answer += ` Note: Household withdrawals of ${fmtInr(summary.householdWithdrawals)} are tracked separately and not deducted as business expenses.`;
    highlights = [
      { label: 'Operating Surplus', value: fmtInr(summary.operatingSurplus) },
      { label: 'Profit Margin', value: `${summary.profitMarginPct}%` },
      { label: 'Available Cash', value: fmtInr(summary.availableCash) },
    ];
    nextSteps = [
      'Compare your operating surplus against available cash to ensure credit sales are being collected.',
      'Review your top expense category in the Expenses tab to spot bulk-buying savings.',
    ];
  } else if (/expense|increase|cost|spending/i.test(lower)) {
    matchedIntent = 'expense_analysis';
    const topCats = summary.expenseByCategory.slice(0, 3);
    const growthText =
      summary.expenseGrowthPct !== null
        ? `Month-on-month operating expenses changed by ${summary.expenseGrowthPct >= 0 ? '+' : ''}${summary.expenseGrowthPct}%.`
        : 'At least 2 months of expense history are needed to compute month-on-month expense growth.';
    answer = `${growthText} Your largest expense categories are ${topCats.map((c) => `${c.category} (${fmtInr(c.amount)})`).join(', ') || 'none recorded yet'}.`;
    highlights = topCats.map((c) => ({ label: c.category, value: fmtInr(c.amount) }));
    nextSteps = [
      'Check if raw material unit prices increased and recalculate your break-even price in the Pricing Calculator.',
      'Separate any family/personal spending into Household Withdrawals so business costs stay accurate.',
    ];
  } else if (/customer|not paid|receivable|owe|pending|due/i.test(lower)) {
    matchedIntent = 'receivables';
    if (overdueCustomers.length === 0) {
      answer = `Great news — you currently have ₹0 in pending customer credit balances.`;
    } else {
      answer = `You have ${fmtInr(summary.accountsReceivable)} pending from customers (${fmtInr(summary.overdueReceivables)} overdue). Top pending balances: ${overdueCustomers.slice(0, 4).map((c) => `${c.name || 'Walk-in Credit'}: ${fmtInr(c.balance)} (due ${c.earliest_due || 'unspecified'})`).join('; ')}.`;
    }
    highlights = overdueCustomers.slice(0, 3).map((c) => ({
      label: c.name || 'Customer',
      value: fmtInr(c.balance),
    }));
    nextSteps = [
      'Send a polite payment reminder to overdue customers from the Customer Ledger.',
      'Record partial payments immediately so your available cash stays up to date.',
    ];
  } else if (/afford|equipment|buy|purchase|machine|safely use|spend/i.test(lower)) {
    matchedIntent = 'affordability';
    const safeSpend = Math.max(0, summary.netAfterObligationsAndHousehold);
    answer = `You currently hold ${fmtInr(summary.availableCash)} in liquid cash/bank/UPI. After reserving ${fmtInr(summary.upcomingSupplierObligations30d)} for unpaid supplier bills, ${fmtInr(summary.monthlyLoanEmi)} for loan EMI, and ${fmtInr(summary.plannedHouseholdWithdrawal)} for planned household needs, your safe uncommitted balance is ${fmtInr(safeSpend)}.`;
    if (equipmentCost) {
      if (equipmentCost <= safeSpend) {
        answer += ` An equipment purchase of ${fmtInr(equipmentCost)} fits within your safe uncommitted balance, though it will leave ${fmtInr(safeSpend - equipmentCost)} before emergency reserves.`;
      } else {
        answer += ` Purchasing equipment worth ${fmtInr(equipmentCost)} right now would create a cash shortfall of ${fmtInr(equipmentCost - safeSpend)}. Consider using a government subsidy/loan scheme (such as PMFME or MUDRA) or waiting until pending receivables (${fmtInr(summary.accountsReceivable)}) are collected.`;
      }
    }
    highlights = [
      { label: 'Available Cash', value: fmtInr(summary.availableCash) },
      { label: 'Near-term Obligations', value: fmtInr(summary.upcomingSupplierObligations30d + summary.monthlyLoanEmi) },
      { label: 'Safe Uncommitted Cash', value: fmtInr(safeSpend) },
    ];
    nextSteps = [
      'Check the Government Scheme Finder for 35% equipment subsidies (PMFME/PMEGP) before paying full cash.',
      'Review the 30-day Cash-Flow Forecast to ensure post-purchase cash never dips below zero.',
    ];
  } else if (/reserve|next month|save|cash decreasing|shortage/i.test(lower)) {
    matchedIntent = 'cash_and_reserves';
    answer = `For next month, reserve at least ${fmtInr(summary.upcomingObligations)} to cover unpaid supplier bills (${fmtInr(summary.upcomingSupplierObligations30d)}), recurring costs, and EMI (${fmtInr(summary.monthlyLoanEmi)}), plus ${fmtInr(summary.plannedHouseholdWithdrawal)} for planned household withdrawals. Your 30-day forecast estimates ${fmtInr(forecast30.summary.totalExpectedInflow)} in inflows vs ${fmtInr(forecast30.summary.totalExpectedOutflow)} in outflows.`;
    if (summary.householdWithdrawals > summary.operatingSurplus * 0.6 && summary.operatingSurplus > 0) {
      answer += ` Notice that household withdrawals (${fmtInr(summary.householdWithdrawals)}) represent a high share of your operating surplus, which can reduce business cash reserves.`;
    }
    highlights = [
      { label: 'Reserve Needed (30d)', value: fmtInr(summary.upcomingObligations) },
      { label: 'Projected 30d Cash', value: fmtInr(forecast30.summary.projectedEndBalance) },
      { label: 'Household Withdrawals', value: fmtInr(summary.householdWithdrawals) },
    ];
    nextSteps = [
      'Open the Surplus Allocation Planner to set custom envelopes for bills, emergencies, and growth.',
      'Monitor your lowest projected cash date in Cash-Flow Forecasting.',
    ];
  } else if (/improve|profitability|scheme|loan|grow/i.test(lower)) {
    matchedIntent = 'growth_and_schemes';
    const eligibleSchemes = evaluateSchemesForUser(userId).filter(
      (s) => s.evaluation.outcome === 'Potentially eligible'
    );
    answer = `Your current operating margin is ${summary.profitMarginPct}% (${summary.health.status}). To strengthen profitability: (1) collect ${fmtInr(summary.accountsReceivable)} in pending customer credit, (2) verify product unit margins in the Pricing Calculator, and (3) explore ${eligibleSchemes.length} potentially eligible government support schemes (such as ${eligibleSchemes.slice(0, 2).map((s) => s.name).join(' and ') || 'PM MUDRA / PMFME'}).`;
    highlights = [
      { label: 'Health Status', value: summary.health.status },
      { label: 'Pending Receivables', value: fmtInr(summary.accountsReceivable) },
      { label: 'Matched Schemes', value: `${eligibleSchemes.length}` },
    ];
    nextSteps = [
      'Run the Business Pricing Calculator on your top-selling products.',
      'Generate your Financial Readiness Report before visiting a bank or applying on JanSamarth.',
    ];
  } else {
    answer = `Here is your current verified financial snapshot for ${profile.business_name || 'your business'}: Total Revenue ${fmtInr(summary.totalRevenue)}, Operating Expenses ${fmtInr(summary.totalOperatingExpenses)}, Operating Surplus ${fmtInr(summary.operatingSurplus)}, Available Cash ${fmtInr(summary.availableCash)}, Customer Receivables ${fmtInr(summary.accountsReceivable)}, and Supplier Payables ${fmtInr(summary.accountsPayable)}. Health status: ${summary.health.status}.`;
    highlights = [
      { label: 'Operating Surplus', value: fmtInr(summary.operatingSurplus) },
      { label: 'Available Cash', value: fmtInr(summary.availableCash) },
      { label: 'Health Status', value: summary.health.status },
    ];
    nextSteps = [
      'Ask specific questions like "Which customers have not paid me?" or "Can I afford to buy a ₹25,000 machine?"',
    ];
  }

  const result = {
    question: q,
    intent: matchedIntent,
    answer,
    highlights,
    nextSteps,
    missingData,
    verifiedFactsUsed: {
      totalRevenue: summary.totalRevenue,
      totalOperatingExpenses: summary.totalOperatingExpenses,
      operatingSurplus: summary.operatingSurplus,
      availableCash: summary.availableCash,
      accountsReceivable: summary.accountsReceivable,
      accountsPayable: summary.accountsPayable,
      householdWithdrawals: summary.householdWithdrawals,
      healthStatus: summary.health.status,
      unpaidSuppliersCount: unpaidSuppliers.length,
    },
    disclaimer:
      'Informational guidance calculated strictly from your recorded Shakti Finance data. Recommendations are not guaranteed financial outcomes or professional tax/legal advice.',
  };

  // Optional LLM narrative polish when OPENAI_API_KEY is configured, strictly grounded in verifiedFactsUsed
  if (process.env.OPENAI_API_KEY) {
    try {
      const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: `You are Shakti Finance's financial guide for a woman micro-entrepreneur (${user.name || 'Entrepreneur'}).
Rewrite the verified calculation summary clearly and empathetically in ${user.preferred_language === 'kn' ? 'Kannada and simple English' : 'simple, encouraging English'}.
STRICT RULE: Use ONLY the exact numbers provided in Verified Facts and Draft Answer. Never invent transactions, balances, or percentages.`,
            },
            {
              role: 'user',
              content: `Question: ${q}\nDraft Answer: ${answer}\nVerified Facts: ${JSON.stringify(result.verifiedFactsUsed)}`,
            },
          ],
        }),
      });
      if (llmRes.ok) {
        const data = await llmRes.json();
        const polished = data.choices?.[0]?.message?.content?.trim();
        if (polished) result.answer = polished;
      }
    } catch {
      // Fall back safely to verified deterministic answer
    }
  }

  return result;
}

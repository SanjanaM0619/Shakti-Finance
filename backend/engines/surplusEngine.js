import { BusinessProfile, SurplusAllocation } from '../../database/models/index.js';
import { computeFinancialSummary } from './accountingEngine.js';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export async function computeSurplusRecommendation(userId) {
  const summary = await computeFinancialSummary(userId);
  const profile = (await BusinessProfile.findOne({ user_id: userId }).lean()) || {};
  const saved = (await SurplusAllocation.findOne({ user_id: userId }).lean()) || null;

  const availableCash = Math.max(0, summary.availableCash);
  const upcomingBillsAndEmi = round2(
    summary.upcomingSupplierObligations30d + summary.monthlyLoanEmi
  );
  const householdNeed = Number(profile.planned_household_withdrawal) || 0;
  const emergencyGoal = Number(profile.emergency_reserve_goal) || 15000;
  const emergencyGap = Math.max(0, emergencyGoal - summary.emergencyBuffer);
  const hasGrowthGoal = Boolean(profile.growth_goals || Number(profile.funding_requirement) > 0);

  let remaining = availableCash;
  const recommendedObligations = Math.min(remaining, upcomingBillsAndEmi);
  remaining = Math.max(0, remaining - recommendedObligations);

  const personalSavingsTarget =
    remaining > 0 ? Math.min(remaining, Math.max(householdNeed * 0.5, remaining * 0.2)) : 0;

  const emergencyShare = emergencyGap > emergencyGoal * 0.5 ? 0.35 : 0.2;
  const recommendedEmergency =
    remaining > 0
      ? round2(Math.min(remaining, Math.max(remaining * emergencyShare, Math.min(emergencyGap, remaining * 0.35))))
      : 0;
  remaining = Math.max(0, remaining - recommendedEmergency);

  const growthShare = hasGrowthGoal ? 0.35 : 0.2;
  const recommendedGrowth = remaining > 0 ? round2(remaining * growthShare) : 0;
  remaining = Math.max(0, remaining - recommendedGrowth);

  const recommendedPersonal =
    remaining > 0 ? round2(Math.min(remaining, Math.max(personalSavingsTarget, remaining * 0.6))) : 0;
  const recommendedFlexible = round2(Math.max(0, remaining - recommendedPersonal));

  const rationale = [
    {
      bucket: 'Upcoming Business Obligations',
      key: 'upcoming_obligations',
      amount: round2(recommendedObligations),
      reason:
        upcomingBillsAndEmi > 0
          ? `Covers ₹${summary.upcomingSupplierObligations30d.toLocaleString('en-IN')} in unpaid supplier bills due within 30 days plus ₹${summary.monthlyLoanEmi.toLocaleString('en-IN')} in monthly loan/SHG EMI.`
          : 'No immediate unpaid supplier bills or EMI due; keep a small operational float ready.',
    },
    {
      bucket: 'Emergency Reserves',
      key: 'emergency_reserves',
      amount: round2(recommendedEmergency),
      reason:
        emergencyGap > 0
          ? `Your emergency reserve goal is ₹${emergencyGoal.toLocaleString('en-IN')} (current post-obligation buffer: ₹${summary.emergencyBuffer.toLocaleString('en-IN')}). Building this protects against slow weeks or raw material price spikes.`
          : 'Your emergency buffer meets your target; this maintains a steady safety cushion.',
    },
    {
      bucket: 'Business Reinvestment',
      key: 'business_reinvestment',
      amount: round2(recommendedGrowth),
      reason: hasGrowthGoal
        ? `Supports your stated expansion goal (${profile.growth_goals || 'business scaling'}) and reduces borrowing cost.`
        : 'Provides working capital for bulk raw-material discounts and inventory replenishment.',
    },
    {
      bucket: 'Personal Savings',
      key: 'personal_savings',
      amount: round2(recommendedPersonal),
      reason:
        householdNeed > 0
          ? `Sets aside structured personal savings alongside your planned household withdrawal of ₹${householdNeed.toLocaleString('en-IN')}.`
          : 'Builds personal financial security separate from day-to-day business cash.',
    },
    {
      bucket: 'Flexible Balance',
      key: 'flexible_spending',
      amount: round2(recommendedFlexible),
      reason: 'Unallocated liquid buffer for minor unexpected day-to-day operational needs.',
    },
  ];

  return {
    availableCash: round2(availableCash),
    distributableAfterObligations: round2(Math.max(0, availableCash - recommendedObligations)),
    accountsReceivablePending: summary.accountsReceivable,
    note:
      summary.accountsReceivable > 0
        ? `₹${summary.accountsReceivable.toLocaleString('en-IN')} in pending customer payments is excluded until collected.`
        : 'All allocations reflect verified liquid cash only. Shakti Finance never moves or invests your money automatically.',
    recommended: {
      upcoming_obligations: round2(recommendedObligations),
      emergency_reserves: round2(recommendedEmergency),
      business_reinvestment: round2(recommendedGrowth),
      personal_savings: round2(recommendedPersonal),
      flexible_spending: round2(recommendedFlexible),
    },
    saved,
    rationale,
  };
}

export type Language = 'en' | 'kn';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email: string;
  preferred_language: Language;
  location: string;
  consent_privacy: number | boolean;
  consent_notifications: number | boolean;
  consent_scheme_matching: number | boolean;
  is_demo: number | boolean;
}

export interface BusinessProfile {
  user_id?: string;
  business_name: string;
  category: string;
  description: string;
  location: string;
  state: string;
  area_type: 'rural' | 'urban';
  established_date: string;
  enterprise_stage: 'new' | 'existing';
  ownership_type: 'individual' | 'partnership' | 'shg';
  approx_monthly_revenue: number;
  approx_monthly_expenses: number;
  employees_count: number;
  registration_status: string;
  gst_status: string;
  udyam_status: string;
  funding_requirement: number;
  growth_goals: string;
  existing_loan_balance: number;
  monthly_loan_emi: number;
  planned_household_withdrawal: number;
  emergency_reserve_goal: number;
}

export interface SchemeExtra {
  social_category: string;
  annual_family_income: number | null;
  education_level: string;
  shg_member: number | boolean;
  bank_account_linked: number | boolean;
}

export type EntryKind =
  | 'sale'
  | 'expense'
  | 'household_withdrawal'
  | 'personal_contribution'
  | 'loan_received'
  | 'loan_repayment'
  | 'account_transfer'
  | 'capital_contribution'
  | 'adjustment';

export interface Transaction {
  id: string;
  client_tx_id?: string | null;
  tx_date: string;
  entry_kind: EntryKind;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'credit';
  account_target: 'cash' | 'upi' | 'bank';
  transfer_to_account?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  due_date?: string | null;
  paid_amount: number;
  settlement_status: 'paid' | 'partial' | 'unpaid';
  is_recurring: number;
  recurring_interval?: string | null;
  receipt_path?: string | null;
  notes: string;
  source: string;
}

export interface FinancialSummary {
  transactionCount: number;
  totalRevenue: number;
  totalOperatingExpenses: number;
  costOfGoodsSold: number | null;
  grossProfit: number | null;
  operatingSurplus: number;
  profitMarginPct: number;
  availableCash: number;
  cashByAccount: { cash: number; upi: number; bank: number };
  accountsReceivable: number;
  overdueReceivables: number;
  accountsPayable: number;
  overduePayables: number;
  householdWithdrawals: number;
  personalContributions: number;
  loansReceived: number;
  loanRepayments: number;
  accountTransfersVolume: number;
  remainingBusinessFundsAfterWithdrawals: number;
  workingCapital: number;
  upcomingSupplierObligations30d: number;
  upcomingObligations: number;
  plannedHouseholdWithdrawal: number;
  monthlyLoanEmi: number;
  netAfterObligationsAndHousehold: number;
  emergencyBuffer: number;
  emergencyReserveGoal: number;
  emergencyBufferCoveragePct: number;
  cashRunwayDays: number | null;
  last30Revenue: number;
  last30Expenses: number;
  revenueGrowthPct: number | null;
  expenseGrowthPct: number | null;
  momTrends: Array<{
    month: string;
    revenue: number;
    expenses: number;
    householdWithdrawals: number;
    personalContributions: number;
    operatingSurplus: number;
  }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
  salesByCategory: Array<{ category: string; amount: number }>;
  salesByPaymentMethod: Record<string, number>;
  health: {
    status: 'Healthy' | 'Needs attention' | 'Financially stressed';
    score: number | null;
    isPreliminary: boolean;
    summary: string;
    factors: Array<{ label: string; impact: 'positive' | 'warning' | 'negative'; detail: string }>;
  };
  accountingAssumptions: string[];
}

export interface SchemeItem {
  id: string;
  name: string;
  department: string;
  state: string;
  category: string;
  assistance_type: 'loan' | 'subsidy' | 'grant' | 'interest_subvention' | 'credit_guarantee' | 'training';
  summary: string;
  financial_benefit: string;
  required_documents: string[];
  application_steps: string[];
  official_url: string;
  opening_date: string | null;
  closing_date: string | null;
  status: string;
  last_verified_date: string;
  source_reference: string;
  evaluation: {
    outcome: 'Potentially eligible' | 'Additional information required' | 'Currently ineligible';
    matchedReasons: string[];
    ineligibleReasons: string[];
    missingInfoReasons: string[];
    disclaimer: string;
  };
  application: {
    id: string;
    status: string;
    checklist_progress_json: string;
    notes: string;
    deadline_date: string | null;
    updated_at: string;
  } | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'info';
  action_url: string;
  is_read: boolean;
  created_at: string;
}

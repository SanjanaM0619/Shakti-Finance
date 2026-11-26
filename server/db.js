import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.SHAKTI_DB_PATH || path.join(dataDir, 'shakti_finance.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      location TEXT NOT NULL DEFAULT '',
      consent_privacy INTEGER NOT NULL DEFAULT 1,
      consent_notifications INTEGER NOT NULL DEFAULT 1,
      consent_scheme_matching INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_sessions (
      mobile TEXT PRIMARY KEY,
      otp_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Food Processing',
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'Karnataka',
      area_type TEXT NOT NULL DEFAULT 'rural',
      established_date TEXT NOT NULL DEFAULT '',
      enterprise_stage TEXT NOT NULL DEFAULT 'existing',
      ownership_type TEXT NOT NULL DEFAULT 'individual',
      approx_monthly_revenue REAL NOT NULL DEFAULT 0,
      approx_monthly_expenses REAL NOT NULL DEFAULT 0,
      employees_count INTEGER NOT NULL DEFAULT 1,
      registration_status TEXT NOT NULL DEFAULT 'unregistered',
      gst_status TEXT NOT NULL DEFAULT 'not_registered',
      udyam_status TEXT NOT NULL DEFAULT 'not_registered',
      funding_requirement REAL NOT NULL DEFAULT 0,
      growth_goals TEXT NOT NULL DEFAULT '',
      existing_loan_balance REAL NOT NULL DEFAULT 0,
      monthly_loan_emi REAL NOT NULL DEFAULT 0,
      planned_household_withdrawal REAL NOT NULL DEFAULT 0,
      emergency_reserve_goal REAL NOT NULL DEFAULT 15000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheme_eligibility_extra (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      social_category TEXT NOT NULL DEFAULT 'general',
      annual_family_income REAL,
      education_level TEXT NOT NULL DEFAULT '',
      shg_member INTEGER NOT NULL DEFAULT 0,
      bank_account_linked INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Raw materials',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_tx_id TEXT,
      tx_date TEXT NOT NULL,
      entry_kind TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      account_target TEXT NOT NULL DEFAULT 'cash',
      transfer_to_account TEXT,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
      due_date TEXT,
      paid_amount REAL NOT NULL DEFAULT 0,
      settlement_status TEXT NOT NULL DEFAULT 'paid',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurring_interval TEXT,
      receipt_path TEXT,
      notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, client_tx_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, tx_date);
    CREATE INDEX IF NOT EXISTS idx_tx_user_kind ON transactions(user_id, entry_kind);

    CREATE TABLE IF NOT EXISTS settlement_payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      party_type TEXT NOT NULL,
      party_id TEXT,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS surplus_allocations (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      upcoming_obligations REAL NOT NULL DEFAULT 0,
      emergency_reserves REAL NOT NULL DEFAULT 0,
      business_reinvestment REAL NOT NULL DEFAULT 0,
      personal_savings REAL NOT NULL DEFAULT 0,
      flexible_spending REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      state TEXT NOT NULL,
      category TEXT NOT NULL,
      assistance_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      financial_benefit TEXT NOT NULL,
      eligibility_rules_json TEXT NOT NULL,
      required_documents_json TEXT NOT NULL,
      application_steps_json TEXT NOT NULL,
      official_url TEXT NOT NULL,
      opening_date TEXT,
      closing_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      last_verified_date TEXT NOT NULL,
      source_reference TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheme_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'preparing',
      checklist_progress_json TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      deadline_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, scheme_id)
    );

    CREATE TABLE IF NOT EXISTS pricing_calculations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      batch_units REAL NOT NULL DEFAULT 1,
      raw_materials REAL NOT NULL DEFAULT 0,
      labour REAL NOT NULL DEFAULT 0,
      packaging REAL NOT NULL DEFAULT 0,
      transportation REAL NOT NULL DEFAULT 0,
      other_costs REAL NOT NULL DEFAULT 0,
      desired_selling_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS literacy_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      quiz_score INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      action_url TEXT NOT NULL DEFAULT '/dashboard',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

initSchema();

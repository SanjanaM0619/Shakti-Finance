import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { comparePassword, hashPassword, requireAuth, signToken } from '../auth.js';
import { DEMO_MOBILE, seedDemoAccount } from '../seedDemo.js';

const router = express.Router();

function loadFullUserPayload(userId) {
  const user = db
    .prepare(
      `SELECT id, name, mobile, email, preferred_language, location,
              consent_privacy, consent_notifications, consent_scheme_matching, is_demo, created_at
       FROM users WHERE id = ?`
    )
    .get(userId);
  if (!user) return null;

  const businessProfile =
    db.prepare(`SELECT * FROM business_profiles WHERE user_id = ?`).get(userId) || null;

  const schemeExtra = user.consent_scheme_matching
    ? db.prepare(`SELECT * FROM scheme_eligibility_extra WHERE user_id = ?`).get(userId) || null
    : null;

  return { user, businessProfile, schemeExtra };
}

router.post('/register', (req, res) => {
  const {
    name,
    mobile,
    email = '',
    password,
    preferred_language = 'en',
    location = '',
    consent_privacy = true,
    consent_notifications = true,
    consent_scheme_matching = false,
  } = req.body || {};

  if (!name || !mobile || !password) {
    return res.status(400).json({ error: 'Name, mobile number, and password are required.' });
  }
  if (!/^\d{10}$/.test(String(mobile).trim())) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
  }
  if (!consent_privacy) {
    return res.status(400).json({ error: 'Privacy consent is required to create an account.' });
  }

  const cleanMobile = String(mobile).trim();
  const existing = db.prepare(`SELECT id FROM users WHERE mobile = ?`).get(cleanMobile);
  if (existing) {
    return res.status(409).json({ error: 'An account with this mobile number already exists.' });
  }

  const userId = uuidv4();
  const passwordHash = hashPassword(password);

  db.prepare(`
    INSERT INTO users (
      id, name, mobile, email, password_hash, preferred_language, location,
      consent_privacy, consent_notifications, consent_scheme_matching, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    userId,
    name.trim(),
    cleanMobile,
    email.trim(),
    passwordHash,
    preferred_language === 'kn' ? 'kn' : 'en',
    location.trim(),
    consent_privacy ? 1 : 0,
    consent_notifications ? 1 : 0,
    consent_scheme_matching ? 1 : 0
  );

  // Create empty business profile shell ready for onboarding
  db.prepare(`
    INSERT INTO business_profiles (user_id, location) VALUES (?, ?)
  `).run(userId, location.trim());

  const payload = loadFullUserPayload(userId);
  const token = signToken(payload.user);
  return res.status(201).json({ token, ...payload });
});

router.post('/login', (req, res) => {
  const { mobile, password } = req.body || {};
  if (!mobile || !password) {
    return res.status(400).json({ error: 'Mobile number and password are required.' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE mobile = ?`).get(String(mobile).trim());
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid mobile number or password.' });
  }

  const payload = loadFullUserPayload(user.id);
  const token = signToken(payload.user);
  return res.json({ token, ...payload });
});

router.post('/otp/request', (req, res) => {
  const { mobile } = req.body || {};
  const cleanMobile = String(mobile || '').trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }

  const user = db.prepare(`SELECT id FROM users WHERE mobile = ?`).get(cleanMobile);
  if (!user) {
    return res.status(404).json({ error: 'No account found for this mobile number. Please register first.' });
  }

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

  db.prepare(`
    INSERT INTO otp_sessions (mobile, otp_code, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(mobile) DO UPDATE SET otp_code = excluded.otp_code, expires_at = excluded.expires_at
  `).run(cleanMobile, otpCode, expiresAt);

  return res.json({
    sent: true,
    mode: 'demo-otp',
    demoOtp: otpCode,
    message:
      'Demo OTP mode active (SMS gateway not configured). Use the displayed 6-digit code to sign in.',
  });
});

router.post('/otp/verify', (req, res) => {
  const { mobile, otp } = req.body || {};
  const cleanMobile = String(mobile || '').trim();
  const session = db.prepare(`SELECT * FROM otp_sessions WHERE mobile = ?`).get(cleanMobile);

  if (!session || session.otp_code !== String(otp || '').trim()) {
    return res.status(401).json({ error: 'Invalid OTP code.' });
  }
  if (session.expires_at < new Date().toISOString()) {
    return res.status(401).json({ error: 'OTP expired. Request a new code.' });
  }

  db.prepare(`DELETE FROM otp_sessions WHERE mobile = ?`).run(cleanMobile);
  const user = db.prepare(`SELECT * FROM users WHERE mobile = ?`).get(cleanMobile);
  const payload = loadFullUserPayload(user.id);
  const token = signToken(payload.user);
  return res.json({ token, ...payload });
});

router.post('/demo-login', (_req, res) => {
  const demoId = seedDemoAccount();
  const payload = loadFullUserPayload(demoId);
  const token = signToken(payload.user);
  return res.json({
    token,
    demoInfo: {
      mobile: DEMO_MOBILE,
      note: 'Signed into Demo Mode with realistic 90-day sample records for Kavya Gruha Udyog.',
    },
    ...payload,
  });
});

router.get('/me', requireAuth, (req, res) => {
  const payload = loadFullUserPayload(req.user.id);
  if (!payload) return res.status(404).json({ error: 'User not found.' });
  return res.json(payload);
});

router.put('/profile', requireAuth, (req, res) => {
  const { user: userUpdates, businessProfile, schemeExtra } = req.body || {};

  if (userUpdates) {
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        preferred_language = COALESCE(?, preferred_language),
        location = COALESCE(?, location),
        consent_notifications = COALESCE(?, consent_notifications),
        consent_scheme_matching = COALESCE(?, consent_scheme_matching)
      WHERE id = ?
    `).run(
      userUpdates.name ?? null,
      userUpdates.email ?? null,
      userUpdates.preferred_language ?? null,
      userUpdates.location ?? null,
      userUpdates.consent_notifications !== undefined ? (userUpdates.consent_notifications ? 1 : 0) : null,
      userUpdates.consent_scheme_matching !== undefined ? (userUpdates.consent_scheme_matching ? 1 : 0) : null,
      req.user.id
    );
  }

  if (businessProfile) {
    db.prepare(`
      INSERT INTO business_profiles (
        user_id, business_name, category, description, location, state, area_type,
        established_date, enterprise_stage, ownership_type, approx_monthly_revenue,
        approx_monthly_expenses, employees_count, registration_status, gst_status,
        udyam_status, funding_requirement, growth_goals, existing_loan_balance,
        monthly_loan_emi, planned_household_withdrawal, emergency_reserve_goal, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        business_name = excluded.business_name,
        category = excluded.category,
        description = excluded.description,
        location = excluded.location,
        state = excluded.state,
        area_type = excluded.area_type,
        established_date = excluded.established_date,
        enterprise_stage = excluded.enterprise_stage,
        ownership_type = excluded.ownership_type,
        approx_monthly_revenue = excluded.approx_monthly_revenue,
        approx_monthly_expenses = excluded.approx_monthly_expenses,
        employees_count = excluded.employees_count,
        registration_status = excluded.registration_status,
        gst_status = excluded.gst_status,
        udyam_status = excluded.udyam_status,
        funding_requirement = excluded.funding_requirement,
        growth_goals = excluded.growth_goals,
        existing_loan_balance = excluded.existing_loan_balance,
        monthly_loan_emi = excluded.monthly_loan_emi,
        planned_household_withdrawal = excluded.planned_household_withdrawal,
        emergency_reserve_goal = excluded.emergency_reserve_goal,
        updated_at = datetime('now')
    `).run(
      req.user.id,
      businessProfile.business_name || '',
      businessProfile.category || 'Food Processing',
      businessProfile.description || '',
      businessProfile.location || '',
      businessProfile.state || 'Karnataka',
      businessProfile.area_type || 'rural',
      businessProfile.established_date || '',
      businessProfile.enterprise_stage || 'existing',
      businessProfile.ownership_type || 'individual',
      Number(businessProfile.approx_monthly_revenue) || 0,
      Number(businessProfile.approx_monthly_expenses) || 0,
      Number(businessProfile.employees_count) || 1,
      businessProfile.registration_status || 'unregistered',
      businessProfile.gst_status || 'not_registered',
      businessProfile.udyam_status || 'not_registered',
      Number(businessProfile.funding_requirement) || 0,
      businessProfile.growth_goals || '',
      Number(businessProfile.existing_loan_balance) || 0,
      Number(businessProfile.monthly_loan_emi) || 0,
      Number(businessProfile.planned_household_withdrawal) || 0,
      Number(businessProfile.emergency_reserve_goal) || 15000
    );
  }

  if (schemeExtra) {
    const currentUser = db.prepare(`SELECT consent_scheme_matching FROM users WHERE id = ?`).get(req.user.id);
    if (currentUser?.consent_scheme_matching) {
      db.prepare(`
        INSERT INTO scheme_eligibility_extra (
          user_id, social_category, annual_family_income, education_level, shg_member, bank_account_linked, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          social_category = excluded.social_category,
          annual_family_income = excluded.annual_family_income,
          education_level = excluded.education_level,
          shg_member = excluded.shg_member,
          bank_account_linked = excluded.bank_account_linked,
          updated_at = datetime('now')
      `).run(
        req.user.id,
        schemeExtra.social_category || 'general',
        schemeExtra.annual_family_income !== '' && schemeExtra.annual_family_income !== null
          ? Number(schemeExtra.annual_family_income)
          : null,
        schemeExtra.education_level || '',
        schemeExtra.shg_member ? 1 : 0,
        schemeExtra.bank_account_linked !== false ? 1 : 0
      );
    }
  }

  return res.json(loadFullUserPayload(req.user.id));
});

export default router;

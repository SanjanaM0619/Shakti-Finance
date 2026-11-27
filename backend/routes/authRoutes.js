import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  BusinessProfile,
  OtpSession,
  SchemeEligibilityExtra,
  User,
} from '../../database/models/index.js';
import { DEMO_MOBILE, seedDemoAccount } from '../../database/seeds/seedDemo.js';
import { comparePassword, hashPassword, requireAuth, signToken } from '../middleware/auth.js';

const router = express.Router();

async function loadFullUserPayload(userId) {
  const userDoc = await User.findById(userId)
    .select(
      'name mobile email preferred_language location consent_privacy consent_notifications consent_scheme_matching is_demo created_at'
    )
    .lean();
  if (!userDoc) return null;

  const user = { ...userDoc, id: userDoc._id };
  const businessProfile = (await BusinessProfile.findOne({ user_id: userId }).lean()) || null;
  const schemeExtra = user.consent_scheme_matching
    ? (await SchemeEligibilityExtra.findOne({ user_id: userId }).lean()) || null
    : null;

  return { user, businessProfile, schemeExtra };
}

router.post('/register', async (req, res) => {
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
  const existing = await User.findOne({ mobile: cleanMobile }).lean();
  if (existing) {
    return res.status(409).json({ error: 'An account with this mobile number already exists.' });
  }

  const userId = uuidv4();
  const passwordHash = hashPassword(password);

  await User.create({
    _id: userId,
    name: name.trim(),
    mobile: cleanMobile,
    email: email.trim(),
    password_hash: passwordHash,
    preferred_language: preferred_language === 'kn' ? 'kn' : 'en',
    location: location.trim(),
    consent_privacy: Boolean(consent_privacy),
    consent_notifications: Boolean(consent_notifications),
    consent_scheme_matching: Boolean(consent_scheme_matching),
    is_demo: false,
  });

  await BusinessProfile.create({
    _id: userId,
    user_id: userId,
    location: location.trim(),
  });

  const payload = await loadFullUserPayload(userId);
  const token = signToken(payload.user);
  return res.status(201).json({ token, ...payload });
});

router.post('/login', async (req, res) => {
  const { mobile, password } = req.body || {};
  if (!mobile || !password) {
    return res.status(400).json({ error: 'Mobile number and password are required.' });
  }

  const user = await User.findOne({ mobile: String(mobile).trim() }).lean();
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid mobile number or password.' });
  }

  const payload = await loadFullUserPayload(user._id);
  const token = signToken(payload.user);
  return res.json({ token, ...payload });
});

router.post('/otp/request', async (req, res) => {
  const { mobile } = req.body || {};
  const cleanMobile = String(mobile || '').trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }

  const user = await User.findOne({ mobile: cleanMobile }).lean();
  if (!user) {
    return res.status(404).json({ error: 'No account found for this mobile number. Please register first.' });
  }

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60000);

  await OtpSession.findByIdAndUpdate(
    cleanMobile,
    { _id: cleanMobile, otp_code: otpCode, expires_at: expiresAt },
    { upsert: true, new: true }
  );

  return res.json({
    sent: true,
    mode: 'demo-otp',
    demoOtp: otpCode,
    message:
      'Demo OTP mode active (SMS gateway not configured). Use the displayed 6-digit code to sign in.',
  });
});

router.post('/otp/verify', async (req, res) => {
  const { mobile, otp } = req.body || {};
  const cleanMobile = String(mobile || '').trim();
  const session = await OtpSession.findById(cleanMobile).lean();

  if (!session || session.otp_code !== String(otp || '').trim()) {
    return res.status(401).json({ error: 'Invalid OTP code.' });
  }
  if (new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: 'OTP expired. Request a new code.' });
  }

  await OtpSession.deleteOne({ _id: cleanMobile });
  const user = await User.findOne({ mobile: cleanMobile }).lean();
  const payload = await loadFullUserPayload(user._id);
  const token = signToken(payload.user);
  return res.json({ token, ...payload });
});

router.post('/demo-login', async (_req, res) => {
  const demoId = await seedDemoAccount();
  const payload = await loadFullUserPayload(demoId);
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

router.get('/me', requireAuth, async (req, res) => {
  const payload = await loadFullUserPayload(req.user.id);
  if (!payload) return res.status(404).json({ error: 'User not found.' });
  return res.json(payload);
});

router.put('/profile', requireAuth, async (req, res) => {
  const { user: userUpdates, businessProfile, schemeExtra } = req.body || {};

  if (userUpdates) {
    const updateFields = {};
    if (userUpdates.name !== undefined) updateFields.name = userUpdates.name;
    if (userUpdates.email !== undefined) updateFields.email = userUpdates.email;
    if (userUpdates.preferred_language !== undefined) {
      updateFields.preferred_language = userUpdates.preferred_language;
    }
    if (userUpdates.location !== undefined) updateFields.location = userUpdates.location;
    if (userUpdates.consent_notifications !== undefined) {
      updateFields.consent_notifications = Boolean(userUpdates.consent_notifications);
    }
    if (userUpdates.consent_scheme_matching !== undefined) {
      updateFields.consent_scheme_matching = Boolean(userUpdates.consent_scheme_matching);
    }
    await User.updateOne({ _id: req.user.id }, { $set: updateFields });
  }

  if (businessProfile) {
    await BusinessProfile.findOneAndUpdate(
      { user_id: req.user.id },
      {
        $set: {
          _id: req.user.id,
          user_id: req.user.id,
          business_name: businessProfile.business_name || '',
          category: businessProfile.category || 'Food Processing',
          description: businessProfile.description || '',
          location: businessProfile.location || '',
          state: businessProfile.state || 'Karnataka',
          area_type: businessProfile.area_type || 'rural',
          established_date: businessProfile.established_date || '',
          enterprise_stage: businessProfile.enterprise_stage || 'existing',
          ownership_type: businessProfile.ownership_type || 'individual',
          approx_monthly_revenue: Number(businessProfile.approx_monthly_revenue) || 0,
          approx_monthly_expenses: Number(businessProfile.approx_monthly_expenses) || 0,
          employees_count: Number(businessProfile.employees_count) || 1,
          registration_status: businessProfile.registration_status || 'unregistered',
          gst_status: businessProfile.gst_status || 'not_registered',
          udyam_status: businessProfile.udyam_status || 'not_registered',
          funding_requirement: Number(businessProfile.funding_requirement) || 0,
          growth_goals: businessProfile.growth_goals || '',
          existing_loan_balance: Number(businessProfile.existing_loan_balance) || 0,
          monthly_loan_emi: Number(businessProfile.monthly_loan_emi) || 0,
          planned_household_withdrawal: Number(businessProfile.planned_household_withdrawal) || 0,
          emergency_reserve_goal: Number(businessProfile.emergency_reserve_goal) || 15000,
        },
      },
      { upsert: true }
    );
  }

  if (schemeExtra) {
    const currentUser = await User.findById(req.user.id).select('consent_scheme_matching').lean();
    if (currentUser?.consent_scheme_matching) {
      await SchemeEligibilityExtra.findOneAndUpdate(
        { user_id: req.user.id },
        {
          $set: {
            _id: req.user.id,
            user_id: req.user.id,
            social_category: schemeExtra.social_category || 'general',
            annual_family_income:
              schemeExtra.annual_family_income !== '' && schemeExtra.annual_family_income !== null
                ? Number(schemeExtra.annual_family_income)
                : null,
            education_level: schemeExtra.education_level || '',
            shg_member: Boolean(schemeExtra.shg_member),
            bank_account_linked: schemeExtra.bank_account_linked !== false,
          },
        },
        { upsert: true }
      );
    }
  }

  return res.json(await loadFullUserPayload(req.user.id));
});

export default router;

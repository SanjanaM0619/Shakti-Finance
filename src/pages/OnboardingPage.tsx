import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { BusinessProfile, SchemeExtra } from '../types';

const CATEGORIES = [
  'Food Processing',
  'Tailoring & Apparel',
  'Handicrafts',
  'Beauty & Wellness Services',
  'Retail & Kirana',
  'Agriculture & Allied',
  'Small-Scale Manufacturing',
  'Other Micro-Enterprise',
];

export const OnboardingPage: React.FC = () => {
  const { user, businessProfile, schemeExtra, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<BusinessProfile>({
    business_name: '',
    category: 'Food Processing',
    description: '',
    location: user?.location || '',
    state: 'Karnataka',
    area_type: 'rural',
    established_date: '',
    enterprise_stage: 'existing',
    ownership_type: 'individual',
    approx_monthly_revenue: 0,
    approx_monthly_expenses: 0,
    employees_count: 1,
    registration_status: 'unregistered',
    gst_status: 'not_registered',
    udyam_status: 'not_registered',
    funding_requirement: 0,
    growth_goals: '',
    existing_loan_balance: 0,
    monthly_loan_emi: 0,
    planned_household_withdrawal: 0,
    emergency_reserve_goal: 15000,
  });

  const [consentScheme, setConsentScheme] = useState<boolean>(Boolean(user?.consent_scheme_matching));
  const [extra, setExtra] = useState<SchemeExtra>({
    social_category: 'general',
    annual_family_income: null,
    education_level: '',
    shg_member: false,
    bank_account_linked: true,
  });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (businessProfile) setForm((prev) => ({ ...prev, ...businessProfile }));
    if (schemeExtra) setExtra((prev) => ({ ...prev, ...schemeExtra }));
  }, [businessProfile, schemeExtra]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          user: { consent_scheme_matching: consentScheme },
          businessProfile: form,
          schemeExtra: consentScheme ? extra : null,
        }),
      });
      await refreshProfile();
      setSavedMsg('Business profile saved successfully.');
      setTimeout(() => navigate('/dashboard'), 800);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Onboarding & Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Powers accurate financial health thresholds, cash-flow alerts, and government scheme eligibility.
          </p>
        </div>
        <Building2 className="w-8 h-8 text-blue-600 hidden sm:block" />
      </div>

      {savedMsg && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" /> {savedMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="card-surface p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
            1. Enterprise Identity
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Business Name *</label>
              <input
                type="text"
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="e.g., Kavya Gruha Udyog"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Business Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">What do you make or sell?</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Briefly describe your products, services, and customers"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Town / Village / District</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">State</label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="input-field"
              >
                <option value="Karnataka">Karnataka</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Telangana">Telangana</option>
                <option value="Kerala">Kerala</option>
                <option value="Other">Other State</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card-surface p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
            2. Structure, Stage & Registrations
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Area Classification</label>
              <select
                value={form.area_type}
                onChange={(e) => setForm({ ...form, area_type: e.target.value as 'rural' | 'urban' })}
                className="input-field"
              >
                <option value="rural">Rural / Gram Panchayat</option>
                <option value="urban">Urban / Town / City</option>
              </select>
            </div>
            <div>
              <label className="label-text">Enterprise Stage</label>
              <select
                value={form.enterprise_stage}
                onChange={(e) => setForm({ ...form, enterprise_stage: e.target.value as 'new' | 'existing' })}
                className="input-field"
              >
                <option value="new">New / Planning to Start</option>
                <option value="existing">Existing Business</option>
              </select>
            </div>
            <div>
              <label className="label-text">Ownership Type</label>
              <select
                value={form.ownership_type}
                onChange={(e) =>
                  setForm({ ...form, ownership_type: e.target.value as 'individual' | 'partnership' | 'shg' })
                }
                className="input-field"
              >
                <option value="individual">Individual Woman Proprietor</option>
                <option value="shg">Self-Help Group (SHG)</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>
            <div>
              <label className="label-text">Establishment Date</label>
              <input
                type="date"
                value={form.established_date}
                onChange={(e) => setForm({ ...form, established_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Udyam Registration</label>
              <select
                value={form.udyam_status}
                onChange={(e) => setForm({ ...form, udyam_status: e.target.value })}
                className="input-field"
              >
                <option value="not_registered">Not Registered Yet</option>
                <option value="registered">Registered (Udyam)</option>
              </select>
            </div>
            <div>
              <label className="label-text">GST Status</label>
              <select
                value={form.gst_status}
                onChange={(e) => setForm({ ...form, gst_status: e.target.value })}
                className="input-field"
              >
                <option value="not_registered">Not Applicable / Unregistered</option>
                <option value="registered">GST Registered</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card-surface p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
            3. Baseline Scale, Household Planning & Funding Goals
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Approx Monthly Revenue (₹)</label>
              <input
                type="number"
                min={0}
                value={form.approx_monthly_revenue}
                onChange={(e) => setForm({ ...form, approx_monthly_revenue: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Approx Monthly Expenses (₹)</label>
              <input
                type="number"
                min={0}
                value={form.approx_monthly_expenses}
                onChange={(e) => setForm({ ...form, approx_monthly_expenses: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Employees (including self)</label>
              <input
                type="number"
                min={1}
                value={form.employees_count}
                onChange={(e) => setForm({ ...form, employees_count: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Planned Household Draw / Month (₹)</label>
              <input
                type="number"
                min={0}
                value={form.planned_household_withdrawal}
                onChange={(e) =>
                  setForm({ ...form, planned_household_withdrawal: Number(e.target.value) })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Emergency Reserve Target (₹)</label>
              <input
                type="number"
                min={0}
                value={form.emergency_reserve_goal}
                onChange={(e) => setForm({ ...form, emergency_reserve_goal: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Monthly Loan EMI (₹)</label>
              <input
                type="number"
                min={0}
                value={form.monthly_loan_emi}
                onChange={(e) => setForm({ ...form, monthly_loan_emi: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Funding Requirement (₹)</label>
              <input
                type="number"
                min={0}
                value={form.funding_requirement}
                onChange={(e) => setForm({ ...form, funding_requirement: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Business Growth Goals</label>
              <input
                type="text"
                value={form.growth_goals}
                onChange={(e) => setForm({ ...form, growth_goals: e.target.value })}
                placeholder="e.g., Buy packaging machine, expand to 10 retail shops"
                className="input-field"
              />
            </div>
          </div>
        </section>

        <section className="card-surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                4. Optional Consented Scheme Matching Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Collected only with your explicit consent to refine Udyogini, DAY-NRLM, and state subsidy matching.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={consentScheme}
                onChange={(e) => setConsentScheme(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Consent Granted
            </label>
          </div>

          {consentScheme && (
            <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="label-text">Social Category (Optional)</label>
                <select
                  value={extra.social_category}
                  onChange={(e) => setExtra({ ...extra, social_category: e.target.value })}
                  className="input-field"
                >
                  <option value="general">General</option>
                  <option value="obc">OBC</option>
                  <option value="sc">SC</option>
                  <option value="st">ST</option>
                  <option value="minority">Minority</option>
                </select>
              </div>
              <div>
                <label className="label-text">Annual Family Income (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={extra.annual_family_income ?? ''}
                  onChange={(e) =>
                    setExtra({
                      ...extra,
                      annual_family_income: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                  className="input-field"
                />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(extra.shg_member)}
                    onChange={(e) => setExtra({ ...extra, shg_member: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Member of a Women SHG
                </label>
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? 'Saving Profile...' : 'Save & Continue to Dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
};

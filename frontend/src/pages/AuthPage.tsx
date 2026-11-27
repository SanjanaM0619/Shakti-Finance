import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Smartphone, KeyRound } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'en' | 'kn'>('en');
  const [location, setLocation] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [consentNotifications, setConsentNotifications] = useState(true);
  const [consentSchemes, setConsentSchemes] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  const { loginWithPayload } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      if (mode === 'register') {
        const payload = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            mobile,
            email,
            password,
            preferred_language: language,
            location,
            consent_privacy: consentPrivacy,
            consent_notifications: consentNotifications,
            consent_scheme_matching: consentSchemes,
          }),
        });
        loginWithPayload(payload);
        navigate('/onboarding');
      } else if (mode === 'login') {
        const payload = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ mobile, password }),
        });
        loginWithPayload(payload);
        navigate('/dashboard');
      } else if (mode === 'otp') {
        if (!otpSent) {
          const res = await apiFetch<{ message: string; demoOtp: string }>('/api/auth/otp/request', {
            method: 'POST',
            body: JSON.stringify({ mobile }),
          });
          setOtpSent(true);
          setDemoOtpHint(res.demoOtp);
          setInfo(res.message);
        } else {
          const payload = await apiFetch('/api/auth/otp/verify', {
            method: 'POST',
            body: JSON.stringify({ mobile, otp: otpCode }),
          });
          loginWithPayload(payload);
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <span className="text-sm font-bold text-blue-700">Shakti Finance</span>
        </div>

        <div className="card-surface p-6 sm:p-8 space-y-6">
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setError(null); setInfo(null); }}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                mode === 'otp' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              OTP Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setInfo(null); }}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                mode === 'register' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Register
            </button>
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {mode === 'register'
                ? 'Create your Shakti Finance account'
                : mode === 'otp'
                  ? 'Sign in with Mobile OTP'
                  : 'Welcome back'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'register'
                ? 'Only essential details are collected. Your financial data stays private.'
                : 'Access your enterprise cashbook, forecasts, and scheme checklists.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs space-y-1">
              <p className="font-medium">{info}</p>
              {demoOtpHint && (
                <p className="font-mono font-bold text-sm">Demo OTP Code: {demoOtpHint}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label-text">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Kavya Gowda"
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="label-text">Mobile Number (10 digits) *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  pattern="\d{10}"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9845012345"
                  className="input-field"
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Email (Optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Preferred Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'en' | 'kn')}
                      className="input-field"
                    >
                      <option value="en">English</option>
                      <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Town / Village / District</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Ramanagara, Karnataka"
                    className="input-field"
                  />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <label className="label-text">Password *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="input-field"
                />
              </div>
            )}

            {mode === 'otp' && otpSent && (
              <div>
                <label className="label-text">Enter 6-digit OTP *</label>
                <input
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="input-field font-mono"
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    <strong>Privacy Consent (Required):</strong> Store my business ledger securely with
                    strict tenant isolation.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentNotifications}
                    onChange={(e) => setConsentNotifications(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <span>Enable in-app reminders for overdue payments and cash-flow alerts.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentSchemes}
                    onChange={(e) => setConsentSchemes(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Allow optional eligibility fields for personalized government scheme matching.
                  </span>
                </label>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
              {busy ? (
                'Please wait...'
              ) : mode === 'register' ? (
                'Create Account & Set Up Business'
              ) : mode === 'otp' ? (
                otpSent ? (
                  <>
                    <KeyRound className="w-4 h-4" /> Verify OTP & Sign In
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" /> Request Demo OTP
                  </>
                )
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

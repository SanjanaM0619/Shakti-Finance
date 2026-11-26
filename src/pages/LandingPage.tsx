import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Mic,
  Scale,
  Landmark,
  Activity,
  LineChart,
  ShieldCheck,
  Sparkles,
  Globe,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

export const LandingPage: React.FC = () => {
  const { user, language, setLanguage, loginWithPayload } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const payload = await apiFetch('/api/auth/demo-login', { method: 'POST' });
      loginWithPayload(payload);
      navigate('/dashboard');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">Shakti Finance</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                ಶಕ್ತಿ ಫೈನಾನ್ಸ್
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              {language === 'en' ? 'ಕನ್ನಡ' : 'English'}
            </button>
            {user ? (
              <Link to="/dashboard" className="btn-primary">
                Open Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/auth" className="btn-secondary">
                  {t(language, 'signIn')}
                </Link>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={demoLoading}
                  className="btn-primary"
                >
                  {demoLoading ? 'Loading Demo...' : t(language, 'exploreDemo')}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="bg-gradient-to-b from-blue-50/70 via-white to-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t(language, 'heroBadge')}
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-[1.15]">
                {t(language, 'heroTitlePrefix')}{' '}
                <span className="text-blue-600">{t(language, 'heroTitleHighlight')}</span>
                {t(language, 'heroTitleSuffix')}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                {t(language, 'heroDesc')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to="/auth?mode=register" className="btn-primary px-6 py-3 text-base">
                  {t(language, 'createFreeAccount')} <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={demoLoading}
                  className="btn-secondary px-6 py-3 text-base"
                >
                  {demoLoading ? 'Opening Demo...' : t(language, 'trySampleDemo')}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Works offline with safe sync • Kannada & English voice entry • PDF & CSV lender-ready
                reports
              </p>
            </div>

            {/* Minimalist Trust Preview Card */}
            <div className="lg:col-span-5">
              <div className="card-surface p-6 space-y-5 border-blue-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Sample Enterprise Snapshot</p>
                    <p className="font-bold text-slate-900">Kavya Gruha Udyog</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Health: Healthy
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500">Business Revenue</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">₹15,000</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500">Operating Expenses</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">₹5,000</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-100">
                    <p className="text-xs text-blue-700 font-medium">Operating Surplus</p>
                    <p className="text-lg font-bold text-blue-700 mt-0.5">₹10,000</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500">Household Withdrawal</p>
                    <p className="text-lg font-bold text-slate-700 mt-0.5">₹3,000</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-blue-600 text-white flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-100">Verified Available Business Funds</p>
                    <p className="text-xl font-bold">₹7,000</p>
                  </div>
                  <Scale className="w-6 h-6 text-blue-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-slate-900">
              Built around real micro-enterprise realities
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Designed for clarity without complex accounting jargon—every calculation is
              transparent, verifiable, and grounded in your actual records.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Scale,
                title: 'Household vs Business Separation',
                desc: 'Keep home withdrawals, personal contributions, and account transfers strictly separate from business expenses and revenue.',
              },
              {
                icon: Mic,
                title: 'Kannada & English Voice Entry',
                desc: 'Speak naturally about sales and costs. Review extracted amounts and confirm before any ledger balance changes.',
              },
              {
                icon: Activity,
                title: 'Explainable Health Engine',
                desc: 'See whether your business is Healthy, Needs attention, or Financially stressed—with exact rupee reasons.',
              },
              {
                icon: LineChart,
                title: '7 / 30 / 90-Day Cash Forecasts',
                desc: 'Moving-average & exponential smoothing forecasts blended with customer due dates, supplier bills, and EMIs.',
              },
              {
                icon: Landmark,
                title: 'Verified Govt Scheme Matcher',
                desc: 'Check MUDRA, PMEGP, PMFME, DAY-NRLM, Udyogini, KSFC, and CGTMSE with clear eligibility rules and checklists.',
              },
              {
                icon: Sparkles,
                title: 'Grounded AI Financial Assistant',
                desc: 'Ask affordability, margin, or receivable questions backed strictly by your SQLite ledger and deterministic formulas.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="card-surface p-6 space-y-3 hover:border-blue-200 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-500">
        Shakti Finance — Empowering Women Entrepreneurs with Transparent Financial Intelligence
      </footer>
    </div>
  );
};

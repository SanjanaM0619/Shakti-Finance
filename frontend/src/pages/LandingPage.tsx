import React from 'react';
import { Link } from 'react-router-dom';
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
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

export const LandingPage: React.FC = () => {
  const { user, language, setLanguage } = useAuth();

  const capabilities = [
    { icon: Scale, title: t(language, 'cap1Title'), desc: t(language, 'cap1Desc') },
    { icon: Mic, title: t(language, 'cap2Title'), desc: t(language, 'cap2Desc') },
    { icon: Activity, title: t(language, 'cap3Title'), desc: t(language, 'cap3Desc') },
    { icon: LineChart, title: t(language, 'cap4Title'), desc: t(language, 'cap4Desc') },
    { icon: Landmark, title: t(language, 'cap5Title'), desc: t(language, 'cap5Desc') },
    { icon: Sparkles, title: t(language, 'cap6Title'), desc: t(language, 'cap6Desc') },
  ];

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
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                {t(language, 'brand')}
              </span>
              {language === 'en' && (
                <span className="hidden sm:inline-block ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  ಶಕ್ತಿ ಫೈನಾನ್ಸ್
                </span>
              )}
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
                {t(language, 'openDashboard')} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/auth" className="btn-secondary">
                  {t(language, 'signIn')}
                </Link>
                <Link to="/auth?mode=register" className="btn-primary">
                  {t(language, 'createFreeAccount')}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="bg-gradient-to-b from-blue-50/70 via-white to-white border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t(language, 'heroBadge')}
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-[1.15]">
              {t(language, 'heroTitlePrefix')}{' '}
              <span className="text-blue-600">{t(language, 'heroTitleHighlight')}</span>
              {t(language, 'heroTitleSuffix')}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {t(language, 'heroDesc')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link to="/auth?mode=register" className="btn-primary px-6 py-3 text-base">
                {t(language, 'createFreeAccount')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/auth" className="btn-secondary px-6 py-3 text-base">
                {t(language, 'signIn')}
              </Link>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-slate-900">{t(language, 'realitiesTitle')}</h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">{t(language, 'realitiesDesc')}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="card-surface p-6 space-y-3 hover:border-blue-200 transition-colors"
                >
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
        {t(language, 'footerText')}
      </footer>
    </div>
  );
};

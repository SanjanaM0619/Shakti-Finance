import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Users,
  Truck,
  Mic,
  Activity,
  LineChart,
  PiggyBank,
  MessageSquare,
  Landmark,
  ClipboardCheck,
  FileText,
  BookOpen,
  Calculator,
  Bell,
  Settings,
  Scale,
  Menu,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

export const AppShell: React.FC = () => {
  const {
    user,
    businessProfile,
    language,
    setLanguage,
    isOnline,
    offlineQueue,
    unreadNotifications,
    syncOfflineQueue,
    logout,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const navigate = useNavigate();

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { to: '/dashboard', label: t(language, 'dashboard'), icon: LayoutDashboard },
        { to: '/voice', label: t(language, 'voice'), icon: Mic },
      ],
    },
    {
      label: 'Bookkeeping & Separation',
      items: [
        { to: '/sales', label: t(language, 'sales'), icon: TrendingUp },
        { to: '/expenses', label: t(language, 'expenses'), icon: Receipt },
        { to: '/separation', label: t(language, 'separation'), icon: Scale },
        { to: '/customers', label: t(language, 'customers'), icon: Users },
        { to: '/suppliers', label: t(language, 'suppliers'), icon: Truck },
      ],
    },
    {
      label: 'Intelligence & Planning',
      items: [
        { to: '/health', label: t(language, 'health'), icon: Activity },
        { to: '/forecast', label: t(language, 'forecast'), icon: LineChart },
        { to: '/surplus', label: t(language, 'surplus'), icon: PiggyBank },
        { to: '/pricing', label: t(language, 'pricing'), icon: Calculator },
        { to: '/assistant', label: t(language, 'assistant'), icon: MessageSquare },
      ],
    },
    {
      label: 'Govt Schemes & Growth',
      items: [
        { to: '/schemes', label: t(language, 'schemes'), icon: Landmark },
        { to: '/applications', label: t(language, 'applications'), icon: ClipboardCheck },
        { to: '/readiness-report', label: t(language, 'readiness'), icon: FileText },
        { to: '/literacy', label: t(language, 'literacy'), icon: BookOpen },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/notifications', label: t(language, 'notifications'), icon: Bell, badge: unreadNotifications },
        { to: '/settings', label: t(language, 'settings'), icon: Settings },
      ],
    },
  ];

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      setSyncBanner(
        `Synced ${res.syncedCount} offline record(s). Skipped ${res.duplicateCount} duplicate(s). Conflicts: ${res.conflictCount}.`
      );
      setTimeout(() => setSyncBanner(null), 5000);
    } catch (err: any) {
      setSyncBanner(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const renderNavLinks = (onClick?: () => void) => (
    <div className="space-y-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onClick}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && item.badge > 0 ? (
                      <span className="ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-blue-600 text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
            S
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-base leading-tight truncate">
              {t(language, 'brand')}
            </div>
            <div className="text-[11px] text-blue-600 font-medium truncate">
              {businessProfile?.business_name || t(language, 'tagline')}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary Navigation">
          {renderNavLinks()}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.is_demo ? 'Demo Enterprise Mode' : user?.mobile}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/');
              }}
              title="Sign out"
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 border-r border-slate-200">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-blue-700">{t(language, 'brand')}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">{renderNavLinks(() => setMobileOpen(false))}</nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {user?.is_demo ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Sample Demo Mode
              </span>
            ) : null}

            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-white text-slate-600 border-slate-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="hidden sm:inline">
                {isOnline ? t(language, 'onlineMode') : t(language, 'offlineMode')}
              </span>
            </div>

            {offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={!isOnline || syncing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {t(language, 'syncNow')} ({offlineQueue.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'kn' : 'en')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors cursor-pointer"
              title="Switch language between English and Kannada"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              {language === 'en' ? 'ಕನ್ನಡ' : 'English'}
            </button>

            <NavLink
              to="/voice"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              {t(language, 'voice')}
            </NavLink>

            <NavLink
              to="/notifications"
              className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </NavLink>
          </div>
        </header>

        {syncBanner && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-xs text-blue-800 font-medium">
            {syncBanner}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

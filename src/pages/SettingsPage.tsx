import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { apiFetch, getLastSyncReport } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user, language, setLanguage, offlineQueue, syncOfflineQueue, isOnline, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [location, setLocation] = useState(user?.location || '');
  const [consentNotif, setConsentNotif] = useState(Boolean(user?.consent_notifications));
  const [consentScheme, setConsentScheme] = useState(Boolean(user?.consent_scheme_matching));
  const [msg, setMsg] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        user: {
          name,
          email,
          location,
          preferred_language: language,
          consent_notifications: consentNotif,
          consent_scheme_matching: consentScheme,
        },
      }),
    });
    await refreshProfile();
    setMsg('User preferences & consent settings updated.');
  };

  const handleSync = async () => {
    const res = await syncOfflineQueue();
    setSyncResult(
      `Synced: ${res.syncedCount} | Duplicates skipped: ${res.duplicateCount} | Conflicts preserved safely: ${res.conflictCount}`
    );
  };

  const lastSync = getLastSyncReport().lastSync;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Profile & Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage personal preferences, language, privacy consents, and offline synchronization status.
          </p>
        </div>
        <Link to="/onboarding" className="btn-secondary text-xs">
          Edit Business Profile
        </Link>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {msg}
        </div>
      )}

      <section className="card-surface p-6 space-y-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" /> Personal & Language Settings
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Mobile Number</label>
              <input type="text" disabled value={user?.mobile || ''} className="input-field bg-slate-50" />
            </div>
            <div>
              <label className="label-text">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            <div className="sm:col-span-2">
              <label className="label-text">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Privacy & Notification Consent
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentNotif}
                onChange={(e) => setConsentNotif(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Enable in-app reminders for overdue receivables, supplier bills & cash warnings.
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentScheme}
                onChange={(e) => setConsentScheme(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Allow consented optional eligibility details for government scheme matching.
            </label>
          </div>

          <button type="submit" className="btn-primary">Save Preferences</button>
        </form>
      </section>

      <section className="card-surface p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Offline-First Synchronization Queue</h2>
            <p className="text-xs text-slate-500">
              Pending offline entries: <strong>{offlineQueue.length}</strong> • Last sync:{' '}
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never needed'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={!isOnline || offlineQueue.length === 0}
            className="btn-secondary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync Now
          </button>
        </div>
        {syncResult && (
          <p className="text-xs text-blue-800 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
            {syncResult}
          </p>
        )}
      </section>
    </div>
  );
};

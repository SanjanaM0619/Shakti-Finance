import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  apiFetch,
  clearSyncedFromQueue,
  enqueueOfflineTransaction,
  getOfflineQueue,
  getStoredToken,
  OfflineTransactionDraft,
  setStoredToken,
} from '../lib/api';
import { BusinessProfile, Language, SchemeExtra, User } from '../types';

interface AuthContextValue {
  user: User | null;
  businessProfile: BusinessProfile | null;
  schemeExtra: SchemeExtra | null;
  loading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  isOnline: boolean;
  offlineQueue: OfflineTransactionDraft[];
  unreadNotifications: number;
  refreshNotificationsCount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginWithPayload: (payload: {
    token: string;
    user: User;
    businessProfile: BusinessProfile | null;
    schemeExtra: SchemeExtra | null;
  }) => void;
  logout: () => void;
  queueOfflineTx: (draft: Omit<OfflineTransactionDraft, 'client_tx_id' | 'queued_at'>) => OfflineTransactionDraft;
  syncOfflineQueue: () => Promise<{ syncedCount: number; duplicateCount: number; conflictCount: number; conflicts: any[] }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [schemeExtra, setSchemeExtra] = useState<SchemeExtra | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<Language>('en');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineTransactionDraft[]>(getOfflineQueue());
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshNotificationsCount = useCallback(async () => {
    if (!getStoredToken() || !navigator.onLine) return;
    try {
      const data = await apiFetch<{ unreadCount: number }>('/api/intel/notifications');
      setUnreadNotifications(data.unreadCount || 0);
    } catch {
      // ignore transient network errors
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{
        user: User;
        businessProfile: BusinessProfile | null;
        schemeExtra: SchemeExtra | null;
      }>('/api/auth/me');
      setUser(data.user);
      setBusinessProfile(data.businessProfile);
      setSchemeExtra(data.schemeExtra);
      setLanguageState(data.user.preferred_language || 'en');
      refreshNotificationsCount();
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotificationsCount]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, duplicateCount: 0, conflictCount: 0, conflicts: [] };
    }
    const result = await apiFetch<{
      syncedCount: number;
      duplicateCount: number;
      conflictCount: number;
      synced: any[];
      skippedDuplicates: any[];
      conflicts: any[];
    }>('/api/finance/transactions/sync', {
      method: 'POST',
      body: JSON.stringify({ items: queue }),
    });

    const syncedIds = [
      ...result.synced.map((s) => s.client_tx_id),
      ...result.skippedDuplicates.map((d) => d.client_tx_id),
    ].filter(Boolean);

    const remaining = clearSyncedFromQueue(syncedIds);
    setOfflineQueue(remaining);
    return result;
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      if (getStoredToken() && getOfflineQueue().length > 0) {
        syncOfflineQueue().catch(() => {});
      }
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncOfflineQueue]);

  const loginWithPayload = (payload: {
    token: string;
    user: User;
    businessProfile: BusinessProfile | null;
    schemeExtra: SchemeExtra | null;
  }) => {
    setStoredToken(payload.token);
    setUser(payload.user);
    setBusinessProfile(payload.businessProfile);
    setSchemeExtra(payload.schemeExtra);
    setLanguageState(payload.user.preferred_language || 'en');
    refreshNotificationsCount();
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setBusinessProfile(null);
    setSchemeExtra(null);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (user && navigator.onLine) {
      apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ user: { preferred_language: lang } }),
      }).catch(() => {});
    }
  };

  const queueOfflineTx = (draft: Omit<OfflineTransactionDraft, 'client_tx_id' | 'queued_at'>) => {
    const added = enqueueOfflineTransaction(draft);
    setOfflineQueue(getOfflineQueue());
    return added;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        businessProfile,
        schemeExtra,
        loading,
        language,
        setLanguage,
        isOnline,
        offlineQueue,
        unreadNotifications,
        refreshNotificationsCount,
        refreshProfile,
        loginWithPayload,
        logout,
        queueOfflineTx,
        syncOfflineQueue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

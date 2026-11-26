import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, AlertTriangle, Info } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';

export const NotificationsPage: React.FC = () => {
  const { refreshNotificationsCount } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    const res = await apiFetch<{ notifications: AppNotification[] }>('/api/intel/notifications');
    setNotifications(res.notifications);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const markRead = async (id: string) => {
    await apiFetch(`/api/intel/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
    await load();
    await refreshNotificationsCount();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications & Reminders</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          In-app alerts generated from overdue customer receivables, supplier bills, cash-flow warnings, and scheme deadlines.
        </p>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-slate-500">
            <Bell className="w-7 h-7 text-blue-600 mx-auto mb-2" />
            All clear! No pending financial reminders right now.
          </div>
        ) : (
          notifications.map((n) => (
            <article
              key={n.id}
              className={`card-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                n.is_read ? 'opacity-65' : 'border-blue-200 bg-blue-50/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    n.severity === 'high'
                      ? 'bg-rose-50 text-rose-600'
                      : n.severity === 'medium'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {n.severity === 'info' ? (
                    <Info className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{n.title}</h2>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link to={n.action_url} className="btn-secondary text-xs py-1.5 px-3">
                  Open
                </Link>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Read
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

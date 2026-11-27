const TOKEN_KEY = 'shakti_finance_token';
const OFFLINE_QUEUE_KEY = 'shakti_finance_offline_queue';
const LAST_SYNC_KEY = 'shakti_finance_last_sync';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface OfflineTransactionDraft {
  client_tx_id: string;
  queued_at: string;
  tx_date: string;
  entry_kind: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  payment_method: string;
  notes?: string;
}

export function getOfflineQueue(): OfflineTransactionDraft[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineTransaction(draft: Omit<OfflineTransactionDraft, 'client_tx_id' | 'queued_at'>) {
  const queue = getOfflineQueue();
  const item: OfflineTransactionDraft = {
    ...draft,
    client_tx_id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queued_at: new Date().toISOString(),
  };
  queue.push(item);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export function clearSyncedFromQueue(syncedClientIds: string[]) {
  const set = new Set(syncedClientIds);
  const next = getOfflineQueue().filter((q) => !set.has(q.client_tx_id));
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return next;
}

export function getLastSyncReport(): { lastSync: string | null } {
  return { lastSync: localStorage.getItem(LAST_SYNC_KEY) };
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  const sign = num < 0 ? '-' : '';
  return `${sign}₹${Math.abs(Math.round(num)).toLocaleString('en-IN')}`;
}

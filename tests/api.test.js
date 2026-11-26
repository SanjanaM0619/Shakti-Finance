import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const apiDbPath = path.join(os.tmpdir(), `shakti_api_${Date.now()}.sqlite`);
process.env.SHAKTI_DB_PATH = apiDbPath;
process.env.NODE_ENV = 'test';

const { default: app } = await import('../server/index.js');
const { db } = await import('../server/db.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  db.close();
  if (fs.existsSync(apiDbPath)) fs.unlinkSync(apiDbPath);
});

async function req(urlPath, options = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, options);
  const body = await res.json();
  return { status: res.status, body };
}

test('Full end-to-end API workflow: demo login, bookkeeping, offline sync, AI assistant, schemes, readiness report', async () => {
  // 1. Health check
  const health = await req('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  // 2. Demo login
  const demo = await req('/api/auth/demo-login', { method: 'POST' });
  assert.equal(demo.status, 200);
  assert.ok(demo.body.token);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${demo.body.token}`,
  };

  // 3. Summary & Health
  const summary = await req('/api/finance/summary', { headers: authHeaders });
  assert.equal(summary.status, 200);
  assert.ok(summary.body.totalRevenue > 0);
  assert.ok(summary.body.availableCash > 0);
  assert.ok(['Healthy', 'Needs attention', 'Financially stressed'].includes(summary.body.health.status));

  // 4. Offline Sync with duplicate & conflict protection
  const clientId = `off-${Date.now()}`;
  const sync1 = await req('/api/finance/transactions/sync', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      items: [
        {
          client_tx_id: clientId,
          tx_date: '2026-11-25',
          entry_kind: 'sale',
          item_name: 'Offline Test Snack Sale',
          category: 'Snacks',
          quantity: 10,
          unit_price: 80,
          amount: 800,
          payment_method: 'cash',
        },
      ],
    }),
  });
  assert.equal(sync1.status, 200);
  assert.equal(sync1.body.syncedCount, 1);

  // Re-send exact duplicate -> skipped safely
  const sync2 = await req('/api/finance/transactions/sync', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      items: [
        {
          client_tx_id: clientId,
          tx_date: '2026-11-25',
          entry_kind: 'sale',
          item_name: 'Offline Test Snack Sale',
          category: 'Snacks',
          quantity: 10,
          unit_price: 80,
          amount: 800,
          payment_method: 'cash',
        },
      ],
    }),
  });
  assert.equal(sync2.body.duplicateCount, 1);
  assert.equal(sync2.body.syncedCount, 0);

  // Re-send modified payload with same ID -> preserved as conflict, never silently overwritten
  const sync3 = await req('/api/finance/transactions/sync', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      items: [
        {
          client_tx_id: clientId,
          tx_date: '2026-11-25',
          entry_kind: 'sale',
          item_name: 'Offline Test Snack Sale',
          category: 'Snacks',
          quantity: 10,
          unit_price: 90,
          amount: 900,
          payment_method: 'cash',
        },
      ],
    }),
  });
  assert.equal(sync3.body.conflictCount, 1);

  // 5. Voice parse, AI Assistant, Schemes, Readiness Report, Notifications
  const voice = await req('/api/intel/voice/parse', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ transcript: 'Sold 10 packets for 900 rupees via UPI', language: 'en' }),
  });
  assert.equal(voice.status, 200);
  assert.equal(voice.body.transactions[0].amount, 900);
  assert.equal(voice.body.transactions[0].payment_method, 'upi');

  const ask = await req('/api/intel/assistant/ask', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ question: 'Which customers have not paid me?' }),
  });
  assert.equal(ask.status, 200);
  assert.ok(ask.body.answer.length > 20);

  const schemes = await req('/api/intel/schemes', { headers: authHeaders });
  assert.equal(schemes.status, 200);
  assert.ok(schemes.body.schemes.length >= 8);

  const readiness = await req('/api/finance/readiness-report', { headers: authHeaders });
  assert.equal(readiness.status, 200);
  assert.ok(readiness.body.disclaimer.includes('NOT an official credit score'));

  const notifs = await req('/api/intel/notifications', { headers: authHeaders });
  assert.equal(notifs.status, 200);
  assert.ok(Array.isArray(notifs.body.notifications));
});

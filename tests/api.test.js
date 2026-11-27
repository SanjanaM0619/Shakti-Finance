import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;

const { initApp } = await import('../backend/index.js');
const { disconnectDatabase } = await import('../database/connection.js');

let server;
let baseUrl;

test.before(async () => {
  const app = await initApp();
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
  await disconnectDatabase();
});

async function req(urlPath, options = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, options);
  const body = await res.json();
  return { status: res.status, body };
}

test('Full MERN API workflow: health, demo login, offline sync, AI assistant, schemes, readiness report', async () => {
  const health = await req('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.database.readyState, 1);

  const demo = await req('/api/auth/demo-login', { method: 'POST' });
  assert.equal(demo.status, 200);
  assert.ok(demo.body.token);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${demo.body.token}`,
  };

  const summary = await req('/api/finance/summary', { headers: authHeaders });
  assert.equal(summary.status, 200);
  assert.ok(summary.body.totalRevenue > 0);
  assert.ok(summary.body.availableCash > 0);
  assert.ok(['Healthy', 'Needs attention', 'Financially stressed'].includes(summary.body.health.status));

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
  assert.ok(schemes.body.schemes.length >= 12);

  const checklistSave = await req('/api/intel/schemes/pmfme/application', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'preparing',
      checklist_progress: { 0: true, 1: true },
      notes: 'Prepared Aadhaar and FSSAI undertaking',
      deadline_date: '2026-12-15',
    }),
  });
  assert.equal(checklistSave.status, 200);
  assert.equal(checklistSave.body.application.status, 'preparing');

  const voiceCfg = await req('/api/intel/voice/config', { headers: authHeaders });
  assert.equal(voiceCfg.status, 200);
  assert.deepEqual(voiceCfg.body.supportedLanguages, ['en', 'kn']);

  const readiness = await req('/api/finance/readiness-report', { headers: authHeaders });
  assert.equal(readiness.status, 200);
  assert.ok(readiness.body.disclaimer.includes('NOT an official credit score'));

  const notifs = await req('/api/intel/notifications', { headers: authHeaders });
  assert.equal(notifs.status, 200);
  assert.ok(Array.isArray(notifs.body.notifications));
});

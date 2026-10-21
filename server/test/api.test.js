const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-cut-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');

const { app } = require('../server');
const { initDB } = require('../database');

let server;
let baseUrl;

const api = async (route, options = {}) => {
  const res = await fetch(`${baseUrl}${route}`, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

before(async () => {
  await initDB();
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GET /api/health returns ok', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /api/products returns the seeded menu', async () => {
  const res = await api('/api/products');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every(p => typeof p.name === 'string' && typeof p.price === 'number'));
});

test('owner login rejects a wrong PIN', async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' })
  });
  assert.equal(res.status, 400);
});

test('owner login returns a token for the correct PIN', async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: process.env.OWNER_PIN || '1234' })
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('GET /api/orders requires owner auth', async () => {
  const res = await api('/api/orders');
  assert.equal(res.status, 401);
});

test('GET /api/orders returns the queue for an authenticated owner', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: process.env.OWNER_PIN || '1234' })
  });

  const res = await api('/api/orders', {
    headers: { Authorization: `Bearer ${login.body.token}` }
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('a customer can register, order and track an order', async () => {
  const register = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass' })
  });
  assert.equal(register.status, 200);
  assert.ok(register.body.token);

  const products = await api('/api/products');
  const product = products.body[0];

  const created = await api('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${register.body.token}`
    },
    body: JSON.stringify({ items: [{ productId: product.id, qty: 2 }] })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.total, product.price * 2);
  assert.equal(created.body.items.length, 1);
  assert.equal(created.body.status, 'waiting');

  const tracked = await api(`/api/orders/${created.body.id}`);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.body.id, created.body.id);
});

test('owner can update an order status', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: process.env.OWNER_PIN || '1234' })
  });

  const list = await api('/api/orders', {
    headers: { Authorization: `Bearer ${login.body.token}` }
  });
  const order = list.body[0];

  const updated = await api(`/api/orders/${order.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.body.token}`
    },
    body: JSON.stringify({ status: 'preparing' })
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'preparing');
});

test('queue stats reflect active orders', async () => {
  const res = await api('/api/queue/stats');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.waiting, 'number');
  assert.equal(typeof res.body.done, 'number');
});

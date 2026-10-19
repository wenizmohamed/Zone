import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const sessionSource = readFileSync(resolve(root, 'player-session.js'), 'utf8');

function client(fetchImpl, { storage = new Map(), now = Date.now() } = {}) {
  let clock = now;
  const calls = [], dataset = {};
  const window = { fetch: async (path, options) => {
    calls.push({ path: String(path), method: options?.method || 'GET', options });
    return fetchImpl(String(path), options);
  } };
  const context = createContext({ window, URL, URLSearchParams,
    location: new URL('http://zone.test/'),
    Date: class extends Date { static now() { return clock; } },
    document: { documentElement: { dataset } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  runInContext(sessionSource, context);
  return { window, calls, dataset, storage, advance(ms) { clock += ms; } };
}

test('a cold session 401 exposes Account recovery and does not repeat session creation', async () => {
  const storage = new Map([['zone.player.id', 'player-original'], ['zone.v2.save', 'saved presentation']]);
  const app = client(async () => ({ ok: false, status: 401, json: async () => ({ error: 'Player session expired.' }) }), { storage });
  await assert.rejects(app.window.fetch('/api/v1/gameplay'), /Player session expired/);
  assert.equal(app.window.ZoneSession.expired(), true, 'The existing EN/AR recovery UI uses this exact flag.');
  assert.equal(app.dataset.zonePlayerAccess, 'expired');
  await assert.rejects(app.window.fetch('/api/v1/jobs/work', { method: 'POST', body: '{}' }), /Player session expired/);
  assert.equal(app.calls.length, 1, 'The server rejection must not be followed by a replacement or gameplay write.');
  assert.equal(storage.get('zone.v2.save'), 'saved presentation');
});

test('expiry discovered by Recover uses the account read on its first attempt', async () => {
  const app = client(async path => path === '/api/v1/auth/session'
    ? { ok: true, status: 200, json: async () => ({ playerId: 'player-original', mode: 'persistent-browser', expiresAt: 2 }) }
    : { ok: true, status: 200, json: async () => ({ authenticated: false, claimed: false }) }, { now: 1000 });
  await app.window.ZoneSession.ensure();
  app.advance(1000);
  await assert.rejects(app.window.ZoneSession.recover(), /Player session expired/);
  assert.deepEqual(app.calls.map(call => call.path), ['/api/v1/auth/session', '/api/v1/auth/account']);
  assert.equal(app.window.ZoneSession.expired(), true);
  assert.equal(app.window.ZoneSession.current().playerId, 'player-original');
});

test('unavailable, anonymous and malformed account reads cannot authorize a replacement session', async () => {
  for (const response of [
    { ok: false, status: 503, json: async () => ({ playerId: 'player-original' }) },
    { ok: true, status: 200, json: async () => ({ authenticated: false, claimed: false }) },
    { ok: true, status: 200, json: async () => ({ playerId: '' }) },
    { ok: true, status: 200, json: async () => ({ playerId: 'not a player id', authenticated: true }) },
    { ok: true, status: 200, json: async () => null },
  ]) {
    const app = client(async path => path === '/api/v1/auth/session'
      ? { ok: true, status: 200, json: async () => ({ playerId: 'player-original', mode: 'persistent-browser' }) }
      : path === '/api/v1/auth/account' ? response : { ok: false, status: 401, json: async () => ({ error: 'Player session expired.' }) });
    await app.window.ZoneSession.ensure();
    assert.equal((await app.window.fetch('/api/v1/gameplay')).status, 401);
    await assert.rejects(app.window.ZoneSession.recover(), /Player session expired/);
    assert.equal(app.calls.filter(call => call.path === '/api/v1/auth/session').length, 1);
    assert.equal(app.window.ZoneSession.current().playerId, 'player-original');
    assert.equal(app.window.ZoneSession.expired(), true);
  }
});

test('a valid account hint never enables gameplay before auth/session verifies the current cookie', async () => {
  let sessions = 0;
  const app = client(async path => path === '/api/v1/auth/account'
    ? { ok: true, status: 200, json: async () => ({ playerId: 'player-original', claimed: true }) }
    : path === '/api/v1/auth/session' && ++sessions === 1
      ? { ok: true, status: 200, json: async () => ({ playerId: 'player-original', mode: 'persistent-browser' }) }
      : { ok: false, status: 401, json: async () => ({ error: 'Player session expired.' }) });
  await app.window.ZoneSession.ensure();
  assert.equal((await app.window.fetch('/api/v1/gameplay')).status, 401);
  await assert.rejects(app.window.ZoneSession.recover(), /Player session expired/);
  assert.equal(app.window.ZoneSession.expired(), true);
  const before = app.calls.length;
  await assert.rejects(app.window.fetch('/api/v1/bank/deposit', { method: 'POST', body: '{"amount":100}' }), /Player session expired/);
  assert.equal(app.calls.length, before, 'An account status is not a gameplay authorization or permission to resend an action.');
});

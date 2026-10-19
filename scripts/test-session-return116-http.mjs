import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
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

// Explicit local HTTP release gate. A missing PHP runtime fails, never skips.

test('real ordinary-player HTTP return recovers the same saved character from the actual account payload', { timeout: 30000 }, async t => {
  const fixture = resolve(root, '.tools/session-return116', randomUUID());
  mkdirSync(fixture, { recursive: true });
  const database = resolve(fixture, 'ordinary.sqlite');
  const php = [resolve(root, '.tools/php-8.5.10/php.exe'), resolve(root, '../php-8.5.10/php.exe'), process.env.ZONE_TEST_PHP].find(path => path && existsSync(path));
  assert.ok(php, 'The existing bundled PHP runtime is required.');
  const probe = createServer();
  await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const base = 'http://127.0.0.1:' + port;
  const log = openSync(resolve(fixture, 'php.log'), 'a');
  const child = spawn(php, ['-d', 'opcache.enable=0', '-S', '127.0.0.1:' + port, '-t', root, resolve(root, 'engine/router.php')], {
    cwd: root, windowsHide: true, shell: false, stdio: ['ignore', log, log],
    env: { ...process.env, ZONE_DATABASE_URL: 'sqlite:' + database, DATABASE_URL: '', POSTGRES_URL: '',
      VERCEL: '1', ZONE_PLAYER_SESSIONS: '1', ZONE_PLAYER_AUTH: '', ZONE_ENGINE_ORIGIN: '', ZONE_ENGINE_RELAY_KEY: '',
      ZONE_ADMIN_TOKEN: randomUUID() + randomUUID(), ZONE_BETA_OWNER_ACCESS: '0', ZONE_CACHE_DRIVER: 'array',
      ZONE_ADMIN_USERNAME: '', ZONE_ADMIN_PASSWORD_HASH: '', ZONE_ADMIN_SESSION_SECRET: '',
      REDIS_URL: '', ZONE_REDIS_URL: '', ZONE_ASSET_ROOT: resolve(fixture, 'assets') },
  });
  closeSync(log);
  t.after(async () => {
    if (child.exitCode === null) await new Promise(done => { child.once('exit', done); child.kill(); });
  });
  const api = async (path, options = {}, jar = {}) => {
    const url = new URL(path, 'http://zone.test');
    assert.equal(url.origin, 'http://zone.test', 'All test requests remain on the owned loopback server.');
    const response = await fetch(base + url.pathname + url.search, { ...options,
      headers: { ...options.headers, Accept: 'application/json', Origin: 'https://127.0.0.1:' + port,
        'X-Forwarded-Proto': 'https', ...(jar.cookie ? { Cookie: jar.cookie } : {}) } });
    for (const value of response.headers.getSetCookie()) if (value.startsWith('zone_player_session=')) jar.cookie = value.split(';')[0];
    return response;
  };
  let health;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('Owned HTTP helper exited before readiness.');
    try { const response = await api('/api/v1/health'); if (response.ok) { health = await response.json(); break; } } catch {}
    await new Promise(done => setTimeout(done, 50));
  }
  assert.equal(health?.engine?.database, 'sqlite');
  assert.equal(readFileSync(database).subarray(0, 16).toString(), 'SQLite format 3\0');
  const jar = {};
  const opening = client((path, options) => api(path, options, jar));
  const initial = await (await opening.window.fetch('/api/v1/gameplay')).json();
  const playerId = initial.player.id, cash = initial.player.cash, priorCookie = jar.cookie;
  assert.match(playerId, /^player-/); assert.equal(cash, 2500);
  assert.doesNotMatch(playerId, /owner-playtest|founder/);
  const username = 'Return_' + randomUUID().replaceAll('-', '').slice(0, 12);
  const password = 'private ordinary account regression password';
  const claim = await api('/api/v1/auth/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }, jar);
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).playerId, playerId);
  jar.cookie = priorCookie;

  await t.test('cold revoked-cookie return marks expired without forwarding gameplay', async () => {
    const storage = new Map([['zone.player.id', playerId], ['zone.v2.save', 'known saved presentation']]);
    const returned = client((path, options) => api(path, options, jar), { storage });
    await assert.rejects(returned.window.fetch('/api/v1/gameplay'), /Player session expired/);
    assert.equal(returned.window.ZoneSession.expired(), true);
    assert.equal(returned.calls.length, 1);
    assert.equal(returned.calls[0].path, '/api/v1/auth/session');
    assert.equal(storage.get('zone.v2.save'), 'known saved presentation');
  });

  assert.equal((await opening.window.fetch('/api/v1/gameplay')).status, 401);
  assert.equal(opening.window.ZoneSession.expired(), true);
  const login = await api('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }, jar);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).playerId, playerId);
  const account = await (await api('/api/v1/auth/account', {}, jar)).json();
  assert.equal(account.playerId, playerId);
  assert.equal(account.claimed, true);
  assert.equal(Object.hasOwn(account, 'authenticated'), false, 'Use the actual successful account schema, not an invented boolean.');

  await t.test('existing game page resumes after actual account sign-in without a new character or replay', async () => {
    const before = opening.calls.length;
    const recovered = await opening.window.ZoneSession.recover();
    assert.equal(recovered.playerId, playerId);
    assert.equal(opening.window.ZoneSession.expired(), false);
    assert.deepEqual(opening.calls.slice(before).map(call => call.path), ['/api/v1/auth/account', '/api/v1/auth/session']);
    const after = await (await opening.window.fetch('/api/v1/gameplay')).json();
    assert.equal(after.player.id, playerId);
    assert.equal(after.player.cash, cash);
    assert.deepEqual(after.state.inv, initial.state.inv);
    for (const stat of ['strength', 'defense', 'speed', 'dexterity']) {
      assert.equal(Number.isFinite(initial.player[stat]), true, 'The real authoritative stat is present: ' + stat);
      assert.equal(after.player[stat], initial.player[stat]);
    }
    assert.equal(opening.calls.some(call => call.method === 'POST' && call.path !== '/api/v1/auth/session'), false);
    console.log('SESSION RETURN 116: isolated SQLite, same player/wallet/inventory/stats, 0 gameplay writes and 0 owner grants.');
  });
});

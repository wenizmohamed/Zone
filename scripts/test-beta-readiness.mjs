import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];

function visitor({ cache, identity, preview = false, storageBlocked = false } = {}) {
  let clock = 1800000;
  const storage = new Map();
  if (cache) storage.set('zone.v2.save', JSON.stringify(cache));
  if (identity) storage.set('zone.player.id', identity);
  const location = new URL('http://zone.test/' + (preview ? '?zone-preview=1' : ''));
  const context = createContext({
    console, URL, URLSearchParams,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } },
    localStorage: { getItem: key => { if (storageBlocked) throw new Error('Storage access blocked'); return storage.get(key) || null; }, setItem: (key, value) => { if (storageBlocked) throw new Error('Storage quota exceeded'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById: () => null },
    window: { location, ZonePlatform: { preview, active: () => ({ version: 1, manifest: {} }), data: () => ({}) }, addEventListener() {}, removeEventListener() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    React: { createElement: () => ({}) },
    DCLogic: class { constructor(props) { this.props = props; } setState(value) { Object.assign(this.state, value); } forceUpdate() {} },
    fetch: async () => { throw new Error('Network unavailable'); },
  });
  runInContext(readFileSync(resolve(root, 'assets/weapons/catalog.js'), 'utf8'), context);
  runInContext(source + '\nglobalThis.BetaComponent = Component;', context);
  return { client: new context.BetaComponent({}), storage, advance: milliseconds => { clock += milliseconds; } };
}

test('a first visitor waiting offline cannot display regenerated invented resources or save a character', () => {
  const { client, storage, advance } = visitor();
  advance(120000);
  assert.equal(client.p.cash, 0);
  assert.equal(client.p.level, 1);
  assert.deepEqual(Object.keys(client.p.inv), []);
  for (const resource of ['energy', 'nerve', 'happy', 'life']) assert.equal(client.cur(resource), 0, resource);
  assert.equal(client.gameplayDisabled(), true);
  client.save();
  assert.equal(storage.has('zone.v2.save'), false);
});

test('successful server hydration is not turned into a failed action by optional browser cache storage', () => {
  const { client } = visitor({ storageBlocked: true });
  assert.doesNotThrow(() => client.applyGameplay({ player: { id: 'real-player', username: 'Real player', cash: 2500 }, state: { version: 1 } }));
  assert.equal(client.gameplayReady, true);
  assert.equal(client.gameplayError, '');
  assert.equal(client.p.cash, 2500);
});

test('every offline player route has a manual recovery action without enabling game mutations', () => {
  const { client } = visitor();
  client.runtimeConnection = 'offline';
  client.gameplayError = 'Network unavailable';
  for (const lang of ['en', 'ar']) {
    client.state.lang = lang;
    for (const screen of ['home','items','city','jobs','bank','gym','properties','education','crimes','missions','newspaper','jail','hospital','casino','hof','faction','elimination','attack','market']) {
      client.state.screen = screen;
      const view = client.renderVals();
      assert.equal(view.connectionRecovery.visible, true, `${lang}/${screen}`);
      assert.equal(typeof view.connectionRecovery.retry, 'function');
      assert.equal(view.connectionRecovery.disabled, false);
      assert.ok(view.connectionRecovery.label.length > 0);
      if (lang === 'ar') assert.match(view.connectionRecovery.label, /[\u0600-\u06ff]/);
      assert.equal(client.gameplayDisabled(), true);
    }
  }
});

function connectionRuntime(file, { fetchImpl, storageBlocked = false } = {}) {
  const events = [], calls = [], listeners = {}, timers = new Map(), storage = new Map();
  let timerId = 0;
  const nativeFetch = async (input, options) => { calls.push({ input, options }); return fetchImpl?.(input, options) ?? { ok: true, json: async () => ({ playerId: 'real-player', mode: 'persistent-browser' }) }; };
  const window = { fetch: nativeFetch, dispatchEvent: event => events.push(event) };
  const context = createContext({ window, location: new URL('http://zone.test/'), URL, URLSearchParams, AbortController,
    Promise, Error, Date, console, CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    localStorage: { getItem: key => { if (storageBlocked) throw new Error('Storage blocked'); return storage.get(key) || null; }, setItem: (key, value) => { if (storageBlocked) throw new Error('Storage quota exceeded'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, visibilityState: 'visible' },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), setInterval() {},
    fetch: nativeFetch,
  });
  runInContext(readFileSync(resolve(root, file), 'utf8'), context);
  return { window, events, calls, listeners, timers, expire: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } } };
}

test('blocked optional runtime cache cannot prevent an authoritative release from connecting', async () => {
  const remote = { release: { version: 2, manifest: { schemaVersion: 1 } }, content: {} };
  const runtime = connectionRuntime('platform-runtime.js', { storageBlocked: true, fetchImpl: async () => ({ ok: true, json: async () => remote }) });
  await runtime.window.ZonePlatform.refresh();
  assert.equal(runtime.window.ZonePlatform.status(), 'connected');
  assert.equal(runtime.window.ZonePlatform.active().version, 2);
  assert.equal(runtime.events.at(-1).detail.connection, 'connected');
});

test('a hung bootstrap read expires, releases its loading lock and can be retried explicitly', { timeout: 1000 }, async () => {
  let hanging = true;
  const runtime = connectionRuntime('platform-runtime.js', { fetchImpl: async () => hanging ? new Promise(() => {}) : { ok: true, json: async () => ({ release: { version: 3, manifest: { schemaVersion: 1 } }, content: {} }) } });
  const read = runtime.window.ZonePlatform.refresh();
  const rejected = assert.rejects(read, /timed out/i);
  runtime.expire();
  await rejected;
  assert.equal(runtime.window.ZonePlatform.status(), 'offline');
  hanging = false;
  await runtime.window.ZonePlatform.refresh();
  assert.equal(runtime.window.ZonePlatform.active().version, 3);
  assert.equal(runtime.timers.size, 0);
});

test('stalled read JSON expires without retrying or resending a gameplay mutation', { timeout: 1000 }, async () => {
  const runtime = connectionRuntime('player-session.js', { fetchImpl: async input => input === '/api/v1/auth/session' ? { ok: true, json: async () => ({ playerId: 'real-player', mode: 'persistent-browser' }) } : { ok: true, json: () => new Promise(() => {}) } });
  await runtime.window.ZoneSession.ensure();
  const response = await runtime.window.fetch('/api/v1/gameplay');
  const read = response.json();
  const rejected = assert.rejects(read, /timed out/i);
  runtime.expire();
  await rejected;
  assert.equal(runtime.calls.filter(call => call.input === '/api/v1/gameplay').length, 1);
  assert.equal(runtime.calls.filter(call => call.options?.method === 'POST').length, 1, 'only the established session, no gameplay write');
});

test('browser storage denial does not invalidate the returned server session identity', async () => {
  const runtime = connectionRuntime('player-session.js', { storageBlocked: true });
  await runtime.window.ZoneSession.ensure();
  assert.equal(runtime.window.ZoneSession.current().playerId, 'real-player');
  assert.equal(runtime.calls.length, 1);
  assert.equal(runtime.timers.size, 0);
});

test('gameplay writes retain their exact options and never acquire a read deadline or automatic retry', async () => {
  let finishMutation;
  const runtime = connectionRuntime('player-session.js', { fetchImpl: async input => input === '/api/v1/auth/session' ? { ok: true, json: async () => ({ playerId: 'real-player', mode: 'persistent-browser' }) } : new Promise(resolve => { finishMutation = resolve; }) });
  await runtime.window.ZoneSession.ensure();
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"market.buy","id":"knife","expectedVersion":2}' };
  const action = runtime.window.fetch('/api/v1/gameplay/action', options);
  await new Promise(setImmediate);
  assert.equal(runtime.calls.at(-1).options, options);
  assert.equal(runtime.timers.size, 0);
  runtime.expire();
  finishMutation({ ok: true, json: async () => ({ receipt: 'actual-result' }) });
  assert.equal((await action).ok, true);
  assert.equal(runtime.calls.filter(call => call.input === '/api/v1/gameplay/action').length, 1);
});

test('a successful player read clears its deadline after JSON consumption', async () => {
  const runtime = connectionRuntime('player-session.js');
  await runtime.window.ZoneSession.ensure();
  const response = await runtime.window.fetch('/api/v1/player');
  assert.equal(runtime.timers.size, 1);
  await response.json();
  assert.equal(runtime.timers.size, 0);
});

test('recovery presentation remains a native keyboard button and compact shared brass panel', () => {
  assert.match(html, /<section class="zone-connection-recovery"[^>]*aria-busy="\{\{ connectionRecovery.busy \}\}"/);
  assert.match(html, /<button class="zone-action-primary" onClick="\{\{ connectionRecovery.retry \}\}" disabled="\{\{ connectionRecovery.disabled \}\}">/);
  const css = readFileSync(resolve(root, 'assets/zone-design.css'), 'utf8');
  assert.match(css, /\.zone-connection-recovery[^\n]*border-inline-start:3px solid var\(--gold\)/);
  assert.match(css, /max-width:600px[^\n]*zone-connection-recovery[^\n]*min-height:44px/);
});

test('an old unverified mockup cache cannot become a beta visitors starting character', () => {
  const fixture = visitor({ preview: true }).client.p;
  fixture.lang = 'ar';
  const { client } = visitor({ cache: fixture });
  assert.equal(client.p.cash, 0);
  assert.equal(client.p.level, 1);
  assert.equal(client.p.equip, 'fists');
  assert.deepEqual(Object.keys(client.p.inv), []);
  assert.equal(client.state.lang, 'ar', 'presentation language survives migration');
});

test('server hydration enables genuine resource display and keeps preview fixtures separate', () => {
  const { client, storage, advance } = visitor();
  client.applyServerPlayer({ id: 'player-beta', username: 'Player_BETA', cash: 2500, level: 1, energy: 100, nerve: 25, happy: 100, life: 100, max_energy: 100, max_nerve: 25, max_happy: 100, max_life: 100, resources_updated_at: new Date(1800000).toISOString() });
  advance(120000);
  assert.equal(client.cur('energy'), 100);
  assert.equal(client.p.cash, 2500);
  client.save();
  assert.equal(JSON.parse(storage.get('zone.v2.save')).cash, 2500);
  assert.equal(visitor({ preview: true }).client.p.cash, 48500);
});

test('ZonePlatform.diagnostics reports status, releaseId, releaseVersion, preview, failures and builtinScreenCount', async () => {
  const remote = { release: { id: 'rel-145', version: 145, manifest: { schemaVersion: 1 } }, content: {} };
  const runtime = connectionRuntime('platform-runtime.js', { fetchImpl: async () => ({ ok: true, json: async () => remote }) });
  await runtime.window.ZonePlatform.refresh();
  const diag = runtime.window.ZonePlatform.diagnostics();
  assert.equal(diag.status, 'connected');
  assert.equal(diag.releaseId, 'rel-145');
  assert.equal(diag.releaseVersion, 145);
  assert.equal(diag.preview, false);
  assert.equal(diag.failures, 0);
  assert.equal(diag.builtinScreenCount, 19);
});

test('ZonePlatform exposes builtinScreens, isBuiltinScreen, isConnected, isOffline and isPending helpers', async () => {
  const remote = { release: { id: 'rel-149', version: 149, manifest: { schemaVersion: 1 } }, content: {} };
  const runtime = connectionRuntime('platform-runtime.js', { fetchImpl: async () => ({ ok: true, json: async () => remote }) });
  assert.equal(runtime.window.ZonePlatform.isConnected(), false);
  assert.equal(runtime.window.ZonePlatform.isOffline(), false);
  assert.equal(runtime.window.ZonePlatform.isPending(), false);
  assert.equal(runtime.window.ZonePlatform.builtinScreens().length, 19);
  assert.equal(runtime.window.ZonePlatform.isBuiltinScreen('home'), true);
  assert.equal(runtime.window.ZonePlatform.isBuiltinScreen('unknown'), false);
  await runtime.window.ZonePlatform.refresh();
  assert.equal(runtime.window.ZonePlatform.isConnected(), true);
  assert.equal(runtime.window.ZonePlatform.isOffline(), false);
});

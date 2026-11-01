import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const source = readFileSync(new URL('../owner-playtest.js', import.meta.url), 'utf8');
test('explicit transient owner recovery coalesces reads, resumes the same version and never falls through', async () => {
  const storage = tabStorage(), f = delayedFixture({storage}); await f.begin();
  const read = f.api.refresh(), failed = assert.rejects(read, /upstream/);
  f.take('/api/v1/admin/playtest', 'GET').reject(Object.assign(new Error('upstream unavailable'), {status:503})); await failed;
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /upstream/);
  const recovery = f.api.recover(), duplicate = f.api.recover();
  f.take('/api/v1/admin/session', 'GET').resolve({authenticated:true}); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.api.action('job.work'), /not ready|upstream/);
  f.take('/api/v1/admin/playtest', 'GET').resolve(f.snapshot(1)); await Promise.all([recovery,duplicate]);
  assert.equal(f.api.snapshot().blocked,false); assert.equal(f.api.snapshot().version,1);
  assert.equal(f.api.snapshot().sessionId,knownSession); assert.equal(storage.getItem(latchKey),knownSession);
  assert.equal(f.calls.filter(c=>c.path==='/api/v1/admin/session').length,1);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/action')).length,0);
});
test('revocation and session replacement remain blocked despite explicit recovery', async () => {
  for (const failure of ['auth','changed']) {
    const f=delayedFixture(); await f.begin(); const read=f.api.refresh();
    const rejected=assert.rejects(read); f.take('/api/v1/admin/playtest','GET').reject(Object.assign(new Error('unavailable'),{status:failure==='auth'?401:503})); await rejected;
    const count=f.calls.length, recovery=f.api.recover(), refusal=assert.rejects(recovery);
    if(failure==='changed') {
      f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
      f.take('/api/v1/admin/playtest','GET').resolve(f.snapshot(2,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
    }
    await refusal; assert.equal(f.api.active(),true); assert.equal(f.api.snapshot().sessionId,knownSession);
    assert.equal(Object.hasOwn(f.api.snapshot(),'gameplay'),false);
    if(failure==='auth') assert.equal(f.calls.length,count);
    await assert.rejects(f.api.route('/api/v1/jobs/work',{},'POST'));
  }
});
test('late owner recovery after explicit exit cannot reactivate the selected session', async () => {
  const f=delayedFixture(); await f.begin(); const recovery=f.api.recover();
  f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
  const pending=f.take('/api/v1/admin/playtest','GET'), stopping=f.api.stop();
  f.take('/api/v1/admin/playtest','DELETE').resolve({active:false,mode:'player'}); await stopping;
  pending.resolve(f.snapshot(2)); await recovery; assert.equal(f.api.active(),false);
});

test('only explicit authenticated recovery can unblock a pending shared owner read', async () => {
  const f=delayedFixture(); await f.begin();
  const failed=f.api.refresh(), failure=assert.rejects(failed);
  f.take('/api/v1/admin/playtest','GET').reject(Object.assign(new Error('upstream unavailable'),{status:503})); await failure;
  const ordinary=f.api.refresh(true), read=f.take('/api/v1/admin/playtest','GET');
  read.resolve(f.snapshot()); await ordinary; assert.equal(f.api.snapshot().blocked,true);
  const shared=f.api.refresh(), pending=f.take('/api/v1/admin/playtest','GET'), recovery=f.api.recover();
  f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.filter(c=>c.path==='/api/v1/admin/playtest'&&c.method==='GET').length,3);
  pending.resolve(f.snapshot()); await Promise.all([shared,recovery]); assert.equal(f.api.snapshot().blocked,false);
  assert.equal(f.calls.filter(c=>c.method!=='GET'&&!c.path.endsWith('/start')).length,0);
});

test('a transient latched startup probe can be explicitly retried without ordinary auth or a new sandbox', async () => {
  const storage=tabStorage(); storage.setItem(latchKey,knownSession); const f=delayedFixture({storage});
  const probe=f.api.probe(), failure=assert.rejects(probe);
  f.take('/api/v1/admin/session','GET').reject(Object.assign(new Error('upstream unavailable'),{status:503})); await failure;
  assert.equal(f.api.active(),true); assert.equal(f.api.snapshot().blocked,true);
  const recovery=f.api.recover(); f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
  f.take('/api/v1/admin/playtest','GET').resolve(f.snapshot()); await recovery;
  assert.equal(f.api.snapshot().sessionId,knownSession); assert.equal(f.api.snapshot().blocked,false);
  assert.equal(storage.getItem(latchKey),knownSession); assert.equal(f.calls.some(c=>c.path.includes('/auth/')||c.method!=='GET'),false);
});

test('a second transient recovery failure remains manually retryable with no automatic loop', async () => {
  const f=delayedFixture(); await f.begin();
  const recovery=f.api.recover(), failure=assert.rejects(recovery,/upstream/);
  f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
  f.take('/api/v1/admin/playtest','GET').reject(Object.assign(new Error('upstream unavailable'),{status:503})); await failure;
  const count=f.calls.length; await new Promise(resolve=>setImmediate(resolve)); assert.equal(f.calls.length,count);
  const retry=f.api.recover(); f.take('/api/v1/admin/session','GET').resolve({authenticated:true}); await new Promise(resolve=>setImmediate(resolve));
  f.take('/api/v1/admin/playtest','GET').resolve(f.snapshot()); await retry;
  assert.equal(f.api.snapshot().blocked,false); assert.equal(f.calls.filter(c=>c.path.endsWith('/action')).length,0);
});

test('recovery authorization denial, expired snapshot and malformed snapshot cannot be retried into readiness', async () => {
  for(const failure of ['auth','expired','malformed']) {
    const f=delayedFixture(); await f.begin(); const recovery=f.api.recover(), rejected=assert.rejects(recovery);
    f.take('/api/v1/admin/session','GET').resolve({authenticated:failure!=='auth'}); await new Promise(resolve=>setImmediate(resolve));
    if(failure!=='auth') f.take('/api/v1/admin/playtest','GET').resolve(failure==='expired'?{active:false}: {...f.snapshot(),version:0});
    await rejected; assert.equal(f.api.active(),true); assert.equal(f.api.snapshot().blocked,true); assert.equal(Object.hasOwn(f.api.snapshot(),'gameplay'),false);
    const count=f.calls.length; await assert.rejects(f.api.recover()); await assert.rejects(f.api.action('job.work')); assert.equal(f.calls.length,count);
  }
});

test('ordinary read failures cannot downgrade a permanent owner block to transient recovery', async () => {
  const f=delayedFixture(); await f.begin();
  const expired=f.api.refresh(); f.take('/api/v1/admin/playtest','GET').resolve({active:false}); await expired;
  const later=f.api.refresh(), rejection=assert.rejects(later);
  f.take('/api/v1/admin/playtest','GET').reject(Object.assign(new Error('upstream unavailable'),{status:503})); await rejection;
  const count=f.calls.length; await assert.rejects(f.api.recover(),/expired or ended/); assert.equal(f.calls.length,count);
  assert.equal(f.api.snapshot().sessionId,knownSession); assert.equal(f.api.expired(),true);
});
function fixture({owner = true, storage} = {}) {
  const calls = [], events = [];
  let next = {active: false, mode: 'player'};
  const snapshot = () => ({active: true, mode: 'owner-playtest', sessionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', version: 1,
    gameplay: {player: {id: 'owner-playtest-isolated', cash: 1000, energy: 1000}, state: {version: 1, inv: {blade: 3}}, catalogs: {items: {blade: {type: 'weapon'}}}, cooldowns: {actions: {}}},
    combat: {version: 1}, highLow: {version: 1}, dailyContract: {claimed: false}, notifications: [],
    capabilities: ['bank.deposit', 'job.work', 'item.equip', 'crime.attempt', 'combat.start'], rules: {liveEconomyModified: false}});
  const window = {sessionStorage: storage, dispatchEvent: event => events.push(event)};
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  let failAction = false;
  const fetch = async (path, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({path, options, body});
    if (path === '/api/v1/admin/session') return {ok: true, status: 200, json: async () => ({authenticated: owner})};
    if (!owner || (failAction && path.endsWith('/action'))) return {ok: false, status: 401, json: async () => ({error: 'Admin authentication required.'})};
    if (path.endsWith('/start')) next = snapshot();
    if (options.method === 'DELETE') next = {active: false, mode: 'player'};
    if (path.endsWith('/action')) { next = {...next, version: next.version + 1, result: {accepted: body.action, player: {...next.gameplay.player, energy: 980}, cooldowns: {actions: {job: {remainingSeconds: 10}}}, cost: {energy: 20}, result: {action: body.action, energySpent: 20}}}; }
    return {ok: true, status: 200, json: async () => next};
  };
  runInNewContext(source, {window, CustomEvent, fetch, crypto: webcrypto, Uint8Array, URL, URLSearchParams, location: {origin: 'https://zone.test'}, console});
  return {api: window.zoneOwnerPlaytest, calls, events, revoke: () => {failAction = true;}};
}
test('ordinary players receive no implicit owner mode', async () => {
  const f = fixture({owner: false}); await f.api.probe();
  assert.equal(f.api.active(), false); assert.equal(f.api.available(), false);
  assert.equal(f.calls.length, 1);
});
test('fresh authenticated owner with no active sandbox broadcasts available entry state', async () => {
  const f = fixture(); const result = await f.api.probe();
  assert.equal(result.available, true); assert.equal(result.active, false);
  assert.equal(f.events.at(-1).detail.available, true); assert.equal(f.events.at(-1).detail.active, false); assert.equal(f.events.at(-1).detail.snapshot, null);
});
test('inactive adapter passes ordinary gameplay through without a request', async () => {
  const f = fixture(); assert.equal((await f.api.route('/api/v1/jobs/work', {}, 'POST')).handled, false); assert.equal(f.calls.length, 0);
});
test('start is explicit, cookie-authenticated and broadcasts labeled server state', async () => {
  const f = fixture(); await f.api.start('start-owner-key-0001');
  assert.equal(f.api.active(), true); assert.equal(f.api.snapshot().mode, 'owner-playtest');
  assert.equal(f.api.diagnostics().active, true);
  assert.equal(f.api.diagnostics().version, 1);
  assert.equal(f.api.diagnostics().capabilityCount, 5);
  assert.equal(f.api.supportedReadRoutes().length, 8);
  assert.equal(f.api.supportedWriteRoutes().length, 10);
  assert.equal(f.api.isSupportedReadRoute('/api/v1/gameplay'), true);
  assert.equal(f.api.isSupportedReadRoute('/api/v1/unknown'), false);
  assert.equal(f.api.isSupportedWriteRoute('/api/v1/gym/train'), true);
  assert.equal(f.api.isSupportedWriteRoute('/api/v1/unknown'), false);
  assert.equal(f.calls[0].options.credentials, 'same-origin');
  assert.equal(f.calls[0].body.idempotencyKey, 'start-owner-key-0001');
  assert.equal(f.events.at(-1).type, 'zone:owner-playtest');
  assert.equal(f.events.at(-1).detail.snapshot.gameplay.player.id, 'owner-playtest-isolated');
});
test('map browsing and catalog reads pass through while active', async () => {
  const f = fixture(); await f.api.start();
  for (const path of ['/api/v1/city/map', '/api/v1/game/bootstrap', '/api/v1/engine', '/api/v1/crimes']) assert.equal((await f.api.route(path)).handled, false);
  assert.equal(f.calls.length, 1);
});
test('player and gameplay read contracts use refreshed server sandbox, not live balances', async () => {
  const f = fixture(); await f.api.start();
  const player = await f.api.route('/api/v1/player'); const gameplay = await f.api.route('/api/v1/gameplay');
  assert.equal(player.response.player.id, 'owner-playtest-isolated'); assert.equal(gameplay.response.state.inv.blade, 3);
  assert.equal(f.calls.filter(call => call.path === '/api/v1/admin/playtest').length, 2);
});
test('parallel refreshes deduplicate the same owner request', async () => {
  const f = fixture(); await f.api.start(); await Promise.all([f.api.refresh(), f.api.refresh(), f.api.refresh()]);
  assert.equal(f.calls.filter(call => call.path === '/api/v1/admin/playtest').length, 1);
});
test('work forwards through allowlisted owner action with current version and random idempotency key', async () => {
  const f = fixture(); await f.api.start(); const result = await f.api.route('/api/v1/jobs/work', {}, 'POST');
  const call = f.calls.at(-1); assert.equal(call.path, '/api/v1/admin/playtest/action');
  assert.equal(call.body.action, 'job.work'); assert.equal(call.body.expectedVersion, 1);
  assert.equal(call.body.sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.match(call.body.idempotencyKey, /^[a-f0-9]{32}$/); assert.equal(result.response.accepted, 'job.work'); assert.equal(f.api.snapshot().version, 2);
});
test('progression retains selected catalog ID without exposing client player claims', async () => {
  const f = fixture(); await f.api.start(); await f.api.route('/api/v1/gameplay/action', {action: 'item.equip', id: 'blade', playerId: 'victim'}, 'POST');
  assert.equal(f.calls.at(-1).body.id, 'blade'); assert.equal(Object.hasOwn(f.calls.at(-1).body, 'playerId'), false);
});
test('action consumers receive post-test refill state without altering actual receipt costs', async () => {
  const f = fixture(); await f.api.start(); const result = await f.api.route('/api/v1/jobs/work', {}, 'POST');
  assert.equal(result.response.player.energy, 1000); assert.equal(Object.keys(result.response.cooldowns.actions).length, 0);
  assert.equal(result.response.cost.energy, 20); assert.equal(f.api.snapshot().result.player.energy, 980);
  assert.equal(f.api.snapshot().result.cooldowns.actions.job.remainingSeconds, 10);
});
test('progression response remains gameplay-shaped and retains its actual action result', async () => {
  const f = fixture(); await f.api.start(); const result = await f.api.route('/api/v1/gameplay/action', {action: 'item.equip', id: 'blade'}, 'POST');
  assert.equal(result.response.state.inv.blade, 3); assert.equal(result.response.catalogs.items.blade.type, 'weapon');
  assert.equal(result.response.player.energy, 1000); assert.equal(result.response.result.action, 'item.equip');
});
test('shared gameplay mutations are blocked before any network call', async () => {
  const f = fixture(); await f.api.start();
  for (const path of ['/api/v1/territories/ZC-120/action', '/api/v1/player-market/action', '/api/v1/factions/join', '/api/v1/player-combat/action']) await assert.rejects(f.api.route(path, {action: 'buy'}, 'POST'), /shared action/);
  await assert.rejects(f.api.route('/api/v1/gameplay/action', {action: 'faction.contribute', id: '100'}, 'POST'), /shared action/);
  assert.equal(f.calls.length, 1);
});
test('owner failure never silently retries as live player or erases active-state warning', async () => {
  const f = fixture(); await f.api.start(); f.revoke();
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /Admin authentication/);
  assert.equal(f.calls.length, 2); assert.equal(f.api.active(), true); assert.equal(f.api.available(), false);
});
test('snapshot and event copies cannot be mutated into client authority', async () => {
  const f = fixture(); await f.api.start(); const copy = f.api.snapshot(); copy.version = 800; copy.gameplay.player.cash = 9;
  assert.equal(f.api.snapshot().version, 1); assert.equal(f.api.snapshot().gameplay.player.cash, 1000);
});
test('exit returns normal mode and clears sandbox without altering real storage', async () => {
  const f = fixture(); await f.api.start(); await f.api.stop();
  assert.equal(f.api.active(), false); assert.equal(f.api.snapshot(), null);
  assert.equal(f.calls.at(-1).options.method, 'DELETE');
  assert.equal(f.calls.at(-1).body.sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal((await f.api.route('/api/v1/bank/deposit', {amount: 1}, 'POST')).handled, false);
  assert.doesNotMatch(source, /localStorage|ZonePlatform\s*=/);
});

function delayedFixture({storage, preview = false, urlPreview = false} = {}) {
  const calls = [], events = [];
  const window = {ZonePlatform: {preview}, sessionStorage: storage, dispatchEvent: event => events.push(event)};
  class CustomEvent {constructor(type, options) {this.type = type; this.detail = options.detail;}}
  runInNewContext(source, {window, CustomEvent, crypto: webcrypto, Uint8Array, URL, URLSearchParams, location: {origin: 'https://zone.test', search: urlPreview ? '?zone-preview=1' : ''}, fetch: () => {throw new Error('Unexpected raw fetch');}, console});
  window.zoneOwnerPlaytest.configure({request: (path, method, body) => new Promise((resolve, reject) => calls.push({path, method, body, resolve, reject, used: false}))});
  const take = (path, method) => {const call = calls.find(call => !call.used && call.path === path && (!method || call.method === method)); assert.ok(call, `Pending call ${method ?? ''} ${path}`); call.used = true; return call;};
  const snapshot = (version = 1, sessionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') => ({active: true, mode: 'owner-playtest', version, sessionId,
    gameplay: {player: {id: 'owner-playtest-isolated', cash: 1000 + version}, state: {version}, cooldowns: {actions: {}}},
    result: {player: {energy: 980}, receiptVersion: version}, receipt: {actualVersion: version}, capabilities: ['job.work', 'bank.deposit']});
  const begin = async () => {const pending = window.zoneOwnerPlaytest.start(); take('/api/v1/admin/playtest/start').resolve(snapshot()); await pending;};
  return {api: window.zoneOwnerPlaytest, calls, events, take, snapshot, begin};
}
test('late pre-action refresh cannot regress the current sandbox version or return old data', async () => {
  const f = delayedFixture(); await f.begin(); const refresh = f.api.refresh(); const read = f.take('/api/v1/admin/playtest', 'GET');
  const action = f.api.action('job.work'); f.take('/api/v1/admin/playtest/action').resolve(f.snapshot(2)); await action;
  read.resolve(f.snapshot(1)); const received = await refresh;
  assert.equal(received.version, 2); assert.equal(received.gameplay.player.cash, 1002); assert.equal(f.api.snapshot().version, 2);
});
test('same-session refresh versions remain monotonic even when issued after an action', async () => {
  const f = delayedFixture(); await f.begin(); const action = f.api.action('job.work'); f.take('/api/v1/admin/playtest/action').resolve(f.snapshot(3)); await action;
  const refresh = f.api.refresh(); f.take('/api/v1/admin/playtest', 'GET').resolve(f.snapshot(2)); const received = await refresh;
  assert.equal(received.version, 3); assert.equal(received.receipt.actualVersion, 3);
});
test('late action after explicit stop cannot reactivate mode and returns current inactive state', async () => {
  const f = delayedFixture(); await f.begin(); const action = f.api.action('job.work'); const settlement = f.take('/api/v1/admin/playtest/action');
  const stop = f.api.stop(); f.take('/api/v1/admin/playtest', 'DELETE').resolve({active: false, mode: 'player'}); await stop;
  settlement.resolve(f.snapshot(2)); const received = await action;
  assert.equal(f.api.active(), false); assert.equal(f.api.snapshot(), null); assert.equal(received.active, false);
  assert.equal(Object.hasOwn(received, 'gameplay'), false); assert.equal(f.events.at(-1).detail.active, false);
});
test('late routed action rejects rather than repainting the restored real account', async () => {
  const f = delayedFixture(); await f.begin(); const action = f.api.route('/api/v1/jobs/work', {}, 'POST'); const rejection = assert.rejects(action, /changed while/); const settlement = f.take('/api/v1/admin/playtest/action');
  const stop = f.api.stop(); f.take('/api/v1/admin/playtest', 'DELETE').resolve({active: false, mode: 'player'}); await stop;
  settlement.resolve(f.snapshot(2)); await rejection; assert.equal(f.api.active(), false);
});
test('expired refresh keeps selection sticky and blocks every game write until explicit exit', async () => {
  const f = delayedFixture(); await f.begin(); const refresh = f.api.refresh(); f.take('/api/v1/admin/playtest', 'GET').resolve({active: false, mode: 'player'}); const received = await refresh;
  assert.equal(received.active, true); assert.equal(received.expired, true); assert.equal(Object.hasOwn(received, 'gameplay'), false); assert.equal(f.api.active(), true);
  const count = f.calls.length;
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /expired or ended/);
  await assert.rejects(f.api.route('/api/v1/bank/deposit', {amount: 1}, 'POST'), /expired or ended/);
  assert.equal(f.calls.length, count); assert.equal(f.events.at(-1).detail.active, true); assert.equal(f.events.at(-1).detail.expired, true);
  const stop = f.api.stop(); const closure = f.take('/api/v1/admin/playtest', 'DELETE'); assert.equal(closure.body.sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  closure.resolve({active: false, mode: 'player'}); await stop;
  assert.equal((await f.api.route('/api/v1/jobs/work', {}, 'POST')).handled, false);
});
test('owner auth refresh failure remains selected and explicit revoked-auth exit is visibly unconfirmed', async () => {
  const f = delayedFixture(); await f.begin(); const refresh = f.api.refresh(); const failure = assert.rejects(refresh, /Admin authentication/);
  f.take('/api/v1/admin/playtest', 'GET').reject(Object.assign(new Error('Admin authentication required.'), {status: 401})); await failure;
  assert.equal(f.api.active(), true); assert.equal(f.api.expired(), true); assert.equal(f.api.available(), false); assert.equal(Object.hasOwn(f.api.snapshot(), 'gameplay'), false);
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /Admin authentication/);
  const stop = f.api.stop(); f.take('/api/v1/admin/playtest', 'DELETE').reject(Object.assign(new Error('Admin authentication required.'), {status: 403})); const received = await stop;
  assert.equal(f.api.active(), false); assert.equal(received.serverCloseUnconfirmed, true); assert.equal(f.events.at(-1).detail.serverCloseUnconfirmed, true);
});
test('late start during stop closes the exact new session without applying its gameplay', async () => {
  const f = delayedFixture(); const start = f.api.start(); const creation = f.take('/api/v1/admin/playtest/start'); const stop = f.api.stop();
  creation.resolve(f.snapshot(1)); await new Promise(resolve => setImmediate(resolve));
  const closure = f.take('/api/v1/admin/playtest', 'DELETE'); assert.equal(closure.body.sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(Object.hasOwn(f.api.snapshot(), 'gameplay'), false);
  closure.resolve({active: false, mode: 'player'}); await stop; await start;
  assert.equal(f.api.active(), false); assert.equal(f.api.snapshot(), null);
});
test('late old-owner probe cannot erase newly selected owner state', async () => {
  const f = delayedFixture(); const probe = f.api.probe(); const access = f.take('/api/v1/admin/session'); await f.begin(); access.resolve({authenticated: false}); const received = await probe;
  assert.equal(received.active, true); assert.equal(f.api.active(), true); assert.equal(f.api.available(), true); assert.equal(f.api.expired(), false);
});
test('unexpected server session replacement fails closed and keeps stop scoped to selected session', async () => {
  const f = delayedFixture(); await f.begin(); const refresh = f.api.refresh(); f.take('/api/v1/admin/playtest', 'GET').resolve(f.snapshot(1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')); await refresh;
  assert.equal(f.api.expired(), true); assert.equal(f.api.snapshot().sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /session changed/);
  const stop = f.api.stop(); const closure = f.take('/api/v1/admin/playtest', 'DELETE'); assert.equal(closure.body.sessionId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); closure.resolve({active: false, mode: 'player'}); await stop;
});
test('expired action error makes selection sticky and forbids live fallback', async () => {
  const f = delayedFixture(); await f.begin(); const action = f.api.action('job.work'); const rejection = assert.rejects(action, /not active/);
  f.take('/api/v1/admin/playtest/action').reject(Object.assign(new Error('Owner playtest is not active.'), {status: 400})); await rejection;
  assert.equal(f.api.active(), true); assert.equal(f.api.expired(), true); await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /not active/);
});

const latchKey = 'zone.ownerPlaytest.selection';
const knownSession = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
function tabStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key)};
}
test('selection latch stores only server session identity, never gameplay or authority', async () => {
  const storage = tabStorage(); const f = fixture({storage}); await f.api.start();
  assert.equal(storage.getItem(latchKey), knownSession); assert.equal(storage.entries.size, 1);
  assert.match(storage.getItem(latchKey), /^[a-f0-9]{32}$/);
  await f.api.route('/api/v1/jobs/work', {}, 'POST'); assert.equal(storage.getItem(latchKey), knownSession);
});
test('reload with selected latch fails closed before owner probe instead of using real account', async () => {
  const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({storage});
  assert.equal(f.api.active(), true); assert.equal(f.api.available(), false); assert.equal(f.api.snapshot().pending, 'resume');
  assert.equal(Object.hasOwn(f.api.snapshot(), 'gameplay'), false);
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /not ready/);
  await assert.rejects(f.api.route('/api/v1/gameplay'), /not ready/);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.api.route('/api/v1/auth/session', {}, 'POST')).handled, false);
});
test('authenticated probe resumes only matching latched server sandbox and restores readiness', async () => {
  const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({storage}); const probe = f.api.probe();
  f.take('/api/v1/admin/session').resolve({authenticated: true}); await new Promise(resolve => setImmediate(resolve));
  f.take('/api/v1/admin/playtest', 'GET').resolve(f.snapshot(7)); const result = await probe;
  assert.equal(result.active, true); assert.equal(result.available, true); assert.equal(f.api.snapshot().version, 7);
  assert.equal(f.api.snapshot().pending, null); assert.equal(f.api.snapshot().blocked, false); assert.equal(storage.getItem(latchKey), knownSession);
});
test('expired resumed sandbox retains latch and no fabricated gameplay until explicit exit', async () => {
  const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({storage}); const probe = f.api.probe();
  f.take('/api/v1/admin/session').resolve({authenticated: true}); await new Promise(resolve => setImmediate(resolve)); f.take('/api/v1/admin/playtest', 'GET').resolve({active: false}); await probe;
  assert.equal(f.api.active(), true); assert.equal(f.api.expired(), true); assert.equal(storage.getItem(latchKey), knownSession);
  assert.equal(Object.hasOwn(f.api.snapshot(), 'gameplay'), false); await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /expired or ended/);
  const stop = f.api.stop(); f.take('/api/v1/admin/playtest', 'DELETE').resolve({active: false}); await stop;
  assert.equal(storage.getItem(latchKey), null); assert.equal(delayedFixture({storage}).api.active(), false);
});
test('auth-denied latch never grants owner powers and explicit local exit clears it with notice', async () => {
  const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({storage}); const probe = f.api.probe(); f.take('/api/v1/admin/session').resolve({authenticated: false}); await probe;
  assert.equal(f.api.active(), true); assert.equal(f.api.available(), false); assert.equal(f.api.expired(), true); assert.equal(storage.getItem(latchKey), knownSession);
  await assert.rejects(f.api.route('/api/v1/jobs/work', {}, 'POST'), /Admin authentication/);
  const stop = f.api.stop(); f.take('/api/v1/admin/playtest', 'DELETE').reject(Object.assign(new Error('Admin authentication required.'), {status: 401})); const result = await stop;
  assert.equal(result.serverCloseUnconfirmed, true); assert.equal(storage.getItem(latchKey), null); assert.equal(f.api.active(), false);
});
test('preview ignores and preserves the live selection latch without owner requests', async () => {
  for (const options of [{preview: true}, {urlPreview: true}]) {
    const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({...options, storage});
    assert.equal(f.api.active(), false); assert.equal((await f.api.probe()).available, false); await assert.rejects(f.api.start(), /preview/); await f.api.stop();
    assert.equal(f.calls.length, 0); assert.equal(storage.getItem(latchKey), knownSession);
  }
});
test('fresh visitors or malformed latch preserve normal guest auth and gameplay flow', async () => {
  for (const value of [null, '{"cash":1000000,"admin":true}']) {
    const storage = tabStorage(value === null ? {} : {[latchKey]: value}); const f = delayedFixture({storage});
    assert.equal(f.api.active(), false); assert.equal((await f.api.route('/api/v1/auth/session', {}, 'POST')).handled, false);
    assert.equal((await f.api.route('/api/v1/jobs/work', {}, 'POST')).handled, false); assert.equal(f.calls.length, 0);
  }
});
test('resume cannot switch silently to a different server session than the latched selection', async () => {
  const storage = tabStorage({[latchKey]: knownSession}); const f = delayedFixture({storage}); const probe = f.api.probe();
  f.take('/api/v1/admin/session').resolve({authenticated: true}); await new Promise(resolve => setImmediate(resolve)); f.take('/api/v1/admin/playtest', 'GET').resolve(f.snapshot(1, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')); await probe;
  assert.equal(f.api.expired(), true); assert.equal(f.api.snapshot().sessionId, knownSession); assert.equal(storage.getItem(latchKey), knownSession);
  assert.equal(Object.hasOwn(f.api.snapshot(), 'gameplay'), false);
  assert.equal(f.api.selectionStorageKey(), latchKey);
  assert.equal(f.api.isValidPlaytestSessionId(knownSession), true);
  assert.equal(f.api.isValidPlaytestSessionId('invalid'), false);
  assert.equal(f.api.isBlocked(), true);
  assert.equal(f.api.isPending(), false);
  assert.equal(f.api.isReady(), false);
  assert.equal(f.api.selectedSessionId(), knownSession);
});

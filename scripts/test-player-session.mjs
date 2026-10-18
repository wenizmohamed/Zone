import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../player-session.js', import.meta.url), 'utf8');
function browser({ preview = false, existingId, sessionReply, playerReply, now = 1000 } = {}) {
  const calls = [], storage = new Map(), dataset = {};
  if (existingId) storage.set('zone.player.id', existingId);
  storage.set('zone.v2.save', 'old account presentation');
  let clock = now;
  const location = new URL('http://zone.test/' + (preview ? '?zone-preview=1' : ''));
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (url === '/api/v1/auth/session') return sessionReply ? sessionReply(calls) : { ok: true, json: async () => ({ playerId: 'player-new', mode: 'persistent-browser', expiresAt: 99999 }) };
    return playerReply ? playerReply(url,options) : { ok: true, json: async () => ({}) };
  };
  const window = { fetch };
  const context = createContext({ window, location, URL, URLSearchParams, Promise, Error,
    Date: class extends Date { static now() { return clock; } },
    document: { documentElement: { dataset } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  runInContext(source, context);
  return { window, calls, storage, dataset, advance: ms => { clock += ms; } };
}

test('simultaneous player reads share one server session bootstrap', async () => {
  const b = browser();
  await Promise.all(['/api/v1/player', '/api/v1/world', '/api/v1/gameplay', '/api/v1/city/map', '/api/v1/leaderboards', '/api/v1/player-combat/opponents', '/api/v1/player-market', '/api/v1/family-activities'].map(path => b.window.fetch(path)));
  assert.equal(b.calls.filter(c => c.url === '/api/v1/auth/session').length, 1);
  assert.equal(b.calls[0].url, '/api/v1/auth/session');
  assert.equal(b.calls[0].options.credentials, 'same-origin');
  assert.equal(b.dataset.zonePlayerAccess, 'persistent-browser');
  assert.equal(b.window.ZoneSession.current().playerId, 'player-new');
});
test('all authoritative player mutations establish access before forwarding unchanged options', async () => {
  for (const path of ['/api/v1/crimes/steal/attempt', '/api/v1/gym/train', '/api/v1/bank/deposit', '/api/v1/travel', '/api/v1/territories/1/action', '/api/v1/factions/join', '/api/v1/combat/attack', '/api/v1/casino/slots', '/api/v1/notifications', '/api/v1/player-combat/action', '/api/v1/player-market/action', '/api/v1/family-activities/action']) {
    const b = browser(), options = { method: 'POST', body: '{"amount":1}' };
    await b.window.fetch(path, options);
    assert.equal(b.calls[0].url, '/api/v1/auth/session', path);
    assert.equal(b.calls[1].options, options, path);
    assert.equal(b.calls[1].options.headers, undefined, 'does not forge identity headers');
  }
});

test('street finds and claims wait for the same initial session as player hydration',async()=>{
  let release;
  const session=new Promise(resolve=>{release=resolve;});
  const b=browser({sessionReply:()=>session});
  const reads=b.window.fetch('/api/v1/world'),options={method:'POST',body:'{"findId":"real-find","idempotencyKey":"same-command"}'},claim=b.window.fetch('/api/v1/world/claim',options);
  await Promise.resolve();assert.equal(b.calls.length,1);assert.equal(b.calls[0].url,'/api/v1/auth/session');
  release({ok:true,json:async()=>({playerId:'player-new',mode:'persistent-browser',expiresAt:99999})});
  await Promise.all([reads,claim]);
  assert.deepEqual(b.calls.map(call=>call.url),['/api/v1/auth/session','/api/v1/world','/api/v1/world/claim']);
  assert.equal(b.calls[2].options,options,'the original claim is sent once and never replayed');
});
test('public, Admin, art and external requests do not create players', async () => {
  const b = browser();
  for (const path of ['/api/v1/health', '/api/v1/platform/release', '/api/v1/admin/session', '/art/a.jpg', 'https://other.test/api/v1/player']) await b.window.fetch(path);
  assert.equal(b.calls.length, 5);
  assert.equal(b.window.ZoneSession.current(), null);
});
test('preview never enables passwordless player access', async () => {
  const b = browser({ preview: true });
  await b.window.fetch('/api/v1/player');
  assert.equal(b.window.ZoneSession, undefined);
  assert.equal(b.calls.length, 1);
});
test('changed identity clears another players cached presentation, not authorization data', async () => {
  const b = browser({ existingId: 'player-old' });
  await b.window.ZoneSession.ensure();
  assert.equal(b.storage.has('zone.v2.save'), false);
  assert.equal(b.storage.get('zone.player.id'), 'player-new');
  assert.equal([...b.storage.values()].some(value => /token|secret/.test(value)), false);
});
test('matching identity preserves presentation through a page reload', async () => {
  const b = browser({ existingId: 'player-new' });
  await b.window.ZoneSession.ensure();
  assert.equal(b.storage.get('zone.v2.save'), 'old account presentation');
});
test('failed bootstrap backs off without forwarding unauthenticated gameplay then retries', async () => {
  let attempts = 0;
  const b = browser({ sessionReply: async () => ++attempts === 1 ? { ok: false, json: async () => ({ error: 'Database unavailable' }) } : { ok: true, json: async () => ({ playerId: 'player-retry', mode: 'persistent-browser' }) } });
  await assert.rejects(b.window.fetch('/api/v1/player'), /Database unavailable/);
  await assert.rejects(b.window.fetch('/api/v1/gameplay'), /retry shortly/);
  assert.equal(b.calls.length, 1);
  b.advance(15000);
  await b.window.fetch('/api/v1/player');
  assert.equal(b.calls.length, 3);
  assert.equal(b.window.ZoneSession.current().playerId, 'player-retry');
});
test('malformed server identity fails closed and does not forward a player request', async () => {
  const b = browser({ sessionReply: async () => ({ ok: true, json: async () => ({ mode: 'persistent-browser' }) }) });
  await assert.rejects(b.window.fetch('/api/v1/player'), /Unable to establish/);
  assert.equal(b.calls.length, 1);
  assert.equal(b.window.ZoneSession.current(), null);
});

test('expired identity never silently creates a replacement character or replays a write',async()=>{
 const b=browser({sessionReply:async()=>({ok:true,json:async()=>({playerId:'player-original',expiresAt:2,mode:'persistent-browser'})})});
 await b.window.ZoneSession.ensure();b.advance(2000);
 await assert.rejects(b.window.fetch('/api/v1/jobs/work',{method:'POST',body:'{}'}),/session expired/);
 assert.equal(b.calls.length,1);assert.equal(b.window.ZoneSession.current().playerId,'player-original');
 await assert.rejects(b.window.ZoneSession.recover(),/Open Account/);
 assert.equal(b.calls.filter(c=>c.url==='/api/v1/auth/session').length,1);
});
test('a player401 marks expired access and leaves the existing saved presentation intact',async()=>{
 const b=browser({existingId:'player-new',playerReply:async()=>({status:401,ok:false,json:async()=>({error:'Player session expired.'})})});
 await b.window.fetch('/api/v1/gameplay');assert.equal(b.dataset.zonePlayerAccess,'expired');
 await assert.rejects(b.window.fetch('/api/v1/bank/deposit',{method:'POST',body:'{"amount":100}'}),/session expired/);
 assert.equal(b.calls.filter(c=>c.url==='/api/v1/auth/session').length,1);assert.equal(b.storage.get('zone.v2.save'),'old account presentation');
});

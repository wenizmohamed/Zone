import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('index.html', root), 'utf8').match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
function fixture(fetchImpl) {
  const messages = [], requests = [], storage = new Map();
  const frame = { contentWindow: { postMessage(data, origin) { messages.push({ data, origin }); } } };
  const context = createContext({
    console, URL, URLSearchParams, Date,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {} }, getElementById: id => id === 'zone-city-map' ? frame : null },
    window: { location: new URL('https://zone.test/'), ZonePlatform: { preview: false, active: () => ({ manifest: {} }), data: () => ({}) } },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, React: { createElement() {} },
    DCLogic: class { constructor(props) { this.props = props; } forceUpdate() {} setState(next) { Object.assign(this.state, next); } },
    fetch: async (path, options) => { requests.push({ path, options }); return fetchImpl(path, options); },
  });
  runInContext(readFileSync(new URL('assets/weapons/catalog.js', root), 'utf8'), context);
  runInContext(source + '\nglobalThis.Game = Component;', context);
  const app = new context.Game({}); app.gameplayReady = true; app.bump = () => {};
  app.applyServerPlayer({ energy: 100 });
  app.territoryMap = { revision: 1, blocks: [{ id: 'ZC-001', action: 'claim', actionEnergyCost: 10, version: 4 }] };
  return { app, messages, requests };
}
const response = body => ({ ok: true, json: async () => body });

test('one pending command preserves the displayed version and delivers the authoritative receipt', async () => {
  let complete;
  const { app, requests, messages } = fixture(() => new Promise(resolve => { complete = resolve; }));
  const command = { blockId: 'ZC-001', action: 'claim', expectedVersion: 4 };
  const pending = app.territoryAction(command);
  await app.territoryAction(command);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].options.body), { action: 'claim', expectedVersion: 4 });
  assert.equal(messages.at(-1).data.status, 'pending');
  complete(response({ player: { energy: 90 }, map: { revision: 2, blocks: [{ id: 'ZC-001', action: null, version: 5, ownerFactionId: 'vipers' }] } }));
  await pending;
  const receipt = messages.at(-1);
  assert.equal(receipt.origin, 'https://zone.test');
  assert.equal(receipt.data.status, 'success'); assert.match(receipt.data.message, /claimed.*90/);
  assert.equal(app.territoryBusy, null); assert.equal(app.cur('energy'), 90);
  assert.equal(messages.findLast(item => item.data.type === 'ZONE_MAP_DATA').data.blocks[0].canAct, false);
});

test('a stale iframe selection is refreshed without silently acting on a newer version', async () => {
  const { app, requests, messages } = fixture(() => { throw new Error('Unexpected mutation'); });
  await app.territoryAction({ blockId: 'ZC-001', action: 'claim', expectedVersion: 3 });
  assert.equal(requests.length, 0);
  assert.equal(messages.find(item => item.data.type === 'ZONE_MAP_ACTION_STATUS').data.status, 'error');
  assert.equal(messages.at(-1).data.blocks[0].version, 4);
});

test('energy, hospitalization and connection failures revoke eligibility without ownership changes', async () => {
  const { app, messages } = fixture(() => { throw new Error('Disconnected'); });
  app.pushMap(); assert.equal(messages.at(-1).data.blocks[0].canAct, true);
  app.applyServerPlayer({ energy: 4 }); app.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, false);
  assert.match(messages.at(-1).data.blocks[0].actionReason, /Available: 4 \/ 10/);
  app.applyServerPlayer({ energy: 50 }); app.p.hospUntil = Date.now() + 60000; app.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, false);
  app.p.hospUntil = 0; await app.loadTerritories();
  assert.equal(messages.at(-1).data.blocks[0].canAct, false);
  assert.equal(app.territoryMap.revision, 1);
});

test('a rejected action refreshes server energy and emits a failure, never a success receipt', async () => {
  const blocks = Array.from({ length: 120 }, (_, i) => ({ id: 'ZC-' + String(i + 1).padStart(3, '0'), version: 4, action: 'claim', actionEnergyCost: 10 }));
  const { app, messages } = fixture((path, options) => options?.method === 'POST'
    ? { ok: false, status: 400, json: async () => ({ error: 'Not enough energy.' }) }
    : response(path.includes('city/map') ? { revision: 2, blocks } : { player: { energy: 3 } }));
  await app.territoryAction({ blockId: 'ZC-001', action: 'claim', expectedVersion: 4 });
  assert.equal(app.cur('energy'), 3); assert.equal(app.territoryBusy, null);
  assert.equal(messages.at(-1).data.status, 'error');
  assert.equal(messages.filter(item => item.data.status === 'success').length, 0);
  app.pushMap(); assert.equal(messages.at(-1).data.blocks[0].canAct, false);
  assert.deepEqual(Array.from(app.supportedTerritoryActions()), ['claim', 'contest', 'fortify', 'collect']);
  assert.equal(app.isSupportedTerritoryAction('claim'), true);
  assert.equal(app.isSupportedTerritoryAction('unknown'), false);
  assert.equal(app.territoryBlockCount(), 120);
  assert.equal(app.hasTerritoryMap(), true);
  assert.equal(app.isTerritoryBusy(), false);
});

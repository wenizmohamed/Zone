import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const catalog = readFileSync(resolve(root, 'assets/weapons/catalog.js'), 'utf8');

function game({ manifest = {}, fetchImpl, now = 1800000, preview = false, liveSave, route = '', modules = false } = {}) {
  const frames = Object.fromEntries(['zone-city-map', 'zone-char-3d', 'zone-item-3d'].map(id => [id, { contentWindow: { postMessage(data, origin) { messages.push({ id, data, origin }); } } }]));
  const messages = [], timers = [], intervals = [], calls = [], storage = new Map(), listeners = {}, history = [];
  const location = new URL('http://zone.test/' + (preview ? '?zone-preview=1' : route));
  if (liveSave) storage.set('zone.v2.save', JSON.stringify(liveSave));
  const context = createContext({
    console, URL, URLSearchParams,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById: id => frames[id] || null },
    window: { location, history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, title, href) => { history.push({ method, href }); location.href = href; }])), ZonePlatform: { preview, active: () => ({ version: 1, manifest }), data: () => ({}) }, addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener(name) { delete listeners[name]; } },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    React: { createElement: () => ({}) },
    DCLogic: class {
      constructor(props) { this.props = props; }
      setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); }
      forceUpdate() {}
    },
    fetch: async (path, options) => {
      calls.push({ path, options });
      if (fetchImpl) return fetchImpl(path, options);
      return { ok: true, json: async () => path.includes('city/map') ? { blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) } : path.includes('high-low') ? { card: 7, version: 1 } : path.includes('gameplay') ? { state: { version: 1 } } : path.includes('combat') ? { version: 1, encounter: null } : { player: {} } };
    },
  });
  runInContext(catalog, context);
  if (modules) { runInContext(readFileSync(resolve(root, 'assets/module-panel.js'), 'utf8'), context); context.window.ZoneModulePanel = context.ZoneModulePanel; }
  runInContext(`${source}\nglobalThis.clientExports = { Component, T, SCREENS, CAT };`, context);
  const instance = new context.clientExports.Component({});
  instance.bump = () => {};
  return { instance, ...context.clientExports, context, frames, messages, timers, intervals, calls, storage, listeners, history, location };
}

test('every player screen produces EN and AR view data', () => {
  const { instance, SCREENS } = game();
  assert.equal(SCREENS.length, 19);
  for (const lang of ['en', 'ar']) for (const screen of SCREENS) {
    instance.state.lang = lang; instance.state.screen = screen;
    const view = instance.renderVals();
    assert.equal(view.is[screen], true, `${lang}/${screen}`);
    assert.ok(view.title, `${lang}/${screen} title`);
  }
});

test('server hydration assigns actual stats, level, all bars and caps without replacing local features', () => {
  const { instance } = game();
  const inv = instance.p.inv, eduDone = instance.p.eduDone, job = instance.p.job;
  instance.applyServerPlayer({ level: 23, xp: 9, cash: 123, energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 160, max_nerve: 55, max_life: 4000, max_happy: 6000, strength: 200, defense: 201, speed: 202, dexterity: 203, resources_updated_at: new Date(1800000).toISOString() });
  assert.equal(instance.p.level, 23); assert.equal(instance.p.stats.str, 200);
  assert.equal(instance.cur('nerve'), 7); assert.equal(instance.cur('happy'), 88);
  assert.equal(instance.maxOf('energy'), 160); assert.equal(instance.maxOf('happy'), 6000);
  assert.equal(instance.barClock('energy').ivl, 180000); assert.equal(instance.barClock('energy').rate, 1);
  assert.equal(instance.p.inv, inv); assert.equal(instance.p.eduDone, eduDone); assert.equal(instance.p.job, job);
});

test('server regeneration uses the credited server tick rather than accelerated demo cadence', () => {
  const { instance } = game({ now: 1920000 });
  instance.applyServerPlayer({ energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 150, max_nerve: 50, max_happy: 5000, max_life: 3000, resources_updated_at: new Date(1800000).toISOString() });
  assert.equal(instance.cur('energy'), 44); assert.equal(instance.cur('life'), 101);
  assert.equal(instance.nextIn('energy'), 60000);
});

test('startup fetches the authoritative player and the current high-low card', async () => {
  const { instance, calls } = game(); instance.componentDidMount();
  await Promise.all([instance._playerSync, instance._casinoLoad]);
  assert.ok(calls.some(call => call.path === '/api/v1/player'));
  assert.ok(calls.some(call => call.path === '/api/v1/casino/high-low'));
  assert.equal(instance.casinoReady, true);
});

test('character messages require exact origin/source and cannot mint unowned weapons', async () => {
  const { instance, frames, CAT, calls } = game({ fetchImpl: async (path, options) => ({ ok: true, json: async () => path.includes('gameplay') ? { state: { version: options?.method === 'POST' ? 2 : 1, ...(options?.method === 'POST' ? { equip: 'revolver' } : {}) } } : path.includes('high-low') ? { card: 7, version: 1 } : path.includes('city/map') ? { blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) } : { player: {} } }) }); instance.componentDidMount();
  await instance._gameplayLoad;
  const key = Object.keys(CAT).find(item => CAT[item].type === 'weapon' && !instance.p.inv[item]);
  const send = (source, origin, data) => instance.onMsg({ source, origin, data });
  send(frames['zone-char-3d'].contentWindow, 'http://zone.test', { zoneEquip: key });
  assert.equal(instance.p.inv[key], undefined); assert.equal(instance.p.equip, 'bat');
  send(frames['zone-char-3d'].contentWindow, 'https://foreign.test', { zoneEquip: 'revolver' });
  send(frames['zone-item-3d'].contentWindow, 'http://zone.test', { zoneEquip: 'revolver' });
  assert.equal(instance.p.equip, 'bat');
  await send(frames['zone-char-3d'].contentWindow, 'http://zone.test', { zoneEquip: 'revolver' });
  assert.equal(instance.p.equip, 'revolver');
  const mutations = calls.filter(call => call.options?.method === 'POST');
  assert.equal(mutations.length, 1); assert.equal(JSON.parse(mutations[0].options.body).action, 'item.equip');
});

test('hidden routes cannot be entered from quick links or direct go', () => {
  const { instance } = game({ manifest: { modules: { crimes: false } } });
  assert.equal(instance.renderVals().nav.some(item => item.id === 'crimes'), false);
  instance.go('crimes'); assert.equal(instance.state.screen, 'home');
});

test('map view persists and receives show/hide with a same-origin target', () => {
  const { instance, messages } = game();
  instance.go('city'); instance.go('home');
  const visibility = messages.filter(item => ['ON_SHOW', 'ON_HIDE'].includes(item.data.type));
  assert.deepEqual(visibility.map(item => item.data.type), ['ON_SHOW', 'ON_HIDE']);
  assert.ok(visibility.every(item => item.origin === 'http://zone.test'));
  assert.match(html, /data-zone-city-view="1"/); assert.doesNotMatch(html, /<sc-if value="\{\{ is\.city \}\}"/);
});

test('high-low sends direction, shows the server card and retains the settled bet in its message', async () => {
  const { instance, calls, T } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: 'win', card: 14, version: 2, delta: 1000, player: { cash: 99999 } }) }) });
  instance.gameplayReady = true; instance.casinoReady = true; instance.state.casino.version = 1;
  await instance.casinoGuess(true, T.en); await instance.casinoGuess(false, T.en);
  assert.deepEqual(calls.map(item => JSON.parse(item.options.body).direction), ['higher', 'lower']);
  assert.deepEqual(calls.map(item => JSON.parse(item.options.body).expectedVersion), [1, 2]);
  assert.ok(calls.every(item => item.path === '/api/v1/casino/high-low'));
  instance.state.casino.bet = 25000;
  const view = instance.renderVals(); assert.equal(view.casino.card, 'A');
  assert.match(view.casino.msg, /1,000/); assert.doesNotMatch(view.casino.msg, /25,000/);
});

test('animated action remains busy until the asynchronous mutation settles', async () => {
  const { instance, timers } = game(); instance.gameplayReady = true; let settle;
  instance.resolve('training', 10, () => new Promise(resolve => { settle = resolve; }));
  const pending = timers[0](); assert.equal(instance.state.busy, 'training');
  settle(); await pending; assert.equal(instance.state.busy, null);
});

test('compact navigation exposes the current area and closes after a successful route change', () => {
  const { instance, SCREENS } = game({ manifest: { modules: { casino: false } } });
  let view = instance.renderVals();
  assert.equal(view.navigationExpanded, false);
  assert.equal(view.nav.filter(item => item.current === 'page').length, 1);
  assert.equal(view.nav.find(item => item.current === 'page').id, 'home');
  assert.equal(view.nav.some(item => item.id === 'casino'), false);
  view.toggleNavigation();
  assert.equal(instance.renderVals().navigationExpanded, true);
  instance.go('city');
  view = instance.renderVals();
  assert.equal(view.navigationExpanded, false);
  assert.equal(view.nav.find(item => item.current === 'page').id, 'city');
  assert.equal(view.currentScreen, 'city');
  assert.equal(view.nav.length, SCREENS.length);
  instance.state.lang = 'ar';
  assert.match(instance.renderVals().navigationLabel, /[\u0600-\u06ff]/);
});

test('accessible HUD values follow authoritative resources and caps', () => {
  const { instance } = game();
  instance.applyServerPlayer({ energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 160, max_nerve: 55, max_happy: 6000, max_life: 4000, resources_updated_at: new Date(1800000).toISOString() });
  const bars = instance.renderVals().bars;
  assert.deepEqual(Array.from(bars, bar => [bar.id, bar.value, bar.max]), [['energy', 44, 160], ['nerve', 7, 55], ['happy', 88, 6000], ['life', 99, 4000]]);
  instance.state.lang = 'ar';
  assert.match(instance.renderVals().bars[0].label, /[\u0600-\u06ff]/);
});

test('game presentation retains published navigation and uses real scene assets in both languages', () => {
  const { instance, SCREENS } = game({ manifest: { modules: { casino: false } } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    for (const screen of SCREENS) {
      instance.state.screen = screen;
      const view = instance.renderVals();
      assert.deepEqual(Array.from(view.nav, item => item.id), Array.from(SCREENS));
      assert.ok(view.nav.every(item => /^#[a-f0-9]{6}$/i.test(item.iconColor)));
      assert.ok(view.nav.every(item => /^url\(\/assets\/ui\/icons\/[a-z]+\.svg\)$/.test(item.iconImage)));
      assert.ok(view.nav.filter(item => item.groupStart).every(item => item.groupLabel.length > 0));
      assert.match(view.sceneArt, /^\/art\/[a-z0-9_]+\.(jpg|png)$/);
      assert.ok(readFileSync(resolve(root, view.sceneArt.slice(1))).length > 0);
    }
  }
});

test('character stats remain available before the optional activity adapter loads', () => {
  const { instance } = game();
  instance.applyServerPlayer({ strength: 301, defense: 202, speed: 103, dexterity: 404 });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const activity = instance.renderVals().activity;
    assert.equal(activity.available, false);
    assert.deepEqual(Array.from(activity.stats, row => row.value), ['301', '202', '103', '404']);
    assert.ok(activity.stats.every(row => row.label.length > 0));
  }
});

test('daily panel loads without claiming and a claim refreshes the main authoritative wallet', async () => {
  let claimed = false;
  const { instance, calls } = game({ modules: true, fetchImpl: async (path, options) => {
    if (options?.method === 'POST') claimed = true;
    const value = path === '/api/v1/player' ? { player: { id: 'p1', username: 'Vincenzo', cash: 999, login_streak: 2, last_login_day: claimed ? '2026-10-04' : null } }
      : path === '/api/v1/gameplay' ? { state: { version: 1 }, player: { cash: claimed ? 777 : 100 } }
      : path === '/api/v1/daily/contract' ? { contract: { id: 'daily1', day: '2026-10-04', metric: 'crimes', name_en: 'Commit crimes', name_ar: 'نفّذ جرائم', reward_cash: 50 }, progress: 1, target: 1, complete: true, claimed: false }
      : path.includes('achievements') ? { achievements: [] } : path.includes('notifications') ? { notifications: [] }
      : path === '/api/v1/daily/login' ? { streak: { rewardCash: 677, streakDay: 3 } } : {};
    return { ok: true, json: async () => value };
  } });
  instance.gameplayReady = true;
  await instance.loadPlayerActivity();
  assert.equal(calls.some(call => call.options?.method === 'POST'), false);
  assert.equal(instance.renderVals().activity.contract.title, 'Commit crimes');
  await instance.claimPlayerReward('login');
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
  assert.equal(calls.find(call => call.options?.method === 'POST').path, '/api/v1/daily/login');
  assert.equal(instance.p.cash, 777);
  instance.state.lang = 'ar';
  assert.equal(instance.renderVals().activity.contract.title, 'نفّذ جرائم');
});

test('daily reward controls preserve preview and transit guards', async () => {
  const preview = game({ modules: true, preview: true });
  await preview.instance.loadPlayerActivity(); await preview.instance.claimPlayerReward('login');
  assert.equal(preview.calls.length, 0);
  const transit = game({ modules: true }); transit.instance.gameplayReady = true;
  transit.instance.p.travel = { status: 'traveling' };
  await transit.instance.claimPlayerReward('daily');
  assert.equal(transit.calls.some(call => call.options?.method === 'POST'), false);
});

test('casino art follows authoritative rank including Ace high without adding a suit to the bet', () => {
  const { instance } = game();
  instance.state.casino.card = 14;
  assert.equal(instance.renderVals().casino.spriteX, -2);
  instance.state.casino.card = 13;
  assert.equal(instance.renderVals().casino.spriteX, -878);
  instance.state.casino.card = 2;
  assert.equal(instance.renderVals().casino.spriteX, -75);
});

test('stale high-low rounds refresh the visible card without placing a replacement bet', async () => {
  const { instance, calls, T } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'The card changed. Refresh before playing.' }) }
    : { ok: true, json: async () => path === '/api/v1/player' ? { player: { cash: 55000 } } : { card: 12, version: 3 } } });
  instance.gameplayReady = true; instance.casinoReady = true; instance.state.casino.version = 1;
  await assert.rejects(instance.casinoGuess(true, T.en), /card changed/);
  assert.equal(instance.state.casino.card, 12); assert.equal(instance.state.casino.version, 3);
  assert.equal(instance.casinoReady, true); assert.equal(instance.casinoBusy, false);
  assert.equal(instance.p.cash, 55000); assert.equal(calls.filter(item => item.options?.method === 'POST').length, 1);
});

test('gym quote matches server cost and bounded randomized gain without removing the ladder', () => {
  const { instance } = game();
  instance.applyServerPlayer({ happy: 500, max_happy: 5000, energy: 4, max_energy: 150, strength: 1000, defense: 1000, speed: 1000, dexterity: 1000 });
  instance.territoryMap = { playerFactionId: 'mine', blocks: [
    { ownerFactionId: 'mine', state: 'owned', benefits: [{ key: 'gym_bonus', value: 1000 }] },
    { ownerFactionId: 'other', state: 'owned', benefits: [{ key: 'gym_bonus', value: 9000 }] },
  ] };
  const view = instance.renderVals();
  assert.equal(view.gymEnergy, 5); assert.equal(view.trainOff, true);
  assert.ok(view.gyms.length > 1); assert.equal(view.gyms[0].energy, 5); assert.equal(view.gyms.at(-1).energy, 10);
  assert.ok(view.stats.every(stat => stat.gain === '12 - 14'));
  instance.p.eduDone.fit = true; instance.p.fac.ups.gymBoost = true;
  assert.ok(instance.renderVals().stats.every(stat => stat.gain === '13 - 17'));
});

test('local activity XP cannot interpret cumulative server XP as a series of level-ups', () => {
  const { instance, T } = game(); instance.applyServerPlayer({ level: 12, xp: 4982 });
  const points = instance.p.points; instance.addXp(10);
  assert.equal(instance.p.level, 12); assert.equal(instance.p.xp, 4982);
  assert.equal(instance.p.points, points); assert.equal(instance.p.localXp, 10);
  assert.equal(instance.renderVals().statusRows.find(row => row.k === T.en.xp).v, '2,818');
});

test('an older player GET cannot overwrite a newer action response', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.syncPlayer(); instance.applyServerPlayer({ cash: 500 });
  settle({ ok: true, json: async () => ({ player: { cash: 100 } }) }); await pending;
  assert.equal(instance.p.cash, 500);
});

test('both embedded 3D viewer message handlers reject foreign origins and sibling frames', () => {
  for (const name of ['character3d.html', 'weapon3d.html']) {
    const packed = readFileSync(resolve(root, 'dist', name), 'utf8');
    const template = JSON.parse(packed.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
    const handler = template.match(/addEventListener\('message', e => \{([\s\S]*?)\}\);/)[1];
    const parent = {}, changes = [];
    const context = createContext({ parent, location: { origin: 'http://zone.test' }, setLanguage: lang => changes.push(lang), stage: { dataset: { zoneAssetState: 'ready' }, setLanguage: lang => changes.push(lang) }, itemStatus() {}, setBg() {}, bg() {}, document: { documentElement: {} } });
    runInContext(`globalThis.receive = e => {${handler}};`, context);
    context.receive({ source: parent, origin: 'https://foreign.test', data: { lang: 'ar' } });
    context.receive({ source: {}, origin: 'http://zone.test', data: { lang: 'ar' } });
    assert.equal(changes.length, 0); assert.equal(context.document.documentElement.lang, undefined);
    context.receive({ source: parent, origin: 'http://zone.test', data: { lang: 'ar' } });
    assert.equal(name === 'character3d.html' ? changes[0] : context.document.documentElement.lang, 'ar');
  }
});

test('jobs display selected-role wages and energy including completed education benefits', () => {
  const { instance } = game(); instance.applyServerPlayer({ level: 12, energy: 14 });
  const view = instance.renderVals();
  assert.equal(view.job.pay, '$850'); assert.equal(view.job.energy, 15); assert.equal(view.job.disabled, true);
  assert.equal(view.jobs.length, 6); assert.equal(view.jobs[2].pay, '$4,200');
  instance.p.job = 'clinic'; instance.p.eduDone.biz = true;
  assert.equal(instance.renderVals().job.pay, '$4,620'); assert.equal(instance.renderVals().job.energy, 20);
});

test('admin preview uses an isolated save and never bootstraps or submits gameplay API calls', async () => {
  const liveSave = game().instance.p;
  const { instance, calls, storage, T, frames } = game({ preview: true, liveSave });
  const liveBefore = storage.get('zone.v2.save'), cashBefore = instance.p.cash, equipBefore = instance.p.equip;
  instance.componentDidMount(); instance.save();
  assert.ok(storage.has('zone.v2.preview.save')); assert.equal(storage.get('zone.v2.save'), liveBefore);
  let acted = false; instance.act(() => { acted = true; }); instance.resolve('preview', 1, () => { acted = true; });
  await Promise.all([
    instance.territoryAction({ blockId: 'ZC-001', action: 'capture' }), instance.commitManaged({ id: 'trash' }, T.en),
    instance.train('str', T.en), instance.casinoGuess(true, T.en), instance.bankMove('deposit', 1000, T.en),
    instance.healSelf(T.en), instance.travel('Dubai'), instance.work(T.en),
  ]);
  instance.onMsg({ source: frames['zone-char-3d'].contentWindow, origin: 'http://zone.test', data: { zoneEquip: 'revolver' } });
  instance.onMsg({ source: frames['zone-city-map'].contentWindow, origin: 'http://zone.test', data: { zoneTravel: { energy: 10, metres: 50 } } });
  assert.equal(acted, false); assert.equal(calls.length, 0); assert.equal(instance.p.cash, cashBefore); assert.equal(instance.p.equip, equipBefore);
  assert.equal(storage.get('zone.v2.save'), liveBefore);
  instance.go('city'); assert.equal(instance.state.screen, 'city');
  const view = instance.renderVals(); assert.equal(view.preview, true); assert.match(view.previewNotice, /read-only/);
  view.toggleLang(); assert.match(instance.renderVals().previewNotice, /للقراءة فقط/);
  view.toggleTheme(); assert.equal(instance.state.theme, 'light');
  assert.equal(storage.get('zone.v2.save'), liveBefore);
});

test('preview direct jail/hospital recovery buttons cannot alter the snapshot', () => {
  const { instance } = game({ preview: true });
  const cash = instance.p.cash, kits = instance.p.inv.smallkit;
  instance.p.jailUntil = 1900000; instance.renderVals().status.act();
  assert.equal(instance.p.cash, cash); assert.equal(instance.p.jailUntil, 1900000);
  instance.p.jailUntil = 0; instance.p.hospUntil = 1900000; instance.renderVals().status.act();
  assert.equal(instance.p.inv.smallkit, kits); assert.equal(instance.p.hospUntil, 1900000);
});

test('gameplay snapshot replaces persistent gameplay fields but preserves presentation preferences and event history', () => {
  const { instance } = game();
  const log = instance.p.log; instance.state.lang = 'ar'; instance.p.lang = 'ar';
  instance.applyGameplay({ player: { cash: 1200 }, state: { version: 4, inv: { knife: 2 }, equip: 'knife', prop: 'shack', ownedProperties: { shack: 1, apt: 1 }, edu: { id: 'bio', until: 2400000, total: 1200000 }, eduDone: {}, fac: { respect: 6000, ups: {} }, ctr: { buys: 2 }, claimed: {}, gym: 0, gymXp: 0, job: 'grocer', jobPts: 1, points: 4, merits: 2, market: [{ id: 'knife', item: 'knife', price: 2600, qty: 2, base: 2600 }], inmates: [], patients: [] }, catalogs: {} });
  assert.equal(instance.p.cash, 1200); assert.equal(instance.p.inv.knife, 2); assert.equal(instance.p.inv.revolver, undefined);
  assert.equal(instance.p.equip, 'knife'); assert.equal(instance.gameplayVersion, 4); assert.equal(instance.gameplayReady, true);
  assert.equal(instance.p.log, log); assert.equal(instance.p.lang, 'ar'); assert.equal(instance.market[0].price, 2600);
  assert.equal(instance.renderVals().props.find(property => property.name === 'شقة').price, '$0');
});

test('an older gameplay GET cannot overwrite a newer purchase response', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.loadGameplay();
  instance.applyGameplay({ player: { cash: 500 }, state: { version: 3, inv: { knife: 1 } } });
  settle({ ok: true, json: async () => ({ player: { cash: 3100 }, state: { version: 2, inv: {} } }) }); await pending;
  assert.equal(instance.p.cash, 500); assert.equal(instance.p.inv.knife, 1); assert.equal(instance.gameplayVersion, 3);
});

test('published runtime changes update navigation, branding, and categorized crimes in the current client', () => {
  const { instance, SCREENS } = game(); instance.componentDidMount();
  instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 5, manifest: { branding: { name: { en: 'Updated City' } }, modules: { casino: false }, navigation: ['home', 'crimes', 'casino'] } }, content: { crimes: [{ id: 'east', category: 'graf', enabled: true, name_en: 'Published wall', nerve_cost: 7, cash_min: 100, cash_max: 200, xp_reward: 3, success_basis_points: 8000 }] } } });
  assert.equal(instance.renderVals().platformBrand, 'Updated City'); assert.ok(!SCREENS.includes('casino'));
  instance.state.cat = 'graf'; const view = instance.renderVals();
  assert.equal(view.crimes.length, 1); assert.equal(view.crimes[0].name, 'Published wall'); assert.equal(view.crimes[0].nerve, 7);
  assert.doesNotMatch(html, /RELEASE \{\{ releaseVersion \}\}/);
});

test('gameplay mutations send only action identity and displayed version, then use server wallet and inventory', async () => {
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 500 }, state: { version: 8, inv: { knife: 1 }, equip: null }, catalogs: {}, result: { action: 'item.buy', id: 'knife' } }) }) });
  instance.gameplayReady = true; instance.gameplayVersion = 7;
  await instance.gameplayAction('item.buy', 'knife');
  assert.equal(calls[0].path, '/api/v1/gameplay/action');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'item.buy', id: 'knife', expectedVersion: 7 });
  assert.equal(instance.p.cash, 500); assert.equal(instance.p.inv.knife, 1); assert.equal(instance.gameplayVersion, 8);
  assert.equal(instance.p.log[0].a.action, 'item.buy'); assert.match(instance.renderVals().log[0].text, /Bought/);
  instance.state.lang = 'ar'; assert.match(instance.renderVals().log[0].text, /اشتريت/); assert.doesNotMatch(instance.renderVals().log[0].text, /Bought/);
});

test('stale gameplay actions refresh wallet and inventory without replaying the purchase', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'Gameplay changed. Refresh before acting.' }) }
    : { ok: true, json: async () => ({ player: { cash: 900 }, state: { version: 9, inv: { bat: 3 } }, catalogs: {} }) } });
  instance.gameplayReady = true; instance.gameplayVersion = 7;
  await assert.rejects(instance.gameplayAction('item.buy', 'knife'), /Gameplay changed/);
  assert.equal(instance.p.cash, 900); assert.equal(instance.p.inv.bat, 3); assert.equal(instance.gameplayVersion, 9);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
});

test('item market and direct recovery controls dispatch server actions instead of writing a local wallet', async () => {
  const { instance } = game(); instance.gameplayReady = true; const actions = []; const before = instance.p.cash;
  instance.gameplayAction = async (action, id) => { actions.push({ action, id }); };
  await instance.renderVals().market[0].buy();
  await instance.renderVals().props.find(prop => !prop.living).buy();
  instance.p.jailUntil = 1900000; await instance.renderVals().status.act();
  instance.p.jailUntil = 0; instance.p.hospUntil = 1900000; await instance.renderVals().status.act();
  assert.deepEqual(actions.map(action => action.action), ['market.buy', 'property.buy', 'jail.bailSelf', 'item.use']);
  assert.equal(instance.p.cash, before);
});

test('combat uses server encounter versions and cannot locally award the finish reward', async () => {
  const replies = [
    { version: 1, encounter: null, player: { cash: 1000, energy: 50 } },
    { version: 2, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 0, startPlayerHp: 100, playerMaxHp: 100, enemyMaxHp: 80, playerHp: 100, enemyHp: 80, log: [] }, player: { cash: 1000, energy: 25 } },
    { version: 3, encounter: { opponentId: 'rayan', phase: 'won', turn: 1, startPlayerHp: 100, playerMaxHp: 100, enemyMaxHp: 80, playerHp: 90, enemyHp: 0, log: [{ n: 1, side: 'opp', actor: 'player', d: 80, yl: 90, ol: 0 }] }, player: { cash: 1000, energy: 25, life: 90 } },
    { version: 4, encounter: null, player: { cash: 1250, energy: 25, life: 90 }, result: { approach: 'mug', cashDelta: 250 } },
  ];
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => replies.shift() }) });
  instance.gameplayReady = true; await instance.loadCombat(); await instance.combatAction('start', { opponentId: 'rayan' });
  assert.equal(instance.p.cash, 1000); assert.equal(instance.cur('energy'), 25);
  await instance.combatAction('strike'); assert.equal(instance.renderVals().fight.canFinish, true);
  await instance.combatAction('finish', { approach: 'mug' });
  assert.equal(instance.p.cash, 1250); assert.equal(instance.state.fight, null);
  assert.deepEqual(calls.filter(call => call.options?.method === 'POST').map(call => JSON.parse(call.options.body).expectedVersion), [1, 2, 3]);
});

test('all 70 map locations resolve to enabled destinations or explicitly unavailable services', () => {
  const { instance, messages, SCREENS } = game(); instance.pushMap();
  const pins = messages.find(message => message.data.type === 'ZONE_MAP_DATA').data.zonePins;
  assert.equal(pins.length, 70);
  for (const pin of pins) {
    assert.equal(pin.screenAvailable, SCREENS.includes(pin.screen), pin.id);
    if (pin.screenAvailable) assert.ok(pin.screenLabel, pin.id);
    else assert.ok(['points', 'church'].includes(pin.screen), pin.id);
  }
  assert.ok(pins.some(pin => pin.id === 'sweetshop' && pin.screen === 'market'));
  instance.go('sweetshop'); assert.equal(instance.state.screen, 'market');
  instance.go('church'); assert.equal(instance.state.screen, 'market'); assert.match(instance.state.toast.text, /unavailable/);
  const disabled = game({ manifest: { modules: { market: false } } }); disabled.instance.pushMap();
  assert.ok(disabled.messages.find(message => message.data.type === 'ZONE_MAP_DATA').data.zonePins.filter(pin => pin.screen === 'market').every(pin => pin.screenAvailable === false));
});

test('navigation maintains deep links, locale and browser back without duplicate history entries', () => {
  const { instance, history, location, listeners } = game({ route: '?screen=market&lang=en' }); instance.componentDidMount();
  assert.equal(instance.state.screen, 'market');
  instance.go('items'); assert.equal(location.searchParams.get('screen'), 'items'); assert.equal(history.length, 1);
  instance.go('items'); assert.equal(history.length, 1);
  instance.renderVals().toggleLang(); assert.equal(location.searchParams.get('lang'), 'ar'); assert.equal(history.at(-1).method, 'replaceState');
  const count = history.length;
  location.href = 'http://zone.test/?screen=market&lang=en'; listeners.popstate();
  assert.equal(instance.state.screen, 'market'); assert.equal(instance.state.lang, 'en'); assert.equal(history.length, count);
});

test('reload keeps cached merchant stock and NPC lists while the authoritative snapshot loads', () => {
  const save = game().instance.p;
  save.market = [{ id: 'drink', item: 'drink', price: 990, base: 990, qty: 39, seller: 'Sami' }]; save.inmates = []; save.patients = [];
  const { instance } = game({ liveSave: save });
  assert.equal(instance.renderVals().market[0].qty, 39); assert.equal(instance.renderVals().inmates.length, 0); assert.equal(instance.renderVals().patients.length, 0);
});

test('known backend errors remain readable in Arabic and preserve English detail in English', () => {
  const { instance } = game();
  const messages = ['Not enough cash.', 'Not enough energy.', 'Not enough nerve.', 'Gameplay changed. Refresh before acting.', 'You do not own this item.', 'Resources already full.', 'Mission already claimed.', 'Leave jail or hospital first.', 'A course is already active.', 'Gym is locked.', 'Module unavailable.', 'Failed to fetch'];
  for (const message of messages) {
    assert.equal(instance.serverError(new Error(message)), message);
    instance.state.lang = 'ar'; const translated = instance.serverError(new Error(message));
    assert.match(translated, /[\u0600-\u06ff]/); assert.doesNotMatch(translated, /[a-z]/i);
    instance.state.lang = 'en';
  }
});

test('runtime polling applies a changed publication once without reloading and retains the last state offline', async () => {
  const runtime = readFileSync(resolve(root, 'platform-runtime.js'), 'utf8');
  const events = [], storage = new Map(), tokens = {}, listeners = {}; let reloads = 0, calls = 0, offline = false;
  const remote = { release: { id: 'release-2', version: 2, manifest: { schemaVersion: 1, branding: { accent: '#123456' }, modules: { casino: false } } }, content: { crimes: [{ id: 'published' }], activeTheme: 'zone-dark' } };
  const context = createContext({ URLSearchParams, console, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    location: { search: '', reload() { reloads++; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {}, style: { setProperty(key, value) { tokens[key] = value; } } }, visibilityState: 'visible' },
    window: { dispatchEvent(event) { events.push(event); } }, addEventListener(name, callback) { listeners[name] = callback; }, setInterval() {},
    fetch: async () => { calls++; if (offline) throw new Error('Network unavailable'); return { ok: true, json: async () => remote }; },
  });
  runInContext(runtime, context); const platform = context.window.ZonePlatform;
  await Promise.all([platform.refresh(), platform.refresh()]); assert.equal(calls, 1); assert.equal(platform.active().version, 2);
  assert.equal(events[0].detail.changed, true); assert.equal(tokens['--acc'], '#123456');
  await platform.refresh(); assert.equal(events.at(-1).detail.changed, false); assert.equal(reloads, 0);
  offline = true; await assert.rejects(platform.refresh(), /Network/);
  assert.equal(platform.status(), 'offline'); assert.equal(platform.active().version, 2); assert.equal(events.at(-1).detail.changed, false); assert.equal(reloads, 0);
});

test('travel debits only the server fare and waits for server arrival across reloads', async () => {
  const trip = { origin: 'Zone City', destination: 'Dubai', departedAt: new Date(1800000).toISOString(), arrivesAt: new Date(3600000).toISOString(), status: 'traveling', remainingSeconds: 1800, version: 1 };
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 7500, city: 'Zone City' }, travel: trip }) }) });
  instance.applyGameplay({ player: { cash: 10000, city: 'Zone City' }, state: { version: 1 }, travel: null });
  assert.equal(instance.travelReady, true);
  await instance.travel('Dubai'); await instance.travel('Cairo');
  assert.equal(calls.length, 1); assert.equal(instance.p.cash, 7500); assert.equal(instance.p.city, 'Zone City');
  assert.equal(instance.renderVals().travelStatus.left, '30:00'); assert.ok(instance.renderVals().travelDests.every(city => city.disabled));
  assert.doesNotMatch(instance.state.toast.text, /Arrived/);
  const restored = game({ now: 1860000, liveSave: instance.p });
  assert.equal(restored.instance.renderVals().travelStatus.left, '29:00');
  const arrived = game({ now: 3660000, liveSave: instance.p, fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 7500, city: 'Dubai' }, travel: { ...trip, status: 'arrived', remainingSeconds: 0 } }) }) });
  assert.equal(arrived.instance.p.city, 'Zone City'); assert.match(arrived.instance.renderVals().travelStatus.left, /Confirming/);
  await arrived.instance.loadTravel(); assert.equal(arrived.instance.p.city, 'Dubai'); assert.equal(arrived.instance.renderVals().travelStatus.active, false);
  arrived.instance.applyTravel(trip); assert.equal(arrived.instance.p.travel.status, 'arrived');
});

test('a gameplay read started before departure cannot erase an active journey', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.loadGameplay();
  instance.applyTravel({ version: 1, status: 'traveling', destination: 'Cairo', remainingSeconds: 1800 });
  settle({ ok: true, json: async () => ({ state: { version: 2 }, travel: null }) }); await pending;
  assert.equal(instance.p.travel.destination, 'Cairo');
});

test('restored combat shows the current server health rather than an old combat log', () => {
  const { instance } = game();
  instance.applyCombat({ version: 4, player: { life: 750 }, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 1, startPlayerHp: 900, playerMaxHp: 1000, playerHp: 750, enemyHp: 70, enemyMaxHp: 100, log: [{ n: 1, side: 'you', d: 200, yl: 600, ol: 70 }] } });
  const view = instance.renderVals().fight; assert.equal(view.paused, true); assert.equal(view.youLife, '750'); assert.equal(view.youPct, 75);
});

test('territory actions apply server energy and refresh map plus wallet after stale versions', async () => {
  const blocks = Array.from({ length: 120 }, (_, i) => ({ id: 'ZC-' + String(i + 1).padStart(3, '0'), version: 1, action: 'capture' }));
  let stale = false;
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? stale ? { ok: false, status: 409, json: async () => ({ error: 'Territory changed. Refresh first.' }) } : { ok: true, json: async () => ({ player: { energy: 90 }, map: { blocks, revision: 2 } }) }
    : { ok: true, json: async () => path.includes('city/map') ? { blocks: blocks.map(block => ({ ...block, version: 3 })), revision: 3 } : { player: { energy: 75, cash: 4500 } } } });
  instance.gameplayReady = true; instance.territoryMap = { blocks, revision: 1 }; instance.applyServerPlayer({ energy: 100 });
  await instance.territoryAction({ blockId: 'ZC-001', action: 'capture' }); assert.equal(instance.cur('energy'), 90);
  stale = true; await instance.territoryAction({ blockId: 'ZC-001', action: 'capture' });
  assert.equal(instance.cur('energy'), 75); assert.equal(instance.p.cash, 4500); assert.equal(instance.territoryMap.revision, 3);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 2);
});

test('rendering saved faction progress never creates a war timer or resets the persisted chain', () => {
  const { instance } = game(); instance.p.fac.warEnd = 0; instance.p.fac.chain = 5; instance.p.fac.chainAt = 0;
  const before = JSON.stringify(instance.p); const view = instance.renderVals();
  assert.equal(view.fac.chain, 0); assert.equal(instance.p.fac.chain, 5); assert.equal(instance.p.fac.warEnd, 0); assert.equal(JSON.stringify(instance.p), before);
});

test('hospital shows the authoritative discounted quote even when hospitalized at full life', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => ({ ok: true, json: async () => options?.method === 'POST' ? { player: { cash: 750, life: 100 }, cost: { cash: 250 } } : { player: { cash: 750, life: 100 }, state: { version: 2, hospUntil: 0 }, hospitalQuote: { cost: 0, available: false } } }) });
  instance.applyGameplay({ player: { cash: 1000, life: 100, max_life: 100 }, state: { version: 1, hospUntil: 2000000 }, hospitalQuote: { cost: 250, baseCost: 500, missing: 0, hospitalized: true, available: true, territoryDiscountBasisPoints: 5000 } });
  const view = instance.renderVals(); assert.match(view.status.healLabel, /\$250/); assert.equal(view.status.healDisabled, false);
  await view.hospitalCare.heal(); assert.equal(instance.p.cash, 750); assert.equal(instance.p.hospUntil, 0); assert.equal(instance.renderVals().hospitalCare.disabled, true);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1); assert.equal(calls[0].path, '/api/v1/hospital/heal');
});

test('city and faction refresh territory state on entry and visible thirty-second polls', () => {
  const { instance, intervals } = game(); let reads = 0; instance.loadTerritories = () => { reads++; };
  instance.componentDidMount(); assert.equal(reads, 1);
  instance.go('city'); assert.equal(reads, 2); instance.go('faction'); assert.equal(reads, 3);
  instance.state.tick = 30; intervals[0](); assert.equal(reads, 4);
  instance.go('home'); instance.state.tick = 60; intervals[0](); assert.equal(reads, 4);
});

test('merchant discounts are server quotes and player net worth uses saved assets', () => {
  const { instance } = game();
  instance.applyGameplay({ player: { cash: 1000, bank_balance: 2000 }, state: { version: 1, inv: { knife: 2 }, ownedProperties: { apt: 1 }, market: [{ item: 'drink', price: 911, base: 990, qty: 2, discountBasisPoints: 800 }] } });
  assert.equal(instance.netWorth(), 158200); assert.match(instance.renderVals().marketDiscount, /8%/); assert.equal(instance.renderVals().market[0].price, '$911');
  instance.market[0].discountBasisPoints = 0; assert.equal(instance.renderVals().marketDiscount, '');
});

test('the actual server catalogs produce all19 screen views in both languages', () => {
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  const { instance, SCREENS } = game(); instance.applyGameplay({ player: { level: 12, strength: 240, defense: 180, speed: 210, dexterity: 165 }, state: { version: 1 }, catalogs });
  for (const lang of ['en', 'ar']) for (const screen of SCREENS) { instance.state.lang = lang; instance.state.screen = screen; assert.equal(instance.renderVals().is[screen], true); }
  assert.equal(instance.renderVals().opps[0].str, String(catalogs.opponents[0].str));
});

test('fresh clients disable mutations and direct handlers never send a POST before gameplay hydration', async () => {
  const { instance, T, calls } = game({ fetchImpl: async () => { throw new Error('Offline'); } });
  const view = instance.renderVals(); assert.ok(view.opps.every(opponent => opponent.disabled)); assert.equal(view.trainOff, true); assert.equal(view.job.disabled, true); assert.ok(view.market.every(item => item.disabled));
  instance.casinoReady = true;
  await Promise.all([instance.train('str', T.en), instance.work(T.en), instance.commitManaged({ id: 'trash' }, T.en), instance.combatAction('start', { opponentId: 'rayan' }), instance.casinoGuess(true, T.en), instance.gameplayAction('item.buy', 'knife'), instance.bankMove('deposit', 100, T.en), instance.healSelf(T.en), instance.travel('Cairo'), instance.territoryAction({ blockId: 'ZC-001', action: 'capture' })]);
  assert.ok(calls.every(call => call.options?.method !== 'POST'));
  instance.applyGameplay({ state: { version: 1 } }); assert.equal(instance.renderVals().job.disabled, false);
});

test('reload shows the last server catalog immediately but keeps actions locked until fresh hydration', () => {
  const { instance } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  catalogs.opponents[0].str = 123;
  instance.applyGameplay({ state: { version: 1 }, catalogs });
  const restored = game({ liveSave: instance.p }).instance;
  assert.equal(restored.renderVals().opps[0].str, '123'); assert.equal(restored.renderVals().opps[0].disabled, true); assert.equal(restored.gameplayReady, undefined);
});

test('an active course visibly disables other enrollments until the server completes it', () => {
  const { instance, T } = game();
  instance.applyGameplay({ player: { cash: 100000 }, state: { version: 1, edu: { id: 'bio', until: 3000000, total: 1200000 }, eduDone: {} } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const courses = instance.renderVals().courses;
    assert.ok(courses.every(course => course.disabled && course.fg === 'var(--mu)'));
    assert.equal(courses.filter(course => course.btn === T[lang].studying).length, 1);
    assert.ok(courses.every(course => course.bg === courses[0].bg));
  }
  instance.applyGameplay({ state: { version: 2, edu: null, eduDone: { bio: 1 } } });
  assert.ok(instance.renderVals().courses.some(course => !course.disabled && course.fg === 'var(--onAcc)'));
});

test('map benefit activity survives the parent payload for active and planned benefits', () => {
  const { instance, messages } = game();
  instance.territoryMap = { revision: 7, blocks: [true, false].map((active, i) => ({ id: 'ZC-00' + (i + 1), benefits: [{ key: 'medical_discount', name: { en: 'Medical network', ar: 'شبكة طبية' }, value: 500, unit: 'basis_points', active }] })) };
  instance.pushMap(); const payload = messages.find(message => message.data.type === 'ZONE_MAP_DATA').data;
  assert.equal(payload.blocks[0].benefit.active, true); assert.equal(payload.blocks[1].benefit.active, false);
  assert.equal(payload.blocks[0].benefit.value, 500); assert.equal(payload.blocks[0].benefit.label, 'Medical network');
});

test('travel disables gameplay controls while navigation, themes, and item inspection remain usable', () => {
  const { instance } = game();
  instance.applyGameplay({ player: { cash: 100000 }, state: { version: 1 }, travel: { version: 1, destination: 'Dubai', status: 'traveling', remainingSeconds: 1800 } });
  instance.applyCombat({ version: 1, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 0, playerHp: 100, enemyHp: 100, enemyMaxHp: 100, playerMaxHp: 100, log: [] } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals();
    for (const key of ['crimes','gyms','opps','upgrades','inv','jobs','market','missions','courses','props','inmates','patients','travelDests']) assert.ok(view[key].every(item => item.disabled), `${lang}/${key}`);
    assert.ok(view.inmates.every(item => item.bailDisabled)); assert.ok([...view.bank.deposits, ...view.bank.withdrawals].every(item => item.disabled));
    assert.equal(view.trainOff, true); assert.equal(view.job.disabled, true); assert.equal(view.casino.disabled, true); assert.equal(view.hospitalCare.disabled, true);
    assert.equal(view.fight.disabled, true); assert.equal(view.fight.canFinish, false); assert.equal(view.travelStatus.active, true);
    assert.match(view.travelStatus.notice, lang === 'en' ? /arrival is confirmed/ : /تأكيد الوصول/);
  }
  instance.go('items'); assert.equal(instance.state.screen, 'items');
  const view = instance.renderVals(), beforeTheme = instance.state.theme; view.toggleTheme(); assert.notEqual(instance.state.theme, beforeTheme);
  view.inv.at(-1).select(); assert.equal(instance.renderVals().sel.name, view.inv.at(-1).name);
  view.outfits[1].go(); assert.equal(instance.state.outfit, 'suit');
});

test('direct mutations stay blocked at zero travel time until authoritative arrival confirmation', async () => {
  const { instance, T, calls } = game();
  instance.applyGameplay({ state: { version: 1 }, travel: { version: 1, destination: 'Dubai', status: 'traveling', remainingSeconds: 0 } });
  const before = JSON.stringify(instance.p);
  await Promise.all([instance.train('str', T.en), instance.work(T.en), instance.commitManaged({ id: 'trash' }, T.en), instance.combatAction('start', { opponentId: 'rayan' }), instance.casinoGuess(true, T.en), instance.gameplayAction('item.buy', 'knife'), instance.bankMove('deposit', 100, T.en), instance.healSelf(T.en), instance.travel('Cairo'), instance.territoryAction({ blockId: 'ZC-001', action: 'capture' })]);
  assert.equal(calls.length, 0); assert.equal(JSON.stringify(instance.p), before); assert.equal(instance.renderVals().job.disabled, true);
  assert.match(instance.state.toast.text, /arrival is confirmed/); assert.match(instance.renderVals().travelStatus.left, /Confirming arrival/);
  instance.applyTravel({ version: 1, status: 'arrived', destination: 'Dubai', remainingSeconds: 0 });
  assert.equal(instance.allowGameplay(), true); assert.equal(instance.renderVals().job.disabled, false);
});

test('map actions update their transit eligibility without a territory revision change', () => {
  const { instance, messages } = game(); instance.gameplayReady = true;
  instance.territoryMap = { revision: 7, blocks: [{ id: 'ZC-001', action: 'capture' }] };
  instance.pushMap(); assert.equal(messages.at(-1).data.blocks[0].canAct, true);
  instance.applyTravel({ version: 1, status: 'traveling', remainingSeconds: 1800 }); instance.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, false); assert.equal(messages.at(-1).data.blocks[0].eligible, false);
  instance.applyTravel({ version: 1, status: 'arrived', remainingSeconds: 0 }); instance.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, true); assert.equal(messages.filter(message => message.data.type === 'ZONE_MAP_DATA').length, 3);
});

test('market purchases guard the displayed quote and refresh a changed price without retrying', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'The market price changed. Refresh and try again.' }) }
    : { ok: true, json: async () => ({ player: { cash: 2000 }, state: { version: 7, inv: { drink: 2 }, market: [{ item: 'drink', price: 990, qty: 40, discountBasisPoints: 0 }] }, catalogs: { items: { drink: { type: 'booster', price: 990 } } } }) } });
  instance.state.lang = 'ar';
  instance.applyGameplay({ player: { cash: 2000 }, state: { version: 7, inv: { drink: 2 }, market: [{ item: 'drink', price: 911, qty: 40, discountBasisPoints: 800 }] } });
  const displayedRow = instance.renderVals().market[0]; assert.equal(displayedRow.price, '$911');
  // Even an in-place quote update cannot alter the price captured by the visible Buy control.
  instance.market[0].price = 990;
  await displayedRow.buy();
  const requests = calls.filter(call => call.options?.method === 'POST'); assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].options.body), { action: 'market.buy', id: 'drink', expectedVersion: 7, expectedPrice: 911 });
  assert.ok(calls.some(call => call.path === '/api/v1/gameplay' && !call.options?.method));
  assert.equal(instance.p.cash, 2000); assert.equal(instance.p.inv.drink, 2); assert.equal(instance.gameplayVersion, 7);
  assert.equal(instance.renderVals().market[0].price, '$990'); assert.equal(instance.p.catalogs.items.drink.price, 990);
  assert.match(instance.state.toast.text, /تغير سعر السوق/); assert.match(instance.serverError(new Error('Market price changed. Refresh and try again.')), /تغير سعر السوق/);
});

test('published catalog names and values update without reload and rollback restores fallback names', async () => {
  const { instance, T } = game(); instance.componentDidMount(); await instance._gameplayLoad;
  const original = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  const changed = structuredClone(original), baseline = JSON.parse(JSON.stringify(T));
  const labels = { items: 'items', jobs: 'jobNames', gyms: 'gyms', courses: 'courses', properties: 'props', upgrades: 'up', opponents: 'opp', missions: 'ms' };
  const keys = {};
  for (const [category, label] of Object.entries(labels)) {
    const record = category === 'items' ? Object.values(changed.items)[0] : changed[category][0];
    keys[category] = category === 'items' ? Object.keys(changed.items)[0] : category === 'gyms' ? '0' : record.id;
    record.name = { en: 'Published ' + category, ar: 'منشور ' + category };
  }
  changed.jobs[0].pay = 1234;
  instance.onRuntime({ detail: { changed: true, release: { version: 2, manifest: {} }, content: { gameplayCatalog: changed } } });
  for (const [category, label] of Object.entries(labels)) for (const lang of ['en', 'ar']) {
    const value = T[lang][label][keys[category]], name = Array.isArray(value) ? value[0] : value;
    assert.equal(name, (lang === 'en' ? 'Published ' : 'منشور ') + category, `${lang}/${category}`);
  }
  instance.state.lang = 'en'; assert.equal(instance.renderVals().jobs[0].name, 'Published jobs'); assert.match(instance.renderVals().jobs[0].pay, /1,234/);
  instance.onRuntime({ detail: { changed: true, release: { version: 1, manifest: {} }, content: { gameplayCatalog: original } } });
  for (const [category, label] of Object.entries(labels)) for (const lang of ['en', 'ar']) assert.equal(JSON.stringify(T[lang][label][keys[category]]), JSON.stringify(baseline[lang][label][keys[category]]), `${lang}/${category} fallback`);
  assert.equal(instance.p.catalogs.jobs[0].pay, original.jobs[0].pay);
});

test('hydrated and rolled-back catalogs retain all extended armory display names', () => {
  const { instance, CAT, T } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  instance.applyGameplay({ state: { version: 1, inv: { assaultrifle2_1: 1 } }, catalogs });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    for (const id of Object.keys(CAT)) assert.ok(T[lang].items[id], `${lang}/${id}`);
    assert.ok(instance.renderVals().inv[0].name);
    instance.state.itemTab = 'armory'; assert.ok(instance.renderVals().inv.every(item => item.name));
    instance.state.itemTab = 'all';
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const css = readFileSync(new URL('../assets/ui/home-gym.css', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../assets/weapons/catalog.js', import.meta.url), 'utf8');
const home = html.slice(html.indexOf('<!-- HOME -->'), html.indexOf('<!-- CRIMES -->'));
const gym = html.slice(html.indexOf('<!-- GYM -->'), html.indexOf('<!-- CITY -->'));

test('narrow Home puts the real first action before optional hideout atmosphere, without changing desktop order', () => {
  const mobile = css.slice(css.indexOf('@media (max-width:650px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(mobile, /\.zone-home-objective\s*\{\s*order:0;/);
  assert.match(mobile, /\.zone-home-objective\s*\{[^}]*padding:12px;/);
  assert.match(mobile, /\.zone-home-objective-progress\s*\{\s*margin-block:5px 8px;/);
  assert.match(mobile, /\.zone-hideout-scene\s*\{\s*order:1;/);
  assert.match(mobile, /\.zone-home-resource-strip\s*\{\s*order:2;/);
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (max-width:650px)')), /(?:^|[;{\s])order:\s*[012]/);
});

function game(lang = 'en', fetchImpl) {
  const timers = [], calls = [], notices = [], frames = {};
  const location = new URL('https://zone.test/?screen=gym&lang=' + lang);
  const context = createContext({
    console, URL, URLSearchParams, Date,
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById: id => frames[id] || null },
    window: { location, history: { pushState() {}, replaceState() {} }, ZonePlatform: { preview: false, active: () => ({ version: 1, manifest: {} }), data: () => ({}) }, addEventListener() {}, dispatchEvent() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    React: { createElement: () => ({}) },
    DCLogic: class { constructor(props) { this.props = props; } setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); } forceUpdate() {} },
    fetch: async (path, options) => { calls.push({ path, options }); if (!fetchImpl) throw new Error('Unexpected network request'); return fetchImpl(path, options); },
  });
  runInContext(catalog, context);
  runInContext(source + '\nglobalThis.exports = { Component, T };', context);
  const instance = new context.exports.Component({});
  instance.toast = message => notices.push(message);
  instance.applyServerPlayer({ id: 'ordinary-player', username: 'Novice', level: 1, cash: 2500, energy: 100, max_energy: 100, nerve: 15, max_nerve: 15, happy: 100, max_happy: 100, life: 250, max_life: 250, strength: 10, defense: 10, speed: 10, dexterity: 10 });
  instance.gameplayReady = true; instance.runtimeConnection = 'connected'; instance.p.gym = 0; instance.p.gymXp = 0;
  instance.p.inv = { smallkit: 1 }; instance.p.equip = 'fists';
  return { instance, timers, calls, notices, T: context.exports.T };
}

test('Home owns a coherent objective, real resources and existing character/equipment interface without replacing the shell', () => {
  assert.match(home, /class="zone-panel zone-home-brief"/);
  assert.match(home, /data-home-objective="open" onClick="\{\{ fieldGuide\.open \}\}"/);
  assert.match(home, /data-home-objective="claim"[^>]*disabled="\{\{ homeBase\.goal\.disabled \}\}"/);
  assert.match(home, /data-home-resource="\{\{ r\.id \}\}"/);
  assert.match(home, /id="zone-char-3d"/);
  assert.match(home, /data-home-equipment-inspect="1" onClick="\{\{ equippedInspection\.open \}\}"/);
  assert.match(home, /<img sc-camel-src="\{\{ homeBase\.equipment\.image \}\}"/);
  assert.doesNotMatch(home, /<img\s+src="\{\{/);
  assert.ok(html.indexOf('assets/zone-layout.css') < html.indexOf('assets/ui/home-gym.css'));
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:body|:root|\[data-zshell\]|\.zone-sidebar|\.zone-city)[\s{,:]/);
});

test('Home resource amounts and recovery destinations follow the hydrated player in EN and AR without a mutation', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, T } = game(lang);
    const view = instance.renderVals();
    assert.deepEqual(Array.from(view.homeBase.resources, resource => resource.value), [100, 15, 100, 250]);
    const routes = ['gym', 'crimes', 'properties', 'hospital'];
    for (const [index, resource] of view.homeBase.resources.entries()) {
      assert.equal(resource.label, T[lang][resource.id]);
      assert.equal(resource.destination, T[lang].nav[routes[index]]); resource.open();
      assert.equal(instance.state.screen, routes[index]);
    }
    assert.equal(calls.filter(call => call.options?.method && call.options.method !== 'GET').length, 0); assert.equal(instance.p.cash, 2500);
  }
});

test('Home never invents an equipped owned weapon or picture from a stale equipment ID', () => {
  const { instance, T } = game();
  instance.p.equip = 'bat'; let equipment = instance.renderVals().homeBase.equipment;
  assert.equal(equipment.id, 'fists'); assert.equal(equipment.name, T.en.unarmed); assert.equal(equipment.image, ''); assert.equal(equipment.hasImage, false);
  instance.p.inv.bat = 1; equipment = instance.renderVals().homeBase.equipment;
  assert.equal(equipment.id, 'bat'); assert.equal(equipment.name, T.en.items.bat); assert.ok(equipment.image.includes('bat'));
  assert.match(equipment.detail, /multiplier/);
});

test('Home briefing preserves authoritative goal priority and does not hide recovery behind an unfinished tutorial', () => {
  for (const lang of ['en', 'ar']) {
    const { instance } = game(lang);
    instance.onboarding = { currentMissionId: 't4', completed: false, steps: [{ missionId: 't4', counter: 'trains', current: true, progress: 1, target: 4, cash: 4000, points: 2, claimed: false, claimable: false }] };
    let view = instance.renderVals();
    assert.equal(view.homeBase.showGoalProgress, true); assert.equal(view.homeBase.goal.progress, '1/4');
    assert.equal(view.fieldGuide.route, 'gym'); assert.match(view.homeBase.identity, /Novice/);
    instance.p.hospUntil = Date.now() + 60000; view = instance.renderVals();
    assert.equal(view.fieldGuide.route, 'hospital'); assert.equal(view.homeBase.showGoalProgress, false);
    instance.p.hospUntil = 0; instance.runtimeConnection = 'offline'; view = instance.renderVals();
    assert.equal(view.homeBase.showGoalProgress, false); assert.match(view.fieldGuide.description, lang === 'en' ? /Waiting/ : /انتظار/);
  }
});

test('four native gym stations select a focused session without spending money, energy or stat points in both languages', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, T } = game(lang);
    const before = JSON.stringify(instance.p);
    for (const station of instance.renderVals().stats) {
      station.select(); const view = instance.renderVals();
      assert.equal(view.gymSession.id, station.id); assert.equal(view.gymSession.label, T[lang][station.id]);
      assert.equal(view.gymSession.value, station.value); assert.equal(view.stats.filter(stat => stat.selected).length, 1);
      assert.match(view.gymStudio.estimateNote, lang === 'en' ? /server.*actual gain/ : /الخادم.*الفعلي/);
    }
    assert.equal(JSON.stringify(instance.p), before); assert.equal(calls.length, 0);
    instance.state.gymStation = 'cash'; assert.equal(instance.renderVals().gymSession.id, 'str');
  }
  assert.match(gym, /role="group" aria-label="\{\{ gymStudio\.stationLabel \}\}"/);
  assert.match(gym, /data-gym-station="\{\{ s\.id \}\}" aria-pressed="\{\{ s\.selected \}\}"/);
});

test('selected training sends exactly one original authoritative one-session command and renders only returned gains', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { instance, calls, timers } = game('en', async (path, options) => {
    assert.equal(path, '/api/v1/gym/train'); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { stat: 'dexterity', sessions: 1 });
    await gate;
    return { ok: true, json: async () => ({ gain: 7, player: { energy: 95, dexterity: 17, cash: 2500 } }) };
  });
  // Refresh is independently covered by client integration tests. This focused
  // contract verifies the preserved Train command and server-player receipt.
  instance.loadGameplay = async () => {}; instance.renderVals().stats.find(stat => stat.id === 'dex').select();
  const before = JSON.stringify(instance.p); instance.renderVals().gymSession.train();
  assert.equal(instance.renderVals().trainOff, true); assert.equal(instance.renderVals().gymStudio.busy, true);
  instance.renderVals().gymSession.train(); assert.equal(timers.length, 1); assert.equal(JSON.stringify(instance.p), before);
  const pending = timers.shift()(); assert.equal(calls.length, 1);
  assert.equal(instance.p.stats.dex, 10); assert.equal(instance.cur('energy'), 100);
  release(); await pending;
  const view = instance.renderVals();
  assert.equal(instance.p.stats.dex, 17); assert.equal(instance.cur('energy'), 95); assert.equal(instance.p.cash, 2500);
  assert.equal(calls.length, 1); assert.equal(view.trainingBoard.hasEvents, true);
  assert.match(view.trainingBoard.events[0].text, /7\.00/); assert.equal(view.gymStudio.busy, false);
});

test('Arabic Defense selection survives repeated view refreshes and sends the actual defense command, not Strength', async () => {
  const { instance, calls, timers } = game('ar', async (path, options) => {
    assert.equal(path, '/api/v1/gym/train'); assert.deepEqual(JSON.parse(options.body), { stat: 'defense', sessions: 1 });
    return { ok: true, json: async () => ({ gain: 6, player: { energy: 95, defense: 16, strength: 10, cash: 2500 } }) };
  });
  instance.loadGameplay = async () => {};
  const defense = instance.renderVals().stats.find(stat => stat.id === 'def'); defense.select();
  for (let index = 0; index < 5; index++) {
    const view = instance.renderVals(); assert.equal(instance.state.gymStation, 'def');
    assert.equal(view.gymSession.id, 'def'); assert.equal(view.gymSession.label, 'الدفاع');
    assert.equal(view.stats.find(stat => stat.id === 'def').selected, true);
  }
  instance.renderVals().gymSession.train(); await timers.shift()();
  assert.equal(calls.length, 1); assert.equal(instance.p.stats.def, 16); assert.equal(instance.p.stats.str, 10);
  assert.equal(instance.renderVals().gymSession.id, 'def'); assert.equal(instance.renderVals().trainingBoard.hasEvents, true);
});

test('Gym environment is a bounded scene, separate from energy readout and never stretched to the Train console', () => {
  const scene = gym.slice(gym.indexOf('<div class="zone-gym-floor-scene"'), gym.indexOf('<div class="zone-gym-floor-readout">'));
  assert.match(scene, /<header>/); assert.doesNotMatch(scene, /zone-gym-energy|energyText|energyPct/);
  assert.match(css, /\.zone-gym-floor-scene \{ flex:none; aspect-ratio:16\/9;/);
  const floorRule = css.match(/\.zone-gym-floor \{([^}]+)\}/)[1];
  assert.doesNotMatch(floorRule, /background-size|background-position|url\(|min-height:|gap:48px/);
  assert.match(gym, /zone-gym-floor-readout[^]*zone-gym-energy[^]*zone-gym-session/);
});

test('failed gym commands never manufacture a gain, receipt or a successful session', async () => {
  const { instance, calls, timers, notices } = game('ar', async () => ({ ok: false, status: 409, json: async () => ({ error: 'Not enough energy.' }) }));
  const before = JSON.stringify(instance.p);
  instance.renderVals().gymSession.train(); await timers.shift()();
  assert.equal(instance.p.stats.str, 10); assert.equal(instance.cur('energy'), 100); assert.equal(instance.p.cash, 2500);
  assert.equal(instance.renderVals().trainingBoard.hasEvents, false); assert.equal(calls.length, 1); assert.equal(instance.renderVals().gymStudio.busy, false);
  assert.ok(notices.length); assert.equal(JSON.stringify(instance.p), before);
});

test('gym session cannot train during low energy, recovery, travel, pending work or offline snapshots', () => {
  for (const state of ['low', 'hospital', 'jail', 'travel', 'pending', 'offline']) {
    const { instance, calls } = game();
    if (state === 'low') instance.applyServerPlayer({ energy: 2 });
    if (state === 'hospital') instance.p.hospUntil = Date.now() + 60000;
    if (state === 'jail') instance.p.jailUntil = Date.now() + 60000;
    if (state === 'travel') instance.p.travel = { status: 'traveling' };
    if (state === 'pending') instance.gameplayBusy = true;
    if (state === 'offline') instance.runtimeConnection = 'offline';
    const view = instance.renderVals(); assert.equal(view.trainOff, true, state);
    assert.ok(view.gymStudio.reason); assert.equal(calls.length, 0);
    if (state === 'low') { assert.equal(view.gymStudio.energyAfter, '0'); assert.match(view.gymStudio.reason, /shortfall/); }
  }
  assert.match(gym, /data-gym-train="\{\{ gymSession\.id \}\}"[^>]*disabled="\{\{ trainOff \}\}"/);
});

test('membership progression reflects earned XP and published thresholds, not decorative progress', () => {
  const { instance } = game(); instance.p.gym = 0; instance.p.gymXp = 20;
  const view = instance.renderVals();
  assert.equal(view.gymStudio.hasNext, true); assert.equal(view.gymStudio.nextProgress, 20);
  assert.ok(view.gymStudio.nextTarget > 20);
  assert.equal(view.gymStudio.progressPct, Math.round(20 / view.gymStudio.nextTarget * 100));
  assert.ok(view.gyms.some(gym => gym.current && gym.disabled));
});

test('Home/Gym artwork has honest existing fallbacks, local layout boundaries, mobile stations and RTL type', () => {
  assert.match(css, /zone-hideout-v105\.webp/); assert.match(css, /zone-gym-interior-v105\.webp/);
  for (const path of ['art/zone_keyart_00001_.png', 'art/g_str.jpg', 'art/g_def.jpg', 'art/g_spd.jpg', 'art/g_dex.jpg']) assert.equal(existsSync(new URL('../' + path, import.meta.url)), true, path);
  assert.match(css, /@media \(max-width:650px\)/); assert.match(css, /\.zone-gym-stations \{ grid-row:2; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /html\[dir="rtl"\].*var\(--zone-arabic\)/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(gym, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(gym, /aria-valuemax="\{\{ gymStudio\.energyMax \}\}" aria-valuenow="\{\{ gymStudio\.energyNow \}\}"/);
});

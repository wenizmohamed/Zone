import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html'), css = read('assets/ui/crimes.css');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const markup = html.slice(html.indexOf('<!-- CRIMES -->'), html.indexOf('<!-- GYM -->'));
const published = JSON.parse(read('engine/data/crimes.json'));
const player = { id: 'ordinary-crime-player', username: 'Newcomer', level: 1, cash: 2500, xp: 0, energy: 100, max_energy: 100, nerve: 15, max_nerve: 15, happy: 100, max_happy: 100, life: 250, max_life: 250, strength: 10, defense: 10, speed: 10, dexterity: 10 };
const onboarding = progress => ({ completed: false, currentMissionId: 'c5', steps: [{ missionId: 'c5', counter: 'crimes', current: true, progress, target: 5, cash: 5000, points: 5, claimable: progress >= 5, claimed: false }] });
function game(lang = 'en', fetchImpl, crimes = published) {
  const timers = [], calls = [], notices = [], location = new URL('https://zone.test/?screen=crimes&lang=' + lang);
  const context = createContext({ console, URL, URLSearchParams, Date,
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById() { return null; } },
    window: { location, history: { pushState() {}, replaceState() {} }, ZonePlatform: { preview: false, active: () => ({ version: 1, manifest: {} }), data: () => ({ crimes }) }, addEventListener() {}, dispatchEvent() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    React: { createElement: () => ({}) }, DCLogic: class { constructor(props) { this.props = props; } setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); } forceUpdate() {} },
    fetch: async (path, options) => { calls.push({ path, options }); if (!fetchImpl) throw new Error('Unexpected fetch'); return fetchImpl(path, options); },
  });
  runInContext(read('assets/weapons/catalog.js'), context);
  runInContext(source + '\nglobalThis.exports = { Component, T };', context);
  const instance = new context.exports.Component({}); instance.toast = message => notices.push(message);
  instance.applyServerPlayer(player); instance.gameplayReady = true; instance.runtimeConnection = 'connected'; instance.state.screen = 'crimes';
  instance.gameplayVersion = 1; instance.onboarding = onboarding(0); instance.p.ctr.crimes = 0;
  return { instance, calls, timers, notices, T: context.exports.T };
}

test('crime markup is a keyboard-operable selected action workspace, not a poster grid/table, scoped on phone/RTL', () => {
  assert.match(markup, /data-crime-category="\{\{ c.id \}\}" aria-pressed/);
  assert.match(markup, /class="zone-crime-activity-nav"/);
  assert.doesNotMatch(markup, /class="zone-crime-categories"/, 'old poster rules hide nested category text in actual rendering');
  assert.match(css, /\.zone-crime-activity-nav button \{ display:flex/);
  assert.match(markup, /data-crime-select="\{\{ c.id \}\}" aria-pressed/);
  assert.match(markup, /data-crime-attempt="\{\{ crimeDesk.selected.id \}\}"[^>]*disabled/);
  assert.match(markup, /zone-crime-receipt[^>]*role="status" aria-live="polite"/);
  assert.doesNotMatch(markup, /zone-table|grid-template-columns|c\.img|c\.pips/);
  assert.equal((markup.match(/<button\b/g) || []).length, (markup.match(/<\/button>/g) || []).length);
  assert.match(css, /aspect-ratio:16\/9/); assert.match(css, /zone-crime-neighborhood-v106\.webp/);
  assert.match(css, /:focus-visible/); assert.match(css, /text-align:start/);
  assert.match(css, /\.zone-crime-plan \{ order:0; \}/);
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:body|:root|\.zone-sidebar|\.zone-home|\.zone-gym|\.zone-city)[\s{,:]/);
});

test('published gates/reward ranges/uncertainty survive mapping; every activity remains browsable without spending', () => {
  for (const lang of ['en', 'ar']) {
    const crimes = [{ ...published[0], level_required: 7, crime_xp_required: 18 }];
    const { instance, calls } = game(lang, undefined, crimes), before = JSON.stringify(instance.p);
    let view = instance.renderVals(); assert.equal(view.crimeDesk.selected.level, 7);
    assert.equal(view.crimeDesk.selected.disabled, true); assert.match(view.crimeDesk.selected.reason, /7/);
    assert.match(view.crimeDesk.selected.reward, /40.*220/); assert.ok(view.crimeDesk.uncertainty.length > 40);
    for (const category of view.crimeCats) { if (category.locked && !category.sub.includes('published') && !category.sub.includes('منشورة')) assert.match(category.sub, lang === 'ar' ? /خبرة جرائم/ : /crime XP required/); category.go(); assert.equal(instance.state.cat, category.id); }
    assert.equal(instance.renderVals().crimeDesk.hasSelection, false);
    assert.ok(instance.renderVals().crimeDesk.emptyNote); assert.equal(calls.length, 0); assert.equal(JSON.stringify(instance.p), before);
  }
});

test('all saved-state restrictions have bilingual reasons and cannot schedule a stale selected commit', () => {
  for (const lang of ['en', 'ar']) for (const restriction of ['nerve', 'level', 'xp', 'jail', 'hospital', 'travel', 'offline', 'pending', 'cooldown', 'loading']) {
    const { instance, calls, timers } = game(lang, undefined, [{ ...published[0], level_required: 2, crime_xp_required: 3 }]);
    instance.applyServerPlayer({ level: 2 }); instance.p.crimeXp = 3;
    const stale = instance.renderVals().crimeDesk.selected;
    if (restriction === 'nerve') instance.applyServerPlayer({ nerve: 1 });
    if (restriction === 'level') instance.applyServerPlayer({ level: 1 });
    if (restriction === 'xp') instance.p.crimeXp = 0;
    if (restriction === 'jail') instance.p.jailUntil = Date.now() + 60000;
    if (restriction === 'hospital') instance.p.hospUntil = Date.now() + 60000;
    if (restriction === 'travel') instance.p.travel = { status: 'traveling' };
    if (restriction === 'offline') instance.runtimeConnection = 'offline';
    if (restriction === 'pending') instance.gameplayBusy = true;
    if (restriction === 'cooldown') instance.cooldowns = { actions: { crime: { availableAtEpoch: Date.now() / 1000 + 90 } } };
    if (restriction === 'loading') instance.gameplayReady = false;
    const view = instance.renderVals(); assert.equal(view.crimeDesk.selected.disabled, true, restriction);
    assert.ok(view.crimeDesk.selected.reason, restriction); if (lang === 'ar') assert.match(view.crimeDesk.selected.reason, /[\u0600-\u06ff]/);
    const before = JSON.stringify(instance.p); stale.commit(); assert.equal(timers.length, 0, restriction); assert.equal(calls.length, 0); assert.equal(JSON.stringify(instance.p), before);
    if (['jail', 'hospital', 'offline'].includes(restriction)) assert.equal(typeof view.crimeDesk.recover, 'function');
  }
});

test('real commit delegates exactly one authoritative attempt, costs only on receipt and hydrates earned 0/5 to 1/5', async () => {
  for (const lang of ['en', 'ar']) {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const { instance, calls, timers } = game(lang, async (path, options) => {
      if (path.endsWith('/attempt')) { assert.equal(options.method, 'POST'); assert.equal(options.body, '{}'); await gate;
        return { ok: true, json: async () => ({ success: true, player: { ...player, nerve: 13, cash: 2611, xp: 2 }, cost: { nerve: 2 }, reward: { cash: 111, xp: 2 }, loot: null, penalty: null }) }; }
      assert.equal(path, '/api/v1/gameplay'); return { ok: true, json: async () => ({ player: { ...player, nerve: 13, cash: 2611, xp: 2 }, state: { version: 2, crimeXp: 2, ctr: { crimes: 1 }, skill: { trash: 1 } }, onboarding: onboarding(1) }) };
    });
    let view = instance.renderVals(); assert.equal(view.homeBase.goal.progress, '0/5'); view.crimes[0].select();
    const before = JSON.stringify(instance.p); instance.renderVals().crimeDesk.selected.commit();
    instance.renderVals().crimeDesk.selected.commit(); assert.equal(timers.length, 1);
    const pending = timers.shift()(); assert.equal(calls.length, 1); assert.equal(JSON.stringify(instance.p), before);
    assert.equal(instance.state.crimeReceipt, undefined); assert.equal(instance.renderVals().crimeDesk.selected.disabled, true);
    release(); await pending; view = instance.renderVals();
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
    assert.equal(instance.cur('nerve'), 13); assert.equal(instance.p.cash, 2611); assert.equal(instance.p.ctr.crimes, 1);
    assert.equal(view.homeBase.goal.progress, '1/5'); assert.equal(view.crimes[0].skill, 1); assert.match(view.crimeDesk.receipt, /111/);
    assert.equal(view.crimeDesk.selected.id, 'trash'); assert.equal(view.crimeDesk.selected.disabled, false);
  }
});

test('server rejection/network failure never invents spending, progress, reward or a successful receipt', async () => {
  for (const lang of ['en', 'ar']) for (const network of [false, true]) {
    const { instance, calls, timers } = game(lang, async () => { if (network) throw new Error('Network connection lost.'); return { ok: false, status: 409, json: async () => ({ error: 'Not enough nerve.' }) }; });
    const before = JSON.stringify(instance.p); instance.renderVals().crimeDesk.selected.commit(); await timers.shift()();
    assert.equal(calls.length, 1); assert.equal(JSON.stringify(instance.p), before); assert.equal(instance.state.crimeReceipt, undefined);
    assert.ok(instance.renderVals().crimeDesk.receipt); assert.equal(instance.renderVals().homeBase.goal.progress, '0/5');
    assert.equal(instance.state.busy, null); if (lang === 'ar') assert.match(instance.renderVals().crimeDesk.receipt, /[\u0600-\u06ff]/);
  }
});

test('real failed outcome spends server nerve without advancing success goal and offers actual recovery', async () => {
  for (const penalty of ['jail', 'hosp']) {
    const until = Date.now() + 120000;
    const { instance, calls, timers, T } = game('ar', async path => ({ ok: true, json: async () => path.endsWith('/attempt') ?
      { success: false, player: { ...player, nerve: 13 }, cost: { nerve: 2 }, reward: { cash: 0, xp: 0 }, penalty: { type: penalty, minutes: 2 } } :
      { player: { ...player, nerve: 13 }, state: { version: 2, ctr: { crimes: 0 }, [penalty === 'jail' ? 'jailUntil' : 'hospUntil']: until }, onboarding: onboarding(0) } }));
    instance.renderVals().crimeDesk.selected.commit(); await timers.shift()(); const view = instance.renderVals();
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1); assert.equal(instance.cur('nerve'), 13); assert.equal(instance.p.cash, 2500);
    assert.equal(view.homeBase.goal.progress, '0/5'); assert.equal(view.crimeDesk.selected.disabled, true);
    assert.equal(view.crimeDesk.recovery, T.ar.nav[penalty === 'jail' ? 'jail' : 'hospital']); assert.match(view.crimeDesk.receipt, /2/);
  }
});

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
  return { instance, calls, timers, notices, context, T: context.exports.T };
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

test('choosing a lower opportunity returns keyboard and viewport to its plan without sending an action', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, context, calls } = game(lang), focus = [];
    context.document.querySelector = selector => { assert.equal(selector, '.zone-crime-plan h2'); return {
      setAttribute: (...args) => focus.push(['attribute', ...args]), scrollIntoView: options => focus.push(['scroll', options.block]),
      focus: options => focus.push(['focus', options.preventScroll]),
    }; };
    const before = JSON.stringify(instance.p);
    instance.renderVals().crimes.find(crime => crime.id === 'trash').select();
    assert.equal(instance.renderVals().crimeDesk.selected.id, 'trash');
    assert.deepEqual(focus, [['attribute', 'tabindex', '-1'], ['scroll', 'start'], ['focus', true]]);
    assert.equal(calls.length, 0); assert.equal(JSON.stringify(instance.p), before);
    instance.setState({crimeReceipt: {id: 'trash', success: true, reward: {cash: 111, xp: 2}, cost: {nerve: 2}}});
    const text = instance.renderVals().crimeDesk.receipt;
    if (lang === 'ar') assert.ok(text.includes('\u2066$111\u2069'), 'Arabic money stays a left-to-right financial token');
    else assert.ok(!text.includes('\u2066'));
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

test('tactical heist, combat, safehouse, bank, casino, and career telemetry render accurately in EN and AR', () => {
  for (const lang of ['en', 'ar']) {
    const { instance } = game(lang);
    instance.p.bankBalance = 7500;
    instance.p.cash = 2500;
    const view = instance.renderVals();
    assert.ok(view.crimeDesk.selected.evPerNerve.includes('/'), 'evPerNerve formatted per nerve');
    assert.ok(view.crimeDesk.selected.heatTier.length > 3, 'heatTier populated');
    assert.ok(view.crimeDesk.selected.masteryTier.length > 3, 'masteryTier populated');
    assert.ok(view.crimeDesk.rules.includes(view.crimeDesk.selected.evPerNerve), 'crimeDesk.rules includes evPerNerve');
    assert.ok(view.crimeDesk.rules.includes(view.crimeDesk.selected.heatTier), 'crimeDesk.rules includes heatTier');
    assert.ok(view.opps.length > 0 && view.opps.every(o => o.oppTotal && o.powerRatio.endsWith('%')), 'opps include oppTotal and powerRatio');
    assert.ok(view.combatScene.stats.includes(view.loadout.weapon.name) && view.combatScene.stats.includes(view.loadout.armor.name), 'combatScene.stats includes equipped weapon and armor telemetry');
    assert.ok(view.propertyDossier.trainingBoost.startsWith('×') && view.propertyDossier.context.includes(view.propertyDossier.trainingBoost), 'propertyDossier includes max-happy gym trainingBoost');
    assert.ok(view.props.every(pr => typeof pr.happyDelta === 'number' && pr.trainingBoost.startsWith('×')), 'each property includes happyDelta and trainingBoost');
    assert.equal(view.bank.vaultSharePct, 75);
    assert.ok(view.bank.msg.includes('75%'), 'bank.msg includes vault protection share percentage');
    assert.equal(typeof view.casino.higherOddsPct, 'number');
    assert.equal(typeof view.casino.lowerOddsPct, 'number');
    assert.ok(view.casinoGuide.scope.includes(view.casino.higherOddsPct + '%') && view.casinoGuide.scope.includes(view.casino.lowerOddsPct + '%'), 'casinoGuide.scope includes live deck higher/lower odds');
    assert.ok(view.employment.payBonusText.includes('10%'), 'employment.payBonusText includes +10% Business Basics career synergy');
    instance.setState({ sel: 'knife' });
    const weaponView = instance.renderVals();
    assert.ok(weaponView.sel.rows.some(r => /Vs equipped weapon|مقارنة بسلاحك المجهز/.test(r.k) && /upgrade|أقوى/.test(r.v)), 'sel.rows compares weapon against equipped weapon');
    assert.ok(weaponView.fac.chainBonusPct.endsWith('%'), 'fac.chainBonusPct populated');
    assert.equal(typeof weaponView.educationBoard.completedCount, 'number');
    assert.equal(typeof weaponView.educationBoard.remainingCount, 'number');
    assert.ok(weaponView.courses.every(c => c.hoursLabel.length >= 3), 'courses include hoursLabel');
    assert.ok(weaponView.market.every(m => typeof m.vsCatalogPct === 'number' && m.dealTier.length >= 3), 'market rows include vsCatalogPct and dealTier');
    assert.ok(weaponView.missions.every(m => typeof m.remaining === 'number' && m.cashReward && typeof m.pointsReward === 'number'), 'missions include remaining, cashReward, pointsReward');
    assert.ok(weaponView.inmates.every(i => i.bustRiskTier && i.nerveCost === 5), 'inmates include bustRiskTier and nerveCost');
    assert.ok(weaponView.patients.every(pt => pt.energyCost === 75 && typeof pt.reviveReady === 'boolean'), 'patients include energyCost and reviveReady');
    assert.ok(weaponView.cityDirectory.rows.every(r => r.categoryId && r.categoryLabel), 'cityDirectory rows include categoryId and categoryLabel');
    assert.ok(weaponView.hof.every(r => r.powerTier && r.powerTier.length >= 3), 'hof rows include powerTier');
    instance.worldState = { finds: [{ id: 'f1', item_id: 'knife', quantity: 2, location_id: 'crimes' }], events: [] };
    instance.peerResources = {
      market: { snapshot: { listings: [{ id: 'l1', itemId: 'knife', sellerName: 'Sami', own: false, quantity: 3, unitPrice: 1500, version: 1 }] } },
      family: { snapshot: { definitions: [{ id: 'docks', name: { en: 'Dock heist', ar: 'عملية المرفأ' }, requiredMembers: 4, energyCost: 25, cashReward: 40000, respectReward: 50, durationSeconds: 600 }], operations: [{ id: 'op1', definitionId: 'docks', state: 'forming', requiredMembers: 4, participants: [{ username: 'Newcomer' }], payoutPerMember: 10000, version: 1 }] } }
    };
    const peerView = instance.renderVals();
    assert.ok(peerView.world.finds[0].unitValue && peerView.world.finds[0].totalValue, 'world finds include unitValue and totalValue');
    assert.equal(typeof peerView.playerMarket.listings[0].vsCatalogPct, 'number');
    assert.ok(peerView.playerMarket.listings[0].dealTier.length >= 3, 'playerMarket listings include dealTier');
    assert.ok(peerView.familyActivities.definitions[0].payoutPerMember && peerView.familyActivities.definitions[0].cashPerEnergy.includes('/'), 'familyActivities definitions include payoutPerMember and cashPerEnergy');
    assert.equal(peerView.familyActivities.operations[0].fillPct, 25);
    assert.equal(peerView.familyActivities.operations[0].slotsRemaining, 3);
    assert.ok(peerView.activity.totalBattleScore, 'activity includes totalBattleScore');
    assert.ok(peerView.stats.every(s => s.gainPerEnergy && s.gainPerEnergy.includes('/')), 'stats include gainPerEnergy');
    assert.ok(peerView.gymStudio.happyMultiplier.startsWith('×') && typeof peerView.gymStudio.sessionsAvailable === 'number', 'gymStudio includes happyMultiplier and sessionsAvailable');
    assert.ok(peerView.travelDests.every(d => d.cost && typeof d.canAfford === 'boolean'), 'travelDests include cost and canAfford');
    instance.sharedFamily = { respect: 1500, version: 1, upgrades: {}, upgradeEligibility: [{ id: 'nerveMax', cost: 2000, eligible: false, reason: 'respect_required' }] };
    instance.onboarding = { steps: [{ missionId: 'm_train', counter: 'train', progress: 2, target: 5, cash: 500, points: 2, current: true }] };
    instance.setState({ combatMode: 'players' });
    instance.peerResources.opponents = { snapshot: { selfId: 'u1', players: [{ id: 'u2', username: 'Rami', factionId: 'crow', life: 100, max_life: 100, level: 3, strength: 15, defense: 15, speed: 15, dexterity: 15, eligible: true }] } };
    instance.peerResources.family.snapshot.competition = { seasonId: '2026-W44', endsAt: Date.now() + 86400000, ownFactionId: 'crow', ranks: [{ id: 'crow', rank: 1, name: { en: 'Black Crow', ar: 'الغراب الأسود' }, memberCount: 4, score: 120 }, { id: 'veil', rank: 2, name: { en: 'Red Veil', ar: 'الحجاب الأحمر' }, memberCount: 5, score: 75 }] };
    const sharedView = instance.renderVals();
    assert.equal(sharedView.sharedFamily.upgrades[0].owned, false);
    assert.equal(sharedView.sharedFamily.upgrades[0].respectShortfall, 500);
    assert.equal(sharedView.onboarding.steps[0].pct, 40);
    assert.equal(sharedView.onboarding.steps[0].remaining, 3);
    assert.ok(sharedView.homeBase.resources.every(r => typeof r.missing === 'number' && typeof r.fullIn === 'string' && r.fullIn.length > 0), 'homeBase resources include missing and fullIn');
    assert.ok(sharedView.opps[0].oppTotal && sharedView.opps[0].powerRatio.endsWith('%') && sharedView.opps[0].threatTier, 'peer combat opps include oppTotal, powerRatio, and threatTier');
    assert.equal(sharedView.competition.ranks[0].scorePerMember, '30');
    assert.equal(sharedView.competition.ranks[0].leadGap, '0');
    assert.equal(sharedView.competition.ranks[1].scorePerMember, '15');
    assert.equal(sharedView.competition.ranks[1].leadGap, '45');
    assert.equal(sharedView.combatScene.turnsRemaining, 25);
    assert.equal(sharedView.combatScene.playerHpPct, 100);
    assert.equal(sharedView.combatScene.enemyHpPct, 100);
    instance.p.inv = { knife: 2 };
    const diag = instance.diagnostics();
    assert.equal(diag.lang, lang);
    assert.equal(diag.gameplayReady, true);
    assert.equal(diag.cash, 2500);
    assert.equal(diag.ownedItemCount, 2);
    assert.deepEqual(Array.from(instance.supportedOutfits()), ['street', 'suit', 'tactical']);
    assert.equal(instance.isSupportedOutfit('suit'), true);
    assert.equal(instance.isSupportedOutfit('unknown'), false);
    assert.deepEqual(Array.from(instance.supportedCombatModes()), ['npc', 'players']);
    assert.deepEqual(Array.from(instance.supportedMarketModes()), ['merchants', 'players']);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = p => readFileSync(resolve(root, p), 'utf8');

const ZMD = require(resolve(root, 'assets/ui/zone-merits-data.js'));
const html = read('index.html');
const logic = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];

function bootGame(opts = {}) {
  const lang = opts.lang || 'en';
  const storage = new Map();
  const dispatched = [];
  const location = new URL('https://zone.test/?screen=home&lang=' + lang);
  const windowObj = {
    location,
    history: { pushState() {}, replaceState() {} },
    ZonePlatform: { preview: !!opts.preview, active: () => ({ version: 1, manifest: {} }), data: () => ({}) },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(evt) { dispatched.push(evt); }
  };
  const ctx = createContext({
    console, URL, URLSearchParams, Date, Math, JSON, Number, String, Boolean, Object, Array, Set, Map,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    document: {
      visibilityState: 'visible',
      documentElement: { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', dataset: {}, style: { setProperty() {} } },
      body: { classList: { add() {}, remove() {} } },
      getElementById() { return null; },
      querySelector() { return null; }
    },
    window: windowObj,
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {},
    requestAnimationFrame() {},
    React: { createElement: () => ({}) },
    DCLogic: class {
      constructor(props) { this.props = props; }
      setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); }
      forceUpdate() {}
    },
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: 'offline' }) })
  });
  ctx.globalThis = ctx;
  ctx.window = windowObj;
  runInContext(read('assets/weapons/catalog.js'), ctx);
  runInContext(read('assets/ui/zone-merits-data.js'), ctx);
  runInContext(logic + '\nglobalThis.Game = Component;', ctx);
  const instance = new ctx.Game({});
  instance.applyServerPlayer({
    id: opts.playerId || 'guest-merits-145',
    username: 'TestOperative',
    level: opts.level ?? 1,
    cash: opts.cash ?? 2500,
    bank_balance: opts.bankBalance ?? 0,
    energy: 100, max_energy: 100,
    nerve: opts.nerve ?? 45, max_nerve: opts.maxNerve ?? 45,
    happy: 100, max_happy: 100,
    life: opts.life ?? 500, max_life: opts.maxLife ?? 500,
    strength: 100, defense: 100, speed: 100, dexterity: 100
  });
  instance.gameplayReady = true;
  instance.runtimeConnection = 'connected';
  instance.componentDidMount();
  return { instance, ctx, windowObj, dispatched, storage };
}

test('ZoneMeritsData defines exact 20 upgrades, 4 categories, and Torn triangular cost curve (1..10 = 55)', () => {
  assert.equal(ZMD.UPGRADES.length, 20);
  assert.equal(ZMD.CATEGORIES.length, 4);
  assert.equal(ZMD.MAX_RANK, 10);
  assert.equal(ZMD.MAX_UPGRADE_COST, 55);

  const expectedIds = [
    'nerve', 'crit', 'life', 'crime', 'awareness',
    'brawn', 'protection', 'sharpness', 'evasion',
    'bank', 'edu', 'emp', 'looting', 'hosp', 'stealth',
    'gym', 'rifle', 'smg', 'pistol', 'melee'
  ];
  assert.deepEqual(ZMD.UPGRADES.map(u => u.id), expectedIds);

  for (const u of ZMD.UPGRADES) {
    assert.ok(u.en && u.ar, 'bilingual title for ' + u.id);
    assert.ok(u.descEn && u.descAr, 'bilingual description for ' + u.id);
    assert.ok(u.formatBonus(3, 'en').length > 2);
    assert.ok(u.formatBonus(3, 'ar').length > 2);
  }

  let runningSum = 0;
  for (let rank = 0; rank < 10; rank++) {
    assert.equal(ZMD.upgradeCost(rank), rank + 1);
    assert.equal(ZMD.spentOnUpgrade(rank), runningSum);
    runningSum += rank + 1;
  }
  assert.equal(ZMD.upgradeCost(10), null);
  assert.equal(ZMD.spentOnUpgrade(10), 55);
  assert.equal(ZMD.totalSpent({ nerve: 10, life: 4, gym: 1 }), 55 + 10 + 1);
});

test('computeBonuses returns all zeros at rank 0 and exact Torn values for all 20 upgrades', () => {
  const zero = ZMD.computeBonuses({});
  for (const [k, v] of Object.entries(zero)) {
    assert.equal(v, 0, 'zero default for ' + k);
  }

  const maxTree = {};
  for (const u of ZMD.UPGRADES) maxTree[u.id] = 10;
  const max = ZMD.computeBonuses(maxTree);
  assert.equal(max.nerveBonus, 10);
  assert.equal(max.critPct, 5);
  assert.equal(max.lifePct, 50);
  assert.equal(max.crimePct, 30);
  assert.equal(max.awarenessPct, 200);
  assert.equal(max.brawnPct, 30);
  assert.equal(max.protectionPct, 30);
  assert.equal(max.sharpnessPct, 30);
  assert.equal(max.evasionPct, 30);
  assert.equal(max.bankInterestPct, 50);
  assert.equal(max.eduReductionPct, 20);
  assert.equal(max.empEff, 10);
  assert.equal(max.empPayPct, 30);
  assert.equal(max.mugPct, 50);
  assert.equal(max.hospPct, 50);
  assert.equal(max.stealthBonus, 2);
  assert.equal(max.gymPct, 20);
  assert.equal(max.riflePct, 20);
  assert.equal(max.smgPct, 20);
  assert.equal(max.pistolPct, 20);
  assert.equal(max.meleePct, 20);
  assert.equal(ZMD.totalSpent(maxTree), 20 * 55);
});

test('24 collectible Honors across 7 categories include turn-1 claimable starter milestones', () => {
  assert.equal(ZMD.HONORS.length, 24);
  assert.equal(ZMD.HONOR_CATEGORIES.length, 7);
  const cats = new Set(ZMD.HONORS.map(h => h.category));
  assert.equal(cats.size, 7);
  for (const h of ZMD.HONORS) {
    assert.ok(h.en && h.ar && h.reqEn && h.reqAr, 'bilingual honor ' + h.id);
    assert.ok(h.banner?.bg1 && h.banner?.bg2 && h.banner?.accent && h.banner?.icon, 'banner palette ' + h.id);
    assert.equal(h.merits, 1);
  }

  const freshGuest = { level: 1, cash: 2500, bankBalance: 0, stats: { str: 10, def: 10, spd: 10, dex: 10 }, ctr: { crimes: 0, trains: 0, wins: 0, shifts: 0 } };
  const evaluated = ZMD.evaluateHonors(freshGuest, {});
  const ready = evaluated.filter(h => h.ready);
  assert.ok(ready.length >= 2, 'fresh guest must have at least 2 immediately claimable honors');
  assert.ok(ready.some(h => h.id === 'h_first_steps'));
  assert.ok(ready.some(h => h.id === 'h_cash_2500'));
});

test('8 progressive 4-tier Medals (Bronze/Silver/Gold/Platinum = 32 tiers) evaluate cleanly', () => {
  assert.equal(ZMD.MEDALS.length, 8);
  assert.deepEqual(ZMD.MEDALS.map(m => m.id), ['m_crimes', 'm_combat', 'm_gym', 'm_networth', 'm_level', 'm_bank', 'm_casino', 'm_missions']);
  assert.deepEqual(ZMD.MEDAL_TIERS.map(t => t.en), ['Bronze', 'Silver', 'Gold', 'Platinum']);

  const veteran = {
    level: 16,
    cash: 250000,
    bankBalance: 300000,
    netWorth: 1200000,
    casinoNet: 15000,
    stats: { str: 800, def: 800, spd: 800, dex: 800 },
    ctr: { crimes: 120, wins: 55, shifts: 10 },
    claimed: { c5: true, t4: true }
  };
  const medals = ZMD.evaluateMedals(veteran, { m_crimes_0: true });
  const crimes = medals.find(m => m.id === 'm_crimes');
  assert.equal(crimes.unlockedCount, 3); // 5, 25, 100 unlocked; 500 locked
  assert.equal(crimes.claimedCount, 1);
  assert.equal(crimes.readyCount, 2);
  assert.equal(crimes.nextTier.nameEn, 'Platinum');
  assert.equal(crimes.nextClaimable.nameEn, 'Silver');
});

test('ZoneMeritsBridge live gameplay integration: claim -> upgrade Nerve & Life -> verify all 8 formulas -> reset refund', () => {
  const { instance, windowObj, dispatched } = bootGame({ cash: 50000, bankBalance: 100000, maxNerve: 45, maxLife: 500 });
  const bridge = windowObj.ZoneMeritsBridge;
  assert.ok(bridge, 'ZoneMeritsBridge must be mounted on window');
  for (const fn of ['getState', 'upgradeMerit', 'resetMerits', 'claimHonor', 'claimMedalTier', 'claimAllReady', 'equipHonor', 'openHub']) {
    assert.equal(typeof bridge[fn], 'function', 'bridge method ' + fn);
  }

  // Fresh state starts with 0 spent and unmodified base bars
  assert.equal(instance.maxOf('nerve'), 45);
  assert.equal(instance.maxOf('life'), 500);
  const baseExpGain = instance.expGain('str');
  const baseJobPay = instance.jobPayRange();
  const baseCourseDur = instance.renderVals().courses[0].dur;
  const baseCrimePct = instance.pct({ id: 'trash', base: 70, fail: 'none' });
  const baseBankYield = instance.renderVals().bank.dailyYield;

  // Claim all ready honors & medals -> earns merits immediately
  const claimAll = bridge.claimAllReady();
  assert.equal(claimAll.ok, true);
  assert.ok(claimAll.meritsEarned >= 2);
  assert.equal(instance.p.merits, claimAll.meritsEarned);

  // Equip claimed honor and reject unclaimed honor
  const eqOk = bridge.equipHonor('h_first_steps');
  assert.equal(eqOk.ok, true);
  assert.equal(bridge.getState().equippedHonor, 'h_first_steps');
  const eqBad = bridge.equipHonor('h_crimes_1000');
  assert.equal(eqBad.ok, false);

  // Give plenty of merits to test every gameplay formula
  instance.p.merits = 40;

  // 1. Nerve Bar: 0 -> 1 (cost 1) => 45 -> 46 LIVE!
  const uNerve1 = bridge.upgradeMerit('nerve');
  assert.equal(uNerve1.ok, true);
  assert.equal(uNerve1.cost, 1);
  assert.equal(uNerve1.rank, 1);
  assert.equal(instance.maxOf('nerve'), 46);
  // 1 -> 2 (cost 2) => 46 -> 47 LIVE!
  const uNerve2 = bridge.upgradeMerit('nerve');
  assert.equal(uNerve2.cost, 2);
  assert.equal(instance.maxOf('nerve'), 47);

  // 2. Life Points: 0 -> 1 (cost 1) => 500 -> 525 (+5%) LIVE!
  const uLife1 = bridge.upgradeMerit('life');
  assert.equal(uLife1.ok, true);
  assert.equal(uLife1.cost, 1);
  assert.equal(instance.maxOf('life'), 525);

  // 3. Gym Conditioning: 0 -> 2 => +4% gym gains
  bridge.upgradeMerit('gym');
  bridge.upgradeMerit('gym');
  assert.ok(Math.abs(instance.expGain('str') / baseExpGain - 1.04) < 1e-6);

  // 4. Crime Progression: 0 -> 2 => +6% success
  bridge.upgradeMerit('crime');
  bridge.upgradeMerit('crime');
  assert.equal(instance.pct({ id: 'trash', base: 70, fail: 'none' }), baseCrimePct + 6);

  // 5. Battle Stats & Weapon Mastery
  instance.p.equip = 'bullpup_1';
  bridge.upgradeMerit('brawn');
  bridge.upgradeMerit('rifle');
  bridge.upgradeMerit('crit');
  bridge.upgradeMerit('looting');
  const mods = instance.combatMeritModifiers();
  assert.equal(mods.effectiveStats.str, 103);
  assert.equal(mods.weaponMasteryPct, 2);
  assert.equal(mods.critPct, 0.5);
  assert.equal(mods.mugPct, 5);

  // 6. Bank Interest: 0 -> 2 => +10% yield
  bridge.upgradeMerit('bank');
  bridge.upgradeMerit('bank');
  assert.notEqual(instance.renderVals().bank.dailyYield, baseBankYield);

  // 7. Education Length: 0 -> 5 => -10% duration
  for (let i = 0; i < 5; i++) bridge.upgradeMerit('edu');
  assert.notEqual(instance.renderVals().courses[0].dur, baseCourseDur);

  // 8. Employee Effectiveness: 0 -> 2 => +6% job pay
  bridge.upgradeMerit('emp');
  bridge.upgradeMerit('emp');
  assert.notEqual(instance.jobPayRange(), baseJobPay);

  // Reset Merits (1st reset is FREE!)
  const spentBeforeReset = bridge.getState().spentMerits;
  const meritsBeforeReset = instance.p.merits;
  const cashBeforeReset = instance.p.cash;
  const reset1 = bridge.resetMerits();
  assert.equal(reset1.ok, true);
  assert.equal(reset1.fee, 0);
  assert.equal(reset1.refunded, spentBeforeReset);
  assert.equal(instance.p.merits, meritsBeforeReset + spentBeforeReset);
  assert.equal(instance.p.cash, cashBeforeReset);
  assert.equal(bridge.getState().spentMerits, 0);
  assert.equal(instance.maxOf('nerve'), 45);
  assert.equal(instance.maxOf('life'), 500);

  // 2nd reset charges $25,000
  bridge.upgradeMerit('nerve');
  const reset2 = bridge.resetMerits();
  assert.equal(reset2.ok, true);
  assert.equal(reset2.fee, 25000);
  assert.equal(instance.p.cash, cashBeforeReset - 25000);

  // openMeritsScreen delegates to window.ZoneMeritsUI.open('merits')
  let openedTab = null;
  windowObj.ZoneMeritsUI = { open(tab) { openedTab = tab; } };
  instance.renderVals().omar.openMeritsScreen();
  assert.equal(openedTab, 'merits');

  assert.ok(dispatched.some(e => e.type === 'zone:merits-updated'));
});

test('index.html head loads v145+ merits assets and preserves pinned gym116.css?v=117', () => {
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  assert.match(head, /href="\.\/assets\/ui\/gym116\.css\?v=117"/);
  const cssMatch = head.match(/href="\.\/assets\/ui\/zone-merits-awards\.css\?v=(\d+)"/);
  const dataMatch = head.match(/src="\.\/assets\/ui\/zone-merits-data\.js\?v=(\d+)"/);
  const uiMatch = head.match(/src="\.\/assets\/ui\/zone-merits-awards\.js\?v=(\d+)"/);
  assert.ok(cssMatch && Number(cssMatch[1]) >= 145, 'zone-merits-awards.css must have cache-buster >= 145');
  assert.ok(dataMatch && Number(dataMatch[1]) >= 145, 'zone-merits-data.js must have cache-buster >= 145');
  assert.ok(uiMatch && Number(uiMatch[1]) >= 145, 'zone-merits-awards.js must have cache-buster >= 145');
  assert.ok(head.indexOf('zone-merits-data.js?v=') < head.indexOf('zone-merits-awards.js?v='));
});

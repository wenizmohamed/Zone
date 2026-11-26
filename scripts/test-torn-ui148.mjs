import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');
const readBytes = (rel) => readFileSync(resolve(root, rel));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function relLum(hex) {
  const parts = hex
    .slice(1)
    .match(/../g)
    .map((p) => parseInt(p, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
}

function contrastRatio(a, b) {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* Minimal DOM harness for VM execution of zone-torn-live.js & zone-merits-awards.js */
class MiniElement {
  constructor(tagName, ownerDoc) {
    this.tagName = String(tagName || 'DIV').toUpperCase();
    this.ownerDocument = ownerDoc;
    this.id = '';
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this._innerHTML = '';
    this._textContent = '';
    this.attributes = new Map();
    this.dataset = {};
    this.children = [];
    this.childNodes = this.children;
    this.parentElement = null;
    this.listeners = new Map();
    this.style = {
      width: '',
      setProperty(k, v) { this[k] = v; }
    };
    this.classList = {
      _set: new Set(),
      add: (...c) => c.forEach((x) => this.classList._set.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._set.delete(x)),
      contains: (x) => this.classList._set.has(x)
    };
  }

  get outerHTML() {
    const tag = this.tagName.toLowerCase();
    const idPart = this.id ? ` id="${this.id}"` : '';
    const clsPart = this.className ? ` class="${this.className}"` : '';
    const hidPart = this.hidden ? ' hidden' : '';
    return `<${tag}${idPart}${clsPart}${hidPart}>${this.innerHTML}</${tag}>`;
  }

  get innerHTML() {
    if (this.children.length > 0) {
      return this._innerHTML + this.children.map((c) => c.outerHTML).join('');
    }
    return this._innerHTML;
  }

  set innerHTML(val) {
    this.children = [];
    this.childNodes = this.children;
    this._innerHTML = String(val == null ? '' : val);
    this._textContent = this._innerHTML.replace(/<[^>]+>/g, '');
  }

  get textContent() {
    if (this.children.length > 0) {
      return this._textContent + this.children.map((c) => c.textContent).join('');
    }
    return this._textContent || this._innerHTML.replace(/<[^>]+>/g, '');
  }

  set textContent(val) {
    this.children = [];
    this.childNodes = this.children;
    this._textContent = String(val == null ? '' : val);
    this._innerHTML = this._textContent;
  }

  setAttribute(name, val) {
    const str = String(val);
    this.attributes.set(name, str);
    if (name === 'id') this.id = str;
    if (name === 'class') this.className = str;
  }

  getAttribute(name) {
    if (name === 'id' && this.id) return this.id;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchClick(attrs = {}) {
    const target = {
      disabled: Boolean(attrs.disabled),
      getAttribute: (k) => (k in attrs ? String(attrs[k]) : null),
      closest: (sel) => {
        if (sel === '[data-ztl-act]' && 'data-ztl-act' in attrs) return target;
        if (sel === '[data-zma-act]' && 'data-zma-act' in attrs) return target;
        return null;
      }
    };
    const ev = { target, preventDefault() {}, stopPropagation() {} };
    for (const fn of this.listeners.get('click') || []) fn(ev);
  }

  querySelector(sel) {
    if (sel.startsWith('#')) return this.ownerDocument.getElementById(sel.slice(1));
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function createHarness(apiHandler, opts = {}) {
  const elementsById = new Map();
  const docListeners = new Map();
  const winListeners = new Map();
  const localStore = new Map();
  const scheduledTimers = [];

  const doc = {
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
    documentElement: new MiniElement('html', null),
    body: new MiniElement('body', null),
    createElement(tag) {
      return new MiniElement(tag, doc);
    },
    getElementById(id) {
      for (const el of allTreeElements()) {
        if (el.id === id) return el;
      }
      return elementsById.get(id) || null;
    },
    querySelector(sel) {
      if (sel === 'x-dc') return null;
      if (sel === '.zone-topbar') return topbar;
      if (sel === '#zone-main .zone-page-heading > div:last-child') return headingActions;
      if (sel === 'aside.zone-sidebar .zone-profile-body') return profileBody;
      if (sel.startsWith('#')) return doc.getElementById(sel.slice(1));
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };
  doc.documentElement.ownerDocument = doc;
  doc.body.ownerDocument = doc;
  doc.documentElement.lang = opts.lang || 'en';
  doc.documentElement.dir = opts.lang === 'ar' ? 'rtl' : 'ltr';
  doc.documentElement.setAttribute('data-theme', opts.theme || 'dark');

  const topbar = new MiniElement('div', doc);
  topbar.className = 'zone-topbar';
  const sidebar = new MiniElement('aside', doc);
  sidebar.className = 'zone-sidebar';
  const profileBody = new MiniElement('div', doc);
  profileBody.className = 'zone-profile-body';
  const navArea = new MiniElement('div', doc);
  navArea.id = 'zone-area-navigation';
  sidebar.appendChild(profileBody);
  sidebar.appendChild(navArea);

  const main = new MiniElement('main', doc);
  main.id = 'zone-main';
  main.setAttribute('data-zone-screen', opts.screen || 'home');
  const pageHeading = new MiniElement('div', doc);
  pageHeading.className = 'zone-page-heading';
  const headingActions = new MiniElement('div', doc);
  pageHeading.appendChild(headingActions);
  const cityView = new MiniElement('div', doc);
  cityView.id = 'native-city-map-view';
  cityView.setAttribute('data-zone-city-view', '1');
  main.appendChild(pageHeading);
  main.appendChild(cityView);

  doc.body.appendChild(topbar);
  doc.body.appendChild(sidebar);
  doc.body.appendChild(main);

  function allTreeElements() {
    const out = [];
    const visit = (n) => {
      out.push(n);
      for (const c of n.children || []) visit(c);
    };
    visit(doc.body);
    return out;
  }

  let nextTimerId = 1;
  const win = {
    location: new URL(opts.url || 'https://zone.test/?screen=home'),
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k)
    },
    ZoneSession: { ensure: async () => ({ playerId: 'p-148', mode: 'guest' }) },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      for (const fn of winListeners.get(ev.type) || []) fn(ev);
    },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    setTimeout: (fn, ms = 0) => {
      const id = nextTimerId++;
      if (Number(ms) < 1000) fn();
      else scheduledTimers.push({ id, fn, ms: Number(ms), cleared: false });
      return id;
    },
    clearTimeout(id) {
      for (const t of scheduledTimers) {
        if (t.id === id) t.cleared = true;
      }
    },
    setInterval: () => 1,
    clearInterval() {},
    scrollTo() {},
    fetch: async (url, init = {}) => apiHandler(String(url), init)
  };

  let clockOffsetMs = 0;
  const FakeDate = class extends Date {
    static now() {
      return Date.now() + clockOffsetMs;
    }
  };

  const ctx = createContext({
    console,
    URL,
    URLSearchParams,
    Date: FakeDate,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Set,
    Map,
    Promise,
    Error,
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
    window: win,
    document: doc,
    localStorage: win.localStorage,
    fetch: win.fetch
  });
  ctx.globalThis = ctx;
  win.CustomEvent = ctx.CustomEvent;
  win.Event = ctx.Event;
  win.MutationObserver = ctx.MutationObserver;

  const advanceTimers = (ms) => {
    clockOffsetMs += ms;
    for (const t of scheduledTimers) {
      if (!t.cleared && ms >= t.ms) {
        t.cleared = true;
        t.fn();
      }
    }
  };

  return { ctx, win, doc, topbar, main, cityView, navArea, advanceTimers };
}

test('index.html <head> loads Torn Live assets while preserving 100% SHA-256 locked <body> and CSS/JS files', () => {
  const rawHtml = readBytes('index.html');
  const bodyIdx = rawHtml.indexOf(Buffer.from('<body>'));
  assert.ok(bodyIdx > 0, 'index.html must contain <body>');
  const lfBody = Buffer.from(rawHtml.subarray(bodyIdx).toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  assert.equal(
    sha256(lfBody),
    '4c791309a03202d90db55efac2e9a8d02b4bda23914784672056e6abbb205d07',
    'index.html <body> onward must remain 100% byte-identical'
  );

  const head = rawHtml.subarray(0, bodyIdx).toString('utf8');
  const tornCssVer = head.match(/href="\.\/assets\/ui\/zone-torn-live\.css\?v=(\d+)"/);
  const tornJsVer = head.match(/src="\.\/assets\/ui\/zone-torn-live\.js\?v=(\d+)"/);
  assert.ok(tornCssVer && Number(tornCssVer[1]) >= 148, 'zone-torn-live.css?v>=148');
  assert.ok(tornJsVer && Number(tornJsVer[1]) >= 148, 'zone-torn-live.js?v>=148');
  assert.doesNotMatch(head, /\?v=146\b/, 'all ?v=146 head references bumped to ?v>=148');
  assert.match(head, /href="\.\/assets\/ui\/gym116\.css\?v=117"/, 'pinned gym116.css?v=117 preserved');

  for (const rel of ['assets/ui/zone-torn-live.css', 'assets/ui/zone-torn-live.js', 'assets/ui/zone-merits-awards.js', 'sw.js']) {
    assert.ok(existsSync(resolve(root, rel)), `Missing file: ${rel}`);
  }

  for (const jsFile of ['assets/ui/zone-torn-live.js', 'assets/ui/zone-merits-awards.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', resolve(root, jsFile)], { stdio: 'pipe' });
  }

  const swSrc = readUtf8('sw.js');
  const shellMatch = swSrc.match(/SHELL_CACHE_NAME\s*=\s*['"]zone-shell-v(\d+)['"]/);
  const swCssMatch = swSrc.match(/zone-torn-live\.css\?v=(\d+)/);
  const swJsMatch = swSrc.match(/zone-torn-live\.js\?v=(\d+)/);
  assert.ok(shellMatch && Number(shellMatch[1]) >= 148, 'SHELL_CACHE_NAME >= v148');
  assert.ok(swCssMatch && Number(swCssMatch[1]) >= 148, 'sw.js precaches zone-torn-live.css?v>=148');
  assert.ok(swJsMatch && Number(swJsMatch[1]) >= 148, 'sw.js precaches zone-torn-live.js?v>=148');
});

test('zone-torn-live.css enforces 34px single-row HUD strip, hides .zone-bulletin & fake Codex stubs, and preserves AA contrast', () => {
  const css = readUtf8('assets/ui/zone-torn-live.css');
  const opens = (css.match(/\{/g) || []).length;
  const closes = (css.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'CSS braces must be balanced');

  assert.match(css, /--ztl-paper:\s*#141210/i);
  assert.match(css, /--ztl-ink:\s*#f3ecdc/i);
  assert.match(css, /--ztl-paper:\s*#f2ebdc/i);
  assert.match(css, /--ztl-ink:\s*#1e1b18/i);
  assert.match(css, /Patrick Hand/);
  assert.match(css, /Caveat Brush/);
  assert.match(css, /Noto Sans Arabic/);
  assert.match(css, /html\[dir="rtl"\]/);
  assert.match(css, /\.zone-bulletin[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /max-height:\s*36px/);
  assert.match(css, /flex-wrap:\s*nowrap\s*!important/);
  assert.match(css, /scrollbar-width:\s*none\s*!important/);

  assert.ok(contrastRatio('#f3ecdc', '#141210') >= 12, 'Dark mode chalk ink on charcoal paper >= 12:1');
  assert.ok(contrastRatio('#1e1b18', '#f2ebdc') >= 12, 'Light mode fountain-pen ink on cream parchment >= 12:1');
  assert.ok(contrastRatio('#fcf9f2', '#33601f') >= 6, 'Primary CTA button ink contrast >= 6:1');

  for (const legacyStub of [
    'data-torn-master-codex="1"',
    'data-torn-crimes2-panel="1"',
    'data-torn-city-smuggling="1"',
    'data-torn-island-staff="1"',
    'data-torn-jail-tools="1"',
    'data-torn-bank-cds="1"',
    'data-torn-hospital-blood="1"'
  ]) {
    assert.ok(css.includes(legacyStub), `Must retire legacy fake-toast surface: ${legacyStub}`);
  }
});

test('ZoneTornLive whisper-clean HUD Strip + strict 1-route-1-section mounting (ZERO God Deck on home/gym/attack, below map on city, 4s auto-dismiss)', async () => {
  const calls = [];
  const nowMs = Date.now();
  let ownedSym = 400;
  let abroad = false;
  let histDone = false;

  const buildGameplay = () => ({
    player: { id: 'p-148', username: 'ShadowViper', level: 12, cash: 950000, bank_balance: 250000, energy: 100, max_energy: 150, nerve: 35, max_nerve: 45, happy: 500, max_happy: 2500, life: 500, max_life: 500, city: abroad ? 'johannesburg' : 'Zone City' },
    state: {
      version: 5,
      points: 60,
      merits: 8,
      prop: 'island',
      inv: { xanax: 2, edvd: 1, bloodbag: 2, lawyer_card: 1, glasses: 1, plush_camel: 1, plush_bear: 1, plush_moose: 1, plush_pharaoh: 1, plush_falcon: 1, plush_lion: 1 },
      plushies: {},
      eduDone: histDone ? { hist: 1, bio: 1 } : { bio: 1 },
      skill: { crime2_search_for_cash: 42 },
      cooldowns: { drugUntil: nowMs + 3600000, medicalUntil: 0, boosterUntil: 0, overdoseCount: 1 },
      addiction: 6
    },
    tornV2: {
      version: 'ZONE-TORN-148',
      cooldowns: { drugSeconds: 3600, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 1 },
      addiction: 6,
      vaultBalance: 120000,
      vaultCap: 1000000000,
      islandStaff: { hired: { pilot: true } },
      stocks: [
        { ticker: 'SYM', price: 700, blockShares: 500, ownedShares: ownedSym, blockOwned: ownedSym >= 500, blockReadyAt: 0, blockReady: ownedSym >= 500 }
      ],
      activeCd: { term: '7d', principal: 50000, payout: 54230, maturesAt: nowMs - 1000, matured: true },
      crimes2CatalogWithSkill: [
        { id: '1', key: 'search_for_cash', name: 'Search for Cash', nerve: 2, skill: 42, enhancerId: 'glasses', enhancerOwned: true }
      ]
    }
  });

  const apiHandler = async (url, init) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, url, body });

    if (url === '/api/v1/gameplay' && method === 'GET') {
      return { ok: true, status: 200, json: async () => buildGameplay() };
    }
    if (url === '/api/v1/gameplay/action' && method === 'POST') {
      if (body.action === 'stock.buy') ownedSym += 200;
      if (body.action === 'course.enroll' && body.id === 'hist') histDone = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...buildGameplay(),
          result: body.action === 'torn.crime2Execute'
            ? { crimeTier: 'UNIQUE OUTCOME', cashDelta: 9240, skillDelta: 3, lootItem: 'plush_camel' }
            : { cashDelta: -1000, message: `${body.action}:${body.id}` }
        })
      };
    }
    if (url.startsWith('/api/v1/foreign-market')) {
      if (method === 'POST' && body?.action === 'depart') abroad = true;
      if (method === 'POST' && body?.action === 'return') abroad = false;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          currentCity: abroad ? 'johannesburg' : 'Zone City',
          isHomeCity: !abroad,
          isAbroad: abroad,
          activeHubId: abroad ? 'johannesburg' : null,
          travel: abroad
            ? { origin: 'Zone City', destination: 'johannesburg', status: 'arrived', remainingSeconds: 0, totalSeconds: 504, progressPct: 100 }
            : { origin: 'Zone City', destination: 'johannesburg', status: 'traveling', remainingSeconds: 240, totalSeconds: 504, progressPct: 52 },
          perks: { hasAirstrip: true, capacity: 19 },
          luggage: { used: 2, capacity: 19, remaining: 17 },
          rehabClinic: { availableHere: false, addiction: 6, cost: 72000 },
          currentShop: abroad ? { id: 'johannesburg', items: [{ id: 'xanax', nameEn: 'Xanax', nameAr: 'زاناكس', price: 740000, stock: 14 }] } : null
        })
      };
    }
    if (url.startsWith('/api/v1/faction-chain')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          hasFaction: true,
          factionName: { en: 'Sand Vipers', ar: 'أفاعي الرمل' },
          chain: { count: 27, best: 50, nextMilestone: 50, remainingSeconds: 265, multiplier: 1.35 },
          armory: { stock: { smallkit: 5, medkit: 3, xanax: 2, bloodbag: 4 } },
          wall: { territoryId: 'ZC-046', attackerScore: 420, defenderScore: 260, targetScore: 1000 }
        })
      };
    }
    if (url.startsWith('/api/v1/events-feed')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          unreadCount: 2,
          events: [{ id: 'ev1', type: 'bounty_claimed', message: 'Claimed $25,000 bounty on Rayan_Black', createdAt: '2026-11-20T04:00:00Z' }]
        })
      };
    }
    if (url.startsWith('/api/v1/player-profile')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          profile: { id: 'p-target', username: 'Rayan_Black', level: 15, city: 'Zone City', status: 'Hospital', netWorth: 1850000, faction: { name: 'Harbor Kings' }, honorsCount: 6, medalsCount: 4, combatStats: { wins: 31 }, recentAttacks: [{ summary: 'ShadowViper hospitalized Rayan_Black (FF 2.45x)' }] },
          players: [{ id: 'p-target', username: 'Rayan_Black', level: 15, status: 'Hospital', city: 'Zone City' }]
        })
      };
    }
    if (url.startsWith('/api/v1/hospital/patients')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ patients: [{ id: 'p-target', username: 'Rayan_Black', level: 15, npc: false }] })
      };
    }
    if (url === '/api/v1/hospital/revive-player' && method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ ok: true, message: 'Revived Rayan_Black (-25E)' }) };
    }
    if (url === '/api/v1/social/action' && method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  };

  const { ctx, win, doc, main, cityView, advanceTimers } = createHarness(apiHandler, { screen: 'home', lang: 'en' });
  runInContext(readUtf8('assets/ui/zone-torn-live.js'), ctx);
  await win.ZoneTornLive.refreshAll();

  // 0) Whisper-clean HUD Strip: persistent #ztl-hud-story-slot, NO Syndicate Ops button, NO stale feedback
  const hud = doc.getElementById('zone-torn-hud-strip');
  const storySlot = doc.getElementById('ztl-hud-story-slot');
  assert.ok(hud && storySlot, 'HUD strip mounts persistent #ztl-hud-story-slot');
  storySlot.innerHTML = '<span>Act I · Ch.1</span>';
  win.ZoneTornLive.renderAll();
  assert.equal(storySlot.innerHTML, '<span>Act I · Ch.1</span>', '#ztl-hud-story-slot is never clobbered by renderAll()');
  assert.ok(!hud.innerHTML.includes('Syndicate Ops'), 'NO [Syndicate Ops] button in HUD strip');
  assert.ok(hud.innerHTML.includes('Drug') && hud.innerHTML.includes('Med') && hud.innerHTML.includes('Booster'));
  assert.ok(hud.innerHTML.includes('27/50'), 'HUD renders compact Chain milestone');
  assert.ok(hud.innerHTML.includes('✈') && hud.innerHTML.includes('johannesburg'), 'HUD renders compact flight pill while traveling');
  assert.ok(hud.innerHTML.includes('Players') && hud.innerHTML.includes('Events'), 'HUD renders right-aligned Players & Events triggers');
  assert.equal(win.ZoneTornLive.getStore().feedback, null, 'Zero stale feedback toast on initial load');

  // 1) Zero-clutter routes: `home`, `gym`, `attack`, `education`, `jobs`, `casino`, `missions`, `hof`, `newspaper` mount ZERO Torn deck!
  for (const cleanRoute of ['home', 'gym', 'attack', 'education', 'jobs', 'casino', 'missions', 'hof', 'newspaper']) {
    win.ZoneTornLive.openRoute(cleanRoute);
    assert.equal(doc.getElementById('zone-torn-ops-deck'), null, `ZERO #zone-torn-ops-deck on ${cleanRoute}`);
    assert.equal(doc.getElementById('zone-torn-route-section'), null, `ZERO #zone-torn-route-section on ${cleanRoute}`);
  }

  // 2) `crimes` route ONLY -> Crimes 2.0 (13 archetypes, Skill 0-100, Enhancers, Shoplifting, Search for Cash), NO Sync/Minimize buttons
  win.ZoneTornLive.openRoute('crimes');
  let sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec && sec.getAttribute('data-ztl-route') === 'crimes');
  assert.ok(!sec.innerHTML.includes('Sync Live') && !sec.innerHTML.includes('Minimize') && !sec.innerHTML.includes('role="tablist"'));
  assert.ok(sec.innerHTML.includes('Search for Cash') && sec.innerHTML.includes('Arson'), '13 Torn Crimes rendered on crimes');
  assert.ok(sec.innerHTML.includes('42 / 100') && sec.innerHTML.includes('Enhancer Owned (+12%)'));
  assert.ok(!sec.innerHTML.includes('Zone Stock Exchange'), 'No Stocks leaked onto crimes');
  await win.ZoneTornLive.execGameplayAction('torn.crime2Execute', '1');
  assert.ok(sec.innerHTML.includes('UNIQUE OUTCOME') && sec.innerHTML.includes('plush_camel'));

  // Verify 4,000ms auto-dismiss clears action feedback & crime banner automatically
  assert.ok(win.ZoneTornLive.getStore().feedback !== null);
  advanceTimers(4100);
  assert.equal(win.ZoneTornLive.getStore().feedback, null, 'Action toast auto-dismisses after 4000ms');

  // 3) `items` route ONLY -> Pharmacy & Medical Consumables + Happy Jump (Drug CD locks Xanax)
  win.ZoneTornLive.openRoute('items');
  sec = doc.getElementById('zone-torn-route-section');
  assert.match(sec.innerHTML, /data-ztl-pharm-item="xanax"[\s\S]*?data-ztl-act="use-pharm"[^>]*disabled/);
  assert.ok(sec.innerHTML.includes('Run Happy Jump') && sec.innerHTML.includes('Morphine'));
  assert.ok(!sec.innerHTML.includes('Refill Energy (25 pts)'), 'Points refills belong on market, not items');

  // 4) `market` route ONLY -> Points Building Refills (25 pts Energy / Nerve)
  win.ZoneTornLive.openRoute('market');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('Refill Energy (25 pts)') && sec.innerHTML.includes('Refill Nerve (25 pts)'));
  assert.ok(!sec.innerHTML.includes('Zone Stock Exchange'));

  // 5) `bank` route ONLY -> Zone Stock Exchange (8 Tickers & Benefit Blocks) + Bank Term CDs
  win.ZoneTornLive.openRoute('bank');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('400 / 500 sh') && sec.innerHTML.includes('Active Term CD'));
  assert.match(sec.innerHTML, /data-ztl-act="stock-div" data-ticker="SYM" disabled/);
  await win.ZoneTornLive.execGameplayAction('stock.buy', 'SYM:200');
  assert.ok(sec.innerHTML.includes('600 / 500 sh'));
  assert.doesNotMatch(sec.innerHTML, /data-ztl-act="stock-div" data-ticker="SYM" disabled/);
  assert.ok(!sec.innerHTML.includes('Airstrip Pilot'), 'Island staff belongs on properties, not bank');

  // 6) `properties` route ONLY -> Property Mug-Proof Cash Vault & Private Island Staff
  win.ZoneTornLive.openRoute('properties');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('Deposit to Vault') && sec.innerHTML.includes('Airstrip Pilot'));

  // 7) `city` route ONLY -> Airport (11 Foreign Markets) & History Museum mounted AFTER native 3D map view
  win.ZoneTornLive.openRoute('city');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(main.children.indexOf(sec) > main.children.indexOf(cityView), 'Airport & Museum mounted strictly AFTER native city map container');
  assert.ok(sec.innerHTML.includes('Johannesburg [Xanax]') && sec.innerHTML.includes('Zurich [Rehab]'));
  assert.ok(sec.innerHTML.includes('Requires University History (hist) Course'));
  assert.match(sec.innerHTML, /data-ztl-act="museum-exchange" data-id="plushies" disabled/);
  await win.ZoneTornLive.execForeignAction({ action: 'depart', destination: 'johannesburg' });
  assert.ok(sec.innerHTML.includes('data-ztl-abroad-shop="1"') && sec.innerHTML.includes('2 / 19'));
  assert.equal(doc.getElementById('ztl-hud-flight-pill'), null, 'HUD flight pill hides once travel.status === arrived');

  // 8) `hospital` & `jail` & `faction` route-scoped sections
  win.ZoneTornLive.openRoute('hospital');
  await new Promise((r) => setTimeout(r, 10));
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('Rayan_Black') && sec.innerHTML.includes('Clinical Rehab') && sec.innerHTML.includes('Blood Bag'));

  win.ZoneTornLive.openRoute('jail');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('Use Lawyer Card (Release)'));

  win.ZoneTornLive.openRoute('faction');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('ZC-046') && sec.innerHTML.includes('Shared Faction Armory'));
  await win.ZoneTornLive.execFactionAction({ action: 'wall.assault' });
  assert.ok(calls.some((c) => c.url === '/api/v1/faction-chain/action' && c.body?.action === 'wall.assault'));

  // 9) Slide-over `#zone-torn-drawer` opens cleanly even on uncluttered `home` + Arabic RTL switch
  win.ZoneTornLive.openRoute('home');
  assert.equal(doc.getElementById('zone-torn-route-section'), null);
  win.ZoneTornLive.openDrawer('events');
  await new Promise((r) => setTimeout(r, 10));
  const drawer = doc.getElementById('zone-torn-drawer');
  assert.equal(drawer.hidden, false);
  assert.ok(drawer.innerHTML.includes('Rayan_Black') && drawer.innerHTML.includes('Claimed $25,000 bounty'));
  await win.ZoneTornLive.revivePlayer('p-target');
  assert.ok(calls.some((c) => c.url === '/api/v1/hospital/revive-player' && c.body?.targetPlayerId === 'p-target'));

  doc.documentElement.lang = 'ar';
  doc.documentElement.dir = 'rtl';
  win.ZoneTornLive.openRoute('crimes');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('البحث عن النقد') && sec.innerHTML.includes('الحرق الجنائي'));
});

test('zone-merits-awards.js syncs merit.upgrade and merit.reset to /api/v1/gameplay/action online and falls back gracefully offline', async () => {
  const posted = [];
  let online = true;

  const apiHandler = async (url, init) => {
    if (!online) throw new Error('Network offline');
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === 'POST') posted.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        player: { id: 'p-148', cash: 50000 },
        state: {
          version: 9,
          merits: body?.action === 'merit.reset' ? 12 : 7,
          meritTree: body?.action === 'merit.reset' ? {} : { nerve: 2, life: 1 },
          claimedHonors: { h_first_steps: true },
          meritResets: body?.action === 'merit.reset' ? 1 : 0
        }
      })
    };
  };

  const { ctx, win } = createHarness(apiHandler, { screen: 'home', lang: 'en' });
  runInContext(readUtf8('assets/ui/zone-merits-data.js'), ctx);
  runInContext(readUtf8('assets/ui/zone-merits-awards.js'), ctx);

  await win.ZoneMeritsUI.hydrateFromServer();
  const diag1 = win.ZoneMeritsUI.getSyncDiagnostics();
  assert.equal(diag1.hydrated, true);
  assert.equal(diag1.online, true);
  assert.equal(diag1.claimedHonors.h_first_steps, true);

  const upgRes = await win.ZoneMeritsUI.syncActionToServer('merit.upgrade', 'nerve');
  assert.equal(upgRes.ok, true);
  assert.ok(posted.some((b) => b.action === 'merit.upgrade' && b.id === 'nerve'));
  assert.equal(win.ZoneMeritsUI.getSyncDiagnostics().meritTree.nerve, 2);

  const rstRes = await win.ZoneMeritsUI.syncActionToServer('merit.reset', 'all');
  assert.equal(rstRes.ok, true);
  assert.ok(posted.some((b) => b.action === 'merit.reset'));
  assert.equal(win.ZoneMeritsUI.getSyncDiagnostics().merits, 12);

  online = false;
  const offRes = await win.ZoneMeritsUI.syncActionToServer('merit.upgrade', 'life');
  assert.equal(offRes.ok, false);
  assert.equal(offRes.offline, true);
  assert.equal(win.ZoneMeritsUI.getSyncDiagnostics().online, false);
});

test('v148 live PHP contract regressions: messageEn/messageAr, stealth recentAttacks, staff/stock catalog prices, overdosed boolean, and pointsAwarded/pointsSpent', async () => {
  let nextActionResult = {};

  const apiHandler = async (url, init) => {
    const method = (init.method || 'GET').toUpperCase();
    if (url === '/api/v1/gameplay' && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          player: { id: 'p-148', username: 'ShadowViper', cash: 900000, points: 80 },
          state: { version: 4, points: 80, prop: 'island', inv: { xanax: 2 }, eduDone: { hist: 1 } },
          tornV2: {
            version: 'ZONE-TORN-148',
            cooldowns: { drugSeconds: 0, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 0 },
            addiction: 0,
            vaultBalance: 0,
            vaultCap: 1000000000,
            islandStaff: {
              hired: { pilot: true },
              catalog: {
                pilot: { cost: 150000 },
                doctor: { cost: 65000 },
                vault_guard: { cost: 95000 },
                butler: { cost: 35000 }
              }
            },
            stocks: []
          }
        })
      };
    }
    if (url === '/api/v1/gameplay/action' && method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          player: { id: 'p-148', username: 'ShadowViper', cash: 900000, points: 90 },
          state: { version: 5, points: 90, prop: 'island', inv: { xanax: 1 }, eduDone: { hist: 1 } },
          tornV2: { cooldowns: { drugSeconds: 1800, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 1 }, addiction: 5, stocks: [] },
          result: nextActionResult
        })
      };
    }
    if (url.startsWith('/api/v1/events-feed')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          unreadCount: 1,
          events: [
            {
              id: 'ev-live-1',
              type: 'bounty_placed',
              messageEn: 'Duke_X placed a $50,000 bounty on your head!',
              messageAr: 'رصد Duke_X مكافأة بقيمة $50,000 على رأسك!',
              occurredAt: '2026-11-20T05:00:00Z',
              unread: true
            }
          ]
        })
      };
    }
    if (url.startsWith('/api/v1/player-profile')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          profile: {
            id: 'p-def',
            username: 'VictimOp',
            level: 11,
            city: 'Zone City',
            status: 'Hospital',
            netWorth: 650000,
            recentAttacks: [
              { attackerId: null, attackerName: 'Someone', defenderId: 'p-def', defenderName: 'VictimOp', approach: 'hosp', outcome: 'won', stealthed: true },
              { attackerId: 'p-2', attackerName: 'Layla_R', defenderId: 'p-def', defenderName: 'VictimOp', approach: 'mug', outcome: 'won', stealthed: false }
            ]
          },
          players: [{ id: 'p-def', username: 'VictimOp', level: 11, status: 'Hospital', city: 'Zone City' }]
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({ patients: [], hubs: [] }) };
  };

  const { ctx, win, doc } = createHarness(apiHandler, { screen: 'bank', lang: 'en' });
  runInContext(readUtf8('assets/ui/zone-torn-live.js'), ctx);
  await win.ZoneTornLive.refreshAll();

  // 1) Stock fallback prices on `bank` & Island Staff costs/hired on `properties` match TornSystemsService.php
  let sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('$12,400/sh'), 'FHG fallback basePrice matches 12400');
  assert.ok(sec.innerHTML.includes('$2,950/sh'), 'PRN fallback basePrice matches 2950');

  win.ZoneTornLive.openRoute('properties');
  sec = doc.getElementById('zone-torn-route-section');
  assert.ok(sec.innerHTML.includes('$65,000'), 'Estate Physician cost matches 65000');
  assert.ok(sec.innerHTML.includes('$95,000'), 'Vault Security Detail cost matches 95000');
  assert.ok(sec.innerHTML.includes('$35,000'), 'Senior Butler cost matches 35000');
  assert.ok(sec.innerHTML.includes('Hired ✓'), 'Pilot read from tornV2.islandStaff.hired');

  // 2) events-feed messageEn & recentAttacks attackerName/defenderName/approach in EN inside #zone-torn-drawer
  win.ZoneTornLive.openDrawer('directory');
  await new Promise((r) => setTimeout(r, 15));
  const drawer = doc.getElementById('zone-torn-drawer');
  assert.ok(drawer.innerHTML.includes('Duke_X placed a $50,000 bounty on your head!'), 'Renders messageEn instead of raw ev.type');
  assert.ok(drawer.innerHTML.includes('Someone → VictimOp (hosp · won)'), 'Renders stealthed Someone + approach + outcome');
  assert.ok(drawer.innerHTML.includes('Layla_R → VictimOp (mug · won)'), 'Renders attackerName -> defenderName');

  // 3) Arabic RTL renders messageAr & 'مجهول' for stealthed Someone
  doc.documentElement.lang = 'ar';
  doc.documentElement.dir = 'rtl';
  win.ZoneTornLive.renderAll();
  assert.ok(drawer.innerHTML.includes('رصد Duke_X مكافأة بقيمة $50,000 على رأسك!'), 'Renders messageAr in RTL');
  assert.ok(drawer.innerHTML.includes('مجهول → VictimOp (hosp · won)'), 'Renders مجهول for stealthed attacker in RTL');

  // 4) Overdose boolean `overdosed: true` triggers red 'bad' OVERDOSE banner
  doc.documentElement.lang = 'en';
  doc.documentElement.dir = 'ltr';
  nextActionResult = { overdosed: true, message: 'Xanax overdose! 30m Hospital.' };
  await win.ZoneTornLive.execGameplayAction('drug.use', 'xanax');
  assert.equal(win.ZoneTornLive.getStore().feedback.tone, 'bad');
  assert.match(win.ZoneTornLive.getStore().feedback.text, /OVERDOSE!/);

  // 5) Points delta handles pointsAwarded (+10) & pointsSpent (-25)
  nextActionResult = { pointsAwarded: 10, message: 'Museum Plushie Set Exchanged' };
  await win.ZoneTornLive.execGameplayAction('museum.exchange', 'plushies');
  assert.match(win.ZoneTornLive.getStore().feedback.text, /\+10 pts/);

  nextActionResult = { pointsSpent: 25, message: 'Energy Refilled' };
  await win.ZoneTornLive.execGameplayAction('points.refillEnergy', 'energy');
  assert.match(win.ZoneTornLive.getStore().feedback.text, /-25 pts/);
});

test('Playwright responsive & route-scoped IA parity check (390x844 mobile HUD <= 42px, home/gym uncluttered, city map above Airport/Museum, zero overflow)', async (t) => {
  let playwrightMod = null;
  for (const candidate of [
    'playwright',
    'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\playwright\\index.mjs',
    'C:\\Users\\user\\.gemini\\node_modules\\playwright\\index.mjs'
  ]) {
    try {
      playwrightMod = await import(candidate);
      break;
    } catch (_) {}
  }
  if (!playwrightMod) {
    t.skip('Playwright module not installed in this environment');
    return;
  }

  let browser = null;
  for (const opts of [{ headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }, { headless: true }]) {
    try {
      browser = await playwrightMod.chromium.launch(opts);
      break;
    } catch (_) {}
  }
  if (!browser) {
    t.skip('No headless browser binary available in this environment');
    return;
  }

  const http = await import('node:http');
  const { statSync } = await import('node:fs');
  const { extname } = await import('node:path');
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2'
  };

  const nowMs = Date.now();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/api/v1/auth/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ playerId: 'p-148', mode: 'guest', expiresAt: Math.floor(nowMs / 1000) + 3600 }));
      return;
    }
    if (u.pathname === '/api/v1/gameplay' || u.pathname === '/api/v1/gameplay/action') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        player: { id: 'p-148', username: 'ShadowViper', level: 12, cash: 950000, bank_balance: 250000, energy: 100, max_energy: 150, nerve: 35, max_nerve: 45, happy: 500, max_happy: 2500, life: 500, max_life: 500, strength: 300, defense: 300, speed: 300, dexterity: 300, city: 'Zone City' },
        state: { version: 2, points: 50, merits: 6, prop: 'island', inv: { xanax: 2, glasses: 1 }, plushies: {}, eduDone: { bio: 1, hist: 1 }, skill: {}, cooldowns: { drugUntil: nowMs + 3600000, medicalUntil: 0, boosterUntil: 0, overdoseCount: 0 }, addiction: 4, meritTree: { nerve: 2 }, claimedHonors: {}, claimedMedals: {}, fac: { chain: 15, best: 25, respect: 500, ups: {} }, ctr: { crimes: 10, trains: 10, wins: 5, shifts: 2 }, claimed: {}, market: [], inmates: [], patients: [] },
        tornV2: { version: 'ZONE-TORN-148', cooldowns: { drugSeconds: 3600, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 0 }, addiction: 4, vaultBalance: 50000, vaultCap: 1000000000, stocks: [{ ticker: 'SYM', price: 700, blockShares: 500, ownedShares: 500, blockOwned: true, blockReadyAt: 0, blockReady: true }], crimes2CatalogWithSkill: [] }
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/foreign-market')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ currentCity: 'Zone City', isHomeCity: true, isAbroad: false, travel: { origin: 'Zone City', destination: 'johannesburg', status: 'traveling', remainingSeconds: 200, totalSeconds: 400, progressPct: 50 }, perks: { hasAirstrip: true, capacity: 15 }, luggage: { used: 1, capacity: 15 } }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/faction-chain')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasFaction: true, chain: { count: 15, best: 25, nextMilestone: 25, remainingSeconds: 240, multiplier: 1.25 }, armory: { stock: { smallkit: 3, medkit: 2, xanax: 1, bloodbag: 2 } }, wall: { territoryId: 'ZC-046', attackerScore: 320, defenderScore: 210, targetScore: 1000 } }));
      return;
    }
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events: [], players: [], patients: [], blocks: [] }));
      return;
    }
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname).replace(/^\/+/, '');
    const abs = resolve(root, rel);
    if (existsSync(abs) && statSync(abs).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
      res.end(readBytes(rel));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    for (const sc of [
      { width: 1440, height: 900, lang: 'en', theme: 'light' },
      { width: 390, height: 844, lang: 'ar', theme: 'dark' }
    ]) {
      const context = await browser.newContext({ viewport: { width: sc.width, height: sc.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // 1) Home & Gym: ZERO ops-deck clutter, HUD height <= 42px on 390x844 mobile & 1440x900 desktop
      await page.goto(`http://127.0.0.1:${port}/?screen=home&lang=${sc.lang}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zone-torn-hud-strip', { timeout: 10000 });
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), sc.theme);
      await page.waitForTimeout(180);

      const homeM = await page.evaluate(() => ({
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        hudH: document.getElementById('zone-torn-hud-strip')?.offsetHeight || 0,
        bulletinH: document.querySelector('.zone-bulletin')?.offsetHeight || 0,
        opsDeck: Boolean(document.getElementById('zone-torn-ops-deck')),
        routeSec: Boolean(document.getElementById('zone-torn-route-section')),
        dir: document.documentElement.dir
      }));
      assert.equal(homeM.overflowX, 0, `Zero horizontal overflow on home (${sc.width}x${sc.height} ${sc.lang})`);
      assert.ok(homeM.hudH > 0 && homeM.hudH <= 42, `HUD strip height ${homeM.hudH}px <= 42px (${sc.width}x${sc.height})`);
      assert.equal(homeM.bulletinH, 0, '.zone-bulletin hidden cleanly');
      assert.equal(homeM.opsDeck, false, 'ZERO #zone-torn-ops-deck on home');
      assert.equal(homeM.routeSec, false, 'ZERO #zone-torn-route-section on home');
      assert.equal(homeM.dir, sc.lang === 'ar' ? 'rtl' : 'ltr');

      await page.evaluate(() => window.ZoneTornLive.openRoute('gym'));
      await page.waitForTimeout(150);
      const gymSec = await page.evaluate(() => Boolean(document.getElementById('zone-torn-route-section') || document.getElementById('zone-torn-ops-deck')));
      assert.equal(gymSec, false, 'ZERO Torn ops/route clutter on gym');

      // 2) Crimes & Bank: route-scoped sections mounted below native panels
      await page.evaluate(() => window.ZoneTornLive.openRoute('crimes'));
      await page.waitForSelector('#zone-torn-route-section[data-ztl-route="crimes"]', { timeout: 5000 });
      const crimesOrder = await page.evaluate(() => {
        const nativeCrime = document.querySelector('.zone-crime-workspace');
        const tornSec = document.getElementById('zone-torn-route-section');
        return {
          nativeTop: nativeCrime ? nativeCrime.getBoundingClientRect().top : 0,
          secTop: tornSec ? tornSec.getBoundingClientRect().top : 0,
          overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });
      assert.ok(crimesOrder.secTop > crimesOrder.nativeTop, 'Crimes 2.0 section mounted BELOW native crimes workspace');
      assert.equal(crimesOrder.overflowX, 0);

      await page.evaluate(() => window.ZoneTornLive.openRoute('bank'));
      await page.waitForSelector('#zone-torn-route-section[data-ztl-route="bank"]', { timeout: 5000 });
      const bankHtml = await page.evaluate(() => document.getElementById('zone-torn-route-section')?.innerHTML || '');
      assert.ok(bankHtml.includes('SYM') && bankHtml.includes('500'), 'Bank renders Stock Exchange & Benefit Blocks');

      // 3) City: Airport & Museum mounted STRICTLY BELOW the 3D City Map container
      await page.evaluate(() => window.ZoneTornLive.openRoute('city'));
      await page.waitForSelector('#zone-torn-route-section[data-ztl-route="city"]', { timeout: 5000 });
      await page.waitForTimeout(150);
      const cityGeom = await page.evaluate(() => {
        const cityView = document.querySelector('[data-zone-city-view="1"]');
        const mapEl = document.querySelector('#zone-city-map, .zone-city-map-shell, #zwc-city-panorama-stage') || cityView;
        const sec = document.getElementById('zone-torn-route-section');
        const mapRect = mapEl ? mapEl.getBoundingClientRect() : { top: 0, bottom: 0 };
        const secRect = sec ? sec.getBoundingClientRect() : { top: 0 };
        return {
          mapTop: mapRect.top,
          mapBottom: mapRect.bottom,
          secTop: secRect.top,
          overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });
      assert.ok(cityGeom.secTop >= cityGeom.mapBottom - 2, `Airport/Museum (${cityGeom.secTop}px) must sit strictly BELOW City Map (${cityGeom.mapBottom}px)`);
      assert.equal(cityGeom.overflowX, 0, 'Zero horizontal overflow on city');

      assert.equal(pageErrors.length, 0, 'Zero runtime page errors');
      await context.close();
    }
  } finally {
    await browser.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
  }
});

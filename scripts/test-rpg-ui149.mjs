import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, extname } from 'node:path';
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

/* Minimal DOM harness for VM execution of zone-rpg-empire.js */
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

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = String(val == null ? '' : val);
    this._textContent = this._innerHTML.replace(/<[^>]+>/g, '');
  }

  get textContent() { return this._textContent || this._innerHTML.replace(/<[^>]+>/g, ''); }
  set textContent(val) {
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

  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }

  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    const idx = this.children.indexOf(ref);
    if (idx >= 0) this.children.splice(idx, 0, child);
    else this.children.push(child);
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
      closest: (sel) => (sel === '[data-zre-act]' && 'data-zre-act' in attrs ? target : null)
    };
    const ev = { target, preventDefault() {}, stopPropagation() {} };
    for (const fn of this.listeners.get('click') || []) fn(ev);
  }

  querySelector(sel) {
    if (sel === '.zone-bulletin') {
      return this.children.find((c) => c.className === 'zone-bulletin') || null;
    }
    if (sel.startsWith('#')) return this.ownerDocument.getElementById(sel.slice(1));
    return null;
  }

  querySelectorAll() { return []; }
}

function createRpgHarness(apiHandler, opts = {}) {
  const docListeners = new Map();
  const winListeners = new Map();
  const localStore = new Map();

  const doc = {
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
    documentElement: new MiniElement('html', null),
    body: new MiniElement('body', null),
    createElement(tag) { return new MiniElement(tag, doc); },
    getElementById(id) {
      const stack = [doc.body];
      while (stack.length) {
        const cur = stack.pop();
        if (cur.id === id) return cur;
        for (const ch of cur.children || []) stack.push(ch);
      }
      return null;
    },
    querySelector(sel) {
      if (sel === 'x-dc') return null;
      if (sel === '.zone-topbar') return topbar;
      if (sel === 'aside.zone-sidebar .zone-profile-body') return profileBody;
      if (sel === '#zone-main .zone-page-heading > div:last-child') return headingActions;
      if (sel.startsWith('#')) return doc.getElementById(sel.slice(1));
      return null;
    },
    querySelectorAll() { return []; },
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
  const bulletin = new MiniElement('div', doc);
  bulletin.className = 'zone-bulletin';
  topbar.appendChild(bulletin);

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
  main.setAttribute('data-zone-screen', opts.screen || 'missions');
  const pageHeading = new MiniElement('div', doc);
  pageHeading.className = 'zone-page-heading';
  const headingActions = new MiniElement('div', doc);
  pageHeading.appendChild(headingActions);
  main.appendChild(pageHeading);

  doc.body.appendChild(topbar);
  doc.body.appendChild(sidebar);
  doc.body.appendChild(main);

  const win = {
    location: new URL(opts.url || 'https://zone.test/?screen=missions'),
    localStorage: {
      getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
      setItem: (k, v) => localStore.set(k, String(v)),
      removeItem: (k) => localStore.delete(k)
    },
    ZoneSession: { ensure: async () => ({ playerId: 'p-149', mode: 'guest' }) },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      for (const fn of winListeners.get(ev.type) || []) fn(ev);
    },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    scrollTo() {},
    fetch: async (url, init = {}) => apiHandler(String(url), init)
  };

  const ctx = createContext({
    console,
    URL,
    URLSearchParams,
    Date,
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

  return { ctx, win, doc, bulletin, main, profileBody, navArea };
}

test('index.html <head> & sw.js load v149 RPG Empire assets with 0 SHA-256 lock violations on <body>', () => {
  const rawHtml = readBytes('index.html');
  const bodyIdx = rawHtml.indexOf(Buffer.from('<body>'));
  assert.ok(bodyIdx > 0, 'index.html must contain <body>');
  assert.equal(
    sha256(rawHtml.subarray(bodyIdx)),
    '68fd3de219ee1de7b2a3f72223f7866ac956448b030e5999362e92eef9fcd313',
    'index.html <body> onward must remain 100% byte-identical'
  );

  const head = rawHtml.subarray(0, bodyIdx).toString('utf8');
  assert.match(head, /href="\.\/assets\/ui\/zone-rpg-empire\.css\?v=149"/);
  assert.match(head, /src="\.\/assets\/ui\/zone-rpg-empire\.js\?v=149"/);
  assert.doesNotMatch(head, /\?v=148\b/, 'all ?v=148 head references bumped to ?v=149');
  assert.match(head, /href="\.\/assets\/ui\/gym116\.css\?v=117"/, 'pinned gym116.css?v=117 preserved');

  for (const rel of ['assets/ui/zone-rpg-empire.css', 'assets/ui/zone-rpg-empire.js', 'sw.js']) {
    assert.ok(existsSync(resolve(root, rel)), `Missing file: ${rel}`);
  }

  for (const jsFile of ['assets/ui/zone-rpg-empire.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', resolve(root, jsFile)], { stdio: 'pipe' });
  }

  const swSrc = readUtf8('sw.js');
  assert.match(swSrc, /SHELL_CACHE_NAME\s*=\s*['"]zone-shell-v149['"]/);
  assert.match(swSrc, /zone-rpg-empire\.css\?v=149/);
  assert.match(swSrc, /zone-rpg-empire\.js\?v=149/);
});

test('zone-rpg-empire.css enforces Sketchbook Light & Dark >12:1 contrast, RTL typography, balanced braces, and fiber-safe ticker replacement', () => {
  const css = readUtf8('assets/ui/zone-rpg-empire.css');
  const opens = (css.match(/\{/g) || []).length;
  const closes = (css.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'CSS braces must be balanced');

  assert.match(css, /--zre-paper:\s*#141210/i);
  assert.match(css, /--zre-ink:\s*#f3ecdc/i);
  assert.match(css, /--zre-paper:\s*#f2ebdc/i);
  assert.match(css, /--zre-ink:\s*#1e1b18/i);
  assert.match(css, /Patrick Hand/);
  assert.match(css, /Caveat Brush/);
  assert.match(css, /Noto Sans Arabic/);
  assert.match(css, /html\[dir="rtl"\]/);
  assert.match(css, /data-zre-hydrated="1"\]\s*\[data-zticker="1"\]/);

  assert.ok(contrastRatio('#f3ecdc', '#141210') >= 12, 'Dark mode chalk ink >= 12:1');
  assert.ok(contrastRatio('#1e1b18', '#f2ebdc') >= 12, 'Light mode fountain-pen ink >= 12:1');
});

test('ZoneRpgEmpire hydrates Current Mission banner, Sidebar Rank card, contextual screens, EN/AR RTL, and all 5 v149 API workspaces', async () => {
  const calls = [];
  const unlockedSkills = { street_instinct: true };
  let holdLevel = true;
  let pendingLevels = 2;

  const apiHandler = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, url, body });

    if (url.startsWith('/api/v1/story-campaign')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          activeChapterId: 'act1_ch1',
          alignment: body?.choice || 'syndicate',
          chapters: [
            {
              id: 'act1_ch1',
              act: 1,
              chapterNumber: 1,
              titleEn: 'Dockside Blood',
              titleAr: 'دماء الرصيف',
              objectivesDone: 3,
              objectivesTotal: 5,
              hasBoss: true,
              hasChoice: true
            }
          ],
          result: { messageEn: `Story:${body?.action || 'snap'}`, spAwarded: 1 }
        })
      };
    }

    if (url.startsWith('/api/v1/player-rpg')) {
      if (method === 'POST' && body?.action === 'skillTree.unlock') {
        unlockedSkills[body.nodeId] = true;
      }
      if (method === 'POST' && body?.action === 'level.promote') {
        pendingLevels = 0;
      }
      if (method === 'POST' && body?.action === 'level.toggleHold') {
        holdLevel = Boolean(body.enabled);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          leveling: { level: 10, potentialLevel: 10 + pendingLevels, pendingLevels, holdLevel },
          rank: {
            rankNumber: 4,
            titleEn: 'Rookie',
            titleAr: 'مستجد',
            nextTitleEn: 'Novice',
            nextTitleAr: 'ناشئ',
            claimable: true,
            totalTriggers: 4,
            breakdown: { level: 1, battleStats: 1, networth: 1, crimes: 1 }
          },
          skillTree: {
            availableSp: 4,
            spentSp: Object.keys(unlockedSkills).length,
            respecCount: 0,
            unlockedNodes: { ...unlockedSkills }
          },
          masterySkills: { hunting: 55, racing: 32, reviving: 20 },
          workStats: { man: 120, int: 95, end: 140 },
          result: { messageEn: `RPG:${body?.action || 'snap'}` }
        })
      };
    }

    if (url.startsWith('/api/v1/city-activities')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          missionAgents: {
            missionCredits: 80,
            contracts: [{ id: 'c_1', tier: 'Easy', agent: 'Duke', titleEn: 'Harbor Run', titleAr: 'جولة المرفأ', progress: 3, target: 3, credits: 20, cash: 15000, accepted: true }]
          },
          dump: { poolSize: 24 },
          loanShark: { principal: 25000, maxLoan: 250000, dukeEnforcerHeat: false },
          hunting: { skill: 55 },
          racing: { racingPoints: 18, activeCarId: 'civic_e', ownedCars: { civic_e: true } },
          result: { messageEn: `Act:${body?.action || 'snap'}`, prizeLabel: '$50,000 Jackpot' }
        })
      };
    }

    if (url.startsWith('/api/v1/syndicate-economy')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          trades: [{ id: 'tr-101', partnerId: 'p-2', status: 'open' }],
          bazaar: { open: true, listings: [{ id: 'bz-1', itemId: 'xanax', quantity: 2, unitPrice: 800000 }] },
          company: { id: 'co-1', name: 'Harbor Logistics', stars: 5, jobPts: 22 },
          companies: [{ id: 'co-2', name: 'Aegis Security', stars: 7 }],
          marriage: { spouseId: 'p-9', proposals: [{ id: 'pr-1', fromId: 'p-3' }] },
          result: { messageEn: `Eco:${body?.action || 'snap'}` }
        })
      };
    }

    if (url.startsWith('/api/v1/faction-empire')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          faction: { id: 'fac-1', nameEn: 'Iron Lotus', tag: 'ILTS', vaultBalance: 450000, respect: 1200, members: [{ playerId: 'p-2', username: 'Viper', role: 'member' }] },
          directory: [{ id: 'fac-2', nameEn: 'Red Fang', nameAr: 'الناب الأحمر', tag: 'FANG', respect: 900 }],
          respectTree: { criminality: { crime_skill: 2 } },
          organizedCrime: { id: 'oc-77', heistId: 'armored_van', slots: { mastermind: 'p-149' } },
          rankedWar: { ourScore: 14, theirScore: 9, targetLead: 25 },
          warCaches: { gold: 1 },
          loadout: { armorMitigationPct: 38, weaponMultiplier: 3.8, slots: { primary: 'ak', body: 'vest' } },
          result: { messageEn: `Emp:${body?.action || 'snap'}` }
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  const { ctx, win, doc, bulletin, main } = createRpgHarness(apiHandler, { screen: 'missions', lang: 'en' });
  runInContext(readUtf8('assets/ui/zone-rpg-empire.js'), ctx);
  await win.ZoneRpgEmpire.refreshAll();

  // 1) Topbar Current Mission & Rank Banner hydrated cleanly
  assert.equal(bulletin.getAttribute('data-zre-hydrated'), '1');
  const banner = doc.getElementById('zre-mission-banner');
  assert.ok(banner, '#zre-mission-banner mounted');
  assert.match(banner.innerHTML, /Act I · Ch\.1: Dockside Blood — 3\/5 Objectives/);
  assert.match(banner.innerHTML, /#4 Rookie → #5 Novice/);
  assert.match(banner.innerHTML, /4 SP/);
  assert.match(banner.innerHTML, /Promote Lv/);

  // 2) Contextual screen mapping across required screens
  for (const [scr, expectedTab] of [
    ['missions', 'story'],
    ['education', 'rpg'],
    ['hof', 'rpg'],
    ['city', 'activities'],
    ['jobs', 'economy'],
    ['market', 'economy'],
    ['properties', 'economy'],
    ['faction', 'empire'],
    ['items', 'empire']
  ]) {
    main.setAttribute('data-zone-screen', scr);
    win.ZoneRpgEmpire.renderAll();
    assert.equal(win.ZoneRpgEmpire.getStore().activeTab, expectedTab, `Screen ${scr} -> tab ${expectedTab}`);
  }

  const deck = doc.getElementById('zone-rpg-empire-deck');

  // 3) Tab 1: Story & Agents actions
  win.ZoneRpgEmpire.openTab('story');
  deck.dispatchClick({ 'data-zre-act': 'story-choice', 'data-chapter': 'act1_ch1', 'data-choice': 'syndicate' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'story-boss', 'data-chapter': 'act1_ch1' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'story-claim', 'data-chapter': 'act1_ch1' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'agent-complete', 'data-id': 'c_1' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'agent-buy', 'data-id': 'xanax' });
  await new Promise((r) => setTimeout(r, 10));

  // 4) Tab 2: Leveling 2.0, 26-Rank & 4-Branch Skill Tree actions
  win.ZoneRpgEmpire.openTab('rpg');
  assert.match(deck.innerHTML, /Shadow Mastermind/);
  assert.match(deck.innerHTML, /Warlord Enforcer/);
  assert.match(deck.innerHTML, /Syndicate Mogul/);
  assert.match(deck.innerHTML, /Bio-Alchemist/);
  deck.dispatchClick({ 'data-zre-act': 'skill-unlock', 'data-node': 'silent_footsteps', 'data-branch': 'shadow' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'level-promote' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'rank-claim' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'work-train', 'data-stat': 'int' });
  await new Promise((r) => setTimeout(r, 10));

  // 5) Tab 3: Spin Wheels, Dump, Loan Shark, Hunting & Racing actions
  win.ZoneRpgEmpire.openTab('activities');
  deck.dispatchClick({ 'data-zre-act': 'wheel-spin', 'data-wheel': 'awesome' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'dump-search' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'loan-borrow' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'hunt-go', 'data-mode': 'master' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'race-track', 'data-track': 'zone_gp', 'data-car': 'civic_e' });
  await new Promise((r) => setTimeout(r, 10));

  // 6) Tab 4: Trades, Bazaars, Companies & Marriage actions
  win.ZoneRpgEmpire.openTab('economy');
  deck.dispatchClick({ 'data-zre-act': 'trade-create' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'trade-accept', 'data-trade': 'tr-101' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'bazaar-list' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'company-work' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'marriage-propose' });
  await new Promise((r) => setTimeout(r, 10));

  // 7) Tab 5: Faction Empire, Respect Tree, 4-Role OC, Ranked War & 9-Slot Loadout
  win.ZoneRpgEmpire.openTab('empire');
  deck.dispatchClick({ 'data-zre-act': 'faction-create' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'respect-upgrade', 'data-branch': 'criminality', 'data-node': 'crime_skill' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'oc-claim-slot', 'data-oc': 'oc-77', 'data-role': 'hacker' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'oc-execute', 'data-oc': 'oc-77' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'war-cache', 'data-tier': 'gold' });
  await new Promise((r) => setTimeout(r, 10));
  deck.dispatchClick({ 'data-zre-act': 'loadout-equip', 'data-slot': 'primary' });
  await new Promise((r) => setTimeout(r, 10));

  const postedActions = calls.filter((c) => c.method === 'POST').map((c) => c.body?.action);
  for (const expectedAction of [
    'chapter.choice', 'chapter.bossFight', 'chapter.claim',
    'agent.complete', 'agent.buyReward',
    'skillTree.unlock', 'level.promote', 'rank.claimPromotion', 'workStats.train',
    'wheel.spin', 'dump.search', 'loan.borrow', 'hunt.expedition', 'race.enterTrack',
    'trade.create', 'trade.accept', 'bazaar.listItem', 'company.workShift', 'marriage.propose',
    'faction.create', 'tree.upgrade', 'oc.claimSlot', 'oc.execute', 'war.claimCache', 'loadout.equipSlot'
  ]) {
    assert.ok(postedActions.includes(expectedAction), `Dispatched ${expectedAction}`);
  }

  // 8) Arabic RTL parity check
  doc.documentElement.lang = 'ar';
  doc.documentElement.dir = 'rtl';
  win.ZoneRpgEmpire.openTab('story');
  assert.match(banner.innerHTML, /دماء الرصيف/);
  assert.match(banner.innerHTML, /#4 مستجد ← #5 ناشئ/);
  assert.match(deck.innerHTML, /قيادة القصة والرتب وإمبراطورية النقابة/);
});

test('Playwright 4-way responsive & zero-overflow check across all 5 RPG tabs (390x844 mobile & 1440x900 desktop, Light/Dark, EN/AR RTL)', async (t) => {
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
      res.end(JSON.stringify({ playerId: 'p-149', mode: 'guest', expiresAt: Math.floor(nowMs / 1000) + 3600 }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/story-campaign')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ activeChapterId: 'act1_ch1', alignment: 'syndicate', chapters: [{ id: 'act1_ch1', act: 1, chapterNumber: 1, titleEn: 'Dockside Blood', titleAr: 'دماء الرصيف', objectivesDone: 3, objectivesTotal: 5 }] }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/player-rpg')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ leveling: { level: 12, potentialLevel: 14, pendingLevels: 2, holdLevel: true }, rank: { rankNumber: 4, titleEn: 'Rookie', titleAr: 'مستجد', nextTitleEn: 'Novice', nextTitleAr: 'ناشئ', claimable: true, totalTriggers: 4 }, skillTree: { availableSp: 5, spentSp: 1, unlockedNodes: { street_instinct: true } }, masterySkills: { hunting: 60, racing: 40 }, workStats: { man: 100, int: 100, end: 100 } }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/city-activities')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ missionAgents: { missionCredits: 50, contracts: [] }, dump: { poolSize: 20 }, loanShark: { principal: 10000, maxLoan: 300000 }, hunting: { skill: 60 }, racing: { racingPoints: 12, activeCarId: 'civic_e', ownedCars: { civic_e: true } } }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/syndicate-economy')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ trades: [{ id: 'tr-1', partnerId: 'p-2', status: 'open' }], bazaar: { open: true, listings: [] }, company: { id: 'co-1', name: 'Zone Rig', stars: 4, jobPts: 15 }, marriage: { spouseId: null, proposals: [] } }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/faction-empire')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ faction: { id: 'fac-1', nameEn: 'Iron Lotus', tag: 'ILTS', vaultBalance: 250000, respect: 800, members: [] }, directory: [{ id: 'fac-2', nameEn: 'Red Fang', nameAr: 'الناب الأحمر', tag: 'FANG', respect: 500 }], respectTree: {}, organizedCrime: { id: 'oc-1', heistId: 'armored_van', slots: {} }, rankedWar: { ourScore: 10, theirScore: 6 }, warCaches: { gold: 1 }, loadout: { armorMitigationPct: 30, weaponMultiplier: 2.5, slots: { primary: 'ak', body: 'vest' } } }));
      return;
    }
    if (u.pathname === '/api/v1/gameplay' || u.pathname === '/api/v1/gameplay/action') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        player: { id: 'p-149', username: 'ShadowViper', level: 12, cash: 950000, bank_balance: 250000, energy: 100, max_energy: 150, nerve: 35, max_nerve: 45, happy: 500, max_happy: 2500, life: 500, max_life: 500, city: 'Zone City' },
        state: { version: 2, points: 50, merits: 6, prop: 'island', inv: { xanax: 2, glasses: 1, ak: 1, vest: 1 }, plushies: {}, eduDone: { bio: 1, hist: 1 }, skill: {}, cooldowns: { drugUntil: 0, medicalUntil: 0, boosterUntil: 0, overdoseCount: 0 }, addiction: 0, meritTree: {}, claimedHonors: {}, claimedMedals: {}, fac: { chain: 5, best: 10, respect: 500, ups: {} }, ctr: { crimes: 10, trains: 10, wins: 5, shifts: 2 }, claimed: {}, market: [], inmates: [], patients: [] },
        tornV2: { version: 'ZONE-TORN-148', cooldowns: { drugSeconds: 0, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 0 }, addiction: 0, vaultBalance: 50000, vaultCap: 1000000000, stocks: [], crimes2CatalogWithSkill: [] }
      }));
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
      { width: 390, height: 844, lang: 'ar', theme: 'dark' },
      { width: 390, height: 844, lang: 'en', theme: 'light' },
      { width: 1440, height: 900, lang: 'ar', theme: 'dark' }
    ]) {
      const context = await browser.newContext({ viewport: { width: sc.width, height: sc.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(`http://127.0.0.1:${port}/?screen=missions&lang=${sc.lang}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zre-mission-banner', { timeout: 10000 });
      await page.waitForSelector('#zone-rpg-empire-deck', { timeout: 10000 });

      for (const tab of ['story', 'rpg', 'activities', 'economy', 'empire']) {
        await page.evaluate((cfg) => {
          document.documentElement.setAttribute('data-theme', cfg.theme);
          window.ZoneRpgEmpire.openTab(cfg.tab);
        }, { theme: sc.theme, tab });
        await page.waitForTimeout(120);

        const m = await page.evaluate(() => {
          const ticker = document.querySelector('.zone-bulletin [data-zticker="1"]');
          return {
            overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            bannerH: document.getElementById('zre-mission-banner')?.offsetHeight || 0,
            deckH: document.getElementById('zone-rpg-empire-deck')?.offsetHeight || 0,
            tickerDisplay: ticker ? getComputedStyle(ticker).display : 'none',
            dir: document.documentElement.dir
          };
        });

        assert.equal(m.overflowX, 0, `Zero horizontal overflow at ${sc.width}x${sc.height} (${sc.lang}/${sc.theme}/${tab})`);
        assert.ok(m.bannerH > 0, `Mission banner visible (${sc.lang}/${sc.theme}/${tab})`);
        assert.ok(m.deckH > 0, `RPG Empire deck visible (${sc.lang}/${sc.theme}/${tab})`);
        assert.equal(m.tickerDisplay, 'none', 'Dead "No events yet" ticker replaced cleanly');
        assert.equal(m.dir, sc.lang === 'ar' ? 'rtl' : 'ltr');
      }

      assert.equal(pageErrors.length, 0, 'Zero runtime page errors');
      await context.close();
    }
  } finally {
    await browser.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsPath = resolve(root, 'assets/ui/zone-casino-tables.js');
const cssPath = resolve(root, 'assets/ui/zone-casino-tables.css');
const jsSource = readFileSync(jsPath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');

function createDomHarness({ width = 390, lang = 'en', dir = 'ltr', theme = 'dark', reducedMotion = true } = {}) {
  const idMap = new Map();
  const winListeners = new Map();
  const docListeners = new Map();
  const stageActions = [];
  const audioCues = [];

  function makeCanvasCtx() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      ellipse() {},
      rect() {},
      roundRect() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      setLineDash() {},
      fillText() {}
    };
  }

  class MiniElement {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this.disabled = false;
      this.textContent = '';
      this._innerHTML = '';
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.clientWidth = width;
      this.clientHeight = this.tagName === 'CANVAS' ? 152 : 120;
      this.width = width;
      this.height = 152;
    }

    get nextElementSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx >= 0 && idx + 1 < this.parentElement.children.length ? this.parentElement.children[idx + 1] : null;
    }

    get firstElementChild() {
      return this.children[0] || null;
    }

    set innerHTML(val) {
      for (const ch of this.children) ch._unregisterRecursive();
      this.children = [];
      this.textContent = '';
      this._innerHTML = String(val || '');
      this._parseFragments(this._innerHTML);
    }

    get innerHTML() {
      return this._innerHTML;
    }

    _unregisterRecursive() {
      if (this.id && idMap.get(this.id) === this) idMap.delete(this.id);
      for (const ch of this.children) ch._unregisterRecursive();
    }

    _registerRecursive() {
      if (this.id) idMap.set(this.id, this);
      for (const ch of this.children) ch._registerRecursive();
    }

    _parseFragments(html) {
      const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'link', 'path', 'circle', 'rect']);
      const tokenRe = /<(\/?)([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
      const stack = [this];
      let m;
      while ((m = tokenRe.exec(html)) !== null) {
        if (m[4] !== undefined) {
          const txt = m[4];
          if (txt.trim() && stack.length > 0) stack[stack.length - 1].textContent += txt;
          continue;
        }
        const isClose = m[1] === '/';
        const tag = m[2].toLowerCase();
        const attrRaw = m[3] || '';
        if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect') continue;
        if (isClose) {
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].tagName.toLowerCase() === tag) {
              stack.length = i;
              break;
            }
          }
          continue;
        }
        const selfClosing = VOID_TAGS.has(tag) || /\/\s*$/.test(attrRaw);
        const el = new MiniElement(tag);
        const attrRe = /([a-zA-Z0-9_:-]+)(?:="([^"]*)")?/g;
        let am;
        while ((am = attrRe.exec(attrRaw)) !== null) {
          const k = am[1];
          const v = am[2] !== undefined ? am[2] : '';
          if (k === 'id') el.id = v;
          else if (k === 'class') el.className = v;
          else if (k === 'disabled') el.disabled = true;
          else el.attributes.set(k, v);
        }
        stack[stack.length - 1].appendChild(el);
        if (!selfClosing) stack.push(el);
      }
    }

    setAttribute(k, v) {
      const key = String(k);
      const val = String(v);
      if (key === 'id') {
        if (this.id && idMap.get(this.id) === this) idMap.delete(this.id);
        this.id = val;
        idMap.set(val, this);
      } else if (key === 'class') {
        this.className = val;
      } else {
        this.attributes.set(key, val);
      }
    }

    getAttribute(k) {
      if (k === 'id') return this.id || null;
      if (k === 'class') return this.className || null;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }

    hasAttribute(k) {
      return k === 'id' ? Boolean(this.id) : this.attributes.has(k);
    }

    appendChild(child) {
      if (child.parentElement) child.parentElement.removeChild(child);
      child.parentElement = this;
      this.children.push(child);
      child._registerRecursive();
      return child;
    }

    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parentElement = null;
        child._unregisterRecursive();
      }
      return child;
    }

    insertAdjacentElement(pos, el) {
      if (!this.parentElement) return el;
      const siblings = this.parentElement.children;
      const idx = siblings.indexOf(this);
      if (el.parentElement) el.parentElement.removeChild(el);
      el.parentElement = this.parentElement;
      if (pos === 'afterend') siblings.splice(idx + 1, 0, el);
      else siblings.splice(Math.max(0, idx), 0, el);
      el._registerRecursive();
      return el;
    }

    getContext(kind) {
      return this.tagName === 'CANVAS' && kind === '2d' ? makeCanvasCtx() : null;
    }

    _matchesSelector(sel) {
      const s = sel.trim();
      if (!s) return false;
      if (s.startsWith('#')) return this.id === s.slice(1);
      if (s.startsWith('.')) return this.className.split(/\s+/).includes(s.slice(1));
      const attrMatch = s.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
      if (attrMatch) {
        const val = this.getAttribute(attrMatch[1]);
        if (val === null) return false;
        return attrMatch[2] !== undefined ? val === attrMatch[2] : true;
      }
      const tagAttrMatch = s.match(/^([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)\*="([^"]*)"\]$/);
      if (tagAttrMatch) {
        if (this.tagName.toLowerCase() !== tagAttrMatch[1].toLowerCase()) return false;
        const av = this.getAttribute(tagAttrMatch[2]) || '';
        return av.includes(tagAttrMatch[3]);
      }
      return this.tagName.toLowerCase() === s.toLowerCase();
    }

    querySelector(sel) {
      for (const ch of this.children) {
        if (ch._matchesSelector(sel)) return ch;
        const found = ch.querySelector(sel);
        if (found) return found;
      }
      return null;
    }

    querySelectorAll(sel) {
      const out = [];
      for (const ch of this.children) {
        if (ch._matchesSelector(sel)) out.push(ch);
        out.push(...ch.querySelectorAll(sel));
      }
      return out;
    }

    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur._matchesSelector(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
  }

  const htmlEl = new MiniElement('html');
  htmlEl.dir = dir;
  htmlEl.lang = lang;
  htmlEl.setAttribute('data-theme', theme);
  htmlEl.dataset.zoneReducedMotion = reducedMotion ? 'true' : 'false';

  const headEl = new MiniElement('head');
  const bodyEl = new MiniElement('body');
  htmlEl.appendChild(headEl);
  htmlEl.appendChild(bodyEl);

  const zoneMain = new MiniElement('main');
  zoneMain.id = 'zone-main';
  zoneMain.setAttribute('data-zone-screen', 'home');
  bodyEl.appendChild(zoneMain);
  idMap.set('zone-main', zoneMain);

  const nativePit = new MiniElement('section');
  nativePit.setAttribute('data-zone-casino-pit', '1');
  zoneMain.appendChild(nativePit);

  const documentMock = {
    readyState: 'complete',
    documentElement: htmlEl,
    head: headEl,
    body: bodyEl,
    createElement(tag) {
      return new MiniElement(tag);
    },
    getElementById(id) {
      return idMap.get(id) || null;
    },
    querySelector(sel) {
      return htmlEl.querySelector(sel);
    },
    querySelectorAll(sel) {
      return htmlEl.querySelectorAll(sel);
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchClick(target) {
      const list = docListeners.get('click') || [];
      const ev = { target, preventDefault() {} };
      for (const fn of list) fn(ev);
    }
  };

  const windowMock = {
    document: documentMock,
    requestAnimationFrame: null,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      const list = winListeners.get(ev.type) || [];
      for (const fn of list) fn(ev);
    },
    ZoneEcs3D: {
      triggerStageAction(stage, action, payload) {
        stageActions.push({ stage, action, payload });
        return true;
      }
    },
    ZoneAudioHaptics: {
      play(cue, detail) {
        audioCues.push({ cue, detail });
        return true;
      }
    }
  };

  const context = {
    window: windowMock,
    document: documentMock,
    globalThis: null,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Date,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    setTimeout,
    clearTimeout
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(jsSource, context, { filename: 'zone-casino-tables.js' });

  return {
    window: windowMock,
    document: documentMock,
    htmlEl,
    zoneMain,
    nativePit,
    api: windowMock.ZoneCasinoTables,
    stageActions,
    audioCues
  };
}

test('1. Syntax check & CSS watercolor Light/Dark + RTL + 390px mobile parity', () => {
  assert.ok(existsSync(jsPath), 'assets/ui/zone-casino-tables.js must exist');
  assert.ok(existsSync(cssPath), 'assets/ui/zone-casino-tables.css must exist');

  execFileSync(process.execPath, ['--check', jsPath], { stdio: 'pipe' });

  assert.match(cssSource, /--zwc-surface/);
  assert.match(cssSource, /html\[data-theme="light"\]/);
  assert.match(cssSource, /html\[dir="rtl"\]/);
  assert.match(cssSource, /html:lang\(ar\)/);
  assert.match(cssSource, /@media\s*\(max-width:\s*680px\)/);
  assert.match(cssSource, /data-zone-reduced-motion="true"/);
  assert.match(cssSource, /overflow:\s*hidden/);
});

test('2. Route-scoped mount: 0 mounts on home/crimes/attack, mounts ONLY on casino, unmounts on leave', () => {
  const env = createDomHarness();
  assert.ok(env.api, 'window.ZoneCasinoTables must be exposed');

  // Default screen is 'home' -> 0 mounts
  assert.equal(env.api.render(), false);
  assert.equal(env.document.getElementById('zct-casino-pit'), null);

  for (const nonCasino of ['home', 'crimes', 'attack', 'city', 'gym']) {
    env.zoneMain.setAttribute('data-zone-screen', nonCasino);
    assert.equal(env.api.render(), false, `Must NOT mount on ${nonCasino}`);
    assert.equal(env.document.getElementById('zct-casino-pit'), null);
  }

  // Navigate to 'casino' -> mounts cleanly
  env.zoneMain.setAttribute('data-zone-screen', 'casino');
  assert.equal(env.api.render(), true);
  const pit = env.document.getElementById('zct-casino-pit');
  assert.ok(pit, '#zct-casino-pit must mount on casino screen');
  assert.ok(env.document.getElementById('zct-craps-canvas'), 'Craps 3D physics canvas must mount');
  assert.ok(env.document.getElementById('zct-craps-card'), 'Craps table card must mount');
  assert.ok(env.document.getElementById('zct-bj-card'), 'Blackjack EV card must mount');
  assert.ok(pit.querySelector('[data-zct-ev-hud="1"]'), 'Tactical EV HUD must mount');
  assert.ok(pit.querySelector('[data-zct-provably-fair="1"]'), 'Provably-Fair shoe inspector must mount');

  // Leave 'casino' -> 'home' -> clean unmount
  env.zoneMain.setAttribute('data-zone-screen', 'home');
  assert.equal(env.api.render(), false);
  assert.equal(env.document.getElementById('zct-casino-pit'), null);
});

test('3. Street Craps 3D rigid-body dice physics, 1.36%-1.41% house-edge math, 3D stage & audio sync', () => {
  const env = createDomHarness();
  env.zoneMain.setAttribute('data-zone-screen', 'casino');
  env.api.render();

  // Check economy-balancing house edge math
  const passOdds = env.api.computeCrapsOdds('pass_line');
  const dontPassOdds = env.api.computeCrapsOdds('dont_pass');
  assert.equal(passOdds.houseEdgePct, 1.41);
  assert.equal(dontPassOdds.houseEdgePct, 1.36);

  // Rigid-body dice physics impulse & bounce settling
  const bounds = { width: 320, height: 152 };
  const bodies = env.api.createDiceBodies(bounds, 1, 1);
  env.api.applyDiceThrowImpulse(bodies, bounds, 4, 3, () => 0.42);
  assert.equal(bodies[0].resting, false);
  assert.equal(bodies[1].resting, false);

  let bounces = 0;
  let settled = false;
  for (let i = 0; i < 320; i++) {
    settled = env.api.stepDicePhysics(bodies, 0.016, bounds, () => { bounces += 1; });
    if (settled) break;
  }
  assert.equal(settled, true, 'Both dice must settle cleanly within bounds');
  assert.ok(bounces >= 1, 'Dice physics must detect floor/wall/die bounces');
  assert.ok(bodies[0].x >= 22 && bodies[0].x <= bounds.width - 22);
  assert.ok(bodies[1].y >= 22 && bodies[1].y <= bounds.height - 22);

  // Pure Craps evaluation across all 4 wager types
  const passNat = env.api.evaluateCrapsRoll({ betId: 'pass_line', stake: 1000, point: null }, 4, 3);
  assert.equal(passNat.outcome, 'win');
  assert.equal(passNat.payout, 2000);

  const pointSet = env.api.evaluateCrapsRoll({ betId: 'pass_line', stake: 1000, point: null }, 4, 2);
  assert.equal(pointSet.outcome, 'point_set');
  assert.equal(pointSet.nextPoint, 6);

  const sevenOut = env.api.evaluateCrapsRoll({ betId: 'pass_line', stake: 1000, point: 6 }, 5, 2);
  assert.equal(sevenOut.outcome, 'lose');
  assert.equal(sevenOut.nextPoint, null);

  const bar12 = env.api.evaluateCrapsRoll({ betId: 'dont_pass', stake: 1000, point: null }, 6, 6);
  assert.equal(bar12.outcome, 'push');
  assert.equal(bar12.payout, 1000);

  const field12 = env.api.evaluateCrapsRoll({ betId: 'field', stake: 1000 }, 6, 6);
  assert.equal(field12.outcome, 'win');
  assert.equal(field12.payout, 4000);
  assert.equal(field12.bigWin, true);

  const hard6Win = env.api.evaluateCrapsRoll({ betId: 'hardways', hardTarget: 6, stake: 1000 }, 3, 3);
  assert.equal(hard6Win.outcome, 'win');
  assert.equal(hard6Win.payout, 10000);

  const hard6EasyLose = env.api.evaluateCrapsRoll({ betId: 'hardways', hardTarget: 6, stake: 1000 }, 4, 2);
  assert.equal(hard6EasyLose.outcome, 'lose');

  // Live shoot syncs ZoneEcs3D('casino-royale', 'spin') and ZoneAudioHaptics
  env.api.setCrapsBet('hardways', 6);
  const rollRes = env.api.shootCrapsDice([3, 3]);
  assert.equal(rollRes.ok, true);
  assert.equal(rollRes.result.outcome, 'win');
  assert.ok(env.stageActions.some(a => a.stage === 'casino-royale' && a.action === 'spin'));
  assert.ok(env.audioCues.some(c => c.cue === 'roulette_tick'));
  assert.ok(env.audioCues.some(c => c.cue === 'jackpot_fanfare'));
});

test('4. Syndicate Blackjack EV/Strategy Solver, Provably-Fair Shoe & Streak Protection Guard', () => {
  const env = createDomHarness();
  env.zoneMain.setAttribute('data-zone-screen', 'casino');
  env.api.render();

  // Exact analytical EV checks
  const ev20v6 = env.api.computeBlackjackEV([{ rank: 'K', val: 10 }, { rank: 'Q', val: 10 }], { rank: '6', val: 6 }, true);
  assert.equal(ev20v6.optimalAction, 'stand');
  assert.ok(ev20v6.standEV > ev20v6.hitEV);

  const ev11v6 = env.api.computeBlackjackEV([{ rank: '6', val: 6 }, { rank: '5', val: 5 }], { rank: '6', val: 6 }, true);
  assert.equal(ev11v6.optimalAction, 'double');
  assert.ok(ev11v6.doubleEV > ev11v6.hitEV);

  const ev12v10 = env.api.computeBlackjackEV([{ rank: '7', val: 7 }, { rank: '5', val: 5 }], { rank: '10', val: 10 }, true);
  assert.equal(ev12v10.optimalAction, 'hit');
  assert.ok(ev12v10.hitEV > ev12v10.standEV);

  // Deal & play a live hand from the provably-fair shoe
  const beforeNonce = env.api.getState().bj.fair.nonce;
  const beforeHash = env.api.getState().bj.fair.serverSeedHash;
  const dealRes = env.api.blackjackAction('deal');
  assert.equal(dealRes.ok, true);
  assert.equal(env.api.getState().bj.fair.nonce, beforeNonce + 1);
  assert.notEqual(env.api.getState().bj.fair.serverSeedHash, beforeHash);

  if (env.api.getState().bj.status === 'playing') {
    const standRes = env.api.blackjackAction('stand');
    assert.equal(standRes.ok, true);
    assert.equal(env.api.getState().bj.status, 'settled');
  }

  // Trigger Streak Protection Guard via 3 consecutive Craps Field losses (roll 7)
  env.api.setCrapsBet('field');
  env.api.shootCrapsDice([3, 4]);
  env.api.shootCrapsDice([4, 3]);
  env.api.shootCrapsDice([5, 2]);
  const st = env.api.getState();
  assert.ok(st.streakGuard.lossStreak >= 3);
  assert.equal(st.streakGuard.triggered, true);

  const pit = env.document.getElementById('zct-casino-pit');
  assert.ok(pit.querySelector('[data-zct-streak-guard="1"]'), 'Streak Protection Guard banner must render');

  env.api.resetStreakGuard();
  assert.equal(env.api.getState().streakGuard.triggered, false);
  assert.equal(env.api.getState().craps.stake, 500);
  assert.equal(env.api.getState().bj.stake, 500);
});

test('5. Bilingual EN + AR RTL parity and <bdi> numeric isolation at 390px viewport', () => {
  const env = createDomHarness({ width: 390, lang: 'ar', dir: 'rtl' });
  env.zoneMain.setAttribute('data-zone-screen', 'casino');
  env.api.render();

  const pit = env.document.getElementById('zct-casino-pit');
  assert.ok(pit, 'Casino pit must render in AR RTL 390px mode');
  assert.match(pit.innerHTML, /قاعة كبار الشخصيات/);
  assert.match(pit.innerHTML, /كرابس الشوارع/);
  assert.match(pit.innerHTML, /بلاك جاك النقابة/);
  assert.match(pit.innerHTML, /<bdi>/);
});

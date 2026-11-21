import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arcadeJsPath = resolve(root, 'assets/ui/zone-instant-games.js');
const arcadeSource = readFileSync(arcadeJsPath, 'utf8');

function loadHeadlessEngine() {
  const ctx = {
    globalThis: {},
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Date
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(arcadeSource, ctx, { filename: 'zone-instant-games.js' });
  assert.ok(ctx.__ZoneArcadeFeel155, 'Expected globalThis.__ZoneArcadeFeel155 to register cleanly in headless Node');
  return ctx.__ZoneArcadeFeel155;
}

/* Lightweight zero-dependency DOM harness to run full zone-instant-games.js mount, 390px touch zones, RTL & 3D/Audio bridge */
function createLightweightDomHarness({ width = 390, height = 844, lang = 'en', dir = 'ltr', reducedMotion = false } = {}) {
  const idMap = new Map();
  const winListeners = new Map();
  const docListeners = new Map();

  function makeCanvasCtx() {
    return {
      canvas: { clientWidth: width, clientHeight: 168 },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: 'left',
      lineDashOffset: 0,
      setTransform() {},
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      rect() {},
      clip() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      setLineDash() {},
      fillText() {},
      strokeText() {},
      drawImage() {},
      bezierCurveTo() {},
      quadraticCurveTo() {},
      measureText(txt) {
        return { width: String(txt || '').length * 6.5 };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      createRadialGradient() {
        return { addColorStop() {} };
      }
    };
  }

  class MiniElement {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this.hidden = false;
      this.disabled = false;
      this.textContent = '';
      this._innerHTML = '';
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.listeners = new Map();
      this.clientWidth = width;
      this.clientHeight = this.tagName === 'CANVAS' ? 168 : 120;
      this.width = width;
      this.height = 168;
      const self = this;
      this.classList = {
        add(...cls) {
          const set = new Set(self.className.split(/\s+/).filter(Boolean));
          for (const c of cls) set.add(c);
          self.className = [...set].join(' ');
        },
        remove(...cls) {
          const set = new Set(self.className.split(/\s+/).filter(Boolean));
          for (const c of cls) set.delete(c);
          self.className = [...set].join(' ');
        },
        contains(c) {
          return self.className.split(/\s+/).includes(c);
        }
      };
    }

    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur.tagName === 'BODY' || cur.tagName === 'HTML') return true;
        cur = cur.parentElement;
      }
      return false;
    }

    get nextElementSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx >= 0 && idx + 1 < this.parentElement.children.length ? this.parentElement.children[idx + 1] : null;
    }

    get previousElementSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx > 0 ? this.parentElement.children[idx - 1] : null;
    }

    get firstElementChild() {
      return this.children[0] || null;
    }

    get firstChild() {
      return this.children[0] || null;
    }

    set innerHTML(val) {
      for (const ch of this.children) ch._unregisterRecursive();
      this.children = [];
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
      const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'path', 'circle', 'rect', 'stop', 'ellipse']);
      const tokenRe = /<(\/?)([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
      const stack = [this];
      let m;
      while ((m = tokenRe.exec(html)) !== null) {
        if (m[4] !== undefined) {
          const txt = m[4];
          if (txt.trim() && stack.length > 0) {
            stack[stack.length - 1].textContent += txt;
          }
          continue;
        }
        const isClose = m[1] === '/';
        const tag = m[2].toLowerCase();
        const attrRaw = m[3] || '';
        if (tag === 'svg' || tag === 'defs' || tag === 'lineargradient' || tag === 'radialgradient' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'stop' || tag === 'ellipse') {
          continue;
        }
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
          if (k === '/') continue;
          const v = am[2] !== undefined ? am[2] : '';
          if (k === 'id') el.id = v;
          else if (k === 'class') el.className = v;
          else if (k === 'hidden') el.hidden = true;
          else el.setAttribute(k, v);
        }
        const parent = stack[stack.length - 1];
        el.parentElement = parent;
        parent.children.push(el);
        if (this.isConnected) el._registerRecursive();
        if (!selfClosing) stack.push(el);
      }
    }

    setAttribute(k, v) {
      const sv = String(v);
      this.attributes.set(k, sv);
      if (k === 'id') {
        this.id = sv;
        if (this.isConnected) idMap.set(sv, this);
      } else if (k === 'class') {
        this.className = sv;
      } else if (k === 'lang') {
        this.lang = sv;
      } else if (k === 'dir') {
        this.dir = sv;
      } else if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = sv;
      }
      if (this._observers) {
        for (const obs of this._observers) {
          obs.cb([{ type: 'attributes', attributeName: k, target: this }]);
        }
      }
    }

    getAttribute(k) {
      if (k === 'id') return this.id || null;
      if (k === 'class') return this.className || null;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }

    hasAttribute(k) {
      return this.attributes.has(k);
    }

    removeAttribute(k) {
      this.attributes.delete(k);
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        delete this.dataset[camel];
      }
    }

    appendChild(child) {
      if (child.parentElement) child.remove();
      child.parentElement = this;
      this.children.push(child);
      if (this.isConnected) child._registerRecursive();
      return child;
    }

    prepend(child) {
      if (child.parentElement) child.remove();
      child.parentElement = this;
      this.children.unshift(child);
      if (this.isConnected) child._registerRecursive();
      return child;
    }

    insertBefore(child, refNode) {
      if (!refNode) return this.appendChild(child);
      if (child.parentElement) child.remove();
      const idx = this.children.indexOf(refNode);
      child.parentElement = this;
      if (idx >= 0) this.children.splice(idx, 0, child);
      else this.children.push(child);
      if (this.isConnected) child._registerRecursive();
      return child;
    }

    insertAdjacentElement(pos, el) {
      if (!this.parentElement) return null;
      if (el.parentElement) el.remove();
      const siblings = this.parentElement.children;
      const idx = siblings.indexOf(this);
      el.parentElement = this.parentElement;
      if (pos === 'beforebegin') {
        siblings.splice(Math.max(0, idx), 0, el);
      } else if (pos === 'afterend') {
        siblings.splice(idx + 1, 0, el);
      } else {
        this.appendChild(el);
      }
      if (this.parentElement.isConnected) el._registerRecursive();
      return el;
    }

    remove() {
      if (!this.parentElement) return;
      const idx = this.parentElement.children.indexOf(this);
      if (idx >= 0) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
      this._unregisterRecursive();
    }

    matches(selector) {
      const sel = selector.trim();
      if (!sel) return false;
      if (sel === '[hidden]') return Boolean(this.hidden);
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
      const attrMatch = sel.match(/^([a-z0-9_-]*)\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/i);
      if (attrMatch) {
        const [, tagPart, attrName, attrVal] = attrMatch;
        if (tagPart && this.tagName !== tagPart.toUpperCase()) return false;
        if (attrVal !== undefined) return this.getAttribute(attrName) === attrVal;
        return this.hasAttribute(attrName);
      }
      return this.tagName === sel.toUpperCase();
    }

    closest(selector) {
      const parts = selector.split(',').map((s) => s.trim());
      let cur = this;
      while (cur) {
        if (parts.some((p) => cur.matches(p))) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    querySelectorAll(selector) {
      const out = [];
      const parts = selector.split(/\s+/).filter(Boolean);
      const lastSel = parts[parts.length - 1];
      const walk = (node) => {
        for (const ch of node.children) {
          if (ch.matches(lastSel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    getContext() {
      if (!this._ctx) this._ctx = makeCanvasCtx();
      return this._ctx;
    }

    getBoundingClientRect() {
      return { left: 0, top: 64, right: width, bottom: 232, width, height: this.clientHeight || 168 };
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }

    dispatchEvent(ev) {
      const list = this.listeners.get(ev.type) || [];
      for (const fn of list) fn.call(this, ev);
      return true;
    }

    click() {
      this.dispatchEvent({ type: 'click', target: this, preventDefault() {} });
    }
  }

  const htmlEl = new MiniElement('html');
  htmlEl.lang = lang;
  htmlEl.dir = dir;
  htmlEl.clientWidth = width;
  if (reducedMotion) htmlEl.dataset.zoneReducedMotion = 'true';

  const headEl = new MiniElement('head');
  const bodyEl = new MiniElement('body');
  htmlEl.appendChild(headEl);
  htmlEl.appendChild(bodyEl);

  const mainEl = new MiniElement('main');
  mainEl.setAttribute('id', 'zone-main');
  mainEl.setAttribute('data-zone-screen', 'home');
  bodyEl.appendChild(mainEl);

  const briefEl = new MiniElement('section');
  briefEl.className = 'zone-home-brief';
  mainEl.appendChild(briefEl);

  const ascensionHub = new MiniElement('section');
  ascensionHub.setAttribute('id', 'zone-ascension-hub');
  mainEl.appendChild(ascensionHub);

  const char3d = new MiniElement('div');
  char3d.setAttribute('id', 'zone-char-3d');
  mainEl.appendChild(char3d);

  const stageActions = [];
  const audioCues = [];
  const hapticsPlayed = [];
  let nowVal = 1000;
  const storage = new Map();

  class CustomEventPolyfill {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || null;
    }
  }

  class MutationObserverPolyfill {
    constructor(cb) {
      this.cb = cb;
      this.targets = [];
    }
    observe(target) {
      if (!target._observers) target._observers = [];
      target._observers.push(this);
      this.targets.push(target);
    }
    disconnect() {
      for (const t of this.targets) {
        if (t._observers) t._observers = t._observers.filter((o) => o !== this);
      }
      this.targets = [];
    }
  }

  const document = {
    readyState: 'complete',
    hidden: false,
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
      if (sel.startsWith('#') && !sel.includes(' ')) return idMap.get(sel.slice(1)) || null;
      return htmlEl.querySelector(sel);
    },
    querySelectorAll(sel) {
      return htmlEl.querySelectorAll(sel);
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };

  const window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 2,
    location: { origin: 'http://127.0.0.1', search: '' },
    document,
    CustomEvent: CustomEventPolyfill,
    performance: { now: () => nowVal },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v))
    },
    ZoneEcs3D: {
      triggerStageAction(stage, action, payload) {
        stageActions.push({ stage, action, payload });
      },
      scan() {}
    },
    ZoneAudioHaptics: {
      play(cue, detail) {
        hapticsPlayed.push({ cue, detail });
      }
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      if (ev && ev.type === 'zone:audio-cue') audioCues.push(ev.detail);
      const list = winListeners.get(ev.type) || [];
      for (const fn of list) fn.call(window, ev);
      return true;
    },
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout(fn) {
      return { fn };
    },
    clearTimeout() {}
  };

  const sandbox = {
    window,
    document,
    globalThis: null,
    localStorage: window.localStorage,
    performance: window.performance,
    CustomEvent: CustomEventPolyfill,
    MutationObserver: MutationObserverPolyfill,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    WeakSet,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Date
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(arcadeSource, sandbox, { filename: 'zone-instant-games.js' });

  return {
    window,
    document,
    mainEl,
    briefEl,
    ascensionHub,
    char3d,
    stageActions,
    audioCues,
    hapticsPlayed,
    MiniElement,
    advanceNow(ms) {
      nowVal += ms;
      return nowVal;
    }
  };
}

test('v155 Gate 1: Syntax check & pure headless engine registration', () => {
  execFileSync(process.execPath, ['--check', arcadeJsPath], { stdio: 'pipe' });
  const eng = loadHeadlessEngine();
  assert.equal(eng.CONSTANTS.INPUT_BUFFER_MS, 80);
  assert.equal(eng.CONSTANTS.COYOTE_GRACE_MS, 55);
  assert.equal(eng.CONSTANTS.HITSTOP_CRIT_MS, 35);
  assert.equal(eng.CONSTANTS.HITSTOP_VAULT_MS, 55);
});

test('v155 Gate 2: 80ms Input Buffer & 55ms Coyote Grace Window math (Heavy Bag + Alley Heist)', () => {
  const eng = loadHeadlessEngine();
  const buf = eng.createActionBuffer(0.080);
  const coyote = eng.createCoyoteTracker(0.055);

  /* Buffered press within 80ms fires once, then clears */
  buf.press('strike_bag', 1.000, { src: 'touch' });
  assert.equal(buf.has('strike_bag', 1.065), true, '65ms early press stays inside 80ms buffer');
  const consumed = buf.consume('strike_bag', 1.065);
  assert.ok(consumed && consumed.accepted, 'Buffered press consumed cleanly at +65ms');
  assert.equal(buf.consume('strike_bag', 1.070), null, 'Consumed press never double-fires');

  /* Press older than 80ms expires cleanly */
  buf.press('crack_vault', 2.000, { src: 'space' });
  assert.equal(buf.has('crack_vault', 2.095), false, '95ms press exceeds 80ms buffer window');
  assert.equal(buf.consume('crack_vault', 2.095), null);

  /* Heavy Bag pre-window (approaching 0.36 at 1.15/s: at 0.29 -> (0.36 - 0.29)/1.15 = 60.8ms <= 80ms) */
  const gymEarly = eng.evaluateGymWindow(0.29, 1, 1.15, 3.0, coyote);
  assert.equal(gymEarly.inSweetSpot, false);
  assert.equal(gymEarly.shouldBuffer, true, `Expected 60.8ms pre-sweet-spot tap to buffer (got ${gymEarly.timeToSweetMs.toFixed(1)}ms)`);

  const gymTooEarly = eng.evaluateGymWindow(0.18, 1, 1.15, 3.0, coyote);
  assert.equal(gymTooEarly.shouldBuffer, false, 'Tap >150ms before sweet-spot should NOT buffer');

  /* Coyote 55ms trailing grace edge */
  coyote.markLegal('gym_sweet', 4.000, { bullseye: true });
  const gymCoyoteOk = eng.evaluateGymWindow(0.66, 1, 1.15, 4.042, coyote);
  assert.equal(gymCoyoteOk.coyoteSaved, true, 'Tap 42ms after leaving sweet-spot is saved by 55ms coyote grace');
  const gymCoyoteLate = eng.evaluateGymWindow(0.69, 1, 1.15, 4.072, coyote);
  assert.equal(gymCoyoteLate.coyoteSaved, false, 'Tap 72ms after leaving sweet-spot exceeds 55ms coyote grace');

  /* Alley Heist 80ms pre-window & 55ms coyote grace */
  const heistEarly = eng.evaluateHeistWindow(0.56, 1, 2.55, 1.10, 0.78, 5.0, coyote);
  /* Leading edge is 1.10 - 0.39 = 0.71 rad; dist = 0.15 rad; 0.15 / 2.55 = 58.8ms <= 80ms */
  assert.equal(heistEarly.inArc, false);
  assert.equal(heistEarly.shouldBuffer, true, `Expected 58.8ms pre-arc tap to buffer (got ${heistEarly.timeToArcMs.toFixed(1)}ms)`);

  coyote.markLegal('heist_arc', 6.000, { perfect: false });
  const heistCoyote = eng.evaluateHeistWindow(1.56, 1, 2.55, 1.10, 0.78, 6.048, coyote);
  assert.equal(heistCoyote.coyoteSaved, true, 'Vault tap 48ms after gold arc exit saved by 55ms coyote grace');
});

test('v155 Gate 3: Overlapping Hit-Stop (35ms / 55ms), trauma^2 Camera Decay, Frame-Rate-Independent Smoothing & Reduced-Motion Clamp', () => {
  const eng = loadHeadlessEngine();
  const juice = eng.createJuiceRig();

  /* Overlapping hit-stops: 35ms crit at t=100ms, then 55ms vault crack 20ms later at t=120ms -> stays slowed until t=175ms! */
  juice.triggerHitStop(35, 100, 0.05, false);
  assert.equal(juice.timeScale, 0.05);
  juice.stepReal(0.020, 120, false);
  assert.equal(juice.timeScale, 0.05, 'Still inside first 35ms hit-stop at t=120ms');

  juice.triggerHitStop(55, 120, 0.05, false);
  juice.stepReal(0.020, 140, false);
  assert.equal(juice.timeScale, 0.05, 'Overlapping 55ms hit-stop prevents first 35ms timer (t=135ms) from restoring timeScale early!');
  juice.stepReal(0.040, 180, false);
  assert.equal(juice.timeScale, 1, 'TimeScale cleanly restores to 1.0 after t=175ms in unscaled real time');

  /* Squirrel Eiserloh trauma^2 scaling & full decay to exact 0 */
  juice.addTrauma(0.5, 1, -0.5, false);
  assert.equal(juice.trauma, 0.5);
  assert.ok(Math.abs(juice.offsetX) > 0, 'Active trauma produces directional camera kick');
  for (let i = 0; i < 45; i++) {
    juice.stepReal(0.02, 200 + i * 20, false);
  }
  assert.equal(juice.trauma, 0, 'Trauma decays completely to 0 in real time');
  assert.equal(juice.offsetX, 0, 'Camera offsetX snaps cleanly to rest (0)');
  assert.equal(juice.offsetY, 0, 'Camera offsetY snaps cleanly to rest (0)');
  assert.equal(juice.rotation, 0, 'Camera rotation snaps cleanly to rest (0)');

  /* Reduced motion clamp */
  juice.addTrauma(0.9, 1, 1, true);
  assert.equal(juice.trauma, 0, 'reducedMotion=true clamps trauma to 0 on addTrauma');
  assert.equal(juice.offsetX, 0);
  juice.addTrauma(0.8, 1, 1, false);
  juice.stepReal(0.016, 1200, true);
  assert.equal(juice.trauma, 0, 'Toggling reducedMotion mid-shake zeroes trauma & offsets immediately');
  assert.equal(juice.offsetX, 0);

  /* Frame-rate-independent exponential smoothing check (30fps vs 120fps over 0.5s) */
  let pos30 = 0;
  for (let i = 0; i < 15; i++) pos30 = eng.expSmooth(pos30, 100, 10, 1 / 30);
  let pos120 = 0;
  for (let i = 0; i < 60; i++) pos120 = eng.expSmooth(pos120, 100, 10, 1 / 120);
  assert.ok(Math.abs(pos30 - pos120) < 0.01, `expSmooth is frame-rate independent (30fps=${pos30.toFixed(4)} vs 120fps=${pos120.toFixed(4)})`);
});

test('v155 Gate 4: Combo Fever Progression (x2 CHAIN, x4 SYNDICATE RUSH, x8 OVERDRIVE) & Near-Miss Graze Math', () => {
  const eng = loadHeadlessEngine();

  const f1 = eng.getFeverTier(1, false);
  const f2 = eng.getFeverTier(2, false);
  const f4 = eng.getFeverTier(4, false);
  const f8 = eng.getFeverTier(8, false);
  assert.equal(f1.mult, 1);
  assert.equal(f2.labelEn, 'x2 CHAIN');
  assert.equal(f2.mult, 2);
  assert.equal(f4.labelEn, 'x4 SYNDICATE RUSH');
  assert.equal(f4.mult, 4);
  assert.equal(f8.labelEn, 'x8 OVERDRIVE');
  assert.equal(f8.mult, 8);

  const f8Ar = eng.getFeverTier(9, true);
  assert.match(f8Ar.label, /أوفردرايف/);

  /* Street Drift cruiser graze: adjacent lane passes within [0.52*laneW, 1.18*laneW] without colliding, once per cruiser */
  const cruiser = { kind: 'police', lane: 2, y: 180, grazed: false };
  const laneW = 80;
  const roadLeft = 35;
  const playerX = roadLeft + 1.5 * laneW; /* lane 1 -> dx = 80 = 1.0 * laneW */
  const g1 = eng.checkDriftGraze(cruiser, roadLeft, laneW, playerX, 184);
  assert.ok(g1 && g1.grazed, 'Adjacent-lane cruiser triggers +GRAZE! bonus');
  const g1Repeat = eng.checkDriftGraze(cruiser, roadLeft, laneW, playerX, 186);
  assert.equal(g1Repeat, null, 'Same cruiser cannot award +GRAZE! twice');

  /* Direct collision must NOT register as graze */
  const collidingCruiser = { kind: 'police', lane: 1, y: 182, grazed: false };
  assert.equal(eng.checkDriftGraze(collidingCruiser, roadLeft, laneW, playerX, 184), null);

  /* Smuggler Jet radar ring skim graze */
  const radarRing = { kind: 'radar', x: 78, yFrac: 0.5, grazed: false };
  const jetGraze = eng.checkJetGraze(radarRing, 64, 128, 200); /* radar ey = 100 -> dx=14, dy=28 (not colliding since dy>=22), dist=31.3 <= 48 */
  assert.ok(jetGraze && jetGraze.grazed, 'Skimming radar ring outside lock core triggers +GRAZE!');
  assert.equal(eng.checkJetGraze(radarRing, 64, 128, 200), null, 'Radar ring graze fires once');
});

test('v155 Gate 5: Home #1 Placement Invariant, 390px Touch Controls, Live 3D + Audio Bridge & Bilingual EN/AR RTL Parity', () => {
  const dom = createLightweightDomHarness({ width: 390, height: 844, lang: 'en', dir: 'ltr' });
  const arcade = dom.document.getElementById('zig-home-arcade');
  assert.ok(arcade, '#zig-home-arcade mounted on Home');

  /* Verify #zig-home-arcade is #1 immediately after .zone-home-brief, strictly ABOVE #zone-ascension-hub and #zone-char-3d */
  const order = dom.mainEl.children.map((el) => el.id || el.className);
  const idxBrief = order.indexOf('zone-home-brief');
  const idxArcade = order.indexOf('zig-home-arcade');
  const idxHub = order.indexOf('zone-ascension-hub');
  const idxChar3d = order.indexOf('zone-char-3d');
  assert.equal(idxArcade, idxBrief + 1, `#zig-home-arcade must sit immediately after .zone-home-brief (order: ${order.join(' -> ')})`);
  assert.ok(idxArcade < idxHub, '#zig-home-arcade sits strictly above #zone-ascension-hub');
  assert.ok(idxArcade < idxChar3d, '#zig-home-arcade sits strictly above #zone-char-3d');

  /* Simulate another script inserting a banner before #zig-home-arcade and firing zone:ascension-updated -> #zig-home-arcade reclaims #1 */
  const intruder = new dom.MiniElement('div');
  intruder.setAttribute('id', 'temp-intruder');
  dom.briefEl.insertAdjacentElement('afterend', intruder);
  dom.window.dispatchEvent(new dom.window.CustomEvent('zone:ascension-updated'));
  assert.equal(dom.briefEl.nextElementSibling, arcade, '#zig-home-arcade automatically reclaims #1 slot after .zone-home-brief');

  /* Verify all 4 watercolor card arts & touch-action: none CSS rule */
  const cards = arcade.querySelectorAll('[data-zig-launch]');
  assert.equal(cards.length, 4, 'All 4 Syndicate Arcade cards preserved');
  const motionCss = dom.document.getElementById('zig-v155-motion-styles')?.textContent || '';
  assert.match(motionCss, /#zig-gym-canvas,#zig-heist-canvas,#zig-getaway-canvas\{[^}]*touch-action:none !important/, 'Active game canvases enforce touch-action: none');

  /* Launch Street Drift at 390px -> verify touch deck & swipe / thumb zone lane steer + Live 3D & Audio Bridge */
  const stats = dom.window.__zoneInstantGamesStats;
  stats.startRun('getaway');
  const touchDeck = dom.document.getElementById('zig-touch-controls');
  assert.ok(touchDeck, '390px ergonomic #zig-touch-controls mounted inside #zig-getaway-stage');
  assert.equal(touchDeck.getAttribute('data-zig-force-touch'), '1', '390px viewport enables touch controls');
  const leftBtn = touchDeck.querySelector('[data-zig-touch="left"]');
  const actionBtn = touchDeck.querySelector('[data-zig-touch="action"]');
  const rightBtn = touchDeck.querySelector('[data-zig-touch="right"]');
  assert.ok(leftBtn && actionBtn && rightBtn, 'Left, Action, and Right thumb zones mounted');

  const laneBefore = stats.getArcadeState().getaway.targetLane;
  rightBtn.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', preventDefault() {} });
  rightBtn.dispatchEvent({ type: 'pointerup', pointerType: 'touch', preventDefault() {} });
  assert.ok(stats.getArcadeState().getaway.targetLane > laneBefore, '390px right thumb zone steers lane cleanly');

  /* Verify horizontal touch swipe on #zig-getaway-canvas shifts lanes without page scroll */
  const gCanvas = dom.document.getElementById('zig-getaway-canvas');
  stats.getArcadeState().getaway.targetLane = 2;
  gCanvas.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', clientX: 220, clientY: 140, preventDefault() {} });
  gCanvas.dispatchEvent({ type: 'pointermove', pointerType: 'touch', clientX: 160, clientY: 142, preventDefault() {} });
  gCanvas.dispatchEvent({ type: 'pointerup', pointerType: 'touch', clientX: 160, clientY: 142, preventDefault() {} });
  assert.equal(stats.getArcadeState().getaway.targetLane, 1, 'Horizontal swipe left (-60px) shifts Street Drift lane from 2 -> 1');

  /* Launch Heavy Bag & land an Overdrive Sweet-Spot hit -> verify ZoneEcs3D pulse + zone:audio-cue + ZoneAudioHaptics.play */
  stats.startRun('gym');
  stats.getArcadeState().gym.gaugePos = 0.5; /* exact sweet-spot center */
  const gymRes = stats.requestGymAction('touch');
  assert.equal(gymRes.status, 'overdrive');
  assert.ok(stats.getArcadeState().juice.trauma > 0, 'Overdrive hit applies camera trauma when reducedMotion is false');

  /* Toggle data-zone-reduced-motion="true" live on <html> -> MutationObserver zeroes trauma immediately */
  dom.document.documentElement.setAttribute('data-zone-reduced-motion', 'true');
  assert.equal(stats.getArcadeState().juice.trauma, 0, 'Live data-zone-reduced-motion="true" toggle zeroes camera trauma immediately');
  assert.ok(
    dom.stageActions.some((a) => a.stage === 'safehouse-empire' && a.action === 'pulse' && a.payload.game === 'gym'),
    'Dispatched ZoneEcs3D.triggerStageAction("safehouse-empire", "pulse", { game: "gym", ... })'
  );
  assert.ok(
    dom.audioCues.some((c) => c.cue === 'heavy_bag_impact' && c.combo >= 1),
    'Dispatched CustomEvent("zone:audio-cue") with heavy_bag_impact'
  );
  assert.ok(
    dom.hapticsPlayed.some((h) => h.cue === 'heavy_bag_impact'),
    'Invoked window.ZoneAudioHaptics.play("heavy_bag_impact", ...)'
  );

  /* Verify Arabic RTL Parity across touch hints, stage bar & fever labels */
  const arDom = createLightweightDomHarness({ width: 390, height: 844, lang: 'ar', dir: 'rtl' });
  const arStats = arDom.window.__zoneInstantGamesStats;
  arStats.startRun('getaway');
  const arDeck = arDom.document.getElementById('zig-touch-controls');
  const arHint = arDom.document.getElementById('zig-touch-hint');
  assert.match(arDeck.querySelector('[data-zig-touch="action"]').textContent, /نيترو/, 'Arabic RTL Nitro touch zone label rendered');
  assert.match(arHint.textContent, /اسحب/, 'Arabic RTL swipe hint rendered');
  arStats.startRun('heist');
  assert.match(arDeck.querySelector('[data-zig-touch="action"]').textContent, /اكسر القفل/, 'Arabic RTL Crack Vault touch zone label rendered');

  const i18n = arDom.window.ZoneArcadeFeel.I18N;
  for (const key of Object.keys(i18n.en)) {
    assert.ok(i18n.ar[key] && i18n.ar[key] !== i18n.en[key], `Bilingual EN/AR parity verified for key "${key}"`);
  }
});

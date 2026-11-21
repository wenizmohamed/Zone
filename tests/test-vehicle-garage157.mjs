import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsPath = resolve(root, 'assets/ui/zone-vehicle-garage.js');
const cssPath = resolve(root, 'assets/ui/zone-vehicle-garage.css');
const jsSource = readFileSync(jsPath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');

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
  vm.runInContext(jsSource, ctx, { filename: 'zone-vehicle-garage.js' });
  assert.ok(ctx.__ZoneVehicleGarage157, 'Expected __ZoneVehicleGarage157 to register in headless VM');
  return ctx.__ZoneVehicleGarage157;
}

function createDomHarness({ screen = 'city', lang = 'en', dir = 'ltr', theme = 'light', reducedMotion = false } = {}) {
  const idMap = new Map();
  const winListeners = new Map();
  const docListeners = new Map();

  class MiniElement {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this.hidden = false;
      this.disabled = false;
      this.value = '';
      this.textContent = '';
      this._innerHTML = '';
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.listeners = new Map();
    }

    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === doc.documentElement) return true;
        cur = cur.parentElement;
      }
      return false;
    }

    setAttribute(k, v) {
      const val = String(v);
      this.attributes.set(k, val);
      if (k === 'id') {
        if (this.id) idMap.delete(this.id);
        this.id = val;
        if (val) idMap.set(val, this);
      } else if (k === 'class') {
        this.className = val;
      } else if (k === 'data-zone-reduced-motion') {
        this.dataset.zoneReducedMotion = val;
      }
    }

    getAttribute(k) {
      if (k === 'id') return this.id || null;
      if (k === 'class') return this.className || null;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }

    removeAttribute(k) {
      this.attributes.delete(k);
    }

    hasAttribute(k) {
      return this.attributes.has(k);
    }

    appendChild(child) {
      if (!child) return child;
      if (child.parentElement) child.parentElement.removeChild(child);
      child.parentElement = this;
      this.children.push(child);
      if (child.id) idMap.set(child.id, child);
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

    insertAdjacentElement(pos, el) {
      if (!this.parentElement || !el) return null;
      if (el.parentElement) el.parentElement.removeChild(el);
      const siblings = this.parentElement.children;
      const idx = siblings.indexOf(this);
      if (idx < 0) return null;
      el.parentElement = this.parentElement;
      siblings.splice(pos === 'afterend' ? idx + 1 : idx, 0, el);
      if (el.id) idMap.set(el.id, el);
      return el;
    }

    get nextElementSibling() {
      if (!this.parentElement) return null;
      const s = this.parentElement.children;
      const idx = s.indexOf(this);
      return idx >= 0 && idx + 1 < s.length ? s[idx + 1] : null;
    }

    get firstElementChild() {
      return this.children[0] || null;
    }

    replaceWith(other) {
      if (!this.parentElement || !other) return;
      const siblings = this.parentElement.children;
      const idx = siblings.indexOf(this);
      if (idx >= 0) {
        if (other.parentElement) other.parentElement.removeChild(other);
        other.parentElement = this.parentElement;
        siblings[idx] = other;
        this.parentElement = null;
      }
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

    dispatchEvent(ev) {
      const event = ev || { type: 'click' };
      if (!event.target) event.target = this;
      for (const fn of (this.listeners.get(event.type) || [])) fn(event);
      for (const fn of (docListeners.get(event.type) || [])) fn(event);
    }

    matches(selector) {
      const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
      return parts.some((sel) => {
        if (sel.startsWith('#')) return this.id === sel.slice(1);
        if (sel.startsWith('.')) return this.className.split(/\s+/).includes(sel.slice(1));
        const mAttr = sel.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (mAttr) {
          const val = this.getAttribute(mAttr[1]);
          return mAttr[2] !== undefined ? val === mAttr[2] : val !== null;
        }
        return this.tagName.toLowerCase() === sel.toLowerCase();
      });
    }

    closest(selector) {
      let cur = this;
      while (cur) {
        if (cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    querySelectorAll(selector) {
      const out = [];
      const walk = (node) => {
        for (const ch of node.children) {
          if (ch.matches(selector)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    set innerHTML(html) {
      this._innerHTML = String(html || '');
      for (const old of [...this.children]) this.removeChild(old);
      /* Parse key tags with attributes for DOM query tests */
      const tagRe = /<(section|header|div|span|button|select|option|input|svg|polyline|circle|line|g|h3|h4|p|label)\b([^>]*)>/gi;
      let m;
      while ((m = tagRe.exec(this._innerHTML)) !== null) {
        const el = new MiniElement(m[1]);
        const attrsStr = m[2] || '';
        const attrRe = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(attrsStr)) !== null) {
          el.setAttribute(am[1], am[2]);
        }
        this.appendChild(el);
      }
    }

    get innerHTML() {
      return this._innerHTML;
    }
  }

  const htmlEl = new MiniElement('html');
  htmlEl.dir = dir;
  htmlEl.lang = lang;
  htmlEl.setAttribute('data-theme', theme);
  htmlEl.setAttribute('data-zone-reduced-motion', reducedMotion ? 'true' : 'false');

  const bodyEl = new MiniElement('body');
  htmlEl.appendChild(bodyEl);

  const mainEl = new MiniElement('div');
  mainEl.setAttribute('id', 'zone-main');
  mainEl.setAttribute('data-zone-screen', screen);
  bodyEl.appendChild(mainEl);

  const stageEl = new MiniElement('div');
  stageEl.setAttribute('data-z3d-stage', 'city-wheels-race');
  mainEl.appendChild(stageEl);

  const doc = {
    readyState: 'complete',
    documentElement: htmlEl,
    body: bodyEl,
    activeElement: null,
    createElement: (tag) => new MiniElement(tag),
    getElementById: (id) => {
      const el = idMap.get(id);
      return el && el.isConnected ? el : null;
    },
    querySelector: (sel) => htmlEl.querySelector(sel),
    querySelectorAll: (sel) => htmlEl.querySelectorAll(sel),
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };

  const scans = [];
  const stageActions = [];
  const audioCues = [];
  const hapticsPlayed = [];

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || {};
    }
  }

  const win = {
    document: doc,
    CustomEvent: FakeCustomEvent,
    requestAnimationFrame: (fn) => { fn(); return 1; },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      if (ev && ev.type === 'zone:audio-cue') audioCues.push(ev.detail);
      for (const fn of (winListeners.get(ev.type) || [])) fn(ev);
    },
    ZoneEcs3D: {
      scan(el) { scans.push(el); },
      triggerStageAction(stage, action, payload) {
        stageActions.push({ stage, action, payload });
        return true;
      }
    },
    ZoneAudioHaptics: {
      play(cue, payload) {
        hapticsPlayed.push({ cue, payload });
        return true;
      }
    }
  };

  class FakeMutationObserver {
    observe() {}
    disconnect() {}
  }

  const sandbox = {
    window: win,
    document: doc,
    globalThis: win,
    MutationObserver: FakeMutationObserver,
    CustomEvent: FakeCustomEvent,
    requestAnimationFrame: win.requestAnimationFrame,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Date
  };
  win.window = win;

  vm.createContext(sandbox);
  vm.runInContext(jsSource, sandbox, { filename: 'zone-vehicle-garage.js' });

  return {
    win,
    doc,
    mainEl,
    stageEl,
    MiniElement,
    scans,
    stageActions,
    audioCues,
    hapticsPlayed,
    garage: win.ZoneVehicleGarage
  };
}

test('v157 Gate 1: Static CSS/JS syntax, balanced braces, zero external URLs & 390px/RTL/theme parity rules', () => {
  assert.ok(existsSync(jsPath) && statSync(jsPath).size > 2000, 'zone-vehicle-garage.js exists');
  assert.ok(existsSync(cssPath) && statSync(cssPath).size > 1500, 'zone-vehicle-garage.css exists');
  assert.ok(!/https?:\/\//i.test(jsSource), 'No external URLs in zone-vehicle-garage.js');
  assert.ok(!/https?:\/\//i.test(cssSource), 'No external URLs in zone-vehicle-garage.css');

  execFileSync(process.execPath, ['--check', jsPath]);

  let braces = 0;
  for (const ch of cssSource) {
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    assert.ok(braces >= 0, 'Unbalanced closing brace in zone-vehicle-garage.css');
  }
  assert.equal(braces, 0, 'All CSS braces balanced in zone-vehicle-garage.css');

  for (const requiredRule of [
    'html[data-theme="light"]',
    'html[dir="rtl"] .zvg-scope',
    'html[data-zone-reduced-motion="true"]',
    '@media (max-width: 680px)',
    'box-sizing: border-box'
  ]) {
    assert.ok(cssSource.includes(requiredRule), `Missing required CSS rule: ${requiredRule}`);
  }
});

test('v157 Gate 2: Vehicle Physics Workbench (4 Vehicles, Suspension, Gear Ratio, Grip, Nitro & Frame-Rate-Independent Spring)', () => {
  const eng = loadHeadlessEngine();
  assert.equal(eng.VEHICLES.length, 4, 'Exactly 4 Syndicate vehicles defined');
  const ids = [...eng.VEHICLES.map((v) => v.id)];
  assert.deepEqual(ids, ['nightshade_gt', 'pier4_armored_van', 'apex_interceptor', 'stealth_enduro_bike']);

  /* Suspension stiffness reduces body roll & weight transfer while increasing natural frequency */
  const soft = eng.computeVehiclePhysics('nightshade_gt', { suspensionStiffness: 25, gearRatio: 3.55, tireGrip: 75, nitroBoost: 40 });
  const stiff = eng.computeVehiclePhysics('nightshade_gt', { suspensionStiffness: 90, gearRatio: 3.55, tireGrip: 75, nitroBoost: 40 });
  assert.ok(stiff.bodyRollDeg < soft.bodyRollDeg, `Stiffer suspension reduces body roll (${stiff.bodyRollDeg} < ${soft.bodyRollDeg})`);
  assert.ok(stiff.weightTransferPct < soft.weightTransferPct, 'Stiffer suspension reduces longitudinal weight transfer');
  assert.ok(stiff.naturalFreqHz > soft.naturalFreqHz, 'Stiffer suspension raises natural spring frequency');

  /* Gear ratio tradeoff: lower numerical overdrive increases top speed; higher ratio sharpens launch */
  const tallGear = eng.computeVehiclePhysics('apex_interceptor', { suspensionStiffness: 70, gearRatio: 2.55, tireGrip: 85, nitroBoost: 50 });
  const shortGear = eng.computeVehiclePhysics('apex_interceptor', { suspensionStiffness: 70, gearRatio: 4.70, tireGrip: 85, nitroBoost: 50 });
  assert.ok(tallGear.topSpeedKmh > shortGear.topSpeedKmh, `Tall overdrive gear increases top speed (${tallGear.topSpeedKmh} > ${shortGear.topSpeedKmh})`);
  assert.ok(shortGear.zeroToHundredSec <= tallGear.zeroToHundredSec, 'Short gear improves or matches 0-100 launch');

  /* Tire grip improves lateral G & traction score */
  const lowGrip = eng.computeVehiclePhysics('pier4_armored_van', { suspensionStiffness: 70, gearRatio: 4.0, tireGrip: 35, nitroBoost: 20 });
  const highGrip = eng.computeVehiclePhysics('pier4_armored_van', { suspensionStiffness: 70, gearRatio: 4.0, tireGrip: 95, nitroBoost: 20 });
  assert.ok(highGrip.lateralG > lowGrip.lateralG, 'Higher tire grip increases lateral G');
  assert.ok(highGrip.tractionScore > lowGrip.tractionScore, 'Higher tire grip increases traction score');

  /* Nitro boost increases top speed & thermal heat signature */
  const noNitro = eng.computeVehiclePhysics('stealth_enduro_bike', { suspensionStiffness: 50, gearRatio: 3.8, tireGrip: 80, nitroBoost: 0 });
  const maxNitro = eng.computeVehiclePhysics('stealth_enduro_bike', { suspensionStiffness: 50, gearRatio: 3.8, tireGrip: 80, nitroBoost: 100 });
  assert.ok(maxNitro.topSpeedKmh > noNitro.topSpeedKmh, 'Nitro boost increases top speed');
  assert.ok(maxNitro.heatSignature > noNitro.heatSignature, 'Nitro boost raises heat signature');
  assert.equal(noNitro.item3d, 'mountain_bike', 'Stealth Enduro Bike maps to 3D mountain_bike');
  assert.equal(tallGear.item3d, 'sports_car', 'Apex Interceptor maps to 3D sports_car');

  /* Frame-rate-independent exponential smoothing check (30fps vs 120fps) */
  let p30 = 0;
  for (let i = 0; i < 15; i++) p30 = eng.expSmooth(p30, 100, 10, 1 / 30);
  let p120 = 0;
  for (let i = 0; i < 60; i++) p120 = eng.expSmooth(p120, 100, 10, 1 / 120);
  assert.ok(Math.abs(p30 - p120) < 0.01, `expSmooth is frame-rate independent (${p30.toFixed(4)} vs ${p120.toFixed(4)})`);

  /* Reduced motion clamps damped spring immediately */
  const clampedSpring = eng.stepSuspensionSpring({ displacement: 0.8, velocity: 2.5 }, 1.5, 0.7, 0.016, true);
  assert.equal(clampedSpring.displacement, 0);
  assert.equal(clampedSpring.velocity, 0);
});

test('v157 Gate 3: A* District Smuggling Corridor Planner (6 Districts, Admissible Heuristic, Low-Heat vs Fastest)', () => {
  const eng = loadHeadlessEngine();
  assert.equal(eng.DISTRICTS.length, 6, '6 Zone City districts configured');

  const ghostBike = eng.computeVehiclePhysics('stealth_enduro_bike', { suspensionStiffness: 48, gearRatio: 3.8, tireGrip: 82, nitroBoost: 15 });
  const lowHeat = eng.findSmugglingRouteAStar({
    origin: 'pier_4',
    destination: 'north_airstrip',
    mode: 'low_heat',
    physics: ghostBike,
    policeAlertLevel: 65
  });
  const fastest = eng.findSmugglingRouteAStar({
    origin: 'pier_4',
    destination: 'north_airstrip',
    mode: 'fastest',
    physics: ghostBike,
    policeAlertLevel: 65
  });

  assert.ok(lowHeat && fastest, 'Both A* modes return valid routes');
  assert.equal(lowHeat.heuristicType, 'euclidean_admissible');
  assert.equal(lowHeat.path[0], 'pier_4');
  assert.equal(lowHeat.path[lowHeat.path.length - 1], 'north_airstrip');
  assert.equal(fastest.path[0], 'pier_4');
  assert.equal(fastest.path[fastest.path.length - 1], 'north_airstrip');
  assert.ok(lowHeat.nodesExpanded >= 2 && lowHeat.nodesExpanded <= 6, 'A* expands valid subset of 6 districts');
  assert.ok(
    lowHeat.totalCheckpointRiskPct <= fastest.totalCheckpointRiskPct,
    `Low-Heat risk (${lowHeat.totalCheckpointRiskPct}%) <= Fastest risk (${fastest.totalCheckpointRiskPct}%)`
  );
  assert.ok(
    fastest.totalTimeSec <= lowHeat.totalTimeSec,
    `Fastest ETA (${fastest.totalTimeSec}s) <= Low-Heat ETA (${lowHeat.totalTimeSec}s)`
  );
  assert.ok(lowHeat.alternateRoute && lowHeat.alternateRoute.mode === 'fastest', 'Alternate fastest route attached for comparison');

  /* Admissible heuristic <= actual shortest time cost from pier_4 to north_airstrip */
  const h = eng.computeCorridorHeuristic('pier_4', 'north_airstrip', 'fastest', ghostBike.topSpeedKmh);
  assert.ok(h > 0 && h <= fastest.totalTimeSec / 60, `Heuristic h=${h.toFixed(3)} <= actual ${(fastest.totalTimeSec / 60).toFixed(3)} min`);

  /* Higher police alert increases checkpoint risk */
  const calm = eng.findSmugglingRouteAStar({ origin: 'pier_4', destination: 'downtown_vaults', mode: 'low_heat', physics: ghostBike, policeAlertLevel: 10 });
  const lockdown = eng.findSmugglingRouteAStar({ origin: 'pier_4', destination: 'downtown_vaults', mode: 'low_heat', physics: ghostBike, policeAlertLevel: 95 });
  assert.ok(lockdown.totalCheckpointRiskPct > calm.totalCheckpointRiskPct, 'Police alert level scales checkpoint risk');
});

test('v157 Gate 4: Route-Scoped Mounting (city + travel ONLY, 0 on home!), 3D/Audio Bridges & Bilingual EN/AR RTL Parity', () => {
  /* 1. Verify ZERO mounts on Home */
  const homeDom = createDomHarness({ screen: 'home', lang: 'en', dir: 'ltr' });
  assert.equal(homeDom.doc.getElementById('zvg-garage-hub'), null, '0 mounts when screen === "home"');
  assert.equal(homeDom.garage.shouldMountOnCurrentScreen(), false);

  /* Switch home -> city => mounts cleanly */
  homeDom.mainEl.setAttribute('data-zone-screen', 'city');
  assert.equal(homeDom.garage.render(), true);
  assert.ok(homeDom.doc.getElementById('zvg-garage-hub'), 'Mounts on screen === "city"');

  /* Switch city -> home => unmounts cleanly */
  homeDom.mainEl.setAttribute('data-zone-screen', 'home');
  assert.equal(homeDom.garage.render(), false);
  assert.equal(homeDom.doc.getElementById('zvg-garage-hub'), null, 'Unmounts cleanly on return to home');

  /* 2. Verify Travel screen & panel mounting */
  const travelDom = createDomHarness({ screen: 'travel', lang: 'en', dir: 'ltr' });
  assert.ok(travelDom.doc.getElementById('zvg-garage-hub'), 'Mounts on screen === "travel"');

  /* 3. Verify 3D item slot switching (sports_car -> mountain_bike) + city-wheels-race pulse + ZoneAudioHaptics */
  const cityDom = createDomHarness({ screen: 'city', lang: 'en', dir: 'ltr' });
  const hub = cityDom.doc.getElementById('zvg-garage-hub');
  assert.ok(hub, '#zvg-garage-hub mounted on city');
  const slotBefore = hub.querySelector('[data-z3d-item]');
  assert.equal(slotBefore.getAttribute('data-z3d-item'), 'sports_car', 'Initial vehicle renders sports_car 3D slot');

  const bikeBtn = hub.querySelector('[data-vehicle="stealth_enduro_bike"]');
  assert.ok(bikeBtn, 'Stealth Enduro Bike selector present');
  bikeBtn.dispatchEvent({ type: 'click', target: bikeBtn, preventDefault() {} });

  const slotAfter = hub.querySelector('[data-z3d-item]');
  assert.equal(slotAfter.getAttribute('data-z3d-item'), 'mountain_bike', 'Selecting Stealth Enduro Bike switches 3D slot to mountain_bike');
  assert.ok(cityDom.scans.length >= 2, 'ZoneEcs3D.scan invoked on initial mount and 3D vehicle swap');

  const pulseBtn = hub.querySelector('[data-zvg-act="pulse-3d"]');
  pulseBtn.dispatchEvent({ type: 'click', target: pulseBtn, preventDefault() {} });
  assert.ok(
    cityDom.stageActions.some((a) => a.stage === 'city-wheels-race' && a.action === 'pulse'),
    'Dispatched ZoneEcs3D.triggerStageAction("city-wheels-race", "pulse")'
  );
  assert.ok(cityDom.hapticsPlayed.length >= 1, 'ZoneAudioHaptics.play invoked');
  assert.ok(cityDom.audioCues.length >= 1, 'CustomEvent("zone:audio-cue") dispatched');

  const simRes = cityDom.garage.simulateSmugglingRun({ origin: 'pier_4', destination: 'north_airstrip', mode: 'low_heat' });
  assert.ok(simRes.route && simRes.route.path.length >= 2, 'Smuggling run simulation completes with valid path');
  assert.ok(cityDom.doc.getElementById('zvg-garage-hub').querySelector('.zvg-feedback'), 'Feedback status banner mounted after simulation');

  /* 4. Arabic RTL parity across all I18N keys, vehicles, and districts */
  const arDom = createDomHarness({ screen: 'city', lang: 'ar', dir: 'rtl' });
  const arHub = arDom.doc.getElementById('zvg-garage-hub');
  assert.ok(arHub, 'Mounts in Arabic RTL mode');
  assert.match(arHub.innerHTML, /كراج المركبات/, 'Arabic title rendered');
  assert.match(arHub.innerHTML, /نايت شيد جي تي/, 'Arabic vehicle name rendered');
  assert.match(arHub.innerHTML, /أرصفة الميناء ٤/, 'Arabic district name rendered');

  const i18n = arDom.garage.I18N;
  for (const key of Object.keys(i18n.en)) {
    assert.ok(i18n.ar[key] && i18n.ar[key] !== i18n.en[key], `Bilingual EN/AR parity verified for "${key}"`);
  }
});

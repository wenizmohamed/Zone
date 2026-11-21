import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsPath = resolve(root, 'assets/ui/zone-replay-viewer.js');
const cssPath = resolve(root, 'assets/ui/zone-replay-viewer.css');
const jsSource = readFileSync(jsPath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');

function createDomHarness({ width = 390, lang = 'en', dir = 'ltr', theme = 'dark', reducedMotion = true, muted = false } = {}) {
  const idMap = new Map();
  const winListeners = new Map();
  const docListeners = new Map();
  const stageActions = [];
  const audioCues = [];

  class MiniElement {
    constructor(tagName) {
      this.tagName = String(tagName || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this.disabled = false;
      this.value = '';
      this.textContent = '';
      this._innerHTML = '';
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.clientWidth = width;
      this.clientHeight = 120;
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
          else if (k === 'value') {
            el.value = v;
            el.attributes.set(k, v);
          } else {
            el.attributes.set(k, v);
          }
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

  const combatStage = new MiniElement('div');
  combatStage.setAttribute('data-z3d-stage', 'combat-arena');
  zoneMain.appendChild(combatStage);

  const heistStage = new MiniElement('div');
  heistStage.setAttribute('data-z3d-stage', 'heist-breach');
  zoneMain.appendChild(heistStage);

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
    },
    dispatchInput(target) {
      const list = docListeners.get('input') || [];
      const ev = { target, preventDefault() {} };
      for (const fn of list) fn(ev);
    }
  };

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const windowMock = {
    document: documentMock,
    __zoneMuted: muted,
    CustomEvent: MockCustomEvent,
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
    JSON,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(jsSource, context, { filename: 'zone-replay-viewer.js' });

  return {
    window: windowMock,
    document: documentMock,
    htmlEl,
    zoneMain,
    api: windowMock.ZoneReplayViewer,
    stageActions,
    audioCues
  };
}

test('1. Syntax check & CSS watercolor Light/Dark + RTL + 390px mobile parity', () => {
  assert.ok(existsSync(jsPath), 'assets/ui/zone-replay-viewer.js must exist');
  assert.ok(existsSync(cssPath), 'assets/ui/zone-replay-viewer.css must exist');

  execFileSync(process.execPath, ['--check', jsPath], { stdio: 'pipe' });

  assert.match(cssSource, /--zwc-surface/);
  assert.match(cssSource, /html\[data-theme="light"\]/);
  assert.match(cssSource, /html\[dir="rtl"\]/);
  assert.match(cssSource, /html:lang\(ar\)/);
  assert.match(cssSource, /@media\s*\(max-width:\s*680px\)/);
  assert.match(cssSource, /data-zone-reduced-motion="true"/);
  assert.match(cssSource, /overflow:\s*hidden/);
});

test('2. Route-scoped mount: 0 mounts on home/city/gym/casino, mounts ONLY on attack and crimes', () => {
  const env = createDomHarness();
  assert.ok(env.api, 'window.ZoneReplayViewer must be exposed');
  assert.equal(env.api.LOGICAL_TICK_MS, 100);

  // Default screen is 'home' -> 0 mounts
  assert.equal(env.api.render(), false);
  assert.equal(env.document.getElementById('zrv-replay-viewer'), null);

  for (const forbiddenScreen of ['home', 'city', 'gym', 'casino', 'faction', 'items', 'dossier']) {
    env.zoneMain.setAttribute('data-zone-screen', forbiddenScreen);
    assert.equal(env.api.render(), false, `Must NOT mount on ${forbiddenScreen}`);
    assert.equal(env.document.getElementById('zrv-replay-viewer'), null);
  }

  // Navigate to 'attack' -> mounts cleanly
  env.zoneMain.setAttribute('data-zone-screen', 'attack');
  assert.equal(env.api.render(), true);
  let viewer = env.document.getElementById('zrv-replay-viewer');
  assert.ok(viewer, '#zrv-replay-viewer must mount on attack screen');
  assert.equal(viewer.getAttribute('data-zrv-screen'), 'attack');
  assert.ok(viewer.querySelector('[data-zrv-verified-badge="1"]'), 'Determinism verification badge must render');
  assert.ok(viewer.querySelector('[data-zrv-scrubber="1"]'), 'Timeline scrubber must render');

  // Navigate to 'crimes' -> stays mounted and selects crimes curated episode
  env.zoneMain.setAttribute('data-zone-screen', 'crimes');
  assert.equal(env.api.render(), true);
  viewer = env.document.getElementById('zrv-replay-viewer');
  assert.ok(viewer, '#zrv-replay-viewer must mount on crimes screen');
  assert.equal(viewer.getAttribute('data-zrv-screen'), 'crimes');
  assert.equal(env.api.getActiveEpisode().screen, 'crimes');

  // Return to 'home' -> unmounts immediately
  env.zoneMain.setAttribute('data-zone-screen', 'home');
  assert.equal(env.api.render(), false);
  assert.equal(env.document.getElementById('zrv-replay-viewer'), null);
});

test('3. Bit-exact deterministic state hash reproduction across 2 replays of the same seed + bisection divergence detection', () => {
  const env = createDomHarness();
  const episodes = env.api.getEpisodes();
  assert.ok(episodes.length >= 3, '3 curated sample episodes must be ready immediately on first visit');

  for (const ep of episodes) {
    // Re-run simulation twice independently with identical seed & command log
    const replayA = env.api.runDeterministicSimulation({
      episodeId: ep.episodeId,
      seed: ep.seed,
      screen: ep.screen,
      district: ep.district,
      totalTicks: ep.totalTicks,
      commands: ep.commands
    });
    const replayB = env.api.runDeterministicSimulation({
      episodeId: ep.episodeId,
      seed: ep.seed,
      screen: ep.screen,
      district: ep.district,
      totalTicks: ep.totalTicks,
      commands: ep.commands
    });

    assert.equal(replayA.finalHash, ep.finalHash, `Replay A finalHash must match recorded episode ${ep.episodeId}`);
    assert.equal(replayB.finalHash, replayA.finalHash, `Replay B finalHash must be bit-exact with Replay A for seed ${ep.seedHex}`);
    assert.deepEqual(replayA.stateHashes, replayB.stateHashes, 'Every 100ms tick stateHash must be 100% bit-exact across runs');

    const ver = env.api.verifyEpisodeDeterminism(ep);
    assert.equal(ver.verified, true);
    assert.equal(ver.firstDivergentTick, -1);
  }

  // Verify binary-search divergence localisation pinpoints exact tampered tick T0
  const baseHashes = episodes[0].stateHashes.slice();
  const tamperedHashes = baseHashes.slice();
  tamperedHashes[14] = '0xDEAD1590';
  tamperedHashes[15] = '0xDEAD1591';
  const diff = env.api.detectDivergence(baseHashes, tamperedHashes);
  assert.equal(diff.diverged, true);
  assert.equal(diff.firstDivergentTick, 14, 'Binary-search bisection must pinpoint tick 14 as first divergent tick');
});

test('4. Scrubber seek, Step Back/Forward (1 tick), 0.5x/1x/2x speed, 3D Stage & Audio triggers, and Mute/Settings integration', () => {
  const env = createDomHarness();
  env.zoneMain.setAttribute('data-zone-screen', 'attack');
  env.api.render();

  const duelEp = env.api.selectEpisode('ep_razor_vance_duel');
  assert.equal(duelEp.episodeId, 'ep_razor_vance_duel');
  assert.equal(env.api.getState().currentTick, 0);

  // Step forward to tick 2 (first command: armor_pierce on combat-arena)
  env.api.stepForward();
  assert.equal(env.api.getState().currentTick, 1);
  env.api.stepForward();
  assert.equal(env.api.getState().currentTick, 2);

  assert.ok(env.stageActions.some(a => a.stage === 'combat-arena' && a.action === 'armor_pierce' && a.payload.tick === 2));
  assert.ok(env.audioCues.some(c => c.cue === 'gunshot_rifle' && c.detail.tick === 2));

  // Step back (-1 tick) -> tick 1
  env.api.stepBackward();
  assert.equal(env.api.getState().currentTick, 1);

  // Scrubber seek to tick 10 (counter_parry command)
  const viewer = env.document.getElementById('zrv-replay-viewer');
  const scrubber = viewer.querySelector('[data-zrv-scrubber="1"]');
  assert.ok(scrubber, 'Scrubber input must exist');
  scrubber.value = '10';
  env.document.dispatchInput(scrubber);
  assert.equal(env.api.getState().currentTick, 10);
  assert.ok(env.stageActions.some(a => a.stage === 'combat-arena' && a.action === 'counter_parry' && a.payload.tick === 10));
  assert.ok(env.audioCues.some(c => c.cue === 'blade_slash' && c.detail.tick === 10));

  // Speed switching (0.5x, 1x, 2x)
  assert.equal(env.api.setSpeed(0.5), 0.5);
  assert.equal(env.api.setSpeed(2), 2);
  assert.equal(env.api.setSpeed(1), 1);

  // Test mute respect via zone:settings-changed & window.__zoneMuted
  const prevAudioCount = env.audioCues.length;
  env.window.dispatchEvent(new env.window.CustomEvent('zone:settings-changed', {
    detail: { muted: true, autoReplay: false }
  }));
  assert.equal(env.api.getState().muted, true);
  assert.equal(env.api.getState().autoReplay, false);

  // Seek to tick 18 while muted -> 3D stage still triggers, audio does NOT fire
  env.api.seekToTick(18, true);
  assert.ok(env.stageActions.some(a => a.stage === 'combat-arena' && a.action === 'rush_interrupt' && a.payload.tick === 18));
  assert.equal(env.audioCues.length, prevAudioCount, 'Audio must NOT play while muted is true');
});

test('5. Live Command-Flow recording from zone:tactical-event & zone:3d-action + Seed Share Export/Import round-trip', () => {
  const env = createDomHarness();
  env.zoneMain.setAttribute('data-zone-screen', 'crimes');
  env.api.render();

  env.api.startRecording({
    episodeId: 'ep_custom_pier4_run',
    seed: 0x159777AA,
    screen: 'crimes',
    district: 'pier_4'
  });

  env.window.dispatchEvent(new env.window.CustomEvent('zone:tactical-event', {
    detail: {
      stage: 'heist-breach',
      action: 'crack',
      cue: 'vault_tumbler',
      payload: { approach: 'stealth', inBlindSpot: true }
    }
  }));

  env.window.dispatchEvent(new env.window.CustomEvent('zone:3d-action', {
    detail: {
      stage: 'heist-breach',
      action: 'win',
      cue: 'cash_payout',
      payload: { cleanBreach: true }
    }
  }));

  const recordedEp = env.api.finalizeRecording({
    titleEn: 'Custom Pier 4 Clean Sweep',
    titleAr: 'اختراق الرصيف ٤ المخصص'
  });

  assert.equal(recordedEp.episodeId, 'ep_custom_pier4_run');
  assert.equal(recordedEp.commands.length, 2);
  assert.equal(env.api.verifyEpisodeDeterminism(recordedEp).verified, true);

  // Export seed share token & re-import into a fresh harness to verify cross-instance determinism
  const shareToken = env.api.exportReplayPayload('ep_custom_pier4_run');
  assert.match(shareToken, /^ZRV1:\{/);

  const env2 = createDomHarness();
  const importedEp = env2.api.importReplayPayload(shareToken);
  assert.ok(importedEp, 'Imported episode must build cleanly');
  assert.equal(importedEp.finalHash, recordedEp.finalHash, 'Imported seed share must reproduce identical finalHash');
  assert.deepEqual(Array.from(importedEp.stateHashes), Array.from(recordedEp.stateHashes), 'Imported seed share must reproduce all tick stateHashes');
});

test('6. Bilingual EN + AR RTL parity and <bdi> numeric/hash isolation at 390px viewport', () => {
  const envAr = createDomHarness({ width: 390, lang: 'ar', dir: 'rtl' });
  envAr.zoneMain.setAttribute('data-zone-screen', 'attack');
  envAr.api.render();

  const viewer = envAr.document.getElementById('zrv-replay-viewer');
  assert.ok(viewer, 'Replay viewer must mount in AR RTL 390px mode');
  assert.match(viewer.innerHTML, /إعادة العرض التكتيكي ٣D/);
  assert.match(viewer.innerHTML, /بذرة حتمية موثقة/);
  assert.match(viewer.innerHTML, /تشغيل الإعادة/);
  assert.match(viewer.innerHTML, /<bdi/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const settingsJsPath = resolve(root, 'assets/ui/zone-player-settings.js');
const settingsCssPath = resolve(root, 'assets/ui/zone-player-settings.css');
const audioHapticsJsPath = resolve(root, 'assets/ui/zone-audio-haptics.js');

const require = createRequire(import.meta.url);
const { createZonePlayerSettingsEngine } = require(settingsJsPath);
const { createZoneAudioHapticsEngine } = require(audioHapticsJsPath);

/* --------------------------------------------------------------------------
 * Mock WebAudio + DOM + Iframe Harness for Hardware-Tight Mute Verification
 * -------------------------------------------------------------------------- */
class MockAudioParam {
  constructor(initialValue = 1) {
    this.value = initialValue;
    this.events = [];
  }
  cancelScheduledValues(time) {
    this.events.push({ type: 'cancel', time });
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }
  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'linearRamp', value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'expRamp', value, time });
  }
}

function createTestEnvironment(opts = {}) {
  class BaseMockAudioNode {
    constructor(kind, ctx) {
      this.kind = kind;
      this.context = ctx || null;
      this.connections = [];
    }
    connect(dest) {
      this.connections.push(dest);
      return dest;
    }
    disconnect() {
      this.connections = [];
    }
  }

  class MockGainNode extends BaseMockAudioNode {
    constructor(ctx) {
      super('GainNode', ctx);
      this.gain = new MockAudioParam(1.0);
    }
  }

  class MockOscillatorNode extends BaseMockAudioNode {
    constructor(ctx) {
      super('OscillatorNode', ctx);
      this.type = 'sine';
      this.frequency = new MockAudioParam(440);
      this.started = false;
      this.stopped = false;
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockBiquadFilterNode extends BaseMockAudioNode {
    constructor(ctx) {
      super('BiquadFilterNode', ctx);
      this.type = 'lowpass';
      this.frequency = new MockAudioParam(18000);
      this.Q = new MockAudioParam(0.707);
    }
  }

  class MockDynamicsCompressorNode extends BaseMockAudioNode {
    constructor(ctx) {
      super('DynamicsCompressorNode', ctx);
      this.threshold = new MockAudioParam(-14);
      this.knee = new MockAudioParam(18);
      this.ratio = new MockAudioParam(4);
      this.attack = new MockAudioParam(0.004);
      this.release = new MockAudioParam(0.16);
    }
  }

  class MockAudioBufferSourceNode extends BaseMockAudioNode {
    constructor(ctx) {
      super('AudioBufferSourceNode', ctx);
      this.buffer = null;
      this.loop = false;
    }
    start() {}
    stop() {}
  }

  const createdContexts = [];
  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 44100;
      this.currentTime = 1.0;
      this.destination = new BaseMockAudioNode('AudioDestinationNode', this);
      this.gains = [];
      this.oscillators = [];
      createdContexts.push(this);
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
    createGain() {
      const g = new MockGainNode(this);
      this.gains.push(g);
      return g;
    }
    createOscillator() {
      const o = new MockOscillatorNode(this);
      this.oscillators.push(o);
      return o;
    }
    createBiquadFilter() {
      return new MockBiquadFilterNode(this);
    }
    createDynamicsCompressor() {
      return new MockDynamicsCompressorNode(this);
    }
    createBuffer(channels, length, sampleRate) {
      const ch = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData(i) { return ch[i]; }
      };
    }
    createBufferSource() {
      return new MockAudioBufferSourceNode(this);
    }
  }

  // Minimal DOM tree supporting topbar, sidebar, body modal, and iframes
  const elementsById = new Map();
  const iframeMessages = [];

  function makeElement(tag, id = '') {
    const el = {
      tagName: String(tag).toUpperCase(),
      id: id || '',
      className: '',
      innerHTML: '',
      textContent: '',
      value: '',
      style: {
        props: {},
        setProperty(k, v) { this.props[k] = String(v); }
      },
      dataset: {},
      attrs: {},
      children: [],
      listeners: {},
      parentElement: null,
      setAttribute(k, v) {
        this.attrs[k] = String(v);
        if (k === 'id') {
          this.id = String(v);
          elementsById.set(this.id, this);
        }
      },
      getAttribute(k) {
        if (k === 'id') return this.id || null;
        return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
      },
      hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attrs, k);
      },
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) elementsById.set(child.id, child);
        return child;
      },
      addEventListener(type, fn) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(fn);
      },
      click() {
        const list = this.listeners.click || [];
        for (const fn of list) fn({ target: this, stopPropagation() {} });
      },
      querySelector(sel) {
        if (sel === '.zone-profile-body') return profileBody;
        if (sel.startsWith('#')) {
          const targetId = sel.slice(1);
          if (elementsById.has(targetId)) return elementsById.get(targetId);
          const m = this.innerHTML.match(new RegExp(`id="${targetId}"`));
          if (m) {
            const stub = makeElement('div', targetId);
            return stub;
          }
        }
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-zps-tab]') {
          const tabs = ['audio', 'graphics', 'gameplay', 'controls', 'accessibility', 'cloud'];
          return tabs.map((t) => {
            const b = makeElement('button');
            b.setAttribute('data-zps-tab', t);
            return b;
          });
        }
        return [];
      }
    };
    if (id) elementsById.set(id, el);
    return el;
  }

  const headerActions = makeElement('div', 'mock-header-actions');
  headerActions.className = 'zone-header-actions';
  const profileBody = makeElement('div', 'mock-profile-body');
  profileBody.className = 'zone-profile-body';
  const sidebar = makeElement('aside', 'mock-sidebar');
  sidebar.className = 'zone-sidebar';
  sidebar.appendChild(profileBody);

  const mockIframe = {
    contentWindow: {
      postMessage(msg, origin) {
        iframeMessages.push({ msg, origin });
      }
    }
  };

  const docBody = makeElement('body', 'mock-body');
  const documentElement = makeElement('html', 'mock-html');
  documentElement.lang = opts.lang || 'en';
  documentElement.dir = opts.dir || 'ltr';

  const store = new Map(Object.entries(opts.initialStorage || {}));
  const localStorage = {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); }
  };

  const winTarget = new EventTarget();
  const mockDocument = {
    readyState: 'complete',
    documentElement,
    body: docBody,
    createElement(tag) { return makeElement(tag); },
    getElementById(id) { return elementsById.get(id) || null; },
    querySelector(sel) {
      if (sel.includes('.zone-header-actions')) return headerActions;
      if (sel.includes('.zone-sidebar')) return sidebar;
      if (sel.includes('.zone-profile-body')) return profileBody;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === 'iframe') return [mockIframe];
      return [];
    },
    addEventListener() {}
  };

  const mockWindow = {
    document: mockDocument,
    localStorage,
    location: { origin: 'http://127.0.0.1:8099' },
    AudioNode: BaseMockAudioNode,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    CustomEvent: globalThis.CustomEvent,
    addEventListener: winTarget.addEventListener.bind(winTarget),
    removeEventListener: winTarget.removeEventListener.bind(winTarget),
    dispatchEvent: winTarget.dispatchEvent.bind(winTarget)
  };

  const mockNavigator = {
    vibrate() { return true; },
    getGamepads() {
      return [{ id: 'Xbox Wireless Controller (Standard Gamepad)', connected: true }];
    }
  };

  return {
    BaseMockAudioNode,
    MockAudioContext,
    createdContexts,
    headerActions,
    profileBody,
    sidebar,
    elementsById,
    iframeMessages,
    store,
    localStorage,
    mockDocument,
    mockWindow,
    mockNavigator
  };
}

test('1. Deliverables exist and contain required MCM, DSP Gate, and 6-tab modal selectors', () => {
  assert.ok(existsSync(settingsJsPath), 'assets/ui/zone-player-settings.js must exist');
  assert.ok(existsSync(settingsCssPath), 'assets/ui/zone-player-settings.css must exist');
  const jsSrc = readFileSync(settingsJsPath, 'utf8');
  const cssSrc = readFileSync(settingsCssPath, 'utf8');

  assert.ok(jsSrc.includes('zps-global-mute-btn'), 'JS mounts #zps-global-mute-btn');
  assert.ok(jsSrc.includes('zps-open-settings-btn'), 'JS mounts #zps-open-settings-btn');
  assert.ok(jsSrc.includes('zps-sidebar-settings-btn'), 'JS mounts #zps-sidebar-settings-btn');
  assert.ok(jsSrc.includes('zone:settings-changed'), 'JS dispatches CustomEvent("zone:settings-changed")');
  assert.ok(jsSrc.includes('zone:audio-settings'), 'JS posts zone:audio-settings to iframes');
  assert.ok(cssSrc.includes('#zps-modal-backdrop'), 'CSS styles #zps-modal-backdrop');
  assert.ok(cssSrc.includes('#zps-fps-pill'), 'CSS styles #zps-fps-pill');
});

test('2. Persistent Topbar & Sidebar Mute + Settings buttons mount cleanly in EN and AR RTL', () => {
  const env = createTestEnvironment({ lang: 'en', dir: 'ltr' });
  const engine = createZonePlayerSettingsEngine({
    window: env.mockWindow,
    document: env.mockDocument,
    navigator: env.mockNavigator,
    localStorage: env.localStorage,
    AudioNode: env.BaseMockAudioNode,
    skipInitialFetch: true
  });

  const muteBtn = env.elementsById.get('zps-global-mute-btn');
  const openBtn = env.elementsById.get('zps-open-settings-btn');
  const sideBtn = env.elementsById.get('zps-sidebar-settings-btn');

  assert.ok(muteBtn, '#zps-global-mute-btn mounted in .zone-header-actions');
  assert.ok(openBtn, '#zps-open-settings-btn mounted in .zone-header-actions');
  assert.ok(sideBtn, '#zps-sidebar-settings-btn mounted in .zone-sidebar');
  assert.equal(muteBtn.getAttribute('aria-pressed'), 'false');
  assert.ok(muteBtn.innerHTML.includes('Sound'));
  assert.ok(openBtn.innerHTML.includes('Settings'));

  // Switch to Arabic RTL and verify labels update
  engine.updateSettings({ gameplay: { language: 'ar' } });
  assert.equal(env.mockDocument.documentElement.lang, 'ar');
  assert.equal(env.mockDocument.documentElement.dir, 'rtl');
  assert.ok(muteBtn.innerHTML.includes('الصوت'), 'Arabic sound label rendered');
  assert.ok(openBtn.innerHTML.includes('الإعدادات'), 'Arabic settings label rendered');

  engine.destroy();
});

test('3. Global Master Audio Kill-Switch silences 100% of AudioContexts including raw index.html playTacticalSfx', () => {
  const env = createTestEnvironment();

  // Mount ZoneAudioHaptics in the same window
  const haptics = createZoneAudioHapticsEngine({
    window: env.mockWindow,
    document: env.mockDocument,
    navigator: env.mockNavigator,
    localStorage: env.localStorage
  });
  env.mockWindow.ZoneAudioHaptics = haptics;

  // Simulate index.html's separate window.__zoneGame with its own raw playTacticalSfx & this._audioCtx
  const zoneGame = {
    _audioCtx: null,
    playTacticalSfx(kind = 'click') {
      const Ctx = env.mockWindow.AudioContext;
      this._audioCtx ||= new Ctx();
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.1);
    }
  };
  env.mockWindow.__zoneGame = zoneGame;

  const engine = createZonePlayerSettingsEngine({
    window: env.mockWindow,
    document: env.mockDocument,
    navigator: env.mockNavigator,
    localStorage: env.localStorage,
    AudioNode: env.BaseMockAudioNode,
    skipInitialFetch: true
  });

  // Trigger raw playTacticalSfx while unmuted (default 75% volume)
  zoneGame.playTacticalSfx('crime');
  assert.ok(zoneGame._audioCtx, 'index.html created its separate _audioCtx');
  const rawCtx = zoneGame._audioCtx;
  assert.ok(rawCtx.__zpsMasterGateGain, 'AudioNode.prototype.connect injected Master Gate GainNode on raw _audioCtx');
  assert.equal(rawCtx.__zpsMasterGateGain.gain.value, 0.75, 'Unmuted master gate gain equals 0.75 (75%)');

  // Also create a 2nd independent AudioContext (e.g., arcade or 3D bridge)
  const thirdPartyCtx = new env.mockWindow.AudioContext();
  const rawOsc = thirdPartyCtx.createOscillator();
  rawOsc.connect(thirdPartyCtx.destination);
  assert.ok(thirdPartyCtx.__zpsMasterGateGain, 'Master Gate GainNode injected on 2nd independent AudioContext');
  assert.equal(thirdPartyCtx.__zpsMasterGateGain.gain.value, 0.75);

  // Now click Global Mute (#zps-global-mute-btn) -> ALL contexts must drop to gain === 0 in 0ms!
  const muteBtn = env.elementsById.get('zps-global-mute-btn');
  muteBtn.click();

  assert.equal(engine.isMasterMuted(), true, 'Engine reports masterMuted === true');
  assert.equal(muteBtn.getAttribute('aria-pressed'), 'true', 'Mute button aria-pressed="true"');
  assert.equal(muteBtn.getAttribute('data-zps-muted'), '1', 'Mute button data-zps-muted="1"');
  assert.equal(rawCtx.__zpsMasterGateGain.gain.value, 0, 'index.html _audioCtx master gate gain is 0');
  assert.equal(thirdPartyCtx.__zpsMasterGateGain.gain.value, 0, '3rd-party AudioContext master gate gain is 0');
  assert.equal(haptics.isMuted(), true, 'ZoneAudioHaptics synced to muted === true');
  assert.equal(env.localStorage.getItem('zone_master_muted'), '1');
  assert.equal(env.localStorage.getItem('zone_sfx_muted'), '1');
  assert.equal(env.localStorage.getItem('zig_muted'), '1');
  assert.equal(env.mockWindow.__zoneMuted, true);
  assert.ok(env.iframeMessages.some((m) => m.msg && m.msg.type === 'zone:audio-settings' && m.msg.muted === true), 'Iframe received zone:audio-settings muted=true');

  // Even if someone creates a brand-new AudioContext while muted and connects an oscillator, its gate is 0
  const whileMutedCtx = new env.mockWindow.AudioContext();
  const mutedOsc = whileMutedCtx.createOscillator();
  mutedOsc.connect(whileMutedCtx.destination);
  assert.equal(whileMutedCtx.__zpsMasterGateGain.gain.value, 0, 'New AudioContext created while muted is gated at 0 immediately');

  engine.destroy();
  haptics.destroy();
});

test('4. All 6 AAA Modal tabs render in EN and AR RTL, dispatch zone:settings-changed, and round-trip JSON snapshots', () => {
  const env = createTestEnvironment({ lang: 'en', dir: 'ltr' });
  const engine = createZonePlayerSettingsEngine({
    window: env.mockWindow,
    document: env.mockDocument,
    navigator: env.mockNavigator,
    localStorage: env.localStorage,
    AudioNode: env.BaseMockAudioNode,
    skipInitialFetch: true
  });

  const eventsReceived = [];
  env.mockWindow.addEventListener('zone:settings-changed', (ev) => {
    eventsReceived.push(ev.detail);
  });

  engine.openModal('audio');
  const backdrop = env.elementsById.get('zps-modal-backdrop');
  assert.ok(backdrop, 'Modal backdrop mounted on document.body');
  assert.equal(backdrop.getAttribute('data-zps-open'), '1');

  // Verify all 6 tab panels exist in the rendered modal markup
  for (const tabId of ['audio', 'graphics', 'gameplay', 'controls', 'accessibility', 'cloud']) {
    engine.setActiveTab(tabId);
    assert.ok(backdrop.innerHTML.includes(`data-zps-panel="${tabId}"`), `Tab panel ${tabId} rendered`);
    assert.ok(backdrop.innerHTML.includes(`data-zps-panel="${tabId}" data-zps-panel-active="1"`), `Tab panel ${tabId} activates`);
  }

  // Update graphics, accessibility, and gameplay settings
  engine.updateSettings({
    audio: { masterVolume: 55, sfxVolume: 60 },
    graphics: { qualityPreset: 'ultra', showFpsCounter: true, particleDensity: 90 },
    gameplay: { theme: 'light', language: 'ar', showTickerBulletin: false },
    accessibility: { colorblindMode: 'protanopia', reducedMotion: true, highContrast: true, textScale: 110 }
  });

  assert.ok(eventsReceived.length > 0, 'zone:settings-changed event dispatched');
  assert.equal(env.mockDocument.documentElement.getAttribute('data-zone-colorblind'), 'protanopia');
  assert.equal(env.mockDocument.documentElement.getAttribute('data-zone-reduced-motion'), 'true');
  assert.equal(env.mockDocument.documentElement.getAttribute('data-zone-contrast'), 'high');
  assert.equal(env.mockDocument.documentElement.getAttribute('data-zone-text-scale'), '110');
  assert.equal(env.mockDocument.documentElement.getAttribute('data-zone-quality-preset'), 'ultra');
  assert.equal(env.elementsById.get('zps-fps-pill').getAttribute('data-zps-visible'), '1');
  assert.ok(backdrop.innerHTML.includes('dir="rtl"'), 'Modal switches to dir="rtl" in Arabic');

  // Export JSON snapshot, reset to defaults, and re-import snapshot
  const snapJson = engine.exportSnapshotJson();
  const parsedSnap = JSON.parse(snapJson);
  assert.equal(parsedSnap.settings.audio.masterVolume, 55);
  assert.equal(parsedSnap.settings.graphics.qualityPreset, 'ultra');

  engine.resetToDefaults();
  assert.equal(engine.getSettings().audio.masterVolume, 75);
  assert.equal(engine.getSettings().graphics.qualityPreset, 'high');
  assert.equal(engine.getSettings().accessibility.colorblindMode, 'standard');

  engine.importSnapshotJson(snapJson);
  assert.equal(engine.getSettings().audio.masterVolume, 55);
  assert.equal(engine.getSettings().graphics.qualityPreset, 'ultra');
  assert.equal(engine.getSettings().accessibility.colorblindMode, 'protanopia');
  assert.equal(engine.getSettings().accessibility.textScale, 110);

  engine.destroy();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const audioModulePath = resolve(root, 'assets/ui/zone-audio-haptics.js');
const require = createRequire(import.meta.url);
const { createZoneAudioHapticsEngine } = require(audioModulePath);

/* --------------------------------------------------------------------------
 * Deterministic WebAudio + DOM + Haptics Mock Harness for Node Verification
 * -------------------------------------------------------------------------- */
class MockAudioParam {
  constructor(initialValue = 0) {
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

class MockAudioNode {
  constructor(kind) {
    this.kind = kind;
    this.connections = [];
    this.disconnected = false;
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super('OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(when = 0) {
    this.startedAt = when;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super('GainNode');
    this.gain = new MockAudioParam(1.0);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super('BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1.0);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor() {
    super('DynamicsCompressorNode');
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super('AudioBufferSourceNode');
    this.buffer = null;
    this.loop = false;
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(when = 0) {
    this.startedAt = when;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

function createMockAudioEnvironment(opts = {}) {
  const createdContexts = [];
  const vibrateCalls = [];
  const store = new Map(Object.entries(opts.initialStorage || {}));

  class MockAudioContext {
    constructor() {
      this.state = opts.initialCtxState || 'suspended';
      this.sampleRate = 44100;
      this.currentTime = 1.0;
      this.resumeCount = 0;
      this.closed = false;
      this.destination = new MockAudioNode('AudioDestinationNode');
      this.oscillators = [];
      this.gains = [];
      this.filters = [];
      this.compressors = [];
      this.bufferSources = [];
      createdContexts.push(this);
    }
    resume() {
      this.resumeCount += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.closed = true;
      this.state = 'closed';
      return Promise.resolve();
    }
    createOscillator() {
      const osc = new MockOscillatorNode();
      this.oscillators.push(osc);
      return osc;
    }
    createGain() {
      const g = new MockGainNode();
      this.gains.push(g);
      return g;
    }
    createBiquadFilter() {
      const f = new MockBiquadFilterNode();
      this.filters.push(f);
      return f;
    }
    createDynamicsCompressor() {
      const c = new MockDynamicsCompressorNode();
      this.compressors.push(c);
      return c;
    }
    createBuffer(channels, length, sampleRate) {
      const chData = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData(ch) {
          return chData[ch];
        }
      };
    }
    createBufferSource() {
      const s = new MockAudioBufferSourceNode();
      this.bufferSources.push(s);
      return s;
    }
  }

  const winTarget = new EventTarget();
  const docTarget = new EventTarget();

  const zigSoundBtn = {
    id: 'zig-sound-toggle',
    className: 'zig-sound-btn',
    innerHTML: '<span>SFX: ON</span>',
    textContent: 'SFX: ON',
    attrs: { 'data-zig-muted': '0' },
    parentElement: null,
    getAttribute(k) { return this.attrs[k] ?? null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    querySelector(sel) {
      if (sel === 'span') {
        const self = this;
        return {
          get textContent() { return self.textContent; },
          set textContent(val) { self.textContent = val; }
        };
      }
      return null;
    },
    closest(sel) {
      if (sel.includes('#zig-sound-toggle') || sel.includes('[data-zig-sfx]')) return this;
      return null;
    }
  };

  const headerChildren = [zigSoundBtn];
  const zigHeader = {
    children: headerChildren,
    appendChild(el) {
      el.parentElement = zigHeader;
      headerChildren.push(el);
      return el;
    },
    querySelector(sel) {
      if (sel === '[data-zah-music-toggle="1"]') {
        return headerChildren.find((c) => c.attrs && c.attrs['data-zah-music-toggle'] === '1') || null;
      }
      return null;
    }
  };
  zigSoundBtn.parentElement = zigHeader;

  const mainEl = {
    id: 'zone-main',
    attrs: { 'data-zone-screen': opts.initialScreen || 'home' },
    getAttribute(k) { return this.attrs[k] ?? null; },
    setAttribute(k, v) { this.attrs[k] = String(v); }
  };

  const documentElement = {
    lang: opts.lang || 'en',
    dir: opts.dir || 'ltr',
    dataset: {
      zoneReducedMotion: opts.reducedMotion ? 'true' : 'false'
    },
    getAttribute(k) {
      if (k === 'data-zone-reduced-motion') return this.dataset.zoneReducedMotion;
      return null;
    },
    appendChild() {}
  };

  const mockDocument = {
    hidden: false,
    readyState: 'complete',
    documentElement,
    head: { appendChild() {} },
    body: {},
    addEventListener: docTarget.addEventListener.bind(docTarget),
    removeEventListener: docTarget.removeEventListener.bind(docTarget),
    dispatchEvent: docTarget.dispatchEvent.bind(docTarget),
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        type: '',
        className: '',
        innerHTML: '',
        textContent: '',
        attrs: {},
        getAttribute(k) { return this.attrs[k] ?? null; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
      };
    },
    getElementById(id) {
      if (id === 'zone-main') return mainEl;
      if (id === 'zig-sound-toggle') return zigSoundBtn;
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      if (sel.includes('[data-zig-sfx]')) {
        if (zigSoundBtn.hasAttribute('data-zig-sfx')) out.push(zigSoundBtn);
      }
      if (sel.includes('[data-zah-music-toggle]')) {
        for (const ch of headerChildren) {
          if (ch.attrs && ch.attrs['data-zah-music-toggle'] === '1') out.push(ch);
        }
      }
      return out;
    }
  };

  const mockWindow = {
    document: mockDocument,
    __zoneMuted: false,
    addEventListener: winTarget.addEventListener.bind(winTarget),
    removeEventListener: winTarget.removeEventListener.bind(winTarget),
    dispatchEvent: winTarget.dispatchEvent.bind(winTarget)
  };

  const mockNavigator = {
    userActivation: { hasBeenActive: true, isActive: true },
    vibrate(pattern) {
      vibrateCalls.push(pattern);
      return true;
    }
  };

  const mockStorage = {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); }
  };

  const engine = createZoneAudioHapticsEngine({
    window: mockWindow,
    document: mockDocument,
    navigator: mockNavigator,
    localStorage: mockStorage,
    AudioContext: MockAudioContext
  });

  return {
    engine,
    createdContexts,
    vibrateCalls,
    store,
    mockWindow,
    mockDocument,
    documentElement,
    mainEl,
    zigSoundBtn,
    zigHeader
  };
}

/* --------------------------------------------------------------------------
 * Test Suite
 * -------------------------------------------------------------------------- */
test('v155 Static Gate: zone-audio-haptics.js exists, JS syntax valid, zero external URLs, zero binary audio references', () => {
  assert.ok(existsSync(audioModulePath), 'assets/ui/zone-audio-haptics.js must exist');
  assert.ok(statSync(audioModulePath).size > 2000, 'zone-audio-haptics.js must be substantial');

  const src = readFileSync(audioModulePath, 'utf8');
  assert.ok(!/https?:\/\//i.test(src), 'External CDN/HTTP URLs are forbidden');
  assert.ok(!/\.(mp3|wav|ogg)\b/i.test(src), 'Binary audio file references are forbidden - 100% WebAudio synthesis only');
  assert.ok(src.includes('ZoneAudioHaptics'), 'Must expose window.ZoneAudioHaptics');
  assert.ok(src.includes('zone_sfx_muted'), 'Must sync with localStorage zone_sfx_muted');

  execFileSync(process.execPath, ['--check', audioModulePath]);
});

test('v155 Lazy AudioContext Law: zero AudioContext creation before real user gesture, instant DSP bus wiring on gesture', () => {
  const h = createMockAudioEnvironment();
  try {
    assert.equal(h.createdContexts.length, 0, 'AudioContext MUST NOT be created on load');
    assert.equal(h.engine.diagnostics().audioContextCreated, false);

    // Calling play(), setScreenRoute(), setMuted(), setMusicEnabled() pre-gesture must STILL not create AudioContext
    assert.equal(h.engine.play('vault_tumbler'), false);
    h.engine.setScreenRoute('crimes');
    h.engine.setMusicEnabled(false);
    assert.equal(h.createdContexts.length, 0, 'Pre-gesture state calls must never instantiate AudioContext');

    // Dispatch a real pointerdown user gesture -> lazily initializes & resumes AudioContext + DSP bus
    h.mockDocument.dispatchEvent(new Event('pointerdown'));
    assert.equal(h.createdContexts.length, 1, 'Exactly 1 AudioContext created upon first user gesture');

    const ctx = h.createdContexts[0];
    assert.equal(ctx.state, 'running', 'Suspended AudioContext must be resumed inside user gesture');
    assert.ok(ctx.resumeCount >= 1);

    const diag = h.engine.diagnostics();
    assert.equal(diag.audioContextCreated, true);
    assert.equal(diag.compressorActive, true, 'DynamicsCompressorNode must be wired');
    assert.equal(diag.masterVolume, 0.7, 'MasterGain headroom must default to 0.7');
    assert.equal(diag.masterGainValue, 0.7);
    assert.equal(diag.lowpassFilterHz, 18000, 'Default BiquadFilterNode cutoff must be open (18kHz)');
    assert.equal(ctx.compressors.length, 1);
  } finally {
    h.engine.destroy();
  }
});

test('v155 Calibrated Procedural SFX Frequencies: 400Hz + 4200Hz vault_tumbler, 1850Hz + 2400Hz equip_snap, 220Hz step_fail, 440+554+660Hz jackpot_fanfare & layered combat weapons', () => {
  const h = createMockAudioEnvironment({ initialStorage: { zone_music_enabled: '0' } });
  try {
    h.engine.unlockFromGesture();
    const ctx = h.createdContexts[0];

    // 1. vault_tumbler: 400Hz decay + 4200Hz 40ms torque snap
    let oscStartIdx = ctx.oscillators.length;
    assert.equal(h.engine.play('vault_tumbler'), true);
    let recentOscs = ctx.oscillators.slice(oscStartIdx);
    let freqs = recentOscs.map((o) => o.frequency.events[0]?.value);
    assert.ok(freqs.includes(400), `vault_tumbler must include 400Hz decay, got ${freqs}`);
    assert.ok(freqs.includes(4200), `vault_tumbler must include 4200Hz torque snap, got ${freqs}`);
    const snapOsc = recentOscs.find((o) => o.frequency.events[0]?.value === 4200);
    const snapDurSec = snapOsc.stoppedAt - snapOsc.startedAt;
    assert.ok(snapDurSec >= 0.04 && snapDurSec <= 0.06, `4200Hz snap duration ~40ms, got ${snapDurSec}s`);

    // 2. equip_snap: 1850Hz metallic connector click + 2400Hz secondary lock
    oscStartIdx = ctx.oscillators.length;
    assert.equal(h.engine.play('equip_snap'), true);
    freqs = ctx.oscillators.slice(oscStartIdx).map((o) => o.frequency.events[0]?.value);
    assert.ok(freqs.includes(1850), `equip_snap must include 1850Hz click, got ${freqs}`);
    assert.ok(freqs.includes(2400), `equip_snap must include 2400Hz secondary lock, got ${freqs}`);

    // 3. step_fail: 220Hz 150ms thud
    oscStartIdx = ctx.oscillators.length;
    assert.equal(h.engine.play('step_fail'), true);
    recentOscs = ctx.oscillators.slice(oscStartIdx);
    assert.equal(recentOscs[0].frequency.events[0]?.value, 220, 'step_fail must fire calibrated 220Hz');
    const failDur = recentOscs[0].stoppedAt - recentOscs[0].startedAt;
    assert.ok(failDur >= 0.15 && failDur <= 0.17, `step_fail must be 150ms decay, got ${failDur}s`);

    // 4. jackpot_fanfare: 440Hz + 554Hz + 660Hz chord swell
    oscStartIdx = ctx.oscillators.length;
    assert.equal(h.engine.play('jackpot_fanfare'), true);
    freqs = ctx.oscillators.slice(oscStartIdx).map((o) => o.frequency.events[0]?.value);
    for (const expectedHz of [440, 554, 660]) {
      assert.ok(freqs.includes(expectedHz), `jackpot_fanfare must include ${expectedHz}Hz chord swell, got ${freqs}`);
    }

    // 5. Layered combat / gym / casino / stealth cues all synthesize oscillators + filtered noise bursts cleanly
    const noiseBefore = ctx.bufferSources.length;
    for (const cue of [
      'gunshot_pistol',
      'gunshot_rifle',
      'blade_slash',
      'heavy_bag_impact',
      'cash_payout',
      'roulette_tick',
      'era_breakthrough',
      'stealth_alert',
      'ui_nav'
    ]) {
      assert.equal(h.engine.play(cue), true, `Expected ${cue} to synthesize cleanly`);
    }
    assert.ok(ctx.bufferSources.length >= noiseBefore + 5, 'Weapon/slash/bag cues must layer filtered noise bursts');
  } finally {
    h.engine.destroy();
  }
});

test('v155 DSP Sidechain Ducking (-5dB for 180ms) & Hospital/Jail Low-Pass Muffle', () => {
  const h = createMockAudioEnvironment({ initialStorage: { zone_music_enabled: '0' } });
  try {
    h.engine.unlockFromGesture();
    const ctx = h.createdContexts[0];

    // Heavy combat/vault SFX must duck musicSubmixGain by -5dB (~0.5623) and recover over 180ms (0.18s)
    h.engine.play('gunshot_rifle');
    const diag1 = h.engine.diagnostics();
    assert.equal(diag1.duckCount, 1);
    assert.equal(diag1.lastDuckDb, -5);
    assert.equal(diag1.lastDuckDurationMs, 180);

    // Verify linearRamp events on musicSubmixGain (gains[2]: 0=sfxSubmix, 1=musicMaster, 2=musicSubmix)
    const musicSubmix = ctx.gains[2];
    const ramps = musicSubmix.gain.events.filter((e) => e.type === 'linearRamp');
    const expectedLinear = Math.pow(10, -5 / 20);
    assert.ok(ramps.some((r) => Math.abs(r.value - expectedLinear) < 1e-4), 'Music submix must ramp to -5dB (~0.5623)');
    assert.ok(ramps.some((r) => Math.abs(r.value - 1.0) < 1e-4 && Math.abs(r.time - (ctx.currentTime + 0.18)) < 1e-4), 'Music submix must recover to 1.0 at +180ms');

    // Hospital & Jail route transition must low-pass muffle the master BiquadFilterNode (680Hz) and restore on City (18000Hz)
    h.engine.setScreenRoute('hospital');
    assert.equal(h.engine.diagnostics().muffled, true);
    assert.equal(h.engine.diagnostics().lowpassFilterHz, 680);

    h.engine.setScreenRoute('jail');
    assert.equal(h.engine.diagnostics().muffled, true);
    assert.equal(h.engine.diagnostics().muffleReason, 'jail');

    h.engine.setScreenRoute('city');
    assert.equal(h.engine.diagnostics().muffled, false);
    assert.equal(h.engine.diagnostics().lowpassFilterHz, 18000);
  } finally {
    h.engine.destroy();
  }
});

test('v155 Adaptive Noir Soundtrack: 3 Route Stems (home_city, crimes, combat), 0.6s Crossfading & Stealth-Threat Scaling', () => {
  const h = createMockAudioEnvironment();
  try {
    h.engine.unlockFromGesture();
    const ctx = h.createdContexts[0];

    // Default screen 'home' -> Stem 1 ('home_city') + Pier 4 procedural rain loop
    assert.equal(h.engine.diagnostics().activeStem, 'home_city');
    assert.ok(ctx.bufferSources.some((s) => s.loop === true), 'Pier 4 procedural rain loop must be active on home_city stem');

    // Transition to 'crimes' -> Stem 2 ('crimes') with 0.6s vertical crossfade
    const stem2 = h.engine.setScreenRoute('crimes');
    assert.equal(stem2, 'crimes');
    assert.equal(h.engine.diagnostics().lastCrossfadeSec, 0.6);

    // Stem gains are gains[3] (home_city), gains[4] (crimes), gains[5] (combat)
    const crimesStemGain = ctx.gains[4];
    const crossfadeRamp = crimesStemGain.gain.events.find((e) => e.type === 'linearRamp' && e.value > 0.1);
    assert.ok(crossfadeRamp, 'Crimes stem gain must crossfade up');
    assert.ok(Math.abs(crossfadeRamp.time - (ctx.currentTime + 0.6)) < 1e-4, 'Vertical crossfade must be exactly 0.6s');

    // Stealth threat scaling via zone:tactical-event adjusts crimes stem cutoff
    h.engine.setStealthThreat(0.1);
    let filterCountBefore = ctx.filters.length;
    h.engine.stepMusicNow();
    const lowThreatCutoff = ctx.filters[filterCountBefore].frequency.value;

    h.mockWindow.dispatchEvent(new CustomEvent('zone:tactical-event', { detail: { threatTier: 'HUNTED' } }));
    assert.ok(h.engine.diagnostics().stealthThreat >= 0.9);
    filterCountBefore = ctx.filters.length;
    h.engine.stepMusicNow();
    const highThreatCutoff = ctx.filters[filterCountBefore].frequency.value;
    assert.ok(highThreatCutoff > lowThreatCutoff + 500, `High stealth threat cutoff (${highThreatCutoff}Hz) must exceed calm cutoff (${lowThreatCutoff}Hz)`);

    // Transition to 'attack' / 'faction' / 'missions' -> Stem 3 ('combat')
    for (const combatRoute of ['attack', 'faction', 'missions']) {
      assert.equal(h.engine.setScreenRoute(combatRoute), 'combat');
    }
    h.engine.stepMusicNow();
    assert.ok(h.engine.diagnostics().stemTransitionCount >= 2);
  } finally {
    h.engine.destroy();
  }
});

test('v155 Bidirectional Mute Persistence, Music Toggle, Mobile Haptics & Reduced-Motion Guard', () => {
  const h = createMockAudioEnvironment({ initialStorage: { zone_music_enabled: '0' } });
  try {
    h.engine.unlockFromGesture();

    // 1. Calibrated haptic patterns: 12ms light snap, [18, 24, 35] crit/breach, [40, 30, 40] damage warning
    h.vibrateCalls.length = 0;
    h.engine.play('ui_nav');
    assert.equal(h.vibrateCalls.at(-1), 12);

    h.engine.play('vault_tumbler');
    assert.deepEqual(h.vibrateCalls.at(-1), [18, 24, 35]);

    h.engine.play('stealth_alert');
    assert.deepEqual(h.vibrateCalls.at(-1), [40, 30, 40]);

    // 2. Reduced-motion guard: dataset.zoneReducedMotion === 'true' suppresses navigator.vibrate
    h.documentElement.dataset.zoneReducedMotion = 'true';
    const prevVibCount = h.vibrateCalls.length;
    h.engine.play('gunshot_pistol');
    assert.equal(h.vibrateCalls.length, prevVibCount, 'navigator.vibrate must be suppressed when data-zone-reduced-motion="true"');
    h.documentElement.dataset.zoneReducedMotion = 'false';

    // 3. Bidirectional Mute Sync with localStorage('zone_sfx_muted') and #zig-sound-toggle [data-zig-sfx]
    h.engine.setMuted(true);
    assert.equal(h.store.get('zone_sfx_muted'), '1');
    assert.equal(h.store.get('zig_muted'), '1');
    assert.equal(h.zigSoundBtn.getAttribute('data-zig-sfx'), 'off');
    assert.equal(h.engine.diagnostics().masterGainValue, 0);
    assert.equal(h.engine.play('cash_payout'), false, 'Audio synthesis must skip when muted');

    // External zone:mute-change event unmutes ZoneAudioHaptics bidirectionally
    h.mockWindow.dispatchEvent(new CustomEvent('zone:mute-change', { detail: { muted: false, source: 'external' } }));
    assert.equal(h.engine.isMuted(), false);
    assert.equal(h.store.get('zone_sfx_muted'), '0');
    assert.equal(h.zigSoundBtn.getAttribute('data-zig-sfx'), 'on');
    assert.equal(h.engine.diagnostics().masterGainValue, 0.7);

    // 4. Zero-friction window custom events: zone:3d-action & zone:audio-cue
    h.mockWindow.dispatchEvent(new CustomEvent('zone:3d-action', {
      detail: { stageKind: 'combat-arena', actionName: 'slash', payload: { crit: true } }
    }));
    assert.equal(h.engine.diagnostics().lastCue, 'blade_slash');

    h.mockWindow.dispatchEvent(new CustomEvent('zone:audio-cue', {
      detail: { cue: 'jackpot_fanfare', combo: 8 }
    }));
    assert.equal(h.engine.diagnostics().lastCue, 'jackpot_fanfare');

    // 5. Polyphony budget guard (MAX_ACTIVE_VOICES = 24) steals low-priority voices cleanly under burst load
    for (let i = 0; i < 32; i++) {
      h.engine.play(i % 2 === 0 ? 'roulette_tick' : 'gunshot_pistol');
    }
    const burstDiag = h.engine.diagnostics();
    assert.ok(burstDiag.activeVoiceCount <= burstDiag.maxVoices, `Voice count (${burstDiag.activeVoiceCount}) must never exceed budget (${burstDiag.maxVoices})`);
    assert.equal(burstDiag.maxVoices, 24);
  } finally {
    h.engine.destroy();
  }
});


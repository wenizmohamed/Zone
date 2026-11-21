import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GRAPHICS_PRESETS,
  DynamicResScaler,
  ZoneObjectPool,
  createZoneEcs3DRuntime,
} from '../assets/ui/zone-ecs-3d-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createMockRendererTracker() {
  let createdRenderers = 0;
  const createRenderer = () => {
    createdRenderers++;
    const domElement = {
      width: 220,
      height: 180,
      style: {},
      classList: { add() {} },
      addEventListener() {},
    };
    return {
      domElement,
      shadowMap: { enabled: true, type: 0, needsUpdate: false },
      info: { render: { calls: 16, triangles: 1420 } },
      setPixelRatio() {},
      setClearColor() {},
      setSize(w, h) {
        domElement.width = w;
        domElement.height = h;
      },
      render() {},
      dispose() {},
    };
  };
  return {
    createRenderer,
    getCount: () => createdRenderers,
  };
}

function makeMockStage(kind = 'safehouse-empire', width = 600, height = 240) {
  const stageCanvas = {
    className: 'z3d-stage-webgl-canvas',
    width,
    height,
    style: {},
    addEventListener() {},
    getContext: () => ({ drawImage() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
  };
  return {
    tagName: 'DIV',
    isConnected: true,
    firstChild: null,
    stageCanvas,
    getAttribute: (k) => (k === 'data-z3d-stage' ? kind : '1'),
    querySelector: (sel) => (sel.includes('z3d-stage-webgl-canvas') ? stageCanvas : {}),
    appendChild() {},
    insertBefore() {},
    getBoundingClientRect: () => ({ top: 20, bottom: 20 + height, width, height }),
  };
}

test('v159 DynamicResScaler: downscales DPR on 28ms slow frames (to min 0.60), respects 500ms hysteresis cooldown, and upscales on 11ms fast frames', () => {
  const scaler = new DynamicResScaler({
    minDpr: 0.60,
    presetCap: 1.35,
    dynamicResAuto: true,
    cooldownMs: 500,
    stepDown: 0.15,
    stepUp: 0.15,
  });

  assert.equal(scaler.currentDpr, 1.35);
  assert.equal(scaler.minDpr, 0.60);

  // First slow 28ms frame at t=1000ms crosses 20.5ms threshold and triggers initial downscale (1.35 -> 1.20)
  const r1 = scaler.sampleFrame(28, 1000);
  assert.ok(r1.frameMsEma > 20.5, `Expected frameMsEma > 20.5 on 28ms frame, got ${r1.frameMsEma}`);
  assert.equal(r1.action, 'downscale');
  assert.equal(scaler.currentDpr, 1.20);

  // Within 500ms hysteresis window (t=1100..1450ms), DPR MUST NOT thrash despite continued 28ms frames
  for (const t of [1100, 1250, 1400, 1490]) {
    const rHold = scaler.sampleFrame(28, t);
    assert.equal(rHold.action, 'hold', `Hysteresis must hold DPR at t=${t}ms (< 500ms since last change)`);
    assert.equal(scaler.currentDpr, 1.20);
  }

  // At t=1500ms (exact 500ms cooldown elapsed), next 28ms frame steps DPR down again (1.20 -> 1.05)
  const r2 = scaler.sampleFrame(28, 1500);
  assert.equal(r2.action, 'downscale');
  assert.equal(scaler.currentDpr, 1.05);

  // Continue slow 28ms frames across 500ms intervals until clamped at minDpr = 0.60
  scaler.sampleFrame(28, 2000);
  assert.equal(scaler.currentDpr, 0.90);
  scaler.sampleFrame(28, 2500);
  assert.equal(scaler.currentDpr, 0.75);
  scaler.sampleFrame(28, 3000);
  assert.equal(scaler.currentDpr, 0.60);
  scaler.sampleFrame(28, 3600);
  assert.equal(scaler.currentDpr, 0.60, 'DPR must never drop below minDpr (0.60)');

  // Feed fast 11ms frames: EMA drops < 14.5ms and upscales cleanly in 500ms hysteresis steps back to presetCap (1.35)
  scaler.sampleFrame(11, 3700);
  scaler.sampleFrame(11, 3800);
  assert.ok(scaler.frameMsEma < 14.5, `Expected frameMsEma < 14.5 on 11ms frames, got ${scaler.frameMsEma}`);
  // Still inside 500ms cooldown from t=3000ms? No, 3800 - 3000 = 800ms >= 500ms!
  assert.equal(scaler.currentDpr, 0.75);

  // Hold during 500ms window (t=4000ms)
  const upHold = scaler.sampleFrame(11, 4000);
  assert.equal(upHold.action, 'hold');
  assert.equal(scaler.currentDpr, 0.75);

  // Step up every >=500ms up to presetCap 1.35
  scaler.sampleFrame(11, 4300);
  assert.equal(scaler.currentDpr, 0.90);
  scaler.sampleFrame(11, 4800);
  assert.equal(scaler.currentDpr, 1.05);
  scaler.sampleFrame(11, 5300);
  assert.equal(scaler.currentDpr, 1.20);
  scaler.sampleFrame(11, 5800);
  assert.equal(scaler.currentDpr, 1.35);
  scaler.sampleFrame(11, 6400);
  assert.equal(scaler.currentDpr, 1.35, 'DPR must never exceed presetCap (1.35)');
});

test('v159 Runtime Live Graphics Quality Presets (low/medium/high/ultra), zone:settings-changed Hook, Diagnostics Telemetry & WebGL Context Gate', () => {
  const prevWin = globalThis.window;
  const listeners = new Map();
  const mockWin = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 2.0,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    dispatchEvent(ev) {
      const set = listeners.get(ev.type);
      if (set) {
        for (const fn of set) fn(ev);
      }
      return true;
    },
  };
  globalThis.window = mockWin;

  try {
    const tracker = createMockRendererTracker();
    const runtime = createZoneEcs3DRuntime({ createRenderer: tracker.createRenderer, window: mockWin });
    const stageEl = makeMockStage('safehouse-empire', 600, 240);
    runtime.scan({
      querySelectorAll: (sel) => (sel.includes('data-z3d-stage') ? [stageEl] : []),
    });

    // Verify all 4 presets via setGraphicsConfig
    const expectedPresets = [
      { preset: 'low', dprCap: 0.75, particleScale: 0.25, shadowsEnabled: false },
      { preset: 'medium', dprCap: 1.0, particleScale: 0.60, shadowsEnabled: false },
      { preset: 'high', dprCap: 1.35, particleScale: 1.0, shadowsEnabled: true },
      { preset: 'ultra', dprCap: 1.5, particleScale: 1.25, shadowsEnabled: true },
    ];

    for (const exp of expectedPresets) {
      assert.deepEqual(
        {
          preset: GRAPHICS_PRESETS[exp.preset].preset,
          dprCap: GRAPHICS_PRESETS[exp.preset].dprCap,
          particleScale: GRAPHICS_PRESETS[exp.preset].particleScale,
          shadowsEnabled: GRAPHICS_PRESETS[exp.preset].shadowsEnabled,
        },
        exp
      );

      const applied = runtime.setGraphicsConfig({ preset: exp.preset });
      assert.equal(applied.preset, exp.preset);
      assert.equal(applied.dprCap, exp.dprCap);
      assert.equal(applied.currentDpr, exp.dprCap);
      assert.equal(applied.particleScale, exp.particleScale);
      assert.equal(applied.shadowsEnabled, exp.shadowsEnabled);

      const diag = runtime.diagnostics();
      assert.equal(diag.graphicsPreset, exp.preset);
      assert.equal(diag.currentDpr, exp.dprCap);
      assert.equal(diag.particleScale, exp.particleScale);
      assert.equal(diag.shadowsEnabled, exp.shadowsEnabled);
      assert.equal(typeof diag.fps, 'number');
      assert.equal(typeof diag.frameMsEma, 'number');
      assert.equal(runtime.sharedRenderer.shadowMap.enabled, exp.shadowsEnabled);
    }

    // Verify live window 'zone:settings-changed' event updates the 3D engine immediately
    for (const exp of expectedPresets) {
      mockWin.dispatchEvent({
        type: 'zone:settings-changed',
        detail: { graphicsPreset: exp.preset, dynamicResAuto: true },
      });
      const diag = runtime.diagnostics();
      assert.equal(diag.graphicsPreset, exp.preset);
      assert.equal(diag.currentDpr, exp.dprCap);
      assert.equal(diag.particleScale, exp.particleScale);
      assert.equal(diag.shadowsEnabled, exp.shadowsEnabled);
    }

    // Verify runtime world.step(0.028) downscales canvas resolution and world.step(0.011) upscales it
    runtime.setGraphicsConfig({ preset: 'high', dynamicResAuto: true });
    assert.equal(runtime.diagnostics().currentDpr, 1.35);

    // Step 25 slow frames of 28ms (700ms simulated time -> initial downscale + 1 post-cooldown downscale)
    for (let i = 0; i < 25; i++) {
      runtime.world.step(0.028);
    }
    const slowDiag = runtime.diagnostics();
    assert.ok(slowDiag.frameMsEma > 20.5, `Expected slow frameMsEma > 20.5, got ${slowDiag.frameMsEma}`);
    assert.ok(slowDiag.currentDpr < 1.35, `Expected currentDpr < 1.35 after 28ms slow frames, got ${slowDiag.currentDpr}`);
    assert.equal(stageEl.stageCanvas.width, Math.floor(600 * slowDiag.currentDpr));

    // Step 120 fast frames of 11ms (1320ms simulated time -> upscales back to 1.35)
    for (let i = 0; i < 120; i++) {
      runtime.world.step(0.011);
    }
    const fastDiag = runtime.diagnostics();
    assert.ok(fastDiag.frameMsEma < 14.5, `Expected fast frameMsEma < 14.5, got ${fastDiag.frameMsEma}`);
    assert.equal(fastDiag.currentDpr, 1.35);
    assert.equal(stageEl.stageCanvas.width, Math.floor(600 * 1.35));

    // Strictly 1 WebGL context preserved throughout all resizes & preset switches
    assert.equal(tracker.getCount(), 1);
    assert.equal(fastDiag.webglContexts, 1);
  } finally {
    globalThis.window = prevWin;
  }
});

test('v159 ZoneObjectPool & Launch-Readiness / Multiplayer-Readiness Gate', () => {
  const pool = new ZoneObjectPool({
    prewarm: 4,
    maxCapacity: 6,
    exhaustionPolicy: 'drop',
    create: () => ({ x: 0, y: 0, active: false }),
    reset: (obj) => {
      obj.x = 0;
      obj.y = 0;
      obj.active = false;
    },
    onAcquire: (obj) => {
      obj.active = true;
    },
  });

  assert.equal(pool.stats().available, 4);
  const a = pool.acquire();
  a.x = 42;
  assert.equal(a.active, true);
  assert.equal(pool.stats().inUse, 1);

  assert.equal(pool.release(a), true);
  assert.equal(a.x, 0, 'Reset contract must zero pooled object fields on release');
  assert.equal(a.active, false);
  assert.equal(pool.release(a), false, 'Double-release guard must reject duplicate release');
  assert.equal(pool.stats().doubleReleaseDrops, 1);

  const engineAbs = resolve(root, 'assets/ui/zone-ecs-3d-engine.mjs');
  assert.ok(existsSync(engineAbs));
  const src = readFileSync(engineAbs, 'utf8');
  assert.ok(!/https?:\/\//i.test(src), 'Zero external CDN URLs permitted in zone-ecs-3d-engine.mjs');
  execFileSync(process.execPath, ['--check', engineAbs]);
});

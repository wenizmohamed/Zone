import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PARTICLE_PRESETS,
  DECAL_PRESETS,
  SCREEN_FX_KINDS,
  computeParticleBudgetScale,
  ZoneGpuBudgetGovernor,
  ZoneParticlePool,
  RibbonTrail,
  ZoneDecalPool,
  createSecurityLaserGrid3D,
  triggerScreenFx,
  clearScreenFx,
} from '../assets/ui/zone-vfx-particles.mjs';

import {
  THREE,
  SYSTEM_ORDER,
  COMPONENTS,
  ZoneEcsWorld,
  buildStageScene3D,
  createZoneEcs3DRuntime,
} from '../assets/ui/zone-ecs-3d-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('v155 Static & Shader Gate: local Three.js r184 only, zero external URLs, balanced CSS & valid GLSL chunks', () => {
  for (const rel of [
    'assets/ui/zone-vfx-particles.mjs',
    'assets/ui/zone-ecs-3d-engine.mjs',
    'assets/ui/zone-ecs-3d.css',
  ]) {
    const abs = resolve(root, rel);
    assert.ok(existsSync(abs), `Missing owned file: ${rel}`);
    assert.ok(statSync(abs).size > 800, `Unexpectedly small file: ${rel}`);
    const src = readUtf8(rel);
    assert.ok(!/https?:\/\//i.test(src), `Forbidden external CDN/URL in ${rel}`);
  }

  const vfxSrc = readUtf8('assets/ui/zone-vfx-particles.mjs');
  assert.ok(vfxSrc.includes('../../lib/three184/three.module.js'), 'zone-vfx-particles.mjs must import local vendored Three.js r184');
  assert.ok(vfxSrc.includes('#include <tonemapping_fragment>'), 'Custom GLSL fragment shaders must include <tonemapping_fragment>');
  assert.ok(vfxSrc.includes('#include <colorspace_fragment>'), 'Custom GLSL fragment shaders must include <colorspace_fragment>');

  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-vfx-particles.mjs')]);
  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-ecs-3d-engine.mjs')]);

  const cssSrc = readUtf8('assets/ui/zone-ecs-3d.css');
  let braces = 0;
  for (const ch of cssSrc) {
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    assert.ok(braces >= 0, 'Unbalanced closing brace in zone-ecs-3d.css');
  }
  assert.equal(braces, 0, 'Unclosed CSS brace in zone-ecs-3d.css');
  for (const requiredRule of [
    '.z3d-screen-fx-root',
    '.z3d-screen-fx-layer--crit-flash',
    '.z3d-screen-fx-layer--low-hp',
    '.z3d-screen-fx-layer--stealth-alert',
    'html[data-zone-reduced-motion="true"]',
  ]) {
    assert.ok(cssSrc.includes(requiredRule), `Missing Screen FX CSS rule: ${requiredRule}`);
  }
});

test('v155 Zero-GC Float32Array ZoneParticlePool: all 7 Syndicate presets, swap-remove lifecycle & ground ripples', () => {
  const pool = new ZoneParticlePool({ maxParticles: 256, viewportWidth: 1280 });
  assert.ok(pool.px instanceof Float32Array);
  assert.ok(pool.instPosRotBuf instanceof Float32Array);
  assert.ok(pool.mesh.isInstancedMesh);
  assert.equal(pool.mesh.frustumCulled, false);
  assert.equal(pool.mesh.count, 0);

  const requiredPresets = [
    'pier_rain',
    'muzzle_flash',
    'shell_brass',
    'spark_burst',
    'thermal_sparks',
    'chalk_burst',
    'gold_jackpot',
  ];

  for (const preset of requiredPresets) {
    assert.ok(Object.hasOwn(PARTICLE_PRESETS, preset), `Missing particle preset: ${preset}`);
    pool.clear();
    const spawned = pool.emit(preset, { x: 0, y: 1.0, z: 0, viewportWidth: 1280, reducedMotion: false });
    assert.ok(spawned > 0, `Preset ${preset} must spawn particles`);
    assert.ok(pool.mesh.count >= spawned, `InstancedMesh.count must match active particles for ${preset}`);
    assert.equal(pool.mesh.visible, true);

    for (let f = 0; f < 30; f++) {
      pool.update(0.06, false);
    }
  }

  pool.clear();
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.mesh.count, 0);

  /* Continuous pier_rain emitter spawns falling streaks & ground ripple rings */
  pool.addContinuousEmitter('pier_rain', { ratePerSec: 60, x: 0, y: 0, z: 0 });
  for (let i = 0; i < 12; i++) pool.update(0.05, false);
  assert.ok(pool.activeCount > 0, 'Continuous pier_rain emitter must populate pool');

  /* Reduced motion immediately clears and suppresses active particle motion */
  pool.update(0.05, true);
  assert.equal(pool.activeCount, 0);
  pool.dispose();
});

test('v155 RibbonTrail (blade_ribbon), ZoneDecalPool (impact_decal) & GLSL Security Laser Grid (laser_grid)', () => {
  const trail = new RibbonTrail({ maxNodes: 20, lifetime: 0.3, width: 0.24 });
  assert.equal(trail.mesh.visible, false);

  assert.equal(trail.triggerSlashArc({ x: 0, y: 1.0, z: 0.2, viewportWidth: 1280, reducedMotion: false }), true);
  assert.equal(trail.mesh.visible, true);
  assert.ok(trail.activeNodes >= 2);

  trail.update(0.1, false);
  assert.ok(trail.geometry.drawRange.count >= 6);

  for (let i = 0; i < 12; i++) trail.update(0.05, false);
  assert.equal(trail.activeNodes, 0);
  assert.equal(trail.mesh.visible, false, 'Expired RibbonTrail must hide mesh for 0 draw calls');
  trail.dispose();

  const decals = new ZoneDecalPool({ maxDecals: 16 });
  assert.equal(decals.material.polygonOffset, true, 'Decal material must enable polygonOffset against floor z-fighting');
  for (const dKind of Object.keys(DECAL_PRESETS)) {
    decals.spawnDecal(dKind, 0.5, -0.4);
  }
  assert.equal(decals.activeCount, Object.keys(DECAL_PRESETS).length);
  assert.equal(decals.mesh.count, decals.activeCount);
  for (let i = 0; i < 35; i++) decals.update(0.1);
  assert.equal(decals.activeCount, 0);
  decals.dispose();

  const laser = createSecurityLaserGrid3D();
  assert.ok(laser.group.isGroup);
  assert.equal(laser.uniforms.uTime.value, 0);
  laser.pulseAlert(0.9);
  assert.ok(laser.uniforms.uAlert.value >= 0.9);
  laser.update(0.2, false);
  assert.ok(laser.uniforms.uTime.value > 0.19);
  assert.ok(laser.uniforms.uAlert.value < 0.9);
  laser.dispose();
});

test('v155 Mobile GPU/LOD Budget Governor: 50% particle scale on <= 640px & stage draw-call cap', () => {
  assert.equal(computeParticleBudgetScale({ viewportWidth: 1280, reducedMotion: false }), 1.0);
  assert.equal(computeParticleBudgetScale({ viewportWidth: 640, reducedMotion: false }), 0.5);
  assert.equal(computeParticleBudgetScale({ viewportWidth: 390, reducedMotion: false }), 0.5);
  assert.equal(computeParticleBudgetScale({ viewportWidth: 390, reducedMotion: true }), 0);

  const desktopPool = new ZoneParticlePool({ viewportWidth: 1280 });
  const mobilePool = new ZoneParticlePool({ viewportWidth: 390 });
  const nDesktop = desktopPool.emit('gold_jackpot', { count: 40, reducedMotion: false });
  const nMobile = mobilePool.emit('gold_jackpot', { count: 40, reducedMotion: false });
  assert.equal(nDesktop, 40);
  assert.equal(nMobile, 20, 'Mobile <= 640px must auto-scale particle count to exact 50%');
  desktopPool.dispose();
  mobilePool.dispose();

  const world = new ZoneEcsWorld();
  const stage = buildStageScene3D('safehouse-empire', world, { headless: true, viewportWidth: 390 });
  const gov = new ZoneGpuBudgetGovernor({ viewportWidth: 390, mobileMaxDrawCalls: 50 });
  assert.equal(gov.isMobile, true);
  assert.equal(gov.particleScale, 0.5);
  const res = gov.evaluateDrawCalls(92, stage);
  assert.equal(res.overBudget, true);
  assert.equal(res.cappedDrawCalls, 50);
  assert.equal(stage.refs.lights.key.shadow.autoUpdate, false, 'Governor must freeze static shadow map when draw calls exceed budget');
  stage.dispose();
});

test('v155 Plug-and-Play Rigged Operative Integration, zone:3d-action Window Events, Screen FX & Reduced Motion', () => {
  assert.ok(SYSTEM_ORDER.includes('ParticleTrailSystem'));
  assert.ok(COMPONENTS.RIGGED_OPERATIVE > 0);

  const prevRigGlobal = globalThis.__ZoneRiggedOperative;
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;

  const rigCalls = [];
  const actionEvents = [];

  const mockLayers = new Map();
  const makeClassList = () => {
    const s = new Set();
    return {
      add: (...cls) => cls.forEach((c) => s.add(c)),
      remove: (...cls) => cls.forEach((c) => s.delete(c)),
      contains: (c) => s.has(c),
    };
  };

  const mockRootEl = {
    id: 'z3d-screen-fx-root',
    className: 'z3d-screen-fx-root',
    setAttribute() {},
    appendChild(child) {
      mockLayers.set(child.fxKind, child);
    },
    querySelector(sel) {
      for (const [k, layer] of mockLayers.entries()) {
        if (sel.includes(k)) return layer;
      }
      return null;
    },
    querySelectorAll() {
      return [...mockLayers.values()];
    },
  };

  const mockDoc = {
    documentElement: { dataset: { zoneReducedMotion: 'false' }, dir: 'ltr', lang: 'en' },
    body: {
      appendChild() {},
      querySelector: (sel) => (sel === '#z3d-screen-fx-root' && mockLayers.size ? mockRootEl : null),
    },
    getElementById: (id) => (id === 'z3d-screen-fx-root' && mockLayers.size ? mockRootEl : null),
    createElement(tag) {
      if (mockLayers.size === 0 && tag === 'div') {
        /* First call builds root, next 3 build layers */
      }
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        fxKind: '',
        classList: makeClassList(),
        setAttribute(k, v) { if (k === 'data-z3d-screen-fx') this.fxKind = v; },
        appendChild(c) { mockLayers.set(c.fxKind, c); },
        querySelector: mockRootEl.querySelector,
        querySelectorAll: mockRootEl.querySelectorAll,
      };
      return el;
    },
  };

  /* Ensure getElementById returns created root once appended */
  let appendedRoot = null;
  mockDoc.body.appendChild = (el) => { appendedRoot = el; };
  mockDoc.getElementById = (id) => (id === 'z3d-screen-fx-root' ? appendedRoot : null);
  mockDoc.body.querySelector = (sel) => (sel === '#z3d-screen-fx-root' ? appendedRoot : null);

  globalThis.document = mockDoc;
  globalThis.window = {
    innerWidth: 1280,
    dispatchEvent(ev) {
      if (ev && ev.type === 'zone:3d-action') {
        actionEvents.push(ev.detail);
      }
      return true;
    },
  };

  globalThis.__ZoneRiggedOperative = {
    createRiggedOperative3D(THREE_REF, opts = {}) {
      const grp = new THREE_REF.Group();
      const bodyMesh = new THREE_REF.Mesh(
        new THREE_REF.BoxGeometry(0.4, 1.2, 0.25),
        new THREE_REF.MeshStandardMaterial({ color: 0x334155 })
      );
      grp.add(bodyMesh);
      const rigRecord = {
        role: opts.role,
        outfit: opts.outfit || 'street',
        currentClip: 'idle_breathe',
        updates: 0,
        playState(clipName) {
          this.currentClip = clipName;
          rigCalls.push({ op: 'playState', clipName, role: this.role });
        },
        setOutfit(nextOutfit) {
          this.outfit = nextOutfit;
          rigCalls.push({ op: 'setOutfit', outfit: nextOutfit, role: this.role });
        },
        attachProp(prop) {
          grp.add(prop);
          rigCalls.push({ op: 'attachProp', role: this.role });
        },
        update(dt) {
          this.updates += dt;
        },
        dispose() {
          rigCalls.push({ op: 'dispose', role: this.role });
        },
      };
      grp.userData.z3dRig = rigRecord;
      return grp;
    },
  };

  try {
    const world = new ZoneEcsWorld();
    const combat = buildStageScene3D('combat-arena', world, { headless: false });
    const turntable = buildStageScene3D('character-turntable', world, { outfit: 'street', headless: false });
    const heist = buildStageScene3D('heist-breach', world, { headless: false });
    const gym = buildStageScene3D('gym-ironpit', world, { headless: false });

    /* Verify rigged operatives step on world.step() when reducedMotion is false */
    world.step(0.05);
    const playerRig = world.riggedCache[combat.refs.playerEid][0];
    assert.ok(playerRig.updates > 0.04, 'z3dRig.update(scaledDt) must step during ECS world.step()');

    /* Verify reducedMotion freezes z3dRig.update(scaledDt) */
    const prevUpdates = playerRig.updates;
    mockDoc.documentElement.dataset.zoneReducedMotion = 'true';
    world.step(0.05);
    assert.equal(playerRig.updates, prevUpdates, 'z3dRig.update must pause when data-zone-reduced-motion="true"');
    mockDoc.documentElement.dataset.zoneReducedMotion = 'false';

    /* Verify triggerAction & updateState drive playState/setOutfit AND emit zone:3d-action */
    combat.triggerAction('slash', { weaponCat: 'melee' });
    combat.triggerAction('fire', {});
    combat.triggerAction('hit', { target: 'player' });
    heist.triggerAction('crack', {});
    gym.triggerAction('punch', { stat: 'str' });
    turntable.updateState({ outfit: 'suit' });

    const playedClips = rigCalls.filter((c) => c.op === 'playState').map((c) => c.clipName);
    for (const expectedClip of ['melee_slash', 'recoil_fire', 'hit_react', 'vault_crack', 'heavy_bag_hook']) {
      assert.ok(playedClips.includes(expectedClip), `Expected z3dRig.playState('${expectedClip}') to fire, got ${playedClips.join(',')}`);
    }
    assert.ok(rigCalls.some((c) => c.op === 'setOutfit' && c.outfit === 'suit'), 'Expected z3dRig.setOutfit("suit") to fire');

    const emittedActions = actionEvents.map((e) => `${e.stageKind}:${e.actionName}`);
    for (const expectedEv of [
      'combat-arena:slash',
      'combat-arena:fire',
      'combat-arena:hit',
      'heist-breach:crack',
      'gym-ironpit:punch',
      'character-turntable:outfit',
    ]) {
      assert.ok(emittedActions.includes(expectedEv), `Missing window zone:3d-action event ${expectedEv}`);
    }

    /* Verify Screen-Space FX helper & reduced-motion guard */
    for (const fxKind of SCREEN_FX_KINDS) {
      const fxRes = triggerScreenFx(fxKind, { document: mockDoc, durationMs: 0 });
      assert.equal(fxRes.triggered, true);
      assert.equal(fxRes.kind, fxKind);
    }
    mockDoc.documentElement.dataset.zoneReducedMotion = 'true';
    const suppressedCrit = triggerScreenFx('crit-flash', { document: mockDoc, durationMs: 0 });
    assert.equal(suppressedCrit.triggered, false, 'crit-flash strobe must be suppressed when reducedMotion=true');
    clearScreenFx(mockDoc);

    /* Verify single-context WebGL discipline remains strictly 1 */
    let ctxCount = 0;
    const rt = createZoneEcs3DRuntime({
      createRenderer: () => {
        ctxCount++;
        return {
          domElement: { width: 220, height: 180, style: {}, addEventListener() {} },
          shadowMap: { enabled: false, type: 0 },
          info: { render: { calls: 18, triangles: 1600 } },
          setPixelRatio() {},
          setClearColor() {},
          setSize() {},
          render() {},
          dispose() {},
        };
      },
    });
    rt._ensureSharedRenderer();
    assert.equal(ctxCount, 1);
    assert.equal(rt.diagnostics().webglContexts, 1);

    combat.dispose();
    turntable.dispose();
    heist.dispose();
    gym.dispose();
    assert.equal(world.aliveCount, 0, 'All stage entities & VFX controllers must dispose cleanly');
  } finally {
    globalThis.__ZoneRiggedOperative = prevRigGlobal;
    globalThis.window = prevWin;
    globalThis.document = prevDoc;
  }
});

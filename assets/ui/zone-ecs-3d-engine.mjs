/* ==========================================================================
 * ZONE v153 - TRUE DATA-ORIENTED 3D ECS & SINGLE-CONTEXT SHARED WEBGL ENGINE
 * Exclusive Ownership: @ecs-3d-engine (assets/ui/zone-ecs-3d-engine.mjs)
 * Local Vendored Three.js r184 ONLY - ZERO External CDN - 1 Shared WebGL Ctx
 * ========================================================================== */

import * as THREE from '../../lib/three184/three.module.js';
import { OrbitControls } from '../../lib/three184/OrbitControls.js';
import { RoomEnvironment } from '../../lib/three184/RoomEnvironment.js';
import { OBJLoader } from '../../lib/three184/OBJLoader.js';
import { MTLLoader } from '../../lib/three184/MTLLoader.js';
import { GLTFLoader } from '../../lib/three184/GLTFLoader.js';
import {
  PARTICLE_PRESETS,
  DECAL_PRESETS,
  SCREEN_FX_KINDS,
  isReducedMotion,
  isMobileViewport,
  computeParticleBudgetScale,
  ZoneGpuBudgetGovernor,
  createSoftParticleShaderMaterial,
  ZoneParticlePool,
  RibbonTrail,
  ZoneDecalPool,
  createSecurityLaserGrid3D,
  createStageVfxController,
  triggerScreenFx,
  clearScreenFx,
} from './zone-vfx-particles.mjs';
import { dressStageEnvironment3D } from './zone-3d-environments.mjs?v=165';

export {
  THREE,
  OrbitControls,
  RoomEnvironment,
  OBJLoader,
  MTLLoader,
  GLTFLoader,
  PARTICLE_PRESETS,
  DECAL_PRESETS,
  SCREEN_FX_KINDS,
  isReducedMotion,
  isMobileViewport,
  computeParticleBudgetScale,
  ZoneGpuBudgetGovernor,
  createSoftParticleShaderMaterial,
  ZoneParticlePool,
  RibbonTrail,
  ZoneDecalPool,
  createSecurityLaserGrid3D,
  createStageVfxController,
  triggerScreenFx,
  clearScreenFx,
};

export const MAX_ENTITIES = 512;

export const HERO_ELONGATED_YAW = -Math.PI * 0.36;
export const HERO_ELONGATED_PITCH = 0.14;

export const COMPONENTS = Object.freeze({
  TRANSFORM: 1 << 0,
  VELOCITY: 1 << 1,
  TURNTABLE: 1 << 2,
  HOVER_FLOAT: 1 << 3,
  TRAUMA_SHAKE: 1 << 4,
  HIT_STOP: 1 << 5,
  FRESNEL_RIM: 1 << 6,
  PICKABLE: 1 << 7,
  STAGE_KINEMATICS: 1 << 8,
  PARTICLE_EMITTER: 1 << 9,
  RIGGED_OPERATIVE: 1 << 10,
});

export const SYSTEM_ORDER = Object.freeze([
  'InputRaycastSystem',
  'TurntableKinematicsSystem',
  'StageActionKinematicsSystem',
  'TraumaCameraSystem',
  'FresnelShaderSystem',
  'ParticleTrailSystem',
  'SharedWebGLRenderSystem',
]);

export const STAGE_KINDS = Object.freeze([
  'safehouse-empire',
  'heist-breach',
  'gym-ironpit',
  'combat-arena',
  'city-wheels-race',
  'casino-royale',
  'paperdoll-armory',
  'character-turntable',
]);

export const EUROPEAN_ROULETTE_ORDER = Object.freeze([
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]);

export const ROULETTE_RED_NUMBERS = Object.freeze([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const ROULETTE_RED_SET = new Set(ROULETTE_RED_NUMBERS);
const ANIM_LEVER_PULL = 99;
const ANIM_SLOT_REEL_TARGET = 100;
const ANIM_ROULETTE_RIDE = 101;
export const SLOT_REEL_SYMBOL_ORDER = Object.freeze([
  'DIAMOND',
  'SEVEN',
  'GOLD_BAR',
  'CROWN',
  'CHIP',
  'CHERRY',
]);

/* --------------------------------------------------------------------------
 * 0. GRAPHICS QUALITY PRESETS, DYNAMIC RESOLUTION SCALER & OBJECT POOL
 *    (Wave-3 Track 17: dynamic-res-scaler, three-best-practices,
 *     threejs-motion-performance, game-development-object-pool)
 * -------------------------------------------------------------------------- */
export const GRAPHICS_PRESETS = Object.freeze({
  low: Object.freeze({
    preset: 'low',
    dprCap: 0.75,
    particleScale: 0.25,
    shadowsEnabled: false,
    maxItemBlitsPerFrame: 2,
  }),
  medium: Object.freeze({
    preset: 'medium',
    dprCap: 1.0,
    particleScale: 0.60,
    shadowsEnabled: false,
    maxItemBlitsPerFrame: 4,
  }),
  high: Object.freeze({
    preset: 'high',
    dprCap: 1.35,
    particleScale: 1.0,
    shadowsEnabled: true,
    maxItemBlitsPerFrame: 6,
  }),
  ultra: Object.freeze({
    preset: 'ultra',
    dprCap: 1.5,
    particleScale: 1.25,
    shadowsEnabled: true,
    maxItemBlitsPerFrame: 8,
  }),
});

export class DynamicResScaler {
  constructor(opts = {}) {
    this.minDpr = typeof opts.minDpr === 'number' ? opts.minDpr : 0.60;
    this.presetCap = typeof opts.presetCap === 'number'
      ? opts.presetCap
      : (typeof opts.maxDpr === 'number' ? opts.maxDpr : GRAPHICS_PRESETS.high.dprCap);
    this.currentDpr = typeof opts.initialDpr === 'number'
      ? Math.max(this.minDpr, Math.min(this.presetCap, opts.initialDpr))
      : this.presetCap;
    this.dynamicResAuto = opts.dynamicResAuto !== undefined ? Boolean(opts.dynamicResAuto) : true;
    this.downThresholdMs = typeof opts.downThresholdMs === 'number' ? opts.downThresholdMs : 20.5;
    this.upThresholdMs = typeof opts.upThresholdMs === 'number' ? opts.upThresholdMs : 14.5;
    this.cooldownMs = typeof opts.cooldownMs === 'number' ? opts.cooldownMs : 500;
    this.stepDown = typeof opts.stepDown === 'number' ? opts.stepDown : 0.15;
    this.stepUp = typeof opts.stepUp === 'number' ? opts.stepUp : 0.15;
    this.emaAlpha = typeof opts.emaAlpha === 'number' ? opts.emaAlpha : 0.55;
    this.frameMsEma = typeof opts.initialFrameMs === 'number' ? opts.initialFrameMs : 16.67;
    this.clockMs = 0;
    this._lastChangeMs = -Infinity;
    this.downscaleCount = 0;
    this.upscaleCount = 0;
    this.targetRefreshHz = typeof opts.targetRefreshHz === 'number' ? Math.max(0, opts.targetRefreshHz) : 0;
    this._frameRing = new Float32Array(60);
    this._frameRingIdx = 0;
    this._frameRingCount = 0;
  }

  get fps() {
    return Math.max(1, Math.min(240, Math.round(1000 / Math.max(1, this.frameMsEma))));
  }

  get recommendedFpsCap() {
    // Blur Busters G-Sync 101 rule (game-tuning): cap at refresh - 3 Hz on VRR displays
    return this.targetRefreshHz > 60 ? Math.max(58, Math.round(this.targetRefreshHz - 3)) : 0;
  }

  get onePercentLowFps() {
    const n = this._frameRingCount;
    if (n === 0) return this.fps;
    let worstMs = 0;
    for (let i = 0; i < n; i++) {
      if (this._frameRing[i] > worstMs) worstMs = this._frameRing[i];
    }
    return Math.max(1, Math.min(240, Math.round(1000 / Math.max(1, worstMs))));
  }

  get frameTimeVarianceMs() {
    const n = this._frameRingCount;
    if (n < 2) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += this._frameRing[i];
    const mean = sum / n;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const d = this._frameRing[i] - mean;
      sq += d * d;
    }
    return Number(Math.sqrt(sq / n).toFixed(2));
  }

  setPresetCap(nextCap, opts = {}) {
    if (typeof nextCap === 'number' && Number.isFinite(nextCap) && nextCap > 0) {
      this.presetCap = Math.max(this.minDpr, Number(nextCap.toFixed(2)));
    }
    if (opts.resetCurrent !== false || !this.dynamicResAuto) {
      this.currentDpr = this.presetCap;
    } else {
      this.currentDpr = Math.max(this.minDpr, Math.min(this.presetCap, this.currentDpr));
    }
    if (opts.resetCooldown !== false) {
      this._lastChangeMs = -Infinity;
    }
    return this.currentDpr;
  }

  sampleFrame(rawFrameTime, nowMs = undefined) {
    let frameMs = 16.67;
    if (typeof rawFrameTime === 'number' && Number.isFinite(rawFrameTime) && rawFrameTime > 0) {
      frameMs = rawFrameTime <= 0.5 ? rawFrameTime * 1000 : rawFrameTime;
    }
    frameMs = Math.max(1.0, Math.min(250.0, frameMs));

    if (typeof nowMs === 'number' && Number.isFinite(nowMs)) {
      this.clockMs = nowMs;
    } else {
      this.clockMs += frameMs;
    }

    this.frameMsEma = this.frameMsEma * (1 - this.emaAlpha) + frameMs * this.emaAlpha;
    this._frameRing[this._frameRingIdx] = frameMs;
    this._frameRingIdx = (this._frameRingIdx + 1) % 60;
    if (this._frameRingCount < 60) this._frameRingCount++;

    let action = 'hold';
    if (!this.dynamicResAuto) {
      this.currentDpr = this.presetCap;
      return {
        currentDpr: this.currentDpr,
        frameMsEma: this.frameMsEma,
        fps: this.fps,
        action,
      };
    }

    const elapsedSinceChange = this.clockMs - this._lastChangeMs;
    if (elapsedSinceChange >= this.cooldownMs) {
      if (this.frameMsEma > this.downThresholdMs && this.currentDpr > this.minDpr + 1e-4) {
        const nextDpr = Math.max(this.minDpr, Number((this.currentDpr - this.stepDown).toFixed(2)));
        if (nextDpr < this.currentDpr) {
          this.currentDpr = nextDpr;
          this._lastChangeMs = this.clockMs;
          this.downscaleCount++;
          action = 'downscale';
        }
      } else if (this.frameMsEma < this.upThresholdMs && this.currentDpr < this.presetCap - 1e-4) {
        const nextDpr = Math.min(this.presetCap, Number((this.currentDpr + this.stepUp).toFixed(2)));
        if (nextDpr > this.currentDpr) {
          this.currentDpr = nextDpr;
          this._lastChangeMs = this.clockMs;
          this.upscaleCount++;
          action = 'upscale';
        }
      }
    }

    return {
      currentDpr: this.currentDpr,
      frameMsEma: this.frameMsEma,
      fps: this.fps,
      action,
    };
  }

  update(rawFrameTime, nowMs = undefined) {
    return this.sampleFrame(rawFrameTime, nowMs);
  }
}

export class ZoneObjectPool {
  constructor(opts = {}) {
    this.createFn = typeof opts.create === 'function' ? opts.create : (() => ({}));
    this.resetFn = typeof opts.reset === 'function' ? opts.reset : null;
    this.onAcquireFn = typeof opts.onAcquire === 'function' ? opts.onAcquire : null;
    this.onReleaseFn = typeof opts.onRelease === 'function' ? opts.onRelease : null;
    this.maxCapacity = typeof opts.maxCapacity === 'number' && opts.maxCapacity > 0 ? opts.maxCapacity : 128;
    this.exhaustionPolicy = opts.exhaustionPolicy || 'expand';
    this._free = [];
    this._inUse = new Set();
    this._createdCount = 0;
    this._acquireCount = 0;
    this._releaseCount = 0;
    this._doubleReleaseDrops = 0;
    this._exhaustionCount = 0;
    if (typeof opts.prewarm === 'number' && opts.prewarm > 0) {
      this.prewarm(opts.prewarm);
    }
  }

  prewarm(count = 0) {
    const target = Math.min(this.maxCapacity, Math.max(0, count | 0));
    while (this._free.length + this._inUse.size < target) {
      const item = this.createFn();
      if (this.resetFn) this.resetFn(item);
      this._free.push(item);
      this._createdCount++;
    }
    return this._free.length;
  }

  acquire() {
    let item = null;
    if (this._free.length > 0) {
      item = this._free.pop();
    } else if (this._createdCount < this.maxCapacity || this.exhaustionPolicy === 'expand') {
      if (this._createdCount >= this.maxCapacity) this._exhaustionCount++;
      item = this.createFn();
      this._createdCount++;
    } else if (this.exhaustionPolicy === 'fallback') {
      this._exhaustionCount++;
      item = this.createFn();
    } else {
      this._exhaustionCount++;
      return null;
    }

    if (this.resetFn) this.resetFn(item);
    if (this.onAcquireFn) this.onAcquireFn(item);
    this._inUse.add(item);
    this._acquireCount++;
    return item;
  }

  get() {
    return this.acquire();
  }

  release(item) {
    if (!item || !this._inUse.has(item)) {
      this._doubleReleaseDrops++;
      return false;
    }
    this._inUse.delete(item);
    if (this.onReleaseFn) this.onReleaseFn(item);
    if (this.resetFn) this.resetFn(item);
    if (this._free.length < this.maxCapacity) {
      this._free.push(item);
    }
    this._releaseCount++;
    return true;
  }

  clear() {
    this._free.length = 0;
    this._inUse.clear();
  }

  stats() {
    return {
      available: this._free.length,
      inUse: this._inUse.size,
      created: this._createdCount,
      acquires: this._acquireCount,
      releases: this._releaseCount,
      doubleReleaseDrops: this._doubleReleaseDrops,
      exhaustions: this._exhaustionCount,
      maxCapacity: this.maxCapacity,
    };
  }
}

const ANIM_NONE = 0;
const ANIM_LUNGE = 1;
const ANIM_VAULT_OPEN = 2;
const ANIM_WHEEL_SPIN = 3;
const ANIM_DRIFT_ORBIT = 4;
const ANIM_ROULETTE_BALL = 5;
const ANIM_SLOT_REEL = 6;
const ANIM_BAG_SWING = 7;
const ANIM_BURST_POP = 8;

/* --------------------------------------------------------------------------
 * 1. CUSTOM GLSL ES FRESNEL SILHOUETTE RIM SHADER (onBeforeCompile)
 *    Shared program cache key avoids per-mesh shader compilation hitches.
 * -------------------------------------------------------------------------- */
export function applyFresnelRimShader(material, opts = {}) {
  if (!material || typeof material !== 'object') return material;
  const rimHex = opts.color !== undefined ? opts.color : 0x7dd3fc;
  const power = typeof opts.power === 'number' ? opts.power : 2.8;
  const intensity = typeof opts.intensity === 'number' ? opts.intensity : 0.48;
  const pulseHz = typeof opts.pulseHz === 'number' ? opts.pulseHz : 0.65;

  const uniforms = {
    uZ3dRimColor: { value: new THREE.Color(rimHex) },
    uZ3dRimPower: { value: power },
    uZ3dRimIntensity: { value: intensity },
    uZ3dRimTime: { value: 0 },
    uZ3dRimPulseHz: { value: pulseHz },
  };

  material.userData = material.userData || {};
  material.userData.z3dRimUniforms = uniforms;
  material.customProgramCacheKey = function z3dRimCacheKey() {
    return 'z3d-fresnel-rim-v153';
  };

  material.onBeforeCompile = function z3dOnBeforeCompile(shader) {
    shader.uniforms.uZ3dRimColor = uniforms.uZ3dRimColor;
    shader.uniforms.uZ3dRimPower = uniforms.uZ3dRimPower;
    shader.uniforms.uZ3dRimIntensity = uniforms.uZ3dRimIntensity;
    shader.uniforms.uZ3dRimTime = uniforms.uZ3dRimTime;
    shader.uniforms.uZ3dRimPulseHz = uniforms.uZ3dRimPulseHz;

    shader.fragmentShader =
      'uniform vec3 uZ3dRimColor;\n' +
      'uniform float uZ3dRimPower;\n' +
      'uniform float uZ3dRimIntensity;\n' +
      'uniform float uZ3dRimTime;\n' +
      'uniform float uZ3dRimPulseHz;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        [
          '{',
          '  vec3 z3dViewDir = normalize( vViewPosition );',
          '  vec3 z3dNorm = normalize( normal );',
          '  float z3dNdotV = clamp( dot( z3dNorm, z3dViewDir ), 0.0, 1.0 );',
          '  float z3dFresnel = pow( 1.0 - z3dNdotV, max( uZ3dRimPower, 0.5 ) );',
          '  float z3dPulse = 1.0 + 0.22 * sin( uZ3dRimTime * 6.2831853 * uZ3dRimPulseHz );',
          '  outgoingLight += uZ3dRimColor * ( z3dFresnel * uZ3dRimIntensity * z3dPulse );',
          '}',
          '#include <opaque_fragment>',
        ].join('\n')
      );
  };
  material.needsUpdate = true;
  return material;
}

function makePbr(color, roughness = 0.36, metalness = 0.65, rimOpts = null, extra = null) {
  const params = Object.assign({ color, roughness, metalness }, extra || {});
  const mat = extra && (extra.transmission || extra.clearcoat)
    ? new THREE.MeshPhysicalMaterial(params)
    : new THREE.MeshStandardMaterial(params);
  if (rimOpts !== false) {
    applyFresnelRimShader(mat, rimOpts || { color: 0x93c5fd, power: 3.0, intensity: 0.34, pulseHz: 0.5 });
  }
  return mat;
}

/* --------------------------------------------------------------------------
 * 2. DEFERRED ENTITY COMMAND BUFFER (ECB)
 * -------------------------------------------------------------------------- */
export class EntityCommandBuffer {
  constructor() {
    this._queue = [];
  }

  get length() {
    return this._queue.length;
  }

  spawn(setupFn = null) {
    this._queue.push({ op: 'spawn', setupFn });
  }

  despawn(eid) {
    this._queue.push({ op: 'despawn', eid: eid >>> 0 });
  }

  addComponent(eid, compBit, initFn = null) {
    this._queue.push({ op: 'add', eid: eid >>> 0, compBit: compBit >>> 0, initFn });
  }

  removeComponent(eid, compBit) {
    this._queue.push({ op: 'remove', eid: eid >>> 0, compBit: compBit >>> 0 });
  }

  flush(world) {
    if (this._queue.length === 0) return 0;
    const pending = this._queue.splice(0, this._queue.length);
    let applied = 0;
    for (let i = 0; i < pending.length; i++) {
      const cmd = pending[i];
      if (cmd.op === 'spawn') {
        const eid = world.spawnImmediate();
        if (eid >= 0 && typeof cmd.setupFn === 'function') {
          cmd.setupFn(eid, world);
        }
        applied++;
      } else if (cmd.op === 'despawn') {
        if (world.despawnImmediate(cmd.eid)) applied++;
      } else if (cmd.op === 'add') {
        if (world.isAlive(cmd.eid)) {
          world.stores.mask[cmd.eid] |= cmd.compBit;
          if (typeof cmd.initFn === 'function') cmd.initFn(cmd.eid, world);
          applied++;
        }
      } else if (cmd.op === 'remove') {
        if (world.isAlive(cmd.eid)) {
          world.stores.mask[cmd.eid] &= ~cmd.compBit;
          applied++;
        }
      }
    }
    return applied;
  }
}

/* --------------------------------------------------------------------------
 * 3. TRUE DATA-ORIENTED ECS WORLD (`ZoneEcsWorld`)
 *    Contiguous Float32Array / Uint32Array component stores (MAX_ENTITIES=512)
 * -------------------------------------------------------------------------- */
export class ZoneEcsWorld {
  constructor(opts = {}) {
    this.maxEntities = MAX_ENTITIES;
    this.ecb = new EntityCommandBuffer();
    this.freeIds = [];
    this.nextId = 0;
    this.aliveCount = 0;
    this.realElapsed = 0;
    this.scaledElapsed = 0;
    this.timeScale = 1.0;
    this.shakeStrength = typeof opts.shakeStrength === 'number' ? opts.shakeStrength : 1.0;

    this.stores = {
      alive: new Uint8Array(MAX_ENTITIES),
      mask: new Uint32Array(MAX_ENTITIES),
      generation: new Uint32Array(MAX_ENTITIES),
      Transform3D: new Float32Array(MAX_ENTITIES * 10),
      Velocity3D: new Float32Array(MAX_ENTITIES * 6),
      TurntableSpin: new Float32Array(MAX_ENTITIES * 4),
      HoverFloat: new Float32Array(MAX_ENTITIES * 4),
      TraumaShake: new Float32Array(MAX_ENTITIES * 8),
      CameraBasePose: new Float32Array(MAX_ENTITIES * 6),
      HitStopState: new Float32Array(MAX_ENTITIES * 4),
      HitStopIds: new Uint32Array(MAX_ENTITIES),
      FresnelRim: new Float32Array(MAX_ENTITIES * 6),
      InteractivePickable: new Uint32Array(MAX_ENTITIES * 4),
      StageActionKinematics: new Float32Array(MAX_ENTITIES * 8),
    };

    this.object3d = new Array(MAX_ENTITIES).fill(null);
    this.rimMaterials = new Array(MAX_ENTITIES).fill(null);
    this.riggedCache = new Array(MAX_ENTITIES).fill(null);
    this.stageVfxControllers = new Set();
    this.pickMeta = new Map();

    this._hitStopSeq = 0;
    this._activeHitStopId = 0;
    this._hitStopRemainingReal = 0;
    this._hitStopSlowScale = 1.0;

    this._pendingPointerEvents = [];
    this._renderHook = typeof opts.renderHook === 'function' ? opts.renderHook : null;
    this.lastSystemOrder = [];

    this.timer = typeof THREE.Timer === 'function' ? new THREE.Timer() : null;
    this._lastPerfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.timer && typeof document !== 'undefined' && typeof this.timer.connect === 'function') {
      try {
        this.timer.connect(document);
      } catch (_) { /* ignore */ }
    }

    this.schedule = [
      { name: 'InputRaycastSystem', fn: (dt, rdt) => this._sysInputRaycast(dt, rdt) },
      { name: 'TurntableKinematicsSystem', fn: (dt, rdt) => this._sysTurntableKinematics(dt, rdt) },
      { name: 'StageActionKinematicsSystem', fn: (dt, rdt) => this._sysStageActionKinematics(dt, rdt) },
      { name: 'TraumaCameraSystem', fn: (dt, rdt) => this._sysTraumaCamera(dt, rdt) },
      { name: 'FresnelShaderSystem', fn: (dt, rdt) => this._sysFresnelShader(dt, rdt) },
      { name: 'ParticleTrailSystem', fn: (dt, rdt) => this._sysParticleTrail(dt, rdt) },
      { name: 'SharedWebGLRenderSystem', fn: (dt, rdt) => this._sysSharedWebGLRender(dt, rdt) },
    ];
  }

  registerStageVfx(ctrl) {
    if (ctrl) this.stageVfxControllers.add(ctrl);
    return ctrl;
  }

  unregisterStageVfx(ctrl) {
    if (ctrl) this.stageVfxControllers.delete(ctrl);
  }

  spawnImmediate(object3d = null) {
    let eid = -1;
    if (this.freeIds.length > 0) {
      eid = this.freeIds.pop();
    } else if (this.nextId < MAX_ENTITIES) {
      eid = this.nextId++;
    } else {
      return -1;
    }

    this.stores.alive[eid] = 1;
    this.stores.mask[eid] = COMPONENTS.TRANSFORM;
    this.aliveCount++;

    const tOff = eid * 10;
    const T = this.stores.Transform3D;
    T[tOff + 0] = object3d ? object3d.position.x : 0;
    T[tOff + 1] = object3d ? object3d.position.y : 0;
    T[tOff + 2] = object3d ? object3d.position.z : 0;
    T[tOff + 3] = object3d ? object3d.rotation.x : 0;
    T[tOff + 4] = object3d ? object3d.rotation.y : 0;
    T[tOff + 5] = object3d ? object3d.rotation.z : 0;
    T[tOff + 6] = object3d ? object3d.scale.x : 1;
    T[tOff + 7] = object3d ? object3d.scale.y : 1;
    T[tOff + 8] = object3d ? object3d.scale.z : 1;
    T[tOff + 9] = 1;

    this.object3d[eid] = object3d || null;
    this.refreshEntityRimCache(eid);
    return eid;
  }

  refreshEntityRimCache(eid) {
    const object3d = this.object3d[eid];
    if (!object3d) {
      this.rimMaterials[eid] = null;
      this.riggedCache[eid] = null;
      return;
    }
    object3d.userData = object3d.userData || {};
    object3d.userData.z3dEid = eid;
    const mats = [];
    const rigs = [];
    object3d.traverse((node) => {
      if (node.userData && node.userData.z3dRig && typeof node.userData.z3dRig.update === 'function') {
        rigs.push(node.userData.z3dRig);
      }
      if (!node.isMesh || !node.material) return;
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].userData && list[i].userData.z3dRimUniforms) {
          mats.push(list[i]);
        }
      }
    });
    this.rimMaterials[eid] = mats.length ? mats : null;
    this.riggedCache[eid] = rigs.length ? rigs : null;
    if (rigs.length && this.stores.alive[eid]) {
      this.stores.mask[eid] |= COMPONENTS.RIGGED_OPERATIVE;
    }
  }

  despawnImmediate(eid) {
    if (eid < 0 || eid >= MAX_ENTITIES || this.stores.alive[eid] === 0) return false;
    this.stores.alive[eid] = 0;
    this.stores.mask[eid] = 0;
    this.stores.generation[eid]++;
    this.object3d[eid] = null;
    this.rimMaterials[eid] = null;
    this.riggedCache[eid] = null;
    this.pickMeta.delete(eid);
    this.freeIds.push(eid);
    this.aliveCount = Math.max(0, this.aliveCount - 1);
    return true;
  }

  isAlive(eid) {
    return eid >= 0 && eid < MAX_ENTITIES && this.stores.alive[eid] === 1;
  }

  setVelocity(eid, vx = 0, vy = 0, vz = 0, avx = 0, avy = 0, avz = 0) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.VELOCITY;
    const o = eid * 6;
    const V = this.stores.Velocity3D;
    V[o] = vx; V[o + 1] = vy; V[o + 2] = vz;
    V[o + 3] = avx; V[o + 4] = avy; V[o + 5] = avz;
  }

  setTurntable(eid, speedY = 0.85, damping = 6.0) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.TURNTABLE;
    const o = eid * 4;
    const S = this.stores.TurntableSpin;
    S[o] = speedY;
    S[o + 1] = 0;
    S[o + 2] = 0;
    S[o + 3] = damping;
  }

  setHoverFloat(eid, baseY = 0, amplitude = 0.08, frequency = 1.4, phase = 0) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.HOVER_FLOAT;
    const o = eid * 4;
    const H = this.stores.HoverFloat;
    H[o] = baseY;
    H[o + 1] = amplitude;
    H[o + 2] = frequency;
    H[o + 3] = phase;
  }

  setTraumaCamera(eid, opts = {}) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.TRAUMA_SHAKE;
    const o = eid * 8;
    const TS = this.stores.TraumaShake;
    TS[o + 0] = 0;
    TS[o + 1] = typeof opts.decay === 'number' ? opts.decay : 1.35;
    TS[o + 2] = typeof opts.maxOffsetX === 'number' ? opts.maxOffsetX : 0.42;
    TS[o + 3] = typeof opts.maxOffsetY === 'number' ? opts.maxOffsetY : 0.28;
    TS[o + 4] = typeof opts.maxRoll === 'number' ? opts.maxRoll : 0.055;
    TS[o + 5] = 0;
    TS[o + 6] = typeof opts.strength === 'number' ? opts.strength : 1.0;
    TS[o + 7] = 1;

    const b = eid * 6;
    const CB = this.stores.CameraBasePose;
    const cam = this.object3d[eid];
    CB[b + 0] = opts.baseX !== undefined ? opts.baseX : (cam ? cam.position.x : 0);
    CB[b + 1] = opts.baseY !== undefined ? opts.baseY : (cam ? cam.position.y : 2);
    CB[b + 2] = opts.baseZ !== undefined ? opts.baseZ : (cam ? cam.position.z : 5);
    CB[b + 3] = opts.targetX !== undefined ? opts.targetX : 0;
    CB[b + 4] = opts.targetY !== undefined ? opts.targetY : 0.8;
    CB[b + 5] = opts.targetZ !== undefined ? opts.targetZ : 0;
  }

  addTrauma(eid, amount = 0.35) {
    if (!this.isAlive(eid)) return 0;
    if ((this.stores.mask[eid] & COMPONENTS.TRAUMA_SHAKE) === 0) {
      this.setTraumaCamera(eid);
    }
    const o = eid * 8;
    const next = Math.min(1.0, Math.max(0.0, this.stores.TraumaShake[o] + amount));
    this.stores.TraumaShake[o] = next;
    return next;
  }

  triggerHitStop(duration = 0.08, slow = 0.05, eid = 0) {
    const clampedDur = Math.max(0, Math.min(duration, 0.35));
    const clampedSlow = Math.max(0.0, Math.min(slow, 1.0));
    const myId = ++this._hitStopSeq;
    this._activeHitStopId = myId;
    this._hitStopRemainingReal = clampedDur;
    this._hitStopSlowScale = clampedSlow;
    this.timeScale = clampedDur > 0 ? clampedSlow : 1.0;

    if (eid >= 0 && eid < MAX_ENTITIES) {
      if (this.stores.alive[eid]) {
        this.stores.mask[eid] |= COMPONENTS.HIT_STOP;
      }
      this.stores.HitStopIds[eid] = myId;
      const hOff = eid * 4;
      this.stores.HitStopState[hOff + 0] = clampedDur;
      this.stores.HitStopState[hOff + 1] = clampedSlow;
      this.stores.HitStopState[hOff + 2] = clampedDur > 0 ? 1 : 0;
      this.stores.HitStopState[hOff + 3] = clampedDur;
    }
    return myId;
  }

  setFresnelRim(eid, colorHex = 0x7dd3fc, power = 2.8, intensity = 0.45, pulseHz = 0.7) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.FRESNEL_RIM;
    const c = new THREE.Color(colorHex);
    const o = eid * 6;
    const F = this.stores.FresnelRim;
    F[o + 0] = c.r;
    F[o + 1] = c.g;
    F[o + 2] = c.b;
    F[o + 3] = power;
    F[o + 4] = intensity;
    F[o + 5] = pulseHz;
  }

  setPickable(eid, meta = {}) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.PICKABLE;
    const o = eid * 4;
    const P = this.stores.InteractivePickable;
    P[o + 0] = 1;
    P[o + 1] = 0;
    P[o + 2] = 0;
    P[o + 3] = eid;
    this.pickMeta.set(eid, Object.assign({ eid }, meta));
    const obj = this.object3d[eid];
    if (obj) {
      obj.traverse((child) => {
        child.userData = child.userData || {};
        child.userData.z3dPickRootEid = eid;
      });
    }
  }

  setStageKinematics(eid, kind, duration = 0.55, paramA = 0, paramB = 0) {
    if (!this.isAlive(eid)) return;
    this.stores.mask[eid] |= COMPONENTS.STAGE_KINEMATICS;
    const tOff = eid * 10;
    const kOff = eid * 8;
    const K = this.stores.StageActionKinematics;
    const T = this.stores.Transform3D;
    if (K[kOff + 0] === ANIM_NONE) {
      K[kOff + 3] = T[tOff + 0];
      K[kOff + 4] = T[tOff + 1];
      K[kOff + 5] = T[tOff + 2];
    }
    K[kOff + 0] = kind;
    K[kOff + 1] = 0;
    K[kOff + 2] = Math.max(0.001, duration);
    K[kOff + 6] = paramA;
    K[kOff + 7] = paramB;
  }

  queuePointerRaycast(evt) {
    this._pendingPointerEvents.push(evt);
  }

  _sampleRealDelta(manualRealDt) {
    if (typeof manualRealDt === 'number' && Number.isFinite(manualRealDt)) {
      return Math.min(Math.max(manualRealDt, 0), 0.1);
    }
    if (this.timer) {
      this.timer.update();
      return Math.min(Math.max(this.timer.getDelta(), 0), 0.1);
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = (now - this._lastPerfNow) / 1000;
    this._lastPerfNow = now;
    return Math.min(Math.max(dt, 0), 0.1);
  }

  step(manualRealDt = undefined) {
    const realDt = this._sampleRealDelta(manualRealDt);
    this.realElapsed += realDt;

    if (this._activeHitStopId > 0 && this._hitStopRemainingReal > 0) {
      this._hitStopRemainingReal = Math.max(0, this._hitStopRemainingReal - realDt);
      for (let eid = 0; eid < this.nextId; eid++) {
        if (this.stores.alive[eid] && (this.stores.mask[eid] & COMPONENTS.HIT_STOP)) {
          if (this.stores.HitStopIds[eid] === this._activeHitStopId) {
            this.stores.HitStopState[eid * 4] = this._hitStopRemainingReal;
          }
        }
      }
      if (this._hitStopRemainingReal === 0) {
        this.timeScale = 1.0;
        for (let eid = 0; eid < this.nextId; eid++) {
          if (this.stores.alive[eid] && (this.stores.mask[eid] & COMPONENTS.HIT_STOP)) {
            this.stores.HitStopState[eid * 4 + 2] = 0;
          }
        }
      } else {
        this.timeScale = this._hitStopSlowScale;
      }
    }

    const scaledDt = realDt * this.timeScale;
    this.scaledElapsed += scaledDt;

    this.ecb.flush(this);
    this.lastSystemOrder.length = 0;
    for (let i = 0; i < this.schedule.length; i++) {
      const sys = this.schedule[i];
      this.lastSystemOrder.push(sys.name);
      sys.fn(scaledDt, realDt);
      this.ecb.flush(this);
    }
    return { realDt, scaledDt, timeScale: this.timeScale };
  }

  _sysInputRaycast() {
    if (this._pendingPointerEvents.length === 0) return;
    const events = this._pendingPointerEvents.splice(0, this._pendingPointerEvents.length);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev || !ev.camera || !ev.pickableEids || !ev.pickableEids.length) continue;
      ndc.set(ev.ndcX, ev.ndcY);
      raycaster.setFromCamera(ndc, ev.camera);

      const roots = [];
      for (let j = 0; j < ev.pickableEids.length; j++) {
        const peid = ev.pickableEids[j];
        if (this.isAlive(peid) && this.object3d[peid] && this.object3d[peid].visible !== false) {
          roots.push(this.object3d[peid]);
        }
      }
      const hits = roots.length ? raycaster.intersectObjects(roots, true) : [];
      let hitEid = -1;
      for (let h = 0; h < hits.length; h++) {
        let cur = hits[h].object;
        while (cur) {
          if (cur.userData && typeof cur.userData.z3dPickRootEid === 'number') {
            hitEid = cur.userData.z3dPickRootEid;
            break;
          }
          cur = cur.parent;
        }
        if (hitEid >= 0) break;
      }

      for (let j = 0; j < ev.pickableEids.length; j++) {
        const peid = ev.pickableEids[j];
        if (!this.isAlive(peid)) continue;
        this.stores.InteractivePickable[peid * 4 + 1] = peid === hitEid ? 1 : 0;
      }

      if (typeof ev.onResult === 'function') {
        const meta = hitEid >= 0 ? this.pickMeta.get(hitEid) || null : null;
        if (ev.type === 'click' && hitEid >= 0) {
          this.stores.InteractivePickable[hitEid * 4 + 2]++;
        }
        ev.onResult(hitEid, meta, ev.type);
      }
    }
  }

  _sysTurntableKinematics(scaledDt, realDt) {
    const alive = this.stores.alive;
    const mask = this.stores.mask;
    const T = this.stores.Transform3D;
    const V = this.stores.Velocity3D;
    const S = this.stores.TurntableSpin;
    const H = this.stores.HoverFloat;

    for (let eid = 0; eid < this.nextId; eid++) {
      if (!alive[eid]) continue;
      const m = mask[eid];
      const tOff = eid * 10;
      let dirty = T[tOff + 9] !== 0;

      if (m & COMPONENTS.VELOCITY) {
        const vOff = eid * 6;
        T[tOff + 0] += V[vOff + 0] * scaledDt;
        T[tOff + 1] += V[vOff + 1] * scaledDt;
        T[tOff + 2] += V[vOff + 2] * scaledDt;
        T[tOff + 3] += V[vOff + 3] * scaledDt;
        T[tOff + 4] += V[vOff + 4] * scaledDt;
        T[tOff + 5] += V[vOff + 5] * scaledDt;
        dirty = true;
      }

      if (m & COMPONENTS.TURNTABLE) {
        const sOff = eid * 4;
        T[tOff + 4] += S[sOff + 0] * realDt + S[sOff + 1];
        T[tOff + 3] = Math.max(-0.85, Math.min(0.85, T[tOff + 3] + S[sOff + 2]));
        const damp = Math.exp(-Math.max(1, S[sOff + 3]) * realDt);
        S[sOff + 1] *= damp;
        S[sOff + 2] *= damp;
        dirty = true;
      }

      if (m & COMPONENTS.HOVER_FLOAT) {
        const hOff = eid * 4;
        T[tOff + 1] = H[hOff + 0] + Math.sin(this.scaledElapsed * H[hOff + 2] * Math.PI * 2 + H[hOff + 3]) * H[hOff + 1];
        dirty = true;
      }

      if (dirty) {
        T[tOff + 9] = 0;
        const obj = this.object3d[eid];
        if (obj) {
          obj.position.set(T[tOff + 0], T[tOff + 1], T[tOff + 2]);
          obj.rotation.set(T[tOff + 3], T[tOff + 4], T[tOff + 5]);
          obj.scale.set(T[tOff + 6], T[tOff + 7], T[tOff + 8]);
        }
      }
    }
  }

  _sysStageActionKinematics(scaledDt) {
    const alive = this.stores.alive;
    const mask = this.stores.mask;
    const K = this.stores.StageActionKinematics;
    const T = this.stores.Transform3D;

    for (let eid = 0; eid < this.nextId; eid++) {
      if (!alive[eid] || (mask[eid] & COMPONENTS.STAGE_KINEMATICS) === 0) continue;
      const kOff = eid * 8;
      const kind = K[kOff + 0];
      if (kind === ANIM_NONE) continue;

      const tOff = eid * 10;
      K[kOff + 1] += scaledDt;
      const timer = K[kOff + 1];
      const dur = K[kOff + 2];
      const u = Math.min(1.0, timer / dur);
      const ox = K[kOff + 3];
      const oy = K[kOff + 4];
      const oz = K[kOff + 5];
      const pA = K[kOff + 6];
      const pB = K[kOff + 7];

      if (kind === ANIM_LUNGE) {
        const wave = Math.sin(u * Math.PI);
        T[tOff + 0] = ox + pA * wave;
        T[tOff + 2] = oz + pB * wave;
        const squash = 1.0 + 0.16 * Math.sin(u * Math.PI * 2);
        T[tOff + 6] = squash;
        T[tOff + 7] = 1.0 / Math.sqrt(Math.max(0.5, squash));
        T[tOff + 8] = squash;
        if (u >= 1.0) {
          T[tOff + 0] = ox;
          T[tOff + 2] = oz;
          T[tOff + 6] = 1; T[tOff + 7] = 1; T[tOff + 8] = 1;
          K[kOff + 0] = ANIM_NONE;
        }
      } else if (kind === ANIM_VAULT_OPEN) {
        const ease = 1 - Math.pow(1 - u, 3);
        const swing = u < 0.78 ? ease : 1 - (u - 0.78) / 0.22;
        T[tOff + 4] = pA + swing * pB;
        if (u >= 1.0) {
          T[tOff + 4] = pA;
          K[kOff + 0] = ANIM_NONE;
        }
      } else if (kind === ANIM_WHEEL_SPIN) {
        const speed = pB > 0 ? pA * Math.max(0.15, 1 - u * 0.85) : pA;
        T[tOff + 5] += speed * scaledDt;
        if (pB > 0 && u >= 1.0) {
          K[kOff + 6] = 0.85;
          K[kOff + 7] = 0;
          K[kOff + 1] = 0;
        }
      } else if (kind === ANIM_DRIFT_ORBIT) {
        const ang = this.scaledElapsed * pA + pB;
        const rx = ox || 2.15;
        const rz = oz || 1.25;
        T[tOff + 0] = Math.cos(ang) * rx;
        T[tOff + 1] = oy;
        T[tOff + 2] = Math.sin(ang) * rz;
        T[tOff + 4] = -ang + Math.PI * 0.5 + 0.18;
      } else if (kind === ANIM_ROULETTE_BALL) {
        const easeOut = 1 - Math.pow(1 - u, 3);
        const ballObj = this.object3d[eid];
        const rotorEid = ballObj && ballObj.userData ? ballObj.userData.rotorEid : undefined;
        const rotorYaw = (rotorEid !== undefined && this.isAlive(rotorEid))
          ? T[rotorEid * 10 + 4]
          : 0;
        const hasPocketLock = Boolean(ballObj && ballObj.userData && ballObj.userData.hasPocketTarget);
        const pocketLocal = hasPocketLock ? ballObj.userData.pocketLocalAngle : pB;
        const liveTargetAng = hasPocketLock ? (pocketLocal - rotorYaw) : pB;
        const hasTarget = hasPocketLock || (Number.isFinite(pB) && pB >= -Math.PI * 4 && pB !== 0);
        let ang;
        if (hasTarget && u >= 0.68) {
          const blend = Math.min(1, (u - 0.68) / 0.32);
          const sCurve = blend * blend * (3 - 2 * blend);
          if (K[kOff + 6] !== 999) {
            // Normalize freeAng within 1.5 revolutions ahead of liveTargetAng for natural forward capture
            let startAng = K[kOff + 7];
            while (startAng - liveTargetAng > Math.PI * 2.5) startAng -= Math.PI * 2;
            while (liveTargetAng - startAng > Math.PI * 0.5) startAng += Math.PI * 2;
            K[kOff + 7] = startAng;
            K[kOff + 6] = 999;
          }
          ang = K[kOff + 7] + (liveTargetAng - K[kOff + 7]) * sCurve;
        } else {
          K[kOff + 6] = 0;
          const speed = pA * Math.max(0.22, 1 - easeOut * 0.78);
          K[kOff + 7] += speed * scaledDt;
          ang = K[kOff + 7];
        }
        const outerR = 0.88 * 0.76;
        const pocketR = 0.60 * 0.76;
        const radius = u < 0.42
          ? outerR - 0.04 * (u / 0.42)
          : outerR - 0.04 - (outerR - 0.04 - pocketR) * Math.min(1, (u - 0.42) / 0.58);
        const trackLift = u < 0.42 ? 0.075 * (1 - (u / 0.42) * 0.25) : 0.056 * Math.max(0, 1 - (u - 0.42) / 0.46);
        const deflectorHop = (u > 0.32 && u < 0.84) ? Math.abs(Math.sin(ang * 8.0)) * 0.042 * (1 - u) : 0;
        T[tOff + 0] = ox + Math.cos(ang) * radius;
        T[tOff + 1] = oy + trackLift + deflectorHop;
        T[tOff + 2] = oz + Math.sin(ang) * radius;
        if (hasPocketLock && u >= 1.0) {
          K[kOff + 0] = ANIM_ROULETTE_RIDE;
          K[kOff + 1] = 0;
          K[kOff + 2] = 9999;
        }
      } else if (kind === ANIM_ROULETTE_RIDE) {
        const ballObj = this.object3d[eid];
        const rotorEid = ballObj && ballObj.userData ? ballObj.userData.rotorEid : undefined;
        const rotorYaw = (rotorEid !== undefined && this.isAlive(rotorEid))
          ? T[rotorEid * 10 + 4]
          : 0;
        const pocketLocal = (ballObj && ballObj.userData && Number.isFinite(ballObj.userData.pocketLocalAngle))
          ? ballObj.userData.pocketLocalAngle
          : 0;
        const ang = pocketLocal - rotorYaw;
        const pocketR = 0.60 * 0.76;
        T[tOff + 0] = ox + Math.cos(ang) * pocketR;
        T[tOff + 1] = oy - 0.012;
        T[tOff + 2] = oz + Math.sin(ang) * pocketR;
      } else if (kind === ANIM_SLOT_REEL) {
        const speed = pB > 0 ? pA * (1 - u * 0.9) : pA;
        T[tOff + 3] += speed * scaledDt;
        if (pB > 0 && u >= 1.0) {
          K[kOff + 0] = ANIM_NONE;
        }
      } else if (kind === ANIM_SLOT_REEL_TARGET) {
        if (u < 0.74) {
          T[tOff + 3] -= pA * (1 - (u / 0.74) * 0.35) * scaledDt;
          K[kOff + 6] = 0;
        } else {
          if (K[kOff + 6] !== 888) {
            let cur = T[tOff + 3];
            const tgt = pB;
            // Choose target revolution just ahead in negative-X spin direction
            let alignedTgt = tgt - Math.ceil((tgt - cur) / (Math.PI * 2)) * Math.PI * 2 - Math.PI * 2;
            K[kOff + 7] = cur;
            const reelObj = this.object3d[eid];
            if (reelObj && reelObj.userData) reelObj.userData.alignedTargetX = alignedTgt;
            K[kOff + 6] = 888;
          }
          const reelObj = this.object3d[eid];
          const alignedTgt = (reelObj && reelObj.userData && Number.isFinite(reelObj.userData.alignedTargetX))
            ? reelObj.userData.alignedTargetX
            : pB;
          const tLocal = Math.min(1, (u - 0.74) / 0.26);
          // Mechanical spring overshoot settle onto exact payline symbol
          const easeSnap = tLocal < 0.82
            ? (tLocal / 0.82) * 1.045
            : 1.045 - ((tLocal - 0.82) / 0.18) * 0.045;
          T[tOff + 3] = K[kOff + 7] + (alignedTgt - K[kOff + 7]) * easeSnap;
          if (u >= 1.0) {
            T[tOff + 3] = pB;
            K[kOff + 0] = ANIM_NONE;
          }
        }
      } else if (kind === ANIM_LEVER_PULL) {
        const pull = u < 0.35 ? (u / 0.35) : Math.max(0, 1 - (u - 0.35) / 0.65) * Math.cos((u - 0.35) * Math.PI * 2.2);
        T[tOff + 3] = pA * pull;
        if (u >= 1.0) {
          T[tOff + 3] = 0;
          K[kOff + 0] = ANIM_NONE;
        }
      } else if (kind === ANIM_BAG_SWING) {
        const decay = Math.exp(-3.2 * u);
        T[tOff + 5] = Math.sin(u * Math.PI * 5) * pA * decay;
        if (u >= 1.0) {
          T[tOff + 5] = 0;
          K[kOff + 0] = ANIM_NONE;
        }
      } else if (kind === ANIM_BURST_POP) {
        const arc = Math.sin(u * Math.PI);
        T[tOff + 1] = oy + arc * pA;
        const s = Math.max(0.001, Math.sin(u * Math.PI) * (pB || 1.25));
        T[tOff + 6] = s; T[tOff + 7] = s; T[tOff + 8] = s;
        if (u >= 1.0) {
          T[tOff + 1] = oy;
          T[tOff + 6] = 0.001; T[tOff + 7] = 0.001; T[tOff + 8] = 0.001;
          K[kOff + 0] = ANIM_NONE;
        }
      }

      const obj = this.object3d[eid];
      if (obj) {
        obj.position.set(T[tOff + 0], T[tOff + 1], T[tOff + 2]);
        obj.rotation.set(T[tOff + 3], T[tOff + 4], T[tOff + 5]);
        obj.scale.set(T[tOff + 6], T[tOff + 7], T[tOff + 8]);
      }
    }
  }

  _sysTraumaCamera(_scaledDt, realDt) {
    const alive = this.stores.alive;
    const mask = this.stores.mask;
    const TS = this.stores.TraumaShake;
    const CB = this.stores.CameraBasePose;
    const T = this.stores.Transform3D;
    const reduced = isReducedMotion();

    for (let eid = 0; eid < this.nextId; eid++) {
      if (!alive[eid] || (mask[eid] & COMPONENTS.TRAUMA_SHAKE) === 0) continue;
      const o = eid * 8;
      let trauma = TS[o + 0];
      if (trauma <= 0) continue;

      if (reduced) {
        trauma = 0;
        TS[o + 0] = 0;
      } else {
        const decay = Math.max(0, TS[o + 1]);
        trauma = Math.max(0, trauma - decay * realDt);
        TS[o + 0] = trauma;
      }

      const strength = TS[o + 6] * this.shakeStrength;
      const shake = trauma * trauma * strength;
      TS[o + 5] += realDt * 30.0;
      const t = TS[o + 5];

      const offX = trauma > 0 ? TS[o + 2] * shake * (Math.sin(t * 1.7) * 0.7 + Math.sin(t * 2.9) * 0.3) : 0;
      const offY = trauma > 0 ? TS[o + 3] * shake * (Math.sin(t * 2.3) * 0.7 + Math.sin(t * 3.7) * 0.3) : 0;
      const roll = trauma > 0 ? TS[o + 4] * shake * Math.sin(t * 1.1) : 0;

      const b = eid * 6;
      const tOff = eid * 10;
      T[tOff + 0] = CB[b + 0] + offX;
      T[tOff + 1] = CB[b + 1] + offY;
      T[tOff + 2] = CB[b + 2];
      T[tOff + 5] = roll;

      const cam = this.object3d[eid];
      if (cam) {
        if (cam.userData && cam.userData.z3dOrbitActive) {
          const prevOffX = cam.userData.z3dPrevShakeX || 0;
          const prevOffY = cam.userData.z3dPrevShakeY || 0;
          cam.position.x += offX - prevOffX;
          cam.position.y += offY - prevOffY;
          cam.userData.z3dPrevShakeX = trauma > 0 ? offX : 0;
          cam.userData.z3dPrevShakeY = trauma > 0 ? offY : 0;
        } else {
          cam.position.set(T[tOff + 0], T[tOff + 1], T[tOff + 2]);
          cam.rotation.z = roll;
        }
      }
    }
  }

  _sysFresnelShader() {
    const alive = this.stores.alive;
    const mask = this.stores.mask;
    const F = this.stores.FresnelRim;
    const P = this.stores.InteractivePickable;
    const t = this.realElapsed;

    for (let eid = 0; eid < this.nextId; eid++) {
      if (!alive[eid]) continue;
      const mats = this.rimMaterials[eid];
      if (!mats || !mats.length) continue;

      const hasComp = (mask[eid] & COMPONENTS.FRESNEL_RIM) !== 0;
      const hovered = (mask[eid] & COMPONENTS.PICKABLE) !== 0 && P[eid * 4 + 1] === 1;
      const fOff = eid * 6;

      for (let i = 0; i < mats.length; i++) {
        const u = mats[i].userData && mats[i].userData.z3dRimUniforms;
        if (!u) continue;
        u.uZ3dRimTime.value = t;
        if (hasComp) {
          u.uZ3dRimColor.value.setRGB(F[fOff + 0], F[fOff + 1], F[fOff + 2]);
          u.uZ3dRimPower.value = hovered ? Math.max(1.4, F[fOff + 3] * 0.72) : F[fOff + 3];
          u.uZ3dRimIntensity.value = hovered ? F[fOff + 4] * 1.85 + 0.25 : F[fOff + 4];
          u.uZ3dRimPulseHz.value = hovered ? Math.max(1.8, F[fOff + 5] * 2) : F[fOff + 5];
        } else if (hovered) {
          u.uZ3dRimIntensity.value = 0.92;
        }
      }
    }
  }

  _sysParticleTrail(scaledDt, realDt) {
    const reduced = isReducedMotion();
    const alive = this.stores.alive;
    const mask = this.stores.mask;

    if (!reduced && scaledDt > 0) {
      for (let eid = 0; eid < this.nextId; eid++) {
        if (!alive[eid] || (mask[eid] & COMPONENTS.RIGGED_OPERATIVE) === 0) continue;
        const rigs = this.riggedCache[eid];
        if (!rigs) continue;
        for (let r = 0; r < rigs.length; r++) {
          const rig = rigs[r];
          if (rig && typeof rig.update === 'function') {
            rig.update(scaledDt);
          }
        }
      }
    }

    for (const ctrl of this.stageVfxControllers) {
      if (ctrl && typeof ctrl.update === 'function') {
        ctrl.update(scaledDt, realDt, reduced);
      }
    }
  }

  _sysSharedWebGLRender(scaledDt, realDt) {
    if (typeof this._renderHook === 'function') {
      this._renderHook(scaledDt, realDt, this);
    }
  }
}

/* --------------------------------------------------------------------------
 * 4. 100% 3D ITEM MESH FACTORY & ALL 13+ UNIQUE CRIME ENHANCERS
 *    Hero 3/4 side-profile framing (`HERO_ELONGATED_YAW`, `HERO_ELONGATED_PITCH`)
 *    ensures rifles, melee, vehicles & tools fill ~68% of 3D Orbit Studio!
 * -------------------------------------------------------------------------- */
export const WEAPON_ASSET_MAP = Object.freeze({
  assaultrifle_1: { type: 'glb', url: '/assets/weapons/upgrades116/m4-detail116.glb', family: 'rifle' },
  assaultrifle_3: { type: 'glb', url: '/assets/weapons/upgrades116/m4-detail116.glb', family: 'rifle' },
  assaultrifle_5: { type: 'glb', url: '/assets/weapons/upgrades116/m4-detail116.glb', family: 'rifle' },
  assaultrifle_2: { type: 'glb', url: '/assets/weapons/upgrades111/g3a3-detail111.glb', family: 'rifle' },
  assaultrifle_4: { type: 'glb', url: '/assets/weapons/upgrades111/g3a3-detail111.glb', family: 'rifle' },
  assaultrifle2_1: { type: 'glb', url: '/assets/weapons/premium/akm/akm.glb', family: 'ak' },
  assaultrifle2_2: { type: 'obj', obj: '/assets/weapons/AssaultRifle2_2.obj', mtl: '/assets/weapons/AssaultRifle2_2.mtl', family: 'ak' },
  assaultrifle2_3: { type: 'obj', obj: '/assets/weapons/AssaultRifle2_3.obj', mtl: '/assets/weapons/AssaultRifle2_3.mtl', family: 'ak' },
  assaultrifle2_4: { type: 'obj', obj: '/assets/weapons/AssaultRifle2_4.obj', mtl: '/assets/weapons/AssaultRifle2_4.mtl', family: 'ak' },
  ak: { type: 'glb', url: '/assets/weapons/premium/akm/akm.glb', family: 'ak' },
  bullpup_1: { type: 'glb', url: '/assets/weapons/upgrades111/l85-detail111.glb', family: 'bullpup' },
  bullpup_2: { type: 'glb', url: '/assets/weapons/upgrades111/l85-detail111.glb', family: 'bullpup' },
  bullpup_3: { type: 'glb', url: '/assets/weapons/upgrades111/l85-detail111.glb', family: 'bullpup' },
  pistol: { type: 'glb', url: '/assets/weapons/premium/v99/tabasco-m1911.glb', family: 'pistol' },
  pistol_1: { type: 'glb', url: '/assets/weapons/premium/v99/tabasco-m1911.glb', family: 'pistol' },
  pistol_2: { type: 'glb', url: '/assets/weapons/upgrades111/glock18-detail111.glb', family: 'pistol' },
  pistol_3: { type: 'obj', obj: '/assets/weapons/Pistol_3.obj', mtl: '/assets/weapons/Pistol_3.mtl', family: 'pistol' },
  pistol_4: { type: 'obj', obj: '/assets/weapons/Pistol_4.obj', mtl: '/assets/weapons/Pistol_4.mtl', family: 'pistol' },
  pistol_5: { type: 'obj', obj: '/assets/weapons/Pistol_5.obj', mtl: '/assets/weapons/Pistol_5.mtl', family: 'pistol' },
  pistol_6: { type: 'glb', url: '/assets/weapons/upgrades111/glock18-detail111.glb', family: 'pistol' },
  pistol_t: { type: 'glb', url: '/assets/weapons/upgrades111/glock18-detail111.glb', family: 'pistol' },
  revolver: { type: 'glb', url: '/assets/weapons/premium/detective-special/detective-special.glb', family: 'revolver' },
  revolver_1: { type: 'glb', url: '/assets/weapons/premium/detective-special/detective-special.glb', family: 'revolver' },
  revolver_2: { type: 'obj', obj: '/assets/weapons/Revolver_2.obj', mtl: '/assets/weapons/Revolver_2.mtl', family: 'revolver' },
  revolver_3: { type: 'obj', obj: '/assets/weapons/Revolver_3.obj', mtl: '/assets/weapons/Revolver_3.mtl', family: 'revolver' },
  revolver_4: { type: 'obj', obj: '/assets/weapons/Revolver_4.obj', mtl: '/assets/weapons/Revolver_4.mtl', family: 'revolver' },
  revolver_5: { type: 'glb', url: '/assets/weapons/premium/v99/loafbrr-revolver.glb', family: 'revolver' },
  magnum: { type: 'glb', url: '/assets/weapons/premium/v99/loafbrr-revolver.glb', family: 'revolver' },
  shotgun: { type: 'obj', obj: '/assets/weapons/Shotgun_2.obj', mtl: '/assets/weapons/Shotgun_2.mtl', family: 'shotgun' },
  shotgun_1: { type: 'obj', obj: '/assets/weapons/Shotgun_1.obj', mtl: '/assets/weapons/Shotgun_1.mtl', family: 'shotgun' },
  shotgun_2: { type: 'obj', obj: '/assets/weapons/Shotgun_2.obj', mtl: '/assets/weapons/Shotgun_2.mtl', family: 'shotgun' },
  shotgun_3: { type: 'obj', obj: '/assets/weapons/Shotgun_3.obj', mtl: '/assets/weapons/Shotgun_3.mtl', family: 'shotgun' },
  shotgun_4: { type: 'obj', obj: '/assets/weapons/Shotgun_4.obj', mtl: '/assets/weapons/Shotgun_4.mtl', family: 'shotgun' },
  shotgun_sawedoff: { type: 'glb', url: '/assets/weapons/premium/v99/jean-doublebarrel-safe.glb', family: 'shotgun' },
  sawedoff: { type: 'glb', url: '/assets/weapons/premium/v99/jean-doublebarrel-safe.glb', family: 'shotgun' },
  shotgun_shortstock: { type: 'obj', obj: '/assets/weapons/Shotgun_ShortStock.obj', mtl: '/assets/weapons/Shotgun_ShortStock.mtl', family: 'shotgun' },
  sniper: { type: 'glb', url: '/assets/weapons/upgrades112/mosin9130-detail112.glb', family: 'sniper' },
  sniperrifle_1: { type: 'obj', obj: '/assets/weapons/SniperRifle_1.obj', mtl: '/assets/weapons/SniperRifle_1.mtl', family: 'sniper' },
  sniperrifle_2: { type: 'glb', url: '/assets/weapons/upgrades112/dragunov-detail112.glb', family: 'sniper' },
  sniperrifle_3: { type: 'glb', url: '/assets/weapons/upgrades112/mosin9130-detail112.glb', family: 'sniper' },
  sniperrifle_4: { type: 'obj', obj: '/assets/weapons/SniperRifle_4.obj', mtl: '/assets/weapons/SniperRifle_4.mtl', family: 'sniper' },
  sniperrifle_5: { type: 'glb', url: '/assets/weapons/upgrades112/dragunov-detail112.glb', family: 'sniper' },
  sniperrifle_6: { type: 'glb', url: '/assets/weapons/upgrades112/mosin9130-detail112.glb', family: 'sniper' },
  smg: { type: 'obj', obj: '/assets/weapons/SubmachineGun_1.obj', mtl: '/assets/weapons/SubmachineGun_1.mtl', family: 'smg' },
  submachinegun_1: { type: 'obj', obj: '/assets/weapons/SubmachineGun_1.obj', mtl: '/assets/weapons/SubmachineGun_1.mtl', family: 'smg' },
  submachinegun_2: { type: 'obj', obj: '/assets/weapons/SubmachineGun_2.obj', mtl: '/assets/weapons/SubmachineGun_2.mtl', family: 'smg' },
  submachinegun_3: { type: 'obj', obj: '/assets/weapons/SubmachineGun_3.obj', mtl: '/assets/weapons/SubmachineGun_3.mtl', family: 'smg' },
  submachinegun_4: { type: 'obj', obj: '/assets/weapons/SubmachineGun_4.obj', mtl: '/assets/weapons/SubmachineGun_4.mtl', family: 'smg' },
  submachinegun_5: { type: 'obj', obj: '/assets/weapons/SubmachineGun_5.obj', mtl: '/assets/weapons/SubmachineGun_5.mtl', family: 'smg' },
  knife: { type: 'glb', url: '/assets/weapons/premium/m9-knife/m9-knife.glb', family: 'knife' },
  bat: { type: 'glb', url: '/assets/weapons/premium/wooden-bat/baseball_bat.glb', family: 'bat' },
  katana: { type: 'glb', url: '/assets/weapons/library/models/the-base-mesh--saber_01.glb', family: 'katana' },
  hammer: { type: 'glb', url: '/assets/weapons/library/models/the-base-mesh--sledgehammer.glb', family: 'hammer' },
  iron_knuckles: { type: 'glb', url: '/assets/weapons/library/models/the-base-mesh--knuckle_duster.glb', family: 'knuckles' },
});

const RARITY_RIM_COLORS = Object.freeze({
  common: 0x93c5fd,
  uncommon: 0x4ade80,
  rare: 0x38bdf8,
  epic: 0xc084fc,
  legendary: 0xfbbf24,
  mythic: 0xf43f5e,
});

export function resolveItemSpec3D(itemId, category = '', rarity = 'rare') {
  const rawId = String(itemId || 'weapon_cache').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const rawCat = String(category || '').trim().toLowerCase();
  const rimColor = RARITY_RIM_COLORS[String(rarity || 'rare').toLowerCase()] || 0x7dd3fc;

  if (Object.hasOwn(WEAPON_ASSET_MAP, rawId)) {
    const entry = WEAPON_ASSET_MAP[rawId];
    const isMelee = ['knife', 'bat', 'katana', 'hammer', 'knuckles'].includes(entry.family);
    return { id: rawId, category: isMelee ? 'melee' : 'weapon', subtype: entry.family, archetype: entry.family, asset: entry, rimColor };
  }

  // Specific Crime Enhancers & Syndicate Tools (#1-#13 + bespoke tools — checked BEFORE broad armor/melee rules so zero items collide!)
  if (/cut_throat_razor|straight_razor|\brazor\b/.test(rawId)) {
    return { id: rawId, category: 'melee', subtype: 'cut_throat_razor', archetype: 'cut_throat_razor', asset: null, rimColor };
  }
  if (/crowbar|prybar|jimmy/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'crowbar', archetype: 'crowbar', asset: null, rimColor };
  }
  if (/paint_mask|respirator|spray/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'paint_mask', archetype: 'paint_mask', asset: null, rimColor };
  }
  if (/latex_gloves|nitrile|disposal_gloves/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'latex_gloves', archetype: 'latex_gloves', asset: null, rimColor };
  }
  if (/mountain_bike|bicycle|\bbike\b/.test(rawId)) {
    return { id: rawId, category: 'vehicle', subtype: 'mountain_bike', archetype: 'mountain_bike', asset: null, rimColor };
  }
  if (/high_speed_drive|nvme|duplicator|usb_drive|ssd/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'high_speed_drive', archetype: 'high_speed_drive', asset: null, rimColor };
  }
  if (/skimmer|card_skimmer|magstripe/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'skimmer', archetype: 'skimmer', asset: null, rimColor };
  }
  if (/duct_tape|\btape\b/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'duct_tape', archetype: 'duct_tape', asset: null, rimColor };
  }
  if (/flashlight|torch/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'flashlight', archetype: 'flashlight', asset: null, rimColor };
  }
  if (/megaphone|bullhorn/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'megaphone', archetype: 'megaphone', asset: null, rimColor };
  }
  if (/office_chair|swivel_chair|\bchair\b/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'office_chair', archetype: 'office_chair', asset: null, rimColor };
  }
  if (/magnifying_glass|loupe|forger_lens/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'magnifying_glass', archetype: 'magnifying_glass', asset: null, rimColor };
  }
  if (/ergonomic_keyboard|keyboard/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'ergonomic_keyboard', archetype: 'ergonomic_keyboard', asset: null, rimColor };
  }
  if (/hacking_rig|cyberdeck|laptop|black_box|ecu/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'hacking_rig', archetype: 'hacking_rig', asset: null, rimColor };
  }
  if (/windproof_lighter|lighter|zippo|blowtorch/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'windproof_lighter', archetype: 'windproof_lighter', asset: null, rimColor };
  }
  if (/lockpick|pick_set/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'lockpick', archetype: 'lockpick', asset: null, rimColor };
  }
  if (/thermal_drill|\bdrill\b|auger/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'drill', archetype: 'drill', asset: null, rimColor };
  }
  if (/keycard|access_card|passcard|rfid/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'keycard', archetype: 'keycard', asset: null, rimColor };
  }
  if (/glasses|goggles|nvg|optics/.test(rawId)) {
    return { id: rawId, category: 'enhancer', subtype: 'glasses', archetype: 'glasses', asset: null, rimColor };
  }

  // Melee
  if (rawCat === 'melee' || /(knife|dagger|blade|katana|sword|bat|club|hammer|baton|knuckle|machete)/.test(rawId)) {
    let subtype = 'knife';
    if (/katana|sword|saber/.test(rawId)) subtype = 'katana';
    else if (/baton|stun|taser/.test(rawId)) subtype = 'stun_baton';
    else if (/\bbat\b|baseball|club/.test(rawId)) subtype = 'bat';
    else if (/hammer|mace/.test(rawId)) subtype = 'hammer';
    else if (/knuckle/.test(rawId)) subtype = 'knuckles';
    return { id: rawId, category: 'melee', subtype, archetype: subtype, asset: WEAPON_ASSET_MAP[subtype] || null, rimColor };
  }

  // Firearms & tactical grenades
  if (rawCat === 'weapon' || rawCat === 'firearm' || /(rifle|pistol|revolver|shotgun|sniper|smg|bullpup|grenade|primary|secondary|temporary)/.test(rawId)) {
    let subtype = 'rifle';
    if (/grenade|flash|smoke/.test(rawId)) subtype = 'grenade';
    else if (/pistol|glock|sidearm|secondary/.test(rawId)) subtype = 'pistol';
    else if (/revolver|magnum/.test(rawId)) subtype = 'revolver';
    else if (/shotgun|sawed/.test(rawId)) subtype = 'shotgun';
    else if (/sniper|dragunov|mosin/.test(rawId)) subtype = 'sniper';
    else if (/smg|submachine/.test(rawId)) subtype = 'smg';
    return { id: rawId, category: 'weapon', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Drugs
  if (rawCat === 'drug' || /(xanax|vicodin|ecstasy|ketamine|lsd|shroom|opium|pcp|speed|cannabis|weed|epinephrine)/.test(rawId)) {
    return { id: rawId, category: 'drug', subtype: rawId, archetype: `drug_${rawId}`, asset: null, rimColor };
  }

  // Medical
  if (rawCat === 'medical' || /(medkit|smallkit|first_aid|morphine|bloodbag|blood_bag|neumune|bandage|syringe)/.test(rawId)) {
    let subtype = 'medkit';
    if (/blood/.test(rawId)) subtype = 'bloodbag';
    else if (/morphine|neumune|syringe/.test(rawId)) subtype = 'syringe';
    else if (/small/.test(rawId)) subtype = 'small_medkit';
    return { id: rawId, category: 'medical', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Boosters
  if (rawCat === 'booster' || /(edrink|energy|redbull|taurine|candy|chocolate|fhc|feathery|edvd|dvd|alcohol|beer|whiskey|lawyer_card)/.test(rawId)) {
    let subtype = 'edrink';
    if (/fhc|feathery|lawyer|coupon|vip/.test(rawId)) subtype = 'fhc';
    else if (/edvd|dvd|disc/.test(rawId)) subtype = 'edvd';
    else if (/candy|choc/.test(rawId)) subtype = 'candy';
    else if (/alcohol|whiskey|beer|wine/.test(rawId)) subtype = 'alcohol';
    return { id: rawId, category: 'booster', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Casino 3D Showpieces (37-Pocket Roulette Wheel & Mechanical Jackpot Slot Machine)
  if (rawCat === 'casino' || /roulette_wheel|roulette|slot_machine|jackpot_slots/.test(rawId)) {
    const subtype = /slot/.test(rawId) ? 'slot_machine' : 'roulette_wheel';
    return { id: rawId, category: 'casino', subtype, archetype: subtype, asset: null, rimColor: 0xfbbf24 };
  }

  // 4 Evolving 3D Syndicate Companions (checked before armor so armored_k9 never collides with armor!)
  if (rawCat === 'companion' || /recon_drone|armored_k9|smuggler_falcon|cyber_raven/.test(rawId)) {
    let subtype = 'recon_drone';
    if (/k9|hound|dog/.test(rawId)) subtype = 'armored_k9';
    else if (/falcon|hawk/.test(rawId)) subtype = 'smuggler_falcon';
    else if (/raven|crow/.test(rawId)) subtype = 'cyber_raven';
    return { id: rawId, category: 'companion', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Vehicles (4 Distinct Syndicate Fleet Archetypes — checked before armor so armored_van never collides with armor!)
  if (rawCat === 'vehicle' || /(car|civic|evo|gtr|gt3|nightshade|van|armored_van|pier4|truck|interceptor|sedan|apex|racer)/.test(rawId)) {
    let subtype = 'sports_car';
    if (/armored_van|pier4|\bvan\b|truck|hauler/.test(rawId)) subtype = 'armored_van';
    else if (/interceptor|sedan|apex|cruiser/.test(rawId)) subtype = 'interceptor_sedan';
    else if (/bike|enduro/.test(rawId)) subtype = 'mountain_bike';
    return { id: rawId, category: 'vehicle', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Armor & paperdoll
  if (rawCat === 'armor' || rawCat === 'paperdoll' || /(helmet|head|kevlar|vest|armor|body|chest|gloves|hands|gauntlet|boots|feet|pants|legs|greaves|amulet|ring|mask)/.test(rawId)) {
    let subtype = 'kevlar';
    if (/helmet|head|mask/.test(rawId)) subtype = 'helmet';
    else if (/glove|hand/.test(rawId)) subtype = 'gloves';
    else if (/boot|feet|shoe/.test(rawId)) subtype = 'boots';
    else if (/pant|leg|greave/.test(rawId)) subtype = 'pants';
    else if (/amulet|ring|medal|crest/.test(rawId)) subtype = 'ring';
    return { id: rawId, category: 'armor', subtype, archetype: subtype, asset: null, rimColor };
  }

  // Caches & Crates
  if (rawCat === 'cache' || /(cache|crate|chest|box|safe)/.test(rawId)) {
    return { id: rawId, category: 'cache', subtype: 'weapon_cache', archetype: 'weapon_cache', asset: null, rimColor };
  }

  // Contraband / Collectibles
  if (rawCat === 'contraband' || /(bullion|gold|plush|flower|orchid|lotus|cherry|peony|violet|tribulus)/.test(rawId)) {
    let subtype = 'gold_bullion';
    if (/flower|orchid|lotus|cherry|peony|violet|tribulus/.test(rawId)) subtype = 'orchid';
    else if (/plush/.test(rawId)) subtype = 'plushie';
    return { id: rawId, category: 'contraband', subtype, archetype: subtype, asset: null, rimColor };
  }

  return { id: rawId, category: rawCat || 'enhancer', subtype: 'hacking_rig', archetype: 'hacking_rig', asset: null, rimColor };
}

export function resolveItemArchetype(itemId, category = '') {
  return resolveItemSpec3D(itemId, category).archetype;
}

/**
 * Aligns elongated meshes so their primary horizontal barrel/body length lies
 * along Z before centering & scaling to `targetExtent = 1.68`. That way,
 * setting `root.rotation.set(0.14, -Math.PI * 0.36, 0)` presents EVERY GLB,
 * OBJ, and procedural weapon/melee/vehicle at a dramatic ~91% broadside 3/4
 * diagonal profile!
 */
function normalizeAndAlignModel(obj, targetExtent = 1.68, alignLongToZ = false) {
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(wrap);
  if (box.isEmpty()) return wrap;
  const size = new THREE.Vector3();
  box.getSize(size);

  if (alignLongToZ) {
    if (size.x > size.z * 1.32 && size.x >= size.y) {
      obj.rotation.y += Math.PI * 0.5;
    } else if (size.y > Math.max(size.x, size.z) * 1.45) {
      // Tall vertical bat / sword / crowbar: tilt into dramatic diagonal along Y-Z
      obj.rotation.x += Math.PI * 0.34;
    }
    wrap.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(wrap);
    box.getSize(size);
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetExtent / maxDim;
  wrap.scale.setScalar(scale);
  wrap.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const holder = new THREE.Group();
  holder.add(wrap);
  return holder;
}

export function isElongatedItemCategory(spec) {
  if (!spec) return false;
  if (spec.category === 'weapon' || spec.category === 'melee' || spec.category === 'vehicle') return true;
  if (spec.category === 'enhancer') {
    return ['crowbar', 'flashlight', 'megaphone', 'drill', 'lockpick', 'hacking_rig', 'ergonomic_keyboard', 'skimmer', 'high_speed_drive'].includes(spec.subtype);
  }
  return false;
}

/* --- Procedural Multi-Part 3D Mesh Builders --- */
function buildFirearmProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const gunmetal = makePbr(0x2b3038, 0.26, 0.90, { color: rimColor, power: 2.5, intensity: 0.48 });
  const steel = makePbr(0x8c96a4, 0.20, 0.94, { color: rimColor, power: 2.7, intensity: 0.42 });
  const polymer = makePbr(0x1b1e24, 0.50, 0.24, { color: rimColor, power: 3.0, intensity: 0.32 });
  const woodOrAccent = subtype === 'ak'
    ? makePbr(0x8f4e25, 0.52, 0.08, { color: 0xfbbf24, power: 2.8, intensity: 0.34 })
    : makePbr(0x3b4252, 0.34, 0.68, { color: rimColor, power: 2.8, intensity: 0.35 });
  const opticLens = makePbr(0x0ea5e9, 0.08, 0.2, { color: 0x38bdf8, power: 1.8, intensity: 0.9 }, { emissive: 0x0284c7, emissiveIntensity: 0.75 });

  if (subtype === 'grenade') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.78, 16), gunmetal);
    const bandTop = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.032, 10, 24), opticLens);
    bandTop.rotation.x = Math.PI / 2;
    bandTop.position.y = 0.22;
    const bandBot = bandTop.clone();
    bandBot.position.y = -0.22;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.2, 12), steel);
    neck.position.y = 0.48;
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.12), steel);
    spoon.position.set(0.24, 0.16, 0);
    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 10, 20), makePbr(0xfbbf24, 0.24, 0.92));
    pinRing.position.set(-0.18, 0.5, 0);
    g.add(body, bandTop, bandBot, neck, spoon, pinRing);
    return g;
  }

  if (subtype === 'pistol' || subtype === 'revolver') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.21, 0.15), subtype === 'revolver' ? steel : gunmetal);
    slide.position.set(0.1, 0.16, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, subtype === 'revolver' ? 0.72 : 0.42, 16), steel);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.56, 0.17, 0);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.54, 0.14), subtype === 'revolver' ? makePbr(0x7c2d12, 0.46, 0.1, { color: 0xfde68a, power: 2.6, intensity: 0.4 }) : polymer);
    grip.position.set(-0.24, -0.14, 0);
    grip.rotation.z = 0.28;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 16), gunmetal);
    guard.position.set(-0.02, -0.02, 0);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.03), steel);
    trigger.position.set(0.0, -0.01, 0);
    trigger.rotation.z = 0.32;
    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.075, 0.095), opticLens);
    laser.position.set(0.32, 0.03, 0);
    g.add(slide, barrel, grip, guard, trigger, laser);
    if (subtype === 'revolver') {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.26, 18), steel);
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(0.02, 0.14, 0);
      const topRib = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.045, 0.06), gunmetal);
      topRib.position.set(0.54, 0.23, 0);
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.04), steel);
      hammer.position.set(-0.34, 0.26, 0);
      hammer.rotation.z = -0.45;
      const brassRimMat = makePbr(0xf59e0b, 0.2, 0.94);
      for (let c = 0; c < 6; c++) {
        const ang = (c / 6) * Math.PI * 2;
        const rimShell = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.27, 10), brassRimMat);
        rimShell.rotation.z = Math.PI / 2;
        rimShell.position.set(0.02, 0.14 + Math.cos(ang) * 0.088, Math.sin(ang) * 0.088);
        g.add(rimShell);
      }
      g.add(cyl, topRib, hammer);
    } else {
      for (let s = -3; s <= 2; s++) {
        const serr = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.16, 0.162), steel);
        serr.position.set(-0.24 + s * 0.055, 0.16, 0);
        g.add(serr);
      }
      const comp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.21, 0.155), steel);
      comp.position.set(0.66, 0.16, 0);
      const rdsMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.13), polymer);
      rdsMount.position.set(-0.08, 0.30, 0);
      const rdsLens = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.11), opticLens);
      rdsLens.position.set(0.0, 0.32, 0);
      g.add(comp, rdsMount, rdsLens);
    }
    return g;
  }

  const isLong = subtype === 'sniper' || subtype === 'shotgun';
  const recLen = subtype === 'smg' ? 0.68 : 0.98;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(recLen, 0.24, 0.16), gunmetal);
  const barrelLen = subtype === 'sniper' ? 1.24 : isLong ? 1.04 : subtype === 'smg' ? 0.46 : 0.82;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, barrelLen, 16), steel);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(recLen * 0.5 + barrelLen * 0.45, 0.05, 0);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(barrelLen * 0.58, 0.17, 0.155), woodOrAccent);
  handguard.position.set(recLen * 0.5 + barrelLen * 0.25, 0.02, 0);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.066, subtype === 'smg' ? 0.38 : 0.20, 14), subtype === 'smg' ? polymer : gunmetal);
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(recLen * 0.5 + barrelLen * 0.92, 0.05, 0);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.23, 0.13), subtype === 'ak' ? woodOrAccent : polymer);
  stock.position.set(-recLen * 0.5 - 0.26, -0.03, 0);
  const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.14), polymer);
  buttpad.position.set(-recLen * 0.5 - 0.57, -0.04, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.40, 0.12), polymer);
  grip.position.set(-0.18, -0.26, 0);
  grip.rotation.z = 0.26;
  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 14), gunmetal);
  triggerGuard.position.set(-0.04, -0.15, 0);
  g.add(receiver, barrel, handguard, muzzle, stock, buttpad, grip, triggerGuard);

  if (subtype === 'ak') {
    const bananaMag = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.068, 10, 20, Math.PI * 0.36), woodOrAccent);
    bananaMag.position.set(0.48, -0.12, 0);
    bananaMag.rotation.z = -Math.PI * 0.68;
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, barrelLen * 0.62, 12), gunmetal);
    gasTube.rotation.z = Math.PI / 2;
    gasTube.position.set(recLen * 0.5 + barrelLen * 0.28, 0.135, 0);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), gunmetal);
    frontSight.position.set(recLen * 0.5 + barrelLen * 0.78, 0.14, 0);
    const dustCover = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, recLen * 0.88, 12, 1, false, 0, Math.PI), steel);
    dustCover.rotation.z = Math.PI / 2;
    dustCover.position.set(-0.02, 0.12, 0);
    g.add(bananaMag, gasTube, frontSight, dustCover);
  } else if (subtype === 'sniper') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.11), steel);
    mag.position.set(0.14, -0.20, 0);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.68, 16), polymer);
    scopeTube.rotation.z = Math.PI / 2;
    scopeTube.position.set(0.04, 0.24, 0);
    const objBell = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.058, 0.18, 16), gunmetal);
    objBell.rotation.z = Math.PI / 2;
    objBell.position.set(0.42, 0.24, 0);
    const eyeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, 0.14, 16), gunmetal);
    eyeBell.rotation.z = Math.PI / 2;
    eyeBell.position.set(-0.34, 0.24, 0);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.025, 16), opticLens);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.51, 0.24, 0);
    const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12), steel);
    turretTop.position.set(0.04, 0.31, 0);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.145), gunmetal);
    cheekRest.position.set(-recLen * 0.5 - 0.22, 0.10, 0);
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.44, 10), steel);
    bipodL.position.set(recLen * 0.5 + barrelLen * 0.52, -0.18, 0.11);
    bipodL.rotation.x = -0.32;
    bipodL.rotation.z = -0.18;
    const bipodR = bipodL.clone();
    bipodR.position.z = -0.11;
    bipodR.rotation.x = 0.32;
    g.add(mag, scopeTube, objBell, eyeBell, lens, turretTop, cheekRest, bipodL, bipodR);
  } else if (subtype === 'shotgun') {
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, barrelLen * 0.86, 14), gunmetal);
    magTube.rotation.z = Math.PI / 2;
    magTube.position.set(recLen * 0.5 + barrelLen * 0.40, -0.04, 0);
    const pumpForend = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.42, 14), makePbr(0x7c2d12, 0.48, 0.1));
    pumpForend.rotation.z = Math.PI / 2;
    pumpForend.position.set(recLen * 0.5 + 0.34, -0.04, 0);
    const ventRib = new THREE.Mesh(new THREE.BoxGeometry(barrelLen * 0.9, 0.03, 0.04), gunmetal);
    ventRib.position.set(recLen * 0.5 + barrelLen * 0.44, 0.11, 0);
    const shellHullMat = makePbr(0xdc2626, 0.3, 0.25);
    const shellBrassMat = makePbr(0xf59e0b, 0.2, 0.94);
    for (let sh = 0; sh < 5; sh++) {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 10), shellHullMat);
      hull.position.set(-0.22 + sh * 0.075, 0.02, 0.095);
      const brassBase = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 10), shellBrassMat);
      brassBase.position.set(-0.22 + sh * 0.075, 0.085, 0.095);
      g.add(hull, brassBase);
    }
    g.add(magTube, pumpForend, ventRib);
  } else {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.11), steel);
    mag.position.set(0.16, -0.28, 0);
    mag.rotation.z = -0.18;
    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.26, 12), polymer);
    foregrip.position.set(recLen * 0.5 + 0.22, -0.16, 0);
    const holoHousing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.13), gunmetal);
    holoHousing.position.set(0.04, 0.20, 0);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.10), opticLens);
    lens.position.set(0.14, 0.21, 0);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(recLen * 0.9, 0.035, 0.09), steel);
    rail.position.set(0, 0.135, 0);
    g.add(mag, foregrip, holoHousing, lens, rail);
  }
  return g;
}

function buildMeleeProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const bladeMat = makePbr(0xdbe4ee, 0.14, 0.96, { color: rimColor, power: 2.2, intensity: 0.55 });
  const darkGrip = makePbr(0x1f242d, 0.62, 0.18, { color: rimColor, power: 3.0, intensity: 0.3 });
  const brass = makePbr(0xd97706, 0.20, 0.94, { color: 0xfde68a, power: 2.3, intensity: 0.58 });

  if (subtype === 'cut_throat_razor') {
    const scaleL = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.03), makePbr(0xf8fafc, 0.2, 0.35, { color: rimColor, power: 2.4, intensity: 0.5 }));
    scaleL.position.set(-0.32, -0.14, 0.045);
    scaleL.rotation.z = 0.28;
    const scaleR = scaleL.clone();
    scaleR.position.z = -0.045;
    const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), brass);
    pivotPin.rotation.x = Math.PI / 2;
    pivotPin.position.set(0.08, -0.02, 0);
    const razorBlade = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.022), bladeMat);
    razorBlade.position.set(0.44, 0.18, 0);
    razorBlade.rotation.z = 0.42;
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.86, 10), brass);
    spine.rotation.z = Math.PI / 2 + 0.42;
    spine.position.set(0.41, 0.27, 0);
    g.add(scaleL, scaleR, pivotPin, razorBlade, spine);
    return g;
  }

  if (subtype === 'knuckles') {
    // Authentic 4-Finger Brass Knuckle Duster + Palm Brace + 4 Diamond Strike Studs
    const palmBar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.96, 14), brass);
    palmBar.rotation.z = Math.PI / 2;
    palmBar.position.set(0, -0.22, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 0.14), brass);
    bridge.position.set(0, 0.06, 0);
    g.add(palmBar, bridge);
    for (let i = 0; i < 4; i++) {
      const x = -0.39 + i * 0.26;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.042, 12, 24), brass);
      ring.position.set(x, 0.12, 0);
      const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), bladeMat);
      stud.position.set(x, 0.29, 0);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.12), brass);
      pillar.position.set(x, -0.08, 0);
      g.add(ring, stud, pillar);
    }
    return g;
  }

  if (subtype === 'stun_baton') {
    const plasmaMat = makePbr(0x38bdf8, 0.10, 0.4, { color: 0x67e8f9, power: 1.7, intensity: 1.0 }, { emissive: 0x0284c7, emissiveIntensity: 0.95 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 1.32, 16), darkGrip);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.026, 10, 20), brass);
    guard.rotation.x = Math.PI / 2;
    guard.position.y = -0.18;
    for (let c = 0; c < 4; c++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.016, 8, 18), plasmaMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.y = 0.12 + c * 0.13;
      g.add(coil);
    }
    const prongL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.24, 10), bladeMat);
    prongL.position.set(-0.06, 0.74, 0);
    const prongR = prongL.clone();
    prongR.position.x = 0.06;
    const arcSpark = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 8, 16, Math.PI), plasmaMat);
    arcSpark.position.set(0, 0.84, 0);
    g.add(shaft, guard, prongL, prongR, arcSpark);
    return g;
  }

  if (subtype === 'bat') {
    const batBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.052, 1.65, 16), makePbr(0x9a5b2d, 0.48, 0.08, { color: rimColor, power: 2.8, intensity: 0.35 }));
    const gripTape = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.054, 0.48, 14), darkGrip);
    gripTape.position.y = -0.52;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), brass);
    pommel.position.y = -0.84;
    const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 20), bladeMat);
    band1.rotation.x = Math.PI / 2;
    band1.position.y = 0.45;
    const band2 = band1.clone();
    band2.position.y = 0.65;
    g.add(batBody, gripTape, pommel, band1, band2);
    return g;
  }

  if (subtype === 'hammer') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 1.48, 14), makePbr(0x7c2d12, 0.5, 0.08));
    const gripSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.066, 0.48, 14), darkGrip);
    gripSleeve.position.y = -0.46;
    const headCore = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.26), bladeMat);
    headCore.position.y = 0.64;
    const strikeFaceL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.08, 8), brass);
    strikeFaceL.rotation.z = Math.PI / 2;
    strikeFaceL.position.set(-0.34, 0.64, 0);
    const strikeFaceR = strikeFaceL.clone();
    strikeFaceR.position.x = 0.34;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 14), brass);
    collar.position.y = 0.46;
    g.add(shaft, gripSleeve, headCore, strikeFaceL, strikeFaceR, collar);
    return g;
  }

  if (subtype === 'katana') {
    // Curved Sori Katana Blade + Ornate Circular Brass Tsuba + Diamond-Wrapped Tsuka
    for (let seg = 0; seg < 5; seg++) {
      const t = seg / 4;
      const segMesh = new THREE.Mesh(new THREE.BoxGeometry(0.095 - t * 0.025, 0.32, 0.022), bladeMat);
      segMesh.position.set(-Math.pow(t, 1.8) * 0.11, 0.20 + seg * 0.28, 0);
      segMesh.rotation.z = t * 0.12;
      g.add(segMesh);
    }
    const kissaki = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.18, 4), bladeMat);
    kissaki.position.set(-0.145, 1.50, 0);
    kissaki.rotation.set(0, Math.PI / 4, 0.15);
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.032, 24), brass);
    tsuba.position.y = 0.03;
    const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.04), brass);
    habaki.position.y = 0.07;
    const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.48, 12), makePbr(0x7f1d1d, 0.52, 0.15));
    tsuka.position.y = -0.22;
    for (let w = 0; w < 5; w++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.011, 6, 14), darkGrip);
      wrap.rotation.x = Math.PI / 2 + (w % 2 ? 0.3 : -0.3);
      wrap.position.y = -0.06 - w * 0.08;
      g.add(wrap);
    }
    const kashira = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.05, 0.05, 12), brass);
    kashira.position.y = -0.47;
    g.add(kissaki, tsuba, habaki, tsuka, kashira);
    return g;
  }

  // Tactical Combat Knife with Blood Fuller, Serrated Spine & Ring Pommel
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.88, 0.028), bladeMat);
  blade.position.y = 0.49;
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.64, 0.034), darkGrip);
  fuller.position.set(0.02, 0.46, 0);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.24, 4), bladeMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 1.04;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.065, 0.12), brass);
  guard.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.054, 0.42, 14), darkGrip);
  handle.position.y = -0.21;
  const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.02, 10, 20), brass);
  pommelRing.position.y = -0.47;
  g.add(blade, fuller, tip, guard, handle, pommelRing);
  return g;
}

/**
 * Bespoke Multi-Part 3D Models for ALL 13+ Crime Enhancers & Syndicate Tools
 * Zero duplicate glasses! Every single tool has an unmistakable 3D silhouette.
 */
function buildEnhancerProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const gunmetal = makePbr(0x272d38, 0.34, 0.82, { color: rimColor, power: 2.5, intensity: 0.48 });
  const steel = makePbr(0xcbd5e1, 0.18, 0.94, { color: rimColor, power: 2.4, intensity: 0.45 });
  const brass = makePbr(0xd97706, 0.22, 0.92, { color: 0xfef08a, power: 2.3, intensity: 0.62 });
  const crimson = makePbr(0xdc2626, 0.28, 0.42, { color: 0xfca5a5, power: 2.3, intensity: 0.58 });
  const cyanGlow = makePbr(0x22d3ee, 0.10, 0.25, { color: 0x67e8f9, power: 1.8, intensity: 0.95 }, { emissive: 0x0891b2, emissiveIntensity: 0.85 });
  const greenGlow = makePbr(0x22c55e, 0.12, 0.25, { color: 0x86efac, power: 1.8, intensity: 0.95 }, { emissive: 0x15803d, emissiveIntensity: 0.85 });
  const amberGlow = makePbr(0xf59e0b, 0.12, 0.2, { color: 0xfef08a, power: 1.7, intensity: 1.0 }, { emissive: 0xd97706, emissiveIntensity: 0.95 });

  switch (subtype) {
    case 'high_speed_drive': {
      // Finned NVMe RAID Duplicator Chassis + LED array + Gold PCIe edge
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 0.58), gunmetal);
      for (let i = -2; i <= 2; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 0.06), steel);
        fin.position.set(0, 0.17, i * 0.1);
        g.add(fin);
      }
      const pcie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.42), brass);
      pcie.position.set(0.64, -0.06, 0);
      const led1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), cyanGlow);
      led1.position.set(-0.46, 0.16, 0.22);
      const led2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), greenGlow);
      led2.position.set(-0.32, 0.16, 0.22);
      g.add(body, pcie, led1, led2);
      return g;
    }

    case 'paint_mask': {
      // Graffiti Respirator Mask + Twin Pink/Cyan Filter Cartridges + Spray Can
      const maskShell = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), gunmetal);
      maskShell.scale.set(0.95, 1.05, 0.85);
      maskShell.position.set(-0.22, 0, 0);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.24, 16), steel);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(-0.22, -0.08, 0.28);
      const filterMat = makePbr(0xec4899, 0.26, 0.45, { color: 0xf9a8d4, power: 2.2, intensity: 0.7 });
      const cartL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16), filterMat);
      cartL.rotation.z = 0.6;
      cartL.position.set(-0.48, -0.1, 0.2);
      const cartR = cartL.clone();
      cartR.rotation.z = -0.6;
      cartR.position.x = 0.04;
      const sprayCan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.78, 18), cyanGlow);
      sprayCan.position.set(0.46, -0.02, 0);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 12), steel);
      nozzle.position.set(0.46, 0.43, 0);
      g.add(maskShell, snout, cartL, cartR, sprayCan, nozzle);
      return g;
    }

    case 'skimmer': {
      // ATM Magstripe Card Skimmer Bezel + Gold EMV Card + Ribbon PCB
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.48, 0.36), makePbr(0x065f46, 0.28, 0.55, { color: 0x34d399, power: 2.2, intensity: 0.75 }));
      const slotMouth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.40), gunmetal);
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.78), brass);
      card.position.set(0, 0, 0.36);
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.06), greenGlow);
      pcb.position.set(0, 0.28, -0.14);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), cyanGlow);
      led.position.set(0.28, 0.16, 0.2);
      g.add(bezel, slotMouth, card, pcb, led);
      return g;
    }

    case 'duct_tape': {
      // Heavy Metallic Silver Industrial Duct Tape Roll + Peeled Tape Strip
      const outerRoll = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.18, 18, 36), steel);
      const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.34, 24, 1, true), makePbr(0xa16207, 0.72, 0.06, { color: 0xfde68a, power: 2.8, intensity: 0.35 }, { side: THREE.DoubleSide }));
      innerCore.rotation.x = Math.PI / 2;
      const sideDiscF = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.58, 32), steel);
      sideDiscF.position.z = 0.16;
      const sideDiscB = sideDiscF.clone();
      sideDiscB.rotation.y = Math.PI;
      sideDiscB.position.z = -0.16;
      const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.34), steel);
      tailStrip.position.set(0.56, -0.34, 0);
      tailStrip.rotation.z = -0.35;
      g.add(outerRoll, innerCore, sideDiscF, sideDiscB, tailStrip);
      return g;
    }

    case 'flashlight': {
      // Tactical Knurled Flashlight + Glowing Lens + Translucent Volumetric Beam
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.92, 18), gunmetal);
      body.rotation.z = Math.PI / 2;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.28, 20), gunmetal);
      head.rotation.z = Math.PI / 2;
      head.position.x = 0.54;
      const bezelRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 10, 22), brass);
      bezelRing.rotation.y = Math.PI / 2;
      bezelRing.position.x = 0.68;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 18), amberGlow);
      lens.rotation.z = Math.PI / 2;
      lens.position.x = 0.67;
      const beamCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.68, 20, 1, true),
        makePbr(0xfef08a, 0.1, 0.05, false, { transparent: true, opacity: 0.28, emissive: 0xfde047, emissiveIntensity: 0.9, side: THREE.DoubleSide })
      );
      beamCone.rotation.z = Math.PI / 2;
      beamCone.position.x = 1.02;
      g.add(body, head, bezelRing, lens, beamCone);
      return g;
    }

    case 'megaphone': {
      // Flared Red & White Street Hustler Bullhorn Megaphone
      const white = makePbr(0xf8fafc, 0.25, 0.2, { color: rimColor, power: 2.6, intensity: 0.4 });
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.92, 24), white);
      cone.rotation.z = -Math.PI / 2;
      const bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 12, 28), crimson);
      bellRim.rotation.y = Math.PI / 2;
      bellRim.position.x = 0.46;
      const rearCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 18), crimson);
      rearCap.rotation.z = Math.PI / 2;
      rearCap.position.x = -0.52;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.12), gunmetal);
      handle.position.set(-0.22, -0.3, 0);
      handle.rotation.z = 0.25;
      const acousticCore = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 16), brass);
      acousticCore.rotation.z = -Math.PI / 2;
      acousticCore.position.x = 0.24;
      g.add(cone, bellRim, rearCap, handle, acousticCore);
      return g;
    }

    case 'latex_gloves': {
      // Pair of Cobalt-Blue Nitrile Disposal Gloves + Bio-Neutralizer Vial
      const nitrile = makePbr(0x0284c7, 0.35, 0.12, { color: 0x7dd3fc, power: 2.2, intensity: 0.72 });
      const buildGlove = (xOff, rotZ) => {
        const gg = new THREE.Group();
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.12), nitrile);
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 10, 18), nitrile);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.24;
        gg.add(palm, cuff);
        for (let f = -1.5; f <= 1.5; f += 1) {
          const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.22, 6, 10), nitrile);
          finger.position.set(f * 0.085, 0.34, 0);
          gg.add(finger);
        }
        const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), nitrile);
        thumb.position.set(xOff < 0 ? 0.24 : -0.24, 0.06, 0);
        thumb.rotation.z = xOff < 0 ? -0.6 : 0.6;
        gg.add(thumb);
        gg.position.set(xOff, 0, 0);
        gg.rotation.z = rotZ;
        return gg;
      };
      g.add(buildGlove(-0.32, 0.14), buildGlove(0.32, -0.14));
      return g;
    }

    case 'office_chair': {
      // 5-Star Executive Hacker Command Swivel Chair
      const leather = makePbr(0x1e293b, 0.42, 0.32, { color: rimColor, power: 2.4, intensity: 0.55 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.64), leather);
      seat.position.y = -0.08;
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.12), leather);
      backrest.position.set(0, 0.4, -0.26);
      backrest.rotation.x = -0.1;
      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.14), crimson);
      headrest.position.set(0, 0.9, -0.3);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), steel);
      armL.position.set(-0.38, 0.12, -0.04);
      const armR = armL.clone();
      armR.position.x = 0.38;
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.38, 12), steel);
      piston.position.y = -0.32;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.42), steel);
        leg.position.set(Math.cos(ang) * 0.2, -0.5, Math.sin(ang) * 0.2);
        leg.rotation.y = -ang;
        g.add(leg);
      }
      g.add(seat, backrest, headrest, armL, armR, piston);
      return g;
    }

    case 'magnifying_glass': {
      // Forger's Brass Rim Loupe Magnifying Glass + Turned Mahogany Handle
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 14, 32), brass);
      rim.position.set(0.18, 0.18, 0);
      const glassLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.39, 0.06, 28),
        makePbr(0xe0f2fe, 0.05, 0.1, { color: 0x7dd3fc, power: 1.8, intensity: 0.85 }, { transparent: true, opacity: 0.52, clearcoat: 1.0 })
      );
      glassLens.rotation.x = Math.PI / 2;
      glassLens.position.set(0.18, 0.18, 0);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 14), brass);
      collar.rotation.z = -Math.PI / 4;
      collar.position.set(-0.16, -0.16, 0);
      const woodHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.68, 16), makePbr(0x7c2d12, 0.38, 0.12, { color: 0xfde68a, power: 2.6, intensity: 0.4 }));
      woodHandle.rotation.z = -Math.PI / 4;
      woodHandle.position.set(-0.44, -0.44, 0);
      g.add(rim, glassLens, collar, woodHandle);
      return g;
    }

    case 'ergonomic_keyboard': {
      // Split Backlit RGB Cyber-Scammer Mechanical Keyboard + Coiled Cable
      const buildHalf = (side) => {
        const half = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.09, 0.42), gunmetal);
        const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.34), side < 0 ? cyanGlow : makePbr(0xe879f9, 0.15, 0.3, false, { emissive: 0xc026d3, emissiveIntensity: 0.8 }));
        glowStrip.position.y = 0.02;
        half.add(deck, glowStrip);
        half.position.set(side * 0.36, 0, 0);
        half.rotation.y = side * -0.24;
        half.rotation.x = 0.22;
        return half;
      };
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 10, 22, Math.PI), brass);
      cable.rotation.x = Math.PI / 2;
      cable.position.set(0, 0.04, -0.24);
      g.add(buildHalf(-1), buildHalf(1), cable);
      return g;
    }

    case 'hacking_rig': {
      // Hinged Glowing Cyberdeck Laptop + Antenna + Holographic Screen
      const baseDeck = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.72), gunmetal);
      baseDeck.position.y = -0.24;
      const keyMatrix = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.42), greenGlow);
      keyMatrix.position.set(0, -0.22, 0.06);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.68, 0.06), gunmetal);
      lid.position.set(0, 0.12, -0.38);
      lid.rotation.x = -0.22;
      const holoScreen = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.07), cyanGlow);
      holoScreen.position.set(0, 0.12, -0.37);
      holoScreen.rotation.x = -0.22;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.52, 10), brass);
      antenna.position.set(0.48, 0.38, -0.38);
      g.add(baseDeck, keyMatrix, lid, holoScreen, antenna);
      return g;
    }

    case 'windproof_lighter': {
      // Open Flip-Top Brass Zippo Arson Lighter + Dual-Layer 3D Flame
      const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.24), brass);
      caseBody.position.y = -0.22;
      const openLid = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 0.24), brass);
      openLid.position.set(-0.36, 0.22, 0);
      openLid.rotation.z = 1.95;
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.24, 14), steel);
      chimney.position.set(0.06, 0.22, 0);
      const sparkWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 14), gunmetal);
      sparkWheel.rotation.x = Math.PI / 2;
      sparkWheel.position.set(-0.12, 0.18, 0);
      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 16), amberGlow);
      outerFlame.position.set(0.06, 0.54, 0);
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 12), cyanGlow);
      innerFlame.position.set(0.06, 0.42, 0);
      g.add(caseBody, openLid, chimney, sparkWheel, outerFlame, innerFlame);
      return g;
    }

    case 'crowbar': {
      // Forged Crimson & Steel Swan-Neck Pry-Bar
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 1.38, 8), crimson);
      const hookCurve = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.052, 10, 18, Math.PI * 0.85), steel);
      hookCurve.position.set(0.16, 0.68, 0);
      const clawTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.12), steel);
      clawTip.position.set(0.3, 0.58, 0);
      clawTip.rotation.z = -0.4;
      const chiselFoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.12), steel);
      chiselFoot.position.set(-0.04, -0.74, 0);
      chiselFoot.rotation.z = 0.25;
      g.add(shaft, hookCurve, clawTip, chiselFoot);
      return g;
    }

    case 'lockpick': {
      // Fanned Polished Steel Lockpicks + Brass Collar + L-Tension Wrench
      const pouch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.46, 16), brass);
      pouch.position.y = -0.34;
      for (let i = -1.5; i <= 1.5; i += 1) {
        const pick = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.82, 0.018), steel);
        pick.position.set(i * 0.11, 0.18, 0);
        pick.rotation.z = -i * 0.16;
        const hook = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.022), cyanGlow);
        hook.position.set(i * 0.18, 0.58, 0);
        g.add(pick, hook);
      }
      const tension = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.03), brass);
      tension.position.set(0.28, -0.1, 0.08);
      g.add(pouch, tension);
      return g;
    }

    case 'drill': {
      // Heavy Twin-Handle Thermal Vault Breach Drill + Molten Auger Bit
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 0.32), makePbr(0xd97706, 0.32, 0.65, { color: 0xfef08a, power: 2.4, intensity: 0.55 }));
      const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 16), gunmetal);
      chuck.rotation.z = -Math.PI / 2;
      chuck.position.x = 0.48;
      const auger = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.68, 12), amberGlow);
      auger.rotation.z = -Math.PI / 2;
      auger.position.x = 0.92;
      const gripRear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), gunmetal);
      gripRear.position.set(-0.3, -0.32, 0);
      const gripTop = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12), gunmetal);
      gripTop.rotation.x = Math.PI / 2;
      gripTop.position.set(0.12, 0.24, 0);
      g.add(body, chuck, auger, gripRear, gripTop);
      return g;
    }

    case 'keycard': {
      // Obsidian & Gold Encrypted Syndicate RFID Vault Keycard
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.74, 0.05), gunmetal);
      const border = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.78, 0.03), brass);
      const emvChip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.07), brass);
      emvChip.position.set(-0.34, 0.06, 0);
      const holoStrip = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 0.065), cyanGlow);
      holoStrip.position.set(0, -0.2, 0);
      const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), greenGlow);
      crest.position.set(0.34, 0.12, 0.04);
      g.add(border, card, emvChip, holoStrip, crest);
      return g;
    }

    case 'glasses':
    default: {
      // Detective Wire-Rim Magnifying Glasses / Night-Vision Specs
      const lensRingL = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 12, 26), brass);
      lensRingL.position.set(-0.3, 0, 0.12);
      const lensRingR = lensRingL.clone();
      lensRingR.position.x = 0.3;
      const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 22), cyanGlow);
      glassL.rotation.x = Math.PI / 2;
      glassL.position.set(-0.3, 0, 0.12);
      const glassR = glassL.clone();
      glassR.position.x = 0.3;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), brass);
      bridge.position.set(0, 0.06, 0.12);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.68), gunmetal);
      armL.position.set(-0.54, 0.03, -0.2);
      const armR = armL.clone();
      armR.position.x = 0.54;
      g.add(lensRingL, lensRingR, glassL, glassR, bridge, armL, armR);
      return g;
    }
  }
}

function buildDrugVialProcedural(subtype) {
  const g = new THREE.Group();
  const palette = {
    xanax: 0x38bdf8,
    ecstasy: 0xf43f5e,
    vicodin: 0xf59e0b,
    cannabis: 0x22c55e,
    lsd: 0xa855f7,
    ketamine: 0x06b6d4,
    shrooms: 0xc084fc,
    opium: 0xef4444,
    pcp: 0xeab308,
    speed: 0xec4899,
  };
  const chemHex = palette[subtype] || 0x2dd4bf;

  const glass = makePbr(0xdbeafe, 0.06, 0.08, { color: chemHex, power: 2.0, intensity: 0.72 }, {
    transparent: true,
    opacity: 0.44,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const serum = makePbr(chemHex, 0.18, 0.15, { color: chemHex, power: 1.8, intensity: 0.95 }, {
    emissive: chemHex,
    emissiveIntensity: 0.78,
  });
  const capMat = makePbr(0xcbd5e1, 0.24, 0.92, { color: chemHex, power: 2.8, intensity: 0.4 });
  const pillWhite = makePbr(0xf8fafc, 0.25, 0.1, { color: chemHex, power: 3.0, intensity: 0.35 });

  const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.05, 22), glass);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.72, 18), serum);
  core.position.y = -0.09;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 18), glass);
  neck.position.y = 0.58;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 20), capMat);
  cap.position.y = 0.72;

  const pill1A = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 8, 14), serum);
  pill1A.position.set(0.54, -0.22, 0.18);
  pill1A.rotation.set(0.4, 0.2, 0.65);
  const pill2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.15, 8, 14), pillWhite);
  pill2.position.set(-0.5, 0.18, 0.22);
  pill2.rotation.set(-0.35, 0.4, -0.5);

  g.add(vial, core, neck, cap, pill1A, pill2);
  g.rotation.z = 0.12;
  return g;
}

function buildMedicalProcedural(subtype) {
  const g = new THREE.Group();
  const crimson = makePbr(0xdc2626, 0.24, 0.22, { color: 0xfca5a5, power: 2.4, intensity: 0.65 }, { emissive: 0x7f1d1d, emissiveIntensity: 0.35 });
  const whiteCase = makePbr(0xf1f5f9, 0.32, 0.18, { color: 0x38bdf8, power: 2.8, intensity: 0.4 });
  const steel = makePbr(0x94a3b8, 0.22, 0.92, { color: 0xe2e8f0, power: 2.8, intensity: 0.38 });

  if (subtype === 'bloodbag') {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.04, 0.24), makePbr(0xb91c1c, 0.14, 0.1, { color: 0xf87171, power: 2.0, intensity: 0.8 }, { transparent: true, opacity: 0.86, clearcoat: 0.9 }));
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.26), whiteCase);
    label.position.y = 0.04;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.28), crimson);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.28), crimson);
    const port1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12), steel);
    port1.position.set(-0.18, 0.64, 0);
    const port2 = port1.clone();
    port2.position.x = 0.18;
    g.add(pouch, label, crossH, crossV, port1, port2);
    return g;
  }

  if (subtype === 'syringe') {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.96, 18), makePbr(0xe0f2fe, 0.1, 0.1, { color: 0x34d399, power: 2.0, intensity: 0.7 }, { transparent: true, opacity: 0.55 }));
    const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.64, 16), makePbr(0x10b981, 0.18, 0.2, { color: 0x6ee7b7, power: 1.8, intensity: 0.95 }, { emissive: 0x059669, emissiveIntensity: 0.75 }));
    fluid.position.y = -0.08;
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 12), steel);
    plunger.position.y = 0.62;
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), steel);
    thumb.position.y = 0.88;
    const needle = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.42, 12), steel);
    needle.rotation.x = Math.PI;
    needle.position.y = -0.68;
    g.add(barrel, fluid, plunger, thumb, needle);
    g.rotation.z = -0.58;
    return g;
  }

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.84, 0.42), subtype === 'small_medkit' ? crimson : whiteCase);
  const crossMat = subtype === 'small_medkit' ? whiteCase : crimson;
  const cH = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.47), crossMat);
  const cV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.47), crossMat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.042, 10, 20, Math.PI), steel);
  handle.position.y = 0.42;
  const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.46), steel);
  latchL.position.set(-0.36, 0.36, 0);
  const latchR = latchL.clone();
  latchR.position.x = 0.36;
  g.add(box, cH, cV, handle, latchL, latchR);
  return g;
}

function buildBoosterProcedural(subtype) {
  const g = new THREE.Group();
  const gold = makePbr(0xf59e0b, 0.2, 0.94, { color: 0xfef08a, power: 2.2, intensity: 0.7 });
  const obsidian = makePbr(0x18181b, 0.28, 0.72, { color: 0xfbbf24, power: 2.6, intensity: 0.5 });
  const neon = makePbr(0xa3e635, 0.15, 0.3, { color: 0xbef264, power: 1.8, intensity: 0.95 }, { emissive: 0x65a30d, emissiveIntensity: 0.85 });

  if (subtype === 'fhc') {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.82, 0.12), obsidian);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.88, 0.08), gold);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 20), gold);
    seal.rotation.x = Math.PI / 2;
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), neon);
    crown.position.set(0, 0, 0.14);
    g.add(trim, plaque, seal, crown);
    return g;
  }

  if (subtype === 'edvd') {
    const caseBox = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.06, 0.1), obsidian);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 28), makePbr(0xe879f9, 0.1, 0.92, { color: 0x38bdf8, power: 1.8, intensity: 0.9 }));
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.07;
    const hub = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 10, 22), gold);
    hub.position.z = 0.1;
    g.add(caseBox, disc, hub);
    return g;
  }

  if (subtype === 'alcohol') {
    // Faceted Crystal Reserve Bourbon Decanter + Amber Liquor Core + Cut-Crystal Stopper
    const crystal = makePbr(0xe0f2fe, 0.04, 0.08, { color: 0xfde68a, power: 2.0, intensity: 0.72 }, { transparent: true, opacity: 0.46, clearcoat: 1.0 });
    const bourbon = makePbr(0xb45309, 0.14, 0.18, { color: 0xfbbf24, power: 1.8, intensity: 0.92 }, { emissive: 0x78350f, emissiveIntensity: 0.55 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.78, 8), crystal);
    bottle.position.y = -0.14;
    const liquor = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.52, 8), bourbon);
    liquor.position.y = -0.22;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 0.22, 8), crystal);
    shoulder.position.y = 0.36;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.24, 12), crystal);
    neck.position.y = 0.56;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.025, 10, 20), gold);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.52;
    const stopper = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), crystal);
    stopper.position.y = 0.80;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.04), gold);
    plaque.position.set(0, -0.10, 0.38);
    g.add(bottle, liquor, shoulder, neck, collar, stopper, plaque);
    return g;
  }

  if (subtype === 'candy') {
    // Luxury Champagne-Gold Foil Praline Box + Crimson Ribbon + 3 Sculpted Truffles
    const crimson = makePbr(0xdc2626, 0.28, 0.35, { color: 0xfca5a5, power: 2.2, intensity: 0.7 });
    const choc = makePbr(0x451a03, 0.38, 0.12, { color: 0xfde68a, power: 2.5, intensity: 0.45 });
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.26, 0.82), gold);
    boxBase.position.y = -0.12;
    const innerTray = new THREE.Mesh(new THREE.BoxGeometry(1.00, 0.08, 0.70), obsidian);
    innerTray.position.y = 0.02;
    const ribbonX = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.12), crimson);
    ribbonX.position.y = -0.12;
    for (let t = -1; t <= 1; t++) {
      const praline = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), choc);
      praline.scale.set(1, 0.78, 1);
      praline.position.set(t * 0.30, 0.11, 0);
      const leaf = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), gold);
      leaf.position.set(t * 0.30, 0.22, 0);
      g.add(praline, leaf);
    }
    g.add(boxBase, innerTray, ribbonX);
    return g;
  }

  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.12, 24), obsidian);
  const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.09, 24), gold);
  topRim.position.y = 0.58;
  const botRim = topRim.clone();
  botRim.position.y = -0.58;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.348, 0.348, 0.32, 24), neon);
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), gold);
  tab.rotation.x = Math.PI / 2;
  tab.position.set(0.06, 0.64, 0);
  g.add(can, topRim, botRim, band, tab);
  return g;
}

function buildArmorProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const tactical = makePbr(0x272d38, 0.42, 0.58, { color: rimColor, power: 2.5, intensity: 0.5 });
  const plate = makePbr(0x475569, 0.28, 0.84, { color: rimColor, power: 2.6, intensity: 0.45 });
  const visorMat = makePbr(0x0ea5e9, 0.08, 0.35, { color: 0x7dd3fc, power: 1.9, intensity: 0.88 }, { transparent: true, opacity: 0.78 });
  const nvgGlow = makePbr(0x10b981, 0.08, 0.3, { color: 0x6ee7b7, power: 1.7, intensity: 1.0 }, { emissive: 0x059669, emissiveIntensity: 0.95 });
  const gold = makePbr(0xf59e0b, 0.2, 0.95, { color: 0xfef08a, power: 2.2, intensity: 0.72 });

  if (subtype === 'helmet') {
    // FAST Ballistic Helmet + Quad-Tube Panoramic GPNVG-18 Night-Vision Pods + ARC Rails
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.64), tactical);
    dome.position.y = 0.06;
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 20, 1, false, -Math.PI * 0.34, Math.PI * 0.68), visorMat);
    visor.position.set(0, -0.04, 0.06);
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), plate);
    nvgMount.position.set(0, 0.28, 0.45);
    const bridgeBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.08), plate);
    bridgeBar.position.set(0, 0.22, 0.56);
    for (let p = 0; p < 4; p++) {
      const px = -0.255 + p * 0.17;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.26, 14), tactical);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(px, 0.16, 0.64);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 14), nvgGlow);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(px, 0.16, 0.77);
      g.add(tube, lens);
    }
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.48), plate);
    railL.position.set(-0.48, 0.08, 0);
    const railR = railL.clone();
    railR.position.x = 0.48;
    const batteryPack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.12), plate);
    batteryPack.position.set(0, 0.12, -0.50);
    g.add(dome, visor, nvgMount, bridgeBar, railL, railR, batteryPack);
    return g;
  }

  if (subtype === 'ring') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 16, 32), gold);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.14, 8), gold);
    bezel.position.set(0, 0.46, 0);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), makePbr(0xe11d48, 0.08, 0.2, { color: 0xfda4af, power: 1.8, intensity: 0.95 }, { emissive: 0x9f1239, emissiveIntensity: 0.6 }));
    gem.position.set(0, 0.56, 0);
    g.add(band, bezel, gem);
    return g;
  }

  if (subtype === 'boots') {
    // Pair of Steel-Toe Tactical Combat Boots with Treaded Lug Soles & Ankle Buckles
    const buildBoot = (side) => {
      const b = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.62, 14), tactical);
      shaft.position.set(0, 0.12, -0.08);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.68), tactical);
      foot.position.set(0, -0.22, 0.08);
      const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), plate);
      toeCap.scale.set(0.98, 0.72, 1.05);
      toeCap.position.set(0, -0.22, 0.34);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.10, 0.74), gold);
      sole.position.set(0, -0.36, 0.09);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.38), plate);
      buckle.position.set(0, 0.08, -0.08);
      b.add(shaft, foot, toeCap, sole, buckle);
      b.position.set(side * 0.30, 0, 0);
      b.rotation.y = side * -0.14;
      return b;
    };
    g.add(buildBoot(-1), buildBoot(1));
    return g;
  }

  if (subtype === 'gloves') {
    // Pair of Carbon-Knuckle Assault Gauntlets with Articulated Fingers & Wrist Straps
    const buildGauntlet = (side) => {
      const gl = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.13), tactical);
      const knucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.12, 0.16), gold);
      knucklePlate.position.set(0, 0.16, 0.02);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.22, 14), plate);
      cuff.position.set(0, -0.30, 0);
      gl.add(palm, knucklePlate, cuff);
      for (let f = -1.5; f <= 1.5; f += 1) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.24, 6, 10), tactical);
        finger.position.set(f * 0.09, 0.36, 0);
        gl.add(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 6, 10), plate);
      thumb.position.set(side < 0 ? 0.24 : -0.24, 0.05, 0.04);
      thumb.rotation.z = side < 0 ? -0.58 : 0.58;
      gl.add(thumb);
      gl.position.set(side * 0.34, 0, 0);
      gl.rotation.z = side * -0.12;
      return gl;
    };
    g.add(buildGauntlet(-1), buildGauntlet(1));
    return g;
  }

  if (subtype === 'pants') {
    // Ballistic Ripstop Tactical Cargo Trousers + Dual Knee-Pad Shells + Riggers Belt
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.20, 0.40), tactical);
    waist.position.y = 0.46;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.43), gold);
    belt.position.y = 0.50;
    g.add(waist, belt);
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.48, 14), tactical);
      thigh.position.set(side * 0.22, 0.16, 0);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.14, 0.48, 14), tactical);
      shin.position.set(side * 0.23, -0.30, 0);
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.20), plate);
      kneePad.position.set(side * 0.225, -0.06, 0.12);
      const cargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.24, 0.24), plate);
      cargoPocket.position.set(side * 0.38, 0.14, 0);
      g.add(thigh, shin, kneePad, cargoPocket);
    }
    return g;
  }

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.05, 0.38), tactical);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.44), plate);
  chestPlate.position.y = 0.16;
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.4), tactical);
  strapL.position.set(-0.28, 0.62, 0);
  const strapR = strapL.clone();
  strapR.position.x = 0.28;
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.12), gold);
  radio.position.set(-0.30, 0.34, 0.24);
  const radioAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.34, 8), plate);
  radioAnt.position.set(-0.33, 0.58, 0.24);
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.48), plate);
    pouch.position.set(i * 0.25, -0.24, 0.02);
    g.add(pouch);
  }
  g.add(torso, chestPlate, strapL, strapR, radio, radioAnt);
  return g;
}

function buildContrabandVehicleCacheProcedural(category, subtype, rimColor) {
  const g = new THREE.Group();
  const gold = makePbr(0xfbbf24, 0.16, 0.96, { color: 0xfef08a, power: 2.0, intensity: 0.78 });
  const steel = makePbr(0x64748b, 0.25, 0.9, { color: rimColor, power: 2.6, intensity: 0.48 });
  const dark = makePbr(0x1e293b, 0.42, 0.55, { color: rimColor, power: 2.8, intensity: 0.4 });
  const neon = makePbr(0x22d3ee, 0.12, 0.3, { color: 0x67e8f9, power: 1.8, intensity: 0.95 }, { emissive: 0x0891b2, emissiveIntensity: 0.8 });

  if (category === 'vehicle') {
    const addDetailedWheelSet = (coords, tireR = 0.19, tireW = 0.12, hubMat = gold) => {
      const tireGeo = new THREE.CylinderGeometry(tireR, tireR, tireW, 20);
      const rimGeo = new THREE.CylinderGeometry(tireR * 0.62, tireR * 0.62, tireW + 0.015, 12);
      for (let i = 0; i < coords.length; i++) {
        const [wx, wy, wz] = coords[i];
        const tire = new THREE.Mesh(tireGeo, dark);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(wx, wy, wz);
        const rim = new THREE.Mesh(rimGeo, hubMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(wx, wy, wz);
        g.add(tire, rim);
      }
    };

    if (subtype === 'mountain_bike') {
      // Street Getaway Stealth Enduro Bike: Spoked Wheels + Brake Rotors + Suspension Fork + Chainring
      const frameMat = makePbr(0x16a34a, 0.22, 0.72, { color: 0x86efac, power: 2.2, intensity: 0.65 });
      const wheelF = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 14, 28), dark);
      wheelF.position.set(0.54, -0.18, 0);
      const wheelR = wheelF.clone();
      wheelR.position.x = -0.54;
      const rotorF = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16), steel);
      rotorF.rotation.x = Math.PI / 2;
      rotorF.position.set(0.54, -0.18, 0.03);
      const rotorR = rotorF.clone();
      rotorR.position.x = -0.54;
      const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), gold);
      chainring.rotation.x = Math.PI / 2;
      chainring.position.set(-0.08, -0.18, 0.04);
      const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.82, 10), frameMat);
      topTube.rotation.z = Math.PI / 2 - 0.1;
      topTube.position.set(0, 0.16, 0);
      const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.78, 10), frameMat);
      downTube.rotation.z = 0.88;
      downTube.position.set(0.14, -0.02, 0);
      const chainStay = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.52, 10), frameMat);
      chainStay.rotation.z = Math.PI / 2;
      chainStay.position.set(-0.31, -0.18, 0);
      const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.62, 10), steel);
      seatPost.rotation.z = 0.22;
      seatPost.position.set(-0.28, 0.06, 0);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.15), dark);
      saddle.position.set(-0.34, 0.36, 0);
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.68, 10), gold);
      fork.rotation.z = 0.28;
      fork.position.set(0.44, 0.08, 0);
      const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.56, 10), steel);
      bars.rotation.x = Math.PI / 2;
      bars.position.set(0.36, 0.39, 0);
      const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), neon);
      headlamp.position.set(0.43, 0.36, 0);
      g.add(wheelF, wheelR, rotorF, rotorR, chainring, topTube, downTube, chainStay, seatPost, saddle, fork, bars, headlamp);
      return g;
    }

    if (subtype === 'armored_van') {
      // Pier 4 Heavy Bullion Armored Van: Sloped Ballistic Cab + Grille + Mirrors + Roof Turret + Wheel Flares
      const armorBodyMat = makePbr(0x334155, 0.30, 0.86, { color: 0xfbbf24, power: 2.2, intensity: 0.62 }, { clearcoat: 0.65 });
      const trimGold = makePbr(0xf3c969, 0.18, 0.95, { color: 0xfef08a, power: 2.1, intensity: 0.72 });
      const beaconAmber = makePbr(0xf59e0b, 0.10, 0.25, false, { emissive: 0xd97706, emissiveIntensity: 0.95 });
      const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.62, 0.80), armorBodyMat);
      cargoBox.position.set(-0.20, 0.16, 0);
      const roofRib = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.05, 0.72), dark);
      roofRib.position.set(-0.20, 0.49, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.76), armorBodyMat);
      cab.position.set(0.58, 0.09, 0);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.74), armorBodyMat);
      hood.position.set(0.76, -0.01, 0);
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, 0.66), neon);
      windshield.position.set(0.74, 0.22, 0);
      windshield.rotation.z = 0.32;
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.20, 0.46), dark);
      grille.position.set(0.93, -0.01, 0);
      const bullbar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.84), trimGold);
      bullbar.position.set(0.96, -0.06, 0);
      const roofHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 18), steel);
      roofHatch.position.set(-0.12, 0.53, 0);
      const beaconL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.08, 12), beaconAmber);
      beaconL.position.set(0.46, 0.37, 0.24);
      const beaconR = beaconL.clone();
      beaconR.position.z = -0.24;
      const sideTrimL = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.07, 0.84), trimGold);
      sideTrimL.position.set(-0.20, 0.04, 0);
      const viewportSlit = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.10, 0.83), neon);
      viewportSlit.position.set(-0.22, 0.28, 0);
      const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.09), steel);
      mirrorL.position.set(0.66, 0.20, 0.44);
      const mirrorR = mirrorL.clone();
      mirrorR.position.z = -0.44;
      const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.13), neon);
      lightL.position.set(0.93, 0.03, 0.28);
      const lightR = lightL.clone();
      lightR.position.z = -0.28;
      addDetailedWheelSet([[0.54, -0.18, 0.41], [0.54, -0.18, -0.41], [-0.52, -0.18, 0.41], [-0.52, -0.18, -0.41]], 0.20, 0.14, trimGold);
      g.add(cargoBox, roofRib, cab, hood, windshield, grille, bullbar, roofHatch, beaconL, beaconR, sideTrimL, viewportSlit, mirrorL, mirrorR, lightL, lightR);
      return g;
    }

    if (subtype === 'interceptor_sedan') {
      // Apex Interceptor AWD Pursuit Sedan: Midnight Blue Clearcoat + Hood Scoop + Stealth Lightbar + Diffuser
      const midnight = makePbr(0x1e3a8a, 0.16, 0.84, { color: 0x38bdf8, power: 2.1, intensity: 0.72 }, { clearcoat: 1.0 });
      const sirenRed = makePbr(0xef4444, 0.12, 0.3, false, { emissive: 0xdc2626, emissiveIntensity: 0.9 });
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.26, 0.76), midnight);
      chassis.position.y = 0.02;
      const fastback = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 0.66), midnight);
      fastback.position.set(-0.06, 0.24, 0);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.68), neon);
      glass.position.set(-0.06, 0.23, 0);
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.30), dark);
      scoop.position.set(0.46, 0.17, 0);
      const lightbarL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), sirenRed);
      lightbarL.position.set(0.02, 0.38, 0.13);
      const lightbarR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), neon);
      lightbarR.position.set(0.02, 0.38, -0.13);
      const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.72), dark);
      diffuser.position.set(-0.78, -0.06, 0);
      addDetailedWheelSet([[0.48, -0.14, 0.39], [0.48, -0.14, -0.39], [-0.48, -0.14, 0.39], [-0.48, -0.14, -0.39]], 0.185, 0.12, steel);
      g.add(chassis, fastback, glass, scoop, lightbarL, lightbarR, diffuser);
      return g;
    }

    // Nightshade GT Twin-Turbo Supercar: Sculpted Aero Splitter, Flared Arches, Panoramic Canopy & GT Wing
    const crimsonCoat = makePbr(0xdc2626, 0.14, 0.82, { color: 0xfca5a5, power: 2.1, intensity: 0.7 }, { clearcoat: 1.0 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.24, 0.78), crimsonCoat);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.74), crimsonCoat);
    nose.position.set(0.76, -0.04, 0);
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.82), dark);
    splitter.position.set(0.84, -0.12, 0);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), neon);
    canopy.scale.set(1.25, 0.52, 0.76);
    canopy.position.set(-0.04, 0.18, 0);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.84), dark);
    wingBlade.position.set(-0.72, 0.30, 0);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.03), gold);
    strutL.position.set(-0.70, 0.20, 0.26);
    const strutR = strutL.clone();
    strutR.position.z = -0.26;
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.16), neon);
    headL.position.set(0.86, 0.02, 0.25);
    const headR = headL.clone();
    headR.position.z = -0.25;
    addDetailedWheelSet([[0.48, -0.13, 0.40], [0.48, -0.13, -0.40], [-0.48, -0.13, 0.40], [-0.48, -0.13, -0.40]], 0.185, 0.13, gold);
    g.add(chassis, nose, splitter, canopy, wingBlade, strutL, strutR, headL, headR);
    return g;
  }

  if (category === 'cache') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.76, 0.84), dark);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.16, 0.88), steel);
    lid.position.y = 0.4;
    for (let i = -1; i <= 1; i += 2) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.92), gold);
      latch.position.set(i * 0.36, 0.28, 0);
      g.add(latch);
    }
    const coreStrip = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.08, 0.86), neon);
    coreStrip.position.y = 0.05;
    g.add(crate, lid, coreStrip);
    return g;
  }

  if (subtype === 'orchid') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.42, 16), gold);
    pot.position.y = -0.38;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 10), makePbr(0x16a34a, 0.5, 0.1));
    const petalMat = makePbr(0xe879f9, 0.22, 0.2, { color: 0xf5d0fe, power: 2.0, intensity: 0.85 }, { emissive: 0xa21caf, emissiveIntensity: 0.45 });
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), petalMat);
      petal.scale.set(1.2, 0.45, 0.8);
      petal.position.set(Math.cos(ang) * 0.24, 0.36, Math.sin(ang) * 0.24);
      g.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), gold);
    center.position.y = 0.42;
    g.add(pot, stem, center);
    return g;
  }

  if (subtype === 'plushie') {
    const plushMat = makePbr(0xd97706, 0.68, 0.08, { color: 0xfde68a, power: 2.4, intensity: 0.55 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), plushMat);
    torso.position.y = -0.18;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), plushMat);
    head.position.y = 0.34;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), plushMat);
    earL.position.set(-0.24, 0.58, 0);
    const earR = earL.clone();
    earR.position.x = 0.24;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), neon);
    eyeL.position.set(-0.11, 0.38, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 20), gold);
    base.position.y = -0.56;
    g.add(torso, head, earL, earR, eyeL, eyeR, base);
    return g;
  }

  // Stacked Gold Bullion Bars
  const barGeo = new THREE.BoxGeometry(0.86, 0.24, 0.42);
  const b1 = new THREE.Mesh(barGeo, gold);
  b1.position.set(-0.24, -0.16, 0);
  const b2 = new THREE.Mesh(barGeo, gold);
  b2.position.set(0.24, -0.16, 0);
  const b3 = new THREE.Mesh(barGeo, gold);
  b3.position.set(0, 0.14, 0);
  b3.rotation.y = 0.18;
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), neon);
  seal.position.set(0, 0.28, 0);
  g.add(b1, b2, b3, seal);
  return g;
}

const _weaponAssetPromiseCache = new Map();
const _weaponUpgradeListeners = new Set();

export function onWeaponAssetUpgraded(fn) {
  _weaponUpgradeListeners.add(fn);
  return () => _weaponUpgradeListeners.delete(fn);
}

function applyPbrAndRimToLoadedWeapon(rootObj, rimColor) {
  const matTable = (typeof globalThis !== 'undefined' && globalThis.ZONE_WEAPON_MATS) || {};
  rootObj.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const srcMats = Array.isArray(node.material) ? node.material : [node.material];
    const nextMats = srcMats.map((m) => {
      if (!m) return makePbr(0x4a4e55, 0.38, 0.82, { color: rimColor, power: 2.8, intensity: 0.36 });
      const override = matTable[m.name] || null;
      if (override) {
        return makePbr(override.color, override.roughness, override.metalness, { color: rimColor, power: 2.8, intensity: 0.36 }, {
          transparent: !!override.transparent,
          opacity: override.opacity !== undefined ? override.opacity : 1.0,
        });
      }
      const cloned = m.isMeshStandardMaterial ? m.clone() : new THREE.MeshStandardMaterial({
        color: m.color ? m.color.getHex() : 0x585d63,
        map: m.map || null,
        roughness: 0.36,
        metalness: 0.78,
      });
      if (cloned.map) cloned.map.colorSpace = THREE.SRGBColorSpace;
      applyFresnelRimShader(cloned, { color: rimColor, power: 2.8, intensity: 0.36, pulseHz: 0.5 });
      return cloned;
    });
    node.material = Array.isArray(node.material) ? nextMats : nextMats[0];
  });
}

function loadRealWeaponTemplateAsync(assetSpec, rimColor) {
  if (
    !assetSpec ||
    typeof window === 'undefined' ||
    !window.location ||
    !window.location.origin ||
    window.location.origin === 'null' ||
    typeof fetch !== 'function'
  ) {
    return Promise.resolve(null);
  }
  const cacheKey = assetSpec.url || assetSpec.obj;
  if (_weaponAssetPromiseCache.has(cacheKey)) {
    return _weaponAssetPromiseCache.get(cacheKey);
  }

  const p = new Promise((resolve) => {
    if (assetSpec.type === 'glb') {
      const loader = new GLTFLoader();
      loader.load(
        assetSpec.url,
        (gltf) => {
          const raw = gltf && gltf.scene ? gltf.scene : null;
          if (!raw) return resolve(null);
          applyPbrAndRimToLoadedWeapon(raw, rimColor);
          resolve(normalizeAndAlignModel(raw, 1.68, true));
        },
        undefined,
        () => resolve(null)
      );
    } else if (assetSpec.type === 'obj') {
      const mtlLoader = new MTLLoader();
      mtlLoader.load(
        assetSpec.mtl,
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load(
            assetSpec.obj,
            (obj) => {
              applyPbrAndRimToLoadedWeapon(obj, rimColor);
              resolve(normalizeAndAlignModel(obj, 1.68, true));
            },
            undefined,
            () => resolve(null)
          );
        },
        undefined,
        () => resolve(null)
      );
    } else {
      resolve(null);
    }
  });

  _weaponAssetPromiseCache.set(cacheKey, p);
  return p;
}

let _rouletteRingTextureCache = null;
function getRouletteNumberRingTexture() {
  if (_rouletteRingTextureCache) return _rouletteRingTextureCache;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 512;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    const cx = 256;
    const cy = 256;
    ctx.clearRect(0, 0, 512, 512);
    const n = EUROPEAN_ROULETTE_ORDER.length;
    for (let i = 0; i < n; i++) {
      const pocket = EUROPEAN_ROULETTE_ORDER[i];
      const a0 = ((i - 0.5) / n) * Math.PI * 2;
      const a1 = ((i + 0.5) / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 246, a0, a1, false);
      ctx.arc(cx, cy, 172, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = pocket === 0 ? '#059669' : (ROULETTE_RED_SET.has(pocket) ? '#b91c1c' : '#111114');
      ctx.fill();
      ctx.strokeStyle = '#f3c969';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const mid = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * 209, cy + Math.sin(mid) * 209);
      ctx.rotate(mid + Math.PI * 0.5);
      ctx.fillStyle = '#fbf6ea';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pocket), 0, 0);
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    _rouletteRingTextureCache = tex;
    return tex;
  } catch (_) {
    return null;
  }
}

let _slotReelTexturesCache = null;
function getSlotReelTexture(reelIndex = 0) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  if (!_slotReelTexturesCache) _slotReelTexturesCache = [];
  if (_slotReelTexturesCache[reelIndex]) return _slotReelTexturesCache[reelIndex];
  try {
    const cv = document.createElement('canvas');
    cv.width = 1200;
    cv.height = 240;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fdf8ec';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const symbols = [
      { id: 'DIAMOND', glyph: '♦', sub: 'DIAMOND', bg: '#0f172a', fg: '#38bdf8', border: '#f3c969' },
      { id: 'SEVEN', glyph: '777', sub: 'LUCKY 7', bg: '#fffbeb', fg: '#dc2626', border: '#d97706' },
      { id: 'GOLD_BAR', glyph: 'BAR', sub: 'BULLION', bg: '#18181b', fg: '#facc15', border: '#f59e0b' },
      { id: 'CROWN', glyph: '♛', sub: 'CROWN', bg: '#064e3b', fg: '#fde047', border: '#fbbf24' },
      { id: 'CHIP', glyph: '★', sub: 'VIP CHIP', bg: '#7f1d1d', fg: '#fef08a', border: '#f3c969' },
      { id: 'CHERRY', glyph: '🍒', sub: 'CHERRY', bg: '#fdf2f8', fg: '#be123c', border: '#e11d48' },
    ];
    const stepX = cv.width / symbols.length;
    for (let i = 0; i < symbols.length; i++) {
      const s = symbols[i];
      const x0 = i * stepX;
      ctx.save();
      ctx.fillStyle = s.bg;
      ctx.fillRect(x0 + 4, 8, stepX - 8, cv.height - 16);
      ctx.strokeStyle = s.border;
      ctx.lineWidth = 6;
      ctx.strokeRect(x0 + 8, 12, stepX - 16, cv.height - 24);
      // Rotate -90 deg so when cylinder is rotated -90 deg on Z, symbols stand upright facing +Z!
      ctx.translate(x0 + stepX * 0.5, cv.height * 0.5);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = s.fg;
      ctx.font = '900 66px system-ui, "Segoe UI Symbol", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.glyph, 0, -18);
      ctx.fillStyle = s.border;
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(s.sub, 0, 38);
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    _slotReelTexturesCache[reelIndex] = tex;
    return tex;
  } catch (_) {
    return null;
  }
}

export function getSlotSymbolTargetAngle(symbolName) {
  const clean = String(symbolName || 'SEVEN').trim().toUpperCase();
  const idx = SLOT_REEL_SYMBOL_ORDER.indexOf(clean);
  const safeIdx = idx >= 0 ? idx : 1;
  const uCenter = (safeIdx + 0.5) / SLOT_REEL_SYMBOL_ORDER.length;
  return -(uCenter * Math.PI * 2);
}

/**
 * Museum-Grade 37-Pocket Monte-Carlo 3D European Roulette Wheel:
 * - Sculpted LatheGeometry obsidian-mahogany outer bowl + champagne-brass rim
 * - Inclined ball track + 8 diamond-cut brass ball deflectors (canoes)
 * - All 37 radial 3D pockets in authentic EUROPEAN_ROULETTE_ORDER + 37 brass frets
 * - Procedural CanvasTexture 0..36 gold number ring + 4-spoke turned brass turret
 * - Ivory clearcoat 3D ball with pocket-indexed angle resolver
 */
export function createRouletteWheel3D(opts = {}) {
  const root = new THREE.Group();
  root.name = 'z3d-monte-carlo-roulette';

  const mahogany = makePbr(0x4a1912, 0.22, 0.28, { color: 0xfbbf24, power: 2.5, intensity: 0.45 }, { clearcoat: 1.0, clearcoatRoughness: 0.08 });
  const obsidian = makePbr(0x131316, 0.24, 0.62, { color: 0xf3c969, power: 2.6, intensity: 0.42 }, { clearcoat: 0.85 });
  const brass = makePbr(0xf3c969, 0.16, 0.96, { color: 0xfef08a, power: 2.1, intensity: 0.72 });
  const emerald = makePbr(0x059669, 0.24, 0.36, { color: 0x6ee7b7, power: 2.2, intensity: 0.62 }, { emissive: 0x064e3b, emissiveIntensity: 0.35 });
  const ruby = makePbr(0xdc2626, 0.24, 0.38, { color: 0xfca5a5, power: 2.2, intensity: 0.58 }, { emissive: 0x7f1d1d, emissiveIntensity: 0.28 });
  const ivory = makePbr(0xfbf6ea, 0.06, 0.10, { color: 0xffffff, power: 2.0, intensity: 0.7 }, { clearcoat: 1.0, clearcoatRoughness: 0.04 });

  // 1. Turned LatheGeometry Outer Mahogany Bowl + Stepped Brass Lip
  const lathePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.06, 0.0),
    new THREE.Vector2(1.24, 0.14),
    new THREE.Vector2(1.28, 0.34),
    new THREE.Vector2(1.18, 0.38),
    new THREE.Vector2(1.06, 0.30),
    new THREE.Vector2(0.84, 0.18),
    new THREE.Vector2(0.0, 0.16),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(lathePts, 48), mahogany);
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(1.23, 0.042, 14, 56), brass);
  outerRim.rotation.x = Math.PI / 2;
  outerRim.position.y = 0.365;
  const trackRing = new THREE.Mesh(new THREE.RingGeometry(0.83, 1.09, 52), obsidian);
  trackRing.rotation.x = -Math.PI / 2;
  trackRing.position.y = 0.275;
  root.add(bowl, outerRim, trackRing);

  // 2. 8 Diamond-Cut Brass Ball Deflectors (Canoes) Alternating Horizontal/Vertical
  for (let d = 0; d < 8; d++) {
    const ang = (d / 8) * Math.PI * 2;
    const canoe = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), brass);
    const horizontal = d % 2 === 0;
    canoe.scale.set(horizontal ? 1.8 : 0.75, 0.55, horizontal ? 0.75 : 1.8);
    canoe.position.set(Math.cos(ang) * 0.95, 0.295, Math.sin(ang) * 0.95);
    canoe.rotation.y = -ang;
    root.add(canoe);
  }

  // 3. Spinning Inner Rotor: All 37 Pockets + 37 Brass Frets + Number Ring + 4-Spoke Turret
  const rotor = new THREE.Group();
  rotor.name = 'z3d-roulette-rotor';
  rotor.position.y = 0.22;

  const rotorPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.78, 0.06, 48), obsidian);
  rotorPlatter.position.y = -0.02;
  rotor.add(rotorPlatter);

  const pocketCount = EUROPEAN_ROULETTE_ORDER.length; // 37
  const pocketArcW = (2 * Math.PI * 0.60) / pocketCount * 0.88;
  const pocketGeo = new THREE.BoxGeometry(0.18, 0.036, pocketArcW);
  const fretGeo = new THREE.BoxGeometry(0.20, 0.054, 0.014);

  for (let i = 0; i < pocketCount; i++) {
    const num = EUROPEAN_ROULETTE_ORDER[i];
    const ang = (i / pocketCount) * Math.PI * 2;
    const pMat = num === 0 ? emerald : (ROULETTE_RED_SET.has(num) ? ruby : obsidian);
    const pocketMesh = new THREE.Mesh(pocketGeo, pMat);
    pocketMesh.position.set(Math.cos(ang) * 0.60, 0.015, Math.sin(ang) * 0.60);
    pocketMesh.rotation.y = -ang;
    pocketMesh.userData.pocketNumber = num;
    rotor.add(pocketMesh);

    const fretAng = ((i + 0.5) / pocketCount) * Math.PI * 2;
    const fret = new THREE.Mesh(fretGeo, brass);
    fret.position.set(Math.cos(fretAng) * 0.60, 0.028, Math.sin(fretAng) * 0.60);
    fret.rotation.y = -fretAng;
    rotor.add(fret);
  }

  const numTex = getRouletteNumberRingTexture();
  const numRingMat = numTex
    ? new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.26, metalness: 0.35, transparent: true })
    : makePbr(0x1f2937, 0.28, 0.55, { color: 0xf3c969, power: 2.3, intensity: 0.55 });
  const numRing = new THREE.Mesh(new THREE.RingGeometry(0.69, 0.82, 56), numRingMat);
  numRing.rotation.x = -Math.PI / 2;
  numRing.position.y = 0.036;
  const innerBrassTrim = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.022, 10, 44), brass);
  innerBrassTrim.rotation.x = Math.PI / 2;
  innerBrassTrim.position.y = 0.038;

  // Rosewood Cone + Turned Brass Turret Spindle + 4 Cross Finial Arms + Ruby Crown
  const innerCone = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.16, 40), mahogany);
  innerCone.position.y = 0.09;
  const turretStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.11, 0.28, 20), brass);
  turretStem.position.y = 0.22;
  const turretCrown = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), ruby);
  turretCrown.position.y = 0.38;
  rotor.add(numRing, innerBrassTrim, innerCone, turretStem, turretCrown);

  for (let s = 0; s < 4; s++) {
    const sAng = (s / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.28, 10), brass);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = sAng;
    arm.position.set(Math.cos(sAng) * 0.14, 0.29, -Math.sin(sAng) * 0.14);
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), brass);
    tipBall.position.set(Math.cos(sAng) * 0.28, 0.29, -Math.sin(sAng) * 0.28);
    rotor.add(arm, tipBall);
  }

  root.add(rotor);

  // 4. Ivory 3D Roulette Ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 14), ivory);
  ball.name = 'z3d-roulette-ball';
  ball.position.set(0.60, 0.27, 0);
  root.add(ball);

  const getPocketAngle = (pocketNum) => {
    const idx = EUROPEAN_ROULETTE_ORDER.indexOf(Number(pocketNum));
    const safeIdx = idx >= 0 ? idx : 0;
    return (safeIdx / pocketCount) * Math.PI * 2;
  };

  root.userData = {
    pocketCount,
    pocketOrder: EUROPEAN_ROULETTE_ORDER,
    rotor,
    ball,
    getPocketAngle,
  };

  if (opts.forInspector) {
    root.rotation.x = 0.38;
  }
  return root;
}

/**
 * Art-Deco Monte-Carlo 3D Mechanical Jackpot Slot Machine:
 * - Obsidian & Ruby lacquer cabinet + stepped chrome base + neon crown marquee
 * - 3x 24-segment textured symbol reels + brass flange rings
 * - Spring-loaded chrome pull-arm lever with ruby clearcoat knob
 */
export function createSlotMachine3D(opts = {}) {
  const cabinet = new THREE.Group();
  cabinet.name = 'z3d-monte-carlo-slots';

  const obsidian = makePbr(0x141210, 0.24, 0.76, { color: 0xf3c969, power: 2.3, intensity: 0.58 }, { clearcoat: 0.9 });
  const rubyBody = makePbr(0x881337, 0.22, 0.68, { color: 0xfbbf24, power: 2.3, intensity: 0.62 }, { clearcoat: 0.95 });
  const brass = makePbr(0xf3c969, 0.16, 0.96, { color: 0xfef08a, power: 2.1, intensity: 0.72 });
  const chrome = makePbr(0xe2e8f0, 0.12, 0.96, { color: 0x38bdf8, power: 2.4, intensity: 0.5 });
  const neonGold = makePbr(0xfef08a, 0.10, 0.2, false, { emissive: 0xf59e0b, emissiveIntensity: 0.95 });
  const rubyKnobMat = makePbr(0xe11d48, 0.08, 0.25, { color: 0xfda4af, power: 1.8, intensity: 0.95 }, { clearcoat: 1.0, emissive: 0x9f1239, emissiveIntensity: 0.45 });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.86), obsidian);
  plinth.position.y = 0.08;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.66, 0.74), rubyBody);
  body.position.y = 0.96;
  const crownArch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.74, 28, 1, false, 0, Math.PI), brass);
  crownArch.rotation.z = Math.PI / 2;
  crownArch.rotation.y = Math.PI / 2;
  crownArch.position.y = 1.78;

  // Open Sculpted Brass Window Frame (leaves all 3 symbol drums 100% unobstructed!)
  const reelWell = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.56, 0.24), obsidian);
  reelWell.position.set(0, 1.12, 0.16);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.065, 0.22), brass);
  frameTop.position.set(0, 1.41, 0.40);
  const frameBot = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.065, 0.22), brass);
  frameBot.position.set(0, 0.83, 0.40);
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.64, 0.22), brass);
  frameLeft.position.set(-0.53, 1.12, 0.40);
  const frameRight = frameLeft.clone();
  frameRight.position.x = 0.53;
  // Illuminated Payline Wire + Twin Payline Pointers
  const paylineWire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 1.02, 10),
    rubyKnobMat
  );
  paylineWire.rotation.z = Math.PI / 2;
  paylineWire.position.set(0, 1.12, 0.555);

  const coinTray = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.24), chrome);
  coinTray.position.set(0, 0.34, 0.44);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 18), neonGold);
  beacon.position.y = 2.02;
  cabinet.add(plinth, body, crownArch, reelWell, frameTop, frameBot, frameLeft, frameRight, paylineWire, coinTray, beacon);

  for (let c = -2; c <= 2; c++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12), brass);
    coin.position.set(c * 0.14, 0.42, 0.44);
    cabinet.add(coin);
  }

  const defaultSyms = ['SEVEN', 'CROWN', 'DIAMOND'];
  const reels = [];
  for (let r = -1; r <= 1; r++) {
    const reelIdx = r + 1;
    const tex = getSlotReelTexture(0);
    const sideMat = tex
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.12 })
      : makePbr(0xfbf6ea, 0.22, 0.28, { color: 0xfbbf24, power: 2.5, intensity: 0.4 });
    const capMat = obsidian;
    const reelPivot = new THREE.Group();
    reelPivot.position.set(r * 0.31, 1.12, 0.30);
    reelPivot.rotation.x = getSlotSymbolTargetAngle(defaultSyms[reelIdx]);

    const reelDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.235, 0.26, 36),
      [sideMat, capMat, capMat]
    );
    reelDrum.rotation.z = -Math.PI / 2;
    const flangeL = new THREE.Mesh(new THREE.TorusGeometry(0.238, 0.013, 8, 28), brass);
    flangeL.rotation.y = Math.PI / 2;
    flangeL.position.x = -0.13;
    const flangeR = flangeL.clone();
    flangeR.position.x = 0.13;
    reelPivot.add(reelDrum, flangeL, flangeR);
    cabinet.add(reelPivot);
    reels.push(reelPivot);
  }

  // Spring-Loaded Pull-Arm Lever on Right Side
  const leverHub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16), brass);
  leverHub.rotation.z = Math.PI / 2;
  leverHub.position.set(0.68, 0.96, 0.05);
  cabinet.add(leverHub);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.72, 0.96, 0.05);
  const leverShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.68, 12), chrome);
  leverShaft.position.set(0, 0.32, 0);
  const leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 14), rubyKnobMat);
  leverBall.position.set(0, 0.68, 0);
  leverPivot.add(leverShaft, leverBall);
  cabinet.add(leverPivot);

  cabinet.userData = { reels, leverPivot, beacon };
  if (opts.forInspector) {
    cabinet.position.y = -0.95;
  }
  return cabinet;
}

function buildCompanionProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const carbon = makePbr(0x1e2430, 0.32, 0.78, { color: rimColor, power: 2.3, intensity: 0.62 });
  const titanium = makePbr(0x94a3b8, 0.20, 0.94, { color: rimColor, power: 2.4, intensity: 0.52 });
  const gold = makePbr(0xf3c969, 0.18, 0.95, { color: 0xfef08a, power: 2.1, intensity: 0.72 });
  const cyanOptic = makePbr(0x22d3ee, 0.08, 0.3, false, { emissive: 0x06b6d4, emissiveIntensity: 0.95 });
  const rubyOptic = makePbr(0xf43f5e, 0.08, 0.3, false, { emissive: 0xe11d48, emissiveIntensity: 0.95 });
  const violetOptic = makePbr(0xc084fc, 0.08, 0.3, false, { emissive: 0x9333ea, emissiveIntensity: 0.95 });

  if (subtype === 'armored_k9') {
    // Cyber-Armored Syndicate K9 Hound: Torso Armor + Jaw + Optic Visor + 4 Legs + Tail
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.32), carbon);
    torso.position.set(0, 0.08, 0);
    const saddleArmor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.36), gold);
    saddleArmor.position.set(0.02, 0.22, 0);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), carbon);
    neck.position.set(0.38, 0.24, 0);
    neck.rotation.z = -0.35;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.20, 0.24), titanium);
    skull.position.set(0.54, 0.36, 0);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.16), carbon);
    snout.position.set(0.72, 0.32, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.25), rubyOptic);
    visor.position.set(0.60, 0.39, 0);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), carbon);
    earL.position.set(0.48, 0.50, 0.08);
    const earR = earL.clone();
    earR.position.z = -0.08;
    for (const [lx, lz] of [[0.28, 0.12], [0.28, -0.12], [-0.28, 0.12], [-0.28, -0.12]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.42, 10), titanium);
      leg.position.set(lx, -0.24, lz);
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.09), gold);
      paw.position.set(lx + 0.03, -0.44, lz);
      g.add(leg, paw);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.34, 8), carbon);
    tail.position.set(-0.48, 0.22, 0);
    tail.rotation.z = 0.65;
    g.add(torso, saddleArmor, neck, skull, snout, visor, earL, earR, tail);
    return g;
  }

  if (subtype === 'smuggler_falcon' || subtype === 'cyber_raven') {
    const isRaven = subtype === 'cyber_raven';
    const bodyMat = isRaven ? carbon : makePbr(0x78350f, 0.36, 0.52, { color: 0xfbbf24, power: 2.2, intensity: 0.68 });
    const eyeMat = isRaven ? violetOptic : cyanOptic;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), bodyMat);
    body.scale.set(1.45, 0.85, 0.82);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), bodyMat);
    head.position.set(0.32, 0.16, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 6), gold);
    beak.rotation.z = -Math.PI / 2 - 0.18;
    beak.position.set(0.48, 0.14, 0);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMat);
    eyeL.position.set(0.38, 0.19, 0.11);
    const eyeR = eyeL.clone();
    eyeR.position.z = -0.11;
    for (const side of [-1, 1]) {
      const wingInner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.52), bodyMat);
      wingInner.position.set(0.04, 0.08, side * 0.36);
      wingInner.rotation.x = side * 0.28;
      const wingOuter = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.48), isRaven ? violetOptic : gold);
      wingOuter.position.set(-0.08, 0.18, side * 0.76);
      wingOuter.rotation.x = side * 0.42;
      wingOuter.rotation.y = side * -0.22;
      g.add(wingInner, wingOuter);
    }
    const tailFan = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.28), titanium);
    tailFan.position.set(-0.42, -0.02, 0);
    tailFan.rotation.z = 0.16;
    g.add(body, head, beak, eyeL, eyeR, tailFan);
    return g;
  }

  // Default: Quad-Rotor Stealth Recon Drone + Gimbal Lidar Eye + 4 Ducted Shrouds
  const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 1), carbon);
  hull.scale.set(1.35, 0.52, 1.15);
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 0.08, 16), gold);
  topCap.position.y = 0.14;
  const lidarEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), cyanOptic);
  lidarEye.position.set(0.28, -0.04, 0);
  g.add(hull, topCap, lidarEye);
  for (const [ax, az] of [[0.44, 0.44], [0.44, -0.44], [-0.44, 0.44], [-0.44, -0.44]]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.52, 8), titanium);
    boom.rotation.z = Math.PI / 2;
    boom.rotation.y = Math.atan2(-az, ax);
    boom.position.set(ax * 0.5, 0.04, az * 0.5);
    const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 10, 22), gold);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(ax, 0.06, az);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.014, 0.04), cyanOptic);
    blade.position.set(ax, 0.06, az);
    g.add(boom, shroud, blade);
  }
  return g;
}
export function createItemMesh3D(itemId, category = '', rarity = 'rare', opts = {}) {
  const spec = resolveItemSpec3D(itemId, category, rarity);
  const elongated = isElongatedItemCategory(spec);
  const root = new THREE.Group();
  root.name = `z3d-item-${spec.id}`;
  root.userData = {
    z3dItemId: spec.id,
    z3dCategory: spec.category,
    z3dSubtype: spec.subtype,
    z3dArchetype: spec.archetype,
    z3dRarity: rarity,
    z3dElongated: elongated,
    z3dAssetUrl: spec.asset ? (spec.asset.url || spec.asset.obj) : null,
  };

  let rawModel;
  if (spec.category === 'casino') {
    rawModel = spec.subtype === 'slot_machine'
      ? createSlotMachine3D({ forInspector: true })
      : createRouletteWheel3D({ forInspector: true });
  } else if (spec.category === 'companion') rawModel = buildCompanionProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'weapon') rawModel = buildFirearmProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'melee') rawModel = buildMeleeProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'enhancer') rawModel = buildEnhancerProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'drug') rawModel = buildDrugVialProcedural(spec.subtype);
  else if (spec.category === 'medical') rawModel = buildMedicalProcedural(spec.subtype);
  else if (spec.category === 'booster') rawModel = buildBoosterProcedural(spec.subtype);
  else if (spec.category === 'armor') rawModel = buildArmorProcedural(spec.subtype, spec.rimColor);
  else rawModel = buildContrabandVehicleCacheProcedural(spec.category, spec.subtype, spec.rimColor);

  const modelGroup = normalizeAndAlignModel(rawModel, 1.68, elongated);
  modelGroup.name = 'z3d-item-body';
  root.add(modelGroup);

  // Hero 3/4 side-profile initial orientation for elongated weapons/melee/vehicles/tools
  if (!opts.forHandHold && elongated) {
    root.rotation.set(HERO_ELONGATED_PITCH, HERO_ELONGATED_YAW, 0);
  }

  if (opts.withPedestalRing !== false) {
    const ringMat = makePbr(spec.rimColor, 0.25, 0.85, false, {
      transparent: true,
      opacity: 0.34,
      emissive: spec.rimColor,
      emissiveIntensity: 0.35,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.016, 10, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.68;
    ring.name = 'z3d-item-halo';
    root.add(ring);
  }

  root.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  if (spec.asset && opts.disableAsyncUpgrade !== true) {
    loadRealWeaponTemplateAsync(spec.asset, spec.rimColor).then((template) => {
      if (!template) return;
      const cloned = template.clone(true);
      cloned.name = 'z3d-item-body-real';
      const old = root.getObjectByName('z3d-item-body');
      if (old) root.remove(old);
      root.add(cloned);
      root.userData.z3dRealUpgraded = true;
      for (const cb of _weaponUpgradeListeners) {
        try { cb(spec.id, root); } catch (_) { /* ignore */ }
      }
    });
  }

  return root;
}

export function countMeshStats3D(object3d) {
  let meshCount = 0;
  let triangles = 0;
  object3d.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    meshCount++;
    const idx = n.geometry.index;
    const pos = n.geometry.attributes && n.geometry.attributes.position;
    if (idx) triangles += Math.floor(idx.count / 3);
    else if (pos) triangles += Math.floor(pos.count / 3);
  });
  return { meshCount, triangles };
}

/* --------------------------------------------------------------------------
 * 5. ARTICULATED 3D SYNDICATE OPERATIVES & 8 INTERACTIVE 3D STAGES
 *    Plug-and-Play support for globalThis.__ZoneRiggedOperative (@char-3d-anim)
 *    with seamless fallback to built-in articulated humanoid when absent.
 * -------------------------------------------------------------------------- */
export function createHumanoid3D(opts = {}) {
  const outfit = String(opts.outfit || (opts.bossCrown ? 'tactical' : 'street')).toLowerCase();
  const rimHex = opts.rimColor || 0x38bdf8;
  const scale = opts.scale || 1.0;

  if (
    opts.useRigged !== false &&
    typeof globalThis !== 'undefined' &&
    globalThis.__ZoneRiggedOperative &&
    typeof globalThis.__ZoneRiggedOperative.createRiggedOperative3D === 'function'
  ) {
    try {
      const role = opts.role || (opts.bossCrown ? 'boss' : opts.dumbbells ? 'boxer' : 'player');
      const rigged = globalThis.__ZoneRiggedOperative.createRiggedOperative3D(
        THREE,
        Object.assign({}, opts, { outfit, role, rimColor: rimHex })
      );
      if (rigged && rigged.isObject3D) {
        const rigApi = rigged.userData && rigged.userData.z3dRig;
        if (opts.weaponId && !rigged.getObjectByName('z3d-item-body')) {
          const held = createItemMesh3D(opts.weaponId, opts.weaponCat || 'weapon', 'legendary', {
            withPedestalRing: false,
            forHandHold: true,
            disableAsyncUpgrade: !!opts.headless,
          });
          held.scale.setScalar(0.36);
          if (rigApi && typeof rigApi.attachProp === 'function') {
            rigApi.attachProp(held);
          } else {
            held.position.set(0.29, 0.88, 0.36);
            rigged.add(held);
          }
        }
        rigged.traverse((n) => {
          if (!n.isMesh) return;
          n.castShadow = true;
          n.receiveShadow = true;
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (let m = 0; m < mats.length; m++) {
            const mat = mats[m];
            if (mat && (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) && (!mat.userData || !mat.userData.z3dRimUniforms)) {
              applyFresnelRimShader(mat, { color: rimHex, power: 2.4, intensity: opts.rimIntensity || 0.55, pulseHz: 0.8 });
            }
          }
        });
        if (scale !== 1.0 && Math.abs(rigged.scale.x - 1.0) < 1e-4) {
          rigged.scale.setScalar(scale);
        }
        return rigged;
      }
    } catch (_) {
      /* Cleanly fall back to built-in articulated humanoid */
    }
  }

  const g = new THREE.Group();

  let coatHex = opts.coatColor;
  let pantsHex = 0x181b22;
  let trimHex = opts.trimColor || 0xfbbf24;
  if (!coatHex) {
    if (outfit === 'suit') { coatHex = 0x1e293b; pantsHex = 0x0f172a; trimHex = 0xf59e0b; }
    else if (outfit === 'tactical') { coatHex = 0x27303f; pantsHex = 0x1b222c; trimHex = 0x38bdf8; }
    else { coatHex = 0x3b2314; pantsHex = 0x1e293b; trimHex = 0x4ade80; }
  }

  const coat = makePbr(coatHex, 0.40, 0.42, { color: rimHex, power: 2.2, intensity: opts.rimIntensity || 0.62, pulseHz: 0.8 });
  const pants = makePbr(pantsHex, 0.55, 0.22, { color: rimHex, power: 2.6, intensity: 0.4 });
  const bootMat = makePbr(0x111318, 0.42, 0.55, { color: rimHex, power: 2.8, intensity: 0.35 });
  const skin = makePbr(opts.skinColor || 0xd6a582, 0.52, 0.08, { color: rimHex, power: 2.8, intensity: 0.34 });
  const trim = makePbr(trimHex, 0.24, 0.88, { color: rimHex, power: 2.3, intensity: 0.52 });

  // Articulated Legs (Boots + Calves + Knees + Thighs)
  const buildLeg = (side) => {
    const leg = new THREE.Group();
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.2), bootMat);
    boot.position.set(0, 0.05, 0.03);
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.2, 6, 10), pants);
    calf.position.set(0, 0.22, 0);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), outfit === 'tactical' ? trim : pants);
    knee.position.set(0, 0.35, 0.01);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.22, 6, 10), pants);
    thigh.position.set(0, 0.5, 0);
    leg.add(boot, calf, knee, thigh);
    leg.position.set(side * 0.125, 0, side * 0.02);
    leg.rotation.z = side * -0.03;
    return leg;
  };
  g.add(buildLeg(-1), buildLeg(1));

  // Pelvis & Utility Belt + Gold Buckle
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.21), pants);
  pelvis.position.y = 0.64;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.23), bootMat);
  belt.position.y = 0.69;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.065, 0.245), trim);
  buckle.position.y = 0.69;
  g.add(pelvis, belt, buckle);

  // V-Tapered Torso + Outfit Styling (Street Hoodie / Suit Lapels & Tie / Tactical Plate Carrier)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.165, 0.44, 12), coat);
  torso.scale.set(1.05, 1, 0.72);
  torso.position.y = 0.92;
  g.add(torso);

  if (outfit === 'suit') {
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.24), makePbr(0xf8fafc, 0.35, 0.1));
    shirt.position.set(0, 0.95, 0.04);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.255), makePbr(0xdc2626, 0.3, 0.2));
    tie.position.set(0, 0.93, 0.045);
    g.add(shirt, tie);
  } else if (outfit === 'tactical' || opts.bossCrown) {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.27), trim);
    vest.position.y = 0.93;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), coat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.13;
    g.add(vest, collar);
  } else {
    // Street Bomber Hood & Zip Trim
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.042, 10, 18), trim);
    hood.rotation.x = Math.PI / 2 + 0.2;
    hood.position.set(0, 1.13, -0.02);
    g.add(hood);
  }

  // Articulated Arms (Shoulders + Upper Arm + Elbow + Forearm + Gloved Hand)
  const buildArm = (side, aimForward = false) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.255, 1.08, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), opts.bossCrown || outfit === 'tactical' ? trim : coat);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.18, 6, 10), coat);
    upper.position.set(side * 0.02, -0.14, 0);
    const forearmGrp = new THREE.Group();
    forearmGrp.position.set(side * 0.03, -0.26, 0);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.17, 6, 10), coat);
    forearm.position.y = -0.11;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), outfit === 'tactical' ? bootMat : skin);
    hand.position.y = -0.24;
    forearmGrp.add(forearm, hand);
    if (aimForward) {
      armPivot.rotation.x = -0.52;
      forearmGrp.rotation.x = -0.68;
    } else {
      armPivot.rotation.z = side * -0.14;
      forearmGrp.rotation.x = -0.28;
    }
    armPivot.add(shoulder, upper, forearmGrp);
    return { armPivot, hand };
  };

  const leftArm = buildArm(-1, !!opts.dumbbells);
  const rightArm = buildArm(1, !!(opts.weaponId || opts.dumbbells));
  g.add(leftArm.armPivot, rightArm.armPivot);

  // Neck + Sculpted Head + Jaw + Facial/Headgear
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10), skin);
  neck.position.y = 1.17;
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), skin);
  cranium.scale.set(0.95, 1.06, 0.98);
  cranium.position.y = 1.30;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), skin);
  jaw.position.set(0, 1.23, 0.03);
  g.add(neck, cranium, jaw);

  if (opts.bossCrown) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.065, 0.18), makePbr(0xef4444, 0.1, 0.4, { color: 0xfca5a5, power: 1.6, intensity: 1.0 }, { emissive: 0xdc2626, emissiveIntensity: 0.95 }));
    visor.position.set(0, 1.31, 0.09);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.158, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), bootMat);
    helm.position.y = 1.31;
    g.add(visor, helm);
  } else if (outfit === 'suit') {
    // Syndicate Fedora Hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 22), bootMat);
    brim.position.set(0, 1.39, 0.01);
    brim.rotation.x = 0.06;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, 0.14, 18), bootMat);
    crown.position.set(0, 1.46, 0);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.03, 18), trim);
    ribbon.position.set(0, 1.41, 0);
    g.add(brim, crown, ribbon);
  } else if (outfit === 'tactical') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), coat);
    helm.position.y = 1.31;
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.06, 0.16), makePbr(0x38bdf8, 0.1, 0.4, false, { emissive: 0x0284c7, emissiveIntensity: 0.85 }));
    goggles.position.set(0, 1.31, 0.09);
    g.add(helm, goggles);
  } else {
    // Stylized Hair / Street Cap + Sunglasses
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), bootMat);
    cap.position.y = 1.31;
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.14), bootMat);
    shades.position.set(0, 1.30, 0.09);
    g.add(cap, shades);
  }

  if (opts.dumbbells) {
    const buildDumbbell = (xPos) => {
      const db = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 10), trim);
      bar.rotation.z = Math.PI / 2;
      const wL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.045, 12), bootMat);
      wL.rotation.z = Math.PI / 2;
      wL.position.x = -0.11;
      const wR = wL.clone();
      wR.position.x = 0.11;
      db.add(bar, wL, wR);
      db.position.set(xPos, 0.92, 0.28);
      return db;
    };
    g.add(buildDumbbell(-0.28), buildDumbbell(0.28));
  } else if (opts.weaponId) {
    const held = createItemMesh3D(opts.weaponId, opts.weaponCat || 'weapon', 'legendary', {
      withPedestalRing: false,
      forHandHold: true,
      disableAsyncUpgrade: !!opts.headless,
    });
    held.scale.setScalar(0.38);
    held.position.set(0.29, 0.88, 0.36);
    g.add(held);
  }

  g.scale.setScalar(scale);
  g.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return g;
}

function addStandardStageLighting(scene, floorColor = 0x181512, accentHex = 0x38bdf8, floorRadius = 4.4) {
  scene.background = new THREE.Color(0x13110e);
  const hemi = new THREE.HemisphereLight(0xfef3c7, 0x1c1917, 1.2);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff7ed, 2.95);
  key.position.set(5.5, 8.5, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 25;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0008;
  scene.add(key);

  const rim = new THREE.DirectionalLight(accentHex, 1.65);
  rim.position.set(-5.0, 4.0, -4.5);
  scene.add(rim);

  const point = new THREE.PointLight(0xf59e0b, 2.2, 12);
  point.position.set(0, 2.6, 1.8);
  scene.add(point);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(floorRadius, floorRadius + 0.18, 0.2, 40),
    makePbr(floorColor, 0.62, 0.28, false)
  );
  floor.position.y = -0.10;
  floor.receiveShadow = true;
  scene.add(floor);

  const trimRing = new THREE.Mesh(
    new THREE.TorusGeometry(floorRadius - 0.06, 0.04, 10, 56),
    makePbr(accentHex, 0.22, 0.88, false, { emissive: accentHex, emissiveIntensity: 0.48 })
  );
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.01;
  scene.add(trimRing);

  return { hemi, key, rim, point, floor, trimRing };
}

function resolveRigClipFromAction(act, stageKind, payload = {}) {
  if (/(ko|collapse|defeat|execute)/.test(act)) return 'ko_collapse';
  if (/(hit|hurt|damage|mug|hosp)/.test(act)) return 'hit_react';
  if (/(slash|melee|knife|katana|razor)/.test(act) || (payload && payload.weaponCat === 'melee')) return 'melee_slash';
  if (/(crack|vault|drill|breach|lockpick|heist)/.test(act)) return 'vault_crack';
  if (/(punch|hook|bag|train|str|gym)/.test(act)) return 'heavy_bag_hook';
  if (/(fire|shoot|shot|attack|confront|raid|boss)/.test(act)) return 'recoil_fire';
  if (/(stance|aim|alert|guard)/.test(act)) return 'combat_stance';
  if (stageKind === 'combat-arena') return 'combat_stance';
  return 'idle_breathe';
}

function emitGlobal3DActionEvent(stageKind, actionName, payload = {}) {
  const win = typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : (typeof window !== 'undefined' ? window : null);
  if (!win || typeof win.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return false;
  try {
    win.dispatchEvent(new CustomEvent('zone:3d-action', {
      detail: {
        stageKind,
        actionName,
        payload: payload || {},
      },
    }));
    return true;
  } catch (_) {
    return false;
  }
}

export function buildStageScene3D(stageKind, world, initialState = {}) {
  const kind = STAGE_KINDS.includes(stageKind) ? stageKind : 'safehouse-empire';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 80);
  camera.position.set(0, 2.45, 5.4);
  camera.lookAt(0, 0.88, 0);

  const spawnedEids = [];
  const pickableEids = [];
  const spawnTracked = (obj) => {
    const eid = world.spawnImmediate(obj);
    if (eid >= 0) spawnedEids.push(eid);
    return eid;
  };
  const registerPickable = (eid, meta) => {
    if (eid < 0) return;
    world.setPickable(eid, meta);
    pickableEids.push(eid);
  };

  const camEid = spawnTracked(camera);
  world.setTraumaCamera(camEid, {
    baseX: camera.position.x,
    baseY: camera.position.y,
    baseZ: camera.position.z,
    decay: 1.4,
    maxOffsetX: 0.36,
    maxOffsetY: 0.24,
    maxRoll: 0.045,
  });

  const burstGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const spark = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      makePbr(0xfbbf24, 0.12, 0.8, false, { emissive: 0xf59e0b, emissiveIntensity: 0.95 })
    );
    spark.position.set(Math.cos(ang) * 0.45, 0.2, Math.sin(ang) * 0.45);
    burstGroup.add(spark);
  }
  burstGroup.position.set(0, 0.8, 0);
  burstGroup.scale.setScalar(0.001);
  scene.add(burstGroup);
  const burstEid = spawnTracked(burstGroup);

  const refs = {};
  const headless = !!initialState.headless;
  const stageVfx = createStageVfxController(kind, scene, {
    viewportWidth: initialState.viewportWidth,
    headless,
  });
  refs.vfx = stageVfx;
  world.registerStageVfx(stageVfx);

  const dressEnvFn = (globalThis.__Zone3DEnvironments && typeof globalThis.__Zone3DEnvironments.dressStageEnvironment3D === 'function')
    ? globalThis.__Zone3DEnvironments.dressStageEnvironment3D
    : dressStageEnvironment3D;
  const shouldDressEnv = !(kind === 'character-turntable' && !headless && typeof window !== 'undefined');
  const stageEnv = (shouldDressEnv && typeof dressEnvFn === 'function')
    ? dressEnvFn(THREE, kind, scene, {
        viewportWidth: initialState.viewportWidth,
        era: Number(initialState.era || (initialState.eraProgression && initialState.eraProgression.currentEra) || 1),
        headless,
      })
    : null;
  if (stageEnv) {
    refs.env = stageEnv;
    world.registerStageVfx(stageEnv);
  }

  const playEidRigState = (eid, clipName, fadeSec = 0.18) => {
    if (eid === undefined || eid < 0) return false;
    const rigs = world.riggedCache[eid];
    if (!rigs || !rigs.length) return false;
    let played = false;
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i] && typeof rigs[i].playState === 'function') {
        rigs[i].playState(clipName, fadeSec);
        played = true;
      }
    }
    return played;
  };

  const setEidRigOutfit = (eid, outfitName) => {
    if (eid === undefined || eid < 0) return false;
    const rigs = world.riggedCache[eid];
    if (!rigs || !rigs.length) return false;
    let applied = false;
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i] && typeof rigs[i].setOutfit === 'function') {
        rigs[i].setOutfit(outfitName);
        applied = true;
      }
    }
    return applied;
  };

  /* === STAGE 1: SAFEHOUSE-EMPIRE (Home) === */
  if (kind === 'safehouse-empire') {
    const lights = addStandardStageLighting(scene, 0x1b1714, 0xf59e0b);
    refs.lights = lights;

    const compoundGroup = new THREE.Group();
    scene.add(compoundGroup);
    refs.compoundGroup = compoundGroup;

    const rebuildCompoundEra = (eraNum) => {
      while (compoundGroup.children.length) compoundGroup.remove(compoundGroup.children[0]);
      const era = Math.max(1, Math.min(6, Number(eraNum) || 1));
      const baseH = 0.72 + era * 0.28;
      const baseW = 1.52 + era * 0.14;
      const wallHex = [0x475569, 0x334155, 0xd6c7b2, 0x1e293b, 0x292524, 0x18181b][era - 1];
      const trimHex = [0x94a3b8, 0x38bdf8, 0x22c55e, 0xa855f7, 0xf59e0b, 0xfbbf24][era - 1];

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(baseW, baseH, 1.15),
        makePbr(wallHex, 0.36, 0.62, { color: trimHex, power: 2.6, intensity: 0.45 })
      );
      tower.position.set(0, baseH * 0.5, -1.55);
      tower.castShadow = true;
      tower.receiveShadow = true;
      compoundGroup.add(tower);

      for (let r = 0; r < era; r++) {
        const winStrip = new THREE.Mesh(
          new THREE.BoxGeometry(baseW * 0.82, 0.08, 1.19),
          makePbr(trimHex, 0.14, 0.3, false, { emissive: trimHex, emissiveIntensity: 0.85 })
        );
        winStrip.position.set(0, 0.28 + r * 0.26, -1.55);
        compoundGroup.add(winStrip);
      }
      if (era >= 3) {
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.75, baseH * 0.68, 0.9), makePbr(wallHex, 0.4, 0.58));
        wingL.position.set(-baseW * 0.72, baseH * 0.34, -1.48);
        const wingR = wingL.clone();
        wingR.position.x = baseW * 0.72;
        compoundGroup.add(wingL, wingR);
      }
      if (era >= 5) {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 8), makePbr(0xfbbf24, 0.18, 0.94, false, { emissive: 0xd97706, emissiveIntensity: 0.5 }));
        spire.position.set(0, baseH + 0.42, -1.55);
        compoundGroup.add(spire);
      }
      compoundGroup.userData.era = era;
    };
    rebuildCompoundEra(initialState.era || 1);
    refs.rebuildCompoundEra = rebuildCompoundEra;

    // 3D Tactical Holotable + Contraband Crates in Safehouse Courtyard
    const holotable = new THREE.Group();
    const htBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.44, 18), makePbr(0x1e293b, 0.3, 0.85));
    htBase.position.y = 0.22;
    const htScreen = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 22), makePbr(0x38bdf8, 0.1, 0.2, false, { emissive: 0x0284c7, emissiveIntensity: 0.9 }));
    htScreen.position.y = 0.46;
    const holoTower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), makePbr(0x67e8f9, 0.1, 0.1, false, { transparent: true, opacity: 0.62, emissive: 0x22d3ee, emissiveIntensity: 0.95 }));
    holoTower.position.y = 0.66;
    holotable.add(htBase, htScreen, holoTower);
    holotable.position.set(0.15, 0, 0.48);
    scene.add(holotable);

    const crateA = createItemMesh3D('weapon_cache', 'cache', 'epic', { withPedestalRing: false, disableAsyncUpgrade: true });
    crateA.scale.setScalar(0.38);
    crateA.position.set(-1.95, 0.22, 0.82);
    crateA.rotation.y = 0.35;
    scene.add(crateA);

    const operative = createHumanoid3D({ role: 'player', outfit: 'tactical', coatColor: 0x1e3a8a, trimColor: 0x38bdf8, rimColor: 0x38bdf8, weaponId: 'ak', headless });
    operative.position.set(-0.98, 0, 0.55);
    operative.rotation.y = 0.48;
    scene.add(operative);
    refs.operativeEid = spawnTracked(operative);

    // Mounted 3D Syndicate Companion in Safehouse Courtyard (swappable via companionId)
    const companionGroup = new THREE.Group();
    companionGroup.position.set(-0.52, 0.96, 0.92);
    scene.add(companionGroup);
    const rebuildCompanion = (compId = 'recon_drone') => {
      while (companionGroup.children.length) companionGroup.remove(companionGroup.children[0]);
      const cid = String(compId || 'recon_drone').toLowerCase();
      const cMesh = createItemMesh3D(cid, 'companion', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
      cMesh.scale.setScalar(/k9/.test(cid) ? 0.52 : 0.44);
      companionGroup.position.y = /k9/.test(cid) ? 0.24 : 0.96;
      companionGroup.add(cMesh);
      companionGroup.userData.companionId = cid;
    };
    rebuildCompanion(initialState.companionId || 'recon_drone');
    refs.companionGroup = companionGroup;
    refs.rebuildCompanion = rebuildCompanion;
    refs.companionEid = spawnTracked(companionGroup);
    world.setHoverFloat(refs.companionEid, companionGroup.position.y, 0.055, 1.5, 0.4);
    registerPickable(refs.companionEid, { stage: 'safehouse-empire', target: 'companion', companionId: companionGroup.userData.companionId });

    const nemesisWrap = new THREE.Group();
    const nemPodium = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.64, 0.16, 20), makePbr(0x450a0a, 0.3, 0.78, { color: 0xef4444, power: 2.0, intensity: 0.8 }));
    nemPodium.position.y = 0.08;
    const nemBody = createHumanoid3D({ role: 'nemesis', outfit: 'tactical', coatColor: 0x450a0a, trimColor: 0xef4444, rimColor: 0xff3b30, rimIntensity: 0.95, bossCrown: true, scale: 1.14, weaponId: 'shotgun', headless });
    nemBody.position.y = 0.16;
    nemesisWrap.add(nemPodium, nemBody);
    nemesisWrap.position.set(1.38, 0, 0.38);
    nemesisWrap.rotation.y = -0.52;
    scene.add(nemesisWrap);
    const nemEid = spawnTracked(nemesisWrap);
    world.setFresnelRim(nemEid, 0xff3b30, 2.0, 0.92, 1.15);
    registerPickable(nemEid, { stage: 'safehouse-empire', target: 'nemesis', id: 'nemesis' });
    refs.nemesisEid = nemEid;

    const crewSpecs = [
      { id: 'enforcer', outfit: 'tactical', x: -2.35, z: -0.25, color: 0xdc2626, weapon: 'shotgun' },
      { id: 'lookout', outfit: 'street', x: -1.75, z: -1.05, color: 0x0ea5e9, weapon: 'sniper' },
      { id: 'street_chemist', outfit: 'street', x: 0.0, z: -0.52, color: 0x10b981, weapon: 'xanax' },
      { id: 'wheelman', outfit: 'street', x: 1.85, z: -1.0, color: 0xf59e0b, weapon: 'smg' },
      { id: 'consigliere', outfit: 'suit', x: 2.45, z: -0.18, color: 0xa855f7, weapon: 'pistol' },
    ];
    refs.crewMeshes = [];
    for (let i = 0; i < crewSpecs.length; i++) {
      const cs = crewSpecs[i];
      const member = createHumanoid3D({ role: 'crew', outfit: cs.outfit, coatColor: cs.color, trimColor: 0xfbbf24, rimColor: 0x4ade80, scale: 0.84, weaponId: cs.weapon, headless });
      member.position.set(cs.x, 0, cs.z);
      member.rotation.y = -cs.x * 0.22;
      scene.add(member);
      const ceid = spawnTracked(member);
      world.setHoverFloat(ceid, 0, 0.025, 0.9, i * 1.1);
      registerPickable(ceid, { stage: 'safehouse-empire', target: 'crew', crewId: cs.id });
      refs.crewMeshes.push({ id: cs.id, mesh: member, eid: ceid });
    }

    const origins = [
      { originId: 'harbor_ghost', item: 'knife', cat: 'melee', x: -1.65, color: 0x38bdf8 },
      { originId: 'cartel_bruiser', item: 'bat', cat: 'melee', x: -0.55, color: 0xef4444 },
      { originId: 'disgraced_banker', item: 'gold_bullion', cat: 'contraband', x: 0.55, color: 0xfbbf24 },
      { originId: 'street_chemist', item: 'xanax', cat: 'drug', x: 1.65, color: 0xa855f7 },
    ];
    const originGroup = new THREE.Group();
    scene.add(originGroup);
    refs.originGroup = originGroup;
    refs.originEids = [];

    for (let i = 0; i < origins.length; i++) {
      const o = origins[i];
      const pedWrap = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.42, 0.24, 18),
        makePbr(0x1f2937, 0.3, 0.8, { color: o.color, power: 2.2, intensity: 0.75 })
      );
      base.position.y = 0.12;
      const itemMesh = createItemMesh3D(o.item, o.cat, 'legendary', { withPedestalRing: false, disableAsyncUpgrade: headless });
      itemMesh.scale.setScalar(0.46);
      itemMesh.position.y = 0.62;
      pedWrap.add(base, itemMesh);
      pedWrap.position.set(o.x, 0.02, 1.55);
      originGroup.add(pedWrap);

      const oeid = spawnTracked(pedWrap);
      world.setTurntable(oeid, 1.15, 5.0);
      world.setFresnelRim(oeid, o.color, 2.2, 0.82, 0.9);
      registerPickable(oeid, { stage: 'safehouse-empire', target: 'origin', originId: o.originId });
      refs.originEids.push(oeid);
    }

    const originChosen = String(initialState.originChosen ?? '1') !== '0' && initialState.originChosen !== false;
    originGroup.visible = !originChosen;
  }

  /* === STAGE 2: HEIST-BREACH (Crimes) === */
  else if (kind === 'heist-breach') {
    const lights = addStandardStageLighting(scene, 0x16181d, 0xef4444);
    refs.lights = lights;

    const vaultFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.0, 0.35), makePbr(0x334155, 0.34, 0.85));
    vaultFrame.position.set(0, 1.0, -1.35);
    scene.add(vaultFrame);

    const bullionInside = createItemMesh3D('gold_bullion', 'contraband', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
    bullionInside.position.set(0, 0.45, -1.65);
    scene.add(bullionInside);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.72, 1.0, -1.14);
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.20, 32), makePbr(0x94a3b8, 0.18, 0.95, { color: 0xfbbf24, power: 2.3, intensity: 0.58 }));
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(0.72, 0, 0);
    const gearRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.032, 10, 28), makePbr(0xf59e0b, 0.18, 0.95));
    gearRing.position.set(0.72, 0, 0.11);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 10, 24), makePbr(0xf59e0b, 0.18, 0.96));
    wheel.position.set(0.72, 0, 0.14);
    const hingePost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.56, 14), makePbr(0x64748b, 0.24, 0.92));
    hingePost.position.set(0, 0, 0.08);
    doorPivot.add(vaultDoor, gearRing, wheel, hingePost);
    for (let b = 0; b < 8; b++) {
      const bAng = (b / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), makePbr(0xe2e8f0, 0.14, 0.96));
      bolt.rotation.z = bAng + Math.PI / 2;
      bolt.position.set(0.72 + Math.cos(bAng) * 0.68, Math.sin(bAng) * 0.68, 0.08);
      doorPivot.add(bolt);
    }
    scene.add(doorPivot);
    refs.vaultDoorEid = spawnTracked(doorPivot);
    registerPickable(refs.vaultDoorEid, { stage: 'heist-breach', target: 'vault' });

    // Articulated Heist Breacher Operative with Thermal Drill
    const breacher = createHumanoid3D({ role: 'crew', outfit: 'tactical', coatColor: 0x1e293b, trimColor: 0xf59e0b, rimColor: 0xfbbf24, weaponId: 'drill', weaponCat: 'enhancer', headless });
    breacher.position.set(-0.65, 0, 0.55);
    breacher.rotation.y = 0.25;
    scene.add(breacher);
    refs.breacherEid = spawnTracked(breacher);
    playEidRigState(refs.breacherEid, 'vault_crack', 0);

    const laserGroup = new THREE.Group();
    const laserMat = makePbr(0xff1e42, 0.1, 0.1, false, { emissive: 0xff1e42, emissiveIntensity: 1.15, transparent: true, opacity: 0.82 });
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.6, 8), laserMat);
      beam.rotation.z = Math.PI / 2 + (i - 1) * 0.14;
      beam.position.set(0, 0.42 + i * 0.42, -0.35);
      laserGroup.add(beam);
    }
    const laserGridCtrl = createSecurityLaserGrid3D();
    laserGroup.add(laserGridCtrl.group);
    stageVfx.attachLaserGrid(laserGridCtrl);
    scene.add(laserGroup);
    refs.laserEid = spawnTracked(laserGroup);
    refs.laserGrid = laserGridCtrl;
    registerPickable(refs.laserEid, { stage: 'heist-breach', target: 'laser' });

    const atm = new THREE.Group();
    const atmBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.28, 0.52), makePbr(0x1e293b, 0.4, 0.65));
    atmBody.position.y = 0.64;
    const atmScreen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.55), makePbr(0x22d3ee, 0.1, 0.2, false, { emissive: 0x06b6d4, emissiveIntensity: 0.85 }));
    atmScreen.position.y = 0.88;
    atm.add(atmBody, atmScreen);
    atm.position.set(-2.05, 0, 0.15);
    atm.rotation.y = 0.42;
    scene.add(atm);
    registerPickable(spawnTracked(atm), { stage: 'heist-breach', target: 'atm' });

    const safe = createItemMesh3D('weapon_cache', 'cache', 'epic', { withPedestalRing: false, disableAsyncUpgrade: true });
    safe.scale.setScalar(0.52);
    safe.position.set(-1.35, 0.26, 1.2);
    scene.add(safe);
    registerPickable(spawnTracked(safe), { stage: 'heist-breach', target: 'safe' });

    const car = createItemMesh3D('sports_car', 'vehicle', 'legendary', { withPedestalRing: false, forHandHold: true, disableAsyncUpgrade: true });
    car.scale.setScalar(0.88);
    car.position.set(1.85, 0.26, 0.95);
    car.rotation.y = -0.58;
    scene.add(car);
    refs.carEid = spawnTracked(car);
    registerPickable(refs.carEid, { stage: 'heist-breach', target: 'getaway' });
  }

  /* === STAGE 3: GYM-IRONPIT (Gym) === */
  else if (kind === 'gym-ironpit') {
    addStandardStageLighting(scene, 0x1c1917, 0x22c55e);

    // Boxing Ring Corner Posts + 3-Tier Crimson Ring Ropes + Bench Press Prop
    const ringRopeMat = makePbr(0xdc2626, 0.4, 0.2, false, { emissive: 0x7f1d1d, emissiveIntensity: 0.3 });
    const postMat = makePbr(0x334155, 0.35, 0.85);
    const corners = [[-2.9, -1.8], [2.9, -1.8]];
    for (let c = 0; c < corners.length; c++) {
      const cPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.35, 12), postMat);
      cPost.position.set(corners[c][0], 0.68, corners[c][1]);
      scene.add(cPost);
    }
    for (let tier = 0; tier < 3; tier++) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 5.8, 10), ringRopeMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(0, 0.45 + tier * 0.34, -1.8);
      scene.add(rope);
    }

    // Flat Bench Press Prop
    const bench = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 1.12), makePbr(0x1e293b, 0.5, 0.2));
    pad.position.y = 0.42;
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.08), postMat);
    legF.position.set(0, 0.2, 0.42);
    const legB = legF.clone();
    legB.position.z = -0.42;
    bench.add(pad, legF, legB);
    bench.position.set(-1.35, 0, 1.05);
    bench.rotation.y = 0.35;
    scene.add(bench);

    // Articulated Athlete Operative with Twin Dumbbells
    const athlete = createHumanoid3D({ outfit: 'street', coatColor: 0x14532d, trimColor: 0x4ade80, rimColor: 0x4ade80, dumbbells: true, headless });
    athlete.position.set(0, 0, 0.68);
    scene.add(athlete);
    refs.athleteEid = spawnTracked(athlete);

    // 1. Heavy Bag Rig (STR)
    const strGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.05, 12), postMat);
    post.position.set(-0.35, 1.02, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.08), postMat);
    arm.position.set(-0.05, 2.0, 0);
    const bagPivot = new THREE.Group();
    bagPivot.position.set(0.18, 1.95, 0);
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.05, 18), makePbr(0xb91c1c, 0.45, 0.2, { color: 0xf87171, power: 2.2, intensity: 0.68 }));
    bag.position.y = -0.68;
    bagPivot.add(bag);
    strGroup.add(post, arm, bagPivot);
    strGroup.position.set(-2.15, 0, -0.35);
    scene.add(strGroup);
    refs.bagPivotEid = spawnTracked(bagPivot);
    registerPickable(spawnTracked(strGroup), { stage: 'gym-ironpit', target: 'station', stationId: 'str' });

    // 2. Ballistic Shield Press Rig (DEF)
    const defGroup = new THREE.Group();
    const rackL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.65, 0.6), postMat);
    rackL.position.set(-0.42, 0.82, 0);
    const rackR = rackL.clone();
    rackR.position.x = 0.42;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 12), makePbr(0xe2e8f0, 0.2, 0.95));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.18;
    const plateL = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 18), makePbr(0x2563eb, 0.3, 0.7, { color: 0x60a5fa, power: 2.2, intensity: 0.65 }));
    plateL.rotation.z = Math.PI / 2;
    plateL.position.set(-0.54, 1.18, 0);
    const plateR = plateL.clone();
    plateR.position.x = 0.54;
    defGroup.add(rackL, rackR, bar, plateL, plateR);
    defGroup.position.set(-0.75, 0, -1.05);
    scene.add(defGroup);
    refs.defEid = spawnTracked(defGroup);
    registerPickable(refs.defEid, { stage: 'gym-ironpit', target: 'station', stationId: 'def' });

    // 3. Neon Sprint Track (SPD)
    const spdGroup = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 1.65), makePbr(0x1e293b, 0.45, 0.55));
    deck.position.y = 0.07;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 1.48), makePbr(0x06b6d4, 0.15, 0.3, false, { emissive: 0x0891b2, emissiveIntensity: 0.8 }));
    strip.position.y = 0.075;
    const consolePost = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.95, 0.14), postMat);
    consolePost.position.set(0, 0.52, -0.72);
    spdGroup.add(deck, strip, consolePost);
    spdGroup.position.set(0.85, 0, -0.95);
    scene.add(spdGroup);
    refs.spdEid = spawnTracked(spdGroup);
    registerPickable(refs.spdEid, { stage: 'gym-ironpit', target: 'station', stationId: 'spd' });

    // 4. Laser Reflex Targets (DEX)
    const dexGroup = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.1 + Math.abs(i) * 0.15, 10), postMat);
      stand.position.set(i * 0.34, 0.55, Math.abs(i) * 0.18);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 18), makePbr(0xf59e0b, 0.15, 0.4, false, { emissive: 0xd97706, emissiveIntensity: 0.85 }));
      pad.rotation.x = Math.PI / 2;
      pad.position.set(i * 0.34, 1.12 + (1 - Math.abs(i)) * 0.16, Math.abs(i) * 0.18);
      dexGroup.add(stand, pad);
    }
    dexGroup.position.set(2.15, 0, -0.25);
    dexGroup.rotation.y = -0.45;
    scene.add(dexGroup);
    refs.dexEid = spawnTracked(dexGroup);
    world.setTurntable(refs.dexEid, 0.35, 5.0);
    registerPickable(refs.dexEid, { stage: 'gym-ironpit', target: 'station', stationId: 'dex' });
  }

  /* === STAGE 4: COMBAT-ARENA (Attack / Faction / Missions Boss) === */
  else if (kind === 'combat-arena') {
    addStandardStageLighting(scene, 0x171418, 0xef4444);

    // Noir Alley Streetlamp + Concrete Jersey Cover + Industrial Dumpster
    const streetlamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.55, 12), makePbr(0x334155, 0.35, 0.85));
    pole.position.y = 1.27;
    const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.06), makePbr(0x334155, 0.35, 0.85));
    lampArm.position.set(0.28, 2.52, 0);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), makePbr(0xfef08a, 0.1, 0.2, false, { emissive: 0xf59e0b, emissiveIntensity: 1.1 }));
    lantern.position.set(0.55, 2.42, 0);
    streetlamp.add(pole, lampArm, lantern);
    streetlamp.position.set(-0.35, 0, -1.65);
    scene.add(streetlamp);

    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.72), makePbr(0x14532d, 0.55, 0.35));
    dumpster.position.set(2.25, 0.39, -1.35);
    dumpster.rotation.y = -0.35;
    scene.add(dumpster);

    for (let i = -1; i <= 1; i += 2) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.56, 0.3), makePbr(0x334155, 0.52, 0.45));
      barrier.position.set(i * 1.95, 0.28, 0.95);
      barrier.rotation.y = i * 0.28;
      scene.add(barrier);
    }

    const player = createHumanoid3D({ outfit: 'tactical', coatColor: 0x0f172a, trimColor: 0x38bdf8, rimColor: 0x38bdf8, scale: 1.08, weaponId: 'assaultrifle_1', headless });
    player.position.set(-1.42, 0, 0.25);
    player.rotation.y = Math.PI * 0.44;
    scene.add(player);
    refs.playerEid = spawnTracked(player);

    const rival = createHumanoid3D({ outfit: 'suit', coatColor: 0x450a0a, trimColor: 0xf59e0b, rimColor: 0xff3b30, rimIntensity: 0.92, bossCrown: true, scale: 1.14, weaponId: 'sniper', headless });
    rival.position.set(1.42, 0, -0.15);
    rival.rotation.y = -Math.PI * 0.52;
    scene.add(rival);
    refs.rivalEid = spawnTracked(rival);
    world.setFresnelRim(refs.rivalEid, 0xff3b30, 2.0, 0.9, 1.2);
    registerPickable(refs.rivalEid, { stage: 'combat-arena', target: 'opponent' });
  }

  /* === STAGE 5: CITY-WHEELS-RACE (City Activities) === */
  else if (kind === 'city-wheels-race') {
    addStandardStageLighting(scene, 0x151821, 0x38bdf8);

    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.75, 0.28), makePbr(0xf59e0b, 0.22, 0.92));
    stand.position.set(0, 0.88, -0.85);
    const clapper = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), makePbr(0xef4444, 0.18, 0.4, false, { emissive: 0xdc2626, emissiveIntensity: 0.75 }));
    clapper.rotation.x = Math.PI;
    clapper.position.set(0, 2.38, -0.58);
    scene.add(stand, clapper);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.38, -0.66);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.08, 14, 44), makePbr(0xfbbf24, 0.18, 0.95));
    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.12, 20), makePbr(0xfbbf24, 0.16, 0.96));
    centerCap.rotation.x = Math.PI / 2;
    wheelGroup.add(wheelRim, centerCap);
    const segColors = [0xef4444, 0x38bdf8, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const wedge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88, 0.88, 0.055, 8, 1, false, ang, (Math.PI * 2) / 12 * 0.92),
        makePbr(segColors[i % segColors.length], 0.24, 0.42, false, { emissive: segColors[i % segColors.length], emissiveIntensity: 0.32 })
      );
      wedge.rotation.x = Math.PI / 2;
      wheelGroup.add(wedge);
    }
    for (let p = 0; p < 24; p++) {
      const pAng = (p / 24) * Math.PI * 2;
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), makePbr(0xfef08a, 0.15, 0.92));
      peg.rotation.x = Math.PI / 2;
      peg.position.set(Math.cos(pAng) * 0.92, Math.sin(pAng) * 0.92, 0.05);
      wheelGroup.add(peg);
    }
    scene.add(wheelGroup);
    refs.wheelEid = spawnTracked(wheelGroup);
    world.setStageKinematics(refs.wheelEid, ANIM_WHEEL_SPIN, 4.0, 1.25, 0);
    registerPickable(refs.wheelEid, { stage: 'city-wheels-race', target: 'wheel' });

    const fleetSubtypes = ['sports_car', 'interceptor_sedan', 'armored_van'];
    refs.carEids = [];
    const driftCarObjects = [];
    for (let i = 0; i < 3; i++) {
      const car = createItemMesh3D(fleetSubtypes[i], 'vehicle', 'legendary', { withPedestalRing: false, forHandHold: true, disableAsyncUpgrade: true });
      car.scale.setScalar(0.56);
      car.position.set(2.6, 0.16, 1.5);
      scene.add(car);
      const ceid = spawnTracked(car);
      world.setStageKinematics(ceid, ANIM_DRIFT_ORBIT, 10.0, 1.35 + i * 0.12, (i * Math.PI * 2) / 3);
      registerPickable(ceid, { stage: 'city-wheels-race', target: 'racecar', carIndex: i });
      refs.carEids.push(ceid);
      driftCarObjects.push(car);
    }
    stageVfx.attachDriftCars(driftCarObjects);
  }

  /* === STAGE 6: CASINO-ROYALE (Monte-Carlo Noir 37-Pocket Roulette & Jackpot Salon) === */
  else if (kind === 'casino-royale') {
    const lights = addStandardStageLighting(scene, 0x0b1d15, 0xf3c969);
    refs.lights = lights;

    // 1. Raised Monte-Carlo Emerald Baize Roulette Table + Brass Rail + 3D Chip Stacks
    const rouletteTable = new THREE.Group();
    rouletteTable.position.set(-1.18, 0, 0.18);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.08, 0.42, 32),
      makePbr(0x3b150e, 0.28, 0.35, { color: 0xf3c969, power: 2.5, intensity: 0.42 }, { clearcoat: 0.9 })
    );
    pedestal.position.y = 0.21;
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.10, 1.75),
      makePbr(0x064e3b, 0.72, 0.08, { color: 0x34d399, power: 2.8, intensity: 0.35 })
    );
    tableTop.position.set(0.28, 0.44, 0);
    const tableTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.64, 0.08, 1.84),
      makePbr(0x4a1912, 0.24, 0.42, { color: 0xf3c969, power: 2.3, intensity: 0.55 }, { clearcoat: 0.95 })
    );
    tableTrim.position.set(0.28, 0.43, 0);
    rouletteTable.add(pedestal, tableTrim, tableTop);

    const chipPalette = [0xf3c969, 0xdc2626, 0x10b981, 0x1e293b];
    const stackCoords = [[0.92, 0.34], [1.14, -0.22], [0.74, -0.42], [1.26, 0.18]];
    for (let st = 0; st < stackCoords.length; st++) {
      const chipMat = makePbr(chipPalette[st % chipPalette.length], 0.22, 0.65, { color: 0xfef08a, power: 2.2, intensity: 0.55 });
      for (let c = 0; c < 5; c++) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.024, 16), chipMat);
        chip.position.set(stackCoords[st][0], 0.505 + c * 0.025, stackCoords[st][1]);
        rouletteTable.add(chip);
      }
    }
    scene.add(rouletteTable);

    // 2. Museum-Grade 37-Pocket Monte-Carlo 3D European Roulette Wheel
    const wheel3D = createRouletteWheel3D();
    wheel3D.scale.setScalar(0.76);
    wheel3D.position.set(-1.32, 0.49, 0.18);
    scene.add(wheel3D);
    refs.rouletteWheel = wheel3D;

    const rotor = wheel3D.userData.rotor;
    refs.rouletteRotorEid = spawnTracked(rotor);
    world.setTurntable(refs.rouletteRotorEid, 1.45, 4.0);
    registerPickable(refs.rouletteRotorEid, { stage: 'casino-royale', target: 'roulette' });

    const ball = wheel3D.userData.ball;
    wheel3D.remove(ball);
    ball.scale.setScalar(0.95);
    ball.position.set(-1.32, 0.65, 0.18);
    ball.userData = Object.assign(ball.userData || {}, {
      rotorEid: refs.rouletteRotorEid,
      hasPocketTarget: true,
      pocketLocalAngle: wheel3D.userData.getPocketAngle(0),
    });
    scene.add(ball);
    refs.ball = ball;
    refs.ballEid = spawnTracked(ball);
    world.setStageKinematics(refs.ballEid, ANIM_ROULETTE_RIDE, 9999, 0, 0);

    // 3. Croupier Suit Operative Behind the Roulette Pit
    const croupier = createHumanoid3D({
      role: 'crew',
      outfit: 'suit',
      coatColor: 0x111115,
      trimColor: 0xf3c969,
      rimColor: 0xfbbf24,
      scale: 0.96,
      headless,
    });
    croupier.position.set(-0.88, 0, -1.02);
    croupier.rotation.y = 0.18;
    scene.add(croupier);
    refs.croupierEid = spawnTracked(croupier);
    registerPickable(refs.croupierEid, { stage: 'casino-royale', target: 'croupier' });

    // 3.5 Monte-Carlo 3D Blackjack 52-Card Shoe Table & Dealer (submode === 'blackjack')
    const bjGroup = new THREE.Group();
    bjGroup.position.set(0.05, 0, 1.92);
    const bjBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.92, 0.44, 24),
      makePbr(0x3b150e, 0.26, 0.38, { color: 0xf3c969, power: 2.4, intensity: 0.42 }, { clearcoat: 0.9 })
    );
    bjBase.position.y = 0.22;
    const bjRail = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.18, 0.08, 32, 1, false, -Math.PI * 0.55, Math.PI * 1.1),
      makePbr(0x4a1912, 0.22, 0.44, { color: 0xf3c969, power: 2.2, intensity: 0.58 }, { clearcoat: 0.95 })
    );
    bjRail.position.y = 0.45;
    const bjFelt = new THREE.Mesh(
      new THREE.CylinderGeometry(1.10, 1.10, 0.09, 32),
      makePbr(0x065f46, 0.72, 0.08, { color: 0x34d399, power: 2.6, intensity: 0.38 })
    );
    bjFelt.position.y = 0.45;
    const bjBrassArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.012, 8, 32, Math.PI),
      makePbr(0xf3c969, 0.16, 0.96)
    );
    bjBrassArc.rotation.x = Math.PI / 2;
    bjBrassArc.position.set(0, 0.50, -0.05);
    // 6-Deck Acrylic & Brass Dealing Shoe + Dealt 3D Cards
    const shoeBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 0.42),
      makePbr(0x1e293b, 0.14, 0.72, { color: 0xf3c969, power: 2.1, intensity: 0.65 }, { clearcoat: 1.0 })
    );
    shoeBox.position.set(0.62, 0.57, -0.22);
    shoeBox.rotation.y = -0.42;
    const cardMatWhite = makePbr(0xfefce8, 0.22, 0.08, { color: 0xfef08a, power: 2.5, intensity: 0.35 });
    const cardMatBack = makePbr(0x991b1b, 0.28, 0.22, { color: 0xf3c969, power: 2.3, intensity: 0.45 });
    const bjCardMeshes = [];
    const cardPositions = [
      [-0.22, 0.505, 0.36, 0.08, cardMatWhite],
      [0.02, 0.508, 0.38, -0.09, cardMatWhite],
      [-0.18, 0.505, -0.18, 0.04, cardMatWhite],
      [0.06, 0.508, -0.18, -0.05, cardMatBack],
    ];
    for (let ci = 0; ci < cardPositions.length; ci++) {
      const cp = cardPositions[ci];
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.26), cp[4]);
      cMesh.position.set(cp[0], cp[1], cp[2]);
      cMesh.rotation.y = cp[3];
      bjGroup.add(cMesh);
      bjCardMeshes.push(cMesh);
    }
    for (let st = -1; st <= 1; st++) {
      const chipMat = makePbr(chipPalette[(st + 1) % chipPalette.length], 0.22, 0.65);
      for (let ch = 0; ch < 4; ch++) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.022, 14), chipMat);
        chip.position.set(-0.56 + st * 0.16, 0.505 + ch * 0.023, 0.22);
        bjGroup.add(chip);
      }
    }
    bjGroup.add(bjBase, bjRail, bjFelt, bjBrassArc, shoeBox);
    scene.add(bjGroup);
    refs.bjGroup = bjGroup;
    refs.bjCardMeshes = bjCardMeshes;
    registerPickable(spawnTracked(bjGroup), { stage: 'casino-royale', target: 'blackjack' });

    const bjDealer = createHumanoid3D({
      role: 'crew',
      outfit: 'suit',
      coatColor: 0x141218,
      trimColor: 0x34d399,
      rimColor: 0xf3c969,
      scale: 0.94,
      headless,
    });
    bjDealer.position.set(0.05, 0, 0.92);
    scene.add(bjDealer);
    refs.bjDealerEid = spawnTracked(bjDealer);

    // 4. Art-Deco 3D Mechanical Jackpot Slot Machine
    const slotCabinet = createSlotMachine3D();
    slotCabinet.position.set(1.62, 0, -0.02);
    slotCabinet.rotation.y = -0.12;
    scene.add(slotCabinet);
    refs.slotCabinet = slotCabinet;
    refs.reelEids = [];
    const slotReels = slotCabinet.userData.reels || [];
    for (let r = 0; r < slotReels.length; r++) {
      const reid = spawnTracked(slotReels[r]);
      refs.reelEids.push(reid);
    }
    if (slotCabinet.userData.leverPivot) {
      refs.slotLeverEid = spawnTracked(slotCabinet.userData.leverPivot);
    }
    registerPickable(spawnTracked(slotCabinet), { stage: 'casino-royale', target: 'slots' });

    // 5. Submode Camera Presets ('blackjack' close-up, 'roulette' close-up, 'slots' close-up, 'full' salon)
    const applyCasinoSubmode = (submodeRaw) => {
      const sm = String(submodeRaw || 'full').toLowerCase();
      let cx = 0;
      let cy = 2.38;
      let cz = 4.85;
      let tx = -0.15;
      let ty = 0.78;
      let tz = 0.05;
      if (sm === 'blackjack') {
        cx = 0.05; cy = 1.94; cz = 3.68;
        tx = 0.05; ty = 0.58; tz = 1.84;
      } else if (sm === 'roulette') {
        cx = -1.32; cy = 1.98; cz = 2.02;
        tx = -1.24; ty = 0.58; tz = 0.18;
      } else if (sm === 'slots') {
        cx = 1.54; cy = 1.30; cz = 2.08;
        tx = 1.62; ty = 1.12; tz = 0.16;
      }
      camera.position.set(cx, cy, cz);
      camera.lookAt(tx, ty, tz);
      camera.userData.z3dLookTarget = { x: tx, y: ty, z: tz };
      camera.userData.z3dSubmode = sm;
      world.setTraumaCamera(camEid, {
        baseX: cx,
        baseY: cy,
        baseZ: cz,
        decay: 1.4,
        maxOffsetX: 0.28,
        maxOffsetY: 0.18,
        maxRoll: 0.035,
      });
    };
    applyCasinoSubmode(initialState.submode || 'full');
    refs.applyCasinoSubmode = applyCasinoSubmode;
  }

  /* === STAGE 7: PAPERDOLL-ARMORY (Dossier / Items) === */
  else if (kind === 'paperdoll-armory') {
    addStandardStageLighting(scene, 0x171923, 0x8b5cf6, 2.8);
    camera.position.set(0, 1.65, 3.65);
    camera.lookAt(0, 0.95, 0);
    world.setTraumaCamera(camEid, { baseX: 0, baseY: 1.65, baseZ: 3.65 });

    const rigGroup = new THREE.Group();
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.18, 0.16, 32), makePbr(0x1e293b, 0.28, 0.88, { color: 0xa855f7, power: 2.2, intensity: 0.7 }));
    dais.position.y = 0.08;
    const mannequin = createHumanoid3D({ outfit: 'tactical', coatColor: 0x1e293b, trimColor: 0xa855f7, rimColor: 0xc084fc, scale: 1.16, weaponId: initialState.primary || 'assaultrifle_1', headless });
    mannequin.position.y = 0.16;
    rigGroup.add(dais, mannequin);
    scene.add(rigGroup);

    refs.rigEid = spawnTracked(rigGroup);
    world.setTurntable(refs.rigEid, 0.72, 5.5);
    registerPickable(refs.rigEid, { stage: 'paperdoll-armory', target: 'loadout' });

    const leftStand = createItemMesh3D(initialState.secondary || 'magnum', 'weapon', 'legendary', { disableAsyncUpgrade: headless });
    leftStand.scale.setScalar(0.56);
    leftStand.position.set(-1.68, 0.95, -0.25);
    scene.add(leftStand);
    world.setTurntable(spawnTracked(leftStand), -0.85, 5.0);

    const rightStand = createItemMesh3D(initialState.melee || 'katana', 'melee', 'legendary', { disableAsyncUpgrade: headless });
    rightStand.scale.setScalar(0.56);
    rightStand.position.set(1.68, 0.95, -0.25);
    scene.add(rightStand);
    world.setTurntable(spawnTracked(rightStand), 0.85, 5.0);
  }

  /* === STAGE 8: CHARACTER-TURNTABLE (#zone-char-3d Fallback Showcase) === */
  else if (kind === 'character-turntable') {
    addStandardStageLighting(scene, 0x15181b, 0x8ec364, 1.55);
    camera.position.set(0, 1.38, 2.95);
    camera.lookAt(0, 0.92, 0);
    world.setTraumaCamera(camEid, { baseX: 0, baseY: 1.38, baseZ: 2.95 });

    const turntableGroup = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.98, 0.14, 36),
      makePbr(0x1f2428, 0.28, 0.86, { color: 0x8ec364, power: 2.2, intensity: 0.72 })
    );
    plinth.position.y = 0.07;
    turntableGroup.add(plinth);
    scene.add(turntableGroup);

    const charHolder = new THREE.Group();
    charHolder.position.y = 0.14;
    turntableGroup.add(charHolder);

    const rebuildOutfit = (outfitName = 'street', weaponId = undefined) => {
      const normOutfit = /suit|بدلة|exec/.test(String(outfitName).toLowerCase())
        ? 'suit'
        : /tact|تكتيك|armor/.test(String(outfitName).toLowerCase())
          ? 'tactical'
          : 'street';

      if (refs.charEid !== undefined && charHolder.children.length > 0 && !weaponId && setEidRigOutfit(refs.charEid, normOutfit)) {
        charHolder.userData.outfit = normOutfit;
        return;
      }

      while (charHolder.children.length) charHolder.remove(charHolder.children[0]);
      const fig = createHumanoid3D({
        role: 'player',
        outfit: normOutfit,
        scale: 1.24,
        weaponId: weaponId || (normOutfit === 'suit' ? 'pistol_t' : normOutfit === 'tactical' ? 'assaultrifle_1' : 'ak'),
        rimColor: normOutfit === 'suit' ? 0xfbbf24 : normOutfit === 'tactical' ? 0x38bdf8 : 0x8ec364,
        headless,
      });
      charHolder.add(fig);
      charHolder.userData.outfit = normOutfit;
      if (refs.charEid !== undefined) {
        world.refreshEntityRimCache(refs.charEid);
      }
    };

    rebuildOutfit(initialState.outfit || 'street', initialState.weaponId);
    refs.rebuildOutfit = rebuildOutfit;
    refs.charHolder = charHolder;

    refs.charEid = spawnTracked(turntableGroup);
    world.setTurntable(refs.charEid, 0.58, 5.5);
    registerPickable(refs.charEid, { stage: 'character-turntable', target: 'character' });
  }

  let lastStation = String(initialState.activeStation || '');

  function triggerAction(actionName = 'pulse', payload = {}) {
    const act = String(actionName || 'pulse').toLowerCase();
    const isHeavy = /(confront|boss|attack|mug|hosp|execute|jackpot|raid|crit)/.test(act);
    if (!isReducedMotion()) {
      world.addTrauma(camEid, isHeavy ? 0.65 : 0.32);
    }
    world.triggerHitStop(isHeavy ? 0.08 : 0.04, 0.06, camEid);
    world.setStageKinematics(burstEid, ANIM_BURST_POP, 0.52, 0.75, 1.35);

    const clip = resolveRigClipFromAction(act, kind, payload);

    if (kind === 'safehouse-empire') {
      if (refs.operativeEid !== undefined) {
        world.setStageKinematics(refs.operativeEid, ANIM_LUNGE, 0.44, 0.65, -0.12);
        playEidRigState(refs.operativeEid, clip);
      }
      if (refs.nemesisEid !== undefined && /nemesis|confront|attack|hit/.test(act)) {
        world.setStageKinematics(refs.nemesisEid, ANIM_LUNGE, 0.48, -0.45, 0.08);
        playEidRigState(refs.nemesisEid, /hit|attack|fire|slash/.test(act) ? 'hit_react' : clip);
      }
    } else if (kind === 'heist-breach') {
      if (refs.vaultDoorEid !== undefined) world.setStageKinematics(refs.vaultDoorEid, ANIM_VAULT_OPEN, 0.95, 0, -1.35);
      if (refs.carEid !== undefined) world.setStageKinematics(refs.carEid, ANIM_LUNGE, 0.65, 0.45, 0.32);
      if (refs.breacherEid !== undefined) playEidRigState(refs.breacherEid, /hit|alert/.test(act) ? 'hit_react' : 'vault_crack');
    } else if (kind === 'gym-ironpit') {
      const stat = String((payload && payload.stat) || act || 'str').toLowerCase();
      if (refs.athleteEid !== undefined) {
        world.setStageKinematics(refs.athleteEid, ANIM_LUNGE, 0.38, 0, -0.35);
        playEidRigState(refs.athleteEid, 'heavy_bag_hook');
      }
      if (refs.bagPivotEid !== undefined && (stat.includes('str') || stat === 'train' || stat.includes('punch'))) {
        world.setStageKinematics(refs.bagPivotEid, ANIM_BAG_SWING, 0.85, 0.48, 0);
      }
    } else if (kind === 'combat-arena') {
      if (refs.playerEid !== undefined) {
        world.setStageKinematics(refs.playerEid, ANIM_LUNGE, 0.42, 0.95, -0.18);
        if (payload && payload.outfit) setEidRigOutfit(refs.playerEid, payload.outfit);
        playEidRigState(refs.playerEid, payload && payload.target === 'player' ? 'hit_react' : clip);
      }
      if (refs.rivalEid !== undefined) {
        world.setStageKinematics(refs.rivalEid, ANIM_LUNGE, 0.46, 0.35, 0.08);
        playEidRigState(refs.rivalEid, /(ko|execute|defeat)/.test(act) ? 'ko_collapse' : 'hit_react');
      }
    } else if (kind === 'city-wheels-race') {
      if (refs.wheelEid !== undefined) world.setStageKinematics(refs.wheelEid, ANIM_WHEEL_SPIN, 3.2, 9.5, 1);
    } else if (kind === 'casino-royale') {
      const stageSubmode = (camera.userData && camera.userData.z3dSubmode) || 'full';
      const targetSubmode = payload && payload.submode ? String(payload.submode).toLowerCase() : '';
      if (targetSubmode && stageSubmode !== 'full' && stageSubmode !== targetSubmode) {
        return false;
      }
      const isSlotsAction = targetSubmode === 'slots' || /slot|lever|reel/.test(act);
      const isBjAction = targetSubmode === 'blackjack' || /bj|blackjack|deal|hit|stand|double/.test(act);
      const isRouletteAction = !isSlotsAction && !isBjAction;

      if (isRouletteAction || stageSubmode === 'full') {
        if (refs.ball && refs.rouletteWheel && refs.rouletteWheel.userData && typeof refs.rouletteWheel.userData.getPocketAngle === 'function') {
          if (payload && payload.pocket !== undefined && payload.pocket !== null) {
            refs.ball.userData.hasPocketTarget = true;
            refs.ball.userData.pocketLocalAngle = refs.rouletteWheel.userData.getPocketAngle(payload.pocket);
            const dur = payload.durationSec || 1.65;
            if (refs.ballEid !== undefined) {
              world.setStageKinematics(refs.ballEid, ANIM_ROULETTE_BALL, dur, -13.5, refs.ball.userData.pocketLocalAngle);
            }
          } else {
            refs.ball.userData.hasPocketTarget = false;
            if (refs.ballEid !== undefined) {
              world.setStageKinematics(refs.ballEid, ANIM_ROULETTE_BALL, 4.2, -14.0, 0);
            }
          }
        }
        if (refs.rouletteRotorEid !== undefined && world.isAlive(refs.rouletteRotorEid)) {
          world.stores.TurntableSpin[refs.rouletteRotorEid * 4 + 0] = 3.1;
        }
        if (refs.croupierEid !== undefined) {
          playEidRigState(refs.croupierEid, 'combat_stance');
        }
      }

      if (isSlotsAction || (stageSubmode === 'full' && act === 'spin' && !targetSubmode)) {
        if (refs.slotLeverEid !== undefined && !payload?.skipLever) {
          world.setStageKinematics(refs.slotLeverEid, ANIM_LEVER_PULL, 0.68, 1.12, 0);
        }
        if (refs.reelEids) {
          const targetReels = Array.isArray(payload && payload.reels) && payload.reels.length === 3 ? payload.reels : null;
          for (let i = 0; i < refs.reelEids.length; i++) {
            if (targetReels) {
              const symAng = getSlotSymbolTargetAngle(targetReels[i]);
              world.setStageKinematics(refs.reelEids[i], ANIM_SLOT_REEL_TARGET, 0.72 + i * 0.38, 19.5, symAng);
            } else {
              world.setStageKinematics(refs.reelEids[i], ANIM_SLOT_REEL, 2.2 + i * 0.35, -18.5, 1);
            }
          }
        }
      }

      if (isBjAction && refs.bjDealerEid !== undefined) {
        playEidRigState(refs.bjDealerEid, 'combat_stance');
      }
    } else if (kind === 'paperdoll-armory' && refs.rigEid !== undefined) {
      if (world.isAlive(refs.rigEid)) world.stores.TurntableSpin[refs.rigEid * 4 + 1] += 0.9;
      if (payload && payload.outfit) setEidRigOutfit(refs.rigEid, payload.outfit);
      playEidRigState(refs.rigEid, clip);
    } else if (kind === 'character-turntable' && refs.charEid !== undefined) {
      if (world.isAlive(refs.charEid)) world.stores.TurntableSpin[refs.charEid * 4 + 1] += 0.75;
      if (act === 'outfit' && payload && payload.outfit && refs.rebuildOutfit) {
        refs.rebuildOutfit(payload.outfit, payload.weaponId);
      }
      playEidRigState(refs.charEid, act === 'outfit' ? 'idle_breathe' : clip);
    }

    stageVfx.triggerAction(act, payload);

    if (!headless) {
      if (/(crit|execute|boss-confront)/.test(act)) {
        triggerScreenFx('crit-flash');
      } else if (/(low.?hp|hosp|mug|bleed)/.test(act)) {
        triggerScreenFx('low-hp');
      } else if (/(alert|alarm|laser|stealth)/.test(act)) {
        triggerScreenFx('stealth-alert');
      }
    }

    emitGlobal3DActionEvent(kind, act, payload);
    return true;
  }

  function updateState(stateObj = {}) {
    if (!stateObj || typeof stateObj !== 'object') return false;

    const explicitActKey = ['attack', 'slash', 'fire', 'crack', 'punch', 'hit'].find((k) => Boolean(stateObj[k]));
    if (explicitActKey) {
      triggerAction(explicitActKey, stateObj);
    }

    if (stageEnv && typeof stageEnv.setEra === 'function' && (stateObj.era !== undefined || (stateObj.eraProgression && stateObj.eraProgression.currentEra !== undefined))) {
      stageEnv.setEra(Number(stateObj.era ?? stateObj.eraProgression.currentEra ?? 1));
    }

    if (kind === 'safehouse-empire') {
      const prevEra = refs.compoundGroup && refs.compoundGroup.userData ? refs.compoundGroup.userData.era : 1;
      const nextEra = Number(
        stateObj.era ??
        (stateObj.eraProgression && stateObj.eraProgression.currentEra) ??
        prevEra ??
        1
      );
      if (refs.rebuildCompoundEra && nextEra !== prevEra) {
        refs.rebuildCompoundEra(nextEra);
        stageVfx.triggerAction('era_breakthrough', { era: nextEra });
        emitGlobal3DActionEvent(kind, 'era_breakthrough', { era: nextEra });
      }
      if (stateObj.companionId && refs.rebuildCompanion) {
        const prevComp = refs.companionGroup && refs.companionGroup.userData ? refs.companionGroup.userData.companionId : '';
        if (String(stateObj.companionId).toLowerCase() !== prevComp) {
          refs.rebuildCompanion(stateObj.companionId);
          if (refs.companionEid !== undefined) world.refreshEntityRimCache(refs.companionEid);
        }
      }
      if (stateObj.outfit && refs.operativeEid !== undefined) {
        setEidRigOutfit(refs.operativeEid, stateObj.outfit);
        emitGlobal3DActionEvent(kind, 'outfit', { outfit: stateObj.outfit });
      }
      if (refs.originGroup) {
        const oc = stateObj.originChosen !== undefined
          ? Boolean(stateObj.originChosen && String(stateObj.originChosen) !== '0')
          : !(stateObj.origin && stateObj.origin.chosen === false);
        refs.originGroup.visible = !oc;
      }
      if (refs.crewMeshes && Array.isArray(stateObj.crew || (stateObj.streetCrew && stateObj.streetCrew.roster))) {
        const list = stateObj.crew || stateObj.streetCrew.roster;
        const recruitedSet = new Set(
          list.filter((c) => c && (c.recruited || c.level > 0 || c.owned)).map((c) => String(c.id || c.role || '').toLowerCase())
        );
        for (let i = 0; i < refs.crewMeshes.length; i++) {
          const entry = refs.crewMeshes[i];
          const isRecruited = recruitedSet.size === 0 || recruitedSet.has(entry.id);
          entry.mesh.scale.setScalar(isRecruited ? 0.88 : 0.68);
        }
      }
    } else if (kind === 'gym-ironpit' && stateObj.activeStation) {
      const st = String(stateObj.activeStation).toLowerCase();
      const map = { str: refs.bagPivotEid, def: refs.defEid, spd: refs.spdEid, dex: refs.dexEid };
      if (map[st] !== undefined) {
        world.setFresnelRim(map[st], 0x4ade80, 1.8, 1.05, 1.6);
      }
      if (st !== lastStation) {
        lastStation = st;
        if (refs.athleteEid !== undefined) playEidRigState(refs.athleteEid, 'heavy_bag_hook');
        emitGlobal3DActionEvent(kind, st, { stat: st });
      }
    } else if (kind === 'casino-royale') {
      if (stateObj.submode && refs.applyCasinoSubmode) {
        refs.applyCasinoSubmode(stateObj.submode);
      }
      if (stateObj.pocket !== undefined && refs.ballEid !== undefined) {
        triggerAction('spin', { pocket: stateObj.pocket });
      }
    } else if (kind === 'character-turntable' && stateObj.outfit && refs.rebuildOutfit) {
      const prevOutfit = refs.charHolder && refs.charHolder.userData ? refs.charHolder.userData.outfit : '';
      refs.rebuildOutfit(stateObj.outfit, stateObj.weaponId);
      if (refs.charEid !== undefined) world.refreshEntityRimCache(refs.charEid);
      const curOutfit = refs.charHolder && refs.charHolder.userData ? refs.charHolder.userData.outfit : '';
      if (curOutfit !== prevOutfit) {
        playEidRigState(refs.charEid, 'idle_breathe');
        stageVfx.triggerAction('outfit', { outfit: curOutfit });
        emitGlobal3DActionEvent(kind, 'outfit', { outfit: curOutfit });
      }
    } else if (stateObj.outfit) {
      const targetEid = refs.playerEid ?? refs.breacherEid ?? refs.athleteEid ?? refs.rigEid;
      if (targetEid !== undefined) {
        setEidRigOutfit(targetEid, stateObj.outfit);
        emitGlobal3DActionEvent(kind, 'outfit', { outfit: stateObj.outfit });
      }
    }

    if (!headless) {
      if (stateObj.lowHp || (typeof stateObj.hpPct === 'number' && stateObj.hpPct <= 0.25)) {
        triggerScreenFx('low-hp');
      }
      if (stateObj.stealthAlert || stateObj.alert) {
        triggerScreenFx('stealth-alert');
      }
    }
    return true;
  }

  function dispose() {
    world.unregisterStageVfx(stageVfx);
    stageVfx.dispose();
    if (stageEnv) {
      world.unregisterStageVfx(stageEnv);
      if (typeof stageEnv.dispose === 'function') stageEnv.dispose();
    }
    for (let i = 0; i < spawnedEids.length; i++) {
      const rigs = world.riggedCache[spawnedEids[i]];
      if (rigs) {
        for (let r = 0; r < rigs.length; r++) {
          if (rigs[r] && typeof rigs[r].dispose === 'function') {
            try { rigs[r].dispose(); } catch (_) { /* ignore */ }
          }
        }
      }
      world.despawnImmediate(spawnedEids[i]);
    }
    spawnedEids.length = 0;
    pickableEids.length = 0;
  }

  return {
    kind,
    scene,
    camera,
    camEid,
    spawnedEids,
    pickableEids,
    refs,
    triggerAction,
    updateState,
    dispose,
  };
}

/* --------------------------------------------------------------------------
 * 6. SINGLE-SHARED-CONTEXT WEBGL RUNTIME (`ZoneEcs3DRuntime`)
 *    `webglContexts` === 1 across ALL item cards, ALL stages, AND 3D Orbit
 *    Studio modal! Eliminates WebGL context starvation page-wide!
 * -------------------------------------------------------------------------- */
export class ZoneEcs3DRuntime {
  constructor(opts = {}) {
    this.createRenderer = opts.createRenderer || ((params) => new THREE.WebGLRenderer(params));
    this.world = new ZoneEcsWorld({
      renderHook: (scaledDt, realDt) => this._renderFrame(scaledDt, realDt),
    });

    this.sharedRenderer = null;
    this.sharedEnvTexture = null;

    this.itemScene = new THREE.Scene();
    this.itemCamera = new THREE.PerspectiveCamera(38, 220 / 180, 0.1, 30);
    this.itemCamera.position.set(0, 0.36, 2.22);
    this.itemCamera.lookAt(0, -0.02, 0);
    this._setupItemStudioLighting();

    this.inspectorCanvas = null;
    this.inspectorCtx = null;
    this.inspectorControls = null;
    this.inspectorScene = null;
    this.inspectorCamera = null;
    this.inspectorItemEid = -1;
    this.inspectorModalEl = null;
    this.inspectorOpen = false;

    this.itemSlots = new Map();
    this.stageInstances = new Map();
    this._slotsScratch = [];
    this.gpuGovernor = new ZoneGpuBudgetGovernor(opts.gpuBudget || {});
    this._graphicsPreset = 'high';
    this._shadowsEnabled = GRAPHICS_PRESETS.high.shadowsEnabled;
    this._particleScaleOverride = null;
    this.resScaler = new DynamicResScaler({
      minDpr: 0.60,
      presetCap: GRAPHICS_PRESETS.high.dprCap,
      dynamicResAuto: opts.dynamicResAuto !== undefined ? Boolean(opts.dynamicResAuto) : true,
    });
    this._roundRobinCursor = 0;
    this._drawCalls = 0;
    this._triangles = 0;
    this._contextLost = false;
    this._webglContextCount = 0;
    this._rafId = 0;
    this._running = false;
    this._boundSettingsWin = null;
    this._onSettingsChanged = (ev) => {
      const detail = ev && ev.detail && typeof ev.detail === 'object' ? ev.detail : (ev || {});
      this.setGraphicsConfig(detail);
    };

    if (opts.graphicsConfig) {
      this.setGraphicsConfig(opts.graphicsConfig);
    }
    this._ensureSettingsListener(opts.window);

    if (typeof globalThis !== 'undefined' && globalThis.window && globalThis.window.ZoneEcs3D) {
      globalThis.window.ZoneEcs3D.setGraphicsConfig = (cfg) => this.setGraphicsConfig(cfg);
      globalThis.window.ZoneEcs3D.getGraphicsConfig = () => this.getGraphicsConfig();
    }

    this._unsubUpgrade = onWeaponAssetUpgraded((upgradedId) => {
      for (const rec of this.itemSlots.values()) {
        if (rec.itemId === upgradedId) {
          this.world.refreshEntityRimCache(rec.eid);
          rec.dirty = true;
        }
      }
      if (this.inspectorOpen && this.inspectorItemEid >= 0) {
        this.world.refreshEntityRimCache(this.inspectorItemEid);
      }
    });
  }

  _ensureSettingsListener(winOverride = undefined) {
    const win = winOverride || (typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : (typeof window !== 'undefined' ? window : null));
    if (!win || typeof win.addEventListener !== 'function') return false;
    if (this._boundSettingsWin === win) return true;
    if (this._boundSettingsWin && typeof this._boundSettingsWin.removeEventListener === 'function') {
      try {
        this._boundSettingsWin.removeEventListener('zone:settings-changed', this._onSettingsChanged);
      } catch (_) { /* ignore */ }
    }
    win.addEventListener('zone:settings-changed', this._onSettingsChanged);
    this._boundSettingsWin = win;
    return true;
  }

  setGraphicsConfig(rawConfig = {}) {
    const cfg = typeof rawConfig === 'string'
      ? { preset: rawConfig }
      : (rawConfig && typeof rawConfig === 'object' ? rawConfig : {});
    const sub = cfg.graphics && typeof cfg.graphics === 'object' ? cfg.graphics : {};

    const rawPreset = cfg.preset ?? cfg.graphicsPreset ?? cfg.qualityPreset ?? cfg.graphicsQuality ?? sub.preset ?? sub.graphicsPreset;
    const hasExplicitPreset = rawPreset !== undefined && rawPreset !== null && String(rawPreset).trim() !== '';
    const presetKey = hasExplicitPreset
      ? String(rawPreset).trim().toLowerCase()
      : (this._graphicsPreset || 'high');
    const presetDef = Object.hasOwn(GRAPHICS_PRESETS, presetKey)
      ? GRAPHICS_PRESETS[presetKey]
      : GRAPHICS_PRESETS.high;

    this._graphicsPreset = presetDef.preset;

    const rawAuto = cfg.dynamicResAuto ?? cfg.dynamicRes ?? cfg.autoDpr ?? cfg.dynamicResolution ?? sub.dynamicResAuto;
    if (typeof rawAuto === 'boolean') {
      this.resScaler.dynamicResAuto = rawAuto;
    }

    const nextDprCap = typeof cfg.dprCap === 'number' && Number.isFinite(cfg.dprCap)
      ? cfg.dprCap
      : (hasExplicitPreset ? presetDef.dprCap : this.resScaler.presetCap);
    this.resScaler.setPresetCap(nextDprCap, { resetCurrent: true, resetCooldown: true });

    let nextParticleScale;
    if (typeof cfg.particleScale === 'number' && Number.isFinite(cfg.particleScale)) {
      nextParticleScale = cfg.particleScale > 2 ? cfg.particleScale / 100 : Math.max(0, cfg.particleScale);
    } else if (hasExplicitPreset) {
      nextParticleScale = presetDef.particleScale;
    } else if (typeof cfg.particleDensity === 'number' && Number.isFinite(cfg.particleDensity)) {
      nextParticleScale = cfg.particleDensity > 2 ? cfg.particleDensity / 100 : Math.max(0, cfg.particleDensity);
    } else {
      nextParticleScale = this._particleScaleOverride !== null ? this._particleScaleOverride : presetDef.particleScale;
    }
    this._particleScaleOverride = Number(nextParticleScale.toFixed(2));

    if (typeof cfg.targetRefreshHz === 'number' && Number.isFinite(cfg.targetRefreshHz)) {
      this.resScaler.targetRefreshHz = Math.max(0, cfg.targetRefreshHz);
    }

    const rawShadows = cfg.shadowsEnabled ?? cfg.shadows ?? sub.shadowsEnabled;
    if (typeof rawShadows === 'boolean') {
      this._shadowsEnabled = rawShadows;
    } else if (hasExplicitPreset) {
      this._shadowsEnabled = presetDef.shadowsEnabled;
    }

    if (this.sharedRenderer && this.sharedRenderer.shadowMap) {
      this.sharedRenderer.shadowMap.enabled = this._shadowsEnabled;
      this.sharedRenderer.shadowMap.needsUpdate = true;
    }

    for (const ctrl of this.world.stageVfxControllers) {
      if (ctrl && ctrl.pool) {
        ctrl.pool.budgetThrottleScale = this._particleScaleOverride;
      }
    }

    for (const sRec of this.stageInstances.values()) {
      const lights = sRec.built && sRec.built.refs && sRec.built.refs.lights;
      if (lights && lights.key) {
        lights.key.castShadow = this._shadowsEnabled;
        if (lights.key.shadow) {
          lights.key.shadow.autoUpdate = this._shadowsEnabled;
          lights.key.shadow.needsUpdate = true;
        }
      }
    }

    for (const rec of this.itemSlots.values()) {
      rec.dirty = true;
    }

    return this.getGraphicsConfig();
  }

  getGraphicsConfig() {
    return {
      preset: this._graphicsPreset,
      graphicsPreset: this._graphicsPreset,
      dprCap: this.resScaler.presetCap,
      currentDpr: this.resScaler.currentDpr,
      dynamicResAuto: this.resScaler.dynamicResAuto,
      particleScale: this._particleScaleOverride !== null ? this._particleScaleOverride : this.gpuGovernor.particleScale,
      shadowsEnabled: this._shadowsEnabled,
    };
  }

  _setupItemStudioLighting() {
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1e293b, 1.45);
    const key = new THREE.DirectionalLight(0xffffff, 2.95);
    key.position.set(3.2, 4.5, 4.0);
    const fill = new THREE.DirectionalLight(0x38bdf8, 1.35);
    fill.position.set(-3.5, 1.8, 2.2);
    const rim = new THREE.DirectionalLight(0xfbbf24, 1.65);
    rim.position.set(0.5, -2.2, -3.5);
    this.itemScene.add(hemi, key, fill, rim);
  }

  _ensureSharedRenderer() {
    if (this.sharedRenderer) return this.sharedRenderer;
    const r = this.createRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    r.setPixelRatio(1);
    r.setSize(220, 180, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.16;
    if (r.shadowMap) {
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
    }

    const el = r.domElement;
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('webglcontextlost', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        this._contextLost = true;
      });
      el.addEventListener('webglcontextrestored', () => {
        this._contextLost = false;
        for (const rec of this.itemSlots.values()) rec.dirty = true;
      });
    }

    if (typeof THREE.PMREMGenerator === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(r);
        const envScene = new RoomEnvironment();
        const rt = pmrem.fromScene(envScene, 0.04);
        this.sharedEnvTexture = rt.texture;
        this.itemScene.environment = this.sharedEnvTexture;
        this.itemScene.environmentIntensity = 0.88;
        if (typeof envScene.dispose === 'function') envScene.dispose();
        pmrem.dispose();
      } catch (_) { /* headless safe */ }
    }

    this.sharedRenderer = r;
    this._webglContextCount = 1;
    return r;
  }

  _applyIBL(targetScene) {
    this._ensureSharedRenderer();
    if (this.sharedEnvTexture) {
      targetScene.environment = this.sharedEnvTexture;
      targetScene.environmentIntensity = 0.85;
    }
  }

  _setRendererSize(renderer, w, h) {
    const dom = renderer.domElement;
    if (!dom || dom.width !== w || dom.height !== h) {
      renderer.setSize(w, h, false);
    }
  }

  _bindStageCanvasEvents(canvasEl, stageRec) {
    if (!canvasEl || typeof canvasEl.addEventListener !== 'function' || canvasEl.__z3dStageBound) return;
    canvasEl.__z3dStageBound = true;
    let downX = 0;
    let downY = 0;

    const toNdc = (ev) => {
      const rect = canvasEl.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      return {
        x: ((ev.clientX - rect.left) / w) * 2 - 1,
        y: -((ev.clientY - rect.top) / h) * 2 + 1,
      };
    };

    canvasEl.addEventListener('pointerdown', (ev) => {
      downX = ev.clientX;
      downY = ev.clientY;
    });

    canvasEl.addEventListener('pointermove', (ev) => {
      const ndc = toNdc(ev);
      this.world.queuePointerRaycast({
        type: 'hover',
        ndcX: ndc.x,
        ndcY: ndc.y,
        camera: stageRec.built.camera,
        pickableEids: stageRec.built.pickableEids,
        onResult: (hitEid) => {
          canvasEl.style.cursor = hitEid >= 0 ? 'pointer' : 'grab';
        },
      });
    });

    canvasEl.addEventListener('pointerup', (ev) => {
      const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (dist > 7) return;
      const ndc = toNdc(ev);
      this.world.queuePointerRaycast({
        type: 'click',
        ndcX: ndc.x,
        ndcY: ndc.y,
        camera: stageRec.built.camera,
        pickableEids: stageRec.built.pickableEids,
        onResult: (hitEid, meta) => {
          if (hitEid >= 0 && meta) {
            stageRec.built.triggerAction('click', meta);
            this._dispatchStageClick(stageRec.el, meta);
          } else if (stageRec.kind === 'casino-royale') {
            const sm = (stageRec.built.camera.userData && stageRec.built.camera.userData.z3dSubmode) || 'roulette';
            this._dispatchStageClick(stageRec.el, { stage: 'casino-royale', target: sm, submode: sm });
          }
        },
      });
    });
  }

  _dispatchStageClick(stageEl, detail) {
    if (typeof CustomEvent !== 'function') return;
    const ev = new CustomEvent('zone:3d-stage-click', { bubbles: true, detail });
    if (stageEl && typeof stageEl.dispatchEvent === 'function' && stageEl.isConnected) {
      stageEl.dispatchEvent(ev);
    } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(ev);
    }
  }

  mountItemSlot(slotEl) {
    if (!slotEl) return null;
    const itemId = slotEl.getAttribute('data-z3d-item') || 'weapon_cache';
    const category = slotEl.getAttribute('data-z3d-cat') || '';
    const rarity = slotEl.getAttribute('data-z3d-rarity') || 'rare';

    const existing = this.itemSlots.get(slotEl);
    if (existing && existing.itemId === itemId && existing.category === category) {
      return existing;
    }
    if (existing) {
      this.world.despawnImmediate(existing.eid);
      this.itemSlots.delete(slotEl);
    }

    let canvas2d = slotEl.querySelector ? slotEl.querySelector('canvas.z3d-item-canvas') : null;
    if (!canvas2d && typeof document !== 'undefined') {
      canvas2d = document.createElement('canvas');
      canvas2d.className = 'z3d-item-canvas';
      canvas2d.width = 220;
      canvas2d.height = 180;
      slotEl.appendChild(canvas2d);
    }

    const mesh = createItemMesh3D(itemId, category, rarity);
    const eid = this.world.spawnImmediate(mesh);
    this.world.setTurntable(eid, 0.88, 6.5);
    this.world.setHoverFloat(eid, 0, 0.045, 1.15, (eid % 11) * 0.55);

    const rec = {
      el: slotEl,
      canvas2d,
      ctx2d: canvas2d && typeof canvas2d.getContext === 'function' ? canvas2d.getContext('2d') : null,
      itemId,
      category,
      rarity,
      mesh,
      eid,
      hovered: false,
      dragging: false,
      dirty: true,
      renderedFrames: 0,
    };

    if (canvas2d && !canvas2d.__z3dBound) {
      canvas2d.__z3dBound = true;
      let lastX = 0;
      let lastY = 0;
      canvas2d.addEventListener('pointerenter', () => { rec.hovered = true; });
      canvas2d.addEventListener('pointerleave', () => { rec.hovered = false; rec.dragging = false; });
      canvas2d.addEventListener('pointerdown', (e) => {
        rec.dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        if (canvas2d.setPointerCapture) {
          try { canvas2d.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
      });
      canvas2d.addEventListener('pointermove', (e) => {
        if (!rec.dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (this.world.isAlive(rec.eid)) {
          this.world.stores.TurntableSpin[rec.eid * 4 + 1] += dx * 0.022;
          this.world.stores.TurntableSpin[rec.eid * 4 + 2] += dy * 0.014;
          rec.dirty = true;
        }
      });
      canvas2d.addEventListener('pointerup', () => { rec.dragging = false; });
      canvas2d.addEventListener('dblclick', () => {
        this.inspectItem(rec.itemId, { category: rec.category, rarity: rec.rarity });
      });
    }

    this.itemSlots.set(slotEl, rec);
    this._blitSingleItemSlot(rec);
    return rec;
  }

  mountStage(stageEl) {
    if (!stageEl) return null;
    const kind = stageEl.getAttribute('data-z3d-stage') || 'safehouse-empire';
    const era = stageEl.getAttribute('data-z3d-era') || '1';
    const originChosen = stageEl.getAttribute('data-z3d-origin-chosen') ?? '1';
    const origin = stageEl.getAttribute('data-z3d-origin') || '';
    const outfit = stageEl.getAttribute('data-z3d-outfit') || 'street';
    const submode = stageEl.getAttribute('data-z3d-submode') || '';
    const companionId = stageEl.getAttribute('data-z3d-companion') || '';

    const existing = this.stageInstances.get(stageEl);
    if (existing && existing.kind === kind) {
      existing.built.updateState({ era, originChosen, origin, outfit, submode: submode || undefined, companionId: companionId || undefined });
      if (existing.controls && existing.built.camera.userData && existing.built.camera.userData.z3dLookTarget) {
        const lt = existing.built.camera.userData.z3dLookTarget;
        existing.controls.target.set(lt.x, lt.y, lt.z);
      }
      return existing;
    }
    if (existing) {
      if (existing.controls) existing.controls.dispose();
      existing.built.dispose();
      this.stageInstances.delete(stageEl);
    }

    this._ensureSharedRenderer();
    const built = buildStageScene3D(kind, this.world, { era, originChosen, origin, outfit, submode: submode || 'full', companionId: companionId || undefined });
    this._applyIBL(built.scene);

    let stageCanvas = stageEl.querySelector ? stageEl.querySelector('canvas.z3d-stage-webgl-canvas') : null;
    if (!stageCanvas && typeof document !== 'undefined' && stageEl.insertBefore) {
      stageCanvas = document.createElement('canvas');
      stageCanvas.className = 'z3d-stage-webgl-canvas';
      stageCanvas.width = 560;
      stageCanvas.height = 240;
      stageEl.insertBefore(stageCanvas, stageEl.firstChild || null);
    }

    if (typeof document !== 'undefined' && stageEl.querySelector && !stageEl.querySelector('.z3d-stage-hud')) {
      const hud = document.createElement('div');
      hud.className = 'z3d-stage-hud';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'z3d-stage-chip';
      labelSpan.textContent = '';
      hud.appendChild(labelSpan);
      stageEl.appendChild(hud);
    }

    let controls = null;
    if (stageCanvas && typeof stageCanvas.addEventListener === 'function' && typeof document !== 'undefined') {
      try {
        controls = new OrbitControls(built.camera, stageCanvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.065;
        controls.enablePan = false;
        controls.minDistance = kind === 'character-turntable' ? 1.8 : (kind === 'casino-royale' ? 1.15 : 2.4);
        controls.maxDistance = 9.5;
        controls.minPolarAngle = 0.25;
        controls.maxPolarAngle = Math.PI * 0.48;
        if (built.camera.userData && built.camera.userData.z3dLookTarget) {
          const lt = built.camera.userData.z3dLookTarget;
          controls.target.set(lt.x, lt.y, lt.z);
        } else {
          controls.target.set(0, kind === 'character-turntable' ? 0.92 : 0.82, 0);
        }
        built.camera.userData.z3dOrbitActive = true;
      } catch (_) {
        controls = null;
      }
    }

    const rec = {
      el: stageEl,
      kind,
      built,
      canvas: stageCanvas,
      ctx2d: stageCanvas && typeof stageCanvas.getContext === 'function' ? stageCanvas.getContext('2d') : null,
      controls,
    };
    if (stageCanvas) {
      this._bindStageCanvasEvents(stageCanvas, rec);
    }
    this.stageInstances.set(stageEl, rec);
    this._blitStageRecord(rec, 0.016);
    return rec;
  }

  _isElementLaidOut(el) {
    if (!el || el.isConnected === false) return false;
    if (typeof el.getBoundingClientRect !== 'function') return true;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  _isElementVisible(el) {
    if (!this._isElementLaidOut(el)) return false;
    if (typeof el.getBoundingClientRect !== 'function') return true;
    const r = el.getBoundingClientRect();
    if (typeof window !== 'undefined') {
      if (r.bottom < -100 || r.top > (window.innerHeight || 900) + 100) return false;
    }
    return true;
  }

  _blitSingleItemSlot(rec) {
    if (!rec || !rec.ctx2d) return;
    const renderer = this._ensureSharedRenderer();
    const prevBg = this.itemScene.background;
    this.itemScene.background = null;
    if (typeof renderer.setClearColor === 'function') renderer.setClearColor(0x000000, 0);
    this._setRendererSize(renderer, 220, 180);
    this.itemScene.add(rec.mesh);
    renderer.render(this.itemScene, this.itemCamera);
    const calls = renderer.info ? Math.max(1, renderer.info.render.calls) : 1;
    const tris = renderer.info ? renderer.info.render.triangles : 0;
    this._drawCalls = Math.max(this._drawCalls, calls);
    this._triangles = Math.max(this._triangles, tris);
    this.itemScene.remove(rec.mesh);
    this.itemScene.background = prevBg;
    try {
      rec.ctx2d.clearRect(0, 0, rec.canvas2d.width, rec.canvas2d.height);
      rec.ctx2d.drawImage(renderer.domElement, 0, 0, rec.canvas2d.width, rec.canvas2d.height);
      rec.dirty = false;
      rec.renderedFrames++;
    } catch (_) { /* ignore */ }
  }

  _blitStageRecord(stageRec, realDt) {
    if (!stageRec) return { calls: 0, tris: 0 };
    const renderer = this._ensureSharedRenderer();
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = this._shadowsEnabled;
    }
    let w = 560;
    let h = 235;
    if (typeof stageRec.el.getBoundingClientRect === 'function') {
      const rect = stageRec.el.getBoundingClientRect();
      const dpr = this.resScaler ? this.resScaler.currentDpr : this.gpuGovernor.maxPixelRatio;
      w = Math.max(120, Math.min(1440, Math.floor((rect.width || 560) * dpr)));
      h = Math.max(90, Math.min(960, Math.floor((rect.height || 235) * dpr)));
    }
    if (stageRec.canvas && (stageRec.canvas.width !== w || stageRec.canvas.height !== h)) {
      stageRec.canvas.width = w;
      stageRec.canvas.height = h;
    }
    stageRec.built.camera.aspect = w / Math.max(1, h);
    stageRec.built.camera.updateProjectionMatrix();
    if (stageRec.controls) stageRec.controls.update(realDt);

    this._setRendererSize(renderer, w, h);
    renderer.render(stageRec.built.scene, stageRec.built.camera);
    if (stageRec.ctx2d && stageRec.canvas) {
      try {
        stageRec.ctx2d.drawImage(renderer.domElement, 0, 0, stageRec.canvas.width, stageRec.canvas.height);
      } catch (_) { /* ignore */ }
    }
    const rawCalls = renderer.info ? Math.max(1, renderer.info.render.calls) : 1;
    const budgetEval = this.gpuGovernor.evaluateDrawCalls(rawCalls, stageRec.built);
    return {
      calls: budgetEval.cappedDrawCalls,
      tris: renderer.info ? renderer.info.render.triangles : 0,
    };
  }

  _renderFrame(_scaledDt, realDt) {
    this._ensureSettingsListener();
    if (this.resScaler && typeof realDt === 'number' && realDt > 0) {
      this.resScaler.sampleFrame(realDt * 1000);
    }

    let frameDrawCalls = 0;
    let frameTriangles = 0;

    const slotsArr = this._slotsScratch;
    slotsArr.length = 0;
    for (const [el, rec] of this.itemSlots.entries()) {
      if (el.isConnected === false) {
        this.world.despawnImmediate(rec.eid);
        this.itemSlots.delete(el);
        continue;
      }
      slotsArr.push(rec);
    }

    let blitsThisFrame = 0;
    const presetBlits = GRAPHICS_PRESETS[this._graphicsPreset]
      ? GRAPHICS_PRESETS[this._graphicsPreset].maxItemBlitsPerFrame
      : this.gpuGovernor.maxItemBlitsPerFrame;
    const MAX_ITEM_BLITS_PER_FRAME = Math.min(this.gpuGovernor.maxItemBlitsPerFrame, presetBlits);

    for (let i = 0; i < slotsArr.length; i++) {
      const rec = slotsArr[i];
      if (rec.dirty || rec.dragging || rec.hovered) {
        this._blitSingleItemSlot(rec);
        frameDrawCalls += this.sharedRenderer && this.sharedRenderer.info ? Math.max(1, this.sharedRenderer.info.render.calls) : 1;
        frameTriangles += this.sharedRenderer && this.sharedRenderer.info ? this.sharedRenderer.info.render.triangles : 0;
        blitsThisFrame++;
      }
    }

    if (slotsArr.length > 0 && blitsThisFrame < MAX_ITEM_BLITS_PER_FRAME) {
      for (let step = 0; step < slotsArr.length && blitsThisFrame < MAX_ITEM_BLITS_PER_FRAME; step++) {
        const idx = (this._roundRobinCursor + step) % slotsArr.length;
        const rec = slotsArr[idx];
        if (!rec.dirty && !rec.dragging && !rec.hovered && this._isElementVisible(rec.el)) {
          this._blitSingleItemSlot(rec);
          frameDrawCalls += this.sharedRenderer && this.sharedRenderer.info ? Math.max(1, this.sharedRenderer.info.render.calls) : 1;
          frameTriangles += this.sharedRenderer && this.sharedRenderer.info ? this.sharedRenderer.info.render.triangles : 0;
          blitsThisFrame++;
        }
      }
      this._roundRobinCursor = (this._roundRobinCursor + MAX_ITEM_BLITS_PER_FRAME) % Math.max(1, slotsArr.length);
    }

    // Render ALL visible/laid-out stages via the single shared offscreen WebGLRenderer
    for (const [el, sRec] of this.stageInstances.entries()) {
      if (el.isConnected === false) {
        if (sRec.controls) sRec.controls.dispose();
        sRec.built.dispose();
        this.stageInstances.delete(el);
        continue;
      }
      if (!this._isElementVisible(el)) continue;
      const st = this._blitStageRecord(sRec, realDt);
      frameDrawCalls += st.calls;
      frameTriangles += st.tris;
    }

    // Render 3D Orbit Studio Inspector Modal via the SAME single shared offscreen WebGLRenderer!
    if (this.inspectorOpen && this.inspectorCanvas && this.inspectorScene && this.inspectorCamera) {
      const renderer = this._ensureSharedRenderer();
      if (this.inspectorControls) this.inspectorControls.update(realDt);
      const iw = this.inspectorCanvas.width || 520;
      const ih = this.inspectorCanvas.height || 340;
      this.inspectorCamera.aspect = iw / Math.max(1, ih);
      this.inspectorCamera.updateProjectionMatrix();
      this._setRendererSize(renderer, iw, ih);
      renderer.render(this.inspectorScene, this.inspectorCamera);
      if (this.inspectorCtx) {
        try {
          this.inspectorCtx.drawImage(renderer.domElement, 0, 0, iw, ih);
        } catch (_) { /* ignore */ }
      }
      if (renderer.info) {
        frameDrawCalls += Math.max(1, renderer.info.render.calls);
        frameTriangles += renderer.info.render.triangles;
      }
    }

    if (frameDrawCalls > 0) {
      this._drawCalls = frameDrawCalls;
      this._triangles = frameTriangles;
    }
  }

  scan(root = undefined) {
    this._ensureSettingsListener();
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
    let count = 0;

    const slots = scope.querySelectorAll('.z3d-item-slot[data-z3d-item], [data-z3d-item]');
    for (let i = 0; i < slots.length; i++) {
      const el = slots[i];
      if (el.tagName === 'BUTTON' && el.hasAttribute('data-z3d-inspect')) continue;
      this.mountItemSlot(el);
      count++;
    }

    const stages = scope.querySelectorAll('[data-z3d-stage]');
    for (let i = 0; i < stages.length; i++) {
      this.mountStage(stages[i]);
      count++;
    }

    if (!this._running && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.startLoop();
    }
    return count;
  }

  triggerStageAction(stageKind, actionName = 'pulse', payload = {}) {
    let triggered = 0;
    for (const rec of this.stageInstances.values()) {
      if (!stageKind || rec.kind === stageKind) {
        rec.built.triggerAction(actionName, payload);
        triggered++;
      }
    }
    return triggered > 0;
  }

  updateStageState(stageKind, stateObj = {}) {
    let updated = 0;
    for (const rec of this.stageInstances.values()) {
      if (!stageKind || rec.kind === stageKind) {
        rec.built.updateState(stateObj);
        updated++;
      }
    }
    return updated > 0;
  }

  inspectItem(itemId, opts = {}) {
    if (typeof document === 'undefined' || !document.body) return false;
    const isAr = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';

    if (!this.inspectorModalEl) {
      const modal = document.createElement('div');
      modal.className = 'z3d-inspector-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = [
        '<div class="z3d-inspector-backdrop" data-z3d-modal-close="1"></div>',
        '<div class="z3d-inspector-card">',
        '  <header class="z3d-inspector-head">',
        '    <div>',
        '      <span class="z3d-inspector-eyebrow"></span>',
        '      <h3 class="z3d-inspector-title"></h3>',
        '    </div>',
        '    <button type="button" class="z3d-inspector-close" data-z3d-modal-close="1" aria-label="Close">✕</button>',
        '  </header>',
        '  <div class="z3d-inspector-viewport"></div>',
        '  <footer class="z3d-inspector-foot">',
        '    <span class="z3d-inspector-hint"></span>',
        '    <div class="z3d-inspector-actions">',
        '      <button type="button" class="z3d-inspector-btn" data-z3d-modal-spin="1"></button>',
        '      <button type="button" class="z3d-inspector-btn" data-z3d-modal-pulse="1"></button>',
        '    </div>',
        '  </footer>',
        '</div>',
      ].join('');
      document.body.appendChild(modal);

      modal.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('[data-z3d-modal-close]')) {
          this.closeInspector();
        } else if (t.closest('[data-z3d-modal-spin]')) {
          if (this.inspectorControls) this.inspectorControls.autoRotate = !this.inspectorControls.autoRotate;
        } else if (t.closest('[data-z3d-modal-pulse]')) {
          if (this.inspectorItemEid >= 0) {
            this.world.setStageKinematics(this.inspectorItemEid, ANIM_LUNGE, 0.36, 0, 0.25);
          }
        }
      });

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && this.inspectorOpen) this.closeInspector();
        });
      }
      this.inspectorModalEl = modal;
    }

    const spec = resolveItemSpec3D(itemId, opts.category || '', opts.rarity || 'legendary');
    this.inspectorModalEl.querySelector('.z3d-inspector-eyebrow').textContent =
      isAr ? `معاينة ثلاثية الأبعاد · ${spec.category.toUpperCase()}` : `3D ORBIT STUDIO · ${spec.category.toUpperCase()}`;
    this.inspectorModalEl.querySelector('.z3d-inspector-title').textContent =
      opts.title || String(itemId || spec.id).replace(/_/g, ' ').toUpperCase();
    this.inspectorModalEl.querySelector('.z3d-inspector-hint').textContent =
      isAr ? 'اسحب للدوران ٣٦٠° · مرر للتكبير' : 'Drag 360° to orbit · Scroll/pinch to zoom';
    this.inspectorModalEl.querySelector('[data-z3d-modal-spin]').textContent =
      isAr ? 'دوران تلقائي' : 'Auto-Spin';
    this.inspectorModalEl.querySelector('[data-z3d-modal-pulse]').textContent =
      isAr ? 'نبضة فحص' : 'Recoil Pulse';

    this._ensureSharedRenderer();
    const vp = this.inspectorModalEl.querySelector('.z3d-inspector-viewport');
    if (!this.inspectorCanvas) {
      const c = document.createElement('canvas');
      c.className = 'z3d-inspector-canvas';
      c.width = 560;
      c.height = 340;
      vp.innerHTML = '';
      vp.appendChild(c);
      this.inspectorCanvas = c;
      this.inspectorCtx = typeof c.getContext === 'function' ? c.getContext('2d') : null;
    }

    if (this.inspectorItemEid >= 0) {
      this.world.despawnImmediate(this.inspectorItemEid);
      this.inspectorItemEid = -1;
    }

    // Dedicated close-up 3D Orbit Studio scene with compact 0.78-radius glowing Syndicate pedestal ring!
    this.inspectorScene = new THREE.Scene();
    this.inspectorScene.background = new THREE.Color(0x14120f);
    this._applyIBL(this.inspectorScene);

    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1c1917, 1.45);
    const key = new THREE.DirectionalLight(0xffffff, 3.15);
    key.position.set(2.8, 3.8, 3.2);
    const fill = new THREE.DirectionalLight(0x38bdf8, 1.45);
    fill.position.set(-2.8, 1.5, 2.0);
    const rim = new THREE.DirectionalLight(spec.rimColor, 1.85);
    rim.position.set(0.0, 1.8, -2.8);
    this.inspectorScene.add(hemi, key, fill, rim);

    const plinthDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.80, 0.06, 40),
      makePbr(0x1e1b18, 0.35, 0.78, false)
    );
    plinthDisc.position.y = -0.18;
    const pedRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.024, 12, 48),
      makePbr(spec.rimColor, 0.18, 0.92, false, { emissive: spec.rimColor, emissiveIntensity: 0.72 })
    );
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.y = -0.15;
    this.inspectorScene.add(plinthDisc, pedRing);

    this.inspectorCamera = new THREE.PerspectiveCamera(40, 560 / 340, 0.1, 30);
    const camZ = (spec.category === 'casino' || spec.category === 'vehicle') ? 2.28 : 1.98;
    const camY = spec.category === 'casino' ? 0.92 : 0.74;
    this.inspectorCamera.position.set(0, camY, camZ);
    this.inspectorCamera.lookAt(0, 0.38, 0);

    const mesh = createItemMesh3D(itemId, opts.category || spec.category, opts.rarity || 'legendary', { withPedestalRing: false });
    mesh.position.set(0, 0.38, 0);
    this.inspectorScene.add(mesh);
    this.inspectorItemEid = this.world.spawnImmediate(mesh);

    if (this.inspectorControls) this.inspectorControls.dispose();
    try {
      this.inspectorControls = new OrbitControls(this.inspectorCamera, this.inspectorCanvas);
      this.inspectorControls.enableDamping = true;
      this.inspectorControls.autoRotate = true;
      this.inspectorControls.autoRotateSpeed = 1.8;
      this.inspectorControls.minDistance = 1.15;
      this.inspectorControls.maxDistance = 4.5;
      this.inspectorControls.target.set(0, 0.38, 0);
    } catch (_) {
      this.inspectorControls = null;
    }

    this.inspectorModalEl.classList.add('is-open');
    this.inspectorOpen = true;
    this._renderFrame(0.016, 0.016);
    return true;
  }

  closeInspector() {
    this.inspectorOpen = false;
    if (this.inspectorModalEl) {
      this.inspectorModalEl.classList.remove('is-open');
    }
    if (this.inspectorControls) {
      this.inspectorControls.dispose();
      this.inspectorControls = null;
    }
    if (this.inspectorItemEid >= 0) {
      this.world.despawnImmediate(this.inspectorItemEid);
      this.inspectorItemEid = -1;
    }
  }

  startLoop() {
    if (this._running || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      this.world.step();
      this._rafId = window.requestAnimationFrame(tick);
    };
    this._rafId = window.requestAnimationFrame(tick);
  }

  stopLoop() {
    this._running = false;
    if (this._rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  triggerScreenFx(kind = 'crit-flash', opts = {}) {
    return triggerScreenFx(kind, opts);
  }

  diagnostics() {
    let vfxActiveParticles = 0;
    for (const ctrl of this.world.stageVfxControllers) {
      if (ctrl && ctrl.pool) vfxActiveParticles += ctrl.pool.activeCount;
    }
    const effectiveParticleScale = this._particleScaleOverride !== null
      ? this._particleScaleOverride
      : this.gpuGovernor.particleScale;
    return {
      ready: true,
      ecsEntities: this.world.aliveCount,
      activeStages: this.stageInstances.size,
      renderedItems: this.itemSlots.size,
      webglContexts: this._webglContextCount,
      drawCalls: this._drawCalls,
      triangles: this._triangles,
      contextLost: this._contextLost,
      vfxActiveParticles,
      particleScale: effectiveParticleScale,
      maxStageDrawCalls: this.gpuGovernor.maxStageDrawCalls,
      fps: this.resScaler.fps,
      onePercentLowFps: this.resScaler.onePercentLowFps,
      frameTimeVarianceMs: this.resScaler.frameTimeVarianceMs,
      recommendedFpsCap: this.resScaler.recommendedFpsCap,
      frameMsEma: Number(this.resScaler.frameMsEma.toFixed(2)),
      currentDpr: this.resScaler.currentDpr,
      dprCap: this.resScaler.presetCap,
      graphicsPreset: this._graphicsPreset,
      dynamicResAuto: this.resScaler.dynamicResAuto,
      shadowsEnabled: this._shadowsEnabled,
    };
  }
}

export function createZoneEcs3DRuntime(opts = {}) {
  return new ZoneEcs3DRuntime(opts);
}

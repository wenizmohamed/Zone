/* ==========================================================================
 * ZONE v152 - TRUE DATA-ORIENTED 3D ECS & SHARED WEBGL ENGINE
 * Exclusive Ownership: @ecs-3d-engine (assets/ui/zone-ecs-3d-engine.mjs)
 * Local Vendored Three.js r184 ONLY - ZERO External CDN
 * ========================================================================== */

import * as THREE from '../../lib/three184/three.module.js';
import { OrbitControls } from '../../lib/three184/OrbitControls.js';
import { RoomEnvironment } from '../../lib/three184/RoomEnvironment.js';
import { OBJLoader } from '../../lib/three184/OBJLoader.js';
import { MTLLoader } from '../../lib/three184/MTLLoader.js';
import { GLTFLoader } from '../../lib/three184/GLTFLoader.js';

export {
  THREE,
  OrbitControls,
  RoomEnvironment,
  OBJLoader,
  MTLLoader,
  GLTFLoader,
};

export const MAX_ENTITIES = 512;

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
});

export const SYSTEM_ORDER = Object.freeze([
  'InputRaycastSystem',
  'TurntableKinematicsSystem',
  'StageActionKinematicsSystem',
  'TraumaCameraSystem',
  'FresnelShaderSystem',
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
]);

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
    return 'z3d-fresnel-rim-v152';
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
 *    Queues structural ECS operations during system execution and replays
 *    them atomically at sync points so contiguous queries never tear.
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

    // Contiguous TypedArray Component Stores
    this.stores = {
      alive: new Uint8Array(MAX_ENTITIES),
      mask: new Uint32Array(MAX_ENTITIES),
      generation: new Uint32Array(MAX_ENTITIES),
      // Transform3D: [px, py, pz, rx, ry, rz, sx, sy, sz, dirty] (stride 10)
      Transform3D: new Float32Array(MAX_ENTITIES * 10),
      // Velocity3D: [vx, vy, vz, avx, avy, avz] (stride 6)
      Velocity3D: new Float32Array(MAX_ENTITIES * 6),
      // TurntableSpin: [speedY, dragYaw, dragPitch, damping] (stride 4)
      TurntableSpin: new Float32Array(MAX_ENTITIES * 4),
      // HoverFloat: [baseY, amplitude, frequency, phase] (stride 4)
      HoverFloat: new Float32Array(MAX_ENTITIES * 4),
      // TraumaShake: [trauma, decay, maxOffX, maxOffY, maxRoll, timeAcc, strength, hasBase] (stride 8)
      TraumaShake: new Float32Array(MAX_ENTITIES * 8),
      // CameraBasePose: [bx, by, bz, tx, ty, tz] (stride 6)
      CameraBasePose: new Float32Array(MAX_ENTITIES * 6),
      // HitStopState: [remainingRealSec, slowScale, activeFlag, reserved] (stride 4) + monotonic IDs
      HitStopState: new Float32Array(MAX_ENTITIES * 4),
      HitStopIds: new Uint32Array(MAX_ENTITIES),
      // FresnelRim: [r, g, b, power, baseIntensity, pulseHz] (stride 6)
      FresnelRim: new Float32Array(MAX_ENTITIES * 6),
      // InteractivePickable: [layerMask, hovered, clickCount, metaId] (stride 4)
      InteractivePickable: new Uint32Array(MAX_ENTITIES * 4),
      // StageActionKinematics: [kind, timer, duration, origX, origY, origZ, paramA, paramB] (stride 8)
      StageActionKinematics: new Float32Array(MAX_ENTITIES * 8),
    };

    // Object3D & metadata side-tables indexed by eid (kept out of hot float math)
    this.object3d = new Array(MAX_ENTITIES).fill(null);
    this.rimMaterials = new Array(MAX_ENTITIES).fill(null);
    this.pickMeta = new Map();

    // Global overlapping-safe Hit-Stop resource (mirrors onto entity 0 or active hit-stop entity)
    this._hitStopSeq = 0;
    this._activeHitStopId = 0;
    this._hitStopRemainingReal = 0;
    this._hitStopSlowScale = 1.0;

    // Input raycast queue & render hook
    this._pendingPointerEvents = [];
    this._renderHook = typeof opts.renderHook === 'function' ? opts.renderHook : null;
    this.lastSystemOrder = [];

    // THREE.Timer (r183+ replacement for deprecated Clock)
    this.timer = typeof THREE.Timer === 'function' ? new THREE.Timer() : null;
    this._lastPerfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.timer && typeof document !== 'undefined' && typeof this.timer.connect === 'function') {
      try {
        this.timer.connect(document);
      } catch (_) {
        // Headless / mock document safe ignore
      }
    }

    this.schedule = [
      { name: 'InputRaycastSystem', fn: (dt, rdt) => this._sysInputRaycast(dt, rdt) },
      { name: 'TurntableKinematicsSystem', fn: (dt, rdt) => this._sysTurntableKinematics(dt, rdt) },
      { name: 'StageActionKinematicsSystem', fn: (dt, rdt) => this._sysStageActionKinematics(dt, rdt) },
      { name: 'TraumaCameraSystem', fn: (dt, rdt) => this._sysTraumaCamera(dt, rdt) },
      { name: 'FresnelShaderSystem', fn: (dt, rdt) => this._sysFresnelShader(dt, rdt) },
      { name: 'SharedWebGLRenderSystem', fn: (dt, rdt) => this._sysSharedWebGLRender(dt, rdt) },
    ];
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
    if (object3d) {
      object3d.userData = object3d.userData || {};
      object3d.userData.z3dEid = eid;
      const mats = [];
      object3d.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (let i = 0; i < list.length; i++) {
          if (list[i] && list[i].userData && list[i].userData.z3dRimUniforms) {
            mats.push(list[i]);
          }
        }
      });
      this.rimMaterials[eid] = mats.length ? mats : null;
    } else {
      this.rimMaterials[eid] = null;
    }
    return eid;
  }

  despawnImmediate(eid) {
    if (eid < 0 || eid >= MAX_ENTITIES || this.stores.alive[eid] === 0) return false;
    this.stores.alive[eid] = 0;
    this.stores.mask[eid] = 0;
    this.stores.generation[eid]++;
    this.object3d[eid] = null;
    this.rimMaterials[eid] = null;
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

  /**
   * Overlapping-safe real-time Hit-Stop (`game-feel` Pattern 2).
   * Increments monotonic `hitStopId`; countdown runs in real unscaled seconds
   * so timeScale=0 or 0.05 never soft-locks, and an earlier short hit-stop
   * never prematurely cancels a newer overlapping hit-stop.
   */
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
    // Preserve rest origin if first time setting kinematics
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

    // Advance real-time Hit-Stop before scaling gameplay delta
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

  /* --- System 1: InputRaycastSystem --- */
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

  /* --- System 2: TurntableKinematicsSystem --- */
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
        // Item cards use realDt so dragged cards stay responsive even during stage hit-stop
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

  /* --- System 3: StageActionKinematicsSystem --- */
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
        // Eased punch out & spring back to exact rest pose
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
        // Continuous or decelerating prize wheel spin around Z
        const speed = pB > 0 ? pA * Math.max(0.15, 1 - u * 0.85) : pA;
        T[tOff + 5] += speed * scaledDt;
        if (pB > 0 && u >= 1.0) {
          K[kOff + 6] = 0.85;
          K[kOff + 7] = 0;
          K[kOff + 1] = 0;
        }
      } else if (kind === ANIM_DRIFT_ORBIT) {
        // Continuous street drift car around oval circuit (pA = speed, pB = phase)
        const ang = this.scaledElapsed * pA + pB;
        const rx = ox || 2.15;
        const rz = oz || 1.25;
        T[tOff + 0] = Math.cos(ang) * rx;
        T[tOff + 1] = oy;
        T[tOff + 2] = Math.sin(ang) * rz;
        T[tOff + 4] = -ang + Math.PI * 0.5 + 0.18;
      } else if (kind === ANIM_ROULETTE_BALL) {
        const speed = pA * Math.max(0.25, 1 - u * 0.72);
        K[kOff + 7] += speed * scaledDt;
        const ang = K[kOff + 7];
        const radius = 0.74 - 0.16 * Math.min(1, u);
        const hop = u < 0.85 ? Math.abs(Math.sin(ang * 3.5)) * 0.06 * (1 - u) : 0;
        T[tOff + 0] = ox + Math.cos(ang) * radius;
        T[tOff + 1] = oy + hop;
        T[tOff + 2] = oz + Math.sin(ang) * radius;
      } else if (kind === ANIM_SLOT_REEL) {
        const speed = pB > 0 ? pA * (1 - u * 0.9) : pA;
        T[tOff + 3] += speed * scaledDt;
        if (pB > 0 && u >= 1.0) {
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

  /* --- System 4: TraumaCameraSystem (Squirrel Eiserloh trauma^2 + realDt decay) --- */
  _sysTraumaCamera(_scaledDt, realDt) {
    const alive = this.stores.alive;
    const mask = this.stores.mask;
    const TS = this.stores.TraumaShake;
    const CB = this.stores.CameraBasePose;
    const T = this.stores.Transform3D;

    for (let eid = 0; eid < this.nextId; eid++) {
      if (!alive[eid] || (mask[eid] & COMPONENTS.TRAUMA_SHAKE) === 0) continue;
      const o = eid * 8;
      let trauma = TS[o + 0];
      if (trauma <= 0) continue;

      const decay = Math.max(0, TS[o + 1]);
      trauma = Math.max(0, trauma - decay * realDt);
      TS[o + 0] = trauma;

      const strength = TS[o + 6] * this.shakeStrength;
      const shake = trauma * trauma * strength;
      TS[o + 5] += realDt * 30.0;
      const t = TS[o + 5];

      // Summed irrational-rate sines: smooth punch, never random per-frame buzz
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
          // Apply shake offset purely additively around current orbit offset and restore next frame
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

  /* --- System 5: FresnelShaderSystem --- */
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

  /* --- System 6: SharedWebGLRenderSystem --- */
  _sysSharedWebGLRender(scaledDt, realDt) {
    if (typeof this._renderHook === 'function') {
      this._renderHook(scaledDt, realDt, this);
    }
  }
}

/* --------------------------------------------------------------------------
 * 4. 100% 3D ITEM MESH FACTORY & REAL WEAPON ASSET MAPPER
 *    Every item category in ZONE gets a bespoke multi-part PBR + Fresnel 3D
 *    model immediately on frame 0, plus cached async GLB/OBJ+MTL upgrades!
 * -------------------------------------------------------------------------- */
export const WEAPON_ASSET_MAP = Object.freeze({
  // High-detail GLB upgrades
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
  // Melee real GLBs
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
  const rawId = String(itemId || 'weapon_cache').trim().toLowerCase().replace(/\s+/g, '_');
  const rawCat = String(category || '').trim().toLowerCase();
  const rimColor = RARITY_RIM_COLORS[String(rarity || 'rare').toLowerCase()] || 0x7dd3fc;

  if (Object.hasOwn(WEAPON_ASSET_MAP, rawId)) {
    const entry = WEAPON_ASSET_MAP[rawId];
    const isMelee = ['knife', 'bat', 'katana', 'hammer', 'knuckles'].includes(entry.family);
    return { id: rawId, category: isMelee ? 'melee' : 'weapon', subtype: entry.family, asset: entry, rimColor };
  }

  // Melee
  if (rawCat === 'melee' || /(knife|razor|dagger|blade|katana|sword|bat|club|crowbar|hammer|baton|knuckle|machete)/.test(rawId)) {
    let subtype = 'knife';
    if (/katana|sword|saber/.test(rawId)) subtype = 'katana';
    else if (/bat|club/.test(rawId)) subtype = 'bat';
    else if (/crowbar/.test(rawId)) subtype = 'crowbar';
    else if (/hammer|mace/.test(rawId)) subtype = 'hammer';
    else if (/baton|stun|taser/.test(rawId)) subtype = 'stun_baton';
    else if (/knuckle/.test(rawId)) subtype = 'knuckles';
    return { id: rawId, category: 'melee', subtype, asset: WEAPON_ASSET_MAP[subtype] || null, rimColor };
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
    return { id: rawId, category: 'weapon', subtype, asset: null, rimColor };
  }

  // Drugs & chemical compounds
  if (rawCat === 'drug' || /(xanax|vicodin|ecstasy|ketamine|lsd|shroom|opium|pcp|speed|cannabis|weed|epinephrine)/.test(rawId)) {
    return { id: rawId, category: 'drug', subtype: rawId, asset: null, rimColor };
  }

  // Medical
  if (rawCat === 'medical' || /(medkit|smallkit|first_aid|morphine|bloodbag|blood_bag|neumune|bandage|syringe)/.test(rawId)) {
    let subtype = 'medkit';
    if (/blood/.test(rawId)) subtype = 'bloodbag';
    else if (/morphine|neumune|syringe/.test(rawId)) subtype = 'syringe';
    else if (/small/.test(rawId)) subtype = 'small_medkit';
    return { id: rawId, category: 'medical', subtype, asset: null, rimColor };
  }

  // Boosters
  if (rawCat === 'booster' || /(edrink|energy|redbull|taurine|candy|chocolate|fhc|feathery|edvd|dvd|alcohol|beer|whiskey|lawyer_card)/.test(rawId)) {
    let subtype = 'edrink';
    if (/fhc|feathery|lawyer|coupon|vip/.test(rawId)) subtype = 'fhc';
    else if (/edvd|dvd|disc/.test(rawId)) subtype = 'edvd';
    else if (/candy|choc/.test(rawId)) subtype = 'candy';
    else if (/alcohol|whiskey|beer|wine/.test(rawId)) subtype = 'alcohol';
    return { id: rawId, category: 'booster', subtype, asset: null, rimColor };
  }

  // Armor & paperdoll slots
  if (rawCat === 'armor' || rawCat === 'paperdoll' || /(helmet|head|kevlar|vest|armor|body|chest|gloves|hands|gauntlet|boots|feet|pants|legs|greaves|amulet|ring|paint_mask|mask)/.test(rawId)) {
    let subtype = 'kevlar';
    if (/helmet|head/.test(rawId)) subtype = 'helmet';
    else if (/mask/.test(rawId)) subtype = 'mask';
    else if (/glove|hand|latex/.test(rawId)) subtype = 'gloves';
    else if (/boot|feet|shoe/.test(rawId)) subtype = 'boots';
    else if (/pant|leg|greave/.test(rawId)) subtype = 'pants';
    else if (/amulet|ring|medal|crest/.test(rawId)) subtype = 'ring';
    return { id: rawId, category: 'armor', subtype, asset: null, rimColor };
  }

  // Vehicles
  if (rawCat === 'vehicle' || /(car|civic|evo|gtr|gt3|bike|van|truck|racer)/.test(rawId)) {
    return { id: rawId, category: 'vehicle', subtype: /bike/.test(rawId) ? 'bike' : 'sports_car', asset: null, rimColor };
  }

  // Caches & Crates
  if (rawCat === 'cache' || /(cache|crate|chest|box|safe)/.test(rawId)) {
    return { id: rawId, category: 'cache', subtype: 'weapon_cache', asset: null, rimColor };
  }

  // Contraband / Collectibles
  if (rawCat === 'contraband' || /(bullion|gold|plush|flower|orchid|lotus|cherry|peony|violet|tribulus)/.test(rawId)) {
    let subtype = 'gold_bullion';
    if (/flower|orchid|lotus|cherry|peony|violet|tribulus/.test(rawId)) subtype = 'orchid';
    else if (/plush/.test(rawId)) subtype = 'plushie';
    return { id: rawId, category: 'contraband', subtype, asset: null, rimColor };
  }

  // Crime Enhancers & Tech Tools (default rich 3D tool)
  let enhSub = 'optics';
  if (/lockpick/.test(rawId)) enhSub = 'lockpicks';
  else if (/drive|ecu|keyboard| tape|black_box/.test(rawId)) enhSub = 'cyber_drive';
  else if (/flash|torch|megaphone/.test(rawId)) enhSub = 'flashlight';
  else if (/lighter/.test(rawId)) enhSub = 'lighter';
  return { id: rawId, category: 'enhancer', subtype: enhSub, asset: null, rimColor };
}

function normalizeObjectToUnitBounds(obj, targetExtent = 1.55) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return obj;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetExtent / maxDim;
  obj.scale.multiplyScalar(scale);
  obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  return obj;
}

/* --- Procedural Multi-Part 3D Mesh Builders --- */
function buildFirearmProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const gunmetal = makePbr(0x2b3038, 0.28, 0.90, { color: rimColor, power: 2.6, intensity: 0.45 });
  const steel = makePbr(0x8892a0, 0.22, 0.94, { color: rimColor, power: 2.8, intensity: 0.4 });
  const polymer = makePbr(0x1b1e24, 0.52, 0.22, { color: rimColor, power: 3.2, intensity: 0.3 });
  const woodOrAccent = subtype === 'ak'
    ? makePbr(0x8b4c24, 0.54, 0.08, { color: 0xfbbf24, power: 3.0, intensity: 0.28 })
    : makePbr(0x3b4252, 0.35, 0.68, { color: rimColor, power: 2.8, intensity: 0.35 });
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
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.16), subtype === 'revolver' ? steel : gunmetal);
    slide.position.set(0.1, 0.16, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, subtype === 'revolver' ? 0.68 : 0.36, 14), steel);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.55, 0.17, 0);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.14), subtype === 'revolver' ? woodOrAccent : polymer);
    grip.position.set(-0.24, -0.14, 0);
    grip.rotation.z = 0.28;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 16), gunmetal);
    guard.position.set(-0.02, -0.02, 0);
    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.1), opticLens);
    laser.position.set(0.32, 0.03, 0);
    g.add(slide, barrel, grip, guard, laser);
    if (subtype === 'revolver') {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 12), steel);
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(0.02, 0.14, 0);
      g.add(cyl);
    }
    return g;
  }

  const isLong = subtype === 'sniper' || subtype === 'shotgun';
  const recLen = subtype === 'smg' ? 0.68 : 0.96;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(recLen, 0.24, 0.16), gunmetal);
  const barrelLen = isLong ? 1.05 : subtype === 'smg' ? 0.45 : 0.78;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, barrelLen, 14), steel);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(recLen * 0.5 + barrelLen * 0.45, 0.05, 0);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(barrelLen * 0.58, 0.16, 0.14), woodOrAccent);
  handguard.position.set(recLen * 0.5 + barrelLen * 0.25, 0.02, 0);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.18, 12), gunmetal);
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(recLen * 0.5 + barrelLen * 0.9, 0.05, 0);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.13), subtype === 'ak' ? woodOrAccent : polymer);
  stock.position.set(-recLen * 0.5 - 0.25, -0.03, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.12), polymer);
  grip.position.set(-0.18, -0.26, 0);
  grip.rotation.z = 0.26;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, subtype === 'shotgun' ? 0.14 : 0.48, 0.11), subtype === 'ak' ? woodOrAccent : steel);
  mag.position.set(0.16, -0.28, 0);
  mag.rotation.z = -0.18;
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, subtype === 'sniper' ? 0.58 : 0.3, 14), polymer);
  scopeTube.rotation.z = Math.PI / 2;
  scopeTube.position.set(0.02, 0.21, 0);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 14), opticLens);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(subtype === 'sniper' ? 0.31 : 0.17, 0.21, 0);

  g.add(receiver, barrel, handguard, muzzle, stock, grip, mag, scopeTube, lens);
  return g;
}

function buildMeleeProcedural(subtype, rimColor) {
  const g = new THREE.Group();
  const bladeMat = makePbr(0xdbe4ee, 0.14, 0.96, { color: rimColor, power: 2.2, intensity: 0.55 });
  const darkGrip = makePbr(0x1f242d, 0.62, 0.18, { color: rimColor, power: 3.0, intensity: 0.3 });
  const brass = makePbr(0xd97706, 0.26, 0.88, { color: 0xfde68a, power: 2.6, intensity: 0.42 });

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
    g.rotation.z = -0.72;
    return g;
  }

  if (subtype === 'hammer' || subtype === 'crowbar' || subtype === 'stun_baton' || subtype === 'knuckles') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 1.45, 14), darkGrip);
    const head = subtype === 'stun_baton'
      ? new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.038, 10, 20), makePbr(0x38bdf8, 0.12, 0.5, { color: 0x38bdf8, power: 1.8, intensity: 1.0 }, { emissive: 0x0284c7, emissiveIntensity: 0.9 }))
      : new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 0.26), bladeMat);
    head.position.y = 0.64;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 14), brass);
    collar.position.y = 0.46;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.1, 14), brass);
    cap.position.y = -0.72;
    g.add(shaft, head, collar, cap);
    g.rotation.z = -0.68;
    return g;
  }

  // Knife / Katana / Razor
  const bladeLen = subtype === 'katana' ? 1.38 : 0.88;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, bladeLen, 0.028), bladeMat);
  blade.position.y = bladeLen * 0.5 + 0.05;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.22, 4), bladeMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = bladeLen + 0.15;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.12), brass);
  guard.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.42, 12), darkGrip);
  handle.position.y = -0.21;
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), brass);
  pommel.position.y = -0.45;
  g.add(blade, tip, guard, handle, pommel);
  g.rotation.z = -0.74;
  return g;
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

  // Two-tone 3D capsule pills orbiting next to the vial
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

  // Trauma Medkit Hardcase + Raised 3D Cross
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

  // Energy Can / Bottle
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
  const gold = makePbr(0xf59e0b, 0.2, 0.95, { color: 0xfef08a, power: 2.2, intensity: 0.72 });

  if (subtype === 'helmet' || subtype === 'mask') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.66), tactical);
    dome.position.y = 0.08;
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.28, 20, 1, false, -Math.PI * 0.35, Math.PI * 0.7), visorMat);
    visor.position.set(0, -0.02, 0.06);
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.14), plate);
    nvgMount.position.set(0, 0.32, 0.44);
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.46), plate);
    railL.position.set(-0.48, 0.08, 0);
    const railR = railL.clone();
    railR.position.x = 0.48;
    g.add(dome, visor, nvgMount, railL, railR);
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

  if (subtype === 'boots' || subtype === 'gloves' || subtype === 'pants') {
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.82, 0.44), tactical);
    left.position.x = -0.26;
    const right = left.clone();
    right.position.x = 0.26;
    const guardL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.48), plate);
    guardL.position.set(-0.26, 0.12, 0.02);
    const guardR = guardL.clone();
    guardR.position.x = 0.26;
    const soleL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.56), gold);
    soleL.position.set(-0.26, -0.38, 0.05);
    const soleR = soleL.clone();
    soleR.position.x = 0.26;
    g.add(left, right, guardL, guardR, soleL, soleR);
    return g;
  }

  // Segmented Kevlar Tactical Plate Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.05, 0.38), tactical);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.44), plate);
  chestPlate.position.y = 0.16;
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.4), tactical);
  strapL.position.set(-0.28, 0.62, 0);
  const strapR = strapL.clone();
  strapR.position.x = 0.28;
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.48), plate);
    pouch.position.set(i * 0.25, -0.24, 0.02);
    g.add(pouch);
  }
  g.add(torso, chestPlate, strapL, strapR);
  return g;
}

function buildContrabandOrEnhancerProcedural(category, subtype, rimColor) {
  const g = new THREE.Group();
  const gold = makePbr(0xfbbf24, 0.16, 0.96, { color: 0xfef08a, power: 2.0, intensity: 0.78 });
  const steel = makePbr(0x64748b, 0.25, 0.9, { color: rimColor, power: 2.6, intensity: 0.48 });
  const dark = makePbr(0x1e293b, 0.42, 0.55, { color: rimColor, power: 2.8, intensity: 0.4 });
  const neon = makePbr(0x22d3ee, 0.12, 0.3, { color: 0x67e8f9, power: 1.8, intensity: 0.95 }, { emissive: 0x0891b2, emissiveIntensity: 0.8 });

  if (category === 'vehicle') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.28, 0.72), makePbr(0xdc2626, 0.18, 0.78, { color: 0xfca5a5, power: 2.2, intensity: 0.65 }, { clearcoat: 1.0 }));
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.6), neon);
    cabin.position.set(-0.05, 0.24, 0);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.74), dark);
    wing.position.set(-0.66, 0.24, 0);
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
    const positions = [[0.46, -0.14, 0.38], [0.46, -0.14, -0.38], [-0.46, -0.14, 0.38], [-0.46, -0.14, -0.38]];
    for (let i = 0; i < positions.length; i++) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(positions[i][0], positions[i][1], positions[i][2]);
      g.add(w);
    }
    g.add(chassis, cabin, wing);
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

  if (category === 'contraband') {
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

  // Crime Enhancer / Night-Vision / Lockpicks / Cyber Deck
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.28, 0.34), dark);
  const tubeL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.48, 16), steel);
  tubeL.rotation.x = Math.PI / 2;
  tubeL.position.set(-0.24, 0, 0.24);
  const tubeR = tubeL.clone();
  tubeR.position.x = 0.24;
  const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), neon);
  lensL.rotation.x = Math.PI / 2;
  lensL.position.set(-0.24, 0, 0.49);
  const lensR = lensL.clone();
  lensR.position.x = 0.24;
  g.add(frame, tubeL, tubeR, lensL, lensR);
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
  if (!assetSpec || typeof window === 'undefined' || typeof fetch !== 'function') {
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
          const root = gltf && gltf.scene ? gltf.scene : null;
          if (root) {
            applyPbrAndRimToLoadedWeapon(root, rimColor);
            normalizeObjectToUnitBounds(root, 1.65);
          }
          resolve(root);
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
              normalizeObjectToUnitBounds(obj, 1.68);
              resolve(obj);
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

export function createItemMesh3D(itemId, category = '', rarity = 'rare', opts = {}) {
  const spec = resolveItemSpec3D(itemId, category, rarity);
  const root = new THREE.Group();
  root.name = `z3d-item-${spec.id}`;
  root.userData = {
    z3dItemId: spec.id,
    z3dCategory: spec.category,
    z3dSubtype: spec.subtype,
    z3dRarity: rarity,
    z3dAssetUrl: spec.asset ? (spec.asset.url || spec.asset.obj) : null,
  };

  let modelGroup;
  if (spec.category === 'weapon') modelGroup = buildFirearmProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'melee') modelGroup = buildMeleeProcedural(spec.subtype, spec.rimColor);
  else if (spec.category === 'drug') modelGroup = buildDrugVialProcedural(spec.subtype);
  else if (spec.category === 'medical') modelGroup = buildMedicalProcedural(spec.subtype);
  else if (spec.category === 'booster') modelGroup = buildBoosterProcedural(spec.subtype);
  else if (spec.category === 'armor') modelGroup = buildArmorProcedural(spec.subtype, spec.rimColor);
  else modelGroup = buildContrabandOrEnhancerProcedural(spec.category, spec.subtype, spec.rimColor);

  normalizeObjectToUnitBounds(modelGroup, 1.52);
  modelGroup.name = 'z3d-item-body';
  root.add(modelGroup);

  // Subtle collector halo ring beneath the floating 3D item
  if (opts.withPedestalRing !== false) {
    const ringMat = makePbr(spec.rimColor, 0.25, 0.85, false, {
      transparent: true,
      opacity: 0.36,
      emissive: spec.rimColor,
      emissiveIntensity: 0.35,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.018, 10, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.78;
    ring.name = 'z3d-item-halo';
    root.add(ring);
  }

  root.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  // Async in-place upgrade to real GLB / OBJ+MTL asset on disk when running in browser
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
 * 5. 7 INTERACTIVE 3D ACTION STAGES (`buildStageScene3D`)
 * -------------------------------------------------------------------------- */
function createHumanoid3D(opts = {}) {
  const g = new THREE.Group();
  const coatHex = opts.coatColor || 0x1e293b;
  const skinHex = opts.skinColor || 0xd6a582;
  const rimHex = opts.rimColor || 0x38bdf8;
  const scale = opts.scale || 1.0;

  const coat = makePbr(coatHex, 0.42, 0.45, { color: rimHex, power: 2.2, intensity: opts.rimIntensity || 0.62, pulseHz: 0.8 });
  const skin = makePbr(skinHex, 0.55, 0.08, { color: rimHex, power: 2.8, intensity: 0.35 });
  const trim = makePbr(opts.trimColor || 0xfbbf24, 0.25, 0.88, { color: rimHex, power: 2.4, intensity: 0.5 });

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 6, 10), coat);
  legL.position.set(-0.11, 0.28, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.22), coat);
  torso.position.y = 0.74;

  const chestVest = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.3, 0.25), trim);
  chestVest.position.y = 0.78;

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.34, 6, 10), coat);
  armL.position.set(-0.26, 0.74, 0.04);
  armL.rotation.z = 0.16;
  const armR = armL.clone();
  armR.position.set(0.26, 0.74, 0.12);
  armR.rotation.x = -0.45;
  armR.rotation.z = -0.16;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), skin);
  head.position.y = 1.16;

  if (opts.bossCrown) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.18), makePbr(0xef4444, 0.12, 0.4, { color: 0xfca5a5, power: 1.6, intensity: 1.0 }, { emissive: 0xdc2626, emissiveIntensity: 0.9 }));
    visor.position.set(0, 1.17, 0.1);
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), trim);
    shoulderL.position.set(-0.26, 0.96, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.26;
    g.add(visor, shoulderL, shoulderR);
  }

  if (opts.weaponId) {
    const held = createItemMesh3D(opts.weaponId, opts.weaponCat || 'weapon', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: !!opts.headless });
    held.scale.setScalar(0.36);
    held.position.set(0.28, 0.72, 0.34);
    held.rotation.y = -Math.PI / 2;
    g.add(held);
  }

  g.add(legL, legR, torso, chestVest, armL, armR, head);
  g.scale.setScalar(scale);
  g.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return g;
}

function addStandardStageLighting(scene, floorColor = 0x181512, accentHex = 0x38bdf8) {
  scene.background = new THREE.Color(0x13110e);
  const hemi = new THREE.HemisphereLight(0xfef3c7, 0x1c1917, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff7ed, 2.9);
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

  const rim = new THREE.DirectionalLight(accentHex, 1.55);
  rim.position.set(-5.0, 4.0, -4.5);
  scene.add(rim);

  const point = new THREE.PointLight(0xf59e0b, 2.2, 12);
  point.position.set(0, 2.6, 1.8);
  scene.add(point);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.6, 0.22, 40),
    makePbr(floorColor, 0.62, 0.28, false)
  );
  floor.position.y = -0.11;
  floor.receiveShadow = true;
  scene.add(floor);

  const trimRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.32, 0.045, 10, 56),
    makePbr(accentHex, 0.22, 0.88, false, { emissive: accentHex, emissiveIntensity: 0.42 })
  );
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.01;
  scene.add(trimRing);

  return { hemi, key, rim, point, floor, trimRing };
}

export function buildStageScene3D(stageKind, world, initialState = {}) {
  const kind = STAGE_KINDS.includes(stageKind) ? stageKind : 'safehouse-empire';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 80);
  camera.position.set(0, 2.55, 5.6);
  camera.lookAt(0, 0.85, 0);

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

  // Reusable burst spark group for juicy action feedback
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

  /* === STAGE 1: SAFEHOUSE-EMPIRE (Home) === */
  if (kind === 'safehouse-empire') {
    const lights = addStandardStageLighting(scene, 0x1b1714, 0xf59e0b);
    refs.lights = lights;

    // Evolving 6-Era Compound Group
    const compoundGroup = new THREE.Group();
    scene.add(compoundGroup);
    refs.compoundGroup = compoundGroup;

    const rebuildCompoundEra = (eraNum) => {
      while (compoundGroup.children.length) compoundGroup.remove(compoundGroup.children[0]);
      const era = Math.max(1, Math.min(6, Number(eraNum) || 1));
      const baseH = 0.65 + era * 0.28;
      const baseW = 1.45 + era * 0.14;
      const wallHex = [0x475569, 0x334155, 0xd6c7b2, 0x1e293b, 0x292524, 0x18181b][era - 1];
      const trimHex = [0x94a3b8, 0x38bdf8, 0x22c55e, 0xa855f7, 0xf59e0b, 0xfbbf24][era - 1];

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(baseW, baseH, 1.15),
        makePbr(wallHex, 0.36, 0.62, { color: trimHex, power: 2.6, intensity: 0.45 })
      );
      tower.position.set(0, baseH * 0.5, -1.45);
      tower.castShadow = true;
      tower.receiveShadow = true;
      compoundGroup.add(tower);

      for (let r = 0; r < era; r++) {
        const winStrip = new THREE.Mesh(
          new THREE.BoxGeometry(baseW * 0.82, 0.08, 1.19),
          makePbr(trimHex, 0.14, 0.3, false, { emissive: trimHex, emissiveIntensity: 0.85 })
        );
        winStrip.position.set(0, 0.28 + r * 0.26, -1.45);
        compoundGroup.add(winStrip);
      }

      if (era >= 3) {
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.75, baseH * 0.68, 0.9), makePbr(wallHex, 0.4, 0.58));
        wingL.position.set(-baseW * 0.72, baseH * 0.34, -1.4);
        const wingR = wingL.clone();
        wingR.position.x = baseW * 0.72;
        compoundGroup.add(wingL, wingR);
      }
      if (era >= 5) {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 8), makePbr(0xfbbf24, 0.18, 0.94, false, { emissive: 0xd97706, emissiveIntensity: 0.5 }));
        spire.position.set(0, baseH + 0.42, -1.45);
        compoundGroup.add(spire);
      }
      compoundGroup.userData.era = era;
    };
    rebuildCompoundEra(initialState.era || 1);
    refs.rebuildCompoundEra = rebuildCompoundEra;

    // 3D Player Operative
    const operative = createHumanoid3D({ coatColor: 0x1e3a8a, trimColor: 0x38bdf8, rimColor: 0x38bdf8, weaponId: 'ak', headless });
    operative.position.set(-0.95, 0, 0.55);
    operative.rotation.y = 0.48;
    scene.add(operative);
    refs.operativeEid = spawnTracked(operative);

    // 3D Living Nemesis Boss (Crimson Fresnel Rim + Raycast Clickable!)
    const nemesisWrap = new THREE.Group();
    const nemPodium = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.64, 0.16, 20), makePbr(0x450a0a, 0.3, 0.78, { color: 0xef4444, power: 2.0, intensity: 0.8 }));
    nemPodium.position.y = 0.08;
    const nemBody = createHumanoid3D({ coatColor: 0x450a0a, trimColor: 0xef4444, rimColor: 0xff3b30, rimIntensity: 0.95, bossCrown: true, scale: 1.14, weaponId: 'shotgun', headless });
    nemBody.position.y = 0.16;
    nemesisWrap.add(nemPodium, nemBody);
    nemesisWrap.position.set(1.35, 0, 0.38);
    nemesisWrap.rotation.y = -0.52;
    scene.add(nemesisWrap);
    const nemEid = spawnTracked(nemesisWrap);
    world.setFresnelRim(nemEid, 0xff3b30, 2.0, 0.92, 1.15);
    registerPickable(nemEid, { stage: 'safehouse-empire', target: 'nemesis', id: 'nemesis' });
    refs.nemesisEid = nemEid;

    // 5 3D Street Crew Specialists around perimeter
    const crewSpecs = [
      { id: 'enforcer', x: -2.35, z: -0.25, color: 0xdc2626, weapon: 'shotgun' },
      { id: 'lookout', x: -1.75, z: -1.05, color: 0x0ea5e9, weapon: 'sniper' },
      { id: 'street_chemist', x: 0.0, z: -0.42, color: 0x10b981, weapon: 'xanax' },
      { id: 'wheelman', x: 1.85, z: -1.0, color: 0xf59e0b, weapon: 'smg' },
      { id: 'consigliere', x: 2.45, z: -0.18, color: 0xa855f7, weapon: 'pistol' },
    ];
    refs.crewMeshes = [];
    for (let i = 0; i < crewSpecs.length; i++) {
      const cs = crewSpecs[i];
      const member = createHumanoid3D({ coatColor: cs.color, trimColor: 0xfbbf24, rimColor: 0x4ade80, scale: 0.84, weaponId: cs.weapon, headless });
      member.position.set(cs.x, 0, cs.z);
      member.rotation.y = -cs.x * 0.22;
      scene.add(member);
      const ceid = spawnTracked(member);
      world.setHoverFloat(ceid, 0, 0.03, 0.9, i * 1.1);
      registerPickable(ceid, { stage: 'safehouse-empire', target: 'crew', crewId: cs.id });
      refs.crewMeshes.push({ id: cs.id, mesh: member, eid: ceid });
    }

    // 4 Rotating 3D Origin Loadout Pedestals (visible when originChosen === false)
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

    // 1. Bank Vault Frame & Spinning Vault Door
    const vaultFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.0, 0.35), makePbr(0x334155, 0.34, 0.85));
    vaultFrame.position.set(0, 1.0, -1.35);
    scene.add(vaultFrame);

    const bullionInside = createItemMesh3D('gold_bullion', 'contraband', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
    bullionInside.position.set(0, 0.45, -1.65);
    scene.add(bullionInside);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.72, 1.0, -1.14);
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.18, 28), makePbr(0x94a3b8, 0.2, 0.94, { color: 0xfbbf24, power: 2.4, intensity: 0.55 }));
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(0.72, 0, 0);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 10, 20), makePbr(0xf59e0b, 0.2, 0.95));
    wheel.position.set(0.72, 0, 0.12);
    doorPivot.add(vaultDoor, wheel);
    scene.add(doorPivot);
    refs.vaultDoorEid = spawnTracked(doorPivot);
    registerPickable(refs.vaultDoorEid, { stage: 'heist-breach', target: 'vault' });

    // 2. Laser Security Grid
    const laserGroup = new THREE.Group();
    const laserMat = makePbr(0xff1e42, 0.1, 0.1, false, { emissive: 0xff1e42, emissiveIntensity: 1.15, transparent: true, opacity: 0.82 });
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.6, 8), laserMat);
      beam.rotation.z = Math.PI / 2 + (i - 1) * 0.14;
      beam.position.set(0, 0.42 + i * 0.42, -0.35);
      laserGroup.add(beam);
    }
    scene.add(laserGroup);
    refs.laserEid = spawnTracked(laserGroup);
    registerPickable(refs.laserEid, { stage: 'heist-breach', target: 'laser' });

    // 3. Street ATM Skimmer
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

    // 4. Contraband Floor Safe
    const safe = createItemMesh3D('weapon_cache', 'cache', 'epic', { withPedestalRing: false, disableAsyncUpgrade: true });
    safe.scale.setScalar(0.56);
    safe.position.set(-1.15, 0.28, 1.1);
    scene.add(safe);
    registerPickable(spawnTracked(safe), { stage: 'heist-breach', target: 'safe' });

    // 5. Getaway Sports Car
    const car = createItemMesh3D('sports_car', 'vehicle', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
    car.scale.setScalar(0.88);
    car.position.set(1.85, 0.26, 0.95);
    car.rotation.y = -0.62;
    scene.add(car);
    refs.carEid = spawnTracked(car);
    registerPickable(refs.carEid, { stage: 'heist-breach', target: 'getaway' });
  }

  /* === STAGE 3: GYM-IRONPIT (Gym) === */
  else if (kind === 'gym-ironpit') {
    addStandardStageLighting(scene, 0x1c1917, 0x22c55e);

    // Athlete Operative in center
    const athlete = createHumanoid3D({ coatColor: 0x14532d, trimColor: 0x4ade80, rimColor: 0x4ade80, headless });
    athlete.position.set(0, 0, 0.65);
    scene.add(athlete);
    refs.athleteEid = spawnTracked(athlete);

    // 1. Heavy Bag Rig (STR)
    const strGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.05, 12), makePbr(0x475569, 0.35, 0.85));
    post.position.set(-0.35, 1.02, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.08), makePbr(0x475569, 0.35, 0.85));
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
    const strEid = spawnTracked(strGroup);
    registerPickable(strEid, { stage: 'gym-ironpit', target: 'station', stationId: 'str' });

    // 2. Ballistic Shield Press Rig (DEF)
    const defGroup = new THREE.Group();
    const rackL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.65, 0.6), makePbr(0x64748b, 0.3, 0.88));
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
    defGroup.position.set(-0.75, 0, -1.15);
    scene.add(defGroup);
    refs.defEid = spawnTracked(defGroup);
    registerPickable(refs.defEid, { stage: 'gym-ironpit', target: 'station', stationId: 'def' });

    // 3. Neon Sprint Track (SPD)
    const spdGroup = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 1.65), makePbr(0x1e293b, 0.45, 0.55));
    deck.position.y = 0.07;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 1.48), makePbr(0x06b6d4, 0.15, 0.3, false, { emissive: 0x0891b2, emissiveIntensity: 0.8 }));
    strip.position.y = 0.075;
    const consolePost = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.95, 0.14), makePbr(0x334155, 0.35, 0.8));
    consolePost.position.set(0, 0.52, -0.72);
    spdGroup.add(deck, strip, consolePost);
    spdGroup.position.set(0.85, 0, -1.05);
    scene.add(spdGroup);
    refs.spdEid = spawnTracked(spdGroup);
    registerPickable(refs.spdEid, { stage: 'gym-ironpit', target: 'station', stationId: 'spd' });

    // 4. Laser Reflex Targets (DEX)
    const dexGroup = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.1 + Math.abs(i) * 0.15, 10), makePbr(0x64748b, 0.3, 0.85));
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

    const player = createHumanoid3D({ coatColor: 0x0f172a, trimColor: 0x38bdf8, rimColor: 0x38bdf8, scale: 1.06, weaponId: 'assaultrifle_1', headless });
    player.position.set(-1.45, 0, 0.28);
    player.rotation.y = Math.PI * 0.44;
    scene.add(player);
    refs.playerEid = spawnTracked(player);

    const rival = createHumanoid3D({ coatColor: 0x450a0a, trimColor: 0xf59e0b, rimColor: 0xff3b30, rimIntensity: 0.92, bossCrown: true, scale: 1.12, weaponId: 'sniper', headless });
    rival.position.set(1.45, 0, -0.18);
    rival.rotation.y = -Math.PI * 0.52;
    scene.add(rival);
    refs.rivalEid = spawnTracked(rival);
    world.setFresnelRim(refs.rivalEid, 0xff3b30, 2.0, 0.9, 1.2);
    registerPickable(refs.rivalEid, { stage: 'combat-arena', target: 'opponent' });

    // Rooftop Cover Barriers
    for (let i = -1; i <= 1; i += 2) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.28), makePbr(0x334155, 0.52, 0.45));
      barrier.position.set(i * 1.95, 0.26, -1.25);
      barrier.rotation.y = -i * 0.32;
      scene.add(barrier);
    }
  }

  /* === STAGE 5: CITY-WHEELS-RACE (City Activities) === */
  else if (kind === 'city-wheels-race') {
    addStandardStageLighting(scene, 0x151821, 0x38bdf8);

    // 3D Prize Wheel on Gilded Stand
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.75, 0.28), makePbr(0xf59e0b, 0.22, 0.92));
    stand.position.set(0, 0.88, -0.85);
    scene.add(stand);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.38, -0.66);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.08, 12, 36), makePbr(0xfbbf24, 0.18, 0.94));
    wheelGroup.add(wheelRim);
    const segColors = [0xef4444, 0x38bdf8, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.82, 0.06),
        makePbr(segColors[i % segColors.length], 0.25, 0.45, false, { emissive: segColors[i % segColors.length], emissiveIntensity: 0.35 })
      );
      spoke.position.set(Math.cos(ang) * 0.44, Math.sin(ang) * 0.44, 0);
      spoke.rotation.z = ang - Math.PI / 2;
      wheelGroup.add(spoke);
    }
    scene.add(wheelGroup);
    refs.wheelEid = spawnTracked(wheelGroup);
    world.setStageKinematics(refs.wheelEid, ANIM_WHEEL_SPIN, 4.0, 1.25, 0);
    registerPickable(refs.wheelEid, { stage: 'city-wheels-race', target: 'wheel' });

    // 3 Neon Street Drift Cars banking around perimeter track
    const carColors = [0x22c55e, 0x38bdf8, 0xf43f5e];
    refs.carEids = [];
    for (let i = 0; i < 3; i++) {
      const car = createItemMesh3D('sports_car', 'vehicle', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
      car.scale.setScalar(0.55);
      car.traverse((n) => {
        if (n.isMesh && i > 0 && n.material && n.material.color && n.geometry.type === 'BoxGeometry') {
          n.material = makePbr(carColors[i], 0.18, 0.8, { color: carColors[i], power: 2.2, intensity: 0.7 });
        }
      });
      car.position.set(2.6, 0.16, 1.5);
      scene.add(car);
      const ceid = spawnTracked(car);
      world.setStageKinematics(ceid, ANIM_DRIFT_ORBIT, 10.0, 1.35 + i * 0.12, (i * Math.PI * 2) / 3);
      registerPickable(ceid, { stage: 'city-wheels-race', target: 'racecar', carIndex: i });
      refs.carEids.push(ceid);
    }
  }

  /* === STAGE 6: CASINO-ROYALE (Casino) === */
  else if (kind === 'casino-royale') {
    addStandardStageLighting(scene, 0x16241c, 0xfbbf24);

    // 1. European Roulette Wheel + Rolling 3D Ivory Ball
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.08, 0.34, 36), makePbr(0x7c2d12, 0.26, 0.35));
    bowl.position.set(-1.35, 0.18, 0.15);
    scene.add(bowl);

    const rotor = new THREE.Group();
    rotor.position.set(-1.35, 0.36, 0.15);
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 18), makePbr(0xfbbf24, 0.18, 0.96));
    hub.position.y = 0.12;
    rotor.add(hub);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const pocketColor = i === 0 ? 0x16a34a : i % 2 === 0 ? 0xdc2626 : 0x18181b;
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.34), makePbr(pocketColor, 0.3, 0.4));
      pocket.position.set(Math.cos(ang) * 0.72, 0, Math.sin(ang) * 0.72);
      pocket.rotation.y = -ang;
      rotor.add(pocket);
    }
    scene.add(rotor);
    refs.rouletteRotorEid = spawnTracked(rotor);
    world.setTurntable(refs.rouletteRotorEid, 1.65, 4.0);
    registerPickable(refs.rouletteRotorEid, { stage: 'casino-royale', target: 'roulette' });

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), makePbr(0xf8fafc, 0.08, 0.15));
    ball.position.set(-1.35, 0.44, 0.15);
    scene.add(ball);
    refs.ballEid = spawnTracked(ball);
    world.setStageKinematics(refs.ballEid, ANIM_ROULETTE_BALL, 4.5, -5.2, 0);

    // 2. 3D Jackpot Slot Machine with 3 Spinning Reels
    const cabinet = new THREE.Group();
    cabinet.position.set(1.45, 0, -0.1);
    cabinet.rotation.y = -0.35;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.78, 0.74), makePbr(0x991b1b, 0.25, 0.72, { color: 0xfbbf24, power: 2.4, intensity: 0.6 }));
    body.position.y = 0.89;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.56, 0.78), makePbr(0xfbbf24, 0.18, 0.94));
    bezel.position.y = 1.08;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.22, 16), makePbr(0xfef08a, 0.1, 0.2, false, { emissive: 0xf59e0b, emissiveIntensity: 0.95 }));
    beacon.position.y = 1.88;
    cabinet.add(body, bezel, beacon);

    refs.reelEids = [];
    for (let r = -1; r <= 1; r++) {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 8), makePbr(0xf8fafc, 0.22, 0.35, { color: 0xfbbf24, power: 2.5, intensity: 0.4 }));
      reel.rotation.z = Math.PI / 2;
      reel.position.set(r * 0.3, 1.08, 0.28);
      cabinet.add(reel);
      const reid = spawnTracked(reel);
      world.setStageKinematics(reid, ANIM_SLOT_REEL, 2.4, 3.2 + (r + 1) * 0.8, 0);
      refs.reelEids.push(reid);
    }
    scene.add(cabinet);
    registerPickable(spawnTracked(cabinet), { stage: 'casino-royale', target: 'slots' });
  }

  /* === STAGE 7: PAPERDOLL-ARMORY (Dossier) === */
  else if (kind === 'paperdoll-armory') {
    addStandardStageLighting(scene, 0x171923, 0x8b5cf6);

    const rigGroup = new THREE.Group();
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 0.18, 32), makePbr(0x1e293b, 0.28, 0.88, { color: 0xa855f7, power: 2.2, intensity: 0.7 }));
    dais.position.y = 0.09;
    const mannequin = createHumanoid3D({ coatColor: 0x1e293b, trimColor: 0xa855f7, rimColor: 0xc084fc, scale: 1.18, weaponId: initialState.primary || 'assaultrifle_1', headless });
    mannequin.position.y = 0.18;
    const helmet = createItemMesh3D(initialState.head || 'helmet', 'armor', 'epic', { withPedestalRing: false, disableAsyncUpgrade: true });
    helmet.scale.setScalar(0.28);
    helmet.position.set(0, 1.58, 0);
    rigGroup.add(dais, mannequin, helmet);
    scene.add(rigGroup);

    refs.rigEid = spawnTracked(rigGroup);
    world.setTurntable(refs.rigEid, 0.72, 5.5);
    registerPickable(refs.rigEid, { stage: 'paperdoll-armory', target: 'loadout' });

    // Flanking Floating Armory Displays
    const leftStand = createItemMesh3D(initialState.secondary || 'magnum', 'weapon', 'legendary', { disableAsyncUpgrade: headless });
    leftStand.scale.setScalar(0.58);
    leftStand.position.set(-1.95, 0.92, -0.35);
    scene.add(leftStand);
    const lEid = spawnTracked(leftStand);
    world.setTurntable(lEid, -0.85, 5.0);

    const rightStand = createItemMesh3D(initialState.melee || 'katana', 'melee', 'legendary', { disableAsyncUpgrade: headless });
    rightStand.scale.setScalar(0.58);
    rightStand.position.set(1.95, 0.92, -0.35);
    scene.add(rightStand);
    const rEid = spawnTracked(rightStand);
    world.setTurntable(rEid, 0.85, 5.0);
  }

  function triggerAction(actionName = 'pulse', payload = {}) {
    const act = String(actionName || 'pulse').toLowerCase();
    const isHeavy = /(confront|boss|attack|mug|hosp|execute|jackpot|raid)/.test(act);
    world.addTrauma(camEid, isHeavy ? 0.65 : 0.36);
    world.triggerHitStop(isHeavy ? 0.08 : 0.045, 0.06, camEid);
    world.setStageKinematics(burstEid, ANIM_BURST_POP, 0.52, 0.75, 1.35);

    if (kind === 'safehouse-empire') {
      if (refs.operativeEid !== undefined) {
        world.setStageKinematics(refs.operativeEid, ANIM_LUNGE, 0.44, 0.65, -0.12);
      }
      if (refs.nemesisEid !== undefined && /nemesis/.test(act)) {
        world.setStageKinematics(refs.nemesisEid, ANIM_LUNGE, 0.48, -0.45, 0.08);
      }
    } else if (kind === 'heist-breach') {
      if (refs.vaultDoorEid !== undefined) {
        world.setStageKinematics(refs.vaultDoorEid, ANIM_VAULT_OPEN, 0.95, 0, -1.35);
      }
      if (refs.carEid !== undefined) {
        world.setStageKinematics(refs.carEid, ANIM_LUNGE, 0.65, 0.45, 0.32);
      }
    } else if (kind === 'gym-ironpit') {
      const stat = String((payload && payload.stat) || act || 'str').toLowerCase();
      if (refs.athleteEid !== undefined) {
        world.setStageKinematics(refs.athleteEid, ANIM_LUNGE, 0.38, 0, -0.35);
      }
      if (refs.bagPivotEid !== undefined && (stat.includes('str') || stat === 'train')) {
        world.setStageKinematics(refs.bagPivotEid, ANIM_BAG_SWING, 0.85, 0.48, 0);
      }
    } else if (kind === 'combat-arena') {
      if (refs.playerEid !== undefined) {
        world.setStageKinematics(refs.playerEid, ANIM_LUNGE, 0.42, 0.95, -0.18);
      }
      if (refs.rivalEid !== undefined) {
        world.setStageKinematics(refs.rivalEid, ANIM_LUNGE, 0.46, 0.35, 0.08);
      }
    } else if (kind === 'city-wheels-race') {
      if (refs.wheelEid !== undefined) {
        world.setStageKinematics(refs.wheelEid, ANIM_WHEEL_SPIN, 3.2, 9.5, 1);
      }
    } else if (kind === 'casino-royale') {
      if (refs.ballEid !== undefined) {
        world.setStageKinematics(refs.ballEid, ANIM_ROULETTE_BALL, 3.6, -11.5, 0);
      }
      if (refs.reelEids) {
        for (let i = 0; i < refs.reelEids.length; i++) {
          world.setStageKinematics(refs.reelEids[i], ANIM_SLOT_REEL, 1.4 + i * 0.35, 16.0, 1);
        }
      }
    } else if (kind === 'paperdoll-armory') {
      if (refs.rigEid !== undefined) {
        thisSpinBoost(world, refs.rigEid, 0.9);
      }
    }
    return true;
  }

  function thisSpinBoost(w, eid, deltaYaw) {
    if (w.isAlive(eid) && (w.stores.mask[eid] & COMPONENTS.TURNTABLE)) {
      w.stores.TurntableSpin[eid * 4 + 1] += deltaYaw;
    }
  }

  function updateState(stateObj = {}) {
    if (!stateObj || typeof stateObj !== 'object') return false;
    if (kind === 'safehouse-empire') {
      const nextEra = Number(
        stateObj.era ??
        (stateObj.eraProgression && stateObj.eraProgression.currentEra) ??
        (refs.compoundGroup && refs.compoundGroup.userData.era) ??
        1
      );
      if (refs.rebuildCompoundEra && nextEra !== refs.compoundGroup.userData.era) {
        refs.rebuildCompoundEra(nextEra);
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
    }
    return true;
  }

  function dispose() {
    for (let i = 0; i < spawnedEids.length; i++) {
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
 * 6. SHARED WEBGL RUNTIME (`ZoneEcs3DRuntime`)
 *    Strict WebGL Context Cap:
 *      - 1 Offscreen Item Renderer (220x180, blits to all 2D .z3d-item-canvas)
 *      - 1 Live Interactive Stage Renderer (OrbitControls + Raycaster)
 *      - Optional 1 On-Demand Modal Inspector Renderer (released on close)
 * -------------------------------------------------------------------------- */
export class ZoneEcs3DRuntime {
  constructor(opts = {}) {
    this.createRenderer = opts.createRenderer || ((params) => new THREE.WebGLRenderer(params));
    this.world = new ZoneEcsWorld({
      renderHook: (scaledDt, realDt) => this._renderFrame(scaledDt, realDt),
    });

    this.itemRenderer = null;
    this.itemScene = new THREE.Scene();
    this.itemCamera = new THREE.PerspectiveCamera(36, 220 / 180, 0.1, 30);
    this.itemCamera.position.set(0, 0.32, 3.35);
    this.itemCamera.lookAt(0, -0.04, 0);
    this._setupItemStudioLighting();

    this.stageRenderer = null;
    this.stageControls = null;
    this.activePrimaryStageEl = null;

    this.inspectorRenderer = null;
    this.inspectorControls = null;
    this.inspectorScene = null;
    this.inspectorCamera = null;
    this.inspectorItemEid = -1;
    this.inspectorModalEl = null;
    this.inspectorOpen = false;

    this.itemSlots = new Map();       // Element -> slotRecord
    this.stageInstances = new Map();  // Element -> stageRecord
    this._roundRobinCursor = 0;
    this._drawCalls = 0;
    this._triangles = 0;
    this._contextLost = false;
    this._webglContextCount = 0;
    this._rafId = 0;
    this._running = false;

    this._unsubUpgrade = onWeaponAssetUpgraded((upgradedId) => {
      for (const rec of this.itemSlots.values()) {
        if (rec.itemId === upgradedId) rec.dirty = true;
      }
    });
  }

  _setupItemStudioLighting() {
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1e293b, 1.35);
    const key = new THREE.DirectionalLight(0xffffff, 2.85);
    key.position.set(3.2, 4.5, 4.0);
    const fill = new THREE.DirectionalLight(0x38bdf8, 1.25);
    fill.position.set(-3.5, 1.8, 2.2);
    const rim = new THREE.DirectionalLight(0xfbbf24, 1.55);
    rim.position.set(0.5, -2.2, -3.5);
    this.itemScene.add(hemi, key, fill, rim);
  }

  _applyIBL(renderer, targetScene) {
    if (!renderer || typeof THREE.PMREMGenerator !== 'function') return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      const rt = pmrem.fromScene(envScene, 0.04);
      targetScene.environment = rt.texture;
      targetScene.environmentIntensity = 0.85;
      if (typeof envScene.dispose === 'function') envScene.dispose();
      pmrem.dispose();
    } catch (_) {
      // Headless / mock renderer safe fallback
    }
  }

  _ensureItemRenderer() {
    if (this.itemRenderer) return this.itemRenderer;
    const r = this.createRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(220, 180, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.18;
    this._wireContextEvents(r);
    this._applyIBL(r, this.itemScene);
    this.itemRenderer = r;
    this._webglContextCount++;
    return r;
  }

  _ensureStageRenderer() {
    if (this.stageRenderer) return this.stageRenderer;
    const r = this.createRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    r.setPixelRatio(dpr);
    r.setSize(560, 235, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    if (r.shadowMap) {
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
    }
    if (r.domElement && r.domElement.classList) {
      r.domElement.classList.add('z3d-stage-webgl-canvas');
    }
    this._wireContextEvents(r);
    this._bindStageCanvasPointerEvents(r.domElement);
    this.stageRenderer = r;
    this._webglContextCount++;
    return r;
  }

  _wireContextEvents(renderer) {
    const el = renderer && renderer.domElement;
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener('webglcontextlost', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      this._contextLost = true;
    });
    el.addEventListener('webglcontextrestored', () => {
      this._contextLost = false;
      for (const rec of this.itemSlots.values()) rec.dirty = true;
    });
  }

  _bindStageCanvasPointerEvents(canvasEl) {
    if (!canvasEl || typeof canvasEl.addEventListener !== 'function') return;
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
      const stageRec = this.activePrimaryStageEl ? this.stageInstances.get(this.activePrimaryStageEl) : null;
      if (!stageRec) return;
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
      if (dist > 7) return; // Orbit drag, not click
      const stageRec = this.activePrimaryStageEl ? this.stageInstances.get(this.activePrimaryStageEl) : null;
      if (!stageRec) return;
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
    this.world.setTurntable(eid, 0.92, 6.5);
    this.world.setHoverFloat(eid, 0, 0.055, 1.15, (eid % 11) * 0.55);

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

    const existing = this.stageInstances.get(stageEl);
    if (existing && existing.kind === kind) {
      existing.built.updateState({ era, originChosen, origin });
      return existing;
    }
    if (existing) {
      existing.built.dispose();
      this.stageInstances.delete(stageEl);
    }

    const renderer = this._ensureStageRenderer();
    const built = buildStageScene3D(kind, this.world, { era, originChosen, origin });
    this._applyIBL(renderer, built.scene);

    // Ensure HUD badge inside stage wrapper (append-only, pointer-events safe)
    if (typeof document !== 'undefined' && stageEl.querySelector && !stageEl.querySelector('.z3d-stage-hud')) {
      const hud = document.createElement('div');
      hud.className = 'z3d-stage-hud';
      const isAr = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'z3d-stage-chip';
      labelSpan.textContent = isAr ? '٣D تفاعلي · اسحب للدوران' : '3D LIVE · DRAG TO ORBIT';
      hud.appendChild(labelSpan);
      stageEl.appendChild(hud);
    }

    const rec = { el: stageEl, kind, built, proxyCanvas: null };
    this.stageInstances.set(stageEl, rec);
    this._assignPrimaryStageHost();
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
      if (r.bottom < -80 || r.top > (window.innerHeight || 900) + 80) return false;
    }
    return true;
  }

  _assignPrimaryStageHost() {
    let viewportEl = null;
    let laidOutEl = null;
    for (const [el] of this.stageInstances.entries()) {
      if (!el.isConnected) {
        const stale = this.stageInstances.get(el);
        if (stale) stale.built.dispose();
        this.stageInstances.delete(el);
        continue;
      }
      if (!laidOutEl && this._isElementLaidOut(el)) {
        laidOutEl = el;
      }
      if (!viewportEl && this._isElementVisible(el)) {
        viewportEl = el;
      }
    }
    const chosenEl = viewportEl || laidOutEl || null;

    if (chosenEl && chosenEl !== this.activePrimaryStageEl && this.stageRenderer) {
      const stageRec = this.stageInstances.get(chosenEl);
      if (stageRec.proxyCanvas && stageRec.proxyCanvas.style) {
        stageRec.proxyCanvas.style.display = 'none';
      }
      const canvas = this.stageRenderer.domElement;
      if (canvas && chosenEl.insertBefore && canvas.parentNode !== chosenEl) {
        chosenEl.insertBefore(canvas, chosenEl.firstChild || null);
      } else if (canvas && chosenEl.appendChild && canvas.parentNode !== chosenEl) {
        chosenEl.appendChild(canvas);
      }
      if (this.stageControls) {
        this.stageControls.dispose();
        this.stageControls = null;
      }
      if (canvas && typeof canvas.addEventListener === 'function' && typeof document !== 'undefined') {
        try {
          const ctrls = new OrbitControls(stageRec.built.camera, canvas);
          ctrls.enableDamping = true;
          ctrls.dampingFactor = 0.065;
          ctrls.enablePan = false;
          ctrls.minDistance = 2.6;
          ctrls.maxDistance = 9.5;
          ctrls.minPolarAngle = 0.28;
          ctrls.maxPolarAngle = Math.PI * 0.47;
          ctrls.target.set(0, 0.82, 0);
          stageRec.built.camera.userData.z3dOrbitActive = true;
          this.stageControls = ctrls;
        } catch (_) {
          this.stageControls = null;
        }
      }
      this.activePrimaryStageEl = chosenEl;
    } else if (!chosenEl) {
      this.activePrimaryStageEl = null;
    }
  }

  _blitSingleItemSlot(rec) {
    if (!rec || !rec.ctx2d) return;
    const renderer = this._ensureItemRenderer();
    this.itemScene.add(rec.mesh);
    renderer.render(this.itemScene, this.itemCamera);
    const calls = renderer.info ? Math.max(1, renderer.info.render.calls) : 1;
    const tris = renderer.info ? renderer.info.render.triangles : 0;
    this._drawCalls = Math.max(this._drawCalls, calls);
    this._triangles = Math.max(this._triangles, tris);
    this.itemScene.remove(rec.mesh);
    try {
      rec.ctx2d.clearRect(0, 0, rec.canvas2d.width, rec.canvas2d.height);
      rec.ctx2d.drawImage(renderer.domElement, 0, 0, rec.canvas2d.width, rec.canvas2d.height);
      rec.dirty = false;
      rec.renderedFrames++;
    } catch (_) {
      // Headless mock canvas ignore
    }
  }

  _renderFrame(_scaledDt, realDt) {
    let frameDrawCalls = 0;
    let frameTriangles = 0;

    // 1. Prune disconnected item slots & blit prioritized visible/dirty item cards
    const slotsArr = [];
    for (const [el, rec] of this.itemSlots.entries()) {
      if (el.isConnected === false) {
        this.world.despawnImmediate(rec.eid);
        this.itemSlots.delete(el);
        continue;
      }
      slotsArr.push(rec);
    }

    let blitsThisFrame = 0;
    const MAX_ITEM_BLITS_PER_FRAME = 6;

    // Priority pass: dirty, dragging, or hovered slots always render immediately
    for (let i = 0; i < slotsArr.length; i++) {
      const rec = slotsArr[i];
      if (rec.dirty || rec.dragging || rec.hovered) {
        this._blitSingleItemSlot(rec);
        frameDrawCalls += this.itemRenderer && this.itemRenderer.info ? Math.max(1, this.itemRenderer.info.render.calls) : 1;
        frameTriangles += this.itemRenderer && this.itemRenderer.info ? this.itemRenderer.info.render.triangles : 0;
        blitsThisFrame++;
      }
    }

    // Ambient turntable pass: smoothly rotate visible on-screen item slots within budget
    if (slotsArr.length > 0 && blitsThisFrame < MAX_ITEM_BLITS_PER_FRAME) {
      for (let step = 0; step < slotsArr.length && blitsThisFrame < MAX_ITEM_BLITS_PER_FRAME; step++) {
        const idx = (this._roundRobinCursor + step) % slotsArr.length;
        const rec = slotsArr[idx];
        if (!rec.dirty && !rec.dragging && !rec.hovered && this._isElementVisible(rec.el)) {
          this._blitSingleItemSlot(rec);
          frameDrawCalls += this.itemRenderer && this.itemRenderer.info ? Math.max(1, this.itemRenderer.info.render.calls) : 1;
          frameTriangles += this.itemRenderer && this.itemRenderer.info ? this.itemRenderer.info.render.triangles : 0;
          blitsThisFrame++;
        }
      }
      this._roundRobinCursor = (this._roundRobinCursor + MAX_ITEM_BLITS_PER_FRAME) % Math.max(1, slotsArr.length);
    }

    // 2. Render Any Secondary Visible Stages via Proxy Canvas, Then Primary Interactive Stage Last
    this._assignPrimaryStageHost();
    if (this.stageRenderer) {
      for (const [el, sRec] of this.stageInstances.entries()) {
        if (el === this.activePrimaryStageEl || !this._isElementVisible(el)) continue;
        if (!sRec.proxyCanvas && typeof document !== 'undefined' && el.insertBefore) {
          const pc = document.createElement('canvas');
          pc.className = 'z3d-stage-proxy-canvas';
          pc.width = 480;
          pc.height = 220;
          el.insertBefore(pc, el.firstChild || null);
          sRec.proxyCanvas = pc;
          sRec.proxyCtx = typeof pc.getContext === 'function' ? pc.getContext('2d') : null;
        }
        if (sRec.proxyCanvas && sRec.proxyCtx) {
          sRec.proxyCanvas.style.display = 'block';
          sRec.built.camera.aspect = sRec.proxyCanvas.width / sRec.proxyCanvas.height;
          sRec.built.camera.updateProjectionMatrix();
          this.stageRenderer.setSize(sRec.proxyCanvas.width, sRec.proxyCanvas.height, false);
          this.stageRenderer.render(sRec.built.scene, sRec.built.camera);
          try {
            sRec.proxyCtx.clearRect(0, 0, sRec.proxyCanvas.width, sRec.proxyCanvas.height);
            sRec.proxyCtx.drawImage(this.stageRenderer.domElement, 0, 0, sRec.proxyCanvas.width, sRec.proxyCanvas.height);
          } catch (_) { /* ignore */ }
        }
      }

      if (this.activePrimaryStageEl) {
        const stageRec = this.stageInstances.get(this.activePrimaryStageEl);
        if (stageRec) {
          if (stageRec.proxyCanvas && stageRec.proxyCanvas.style) {
            stageRec.proxyCanvas.style.display = 'none';
          }
          if (typeof stageRec.el.getBoundingClientRect === 'function') {
            const rect = stageRec.el.getBoundingClientRect();
            const w = Math.max(200, Math.floor(rect.width || 560));
            const h = Math.max(160, Math.floor(rect.height || 235));
            const canvas = this.stageRenderer.domElement;
            if (canvas && (canvas.width !== w || canvas.height !== h)) {
              stageRec.built.camera.aspect = w / h;
              stageRec.built.camera.updateProjectionMatrix();
              this.stageRenderer.setSize(w, h, false);
            }
          }
          if (this.stageControls) {
            this.stageControls.update(realDt);
          }
          this.stageRenderer.render(stageRec.built.scene, stageRec.built.camera);
          if (this.stageRenderer.info) {
            frameDrawCalls += Math.max(1, this.stageRenderer.info.render.calls);
            frameTriangles += this.stageRenderer.info.render.triangles;
          }
        }
      }
    }

    // 3. Render On-Demand Fullscreen 3D Inspector Modal if open
    if (this.inspectorOpen && this.inspectorRenderer && this.inspectorScene && this.inspectorCamera) {
      if (this.inspectorControls) this.inspectorControls.update(realDt);
      this.inspectorRenderer.render(this.inspectorScene, this.inspectorCamera);
      if (this.inspectorRenderer.info) {
        frameDrawCalls += Math.max(1, this.inspectorRenderer.info.render.calls);
        frameTriangles += this.inspectorRenderer.info.render.triangles;
      }
    }

    if (frameDrawCalls > 0) {
      this._drawCalls = frameDrawCalls;
      this._triangles = frameTriangles;
    }
  }

  scan(root = undefined) {
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
            this.world.setStageKinematics(this.inspectorItemEid, ANIM_LUNGE, 0.36, 0, 0.35);
          }
        }
      });

      window.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && this.inspectorOpen) this.closeInspector();
      });
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

    const vp = this.inspectorModalEl.querySelector('.z3d-inspector-viewport');
    if (!this.inspectorRenderer) {
      const r = this.createRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5));
      r.setSize(520, 340, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.2;
      this.inspectorRenderer = r;
      this._webglContextCount++;
      vp.innerHTML = '';
      vp.appendChild(r.domElement);
    }

    if (this.inspectorItemEid >= 0) {
      this.world.despawnImmediate(this.inspectorItemEid);
      this.inspectorItemEid = -1;
    }

    this.inspectorScene = new THREE.Scene();
    addStandardStageLighting(this.inspectorScene, 0x171412, spec.rimColor);
    this._applyIBL(this.inspectorRenderer, this.inspectorScene);

    this.inspectorCamera = new THREE.PerspectiveCamera(40, 520 / 340, 0.1, 40);
    this.inspectorCamera.position.set(0, 1.05, 3.25);

    const mesh = createItemMesh3D(itemId, opts.category || spec.category, opts.rarity || 'legendary');
    mesh.position.set(0, 0.92, 0);
    this.inspectorScene.add(mesh);
    this.inspectorItemEid = this.world.spawnImmediate(mesh);

    if (this.inspectorControls) this.inspectorControls.dispose();
    try {
      this.inspectorControls = new OrbitControls(this.inspectorCamera, this.inspectorRenderer.domElement);
      this.inspectorControls.enableDamping = true;
      this.inspectorControls.autoRotate = true;
      this.inspectorControls.autoRotateSpeed = 2.4;
      this.inspectorControls.target.set(0, 0.85, 0);
    } catch (_) {
      this.inspectorControls = null;
    }

    this.inspectorModalEl.classList.add('is-open');
    this.inspectorOpen = true;
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
    if (this.inspectorRenderer) {
      if (typeof this.inspectorRenderer.forceContextLoss === 'function') {
        try { this.inspectorRenderer.forceContextLoss(); } catch (_) { /* ignore */ }
      }
      if (typeof this.inspectorRenderer.dispose === 'function') {
        try { this.inspectorRenderer.dispose(); } catch (_) { /* ignore */ }
      }
      if (this.inspectorRenderer.domElement && this.inspectorRenderer.domElement.parentNode) {
        this.inspectorRenderer.domElement.parentNode.removeChild(this.inspectorRenderer.domElement);
      }
      this.inspectorRenderer = null;
      this._webglContextCount = Math.max(0, this._webglContextCount - 1);
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

  diagnostics() {
    return {
      ready: true,
      ecsEntities: this.world.aliveCount,
      activeStages: this.stageInstances.size,
      renderedItems: this.itemSlots.size,
      webglContexts: this._webglContextCount,
      drawCalls: this._drawCalls,
      triangles: this._triangles,
      contextLost: this._contextLost,
    };
  }
}

export function createZoneEcs3DRuntime(opts = {}) {
  return new ZoneEcs3DRuntime(opts);
}

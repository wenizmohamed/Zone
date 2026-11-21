/* ==========================================================================
 * ZONE v155 - ZERO-GC GPU INSTANCED PARTICLES, RIBBON TRAILS, DECALS,
 *             CUSTOM LASER SHADERS, SCREEN FX & MOBILE GPU GOVERNOR
 * Exclusive Ownership: @vfx-shaders-3d (assets/ui/zone-vfx-particles.mjs)
 * Local Vendored Three.js r184 ONLY - ZERO External CDN - Zero Per-Frame GC
 * ========================================================================== */

import * as THREE from '../../lib/three184/three.module.js';

export const SHAPE_SOFT_SPARK = 0;
export const SHAPE_RAIN_STREAK = 1;
export const SHAPE_GROUND_RING = 2;
export const SHAPE_MUZZLE_FLASH = 3;
export const SHAPE_SHELL_BRASS = 4;
export const SHAPE_CHALK_PUFF = 5;
export const SHAPE_GOLD_CHIP = 6;

export const DECAL_STYLE_SCORCH = 0;
export const DECAL_STYLE_SLASH = 1;
export const DECAL_STYLE_CHALK_RING = 2;
export const DECAL_STYLE_GOLD_RING = 3;

export const SCREEN_FX_KINDS = Object.freeze([
  'crit-flash',
  'low-hp',
  'stealth-alert',
]);

/* Deterministic xorshift32 PRNG - zero heap allocations */
let _rngSeed = 0x5a3d155;
function nextRand() {
  let x = _rngSeed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  _rngSeed = x | 0;
  return ((x >>> 0) / 4294967296);
}

function randRange(min, max) {
  return min + (max - min) * nextRand();
}

/* --------------------------------------------------------------------------
 * 1. ACCESSIBILITY & MOBILE GPU / LOD BUDGET GOVERNOR (threejs-performance)
 *    - 50% particle count auto-scaling on viewport <= 640px
 *    - Full suppression of rapid motion/flashes when zoneReducedMotion='true'
 *    - Clean stage draw-call budget cap & static shadow freeze
 * -------------------------------------------------------------------------- */
export function isReducedMotion(docRef = undefined) {
  const doc = docRef || (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.documentElement || !doc.documentElement.dataset) return false;
  return doc.documentElement.dataset.zoneReducedMotion === 'true';
}

export function getViewportWidth(overrideWidth = undefined) {
  if (typeof overrideWidth === 'number' && Number.isFinite(overrideWidth) && overrideWidth > 0) {
    return overrideWidth;
  }
  if (typeof globalThis !== 'undefined') {
    if (globalThis.window && typeof globalThis.window.innerWidth === 'number' && globalThis.window.innerWidth > 0) {
      return globalThis.window.innerWidth;
    }
    if (typeof globalThis.innerWidth === 'number' && globalThis.innerWidth > 0) {
      return globalThis.innerWidth;
    }
  }
  return 1280;
}

export function isMobileViewport(overrideWidth = undefined) {
  return getViewportWidth(overrideWidth) <= 640;
}

export function computeParticleBudgetScale(opts = {}) {
  const reduced = opts.reducedMotion !== undefined ? Boolean(opts.reducedMotion) : isReducedMotion(opts.document);
  if (reduced) return 0;
  const vw = getViewportWidth(opts.viewportWidth);
  return vw <= 640 ? 0.5 : 1.0;
}

export class ZoneGpuBudgetGovernor {
  constructor(opts = {}) {
    this.viewportWidth = opts.viewportWidth;
    this.desktopMaxDrawCalls = typeof opts.desktopMaxDrawCalls === 'number' ? opts.desktopMaxDrawCalls : 128;
    this.mobileMaxDrawCalls = typeof opts.mobileMaxDrawCalls === 'number' ? opts.mobileMaxDrawCalls : 64;
    this.degradeLevel = 0;
    this.lastRawDrawCalls = 0;
    this.lastCappedDrawCalls = 0;
  }

  setViewportWidth(width) {
    this.viewportWidth = width;
  }

  get isMobile() {
    return isMobileViewport(this.viewportWidth);
  }

  get reducedMotion() {
    return isReducedMotion();
  }

  get particleScale() {
    const base = computeParticleBudgetScale({ viewportWidth: this.viewportWidth });
    if (base === 0) return 0;
    return this.degradeLevel >= 2 ? base * 0.5 : base;
  }

  get maxStageDrawCalls() {
    return this.isMobile ? this.mobileMaxDrawCalls : this.desktopMaxDrawCalls;
  }

  get maxPixelRatio() {
    return this.isMobile ? 1.0 : 1.5;
  }

  get maxItemBlitsPerFrame() {
    return this.isMobile ? 3 : 6;
  }

  evaluateDrawCalls(rawCalls, stageBuilt = null) {
    const calls = Math.max(0, Number(rawCalls) || 0);
    const budget = this.maxStageDrawCalls;
    this.lastRawDrawCalls = calls;

    let overBudget = false;
    if (calls > budget) {
      overBudget = true;
      this.degradeLevel = Math.min(2, this.degradeLevel + 1);
      if (stageBuilt && stageBuilt.refs) {
        const lights = stageBuilt.refs.lights;
        if (lights && lights.key && lights.key.shadow) {
          lights.key.shadow.autoUpdate = false;
          lights.key.shadow.needsUpdate = true;
        }
        if (stageBuilt.refs.vfx && typeof stageBuilt.refs.vfx.applyBudgetThrottle === 'function') {
          stageBuilt.refs.vfx.applyBudgetThrottle(this.degradeLevel);
        }
      }
    }

    this.lastCappedDrawCalls = Math.min(calls, budget);
    return {
      rawCalls: calls,
      cappedDrawCalls: this.lastCappedDrawCalls,
      maxStageDrawCalls: budget,
      overBudget,
      degradeLevel: this.degradeLevel,
      particleScale: this.particleScale,
    };
  }
}

/* --------------------------------------------------------------------------
 * 2. PARTICLE PRESET CATALOG (All 7 Syndicate Track 2 Presets)
 * -------------------------------------------------------------------------- */
export const PARTICLE_PRESETS = Object.freeze({
  pier_rain: Object.freeze({
    count: 28,
    shape: SHAPE_RAIN_STREAK,
    colorStart: [0.58, 0.78, 0.98],
    colorEnd: [0.38, 0.56, 0.82],
    alphaStart: 0.58,
    alphaEnd: 0.04,
    sizeStart: [0.022, 0.44],
    sizeEnd: [0.016, 0.36],
    lifeMin: 0.42,
    lifeMax: 0.68,
    spread: [4.8, 0.8, 4.2],
    offset: [0, 3.35, 0],
    velMin: [-1.15, -9.8, -0.35],
    velMax: [-0.65, -7.2, 0.25],
    gravity: -2.0,
    drag: 0.0,
    rotMin: -0.11,
    rotMax: -0.07,
    rotVelMin: 0,
    rotVelMax: 0,
    bounceY: 0.02,
    restitution: 0.0,
    rippleOnGround: 1,
  }),

  muzzle_flash: Object.freeze({
    count: 14,
    shape: SHAPE_MUZZLE_FLASH,
    colorStart: [1.0, 0.94, 0.68],
    colorEnd: [1.0, 0.42, 0.08],
    alphaStart: 0.96,
    alphaEnd: 0.0,
    sizeStart: [0.22, 0.22],
    sizeEnd: [0.62, 0.46],
    lifeMin: 0.07,
    lifeMax: 0.14,
    spread: [0.08, 0.08, 0.08],
    offset: [0, 0, 0],
    velMin: [1.4, -0.35, -0.45],
    velMax: [4.2, 0.55, 0.45],
    gravity: 0.0,
    drag: 5.5,
    rotMin: 0,
    rotMax: 6.283,
    rotVelMin: -6.0,
    rotVelMax: 6.0,
    bounceY: -99,
    restitution: 0,
    rippleOnGround: 0,
  }),

  shell_brass: Object.freeze({
    count: 8,
    shape: SHAPE_SHELL_BRASS,
    colorStart: [0.98, 0.78, 0.26],
    colorEnd: [0.78, 0.52, 0.14],
    alphaStart: 0.98,
    alphaEnd: 0.15,
    sizeStart: [0.046, 0.105],
    sizeEnd: [0.044, 0.10],
    lifeMin: 0.75,
    lifeMax: 1.18,
    spread: [0.06, 0.06, 0.06],
    offset: [0, 0, 0],
    velMin: [-0.95, 2.1, 0.65],
    velMax: [-0.25, 3.45, 1.55],
    gravity: -11.4,
    drag: 0.4,
    rotMin: 0,
    rotMax: 6.283,
    rotVelMin: -18.0,
    rotVelMax: 18.0,
    bounceY: 0.03,
    restitution: 0.46,
    rippleOnGround: 0,
  }),

  spark_burst: Object.freeze({
    count: 24,
    shape: SHAPE_SOFT_SPARK,
    colorStart: [1.0, 0.86, 0.45],
    colorEnd: [0.98, 0.28, 0.08],
    alphaStart: 0.95,
    alphaEnd: 0.0,
    sizeStart: [0.065, 0.16],
    sizeEnd: [0.02, 0.05],
    lifeMin: 0.24,
    lifeMax: 0.52,
    spread: [0.14, 0.14, 0.14],
    offset: [0, 0, 0],
    velMin: [-3.4, 0.8, -3.4],
    velMax: [3.4, 4.2, 3.4],
    gravity: -9.2,
    drag: 1.4,
    rotMin: 0,
    rotMax: 6.283,
    rotVelMin: -8.0,
    rotVelMax: 8.0,
    bounceY: 0.02,
    restitution: 0.38,
    rippleOnGround: 0,
  }),

  thermal_sparks: Object.freeze({
    count: 30,
    shape: SHAPE_SOFT_SPARK,
    colorStart: [1.0, 0.92, 0.62],
    colorEnd: [1.0, 0.34, 0.04],
    alphaStart: 0.98,
    alphaEnd: 0.0,
    sizeStart: [0.055, 0.19],
    sizeEnd: [0.018, 0.04],
    lifeMin: 0.32,
    lifeMax: 0.74,
    spread: [0.10, 0.10, 0.10],
    offset: [0, 0, 0],
    velMin: [-2.2, 1.2, 0.5],
    velMax: [2.2, 4.6, 3.4],
    gravity: -10.6,
    drag: 0.9,
    rotMin: -0.8,
    rotMax: 0.8,
    rotVelMin: -10.0,
    rotVelMax: 10.0,
    bounceY: 0.02,
    restitution: 0.50,
    rippleOnGround: 0,
  }),

  chalk_burst: Object.freeze({
    count: 26,
    shape: SHAPE_CHALK_PUFF,
    colorStart: [0.92, 0.97, 0.94],
    colorEnd: [0.29, 0.87, 0.50],
    alphaStart: 0.72,
    alphaEnd: 0.0,
    sizeStart: [0.14, 0.14],
    sizeEnd: [0.48, 0.48],
    lifeMin: 0.44,
    lifeMax: 0.86,
    spread: [0.42, 0.18, 0.42],
    offset: [0, 0.18, 0],
    velMin: [-1.85, 0.45, -1.85],
    velMax: [1.85, 2.35, 1.85],
    gravity: 0.65,
    drag: 2.2,
    rotMin: 0,
    rotMax: 6.283,
    rotVelMin: -2.4,
    rotVelMax: 2.4,
    bounceY: -99,
    restitution: 0,
    rippleOnGround: 0,
  }),

  gold_jackpot: Object.freeze({
    count: 36,
    shape: SHAPE_GOLD_CHIP,
    colorStart: [1.0, 0.86, 0.28],
    colorEnd: [0.96, 0.62, 0.08],
    alphaStart: 0.98,
    alphaEnd: 0.05,
    sizeStart: [0.11, 0.11],
    sizeEnd: [0.08, 0.08],
    lifeMin: 0.88,
    lifeMax: 1.55,
    spread: [0.36, 0.15, 0.36],
    offset: [0, 0.35, 0],
    velMin: [-2.4, 3.2, -2.4],
    velMax: [2.4, 6.1, 2.4],
    gravity: -9.4,
    drag: 0.35,
    rotMin: 0,
    rotMax: 6.283,
    rotVelMin: -14.0,
    rotVelMax: 14.0,
    bounceY: 0.03,
    restitution: 0.54,
    rippleOnGround: 0,
  }),
});

/* --------------------------------------------------------------------------
 * 3. CUSTOM GLSL ES 3.00 SHADERS (Particles, Ribbons, Decals, Laser Grid)
 *    Follows threejs-shaders: ShaderMaterial with glslVersion unset +
 *    #include <tonemapping_fragment> & #include <colorspace_fragment>.
 * -------------------------------------------------------------------------- */
export function createSoftParticleShaderMaterial(opts = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uGlobalOpacity: { value: opts.opacity !== undefined ? opts.opacity : 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aInstPosRot;
      attribute vec4 aInstSizeShape;
      attribute vec4 aInstColorAlpha;

      varying vec2 vUv;
      varying vec4 vColorAlpha;
      varying vec2 vShapeAge;

      void main() {
        vUv = uv;
        vColorAlpha = aInstColorAlpha;
        vShapeAge = aInstSizeShape.zw;

        float angle = aInstPosRot.w;
        float ca = cos(angle);
        float sa = sin(angle);
        vec2 scaled = position.xy * aInstSizeShape.xy;
        vec2 rotXY = vec2(scaled.x * ca - scaled.y * sa, scaled.x * sa + scaled.y * ca);

        if (aInstSizeShape.z > 1.5 && aInstSizeShape.z < 2.5) {
          vec3 groundWorld = aInstPosRot.xyz + vec3(rotXY.x, 0.0, rotXY.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(groundWorld, 1.0);
        } else {
          vec4 mvCenter = modelViewMatrix * vec4(aInstPosRot.xyz, 1.0);
          mvCenter.xy += rotXY;
          gl_Position = projectionMatrix * mvCenter;
        }
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlobalOpacity;
      varying vec2 vUv;
      varying vec4 vColorAlpha;
      varying vec2 vShapeAge;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = dot(p, p);
        float r = sqrt(r2);
        float shape = vShapeAge.x;
        float mask = 0.0;
        vec3 tint = vColorAlpha.rgb;

        if (shape < 0.5) {
          mask = exp(-r2 * 4.6) + 0.55 * exp(-r2 * 16.0);
        } else if (shape < 1.5) {
          float coreX = smoothstep(0.48, 0.04, abs(p.x));
          float tailY = smoothstep(1.0, -0.65, p.y) * smoothstep(-1.0, -0.55, p.y);
          mask = coreX * tailY;
        } else if (shape < 2.5) {
          float ringR = mix(0.24, 0.92, clamp(vShapeAge.y, 0.0, 1.0));
          float ringBand = exp(-pow((r - ringR) * 11.5, 2.0));
          mask = ringBand * smoothstep(1.0, 0.82, r);
        } else if (shape < 3.5) {
          float star = exp(-abs(p.x) * 7.5) * exp(-abs(p.y) * 2.2) + exp(-abs(p.y) * 7.5) * exp(-abs(p.x) * 2.2);
          float cone = exp(-r2 * 3.4);
          mask = clamp(star * 0.85 + cone * 0.75, 0.0, 1.4);
          tint = mix(tint, vec3(1.0, 0.98, 0.90), clamp(exp(-r2 * 9.0), 0.0, 1.0));
        } else if (shape < 4.5) {
          float boxMask = smoothstep(0.62, 0.42, abs(p.x)) * smoothstep(0.95, 0.76, abs(p.y));
          float glint = 0.65 + 0.55 * exp(-pow(p.x * 4.2, 2.0));
          mask = boxMask;
          tint *= glint;
        } else if (shape < 5.5) {
          float puff = smoothstep(1.0, 0.18, r) * (0.62 + 0.38 * smoothstep(0.05, 0.55, r));
          mask = puff;
        } else {
          float coin = smoothstep(0.92, 0.78, r);
          float rim = exp(-pow((r - 0.72) * 14.0, 2.0));
          float shine = 0.75 + 0.45 * smoothstep(-0.4, 0.4, p.x + p.y * 0.5);
          mask = coin;
          tint = tint * shine + vec3(0.35, 0.28, 0.08) * rim;
        }

        float alpha = clamp(mask * vColorAlpha.a * uGlobalOpacity, 0.0, 1.0);
        if (alpha < 0.005) discard;

        gl_FragColor = vec4(tint * alpha, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: opts.blending !== undefined ? opts.blending : THREE.AdditiveBlending,
  });

  mat.customProgramCacheKey = function z3dParticleCacheKey() {
    return 'z3d-vfx-instanced-particle-v155';
  };
  return mat;
}

/* --------------------------------------------------------------------------
 * 4. ZERO-GC FLOAT32ARRAY GPU INSTANCED PARTICLE POOL (ZoneParticlePool)
 * -------------------------------------------------------------------------- */
const MAX_CONTINUOUS_EMITTERS = 8;

export class ZoneParticlePool {
  constructor(opts = {}) {
    this.capacity = Math.max(16, Math.min(2048, opts.maxParticles || 256));
    this.viewportWidth = opts.viewportWidth;
    this.budgetThrottleScale = 1.0;
    this.activeCount = 0;
    this._wasActive = false;

    const cap = this.capacity;
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.pz = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.vz = new Float32Array(cap);
    this.gravity = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.rot = new Float32Array(cap);
    this.rotVel = new Float32Array(cap);
    this.sx0 = new Float32Array(cap);
    this.sy0 = new Float32Array(cap);
    this.sx1 = new Float32Array(cap);
    this.sy1 = new Float32Array(cap);
    this.cr0 = new Float32Array(cap);
    this.cg0 = new Float32Array(cap);
    this.cb0 = new Float32Array(cap);
    this.cr1 = new Float32Array(cap);
    this.cg1 = new Float32Array(cap);
    this.cb1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap);
    this.a1 = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.shape = new Float32Array(cap);
    this.bounceY = new Float32Array(cap);
    this.restitution = new Float32Array(cap);
    this.rippleFlag = new Uint8Array(cap);

    this.instPosRotBuf = new Float32Array(cap * 4);
    this.instSizeShapeBuf = new Float32Array(cap * 4);
    this.instColorAlphaBuf = new Float32Array(cap * 4);

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.attrPosRot = new THREE.InstancedBufferAttribute(this.instPosRotBuf, 4);
    this.attrSizeShape = new THREE.InstancedBufferAttribute(this.instSizeShapeBuf, 4);
    this.attrColorAlpha = new THREE.InstancedBufferAttribute(this.instColorAlphaBuf, 4);
    this.attrPosRot.setUsage(THREE.DynamicDrawUsage);
    this.attrSizeShape.setUsage(THREE.DynamicDrawUsage);
    this.attrColorAlpha.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('aInstPosRot', this.attrPosRot);
    this.geometry.setAttribute('aInstSizeShape', this.attrSizeShape);
    this.geometry.setAttribute('aInstColorAlpha', this.attrColorAlpha);

    this.material = createSoftParticleShaderMaterial(opts);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, cap);
    this.mesh.name = 'z3d-vfx-particle-pool';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;

    this._emitterCount = 0;
    this._emitters = new Array(MAX_CONTINUOUS_EMITTERS);
    for (let i = 0; i < MAX_CONTINUOUS_EMITTERS; i++) {
      this._emitters[i] = {
        active: false,
        presetName: 'pier_rain',
        ratePerSec: 0,
        accumulator: 0,
        x: 0,
        y: 0,
        z: 0,
        dirX: 0,
        dirY: 0,
        dirZ: 0,
      };
    }
  }

  setViewportWidth(w) {
    this.viewportWidth = w;
  }

  getEffectiveScale(overrideOpts = undefined) {
    const base = computeParticleBudgetScale({
      viewportWidth: overrideOpts && overrideOpts.viewportWidth !== undefined ? overrideOpts.viewportWidth : this.viewportWidth,
      reducedMotion: overrideOpts ? overrideOpts.reducedMotion : undefined,
    });
    return base * this.budgetThrottleScale;
  }

  getEffectiveEmitCount(baseCount, overrideOpts = undefined) {
    const scale = this.getEffectiveScale(overrideOpts);
    if (scale <= 0 || baseCount <= 0) return 0;
    return Math.max(1, Math.round(baseCount * scale));
  }

  _allocSlot() {
    if (this.activeCount < this.capacity) {
      return this.activeCount++;
    }
    /* Pool full: recycle oldest slot deterministically (zero GC) */
    return (this.activeCount - 1);
  }

  _spawnGroundRipple(x, y, z, r = 0.62, g = 0.84, b = 1.0, maxRadius = 0.46) {
    if (this.activeCount >= this.capacity) return -1;
    const idx = this.activeCount++;
    this.px[idx] = x;
    this.py[idx] = y + 0.008;
    this.pz[idx] = z;
    this.vx[idx] = 0;
    this.vy[idx] = 0;
    this.vz[idx] = 0;
    this.gravity[idx] = 0;
    this.drag[idx] = 0;
    this.rot[idx] = nextRand() * 6.283;
    this.rotVel[idx] = 0;
    this.sx0[idx] = 0.08;
    this.sy0[idx] = 0.08;
    this.sx1[idx] = maxRadius;
    this.sy1[idx] = maxRadius;
    this.cr0[idx] = r;
    this.cg0[idx] = g;
    this.cb0[idx] = b;
    this.cr1[idx] = r * 0.65;
    this.cg1[idx] = g * 0.75;
    this.cb1[idx] = b;
    this.a0[idx] = 0.56;
    this.a1[idx] = 0.0;
    this.age[idx] = 0;
    this.life[idx] = 0.48;
    this.shape[idx] = SHAPE_GROUND_RING;
    this.bounceY[idx] = -99;
    this.restitution[idx] = 0;
    this.rippleFlag[idx] = 0;
    return idx;
  }

  emit(presetName, opts = {}) {
    const preset = PARTICLE_PRESETS[presetName] || PARTICLE_PRESETS.spark_burst;
    const rawCount = typeof opts.count === 'number' ? opts.count : preset.count;
    const count = this.getEffectiveEmitCount(rawCount, opts);
    if (count <= 0) return 0;

    const ox = (opts.x !== undefined ? opts.x : 0) + preset.offset[0];
    const oy = (opts.y !== undefined ? opts.y : 0) + preset.offset[1];
    const oz = (opts.z !== undefined ? opts.z : 0) + preset.offset[2];
    const dirScale = typeof opts.speedScale === 'number' ? opts.speedScale : 1.0;
    const dirX = opts.dirX || 0;
    const dirY = opts.dirY || 0;
    const dirZ = opts.dirZ || 0;

    let spawned = 0;
    for (let n = 0; n < count; n++) {
      const idx = this._allocSlot();
      this.px[idx] = ox + (nextRand() - 0.5) * preset.spread[0];
      this.py[idx] = oy + (nextRand() - 0.5) * preset.spread[1];
      this.pz[idx] = oz + (nextRand() - 0.5) * preset.spread[2];

      this.vx[idx] = randRange(preset.velMin[0], preset.velMax[0]) * dirScale + dirX;
      this.vy[idx] = randRange(preset.velMin[1], preset.velMax[1]) * dirScale + dirY;
      this.vz[idx] = randRange(preset.velMin[2], preset.velMax[2]) * dirScale + dirZ;

      this.gravity[idx] = preset.gravity;
      this.drag[idx] = preset.drag;
      this.rot[idx] = randRange(preset.rotMin, preset.rotMax);
      this.rotVel[idx] = randRange(preset.rotVelMin, preset.rotVelMax);

      const sJitter = randRange(0.82, 1.22);
      this.sx0[idx] = preset.sizeStart[0] * sJitter;
      this.sy0[idx] = preset.sizeStart[1] * sJitter;
      this.sx1[idx] = preset.sizeEnd[0] * sJitter;
      this.sy1[idx] = preset.sizeEnd[1] * sJitter;

      this.cr0[idx] = preset.colorStart[0];
      this.cg0[idx] = preset.colorStart[1];
      this.cb0[idx] = preset.colorStart[2];
      this.cr1[idx] = preset.colorEnd[0];
      this.cg1[idx] = preset.colorEnd[1];
      this.cb1[idx] = preset.colorEnd[2];

      this.a0[idx] = preset.alphaStart;
      this.a1[idx] = preset.alphaEnd;
      this.age[idx] = 0;
      this.life[idx] = randRange(preset.lifeMin, preset.lifeMax);
      this.shape[idx] = preset.shape;
      this.bounceY[idx] = preset.bounceY;
      this.restitution[idx] = preset.restitution;
      this.rippleFlag[idx] = preset.rippleOnGround;
      spawned++;
    }

    if (presetName === 'chalk_burst') {
      this._spawnGroundRipple(ox, 0.015, oz, 0.45, 0.95, 0.62, 0.92);
    } else if (presetName === 'pier_rain' && count >= 2) {
      this._spawnGroundRipple(
        ox + (nextRand() - 0.5) * 2.8,
        0.015,
        oz + (nextRand() - 0.5) * 2.4,
        0.56,
        0.80,
        1.0,
        0.44
      );
    }

    this._syncGpuBuffers();
    return spawned;
  }

  addContinuousEmitter(presetName, opts = {}) {
    for (let i = 0; i < MAX_CONTINUOUS_EMITTERS; i++) {
      const slot = this._emitters[i];
      if (!slot.active) {
        slot.active = true;
        slot.presetName = presetName;
        slot.ratePerSec = typeof opts.ratePerSec === 'number' ? opts.ratePerSec : 28;
        slot.accumulator = 0;
        slot.x = opts.x || 0;
        slot.y = opts.y || 0;
        slot.z = opts.z || 0;
        slot.dirX = opts.dirX || 0;
        slot.dirY = opts.dirY || 0;
        slot.dirZ = opts.dirZ || 0;
        this._emitterCount++;
        return i;
      }
    }
    return -1;
  }

  _stepContinuousEmitters(dt) {
    if (this._emitterCount === 0 || dt <= 0) return;
    const scale = this.getEffectiveScale();
    if (scale <= 0) return;

    for (let i = 0; i < MAX_CONTINUOUS_EMITTERS; i++) {
      const em = this._emitters[i];
      if (!em.active) continue;
      em.accumulator += dt * em.ratePerSec * scale;
      const toSpawn = Math.floor(em.accumulator);
      if (toSpawn <= 0) continue;
      em.accumulator -= toSpawn;

      const preset = PARTICLE_PRESETS[em.presetName] || PARTICLE_PRESETS.pier_rain;
      const ox = em.x + preset.offset[0];
      const oy = em.y + preset.offset[1];
      const oz = em.z + preset.offset[2];
      const capped = Math.min(toSpawn, 16);

      for (let k = 0; k < capped; k++) {
        if (this.activeCount >= this.capacity) break;
        const idx = this.activeCount++;
        this.px[idx] = ox + (nextRand() - 0.5) * preset.spread[0];
        this.py[idx] = oy + (nextRand() - 0.5) * preset.spread[1];
        this.pz[idx] = oz + (nextRand() - 0.5) * preset.spread[2];
        this.vx[idx] = randRange(preset.velMin[0], preset.velMax[0]) + em.dirX;
        this.vy[idx] = randRange(preset.velMin[1], preset.velMax[1]) + em.dirY;
        this.vz[idx] = randRange(preset.velMin[2], preset.velMax[2]) + em.dirZ;
        this.gravity[idx] = preset.gravity;
        this.drag[idx] = preset.drag;
        this.rot[idx] = randRange(preset.rotMin, preset.rotMax);
        this.rotVel[idx] = randRange(preset.rotVelMin, preset.rotVelMax);
        this.sx0[idx] = preset.sizeStart[0];
        this.sy0[idx] = preset.sizeStart[1];
        this.sx1[idx] = preset.sizeEnd[0];
        this.sy1[idx] = preset.sizeEnd[1];
        this.cr0[idx] = preset.colorStart[0];
        this.cg0[idx] = preset.colorStart[1];
        this.cb0[idx] = preset.colorStart[2];
        this.cr1[idx] = preset.colorEnd[0];
        this.cg1[idx] = preset.colorEnd[1];
        this.cb1[idx] = preset.colorEnd[2];
        this.a0[idx] = preset.alphaStart;
        this.a1[idx] = preset.alphaEnd;
        this.age[idx] = 0;
        this.life[idx] = randRange(preset.lifeMin, preset.lifeMax);
        this.shape[idx] = preset.shape;
        this.bounceY[idx] = preset.bounceY;
        this.restitution[idx] = preset.restitution;
        this.rippleFlag[idx] = preset.rippleOnGround;
      }
    }
  }

  _swapRemove(idx) {
    const last = --this.activeCount;
    if (idx !== last && last >= 0) {
      this.px[idx] = this.px[last];
      this.py[idx] = this.py[last];
      this.pz[idx] = this.pz[last];
      this.vx[idx] = this.vx[last];
      this.vy[idx] = this.vy[last];
      this.vz[idx] = this.vz[last];
      this.gravity[idx] = this.gravity[last];
      this.drag[idx] = this.drag[last];
      this.rot[idx] = this.rot[last];
      this.rotVel[idx] = this.rotVel[last];
      this.sx0[idx] = this.sx0[last];
      this.sy0[idx] = this.sy0[last];
      this.sx1[idx] = this.sx1[last];
      this.sy1[idx] = this.sy1[last];
      this.cr0[idx] = this.cr0[last];
      this.cg0[idx] = this.cg0[last];
      this.cb0[idx] = this.cb0[last];
      this.cr1[idx] = this.cr1[last];
      this.cg1[idx] = this.cg1[last];
      this.cb1[idx] = this.cb1[last];
      this.a0[idx] = this.a0[last];
      this.a1[idx] = this.a1[last];
      this.age[idx] = this.age[last];
      this.life[idx] = this.life[last];
      this.shape[idx] = this.shape[last];
      this.bounceY[idx] = this.bounceY[last];
      this.restitution[idx] = this.restitution[last];
      this.rippleFlag[idx] = this.rippleFlag[last];
    }
  }

  _syncGpuBuffers() {
    const n = this.activeCount;
    const posBuf = this.instPosRotBuf;
    const sizeBuf = this.instSizeShapeBuf;
    const colBuf = this.instColorAlphaBuf;

    for (let i = 0; i < n; i++) {
      const u = Math.min(1.0, Math.max(0.0, this.age[i] / Math.max(0.0001, this.life[i])));
      const o = i * 4;
      posBuf[o + 0] = this.px[i];
      posBuf[o + 1] = this.py[i];
      posBuf[o + 2] = this.pz[i];
      posBuf[o + 3] = this.rot[i];

      sizeBuf[o + 0] = this.sx0[i] + (this.sx1[i] - this.sx0[i]) * u;
      sizeBuf[o + 1] = this.sy0[i] + (this.sy1[i] - this.sy0[i]) * u;
      sizeBuf[o + 2] = this.shape[i];
      sizeBuf[o + 3] = u;

      colBuf[o + 0] = this.cr0[i] + (this.cr1[i] - this.cr0[i]) * u;
      colBuf[o + 1] = this.cg0[i] + (this.cg1[i] - this.cg0[i]) * u;
      colBuf[o + 2] = this.cb0[i] + (this.cb1[i] - this.cb0[i]) * u;
      const smoothFade = 1.0 - u * u;
      colBuf[o + 3] = (this.a0[i] + (this.a1[i] - this.a0[i]) * u) * smoothFade;
    }

    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0 || this._wasActive) {
      this.attrPosRot.needsUpdate = true;
      this.attrSizeShape.needsUpdate = true;
      this.attrColorAlpha.needsUpdate = true;
      this._wasActive = n > 0;
    }
  }

  update(dt, reducedMotion = false) {
    if (reducedMotion) {
      if (this.activeCount > 0) this.clear();
      return 0;
    }
    const stepDt = Math.min(Math.max(dt, 0), 0.1);
    if (stepDt <= 0) return this.activeCount;

    this._stepContinuousEmitters(stepDt);

    let i = 0;
    while (i < this.activeCount) {
      const nextAge = this.age[i] + stepDt;
      if (nextAge >= this.life[i]) {
        this._swapRemove(i);
        continue;
      }
      this.age[i] = nextAge;

      const damp = this.drag[i] > 0 ? Math.max(0, 1.0 - this.drag[i] * stepDt) : 1.0;
      this.vx[i] *= damp;
      this.vy[i] = this.vy[i] * damp + this.gravity[i] * stepDt;
      this.vz[i] *= damp;

      this.px[i] += this.vx[i] * stepDt;
      this.py[i] += this.vy[i] * stepDt;
      this.pz[i] += this.vz[i] * stepDt;
      this.rot[i] += this.rotVel[i] * stepDt;

      const by = this.bounceY[i];
      if (by > -50 && this.py[i] <= by) {
        if (this.rippleFlag[i] === 1) {
          const rx = this.px[i];
          const rz = this.pz[i];
          this._swapRemove(i);
          this._spawnGroundRipple(rx, by, rz, 0.58, 0.82, 1.0, 0.42);
          continue;
        }
        this.py[i] = by;
        this.vy[i] = Math.abs(this.vy[i]) * this.restitution[i];
        this.vx[i] *= 0.78;
        this.vz[i] *= 0.78;
      }
      i++;
    }

    this._syncGpuBuffers();
    return this.activeCount;
  }

  clear() {
    this.activeCount = 0;
    this._syncGpuBuffers();
  }

  dispose() {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* --------------------------------------------------------------------------
 * 5. DYNAMIC VERTEX-UPDATED RIBBON TRAIL (`blade_ribbon` - trail-effects)
 *    Zero-GC pre-allocated ribbon buffer for melee slashes & drift tire arcs
 * -------------------------------------------------------------------------- */
export class RibbonTrail {
  constructor(opts = {}) {
    this.maxNodes = Math.max(4, Math.min(64, opts.maxNodes || 22));
    this.nodeLifetime = typeof opts.lifetime === 'number' ? opts.lifetime : 0.34;
    this.halfWidth = typeof opts.width === 'number' ? opts.width * 0.5 : 0.14;
    this.activeNodes = 0;

    const maxN = this.maxNodes;
    this._hx = new Float32Array(maxN);
    this._hy = new Float32Array(maxN);
    this._hz = new Float32Array(maxN);
    this._tx = new Float32Array(maxN);
    this._ty = new Float32Array(maxN);
    this._tz = new Float32Array(maxN);
    this._age = new Float32Array(maxN);
    this._life = new Float32Array(maxN);

    const vertCount = maxN * 2;
    this._positions = new Float32Array(vertCount * 3);
    this._uvs = new Float32Array(vertCount * 2);
    this._alphas = new Float32Array(vertCount);

    for (let i = 0; i < maxN; i++) {
      const u = i / (maxN - 1);
      this._uvs[i * 4 + 0] = u;
      this._uvs[i * 4 + 1] = 0;
      this._uvs[i * 4 + 2] = u;
      this._uvs[i * 4 + 3] = 1;
    }

    const indices = new Uint16Array((maxN - 1) * 6);
    for (let i = 0; i < maxN - 1; i++) {
      const v = i * 2;
      const o = i * 6;
      indices[o + 0] = v;
      indices[o + 1] = v + 1;
      indices[o + 2] = v + 2;
      indices[o + 3] = v + 1;
      indices[o + 4] = v + 3;
      indices[o + 5] = v + 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this._positions, 3);
    this.uvAttr = new THREE.BufferAttribute(this._uvs, 2);
    this.alphaAttr = new THREE.BufferAttribute(this._alphas, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('uv', this.uvAttr);
    this.geometry.setAttribute('aTrailAlpha', this.alphaAttr);
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);

    const coreColor = new THREE.Color(opts.color !== undefined ? opts.color : 0x38bdf8);
    const edgeColor = new THREE.Color(opts.edgeColor !== undefined ? opts.edgeColor : 0xfbbf24);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCoreColor: { value: coreColor },
        uEdgeColor: { value: edgeColor },
      },
      vertexShader: /* glsl */ `
        attribute float aTrailAlpha;
        varying vec2 vUv;
        varying float vAlpha;

        void main() {
          vUv = uv;
          vAlpha = aTrailAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCoreColor;
        uniform vec3 uEdgeColor;
        varying vec2 vUv;
        varying float vAlpha;

        void main() {
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float core = exp(-crossDist * crossDist * 5.0);
          float rim = smoothstep(1.0, 0.25, crossDist);
          vec3 col = mix(uEdgeColor, uCoreColor, core);
          float a = clamp(rim * vAlpha, 0.0, 1.0);
          if (a < 0.005) discard;
          gl_FragColor = vec4(col * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.material.customProgramCacheKey = function z3dRibbonCacheKey() {
      return 'z3d-vfx-ribbon-trail-v155';
    };

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'z3d-vfx-blade-ribbon';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 11;

    /* Pre-allocated slash arc sweep state (zero GC) */
    this._slashActive = false;
    this._slashTimer = 0;
    this._slashDuration = 0.22;
    this._slashStepEmitted = 0;
    this._slashTotalSteps = 14;
    this._slashCx = 0;
    this._slashCy = 1.0;
    this._slashCz = 0;
    this._slashRadius = 0.95;
    this._slashStartAng = -1.25;
    this._slashEndAng = 1.35;
    this._slashTilt = 0.28;
  }

  setColors(coreHex, edgeHex) {
    this.material.uniforms.uCoreColor.value.set(coreHex);
    if (edgeHex !== undefined) this.material.uniforms.uEdgeColor.value.set(edgeHex);
  }

  pushSegmentEdge(hx, hy, hz, tx, ty, tz, life = this.nodeLifetime) {
    const maxN = this.maxNodes;
    const limit = Math.min(this.activeNodes, maxN - 1);
    for (let i = limit; i > 0; i--) {
      this._hx[i] = this._hx[i - 1];
      this._hy[i] = this._hy[i - 1];
      this._hz[i] = this._hz[i - 1];
      this._tx[i] = this._tx[i - 1];
      this._ty[i] = this._ty[i - 1];
      this._tz[i] = this._tz[i - 1];
      this._age[i] = this._age[i - 1];
      this._life[i] = this._life[i - 1];
    }
    this._hx[0] = hx;
    this._hy[0] = hy;
    this._hz[0] = hz;
    this._tx[0] = tx;
    this._ty[0] = ty;
    this._tz[0] = tz;
    this._age[0] = 0;
    this._life[0] = Math.max(0.04, life);
    if (this.activeNodes < maxN) this.activeNodes++;
    this._rebuildVertices();
  }

  pushPoint(x, y, z, upX = 0, upY = 1, upZ = 0, halfW = this.halfWidth) {
    this.pushSegmentEdge(
      x + upX * halfW,
      y + upY * halfW,
      z + upZ * halfW,
      x - upX * halfW,
      y - upY * halfW,
      z - upZ * halfW,
      this.nodeLifetime
    );
  }

  triggerSlashArc(opts = {}) {
    if (isReducedMotion(opts.document)) return false;
    this.clear();
    this._slashActive = true;
    this._slashTimer = 0;
    this._slashDuration = typeof opts.duration === 'number' ? opts.duration : 0.22;
    this._slashStepEmitted = 0;
    const isMob = isMobileViewport(opts.viewportWidth);
    this._slashTotalSteps = isMob ? Math.min(10, this.maxNodes - 1) : Math.min(16, this.maxNodes - 1);
    this._slashCx = opts.x !== undefined ? opts.x : 0;
    this._slashCy = opts.y !== undefined ? opts.y : 1.02;
    this._slashCz = opts.z !== undefined ? opts.z : 0.15;
    this._slashRadius = opts.radius !== undefined ? opts.radius : 0.92;
    this._slashStartAng = opts.startAngle !== undefined ? opts.startAngle : -1.35;
    this._slashEndAng = opts.endAngle !== undefined ? opts.endAngle : 1.35;
    this._slashTilt = opts.tilt !== undefined ? opts.tilt : 0.32;
    if (opts.color !== undefined) this.setColors(opts.color, opts.edgeColor !== undefined ? opts.edgeColor : 0xffffff);

    /* Seed initial two nodes immediately so ribbon renders on frame 0 */
    this._emitSlashSamplesUpTo(2);
    return true;
  }

  _emitSlashSamplesUpTo(targetStep) {
    const total = Math.max(2, this._slashTotalSteps);
    const rInner = this._slashRadius * 0.64;
    const rOuter = this._slashRadius;
    while (this._slashStepEmitted < targetStep && this._slashStepEmitted <= total) {
      const u = this._slashStepEmitted / total;
      const ang = this._slashStartAng + (this._slashEndAng - this._slashStartAng) * u;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const ySwing = Math.sin((u - 0.5) * Math.PI) * this._slashTilt;
      this.pushSegmentEdge(
        this._slashCx + ca * rOuter,
        this._slashCy + ySwing + 0.08,
        this._slashCz + sa * rOuter,
        this._slashCx + ca * rInner,
        this._slashCy + ySwing - 0.08,
        this._slashCz + sa * rInner,
        this.nodeLifetime
      );
      this._slashStepEmitted++;
    }
  }

  _rebuildVertices() {
    const n = this.activeNodes;
    if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      this.mesh.visible = false;
      return;
    }

    const pos = this._positions;
    const alp = this._alphas;
    for (let i = 0; i < n; i++) {
      const lifeU = Math.min(1.0, this._age[i] / Math.max(0.001, this._life[i]));
      const lenTaper = 1.0 - (i / Math.max(1, n - 1));
      const a = Math.max(0, (1.0 - lifeU) * lenTaper);

      const vOff = i * 6;
      pos[vOff + 0] = this._hx[i];
      pos[vOff + 1] = this._hy[i];
      pos[vOff + 2] = this._hz[i];
      pos[vOff + 3] = this._tx[i];
      pos[vOff + 4] = this._ty[i];
      pos[vOff + 5] = this._tz[i];

      alp[i * 2 + 0] = a;
      alp[i * 2 + 1] = a;
    }

    this.geometry.setDrawRange(0, (n - 1) * 6);
    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.mesh.visible = true;
  }

  update(dt, reducedMotion = false) {
    if (reducedMotion) {
      if (this.activeNodes > 0) this.clear();
      return 0;
    }
    const stepDt = Math.min(Math.max(dt, 0), 0.1);
    if (stepDt <= 0) return this.activeNodes;

    if (this._slashActive) {
      this._slashTimer += stepDt;
      const u = Math.min(1.0, this._slashTimer / Math.max(0.01, this._slashDuration));
      const targetStep = Math.ceil(u * this._slashTotalSteps);
      this._emitSlashSamplesUpTo(targetStep);
      if (u >= 1.0) this._slashActive = false;
    }

    if (this.activeNodes === 0) return 0;

    let alive = 0;
    for (let i = 0; i < this.activeNodes; i++) {
      this._age[i] += stepDt;
      if (this._age[i] < this._life[i]) {
        alive = i + 1;
      }
    }
    this.activeNodes = alive;
    this._rebuildVertices();
    return this.activeNodes;
  }

  clear() {
    this.activeNodes = 0;
    this._slashActive = false;
    this.geometry.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  dispose() {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* --------------------------------------------------------------------------
 * 6. PROJECTED FLOOR DECAL POOL (`impact_decal` - decal-systems)
 *    Single InstancedMesh + polygonOffset eliminates z-fighting on stage floors
 * -------------------------------------------------------------------------- */
export const DECAL_PRESETS = Object.freeze({
  scorch: { style: DECAL_STYLE_SCORCH, color: [1.0, 0.42, 0.08], radius: 0.68, life: 2.4 },
  slash: { style: DECAL_STYLE_SLASH, color: [0.22, 0.78, 0.98], radius: 0.82, life: 2.0 },
  chalk_ring: { style: DECAL_STYLE_CHALK_RING, color: [0.35, 0.92, 0.56], radius: 0.88, life: 1.8 },
  gold_ring: { style: DECAL_STYLE_GOLD_RING, color: [0.98, 0.78, 0.22], radius: 1.08, life: 2.6 },
  impact_decal: { style: DECAL_STYLE_SCORCH, color: [1.0, 0.48, 0.12], radius: 0.72, life: 2.2 },
});

export class ZoneDecalPool {
  constructor(opts = {}) {
    this.capacity = Math.max(4, Math.min(64, opts.maxDecals || 20));
    this.activeCount = 0;
    this._overwriteCursor = 0;
    this._wasActive = false;

    const cap = this.capacity;
    this.dx = new Float32Array(cap);
    this.dy = new Float32Array(cap);
    this.dz = new Float32Array(cap);
    this.yaw = new Float32Array(cap);
    this.radius = new Float32Array(cap);
    this.style = new Float32Array(cap);
    this.cr = new Float32Array(cap);
    this.cg = new Float32Array(cap);
    this.cb = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);

    this.instPoseBuf = new Float32Array(cap * 4);
    this.instMetaBuf = new Float32Array(cap * 4);
    this.instColorBuf = new Float32Array(cap * 4);

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.attrPose = new THREE.InstancedBufferAttribute(this.instPoseBuf, 4);
    this.attrMeta = new THREE.InstancedBufferAttribute(this.instMetaBuf, 4);
    this.attrColor = new THREE.InstancedBufferAttribute(this.instColorBuf, 4);
    this.attrPose.setUsage(THREE.DynamicDrawUsage);
    this.attrMeta.setUsage(THREE.DynamicDrawUsage);
    this.attrColor.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('aDecalPose', this.attrPose);
    this.geometry.setAttribute('aDecalMeta', this.attrMeta);
    this.geometry.setAttribute('aDecalColor', this.attrColor);

    this.material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aDecalPose;
        attribute vec4 aDecalMeta;
        attribute vec4 aDecalColor;

        varying vec2 vUv;
        varying vec4 vMeta;
        varying vec4 vColor;

        void main() {
          vUv = uv;
          vMeta = aDecalMeta;
          vColor = aDecalColor;

          float c = cos(aDecalPose.w);
          float s = sin(aDecalPose.w);
          vec2 local = position.xy * (aDecalMeta.x * 2.0);
          vec2 rotXZ = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
          vec3 worldPos = vec3(aDecalPose.x + rotXZ.x, aDecalPose.y, aDecalPose.z + rotXZ.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec4 vMeta;
        varying vec4 vColor;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float style = vMeta.y;
          float u = vMeta.z;
          float fade = 1.0 - smoothstep(0.35, 1.0, u);
          vec3 col = vColor.rgb;
          float alpha = 0.0;

          if (style < 0.5) {
            float charCore = smoothstep(0.82, 0.12, r);
            float emberRim = exp(-pow((r - 0.56) * 9.0, 2.0)) * (1.0 - u);
            col = mix(vec3(0.05, 0.04, 0.03), vColor.rgb, emberRim * 1.4);
            alpha = (charCore * 0.68 + emberRim * 0.65) * fade;
          } else if (style < 1.5) {
            float d1 = abs(p.y - p.x * 0.35 - 0.12);
            float d2 = abs(p.y - p.x * 0.35 + 0.14);
            float lenMask = smoothstep(0.95, 0.25, abs(p.x));
            float cut = (smoothstep(0.09, 0.01, d1) + smoothstep(0.08, 0.01, d2)) * lenMask;
            alpha = clamp(cut, 0.0, 1.0) * 0.85 * fade;
          } else {
            float expandR = mix(0.38, 0.88, clamp(u * 1.4, 0.0, 1.0));
            float ring = exp(-pow((r - expandR) * 11.0, 2.0)) + 0.35 * exp(-pow((r - expandR * 0.62) * 12.0, 2.0));
            alpha = clamp(ring, 0.0, 1.0) * 0.78 * fade;
          }

          if (alpha < 0.005) discard;
          gl_FragColor = vec4(col, alpha * vColor.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    this.material.customProgramCacheKey = function z3dDecalCacheKey() {
      return 'z3d-vfx-floor-decal-v155';
    };

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, cap);
    this.mesh.name = 'z3d-vfx-decal-pool';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  spawnDecal(presetName = 'impact_decal', x = 0, z = 0, opts = {}) {
    const preset = DECAL_PRESETS[presetName] || DECAL_PRESETS.impact_decal;
    let idx;
    if (this.activeCount < this.capacity) {
      idx = this.activeCount++;
    } else {
      idx = this._overwriteCursor % this.capacity;
      this._overwriteCursor++;
    }

    this.dx[idx] = x;
    this.dy[idx] = opts.y !== undefined ? opts.y : 0.014;
    this.dz[idx] = z;
    this.yaw[idx] = opts.yaw !== undefined ? opts.yaw : nextRand() * Math.PI * 2;
    this.radius[idx] = opts.radius !== undefined ? opts.radius : preset.radius;
    this.style[idx] = opts.style !== undefined ? opts.style : preset.style;
    this.cr[idx] = preset.color[0];
    this.cg[idx] = preset.color[1];
    this.cb[idx] = preset.color[2];
    this.age[idx] = 0;
    this.life[idx] = opts.life !== undefined ? opts.life : preset.life;

    this._syncGpuBuffers();
    return idx;
  }

  _swapRemove(idx) {
    const last = --this.activeCount;
    if (idx !== last && last >= 0) {
      this.dx[idx] = this.dx[last];
      this.dy[idx] = this.dy[last];
      this.dz[idx] = this.dz[last];
      this.yaw[idx] = this.yaw[last];
      this.radius[idx] = this.radius[last];
      this.style[idx] = this.style[last];
      this.cr[idx] = this.cr[last];
      this.cg[idx] = this.cg[last];
      this.cb[idx] = this.cb[last];
      this.age[idx] = this.age[last];
      this.life[idx] = this.life[last];
    }
  }

  _syncGpuBuffers() {
    const n = this.activeCount;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const u = Math.min(1.0, this.age[i] / Math.max(0.001, this.life[i]));
      this.instPoseBuf[o + 0] = this.dx[i];
      this.instPoseBuf[o + 1] = this.dy[i];
      this.instPoseBuf[o + 2] = this.dz[i];
      this.instPoseBuf[o + 3] = this.yaw[i];

      this.instMetaBuf[o + 0] = this.radius[i];
      this.instMetaBuf[o + 1] = this.style[i];
      this.instMetaBuf[o + 2] = u;
      this.instMetaBuf[o + 3] = 1.0;

      this.instColorBuf[o + 0] = this.cr[i];
      this.instColorBuf[o + 1] = this.cg[i];
      this.instColorBuf[o + 2] = this.cb[i];
      this.instColorBuf[o + 3] = 1.0;
    }

    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0 || this._wasActive) {
      this.attrPose.needsUpdate = true;
      this.attrMeta.needsUpdate = true;
      this.attrColor.needsUpdate = true;
      this._wasActive = n > 0;
    }
  }

  update(dt) {
    const stepDt = Math.min(Math.max(dt, 0), 0.1);
    if (stepDt <= 0 || this.activeCount === 0) return this.activeCount;

    let i = 0;
    while (i < this.activeCount) {
      this.age[i] += stepDt;
      if (this.age[i] >= this.life[i]) {
        this._swapRemove(i);
        continue;
      }
      i++;
    }
    this._syncGpuBuffers();
    return this.activeCount;
  }

  clear() {
    this.activeCount = 0;
    this._syncGpuBuffers();
  }

  dispose() {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* --------------------------------------------------------------------------
 * 7. ANIMATED GLSL SECURITY LASER GRID (`laser_grid` for heist-breach)
 * -------------------------------------------------------------------------- */
export function createSecurityLaserGrid3D(opts = {}) {
  const width = opts.width || 2.65;
  const height = opts.height || 1.45;

  const uniforms = {
    uTime: { value: 0 },
    uAlert: { value: 0 },
    uColor: { value: new THREE.Color(opts.color !== undefined ? opts.color : 0xff1e42) },
    uAlertColor: { value: new THREE.Color(opts.alertColor !== undefined ? opts.alertColor : 0xfbbf24) },
    uScanSpeed: { value: typeof opts.scanSpeed === 'number' ? opts.scanSpeed : 1.65 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAlert;
      uniform vec3 uColor;
      uniform vec3 uAlertColor;
      uniform float uScanSpeed;
      varying vec2 vUv;

      void main() {
        float speed = uScanSpeed * (1.0 + uAlert * 1.8);
        float sweep = fract(uTime * speed * 0.35);
        float scanWave = exp(-pow((vUv.y - sweep) * 9.5, 2.0));

        float lineY = fract(vUv.y * 4.0 + sin(uTime * speed + vUv.x * 3.14159) * 0.08);
        float beamH = exp(-pow((lineY - 0.5) * 18.0, 2.0));

        float diag = fract((vUv.x * 2.0 + vUv.y) * 2.0 - uTime * speed * 0.15);
        float beamDiag = exp(-pow((diag - 0.5) * 24.0, 2.0)) * 0.55;

        float edgeFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float intensity = (beamH * 0.92 + beamDiag + scanWave * 0.48) * edgeFade;
        vec3 col = mix(uColor, uAlertColor, clamp(uAlert * 0.65 + scanWave * 0.3, 0.0, 1.0));
        float alpha = clamp(intensity * (0.72 + uAlert * 0.28), 0.0, 0.95);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(col * (1.15 + uAlert * 0.45), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  material.customProgramCacheKey = function z3dLaserGridCacheKey() {
    return 'z3d-vfx-laser-grid-v155';
  };

  const group = new THREE.Group();
  group.name = 'z3d-vfx-laser-grid';

  const primaryPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  primaryPlane.position.set(0, 0.82, -0.35);

  const crossPlane = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.88, height * 0.86), material);
  crossPlane.position.set(0, 0.80, -0.52);
  crossPlane.rotation.y = 0.22;

  group.add(primaryPlane, crossPlane);

  const controller = {
    group,
    material,
    uniforms,
    pulseAlert(level = 1.0) {
      uniforms.uAlert.value = Math.min(1.0, Math.max(uniforms.uAlert.value, level));
    },
    update(dt, reducedMotion = false) {
      if (!reducedMotion) {
        uniforms.uTime.value += Math.max(0, dt);
      }
      if (uniforms.uAlert.value > 0) {
        uniforms.uAlert.value = Math.max(0, uniforms.uAlert.value - Math.max(0, dt) * 1.35);
      }
    },
    dispose() {
      primaryPlane.geometry.dispose();
      crossPlane.geometry.dispose();
      material.dispose();
    },
  };

  group.userData.z3dLaserGrid = controller;
  return controller;
}

/* --------------------------------------------------------------------------
 * 8. STAGE VFX CONTROLLER (Wires Pool + Ribbons + Decals + Laser per Stage)
 * -------------------------------------------------------------------------- */
export function createStageVfxController(stageKind, scene, opts = {}) {
  const isMob = isMobileViewport(opts.viewportWidth);
  const pool = new ZoneParticlePool({
    maxParticles: isMob ? 128 : 256,
    viewportWidth: opts.viewportWidth,
  });
  const decals = new ZoneDecalPool({
    maxDecals: isMob ? 12 : 20,
  });
  const bladeRibbon = new RibbonTrail({
    maxNodes: isMob ? 14 : 22,
    lifetime: 0.30,
    width: 0.26,
    color: stageKind === 'combat-arena' ? 0x38bdf8 : 0xfbbf24,
    edgeColor: 0xf43f5e,
  });

  scene.add(pool.mesh);
  scene.add(decals.mesh);
  scene.add(bladeRibbon.mesh);

  const driftTrails = [];
  let driftCars = null;
  let laserCtrl = null;

  if (stageKind === 'safehouse-empire') {
    pool.addContinuousEmitter('pier_rain', { ratePerSec: 36, x: 0, y: 0, z: 0.2 });
  } else if (stageKind === 'heist-breach') {
    pool.addContinuousEmitter('thermal_sparks', { ratePerSec: 12, x: -0.15, y: 0.96, z: -1.06 });
  } else if (stageKind === 'casino-royale') {
    pool.addContinuousEmitter('gold_jackpot', { ratePerSec: 6, x: 0.1, y: 0.5, z: 0 });
  }

  function attachLaserGrid(ctrl) {
    laserCtrl = ctrl;
  }

  function attachDriftCars(carsArray) {
    driftCars = carsArray;
    const trailColors = [0x22c55e, 0x38bdf8, 0xf43f5e];
    for (let i = 0; i < carsArray.length; i++) {
      const rt = new RibbonTrail({
        maxNodes: isMob ? 12 : 18,
        lifetime: 0.42,
        width: 0.18,
        color: trailColors[i % trailColors.length],
        edgeColor: 0xfbbf24,
      });
      scene.add(rt.mesh);
      driftTrails.push(rt);
    }
  }

  function triggerAction(actionName = 'pulse', payload = {}) {
    const act = String(actionName || 'pulse').toLowerCase();

    if (stageKind === 'safehouse-empire') {
      if (/(era|breakthrough|ascend|jackpot)/.test(act)) {
        pool.emit('gold_jackpot', { x: 0, y: 0.45, z: 0.35 });
        decals.spawnDecal('gold_ring', 0, 0.35);
      } else if (/(attack|fire|shoot|nemesis|confront)/.test(act)) {
        pool.emit('muzzle_flash', { x: -0.55, y: 0.92, z: 0.52, dirX: 2.8 });
        pool.emit('shell_brass', { x: -0.72, y: 0.95, z: 0.58 });
        pool.emit('spark_burst', { x: 1.25, y: 0.95, z: 0.38 });
        decals.spawnDecal('scorch', 1.25, 0.38);
      } else if (/slash|melee/.test(act)) {
        bladeRibbon.triggerSlashArc({ x: 0.2, y: 0.95, z: 0.45, color: 0x38bdf8, edgeColor: 0xfbbf24 });
        decals.spawnDecal('slash', 0.2, 0.45);
      } else {
        pool.emit('pier_rain', { count: 16, x: 0, y: 0, z: 0.3 });
        pool.emit('spark_burst', { count: 14, x: 0.15, y: 0.68, z: 0.48 });
      }
    } else if (stageKind === 'heist-breach') {
      pool.emit('thermal_sparks', { x: -0.1, y: 0.98, z: -1.04 });
      decals.spawnDecal('scorch', -0.1, -0.82);
      if (laserCtrl) laserCtrl.pulseAlert(1.0);
    } else if (stageKind === 'gym-ironpit') {
      const isStr = /str|punch|hook|bag/.test(act) || (payload && payload.stat === 'str');
      pool.emit('chalk_burst', { x: isStr ? -1.85 : 0, y: isStr ? 0.95 : 0.35, z: isStr ? -0.35 : 0.68 });
      decals.spawnDecal('chalk_ring', 0, 0.68);
    } else if (stageKind === 'combat-arena') {
      if (/(slash|melee|knife|katana|razor)/.test(act) || (payload && payload.weaponCat === 'melee')) {
        bladeRibbon.triggerSlashArc({ x: 0.0, y: 1.02, z: 0.08, radius: 1.15, color: 0x38bdf8, edgeColor: 0xf43f5e });
        pool.emit('spark_burst', { x: 1.15, y: 1.0, z: -0.12 });
        decals.spawnDecal('slash', 1.12, -0.12);
      } else {
        pool.emit('muzzle_flash', { x: -0.82, y: 0.98, z: 0.22, dirX: 3.4 });
        pool.emit('shell_brass', { x: -1.12, y: 1.02, z: 0.32 });
        pool.emit('spark_burst', { x: 1.22, y: 1.02, z: -0.14 });
        decals.spawnDecal('scorch', 1.22, -0.14);
      }
    } else if (stageKind === 'city-wheels-race') {
      pool.emit('spark_burst', { x: 0, y: 1.38, z: -0.55 });
      decals.spawnDecal('scorch', 1.6, 0.85, { radius: 0.55 });
    } else if (stageKind === 'casino-royale') {
      pool.emit('gold_jackpot', { x: 0.05, y: 0.55, z: 0.15, count: 42 });
      decals.spawnDecal('gold_ring', -1.35, 0.15);
    } else {
      if (/slash|melee/.test(act)) {
        bladeRibbon.triggerSlashArc({ x: 0, y: 1.05, z: 0.35, radius: 0.78 });
      } else if (/fire|shoot|attack/.test(act)) {
        pool.emit('muzzle_flash', { x: 0.35, y: 1.02, z: 0.45, dirX: 1.8 });
        pool.emit('shell_brass', { x: 0.22, y: 1.04, z: 0.42 });
      } else {
        pool.emit('gold_jackpot', { count: 14, x: 0, y: 0.55, z: 0 });
      }
    }
  }

  function applyBudgetThrottle(degradeLevel) {
    pool.budgetThrottleScale = degradeLevel >= 2 ? 0.5 : 0.75;
  }

  function update(scaledDt, _realDt = scaledDt, reducedMotion = false) {
    const reduced = reducedMotion || isReducedMotion();
    if (driftCars && !reduced && scaledDt > 0) {
      for (let i = 0; i < driftCars.length && i < driftTrails.length; i++) {
        const car = driftCars[i];
        if (car) {
          driftTrails[i].pushPoint(car.position.x, car.position.y + 0.05, car.position.z, 0, 1, 0, 0.10);
        }
      }
    }
    pool.update(scaledDt, reduced);
    bladeRibbon.update(scaledDt, reduced);
    for (let i = 0; i < driftTrails.length; i++) {
      driftTrails[i].update(scaledDt, reduced);
    }
    decals.update(scaledDt);
    if (laserCtrl) laserCtrl.update(scaledDt, reduced);
  }

  function dispose() {
    pool.dispose();
    decals.dispose();
    bladeRibbon.dispose();
    for (let i = 0; i < driftTrails.length; i++) {
      driftTrails[i].dispose();
    }
    driftTrails.length = 0;
    if (laserCtrl) {
      laserCtrl.dispose();
      laserCtrl = null;
    }
  }

  return {
    stageKind,
    pool,
    decals,
    bladeRibbon,
    driftTrails,
    get laserGrid() { return laserCtrl; },
    attachLaserGrid,
    attachDriftCars,
    triggerAction,
    applyBudgetThrottle,
    update,
    dispose,
  };
}

/* --------------------------------------------------------------------------
 * 9. SCREEN-SPACE TACTICAL FX OVERLAY HELPER (`screen-effects`)
 *    Crisp pointer-events-none overlays:
 *    - `crit-flash` (critical-hit micro-flash)
 *    - `low-hp` (crimson arterial edge vignette pulse)
 *    - `stealth-alert` (tactical amber scanline frame)
 *    Strictly respects `data-zone-reduced-motion="true"`.
 * -------------------------------------------------------------------------- */
const _screenFxTimers = {
  'crit-flash': 0,
  'low-hp': 0,
  'stealth-alert': 0,
};

export function normalizeScreenFxKind(rawKind) {
  const k = String(rawKind || 'crit-flash').trim().toLowerCase();
  if (/(low.?hp|crimson|vignette|damage|bleed|hosp)/.test(k)) return 'low-hp';
  if (/(stealth|alert|alarm|scanline|amber|breach)/.test(k)) return 'stealth-alert';
  if (k === 'clear' || k === 'reset' || k === 'none') return 'clear';
  return 'crit-flash';
}

function ensureScreenFxOverlayRoot(doc) {
  if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
  let root = typeof doc.getElementById === 'function' ? doc.getElementById('z3d-screen-fx-root') : null;
  if (!root && typeof doc.body.querySelector === 'function') {
    root = doc.body.querySelector('#z3d-screen-fx-root');
  }
  if (root) return root;

  root = doc.createElement('div');
  root.id = 'z3d-screen-fx-root';
  root.className = 'z3d-screen-fx-root';
  if (typeof root.setAttribute === 'function') {
    root.setAttribute('aria-hidden', 'true');
  }

  for (let i = 0; i < SCREEN_FX_KINDS.length; i++) {
    const kind = SCREEN_FX_KINDS[i];
    const layer = doc.createElement('div');
    layer.className = `z3d-screen-fx-layer z3d-screen-fx-layer--${kind}`;
    if (typeof layer.setAttribute === 'function') {
      layer.setAttribute('data-z3d-screen-fx', kind);
    }
    if (root.appendChild) root.appendChild(layer);
  }

  if (doc.body.appendChild) doc.body.appendChild(root);
  return root;
}

export function clearScreenFx(docRef = undefined) {
  const doc = docRef || (typeof document !== 'undefined' ? document : null);
  const timers = globalThis.clearTimeout || clearTimeout;
  for (let i = 0; i < SCREEN_FX_KINDS.length; i++) {
    const k = SCREEN_FX_KINDS[i];
    if (_screenFxTimers[k]) {
      timers(_screenFxTimers[k]);
      _screenFxTimers[k] = 0;
    }
  }
  if (!doc || !doc.body) return false;
  const root = typeof doc.getElementById === 'function' ? doc.getElementById('z3d-screen-fx-root') : null;
  if (root && typeof root.querySelectorAll === 'function') {
    const layers = root.querySelectorAll('.z3d-screen-fx-layer');
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].classList) {
        layers[i].classList.remove('is-active', 'is-reduced-motion');
      }
    }
  }
  return true;
}

export function triggerScreenFx(kind = 'crit-flash', opts = {}) {
  const doc = opts.document || (typeof document !== 'undefined' ? document : null);
  const normKind = normalizeScreenFxKind(kind);
  const reduced = opts.reducedMotion !== undefined ? Boolean(opts.reducedMotion) : isReducedMotion(doc);

  if (normKind === 'clear') {
    clearScreenFx(doc);
    return { triggered: false, kind: 'clear', reducedMotion: reduced, durationMs: 0 };
  }

  /* Under reduced-motion, completely suppress strobing crit-flash */
  if (reduced && normKind === 'crit-flash') {
    return { triggered: false, kind: normKind, reducedMotion: true, durationMs: 0 };
  }

  const defaultDurations = {
    'crit-flash': 210,
    'low-hp': 920,
    'stealth-alert': 740,
  };
  const durationMs = typeof opts.durationMs === 'number' ? opts.durationMs : defaultDurations[normKind];

  const root = ensureScreenFxOverlayRoot(doc);
  if (!root || typeof root.querySelector !== 'function') {
    return { triggered: !reduced, kind: normKind, reducedMotion: reduced, durationMs };
  }

  const layer = root.querySelector(`[data-z3d-screen-fx="${normKind}"]`) ||
    root.querySelector(`.z3d-screen-fx-layer--${normKind}`);

  if (layer && layer.classList) {
    layer.classList.remove('is-active');
    if (reduced) layer.classList.add('is-reduced-motion');
    else layer.classList.remove('is-reduced-motion');
    layer.classList.add('is-active');

    const clr = globalThis.clearTimeout || clearTimeout;
    const setT = globalThis.setTimeout || setTimeout;
    if (_screenFxTimers[normKind]) clr(_screenFxTimers[normKind]);
    if (!opts.persistent && durationMs > 0 && typeof setT === 'function') {
      _screenFxTimers[normKind] = setT(() => {
        _screenFxTimers[normKind] = 0;
        if (layer.classList) layer.classList.remove('is-active');
      }, durationMs);
    }
  }

  return { triggered: true, kind: normKind, reducedMotion: reduced, durationMs };
}

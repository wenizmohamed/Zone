/* ==========================================================================
 * ZONE v155 - ARTICULATED 3D SYNDICATE OPERATIVES & ANIMATIONMIXER RIG
 * Exclusive Ownership: @char-3d-anim (assets/ui/zone-3d-rigged-operative.mjs)
 * Local Vendored Three.js r184 ONLY - ZERO External CDNs - Zero-GC Clip Cache
 * Hierarchy:
 *   Pelvis -> Torso -> Chest -> Neck -> Head
 *   Chest  -> ShoulderL/R -> ElbowL/R -> WristL/R -> WeaponMountL/R
 *   Pelvis -> HipL/R -> KneeL/R -> AnkleL/R
 * ========================================================================== */

import * as THREE from '../../lib/three184/three.module.js';

export const OPERATIVE_OUTFITS = Object.freeze(['street', 'suit', 'tactical']);

export const OPERATIVE_ROLES = Object.freeze([
  'player',
  'nemesis',
  'crew',
  'boss',
  'guard',
  'boxer',
]);

export const OPERATIVE_CLIP_NAMES = Object.freeze([
  'idle_breathe',
  'combat_stance',
  'melee_slash',
  'recoil_fire',
  'vault_crack',
  'heavy_bag_hook',
  'hit_react',
  'ko_collapse',
]);

export const OPERATIVE_BONE_NAMES = Object.freeze([
  'Pelvis',
  'Torso',
  'Chest',
  'Neck',
  'Head',
  'ShoulderL',
  'ElbowL',
  'WristL',
  'WeaponMountL',
  'ShoulderR',
  'ElbowR',
  'WristR',
  'WeaponMountR',
  'HipL',
  'KneeL',
  'AnkleL',
  'HipR',
  'KneeR',
  'AnkleR',
]);

const CLIP_ALIAS_MAP = Object.freeze({
  idle: 'idle_breathe',
  breathe: 'idle_breathe',
  idle_breathe: 'idle_breathe',
  stance: 'combat_stance',
  guard: 'combat_stance',
  ready: 'combat_stance',
  combat: 'combat_stance',
  combat_stance: 'combat_stance',
  slash: 'melee_slash',
  melee: 'melee_slash',
  knife: 'melee_slash',
  katana: 'melee_slash',
  melee_slash: 'melee_slash',
  fire: 'recoil_fire',
  shoot: 'recoil_fire',
  attack: 'recoil_fire',
  gunshot: 'recoil_fire',
  recoil: 'recoil_fire',
  recoil_fire: 'recoil_fire',
  crack: 'vault_crack',
  breach: 'vault_crack',
  heist: 'vault_crack',
  drill: 'vault_crack',
  vault: 'vault_crack',
  vault_crack: 'vault_crack',
  punch: 'heavy_bag_hook',
  hook: 'heavy_bag_hook',
  train: 'heavy_bag_hook',
  str: 'heavy_bag_hook',
  gym: 'heavy_bag_hook',
  heavy_bag_hook: 'heavy_bag_hook',
  hit: 'hit_react',
  hurt: 'hit_react',
  damage: 'hit_react',
  stagger: 'hit_react',
  hit_react: 'hit_react',
  ko: 'ko_collapse',
  death: 'ko_collapse',
  collapse: 'ko_collapse',
  ragdoll: 'ko_collapse',
  ko_collapse: 'ko_collapse',
});

const LOOPING_CLIPS = new Set(['idle_breathe', 'combat_stance']);

const ROLE_PRESETS = Object.freeze({
  player: {
    scale: 1.0,
    skinHex: 0xd6a582,
    rimHex: 0x38bdf8,
    rimIntensity: 0.58,
    baseClip: 'idle_breathe',
    coatOverride: null,
    trimOverride: null,
  },
  nemesis: {
    scale: 1.12,
    skinHex: 0xc99676,
    rimHex: 0xff3b30,
    rimIntensity: 0.92,
    baseClip: 'combat_stance',
    coatOverride: 0x450a0a,
    trimOverride: 0xef4444,
  },
  crew: {
    scale: 0.92,
    skinHex: 0xd8a886,
    rimHex: 0x4ade80,
    rimIntensity: 0.54,
    baseClip: 'idle_breathe',
    coatOverride: null,
    trimOverride: 0xfbbf24,
  },
  boss: {
    scale: 1.14,
    skinHex: 0xc49070,
    rimHex: 0xf59e0b,
    rimIntensity: 0.95,
    baseClip: 'combat_stance',
    coatOverride: 0x1c1917,
    trimOverride: 0xfbbf24,
  },
  guard: {
    scale: 1.04,
    skinHex: 0xcfa07e,
    rimHex: 0xf97316,
    rimIntensity: 0.68,
    baseClip: 'combat_stance',
    coatOverride: 0x1e293b,
    trimOverride: 0xf59e0b,
  },
  boxer: {
    scale: 1.05,
    skinHex: 0xd19c78,
    rimHex: 0x22c55e,
    rimIntensity: 0.66,
    baseClip: 'combat_stance',
    coatOverride: 0x14532d,
    trimOverride: 0x4ade80,
  },
});

const OUTFIT_PALETTES = Object.freeze({
  street: {
    coatHex: 0x29201b,
    secondaryHex: 0x1e293b,
    pantsHex: 0x171c26,
    shoeHex: 0x0f172a,
    trimHex: 0x4ade80,
    roughness: 0.44,
    metalness: 0.34,
  },
  suit: {
    coatHex: 0x172033,
    secondaryHex: 0x0f172a,
    pantsHex: 0x0f172a,
    shoeHex: 0x14110f,
    trimHex: 0xf59e0b,
    roughness: 0.32,
    metalness: 0.48,
  },
  tactical: {
    coatHex: 0x242d3c,
    secondaryHex: 0x1b222e,
    pantsHex: 0x171d26,
    shoeHex: 0x0d1015,
    trimHex: 0x38bdf8,
    roughness: 0.38,
    metalness: 0.62,
  },
});

const _clipCacheByThree = new WeakMap();

export function normalizeOperativeOutfit(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/suit|بدلة|رسمي|exec|blazer|fedora/.test(s)) return 'suit';
  if (/tact|تكتيك|درع|قتال|armor|swat|kevlar/.test(s)) return 'tactical';
  return 'street';
}

export function normalizeOperativeRole(raw, opts = {}) {
  const s = String(raw || '').trim().toLowerCase();
  if (OPERATIVE_ROLES.includes(s)) return s;
  if (opts.bossCrown) return 'boss';
  if (opts.dumbbells) return 'boxer';
  if (/nemesis|rival/.test(s)) return 'nemesis';
  if (/boss|kingpin|warlord/.test(s)) return 'boss';
  if (/guard|patrol|sec|breacher/.test(s)) return 'guard';
  if (/box|gym|athlete|pit/.test(s)) return 'boxer';
  if (/crew|ally|member/.test(s)) return 'crew';
  return 'player';
}

export function resolveOperativeClipName(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return CLIP_ALIAS_MAP[key] || (OPERATIVE_CLIP_NAMES.includes(key) ? key : 'idle_breathe');
}

function attachOperativeRimShader(T, material, rimOpts = {}) {
  if (!material || typeof material !== 'object') return material;
  const rimHex = rimOpts.color !== undefined ? rimOpts.color : 0x7dd3fc;
  const power = typeof rimOpts.power === 'number' ? rimOpts.power : 2.6;
  const intensity = typeof rimOpts.intensity === 'number' ? rimOpts.intensity : 0.48;
  const pulseHz = typeof rimOpts.pulseHz === 'number' ? rimOpts.pulseHz : 0.7;

  const uniforms = {
    uZ3dRimColor: { value: new T.Color(rimHex) },
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

  material.onBeforeCompile = function z3dOperativeRimCompile(shader) {
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

function makeOperativeMat(T, color, roughness, metalness, rimOpts = null, extra = null) {
  const params = Object.assign({ color, roughness, metalness }, extra || {});
  const mat = new T.MeshStandardMaterial(params);
  if (rimOpts !== false) {
    attachOperativeRimShader(T, mat, rimOpts || { color: 0x93c5fd, power: 2.8, intensity: 0.36, pulseHz: 0.65 });
  }
  return mat;
}

/* --------------------------------------------------------------------------
 * SMOOTH QUATERNION & VECTOR KEYFRAME TRACK BUILDERS
 * Enforces hemisphere continuity (dot >= 0) + unit-normalized CubicInterpolant
 * so both VectorKeyframeTrack & QuaternionKeyframeTrack run THREE.InterpolateSmooth
 * with C1 velocity continuity and zero console warnings.
 * -------------------------------------------------------------------------- */
const _quatSmoothFactoryCache = new WeakMap();

function getQuaternionSmoothFactory(T) {
  if (_quatSmoothFactoryCache.has(T)) {
    return _quatSmoothFactoryCache.get(T);
  }
  class QuaternionSmoothInterpolant extends T.CubicInterpolant {
    interpolate_(i1, t0, t, t1) {
      const res = super.interpolate_(i1, t0, t, t1);
      for (let offset = 0, end = this.valueSize; offset < end; offset += 4) {
        const x = res[offset];
        const y = res[offset + 1];
        const z = res[offset + 2];
        const w = res[offset + 3];
        const len = Math.hypot(x, y, z, w);
        if (len > 1e-8) {
          const inv = 1 / len;
          res[offset] = x * inv;
          res[offset + 1] = y * inv;
          res[offset + 2] = z * inv;
          res[offset + 3] = w * inv;
        } else {
          res[offset] = 0;
          res[offset + 1] = 0;
          res[offset + 2] = 0;
          res[offset + 3] = 1;
        }
      }
      return res;
    }
  }
  const factory = function InterpolantFactoryMethodSmooth(result) {
    return new QuaternionSmoothInterpolant(this.times, this.values, this.getValueSize(), result);
  };
  _quatSmoothFactoryCache.set(T, factory);
  return factory;
}

function qTrack(T, boneName, times, eulerKeyframes) {
  const values = new Float32Array(times.length * 4);
  const euler = new T.Euler(0, 0, 0, 'XYZ');
  const q = new T.Quaternion();
  const prevQ = new T.Quaternion();

  for (let i = 0; i < times.length; i++) {
    const k = eulerKeyframes[i] || [0, 0, 0];
    euler.set(k[0] || 0, k[1] || 0, k[2] || 0, 'XYZ');
    q.setFromEuler(euler);
    if (i > 0 && prevQ.dot(q) < 0) {
      q.set(-q.x, -q.y, -q.z, -q.w);
    }
    prevQ.copy(q);
    const o = i * 4;
    values[o + 0] = q.x;
    values[o + 1] = q.y;
    values[o + 2] = q.z;
    values[o + 3] = q.w;
  }

  const track = new T.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
  track.InterpolantFactoryMethodSmooth = getQuaternionSmoothFactory(T);
  track.setInterpolation(T.InterpolateSmooth);
  return track;
}

function vTrack(T, propertyPath, times, vecKeyframes) {
  const values = new Float32Array(times.length * 3);
  for (let i = 0; i < times.length; i++) {
    const v = vecKeyframes[i] || [0, 0, 0];
    const o = i * 3;
    values[o + 0] = v[0];
    values[o + 1] = v[1];
    values[o + 2] = v[2];
  }
  const track = new T.VectorKeyframeTrack(propertyPath, times, values);
  track.setInterpolation(T.InterpolateSmooth);
  return track;
}

export function buildOperativeAnimationClips(THREE_REF = THREE) {
  const T = THREE_REF || THREE;
  if (_clipCacheByThree.has(T)) {
    return _clipCacheByThree.get(T);
  }

  // 1. idle_breathe (2.4s seamless loop)
  const tIdle = [0, 0.6, 1.2, 1.8, 2.4];
  const idleClip = new T.AnimationClip('idle_breathe', 2.4, [
    vTrack(T, 'Pelvis.position', tIdle, [
      [0, 0.68, 0],
      [0.012, 0.668, 0.008],
      [0, 0.686, 0],
      [-0.012, 0.671, -0.006],
      [0, 0.68, 0],
    ]),
    vTrack(T, 'Chest.position', tIdle, [
      [0, 0.18, 0],
      [0, 0.186, 0.004],
      [0, 0.179, 0],
      [0, 0.185, 0.003],
      [0, 0.18, 0],
    ]),
    qTrack(T, 'Pelvis', tIdle, [
      [0, -0.06, 0],
      [0.015, -0.03, 0.022],
      [0, -0.06, 0],
      [-0.012, -0.09, -0.022],
      [0, -0.06, 0],
    ]),
    qTrack(T, 'Torso', tIdle, [
      [0.02, 0.03, 0],
      [-0.025, 0.05, -0.015],
      [0.025, 0.03, 0],
      [-0.02, 0.01, 0.015],
      [0.02, 0.03, 0],
    ]),
    qTrack(T, 'Chest', tIdle, [
      [0.02, 0.03, 0],
      [-0.04, 0.05, -0.01],
      [0.025, 0.02, 0],
      [-0.035, 0.0, 0.01],
      [0.02, 0.03, 0],
    ]),
    qTrack(T, 'Neck', tIdle, [
      [0, 0, 0],
      [0.02, 0.06, 0],
      [0, 0, 0],
      [0.015, -0.06, 0],
      [0, 0, 0],
    ]),
    qTrack(T, 'Head', tIdle, [
      [0.01, 0, 0],
      [-0.03, 0.11, 0.02],
      [0.015, 0, 0],
      [-0.025, -0.10, -0.02],
      [0.01, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tIdle, [
      [-0.14, 0.06, -0.13],
      [-0.22, 0.09, -0.16],
      [-0.13, 0.05, -0.12],
      [-0.20, 0.08, -0.15],
      [-0.14, 0.06, -0.13],
    ]),
    qTrack(T, 'ElbowL', tIdle, [
      [-0.28, 0, 0.04],
      [-0.36, 0, 0.06],
      [-0.27, 0, 0.04],
      [-0.34, 0, 0.05],
      [-0.28, 0, 0.04],
    ]),
    qTrack(T, 'WristL', tIdle, [
      [-0.06, 0, 0],
      [-0.12, 0.05, 0],
      [-0.06, 0, 0],
      [-0.10, -0.04, 0],
      [-0.06, 0, 0],
    ]),
    qTrack(T, 'ShoulderR', tIdle, [
      [-0.38, -0.10, 0.14],
      [-0.46, -0.14, 0.17],
      [-0.37, -0.09, 0.13],
      [-0.44, -0.12, 0.16],
      [-0.38, -0.10, 0.14],
    ]),
    qTrack(T, 'ElbowR', tIdle, [
      [-0.56, 0, -0.06],
      [-0.65, 0, -0.08],
      [-0.55, 0, -0.06],
      [-0.63, 0, -0.07],
      [-0.56, 0, -0.06],
    ]),
    qTrack(T, 'WristR', tIdle, [
      [-0.08, -0.05, 0],
      [-0.15, -0.08, 0],
      [-0.08, -0.05, 0],
      [-0.13, -0.06, 0],
      [-0.08, -0.05, 0],
    ]),
    qTrack(T, 'HipL', tIdle, [
      [-0.05, 0.04, -0.03],
      [-0.10, 0.05, -0.04],
      [-0.04, 0.04, -0.03],
      [-0.08, 0.03, -0.02],
      [-0.05, 0.04, -0.03],
    ]),
    qTrack(T, 'KneeL', tIdle, [
      [0.10, 0, 0],
      [0.19, 0, 0],
      [0.08, 0, 0],
      [0.16, 0, 0],
      [0.10, 0, 0],
    ]),
    qTrack(T, 'AnkleL', tIdle, [
      [-0.05, 0, 0],
      [-0.09, 0, 0],
      [-0.04, 0, 0],
      [-0.08, 0, 0],
      [-0.05, 0, 0],
    ]),
    qTrack(T, 'HipR', tIdle, [
      [-0.04, -0.05, 0.03],
      [-0.09, -0.06, 0.04],
      [-0.03, -0.05, 0.03],
      [-0.08, -0.04, 0.02],
      [-0.04, -0.05, 0.03],
    ]),
    qTrack(T, 'KneeR', tIdle, [
      [0.08, 0, 0],
      [0.17, 0, 0],
      [0.06, 0, 0],
      [0.15, 0, 0],
      [0.08, 0, 0],
    ]),
    qTrack(T, 'AnkleR', tIdle, [
      [-0.04, 0, 0],
      [-0.08, 0, 0],
      [-0.03, 0, 0],
      [-0.07, 0, 0],
      [-0.04, 0, 0],
    ]),
  ]);

  // 2. combat_stance (1.6s tactical ready loop)
  const tStance = [0, 0.4, 0.8, 1.2, 1.6];
  const combatStanceClip = new T.AnimationClip('combat_stance', 1.6, [
    vTrack(T, 'Pelvis.position', tStance, [
      [0, 0.62, 0.01],
      [0.018, 0.595, 0.03],
      [0, 0.625, 0.01],
      [-0.016, 0.60, -0.015],
      [0, 0.62, 0.01],
    ]),
    qTrack(T, 'Pelvis', tStance, [
      [0.04, -0.34, 0],
      [0.06, -0.29, 0.03],
      [0.04, -0.35, 0],
      [0.05, -0.38, -0.02],
      [0.04, -0.34, 0],
    ]),
    qTrack(T, 'Torso', tStance, [
      [0.10, 0.16, 0],
      [0.14, 0.20, -0.02],
      [0.09, 0.15, 0],
      [0.13, 0.18, 0.02],
      [0.10, 0.16, 0],
    ]),
    qTrack(T, 'Chest', tStance, [
      [0.08, 0.16, 0],
      [0.11, 0.20, -0.02],
      [0.07, 0.15, 0],
      [0.10, 0.17, 0.02],
      [0.08, 0.16, 0],
    ]),
    qTrack(T, 'Neck', tStance, [
      [-0.05, 0.04, 0],
      [-0.08, 0.02, 0],
      [-0.05, 0.05, 0],
      [-0.07, 0.03, 0],
      [-0.05, 0.04, 0],
    ]),
    qTrack(T, 'Head', tStance, [
      [-0.08, 0.02, 0],
      [-0.11, -0.04, 0.02],
      [-0.07, 0.03, 0],
      [-0.10, 0.06, -0.02],
      [-0.08, 0.02, 0],
    ]),
    qTrack(T, 'ShoulderL', tStance, [
      [-0.78, 0.28, -0.18],
      [-0.88, 0.34, -0.22],
      [-0.76, 0.26, -0.17],
      [-0.85, 0.31, -0.20],
      [-0.78, 0.28, -0.18],
    ]),
    qTrack(T, 'ElbowL', tStance, [
      [-1.02, 0, 0.16],
      [-1.14, 0, 0.20],
      [-1.00, 0, 0.15],
      [-1.10, 0, 0.18],
      [-1.02, 0, 0.16],
    ]),
    qTrack(T, 'WristL', tStance, [
      [-0.14, 0.10, 0],
      [-0.22, 0.14, 0],
      [-0.13, 0.10, 0],
      [-0.19, 0.12, 0],
      [-0.14, 0.10, 0],
    ]),
    qTrack(T, 'ShoulderR', tStance, [
      [-0.84, -0.22, 0.18],
      [-0.94, -0.26, 0.22],
      [-0.82, -0.20, 0.17],
      [-0.90, -0.24, 0.20],
      [-0.84, -0.22, 0.18],
    ]),
    qTrack(T, 'ElbowR', tStance, [
      [-0.88, 0, -0.14],
      [-0.98, 0, -0.18],
      [-0.86, 0, -0.13],
      [-0.95, 0, -0.16],
      [-0.88, 0, -0.14],
    ]),
    qTrack(T, 'WristR', tStance, [
      [-0.12, -0.08, 0],
      [-0.20, -0.12, 0],
      [-0.11, -0.07, 0],
      [-0.17, -0.10, 0],
      [-0.12, -0.08, 0],
    ]),
    qTrack(T, 'HipL', tStance, [
      [-0.32, 0.12, -0.06],
      [-0.40, 0.14, -0.08],
      [-0.30, 0.12, -0.06],
      [-0.37, 0.13, -0.07],
      [-0.32, 0.12, -0.06],
    ]),
    qTrack(T, 'KneeL', tStance, [
      [0.58, 0, 0],
      [0.70, 0, 0],
      [0.55, 0, 0],
      [0.66, 0, 0],
      [0.58, 0, 0],
    ]),
    qTrack(T, 'AnkleL', tStance, [
      [-0.26, 0, 0],
      [-0.30, 0, 0],
      [-0.25, 0, 0],
      [-0.29, 0, 0],
      [-0.26, 0, 0],
    ]),
    qTrack(T, 'HipR', tStance, [
      [-0.20, -0.14, 0.06],
      [-0.28, -0.16, 0.08],
      [-0.18, -0.14, 0.06],
      [-0.25, -0.15, 0.07],
      [-0.20, -0.14, 0.06],
    ]),
    qTrack(T, 'KneeR', tStance, [
      [0.44, 0, 0],
      [0.56, 0, 0],
      [0.42, 0, 0],
      [0.52, 0, 0],
      [0.44, 0, 0],
    ]),
    qTrack(T, 'AnkleR', tStance, [
      [-0.24, 0, 0],
      [-0.28, 0, 0],
      [-0.24, 0, 0],
      [-0.27, 0, 0],
      [-0.24, 0, 0],
    ]),
  ]);

  // 3. melee_slash (0.72s diagonal blade cleave)
  const tSlash = [0, 0.18, 0.36, 0.54, 0.72];
  const meleeSlashClip = new T.AnimationClip('melee_slash', 0.72, [
    vTrack(T, 'Pelvis.position', tSlash, [
      [0, 0.63, 0],
      [-0.04, 0.60, -0.05],
      [0.05, 0.57, 0.18],
      [0.02, 0.60, 0.08],
      [0, 0.63, 0],
    ]),
    qTrack(T, 'Pelvis', tSlash, [
      [0.03, -0.26, 0],
      [-0.04, -0.52, -0.05],
      [0.10, 0.38, 0.06],
      [0.05, 0.10, 0.02],
      [0.03, -0.26, 0],
    ]),
    qTrack(T, 'Torso', tSlash, [
      [0.08, 0.12, 0],
      [-0.10, -0.32, -0.06],
      [0.22, 0.44, 0.08],
      [0.12, 0.18, 0.03],
      [0.08, 0.12, 0],
    ]),
    qTrack(T, 'Chest', tSlash, [
      [0.06, 0.12, 0],
      [-0.12, -0.36, -0.08],
      [0.24, 0.48, 0.10],
      [0.10, 0.20, 0.04],
      [0.06, 0.12, 0],
    ]),
    qTrack(T, 'Head', tSlash, [
      [-0.05, 0, 0],
      [0.06, 0.42, 0],
      [-0.14, -0.38, -0.05],
      [-0.08, -0.10, 0],
      [-0.05, 0, 0],
    ]),
    qTrack(T, 'ShoulderR', tSlash, [
      [-0.78, -0.18, 0.18],
      [-2.05, -0.45, 0.55],
      [-0.58, 0.68, -0.46],
      [-0.65, 0.32, -0.18],
      [-0.78, -0.18, 0.18],
    ]),
    qTrack(T, 'ElbowR', tSlash, [
      [-0.82, 0, -0.12],
      [-1.08, 0, 0.18],
      [-0.18, 0, -0.22],
      [-0.48, 0, -0.14],
      [-0.82, 0, -0.12],
    ]),
    qTrack(T, 'WristR', tSlash, [
      [-0.10, 0, 0],
      [-0.42, -0.25, 0.15],
      [0.44, 0.28, -0.20],
      [0.12, 0.10, -0.08],
      [-0.10, 0, 0],
    ]),
    qTrack(T, 'WeaponMountR', tSlash, [
      [0, 0, 0],
      [-0.30, 0, 0.12],
      [0.36, 0, -0.18],
      [0.10, 0, -0.05],
      [0, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tSlash, [
      [-0.68, 0.22, -0.16],
      [-0.45, 0.10, -0.32],
      [-0.32, -0.28, -0.48],
      [-0.52, 0.05, -0.25],
      [-0.68, 0.22, -0.16],
    ]),
    qTrack(T, 'ElbowL', tSlash, [
      [-0.88, 0, 0.12],
      [-0.62, 0, 0.08],
      [-0.44, 0, 0.06],
      [-0.72, 0, 0.10],
      [-0.88, 0, 0.12],
    ]),
    qTrack(T, 'HipL', tSlash, [
      [-0.28, 0.10, -0.05],
      [-0.22, 0.15, -0.08],
      [-0.56, 0.05, -0.06],
      [-0.38, 0.08, -0.05],
      [-0.28, 0.10, -0.05],
    ]),
    qTrack(T, 'KneeL', tSlash, [
      [0.52, 0, 0],
      [0.48, 0, 0],
      [0.88, 0, 0],
      [0.64, 0, 0],
      [0.52, 0, 0],
    ]),
    qTrack(T, 'HipR', tSlash, [
      [-0.18, -0.12, 0.05],
      [-0.38, -0.18, 0.08],
      [0.12, -0.08, 0.06],
      [-0.08, -0.10, 0.05],
      [-0.18, -0.12, 0.05],
    ]),
    qTrack(T, 'KneeR', tSlash, [
      [0.40, 0, 0],
      [0.68, 0, 0],
      [0.26, 0, 0],
      [0.36, 0, 0],
      [0.40, 0, 0],
    ]),
  ]);

  // 4. recoil_fire (0.56s double-tap ballistic recoil)
  const tFire = [0, 0.09, 0.20, 0.31, 0.56];
  const recoilFireClip = new T.AnimationClip('recoil_fire', 0.56, [
    vTrack(T, 'Pelvis.position', tFire, [
      [0, 0.62, 0.02],
      [0, 0.605, -0.045],
      [0, 0.618, 0.0],
      [0, 0.60, -0.055],
      [0, 0.62, 0.02],
    ]),
    qTrack(T, 'Pelvis', tFire, [
      [0.04, -0.28, 0],
      [-0.03, -0.32, 0],
      [0.02, -0.29, 0],
      [-0.04, -0.34, 0],
      [0.04, -0.28, 0],
    ]),
    qTrack(T, 'Torso', tFire, [
      [0.10, 0.14, 0],
      [-0.11, 0.10, -0.03],
      [0.05, 0.13, 0],
      [-0.14, 0.08, -0.04],
      [0.10, 0.14, 0],
    ]),
    qTrack(T, 'Chest', tFire, [
      [0.08, 0.14, 0],
      [-0.16, 0.08, -0.04],
      [0.03, 0.13, 0],
      [-0.19, 0.06, -0.05],
      [0.08, 0.14, 0],
    ]),
    qTrack(T, 'Neck', tFire, [
      [-0.06, 0.02, 0],
      [0.08, 0.04, 0],
      [-0.03, 0.02, 0],
      [0.10, 0.05, 0],
      [-0.06, 0.02, 0],
    ]),
    qTrack(T, 'Head', tFire, [
      [-0.08, 0.0, 0],
      [-0.22, 0.04, 0.03],
      [-0.09, 0.01, 0],
      [-0.25, 0.05, 0.04],
      [-0.08, 0.0, 0],
    ]),
    qTrack(T, 'ShoulderR', tFire, [
      [-1.18, -0.16, 0.12],
      [-1.46, -0.20, 0.18],
      [-1.22, -0.17, 0.13],
      [-1.52, -0.22, 0.20],
      [-1.18, -0.16, 0.12],
    ]),
    qTrack(T, 'ElbowR', tFire, [
      [-0.42, 0, -0.10],
      [-0.78, 0, -0.16],
      [-0.48, 0, -0.11],
      [-0.84, 0, -0.18],
      [-0.42, 0, -0.10],
    ]),
    qTrack(T, 'WristR', tFire, [
      [-0.05, 0, 0],
      [-0.38, -0.06, 0],
      [-0.08, -0.02, 0],
      [-0.44, -0.08, 0],
      [-0.05, 0, 0],
    ]),
    qTrack(T, 'WeaponMountR', tFire, [
      [0, 0, 0],
      [-0.26, 0, 0],
      [-0.04, 0, 0],
      [-0.30, 0, 0],
      [0, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tFire, [
      [-1.12, 0.42, -0.10],
      [-1.34, 0.46, -0.14],
      [-1.15, 0.43, -0.11],
      [-1.38, 0.48, -0.15],
      [-1.12, 0.42, -0.10],
    ]),
    qTrack(T, 'ElbowL', tFire, [
      [-0.64, 0, 0.16],
      [-0.92, 0, 0.22],
      [-0.68, 0, 0.17],
      [-0.96, 0, 0.24],
      [-0.64, 0, 0.16],
    ]),
    qTrack(T, 'HipL', tFire, [
      [-0.30, 0.10, -0.05],
      [-0.36, 0.10, -0.06],
      [-0.31, 0.10, -0.05],
      [-0.38, 0.10, -0.06],
      [-0.30, 0.10, -0.05],
    ]),
    qTrack(T, 'KneeL', tFire, [
      [0.54, 0, 0],
      [0.64, 0, 0],
      [0.56, 0, 0],
      [0.68, 0, 0],
      [0.54, 0, 0],
    ]),
    qTrack(T, 'HipR', tFire, [
      [-0.18, -0.12, 0.05],
      [-0.24, -0.12, 0.06],
      [-0.19, -0.12, 0.05],
      [-0.26, -0.12, 0.06],
      [-0.18, -0.12, 0.05],
    ]),
    qTrack(T, 'KneeR', tFire, [
      [0.42, 0, 0],
      [0.52, 0, 0],
      [0.44, 0, 0],
      [0.56, 0, 0],
      [0.42, 0, 0],
    ]),
  ]);

  // 5. vault_crack (1.05s tactical heist crouch + tumbler manipulation + lookout check)
  const tVault = [0, 0.24, 0.52, 0.80, 1.05];
  const vaultCrackClip = new T.AnimationClip('vault_crack', 1.05, [
    vTrack(T, 'Pelvis.position', tVault, [
      [0, 0.62, 0],
      [0.02, 0.46, 0.10],
      [0.03, 0.44, 0.13],
      [0.02, 0.47, 0.09],
      [0, 0.62, 0],
    ]),
    qTrack(T, 'Pelvis', tVault, [
      [0.03, -0.18, 0],
      [0.14, -0.12, 0.04],
      [0.16, -0.08, 0.05],
      [0.12, -0.15, 0.03],
      [0.03, -0.18, 0],
    ]),
    qTrack(T, 'Torso', tVault, [
      [0.08, 0.08, 0],
      [0.24, 0.06, -0.03],
      [0.28, -0.04, -0.04],
      [0.22, 0.10, -0.02],
      [0.08, 0.08, 0],
    ]),
    qTrack(T, 'Chest', tVault, [
      [0.06, 0.08, 0],
      [0.20, 0.05, -0.02],
      [0.24, -0.06, -0.03],
      [0.18, 0.12, -0.02],
      [0.06, 0.08, 0],
    ]),
    qTrack(T, 'Neck', tVault, [
      [-0.04, 0, 0],
      [-0.18, 0.08, 0],
      [-0.20, 0.26, 0.04],
      [-0.16, -0.10, 0],
      [-0.04, 0, 0],
    ]),
    qTrack(T, 'Head', tVault, [
      [-0.06, 0, 0],
      [-0.16, 0.06, 0],
      [-0.14, 0.46, 0.06],
      [-0.18, -0.12, -0.03],
      [-0.06, 0, 0],
    ]),
    qTrack(T, 'ShoulderR', tVault, [
      [-0.78, -0.16, 0.16],
      [-1.28, -0.10, 0.08],
      [-1.36, -0.04, 0.04],
      [-1.24, -0.14, 0.10],
      [-0.78, -0.16, 0.16],
    ]),
    qTrack(T, 'ElbowR', tVault, [
      [-0.82, 0, -0.10],
      [-0.64, 0.18, -0.14],
      [-0.54, -0.22, -0.12],
      [-0.68, 0.24, -0.15],
      [-0.82, 0, -0.10],
    ]),
    qTrack(T, 'WristR', tVault, [
      [-0.10, 0, 0],
      [-0.18, 0.42, 0.28],
      [-0.22, -0.46, -0.32],
      [-0.16, 0.38, 0.25],
      [-0.10, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tVault, [
      [-0.72, 0.22, -0.16],
      [-1.18, 0.26, -0.08],
      [-1.26, 0.30, -0.05],
      [-1.15, 0.24, -0.10],
      [-0.72, 0.22, -0.16],
    ]),
    qTrack(T, 'ElbowL', tVault, [
      [-0.88, 0, 0.12],
      [-0.72, 0, 0.16],
      [-0.66, 0, 0.18],
      [-0.76, 0, 0.14],
      [-0.88, 0, 0.12],
    ]),
    qTrack(T, 'HipL', tVault, [
      [-0.28, 0.08, -0.04],
      [-0.84, 0.10, -0.06],
      [-0.90, 0.12, -0.06],
      [-0.82, 0.10, -0.05],
      [-0.28, 0.08, -0.04],
    ]),
    qTrack(T, 'KneeL', tVault, [
      [0.52, 0, 0],
      [1.38, 0, 0],
      [1.46, 0, 0],
      [1.34, 0, 0],
      [0.52, 0, 0],
    ]),
    qTrack(T, 'AnkleL', tVault, [
      [-0.24, 0, 0],
      [-0.54, 0, 0],
      [-0.56, 0, 0],
      [-0.52, 0, 0],
      [-0.24, 0, 0],
    ]),
    qTrack(T, 'HipR', tVault, [
      [-0.18, -0.10, 0.04],
      [-0.58, -0.12, 0.06],
      [-0.64, -0.12, 0.06],
      [-0.56, -0.10, 0.05],
      [-0.18, -0.10, 0.04],
    ]),
    qTrack(T, 'KneeR', tVault, [
      [0.42, 0, 0],
      [1.28, 0, 0],
      [1.35, 0, 0],
      [1.24, 0, 0],
      [0.42, 0, 0],
    ]),
    qTrack(T, 'AnkleR', tVault, [
      [-0.24, 0, 0],
      [-0.70, 0, 0],
      [-0.71, 0, 0],
      [-0.68, 0, 0],
      [-0.24, 0, 0],
    ]),
  ]);

  // 6. heavy_bag_hook (0.68s Iron Pit kinetic-chain power hook)
  const tHook = [0, 0.16, 0.32, 0.50, 0.68];
  const heavyBagHookClip = new T.AnimationClip('heavy_bag_hook', 0.68, [
    vTrack(T, 'Pelvis.position', tHook, [
      [0, 0.62, 0],
      [-0.04, 0.59, -0.04],
      [0.05, 0.58, 0.14],
      [0.02, 0.60, 0.05],
      [0, 0.62, 0],
    ]),
    qTrack(T, 'Pelvis', tHook, [
      [0.04, -0.26, 0],
      [0.06, -0.52, -0.05],
      [0.10, 0.42, 0.06],
      [0.06, 0.08, 0.02],
      [0.04, -0.26, 0],
    ]),
    qTrack(T, 'Torso', tHook, [
      [0.10, 0.12, 0],
      [0.06, -0.28, -0.06],
      [0.20, 0.46, 0.08],
      [0.12, 0.18, 0.03],
      [0.10, 0.12, 0],
    ]),
    qTrack(T, 'Chest', tHook, [
      [0.08, 0.12, 0],
      [0.04, -0.34, -0.08],
      [0.22, 0.52, 0.10],
      [0.10, 0.20, 0.04],
      [0.08, 0.12, 0],
    ]),
    qTrack(T, 'Head', tHook, [
      [-0.10, 0.08, 0],
      [-0.08, 0.42, 0.04],
      [-0.16, -0.44, -0.06],
      [-0.12, -0.10, 0],
      [-0.10, 0.08, 0],
    ]),
    qTrack(T, 'ShoulderR', tHook, [
      [-0.92, -0.18, 0.18],
      [-0.82, -0.55, 0.64],
      [-1.08, 0.68, -0.28],
      [-0.98, 0.20, 0.04],
      [-0.92, -0.18, 0.18],
    ]),
    qTrack(T, 'ElbowR', tHook, [
      [-1.28, 0, -0.12],
      [-1.18, 0, 0.10],
      [-1.02, 0, -0.24],
      [-1.18, 0, -0.16],
      [-1.28, 0, -0.12],
    ]),
    qTrack(T, 'WristR', tHook, [
      [-0.08, 0, 0],
      [-0.15, -0.22, 0],
      [0.18, 0.16, -0.22],
      [0.04, 0.05, -0.08],
      [-0.08, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tHook, [
      [-0.96, 0.26, -0.16],
      [-1.05, 0.34, -0.12],
      [-1.12, 0.42, -0.08],
      [-1.02, 0.30, -0.14],
      [-0.96, 0.26, -0.16],
    ]),
    qTrack(T, 'ElbowL', tHook, [
      [-1.36, 0, 0.14],
      [-1.44, 0, 0.18],
      [-1.48, 0, 0.22],
      [-1.40, 0, 0.16],
      [-1.36, 0, 0.14],
    ]),
    qTrack(T, 'HipL', tHook, [
      [-0.30, 0.12, -0.06],
      [-0.26, 0.16, -0.08],
      [-0.48, 0.04, -0.06],
      [-0.36, 0.08, -0.06],
      [-0.30, 0.12, -0.06],
    ]),
    qTrack(T, 'KneeL', tHook, [
      [0.56, 0, 0],
      [0.52, 0, 0],
      [0.78, 0, 0],
      [0.64, 0, 0],
      [0.56, 0, 0],
    ]),
    qTrack(T, 'HipR', tHook, [
      [-0.20, -0.14, 0.06],
      [-0.38, -0.22, 0.08],
      [-0.06, 0.28, 0.10],
      [-0.14, 0.04, 0.07],
      [-0.20, -0.14, 0.06],
    ]),
    qTrack(T, 'KneeR', tHook, [
      [0.44, 0, 0],
      [0.68, 0, 0],
      [0.34, 0, 0],
      [0.40, 0, 0],
      [0.44, 0, 0],
    ]),
  ]);

  // 7. hit_react (0.58s active-ragdoll whiplash stagger)
  const tHit = [0, 0.10, 0.26, 0.44, 0.58];
  const hitReactClip = new T.AnimationClip('hit_react', 0.58, [
    vTrack(T, 'Pelvis.position', tHit, [
      [0, 0.64, 0],
      [0.03, 0.60, -0.10],
      [0.05, 0.58, -0.14],
      [0.02, 0.61, -0.05],
      [0, 0.64, 0],
    ]),
    qTrack(T, 'Pelvis', tHit, [
      [0, -0.16, 0],
      [-0.12, -0.28, 0.06],
      [-0.06, -0.34, 0.08],
      [0.04, -0.20, 0.02],
      [0, -0.16, 0],
    ]),
    qTrack(T, 'Torso', tHit, [
      [0.04, 0.06, 0],
      [-0.26, -0.18, 0.08],
      [-0.14, -0.22, 0.10],
      [0.12, 0.02, 0.02],
      [0.04, 0.06, 0],
    ]),
    qTrack(T, 'Chest', tHit, [
      [0.04, 0.06, 0],
      [-0.34, -0.24, 0.12],
      [-0.18, -0.28, 0.14],
      [0.14, 0.02, 0.03],
      [0.04, 0.06, 0],
    ]),
    qTrack(T, 'Neck', tHit, [
      [0, 0, 0],
      [-0.28, 0.18, 0.08],
      [0.14, 0.22, 0.06],
      [0.06, 0.05, 0],
      [0, 0, 0],
    ]),
    qTrack(T, 'Head', tHit, [
      [0, 0, 0],
      [-0.44, 0.32, 0.14],
      [0.20, 0.26, 0.08],
      [0.08, 0.06, 0],
      [0, 0, 0],
    ]),
    qTrack(T, 'ShoulderL', tHit, [
      [-0.55, 0.18, -0.16],
      [-0.24, -0.15, -0.58],
      [-0.36, -0.10, -0.46],
      [-0.62, 0.12, -0.22],
      [-0.55, 0.18, -0.16],
    ]),
    qTrack(T, 'ElbowL', tHit, [
      [-0.78, 0, 0.10],
      [-0.32, 0, 0.04],
      [-0.45, 0, 0.06],
      [-0.82, 0, 0.10],
      [-0.78, 0, 0.10],
    ]),
    qTrack(T, 'ShoulderR', tHit, [
      [-0.65, -0.16, 0.16],
      [-0.28, 0.16, 0.62],
      [-0.40, 0.10, 0.48],
      [-0.70, -0.12, 0.22],
      [-0.65, -0.16, 0.16],
    ]),
    qTrack(T, 'ElbowR', tHit, [
      [-0.75, 0, -0.10],
      [-0.28, 0, -0.04],
      [-0.42, 0, -0.06],
      [-0.80, 0, -0.10],
      [-0.75, 0, -0.10],
    ]),
    qTrack(T, 'HipL', tHit, [
      [-0.18, 0.06, -0.04],
      [-0.34, 0.08, -0.08],
      [-0.42, 0.10, -0.10],
      [-0.24, 0.06, -0.05],
      [-0.18, 0.06, -0.04],
    ]),
    qTrack(T, 'KneeL', tHit, [
      [0.34, 0, 0],
      [0.64, 0, 0],
      [0.74, 0, 0],
      [0.44, 0, 0],
      [0.34, 0, 0],
    ]),
    qTrack(T, 'HipR', tHit, [
      [-0.12, -0.08, 0.04],
      [-0.22, -0.12, 0.08],
      [-0.28, -0.14, 0.10],
      [-0.16, -0.08, 0.05],
      [-0.12, -0.08, 0.04],
    ]),
    qTrack(T, 'KneeR', tHit, [
      [0.28, 0, 0],
      [0.54, 0, 0],
      [0.62, 0, 0],
      [0.36, 0, 0],
      [0.28, 0, 0],
    ]),
  ]);

  // 8. ko_collapse (1.15s multi-phase ragdoll knockout collapse, clamped at finish)
  const tKo = [0, 0.18, 0.46, 0.78, 1.15];
  const koCollapseClip = new T.AnimationClip('ko_collapse', 1.15, [
    vTrack(T, 'Pelvis.position', tKo, [
      [0, 0.64, 0],
      [0.03, 0.60, -0.08],
      [0.05, 0.36, -0.12],
      [0.07, 0.15, -0.22],
      [0.08, 0.12, -0.26],
    ]),
    qTrack(T, 'Pelvis', tKo, [
      [0, -0.14, 0],
      [-0.18, -0.24, 0.08],
      [-0.58, -0.30, 0.14],
      [-1.32, -0.22, 0.20],
      [-1.46, -0.18, 0.24],
    ]),
    qTrack(T, 'Torso', tKo, [
      [0.04, 0.05, 0],
      [-0.32, -0.16, 0.10],
      [-0.24, -0.12, 0.14],
      [-0.12, -0.06, 0.08],
      [-0.06, -0.04, 0.06],
    ]),
    qTrack(T, 'Chest', tKo, [
      [0.04, 0.05, 0],
      [-0.38, -0.20, 0.12],
      [-0.28, -0.16, 0.16],
      [-0.08, -0.08, 0.10],
      [-0.04, -0.06, 0.08],
    ]),
    qTrack(T, 'Neck', tKo, [
      [0, 0, 0],
      [-0.32, 0.18, 0.10],
      [-0.18, 0.26, 0.14],
      [0.16, 0.34, 0.10],
      [0.10, 0.40, 0.08],
    ]),
    qTrack(T, 'Head', tKo, [
      [0, 0, 0],
      [-0.46, 0.28, 0.14],
      [-0.22, 0.38, 0.18],
      [0.18, 0.48, 0.12],
      [0.08, 0.56, 0.10],
    ]),
    qTrack(T, 'ShoulderL', tKo, [
      [-0.52, 0.16, -0.16],
      [-0.22, -0.18, -0.68],
      [0.15, -0.24, -0.88],
      [0.08, -0.12, -1.05],
      [0.02, -0.08, -0.96],
    ]),
    qTrack(T, 'ElbowL', tKo, [
      [-0.72, 0, 0.10],
      [-0.28, 0, 0.06],
      [-0.55, 0, 0.12],
      [-0.38, 0, 0.08],
      [-0.26, 0, 0.06],
    ]),
    qTrack(T, 'ShoulderR', tKo, [
      [-0.62, -0.16, 0.16],
      [-0.26, 0.18, 0.72],
      [0.18, 0.26, 0.92],
      [0.10, 0.14, 1.12],
      [0.04, 0.10, 1.02],
    ]),
    qTrack(T, 'ElbowR', tKo, [
      [-0.70, 0, -0.10],
      [-0.24, 0, -0.06],
      [-0.48, 0, -0.12],
      [-0.32, 0, -0.08],
      [-0.22, 0, -0.06],
    ]),
    qTrack(T, 'HipL', tKo, [
      [-0.16, 0.06, -0.04],
      [-0.32, 0.08, -0.08],
      [-0.86, 0.12, -0.14],
      [-0.28, 0.16, -0.18],
      [-0.12, 0.18, -0.20],
    ]),
    qTrack(T, 'KneeL', tKo, [
      [0.32, 0, 0],
      [0.64, 0, 0],
      [1.52, 0, 0],
      [0.48, 0, 0],
      [0.24, 0, 0],
    ]),
    qTrack(T, 'AnkleL', tKo, [
      [-0.16, 0, 0],
      [-0.32, 0, 0],
      [-0.66, 0, 0],
      [0.18, 0, 0],
      [0.26, 0, 0],
    ]),
    qTrack(T, 'HipR', tKo, [
      [-0.12, -0.08, 0.04],
      [-0.26, -0.10, 0.08],
      [-0.78, -0.14, 0.14],
      [-0.18, -0.18, 0.20],
      [-0.06, -0.20, 0.22],
    ]),
    qTrack(T, 'KneeR', tKo, [
      [0.26, 0, 0],
      [0.58, 0, 0],
      [1.46, 0, 0],
      [0.38, 0, 0],
      [0.18, 0, 0],
    ]),
    qTrack(T, 'AnkleR', tKo, [
      [-0.14, 0, 0],
      [-0.32, 0, 0],
      [-0.68, 0, 0],
      [0.20, 0, 0],
      [0.28, 0, 0],
    ]),
  ]);

  const clips = Object.freeze({
    idle_breathe: idleClip,
    combat_stance: combatStanceClip,
    melee_slash: meleeSlashClip,
    recoil_fire: recoilFireClip,
    vault_crack: vaultCrackClip,
    heavy_bag_hook: heavyBagHookClip,
    hit_react: hitReactClip,
    ko_collapse: koCollapseClip,
  });

  _clipCacheByThree.set(T, clips);
  return clips;
}

function buildDefaultOperativeProp(T, weaponId, mats) {
  const id = String(weaponId || '').toLowerCase();
  if (!id || id === 'fists' || id === 'none') return null;

  const prop = new T.Group();
  prop.name = `z3d-rig-prop-${id}`;
  const steelMat = makeOperativeMat(T, 0x334155, 0.26, 0.88, false);
  const darkGripMat = makeOperativeMat(T, 0x111827, 0.55, 0.35, false);

  if (/knife|razor|blade|dagger|katana|sword/.test(id)) {
    const isKatana = /katana|sword/.test(id);
    const len = isKatana ? 0.56 : 0.24;
    const handle = new T.Mesh(new T.CylinderGeometry(0.016, 0.018, 0.11, 8), darkGripMat);
    handle.rotation.x = Math.PI / 2;
    const guard = new T.Mesh(new T.BoxGeometry(0.06, 0.02, 0.02), mats.trim);
    guard.position.z = 0.06;
    const blade = new T.Mesh(new T.BoxGeometry(0.012, 0.032, len), steelMat);
    blade.position.z = 0.06 + len * 0.5;
    prop.add(handle, guard, blade);
  } else if (/bat|club|crowbar/.test(id)) {
    const shaft = new T.Mesh(new T.CylinderGeometry(0.026, 0.016, 0.52, 10), mats.trim);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.20;
    prop.add(shaft);
  } else if (/drill/.test(id)) {
    const body = new T.Mesh(new T.BoxGeometry(0.08, 0.11, 0.22), mats.trim);
    body.position.set(0, 0.03, 0.08);
    const bit = new T.Mesh(new T.ConeGeometry(0.024, 0.16, 10), steelMat);
    bit.rotation.x = Math.PI / 2;
    bit.position.set(0, 0.03, 0.26);
    prop.add(body, bit);
  } else if (/pistol|revolver|magnum|glock/.test(id)) {
    const grip = new T.Mesh(new T.BoxGeometry(0.034, 0.10, 0.048), darkGripMat);
    grip.rotation.x = 0.22;
    const slide = new T.Mesh(new T.BoxGeometry(0.038, 0.046, 0.20), steelMat);
    slide.position.set(0, 0.05, 0.07);
    prop.add(grip, slide);
  } else if (/xanax|vicodin|ecstasy|medkit|morphine|gold/.test(id)) {
    const caseMesh = new T.Mesh(new T.BoxGeometry(0.09, 0.06, 0.12), mats.trim);
    caseMesh.position.set(0, 0.0, 0.06);
    prop.add(caseMesh);
  } else {
    // Assault rifle / shotgun / sniper / SMG silhouette
    const isLong = /sniper|shotgun/.test(id);
    const barrelLen = isLong ? 0.44 : 0.32;
    const receiver = new T.Mesh(new T.BoxGeometry(0.046, 0.075, 0.26), darkGripMat);
    receiver.position.set(0, 0.03, 0.08);
    const barrel = new T.Mesh(new T.CylinderGeometry(0.014, 0.016, barrelLen, 10), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, 0.21 + barrelLen * 0.45);
    const mag = new T.Mesh(new T.BoxGeometry(0.032, 0.12, 0.052), mats.trim);
    mag.rotation.x = -0.22;
    mag.position.set(0, -0.04, 0.12);
    const stock = new T.Mesh(new T.BoxGeometry(0.038, 0.068, 0.14), darkGripMat);
    stock.position.set(0, 0.02, -0.10);
    prop.add(receiver, barrel, mag, stock);
  }

  prop.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return prop;
}

function buildDumbbellProp(T, mats) {
  const db = new T.Group();
  db.name = 'z3d-rig-dumbbell';
  const bar = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.24, 10), mats.trim);
  bar.rotation.z = Math.PI / 2;
  const wL = new T.Mesh(new T.CylinderGeometry(0.058, 0.058, 0.04, 12), mats.shoe);
  wL.rotation.z = Math.PI / 2;
  wL.position.x = -0.095;
  const wR = wL.clone();
  wR.position.x = 0.095;
  db.add(bar, wL, wR);
  db.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return db;
}

/**
 * Constructs a hierarchical articulated 3D Syndicate operative driven by THREE.AnimationMixer.
 * Supports both `createRiggedOperative3D(THREE_REF, opts)` and `createRiggedOperative3D(opts)`.
 */
export function createRiggedOperative3D(threeOrOpts = THREE, maybeOpts = {}) {
  let T = THREE;
  let opts = maybeOpts || {};
  if (threeOrOpts && typeof threeOrOpts === 'object') {
    if (typeof threeOrOpts.Group === 'function' && typeof threeOrOpts.AnimationMixer === 'function') {
      T = threeOrOpts;
      opts = maybeOpts || {};
    } else {
      T = THREE;
      opts = threeOrOpts;
    }
  }

  const role = normalizeOperativeRole(opts.role, opts);
  const rolePreset = ROLE_PRESETS[role] || ROLE_PRESETS.player;
  let currentOutfit = normalizeOperativeOutfit(
    opts.outfit || (role === 'nemesis' || role === 'guard' || opts.bossCrown ? 'tactical' : 'street')
  );

  const rimHex = opts.rimColor !== undefined ? opts.rimColor : rolePreset.rimHex;
  const rimIntensity = typeof opts.rimIntensity === 'number' ? opts.rimIntensity : rolePreset.rimIntensity;
  const skinHex = opts.skinColor !== undefined ? opts.skinColor : rolePreset.skinHex;
  const rootScale = typeof opts.scale === 'number' ? opts.scale : rolePreset.scale;

  const palette = OUTFIT_PALETTES[currentOutfit];
  const initialCoatHex = opts.coatColor !== undefined
    ? opts.coatColor
    : (rolePreset.coatOverride !== null ? rolePreset.coatOverride : palette.coatHex);
  const initialTrimHex = opts.trimColor !== undefined
    ? opts.trimColor
    : (rolePreset.trimOverride !== null ? rolePreset.trimOverride : palette.trimHex);

  const mats = {
    coat: makeOperativeMat(T, initialCoatHex, palette.roughness, palette.metalness, {
      color: rimHex,
      power: 2.2,
      intensity: rimIntensity,
      pulseHz: 0.8,
    }),
    secondary: makeOperativeMat(T, palette.secondaryHex, 0.48, 0.35, {
      color: rimHex,
      power: 2.5,
      intensity: rimIntensity * 0.72,
    }),
    pants: makeOperativeMat(T, palette.pantsHex, 0.54, 0.24, {
      color: rimHex,
      power: 2.6,
      intensity: rimIntensity * 0.65,
    }),
    shoe: makeOperativeMat(T, palette.shoeHex, 0.38, 0.56, {
      color: rimHex,
      power: 2.8,
      intensity: 0.35,
    }),
    skin: makeOperativeMat(T, skinHex, 0.52, 0.08, {
      color: rimHex,
      power: 2.8,
      intensity: 0.32,
    }),
    trim: makeOperativeMat(T, initialTrimHex, 0.24, 0.86, {
      color: rimHex,
      power: 2.2,
      intensity: 0.55,
    }),
    shirt: makeOperativeMat(T, 0xf8fafc, 0.34, 0.10, false),
    tie: makeOperativeMat(T, role === 'boss' ? 0xfbbf24 : 0xdc2626, 0.28, 0.25, false),
    hair: makeOperativeMat(T, 0x181311, 0.62, 0.14, false),
    visor: makeOperativeMat(
      T,
      role === 'nemesis' || role === 'boss' || opts.bossCrown
        ? 0xef4444
        : role === 'guard'
          ? 0xf59e0b
          : 0x38bdf8,
      0.12,
      0.45,
      false,
      {
        emissive:
          role === 'nemesis' || role === 'boss' || opts.bossCrown
            ? 0xdc2626
            : role === 'guard'
              ? 0xd97706
              : 0x0284c7,
        emissiveIntensity: 0.92,
      }
    ),
    neon: makeOperativeMat(T, initialTrimHex, 0.16, 0.35, false, {
      emissive: initialTrimHex,
      emissiveIntensity: 0.72,
    }),
    eye: makeOperativeMat(T, 0xf8fafc, 0.2, 0.1, false),
    pupil: makeOperativeMat(T, 0x0f172a, 0.2, 0.2, false),
  };

  const group = new T.Group();
  group.name = 'ZoneRiggedOperative';

  const bones = {};
  const createBone = (name, parent, x, y, z) => {
    const b = new T.Group();
    b.name = name;
    b.position.set(x, y, z);
    b.userData.isRigBone = true;
    parent.add(b);
    bones[name] = b;
    return b;
  };

  /* 1. Spine & Head Bone Chain: Pelvis -> Torso -> Chest -> Neck -> Head */
  const Pelvis = createBone('Pelvis', group, 0, 0.68, 0);
  const Torso = createBone('Torso', Pelvis, 0, 0.11, 0);
  const Chest = createBone('Chest', Torso, 0, 0.18, 0);
  const Neck = createBone('Neck', Chest, 0, 0.20, 0);
  const Head = createBone('Head', Neck, 0, 0.10, 0);

  /* 2. Arm Chains: Chest -> ShoulderL/R -> ElbowL/R -> WristL/R -> WeaponMountL/R */
  const ShoulderL = createBone('ShoulderL', Chest, -0.24, 0.14, 0);
  const ElbowL = createBone('ElbowL', ShoulderL, -0.02, -0.22, 0);
  const WristL = createBone('WristL', ElbowL, -0.01, -0.20, 0);
  const WeaponMountL = createBone('WeaponMountL', WristL, 0, -0.04, 0.05);

  const ShoulderR = createBone('ShoulderR', Chest, 0.24, 0.14, 0);
  const ElbowR = createBone('ElbowR', ShoulderR, 0.02, -0.22, 0);
  const WristR = createBone('WristR', ElbowR, 0.01, -0.20, 0);
  const WeaponMountR = createBone('WeaponMountR', WristR, 0, -0.04, 0.05);

  /* 3. Leg Chains: Pelvis -> HipL/R -> KneeL/R -> AnkleL/R */
  const HipL = createBone('HipL', Pelvis, -0.115, -0.04, 0);
  const KneeL = createBone('KneeL', HipL, 0, -0.29, 0.01);
  const AnkleL = createBone('AnkleL', KneeL, 0, -0.27, -0.01);

  const HipR = createBone('HipR', Pelvis, 0.115, -0.04, 0);
  const KneeR = createBone('KneeR', HipR, 0, -0.29, 0.01);
  const AnkleR = createBone('AnkleR', KneeR, 0, -0.27, -0.01);

  /* 4.Outfit Layer Registry for instant runtime switching */
  const outfitLayers = {
    street: [],
    suit: [],
    tactical: [],
  };
  const registerLayer = (outfitKey, obj) => {
    obj.userData.outfitLayer = outfitKey;
    outfitLayers[outfitKey].push(obj);
    return obj;
  };

  /* --- Pelvis & Utility Belt Geometry --- */
  const pelvisCore = new T.Mesh(new T.BoxGeometry(0.32, 0.13, 0.20), mats.pants);
  pelvisCore.position.set(0, 0.0, 0);
  const beltBand = new T.Mesh(new T.BoxGeometry(0.34, 0.05, 0.22), mats.shoe);
  beltBand.position.set(0, 0.055, 0);
  const beltBuckle = new T.Mesh(new T.BoxGeometry(0.075, 0.058, 0.235), mats.trim);
  beltBuckle.position.set(0, 0.055, 0);
  Pelvis.add(pelvisCore, beltBand, beltBuckle);

  /* --- Torso (Lower Spine / Waist) --- */
  const torsoCore = new T.Mesh(new T.CylinderGeometry(0.175, 0.155, 0.22, 12), mats.coat);
  torsoCore.scale.set(1.04, 1, 0.72);
  torsoCore.position.set(0, 0.08, 0);
  Torso.add(torsoCore);

  /* --- Chest (Ribcage + Collar + Outfit Jacket/Suit/Kevlar) --- */
  const chestCore = new T.Mesh(new T.CylinderGeometry(0.215, 0.178, 0.26, 14), mats.coat);
  chestCore.scale.set(1.06, 1, 0.74);
  chestCore.position.set(0, 0.08, 0);
  Chest.add(chestCore);

  // Street Outfit Chest: Hoodie Kangaroo Pocket + Neon Zipper Rails + Draped Hood Collar
  const streetChestGrp = registerLayer('street', new T.Group());
  streetChestGrp.name = 'OutfitStreetChest';
  const hoodBack = new T.Mesh(new T.TorusGeometry(0.135, 0.044, 10, 18), mats.secondary);
  hoodBack.rotation.x = Math.PI * 0.5 + 0.24;
  hoodBack.position.set(0, 0.20, -0.02);
  const neonZipL = new T.Mesh(new T.BoxGeometry(0.018, 0.25, 0.02), mats.neon);
  neonZipL.position.set(-0.032, 0.08, 0.145);
  const neonZipR = neonZipL.clone();
  neonZipR.position.x = 0.032;
  const pocket = new T.Mesh(new T.BoxGeometry(0.24, 0.09, 0.03), mats.secondary);
  pocket.position.set(0, -0.03, 0.132);
  streetChestGrp.add(hoodBack, neonZipL, neonZipR, pocket);
  Chest.add(streetChestGrp);

  // Suit Outfit Chest: Double-Breasted Syndicate Blazer Lapels + Crisp Shirt + Silk Tie + 4 Brass Buttons
  const suitChestGrp = registerLayer('suit', new T.Group());
  suitChestGrp.name = 'OutfitSuitChest';
  const shirtInsert = new T.Mesh(new T.BoxGeometry(0.13, 0.24, 0.03), mats.shirt);
  shirtInsert.position.set(0, 0.10, 0.138);
  const silkTie = new T.Mesh(new T.BoxGeometry(0.042, 0.24, 0.038), mats.tie);
  silkTie.position.set(0, 0.07, 0.144);
  const lapelL = new T.Mesh(new T.BoxGeometry(0.055, 0.22, 0.028), mats.secondary);
  lapelL.position.set(-0.075, 0.09, 0.145);
  lapelL.rotation.z = -0.22;
  const lapelR = new T.Mesh(new T.BoxGeometry(0.055, 0.22, 0.028), mats.secondary);
  lapelR.position.set(0.075, 0.09, 0.145);
  lapelR.rotation.z = 0.22;
  suitChestGrp.add(shirtInsert, silkTie, lapelL, lapelR);
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col <= 1; col += 2) {
      const btn = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.014, 10), mats.trim);
      btn.rotation.x = Math.PI * 0.5;
      btn.position.set(col * 0.058, 0.02 - row * 0.065, 0.152);
      suitChestGrp.add(btn);
    }
  }
  Chest.add(suitChestGrp);

  // Tactical Outfit Chest: Segmented Kevlar Carrier + MOLLE Pouches + Ballistic Collar + Comms Antenna
  const tactChestGrp = registerLayer('tactical', new T.Group());
  tactChestGrp.name = 'OutfitTacticalChest';
  const plateFront = new T.Mesh(new T.BoxGeometry(0.34, 0.24, 0.055), mats.secondary);
  plateFront.position.set(0, 0.08, 0.135);
  const plateBack = new T.Mesh(new T.BoxGeometry(0.33, 0.24, 0.05), mats.secondary);
  plateBack.position.set(0, 0.08, -0.135);
  const traumaTrim = new T.Mesh(new T.BoxGeometry(0.28, 0.045, 0.065), mats.trim);
  traumaTrim.position.set(0, 0.14, 0.138);
  tactChestGrp.add(plateFront, plateBack, traumaTrim);
  for (let p = -1; p <= 1; p++) {
    const pouch = new T.Mesh(new T.BoxGeometry(0.075, 0.085, 0.045), mats.trim);
    pouch.position.set(p * 0.092, 0.0, 0.165);
    tactChestGrp.add(pouch);
  }
  const gorget = new T.Mesh(new T.TorusGeometry(0.125, 0.032, 8, 16), mats.secondary);
  gorget.rotation.x = Math.PI * 0.5;
  gorget.position.set(0, 0.20, 0);
  const antenna = new T.Mesh(new T.CylinderGeometry(0.005, 0.007, 0.24, 6), mats.shoe);
  antenna.position.set(-0.15, 0.28, -0.11);
  tactChestGrp.add(gorget, antenna);
  Chest.add(tactChestGrp);

  /* --- Neck & Sculpted Head + Visor/Hair/Collar Details --- */
  const neckCol = new T.Mesh(new T.CylinderGeometry(0.062, 0.074, 0.11, 10), mats.skin);
  neckCol.position.set(0, 0.04, 0);
  const collarRing = new T.Mesh(new T.TorusGeometry(0.082, 0.022, 8, 16), mats.trim);
  collarRing.rotation.x = Math.PI * 0.5;
  collarRing.position.set(0, 0.01, 0);
  Neck.add(neckCol, collarRing);

  const cranium = new T.Mesh(new T.SphereGeometry(0.138, 18, 14), mats.skin);
  cranium.scale.set(0.95, 1.06, 0.98);
  cranium.position.set(0, 0.08, 0);
  const jaw = new T.Mesh(new T.BoxGeometry(0.155, 0.095, 0.155), mats.skin);
  jaw.position.set(0, 0.018, 0.025);
  const nose = new T.Mesh(new T.ConeGeometry(0.022, 0.052, 6), mats.skin);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, 0.068, 0.142);
  const earL = new T.Mesh(new T.SphereGeometry(0.028, 8, 8), mats.skin);
  earL.scale.set(0.5, 1.0, 0.8);
  earL.position.set(-0.13, 0.065, 0);
  const earR = earL.clone();
  earR.position.x = 0.13;
  const eyeL = new T.Mesh(new T.SphereGeometry(0.018, 8, 8), mats.eye);
  eyeL.position.set(-0.046, 0.082, 0.122);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.046;
  const pupilL = new T.Mesh(new T.SphereGeometry(0.010, 6, 6), mats.pupil);
  pupilL.position.set(-0.046, 0.082, 0.135);
  const pupilR = pupilL.clone();
  pupilR.position.x = 0.046;
  Head.add(cranium, jaw, nose, earL, earR, eyeL, eyeR, pupilL, pupilR);

  // Street Headgear: Textured Fade Hair/Cap + Sleek Wraparound Shades
  const streetHeadGrp = registerLayer('street', new T.Group());
  streetHeadGrp.name = 'OutfitStreetHead';
  const streetHair = new T.Mesh(
    new T.SphereGeometry(0.146, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mats.hair
  );
  streetHair.position.set(0, 0.092, -0.005);
  const streetShades = new T.Mesh(new T.BoxGeometry(0.21, 0.044, 0.12), mats.shoe);
  streetShades.position.set(0, 0.084, 0.092);
  const shadesNeon = new T.Mesh(new T.BoxGeometry(0.214, 0.010, 0.124), mats.neon);
  shadesNeon.position.set(0, 0.102, 0.094);
  streetHeadGrp.add(streetHair, streetShades, shadesNeon);
  if (role === 'boxer') {
    const headband = new T.Mesh(new T.CylinderGeometry(0.144, 0.144, 0.032, 18), mats.trim);
    headband.position.set(0, 0.115, 0);
    streetHeadGrp.add(headband);
  }
  Head.add(streetHeadGrp);

  // Suit Headgear: Syndicate Noir Fedora + Gold Ribbon + Slick Hairline
  const suitHeadGrp = registerLayer('suit', new T.Group());
  suitHeadGrp.name = 'OutfitSuitHead';
  const suitHair = new T.Mesh(
    new T.SphereGeometry(0.143, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
    mats.hair
  );
  suitHair.position.set(0, 0.09, -0.01);
  const fedoraBrim = new T.Mesh(new T.CylinderGeometry(0.235, 0.235, 0.022, 22), mats.shoe);
  fedoraBrim.position.set(0, 0.165, 0.01);
  fedoraBrim.rotation.x = 0.06;
  const fedoraCrown = new T.Mesh(new T.CylinderGeometry(0.125, 0.15, 0.13, 18), mats.shoe);
  fedoraCrown.position.set(0, 0.23, 0);
  const fedoraBand = new T.Mesh(new T.CylinderGeometry(0.152, 0.152, 0.028, 18), mats.trim);
  fedoraBand.position.set(0, 0.184, 0);
  suitHeadGrp.add(suitHair, fedoraBrim, fedoraCrown, fedoraBand);
  Head.add(suitHeadGrp);

  // Tactical Headgear: Ballistic Combat Helmet + Panoramic Glowing HUD Visor
  const tactHeadGrp = registerLayer('tactical', new T.Group());
  tactHeadGrp.name = 'OutfitTacticalHead';
  const tacHelm = new T.Mesh(
    new T.SphereGeometry(0.158, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mats.secondary
  );
  tacHelm.position.set(0, 0.092, 0);
  const tacVisor = new T.Mesh(new T.BoxGeometry(0.235, 0.062, 0.155), mats.visor);
  tacVisor.position.set(0, 0.085, 0.088);
  const helmCrest = new T.Mesh(new T.BoxGeometry(0.055, 0.04, 0.22), mats.trim);
  helmCrest.position.set(0, 0.225, 0);
  tactHeadGrp.add(tacHelm, tacVisor, helmCrest);
  Head.add(tactHeadGrp);

  // Boss / Nemesis Signature Crown Crest (always visible on boss/nemesis roles)
  if (role === 'boss' || role === 'nemesis' || opts.bossCrown) {
    const bossVisor = new T.Mesh(new T.BoxGeometry(0.24, 0.058, 0.16), mats.visor);
    bossVisor.position.set(0, 0.086, 0.09);
    Head.add(bossVisor);
  }

  /* --- Arms Builder (Shoulder -> Elbow -> Wrist) --- */
  const buildArmMeshes = (side, shoulderBone, elbowBone, wristBone) => {
    const deltoid = new T.Mesh(new T.SphereGeometry(0.076, 12, 10), mats.coat);
    const upperArm = new T.Mesh(new T.CapsuleGeometry(0.055, 0.15, 6, 10), mats.coat);
    upperArm.position.set(side * 0.01, -0.11, 0);
    shoulderBone.add(deltoid, upperArm);

    // Tactical Armored Pauldron
    const pauldron = registerLayer(
      'tactical',
      new T.Mesh(new T.BoxGeometry(0.13, 0.11, 0.15), mats.trim)
    );
    pauldron.position.set(side * 0.03, 0.015, 0);
    pauldron.rotation.z = side * -0.18;
    shoulderBone.add(pauldron);

    const elbowJoint = new T.Mesh(new T.SphereGeometry(0.052, 10, 8), mats.secondary);
    const forearm = new T.Mesh(new T.CapsuleGeometry(0.048, 0.14, 6, 10), mats.coat);
    forearm.position.set(0, -0.10, 0);
    elbowBone.add(elbowJoint, forearm);

    // Street Cuff Band / Suit French Cuff
    const streetCuff = registerLayer(
      'street',
      new T.Mesh(new T.CylinderGeometry(0.053, 0.050, 0.032, 10), mats.neon)
    );
    streetCuff.position.set(0, -0.175, 0);
    elbowBone.add(streetCuff);

    const suitCuff = registerLayer(
      'suit',
      new T.Mesh(new T.CylinderGeometry(0.052, 0.050, 0.03, 10), mats.shirt)
    );
    suitCuff.position.set(0, -0.175, 0);
    elbowBone.add(suitCuff);

    if (role === 'boxer' && !opts.dumbbells) {
      const boxingGlove = new T.Mesh(new T.SphereGeometry(0.078, 12, 10), mats.trim);
      boxingGlove.scale.set(0.95, 1.15, 1.05);
      boxingGlove.position.set(0, -0.045, 0.015);
      wristBone.add(boxingGlove);
    } else {
      const palm = new T.Mesh(new T.BoxGeometry(0.062, 0.072, 0.042), mats.skin);
      palm.position.set(0, -0.038, 0.006);
      const tacGlove = registerLayer(
        'tactical',
        new T.Mesh(new T.BoxGeometry(0.068, 0.065, 0.048), mats.shoe)
      );
      tacGlove.position.set(0, -0.032, 0.006);
      wristBone.add(palm, tacGlove);
    }
  };

  buildArmMeshes(-1, ShoulderL, ElbowL, WristL);
  buildArmMeshes(1, ShoulderR, ElbowR, WristR);

  /* --- Legs Builder (Hip -> Knee -> Ankle, sole grounded at y = 0.00) --- */
  const buildLegMeshes = (hipBone, kneeBone, ankleBone) => {
    const thigh = new T.Mesh(new T.CapsuleGeometry(0.076, 0.19, 6, 10), mats.pants);
    thigh.position.set(0, -0.145, 0);
    hipBone.add(thigh);

    const kneeCap = new T.Mesh(new T.SphereGeometry(0.064, 10, 8), mats.pants);
    const calf = new T.Mesh(new T.CapsuleGeometry(0.060, 0.17, 6, 10), mats.pants);
    calf.position.set(0, -0.135, 0);
    kneeBone.add(kneeCap, calf);

    const tacKneePad = registerLayer(
      'tactical',
      new T.Mesh(new T.BoxGeometry(0.11, 0.10, 0.065), mats.trim)
    );
    tacKneePad.position.set(0, 0.0, 0.052);
    kneeBone.add(tacKneePad);

    // Base Footwear (sole bottom at y = -0.08 in Ankle space -> y = 0.00 in root space)
    const bootUpper = new T.Mesh(new T.BoxGeometry(0.105, 0.07, 0.195), mats.shoe);
    bootUpper.position.set(0, -0.035, 0.032);
    const bootSole = new T.Mesh(new T.BoxGeometry(0.112, 0.022, 0.205), mats.shoe);
    bootSole.position.set(0, -0.069, 0.032);
    ankleBone.add(bootUpper, bootSole);

    // Street Sneaker White/Neon Midsole + High-Top Tongue
    const streetSneaker = registerLayer('street', new T.Group());
    const sneakerMidsole = new T.Mesh(new T.BoxGeometry(0.116, 0.020, 0.21), mats.shirt);
    sneakerMidsole.position.set(0, -0.068, 0.034);
    const sneakerTongue = new T.Mesh(new T.BoxGeometry(0.075, 0.05, 0.03), mats.neon);
    sneakerTongue.position.set(0, 0.01, 0.065);
    streetSneaker.add(sneakerMidsole, sneakerTongue);
    ankleBone.add(streetSneaker);

    // Suit Polished Oxford Spat / Gold Trim
    const suitShoe = registerLayer(
      'suit',
      new T.Mesh(new T.BoxGeometry(0.108, 0.016, 0.06), mats.trim)
    );
    suitShoe.position.set(0, -0.02, 0.075);
    ankleBone.add(suitShoe);

    // Tactical Heavy Combat Shin/Ankle Guard
    const tactBoot = registerLayer(
      'tactical',
      new T.Mesh(new T.BoxGeometry(0.116, 0.095, 0.11), mats.secondary)
    );
    tactBoot.position.set(0, 0.025, 0.015);
    ankleBone.add(tactBoot);
  };

  buildLegMeshes(HipL, KneeL, AnkleL);
  buildLegMeshes(HipR, KneeR, AnkleR);

  /* 5. Outfit Visibility & Palette Applicator */
  const applyOutfitState = (nextOutfit) => {
    const norm = normalizeOperativeOutfit(nextOutfit);
    currentOutfit = norm;
    const pal = OUTFIT_PALETTES[norm];

    if (opts.coatColor === undefined && rolePreset.coatOverride === null) {
      mats.coat.color.setHex(pal.coatHex);
    }
    mats.coat.roughness = pal.roughness;
    mats.coat.metalness = pal.metalness;
    mats.secondary.color.setHex(pal.secondaryHex);
    mats.pants.color.setHex(pal.pantsHex);
    mats.shoe.color.setHex(pal.shoeHex);
    if (opts.trimColor === undefined && rolePreset.trimOverride === null) {
      mats.trim.color.setHex(pal.trimHex);
      mats.neon.color.setHex(pal.trimHex);
      if (mats.neon.emissive) mats.neon.emissive.setHex(pal.trimHex);
    }

    for (const key of OPERATIVE_OUTFITS) {
      const visible = key === norm;
      const list = outfitLayers[key];
      for (let i = 0; i < list.length; i++) {
        list[i].visible = visible;
      }
    }
    group.userData.outfit = norm;
    return norm;
  };

  applyOutfitState(currentOutfit);

  /* 6. Prop / Weapon Attachment (`WeaponMountR` / `WeaponMountL`) */
  const attachProp = (mesh3d, mountName = 'WeaponMountR') => {
    const mount = bones[mountName] || WeaponMountR;
    while (mount.children.length > 0) {
      mount.remove(mount.children[0]);
    }
    if (mesh3d && typeof mesh3d === 'object') {
      mount.add(mesh3d);
    }
    return mount;
  };

  if (opts.propMesh) {
    attachProp(opts.propMesh, 'WeaponMountR');
  } else if (opts.dumbbells) {
    attachProp(buildDumbbellProp(T, mats), 'WeaponMountL');
    attachProp(buildDumbbellProp(T, mats), 'WeaponMountR');
  } else if (opts.weaponId) {
    const defaultProp = buildDefaultOperativeProp(T, opts.weaponId, mats);
    if (defaultProp) attachProp(defaultProp, 'WeaponMountR');
  }

  /* 7. Shadow Flags & Root Scale */
  group.scale.setScalar(rootScale);
  group.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  /* 8. THREE.AnimationMixer + 8 Smooth Keyframe Clips + Crossfade Blending */
  const clips = buildOperativeAnimationClips(T);
  const mixer = new T.AnimationMixer(group);
  const actions = {};
  for (let i = 0; i < OPERATIVE_CLIP_NAMES.length; i++) {
    const name = OPERATIVE_CLIP_NAMES[i];
    const action = mixer.clipAction(clips[name]);
    if (LOOPING_CLIPS.has(name)) {
      action.setLoop(T.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = name === 'ko_collapse';
    }
    actions[name] = action;
  }

  let baseClipName = opts.combat ? 'combat_stance' : rolePreset.baseClip;
  let activeClipName = resolveOperativeClipName(opts.initialClip || baseClipName);
  if (LOOPING_CLIPS.has(activeClipName)) {
    baseClipName = activeClipName;
  }
  let activeAction = actions[activeClipName];
  activeAction.reset();
  activeAction.enabled = true;
  activeAction.setEffectiveWeight(1);
  activeAction.play();

  const playState = (clipName, fadeSec = 0.18) => {
    const targetName = resolveOperativeClipName(clipName);
    const nextAction = actions[targetName];
    if (!nextAction) return activeAction;

    const fade = typeof fadeSec === 'number' && Number.isFinite(fadeSec) ? Math.max(0, fadeSec) : 0.18;
    if (LOOPING_CLIPS.has(targetName)) {
      baseClipName = targetName;
    }

    if (activeAction === nextAction) {
      if (!LOOPING_CLIPS.has(targetName)) {
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveTimeScale(1);
        nextAction.setEffectiveWeight(1);
        nextAction.play();
      }
      activeClipName = targetName;
      z3dRig.currentClip = targetName;
      return nextAction;
    }

    const prevAction = activeAction;
    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (prevAction) {
      prevAction.enabled = true;
      if (fade > 0) {
        prevAction.crossFadeTo(nextAction, fade, false);
      } else {
        prevAction.stop();
      }
    }

    activeAction = nextAction;
    activeClipName = targetName;
    z3dRig.currentClip = targetName;
    return nextAction;
  };

  const onActionFinished = (ev) => {
    if (!ev || !ev.action) return;
    const finishedName = ev.action.getClip && ev.action.getClip().name;
    if (!finishedName || finishedName === 'ko_collapse') return;
    if (finishedName === activeClipName && actions[baseClipName]) {
      playState(baseClipName, 0.18);
    }
  };
  mixer.addEventListener('finished', onActionFinished);

  let disposed = false;
  const z3dRig = {
    mixer,
    clips,
    actions,
    bones,
    role,
    outfit: currentOutfit,
    currentClip: activeClipName,
    playState,
    setOutfit(outfitName) {
      const updated = applyOutfitState(outfitName);
      z3dRig.outfit = updated;
      return updated;
    },
    attachProp,
    update(dt = 0.016) {
      if (disposed) return false;
      const safeDt = typeof dt === 'number' && Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
      if (safeDt > 0) {
        mixer.update(safeDt);
      }
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.removeEventListener('finished', onActionFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(group);

      const disposedGeos = new Set();
      const disposedMats = new Set();
      group.traverse((child) => {
        if (child.geometry && !disposedGeos.has(child.geometry)) {
          disposedGeos.add(child.geometry);
          child.geometry.dispose();
        }
        if (child.material) {
          const matList = Array.isArray(child.material) ? child.material : [child.material];
          for (let m = 0; m < matList.length; m++) {
            const mat = matList[m];
            if (!mat || disposedMats.has(mat)) continue;
            disposedMats.add(mat);
            for (const val of Object.values(mat)) {
              if (val && val.isTexture && typeof val.dispose === 'function') {
                val.dispose();
              }
            }
            if (typeof mat.dispose === 'function') mat.dispose();
          }
        }
      });
    },
  };

  group.userData.role = role;
  group.userData.outfit = currentOutfit;
  group.userData.z3dRig = z3dRig;

  // Evaluate t=0 pose cleanly so initial rest quaternions match activeClipName frame 0
  mixer.update(0);
  return group;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__ZoneRiggedOperative = {
    createRiggedOperative3D,
    buildOperativeAnimationClips,
    OPERATIVE_OUTFITS,
    OPERATIVE_ROLES,
    OPERATIVE_CLIP_NAMES,
    OPERATIVE_BONE_NAMES,
  };
}

export default createRiggedOperative3D;

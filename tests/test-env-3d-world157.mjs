import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../lib/three184/three.module.js';
import {
  ENV_STAGE_KINDS,
  MAX_ENV_DRAW_CALLS,
  dressStageEnvironment3D,
} from '../assets/ui/zone-3d-environments.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');

function inspectGroupStats(group) {
  let meshCount = 0;
  let instancedCount = 0;
  let totalInstances = 0;
  let polygonOffsetCount = 0;
  const geometries = new Set();
  const materials = new Set();

  group.traverse((obj) => {
    if (obj.isInstancedMesh) {
      instancedCount++;
      totalInstances += obj.count || 0;
    } else if (obj.isMesh) {
      meshCount++;
    }
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of list) {
        if (!mat) continue;
        materials.add(mat);
        if (mat.polygonOffset === true) polygonOffsetCount++;
      }
    }
  });

  return {
    meshCount,
    instancedCount,
    totalDrawCalls: meshCount + instancedCount,
    totalInstances,
    polygonOffsetCount,
    geometries,
    materials,
  };
}

test('v157 Static Gate: local Three.js r184 only, zero external CDNs, global registration & syntax check', () => {
  const rel = 'assets/ui/zone-3d-environments.mjs';
  const abs = resolve(root, rel);
  assert.ok(existsSync(abs), `Missing owned file: ${rel}`);
  assert.ok(statSync(abs).size > 2000, `Unexpectedly small file: ${rel}`);

  const src = readUtf8(rel);
  assert.ok(src.includes('../../lib/three184/three.module.js'), 'Must import local vendored Three.js r184');
  assert.ok(!/https?:\/\//i.test(src), 'Forbidden external CDN or HTTP URL found');

  execFileSync(process.execPath, ['--check', abs]);

  assert.ok(globalThis.__Zone3DEnvironments, 'globalThis.__Zone3DEnvironments must be registered');
  assert.equal(typeof globalThis.__Zone3DEnvironments.dressStageEnvironment3D, 'function');
  assert.equal(ENV_STAGE_KINDS.length, 7);
});

test('v157 All 7 Stage Environments construct valid THREE.Group <= 28 draw calls with polygonOffset & valid geometry bounds', () => {
  for (const stageKind of ENV_STAGE_KINDS) {
    const scene = new THREE.Scene();
    const env = dressStageEnvironment3D(THREE, stageKind, scene, { viewportWidth: 1280, era: 2 });

    assert.ok(env && env.group && env.group.isGroup, `${stageKind}: must return a THREE.Group`);
    assert.ok(scene.children.includes(env.group), `${stageKind}: group must be attached to scene`);
    assert.equal(typeof env.update, 'function');
    assert.equal(typeof env.setEra, 'function');
    assert.equal(typeof env.dispose, 'function');

    const stats = inspectGroupStats(env.group);
    assert.ok(stats.totalDrawCalls > 0, `${stageKind}: must contain meshes`);
    assert.ok(
      stats.totalDrawCalls <= MAX_ENV_DRAW_CALLS,
      `${stageKind}: draw calls ${stats.totalDrawCalls} exceed cap ${MAX_ENV_DRAW_CALLS}`
    );
    assert.ok(stats.polygonOffsetCount >= 1, `${stageKind}: must use polygonOffset to prevent z-fighting`);

    for (const geo of stats.geometries) {
      const pos = geo.getAttribute('position');
      assert.ok(pos && pos.count > 0, `${stageKind}: every geometry must have vertices`);
      assert.ok(geo.boundingSphere, `${stageKind}: merged/built geometry should have boundingSphere`);
    }

    env.dispose();
  }
});

test('v157 Animation update(0.016), setEra(1..6) palette transitions & Mobile LOD <= 640px simplification', () => {
  for (const stageKind of ENV_STAGE_KINDS) {
    const desktopScene = new THREE.Scene();
    const mobileScene = new THREE.Scene();

    const desktopEnv = dressStageEnvironment3D(THREE, stageKind, desktopScene, { viewportWidth: 1280, era: 1 });
    const mobileEnv = dressStageEnvironment3D(THREE, stageKind, mobileScene, { viewportWidth: 390, era: 1 });

    const dStats = inspectGroupStats(desktopEnv.group);
    const mStats = inspectGroupStats(mobileEnv.group);

    assert.equal(desktopEnv.group.userData.isMobile, false);
    assert.equal(mobileEnv.group.userData.isMobile, true);
    assert.ok(mStats.totalDrawCalls <= MAX_ENV_DRAW_CALLS, `${stageKind} mobile draw calls <= 28`);
    assert.ok(
      mStats.totalDrawCalls <= dStats.totalDrawCalls &&
      (mStats.totalDrawCalls < dStats.totalDrawCalls || mStats.totalInstances <= dStats.totalInstances),
      `${stageKind}: mobile <= 640px must simplify draw calls or instance counts`
    );

    // Step update(0.016) across multiple frames without errors
    for (let f = 0; f < 30; f++) {
      desktopEnv.update(0.016);
      mobileEnv.update(0.016);
    }

    // Era progression 1..6 updates cleanly
    for (let eraNum = 1; eraNum <= 6; eraNum++) {
      const applied = desktopEnv.setEra(eraNum);
      assert.equal(applied, eraNum);
      assert.equal(desktopEnv.group.userData.era, eraNum);
    }

    desktopEnv.dispose();
    mobileEnv.dispose();
  }
});

test('v157 Clean Disposal: dispose() detaches from scene and disposes every geometry and material', () => {
  for (const stageKind of ENV_STAGE_KINDS) {
    const scene = new THREE.Scene();
    const env = dressStageEnvironment3D(THREE, stageKind, scene, { viewportWidth: 1280 });
    const stats = inspectGroupStats(env.group);

    const disposedGeos = new Set();
    const disposedMats = new Set();

    for (const geo of stats.geometries) {
      const orig = geo.dispose.bind(geo);
      geo.dispose = () => {
        disposedGeos.add(geo);
        orig();
      };
    }
    for (const mat of stats.materials) {
      const orig = mat.dispose.bind(mat);
      mat.dispose = () => {
        disposedMats.add(mat);
        orig();
      };
    }

    env.dispose();

    assert.equal(scene.children.includes(env.group), false, `${stageKind}: dispose() must remove group from scene`);
    assert.equal(env.group.children.length, 0, `${stageKind}: dispose() must clear group children`);
    assert.equal(disposedGeos.size, stats.geometries.size, `${stageKind}: every geometry must be disposed`);
    assert.equal(disposedMats.size, stats.materials.size, `${stageKind}: every material must be disposed`);

    // Calling update/dispose post-dispose must be a safe no-op
    env.update(0.016);
    env.dispose();
  }
});

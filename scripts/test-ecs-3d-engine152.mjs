import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  THREE,
  MAX_ENTITIES,
  HERO_ELONGATED_YAW,
  HERO_ELONGATED_PITCH,
  SYSTEM_ORDER,
  STAGE_KINDS,
  WEAPON_ASSET_MAP,
  ZoneEcsWorld,
  applyFresnelRimShader,
  resolveItemArchetype,
  createItemMesh3D,
  createHumanoid3D,
  countMeshStats3D,
  buildStageScene3D,
  createZoneEcs3DRuntime,
} from '../assets/ui/zone-ecs-3d-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('v153 Static Gate: 3D ECS files exist, zero external CDN URLs, JS syntax clean, CSS balanced & #zone-char-3d fallback ready', () => {
  const ownedFiles = [
    'assets/ui/zone-ecs-3d-engine.mjs',
    'assets/ui/zone-ecs-3d-bridge.js',
    'assets/ui/zone-ecs-3d.css',
  ];

  for (const rel of ownedFiles) {
    const abs = resolve(root, rel);
    assert.ok(existsSync(abs), `Missing required file: ${rel}`);
    assert.ok(statSync(abs).size > 500, `File unexpectedly small: ${rel}`);
    const content = readUtf8(rel);
    assert.ok(!/https?:\/\//i.test(content), `External URL/CDN forbidden in ${rel}`);
  }

  const engineSrc = readUtf8('assets/ui/zone-ecs-3d-engine.mjs');
  for (const localImport of [
    '../../lib/three184/three.module.js',
    '../../lib/three184/OrbitControls.js',
    '../../lib/three184/RoomEnvironment.js',
    '../../lib/three184/OBJLoader.js',
    '../../lib/three184/MTLLoader.js',
    '../../lib/three184/GLTFLoader.js',
  ]) {
    assert.ok(engineSrc.includes(localImport), `Engine must import local vendored ${localImport}`);
  }

  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-ecs-3d-engine.mjs')]);
  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-ecs-3d-bridge.js')]);

  const bridgeSrc = readUtf8('assets/ui/zone-ecs-3d-bridge.js');
  assert.ok(bridgeSrc.includes('window.ZoneEcs3D'), 'Bridge must synchronously expose window.ZoneEcs3D');
  assert.ok(bridgeSrc.includes('zone-ecs-3d-engine.mjs?v=155'), 'Bridge must import zone-ecs-3d-engine.mjs?v=155');
  assert.ok(bridgeSrc.includes('position:absolute;inset:0;width:100%;height:100%'), 'Bridge must overlay character-turntable absolutely at inset:0');
  assert.ok(bridgeSrc.includes('character-turntable'), 'Bridge must mount character-turntable fallback inside #zone-char-3d');
  assert.ok(bridgeSrc.includes('1600'), 'Bridge must arm 1600ms #zone-char-3d watchdog');
  assert.ok(bridgeSrc.includes('data-outfit'), 'Bridge must sync [data-outfit] clicks');

  const cssSrc = readUtf8('assets/ui/zone-ecs-3d.css');
  let depth = 0;
  for (const ch of cssSrc) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    assert.ok(depth >= 0, 'Unbalanced closing brace in zone-ecs-3d.css');
  }
  assert.equal(depth, 0, 'Unclosed CSS block in zone-ecs-3d.css');

  for (const selector of [
    '.z3d-item-slot',
    '.z3d-action-stage',
    '.z3d-stage-hud',
    '.z3d-inspector-modal',
    '.z3d-char-turntable-stage',
    'html[data-theme="light"]',
    'html[dir="rtl"]',
    '@media (max-width: 640px)',
  ]) {
    assert.ok(cssSrc.includes(selector), `Missing required CSS rule in zone-ecs-3d.css: ${selector}`);
  }
});

test('v153 ECS Architecture: contiguous TypedArray stores (MAX_ENTITIES=512), ordered 6-system schedule, and deferred EntityCommandBuffer', () => {
  assert.equal(MAX_ENTITIES, 512);
  const world = new ZoneEcsWorld();

  assert.ok(world.stores.Transform3D instanceof Float32Array);
  assert.equal(world.stores.Transform3D.length, 512 * 10);
  assert.ok(world.stores.Velocity3D instanceof Float32Array);
  assert.ok(world.stores.TurntableSpin instanceof Float32Array);
  assert.ok(world.stores.HoverFloat instanceof Float32Array);
  assert.ok(world.stores.TraumaShake instanceof Float32Array);
  assert.ok(world.stores.HitStopState instanceof Float32Array);
  assert.ok(world.stores.HitStopIds instanceof Uint32Array);
  assert.ok(world.stores.FresnelRim instanceof Float32Array);
  assert.ok(world.stores.InteractivePickable instanceof Uint32Array);

  let deferredEid = -1;
  world.ecb.spawn((eid, w) => {
    deferredEid = eid;
    w.setVelocity(eid, 10, 0, -5, 0, 2, 0);
  });
  assert.equal(world.aliveCount, 0, 'ECB spawn must be deferred before flush');

  world.step(0.1);
  assert.deepEqual(world.lastSystemOrder, [...SYSTEM_ORDER]);
  assert.equal(world.aliveCount, 1);
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 0] - 1.0) < 1e-5);
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 2] - -0.5) < 1e-5);
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 4] - 0.2) < 1e-5);

  world.ecb.despawn(deferredEid);
  assert.equal(world.isAlive(deferredEid), true);
  world.ecb.flush(world);
  assert.equal(world.isAlive(deferredEid), false);
});

test('v153 Game Feel: Squirrel Eiserloh trauma^2 camera shake & overlapping-safe real-time Hit-Stop', () => {
  const worldHalf = new ZoneEcsWorld();
  const camHalf = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camHalf.position.set(0, 2, 5);
  const eidHalf = worldHalf.spawnImmediate(camHalf);
  worldHalf.setTraumaCamera(eidHalf, { decay: 0, maxOffsetX: 1.0, maxOffsetY: 1.0, maxRoll: 0.2 });
  worldHalf.addTrauma(eidHalf, 0.5);
  worldHalf.step(0.05);

  const worldFull = new ZoneEcsWorld();
  const camFull = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camFull.position.set(0, 2, 5);
  const eidFull = worldFull.spawnImmediate(camFull);
  worldFull.setTraumaCamera(eidFull, { decay: 0, maxOffsetX: 1.0, maxOffsetY: 1.0, maxRoll: 0.2 });
  worldFull.addTrauma(eidFull, 1.0);
  worldFull.step(0.05);

  assert.ok(Math.abs(camHalf.position.x / camFull.position.x - 0.25) < 1e-4);

  const world = new ZoneEcsWorld();
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  cam.position.set(0, 2, 6);
  const camEid = world.spawnImmediate(cam);
  world.setTraumaCamera(camEid, { decay: 2.0, maxOffsetX: 0.5, maxOffsetY: 0.4, maxRoll: 0.1 });
  world.addTrauma(camEid, 0.8);

  const id1 = world.triggerHitStop(0.06, 0.05, camEid);
  world.step(0.03);
  assert.equal(world.timeScale, 0.05);

  const id2 = world.triggerHitStop(0.10, 0.02, camEid);
  assert.ok(id2 > id1);
  world.step(0.05);
  assert.equal(world.timeScale, 0.02, 'Overlapping newer hit-stop must stay active past older stop expiry');
  world.step(0.06);
  assert.equal(world.timeScale, 1.0);

  for (let i = 0; i < 5; i++) world.step(0.08);
  assert.equal(world.stores.TraumaShake[camEid * 8], 0);
  assert.equal(cam.position.x, 0);
  assert.equal(cam.position.y, 2);
  assert.equal(cam.position.z, 6);
});

test('v153 Custom GLSL ES Fresnel Rim Shader: valid WebGL2 uniform injection & shared program cache key', () => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  applyFresnelRimShader(mat, { color: 0xff3b30, power: 2.2, intensity: 0.85, pulseHz: 1.2 });

  assert.equal(mat.customProgramCacheKey(), 'z3d-fresnel-rim-v153');
  const fakeShader = {
    uniforms: {},
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  mat.onBeforeCompile(fakeShader);

  assert.ok(fakeShader.uniforms.uZ3dRimColor);
  assert.ok(fakeShader.fragmentShader.includes('uniform vec3 uZ3dRimColor;'));
  assert.ok(fakeShader.fragmentShader.includes('outgoingLight += uZ3dRimColor'));
  assert.ok(!/uniform\s+\w+\s+uZ3d\w+\s*=/.test(fakeShader.fragmentShader));
});

test('v153 Hero 3/4 Side-Profile Framing & Unique 3D Meshes for All 13 Crime Enhancers + Tools (Zero Duplicate Glasses)', () => {
  for (const [weaponId, asset] of Object.entries(WEAPON_ASSET_MAP)) {
    if (asset.type === 'glb') {
      assert.ok(existsSync(resolve(root, asset.url.replace(/^\//, ''))), `Mapped GLB missing for ${weaponId}`);
    } else if (asset.type === 'obj') {
      assert.ok(existsSync(resolve(root, asset.obj.replace(/^\//, ''))), `Mapped OBJ missing for ${weaponId}`);
      assert.ok(existsSync(resolve(root, asset.mtl.replace(/^\//, ''))), `Mapped MTL missing for ${weaponId}`);
    }
  }

  // Verify hero 3/4 side-profile orientation & wide horizontal silhouette on AK rifle
  const akMesh = createItemMesh3D('ak', 'weapon', 'legendary', { withPedestalRing: false, disableAsyncUpgrade: true });
  assert.ok(Math.abs(akMesh.rotation.y - HERO_ELONGATED_YAW) < 1e-6);
  assert.ok(Math.abs(akMesh.rotation.x - HERO_ELONGATED_PITCH) < 1e-6);
  akMesh.updateMatrixWorld(true);
  const akBox = new THREE.Box3().setFromObject(akMesh);
  const akSize = new THREE.Vector3();
  akBox.getSize(akSize);
  assert.ok(akSize.x > 1.35, `AK hero 3/4 profile must present wide horizontal span (>1.35), got ${akSize.x}`);

  // Verify ALL 13 Crimes 2.0 enhancers + 6 extra tools resolve to 19 distinct archetypes (zero duplicate glasses!)
  const crimeEnhancerIds = [
    'glasses',            // #1 Search for Cash
    'high_speed_drive',   // #2 Bootlegging
    'paint_mask',         // #3 Graffiti
    'mountain_bike',      // #4 Shoplifting
    'cut_throat_razor',   // #5 Pickpocketing
    'duct_tape',          // #6 Card Skimming (duct_tape)
    'flashlight',         // #7 Burglary
    'megaphone',          // #8 Hustling
    'latex_gloves',       // #9 Disposal
    'office_chair',       // #10 Cracking
    'magnifying_glass',   // #11 Forgery
    'ergonomic_keyboard', // #12 Scamming
    'windproof_lighter',  // #13 Arson
    'skimmer',
    'crowbar',
    'lockpick',
    'drill',
    'hacking_rig',
    'keycard',
  ];

  const seenArchetypes = new Set();
  for (const id of crimeEnhancerIds) {
    const arch = resolveItemArchetype(id, 'enhancer');
    assert.ok(!seenArchetypes.has(arch), `Duplicate enhancer archetype '${arch}' for ${id}`);
    if (id !== 'glasses') {
      assert.notEqual(arch, 'glasses', `${id} must NOT fall back to glasses`);
    }
    seenArchetypes.add(arch);

    const mesh = createItemMesh3D(id, 'enhancer', 'epic', { disableAsyncUpgrade: true });
    const stats = countMeshStats3D(mesh);
    assert.ok(stats.meshCount >= 4, `Enhancer ${id} must be multi-part (>=4 meshes), got ${stats.meshCount}`);
    assert.ok(stats.triangles >= 24, `Enhancer ${id} must have rich 3D geometry, got ${stats.triangles}`);
  }
  assert.equal(seenArchetypes.size, crimeEnhancerIds.length);
});

test('v153 Articulated 3D Syndicate Figures & All 8 Interactive 3D Action Stages (incl. character-turntable)', () => {
  for (const outfit of ['street', 'suit', 'tactical']) {
    const fig = createHumanoid3D({ outfit, weaponId: 'ak', headless: true });
    const stats = countMeshStats3D(fig);
    assert.ok(stats.meshCount >= 18, `Articulated ${outfit} humanoid must have >=18 sub-meshes, got ${stats.meshCount}`);
  }

  assert.equal(STAGE_KINDS.length, 8);
  assert.ok(STAGE_KINDS.includes('character-turntable'));

  for (const stageKind of STAGE_KINDS) {
    const world = new ZoneEcsWorld();
    const built = buildStageScene3D(stageKind, world, {
      era: 1,
      originChosen: false,
      outfit: 'street',
      headless: true,
    });

    assert.equal(built.kind, stageKind);
    assert.ok(built.spawnedEids.length >= 2);
    assert.ok(built.pickableEids.length >= 1);

    const sceneStats = countMeshStats3D(built.scene);
    assert.ok(sceneStats.triangles >= 100);

    if (stageKind === 'safehouse-empire') {
      built.scene.updateMatrixWorld(true);
      built.camera.updateMatrixWorld(true);
      built.camera.updateProjectionMatrix();
      const nemObj = world.object3d[built.refs.nemesisEid];
      const nemWorld = new THREE.Vector3();
      nemObj.getWorldPosition(nemWorld);
      nemWorld.y += 0.85;
      const ndc = nemWorld.clone().project(built.camera);
      let pickedMeta = null;
      world.queuePointerRaycast({
        type: 'click',
        ndcX: ndc.x,
        ndcY: ndc.y,
        camera: built.camera,
        pickableEids: built.pickableEids,
        onResult: (_eid, meta) => { pickedMeta = meta; },
      });
      world.step(0.016);
      assert.equal(pickedMeta?.target, 'nemesis');

      built.updateState({ era: 6, originChosen: true });
      assert.equal(built.refs.compoundGroup.userData.era, 6);
      assert.equal(built.refs.originGroup.visible, false);
    }

    if (stageKind === 'character-turntable') {
      assert.equal(built.refs.charHolder.userData.outfit, 'street');
      built.updateState({ outfit: 'suit' });
      assert.equal(built.refs.charHolder.userData.outfit, 'suit');
      built.updateState({ outfit: 'tactical' });
      assert.equal(built.refs.charHolder.userData.outfit, 'tactical');
    }

    assert.equal(built.triggerAction('boss-confront', { stat: 'str' }), true);
    for (let i = 0; i < 6; i++) world.step(0.04);
    built.dispose();
    assert.equal(world.aliveCount, 0);
  }
});

test('v153 Single-Context WebGL Discipline: 30 item cards + 3 stages allocate strictly 1 shared WebGL context', () => {
  let createdRenderers = 0;
  const mockCreateRenderer = () => {
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
      shadowMap: { enabled: false, type: 0 },
      info: { render: { calls: 14, triangles: 1240 } },
      setPixelRatio() {},
      setClearColor() {},
      setSize(w, h) { domElement.width = w; domElement.height = h; },
      render() {},
      dispose() {},
    };
  };

  const runtime = createZoneEcs3DRuntime({ createRenderer: mockCreateRenderer });

  const makeMockSlot = (id, cat) => {
    const canvas = {
      className: 'z3d-item-canvas',
      width: 220,
      height: 180,
      addEventListener() {},
      getContext: () => ({ clearRect() {}, drawImage() {} }),
    };
    return {
      tagName: 'DIV',
      isConnected: true,
      getAttribute: (k) => (k === 'data-z3d-item' ? id : k === 'data-z3d-cat' ? cat : null),
      hasAttribute: () => false,
      querySelector: () => canvas,
      getBoundingClientRect: () => ({ top: 10, bottom: 110, width: 120, height: 100 }),
    };
  };

  const makeMockStage = (kind) => {
    const stageCanvas = {
      className: 'z3d-stage-webgl-canvas',
      width: 560,
      height: 235,
      style: {},
      addEventListener() {},
      getContext: () => ({ drawImage() {} }),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 560, height: 235 }),
    };
    return {
      tagName: 'DIV',
      isConnected: true,
      firstChild: null,
      getAttribute: (k) => (k === 'data-z3d-stage' ? kind : '1'),
      querySelector: (sel) => (sel.includes('z3d-stage-webgl-canvas') ? stageCanvas : {}),
      appendChild() {},
      insertBefore() {},
      getBoundingClientRect: () => ({ top: 20, bottom: 255, width: 560, height: 235 }),
    };
  };

  const slots = [];
  for (let i = 0; i < 30; i++) {
    slots.push(makeMockSlot(i % 2 === 0 ? 'ak' : 'skimmer', i % 2 === 0 ? 'weapon' : 'enhancer'));
  }
  const stages = [
    makeMockStage('safehouse-empire'),
    makeMockStage('heist-breach'),
    makeMockStage('character-turntable'),
  ];

  runtime.scan({
    querySelectorAll: (sel) => (sel.includes('data-z3d-stage') ? stages : slots),
  });

  runtime.world.step(0.016);
  const diag = runtime.diagnostics();

  assert.equal(diag.ready, true);
  assert.equal(diag.renderedItems, 30);
  assert.equal(diag.activeStages, 3);
  assert.equal(createdRenderers, 1, `Expected strictly 1 shared WebGLRenderer context, got ${createdRenderers}`);
  assert.equal(diag.webglContexts, 1);
  assert.ok(diag.drawCalls > 0);
  assert.equal(diag.contextLost, false);
});

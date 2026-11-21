import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  THREE,
  MAX_ENTITIES,
  COMPONENTS,
  SYSTEM_ORDER,
  STAGE_KINDS,
  WEAPON_ASSET_MAP,
  ZoneEcsWorld,
  applyFresnelRimShader,
  createItemMesh3D,
  countMeshStats3D,
  buildStageScene3D,
  createZoneEcs3DRuntime,
} from '../assets/ui/zone-ecs-3d-engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('v152 Static Gate: 3D ECS files exist, zero external CDN URLs, JS syntax clean, CSS balanced & responsive/RTL/Light-Dark ready', () => {
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

  // Syntax check via node --check
  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-ecs-3d-engine.mjs')]);
  execFileSync(process.execPath, ['--check', resolve(root, 'assets/ui/zone-ecs-3d-bridge.js')]);

  const bridgeSrc = readUtf8('assets/ui/zone-ecs-3d-bridge.js');
  assert.ok(bridgeSrc.includes('window.ZoneEcs3D'), 'Bridge must synchronously expose window.ZoneEcs3D');
  assert.ok(bridgeSrc.includes("import('./zone-ecs-3d-engine.mjs?v=152')"), 'Bridge must dynamically import zone-ecs-3d-engine.mjs?v=152');
  assert.ok(bridgeSrc.includes('MutationObserver'), 'Bridge must auto-scan via MutationObserver');

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
    'html[data-theme="light"]',
    'html[dir="rtl"]',
    '@media (max-width: 640px)',
  ]) {
    assert.ok(cssSrc.includes(selector), `Missing required CSS rule in zone-ecs-3d.css: ${selector}`);
  }
});

test('v152 ECS Architecture: contiguous TypedArray stores (MAX_ENTITIES=512), ordered 6-system schedule, and deferred EntityCommandBuffer', () => {
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

  // Deferred ECB must queue until flush / step
  let deferredEid = -1;
  world.ecb.spawn((eid, w) => {
    deferredEid = eid;
    w.setVelocity(eid, 10, 0, -5, 0, 2, 0);
  });
  assert.equal(world.aliveCount, 0, 'ECB spawn must be deferred before flush');
  assert.equal(world.ecb.length, 1);

  world.step(0.1);
  assert.deepEqual(world.lastSystemOrder, [...SYSTEM_ORDER]);
  assert.equal(world.aliveCount, 1);
  assert.ok(deferredEid >= 0);

  // Verify velocity kinematics integrated 0.1s
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 0] - 1.0) < 1e-5);
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 2] - -0.5) < 1e-5);
  assert.ok(Math.abs(world.stores.Transform3D[deferredEid * 10 + 4] - 0.2) < 1e-5);

  world.ecb.despawn(deferredEid);
  assert.equal(world.isAlive(deferredEid), true, 'ECB despawn must wait for sync point');
  world.ecb.flush(world);
  assert.equal(world.isAlive(deferredEid), false);
  assert.equal(world.aliveCount, 0);
});

test('v152 Game Feel: Squirrel Eiserloh trauma^2 camera shake & overlapping-safe real-time Hit-Stop', () => {
  // 1. Verify shake amplitude scales quadratically (trauma^2): trauma=0.5 -> 0.25x of trauma=1.0
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

  const dxHalf = camHalf.position.x - 0;
  const dxFull = camFull.position.x - 0;
  assert.ok(Math.abs(dxFull) > 0.01, 'Camera shake must produce non-zero offset');
  assert.ok(Math.abs(dxHalf / dxFull - 0.25) < 1e-4, `Expected trauma^2 ratio 0.25, got ${dxHalf / dxFull}`);

  // 2. Verify overlapping Hit-Stops + real-time trauma decay during freeze
  const world = new ZoneEcsWorld();
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  cam.position.set(0, 2, 6);
  const camEid = world.spawnImmediate(cam);
  world.setTraumaCamera(camEid, { decay: 2.0, maxOffsetX: 0.5, maxOffsetY: 0.4, maxRoll: 0.1 });
  world.addTrauma(camEid, 0.8);

  const id1 = world.triggerHitStop(0.06, 0.05, camEid);
  world.step(0.03); // 30ms elapsed -> 30ms left on id1
  assert.equal(world.timeScale, 0.05);

  // Overlapping second hit-stop for 0.10s at slow=0.02!
  const id2 = world.triggerHitStop(0.10, 0.02, camEid);
  assert.ok(id2 > id1);

  // Step 0.05s real time (total 80ms > id1's 60ms, so naive timer would have wrongly restored timeScale!)
  world.step(0.05);
  assert.equal(world.timeScale, 0.02, 'Overlapping newer hit-stop must stay active past older stop expiry');

  // Step remaining 0.06s real time -> hit-stop ends & timeScale returns to 1.0
  world.step(0.06);
  assert.equal(world.timeScale, 1.0, 'Newest hit-stop must restore timeScale=1.0 after real-time duration');

  // Step enough real time for trauma (0.8 at decay 2.0/s -> 0.4s total) to fully settle to exact rest pose
  for (let i = 0; i < 5; i++) world.step(0.08);
  assert.equal(world.stores.TraumaShake[camEid * 8], 0);
  assert.equal(cam.position.x, 0);
  assert.equal(cam.position.y, 2);
  assert.equal(cam.position.z, 6);
  assert.equal(cam.rotation.z, 0);
});

test('v152 Custom GLSL ES Fresnel Rim Shader: valid WebGL2 uniform injection & shared program cache key', () => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  applyFresnelRimShader(mat, { color: 0xff3b30, power: 2.2, intensity: 0.85, pulseHz: 1.2 });

  assert.equal(mat.customProgramCacheKey(), 'z3d-fresnel-rim-v152');
  const fakeShader = {
    uniforms: {},
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  mat.onBeforeCompile(fakeShader);

  assert.ok(fakeShader.uniforms.uZ3dRimColor, 'uZ3dRimColor uniform must be bound');
  assert.ok(fakeShader.fragmentShader.includes('uniform vec3 uZ3dRimColor;'));
  assert.ok(fakeShader.fragmentShader.includes('outgoingLight += uZ3dRimColor'));
  // Ensure NO GLSL ES 3.00 illegal uniform default initializers (`uniform float uZ3d... =`)
  assert.ok(!/uniform\s+\w+\s+uZ3d\w+\s*=/.test(fakeShader.fragmentShader), 'GLSL ES 3.00 forbids inline uniform initializers');
});

test('v152 100% 3D Item Mesh Factory: all 10+ categories build multi-part PBR+Fresnel meshes & all mapped weapon assets exist on disk', () => {
  // Verify every mapped weapon GLB / OBJ+MTL file exists on disk
  for (const [weaponId, asset] of Object.entries(WEAPON_ASSET_MAP)) {
    if (asset.type === 'glb') {
      const rel = asset.url.replace(/^\//, '');
      assert.ok(existsSync(resolve(root, rel)), `Mapped GLB missing for ${weaponId}: ${rel}`);
    } else if (asset.type === 'obj') {
      const relObj = asset.obj.replace(/^\//, '');
      const relMtl = asset.mtl.replace(/^\//, '');
      assert.ok(existsSync(resolve(root, relObj)), `Mapped OBJ missing for ${weaponId}: ${relObj}`);
      assert.ok(existsSync(resolve(root, relMtl)), `Mapped MTL missing for ${weaponId}: ${relMtl}`);
    }
  }

  const catalogSamples = [
    // Firearms & tactical
    ['ak', 'weapon'], ['assaultrifle_1', 'weapon'], ['bullpup_2', 'weapon'],
    ['pistol_t', 'weapon'], ['revolver_5', 'weapon'], ['shotgun_sawedoff', 'weapon'],
    ['sniperrifle_3', 'weapon'], ['submachinegun_2', 'weapon'], ['flash_grenade', 'weapon'],
    // Melee
    ['knife', 'melee'], ['bat', 'melee'], ['katana', 'melee'], ['crowbar', 'melee'],
    ['hammer', 'melee'], ['stun_baton', 'melee'], ['cut_throat_razor', 'melee'],
    // Drugs
    ['xanax', 'drug'], ['vicodin', 'drug'], ['ecstasy', 'drug'], ['ketamine', 'drug'],
    ['lsd', 'drug'], ['shrooms', 'drug'], ['opium', 'drug'], ['pcp', 'drug'],
    ['speed', 'drug'], ['cannabis', 'drug'],
    // Medical
    ['small_medkit', 'medical'], ['medkit', 'medical'], ['morphine', 'medical'],
    ['bloodbag', 'medical'], ['neumune', 'medical'],
    // Boosters
    ['edrink', 'booster'], ['candy', 'booster'], ['feathery', 'booster'],
    ['edvd', 'booster'], ['fhc', 'booster'], ['alcohol', 'booster'], ['lawyer_card', 'booster'],
    // Armor / Paperdoll
    ['helmet', 'armor'], ['kevlar', 'armor'], ['combat_vest', 'armor'], ['gloves', 'armor'],
    ['boots', 'armor'], ['pants', 'armor'], ['amulet', 'armor'], ['ring', 'armor'],
    // Enhancers / Contraband / Vehicles / Caches
    ['glasses', 'enhancer'], ['lockpicks', 'enhancer'], ['high_speed_drive', 'enhancer'],
    ['plushie', 'contraband'], ['orchid', 'contraband'], ['gold_bullion', 'contraband'],
    ['weapon_cache', 'cache'], ['sports_car', 'vehicle'],
  ];

  for (const [id, cat] of catalogSamples) {
    const mesh = createItemMesh3D(id, cat, 'legendary', { disableAsyncUpgrade: true });
    assert.ok(mesh.isObject3D, `Mesh for ${id} must be THREE.Object3D`);
    const stats = countMeshStats3D(mesh);
    assert.ok(stats.meshCount >= 4, `Item ${id} (${cat}) must be multi-part (>=4 meshes), got ${stats.meshCount}`);
    assert.ok(stats.triangles >= 24, `Item ${id} (${cat}) must have real 3D geometry (>=24 tris), got ${stats.triangles}`);
    const box = new THREE.Box3().setFromObject(mesh);
    assert.ok(!box.isEmpty(), `Bounding box for ${id} must not be empty`);
    assert.ok(Number.isFinite(box.max.x) && Number.isFinite(box.min.y), `Bounds for ${id} must be finite`);
  }
});

test('v152 All 7 Interactive 3D Action Stages: ECS entities, raycast pickables, era evolution, and stage actions', () => {
  assert.equal(STAGE_KINDS.length, 7);

  for (const stageKind of STAGE_KINDS) {
    const world = new ZoneEcsWorld();
    const built = buildStageScene3D(stageKind, world, {
      era: 1,
      originChosen: false,
      headless: true,
    });

    assert.equal(built.kind, stageKind);
    assert.ok(built.scene.isScene);
    assert.ok(built.camera.isPerspectiveCamera);
    assert.ok(built.spawnedEids.length >= 2, `Stage ${stageKind} must spawn ECS entities`);
    assert.ok(built.pickableEids.length >= 1, `Stage ${stageKind} must expose interactive pickables`);

    const sceneStats = countMeshStats3D(built.scene);
    assert.ok(sceneStats.triangles >= 100, `Stage ${stageKind} must have rich 3D geometry, got ${sceneStats.triangles} tris`);

    if (stageKind === 'safehouse-empire') {
      // Verify Nemesis, 5 Crew, and 4 Origin pedestals exist as pickables
      const targets = built.pickableEids.map((eid) => world.pickMeta.get(eid)?.target);
      assert.ok(targets.includes('nemesis'), 'safehouse-empire must include raycast-pickable 3D Nemesis');
      assert.equal(targets.filter((t) => t === 'crew').length, 5, 'safehouse-empire must include 5 3D Crew specialists');
      assert.equal(targets.filter((t) => t === 'origin').length, 4, 'safehouse-empire must include 4 3D Origin pedestals');
      assert.equal(built.refs.originGroup.visible, true);

      // Verify InputRaycastSystem hits 3D Nemesis when aimed directly at Nemesis world position
      built.scene.updateMatrixWorld(true);
      built.camera.updateMatrixWorld(true);
      built.camera.updateProjectionMatrix();
      const nemObj = world.object3d[built.refs.nemesisEid];
      const nemWorld = new THREE.Vector3();
      nemObj.getWorldPosition(nemWorld);
      nemWorld.y += 0.75;
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
      assert.equal(pickedMeta?.target, 'nemesis', 'InputRaycastSystem must pick 3D Nemesis mesh accurately');

      // Evolve safehouse from Era 1 -> Era 6 & mark origin chosen
      built.updateState({ era: 6, originChosen: true });
      assert.equal(built.refs.compoundGroup.userData.era, 6);
      assert.equal(built.refs.originGroup.visible, false);
    }

    if (stageKind === 'gym-ironpit') {
      const stationIds = built.pickableEids.map((eid) => world.pickMeta.get(eid)?.stationId).filter(Boolean);
      assert.deepEqual(stationIds.sort(), ['def', 'dex', 'spd', 'str']);
    }

    // Fire stage action and step several ECS ticks
    assert.equal(built.triggerAction('boss-confront', { stat: 'str' }), true);
    for (let i = 0; i < 8; i++) {
      world.step(0.04);
    }
    built.dispose();
    assert.equal(world.aliveCount, 0, `Disposing ${stageKind} must cleanly despawn all stage entities`);
  }
});

test('v152 WebGL Context Discipline: 30 item cards + 2 stages allocate <= 2 shared WebGL contexts (<= 3 with modal, 2 after close)', () => {
  let createdRenderers = 0;
  const mockCreateRenderer = () => {
    createdRenderers++;
    const domElement = {
      width: 220,
      height: 180,
      clientWidth: 560,
      clientHeight: 235,
      style: {},
      classList: { add() {} },
      addEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 560, height: 235, bottom: 235 }),
    };
    return {
      domElement,
      shadowMap: { enabled: false, type: 0 },
      info: { render: { calls: 12, triangles: 840 } },
      setPixelRatio() {},
      setSize(w, h) { domElement.width = w; domElement.height = h; },
      render() {},
      forceContextLoss() {},
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

  const makeMockStage = (kind) => ({
    tagName: 'DIV',
    isConnected: true,
    firstChild: null,
    getAttribute: (k) => (k === 'data-z3d-stage' ? kind : '1'),
    querySelector: () => ({}),
    appendChild() {},
    insertBefore() {},
    getBoundingClientRect: () => ({ top: 20, bottom: 255, width: 560, height: 235 }),
  });

  const slots = [];
  for (let i = 0; i < 30; i++) {
    slots.push(makeMockSlot(i % 2 === 0 ? 'ak' : 'xanax', i % 2 === 0 ? 'weapon' : 'drug'));
  }
  const stages = [makeMockStage('safehouse-empire'), makeMockStage('heist-breach')];

  runtime.scan({
    querySelectorAll: (sel) => (sel.includes('data-z3d-stage') ? stages : slots),
  });

  runtime.world.step(0.016);
  const diag = runtime.diagnostics();

  assert.equal(diag.ready, true);
  assert.equal(diag.renderedItems, 30);
  assert.equal(diag.activeStages, 2);
  assert.equal(createdRenderers, 2, `Expected exactly 2 shared WebGL contexts for 30 items + 2 stages, got ${createdRenderers}`);
  assert.ok(diag.webglContexts <= 2, `Expected webglContexts <= 2, got ${diag.webglContexts}`);
  assert.ok(diag.drawCalls > 0);
  assert.equal(diag.contextLost, false);
});

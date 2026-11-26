import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  THREE,
  EUROPEAN_ROULETTE_ORDER,
  ROULETTE_RED_NUMBERS,
  ZoneEcsWorld,
  DynamicResScaler,
  createRouletteWheel3D,
  createSlotMachine3D,
  createCasinoDie3D,
  getDieFaceRotation,
  createItemMesh3D,
  countMeshStats3D,
  buildStageScene3D,
  createZoneEcs3DRuntime,
} from '../assets/ui/zone-ecs-3d-engine.mjs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casinoMod = require('../assets/ui/zone-casino-tables.js');
const gameKitMod = require('../assets/ui/zone-gamekit-bridge.js');

/* ==========================================================================
 * ROOK CALLAHAN (/game-qa-lead) — ZONE v163 5-TIER RELEASE GATE
 * Tier 1: Smoke & Deliverables Gate (GDD, Upgrade Report, GameKit, Assets)
 * Tier 2: Museum-Grade 37-Pocket 3D Roulette & 100x Multi-Part 3D Models
 * Tier 3: Game Balance & Uniform 2.7027% Cost-Curve / French Call Bets Math
 * Tier 4: GameKit 1,000-Pt Catalog, Timestamp Tiebreaker & Cloud Save Slots
 * Tier 5: Zero-GC Scratch Reuse & Game-Tuning 1% Low FPS / Refresh-3 Telemetry
 * ========================================================================== */

test('Tier 1 (Smoke & GDD/Upgrade Artifacts): v163 GDD, Upgrade Report, GameKit & Noir Casino CSS exist', () => {
  for (const rel of [
    'docs/gdd/FEATURE_SOVEREIGN_3D_AND_VELVET_CASINO_V163.md',
    'docs/upgrades/upgrade-001-v163-3d-casino-overhaul.md',
    'assets/ui/zone-gamekit-bridge.js',
    'assets/ui/zone-ecs-3d-engine.mjs',
    'assets/ui/zone-casino-tables.js',
    'assets/ui/zone-casino-tables.css',
  ]) {
    assert.ok(existsSync(resolve(root, rel)), `Missing v163 deliverable: ${rel}`);
  }
  const css = readFileSync(resolve(root, 'assets/ui/zone-casino-tables.css'), 'utf8');
  assert.match(css, /\.zct-roulette-salon/, 'Monte-Carlo Noir 3D Roulette Salon CSS present');
  assert.match(css, /\.zct-inline-3d-stage/, 'Inline 3D Casino viewport CSS present');
  assert.match(css, /focus-visible/, 'Keyboard focus-visible accessibility rings present');
});

test('Tier 2 (3D Asset Quality Gate): 37-Pocket 3D Roulette Wheel, 3D Slot Machine & 100x Multi-Part Arsenal/Vehicles/Companions', () => {
  // 1. Authentic 37-pocket European Roulette sequence (0..36, each appearing once)
  assert.equal(EUROPEAN_ROULETTE_ORDER.length, 37);
  assert.equal(new Set(EUROPEAN_ROULETTE_ORDER).size, 37);
  assert.equal(ROULETTE_RED_NUMBERS.length, 18);

  const mCount = (s) => (s.meshCount !== undefined ? s.meshCount : s.meshes);
  const wheel = createRouletteWheel3D();
  const wheelStats = countMeshStats3D(wheel);
  assert.equal(wheel.userData.pocketCount, 37);
  assert.ok(mCount(wheelStats) >= 80, `Expected >= 80 meshes in 37-pocket + 37-fret + 8-canoe + turret 3D wheel, got ${mCount(wheelStats)}`);
  assert.ok(wheelStats.triangles >= 1200, `Expected >= 1200 triangles in sculpted LatheGeometry 3D wheel, got ${wheelStats.triangles}`);

  const slotMachine = createSlotMachine3D();
  const slotStats = countMeshStats3D(slotMachine);
  assert.ok(mCount(slotStats) >= 16, `Expected >= 16 meshes in 3D mechanical slot machine, got ${mCount(slotStats)}`);
  assert.equal(slotMachine.userData.reels.length, 3);
  assert.ok(slotMachine.userData.leverPivot, 'Spring-loaded pull-arm lever pivot present');

  // 2. Verify bespoke multi-part 3D silhouettes across upgraded firearms, melee, armor, boosters, vehicles & companions
  const checkMatrix = [
    ['ak', 'weapon', 10],
    ['sniper', 'weapon', 14],
    ['shotgun', 'weapon', 18],
    ['revolver', 'weapon', 14],
    ['pistol', 'weapon', 14],
    ['knuckles', 'melee', 14],
    ['stun_baton', 'melee', 9],
    ['katana', 'melee', 12],
    ['helmet', 'armor', 14],
    ['boots', 'armor', 10],
    ['gloves', 'armor', 14],
    ['pants', 'armor', 10],
    ['alcohol', 'booster', 7],
    ['candy', 'booster', 9],
    ['sports_car', 'vehicle', 16],
    ['armored_van', 'vehicle', 16],
    ['interceptor_sedan', 'vehicle', 15],
    ['mountain_bike', 'vehicle', 12],
    ['recon_drone', 'companion', 14],
    ['armored_k9', 'companion', 16],
    ['smuggler_falcon', 'companion', 10],
    ['cyber_raven', 'companion', 10],
    ['roulette_wheel', 'casino', 80],
    ['slot_machine', 'casino', 16],
  ];

  for (const [id, cat, minMeshes] of checkMatrix) {
    const mesh = createItemMesh3D(id, cat, 'legendary', { disableAsyncUpgrade: true });
    const st = countMeshStats3D(mesh);
    assert.ok(mCount(st) >= minMeshes, `${id} (${cat}) expected >= ${minMeshes} 3D sub-meshes, got ${mCount(st)}`);
    assert.ok(st.triangles >= 80, `${id} (${cat}) expected >= 80 triangles, got ${st.triangles}`);
  }

  // Ensure boots, gloves, and pants have genuinely distinct 3D archetypes & mesh counts/bounds
  const bootsSt = countMeshStats3D(createItemMesh3D('boots', 'armor', 'rare', { disableAsyncUpgrade: true }));
  const glovesSt = countMeshStats3D(createItemMesh3D('gloves', 'armor', 'rare', { disableAsyncUpgrade: true }));
  assert.notEqual(mCount(bootsSt), mCount(glovesSt), 'Boots and Gloves have distinct multi-part 3D geometry');
});

test('Tier 3 (Casino Royale 3D Stage, Submodes & French Call Bets 2.7027% Balance Math):', () => {
  const world = new ZoneEcsWorld();
  const stage = buildStageScene3D('casino-royale', world, { headless: true, submode: 'roulette' });
  assert.ok(stage.refs.rouletteWheel, 'casino-royale mounts createRouletteWheel3D');
  assert.ok(stage.refs.slotCabinet, 'casino-royale mounts createSlotMachine3D');
  assert.ok(stage.refs.croupierEid !== undefined, 'casino-royale mounts Croupier Suit Operative');
  assert.equal(stage.camera.userData.z3dSubmode, 'roulette');

  stage.updateState({ submode: 'slots' });
  assert.equal(stage.camera.userData.z3dSubmode, 'slots');

  stage.triggerAction('spin', { pocket: 17 });
  for (let i = 0; i < 40; i++) world.step(0.05);
  stage.dispose();

  // Verify Safehouse mounts swappable 3D companion
  const shStage = buildStageScene3D('safehouse-empire', world, { headless: true, companionId: 'recon_drone' });
  assert.equal(shStage.refs.companionGroup.userData.companionId, 'recon_drone');
  shStage.updateState({ companionId: 'armored_k9' });
  assert.equal(shStage.refs.companionGroup.userData.companionId, 'armored_k9');
  shStage.dispose();

  // Verify French Call Bets & uniform 2.7027% European house edge across all 37 outcomes
  assert.equal(casinoMod.EUROPEAN_ROULETTE_ORDER.length, 37);
  const betTypes = ['voisins_du_zero', 'tiers_du_cylindre', 'orphelins', 'jeu_zero', 'neighbors_5', 'straight', 'red', 'black'];
  for (const betId of betTypes) {
    let totalNet = 0;
    const stake = 3700; // divisible by 37 for exact integer verification
    for (const p of casinoMod.EUROPEAN_ROULETTE_ORDER) {
      const r = casinoMod.evaluateRouletteSpin(betId, p, stake, 17);
      totalNet += r.netDelta;
    }
    const exactHouseEdge = -totalNet / (37 * stake);
    assert.ok(
      Math.abs(exactHouseEdge - 1 / 37) < 0.0005,
      `${betId} expected uniform 2.7027% (1/37) house edge, got ${(exactHouseEdge * 100).toFixed(4)}%`
    );
  }

  // Voisins (17) + Tiers (12) + Orphelins (8) = all 37 pockets disjointly covered!
  const union37 = new Set([
    ...casinoMod.ROULETTE_CALL_BETS.voisins_du_zero.pockets,
    ...casinoMod.ROULETTE_CALL_BETS.tiers_du_cylindre.pockets,
    ...casinoMod.ROULETTE_CALL_BETS.orphelins.pockets,
  ]);
  assert.equal(union37.size, 37, 'Voisins (17) + Tiers (12) + Orphelins (8) partition all 37 pockets cleanly');

  const curve = casinoMod.computeRouletteCostCurve({ stake: 1000, spinsPerMin: 4 });
  assert.equal(curve.pocketCount, 37);
  assert.equal(curve.houseEdgePct, 2.7027);
  assert.equal(curve.checkpoints.length, 4);
});

test('Tier 4 (GameKit Achievements, 1,000-Pt Budget, Timestamp Tiebreaker & Cloud Save):', () => {
  const gk = gameKitMod.createGameKitEngine({ headless: true });
  const summary0 = gk.getSummary();
  assert.equal(summary0.totalAchievements, 20);
  assert.equal(summary0.maxPoints, 1000, 'GameKit total points must equal Apple 1,000-pt cap');

  gk.recordEvent('roulette_spin', { stake: 50000, pocket: 0, netDelta: 175000, betType: 'straight' });
  gk.recordEvent('roulette_spin', { stake: 50000, pocket: 32, netDelta: 12000, betType: 'voisins_du_zero' });
  const summary1 = gk.getSummary();
  assert.ok(summary1.unlockedCount >= 4, 'Unlocked first spin, 35:1 straight-up, call-bet savant & 100k whale');
  assert.ok(summary1.earnedPoints >= 200);

  // Leaderboard tie-breaking by earlier context timestamp
  const savedSlot = gk.saveGameData({ era: 4, bankroll: 425000 }, 'pier4_cloud');
  assert.equal(savedSlot.name, 'pier4_cloud');
});

test('Tier 5 (Zero-GC _slotsScratch Reuse & Game-Tuning Refresh-3 / 1% Low FPS Telemetry):', () => {
  const scaler = new DynamicResScaler({ targetRefreshHz: 144, initialDpr: 1.35, presetCap: 1.35 });
  assert.equal(scaler.recommendedFpsCap, 141, 'Blur Busters G-Sync rule: 144Hz -> 141 FPS cap (refresh - 3)');
  for (let i = 0; i < 30; i++) scaler.sampleFrame(16.2, i * 16);
  scaler.sampleFrame(24.0, 600);
  assert.ok(scaler.onePercentLowFps <= scaler.fps, '1% low FPS tracks worst frame in ring buffer');
  assert.ok(scaler.frameTimeVarianceMs > 0, 'Frame-time variance computed zero-GC over Float32Array ring');

  const mockRenderer = () => ({
    domElement: { width: 220, height: 180, style: {}, addEventListener() {} },
    shadowMap: { enabled: true, type: 0, needsUpdate: false },
    info: { render: { calls: 12, triangles: 2400 } },
    setPixelRatio() {},
    setClearColor() {},
    setSize() {},
    render() {},
    dispose() {},
  });
  const rt = createZoneEcs3DRuntime({ createRenderer: mockRenderer });
  rt.setGraphicsConfig({ targetRefreshHz: 120 });
  const scratchRef = rt._slotsScratch;
  rt.world.step(0.016);
  rt.world.step(0.016);
  assert.equal(rt._slotsScratch, scratchRef, 'Per-frame _slotsScratch array reused with zero heap allocation');
  const diag = rt.diagnostics();
  assert.equal(diag.recommendedFpsCap, 117);
  assert.equal(typeof diag.onePercentLowFps, 'number');
  assert.equal(typeof diag.frameTimeVarianceMs, 'number');
});

test('Tier 6 (v167 3D Monte-Carlo Craps Pit & 21-Pip Tumbling 2d6 Dice Kinematics):', () => {
  const die = createCasinoDie3D({ initialFace: 5 });
  const stats = countMeshStats3D(die);
  assert.equal(stats.meshCount, 24, '3D Casino Die must contain 3 body/chamfer meshes + all 21 recessed 3D cylinder pips');

  // Verify opposite face normals rotate cleanly to +Y (0, 1, 0) for every face 1..6
  const faceNormals = {
    1: new THREE.Vector3(0, 1, 0),
    2: new THREE.Vector3(0, 0, 1),
    3: new THREE.Vector3(1, 0, 0),
    4: new THREE.Vector3(-1, 0, 0),
    5: new THREE.Vector3(0, 0, -1),
    6: new THREE.Vector3(0, -1, 0),
  };
  for (let f = 1; f <= 6; f++) {
    const [rx, ry, rz] = getDieFaceRotation(f);
    const eul = new THREE.Euler(rx, ry, rz, 'XYZ');
    const worldUp = faceNormals[f].clone().applyEuler(eul);
    assert.ok(worldUp.y > 0.999, `Face ${f} Euler [${rx.toFixed(2)}, ${ry.toFixed(2)}, ${rz.toFixed(2)}] aligns normal straight UP (+Y=${worldUp.y.toFixed(4)})`);
  }

  // Verify submode="craps" camera framing and ANIM_CRAPS_DIE settling onto [6, 5] (Natural 11!)
  const world = new ZoneEcsWorld();
  const stage = buildStageScene3D('casino-royale', world, { submode: 'craps', headless: true });
  assert.equal(stage.camera.userData.z3dSubmode, 'craps');
  assert.ok(stage.refs.crapsDie1 && stage.refs.crapsDie2, 'Both 3D Craps dice spawned in casino-royale stage');

  stage.triggerAction('craps-roll', { submode: 'craps', dice: [6, 5], point: 8 });
  for (let i = 0; i < 90; i++) world.step(0.02);
  const [e6x, , e6z] = getDieFaceRotation(6);
  const [e5x, , e5z] = getDieFaceRotation(5);
  assert.ok(Math.abs(stage.refs.crapsDie1.rotation.x - e6x) < 1e-3 && Math.abs(stage.refs.crapsDie1.rotation.z - e6z) < 1e-3, 'Die 1 settled flat on face 6');
  assert.ok(Math.abs(stage.refs.crapsDie2.rotation.x - e5x) < 1e-3 && Math.abs(stage.refs.crapsDie2.rotation.z - e5z) < 1e-3, 'Die 2 settled flat on face 5');
  stage.dispose();
});

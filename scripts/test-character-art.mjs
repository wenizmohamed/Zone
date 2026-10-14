import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { CHARACTER_ART, validateCharacterWardrobe, prepareCharacterArt, computeCharacterFrame, disposeCharacterResources } from '../dist/character-presentation.js';
import { prepareCharacterGrip, applyCharacterGrip } from '../dist/character-grip.js';
import { prepareWeaponPose } from '../dist/character-poses.js';
import { resolveWeaponAsset, weaponPresentationLabel, createWeaponAssetLoader } from '../dist/weapon-assets.js';
import { createArmorController } from '../dist/character-armor.mjs';

async function wardrobe(name) {
  const bytes = readFileSync(new URL(`../assets/character/quaternius/${name}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const template = name => JSON.parse(readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);

for (const name of ['Suit', 'Swat', 'Casual_Hoodie']) {
  test(`${name}: adult head treatment preserves real body vertices, rig, weights and all 24 clips`, async t => {
    const gltf = await wardrobe(name), root = gltf.scene;
    root.updateMatrixWorld(true);
    const bones = [], meshes = [];
    root.traverse(object => {
      if (object.isBone) bones.push({ object, matrix: object.matrixWorld.toArray(), position: object.position.toArray(), rotation: object.quaternion.toArray(), scale: object.scale.toArray() });
      if (object.isSkinnedMesh) meshes.push({ object, positions: object.geometry.attributes.position.array.slice(), joints: object.geometry.attributes.skinIndex.array.slice(), weights: object.geometry.attributes.skinWeight.array.slice() });
    });
    const head = root.getObjectByName('Head'), originalHead = new THREE.Box3();
    const actualHeadPoints = () => {
      const points = [];
      for (const { object } of meshes) {
        const position = object.geometry.attributes.position, joints = object.geometry.attributes.skinIndex, weights = object.geometry.attributes.skinWeight;
        const headIndex = object.skeleton.bones.indexOf(head);
        for (let index = 0; index < position.count; index++) {
          let influence = 0;
          for (let component = 0; component < 4; component++) if (joints.getComponent(index, component) === headIndex) influence += weights.getComponent(index, component);
          if (influence > .99) points.push(object.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
        }
      }
      return points;
    };
    originalHead.setFromPoints(actualHeadPoints());
    const clipBytes = JSON.stringify(gltf.animations.map(clip => clip.toJSON()));
    const art = prepareCharacterArt(THREE, root); root.updateMatrixWorld(true);
    assert.ok(art.adjustedVertices > 100 && art.materialCount >= 5);
    assert.equal(gltf.animations.length, 24); assert.equal(JSON.stringify(gltf.animations.map(clip => clip.toJSON())), clipBytes);
    for (const bone of bones) {
      assert.deepEqual(bone.object.position.toArray(), bone.position); assert.deepEqual(bone.object.quaternion.toArray(), bone.rotation);
      assert.deepEqual(bone.object.scale.toArray(), bone.scale); assert.deepEqual(bone.object.matrixWorld.toArray(), bone.matrix);
    }
    let untouched = 0;
    for (const { object, positions, joints, weights } of meshes) {
      assert.deepEqual(object.geometry.attributes.skinIndex.array, joints);
      assert.deepEqual(object.geometry.attributes.skinWeight.array, weights);
      const headIndex = object.skeleton.bones.indexOf(head);
      for (let index = 0; index < positions.length / 3; index++) {
        let influence = 0;
        for (let component = 0; component < 4; component++) if (joints[index * 4 + component] === headIndex) influence += weights[index * 4 + component];
        if (influence) continue;
        for (let component = 0; component < 3; component++) assert.equal(object.geometry.attributes.position.array[index * 3 + component], positions[index * 3 + component], 'non-head body/hand vertex changed');
        untouched++;
      }
    }
    assert.ok(untouched > 500);
    const treatedHead = new THREE.Box3().setFromPoints(actualHeadPoints()), before = originalHead.getSize(new THREE.Vector3()), after = treatedHead.getSize(new THREE.Vector3());
    // Authored bind transforms slightly tilt the casual head. The visible
    // world-space extent must still stay within 0.3 percent of the local cut.
    assert.ok(Math.abs(after.y / before.y - .82) < .003, 'actual weighted head height did not change by 18 percent');
    assert.ok(Math.abs(after.x / before.x - .90) < .002, 'actual weighted head width did not change by 10 percent');
    const geometryIds = meshes.map(({ object }) => object.geometry.uuid), materialIds = meshes.map(({ object }) => object.material.uuid);
    assert.equal(prepareCharacterArt(THREE, root), art);
    assert.deepEqual(meshes.map(({ object }) => object.geometry.uuid), geometryIds); assert.deepEqual(meshes.map(({ object }) => object.material.uuid), materialIds);
    const grip = prepareCharacterGrip(THREE, root, Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])));
    assert.deepEqual(grip.center.toArray(), [.014, .143, -.034]); assert.equal(grip.pose.length, 19);
    const mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations) {
      mixer.stopAllAction(); mixer.clipAction(clip).reset().play(); mixer.setTime(clip.duration * .37); applyCharacterGrip(grip); root.updateMatrixWorld(true);
      assert.ok(grip.hand.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
    }
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    t.diagnostic(`${name}: actual head ${(before.y * 100).toFixed(1)}cm to ${(after.y * 100).toFixed(1)}cm; ${untouched} body/hand vertices unchanged; ${gltf.animations.length} authored clips preserved`);
    disposeCharacterResources([root]);
  });
}

test('Portrait camera contains all real wardrobe bounds in desktop and phone aspect ratios', async () => {
  const gltf = await wardrobe('Suit'); prepareCharacterArt(THREE, gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  for (const aspect of [.56, .75, 1, 1.5, 2.2]) {
    const frame = computeCharacterFrame(THREE, box, aspect), camera = new THREE.PerspectiveCamera(30, aspect, .05, 60);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(projected.x) <= .80 && Math.abs(projected.y) <= .85, `wardrobe clipped at ${aspect}: ${projected.toArray()}`);
    }
  }
  disposeCharacterResources([gltf.scene]);
});

test('Warm wardrobe cleanup releases shared geometry, material, skeleton, texture and image once', () => {
  const counts = { geometry: 0, material: 0, skeleton: 0, texture: 0, image: 0 };
  const geometry = { dispose() { counts.geometry++; } }, texture = { isTexture: true, dispose() { counts.texture++; }, image: { close() { counts.image++; } } };
  const material = { map: texture, dispose() { counts.material++; } }, skeleton = { dispose() { counts.skeleton++; } };
  const mesh = { geometry, material, skeleton }, roots = [{ traverse: visit => visit(mesh) }, { traverse: visit => visit(mesh) }];
  disposeCharacterResources(roots); assert.deepEqual(counts, { geometry: 1, material: 1, skeleton: 1, texture: 1, image: 1 });
});

test('Weapon labels distinguish authored PBR, stylized catalog, and simplified fallback in both languages', () => {
  assert.equal(resolveWeaponAsset('bat').quality, 'authored-pbr');
  const catalog = resolveWeaponAsset('prototype', { prototype: { file: 'Shotgun_1', scale: 1 } });
  assert.equal(catalog.quality, 'catalog-stylized');
  assert.equal(weaponPresentationLabel(resolveWeaponAsset('bat')), 'DETAILED MODEL / CC0');
  assert.equal(weaponPresentationLabel(catalog), 'STYLIZED MODEL / CC0');
  assert.equal(weaponPresentationLabel(null), 'SIMPLIFIED PREVIEW');
  assert.match(weaponPresentationLabel(catalog, 'ar'), /مبسط/);
  assert.match(weaponPresentationLabel(resolveWeaponAsset('bat'), 'ar'), /مفصل/);
  assert.match(weaponPresentationLabel(null, 'ar'), /مبسطة/);
});

test('Templates install the art stage, truthful badge, keyboard controls and cold-exit cleanup', () => {
  const character = template('character3d'), weapon = template('weapon3d');
  assert.match(character, /outfit: q\.get\('outfit'\) \|\| 'suit'/);
  assert.match(character, /prepareCharacterArt\(THREE, gltf\.scene\)/); assert.match(character, /installCharacterStage\(THREE/);
  assert.match(character, /canvas\.addEventListener\('keydown', characterKey\)/);
  assert.match(character, /if \(event\.persisted\) return/); assert.match(character, /disposeCharacterResources\(/);
  assert.match(weapon, /id="asset-quality"/); assert.match(weapon, /assetLabel\(asset\?\.source/);
  assert.match(weapon, /qualityObserver\.disconnect\(\)/);
  assert.equal(CHARACTER_ART.quality, 'stylized-rigged');
});

test('A missing wardrobe is evicted and retryable, and malformed replacements retain the visible rig', async () => {
  const original = (await wardrobe('Casual_Hoodie')).scene, valid = await wardrobe('Suit');
  const scene = new THREE.Scene(); scene.add(original);
  const load = { hidden: true, textContent: '' }, retry = { hidden: true, textContent: '' }, errors = [];
  const page = { body: { dataset: {} } };
  let tries = 0;
  const ctx = vm.createContext({
    THREE, setTimeout, clearTimeout, document: page, lang: 'en', state: { outfit: 'suit' }, model: original, mixer: null, handR: null, headBone: null, hips: null, clips: {}, current: null,
    characterCache: new Map(), characterLoadSeq: 0, characterLoadingFile: null, equipSeq: 0, weaponMesh: null, characterGrip: null, weaponPoseRig: null,
    GLTFLoader: class { loadAsync() { if (++tries === 1) return Promise.reject(new Error('404: missing wardrobe')); return Promise.resolve(tries === 2 ? { scene: new THREE.Group(), animations: [] } : valid); } },
    $: id => id === 'load' ? load : retry, outfitFile: () => 'Suit', scene,
    validateCharacterWardrobe, prepareCharacterArt, prepareCharacterGrip, prepareWeaponPose, disposeCharacterResources,
    play() {}, fitCharacter() {}, characterStage: { setFloor() {} }, armorController: createArmorController({ THREE, loadSource: () => wardrobe('Swat') }), paintOutfit() {}, equip() {}, buildBar() {}, buildRack() {}, buildCompact() {}, sizeMode() {},
    q: { get() { return null; } }, parent: { postMessage() {} }, location: { origin: 'http://localhost' }, console: { error: (...items) => errors.push(items) }
  });
  const source = template('character3d'), start = source.indexOf('function characterRequest('), end = source.indexOf("$('character-retry').onclick", start);
  vm.runInContext(source.slice(start, end), ctx);
  await ctx.loadCharacter(); assert.equal(page.body.dataset.zoneCharacterAssetState, 'error'); assert.equal(retry.hidden, false);
  assert.equal(ctx.characterCache.has('Suit'), false); assert.equal(ctx.model, original); assert.equal(original.parent, scene);
  await ctx.loadCharacter(); assert.equal(page.body.dataset.zoneCharacterAssetState, 'error'); assert.equal(ctx.model, original); assert.equal(original.parent, scene);
  // Invalid cached content must also be evicted; otherwise retrying a 200
  // response with an incomplete rig would loop on the same broken payload.
  assert.equal(ctx.characterCache.has('Suit'), false);
  await ctx.loadCharacter(); assert.equal(page.body.dataset.zoneCharacterAssetState, 'ready'); assert.equal(retry.hidden, true); assert.equal(load.hidden, true);
  assert.equal(ctx.model, valid.scene); assert.equal(original.parent, null); assert.equal(valid.scene.parent, scene); assert.equal(errors.length, 2);
  ctx.mixer.stopAllAction(); ctx.mixer.uncacheRoot(valid.scene); disposeCharacterResources([original, valid.scene]);
});

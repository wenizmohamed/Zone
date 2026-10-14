import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { prepareCharacterArt, computeCharacterFrame, disposeCharacterResources } from '../dist/character-presentation.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';
import { prepareWeaponPose, applyWeaponPose, weaponPoseProfile } from '../dist/character-poses.js';
import { resolveWeaponAsset, normalizeWeaponAsset } from '../dist/weapon-assets.js';
import { geometryGlb } from '../assets/weapons/source-tools/geometry-audit.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('dist/character3d.html', root), 'utf8');
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
function definition(name) {
  const start = template.search(new RegExp(`function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `Missing actual shipped ${name}`);
  const open = template.indexOf('{', template.indexOf(')', start) + 1);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = open; i < template.length; i++) {
    const c = template[i], next = template[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return template.slice(start, i + 1);
  }
  throw Error(`Unclosed ${name}`);
}
const runtime = values => {
  const ctx = vm.createContext({ THREE, Promise, document: { body: { dataset: {} } }, ...values });
  vm.runInContext(['polishPortraitStage', 'polishWardrobeSurfaces', 'visibleCharacterBounds', 'queuePortraitFrame', 'refreshCharacterFrame', 'fitCharacter'].map(definition).join('\n'), ctx);
  return ctx;
};
async function wardrobe(name) {
  const bytes = readFileSync(new URL(`assets/character/quaternius/${name}.glb`, root));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const hash = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const luminance = color => .2126 * color.r + .7152 * color.g + .0722 * color.b;

for (const name of ['Suit', 'Casual_Hoodie', 'Swat']) {
  test(`${name}: portrait surfaces retain every prepared vertex, normal, UV, skin weight, bone and clip`, async t => {
    const gltf = await wardrobe(name), actor = gltf.scene;
    prepareCharacterArt(THREE, actor); actor.updateMatrixWorld(true);
    const before = [], bones = [], surfaces = [];
    actor.traverse(object => {
      if (object.isBone) bones.push({ object, position: object.position.toArray(), rotation: object.quaternion.toArray(), scale: object.scale.toArray() });
      if (!object.isMesh) return;
      before.push({ object, geometry: object.geometry, attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([key, attribute]) => [key, hash(attribute.array)])), materials: object.material });
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) surfaces.push(material);
    });
    const clips = JSON.stringify(gltf.animations.map(clip => clip.toJSON()));
    const ctx = runtime({}); ctx.polishWardrobeSurfaces(THREE, actor);
    for (const record of before) {
      assert.equal(record.object.geometry, record.geometry); assert.equal(record.object.material, record.materials);
      for (const [key, digest] of Object.entries(record.attributes)) assert.equal(hash(record.object.geometry.attributes[key].array), digest);
    }
    for (const bone of bones) {
      assert.deepEqual(bone.object.position.toArray(), bone.position); assert.deepEqual(bone.object.quaternion.toArray(), bone.rotation); assert.deepEqual(bone.object.scale.toArray(), bone.scale);
    }
    assert.equal(JSON.stringify(gltf.animations.map(clip => clip.toJSON())), clips);
    assert.equal(gltf.animations.length, 24);
    for (const eye of surfaces.filter(material => material.name === 'Eye')) {
      assert.equal(eye.color.getHex(), 0x35271f, 'authored dark pupil must not be recolored eye-white gray');
      const skin = surfaces.find(material => material.name === 'Skin');
      assert.ok((luminance(skin.color) + .05) / (luminance(eye.color) + .05) > 3, 'pupil base color loses material-level facial contrast');
    }
    for (const skin of surfaces.filter(material => material.name === 'Skin')) { assert.equal(skin.roughness, .67); assert.equal(skin.clearcoat, 0); }
    for (const shoes of surfaces.filter(material => material.name === 'Black')) { assert.equal(shoes.roughness, .72); assert.equal(shoes.clearcoat, .08); }
    const materialIds = surfaces.map(material => material.uuid);
    ctx.polishWardrobeSurfaces(THREE, actor);
    assert.deepEqual(surfaces.map(material => material.uuid), materialIds, 'repeat polish must not replace materials');
    t.diagnostic(`${name}: ${before.length} real meshes and ${gltf.animations.length} authored clips retained; semantic matte surfaces only`);
    disposeCharacterResources([actor]);
  });
}

test('portrait stage closes the evidenced 12mm floor gap to 1mm without adding lights, geometry or textures', async () => {
  const scene = new THREE.Scene(), renderer = {}, key = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight(), fill = new THREE.DirectionalLight();
  scene.add(key, rim, fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial());
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshStandardMaterial());
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.ShadowMaterial()); scene.add(floor, wall, ground);
  const geometry = floor.geometry, wallGeometry = wall.geometry, material = floor.material, wallMaterial = wall.material, count = scene.children.length;
  let disposed = 0, finish;
  const stage = { ready: new Promise(resolve => { finish = resolve; }), setFloor(y) { floor.position.y = y - .012; ground.position.y = y + .002; }, dispose() { disposed++; } };
  stage.setFloor(.05); assert.ok(Math.abs(.05 - floor.position.y - .012) < 1e-9, 'baseline must exercise the real 12mm separation');
  const ctx = runtime({}); ctx.polishPortraitStage(THREE, { scene, renderer, key, rim, ground, stage }); stage.setFloor(.05);
  assert.ok(Math.abs(.05 - floor.position.y - .001) < 1e-9); assert.ok(Math.abs(ground.position.y - .05 - .001) < 1e-9);
  assert.equal(scene.children.length, count); assert.equal(floor.geometry, geometry); assert.equal(wall.geometry, wallGeometry);
  assert.equal(floor.material, material); assert.equal(wall.material, wallMaterial);
  assert.equal(renderer.toneMappingExposure, 1.07); assert.equal(scene.environmentIntensity, .32);
  assert.equal(key.intensity, 2.65); assert.equal(fill.intensity, .98); assert.equal(rim.intensity, 1.35); assert.equal(key.shadow.normalBias, .003);
  finish(); await stage.ready; await Promise.resolve(); assert.deepEqual(wall.material.normalScale.toArray(), [.12, .12]);
  stage.dispose(); stage.dispose(); assert.equal(disposed, 1);
  for (const object of [floor, wall, ground]) { object.geometry.dispose(); object.material.dispose(); }
});

test('late optional stage textures cannot recolor a disposed portrait stage', async () => {
  const scene = new THREE.Scene(), key = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight(), ground = { position: new THREE.Vector3() };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshStandardMaterial()); scene.add(key, rim, wall);
  let finish; const stage = { ready: new Promise(resolve => { finish = resolve; }), setFloor() {}, dispose() {} };
  const ctx = runtime({}); ctx.polishPortraitStage(THREE, { scene, renderer: {}, key, rim, ground, stage }); stage.dispose();
  wall.material.normalScale.set(.35, .35); finish(); await stage.ready; await Promise.resolve();
  assert.deepEqual(wall.material.normalScale.toArray(), [.35, .35]); wall.geometry.dispose(); wall.material.dispose();
});

const catalog = vm.createContext({}); vm.runInContext(readFileSync(new URL('assets/weapons/catalog.js', root), 'utf8'), catalog);
const game = JSON.parse(readFileSync(new URL('engine/data/gameplay-catalog.json', root), 'utf8'));
const weaponKeys = Object.entries(game.items).filter(([, item]) => item.type === 'weapon').map(([key]) => key);
const representatives = [...new Map(weaponKeys.map(key => [resolveWeaponAsset(key, catalog.ZONE_WEAPONS).id, key])).values()];
const sourceScenes = new Map();
async function weapon(key) {
  const descriptor = resolveWeaponAsset(key, catalog.ZONE_WEAPONS);
  if (!sourceScenes.has(descriptor.id)) sourceScenes.set(descriptor.id, (await geometryGlb(fileURLToPath(new URL('assets/weapons/' + descriptor.url, root)))).scene);
  return normalizeWeaponAsset(THREE, sourceScenes.get(descriptor.id).clone(true), descriptor);
}
function assertVisibleVerticesInside(actor, camera) {
  let count = 0, maxX = 0, maxY = 0;
  actor.updateMatrixWorld(true);
  actor.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
    const position = mesh.geometry.attributes.position;
    for (let index = 0; index < position.count; index++) {
      const point = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
      maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y)); count++;
      assert.ok(Math.abs(point.x) <= .81 && Math.abs(point.y) <= .86 && point.z > -1 && point.z < 1, `visible vertex clips: ${point.toArray()}`);
    }
  });
  assert.ok(count > 500); return { count, maxX, maxY };
}

for (const name of ['Suit', 'Casual_Hoodie', 'Swat']) {
  test(`${name}: all 20 retained weapon sources keep actual head, hands, shoes and weapon vertices inside narrow and desktop portrait`, async t => {
    const gltf = await wardrobe(name), actor = gltf.scene; prepareCharacterArt(THREE, actor);
    const clips = Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])), mixer = new THREE.AnimationMixer(actor);
    mixer.clipAction(clips.Idle).play(); mixer.setTime(.01); actor.updateMatrixWorld(true);
    const grip = prepareCharacterGrip(THREE, actor, clips), poseRig = prepareWeaponPose(THREE, actor, grip);
    const camera = new THREE.PerspectiveCamera(30, 1, .05, 60), canvas = { clientWidth: 560, clientHeight: 1000 }, controls = { target: new THREE.Vector3(), update() { camera.lookAt(this.target); }, saveState() {} };
    const ctx = runtime({ model: actor, state: { weapon: 'fists' }, canvas, camera, controls, computeCharacterFrame });
    ctx.polishWardrobeSurfaces(THREE, actor);
    let held = null, maxWeaponX = 0;
    for (const key of representatives) {
      if (held) held.removeFromParent();
      mixer.setTime(.01); actor.updateMatrixWorld(true);
      const selected = await weapon(key), fit = selected.userData.zoneWeaponAsset;
      held = attachHeldWeapon(THREE, grip, selected, fit.gripPoint, fit.axis, fit.forward);
      const support = { AssaultRifle2: [.26, .06, 0], AssaultRifle: [.23, .06, 0], Bullpup: [.15, .065, 0], Shotgun: [.24, .06, 0], SubmachineGun: [.15, .035, 0], SniperRifle: [.27, .07, 0] };
      held.userData.zoneSupportPoint = support[catalog.ZONE_WEAPONS[key]?.fam] || [.24, .06, 0];
      applyCharacterGrip(grip); applyWeaponPose(poseRig, held, { profile: weaponPoseProfile(key, catalog.ZONE_WEAPONS), action: 'idle', elapsed: 0 }); actor.updateMatrixWorld(true);
      const matrix = selected.matrixWorld.toArray(), gripMatrix = grip.hand.matrixWorld.toArray();
      ctx.state.weapon = key;
      for (const aspect of [.45, .56, 1, 1.5]) {
        canvas.clientWidth = 1000 * aspect; camera.aspect = aspect; ctx.refreshCharacterFrame(); camera.updateMatrixWorld(true);
        const measured = assertVisibleVerticesInside(actor, camera); maxWeaponX = Math.max(maxWeaponX, measured.maxX);
        assert.deepEqual(selected.matrixWorld.toArray(), matrix, 'framing must never move the selected weapon');
        assert.deepEqual(grip.hand.matrixWorld.toArray(), gripMatrix, 'framing must never move the grip');
      }
    }
    assert.equal(representatives.length, 20); t.diagnostic(`${name}: 20 distinct real sources, 4 aspect ratios, every visible vertex <= ${maxWeaponX.toFixed(4)} horizontal NDC`);
    if (held) held.removeFromParent(); mixer.stopAllAction(); mixer.uncacheRoot(actor); disposeCharacterResources([actor]);
  });
}

test('hidden authored props cannot enlarge the portrait frame, and fists/loaded equipment queue one first-pose refit', () => {
  const actor = new THREE.Group(), visible = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()); actor.add(visible);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial()); hidden.visible = false; actor.add(hidden);
  const ctx = runtime({}); const box = ctx.visibleCharacterBounds(actor);
  assert.deepEqual(box.getSize(new THREE.Vector3()).toArray(), [1, 2, 1]);
  assert.equal((template.match(/if \(typeof queuePortraitFrame === 'function'\) queuePortraitFrame\(\);/g) || []).length, 3);
  assert.match(template, /portraitFramePending = false; refreshCharacterFrame\(\)/);
  assert.match(template, /function createRenderGate\(/); assert.match(template, /function characterRequest\(file, timeoutMs = 15000\)/);
  assert.match(html, /function installMediaFallback\(/);
  disposeCharacterResources([actor]);
});

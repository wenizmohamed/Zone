import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';

function readViewer(name) {
  const html = readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8');
  const data = kind => JSON.parse(html.match(new RegExp(`<script type="__bundler/${kind}">\\s*([\\s\\S]*?)\\s*</script>`))[1]);
  const scripts = Object.fromEntries(Object.entries(data('manifest')).map(([id, entry]) => {
    const bytes = Buffer.from(entry.data, 'base64');
    return [id, (entry.compressed ? gunzipSync(bytes) : bytes).toString('utf8')];
  }));
  return { html, template: data('template'), scripts };
}
const character = readViewer('character3d'), weapon = readViewer('weapon3d');

async function wardrobeGeometry(filename) {
  const bytes = readFileSync(new URL(`../assets/character/quaternius/${filename}.glb`, import.meta.url));
  // These actual CC0 assets are self-contained and texture-free. Parse their
  // original skin, meshes and animation without a WebGL or fake skeleton.
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

function rightHand(root) {
  let hand;
  root.traverse(object => { if (object.isBone && object.name.replace(/[._-]/g, '') === 'WristR') hand = object; });
  assert.ok(hand, 'the actual rig must contain its right wrist');
  return hand;
}

function fingerGripCavity(root, hand) {
  // Independent physical check: fit each curled finger's joint arc in its Y/Z
  // plane, then average the four centers. No runtime socket constant is read.
  const centers = ['Index', 'Middle', 'Ring', 'Pinky'].map(finger => {
    const points = [2, 3, 4].map(joint => {
      const bone = root.getObjectByName(`${finger}${joint}R`);
      assert.ok(bone, `missing ${finger}${joint}R`);
      return hand.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    });
    const [a, b, c] = points;
    const d = 2 * (a.y * (b.z - c.z) + b.y * (c.z - a.z) + c.y * (a.z - b.z));
    assert.ok(Math.abs(d) > 1e-8, 'gripping finger must form a bent arc');
    const length = p => p.y * p.y + p.z * p.z;
    return new THREE.Vector3((a.x + b.x + c.x) / 3,
      (length(a) * (b.z - c.z) + length(b) * (c.z - a.z) + length(c) * (a.z - b.z)) / d,
      (length(a) * (c.y - b.y) + length(b) * (a.y - c.y) + length(c) * (b.y - a.y)) / d);
  });
  return centers.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / centers.length);
}

function handSkinTriangles(root, hand) {
  const triangles = [];
  root.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    for (let node = mesh; node; node = node.parent) if (!node.visible) return;
    const vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) =>
      hand.worldToLocal(mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
    const indices = mesh.geometry.index?.array || vertices.map((_, index) => index);
    const nearHand = point => point.x >= -.12 && point.x <= .10 && point.y >= .02 && point.y <= .30;
    for (let index = 0; index < indices.length; index += 3) {
      const points = [vertices[indices[index]], vertices[indices[index + 1]], vertices[indices[index + 2]]];
      if (points.some(nearHand)) triangles.push(new THREE.Triangle(...points));
    }
  });
  assert.ok(triangles.length > 30, 'actual skinned hand triangles must be measured');
  return triangles;
}

function representativeWeaponMesh(filename) {
  const positions = [], indices = [];
  for (const line of readFileSync(new URL(`../assets/weapons/${filename}.obj`, import.meta.url), 'utf8').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') positions.push(...parts.slice(1, 4).map(Number));
    if (parts[0] === 'f') {
      const face = parts.slice(1).map(part => Number(part.split('/')[0]) - 1);
      for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeBoundingBox();
  assert.ok(indices.length > 100 && positions.length > 100, `${filename} must use real OBJ geometry`);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

function extract(source, name, method = false) {
  const start = source.search(new RegExp(method ? `\\n\\s*${name}\\s*\\([^)]*\\)\\s*\\{` : `(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `Missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = open; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return `${method ? 'function ' : ''}${source.slice(start, i + 1)}`;
  }
  throw new Error(`Unclosed ${name}`);
}
function context(source, names, values = {}) {
  const ctx = vm.createContext(values);
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), ctx);
  return ctx;
}

test('Wardrobe models contain real clothing meshes, skeletal animation and hand attachment bones', () => {
  const ctx = context(character.template, ['outfitFile'], { OUTFIT_FILES: { street: 'Casual_Hoodie', suit: 'Suit', tactical: 'Swat' } });
  assert.equal(ctx.outfitFile('untrusted/path'), 'Casual_Hoodie');
  for (const [outfit, filename] of [['street', 'Casual_Hoodie'], ['suit', 'Suit'], ['tactical', 'Swat']]) {
    assert.equal(ctx.outfitFile(outfit), filename);
    const bytes = readFileSync(new URL(`../assets/character/quaternius/${filename}.glb`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.ok(gltf.meshes.length >= 4);
    assert.ok(gltf.skins.length > 0);
    assert.ok(gltf.nodes.some(node => node.name === 'Wrist.R'));
    for (const required of ['Idle', 'Walk', 'Punch_Right', 'Sword_Slash', 'HitRecieve', 'Death']) {
      assert.ok(gltf.animations.some(animation => animation.name === required), `${filename} lacks ${required}`);
    }
    assert.ok(gltf.buffers.every(buffer => !buffer.uri), 'models must be self-contained');
  }
});

for (const filename of ['Casual_Hoodie', 'Suit', 'Swat']) {
  test(`${filename}: equipped bat handle stays inside the actual hand across animated poses`, async t => {
    const gltf = await wardrobeGeometry(filename), root = gltf.scene, hand = rightHand(root);
    const clips = Object.fromEntries(gltf.animations.map(clip => [clip.name, clip]));
    const rig = prepareCharacterGrip(THREE, root, clips);
    assert.equal(rig.hand, hand);
    const mixer = new THREE.AnimationMixer(root);
    const ctx = context(character.template, ['releaseEquippedWeapon', 'equip'], {
      THREE, handR: hand, state: { weapon: 'bat' }, WCAT: {}, weaponMesh: null, equipSeq: 0,
      characterGrip: rig, attachHeldWeapon, applyCharacterGrip,
    });
    const factoryStart = character.template.indexOf('const V2 =');
    const factoryEnd = character.template.indexOf('function updateOutfitColors', factoryStart);
    assert.ok(factoryStart >= 0 && factoryEnd > factoryStart);
    vm.runInContext(character.template.slice(factoryStart, factoryEnd) + '\nthis.testHandleMaterial = LEATH;', ctx);
    ctx.equip(); root.updateMatrixWorld(true);
    let handle;
    ctx.weaponMesh.traverse(object => { if (object.material === ctx.testHandleMaterial) handle = object; });
    assert.ok(handle, 'measure the actual leather handle mesh, not a copied socket coordinate');
    handle.geometry.computeBoundingBox();
    const worldPositions = [];
    for (const clipName of ['Idle', 'Walk', 'Sword_Slash', 'Punch_Right']) {
      const clip = clips[clipName]; assert.ok(clip);
      mixer.stopAllAction(); mixer.clipAction(clip).reset().play();
      for (const phase of [.01, .33, .75]) {
        mixer.setTime(clip.duration * phase);
        applyCharacterGrip(rig); root.updateMatrixWorld(true);
        const world = handle.localToWorld(handle.geometry.boundingBox.getCenter(new THREE.Vector3()));
        worldPositions.push(world.clone());
        const grip = hand.worldToLocal(world);
        const error = grip.distanceTo(fingerGripCavity(root, hand));
        assert.ok(error < .015, `${filename} ${clipName}: handle is ${(error * 1000).toFixed(1)}mm outside the finger cavity`);
        assert.ok(grip.distanceTo(rig.center) < 1e-5, 'actual handle center drifted away from the measured socket');
        const axis = hand.worldToLocal(handle.localToWorld(new THREE.Vector3(0, 1, 0)))
          .sub(hand.worldToLocal(handle.localToWorld(new THREE.Vector3()))).normalize();
        assert.ok(axis.dot(rig.axis) > .99999, 'bat shaft no longer follows the thumbward grip axis');
      }
    }
    assert.ok(worldPositions.some(point => point.distanceTo(worldPositions[0]) > .1), 'test must exercise a moving arm, not only a static wrist');
    mixer.stopAllAction(); mixer.clipAction(clips.Idle).reset().play(); mixer.setTime(.01);
    applyCharacterGrip(rig); root.updateMatrixWorld(true);
    const triangles = handSkinTriangles(root, hand), closest = new THREE.Vector3();
    const bounds = handle.geometry.boundingBox;
    const handleRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
    let clearance = Infinity;
    for (let y = bounds.min.y; y <= bounds.max.y; y += .001) {
      const point = hand.worldToLocal(handle.localToWorld(new THREE.Vector3(0, y, 0)));
      for (const triangle of triangles) clearance = Math.min(clearance, triangle.closestPointToPoint(point, closest).distanceTo(point));
    }
    assert.ok(clearance >= handleRadius + .001,
      `${filename}: ${(handleRadius * 1000).toFixed(2)}mm handle radius has only ${(clearance * 1000).toFixed(2)}mm actual skin clearance`);
    t.diagnostic(`${filename}: ${(clearance * 1000).toFixed(2)}mm minimum skin clearance for ${(handleRadius * 1000).toFixed(2)}mm handle radius, 12 animated pose samples`);
    mixer.stopAllAction(); mixer.uncacheRoot(root);
  });

  test(`${filename}: grip preparation hides authored prop meshes without hiding clothing`, async () => {
    const gltf = await wardrobeGeometry(filename), root = gltf.scene;
    const embedded = [], clothing = [];
    function isEmbedded(object) { for (let node = object; node; node = node.parent) if (/^Pistol$/i.test(node.name)) return true; return false; }
    function visible(object) { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; }
    root.traverse(object => { if (object.isMesh) (isEmbedded(object) ? embedded : clothing).push(object); });
    assert.equal(embedded.length > 0, filename !== 'Casual_Hoodie', 'fixture must exercise the actual Suit/Swat embedded pistol');
    assert.ok(clothing.length >= 4 && clothing.every(visible));
    const rig = prepareCharacterGrip(THREE, root, Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])));
    assert.equal(rig.pose.length, 19);
    assert.ok(embedded.every(object => !visible(object)), 'an authored pistol remains visible beside the equipped weapon');
    assert.ok(clothing.every(visible), 'grip preparation hid body or clothing geometry');
  });
}

for (const outcome of ['resolve', 'reject']) {
  test(`Reselecting the displayed wardrobe cancels a pending rig that later ${outcome}s`, async () => {
    let settle;
    const pending = new Promise((resolve, reject) => { settle = outcome === 'resolve' ? resolve : reject; });
    const status = { hidden: true, textContent: '' }, logged = [], requests = [];
    const currentModel = { userData: { outfit: 'Casual_Hoodie' }, traverse() {} };
    const ctx = context(character.template, ['outfitFile', 'paintOutfit', 'loadCharacter'], {
      state: { outfit: 'suit' }, model: currentModel,
      OUTFIT_FILES: { street: 'Casual_Hoodie', suit: 'Suit', tactical: 'Swat' },
      characterCache: new Map(), characterLoadSeq: 0, characterLoadingFile: null,
      GLTFLoader: class { loadAsync(path) { requests.push(path); return pending; } },
      $: () => status, lang: 'en', console: { error: (...values) => logged.push(values) }
    });
    const load = ctx.loadCharacter();
    assert.equal(status.hidden, false);
    assert.equal(ctx.characterLoadingFile, 'Suit');
    ctx.state.outfit = 'street';
    ctx.paintOutfit();
    assert.equal(status.hidden, true, 'the visible valid outfit must not be covered by a stale loader');
    assert.equal(ctx.characterLoadingFile, null);
    if (outcome === 'reject') settle(new Error('late Suit failure'));
    else settle({ get scene() { assert.fail('cancelled Suit must not be installed or emit a ready event'); } });
    await load;
    assert.equal(ctx.model, currentModel);
    assert.equal(ctx.model.userData.outfit, 'Casual_Hoodie');
    assert.equal(status.hidden, true);
    assert.equal(logged.length, 0, 'obsolete failure must not report an error for the selected outfit');
    assert.equal(requests.length, 1, 'returning to the cached visible rig must not fetch it again');
    assert.equal(ctx.characterCache.has('Suit'), outcome === 'resolve', 'failed cache entries remain retryable');
  });
}

test('All eight catalog family representatives keep their authored grip centered and barrels away from the wrist', async () => {
  const gltf = await wardrobeGeometry('Suit'), root = gltf.scene;
  const rig = prepareCharacterGrip(THREE, root, Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])));
  const nativeGunPoints = [];
  root.getObjectByName('Pistol').traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) nativeGunPoints.push(
      rig.hand.worldToLocal(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
  });
  const nativeBounds = new THREE.Box3().setFromPoints(nativeGunPoints), nativeSize = nativeBounds.getSize(new THREE.Vector3());
  assert.ok(nativeGunPoints.length > 1000 && nativeBounds.min.y > 0 && nativeSize.y > nativeSize.z * 3,
    'actual authored pistol must establish the forward direction beyond the wrist along +Y, not palm-normal Z');
  const catalogContext = vm.createContext({});
  Object.values(character.scripts).filter(script => script.includes('globalThis.ZONE_WEAPONS')).forEach(script => vm.runInContext(script, catalogContext));
  const families = ['Revolver', 'Pistol', 'Shotgun', 'SubmachineGun', 'AssaultRifle', 'AssaultRifle2', 'Bullpup', 'SniperRifle'];
  const expectedBarrel = new THREE.Vector3(0, 1, 0).projectOnPlane(rig.axis).normalize();
  for (const family of families) {
    const entry = Object.values(catalogContext.ZONE_WEAPONS).find(item => item.fam === family && item.file.endsWith('_1'));
    assert.ok(entry, `${family} representative missing`);
    const mesh = representativeWeaponMesh(entry.file); mesh.scale.setScalar(entry.scale);
    const ctx = context(character.template, ['releaseEquippedWeapon', 'equip'], {
      THREE, handR: rig.hand, characterGrip: rig, state: { weapon: 'test' }, WCAT: { test: entry },
      weaponMesh: null, equipSeq: 0, loadWeapon: async () => mesh, attachHeldWeapon, applyCharacterGrip,
    });
    ctx.equip(); await Promise.resolve();
    const hold = ctx.weaponMesh; assert.ok(hold, `${family} was not attached by the shipped equip function`);
    root.updateMatrixWorld(true);
    const origin = rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3()));
    assert.ok(origin.distanceTo(rig.center) < 1e-5, `${family} authored grip left its socket`);
    const barrel = rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3(1, 0, 0))).sub(origin).normalize();
    assert.ok(barrel.dot(expectedBarrel) > .99999 && barrel.y > .8, `${family} barrel points into the forearm or has uncontrolled twist`);
    const down = rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3(0, -1, 0))).sub(origin).normalize();
    assert.ok(down.dot(rig.axis) > .99999, `${family} source frame does not retain its defined roll`);
    hold.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
  }
});

test('Catalog attachment accounts for the model scale when aligning a nonzero measured grip point', async () => {
  const gltf = await wardrobeGeometry('Suit'), root = gltf.scene;
  const rig = prepareCharacterGrip(THREE, root, Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])));
  const mesh = representativeWeaponMesh('Revolver_1'); mesh.scale.set(.1514, .20, .12);
  // Center of the actual Wood material bounds in Revolver_1's unscaled OBJ.
  const grip = [.010764, -.0102325, -.0000005];
  attachHeldWeapon(THREE, rig, mesh, grip, -1, true); root.updateMatrixWorld(true);
  const actual = rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3(...grip)));
  assert.ok(actual.distanceTo(rig.center) < 1e-5, 'raw model units were subtracted after scaling, displacing the physical grip');
});

for (const key of ['knife', 'revolver']) {
  test(`Procedural ${key} uses its actual handle center and preserves distinct blade/barrel geometry`, async () => {
    const gltf = await wardrobeGeometry('Casual_Hoodie'), root = gltf.scene;
    const rig = prepareCharacterGrip(THREE, root, Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])));
    const ctx = context(character.template, ['releaseEquippedWeapon', 'equip'], {
      THREE, handR: rig.hand, characterGrip: rig, state: { weapon: key }, WCAT: {}, weaponMesh: null, equipSeq: 0,
      attachHeldWeapon, applyCharacterGrip,
    });
    const start = character.template.indexOf('const V2 ='), end = character.template.indexOf('function updateOutfitColors', start);
    vm.runInContext(character.template.slice(start, end) + '\nthis.handleMaterial = WALNUT; this.bladeMaterial = SATIN;', ctx);
    ctx.equip(); root.updateMatrixWorld(true);
    let handle, blade;
    ctx.weaponMesh.traverse(object => { if (object.material === ctx.handleMaterial) handle = object; if (object.material === ctx.bladeMaterial) blade = object; });
    assert.ok(handle);
    handle.geometry.computeBoundingBox();
    const center = rig.hand.worldToLocal(handle.localToWorld(handle.geometry.boundingBox.getCenter(new THREE.Vector3())));
    assert.ok(center.distanceTo(rig.center) < 1e-5, `${key} attachment uses a guessed origin instead of the handle center`);
    const mesh = ctx.weaponMesh.userData.zoneGripMesh;
    const forward = rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3(1, 0, 0)))
      .sub(rig.hand.worldToLocal(mesh.localToWorld(new THREE.Vector3()))).normalize();
    if (key === 'knife') {
      assert.ok(forward.dot(rig.axis) > .99999, 'straight knife handle does not follow its actual +X axis');
      assert.ok(blade); blade.geometry.computeBoundingBox();
      const woodBounds = handle.geometry.boundingBox.clone().applyMatrix4(handle.matrix);
      const bladeBounds = blade.geometry.boundingBox.clone().applyMatrix4(blade.matrix);
      assert.ok(woodBounds.max.x <= bladeBounds.min.x, 'knife handle physically overlaps its blade');
    } else {
      assert.ok(forward.dot(new THREE.Vector3(0, 1, 0).projectOnPlane(rig.axis).normalize()) > .99999, 'procedural revolver inherits the bat orientation');
    }
  });
}

for (const [name, viewer] of [['character', character], ['weapon', weapon]]) {
  test(`${name}: all decoded scripts parse and every catalog weapon has embedded model data`, () => {
    const scripts = [...Object.values(viewer.scripts)];
    for (const match of viewer.template.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[1].includes('importmap') && match[2].trim()) scripts.push(match[2]);
    }
    for (const script of scripts) {
      const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: script, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const ctx = vm.createContext({});
    Object.values(viewer.scripts).filter(script => script.includes('globalThis.ZONE_')).forEach(script => vm.runInContext(script, ctx));
    assert.equal(Object.keys(ctx.ZONE_WEAPONS).length, 49);
    for (const item of Object.values(ctx.ZONE_WEAPONS)) for (const ext of ['obj', 'mtl']) {
      assert.ok(ctx.ZONE_WEAPON_PACK[`${item.file}.${ext}`], `${item.file}.${ext} is absent from bundle`);
      assert.ok(existsSync(new URL(`../assets/weapons/${item.file}.${ext}`, import.meta.url)), `${item.file}.${ext} local fallback missing`);
    }
    if (name === 'character') {
      assert.equal(ctx.ZONE_MANNEQUIN_GLB, undefined, 'unused mannequin should not be downloaded');
      assert.match(viewer.template, /character\/quaternius\//);
    }
  });

  test(`${name}: render gate pauses offscreen, hidden and pagehide without duplicate loops`, () => {
    const events = new Map(), visibility = new Map();
    let startCount = 0, stopCount = 0, callback, disconnected = 0;
    const document = { hidden: false, body: { dataset: {} }, addEventListener: (key, fn) => visibility.set(key, fn), removeEventListener: key => visibility.delete(key) };
    const ctx = context(viewer.template, ['createRenderGate'], {
      document, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key),
      IntersectionObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected++; } },
    });
    const gate = ctx.createRenderGate(() => startCount++, () => stopCount++, {});
    assert.equal(startCount, 0);
    callback([{ isIntersecting: true }]); callback([{ isIntersecting: true }]);
    assert.equal(startCount, 1);
    callback([{ isIntersecting: false }]); assert.equal(stopCount, 1);
    document.hidden = true; callback([{ isIntersecting: true }]); assert.equal(startCount, 1);
    document.hidden = false; visibility.get('visibilitychange')(); assert.equal(startCount, 2);
    events.get('pagehide')(); assert.equal(stopCount, 2);
    events.get('pageshow')(); assert.equal(startCount, 3);
    gate.dispose(); assert.equal(stopCount, 3);
    assert.equal(disconnected, 1); assert.equal(events.size, 0); assert.equal(visibility.size, 0);
    assert.equal(document.body.dataset.zoneRendering, 'paused');
  });
}

test('Item disposal frees each owned resource once and retains cached shared materials', () => {
  let geometryDisposals = 0, ownedDisposals = 0, sharedDisposals = 0;
  const geometry = { dispose: () => geometryDisposals++ }, owned = { dispose: () => ownedDisposals++ }, shared = { dispose: () => sharedDisposals++ };
  const ctx = context(weapon.template, ['disposeItem'], { M: { steel: shared } });
  const root = { traverse: visit => [{ geometry, material: [owned, shared] }, { geometry, material: owned }].forEach(visit) };
  ctx.disposeItem(root);
  assert.equal(geometryDisposals, 1); assert.equal(ownedDisposals, 1); assert.equal(sharedDisposals, 0);
});

test('Late item loads are discarded and successive visible items release previous objects', async () => {
  const disposed = [], installed = [];
  let finishGun;
  const model = name => ({ name, position: { x: 0, y: 0, z: 0 } });
  const ctx = context(weapon.template, ['show'], {
    WCAT: { gun: {} }, MODELS: { bat: () => model('bat'), knife: () => model('knife') }, ALIAS: {},
    current: null, showSeq: 0, shownObject: null,
    loadGun: () => new Promise(resolve => { finishGun = resolve; }), disposeItem: item => { if (item) disposed.push(item.name); },
    stage: { setAttribute() {}, setObject: root => installed.push(root.name) },
    THREE: { Box3: class { constructor() { this.min = { x: 0, y: 0, z: 0 }; this.max = this.min; } setFromObject() { return this; } }, Group: class { add() {} } },
  });
  const loading = ctx.show('gun');
  await ctx.show('bat'); finishGun(model('gun')); await loading;
  await ctx.show('knife');
  assert.deepEqual(installed, ['zone_bat', 'zone_knife']);
  assert.deepEqual(disposed, ['gun', 'zone_bat']);
});

test('Character replacement frees procedural geometry while retaining catalog cache and materials', () => {
  let disposals = 0;
  const geometry = { dispose: () => disposals++ };
  const ctx = context(character.template, ['releaseEquippedWeapon']);
  const root = { userData: {}, traverse: visit => [geometry, geometry].forEach(geometry => visit({ geometry })) };
  ctx.releaseEquippedWeapon(root); assert.equal(disposals, 0);
  root.userData.zoneOwnedGeometry = true;
  ctx.releaseEquippedWeapon(root); assert.equal(disposals, 1);
});

test('Outfit changes update the existing GPU color attribute instead of abandoning buffers', () => {
  let created = 0, attribute;
  const ctx = context(character.template, ['updateOutfitColors'], {
    THREE: { BufferAttribute: class { constructor(array) { this.array = array; created++; } } },
  });
  const geometry = { getAttribute: () => attribute, setAttribute: (_name, value) => { attribute = value; } };
  ctx.updateOutfitColors(geometry, new Float32Array([1, 2, 3]));
  const original = attribute;
  for (let i = 0; i < 100; i++) ctx.updateOutfitColors(geometry, new Float32Array([i, 4, 5]));
  assert.equal(created, 1); assert.equal(attribute, original); assert.equal(attribute.array[0], 99); assert.equal(attribute.needsUpdate, true);
});

test('Stage render control never resumes a detached canvas and can resume the same scene', () => {
  const source = Object.values(weapon.scripts).find(script => script.includes('class ThreeDStage'));
  assert.ok(source);
  const ctx = vm.createContext({}); vm.runInContext(extract(source, 'setRenderingEnabled', true), ctx);
  const loops = [], stage = { isConnected: true, _loop: () => {}, _renderer: { setAnimationLoop: loop => loops.push(loop) } };
  ctx.setRenderingEnabled.call(stage, false); ctx.setRenderingEnabled.call(stage, true);
  stage.isConnected = false; ctx.setRenderingEnabled.call(stage, true);
  assert.deepEqual(loops, [null, stage._loop, null]);
});

test('Item toolbar inherits Arabic before renderer readiness and updates all labels on language change', () => {
  const source = Object.values(weapon.scripts).find(script => script.includes('class ThreeDStage'));
  const node = () => ({ children: [], appendChild(child) { this.children.push(child); }, addEventListener() {}, querySelector(selector) { return this.children.find(child => `.${child.className}` === selector); } });
  const ctx = vm.createContext({
    stylesheet: '', URLSearchParams, location: { search: '' }, parent: { document: { documentElement: { lang: 'ar' } } },
    document: { documentElement: {}, createElement: node },
    HTMLElement: class { attachShadow() { this.shadowRoot = node(); return this.shadowRoot; } },
  });
  const method = name => extract(source, name, true).replace(/^function\s+/, '');
  vm.runInContext(`${extract(source, 'initialViewerLanguage')}\nclass Stage extends HTMLElement { ${method('constructor')} ${method('setLanguage')} _setButtonsEnabled() {} }; this.Stage = Stage;`, ctx);
  const stage = new ctx.Stage();
  assert.equal(stage._objBtn.textContent, 'تنزيل OBJ + MTL');
  assert.equal(stage._glbBtn.textContent, 'تنزيل GLB');
  assert.equal(stage.shadowRoot.querySelector('.note').textContent, 'اسحب للتدوير. مرر للتقريب. اسحب بالزر الأيمن للتحريك.');
  assert.equal(ctx.document.documentElement.dir, 'rtl');
  stage.setLanguage('en');
  assert.equal(stage._objBtn.textContent, 'Download OBJ + MTL');
  assert.equal(stage._glbBtn.textContent, 'Download GLB');
  assert.match(stage.shadowRoot.querySelector('.note').textContent, /^Drag to orbit/);
  assert.equal(ctx.document.documentElement.dir, 'ltr');
  ctx.location.search = '?lang=en';
  assert.equal(new ctx.Stage()._objBtn.textContent, 'Download OBJ + MTL');
});

test('Compact character selector reflects equipped bat and knife in both languages', () => {
  const select = () => ({ options: [], value: '', set innerHTML(value) { if (value === '') this.options = []; }, appendChild(option) { this.options.push(option); } });
  const weaponSelect = select(), animationSelect = select();
  const ctx = context(character.template, ['proceduralWeaponLabel', 'buildCompact', 'paintCompact'], {
    MINI: false, lang: 'en', state: { weapon: 'bat' }, lastAct: 'idle', ACTIONS: [], CLIP: {},
    $: id => id === 'cwep' ? weaponSelect : animationSelect, document: { createElement: () => ({}) },
    WEAPON: { bat() {}, knife() {}, revolver() {} },
    WCAT: { revolver: { file: 'Revolver_1', dmg: 1.9 }, alias: { file: 'Revolver_1', dmg: 1.9 }, rifle: { file: 'AssaultRifle_1', dmg: 3.4 } },
    WNAME: { en: { revolver: 'Revolver', rifle: 'Rifle' }, ar: { revolver: 'مسدس', rifle: 'بندقية' } },
    find() {}, setWeapon() {}, trigger() {}, actionLabel: (_key, text) => text,
  });
  ctx.buildCompact();
  assert.equal(weaponSelect.value, 'bat');
  assert.equal(weaponSelect.options.find(option => option.value === 'bat').textContent, 'Baseball bat');
  assert.deepEqual(weaponSelect.options.map(option => option.value), ['fists', 'bat', 'knife', 'revolver', 'rifle']);
  ctx.state.weapon = 'knife'; ctx.lang = 'ar'; ctx.buildCompact();
  assert.equal(weaponSelect.value, 'knife');
  assert.equal(weaponSelect.options.find(option => option.value === 'knife').textContent, 'سكين');
  assert.equal(weaponSelect.options.find(option => option.value === 'bat').textContent, 'مضرب بيسبول');
  ctx.state.weapon = 'alias'; ctx.paintCompact(); assert.equal(weaponSelect.value, 'revolver');
  ctx.state.weapon = 'fists'; ctx.paintCompact(); assert.equal(weaponSelect.value, 'fists');
});

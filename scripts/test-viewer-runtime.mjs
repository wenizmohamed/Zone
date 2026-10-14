import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';
import { computeWeaponFrame, installWeaponPresentation, createStoredZip, createWeaponObjArchive } from '../dist/weapon-presentation.js';
import { inspectWeaponObject } from '../dist/weapon-assets.js';
import { OBJExporter } from '../lib/three184/OBJExporter.js';

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

test('Item quality observer tolerates an iframe detached during asynchronous imports', () => {
  const calls=[];let callback;
  const ctx=context(weapon.template,['watchAssetQuality'],{document:{documentElement:null},paintAssetQuality(){throw new Error('Detached page painted');},MutationObserver:class{constructor(fn){callback=fn;}observe(target){assert.ok(target,'Observer received null');calls.push(target);}disconnect(){}}});
  ctx.watchAssetQuality({isConnected:false},null);assert.equal(calls.length,0);callback();
  ctx.document.documentElement={nodeType:1};const stage={isConnected:true};ctx.paintAssetQuality=()=>calls.push('paint');ctx.watchAssetQuality(stage,{});assert.equal(calls.length,2);callback();assert.equal(calls[2],'paint');
});

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
  const ctx = vm.createContext({ setTimeout, clearTimeout, document: { body: { dataset: {} } }, weaponAssets: { descriptor: () => null }, ...values });
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), ctx);
  return ctx;
}

test('embedded character equipment rejects unowned models and sends the original gameplay item ID', () => {
  const posted = [], equipped = [];
  const ctx = context(character.template, ['weaponSelectable', 'setWeapon'], {
    state: { weapon: 'bat', ownedWeapons: ['fists', 'bat', 'revolver_1'], equipmentKeys: { revolver_1: 'revolver' } },
    equip: () => equipped.push(true), paintRack() {}, paintCompact() {},
    parent: { postMessage: data => posted.push(data) }, location: { origin: 'http://zone.test' },
    WCAT: { revolver_1: { anim: 'punch' } }, trigger() {},
  });
  ctx.setWeapon('assaultrifle2_1');
  assert.equal(ctx.state.weapon, 'bat'); assert.equal(posted.length, 0); assert.equal(equipped.length, 0);
  ctx.setWeapon('revolver_1');
  assert.equal(ctx.state.weapon, 'revolver_1'); assert.equal(posted[0].zoneEquip, 'revolver');
  ctx.state.ownedWeapons = undefined;
  assert.equal(ctx.weaponSelectable('assaultrifle2_1'), true, 'standalone presentation remains available');
});

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
    const ctx = context(character.template, ['outfitFile', 'paintOutfit', 'characterRequest', 'loadCharacter'], {
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
    mesh.userData.zoneWeaponAsset = { gripPoint: [0, 0, 0], axis: -1, forward: true, id: entry.file };
    const ctx = context(character.template, ['releaseEquippedWeapon', 'equip'], {
      THREE, handR: rig.hand, characterGrip: rig, state: { weapon: 'test' }, WCAT: { test: entry },
      weaponMesh: null, equipSeq: 0, weaponAssets: { descriptor: () => entry, load: async () => mesh }, attachHeldWeapon, applyCharacterGrip,
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
  test(`${name}: all decoded scripts parse and catalog keys retain resolvable legacy fallbacks`, () => {
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
    const canonical = vm.createContext({});
    vm.runInContext(readFileSync(new URL('../assets/weapons/catalog.js', import.meta.url), 'utf8'), canonical);
    assert.deepEqual(Object.keys(ctx.ZONE_WEAPONS).sort(), Object.keys(canonical.ZONE_WEAPONS).sort(), 'viewer catalog drifted from the canonical gameplay keys');
    for (const item of Object.values(ctx.ZONE_WEAPONS)) for (const ext of ['obj', 'mtl']) {
      const embedded = ctx.ZONE_WEAPON_PACK?.[`${item.file}.${ext}`];
      const local = existsSync(new URL(`../assets/weapons/${item.file}.${ext}`, import.meta.url));
      assert.ok(embedded || local, `${item.file}.${ext} has neither an embedded nor a local fallback`);
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
  const model = name => { const item = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .3), new THREE.MeshBasicMaterial()); item.name = name; return item; };
  const ctx = context(weapon.template, ['show'], {
    WCAT: { gun: {} }, MODELS: { bat: () => model('bat'), knife: () => model('knife') }, ALIAS: {},
    current: null, showSeq: 0, shownObject: null, pendingKey: null, pendingShow: null, assetLoader: null, itemStatus() {},
    loadGun: () => new Promise(resolve => { finishGun = resolve; }), disposeItem: item => { if (item) disposed.push(item.name); },
    stage: { dataset: {}, setAttribute() {}, setObject: root => installed.push(root.name) }, THREE, inspectAsset: inspectWeaponObject,
  });
  const loading = ctx.show('gun');
  await ctx.show('bat'); finishGun(model('gun')); await loading;
  await ctx.show('knife');
  assert.deepEqual(installed, ['zone_bat', 'zone_knife']);
  assert.deepEqual(disposed, ['gun', 'zone_bat']);
});

function itemHarness(loader) {
  const installed = [], disposed = [], statuses = [], errors = [];
  const ctx = context(weapon.template, ['show'], {
    THREE, inspectAsset: inspectWeaponObject, WCAT: { gun: {}, other: {} }, MODELS: {}, ALIAS: {}, current: null, showSeq: 0,
    shownObject: null, pendingKey: null, pendingShow: null, assetLoader: loader,
    itemStatus: state => statuses.push(state), disposeItem: object => { if (object) disposed.push(object); },
    stage: { dataset: {}, setAttribute() {}, setObject: object => installed.push(object) },
    console: { error: (...args) => errors.push(args) }, loadGun: () => assert.fail('managed assets must not enter the legacy fallback'),
  });
  return { ctx, installed, disposed, statuses, errors };
}

test('bat diagonal thumbnail pose is conditional and leaves ordinary viewer pose unchanged',async()=>{
  for(const thumbnail of [false,true]) {
    const bat=managedMesh('old-wooden-bat');
    const {ctx}=itemHarness({load:async()=>bat});
    ctx.WCAT.bat={};
    if(thumbnail)ctx.stage.dataset.zoneThumbnail='true';
    await ctx.show('bat');
    assert.equal(ctx.shownObject.rotation.z,thumbnail?-.95:0);
    if(thumbnail)assert.deepEqual(JSON.parse(ctx.stage.dataset.zoneThumbnailPose),{rotationZ:-.95,scope:'thumbnail-only',sourceId:'old-wooden-bat'});
    else assert.equal(ctx.stage.dataset.zoneThumbnailPose,undefined);
    assert.equal(ctx.shownObject._zoneManagedAsset,bat);
  }
});
function managedMesh(name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .1, .05), new THREE.MeshStandardMaterial());
  mesh.name = name; mesh.userData.zoneWeaponAsset = { id: name };
  return mesh;
}

test('registered gun aliases resolve their actual target instead of displaying a revolver', async () => {
  const requested = [], { ctx, installed } = itemHarness({ load: async key => { requested.push(key); return managedMesh(key); } });
  ctx.WCAT = { ak: {}, smg: {} }; ctx.ALIAS = { rifle: 'ak', smg_c: 'smg' };
  await ctx.show('rifle'); await ctx.show('smg_c');
  assert.deepEqual(requested, ['ak', 'smg']); assert.deepEqual(installed.map(object => object.name), ['zone_ak', 'zone_smg']);
});

test('unknown item models expose an explicit unavailable state without loading a different gun', async () => {
  let requests = 0; const { ctx, installed, statuses } = itemHarness({ load: async () => { requests++; return managedMesh('wrong'); } });
  await ctx.show('unregistered-owner-item');
  assert.equal(requests, 0); assert.equal(installed.length, 0); assert.deepEqual(statuses, ['error']);
  assert.equal(JSON.parse(ctx.stage.dataset.zoneAssetError).code, 'unregistered-model');
  assert.equal(JSON.parse(ctx.stage.dataset.zoneAssetError).requestedKey, 'unregistered-owner-item');
  assert.equal(ctx.stage.dataset.zoneAsset, '{}');
});

for (const outcome of ['resolve', 'reject']) {
  test(`Selecting the displayed item cancels a pending managed asset that later ${outcome}s`, async () => {
    let settle, requests = 0;
    const first = managedMesh('gun'), late = managedMesh('other');
    const { ctx, installed, disposed, statuses, errors } = itemHarness({ load: key => {
      requests++; return key === 'gun' ? Promise.resolve(first) : new Promise((resolve, reject) => { settle = outcome === 'resolve' ? resolve : reject; });
    } });
    await ctx.show('gun');
    const pending = ctx.show('other'), duplicate = ctx.show('other');
    await ctx.show('gun');
    if (outcome === 'resolve') settle(late); else settle(new Error('obsolete network failure'));
    await Promise.all([pending, duplicate]);
    assert.equal(requests, 2, 'the same pending selection must share one request');
    assert.equal(installed.length, 1); assert.equal(ctx.current, 'gun');
    assert.equal(ctx.shownObject._zoneManagedAsset, first);
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.shownObject.userData)), { zoneWeaponAsset: { id: 'gun' } }, 'The stage wrapper retains plain metadata for the source lighting profile; no live Three scene graph');
    assert.equal(ctx.pendingKey, null); assert.equal(statuses.at(-1), 'ready');
    assert.equal(errors.length, 0, 'an obsolete request must not obscure the visible valid item');
    assert.deepEqual(disposed, outcome === 'resolve' ? [late] : []);
  });
}

test('A failed selected item can be retried and a successful replacement releases its prior managed asset', async () => {
  let tries = 0;
  const first = managedMesh('gun'), second = managedMesh('other');
  const { ctx, installed, disposed, statuses, errors } = itemHarness({ load: key => {
    if (key === 'gun') return Promise.resolve(first);
    if (++tries === 1) return Promise.reject(new Error('temporary network failure'));
    return Promise.resolve(second);
  } });
  await ctx.show('gun'); await ctx.show('other');
  assert.equal(statuses.at(-1), 'error'); assert.equal(ctx.pendingKey, null);
  assert.equal(installed.length, 1, 'failed loading must retain the previous scene');
  await ctx.show('other');
  assert.equal(tries, 2); assert.equal(statuses.at(-1), 'ready'); assert.equal(errors.length, 1);
  assert.equal(installed.length, 2); assert.deepEqual(disposed, [installed[0]]);
  assert.equal(ctx.shownObject._zoneManagedAsset, second);
});

test('A canceled shared request returning null cannot start a legacy asset request after teardown', async () => {
  let finish,fallbackRequests=0;
  const {ctx,installed}=itemHarness({load:()=>new Promise(resolve=>finish=resolve)});
  ctx.loadGun=async()=>{fallbackRequests++;return managedMesh('obsolete-fallback');};
  const pending=ctx.show('gun'); ++ctx.showSeq; finish(null); await pending;
  assert.equal(fallbackRequests,0,'cancellation must be checked before starting the legacy fallback');
  assert.equal(installed.length,0);
});

test('Item and character managed-asset disposal delegate to the shared owner exactly once', () => {
  const asset = managedMesh('managed'), released = [];
  const item = context(weapon.template, ['disposeItem'], { assetLoader: { release: object => released.push(object) }, M: {} });
  const wrapper = new THREE.Group(); wrapper._zoneManagedAsset = asset; wrapper.add(asset);
  item.disposeItem(wrapper); assert.deepEqual(released, [asset]);
  const characterContext = context(character.template, ['releaseEquippedWeapon'], { weaponAssets: { release: object => released.push(object) } });
  wrapper.userData.zoneOwnedGeometry = true; wrapper.userData.zoneGripMesh = asset; asset.userData.zoneOwnedMaterials = true;
  characterContext.releaseEquippedWeapon(wrapper); assert.deepEqual(released, [asset, asset]);
});

test('Character async weapon switching releases obsolete assets and never reattaches them after selecting fists', async () => {
  const rig = { hand: new THREE.Group(), center: new THREE.Vector3(.01,.1,-.03), axis: new THREE.Vector3(-1,0,0), pose: [] };
  const pending = [], released = [], asset = managedMesh('late-bat');
  asset.userData.zoneWeaponAsset = { id: 'late-bat', gripPoint: [0,0,0], axis: 1, forward: false };
  const ctx = context(character.template, ['releaseEquippedWeapon', 'equip'], {
    THREE, handR: rig.hand, characterGrip: rig, state: { weapon: 'bat' }, WEAPON: {}, weaponMesh: null, equipSeq: 0,
    attachHeldWeapon, applyCharacterGrip,
    weaponAssets: { descriptor: key => key === 'fists' ? null : {}, load: () => new Promise(resolve => pending.push(resolve)), release: object => released.push(object) },
  });
  ctx.equip(); ctx.state.weapon = 'fists'; ctx.equip(); pending[0](asset); await Promise.resolve();
  assert.equal(ctx.weaponMesh, null); assert.equal(rig.hand.children.length, 0); assert.deepEqual(released, [asset]);
});

test('Studio framing keeps every real-sized weapon box inside portrait and wide viewport margins', () => {
  const boxes = [
    new THREE.Box3(new THREE.Vector3(-.05,-.1,-.04), new THREE.Vector3(.05,.6,.04)),
    new THREE.Box3(new THREE.Vector3(-.4,-.08,-.04), new THREE.Vector3(.8,.2,.04)),
    new THREE.Box3(new THREE.Vector3(12,-3,5), new THREE.Vector3(12.3,-2.8,5.15)),
    new THREE.Box3(),
  ];
  for (const box of boxes) for (const aspect of [.38,.6,1,1.8,3]) {
    const frame = computeWeaponFrame(THREE, box, aspect, 38);
    const camera = new THREE.PerspectiveCamera(38, aspect, frame.near, frame.far);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    assert.ok(frame.near > 0 && frame.far > frame.distance && Number.isFinite(frame.distance));
    for (const x of [frame.box.min.x, frame.box.max.x]) for (const y of [frame.box.min.y, frame.box.max.y]) for (const z of [frame.box.min.z, frame.box.max.z]) {
      const ndc = new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(ndc.x) <= .84 && Math.abs(ndc.y) <= .73 && ndc.z >= -1 && ndc.z <= 1,
        `weapon clips at aspect ${aspect}: ${ndc.toArray()}`);
    }
  }
});

test('Studio presentation owns its lighting and environment cleanup while retaining weapon resources', t => {
  const globals = new Map(['matchMedia','devicePixelRatio','ResizeObserver','document'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(() => { for (const [key,descriptor] of globals) if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; });
  let resizeCallback, disconnected=0, environmentDisposals=0, pmremDisposals=0, temporaryGeometryDisposals=0, temporaryMaterialDisposals=0;
  globalThis.matchMedia = () => ({ matches:true }); globalThis.devicePixelRatio = 3;
  globalThis.ResizeObserver = class { constructor(callback) { resizeCallback=callback; } observe() {} disconnect() { disconnected++; } };
  const status={ style:{}, setAttribute() {}, remove(){this.removed=true;} };
  globalThis.document={ createElement:()=>status };
  const canvasEvents = new Map(), labels = {}, canvas = { setAttribute:(key,value)=>labels[key]=value, addEventListener:(key,fn)=>canvasEvents.set(key,fn), removeEventListener:key=>canvasEvents.delete(key) };
  const renderer = { domElement:canvas, getRenderTarget:()=>null, getClearColor:color=>color.set(0), getClearAlpha:()=>1,
    setRenderTarget() {}, setClearColor() {}, setPixelRatio(value) { this.ratio=value; }, setSize() {} };
  const environmentColors = [], environmentTargets = [];
  const Engine = { ...THREE, PMREMGenerator:class {
    fromScene(room) {
      environmentColors.push(room.background.getHex());
      assert.ok([0x171b20, 0x353e46].includes(room.background.getHex()), 'studio must use the accepted reference or bounded new-asset environment');
      const geometries=new Set(); room.traverse(object=>{ if(object.geometry) geometries.add(object.geometry); if(object.material) object.material.addEventListener('dispose',()=>temporaryMaterialDisposals++); });
      geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>temporaryGeometryDisposals++));
      const target = { texture:new THREE.Texture(), disposals:0, dispose() { this.disposals++; environmentDisposals++; } };
      environmentTargets.push(target); return target;
    }
    dispose() { pmremDisposals++; }
  } };
  let keyStops=0, statesSaved=0, weaponDisposals=0;
  const controls={ target:new THREE.Vector3(), update() {}, saveState(){statesSaved++;}, listenToKeyEvents(target){assert.equal(target,canvas);}, stopListenToKeyEvents(){keyStops++;} };
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(50,1,.01,100), key=new THREE.DirectionalLight();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial()), item=managedMesh('retained');
  item.geometry.addEventListener('dispose',()=>weaponDisposals++); item.material.addEventListener('dispose',()=>weaponDisposals++); scene.add(key,ground,item);
  const stage={ _scene:scene,_renderer:renderer,_camera:camera,_controls:controls,_key:key,_ground:ground,lang:'ar',clientWidth:320,clientHeight:480,dataset:{},shadowRoot:{appendChild(node){assert.equal(node,status);}},setLanguage(value){this.lang=value;},setObject(object){if(!object.parent)scene.add(object);} };
  const presentation=installWeaponPresentation(Engine,stage);
  assert.equal(renderer.toneMappingExposure,1.04); assert.equal(scene.environmentIntensity,.8);
  assert.deepEqual(environmentColors,[0x171b20]); assert.equal(scene.getObjectByName('studio-softbox-fill').intensity,0);
  assert.equal(renderer.ratio,1.5,'phone DPR must stay bounded'); assert.equal(key.shadow.mapSize.x,1024);
  assert.equal(pmremDisposals,1); assert.equal(temporaryGeometryDisposals,1); assert.equal(temporaryMaterialDisposals,5);
  assert.match(labels['aria-label'],/^معاينة/);
  stage.dataset.zoneAssetState='loading'; stage.setAssetStatus('loading'); assert.equal(status.hidden,false); assert.match(status.textContent,/تحميل/);
  stage.setLanguage('en'); assert.match(labels['aria-label'],/^3D item/); assert.equal(status.textContent,'Loading 3D preview...');
  stage.setAssetStatus('ready'); assert.equal(status.hidden,true);
  stage.setObject(item); assert.ok(statesSaved>0 && JSON.parse(stage.dataset.zoneFrame).aspect===320/480);
  assert.deepEqual(environmentColors,[0x171b20,0x353e46]); assert.equal(scene.environmentIntensity,.95);
  item.userData.zoneWeaponAsset={id:'m9-knife'}; stage.setObject(item);
  assert.equal(renderer.toneMappingExposure,1.04); assert.equal(scene.environmentIntensity,.8);
  assert.equal(key.intensity,2.4); assert.equal(scene.getObjectByName('studio-fill').intensity,.85);
  assert.equal(scene.getObjectByName('studio-rim').intensity,2.0); assert.equal(scene.getObjectByName('studio-softbox-fill').intensity,0);
  assert.equal(environmentTargets.length,2,'profile reselection must reuse its original PMREM rather than recreate resources');
  stage.clientWidth=640; resizeCallback(); assert.equal(JSON.parse(stage.dataset.zoneFrame).aspect,640/480);
  presentation.dispose(); presentation.dispose();
  assert.equal(disconnected,1); assert.equal(environmentDisposals,2); assert.ok(environmentTargets.every(target=>target.disposals===1));
  assert.equal(keyStops,1); assert.equal(canvasEvents.size,0);
  assert.equal(scene.environment,null); assert.equal(weaponDisposals,0); assert.equal(item.parent,scene);
  assert.equal(status.removed,true); assert.equal(stage.setAssetStatus,undefined);
  assert.equal(scene.getObjectByName('studio-fill'),undefined); assert.equal(scene.getObjectByName('studio-rim'),undefined); assert.equal(scene.getObjectByName('studio-softbox-fill'),undefined);
});

function zipEntries(bytes) {
  const end=bytes.length-22; assert.equal(bytes.readUInt32LE(end),0x06054b50);
  const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),length=bytes.readUInt32LE(end+12);
  assert.equal(start+length,end); const files=new Map(); let cursor=start;
  for(let i=0;i<count;i++) {
    assert.equal(bytes.readUInt32LE(cursor),0x02014b50);
    const size=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32);
    const name=bytes.toString('utf8',cursor+46,cursor+46+nameLength),local=bytes.readUInt32LE(cursor+42);
    assert.equal(bytes.readUInt32LE(local),0x04034b50); assert.equal(bytes.readUInt16LE(local+8),0,'fixture expects ZIP stored entries');
    assert.equal(bytes.readUInt32LE(local+18),size); assert.equal(bytes.readUInt32LE(local+14),bytes.readUInt32LE(cursor+16));
    const localNameLength=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),data=local+30+localNameLength+localExtra;
    assert.equal(bytes.toString('utf8',local+30,local+30+localNameLength),name); assert.ok(data+size<=start);
    assert.ok(!files.has(name),'archive contains duplicate filenames'); files.set(name,bytes.subarray(data,data+size));
    cursor+=46+nameLength+extraLength+commentLength;
  }
  assert.equal(cursor,end); return files;
}

test('Download ZIP has valid central directory, UTF-8 names and original binary bytes', async () => {
  const binary=new Uint8Array([0,1,255,34]),blob=await createStoredZip([{name:'hello.txt',data:'hello'},{name:'خامة.png',data:binary}]);
  const bytes=Buffer.from(await blob.arrayBuffer()),files=zipEntries(bytes);
  assert.equal(blob.type,'application/zip'); assert.equal(files.get('hello.txt').toString(),'hello'); assert.deepEqual(files.get('خامة.png'),Buffer.from(binary));
  assert.equal(bytes.readUInt32LE(14),0x3610a686,'known hello CRC32 must match a standard ZIP reader');
  assert.equal(bytes.readUInt16LE(6)&0x0800,0x0800);
});

test('Repeated OBJ exports preserve source materials and contain matching real geometry and material references', async () => {
  const object=managedMesh('export'),material=object.material; material.name='Tempered steel';
  const first=Buffer.from(await (await createWeaponObjArchive(THREE,object,OBJExporter,'test weapon')).arrayBuffer());
  assert.equal(material.name,'Tempered steel','export must not mutate the live rendered material');
  const second=Buffer.from(await (await createWeaponObjArchive(THREE,object,OBJExporter,'test weapon')).arrayBuffer());
  assert.deepEqual(second,first,'same source scene must produce repeatable export names and bytes');
  const files=zipEntries(first),obj=files.get('test_weapon.obj').toString(),mtl=files.get('test_weapon.mtl').toString();
  assert.match(obj,/^mtllib test_weapon\.mtl/m); assert.equal([...obj.matchAll(/^f /gm)].length,12);
  const used=[...obj.matchAll(/^usemtl (.+)$/gm)].map(match=>match[1]),defined=[...mtl.matchAll(/^newmtl (.+)$/gm)].map(match=>match[1]);
  assert.ok(used.length>0&&used.every(name=>defined.includes(name))); assert.match(mtl,/^Pr /m); assert.match(mtl,/^Pm /m);
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
  assert.equal(stage._objBtn.textContent, 'تنزيل OBJ مع الخامات (ZIP)');
  assert.equal(stage._glbBtn.textContent, 'تنزيل GLB');
  assert.equal(stage.shadowRoot.querySelector('.note').textContent, 'اسحب للتدوير. مرر للتقريب. اسحب بالزر الأيمن للتحريك.');
  assert.equal(ctx.document.documentElement.dir, 'rtl');
  stage.setLanguage('en');
  assert.equal(stage._objBtn.textContent, 'Download OBJ + textures (ZIP)');
  assert.equal(stage._glbBtn.textContent, 'Download GLB');
  assert.match(stage.shadowRoot.querySelector('.note').textContent, /^Drag to orbit/);
  assert.equal(ctx.document.documentElement.dir, 'ltr');
  ctx.location.search = '?lang=en';
  assert.equal(new ctx.Stage()._objBtn.textContent, 'Download OBJ + textures (ZIP)');
});

test('Compact character selector reflects equipped bat and knife in both languages', () => {
  const select = () => ({ options: [], value: '', set innerHTML(value) { if (value === '') this.options = []; }, appendChild(option) { this.options.push(option); } });
  const weaponSelect = select(), animationSelect = select();
  const ctx = context(character.template, ['weaponSelectable', 'proceduralWeaponLabel', 'buildCompact', 'paintCompact'], {
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
  ctx.state.ownedWeapons = ['fists', 'bat', 'alias']; ctx.state.weapon = 'alias'; ctx.buildCompact();
  assert.deepEqual(weaponSelect.options.map(option => option.value), ['fists', 'bat', 'alias']);
  assert.equal(weaponSelect.value, 'alias', 'an owned model alias remains selectable by its exact ID');
});

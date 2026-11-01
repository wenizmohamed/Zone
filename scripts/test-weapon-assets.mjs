import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { createWeaponAssetLoader, normalizeWeaponAsset, resolveWeaponAsset, upgradedWeaponKeys, isUpgradedWeaponKey, WEAPON_ASSETS } from '../dist/weapon-assets.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';
import { computeWeaponFrame, acceptedWeaponStudioIds, isAcceptedWeaponStudioId } from '../dist/weapon-presentation.js';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/visual-asset-manifest.json');

function localPath(ref, base = root) {
  assert.equal(typeof ref, 'string');
  assert.ok(!/^(?:https?:|data:|blob:)/i.test(ref), `runtime asset must be locally retained: ${ref}`);
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\/+/, '');
  const path = resolve(base, clean);
  assert.ok(!isAbsolute(relative(root, path)) && !relative(root, path).startsWith('..'), `asset escaped project: ${ref}`);
  assert.ok(existsSync(path), `missing runtime resource: ${ref}`);
  return path;
}

function imageSize(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 8 < bytes.length;) {
      assert.equal(bytes[offset], 255, 'invalid JPEG marker');
      const marker = bytes[offset + 1]; offset += 2;
      if (marker === 217 || marker === 218) break;
      if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) continue;
      const size = bytes.readUInt16BE(offset);
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      assert.ok(size >= 2); offset += size;
    }
  }
  throw new Error('Unsupported or malformed embedded image; add its actual format validator before shipping');
}

export function inspectGlb(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'file is not a GLB');
  assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    assert.equal(length % 4, 0, 'GLB chunks need 4-byte alignment');
    assert.ok(offset + length <= bytes.length, 'truncated GLB chunk');
    chunks.push({ type, data: bytes.subarray(offset, offset + length) }); offset += length;
  }
  assert.equal(chunks[0].type, 0x4e4f534a);
  const gltf = JSON.parse(chunks[0].data.toString('utf8').trim());
  const buffers = (gltf.buffers || []).map((buffer, index) => {
    const data = buffer.uri ? readFileSync(localPath(buffer.uri, dirname(path))) : chunks.find(chunk => chunk.type === 0x004e4942)?.data;
    assert.ok(data && data.length >= buffer.byteLength && (!buffer.uri ? index === 0 : true), 'missing or short GLB buffer');
    return data;
  });
  const views = (gltf.bufferViews || []).map(view => {
    const buffer = buffers[view.buffer], start = view.byteOffset || 0;
    assert.ok(buffer && start >= 0 && view.byteLength > 0 && start + view.byteLength <= buffer.length, 'invalid bufferView range');
    return buffer.subarray(start, start + view.byteLength);
  });
  const sizes = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 }, components = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT2:4, MAT3:9, MAT4:16 };
  for (const accessor of gltf.accessors || []) {
    assert.ok(Number.isInteger(accessor.count) && accessor.count > 0 && sizes[accessor.componentType] && components[accessor.type], 'invalid accessor type/count');
    if (accessor.bufferView !== undefined) {
      const view = gltf.bufferViews[accessor.bufferView], element = sizes[accessor.componentType] * components[accessor.type];
      assert.ok(views[accessor.bufferView] && (accessor.byteOffset || 0) + (accessor.count - 1) * (view.byteStride || element) + element <= views[accessor.bufferView].length, 'accessor reads outside its bufferView');
    } else assert.ok(accessor.sparse, 'accessor has neither buffer data nor sparse values');
    for (const values of [accessor.min, accessor.max]) if (values) assert.ok(values.every(Number.isFinite), 'nonfinite geometry bounds');
  }
  let triangles = 0, primitives = 0;
  for (const mesh of gltf.meshes || []) for (const primitive of mesh.primitives) {
    const positions = gltf.accessors[primitive.attributes.POSITION]; assert.ok(positions && positions.type === 'VEC3');
    const count = primitive.indices === undefined ? positions.count : gltf.accessors[primitive.indices].count;
    assert.ok(primitive.mode === undefined || primitive.mode === 4, 'selected weapon must use triangles');
    assert.equal(count % 3, 0); triangles += count / 3; primitives++;
    if (primitive.material !== undefined) assert.ok(gltf.materials[primitive.material], 'missing referenced material');
  }
  assert.ok(triangles > 0 && primitives > 0, 'weapon contains no renderable triangles');
  const images = (gltf.images || []).map(image => {
    const data = image.uri ? readFileSync(localPath(image.uri, dirname(path))) : views[image.bufferView];
    assert.ok(data?.length, 'missing image bytes');
    const dimensions = imageSize(data); assert.ok(dimensions.every(value => value > 0 && value <= 8192), 'invalid or unexpectedly huge image');
    return { bytes: data.length, dimensions };
  });
  for (const texture of gltf.textures || []) assert.ok(images[texture.source], 'texture refers to a missing image');
  function checkTextureIndices(value, key = '') {
    if (!value || typeof value !== 'object') return;
    if (/Texture$/.test(key) && value.index !== undefined) assert.ok(gltf.textures[value.index], 'material refers to a missing texture');
    for (const [childKey, child] of Object.entries(value)) checkTextureIndices(child, childKey);
  }
  (gltf.materials || []).forEach(material => checkTextureIndices(material));
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, primitives, materials: gltf.materials?.length || 0, images, gltf };
}

function inspectObj(path) {
  const bytes = readFileSync(path), lines = bytes.toString('utf8').split(/\r?\n/);
  let vertices = 0, triangles = 0; const libraries = [], used = new Set();
  for (const line of lines) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') { assert.ok(fields.slice(1, 4).map(Number).every(Number.isFinite)); vertices++; }
    if (fields[0] === 'mtllib') libraries.push(line.slice(line.indexOf('mtllib') + 7).trim());
    if (fields[0] === 'usemtl') used.add(fields.slice(1).join(' '));
    if (fields[0] === 'f') {
      assert.ok(fields.length >= 4); triangles += fields.length - 3;
      fields.slice(1).forEach(field => { const index = Number(field.split('/')[0]); assert.ok(Number.isInteger(index) && index !== 0 && (index > 0 ? index <= vertices : -index <= vertices), 'OBJ face references a missing vertex'); });
    }
  }
  assert.ok(triangles > 0 && vertices > 0 && libraries.length > 0, 'OBJ needs geometry and material definitions');
  const defined = new Set(), images = [], resources = new Set();
  for (const library of libraries) {
    const materialPath = localPath(library, dirname(path));
    for (const line of readFileSync(materialPath, 'utf8').split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/);
      if (fields[0] === 'newmtl') defined.add(fields.slice(1).join(' '));
      if (/^(?:map_|bump$|norm$)/i.test(fields[0])) {
        const resource = localPath(fields.at(-1), dirname(materialPath));
        if (!resources.has(resource)) { const data = readFileSync(resource); images.push({ bytes:data.length, dimensions:imageSize(data) }); resources.add(resource); }
      }
    }
  }
  used.forEach(material => assert.ok(defined.has(material), `undefined OBJ material ${material}`));
  return { bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex'), triangles, primitives:used.size, materials:defined.size, images };
}

test('Selected premium weapon manifest has local assets, provenance and valid geometry/resources', t => {
  assert.ok(existsSync(manifestPath), 'premium assets need their canonical manifest before release');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const weaponBase = resolve(root, 'assets/weapons');
  const librarySources = JSON.parse(readFileSync(localPath('library/sources.json', weaponBase), 'utf8'));
  const models = Object.values(WEAPON_ASSETS); assert.ok(models.length > 0, 'no selected premium weapon models');
  for (const descriptor of models) {
    const id = descriptor.id, sourceManifest = descriptor.sourceManifest
      ? JSON.parse(readFileSync(localPath(descriptor.sourceManifest, weaponBase), 'utf8')) : null;
    const libraryModel = sourceManifest?.models?.find(model => model.id === id);
    const asset = libraryModel ? { ...libraryModel, path: libraryModel.modelUrl.slice(1), source: libraryModel.sourceUrl,
      triangleBudget: 12000, textureBudgetBytes: 32 * 1024 * 1024 }
      : (sourceManifest || manifest).assets.find(asset => asset.path === `assets/weapons/${descriptor.url}`);
    assert.ok(asset, `${id} is selected at runtime but missing its canonical provenance entry`);
    assert.equal(asset.path, `assets/weapons/${descriptor.url}`, `${id} selected URL differs from retained provenance`);
    assert.match(asset.source, /^https:\/\//); assert.ok(asset.license && asset.author, `${id} needs source license and author`);
    const format = descriptor.format || descriptor.url.split('.').at(-1);
    assert.ok(['glb','obj'].includes(format), `${id} unsupported runtime format`);
    const path = localPath(asset.path), actual = format === 'glb' ? inspectGlb(path) : inspectObj(path);
    assert.equal(actual.sha256, asset.sha256, `${id} model bytes changed without updating provenance`);
    assert.equal(actual.bytes, asset.bytes);
    if (asset.triangles !== undefined) assert.equal(actual.triangles, asset.triangles);
    assert.ok(Array.isArray(descriptor.grip) && descriptor.grip.length === 3 && descriptor.grip.every(Number.isFinite), `${id} missing measured grip metadata`);
    assert.ok(Number.isFinite(descriptor.scale) && descriptor.scale > 0, `${id} invalid scale`);
    assert.equal(descriptor.source, asset.source); assert.equal(descriptor.license, asset.license); assert.equal(descriptor.author, asset.author);
    if (libraryModel) {
      const evidence = librarySources.sources.find(source => source.url === asset.source);
      assert.ok(evidence && evidence.author === asset.author && evidence.license === asset.license, `${id} no matching retained author/license evidence`);
      assert.match(evidence.licenseEvidenceUrl, /^https:\/\//); assert.match(evidence.evidenceSha256, /^[a-f0-9]{64}$/);
      assert.match(libraryModel.provenance.originalSha256, /^[a-f0-9]{64}$/);
      assert.match(libraryModel.provenance.downloadUrl, /^https:\/\//);
      assert.equal(libraryModel.images, actual.images.length);
      assert.ok(actual.gltf.materials.some(material => material.pbrMetallicRoughness?.baseColorTexture && material.normalTexture), `${id} retained detailed model must retain its real color and normal maps`);
    } else {
      const source = asset.path.startsWith('assets/weapons/premium/v99/')
        ? JSON.parse(readFileSync(localPath('SOURCES.json',dirname(path)),'utf8')).sources.find(source=>source.source_page===asset.source)
        : sourceManifest || JSON.parse(readFileSync(localPath('source.json',dirname(path)),'utf8'));
      assert.ok(source, `${id} has no retained primary-source license record`);
      assert.equal(source.source_page, asset.source); assert.equal(source.license, asset.license);
      const licensePath = sourceManifest ? localPath(source.license_file, dirname(localPath(descriptor.sourceManifest, weaponBase))) : localPath('LICENSE.txt', dirname(path));
      assert.ok(readFileSync(licensePath, 'utf8').trim().length > 20, `${id} missing retained license`);
      if (descriptor.aiAssisted) {
        assert.equal(asset.aiAssisted, true); assert.match(source.aiDisclosure, /generated with polyy\.ai/);
        assert.equal(actual.images.length, 2); assert.equal(asset.normalMap, false);
        assert.ok(actual.gltf.materials.every(material => !material.normalTexture), `${id} may not invent a normal map`);
        assert.match(readFileSync(licensePath, 'utf8'), /not a legal condition/);
      }
    }
    if (asset.triangleBudget !== undefined) assert.ok(actual.triangles <= asset.triangleBudget, `${id} exceeds approved triangle budget`);
    if (asset.textureBudgetBytes !== undefined) {
      const textureBytes = actual.images.reduce((sum, image) => sum + image.dimensions[0] * image.dimensions[1] * 4 * 4 / 3, 0);
      assert.ok(textureBytes <= asset.textureBudgetBytes, `${id} exceeds approved decoded texture budget`);
    }
    t.diagnostic(`${id}: ${actual.triangles} triangles, ${actual.primitives} primitives, ${actual.images.length} images, ${actual.bytes} bytes`);
  }
});

function sourceFixture() {
  const texture = new THREE.Texture({ width: 8, height: 8 });
  const material = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: texture });
  const geometry = new THREE.BoxGeometry(.02,.3,.02), scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]));
  return { scene, geometry, material, texture };
}
function resourceDisposals(object) {
  const counts = { geometry: 0, material: 0, texture: 0 }, resources = new Set();
  function watch(resource, kind) {
    if (!resource || resources.has(resource)) return;
    resources.add(resource); resource.addEventListener('dispose', () => counts[kind]++);
  }
  object.traverse(mesh => {
    watch(mesh.geometry, 'geometry');
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue; watch(material, 'material');
      for (const texture of Object.values(material)) if (texture?.isTexture) watch(texture, 'texture');
    }
  });
  return counts;
}

test('Shared weapon cache deduplicates requests while each returned instance owns its GPU resources', async () => {
  const fixture = sourceFixture(), cacheDisposals = resourceDisposals(fixture.scene);
  let settle, requests = 0;
  const loader = createWeaponAssetLoader({ THREE, GLTFLoader: class { loadAsync() { requests++; return new Promise(resolve => { settle = resolve; }); } } });
  const first = loader.load('bat'), second = loader.load('bat');
  assert.equal(requests, 1); settle({ scene: fixture.scene });
  const [a,b] = await Promise.all([first,second]);
  const aMeshes = [], bMeshes = []; a.traverse(mesh => { if (mesh.isMesh) aMeshes.push(mesh); }); b.traverse(mesh => { if (mesh.isMesh) bMeshes.push(mesh); });
  assert.notEqual(a, b); assert.notEqual(aMeshes[0].geometry, fixture.geometry); assert.notEqual(aMeshes[0].geometry, bMeshes[0].geometry);
  assert.equal(aMeshes[0].geometry, aMeshes[1].geometry, 'shared geometry should be cloned once per instance');
  const aMaterial = aMeshes[0].material, bMaterial = bMeshes[0].material;
  assert.notEqual(aMaterial, fixture.material); assert.notEqual(aMaterial, bMaterial);
  assert.equal(aMeshes[1].material[0], aMaterial); assert.equal(aMaterial.map, aMaterial.roughnessMap);
  assert.notEqual(aMaterial.map, fixture.texture); assert.notEqual(aMaterial.map, bMaterial.map);
  assert.equal(aMaterial.map.image, fixture.texture.image, 'immutable decoded pixels may be shared');
  const aDisposals = resourceDisposals(a), bDisposals = resourceDisposals(b);
  loader.release(a); loader.release(a);
  assert.deepEqual(aDisposals, { geometry:1, material:1, texture:1 });
  assert.deepEqual(bDisposals, { geometry:0, material:0, texture:0 });
  assert.deepEqual(cacheDisposals, { geometry:0, material:0, texture:0 });
  const third = await loader.load('bat'); assert.equal(requests, 1); assert.notEqual(third, a);
  loader.release(b); loader.release(third);
  assert.deepEqual(bDisposals, { geometry:1, material:1, texture:1 });
  assert.deepEqual(cacheDisposals, { geometry:0, material:0, texture:0 });
  await loader.dispose(); await loader.dispose();
  assert.deepEqual(cacheDisposals, { geometry:1, material:1, texture:1 }, 'loader teardown must release each cached resource exactly once');
});

test('Failed premium requests are evicted for retry and unknown gameplay keys fetch nothing', async () => {
  let requests = 0;
  const loader = createWeaponAssetLoader({ THREE, GLTFLoader: class { async loadAsync() {
    if (++requests === 1) throw new Error('temporary failure'); return { scene:sourceFixture().scene };
  } } });
  assert.equal(await loader.load('untrusted/unknown'), null); assert.equal(requests, 0);
  await assert.rejects(loader.load('bat'), /Weapon asset failed/);
  const loaded = await loader.load('bat'); assert.ok(loaded.isObject3D); assert.equal(requests, 2);
  loader.release(loaded);
});

test('Disposal waits for pending premium sources, closes shared decoded images once and returns no stale instance', async () => {
  const fixture=sourceFixture(),counts=resourceDisposals(fixture.scene); let finish,closed=0;
  fixture.texture.image.close=()=>closed++;
  const loader=createWeaponAssetLoader({THREE,GLTFLoader:class{loadAsync(){return new Promise(resolve=>finish=resolve);}}});
  const load=loader.load('bat'),disposal=loader.dispose(); finish({scene:fixture.scene});
  assert.equal(await load,null); await disposal; await loader.dispose();
  assert.deepEqual(counts,{geometry:1,material:1,texture:1}); assert.equal(closed,1);
  await assert.rejects(loader.load('bat'),/disposed/);
});

test('Disposal also owns a pending catalog fallback after the premium request fails', async t => {
  t.mock.method(console,'warn',()=>{});
  let finishMaterials,markStarted,geometryDisposals=0,materialDisposals=0;
  const fallbackStarted=new Promise(resolve=>markStarted=resolve);
  const geometry=new THREE.BoxGeometry(.1,.1,.1); geometry.addEventListener('dispose',()=>geometryDisposals++);
  const Engine={...THREE,MeshPhysicalMaterial:class extends THREE.MeshPhysicalMaterial{constructor(options){super(options);this.addEventListener('dispose',()=>materialDisposals++);}}};
  const loader=createWeaponAssetLoader({THREE:Engine,catalog:{revolver:{file:'Revolver_1',scale:.15}},
    GLTFLoader:class{async loadAsync(){throw new Error('injected unavailable premium asset');}},
    MTLLoader:class{loadAsync(){markStarted();return new Promise(resolve=>finishMaterials=resolve);}},
    OBJLoader:class{setMaterials(){return this;}async loadAsync(){return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());}}
  });
  const load=loader.load('revolver'); await fallbackStarted;
  const disposal=loader.dispose(); finishMaterials({preload(){}});
  assert.equal(await load,null,'a fallback must not create a new instance after teardown');
  await disposal; assert.equal(geometryDisposals,1); assert.equal(materialDisposals,1);
  await loader.dispose(); assert.equal(geometryDisposals,1); assert.equal(materialDisposals,1);
});

async function geometryOnlyGlb(path) {
  // Preserve actual geometry, hierarchy and transforms. Strip only PBR texture
  // bindings for this CPU test because Node has no browser image decoder.
  const bytes = readFileSync(path), jsonLength = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  delete data.materials; delete data.textures; delete data.images; delete data.samplers;
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const json = Buffer.from(JSON.stringify(data)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const tail = bytes.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + tail.length);
  result.write('glTF'); result.writeUInt32LE(2,4); result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(padded.length,12); result.writeUInt32LE(0x4e4f534a,16); padded.copy(result,20); tail.copy(result,20+padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('The actual premium bat normalizes its measured grip and fits the verified 11.5mm hand cavity', async t => {
  const descriptor = resolveWeaponAsset('bat');
  const gltf = await geometryOnlyGlb(localPath(descriptor.url, resolve(root,'assets/weapons')));
  const model = gltf.scene, normalized = normalizeWeaponAsset(THREE, model, descriptor);
  const point = model.localToWorld(new THREE.Vector3(...descriptor.grip));
  assert.ok(normalized.worldToLocal(point).length() < 1e-7, 'measured raw grip did not normalize to the attachment origin');
  const points = [];
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let i=0; i<mesh.geometry.attributes.position.count; i++) points.push(normalized.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i))));
  });
  const box = new THREE.Box3().setFromPoints(points), size = box.getSize(new THREE.Vector3());
  assert.ok(size.y >= .6 && size.y <= .85 && size.y > size.x*8, 'bat physical size or shaft axis is incorrect');
  const rings = points.filter(point => point.y >= -.056 && point.y <= .06);
  assert.ok(rings.length >= 8 && Math.min(...rings.map(point => point.y)) <= -.054, 'grip must include the actual lower handle ring');
  const radius = Math.max(...rings.map(point => Math.hypot(point.x,point.z)));
  assert.ok(radius <= .0115 + 1e-7, `premium handle radius ${(radius*1000).toFixed(3)}mm exceeds the verified hand cavity`);
  assert.ok(box.min.y <= -.08 && box.min.y >= -.1, 'knob must sit below the hand rather than inside the lower fingers');
  assert.deepEqual(normalized.userData.zoneWeaponAsset.gripPoint, [0,0,0]);
  assert.equal(normalized.userData.zoneWeaponAsset.axis, 1); assert.equal(normalized.userData.zoneWeaponAsset.forward, false);
  t.diagnostic(`Actual bat: ${(size.y*100).toFixed(1)}cm long; ${(radius*1000).toFixed(3)}mm lower handle radius; knob ${(-box.min.y*1000).toFixed(1)}mm below grip`);
});

for (const [key, minLength, maxLength] of [['ak',.7,1.1],['revolver',.18,.3],['pistol',.15,.25]]) {
  test(`Actual premium ${key} grip is inside both handle surfaces and its muzzle points along canonical +X`, async t => {
    const descriptor = resolveWeaponAsset(key), gltf = await geometryOnlyGlb(localPath(descriptor.url,resolve(root,'assets/weapons')));
    const normalized = normalizeWeaponAsset(THREE,gltf.scene,descriptor);
    const box = new THREE.Box3().setFromObject(normalized), size = box.getSize(new THREE.Vector3());
    assert.ok(size.x >= minLength && size.x <= maxLength && size.x > size.z*4, 'incorrect physical scale or muzzle axis');
    const hits = [];
    for (const side of [-1,1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(0,0,side*.1),new THREE.Vector3(0,0,-side));
      const hit = ray.intersectObject(normalized,true)[0];
      assert.ok(hit, `${key} socket is in empty space rather than its authored handle`);
      assert.ok(hit.point.z*side >= .002 && hit.point.z*side <= .03, `${key} socket is outside the side surfaces: ${hit.point.z}`);
      hits.push(hit.point.z);
    }
    assert.ok(box.max.x > size.x*.65, 'muzzle should extend forward of the measured grip, not point into the forearm');
    assert.ok(box.max.y > .03 && box.min.y < -.02, 'handle must extend above and below its measured center');
    assert.equal(normalized.userData.zoneWeaponAsset.forward,true); assert.equal(normalized.userData.zoneWeaponAsset.axis,-1);
    t.diagnostic(`${key}: ${(size.x*100).toFixed(1)}cm long; grip side surfaces ${hits.map(value=>(value*1000).toFixed(1)).join('/')}mm; muzzle +${(box.max.x*100).toFixed(1)}cm`);
  });
}

test('Actual premium knife centers the handle rather than the guard and preserves the authored blade axis', async t => {
  const descriptor=resolveWeaponAsset('knife'),gltf=await geometryOnlyGlb(localPath(descriptor.url,resolve(root,'assets/weapons')));
  const normalized=normalizeWeaponAsset(THREE,gltf.scene,descriptor),box=new THREE.Box3().setFromObject(normalized),size=box.getSize(new THREE.Vector3());
  assert.ok(size.x>=.24&&size.x<=.35&&size.x>size.y*3,'knife scale or long axis is incorrect');
  const handleHits=[];
  for(const side of [-1,1]) {
    const hit=new THREE.Raycaster(new THREE.Vector3(0,0,side*.1),new THREE.Vector3(0,0,-side)).intersectObject(normalized,true)[0];
    assert.ok(hit&&hit.point.z*side>=.003&&hit.point.z*side<=.02,'knife socket must lie between real handle side surfaces');
    handleHits.push(hit.point.z);
  }
  const meshes=[]; normalized.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const ranges=meshes.map(mesh=>new THREE.Box3().setFromObject(mesh)).sort((a,b)=>a.max.x-b.max.x);
  assert.equal(ranges.length,2,'fixture must retain distinct actual blade and handle primitives');
  assert.ok(ranges[0].min.x<0&&ranges[0].max.x>0,'socket must be in the handle primitive');
  assert.ok(ranges[1].min.x>.04,'blade/guard must be beyond the centered hand');
  assert.equal(descriptor.forward,false); assert.deepEqual(descriptor.axis,[1,0,0]);
  t.diagnostic(`M9: ${(size.x*100).toFixed(1)}cm long; handle side surfaces ${handleHits.map(value=>(value*1000).toFixed(1)).join('/')}mm`);
});

for (const [key, minLength, maxLength] of [
  ['pistol_t', .15, .23], ['shotgun', .9, 1.15], ['smg', .55, .75], ['sniper', .95, 1.2],
  ['assaultrifle_1', .75, .95], ['magnum', .28, .36], ['sawedoff', .60, .68], ['bullpup_1', .6, .8],
  ['luger', .23, .26], ['ak47', .85, .90], ['suomi', .85, .90], ['g3a3', .95, 1.0],
  ['mosin', 1.2, 1.3], ['dragunov', 1.15, 1.25], ['m1911', .20, .23]
]) {
  test(`Actual upgraded ${key} has a solid measured grip, physical scale, unclipped frame and centered character attachment`, async t => {
    const descriptor = resolveWeaponAsset(key), gltf = await geometryOnlyGlb(localPath(descriptor.url, resolve(root, 'assets/weapons')));
    const normalized = normalizeWeaponAsset(THREE, gltf.scene, descriptor), box = new THREE.Box3().setFromObject(normalized);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(size.x >= minLength && size.x <= maxLength && size.x > size.z * 3, `${key} wrong physical size or muzzle axis`);
    const hits = [-1, 1].map(side => {
      const hit = new THREE.Raycaster(new THREE.Vector3(0, 0, side * .15), new THREE.Vector3(0, 0, -side)).intersectObject(normalized, true)[0];
      assert.ok(hit, `${key} grip is in empty space rather than actual source triangles`);
      assert.ok(hit.point.z * side >= .002 && hit.point.z * side <= .04, `${key} grip is not between its handle surfaces`);
      return hit.point.z;
    });
    assert.ok(Math.abs(hits[0] + hits[1]) <= .001, `${key} grip is laterally off-center in the real handle`);
    assert.ok(box.max.x > size.x * .45 && box.max.x > -box.min.x, `${key} muzzle points into the stock/forearm`);
    assert.deepEqual(normalized.userData.zoneWeaponAsset.gripPoint, [0, 0, 0]);
    if (key === 'pistol_t') assert.equal(normalized.getObjectByName('Magazine'), undefined, 'loose source magazine must not float beside the assembled pistol');
    for (const aspect of [1.9, 390 / 330, 320 / 270]) {
      const frame = computeWeaponFrame(THREE, box, aspect), camera = new THREE.PerspectiveCamera(38, aspect, frame.near, frame.far);
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1, `${key} clipped at aspect ${aspect}`);
      }
    }
    for (const wardrobe of ['Suit', 'Casual_Hoodie', 'Swat']) {
      const character = await geometryOnlyGlb(localPath(`assets/character/quaternius/${wardrobe}.glb`));
      const characterRoot = character.scene, rig = prepareCharacterGrip(THREE, characterRoot, Object.fromEntries(character.animations.map(clip => [clip.name, clip])));
      const instance = normalized.clone(true), fit = instance.userData.zoneWeaponAsset;
      const hold = attachHeldWeapon(THREE, rig, instance, fit.gripPoint, fit.axis, fit.forward);
      applyCharacterGrip(rig); characterRoot.updateMatrixWorld(true);
      const origin = rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3()));
      assert.ok(origin.distanceTo(rig.center) < 1e-5, `${key}/${wardrobe} normalized handle floats away from the hand socket`);
      const barrel = rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3(1, 0, 0))).sub(origin).normalize();
      const expected = new THREE.Vector3(0, 1, 0).projectOnPlane(rig.axis).normalize();
      assert.ok(barrel.dot(expected) > .99999 && barrel.y > .8, `${key}/${wardrobe} barrel axis points into the forearm`);
      const down = rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3(0, -1, 0))).sub(origin).normalize();
      assert.ok(down.dot(rig.axis) > .99999, `${key}/${wardrobe} uncontrolled grip roll`);
      hold.removeFromParent();
    }
    // This verifies real handle surfaces and attachment transforms. It is not
    // a claim that the bat-calibrated finger skin clears every larger gun grip.
    t.diagnostic(`${key}: ${(size.x * 100).toFixed(1)}cm; real grip width ${((hits[1] - hits[0]) * 1000).toFixed(2)}mm; all three real rigs centered, canonical barrel axis verified; full finger-skin clearance not asserted`);
  });
}

test('Every gameplay weapon resolves a retained premium or licensed catalog asset path', () => {
  const catalog = vm.createContext({}); vm.runInContext(readFileSync(resolve(root,'assets/weapons/catalog.js'),'utf8'),catalog);
  for (const key of [...Object.keys(catalog.ZONE_WEAPONS), ...Object.keys(WEAPON_ASSETS)]) {
    const descriptor = resolveWeaponAsset(key,catalog.ZONE_WEAPONS);
    assert.ok(descriptor && descriptor.source.startsWith('https://') && descriptor.license && descriptor.author);
    if (descriptor.url) localPath(descriptor.url,resolve(root,'assets/weapons'));
    else for (const extension of ['obj','mtl']) localPath(`${descriptor.file}.${extension}`,resolve(root,'assets/weapons'));
    assert.ok(Number.isFinite(descriptor.scale) && descriptor.scale > 0, `${key} has invalid scale`);
    assert.ok(descriptor.grip.length === 3 && descriptor.grip.every(Number.isFinite));
  }
  assert.equal(acceptedWeaponStudioIds().length, 5);
  assert.equal(isAcceptedWeaponStudioId('akm'), true);
  assert.equal(isAcceptedWeaponStudioId('unknown-weapon'), false);
  assert.equal(upgradedWeaponKeys(116).length, 14);
  assert.equal(isUpgradedWeaponKey('assaultrifle_1', 116), true);
  assert.equal(isUpgradedWeaponKey('assaultrifle_1', 99), false);
});

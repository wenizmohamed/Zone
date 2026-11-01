/* ZONE's character art treatment operates on the licensed wardrobe meshes.
 * It never changes the skeleton, skin weights, animations or weapon socket. */
export const CHARACTER_ART = Object.freeze({
  defaultOutfit: 'suit', headScale: [.90, .82, .90],
  license: 'CC0-1.0', author: 'Quaternius',
  source: 'https://quaternius.com/packs/ultimatemodularcharacters.html',
  quality: 'stylized-rigged', version: 'crime-wardrobe-1'
});

const SURFACES = {
  Suit: { color: 0x242a30, roughness: .88, sheen: .32, sheenRoughness: .82, sheenColor: 0x566373 },
  White: { color: 0xbfbdb1, roughness: .9, sheen: .18, sheenColor: 0xc4bca8 },
  Tie: { color: 0x5c3436, roughness: .56, sheen: .35, sheenColor: 0x947061 },
  Skin: { color: 0xb99175, roughness: .58, metalness: 0, clearcoat: .03, clearcoatRoughness: .7 },
  Hair: { color: 0x32271f, roughness: .9 },
  Eyebrows: { color: 0x2d221c, roughness: .88 },
  Eye: { color: 0x9d9f96, roughness: .25, clearcoat: .2 },
  Black: { color: 0x191c20, roughness: .4, clearcoat: .2, clearcoatRoughness: .46 },
  Swat: { color: 0x303c40, roughness: .93, sheen: .16, sheenColor: 0x69736e },
  Swat_Black: { color: 0x161d23, roughness: .76 },
  Visor: { color: 0x4d626b, roughness: .19, metalness: .38, clearcoat: .7 },
  Purple: { color: 0x353d3b, roughness: .91, sheen: .2, sheenColor: 0x68716c },
  LightBlue: { color: 0x242e38, roughness: .94, sheen: .12, sheenColor: 0x6a7883 }
};

export function supportedSurfaceNames() {
  return Object.keys(SURFACES);
}

export function isSupportedSurfaceName(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SURFACES, name);
}

export function requiredWardrobeBones() {
  return ['head', 'chest', 'upperarmr', 'lowerarmr', 'wristr', 'upperarml', 'lowerarml', 'wristl'];
}

export function isRequiredWardrobeBone(name) {
  return typeof name === 'string' && requiredWardrobeBones().includes(name.toLowerCase().replace(/[._-]/g, ''));
}

export function requiredWardrobeClips() {
  return ['Idle', 'Idle_Sword', 'Walk', 'Gun_Shoot', 'Sword_Slash', 'HitRecieve', 'Death'];
}

export function isRequiredWardrobeClip(name) {
  return typeof name === 'string' && requiredWardrobeClips().includes(name);
}

export function defaultCharacterOutfit() {
  return CHARACTER_ART.defaultOutfit;
}

export function characterHeadScale() {
  return CHARACTER_ART.headScale.slice();
}

export function requiredWardrobeClipCount() {
  return requiredWardrobeClips().length;
}

export function validateCharacterWardrobe(THREE, gltf) {
  const bones = new Set(), clips = new Map((gltf?.animations || []).map(clip => [clip.name, clip]));
  gltf?.scene?.traverse(object => { if (object.isBone) bones.add(object.name.toLowerCase().replace(/[._-]/g, '')); });
  for (const required of requiredWardrobeBones()) {
    if (!bones.has(required)) throw new Error('Character wardrobe is missing ' + required);
  }
  for (const required of requiredWardrobeClips()) {
    if (!clips.has(required)) throw new Error('Character wardrobe is missing clip ' + required);
  }
  const gripBones = new Set();
  for (const track of clips.get('Idle_Sword').tracks) {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    const name = (binding.nodeName || '').toLowerCase().replace(/[._-]/g, '');
    if (binding.propertyName === 'quaternion' && /^(index|middle|ring|pinky|thumb)[1-4]r$/.test(name) && bones.has(name)) gripBones.add(name);
  }
  if (gripBones.size !== 19) throw new Error('Character wardrobe is missing its authored hand pose.');
  return true;
}

export function prepareCharacterArt(THREE, root) {
  if (root.userData.zoneCharacterArt) return root.userData.zoneCharacterArt;
  root.updateMatrixWorld(true);
  let head;
  root.traverse(object => { if (object.isBone && object.name.toLowerCase() === 'head') head = object; });
  if (!head) throw new Error('Character wardrobe has no authored head bone.');
  const headPosition = head.getWorldPosition(new THREE.Vector3());
  const materials = new Map(), oldMaterials = new Set(), changedGeometries = new Map();
  let adjustedVertices = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
    const original = mesh.geometry, positions = original.attributes.position;
    const joints = original.attributes.skinIndex, weights = original.attributes.skinWeight;
    const headIndex = mesh.skeleton?.bones.indexOf(head) ?? -1;
    if (mesh.isSkinnedMesh && headIndex >= 0 && positions && joints && weights) {
      if (!changedGeometries.has(original)) {
        const geometry = original.clone(), position = geometry.attributes.position;
        const pivot = mesh.worldToLocal(headPosition.clone()), point = new THREE.Vector3();
        let changed = 0;
        for (let index = 0; index < position.count; index++) {
          let influence = 0;
          for (let component = 0; component < 4; component++) {
            if (joints.getComponent(index, component) === headIndex) influence += weights.getComponent(index, component);
          }
          if (influence <= 0) continue;
          point.fromBufferAttribute(position, index).sub(pivot);
          point.x *= 1 + (CHARACTER_ART.headScale[0] - 1) * influence;
          point.y *= 1 + (CHARACTER_ART.headScale[1] - 1) * influence;
          point.z *= 1 + (CHARACTER_ART.headScale[2] - 1) * influence;
          point.add(pivot); position.setXYZ(index, point.x, point.y, point.z); changed++;
        }
        if (changed) { geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
        changedGeometries.set(original, changed ? geometry : original);
        if (!changed) geometry.dispose();
        adjustedVertices += changed;
      }
      mesh.geometry = changedGeometries.get(original);
      if (mesh.geometry !== original) { mesh.boundingBox = null; mesh.boundingSphere = null; }
    }
    const surface = source => {
      if (!materials.has(source)) {
        const spec = SURFACES[source.name] || { color: source.color?.getHex() ?? 0x61645e, roughness: .82 };
        const material = new THREE.MeshPhysicalMaterial({ ...spec, metalness: spec.metalness || 0 });
        material.name = source.name;
        // Preserve any source maps if a future wardrobe supplies them.
        for (const key of ['map', 'normalMap', 'aoMap', 'emissiveMap']) if (source[key]) material[key] = source[key];
        materials.set(source, material); oldMaterials.add(source);
      }
      return materials.get(source);
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(surface) : surface(mesh.material);
  });
  // Each source is cached after this idempotent treatment. These replaced
  // resources have no remaining users and must not survive wardrobe warming.
  for (const [original, treated] of changedGeometries) if (treated !== original) original.dispose();
  oldMaterials.forEach(material => material.dispose());
  root.updateMatrixWorld(true);
  const art = { ...CHARACTER_ART, adjustedVertices, materialCount: materials.size };
  root.userData.zoneCharacterArt = art;
  return art;
}

export function computeCharacterFrame(THREE, box, aspect = 1) {
  if (!box || box.isEmpty()) throw new Error('Character wardrobe has no visible geometry.');
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(center.x, box.min.y + size.y * .53, center.z);
  const direction = new THREE.Vector3(-.38, .035, 1).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tan = Math.tan(THREE.MathUtils.degToRad(30) / 2);
  let distance = size.y;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target), depth = point.dot(direction);
    distance = Math.max(distance, Math.abs(point.dot(right)) / (tan * Math.max(.25, aspect) * .79) + depth,
      Math.abs(point.dot(up)) / (tan * .84) + depth);
  }
  return { target, position: target.clone().addScaledVector(direction, distance), height: size.y, distance };
}

export function installCharacterStage(THREE, { scene, renderer, key, rim, ground, ring }) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  scene.environmentIntensity = .42;
  key.color.set(0xffddba); key.intensity = 3.3; key.position.set(-2.5, 3.8, 3);
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .012; key.shadow.bias = -.0002;
  rim.color.set(0x819aac); rim.intensity = 2.5; rim.position.set(2.3, 2.7, -2);
  const fill = new THREE.DirectionalLight(0xb5bdc4, .75); fill.position.set(1.8, 1.5, 3); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x575b5d, roughness: .94, metalness: .02 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = -.012; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8),
    new THREE.MeshStandardMaterial({ color: 0x63615d, roughness: .96, metalness: 0 }));
  wall.position.set(0, 3.5, -2.5); wall.receiveShadow = true; scene.add(wall);
  const stageObjects = [wall];
  const steel = new THREE.MeshStandardMaterial({ color: 0x303538, roughness: .58, metalness: .65 });
  for (const x of [-2.1, 2.1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.12, 4.4, .16), steel);
    beam.position.set(x, 2.15, -2.36); scene.add(beam); stageObjects.push(beam);
  }
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.4, .09, .16), steel);
  fixture.position.set(-.6, 2.9, -2.25); scene.add(fixture); stageObjects.push(fixture);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.24, .035),
    new THREE.MeshStandardMaterial({ color: 0xe0c79e, emissive: 0xe0c79e, emissiveIntensity: 1.15, roughness: .45 }));
  lamp.position.set(-.6, 2.865, -2.155); scene.add(lamp); stageObjects.push(lamp);
  // Original staging geometry uses photographed CC0 Poly Haven materials.
  // These replace the featureless circular platform without touching the rig.
  const textures = new Set(); let disposed = false;
  const loader = new THREE.TextureLoader();
  const surface = async (mesh, asset, repeat) => {
    const channels = [['map', 'Diffuse'], ['normalMap', 'nor_gl'], ['roughnessMap', 'Rough']];
    await Promise.all(channels.map(async ([slot, channel]) => {
      const url = new URL(`../assets/character/stage/${asset}_${channel}_1k.jpg`, import.meta.url).href;
      const texture = await loader.loadAsync(url);
      if (disposed) { texture.dispose(); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(...repeat); texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture); mesh.material[slot] = texture; mesh.material.needsUpdate = true;
    }));
    mesh.material.normalScale.set(.35, .35);
  };
  const ready = Promise.all([surface(floor, 'concrete_floor_02', [5, 5]), surface(wall, 'brick_wall_04', [10, 2.66])]);
  if (typeof document !== 'undefined') {
    document.body.dataset.zoneCharacterStage = 'loading';
    ready.then(() => { if (!disposed) document.body.dataset.zoneCharacterStage = 'ready'; })
      .catch(error => { if (!disposed) document.body.dataset.zoneCharacterStage = 'material-load-error'; console.error('Character stage material load failed', error); });
  }
  ground.material.opacity = .32; ground.position.y = .002; ring.visible = false;
  return { ready, isDisposed() { return disposed; }, setFloor(y) { floor.position.y = y - .012; ground.position.y = y + .002; }, dispose() {
    if (disposed) return; disposed = true;
    scene.remove(fill, floor); fill.dispose(); floor.geometry.dispose(); floor.material.dispose();
    for (const object of stageObjects) { scene.remove(object); object.geometry.dispose(); if (object.material !== steel) object.material.dispose(); }
    steel.dispose(); textures.forEach(texture => texture.dispose()); textures.clear();
  } };
}

export function disposeCharacterResources(roots) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set(), images = new Set();
  for (const root of roots) root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue; materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) { textures.add(value); if (value.image?.close) images.add(value.image); }
    }
  });
  skeletons.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  materials.forEach(value => value.dispose()); geometries.forEach(value => value.dispose()); images.forEach(value => value.close());
}

export function inspectCharacterWardrobe(THREE, root) {
  let boneCount = 0, meshCount = 0, vertexCount = 0, triangleCount = 0;
  root?.traverse(object => {
    if (object.isBone) boneCount++;
    if (object.isMesh && object.geometry) {
      meshCount++;
      const pos = object.geometry.attributes.position;
      if (pos) vertexCount += pos.count;
      triangleCount += Math.round((object.geometry.index?.count || pos?.count || 0) / 3);
    }
  });
  root?.updateMatrixWorld(true);
  const size = root ? new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(4)) : [0, 0, 0];
  return { boneCount, meshCount, vertexCount, triangleCount, boundsSizeM: size };
}

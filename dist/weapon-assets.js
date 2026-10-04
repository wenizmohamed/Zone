// Licensed hero assets and the existing gameplay catalogue share one presentation loader.
// Geometry is normalized around its measured handle point, in meters, before attachment.
// descriptor.grip is measured AFTER descriptor.rotation, including authored glTF node transforms.
export const WEAPON_ASSETS = {
  bat: { id: 'old-wooden-bat', url: 'premium/wooden-bat/baseball_bat.glb', scale: .8395,
    grip: [0, -.03178096, 0], rotation: [0, 0, 0], axis: 1, forward: false,
    license: 'CC0-1.0', author: 'LonesomeDucky', source: 'https://opengameart.org/content/old-wooden-baseball-bat' },
  revolver: { id: 'detective-special', url: 'premium/detective-special/detective-special.glb', scale: 1.15,
    grip: [-.069, -.028, 0], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: 'LonesomeDucky', source: 'https://opengameart.org/content/detective-special-revolver' },
  ak: { id: 'akm', url: 'premium/akm/akm.glb', scale: .90,
    grip: [-.192, -.100, 0], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: 'LonesomeDucky', source: 'https://opengameart.org/content/weathered-akm-rifle' },
  pistol: { id: 'derringer', url: 'premium/derringer/derringer.glb', scale: 1.6,
    grip: [-.047, -.035, 0], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: 'LonesomeDucky', source: 'https://opengameart.org/content/derringer-pistol' },
  knife: { id: 'm9-knife', url: 'premium/m9-knife/m9-knife.glb', scale: .0215,
    grip: [-3.4, .28, 0], rotation: [0, 0, 0], axis: [1, 0, 0], forward: false,
    license: 'CC0-1.0', author: 'khairul169', source: 'https://opengameart.org/content/m9-knife-pbr' }
};

export function resolveWeaponAsset(key, catalog = {}) {
  if (WEAPON_ASSETS[key]) return WEAPON_ASSETS[key];
  const entry = catalog[key];
  if (!entry) return null;
  if (entry.fam === 'Revolver') return WEAPON_ASSETS.revolver;
  if (entry.fam === 'AssaultRifle2') return WEAPON_ASSETS.ak;
  if (entry.file === 'Pistol_1') return WEAPON_ASSETS.pistol;
  return { id: entry.file, format: 'obj', file: entry.file, scale: entry.scale,
    grip: [0, 0, 0], rotation: [0, 0, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: 'Quaternius', source: 'https://quaternius.com/packs/ultimategun.html' };
}

export function normalizeWeaponAsset(THREE, scene, descriptor) {
  const oriented = new THREE.Group();
  oriented.rotation.set(...(descriptor.rotation || [0, 0, 0]));
  oriented.add(scene);
  const shifted = new THREE.Group();
  shifted.add(oriented);
  shifted.position.fromArray(descriptor.grip || [0, 0, 0]).negate();
  shifted.scale.setScalar(descriptor.scale || 1);
  shifted.position.multiplyScalar(descriptor.scale || 1);
  const root = new THREE.Group();
  root.add(shifted);
  root.userData.zoneWeaponAsset = { ...descriptor, gripPoint: [0, 0, 0] };
  root.name = 'ZONE weapon: ' + descriptor.id;
  root.updateMatrixWorld(true);
  return root;
}

export function createWeaponAssetLoader({ THREE, GLTFLoader, OBJLoader, MTLLoader,
  catalog = {}, materials = {}, pack = {}, baseURL }) {
  const cache = new Map(), released = new WeakSet();
  let disposed = false;
  const base = String(baseURL || new URL('../assets/weapons/', import.meta.url));
  const descriptor = key => resolveWeaponAsset(key, catalog);
  let grain;
  function surfaceGrain() {
    if (grain || typeof document === 'undefined') return grain;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(128, 128);
    let seed = 73491;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 190 + (seed % 66);
      pixels.data.set([v, v, v, 255], i);
    }
    context.putImageData(pixels, 0, 0);
    grain = new THREE.CanvasTexture(canvas);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(12, 12);
    return grain;
  }
  async function loadCatalogue(key, d) {
    const mtlText = pack[d.file + '.mtl'];
    const mtl = new MTLLoader();
    const mats = mtlText ? mtl.parse(mtlText, base) : await mtl.loadAsync(new URL(d.file + '.mtl', base).href);
    mats.preload();
    const objLoader = new OBJLoader().setMaterials(mats);
    const objText = pack[d.file + '.obj'];
    const object = objText ? objLoader.parse(objText) : await objLoader.loadAsync(new URL(d.file + '.obj', base).href);
    const converted = new Map();
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const mapMaterial = old => {
        if (converted.has(old.name)) return converted.get(old.name);
        const spec = materials[old.name] || materials._default || { color: 0x41464c };
        const wood = /wood/i.test(old.name), metal = !wood && !/grip|rubber|plastic/i.test(old.name);
        const material = new THREE.MeshPhysicalMaterial({ ...spec,
          roughness: wood ? .52 : metal ? .32 : .77,
          metalness: metal ? Math.max(spec.metalness || 0, .72) : 0,
          clearcoat: wood ? .22 : .08, clearcoatRoughness: .35,
          roughnessMap: surfaceGrain(), bumpMap: surfaceGrain(), bumpScale: wood ? .0005 : .00013 });
        material.name = old.name; converted.set(old.name, material); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(mapMaterial) : mapMaterial(mesh.material);
    });
    return normalizeWeaponAsset(THREE, object, d);
  }
  async function source(key, d) {
    if (d.format === 'obj') return loadCatalogue(key, d);
    try {
      const gltf = await new GLTFLoader().loadAsync(new URL(d.url, base).href);
      return normalizeWeaponAsset(THREE, gltf.scene, d);
    } catch (error) {
      // A rejected request is evicted below, so the next selection can retry.
      throw new Error('Weapon asset failed: ' + d.id, { cause: error });
    }
  }
  function instance(sourceObject) {
    const copy = sourceObject.clone(true), geometries = new Map(), mats = new Map(), textures = new Map();
    const material = original => {
      if (!mats.has(original)) {
        const value = original.clone();
        for (const key of Object.keys(value)) {
          const texture = value[key];
          if (!texture?.isTexture) continue;
          if (!textures.has(texture)) { const cloned = texture.clone(); cloned.needsUpdate = true; textures.set(texture, cloned); }
          value[key] = textures.get(texture);
        }
        mats.set(original, value);
      }
      return mats.get(original);
    };
    copy.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (!geometries.has(mesh.geometry)) geometries.set(mesh.geometry, mesh.geometry.clone());
      mesh.geometry = geometries.get(mesh.geometry);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material) : material(mesh.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
    });
    copy.userData.zoneOwnedGeometry = true;
    copy.userData.zoneOwnedMaterials = true;
    return copy;
  }
  async function load(key) {
    if (disposed) throw new Error('Weapon loader is disposed');
    const d = descriptor(key); if (!d) return null;
    if (!cache.has(d.id)) {
      const pending = source(key, d); cache.set(d.id, pending);
      pending.catch(() => cache.delete(d.id));
    }
    try { const model = await cache.get(d.id); if (disposed) return null; return instance(model); }
    catch (error) {
      if (disposed) return null;
      if (!catalog[key] || d.format === 'obj') throw error;
      console.warn(error.message + '; using the packaged catalogue model.');
      const entry = catalog[key];
      const fallbackId = 'fallback:' + entry.file;
      if (!cache.has(fallbackId)) {
        const fallback = loadCatalogue(key, { id: entry.file, format: 'obj', file: entry.file,
          scale: entry.scale, grip: [0, 0, 0], rotation: [0, 0, 0], axis: -1, forward: true,
          license: 'CC0-1.0', author: 'Quaternius' });
        cache.set(fallbackId, fallback); fallback.catch(() => cache.delete(fallbackId));
      }
      const fallbackModel = await cache.get(fallbackId);
      return disposed ? null : instance(fallbackModel);
    }
  }
  function release(root) {
    if (!root || released.has(root)) return;
    released.add(root);
    const geometries = new Set(), mats = new Set(), textures = new Set();
    root.traverse(mesh => {
      if (mesh.geometry) geometries.add(mesh.geometry);
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        if (!mat) continue;
        mats.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
      }
    });
    textures.forEach(value => value.dispose()); mats.forEach(value => value.dispose()); geometries.forEach(value => value.dispose());
  }
  async function dispose() {
    if (disposed) return;
    disposed = true;
    const pending = [...cache.values()]; cache.clear();
    const root = new THREE.Group(), images = new Set();
    for (const result of await Promise.allSettled(pending)) if (result.status === 'fulfilled') root.add(result.value);
    root.traverse(mesh => {
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        if (!mat) continue;
        for (const value of Object.values(mat)) if (value?.isTexture && value.image?.close) images.add(value.image);
      }
    });
    release(root); images.forEach(value => value.close());
    grain = null;
  }
  return { load, release, descriptor, dispose };
}


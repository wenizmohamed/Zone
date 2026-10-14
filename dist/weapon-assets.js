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
    license: 'CC0-1.0', author: 'khairul169', source: 'https://opengameart.org/content/m9-knife-pbr' },
  pistol_t: { id: 'cc0-guns-explosives-pack-glb--makarov', url: 'library/models/cc0-guns-explosives-pack-glb--makarov.glb', scale: 1,
    grip: [-.012, -.042, .0045], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true, excludeNodes: ['Magazine'],
    license: 'CC0-1.0', author: '3DModelsCC0', source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json' },
  shotgun: { id: 'cc0-guns-explosives-pack-glb--shotgun', url: 'library/models/cc0-guns-explosives-pack-glb--shotgun.glb', scale: .87,
    grip: [-.465, -.030, -.001095], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: '3DModelsCC0', source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json' },
  smg: { id: 'cc0-guns-explosives-pack-glb--grease-gun', url: 'library/models/cc0-guns-explosives-pack-glb--grease-gun.glb', scale: 1,
    grip: [-.173, -.071, 0], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: '3DModelsCC0', source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json' },
  sniper: { id: 'cc0-guns-explosives-pack-glb--sniper', url: 'library/models/cc0-guns-explosives-pack-glb--sniper.glb', scale: .95,
    grip: [-.286, -.078, -.004], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: '3DModelsCC0', source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json' },
  assaultrifle_1: { id: 'cc0-guns-explosives-pack-glb--m4a1', url: 'library/models/cc0-guns-explosives-pack-glb--m4a1.glb', scale: 1,
    grip: [-.071, -.072, -.000765], rotation: [0, -Math.PI / 2, 0], axis: -1, forward: true,
    license: 'CC0-1.0', author: '3DModelsCC0', source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json' },
  magnum: { id: 'loafbrr-revolver', url: 'premium/v99/loafbrr-revolver.glb', scale: 1,
    grip: [.02,.07,0], rotation: [0,0,0], axis: -1, forward: true,
    identityNote: 'Fictional magnum represented by the author\'s six-shot revolver; no real-world caliber is asserted.',
    license: 'CC0-1.0', author: 'loafbrr_1', source: 'https://opengameart.org/content/revolver-game-asset' },
  sawedoff: { id: 'jean-doublebarrel-safe', url: 'premium/v99/jean-doublebarrel-safe.glb', scale: .14,
    grip: [-1.5,-.25,-.10564910656], rotation: [0,0,0], axis: -1, forward: true,
    quality: 'adapted-textured', surfaceMaps: ['baseColor','normal'],
    materialLineage: 'JeanPFP geometry. CC0 LonesomeDucky bat wood maps with projected UVs and physical steel; original photographic atlas excluded.',
    identityNote: 'Compact fictional double-barrel representation; not an exact real-world sawed-off replica.',
    license: 'CC0-1.0', author: 'JeanPFP / LonesomeDucky', source: 'https://opengameart.org/content/double-barrel-shotgun' },
  bullpup_1: { id: 'tabasco-l85', url: 'premium/v99/tabasco-l85.glb', scale: .081,
    grip: [-.5,-.8,-3.8161939442], rotation: [0,-Math.PI/2,0], axis: -1, forward: true,
    quality: 'adapted-materials', surfaceMaps: [],
    materialLineage: 'Tabasco author geometry. ZONE dark blued-metal and matte-polymer material adaptation; no original textured-PBR claim.',
    license: 'CC0-1.0', author: 'Tabasco', source: 'https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol' }
};

// Actual source identities are separate from gameplay identities. Reuse is
// explicit, not a claim of 51 newly authored meshes. Engine stats are untouched.
const librarySource = (slug, scale, grip, rotation = [0,-Math.PI/2,0], excludeNodes = []) => ({
  id: 'cc0-guns-explosives-pack-glb--' + slug, url: 'library/models/cc0-guns-explosives-pack-glb--' + slug + '.glb',
  scale, grip, rotation, excludeNodes, axis: -1, forward: true, license: 'CC0-1.0', author: '3DModelsCC0',
  source: 'https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack', sourceManifest: 'library/manifest.json'
});
const authoredSource = (slug, scale, grip, rotation = [0,-Math.PI/2,0]) => ({
  id: 'tabasco-' + slug, url: 'premium/v99/tabasco-' + slug + '.glb', scale, grip, rotation, axis: -1, forward: true,
  quality: slug === 'g3a3' ? 'adapted-materials' : 'adapted-textured', surfaceMaps: slug === 'g3a3' ? [] : ['baseColor','normal'], license: 'CC0-1.0', author: 'Tabasco',
  materialLineage: 'Tabasco author geometry. ZONE blued metal and matte polymer; wood uses retained CC0 LonesomeDucky bat color/normal maps with projected UVs and walnut stain. Not original author colors or PBR.',
  source: 'https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol'
});
export const WEAPON_SOURCE_MODELS = {
  ...WEAPON_ASSETS,
  luger: librarySource('luger',1.05,[-.03,-.04,.02842348889],[0,Math.PI/2,0],['Clip']),
  ak47: librarySource('ak47',1,[-.29,-.10,-.00254691774]),
  suomi: librarySource('suomi-kp',1,[-.16,-.06,-.00427620598]),
  g3a3: authoredSource('g3a3',.1,[-2,-.6,0]),
  mosin: authoredSource('mosin9130',.125,[-2.5,0,.00015943159]),
  dragunov: authoredSource('dragunov',.12,[-3,-.55,-4.84499526024]),
  m1911: authoredSource('m1911',.023,[-3,-1.5,.46975868940],[0,Math.PI/2,0])
};
export const WEAPON_GAME_PRESENTATIONS = {
  assaultrifle2_1:'ak47', assaultrifle2_2:'ak', assaultrifle2_3:'ak47', assaultrifle2_4:'ak',
  assaultrifle_1:'assaultrifle_1', assaultrifle_2:'g3a3', assaultrifle_3:'assaultrifle_1', assaultrifle_4:'g3a3', assaultrifle_5:'assaultrifle_1',
  bullpup_1:'bullpup_1', bullpup_2:'bullpup_1', bullpup_3:'bullpup_1',
  pistol_1:'luger', pistol_2:'m1911', pistol_3:'pistol_t', pistol_4:'pistol', pistol_5:'luger', pistol_6:'m1911',
  revolver_1:'revolver', revolver_2:'magnum', revolver_3:'revolver', revolver_4:'magnum', revolver_5:'revolver',
  shotgun_1:'sawedoff', shotgun_2:'shotgun', shotgun_3:'sawedoff', shotgun_4:'shotgun', shotgun_sawedoff:'sawedoff', shotgun_shortstock:'sawedoff',
  sniperrifle_1:'sniper', sniperrifle_2:'dragunov', sniperrifle_3:'mosin', sniperrifle_4:'sniper', sniperrifle_5:'dragunov', sniperrifle_6:'mosin',
  submachinegun_1:'smg', submachinegun_2:'suomi', submachinegun_3:'smg', submachinegun_4:'suomi', submachinegun_5:'smg'
};

export function resolveWeaponAsset(key, catalog = {}) {
  const sourceKey = Object.hasOwn(WEAPON_GAME_PRESENTATIONS,key) ? WEAPON_GAME_PRESENTATIONS[key] : key;
  if (Object.hasOwn(WEAPON_SOURCE_MODELS, sourceKey)) return { ...WEAPON_SOURCE_MODELS[sourceKey], quality: WEAPON_SOURCE_MODELS[sourceKey].quality || 'authored-pbr', requestedKey: key, sourceKey, category: weaponCategory(key, catalog), thumbnail: weaponThumbnail(key) };
  const entry = Object.hasOwn(catalog, key) ? catalog[key] : null;
  if (!entry) return null;
  // Numbered catalog variants have distinct authored meshes. A hero substitute
  // must never collapse every member of a family into one repeated silhouette.
  // This variant's OBJ origin is 16.4 cm ahead of its pistol grip after
  // catalogue scaling. Measured handle section: x=-.164m, y=-.010m,
  // bilateral surfaces z=+/- .01058m. Keep grip in authored OBJ units.
  const grip = entry.file === 'SniperRifle_5' ? [-.8312214901, -.0506842372, 0] : [0, 0, 0];
  return { id: entry.file, format: 'obj', file: entry.file, scale: entry.scale,
    grip, rotation: [0, 0, 0], axis: -1, forward: true,
    quality: 'catalog-stylized', category: weaponCategory(key, catalog), thumbnail: weaponThumbnail(key),
    license: 'CC0-1.0', author: 'Quaternius', source: 'https://quaternius.com/packs/ultimategun.html' };
}

export function weaponCategory(key, catalog = {}) {
  if (key === 'bat' || key === 'knife') return 'melee';
  const family = catalog[key]?.fam;
  return ({ Revolver: 'revolver', Pistol: 'pistol', Shotgun: 'shotgun',
    SubmachineGun: 'smg', SniperRifle: 'sniper', Bullpup: 'bullpup',
    AssaultRifle: 'assault-rifle', AssaultRifle2: 'ak-rifle' })[family]
    || ({ revolver: 'revolver', pistol: 'pistol', ak: 'ak-rifle' })[key] || 'weapon';
}

export function weaponThumbnail(key) {
  return /^[a-z][a-z0-9_-]{1,79}$/.test(String(key)) ? '/assets/weapons/thumbnails/' + key + '.png' : null;
}

// Runtime presentation preserves the authored material separation. Black or
// polymer parts must not become shiny metal merely because their name is black.
export function catalogMaterialProfile(name, materials = {}) {
  const source = materials[name] || materials._default || { color: 0x68717b, roughness: .58, metalness: .15 };
  const wood = /wood/i.test(name), polymer = /plastic|rubber|grip|black/i.test(name), glass = /glass/i.test(name);
  return { ...source, roughness: source.roughness ?? (wood ? .65 : polymer ? .76 : .38),
    metalness: source.metalness ?? (wood || polymer || glass ? .03 : .7),
    clearcoat: wood ? .14 : polymer || glass ? 0 : .06, clearcoatRoughness: .5 };
}

export function inspectWeaponObject(THREE, root) {
  let meshes = 0, vertices = 0, triangles = 0;
  const materials = new Set(), textures = new Set();
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    meshes += 1; vertices += mesh.geometry?.attributes?.position?.count || 0;
    triangles += (mesh.geometry?.index?.count || mesh.geometry?.attributes?.position?.count || 0) / 3;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue; materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const bounds = new THREE.Box3().setFromObject(root);
  return { meshes, vertices, triangles, bounds: bounds.getSize(new THREE.Vector3()).toArray(),
    materials: [...materials].map(material => ({ name: material.name || 'unnamed',
      color: material.color?.getHexString?.(), roughness: material.roughness, metalness: material.metalness,
      maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'].filter(key => material[key]?.isTexture) })),
    textureCount: textures.size };
}

// A successful fallback must describe the asset actually shown, rather than
// inherit the requested hero's quality or credit. The inspector uses the live
// normalized object so it cannot call a generated approximation an authored PBR.
export function weaponPresentationLabel(descriptor, language = 'en') {
  const arabic = language === 'ar';
  if (descriptor?.quality === 'ai-assisted-textured') return arabic ? 'نموذج بخامات - CC0 - بمساعدة الذكاء الاصطناعي' : 'TEXTURED MODEL / CC0 / AI-ASSISTED';
  if (descriptor?.quality === 'authored-pbr') return arabic ? 'نموذج مفصل - CC0' : 'DETAILED MODEL / CC0';
  if (descriptor?.quality === 'authored-materials') return arabic ? 'نموذج مصمم بخامات لونية - CC0' : 'AUTHORED MODEL / COLOR MATERIALS / CC0';
  if (descriptor?.quality === 'adapted-materials') return arabic ? 'نموذج بخامات فيزيائية معدلة - CC0' : 'AUTHORED MODEL / ADAPTED PHYSICAL MATERIALS / CC0';
  if (descriptor?.quality === 'adapted-textured') return arabic ? 'نموذج بخامات CC0 معدلة' : 'AUTHORED MODEL / ADAPTED CC0 SURFACES';
  if (descriptor?.quality === 'catalog-stylized') return arabic ? 'نموذج بأسلوب فني مبسط - CC0' : 'STYLIZED MODEL / CC0';
  return arabic ? 'معاينة مبسطة' : 'SIMPLIFIED PREVIEW';
}

export function normalizeWeaponAsset(THREE, scene, descriptor) {
  for (const name of descriptor.excludeNodes || []) scene.getObjectByName(name)?.removeFromParent();
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

export const WEAPON_LOAD_TIMEOUT_MS = 15000;

export function createWeaponAssetLoader({ THREE, GLTFLoader, OBJLoader, MTLLoader,
  catalog = {}, materials = {}, pack = {}, baseURL, loadTimeoutMs = WEAPON_LOAD_TIMEOUT_MS }) {
  const cache = new Map(), released = new WeakSet();
  let disposed = false;
  const timeoutMs = Number.isFinite(loadTimeoutMs) && loadTimeoutMs > 0 ? loadTimeoutMs : WEAPON_LOAD_TIMEOUT_MS;
  const base = String(baseURL || new URL('../assets/weapons/', import.meta.url));
  const descriptor = key => resolveWeaponAsset(key, catalog);
  function disposeSource(root) {
    const images = new Set();
    root.traverse(mesh => {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value?.isTexture && value.image?.close) images.add(value.image);
      }
    });
    release(root); images.forEach(image => image.close());
  }
  // GLTFLoader cannot abort its image decode. A deadline rejects the selection
  // promptly, and a late result is released rather than entering the retry cache.
  function bounded(request, id) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        const error = new Error('Weapon asset timed out: ' + id);
        error.code = 'asset-timeout'; error.timeoutMs = timeoutMs;
        reject(error);
      }, timeoutMs);
      Promise.resolve(request).then(root => {
        if (settled) { disposeSource(root); return; }
        settled = true; clearTimeout(timer); resolve(root);
      }, error => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(error);
      });
    });
  }
  let grain;
  function surfaceGrain() {
    if (grain || typeof document === 'undefined') return grain;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
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
        const spec = catalogMaterialProfile(old.name, materials);
        const wood = /wood/i.test(old.name);
        const surface = wood ? surfaceGrain() : null;
        const material = new THREE.MeshPhysicalMaterial({ ...spec,
          ...(surface ? { roughnessMap: surface, bumpMap: surface, bumpScale: .00018 } : {}) });
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
      const pending = bounded(source(key, d), d.id); cache.set(d.id, pending);
      pending.catch(() => { if (cache.get(d.id) === pending) cache.delete(d.id); });
    }
    try {
      const model = await cache.get(d.id); if (disposed) return null;
      const copy = instance(model);
      copy.userData.zoneWeaponAsset = { ...d, gripPoint: [0,0,0] };
      return copy;
    }
    catch (error) {
      if (disposed) return null;
      if (error.code === 'asset-timeout' || !catalog[key] || d.format === 'obj') throw error;
      console.warn(error.message + '; using the packaged catalogue model.');
      const entry = catalog[key];
      const fallbackId = 'fallback:' + entry.file;
      if (!cache.has(fallbackId)) {
        const fallback = bounded(loadCatalogue(key, { id: entry.file, format: 'obj', file: entry.file,
          scale: entry.scale, grip: [0, 0, 0], rotation: [0, 0, 0], axis: -1, forward: true,
          quality: 'catalog-stylized', fallbackFor: d.id,
          // The new PNG for this gameplay key depicts the detailed source,
          // not this emergency OBJ. Do not misrepresent it as fallback imagery.
          category: weaponCategory(key, catalog), thumbnail: null,
          license: 'CC0-1.0', author: 'Quaternius', source: 'https://quaternius.com/packs/ultimategun.html' }), fallbackId);
        cache.set(fallbackId, fallback); fallback.catch(() => { if (cache.get(fallbackId) === fallback) cache.delete(fallbackId); });
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
    const root = new THREE.Group();
    for (const result of await Promise.allSettled(pending)) if (result.status === 'fulfilled') root.add(result.value);
    disposeSource(root);
    grain = null;
  }
  return { load, release, descriptor, dispose };
}


/* Inventory studio. Asset geometry and its authored PBR materials remain owned
 * by the shared weapon loader, independently of this disposable lighting rig. */
export function computeWeaponFrame(THREE, box, aspect = 1, fov = 38) {
  const safeBox = box?.isBox3 && !box.isEmpty() ? box.clone() : new THREE.Box3(new THREE.Vector3(-.1, 0, -.1), new THREE.Vector3(.1, .2, .1));
  const center = safeBox.getCenter(new THREE.Vector3());
  const size = safeBox.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, .01);
  const direction = new THREE.Vector3(.65, .32, 2.4).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const target = center.clone().addScaledVector(up, -span * .045);
  const tan = Math.tan(THREE.MathUtils.degToRad(Math.min(80, Math.max(20, Number(fov) || 38))) / 2);
  const tanV = tan * .73, tanH = tan * Math.max(.1, Number(aspect) || 1) * .84;
  let distance = span * .5;
  for (const x of [safeBox.min.x, safeBox.max.x]) for (const y of [safeBox.min.y, safeBox.max.y]) for (const z of [safeBox.min.z, safeBox.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target), depth = point.dot(direction);
    distance = Math.max(distance, Math.abs(point.dot(right)) / tanH + depth, Math.abs(point.dot(up)) / tanV + depth);
  }
  distance *= 1.04;
  return { target, position: target.clone().addScaledVector(direction, distance), distance, near: Math.max(.0001, distance / 200), far: Math.max(10, distance + span * 30), span, center, box: safeBox };
}

const ACCEPTED_WEAPON_IDS = new Set(['old-wooden-bat', 'detective-special', 'akm', 'derringer', 'm9-knife']);
export function weaponStudioProfile(descriptor) {
  // These five preserve the last accepted shader environment, exposure and
  // light ratios exactly. New assets do not raise their diffuse/metal fill.
  return ACCEPTED_WEAPON_IDS.has(descriptor?.id)
    ? { name: 'accepted-reference', background: 0x171b20, exposure: 1.04, environment: .8, key: 2.4, fill: .85, rim: 2.0, hemisphere: 0 }
    : { name: 'realistic-readable', background: 0x353e46, exposure: 1.04, environment: .95, key: 2.4, fill: .95, rim: 2.0, hemisphere: .20 };
}

function studioEnvironment(THREE, renderer, profile) {
  const room = new THREE.Scene(), geometry = new THREE.PlaneGeometry(1, 1), materials = [];
  room.background = new THREE.Color(profile.background);
  const cards = [
    [0xf4eee2, 5.5, [-3, 3, 2], [2.1, 3.6]],
    [0xc3d5e8, 2.7, [3, 1.6, 1], [1.3, 3.5]],
    [0xf3e4c9, 4.8, [.3, 4, -2], [3.4, 1.1]],
    [0xffffff, 2.1, [0, .5, 4], [4.2, .65]],
    [0x657a94, 1.5, [-2, 1, -3], [2.2, 2.8]]
  ];
  for (const [color, intensity, position, size] of cards) {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
    material.color.multiplyScalar(intensity); materials.push(material);
    const card = new THREE.Mesh(geometry, material); card.position.set(...position); card.scale.set(size[0], size[1], 1); card.lookAt(0, .4, 0); room.add(card);
  }
  const previous = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping, auto: renderer.autoClear };
  const pmrem = new THREE.PMREMGenerator(renderer);
  let target;
  try { target = pmrem.fromScene(room, .04, .1, 30); target.texture.name = 'zone-weapon-studio'; }
  finally { pmrem.dispose(); geometry.dispose(); materials.forEach(material => material.dispose()); renderer.setRenderTarget(previous.target); renderer.setClearColor(previous.clear, previous.alpha); renderer.toneMapping = previous.tone; renderer.autoClear = previous.auto; }
  return target;
}

export function installWeaponPresentation(THREE, stage) {
  const scene = stage._scene, renderer = stage._renderer, camera = stage._camera, controls = stage._controls;
  if (!scene || !renderer || !camera || !controls) throw new Error('Weapon stage must be ready before installing its presentation.');
  let disposed = false, currentBox = null;
  const small = matchMedia('(max-width: 600px)').matches;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  const oldEnvironment = scene.environment;
  stage._envPending = false;
  const environments = new Map();
  if (oldEnvironment) oldEnvironment.dispose();
  const key = stage._key;
  key.color.set(0xffedda); key.intensity = 2.4;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  key.shadow.bias = -.00015; key.shadow.normalBias = .001;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xc7d7e9, .85), rim = new THREE.DirectionalLight(0xe9d7b4, 2.0);
  const ambient = new THREE.HemisphereLight(0xd5dfe7, 0x3d3932, 0);
  fill.name = 'studio-fill'; rim.name = 'studio-rim'; ambient.name = 'studio-softbox-fill'; scene.add(fill, rim, ambient);
  function applyProfile(descriptor) {
    const profile = weaponStudioProfile(descriptor);
    if (!environments.has(profile.name)) environments.set(profile.name, studioEnvironment(THREE, renderer, profile));
    scene.environment = environments.get(profile.name).texture;
    scene.environmentIntensity = profile.environment; renderer.toneMappingExposure = profile.exposure;
    key.intensity = profile.key; fill.intensity = profile.fill; rim.intensity = profile.rim; ambient.intensity = profile.hemisphere;
    stage.dataset.zoneLighting = JSON.stringify({ profile: profile.name, exposure: profile.exposure, environment: profile.environment,
      key: profile.key, fill: profile.fill, rim: profile.rim, hemisphere: profile.hemisphere });
  }
  applyProfile({ id: 'derringer' });
  const ground = stage._ground;
  ground.material.dispose();
  ground.material = new THREE.ShadowMaterial({ name: 'studio-contact-shadow', color: 0x000000, opacity: .28, depthWrite: false });
  camera.fov = 38;
  controls.autoRotateSpeed = .55;
  controls.enableDamping = true; controls.dampingFactor = .075;
  const canvas = renderer.domElement; canvas.tabIndex = 0;
  controls.listenToKeyEvents(canvas);
  const status = document.createElement('div');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'position:absolute;inset-inline:12px;top:42px;padding:7px 10px;color:#eee7d8;background:#17191bdb;font:11px/1.5 Rubik,system-ui,sans-serif;pointer-events:none';
  status.hidden = true; stage.shadowRoot.appendChild(status);
  stage.setAssetStatus = state => {
    status.hidden = state !== 'loading';
    status.textContent = state === 'loading' ? (stage.lang === 'ar' ? 'جارٍ تحميل المعاينة ثلاثية الأبعاد...' : 'Loading 3D preview...') : '';
  };
  const originalLanguage = stage.setLanguage.bind(stage);
  stage.setLanguage = language => {
    originalLanguage(language);
    stage.setAssetStatus(stage.dataset.zoneAssetState);
    canvas.setAttribute('aria-label', language === 'ar' ? 'معاينة العنصر ثلاثية الأبعاد. اسحب للتدوير. استخدم الأسهم للتحريك، وزري الجمع والطرح للتقريب، وزر Home لإعادة العرض.' : '3D item preview. Drag to orbit. Arrow keys pan, plus and minus zoom, Home resets the view.');
  };
  stage.setLanguage(stage.lang);
  function fit() {
    if (!currentBox || disposed) return;
    const width = stage.clientWidth || 1, height = stage.clientHeight || 1;
    const frame = computeWeaponFrame(THREE, currentBox, width / height, camera.fov);
    camera.aspect = width / height; camera.position.copy(frame.position); camera.near = frame.near; camera.far = frame.far;
    camera.updateProjectionMatrix(); camera.lookAt(frame.target); controls.target.copy(frame.target); controls.minDistance = frame.span * .45; controls.maxDistance = frame.distance * 3.5; controls.update(); controls.saveState(); camera.updateMatrixWorld(true);
    let extentX = 0, extentY = 0;
    for (const x of [currentBox.min.x, currentBox.max.x]) for (const y of [currentBox.min.y, currentBox.max.y]) for (const z of [currentBox.min.z, currentBox.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera); extentX = Math.max(extentX, Math.abs(point.x)); extentY = Math.max(extentY, Math.abs(point.y));
    }
    stage.dataset.zoneFrame = JSON.stringify({ span: frame.span, distance: frame.distance, aspect: width / height, extentX, extentY, clipped: extentX >= 1 || extentY >= 1 });
  }
  const originalSetObject = stage.setObject.bind(stage);
  stage.setObject = object => {
    applyProfile(object?.userData?.zoneWeaponAsset);
    originalSetObject(object);
    currentBox = new THREE.Box3().setFromObject(object);
    const frame = computeWeaponFrame(THREE, currentBox, (stage.clientWidth || 1) / (stage.clientHeight || 1), camera.fov);
    const floorY = currentBox.min.y - frame.span * .003;
    ground.position.set(frame.center.x, floorY, frame.center.z);
    ground.scale.setScalar(Math.max(1, frame.span));
    key.position.copy(frame.center).add(new THREE.Vector3(-frame.span * 2, frame.span * 3, frame.span * 2.5));
    key.target.position.copy(frame.center); if (!key.target.parent) scene.add(key.target);
    fill.position.copy(frame.center).add(new THREE.Vector3(frame.span * 3, frame.span, frame.span * 1.5)); fill.target.position.copy(frame.center); if (!fill.target.parent) scene.add(fill.target);
    rim.position.copy(frame.center).add(new THREE.Vector3(-frame.span, frame.span * 2, -frame.span * 2)); rim.target.position.copy(frame.center); if (!rim.target.parent) scene.add(rim.target);
    const reach = frame.span * 1.5;
    Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: Math.max(.001, frame.span * .05), far: frame.span * 10 });
    key.shadow.normalBias = frame.span * .001; key.shadow.camera.updateProjectionMatrix(); key.shadow.needsUpdate = true;
    fit();
  };
  const onKey = event => {
    if (event.key === 'Home') { event.preventDefault(); fit(); }
    if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); const direction = camera.position.clone().sub(controls.target), factor = ['+', '='].includes(event.key) ? .88 : 1.12; direction.setLength(THREE.MathUtils.clamp(direction.length() * factor, controls.minDistance, controls.maxDistance)); camera.position.copy(controls.target).add(direction); controls.update(); }
  };
  canvas.addEventListener('keydown', onKey);
  const resize = new ResizeObserver(fit); resize.observe(stage);
  renderer.setSize(stage.clientWidth || 1, stage.clientHeight || 1, false);
  return { fit, dispose() {
    if (disposed) return; disposed = true; resize.disconnect(); canvas.removeEventListener('keydown', onKey); controls.stopListenToKeyEvents();
    status.remove(); delete stage.setAssetStatus;
    scene.remove(fill, rim, ambient, fill.target, rim.target); fill.dispose(); rim.dispose(); ambient.dispose?.();
    if ([...environments.values()].some(environment => scene.environment === environment.texture)) scene.environment = null;
    for (const environment of environments.values()) environment.dispose(); environments.clear();
    stage.setObject = originalSetObject; stage.setLanguage = originalLanguage;
  } };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// ZIP store mode preserves already-compressed PNG bytes and avoids adding a
// compression library or triggering one browser download for every texture.
export async function createStoredZip(files) {
  const encoder = new TextEncoder(), local = [], central = [];
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const bytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
    if (bytes.length > 0xffffffff || offset + bytes.length > 0xffffffff) throw new Error('The export exceeds ZIP size limits.');
    const crc = crc32(bytes), header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(12, 33, true); view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
    local.push(header, bytes);
    const entry = new Uint8Array(46 + name.length), cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, 33, true); cv.setUint32(16, crc, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); entry.set(name, 46);
    central.push(entry); centralSize += entry.length; offset += header.length + bytes.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

export async function texturePng(texture, channel = null) {
  const image = texture?.image;
  const width = image?.naturalWidth || image?.width, height = image?.naturalHeight || image?.height;
  if (!width || !height) throw new Error('Texture pixels are unavailable for export.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: channel !== null });
  if (!context) throw new Error('Texture export canvas is unavailable.');
  if (image.data) {
    if (!(image.data instanceof Uint8Array) || image.data.length !== width * height * 4) throw new Error('This texture format must be exported as GLB.');
    const pixels = context.createImageData(width, height); pixels.data.set(image.data); context.putImageData(pixels, 0, 0);
  } else {
    // OBJ texture readers flip images by convention. glTF textures deliberately
    // disable that flip, so reverse their image rows while preserving mesh UVs.
    if (texture.flipY === false) { context.translate(0, height); context.scale(1, -1); }
    context.drawImage(image, 0, 0, width, height);
  }
  if (channel !== null) {
    const pixels = context.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) { const value = pixels.data[i + channel]; pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255; }
    context.putImageData(pixels, 0, 0);
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Texture PNG encoding failed.')), 'image/png'));
}

export async function createWeaponObjArchive(THREE, object, OBJExporter, basename) {
  const safe = value => String(value).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 96) || 'weapon';
  const base = safe(basename), materials = [], files = [], textures = new Map();
  const exportObject = object.clone(true), copies = new Map();
  exportObject.traverse(mesh => {
    if (!mesh.isMesh) return;
    const copyMaterial = original => {
      if (!copies.has(original)) { const copy = original.clone(); copies.set(original, copy); materials.push(copy); }
      return copies.get(original);
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copyMaterial) : copyMaterial(mesh.material);
  });
  try {
  // Names are deterministic and match the exporter's usemtl references.
  materials.forEach((material, index) => { material.name = safe(material.name || 'material') + '_' + index; });
  exportObject.updateMatrixWorld(true);
  const obj = 'mtllib ' + base + '.mtl\n' + new OBJExporter().parse(exportObject);
  let mtl = '# ZONE OBJ material library. PNG maps are included in this archive.\n';
  for (const material of materials) {
    const color = (material.color || new THREE.Color(.8, .8, .8)).clone().convertLinearToSRGB();
    const emissive = (material.emissive || new THREE.Color(0)).clone().multiplyScalar(material.emissiveIntensity ?? 1).convertLinearToSRGB();
    const roughness = material.roughness ?? .5, metalness = material.metalness ?? 0;
    mtl += `\nnewmtl ${material.name}\nKd ${color.r.toFixed(6)} ${color.g.toFixed(6)} ${color.b.toFixed(6)}\nKe ${emissive.r.toFixed(6)} ${emissive.g.toFixed(6)} ${emissive.b.toFixed(6)}\nKs 0.200000 0.200000 0.200000\nNs ${Math.round((1 - roughness) * 200)}\nPr ${roughness}\nPm ${metalness}\nd ${material.opacity ?? 1}\nillum 2\n`;
    for (const [property, directive, channel] of [['map', 'map_Kd', null], ['normalMap', 'norm', null], ['emissiveMap', 'map_Ke', null], ['roughnessMap', 'map_Pr', 1], ['metalnessMap', 'map_Pm', 2], ['aoMap', 'map_Ka', 0], ['bumpMap', 'bump', 0]]) {
      const texture = material[property]; if (!texture?.isTexture) continue;
      const identity = texture.uuid + ':' + channel;
      let filename = textures.get(identity);
      if (!filename) { filename = base + '_' + textures.size + '_' + property + '.png'; files.push({ name: filename, data: await texturePng(texture, channel) }); textures.set(identity, filename); }
      const offset = texture.offset || { x: 0, y: 0 }, repeat = texture.repeat || { x: 1, y: 1 };
      mtl += `${directive} -o ${offset.x} ${offset.y} 0 -s ${repeat.x} ${repeat.y} 1 ${filename}\n`;
    }
  }
  return await createStoredZip([{ name: base + '.obj', data: obj }, { name: base + '.mtl', data: mtl }, ...files]);
  } finally { materials.forEach(material => material.dispose()); }
}

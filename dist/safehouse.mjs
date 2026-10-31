import * as THREE from '../lib/three184/three.module.js';
import { OrbitControls } from '../lib/three184/OrbitControls.js';
import { createSafehouseCharacter } from './safehouse-character.mjs?v=116';
import { loadAsset, normalizeAssetObject } from './asset-loader.mjs';
import { installViewerRuntime } from './viewer-runtime108.mjs';

const $ = id => document.getElementById(id), canvas = $('room');
let lang = new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en';
let packet = { property: { owned: false }, player: {}, lang, preview: true }, disposed = false, generation = 0, modelGeneration = 0, uploadedHouse = null, lastModel = '', tween = null;
let renderer, scene, camera, controls, runtime, character, observer, key, cool;
let controlsWired = false, parentInitialized = false, renderReady = false, renderFailed = false;
const listeners = new Set();
const owned = new Set(), hotspots = new Map(), objects = [];
const T = {
  en: { eyebrow: 'PRIVATE ADDRESS / ZONE CITY', name: 'Your safehouse', mode: 'Step inside. Leave the street outside.', preview: 'Property preview. Your balance and ownership are unchanged.', equipment: 'PERSONAL EFFECTS', loading: 'Opening the safehouse…',
    armory: 'Armory', vault: 'Vault', lounge: 'Lounge', rooms: 'Safehouse rooms', hint: 'Drag to look around. Choose a room to use its real services.', overview: 'Overview', exit: 'Leave safehouse', retry: 'Retry room', error: 'The room could not load. Your game and property are unchanged.', unarmed: 'Unarmed', noArmor: 'No armor', warning: 'Character unavailable. Room services still work.', assetFallback: 'Property model unavailable. The retained room and services are shown.' },
  ar: { eyebrow: 'عنوان خاص / مدينة زون', name: 'مخبأك', mode: 'ادخل واترك ضجيج الشارع بالخارج.', preview: 'معاينة العقار. لا يتغير رصيدك أو ملكيتك.', equipment: 'معداتك الشخصية', loading: 'جارٍ فتح المخبأ…',
    armory: 'خزانة السلاح', vault: 'الخزنة', lounge: 'الاستراحة', rooms: 'غرف المخبأ', hint: 'اسحب لاستكشاف الغرفة. اختر مكاناً لاستخدام خدماته.', overview: 'الغرفة كاملة', exit: 'مغادرة المخبأ', retry: 'إعادة تحميل الغرفة', error: 'تعذر تحميل الغرفة. لعبتك وعقارك لم يتغيرا.', unarmed: 'بدون سلاح', noArmor: 'بدون درع', warning: 'تعذر عرض الشخصية. خدمات الغرفة لا تزال متاحة.', assetFallback: 'تعذر فتح نموذج العقار. تظهر الغرفة الأساسية وخدماتها.' }
};
const localized = value => typeof value === 'object' ? String(value?.[lang] || value?.en || value?.ar || '') : String(value || '');
function language() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = T[lang], p = packet.property || {};
  $('eyebrow').textContent = t.eyebrow; $('house-name').textContent = localized(p.name) || t.name;
  $('house-mode').textContent = packet.preview === true || p.owned === false ? t.preview : t.mode;
  document.body.classList.toggle('preview', packet.preview === true || p.owned === false);
  $('equipment-label').textContent = t.equipment; $('house-hint').textContent = t.hint;
  $('overview').textContent = t.overview; $('exit').textContent = t.exit; $('error-exit').textContent = t.exit; $('retry').textContent = t.retry;
  $('room-pins').setAttribute('aria-label', t.rooms);
  $('error-message').textContent = t.error; $('loading').querySelector('p').textContent = t.loading;
  for (const button of document.querySelectorAll('[data-action]')) button.querySelector('.pin-label').textContent = t[button.dataset.action];
  const player = packet.player || {};
  $('equipment-line').textContent = [localized(player.weaponLabel) || (player.weapon && player.weapon !== 'fists' ? player.weapon : t.unarmed), localized(player.armorLabel) || t.noArmor].join(' / ');
  canvas.setAttribute('aria-label', lang === 'ar' ? 'مخبأ ثلاثي الأبعاد. اسحب للتدوير أو استخدم أزرار الغرف.' : 'Interactive safehouse. Drag to orbit, or use the room buttons.');
}
function servicesReady() { return controlsWired && parentInitialized && renderReady && !renderFailed && !disposed; }
function syncReadiness() {
  const ready = servicesReady(), canExit = controlsWired && !disposed && parent !== window;
  for (const button of document.querySelectorAll('[data-action]')) button.disabled = !ready;
  $('overview').disabled = !ready; $('exit').disabled = !canExit; $('error-exit').disabled = !canExit; $('retry').disabled = !controlsWired || disposed;
  $('room-pins').setAttribute('aria-busy', String(!ready && !renderFailed && !disposed));
  $('room-pins').setAttribute('aria-disabled', String(!ready)); canvas.setAttribute('aria-disabled', String(!ready)); canvas.tabIndex = ready ? 0 : -1;
  if (controls) controls.enabled = ready;
  document.body.dataset.zoneSafehouseReadiness = JSON.stringify({ status: disposed ? 'disposed' : renderFailed ? 'error' : ready ? 'ready' : parentInitialized ? 'initializing' : 'waiting-parent', parentInitialized, servicesEnabled: ready, exitEnabled: canExit });
}
function listen(target, type, handler) { target.addEventListener(type, handler); listeners.add(() => target.removeEventListener(type, handler)); }
function action(value) {
  if (disposed || !controlsWired || !['armory', 'vault', 'lounge', 'exit'].includes(value)) return;
  if (value === 'exit' ? parent === window : !servicesReady()) return;
  // The room never changes cash, inventory or ownership on its own. Parent
  // navigation reaches the existing authoritative game action and receipts.
  parent.postMessage({ type: 'zone:safehouse-action', action: value, propertyId: packet.property?.id,
    preview: packet.preview === true || packet.property?.owned === false }, location.origin);
  document.body.dataset.zoneSafehouseAction = value;
}
function material(color, metalness = 0, roughness = .85) { const value = new THREE.MeshStandardMaterial({ color, metalness, roughness }); owned.add(value); return value; }
function box(parent, size, position, surface, actionId) {
  const geometry = new THREE.BoxGeometry(...size); owned.add(geometry);
  const mesh = new THREE.Mesh(geometry, surface); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  if (actionId) mesh.userData.action = actionId;
  parent.add(mesh); objects.push(mesh); return mesh;
}
function room() {
  const group = new THREE.Group(); group.name = 'ZONE authored safehouse interior'; scene.add(group);
  const plaster = material('#57564e'), wall = material('#323a38'), wood = material('#493628'), brass = material('#a58a54', .66, .37), steel = material('#333e3c', .72, .46), soft = material('#5b3029'), dark = material('#151d1b');
  box(group, [8.8, .16, 6.8], [0, -.09, 0], dark);
  for (let x = -4.25, row = 0; x < 4.3; x += .35, row++) {
    const floor = material(row % 3 ? '#554031' : '#49382c', 0, .84);
    box(group, [.34, .045, 6.5], [x, .01, 0], floor);
  }
  box(group, [8.7, 3.6, .2], [0, 1.78, -3.3], plaster);
  box(group, [.18, 3.6, 6.6], [-4.35, 1.78, 0], wall);
  for (const x of [-4.25, -.8, 4.25]) box(group, [.12, 3.65, .25], [x, 1.8, -3.15], wood);
  box(group, [8.65, .12, .28], [0, 2.65, -3.12], wood);
  box(group, [8.65, .32, .28], [0, .13, -3.12], wood);
  box(group, [.27, .32, 6.5], [-4.22, .13, 0], wood);
  const rug = box(group, [4.1, .018, 3.6], [-.35, .047, .5], material('#6b5945')); rug.receiveShadow = true;
  for (const x of [-2.25, 1.55]) box(group, [.065, .02, 3.35], [x, .06, .5], brass);
  // Real metal locker and exposed rail, not a floating inventory illustration.
  const rack = new THREE.Group(); rack.userData.action = 'armory'; scene.add(rack);
  box(rack, [1.7, 2.28, .52], [-3.2, 1.16, -2.55], steel);
  box(rack, [1.5, 1.97, .08], [-3.2, 1.16, -2.245], dark);
  for (const x of [-3.82, -3.42, -3.02, -2.62]) {
    box(rack, [.035, 1.82, .05], [x, 1.18, -2.18], brass);
    box(rack, [.16, .07, .2], [x, .65, -2.1], steel);
  }
  box(rack, [1.45, .055, .18], [-3.2, 1.95, -2.12], wood);
  box(rack, [1.5, .11, .5], [-3.2, .15, -2.25], wood);
  hotspots.set('armory', { position: new THREE.Vector3(-3.2, 1.9, -1.9), target: new THREE.Vector3(-2.8, 1.1, -1.6), camera: new THREE.Vector3(-.5, 2.6, 3.2) });
  const vault = new THREE.Group(); vault.userData.action = 'vault'; scene.add(vault);
  box(vault, [1.5, 1.45, 1.18], [2.6, .76, -2.35], steel);
  box(vault, [1.3, 1.25, .08], [2.6, .76, -1.7], dark);
  box(vault, [1.19, 1.14, .09], [2.6, .76, -1.62], material('#626e67', .7, .52));
  const dialGeometry = new THREE.CylinderGeometry(.14, .14, .1, 28); owned.add(dialGeometry);
  const dial = new THREE.Mesh(dialGeometry, brass); dial.rotation.x = Math.PI / 2; dial.position.set(2.34, .98, -1.52); vault.add(dial); objects.push(dial);
  box(vault, [.08, .38, .12], [2.83, .72, -1.5], brass);
  box(vault, [.35, .06, .12], [2.83, .72, -1.46], brass);
  for (const y of [.37, 1.2]) box(vault, [.12, .18, .13], [1.95, y, -1.56], steel);
  hotspots.set('vault', { position: new THREE.Vector3(2.6, 1.65, -1.48), target: new THREE.Vector3(2.5, .9, -2), camera: new THREE.Vector3(4.5, 2.7, 2.8) });
  const lounge = new THREE.Group(); lounge.userData.action = 'lounge'; scene.add(lounge);
  box(lounge, [2.6, .4, 1.15], [2.65, .33, 1.95], soft);
  box(lounge, [2.6, .73, .22], [2.65, .8, 2.45], soft);
  for (const x of [1.35, 3.95]) box(lounge, [.22, .65, 1.25], [x, .63, 1.95], soft);
  for (const x of [1.85, 2.65, 3.45]) box(lounge, [.73, .16, .83], [x, .6, 1.93], material('#714037'));
  box(lounge, [2.1, .13, .75], [2.58, .62, .6], wood);
  for (const x of [1.7, 3.45]) box(lounge, [.08, .55, .55], [x, .29, .6], steel);
  const bottleMaterial = material('#224335', .15, .25), bottleGeometry = new THREE.CylinderGeometry(.065, .08, .31, 12); owned.add(bottleGeometry);
  for (const x of [2.1, 2.35, 2.6]) { const bottle = new THREE.Mesh(bottleGeometry, bottleMaterial); bottle.position.set(x, .84, .6); lounge.add(bottle); objects.push(bottle); }
  hotspots.set('lounge', { position: new THREE.Vector3(2.55, 1.3, .65), target: new THREE.Vector3(2.65, .7, 1.2), camera: new THREE.Vector3(5.8, 3.5, 4.2) });
  // Amber office lamp, physical paperwork and city window give the room a lived-in center.
  box(group, [2.1, .11, .85], [-.5, .95, -2.3], wood);
  for (const x of [-1.35, .35]) box(group, [.1, .9, .65], [x, .46, -2.3], wood);
  box(group, [.55, .018, .36], [-.52, 1.02, -2.16], material('#c3b596'));
  box(group, [.23, .2, .3], [.04, 1.08, -2.4], dark);
  const lamp = new THREE.PointLight('#ffbd67', 7.5, 6, 2); lamp.position.set(-.9, 2.1, -2.5); group.add(lamp);
  const lampShade = box(group, [.6, .11, .38], [-.9, 2.17, -2.5], brass);
  box(group, [.035, 1.12, .035], [-.9, 1.59, -2.5], brass);
  const glass = material('#457078', .35, .24); glass.emissive.set('#233d48'); glass.emissiveIntensity = .5;
  box(group, [2.3, 1.2, .04], [1.2, 2.05, -3.17], glass);
  for (const x of [.04, 1.2, 2.36]) box(group, [.055, 1.28, .1], [x, 2.05, -3.09], dark);
  for (const y of [1.43, 2.05, 2.67]) box(group, [2.38, .055, .1], [1.2, y, -3.09], dark);
  document.body.dataset.zoneSafehouseRoom = JSON.stringify({ source: 'authored-three-geometry', floor: 'wood-planks', rooms: [...hotspots.keys()], geometryInScene: true });
  return group;
}
function focus(id = 'overview') {
  if (!camera || !controls || disposed || renderFailed) return;
  const spec = hotspots.get(id), mobile = innerWidth < 600;
  tween = { from: camera.position.clone(), fromTarget: controls.target.clone(), to: spec?.camera.clone() || new THREE.Vector3(mobile ? 8.7 : 7.5, mobile ? 7.8 : 6.1, mobile ? 12.8 : 9.1),
    target: spec?.target.clone() || new THREE.Vector3(0, .8, -.1), at: performance.now(), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 };
}
function placeRoomPin(button, pixel, width, height) {
  // Keep the complete label inside this iframe. Its action and physical target
  // stay attached to the same room object; only the projected label is clamped.
  const margin = 8, availableWidth = Math.max(1, width - margin * 2);
  button.style.maxWidth = `${availableWidth}px`; button.style.whiteSpace = 'normal';
  const halfWidth = Math.min(button.offsetWidth, availableWidth) / 2, halfHeight = Math.min(button.offsetHeight, Math.max(1, height - margin * 2)) / 2;
  const clamp = (value, half, extent) => Math.max(half + margin, Math.min(extent - half - margin, Number.isFinite(value) ? value : extent / 2));
  const x = clamp((pixel.x * .5 + .5) * width, halfWidth, width), y = clamp((-pixel.y * .5 + .5) * height, halfHeight, height);
  button.style.left = `${x}px`; button.style.top = `${y}px`; button.style.visibility = 'visible';
  return { x, y, width: halfWidth * 2, height: halfHeight * 2, action: button.dataset.action };
}
async function applyPacket(next) {
  if (disposed) return;
  const token = ++generation; packet = { ...next, preview: next.preview === true || next.property.owned !== true }; parentInitialized = true;
  lang = next.lang === 'ar' ? 'ar' : 'en'; language();
  const media = next.property?.mediaAsset || '', happyMax = Number(next.property?.happy || 0);
  document.body.dataset.zoneSafehouseProperty = JSON.stringify({ id: next.property.id, owned: next.property.owned === true, preview: packet.preview, assetId: media || null, happyMax, trainingBoost: happyMax > 0 ? '×' + (1 + Math.log1p(happyMax / 500) * .35).toFixed(2) : null });
  syncReadiness();
  if (!renderReady || renderFailed) return;
  // The retained room and real service handlers are ready now. Uploaded shell
  // and character bytes are optional and must not hold the controls hostage.
  $('loading').hidden = true; runtime.start();
  const modelKey = media + ':' + String(next.draft === true), changed = modelKey !== lastModel; lastModel = modelKey;
  const loadHouse = async () => { if (changed) {
    const modelToken = ++modelGeneration;
    uploadedHouse?.wrapper?.removeFromParent(); uploadedHouse?.dispose(); uploadedHouse = null;
    if (/^[a-f0-9]{64}$/.test(media)) {
      try {
        const loaded = await loadAsset(media, { draft:next.draft === true });
        if (disposed || renderFailed || modelToken !== modelGeneration) { loaded.dispose(); return; }
        if (!loaded.object) { loaded.dispose(); throw Error('This property asset is not a 3D model'); }
        const interior = normalizeAssetObject(loaded.object, loaded.transform, 8);
        interior.name = 'Published uploaded property'; scene.add(interior); uploadedHouse = loaded; uploadedHouse.wrapper = interior;
        // Published custom architecture replaces only the shell. Services and
        // the real character remain shared; their positions are owner-readable.
        builtRoom.visible = false;
        document.body.dataset.zoneSafehouseRoom = JSON.stringify({ source: 'published-upload', assetId: media, rooms: [...hotspots.keys()], geometryInScene: true });
      } catch (error) {
        if (disposed || renderFailed || modelToken !== modelGeneration) return;
        builtRoom.visible = true; document.body.dataset.zoneSafehouseAssetError = error.message;
        $('house-mode').textContent = (packet.preview ? T[lang].preview + ' ' : '') + T[lang].assetFallback;
      }
    } else builtRoom.visible = true;
  }};
  const loadCharacter = async () => { try { await character.update(next.player || {}, {draft:next.draft === true}); }
    catch { if (!disposed && token === generation) $('equipment-line').textContent = T[lang].warning; } };
  await Promise.all([loadHouse(), loadCharacter()]);
}
let builtRoom;
function showError(reason) {
  if (disposed) return;
  renderFailed = true; $('loading').hidden = true; $('error').hidden = false;
  document.body.dataset.zoneMediaState = 'error'; document.body.dataset.zoneSafehouseError = String(reason?.message || reason); syncReadiness();
}
function disposeViewer(event = {}) {
  if (event.persisted || disposed) return;
  disposed = true; ++generation; ++modelGeneration; syncReadiness(); listeners.forEach(remove => remove()); listeners.clear();
  observer?.disconnect(); runtime?.dispose(); controls?.dispose(); character?.dispose(); uploadedHouse?.wrapper?.removeFromParent(); uploadedHouse?.dispose();
  owned.forEach(value => value.dispose()); owned.clear(); key?.dispose(); cool?.dispose(); renderer?.dispose();
}
const message = event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'zone:safehouse' || parent === window) return;
  const next = event.data, property = next.property;
  if (!property || typeof property.id !== 'string' || !property.id.trim() || typeof property.owned !== 'boolean' || (next.player != null && (typeof next.player !== 'object' || Array.isArray(next.player)))) return;
  applyPacket(next);
};
// Wire navigation/recovery before renderer setup, including its failure path.
listen(window, 'message', message); listen(window, 'pagehide', disposeViewer);
for (const button of document.querySelectorAll('[data-action]')) { listen(button, 'pointerenter', () => { if (servicesReady()) focus(button.dataset.action); }); listen(button, 'click', () => action(button.dataset.action)); }
listen($('overview'), 'click', () => { if (servicesReady()) focus(); }); listen($('exit'), 'click', () => action('exit')); listen($('error-exit'), 'click', () => action('exit'));
listen($('retry'), 'click', () => { if (!disposed) location.reload(); });
listen(window, 'keydown', event => { if (event.key === 'Escape') action('exit'); });
listen(canvas, 'keydown', event => { if (!servicesReady()) return; const keyMap = { Home: 'overview', '0': 'overview', '1': 'armory', '2': 'vault', '3': 'lounge' }; if (keyMap[event.key]) { event.preventDefault(); focus(keyMap[event.key]); } });
controlsWired = true; language(); syncReadiness();
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#202a2b');
  scene.add(new THREE.HemisphereLight('#c6cbc1', '#403728', 2.15));
  key = new THREE.DirectionalLight('#ffe1b2', 3.1); key.position.set(1, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 20 }); key.shadow.bias = -.0003; key.shadow.normalBias = .02; scene.add(key);
  cool = new THREE.DirectionalLight('#90b5c3', 1.7); cool.position.set(-2, 3, -2); scene.add(cool);
  camera = new THREE.PerspectiveCamera(40, 1, .05, 80); camera.position.set(7.5, 6.1, 9.1);
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .09;
  controls.target.set(0, .8, -.1); controls.enablePan = false; controls.minDistance = 3; controls.maxDistance = 20;
  controls.minPolarAngle = .45; controls.maxPolarAngle = Math.PI * .48; controls.maxAzimuthAngle = Math.PI * .63; controls.minAzimuthAngle = -Math.PI * .1;
  listen(controls, 'start', () => { tween = null; });
  builtRoom = room();
  character = createSafehouseCharacter({ scene, catalog: globalThis.ZONE_WEAPONS, materials: globalThis.ZONE_WEAPON_MATS, pack: globalThis.ZONE_WEAPON_PACK,
    publish: receipt => { if (disposed) return; document.body.dataset.zoneSafehouseCharacter = JSON.stringify({ ...(JSON.parse(document.body.dataset.zoneSafehouseCharacter || '{}')), ...receipt }); } });
  runtime = installViewerRuntime({ canvas, render(dt, elapsed) {
    if (tween) { const p = tween.duration ? Math.min(1, (performance.now() - tween.at) / tween.duration) : 1, blend = p * p * (3 - 2 * p);
      camera.position.lerpVectors(tween.from, tween.to, blend); controls.target.lerpVectors(tween.fromTarget, tween.target, blend); if (p === 1) tween = null; }
    character.tick(dt, elapsed); controls.update(); renderer.render(scene, camera);
    for (const [id, spec] of hotspots) {
      const pixel = spec.position.clone().project(camera), button = document.querySelector(`[data-action="${id}"]`);
      placeRoomPin(button, pixel, canvas.clientWidth, canvas.clientHeight);
    }
    document.body.dataset.zoneSafehouseStats = JSON.stringify({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio() });
  }, fail: showError });
  function resize() { const width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); focus(); }
  observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const ray = new THREE.Raycaster(); let press = null;
  listen(canvas, 'pointerdown', event => { press = servicesReady() ? [event.clientX, event.clientY] : null; });
  listen(canvas, 'pointerup', event => {
    if (!servicesReady()) { press = null; return; }
    if (!press || Math.hypot(event.clientX - press[0], event.clientY - press[1]) > 6) { press = null; return; }
    press = null; const rect = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    for (const hit of ray.intersectObjects(objects, false)) { let node = hit.object; while (node && !node.userData.action) node = node.parent; if (node?.userData.action) { action(node.userData.action); break; } }
  });
  renderReady = true; syncReadiness(); runtime.start();
} catch (error) { showError(error); }
// Parent ownership/auth stays authoritative, even when WebGL is unavailable.
if (parent !== window) parent.postMessage({ type: 'zone:safehouse-ready' }, location.origin);

import * as THREE from '../lib/three184/three.module.js';
import { OrbitControls } from '../lib/three184/OrbitControls.js';
import { createSafehouseCharacter } from './safehouse-character.mjs?v=116';
import { loadAsset, normalizeAssetObject } from './asset-loader.mjs';
import { installViewerRuntime } from './viewer-runtime108.mjs';

const $ = id => document.getElementById(id), canvas = $('room');
let lang = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ar' || q === 'en') return q;
  try { if (parent && parent !== window && (parent.document?.documentElement?.lang === 'ar' || parent.document?.documentElement?.dir === 'rtl')) return 'ar'; } catch {}
  return 'en';
})();
let packet = { property: { owned: false }, player: {}, lang, preview: true }, disposed = false, generation = 0, modelGeneration = 0, uploadedHouse = null, lastModel = '', currentTier = 'shack', tween = null;
let renderer, scene, camera, controls, runtime, character, observer, key, cool, hemi;
let controlsWired = false, parentInitialized = false, renderReady = false, renderFailed = false;
const listeners = new Set();
const owned = new Set(), hotspots = new Map(), objects = [];
window.ZoneSafehouse = { diagnostics: () => ({ lang, propertyId: packet.property?.id || null, tier: currentTier, owned: Boolean(packet.property?.owned), preview: Boolean(packet.preview), servicesReady: servicesReady(), renderReady, renderFailed, disposed, hotspotCount: hotspots.size, objectCount: objects.length }), supportedHotspots: () => [...hotspots.keys()], isSupportedAction: value => ['armory', 'vault', 'lounge', 'exit'].includes(value), isReady: () => servicesReady(), hasUploadedHouse: () => uploadedHouse !== null && !disposed, isDisposed: () => disposed, isPreview: () => Boolean(packet.preview), isOwned: () => Boolean(packet.property?.owned), currentPropertyId: () => packet.property?.id || null, currentLanguage: () => lang, supportedLanguages: () => ['en', 'ar'], defaultCameraFov: () => 40, minCameraDistance: () => 3, maxCameraDistance: () => 20, uploadedHouseTargetSize: () => 8, tweenDurationMs: () => 600, hotspotCount: () => hotspots.size, sceneObjectCount: () => objects.length, isRenderReady: () => renderReady, isRenderFailed: () => renderFailed, isParentInitialized: () => parentInitialized, defaultCameraPosition: () => [7.5, 6.1, 9.1], mobileCameraPosition: () => [8.7, 7.8, 12.8], defaultCameraTarget: () => [0, .8, -.1], pinClampMarginPx: () => 8, keyboardShortcutMap: () => ({ Home: 'overview', '0': 'overview', '1': 'armory', '2': 'vault', '3': 'lounge' }) };
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
function material(color, metalness = 0, roughness = .85, extra = null) {
  const value = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...(extra || {}) });
  owned.add(value);
  return value;
}
function box(parent, size, position, surface, actionId) {
  const geometry = new THREE.BoxGeometry(...size); owned.add(geometry);
  const mesh = new THREE.Mesh(geometry, surface); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  if (actionId) mesh.userData.action = actionId;
  parent.add(mesh); objects.push(mesh); return mesh;
}
function cyl(parent, rTop, rBot, h, segs, position, surface, rot = null) {
  const geometry = new THREE.CylinderGeometry(rTop, rBot, h, segs); owned.add(geometry);
  const mesh = new THREE.Mesh(geometry, surface); mesh.position.set(...position);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); objects.push(mesh); return mesh;
}
function torus(parent, radius, tube, rSeg, tSeg, position, surface, rot = null) {
  const geometry = new THREE.TorusGeometry(radius, tube, rSeg, tSeg); owned.add(geometry);
  const mesh = new THREE.Mesh(geometry, surface); mesh.position.set(...position);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); objects.push(mesh); return mesh;
}
function resolvePropertyTier(rawId, rawName) {
  const s = (String(rawId || '') + ' ' + String(typeof rawName === 'object' ? (rawName?.en || '') : (rawName || ''))).toLowerCase();
  if (/island|جزير|citadel/.test(s)) return 'island';
  if (/villa|فيلا|beach/.test(s)) return 'villa';
  if (/\bsemi\b|duplex|نصف|مزدوج/.test(s)) return 'semi';
  if (/\bhouse\b|detached|manor|منزل مستقل/.test(s)) return 'house';
  if (/\bapt\b|apart|loft|شقة/.test(s)) return 'apt';
  if (/trailer|caravan|مقطور/.test(s)) return 'trailer';
  return 'shack';
}
function clearPreviousRoom() {
  const prev = scene.userData.__roomNodes;
  if (Array.isArray(prev)) {
    for (const rootNode of prev) {
      scene.remove(rootNode);
    }
  }
  objects.length = 0;
  hotspots.clear();
  scene.userData.__roomNodes = [];
}
function room(rawTier = 'shack') {
  clearPreviousRoom();
  const tier = resolvePropertyTier(rawTier);
  const group = new THREE.Group();
  group.name = 'ZONE authored safehouse interior (' + tier + ')';
  const rack = new THREE.Group(); rack.userData.action = 'armory';
  const vault = new THREE.Group(); vault.userData.action = 'vault';
  const lounge = new THREE.Group(); lounge.userData.action = 'lounge';
  scene.add(group, rack, vault, lounge);
  scene.userData.__roomNodes = [group, rack, vault, lounge];

  const THEMES = {
    shack: { floorId: 'weathered-planks', bg: '#1d2526', base: '#141a19', wallBack: '#4c493f', wallSide: '#2f3735', trim: '#473425', floorA: '#543f30', floorB: '#433226', rug: '#65513d', rugTrim: '#9e824c', metal: '#374240', accent: '#a8894e', upholstery: '#5c3129', cushion: '#724137', lamp: '#ffb457', lampInt: 7.4 },
    trailer: { floorId: 'checkered-vinyl', bg: '#191826', base: '#12131d', wallBack: '#687482', wallSide: '#55606e', trim: '#94a3b8', floorA: '#d6d0c2', floorB: '#262932', rug: '#223042', rugTrim: '#38bdf8', metal: '#64748b', accent: '#38bdf8', upholstery: '#881d2a', cushion: '#a62636', lamp: '#67e8f9', lampInt: 8.2 },
    apt: { floorId: 'walnut-parquet', bg: '#161b24', base: '#11151c', wallBack: '#6e3b2e', wallSide: '#272d36', trim: '#1f242c', floorA: '#6b472d', floorB: '#583923', rug: '#2b3544', rugTrim: '#cbd5e1', metal: '#242b35', accent: '#22d3ee', upholstery: '#2c221e', cushion: '#3d302a', lamp: '#fcd34d', lampInt: 8.6 },
    semi: { floorId: 'herringbone-oak', bg: '#221d19', base: '#181411', wallBack: '#6b5e50', wallSide: '#574c40', trim: '#4a2c1b', floorA: '#8b623b', floorB: '#75502e', rug: '#6e2323', rugTrim: '#d4af37', metal: '#30383a', accent: '#d4a656', upholstery: '#1c4532', cushion: '#275e45', lamp: '#ffca7a', lampInt: 8.8 },
    house: { floorId: 'carrara-marble', bg: '#1a1922', base: '#121118', wallBack: '#3b3342', wallSide: '#2d2633', trim: '#d4af37', floorA: '#dfd9ce', floorB: '#2a2930', rug: '#4c1d24', rugTrim: '#f3c969', metal: '#2a303c', accent: '#f3c969', upholstery: '#4a1525', cushion: '#631d32', lamp: '#fde68a', lampInt: 10.2 },
    villa: { floorId: 'travertine-limestone', bg: '#112630', base: '#0e1d24', wallBack: '#e5dccb', wallSide: '#d8ceb9', trim: '#c89d54', floorA: '#dfd3be', floorB: '#cfc1a9', rug: '#164e63', rugTrim: '#f3c969', metal: '#1e293b', accent: '#f3c969', upholstery: '#f1ece1', cushion: '#38bdf8', lamp: '#fef08a', lampInt: 10.8 },
    island: { floorId: 'obsidian-gold-citadel', bg: '#0b1118', base: '#070b10', wallBack: '#141922', wallSide: '#10151d', trim: '#f5c451', floorA: '#181d26', floorB: '#10141b', rug: '#172030', rugTrim: '#fbbf24', metal: '#1f2937', accent: '#fbbf24', upholstery: '#18181b', cushion: '#b45309', lamp: '#fef08a', lampInt: 12.0 }
  };
  const cfg = THEMES[tier] || THEMES.shack;
  if (scene.background && typeof scene.background.set === 'function') scene.background.set(cfg.bg);

  const wallBackMat = material(cfg.wallBack, tier === 'trailer' ? .55 : .08, tier === 'trailer' ? .42 : .82);
  const wallSideMat = material(cfg.wallSide, tier === 'trailer' ? .5 : .08, tier === 'trailer' ? .45 : .84);
  const trimMat = material(cfg.trim, tier === 'island' || tier === 'house' ? .72 : .18, tier === 'island' || tier === 'house' ? .28 : .74);
  const metalMat = material(cfg.metal, .76, .36);
  const accentMat = material(cfg.accent, .78, .26);
  const softMat = material(cfg.upholstery, .06, .78);
  const cushionMat = material(cfg.cushion, .08, .72);
  const darkMat = material(cfg.base, .22, .78);

  // Foundation slab
  box(group, [9.2, .18, 7.2], [0, -.1, 0], darkMat);

  // Distinct Architectural Flooring per Property Tier (guarantees >55 physical meshes)
  if (tier === 'trailer' || tier === 'house') {
    const tileA = material(cfg.floorA, tier === 'house' ? .18 : .05, tier === 'house' ? .22 : .65);
    const tileB = material(cfg.floorB, tier === 'house' ? .22 : .08, tier === 'house' ? .24 : .68);
    for (let ix = 0; ix < 8; ix++) {
      for (let iz = 0; iz < 6; iz++) {
        box(group, [1.06, .045, 1.08], [-3.75 + ix * 1.07, .012, -2.72 + iz * 1.09], (ix + iz) % 2 === 0 ? tileA : tileB);
      }
    }
  } else if (tier === 'villa' || tier === 'island') {
    const slabA = material(cfg.floorA, tier === 'island' ? .35 : .08, tier === 'island' ? .18 : .46);
    const slabB = material(cfg.floorB, tier === 'island' ? .4 : .08, tier === 'island' ? .22 : .52);
    for (let ix = 0; ix < 6; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        box(group, [1.42, .048, 1.32], [-3.65 + ix * 1.46, .012, -2.68 + iz * 1.34], (ix + iz) % 2 === 0 ? slabA : slabB);
      }
    }
    if (tier === 'island') {
      for (const zLine of [-2.0, 0, 2.0]) box(group, [8.6, .052, .045], [0, .016, zLine], accentMat);
      for (const xLine of [-2.9, 0, 2.9]) box(group, [.045, .052, 6.6], [xLine, .016, 0], accentMat);
    }
  } else {
    const plankA = material(cfg.floorA, .04, tier === 'apt' ? .48 : .82);
    const plankB = material(cfg.floorB, .04, tier === 'apt' ? .52 : .86);
    for (let x = -4.25, row = 0; x < 4.35; x += .35, row++) {
      box(group, [.335, .045, 6.65], [x, .01, 0], row % 2 === 0 ? plankA : plankB);
    }
  }

  // Area Carpet / Inlay Medallion
  const rug = box(group, [4.2, .02, 3.6], [-.25, .048, .52], material(cfg.rug, .05, .86));
  rug.receiveShadow = true;
  for (const x of [-2.28, 1.78]) box(group, [.065, .024, 3.45], [x, .058, .52], material(cfg.rugTrim, .65, .32));

  // Tier-Specific Structural Shell, Windows & Exterior Vistas
  if (tier === 'villa' || tier === 'island') {
    // Panoramic Open Glass Rear Wall + Ocean / Pool / Helipad Exterior Vista!
    box(group, [3.1, 3.8, .22], [-3.0, 1.88, -3.32], wallBackMat);
    box(group, [.22, 3.8, 6.8], [-4.42, 1.88, 0], wallSideMat);
    const glassPane = material(tier === 'villa' ? '#38bdf8' : '#0ea5e9', .2, .12, { transparent: true, opacity: .24, emissive: tier === 'villa' ? '#0284c7' : '#0369a1', emissiveIntensity: .35 });
    box(group, [5.65, 3.35, .05], [1.55, 1.76, -3.28], glassPane);
    for (const gx of [-1.25, .62, 2.48, 4.35]) box(group, [.09, 3.6, .16], [gx, 1.82, -3.25], trimMat);
    box(group, [8.9, .18, .32], [0, 3.66, -3.22], trimMat);

    // Exterior Ocean Deck & Vista Beyond Glass (z = -3.5 to -6.8)
    const waterMat = material(tier === 'villa' ? '#06b6d4' : '#0c4a6e', .18, .14, { emissive: tier === 'villa' ? '#0891b2' : '#075985', emissiveIntensity: .65 });
    box(group, [9.6, .12, 3.6], [1.1, -.06, -5.25], waterMat);
    box(group, [6.2, .14, 1.15], [1.45, .01, -3.95], material(tier === 'villa' ? '#e7dcc8' : '#1f2937', .15, .55));

    if (tier === 'villa') {
      // Sunset horizon glow + infinity pool coping + 3D Mediterranean palm tree
      const sunMat = material('#fb923c', .1, .3, { emissive: '#f97316', emissiveIntensity: 1.1 });
      cyl(group, .75, .75, .06, 24, [2.2, 2.35, -6.7], sunMat, [Math.PI / 2, 0, 0]);
      const trunkMat = material('#6b4423', .05, .9), frondMat = material('#15803d', .08, .65);
      cyl(group, .09, .14, 2.45, 10, [3.55, 1.2, -4.25], trunkMat, [0, 0, -.12]);
      for (let f = 0; f < 5; f++) {
        const ang = (f / 5) * Math.PI * 2;
        box(group, [.95, .04, .22], [3.42 + Math.cos(ang) * .42, 2.38, -4.25 + Math.sin(ang) * .42], frondMat);
      }
    } else {
      // Private Island Helipad ('H' Circle) + Superyacht Silhouette + Central Hologram War Table
      cyl(group, 1.18, 1.25, .14, 28, [2.15, .04, -5.15], material('#1e293b', .45, .55));
      torus(group, 1.05, .04, 10, 32, [2.15, .12, -5.15], accentMat, [Math.PI / 2, 0, 0]);
      box(group, [.12, .03, .78], [1.88, .125, -5.15], accentMat);
      box(group, [.12, .03, .78], [2.42, .125, -5.15], accentMat);
      box(group, [.62, .03, .12], [2.15, .125, -5.15], accentMat);
      // Superyacht hull on the water
      box(group, [1.85, .24, .48], [-.95, .12, -5.85], material('#f8fafc', .25, .25));
      box(group, [.95, .22, .38], [-.85, .34, -5.85], material('#38bdf8', .2, .2, { emissive: '#0284c7', emissiveIntensity: .5 }));
      // Central Sovereign Holographic War Table inside Citadel
      cyl(group, .68, .78, .52, 24, [-.45, .28, -.55], metalMat);
      torus(group, .72, .03, 10, 32, [-.45, .55, -.55], accentMat, [Math.PI / 2, 0, 0]);
      const holoMat = material('#38bdf8', .1, .15, { transparent: true, opacity: .68, emissive: '#06b6d4', emissiveIntensity: 1.1 });
      cyl(group, .58, .58, .03, 24, [-.45, .56, -.55], holoMat);
      box(group, [.22, .48, .22], [-.45, .82, -.55], holoMat);
      box(group, [.14, .32, .14], [-.72, .74, -.48], holoMat);
      box(group, [.14, .36, .14], [-.18, .76, -.62], holoMat);
    }
  } else {
    // Solid Architectural Back & Left Walls
    box(group, [8.9, 3.7, .22], [0, 1.82, -3.32], wallBackMat);
    box(group, [.22, 3.7, 6.8], [-4.4, 1.82, 0], wallSideMat);
    box(group, [8.85, .28, .28], [0, .14, -3.18], trimMat);
    box(group, [.28, .28, 6.7], [-4.26, .14, 0], trimMat);
    box(group, [8.85, .14, .3], [0, 3.58, -3.16], trimMat);

    if (tier === 'shack') {
      // Corrugated rusted tin patch + timber pier ribs + foggy harbor window
      for (const x of [-4.22, -1.1, 1.9, 4.22]) box(group, [.14, 3.65, .26], [x, 1.82, -3.16], trimMat);
      box(group, [1.8, 1.1, .05], [-1.35, 2.25, -3.19], material('#5c3d2e', .55, .62));
      const fogGlass = material('#4a6b70', .3, .28, { emissive: '#1e3a40', emissiveIntensity: .48 });
      box(group, [1.9, 1.05, .04], [1.05, 2.05, -3.19], fogGlass);
      for (const x of [.1, 1.05, 2.0]) box(group, [.06, 1.12, .1], [x, 2.05, -3.13], trimMat);
    } else if (tier === 'trailer') {
      // Curved Brushed-Aluminum Airstream Ribs + Pink/Cyan Neon Blinds
      for (const zRib of [-2.6, -.9, .8, 2.5]) {
        box(group, [.12, 3.45, .14], [-4.25, 1.74, zRib], trimMat);
      }
      for (const xRib of [-3.6, -1.2, 1.2, 3.6]) {
        box(group, [.12, 3.45, .14], [xRib, 1.74, -3.16], trimMat);
      }
      const neonCyan = material('#22d3ee', .15, .2, { emissive: '#06b6d4', emissiveIntensity: .95 });
      const neonPink = material('#f43f5e', .15, .2, { emissive: '#e11d48', emissiveIntensity: .9 });
      box(group, [2.4, .95, .05], [.85, 2.12, -3.18], material('#0f172a', .4, .3));
      for (let b = 0; b < 5; b++) {
        box(group, [2.32, .045, .08], [.85, 1.74 + b * .18, -3.13], b % 2 === 0 ? neonCyan : neonPink);
      }
    } else if (tier === 'apt') {
      // Exposed Brick + Steel I-Beams + Night Skyline Window with 3D Skyscrapers
      for (const xCol of [-4.22, -.95, 4.22]) box(group, [.22, 3.7, .28], [xCol, 1.82, -3.15], metalMat);
      const nightGlass = material('#1e3a5f', .35, .16, { emissive: '#0f2942', emissiveIntensity: .65 });
      box(group, [2.85, 1.65, .04], [1.05, 2.08, -3.19], nightGlass);
      for (let s = 0; s < 5; s++) {
        const sh = .55 + (s % 3) * .32;
        box(group, [.36, sh, .06], [.02 + s * .52, 1.28 + sh / 2, -3.15], material('#0f172a', .3, .6));
        box(group, [.22, .06, .07], [.02 + s * .52, 1.45 + (s % 2) * .28, -3.13], accentMat);
      }
      for (const x of [-.38, 1.05, 2.48]) box(group, [.06, 1.72, .11], [x, 2.08, -3.12], metalMat);
    } else if (tier === 'semi') {
      // Wainscoting + Warm Brick Fireplace Hearth & Glowing Embers + Staircase Rail
      box(group, [8.75, 1.15, .08], [0, .68, -3.18], material('#dfd5c5', .05, .75));
      box(group, [.08, 1.15, 6.6], [-4.26, .68, 0], material('#dfd5c5', .05, .75));
      // Fireplace at center-back
      box(group, [1.85, 1.55, .48], [-.45, .82, -2.98], material('#5c2d24', .08, .85));
      box(group, [2.05, .14, .58], [-.45, 1.62, -2.95], trimMat);
      box(group, [.95, .82, .24], [-.45, .48, -2.76], darkMat);
      box(group, [.68, .22, .18], [-.45, .22, -2.72], material('#f97316', .1, .3, { emissive: '#ea580c', emissiveIntensity: 1.2 }));
    } else if (tier === 'house') {
      // Classical Fluted Columns + Gilded Molding + Arched Manor Windows + Crystal Chandelier
      for (const xCol of [-4.1, -.95, .95, 4.1]) {
        cyl(group, .14, .16, 3.35, 16, [xCol, 1.78, -3.05], material('#e5dfd3', .12, .45));
        box(group, [.42, .18, .42], [xCol, 3.48, -3.05], accentMat);
      }
      const manorGlass = material('#312e81', .3, .18, { emissive: '#1e1b4b', emissiveIntensity: .6 });
      box(group, [1.45, 1.85, .05], [0, 2.05, -3.19], manorGlass);
      // Overhead Brass & Crystal Chandelier
      cyl(group, .03, .03, .75, 10, [0, 3.35, -.2], accentMat);
      torus(group, .58, .035, 10, 28, [0, 2.98, -.2], accentMat, [Math.PI / 2, 0, 0]);
      const crystalMat = material('#fef9c3', .1, .1, { emissive: '#fde047', emissiveIntensity: 1.1 });
      for (let c = 0; c < 6; c++) {
        const ca = (c / 6) * Math.PI * 2;
        box(group, [.08, .18, .08], [Math.cos(ca) * .58, 3.06, -.2 + Math.sin(ca) * .58], crystalMat);
      }
    }
  }

  // === 1. ARMORY HOTSPOT (`rack`) — Distinct per Tier, Solid Raycast Backing ===
  box(rack, [1.76, 2.32, .52], [-3.2, 1.18, -2.55], tier === 'shack' ? trimMat : metalMat);
  box(rack, [1.54, 1.98, .1], [-3.2, 1.18, -2.25], darkMat);
  if (tier === 'villa' || tier === 'island' || tier === 'house') {
    const ledStrip = material(tier === 'island' ? '#fbbf24' : '#38bdf8', .1, .2, { emissive: tier === 'island' ? '#d97706' : '#0284c7', emissiveIntensity: .9 });
    box(rack, [1.5, .05, .12], [-3.2, 2.12, -2.18], ledStrip);
  }
  for (const x of [-3.82, -3.42, -3.02, -2.62]) {
    box(rack, [.045, 1.78, .06], [x, 1.16, -2.17], accentMat);
    box(rack, [.17, .08, .22], [x, .66, -2.09], metalMat);
  }
  box(rack, [1.52, .12, .5], [-3.2, .15, -2.25], trimMat);
  hotspots.set('armory', { position: new THREE.Vector3(-3.2, 1.9, -1.9), target: new THREE.Vector3(-2.8, 1.1, -1.6), camera: new THREE.Vector3(-.5, 2.6, 3.2) });

  // === 2. VAULT HOTSPOT (`vault`) — Distinct per Tier, Solid Raycast Body ===
  const vaultScaleH = tier === 'island' || tier === 'house' ? 1.82 : tier === 'shack' ? 1.12 : 1.48;
  const vaultY = vaultScaleH * .5 + .04;
  box(vault, [1.56, vaultScaleH, 1.18], [2.6, vaultY, -2.35], metalMat);
  box(vault, [1.34, vaultScaleH - .2, .09], [2.6, vaultY, -1.72], darkMat);
  box(vault, [1.22, vaultScaleH - .3, .1], [2.6, vaultY, -1.63], material(tier === 'island' ? '#1f2937' : '#5f6b66', .78, .34));
  cyl(vault, .16, .16, .11, 28, [2.34, vaultY + .18, -1.52], accentMat, [Math.PI / 2, 0, 0]);
  if (tier === 'island' || tier === 'villa' || tier === 'house') {
    torus(vault, .24, .025, 10, 24, [2.34, vaultY + .18, -1.48], accentMat);
  }
  box(vault, [.08, .38, .12], [2.84, vaultY - .04, -1.5], accentMat);
  box(vault, [.35, .06, .12], [2.84, vaultY - .04, -1.46], accentMat);
  for (const yOff of [-vaultScaleH * .32, vaultScaleH * .32]) box(vault, [.12, .18, .13], [1.95, vaultY + yOff, -1.56], metalMat);
  hotspots.set('vault', { position: new THREE.Vector3(2.6, 1.65, -1.48), target: new THREE.Vector3(2.5, .9, -2), camera: new THREE.Vector3(4.5, 2.7, 2.8) });

  // === 3. LOUNGE HOTSPOT (`lounge`) — Distinct per Tier, Solid Center Hit Surface ===
  box(lounge, [2.68, .42, 1.22], [2.65, .34, 1.92], softMat);
  box(lounge, [2.68, .78, .26], [2.65, .82, 2.44], softMat);
  for (const x of [1.35, 3.95]) box(lounge, [.24, .68, 1.26], [x, .64, 1.92], softMat);
  for (const x of [1.85, 2.65, 3.45]) box(lounge, [.75, .18, .88], [x, .62, 1.9], cushionMat);
  // Solid lounge table & base right across center so raycast always hits
  box(lounge, [2.18, .44, .82], [2.62, .38, .68], tier === 'villa' || tier === 'island' ? accentMat : trimMat);
  box(lounge, [2.24, .09, .86], [2.62, .63, .68], tier === 'apt' || tier === 'villa' ? material('#38bdf8', .25, .15) : trimMat);
  const bottleMat = material(tier === 'island' || tier === 'villa' ? '#f59e0b' : '#224335', .25, .22);
  for (const x of [2.15, 2.42, 2.68]) cyl(lounge, .065, .08, .32, 12, [x, .85, .68], bottleMat);
  hotspots.set('lounge', { position: new THREE.Vector3(2.55, 1.3, .65), target: new THREE.Vector3(2.65, .7, 1.2), camera: new THREE.Vector3(5.8, 3.5, 4.2) });

  // Centerpiece Desk / Console & Warm Estate PointLight
  if (tier !== 'semi' && tier !== 'island') {
    box(group, [2.05, .11, .84], [-.55, .94, -2.28], trimMat);
    for (const x of [-1.38, .28]) box(group, [.1, .88, .65], [x, .46, -2.28], metalMat);
    box(group, [.56, .02, .36], [-.55, 1.01, -2.16], accentMat);
  }
  const lamp = new THREE.PointLight(cfg.lamp, cfg.lampInt, 9, 1.8);
  lamp.position.set(-.65, 2.35, -1.85);
  group.add(lamp);
  box(group, [.56, .1, .36], [-.65, 2.42, -1.85], accentMat);

  document.body.dataset.zoneSafehouseRoom = JSON.stringify({
    source: 'authored-three-geometry',
    tier,
    floor: cfg.floorId,
    objectCount: objects.length,
    rooms: [...hotspots.keys()],
    geometryInScene: true
  });
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
function setBuiltRoomVisible(vis) {
  if (builtRoom) builtRoom.visible = vis;
  const nodes = scene?.userData?.__roomNodes;
  if (Array.isArray(nodes)) for (const n of nodes) n.visible = vis;
}
async function applyPacket(next) {
  if (disposed) return;
  const token = ++generation; packet = { ...next, preview: next.preview === true || next.property.owned !== true }; parentInitialized = true;
  lang = next.lang === 'ar' ? 'ar' : 'en'; language();
  const media = next.property?.mediaAsset || '', happyMax = Number(next.property?.happy || 0);
  const nextTier = resolvePropertyTier(next.property?.id, next.property?.name);
  document.body.dataset.zoneSafehouseProperty = JSON.stringify({ id: next.property.id, tier: nextTier, owned: next.property.owned === true, preview: packet.preview, assetId: media || null, happyMax, trainingBoost: happyMax > 0 ? '×' + (1 + Math.log1p(happyMax / 500) * .35).toFixed(2) : null });
  syncReadiness();
  if (!renderReady || renderFailed) return;
  // Rebuild 3D architectural interior immediately whenever property tier changes!
  if (nextTier !== currentTier) {
    currentTier = nextTier;
    builtRoom = room(currentTier);
    focus('overview');
  }
  // The retained room and real service handlers are ready now. Uploaded shell
  // and character bytes are optional and must not hold the controls hostage.
  $('loading').hidden = true; runtime.start();
  const modelKey = (next.property?.id || '') + ':' + media + ':' + String(next.draft === true), changed = modelKey !== lastModel; lastModel = modelKey;
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
        setBuiltRoomVisible(false);
        document.body.dataset.zoneSafehouseRoom = JSON.stringify({ source: 'published-upload', assetId: media, tier: currentTier, rooms: [...hotspots.keys()], geometryInScene: true });
      } catch (error) {
        if (disposed || renderFailed || modelToken !== modelGeneration) return;
        setBuiltRoomVisible(true); document.body.dataset.zoneSafehouseAssetError = error.message;
        $('house-mode').textContent = (packet.preview ? T[lang].preview + ' ' : '') + T[lang].assetFallback;
      }
    } else setBuiltRoomVisible(true);
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
  owned.forEach(value => value.dispose()); owned.clear(); hemi?.dispose?.(); key?.dispose(); cool?.dispose(); renderer?.dispose();
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#1d2526');
  hemi = new THREE.HemisphereLight('#d6dbd0', '#3d3426', 2.2); scene.add(hemi);
  key = new THREE.DirectionalLight('#ffe4b8', 3.15); key.position.set(1.2, 7.2, 5.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: .1, far: 22 }); key.shadow.bias = -.0003; key.shadow.normalBias = .02; scene.add(key);
  cool = new THREE.DirectionalLight('#90b5c3', 1.75); cool.position.set(-2.2, 3.2, -2); scene.add(cool);
  camera = new THREE.PerspectiveCamera(40, 1, .05, 80); camera.position.set(7.5, 6.1, 9.1);
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .09;
  controls.target.set(0, .8, -.1); controls.enablePan = false; controls.minDistance = 3; controls.maxDistance = 20;
  controls.minPolarAngle = .45; controls.maxPolarAngle = Math.PI * .48; controls.maxAzimuthAngle = Math.PI * .63; controls.minAzimuthAngle = -Math.PI * .1;
  listen(controls, 'start', () => { tween = null; });
  builtRoom = room('shack');
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

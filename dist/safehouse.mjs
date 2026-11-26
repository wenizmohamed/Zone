import * as THREE from '../lib/three184/three.module.js';
import { OrbitControls } from '../lib/three184/OrbitControls.js';
import { RoomEnvironment } from '../lib/three184/RoomEnvironment.js';
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
function canUseBrowserTextures() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}
function getRoomTexCache() {
  if (!scene.userData.__pbrTexCache) scene.userData.__pbrTexCache = new Map();
  return scene.userData.__pbrTexCache;
}
function loadPhotoPbrSet(prefix, rx = 2, ry = 2) {
  if (!canUseBrowserTextures() || typeof THREE.TextureLoader !== 'function') return {};
  const cache = getRoomTexCache(), key = `photo:${prefix}:${rx}:${ry}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const loader = new THREE.TextureLoader();
    const prep = (tex, srgb) => {
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      if (srgb && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      owned.add(tex);
      return tex;
    };
    const base = `../assets/character/stage/${prefix}`;
    const maps = {
      map: prep(loader.load(`${base}_Diffuse_1k.jpg`), true),
      normalMap: prep(loader.load(`${base}_nor_gl_1k.jpg`), false),
      roughnessMap: prep(loader.load(`${base}_Rough_1k.jpg`), false)
    };
    cache.set(key, maps);
    return maps;
  } catch {
    return {};
  }
}
function makeCanvasPbrMaps(cacheId, rx, ry, drawFn) {
  if (!canUseBrowserTextures()) return {};
  const cache = getRoomTexCache(), key = `proc:${cacheId}:${rx}:${ry}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const diffC = document.createElement('canvas'); diffC.width = 512; diffC.height = 512;
    const bumpC = document.createElement('canvas'); bumpC.width = 512; bumpC.height = 512;
    const dCtx = diffC.getContext('2d'), bCtx = bumpC.getContext('2d');
    if (!dCtx || !bCtx) return {};
    drawFn(dCtx, bCtx, 512, 512);
    const toTex = (c, srgb) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      if (srgb && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      owned.add(t);
      return t;
    };
    const maps = { map: toTex(diffC, true), bumpMap: toTex(bumpC, false) };
    cache.set(key, maps);
    return maps;
  } catch {
    return {};
  }
}
function woodPbrMaps(tag, cA, cB, rx = 2, ry = 2) {
  return makeCanvasPbrMaps(`wood:${tag}`, rx, ry, (d, b, w, h) => {
    d.fillStyle = cA; d.fillRect(0, 0, w, h);
    b.fillStyle = '#808080'; b.fillRect(0, 0, w, h);
    const planks = 8, pw = w / planks;
    for (let p = 0; p < planks; p++) {
      const x0 = p * pw;
      d.fillStyle = p % 2 === 0 ? cA : cB;
      d.fillRect(x0 + 1, 0, pw - 2, h);
      d.fillStyle = 'rgba(10,8,6,0.52)'; d.fillRect(x0, 0, 2, h);
      b.fillStyle = '#262626'; b.fillRect(x0, 0, 3, h);
      for (let g = 0; g < 26; g++) {
        const gx = x0 + 3 + ((g * 17 + p * 11) % (pw - 6));
        d.strokeStyle = g % 3 === 0 ? 'rgba(255,235,205,0.06)' : 'rgba(15,10,6,0.14)';
        d.lineWidth = 1 + (g % 2);
        d.beginPath(); d.moveTo(gx, 0); d.bezierCurveTo(gx + 3, h * .33, gx - 3, h * .66, gx + 1, h); d.stroke();
        b.strokeStyle = g % 2 === 0 ? '#969696' : '#6c6c6c';
        b.lineWidth = 1;
        b.beginPath(); b.moveTo(gx, 0); b.lineTo(gx + 1, h); b.stroke();
      }
    }
  });
}
function marblePbrMaps(tag, baseHex, veinHex, rx = 1, ry = 1) {
  return makeCanvasPbrMaps(`marble:${tag}`, rx, ry, (d, b, w, h) => {
    d.fillStyle = baseHex; d.fillRect(0, 0, w, h);
    b.fillStyle = '#848484'; b.fillRect(0, 0, w, h);
    for (let v = 0; v < 18; v++) {
      let x = (v * 53) % w, y = 0;
      d.strokeStyle = veinHex; d.globalAlpha = v % 3 === 0 ? .28 : .14;
      d.lineWidth = v % 4 === 0 ? 2.4 : 1.1;
      b.strokeStyle = '#727272'; b.lineWidth = 1.2;
      d.beginPath(); d.moveTo(x, y); b.beginPath(); b.moveTo(x, y);
      for (let s = 1; s <= 8; s++) {
        x += Math.sin(v * 1.7 + s * .9) * 28; y = (s / 8) * h;
        d.lineTo(x, y); b.lineTo(x, y);
      }
      d.stroke(); b.stroke();
    }
    d.globalAlpha = 1;
  });
}
function leatherTuftMaps(tag, hideHex, rx = 3, ry = 1.4) {
  return makeCanvasPbrMaps(`tuft:${tag}`, rx, ry, (d, b, w, h) => {
    d.fillStyle = hideHex; d.fillRect(0, 0, w, h);
    b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, w, h);
    const step = 64;
    for (let y = 0; y <= h; y += step) {
      for (let x = 0; x <= w; x += step) {
        const cx = x + (Math.floor(y / step) % 2 ? step / 2 : 0);
        d.strokeStyle = 'rgba(8,5,4,0.38)'; d.lineWidth = 2;
        d.beginPath(); d.moveTo(cx, y - step / 2); d.lineTo(cx + step / 2, y); d.lineTo(cx, y + step / 2); d.lineTo(cx - step / 2, y); d.closePath(); d.stroke();
        b.strokeStyle = '#484848'; b.lineWidth = 3;
        b.beginPath(); b.moveTo(cx, y - step / 2); b.lineTo(cx + step / 2, y); b.lineTo(cx, y + step / 2); b.lineTo(cx - step / 2, y); b.closePath(); b.stroke();
        const grad = b.createRadialGradient(cx, y, 2, cx, y, 14);
        grad.addColorStop(0, '#181818'); grad.addColorStop(1, '#9a9a9a');
        b.fillStyle = grad; b.beginPath(); b.arc(cx, y, 14, 0, Math.PI * 2); b.fill();
        d.fillStyle = 'rgba(12,8,6,0.55)'; d.beginPath(); d.arc(cx, y, 4.5, 0, Math.PI * 2); d.fill();
      }
    }
  });
}
function persianRugMaps(tag, fieldHex, trimHex) {
  return makeCanvasPbrMaps(`rug:${tag}`, 1, 1, (d, b, w, h) => {
    d.fillStyle = fieldHex; d.fillRect(0, 0, w, h);
    b.fillStyle = '#7e7e7e'; b.fillRect(0, 0, w, h);
    d.strokeStyle = trimHex; d.lineWidth = 18; d.strokeRect(26, 26, w - 52, h - 52);
    d.lineWidth = 5; d.strokeRect(52, 52, w - 104, h - 104);
    d.save(); d.translate(w / 2, h / 2); d.rotate(Math.PI / 4);
    d.fillStyle = trimHex; d.globalAlpha = .26; d.fillRect(-78, -78, 156, 156);
    d.globalAlpha = .55; d.strokeRect(-92, -92, 184, 184);
    d.restore(); d.globalAlpha = 1;
    for (let y = 0; y < h; y += 4) {
      b.fillStyle = y % 8 === 0 ? '#929292' : '#6c6c6c';
      b.fillRect(0, y, w, 2);
    }
  });
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
    shack: { floorId: 'weathered-planks', bg: '#15191a', fog: .028, base: '#111514', wallBack: '#464137', wallSide: '#333631', trim: '#433022', floorA: '#543e2e', floorB: '#423023', rug: '#4f2c24', rugTrim: '#9e7d47', metal: '#2e3536', accent: '#b08b4f', upholstery: '#4a251f', cushion: '#5c2f27', lamp: '#ffad4d', lampInt: 8.4 },
    trailer: { floorId: 'checkered-vinyl', bg: '#171618', fog: .025, base: '#111114', wallBack: '#5e656d', wallSide: '#4d545c', trim: '#6b4c35', floorA: '#c4baa8', floorB: '#2a2b2e', rug: '#3b2322', rugTrim: '#b89254', metal: '#525b66', accent: '#c99b49', upholstery: '#59201e', cushion: '#6e2926', lamp: '#ffbe66', lampInt: 8.6 },
    apt: { floorId: 'walnut-parquet', bg: '#13161c', fog: .022, base: '#0e1116', wallBack: '#7a4a3a', wallSide: '#252930', trim: '#1d2026', floorA: '#5e3c24', floorB: '#4c301c', rug: '#232c38', rugTrim: '#b5945b', metal: '#232830', accent: '#c89d54', upholstery: '#2b1f1a', cushion: '#3b2b24', lamp: '#ffd27d', lampInt: 9.2 },
    semi: { floorId: 'herringbone-oak', bg: '#1b1714', fog: .022, base: '#13100d', wallBack: '#594c3f', wallSide: '#4a3f34', trim: '#3d2416', floorA: '#7d5634', floorB: '#684629', rug: '#591c1c', rugTrim: '#c89f49', metal: '#2b3133', accent: '#c89d54', upholstery: '#1c3b2b', cushion: '#244d38', lamp: '#ffc978', lampInt: 9.4 },
    house: { floorId: 'carrara-marble', bg: '#16141a', fog: .019, base: '#100e13', wallBack: '#332824', wallSide: '#281f1c', trim: '#c9a048', floorA: '#dcd5c9', floorB: '#232228', rug: '#4a171e', rugTrim: '#dfb456', metal: '#262a33', accent: '#dfb456', upholstery: '#42141f', cushion: '#571b29', lamp: '#fde08d', lampInt: 10.6 },
    villa: { floorId: 'travertine-limestone', bg: '#101d24', fog: .016, base: '#0c161b', wallBack: '#dfd5c3', wallSide: '#d1c6b2', trim: '#5c4632', floorA: '#d9ccb6', floorB: '#cabca4', rug: '#1c3844', rugTrim: '#d4a853', metal: '#24292e', accent: '#d4a853', upholstery: '#cfc5b4', cushion: '#8c6239', lamp: '#ffe599', lampInt: 11.0 },
    island: { floorId: 'obsidian-gold-citadel', bg: '#090d12', fog: .016, base: '#06090d', wallBack: '#171b22', wallSide: '#12161c', trim: '#d4a64a', floorA: '#191d24', floorB: '#12151b', rug: '#181e29', rugTrim: '#d4a64a', metal: '#1d232b', accent: '#d4a64a', upholstery: '#1c1918', cushion: '#6b3419', lamp: '#ffe494', lampInt: 11.8 }
  };
  const cfg = THEMES[tier] || THEMES.shack;
  if (scene.background && typeof scene.background.set === 'function') scene.background.set(cfg.bg);
  if (scene.fog && scene.fog.color) { scene.fog.color.set(cfg.bg); scene.fog.density = cfg.fog; }

  const brickPbr = loadPhotoPbrSet('brick_wall_04', 2.8, 1.45);
  const concretePbr = loadPhotoPbrSet('concrete_floor_02', 3.0, 2.4);
  const woodMaps = woodPbrMaps(tier, cfg.floorA, cfg.floorB, 2.2, 2.2);
  const leatherMaps = leatherTuftMaps(tier, cfg.upholstery, 3.2, 1.3);
  const rugMaps = persianRugMaps(tier, cfg.rug, cfg.rugTrim);

  const bumpOpt = (maps, scale) => (maps && maps.bumpMap ? { bumpMap: maps.bumpMap, bumpScale: scale } : null);
  const fullMapsOpt = (maps, scale) => (maps && maps.map ? { ...maps, bumpScale: scale } : null);
  const useBrickBack = tier === 'apt';
  const wallBackMat = material(useBrickBack ? '#b89f93' : cfg.wallBack, tier === 'trailer' ? .48 : .06, tier === 'trailer' ? .44 : .84, useBrickBack && brickPbr.map ? { ...brickPbr, normalScale: new THREE.Vector2(.85, .85) } : (tier === 'shack' && concretePbr.map ? { ...concretePbr, normalScale: new THREE.Vector2(.55, .55) } : null));
  const wallSideMat = material(cfg.wallSide, tier === 'trailer' ? .44 : .06, tier === 'trailer' ? .46 : .86, tier === 'apt' && concretePbr.map ? { ...concretePbr, normalScale: new THREE.Vector2(.45, .45) } : null);
  const trimMat = material(cfg.trim, tier === 'island' || tier === 'house' ? .76 : .14, tier === 'island' || tier === 'house' ? .26 : .68, tier === 'shack' || tier === 'semi' || tier === 'trailer' ? bumpOpt(woodMaps, .015) : null);
  const metalMat = material(cfg.metal, .84, .32);
  const gunmetalMat = material('#22272c', .88, .28);
  const walnutStockMat = material('#5c331c', .08, .56, bumpOpt(woodMaps, .012));
  const accentMat = material(cfg.accent, .86, .24);
  const softMat = material(cfg.upholstery, .06, .64, fullMapsOpt(leatherMaps, .028));
  const cushionMat = material(cfg.cushion, .06, .68, bumpOpt(leatherMaps, .016));
  const darkMat = material(cfg.base, .18, .80, concretePbr.map ? { ...concretePbr } : null);

  // Foundation slab with real 1K pitted concrete normal/roughness
  box(group, [9.2, .18, 7.2], [0, -.1, 0], darkMat);

  // Distinct Architectural PBR Flooring per Property Tier (>85 physical meshes)
  if (tier === 'trailer' || tier === 'house') {
    const mA = tier === 'house' ? marblePbrMaps('carraraA', '#e2dcd0', '#8b857c', 1, 1) : null;
    const mB = tier === 'house' ? marblePbrMaps('carraraB', '#26252b', '#c9a658', 1, 1) : null;
    const tileA = material(cfg.floorA, tier === 'house' ? .14 : .06, tier === 'house' ? .16 : .58, fullMapsOpt(mA, .008));
    const tileB = material(cfg.floorB, tier === 'house' ? .18 : .08, tier === 'house' ? .20 : .62, fullMapsOpt(mB, .008));
    for (let ix = 0; ix < 8; ix++) {
      for (let iz = 0; iz < 6; iz++) {
        box(group, [1.06, .045, 1.08], [-3.75 + ix * 1.07, .012, -2.72 + iz * 1.09], (ix + iz) % 2 === 0 ? tileA : tileB);
      }
    }
  } else if (tier === 'villa' || tier === 'island') {
    const stA = marblePbrMaps(tier + 'A', cfg.floorA, tier === 'island' ? '#b88c38' : '#a89982', 1, 1);
    const stB = marblePbrMaps(tier + 'B', cfg.floorB, tier === 'island' ? '#64748b' : '#968770', 1, 1);
    const slabA = material(cfg.floorA, tier === 'island' ? .32 : .06, tier === 'island' ? .15 : .42, fullMapsOpt(stA, .01));
    const slabB = material(cfg.floorB, tier === 'island' ? .36 : .06, tier === 'island' ? .19 : .48, fullMapsOpt(stB, .01));
    for (let ix = 0; ix < 6; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        box(group, [1.42, .048, 1.32], [-3.65 + ix * 1.46, .012, -2.68 + iz * 1.34], (ix + iz) % 2 === 0 ? slabA : slabB);
      }
    }
    if (tier === 'island') {
      for (const zLine of [-2.0, 0, 2.0]) box(group, [8.6, .052, .038], [0, .016, zLine], accentMat);
      for (const xLine of [-2.9, 0, 2.9]) box(group, [.038, .052, 6.6], [xLine, .016, 0], accentMat);
    }
  } else {
    const plankA = material(cfg.floorA, .05, tier === 'apt' ? .42 : .78, fullMapsOpt(woodMaps, .018));
    const plankB = material(cfg.floorB, .05, tier === 'apt' ? .46 : .82, fullMapsOpt(woodMaps, .018));
    for (let x = -4.25, row = 0; x < 4.35; x += .35, row++) {
      box(group, [.335, .045, 6.65], [x, .01, 0], row % 2 === 0 ? plankA : plankB);
    }
  }

  // Woven Mafia Medallion Carpet
  const rug = box(group, [4.2, .022, 3.6], [-.25, .048, .52], material(rugMaps.map ? '#ffffff' : cfg.rug, .04, .88, fullMapsOpt(rugMaps, .022)));
  rug.receiveShadow = true;
  for (const x of [-2.34, 1.84]) box(group, [.055, .025, 3.56], [x, .056, .52], material(cfg.rugTrim, .55, .42));

  // Tier-Specific Noir-Mafia Structural Shell, Windows & Exterior Vistas
  if (tier === 'villa' || tier === 'island') {
    box(group, [3.1, 3.8, .24], [-3.0, 1.88, -3.32], wallBackMat);
    box(group, [.24, 3.8, 6.8], [-4.42, 1.88, 0], wallSideMat);
    const glassPane = material(tier === 'villa' ? '#8ab4c4' : '#334e68', .15, .06, { transparent: true, opacity: .18 });
    box(group, [5.65, 3.35, .04], [1.55, 1.76, -3.28], glassPane);
    const mullionMat = tier === 'villa' ? material('#3b2f26', .65, .38) : gunmetalMat;
    for (const gx of [-1.25, .62, 2.48, 4.35]) box(group, [.085, 3.6, .16], [gx, 1.82, -3.25], mullionMat);
    box(group, [8.9, .2, .34], [0, 3.66, -3.22], trimMat);

    // Realistic Reflective Coastal Water & Stone Terrace Beyond Glass
    const waterMat = material(tier === 'villa' ? '#0f3542' : '#081824', .82, .09, { emissive: tier === 'villa' ? '#082630' : '#040d14', emissiveIntensity: .35 });
    box(group, [10.4, .12, 4.2], [1.1, -.06, -5.5], waterMat);
    box(group, [6.2, .14, 1.18], [1.45, .01, -3.95], material(tier === 'villa' ? '#d4c6b0' : '#1b2028', .15, .52, { ...concretePbr }));
    // Terrace stone/steel guardrail
    box(group, [5.9, .06, .08], [1.45, .82, -4.48], mullionMat);
    for (let bx = -1.3; bx <= 4.2; bx += .92) box(group, [.07, .8, .07], [bx, .42, -4.48], mullionMat);

    if (tier === 'villa') {
      // Golden-hour Mediterranean horizon + Sculpted Curved-Frond Palm Tree
      const sunMat = material('#fbbf24', .05, .25, { emissive: '#ea580c', emissiveIntensity: 1.25 });
      cyl(group, .68, .68, .04, 28, [2.15, 2.15, -7.1], sunMat, [Math.PI / 2, 0, 0]);
      const trunkMat = material('#5c3c24', .04, .92, bumpOpt(woodMaps, .03));
      const frondMat = material('#22543d', .08, .58);
      for (let seg = 0; seg < 6; seg++) {
        cyl(group, .115 - seg * .009, .128 - seg * .009, .44, 12, [3.55 - seg * .045, .24 + seg * .39, -4.22], trunkMat, [0, 0, .11]);
      }
      const crownPos = [3.28, 2.52, -4.22];
      for (let f = 0; f < 7; f++) {
        const ang = (f / 7) * Math.PI * 2 + .25;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        box(group, [.46, .028, .16], [crownPos[0] + ca * .24, crownPos[1] + .05, crownPos[2] + sa * .24], frondMat);
        const mid = box(group, [.48, .024, .14], [crownPos[0] + ca * .64, crownPos[1] - .06, crownPos[2] + sa * .64], frondMat);
        mid.rotation.set(sa * .34, -ang, -ca * .34);
        const tip = box(group, [.42, .018, .09], [crownPos[0] + ca * .98, crownPos[1] - .26, crownPos[2] + sa * .98], frondMat);
        tip.rotation.set(sa * .68, -ang, -ca * .68);
      }
    } else {
      // Private Island Helipad ('H' Circle) + Dark Stealth Yacht + Obsidian & Brass Syndicate War Table
      cyl(group, 1.18, 1.25, .14, 28, [2.15, .04, -5.25], material('#1a2028', .35, .62, { ...concretePbr }));
      torus(group, 1.05, .035, 10, 32, [2.15, .12, -5.25], accentMat, [Math.PI / 2, 0, 0]);
      box(group, [.11, .025, .74], [1.88, .125, -5.25], accentMat);
      box(group, [.11, .025, .74], [2.42, .125, -5.25], accentMat);
      box(group, [.60, .025, .11], [2.15, .125, -5.25], accentMat);
      box(group, [1.95, .22, .46], [-.95, .11, -5.95], material('#1e242b', .65, .28));
      box(group, [.92, .18, .36], [-.85, .31, -5.95], material('#d4a64a', .45, .25, { emissive: '#92651b', emissiveIntensity: .45 }));
      // Obsidian & Brushed-Brass Tactical Syndicate War Table
      cyl(group, .72, .82, .54, 28, [-.45, .28, -.55], gunmetalMat);
      torus(group, .75, .032, 10, 36, [-.45, .56, -.55], accentMat, [Math.PI / 2, 0, 0]);
      cyl(group, .68, .68, .04, 28, [-.45, .57, -.55], material('#11161d', .5, .2));
      const amberHolo = material('#f59e0b', .25, .2, { transparent: true, opacity: .78, emissive: '#b45309', emissiveIntensity: .85 });
      box(group, [.20, .44, .20], [-.45, .80, -.55], amberHolo);
      box(group, [.13, .28, .13], [-.70, .72, -.48], accentMat);
      box(group, [.13, .34, .13], [-.20, .75, -.62], accentMat);
    }
  } else {
    // Solid Architectural Back & Left Walls
    box(group, [8.9, 3.7, .24], [0, 1.82, -3.32], wallBackMat);
    box(group, [.24, 3.7, 6.8], [-4.4, 1.82, 0], wallSideMat);
    box(group, [8.85, .26, .28], [0, .13, -3.18], trimMat);
    box(group, [.28, .26, 6.7], [-4.26, .13, 0], trimMat);
    box(group, [8.85, .15, .3], [0, 3.58, -3.16], trimMat);

    // Framed Noir Oil Canvas on Left Wall
    box(group, [.07, 1.08, 1.48], [-4.25, 2.05, -.45], trimMat);
    box(group, [.08, .92, 1.32], [-4.23, 2.05, -.45], material('#291d18', .08, .65, { ...rugMaps }));

    if (tier === 'shack') {
      for (const x of [-4.22, -1.1, 1.9, 4.22]) box(group, [.15, 3.65, .26], [x, 1.82, -3.16], trimMat);
      // Rusted corrugated patch + warm sodium dock window
      for (let c = 0; c < 6; c++) box(group, [.26, 1.08, .05], [-1.95 + c * .27, 2.22, -3.18], material(c % 2 ? '#593a2b' : '#473329', .62, .58));
      const dockGlass = material('#38494c', .25, .22, { emissive: '#593d1c', emissiveIntensity: .42 });
      box(group, [1.9, 1.05, .04], [1.05, 2.05, -3.19], dockGlass);
      for (const x of [.1, 1.05, 2.0]) box(group, [.06, 1.12, .1], [x, 2.05, -3.13], trimMat);
    } else if (tier === 'trailer') {
      // Riveted Brushed-Aluminum Airstream Ribs + Warm Sodium-Amber Noir Venetian Blinds
      const aluRib = material('#7b848f', .82, .32);
      for (const zRib of [-2.6, -.9, .8, 2.5]) box(group, [.11, 3.45, .13], [-4.25, 1.74, zRib], aluRib);
      for (const xRib of [-3.6, -1.2, 1.2, 3.6]) box(group, [.11, 3.45, .13], [xRib, 1.74, -3.16], aluRib);
      const amberBlind = material('#fbbf24', .2, .35, { emissive: '#b45309', emissiveIntensity: .75 });
      const slatMetal = material('#27272a', .7, .35);
      box(group, [2.4, 1.02, .05], [.85, 2.12, -3.19], amberBlind);
      for (let b = 0; b < 7; b++) {
        box(group, [2.36, .045, .09], [.85, 1.68 + b * .145, -3.13], slatMetal);
      }
    } else if (tier === 'apt') {
      // 1K Brick Loft + Riveted Steel I-Beams + Midnight City Skyline Window with Warm Office Lights
      for (const xCol of [-4.22, -.95, 4.22]) box(group, [.22, 3.7, .28], [xCol, 1.82, -3.15], gunmetalMat);
      const nightGlass = material('#142234', .3, .12, { emissive: '#0c1929', emissiveIntensity: .55 });
      box(group, [2.85, 1.68, .04], [1.05, 2.08, -3.19], nightGlass);
      const winGlow = material('#fde68a', .1, .2, { emissive: '#d97706', emissiveIntensity: .85 });
      for (let s = 0; s < 5; s++) {
        const sh = .58 + (s % 3) * .34;
        box(group, [.38, sh, .06], [.02 + s * .52, 1.26 + sh / 2, -3.15], material('#0b0f17', .4, .55));
        box(group, [.22, .05, .07], [.02 + s * .52, 1.46 + (s % 2) * .28, -3.13], winGlow);
      }
      for (const x of [-.38, 1.05, 2.48]) box(group, [.06, 1.74, .11], [x, 2.08, -3.12], gunmetalMat);
    } else if (tier === 'semi') {
      // Walnut Wainscoting + 1K Brick Fireplace Hearth & Glowing Logs
      box(group, [8.75, 1.15, .08], [0, .68, -3.18], trimMat);
      box(group, [.08, 1.15, 6.6], [-4.26, .68, 0], trimMat);
      const brickHearth = material('#8f5948', .06, .86, { ...brickPbr });
      box(group, [1.88, 1.58, .48], [-.45, .82, -2.98], brickHearth);
      box(group, [2.08, .15, .58], [-.45, 1.64, -2.95], trimMat);
      box(group, [.96, .82, .24], [-.45, .48, -2.76], darkMat);
      box(group, [.68, .18, .18], [-.45, .20, -2.72], material('#f97316', .08, .3, { emissive: '#ea580c', emissiveIntensity: 1.35 }));
      const fireLight = new THREE.PointLight('#fb923c', 4.5, 5.5, 2);
      fireLight.position.set(-.45, .45, -2.35);
      group.add(fireLight);
    } else if (tier === 'house') {
      // Fluted Classical Columns + Gilded Capitals + Leaded Manor Window + Brass Crystal Chandelier
      const marbleColMat = material('#dfd8cc', .12, .32);
      for (const xCol of [-4.1, -.95, .95, 4.1]) {
        cyl(group, .14, .16, 3.32, 18, [xCol, 1.78, -3.05], marbleColMat);
        box(group, [.40, .16, .40], [xCol, 3.48, -3.05], accentMat);
        box(group, [.42, .18, .42], [xCol, .12, -3.05], accentMat);
      }
      const manorGlass = material('#1e2638', .25, .14, { emissive: '#172033', emissiveIntensity: .55 });
      box(group, [1.48, 1.88, .05], [0, 2.05, -3.19], manorGlass);
      box(group, [.05, 1.88, .09], [0, 2.05, -3.14], accentMat);
      box(group, [1.48, .05, .09], [0, 2.05, -3.14], accentMat);
      cyl(group, .03, .03, .72, 12, [0, 3.35, -.2], accentMat);
      torus(group, .58, .032, 12, 32, [0, 2.98, -.2], accentMat, [Math.PI / 2, 0, 0]);
      const crystalMat = material('#fef3c7', .1, .08, { emissive: '#f59e0b', emissiveIntensity: 1.05 });
      for (let c = 0; c < 8; c++) {
        const ca = (c / 8) * Math.PI * 2;
        cyl(group, .035, .02, .18, 10, [Math.cos(ca) * .58, 3.07, -.2 + Math.sin(ca) * .58], crystalMat);
      }
    }
  }

  // === 1. ARMORY HOTSPOT (`rack`) — Multi-Part 3D Rifles, Shotgun, Pistols & Steel Ammo Crates ===
  box(rack, [1.82, 2.36, .54], [-3.2, 1.18, -2.56], tier === 'shack' || tier === 'semi' ? trimMat : gunmetalMat);
  box(rack, [1.60, 2.02, .10], [-3.2, 1.18, -2.26], darkMat);
  box(rack, [1.64, .14, .56], [-3.2, .12, -2.50], trimMat);
  box(rack, [1.64, .12, .58], [-3.2, 2.32, -2.50], trimMat);
  const warmRackStrip = material('#fde68a', .1, .2, { emissive: '#d97706', emissiveIntensity: .95 });
  box(rack, [1.48, .035, .09], [-3.2, 2.16, -2.16], warmRackStrip);

  // Sculpted vertical rifles & shotgun on rack (-3.78, -3.38, -2.98) + dual handguns (-2.60)
  const gunX = [-3.76, -3.36, -2.96];
  for (let gi = 0; gi < gunX.length; gi++) {
    const gx = gunX[gi];
    // Buttstock (walnut on AK/shotgun, polymer on carbine)
    box(rack, [.085, .36, .14], [gx, .58, -2.11], gi === 1 ? gunmetalMat : walnutStockMat);
    // Receiver body
    box(rack, [.075, .44, .15], [gx, .98, -2.10], gunmetalMat);
    // Rifled barrel + muzzle suppressor/brake
    cyl(rack, .018, .022, .74, 10, [gx, 1.56, -2.10], metalMat);
    cyl(rack, .028, .028, .14, 10, [gx, 1.94, -2.10], gunmetalMat);
    // Handguard + curved magazine / pump tube
    box(rack, [.068, .32, .11], [gx, 1.34, -2.10], gi === 0 ? walnutStockMat : trimMat);
    if (gi !== 2) {
      const mag = box(rack, [.048, .22, .08], [gx, .96, -1.97], gi === 0 ? accentMat : gunmetalMat);
      mag.rotation.x = .28;
    }
    // Brass barrel rest bracket
    box(rack, [.14, .04, .18], [gx, 1.24, -2.18], accentMat);
  }
  // Mounted sidearms on right side of armory board + olive-drab steel ammo crates on base shelf
  for (const py of [1.56, 1.12]) {
    box(rack, [.24, .075, .055], [-2.62, py, -2.12], gunmetalMat);
    box(rack, [.07, .14, .05], [-2.70, py - .08, -2.12], walnutStockMat);
  }
  const ammoMat = material('#36422e', .45, .58);
  for (const ax of [-3.62, -2.78]) {
    box(rack, [.42, .24, .28], [ax, .31, -2.10], ammoMat);
    box(rack, [.08, .12, .30], [ax, .33, -2.10], accentMat);
  }
  hotspots.set('armory', { position: new THREE.Vector3(-3.2, 1.9, -1.9), target: new THREE.Vector3(-2.8, 1.1, -1.6), camera: new THREE.Vector3(-.5, 2.6, 3.2) });

  // === 2. VAULT HOTSPOT (`vault`) — Heavy Bank-Grade Safe, 6-Spoke Brass Wheel, Steel Bolts & Bullion ===
  const vaultScaleH = tier === 'island' || tier === 'house' ? 1.86 : tier === 'shack' ? 1.18 : 1.54;
  const vaultY = vaultScaleH * .5 + .04;
  box(vault, [1.60, vaultScaleH, 1.20], [2.6, vaultY, -2.36], gunmetalMat);
  box(vault, [1.42, vaultScaleH - .14, .10], [2.6, vaultY, -1.73], accentMat);
  box(vault, [1.28, vaultScaleH - .26, .12], [2.6, vaultY, -1.64], material('#333b42', .88, .24));
  // Heavy chrome locking bolts & exterior hinges
  const chromeMat = material('#d4dce4', .95, .14);
  for (const by of [-.28, 0, .28]) box(vault, [.14, .055, .09], [3.20, vaultY + by * vaultScaleH * .65, -1.58], chromeMat);
  for (const hy of [-vaultScaleH * .32, vaultScaleH * .32]) cyl(vault, .055, .055, .24, 14, [1.94, vaultY + hy, -1.56], chromeMat);
  // 6-Spoke Turned Brass Combination Wheel + Center Boss
  cyl(vault, .11, .13, .10, 24, [2.36, vaultY + .14, -1.54], accentMat, [Math.PI / 2, 0, 0]);
  torus(vault, .23, .024, 12, 28, [2.36, vaultY + .14, -1.48], accentMat);
  for (let sp = 0; sp < 3; sp++) {
    cyl(vault, .014, .014, .44, 8, [2.36, vaultY + .14, -1.48], chromeMat, [0, 0, (sp / 3) * Math.PI]);
  }
  // Lever handle + Stacked 24K Gold Bullion & Banded Cash Stack on Top/Side Tray
  cyl(vault, .024, .024, .34, 10, [2.88, vaultY - .04, -1.48], chromeMat);
  const goldBarMat = material('#f5c451', .94, .18), cashMat = material('#3f6244', .08, .78);
  for (const gx of [2.22, 2.48, 2.35]) box(vault, [.21, .065, .11], [gx, vaultScaleH + .075 + (gx === 2.35 ? .065 : 0), -2.18], goldBarMat);
  for (const cy of [0, .065]) box(vault, [.26, .06, .15], [2.88, vaultScaleH + .072 + cy, -2.18], cashMat);
  box(vault, [.05, .13, .156], [2.88, vaultScaleH + .10, -2.18], material('#e5dec9', .05, .85));
  hotspots.set('vault', { position: new THREE.Vector3(2.6, 1.65, -1.48), target: new THREE.Vector3(2.5, .9, -2), camera: new THREE.Vector3(4.5, 2.7, 2.8) });

  // === 3. LOUNGE HOTSPOT (`lounge`) — Tufted Chesterfield Sofa, Rolled Bolsters, Bourbon Decanter & Humidor ===
  box(lounge, [2.68, .38, 1.20], [2.65, .28, 1.92], softMat);
  box(lounge, [2.72, .76, .28], [2.65, .78, 2.42], softMat);
  cyl(lounge, .14, .14, 2.74, 16, [2.65, 1.14, 2.40], softMat, [0, 0, Math.PI / 2]);
  for (const x of [1.34, 3.96]) {
    box(lounge, [.26, .56, 1.22], [x, .52, 1.92], softMat);
    cyl(lounge, .15, .15, 1.24, 16, [x, .80, 1.92], softMat, [Math.PI / 2, 0, 0]);
    cyl(lounge, .145, .145, .03, 16, [x, .80, 1.31], accentMat, [Math.PI / 2, 0, 0]);
  }
  for (const x of [1.85, 2.65, 3.45]) box(lounge, [.76, .17, .88], [x, .54, 1.88], cushionMat);
  for (const lx of [1.42, 3.88]) for (const lz of [1.42, 2.42]) cyl(lounge, .05, .035, .12, 10, [lx, .06, lz], trimMat);

  // Solid Walnut & Brass Coffee Table + Crystal Bourbon Decanter, Whiskey Glasses & Cigar Humidor
  box(lounge, [2.16, .38, .82], [2.62, .32, .68], trimMat);
  box(lounge, [2.26, .07, .90], [2.62, .55, .68], tier === 'island' || tier === 'house' ? material('#1c1917', .35, .18) : walnutStockMat);
  torus(lounge, .18, .016, 8, 24, [2.36, .60, .68], accentMat, [Math.PI / 2, 0, 0]);
  const bourbonMat = material('#b45309', .15, .12, { transparent: true, opacity: .86 });
  const crystalGlass = material('#f8fafc', .1, .06, { transparent: true, opacity: .52 });
  cyl(lounge, .085, .095, .20, 12, [2.36, .69, .68], bourbonMat);
  cyl(lounge, .032, .045, .09, 12, [2.36, .83, .68], crystalGlass);
  cyl(lounge, .042, .03, .05, 12, [2.36, .90, .68], accentMat);
  for (const gx of [2.18, 2.54]) cyl(lounge, .042, .038, .09, 12, [gx, .64, .74], bourbonMat);
  // Mahogany Cigar Humidor with Brass Clasp + Shaded Brass Floor Lamp
  box(lounge, [.34, .11, .24], [3.08, .64, .68], walnutStockMat);
  box(lounge, [.08, .04, .25], [3.08, .66, .68], accentMat);
  cyl(lounge, .18, .22, .05, 18, [4.08, .03, .95], accentMat);
  cyl(lounge, .024, .028, 1.78, 12, [4.08, .92, .95], accentMat);
  cyl(lounge, .18, .30, .34, 20, [4.08, 1.82, .95], material('#f5deb3', .05, .65, { emissive: '#d97706', emissiveIntensity: .65 }));
  hotspots.set('lounge', { position: new THREE.Vector3(2.55, 1.3, .65), target: new THREE.Vector3(2.65, .7, 1.2), camera: new THREE.Vector3(5.8, 3.5, 4.2) });

  // Executive Desk / Ledger Console & Warm Estate Lighting
  if (tier !== 'semi' && tier !== 'island') {
    box(group, [2.08, .09, .86], [-.55, .86, -2.28], walnutStockMat);
    for (const x of [-1.42, .32]) box(group, [.42, .82, .76], [x, .42, -2.28], trimMat);
    box(group, [.54, .03, .38], [-.55, .92, -2.18], material('#1e3a2f', .05, .75));
    // Classic Green-Shade Banker's Desk Lamp
    cyl(group, .08, .10, .03, 14, [-1.12, .92, -2.38], accentMat);
    cyl(group, .016, .016, .28, 10, [-1.12, 1.06, -2.38], accentMat);
    box(group, [.24, .09, .14], [-1.12, 1.21, -2.34], material('#15803d', .15, .28, { emissive: '#166534', emissiveIntensity: .75 }));
  }
  const lamp = new THREE.PointLight(cfg.lamp, cfg.lampInt, 11, 1.7);
  lamp.position.set(-.55, 2.48, -1.65);
  group.add(lamp);
  const loungeFill = new THREE.PointLight('#ffbe76', 4.8, 7.5, 1.9);
  loungeFill.position.set(3.85, 1.68, .95);
  group.add(loungeFill);
  box(group, [.52, .08, .34], [-.55, 2.58, -1.65], accentMat);

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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#15191a'); scene.fog = new THREE.FogExp2('#15191a', .022);
  if (typeof RoomEnvironment === 'function' && typeof THREE.PMREMGenerator === 'function') {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer), envScene = new RoomEnvironment(), envRT = pmrem.fromScene(envScene, .04);
      scene.environment = envRT.texture; scene.environmentIntensity = .78; owned.add(envRT); envScene.dispose?.(); pmrem.dispose();
    } catch {}
  }
  hemi = new THREE.HemisphereLight('#ded8ca', '#2d251c', 1.65); scene.add(hemi);
  key = new THREE.DirectionalLight('#ffe2b5', 3.05); key.position.set(1.6, 7.4, 5.4); key.castShadow = true;
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

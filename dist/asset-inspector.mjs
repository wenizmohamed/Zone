import * as THREE from '../lib/three184/three.module.js';
import { OrbitControls } from '../lib/three184/OrbitControls.js';
import { loadAsset, normalizeAssetObject, measureAssetObject, validateAssetTransform } from './asset-loader.mjs';
import { installViewerRuntime } from './viewer-runtime108.mjs';

const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const lang = query.get('lang') === 'ar' ? 'ar' : 'en', assetId = query.get('asset');
const arabic = lang === 'ar';
document.documentElement.lang = lang; document.documentElement.dir = arabic ? 'rtl' : 'ltr';
const labels = arabic ? { scale:'مضاعف الحجم', rotation:'الدوران / درجات', floor:'إزاحة الأرضية', camera:'إزاحة هدف الكاميرا', sourceBounds:'حجم المصدر', triangles:'المثلثات', members:'ملفات الحزمة' } : {};
for (const label of document.querySelectorAll('[data-label]')) if (labels[label.dataset.label]) label.textContent = labels[label.dataset.label];
if (arabic) {
  $('stage-tag').textContent = 'ستوديو / منضدة الأصول'; $('asset-name').textContent = 'معاينة الأصل المرفوع'; $('control-tag').textContent = 'بايتات الملف الأصلي محفوظة';
  $('control-title').textContent = 'اضبط المشهد.'; $('control-help').textContent = 'التمركز والأرضية تلقائيان. عدّل الموضع ثم احفظه في ستوديو.';
  $('fit').textContent = 'عرض كامل'; $('bounds-toggle').textContent = 'الحدود'; $('pivot-toggle').textContent = 'المحور'; $('normalize').textContent = 'إعادة الضبط والتمركز';
  $('apply').textContent = 'استخدام هذا الموضع'; $('measurement-title').textContent = 'قياسات النموذج'; $('retry').textContent = 'إعادة تحميل الأصل';
  $('status').textContent = 'اختر أصلاً مرفوعاً في ستوديو.';
}
let asset, renderer, scene, camera, controls, root, box, pivot, runtime, observer, disposed = false, transform = validateAssetTransform(), revision = 0;
const transfer = new AbortController();
let boundsVisible = true, pivotVisible = true;
const canvas = $('asset-canvas');
window.ZoneAssetInspector = { diagnostics: () => ({ assetId, lang, kind: asset?.kind || null, boundsVisible, pivotVisible, revision, disposed, mediaState: document.body.dataset.zoneMediaState || 'loading' }), isDisposed: () => disposed, isReady: () => document.body.dataset.zoneMediaState === 'ready' && !disposed, hasAsset: () => Boolean(asset) && !disposed };
function readControls() { return validateAssetTransform({ scale: $('scale').value, rotation: ['x','y','z'].map(axis => $('rotation-' + axis).value), floorOffset: $('floor').value, cameraTarget: ['x','y','z'].map(axis => $('camera-' + axis).value) }); }
function paintControls() {
  $('scale').value = transform.scale; $('floor').value = transform.floorOffset;
  ['x','y','z'].forEach((axis,index) => { $('rotation-' + axis).value = transform.rotation[index]; $('camera-' + axis).value = transform.cameraTarget[index]; });
}
function report(applied = false) {
  if (!asset) return;
  const payload = { type:'zone:asset-inspected', assetId, bounds: asset.bounds, transform, applied, revision: ++revision };
  parent.postMessage(payload, location.origin);
  document.body.dataset.zoneAssetInspection = JSON.stringify({ assetId, kind:asset.kind, bounds:asset.bounds, transform, applied, revision, immutableBytes:true });
}
function fit() {
  if (!root || !camera) return;
  const bounds = new THREE.Box3().setFromObject(root, true), size = bounds.getSize(new THREE.Vector3()), target = bounds.getCenter(new THREE.Vector3()).add(new THREE.Vector3(...transform.cameraTarget));
  const radius = size.length() / 2, vFov = THREE.MathUtils.degToRad(camera.fov), hFov = 2 * Math.atan(Math.tan(vFov/2) * Math.max(.2,camera.aspect));
  const distance = Math.max(.05, radius / Math.sin(Math.min(vFov,hFov)/2) * 1.18);
  camera.near = Math.max(.001,distance/1000); camera.far = Math.max(100,distance*100);
  camera.position.copy(target).add(new THREE.Vector3(.82,.52,1).normalize().multiplyScalar(distance)); camera.updateProjectionMatrix();
  controls.target.copy(target); controls.minDistance = Math.max(.01,distance*.08); controls.maxDistance = distance*10; controls.update();
}
function place({ frame = false, notify = true } = {}) {
  if (!asset?.object) return;
  if (root) { asset.object.removeFromParent(); scene.remove(root); }
  root = normalizeAssetObject(asset.object, transform, 3); scene.add(root);
  const measured = measureAssetObject(root); box.box.setFromObject(root, true); box.visible = boundsVisible;
  pivot.position.set(0,transform.floorOffset,0); pivot.visible = pivotVisible;
  $('readout').textContent = `${arabic ? 'المشهد' : 'SCENE'} ${measured.bounds.size.map(n=>n.toFixed(3)).join(' × ')}\n${arabic ? 'المحور' : 'PIVOT'} 0 / ${transform.floorOffset.toFixed(2)} / 0`;
  if (frame) fit(); if (notify) report();
}
function fail(error) {
  $('asset-loading').hidden = true; $('asset-error').hidden = false;
  $('error-text').textContent = (arabic ? 'تعذرت معاينة الأصل. ' : 'Asset preview could not load. ') + (error?.message || String(error));
  document.body.dataset.zoneAssetError = error?.message || String(error); document.body.dataset.zoneMediaState = 'error';
}
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#26322c');
  scene.add(new THREE.HemisphereLight('#e5e7dc','#536446',2.4));
  const light = new THREE.DirectionalLight('#ffe8b6',3.6); light.position.set(4,6,4); scene.add(light);
  const rim = new THREE.DirectionalLight('#92b9cc',1.9); rim.position.set(-4,3,-2); scene.add(rim);
  const grid = new THREE.GridHelper(12,24,'#7e8667','#414e41'); grid.material.transparent = true; grid.material.opacity = .6; scene.add(grid);
  box = new THREE.Box3Helper(new THREE.Box3(), '#dab56f'); scene.add(box);
  pivot = new THREE.AxesHelper(.65); pivot.material.depthTest = false; pivot.renderOrder = 3; scene.add(pivot);
  camera = new THREE.PerspectiveCamera(38,1,.01,1000); controls = new OrbitControls(camera,canvas); controls.enableDamping = true; controls.dampingFactor = .1;
  runtime = installViewerRuntime({ canvas, render() { controls.update(); renderer.render(scene,camera); }, fail });
  observer = new ResizeObserver(() => { const width=canvas.clientWidth || innerWidth,height=canvas.clientHeight || 360; renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); if(root)fit(); }); observer.observe(canvas);
  const width=canvas.clientWidth || innerWidth,height=canvas.clientHeight || 360; renderer.setSize(width,height,false);camera.aspect=width/height;
}
$('retry').addEventListener('click',()=>location.reload());
$('fit').addEventListener('click',fit);
$('bounds-toggle').addEventListener('click',()=>{boundsVisible=!boundsVisible;box && (box.visible=boundsVisible);$('bounds-toggle').setAttribute('aria-pressed',boundsVisible);});
$('pivot-toggle').addEventListener('click',()=>{pivotVisible=!pivotVisible;pivot && (pivot.visible=pivotVisible);$('pivot-toggle').setAttribute('aria-pressed',pivotVisible);});
$('normalize').addEventListener('click',()=>{transform=validateAssetTransform();paintControls();place({frame:true});});
$('transform-form').addEventListener('input',()=>{transform=readControls();place({frame:false});});
$('transform-form').addEventListener('change',()=>{transform=readControls();paintControls();place({frame:true});});
$('transform-form').addEventListener('submit',event=>{event.preventDefault();transform=readControls();place();report(true);$('placement-status').textContent=arabic?'أُرسل الموضع إلى ستوديو. احفظه هناك لتثبيته.':'Placement sent to Studio. Save there to persist it.';});
const onMessage = event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'zone:asset-transform' || event.data.assetId !== assetId) return;
  transform=validateAssetTransform(event.data.transform);paintControls();place({frame:true,notify:false});
};
addEventListener('message',onMessage);
addEventListener('pagehide',event=>{if(event.persisted||disposed)return;disposed=true;transfer.abort();removeEventListener('message',onMessage);observer?.disconnect();runtime?.dispose();controls?.dispose();box?.geometry.dispose();box?.material.dispose();pivot?.geometry.dispose();pivot?.material.dispose();
  scene?.traverse(object=>{if(object.isGridHelper){object.geometry.dispose();object.material.dispose();}});asset?.dispose();renderer?.dispose();});
if (/^[a-f0-9]{64}$/.test(assetId || '')) {
  try {
    $('status').textContent = arabic ? 'تحميل بايتات الأصل…' : 'Loading immutable asset bytes…';
    asset = await loadAsset(assetId,{draft:true,signal:transfer.signal,onProgress:progress=>{$('status').textContent=(arabic?'تحميل ':'Loading ')+progress.member+' '+Math.round(progress.loaded/Math.max(1,progress.total)*100)+'%';}});
    if (!disposed) {
      $('asset-name').textContent=asset.asset.name;transform=validateAssetTransform(asset.transform);paintControls();
      $('source-bounds').textContent=asset.bounds?.size?.map(n=>Number(n).toFixed(3)).join(' × ') || '-';
      $('triangle-count').textContent=String(asset.measurement?.triangles ?? asset.asset.metadata?.triangles ?? '-');
      $('member-count').textContent=String(asset.asset.members.length);$('warnings').textContent=(asset.asset.metadata?.warnings || []).join(' ');
      if (asset.object) {initRenderer();place({frame:true});runtime.start();}
      else {
        document.body.classList.add('media-only');const holder=$('media-view');holder.hidden=false;
        const media=document.createElement(asset.kind==='audio'?'audio':'img');media.src=asset.url;
        if(asset.kind==='audio'){media.controls=true;media.preload='metadata';}else{media.alt=asset.asset.name;await media.decode();}
        holder.append(media);document.body.dataset.zoneMediaState='ready';report();
      }
      $('asset-loading').hidden=true;
    }
  } catch(error) { fail(error); }
} else document.body.dataset.zoneMediaState='empty';

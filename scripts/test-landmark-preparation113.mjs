import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as Three from '../lib/three184/three.module.js';

const moduleUrl = new URL('../dist/district-landmarks.js', import.meta.url);
const source = readFileSync(moduleUrl, 'utf8').replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(moduleUrl.href)).replace('export async function createLandmarks', 'async function createLandmarks');
const vendor = readFileSync(new URL('../lib/three184/three.module.js', import.meta.url), 'utf8');
const propertyStart = vendor.indexOf('function WebGLProperties()'), propertyEnd = vendor.indexOf('function painterSortStable', propertyStart);
const asyncStart = vendor.indexOf('this.compileAsync = function ('), asyncEnd = vendor.indexOf('// Animation Loop', asyncStart);
assert.ok(propertyStart >= 0 && propertyEnd > propertyStart && asyncStart >= 0 && asyncEnd > asyncStart);
const makeProperties = new Function(vendor.slice(propertyStart, propertyEnd) + ';return WebGLProperties;')();
const ID = 'zone-authored-landmarks';
const pins = () => [{ id: 'bank', _lngLat: [-73.9865, 40.698],
  _buildingAssociation: { insideRoof: true, heightMeters: 20, clearanceMeters: 8, providerId: 'actual-bank' } }];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness({ ready = false, linked = true, drawFailure = false, drawShaderFailure = false } = {}) {
  const timers = new Map(), resources = [], renderers = [], layers = new Map([['native-provider', { id: 'native-provider' }]]), events = [];
  let next = 0;
  const schedule = (fn, ms, kind = 'application') => { const id = ++next; timers.set(id, { fn, ms, kind }); return id; };
  const cancel = id => timers.delete(id);
  const tick = predicate => { for (const [id, timer] of [...timers]) if (predicate(timer)) { timers.delete(id); timer.fn(); } };
  const state = { ready, linked, active: true };
  const gl = { LINK_STATUS: 35714, getProgramParameter: () => state.linked,
    getProgramInfoLog: () => 'isolated shader link failure', getShaderInfoLog: () => 'isolated shader failure' };
  const tracked = Base => class extends Base { constructor(...args) { super(...args); const item = { object: this, disposals: 0 };
    this.addEventListener('dispose', () => item.disposals++); resources.push(item); } };
  class Renderer {
    constructor(options) {
      this.options = options; this.properties = makeProperties(); this.draws = 0; this.disposals = 0;
      this.debug = { checkShaderErrors: false, onShaderError: null };
      this.info = { programs: [{ program: {}, isReady: () => state.ready }],
        render: { calls: 1, triangles: 12 }, memory: { geometries: 2, textures: 0 } };
      renderers.push(this);
    }
    resetState() { events.push('reset'); }
    initTexture() {}
    compile(scene) {
      const materials = new Set(); scene.traverse(object => { if (object.isMesh) materials.add(object.material); });
      for (const material of materials) {
        this.properties.get(material).currentProgram = this.info.programs[0];
        material.addEventListener('dispose', () => this.properties.remove(material));
      }
      return materials;
    }
    compileAsync(scene, camera) {
      const actual = new Function('properties', 'extensions', 'setTimeout', vendor.slice(asyncStart, asyncEnd) + ';return this.compileAsync;')
        .call(this, this.properties, { get: () => ({}) }, (fn, ms) => schedule(fn, ms, 'vendor'));
      return actual.call(this, scene, camera);
    }
    render(scene, camera) {
      if (drawFailure) throw Error('isolated landmark draw failure');
      if (drawShaderFailure) this.debug.onShaderError?.(gl, {}, {}, {});
      this.draws++; this.scene = scene; this.camera = camera; events.push('draw');
    }
    dispose() { this.disposals++; this.properties.dispose(); }
    forceContextLoss() { throw Error('The map owns the shared WebGL context.'); }
  }
  const THREE = { ...Three, WebGLRenderer: Renderer, BoxGeometry: tracked(Three.BoxGeometry),
    PlaneGeometry: tracked(Three.PlaneGeometry), MeshStandardMaterial: tracked(Three.MeshStandardMaterial), MeshBasicMaterial: tracked(Three.MeshBasicMaterial) };
  const document = { body: { dataset: {} } }, map = {
    repaints: 0, getLayer: id => layers.get(id), getCanvas: () => ({ shared: true }), getPitch: () => 35, getZoom: () => 17,
    addLayer(layer) { assert.ok(!layers.has(layer.id)); layers.set(layer.id, layer); layer.onAdd(map, gl); },
    removeLayer(id) { const layer = layers.get(id); layers.delete(id); layer?.onRemove(map, gl); }, triggerRepaint() { this.repaints++; },
  };
  const context = vm.createContext({ THREE, URL, console, document, performance: { now: () => 100 },
    setTimeout: schedule, clearTimeout: cancel,
    GLTFLoader: class { loadAsync() { throw Error('A provider-associated bank needs no substitute GLTF.'); } },
    mapboxgl: { MercatorCoordinate: { fromLngLat: ([lng, lat], z = 0) => ({ x: lng, y: lat, z, meterInMercatorCoordinateUnits: () => 1 }) } } });
  vm.runInContext(source + '\nglobalThis.create=createLandmarks;', context);
  return { create: context.create, state, gl, map, layers, timers, resources, renderers, document, events,
    poll: () => tick(timer => timer.kind === 'application' && timer.ms === 10),
    vendorPoll: () => tick(timer => timer.kind === 'vendor'), deadline: () => tick(timer => timer.ms > 10),
    assertReleased() { assert.ok(resources.length > 0); assert.ok(resources.every(item => item.disposals === 1)); assert.equal(renderers[0].disposals, 1); } };
}

test('actual landmark onRemove cancels preparation before vendored material-property disposal', async () => {
  const h = harness(), input = pins(), before = JSON.stringify(input);
  let settled = false;
  const pending = h.create(h.map, input, () => h.state.active).then(value => { settled = true; return value; });
  await flush(); const retired = h.layers.get(ID); assert.ok(retired);
  h.map.removeLayer(ID);
  assert.doesNotThrow(() => h.vendorPoll(), 'No surviving actual vendor timer may inspect disposed currentProgram.');
  await flush(); assert.equal(settled, true, 'The real creation promise must settle immediately on removal.');
  const control = await pending;
  assert.equal(control.diagnostics.status, 'disposed'); assert.equal(h.timers.size, 0); h.assertReleased();
  h.map.getLayer = () => { throw Error('A removed map must not be queried.'); };
  h.state.ready = true; h.vendorPoll(); h.poll(); retired.render(h.gl, new Three.Matrix4().toArray());
  control.setVisible(true); control.dispose();
  assert.equal(h.renderers[0].draws, 0); assert.equal(h.map.repaints, 0); assert.equal(JSON.stringify(input), before);
});

test('successful landmark readiness checks real program completion and link status before the first draw', async () => {
  const h = harness({ ready: true }), input = pins(), before = JSON.stringify(input), task = h.create(h.map, input);
  await flush(); const layer = h.layers.get(ID), renderer = h.renderers[0];
  assert.equal(h.document.body.dataset.zoneDistrictLandmarks.includes('preparing'), true);
  assert.equal(h.timers.size, 2); assert.ok([...h.timers.values()].some(timer => timer.ms === 12000));
  assert.equal([...h.timers.values()].filter(timer => timer.kind === 'vendor').length, 0);
  layer.render(h.gl, new Three.Matrix4().toArray()); assert.equal(renderer.draws, 0);
  h.poll(); const control = await task;
  assert.equal(control.diagnostics.status, 'ready'); assert.equal(control.diagnostics.shaderLinked, true);
  assert.equal(control.diagnostics.shaderPrograms, 1); assert.equal(control.diagnostics.firstFrameRendered, false);
  assert.equal(h.timers.size, 0); assert.equal(h.map.repaints, 1);
  layer.render(h.gl, new Three.Matrix4().toArray());
  assert.equal(renderer.draws, 1); assert.equal(control.diagnostics.firstFrameRendered, true);
  assert.equal(control.diagnostics.landmarks[0].heightMeters, 20.6);
  assert.equal(control.diagnostics.landmarks[0].symbolOffset, 2);
  assert.equal(control.diagnostics.landmarks[0].providerId, 'actual-bank');
  assert.equal(JSON.stringify(input), before); control.dispose(); h.assertReleased();
});

test('a completed but unlinked actual program rejects preparation and preserves native map layers', async () => {
  const h = harness({ ready: true, linked: false }), task = h.create(h.map, pins());
  const rejected = assert.rejects(task, /Landmark shader link failed.*isolated shader link failure/s);
  await flush(); h.poll(); await rejected;
  assert.deepEqual([...h.layers.keys()], ['native-provider']); assert.equal(h.timers.size, 0);
  const diagnostics = JSON.parse(h.document.body.dataset.zoneDistrictLandmarks);
  assert.equal(diagnostics.status, 'failed'); assert.equal(diagnostics.shaderLinked, false);
  assert.equal(diagnostics.firstFrameRendered, false); assert.equal(h.map.repaints, 0); h.assertReleased();
});

test('stalled preparation has a finite twelve-second deadline and leaves no timers or stale render', async () => {
  const h = harness(), task = h.create(h.map, pins());
  const rejected = assert.rejects(task, /Landmark preparation timed out/);
  await flush(); assert.ok([...h.timers.values()].some(timer => timer.ms === 12000));
  const retired = h.layers.get(ID); h.poll(); assert.equal(h.renderers[0].draws, 0);
  h.deadline(); await rejected;
  assert.equal(h.timers.size, 0); assert.deepEqual([...h.layers.keys()], ['native-provider']);
  assert.equal(JSON.parse(h.document.body.dataset.zoneDistrictLandmarks).status, 'failed'); h.assertReleased();
  h.state.ready = true; h.vendorPoll(); h.poll(); retired.render(h.gl, new Three.Matrix4().toArray());
  assert.equal(h.renderers[0].draws, 0); assert.equal(h.map.repaints, 0);
});

test('pending inactive generation settles as disposed instead of rendering or keeping replacement blocked', async () => {
  const h = harness(), task = h.create(h.map, pins(), () => h.state.active);
  await flush(); h.state.active = false; h.poll(); const control = await task;
  assert.equal(control.diagnostics.status, 'disposed'); assert.equal(h.timers.size, 0);
  assert.deepEqual([...h.layers.keys()], ['native-provider']); h.assertReleased();
  assert.equal(h.renderers[0].draws, 0); assert.equal(h.map.repaints, 0);
});

test('actual pending style removal permits immediate serial replacement without an old controller removing it', async () => {
  const h = harness(), oldTask = h.create(h.map, pins());
  await flush(); h.map.removeLayer(ID); await flush(); const old = await oldTask;
  assert.equal(old.diagnostics.status, 'disposed'); assert.equal(h.timers.size, 0);
  h.state.ready = true; const replacementTask = h.create(h.map, pins());
  await flush(); h.poll(); const current = await replacementTask, layer = h.layers.get(ID);
  old.dispose(); old.setVisible(true); h.vendorPoll();
  assert.equal(h.layers.get(ID), layer); assert.equal(current.diagnostics.status, 'ready');
  assert.equal(JSON.parse(h.document.body.dataset.zoneDistrictLandmarks).status, 'ready');
  layer.render(h.gl, new Three.Matrix4().toArray()); assert.equal(h.renderers[0].draws, 0); assert.equal(h.renderers[1].draws, 1);
  current.dispose(); assert.ok(h.resources.every(item => item.disposals === 1));
  assert.ok(h.renderers.every(renderer => renderer.disposals === 1)); assert.equal(h.timers.size, 0);
});

test('first-use shader diagnostics and draw exceptions reset shared state and remove only their own landmarks', async () => {
  for (const options of [{ ready: true, drawShaderFailure: true }, { ready: true, drawFailure: true }]) {
    const h = harness(options), task = h.create(h.map, pins()); await flush(); h.poll(); const control = await task;
    const layer = h.layers.get(ID);
    assert.doesNotThrow(() => layer.render(h.gl, new Three.Matrix4().toArray()));
    assert.equal(control.diagnostics.status, 'failed'); assert.equal(control.diagnostics.firstFrameRendered, false);
    assert.match(control.diagnostics.error, options.drawShaderFailure ? /Landmark shader link failed/ : /draw failure/);
    assert.deepEqual([...h.layers.keys()], ['native-provider']); assert.equal(h.events.at(-1), 'reset');
    assert.equal(h.timers.size, 0); h.assertReleased(); control.dispose(); h.assertReleased();
  }
});

test('invalid preparation deadlines reject before allocations and the active path never invokes vendor async polling', async () => {
  for (const prepareTimeoutMs of [0, -1, NaN, Infinity, 30001, 1.5, '12000']) {
    const h = harness();
    await assert.rejects(h.create(h.map, pins(), () => true, { prepareTimeoutMs }), /Landmark preparation timeout/);
    assert.equal(h.resources.length, 0); assert.equal(h.renderers.length, 0); assert.equal(h.timers.size, 0);
  }
  assert.doesNotMatch(source, /\.compileAsync\s*\??\s*\(/);
  assert.match(source, /renderer\.compile\(scene,camera\)/);
});

test('first-draw landmark failure immediately exposes the shared recovery notice in EN and AR', async () => {
  for (const lang of ['en', 'ar']) {
    const h = harness({ ready: true, drawShaderFailure: true }), notice = { hidden: true }, message = { textContent: '' };
    h.document.documentElement = { lang };
    h.document.getElementById = id => id === 'districtSurfaceStatus111' ? notice : message;
    h.document.body.dataset.zoneDistrictSurfaces = JSON.stringify({ status: 'ready' });
    const task = h.create(h.map, pins()); await flush(); h.poll(); const control = await task;
    assert.equal(notice.hidden, true);
    h.layers.get(ID).render(h.gl, new Three.Matrix4().toArray());
    assert.equal(control.diagnostics.status, 'failed');
    assert.equal(notice.hidden, false, 'A sign failure must not wait for another facade or map frame to expose Retry.');
    assert.equal(message.textContent, lang === 'ar'
      ? 'تعذر عرض بعض تفاصيل المباني. الخريطة وأدواتها ما زالت متاحة.'
      : 'Some building detail could not render. The map and its controls remain available.');
    h.assertReleased();
  }
});

test('ready landmark publication cannot hide another producer failure and hides recovery only when both are ready', async () => {
  const h = harness({ ready: true }), notice = { hidden: false }, message = { textContent: '' };
  h.document.documentElement = { lang: 'en' };
  h.document.getElementById = id => id === 'districtSurfaceStatus111' ? notice : message;
  h.document.body.dataset.zoneDistrictSurfaces = JSON.stringify({ status: 'error' });
  const task = h.create(h.map, pins()); await flush(); h.poll(); const control = await task, layer = h.layers.get(ID);
  assert.equal(control.diagnostics.status, 'ready'); assert.equal(notice.hidden, false);
  layer.render(h.gl, new Three.Matrix4().toArray()); assert.equal(notice.hidden, false);
  h.document.body.dataset.zoneDistrictSurfaces = JSON.stringify({ status: 'ready' });
  layer.render(h.gl, new Three.Matrix4().toArray()); assert.equal(notice.hidden, true);
  control.dispose(); h.assertReleased();
});

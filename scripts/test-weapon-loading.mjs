import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { createWeaponAssetLoader, inspectWeaponObject, WEAPON_LOAD_TIMEOUT_MS } from '../dist/weapon-assets.js';

const html = readFileSync(new URL('../dist/weapon3d.html', import.meta.url), 'utf8');
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
function definition(name, next) {
  const start = template.indexOf('function ' + name + '(');
  const end = template.indexOf(next, start);
  assert.ok(start >= 0 && end > start);
  return template.slice(start, end);
}

test('boot selects only the URL item and an unselected viewer performs zero model loads', () => {
  const boot = template.match(/if \(q.get\('item'\)\) show\(q.get\('item'\)\); else itemStatus\('idle'\);/);
  assert.ok(boot, 'initial selection must come from the parent URL');
  assert.doesNotMatch(template, /show\(q.get\('item'\) \|\| 'revolver'\)/);
  for (const item of [null, '', 'bat', 'sniperrifle_2']) {
    const calls = [], states = [];
    const ctx = vm.createContext({ q: new URLSearchParams(item ? { item } : {}), show: value => calls.push(value), itemStatus: state => states.push(state) });
    vm.runInContext(boot[0], ctx);
    assert.deepEqual(calls, item ? [item] : []);
    assert.deepEqual(states, item ? [] : ['idle']);
  }
});

test('only the actual same-origin parent can change the item, language, or backdrop', () => {
  const parent = {}, calls = [], states = [], backgrounds = [];
  const ctx = vm.createContext({ parent, location: { origin: 'http://zone.test' }, stage: { dataset: {}, setLanguage: lang => calls.push('language:' + lang) },
    document: { documentElement: {} }, show: item => calls.push(item), itemStatus: state => states.push(state), bg: color => backgrounds.push(color) });
  vm.runInContext(definition('onItemMessage', "addEventListener('message'"), ctx);
  const data = { item: 'bat', lang: 'ar', bg: '#16181b' };
  for (const event of [{ source: {}, origin: 'http://zone.test', data }, { source: parent, origin: 'https://other.test', data }, { source: parent, origin: 'http://zone.test', data: null }]) ctx.onItemMessage(event);
  assert.deepEqual(calls, []); assert.deepEqual(backgrounds, []);
  ctx.onItemMessage({ source: parent, origin: 'http://zone.test', data });
  assert.deepEqual(calls, ['language:ar', 'bat']); assert.deepEqual(backgrounds, ['#16181b']);
  assert.equal(ctx.document.documentElement.dir, 'rtl');
  ctx.stage._zoneDisposed = true; ctx.onItemMessage({ source: parent, origin: 'http://zone.test', data });
  assert.equal(calls.length, 2);
});

test('loading remains visible and the failed current selection has a real bilingual retry button', () => {
  const retryButton = { hidden: true }, qualityBadge = { hidden: false }, attributes = {}, enabled = [], states = [];
  const stage = { dataset: { zoneRequestedKey: 'knife' }, _err: { style: {} }, setAssetStatus: state => states.push(state),
    setAttribute: (name, value) => { attributes[name] = value; }, _setButtonsEnabled: state => enabled.push(state) };
  const ctx = vm.createContext({ stage, retryButton, qualityBadge, shownObject: {}, document: { documentElement: { lang: 'en' } } });
  vm.runInContext(definition('itemStatus', 'async function show('), ctx);
  ctx.itemStatus('loading'); assert.equal(attributes['aria-busy'], 'true'); assert.equal(retryButton.hidden, true); assert.equal(enabled.at(-1), false);
  ctx.itemStatus('error'); assert.equal(retryButton.hidden, false); assert.equal(retryButton.textContent, 'Retry'); assert.match(stage._err.textContent, /Press Retry/); assert.equal(attributes['aria-busy'], 'false');
  ctx.document.documentElement.lang = 'ar'; ctx.itemStatus('error'); assert.equal(retryButton.textContent, 'إعادة المحاولة');
  ctx.itemStatus('ready'); assert.equal(retryButton.hidden, true); assert.equal(enabled.at(-1), true);
  assert.equal(qualityBadge.hidden, false);
  assert.match(template, /retryButton.addEventListener\('click', \(\) => \{ if \(stage.dataset.zoneRequestedKey\) show\(stage.dataset.zoneRequestedKey\); \}\)/);
  assert.match(html, /__bundler\/manifest/); assert.match(template, /removeEventListener\('message', onItemMessage\)/);
});

function fixture(label) {
  const counts = { geometry: 0, material: 0, texture: 0, image: 0 };
  const texture = new THREE.Texture({ close: () => counts.image++ });
  const geometry = new THREE.BoxGeometry(.1, .2, .3), material = new THREE.MeshStandardMaterial({ map: texture });
  for (const [name, value] of [['geometry', geometry], ['material', material], ['texture', texture]]) value.addEventListener('dispose', () => counts[name]++);
  const scene = new THREE.Group(); scene.name = label; scene.add(new THREE.Mesh(geometry, material));
  return { scene, counts };
}

function stickyViewer(loader, language) {
  const parent = {}, requests = [], attributes = {}, retryButton = { hidden: true, addEventListener(_name, callback) { this.click = callback; } };
  const qualityBadge = { hidden: false, textContent: 'DETAILED MODEL / CC0', title: '3DModelsCC0 / CC0' };
  const previous = new THREE.Group(); previous.name = 'zone_sniper';
  const stage = { dataset: { zoneRequestedKey: 'sniper', zoneAssetState: 'ready', zoneAsset: JSON.stringify({ key: 'sniper', source: { id: 'old-sniper' } }) },
    _err: { style: {} }, setAssetStatus() {}, setLanguage() {}, setAttribute: (name, value) => { attributes[name] = value; }, _setButtonsEnabled() {}, setObject: root => requests.push(root.name) };
  const ctx = vm.createContext({ THREE, parent, location: { origin: 'http://zone.test' }, stage, retryButton, qualityBadge,
    document: { documentElement: { lang: language } }, WCAT: { knife: {}, bat: {} }, MODELS: {}, ALIAS: {},
    current: 'sniper', showSeq: 0, shownObject: previous, pendingKey: null, pendingShow: null, assetLoader: loader,
    inspectAsset: inspectWeaponObject, disposeItem: root => loader.release(root), loadGun: () => assert.fail('Detailed sources must retain their original artwork'),
    bg() {}, console: { error() {} }, assetLabel: (descriptor, lang) => `${descriptor?.id}/${lang}`, positionAssetQuality() {} });
  const showStart = template.indexOf('async function show('), showEnd = template.indexOf('function bg(', showStart);
  const click = template.match(/retryButton.addEventListener\('click',[^\n]+/)[0];
  vm.runInContext([definition('itemStatus', 'async function show('), template.slice(showStart, showEnd),
    definition('paintAssetQuality', 'function watchAssetQuality('), definition('onItemMessage', "addEventListener('message'"), click].join('\n'), ctx);
  const message = (item, lang = language) => ctx.onItemMessage({ source: parent, origin: 'http://zone.test', data: { item, lang, bg: '#16181b' } });
  return { ctx, stage, retryButton, qualityBadge, attributes, message, requests };
}

for (const outcome of ['stalled', 'rejected']) for (const language of ['en', 'ar']) {
  test(`${outcome} ${language} selection stays failed through parent heartbeats until explicit Retry`, async () => {
    let calls = 0;
    const loader = createWeaponAssetLoader({ THREE, loadTimeoutMs: 15, GLTFLoader: class {
      loadAsync() {
        if (++calls === 1) return outcome === 'stalled' ? new Promise(() => {}) : Promise.reject(new Error('Source is unavailable'));
        return Promise.resolve({ scene: fixture('retry-original-knife').scene });
      }
    } });
    const view = stickyViewer(loader, language), loading = view.ctx.show('knife');
    assert.equal(view.qualityBadge.hidden, true, 'previous Sniper attribution must hide as soon as Knife starts loading');
    for (let count = 0; count < 10; count++) view.message('knife');
    await loading;
    const initialError = view.stage.dataset.zoneAssetError;
    assert.equal(JSON.parse(initialError).code, outcome === 'stalled' ? 'asset-timeout' : 'asset-load-failed');
    for (let count = 0; count < 20; count++) {
      const lang = count % 2 ? 'ar' : 'en'; view.message('knife', lang); view.ctx.paintAssetQuality();
      assert.equal(view.stage.dataset.zoneAssetState, 'error'); assert.equal(view.stage.dataset.zoneAssetError, initialError);
      assert.equal(view.retryButton.hidden, false); assert.equal(view.retryButton.textContent, lang === 'ar' ? 'إعادة المحاولة' : 'Retry');
      assert.equal(view.attributes['aria-busy'], 'false'); assert.equal(view.qualityBadge.hidden, true);
    }
    assert.equal(calls, 1, 'parent rerenders must not restart the rejected or timed-out source');
    view.retryButton.click(); await view.ctx.pendingShow;
    assert.equal(calls, 2); assert.equal(view.stage.dataset.zoneAssetState, 'ready'); assert.equal(view.retryButton.hidden, true);
    assert.equal(JSON.parse(view.stage.dataset.zoneAsset).key, 'knife');
    view.ctx.paintAssetQuality(); assert.equal(view.qualityBadge.hidden, false); assert.match(view.qualityBadge.textContent, /^m9-knife\//);
    for (let count = 0; count < 10; count++) view.message('knife');
    assert.equal(calls, 2, 'successful same-selection heartbeats reuse the displayed asset');
    loader.release(view.ctx.shownObject); await loader.dispose();
  });
}

test('a different parent selection can leave a sticky failed selection without automatic retrying the failed source', async () => {
  const loaded = [];
  const loader = createWeaponAssetLoader({ THREE, GLTFLoader: class { loadAsync(url) {
    loaded.push(url);
    return url.includes('m9-knife') ? Promise.reject(new Error('Selected Knife unavailable')) : Promise.resolve({ scene: fixture('original-bat').scene });
  } } });
  const view = stickyViewer(loader, 'en'); await view.ctx.show('knife'); view.message('knife');
  assert.equal(loaded.length, 1); assert.equal(view.stage.dataset.zoneAssetState, 'error');
  view.message('bat', 'ar'); assert.equal(view.stage.dataset.zoneAssetState, 'loading'); assert.equal(view.qualityBadge.hidden, true);
  await view.ctx.pendingShow;
  assert.equal(loaded.length, 2); assert.match(loaded[1], /wooden-bat\/baseball_bat\.glb$/);
  assert.equal(view.stage.dataset.zoneAssetState, 'ready'); assert.equal(JSON.parse(view.stage.dataset.zoneAsset).key, 'bat');
  view.ctx.paintAssetQuality(); assert.match(view.qualityBadge.textContent, /^old-wooden-bat\/ar$/); assert.equal(view.qualityBadge.hidden, false);
  loader.release(view.ctx.shownObject); await loader.dispose();
});

test('a stalled original asset has a finite deadline, no artwork substitution, and a retriable cache entry', async () => {
  assert.equal(WEAPON_LOAD_TIMEOUT_MS, 15000);
  let requests = 0, finishLate, fallbackRequests = 0;
  const late = fixture('timed-out-original'), fresh = fixture('retry-original');
  const loader = createWeaponAssetLoader({ THREE, loadTimeoutMs: 25, catalog: { revolver: { file: 'Revolver_1', scale: .15 } },
    GLTFLoader: class { loadAsync() { return ++requests === 1 ? new Promise(resolve => { finishLate = resolve; }) : Promise.resolve({ scene: fresh.scene }); } },
    MTLLoader: class { loadAsync() { fallbackRequests++; throw new Error('must not substitute timeout artwork'); } } });
  const first = loader.load('revolver'), duplicate = loader.load('revolver');
  const failures = await Promise.allSettled([first, duplicate]);
  for (const result of failures) { assert.equal(result.status, 'rejected'); assert.equal(result.reason.code, 'asset-timeout'); assert.equal(result.reason.timeoutMs, 25); }
  assert.equal(requests, 1); assert.equal(fallbackRequests, 0);
  const retried = await loader.load('revolver'); assert.equal(requests, 2); assert.equal(retried.userData.zoneWeaponAsset.id, 'detective-special');
  finishLate({ scene: late.scene }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(late.counts, { geometry: 1, material: 1, texture: 1, image: 1 });
  const reused = await loader.load('revolver'); assert.equal(requests, 2, 'late success must neither replace nor evict the successful retry');
  assert.deepEqual(fresh.counts, { geometry: 0, material: 0, texture: 0, image: 0 });
  loader.release(retried); loader.release(reused); await loader.dispose();
  assert.deepEqual(fresh.counts, { geometry: 1, material: 1, texture: 1, image: 1 });
});

test('viewer teardown is bounded even when a request never responds, and late source ownership is released', async () => {
  let finish;
  const late = fixture('disposed-late-original');
  const loader = createWeaponAssetLoader({ THREE, loadTimeoutMs: 20, GLTFLoader: class { loadAsync() { return new Promise(resolve => { finish = resolve; }); } } });
  const selection = loader.load('bat'); await loader.dispose(); assert.equal(await selection, null);
  finish({ scene: late.scene }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(late.counts, { geometry: 1, material: 1, texture: 1, image: 1 });
  await assert.rejects(loader.load('bat'), /disposed/);
});

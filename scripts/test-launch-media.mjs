import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const viewer = name => {
  const html = readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8');
  return { html, template: JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]) };
};
const character = viewer('character3d');
function definition(source, name) {
  const start = source.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `Missing shipped function ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = open; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error(`Unclosed shipped function ${name}`);
}
function timers() {
  let next = 0;
  const pending = new Map();
  return { pending, setTimeout(fn, ms) { pending.set(++next, { fn, ms }); return next; }, clearTimeout(id) { pending.delete(id); }, expire() { for (const [id, timer] of [...pending]) { pending.delete(id); timer.fn(); } } };
}
function wardrobeContext(loadAsync) {
  const clock = timers(), released = [];
  const ctx = vm.createContext({ ...clock, characterCache: new Map(), GLTFLoader: class { loadAsync(path) { return loadAsync(path); } }, disposeCharacterResources: scenes => released.push(...scenes) });
  vm.runInContext(definition(character.template, 'characterRequest'), ctx);
  return { ctx, clock, released };
}

test('stalled character uses one bounded request and late geometry cannot replace a successful retry', async () => {
  let calls = 0, complete;
  const oldScene = {}, newScene = {};
  const { ctx, clock, released } = wardrobeContext(() => ++calls === 1 ? new Promise(resolve => { complete = resolve; }) : Promise.resolve({ scene: newScene }));
  const first = ctx.characterRequest('Suit'), duplicate = ctx.characterRequest('Suit');
  assert.equal(first, duplicate); await Promise.resolve(); assert.equal(calls, 1);
  assert.equal([...clock.pending.values()][0].ms, 15000);
  const failure = assert.rejects(first, error => error.code === 'asset-timeout' && error.timeoutMs === 15000);
  clock.expire(); await failure; assert.equal(ctx.characterCache.has('Suit'), false);
  const retried = await ctx.characterRequest('Suit'); assert.equal(calls, 2); assert.equal(retried.scene, newScene);
  complete({ scene: oldScene }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(released, [oldScene]); assert.equal((await ctx.characterRequest('Suit')).scene, newScene);
  assert.equal(clock.pending.size, 0); assert.equal(calls, 2);
});

test('teardown before the deferred wardrobe load begins does not start a dead viewer request', async () => {
  let calls = 0;
  const { ctx, clock } = wardrobeContext(() => { calls++; return new Promise(() => {}); });
  const request = ctx.characterRequest('Suit');
  const failure = assert.rejects(request, error => error.code === 'asset-cancelled');
  request.cancel(); await failure;
  assert.equal(calls, 0); assert.equal(clock.pending.size, 0);
});

test('character teardown cancels an unresolved request immediately and owns late source disposal once', async () => {
  let complete;
  const scene = {};
  const { ctx, clock, released } = wardrobeContext(() => new Promise(resolve => { complete = resolve; }));
  const request = ctx.characterRequest('Swat'); await Promise.resolve();
  const failure = assert.rejects(request, error => error.code === 'asset-cancelled');
  request.cancel(); request.cancel(); await failure;
  assert.equal(clock.pending.size, 0); assert.equal(ctx.characterCache.size, 0);
  complete({ scene }); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(released, [scene]);
  assert.match(character.template, /for \(const request of pending\) request.cancel\?\.\(\)/);
});

for (const language of ['en', 'ar']) {
  test(`${language} failed wardrobe ignores unchanged and unrelated-state heartbeats until actual retry or different outfit`, async () => {
    let requests = 0;
    const clock = timers(), nodes = { load: { hidden: true }, 'character-retry': { hidden: true } };
    const ctx = vm.createContext({ ...clock, characterCache: new Map(), characterLoadSeq: 0, characterLoadingFile: null,
      state: { outfit: 'suit', fac: 'none' }, model: null, lang: language, document: { body: { dataset: {} } }, $: id => nodes[id],
      OUTFIT_FILES: { suit: 'Suit', street: 'Casual_Hoodie', tactical: 'Swat' },
      GLTFLoader: class { loadAsync() { requests++; return Promise.reject(new Error('missing model')); } },
      disposeCharacterResources() {}, console: { error() {} } });
    vm.runInContext(['outfitFile', 'characterRequest', 'paintOutfit', 'loadCharacter'].map(name => definition(character.template, name)).join('\n'), ctx);
    await ctx.loadCharacter(); assert.equal(requests, 1);
    assert.equal(ctx.document.body.dataset.zoneCharacterAssetState, 'error'); assert.equal(nodes['character-retry'].hidden, false);
    assert.match(nodes.load.textContent, language === 'ar' ? /يمكنك مواصلة اللعب/ : /You can keep playing/);
    for (let i = 0; i < 25; i++) { ctx.state.fac = i % 2 ? 'vipers' : 'none'; ctx.paintOutfit(); }
    assert.equal(requests, 1, 'resource, faction or language heartbeats must not reload the failed rig');
    vm.runInContext(character.template.match(/\$\('character-retry'\)\.onclick = \(\) => loadCharacter\(\);/)[0], ctx);
    await nodes['character-retry'].onclick(); assert.equal(requests, 2);
    ctx.state.outfit = 'street'; ctx.paintOutfit(); await Promise.resolve(); await Promise.resolve();
    assert.equal(requests, 3, 'a distinct user-selected outfit remains usable');
    // Drain the independently rejected selection, not an arbitrary wall-clock delay.
    await Promise.allSettled([...ctx.characterCache.values()]);
    assert.equal(clock.pending.size, 0);
  });
}

test('loading character deduplicates parent repaint without advancing the active wardrobe sequence', () => {
  let calls = 0;
  const ctx = vm.createContext({ state: { outfit: 'suit' }, model: null, characterLoadingFile: 'Suit', characterLoadSeq: 3,
    document: { body: { dataset: { zoneCharacterAssetState: 'loading' } } }, OUTFIT_FILES: { suit: 'Suit' }, loadCharacter() { calls++; } });
  vm.runInContext(['outfitFile', 'paintOutfit'].map(name => definition(character.template, name)).join('\n'), ctx);
  for (let i = 0; i < 25; i++) ctx.paintOutfit();
  assert.equal(calls, 0); assert.equal(ctx.characterLoadSeq, 3);
});

function fallbackContext(html, language = 'en') {
  const clock = timers(), events = new Map(), nodes = new Map(), posted = [], reloads = [], canvasEvents = new Map();
  const node = tag => ({ tag, isConnected: true, hidden: false, children: [], attributes: {}, listeners: new Map(), style: {},
    setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, fn) { this.listeners.set(key, fn); },
    append(...children) { this.children.push(...children); }, querySelector(tag) { return this.children.find(child => child.tag === tag); } });
  for (const id of ['__bundler_loading', '__bundler_thumbnail', '__bundler_err']) nodes.set(id, node('div'));
  const canvas = { addEventListener: (key, fn) => canvasEvents.set(key, fn), removeEventListener: key => canvasEvents.delete(key) };
  const document = { body: { dataset: {}, append(element) { nodes.set(element.id, element); } }, createElement: node,
    getElementById: id => nodes.get(id), querySelectorAll: () => [canvas] };
  const parent = { document: { documentElement: { lang: language } }, postMessage: value => posted.push(value) };
  const ctx = vm.createContext({ ...clock, document, parent, URLSearchParams, location: { search: '?lang=' + language, origin: 'http://zone.test', reload: () => reloads.push(true) },
    addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key),
    dispatchEvent: event => events.get(event.type)?.(event), Event: class { constructor(type) { this.type = type; } } });
  vm.runInContext(definition(html, 'installMediaFallback'), ctx);
  const boot = ctx.installMediaFallback();
  return { boot, ctx, clock, events, nodes, canvasEvents, reloads, posted };
}

for (const name of ['character3d', 'weapon3d']) {
  const current = viewer(name);
  test(`${name}: rejected startup has localized, keyboard-native, one-shot viewer retry without automatic reloads`, () => {
    const { boot, ctx, clock, events, nodes, reloads, posted } = fallbackContext(current.html, 'ar');
    let prevented = 0;
    events.get('unhandledrejection')({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(boot.failed, true); assert.equal(clock.pending.size, 0);
    const panel = nodes.get('zone-media-error'); assert.equal(panel.attributes.role, 'status'); assert.equal(panel.dir, 'rtl');
    assert.match(panel.querySelector('p').textContent, /يمكنك مواصلة اللعب/); assert.equal(panel.querySelector('button').type, 'button');
    assert.equal(reloads.length, 0); assert.equal(posted.length, 0, 'failure must not issue any gameplay operation');
    for (let i = 0; i < 25; i++) events.get('message')({ source: {}, origin: 'http://zone.test', data: { lang: 'en' } });
    assert.equal(panel.dir, 'rtl');
    events.get('message')({ source: ctx.parent, origin: 'http://zone.test', data: { lang: 'en' } });
    assert.equal(panel.dir, 'ltr'); assert.match(panel.querySelector('p').textContent, /You can keep playing/);
    const button = panel.querySelector('button'); button.listeners.get('click')(); button.listeners.get('click')();
    assert.equal(reloads.length, 1); assert.equal(button.disabled, true);
  });
  test(`${name}: finite startup deadline fails once and late readiness cannot conceal failure`, () => {
    const { boot, clock, ctx, nodes, reloads } = fallbackContext(current.html);
    assert.equal([...clock.pending.values()][0].ms, 15000); clock.expire();
    assert.equal(ctx.document.body.dataset.zoneMediaError, 'preview-startup-timeout'); assert.equal(boot.ready(), false);
    assert.match(nodes.get('zone-media-error').querySelector('p').textContent, /You can keep playing/);
    assert.equal(reloads.length, 0); assert.equal(clock.pending.size, 0);
  });
  test(`${name}: successful ready cancels deadline, WebGL loss uses same fallback and cleanup removes listeners`, () => {
    const { boot, clock, ctx, canvasEvents, events, nodes } = fallbackContext(current.html);
    assert.equal(boot.ready(), true); assert.equal(clock.pending.size, 0); assert.equal(ctx.document.body.dataset.zoneMediaState, 'ready');
    let prevented = 0; canvasEvents.get('webglcontextlost')({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(ctx.document.body.dataset.zoneMediaError, 'webgl-context-lost');
    events.get('message')({ source: ctx.parent, origin: 'http://zone.test', data: { lang: 'ar' } });
    assert.equal(nodes.get('zone-media-error').dir, 'rtl');
    boot.dispose({ persisted: true }); assert.ok(events.has('message'), 'BFCache retains current preview state');
    boot.dispose({ persisted: false }); assert.equal(events.size, 0); assert.equal(canvasEvents.size, 0);
  });
  test(`${name}: fallback stops active render gate and visibility cannot restart a failed renderer`, () => {
    const events = new Map(), documentEvents = new Map(), calls = [], window = { ZoneMediaBoot: { failed: false } };
    const ctx = vm.createContext({ window, document: { hidden: false, body: { dataset: {} }, addEventListener: (key, fn) => documentEvents.set(key, fn), removeEventListener: key => documentEvents.delete(key) },
      addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) });
    vm.runInContext(definition(current.template, 'createRenderGate'), ctx);
    const gate = ctx.createRenderGate(() => calls.push('start'), () => calls.push('stop'), {});
    assert.deepEqual(calls, ['start']); window.ZoneMediaBoot.failed = true; events.get('zone-media-failure')();
    assert.deepEqual(calls, ['start', 'stop']); events.get('pageshow')(); documentEvents.get('visibilitychange')();
    assert.deepEqual(calls, ['start', 'stop']); gate.dispose(); assert.equal(events.size, 0); assert.equal(documentEvents.size, 0);
  });
}

// The compressed shipped art/catalog/class modules are not part of this repair.
test('launch reliability changes preserve every approved compressed viewer asset byte', () => {
  const expected = { character3d: 'e138220f7047928449e9d09383ae3b99237222022b9d5f9fc963551833f90006', weapon3d: 'fff455420ec4ff05998204de39ce8e7d3af27e8c7624f23098f4955723696218' };
  for (const [name, hash] of Object.entries(expected)) {
    const manifest = viewer(name).html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1];
    // Hash exact compressed entries, excluding only HTML formatting whitespace.
    // Both baseline git objects and worktree compare equal under this encoding.
    assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(manifest))).digest('hex'), hash);
  }
  assert.match(character.template, /parent !== window && q.get\('studio'\) !== '1'/);
  assert.match(character.template, /body\.player-preview \.bar,body\.player-preview #canim,body\.player-preview \.tag\{display:none\}/);
});

import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function readViewer(name) {
  const html = readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8');
  const data = kind => JSON.parse(html.match(new RegExp(`<script type="__bundler/${kind}">\\s*([\\s\\S]*?)\\s*</script>`))[1]);
  const scripts = Object.fromEntries(Object.entries(data('manifest')).map(([id, entry]) => {
    const bytes = Buffer.from(entry.data, 'base64');
    return [id, (entry.compressed ? gunzipSync(bytes) : bytes).toString('utf8')];
  }));
  return { html, template: data('template'), scripts };
}
const character = readViewer('character3d'), weapon = readViewer('weapon3d');

function extract(source, name, method = false) {
  const start = source.search(new RegExp(method ? `\\n\\s*${name}\\s*\\([^)]*\\)\\s*\\{` : `(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `Missing ${name}`);
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
    if (c === '}' && --depth === 0) return `${method ? 'function ' : ''}${source.slice(start, i + 1)}`;
  }
  throw new Error(`Unclosed ${name}`);
}
function context(source, names, values = {}) {
  const ctx = vm.createContext(values);
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), ctx);
  return ctx;
}

test('Wardrobe keeps shoulders and upper arms clothed while leaving hands and head visible', () => {
  const ctx = context(character.template, ['outfitBoneRegion']);
  for (const outfit of ['street', 'suit', 'tactical']) {
    assert.equal(ctx.outfitBoneRegion('clavicle_l', outfit), 'top');
    assert.equal(ctx.outfitBoneRegion('upperarm_r', outfit), 'sleeve');
    assert.equal(ctx.outfitBoneRegion('hand_r', outfit), 'skin');
    assert.equal(ctx.outfitBoneRegion('Head', outfit), 'skin');
    assert.equal(ctx.outfitBoneRegion('thigh_l', outfit), 'bottom');
    assert.equal(ctx.outfitBoneRegion('foot_r', outfit), 'shoe');
  }
  assert.equal(ctx.outfitBoneRegion('lowerarm_l','street'), 'skin');
  assert.equal(ctx.outfitBoneRegion('lowerarm_l','suit'), 'sleeve');
});

for (const [name, viewer] of [['character', character], ['weapon', weapon]]) {
  test(`${name}: all decoded scripts parse and every catalog weapon has embedded model data`, () => {
    const scripts = [...Object.values(viewer.scripts)];
    for (const match of viewer.template.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[1].includes('importmap') && match[2].trim()) scripts.push(match[2]);
    }
    for (const script of scripts) {
      const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: script, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const ctx = vm.createContext({});
    Object.values(viewer.scripts).filter(script => script.includes('globalThis.ZONE_')).forEach(script => vm.runInContext(script, ctx));
    assert.equal(Object.keys(ctx.ZONE_WEAPONS).length, 49);
    for (const item of Object.values(ctx.ZONE_WEAPONS)) for (const ext of ['obj', 'mtl']) {
      assert.ok(ctx.ZONE_WEAPON_PACK[`${item.file}.${ext}`], `${item.file}.${ext} is absent from bundle`);
      assert.ok(existsSync(new URL(`../assets/weapons/${item.file}.${ext}`, import.meta.url)), `${item.file}.${ext} local fallback missing`);
    }
    if (name === 'character') {
      assert.match(ctx.ZONE_MANNEQUIN_GLB, /^data:.*base64,/);
      assert.ok(existsSync(new URL('../assets/character/mannequin_anim.glb', import.meta.url)));
    }
  });

  test(`${name}: render gate pauses offscreen, hidden and pagehide without duplicate loops`, () => {
    const events = new Map(), visibility = new Map();
    let startCount = 0, stopCount = 0, callback, disconnected = 0;
    const document = { hidden: false, body: { dataset: {} }, addEventListener: (key, fn) => visibility.set(key, fn), removeEventListener: key => visibility.delete(key) };
    const ctx = context(viewer.template, ['createRenderGate'], {
      document, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key),
      IntersectionObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected++; } },
    });
    const gate = ctx.createRenderGate(() => startCount++, () => stopCount++, {});
    assert.equal(startCount, 0);
    callback([{ isIntersecting: true }]); callback([{ isIntersecting: true }]);
    assert.equal(startCount, 1);
    callback([{ isIntersecting: false }]); assert.equal(stopCount, 1);
    document.hidden = true; callback([{ isIntersecting: true }]); assert.equal(startCount, 1);
    document.hidden = false; visibility.get('visibilitychange')(); assert.equal(startCount, 2);
    events.get('pagehide')(); assert.equal(stopCount, 2);
    events.get('pageshow')(); assert.equal(startCount, 3);
    gate.dispose(); assert.equal(stopCount, 3);
    assert.equal(disconnected, 1); assert.equal(events.size, 0); assert.equal(visibility.size, 0);
    assert.equal(document.body.dataset.zoneRendering, 'paused');
  });
}

test('Item disposal frees each owned resource once and retains cached shared materials', () => {
  let geometryDisposals = 0, ownedDisposals = 0, sharedDisposals = 0;
  const geometry = { dispose: () => geometryDisposals++ }, owned = { dispose: () => ownedDisposals++ }, shared = { dispose: () => sharedDisposals++ };
  const ctx = context(weapon.template, ['disposeItem'], { M: { steel: shared } });
  const root = { traverse: visit => [{ geometry, material: [owned, shared] }, { geometry, material: owned }].forEach(visit) };
  ctx.disposeItem(root);
  assert.equal(geometryDisposals, 1); assert.equal(ownedDisposals, 1); assert.equal(sharedDisposals, 0);
});

test('Late item loads are discarded and successive visible items release previous objects', async () => {
  const disposed = [], installed = [];
  let finishGun;
  const model = name => ({ name, position: { x: 0, y: 0, z: 0 } });
  const ctx = context(weapon.template, ['show'], {
    WCAT: { gun: {} }, MODELS: { bat: () => model('bat'), knife: () => model('knife') }, ALIAS: {},
    current: null, showSeq: 0, shownObject: null,
    loadGun: () => new Promise(resolve => { finishGun = resolve; }), disposeItem: item => { if (item) disposed.push(item.name); },
    stage: { setAttribute() {}, setObject: root => installed.push(root.name) },
    THREE: { Box3: class { constructor() { this.min = { x: 0, y: 0, z: 0 }; this.max = this.min; } setFromObject() { return this; } }, Group: class { add() {} } },
  });
  const loading = ctx.show('gun');
  await ctx.show('bat'); finishGun(model('gun')); await loading;
  await ctx.show('knife');
  assert.deepEqual(installed, ['zone_bat', 'zone_knife']);
  assert.deepEqual(disposed, ['gun', 'zone_bat']);
});

test('Character replacement frees procedural geometry while retaining catalog cache and materials', () => {
  let disposals = 0;
  const geometry = { dispose: () => disposals++ };
  const ctx = context(character.template, ['releaseEquippedWeapon']);
  const root = { userData: {}, traverse: visit => [geometry, geometry].forEach(geometry => visit({ geometry })) };
  ctx.releaseEquippedWeapon(root); assert.equal(disposals, 0);
  root.userData.zoneOwnedGeometry = true;
  ctx.releaseEquippedWeapon(root); assert.equal(disposals, 1);
});

test('Outfit changes update the existing GPU color attribute instead of abandoning buffers', () => {
  let created = 0, attribute;
  const ctx = context(character.template, ['updateOutfitColors'], {
    THREE: { BufferAttribute: class { constructor(array) { this.array = array; created++; } } },
  });
  const geometry = { getAttribute: () => attribute, setAttribute: (_name, value) => { attribute = value; } };
  ctx.updateOutfitColors(geometry, new Float32Array([1, 2, 3]));
  const original = attribute;
  for (let i = 0; i < 100; i++) ctx.updateOutfitColors(geometry, new Float32Array([i, 4, 5]));
  assert.equal(created, 1); assert.equal(attribute, original); assert.equal(attribute.array[0], 99); assert.equal(attribute.needsUpdate, true);
});

test('Stage render control never resumes a detached canvas and can resume the same scene', () => {
  const source = Object.values(weapon.scripts).find(script => script.includes('class ThreeDStage'));
  assert.ok(source);
  const ctx = vm.createContext({}); vm.runInContext(extract(source, 'setRenderingEnabled', true), ctx);
  const loops = [], stage = { isConnected: true, _loop: () => {}, _renderer: { setAnimationLoop: loop => loops.push(loop) } };
  ctx.setRenderingEnabled.call(stage, false); ctx.setRenderingEnabled.call(stage, true);
  stage.isConnected = false; ctx.setRenderingEnabled.call(stage, true);
  assert.deepEqual(loops, [null, stage._loop, null]);
});

test('Item toolbar inherits Arabic before renderer readiness and updates all labels on language change', () => {
  const source = Object.values(weapon.scripts).find(script => script.includes('class ThreeDStage'));
  const node = () => ({ children: [], appendChild(child) { this.children.push(child); }, addEventListener() {}, querySelector(selector) { return this.children.find(child => `.${child.className}` === selector); } });
  const ctx = vm.createContext({
    stylesheet: '', URLSearchParams, location: { search: '' }, parent: { document: { documentElement: { lang: 'ar' } } },
    document: { documentElement: {}, createElement: node },
    HTMLElement: class { attachShadow() { this.shadowRoot = node(); return this.shadowRoot; } },
  });
  const method = name => extract(source, name, true).replace(/^function\s+/, '');
  vm.runInContext(`${extract(source, 'initialViewerLanguage')}\nclass Stage extends HTMLElement { ${method('constructor')} ${method('setLanguage')} _setButtonsEnabled() {} }; this.Stage = Stage;`, ctx);
  const stage = new ctx.Stage();
  assert.equal(stage._objBtn.textContent, 'تنزيل OBJ + MTL');
  assert.equal(stage._glbBtn.textContent, 'تنزيل GLB');
  assert.equal(stage.shadowRoot.querySelector('.note').textContent, 'اسحب للتدوير. مرر للتقريب. اسحب بالزر الأيمن للتحريك.');
  assert.equal(ctx.document.documentElement.dir, 'rtl');
  stage.setLanguage('en');
  assert.equal(stage._objBtn.textContent, 'Download OBJ + MTL');
  assert.equal(stage._glbBtn.textContent, 'Download GLB');
  assert.match(stage.shadowRoot.querySelector('.note').textContent, /^Drag to orbit/);
  assert.equal(ctx.document.documentElement.dir, 'ltr');
  ctx.location.search = '?lang=en';
  assert.equal(new ctx.Stage()._objBtn.textContent, 'Download OBJ + MTL');
});

test('Compact character selector reflects equipped bat and knife in both languages', () => {
  const select = () => ({ options: [], value: '', set innerHTML(value) { if (value === '') this.options = []; }, appendChild(option) { this.options.push(option); } });
  const weaponSelect = select(), animationSelect = select();
  const ctx = context(character.template, ['proceduralWeaponLabel', 'buildCompact', 'paintCompact'], {
    MINI: false, lang: 'en', state: { weapon: 'bat' }, lastAct: 'idle', ACTIONS: [], CLIP: {},
    $: id => id === 'cwep' ? weaponSelect : animationSelect, document: { createElement: () => ({}) },
    WEAPON: { bat() {}, knife() {}, revolver() {} },
    WCAT: { revolver: { file: 'Revolver_1', dmg: 1.9 }, alias: { file: 'Revolver_1', dmg: 1.9 }, rifle: { file: 'AssaultRifle_1', dmg: 3.4 } },
    WNAME: { en: { revolver: 'Revolver', rifle: 'Rifle' }, ar: { revolver: 'مسدس', rifle: 'بندقية' } },
    find() {}, setWeapon() {}, trigger() {}, actionLabel: (_key, text) => text,
  });
  ctx.buildCompact();
  assert.equal(weaponSelect.value, 'bat');
  assert.equal(weaponSelect.options.find(option => option.value === 'bat').textContent, 'Baseball bat');
  assert.deepEqual(weaponSelect.options.map(option => option.value), ['fists', 'bat', 'knife', 'revolver', 'rifle']);
  ctx.state.weapon = 'knife'; ctx.lang = 'ar'; ctx.buildCompact();
  assert.equal(weaponSelect.value, 'knife');
  assert.equal(weaponSelect.options.find(option => option.value === 'knife').textContent, 'سكين');
  assert.equal(weaponSelect.options.find(option => option.value === 'bat').textContent, 'مضرب بيسبول');
  ctx.state.weapon = 'alias'; ctx.paintCompact(); assert.equal(weaponSelect.value, 'revolver');
  ctx.state.weapon = 'fists'; ctx.paintCompact(); assert.equal(weaponSelect.value, 'fists');
});

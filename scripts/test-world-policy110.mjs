import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../admin-assets.js', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin.js', import.meta.url), 'utf8').replace(/\r/g, '');
const studioSource = readFileSync(new URL('../admin-studio.js', import.meta.url), 'utf8').replace(/\r/g, '');
const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const mediaTests = readFileSync(new URL('./test-admin-media108.mjs', import.meta.url), 'utf8');
const fixtureStart = mediaTests.indexOf('function fixtureDom()'), fixtureEnd = mediaTests.indexOf('\nconst idA =', fixtureStart);
assert.ok(fixtureStart >= 0 && fixtureEnd > fixtureStart, 'Reuse the existing media DOM primitives, never its controller or tests.');
const fixtureSource = mediaTests.slice(fixtureStart, fixtureEnd);
const clone = value => structuredClone(value);
const escape = value => String(value ?? '').replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const decode = value => String(value).replace(/&(?:amp|quot|lt|gt|#39);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" })[entity]);
const flush = () => new Promise(resolve => setImmediate(resolve));
const basePolicy = { enabled: false, tickSeconds: 90, findsPerTick: 2, findQuantity: 3, findLifetimeSeconds: 1200, maxActiveFinds: 12, supplyShift: 5, supplyCap: 80, eventEveryTicks: 7 };
const defaultItems = () => ({ sand: { type: 'material', price: 25 }, test_scrap: { type: 'material', price: 40, name: { en: 'Isolated test scrap', ar: 'خردة الاختبار المعزول' } }, knife: { type: 'weapon', price: 500 }, medkit: { type: 'medical', price: 200 } });
const nullable = { findValueBudgetPerHour: null, searchValueBudgetPerHour: null, materialItemIds: null };

function actualFunction(name) {
  const start = adminSource.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
  assert.ok(start >= 0, 'Actual Admin function exists: ' + name);
  const open = adminSource.indexOf('{', start); let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = open; i < adminSource.length; i++) {
    const c = adminSource[i], next = adminSource[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return adminSource.slice(start, i + 1);
  }
  assert.fail('Unclosed actual Admin function: ' + name);
}

function world({ policy = basePolicy, items = defaultItems(), saveHook } = {}) {
  const domContext = createContext({ html, assert, decode, clone, queueMicrotask });
  runInContext(fixtureSource + '\nglobalThis.document = fixtureDom();', domContext);
  const document = domContext.document, q = selector => document.querySelector(selector), proto = Object.getPrototypeOf(document.createElement('select'));
  // Standard multiple-select browser primitives absent from the older fixture.
  Object.defineProperties(proto, {
    selected: { get() { return this.hasAttribute('selected'); }, set(value) { value ? this.setAttribute('selected', '') : this.removeAttribute('selected'); } },
    selectedOptions: { get() { return Array.from(this.querySelectorAll('option')).filter(option => option.selected); } },
  });
  const state = { language: 'en', view: 'overview', bootReady: true, engine: {}, controlBusy: false, catalogBusy: false, dirty: false, draftEditRevision: 0, draftConflict: null,
    draft: { manifest: { pages: [], navigation: [], worldPolicy: clone(policy) }, draftFingerprint: 'a'.repeat(64) },
    gameplayCatalog: { revision: 1, catalogs: { items: clone(items), market: [], properties: [] } }, catalogEdits: {}, catalogNewIds: {} };
  const calls = [], notices = [], listeners = new Map(); let writes = 0, serverDraft = clone(state.draft), context;
  const window = { addEventListener(type, callback) { const list = listeners.get(type) ?? []; list.push(callback); listeners.set(type, list); } };
  context = createContext({ console, document, window, MutationObserver: document.MutationObserver, state, $: q, esc: escape, location: { origin: 'https://zone.test' },
    setTimeout: () => 0, clearTimeout() {}, t: key => key, notify: (value, error) => notices.push({ value, error }),
    adminCanMutate: () => state.bootReady && !state.controlBusy && !state.catalogBusy,
    beginControlAction(label) { if (!state.bootReady || state.controlBusy || state.catalogBusy) return false; state.controlBusy = label; return true; }, endControlAction() { state.controlBusy = false; },
    markDirty() { state.dirty = true; state.draftEditRevision++; }, runtimeContentSnapshot: () => ({}), updatePreviewCache() {}, refreshViewPreview() {}, renderDraftConflict() {},
    renderAll() { window.ZoneMedia?.refresh(); }, unsavedContentEdits: () => ({ catalog: null, crime: false }), setView(view) { state.view = view; }, renderContent() {}, renderGameplayCatalog() {},
    async api(path, options = {}) {
      const call = { path, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null }; calls.push(call);
      if (path === '/api/v1/admin/assets') return { assets: [] }; if (path === '/api/v1/admin/workers') return { workers: [] };
      if (path === '/api/v1/admin/draft' && call.method === 'GET') return clone(serverDraft);
      if (path === '/api/v1/admin/draft' && call.method === 'PUT') {
        writes++; const result = saveHook ? await saveHook(call, { state, serverDraft, writes }) : null;
        serverDraft = result ?? { manifest: clone(call.body.manifest), draftFingerprint: 'b'.repeat(64) }; return clone(serverDraft);
      }
      assert.fail('Unexpected policy request: ' + call.method + ' ' + path);
    },
  });
  const labelsStart = adminSource.indexOf('const catalogDefaultLabels = {'), labelsEnd = adminSource.indexOf('\n};', labelsStart) + 3;
  runInContext(adminSource.slice(labelsStart, labelsEnd), context);
  runInContext(['deepCopy', 'currentManifest', 'adminCanMutate', 'manifestWithRuntimeContent', 'authoringManifestText', 'persistDraft', 'handleReleaseError', 'saveDraft', 'resolveDraftConflict', 'requireSavedContent'].map(actualFunction).join('\n'), context);
  state.savedDraftManifest = context.authoringManifestText(state.draft.manifest);
  runInContext(source, context, { filename: 'actual-admin-assets.js' });
  return { q, document, state, context, window, calls, notices,
    puts: () => calls.filter(call => call.path === '/api/v1/admin/draft' && call.method === 'PUT'),
    save: () => q('#worldPolicyForm').emit('submit'),
    async budget(key, value) { const input = q('#worldPolicy-' + key); assert.ok(input, 'Actual optional budget control exists: ' + key); await input.input(value); },
    async materials(ids, { inject = false } = {}) {
      const all = q('#worldPolicy-allMaterials'), select = q('#worldPolicy-materialItemIds'); assert.ok(all && select, 'Actual material controls exist.');
      all.checked = false; await all.emit('input');
      for (const option of select.querySelectorAll('option')) option.selected = false;
      for (const id of ids) { let option = !inject && select.querySelectorAll('option').find(entry => entry.value === id); if (!option) { option = document.createElement('option'); option.value = id; option.selected = true; select.append(option); } option.selected = true; }
      await select.emit('input');
    },
    async beforeUnload() { const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; for (const listener of listeners.get('beforeunload') ?? []) await listener(event); return event; },
  };
}

test('legacy world policy starts with blank budgets and all materials, showing only actual material choices', () => {
  const w = world(); assert.ok(w.q('#worldPolicy-findValueBudgetPerHour'), 'The actual World policy form exposes the optional global budget.');
  assert.equal(w.q('#worldPolicy-findValueBudgetPerHour').value, ''); assert.equal(w.q('#worldPolicy-searchValueBudgetPerHour').value, '');
  assert.equal(w.q('#worldPolicy-allMaterials').checked, true); assert.equal(w.q('#worldPolicy-materialItemIds').disabled, true);
  assert.deepEqual(Array.from(w.q('#worldPolicy-materialItemIds').querySelectorAll('option'), option => option.value), ['sand', 'test_scrap']);
  assert.equal(w.q('[data-media-copy="searchValueBudgetPerHour"]').textContent, 'Search crimes: hourly value for each player'); assert.match(w.q('[data-media-copy="issuanceHelp"]').textContent, /blank.*0/i);
  assert.equal(w.window.ZoneMedia.hasUnsaved(), false); assert.equal(w.puts().length, 0);
});

test('World workspace owns one collapsed director panel immediately before its territory summary', async () => {
  const w = world(), panel = w.q('.media-world-workshop'), territories = w.q('.view[data-view="territories"]'), summary = w.q('#territorySummary');
  assert.equal(panel.parentElement === territories, true, 'The director panel belongs to World & territories.'); assert.equal(territories.children.indexOf(panel) + 1, territories.children.indexOf(summary));
  assert.equal(panel.hasAttribute('open'), false); assert.equal(w.q('.view[data-view="assets"]').querySelector('.media-world-workshop'), null);
  const input = w.q('#worldPolicy-findValueBudgetPerHour'); await input.input('75');
  for (const [language, view] of [['ar', 'assets'], ['en', 'territories']]) { w.state.language = language; w.state.view = view; w.window.ZoneMedia.refresh(); await flush(); }
  assert.equal(w.q('#worldPolicy-findValueBudgetPerHour') === input, true); assert.equal(input.value, '75'); assert.equal(w.document.querySelectorAll('#worldPolicyForm').length, 1); assert.equal(panel.parentElement === territories, true);
});

test('existing World search entry finds material policy terms and keeps its existing territories route', () => {
  const start = studioSource.indexOf('  function buildSearchEntries() {'), end = studioSource.indexOf('\n  function renderSearch()', start), navigated = [];
  assert.ok(start >= 0 && end > start);
  const context = createContext({ sections: ['territories'], copy: { en: { territories: 'World & territories' }, ar: { territories: 'العالم والأراضي' } },
    state: { language: 'en', modules: [], gameplayCatalog: { catalogs: {} } }, tr: key => key === 'territories' ? 'World & territories' : key,
    currentManifest: () => ({ pages: [] }), setView: view => navigated.push(view), runAction() {} });
  runInContext(studioSource.slice(start, end), context);
  const entry = context.buildSearchEntries().find(row => row.label === 'World & territories');
  assert.match(entry.search, /material issuance hourly budget/); assert.match(entry.search, /ميزانية/); entry.action(); assert.deepEqual(navigated, ['territories']);
});

for (const [find, search, expectedFind, expectedSearch] of [['', '', null, null], ['0', '', 0, null], ['', '0', null, 0], ['75', '125', 75, 125], ['2000000000', '2000000000', 2000000000, 2000000000]]) {
  test(`actual draft submission preserves all legacy fields with find=${JSON.stringify(find)}, search=${JSON.stringify(search)}`, async () => {
    const w = world(); await w.budget('findValueBudgetPerHour', find); await w.budget('searchValueBudgetPerHour', search);
    for (const [key, value] of [['findValueBudgetPerHour', expectedFind], ['searchValueBudgetPerHour', expectedSearch]]) assert.match(w.q('#worldPolicy-' + key + '-state').textContent, value === null ? /Existing behavior/ : value === 0 ? /No new materials/ : /Hourly value limit/);
    await w.save();
    assert.equal(w.puts().length, 1); assert.equal(w.puts()[0].body.expectedFingerprint, 'a'.repeat(64));
    assert.deepEqual(w.puts()[0].body.manifest.worldPolicy, { ...basePolicy, findValueBudgetPerHour: expectedFind, searchValueBudgetPerHour: expectedSearch, materialItemIds: null });
    assert.equal(w.window.ZoneMedia.hasUnsaved(), false); assert.equal(w.context.requireSavedContent(), true);
  });
}

test('custom material IDs serialize as the exact flat list and existing optional limits survive an old-field-only save', async () => {
  const policy = { ...basePolicy, ...nullable, findValueBudgetPerHour: 0, searchValueBudgetPerHour: 180, materialItemIds: ['test_scrap'] };
  const w = world({ policy }); await w.q('#worldPolicy-tickSeconds').input('120'); await w.save();
  assert.deepEqual(w.puts()[0].body.manifest.worldPolicy, { ...policy, tickSeconds: 120 });
  await w.materials(['sand', 'test_scrap']); await w.save(); assert.deepEqual(w.puts()[1].body.manifest.worldPolicy.materialItemIds, ['sand', 'test_scrap']);
});

for (const key of ['findValueBudgetPerHour', 'searchValueBudgetPerHour']) for (const value of ['-1', '1.5', '2000000001', 'Infinity', 'NaN', '1e3', '0x10']) {
  test(`${key} rejects invalid budget ${value} before writing a draft`, async () => {
    const w = world(); await w.budget(key, value); await w.save(); assert.equal(w.puts().length, 0); assert.equal(w.q('#worldPolicy-' + key).value, value);
    assert.match(w.q('#worldPolicy-' + key + '-state').textContent, /Enter a whole value/);
    assert.equal(w.window.ZoneMedia.hasUnsaved(), true); assert.ok(w.q('#worldDraftStatus').textContent); assert.deepEqual(w.state.draft.manifest.worldPolicy, basePolicy);
  });
}

for (const [name, ids] of [['empty', []], ['unknown', ['missing']], ['wrong type', ['knife']], ['duplicates', ['sand', 'sand']]]) {
  test(`custom materials reject ${name} without clearing the authored budget`, async () => {
    const w = world(); await w.budget('findValueBudgetPerHour', '25'); await w.materials(ids, { inject: name !== 'empty' }); await w.save();
    assert.equal(w.puts().length, 0); assert.equal(w.q('#worldPolicy-findValueBudgetPerHour').value, '25'); assert.equal(w.window.ZoneMedia.hasUnsaved(), true); assert.ok(w.q('#worldDraftStatus').textContent);
  });
}

test('custom material selection enforces the 32-material boundary', async () => {
  const items = Object.fromEntries(Array.from({ length: 33 }, (_, i) => ['mat_' + i, { type: 'material', price: i + 1 }])), ids = Object.keys(items), w = world({ items });
  await w.materials(ids); await w.save(); assert.equal(w.puts().length, 0);
  await w.materials(ids.slice(0, 32)); await w.save(); assert.equal(w.puts().length, 1); assert.deepEqual(w.puts()[0].body.manifest.worldPolicy.materialItemIds, ids.slice(0, 32));
});

test('unsaved optional fields survive EN/AR and section changes with readable help and publication protection', async () => {
  const w = world(); await w.budget('findValueBudgetPerHour', '0'); await w.budget('searchValueBudgetPerHour', '125'); await w.materials(['test_scrap']);
  for (const [language, view] of [['ar', 'assets'], ['en', 'releases'], ['ar', 'overview']]) {
    w.state.language = language; w.state.view = view; w.window.ZoneMedia.refresh(); await flush();
    assert.equal(w.q('#worldPolicy-findValueBudgetPerHour').value, '0'); assert.equal(w.q('#worldPolicy-searchValueBudgetPerHour').value, '125');
    assert.deepEqual(w.q('#worldPolicy-materialItemIds').selectedOptions.map(option => option.value), ['test_scrap']); assert.equal(w.context.requireSavedContent(), false);
    assert.match(w.q('[data-media-copy="issuanceHelp"]').textContent, language === 'ar' ? /0|٠/ : /blank/i);
    assert.equal(w.q('#worldDraftStatus').textContent, language === 'ar' ? 'تعديلات السياسة لم تُحفظ بعد.' : 'Policy edits are not saved yet.');
    assert.equal(w.q('[data-media-copy="searchValueBudgetPerHour"]').textContent, language === 'ar' ? 'جرائم البحث: قيمة المواد في الساعة لكل لاعب' : 'Search crimes: hourly value for each player');
  }
  assert.equal((await w.beforeUnload()).defaultPrevented, true); assert.equal(w.puts().length, 0);
});

test('owned saving and saved policy status follows locale while one submission stays in flight', async () => {
  let settle; const pending = new Promise(resolve => { settle = resolve; }), w = world({ saveHook: () => pending });
  await w.budget('findValueBudgetPerHour', '100'); const saving = w.save(); await flush();
  assert.equal(w.q('#worldDraftStatus').textContent, 'Saving the policy draft...');
  w.state.language = 'ar'; w.window.ZoneMedia.refresh(); assert.equal(w.q('#worldDraftStatus').textContent, 'جارٍ حفظ مسودة السياسة...'); assert.equal(w.puts().length, 1);
  settle({ manifest: w.puts()[0].body.manifest, draftFingerprint: 'b'.repeat(64) }); await saving;
  assert.equal(w.q('#worldDraftStatus').textContent, 'تم حفظ المسودة. عاين ثم انشر عندما تصبح جاهزة.');
  w.state.language = 'en'; w.window.ZoneMedia.refresh(); assert.equal(w.q('#worldDraftStatus').textContent, 'Draft saved. Preview and publish when ready.');
});

test('owned validation text translates without losing the invalid policy input', async () => {
  const w = world(); await w.budget('searchValueBudgetPerHour', '1.5'); await w.save(); assert.match(w.q('#worldDraftStatus').textContent, /Enter a whole value/);
  w.state.language = 'ar'; w.window.ZoneMedia.refresh(); assert.match(w.q('#worldDraftStatus').textContent, /أدخل عدداً صحيحاً/); assert.equal(w.q('#worldPolicy-searchValueBudgetPerHour').value, '1.5'); assert.equal(w.puts().length, 0);
});

test('locale refresh never replaces a raw transport or server policy error', async () => {
  const w = world(); w.context.saveDraft = async () => { throw new Error('Server policy storage temporarily unavailable'); };
  await w.budget('findValueBudgetPerHour', '50'); await w.save(); const error = w.q('#worldDraftStatus').textContent;
  assert.equal(error, 'Server policy storage temporarily unavailable');
  for (const language of ['ar', 'en']) { w.state.language = language; w.window.ZoneMedia.refresh(); assert.equal(w.q('#worldDraftStatus').textContent, error); }
  assert.equal(w.q('#worldPolicy-findValueBudgetPerHour').value, '50'); assert.equal(w.window.ZoneMedia.hasUnsaved(), true);
});

test('one real policy save does not emit a false operation-busy toast during its render', async () => {
  const w = world(); await w.budget('findValueBudgetPerHour', '360'); await w.save();
  assert.equal(w.puts().length, 1); assert.equal(w.notices.some(notice => notice.value === 'operationBusy'), false, 'Rendering controls is not an attempted second mutation.');
  assert.equal(w.q('#worldDraftStatus').textContent, 'Draft saved. Preview and publish when ready.');
});

test('new policy inputs made during a real draft save remain dirty and are sent only on the next save', async () => {
  let settle; const pending = new Promise(resolve => { settle = resolve; });
  const w = world({ saveHook: async (call, { writes }) => writes === 1 ? pending : { manifest: call.body.manifest, draftFingerprint: 'c'.repeat(64) } });
  await w.budget('findValueBudgetPerHour', '50'); const saving = w.save(); await flush(); await w.budget('findValueBudgetPerHour', '0'); await w.materials(['sand']);
  settle({ manifest: w.puts()[0].body.manifest, draftFingerprint: 'b'.repeat(64) }); await saving; w.window.ZoneMedia.refresh();
  assert.equal(w.q('#worldPolicy-findValueBudgetPerHour').value, '0'); assert.deepEqual(w.q('#worldPolicy-materialItemIds').selectedOptions.map(option => option.value), ['sand']); assert.equal(w.window.ZoneMedia.hasUnsaved(), true);
  assert.equal(w.puts()[0].body.manifest.worldPolicy.findValueBudgetPerHour, 50); await w.save();
  assert.equal(w.puts()[1].body.expectedFingerprint, 'b'.repeat(64)); assert.equal(w.puts()[1].body.manifest.worldPolicy.findValueBudgetPerHour, 0); assert.deepEqual(w.puts()[1].body.manifest.worldPolicy.materialItemIds, ['sand']);
});

test('failed and stale draft responses retain fields for deliberate retry without automatic writes', async () => {
  for (const stale of [false, true]) {
    const w = world({ saveHook: async (call, { writes, serverDraft }) => { if (writes === 1) { if (stale) { serverDraft.draftFingerprint = 'd'.repeat(64); serverDraft.manifest.worldPolicy.tickSeconds = 180; } throw new Error(stale ? 'Release draft changed' : 'Draft storage unavailable'); } return { manifest: call.body.manifest, draftFingerprint: 'c'.repeat(64) }; } });
    await w.budget('searchValueBudgetPerHour', '0'); await w.materials(['test_scrap']); await w.save(); w.state.language = 'ar'; w.window.ZoneMedia.refresh();
    assert.equal(w.q('#worldPolicy-searchValueBudgetPerHour').value, '0'); assert.deepEqual(w.q('#worldPolicy-materialItemIds').selectedOptions.map(option => option.value), ['test_scrap']); assert.equal(w.puts().length, 1); assert.equal(w.window.ZoneMedia.hasUnsaved(), true);
    if (stale) { assert.ok(w.state.draftConflict); w.context.resolveDraftConflict(false); }
    await w.save(); assert.equal(w.puts().length, 2); assert.equal(w.puts()[1].body.expectedFingerprint, (stale ? 'd' : 'a').repeat(64)); assert.deepEqual(w.puts()[1].body.manifest.worldPolicy, { ...basePolicy, ...nullable, searchValueBudgetPerHour: 0, materialItemIds: ['test_scrap'] });
  }
});

test('a selected material becoming ineligible is rejected after refresh instead of silently erasing the selection', async () => {
  const w = world(); await w.materials(['sand']); w.state.gameplayCatalog.catalogs.items.sand.type = 'weapon'; w.state.language = 'ar'; w.window.ZoneMedia.refresh();
  assert.equal(w.q('#worldPolicy-materialItemIds').querySelectorAll('option').some(option => option.value === 'sand'), false); await w.save(); assert.equal(w.puts().length, 0);
  await w.materials(['test_scrap']); await w.save(); assert.deepEqual(w.puts()[0].body.manifest.worldPolicy.materialItemIds, ['test_scrap']);
  const diag = w.window.ZoneMedia.diagnostics();
  assert.equal(diag.policyDirty, false);
  assert.equal(diag.policySaving, false);
  assert.equal(diag.policyMaterialCount, 1);
});

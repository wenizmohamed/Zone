import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const savedCrime = {
  id: 'shoplift', name_en: 'Shoplift', name_ar: 'سرقة متجر', nerve_cost: 2,
  successRate: 75, cash_min: 100, cash_max: 250, xp_reward: 10, enabled: true,
};

function admin({ save = async () => ({ crime: { ...savedCrime } }), request, ready = true, gameplayCatalog = null } = {}) {
  const elements = new Map();
  const calls = [], notices = [];
  const element = (selector) => {
    if (!elements.has(selector)) {
      let value = '';
      elements.set(selector, {
        get value() { return value; }, set value(next) { value = String(next); },
        innerHTML: '', textContent: '', checked: false, disabled: false,
        setAttribute() {}, focus() {},
      });
    }
    return elements.get(selector);
  };
  const context = createContext({
    console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { documentElement: {}, querySelector: element, querySelectorAll: () => [] },
    noticeStub: message => notices.push(message),
    apiStub: async (url, options) => { calls.push({ url, options }); return request ? request(url, options) : options?.method === 'PUT' ? save(url, options) : { events: [], entries: [] }; },
  });
  // Execute the actual admin functions without booting a network-backed page.
  const definitions = source.slice(0, source.indexOf('\ninstallSectionPreviews();'));
  runInContext(`${definitions}
    renderNavigation = renderOverview = renderBuilder = renderModules = renderThemes =
      renderTerritories = renderAssets = renderEconomy = renderEvents = renderReleases = () => {};
    ensureTerritoryMapPreview = refreshViewPreview = markDirty = () => {};
    notify = noticeStub;
    const guardedApi = api;
    api = apiStub;
    globalThis.admin = { state, renderContent, applyLanguage, newCrime, saveCrime, saveDraft, publishRelease, activateRelease, mutateModule, activateTheme, applyTerritoryOwnership, addPage, addBlock, load, updateBootControls, guardedApi, renderGameplayCatalog, saveGameplayCatalog, catalogChanges, runtimeContentSnapshot };
  `, context);
  const app = context.admin;
  app.state.crimes = [{ ...savedCrime }];
  app.state.gameplayCatalog = gameplayCatalog;
  if (ready) { app.state.bootReady = true; app.state.engine = {}; app.state.draft = { manifest: { pages: [], navigation: [] } }; }
  app.state.selectedCrime = savedCrime.id;
  app.renderContent();
  app.updateBootControls();
  const language = (value) => { app.state.language = value; app.applyLanguage(); };
  return { ...app, element, language, calls, notices };
}

test('language rerenders preserve every unsaved crime field without changing the saved catalog', () => {
  const app = admin();
  const edits = {
    crimeNameEn: 'Draft name', crimeNameAr: 'اسم غير محفوظ', crimeNerve: '',
    crimeSuccess: '63.25', crimeCashMin: '0', crimeCashMax: '987', crimeXp: '42',
  };
  for (const [id, value] of Object.entries(edits)) app.element(`#${id}`).value = value;
  app.element('#crimeEnabled').checked = false;
  for (const language of ['ar', 'en']) {
    app.language(language);
    for (const [id, value] of Object.entries(edits)) assert.equal(app.element(`#${id}`).value, value, `${language}/${id}`);
    assert.equal(app.element('#crimeEnabled').checked, false);
    assert.equal(app.element('#crimeId').disabled, true);
  }
  assert.deepEqual(app.state.crimes[0], savedCrime);
});

test('a new crime survives language changes and deliberate selection/new actions reset the form', () => {
  const app = admin();
  app.newCrime();
  app.element('#crimeId').value = 'draft-crime';
  app.element('#crimeNameEn').value = 'Draft crime';
  app.language('ar');
  assert.equal(app.element('#crimeId').value, 'draft-crime');
  assert.equal(app.element('#crimeNameEn').value, 'Draft crime');
  assert.equal(app.element('#crimeId').disabled, false);
  app.newCrime();
  assert.equal(app.element('#crimeId').value, '');
  assert.equal(app.element('#crimeNameEn').value, '');
  app.state.selectedCrime = savedCrime.id;
  app.renderContent();
  assert.equal(app.element('#crimeNameEn').value, savedCrime.name_en);
  assert.equal(app.element('#crimeId').disabled, true);
});

test('a successful save displays canonical server values on subsequent rerenders', async () => {
  let request;
  const app = admin({ save: async (url, options) => {
    request = { url, definition: JSON.parse(options.body) };
    return { crime: { ...savedCrime, name_en: 'Saved title', successRate: 62.5, enabled: false } };
  } });
  app.element('#crimeNameEn').value = '  Saved title  ';
  app.element('#crimeSuccess').value = '62.5';
  app.element('#crimeEnabled').checked = false;
  await app.saveCrime({ preventDefault() {} });
  assert.equal(request.url, '/api/v1/admin/crimes/shoplift');
  assert.equal(request.definition.name_en, 'Saved title');
  assert.equal(request.definition.success_basis_points, 6250);
  app.language('ar');
  assert.equal(app.element('#crimeNameEn').value, 'Saved title');
  assert.equal(app.element('#crimeSuccess').value, '62.5');
  assert.equal(app.element('#crimeEnabled').checked, false);
  assert.equal(app.element('#saveCrimeButton').disabled, false);
});

test('a failed save keeps the editable draft through the next language change', async () => {
  const app = admin({ save: async () => { throw new Error('Save failed'); } });
  app.element('#crimeNameEn').value = 'Keep this draft';
  await app.saveCrime({ preventDefault() {} });
  app.language('ar');
  assert.equal(app.element('#crimeNameEn').value, 'Keep this draft');
  assert.equal(app.state.crimes[0].name_en, savedCrime.name_en);
  assert.equal(app.element('#saveCrimeButton').disabled, false);
});

test('admin startup disables mutations and direct publish/save cannot serialize missing draft data', async () => {
  const app = admin({ ready: false });
  for (const id of ['publishButton','releasePublishButton','saveDraftButton','saveCrimeButton','addPageButton','addBlockButton','newCrimeButton']) assert.equal(app.element('#' + id).disabled, true, id);
  assert.match(app.element('#pipelineStatus').textContent, /Connecting/);
  await Promise.all([app.publishRelease(), app.saveDraft(), app.activateRelease('v1'), app.mutateModule('crimes', 'disable'), app.activateTheme('noir'), app.saveCrime({ preventDefault() {} }), app.applyTerritoryOwnership()]);
  app.addPage(); app.addBlock(); app.newCrime();
  assert.equal(app.calls.length, 0); assert.equal(app.state.draft, null);
  assert.ok(app.notices.length >= 10); assert.ok(app.notices.every(message => /Connecting/.test(message)));
  await assert.rejects(app.guardedApi('/api/v1/admin/releases/publish', { method: 'POST', body: '{}' }), /Connecting/);
  app.language('ar'); assert.match(app.element('#pipelineStatus').textContent, /جارٍ الاتصال/);
});

test('admin mutations unlock only after every fresh boot read completes and stay locked on failure', async () => {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const fixture = { php: '8.5', database: 'sqlite', modules: [], themes: [], crimes: [savedCrime], entries: [], events: [], releases: [], manifest: { pages: [], navigation: [] } };
  const app = admin({ ready: false, request: async () => { await gate; return fixture; } });
  const pending = app.load(); await app.publishRelease();
  assert.equal(app.state.bootReady, false); assert.equal(app.element('#publishButton').disabled, true); assert.ok(app.calls.every(call => !call.options?.method));
  finish(); await pending;
  assert.equal(app.state.bootReady, true); assert.equal(app.element('#publishButton').disabled, false); assert.equal(app.element('#saveDraftButton').disabled, false);
  const failed = admin({ ready: false, request: async () => { throw new Error('Offline'); } });
  await assert.rejects(failed.load(), /Offline/); await failed.publishRelease();
  assert.equal(failed.state.bootReady, false); assert.equal(failed.element('#publishButton').disabled, true);
  assert.match(failed.element('#pipelineStatus').textContent, /Unable to load admin data/); assert.ok(failed.calls.every(call => !call.options?.method));
});

function catalogFixture() {
  const name = { type: 'bilingual', maxLength: 120 }, integer = { type: 'integer', min: 0, max: 2000000000 };
  return { revision: 2, catalogs: { items: { drink: { type: 'booster', price: 990, nerve: 4 } }, jobs: [{ id: 'grocer', pay: 850, energy: 15, lvl: 1 }], gyms: [{ e: 5, xp: 0, cost: 10 }] }, schema: { items: { idField: 'key', fields: { price: integer, nerve: integer, mult: { type: 'number', min: .1, max: 20 }, name } }, jobs: { idField: 'id', fields: { pay: integer, name } }, gyms: { idField: 'index', fields: { e: integer, name } } } };
}
function editCatalog(app, field, value) { const input = app.element('#catalogField-' + field.replace('.', '-')); input.value = value; input.oninput(); }

test('typed catalog edits survive locale and entry changes without modifying saved data', () => {
  const fixture = catalogFixture(), app = admin({ gameplayCatalog: fixture });
  editCatalog(app, 'price', ''); editCatalog(app, 'name.en', 'Draft drink'); editCatalog(app, 'name.ar', 'مشروب مسودة');
  assert.doesNotMatch(app.element('#catalogFields').innerHTML, /catalogField-mult|catalogField-type/);
  app.language('ar'); assert.equal(app.element('#catalogField-price').value, ''); assert.match(app.element('#catalogFields').innerHTML, /السعر/);
  app.element('#catalogCategory').value = 'gyms'; app.element('#catalogCategory').onchange(); assert.equal(app.state.catalogEntry, '0');
  app.element('#catalogCategory').value = 'items'; app.element('#catalogCategory').onchange();
  assert.equal(app.element('#catalogField-name-ar').value, 'مشروب مسودة'); assert.equal(fixture.catalogs.items.drink.price, 990); assert.equal(fixture.catalogs.items.drink.name, undefined);
  assert.equal(app.runtimeContentSnapshot().gameplayCatalog.items.drink.price, 990);
});

test('catalog validation rejects empty, fractional integer and invalid bilingual names before PUT', async () => {
  const app = admin({ gameplayCatalog: catalogFixture() });
  for (const value of ['', '-1', '2.5', 'Infinity']) { editCatalog(app, 'price', value); await app.saveGameplayCatalog(); assert.equal(app.calls.length, 0); assert.match(app.state.catalogError, /integer/); }
  editCatalog(app, 'price', '1200'); editCatalog(app, 'name.en', '<img>');
  await app.saveGameplayCatalog(); assert.equal(app.calls.length, 0); assert.match(app.state.catalogError, /plain-text/);
});

test('catalog save submits only typed changed fields and refreshes canonical draft values', async () => {
  const fixture = catalogFixture(); let payload;
  const app = admin({ gameplayCatalog: fixture, request: async (url, options) => {
    assert.equal(url, '/api/v1/admin/gameplay-catalog/items/drink'); payload = JSON.parse(options.body);
    return { ...fixture, revision: 3, catalogs: { ...fixture.catalogs, items: { drink: { ...fixture.catalogs.items.drink, ...payload.changes } } } };
  } });
  editCatalog(app, 'price', '1200'); editCatalog(app, 'name.en', 'City drink'); editCatalog(app, 'name.ar', 'مشروب المدينة'); await app.saveGameplayCatalog();
  assert.deepEqual(payload, { expectedRevision: 2, changes: { price: 1200, name: { en: 'City drink', ar: 'مشروب المدينة' } } });
  assert.equal(app.state.gameplayCatalog.revision, 3); assert.equal(app.state.catalogEdits['items/drink'], undefined); assert.equal(app.element('#saveCatalogButton').disabled, false);
  app.language('ar'); assert.equal(app.element('#catalogField-price').value, '1200'); assert.match(app.element('#catalogStatus').textContent, /تم حفظ/);
});

test('stale catalog save refreshes the draft and preserves edits without replaying the write', async () => {
  const fixture = catalogFixture();
  const app = admin({ gameplayCatalog: fixture, request: async (url, options) => {
    if (options?.method === 'PUT') throw new Error('Gameplay catalog changed. Refresh and try again.');
    return { ...fixture, revision: 4, catalogs: { ...fixture.catalogs, items: { drink: { ...fixture.catalogs.items.drink, price: 1100 } } } };
  } });
  editCatalog(app, 'price', '1200'); await app.saveGameplayCatalog();
  assert.equal(app.calls.filter(call => call.options?.method === 'PUT').length, 1); assert.equal(app.state.gameplayCatalog.revision, 4);
  assert.equal(app.element('#catalogField-price').value, '1200'); assert.match(app.element('#catalogStatus').textContent, /changed elsewhere/);
  assert.equal(app.runtimeContentSnapshot().gameplayCatalog.items.drink.price, 1100);
});

test('catalog name prefills use real game labels without forcing name changes on a price edit', async () => {
  const fixture = catalogFixture(); let request;
  fixture.catalogs.items.assaultrifle2_1 = { type: 'weapon', price: 192000, mult: 3.6 };
  const app = admin({ gameplayCatalog: fixture, request: async (url, options) => { request = JSON.parse(options.body); return { ...fixture, revision: 3 }; } });
  assert.match(app.element('#catalogEntry').innerHTML, /AK I · assaultrifle2_1/);
  assert.ok(app.element('#catalogField-name-en').value && app.element('#catalogField-name-ar').value);
  editCatalog(app, 'price', '1000'); await app.saveGameplayCatalog();
  assert.deepEqual(request, { expectedRevision: 2, changes: { price: 1000 } });
  app.language('ar'); assert.match(app.element('#catalogEntry').innerHTML, /كلاشنكوف I/);
});

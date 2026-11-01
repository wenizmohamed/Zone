import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const savedCrime = {
  id: 'shoplift', name_en: 'Shoplift', name_ar: 'سرقة متجر', nerve_cost: 2,
  successRate: 75, cash_min: 100, cash_max: 250, xp_reward: 10, enabled: true,
};

function admin({ save = async () => ({ crime: { ...savedCrime } }), request, network, ready = true, gameplayCatalog = null, search = '', storedLanguage = null, cacheFails = false } = {}) {
  const elements = new Map();
  const calls = [], notices = [];
  let app;
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
    URL, URLSearchParams,
    AbortController,
    setTimeout: () => 0, clearTimeout() {},
    location: { search, origin: 'https://zone.test', href: 'https://zone.test/admin' + search },
    fetch: network,
    localStorage: { getItem: key => key === 'zone.admin.language' ? storedLanguage : null, setItem() { if (cacheFails) throw new Error('Quota exceeded'); }, removeItem() {} },
    document: { documentElement: {}, querySelector: element, querySelectorAll: () => [] },
    noticeStub: message => notices.push(message),
    apiStub: async (url, options) => { calls.push({ url, options }); return request ? request(url, options) : url === '/api/v1/admin/session' ? { configured: false, authenticated: true, localDevelopment: true } : url === '/api/v1/admin/draft' && !options?.method ? JSON.parse(JSON.stringify(app.state.draft)) : options?.method === 'PUT' ? save(url, options) : { events: [], entries: [] }; },
  });
  // Execute the actual admin functions without booting a network-backed page.
  const definitions = source.slice(0, source.indexOf('\ninstallSectionPreviews();'));
  runInContext(`${definitions}
    renderNavigation = renderOverview = renderBuilder = renderModules = renderThemes =
      renderTerritories = renderAssets = renderEconomy = renderEvents = renderReleases = () => {};
    ensureTerritoryMapPreview = refreshViewPreview = () => {};
    notify = noticeStub;
    const guardedApi = api;
    api = apiStub;
    globalThis.admin = { state, renderContent, applyLanguage, newCrime, saveCrime, saveDraft, publishRelease, activateRelease, mutateModule, activateTheme, applyTerritoryOwnership, addPage, addBlock, load, updateBootControls, guardedApi, renderGameplayCatalog, saveGameplayCatalog, catalogChanges, runtimeContentSnapshot, newGameplayCatalog, openAdminSession, showAdminSession, discardGameplayCatalog, discardCrimeEdits, unsavedContentEdits, resolveDraftConflict, refreshDraftAfterMutation, retryAdminLoad, markDirty, territoryCounts, supportedCatalogCategories, isSupportedCatalogCategory, isBootReady, isDirty, activeAdminLanguage, activeAdminView, hasDraftConflict, hasUnsavedChanges, crimeRuleFieldKeys, sectionPreviewViews, isSectionPreviewView, sectionPreviewScreenForView, draftEditRevisionCount, adminLanguageStorageKey, selectedCrimeId, credentialMode, isSessionRequired, isCatalogBusy, isControlBusy, selectedPageId, crimeCount, moduleCount, releaseCount, themeCount, adminDiagnostics };
  `, context);
  app = context.admin;
  app.state.crimes = [{ ...savedCrime }];
  app.state.gameplayCatalog = gameplayCatalog;
  if (ready) { app.state.bootReady = true; app.state.engine = {}; app.state.draft = { draftFingerprint: 'a'.repeat(64), manifest: { pages: [], navigation: [] } }; app.state.savedDraftManifest = JSON.stringify(app.state.draft.manifest); }
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

test('explicit English and Arabic admin routes override the opposite saved language, including failed bootstrap', async () => {
  for (const lang of ['en', 'ar']) {
    const app = admin({ search: '?lang=' + lang, storedLanguage: lang === 'en' ? 'ar' : 'en', ready: false, request: async () => { throw new Error('Offline'); } });
    assert.equal(app.state.language, lang);
    app.applyLanguage();
    await assert.rejects(app.load(), /Offline/);
    assert.match(app.element('#pipelineStatus').textContent, lang === 'en' ? /Unable to load/ : /تعذر تحميل/);
    assert.equal(app.element('#sessionLanguageButton').textContent, lang === 'en' ? 'العربية' : 'English');
  }
});

test('password-mode owner login sends existing credentials without tracing or retaining the password', async () => {
  const app = admin({ ready: false, request: async () => { throw new Error('Denied'); } });
  app.state.credentialMode = 'password'; app.applyLanguage();
  assert.equal(app.element('#adminUsernameField').hidden, false);
  assert.equal(app.element('#adminCredentialLabel').textContent, 'Password');
  app.element('#adminOwnerUsername').value = 'omar'; app.element('#adminOwnerToken').value = 'private fixture password';
  await app.openAdminSession({ preventDefault() {} });
  assert.deepEqual(JSON.parse(app.calls[0].options.body), { username: 'omar', password: 'private fixture password' });
  assert.equal(app.element('#adminOwnerToken').value, '');
  assert.doesNotMatch(app.element('#apiTrace').textContent, /private fixture/);
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

test('crime reward edits preserve the existing level gate, while explicit valid level edits persist in either locale', async () => {
  for (const language of ['en', 'ar']) {
    let payload;
    const app = admin({ save: async (_url, options) => {
      payload = JSON.parse(options.body); return { crime: { ...savedCrime, ...payload, successRate: payload.success_basis_points / 100 } };
    } });
    app.state.crimes[0].level_required = 7; app.renderContent(true); app.language(language);
    assert.equal(app.element('#crimeLevel').value, '7');
    app.element('#crimeCashMax').value = '300'; await app.saveCrime({ preventDefault() {} });
    assert.equal(payload.level_required, 7); assert.equal(app.state.crimes[0].level_required, 7);
    app.element('#crimeLevel').value = '8'; await app.saveCrime({ preventDefault() {} });
    assert.equal(payload.level_required, 8); app.language(language === 'en' ? 'ar' : 'en');
    assert.equal(app.element('#crimeLevel').value, '8');
  }
});

test('invalid crime level fields produce actionable localized errors and never send a write', async () => {
  for (const language of ['en', 'ar']) {
    const app = admin(); app.language(language);
    for (const value of ['', '0', '101', '2.5', 'Infinity']) {
      app.element('#crimeLevel').value = value; await app.saveCrime({ preventDefault() {} });
      assert.equal(app.calls.length, 0);
      assert.match(app.notices.at(-1), language === 'en' ? /Level required.*integer.*1.*100/ : /المستوى المطلوب.*صحيح.*١.*١٠٠/);
      assert.equal(app.element('#crimeLevel').value, value); assert.equal(app.state.controlBusy, '');
    }
  }
});

test('a late crime-save acknowledgement preserves a newer level edit as unsaved rather than silently replacing it', async () => {
  const gate = delayed(); let payload;
  const app = admin({ save: async (_url, options) => { payload = JSON.parse(options.body); await gate.promise; return { crime: { ...savedCrime, ...payload, successRate: 75 } }; } });
  app.element('#crimeLevel').value = '7'; const saving = app.saveCrime({ preventDefault() {} });
  app.element('#crimeLevel').value = '9'; gate.resolve(); await saving;
  assert.equal(payload.level_required, 7); assert.equal(app.state.crimes[0].level_required, 7);
  assert.equal(app.element('#crimeLevel').value, '9'); assert.equal(app.unsavedContentEdits().crime, true);
  await app.publishRelease(); assert.equal(app.calls.filter(call => call.url.includes('/publish')).length, 0);
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
  const fixture = { php: '8.5', database: 'sqlite', modules: [], themes: [], crimes: [savedCrime], entries: [], events: [], releases: [], draftFingerprint: 'a'.repeat(64), manifest: { pages: [], navigation: [] } };
  const app = admin({ ready: false, request: async url => { await gate; return url === '/api/v1/admin/session' ? { configured: false, authenticated: true, localDevelopment: true } : fixture; } });
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

function creationFixture() {
  const fixture = catalogFixture(), item = fixture.schema.items;
  item.creatable = true; item.required = ['type', 'price', 'name'];
  item.createTypes = ['weapon', 'medical', 'booster', 'material'];
  item.variants = { weapon: ['price', 'mult'], medical: ['price', 'life', 'nerve'], booster: ['price', 'life', 'nerve'], material: ['price'] };
  item.fields.type = { type: 'enum', values: ['weapon','armor','medical','booster','material'], editable: false };
  item.fields.description = { type: 'bilingual', maxLength: 360, allowEmpty: true };
  item.fields.image = { type: 'asset', maxLength: 240 };
  item.fields.life = { type: 'integer', min: 0, max: 100000 };
  return fixture;
}
function fillNewWeapon(app) {
  app.newGameplayCatalog();
  app.element('#catalogNewId').value = 'harbor-baton'; app.element('#catalogNewId').oninput();
  editCatalog(app, 'name.en', 'Harbor baton'); editCatalog(app, 'name.ar', 'عصا الميناء');
  editCatalog(app, 'price', '321'); editCatalog(app, 'mult', '2.75');
  editCatalog(app, 'description.en', 'Harbor weapon'); editCatalog(app, 'description.ar', 'سلاح الميناء');
  editCatalog(app, 'image', 'art/bio.jpg');
}
test('new typed content form retains ID, translated labels and media across locale switches', () => {
  const app = admin({ gameplayCatalog: creationFixture() }); fillNewWeapon(app);
  assert.equal(app.element('#catalogNewIdLabel').hidden, false);
  app.language('ar');
  assert.equal(app.element('#catalogNewId').value, 'harbor-baton');
  assert.equal(app.element('#catalogField-name-ar').value, 'عصا الميناء');
  assert.equal(app.element('#catalogField-image').value, 'art/bio.jpg');
  assert.doesNotMatch(app.element('#catalogFields').innerHTML, /value="armor"/);
  assert.equal(app.state.gameplayCatalog.catalogs.items['harbor-baton'], undefined);
});
test('new content sends full typed POST and selects canonical saved draft without publishing', async () => {
  const fixture = creationFixture(); let payload;
  const app = admin({ gameplayCatalog: fixture, request: async (url, options) => {
    assert.equal(url, '/api/v1/admin/gameplay-catalog/items'); assert.equal(options.method, 'POST'); payload = JSON.parse(options.body);
    return { ...fixture, revision: 3, created: { category: 'items', id: payload.id }, catalogs: { ...fixture.catalogs, items: { ...fixture.catalogs.items, [payload.id]: payload.definition } } };
  } });
  fillNewWeapon(app); await app.saveGameplayCatalog();
  assert.deepEqual(payload, { id: 'harbor-baton', expectedRevision: 2, definition: { price: 321, mult: 2.75, name: { en: 'Harbor baton', ar: 'عصا الميناء' }, type: 'weapon', description: { en: 'Harbor weapon', ar: 'سلاح الميناء' }, image: 'art/bio.jpg' } });
  assert.equal(app.state.catalogEntry, 'harbor-baton'); assert.equal(app.state.gameplayCatalog.revision, 3);
  assert.equal(app.element('#catalogNewIdLabel').hidden, true); assert.equal(app.calls.filter(call => call.options?.method).length, 1);
});

test('a delayed new-item acknowledgement preserves another category selection and its pending fields in both locales', async () => {
  for (const language of ['en', 'ar']) {
    const fixture = creationFixture(), gate = delayed();
    fixture.catalogs.jobs.push({ id: 'mechanic', pay: 950, energy: 12, lvl: 1 });
    const app = admin({ gameplayCatalog: fixture, request: async (url, options) => {
      if (url === '/api/v1/admin/draft') return JSON.parse(JSON.stringify(app.state.draft));
      assert.equal(url, '/api/v1/admin/gameplay-catalog/items');
      assert.equal(options.method, 'POST');
      const payload = JSON.parse(options.body); await gate.promise;
      return { ...fixture, revision: 3, created: { category: 'items', id: payload.id }, catalogs: { ...fixture.catalogs, items: { ...fixture.catalogs.items, [payload.id]: payload.definition } } };
    } });
    fillNewWeapon(app); const saving = app.saveGameplayCatalog();
    app.state.catalogCategory = 'jobs'; app.state.catalogEntry = 'mechanic';
    app.state.catalogEdits['jobs/mechanic'] = { pay: '999' }; app.language(language);
    gate.resolve(); await saving;
    assert.equal(app.state.catalogCategory, 'jobs');
    assert.equal(app.state.catalogEntry, 'mechanic');
    assert.equal(app.element('#catalogField-pay').value, '999');
    assert.equal(app.state.catalogEdits['items/__new'], undefined);
    assert.equal(app.state.catalogNewIds.items, undefined);
    assert.equal(app.state.gameplayCatalog.catalogs.items['harbor-baton'].name.ar, 'عصا الميناء');
    assert.equal(app.calls.filter(call => call.options?.method).length, 1);
    assert.equal(app.calls.filter(call => call.url.includes('/publish')).length, 0);
  }
});
test('new content changes item variants and blocks bad IDs or asset URLs before POST', async () => {
  const app = admin({ gameplayCatalog: creationFixture() }); fillNewWeapon(app);
  editCatalog(app, 'type', 'medical'); assert.match(app.element('#catalogFields').innerHTML, /catalogField-life/); assert.doesNotMatch(app.element('#catalogFields').innerHTML, /catalogField-mult/);
  app.element('#catalogNewId').value = '../bad'; app.element('#catalogNewId').oninput(); await app.saveGameplayCatalog(); assert.equal(app.calls.length, 0);
  app.element('#catalogNewId').value = 'harbor-medicine'; app.element('#catalogNewId').oninput();
  editCatalog(app, 'image', 'https://untrusted.test/a.jpg'); await app.saveGameplayCatalog(); assert.equal(app.calls.length, 0);
});
test('stale creation refreshes current revision while retaining unsaved new definition and ID', async () => {
  const fixture = creationFixture();
  const app = admin({ gameplayCatalog: fixture, request: async (url, options) => { if (options?.method === 'POST') throw new Error('Gameplay catalog changed. Refresh and try again.'); return { ...fixture, revision: 4 }; } });
  fillNewWeapon(app); await app.saveGameplayCatalog();
  assert.equal(app.calls.filter(call => call.options?.method === 'POST').length, 1);
  assert.equal(app.state.gameplayCatalog.revision, 4); assert.equal(app.state.catalogEntry, '__new'); assert.equal(app.element('#catalogNewId').value, 'harbor-baton'); assert.equal(app.element('#catalogField-mult').value, '2.75');
});
test('owner session gate runs before protected boot reads and preserves disabled mutations', async () => {
  const app = admin({ ready: false, request: async () => ({ configured: true, authenticated: false, localDevelopment: false }) });
  await app.load(); assert.equal(app.calls.length, 1); assert.equal(app.calls[0].url, '/api/v1/admin/session');
  assert.equal(app.state.sessionRequired, true); assert.equal(app.state.bootReady, false); assert.equal(app.element('#publishButton').disabled, true);
  app.language('ar'); assert.equal(app.state.sessionRequired, true);
});
test('owner session token is cleared after failure and never appears in API trace', async () => {
  const app = admin({ ready: false, request: async () => { throw new Error('Rejected'); }, network: async () => ({ ok: true, status: 200, json: async () => ({ configured: true, authenticated: true, localDevelopment: false }) }) });
  app.element('#adminOwnerToken').value = 'example-test-secret'; await app.openAdminSession();
  assert.equal(app.element('#adminOwnerToken').value, ''); assert.equal(app.state.bootReady, false); assert.match(app.element('#adminSessionError').textContent, /Access could not be verified/);
  await app.guardedApi('/api/v1/admin/session', { method: 'POST', body: JSON.stringify({ token: 'example-test-secret' }) });
  assert.doesNotMatch(app.element('#apiTrace').textContent, /example-test-secret|token/);
});
test('missing production owner configuration and malformed session responses stop boot', async () => {
  for (const response of [{ configured: false, authenticated: false, localDevelopment: false }, {}]) {
    const app = admin({ ready: false, request: async () => response });
    await assert.rejects(app.load()); assert.equal(app.calls.length, 1); assert.equal(app.state.bootReady, false);
  }
});

function releaseDraft(name = 'Original', fingerprint = 'a'.repeat(64)) {
  return { draftFingerprint: fingerprint, manifest: { branding: { name: { en: name, ar: 'منطقة' }, accent: '#c99a45' }, announcement: { enabled: false, text: { en: '', ar: '' } }, pages: [], navigation: [] } };
}
function setDraft(app, draft = releaseDraft()) {
  app.state.draft = JSON.parse(JSON.stringify(draft));
  const { content, ...authoring } = draft.manifest;
  app.state.savedDraftManifest = JSON.stringify(authoring);
}
function delayed() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('publishing cannot silently omit unsaved existing or new catalog content', async () => {
  for (const creating of [false, true]) {
    const app = admin({ gameplayCatalog: creationFixture() }); setDraft(app);
    if (creating) fillNewWeapon(app); else editCatalog(app, 'price', '1200');
    await app.publishRelease();
    assert.equal(app.calls.length, 0); assert.equal(app.state.view, 'content');
    assert.match(app.notices.at(-1), /Save or discard/);
    assert.equal(app.element('#catalogField-price').value, creating ? '321' : '1200');
  }
});
test('publishing cannot silently omit an unsaved crime form in either locale', async () => {
  for (const language of ['en', 'ar']) {
    const app = admin(); setDraft(app); app.language(language);
    app.element('#crimeNameEn').value = 'Unsaved crime';
    await app.publishRelease();
    assert.equal(app.calls.length, 0); assert.equal(app.state.view, 'content');
    assert.equal(app.element('#crimeNameEn').value, 'Unsaved crime');
    assert.match(app.notices.at(-1), language === 'en' ? /before publishing/ : /قبل النشر/);
  }
});
test('discarding catalog edits clears only the selected entry and cancels a new definition without writing', () => {
  const app = admin({ gameplayCatalog: creationFixture() }); editCatalog(app, 'price', '1200');
  app.state.catalogEdits['jobs/grocer'] = { pay: '900' };
  app.discardGameplayCatalog();
  assert.equal(app.element('#catalogField-price').value, '990'); assert.equal(app.state.catalogEdits['items/drink'], undefined);
  assert.equal(app.state.catalogEdits['jobs/grocer'].pay, '900');
  fillNewWeapon(app); app.discardGameplayCatalog();
  assert.notEqual(app.state.catalogEntry, '__new'); assert.equal(app.state.catalogNewIds.items, undefined); assert.equal(app.calls.length, 0);
});
test('saving an unchanged catalog value clears the unsaved marker without sending a write', async () => {
  const app = admin({ gameplayCatalog: catalogFixture() }); editCatalog(app, 'price', '990');
  await app.saveGameplayCatalog(); assert.equal(app.calls.length, 0); assert.equal(app.unsavedContentEdits().catalog, null);
});
test('a late draft save preserves edits typed during the request and prevents publishing a partial release', async () => {
  const gate = delayed(); let submitted;
  const app = admin({ request: async (url, options) => {
    assert.equal(url, '/api/v1/admin/draft'); submitted = JSON.parse(options.body);
    await gate.promise; return { ...releaseDraft('Original', 'b'.repeat(64)), manifest: submitted.manifest };
  } }); setDraft(app);
  const pending = app.publishRelease();
  assert.equal(app.element('#publishButton').disabled, true);
  app.state.draft.manifest.branding.name.en = 'Newer edit'; app.markDirty();
  gate.resolve(); await pending;
  assert.equal(submitted.expectedFingerprint, 'a'.repeat(64));
  assert.equal(app.state.draft.manifest.branding.name.en, 'Newer edit'); assert.equal(app.state.dirty, true);
  assert.equal(app.state.draft.draftFingerprint, 'b'.repeat(64));
  assert.equal(app.calls.filter(call => call.url.includes('/publish')).length, 0);
  assert.equal(app.element('#publishButton').disabled, false); assert.equal(app.state.controlBusy, '');
});
test('double publish clicks produce exactly one save and one publish using the saved fingerprint', async () => {
  const gate = delayed(); let publishPayload;
  const app = admin({ request: async (url, options) => {
    if (url === '/api/v1/admin/draft' && options?.method === 'PUT') { await gate.promise; return { ...releaseDraft('Original', 'b'.repeat(64)), manifest: JSON.parse(options.body).manifest }; }
    if (url.endsWith('/publish')) { publishPayload = JSON.parse(options.body); return { id: 'new-release', version: 2, manifest: releaseDraft().manifest, active: true }; }
    return releaseDraft('Original', 'c'.repeat(64));
  } }); setDraft(app);
  const first = app.publishRelease(); await app.publishRelease(); await app.activateRelease('old-release');
  gate.resolve(); await first;
  assert.equal(app.calls.filter(call => call.options?.method === 'PUT').length, 1);
  assert.equal(app.calls.filter(call => call.url.endsWith('/publish')).length, 1);
  assert.equal(app.calls.filter(call => call.url.endsWith('/activate')).length, 0);
  assert.deepEqual(publishPayload, { expectedFingerprint: 'b'.repeat(64) });
  assert.equal(app.state.engine.activeReleaseId, 'new-release'); assert.equal(app.state.draft.draftFingerprint, 'c'.repeat(64));
  assert.equal(app.element('#publishButton').disabled, false);
});
test('a failed publish leaves the prior active release and unlocks retry without replaying', async () => {
  const app = admin({ request: async (url, options) => {
    if (url.endsWith('/publish')) throw new Error('Publishing unavailable');
    return { ...releaseDraft('Original', 'b'.repeat(64)), manifest: JSON.parse(options.body).manifest };
  } }); setDraft(app); app.state.engine.activeReleaseId = 'previous';
  await app.publishRelease();
  assert.equal(app.state.engine.activeReleaseId, 'previous'); assert.equal(app.state.releases.length, 0);
  assert.match(app.notices.at(-1), /Publishing unavailable/); assert.equal(app.state.controlBusy, ''); assert.equal(app.element('#publishButton').disabled, false);
});
test('stale release save keeps local edits, exposes current server data, and never auto-replays or rebases', async () => {
  const server = releaseDraft('Other owner edit', 'b'.repeat(64));
  const app = admin({ request: async (url, options) => {
    if (options?.method) throw new Error('Release draft changed. Refresh and try again.'); return server;
  } }); setDraft(app); app.state.draft.manifest.branding.name.en = 'My unsaved title'; app.markDirty();
  await app.saveDraft(); await app.publishRelease();
  assert.equal(app.calls.filter(call => call.options?.method).length, 1);
  assert.equal(app.state.draft.draftFingerprint, 'a'.repeat(64)); assert.equal(app.state.draft.manifest.branding.name.en, 'My unsaved title');
  assert.equal(app.state.draftConflict.draftFingerprint, 'b'.repeat(64));
  assert.match(app.element('#draftConflictServer').value, /Other owner edit/); assert.match(app.element('#draftConflictLocal').value, /My unsaved title/);
  app.resolveDraftConflict(false);
  assert.equal(app.state.draft.draftFingerprint, 'b'.repeat(64)); assert.equal(app.state.draft.manifest.branding.name.en, 'My unsaved title');
  assert.equal(app.state.draftConflict, null); assert.equal(app.state.dirty, true); assert.equal(app.calls.filter(call => call.options?.method).length, 1);
});
test('choosing server draft explicitly replaces only page/branding edits and preserves unsaved catalog edits', async () => {
  const app = admin({ gameplayCatalog: creationFixture() }); setDraft(app); editCatalog(app, 'price', '1200');
  app.state.draftConflict = releaseDraft('Server chosen', 'b'.repeat(64)); app.resolveDraftConflict(true);
  assert.equal(app.state.draft.manifest.branding.name.en, 'Server chosen'); assert.equal(app.state.catalogEdits['items/drink'].price, '1200');
  assert.equal(app.state.dirty, false); assert.equal(app.calls.length, 0);
});
test('configuration fingerprint refresh does not silently adopt a concurrently changed page draft', async () => {
  const app = admin({ request: async () => releaseDraft('Other page edit', 'b'.repeat(64)) }); setDraft(app);
  app.state.draft.manifest.branding.name.en = 'My draft'; app.markDirty();
  assert.equal(await app.refreshDraftAfterMutation(), false);
  assert.equal(app.state.draft.draftFingerprint, 'a'.repeat(64)); assert.equal(app.state.draft.manifest.branding.name.en, 'My draft');
  assert.equal(app.state.draftConflict.manifest.branding.name.en, 'Other page edit');
});
test('crime writes remain acknowledged when audit refresh fails and cannot be duplicated in flight', async () => {
  const gate = delayed();
  const app = admin({ request: async (url, options) => {
    if (options?.method) { await gate.promise; return { crime: { ...savedCrime, name_en: 'Persisted crime' } }; }
    if (url === '/api/v1/admin/draft') return releaseDraft('Original', 'b'.repeat(64));
    throw new Error('Evidence offline');
  } }); setDraft(app); app.element('#crimeNameEn').value = 'Persisted crime';
  const first = app.saveCrime({ preventDefault() {} }); await app.saveCrime({ preventDefault() {} }); gate.resolve(); await first;
  assert.equal(app.calls.filter(call => call.options?.method).length, 1);
  assert.equal(app.state.crimes[0].name_en, 'Persisted crime'); assert.equal(app.state.draft.draftFingerprint, 'b'.repeat(64));
  assert.match(app.notices.at(-1), /Saved to the server/); assert.equal(app.state.controlBusy, '');
});
test('a browser cache quota failure cannot turn a committed release into a failed publish', async () => {
  const app = admin({ cacheFails: true, request: async (url, options) => {
    if (url.endsWith('/publish')) return { id: 'committed', version: 3, manifest: releaseDraft().manifest, active: true };
    return { ...releaseDraft('Original', 'b'.repeat(64)), manifest: options?.body ? JSON.parse(options.body).manifest : releaseDraft().manifest };
  } }); setDraft(app); await app.publishRelease();
  assert.equal(app.state.engine.activeReleaseId, 'committed'); assert.equal(app.state.releases[0].id, 'committed');
  assert.ok(app.notices.some(notice => /browser could not update/.test(notice)));
  assert.equal(app.calls.filter(call => call.url.endsWith('/publish')).length, 1); assert.equal(app.state.controlBusy, '');
});
test('failed bootstrap exposes bilingual in-page retry and a repeated click cannot overlap reads', async () => {
  const gate = delayed(); let fail = true;
  const fixture = { php: '8.5', database: 'sqlite', modules: [], themes: [], crimes: [savedCrime], entries: [], events: [], releases: [], ...releaseDraft() };
  const app = admin({ ready: false, request: async url => {
    if (fail) throw new Error('Offline'); await gate.promise;
    return url.endsWith('/session') ? { configured: false, authenticated: true, localDevelopment: true } : fixture;
  } }); await app.retryAdminLoad();
  assert.equal(app.element('#adminRecovery').hidden, false); assert.equal(app.element('#adminRecoveryDetail').textContent, 'Offline');
  app.language('ar'); assert.equal(app.element('#adminRecovery').hidden, false);
  fail = false; const pending = app.retryAdminLoad(); await app.retryAdminLoad();
  assert.equal(app.element('#retryAdminButton').disabled, true); assert.equal(app.state.bootBusy, true);
  gate.resolve(); await pending;
  assert.equal(app.state.bootReady, true); assert.equal(app.element('#adminRecovery').hidden, true); assert.equal(app.element('#retryAdminButton').disabled, false);
});
test('typing a newer crime edit while a save runs preserves it instead of replacing it with the acknowledgement', async () => {
  const gate = delayed(); const app = admin({ save: async () => { await gate.promise; return { crime: { ...savedCrime, name_en: 'Submitted' } }; } });
  app.element('#crimeNameEn').value = 'Submitted'; const pending = app.saveCrime({ preventDefault() {} });
  app.element('#crimeNameEn').value = 'Newer unsaved'; gate.resolve(); await pending;
  assert.equal(app.state.crimes[0].name_en, 'Submitted'); assert.equal(app.element('#crimeNameEn').value, 'Newer unsaved');
  assert.equal(app.unsavedContentEdits().crime, true);
  app.language('ar'); assert.equal(app.element('#crimeNameEn').value, 'Newer unsaved');
  app.discardCrimeEdits(); assert.equal(app.element('#crimeNameEn').value, 'Submitted'); assert.equal(app.unsavedContentEdits().crime, false);
});
test('selecting another crime during an in-flight save does not steal its form on completion', async () => {
  const gate = delayed(); const app = admin({ save: async () => { await gate.promise; return { crime: { ...savedCrime, name_en: 'Submitted' } }; } });
  app.state.crimes.push({ ...savedCrime, id: 'other-crime', name_en: 'Other crime' });
  const pending = app.saveCrime({ preventDefault() {} });
  app.state.selectedCrime = 'other-crime'; app.renderContent(); app.element('#crimeNameEn').value = 'Other unsaved';
  gate.resolve(); await pending;
  assert.equal(app.state.selectedCrime, 'other-crime'); assert.equal(app.element('#crimeNameEn').value, 'Other unsaved');
  assert.equal(app.state.crimes.find(crime => crime.id === 'shoplift').name_en, 'Submitted');
});
test('module and theme writes acknowledge commit if follow-up reads fail and unlock without a duplicate write', async () => {
  for (const method of ['mutateModule', 'activateTheme']) {
    const gate = delayed(); const app = admin({ request: async (_url, options) => {
      if (options?.method) { await gate.promise; return {}; } throw new Error('Read unavailable');
    } });
    const pending = method === 'mutateModule' ? app.mutateModule('crime', 'disable') : app.activateTheme('terminal');
    await app.activateTheme('zone'); gate.resolve(); await pending;
    assert.equal(app.calls.filter(call => call.options?.method).length, 1); assert.equal(app.state.controlBusy, '');
    assert.match(app.notices.at(-1), /Saved to the server/);
  }
});
test('an incomplete draft fingerprint keeps boot mutations locked', async () => {
  const fixture = { php: '8.5', database: 'sqlite', modules: [], themes: [], crimes: [], entries: [], events: [], releases: [], manifest: { pages: [], navigation: [] } };
  const app = admin({ ready: false, request: async url => url.endsWith('/session') ? { configured: false, authenticated: true, localDevelopment: true } : fixture });
  await assert.rejects(app.load(), /incomplete/); assert.equal(app.state.bootReady, false); assert.equal(app.element('#publishButton').disabled, true);
});
test('territoryCounts computes total, owned, neutral, contested and daily respect totals', () => {
  const app = admin();
  app.state.territoryCatalog.blocks = [
    { id: 'ZC-001', ownerFactionId: 'vipers', state: 'owned', dailyRespect: 25 },
    { id: 'ZC-002', ownerFactionId: null, state: 'neutral', dailyRespect: 15 },
    { id: 'ZC-003', ownerFactionId: 'kings', state: 'contested', dailyRespect: 40 },
  ];
  assert.deepEqual({ ...app.territoryCounts() }, {
    total: 3, owned: 2, neutral: 1, contested: 1, totalDailyRespect: 80, ownedDailyRespect: 65,
  });
  const diag = app.adminDiagnostics();
  assert.equal(diag.bootReady, true);
  assert.equal(diag.crimeCount, 1);
  assert.equal(diag.territoryCount, 3);
  assert.equal(diag.hasDraft, true);
  assert.equal(app.supportedCatalogCategories().length, 8);
  assert.equal(app.isSupportedCatalogCategory('items'), true);
  assert.equal(app.isSupportedCatalogCategory('unknown'), false);
  assert.equal(app.isBootReady(), true);
  assert.equal(app.isDirty(), false);
  assert.equal(app.activeAdminLanguage(), 'en');
  assert.equal(app.activeAdminView(), 'overview');
  assert.equal(app.hasDraftConflict(), false);
  assert.equal(app.hasUnsavedChanges(), false);
  assert.equal(app.crimeRuleFieldKeys().length, 9);
  assert.equal(app.sectionPreviewViews().length, 8);
  assert.equal(app.isSectionPreviewView('modules'), true);
  assert.equal(app.isSectionPreviewView('unknown'), false);
  assert.equal(app.sectionPreviewScreenForView('assets'), 'items');
  assert.equal(app.draftEditRevisionCount(), 0);
  assert.equal(app.adminLanguageStorageKey(), 'zone.admin.language');
  assert.equal(app.selectedCrimeId(), 'shoplift');
  assert.equal(app.credentialMode(), 'token');
  assert.equal(app.isSessionRequired(), false);
  assert.equal(app.isCatalogBusy(), false);
  assert.equal(app.isControlBusy(), false);
  assert.equal(app.selectedPageId(), null);
  assert.equal(app.crimeCount(), 1);
  assert.equal(app.moduleCount(), 0);
  assert.equal(app.releaseCount(), 0);
  assert.equal(app.themeCount(), 0);
});

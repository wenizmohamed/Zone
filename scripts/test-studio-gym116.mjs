import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

// Explicit local release gate, not a Node-only cloud or browser/pixel test.
// Starts an owned loopback PHP with a new SQLite file. No live fixture copy,
// owner playtest, stat grants, source editing or production publication.
const root = resolve(import.meta.dirname, '..');
const adminSource = readFileSync(resolve(root, 'admin.js'), 'utf8');
const runtimeSource = readFileSync(resolve(root, 'platform-runtime.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function editor(catalog, draft, content, lang) {
  const nodes = new Map(), storage = new Map();
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', innerHTML: '', textContent: '', hidden: false, disabled: false, setAttribute() {}, focus() {} });
    return nodes.get(selector);
  };
  const context = createContext({ console, URL, URLSearchParams, AbortController, setTimeout: () => 0, clearTimeout() {},
    location: { search: '?lang=' + lang, origin: 'https://zone.test', href: 'https://zone.test/admin' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: {}, querySelector: element, querySelectorAll: () => [] } });
  const boundary = adminSource.indexOf('\ninstallSectionPreviews();');
  assert.ok(boundary > 0, 'Read the real editor definitions without starting browser boot.');
  runInContext(adminSource.slice(0, boundary) + '\nglobalThis.app={state,renderGameplayCatalog,catalogChanges,runtimeContentSnapshot,manifestWithRuntimeContent,updatePreviewCache};', context);
  const app = context.app;
  Object.assign(app.state, { language: lang, bootReady: true, catalogCategory: 'gyms', catalogEntry: '0',
    gameplayCatalog: plain(catalog), draft: plain(draft), crimes: plain(content.crimes),
    modules: plain(content.modules), themes: plain(content.themes) });
  return { ...app, element, storage };
}

function preview(storage, lang) {
  let requests = 0;
  const context = createContext({ console, URLSearchParams, location: { search: '?zone-preview=1&screen=gym&lang=' + lang },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem() {} },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } } },
    window: {}, addEventListener() {}, setInterval() {}, fetch: async () => { requests++; throw new Error('Preview must not call the player API.'); } });
  runInContext(runtimeSource, context);
  return { platform: context.window.ZonePlatform, requests: () => requests };
}

test('Studio Gym edit, retained fields, preview, publication and ordinary server training round trip', { timeout: 30000 }, async t => {
  const fixture = resolve(root, '.tools/studio-gym116', randomUUID());
  mkdirSync(fixture, { recursive: true });
  const database = resolve(fixture, 'ordinary.sqlite');
  const php = [resolve(root, '.tools/php-8.5.10/php.exe'), resolve(root, '../php-8.5.10/php.exe'), process.env.ZONE_TEST_PHP].find(path => path && existsSync(path));
  assert.ok(php, 'The existing PHP runtime is required. This HTTP gate never silently skips.');
  const adminToken = randomUUID() + randomUUID();
  const evidence = { kind: 'real isolated SQLite HTTP plus actual Studio form/preview code in VM',
    sourceSha256: { 'admin.js': sha256(adminSource), 'platform-runtime.js': sha256(runtimeSource),
      'scripts/test-studio-gym116.mjs': sha256(readFileSync(import.meta.filename)) },
    database, productionRequests: 0, browserPixels: false, ownerPlaytestGrants: 0, walletOrStatFixtures: 0,
    playerGymMediaUi: 'Published image metadata retained. This HTTP/VM gate does not assert player image rendering.',
    supportedGymFields: ['e', 'xp', 'cost', 'name.en', 'name.ar', 'description.en', 'description.ar', 'image'],
    unsupportedGymControls: ['create-new-gym', 'base-gain-coefficient', 'happiness-formula', 'uploaded-gym-model'], stages: [] };
  for (const path of ['engine/router.php', 'engine/src/Application/GameEngine.php', 'engine/src/Core/Content/GameplayCatalog.php', 'engine/src/Core/Publishing/ReleaseManager.php']) {
    evidence.sourceSha256[path] = sha256(readFileSync(resolve(root, path)));
  }
  const probe = createServer();
  await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const base = 'http://127.0.0.1:' + port;
  let child;
  const stop = async () => {
    if (child?.exitCode === null) await new Promise(done => { child.once('exit', done); child.kill(); });
  };
  const api = async (path, options = {}, { owner = false, jar } = {}) => {
    const url = new URL(path, 'http://zone.test');
    assert.equal(url.origin, 'http://zone.test', 'All requests remain on the owned loopback target.');
    const response = await fetch(base + url.pathname + url.search, { ...options,
      headers: { ...options.headers, Accept: 'application/json', Origin: 'https://127.0.0.1:' + port,
        'X-Forwarded-Proto': 'https', ...(owner ? { 'X-Zone-Admin-Token': adminToken } : {}), ...(jar?.cookie ? { Cookie: jar.cookie } : {}) } });
    for (const value of response.headers.getSetCookie()) if (jar && value.startsWith('zone_player_session=')) jar.cookie = value.split(';')[0];
    return response;
  };
  const json = async (expected, method, path, body, access = {}) => {
    const response = await api(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }, access);
    const value = await response.json();
    assert.equal(response.status, expected, method + ' ' + path + ': ' + (value.error ?? 'unexpected status'));
    return value;
  };
  const owner = { owner: true }, jar = {}, player = { jar };
  const catalog = () => json(200, 'GET', '/api/v1/admin/gameplay-catalog', undefined, owner);
  const draft = () => json(200, 'GET', '/api/v1/admin/draft', undefined, owner);
  const bootstrap = () => json(200, 'GET', '/api/v1/game/bootstrap', undefined, player);
  const gameplay = () => json(200, 'GET', '/api/v1/gameplay', undefined, player);
  const start = async () => {
    const log = openSync(resolve(fixture, 'php.log'), 'a');
    child = spawn(php, ['-d', 'opcache.enable=0', '-S', '127.0.0.1:' + port, '-t', root, resolve(root, 'engine/router.php')], {
      cwd: root, windowsHide: true, shell: false, stdio: ['ignore', log, log],
      env: { ...process.env, ZONE_DATABASE_URL: 'sqlite:' + database, DATABASE_URL: '', POSTGRES_URL: '',
        VERCEL: '1', ZONE_PLAYER_SESSIONS: '1', ZONE_PLAYER_AUTH: '', ZONE_ENGINE_ORIGIN: '', ZONE_ENGINE_RELAY_KEY: '',
        ZONE_ADMIN_TOKEN: adminToken, ZONE_ADMIN_USERNAME: '', ZONE_ADMIN_PASSWORD_HASH: '', ZONE_ADMIN_SESSION_SECRET: '',
        ZONE_BETA_OWNER_ACCESS: '0', ZONE_CACHE_DRIVER: 'array', REDIS_URL: '', ZONE_REDIS_URL: '', ZONE_ASSET_ROOT: resolve(fixture, 'assets') },
    });
    closeSync(log);
    let health;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Owned PHP helper exited before readiness.');
      try { const response = await api('/api/v1/health'); if (response.ok) { health = await response.json(); break; } } catch {}
      await new Promise(done => setTimeout(done, 50));
    }
    assert.equal(health?.engine?.database, 'sqlite');
    assert.equal(readFileSync(database).subarray(0, 16).toString(), 'SQLite format 3\0');
  };
  t.after(async () => { await stop(); writeFileSync(resolve(fixture, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n'); });
  await start();
  const baseDraft = await draft();
  const baselineRelease = await json(201, 'POST', '/api/v1/admin/releases/publish', { expectedFingerprint: baseDraft.draftFingerprint }, owner);
  const session = await json(201, 'POST', '/api/v1/auth/session', {}, player);
  assert.match(session.playerId, /^player-/); assert.doesNotMatch(session.playerId, /owner-playtest|founder/);
  const original = await gameplay(), baseline = await bootstrap(), originalCatalog = await catalog();
  assert.equal(original.player.id, session.playerId);
  assert.equal(original.player.cash, 2500);
  assert.equal(baseline.release.id, baselineRelease.id);
  const originalGym = originalCatalog.catalogs.gyms[0];
  assert.equal(originalGym.e, 5);
  const actualSchema = originalCatalog.schema.gyms;
  assert.deepEqual(Object.keys(actualSchema.fields), ['e', 'xp', 'cost', 'name', 'description', 'image']);
  assert.equal(actualSchema.creatable, false);
  await json(401, 'GET', '/api/v1/admin/gameplay-catalog', undefined, player);

  const content = { crimes: (await json(200, 'GET', '/api/v1/admin/crimes', undefined, owner)).crimes,
    modules: (await json(200, 'GET', '/api/v1/modules', undefined, owner)).modules,
    themes: (await json(200, 'GET', '/api/v1/themes', undefined, owner)).themes };
  const metadata = { name: { en: 'Harbor Yard training', ar: 'تدريب ساحة الميناء' },
    description: { en: 'An isolated operator-authored Gym definition.', ar: 'تعريف صالة أنشأه المشغل للاختبار المعزول.' }, image: 'art/zone-gym-interior-v105.webp' };
  let saved;
  await t.test('real EN/AR editor edits preserve untouched fields and survive selection and locale changes', async () => {
    const app = editor(originalCatalog, await draft(), content, 'en');
    app.renderGameplayCatalog();
    for (const [field, value] of Object.entries({ e: '7', 'name-en': metadata.name.en, 'name-ar': metadata.name.ar,
      'description-en': metadata.description.en, 'description-ar': metadata.description.ar, image: metadata.image })) {
      const input = app.element('#catalogField-' + field); input.value = value; input.oninput();
    }
    const changes = plain(app.catalogChanges());
    assert.deepEqual(changes, { e: 7, ...metadata });
    assert.equal(Object.hasOwn(changes, 'xp'), false); assert.equal(Object.hasOwn(changes, 'cost'), false);
    app.state.catalogEntry = '1'; app.renderGameplayCatalog();
    app.state.catalogEntry = '0'; app.state.language = 'ar'; app.renderGameplayCatalog();
    assert.deepEqual(plain(app.catalogChanges()), changes);
    assert.equal(app.element('#catalogField-name-ar').value, metadata.name.ar);
    saved = await json(200, 'PUT', '/api/v1/admin/gameplay-catalog/gyms/0', { changes, expectedRevision: originalCatalog.revision }, owner);
    assert.deepEqual(saved.catalogs.gyms[0], { ...originalGym, ...changes });
    const second = editor(saved, await draft(), content, 'ar');
    second.renderGameplayCatalog();
    second.element('#catalogField-e').value = '9'; second.element('#catalogField-e').oninput();
    assert.deepEqual(plain(second.catalogChanges()), { e: 9 });
    saved = await json(200, 'PUT', '/api/v1/admin/gameplay-catalog/gyms/0', { changes: plain(second.catalogChanges()), expectedRevision: saved.revision }, owner);
    assert.deepEqual(saved.catalogs.gyms[0], { ...originalGym, ...metadata, e: 9 });
    assert.deepEqual({ ...saved.catalogs, gyms: originalCatalog.catalogs.gyms }, originalCatalog.catalogs, 'All unrelated definitions remain exact.');
    evidence.stages.push('actual EN/AR editor input, selection/locale retention and two real catalog saves');
  });
  assert.ok(saved);
  const currentDraft = await draft();
  let previewManifest;
  await t.test('actual preview cache protocol contains the saved Gym in EN/AR without player API requests', async () => {
    for (const lang of ['en', 'ar']) {
      const app = editor(saved, currentDraft, content, lang);
      app.updatePreviewCache();
      const inspection = preview(app.storage, lang);
      assert.equal(inspection.platform.preview, true);
      assert.equal(inspection.platform.status(), 'preview');
      assert.deepEqual(plain(inspection.platform.data().gameplayCatalog.gyms[0]), saved.catalogs.gyms[0]);
      assert.equal(inspection.platform.data().gameplayCatalog.gyms[0].name[lang], metadata.name[lang]);
      await inspection.platform.refresh();
      assert.equal(inspection.requests(), 0);
      previewManifest = plain(app.manifestWithRuntimeContent());
    }
    const savedPreview = await json(200, 'PUT', '/api/v1/admin/draft', { manifest: previewManifest, expectedFingerprint: currentDraft.draftFingerprint }, owner);
    assert.deepEqual(savedPreview.manifest.content.gameplayCatalog.gyms[0], saved.catalogs.gyms[0]);
    evidence.stages.push('actual preview cache and saved preview payload, no rendered-pixel claim');
  });
  await t.test('draft edits do not leak and invalid or stale writes cannot erase reviewed fields', async () => {
    assert.equal((await bootstrap()).content.gameplayCatalog.gyms[0].e, originalGym.e);
    assert.equal((await gameplay()).catalogs.gyms[0].e, originalGym.e);
    await json(409, 'PUT', '/api/v1/admin/gameplay-catalog/gyms/0', { changes: { e: 2 }, expectedRevision: originalCatalog.revision }, owner);
    await json(422, 'PUT', '/api/v1/admin/gameplay-catalog/gyms/0', { changes: { baseGain: 999 }, expectedRevision: saved.revision }, owner);
    await json(422, 'POST', '/api/v1/admin/gameplay-catalog/gyms', { id: 'new-gym116', definition: { e: 1, xp: 0, cost: 1, name: metadata.name }, expectedRevision: saved.revision }, owner);
    await json(401, 'PUT', '/api/v1/admin/gameplay-catalog/gyms/0', { changes: { e: 2 }, expectedRevision: saved.revision }, player);
    assert.deepEqual((await catalog()).catalogs, saved.catalogs);
    assert.equal((await gameplay()).player.cash, original.player.cash);
    evidence.stages.push('draft isolation and stale/unsupported/ordinary-player write rejection');
  });
  let published, trained;
  await t.test('reviewed publication changes ordinary-player catalog and actual server training cost', async () => {
    const reviewed = await draft();
    published = await json(201, 'POST', '/api/v1/admin/releases/publish', { expectedFingerprint: reviewed.draftFingerprint }, owner);
    const live = await bootstrap(), beforeTraining = await gameplay();
    assert.equal(live.release.id, published.id);
    assert.deepEqual(live.content.gameplayCatalog.gyms[0], saved.catalogs.gyms[0]);
    assert.deepEqual(beforeTraining.catalogs.gyms[0], saved.catalogs.gyms[0]);
    assert.equal(beforeTraining.player.id, session.playerId);
    assert.equal(beforeTraining.player.cash, original.player.cash, 'Publishing never grants or debits player money.');
    trained = await json(200, 'POST', '/api/v1/gym/train', { stat: 'strength', sessions: 1 }, player);
    assert.equal(trained.cost.energy, 9);
    assert.equal(beforeTraining.player.energy - trained.player.energy, 9);
    assert.equal(trained.player.strength - beforeTraining.player.strength, trained.gain);
    assert.ok(trained.gain > 0 && trained.serverProof.eventId && trained.serverProof.correlationId);
    assert.match(trained.serverProof.calculatedBy, /^PHP 8\.5/);
    assert.equal(trained.player.id, session.playerId);
    assert.deepEqual((await catalog()).catalogs.gyms[0], saved.catalogs.gyms[0]);
    evidence.stages.push('reviewed immutable release, ordinary visibility and actual server-calculated training');
    evidence.training = { energySpent: trained.cost.energy, gain: trained.gain, calculatedBy: trained.serverProof.calculatedBy };
  });
  await t.test('owned process restart retains publication, exact Gym fields and ordinary trained state', async () => {
    await stop(); await start();
    const returned = await gameplay(), live = await bootstrap(), retained = await catalog();
    assert.equal(returned.player.id, session.playerId);
    assert.equal(returned.player.strength, trained.player.strength);
    assert.deepEqual(returned.state.inv, original.state.inv);
    assert.equal(live.release.id, published.id);
    assert.deepEqual(retained.catalogs.gyms[0], saved.catalogs.gyms[0]);
    assert.deepEqual(live.content.gameplayCatalog.gyms[0], saved.catalogs.gyms[0]);
    evidence.stages.push('same owned SQLite reopened after PHP restart, same player and retained publication');
    console.log('STUDIO GYM 116: edit/retention/preview/publish/player training/restart passed; 0 production requests, 0 owner grants.');
    console.log('STUDIO GYM 116 EVIDENCE: ' + resolve(fixture, 'evidence.json'));
  });
});

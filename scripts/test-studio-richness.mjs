import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';

const root = new URL('../', import.meta.url);
// This exact PHP-generated fixture keeps the Node-only cloud build portable.
// The validator AND source catalog are pinned: schema() derives its model enum
// from the latter. Any ordinary-source drift requires an explicit new export.
const exported = JSON.parse(readFileSync(new URL('scripts/fixtures/studio-schema114.json', root), 'utf8'));
assert.equal(exported.schemaVersion, 1);
assert.equal(exported.generatedBy, 'scripts/export-studio-schema114.php');
assert.equal(exported.sourceNormalization, 'CRLF-to-LF for ordinary source/data only');
assert.deepEqual(Object.keys(exported.sourceSha256), ['engine/src/Core/Content/GameplayDefinitionValidator.php', 'engine/data/gameplay-catalog.json', 'scripts/export-studio-schema114.php']);
for (const [path, expected] of Object.entries(exported.sourceSha256)) {
  const source = readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(source).digest('hex'), expected, path + ' changed. Regenerate Studio schema with the actual PHP exporter.');
}
// Local engine gates explicitly supply PHP. A configured but broken exporter
// fails, never silently skips. No implicit php executable is spawned in cloud.
if (process.env.ZONE_TEST_PHP) {
  const actual = JSON.parse(execFileSync(process.env.ZONE_TEST_PHP, [fileURLToPath(new URL('scripts/export-studio-schema114.php', root))], { encoding: 'utf8' }));
  assert.deepEqual(actual, exported, 'Committed schema differs from the actual PHP export.');
}
const schema = exported.schema;
const source = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
function editor(lang = 'en', entry = '__new', definition = null) {
  const elements = new Map();
  const element = selector => { if (!elements.has(selector)) elements.set(selector, { value: '', innerHTML: '', textContent: '', hidden: false, disabled: false, setAttribute() {}, focus() {} }); return elements.get(selector); };
  const context = createContext({ console, URL, URLSearchParams, AbortController, setTimeout: () => 0, clearTimeout() {},
    location: { search: '?lang=' + lang, origin: 'https://zone.test', href: 'https://zone.test/admin' },
    localStorage: { getItem() { return null; }, setItem() {} }, document: { documentElement: {}, querySelector: element, querySelectorAll: () => [] } });
  runInContext(source.slice(0, source.indexOf('\ninstallSectionPreviews();')) + '\nglobalThis.app={state,renderGameplayCatalog,catalogChanges,runtimeContentSnapshot};', context);
  const app = context.app;
  app.state.gameplayCatalog = { schema, revision: 1, catalogs: { items: definition ? { existing: definition } : {} } };
  app.state.catalogCategory = 'items'; app.state.catalogEntry = entry;
  return { ...app, element };
}

test('actual typed schema separates armor, four-resource boosters and medical hospital recovery', () => {
  assert.ok(schema.items.createTypes.includes('armor')); assert.equal(schema.items.fields.red.max, .95);
  assert.deepEqual(schema.items.variants.booster, ['price', 'life', 'nerve', 'energy', 'happy']);
  assert.deepEqual(schema.items.variants.medical, ['price', 'life', 'nerve', 'energy', 'happy', 'hospitalSeconds']);
  assert.deepEqual(schema.items.fields.hospitalSeconds, { type: 'integer', min: 0, max: 86400 });
  assert.ok(!schema.items.variants.armor.includes('model')); assert.equal(schema.items.fields.energy.max, 1000); assert.equal(schema.items.fields.happy.max, 100000);
});

test('actual EN/AR armor form serializes names, bounded reduction and registered-image field, with no model control', () => {
  for (const lang of ['en', 'ar']) {
    const app = editor(lang); app.state.catalogEdits['items/__new'] = { type: 'armor', price: '123', red: '0.95', 'name.en': 'Studio armor', 'name.ar': 'درع الاستوديو', 'description.en': 'Fitted armor', 'description.ar': 'درع ملائم' };
    app.renderGameplayCatalog(); assert.match(app.element('#catalogFields').innerHTML, /catalogField-red/);
    assert.doesNotMatch(app.element('#catalogFields').innerHTML, /catalogField-model/);
    assert.equal(app.element('#catalogEffectHelp').hidden, false);
    assert.match(app.element('#catalogEffectHelp').textContent, lang === 'ar' ? /[\u0600-\u06ff]/ : /equip/);
    const changes = app.catalogChanges(); assert.equal(changes.red, .95); assert.equal(changes.type, 'armor'); assert.equal(changes.name.ar, 'درع الاستوديو');
    app.state.catalogEdits['items/__new'].red = '0.951'; assert.throws(() => app.catalogChanges(), /0.95/);
  }
});

test('existing booster exposes missing effects as zero, leaves untouched values omitted and previews authored effects only', () => {
  for (const lang of ['en', 'ar']) {
    const app = editor(lang, 'existing', { type: 'booster', price: 30, nerve: 4 });
    app.renderGameplayCatalog(); for (const field of ['life', 'energy', 'happy']) { assert.match(app.element('#catalogFields').innerHTML, new RegExp('catalogField-' + field)); assert.equal(app.element('#catalogField-' + field).value, '0'); }
    assert.match(app.element('#catalogFields').innerHTML, lang === 'ar' ? /السعادة المستعادة/ : /Happiness restored/);
    assert.doesNotMatch(app.element('#catalogFields').innerHTML, /Maximum happiness|Energy per shift/);
    assert.deepEqual(Object.keys(app.catalogChanges()), []);
    app.state.catalogEdits['items/existing'] = { energy: '9', happy: '5000' };
    const changes = app.catalogChanges(); assert.equal(changes.energy, 9); assert.equal(changes.happy, 5000); assert.equal(changes.nerve, undefined);
    app.state.gameplayCatalog.catalogs.items.existing = { ...app.state.gameplayCatalog.catalogs.items.existing, ...changes };
    assert.equal(app.runtimeContentSnapshot().gameplayCatalog.items.existing.happy, 5000);
    app.state.catalogEdits['items/existing'].energy = '-1'; assert.throws(() => app.catalogChanges());
  }
});

test('actual EN/AR medical forms preserve untargeted fields and serialize bounded hospital seconds instead of a blanket recovery flag', () => {
  const medical = { type: 'medical', price: 35, life: 12, hospitalSeconds: 30,
    name: { en: 'Clinic wrap', ar: 'ضمادة العيادة' }, description: { en: 'Timed recovery.', ar: 'تعاف محدد الوقت.' } };
  for (const lang of ['en', 'ar']) {
    const app = editor(lang, 'existing', structuredClone(medical));
    app.renderGameplayCatalog();
    assert.match(app.element('#catalogFields').innerHTML, /catalogField-hospitalSeconds/);
    assert.equal(app.element('#catalogField-hospitalSeconds').value, '30');
    assert.deepEqual(Object.keys(app.catalogChanges()), []);
    app.state.catalogEdits['items/existing'] = { price: '39' };
    assert.deepEqual({ ...app.catalogChanges() }, { price: 39 }, 'A price edit must not replace the medical dose, timer, names or description.');
    app.state.catalogEdits['items/existing'] = { hospitalSeconds: '45' };
    const changes = app.catalogChanges();
    assert.deepEqual({ ...changes }, { hospitalSeconds: 45 });
    app.state.gameplayCatalog.catalogs.items.existing = { ...app.state.gameplayCatalog.catalogs.items.existing, ...changes };
    const preview = app.runtimeContentSnapshot().gameplayCatalog.items.existing;
    assert.equal(preview.hospitalSeconds, 45); assert.equal(preview.life, 12); assert.equal(preview.price, 35);
    assert.equal(preview.name.en, medical.name.en); assert.equal(preview.name.ar, medical.name.ar);
    assert.equal(preview.description.en, medical.description.en); assert.equal(preview.description.ar, medical.description.ar);
    for (const invalid of ['-1', '45.5', '86401', '']) {
      app.state.catalogEdits['items/existing'].hospitalSeconds = invalid;
      assert.throws(() => app.catalogChanges(), undefined, 'Invalid hospital duration ' + JSON.stringify(invalid) + ' cannot be submitted.');
    }
    const creating = editor(lang);
    creating.state.catalogEdits['items/__new'] = { type: 'medical', price: '25', hospitalSeconds: '45',
      'name.en': 'Recovery wrap', 'name.ar': 'ضمادة التعافي' };
    creating.renderGameplayCatalog(); const definition = creating.catalogChanges();
    assert.equal(definition.type, 'medical'); assert.equal(definition.hospitalSeconds, 45);
    assert.equal(definition.life, 0); assert.equal(definition.energy, 0); assert.equal(definition.nerve, 0); assert.equal(definition.happy, 0);
    assert.doesNotMatch(creating.element('#catalogFields').innerHTML, /catalogField-model/);
  }
});

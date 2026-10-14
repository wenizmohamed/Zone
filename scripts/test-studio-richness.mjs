import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
let php = process.env.ZONE_TEST_PHP || 'php';
for (let path = root, depth = 0; depth < 7; path = dirname(path), depth++) {
  const candidate = join(path, '.tools/php-8.5.10/php.exe');
  if (!process.env.ZONE_TEST_PHP && existsSync(candidate)) { php = candidate; break; }
}
// Export the actual PHP schema. This is not a hand-maintained schema fixture.
const schema = JSON.parse(execFileSync(php, ['-r', "require $argv[1].'/engine/bootstrap.php';echo json_encode(Zone\\Engine\\Core\\Content\\GameplayDefinitionValidator::schema(),JSON_THROW_ON_ERROR);", root], { encoding: 'utf8' }));
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

test('actual typed schema permits custom armor and four-resource consumables only in their applicable variants', () => {
  assert.ok(schema.items.createTypes.includes('armor')); assert.equal(schema.items.fields.red.max, .95);
  for (const type of ['medical', 'booster']) assert.deepEqual(schema.items.variants[type], ['price', 'life', 'nerve', 'energy', 'happy']);
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

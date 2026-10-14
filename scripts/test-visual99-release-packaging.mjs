import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const coverage = JSON.parse(readFileSync(new URL('assets/weapons/runtime-coverage.json', root), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('candidate upload excludes private sessions, research, artifacts and actual env files', () => {
  const ignore = readFileSync(new URL('.vercelignore', root), 'utf8').split(/\r?\n/);
  for (const path of ['.tools/', 'engine/var/', 'artifacts/', 'screenshots/', 'analysis/', 'brief/', 'idea/', 'docs/', '.claude/', '.github/', 'index.html.bak', 'session_export_love-visualization-20260905.md', 'torn_api_endpoints.json', 'assets/weapons/sources/v99/', 'art/source/launch105-environments/', '.env', '.env.local', '.env.production', '.env.production.local']) assert.ok(ignore.includes(path), path);
  // Placeholder-only hosting templates are build-test inputs, never runtime files.
  assert.ok(existsSync(new URL('engine/deploy/zone-staging/php-fpm.conf', root)));
  assert.ok(!ignore.includes('engine/deploy/'));
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  assert.match(config.functions['api/index.php'].excludeFiles, /engine\/\{bin,tests,var,deploy\}/);
  assert.equal(existsSync(new URL('public/engine/deploy', root)), false);
});
test('generated public output excludes conversion tools, raw research, sessions and proof artifacts', () => {
  for (const path of ['assets/weapons/source-tools', 'assets/weapons/sources/v99', 'art/source/launch105-environments', 'engine/var', 'artifacts', '.tools']) assert.equal(existsSync(new URL('public/' + path, root)), false, path);
  // The tools have not been deleted from the full owner source checkout.
  assert.ok(existsSync(new URL('assets/weapons/source-tools/geometry-audit.mjs', root)));
});

test('Home and Gym ship only inspected optimized derivatives from the committed asset sources', () => {
  for (const path of ['art/zone-gym-interior-v105.webp', 'art/zone-hideout-v105.webp']) {
    const source = readFileSync(new URL(path, root));
    assert.equal(sha(source), sha(readFileSync(new URL('public/' + path, root))), path);
    assert.ok(source.length < 250000, path + ' bounded browser payload');
  }
});
test('all 51 public weapon previews and source files match the reviewed browser capture checkpoint', () => {
  assert.equal(coverage.records.length, 51);
  for (const record of coverage.records) {
    assert.equal(sha(readFileSync(new URL('public/' + record.thumbnail.slice(1), root))), record.thumbnailSha256, record.key + ' PNG');
    assert.equal(sha(readFileSync(new URL('public/' + record.modelPath, root))), record.sourceSha256, record.key + ' source');
  }
});
test('the accepted map and final host cache keys match between reviewed source and public output', () => {
  for (const path of ['index.html', 'assets/zone-design.css', 'dist/city-map-torn.html', 'assets/city/compact-district.js', 'assets/city/district-buildings.js']) {
    assert.equal(sha(readFileSync(new URL(path, root))), sha(readFileSync(new URL('public/' + path, root))), path);
  }
});
test('public runtime keeps truthful weapon attribution, CC0 terms and the full catalog coverage', () => {
  for (const path of ['dist/credits.html', 'assets/weapons/premium/v99/SOURCES.json', 'assets/weapons/premium/v99/LICENSE.txt', 'assets/weapons/runtime-coverage.json']) {
    assert.equal(sha(readFileSync(new URL(path, root))), sha(readFileSync(new URL('public/' + path, root))), path);
  }
});
test('private admin image inventory describes the exact shipped PNGs without test/research paths', () => {
  const inventory = JSON.parse(readFileSync(new URL('engine/config/image-assets.json', root), 'utf8')).images;
  for (const record of coverage.records) assert.equal(inventory[record.thumbnail.slice(1)], record.thumbnailBytes, record.key);
  for (const path of Object.keys(inventory)) assert.doesNotMatch(path, /source-tools|sources\/v99|artifacts|engine\/var/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const method = source.match(/  recordMapNavigation\(destination, markerId\) \{[\s\S]*?\n  \}\n  reconnect\(\)/)?.[0].replace(/\n  reconnect\(\)$/, '');
assert.ok(method, 'actual parent map-navigation recorder exists');

function fixture(raw, failure = false) {
  const dataset = {};
  const document = { documentElement: { dataset }, getElementById(id) {
    assert.equal(id, 'zone-city-map');
    if (failure) throw new Error('Frame disappeared');
    return raw === undefined ? null : { contentDocument: { body: { dataset: { zonePoiHit: raw } } } };
  } };
  const owner = runInNewContext(`({${method}})`, { document });
  return { owner, dataset };
}

test('parent retains the real hit result before iframe-removing navigation', () => {
  const hit = { point: { x: 100, y: 90 }, selectedId: 'bank', attempts: [{ radius: 0, hits: [{ id: 'bank' }] }] };
  const { owner, dataset } = fixture(JSON.stringify(hit));
  owner.recordMapNavigation('bank', 'bank');
  assert.deepEqual(JSON.parse(dataset.zoneLastMapNavigation), { destination: 'bank', markerId: 'bank', hit });
  assert.match(source, /this\.recordMapNavigation\(s, d\.MARKER_CLICK\);\s*this\.go\(s\)/);
});

test('side-panel navigation can be distinguished from an identified coin', () => {
  const { owner, dataset } = fixture(undefined);
  owner.recordMapNavigation('missions');
  assert.deepEqual(JSON.parse(dataset.zoneLastMapNavigation), { destination: 'missions', markerId: null, hit: null });
});

test('malformed and oversized diagnostics never block navigation or grow the DOM', () => {
  for (const raw of ['not-json', ' '.repeat(16385)]) {
    const { owner, dataset } = fixture(raw);
    owner.recordMapNavigation('bank', 'bank');
    assert.equal(JSON.parse(dataset.zoneLastMapNavigation).hit, null);
    assert.ok(dataset.zoneLastMapNavigation.length < 200);
  }
});

test('a disappearing or unavailable frame cannot throw through the route handler', () => {
  const { owner, dataset } = fixture('', true);
  assert.doesNotThrow(() => owner.recordMapNavigation('bank', 'bank'));
  assert.deepEqual(dataset, {});
});

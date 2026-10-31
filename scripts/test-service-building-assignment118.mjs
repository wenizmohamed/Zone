import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const buildings = require('../assets/city/service-buildings108.js');
const degrees = 180 / (Math.PI * 6378137);
const point = (x, y) => [x * degrees, y * degrees];
const pin = (id, x = 0, y = 0) => ({ id, _lngLat: point(x, y) });
function roof(id, x, y = 0, width = 10, tile = '16/1/1') {
  const ring = [point(x - width / 2, y - width / 2), point(x + width / 2, y - width / 2),
    point(x + width / 2, y + width / 2), point(x - width / 2, y + width / 2), point(x - width / 2, y - width / 2)];
  return { type: 'Feature', id: tile + '/' + id, properties: { providerId: id, providerTile: tile, height: 12, extrude: 'true' },
    geometry: { type: 'Polygon', coordinates: [ring] } };
}

test('all 17 non-containing destinations use distinct actual provider roofs when available', () => {
  const pins = buildings.SERVICES.map(id => pin(id));
  const features = buildings.SERVICES.map((id, index) => roof('roof-' + id, 20 + index % 5 * 24, Math.floor(index / 5) * 35));
  const before = JSON.stringify({ pins, features });
  const result = buildings.associate(pins, features);
  assert.equal(result.complete, true);
  assert.equal(result.associations.length, 17);
  assert.equal(new Set(result.associations.map(entry => entry.providerId)).size, 17,
    'Being inside a roof does not prove that independent fallback destinations have separate buildings.');
  assert.ok(result.associations.every(entry => !entry.containsAuthoredPoint && !entry.sharedRoof));
  assert.ok(result.associations.every(entry => entry.insideRoof && entry.clearanceMeters >= 1 && entry.distanceMeters <= 180));
  assert.equal(JSON.stringify({ pins, features }), before);
});

test('an earlier fallback cannot take the genuine roof of a later authored destination', () => {
  const result = buildings.associate([pin('bank'), pin('home', 40)], [roof('home-roof', 40), roof('fallback', 80)]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => [entry.id, entry.providerId, entry.containsAuthoredPoint]),
    [['bank', 'fallback', false], ['home', 'home-roof', true]]);
});

test('fallback exclusivity covers every fragment of a provider ID across neighboring tiles', () => {
  const features = [roof('boundary', -20, 0, 10, '16/1/1'), roof('boundary', 20, 0, 10, '16/2/1'), roof('other', 60)];
  const result = buildings.associate([pin('bank'), pin('gym')], features);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['boundary', 'other']);
  assert.deepEqual(buildings.associate([pin('gym'), pin('bank')], features.toReversed()), result);
});

test('a constrained fallback can move an earlier flexible fallback to its available alternative', () => {
  const pins = [pin('bank'), pin('gym', -170)], features = [roof('near', -20), roof('alternate', 100)];
  const before = JSON.stringify({ pins, features });
  const result = buildings.associate(pins, features);
  assert.equal(result.complete, true, 'Bank can move 100 m so Gym can use its only roof 150 m away.');
  assert.deepEqual(result.associations.map(entry => [entry.id, entry.providerId]), [['bank', 'alternate'], ['gym', 'near']]);
  assert.deepEqual(result.unbound, []);
  assert.ok(result.associations.every(entry => entry.insideRoof && !entry.containsAuthoredPoint && !entry.sharedRoof && entry.distanceMeters <= 180));
  assert.equal(JSON.stringify({ pins, features }), before);
  assert.deepEqual(buildings.associate(pins.toReversed(), features.toReversed()), result);
  buildings.apply(pins, result);
  assert.deepEqual(buildings.associate(pins.toReversed(), features.toReversed()), result);
});

test('fallback augmentation can follow a bounded chain without losing any previous owner', () => {
  const pins = [pin('bank'), pin('gym', -170), pin('alley', -330)];
  const features = [roof('near', -20), roof('alternate', 100), roof('left', -160)];
  const result = buildings.associate(pins, features);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => [entry.id, entry.providerId]),
    [['bank', 'alternate'], ['gym', 'near'], ['alley', 'left']]);
  assert.equal(new Set(result.associations.map(entry => entry.providerId)).size, 3);
  assert.deepEqual(buildings.associate(pins.toReversed(), features.toReversed()), result);
});

test('an existing free fallback choice takes precedence over reassigning another service', () => {
  const pins = [pin('bank'), pin('gym', -170)];
  const features = [roof('near', -20), roof('alternate', 100), roof('free', -340)];
  const result = buildings.associate(pins, features);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => [entry.id, entry.providerId]), [['bank', 'near'], ['gym', 'free']]);
});

test('a reserved containing provider cannot lend its different tile fragment to a fallback', () => {
  const features = [roof('owned', 40, 0, 10, '16/1/1'), roof('owned', -20, 0, 10, '16/2/1'), roof('other', 80)];
  const result = buildings.associate([pin('bank'), pin('home', 40)], features);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['other', 'owned']);
  assert.equal(result.associations[1].containsAuthoredPoint, true);
});

test('exhausted fallback capacity is reported unbound instead of sharing or inventing roof space', () => {
  const result = buildings.associate([pin('bank'), pin('gym'), pin('home', 40)], [roof('owned', 40), roof('other', 80)]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.unbound, ['gym']);
  assert.deepEqual(result.associations.map(entry => [entry.id, entry.providerId]), [['bank', 'other'], ['home', 'owned']]);
});

test('only authored points actually contained by a provider may share its safe roof anchors', () => {
  const features = [roof('genuine-shared', 0, 0, 60), roof('fallback', 80)];
  const result = buildings.associate([pin('bank', -10), pin('gym', 10), pin('market', 35)], features);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['genuine-shared', 'genuine-shared', 'fallback']);
  assert.ok(result.associations.slice(0, 2).every(entry => entry.containsAuthoredPoint && entry.insideRoof));
  assert.equal(result.associations[2].sharedRoof, false);
});

test('exclusive fallback assignment is stable through tile arrival, language and warm refresh', () => {
  const pins = buildings.SERVICES.map(id => pin(id));
  const features = buildings.SERVICES.map((id, index) => roof('roof-' + id, 20 + index % 5 * 24, Math.floor(index / 5) * 35));
  const baseline = buildings.associate(pins, features);
  buildings.apply(pins, baseline);
  const applied = JSON.stringify(pins);
  for (let pass = 0; pass < 3; pass++) {
    const arrivals = [...features.slice(pass), ...features.slice(0, pass)].reverse();
    const translated = pins.toReversed().map(entry => ({ ...entry, label: 'موقع ' + entry.id, zoom: pass + 15 }));
    const rebound = buildings.associate(translated, arrivals);
    assert.deepEqual(rebound, baseline);
    buildings.apply(pins, rebound);
    assert.equal(JSON.stringify(pins), applied);
  }
});

test('adjacent fallback roofs bilaterally separate within their own interiors to clear the 32 m crowding threshold', () => {
  const roofA = {
    type: 'Feature', id: '16/1/1/jail-roof', properties: { providerId: 'jail-roof', providerTile: '16/1/1', height: 24, extrude: 'true' },
    geometry: { type: 'Polygon', coordinates: [[point(-22, -20), point(-4, -20), point(-4, 20), point(-22, 20), point(-22, -20)]] }
  };
  const roofB = {
    type: 'Feature', id: '16/1/1/jobs-roof', properties: { providerId: 'jobs-roof', providerTile: '16/1/1', height: 16, extrude: 'true' },
    geometry: { type: 'Polygon', coordinates: [[point(4, -20), point(22, -20), point(22, 20), point(4, 20), point(4, -20)]] }
  };
  const pins = [pin('jail', -30, 0), pin('jobs', 30, 0)];
  const result = buildings.associate(pins, [roofA, roofB]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['jail-roof', 'jobs-roof']);
  assert.ok(result.associations.every(entry => entry.insideRoof && !entry.crowded && !entry.sharedRoof));
  const separation = Math.hypot(...buildings.meters(result.associations[0].coordinates, result.associations[1].coordinates));
  assert.ok(separation + 1e-7 >= 32, 'Adjacent elongated fallback roofs should pick opposite interior ends to clear 32 m.');
});

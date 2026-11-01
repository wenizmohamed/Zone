import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Actual association module, ordinary metric fixtures. No provider request,
// archived tiles, browser, renderer or visual acceptance is involved.
const require = createRequire(import.meta.url);
const buildings = require('../assets/city/service-buildings108.js');
const degrees = 180 / (Math.PI * 6378137);
const point = (x, y) => [x * degrees, y * degrees];
function roof(id, x, y, width = 10, tile = '16/1/1') {
  const ring = [point(x - width / 2, y - width / 2), point(x + width / 2, y - width / 2),
    point(x + width / 2, y + width / 2), point(x - width / 2, y + width / 2), point(x - width / 2, y - width / 2)];
  return { type: 'Feature', id: tile + '/' + id, properties: { providerId: id, providerTile: tile, height: 12, extrude: 'true' },
    geometry: { type: 'Polygon', coordinates: [ring] } };
}
const pin = (id, x, y) => ({ id, _lngLat: point(x, y) });

test('decluttering cannot move an authored service out of its containing building', () => {
  const pins = [pin('bank', 0, 0), pin('gym', 20, 0)];
  const features = [roof('A', 0, 0), roof('B', 20, 0), roof('C', 60, 0)];
  const result = buildings.associate(pins, features);
  assert.equal(result.complete, true);
  const gym = result.associations.find(entry => entry.id === 'gym');
  assert.equal(gym.providerId, 'B', 'Crowding is not permission to move Gym to building C.');
  assert.equal(gym.containsAuthoredPoint, true);
});

test('equal-distance fragments of the same provider building use geometric ties, not tile arrival order', () => {
  const features = [roof('same', -20, 0, 10, '16/1/1'), roof('same', 20, 0, 10, '16/2/1')];
  const pins = [pin('bank', 0, 0)];
  assert.deepEqual(buildings.associate(pins, features), buildings.associate(pins, features.toReversed()));
});

test('an isolated service uses the safe roof interior instead of the nearest 1.25 m edge', () => {
  const feature = roof('wide', 20, 20, 40), source = pin('bank', -8, 20);
  const selected = buildings.associate([source], [feature]).associations[0];
  const interior = buildings.roofAnchor(feature.geometry.coordinates, source._lngLat);
  assert.deepEqual(selected.coordinates, interior.coordinates);
  assert.ok(selected.clearanceMeters > 19, 'The 40 m roof offers a genuine 20 m interior, not a 1.6 m edge anchor.');
});

test('two services authored inside one building retain that building and use distinct safe interior anchors', () => {
  const features = [roof('shared', 0, 0, 60), roof('unrelated', 90, 0, 20)];
  const result = buildings.associate([pin('bank', -10, 0), pin('gym', 10, 0)], features);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['shared', 'shared']);
  assert.ok(result.associations.every(entry => entry.containsAuthoredPoint && entry.insideRoof));
  assert.ok(result.associations.every(entry => entry.clearanceMeters + 1e-7 >= 6));
  assert.ok(Math.hypot(...buildings.meters(result.associations[1].coordinates, result.associations[0].coordinates)) + 1e-7 >= 32);
});

test('outside authored points choose the nearest physical footprint, not a smaller roof with a nearer center', () => {
  const features = [roof('near-entrance', 42, 0, 80), roof('near-center', -10, 0, 10)];
  const selected = buildings.associate([pin('bank', 0, 0)], features).associations[0];
  assert.equal(selected.providerId, 'near-entrance', 'A safe interior must not redefine which building is nearest to the authored entrance.');
  assert.ok(selected.clearanceMeters > 39);
});

test('a shared small roof reports crowding instead of stealing a different building or inventing off-roof offsets', () => {
  for (const width of [10, 2]) {
    const owned = roof('small', 0, 0, width), unrelated = roof('other', 70, 0, 20);
    const result = buildings.associate([pin('bank', -.25, 0), pin('gym', .25, 0)], [owned, unrelated]);
    assert.deepEqual(result.associations.map(entry => entry.providerId), ['small', 'small']);
    const second = result.associations[1];
    assert.equal(second.sharedRoof, true);
    assert.equal(second.crowded, true);
    assert.ok(second.crowdingWith.includes('bank'));
    assert.ok(second.crowdingDistanceMeters < 32);
    assert.ok(result.associations.every(entry => buildings.inside(entry.coordinates, owned.geometry.coordinates)));
  }
});

test('shared service anchors remain in genuine roof space around a courtyard hole', () => {
  const owned = roof('courtyard', 0, 0, 80), hole = roof('hole', 0, 0, 40).geometry.coordinates[0];
  owned.geometry.coordinates.push(hole);
  const result = buildings.associate([pin('bank', -30, 0), pin('gym', 30, 0)], [owned]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['courtyard', 'courtyard']);
  for (const entry of result.associations) {
    assert.equal(entry.containsAuthoredPoint, true);
    assert.ok(buildings.inside(entry.coordinates, owned.geometry.coordinates));
    assert.equal(buildings.inside(entry.coordinates, [hole]), false);
    assert.ok(entry.clearanceMeters >= 6 - 1e-7);
  }
  assert.notDeepEqual(result.associations[0].coordinates, result.associations[1].coordinates);
});

test('feature arrival, service input order, language and unrelated zoom metadata cannot change semantic ownership', () => {
  const features = [roof('shared', 0, 0, 60), roof('hospital', 80, 0, 20), roof('jail', 0, 80, 20),
    roof('fragments', -60, -60, 20, '16/1/1'), roof('fragments', -60, 60, 20, '16/2/1')];
  const pins = [pin('bank', -10, 0), pin('gym', 10, 0), pin('hospital', 80, 0), pin('jail', 0, 80), pin('market', -60, 0)];
  const before = JSON.stringify({ pins, features }), baseline = buildings.associate(pins, features);
  for (let offset = 0; offset < features.length; offset++) {
    const arrivals = [...features.slice(offset), ...features.slice(0, offset)].reverse();
    const translated = pins.toReversed().map(entry => ({ ...entry, label: 'موقع ' + entry.id, lang: 'ar', zoom: offset + 15 }));
    assert.deepEqual(buildings.associate(translated, arrivals), baseline);
  }
  assert.equal(JSON.stringify({ pins, features }), before, 'Association alone cannot mutate source pins or provider geometry.');
});

test('apply and rebind preserve original coordinates and provider heights without cumulative drift', () => {
  const features = [roof('shared', 0, 0, 60), roof('clinic', 80, 0, 20)],
    pins = [pin('bank', -10, 0), pin('gym', 10, 0), pin('hospital', 80, 0)];
  pins.forEach(entry => { entry.coordinates = entry._lngLat.slice(); });
  const before = structuredClone(pins), featureBytes = JSON.stringify(features), result = buildings.associate(pins, features);
  assert.deepEqual(pins, before);
  buildings.apply(pins, result);
  const applied = JSON.stringify(pins);
  buildings.apply(pins, result);
  assert.equal(JSON.stringify(pins), applied);
  for (let pass = 0; pass < 3; pass++) {
    const rebound = buildings.associate(pins.toReversed(), features.toReversed());
    assert.deepEqual(rebound, result);
    buildings.apply(pins, rebound);
    assert.equal(JSON.stringify(pins), applied);
  }
  pins.forEach((entry, index) => {
    assert.deepEqual(entry._buildingSource, before[index]._lngLat);
    assert.deepEqual(entry.coordinates, before[index].coordinates, 'Authoritative published coordinates never become cosmetic anchors.');
    assert.equal(entry._buildingAssociation.heightMeters, 12);
    assert.deepEqual(entry._buildingAssociation.sourceCoordinates, before[index]._lngLat);
  });
  assert.equal(JSON.stringify(features), featureBytes);
});

test('shared-roof separation honors the existing maximum-distance contract and reports unresolved crowding', () => {
  const result = buildings.associate([pin('bank', -10, 0), pin('gym', 10, 0)], [roof('shared', 0, 0, 60)], { maximumDistance: 12 });
  assert.equal(result.complete, true);
  assert.ok(result.associations.every(entry => entry.distanceMeters <= 12 + 1e-7));
  assert.equal(result.associations[1].crowded, true);
  assert.deepEqual(result.associations.map(entry => entry.providerId), ['shared', 'shared']);
});

test('closed ring rotation and reversed winding cannot skip the authored containing building', () => {
  const source = pin('bank', -90, -90), unrelated = roof('unrelated', -70, -90, 10);
  const variants = ring => {
    const points = ring.slice(0, -1), result = [];
    for (let offset = 0; offset < points.length; offset++) {
      const rotated = [...points.slice(offset), ...points.slice(0, offset)];
      for (const order of [rotated, rotated.toReversed()]) result.push([...order, order[0]]);
    }
    return result;
  };
  for (const withHole of [false, true]) {
    const owned = roof('containing', 0, 0, 190), outlineVariants = variants(owned.geometry.coordinates[0]);
    const holeVariants = withHole ? variants(roof('hole', 0, 0, 20).geometry.coordinates[0]) : [null];
    let baseline;
    for (const outline of outlineVariants) for (const hole of holeVariants) {
      const feature = { ...owned, geometry: { type: 'Polygon', coordinates: hole ? [outline, hole] : [outline] } };
      const selected = buildings.associate([source], [feature, unrelated]).associations[0];
      assert.equal(selected.providerId, 'containing', 'Equivalent closed-ring encodings must not fall through to an unrelated building.');
      assert.equal(selected.containsAuthoredPoint, true);
      assert.ok(selected.distanceMeters <= 180);
      if (!baseline) baseline = selected;
      assert.ok(Math.hypot(...buildings.meters(selected.coordinates, baseline.coordinates)) < 1e-6,
        'Winding and starting-vertex changes cannot change the selected physical roof anchor.');
    }
  }
  assert.equal(buildings.serviceCount(), 17);
  assert.equal(buildings.serviceIds().length, 17);
  assert.equal(buildings.crowdingTargetMeters(), 32);
  assert.equal(buildings.maxRoofSpanMeters(), 200);
  assert.equal(buildings.footprintSearchRadiusMeters(), 240);
  assert.equal(buildings.isSupportedServiceId('bank'), true);
  assert.equal(buildings.isSupportedServiceId('unknown-service'), false);
  const associated = buildings.associate([source], [roof('containing', 0, 0, 190)]);
  assert.equal(buildings.hasCrowding(associated), false);
  const summary = buildings.summarizeAssociations(associated);
  assert.equal(summary.boundCount, 1);
  assert.equal(summary.unboundCount, 0);
  assert.equal(summary.complete, true);
  assert.equal(summary.insideRoofCount, 1);
});

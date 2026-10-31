import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

// Explicit, bounded native replay. Only the ordinary destination diagnostic is
// read from disk. Public provider bytes and decoded geometry stay in memory;
// this test never writes tiles, geometry, URLs, or the public access token.
// Set ZONE_MAP_REPLAY_SOURCE to a captured zoneServiceBuildings JSON diagnostic.
const replaySource = process.env.ZONE_MAP_REPLAY_SOURCE;
const require = createRequire(import.meta.url);
const buildings = require('../assets/city/service-buildings108.js');
const district = require('../assets/city/compact-district.js');

function metrics(result) {
  const entries = result.associations, groups = new Map(), distances = entries.map(entry => entry.distanceMeters);
  for (const entry of entries) groups.set(entry.providerId, [...groups.get(entry.providerId) || [], entry.id]);
  const closePairs = [];
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const distance = Math.hypot(...buildings.meters(entries[i].coordinates, entries[j].coordinates));
    if (distance + 1e-7 < 32) closePairs.push({ services: [entries[i].id, entries[j].id], distanceMeters: distance });
  }
  return {
    bound: entries.length, uniqueProviders: groups.size, unbound: result.unbound,
    duplicateAssignments: entries.length - groups.size,
    sharedProviders: [...groups.values()].filter(ids => ids.length > 1),
    sharedFlags: entries.filter(entry => entry.sharedRoof).map(entry => entry.id),
    crowdedFlags: entries.filter(entry => entry.crowded).map(entry => entry.id), closePairs,
    containing: entries.filter(entry => entry.containsAuthoredPoint).map(entry => entry.id),
    displacedOver50Meters: distances.filter(distance => distance > 50).length,
    displacedOver100Meters: distances.filter(distance => distance > 100).length,
    displacedOver150Meters: distances.filter(distance => distance > 150).length,
    maximumDisplacementMeters: Math.max(...distances),
    meanDisplacementMeters: distances.reduce((sum, distance) => sum + distance, 0) / distances.length,
    totalDisplacementMeters: distances.reduce((sum, distance) => sum + distance, 0)
  };
}

test('real native provider replay keeps every captured service on a distinct safe roof without warm-refresh drift',
  { skip: replaySource ? false : 'Set ZONE_MAP_REPLAY_SOURCE for the explicit in-memory native replay.', timeout: 60000 }, async t => {
    const captured = JSON.parse(readFileSync(replaySource, 'utf8'));
    const pins = captured.associations.map(entry => ({ id: entry.id, _lngLat: entry.sourceCoordinates.slice() }));
    assert.deepEqual(pins.map(pin => pin.id).sort(), buildings.SERVICES.slice().sort());
    const html = readFileSync(new URL('../dist/city-map-torn.html', import.meta.url), 'utf8');
    const token = html.match(/pk\.[A-Za-z0-9_.-]+/)?.[0];
    assert.ok(token, 'The existing public map token must be available; never substitute a credential.');
    const helperURL = new URL('../assets/city/district-buildings.js', import.meta.url);
    const helperSource = readFileSync(helperURL, 'utf8').replace(/from '(\.\/vendor\/[^']+)'/g,
      (_match, path) => "from '" + new URL(path, helperURL).href + "'");
    const { LIMITS, planTiles, decodeTile } = await import('data:text/javascript;base64,' + Buffer.from(helperSource).toString('base64'));
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/map-public-ownership-20261010.json', import.meta.url), 'utf8'));
    const tiles = planTiles(district.createProjection(fixture.blocks.flatMap(block => block.polygon)).bounds);
    assert.equal(tiles.length, 4, 'Replay uses only the four existing district tiles.');
    const decoded = [], tileStats = [];
    let cursor = 0, totalBytes = 0;
    await Promise.all(Array.from({ length: LIMITS.concurrency }, async () => {
      while (cursor < tiles.length) {
        const tile = tiles[cursor++];
        const url = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/' + tile.z + '/' + tile.x + '/' + tile.y + '.vector.pbf?access_token=' + encodeURIComponent(token);
        let response;
        try { response = await fetch(url, { signal: AbortSignal.timeout(LIMITS.timeoutMs) }); }
        catch { throw new Error('Native replay provider request failed; request URL and token are withheld.'); }
        assert.ok(response.ok, 'Native replay provider HTTP status ' + response.status);
        assert.ok(Number(response.headers.get('content-length')) <= LIMITS.maxTileBytes, 'Declared provider tile exceeds the existing byte guard.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        totalBytes += bytes.byteLength;
        assert.ok(bytes.byteLength <= LIMITS.maxTileBytes && totalBytes <= LIMITS.maxBytes, 'Provider bytes exceed the existing guard.');
        const features = decodeTile(bytes, tile);
        decoded.push({ tile: tile.z + '/' + tile.x + '/' + tile.y, features });
        tileStats.push({ tile: tile.z + '/' + tile.x + '/' + tile.y, bytes: bytes.byteLength, features: features.length });
      }
    }));
    const features = decoded.sort((a, b) => a.tile.localeCompare(b.tile)).flatMap(tile => tile.features);
    assert.ok(features.length <= LIMITS.maxFeatures);
    const original = JSON.stringify({ pins, features });
    const baselineSource = execFileSync('git', ['show', '98ca8b8:assets/city/service-buildings108.js'],
      { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const baselineScope = vm.createContext({});
    vm.runInContext(baselineSource, baselineScope);
    const baseline = baselineScope.ZoneServiceBuildings.associate(pins, features);
    const result = buildings.associate(pins, features);
    assert.equal(result.complete, true);
    assert.equal(result.associations.length, 17);
    assert.equal(new Set(result.associations.map(entry => entry.providerId)).size, 17);
    assert.deepEqual(metrics(result).closePairs, [], 'Every captured service pair must maintain >= 32m separation on its owned roof.');
    assert.deepEqual(metrics(result).crowdedFlags, [], 'No captured service may remain crowded after bilateral interior roof separation.');
    for (const entry of result.associations) {
      assert.ok(entry.insideRoof && buildings.inside(entry.coordinates, entry.polygon), entry.id + ' needs a real interior anchor.');
      assert.ok(entry.clearanceMeters > 0 && (entry.containsAuthoredPoint || entry.clearanceMeters + 1e-7 >= 1));
      assert.ok(entry.distanceMeters <= 180 && !entry.sharedRoof);
      assert.ok(features.some(feature => String(feature.properties.providerId) === entry.providerId &&
        (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates).includes(entry.polygon)),
      entry.id + ' must use an actual decoded provider polygon.');
    }
    for (const entry of baseline.associations.filter(entry => entry.containsAuthoredPoint)) {
      const after = result.associations.find(after => after.id === entry.id);
      assert.equal(after.providerId, entry.providerId);
      assert.equal(after.containsAuthoredPoint, true);
    }
    assert.equal(JSON.stringify({ pins, features }), original, 'Replay cannot mutate provider geometry or authored pins.');
    buildings.apply(pins, result);
    for (let pass = 0; pass < 3; pass++) {
      const arrivals = [...features.slice(pass), ...features.slice(0, pass)].reverse();
      assert.deepEqual(buildings.associate(pins.toReversed(), arrivals), result);
    }
    const eligible = features.filter(feature => feature.properties.underground !== 'true' && feature.properties.type !== 'building:part');
    t.diagnostic(JSON.stringify({
      tiles: tileStats.sort((a, b) => a.tile.localeCompare(b.tile)), decodedFeatures: features.length,
      eligibleFeatures: eligible.length,
      eligiblePolygons: eligible.reduce((sum, feature) => sum + (feature.geometry.type === 'Polygon' ? 1 : feature.geometry.coordinates.length), 0),
      before: metrics(baseline), after: metrics(result),
      services: result.associations.map(entry => ({ id: entry.id, providerId: entry.providerId,
        distanceMeters: entry.distanceMeters, footprintDistanceMeters: entry.footprintDistanceMeters,
        clearanceMeters: entry.clearanceMeters, containsAuthoredPoint: entry.containsAuthoredPoint, crowded: entry.crowded }))
    }));
  });

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mechanical reconciliation of generated browser artifacts, not an art-quality
// verdict. The reviewed source checkpoint must precede the actual captures.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, 'assets/weapons/runtime-coverage.json');
const coverage = JSON.parse(readFileSync(path, 'utf8'));
const game = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
const keys = Object.entries(game.items).filter(([, value]) => value.type === 'weapon').map(([key]) => key);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(coverage.records.length, keys.length);
assert.deepEqual(coverage.records.map(record => record.key).sort(), [...keys].sort());
for (const record of coverage.records) {
  assert.match(record.key, /^[a-z][a-z0-9_]+$/);
  const proof = JSON.parse(readFileSync(resolve(root, 'artifacts/visual99/weapon-captures', record.key + '.json'), 'utf8'));
  const bytes = readFileSync(resolve(root, record.modelPath));
  assert.equal(sha(bytes), record.sourceSha256, record.key + ' source checkpoint is stale');
  assert.equal(proof.sourceSha256, record.sourceSha256, record.key + ' must be recaptured after a source change');
  assert.equal(proof.assetId, record.sourceId, record.key + ' source identity');
  assert.equal(proof.frame.clipped, false, record.key + ' is clipped');
  assert.equal(proof.descriptor.fallbackFor, undefined, record.key + ' uses a fallback');
  assert.ok(proof.meshes > 0 && proof.triangles > 100, record.key + ' has no rendered mesh');
  for (const field of ['exposure', 'environment', 'key', 'fill', 'rim', 'hemisphere']) {
    assert.equal(proof.lighting[field], record.expectedLighting[field], record.key + ' ' + field);
  }
  assert.equal(proof.lighting.profile, record.expectedLighting.name, record.key + ' lighting profile');
  const thumbnail = '/assets/weapons/thumbnails/' + record.key + '.png';
  assert.equal(proof.thumbnail, thumbnail);
  const png = readFileSync(resolve(root, thumbnail.slice(1)));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 320); assert.equal(png.readUInt32BE(20), 200);
  assert.ok(png.length > 1024, record.key + ' has an empty thumbnail');
  assert.equal(sha(png), proof.thumbnailSha256, record.key + ' thumbnail bytes changed');
  Object.assign(record, {
    thumbnail, thumbnailStatus: 'captured-from-real-viewer',
    thumbnailSha256: proof.thumbnailSha256, thumbnailBytes: png.length,
    thumbnailWidth: 320, thumbnailHeight: 200,
    thumbnailPose: typeof proof.thumbnailPose === 'string' ? JSON.parse(proof.thumbnailPose) : proof.thumbnailPose,
    browserFrame: proof.frame, browserLighting: proof.lighting,
    browserInspection: { meshes: proof.meshes, triangles: proof.triangles,
      vertices: proof.vertices, materials: proof.materials, textureCount: proof.textureCount }
  });
}
coverage.status = 'captured-local-review';
coverage.thumbnailCapture = 'actual-browser-WebGL-PNG';
coverage.thumbnailCaptureDimensions = [320, 200];
coverage.thumbnailCaptureCount = keys.length;
coverage.pbrMapsBakedInThumbnails = true;
coverage.uniqueRenderedAssets = new Set(coverage.records.map(record => record.sourceId)).size;
coverage.captureNote = 'Actual browser pixels retain surface maps wherever the declared source has them. This is not a claim that every source was originally authored with PBR textures, or that every gameplay variant has unique geometry.';
writeFileSync(path, JSON.stringify(coverage, null, 2) + '\n', 'utf8');
console.log(`Reconciled ${keys.length} actual PNG captures, ${coverage.uniqueRenderedAssets} source identities, zero fallback or clipped frames.`);

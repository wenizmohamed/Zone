// Convert the inspected native imagegen original. No model generation occurs here.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const sharp = require(process.env.ZONE_SHARP_MODULE || 'sharp');
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const root = resolve(sourceRoot, '../../..');
const original = resolve(sourceRoot, 'zone-crime-neighborhood-v106.original.png');
const output = resolve(root, 'art/zone-crime-neighborhood-v106.webp');
await sharp(original).resize(1600, 900, {
  fit:'cover', position:'centre', withoutEnlargement:true,
}).webp({quality:82, effort:6}).toFile(output);
const recordPath = resolve(sourceRoot, 'provenance.json');
for (const path of [original, output]) {
 const data = readFileSync(path), metadata = await sharp(data).metadata();
 const sha256 = createHash('sha256').update(data).digest('hex').toUpperCase();
 console.log(JSON.stringify({path, width:metadata.width, height:metadata.height, bytes:data.length, sha256, format:metadata.format}));
 if (path === output) { assert.equal(metadata.width,1600); assert.equal(metadata.height,900); assert.ok(data.length < 250000, 'WebP exceeds 250000-byte runtime budget'); }
 if (existsSync(recordPath)) {
  const provenance = JSON.parse(readFileSync(recordPath, 'utf8'));
  const expected = path === original ? provenance.original : provenance.derivative;
  assert.equal(data.length,expected.bytes); assert.equal(sha256,expected.sha256);
  assert.equal(metadata.width,expected.width); assert.equal(metadata.height,expected.height);
  if (expected.space) assert.equal(metadata.space,expected.space);
  if (expected.channels) assert.equal(metadata.channels,expected.channels);
 }
}
console.log('CRIMES ART EXPORT PASS: inspected source retained; 1600x900 derivative below 250000 bytes; recorded hashes checked when provenance exists.');

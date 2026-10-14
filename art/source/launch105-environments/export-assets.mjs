// Re-export the inspected native imagegen originals. No model generation occurs here.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharpModule = process.env.ZONE_SHARP_MODULE || 'sharp';
const sharp = require(sharpModule);
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const artRoot = resolve(sourceRoot, '../..');
for (const [source, output] of [
  ['zone-gym-interior-v105.original.png', 'zone-gym-interior-v105.webp'],
  ['zone-hideout-v105.original.png', 'zone-hideout-v105.webp'],
]) {
  const path = resolve(artRoot, output);
  await sharp(resolve(sourceRoot, source)).resize(1600, 900, {
    fit: 'cover', position: 'centre', withoutEnlargement: true,
  }).webp({quality:82, effort:6}).toFile(path);
  const metadata = await sharp(path).metadata();
  console.log(JSON.stringify({path, width:metadata.width, height:metadata.height, format:metadata.format}));
}

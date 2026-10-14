import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require(process.env.ZONE_SHARP_MODULE || 'sharp');
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const root = resolve(sourceRoot, '../../..');
const record = JSON.parse(readFileSync(resolve(sourceRoot, 'provenance.json'), 'utf8'));
const reviewRoot = resolve(root, '.tools/environment-review');
mkdirSync(reviewRoot, { recursive:true });
let inspected = 0;
for (const asset of record.assets) {
 for (const [key, path] of [['original',asset.originalPath],['derivative',asset.publicPath]]) {
  const absolute = resolve(root,path);
  const data = readFileSync(absolute), metadata = await sharp(data).metadata();
  assert.equal(metadata.width,asset[key].width, path+' width');
  assert.equal(metadata.height,asset[key].height, path+' height');
  assert.equal(statSync(absolute).size,asset[key].bytes, path+' bytes');
  assert.equal(createHash('sha256').update(data).digest('hex').toUpperCase(),asset[key].sha256,path+' sha256');
  inspected++;
 }
 const input = resolve(root,asset.publicPath);
 const meta = await sharp(input).metadata();
 for (const slot of asset.reviewSlots) {
  // CSS object-fit:cover preview using 50% 55% focal positioning.
  const scale = Math.max(slot.width/meta.width,slot.height/meta.height);
  const resizedWidth = Math.ceil(meta.width*scale), resizedHeight = Math.ceil(meta.height*scale);
  const left = Math.round((resizedWidth-slot.width)*0.5);
  const top = Math.round((resizedHeight-slot.height)*0.55);
  const output = resolve(reviewRoot,slot.name+'.png');
  await sharp(input).resize(resizedWidth,resizedHeight).extract({left,top,width:slot.width,height:slot.height}).png().toFile(output);
  console.log(JSON.stringify({review:slot.name,path:output,width:slot.width,height:slot.height}));
 }
}
console.log('ASSET CONTRACT PASS: '+inspected+' original/derivative files with dimensions, byte counts and SHA256 checked.');

// Optional full offline-evidence verification. Intentionally requires the
// private source captures and must not be included in vercel-build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=JSON.parse(read('assets/weapons/source-tools/upgrades112/review-cameras.json'));
const manifest=JSON.parse(read('assets/weapons/upgrades112/manifest.json'));

test('optional evidence receipt covers exactly both full and detail pairs for both frozen assets',()=>{
  assert.equal(receipt.revision,112);assert.equal(receipt.status,'offline-evidence-receipt-not-browser-acceptance');
  assert.equal(receipt.views.length,4);
  for(const asset of manifest.assets){
    assert.deepEqual(receipt.views.filter(view=>view.assetId===asset.id).map(view=>view.view),['full','detail']);
  }
});

for(const view of receipt.views){
  test(view.assetId+' '+view.view+' original private before/after pixels and camera metadata match their committed receipts',()=>{
    const asset=manifest.assets.find(asset=>asset.id===view.assetId);
    assert.ok(asset);assert.equal(view.modelSha256,asset.sha256);
    assert.equal(hash(read(asset.path)),view.modelSha256);
    const captures=[];
    for(const record of [view.before,view.after]){
      // Missing captures are an explicit failure, never silently skipped.
      const cameraBytes=read(record.cameraPath),camera=JSON.parse(cameraBytes);
      assert.equal(hash(cameraBytes),record.cameraSha256);
      assert.equal(hash(JSON.stringify(camera)),record.canonicalCameraSha256);
      assert.deepEqual(camera,view.camera);
      assert.deepEqual(camera.resolution,[1100,620]);
      const pixels=read(record.pngPath);
      assert.equal(hash(pixels),record.pngSha256);assert.equal(pixels.length,record.pngBytes);
      assert.deepEqual([...pixels.subarray(0,8)],[137,80,78,71,13,10,26,10]);
      assert.deepEqual([pixels.readUInt32BE(16),pixels.readUInt32BE(20)],[1100,620]);
      captures.push({camera,pixels});
    }
    assert.deepEqual(captures[0].camera,captures[1].camera,'before/after actual render conditions differ');
    assert.notEqual(hash(captures[0].pixels),hash(captures[1].pixels),'actual before/after pixels are identical');
  });
}

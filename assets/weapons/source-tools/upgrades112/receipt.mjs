// Emit the additive proposal receipt. Does not modify runtime or old receipts.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { geometryGlb,sideSurfaces } from '../geometry-audit.mjs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../../lib/three184/three.module.js';
const root=new URL('../../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const previous=JSON.parse(read('assets/weapons/upgrades111/manifest.json'));
const build=JSON.parse(read('.tools/v112-weapons/build-receipt.json'));
const proposal=JSON.parse(read('assets/weapons/upgrades112/binding-proposal.json'));
const assets=[];
for(const record of build.assets){
  const descriptor=proposal.sources[record.id],png=read(descriptor.thumbnail.slice(1));
  const geometry=await geometryGlb(fileURLToPath(new URL(record.path,root)));
  const box=new THREE.Box3().setFromObject(geometry.scene);
  assets.push({...record,author:descriptor.author,license:descriptor.license,source:descriptor.source,
    quality:descriptor.quality,materialStatus:descriptor.quality,materialLineage:descriptor.materialLineage,
    modified:true,modification:descriptor.materialLineage,descriptor,
    physicalBounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},
    gripSurfaces:sideSurfaces(geometry.scene,0,0),
    thumbnail:descriptor.thumbnail,thumbnailSha256:hash(png),thumbnailBytes:png.length,thumbnailWidth:png.readUInt32BE(16),thumbnailHeight:png.readUInt32BE(20),
    thumbnailStatus:'offline-Cycles-render-of-reimported-exported-GLB',
    triangleBudget:60000,primitiveBudget:10,textureBudgetBytes:16*1024*1024});
}
console.log(JSON.stringify({revision:112,status:'proposal-only-offline-asset-review',renderer:build.renderer,
  browserCaptureStatus:'pending-review',thumbnailCapture:'offline-Blender-Cycles-exported-GLB-PNG',
  license:'CC0-1.0',license_file:'LICENSE.txt',
  sources:[{author:'Tabasco',license:'CC0-1.0',license_file:'LICENSE.txt',source_page:proposal.sources['dragunov-detail112'].source,
    licenseVerified:'2026-10-18',licenseNote:'Primary author page retains CC0 and states the 2023-12-15 public-domain dedication. It also retains a historical CC-BY marker. Original sources had only Blender materials; these new surface maps are ZONE work.',
    download_url:'https://opengameart.org/sites/default/files/smallarms.zip',archive_sha256:'fac981bb2df3dac9574e3567ef40df0fa5b77f0d6be0a36b83bdd95fcc86a492'},
    {author:'LonesomeDucky',license:'CC0-1.0',license_file:'LICENSE.txt',source_page:'https://opengameart.org/content/old-wooden-baseball-bat',
      licenseVerified:'2026-10-18',licenseNote:'Retained CC0 bat color/normal lineage from the v99 adaptation; original projected UVs and walnut factor preserved, new roughness only.',
      retainedSourceModel:'assets/weapons/premium/wooden-bat/baseball_bat.glb',retainedSourceSha256:'986198e5b00b999e5459e3b6e46f07a5b8b5ff391f7a1cbcdb6767b66315b3bd'}],
  bindings:proposal.bindings,assets,
  template:build.template,templateSha256:hash(read(build.template)),sourceTool:'assets/weapons/source-tools/upgrades112/build_upgrades.py',sourceToolSha256:hash(read('assets/weapons/source-tools/upgrades112/build_upgrades.py')),
  historicalReceipt:previous.historicalReceipt,historicalReceiptSource:previous.historicalReceiptSource,
  historicalReceiptSha256:previous.historicalReceiptSha256,immutableOriginals:previous.immutableOriginals,
  limitations:['Offline asset renders are not browser pixels or in-app acceptance.','Source silhouettes remain low-poly; no exact replica claim.','Mosin keeps its iron sights, no new scope.','Opaque coated optic lenses have no transmission or through-scope function.','Finger-skin clearance, phone GPU timing and game integration remain unverified.']
},null,2));

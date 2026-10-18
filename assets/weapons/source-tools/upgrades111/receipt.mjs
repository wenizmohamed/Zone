// Emits a derivative receipt without changing the immutable v99 receipt.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WEAPON_PRESENTATION_UPGRADES111, WEAPON_UPGRADE_SOURCES111 } from '../../../../dist/weapon-assets.js';
const root = new URL('../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const build = JSON.parse(read('.tools/v111-weapons/build-receipt.json'));
// Pin the actual versioned receipt, not a previously checked-out CRLF working
// copy whose cached stat can survive a later -text attribute change. Never
// rewrite or normalize that historical file to make this generator pass.
const historicalReceipt = 'assets/weapons/runtime-coverage.json';
const historicalReceiptSource = {
  revision:'ad002532028975d687d956c7a745be303ddd1852',
  blob:'c51b0d48f3f92509a55f023f295c4de7c882d0dc',
  bytes:243675,
  sha256:'5d45a303e52ed7a018d07225cde49bbd60e8274eab6a5264c97fcb75c6271644'
};
const originalReceipt = execFileSync('git',['show',historicalReceiptSource.revision+':'+historicalReceipt],
  {cwd:fileURLToPath(root),maxBuffer:1024*1024});
if(originalReceipt.length!==historicalReceiptSource.bytes || hash(originalReceipt)!==historicalReceiptSource.sha256)
  throw new Error('The pinned historical receipt differs from the versioned baseline. No asset was rewritten.');
const old = JSON.parse(originalReceipt);
const immutableOriginals = [...new Map(old.records.map(record => [record.modelPath,
  { path: record.modelPath, bytes: record.sourceBytes, sha256: record.sourceSha256 }])).values()];
console.log(JSON.stringify({
  revision:111, status:'offline-asset-review-browser-pending', license:'CC0-1.0', licenseFile:'LICENSE.txt', license_file:'LICENSE.txt',
  historicalReceipt, historicalReceiptSha256:hash(originalReceipt), historicalReceiptSource,
  sourceTool:'assets/weapons/source-tools/upgrades111/build_upgrades.py',
  sourceToolSha256:hash(read('assets/weapons/source-tools/upgrades111/build_upgrades.py')),
  renderer:build.renderer, thumbnailCapture:'offline-Blender-Cycles-PNG', browserCaptureStatus:'pending-review',
  sources:[
    { author:'Tabasco', license:'CC0-1.0', license_file:'LICENSE.txt', source:'https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol',
      source_page:'https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol',
      download:'https://opengameart.org/sites/default/files/smallarms.zip', downloadSha256:'fac981bb2df3dac9574e3567ef40df0fa5b77f0d6be0a36b83bdd95fcc86a492',
      licenseVerified:'2026-10-18', licenseNote:'Primary author page offers CC0 and states a 2023-12-15 public-domain dedication. Historical CC-BY marker is retained on that page.',
      originals:['premium/v99/tabasco-g3a3.glb','premium/v99/tabasco-l85.glb'] },
    { author:'locarem', license:'CC0-1.0', license_file:'LICENSE.txt', source:'https://opengameart.org/content/high-poly-glock-18-no-textures',
      source_page:'https://opengameart.org/content/high-poly-glock-18-no-textures',
      download:'https://opengameart.org/sites/default/files/Glock_HighPoly.obj', downloadSha256:'5437aa4cbacfb9838c2ff06cabb13ccf68779ce8af4652a1672923772f35d089',
      licenseVerified:'2026-10-18', licenseNote:'Primary author page offers CC0. OBJ has 15,366 original vertices; no original textures or MTL file supplied. ZONE supplies the new physical surfaces.' }
  ],
  bindings:WEAPON_PRESENTATION_UPGRADES111,
  assets:build.assets.map(record => {
    const { originalVertices, originalTriangles, ...asset } = record;
    const descriptor = WEAPON_UPGRADE_SOURCES111[record.id];
    const thumbnail = 'assets/weapons/upgrades111/' + record.thumbnail, png = read(thumbnail);
    return { ...asset, previousRuntimeVertices:originalVertices, previousRuntimeTriangles:originalTriangles,
      sourceVertices:record.id==='glock18-detail111'?15366:originalVertices,
      sourceTriangles:record.id==='glock18-detail111'?30648:originalTriangles,
      author:descriptor.author, license:descriptor.license, source:descriptor.source, quality:descriptor.quality,
      modified:true, modification:descriptor.materialLineage, materialStatus:descriptor.quality,
      sourceGeometry:record.id==='glock18-detail111'?'locarem high-poly source geometry with new grip panels and slide-serration detail.':'Tabasco source silhouette retained with bevelled mesh and new receiver, vent, fastener, magazine and grip detail geometry.',
      materialLineage:descriptor.materialLineage, originalSourceId:descriptor.originalSourceId,
      descriptor:{ scale:descriptor.scale, grip:descriptor.grip, rotation:descriptor.rotation, axis:descriptor.axis, forward:descriptor.forward },
      thumbnail:'/'+thumbnail, thumbnailSha256:hash(png), thumbnailBytes:png.length, thumbnailWidth:png.readUInt32BE(16), thumbnailHeight:png.readUInt32BE(20),
      thumbnailStatus:'offline-Cycles-render-of-exact-exported-geometry-and-materials', triangleBudget:60000, primitiveBudget:10, textureBudgetBytes:16*1024*1024 };
  }),
  immutableOriginals,
  limitations:[
    'Offline renders are not WebGL viewer captures and do not establish in-app pixel acceptance.',
    'Rifle derivatives retain low-poly source silhouettes; bevelled surfaces and detail geometry are new.',
    'The new Glock is game-art representation, not an M1911 or real-world performance claim.',
    'Finger-skin clearance and phone GPU timing require real in-app verification.'
  ]
},null,2));

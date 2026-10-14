import fs from 'node:fs';
import vm from 'node:vm';
import { geometryGlb, orientObject, actualBounds, sideSurfaces } from './geometry-audit.mjs';

const arg = process.argv[2];
if (arg === 'template-json') {
  const html = fs.readFileSync(process.argv[3] || 'dist/weapon3d.html', 'utf8');
  console.log(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
} else if (arg === 'new-provenance') {
  const proof=JSON.parse(fs.readFileSync('assets/weapons/runtime-coverage.json','utf8'));
  const records=proof.records.filter(r=>r.modelPath.startsWith('assets/weapons/premium/v99/'));
  const distinct=records.filter((r,i)=>records.findIndex(v=>v.modelPath===r.modelPath)===i);
  console.log(JSON.stringify(distinct.map(r=>({path:r.modelPath,bytes:r.sourceBytes,sha256:r.sourceSha256,
    source:r.source,license:r.license,author:r.author,modified:true,triangleBudget:12000,
    textureBudgetBytes:32*1024*1024,modification:r.materialLineage,
    materialStatus:r.quality,sourceGeometry:'Retained author geometry; evaluated static pose, no vertex retopology or invented geometry.'})),null,2));
} else if (arg === 'template') {
  const html = fs.readFileSync('dist/weapon3d.html', 'utf8');
  const source = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  console.log(source.slice(0, 5300));
} else if (arg === 'catalog') {
  const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync('assets/weapons/catalog.js','utf8'), ctx);
  console.log(Object.keys(ctx.ZONE_WEAPONS).join(','));
} else if (arg === 'image') {
  const path = process.argv[3], bytes = fs.readFileSync(path), size = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.toString('utf8',20,20+size));
  console.log(JSON.stringify(data.materials));
  const bin = bytes.subarray(28+size);
  fs.mkdirSync('artifacts/visual99-20261013/asset-research/v99/retained-texture-audit', {recursive:true});
  data.images.forEach((image,index) => {
    const view = data.bufferViews[image.bufferView];
    const target = `artifacts/visual99-20261013/asset-research/v99/retained-texture-audit/${index}.${image.mimeType==='image/png'?'png':'jpg'}`;
    fs.writeFileSync(target,bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
    console.log(index,image.name,target);
  });
} else {
  const object = orientObject((await geometryGlb(process.argv[2])).scene,[0,Number(process.argv[3]||0),0]);
  for(const name of (process.argv[6]||'').split(',').filter(Boolean)) object.getObjectByName(name)?.removeFromParent();
  console.log(JSON.stringify(actualBounds(object)));
  console.log('GRIP',process.argv[4],process.argv[5],JSON.stringify(sideSurfaces(object,Number(process.argv[4]),Number(process.argv[5]))));
}

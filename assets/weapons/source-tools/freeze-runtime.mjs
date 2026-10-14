import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import * as THREE from '../../../lib/three184/three.module.js';
import { geometryGlb, sideSurfaces } from './geometry-audit.mjs';
import { resolveWeaponAsset, normalizeWeaponAsset, inspectWeaponObject } from '../../../dist/weapon-assets.js';
import { computeWeaponFrame, weaponStudioProfile } from '../../../dist/weapon-presentation.js';
const context=vm.createContext({});vm.runInContext(fs.readFileSync('assets/weapons/catalog.js','utf8'),context);
const game=JSON.parse(fs.readFileSync('engine/data/gameplay-catalog.json','utf8'));
const keys=Object.entries(game.items).filter(([,item])=>item.type==='weapon').map(([key])=>key);
const records=[];
for(const key of keys){
 const d=resolveWeaponAsset(key,context.ZONE_WEAPONS);if(!d?.url)throw new Error('Unmapped weapon '+key);
 const modelPath='assets/weapons/'+d.url,bytes=fs.readFileSync(modelPath),jsonSize=bytes.readUInt32LE(12);
 const data=JSON.parse(bytes.toString('utf8',20,20+jsonSize));
 const object=normalizeWeaponAsset(THREE,(await geometryGlb(modelPath)).scene,d);
 const inspection=inspectWeaponObject(THREE,object),box=new THREE.Box3().setFromObject(object);
 const sides=sideSurfaces(object,0,0);
 const frame=computeWeaponFrame(THREE,box,320/200);
 const materials=(data.materials||[]).map(mat=>({name:mat.name||'unnamed',
  color:mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],
  roughness:mat.pbrMetallicRoughness?.roughnessFactor??1,metalness:mat.pbrMetallicRoughness?.metallicFactor??1,
  maps:[...(mat.pbrMetallicRoughness?.baseColorTexture?['map']:[]),...(mat.normalTexture?['normalMap']:[]),
    ...(mat.pbrMetallicRoughness?.metallicRoughnessTexture?['metalnessMap','roughnessMap']:[]),...(mat.occlusionTexture?['aoMap']:[])]}));
 records.push({key,sourceId:d.id,sourceKey:d.sourceKey,category:d.category,quality:d.quality,
  modelPath,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,
  author:d.author,license:d.license,source:d.source,materialLineage:d.materialLineage||'Retained source geometry and author surface maps.',
  descriptor:d,thumbnail:d.thumbnail,thumbnailStatus:'awaiting-real-WebGL-capture',
  meshes:inspection.meshes,triangles:inspection.triangles,materials,textureImages:(data.images||[]).map(image=>image.name||image.mimeType),
  bounds:inspection.bounds,gripSurfaces:sides,gripHasBilateralSurface:sides.every(Boolean),
  cpuFrame:{aspect:320/200,position:frame.position.toArray(),target:frame.target.toArray(),near:frame.near,far:frame.far},
  expectedLighting:weaponStudioProfile(d)});
}
const coverage={revision:99,status:'source-frozen-awaiting-pixel-capture',runtimeWeapons:keys.length,
 uniqueRenderedAssets:new Set(records.map(r=>r.sourceId)).size,categories:[...new Set(records.map(r=>r.category))],
 sourceGeometryChanged:true,sourceGeometryNote:'Gameplay presentation sources replaced; real author mesh geometry retained. Jean UV/material adaptation declared.',
 pbrMapsBakedInThumbnails:false,thumbnailCapture:'Root must capture the actual 320x200 WebGL viewer, no SVG geometry approximations.',
 limitations:['Fictional numbered gameplay variants can reuse an explicitly named source; they are not 51 distinct authored meshes.',
 'Tabasco sources are untextured authored materials, not textured PBR.',
 'Double-barrel uses new CC0 wood UV/material adaptation; original photographic atlas is not shipped.',
 'Measured bilateral grip surfaces are not a full animated hand-skin clearance proof.'],records};
if(process.argv.includes('--refresh-tabasco')) {
 const previous=JSON.parse(fs.readFileSync('assets/weapons/runtime-coverage.json','utf8'));
 const changed=records.filter(record=>record.sourceId.startsWith('tabasco-'));
 for(const fresh of changed) {
  const index=previous.records.findIndex(record=>record.key===fresh.key);
  if(index<0)throw new Error('Missing prior source '+fresh.key);
  previous.records[index]={...previous.records[index],...fresh,thumbnailStatus:'needs-material-recapture'};
  for(const field of ['thumbnailSha256','thumbnailBytes','thumbnailWidth','thumbnailHeight','browserFrame','browserLighting','browserInspection','thumbnailPose']) delete previous.records[index][field];
 }
 previous.status='source-refrozen-five-materials-awaiting-recapture';
 fs.writeFileSync('assets/weapons/runtime-coverage.json',JSON.stringify(previous,null,2)+'\n','utf8');
 console.log(JSON.stringify({refrozenKeys:changed.map(record=>record.key),sourceHashes:[...new Map(changed.map(record=>[record.sourceId,record.sourceSha256])).entries()]}));
} else if(process.argv.includes('--output')) {
 // Generated source-coverage artifact, mechanically derived from retained bytes.
 fs.writeFileSync('assets/weapons/runtime-coverage.json',JSON.stringify(coverage,null,2)+'\n','utf8');
 console.log(JSON.stringify({records:records.length,uniqueSources:coverage.uniqueRenderedAssets,categories:coverage.categories,
  missingGrip:records.filter(x=>!x.gripHasBilateralSurface).map(x=>x.key)}));
} else console.log(JSON.stringify(coverage,null,2));

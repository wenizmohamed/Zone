import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../lib/three184/three.module.js';
import {GLTFLoader} from '../lib/three184/GLTFLoader.js';
import {createArmorController,createWornVest} from '../dist/character-armor.mjs';
const root=new URL('../',import.meta.url);
async function wardrobe(name){const bytes=readFileSync(new URL('assets/character/quaternius/'+name+'.glb',root));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const armorMeshes=actor=>{const meshes=[];actor.traverse(o=>{if(o.name==='ZONE representative worn vest')meshes.push(o);});return meshes;};

test('same equipped armor refreshed while actual source loads cannot publish obsolete label/reduction on completion',async()=>{
  const actor=(await wardrobe('Suit')).scene,source=await wardrobe('Swat');actor.userData.outfit='Suit';
  let finish,loads=0;const receipts=[];
  const controller=createArmorController({THREE,loadSource(){loads++;return new Promise(resolve=>{finish=resolve;});},publish:r=>receipts.push(r)});
  const pending=controller.update({armorId:'vest',armorOwned:true,armorLabel:'Old vest label',armorReduction:.2},actor);
  await controller.update({armorId:'vest',armorOwned:true,armorLabel:'Current vest label',armorReduction:.35},actor);
  assert.equal(receipts.at(-1).label,'Current vest label');assert.equal(receipts.at(-1).status,'loading');
  finish(source);await pending;
  assert.equal(loads,1);assert.ok(armorMeshes(actor).length>0);
  assert.equal(receipts.at(-1).status,'ready');assert.equal(receipts.at(-1).label,'Current vest label');assert.equal(receipts.at(-1).reduction,.35);
  controller.dispose();assert.equal(armorMeshes(actor).length,0);
});

test('repeated unchanged armor packet retains existing tactical costume representation instead of falsely claiming an added vest',async()=>{
  const actor=(await wardrobe('Swat')).scene;actor.userData.outfit='Swat';const receipts=[];
  const controller=createArmorController({THREE,loadSource(){assert.fail('Swat must reuse its existing costume');},publish:r=>receipts.push(r)});
  const packet={armorId:'armor',armorOwned:true,armorLabel:'Armor',armorReduction:.3};
  await controller.update(packet,actor);await controller.update(packet,actor);
  assert.equal(receipts.length,2);assert.equal(receipts[0].representation,'existing-tactical-costume');assert.equal(receipts[1].representation,receipts[0].representation);
  assert.equal(armorMeshes(actor).length,0);controller.dispose();
});

test('failed second real vest material construction rolls back already attached geometry and releases owned resources',async()=>{
  const actor=(await wardrobe('Suit')).scene,source=(await wardrobe('Swat')).scene,body=source.getObjectByName('Swat_Body');
  const sourceMeshes=[];body.traverse(o=>{if(o.isSkinnedMesh&&['Swat','Swat_Black'].includes(o.material?.name))sourceMeshes.push(o);});assert.ok(sourceMeshes.length>=2);
  const firstClone=sourceMeshes[0].material.clone,secondClone=sourceMeshes[1].material.clone,originalDispose=THREE.BufferGeometry.prototype.dispose;
  const disposedGeometry=new Set();let disposedMaterials=0;
  sourceMeshes[0].material.clone=function(){const material=firstClone.call(this);material.addEventListener('dispose',()=>disposedMaterials++);return material;};
  sourceMeshes[1].material.clone=()=>{throw new Error('deliberate second-surface failure');};
  THREE.BufferGeometry.prototype.dispose=function(){assert.ok(!disposedGeometry.has(this),'geometry disposed twice');disposedGeometry.add(this);originalDispose.call(this);};
  try{
    assert.throws(()=>createWornVest(THREE,actor,source),/deliberate second-surface failure/);assert.equal(armorMeshes(actor).length,0,'partial vest survived failed initialization');
    assert.equal(disposedGeometry.size,2,'both the attached and not-yet-attached derived geometries must be released');assert.equal(disposedMaterials,1);
    assert.ok(sourceMeshes.every(mesh=>!disposedGeometry.has(mesh.geometry)),'never dispose retained source geometry');
  }
  finally{sourceMeshes[0].material.clone=firstClone;sourceMeshes[1].material.clone=secondClone;THREE.BufferGeometry.prototype.dispose=originalDispose;}
});

test('revoked ownership and actor replacement cancel a late vest without resurrecting equipment',async()=>{
  const actor=(await wardrobe('Suit')).scene,replacement=(await wardrobe('Casual_Hoodie')).scene,source=await wardrobe('Swat');
  actor.userData.outfit='Suit';replacement.userData.outfit='Casual_Hoodie';
  const finish=[],receipts=[];const controller=createArmorController({THREE,loadSource(){return new Promise(resolve=>finish.push(resolve));},publish:r=>receipts.push(r)});
  const first=controller.update({armorId:'vest',armorOwned:true},actor);
  await controller.update({armorId:'vest',armorOwned:false},actor);
  finish[0](source);await first;assert.equal(receipts.at(-1).status,'none');assert.equal(armorMeshes(actor).length,0);
  const oldActor=controller.update({armorId:'vest',armorOwned:true},actor);
  const currentActor=controller.update({armorId:'vest',armorOwned:true,armorLabel:'Current actor armor'},replacement);
  finish[1](source);await oldActor;assert.equal(armorMeshes(actor).length,0);assert.equal(receipts.at(-1).status,'loading');
  finish[2](source);await currentActor;assert.ok(armorMeshes(replacement).length>0);assert.equal(receipts.at(-1).label,'Current actor armor');
  controller.dispose();controller.dispose();assert.equal(armorMeshes(replacement).length,0);
});

test('failed armor source keeps its truthful reason through repeated packets without retrying indefinitely',async()=>{
  const actor=(await wardrobe('Suit')).scene;actor.userData.outfit='Suit';let requests=0;const receipts=[];
  const controller=createArmorController({THREE,loadSource(){requests++;return Promise.reject(new Error('offline'));},publish:r=>receipts.push(r)});
  const packet={armorId:'vest',armorOwned:true,armorLabel:'Vest'};
  await controller.update(packet,actor);await controller.update({...packet,armorLabel:'Updated vest'},actor);
  assert.equal(requests,1);assert.equal(receipts.at(-1).status,'unrepresented');assert.equal(receipts.at(-1).reason,'worn-asset-unavailable');assert.equal(receipts.at(-1).label,'Updated vest');
  controller.dispose();
});

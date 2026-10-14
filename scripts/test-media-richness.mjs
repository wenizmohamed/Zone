import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../lib/three184/three.module.js';
import {GLTFLoader} from '../lib/three184/GLTFLoader.js';
import {armorReceipt,createWornVest,createArmorController} from '../dist/character-armor.mjs';
import {prepareCharacterArt,disposeCharacterResources} from '../dist/character-presentation.js';
async function wardrobe(name){const bytes=readFileSync(new URL(`../assets/character/quaternius/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('armor presentation requires owned equipped identity and never invents an item-exact model',()=>{
  assert.equal(armorReceipt({armorId:'vest',armorOwned:false,armorReduction:.9}).armorId,null);
  assert.equal(armorReceipt({armorId:'vest',armorOwned:true,armorReduction:2}).reduction,.95);
  assert.equal(armorReceipt({armorId:'published-custom',armorOwned:true,armorReduction:.3}).representation,'no-worn-model');
  assert.equal(armorReceipt({armorId:'armor',armorOwned:true}).itemExact,false);
});
for(const outfit of ['Suit','Casual_Hoodie'])test(outfit+' representative vest derives real licensed torso and preserves body, rig and animation bytes',async t=>{
  const actor=await wardrobe(outfit),source=await wardrobe('Swat');prepareCharacterArt(T,actor.scene);
  const originals=[];actor.scene.traverse(n=>{if(n.isSkinnedMesh)originals.push({mesh:n,position:n.geometry.attributes.position.array.slice(),joints:n.geometry.attributes.skinIndex.array.slice(),skeleton:n.skeleton,materials:n.material});});
  const clips=JSON.stringify(actor.animations.map(c=>c.toJSON()));const vest=createWornVest(T,actor.scene,source.scene);
  assert.ok(vest.meshes.length>0);let vertices=0;
  for(const mesh of vest.meshes){vertices+=mesh.geometry.attributes.position.count;assert.match(mesh.userData.zoneArmorSource,/Swat\.glb/);assert.ok(originals.some(n=>n.skeleton===mesh.skeleton));mesh.updateMatrixWorld(true);for(const n of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}
  assert.ok(vertices>30);assert.equal(JSON.stringify(actor.animations.map(c=>c.toJSON())),clips);
  for(const n of originals){assert.deepEqual(n.mesh.geometry.attributes.position.array,n.position);assert.deepEqual(n.mesh.geometry.attributes.skinIndex.array,n.joints);assert.equal(n.mesh.material,n.materials);}
  const box=new T.Box3();for(const mesh of vest.meshes)box.union(new T.Box3().setFromObject(mesh));const size=box.getSize(new T.Vector3());assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n>0));assert.ok(size.x>=.3 && size.y>=.28,'combined worn surfaces must cover a torso, not merely a narrow central strap');
  vest.dispose();vest.dispose();assert.ok(vest.meshes.every(n=>n.parent===null));t.diagnostic(`${outfit}: ${vertices} derived torso vertices, original body/rig/clips unchanged`);disposeCharacterResources([actor.scene,source.scene]);
});
test('unequip and costume changes fence pending armor loads without stale geometry or currency writes',async()=>{
  let finish,loads=0;const receipts=[],source=await wardrobe('Swat'),actor=await wardrobe('Suit');
  const controller=createArmorController({THREE:T,loadSource:()=>{loads++;return new Promise(r=>finish=r);},publish:r=>receipts.push(r)});
  const pending=controller.update({armorId:'vest',armorOwned:true,armorReduction:.25},actor.scene);await Promise.resolve();
  await controller.update({armorId:null,armorOwned:false},actor.scene);finish(source);await pending;
  assert.equal(loads,1);assert.equal(receipts.at(-1).armorId,null);assert.ok(!actor.scene.children.some(n=>n.name==='ZONE representative worn vest'));
  await controller.update({armorId:'custom',armorOwned:true,armorReduction:.2},actor.scene);assert.equal(receipts.at(-1).status,'unrepresented');assert.equal(loads,1);
  controller.dispose();disposeCharacterResources([actor.scene,source.scene]);
});
test('character template installs same-origin armor bridge, actual controller and teardown',()=>{
  const html=readFileSync(new URL('../dist/character3d.html',import.meta.url),'utf8'),source=JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  assert.match(source,/character-armor\.mjs\?v=107/);assert.match(source,/armorController\.update\(state, model\)/);assert.match(source,/armorController\.dispose\(\)/);assert.match(source,/e\.source !== parent \|\| e\.origin !== location\.origin/);
});
test('tactical outfit keeps its existing armor costume without doubling vest geometry',async()=>{
  const actor=await wardrobe('Swat'),receipts=[];actor.scene.userData.outfit='Swat';let requests=0;
  const controller=createArmorController({THREE:T,loadSource:()=>{requests++;throw Error('must not duplicate outfit');},publish:r=>receipts.push(r)});
  await controller.update({outfit:'tactical',armorId:'vest',armorOwned:true,armorReduction:.25},actor.scene);
  assert.equal(requests,0);assert.equal(receipts.at(-1).representation,'existing-tactical-costume');assert.equal(receipts.at(-1).status,'ready');controller.dispose();disposeCharacterResources([actor.scene]);
});
test('a pending or failed tactical selection cannot claim the retained Suit actor is a tactical costume',async()=>{
  const actor=await wardrobe('Suit'),receipts=[];actor.scene.userData.outfit='Suit';let requests=0;
  const controller=createArmorController({THREE:T,loadSource:async()=>{requests++;throw Error('optional source unavailable');},publish:r=>receipts.push(r)});
  await controller.update({outfit:'tactical',armorId:'vest',armorOwned:true,armorReduction:.25},actor.scene);
  assert.equal(requests,1);assert.equal(receipts.at(-1).status,'unrepresented');assert.notEqual(receipts.at(-1).representation,'existing-tactical-costume');controller.dispose();disposeCharacterResources([actor.scene]);
});

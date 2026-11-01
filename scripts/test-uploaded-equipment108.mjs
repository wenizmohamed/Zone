import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { uploadedAssetId, isUploadedAssetId, isMeleeWeaponKey, uploadedWeaponTargetLength, loadUploadedCharacter, createUploadedWeaponLoader, createUploadedArmorController } from '../dist/uploaded-equipment108.mjs';

const id='a'.repeat(64);
const box=()=>new T.Mesh(new T.BoxGeometry(.2,.4,.1),new T.MeshStandardMaterial({color:0x80694b}));
function media(object=box(),animations=[]){let calls=0;return{kind:'model',object,animations,transform:{scale:1,rotation:[0,0,0],floorOffset:0,cameraTarget:[0,0,0]},dispose(){calls++;},get disposed(){return calls;}};}
function nativeWeapon(){const calls=[];return{calls,descriptor:key=>({id:key}),load:async key=>{calls.push(key);return key==='fists'?null:box();},release(){},dispose(){}};}
function nativeArmor(){const calls=[];return{calls,update:async(...args)=>{calls.push(args);},dispose(){}};}
async function suit(){const bytes=readFileSync(new URL('../assets/character/quaternius/Suit.glb',import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}

test('only published hash identities may request uploaded equipment',()=>{
  assert.equal(uploadedAssetId(id),id);assert.equal(isUploadedAssetId(id),true);for(const value of ['../../asset','https://example.test/model.glb','A'.repeat(64),null,{},'']){assert.equal(uploadedAssetId(value),null);assert.equal(isUploadedAssetId(value),false);}
});
test('real retained rig uploaded through the adapter keeps all clips and original geometry while fitting the stage',async()=>{
  const source=await suit(),owned=media(source.scene,source.animations),receipt=[];
  const original=[];source.scene.traverse(node=>{if(node.isMesh)original.push([node.geometry.attributes.position,node.geometry.attributes.position.array.slice()]);});
  const result=await loadUploadedCharacter(id,()=>{throw Error('compatible upload must not fall back');},{loader:async()=>owned,publish:r=>receipt.push(r)});
  assert.equal(result.uploadedMedia,owned);assert.equal(result.animations.length,24);assert.equal(receipt[0].representation,'uploaded-compatible-rig');
  const bounds=new T.Box3().setFromObject(result.scene,true);assert.ok(Math.abs(bounds.getSize(new T.Vector3()).y-1.82)<.001);
  for(const[attribute,bytes]of original)assert.deepEqual(attribute.array,bytes);
});
test('an unrigged object cannot masquerade as an animated character and retains the native outfit',async()=>{
  const owned=media(),fallback={scene:new T.Group()},receipts=[];let called=0;
  const result=await loadUploadedCharacter(id,async()=>{called++;return fallback;},{loader:async()=>owned,publish:r=>receipts.push(r)});
  assert.equal(result,fallback);assert.equal(called,1);assert.equal(owned.disposed,1);assert.equal(receipts.at(-1).status,'fallback');
});
test('missing and cancelled custom characters do not produce phantom authored rigs',async()=>{
  const original={scene:new T.Group()};assert.equal(await loadUploadedCharacter(null,()=>original),original);
  const abort=new AbortController();abort.abort();let fallback=false;
  await assert.rejects(loadUploadedCharacter(id,()=>{fallback=true;},{signal:abort.signal,loader:async()=>{throw Error('aborted');}}),/aborted/);assert.equal(fallback,false);
});
test('real uploaded weapon geometry is held with explicit bounds-estimated fit and releases exactly once',async()=>{
  const native=nativeWeapon(),owned=media(),receipts=[],positions=owned.object.geometry.attributes.position.array.slice();
  const loader=createUploadedWeaponLoader(native,{loader:async()=>owned,publish:r=>receipts.push(r)});
  const model=await loader.load('bat',id),bounds=new T.Box3().setFromObject(model,true);
  assert.ok(Math.abs(Math.max(...bounds.getSize(new T.Vector3()).toArray())-.715)<.00001);
  assert.deepEqual(owned.object.geometry.attributes.position.array,positions);assert.equal(model.userData.zoneWeaponAsset.id,'uploaded:'+id);
  assert.equal(receipts[0].gripQuality,'bounds-estimated');assert.equal(receipts[0].itemExact,true);
  loader.release(model);loader.release(model);loader.dispose();assert.equal(owned.disposed,1);assert.deepEqual(native.calls,[]);
});
test('failed upload keeps the actual existing preset and fists never acquire a visual weapon',async()=>{
  const native=nativeWeapon(),receipts=[];let loads=0;
  const loader=createUploadedWeaponLoader(native,{loader:async()=>{loads++;throw Error('missing');},publish:r=>receipts.push(r)});
  assert.ok(await loader.load('knife',id));assert.equal(await loader.load('fists',id),null);assert.equal(loads,1);assert.deepEqual(native.calls,['knife','fists']);assert.equal(receipts[0].status,'fallback');loader.dispose();
});
test('owned equipped armor uses its real model with truthful rigid attachment and unequip removes it',async()=>{
  const actor=new T.Group(),chest=new T.Bone();chest.name='Chest';actor.add(chest);const source=media(),native=nativeArmor(),receipts=[];let loads=0;
  const controller=createUploadedArmorController(native,{loader:async()=>{loads++;return source;},publish:r=>receipts.push(r)});
  await controller.update({armorId:'custom',armorOwned:false,armorMediaAsset:id},actor);assert.equal(loads,0);
  await controller.update({armorId:'custom',armorOwned:true,armorMediaAsset:id},actor);assert.equal(loads,1);assert.equal(chest.children.length,1);
  assert.equal(receipts.at(-1).rigging,'rigid-attachment-not-retargeted');assert.equal(receipts.at(-1).representation,'uploaded-rigid-chest-model');
  await controller.update({armorId:null,armorOwned:false,armorMediaAsset:id},actor);assert.equal(chest.children.length,0);assert.equal(source.disposed,1);controller.dispose();
});
test('late armor load cannot re-equip an item after actual unequip',async()=>{
  const actor=new T.Group(),chest=new T.Bone();chest.name='Chest';actor.add(chest);const source=media(),native=nativeArmor();let resolve;
  const controller=createUploadedArmorController(native,{loader:()=>new Promise(done=>resolve=done)});
  const pending=controller.update({armorId:'custom',armorOwned:true,armorMediaAsset:id},actor);await Promise.resolve();
  await controller.update({armorId:null,armorOwned:false},actor);resolve(source);await pending;
  assert.equal(chest.children.length,0);assert.equal(source.disposed,1);controller.dispose();
});
test('custom armor without a valid actor attachment preserves the established armor fallback',async()=>{
  const actor=new T.Group(),source=media(),native=nativeArmor(),receipts=[];
  const controller=createUploadedArmorController(native,{loader:async()=>source,publish:r=>receipts.push(r)});
  await controller.update({armorId:'vest',armorOwned:true,armorMediaAsset:id},actor);
  assert.equal(receipts.at(-1).status,'fallback');assert.equal(native.calls.at(-1)[0].armorId,'vest');assert.equal(source.disposed,1);controller.dispose();
});
test('uploaded character, weapon and armor reads remain published by default and require explicit draft opt-in',async()=>{
  const characterReads=[];
  for(const options of [{},{draft:true}])await loadUploadedCharacter(id,()=>({scene:new T.Group()}),{...options,loader:async(_id,settings)=>{characterReads.push(settings.draft);return media();}});
  assert.deepEqual(characterReads,[false,true]);
  const weaponReads=[],weapon=createUploadedWeaponLoader(nativeWeapon(),{loader:async(_id,settings)=>{weaponReads.push(settings.draft);return media();}});
  weapon.release(await weapon.load('knife',id));weapon.release(await weapon.load('knife',id,{draft:true}));weapon.dispose();assert.deepEqual(weaponReads,[false,true]);
  const armorReads=[],actor=new T.Group(),chest=new T.Bone();chest.name='Chest';actor.add(chest);
  const armor=createUploadedArmorController(nativeArmor(),{loader:async(_id,settings)=>{armorReads.push(settings.draft);return media();}});
  await armor.update({armorId:'vest',armorOwned:true,armorMediaAsset:id},actor);
  await armor.update({armorId:'vest',armorOwned:true,armorMediaAsset:id,draft:true},actor);armor.dispose();assert.deepEqual(armorReads,[false,true]);
});

test('Home and Combat consume the same optional published identities while preserving native renderers and same-origin gate',()=>{
  const html=readFileSync(new URL('../dist/character3d.html',import.meta.url),'utf8');const template=JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  assert.match(template,/uploaded-equipment108\.mjs/);assert.match(template,/loadUploadedCharacter\(requestedAsset/);assert.match(template,/weaponAssets\.load\(key, state\.weaponMediaAsset, \{ draft: state\.draft === true \}\)/);assert.match(template,/e\.source !== parent \|\| e\.origin !== location\.origin/);
  const combat=readFileSync(new URL('../dist/combat-presentation.js',import.meta.url),'utf8');
  assert.match(combat,/equipment\.characterMediaAsset/);assert.match(combat,/equipment\.weaponMediaAsset/);assert.match(combat,/equipment\.armorMediaAsset/);assert.match(combat,/new T\.WebGLRenderer/);
});

test('weapon and armor controllers expose structured upload diagnostics',async()=>{
  const weapon=createUploadedWeaponLoader(nativeWeapon(),{loader:async()=>media()});
  assert.deepEqual(weapon.diagnostics(),{disposed:false,activeUploadCount:0,pendingUploadCount:0});
  assert.equal(weapon.isDisposed(), false);
  assert.equal(weapon.activeUploadCount(), 0);
  assert.equal(weapon.pendingUploadCount(), 0);
  assert.equal(isMeleeWeaponKey('bat'), true);
  assert.equal(isMeleeWeaponKey('glock'), false);
  assert.equal(uploadedWeaponTargetLength('bat'), .715);
  assert.equal(uploadedWeaponTargetLength('sniperrifle_1'), .88);
  const mesh=await weapon.load('bat',id);
  assert.equal(weapon.diagnostics().activeUploadCount,1);
  assert.equal(weapon.activeUploadCount(), 1);
  weapon.release(mesh);
  assert.equal(weapon.diagnostics().activeUploadCount,0);
  weapon.dispose();
  assert.equal(weapon.diagnostics().disposed,true);
  assert.equal(weapon.isDisposed(), true);

  const actor=new T.Group(),chest=new T.Bone();chest.name='Chest';actor.add(chest);
  const armor=createUploadedArmorController(nativeArmor(),{loader:async()=>media()});
  assert.deepEqual(armor.diagnostics(),{disposed:false,sequence:0,hasActiveUpload:false,lastReceipt:null});
  assert.equal(armor.isDisposed(), false);
  assert.equal(armor.hasActiveUpload(), false);
  await armor.update({armorId:'vest',armorOwned:true,armorMediaAsset:id},actor);
  assert.equal(armor.diagnostics().hasActiveUpload,true);
  assert.equal(armor.hasActiveUpload(), true);
  assert.equal(armor.diagnostics().lastReceipt?.status,'ready');
  armor.dispose();
  assert.equal(armor.diagnostics().disposed,true);
  assert.equal(armor.isDisposed(), true);
});

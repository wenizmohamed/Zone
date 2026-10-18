// Default-source tests only: no private captures, browser, network or generated
// fixture files. Offline visual review is separate from these geometry gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../lib/three184/three.module.js';
import {GLTFLoader} from '../lib/three184/GLTFLoader.js';
import {geometryGlb} from '../assets/weapons/source-tools/geometry-audit.mjs';
import {normalizeWeaponAsset,resolveWeaponAsset} from '../dist/weapon-assets.js';
import {prepareCharacterGrip,applyCharacterGrip,attachHeldWeapon} from '../dist/character-grip.js';
import {prepareWeaponPose,applyWeaponPose,weaponPoseProfile} from '../dist/character-poses.js';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root));
const catalogContext=vm.createContext({});vm.runInContext(read('assets/weapons/catalog.js').toString(),catalogContext);const catalog=catalogContext.ZONE_WEAPONS;
async function fixture(outfit,key){
  const bytes=read('assets/character/quaternius/'+outfit+'.glb'),actor=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const clips=Object.fromEntries(actor.animations.map(c=>[c.name,c])),mixer=new T.AnimationMixer(actor.scene);mixer.clipAction(clips.Idle).play();mixer.update(.01);actor.scene.updateMatrixWorld(true);
  const grip=prepareCharacterGrip(T,actor.scene,clips),rig=prepareWeaponPose(T,actor.scene,grip),descriptor=resolveWeaponAsset(key,catalog);
  const weapon=normalizeWeaponAsset(T,(await geometryGlb(new URL('assets/weapons/'+descriptor.url,root))).scene,descriptor);
  const held=attachHeldWeapon(T,grip,weapon,[0,0,0],descriptor.axis,descriptor.forward);held.userData.zoneSupportPoint=[.27,.07,0];
  return {actor:actor.scene,mixer,clips,grip,rig,descriptor,weapon,held,key};
}
// The shipping tick always advances the AnimationMixer before the upper-body
// layer. Reset the authored frame here too, rather than feeding one solved IK
// pose into the other fixture's untouched bind pose and comparing arbitrary roll.
const pose=(f,action,extra={})=>{f.mixer.setTime(.01);applyCharacterGrip(f.grip);return applyWeaponPose(f.rig,f.held,{profile:weaponPoseProfile(f.key,catalog),action,...extra});};
const nearArray=(actual,expected,epsilon=1e-6)=>{assert.equal(actual.length,expected.length);actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<epsilon,'coordinate '+i+' differs'));};

for(const outfit of ['Suit','Casual_Hoodie','Swat'])for(const key of ['sniperrifle_3','sniperrifle_6'])test(outfit+'/'+key+' idle stock carry is explicit, preserves fingers/assets/socket and restores original firing attachment',async()=>{
  const f=await fixture(outfit,key),original=f.held.quaternion.toArray(),anchor=f.held.position.toArray(),scale=f.weapon.scale.toArray();
  const fingers=f.grip.pose.map(p=>p.quaternion.toArray()),geometry=[];f.weapon.traverse(o=>{if(o.isMesh)geometry.push([o.geometry,o.geometry.attributes.position.array.slice()]);});
  const result=pose(f,'idle');
  assert.equal(f.held.userData.zoneMosinIdleStockGrip.mode,'mosin-idle-carry');assert.equal(result.gripCalibration.firingGripResolved,false);
  assert.equal(result.gripCalibration.sourceId,'mosin9130-detail112');
  const expected=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),f.grip.axis).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),T.MathUtils.degToRad(15)));
  nearArray(f.held.quaternion.toArray(),expected.toArray());assert.deepEqual(f.held.position.toArray(),anchor);assert.deepEqual(f.weapon.scale.toArray(),scale);
  for(const [i,p]of f.grip.pose.entries()){assert.deepEqual(p.quaternion.toArray(),fingers[i]);nearArray(p.bone.quaternion.toArray(),fingers[i]);}
  for(const [g,positions]of geometry)assert.deepEqual(g.attributes.position.array,positions);
  for(const action of ['guard','punch','slash','combo','heavy','hit','throw','taunt','walk']){
    const result=pose(f,action);assert.equal(result.gripCalibration,undefined);assert.equal(f.held.userData.zoneMosinIdleStockGrip,undefined);
    assert.deepEqual(f.held.quaternion.toArray(),original);assert.deepEqual(f.held.position.toArray(),anchor);
    assert.ok(result.rightError<.005&&(result.leftError||0)<.005);
  }
  pose(f,'idle');nearArray(f.held.quaternion.toArray(),expected.toArray());
  assert.deepEqual(f.held.userData.zoneMosinIdleStockGrip.originalQuaternion,original);
});

test('repeated idle application cannot accumulate roll or shift the grip anchor',async()=>{
  const f=await fixture('Suit','sniperrifle_3');pose(f,'idle');const q=f.held.quaternion.toArray(),anchor=f.held.position.toArray();
  for(let i=0;i<120;i++){pose(f,'idle',{elapsed:i/60,dt:1/60});nearArray(f.held.quaternion.toArray(),q);assert.deepEqual(f.held.position.toArray(),anchor);}
});

test('explicit opt-out remains canonical and also restores an active idle calibration',async()=>{
  const f=await fixture('Suit','sniperrifle_3'),q=f.held.quaternion.toArray();
  pose(f,'idle',{mosinIdleGrip:false});assert.deepEqual(f.held.quaternion.toArray(),q);assert.equal(f.held.userData.zoneMosinIdleStockGrip,undefined);
  pose(f,'idle');pose(f,'idle',{mosinIdleGrip:false});assert.deepEqual(f.held.quaternion.toArray(),q);assert.equal(f.held.userData.zoneMosinIdleStockGrip,undefined);
});

test('bat, knife, pistol, G3, Dragunov and M4 keep their original calibration in every supported state',async()=>{
  for(const key of ['bat','knife','pistol_2','assaultrifle_2','sniperrifle_2','assaultrifle_1']){
    const a=await fixture('Casual_Hoodie',key),b=await fixture('Casual_Hoodie',key);
    for(const action of ['idle','guard','punch','hit','walk']){
      const ra=pose(a,action),rb=pose(b,action,{mosinIdleGrip:false});
      assert.equal(a.held.userData.zoneMosinIdleStockGrip,undefined);assert.equal(ra.gripCalibration,undefined);
      nearArray(a.held.quaternion.toArray(),b.held.quaternion.toArray());nearArray(ra.socket,rb.socket);
      for(const side of ['right','left'])for(const bone of ['upper','lower','hand'])nearArray(a.rig[side][bone].quaternion.toArray(),b.rig[side][bone].quaternion.toArray());
    }
  }
});

test('fire/guard after idle produce the canonical original wrist/forearm pose, not an overhand trigger claim',async()=>{
  for(const action of ['guard','punch','slash','heavy','hit']){
    const a=await fixture('Suit','sniperrifle_3'),b=await fixture('Suit','sniperrifle_3');pose(a,'idle');pose(b,'idle',{mosinIdleGrip:false});
    const active=pose(a,action),canonical=pose(b,action,{mosinIdleGrip:false});
    assert.equal(active.gripCalibration,undefined);nearArray(active.socket,canonical.socket);
    for(const bone of ['upper','lower','hand']){
      // Keep the original component-wise canonical assertion. Imported glTF
      // quaternions have finite float32 norm error; normalize copies only for
      // the additional angular measurement, never mutate runtime bones here.
      nearArray(a.rig.right[bone].quaternion.toArray(),b.rig.right[bone].quaternion.toArray());
      const angle=a.rig.right[bone].quaternion.clone().normalize().angleTo(b.rig.right[bone].quaternion.clone().normalize());
      assert.ok(angle<1e-5,action+'/'+bone+' canonical orientation differs by '+T.MathUtils.radToDeg(angle)+' degrees');
    }
    // Also cover real new AnimationMixer writes, not only its same-sample
    // cached-property branch. Both fixtures enter the actual authored gun clip.
    pose(a,'idle');pose(b,'idle',{mosinIdleGrip:false});
    for(const f of [a,b]){f.mixer.stopAllAction();f.mixer.clipAction(f.clips.Gun_Shoot).reset().play();f.mixer.setTime(.17);applyCharacterGrip(f.grip);}
    const animated=applyWeaponPose(a.rig,a.held,{profile:'longgun',action}),reference=applyWeaponPose(b.rig,b.held,{profile:'longgun',action,mosinIdleGrip:false});
    nearArray(animated.socket,reference.socket);
    for(const bone of ['upper','lower','hand'])nearArray(a.rig.right[bone].quaternion.toArray(),b.rig.right[bone].quaternion.toArray());
  }
});

test('idle calibration changes only the arm solution, retaining authored bone lengths and lower-body animation',async()=>{
  const f=await fixture('Swat','sniperrifle_6'),lengths=[];
  f.actor.traverse(o=>{if(o.isBone)lengths.push([o,o.position.toArray(),o.scale.toArray()]);});
  const hips=f.rig.bones.get('hips').quaternion.toArray();const result=pose(f,'idle');
  for(const [bone,position,scale]of lengths){assert.deepEqual(bone.position.toArray(),position);assert.deepEqual(bone.scale.toArray(),scale);}
  assert.deepEqual(f.rig.bones.get('hips').quaternion.toArray(),hips);assert.ok(result.rightError<.005&&(result.leftError||0)<.005);
});

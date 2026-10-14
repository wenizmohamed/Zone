// Independent geometry/animation gates. Tests use retained assets directly and
// do not depend on private docs, network, generated reports or browser mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
// Read actual authored geometry and animation. This audit does not modify assets.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { OBJLoader } from '../lib/three184/OBJLoader.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';
import { normalizeWeaponAsset, resolveWeaponAsset, WEAPON_ASSETS } from '../dist/weapon-assets.js';
import { computeCharacterFrame } from '../dist/character-presentation.js';
const root = new URL('../', import.meta.url), read = path => fs.readFileSync(new URL(path, root));
const hash = path => createHash('sha256').update(read(path)).digest('hex');
const usePose = true;
const poseModule = usePose ? await import('../dist/character-poses.js') : null;
const sourceHashes = Object.fromEntries(['dist/character3d.html','dist/character-grip.js','dist/weapon-assets.js', ...(usePose ? ['dist/character-poses.js'] : [])].map(path => [path, hash(path)]));
const viewer = JSON.parse(read('dist/character3d.html').toString().match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const supportLiteral = viewer.match(/const support = (\{[^;]+\});/)?.[1];
const supportPoints = supportLiteral ? vm.runInNewContext('('+supportLiteral+')') : {};
const runtimeClipMap=vm.runInNewContext('('+viewer.match(/const CLIP = (\{[\s\S]*?\n\});/)[1]+')');
const playSource=viewer.slice(viewer.indexOf('function play('),viewer.indexOf('// Original CC0'));
const cameraAzimuth=Number(viewer.match(/camera\.position\.set\(Math\.sin\(([-.\d]+)\)/)?.[1] || '.18');
const context = vm.createContext({}); vm.runInContext(read('assets/weapons/catalog.js').toString(), context);
const catalog = context.ZONE_WEAPONS;
async function glb(path, geometryOnly = false) {
  let bytes = read(path);
  if (geometryOnly) {
    const length = bytes.readUInt32LE(12), data = JSON.parse(bytes.toString('utf8',20,20+length));
    delete data.materials; delete data.textures; delete data.images; delete data.samplers;
    for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    const json = Buffer.from(JSON.stringify(data)), padded = Buffer.alloc(Math.ceil(json.length/4)*4,32); json.copy(padded);
    const tail = bytes.subarray(20+length), out = Buffer.alloc(20+padded.length+tail.length);
    out.write('glTF'); out.writeUInt32LE(2,4); out.writeUInt32LE(out.length,8); out.writeUInt32LE(padded.length,12); out.writeUInt32LE(0x4e4f534a,16); padded.copy(out,20); tail.copy(out,20+padded.length); bytes=out;
  }
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const round = value => Number(value.toFixed(5)), vec = value => value.toArray().map(round);
function fingerCavity(bones,side) {
  const centers=['Index','Middle','Ring','Pinky'].map(finger=>{
    const [a,b,c]=[2,3,4].map(joint=>bones[finger+joint+side].getWorldPosition(new THREE.Vector3()));
    const ab=b.clone().sub(a),ac=c.clone().sub(a),cross=ab.clone().cross(ac);
    const offset=cross.clone().cross(ab).multiplyScalar(ac.lengthSq()).add(ac.clone().cross(cross).multiplyScalar(ab.lengthSq())).divideScalar(2*cross.lengthSq());
    return a.clone().add(offset);
  });
  return centers.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(.25);
}
const weapons = [], models = new Map();
for (const key of [...new Set([...Object.keys(catalog), ...Object.keys(WEAPON_ASSETS)])]) {
  const d = resolveWeaponAsset(key,catalog);
  if (!models.has(d.id)) {
    const scene = d.format === 'obj' ? new OBJLoader().parse(read('assets/weapons/'+d.file+'.obj').toString()) : (await glb('assets/weapons/'+d.url,true)).scene;
    models.set(d.id,normalizeWeaponAsset(THREE,scene,d));
  }
  const model=models.get(d.id), box=new THREE.Box3().setFromObject(model);
  weapons.push({key,family:catalog[key]?.fam||key,asset:d.id,format:d.format||'glb',dimensionsM:vec(box.getSize(new THREE.Vector3())),min:vec(box.min),max:vec(box.max),axis:d.axis,forward:d.forward,source:d.source});
}
const actions={idle:'Idle',guard:'Idle_Gun_Pointing',punch:'Punch_Right',slash:'Sword_Slash',heavy:'Kick_Right',combo:'Punch_Left',hit:'HitRecieve',throw:'Interact',taunt:'Wave',walk:'Walk',down:'Death'};
const wardrobe=[], matrix=[];
for (const file of ['Casual_Hoodie','Suit','Swat']) {
  const asset=await glb('assets/character/quaternius/'+file+'.glb'), model=asset.scene;
  const clips=Object.fromEntries(asset.animations.map(clip=>[clip.name,clip])), mixer=new THREE.AnimationMixer(model);
  mixer.clipAction(clips.Idle).play(); mixer.setTime(.01); model.updateMatrixWorld(true);
  const grip=prepareCharacterGrip(THREE,model,clips), bones={}; model.traverse(node=>{if(node.isBone) bones[node.name.replace(/[._-]/g,'')]=node;});
  const poseRig = usePose ? poseModule.prepareWeaponPose(THREE,model,grip) : null;
  applyCharacterGrip(grip); model.updateMatrixWorld(true);
  // Use the actual portrait camera, not the legacy viewer azimuth, when
  // measuring whether the broad blade face survives the Home-card framing.
  const portraitFrame=computeCharacterFrame(THREE,new THREE.Box3().setFromObject(model),2);
  const coordinates=Object.fromEntries(['UpperArmR','LowerArmR','WristR','UpperArmL','LowerArmL','WristL','Chest','Hips'].map(name=>[name,vec(bones[name].getWorldPosition(new THREE.Vector3()))]));
  wardrobe.push({file,clips:asset.animations.map(c=>({name:c.name,duration:c.duration})),coordinates,upperArmM:round(bones.LowerArmR.position.length()),forearmM:round(bones.WristR.position.length()),gripOffsetM:vec(grip.center)});
  for (const weapon of weapons) {
    const mesh=models.get(weapon.asset).clone(true), d=resolveWeaponAsset(weapon.key,catalog);
    const hold=attachHeldWeapon(THREE,grip,mesh,[0,0,0],d.axis,d.forward);
    hold.userData.zoneSupportPoint=supportPoints[catalog[weapon.key]?.fam] || [.24,.06,0];
    const weaponBox=new THREE.Box3(new THREE.Vector3(...weapon.min),new THREE.Vector3(...weapon.max));
    for (const [action,originalClipName] of Object.entries(actions)) {
      const samples=[]; mixer.stopAllAction();
      let clipName=originalClipName;
      if(usePose){
        const context=vm.createContext({THREE,state:{weapon:weapon.key},WCAT:catalog,weaponPoseProfile:poseModule.weaponPoseProfile,CLIP:runtimeClipMap,find:list=>list.map(name=>clips[name]).find(Boolean),mixer,current:null,paintBar(){}});
        vm.runInContext(playSource,context); clipName=context.play(action,{fade:0}).getClip().name;
      }else mixer.clipAction(clips[clipName]).reset().play();
      for (const phase of [.01,.25,.5,.75,.99]) {
        mixer.setTime(clips[clipName].duration*phase); applyCharacterGrip(grip); model.updateMatrixWorld(true);
        const lowerBodyBefore = bones.Hips.quaternion.toArray();
        const pose=usePose ? poseModule.applyWeaponPose(poseRig,hold,{profile:poseModule.weaponPoseProfile(weapon.key,catalog),action,phase,elapsed:clips[clipName].duration*phase}) : null;
        const longAxis=new THREE.Vector3(weapon.key==='bat'?0:1,weapon.key==='bat'?1:0,0).transformDirection(mesh.matrixWorld);
        const leftPalm=usePose&&pose?.profile==='longgun'?fingerCavity(bones,'L'):bones.WristL.localToWorld(new THREE.Vector3(0,.10,0)), local=mesh.worldToLocal(leftPalm.clone());
        const boxLowerBound=local.distanceTo(weaponBox.clampPoint(local,new THREE.Vector3()));
        const cameraDirection=new THREE.Vector3(Math.sin(cameraAzimuth),.03,Math.cos(cameraAzimuth)).normalize();
        const pos=name=>bones[name].getWorldPosition(new THREE.Vector3());
        const wristBend=side=>THREE.MathUtils.radToDeg(pos('Wrist'+side).sub(pos('LowerArm'+side)).angleTo(pos('Middle2'+side).sub(pos('Wrist'+side))));
        const wristRightDegrees=wristBend('R'),wristLeftDegrees=wristBend('L');
        const armLengthError=Math.max(Math.abs(pos('UpperArmR').distanceTo(pos('LowerArmR'))-.1819080859),Math.abs(pos('LowerArmR').distanceTo(pos('WristR'))-.2352799922));
        const bladeFaceCameraAlignment=weapon.key==='knife' ? Math.abs(new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld)
          .dot(portraitFrame.position.clone().sub(hold.getWorldPosition(new THREE.Vector3())).normalize())) : null;
        const chestSocket=usePose ? hold.getWorldPosition(new THREE.Vector3()).sub(pos('Chest')).applyQuaternion(bones.Chest.getWorldQuaternion(new THREE.Quaternion()).multiply(poseRig.chestReference).invert()).toArray() : null;
        samples.push({phase,axis:vec(longAxis),chestSocket,rightElbow:vec(pos('LowerArmR')),rightShoulder:vec(pos('UpperArmR')),cameraAlignment:round(Math.abs(longAxis.dot(cameraDirection))),bladeFaceCameraAlignment,leftPalmToBoundsM:round(boxLowerBound),handsM:round(bones.WristL.getWorldPosition(new THREE.Vector3()).distanceTo(grip.hand.getWorldPosition(new THREE.Vector3()))),...(usePose?{pose,armLengthError,wristRightDegrees,wristLeftDegrees,leftCavityToSupportM:pose?.supportTarget?leftPalm.distanceTo(new THREE.Vector3(...pose.supportTarget)):null,hipsUnchanged:lowerBodyBefore.every((value,i)=>value===bones.Hips.quaternion.toArray()[i])}: {})});
      }
      matrix.push({outfit:file,key:weapon.key,family:weapon.family,asset:weapon.asset,action,clip:clipName,samples,renderedReview:'not captured by this audit'});
    }
    hold.removeFromParent();
  }
}
const result={createdAt:new Date().toISOString(),poseLayer:usePose,scope:'Actual local authored geometry and current pose mapping; no visual-quality pass inferred',sourceHashes,sourceChangedDuringRun:Object.keys(sourceHashes).some(path=>hash(path)!==sourceHashes[path]),counts:{catalogKeys:Object.keys(catalog).length,weaponKeys:weapons.length,uniqueModels:models.size,outfits:wardrobe.length,actions:Object.keys(actions).length,matrixRows:matrix.length,poseSamples:matrix.length*5},weapons,wardrobe,matrix};

const report = result;
const samples=report.matrix.flatMap(row=>row.samples.map(sample=>({...sample,key:row.key,outfit:row.outfit,action:row.action})));
const describe=s=>`${s.outfit}/${s.key}/${s.action}@${s.phase}`;
test('Every retained model socket lies between actual handle side surfaces, not in empty space',()=>{
  const failures=[];
  for(const weapon of weapons){const model=models.get(weapon.asset);model.updateMatrixWorld(true);
    for(const side of [-1,1]){
      const hit=new THREE.Raycaster(new THREE.Vector3(0,0,side*.12),new THREE.Vector3(0,0,-side)).intersectObject(model,true)[0];
      if(!hit||hit.point.z*side<.001||hit.point.z*side>.04)failures.push(`${weapon.key} side${side}: ${hit?hit.point.z.toFixed(4)+'m':'no actual handle surface'}`);
    }
  }
  assert.equal(failures.length,0,failures.join('; '));
});
test('Pose audit measures every retained weapon, three real rigs and complete action cycles',()=>{
  assert.equal(report.sourceChangedDuringRun,false,'Runtime source changed during measurement; rerun on stable files.');
  assert.equal(report.counts.catalogKeys,49);assert.equal(report.counts.weaponKeys,51);assert.equal(report.counts.outfits,3);
  assert.equal(report.counts.poseSamples,8415);assert.equal(report.weapons.filter(w=>w.format==='glb').map(w=>w.asset).filter((v,i,a)=>a.indexOf(v)===i).length,20);
  assert.equal(report.counts.uniqueModels,20,'All 51 gameplay IDs use 20 explicitly disclosed real source models, not 51 invented unique meshes');
  for(const key of ['pistol_t','shotgun','smg','sniper','assaultrifle_1','magnum','sawedoff','bullpup_1'])assert.ok(report.weapons.some(weapon=>weapon.key===key&&weapon.format==='glb'),`upgraded ${key} missing from actual pose matrix`);
});
test('Upper body posing keeps authored arm lengths and lower-body animation unchanged',()=>{
  const broken=samples.filter(s=>!s.hipsUnchanged||s.armLengthError>1e-5);
  assert.equal(broken.length,0,broken.slice(0,5).map(describe).join(', '));
});
for(const profile of ['bat','knife','handgun','longgun'])test(`${profile}: every action keeps both required hand targets within 5mm reach`,()=>{
  const broken=samples.filter(s=>s.pose.profile===profile&&(s.pose.rightError>.005||(s.pose.leftError||0)>.005));
  assert.equal(broken.length,0,broken.slice(0,8).map(s=>`${describe(s)} R${(s.pose.rightError*1000).toFixed(1)}mm L${((s.pose.leftError||0)*1000).toFixed(1)}mm`).join('; '));
});
test('Idle and walking bat retain a readable shaft instead of pointing down the default camera',()=>{
  const broken=samples.filter(s=>s.key==='bat'&&['idle','walk'].includes(s.action)&&s.cameraAlignment>.8);
  assert.equal(broken.length,0,broken.slice(0,5).map(s=>`${describe(s)} camera alignment=${s.cameraAlignment}`).join('; '));
});
test('Actual M9 broad blade face is exposed to the Home portrait camera in idle and guard',t=>{
  const measured=samples.filter(s=>s.key==='knife'&&['idle','guard'].includes(s.action));
  assert.equal(measured.length,30);
  const broken=measured.filter(s=>s.bladeFaceCameraAlignment<.75);
  assert.equal(broken.length,0,broken.slice(0,8).map(s=>`${describe(s)} blade face=${s.bladeFaceCameraAlignment.toFixed(3)}`).join('; '));
  t.diagnostic(`M9 face visibility min=${Math.min(...measured.map(s=>s.bladeFaceCameraAlignment)).toFixed(3)}, max=${Math.max(...measured.map(s=>s.bladeFaceCameraAlignment)).toFixed(3)}; max right-socket error=${Math.max(...measured.map(s=>s.pose.rightError)).toExponential(2)}m; max wrist bend=${Math.max(...measured.map(s=>s.wristRightDegrees)).toFixed(1)}deg. Rendered inspection remains required.`);
});

test('Knife slash and combo produce a visible diagonal attack stroke through the real clip phase',t=>{
  const measured=report.matrix.filter(row=>row.key==='knife'&&['slash','combo'].includes(row.action));
  assert.equal(measured.length,6);
  const spans=[];
  for(const row of measured){
    const x=row.samples.map(s=>s.chestSocket[0]),y=row.samples.map(s=>s.chestSocket[1]);
    const horizontal=Math.max(...x)-Math.min(...x),vertical=Math.max(...y)-Math.min(...y);
    const axes=row.samples.map(s=>new THREE.Vector3(...s.pose.axis));
    const angle=Math.max(...axes.flatMap(a=>axes.map(b=>THREE.MathUtils.radToDeg(a.angleTo(b)))));
    assert.ok(horizontal>.30,`${row.outfit}/${row.action}: palm travels only ${horizontal.toFixed(3)}m across the animated chest`);
    assert.ok(vertical>.10,`${row.outfit}/${row.action}: palm has only ${vertical.toFixed(3)}m of diagonal travel`);
    assert.ok(angle>55,`${row.outfit}/${row.action}: blade sweep is only ${angle.toFixed(1)}deg`);
    const first=new THREE.Vector3(...row.samples[0].chestSocket),last=new THREE.Vector3(...row.samples.at(-1).chestSocket);
    assert.ok(first.distanceTo(last)<.04,'stroke recovers to its starting grip without changing the resting pose');
    spans.push(`${row.outfit}/${row.action} ${(horizontal*100).toFixed(1)}cm x ${(vertical*100).toFixed(1)}cm, ${angle.toFixed(1)}deg`);
  }
  t.diagnostic(spans.join('; ')+'. Geometry metrics do not replace fresh rendered motion acceptance.');
});

test('Actual portrait projection exposes the knife hand stroke rather than hiding travel in camera depth',t=>{
  const direction=new THREE.Vector3(-.38,.035,1).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  for(const row of report.matrix.filter(row=>row.key==='knife'&&['slash','combo'].includes(row.action))){
    const sockets=row.samples.map(sample=>new THREE.Vector3(...sample.pose.socket));
    const span=axis=>Math.max(...sockets.map(p=>p.dot(axis)))-Math.min(...sockets.map(p=>p.dot(axis)));
    t.diagnostic(`${row.outfit}/${row.action}: portrait-plane palm stroke ${(span(right)*100).toFixed(1)}cm x ${(span(up)*100).toFixed(1)}cm`);
    assert.ok(span(right)>.30,`${row.outfit}/${row.action}: authored body turn hides the lateral attack behind the camera axis`);
    assert.ok(span(up)>.10,`${row.outfit}/${row.action}: projected palm lacks a visible vertical cut`);
  }
});

test('Knife attack silhouette raises the elbow and shoulder-height blade then cuts across the portrait plane',()=>{
  const direction=new THREE.Vector3(-.38,.035,1).normalize();
  for(const row of report.matrix.filter(row=>row.key==='knife'&&['slash','combo'].includes(row.action))){
    const windup=row.samples.find(sample=>sample.phase===.25),cut=row.samples.find(sample=>sample.phase===.5);
    assert.ok(windup.pose.socket[1]>windup.rightShoulder[1]-.015,`${row.outfit}/${row.action}: blade hand remains below shoulder height`);
    assert.ok(windup.rightElbow[1]>windup.rightShoulder[1]-.12,`${row.outfit}/${row.action}: windup elbow is still lowered beside the chest`);
    const cutAxis=new THREE.Vector3(...cut.axis),visibleAxis=Math.sqrt(Math.max(0,1-cutAxis.dot(direction)**2));
    assert.ok(visibleAxis>.8,`${row.outfit}/${row.action}: blade points into the camera instead of making a visible cutting stroke`);
    assert.ok(cut.bladeFaceCameraAlignment>.6,`${row.outfit}/${row.action}: visible cutting blade is edge-on`);
  }
});
test('Long-gun support target reaches the actual left finger cavity, not just the wrist socket',()=>{
  const broken=samples.filter(s=>s.pose.profile==='longgun'&&['idle','guard','walk'].includes(s.action)&&(s.leftCavityToSupportM>.04||s.leftPalmToBoundsM>.04));
  assert.equal(broken.length,0,broken.slice(0,6).map(s=>`${describe(s)} cavity target gap=${(s.leftCavityToSupportM*1000).toFixed(1)}mm, weapon bounds gap=${(s.leftPalmToBoundsM*1000).toFixed(1)}mm`).join('; '));
});

test('Idle and guard hands avoid extreme wrist flexion relative to their actual metacarpals',()=>{
  const broken=samples.filter(s=>['idle','guard'].includes(s.action)&&(s.wristRightDegrees>65||(s.pose.profile==='longgun'&&s.wristLeftDegrees>65)));
  assert.equal(broken.length,0,broken.slice(0,8).map(s=>describe(s)+' R'+s.wristRightDegrees.toFixed(1)+'deg L'+s.wristLeftDegrees.toFixed(1)+'deg').join('; '));
});
test('Strikes and reactions never fold an equipped hand backwards beyond a right angle',()=>{
  const broken=samples.filter(s=>s.wristRightDegrees>90||(s.pose.profile==='longgun'&&s.wristLeftDegrees>90));
  assert.equal(broken.length,0,broken.slice(0,8).map(s=>describe(s)+' R'+s.wristRightDegrees.toFixed(1)+'deg L'+s.wristLeftDegrees.toFixed(1)+'deg').join('; '));
});
test('Actual clip crossfades and 60Hz smoothing retain reachable grips through guard, attack and locomotion',async()=>{
  const broken=[];
  for(const file of ['Casual_Hoodie','Suit','Swat'])for(const key of ['bat','knife','revolver','ak']){
    const asset=await glb('assets/character/quaternius/'+file+'.glb'),model=asset.scene;
    const clips=Object.fromEntries(asset.animations.map(c=>[c.name,c])),mixer=new THREE.AnimationMixer(model);
    mixer.clipAction(clips.Idle).play();mixer.update(.01);model.updateMatrixWorld(true);
    const grip=prepareCharacterGrip(THREE,model,clips),rig=poseModule.prepareWeaponPose(THREE,model,grip),descriptor=resolveWeaponAsset(key,catalog);
    const held=attachHeldWeapon(THREE,grip,models.get(descriptor.id).clone(true),[0,0,0],descriptor.axis,descriptor.forward);
    held.userData.zoneSupportPoint=supportPoints[catalog[key]?.fam]||[.24,.06,0];
    const ctx=vm.createContext({THREE,state:{weapon:key},WCAT:catalog,weaponPoseProfile:poseModule.weaponPoseProfile,CLIP:runtimeClipMap,find:list=>list.map(n=>clips[n]).find(Boolean),mixer,current:null,paintBar(){}});
    vm.runInContext(playSource,ctx);let elapsed=0;
    for(const action of ['idle','guard','slash','idle','walk']){
      ctx.play(action);for(let frame=0;frame<30;frame++){
        const dt=1/60;elapsed+=dt;mixer.update(dt);applyCharacterGrip(grip);
        const result=poseModule.applyWeaponPose(rig,held,{profile:poseModule.weaponPoseProfile(key,catalog),action,phase:ctx.current.time/ctx.current.getClip().duration,elapsed,dt});
        if(result.rightError>.005||(result.leftError||0)>.005)broken.push(`${file}/${key}/${action} frame${frame}: R${(result.rightError*1000).toFixed(1)}mm L${((result.leftError||0)*1000).toFixed(1)}mm`);
      }
    }
  }
  assert.equal(broken.length,0,broken.slice(0,12).join('; '));
});

test('Complete 60Hz knife strokes remain readable after smoothing with locked handles, authored fingers and untouched lower body',async t=>{
  const measurements=[];
  for(const file of ['Casual_Hoodie','Suit','Swat'])for(const action of ['slash','combo']){
    const asset=await glb('assets/character/quaternius/'+file+'.glb'),model=asset.scene;
    const clips=Object.fromEntries(asset.animations.map(c=>[c.name,c])),mixer=new THREE.AnimationMixer(model);
    mixer.clipAction(clips.Idle).play();mixer.update(.01);model.updateMatrixWorld(true);
    const grip=prepareCharacterGrip(THREE,model,clips),rig=poseModule.prepareWeaponPose(THREE,model,grip),descriptor=resolveWeaponAsset('knife',catalog);
    const held=attachHeldWeapon(THREE,grip,models.get(descriptor.id).clone(true),[0,0,0],descriptor.axis,descriptor.forward);
    const ctx=vm.createContext({THREE,state:{weapon:'knife'},WCAT:catalog,weaponPoseProfile:poseModule.weaponPoseProfile,CLIP:runtimeClipMap,find:list=>list.map(n=>clips[n]).find(Boolean),mixer,current:null,paintBar(){}});
    vm.runInContext(playSource,ctx);let elapsed=0;
    const sample=(name)=>{
      const dt=1/60;elapsed+=dt;mixer.update(dt);applyCharacterGrip(grip);model.updateMatrixWorld(true);
      const untouched=[];model.traverse(bone=>{if(bone.isBone&&!['UpperArmR','LowerArmR','WristR'].includes(bone.name.replace(/[._-]/g,'')))untouched.push([bone,bone.quaternion.toArray()]);});
      const pose=poseModule.applyWeaponPose(rig,held,{profile:'knife',action:name,phase:ctx.current.time/ctx.current.getClip().duration,elapsed,dt});
      for(const [bone,quaternion]of untouched)assert.deepEqual(bone.quaternion.toArray(),quaternion,`${file}/${action} must preserve ${bone.name}`);
      assert.ok(pose.rightError<.005,`${file}/${action} exceeds anatomical arm reach`);
      const wrist=rig.right.hand.getWorldPosition(new THREE.Vector3()),forearm=wrist.clone().sub(rig.right.lower.getWorldPosition(new THREE.Vector3())),palm=rig.bones.get('middle2r').getWorldPosition(new THREE.Vector3()).sub(wrist);
      assert.ok(THREE.MathUtils.radToDeg(forearm.angleTo(palm))<=90,`${file}/${action} folds the wrist beyond its existing anatomical limit`);
      return held.getWorldPosition(new THREE.Vector3()).sub(rig.chest.getWorldPosition(new THREE.Vector3())).applyQuaternion(rig.chest.getWorldQuaternion(new THREE.Quaternion()).multiply(rig.chestReference).invert());
    };
    ctx.play('guard');for(let frame=0;frame<18;frame++)sample('guard');
    const localSocket=held.position.toArray(),localRotation=held.quaternion.toArray(),gripCenter=grip.center.toArray();
    ctx.play(action,{loop:false});const positions=[];
    for(let frame=0;frame<=Math.ceil(ctx.current.getClip().duration*60);frame++){
      positions.push(sample(action));
      assert.deepEqual(held.position.toArray(),localSocket,'handle must remain at the same palm socket');
      assert.deepEqual(held.quaternion.toArray(),localRotation,'attack changes the hand pose, not attachment calibration');
      assert.deepEqual(grip.center.toArray(),gripCenter);
    }
    const span=axis=>Math.max(...positions.map(p=>p[axis]))-Math.min(...positions.map(p=>p[axis]));
    assert.ok(span('x')>.30,`${file}/${action} smoothing obscures the horizontal stroke: ${span('x').toFixed(3)}m`);
    assert.ok(span('y')>.10,`${file}/${action} smoothing obscures the diagonal cut: ${span('y').toFixed(3)}m`);
    measurements.push(`${file}/${action} ${positions.length} frames, ${(span('x')*100).toFixed(1)}cm x ${(span('y')*100).toFixed(1)}cm`);
  }
  t.diagnostic(measurements.join('; ')+'. Actual rendered motion still requires independent review.');
});

test('The actual viewer tick advances a one-shot knife phase and publishes fresh diagnostic samples before returning idle',async()=>{
  const asset=await glb('assets/character/quaternius/Suit.glb'),model=asset.scene;
  const clips=Object.fromEntries(asset.animations.map(c=>[c.name,c])),mixer=new THREE.AnimationMixer(model);
  mixer.clipAction(clips.Idle).play();mixer.update(.01);model.updateMatrixWorld(true);
  const grip=prepareCharacterGrip(THREE,model,clips),rig=poseModule.prepareWeaponPose(THREE,model,grip),descriptor=resolveWeaponAsset('knife',catalog);
  const held=attachHeldWeapon(THREE,grip,models.get(descriptor.id).clone(true),[0,0,0],descriptor.axis,descriptor.forward);
  const tickSource=viewer.slice(viewer.indexOf('function tick('),viewer.indexOf('function createRenderGate'));
  const paintBarSource=viewer.match(/function paintBar\(k\) \{[^\n]+/)[0];
  const dataset={zoneRendering:'active'};
  const ctx=vm.createContext({THREE,state:{weapon:'knife'},WCAT:catalog,weaponPoseProfile:poseModule.weaponPoseProfile,applyWeaponPose:poseModule.applyWeaponPose,applyCharacterGrip,characterGrip:grip,weaponPoseRig:rig,weaponMesh:held,CLIP:runtimeClipMap,find:list=>list.map(n=>clips[n]).find(Boolean),mixer,current:null,lastAct:'idle',lastFrame:0,frame:null,lastMetrics:0,lastPoseMetrics:0,document:{body:{dataset},querySelectorAll:()=>[]},paintCompact(){},controls:{update(){}},renderer:{render(){},getPixelRatio:()=>1,info:{render:{calls:19,triangles:8492},memory:{geometries:19,textures:17}}},scene:model,camera:{},requestAnimationFrame:()=>1});
  vm.runInContext(playSource+'\n'+paintBarSource+'\n'+tickSource,ctx);
  let now=0;ctx.play('guard');for(let frame=0;frame<18;frame++){now+=1000/60;ctx.tick(now);}
  ctx.play('slash',{loop:false,then:'idle'});
  const measured=[];let lastSample=-1;
  for(let frame=0;frame<90;frame++){
    now+=1000/60;ctx.tick(now);
    const sample=JSON.parse(dataset.zoneWeaponPose);
    if(sample.sampledAt!==lastSample){measured.push(sample);lastSample=sample.sampledAt;}
  }
  const slash=measured.filter(sample=>sample.action==='slash');
  assert.ok(slash.length>=8,'100ms sampler must expose multiple actual phases instead of aliased one-second poses');
  assert.ok(slash.some(sample=>sample.phase<.2)&&slash.some(sample=>sample.phase>.8),'actual current clip traverses anticipation, cut and recovery');
  for(let i=1;i<slash.length;i++){
    assert.ok(slash[i].clipTime>slash[i-1].clipTime,'mixer time must advance during the one-shot action');
    assert.ok(slash[i].sampledAt-slash[i-1].sampledAt<=120,'native sampling receives current poses throughout the stroke');
  }
  assert.ok(slash.every(sample=>sample.clipDuration>0&&!sample.clipPaused&&sample.rendering==='active'));
  assert.ok(measured.some(sample=>sample.action==='idle'&&sample.sampledAt>slash.at(-1).sampledAt),'real mixer finished event returns the viewer to idle');
});

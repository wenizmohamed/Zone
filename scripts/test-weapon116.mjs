import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { OBJLoader } from '../lib/three184/OBJLoader.js';
import { MTLLoader } from '../lib/three184/MTLLoader.js';
import { geometryGlb, sideSurfaces } from '../assets/weapons/source-tools/geometry-audit.mjs';
import { resolveWeaponAsset, normalizeWeaponAsset, inspectWeaponObject, createWeaponAssetLoader,
  weaponThumbnail, WEAPON_PRESENTATION_UPGRADES116, WEAPON_UPGRADE_SOURCES116 } from '../dist/weapon-assets.js';
import { computeWeaponFrame } from '../dist/weapon-presentation.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';

const root=new URL('../',import.meta.url), base=new URL('assets/weapons/',root);
const read=path=>readFileSync(new URL(path,root));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('assets/weapons/upgrades116/manifest.json'));
const record=manifest.assets[0], historical=JSON.parse(read(manifest.historicalReceipt));
const context=vm.createContext({});
vm.runInContext(read('assets/weapons/catalog.js').toString(),context);
vm.runInContext(read('assets/weapons/pack.js').toString(),context);
const catalog=context.ZONE_WEAPONS;
const expected={assaultrifle_1:'m4-detail116',assaultrifle_3:'m4-detail116',assaultrifle_5:'m4-detail116'};

// Decode every real embedded PNG pixel. Only browser image decoding is
// replaced; real GLTF geometry/material/sampler/hierarchy parsing runs below.
function png(bytes) {
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert.equal(bytes[28],0);
  const channels=({2:3,6:4})[bytes[25]];assert.ok(channels);
  const chunks=[];
  for(let offset=8;offset<bytes.length;){const size=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12;}
  const packed=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const index=y*stride+x,a=x>=channels?pixels[index-channels]:0,b=y?pixels[index-stride]:0,c=y&&x>=channels?pixels[index-stride-channels]:0;
    const filter=packed[y*(stride+1)];assert.ok(filter<=4);
    pixels[index]=(packed[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
  }
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<width*height;i++)data.set([pixels[i*channels],pixels[i*channels+1],pixels[i*channels+2],channels===4?pixels[i*channels+3]:255],i*4);
  return {width,height,data};
}

function glb(path) {
  const bytes=read(path),length=bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.toString('utf8',20,20+length)),bin=bytes.subarray(28+length);
  const images=json.images.map(image=>{
    assert.equal(image.mimeType,'image/png');assert.equal(image.uri,undefined);
    const view=json.bufferViews[image.bufferView],start=view.byteOffset||0;
    assert.ok(start+view.byteLength<=bin.length);
    return {...png(bin.subarray(start,start+view.byteLength)),name:image.name};
  });
  return {bytes,json,images};
}

async function fullAsset() {
  const data=glb(record.path),loader=new GLTFLoader();
  loader.register(parser=>({name:'ZONE116_REAL_PNG_PIXELS',loadTexture(index){
    const spec=parser.json.textures[index],decoded=data.images[spec.source];
    const texture=new THREE.DataTexture(decoded.data,decoded.width,decoded.height,THREE.RGBAFormat);
    texture.flipY=false;texture.name=decoded.name;
    const sampler=parser.json.samplers?.[spec.sampler]||{};
    texture.wrapS=sampler.wrapS||THREE.RepeatWrapping;texture.wrapT=sampler.wrapT||THREE.RepeatWrapping;texture.needsUpdate=true;
    return Promise.resolve(texture);
  }}));
  return {...await loader.parseAsync(data.bytes.buffer.slice(data.bytes.byteOffset,data.bytes.byteOffset+data.bytes.byteLength),''),receipt:data};
}

test('only the three existing M4 aliases advance to116 and every historical identity remains available',()=>{
  assert.deepEqual(WEAPON_PRESENTATION_UPGRADES116,expected);assert.deepEqual(manifest.bindings,expected);
  assert.deepEqual(Object.keys(WEAPON_UPGRADE_SOURCES116),['m4-detail116']);
  for(const old of historical.records){
    const current=resolveWeaponAsset(old.key,catalog),v112=resolveWeaponAsset(old.key,catalog,{revision:112});
    assert.equal(current.requestedKey,old.key);assert.equal(current.category,v112.category);
    assert.equal(resolveWeaponAsset(old.key,catalog,{revision:99}).id,old.sourceId);
    if(expected[old.key]){
      assert.equal(current.id,expected[old.key]);assert.equal(current.originalSourceId,old.sourceId);
      assert.equal(current.revision,116);assert.equal(current.url,'upgrades116/m4-detail116.glb');
      assert.deepEqual(current.grip,[0,0,0]);assert.deepEqual(current.rotation,[0,0,0]);assert.equal(current.scale,1);
      assert.equal(current.category,'assault-rifle');assert.equal(current.quality,'adapted-pbr');
      assert.equal(current.browserCaptureStatus,'pending-review');
      assert.equal(current.thumbnailCapture,'offline-Blender-Cycles-exported-GLB');
      assert.equal(current.thumbnail,record.thumbnail);assert.equal(v112.id,old.sourceId);
    }else assert.deepEqual(current,v112,old.key+' changed outside the3-key scope');
    assert.equal(context.zoneWeaponThumbnail(old.key),weaponThumbnail(old.key));
    assert.equal(context.zoneWeaponThumbnail('authored-item',old.key),weaponThumbnail(old.key));
  }
  for(const key of ['unknown','__proto__','constructor','../private'])assert.equal(resolveWeaponAsset(key,catalog),null);
});

test('all51 original GLBs and thumbnails and every111/112 derivative retain their exact accepted bytes',()=>{
  assert.equal(historical.records.length,51);assert.equal(digest(read(manifest.historicalReceipt)),manifest.historicalReceiptSha256);
  for(const old of historical.records){
    assert.equal(digest(read(old.modelPath)),old.sourceSha256,old.modelPath);
    assert.equal(digest(read(old.thumbnail.slice(1))),old.thumbnailSha256,old.thumbnail);
  }
  for(const revision of [111,112])for(const asset of JSON.parse(read('assets/weapons/upgrades'+revision+'/manifest.json')).assets){
    assert.equal(digest(read(asset.path)),asset.sha256);assert.equal(digest(read(asset.thumbnail.slice(1))),asset.thumbnailSha256);
  }
  assert.equal(digest(read(manifest.source.path)),manifest.source.sha256);assert.equal(read(manifest.source.path).length,manifest.source.bytes);
  assert.match(read('assets/weapons/upgrades116/LICENSE.txt').toString(),/CC0 1.0 Universal/);
  assert.equal(manifest.source.author,'3DModelsCC0');assert.equal(manifest.source.license,'CC0-1.0');
  assert.match(manifest.source.licenseEvidence,/Primary author page/);
  assert.equal(digest(read(manifest.authoring.recipe)),manifest.authoring.recipeSha256);
  assert.equal(digest(read(manifest.authoring.template)),manifest.authoring.templateSha256);
  assert.match(manifest.authoring.invocation,/--disable-autoexec/);
  for(const name of readdirSync(new URL('assets/weapons/upgrades116/',root)))assert.match(name,/\.(glb|png|json|txt|md)$/);
});

test('real exported GLB has independent authored geometry, complete physical maps and bounded mobile resources',async t=>{
  const loaded=await fullAsset(),{bytes,json,images}=loaded.receipt;
  assert.equal(digest(bytes),record.sha256);assert.equal(bytes.length,record.bytes);assert.ok(bytes.length<3*1048576);
  const primitives=json.meshes.flatMap(mesh=>mesh.primitives),triangles=primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
  assert.equal(record.sourceTriangles,9236);assert.equal(record.chamferedSourceTriangles,record.sourceTriangles);
  assert.equal(triangles,record.sourceTriangles+record.addedDetailTriangles);assert.ok(record.addedDetailTriangles>20000);
  assert.equal(triangles,record.triangles);assert.ok(triangles<=record.triangleBudget);
  assert.equal(primitives.length,record.primitives);assert.ok(primitives.length<=record.primitiveBudget);
  assert.equal(images.length,12);assert.ok(images.every(i=>i.width<=512&&i.height<=512));
  const memory=images.reduce((n,i)=>n+i.width*i.height*4*4/3,0);assert.ok(memory<=record.textureBudgetBytes);
  for(const p of primitives)for(const semantic of ['POSITION','NORMAL','TEXCOORD_0'])assert.ok(json.accessors[p.attributes[semantic]].count>0);
  loaded.scene.traverse(o=>{if(o.isMesh)for(const semantic of ['position','normal','uv'])for(const value of o.geometry.attributes[semantic].array)assert.ok(Number.isFinite(value));});
  const info=inspectWeaponObject(THREE,loaded.scene);assert.equal(info.triangles,record.triangles);assert.equal(info.meshes,record.primitives);assert.equal(info.textureCount,12);
  const mapped=info.materials.filter(m=>m.maps.includes('map')&&m.maps.includes('normalMap')&&m.maps.includes('roughnessMap')&&m.maps.includes('metalnessMap'));assert.equal(mapped.length,4);
  const metal=images.find(i=>i.name.includes('receiver_orm')),polymer=images.find(i=>i.name.includes('rail_cover_orm')),rubber=images.find(i=>i.name.includes('buttpad_orm'));
  assert.ok(metal&&polymer&&rubber);
  for(let i=0;i<metal.data.length;i+=4){assert.ok(metal.data[i+2]>=200);assert.ok(polymer.data[i+2]<10);assert.equal(rubber.data[i+2],0);assert.ok(rubber.data[i+1]>metal.data[i+1]);}
  t.diagnostic(`${triangles} triangles, ${record.addedDetailTriangles} added beyond unchanged source; ${primitives.length} primitives; ${(memory/1048576).toFixed(2)} MiB mipmapped textures`);
});

test('actual exported surfaces retain grip and physical dimensions and fit every inventory aspect and wardrobe socket',async()=>{
  const descriptor=resolveWeaponAsset('assaultrifle_1',catalog),sourceDescriptor=resolveWeaponAsset('assaultrifle_1',catalog,{revision:112});
  const current=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL(record.path,root)))).scene,descriptor);
  const old=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL(manifest.source.path,root)))).scene,sourceDescriptor);
  const box=new THREE.Box3().setFromObject(current),beforeBox=new THREE.Box3().setFromObject(old);
  assert.ok(box.getSize(new THREE.Vector3()).distanceTo(beforeBox.getSize(new THREE.Vector3()))<.00001,'original outer envelope changed');
  const before=sideSurfaces(old,0,0),after=sideSurfaces(current,0,0);
  assert.ok(before.every(Boolean)&&after.every(Boolean));
  for(const side of [0,1])assert.ok(Math.abs(after[side].z-before[side].z)<.000001,'measured handle moved');
  for(const aspect of [1.9,388/330,320/200,384/280]){
    const frame=computeWeaponFrame(THREE,box,aspect),camera=new THREE.PerspectiveCamera(38,aspect,frame.near,frame.far);
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const point=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1);
    }
  }
  for(const wardrobe of ['Suit','Casual_Hoodie','Swat']){
    const c=await geometryGlb(fileURLToPath(new URL('assets/character/quaternius/'+wardrobe+'.glb',root)));
    const rig=prepareCharacterGrip(THREE,c.scene,Object.fromEntries(c.animations.map(clip=>[clip.name,clip])));
    const instance=current.clone(true),hold=attachHeldWeapon(THREE,rig,instance,[0,0,0],descriptor.axis,descriptor.forward);
    applyCharacterGrip(rig);c.scene.updateMatrixWorld(true);
    const origin=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3()));assert.ok(origin.distanceTo(rig.center)<1e-5);
    const barrel=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3(1,0,0))).sub(origin).normalize();
    assert.ok(barrel.dot(new THREE.Vector3(0,1,0).projectOnPlane(rig.axis).normalize())>.99999);hold.removeFromParent();
  }
});

test('all9236 actual normalized source triangles and original UV corners survive the exported derivative',async()=>{
  const descriptor=resolveWeaponAsset('assaultrifle_1',catalog),oldDescriptor=resolveWeaponAsset('assaultrifle_1',catalog,{revision:112});
  const current=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL(record.path,root)))).scene,descriptor);
  const old=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL(manifest.source.path,root)))).scene,oldDescriptor);
  function triangles(object){
    const result=[];object.updateMatrixWorld(true);
    object.traverse(mesh=>{if(!mesh.isMesh)return;const geo=mesh.geometry,position=geo.attributes.position,uv=geo.attributes.uv,index=geo.index;
      for(let i=0;i<(index?.count||position.count);i+=3){
        const points=[];
        for(let c=0;c<3;c++){const id=index?index.getX(i+c):i+c,p=new THREE.Vector3().fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld);points.push([...p.toArray(),uv.getX(id),uv.getY(id)]);}
        points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]||a[3]-b[3]||a[4]-b[4]);result.push(points.flat());
      }
    });return result.sort((a,b)=>a[0]-b[0]);
  }
  const before=triangles(old),after=triangles(current);assert.equal(before.length,9236);assert.equal(after.length,record.triangles);
  const epsilon=.000002;
  const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const sameTriangle=(a,b)=>permutations.some(order=>order.every((target,corner)=>[0,1,2,3,4].every(component=>Math.abs(a[corner*5+component]-b[target*5+component])<epsilon)));
  for(const triangle of before){
    let lo=0,hi=after.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(after[mid][0]<triangle[0]-epsilon)lo=mid+1;else hi=mid;}
    let retained=false;
    for(let i=lo;i<after.length&&after[i][0]<=triangle[0]+epsilon;i++)if(sameTriangle(triangle,after[i])){retained=true;break;}
    assert.ok(retained,'source triangle or UV corner was replaced rather than retained');
  }
});

test('three aliases share one real-source load but own independent clone resources and dispose safely',async()=>{
  let calls=0;const loaded=await fullAsset();
  const loader=createWeaponAssetLoader({THREE,catalog,baseURL:base.href,GLTFLoader:class{async loadAsync(url){calls++;assert.equal(url,new URL('upgrades116/m4-detail116.glb',base).href);return loaded;}}});
  const copies=await Promise.all(Object.keys(expected).map(key=>loader.load(key)));assert.equal(calls,1);
  const meshes=copies.map(root=>{let found;root.traverse(o=>{if(o.isMesh&&!found)found=o;});return found;});
  assert.notEqual(meshes[0].geometry,meshes[1].geometry);assert.notEqual(meshes[0].material,meshes[1].material);assert.notEqual(meshes[0].material.map,meshes[1].material.map);
  let geometryDisposals=0;meshes[0].geometry.addEventListener('dispose',()=>geometryDisposals++);
  for(const [i,copy]of copies.entries()){assert.equal(copy.userData.zoneWeaponAsset.requestedKey,Object.keys(expected)[i]);loader.release(copy);loader.release(copy);}
  assert.equal(geometryDisposals,1);await loader.dispose();await loader.dispose();await assert.rejects(loader.load('assaultrifle_1'),/disposed/);
});

test('failed detailed GLB uses the retained real catalog fallback with honest identity, no wrong thumbnail and a retryable source',async()=>{
  let attempts=0;
  // Pack globals are read from the actual retained classic source, not a
  // synthetic fallback mesh. The OBJ/MTL parser below runs the real data.
  const actualPack={};for(const entry of Object.values(catalog))for(const ext of ['obj','mtl']){const path='assets/weapons/'+entry.file+'.'+ext;if(!actualPack[entry.file+'.'+ext])actualPack[entry.file+'.'+ext]=read(path).toString();}
  const real=createWeaponAssetLoader({THREE,catalog,materials:context.ZONE_WEAPON_MATS,pack:actualPack,baseURL:base.href,OBJLoader,MTLLoader,
    GLTFLoader:class{async loadAsync(){attempts++;throw new Error('deliberate116 transport failure');}}});
  for(const key of ['assaultrifle_1','assaultrifle_1']){
    const fallback=await real.load(key),shown=fallback.userData.zoneWeaponAsset;
    assert.equal(shown.id,catalog[key].file);assert.equal(shown.quality,'catalog-stylized');assert.equal(shown.fallbackFor,'m4-detail116');assert.equal(shown.thumbnail,null);
    assert.ok(inspectWeaponObject(THREE,fallback).triangles>100);real.release(fallback);
  }
  assert.equal(attempts,2);await real.dispose();
});

test('shipped transparent thumbnail is nonblank, not clipped and fingerprinted to this exported-GLB receipt',()=>{
  const bytes=read(record.thumbnail.slice(1)),image=png(bytes);assert.equal(digest(bytes),record.thumbnailSha256);assert.equal(bytes.length,record.thumbnailBytes);
  assert.deepEqual([image.width,image.height],[384,280]);
  let minX=384,maxX=0,minY=280,maxY=0,count=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}
  assert.ok(count>3000&&maxX-minX>250);assert.ok(minX>5&&maxX<image.width-5&&minY>5&&maxY<image.height-5);
  assert.equal(manifest.browserCaptureStatus,'pending-review');assert.match(manifest.authoring.renderer,/Not a browser capture/);
  assert.equal(manifest.offlineEvidence.full.identicalCamera,true);assert.equal(manifest.offlineEvidence.thumbnail.identicalCamera,true);
  assert.deepEqual(manifest.offlineEvidence.full.camera.resolution,[1100,620]);
  assert.deepEqual(manifest.offlineEvidence.thumbnail.camera.resolution,[384,280]);
  assert.equal(manifest.offlineEvidence.full.camera.transparent,false);assert.equal(manifest.offlineEvidence.thumbnail.camera.transparent,true);
  assert.equal(manifest.offlineEvidence.thumbnail.afterSha256,record.thumbnailSha256);
  assert.ok(manifest.offlineEvidence.full.camera.cameraMatrix.flat().every(Number.isFinite));
});

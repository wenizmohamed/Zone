import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { geometryGlb, sideSurfaces } from '../assets/weapons/source-tools/geometry-audit.mjs';
import { resolveWeaponAsset, normalizeWeaponAsset, inspectWeaponObject, createWeaponAssetLoader,
  WEAPON_PRESENTATION_UPGRADES111, WEAPON_UPGRADE_SOURCES111, weaponPresentationLabel, weaponThumbnail } from '../dist/weapon-assets.js';
import { computeWeaponFrame, weaponStudioProfile } from '../dist/weapon-presentation.js';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from '../dist/character-grip.js';

const root = new URL('../', import.meta.url), assets = new URL('assets/weapons/', root);
const read = path => readFileSync(new URL(path, root));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('assets/weapons/upgrades111/manifest.json'));
const historical = JSON.parse(read('assets/weapons/runtime-coverage.json'));
const context = vm.createContext({});
vm.runInContext(read('assets/weapons/catalog.js').toString('utf8'), context);
const catalog = context.ZONE_WEAPONS;
const expected = { assaultrifle_2:'g3a3-detail111', assaultrifle_4:'g3a3-detail111',
  bullpup_1:'l85-detail111', bullpup_2:'l85-detail111', bullpup_3:'l85-detail111',
  pistol_2:'glock18-detail111', pistol_6:'glock18-detail111' };

// Decode real embedded PNG pixels without a browser or mock image bitmap. The
// texture hook below only replaces browser image decoding, not GLTF geometry,
// material, sampler, scene or normalization logic.
function png(bytes) {
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24],8); assert.equal(bytes[28],0,'interlaced PNG not expected');
  const channels = ({2:3,6:4})[bytes[25]];
  assert.ok(channels,'expected RGB/RGBA PNG');
  const chunks=[];
  for(let offset=8;offset<bytes.length;) {
    const length=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
    if(type==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+length));
    offset+=length+12;
  }
  const packed=inflateSync(Buffer.concat(chunks)), stride=width*channels, pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++) {
    const filter=packed[y*(stride+1)]; assert.ok(filter<=4);
    for(let x=0;x<stride;x++) {
      const index=y*stride+x, a=x>=channels?pixels[index-channels]:0, b=y?pixels[index-stride]:0, c=y&&x>=channels?pixels[index-stride-channels]:0;
      const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[index]=(packed[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  const rgba = new Uint8Array(width*height*4);
  for(let i=0;i<width*height;i++)rgba.set([pixels[i*channels],pixels[i*channels+1],pixels[i*channels+2],channels===4?pixels[i*channels+3]:255],i*4);
  return {width,height,data:rgba};
}

function glb(path) {
  const bytes=read(path), length=bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.toString('utf8',20,20+length)), bin=bytes.subarray(28+length);
  const images=(json.images||[]).map(image=>{
    assert.equal(image.mimeType,'image/png');assert.equal(image.uri,undefined,'no remote texture fetches');
    const view=json.bufferViews[image.bufferView];
    return {...png(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)),name:image.name};
  });
  return {bytes,json,images};
}

async function fullAsset(path) {
  const data=glb(path), loader=new GLTFLoader();
  loader.register(parser=>({name:'ZONE111_CPU_PNG_DECODER',loadTexture(index){
    const definition=parser.json.textures[index], decoded=data.images[definition.source];
    const texture=new THREE.DataTexture(decoded.data,decoded.width,decoded.height,THREE.RGBAFormat);
    texture.flipY=false;texture.name=decoded.name;
    const sampler=parser.json.samplers?.[definition.sampler]||{};
    texture.wrapS=sampler.wrapS||THREE.RepeatWrapping;texture.wrapT=sampler.wrapT||THREE.RepeatWrapping;
    texture.needsUpdate=true;
    return Promise.resolve(texture);
  }}));
  const buffer=data.bytes.buffer.slice(data.bytes.byteOffset,data.bytes.byteOffset+data.bytes.byteLength);
  return {...await loader.parseAsync(buffer,''),receipt:data};
}

const stats=image=>{
  const mean=[0,0,0],min=[255,255,255],max=[0,0,0];
  for(let i=0;i<image.data.length;i+=4)for(let c=0;c<3;c++){const v=image.data[i+c];mean[c]+=v;min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);}
  return {mean:mean.map(v=>v/(image.width*image.height)),min,max};
};

test('exact seven-key overlay preserves gameplay categories and leaves all other identities unchanged',()=>{
  assert.deepEqual(WEAPON_PRESENTATION_UPGRADES111,expected);assert.deepEqual(manifest.bindings,expected);
  for(const record of historical.records) {
    const current=resolveWeaponAsset(record.key,catalog,{revision:111}), old=resolveWeaponAsset(record.key,catalog,{revision:99});
    assert.equal(old.id,record.sourceId);assert.equal(old.thumbnail,record.thumbnail);
    assert.equal(current.category,record.category);assert.equal(current.requestedKey,record.key);
    if(expected[record.key]) {
      assert.equal(current.id,expected[record.key]);assert.equal(current.originalSourceId,record.sourceId);
      assert.equal(current.revision,111);assert.equal(current.quality,'adapted-pbr');
      assert.equal(current.thumbnail,weaponThumbnail(record.key));
      assert.equal(current.thumbnailCapture,'offline-Blender-Cycles');
      assert.equal(current.browserCaptureStatus,'pending-review');
    } else assert.deepEqual(current,old,record.key+' changed outside scope');
  }
  assert.equal(resolveWeaponAsset('pistol_2',catalog).author,'locarem / ZONE derivative');
  assert.match(resolveWeaponAsset('pistol_2',catalog).identityNote,/not an M1911/);
  for(const key of ['__proto__','constructor','../glock18','unknown'])assert.equal(resolveWeaponAsset(key,catalog),null);
});

test('twenty original assets and v99 viewer receipts stay byte-identical; new evidence is honestly offline',()=>{
  assert.equal(digest(read(manifest.historicalReceipt)),manifest.historicalReceiptSha256);
  assert.deepEqual(manifest.historicalReceiptSource,{
    revision:'ad002532028975d687d956c7a745be303ddd1852',
    blob:'c51b0d48f3f92509a55f023f295c4de7c882d0dc',bytes:243675,
    sha256:'5d45a303e52ed7a018d07225cde49bbd60e8274eab6a5264c97fcb75c6271644'
  });
  assert.equal(read(manifest.historicalReceipt).length,manifest.historicalReceiptSource.bytes);
  assert.equal(manifest.historicalReceiptSha256,manifest.historicalReceiptSource.sha256);
  assert.equal(manifest.immutableOriginals.length,20);
  for(const record of manifest.immutableOriginals){const bytes=read(record.path);assert.equal(digest(bytes),record.sha256);assert.equal(bytes.length,record.bytes);}
  assert.equal(manifest.thumbnailCapture,'offline-Blender-Cycles-PNG');assert.equal(manifest.browserCaptureStatus,'pending-review');
  assert.match(read('assets/weapons/upgrades111/LICENSE.txt').toString(),/CC0 1.0 Universal/);
  assert.deepEqual(manifest.sources.map(source=>source.license),['CC0-1.0','CC0-1.0']);
  assert.match(manifest.sources[0].licenseNote,/2023-12-15/);assert.match(manifest.sources[1].licenseNote,/no original textures/);
  assert.equal(digest(read(manifest.sourceTool)),manifest.sourceToolSha256);
  for(const name of readdirSync(new URL('assets/weapons/upgrades111/',root)))assert.match(name,/\.(glb|png|json|txt|md)$/,'raw/helper file entered public assets');
});

for(const record of manifest.assets) {
  test(record.id+' has real added triangles, merged draw primitives and embedded nonuniform physical maps',async t=>{
    const asset=await fullAsset(record.path), {bytes,json,images}=asset.receipt;
    assert.equal(digest(bytes),record.sha256);assert.equal(bytes.length,record.bytes);
    const triangles=json.meshes.flatMap(mesh=>mesh.primitives).reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
    const primitives=json.meshes.reduce((n,mesh)=>n+mesh.primitives.length,0);
    assert.equal(triangles,record.triangles);assert.ok(triangles>=record.previousRuntimeTriangles*8 && triangles<=60000);
    assert.ok(record.sourceTriangles>0 && triangles>record.sourceTriangles,'new detail must change real source geometry, not only a runtime binding');
    assert.equal(primitives,record.primitives);assert.ok(primitives<=10);
    for(const mesh of json.meshes)for(const p of mesh.primitives) {
      assert.ok(p.attributes.NORMAL!==undefined && p.attributes.TEXCOORD_0!==undefined,'geometry needs normals and real UV coordinates');
      for(const key of ['POSITION','NORMAL','TEXCOORD_0'])assert.ok(json.accessors[p.attributes[key]].count>0);
    }
    assert.equal(images.length,record.images);assert.ok(images.reduce((n,i)=>n+i.width*i.height*4,0)<=record.textureBudgetBytes);
    for(const image of images)assert.deepEqual([image.width,image.height],[512,512]);
    const steel=images.find(i=>i.name.includes('steel_basecolor')), polymer=images.find(i=>/(fiberglass|graphite)_basecolor/.test(i.name));
    assert.ok(steel&&polymer,'steel and polymer must not collapse to one original material slot');
    for(const image of [steel,polymer]) {
      const s=stats(image);assert.ok(s.mean.every(v=>v>30&&v<190),'midtone physical color, not near-black or chrome white');
      assert.ok(s.max[0]-s.min[0]>12,'real surface color variation absent');
    }
    const steelOrm=stats(images.find(i=>i.name.includes('steel_orm'))), polymerOrm=stats(images.find(i=>/(fiberglass|graphite)_orm/.test(i.name)));
    assert.ok(steelOrm.mean[2]>200 && polymerOrm.mean[2]<10,'metal and polymer need distinct metallic response');
    assert.ok(polymerOrm.mean[1]>steelOrm.mean[1]+30 && steelOrm.max[1]>steelOrm.min[1]+10,'roughness maps must affect the physical surfaces');
    const actual=inspectWeaponObject(THREE,asset.scene);
    assert.equal(actual.triangles,record.triangles);assert.equal(actual.meshes,record.primitives);
    assert.ok(actual.materials.filter(m=>m.maps.includes('map')&&m.maps.includes('normalMap')&&m.maps.includes('roughnessMap')&&m.maps.includes('metalnessMap')).length>=2,'real GLTFLoader must bind the embedded PBR textures');
    const thumb=read(record.thumbnail.slice(1)), decoded=png(thumb);
    assert.equal(digest(thumb),record.thumbnailSha256);assert.equal(thumb.length,record.thumbnailBytes);
    assert.deepEqual([decoded.width,decoded.height],[384,280]);
    let opaque=0;for(let i=3;i<decoded.data.length;i+=4)if(decoded.data[i]>240)opaque++;
    assert.ok(opaque>1000&&opaque<decoded.width*decoded.height*.65,'thumbnail must have a bounded nonempty actual silhouette');
    t.diagnostic(`${triangles} triangles; ${primitives} draw primitives; ${images.length} actual 512px maps; CPU GLTF PBR load passed, not GPU pixel proof`);
  });
}

for(const key of ['assaultrifle_2','bullpup_1','pistol_2']) {
  test(key+' actual mesh keeps bilateral handle surfaces, unclipped framing and three real wardrobe sockets',async t=>{
    const descriptor=resolveWeaponAsset(key,catalog), raw=await geometryGlb(fileURLToPath(new URL(descriptor.url,assets)));
    const object=normalizeWeaponAsset(THREE,raw.scene,descriptor), box=new THREE.Box3().setFromObject(object), size=box.getSize(new THREE.Vector3());
    assert.deepEqual(descriptor.grip,[0,0,0]);assert.equal(descriptor.scale,1);assert.deepEqual(descriptor.rotation,[0,0,0]);
    const expectedLength=key==='assaultrifle_2'?.976:key==='bullpup_1'?.771:.221;
    assert.ok(Math.abs(size.x-expectedLength)<.004 && size.x>size.z*3);
    const grip=sideSurfaces(object,0,0);
    assert.ok(grip.every(Boolean),'socket lies in empty space');
    assert.ok(grip[0].z<-.003&&grip[1].z>.003&&grip[1].z-grip[0].z<.04);
    assert.ok(Math.abs(grip[0].z+grip[1].z)<.0002,'measured handle is not laterally centered');
    assert.ok(box.max.x>Math.abs(box.min.x),'muzzle must extend forward of the hand');
    for(const aspect of [1.9,390/330,320/200,384/280]) {
      const frame=computeWeaponFrame(THREE,box,aspect),camera=new THREE.PerspectiveCamera(38,aspect,frame.near,frame.far);
      camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
        const point=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1,'clipped '+key+' '+aspect);
      }
    }
    for(const wardrobe of ['Suit','Casual_Hoodie','Swat']) {
      const character=await geometryGlb(fileURLToPath(new URL('assets/character/quaternius/'+wardrobe+'.glb',root)));
      const rig=prepareCharacterGrip(THREE,character.scene,Object.fromEntries(character.animations.map(clip=>[clip.name,clip])));
      const instance=object.clone(true), hold=attachHeldWeapon(THREE,rig,instance,[0,0,0],descriptor.axis,descriptor.forward);
      applyCharacterGrip(rig);character.scene.updateMatrixWorld(true);
      const origin=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3()));
      assert.ok(origin.distanceTo(rig.center)<1e-5,'handle floats away from real wardrobe socket');
      const barrel=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3(1,0,0))).sub(origin).normalize();
      assert.ok(barrel.dot(new THREE.Vector3(0,1,0).projectOnPlane(rig.axis).normalize())>.99999&&barrel.y>.8,'barrel points into forearm');
      hold.removeFromParent();
    }
    t.diagnostic(`${(size.x*100).toFixed(2)}cm; actual grip ${(1000*(grip[1].z-grip[0].z)).toFixed(2)}mm; three true wardrobe sockets, not finger-skin clearance proof`);
  });
}

test('accepted five retain the exact approved lighting and no new global presentation change',()=>{
  for(const key of ['bat','revolver','ak','pistol','knife'])assert.deepEqual(weaponStudioProfile(resolveWeaponAsset(key,catalog)),
    {name:'accepted-reference',background:0x171b20,exposure:1.04,environment:.8,key:2.4,fill:.85,rim:2,hemisphere:0});
  assert.match(weaponPresentationLabel(resolveWeaponAsset('pistol_2',catalog),'en'),/DERIVATIVE/);
  assert.match(weaponPresentationLabel(resolveWeaponAsset('pistol_2',catalog),'ar'),/مطو/);
});

test('seven actual GLB selections load only three sources, clone real textured ownership, and dispose once',async()=>{
  let requests=0;const sourceObjects=[];
  const loader=createWeaponAssetLoader({THREE,catalog,GLTFLoader:class{async loadAsync(url){
    requests++;assert.ok(url.startsWith(assets.href+'upgrades111/'));
    const asset=await fullAsset('assets/weapons/'+url.slice(assets.href.length));sourceObjects.push(asset.scene);return asset;
  }}});
  const instances=await Promise.all(Object.keys(expected).map(key=>loader.load(key)));
  assert.equal(requests,3);
  instances.forEach((object,index)=>assert.equal(object.userData.zoneWeaponAsset.requestedKey,Object.keys(expected)[index]));
  const firstMesh=object=>{let mesh;object.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});return mesh;};
  assert.notEqual(firstMesh(instances[0]).geometry,firstMesh(instances[1]).geometry);
  assert.notEqual(firstMesh(instances[0]).material,firstMesh(instances[1]).material);
  const resources=new Set();
  for(const object of [...instances,...sourceObjects])object.traverse(o=>{
    if(o.geometry)resources.add(o.geometry);
    for(const material of Array.isArray(o.material)?o.material:[o.material])if(material){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
  });
  const disposed=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
  for(const object of instances){loader.release(object);loader.release(object);}await loader.dispose();await loader.dispose();
  assert.equal(disposed.size,resources.size);assert.ok([...disposed.values()].every(n=>n===1),'geometry/material/texture disposed twice or leaked');
  await assert.rejects(loader.load('pistol_2'),/disposed/);
});

test('upgraded selection deadline stays finite, late real geometry is released, and retry is operational',async()=>{
  const asset=await fullAsset('assets/weapons/upgrades111/glock18-detail111.glb');
  let finish,requests=0,geometryDisposals=0;asset.scene.traverse(o=>o.geometry?.addEventListener('dispose',()=>geometryDisposals++));
  const loader=createWeaponAssetLoader({THREE,catalog,loadTimeoutMs:20,GLTFLoader:class{loadAsync(){requests++;return requests===1?new Promise(resolve=>{finish=resolve;}):fullAsset('assets/weapons/upgrades111/glock18-detail111.glb');}}});
  await assert.rejects(loader.load('pistol_2'),error=>error.code==='asset-timeout');
  finish(asset);await new Promise(resolve=>setImmediate(resolve));assert.equal(geometryDisposals,4);
  const retry=await loader.load('pistol_2');assert.equal(requests,2);assert.equal(retry.userData.zoneWeaponAsset.id,'glock18-detail111');
  loader.release(retry);await loader.dispose();
});

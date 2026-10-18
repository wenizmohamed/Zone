import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { geometryGlb,sideSurfaces } from '../assets/weapons/source-tools/geometry-audit.mjs';
import { resolveWeaponAsset,normalizeWeaponAsset,inspectWeaponObject,createWeaponAssetLoader,WEAPON_LOAD_TIMEOUT_MS } from '../dist/weapon-assets.js';
import { computeWeaponFrame } from '../dist/weapon-presentation.js';
import { prepareCharacterGrip,applyCharacterGrip,attachHeldWeapon } from '../dist/character-grip.js';
const root=new URL('../',import.meta.url),assets=new URL('assets/weapons/',root);
const read=path=>readFileSync(new URL(path,root));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('assets/weapons/upgrades112/manifest.json'));
const proposal=JSON.parse(read('assets/weapons/upgrades112/binding-proposal.json'));
const reviewCameras=JSON.parse(read('assets/weapons/source-tools/upgrades112/review-cameras.json'));
const expected={sniperrifle_2:'dragunov-detail112',sniperrifle_5:'dragunov-detail112',sniperrifle_3:'mosin9130-detail112',sniperrifle_6:'mosin9130-detail112'};
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
  loader.register(parser=>({name:'ZONE112_CPU_PNG_DECODER',loadTexture(index){
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


test('standalone proposal preserves all four identities, old measured transforms and ownership boundaries',()=>{
  assert.deepEqual(proposal.bindings,expected);assert.deepEqual(manifest.bindings,expected);
  assert.equal(proposal.status,'proposal-only-runtime-not-edited');
  const previous=JSON.parse(read('assets/weapons/upgrades111/manifest.json'));
  assert.equal(manifest.historicalReceiptSha256,previous.historicalReceiptSha256);
  assert.equal(digest(read(manifest.historicalReceipt)),manifest.historicalReceiptSha256);
  assert.equal(manifest.immutableOriginals.length,20);
  for(const record of manifest.immutableOriginals){const bytes=read(record.path);assert.equal(bytes.length,record.bytes);assert.equal(digest(bytes),record.sha256);}
  const sourceTransform={dragunov:{scale:.12,grip:[-3,-.55,-4.84499526024]},mosin:{scale:.125,grip:[-2.5,0,.00015943159]}};
  for(const [key,id] of Object.entries(expected)){
    const d=proposal.sources[id],old=resolveWeaponAsset(key,{}, {revision:99});
    assert.equal(d.originalSourceId,old.id);assert.equal(d.legacySourceKey,old.sourceKey);
    assert.equal(d.category,'sniper');assert.equal(d.axis,old.axis);assert.equal(d.forward,old.forward);
    assert.equal(old.scale,sourceTransform[d.legacySourceKey].scale);assert.deepEqual(old.grip,sourceTransform[d.legacySourceKey].grip);
    assert.deepEqual(d.grip,[0,0,0]);assert.deepEqual(d.rotation,[0,0,0]);assert.equal(d.scale,1);
    assert.equal(d.quality,'adapted-pbr');assert.equal(d.browserCaptureStatus,'pending-review');
  }
  assert.equal(manifest.sources[0].author,'Tabasco');assert.equal(manifest.sources[1].author,'LonesomeDucky');
  assert.ok(manifest.sources.every(s=>s.license==='CC0-1.0'&&s.source_page.startsWith('https://')));
  assert.match(read('assets/weapons/upgrades112/LICENSE.txt').toString(),/CC0 1.0 Universal/);
  assert.equal(digest(read(manifest.sourceTool)),manifest.sourceToolSha256);
  assert.equal(digest(read(manifest.template)),manifest.templateSha256);
  for(const name of readdirSync(new URL('assets/weapons/upgrades112/',root)))assert.match(name,/\.(glb|png|json|txt|md)$/,'source/evidence leaked into public assets');
});

for(const record of manifest.assets){
  test(record.id+' has added detail beyond chamfers, decoded PBR maps and bounded real primitives',async t=>{
    const asset=await fullAsset(record.path),{bytes,json,images}=asset.receipt;
    assert.equal(digest(bytes),record.sha256);assert.equal(bytes.length,record.bytes);
    const primitives=json.meshes.flatMap(m=>m.primitives);
    const triangles=primitives.reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);
    assert.equal(triangles,record.triangles);assert.ok(triangles<=60000);
    assert.equal(triangles,record.baseChamferTriangles+record.addedDetailTriangles);
    assert.ok(record.addedDetailTriangles>5000 && record.detailParts.length>=30,'not only subdivision/chamfers');
    assert.equal(primitives.length,record.primitives);assert.ok(primitives.length<=10);
    assert.equal(images.length,record.images);
    const decodedBytes=images.reduce((sum,i)=>sum+i.width*i.height*4*4/3,0);
    assert.ok(decodedBytes<=16*1024*1024,'decoded textures including mipmaps exceed budget');
    for(const image of images)assert.ok(image.width*image.height<=512*512&&image.width>0&&image.height>0);
    for(const p of primitives){
      assert.ok(p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined);
      for(const key of ['POSITION','NORMAL','TEXCOORD_0'])assert.ok(json.accessors[p.attributes[key]].count>0);
    }
    asset.scene.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal','uv'])for(const n of o.geometry.attributes[key].array)assert.ok(Number.isFinite(n),'invalid geometry data');});
    const steel=images.find(i=>i.name.includes('steel_orm')),woodOrm=images.find(i=>i.name.includes('walnut_roughness_orm'));
    assert.ok(steel&&woodOrm);
    const metal=stats(steel),wood=stats(woodOrm);
    assert.ok(metal.mean[2]>200 && wood.max[2]===0,'wood must be nonmetallic and steel metallic');
    assert.ok(wood.mean[1]>metal.mean[1]+30&&wood.max[1]-wood.min[1]>20,'wood needs independent roughness breakup');
    const woodMaterial=json.materials.find(m=>m.name.includes('walnut'));
    assert.ok(woodMaterial.normalTexture&&woodMaterial.pbrMetallicRoughness.baseColorTexture&&woodMaterial.pbrMetallicRoughness.metallicRoughnessTexture);
    for(const [i,value] of [.26,.20,.42,1].entries())assert.ok(Math.abs(woodMaterial.pbrMetallicRoughness.baseColorFactor[i]-value)<1e-6,'retain the reviewed neutral-walnut factor');
    const woodColor=images[json.textures[woodMaterial.pbrMetallicRoughness.baseColorTexture.index].source];
    const woodNormal=images[json.textures[woodMaterial.normalTexture.index].source];
    assert.deepEqual([woodColor.width,woodColor.height],[256,1024]);assert.deepEqual([woodNormal.width,woodNormal.height],[256,1024]);
    assert.match(woodColor.name,/LonesomeDucky/);assert.match(woodNormal.name,/LonesomeDucky/);
    assert.ok(stats(woodColor).max[0]-stats(woodColor).min[0]>70,'natural worn wood detail was flattened');
    const originalBytes=read(record.originalPath),originalLength=originalBytes.readUInt32LE(12);
    const originalJson=JSON.parse(originalBytes.toString('utf8',20,20+originalLength));
    const originalWood=originalJson.materials.find(m=>m.name.includes('walnut'));
    const originalImage=originalJson.images[originalJson.textures[originalWood.normalTexture.index].source];
    const view=originalJson.bufferViews[originalImage.bufferView],originalBin=originalBytes.subarray(28+originalLength);
    const originalNormal=png(originalBin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
    assert.deepEqual([woodNormal.width,woodNormal.height],[originalNormal.width,originalNormal.height]);
    let maxNormalDelta=0;for(let i=0;i<woodNormal.data.length;i++)maxNormalDelta=Math.max(maxNormalDelta,Math.abs(woodNormal.data[i]-originalNormal.data[i]));
    assert.ok(maxNormalDelta<=1,'retained normal pixels were redesigned instead of preserved');
    const inspected=inspectWeaponObject(THREE,asset.scene);
    assert.equal(inspected.triangles,record.triangles);assert.equal(inspected.meshes,record.primitives);
    assert.ok(inspected.materials.filter(m=>m.maps.includes('map')&&m.maps.includes('normalMap')&&m.maps.includes('metalnessMap')&&m.maps.includes('roughnessMap')).length>=2);
    if(record.id.startsWith('dragunov')){
      assert.ok(json.materials.some(m=>m.name.includes('coated_optic_lens')));
      assert.ok(json.materials.some(m=>m.name.includes('anodized_optic_housing')));
    }else assert.ok(!json.materials.some(m=>m.name.includes('optic_lens')),'Mosin iron sights must not silently become a scoped rifle');
    t.diagnostic(record.triangles+' triangles, '+record.addedDetailTriangles+' added detail triangles beyond base chamfers, '+record.primitives+' draw primitives, '+(decodedBytes/1048576).toFixed(2)+' MiB decoded maps with mipmaps');
  });

  test(record.id+' actual new receiver surfaces, preserved grip, framing and three real wardrobe sockets',async t=>{
    const d=proposal.sources[record.id],newScene=(await geometryGlb(fileURLToPath(new URL(record.path,root)))).scene;
    const object=normalizeWeaponAsset(THREE,newScene,d),box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3());
    const kind=record.id.startsWith('dragunov')?'dragunov':'mosin9130';
    const expectedLength=kind==='dragunov'?1.19776:1.24797;
    assert.ok(Math.abs(size.x-expectedLength)<.001&&size.x>size.z*10,'muzzle axis/physical scale changed');
    const originalDescriptor=resolveWeaponAsset(kind==='dragunov'?'sniperrifle_2':'sniperrifle_3',{}, {revision:99});
    const original=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL(record.originalPath,root)))).scene,originalDescriptor);
    const oldGrip=sideSurfaces(original,0,0),grip=sideSurfaces(object,0,0);
    for(const side of [0,1]){assert.ok(grip[side]&&oldGrip[side]);assert.ok(Math.abs(grip[side].z-oldGrip[side].z)<.0002,'grip surfaces moved more than 0.2mm');}
    assert.ok(grip[0].z<-.003&&grip[1].z>.003&&Math.abs(grip[0].z+grip[1].z)<.0002);
    const x=kind==='dragunov'?.15:.15,y=kind==='dragunov'?.07:.06;
    const oldDetail=sideSurfaces(original,x,y),newDetail=sideSurfaces(object,x,y);
    assert.ok(newDetail.every(Boolean));
    assert.ok(newDetail.some((hit,i)=>oldDetail[i]&&Math.abs(hit.z)>Math.abs(oldDetail[i].z)+.0005),'no actual receiver detail beyond the original surface');
    for(const aspect of [1.9,390/330,320/200,384/280]){
      const frame=computeWeaponFrame(THREE,box,aspect),camera=new THREE.PerspectiveCamera(38,aspect,frame.near,frame.far);
      camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,'clipped aspect '+aspect);
      }
    }
    for(const wardrobe of ['Suit','Casual_Hoodie','Swat']){
      const c=await geometryGlb(fileURLToPath(new URL('assets/character/quaternius/'+wardrobe+'.glb',root)));
      const rig=prepareCharacterGrip(THREE,c.scene,Object.fromEntries(c.animations.map(clip=>[clip.name,clip])));
      const instance=object.clone(true),hold=attachHeldWeapon(THREE,rig,instance,[0,0,0],d.axis,d.forward);
      applyCharacterGrip(rig);c.scene.updateMatrixWorld(true);
      const origin=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3()));
      assert.ok(origin.distanceTo(rig.center)<1e-5);
      const barrel=rig.hand.worldToLocal(instance.localToWorld(new THREE.Vector3(1,0,0))).sub(origin).normalize();
      assert.ok(barrel.dot(new THREE.Vector3(0,1,0).projectOnPlane(rig.axis).normalize())>.99999&&barrel.y>.8);
      hold.removeFromParent();
    }
    t.diagnostic((size.x*100).toFixed(2)+'cm; actual grip '+((grip[1].z-grip[0].z)*1000).toFixed(2)+'mm; all three wardrobe sockets; finger-skin clearance not asserted');
  });

  test(record.id+' committed camera receipts preserve equal render conditions; shipped thumbnail depicts the exported GLB',()=>{
    assert.equal(reviewCameras.revision,112);
    assert.equal(reviewCameras.status,'offline-evidence-receipt-not-browser-acceptance');
    const views=reviewCameras.views.filter(view=>view.assetId===record.id);
    assert.deepEqual(views.map(view=>view.view),['full','detail']);
    for(const view of views){
      assert.equal(view.modelSha256,record.sha256);
      assert.equal(view.before.cameraSha256,view.after.cameraSha256,'recorded before/after camera bytes differ');
      const canonical=digest(JSON.stringify(view.camera));
      assert.equal(canonical,view.before.canonicalCameraSha256);
      assert.equal(canonical,view.after.canonicalCameraSha256);
      assert.deepEqual(view.camera.resolution,[1100,620]);
      assert.deepEqual(view.camera.frame,view.view==='full'?record.reviewFrame:record.detailReviewFrame);
      assert.equal(view.camera.transparent,false);assert.equal(view.camera.viewTransform,'AgX');
      assert.equal(view.camera.cameraMatrix.length,4);assert.ok(view.camera.cameraMatrix.every(row=>row.length===4&&row.every(Number.isFinite)));
      assert.equal(view.camera.lights.length,3);assert.ok(view.camera.lights.every(light=>light.energy>0&&light.size>0));
      assert.notEqual(view.before.pngSha256,view.after.pngSha256,'recorded before/after image bytes are identical');
      for(const image of [view.before,view.after]){
        assert.match(image.pngSha256,/^[a-f0-9]{64}$/);assert.match(image.cameraSha256,/^[a-f0-9]{64}$/);
        assert.ok(image.pngBytes>1000);assert.deepEqual([image.pngWidth,image.pngHeight],[1100,620]);
      }
    }
    assert.equal(record.thumbnailRenderedFromExportedGLB,true);
    const bytes=read(record.thumbnail.slice(1)),decoded=png(bytes);
    assert.equal(digest(bytes),record.thumbnailSha256);assert.deepEqual([decoded.width,decoded.height],[384,280]);
    let count=0,minX=384,maxX=-1,minY=280,maxY=-1;
    for(let y=0;y<280;y++)for(let x=0;x<384;x++)if(decoded.data[(y*384+x)*4+3]>200){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    assert.ok(count>1000&&count<384*280*.6);assert.ok(minX>5&&maxX<379&&minY>5&&maxY<275,'silhouette clipped in thumbnail');
    assert.equal(manifest.browserCaptureStatus,'pending-review');assert.match(manifest.thumbnailCapture,/offline/);
  });
}

function proposedLoaderFactory(){
  const resolveProposed=key=>Object.hasOwn(expected,key)?{...proposal.sources[expected[key]],requestedKey:key,sourceKey:expected[key]}:null;
  // Adapt only the module URL transport to this VM. The real factory body,
  // including timeout/cache/clone/release behavior, executes unchanged.
  return vm.runInNewContext('('+createWeaponAssetLoader.toString().replaceAll('import.meta.url','moduleURL')+')',
    {resolveWeaponAsset:resolveProposed,normalizeWeaponAsset,WEAPON_LOAD_TIMEOUT_MS,URL,setTimeout,clearTimeout,console,moduleURL:new URL('../dist/weapon-assets.js',import.meta.url).href});
}

test('actual shared loader logic accepts the independent proposal, caches two sources and disposes clones once',async()=>{
  const factory=proposedLoaderFactory();
  let requests=0;const originals=[];
  const loader=factory({THREE,baseURL:assets.href,GLTFLoader:class{async loadAsync(url){requests++;const asset=await fullAsset('assets/weapons/'+url.slice(assets.href.length));originals.push(asset.scene);return asset;}}});
  const instances=await Promise.all(Object.keys(expected).map(key=>loader.load(key)));
  assert.equal(requests,2);
  for(const [index,obj] of instances.entries())assert.equal(obj.userData.zoneWeaponAsset.requestedKey,Object.keys(expected)[index]);
  const resources=new Set();
  for(const obj of [...originals,...instances])obj.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){resources.add(m);for(const t of Object.values(m))if(t?.isTexture)resources.add(t);}});
  const disposals=new Map();for(const r of resources)r.addEventListener('dispose',()=>disposals.set(r,(disposals.get(r)||0)+1));
  for(const obj of instances){loader.release(obj);loader.release(obj);}await loader.dispose();await loader.dispose();
  assert.equal(disposals.size,resources.size);assert.ok([...disposals.values()].every(n=>n===1));
});

test('proposal uses actual finite timeout, late-result disposal and retry without runtime binding changes',async()=>{
  const factory=proposedLoaderFactory(),source=await fullAsset('assets/weapons/upgrades112/dragunov-detail112.glb');
  let requests=0,finish,disposed=0;
  source.scene.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));
  const loader=factory({THREE,baseURL:assets.href,loadTimeoutMs:20,GLTFLoader:class{loadAsync(){
    requests++;return requests===1?new Promise(resolve=>{finish=resolve;}):fullAsset('assets/weapons/upgrades112/dragunov-detail112.glb');
  }}});
  await assert.rejects(loader.load('sniperrifle_2'),e=>e.code==='asset-timeout');
  finish(source);await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,7);
  const retry=await loader.load('sniperrifle_2');assert.equal(requests,2);assert.equal(retry.userData.zoneWeaponAsset.id,'dragunov-detail112');
  loader.release(retry);await loader.dispose();await assert.rejects(loader.load('sniperrifle_2'),/disposed/);
});

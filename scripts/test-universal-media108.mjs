import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import {GLTFLoader} from '../lib/three184/GLTFLoader.js';
import {loadAsset,fetchAssetMember,resolveAssetMember,validateAssetManifest,summarizeAssetBundle,validateAssetTransform,normalizeAssetObject,measureAssetObject,supportedModelExtensions,isSupportedModelExtension,isEmbeddedDataUri,isValidAssetId,assetChunkCount,ASSET_CHUNK_BYTES} from '../dist/asset-loader.mjs';
import {createSafehouseCharacter} from '../dist/safehouse-character.mjs';
import {mapMediaLayerId,isMapMediaPinEligible,filterEligibleMapMediaPins,eligibleMapMediaPinCount,isMapMediaViewVisible,minMapMediaPitch,minMapMediaZoom,mapMediaTargetSizeMeters,mapMediaMinTargetSizeMeters,mapMediaMaxTargetSizeMeters,mapMediaClearanceScaleFactor,mapMediaRoofBaseOffsetMeters,mapMediaToneMappingExposure} from '../dist/map-media108.mjs';
import {VIEWER_STARTUP_TIMEOUT_MS,viewerStartupTimeoutMs,maxRenderDeltaSeconds,isViewerRenderDeltaValid} from '../dist/viewer-runtime108.mjs';
import {inspectorBudgetDiagnostics,isSupportedInspectorFormat,isWithinInspectorBudget,maxInspectorVertices,maxInspectorTriangles,maxInspectorNodes,maxInspectorBytes,supportedInspectorFormats,supportedInspectorFormatCount} from '../engine/bin/inspect-asset.mjs';
const require=createRequire(import.meta.url),buildings=require('../assets/city/service-buildings108.js');
const HASH='a'.repeat(64),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const obj='o ActualTriangle\nv 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n';
function server(files,entry,options={}){
  const values=new Map(Object.entries(files).map(([name,bytes])=>[name,Buffer.from(bytes)])),calls=[];
  const asset={id:HASH,name:'Isolated uploaded model',status:'ready',kind:'model',format:entry.split('.').at(-1),entry,
    members:[...values].map(([name,bytes])=>({name,size:bytes.length,mime:'application/octet-stream'})),metadata:{},transform:{scale:1,rotation:[0,0,0],floorOffset:0,cameraTarget:[0,0,0]},...options};
  return{asset,calls,fetcher:async(url,init)=>{const parsed=new URL(url,'https://zone.example');calls.push({url:parsed,init});
    if(parsed.pathname.endsWith('/content')){const member=parsed.searchParams.get('member'),bytes=values.get(member),offset=Number(parsed.searchParams.get('offset')),length=Number(parsed.searchParams.get('length'));assert.ok(bytes,'only a declared member is requested');return{ok:true,json:async()=>({member,offset,total:bytes.length,base64:bytes.subarray(offset,offset+length).toString('base64')})};}
    return{ok:true,json:async()=>asset};}};
}
test('relative resources stay in their own bundle and reject remote, filesystem, encoded and above-root escapes',()=>{
  assert.equal(resolveAssetMember('../textures/wall.png','models/house.gltf'),'textures/wall.png');
  assert.equal(resolveAssetMember('asset://bundle/models/roof.bin'),'models/roof.bin');
  for(const path of ['https://x/a.bin','file:///C:/secret','//x/p','C:/secret','../../private','%2e%2e/private','a\\b','%00.bin','/etc/passwd','a.png?secret=1'])assert.throws(()=>resolveAssetMember(path),undefined,path);
});
test('ready manifest validates identity, unique immutable members, finite sizes and entry instead of trusting arbitrary metadata',()=>{
  const h=server({'house.obj':obj},'house.obj');assert.equal(validateAssetManifest(h.asset,HASH),h.asset);
  const summary=summarizeAssetBundle(h.asset);
  assert.equal(summary.id,HASH);assert.equal(summary.memberCount,1);assert.equal(summary.entryExtension,'obj');assert.ok(summary.totalBytes>0);
  for(const change of [{id:'b'.repeat(64)},{status:'inspecting'},{members:[{name:'../house.obj',size:5}]},{members:[{name:'a',size:-1}]},{members:[{name:'a',size:134217729}]},{entry:'missing.obj'},{members:[{name:'house.obj',size:1},{name:'house.obj',size:1}]}])assert.throws(()=>validateAssetManifest({...h.asset,...change},HASH));
});
test('large member download reconstructs exact bytes with three bounded response chunks',async()=>{
  const bytes=Buffer.alloc(ASSET_CHUNK_BYTES*2+319);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
  const h=server({'large.bin':bytes},'large.bin'),progress=[];
  const received=await fetchAssetMember(HASH,h.asset.members[0],{fetcher:h.fetcher,onProgress:p=>progress.push(p)});
  assert.equal(sha(received),sha(bytes));assert.equal(h.calls.length,3);assert.deepEqual(h.calls.map(c=>Number(c.url.searchParams.get('offset'))),[0,ASSET_CHUNK_BYTES,ASSET_CHUNK_BYTES*2]);
  assert.equal(progress.at(-1).loaded,bytes.length);assert.ok(h.calls.every(c=>c.init.credentials==='same-origin'&&Number(c.url.searchParams.get('length'))===ASSET_CHUNK_BYTES));
});
test('content offset/length/identity discontinuities and a zero-byte truncated stream reject immediately',async()=>{
  const member={name:'x.obj',size:20};
  for(const bad of [{offset:1,total:20,member:'x.obj',base64:'YQ=='},{offset:0,total:21,member:'x.obj',base64:'YQ=='},{offset:0,total:20,member:'else.obj',base64:'YQ=='},{offset:0,total:20,member:'x.obj',base64:''},{offset:0,total:20,member:'x.obj',base64:'!bad'}])await assert.rejects(fetchAssetMember(HASH,member,{fetcher:async()=>({ok:true,json:async()=>bad})}));
});
test('actual OBJ upload becomes real measured mesh geometry, not an image stand-in, and releases exactly once',async()=>{
  const h=server({'models/room.obj':obj},'models/room.obj'),result=await loadAsset(HASH,{fetcher:h.fetcher});
  assert.ok(result.object.isObject3D);assert.deepEqual(result.bounds.size,[2,3,0]);assert.equal(result.measurement.triangles,1);let released=0;
  result.object.traverse(n=>n.geometry?.addEventListener('dispose',()=>released++));result.dispose();result.dispose();assert.equal(released,1);
});
test('authoring reads send draft on both metadata and bytes; ordinary views never send it',async()=>{
  for(const draft of [false,true]){const h=server({'h.obj':obj},'h.obj');const result=await loadAsset(HASH,{fetcher:h.fetcher,draft});assert.ok(h.calls.every(c=>c.url.searchParams.has('draft')===draft));result.dispose();}
});
test('retained binary character passes the universal loader with actual mesh/skeleton/animation data',async()=>{
  const bytes=readFileSync(new URL('../assets/character/quaternius/Suit.glb',import.meta.url)),h=server({'Suit.glb':bytes},'Suit.glb'),result=await loadAsset(HASH,{fetcher:h.fetcher});
  assert.equal(result.measurement.triangles,7674);assert.equal(result.animations.length,24);let skinned=0;result.object.traverse(n=>{if(n.isSkinnedMesh)skinned++;});assert.equal(skinned,13);assert.ok(result.animations.some(a=>a.name==='Idle'));result.dispose();
});
const binary=Buffer.alloc(36);[0,0,0,2,0,0,0,3,0].forEach((n,i)=>binary.writeFloatLE(n,i*4));
const gltf=uri=>JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri,byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-100,-100,-100],max:[100,100,100]}]});
if(typeof globalThis.ProgressEvent==='undefined')globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init);}};
test('glTF bundle loads its real external member and measures vertex bounds rather than lying accessor metadata',async()=>{
  const h=server({'models/house.gltf':gltf('../geometry.bin'),'geometry.bin':binary},'models/house.gltf'),result=await loadAsset(HASH,{fetcher:h.fetcher});
  assert.deepEqual(result.bounds.size,[2,3,0]);assert.equal(result.measurement.triangles,1);result.dispose();
});
test('gltf external URI and missing bundled dependencies reject instead of becoming network requests',async()=>{
  for(const uri of ['https://example.invalid/private.bin','../../private.bin','missing.bin']){const h=server({'house.gltf':gltf(uri)},'house.gltf');await assert.rejects(loadAsset(HASH,{fetcher:h.fetcher}));assert.equal(h.calls.length,2,'only metadata and the uploaded source bytes were fetched');}
});
const fbx=`; FBX 7.4.0 project file
FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
}
Objects:  {
\tGeometry: 100, "Geometry::Triangle", "Mesh" {
\t\tVertices: *9 {
\t\t\ta: 0,0,0,2,0,0,0,3,0
\t\t}
\t\tPolygonVertexIndex: *3 {
\t\t\ta: 0,1,-3
\t\t}
\t}
\tModel: 200, "Model::Triangle", "Mesh" {
\t\tVersion: 232
\t\tShading: T
\t\tCulling: "CullingOff"
\t}
}
Connections:  {
\tC: "OO",100,200
\tC: "OO",200,0
}
`;
test('official r184 FBX loader parses actual uploaded ASCII geometry through the same delivery path',async()=>{
  const h=server({'triangle.fbx':fbx},'triangle.fbx'),result=await loadAsset(HASH,{fetcher:h.fetcher});assert.deepEqual(result.bounds.size,[2,3,0]);assert.equal(result.measurement.triangles,1);result.dispose();
});
test('image/audio sources retain exact immutable bytes and are not falsely labeled as 3D objects',async()=>{
  for(const [entry,kind]of[['wall.png','image'],['theme.mp3','audio']]){const h=server({[entry]:Buffer.from('verified-backend-bytes')},entry,{kind}),result=await loadAsset(HASH,{fetcher:h.fetcher});assert.equal(result.object,null);assert.equal(result.kind,kind);assert.match(result.url,/^blob:/);result.dispose();}
});
test('normalizer recenters rotated source bounds, floors geometry and preserves its raw vertex byte array',()=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,2,1),new THREE.MeshBasicMaterial());mesh.position.set(30,12,-9);const before=sha(mesh.geometry.attributes.position.array);
  const root=normalizeAssetObject(mesh,{scale:2,rotation:[0,0,90],floorOffset:.25},3),view=measureAssetObject(root);
  assert.ok(Math.abs(view.bounds.min[1]-.25)<1e-7);assert.ok(Math.abs(view.bounds.center[0])<1e-7);assert.ok(Math.abs(view.bounds.center[2])<1e-7);assert.ok(Math.abs(Math.max(...view.bounds.size)-6)<1e-7);assert.equal(sha(mesh.geometry.attributes.position.array),before);
});
test('transform clamps exactly to backend-supported ranges and rejects non-finite control values safely',()=>{
  const value=validateAssetTransform({scale:Infinity,rotation:[999,-999,NaN],floorOffset:999999,cameraTarget:[-999999,999999,3]});assert.equal(value.scale,1);assert.deepEqual(value.rotation,[360,-360,0]);assert.equal(value.floorOffset,10000);assert.deepEqual(value.cameraTarget,[-10000,10000,3]);assert.equal(validateAssetTransform({scale:.000001}).scale,.000001);
});
async function wardrobe(name){const bytes=readFileSync(new URL(`../assets/character/quaternius/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('safehouse character actually stands in the same Three scene with retained rig, animation and owned armor',async()=>{
  const scene=new THREE.Scene(),receipts=[],actor=createSafehouseCharacter({scene,wardrobeLoader:wardrobe,publish:r=>receipts.push(r)});
  const first=await actor.update({outfit:'suit',weapon:'fists',armorId:'vest',armorOwned:true,armorReduction:.25});
  assert.equal(actor.diagnostics().hasActiveActor,true);assert.equal(actor.diagnostics().activeOutfit,'Suit');
  assert.equal(first.root.parent,scene);assert.ok(first.root.getObjectByName('WristR'));assert.ok(first.root.getObjectByName('ZONE representative worn vest'));actor.tick(.016,1);assert.ok(first.mixer.time>.01);assert.ok(receipts.some(r=>r.meshInRoom===true));
  const replacement=await actor.update({outfit:'street',weapon:'fists',armorOwned:false});assert.equal(first.root.parent,null);assert.equal(replacement.root.parent,scene);assert.equal(scene.children.length,1);assert.equal(replacement.root.getObjectByName('ZONE representative worn vest'),undefined);actor.dispose();actor.dispose();assert.equal(scene.children.length,0);
  assert.equal(actor.diagnostics().disposed,true);
});
test('late wardrobe completion cannot replace the newest safehouse character or leave an extra mesh',async()=>{
  let release;const scene=new THREE.Scene(),actor=createSafehouseCharacter({scene,wardrobeLoader:file=>file==='Suit'?new Promise(r=>release=()=>wardrobe(file).then(r)):wardrobe(file)});
  const old=actor.update({outfit:'suit',weapon:'fists'}),latest=await actor.update({outfit:'tactical',weapon:'fists'});release();await old;assert.equal(scene.children.length,1);assert.equal(scene.children[0],latest.root);assert.equal(latest.root.userData.outfit,'Swat');actor.dispose();
});
const safeSource=readFileSync(new URL('../dist/safehouse.mjs',import.meta.url),'utf8');
test('safehouse contains physical armory/vault/lounge geometry with real raycast targets, not fake overlay iframes',()=>{
  const scene=new THREE.Scene(),scope=vm.createContext({THREE,scene,owned:new Set(),hotspots:new Map(),objects:[],document:{body:{dataset:{}}}}),start=safeSource.indexOf('function material('),end=safeSource.indexOf('function focus(',start);
  vm.runInContext(safeSource.slice(start,end)+'\nroom();',scope);scene.updateMatrixWorld(true);
  assert.equal(scope.hotspots.size,3);assert.ok(scope.objects.length>50);assert.ok(scene.children.some(n=>n.userData.action==='armory'));assert.ok(scene.children.some(n=>n.userData.action==='vault'));assert.ok(scene.children.some(n=>n.userData.action==='lounge'));
  for(const action of ['armory','vault','lounge']){const group=scene.children.find(n=>n.userData.action===action),box=new THREE.Box3().setFromObject(group);assert.ok(!box.isEmpty());const target=box.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(target.clone().add(new THREE.Vector3(0,.4,6)),target.clone().sub(target.clone().add(new THREE.Vector3(0,.4,6))).normalize());assert.ok(ray.intersectObject(group,true).length>0,action+' has a real hit surface');}
  assert.doesNotMatch(readFileSync(new URL('../dist/safehouse.html',import.meta.url),'utf8'),/<iframe/i);
});
function feature(id,x,y,width=16,height=20){const origin=[-73.9865,40.698],lng=meters=>origin[0]+meters/(111319.49*Math.cos(origin[1]*Math.PI/180)),lat=meters=>origin[1]+meters/111319.49;return{type:'Feature',id,properties:{providerId:String(id),height,extrude:'true'},geometry:{type:'Polygon',coordinates:[[[lng(x),lat(y)],[lng(x+width),lat(y)],[lng(x+width),lat(y+width)],[lng(x),lat(y+width)],[lng(x),lat(y)]]]}};}
test('all seven required services bind to distinct actual roof polygons without changing world or input pins',()=>{
  const ids=['bank','gym','alley','hospital','jail','market','home'],features=ids.map((id,index)=>feature(index,index*27,0)),pins=ids.map((id,index)=>({id,_lngLat:features[index].geometry.coordinates[0][0].slice()})),before=JSON.stringify({pins,features});
  const result=buildings.associate(pins,features);assert.equal(result.complete,true);assert.equal(result.associations.length,7);assert.equal(new Set(result.associations.map(a=>a.providerId)).size,7);assert.ok(result.associations.every(a=>a.insideRoof&&buildings.inside(a.coordinates,a.polygon)));assert.equal(JSON.stringify({pins,features}),before);
  buildings.apply(pins,result);assert.ok(pins.every(p=>p._buildingAssociation.insideRoof));const again=buildings.associate(pins,features);assert.deepEqual(again.associations.map(a=>a.coordinates),result.associations.map(a=>a.coordinates));
});
test('roof anchor never falls in a courtyard or a concave polygon gap',()=>{
  const origin=[-73.9865,40.698],a=feature(1,0,0,40).geometry.coordinates[0],inner=feature(2,10,10,20).geometry.coordinates[0],rings=[a,inner];const result=buildings.roofAnchor(rings,origin);assert.ok(result);assert.ok(buildings.inside(result.coordinates,rings));assert.equal(buildings.inside(result.coordinates,[inner]),false);
  const lshape=[a[0],a[1],[a[1][0],a[0][1]+(a[2][1]-a[0][1])*.25],[a[0][0]+(a[1][0]-a[0][0])*.25,a[0][1]+(a[2][1]-a[0][1])*.25],[a[0][0]+(a[1][0]-a[0][0])*.25,a[2][1]],a[3],a[0]];const concave=buildings.roofAnchor([lshape],origin);assert.ok(buildings.inside(concave.coordinates,[lshape]));
});
test('missing/remote building associations are reported unbound, never fabricated as visually proven',()=>{
  const result=buildings.associate([{id:'bank',_lngLat:[-73.98,40.7]}],[feature(1,0,0)]);assert.equal(result.complete,false);assert.deepEqual(result.unbound,['bank']);assert.equal(result.associations.length,0);
});
test('stable idle recovery never republishes unchanged service coordinates into another render loop',()=>{
  const district=require('../assets/city/compact-district.js'),features=[feature(1,0,0)],pin={id:'bank',_lngLat:features[0].geometry.coordinates[0][0].slice()};let updates=0;
  const previous=globalThis.ZoneServiceBuildings;globalThis.ZoneServiceBuildings=buildings;
  try{const control=district.controller({getSource:()=>({serialize:()=>({data:{features}})}),fire(){updates++;}});control.setDestinations([pin]);assert.equal(updates,1);for(let i=0;i<20;i++)control.setDestinations([pin]);assert.equal(updates,1);control.dispose();}
  finally{if(previous===undefined)delete globalThis.ZoneServiceBuildings;else globalThis.ZoneServiceBuildings=previous;}
});
test('rapid published roof model replacement waits for stale GPU preparation and disposes the old layer first',async()=>{
  const source=readFileSync(new URL('../assets/city/compact-district.js',import.meta.url),'utf8'),features=[feature(1,0,0)],pending=[],created=[],released=[];let occupied=false;
  const scope=vm.createContext({URL,ZoneServiceBuildings:buildings,document:{currentScript:{src:'https://zone.example/assets/city/compact-district.js?v=108'},body:{dataset:{}}},loadMapMediaModule:async()=>({createMapMedia(_map,pins){assert.equal(occupied,false,'only one uploaded media layer can own the shared canvas');occupied=true;created.push(pins[0].mediaAsset);return new Promise(resolve=>pending.push(()=>resolve({setVisible(){},dispose(){occupied=false;released.push(pins[0].mediaAsset);}})));}})});
  vm.runInContext(source.replace('import(mapMediaUrl)','loadMapMediaModule()'),scope);
  const control=scope.ZoneCompactDistrict.controller({getSource:()=>({serialize:()=>({data:{features}})}),fire(){}}),pin={id:'bank',mediaAsset:HASH,_lngLat:features[0].geometry.coordinates[0][0].slice()},next={...pin,mediaAsset:'b'.repeat(64)};
  const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
  control.setDestinations([pin]);await settle();assert.equal(created.length,1);control.setDestinations([next]);await settle();assert.equal(created.length,1,'replacement waits while the first shader is preparing');
  pending.shift()();await settle();assert.deepEqual(released,[HASH]);assert.deepEqual(created,[HASH,next.mediaAsset]);pending.shift()();await settle();control.dispose();assert.deepEqual(released,[HASH,next.mediaAsset]);assert.equal(occupied,false);
});

// Run the actual map consumer with real Three geometry. Only the GPU and HTTP
// boundaries are replaced, so geographic transforms and lifecycle stay real.
const mapMediaSource=readFileSync(new URL('../dist/map-media108.mjs',import.meta.url),'utf8');
function mapMediaHarness({failId=null,imageId=null,compileError=null}={}){
  const layers=new Map(),assets=[],renderers=[],loads=[],canvas={},gl={};let pitch=35,zoom=17;
  class RecordingRenderer{
    constructor(options){assert.equal(options.canvas,canvas);assert.equal(options.context,gl);this.info={render:{calls:0,triangles:0}};this.disposals=0;this.draws=0;renderers.push(this);}
    resetState(){} initTexture(){}
    async compileAsync(scene,camera){this.scene=scene;this.camera=camera;if(compileError)throw compileError;}
    render(scene,camera){assert.equal(scene,this.scene);assert.equal(camera,this.camera);this.draws++;this.info.render.calls=1;this.info.render.triangles=12;}
    dispose(){this.disposals++;}
  }
  const mercator={fromLngLat([lng,lat],altitude=0){const units=1/(40075016.68557849*Math.cos(lat*Math.PI/180));return{x:(lng+180)/360,y:(180-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI)/360,z:altitude*units,meterInMercatorCoordinateUnits:()=>units};}};
  const map={getLayer:id=>layers.get(id),getCanvas:()=>canvas,getPitch:()=>pitch,getZoom:()=>zoom,triggerRepaint(){},
    addLayer(layer,before){assert.equal(before,'zone-poi-halo');assert.ok(!layers.has(layer.id));layers.set(layer.id,layer);layer.onAdd(map,gl);},
    removeLayer(id){const layer=layers.get(id);layers.delete(id);layer?.onRemove();}};
  layers.set('zone-poi-halo',{id:'zone-poi-halo'});
  const load=async(id,{signal})=>{loads.push({id,signal});if(id===failId)throw Error('isolated model rejected');
    const object=id===imageId?null:new THREE.Mesh(new THREE.BoxGeometry(20,40,6),new THREE.MeshStandardMaterial());if(object)object.position.set(30,12,-9);
    const asset={object,asset:{id},transform:{scale:1,rotation:[0,35,0],floorOffset:.2,cameraTarget:[0,0,0]},disposals:0,dispose(){this.disposals++;}};assets.push(asset);return asset;};
  const document={body:{dataset:{}}},scope=vm.createContext({THREE:{...THREE,WebGLRenderer:RecordingRenderer},loadAsset:load,normalizeAssetObject,AbortController,mapboxgl:{MercatorCoordinate:mercator},document});
  vm.runInContext(mapMediaSource.replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,''),scope);
  return{map,scope,assets,renderers,loads,mercator,document,layers,setView(p,z){pitch=p;zoom=z;}};
}
function mediaPin(id='bank',assetId=HASH){return{id,mediaAsset:assetId,_lngLat:[-73.9848,40.6983],_buildingAssociation:{insideRoof:true,providerId:'actual-roof-42',heightMeters:20.4,clearanceMeters:4}};}
test('published map model is measured mesh geometry on the matched service roof in geographic space',async()=>{
  const h=mapMediaHarness(),pin=mediaPin(),control=await h.scope.createMapMedia(h.map,[pin,{...mediaPin('gym'),_buildingAssociation:null}]);
  assert.equal(h.loads.length,1);assert.equal(control.diagnostics.status,'ready');
  const renderer=h.renderers[0],group=renderer.scene.getObjectByName('Published service attachment bank');assert.ok(group);assert.ok(h.assets[0].object.isMesh);assert.ok(group.getObjectByProperty('uuid',h.assets[0].object.uuid),'uploaded mesh is a physical descendant of the service attachment');
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(bounds.min.y-(20.4+.25+.2))<1e-7);assert.ok(Math.hypot(size.x,size.z)/2<4,'transformed footprint fits the safe roof radius');
  h.layers.get('zone-published-map-media').render(null,{defaultProjectionData:{mainMatrix:new THREE.Matrix4().toArray()}});
  const actual=group.position.clone().applyMatrix4(renderer.camera.projectionMatrix),expected=h.mercator.fromLngLat(pin._lngLat),units=expected.meterInMercatorCoordinateUnits();
  assert.ok(Math.abs(actual.x-expected.x)<1e-10);assert.ok(Math.abs(actual.y-expected.y)<1e-10);assert.ok(Math.abs(actual.z-(20.4+.25)*units)<1e-10);
  assert.equal(control.diagnostics.bindings[0].providerId,'actual-roof-42');assert.deepEqual(Array.from(control.diagnostics.bindings[0].coordinates),pin._lngLat);
  const snap=control.getDiagnostics();assert.equal(snap.status,'ready');assert.equal(snap.bindings.length,1);snap.bindings[0].providerId='mutated';assert.equal(control.diagnostics.bindings[0].providerId,'actual-roof-42');
  control.dispose();
});
test('map attachment respects flat, distant, hidden and invalid projection views and releases resources once',async()=>{
  const h=mapMediaHarness(),control=await h.scope.createMapMedia(h.map,[mediaPin()]),layer=h.layers.get('zone-published-map-media'),renderer=h.renderers[0],matrix=new THREE.Matrix4().toArray();
  h.setView(0,17);layer.render(null,matrix);h.setView(35,15.7);layer.render(null,matrix);h.setView(35,17);control.setVisible(false);layer.render(null,matrix);control.setVisible(true);layer.render(null,[]);assert.equal(renderer.draws,0);
  layer.render(null,matrix);assert.equal(renderer.draws,1);assert.equal(control.diagnostics.triangles,12);assert.equal(control.diagnostics.continuousAnimation,false);
  control.dispose();control.dispose();assert.equal(h.assets[0].disposals,1);assert.equal(renderer.disposals,1);assert.equal(h.loads[0].signal.aborted,true);assert.equal(h.layers.has('zone-published-map-media'),false);assert.equal(control.diagnostics.status,'disposed');
});
test('unmatched map bindings fetch nothing and a stale load never installs a layer',async()=>{
  const h=mapMediaHarness(),empty=await h.scope.createMapMedia(h.map,[{...mediaPin(),_buildingAssociation:{insideRoof:false}}]);assert.equal(empty.diagnostics.status,'empty');assert.equal(h.loads.length,0);
  const cancelled=await h.scope.createMapMedia(h.map,[mediaPin()],()=>false);assert.equal(cancelled.diagnostics.status,'cancelled');assert.equal(h.assets[0].disposals,1);assert.equal(h.loads[0].signal.aborted,true);assert.equal(h.renderers.length,0);
});
test('failed or incompatible map assets cannot leave partial models or GPU layers installed',async()=>{
  const second='b'.repeat(64),h=mapMediaHarness({failId:second});await assert.rejects(h.scope.createMapMedia(h.map,[mediaPin(),mediaPin('gym',second)]),/isolated model rejected/);assert.equal(h.assets[0].disposals,1);assert.ok(h.loads.every(l=>l.signal.aborted));assert.equal(h.renderers.length,0);
  const image=mapMediaHarness({imageId:HASH});await assert.rejects(image.scope.createMapMedia(image.map,[mediaPin()]),/requires a 3D model/);assert.equal(image.assets[0].disposals,1);assert.equal(image.renderers.length,0);
  const shader=mapMediaHarness({compileError:Error('isolated shader rejected')});await assert.rejects(shader.scope.createMapMedia(shader.map,[mediaPin()]),/isolated shader rejected/);assert.equal(shader.assets[0].disposals,1);assert.equal(shader.renderers[0].disposals,1);assert.equal(shader.layers.has('zone-published-map-media'),false);
});

test('new production viewers fence same-origin parent messages and keep draft-only authoring out of ordinary viewer',()=>{
  const inspector=readFileSync(new URL('../dist/asset-inspector.mjs',import.meta.url),'utf8'),viewer=readFileSync(new URL('../dist/asset-viewer.mjs',import.meta.url),'utf8');
  assert.match(safeSource,/event\.source !== parent \|\| event\.origin !== location\.origin/);assert.match(inspector,/event\.source !== parent \|\| event\.origin !== location\.origin/);assert.match(inspector,/draft:true/);assert.doesNotMatch(viewer,/draft\s*:\s*true/);assert.match(viewer,/loadAsset\(id,/);assert.match(safeSource,/new THREE\.Raycaster/);
  const budget=inspectorBudgetDiagnostics();
  assert.equal(budget.maxVertices,3_000_000);
  assert.equal(budget.maxTriangles,2_000_000);
  assert.equal(budget.maxNodes,50_000);
  assert.deepEqual(budget.supportedFormats,['glb','gltf','obj','fbx']);
  assert.match(viewer,/window\.ZoneAssetViewer=\{diagnostics:/);
  assert.match(inspector,/window\.ZoneAssetInspector = \{ diagnostics:/);
  assert.match(safeSource,/window\.ZoneSafehouse = \{ diagnostics:/);
  const assocSummary=buildings.summarizeAssociations({associations:[{id:'bank',insideRoof:true,crowded:false}],unbound:[],complete:true,source:'actual-provider-footprint'});
  assert.equal(assocSummary.boundCount,1);
  assert.equal(assocSummary.insideRoofCount,1);
  assert.equal(assocSummary.complete,true);
  assert.equal(mapMediaLayerId(),'zone-published-map-media');
  assert.equal(isMapMediaPinEligible(mediaPin()),true);
  assert.equal(isMapMediaPinEligible({...mediaPin(),_buildingAssociation:{insideRoof:false}}),false);
  assert.deepEqual(supportedModelExtensions(),['glb','gltf','fbx','obj']);
  assert.equal(isSupportedModelExtension('GLB'),true);
  assert.equal(isSupportedModelExtension('png'),false);
  assert.equal(isEmbeddedDataUri('data:image/png;base64,YQ=='),true);
  assert.equal(isEmbeddedDataUri('https://example.invalid/x.png'),false);
  assert.equal(filterEligibleMapMediaPins([mediaPin(),{...mediaPin('gym'),_buildingAssociation:{insideRoof:false}}]).length,1);
  assert.equal(mapMediaTargetSizeMeters(4),5.4);
  assert.equal(mapMediaTargetSizeMeters(20),12);
  assert.equal(isValidAssetId(HASH),true);
  assert.equal(isValidAssetId('bad'),false);
  assert.equal(assetChunkCount(ASSET_CHUNK_BYTES * 2 + 10),3);
  assert.equal(eligibleMapMediaPinCount([mediaPin(),{...mediaPin('gym'),_buildingAssociation:{insideRoof:false}}]),1);
  assert.equal(isMapMediaViewVisible(35,17),true);
  assert.equal(isMapMediaViewVisible(5,17),false);
  assert.equal(buildings.earthRadiusMeters(),6378137);
  assert.equal(buildings.defaultMaximumDistanceMeters(),180);
  assert.equal(VIEWER_STARTUP_TIMEOUT_MS,25000);
  assert.equal(viewerStartupTimeoutMs(),25000);
  assert.equal(maxRenderDeltaSeconds(),.1);
  assert.match(viewer,/isDisposed:\(\)=>disposed/);
  assert.match(inspector,/isDisposed: \(\) => disposed/);
  assert.equal(isSupportedInspectorFormat('GLB'),true);
  assert.equal(isSupportedInspectorFormat('stl'),false);
  assert.equal(isWithinInspectorBudget({vertices:100,triangles:50,nodes:10,bytes:1024}),true);
  assert.equal(isWithinInspectorBudget({vertices:3_000_001}),false);
  assert.equal(maxInspectorVertices(),3_000_000);
  assert.equal(maxInspectorTriangles(),2_000_000);
  assert.equal(maxInspectorNodes(),50_000);
  assert.equal(maxInspectorBytes(),125_829_120);
  assert.equal(minMapMediaPitch(),10);
  assert.equal(minMapMediaZoom(),15.8);
  assert.equal(mapMediaMinTargetSizeMeters(),1);
  assert.equal(mapMediaMaxTargetSizeMeters(),12);
  assert.equal(mapMediaClearanceScaleFactor(),1.35);
  assert.equal(mapMediaRoofBaseOffsetMeters(),.25);
  assert.equal(mapMediaToneMappingExposure(),1.15);
  assert.equal(isViewerRenderDeltaValid(0.016),true);
  assert.equal(isViewerRenderDeltaValid(0.25),false);
  assert.deepEqual(supportedInspectorFormats(),['glb','gltf','obj','fbx']);
  assert.equal(supportedInspectorFormatCount(),4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as Three from '../lib/three184/three.module.js';

// Execute the actual module with real Three transforms, scene graph and resource
// objects. Only network loading, GPU drawing and Mapbox's shared context are
// deterministic doubles. No browser or WebGL context is created by this suite.
const moduleUrl=new URL('../dist/district-landmarks.js',import.meta.url);
const source=readFileSync(moduleUrl,'utf8')
  .replace(/^import .*;\r?\n/gm,'')
  .replaceAll('import.meta.url',JSON.stringify(moduleUrl.href))
  .replace('export function supportedLandmarkIds','function supportedLandmarkIds')
  .replace('export function isSupportedLandmarkId','function isSupportedLandmarkId')
  .replace('export function landmarkLayerId','function landmarkLayerId')
  .replace('export function landmarkSpec','function landmarkSpec')
  .replace('export function supportedLandmarkCount','function supportedLandmarkCount')
  .replace('export function landmarkWidthMeters','function landmarkWidthMeters')
  .replace('export async function createLandmarks','async function createLandmarks');
const ID='zone-authored-landmarks';
const KIT_NAMES=['building_E_withoutBase','building_G_withoutBase','building_C_withoutBase','building_A_withoutBase','watertower','car_sedan','streetlight'];
const pins=()=>[
  {id:'bank',_lngLat:[-73.9861,40.6981],name:'Actual bank'},
  {id:'hospital',_lngLat:[-73.987,40.6988]},
  {id:'gym',_lngLat:[-73.9858,40.6978]},
  {id:'hq',_lngLat:[-73.9868,40.6975]},
  {id:'market',_lngLat:[-73.9851,40.6984]},
  {id:'crime',_lngLat:[-73.9855,40.6982]},
  {id:'bank'},
];
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mercator(lngLat,z=0){
  const [lng,lat]=lngLat,scale=1/(40075016.68557849*Math.cos(lat*Math.PI/180));
  return {x:(lng+180)/360,y:(180-(180/Math.PI*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))))/360,z:z*scale,meterInMercatorCoordinateUnits:()=>scale};
}

function harness({manual=false,existing=false,addError=false,shader=null}={}){
  const resources=[],requests=new Map(),rendererInstances=[],canvases=[],layers=new Map(),mutations=[],events=[];
  const track=(object,kind)=>{const record={object,kind,disposals:0,closes:0};object.addEventListener('dispose',()=>record.disposals++);resources.push(record);return object;};
  const trackedClass=(Base,kind)=>class extends Base{constructor(...args){super(...args);track(this,kind);}};
  const THREE={...Three,
    BoxGeometry:trackedClass(Three.BoxGeometry,'geometry'),
    PlaneGeometry:trackedClass(Three.PlaneGeometry,'geometry'),
    MeshBasicMaterial:trackedClass(Three.MeshBasicMaterial,'material'),
    MeshStandardMaterial:trackedClass(Three.MeshStandardMaterial,'material'),
    WebGLRenderer:class{
      constructor(options){this.options=options;this.resets=0;this.draws=[];this.disposals=0;this.contextLosses=0;this.programReady=!shader;this.debug={};this.info={programs:[{program:{},isReady:()=>{if(this.programFailure)throw this.programFailure;return this.programReady;}}],render:{calls:11,triangles:222},memory:{geometries:9,textures:3}};rendererInstances.push(this);}
      resetState(){this.resets++;events.push('reset');}
      initTexture(texture){if(shader)events.push('texture');}
      compile(scene,camera){events.push('compile');if(shader)shader.promise.then(()=>{this.programReady=true;},error=>{this.programFailure=error;this.programReady=true;});}
      render(scene,camera){scene.updateMatrixWorld(true);this.draws.push({scene,camera});events.push('draw');}
      dispose(){this.disposals++;}
      forceContextLoss(){this.contextLosses++;}
    },
  };
  function asset(name){
    const geometry=new THREE.BoxGeometry(2,3,4),texture=track(new Three.Texture(),'texture');
    const record=resources.at(-1);texture.source.data={close:()=>record.closes++};
    const material=new THREE.MeshStandardMaterial({color:'#ffffff',map:texture});
    const scene=new Three.Group(),mesh=new Three.Mesh(geometry,[material,material]);
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    return {scene};
  }
  class GLTFLoader{
    loadAsync(url){
      const name=new URL(url).pathname.split('/').pop().replace(/\.gltf$/,'');
      assert.ok(KIT_NAMES.includes(name),'only the published kit is requested');
      assert.equal(requests.has(name),false,'shared models load once per controller');
      const pending=deferred();requests.set(name,pending);
      if(!manual)pending.resolve(asset(name));return pending.promise;
    }
  }
  const gl={shared:true,LINK_STATUS:35714,getProgramParameter:()=>true,getProgramInfoLog:()=>''},canvas={mapCanvas:true},poi={id:'zone-poi-halo'},ownership={id:'zone-ownership',version:17},territory={type:'FeatureCollection',features:[{id:'ZC-021',properties:{owner:'kings'},geometry:{type:'Polygon',coordinates:[[[1,2],[3,4],[5,6],[1,2]]]}}]};
  layers.set(poi.id,poi);layers.set(ownership.id,ownership);if(existing)layers.set(ID,{id:ID,external:true});
  const map={pitch:35,zoom:17,repaints:0,territory,
    getCanvas(){canvases.push(canvas);return canvas;},getPitch(){return this.pitch;},getZoom(){return this.zoom;},
    getLayer(id){return layers.get(id);},
    addLayer(layer,before){mutations.push({action:'add',id:layer.id,before});if(addError)throw Error('style unavailable');assert.equal(layers.has(layer.id),false);layers.set(layer.id,layer);layer.onAdd(map,gl);},
    removeLayer(id){const layer=layers.get(id);mutations.push({action:'remove',id});layers.delete(id);layer?.onRemove?.(map,gl);},
    triggerRepaint(){this.repaints++;},
  };
  const document={body:{dataset:{}}};
  const context=vm.createContext({THREE,GLTFLoader,URL,mapboxgl:{MercatorCoordinate:{fromLngLat:mercator}},document,performance:{now:()=>100},console,setTimeout,clearTimeout});
  vm.runInContext(source+'\nglobalThis.createLandmarks=createLandmarks;globalThis.supportedLandmarkIds=supportedLandmarkIds;globalThis.isSupportedLandmarkId=isSupportedLandmarkId;globalThis.landmarkLayerId=landmarkLayerId;globalThis.landmarkSpec=landmarkSpec;globalThis.supportedLandmarkCount=supportedLandmarkCount;globalThis.landmarkWidthMeters=landmarkWidthMeters;',context,{filename:moduleUrl.pathname});
  return {create:context.createLandmarks,supportedLandmarkIds:context.supportedLandmarkIds,isSupportedLandmarkId:context.isSupportedLandmarkId,landmarkLayerId:context.landmarkLayerId,landmarkSpec:context.landmarkSpec,supportedLandmarkCount:context.supportedLandmarkCount,landmarkWidthMeters:context.landmarkWidthMeters,map,gl,canvas,canvases,layers,mutations,resources,requests,rendererInstances,events,document,asset,
    resolveAll(){for(const [name,pending] of requests)pending.resolve(asset(name));},
    assertReleased(){assert.ok(resources.length>0);for(const r of resources)assert.equal(r.disposals,1,`${r.kind} must be disposed exactly once`);},
  };
}

test('real scene graph installs one cosmetic layer at published destinations without changing pins or territory geometry',async()=>{
  const h=harness(),input=pins(),before=JSON.stringify(input),territory=JSON.stringify(h.map.territory);
  assert.deepEqual(Array.from(h.supportedLandmarkIds()),['bank','hospital','gym','hq','market','home','jail','alley','shop']);
  assert.equal(h.isSupportedLandmarkId('bank'),true);
  assert.equal(h.isSupportedLandmarkId('crime'),false);
  assert.equal(h.landmarkLayerId(),'zone-authored-landmarks');
  assert.equal(h.landmarkSpec('bank')?.model,'building_E_withoutBase');
  assert.equal(h.landmarkSpec('crime'),null);
  assert.equal(h.supportedLandmarkCount(),9);
  assert.equal(h.landmarkWidthMeters('bank'),24);
  assert.equal(h.landmarkWidthMeters('crime'),0);
  const control=await h.create(h.map,input);
  assert.equal(control.diagnostics.status,'ready');assert.equal(h.requests.size,7);
  const snap=control.getDiagnostics();
  assert.equal(snap.status,'ready');
  assert.equal(snap.landmarks.length,5);
  snap.landmarks[0].id='mutated';
  assert.equal(control.diagnostics.landmarks[0].id,'bank');
  assert.deepEqual(Array.from(control.diagnostics.landmarks,v=>v.id),['bank','hospital','gym','hq','market']);
  assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(h.map.territory),territory);
  assert.deepEqual(h.mutations,[{action:'add',id:ID,before:'zone-poi-halo'}]);
  assert.equal(h.layers.get('zone-ownership').version,17);
  const layer=h.layers.get(ID);assert.equal(layer.type,'custom');assert.equal(layer.renderingMode,'3d');
  layer.render(h.gl,new Three.Matrix4().toArray());
  const scene=h.rendererInstances[0].draws[0].scene,origin=mercator([-73.9865,40.698]),meter=origin.meterInMercatorCoordinateUnits();
  for(const pin of input.slice(0,5)){
    const group=scene.getObjectByName('service-'+pin.id),location=mercator(pin._lngLat);
    assert.ok(group);assert.ok(Math.abs(group.position.x-(location.x-origin.x)/meter)<1e-8);
    assert.ok(Math.abs(group.position.z-(location.y-origin.y)/meter)<1e-8);
    assert.equal(control.diagnostics.landmarks.find(v=>v.id===pin.id).cosmetic,true);
  }
  control.dispose();h.assertReleased();
});

test('beta102 custom service coins use measured authored roof-sign height without changing destination coordinates',async()=>{
  const h=harness(),input=pins(),before=JSON.stringify(input),control=await h.create(h.map,input),layer=h.layers.get(ID);
  layer.render(h.gl,new Three.Matrix4().toArray());const scene=h.rendererInstances[0].draws[0].scene;
  for(const entry of control.diagnostics.landmarks){const group=scene.getObjectByName('service-'+entry.id),building=group.children[0],roof=new Three.Box3().setFromObject(building).max.y;assert.ok(entry.heightMeters>0);assert.ok(Math.abs(entry.heightMeters-roof)<1e-8,'published icon elevation must equal its own transformed GLTF roof/sign, not a neighboring water tower or streetlight');assert.deepEqual(Array.from(entry.coordinates),input.find(pin=>pin.id===entry.id)._lngLat);}
  assert.equal(JSON.stringify(input),before);control.dispose();h.assertReleased();
});

test('custom layer uses the map canvas/context, resets shared GPU state and never schedules continuous repaint',async()=>{
  const h=harness(),control=await h.create(h.map,pins()),layer=h.layers.get(ID),renderer=h.rendererInstances[0];
  assert.equal(renderer.options.canvas,h.canvas);assert.equal(renderer.options.context,h.gl);assert.equal(renderer.autoClear,false);
  assert.equal(h.map.repaints,1);const matrix=new Three.Matrix4().makeScale(2,3,4).toArray();
  layer.render(h.gl,{defaultProjectionData:{mainMatrix:matrix}});
  assert.deepEqual(h.events,['reset','compile','reset','reset','reset','draw','reset']);assert.equal(h.map.repaints,1);assert.equal(control.diagnostics.calls,11);assert.equal(control.diagnostics.triangles,222);assert.equal(control.diagnostics.continuousAnimation,false);
  assert.ok(renderer.draws[0].camera.projectionMatrix.elements.every(Number.isFinite));
  for(let n=0;n<5;n++)layer.render(h.gl,matrix);
  assert.equal(h.map.repaints,1);assert.equal(renderer.draws.length,6);
  control.dispose();assert.equal(renderer.contextLosses,0,'never lose the map-owned context');h.assertReleased();
});

test('visibility, zoom, pitch and malformed matrices suppress drawing without mutating gameplay geometry',async()=>{
  const h=harness(),control=await h.create(h.map,pins()),layer=h.layers.get(ID),renderer=h.rendererInstances[0],matrix=new Three.Matrix4().toArray();
  control.setVisible(false);layer.render(h.gl,matrix);control.setVisible(true);
  h.map.pitch=0;layer.render(h.gl,matrix);h.map.pitch=35;h.map.zoom=15;layer.render(h.gl,matrix);h.map.zoom=17;
  layer.render(h.gl,null);layer.render(h.gl,[1,2]);assert.equal(renderer.draws.length,0);
  layer.render(h.gl,matrix);assert.equal(renderer.draws.length,1);control.dispose();
  layer.render(h.gl,matrix);assert.equal(renderer.draws.length,1);h.assertReleased();
});

test('controller disposal releases shared and cloned resources once, closes bitmaps and preserves other map layers',async()=>{
  const h=harness(),control=await h.create(h.map,pins()),renderer=h.rendererInstances[0],layer=h.layers.get(ID);
  control.dispose();control.dispose();layer.onRemove();assert.equal(h.layers.has(ID),false);assert.equal(h.layers.has('zone-poi-halo'),true);assert.equal(h.layers.has('zone-ownership'),true);
  h.assertReleased();assert.equal(renderer.disposals,1);assert.equal(renderer.contextLosses,0);assert.equal(control.diagnostics.status,'disposed');
  for(const r of h.resources.filter(r=>r.kind==='texture'))assert.equal(r.closes,1);
  assert.equal(JSON.parse(h.document.body.dataset.zoneDistrictLandmarks).status,'disposed');
});

test('cancellation after asynchronous kit loading releases every late resource without installing a layer',async()=>{
  const h=harness({manual:true});let active=true;const task=h.create(h.map,pins(),()=>active);
  assert.equal(h.requests.size,7);active=false;h.resolveAll();const control=await task;
  assert.equal(control.diagnostics.status,'cancelled');assert.equal(h.rendererInstances.length,0);assert.deepEqual(h.mutations,[]);assert.equal(h.map.repaints,0);
  control.setVisible(true);control.dispose();control.dispose();h.assertReleased();assert.equal(h.map.repaints,0);
  for(const r of h.resources.filter(r=>r.kind==='texture'))assert.equal(r.closes,1);
});

test('duplicate layer rejection preserves its owner and releases rejected kit resources',async()=>{
  const h=harness({existing:true}),owner=h.layers.get(ID);
  await assert.rejects(h.create(h.map,pins()),/already installed/);
  assert.equal(h.layers.get(ID),owner);assert.deepEqual(h.mutations,[]);assert.equal(h.rendererInstances.length,0);
  assert.equal(h.requests.size,0);assert.equal(h.resources.length,0);
});

test('a failed load cleans later successful loads before rejecting and never installs partial landmarks',async()=>{
  const h=harness({manual:true}),task=h.create(h.map,pins());
  // Observe rejection immediately while letting delayed successes arrive after
  // the first failure. This reproduces Promise.all's early-rejection leak.
  const checked=assert.rejects(task,/broken kit/);
  h.requests.get(KIT_NAMES[0]).reject(Error('broken kit'));await flush();
  for(const [name,pending] of h.requests)if(name!==KIT_NAMES[0])pending.resolve(h.asset(name));
  await checked;await flush();h.assertReleased();assert.deepEqual(h.mutations,[]);assert.equal(h.rendererInstances.length,0);
  for(const r of h.resources.filter(r=>r.kind==='texture'))assert.equal(r.closes,1);
  assert.equal(JSON.parse(h.document.body.dataset.zoneDistrictLandmarks).status,'failed');
});

test('missing actual service coordinates rejects instead of inventing destinations and frees assets',async()=>{
  const h=harness();await assert.rejects(h.create(h.map,[{id:'bank'},{id:'unknown',_lngLat:[-73.98,40.7]}]),/No published district destinations/);
  assert.equal(h.resources.length,0);assert.equal(h.requests.size,0);assert.deepEqual(h.mutations,[]);assert.equal(h.rendererInstances.length,0);
});

test('Mapbox installation failure releases kit and contact resources without losing the shared context',async()=>{
  const h=harness({addError:true});await assert.rejects(h.create(h.map,pins()),/style unavailable/);
  h.assertReleased();assert.equal(h.layers.has(ID),false);assert.equal(h.layers.has('zone-ownership'),true);assert.equal(h.map.repaints,0);
});

test('delayed shader preparation uploads textures once and never draws into the shared canvas before ready',async()=>{
  const shader=deferred(),h=harness({shader}),task=h.create(h.map,pins());await flush();
  const layer=h.layers.get(ID),renderer=h.rendererInstances[0];assert.ok(layer);
  assert.equal(JSON.parse(h.document.body.dataset.zoneDistrictLandmarks).status,'preparing');
  assert.equal(h.events.filter(value=>value==='texture').length,7);assert.equal(h.events.filter(value=>value==='compile').length,1);
  layer.render(h.gl,new Three.Matrix4().toArray());assert.equal(renderer.draws.length,0);assert.equal(h.map.repaints,0);
  shader.resolve();const control=await task;assert.equal(control.diagnostics.status,'ready');assert.equal(h.map.repaints,1);
  layer.render(h.gl,new Three.Matrix4().toArray());assert.equal(renderer.draws.length,1);control.dispose();h.assertReleased();
});

test('map removal during shader preparation cancels late rendering and releases every resource exactly once',async()=>{
  const shader=deferred(),h=harness({shader}),task=h.create(h.map,pins());await flush();
  const renderer=h.rendererInstances[0];h.map.removeLayer(ID);
  h.map.getLayer=()=>{throw Error('removed style must not be queried');};shader.resolve();const control=await task;
  assert.equal(control.diagnostics.status,'disposed');control.setVisible(true);control.dispose();
  assert.equal(h.map.repaints,0);assert.equal(renderer.draws.length,0);assert.equal(renderer.disposals,1);assert.equal(renderer.contextLosses,0);h.assertReleased();
});

test('failed shader preparation cleans its layer, and a late failure after removal never queries the removed style',async()=>{
  for(const removed of [false,true]){
    const shader=deferred(),h=harness({shader}),task=h.create(h.map,pins());const checked=removed?task:assert.rejects(task,/shader compilation failed/);await flush();
    const renderer=h.rendererInstances[0];if(removed){h.map.removeLayer(ID);h.map.getLayer=()=>{throw Error('removed style must not be queried');};}
    shader.reject(Error('shader compilation failed'));const result=await checked;if(removed)assert.equal(result.diagnostics.status,'disposed','removal settles immediately rather than keeping vendor polling alive');
    assert.equal(h.layers.has(ID),false);assert.equal(renderer.draws.length,0);assert.equal(renderer.disposals,1);assert.equal(renderer.contextLosses,0);h.assertReleased();
  }
});

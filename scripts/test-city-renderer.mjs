import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/city-landmarks.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function');

async function harness() {
  const allocated = [], frames = new Map(), listeners = new Map(), warmups = [], layers = new Map([['zone-blocks-fill', {}], ['zone-buildings-3d', {}]]), sources = new Map([['zone-city-atlas', {}]]);
  let pitch = 0, renders = 0, frameId = 0, projectionShift = 0;
  const chain = () => new Proxy({}, { get: (_t, key) => key === 'dispose' ? () => {} : () => chain() });
  class Vector { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } set(x,y,z) { Object.assign(this,{x,y,z});return this; } }
  class Matrix { makeTranslation(){return this;} scale(){return this;} multiply(){return this;} makeRotationX(){return this;} compose(){return this;} fromArray(){return this;} }
  class Material { constructor(options={}) {Object.assign(this,options);this.color={set(){}};} clone(){return new Material({map:this.map});} dispose(){} }
  class Mesh { constructor(geometry,material,capacity){Object.assign(this,{geometry,material,capacity,instanceMatrix:{setUsage(){},needsUpdate:false},count:capacity,disposed:0,colors:new Map()});allocated.push(this);} setMatrixAt(i){assert.ok(i<this.capacity,'instance pool overflow');} setColorAt(i,color){assert.ok(i<this.capacity);this.colors.set(i,color);this.instanceColor={};} computeBoundingSphere(){} dispose(){this.disposed++;} }
  class Scene { constructor(){this.children=[];} add(o){this.children.push(o);} remove(o){this.children=this.children.filter(x=>x!==o);} }
  class Renderer { constructor(){this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};} resetState(){} initTexture(){} compileAsync(){return new Promise((resolve,reject)=>warmups.push({resolve,reject}));} render(scene){renders++;this.info.render.calls=scene.children.filter(x=>x.visible&&x.count).length;} dispose(){} }
  const material = new Material({map:{dispose(){},source:{data:{close(){}}}}});
  class Loader { async loadAsync(){return {scene:{updateMatrixWorld(){},traverse(fn){fn({isMesh:true,geometry:{clone:()=>chain(),dispose(){}},material,matrixWorld:{}});}}};} }
  const THREE = {Vector3:Vector,Matrix4:Matrix,Quaternion:class{setFromAxisAngle(){}},Color:class{set(){return this;}},InstancedMesh:Mesh,Camera:class{constructor(){this.projectionMatrix=new Matrix();}},Scene,WebGLRenderer:Renderer,Box3:class{setFromObject(){this.min={y:0};return this;}getSize(v){v.set(1,1,1);return v;}getCenter(v){v.set(0,0,0);return v;}},HemisphereLight:class{},DirectionalLight:class{constructor(){this.position=new Vector();}},CanvasTexture:class{dispose(){}},PlaneGeometry:class{rotateX(){return this;}dispose(){}},MeshBasicMaterial:Material,DynamicDrawUsage:1};
  const map = {getLayer:id=>layers.get(id),getSource:id=>sources.get(id),getStyle:()=>({}),getPitch:()=>pitch,getContainer:()=>({clientWidth:1280,clientHeight:500}),getCanvas:()=>({}),getLayoutProperty:()=> 'visible',setLayoutProperty(){},project:p=>({x:p[0]+projectionShift,y:p[1]}),triggerRepaint(){},addSource(id,data){sources.set(id,{...data,setData(){}});},addLayer(layer){layers.set(layer.id,layer);layer.onAdd?.(map,{});},removeLayer(id){layers.get(id)?.onRemove?.();layers.delete(id);},removeSource(id){sources.delete(id);},on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},off(name,fn){listeners.get(name)?.delete(fn);}};
  const perspective=[];
  const scope=vm.createContext({THREE,GLTFLoader:Loader,URL,console,performance,innerWidth:390,document:{body:{dataset:{zoneCityAtlas:'{}'}},createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),mapboxgl:{MercatorCoordinate:{fromLngLat:([x,y])=>({x,y,z:0,meterInMercatorCoordinateUnits:()=>1})}},ZoneCityAtlas:{preparePerspective:()=>true,setPerspective:(_map,value)=>perspective.push(value),remove(){},createPlan:()=>({labels:[]})},ZoneCityLayout:{createStreets:()=>({}),createPlacements:features=>features.flatMap(f=>[{blockId:f.id,model:'building_A_withoutBase',coordinates:[100,100],width:10,rotation:0,heightScale:1,shade:0},{blockId:f.id,model:'car_sedan',coordinates:[110,110],width:2,rotation:0,heightScale:1,shade:0}]),selectVisiblePlacements:items=>items}});
  // Replace only import.meta URL construction. Execute the actual shipped code.
  vm.runInContext(source.replace('import.meta.url', "'http://127.0.0.1:4300/dist/city-landmarks.js'"),scope);
  const controller=await scope.installCityLandmarks(map);
  const features=[{id:'ZC-001',geometry:{type:'Polygon',coordinates:[]},properties:{districtId:'north',districtName:'North'}}];
  const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
  return {controller,features,map,scope,allocated,warmups,perspective,listeners,frames,flush,get renders(){return renders;},pitch(value){pitch=value;},shift(value){projectionShift=value;},emit(name){for(const fn of listeners.get(name)||[])fn();},render(){layers.get('zone-city-landmarks').render({},new Array(16).fill(1));}};
}

test('3D waits for asynchronous shader preparation and keeps flat rendering available',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.pitch(35);h.render();assert.equal(h.renders,0);
  assert.equal(JSON.parse(h.scope.document.body.dataset.zoneCityModels).shadersReady,false);
  h.warmups[0].resolve();await h.controller.whenReady();h.flush();h.render();assert.equal(h.renders,1);assert.equal(JSON.parse(h.scope.document.body.dataset.zoneCityModels).shadersReady,true);
});

test('pan, zoom, pitch and resize reuse instance buffers instead of allocating and disposing meshes',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.warmups[0].resolve();await h.controller.whenReady();h.pitch(35);h.emit('pitch');h.flush();const allocations=h.allocated.length;
  for(let i=0;i<30;i++){h.shift(i);h.emit('moveend');h.emit('resize');h.flush();h.render();}
  assert.equal(h.allocated.length,allocations);assert.ok(h.allocated.every(mesh=>mesh.disposed===0));assert.ok(h.allocated.every(mesh=>mesh.count<=mesh.capacity));
  h.pitch(0);h.emit('pitch');h.flush();const renders=h.renders;h.render();assert.equal(h.renders,renders);assert.equal(h.perspective.at(-1),false);
  h.pitch(35);h.emit('pitch');h.flush();h.render();assert.equal(h.allocated.length,allocations);assert.equal(h.perspective.at(-1),true);
});

test('unchanged ownership and translated labels do not warm shaders or reallocate geometry',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.warmups[0].resolve();await h.controller.whenReady();const count=h.allocated.length;
  h.controller.setTerritories(h.features.map(f=>({...f,properties:{...f.properties,ownerId:'new-owner',districtName:'المدينة'}})));
  assert.equal(h.warmups.length,1);assert.equal(h.allocated.length,count);
});

test('3D pans refresh a single batched visible set before the camera settles',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.warmups[0].resolve();await h.controller.whenReady();h.pitch(35);h.emit('pitch');h.flush();const before=JSON.parse(h.scope.document.body.dataset.zoneCityModels).rebuilds,allocations=h.allocated.length;
  for(let i=0;i<100;i++)h.emit('move');assert.equal(h.frames.size,1);h.flush();assert.equal(JSON.parse(h.scope.document.body.dataset.zoneCityModels).rebuilds,before+1);assert.equal(h.allocated.length,allocations);
});

test('hidden maps stop drawing and teardown releases each pool and listener once',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.warmups[0].resolve();await h.controller.whenReady();h.pitch(35);h.emit('pitch');h.flush();h.render();const before=h.renders;
  h.controller.setVisible(false);h.emit('moveend');h.flush();h.render();assert.equal(h.renders,before);
  h.controller.dispose();assert.ok(h.allocated.every(mesh=>mesh.disposed===1));assert.ok([...h.listeners.values()].every(set=>set.size===0));assert.equal(h.frames.size,0);
});

test('shader preparation failures are exposed without starting a broken draw loop',async()=>{
  const h=await harness();h.controller.setTerritories(h.features);h.warmups[0].reject(new Error('test compile failure'));await assert.rejects(h.controller.whenReady(),/test compile failure/);h.pitch(35);h.render();assert.equal(h.renders,0);assert.equal(h.scope.document.body.dataset.zoneCityModelsError,'test compile failure');
});

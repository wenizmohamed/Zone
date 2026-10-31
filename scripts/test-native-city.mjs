import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),atlas=require('../assets/city/atlas.js'),city=require('../assets/city/native-city.js');
const cell=(id=1)=>({type:'Feature',id:'ZC-'+String(id).padStart(3,'0'),properties:{districtId:'north',districtName:'North',ownerId:'vipers'},geometry:{type:'Polygon',coordinates:[[[-73.98,40.75],[-73.975,40.75],[-73.975,40.745],[-73.98,40.745],[-73.98,40.75]]]}});
function harness(){
  const layers=new Map([['zone-ownership-fill',{}],['zone-blocks-fill',{}]]),sources=new Map(),listeners=new Map();let repaints=0,stops=0,pitch=0;
  const map={getLayer:id=>layers.get(id),getSource:id=>sources.get(id),getPitch:()=>pitch,getStyle:()=>({layers:[...layers].map(([id])=>({id}))}),isSourceLoaded:()=>true,addSource(id,data){sources.set(id,{...data,updates:0,setData(value){this.data=value;this.updates++;}});},addLayer(layer){layers.set(layer.id,layer);},removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},off(name,fn){listeners.get(name)?.delete(fn);},triggerRepaint(){repaints++;},stop(){stops++;}};
  return {map,layers,sources,listeners,pitch(value){pitch=value;},emit(name,data={}){for(const fn of [...(listeners.get(name)||[])])fn(data);},get repaints(){return repaints;},get stops(){return stops;}};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('native overhead and 3D share exact roof footprints and real rooftop geometry',()=>{
  const plan=atlas.createPlan([cell()]),out=city.compile(plan),roofs=out.data.features.filter(f=>f.properties.kind==='building');
  const planSummary=atlas.summarizePlan(plan);
  assert.equal(planSummary.blockCount,1);assert.equal(planSummary.roofCount,plan.roofs.length);
  assert.equal(planSummary.roofKinds.flat+planSummary.roofKinds.sawtooth+planSummary.roofKinds.glass,plan.roofs.length);
  assert.equal(roofs.length,plan.roofs.length);assert.equal(out.stats.pixels,0);assert.equal(out.stats.source,'native-city-geometry');
  roofs.forEach((f,i)=>{assert.deepEqual(f.geometry.coordinates[0].slice(0,4),plan.roofs[i].corners);assert.ok(f.properties.height>0);});
  const gear=out.data.features.filter(f=>f.properties.kind==='detail');assert.ok(gear.length>=roofs.length*3);assert.ok(gear.every(f=>f.properties.height>f.properties.base));
  assert.ok(gear.some(f=>f.geometry.coordinates.length===2),'parapet must have an actual open center, not a solid roof cover');
});
test('cosmetic city data is deterministic and never invents ownership or gameplay state',()=>{
  const input=[cell(1),cell(2)],before=JSON.stringify(input),first=city.compile(atlas.createPlan(input));
  assert.deepEqual(first,city.compile(atlas.createPlan(input.slice().reverse())));assert.equal(JSON.stringify(input),before);
  assert.ok(first.data.features.every(f=>!('ownerId' in f.properties)&&!('canAct' in f.properties)&&!('version' in f.properties)));
  assert.deepEqual(first.data,city.compile(atlas.createPlan(input.map(f=>({...f,properties:{...f.properties,ownerId:'new-owner'}})))).data);
  assert.equal(city.compile(atlas.createPlan([])).stats.roofs,0);
});
test('world updates use native GeoJSON and keep one stable source through camera changes',async()=>{
  const h=harness();city.install(h.map,[cell()]);await turn();const source=h.sources.get('zone-city-atlas'),control=city.controller(h.map);
  assert.equal(source.type,'geojson');assert.equal(source.updates,1);assert.equal(h.layers.get('zone-buildings-3d').source,'zone-city-atlas');assert.equal(h.layers.get('zone-city-equipment-3d').source,'zone-city-atlas');
  assert.equal(h.layers.get('zone-buildings-3d').paint['fill-extrusion-opacity'],1);
  for(let i=0;i<30;i++){h.pitch(i%2?35:0);city.setPerspective(h.map,i%2);h.emit('move');h.emit('moveend');}
  assert.equal(h.sources.get('zone-city-atlas'),source);assert.equal(source.updates,1);assert.equal(h.repaints,0);assert.equal(h.listeners.has('move'),false);
  city.updateLabels(h.map,[{...cell(),properties:{districtId:'north',districtName:'الشمال'}}]);assert.equal(source.updates,1);assert.equal(h.sources.get('zone-city-districts').data.features[0].properties.name,'الشمال');
  assert.equal(control.diagnostics().status,'ready');assert.equal(control.diagnostics().visible,true);
  control.dispose();assert.equal(control.diagnostics().status,'uninstalled');
});
test('3D waits for a real native paint and hides cancel preparation without an error',async()=>{
  const h=harness();city.install(h.map,[cell()]);await turn();const control=city.controller(h.map);let ready=false;
  const first=control.whenReady().then(()=>{ready=true;});await turn();assert.equal(ready,false);assert.equal(h.repaints,1);h.emit('render');await first;assert.equal(ready,true);
  const pending=control.whenReady();await turn();control.setVisible(false);await pending;assert.equal(h.stops,1);assert.equal(h.listeners.get('render').size,0);control.dispose();
});
test('geometry replacement and teardown release source, layers and preparation listeners',async()=>{
  const h=harness();city.install(h.map,[cell()]);await turn();const control=city.controller(h.map),first=h.sources.get('zone-city-atlas');city.install(h.map,[cell(2)]);await turn();assert.notEqual(h.sources.get('zone-city-atlas'),first);
  const pending=control.whenReady();await turn();control.dispose();await assert.rejects(pending,/replaced/);assert.equal(h.sources.size,0);assert.equal(h.layers.size,2);assert.ok([...h.listeners.values()].every(set=>set.size===0));
});

test('concurrent preparation shares one paint and cleans all listeners on hide',async()=>{
  const h=harness();city.install(h.map,[cell()]);await turn();const control=city.controller(h.map);
  const a=control.whenReady(),b=control.whenReady();await turn();assert.equal(h.repaints,1);assert.equal(h.listeners.get('render').size,1);
  control.setVisible(false);await Promise.all([a,b]);assert.equal(h.listeners.get('render').size,0);control.dispose();
});

test('hidden source preparation can resume without rebuilding the world',async()=>{
  const h=harness();let loaded=false;h.map.isSourceLoaded=()=>loaded;city.install(h.map,[cell()]);await turn();const control=city.controller(h.map),source=h.sources.get('zone-city-atlas');
  control.setVisible(false);loaded=true;h.emit('sourcedata',{sourceId:'zone-city-atlas'});await turn();control.setVisible(true);
  const ready=control.whenReady();await turn();h.emit('render');await ready;assert.equal(h.sources.get('zone-city-atlas'),source);assert.equal(source.updates,1);control.dispose();
});
test('actual city worker builds the same geometry without DOM, canvas or WebGL',()=>{
  let result;const scope=vm.createContext({postMessage:value=>{result=value;}});scope.self=scope;
  scope.importScripts=(...urls)=>{for(const url of urls)vm.runInContext(readFileSync(new URL('../assets/city/'+url.split('?')[0],import.meta.url),'utf8'),scope);};
  vm.runInContext(readFileSync(new URL('../assets/city/native-city-worker.js',import.meta.url),'utf8'),scope);scope.self.onmessage({data:{features:[cell()]}});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),city.compile(atlas.createPlan([cell()])));assert.equal('document' in scope,false);
});

test('original artwork stays below real ownership and hides repeated roofs once across every camera change',async()=>{
  const h=harness(),layoutWrites=[],layerOrder=[];
  h.map.setLayoutProperty=(id,key,value)=>layoutWrites.push({id,key,value});
  h.map.addLayer=(layer,before)=>{h.layers.set(layer.id,layer);layerOrder.push({id:layer.id,before});};
  const scope=vm.createContext({ZoneCityAtlas:atlas,URL,setTimeout,clearTimeout,document:{currentScript:{src:'https://zone.test/assets/city/native-city.js?v=83'},body:{dataset:{}}}});
  vm.runInContext(readFileSync(new URL('../assets/city/native-city.js',import.meta.url),'utf8'),scope);
  scope.ZoneNativeCity.install(h.map,[cell()]);await turn();
  const art=h.sources.get('zone-city-original-art');
  assert.equal(art.type,'image');assert.equal(art.url,'https://zone.test/assets/city/zone-harbor-city-v83.webp');
  assert.equal(art.coordinates.length,4);assert.ok(art.coordinates.flat().every(Number.isFinite));
  assert.equal(layerOrder.find(l=>l.id==='zone-city-original-art').before,'zone-ownership-fill');
  assert.ok(layoutWrites.some(w=>w.id==='zone-city-buildings-overview'&&w.value==='none'));
  assert.ok(layoutWrites.some(w=>w.id==='zone-buildings-3d'&&w.value==='none'));
  assert.ok(layoutWrites.every(w=>!['zone-ownership-fill','zone-blocks-fill','zone-city-district-labels'].includes(w.id)));
  const count=layoutWrites.length;
  for(let i=0;i<40;i++){h.pitch(i%2?38:0);scope.ZoneNativeCity.setPerspective(h.map,i%2);}
  assert.equal(layoutWrites.length,count,'camera changes must not cause an idle/style repaint loop');
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).renderer,'original-city-art');
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).view,'tilted-art');
  scope.ZoneNativeCity.remove(h.map);assert.equal(h.sources.size,0);assert.equal(h.layers.size,2);
});

test('unavailable image does not hide local geometry and pending artwork listeners cancel cleanly',async()=>{
  const h=harness(),layoutWrites=[];
  h.map.setLayoutProperty=(...args)=>layoutWrites.push(args);
  h.map.isSourceLoaded=id=>id!=='zone-city-original-art';
  const scope=vm.createContext({ZoneCityAtlas:atlas,URL,setTimeout,clearTimeout,document:{currentScript:{src:'https://zone.test/assets/city/native-city.js?v=83'},body:{dataset:{}}}});
  vm.runInContext(readFileSync(new URL('../assets/city/native-city.js',import.meta.url),'utf8'),scope);
  scope.ZoneNativeCity.install(h.map,[cell()]);await turn();
  assert.equal(layoutWrites.length,0);assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).renderer,'native-city');
  scope.ZoneNativeCity.remove(h.map);await turn();assert.ok([...h.listeners.values()].every(set=>set.size===0));
});

test('loaded artwork becomes ready while its hidden native fallback remains unloaded',async()=>{
  const h=harness(),loaded=new Set(),timers=new Map();let timerId=0;
  h.map.setLayoutProperty=()=>{};
  h.map.isSourceLoaded=id=>loaded.has(id);
  const scope=vm.createContext({ZoneCityAtlas:atlas,URL,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),document:{currentScript:{src:'https://zone.test/assets/city/native-city.js?v=84'},body:{dataset:{zoneCityModelsError:'previous install error'}}}});
  vm.runInContext(readFileSync(new URL('../assets/city/native-city.js',import.meta.url),'utf8'),scope);
  scope.ZoneNativeCity.install(h.map,[cell()]);await turn();
  assert.equal(scope.document.body.dataset.zoneCityModelsError,undefined);
  let ready=false;const control=scope.ZoneNativeCity.controller(h.map),pending=control.whenReady().then(()=>{ready=true;});
  await turn();assert.equal(h.repaints,0,'readiness waits for delayed artwork');
  loaded.add('zone-city-original-art');h.emit('sourcedata',{sourceId:'zone-city-original-art'});await turn();
  assert.equal(loaded.has('zone-city-atlas'),false,'the native source remains unloaded exactly as in Chrome');
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).status,'ready');
  assert.equal(h.repaints,1);assert.equal(ready,false,'controls still wait for a real rendered frame');
  h.emit('render');await pending;assert.equal(ready,true);assert.equal(timers.size,0);
  assert.equal(scope.document.body.dataset.zoneCityModelsError,undefined);
  control.dispose();assert.ok([...h.listeners.values()].every(set=>set.size===0));
});

test('failed artwork still waits for loaded fallback geometry and a rendered frame',async()=>{
  const h=harness(),timers=new Map(),writes=[];let timerId=0,nativeLoaded=false;
  h.map.setLayoutProperty=(...args)=>writes.push(args);
  h.map.isSourceLoaded=id=>id==='zone-city-atlas'&&nativeLoaded;
  const scope=vm.createContext({ZoneCityAtlas:atlas,URL,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),document:{currentScript:{src:'https://zone.test/assets/city/native-city.js?v=84'},body:{dataset:{}}}});
  vm.runInContext(readFileSync(new URL('../assets/city/native-city.js',import.meta.url),'utf8'),scope);
  scope.ZoneNativeCity.install(h.map,[cell()]);await turn();
  let ready=false;const control=scope.ZoneNativeCity.controller(h.map),pending=control.whenReady().then(()=>{ready=true;});
  const artTimeout=[...timers.values()].find(timer=>timer.ms===10000);assert.ok(artTimeout);artTimeout.fn();await turn();
  assert.equal(h.repaints,0);assert.equal(ready,false);assert.equal(writes.length,0,'failed artwork must leave native geometry visible');
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).status,'loading');
  nativeLoaded=true;h.emit('sourcedata',{sourceId:'zone-city-atlas'});await turn();
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).status,'ready');assert.equal(h.repaints,1);
  h.emit('render');await pending;assert.equal(ready,true);assert.equal(timers.size,0);
  assert.equal(JSON.parse(scope.document.body.dataset.zoneCityModels).renderer,'native-city');
  control.dispose();assert.ok([...h.listeners.values()].every(set=>set.size===0));
});

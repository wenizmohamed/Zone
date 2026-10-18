import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const district=require('../assets/city/compact-district.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(value=>{resolve=value;});return{promise,resolve};};

function harness(loadSurfaces){
  const features=[{type:'Feature',properties:{providerId:'same-building',height:24,min_height:0,extrude:'true'},geometry:{type:'Polygon',coordinates:[[[1,2],[1.001,2],[1.001,2.001],[1,2]]]}}];
  const original=JSON.stringify(features),calls=[],listeners=new Map();
  const map={areTilesLoaded:()=>true,getSource:id=>id==='district-complete-buildings'?{serialize:()=>({data:{features}})}:undefined,stop:()=>calls.push('stop'),on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},off(event,fn){listeners.get(event)?.delete(fn);}};
  const controller=district.controller(map,{loadSurfaces});
  return{map,features,original,calls,controller,listeners,emit(event){for(const fn of [...(listeners.get(event)||[])])fn();}};
}

test('completed provider geometry installs one facade layer without a second fetch or mutating source data',async()=>{
  let loads=0,creates=0;const visibility=[];let supplied;
  const h=harness(async()=>{loads++;return{createDistrictSurfaces(map,features,options){creates++;supplied=features;assert.equal(map,h.map);assert.equal(options.isActive(),true);return{ready:Promise.resolve(),setVisible:value=>visibility.push(value),dispose(){}};}};});
  await h.controller.whenReady();await h.controller.whenReady();
  assert.equal(loads,1);assert.equal(creates,1);assert.equal(supplied,h.features);assert.equal(JSON.stringify(h.features),h.original);assert.deepEqual(visibility,[true]);
});

test('host visibility and disposal reach the facade layer exactly once',async()=>{
  let disposals=0;const visibility=[];
  const h=harness(async()=>({createDistrictSurfaces:()=>({ready:Promise.resolve(),setVisible:value=>visibility.push(value),dispose:()=>disposals++})}));
  h.controller.setVisible(false);await h.controller.whenReady();h.controller.setVisible(true);h.controller.dispose();h.controller.dispose();h.controller.setVisible(false);
  assert.deepEqual(visibility,[false,true]);assert.equal(disposals,1);assert.equal(h.calls.length,1);
});

test('a module resolving after page disposal cannot add a custom WebGL layer',async()=>{
  const loading=deferred();let creates=0;
  const h=harness(()=>loading.promise),pending=h.controller.whenReady();await flush();h.controller.dispose();loading.resolve({createDistrictSurfaces:()=>{creates++;}});await pending;assert.equal(creates,0);
});

test('a late completed surface controller is disposed instead of attaching to a retired page',async()=>{
  const creating=deferred();let disposals=0;
  const h=harness(async()=>({createDistrictSurfaces:()=>creating.promise})),pending=h.controller.whenReady();await flush();h.controller.dispose();creating.resolve({dispose:()=>disposals++,setVisible(){throw Error('Retired page received visibility');}});await pending;assert.equal(disposals,1);
});

test('missing optional facade module leaves native city and ordinary map readiness usable',async()=>{
  let attempts=0;const h=harness(async()=>{attempts++;throw Error('optional module unavailable');});
  await h.controller.whenReady();await h.controller.whenReady();assert.equal(attempts,1);assert.equal(JSON.stringify(h.features),h.original);h.controller.dispose();
});

test('an empty provider source never invents city features or starts a facade import',async()=>{
  let imports=0;const h=harness(async()=>{imports++;});h.features.length=0;await h.controller.whenReady();assert.equal(imports,0);h.controller.dispose();
});

test('style recovery replaces its removed facade controller once and detaches the recovery listener on page disposal',async()=>{
  let loads=0,disposals=0;
  const h=harness(async()=>{loads++;return{createDistrictSurfaces:()=>({diagnostics:{status:'ready'},ready:Promise.resolve(),setVisible(){},dispose(){disposals++;}})};});
  await h.controller.whenReady();h.emit('style.load');await h.controller.whenReady();await h.controller.whenReady();
  assert.equal(loads,2);assert.equal(disposals,1);h.controller.dispose();assert.equal(disposals,2);assert.equal(h.listeners.get('style.load').size,0);
});

test('explicit facade retry recovers a failed module without repeating source data requests or retrying gameplay',async()=>{
  let attempts=0;const generations=[];
  const h=harness(async generation=>{generations.push(generation);attempts++;if(attempts===1)throw Error('first optional import failed');return{createDistrictSurfaces:()=>({diagnostics:{status:'ready'},ready:Promise.resolve(),setVisible(){},dispose(){}})};});
  await h.controller.whenReady();await h.controller.whenReady();assert.equal(attempts,1);
  await h.controller.retrySurfaces();await h.controller.retrySurfaces();assert.equal(attempts,2);assert.deepEqual(generations,[0,1]);assert.equal(JSON.stringify(h.features),h.original);h.controller.dispose();
  const source=readFileSync(new URL('../assets/city/compact-district.js',import.meta.url),'utf8');assert.match(source,/\+'retry='\+generation/,'a rejected browser module URL needs a fresh explicit retry URL');
});

test('an old asynchronous facade import cannot attach to a replacement style generation',async()=>{
  const old=deferred();let attempts=0,oldCreates=0,newCreates=0;
  const h=harness(()=>++attempts===1?old.promise:Promise.resolve({createDistrictSurfaces:()=>{newCreates++;return{ready:Promise.resolve(),setVisible(){},dispose(){}};}}));
  const pending=h.controller.whenReady();await flush();h.emit('style.load');await h.controller.whenReady();
  old.resolve({createDistrictSurfaces:()=>{oldCreates++;}});await pending;assert.equal(oldCreates,0);assert.equal(newCreates,1);h.controller.dispose();
});

test('the opening camera requests 35-degree perspective while Full city respects the player-selected flat view',()=>{
  const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
  assert.match(html,/center:CENTER, zoom:Z, minZoom:13\.2, maxZoom:20, pitch:35, bearing:0/);
  const start=html.indexOf('  function fitCity('),end=html.indexOf('\n  var authoritativeOverviewFitted',start);
  assert.ok(start>=0&&end>start);
  for(const pitch of [0,35]){
    const calls=[],blocks=[{id:'retained-authoritative-block'}];
    const scope=vm.createContext({didFit:false,RM:true,CAMERA_MS:180,map:{getContainer:()=>({clientWidth:788,clientHeight:434}),getPitch:()=>pitch},setCityOverview:()=>{},fitOwnership:(list,duration,actualPitch,bearing)=>{calls.push({list,duration,pitch:actualPitch,bearing});return true;}});
    vm.runInContext(html.slice(start,end),scope);scope.fitCity(blocks,true);
    assert.equal(calls.length,1);assert.equal(calls[0].list,blocks);assert.equal(calls[0].pitch,pitch);assert.equal(calls[0].bearing,0);assert.equal(scope.didFit,true);
  }
});

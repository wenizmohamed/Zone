import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(import.meta.url),district=require('../assets/city/compact-district.js');
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../assets/city/compact-district.js',import.meta.url),'utf8');
const fetchError=()=>new TypeError('Failed to fetch dynamically imported module: https://zone.test/dist/district-landmarks.js?v=115');
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

function harness(failures=1){
  const tasks=new Map(),states=[],urls=[];let sequence=0,active=true,landmarkLoads=0,surfaceLoads=0,controller,retries=0;
  assert.equal(typeof district.createModuleRetry,'function','module fetch failures need one bounded in-place retry owner');
  const retry=district.createModuleRetry({isActive:()=>active,setTimeout(fn,ms){assert.equal(ms,0);tasks.set(++sequence,fn);return sequence;},clearTimeout:id=>tasks.delete(id),onState:value=>states.push(value),
    retry(){retries++;return Promise.allSettled([Promise.resolve().then(()=>controller.retrySurfaces()),Promise.resolve().then(()=>controller.retryLandmarks())]);}});
  const scope=vm.createContext({URL,Promise,console,setTimeout,clearTimeout,document:{currentScript:{src:'https://zone.test/assets/city/compact-district.js?v=115'},body:{dataset:{}},documentElement:{lang:'en'},getElementById:()=>null},
    loadLandmark115:async url=>{urls.push(url);if(++landmarkLoads<=failures)throw fetchError();return{createLandmarks:async()=>({diagnostics:{status:'ready'},setVisible(){},dispose(){}})};}});
  vm.runInContext(source.replaceAll('import(landmarkModuleUrl)','loadLandmark115(landmarkModuleUrl)'),scope);
  const features=[{type:'Feature',properties:{height:20},geometry:{type:'Polygon',coordinates:[]}}],map={areTilesLoaded:()=>true,getSource:()=>({serialize:()=>({data:{features}})}),on(){},off(){},getLayer:()=>null,fire(){},stop(){}};
  controller=scope.ZoneCompactDistrict.controller(map,{onModuleFetchFailure:error=>retry.handle(error),loadSurfaces:async()=>{if(++surfaceLoads<=failures)throw fetchError();return{createDistrictSurfaces:()=>({diagnostics:{status:'ready'},ready:Promise.resolve(),setVisible(){},dispose(){}})};}});
  controller.setDestinations([{id:'gym',_lngLat:[-73.986,40.698]}]);
  return{controller,retry,tasks,states,urls,scope,get counts(){return{landmarkLoads,surfaceLoads,retries};},async run(){for(const[id,fn]of[...tasks]){tasks.delete(id);await fn();}await flush();},dispose(){active=false;retry.dispose();controller.dispose();}};
}

test('native Retry overrides the passive notice hit target and the map loads its changed controller at115',()=>{
  assert.match(html,/\.districtDetailStatus\s*\{[^}]*pointer-events\s*:\s*none/);
  assert.match(html,/<button\b[^>]*id="districtSurfaceRetry111"[^>]*pointer-events:auto/);
  assert.match(html,/<script src="\.\.\/assets\/city\/compact-district\.js\?v=118"><\/script>/);
});

test('parallel real facade/sign import failures coalesce into one zero-delay retry of their existing APIs',async()=>{
  const h=harness();await assert.rejects(h.controller.whenReady(),/Failed to fetch dynamically imported module/);await flush();
  assert.deepEqual(h.counts,{landmarkLoads:1,surfaceLoads:1,retries:0});assert.equal(h.tasks.size,1);
  assert.equal(h.retry.isPending(),true);
  assert.equal(h.retry.isAttempted(),false);
  assert.equal(h.retry.isDisposed(),false);
  await h.run();await h.controller.whenReady();
  assert.equal(h.retry.isPending(),false);
  assert.equal(h.retry.isAttempted(),true);
  assert.deepEqual(h.counts,{landmarkLoads:2,surfaceLoads:2,retries:1});assert.equal(h.tasks.size,0);
  assert.match(h.urls[1],/[?&]retry=1/);assert.equal(JSON.parse(h.scope.document.body.dataset.zoneDistrictLandmarks).status,'ready');
  assert.equal(h.retry.handle(fetchError()),false);assert.equal(h.tasks.size,0);h.dispose();
  assert.equal(h.retry.isDisposed(),true);
});

test('a second import failure cannot auto-loop, and the actual native Retry recovers on the third import',async()=>{
  const h=harness(2);await assert.rejects(h.controller.whenReady());await flush();await h.run();
  assert.deepEqual(h.counts,{landmarkLoads:2,surfaceLoads:2,retries:1});assert.equal(h.tasks.size,0);
  const button={disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}};
  const from=html.indexOf("  document.getElementById('districtSurfaceRetry111').onclick="),to=html.indexOf('  function installCustomLayers(',from);
  const scope=vm.createContext({Promise,mapDisposed:false,landmarkController:h.controller,document:{getElementById:()=>button}});vm.runInContext(html.slice(from,to),scope);
  await button.onclick.call(button);await h.controller.whenReady();
  assert.deepEqual(h.counts,{landmarkLoads:3,surfaceLoads:3,retries:1});assert.match(h.urls[2],/[?&]retry=2/);
  assert.equal(button.disabled,false);assert.equal(button.attributes['aria-busy'],undefined);assert.equal(h.tasks.size,0);h.dispose();
});

test('dispose cancels the queued task and even a retained stale callback cannot retry or publish later',async()=>{
  const h=harness();await assert.rejects(h.controller.whenReady());await flush();const stale=[...h.tasks.values()][0],before=h.states.length;
  h.dispose();assert.equal(h.tasks.size,0);await stale();await flush();
  assert.equal(h.counts.retries,0);assert.equal(h.states.length,before);assert.equal(h.retry.handle(fetchError()),false);
});

test('shader, geometry and generic network failures do not get an automatic module retry',()=>{
  assert.equal(typeof district.createModuleRetry,'function');let scheduled=0;
  const retry=district.createModuleRetry({retry(){throw Error('not a module fetch failure');},setTimeout(){scheduled++;return scheduled;},clearTimeout(){}});
  for(const error of [new Error('Landmark shader link failed'),new TypeError('Facade readiness contract differs'),new Error('Provider coordinate budget exceeded'),new TypeError('Failed to fetch'),new Error(fetchError().message)])assert.equal(retry.handle(error),false);
  assert.equal(scheduled,0);retry.dispose();
});

test('the actual iframe wires its current controller and normal page disposal to the bounded owner',async()=>{
  const calls=[],button={setAttribute(){},removeAttribute(){}};let options;
  const scope=vm.createContext({Promise,mapDisposed:false,landmarkController:null,landmarkVisibleState:null,pinData:[],territoryData:[],territoryGeo:()=>({features:[]}),syncLandmarkVisibility(){},
    map:{isStyleLoaded:()=>true},mapModuleRetry:{handle:error=>calls.push(error)},document:{getElementById:()=>button},ZoneCompactDistrict:{controller(_map,value){options=value;return{setDestinations(){},setTerritories(){}};}}});
  const from=html.indexOf('  function ensureCityLandmarks('),to=html.indexOf('  function installCustomLayers(',from);vm.runInContext(html.slice(from,to),scope);scope.ensureCityLandmarks();
  const error=fetchError();options.onModuleFetchFailure(error);assert.equal(calls[0],error);
  assert.match(html,/if\(typeof mapModuleRetry==='object'\)mapModuleRetry\.dispose\(\)/);
  assert.doesNotMatch(html,/zoneMapRecovery|zoneMapView|ZONE_MAP_RECOVER|mapRecoverySequence|recoveryCamera/);
  assert.doesNotMatch(source,/createModuleRecovery|location\.replace|options\.navigate/);
  const start=html.indexOf('  var mapModuleRetry='),end=html.indexOf('  map.addControl(',start),apis=[];
  assert.ok(start>=0&&end>start);
  const owner=vm.createContext({Promise,mapDisposed:false,landmarkController:{retrySurfaces(){apis.push('surfaces');},retryLandmarks(){apis.push('signs');}},document:{body:{dataset:{}}},ZoneCompactDistrict:{createModuleRetry:value=>value}});
  vm.runInContext(html.slice(start,end),owner);await owner.mapModuleRetry.retry();assert.deepEqual(apis,['surfaces','signs']);
  owner.mapDisposed=true;await owner.mapModuleRetry.retry();assert.deepEqual(apis,['surfaces','signs']);
});

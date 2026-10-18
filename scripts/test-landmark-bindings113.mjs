import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Only the dynamic module import is replaced. The shipped controller, loading
// order, destination changes and disposal run unchanged. No GPU/pixel claim.
const source=readFileSync(new URL('../assets/city/compact-district.js',import.meta.url),'utf8').replaceAll('import(landmarkModuleUrl)','loadLandmarkModule113(landmarkModuleUrl)');
const pin=(x=1,height=12)=>({id:'gym',label:'Gym',_lngLat:[x,2],_buildingAssociation:{providerId:'building-'+x,heightMeters:height,clearanceMeters:4,insideRoof:true}});
function harness({deferFirst=false,failLoads=0,reportedStatus='ready'}={}){
  const created=[],events=[],listeners=new Map(),layers=new Set(),urls=[];let finishFirst,loads=0;
  const module={async createLandmarks(_map,pins,isActive){
    const record={pins:structuredClone(pins),active:isActive,disposed:0,visible:[]};created.push(record);
    layers.add('zone-authored-landmarks');
    if(deferFirst&&created.length===1)await new Promise(resolve=>finishFirst=resolve);
    const handle={diagnostics:{status:reportedStatus,landmarks:pins.map(p=>({id:p.id,heightMeters:p._buildingAssociation.heightMeters+1,symbolOffset:2}))},dispose(){record.disposed++;layers.delete('zone-authored-landmarks');},setVisible(value){record.visible.push(value);}};record.handle=handle;return handle;
  }};
  const scope=vm.createContext({URL,Promise,console,setTimeout,clearTimeout,document:{currentScript:{src:'https://zone.test/assets/city/compact-district.js?v=113'},body:{dataset:{}}},loadLandmarkModule113:async url=>{urls.push(url);if(++loads<=failLoads)throw Error('optional sign import failed');return module;}});
  vm.runInContext(source,scope);
  const map={areTilesLoaded:()=>true,getSource:()=>null,getLayer:id=>layers.has(id)?{id}:null,on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},off(name,fn){listeners.get(name)?.delete(fn);},fire(name){events.push(name);},triggerRepaint(){},stop(){}};
  const controller=scope.ZoneCompactDistrict.controller(map);
  return {controller,created,events,listeners,layers,urls,scope,get loads(){return loads;},finish:()=>finishFirst?.(),emit(name){for(const fn of listeners.get(name)||[])fn();}};
}

test('changed service coordinates or roof height rebuild its existing sign, but translated redraws reuse it',async()=>{
  const h=harness();h.controller.setDestinations([pin()]);await h.controller.whenReady();assert.equal(h.created.length,1);
  h.controller.setDestinations([{...pin(),label:'النادي'}]);await h.controller.whenReady();assert.equal(h.created.length,1,'language is not a different building');
  h.controller.setDestinations([pin(3)]);await h.controller.whenReady();assert.equal(h.created.length,2,'the old roof sign must not remain at the old icon');assert.equal(h.created[0].disposed,1);assert.equal(h.created[0].active(),false);assert.equal(h.created[1].pins[0]._lngLat[0],3);
  h.controller.setDestinations([pin(3,24)]);await h.controller.whenReady();assert.equal(h.created.length,3);assert.equal(h.created[1].disposed,1);assert.equal(h.created[2].pins[0]._buildingAssociation.heightMeters,24);h.controller.dispose();
});

test('in-flight old sign preparation settles and disposes before the new building is installed',async()=>{
  const h=harness({deferFirst:true});h.controller.setDestinations([pin()]);const first=h.controller.whenReady();
  for(let i=0;i<15&&h.created.length===0;i++)await Promise.resolve();assert.equal(h.created.length,1);
  h.controller.setDestinations([pin(4)]);const latest=h.controller.whenReady();
  for(let i=0;i<10;i++)await Promise.resolve();assert.equal(h.created.length,1,'one shared custom-layer owner at a time');
  h.finish();await Promise.all([first,latest]);assert.equal(h.created.length,2);assert.equal(h.created[0].disposed,1);assert.equal(h.created[0].active(),false);assert.equal(h.created[1].pins[0]._lngLat[0],4);h.controller.dispose();
});

test('removing destinations retires the old sign without creating an invented building',async()=>{
  const h=harness();h.controller.setDestinations([pin()]);await h.controller.whenReady();h.controller.setDestinations([]);await h.controller.whenReady();
  assert.equal(h.created.length,1);assert.equal(h.created[0].disposed,1);assert.equal(h.controller.destinationHeight('gym'),0);h.controller.dispose();
});

test('a lost custom sign layer is rebuilt after style reload and recovery listeners leave with the page',async()=>{
  const h=harness();h.controller.setDestinations([pin()]);await h.controller.whenReady();assert.equal(h.created.length,1);
  h.layers.clear();h.emit('style.load');await h.controller.whenReady();assert.equal(h.created.length,2,'a resolved old promise is not a restored sign layer');assert.equal(h.layers.has('zone-authored-landmarks'),true);
  h.emit('style.load');await h.controller.whenReady();assert.equal(h.created.length,2,'an intact layer must not be rebuilt by an unrelated style event');
  h.controller.dispose();assert.ok([...h.listeners.values()].every(set=>set.size===0));
});

test('same-building idle redraws do not repeatedly import failed optional signs; an explicit retry recovers',async()=>{
  const h=harness({failLoads:1});h.controller.setDestinations([pin()]);await assert.rejects(h.controller.whenReady(),/optional sign import failed/);assert.equal(h.loads,1);
  for(let i=0;i<5;i++){h.controller.setDestinations([{...pin(),label:i%2?'النادي':'Gym'}]);await assert.rejects(h.controller.whenReady(),/optional sign import failed/);}
  assert.equal(h.loads,1,'idle and language changes are not permission for an unbounded import loop');
  assert.equal(JSON.parse(h.scope.document.body.dataset.zoneDistrictLandmarks).status,'failed');
  await h.controller.retryLandmarks();assert.equal(h.loads,2);assert.equal(h.created.length,1);assert.notEqual(h.urls[0],h.urls[1],'explicit retry must escape a cached rejected module URL');assert.equal(JSON.parse(h.scope.document.body.dataset.zoneDistrictLandmarks).status,'ready');h.controller.dispose();
});

test('style removal during preparation serializes the stale owner before its replacement',async()=>{
  const h=harness({deferFirst:true});h.controller.setDestinations([pin()]);const first=h.controller.whenReady();
  for(let i=0;i<15&&h.created.length===0;i++)await Promise.resolve();assert.equal(h.created.length,1);
  h.layers.clear();h.emit('style.load');const latest=h.controller.whenReady();for(let i=0;i<10;i++)await Promise.resolve();assert.equal(h.created.length,1);
  h.finish();await Promise.all([first,latest]);assert.equal(h.created.length,2);assert.equal(h.created[0].disposed,1);assert.equal(h.created[0].active(),false);assert.equal(h.layers.has('zone-authored-landmarks'),true);h.controller.dispose();
});

test('a real changed building can recover a failed import without inheriting the previous failure latch',async()=>{
  const h=harness({failLoads:1});h.controller.setDestinations([pin()]);await assert.rejects(h.controller.whenReady(),/optional sign import failed/);
  h.controller.setDestinations([pin(5)]);await h.controller.whenReady();assert.equal(h.loads,2);assert.notEqual(h.urls[0],h.urls[1]);assert.equal(h.created[0].pins[0]._lngLat[0],5);h.controller.dispose();
});

test('the real Retry detail button retries both optional details and restores usability after either failure',async()=>{
  const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8'),from=html.indexOf("  document.getElementById('districtSurfaceRetry111').onclick="),end=html.indexOf('  function installCustomLayers(',from);
  const button={disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}},calls=[];
  const scope=vm.createContext({Promise,mapDisposed:false,document:{getElementById:()=>button},landmarkController:{retrySurfaces(){calls.push('surfaces');throw Error('surface unavailable');},retryLandmarks(){calls.push('signs');return Promise.resolve();}}});
  vm.runInContext(html.slice(from,end),scope);const pending=button.onclick.call(button);assert.equal(button.disabled,true);assert.equal(button.attributes['aria-busy'],'true');
  const result=await pending;assert.deepEqual(calls,['surfaces','signs']);assert.equal(result[0].status,'rejected');assert.equal(result[1].status,'fulfilled');assert.equal(button.disabled,false);assert.equal(button.attributes['aria-busy'],undefined);
});

test('ready signs cannot conceal either a facade import failure or a post-ready render error',async()=>{
  for(const status of ['failed','error']){
    const h=harness(),notice={hidden:false},message={textContent:''};h.scope.document.getElementById=id=>id==='districtSurfaceStatus111'?notice:message;
    h.scope.document.body.dataset.zoneDistrictSurfaces=JSON.stringify({status});h.controller.setDestinations([pin()]);await h.controller.whenReady();
    assert.equal(notice.hidden,false,'facade '+status+' must retain its usable recovery action');h.controller.dispose();
  }
});

test('an unsuccessful sign controller cannot be relabeled ready by its integration owner',async()=>{
  for(const reportedStatus of ['failed','error','cancelled','disposed']){
    const h=harness({reportedStatus});h.controller.setDestinations([pin()]);await assert.rejects(h.controller.whenReady(),/sign.*ready|sign.*preparation/i);
    assert.equal(h.created[0].disposed,1);assert.equal(JSON.parse(h.scope.document.body.dataset.zoneDistrictLandmarks).status,'failed');h.controller.dispose();
  }
});

test('a sign draw failure after preparation permits an explicit recovery instead of reusing the failed handle',async()=>{
  const h=harness();h.controller.setDestinations([pin()]);await h.controller.whenReady();h.created[0].handle.diagnostics.status='failed';h.layers.clear();
  await h.controller.retryLandmarks();assert.equal(h.created.length,2);assert.equal(h.created[0].disposed,1);assert.equal(h.created[1].handle.diagnostics.status,'ready');h.controller.dispose();
});

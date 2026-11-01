import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {PbfWriter} from '../assets/city/vendor/pbf.mjs';
// Resolve the actual browser ES module's two relative canonical imports without
// changing the application's CommonJS package mode or suppressing Node warnings.
const helperURL=new URL('../assets/city/district-buildings.js',import.meta.url),helperSource=readFileSync(helperURL,'utf8').replace(/from '(\.\/vendor\/[^']+)'/g,(_match,path)=>"from '"+new URL(path,helperURL).href+"'");
const {LIMITS,SOURCE,FILL,EXTRUSION,BUILDING_PAINT,buildingLimits,buildingLayerIds,buildingLayerCount,defaultSourceZoom,maxTileBudget,maxTileConcurrency,buildingSourceId,isBuildingLayerId,isWithinBuildingLimits,planTiles,decodeTile,summarizeDecodedFeatures,summarizePlanTiles,createDistrictBuildings}=await import('data:text/javascript;base64,'+Buffer.from(helperSource).toString('base64'));
const require=createRequire(import.meta.url),district=require('../assets/city/compact-district.js');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/map-public-ownership-20261010.json',import.meta.url),'utf8'));
const original=JSON.stringify(fixture.blocks),projection=district.createProjection(fixture.blocks.flatMap(b=>b.polygon)),bounds=projection.bounds;
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};

// Synthetic test-only MVT written through the actual canonical protobuf writer.
// No provider data is persisted by this fixture or by the application.
function encodedTile(features=[{id:201,properties:{height:95,min_height:0,extrude:'false',type:'building'},rings:[[[100,100],[900,100],[900,900],[100,900]],[[300,300],[300,500],[500,500],[500,300]]]},{id:202,properties:{height:95,min_height:40,extrude:'true',type:'building:part'},rings:[[[100,100],[900,100],[900,900],[100,900]],[[2000,2000],[2500,2000],[2500,2500],[2000,2500]]]}]){
  const keys=[...new Set(features.flatMap(f=>Object.keys(f.properties)))],values=[];
  function valueIndex(value){let index=values.findIndex(v=>v===value);if(index===-1){index=values.length;values.push(value);}return index;}
  const specs=features.map(f=>{const tags=Object.entries(f.properties).flatMap(([k,v])=>[keys.indexOf(k),valueIndex(v)]),commands=[];let x=0,y=0;
    const zig=n=>n<0?-n*2-1:n*2;for(const ring of f.rings){commands.push(9,zig(ring[0][0]-x),zig(ring[0][1]-y));[x,y]=ring[0];commands.push((ring.length-1)*8+2);for(const p of ring.slice(1)){commands.push(zig(p[0]-x),zig(p[1]-y));[x,y]=p;}commands.push(15);}return {...f,tags,commands};});
  const pbf=new PbfWriter();pbf.writeMessage(3,(_object,layer)=>{
    layer.writeVarintField(15,2);layer.writeStringField(1,'building');layer.writeVarintField(5,4096);
    for(const f of specs)layer.writeMessage(2,(feature,w)=>{w.writeVarintField(1,feature.id);w.writePackedVarint(2,feature.tags);w.writeVarintField(3,3);w.writePackedVarint(4,feature.commands);},f);
    for(const k of keys)layer.writeStringField(3,k);
    for(const v of values)layer.writeMessage(4,(value,w)=>typeof value==='number'?w.writeDoubleField(3,value):w.writeStringField(1,value),v);
  },null);return pbf.finish();
}
const bytes=encodedTile();
function harness({zoom=15.1,pitch=0,loaded=true,language='en'}={}){
  const layers=new Map(district.createStyle().layers.map(l=>[l.id,structuredClone(l)])),sources=new Map(),listeners=new Map(),notice={hidden:true,dataset:{},textContent:''},document={body:{dataset:{}},documentElement:{lang:language},getElementById:()=>notice},calls={sources:0,layers:0,requests:[],maxConcurrent:0,concurrent:0,repaints:0};
  const map={getZoom:()=>zoom,getPitch:()=>pitch,getLayer:id=>layers.get(id),getStyle:()=>({layers:[...layers.values()]}),getSource:id=>sources.get(id),isStyleLoaded:()=>true,isSourceLoaded:()=>loaded,setLayerZoomRange(id,min,max){layers.get(id).minzoom=min;layers.get(id).maxzoom=max;},addSource(id,source){calls.sources++;sources.set(id,source);},addLayer(layer,before){calls.layers++;if(!before){layers.set(layer.id,layer);return;}assert.ok(layers.has(before),'Mapbox insertion target exists');const ordered=[...layers];layers.clear();for(const [id,value]of ordered){if(id===before)layers.set(layer.id,layer);layers.set(id,value);}},removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),triggerRepaint(){calls.repaints++;},on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},off(event,fn){listeners.get(event)?.delete(fn);}};
  function emit(event,data){for(const fn of [...(listeners.get(event)||[])])fn(data);}
  const fetch=async(url,options)=>{calls.requests.push({url,options});calls.concurrent++;calls.maxConcurrent=Math.max(calls.maxConcurrent,calls.concurrent);await Promise.resolve();calls.concurrent--;return new Response(bytes);};
  return {map,layers,sources,listeners,notice,document,calls,fetch,emit,setZoom(value){zoom=value;},setPitch(value){pitch=value;},setLoaded(value){loaded=value;},stats:()=>JSON.parse(document.body.dataset.zoneDistrictBuildings)};
}

test('all120 actual server parcels select exactly4 z16 detail tiles without mutating gameplay data',()=>{
  const plan=planTiles(bounds);assert.equal(plan.length,4);assert.equal(new Set(plan.map(p=>p.z+'/'+p.x+'/'+p.y)).size,4);assert.ok(plan.every(p=>p.z===16));assert.equal(JSON.stringify(fixture.blocks),original);assert.equal(fixture.blocks.length,120);
  const tileSummary=summarizePlanTiles(plan);assert.equal(tileSummary.tileCount,4);assert.equal(tileSummary.uniqueTileCount,4);assert.deepEqual(tileSummary.zooms,[16]);
});
test('planner rejects invalid, broad and degenerate geometry before any provider request',()=>{
  for(const value of [null,[[0,0],[0,1]],[[NaN,0],[1,1]],[[-181,0],[1,1]],[[-74,40],[-73,41]]])assert.throws(()=>planTiles(value));
  assert.equal(LIMITS.maxTiles,9);assert.equal(LIMITS.concurrency,2);assert.equal(LIMITS.maxTileBytes,1048576);assert.equal(LIMITS.maxBytes,4194304);
  assert.deepEqual(buildingLimits(),LIMITS);
  assert.deepEqual(buildingLayerIds(),[FILL,EXTRUSION]);
});
test('actual canonical MVT decoder preserves holes, multipolygons, raised-part heights and provider identity',()=>{
  const features=decodeTile(bytes,planTiles(bounds)[0]);assert.equal(features.length,2);assert.equal(features[0].geometry.type,'Polygon');assert.equal(features[0].geometry.coordinates.length,2);assert.equal(features[1].geometry.type,'MultiPolygon');assert.equal(features[1].geometry.coordinates.length,2);
  assert.deepEqual([features[1].properties.height,features[1].properties.min_height,features[1].properties.extrude],[95,40,'true']);assert.equal(features[0].properties.providerId,'201');assert.match(features[0].id,/16\/\d+\/\d+\/201/);
  assert.ok(features.flatMap(f=>f.geometry.coordinates.flat(3)).every(Number.isFinite));
});
test('all4 tiles load with concurrency2 and publish exactly once only after actual source readiness',async()=>{
  const h=harness({loaded:false}),loader=createDistrictBuildings(h.map,bounds,'public-test-token',{fetch:h.fetch,document:h.document});
  await new Promise(r=>setImmediate(r));assert.equal(h.calls.requests.length,4);assert.equal(h.calls.maxConcurrent,2);assert.equal(h.stats().loadedTiles,4);assert.equal(h.stats().status,'loading');assert.equal(h.stats().stage,'rendering');assert.equal(h.stats().complete,false);assert.equal(h.calls.sources,1);
  h.setLoaded(true);h.emit('idle');await loader.ready;
  const stats=h.stats();assert.equal(stats.status,'ready');assert.equal(stats.complete,true);assert.equal(loader.isReady(),true);assert.equal(loader.isDegraded(),false);assert.equal(loader.loadedTileCount(),4);assert.equal(loader.expectedTileCount(),4);assert.equal(isWithinBuildingLimits(stats),true);assert.equal(stats.expectedTiles,4);assert.equal(stats.loadedTiles,4);assert.equal(stats.features,8);assert.equal(stats.extrudableFeatures,4);assert.equal(stats.raisedParts,4);assert.equal(stats.collapsedRaisedParts,0);assert.equal(h.notice.hidden,true);assert.equal(h.calls.sources,1);assert.equal(h.calls.layers,2);assert.equal(h.sources.get(SOURCE).data.features.length,8);
  assert.equal(h.calls.requests[0].options.credentials,'omit');assert.ok(h.calls.requests.every(r=>r.url.startsWith('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/16/')));loader.dispose();
});
test('beta102 native tile loading cannot churn source zoom ranges or invalidate GPU buckets while preserving all decoded geometry',async()=>{
  const h=harness({zoom:17.4,pitch:35});let nativeReady=false;
  h.map.isSourceLoaded=id=>id==='district-streets'?nativeReady:true;
  const loader=createDistrictBuildings(h.map,bounds,'token',{fetch:h.fetch,document:h.document});await loader.ready;
  assert.equal(h.stats().status,'ready');assert.equal(h.stats().complete,true);assert.equal(h.stats().maximumHeight,95,'the camera envelope uses the real highest extrudable part');
  assert.equal(h.stats().activeLOD,'native-provider');
  assert.equal(h.layers.get(FILL).maxzoom,16);assert.equal(h.layers.get(EXTRUSION).maxzoom,16);assert.equal(h.layers.get('district-buildings-3d').minzoom,16);
  let writes=0,range=h.map.setLayerZoomRange;h.map.setLayerZoomRange=(...args)=>{writes++;range(...args);};
  const geometry=JSON.stringify(h.sources.get(SOURCE).data);for(let i=0;i<8;i++)h.emit('idle');assert.equal(JSON.stringify(h.sources.get(SOURCE).data),geometry);
  nativeReady=true;h.emit('sourcedata',{sourceId:'district-streets'});
  assert.equal(h.stats().activeLOD,'native-provider');assert.equal(h.layers.get(EXTRUSION).maxzoom,16);assert.equal(h.layers.get('district-buildings-3d').minzoom,16);
  nativeReady=false;h.emit('moveend');assert.equal(h.stats().activeLOD,'native-provider');assert.equal(h.layers.get(EXTRUSION).maxzoom,16);assert.equal(writes,0,'sourcedata/idle/moveend must not toggle layout ranges and perpetually reload provider buckets');
  assert.equal(h.calls.requests.length,4);assert.equal(JSON.stringify(h.sources.get(SOURCE).data),geometry,'LOD continuity changes no provider polygon, part base or height');loader.dispose();
});
test('a delayed fourth tile cannot publish a partial district or claim completion',async()=>{
  const h=harness(),last=deferred();let count=0;
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:async()=>++count===4?last.promise:new Response(bytes)});
  await new Promise(r=>setImmediate(r));assert.equal(h.stats().loadedTiles,3);assert.equal(h.sources.has(SOURCE),false);assert.equal(h.stats().complete,false);assert.equal(h.layers.get('district-buildings').minzoom,14);
  last.resolve(new Response(bytes));await loader.ready;assert.equal(h.stats().loadedTiles,4);assert.equal(h.sources.has(SOURCE),true);loader.dispose();
});
test('unrelated style sources still loading cannot starve complete district installation or its readiness deadline',async()=>{
  const h=harness({loaded:false});h.map.isStyleLoaded=()=>false;
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});await new Promise(r=>setImmediate(r));
  assert.equal(h.stats().loadedTiles,4);assert.equal(h.sources.has(SOURCE),true,'the native style exists even when unrelated sources are still loading');assert.equal(h.stats().status,'loading');
  h.setLoaded(true);h.emit('sourcedata',{sourceId:'unrelated-source'});assert.equal(h.stats().status,'loading');h.emit('sourcedata',{sourceId:SOURCE});await loader.ready;
  assert.equal(h.stats().status,'ready');assert.equal(h.stats().complete,true);assert.equal(h.calls.sources,1);loader.dispose();
});
test('a temporarily absent native style retries installation at idle instead of staying permanently loading',async()=>{
  const h=harness(),native=h.layers.get('district-buildings');h.layers.delete('district-buildings');
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});await new Promise(r=>setImmediate(r));assert.equal(h.sources.has(SOURCE),false);
  h.layers.set('district-buildings',native);h.emit('idle');await loader.ready;assert.equal(h.stats().status,'ready');assert.equal(h.sources.has(SOURCE),true);assert.equal(h.calls.requests.length,4);loader.dispose();
});
test('an unavailable native style still expires its render deadline instead of creating an endless loading state',async()=>{
  const h=harness();h.layers.delete('district-buildings');const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch,limits:{timeoutMs:10}});await loader.ready;
  assert.equal(h.stats().status,'degraded');assert.equal(h.stats().stage,'render-timeout');assert.equal(h.stats().complete,false);loader.dispose();
});
test('extrusion install failure during style recovery rolls back partial geometry and stays degraded through idle',async()=>{
  const h=harness(),native=h.layers.get('district-buildings'),originalAdd=h.map.addLayer;h.layers.delete('district-buildings');
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});
  try{await new Promise(r=>setImmediate(r));h.layers.set('district-buildings',native);h.map.addLayer=layer=>{if(layer.id===EXTRUSION)throw Error('forced extrusion installation failure');originalAdd(layer);};h.emit('style.load');
    assert.equal(h.stats().status,'degraded');assert.equal(h.stats().stage,'render-failed');assert.equal(h.stats().complete,false);assert.equal(h.sources.has(SOURCE),false);assert.equal(h.layers.has(FILL),false);assert.equal(h.layers.has(EXTRUSION),false);assert.equal(h.layers.get('district-buildings').minzoom,14);
    for(let i=0;i<5;i++){h.emit('idle');h.emit('sourcedata',{sourceId:SOURCE});}await loader.ready;
    assert.equal(h.stats().status,'degraded');assert.equal(h.stats().complete,false);assert.equal(h.notice.hidden,false);assert.equal(h.layers.get('district-buildings').minzoom,14);assert.equal(h.calls.requests.length,4);
    h.map.addLayer=originalAdd;loader.ensure();assert.equal(h.stats().status,'ready');assert.equal(h.stats().complete,true);assert.equal(h.layers.has(FILL),true);assert.equal(h.layers.has(EXTRUSION),true);assert.equal(h.layers.get('district-buildings').minzoom,16);assert.equal(h.notice.hidden,true);assert.equal(h.calls.requests.length,4);
  }finally{loader.dispose();}
});
test('failed native LOD range commit cannot report readiness or leave overlapping overview layers',async()=>{
  const h=harness(),originalRange=h.map.setLayerZoomRange;h.map.setLayerZoomRange=(id,min,max)=>{if(id==='district-buildings'&&min===16)throw Error('forced native range failure');originalRange(id,min,max);};
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});try{await loader.ready;h.emit('idle');assert.equal(h.stats().status,'degraded');assert.equal(h.stats().complete,false);assert.equal(h.sources.has(SOURCE),false);assert.equal(h.layers.has(FILL),false);assert.equal(h.layers.has(EXTRUSION),false);assert.equal(h.layers.get('district-buildings').minzoom,14);assert.equal(h.notice.hidden,false);}finally{loader.dispose();}
});
test('synchronous source events cannot mark a transaction ready before both geometry layers are installed',async()=>{
  const h=harness(),originalSource=h.map.addSource;let duringSource;
  h.map.addSource=(id,spec)=>{originalSource(id,spec);h.emit('sourcedata',{sourceId:id});duringSource=h.stats();};
  const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});try{await loader.ready;assert.equal(duringSource.complete,false);assert.notEqual(duringSource.status,'ready');assert.equal(h.stats().status,'ready');assert.equal(h.layers.has(FILL),true);assert.equal(h.layers.has(EXTRUSION),true);}finally{loader.dispose();}
});
test('neighboring provider fragments are retained with unique IDs instead of losing boundary buildings',async()=>{
  const h=harness(),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});await loader.ready;
  const features=h.sources.get(SOURCE).data.features;assert.equal(new Set(features.map(f=>f.id)).size,8);assert.equal(features.filter(f=>f.properties.providerId==='201').length,4);assert.equal(new Set(features.map(f=>f.properties.providerTile)).size,4);loader.dispose();
});
test('overview and native close-detail layer ranges meet at16 with no duplicate LOD overlap',async()=>{
  const h=harness(),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});await loader.ready;
  assert.equal(h.layers.get(FILL).maxzoom,16);assert.equal(h.layers.get(EXTRUSION).maxzoom,16);assert.equal(h.layers.get('district-buildings').minzoom,16);assert.equal(h.layers.get('district-buildings-3d').minzoom,16);
  for(const zoom of [13.2,15.99,16,17.4]){h.setZoom(zoom);h.emit('moveend');assert.equal(h.stats().activeLOD,zoom<16?'complete-district':'native-provider');}
  assert.equal(h.calls.requests.length,4);loader.dispose();
});
test('the captured default overview camera draws provider volumes after opaque ground surfaces and returns to flat',async()=>{
  // Actual 1440x900 default camera from map-en-desktop-20261017.json. Keep the
  // value in the test rather than requiring an ignored browser artifact.
  const zoom=15.09310012389713,h=harness({zoom,pitch:0}),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});
  const activeVolumes=()=>[...h.layers.values()].filter(l=>l.type==='fill-extrusion'&&zoom>=(l.minzoom??0)&&zoom<(l.maxzoom??24)&&l.layout?.visibility!=='none');
  try{
    await loader.ready;assert.equal(h.stats().status,'ready');assert.equal(activeVolumes().length,0);
    h.map.setLayoutProperty=(id,key,value)=>h.layers.get(id).layout[key]=value;
    const scope=vm.createContext({closeSide(){},RM:true,CAMERA_MS:180,landmarkController:null,landmarkPending:null,map:{getZoom:()=>zoom,getPitch:()=>h.map.getPitch(),easeTo(options){assert.equal(options.zoom,undefined);h.setPitch(options.pitch);district.setPerspective(h.map,options.pitch>1);}}});
    vm.runInContext(source('toggle3D'),scope);scope.toggle3D();assert.equal(h.map.getPitch(),35);
    const active=activeVolumes();assert.deepEqual(active.map(l=>l.id),[EXTRUSION],'one authoritative overview volume layer is active at the real zoom');
    const order=[...h.layers.keys()],volume=order.indexOf(EXTRUSION);
    for(const id of ['district-buildings',FILL,'district-road-casing','district-roads','district-paths'])assert.ok(order.indexOf(id)<volume,id+' must not paint over raised provider walls');
    const properties=h.sources.get(SOURCE).data.features.find(f=>f.properties.extrude==='true').properties;
    const height=evaluate(active[0].paint['fill-extrusion-height'],properties),base=evaluate(active[0].paint['fill-extrusion-base'],properties),metersPerPixel=district.CIRCUMFERENCE*Math.cos(40.698*Math.PI/180)/(512*2**zoom);
    assert.equal(height,95);assert.equal(base,40);assert.ok((height-base)*Math.sin(35*Math.PI/180)/metersPerPixel>10,'the retained provider part has measurable vertical screen extent at the default camera');
    assert.equal(h.layers.get(EXTRUSION).maxzoom,16);assert.equal(h.layers.get('district-buildings-3d').minzoom,16);assert.equal(h.map.getZoom(),zoom);
    scope.toggle3D();assert.equal(h.map.getPitch(),0);assert.equal(activeVolumes().length,0);assert.equal(h.calls.requests.length,4);
  }finally{loader.dispose();}
});

test('tilt synchronizes both real extrusion layers without forcing zoom or rewriting settled layout',async()=>{
  const h=harness(),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch});await loader.ready;let writes=0;
  h.map.getLayoutProperty=(id,key)=>h.layers.get(id).layout[key];h.map.setLayoutProperty=(id,key,value)=>{writes++;h.layers.get(id).layout[key]=value;};
  district.setPerspective(h.map,true);assert.equal(h.layers.get(EXTRUSION).layout.visibility,'visible');assert.equal(h.layers.get('district-buildings-3d').layout.visibility,'visible');assert.equal(writes,2);
  for(let i=0;i<20;i++)district.setPerspective(h.map,true);assert.equal(writes,2);assert.equal(h.map.getZoom(),15.1);district.setPerspective(h.map,false);assert.equal(writes,4);loader.dispose();
});
test('failed provider tile falls back to native geometry with an explicit bilingual degraded notice',async()=>{
  for(const language of ['en','ar']){const h=harness({language});let count=0;const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:async()=>++count===3?new Response('',{status:503}):new Response(bytes)});await loader.ready;
    assert.equal(h.stats().status,'degraded');assert.equal(h.stats().complete,false);assert.equal(h.sources.has(SOURCE),false);assert.equal(h.notice.hidden,false);assert.match(h.notice.textContent,language==='ar'?/الخريطة الأساسية/:/base map/);assert.equal(h.layers.get('district-buildings').minzoom,14);loader.dispose();}
});
test('per-tile, aggregate, feature and coordinate budgets reject rather than publish incomplete geometry',async()=>{
  for(const limits of [{maxTileBytes:bytes.byteLength-1},{maxBytes:bytes.byteLength*3},{maxFeatures:7},{maxCoordinates:10}]){const h=harness(),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:h.fetch,limits});await loader.ready;assert.equal(h.stats().status,'degraded',JSON.stringify(limits));assert.equal(h.sources.has(SOURCE),false);assert.equal(h.stats().complete,false);loader.dispose();}
});
test('a streamed oversized response is cancelled even without Content-Length',async()=>{
  let cancelled=false;const h=harness();const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,limits:{maxTileBytes:30},fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(31));},cancel(){cancelled=true;}}))});await loader.ready;
  assert.equal(cancelled,true);assert.equal(h.stats().status,'degraded');assert.equal(h.sources.has(SOURCE),false);loader.dispose();
});
test('network timeout aborts outstanding requests and leaves interactive native fallback',async()=>{
  const h=harness();let aborts=0;const loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,limits:{timeoutMs:10},fetch:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborts++;reject(Error('aborted'));},{once:true}))});await loader.ready;
  assert.equal(aborts,2);assert.equal(h.stats().status,'degraded');assert.equal(h.layers.get('district-buildings').minzoom,14);loader.dispose();
});
test('render timeout removes incomplete custom source and restores native detail instead of claiming ready',async()=>{
  const h=harness({loaded:false}),loader=createDistrictBuildings(h.map,bounds,'token',{fetch:h.fetch,document:h.document,limits:{timeoutMs:10}});await loader.ready;
  assert.equal(h.stats().status,'degraded');assert.equal(h.stats().stage,'render-timeout');assert.equal(h.sources.has(SOURCE),false);assert.equal(h.layers.get('district-buildings').minzoom,14);loader.dispose();
});
test('pan, zoom and style recovery reuse memory and never add provider requests or data writes at idle',async()=>{
  const h=harness(),loader=createDistrictBuildings(h.map,bounds,'token',{fetch:h.fetch,document:h.document});await loader.ready;
  for(let i=0;i<50;i++){h.setZoom(13.2+i%6);h.emit('moveend');h.emit('idle');loader.ensure();}
  assert.equal(h.calls.requests.length,4);assert.equal(h.calls.sources,1);assert.equal(h.calls.layers,2);
  h.sources.clear();h.layers.delete(FILL);h.layers.delete(EXTRUSION);h.setLoaded(false);h.emit('style.load');assert.equal(h.stats().status,'loading');assert.equal(h.stats().complete,false);assert.equal(h.calls.requests.length,4);assert.equal(h.calls.sources,2);assert.equal(h.calls.layers,4);h.setLoaded(true);h.emit('idle');assert.equal(h.stats().status,'ready');loader.dispose();
});
test('dispose cancels late data, releases custom geometry and listeners, and never revives a removed map',async()=>{
  const h=harness(),delayed=deferred(),loader=createDistrictBuildings(h.map,bounds,'token',{document:h.document,fetch:()=>delayed.promise});loader.dispose();delayed.resolve(new Response(bytes));await loader.ready;
  assert.equal(h.stats().status,'disposed');assert.equal(h.sources.has(SOURCE),false);assert.equal(h.calls.sources,0);assert.equal([...h.listeners.values()].reduce((n,set)=>n+set.size,0),0);loader.dispose();h.emit('idle');h.emit('moveend');assert.equal(h.stats().status,'disposed');
});
function evaluate(e,p){if(!Array.isArray(e))return e;if(e[0]==='get')return p[e[1]];if(e[0]==='to-number'){const n=Number(evaluate(e[1],p));return Number.isFinite(n)?n:e[2];}if(e[0]==='min'||e[0]==='max')return Math[e[0]](...e.slice(1).map(v=>evaluate(v,p)));throw Error('Unsupported test expression');}
test('both actual native and overview extrusion styles retain raised volumes and opaque surfaces',()=>{
  for(const paint of [BUILDING_PAINT,district.createStyle().layers.find(l=>l.id==='district-buildings-3d').paint]){
    for(const [height,base]of[[12,0],[18,4],[40,18],[95,40]]){const properties={height,min_height:base};assert.equal(evaluate(paint['fill-extrusion-height'],properties),height);assert.equal(evaluate(paint['fill-extrusion-base'],properties),base);}
    assert.equal(evaluate(paint['fill-extrusion-height'],{}),0);assert.equal(paint['fill-extrusion-opacity'],1);
  }
});
function source(name){const start=html.indexOf('  function '+name+'('),open=html.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(start,end);}
test('actual full-district bounds permit the declared13.2 zoom floor on desktop and phone, without refitting',()=>{
  for(const [width,height]of[[900,500],[354,435],[1200,250]]){let calls=0,actual;
    const document={body:{dataset:{}}},scope=vm.createContext({ZoneCompactDistrict:district,cityBoundsSignature:'',innerWidth:width,blockLL:(_t,p)=>projection.forward(p),document,map:{getMinZoom:()=>13.2,getMaxZoom:()=>20,getContainer:()=>({clientWidth:width,clientHeight:height}),setMaxBounds(value){actual=value;calls++;}}});
    vm.runInContext(source('constrainCity'),scope);scope.constrainCity(fixture.blocks);scope.constrainCity(fixture.blocks);
    const stats=JSON.parse(document.body.dataset.zoneZoomLimits);assert.equal(stats.minimumZoom,13.2);assert.ok(stats.boundsMinimumZoom<13.2-.8);assert.equal(stats.allServerParcelsIncluded,true);assert.equal(calls,1);
    for(const p of fixture.blocks.flatMap(b=>b.polygon).map(projection.forward))assert.ok(p[0]>=actual[0][0]&&p[0]<=actual[1][0]&&p[1]>=actual[0][1]&&p[1]<=actual[1][1]);
    assert.equal(JSON.stringify(fixture.blocks),original);
  }
});
test('actual tilt action preserves zoom at overview, minimum and close level, including reduced motion',()=>{
  for(const zoom of [13.2,15.1,18.5])for(const RM of [false,true]){const moves=[];let pitch=0;
    const scope=vm.createContext({closeSide(){},RM,CAMERA_MS:180,landmarkController:null,landmarkPending:null,map:{getZoom:()=>zoom,getPitch:()=>pitch,easeTo(options){moves.push(options);pitch=options.pitch;}}});vm.runInContext(source('toggle3D'),scope);scope.toggle3D();scope.toggle3D();
    assert.equal(moves.length,2);assert.equal(moves[0].pitch,35);assert.equal(moves[1].pitch,0);assert.ok(moves.every(m=>!('zoom'in m)&&!('center'in m)&&!('bearing'in m)));assert.ok(moves.every(m=>m.duration===(RM?0:180)));
  }
});
test('map controls retain44px dark disabled targets and keyboard focus, with loading status separate from errors',()=>{
  assert.match(html,/\.mapboxgl-ctrl-group button,\.mapboxgl-ctrl-group button:disabled\{width:44px;height:44px;background:#25292d/);
  assert.match(html,/\.mapboxgl-ctrl-group button:focus-visible\{outline:2px solid #c99a45/);
  assert.match(html,/id="districtDetailStatus" role="status" hidden/);
  assert.match(html,/id="err"/);
});
function drawerHarness(language='en',focusInside=true){
  const calls=[],inside={tagName:'BUTTON'},outside={tagName:'BUTTON'},classes=new Set(['open']),backdrop=new Set(['on']),attrs={},listeners=[];
  const document={activeElement:focusInside?inside:outside,addEventListener(name,fn){assert.equal(name,'keydown');listeners.push(fn);}};
  const side={classList:{remove(name){classes.delete(name);},contains:name=>classes.has(name)},contains:node=>node===inside,setAttribute(key,value){attrs['side-'+key]=value;}};
  let inert=false;Object.defineProperty(side,'inert',{get:()=>inert,set:value=>{if(value)assert.notEqual(document.activeElement,inside,'focus must leave the drawer before its content becomes inert');inert=value;calls.push('inert');}});
  const toggle={setAttribute:(key,value)=>attrs[key]=value,focus(){assert.equal(classes.has('open'),false,'close styling must reveal the toggle before restoring focus');assert.equal(inert,false,'focus must be restored before inert is applied');document.activeElement=toggle;calls.push('focus');}};
  const scope=vm.createContext({el:{side,sideBd:{classList:{remove:name=>backdrop.delete(name)}},sideToggle:toggle},document,lang:language,territoryData:fixture.blocks,deselect(){calls.push('deselect');},setMode(mode){calls.push(mode);},fitCity(blocks,force){assert.equal(blocks,fixture.blocks);assert.equal(force,true);calls.push('fit');}});
  vm.runInContext(source('closeSide'),scope);
  return {scope,document,inside,outside,toggle,side,attrs,classes,backdrop,calls,listeners};
}
test('actual F keyboard shortcut closes the focused drawer and restores a visible toggle before inert in both languages',()=>{
  const start=html.indexOf("  document.addEventListener('keydown',function(e){\n    if(e.key==='Escape')"),end=html.indexOf('  function closeSide(',start);assert.ok(start>=0&&end>start);
  for(const language of ['en','ar']){const h=drawerHarness(language);vm.runInContext(html.slice(start,end),h.scope);let prevented=false;
    h.listeners[0]({key:'F',target:h.inside,preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(h.document.activeElement,h.toggle);assert.equal(h.side.inert,true);assert.equal(h.classes.has('open'),false);assert.equal(h.backdrop.has('on'),false);assert.equal(h.attrs['side-aria-hidden'],'true');assert.equal(h.attrs['aria-expanded'],'false');assert.equal(h.attrs['aria-label'],language==='ar'?'افتح أدوات الخريطة':'Open map controls');assert.ok(h.calls.indexOf('focus')<h.calls.indexOf('inert'));assert.equal(h.calls.at(-1),'fit');
  }
});
test('drawer close preserves unrelated focus and retains explicit toggle restoration',()=>{
  for(const [inside,explicit,expected]of[[true,false,true],[false,false,false],[false,true,true]]){const h=drawerHarness('en',inside);h.scope.closeSide(explicit);assert.equal(h.document.activeElement,expected?h.toggle:h.outside);assert.equal(h.calls.filter(value=>value==='focus').length,expected?1:0);assert.equal(h.side.inert,true);}
});
test('summarizeDecodedFeatures calculates total, extrudable, raisedParts, maximumHeight, and uniqueTiles',()=>{
  const features=decodeTile(bytes,planTiles(bounds)[0]);
  const summary=summarizeDecodedFeatures(features);
  assert.deepEqual(summary,{total:2,extrudable:1,raisedParts:1,maximumHeight:95,uniqueTiles:1});
  assert.equal(buildingSourceId(),SOURCE);
  assert.equal(buildingLayerCount(),2);
  assert.equal(defaultSourceZoom(),16);
  assert.equal(maxTileBudget(),9);
  assert.equal(maxTileConcurrency(),2);
  assert.equal(isBuildingLayerId(FILL),true);
  assert.equal(isBuildingLayerId('unknown'),false);
});

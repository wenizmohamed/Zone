import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),district=require('../assets/city/compact-district.js'),geometry=require('../dist/territory-geometry.js');
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
// Same immutable geographic catalog intersections as Database::territoryPoint.
function originalPoint(c,r){const x=c/12*2-1,y=1-r/10*2,w=.68+.32*(1-Math.abs(y)),cross=x*2850*w+(c>0&&c<12?Math.sin(c*1.91+r*.73)*105:0),long=y*5900+(r>0&&r<10?Math.sin(r*1.47+c*.61)*135:0),b=29*Math.PI/180;return[-73.9812+(cross*Math.cos(b)+long*Math.sin(b))/(111320*Math.cos(40.7562*Math.PI/180)),40.7562+(-cross*Math.sin(b)+long*Math.cos(b))/111320];}
const catalog=Array.from({length:120},(_,i)=>{const c=i%12,r=Math.floor(i/12);return {id:'ZC-'+String(i+1).padStart(3,'0'),polygon:[originalPoint(c,r),originalPoint(c+1,r),originalPoint(c+1,r+1),originalPoint(c,r+1)],ownerId:i%3?'vipers':'kings',version:17,neighbors:[i>0?'ZC-'+String(i).padStart(3,'0'):null].filter(Boolean)};});
const projection=district.createProjection(catalog.flatMap(b=>b.polygon));
function close(a,b,tolerance=1e-9){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);}
test('all 120 original parcels fit a 600m neighborhood without changing IDs, ownership, versions or original coordinates',()=>{
  const before=JSON.stringify(catalog),points=catalog.flatMap(b=>b.polygon).map(projection.forward).map(district.mercator),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cos=Math.cos(projection.center[1]*Math.PI/180);
  close(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*cos,600,1e-6);
  for(const b of catalog)for(const p of b.polygon){const restored=projection.inverse(projection.forward(p));close(restored[0],p[0]);close(restored[1],p[1]);}
  assert.equal(JSON.stringify(catalog),before);assert.equal(new Set(catalog.map(b=>b.id)).size,120);
});
test('uniform transform preserves shared intersections, aspect and disconnected holdings instead of independently relocating parcels',()=>{
  const original=catalog.flatMap(b=>b.polygon).map(district.mercator),display=catalog.flatMap(b=>b.polygon).map(projection.forward).map(district.mercator);
  for(let i=1;i<original.length;i+=31){close((display[i][0]-display[0][0]),(original[i][0]-original[0][0])*projection.scale,1e-6);close(display[i][1]-display[0][1],(original[i][1]-original[0][1])*projection.scale,1e-6);}
  assert.deepEqual(projection.forward(catalog[0].polygon[1]),projection.forward(catalog[1].polygon[0]));
  const distant=[-73.85,40.85],restored=projection.inverse(projection.forward(distant));close(restored[0],distant[0]);close(restored[1],distant[1]);
  assert.deepEqual(district.createProjection(catalog.flatMap(b=>b.polygon).reverse()).forward(distant),projection.forward(distant));
});
test('dissolved family regions preserve all 120 independent hit targets after display projection',()=>{
  const features=catalog.map(b=>({type:'Feature',id:b.id,properties:{ownerId:b.ownerId,ownerName:b.ownerId,renderColor:'#78d628'},geometry:{type:'Polygon',coordinates:[[...b.polygon,b.polygon[0]].map(projection.forward)]}}));
  const regions=geometry.dissolve({type:'FeatureCollection',features});assert.equal(regions.features.reduce((n,f)=>n+f.properties.blockCount,0),120);
  assert.deepEqual(new Set(regions.features.flatMap(f=>f.properties.blockIds)),new Set(catalog.map(b=>b.id)));
});
test('game POI, territory and player coordinates apply the same projection exactly once',()=>{
  const functions=['displayPoint','blockLL','pointCoordinates'].map(name=>{const start=html.indexOf('  function '+name+'('),end=html.indexOf('\n  function ',start+1);return html.slice(start,end);}).join('\n');
  const scope=vm.createContext({displayProjection:projection,pick:(obj,keys,fallback)=>{for(const k of keys)if(obj[k]!==undefined)return obj[k];return fallback;},ll:()=>originalPoint(3,4)});vm.runInContext(functions,scope);
  const p=originalPoint(3,4),expected=projection.forward(p);
  for(const actual of [scope.blockLL({_lngLat:true},p),scope.pointCoordinates({lng:p[0],lat:p[1]}),scope.pointCoordinates({geometry:{type:'Point',coordinates:p}}),scope.pointCoordinates({x:25,y:40})]){close(actual[0],expected[0]);close(actual[1],expected[1]);}
  const twice=projection.forward(expected);assert.ok(Math.hypot(expected[0]-twice[0],expected[1]-twice[1])>.001);
});
test('both map modes retain locations, category toggles remain effective and explicit presentation opt-out is honored',()=>{
  const start=html.indexOf('  function pinVisible('),end=html.indexOf('\n  function poiGeo',start),scope=vm.createContext({mapMode:'territories',lastData:{presentation:{showLocations:true,compact:true}},activeCats:{},pinInScope:()=>true,hideFound:false,found:new Set()});vm.runInContext(html.slice(start,end),scope);
  assert.equal(scope.pinVisible({id:'hospital',cat:'admin'}),true);scope.mapMode='places';assert.equal(scope.pinVisible({id:'hospital',cat:'admin'}),true);
  scope.activeCats.admin=false;assert.equal(scope.pinVisible({cat:'admin'}),false);scope.activeCats.admin=true;scope.lastData.presentation.showLocations=false;assert.equal(scope.pinVisible({cat:'admin'}),false);
  scope.lastData={};assert.equal(scope.pinVisible({cat:'admin'}),true);
});
test('real vector street and building detail replaces raster/procedural imports and keeps attribution',()=>{
  const style=district.createStyle();assert.equal(style.sources['district-streets'].type,'vector');assert.equal(style.sources['district-streets'].url,'mapbox://mapbox.mapbox-streets-v8');
  assert.ok(style.layers.some(l=>l['source-layer']==='building'&&l.type==='fill'));assert.ok(style.layers.some(l=>l['source-layer']==='road'&&l.type==='line'));
  assert.ok(style.layers.some(l=>l['source-layer']==='building'&&l.type==='fill-extrusion'));assert.ok(!style.layers.some(l=>l.type==='raster'));
  assert.doesNotMatch(html,/<script src="[^\"]*(?:atlas|native-city)\.js/);assert.match(html,/new mapboxgl.AttributionControl/);assert.doesNotMatch(html,/id:['"]zone-(?:ownership-outline|hatch|connector)/);
  for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(script[1]);
});
test('camera preparation waits for actual vector tile readiness and perspective uses the real source footprints',async()=>{
  let ready=false,listener=null;const layers=new Map(district.createStyle().layers.map(l=>[l.id,l]));const map={areTilesLoaded:()=>ready,on:(_name,fn)=>listener=fn,off:()=>listener=null,triggerRepaint(){},getLayer:id=>layers.get(id),setLayoutProperty:(id,key,value)=>layers.get(id).layout[key]=value};
  const controller=district.controller(map),pending=controller.whenReady();let completed=false;pending.then(()=>completed=true);await Promise.resolve();assert.equal(completed,false);ready=true;listener();await pending;assert.equal(listener,null);
  district.setPerspective(map,true);assert.equal(layers.get('district-buildings-3d').layout.visibility,'visible');district.setPerspective(map,false);assert.equal(layers.get('district-buildings-3d').layout.visibility,'none');
});
test('invalid or degenerate geometry cannot silently invent a compact district',()=>{
  assert.throws(()=>district.createProjection([]),/original geographic/);assert.throws(()=>district.createProjection([[NaN,2]]),/original geographic/);assert.throws(()=>district.createProjection([[2,3],[2,3]]),/nondegenerate/);assert.throws(()=>district.createProjection([[2,3],[3,4]],{meters:5000}),/neighborhood/);
});
test('unchanged idle perspective checks do not rewrite Mapbox layout or cause a render loop',()=>{
  let writes=0,current='none';const map={getLayer:()=>({}),getLayoutProperty:()=>current,setLayoutProperty:(_id,_key,value)=>{current=value;writes++;}};
  district.setPerspective(map,false);district.setPerspective(map,false);assert.equal(writes,0);
  district.setPerspective(map,true);district.setPerspective(map,true);assert.equal(writes,1);
  district.setPerspective(map,false);assert.equal(writes,2);
});

test('a removed or unloaded style is never read by queued perspective callbacks',()=>{
  let reads=0;
  const removed={isStyleLoaded:()=>false,getLayer(){throw Error('Removed style accessed');},getLayoutProperty(){reads++;throw Error('getLayoutProperty');}};
  district.setPerspective(removed,true);assert.equal(reads,0);
  district.setPerspective({getLayer:()=>null,getLayoutProperty(){reads++;throw Error('Missing layer accessed');}},true);assert.equal(reads,0);
});

test('disposing a controller settles tile waiters, removes their listeners and never touches the removed map again',async()=>{
  const listeners=new Set();let removed=false,calls=0;
  const map={areTilesLoaded(){assert.equal(removed,false);calls++;return false;},on(_name,fn){listeners.add(fn);},off(_name,fn){listeners.delete(fn);},triggerRepaint(){calls++;},stop(){assert.equal(removed,false);calls++;}};
  const controller=district.controller(map),first=controller.whenReady(),second=controller.whenReady();assert.equal(listeners.size,2);
  controller.dispose();assert.equal(listeners.size,0);removed=true;const before=calls;
  await Promise.all([first,second]);controller.dispose();controller.setVisible(false);await controller.whenReady();assert.equal(calls,before);
});

test('collision-rejected icons cannot invisibly intercept a territory tap',()=>{
  const a=html.indexOf('  function nearbyVisiblePin('),b=html.indexOf('  function emptyGeo(',a),map={getLayer:()=>({}),project:()=>({x:20,y:20}),queryRenderedFeatures:()=>[]};
  const scope=vm.createContext({map,pinData:[{id:'hidden',_lngLat:[1,2]}],pinDisplayed:()=>true});vm.runInContext(html.slice(a,b),scope);
  assert.equal(scope.nearbyVisiblePin({x:20,y:20}),null);map.queryRenderedFeatures=()=>[{properties:{id:'visible'}}];assert.equal(scope.nearbyVisiblePin({x:20,y:20}),null);
  map.queryRenderedFeatures=()=>[{properties:{id:'hidden'}}];assert.equal(scope.nearbyVisiblePin({x:20,y:20}).id,'hidden');
});
test('rendered diagnostics deduplicate actual features, report visible core IDs and query water at exact projected points',()=>{
  const footprint={id:101,geometry:{type:'Polygon',coordinates:[[[1,2],[3,4],[5,6],[1,2]]]}};let waterQueries=0;
  const map={getLayer:()=>({}),getZoom:()=>17.2,getPitch:()=>35,areTilesLoaded:()=>true,project:p=>({x:p[0],y:p[1]}),queryRenderedFeatures(point,options){const layers=(options||point).layers;if(layers.includes('district-water')){waterQueries++;return point.x===12?[{}]:[];}if(layers.includes('district-buildings'))return[footprint,footprint,{geometry:{type:'Polygon',coordinates:[[[4,5],[6,7],[8,9],[4,5]]]}}];if(layers.includes('district-roads'))return[{id:11},{id:11},{id:12}];return[{properties:{id:'bank'}},{properties:{id:'bank'}},{properties:{id:'other'}}];}};
  const pins=[{id:'bank',_lngLat:[12,13]},{id:'gym',_lngLat:[22,23]},{id:'other',_lngLat:[99,99]}],result=district.renderedDiagnostics(map,pins,['bank','gym']);
  assert.equal(result.footprints,2);assert.equal(result.roads,2);assert.deepEqual(result.visibleCoreIds,['bank']);assert.equal(waterQueries,2);
  assert.deepEqual(result.corePins,[{id:'bank',coordinates:[12,13],isOnWater:true},{id:'gym',coordinates:[22,23],isOnWater:false}]);
  assert.equal(result.tilesLoaded,true);const before=result.footprintGeometryHash;footprint.geometry.coordinates[0][1]=[30,40];assert.notEqual(district.renderedDiagnostics(map,pins,['bank','gym']).footprintGeometryHash,before);
});
test('overview has eight prioritized destinations, secondary icons and labels have deliberate detail zooms',()=>{
  const a=html.indexOf('  function ensurePoiLayers('),b=html.indexOf('  function syncPoiSource(',a),layers=[],sources=new Map();
  const map={isStyleLoaded:()=>true,getLayer:id=>layers.find(l=>l.id===id),addLayer:l=>layers.push(l),getStyle:()=>({layers}),getSource:id=>sources.get(id),addSource:(id,value)=>sources.set(id,value)};
  const scope=vm.createContext({map,ZoneCompactDistrict:district,pinData:[],document:{body:{dataset:{}}},ensurePoiImage(){},poiGeo:()=>({type:'FeatureCollection',features:[]}),emptyGeo:()=>({type:'FeatureCollection',features:[]})});vm.runInContext(html.slice(a,b),scope);scope.ensurePoiLayers();
  assert.equal(scope.document.body.dataset.zonePoiErr,undefined);const core=layers.find(l=>l.id==='zone-poi-icon'),detail=layers.find(l=>l.id==='zone-poi-icon-detail');
  assert.equal(core.layout['text-size'],12);assert.equal(core.layout['text-allow-overlap'],false);assert.equal(core.paint['text-opacity'],1);
  assert.equal(layers.find(l=>l.id==='zone-poi-icon').layout['icon-allow-overlap'],true,'all core destinations retain their glyphs');assert.equal(layers.find(l=>l.id==='zone-poi-icon-detail').layout['icon-allow-overlap'],false,'secondary destinations still declutter');
  assert.equal(detail.minzoom,16.8);assert.equal(detail.layout['text-field'][0],'get');assert.equal(detail.layout['text-field'][1],'label');assert.equal(detail.layout['text-size'],11);assert.equal(detail.layout['text-optional'],true);assert.equal(detail.layout['icon-optional'],false);assert.equal(layers.some(l=>l.id==='zone-poi-label-detail'),false,'a detail name must not float independently of a collision-rejected coin');assert.equal(layers.find(l=>l.id==='zone-poi-hitbox-detail').minzoom,16.8);
  assert.equal(layers.find(l=>l.id==='zone-poi-halo-detail').paint['circle-opacity'],0,'a collision-hidden detail glyph must not leave a separately rendered empty coin');
  assert.equal(layers.find(l=>l.id==='zone-poi-halo-detail').paint['circle-stroke-opacity'],0,'zero circle-opacity alone retains the outline and leaves orphan rings');
  assert.match(html,/OVERVIEW_POIS=\['bank','gym','alley','hospital','market','hq','home','missions'\]/);
});

test('native badges query actual rendered core/detail symbol boxes, not invisible territory hit geometry',()=>{
  const calls=[],rectangle=[[100,120],[144,164]];
  const map={getLayer:id=>['zone-poi-icon','zone-poi-label','zone-poi-label-detail'].includes(id),queryRenderedFeatures(rect,options){calls.push({rect,options});return [{properties:{id:'bank'}}];}};
  assert.equal(district.collidesWithSymbols(map,rectangle),true);
  assert.equal(calls[0].rect,rectangle);
  assert.deepEqual(calls[0].options.layers,['zone-poi-icon','zone-poi-label','zone-poi-label-detail']);
  map.queryRenderedFeatures=()=>[];assert.equal(district.collidesWithSymbols(map,rectangle),false);
  map.queryRenderedFeatures=()=>{throw new Error('Tiles changing');};assert.equal(district.collidesWithSymbols(map,rectangle),true);
  map.getLayer=()=>false;assert.equal(district.collidesWithSymbols(map,rectangle),false);
});

test('family emblems yield only to core icons while selected holdings still protect service text',()=>{
  const a=html.indexOf('  function layoutHoldingMarkers('),b=html.indexOf('\n  function ',a+1);
  const marker=(point,block)=>({lngLat:point,region:block?null:{},block,element:{offsetWidth:44,offsetHeight:44,style:{},tabIndex:0}});
  const selected={id:'original-120'},markers=[marker([200,200]),marker([220,200],selected),marker([330,220])];
  const service=[[170,175],[240,225]],intersects=r=>r[0][0]<=service[1][0]&&r[1][0]>=service[0][0]&&r[0][1]<=service[1][1]&&r[1][1]>=service[0][1];
  const map={getContainer:()=>({clientWidth:500,clientHeight:400}),project:p=>({x:p[0],y:p[1]}),getLayer:()=>true,queryRenderedFeatures:(r,options)=>options.layers.includes('zone-poi-label')&&intersects(r)?[{properties:{id:'hospital'}}]:[]};
  const scope=vm.createContext({map,holdingMarkers:markers,selectedTerritory:selected,innerWidth:500,ZoneCompactDistrict:district});
  const packA=html.indexOf('  function packFamilyMarkers(');vm.runInContext(html.slice(packA,b),scope);scope.layoutHoldingMarkers();
  assert.equal(markers[0].element.style.visibility,'visible');assert.equal(markers[0].element.tabIndex,0,'family buttons retain accessible ownership selection while labels yield');
  assert.equal(markers[1].element.style.visibility,'hidden','selected holdings must not override service-label protection');
  assert.equal(markers[2].element.style.visibility,'visible');assert.equal(markers[2].element.tabIndex,0);
  assert.match(html,/map\.on\('idle',layoutHoldingMarkers\)/);
  assert.match(html,/button\.title=name\+' · '\+p\.blockCount/);
  assert.match(html,/\.regionPin\.overview[^\n]*min-height:44px/);
});

test('family badge anchor moves around rendered core icons while remaining inside its original ownership region',()=>{
  const a=html.indexOf('  function regionMarkerAnchor('),b=html.indexOf('\n  function ',a+1);
  const polygon=[[130,140],[270,140],[270,300],[130,300],[130,140]],region={properties:{anchor:[200,200],blockIds:['ZC021']},geometry:{type:'Polygon',coordinates:[polygon]}};
  const territory={polygon:polygon.slice(0,-1),_centroidLngLat:[200,220]},before=JSON.stringify({region,territory});
  const service=[[175,175],[225,225]],intersects=r=>r[0][0]<=service[1][0]&&r[1][0]>=service[0][0]&&r[0][1]<=service[1][1]&&r[1][1]>=service[0][1];
  const map={getContainer:()=>({clientWidth:500,clientHeight:400}),project:p=>({x:p[0],y:p[1]}),getLayer:()=>true,queryRenderedFeatures:r=>intersects(r)?[{properties:{id:'bank'}}]:[]};
  const scope=vm.createContext({map,holdingMarkers:[],territoryById:{ZC021:territory},blockLL:(_t,p)=>p,ZoneCompactDistrict:district,ZoneTerritoryGeometry:geometry});
  vm.runInContext(html.slice(a,b),scope);const anchor=scope.regionMarkerAnchor(region,22);
  assert.notDeepEqual(Array.from(anchor),region.properties.anchor);assert.equal(geometry.contains(region.geometry,anchor),true);
  assert.equal(intersects([[anchor[0]-28,anchor[1]-30],[anchor[0]+28,anchor[1]+30]]),false);
  assert.equal(JSON.stringify({region,territory}),before,'display anchoring must not mutate ownership or interaction geometry');
});

test('portrait family anchoring finds real interior edge space missed by parcel centers and deeply inset corners',()=>{
  const a=html.indexOf('  function regionMarkerAnchor('),b=html.indexOf('\n  function ',a+1),polygon=[[232,150],[268,150],[268,290],[232,290],[232,150]],region={properties:{anchor:[250,220],blockIds:['night']},geometry:{type:'Polygon',coordinates:[polygon]}},territory={polygon:polygon.slice(0,-1),_centroidLngLat:[250,220]},before=JSON.stringify({region,territory});
  const clear=point=>point[0]<235&&point[1]>180&&point[1]<260;
  const map={getContainer:()=>({clientWidth:369,clientHeight:475}),project:p=>({x:p[0],y:p[1]}),getLayer:()=>true,queryRenderedFeatures(rect){const center=[(rect[0][0]+rect[1][0])/2,(rect[0][1]+rect[1][1])/2];return clear(center)?[]:[{properties:{id:'core-icon'}}];}};
  const scope=vm.createContext({map,holdingMarkers:[],territoryById:{night:territory},blockLL:(_t,p)=>p,ZoneCompactDistrict:district,ZoneTerritoryGeometry:geometry});vm.runInContext(html.slice(a,b),scope);const anchor=Array.from(scope.regionMarkerAnchor(region,22));
  assert.equal(clear(region.properties.anchor),false);assert.equal(clear(anchor),true);assert.equal(geometry.contains(region.geometry,anchor),true);assert.equal(JSON.stringify({region,territory}),before);
});

test('family buttons re-anchor after asynchronous icon placement and stable idle does not move them again',()=>{
  function source(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  function ',a+1);return html.slice(a,b);}
  const polygon=[[120,150],[280,150],[280,300],[120,300],[120,150]],region={properties:{ownerId:'kings',anchor:[200,220],blockIds:['kings']},geometry:{type:'Polygon',coordinates:[polygon]}},territory={polygon:polygon.slice(0,-1),_centroidLngLat:[200,220]},before=JSON.stringify({region,territory});
  let iconsReady=false,moves=0;const service=[[175,200],[225,240]],intersects=r=>r[0][0]<=service[1][0]&&r[1][0]>=service[0][0]&&r[0][1]<=service[1][1]&&r[1][1]>=service[0][1];
  const map={getContainer:()=>({clientWidth:369,clientHeight:475}),project:p=>({x:p[0],y:p[1]}),getLayer:()=>true,queryRenderedFeatures:r=>iconsReady&&intersects(r)?[{properties:{id:'hospital'}}]:[]};
  const scope=vm.createContext({map,holdingMarkers:[],selectedTerritory:null,innerWidth:369,territoryById:{kings:territory},blockLL:(_t,p)=>p,ZoneCompactDistrict:district,ZoneTerritoryGeometry:geometry});vm.runInContext(source('regionMarkerAnchor')+'\n'+source('packFamilyMarkers')+'\n'+source('layoutHoldingMarkers'),scope);
  const anchor=scope.regionMarkerAnchor(region,22),item={region,lngLat:anchor,element:{offsetWidth:44,offsetHeight:44,style:{}},marker:{setLngLat(){moves++;}}};scope.holdingMarkers.push(item);scope.layoutHoldingMarkers();assert.equal(item.element.style.visibility,'visible');assert.equal(moves,0);
  iconsReady=true;scope.layoutHoldingMarkers();assert.equal(item.element.style.visibility,'visible','late glyphs must relocate the family button instead of hiding it forever');assert.equal(moves,1);assert.equal(geometry.contains(region.geometry,item.lngLat),true);assert.equal(intersects([[item.lngLat[0]-28,item.lngLat[1]-28],[item.lngLat[0]+28,item.lngLat[1]+28]]),false);
  for(let i=0;i<4;i++)scope.layoutHoldingMarkers();assert.equal(moves,1,'unchanged idle must not repeatedly move the marker');assert.equal(JSON.stringify({region,territory}),before);
});

test('native faction touch areas reserve shared Mapbox placement above labels and below core icons without idle data churn',()=>{
  const layers=new Map([['zone-poi-label',{}],['zone-poi-icon',{}],['zone-poi-icon-detail',{}]]),sources=new Map(),images=new Map(),moves=[];let writes=0;
  const map={isStyleLoaded:()=>true,getStyle:()=>({layers:[...layers].map(([id])=>({id}))}),getLayer:id=>layers.get(id),getSource:id=>sources.get(id),hasImage:id=>images.has(id),addImage:(id,image)=>images.set(id,image),addSource:(id)=>sources.set(id,{setData(data){writes++;this.data=data;}}),addLayer(layer){layers.set(layer.id,layer);moves.push(layer.id);},moveLayer(id){const value=layers.get(id);layers.delete(id);layers.set(id,value);moves.push(id);}};
  const markers=[{region:{properties:{ownerId:'kings'}},lngLat:[-74,40],element:{style:{visibility:'visible'}}},{region:{properties:{ownerId:'vipers'}},lngLat:[-74.1,40.1],element:{style:{visibility:'hidden'}}},{block:{id:'selected'},lngLat:[-74.2,40.2],element:{style:{visibility:'visible'}}}];
  district.syncBadgeReservations(map,markers);
  const layer=layers.get('zone-family-reservations'),image=images.get('zone-family-touch-reservation');
  assert.equal(image.width,44);assert.equal(image.height,44);assert.equal(image.data.length,44*44*4);
  assert.equal(layer.layout['icon-ignore-placement'],false,'native touch area must block lower priority optional text');assert.equal(layer.layout['icon-allow-overlap'],true,'native family priority must not disappear because of optional text');
  assert.ok(layer.paint['icon-opacity']>0&&layer.paint['icon-opacity']<.01,'reservation remains imperceptible but participates in placement');
  assert.deepEqual(moves,['zone-family-reservations','zone-poi-icon-detail','zone-poi-label','zone-family-reservations','zone-poi-icon']);
  assert.deepEqual(sources.get('zone-family-reservations').data.features.map(f=>f.id),['kings']);
  const moveCount=moves.length;district.syncBadgeReservations(map,markers);assert.equal(writes,1,'settled idle must not create another render cycle');assert.equal(moves.length,moveCount,'unchanged placement must not reorder layers again');
  layers.set('zone-poi-label-detail',{});district.prioritizeBadgeReservations(map);const order=[...layers.keys()];assert.ok(order.indexOf('zone-poi-label-detail')<order.indexOf('zone-family-reservations'),'labels created after initial family data must yield too');assert.ok(order.indexOf('zone-family-reservations')<order.indexOf('zone-poi-icon'));assert.ok(order.indexOf('zone-poi-icon-detail')<order.indexOf('zone-poi-label'),'secondary names must yield to core location names');
  district.syncBadgeReservations(map,[]);assert.equal(writes,2);assert.equal(sources.get('zone-family-reservations').data.features.length,0,'places mode removes old family collision obstacles');
});

test('diagnostics cannot count a visible label as a rendered core icon and expose actual image/color and family reservations',()=>{
  const map={getLayer:()=>({}),getZoom:()=>15.1,getPitch:()=>0,project:p=>({x:p[0],y:p[1]}),queryRenderedFeatures(point,options){const layer=(options||point).layers[0];if(layer==='zone-poi-icon')return[{properties:{id:'bank',iconImage:'zone-poi-bank',color:'#abcdef'},geometry:{type:'Point',coordinates:[12,13]}}];if(layer==='zone-poi-label')return[{properties:{id:'hospital'}}];if(layer==='zone-family-reservations')return[{properties:{ownerId:'kings'}},{properties:{ownerId:'kings'}},{properties:{ownerId:'vipers'}}];return[];}};
  const result=district.renderedDiagnostics(map,[],['bank','hospital']);assert.deepEqual(result.visibleCoreIconIds,['bank']);assert.deepEqual(result.visibleCoreLabelIds,['hospital']);assert.deepEqual(result.visibleCoreSymbolIds,['bank','hospital']);assert.deepEqual(result.coreIconFeatures,[{id:'bank',iconImage:'zone-poi-bank',color:'#abcdef',coordinates:[12,13]}]);assert.deepEqual(result.reservationIds,['kings','vipers']);
});

test('canvas coin and glyph use one ordinary RGBA image and one collision decision rather than falsely marked signed distance fields',()=>{
  const a=html.indexOf('  function ensurePoiImage('),b=html.indexOf('\n  function ',a+1),images=[],calls=[];
  const canvasContext=new Proxy({}, {get:(_target,key)=>key==='getImageData'?()=>({width:64,height:64,data:new Uint8Array(64*64*4)}):(...args)=>calls.push({key,args})});
  const scope=vm.createContext({map:{hasImage:()=>false,addImage:(id,image,options)=>images.push({id,image,options})},document:{createElement:()=>({getContext:()=>canvasContext})},ICON_PATHS:{hospital:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'},Path2D:class{}});
  vm.runInContext(html.slice(a,b),scope);scope.ensurePoiImage('hospital');assert.equal(images.length,1);assert.equal(images[0].id,'zone-poi-hospital');assert.equal(images[0].options.sdf,false);assert.equal(images[0].options.pixelRatio,2);assert.equal(images[0].image.data.length,64*64*4);
  assert.ok(calls.some(call=>call.key==='arc'&&call.args[0]===12&&call.args[1]===12),'coin must belong to the registered image');assert.ok(calls.findIndex(call=>call.key==='fill')<calls.findIndex(call=>call.key==='stroke'&&call.args.length===1),'glyph must be painted over the same image background');
});
test('global faction packing keeps all four real regions visible for every focused-family creation order',()=>{
  function source(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  function ',a+1);return html.slice(a,b);}
  const specs=[['kings',180,190,315,280,200,220],['vipers',194,209,206,231,200,220],['oldguard',80,320,125,370,100,340],['night',300,320,335,370,320,340]],territoryById={},regions=specs.map(([ownerId,left,top,right,bottom,x,y])=>{const polygon=[[left,top],[right,top],[right,bottom],[left,bottom]];territoryById[ownerId]={polygon,_centroidLngLat:[x,y]};return {properties:{ownerId,anchor:[x,y],blockIds:[ownerId]},geometry:{type:'Polygon',coordinates:[[...polygon,polygon[0]]]}};}),before=JSON.stringify({regions,territoryById});
  const bank=[[290,190],[310,210]],intersects=r=>r[0][0]<=bank[1][0]&&r[1][0]>=bank[0][0]&&r[0][1]<=bank[1][1]&&r[1][1]>=bank[0][1];
  const map={getContainer:()=>({clientWidth:369,clientHeight:475}),project:p=>({x:p[0],y:p[1]}),getLayer:()=>true,queryRenderedFeatures:r=>intersects(r)?[{properties:{id:'bank'}}]:[]};
  for(const focused of ['kings','vipers','oldguard','night']){let moves=0;const markers=regions.slice().sort((a,b)=>Number(b.properties.ownerId===focused)-Number(a.properties.ownerId===focused)).map(region=>({region,lngLat:region.properties.anchor,element:{offsetWidth:44,offsetHeight:44,style:{}},marker:{setLngLat(){moves++;}}}));
    const scope=vm.createContext({map,holdingMarkers:markers,selectedTerritory:null,innerWidth:369,territoryById,blockLL:(_t,p)=>p,ZoneCompactDistrict:district,ZoneTerritoryGeometry:geometry});vm.runInContext(['regionMarkerAnchor','packFamilyMarkers','layoutHoldingMarkers'].map(source).join('\n'),scope);scope.layoutHoldingMarkers();
    assert.equal(markers.filter(item=>item.element.style.visibility==='visible').length,4,focused+' must not hide a constrained rival');
    for(const item of markers){assert.equal(geometry.contains(item.region.geometry,item.lngLat),true);assert.equal(intersects([[item.lngLat[0]-28,item.lngLat[1]-28],[item.lngLat[0]+28,item.lngLat[1]+28]]),false);for(const other of markers)if(item!==other)assert.ok(Math.abs(item.lngLat[0]-other.lngLat[0])>=52||Math.abs(item.lngLat[1]-other.lngLat[1])>=50);}
    const settled=moves;for(let idle=0;idle<4;idle++)scope.layoutHoldingMarkers();assert.equal(moves,settled,'settled all-family placement must not churn at idle');
  }
  assert.equal(JSON.stringify({regions,territoryById}),before,'packing preserves original holdings and original engine geometry');
});
test('actual public geometry reproduces the missing startup emblem and packs all four after the precise Full city camera',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/map-public-ownership-20261010.json',import.meta.url),'utf8')),projection=district.createProjection(fixture.blocks.flatMap(b=>b.polygon)),territoryById=Object.fromEntries(fixture.blocks.map(b=>[b.id,{...b,_centroidLngLat:projection.forward(b.centroid)}])),features=fixture.blocks.map(b=>({type:'Feature',id:b.id,properties:{ownerId:b.ownerFactionId||'neutral',neutral:!b.ownerFactionId},geometry:{type:'Polygon',coordinates:[[...b.polygon,b.polygon[0]].map(projection.forward)]}})),regions=geometry.dissolve({type:'FeatureCollection',features}).features.filter(region=>!region.properties.neutral);
  let camera=fixture.camera;const project=p=>{const world=district.mercator([camera.lng,camera.lat]),scale=512*2**camera.zoom/(2*Math.PI*6378137),q=district.mercator(p);return{x:fixture.canvas.width/2+(q[0]-world[0])*scale,y:fixture.canvas.height/2-(q[1]-world[1])*scale};},iconBoxes=()=>fixture.coreIcons.map(icon=>{const p=project(icon.coordinates);return[[p.x-16,p.y-16],[p.x+16,p.y+16]];});
  const map={getContainer:()=>({clientWidth:fixture.canvas.width,clientHeight:fixture.canvas.height}),project,getLayer:()=>true,queryRenderedFeatures:r=>iconBoxes().filter(b=>r[0][0]<=b[1][0]&&r[1][0]>=b[0][0]&&r[0][1]<=b[1][1]&&r[1][1]>=b[0][1]).map(()=>({properties:{id:'core-icon'}}))};
  function source(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  function ',a+1);return html.slice(a,b);}
  const phoneCamera={lng:-73.98649999999961,lat:40.698280897398234,zoom:15.097058137467243};
  for(const view of [{canvas:fixture.canvas,cameras:[fixture.camera,fixture.refinedCamera]},{canvas:{width:354,height:435},cameras:[phoneCamera]}]){
    fixture.canvas=view.canvas;
    for(const nextCamera of view.cameras)for(const focused of ['kings','vipers','oldguard','night']){camera=nextCamera;const markers=regions.slice().sort((a,b)=>Number(b.properties.ownerId===focused)-Number(a.properties.ownerId===focused)).map(region=>({region,lngLat:region.properties.anchor,element:{offsetWidth:44,offsetHeight:44,style:{}},marker:{setLngLat(){}}})),document={body:{dataset:{}}},scope=vm.createContext({map,document,holdingMarkers:markers,selectedTerritory:null,innerWidth:fixture.canvas.width,territoryById,blockLL:(_t,p)=>projection.forward(p),ZoneCompactDistrict:district,ZoneTerritoryGeometry:geometry});vm.runInContext(['regionMarkerAnchor','packFamilyMarkers','layoutHoldingMarkers'].map(source).join('\n'),scope);scope.layoutHoldingMarkers();assert.equal(markers.filter(item=>item.element.style.visibility==='visible').length,camera===fixture.camera?3:4,focused+' '+document.body.dataset.zoneFamilyPacking);}
  }
});
test('first authoritative overview settles once after style readiness and preserves genuine user camera choices',()=>{
  function source(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  function ',a+1);return html.slice(a,b);}
  function harness(){const calls=[],scope=vm.createContext({document:{addEventListener(){}},authoritativeOverviewFitted:false,initialOverviewPending:false,mapCameraTouched:false,didFit:true,lastData:{territoryAuthoritative:false},territoryData:[{id:'original'}],map:{isStyleLoaded:()=>false,getContainer:()=>({clientWidth:788,clientHeight:434})},mapIsIllustrative:data=>data?.territoryAuthoritative===false,setCityOverview:active=>calls.push(['overview',active]),fitOwnership:(blocks,duration,pitch,bearing)=>{calls.push(['fit',blocks,duration,pitch,bearing]);return true;}});vm.runInContext(['requestInitialOverview','markCameraInteraction','settleInitialOverview'].map(source).join('\n'),scope);return{scope,calls};}
  const h=harness();h.scope.requestInitialOverview(h.scope.lastData);h.scope.settleInitialOverview();assert.equal(h.calls.length,0,'illustrative fallback must not settle authoritative framing');
  h.scope.lastData={territoryAuthoritative:true};h.scope.requestInitialOverview(h.scope.lastData);h.scope.settleInitialOverview();assert.equal(h.calls.length,0,'wait for real style readiness');h.scope.map.isStyleLoaded=()=>true;h.scope.settleInitialOverview();assert.equal(h.calls.length,2);assert.equal(h.calls[1][2],0);assert.equal(h.calls[1][3],0);assert.equal(h.calls[1][4],0);assert.equal(h.scope.authoritativeOverviewFitted,true);
  h.scope.requestInitialOverview({...h.scope.lastData,revision:'new-ownership'});h.scope.settleInitialOverview();assert.equal(h.calls.length,2,'subsequent ownership snapshots must not refit the camera');
  const interacted=harness();interacted.scope.lastData={territoryAuthoritative:true};interacted.scope.requestInitialOverview(interacted.scope.lastData);interacted.scope.markCameraInteraction({isTrusted:true});interacted.scope.map.isStyleLoaded=()=>true;interacted.scope.settleInitialOverview();assert.equal(interacted.calls.length,0,'a genuine prior gesture must cancel startup recentering');assert.equal(interacted.scope.initialOverviewPending,false);
  assert.match(html,/map\.on\('idle',settleInitialOverview\)/);assert.match(html,/requestInitialOverview\(data\);\s*scheduleResize\(\)/);
});

test('cached pageshow preserves host-hidden City state and resumes work only when City was visible',()=>{
  function source(name){const start=html.indexOf('  function '+name+'('),open=html.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(start,end);}
  for(const wasVisible of [false,true]){
    const calls=[],scope=vm.createContext({mapDisposed:false,mapVisible:wasVisible,mapVisibilityBeforePageHide:null,preparedCameraRequest:0,frameSample:{cancel(){calls.push('frame-stop');}},cameraSample:{cancel(){calls.push('camera-stop');}},routeData:{},stopDash(){calls.push('dash-stop');},stopWarClock(){calls.push('clock-stop');},scheduleResize(){calls.push('resize');},syncLandmarkVisibility(){calls.push('visibility:'+scope.mapVisible);},startWarClock(){calls.push('clock-start');},startDash(){calls.push('dash-start');}});
    vm.runInContext(['handleMapPageShow','handleMapPageHide'].map(source).join('\n'),scope);
    scope.handleMapPageHide({persisted:true});assert.equal(scope.mapVisible,false);assert.equal(scope.mapVisibilityBeforePageHide,wasVisible);
    scope.handleMapPageShow({persisted:true});assert.equal(scope.mapVisible,wasVisible);assert.equal(scope.mapVisibilityBeforePageHide,null);
    assert.equal(calls.includes('clock-start'),wasVisible);assert.equal(calls.includes('dash-start'),wasVisible);assert.equal(scope.mapDisposed,false);
  }
});

test('normal pagehide disposes once and queued visibility/pageshow callbacks never revive the removed map',()=>{
  function source(name){const start=html.indexOf('  function '+name+'('),open=html.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<html.length;end++){if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(start,end);}
  const calls=[],scope=vm.createContext({mapDisposed:false,mapVisible:true,mapVisibilityBeforePageHide:null,preparedCameraRequest:0,frameSample:{cancel(){calls.push('frame-stop');}},cameraSample:{cancel(){},dispose(){calls.push('sampler-dispose');}},routeData:{},resizeFrame:7,cancelAnimationFrame(id){calls.push('cancel:'+id);},resizeObserver:{disconnect(){calls.push('observer-disconnect');}},landmarkController:{dispose(){calls.push('models-dispose');}},map:{remove(){assert.equal(scope.mapDisposed,true);calls.push('map-remove');}},document:{body:{dataset:{}},removeEventListener(){},hidden:false},window:{removeEventListener(){}},stopDash(){},stopWarClock(){},scheduleResize(){calls.push('resize');},syncLandmarkVisibility(){calls.push('visibility');},startWarClock(){calls.push('clock-start');},startDash(){calls.push('dash-start');}});
  scope.handleMapMessage=()=>{};
  vm.runInContext(['handleMapVisibility','handleMapPageShow','handleMapPageHide'].map(source).join('\n'),scope);
  scope.handleMapPageHide({persisted:false});scope.handleMapPageHide({persisted:false});scope.handleMapPageShow({persisted:true});scope.handleMapVisibility();
  assert.equal(scope.mapDisposed,true);assert.equal(scope.mapVisible,false);assert.equal(scope.resizeFrame,null);assert.equal(scope.document.body.dataset.zoneMapLifecycle,'disposed');
  assert.deepEqual(calls,['frame-stop','cancel:7','observer-disconnect','sampler-dispose','models-dispose','map-remove']);
});

test('beta102 tilted rooftop icons are selected from their actual rendered hit area, not from the ground beneath them',()=>{
  const start=html.indexOf('  function nearbyVisiblePin('),end=html.indexOf('  function emptyGeo(',start),pin={id:'hospital',_lngLat:[-73.98,40.69]},calls=[];
  const map={getLayer:()=>({}),project(){throw Error('a roof icon must not be hit-tested at ground elevation');},queryRenderedFeatures(area){calls.push(area);return Array.isArray(area)&&area[1][0]-area[0][0]===44?[{properties:{id:'hospital'}}]:[];}};
  const context=vm.createContext({map,pinData:[pin],pinDisplayed:()=>true});vm.runInContext(html.slice(start,end),context);
  assert.equal(context.nearbyVisiblePin({x:180,y:90}),pin);assert.equal(calls.length,3);assert.deepEqual(Array.from(calls[2],p=>Array.from(p)),[[158,68],[202,112]]);
  context.pinDisplayed=()=>false;assert.equal(context.nearbyVisiblePin({x:180,y:90}),null,'filtered or collision-rejected icons must not capture a territory touch');
});

test('beta102 roof symbols share elevation and ground-only glow never floats across facades, including fresh serialized layer reads',()=>{
  const layers=new Map(['zone-poi-icon','zone-poi-label','zone-poi-icon-detail','zone-poi-label-detail','zone-poi-found'].map(id=>[id,{id,type:'symbol',layout:{},paint:{}}]));
  layers.set('zone-poi-halo',{type:'circle',paint:{'circle-opacity':.96}});layers.set('zone-poi-underglow',{type:'circle',paint:{'circle-opacity':['case',true,.5,.24]}});
  let writes=0;const map={getLayer:id=>structuredClone(layers.get(id)),getLayoutProperty:(id,key)=>layers.get(id).layout[key],getPaintProperty:(id,key)=>layers.get(id).paint[key],setLayoutProperty(id,key,value){writes++;layers.get(id).layout[key]=value;},setPaintProperty(id,key,value){writes++;layers.get(id).paint[key]=value;}};
  district.syncPoiPerspective(map,true);
  for(const [id,layer]of layers)if(layer.type==='symbol'){assert.equal(layer.layout['symbol-z-elevate'],true,id);assert.equal(layer.layout['symbol-z-order'],'auto');assert.ok(layer.paint['symbol-z-offset']);}
  assert.equal(layers.get('zone-poi-halo').paint['circle-opacity'],0);assert.equal(layers.get('zone-poi-underglow').paint['circle-opacity'],0);
  assert.equal(layers.get('zone-poi-halo').paint['circle-stroke-opacity'],0,'pitched decoration must not leave a ground-level empty ring beneath an elevated coin');
  const stable=writes;for(let i=0;i<50;i++)district.syncPoiPerspective(map,true);assert.equal(writes,stable,'Mapbox getLayer serializes fresh objects; object identity must not cause idle write loops');
  district.syncPoiPerspective(map,false);for(const layer of layers.values())if(layer.type==='symbol'){assert.equal(layer.layout['symbol-z-elevate'],false);assert.equal(layer.paint['symbol-z-offset'],0);}
  assert.equal(layers.get('zone-poi-halo').paint['circle-opacity'],.96);assert.deepEqual(layers.get('zone-poi-underglow').paint['circle-opacity'],['case',true,.5,.24]);
  assert.equal(layers.get('zone-poi-halo').paint['circle-stroke-opacity'],1,'flat view restores the original stroke as well as its fill');
  const flat=writes;district.syncPoiPerspective(map,false);assert.equal(writes,flat);
});

test('beta102 ownership ground surfaces render below opaque native and complete building geometry, without changing polygons',()=>{
  const start=html.indexOf('  function ensureTerritoryLayers('),end=html.indexOf('  function updateAdjacency(',start);
  for(const complete of [false,true]){
    const layers=district.createStyle().layers.map(l=>structuredClone(l));if(complete)layers.splice(5,0,{id:'district-complete-footprints',type:'fill'},{id:'district-complete-volumes',type:'fill-extrusion'});
    const sources=new Map(),map={isStyleLoaded:()=>true,getLayer:id=>layers.find(l=>l.id===id),getSource:id=>sources.get(id),addSource:(id,s)=>sources.set(id,s),addLayer(l,before){const at=layers.findIndex(v=>v.id===before);layers.splice(at<0?layers.length:at,0,l);},getStyle:()=>({layers})};
    const context=vm.createContext({map,territoryData:[{id:'original'}],territoryGeo:()=>({type:'FeatureCollection',features:[]}),rebuildOwnership:()=>({type:'FeatureCollection',features:[]}),ownershipOpacity:()=>.2,document:{body:{dataset:{}}}});vm.runInContext(html.slice(start,end),context);context.ensureTerritoryLayers();
    const order=layers.map(l=>l.id),volumes=complete?['district-buildings-3d','district-complete-volumes']:['district-buildings-3d'];
    for(const ground of ['zone-ownership-fill','zone-block-feedback'])for(const volume of volumes)assert.ok(order.indexOf(ground)<order.indexOf(volume),ground+' must not paint over '+volume);
    assert.equal(context.territoryData[0].id,'original');assert.equal(layers.find(l=>l.id==='zone-blocks-fill').paint['fill-opacity'],0,'engine hit geometry remains unchanged and invisible');
  }
});

test('beta102 pitched camera envelope prevents near-plane roof slicing using measured height, latitude and viewport rather than flattening buildings',()=>{
  for(const height of [435,500,910])for(const pitch of [35,38,60]){
    const latitude=40.698,roof=95,zoom=district.perspectiveZoomLimit(height,latitude,pitch,roof),cameraHeight=height*1.5*district.CIRCUMFERENCE*Math.cos(latitude*Math.PI/180)*Math.cos(pitch*Math.PI/180)/(512*2**zoom);
    assert.ok(zoom<=20&&zoom>13.2);assert.ok(cameraHeight>=roof*1.25-1e-7,'camera must remain above complete provider roofs');
  }
  assert.equal(district.perspectiveZoomLimit(500,40.698,0,95),20,'flat exploration retains the original zoom range');assert.equal(district.perspectiveZoomLimit(500,40.698,35,0),20,'unavailable provider height must not invent a roof');
});

test('beta102 meaningful core labels place before optional secondary names even without family markers, with stable idle order',()=>{
  const order=['background','district-road-labels','zone-poi-icon','zone-poi-label','zone-poi-icon-detail'],unchanged=['background'];let moves=0;
  const map={getStyle:()=>({layers:order.map(id=>({id}))}),getLayer:id=>order.includes(id)?{id}:null,moveLayer(id){moves++;order.splice(order.indexOf(id),1);order.push(id);}};
  district.prioritizeBadgeReservations(map);
  assert.ok(order.indexOf('zone-poi-icon-detail')<order.indexOf('zone-poi-label'),'secondary text must yield to readable core names in Mapbox reverse layer placement');
  assert.ok(order.indexOf('zone-poi-label')<order.indexOf('zone-poi-icon'),'all core coins retain guaranteed placement ahead of optional text');
  assert.ok(order.indexOf('district-road-labels')<order.indexOf('zone-poi-icon-detail'));assert.equal(order.filter(id=>unchanged.includes(id)).join(','),'background');assert.equal(new Set(order).size,5,'no icon, POI name layer or world layer is deleted');
  const settled=moves;for(let i=0;i<30;i++)district.prioritizeBadgeReservations(map);assert.equal(moves,settled,'placement priorities must not cause idle reorder loops');
});

test('beta102 a live existing style can apply perspective while unrelated tile requests are pending',()=>{
  const layers=new Map(district.createStyle().layers.map(layer=>[layer.id,layer]));let writes=0;
  const map={isStyleLoaded:()=>false,getStyle:()=>({layers:[...layers.values()]}),getLayer:id=>layers.get(id),setLayoutProperty(id,key,value){writes++;layers.get(id).layout[key]=value;}};
  district.setPerspective(map,true);assert.equal(layers.get('district-buildings-3d').layout.visibility,'visible');assert.equal(writes,1,'pending provider sources must not leave perspective and its safe camera envelope stuck in the flat state');
});

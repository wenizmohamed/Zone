import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url),district=require('../assets/city/compact-district.js'),buildings=require('../assets/city/service-buildings108.js');
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
const hitCode=html.slice(html.indexOf('  function nearbyVisiblePin('),html.indexOf('  function emptyGeo(',html.indexOf('  function nearbyVisiblePin(')));
const layerCode=html.slice(html.indexOf('  function ensurePoiLayers('),html.indexOf('  function syncPoiSource(',html.indexOf('  function ensurePoiLayers(')));
const displayCode=html.slice(html.indexOf('  var OVERVIEW_POIS='),html.indexOf('  function poiGeo(',html.indexOf('  var OVERVIEW_POIS=')));
const origin=[-73.9865,40.698],point=(x,y)=>[origin[0]+(x-100)/100000,origin[1]+(y-100)/100000];
function pin(id,x,y,height=20){return{id,screen:id,screenAvailable:true,label:id,icon:id,_lngLat:point(x,y),height};}
function roof(p,{height=p.height,underground='false',hole=false}={}){const [x,y]=p._lngLat,d=.00004,rings=[[[x-d,y-d],[x+d,y-d],[x+d,y+d],[x-d,y+d],[x-d,y-d]]];if(hole)rings.push([[x-d/2,y-d/2],[x+d/2,y-d/2],[x+d/2,y+d/2],[x-d/2,y+d/2],[x-d/2,y-d/2]]);return{type:'Feature',properties:{height,min_height:0,extrude:'true',underground},geometry:{type:'Polygon',coordinates:rings}};}
function feature(p,layer='zone-poi-icon',landmarkHeight=2){return{type:'Feature',properties:{id:p.id,label:p.label,iconImage:'zone-poi-'+p.icon,landmarkHeight},geometry:{type:'Point',coordinates:p._lngLat.slice()},layer:{id:layer}};}
function harness(pins,{pitch=35,zoom=16,query=()=>[],completeRoofs=pins.map(p=>roof(p)),nativeRoofs=completeRoofs,projectUnavailable=false,reverseLayers=false}={}){
  const layers=new Map(district.createStyle().layers.map(l=>[l.id,structuredClone(l)])),sources=new Map(),queries=[],projections=[],messages=[],selected=[],handlers={},document={body:{dataset:{}}};
  layers.get('district-buildings-3d').layout.visibility=pitch>1?'visible':'none';
  layers.set('district-complete-volumes',{...structuredClone(layers.get('district-buildings-3d')),id:'district-complete-volumes',source:'district-complete-buildings',minzoom:13.2,maxzoom:16});
  sources.set('district-complete-buildings',{serialize:()=>({data:{type:'FeatureCollection',features:completeRoofs}})});
  const project=(coordinates,altitude=0)=>({x:100+(coordinates[0]-origin[0])*100000,y:100+(coordinates[1]-origin[1])*100000-altitude*Math.sin(pitch*Math.PI/180)});
  const map={getZoom:()=>zoom,getPitch:()=>pitch,isStyleLoaded:()=>true,getLayer:id=>layers.get(id),getStyle:()=>({layers:[...layers.values()]}),getSource:id=>sources.get(id),addSource:(id,value)=>sources.set(id,value),addLayer:layer=>layers.set(layer.id,layer),
    getLayoutProperty:(id,key)=>layers.get(id)?.layout?.[key],getPaintProperty:(id,key)=>layers.get(id)?.paint?.[key],setLayoutProperty:(id,key,value)=>{(layers.get(id).layout||={})[key]=value;},setPaintProperty:(id,key,value)=>{(layers.get(id).paint||={})[key]=value;},
    querySourceFeatures:()=>nativeRoofs,project(coordinates,altitude){projections.push({coordinates:[...coordinates],altitude});if(projectUnavailable)throw Error('explicit-altitude projection unavailable');if(pitch>1)assert.ok(altitude>0,'pitched ranking must never project ground coordinates');return project(coordinates,altitude);},
    queryRenderedFeatures(area,options){const radius=Array.isArray(area)?Math.round((area[1][0]-area[0][0])/2):0;queries.push({area,radius,layers:options.layers});return query(radius,options.layers);},on:(type,callback)=>handlers[type]=callback};
  const scope=vm.createContext({map,ZoneCompactDistrict:district,ZoneServiceBuildings:buildings,pinData:pins,document,ensurePoiImage(){},poiGeo:()=>({type:'FeatureCollection',features:[]}),emptyGeo:()=>({type:'FeatureCollection',features:[]}),pinVisible:p=>!p.hidden,selected:null,
    parent:{postMessage:(data,target)=>messages.push({data,target})},window:{},location:{origin:'http://map.test'},selectPin:p=>selected.push(p),territoryAt:()=>null,selectTerritory(){},deselect(){}});
  vm.runInContext(layerCode,scope);scope.ensurePoiLayers();assert.equal(document.body.dataset.zonePoiErr,undefined);
  if(reverseLayers){const symbols=[...layers].filter(([,l])=>l.type==='symbol').reverse();for(const [id]of symbols)layers.delete(id);for(const [id,l]of symbols)layers.set(id,l);}
  vm.runInContext(displayCode+'\n'+hitCode,scope);
  const activate=html.indexOf('  function activatePin(');vm.runInContext(html.slice(activate,html.indexOf('  function selectPin(',activate)),scope);
  const click=html.indexOf("  map.on('click',function(e){");vm.runInContext(html.slice(click,html.indexOf("  document.addEventListener('keydown'",click)),scope);
  return{scope,map,layers,queries,projections,messages,selected,document,pick:p=>scope.nearbyVisiblePin(p),click:p=>handlers.click({point:p,lngLat:{lng:origin[0],lat:origin[1]}}),center:(p,height=p.height,offset=pitch>1?2:0)=>project(p._lngLat,pitch>1?height+offset:0),get receipt(){return JSON.parse(document.body.dataset.zonePoiHit||'null');}};
}

test('near-coincident elevated coins select the nearest real roof center in either feature order, not the nearer ground point',()=>{
  const bank=pin('bank',100,200,100),missions=pin('missions',105,150,10),before=JSON.stringify([bank,missions]);
  for(const order of [[bank,missions],[missions,bank]]){const h=harness([bank,missions],{zoom:15.097,query:()=>order.map(p=>feature(p))}),click=h.center(bank);h.click(click);
    assert.equal(h.messages.length,1);assert.equal(h.messages[0].data.zoneGo,'bank');assert.equal(h.messages[0].data.MARKER_CLICK,'bank');assert.equal(h.receipt.selectionReason,'nearest-direct-coin');assert.ok(h.projections.every(p=>p.altitude>0));assert.deepEqual(new Set(h.projections.map(p=>p.altitude)),new Set([102,12]));}
  assert.equal(JSON.stringify([bank,missions]),before,'hit ranking cannot relocate services or change source geometry');
});

test('opposite actual symbol layer and query orders do not make a farther service coin win',()=>{
  const bank=pin('bank',100,180,20),jail=pin('jail',103,181,20);
  for(const reverseLayers of [false,true]){const values=reverseLayers?[feature(jail,'zone-poi-icon-service'),feature(bank)]:[feature(bank),feature(jail,'zone-poi-icon-service')];const h=harness([bank,jail],{zoom:16.2,reverseLayers,query:()=>values});h.click(h.center(bank));assert.equal(h.messages[0].data.zoneGo,'bank');assert.equal(h.receipt.selectedId,'bank');}
});

test('a direct coin including its outer stroke beats an exact neighbor label and the smaller-radius query order',()=>{
  const bank=pin('bank',100,160,20),missions=pin('missions',170,160,20),h=harness([bank,missions],{zoom:15.097,query:radius=>radius===0?[feature(missions)]:[feature(missions),feature(bank)]});
  const click=h.center(bank);click.x+=8.2;h.click(click);assert.equal(h.messages[0].data.MARKER_CLICK,'bank');assert.equal(h.receipt.selectionReason,'nearest-direct-coin');assert.deepEqual(h.queries.map(q=>q.radius),[0,12,22]);
});

test('an intentional label click remains usable and beats a neighbor that is only in the touch neighborhood',()=>{
  const bank=pin('bank',116,160,20),missions=pin('missions',160,160,20),h=harness([bank,missions],{zoom:15.097,query:radius=>radius===0?[feature(missions)]:[feature(bank),feature(missions)]});
  const click=h.center(bank);click.x=100;h.click(click);assert.equal(h.messages[0].data.MARKER_CLICK,'missions');assert.equal(h.receipt.selectionReason,'nearest-exact-label');
});

test('the existing 44px query neighborhood remains usable around the rendered artwork rather than a ground hitbox',()=>{
  const bank=pin('bank',128,160,20),missions=pin('missions',190,160,20),h=harness([bank,missions],{zoom:15.097,query:radius=>radius===22?[feature(missions),feature(bank)]:[]}),click=h.center(bank);click.x=100;
  h.click(click);assert.equal(h.messages[0].data.MARKER_CLICK,'bank');assert.equal(h.receipt.selectionReason,'nearest-coin-touch');assert.deepEqual(h.queries.map(q=>q.radius),[0,12,22]);assert.ok(h.queries.every(q=>!q.layers.some(id=>/hitbox|reservation/.test(id))));
});

test('a unique rendered feature works without elevation projection, while ambiguous unavailable centers never choose by order',()=>{
  const bank=pin('bank',100,160),missions=pin('missions',110,160);
  const unique=harness([bank],{projectUnavailable:true,query:radius=>radius===12?[feature(bank)]:[]});unique.click({x:244.8,y:190.85});assert.equal(unique.messages[0].data.MARKER_CLICK,'bank');assert.equal(unique.projections.length,0);assert.equal(unique.receipt.selectionReason,'unique-rendered-feature');
  for(const order of [[bank,missions],[missions,bank]]){const h=harness([bank,missions],{projectUnavailable:true,query:()=>order.map(p=>feature(p))});h.click({x:100,y:100});assert.equal(h.messages.length,0);assert.equal(h.receipt.selectedId,null);assert.equal(h.receipt.selectionReason,'ambiguous-unavailable-roof-center');}
});

test('missing roofs, unrecognized icon expressions and translated icons cannot be silently ranked at ground level',()=>{
  const bank=pin('bank',100,160),missions=pin('missions',110,160);
  for(const change of ['missing-roofs','unknown-size','translated-icon']){const h=harness([bank,missions],{nativeRoofs:change==='missing-roofs'?[]:undefined,query:()=>[feature(missions),feature(bank)]});if(change==='unknown-size')h.layers.get('zone-poi-icon').layout['icon-size']=['feature-state','unverifiedSize'];if(change==='translated-icon')h.layers.get('zone-poi-icon').layout['icon-offset']=[4,0];h.click({x:100,y:100});assert.equal(h.messages.length,0);assert.equal(h.receipt.selectionReason,'ambiguous-unavailable-roof-center');}
});

test('native close-detail roofs, actual symbol offset and polygon holes override stale overview or association heights',()=>{
  const bank=pin('bank',100,180,40),missions=pin('missions',130,180,10);bank._buildingAssociation={insideRoof:true,heightMeters:999};
  const h=harness([bank,missions],{zoom:16.2,completeRoofs:[roof(bank,{height:200}),roof(missions,{height:200})],nativeRoofs:[roof(bank),roof(bank,{height:500,hole:true}),roof(bank,{height:800,underground:'true'}),roof(missions)],query:()=>[feature(missions),feature(bank,'zone-poi-icon',6)]});
  h.click(h.center(bank,40,6));assert.equal(h.messages[0].data.MARKER_CLICK,'bank');const value=h.receipt.candidates.find(c=>c.id==='bank');assert.equal(value.center.altitude,46);assert.ok(h.projections.every(p=>p.altitude!==999&&p.altitude!==206));
});

test('flat symbols use their actual flat centers, and exactly coincident candidates stay explicitly unresolved',()=>{
  const bank=pin('bank',100,100),missions=pin('missions',103,100),flat=harness([bank,missions],{pitch:0,query:()=>[feature(missions),feature(bank)]});flat.click({x:100,y:100});assert.equal(flat.messages[0].data.MARKER_CLICK,'bank');assert.ok(flat.projections.every(p=>p.altitude===0));
  const same=pin('missions',100,100),coincident=harness([bank,same],{query:()=>[feature(same),feature(bank)]});coincident.click(coincident.center(bank));assert.equal(coincident.messages.length,0);assert.equal(coincident.receipt.selectionReason,'ambiguous-equal-distance');
});

test('service visibility starts at its actual 15.8 artwork threshold while decorative detail retains 16.8',()=>{
  const jail=pin('jail',100,100),pharmacy=pin('pharmacy',110,100);
  for(const [zoom,service,detail]of[[15.79,false,false],[15.8,true,false],[16.2,true,false],[16.8,true,true]]){const h=harness([jail,pharmacy],{zoom});assert.equal(Boolean(h.scope.pinDisplayed(jail)),service);assert.equal(Boolean(h.scope.pinDisplayed(pharmacy)),detail);}
  const hidden={...jail,hidden:true},h=harness([hidden],{zoom:17,query:()=>[feature(hidden)]});h.click({x:100,y:100});assert.equal(h.messages.length,0);assert.equal(h.receipt.selectionReason,'no-rendered-location');
});

test('diagnostics retain ordered query evidence, artwork identity and ranked elevated candidates for the parent receipt',()=>{
  const bank=pin('bank',100,180,20),missions=pin('missions',106,180,20),h=harness([bank,missions],{query:()=>[feature(missions),feature(bank),feature(bank)]});h.click(h.center(bank));
  assert.equal(h.receipt.attempts.length,3);assert.equal(h.receipt.attempts[0].hits[0].iconImage,'zone-poi-missions');assert.equal(h.receipt.attempts[0].hits[0].label,'missions');assert.equal(h.receipt.candidates.length,2);assert.ok(h.receipt.candidates.every(c=>c.center&&Number.isFinite(c.distance)));assert.equal(h.messages.length,1);assert.equal(h.document.body.dataset.zoneClickPoi,'bank');
});

test('ranking follows the returned rendered tile geometry while newer main-thread pins already hold different bound coordinates',()=>{
  const drawn=pin('bank',100,180,12.8),newer=pin('bank',160,180,80),missions=pin('missions',106,180,12.8);
  const h=harness([newer,missions],{nativeRoofs:[roof(drawn),roof(missions)],query:()=>[feature(missions),feature(drawn)]});h.click(h.center(drawn));
  assert.equal(h.messages[0].data.MARKER_CLICK,'bank');const actual=h.receipt.candidates.find(c=>c.id==='bank').center;assert.ok(Math.abs(actual.x-100)<.000001);assert.equal(actual.altitude,14.8);assert.notEqual(actual.x,h.center(newer).x);
});

function scriptFunction(name){const start=html.indexOf('  function '+name+'('),end=html.indexOf('\n  function ',start+1);assert.ok(start>=0&&end>start);return html.slice(start,end);}
function inertNode(){return{dataset:{},style:{},value:'',hidden:false,classList:{contains:()=>false,toggle(){},add(){},remove(){}},setAttribute(){},getAttribute:()=>'',querySelector:()=>inertNode(),appendChild(){}};}
function packetReplayHarness({providerReady=true,controllerReady=true}={}){
  // Actual render/publishing/controller/apply code; only unrelated UI widgets
  // and expensive footprint matching are isolated. These are the reported Gym
  // source and provider-associated coordinates, without persisting provider tiles.
  const authored=[-73.98666229328933,40.69922348020131],bound=[-73.98702225387096,40.69915627719824],features=[{}],writes=[],events=new Map();let computations=0;
  const result={source:'actual-provider-footprint',complete:true,unbound:[],associations:[{id:'gym',sourceCoordinates:authored,coordinates:bound,providerId:'357281505',heightMeters:12.8,insideRoof:true}]};
  const previous=globalThis.ZoneServiceBuildings;globalThis.ZoneServiceBuildings={...buildings,associate(){computations++;return result;}};
  const map={getSource(id){return id==='district-complete-buildings'&&providerReady?{serialize:()=>({data:{features}})}:id==='zone-pois'?{setData(data){writes.push(structuredClone(data.features[0]));}}:null;},on(type,fn){events.set(type,fn);},fire(type){events.get(type)?.();}};
  const el=new Proxy({},{get(target,key){return target[key]||=inertNode();}}),document={body:{dataset:{},classList:inertNode().classList},documentElement:{},getElementById:()=>inertNode(),querySelector:()=>inertNode()};
  const scope=vm.createContext({map,el,document,pinData:[],pinById:{},hereLL:null,selected:null,selectedTerritory:null,lastData:null,activeCats:{},lang:'en',mapMode:'territories',territoryFilter:null,copy:{},COPY_EN:{},COPY_AR:{},activeLightPreset:'night',territoryData:[],mapDisposed:false,found:new Set(),NEUTRAL_COLOR:'#68717b',OVERVIEW_POIS:['gym'],hideFound:false,landmarkController:null,
    ensurePoiLayers(){},overviewPoi:()=>true,locationPriority:()=>0,pinColor:()=>'',pinVisible:()=>true,pointCoordinates:p=>p.coordinates.slice(),poiIconKey:p=>p.icon,localText:(v,f)=>v??f,pick:(p,keys,f)=>{for(const key of keys)if(p[key]!=null)return p[key];return f;},mapIsIllustrative:()=>false,illustrativeMessage:()=>'',L:x=>x,C:x=>x,localizeMapControls(){},syncMapExpandedControl(){},sync3DControl(){},syncTerritories(){},constrainCity(){},selectTerritory(){},selectPin(){},closePanel(){},clearRoute(){},hideHud(){},applyBasemapLighting(){},filterSidebar(){},updateProg(){},applyOwnershipStyle(){},syncHoldingMarkers(){},renderFamily(){},renderTerritoryList(){},refreshAtlasReadout(){},requestInitialOverview(){},scheduleResize(){}});
  vm.runInContext(['normalizePin','poiGeo','syncPoiSource','setMode','clearAll','render'].map(scriptFunction).join('\n'),scope);
  const control=district.controller(map);if(controllerReady)scope.landmarkController=control;
  return{authored,bound,writes,scope,control,get computations(){return computations;},packet:lang=>({zonePins:[{id:'gym',icon:'gym',label:lang==='ar'?'النادي':'Gym',coordinates:authored.slice()}],blocks:[],legend:[],copy:{},dark:true,lang,dir:lang==='ar'?'rtl':'ltr'}),
    makeReady(){providerReady=true;scope.landmarkController=control;control.setDestinations(scope.pinData);},idle(){control.setDestinations(scope.pinData);},close(){control.dispose();if(previous===undefined)delete globalThis.ZoneServiceBuildings;else globalThis.ZoneServiceBuildings=previous;}};
}

test('repeated real map packets replay cached associations before every GeoJSON publication, including hidden and shown packets',()=>{
  const h=packetReplayHarness();try{
    const first=h.packet('en'),original=JSON.stringify(first);h.scope.render(first);assert.ok(h.writes.length>0);assert.ok(h.writes.every(f=>JSON.stringify(f.geometry.coordinates)===JSON.stringify(h.bound)),'a ready controller never publishes an authored intermediate');assert.equal(JSON.stringify(first),original);
    const prior=h.writes.length;h.control.setVisible(false);const next=h.packet('ar'),before=JSON.stringify(next);h.scope.render(next);h.control.setVisible(true);h.idle();
    assert.ok(h.writes.slice(prior).every(f=>JSON.stringify(f.geometry.coordinates)===JSON.stringify(h.bound)));assert.equal(h.writes.at(-1).properties.label,'النادي');assert.equal(h.computations,1,'matching is cached but apply still runs on the replacement objects');assert.equal(JSON.stringify(next),before);assert.deepEqual(Array.from(h.scope.pinData[0]._buildingSource),h.authored);assert.deepEqual(Array.from(h.scope.pinData[0]._lngLat),h.bound);
    const stable=h.writes.length;h.idle();h.idle();assert.equal(h.writes.length,stable,'settled idle checks must not cause another source update loop');
  }finally{h.close();}
});

test('cold startup remains authored only until the controller and provider data exist, then later packets stay bound',()=>{
  for(const options of [{providerReady:false},{controllerReady:false}]){const h=packetReplayHarness(options);try{
    h.scope.render(h.packet('en'));assert.deepEqual(h.writes.at(-1).geometry.coordinates,h.authored);assert.equal(h.computations,0);
    h.makeReady();assert.deepEqual(h.writes.at(-1).geometry.coordinates,h.bound);const settled=h.writes.length;h.scope.render(h.packet('ar'));assert.ok(h.writes.slice(settled).every(f=>JSON.stringify(f.geometry.coordinates)===JSON.stringify(h.bound)));assert.equal(h.computations,1);
  }finally{h.close();}}
});

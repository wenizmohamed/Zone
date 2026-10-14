import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),district=require('../assets/city/compact-district.js');
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');

function locationClickHarness(pin, embedded=true){
  const messages=[],selections=[],territories=[],handlers={};
  const parent={postMessage:(data,origin)=>messages.push({data,origin})};
  const window=embedded?{}:parent;
  const map={on:(event,handler)=>handlers[event]=handler};
  const context=vm.createContext({map,parent,window,location:{origin:'https://zone.example'},document:{body:{dataset:{}}},nearbyVisiblePin:()=>pin,selectPin:p=>selections.push(p),territoryAt:()=>({id:'ZC-034'}),selectTerritory:t=>territories.push(t),deselect:()=>{}});
  const activate=html.indexOf('  function activatePin(');
  if(activate>=0){const end=html.indexOf('  function selectPin(',activate);vm.runInContext(html.slice(activate,end),context);}
  const from=html.indexOf("  map.on('click',function(e){"),until=html.indexOf("  document.addEventListener('keydown'",from);
  vm.runInContext(html.slice(from,until),context);
  handlers.click({point:{x:140,y:110},lngLat:{lng:0,lat:0}});
  return {messages,selections,territories};
}

test('one embedded icon click opens its own building destination without an intermediate details panel',()=>{
  const pin={id:'bank',screen:'bank',screenAvailable:true};
  const result=locationClickHarness(pin);
  assert.equal(result.messages.length,1,'one icon click must request its destination');
  assert.equal(result.messages[0].data.zoneGo,'bank');
  assert.equal(result.messages[0].data.MARKER_CLICK,'bank');
  assert.equal(result.messages[0].origin,'https://zone.example');
  assert.equal(result.selections.length,0,'no second Open button required');
  assert.equal(result.territories.length,0,'the icon must not select a different underlying block');
});

test('unavailable building services keep their explanatory details and never navigate',()=>{
  const pin={id:'bank',screen:'bank',screenAvailable:false};
  const result=locationClickHarness(pin);
  assert.equal(result.messages.length,0);
  assert.equal(result.selections[0],pin);
});

test('standalone map previews retain location details rather than sending self-navigation',()=>{
  const pin={id:'bank',screen:'bank',screenAvailable:true};
  const result=locationClickHarness(pin,false);
  assert.equal(result.messages.length,0);
  assert.equal(result.selections[0],pin);
});

test('empty map clicks retain territory inspection without requesting a building destination',()=>{
  const result=locationClickHarness(null);
  assert.equal(result.messages.length,0);
  assert.equal(result.territories[0].id,'ZC-034');
});

test('playable building icons place before decorative locations and their captions',()=>{
  const layers=poiLayers(),details=layers.find(l=>l.id==='zone-poi-icon-detail');
  assert.deepEqual(Array.from(details.layout['symbol-sort-key']),['get','detailPriority']);
  const from=html.indexOf('  function locationPriority('),until=html.indexOf('  function poiGeo(',from);
  assert.ok(from>=0&&until>from,'building placement priority helper exists');
  const context=vm.createContext({});vm.runInContext(html.slice(from,until),context);
  for(const id of ['bank','jobs','gym','school','hospital','jail','market','home','casino','alley','hq','missions','arena','news','shop','pier','hof']){
    assert.ok(context.locationPriority({id})<context.locationPriority({id:'morgue'}),id+' must remain clickable before decorative labels');
  }
});

test('the remaining game buildings keep visible native coins instead of losing their icon to decorative text',()=>{
  const layers=poiLayers(),service=layers.find(l=>l.id==='zone-poi-icon-service');
  assert.ok(service,'game building coins need their own guaranteed native placement');
  assert.equal(service.layout['icon-allow-overlap'],true);
  assert.equal(service.layout['icon-ignore-placement'],false);
  assert.equal(service.minzoom,15.8);
  const reservation=layers.find(l=>l.id==='zone-poi-service-reservations');
  assert.ok(reservation,'game coin touch areas reserve space before decorative captions');
  assert.deepEqual(reservation.filter,service.filter);
  assert.equal(reservation.paint['icon-opacity'],.001);
});
function poiLayers(){
  const a=html.indexOf('  function ensurePoiLayers('),b=html.indexOf('  function syncPoiSource(',a),layers=[],sources=new Map();
  const map={isStyleLoaded:()=>true,getLayer:id=>layers.find(l=>l.id===id),addLayer:l=>{if(layers.some(prior=>prior.id===l.id))throw new Error('duplicate '+l.id);layers.push(l);},getStyle:()=>({layers}),getSource:id=>sources.get(id),addSource:(id,s)=>sources.set(id,s)};
  const scope=vm.createContext({map,ZoneCompactDistrict:district,pinData:[],document:{body:{dataset:{}}},ensurePoiImage(){},poiGeo:()=>({type:'FeatureCollection',features:[]}),emptyGeo:()=>({type:'FeatureCollection',features:[]})});
  vm.runInContext(html.slice(a,b),scope);scope.ensurePoiLayers();assert.equal(scope.document.body.dataset.zonePoiErr,undefined);
  Object.defineProperties(layers,{recover:{value:()=>scope.ensurePoiLayers()},diagnostic:{value:()=>scope.document.body.dataset.zonePoiErr}});return layers;
}

test('a missing game service layer or reservation is restored without duplicating existing detail icons',()=>{
  const layers=poiLayers();
  for(const id of ['zone-poi-icon-service','zone-poi-service-reservations']){
    layers.splice(layers.findIndex(l=>l.id===id),1);layers.recover();
    assert.ok(layers.some(l=>l.id===id),id+' must recover independently');
    assert.equal(layers.diagnostic(),undefined);
    assert.equal(new Set(layers.map(l=>l.id)).size,layers.length,'existing art layers must not be added twice');
  }
});
test('every location name has one fixed, centered anchor below its own icon, never a free floating side placement',()=>{
  const groups=poiLayers().filter(l=>l.layout?.['text-field']?.[1]==='label');
  assert.deepEqual(groups.map(l=>l.id).sort(),['zone-poi-icon','zone-poi-icon-detail','zone-poi-icon-service']);
  for(const l of groups){
    assert.ok(l.layout['icon-image'],'icon and name must share one actual symbol placement');
    assert.equal(l.layout['text-anchor'],'top');
    assert.equal(l.layout['text-offset'][0],0);
    assert.equal(l.layout['text-offset'][1],2.2,'caption gap must clear the coin reservation and text padding');
    assert.equal(l.layout['text-variable-anchor'],undefined,l.id+' must not detach the name toward a neighboring coin');
    assert.equal(l.layout['text-radial-offset'],undefined);
    assert.equal(l.layout['text-allow-overlap'],false);
  }
});
test('authored rooftop offset starts only at the same zoom where its actual building renders',()=>{
  const l={id:'zone-poi-icon',type:'symbol',layout:{},paint:{}},map={getLayer:id=>id===l.id?l:null,getLayoutProperty:(_id,k)=>l.layout[k],getPaintProperty:(_id,k)=>l.paint[k],setLayoutProperty:(_id,k,v)=>l.layout[k]=v,setPaintProperty:(_id,k,v)=>l.paint[k]=v};
  district.syncPoiPerspective(map,true);
  const e=l.paint['symbol-z-offset'];assert.equal(e[0],'step');assert.equal(e[1][0],'zoom');assert.equal(e[2],2);assert.equal(e[3],15.8);
  const model=readFileSync(new URL('../dist/district-landmarks.js',import.meta.url),'utf8');assert.match(model,/map\.getZoom\(\)<15\.8/);
  district.syncPoiPerspective(map,false);assert.equal(l.paint['symbol-z-offset'],0);
});
test('authored elevation measures the service roof and sign, not a taller streetlight or neighboring water tower',()=>{
  const model=readFileSync(new URL('../dist/district-landmarks.js',import.meta.url),'utf8');
  assert.match(model,/heightMeters=new THREE\.Box3\(\)\.setFromObject\(building\)\.max\.y/);
  assert.doesNotMatch(model,/heightMeters=new THREE\.Box3\(\)\.setFromObject\(group\)/);
});
test('a paired location name cannot falsely block a family badge when its coin is outside the badge rectangle',()=>{
  const feature={geometry:{type:'Point',coordinates:[110,110]},properties:{id:'bank'},layer:{layout:{'icon-size':.74}}};
  const map={getLayer:()=>({}),getPitch:()=>0,project:p=>({x:p[0],y:p[1]}),queryRenderedFeatures:()=>[feature]};
  assert.equal(district.collidesWithSymbols(map,[[90,140],[130,160]],true),false,'text-only query hit must not hide a family');
  assert.equal(district.collidesWithSymbols(map,[[90,140],[130,160]],false),true,'full label protection is still available for a selected holding');
  assert.equal(district.collidesWithSymbols(map,[[90,90],[130,130]],true),true,'the actual coin keeps its protected area');
});
test('family collision checks use actual pitched coin elevation and provider roof containment, including polygon holes',()=>{
  const ring=[[0,0],[20,0],[20,20],[0,20],[0,0]],hole=[[8,8],[12,8],[12,12],[8,12],[8,8]],data={features:[{properties:{extrude:'true',height:100},geometry:{type:'Polygon',coordinates:[ring,hole]}},{properties:{extrude:'true',height:10},geometry:{type:'Polygon',coordinates:[ring]}}]};
  const feature={geometry:{type:'Point',coordinates:[10,10]},properties:{id:'bank',landmarkHeight:30},layer:{layout:{'icon-size':.74}}};let projected;
  const map={getLayer:()=>({}),getPitch:()=>35,getZoom:()=>15.1,getSource:()=>({serialize:()=>({data})}),project:(p,h)=>{projected=h;return{x:100,y:100-h}},queryRenderedFeatures:()=>[feature]};
  assert.equal(district.collidesWithSymbols(map,[[90,70],[110,100]],true),true);assert.equal(projected,12,'a courtyard must not inherit the surrounding 100m roof or a hidden custom roof');
});
test('all core coins reserve their true footprint before captions without duplicating visible art or owning clicks',()=>{
  const layers=poiLayers(),core=layers.find(l=>l.id==='zone-poi-icon'),reserve=layers.find(l=>l.id==='zone-poi-coin-reservations');
  assert.ok(reserve);assert.deepEqual(reserve.filter,core.filter);assert.deepEqual(reserve.layout['icon-image'],core.layout['icon-image']);
  assert.equal(reserve.layout['icon-size'],core.layout['icon-size']);assert.equal(reserve.layout['icon-padding'],core.layout['icon-padding']);assert.equal(reserve.paint['icon-opacity'],.001);assert.equal(reserve.layout['text-field'],undefined);
  const hit=html.slice(html.indexOf('  function nearbyVisiblePin('),html.indexOf('  function emptyGeo('));assert.doesNotMatch(hit,/zone-poi-coin-reservations/);
});
test('coin reservations then family touch areas place before paired captions and share their exact elevation',()=>{
  const order=['zone-poi-coin-reservations','zone-poi-icon','zone-family-reservations','zone-poi-icon-detail'],layers=new Map(order.map(id=>[id,{id,type:'symbol',layout:{},paint:{}}]));
  const map={getStyle:()=>({layers:order.map(id=>layers.get(id))}),getLayer:id=>layers.get(id),moveLayer(id){order.splice(order.indexOf(id),1);order.push(id)},getLayoutProperty:(id,k)=>layers.get(id).layout[k],getPaintProperty:(id,k)=>layers.get(id).paint[k],setLayoutProperty:(id,k,v)=>layers.get(id).layout[k]=v,setPaintProperty:(id,k,v)=>layers.get(id).paint[k]=v};
  district.prioritizeBadgeReservations(map);assert.ok(order.indexOf('zone-poi-icon')<order.indexOf('zone-family-reservations'));assert.ok(order.indexOf('zone-family-reservations')<order.indexOf('zone-poi-coin-reservations'));
  district.syncPoiPerspective(map,true);assert.deepEqual(layers.get('zone-poi-icon').paint['symbol-z-offset'],layers.get('zone-poi-coin-reservations').paint['symbol-z-offset']);
});

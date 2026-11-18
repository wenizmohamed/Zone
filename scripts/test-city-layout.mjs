import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegacyScript } from './load-legacy-script.mjs';
const { createPlacements, insidePolygon, createStreets, selectVisiblePlacements, summarizePlacements, summarizeStreets, supportedLayoutModels, isSupportedLayoutModel, maxPlacementWidthMeters, cullingBudgets, supportedLayoutModelCount, buildingLayoutModels, propLayoutModels, isBuildingLayoutModel, layoutSedanWidthMeters, layoutBushWidthMeters, layoutStreetlightWidthMeters, layoutMaxMercatorLatitude, layoutCandidatesPerCellCount } = loadLegacyScript(new URL('../dist/city-layout.js', import.meta.url));
const cell = (id, x=0) => ({type:'Feature',id,properties:{ownerId:'vipers'},geometry:{type:'Polygon',coordinates:[[[x,0],[x+1,0],[x+1,1],[x,1],[x,0]]]}});

test('placements are deterministic and remain within their authoritative blocks',()=>{
  const data=[cell('ZC-001'),cell('ZC-002',1)];
  const a=createPlacements(data),b=createPlacements(data);
  assert.deepEqual(a,b);
  assert.ok(a.length >=4);
  for(const p of a){
    const block=data.find(f=>f.id===p.blockId);
    assert.ok(insidePolygon(p.coordinates,block.geometry.coordinates));
    assert.ok(Number.isFinite(p.width) && p.width>0 && p.width<=140);
  }
});
test('holes and malformed features never receive invented model placements',()=>{
  const donut=cell('hole');donut.geometry.coordinates.push([[.05,.05],[.95,.05],[.95,.95],[.05,.95],[.05,.05]]);
  assert.equal(insidePolygon([.5,.5],donut.geometry.coordinates),false);
  for(const p of createPlacements([donut]))assert.ok(insidePolygon(p.coordinates,donut.geometry.coordinates));
  assert.deepEqual(createPlacements([{}, {geometry:{type:'Point',coordinates:[0,0]}}]),[]);
});
test('generation is bounded and does not mutate or infer faction ownership',()=>{
  const f=cell('immutable'),before=JSON.stringify(f);
  const placements=createPlacements([f]);
  assert.equal(JSON.stringify(f),before);
  assert.ok(placements.length<=30);
  assert.ok(placements.every(p=>!('ownerId' in p)));
  assert.deepEqual(createPlacements([]),[]);
});

// These authoritative polygons reproduced sedan corners outside their blocks.
const edgeBlocks=[
  {id:'ZC-018',ring:[[-73.9593124,40.7941272],[-73.9551728,40.7924827],[-73.9602283,40.7841852],[-73.9661414,40.7858353]]},
  {id:'ZC-045',ring:[[-73.9600042,40.7717258],[-73.9545473,40.7686138],[-73.9602668,40.7582396],[-73.9666063,40.7608437]]}
].map(({id,ring})=>({type:'Feature',id,geometry:{type:'Polygon',coordinates:[[...ring,ring[0]]]}}));
test('full rotated model footprints stay inside the two real edge regression blocks',()=>{
  const placements=createPlacements(edgeBlocks);
  assert.ok(placements.length>0,'retain safe landmarks');
  // Independently reproduce the renderer shared-origin scaling, then sample every
  // edge of the conservative X/Z bounding square after the instance rotation.
  const originLat=placements.reduce((sum,p)=>sum+p.coordinates[1],0)/placements.length;
  const meter=1/(2*Math.PI*6371008.8*Math.cos(originLat*Math.PI/180));
  for(const p of placements){
    const rings=edgeBlocks.find(f=>f.id===p.blockId).geometry.coordinates;
    const x=p.coordinates[0]/360,y=(1-Math.log(Math.tan(Math.PI/4+p.coordinates[1]*Math.PI/360))/Math.PI)/2;
    for(let edge=0;edge<4;edge++)for(let n=0;n<=10;n++){
      const t=n/10,a=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]][edge],b=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]][(edge+1)%4];
      const dx=(a[0]+(b[0]-a[0])*t)*p.width,dz=(a[1]+(b[1]-a[1])*t)*p.width;
      const mx=x+(dx*Math.cos(p.rotation)+dz*Math.sin(p.rotation))*meter,my=y+(-dx*Math.sin(p.rotation)+dz*Math.cos(p.rotation))*meter;
      const point=[mx*360,Math.atan(Math.sinh(Math.PI*(1-2*my)))*180/Math.PI];
      assert.ok(insidePolygon(point,rings),`${p.blockId} ${p.model} edge ${edge} sample ${n}`);
    }
  }
});
test('a hole enclosed by a footprint rejects that placement even with its center outside the hole',()=>{
  const feature=cell('hole-footprint'),sedan=createPlacements([feature]).find(p=>p.model==='car_sedan');
  const [x,y]=sedan.coordinates,d=1/111195;
  const hole=[[x+d,y-d*.1],[x+d*1.2,y-d*.1],[x+d*1.2,y+d*.1],[x+d,y+d*.1],[x+d,y-d*.1]];
  feature.geometry.coordinates.push(hole);
  assert.ok(insidePolygon(sedan.coordinates,feature.geometry.coordinates));
  assert.equal(createPlacmentsAtSedan(createPlacements([feature]),sedan),false);
  feature.geometry.coordinates[1][0][0]=NaN;
  assert.deepEqual(createPlacements([feature]),[]);
});

function createPlacmentsAtSedan(placements,sedan){return placements.some(p=>p.model==='car_sedan'&&p.coordinates[0]===sedan.coordinates[0]&&p.coordinates[1]===sedan.coordinates[1]);}

test('real city cells contain readable varied building clusters instead of two tiny landmarks',()=>{
  const buildings=createPlacements(edgeBlocks).filter(p=>p.model.startsWith('building_'));
  for(const block of edgeBlocks){
    const cluster=buildings.filter(p=>p.blockId===block.id);
    assert.ok(cluster.length>=8,`${block.id} must read as a neighborhood`);
    assert.ok(cluster.every(p=>p.width>=50&&p.width<=140),'strategy-scale buildings stay readable');
    assert.ok(new Set(cluster.map(p=>p.model)).size>=3,'varied roofline uses real kit variants');
    assert.ok(new Set(cluster.map(p=>p.heightScale)).size>=8,'neighborhood roofline must not repeat four identical heights');
  }
});

test('streets use filled internal ground geometry without territory boundary strokes',()=>{
  const streets=createStreets(edgeBlocks);
  assert.ok(streets.features.length>=2);
  assert.ok(streets.features.every(f=>f.geometry.type==='Polygon'&&f.properties.kind==='street'),'no pale paving strips');
  for(const feature of streets.features){
    const source=edgeBlocks.find(f=>f.id===feature.properties.blockId);
    const points=feature.geometry.coordinates[0].slice(0,-1),center=points.reduce((s,p)=>[s[0]+p[0]/points.length,s[1]+p[1]/points.length],[0,0]);
    assert.ok(insidePolygon(center,source.geometry.coordinates),'street belongs to its authoritative cell');
    assert.ok(points.every(p=>insidePolygon(p,source.geometry.coordinates)),'local roads never trace or form a cross-cell grid at the block edges');
  }
});

test('view culling preserves state and enforces explicit mobile geometry budgets',()=>{
  const data=Array.from({length:1000},(_,i)=>({blockId:String(i),model:i%2?'building_A_withoutBase':'car_sedan',coordinates:[i%30,i%20],width:80}));
  data.push({model:'building_G_withoutBase',coordinates:[Number.MAX_VALUE,Number.MAX_VALUE]});
  const before=JSON.stringify(data);
  const selected=selectVisiblePlacements(data,{width:390,height:400,mobile:true,project:p=>({x:p[0]*12,y:p[1]*20})});
  assert.ok(selected.filter(p=>p.model.startsWith('building_')).length<=140);
  assert.ok(selected.filter(p=>!p.model.startsWith('building_')).length<=80);
  assert.ok(selected.every(p=>data.includes(p)&&p.coordinates[0]!==Number.MAX_VALUE));
  assert.equal(JSON.stringify(data),before);
  const summary=summarizePlacements(selected);
  assert.equal(summary.total,selected.length);
  assert.ok(summary.buildings<=140&&summary.cars<=80&&summary.averageBuildingWidth===80);
  const streetSummary=summarizeStreets(createStreets(edgeBlocks));
  assert.equal(streetSummary.featureCount,2);
  assert.equal(streetSummary.uniqueBlockCount,2);
  assert.deepEqual(streetSummary.blockIds,['ZC-018','ZC-045']);
  assert.ok(streetSummary.vertexCount>=16);
  assert.equal(supportedLayoutModels().length,7);
  assert.equal(isSupportedLayoutModel('building_A_withoutBase'),true);
  assert.equal(isSupportedLayoutModel('car_sedan'),true);
  assert.equal(isSupportedLayoutModel('unknown'),false);
  assert.equal(maxPlacementWidthMeters(),140);
  assert.deepEqual(cullingBudgets(true),{buildings:140,props:80});
  assert.deepEqual(cullingBudgets(false),{buildings:380,props:180});
  assert.equal(supportedLayoutModelCount(),7);
  assert.deepEqual(buildingLayoutModels(),['building_A_withoutBase','building_C_withoutBase','building_E_withoutBase','building_G_withoutBase']);
  assert.deepEqual(propLayoutModels(),['car_sedan','bush','streetlight']);
  assert.equal(isBuildingLayoutModel('building_A_withoutBase'),true);
  assert.equal(isBuildingLayoutModel('car_sedan'),false);
  assert.equal(layoutSedanWidthMeters(),13);
  assert.equal(layoutBushWidthMeters(),27);
  assert.equal(layoutStreetlightWidthMeters(),10);
  assert.equal(layoutMaxMercatorLatitude(),85.051129);
  assert.equal(layoutCandidatesPerCellCount(),26);
});

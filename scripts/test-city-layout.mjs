import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPlacements, insidePolygon } = require('../dist/city-layout.js');
const cell = (id, x=0) => ({type:'Feature',id,properties:{ownerId:'vipers'},geometry:{type:'Polygon',coordinates:[[[x,0],[x+1,0],[x+1,1],[x,1],[x,0]]]}});

test('placements are deterministic and remain within their authoritative blocks',()=>{
  const data=[cell('ZC-001'),cell('ZC-002',1)];
  const a=createPlacements(data),b=createPlacements(data);
  assert.deepEqual(a,b);
  assert.ok(a.length >=4);
  for(const p of a){
    const block=data.find(f=>f.id===p.blockId);
    assert.ok(insidePolygon(p.coordinates,block.geometry.coordinates));
    assert.ok(Number.isFinite(p.width) && p.width>0 && p.width<=42);
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
  assert.ok(placements.length<=6);
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
  assert.equal(placements.filter(p=>p.model==='car_sedan').length,0,'omit both edge sedans');
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
  assert.equal(createPlacements([feature]).some(p=>p.model==='car_sedan'),false);
  feature.geometry.coordinates[1][0][0]=NaN;
  assert.deepEqual(createPlacements([feature]),[]);
});

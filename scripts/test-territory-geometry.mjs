import test from 'node:test';
import assert from 'node:assert/strict';
import geometry from '../dist/territory-geometry.js';

const cell = (id, x, y, owner = 'family', points) => ({ type: 'Feature', id, properties: { ownerId: owner, ownerName: owner || 'Neutral', renderColor: '#aabbcc', neutral: !owner, player: owner === 'family', contested: false }, geometry: { type: 'Polygon', coordinates: [points || [[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]] } });
const collection = features => ({ type: 'FeatureCollection', features });
const area = ring => Math.abs(ring.slice(0,-1).reduce((sum,p,i) => sum + p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0)/2);
const surface = feature => (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates).reduce((sum,rings) => sum + area(rings[0]) - rings.slice(1).reduce((n,r) => n+area(r),0),0);

test('adjacent holdings dissolve their shared edge without changing area or source data', () => {
  const input = collection([cell('a',0,0),cell('b',1,0)]), original = JSON.stringify(input);
  const result = geometry.dissolve(input);
  assert.equal(result.features.length,1); assert.equal(surface(result.features[0]),2);
  assert.deepEqual(result.features[0].properties.blockIds,['a','b']);
  const ring = result.features[0].geometry.coordinates[0];
  assert.ok(!ring.some((p,i) => i && p[0]===1 && ring[i-1][0]===1));
  assert.equal(JSON.stringify(input),original);
});
test('mixed owners and disconnected or corner-touching holdings never acquire a false bridge', () => {
  const result = geometry.dissolve(collection([cell('a',0,0),cell('r',1,0,'rival'),cell('b',2,0),cell('c',3,1),cell('n',8,0,'')]));
  assert.equal(result.features.length,5); assert.equal(result.features.reduce((n,f)=>n+surface(f),0),5);
  assert.equal(result.features.filter(f=>f.properties.ownerId==='family').length,3);
  assert.equal(result.features.find(f=>f.properties.neutral).properties.blockIds[0],'n');
});
test('a rival enclave remains a hole inside the surrounding family area', () => {
  const cells=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)cells.push(cell(`${x}:${y}`,x,y,x===1&&y===1?'rival':'family'));
  const result=geometry.dissolve(collection(cells)), family=result.features.find(f=>f.properties.ownerId==='family');
  assert.equal(result.features.length,2);assert.equal(family.geometry.coordinates.length,2);assert.equal(surface(family),8);
  assert.equal(geometry.contains(family.geometry,[1.5,1.5]),false);assert.equal(geometry.contains(family.geometry,family.properties.anchor),true);
});
test('reversed winding, floating point noise and split shared edges preserve topology', () => {
  const a=cell('a',0,0), b=cell('b',1,0,'family',[[1+1e-11,0],[2,0],[2,1],[1+1e-11,1],[1+1e-11,.5],[1+1e-11,0]].reverse());
  const result=geometry.dissolve(collection([b,a]));assert.equal(result.features.length,1);assert.ok(Math.abs(surface(result.features[0])-2)<1e-8);
  const tee=geometry.dissolve(collection([cell('wide',0,0,'family',[[0,0],[2,0],[2,1],[0,1],[0,0]]),cell('a',0,1),cell('b',1,1)]));
  assert.equal(tee.features.length,1);assert.equal(surface(tee.features[0]),4);
});
test('ownership transfer and contested metadata update the display while all block IDs survive', () => {
  const a=cell('a',0,0),b=cell('b',1,0);b.properties.contested=true;
  let result=geometry.dissolve(collection([a,b]));assert.equal(result.features[0].properties.contestedCount,1);
  b.properties.ownerId='rival';b.properties.player=false;
  result=geometry.dissolve(collection([a,b]));assert.equal(result.features.length,2);
  assert.deepEqual(result.features.flatMap(f=>f.properties.blockIds).sort(),['a','b']);
});
test('120 rotated cells remain exact, deterministic, and free of internal grid edges', () => {
  const rotate=([x,y])=>[-73.98+(x*.82-y*.57)*.005,40.75+(x*.57+y*.82)*.005];
  const cells=[];for(let y=0;y<10;y++)for(let x=0;x<12;x++){const c=cell(`${y*12+x}`,x,y,x<6?'family':'rival');c.geometry.coordinates[0]=c.geometry.coordinates[0].map(rotate);cells.push(c);}
  const result=geometry.dissolve(collection(cells));assert.equal(result.features.length,2);
  assert.equal(result.features.reduce((n,f)=>n+f.properties.blockIds.length,0),120);
  assert.ok(Math.abs(result.features.reduce((n,f)=>n+surface(f),0)-cells.reduce((n,f)=>n+surface(f),0))<1e-8);
  assert.deepEqual(geometry.dissolve(collection([...cells].reverse())),result);
});
test('empty data is safe and malformed polygons fail explicitly', () => {
  assert.deepEqual(geometry.dissolve(collection([])),collection([]));
  assert.throws(()=>geometry.dissolve(collection([cell('a',0,0,'family',[[0,0],[NaN,0],[1,1],[0,0]])])),/Invalid/);
});

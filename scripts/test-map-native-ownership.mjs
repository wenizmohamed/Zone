import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),city=require('../assets/city/native-city.js');
const block=(id,ownerId,color)=>({type:'Feature',id,properties:{ownerId,renderColor:color,neutral:!ownerId},geometry:{type:'Polygon',coordinates:[[[-74,40.75],[-73.99,40.75],[-73.99,40.74],[-74,40.74],[-74,40.75]]]}});
function evaluate(expression,properties){
  if(!Array.isArray(expression))return expression;
  if(expression[0]==='get')return properties[expression[1]];
  if(expression[0]==='match'){
    const value=evaluate(expression[1],properties);
    for(let i=2;i<expression.length-1;i+=2){const labels=expression[i];if(Array.isArray(labels)?labels.includes(value):labels===value)return evaluate(expression[i+1],properties);}
    return evaluate(expression.at(-1),properties);
  }
  throw new Error('Unsupported color expression');
}
test('roofs follow authoritative faction colors while neutral and unknown blocks retain their materials',()=>{
  const features=[block('ZC-001','vipers','#78d628'),block('ZC-002','kings','#3d7cc9'),block('ZC-003','', '#68717b')],before=JSON.stringify(features),paint=city.ownershipColors(features,'vipers',false);
  const roof={color:'#81898a',blockId:'ZC-001'},own=evaluate(paint,roof),rival=evaluate(paint,{...roof,blockId:'ZC-002'});
  assert.notEqual(own,roof.color);assert.notEqual(rival,roof.color);assert.notEqual(own,rival);
  assert.equal(evaluate(paint,{...roof,blockId:'ZC-003'}),roof.color);assert.equal(evaluate(paint,{...roof,blockId:'missing'}),roof.color);
  assert.equal(JSON.stringify(features),before);
  const focused=city.ownershipColors(features,'kings',false),places=city.ownershipColors(features,'vipers',true);
  assert.notEqual(evaluate(focused,{...roof,blockId:'ZC-002'}),rival);assert.notEqual(evaluate(places,roof),own);
});
test('ownership transfer repaints roofs without rebuilding geometry and unchanged refresh does no extra work',async()=>{
  const features=[block('ZC-001','vipers','#78d628')],layers=new Map([['zone-ownership-fill',{}],['zone-blocks-fill',{}]]),sources=new Map(),writes=[];
  const map={getPitch:()=>0,getLayer:id=>layers.get(id),getSource:id=>sources.get(id),addLayer:layer=>layers.set(layer.id,layer),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),setPaintProperty:(id,key,value)=>writes.push({id,key,value}),addSource(id,data){sources.set(id,{...data,updates:0,setData(value){this.data=value;this.updates++;}});}};
  city.install(map,features);await new Promise(resolve=>setImmediate(resolve));const source=sources.get('zone-city-atlas'),geometry=JSON.stringify(source.data);
  city.updateOwnership(map,features,'vipers',false);city.updateOwnership(map,features,'vipers',false);assert.equal(writes.length,2);
  const transferred=[block('ZC-001','kings','#3d7cc9')];city.updateOwnership(map,transferred,'vipers',false);
  assert.equal(writes.length,4);assert.notDeepEqual(writes[0].value,writes[2].value);assert.equal(JSON.stringify(source.data),geometry);assert.equal(source.updates,1);
  assert.equal(layers.get('zone-city-buildings-overview').maxzoom,15.3);assert.equal(layers.get('zone-buildings-3d').minzoom,15.3);
  assert.equal(layers.get('zone-city-equipment-3d').minzoom,15.35);assert.equal(layers.get('zone-city-alleys').minzoom,15.3);assert.equal(layers.get('zone-city-road-marks').minzoom,15.6);
  city.remove(map);
});

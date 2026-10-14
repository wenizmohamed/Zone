import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const atlas=require('../assets/city/atlas.js');

function realPoint(column,row){
  const x=column/12*2-1,y=1-row/10*2,width=.68+.32*(1-Math.abs(y));
  const across=x*2850*width+(column>0&&column<12?Math.sin(column*1.91+row*.73)*105:0);
  const along=y*5900+(row>0&&row<10?Math.sin(row*1.47+column*.61)*135:0),bearing=29*Math.PI/180;
  return [-73.9812+(across*Math.cos(bearing)+along*Math.sin(bearing))/(111320*Math.cos(40.7562*Math.PI/180)),40.7562+(-across*Math.sin(bearing)+along*Math.cos(bearing))/111320];
}
const cell=(n)=>{const x=n%12,y=Math.floor(n/12),points=[realPoint(x,y),realPoint(x+1,y),realPoint(x+1,y+1),realPoint(x,y+1)];return {type:'Feature',id:'ZC-'+String(n+1).padStart(3,'0'),properties:{ownerId:n%2?'vipers':'night',districtId:'district-'+y,districtName:'District '+y},geometry:{type:'Polygon',coordinates:[[...points,points[0]]]}};};

export function verifyMapAtlas(){
  const failures=[];let checks=0;
  const test=(name,run)=>{checks++;try{run();}catch(error){failures.push(name+': '+error.message);}};
  const source=Array.from({length:120},(_,n)=>cell(n));
  const plan=atlas.createPlan(source);
  test('Actual 120-cell geometry produces a dense deterministic city without gameplay writes',()=>{
    const before=JSON.stringify(source);
    assert.deepEqual(plan,atlas.createPlan([...source].reverse()));
    assert.equal(plan.blocks.length,120);assert.ok(plan.roofs.length>4500);
    assert.ok(plan.blocks.every(b=>plan.roofs.filter(r=>r.blockId===b.id).length>=30));
    assert.equal(new Set(plan.blocks.map(b=>b.id)).size,120);
    assert.equal(JSON.stringify(source),before);
    assert.ok(plan.roofs.every(r=>!('ownerId' in r)&&!('canAct' in r)&&!('action' in r)));
    assert.deepEqual(plan.roofs,atlas.createPlan(source.map(f=>({...f,properties:{...f.properties,ownerId:'changed-owner',contested:true}}))).roofs);
  });
  test('All visual roofs stay inside their source polygons and outside holes',()=>{
    const byId=new Map(source.map(f=>[f.id,f]));
    for(const roof of plan.roofs)for(const p of roof.corners)assert.ok(atlas.inside(p,byId.get(roof.blockId).geometry.coordinates),roof.blockId);
    const first=structuredClone(source[0]),roof=plan.roofs.find(r=>r.blockId===first.id),center=roof.corners.reduce((p,c)=>[p[0]+c[0]/4,p[1]+c[1]/4],[0,0]),delta=.00002;
    first.geometry.coordinates.push([[center[0]-delta,center[1]-delta],[center[0]+delta,center[1]-delta],[center[0]+delta,center[1]+delta],[center[0]-delta,center[1]+delta],[center[0]-delta,center[1]-delta]]);
    assert.ok(!atlas.createPlan([first]).roofs.some(r=>r.seed===roof.seed));
    assert.deepEqual(atlas.createPlan([{}, {id:'bad',geometry:{type:'Polygon',coordinates:[[[NaN,0],[1,0],[1,1],[NaN,0]]]}}]).blocks,[]);
    assert.equal(atlas.createPlan([]).bounds,null);
  });
  test('District labels use server display names, and artwork has a bounded texture budget',()=>{
    assert.equal(plan.labels.length,10);
    assert.equal(plan.labels[0].properties.name,'District 0');
    assert.ok(plan.roofs.length<=12000&&plan.blocks.length<=240);
    const huge=atlas.createPlan(Array.from({length:500},(_,n)=>({...source[n%120],id:'safe-'+n})));
    assert.ok(huge.blocks.length<=240&&huge.roofs.length<=12000);
    assert.ok(plan.bounds.every(Number.isFinite));
  });
  test('Raster drawing contains visible roof, road and lighting detail with finite coordinates',()=>{
    let strokes=0,rectangles=0,clipped=0;
    const fn=(name)=>(...args)=>{for(const n of args.filter(a=>typeof a==='number'))assert.ok(Number.isFinite(n),name+' received non-finite geometry');if(name==='stroke')strokes++;if(name==='fillRect')rectangles++;if(name==='clip')clipped++;};
    const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get(target,key){return target[key]??fn(key);},set(target,key,value){target[key]=value;return true;}});
    const canvas={getContext:()=>ctx},art=atlas.render(plan,canvas);
    assert.equal(canvas.width,4096);assert.ok(canvas.height>=1024&&canvas.height<=4096);
    assert.equal(art.coordinates.length,4);assert.ok(art.coordinates.flat().every(Number.isFinite));
    assert.ok(strokes>10000&&rectangles>25000&&clipped>plan.roofs.length);
    const phone={getContext:()=>ctx};atlas.render(plan,phone,{mobile:true});assert.equal(phone.width,3072);assert.ok(phone.width*phone.height<=3072*3072,'mobile atlas exceeds 36 MiB raw texture budget');
  });
  test('Canvas lifecycle replaces rather than accumulates textures and keeps ownership layers above it',()=>{
    const layers=[{id:'zone-ownership-fill'}],sources=new Map(),events=[];
    const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get(t,k){return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
    const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>ctx})};
    const map={getLayer:id=>layers.find(l=>l.id===id),getSource:id=>sources.get(id),addSource(id,data){sources.set(id,{...data,setData(next){this.data=next;}});},addLayer(layer,before){events.push({id:layer.id,before});layers.push(layer);},removeLayer(id){layers.splice(layers.findIndex(l=>l.id===id),1);},removeSource(id){sources.delete(id);}};
    try{
      atlas.install(map,source.slice(0,2));const first=sources.get('zone-city-atlas');
      atlas.install(map,source.slice(0,3));
      assert.equal(sources.size,2);assert.equal(layers.filter(l=>l.id==='zone-city-atlas').length,1);assert.notEqual(sources.get('zone-city-atlas'),first);
      assert.equal(sources.get('zone-city-atlas').animate,false);
      assert.equal(events.find(e=>e.id==='zone-city-atlas').before,'zone-ownership-fill');
      atlas.remove(map);assert.equal(sources.size,0);assert.deepEqual(layers,[{id:'zone-ownership-fill'}]);
    }finally{globalThis.document=previous;}
  });
  test('Current map uses genuine vector tiles independently of retired atlas and optional GLTF assets',()=>{
    const map=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
    assert.match(map,/<script src="\.\.\/assets\/city\/compact-district\.js\?v=\d+"><\/script>/);
    assert.doesNotMatch(map,/<script src="[^"]*(?:atlas|native-city)\.js/);
    assert.doesNotMatch(map,/id:['"]zone-city-selection['"]/);
    assert.match(map,/zone-block-feedback[\s\S]{0,260}feature-state','selected'/);
    for(const script of map.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(script[1]);
  });
  test('Perspective ground retains roads and excludes duplicate painted roofs',()=>{
    let clips=0,strokes=0;
    const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get(t,k){return t[k]??(()=>{if(k==='clip')clips++;if(k==='stroke')strokes++;});},set(t,k,v){t[k]=v;return true;}});
    const before=JSON.stringify(plan),canvas={getContext:()=>ctx};
    atlas.render(plan,canvas,{groundOnly:true,size:1536});
    assert.equal(clips,plan.blocks.length,'ground must not paint a second set of rooftops under 3D models');
    assert.ok(strokes>500,'keep the original road network');assert.equal(canvas.width,1536);assert.equal(JSON.stringify(plan),before);
  });
  test('Classic script and module import share one atlas cache and perspective textures do not accumulate',()=>{
    const layers=[{id:'zone-ownership-fill'}],sources=new Map(),ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get(t,k){return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
    const scope=vm.createContext({innerWidth:390,document:{createElement:()=>({getContext:()=>ctx})}});
    const sourceCode=readFileSync(new URL('../assets/city/atlas.js',import.meta.url),'utf8');
    const map={getLayer:id=>layers.find(l=>l.id===id),getSource:id=>sources.get(id),addSource(id,data){sources.set(id,{...data,setData(){}});},addLayer(layer){layers.push(layer);},setLayoutProperty(id,key,value){this.getLayer(id).layout??={};this.getLayer(id).layout[key]=value;},removeLayer(id){layers.splice(layers.findIndex(l=>l.id===id),1);},removeSource(id){sources.delete(id);}};
    vm.runInContext(sourceCode,scope);const original=scope.ZoneCityAtlas;original.install(map,source.slice(0,2));
    vm.runInContext(sourceCode,scope);assert.equal(scope.ZoneCityAtlas,original,'module evaluation must not discard the classic-script cache');
    assert.equal(original.preparePerspective(map),true);const ground=sources.get('zone-city-ground-atlas');original.preparePerspective(map);assert.equal(sources.get('zone-city-ground-atlas'),ground);
    assert.equal(ground.canvas.width,1536);original.setPerspective(map,true);assert.equal(map.getLayer('zone-city-atlas').layout.visibility,'none');assert.equal(map.getLayer('zone-city-ground-atlas').layout.visibility,'visible');
    original.setPerspective(map,false);assert.equal(map.getLayer('zone-city-atlas').layout.visibility,'visible');assert.equal(map.getLayer('zone-city-ground-atlas').layout.visibility,'none');
    original.install(map,source.slice(0,3));assert.equal(sources.has('zone-city-ground-atlas'),false,'new geometry must invalidate the old perspective ground');original.remove(map);assert.equal(sources.size,0);
  });
  return {failures,checks,roofs:plan.roofs.length,blocks:plan.blocks.length};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=verifyMapAtlas();result.failures.forEach(f=>console.error('- '+f));
  console.log(`City atlas verification: ${result.checks-result.failures.length}/${result.checks} passed; ${result.blocks} authoritative cells, ${result.roofs} original roofs.`);
  if(result.failures.length)process.exitCode=1;
}

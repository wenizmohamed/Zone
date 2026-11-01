import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as Three from '../lib/three184/three.module.js';

const module = await import('../dist/district-surfaces111.mjs');
const square = [[0,0],[.00036,0],[.00036,.00027],[0,.00027],[0,0]];
const feature = (id, rings=[square], properties={}) => ({type:'Feature',id:'16/1/1/'+id,properties:{providerId:String(id),providerTile:'16/1/1',extrude:'true',height:20,min_height:8,type:'building:part',...properties},geometry:{type:'Polygon',coordinates:rings}});

// Catches the surface planner returning no detail or silently flattening a
// raised provider part to ground; expectations are actual source base/top.
test('real extrudable provider part receives measured facade detail above its native base without input edits',()=>{
  const input=[feature(7)],before=JSON.stringify(input);
  const plan=module.planDistrictSurfaces(input,{center:[0,0]});
  assert.deepEqual(plan.center,[0,0]);
  assert.ok(plan.windows.length>0);
  assert.ok(plan.floorLines.length>0);
  assert.ok(plan.cornices.length>0);
  const summary=module.summarizeSurfacePlan(plan);
  assert.equal(summary.acceptedFeatures,1);
  assert.equal(summary.windows,plan.windows.length);
  assert.equal(summary.floorLines,plan.floorLines.length);
  assert.equal(summary.cornices,plan.cornices.length);
  assert.ok(summary.triangles>0);
  const limits=module.surfaceLimits();
  assert.equal(limits.maxWindows,12000);
  assert.equal(limits.maxRoofDetails,600);
  const palette=module.surfacePalette();
  assert.equal(palette.glass.length,4);
  assert.equal(palette.walls.length,8);
  assert.equal(module.surfaceLayerId(),'zone-district-surfaces');
  assert.equal(module.isSupportedSurfacePaletteCategory('glass'),true);
  assert.equal(module.isSupportedSurfacePaletteCategory('walls'),true);
  assert.equal(module.isSupportedSurfacePaletteCategory('unknown'),false);
  for(const surface of [...plan.windows,...plan.floorLines,...plan.cornices]){
    assert.equal(surface.providerId,'7');assert.equal(surface.base,8);assert.equal(surface.top,20);
    assert.ok(surface.points.every(p=>p.length===3&&p.every(Number.isFinite)&&p[1]>=8&&p[1]<=20));
  }
  assert.equal(JSON.stringify(input),before);
});

// Catches beige native walls surviving because only small glass/roof details
// were added. These are walls on the measured footprint, never roof caps.
test('wall panels cover every actual courtyard edge from native base to top with outward-only offsets',()=>{
  const hole=[[.00009,.00006],[.00027,.00006],[.00027,.00021],[.00009,.00021],[.00009,.00006]],input=[feature(71,[square,hole])],before=JSON.stringify(input);
  const plan=module.planDistrictSurfaces(input,{center:[0,0]});
  assert.equal(plan.wallPanels?.length,8,'four exterior and four courtyard walls');
  assert.equal(plan.diagnostics.wallPanelFeatures,1);assert.equal(plan.diagnostics.wallPanelCoverageComplete,true);
  for(const panel of plan.wallPanels){
    assert.equal(panel.base,8);assert.equal(panel.top,20);assert.equal(panel.providerId,'71');
    assert.deepEqual(panel.points.map(p=>p[1]),[8,8,20,20]);
    const points=panel.points,mid=[(points[0][0]+points[1][0])/2,(points[0][2]+points[1][2])/2],scale=40075016.68557849/360;
    const geo=[mid[0]/scale,(2*Math.atan(Math.exp(-mid[1]/6378137))-Math.PI/2)*180/Math.PI];
    if(panel.ringIndex===0)assert.ok(geo[0]<0||geo[0]>.00036||geo[1]<0||geo[1]>.00027,'outer wall is just outside the real building');
    else assert.ok(geo[0]>.00009&&geo[0]<.00027&&geo[1]>.00006&&geo[1]<.00021,'courtyard wall faces into the actual hole');
  }
  assert.equal(JSON.stringify(input),before);
});

test('glass and trim have physical depth clearance from broad walls on the same real footprint',()=>{
  const plan=module.planDistrictSurfaces([feature(74)],{center:[0,0]}),wall=plan.wallPanels.find(p=>p.edge===0),pane=plan.windows.find(p=>p.edge===0),trim=plan.floorLines.find(p=>p.edge===0);
  const distance=surface=>Math.abs(surface.points[0][2]);
  assert.ok(distance(pane)>=.10,'shared-map depth cannot rely on a .017m glass-to-wall gap');
  assert.ok(distance(pane)-distance(wall)>=.10);
  assert.ok(distance(trim)>=.10);
  assert.equal(pane.base,8);assert.equal(pane.top,20);assert.equal(wall.base,8);assert.equal(wall.top,20);
});

test('normal500-building city receives every wall and a reduced quota reaches late buildings fairly',()=>{
  const input=Array.from({length:500},(_,i)=>feature(5000+i)),options={center:[0,0],maxWindows:0,maxRoofDetails:0};
  const full=module.planDistrictSurfaces(input,options);
  assert.equal(full.wallPanels.length,2000);assert.equal(full.diagnostics.wallPanelFeatures,500);assert.equal(full.diagnostics.wallPanelCandidates,2000);assert.equal(full.diagnostics.wallPanelCoverageComplete,true);
  assert.ok(new Set(full.wallPanels.map(p=>p.color)).size>=6,'normal city uses multiple restrained masonry families');
  const bounded=module.planDistrictSurfaces(input,{...options,maxWallPanels:501});
  assert.equal(bounded.wallPanels.length,501);assert.equal(bounded.diagnostics.wallPanelFeatures,500);assert.equal(bounded.diagnostics.wallPanelCoverageComplete,false);
  assert.ok(bounded.wallPanels.some(p=>p.providerId==='5499'));
  assert.deepEqual(module.planDistrictSurfaces(input.toReversed(),{...options,maxWallPanels:501}),bounded);
  const fragments=[feature(77),{...feature(77),id:'16/2/1/77',properties:{...feature(77).properties,providerTile:'16/2/1'}}];
  const same=module.planDistrictSurfaces(fragments,options);assert.equal(new Set(same.wallPanels.map(p=>p.color)).size,1,'tile seams cannot change one provider building material');
});

test('wall budget has a hard ceiling and can explicitly disable panels without native-geometry changes',()=>{
  const input=Array.from({length:3001},(_,i)=>feature(10000+i)),before=JSON.stringify(input),options={center:[0,0],maxWindows:0,maxRoofDetails:0};
  const capped=module.planDistrictSurfaces(input,{...options,maxWallPanels:999999});
  assert.equal(capped.wallPanels.length,12000);assert.equal(capped.diagnostics.wallPanelFeatures,3001);assert.equal(capped.diagnostics.wallPanelCoverageComplete,false);assert.ok(capped.diagnostics.triangles<=67200);
  const zero=module.planDistrictSurfaces([input[0]],{...options,maxWallPanels:0});assert.equal(zero.wallPanels.length,0);assert.equal(zero.diagnostics.wallPanelCoverageComplete,false);
  assert.equal(JSON.stringify(input),before);
  for(const maxWallPanels of [-1,NaN,1.5,'10'])assert.throws(()=>module.planDistrictSurfaces([],{maxWallPanels}),/budgets/);
});

// Catches centroid-only rooftop placement that bridges a courtyard or escapes
// a concave roof, and collapsed split-part heights.
test('rooftop details stay inside genuine courtyard and multipolygon roofs at each part height',()=>{
  const hole=[[.00009,.00006],[.00027,.00006],[.00027,.00021],[.00009,.00021],[.00009,.00006]];
  const second=feature(9,[square],{height:36,min_height:20});
  second.geometry={type:'MultiPolygon',coordinates:[[square],[square.map(p=>[p[0]+.0005,p[1]])]]};
  const plan=module.planDistrictSurfaces([feature(8,[square,hole]),second],{center:[0,0]});
  assert.equal(plan.roofDetails.length,3,'one bounded interior attachment per real polygon, not per exterior bounding box');
  const scale=40075016.68557849/360;
  const geo=p=>[p[0]/scale,(2*Math.atan(Math.exp(-p[1]/6378137))-Math.PI/2)*180/Math.PI];
  for(const detail of plan.roofDetails){
    assert.equal(detail.position[1]-detail.size[1]/2,detail.top+.045);
    assert.equal(detail.top,detail.providerId==='8'?20:36);
    for(const corner of detail.footprint.map(geo)){
      const shift=detail.providerId==='9'&&detail.polygonIndex===1?.0005:0;
      assert.ok(corner[0]>shift&&corner[0]<.00036+shift&&corner[1]>0&&corner[1]<.00027);
      if(detail.providerId==='8')assert.ok(!(corner[0]>=.00009&&corner[0]<=.00027&&corner[1]>=.00006&&corner[1]<=.00021));
    }
  }
});

test('bounded planner preserves tile fragments and native raised parts but rejects nonbuildings and malformed rings',()=>{
  const fragment=feature(40),next={...feature(40),id:'16/2/1/40',properties:{...feature(40).properties,providerTile:'16/2/1'}};
  const plan=module.planDistrictSurfaces([fragment,next,feature(41,[square],{extrude:'false'}),feature(42,[square],{underground:'true'}),feature(43,[square],{height:8}),feature(44,[[[0,0],[.0001,0],[.0002,0],[0,0]]]),feature(45,[square],{min_height:'invalid'})],{center:[0,0]});
  assert.equal(plan.diagnostics.acceptedFeatures,2);
  assert.equal(plan.diagnostics.skippedFeatures,5);
  assert.deepEqual([...new Set(plan.windows.map(p=>p.providerTile))].sort(),['16/1/1','16/2/1']);
  assert.ok(plan.windows.every(p=>p.providerId==='40'&&p.base===8&&p.top===20));
});

test('window, band and roof work stays deterministic and within hard ceilings even when callers request more',()=>{
  const input=Array.from({length:90},(_,i)=>feature(i+100,[square],{height:70}));
  const tiny=module.planDistrictSurfaces(input,{center:[0,0],maxWindows:19,maxRoofDetails:3});
  assert.equal(tiny.windows.length,19);assert.equal(tiny.roofDetails.length,3);assert.ok(tiny.floorLines.length+tiny.cornices.length<=6000);
  assert.deepEqual(module.planDistrictSurfaces(input.toReversed(),{center:[0,0],maxWindows:19,maxRoofDetails:3}),tiny);
  const huge=module.planDistrictSurfaces(input,{center:[0,0],maxWindows:999999,maxRoofDetails:999999});
  assert.equal(huge.windows.length,12000);assert.ok(huge.roofDetails.length<=600);
  assert.ok(huge.diagnostics.triangles<=67200,'full hard ceiling includes bounded wall panels as well as windows/bands/roofs');
  const zero=module.planDistrictSurfaces(input,{center:[0,0],maxWindows:0,maxRoofDetails:0});assert.equal(zero.windows.length,0);assert.equal(zero.roofDetails.length,0);
});

test('a global window cap distributes visible detail to late provider features instead of first-fit starvation',()=>{
  const input=Array.from({length:20},(_,i)=>feature(200+i,[square],{height:140}));
  const plan=module.planDistrictSurfaces(input,{center:[0,0],maxWindows:80,maxRoofDetails:0});
  const counts=new Map();for(const pane of plan.windows)counts.set(pane.providerId,(counts.get(pane.providerId)||0)+1);
  assert.equal(plan.windows.length,80);assert.equal(counts.size,20);assert.deepEqual([...counts.values()],[...Array(20).fill(4)]);
  assert.equal(counts.get('219'),4,'the final real building receives the same bounded first pass');
  assert.ok(new Set(plan.windows.filter(p=>p.providerId==='219').map(p=>p.edge)).size>=3,'the quota covers multiple walls, not four panes on the first edge');
  const spread=module.planDistrictSurfaces(input,{center:[0,0],maxWindows:240,maxRoofDetails:0}).windows.filter(p=>p.providerId==='219');
  assert.ok(Math.max(...spread.flatMap(p=>p.points.map(v=>v[1])))>75,'a small per-building quota still reaches its upper floors, not just the lowest row');
});

test('an intricate many-sided facade does not spend its entire small window quota on ground-floor panes',()=>{
  const ring=Array.from({length:32},(_,i)=>[.0003+Math.cos(i*Math.PI/16)*.0003,.0003+Math.sin(i*Math.PI/16)*.0003]);ring.push(ring[0]);
  const plan=module.planDistrictSurfaces([feature(901,[ring],{height:140})],{center:[0,0],maxWindows:16,maxRoofDetails:0});
  assert.equal(plan.windows.length,16);assert.equal(new Set(plan.windows.map(p=>p.edge)).size,16);
  const heights=plan.windows.flatMap(p=>p.points.map(v=>v[1]));assert.ok(Math.min(...heights)<30);assert.ok(Math.max(...heights)>100,'upper facade retains glazing under the global cap');
});

test('invalid origins, budgets and runaway feature sets fail before producing any surface plan',()=>{
  for(const center of [[Infinity,0],[0,85],[181,0],[],null])assert.throws(()=>module.planDistrictSurfaces([],{center}),/origin/);
  for(const maxWindows of [-1,NaN,1.5,'10'])assert.throws(()=>module.planDistrictSurfaces([],{maxWindows}),/budgets/);
  assert.throws(()=>module.planDistrictSurfaces(Array(5001).fill(feature(1))),/feature budget/);
  const input=feature(1),ring=Array.from({length:160001},()=>[0,0]);ring.push([0,0]);input.geometry.coordinates=[ring];assert.throws(()=>module.planDistrictSurfaces([input],{center:[0,0]}),/coordinate budget/);
});

test('oversized provider arrays are refused before serializing or allocating detailed geometry',()=>{
  const huge=Array(160001).fill([0,0]);huge.toJSON=()=>{throw Error('Oversized geometry must not be serialized.');};
  assert.throws(()=>module.planDistrictSurfaces([feature(1,[huge])],{center:[0,0]}),/coordinate budget/);
});

const vendorSource=readFileSync(new URL('../lib/three184/three.module.js',import.meta.url),'utf8');
const propertiesStart=vendorSource.indexOf('function WebGLProperties()'),propertiesEnd=vendorSource.indexOf('function painterSortStable',propertiesStart);
const makeVendorProperties=new Function(vendorSource.slice(propertiesStart,propertiesEnd)+';return WebGLProperties;')();
const asyncStart=vendorSource.indexOf('this.compileAsync = function ('),asyncEnd=vendorSource.indexOf('// Animation Loop',asyncStart);
assert.ok(propertiesStart>=0&&propertiesEnd>propertiesStart&&asyncStart>=0&&asyncEnd>asyncStart);

function harness({shader=null,addFailure=false,linkFailure=false,drawFailure=false,drawShaderError=false,vendorPolling=false}={}){
  const renderers=[],layers=new Map(),events=[],resources=[],timers=new Map(),doc={body:{dataset:{}}};let timerId=0;
  const schedule=(fn,ms,kind='application')=>{const id=++timerId,record={fn,ms,kind};timers.set(id,record);if(kind==='application'&&ms===10)record.native=setTimeout(()=>{timers.delete(id);fn();},ms);return id;};
  const unschedule=id=>{const record=timers.get(id);if(record?.native)clearTimeout(record.native);timers.delete(id);};
  const gl={shared:true,LINK_STATUS:35714,getProgramParameter:()=>!linkFailure,getProgramInfoLog:()=>linkFailure?'fragment shader link rejected':drawShaderError?'late shader link rejected':''};
  const track=(value,kind)=>{const record={kind,disposals:0,value};value.addEventListener('dispose',()=>record.disposals++);resources.push(record);return value;};
  const THREE={...Three,BufferGeometry:class extends Three.BufferGeometry{constructor(){super();track(this,'geometry');}},MeshStandardMaterial:class extends Three.MeshStandardMaterial{constructor(...args){super(...args);track(this,'material');}},WebGLRenderer:class{
    constructor(options){this.options=options;this.draws=[];this.disposals=0;this.properties=makeVendorProperties();this.programReady=shader===null;this.debug={checkShaderErrors:true,onShaderError:null};this.info={programs:[{program:{zoneSurfaceProgram:true},isReady:()=>{if(this.programFailure)throw this.programFailure;return this.programReady;}}],render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};renderers.push(this);}
    resetState(){events.push('reset');}
    compile(scene){const materials=new Set(scene.children.filter(o=>o.isMesh).map(o=>o.material));for(const material of materials){this.properties.get(material).currentProgram=this.info.programs[0];material.addEventListener('dispose',()=>this.properties.remove(material));}this.compilation=typeof shader==='function'?shader():shader;if(this.compilation?.then)this.compilation.then(()=>{this.programReady=true;},error=>{this.programFailure=error;this.programReady=true;});else this.programReady=true;return materials;}
    compileAsync(scene,camera){if(vendorPolling){const actual=new Function('properties','extensions','setTimeout',vendorSource.slice(asyncStart,asyncEnd)+';return this.compileAsync;').call(this,this.properties,{get:()=>({})},(fn,ms)=>schedule(fn,ms,'vendor'));return actual.call(this,scene,camera);}this.compile(scene,camera);return this.compilation;}
    render(scene,camera){if(drawFailure)throw Error('facade draw failed');if(drawShaderError)this.debug.onShaderError?.(gl,{},null,null);scene.updateMatrixWorld(true);this.draws.push({scene,matrix:camera.projectionMatrix.clone()});this.info.render.calls=scene.children.filter(o=>o.isMesh).length;this.info.render.triangles=scene.children.filter(o=>o.isMesh).reduce((n,o)=>n+o.geometry.getAttribute('position').count/3,0);events.push('draw');}
    dispose(){this.disposals++;this.properties.dispose();}
    forceContextLoss(){throw Error('The map owns its WebGL context.');}
  }};
  const map={pitch:35,zoom:15.1,repaints:0,canvas:{map:true},getCanvas(){return this.canvas;},getCenter(){return{lng:0,lat:0};},getPitch(){return this.pitch;},getZoom(){return this.zoom;},getLayer:id=>layers.get(id),addLayer(layer){if(addFailure)throw Error('style rejected');layers.set(layer.id,layer);layer.onAdd(map,gl);},removeLayer(id){const layer=layers.get(id);layers.delete(id);layer?.onRemove();},triggerRepaint(){this.repaints++;}};
  const context=vm.createContext({THREE,console,document:doc,performance:{now:()=>1},setTimeout:schedule,clearTimeout:unschedule});
  const source=readFileSync(new URL('../dist/district-surfaces111.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ');
  vm.runInContext(source+'\nglobalThis.create=createDistrictSurfaces;',context);
  return{create:context.create,map,layers,renderers,resources,events,doc,timers,expirePreparation(){for(const [id,timer]of [...timers])if(timer.kind==='application'&&timer.ms>10){unschedule(id);timer.fn();}},runVendorChecks(){for(const [id,timer]of [...timers])if(timer.kind==='vendor'){unschedule(id);timer.fn();}}};
}

test('ready facade publication cannot hide a failed sign notice and hides it only when both producers recover',async()=>{
  const h=harness(),notice={hidden:false},message={textContent:''};h.doc.getElementById=id=>id==='districtSurfaceStatus111'?notice:message;
  h.doc.body.dataset.zoneDistrictLandmarks=JSON.stringify({status:'failed'});
  const control=h.create(h.map,[feature(113)],{center:[0,0],document:h.doc});await control.ready;
  assert.equal(notice.hidden,false,'facade success is not sign recovery');
  const layer=h.layers.get('zone-district-surfaces');layer.render({},new Three.Matrix4().toArray());assert.equal(notice.hidden,false);
  h.doc.body.dataset.zoneDistrictLandmarks=JSON.stringify({status:'ready'});layer.render({},new Three.Matrix4().toArray());assert.equal(notice.hidden,true);control.dispose();
});

// Catches applying the old15.8 gate to new surfaces, incorrect georeferencing,
// per-window draw calls, and a flat-mode leak. Only GPU execution is doubled.
test('one shared-context batched layer draws at actual15.1 overview and follows the real Mercator matrix',async()=>{
  const h=harness(),input=[feature(12)],before=JSON.stringify(input),control=h.create(h.map,input,{center:[0,0],document:h.doc});await control.ready;
  assert.equal(control.diagnostics.status,'ready');assert.equal(h.layers.size,1);
  assert.equal(control.diagnostics.shaderLinked,true);assert.equal(control.diagnostics.shaderPrograms,1);assert.equal(control.diagnostics.firstFrameRendered,false);
  const layer=[...h.layers.values()][0],renderer=h.renderers[0];
  assert.equal(renderer.options.canvas,h.map.canvas);assert.equal(renderer.options.context.shared,true);assert.equal(renderer.autoClear,false);
  layer.render({},new Three.Matrix4().toArray());assert.equal(renderer.draws.length,1);assert.equal(control.diagnostics.firstFrameRendered,true);
  const expected=new Three.Matrix4().makeTranslation(.5,.5,0).scale(new Three.Vector3(1/40075016.68557849,-1/40075016.68557849,1/40075016.68557849)).multiply(new Three.Matrix4().makeRotationX(Math.PI/2));
  assert.ok(renderer.draws[0].matrix.elements.every((value,i)=>Math.abs(value-expected.elements[i])<1e-12));
  assert.ok(control.diagnostics.calls>0&&control.diagnostics.calls<=4);
  const roof=renderer.draws[0].scene.getObjectByName('interior-roof-metal');assert.equal(roof.material.depthWrite,true,'opaque roofboxes occlude their own back faces');
  assert.equal(control.diagnostics.geometryTriangles,control.diagnostics.triangles);
  assert.equal(control.diagnostics.textures,0);assert.equal(control.diagnostics.shadows,0);assert.equal(control.diagnostics.continuousAnimation,false);
  h.map.pitch=0;layer.render({},new Three.Matrix4().toArray());assert.equal(renderer.draws.length,1);
  assert.equal(JSON.stringify(input),before);assert.equal(h.map.zoom,15.1);
  assert.ok(JSON.parse(h.doc.body.dataset.zoneDistrictSurfaces).geometryVertices>0);
  control.dispose();assert.equal(renderer.disposals,1);assert.ok(h.resources.length>0&&h.resources.every(r=>r.disposals===1));
});

test('real scene batches full-height walls with floorlines before depth-tested glass without adding draw calls',async()=>{
  const h=harness(),control=h.create(h.map,[feature(73)],{center:[0,0]});await control.ready;
  const layer=[...h.layers.values()][0],renderer=h.renderers[0];layer.render({},new Three.Matrix4().toArray());
  const scene=renderer.draws[0].scene,stone=scene.getObjectByName('measured-stone-floorlines'),glass=scene.getObjectByName('measured-facade-glass');
  assert.equal(stone.geometry.getAttribute('position').count,72,'4 full walls plus8 floorlines share one stone batch');
  const positions=stone.geometry.getAttribute('position'),heights=Array.from({length:positions.count},(_,i)=>positions.getY(i));assert.equal(Math.min(...heights),8);assert.equal(Math.max(...heights),20);
  assert.equal(stone.material.depthWrite,true);assert.equal(stone.material.depthTest,true);assert.equal(stone.renderOrder,0);
  assert.equal(glass.material.depthWrite,false);assert.equal(glass.material.depthTest,true);assert.equal(glass.renderOrder,1);
  assert.ok(scene.children.filter(o=>o.isMesh).length<=4);assert.equal(control.diagnostics.wallPanels,4);assert.equal(control.diagnostics.wallPanelCoverageComplete,true);
  assert.equal(control.diagnostics.geometryTriangles,control.diagnostics.triangles);
  control.dispose();assert.ok(h.resources.every(r=>r.disposals===1));
});

test('actual vertex materials use readable cool midtone walls and a stronger non-neon glass range',async()=>{
  const h=harness(),control=h.create(h.map,[feature(81),feature(82),feature(83),feature(84)],{center:[0,0]});await control.ready;
  const layer=[...h.layers.values()][0],renderer=h.renderers[0];layer.render({},new Three.Matrix4().toArray());
  const scene=renderer.draws[0].scene,stone=scene.getObjectByName('measured-stone-floorlines'),glass=scene.getObjectByName('measured-facade-glass'),wallColors=stone.geometry.getAttribute('color');
  for(let i=0;i<control.diagnostics.wallPanels*6;i+=6){
    const c=new Three.Color().fromBufferAttribute(wallColors,i).convertLinearToSRGB(),luma=.2126*c.r+.7152*c.g+.0722*c.b;
    assert.ok(luma>.56&&luma<.80,'wall diffuse values are midtone, not the dark brown render');assert.ok(c.b>=c.r-.035,'concrete and masonry remain neutral/cool');assert.ok(Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b)<.14,'no saturated flat neon');
  }
  const panes=glass.geometry.getAttribute('color'),values=Array.from({length:panes.count},(_,i)=>{const c=new Three.Color().fromBufferAttribute(panes,i).convertLinearToSRGB();return .2126*c.r+.7152*c.g+.0722*c.b;});
  assert.ok(Math.min(...values)<.30&&Math.max(...values)>.74,'shadowed and sky-reflecting panes have a readable physical range');
  assert.ok(glass.material.roughness<=.32);assert.equal(glass.material.depthTest,true);
  const key=scene.children.find(o=>o.isDirectionalLight);assert.ok(key.color.r<=key.color.b*1.05,'neutral key light cannot turn cool panels orange/brown');
  control.dispose();assert.ok(h.resources.every(r=>r.disposals===1));
});

test('full-facade physical cells keep every floor articulated after the raised-window geometry cap is exhausted',async()=>{
  const h=harness(),control=h.create(h.map,[feature(86,[square],{height:140})],{center:[0,0],maxWindows:0});await control.ready;
  const layer=[...h.layers.values()][0],renderer=h.renderers[0];layer.render({},new Three.Matrix4().toArray());
  const scene=renderer.draws[0].scene,stone=scene.getObjectByName('measured-stone-floorlines'),attribute=stone.geometry.getAttribute('zoneFacade');
  assert.equal(control.diagnostics.windows,0);assert.equal(scene.getObjectByName('measured-facade-glass'),undefined);
  assert.equal(attribute.count,stone.geometry.getAttribute('position').count);assert.equal(attribute.itemSize,4);
  const spacing=attribute.getZ(0),wallHeight=attribute.getY(2);assert.ok(spacing>=3.1);assert.equal(wallHeight,132);
  for(const floor of [0,12,25,39]){
    const pane=module.facadeCell(spacing*.5,floor*3.2+1.2,spacing);assert.equal(pane.glass,true);assert.equal(pane.floor,floor);
    assert.equal(module.facadeCell(spacing*.05,floor*3.2+1.2,spacing).glass,false);
  }
  const shader={vertexShader:Three.ShaderLib.standard.vertexShader,fragmentShader:Three.ShaderLib.standard.fragmentShader};
  stone.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/attribute vec4 zoneFacade/);assert.match(shader.vertexShader,/vZoneFacade = zoneFacade/);
  assert.match(shader.fragmentShader,/zoneFacadeMasks\(\)/);assert.match(shader.fragmentShader,/roughnessFactor = mix/);
  assert.match(shader.fragmentShader,/diffuseColor\.rgb = mix\(diffuseColor\.rgb,paneColor,masks\.x\)/);
  assert.equal(stone.material.userData.zoneFacadeProfile,'meter-scaled-masonry-glass111');assert.equal(stone.material.customProgramCacheKey(),'zone-meter-facade111-v1');
  assert.ok(scene.children.filter(o=>o.isMesh).length<=4);control.dispose();assert.ok(h.resources.every(r=>r.disposals===1));
});

test('material windows use the same measured facade spacing and floor heights as the actual raised panes',()=>{
  const plan=module.planDistrictSurfaces([feature(87,[square],{height:32})],{center:[0,0]});
  for(const pane of plan.windows){
    const wall=plan.wallPanels.find(p=>p.edge===pane.edge&&p.ringIndex===pane.ringIndex),a=wall.points[0],b=wall.points[1],length=Math.hypot(b[0]-a[0],b[2]-a[2]),spacing=length/Math.min(80,Math.floor((length-1.7)/3.1));
    const center=pane.points.reduce((sum,p)=>sum.map((n,i)=>n+p[i]/4),[0,0,0]);
    const u=((center[0]-a[0])*(b[0]-a[0])+(center[2]-a[2])*(b[2]-a[2]))/length;
    assert.equal(module.facadeCell(u,center[1]-pane.base,spacing).glass,true);
  }
});

test('a changed vendored shader contract fails explicitly instead of claiming a prepared facade',async()=>{
  const h=harness(),control=h.create(h.map,[feature(88)],{center:[0,0]});await control.ready;
  const renderer=h.renderers[0],layer=[...h.layers.values()][0];layer.render({},new Three.Matrix4().toArray());
  const material=renderer.draws[0].scene.getObjectByName('measured-stone-floorlines').material;
  assert.throws(()=>material.onBeforeCompile({vertexShader:'void main(){}',fragmentShader:'void main(){}'}),/vendored Three runtime/);control.dispose();
});

test('flat, hidden, inactive and malformed-matrix frames never render or move the camera',async()=>{
  let active=true;const h=harness(),control=h.create(h.map,[feature(13)],{center:[0,0],isActive:()=>active});await control.ready;
  const layer=[...h.layers.values()][0],renderer=h.renderers[0],matrix=new Three.Matrix4().toArray();
  h.map.pitch=0;layer.render({},matrix);h.map.pitch=35;control.setVisible(false);layer.render({},matrix);control.setVisible(true);active=false;layer.render({},matrix);active=true;
  for(const input of [null,[1,2],Array(16).fill(Infinity)])layer.render({},input);
  assert.equal(renderer.draws.length,0);
  const repaints=h.map.repaints;layer.render({},{defaultProjectionData:{mainMatrix:matrix}});assert.equal(renderer.draws.length,1);assert.equal(h.map.repaints,repaints,'a frame never schedules another frame');assert.equal(h.map.zoom,15.1);assert.equal(h.map.pitch,35);
  control.dispose();assert.ok(h.resources.every(r=>r.disposals===1));
});

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test('shader preparation never draws early and hidden preparation schedules no continuous repaint',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise}),control=h.create(h.map,[feature(14)],{center:[0,0]});
  const layer=[...h.layers.values()][0],renderer=h.renderers[0];assert.equal(control.diagnostics.status,'preparing');layer.render({},new Three.Matrix4().toArray());assert.equal(renderer.draws.length,0);
  control.setVisible(false);shader.resolve();await control.ready;assert.equal(control.diagnostics.status,'ready');assert.equal(h.map.repaints,0);
  control.setVisible(true);assert.equal(h.map.repaints,1);layer.render({},new Three.Matrix4().toArray());assert.equal(renderer.draws.length,1);assert.equal(h.map.repaints,1);control.dispose();
});

test('a hung facade preparation has a finite deadline and late completion cannot revive a failed layer',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise});h.layers.set('native-provider',{id:'native-provider'});
  const control=h.create(h.map,[feature(94)],{center:[0,0]});
  assert.equal([...h.timers.values()].filter(timer=>timer.ms===12000).length,1);
  const rejected=assert.rejects(control.ready,/preparation timed out/);h.expirePreparation();await rejected;
  assert.equal(control.diagnostics.status,'error');assert.deepEqual([...h.layers.keys()],['native-provider']);
  assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));assert.equal(h.timers.size,0);
  const before=h.doc.body.dataset.zoneDistrictSurfaces;shader.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(h.doc.body.dataset.zoneDistrictSurfaces,before);assert.equal(h.map.repaints,0);
});

test('page disposal settles stalled facade preparation immediately and cancels its timer',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise}),control=h.create(h.map,[feature(95)],{center:[0,0]});
  assert.equal([...h.timers.values()].filter(timer=>timer.ms===12000).length,1);control.dispose();await control.ready;
  assert.equal(h.timers.size,0);assert.equal(control.diagnostics.status,'disposed');assert.equal(h.map.repaints,0);
  shader.reject(Error('late retired compilation'));await Promise.resolve();await Promise.resolve();
  assert.equal(control.diagnostics.status,'disposed');assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));
});

test('facade deadlines reject invalid values before geometry or renderer allocation',()=>{
  for(const prepareTimeoutMs of [0,-1,NaN,Infinity,30001,1.5,'12000']){
    const h=harness();assert.throws(()=>h.create(h.map,[feature(96)],{center:[0,0],prepareTimeoutMs}),/timeout/);
    assert.equal(h.renderers.length,0);assert.equal(h.resources.length,0);assert.equal(h.timers.size,0);
  }
});

test('pending preparation disposal never leaves the actual vendored property poller alive',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise,vendorPolling:true}),control=h.create(h.map,[feature(97)],{center:[0,0]});
  control.dispose();await control.ready;
  assert.doesNotThrow(()=>h.runVendorChecks(),'a vendor readiness timer must not access disposed material properties');
  assert.equal(h.timers.size,0);assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));
  shader.resolve();await Promise.resolve();
});

test('map removal during preparation releases every material and geometry once and never queries a removed style',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise}),control=h.create(h.map,[feature(15)],{center:[0,0]});
  h.map.removeLayer([...h.layers.keys()][0]);h.map.getLayer=()=>{throw Error('removed style');};shader.resolve();await control.ready;
  control.setVisible(true);control.dispose();assert.equal(control.diagnostics.status,'disposed');assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.length>0&&h.resources.every(r=>r.disposals===1));assert.equal(h.map.repaints,0);
});

test('shader failure rejects readiness, removes only its layer and releases all GPU resources',async()=>{
  const shader=deferred(),h=harness({shader:shader.promise});h.layers.set('native-provider',{id:'native-provider'});
  const control=h.create(h.map,[feature(16)],{center:[0,0]}),rejected=assert.rejects(control.ready,/shader failed/);shader.reject(Error('shader failed'));await rejected;
  assert.deepEqual([...h.layers.keys()],['native-provider']);assert.equal(control.diagnostics.status,'error');assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));control.dispose();
});

test('a resolved compile promise with an unlinked actual program cannot claim facade readiness',async()=>{
  const h=harness({linkFailure:true});h.layers.set('native-provider',{id:'native-provider'});
  const control=h.create(h.map,[feature(91)],{center:[0,0]});
  await assert.rejects(control.ready,/shader.*link/i);
  assert.equal(control.diagnostics.status,'error');assert.match(control.diagnostics.error,/fragment shader link rejected/);
  assert.deepEqual([...h.layers.keys()],['native-provider']);assert.equal(h.map.repaints,0);
  assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));
});

test('a facade draw exception restores shared state and leaves the native city usable with explicit recovery',async()=>{
  const h=harness({drawFailure:true});h.layers.set('native-provider',{id:'native-provider'});
  const control=h.create(h.map,[feature(92)],{center:[0,0]});await control.ready;
  const layer=h.layers.get('zone-district-surfaces');
  assert.doesNotThrow(()=>layer.render({},new Three.Matrix4().toArray()));
  assert.equal(control.diagnostics.status,'error');assert.match(control.diagnostics.error,/facade draw failed/);
  assert.deepEqual([...h.layers.keys()],['native-provider']);assert.equal(h.events.at(-1),'reset');
  assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));
});

test('Three first-use shader diagnostics cannot silently turn an unsuccessful draw into ready city detail',async()=>{
  const h=harness({drawShaderError:true});h.layers.set('native-provider',{id:'native-provider'});
  const control=h.create(h.map,[feature(93)],{center:[0,0]});await control.ready;
  const layer=h.layers.get('zone-district-surfaces');assert.doesNotThrow(()=>layer.render({},new Three.Matrix4().toArray()));
  assert.equal(control.diagnostics.status,'error');assert.equal(control.diagnostics.shaderLinked,false);assert.equal(control.diagnostics.firstFrameRendered,false);
  assert.match(control.diagnostics.error,/late shader link rejected/);assert.deepEqual([...h.layers.keys()],['native-provider']);
  assert.equal(h.renderers[0].disposals,1);assert.ok(h.resources.every(r=>r.disposals===1));
});

test('a stale shader failure cannot remove or overwrite a newer style controller',async()=>{
  const shader=deferred();let compiles=0;
  const h=harness({shader:()=>++compiles===1?shader.promise:Promise.resolve()}),old=h.create(h.map,[feature(89)],{center:[0,0]});
  h.map.removeLayer([...h.layers.keys()][0]);await old.ready;assert.equal(old.diagnostics.status,'disposed');
  const replacement=h.create(h.map,[feature(90)],{center:[0,0]});await replacement.ready;
  const current=[...h.layers.values()][0],before=h.doc.body.dataset.zoneDistrictSurfaces;
  shader.reject(Error('old style failed'));await Promise.resolve();await Promise.resolve();
  assert.equal([...h.layers.values()][0],current);assert.equal(h.doc.body.dataset.zoneDistrictSurfaces,before);assert.equal(replacement.diagnostics.status,'ready');
  current.render({},new Three.Matrix4().toArray());assert.equal(h.renderers[1].draws.length,1);replacement.dispose();assert.ok(h.resources.every(r=>r.disposals===1));
});

test('duplicate, empty, cancelled and failed installation paths never steal another map layer',async()=>{
  const h=harness(),first=h.create(h.map,[feature(17)],{center:[0,0]});await first.ready;const before=h.resources.length;
  assert.throws(()=>h.create(h.map,[feature(17)],{center:[0,0]}),/already installed/);assert.equal(h.resources.length,before);first.dispose();
  for(const [features,options,status]of[[[],{},'empty'],[[feature(17)],{isActive:()=>false},'cancelled']]){const empty=harness(),c=empty.create(empty.map,features,{center:[0,0],...options});await c.ready;assert.equal(c.diagnostics.status,status);assert.equal(empty.layers.size,0);assert.equal(empty.renderers.length,0);c.dispose();}
  const broken=harness({addFailure:true});broken.layers.set('native-provider',{id:'native-provider'});assert.throws(()=>broken.create(broken.map,[feature(18)],{center:[0,0]}),/style rejected/);assert.deepEqual([...broken.layers.keys()],['native-provider']);assert.equal(broken.renderers.length,0);
});

test('surfacePaletteCategories, isDisposed, and isVisible expose district surface state cleanly',async()=>{
  assert.deepEqual(module.surfacePaletteCategories(),['glass','walls','stone','metal']);
  assert.equal(module.surfacePaletteCategoryCount(),4);
  assert.equal(module.surfacePaletteColors('glass').length,4);
  assert.deepEqual(module.surfacePaletteColors('unknown'),[]);
  assert.equal(module.maxSurfaceWindowLimit(),12000);
  assert.equal(module.maxSurfaceRoofDetailLimit(),600);
  assert.equal(module.maxSurfaceWallPanelLimit(),12000);
  const h=harness(),control=h.create(h.map,[feature(17)],{center:[0,0]});await control.ready;
  assert.equal(control.isDisposed(),false);assert.equal(control.isVisible(),true);assert.equal(control.isPrepared(),true);
  control.setVisible(false);assert.equal(control.isVisible(),false);
  control.dispose();assert.equal(control.isDisposed(),true);assert.equal(control.isPrepared(),false);
});

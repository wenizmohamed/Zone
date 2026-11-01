import * as THREE from '../lib/three184/three.module.js';

// Presentation over actual provider walls, never replacement buildings, POIs
// or collision geometry. All distances below are ground meters at the origin.
const CIRCUMFERENCE=40075016.68557849;
const LIMITS=Object.freeze({maxWindows:12000,maxRoofDetails:600,maxWallPanels:12000,maxBands:6000,maxFeatures:5000,maxCoordinates:160000});
const PALETTE=Object.freeze({glass:['#354550','#728a92','#bcc6c7','#aab6b7'],walls:['#969d9f','#a6acad','#929b9f','#b7b7af','#98a19e','#a3a6a0','#b7b9b2','#929b9e'],stone:['#acb1ad','#8d9999','#a9aeaa'],metal:['#79888b','#929b9a','#63757b']});

export function surfaceLimits(){
  return {...LIMITS};
}

export function surfacePalette(){
  return {
    glass:[...PALETTE.glass],
    walls:[...PALETTE.walls],
    stone:[...PALETTE.stone],
    metal:[...PALETTE.metal],
  };
}
const LAYER='zone-district-surfaces';

export function surfaceLayerId(){
  return LAYER;
}

export function isSupportedSurfacePaletteCategory(category){
  return Object.hasOwn(PALETTE,String(category??''));
}
const SURFACE_OWNERS=new WeakMap();
const ORDER_CACHE=new Map(); // Only grid sizes1..100, shared across every wall.
function mercator(point){return[(point[0]+180)/360,(1-Math.log(Math.tan(Math.PI/4+point[1]*Math.PI/360))/Math.PI)/2];}
function hash(value){let n=2166136261;for(const char of value){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function pointInRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inside(point,rings){return pointInRing(point,rings[0])&&!rings.slice(1).some(r=>pointInRing(point,r));}
function quota(value,fallback,ceiling){if(value===undefined)return fallback;if(!Number.isSafeInteger(value)||value<0)throw new Error('Surface budgets require nonnegative finite integers.');return Math.min(value,ceiling);}
function quad(a,b,bottom,top,normal,offset=.14){return[[a[0]+normal[0]*offset,bottom,a[1]+normal[1]*offset],[b[0]+normal[0]*offset,bottom,b[1]+normal[1]*offset],[b[0]+normal[0]*offset,top,b[1]+normal[1]*offset],[a[0]+normal[0]*offset,top,a[1]+normal[1]*offset]];}
function edgeDistance(point,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length)):0;return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz);}
function roofInterior(rings){
  const xs=rings[0].map(p=>p[0]),zs=rings[0].map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),near=Math.min(...zs),far=Math.max(...zs);
  let best=null,room=0;
  // Maximal sampled clearance, not polygon centroid: an L-shaped courtyard or
  // a hole never receives a floating attachment. Circle containment implies the
  // whole inscribed rectangular footprint is inside, not just its four corners.
  for(let z=1;z<8;z++)for(let x=1;x<8;x++){
    const point=[left+(right-left)*x/8,near+(far-near)*z/8];if(!inside(point,rings))continue;
    let clearance=Infinity;for(const ring of rings)for(let edge=0;edge<ring.length;edge++)clearance=Math.min(clearance,edgeDistance(point,ring[edge],ring[(edge+1)%ring.length]));
    if(clearance>room){best=point;room=clearance;}
  }
  return best&&room>.6?{point:best,room}:null;
}
function countCoordinates(features){
  let count=0;
  function visit(value,depth=0){
    if(!Array.isArray(value))return;
    if(value.length>LIMITS.maxCoordinates||depth>4)throw new Error('Provider coordinate budget exceeded.');
    if(typeof value[0]==='number'){if(++count>LIMITS.maxCoordinates)throw new Error('Provider coordinate budget exceeded.');return;}
    for(const entry of value)visit(entry,depth+1);
  }
  for(const feature of features)visit(feature?.geometry?.coordinates);
  return count;
}
function spreadOrder(size){
  if(ORDER_CACHE.has(size))return ORDER_CACHE.get(size);
  const power=2**Math.ceil(Math.log2(Math.max(1,size))),result=[];
  for(let index=0;index<power;index++){let value=index,reversed=0;for(let bit=1;bit<power;bit*=2){reversed=reversed*2+(value&1);value>>>=1;}if(reversed<size)result.push(reversed);}
  ORDER_CACHE.set(size,result);return result;
}
function* facadeWindows(facades){
  // Interleave walls and widely spaced floors/columns before filling gaps. A
  // small quota still articulates tall buildings instead of only their ground.
  const valid=facades.filter(f=>f.floors>0&&f.columns>0).map(f=>({...f,rows:spreadOrder(f.floors),cols:spreadOrder(f.columns)})),cells=valid.reduce((n,f)=>Math.max(n,f.floors*f.columns),0);
  for(let cell=0;cell<cells;cell++)for(const [wallIndex,f] of valid.entries()){
    if(cell>=f.floors*f.columns)continue;
    const floor=f.rows[(cell%f.floors+wallIndex)%f.floors],column=f.cols[Math.floor(cell/f.floors)];
    const sill=f.record.base+1+floor*3.2;if(sill+1.5>f.record.top-.4)continue;
    const distance=(column+.5)*f.length/f.columns,left=distance-.64,right=distance+.64;
    yield {...f.record,color:(f.color+floor*7+column*3)%4,points:quad([f.a[0]+f.direction[0]*left,f.a[1]+f.direction[1]*left],[f.a[0]+f.direction[0]*right,f.a[1]+f.direction[1]*right],sill,sill+1.5,f.normal)};
  }
}
function* facadeBands(facades){
  for(const f of facades)yield{kind:'cornice',value:{...f.record,color:f.color%3,points:quad(f.a,f.b,Math.max(f.record.base,f.record.top-.32),f.record.top-.02,f.normal,.12)}};
  const floors=facades.reduce((n,f)=>Math.max(n,f.floors),0);
  for(let floor=1;floor<floors;floor++)for(const f of facades){
    const sill=f.record.base+1+floor*3.2;if(floor>=f.floors||sill+1.5>f.record.top-.4)continue;
    yield{kind:'floor',value:{...f.record,color:f.color%3,points:quad(f.a,f.b,sill-.48,sill-.38,f.normal,.11)}};
  }
}
function* facadeWalls(facades){
  for(const f of facades)yield{...f.record,color:hash('masonry|'+f.record.providerId)%PALETTE.walls.length,points:quad(f.a,f.b,f.record.base,f.record.top,f.normal,.018)};
}
function balanced(streams,limit,append){
  let count=0,active=streams;
  while(active.length&&count<limit){const next=[];for(const stream of active){const item=stream.next();if(item.done)continue;append(item.value);count++;next.push(stream);if(count===limit)break;}active=next;}
}

export function planDistrictSurfaces(features,{center=[-73.9865,40.698],maxWindows=12000,maxRoofDetails=600,maxWallPanels=12000}={}){
  if(!Array.isArray(center)||center.length!==2||center.some(n=>!Number.isFinite(n))||Math.abs(center[0])>180||Math.abs(center[1])>=85)throw new Error('Finite geographic surface origin required.');
  if(!Array.isArray(features)||features.length>LIMITS.maxFeatures)throw new Error('Provider feature budget exceeded.');
  const coordinates=countCoordinates(features); // Reject before JSON keys or local-geometry allocation.
  const windowLimit=quota(maxWindows,12000,LIMITS.maxWindows),roofLimit=quota(maxRoofDetails,600,LIMITS.maxRoofDetails),wallLimit=quota(maxWallPanels,12000,LIMITS.maxWallPanels);
  const [x,y]=mercator(center),meter=1/(CIRCUMFERENCE*Math.cos(center[1]*Math.PI/180));
  const plan={center:center.slice(),origin:{x,y,meter},wallPanels:[],windows:[],floorLines:[],cornices:[],roofDetails:[],diagnostics:{sourceFeatures:features.length,acceptedFeatures:0,polygons:0,skippedFeatures:0,coordinates,wallPanels:0,wallPanelFeatures:0,wallPanelCandidates:0,wallPanelCoverageComplete:false,windows:0,floorLines:0,cornices:0,roofDetails:0,triangles:0,limits:{maxWindows:windowLimit,maxRoofDetails:roofLimit,maxWallPanels:wallLimit,maxBands:LIMITS.maxBands}}};
  const entries=features.map(feature=>({feature,key:String(feature?.properties?.providerId??feature?.id??'')+'|'+String(feature?.properties?.providerTile??'')+'|'+String(feature?.id??'')+'|'+JSON.stringify(feature?.geometry?.coordinates??[])})).sort((a,b)=>a.key.localeCompare(b.key));
  const seen=new Set(),groups=[];
  for(const {feature,key} of entries){
    const p=feature?.properties||{},top=Number(p.height),rawBase=Number(p.min_height??0),base=Math.max(0,rawBase),polygons=feature?.geometry?.type==='Polygon'?[feature.geometry.coordinates]:feature?.geometry?.type==='MultiPolygon'?feature.geometry.coordinates:[];
    if(seen.has(key)||p.extrude!=='true'||p.underground==='true'||!Number.isFinite(top)||!Number.isFinite(rawBase)||top<=base||top>2000||!polygons?.length){plan.diagnostics.skippedFeatures++;continue;}seen.add(key);
    let accepted=false;const facades=[];
    for(let polygonIndex=0;polygonIndex<polygons.length;polygonIndex++){
      const raw=polygons[polygonIndex];if(!Array.isArray(raw)||!raw.length)continue;
      const rings=[];let valid=true;
      for(const ring of raw){
        if(!Array.isArray(ring)||ring.length<4){valid=false;break;}
        const points=[];for(const point of ring){
          if(!Array.isArray(point)||point.length<2||point.slice(0,2).some(n=>!Number.isFinite(n))||Math.abs(point[0])>180||Math.abs(point[1])>=85){valid=false;break;}
          const m=mercator(point),local=[(m[0]-x)/meter,(m[1]-y)/meter];if(Math.hypot(...local)>5000){valid=false;break;}points.push(local);
        }
        if(!valid)break;
        if(Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])>1e-4){valid=false;break;}
        points.pop();const area=points.reduce((n,a,i)=>{const b=points[(i+1)%points.length];return n+a[0]*b[1]-b[0]*a[1];},0)/2;
        if(points.length<3||Math.abs(area)<.2){valid=false;break;}rings.push(points);
      }
      if(!valid||!rings.length)continue;
      accepted=true;plan.diagnostics.polygons++;
      const identity={providerId:String(p.providerId??feature.id??''),providerTile:p.providerTile??null,featureId:String(feature.id??''),polygonIndex,base,top};
      if(plan.roofDetails.length<roofLimit){
        const interior=roofInterior(rings);if(interior){
          const width=Math.min(2.4,interior.room*.8),depth=width*.65,height=.58,[cx,cz]=interior.point;
          plan.roofDetails.push({...identity,kind:'roof-plant',color:hash(key)%3,position:[cx,top+.045+height/2,cz],size:[width,height,depth],footprint:[[cx-width/2,cz-depth/2],[cx+width/2,cz-depth/2],[cx+width/2,cz+depth/2],[cx-width/2,cz+depth/2]]});
        }
      }
      for(let ringIndex=0;ringIndex<rings.length;ringIndex++){
        const ring=rings[ringIndex];
        for(let edge=0;edge<ring.length;edge++){
          const a=ring[edge],b=ring[(edge+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
          const direction=[dx/length,dz/length],normal=[-direction[1],direction[0]],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
          if(inside([middle[0]+normal[0]*.15,middle[1]+normal[1]*.15],rings)){normal[0]*=-1;normal[1]*=-1;}
          const record={...identity,ringIndex,edge},color=hash(key+'|'+ringIndex+'|'+edge);
          const floors=Math.min(100,Math.floor((top-base-.9)/3.2)),columns=Math.min(80,Math.floor((length-1.7)/3.1));
          facades.push({record,color,a,b,length,direction,normal,floors,columns});
        }
      }
    }
    if(accepted){plan.diagnostics.acceptedFeatures++;groups.push(facades);}else plan.diagnostics.skippedFeatures++;
  }
  balanced(groups.map(facadeWindows),windowLimit,value=>plan.windows.push(value));
  balanced(groups.map(facadeBands),LIMITS.maxBands,entry=>(entry.kind==='cornice'?plan.cornices:plan.floorLines).push(entry.value));
  balanced(groups.map(facadeWalls),wallLimit,value=>plan.wallPanels.push(value));
  const wallPanelCandidates=groups.reduce((count,facades)=>count+facades.length,0),wallPanelFeatures=new Set(plan.wallPanels.map(panel=>panel.providerId+'|'+panel.providerTile+'|'+panel.featureId)).size;
  Object.assign(plan.diagnostics,{wallPanels:plan.wallPanels.length,wallPanelFeatures,wallPanelCandidates,wallPanelCoverageComplete:plan.wallPanels.length===wallPanelCandidates,windows:plan.windows.length,floorLines:plan.floorLines.length,cornices:plan.cornices.length,roofDetails:plan.roofDetails.length,triangles:2*(plan.wallPanels.length+plan.windows.length+plan.floorLines.length+plan.cornices.length)+12*plan.roofDetails.length});
  return plan;
}

export function summarizeSurfacePlan(plan){
  const d=plan?.diagnostics||{};
  return {
    acceptedFeatures:Number(d.acceptedFeatures||0),
    polygons:Number(d.polygons||0),
    wallPanels:Array.isArray(plan?.wallPanels)?plan.wallPanels.length:0,
    windows:Array.isArray(plan?.windows)?plan.windows.length:0,
    floorLines:Array.isArray(plan?.floorLines)?plan.floorLines.length:0,
    cornices:Array.isArray(plan?.cornices)?plan.cornices.length:0,
    roofDetails:Array.isArray(plan?.roofDetails)?plan.roofDetails.length:0,
    triangles:Number(d.triangles||0),
  };
}

export function facadeCell(u,v,width=3.1){
  const height=3.2,x=((u%width)+width)%width/width,y=((v%height)+height)%height/height;
  return {column:Math.floor(u/width),floor:Math.floor(v/height),glass:Math.abs(x-.5)<=.64/width&&y>=1/height&&y<=2.5/height,frame:Math.abs(x-.5)<=.77/width&&y>=.87/height&&y<=2.63/height};
}
function installFacadeShader(material){
  // Full walls carry meter-scaled detail even when the separate raised-pane
  // budget is exhausted. No extra textures, tiles, geometry or draw calls.
  material.customProgramCacheKey=()=> 'zone-meter-facade111-v1';
  material.onBeforeCompile=shader=>{
    const required=[['vertexShader','#include <common>'],['vertexShader','#include <begin_vertex>'],['fragmentShader','#include <common>'],['fragmentShader','#include <color_fragment>'],['fragmentShader','#include <roughnessmap_fragment>']];
    if(required.some(([stage,anchor])=>!shader[stage].includes(anchor)))throw new Error('Facade shader contract differs from the vendored Three runtime.');
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 zoneFacade;\nvarying vec4 vZoneFacade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvZoneFacade = zoneFacade;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec4 vZoneFacade;
float zoneFacadeHash(vec2 cell, float seed) { return fract(sin(dot(cell, vec2(12.9898,78.233)) + seed * 1.714) * 43758.5453); }
vec2 zoneFacadeMasks() {
  float spacing = max(vZoneFacade.z,.001);
  vec2 tile = fract(vZoneFacade.xy / vec2(spacing,3.2));
  vec2 edge = max(fwidth(tile) * .6, vec2(.004));
  vec2 glassMin = vec2(.5-.64/spacing,1.0/3.2),glassMax = vec2(.5+.64/spacing,2.5/3.2);
  vec2 frameMin = vec2(.5-.77/spacing,.87/3.2),frameMax = vec2(.5+.77/spacing,2.63/3.2);
  vec2 glass = smoothstep(glassMin-edge,glassMin+edge,tile) * (1.0-smoothstep(glassMax-edge,glassMax+edge,tile));
  vec2 frame = smoothstep(frameMin-edge,frameMin+edge,tile) * (1.0-smoothstep(frameMax-edge,frameMax+edge,tile));
  return vec2(glass.x * glass.y,frame.x * frame.y) * step(.5,vZoneFacade.z);
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if (vZoneFacade.z > .5) {
  vec2 masks = zoneFacadeMasks();
  vec2 cell = floor(vZoneFacade.xy / vec2(vZoneFacade.z,3.2));
  float variation = zoneFacadeHash(cell,vZoneFacade.w);
  float stoneVariation = .94 + .08 * zoneFacadeHash(floor(vZoneFacade.xy * 3.0),vZoneFacade.w);
  diffuseColor.rgb *= stoneVariation;
  vec3 frameColor = vec3(.16,.19,.20);
  vec3 paneColor = mix(vec3(.045,.075,.09),vec3(.27,.35,.37),variation);
  diffuseColor.rgb = mix(diffuseColor.rgb,frameColor,masks.y);
  diffuseColor.rgb = mix(diffuseColor.rgb,paneColor,masks.x);
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor,.31,zoneFacadeMasks().x);');
  };
  material.userData.zoneFacadeProfile='meter-scaled-masonry-glass111';
}
function appendQuad(batch,points,color,facade=null){
  const shade=new THREE.Color(color),width=facade?Math.hypot(points[1][0]-points[0][0],points[1][2]-points[0][2]):0;
  const height=facade?facade.top-facade.base:0,seed=facade?hash(facade.providerId)%1024:0,columns=Math.min(80,Math.floor((width-1.7)/3.1)),spacing=facade&&columns>0?width/columns:0;
  const metric=[[0,0],[width,0],[width,height],[0,height]];
  for(const index of [0,1,2,0,2,3]){batch.positions.push(...points[index]);batch.colors.push(shade.r,shade.g,shade.b);batch.facades.push(metric[index][0],metric[index][1],spacing,seed);}
}
function appendBox(batch,detail){
  const [x,y,z]=detail.position,[w,h,d]=detail.size.map(n=>n/2),p=[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]].map(q=>[q[0]+x,q[1]+y,q[2]+z]);
  for(const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])appendQuad(batch,face.map(i=>p[i]),PALETTE.metal[detail.color]);
}

export function createDistrictSurfaces(map,features,options={}){
  if(map.getLayer(LAYER))throw new Error('District surface layer already installed.');
  const doc=options.document??globalThis.document,isActive=options.isActive??(()=>true),at=map.getCenter?.();
  const prepareTimeoutMs=options.prepareTimeoutMs??12000;
  if(!Number.isSafeInteger(prepareTimeoutMs)||prepareTimeoutMs<1||prepareTimeoutMs>30000)throw new Error('Facade preparation timeout must be 1..30000 milliseconds.');
  const plan=planDistrictSurfaces(features,{center:options.center??(at?[Number(at.lng),Number(at.lat)]:undefined),maxWindows:options.maxWindows,maxRoofDetails:options.maxRoofDetails,maxWallPanels:options.maxWallPanels});
  let disposed=false,visible=true,prepared=false,renderer,scene,camera,shaderFailure=null,cancelPreparation=null,preparing=Promise.resolve();
  const geometries=[],materials=[],diagnostics={...plan.diagnostics,status:'preparing',renderer:'provider-footprint-surface-detail',source:'same-native-provider-footprints',origin:plan.center.slice(),geometryVertices:0,geometryTriangles:0,calls:0,triangles:0,textures:0,shadows:0,postPasses:0,continuousAnimation:false,shaderPrograms:0,shaderLinked:null,firstFrameRendered:false};
  const publish=()=>{
    if(SURFACE_OWNERS.has(map)&&SURFACE_OWNERS.get(map)!==control)return;
    if(doc?.body?.dataset)doc.body.dataset.zoneDistrictSurfaces=JSON.stringify(diagnostics);
    const notice=doc?.getElementById?.('districtSurfaceStatus111'),message=doc?.getElementById?.('districtSurfaceMessage111');
    // This recovery control is shared by facade detail and rooftop signs.
    // One producer reaching ready is not permission to hide the other's error.
    const failed=['zoneDistrictSurfaces','zoneDistrictLandmarks'].some(key=>{try{return ['failed','error'].includes(JSON.parse(doc?.body?.dataset?.[key]||'{}').status);}catch(_){return false;}});
    if(notice){notice.hidden=!failed;if(message&&failed)message.textContent=doc.documentElement?.lang==='ar'?'تعذر عرض بعض تفاصيل المباني. الخريطة وأدواتها ما زالت متاحة.':'Some building detail could not render. The map and its controls remain available.';}
  };
  const local=new THREE.Matrix4().makeTranslation(plan.origin.x,plan.origin.y,0).scale(new THREE.Vector3(plan.origin.meter,-plan.origin.meter,plan.origin.meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  function release(){for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();geometries.length=0;materials.length=0;renderer?.dispose();}
  function remove(){if(disposed)return;disposed=true;prepared=false;cancelPreparation?.();cancelPreparation=null;if(SURFACE_OWNERS.get(map)===control)SURFACE_OWNERS.delete(map);release();diagnostics.status='disposed';publish();}
  function fail(error){if(disposed)return;control.dispose();diagnostics.status='error';diagnostics.error=String(error.message||error).slice(0,1800);publish();}
  function shaderLinkFailure(gl,program,vertex,fragment){
    const logs=[gl.getProgramInfoLog?.(program),vertex&&gl.getShaderInfoLog?.(vertex),fragment&&gl.getShaderInfoLog?.(fragment)].filter(Boolean).join('\n').trim().slice(0,1600);
    diagnostics.shaderLinked=false;
    return new Error('Building facade shader link failed'+(logs?': '+logs:'.'));
  }
  function prepareShaders(gl){
    // Own every readiness timer. The vendor async helper retains an internal
    // material-properties poller that cannot survive immediate GPU disposal.
    return new Promise((resolve,reject)=>{
      let settled=false,pollTimer,deadlineTimer;
      function finish(error){if(settled)return;settled=true;clearTimeout(pollTimer);clearTimeout(deadlineTimer);cancelPreparation=null;if(error)reject(error);else resolve();}
      cancelPreparation=()=>finish();
      function check(){
        if(settled)return;if(disposed||!isActive()){finish();return;}
        try{
          const programs=renderer.info.programs||[];diagnostics.shaderPrograms=programs.length;
          if(!programs.length)throw new Error('No compiled building facade shader programs.');
          if(shaderFailure)throw shaderFailure;
          for(const entry of programs){
            if(typeof entry.isReady!=='function'||!entry.program)throw new Error('Facade shader readiness contract differs from the vendored Three runtime.');
            if(!entry.isReady()){pollTimer=setTimeout(check,10);return;}
          }
          for(const entry of programs)if(gl.getProgramParameter(entry.program,gl.LINK_STATUS)===false)shaderFailure=shaderLinkFailure(gl,entry.program);
          if(shaderFailure)throw shaderFailure;
          diagnostics.shaderLinked=true;finish();
        }catch(error){finish(error);}
      }
      deadlineTimer=setTimeout(()=>finish(new Error('Building facade preparation timed out. Use Retry to prepare it again.')),prepareTimeoutMs);
      pollTimer=setTimeout(check,10);
    });
  }
  const layer={id:LAYER,type:'custom',renderingMode:'3d',onAdd(_map,gl){
    scene=new THREE.Scene();camera=new THREE.Camera();
    scene.add(new THREE.HemisphereLight('#d6e1e5','#61686c',1.45));const key=new THREE.DirectionalLight('#e3e8ed',1.8);key.position.set(-90,180,70);scene.add(key);
    const batches=Array.from({length:4},()=>({positions:[],colors:[],facades:[]}));
    for(const window of plan.windows)appendQuad(batches[0],window.points,PALETTE.glass[window.color]);
    for(const wall of plan.wallPanels)appendQuad(batches[1],wall.points,PALETTE.walls[wall.color],wall);
    for(const line of plan.floorLines)appendQuad(batches[1],line.points,PALETTE.stone[line.color]);
    for(const cornice of plan.cornices)appendQuad(batches[2],cornice.points,PALETTE.stone[cornice.color]);
    for(const detail of plan.roofDetails)appendBox(batches[3],detail);
    batches.forEach((batch,index)=>{
      if(!batch.positions.length)return;
      const geometry=new THREE.BufferGeometry();geometries.push(geometry);geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));geometry.setAttribute('zoneFacade',new THREE.Float32BufferAttribute(batch.facades,4));geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:index===0?.30:.88,metalness:index===0?.18:index===3?.28:.03,depthTest:true,depthWrite:index===1||index===3,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});materials.push(material);
      if(index===1)installFacadeShader(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.name=['measured-facade-glass','measured-stone-floorlines','measured-roof-cornices','interior-roof-metal'][index];
      // Explicit order beats opaque-material sorting: full walls write depth
      // first. Glass has a physical .122m gap outside it, not coplanar decals.
      mesh.renderOrder=index===0?1:index===2?2:0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);
      diagnostics.geometryVertices+=geometry.getAttribute('position').count;
    });
    diagnostics.geometryTriangles=diagnostics.geometryVertices/3;
    renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.debug.checkShaderErrors=true;
    renderer.debug.onShaderError=(context,program,vertex,fragment)=>{shaderFailure=shaderLinkFailure(context,program,vertex,fragment);};
    renderer.resetState();
    renderer.compile(scene,camera);
    preparing=prepareShaders(gl).then(()=>{
      if(disposed)return;if(!isActive()){if(map.getLayer(LAYER))map.removeLayer(LAYER);else remove();return;}
      prepared=true;renderer.resetState();diagnostics.status='ready';publish();if(visible)map.triggerRepaint?.();
    });renderer.resetState();publish();
  },render(_gl,input){
    if(disposed||!prepared||!visible||!isActive()||map.getPitch()<=1)return;
    const projection=input?.defaultProjectionData?.mainMatrix??input;if(!projection||projection.length!==16||!Array.from(projection).every(Number.isFinite))return;
    camera.projectionMatrix.fromArray(projection).multiply(local);
    let frameFailure=null;
    try{
      renderer.resetState();renderer.render(scene,camera);if(shaderFailure)throw shaderFailure;
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;diagnostics.textures=renderer.info.memory.textures;diagnostics.drawnAtZoom=map.getZoom?.()??null;diagnostics.firstFrameRendered=true;
    }catch(error){frameFailure=error;}finally{renderer.resetState();}
    if(frameFailure){fail(frameFailure);return;}publish();
  },onRemove:remove};
  const control={diagnostics,getDiagnostics(){return {...diagnostics};},ready:null,setVisible(value){if(disposed)return;visible=!!value;if(visible&&isActive())map.triggerRepaint?.();},dispose(){if(disposed)return;if(SURFACE_OWNERS.get(map)===control&&map.getLayer(LAYER))map.removeLayer(LAYER);else remove();}};
  publish();
  if(!isActive()||diagnostics.geometryTriangles===0&&plan.diagnostics.triangles===0){diagnostics.status=isActive()?'empty':'cancelled';control.ready=Promise.resolve(control);publish();return control;}
  try{
    SURFACE_OWNERS.set(map,control);
    map.addLayer(layer,map.getLayer('zone-poi-halo')?'zone-poi-halo':undefined);
    control.ready=preparing.then(()=>control).catch(error=>{fail(error);throw error;});
  }catch(error){fail(error);throw error;}
  return control;
}

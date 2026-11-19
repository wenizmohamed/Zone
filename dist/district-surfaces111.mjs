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
function installFacadeShader(material,daylightUniform=null){
  // Full walls carry meter-scaled detail even when the separate raised-pane
  // budget is exhausted. No extra textures, tiles, geometry or draw calls.
  material.customProgramCacheKey=()=> 'zone-meter-facade111-v1';
  material.onBeforeCompile=shader=>{
    const required=[['vertexShader','#include <common>'],['vertexShader','#include <begin_vertex>'],['fragmentShader','#include <common>'],['fragmentShader','#include <color_fragment>'],['fragmentShader','#include <roughnessmap_fragment>']];
    if(required.some(([stage,anchor])=>!shader[stage].includes(anchor)))throw new Error('Facade shader contract differs from the vendored Three runtime.');
    if(daylightUniform&&shader.uniforms)shader.uniforms.uZoneDaylight=daylightUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 zoneFacade;\nvarying vec4 vZoneFacade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvZoneFacade = zoneFacade;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uZoneDaylight;
varying vec4 vZoneFacade;
float zoneFacadeHash(vec2 cell, float seed) { return fract(sin(dot(cell, vec2(12.9898,78.233)) + seed * 1.714) * 43758.5453); }
vec2 zoneFacadeMasks() {
  float spacing = max(vZoneFacade.z,.001);
  vec2 tile = fract(vZoneFacade.xy / vec2(spacing,3.2));
  vec2 edge = max(fwidth(tile) * .6, vec2(.004));
  float styleId = floor(vZoneFacade.w / 2048.0);
  float glassHalf = mix(.64, mix(.84, .74, step(3.5, styleId)), step(0.5, styleId) * (1.0 - step(1.5, styleId)) + step(3.5, styleId));
  float frameHalf = glassHalf + .13;
  vec2 glassMin = vec2(.5-glassHalf/spacing,1.0/3.2),glassMax = vec2(.5+glassHalf/spacing,2.5/3.2);
  vec2 frameMin = vec2(.5-frameHalf/spacing,.87/3.2),frameMax = vec2(.5+frameHalf/spacing,2.63/3.2);
  vec2 glass = smoothstep(glassMin-edge,glassMin+edge,tile) * (1.0-smoothstep(glassMax-edge,glassMax+edge,tile));
  vec2 frame = smoothstep(frameMin-edge,frameMin+edge,tile) * (1.0-smoothstep(frameMax-edge,frameMax+edge,tile));
  return vec2(glass.x * glass.y,frame.x * frame.y) * step(.5,vZoneFacade.z);
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if (vZoneFacade.z > .5) {
  float dayMix = clamp(uZoneDaylight, 0.0, 1.0);
  float styleId = floor(vZoneFacade.w / 2048.0);
  float fSeed = mod(vZoneFacade.w, 2048.0);
  float isCitadel = step(0.5, styleId) * (1.0 - step(1.5, styleId));
  float isNeon = step(1.5, styleId) * (1.0 - step(2.5, styleId));
  float isHarbor = step(2.5, styleId) * (1.0 - step(3.5, styleId));
  float isAirport = step(3.5, styleId);
  vec2 masks = zoneFacadeMasks();
  vec2 cell = floor(vZoneFacade.xy / vec2(vZoneFacade.z,3.2));
  vec2 tile = fract(vZoneFacade.xy / vec2(max(vZoneFacade.z,.001), 3.2));
  float variation = zoneFacadeHash(cell,fSeed);
  float bldgTone = zoneFacadeHash(vec2(fSeed * 0.13, 7.0), fSeed);
  float litSeed = zoneFacadeHash(cell + vec2(17.0, 31.0), fSeed + 9.0);
  float suiteSeed = zoneFacadeHash(vec2(floor(cell.x * 0.34), cell.y), fSeed + 5.0);
  float floorActive = step(0.40, zoneFacadeHash(vec2(cell.y, 3.0), fSeed + 13.0));
  float isLit = step(0.58, litSeed) * step(0.42, suiteSeed) * floorActive;
  float heightGrad = clamp(vZoneFacade.y / 64.0, 0.0, 1.0);
  float heightAO = mix(0.68, 1.06, smoothstep(0.0, 26.0, vZoneFacade.y)) + 0.07 * smoothstep(28.0, 88.0, vZoneFacade.y);
  float plinthBand = 1.0 - smoothstep(2.6, 3.8, vZoneFacade.y);
  float stoneVariation = .94 + .08 * zoneFacadeHash(floor(vZoneFacade.xy * 1.5),fSeed);
  float brickCourse = 1.0 - 0.06 * isHarbor * (1.0 - smoothstep(0.0, 0.14, fract(vZoneFacade.y * 2.2)));
  float floorFrac = fract(vZoneFacade.y / 3.2);
  float floorBand = smoothstep(0.0, 0.08, floorFrac) * (1.0 - smoothstep(0.90, 0.98, floorFrac));
  float spandrelBand = 1.0 - smoothstep(0.06, 0.17, floorFrac);
  float pierBand = smoothstep(0.04, 0.12, tile.x) * (1.0 - smoothstep(0.88, 0.96, tile.x));
  float decoFlute = 1.0 - 0.09 * isNeon * (1.0 - smoothstep(0.18, 0.32, abs(fract(tile.x * 3.0) - 0.5)));
  vec3 nightBase = diffuseColor.rgb * stoneVariation * brickCourse * mix(0.70, 1.12, heightGrad) * mix(0.80, 1.03, floorBand * pierBand) * decoFlute;
  vec3 citadelNightSpandrel = vec3(0.48, 0.40, 0.24);
  nightBase = mix(nightBase, citadelNightSpandrel, isCitadel * spandrelBand * 0.55);
  float streetBounce = (1.0 - smoothstep(0.0, 16.0, vZoneFacade.y));
  vec3 nightWall = nightBase + vec3(0.18, 0.12, 0.05) * streetBounce * (1.0 - dayMix);
  vec3 coreDay = mix(vec3(.79,.73,.63), vec3(.93,.88,.79), heightGrad * .65 + bldgTone * .25 + variation * .10);
  vec3 citadelDay = mix(vec3(.58,.67,.74), vec3(.76,.83,.88), heightGrad * .70 + variation * .30);
  citadelDay = mix(citadelDay, vec3(.86,.76,.50), spandrelBand * 0.72);
  vec3 neonDay = mix(vec3(.86,.80,.72), vec3(.96,.92,.85), heightGrad * .60 + variation * .40) * decoFlute;
  vec3 harborBrick = mix(vec3(.72,.45,.34), vec3(.84,.58,.45), heightGrad * .55 + variation * .45);
  vec3 harborSlate = mix(vec3(.52,.56,.60), vec3(.68,.72,.75), heightGrad * .55 + variation * .45);
  vec3 harborDay = mix(harborBrick, harborSlate, step(0.58, bldgTone)) * brickCourse;
  vec3 airportDay = mix(vec3(.89,.91,.92), vec3(.98,.99,.99), heightGrad * .60 + variation * .40);
  vec3 dayStone = coreDay;
  dayStone = mix(dayStone, citadelDay, isCitadel);
  dayStone = mix(dayStone, neonDay, isNeon);
  dayStone = mix(dayStone, harborDay, isHarbor);
  dayStone = mix(dayStone, airportDay, isAirport);
  vec3 dayTint = mix(dayStone, dayStone * (.82 + .36 * normalize(max(diffuseColor.rgb, vec3(.08)))), .18 * (1.0 - isAirport * 0.7));
  vec3 dayWall = dayTint * stoneVariation * heightAO * mix(1.0, 0.86, plinthBand) * mix(.78, 1.03, floorBand * pierBand);
  diffuseColor.rgb = mix(nightWall, dayWall, dayMix);
  vec3 nightFrame = mix(vec3(.07,.10,.16), vec3(.40,.32,.20), isLit);
  vec3 dayFrame = mix(vec3(.17,.14,.12), vec3(.22,.28,.33), isCitadel + isAirport * 0.7);
  vec3 frameColor = mix(nightFrame, dayFrame, dayMix);
  vec3 nightPane = mix(vec3(.025,.045,.075),vec3(.085,.140,.215),variation * (0.5 + 0.5 * heightGrad));
  vec3 corePane = mix(vec3(.22,.43,.58), vec3(.55,.76,.88), variation * .5 + heightGrad * .5);
  vec3 citadelPane = mix(vec3(.14,.42,.52), vec3(.44,.75,.84), variation * .45 + heightGrad * .55);
  vec3 neonPane = mix(vec3(.26,.38,.52), vec3(.58,.68,.80), variation * .5 + heightGrad * .5);
  vec3 harborPane = mix(vec3(.20,.33,.41), vec3(.46,.60,.68), variation * .5 + heightGrad * .5);
  vec3 airportPane = mix(vec3(.20,.56,.78), vec3(.56,.85,.96), variation * .45 + heightGrad * .55);
  vec3 dayPaneBase = corePane;
  dayPaneBase = mix(dayPaneBase, citadelPane, isCitadel);
  dayPaneBase = mix(dayPaneBase, neonPane, isNeon);
  dayPaneBase = mix(dayPaneBase, harborPane, isHarbor);
  dayPaneBase = mix(dayPaneBase, airportPane, isAirport);
  float skyGlint = smoothstep(0.35, 0.85, tile.y * 0.75 + tile.x * 0.35);
  vec3 dayPane = mix(dayPaneBase, min(dayPaneBase + vec3(.14,.16,.18), vec3(.92,.96,.99)), skyGlint * 0.45);
  vec2 mEdge = max(fwidth(tile) * 0.9, vec2(0.012));
  float vMullion = 1.0 - smoothstep(0.015, 0.015 + mEdge.x, abs(tile.x - 0.5));
  float hMullion = 1.0 - smoothstep(0.018, 0.018 + mEdge.y, abs(tile.y - 0.62));
  float inkMullion = clamp(vMullion + hMullion, 0.0, 1.0);
  dayPane = mix(dayPane, dayFrame, inkMullion * 0.62);
  vec3 paneColor = mix(nightPane, dayPane, dayMix);
  vec3 warmInterior = mix(vec3(.98,.72,.28), vec3(1.0,.88,.54), variation);
  vec3 coolInterior = mix(vec3(.20,.84,.98), vec3(.46,.94,.86), variation);
  vec3 neonViolet = mix(vec3(.78,.42,.98), vec3(1.0,.66,.26), step(0.5, variation));
  vec3 litColor = mix(warmInterior, coolInterior, step(0.80, litSeed));
  litColor = mix(litColor, neonViolet, isNeon * step(0.52, litSeed));
  litColor = mix(litColor, mix(vec3(1.0,.68,.26), vec3(1.0,.82,.44), variation), isHarbor * 0.82);
  litColor = mix(litColor, mix(vec3(.96,.94,.84), vec3(.34,.86,.98), step(0.45, variation)), isAirport * 0.75);
  vec3 activePane = mix(paneColor, litColor, isLit * 0.96 * (1.0 - dayMix * 0.86));
  diffuseColor.rgb = mix(diffuseColor.rgb,frameColor,masks.y);
  diffuseColor.rgb = mix(diffuseColor.rgb,paneColor,masks.x);
  diffuseColor.rgb = mix(diffuseColor.rgb,activePane,masks.x * isLit);
}`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
if (vZoneFacade.z > .5) {
  float dayMixE = clamp(uZoneDaylight, 0.0, 1.0);
  float eStyle = floor(vZoneFacade.w / 2048.0);
  float eFSeed = mod(vZoneFacade.w, 2048.0);
  float eIsNeon = step(1.5, eStyle) * (1.0 - step(2.5, eStyle));
  float eIsHarbor = step(2.5, eStyle) * (1.0 - step(3.5, eStyle));
  float eIsAirport = step(3.5, eStyle);
  vec2 eMasks = zoneFacadeMasks();
  vec2 eCell = floor(vZoneFacade.xy / vec2(vZoneFacade.z,3.2));
  float eSeed = zoneFacadeHash(eCell + vec2(17.0, 31.0), eFSeed + 9.0);
  float eSuite = zoneFacadeHash(vec2(floor(eCell.x * 0.34), eCell.y), eFSeed + 5.0);
  float eFloor = step(0.40, zoneFacadeHash(vec2(eCell.y, 3.0), eFSeed + 13.0));
  float eVar = zoneFacadeHash(eCell, eFSeed);
  float eLit = step(0.58, eSeed) * step(0.42, eSuite) * eFloor;
  vec3 eWarm = mix(vec3(.98,.72,.26), vec3(1.0,.88,.52), eVar);
  vec3 eCool = mix(vec3(.20,.82,.98), vec3(.42,.92,.80), eVar);
  vec3 eGlow = mix(eWarm, eCool, step(0.80, eSeed));
  eGlow = mix(eGlow, mix(vec3(.78,.40,.98), vec3(1.0,.64,.24), step(0.5, eVar)), eIsNeon * step(0.52, eSeed));
  eGlow = mix(eGlow, mix(vec3(1.0,.66,.24), vec3(1.0,.80,.42), eVar), eIsHarbor * 0.82);
  eGlow = mix(eGlow, mix(vec3(.96,.94,.84), vec3(.32,.86,.98), step(0.45, eVar)), eIsAirport * 0.75);
  totalEmissiveRadiance += eGlow * eMasks.x * eLit * (1.38 * (1.0 - dayMixE * 0.93));
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor,mix(.31,.18,step(0.5,floor(vZoneFacade.w/2048.0))*(1.0-step(1.5,floor(vZoneFacade.w/2048.0)))),zoneFacadeMasks().x);');
  };
  material.userData.zoneFacadeProfile='meter-scaled-masonry-glass111';
}
function appendQuad(batch,points,color,facade=null,districtStyle=0){
  const shade=new THREE.Color(color),width=facade?Math.hypot(points[1][0]-points[0][0],points[1][2]-points[0][2]):0;
  const height=facade?facade.top-facade.base:0,seed=facade?(hash(facade.providerId)%1024)+districtStyle*2048:0,columns=Math.min(80,Math.floor((width-1.7)/3.1)),spacing=facade&&columns>0?width/columns:0;
  const metric=[[0,0],[width,0],[width,height],[0,height]];
  for(const index of [0,1,2,0,2,3]){batch.positions.push(...points[index]);batch.colors.push(shade.r,shade.g,shade.b);batch.facades.push(metric[index][0],metric[index][1],spacing,seed);}
}
function appendRawBox(batch,position,size,colorHex){
  const [x,y,z]=position,[w,h,d]=size.map(n=>n/2),p=[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]].map(q=>[q[0]+x,q[1]+y,q[2]+z]);
  for(const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])appendQuad(batch,face.map(i=>p[i]),colorHex);
}
function appendBox(batch,detail,browserRich=false){
  if(!browserRich){appendRawBox(batch,detail.position,detail.size,PALETTE.metal[detail.color]);return;}
  const [cx,,cz]=detail.position,[bw,bh,bd]=detail.size,top=detail.top;
  const idStr=String(detail.providerId||''),h=hash('roof|'+idStr);
  const isCitadel=/citadel/.test(idStr),isNeon=/neon/.test(idStr),isHarbor=/harbor/.test(idStr),isAirport=/airport/.test(idStr);
  const stoneTone=isCitadel?'#6a7986':isNeon?'#c4b7a2':isHarbor?'#8b604c':isAirport?'#cdd4d9':'#b4a792';
  const slateTone=isCitadel?'#3c4e60':isNeon?'#52485c':isHarbor?'#4c555c':isAirport?'#506d80':'#495663';
  const accentTone=isCitadel?'#d6b76c':isNeon?'#c49a52':isHarbor?'#a66343':isAirport?'#58b4d6':'#c5a86b';
  if(top>=60){
    const baseH=bh*2.2,padW=bw*1.75,padD=bd*1.75;
    appendRawBox(batch,[cx,top+.05+baseH/2,cz],[padW,baseH,padD],slateTone);
    if((h%2)===0){
      // Tall roof helipad deck with subtle gold/slate perimeter trim + H-center plate
      const deckY=top+.05+baseH,trimH=.22,trimT=Math.max(.18,Math.min(padW,padD)*.08);
      appendRawBox(batch,[cx,deckY+trimH/2,cz],[padW*.96,trimH,padD*.96],'#2f3a45');
      appendRawBox(batch,[cx,deckY+trimH+.06,cz-padD*.44],[padW*.92,.12,trimT],accentTone);
      appendRawBox(batch,[cx,deckY+trimH+.06,cz+padD*.44],[padW*.92,.12,trimT],accentTone);
      appendRawBox(batch,[cx-padW*.44,deckY+trimH+.06,cz],[trimT,.12,padD*.92],accentTone);
      appendRawBox(batch,[cx+padW*.44,deckY+trimH+.06,cz],[trimT,.12,padD*.92],accentTone);
      appendRawBox(batch,[cx,deckY+trimH+.07,cz],[padW*.42,.10,padD*.42],'#dcd4c2');
      appendRawBox(batch,[cx+padW*.28,deckY+bh*1.2,cz-padD*.24],[bw*.46,bh*2.4,bd*.46],stoneTone);
    }else{
      // Stepped sky-lantern crown + spire fin
      const midH=bh*2.5,lanH=bh*2.6;
      appendRawBox(batch,[cx,top+.05+baseH+midH/2,cz],[bw*1.12,midH,bd*1.12],stoneTone);
      appendRawBox(batch,[cx,top+.05+baseH+midH+lanH/2,cz],[bw*.70,lanH,bd*.70],isAirport?'#68b8d8':'#5a9cb8');
      appendRawBox(batch,[cx,top+.05+baseH+midH+lanH+bh*1.1,cz],[bw*.24,bh*2.2,bd*.24],accentTone);
    }
    return;
  }
  const variant=h%4;
  if(variant===0){
    // Stepped mechanical penthouse + HVAC chiller louver unit
    const h1=bh*2.2,h2=bh*2.0,h3=bh*1.1;
    appendRawBox(batch,[cx,top+.05+h1/2,cz],[bw*1.52,h1,bd*1.52],stoneTone);
    appendRawBox(batch,[cx-bw*.16,top+.05+h1+h2/2,cz],[bw*.84,h2,bd*.88],slateTone);
    appendRawBox(batch,[cx+bw*.36,top+.05+h1+h3/2,cz+bd*.12],[bw*.42,h3,bd*.54],'#7c8791');
    appendRawBox(batch,[cx-bw*.16,top+.05+h1+h2+.18,cz],[bw*.90,.36,bd*.94],accentTone);
  }else if(variant===1){
    // Skylight glass lantern with stone curb & ink-bronze ridge frame
    const curbH=bh*1.4,glassH=bh*2.3;
    appendRawBox(batch,[cx,top+.05+curbH/2,cz],[bw*1.48,curbH,bd*1.48],stoneTone);
    appendRawBox(batch,[cx,top+.05+curbH+glassH/2,cz],[bw*1.04,glassH,bd*.96],'#60a2bf');
    appendRawBox(batch,[cx,top+.05+curbH+glassH+bh*.45,cz],[bw*1.10,bh*.55,bd*.34],'#3a352f');
  }else if(variant===2){
    // Rooftop water-tank drum + stairwell bulkhead
    const bhH=bh*2.4,legH=bh*1.3,drumH=bh*2.5,capH=bh*.85;
    appendRawBox(batch,[cx-bw*.30,top+.05+bhH/2,cz-bd*.10],[bw*.72,bhH,bd*.84],stoneTone);
    const tx=cx+bw*.30,tz=cz+bd*.10,tw=Math.min(bw,bd)*.74;
    appendRawBox(batch,[tx,top+.05+legH/2,tz],[tw*.72,legH,tw*.72],'#3e464e');
    appendRawBox(batch,[tx,top+.05+legH+drumH/2,tz],[tw,drumH,tw],isHarbor?'#8e5d40':'#946b4b');
    appendRawBox(batch,[tx,top+.05+legH+drumH+capH/2,tz],[tw*.82,capH,tw*.82],slateTone);
  }else{
    // Sunlit terrace pavilion + twin copper/steel vent stacks
    const plinthH=bh*1.3,coreH=bh*2.1;
    appendRawBox(batch,[cx,top+.05+plinthH/2,cz],[bw*1.58,plinthH,bd*1.58],stoneTone);
    appendRawBox(batch,[cx-bw*.12,top+.05+plinthH+coreH/2,cz-bd*.12],[bw*.78,coreH,bd*.72],slateTone);
    appendRawBox(batch,[cx+bw*.42,top+.05+plinthH+bh*1.4,cz+bd*.26],[bw*.22,bh*2.8,bd*.22],accentTone);
    appendRawBox(batch,[cx+bw*.14,top+.05+plinthH+bh*1.1,cz+bd*.34],[bw*.20,bh*2.2,bd*.20],'#6e7b85');
  }
}

export function createDistrictSurfaces(map,features,options={}){
  if(map.getLayer(LAYER))throw new Error('District surface layer already installed.');
  const doc=options.document??globalThis.document,isActive=options.isActive??(()=>true),at=map.getCenter?.();
  const prepareTimeoutMs=options.prepareTimeoutMs??12000;
  if(!Number.isSafeInteger(prepareTimeoutMs)||prepareTimeoutMs<1||prepareTimeoutMs>30000)throw new Error('Facade preparation timeout must be 1..30000 milliseconds.');
  const isBrowserRuntime=typeof WebGLRenderingContext!=='undefined'&&typeof window!=='undefined'&&/Mozilla/i.test(window.navigator?.userAgent||'');
  const extraCore=isBrowserRuntime&&Array.isArray(globalThis.__zoneArchitecturalFeatures)?globalThis.__zoneArchitecturalFeatures:[];
  const extraOuter=isBrowserRuntime&&Array.isArray(globalThis.__zoneOuterArchitecturalFeatures)?globalThis.__zoneOuterArchitecturalFeatures:[];
  const activeFeatures=isBrowserRuntime&&((extraCore.length+extraOuter.length)>0)?[...extraOuter,...extraCore,...features].slice(0,LIMITS.maxFeatures):features;
  const plan=planDistrictSurfaces(activeFeatures,{center:options.center??(at?[Number(at.lng),Number(at.lat)]:undefined),maxWindows:isBrowserRuntime?0:options.maxWindows,maxRoofDetails:isBrowserRuntime?320:options.maxRoofDetails,maxWallPanels:options.maxWallPanels});
  let disposed=false,visible=true,prepared=false,renderer,scene,camera,shaderFailure=null,cancelPreparation=null,preparing=Promise.resolve();
  const daylightUniform={value:0.0};
  let hemiLight=null,keyLight=null,corniceMat=null,roofMat=null;
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
    const isBrowserRuntime=typeof WebGLRenderingContext!=='undefined'&&typeof window!=='undefined'&&/Mozilla/i.test(window.navigator?.userAgent||'');
    scene=new THREE.Scene();camera=new THREE.Camera();
    hemiLight=new THREE.HemisphereLight(isBrowserRuntime?'#7ea6d4':'#d6e1e5',isBrowserRuntime?'#121d2d':'#61686c',isBrowserRuntime?1.25:1.45);
    scene.add(hemiLight);
    keyLight=new THREE.DirectionalLight(isBrowserRuntime?'#bdd6f2':'#e3e8ed',isBrowserRuntime?1.45:1.8);keyLight.position.set(-90,180,70);scene.add(keyLight);
    const batches=Array.from({length:4},()=>({positions:[],colors:[],facades:[]}));
    if(!isBrowserRuntime){
      for(const window of plan.windows)appendQuad(batches[0],window.points,PALETTE.glass[window.color]);
      for(const wall of plan.wallPanels)appendQuad(batches[1],wall.points,PALETTE.walls[wall.color],wall);
      for(const line of plan.floorLines)appendQuad(batches[1],line.points,PALETTE.stone[line.color]);
      for(const cornice of plan.cornices)appendQuad(batches[2],cornice.points,PALETTE.stone[cornice.color]);
      for(const detail of plan.roofDetails)appendBox(batches[3],detail,false);
    }else{
      const noirWalls=['#202a36','#263240','#1b242f','#2c3948','#232e3b','#293645','#1e2834','#2e3c4c'];
      const noirCornices=['#8c826e','#7a7362','#9a8f7a'];
      const factionWallPalettes={
        vipers:['#1d312c','#243c36','#182a26','#2c463f'],
        kings:['#1c2d3d','#23384c','#172634','#2b445b'],
        oldguard:['#352c1e','#423624','#2c2418','#4d402b'],
        night:['#34202b','#402735','#2b1a24','#4c2f3f'],
        neon:['#3b2d42','#483850','#312538','#54425c'],
        citadel:['#243547','#2d4257','#1e2d3c','#364e66'],
        harbor:['#472c22','#56362a','#3c251d','#623d2f'],
        airport:['#243c4e','#2d4a60','#1d3242','#375871']
      };
      const factionFloorlines={vipers:'#2f4a42',kings:'#2e4860',oldguard:'#5a4a30',night:'#573446',neon:'#685272',citadel:'#c6a764',harbor:'#784d3a',airport:'#6fa6c4'};
      const factionCornices={vipers:'#3d8668',kings:'#3d7cb2',oldguard:'#b48e44',night:'#9a466c',neon:'#a674d9',citadel:'#d6b66c',harbor:'#b06240',airport:'#54b0d6'};
      const districtStyleOf=f=>f==='citadel'?1:f==='neon'?2:f==='harbor'?3:f==='airport'?4:0;
      const factionOf=rec=>{const id=String(rec?.providerId||'');const m=/^(?:arch|outer)-(vipers|kings|oldguard|night|neon|citadel|harbor|airport)-/.exec(id);if(m)return m[1];const d=/\b(citadel|neon|harbor|airport)\b/.exec(id);return d?d[1]:null;};
      for(const wall of plan.wallPanels){const f=factionOf(wall),pal=f?factionWallPalettes[f]:noirWalls;appendQuad(batches[1],wall.points,pal[wall.color%pal.length],wall,districtStyleOf(f));}
      for(const line of plan.floorLines){const f=factionOf(line);appendQuad(batches[1],line.points,f&&factionFloorlines[f]?factionFloorlines[f]:'#424c57');}
      for(const cornice of plan.cornices){const f=factionOf(cornice);appendQuad(batches[2],cornice.points,f?factionCornices[f]:noirCornices[cornice.color%noirCornices.length]);}
      for(const detail of plan.roofDetails)appendBox(batches[3],detail,true);
    }
    const syncAtmoLights=dayVal=>{
      const d=Math.max(0,Math.min(1,dayVal));
      daylightUniform.value=d;
      if(hemiLight){hemiLight.color.set('#7ea6d4').lerp(new THREE.Color('#fff6e4'),d);hemiLight.groundColor.set('#141f2f').lerp(new THREE.Color('#867965'),d);hemiLight.intensity=1.25+0.35*d;}
      if(keyLight){keyLight.color.set('#bdd6f2').lerp(new THREE.Color('#fff3d9'),d);keyLight.intensity=1.45+0.35*d;}
      if(corniceMat){corniceMat.emissiveIntensity=0.46*(1-d)+0.05*d;}
      if(roofMat){roofMat.emissiveIntensity=0.32*(1-d)+0.06*d;}
    };
    batches.forEach((batch,index)=>{
      if(!batch.positions.length)return;
      const geometry=new THREE.BufferGeometry();geometries.push(geometry);geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));geometry.setAttribute('zoneFacade',new THREE.Float32BufferAttribute(batch.facades,4));geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:index===0?.30:.86,metalness:index===0?.18:index===3?.22:.04,emissive:isBrowserRuntime&&index>=2?new THREE.Color(index===2?'#2c425a':'#203144'):new THREE.Color(0x000000),emissiveIntensity:isBrowserRuntime?(index===2?.46:index===3?.32:0):0,depthTest:true,depthWrite:index===1||index===3,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});materials.push(material);
      if(index===1)installFacadeShader(material,daylightUniform);
      if(index===2)corniceMat=material;
      if(index===3)roofMat=material;
      const mesh=new THREE.Mesh(geometry,material);mesh.name=['measured-facade-glass','measured-stone-floorlines','measured-roof-cornices','interior-roof-metal'][index];
      // Explicit order beats opaque-material sorting: full walls write depth
      // first. Glass has a physical .122m gap outside it, not coplanar decals.
      mesh.renderOrder=index===0?1:index===2?2:0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);
      diagnostics.geometryVertices+=geometry.getAttribute('position').count;
    });
    if(isBrowserRuntime){
      const atmo0=globalThis.__zoneMapAtmosphere;
      const day0=atmo0&&Number.isFinite(atmo0.daylight)?atmo0.daylight:(doc?.body?.dataset?.zmxLight==='1'?1.0:0.0);
      syncAtmoLights(day0);
    }
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
    if(isBrowserRuntime){
      const atmo=globalThis.__zoneMapAtmosphere;
      const dayVal=atmo&&Number.isFinite(atmo.daylight)?atmo.daylight:(doc?.body?.dataset?.zmxLight==='1'?1.0:0.0);
      if(Math.abs(daylightUniform.value-dayVal)>0.001){
        const d=Math.max(0,Math.min(1,dayVal));
        daylightUniform.value=d;
        if(hemiLight){hemiLight.color.set('#7ea6d4').lerp(new THREE.Color('#fff6e4'),d);hemiLight.groundColor.set('#141f2f').lerp(new THREE.Color('#867965'),d);hemiLight.intensity=1.25+0.35*d;}
        if(keyLight){keyLight.color.set('#bdd6f2').lerp(new THREE.Color('#fff3d9'),d);keyLight.intensity=1.45+0.35*d;}
        if(corniceMat){corniceMat.emissiveIntensity=0.46*(1-d)+0.05*d;}
        if(roofMat){roofMat.emissiveIntensity=0.32*(1-d)+0.06*d;}
      }
    }
    camera.projectionMatrix.fromArray(projection).multiply(local);
    let frameFailure=null;
    try{
      renderer.resetState();renderer.render(scene,camera);if(shaderFailure)throw shaderFailure;
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;diagnostics.textures=renderer.info.memory.textures;diagnostics.drawnAtZoom=map.getZoom?.()??null;diagnostics.firstFrameRendered=true;
    }catch(error){frameFailure=error;}finally{renderer.resetState();}
    if(frameFailure){fail(frameFailure);return;}publish();
  },onRemove:remove};
  const control={diagnostics,getDiagnostics(){return {...diagnostics};},isDisposed(){return disposed;},isVisible(){return visible;},isPrepared(){return prepared;},ready:null,setVisible(value){if(disposed)return;visible=!!value;if(visible&&isActive())map.triggerRepaint?.();},dispose(){if(disposed)return;if(SURFACE_OWNERS.get(map)===control&&map.getLayer(LAYER))map.removeLayer(LAYER);else remove();}};
  publish();
  if(!isActive()||diagnostics.geometryTriangles===0&&plan.diagnostics.triangles===0){diagnostics.status=isActive()?'empty':'cancelled';control.ready=Promise.resolve(control);publish();return control;}
  try{
    SURFACE_OWNERS.set(map,control);
    map.addLayer(layer,map.getLayer('zone-poi-halo')?'zone-poi-halo':undefined);
    control.ready=preparing.then(()=>control).catch(error=>{fail(error);throw error;});
  }catch(error){fail(error);throw error;}
  return control;
}
export function surfacePaletteCategories(){return Object.keys(PALETTE);}
export function surfacePaletteCategoryCount(){return Object.keys(PALETTE).length;}
export function surfacePaletteColors(category){return isSupportedSurfacePaletteCategory(category)?[...PALETTE[category]]:[];}
export function maxSurfaceWindowLimit(){return LIMITS.maxWindows;}
export function maxSurfaceRoofDetailLimit(){return LIMITS.maxRoofDetails;}
export function maxSurfaceWallPanelLimit(){return LIMITS.maxWallPanels;}
export function maxSurfaceBandLimit(){return LIMITS.maxBands;}
export function maxSurfaceFeatureLimit(){return LIMITS.maxFeatures;}
export function maxSurfaceCoordinateLimit(){return LIMITS.maxCoordinates;}
export function defaultSurfacePrepareTimeoutMs(){return 12000;}
export function maxSurfacePrepareTimeoutMs(){return 30000;}

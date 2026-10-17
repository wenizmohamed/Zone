/* Cosmetic service-to-roof association. Provider footprints remain in memory
 * for the existing map lifetime only. No world geometry or ownership is edited. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoneServiceBuildings=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SERVICES=['bank','gym','alley','hospital','jail','market','shop','home','hq','jobs','school','casino','missions','arena','news','hof','pier'];
  const EARTH=6378137;
  function meters(point,origin){const latitude=origin[1]*Math.PI/180;return[(point[0]-origin[0])*Math.PI/180*EARTH*Math.cos(latitude),(point[1]-origin[1])*Math.PI/180*EARTH];}
  function geographic(point,origin){return[origin[0]+point[0]/(Math.PI/180*EARTH*Math.cos(origin[1]*Math.PI/180)),origin[1]+point[1]/(Math.PI/180*EARTH)];}
  function inRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  function inside(point,rings){return !!rings.length&&inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring));}
  function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
  function clearance(point,rings){return inside(point,rings)?Math.min(...rings.flatMap(ring=>ring.slice(0,-1).map((p,index)=>segmentDistance(point,p,ring[index+1])))):-1;}
  function roofAnchor(rings,origin){
    if(!rings?.length||rings.some(ring=>!Array.isArray(ring)||ring.length<4||ring.some(p=>!Array.isArray(p)||p.slice(0,2).some(n=>!Number.isFinite(n)))))return null;
    const local=rings.map(ring=>ring.map(p=>meters(p,origin))),outline=local[0],xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
    if(bounds[2]-bounds[0]>200||bounds[3]-bounds[1]>200)return null;
    let best=null,score=-1;
    // Sample the real roof interior, then refine around its best safe point.
    // Unlike a polygon centroid this cannot land in an L-shape gap/courtyard.
    const scan=(cx,cy,width,height,steps)=>{for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){const p=[cx+(x/(steps-1)-.5)*width,cy+(y/(steps-1)-.5)*height],distance=clearance(p,local);if(distance>score){best=p;score=distance;}}};
    scan((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2,bounds[2]-bounds[0],bounds[3]-bounds[1],7);
    if(!best)return null;
    for(let step=0;step<3;step++)scan(best[0],best[1],(bounds[2]-bounds[0])/Math.pow(3,step+1),(bounds[3]-bounds[1])/Math.pow(3,step+1),5);
    return {coordinates:geographic(best,origin),clearanceMeters:score,widthMeters:bounds[2]-bounds[0],depthMeters:bounds[3]-bounds[1]};
  }
  function buildingKey(feature){return String(feature.properties?.providerId??feature.id??'');}
  function closestRoofPoint(rings,origin,anchor){
    const local=rings.map(ring=>ring.map(p=>meters(p,origin))),center=meters(anchor.coordinates,origin),atOrigin=clearance([0,0],local);
    if(atOrigin>=1.25)return{...anchor,coordinates:origin.slice(),clearanceMeters:atOrigin};
    let best=center,score=Math.hypot(...center),room=anchor.clearanceMeters;
    for(const ring of local)for(let index=0;index<ring.length-1;index++){
      const a=ring[index],b=ring[index+1],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,(-a[0]*dx-a[1]*dy)/length)):0,edge=[a[0]+dx*t,a[1]+dy*t];
      for(const fraction of [.04,.08,.15,.3,.5,.8]){const point=[edge[0]+(center[0]-edge[0])*fraction,edge[1]+(center[1]-edge[1])*fraction],distance=Math.hypot(...point),safe=clearance(point,local);if(safe>=1.25&&distance<score){best=point;score=distance;room=safe;}}
    }
    return{...anchor,coordinates:geographic(best,origin),clearanceMeters:room};
  }
  function associate(pins,features,{maximumDistance=180}={}){
    const valid=(Array.isArray(features)?features:[]).filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&f.properties?.underground!=='true'&&f.properties?.type!=='building:part');
    const used=new Set(),associations=[],unbound=[],anchorCache=new Map();
    for(const id of SERVICES){
      const pin=(pins||[]).find(p=>p.id===id&&Array.isArray(p._lngLat));if(!pin)continue;
      const origin=pin._buildingSource||pin._lngLat,candidates=[];
      for(const feature of valid){const key=buildingKey(feature);if(!key||used.has(key))continue;
        const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
        for(const rings of polygons){
          const first=rings[0]?.[0];if(!first||Math.hypot(...meters(first,origin))>240)continue;
          let anchor=anchorCache.get(rings);if(anchor===undefined){anchor=roofAnchor(rings,origin);anchorCache.set(rings,anchor);}
          if(!anchor||anchor.clearanceMeters<1)continue;
          anchor=closestRoofPoint(rings,origin,anchor);
          // Two different tiny roofs can still be adjacent. Reserve enough
          // ground separation for the overview coin centers; never offset the
          // actual icon off its roof just to make a screen-space label fit.
          let crowded=false;
          if(associations.some(prior=>Math.hypot(...meters(anchor.coordinates,prior.coordinates))<32)){
            const interior=anchorCache.get(rings);
            if(!interior||associations.some(prior=>Math.hypot(...meters(interior.coordinates,prior.coordinates))<32))crowded=true;
            else anchor=interior;
          }
          const distance=Math.hypot(...meters(anchor.coordinates,origin));if(distance>maximumDistance)continue;
          candidates.push({...anchor,providerId:key,providerTile:feature.properties?.providerTile||null,heightMeters:Math.max(0,Number(feature.properties?.height)||0),
            containsAuthoredPoint:inside(origin,rings),distanceMeters:distance,polygon:rings,crowded});
        }
      }
      candidates.sort((a,b)=>Number(a.crowded)-Number(b.crowded)||Number(b.containsAuthoredPoint)-Number(a.containsAuthoredPoint)||a.distanceMeters-b.distanceMeters||a.providerId.localeCompare(b.providerId));
      const selected=candidates[0];if(!selected){unbound.push(id);continue;}
      used.add(selected.providerId);associations.push({id,...selected,sourceCoordinates:origin.slice(),source:'actual-provider-footprint',insideRoof:inside(selected.coordinates,selected.polygon)});
    }
    return {associations,unbound,complete:unbound.length===0,source:'actual-provider-footprint',maximumDistance};
  }
  function apply(pins,result){const byId=new Map(result.associations.map(a=>[a.id,a]));for(const pin of pins||[]){const association=byId.get(pin.id);if(!association)continue;pin._buildingSource=association.sourceCoordinates.slice();pin._lngLat=association.coordinates.slice();pin._buildingAssociation={...association};}return result;}
  return {SERVICES,associate,apply,inside,roofAnchor,meters};
});

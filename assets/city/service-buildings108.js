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
  function nearFootprintBounds(rings,origin,radius){
    const outline=rings?.[0];
    if(!Array.isArray(outline)||outline.length<4||outline.some(point=>!Array.isArray(point)||point.length<2||point.slice(0,2).some(value=>!Number.isFinite(value))))return false;
    const local=outline.map(point=>meters(point,origin)),xs=local.map(point=>point[0]),ys=local.map(point=>point[1]);
    const dx=Math.max(0,Math.min(...xs),-Math.max(...xs)),dy=Math.max(0,Math.min(...ys),-Math.max(...ys));
    // The closest point on the actual footprint's bounds is independent of
    // its ring start and winding. A containing footprint always has distance0.
    return Math.hypot(dx,dy)<=radius;
  }
  function footprintDistance(rings,origin){
    if(inside(origin,rings))return 0;
    const local=rings.map(ring=>ring.map(point=>meters(point,origin)));
    return Math.min(...local.flatMap(ring=>ring.slice(0,-1).map((point,index)=>segmentDistance([0,0],point,ring[index+1]))));
  }
  function placeOnOwnedRoof(selected,prior,origin,maximumDistance){
    const gap=32,shared=prior.filter(entry=>entry.providerId===selected.providerId),near=point=>prior.length?Math.min(...prior.map(entry=>Math.hypot(...meters(point,entry.coordinates)))):Infinity;
    let anchor=selected;
    // Ownership is already final. Only services sharing this actual building
    // may seek another safe interior point; neighboring roofs never steal it.
    if(shared.length&&near(anchor.coordinates)<gap){
      const local=selected.polygon.map(ring=>ring.map(point=>meters(point,origin))),outline=local[0],xs=outline.map(point=>point[0]),ys=outline.map(point=>point[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
      const minimumRoom=Math.max(1.25,Math.min(6,selected.clearanceMeters*.4));
      let best={anchor,spacing:near(anchor.coordinates),offset:Math.hypot(...meters(anchor.coordinates,origin))};
      for(let y=0;y<=20;y++)for(let x=0;x<=20;x++){
        const localPoint=[bounds[0]+(bounds[2]-bounds[0])*x/20,bounds[1]+(bounds[3]-bounds[1])*y/20],room=clearance(localPoint,local);
        if(room+1e-7<minimumRoom)continue;
        const coordinates=geographic(localPoint,origin),spacing=near(coordinates),offset=Math.hypot(...localPoint),enough=spacing+1e-7>=gap,bestEnough=best.spacing+1e-7>=gap;
        if(offset>maximumDistance)continue;
        let better=enough&&!bestEnough;
        if(enough===bestEnough)better=enough
          ?room>best.anchor.clearanceMeters+1e-7||Math.abs(room-best.anchor.clearanceMeters)<=1e-7&&offset<best.offset
          :spacing>best.spacing+1e-7||Math.abs(spacing-best.spacing)<=1e-7&&room>best.anchor.clearanceMeters;
        if(better)best={anchor:{...selected,coordinates,clearanceMeters:room},spacing,offset};
      }
      anchor=best.anchor;
    }
    const nearest=near(anchor.coordinates),crowdingWith=prior.filter(entry=>Math.hypot(...meters(anchor.coordinates,entry.coordinates))+1e-7<gap).map(entry=>entry.id);
    return {...anchor,distanceMeters:Math.hypot(...meters(anchor.coordinates,origin)),sharedRoof:shared.length>0,crowded:crowdingWith.length>0,crowdingWith,crowdingDistanceMeters:Number.isFinite(nearest)?nearest:null,crowdingTargetMeters:gap};
  }
  function associate(pins,features,{maximumDistance=180}={}){
    const valid=(Array.isArray(features)?features:[]).filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&f.properties?.underground!=='true'&&f.properties?.type!=='building:part');
    const associations=[],unbound=[],anchorCache=new Map();
    for(const id of SERVICES){
      const pin=(pins||[]).find(p=>p.id===id&&Array.isArray(p._lngLat));if(!pin)continue;
      const origin=pin._buildingSource||pin._lngLat,candidates=[];
      for(const feature of valid){const key=buildingKey(feature);if(!key)continue;
        const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
        for(const rings of polygons){
          if(!nearFootprintBounds(rings,origin,240))continue;
          let anchor=anchorCache.get(rings);if(anchor===undefined){anchor=roofAnchor(rings,origin);anchorCache.set(rings,anchor);}
          const containsAuthoredPoint=inside(origin,rings);
          if(!anchor||anchor.clearanceMeters<=0||!containsAuthoredPoint&&anchor.clearanceMeters+1e-7<1)continue;
          const distance=Math.hypot(...meters(anchor.coordinates,origin));if(distance>maximumDistance)continue;
          candidates.push({...anchor,providerId:key,providerTile:feature.properties?.providerTile||null,heightMeters:Math.max(0,Number(feature.properties?.height)||0),
            containsAuthoredPoint,footprintDistanceMeters:footprintDistance(rings,origin),distanceMeters:distance,polygon:rings});
        }
      }
      candidates.sort((a,b)=>Number(b.containsAuthoredPoint)-Number(a.containsAuthoredPoint)||a.footprintDistanceMeters-b.footprintDistanceMeters||a.distanceMeters-b.distanceMeters||a.providerId.localeCompare(b.providerId)||a.coordinates[0]-b.coordinates[0]||a.coordinates[1]-b.coordinates[1]||String(a.providerTile||'').localeCompare(String(b.providerTile||''))||JSON.stringify(a.polygon).localeCompare(JSON.stringify(b.polygon)));
      if(!candidates.length){unbound.push(id);continue;}
      const selected=placeOnOwnedRoof(candidates[0],associations,origin,maximumDistance);
      associations.push({id,...selected,sourceCoordinates:origin.slice(),source:'actual-provider-footprint',insideRoof:inside(selected.coordinates,selected.polygon)});
    }
    return {associations,unbound,complete:unbound.length===0,source:'actual-provider-footprint',maximumDistance};
  }
  function apply(pins,result){const byId=new Map(result.associations.map(a=>[a.id,a]));for(const pin of pins||[]){const association=byId.get(pin.id);if(!association)continue;pin._buildingSource=association.sourceCoordinates.slice();pin._lngLat=association.coordinates.slice();pin._buildingAssociation={...association};}return result;}
  return {SERVICES,associate,apply,inside,roofAnchor,meters};
});

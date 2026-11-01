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
    // or fallback services crowding an adjacent roof seek another safe interior
    // point on their own roof; neighboring roofs never steal ownership.
    if((shared.length||!selected.containsAuthoredPoint)&&near(anchor.coordinates)<gap){
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
    const associations=[],unbound=[],anchorCache=new Map(),destinations=[];
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
      // Neighboring tiles may contain several genuine fragments of one roof.
      // Keep the best fragment for this destination, but reserve its provider
      // identity only once across the whole assignment.
      const providers=new Set();
      destinations.push({id,origin,candidates:candidates.filter(candidate=>{if(providers.has(candidate.providerId))return false;providers.add(candidate.providerId);return true;})});
    }
    const reserved=new Set();
    // Genuine containing ownership precedes every nearest-roof fallback,
    // including owners appearing later in SERVICES. Shared ownership is valid
    // only when each owner's authored point really lies in that provider roof.
    for(const destination of destinations){
      const candidate=destination.candidates[0];
      if(candidate?.containsAuthoredPoint){destination.selected=candidate;reserved.add(candidate.providerId);}
    }
    const fallbackOwners=new Map();
    function assignFallback(destination,visited=new Set()){
      const candidates=destination.candidates.filter(candidate=>!reserved.has(candidate.providerId)&&!visited.has(candidate.providerId));
      // Preserve the ordinary nearest-free choice. Only an exhausted fallback
      // may move flexible owners along an augmenting path; genuine owners are
      // reserved above, and visited providers bound the search to this graph.
      const free=candidates.find(candidate=>!fallbackOwners.has(candidate.providerId));
      if(free){destination.selected=free;fallbackOwners.set(free.providerId,destination);return true;}
      for(const candidate of candidates){
        visited.add(candidate.providerId);
        if(assignFallback(fallbackOwners.get(candidate.providerId),visited)){
          destination.selected=candidate;fallbackOwners.set(candidate.providerId,destination);return true;
        }
      }
      return false;
    }
    for(const destination of destinations)if(!destination.selected)assignFallback(destination);
    for(const {id,origin,selected:owned} of destinations){
      if(!owned){unbound.push(id);continue;}
      const selected=placeOnOwnedRoof(owned,associations,origin,maximumDistance);
      associations.push({id,...selected,sourceCoordinates:origin.slice(),source:'actual-provider-footprint',insideRoof:inside(selected.coordinates,selected.polygon)});
    }
    if(associations.some(entry=>entry.crowded)){
      for(let pass=0;pass<2;pass++)for(let i=0;i<associations.length;i++){
        if(associations[i].containsAuthoredPoint)continue;
        const others=associations.filter((_,idx)=>idx!==i);
        if(!others.some(other=>Math.hypot(...meters(associations[i].coordinates,other.coordinates))+1e-7<32))continue;
        const destination=destinations.find(d=>d.id===associations[i].id);
        let reanchored=placeOnOwnedRoof(destination.selected,others,destination.origin,maximumDistance);
        if(others.some(other=>Math.hypot(...meters(reanchored.coordinates,other.coordinates))+1e-7<32)){
          for(let j=0;j<associations.length;j++){
            if(i===j||associations[j].containsAuthoredPoint)continue;
            if(Math.hypot(...meters(associations[i].coordinates,associations[j].coordinates))+1e-7>=32)continue;
            const otherDest=destinations.find(d=>d.id===associations[j].id);
            const localA=destination.selected.polygon.map(r=>r.map(p=>meters(p,destination.origin))),xsA=localA[0].map(p=>p[0]),ysA=localA[0].map(p=>p[1]),bA=[Math.min(...xsA),Math.min(...ysA),Math.max(...xsA),Math.max(...ysA)],minA=Math.max(1.25,Math.min(6,destination.selected.clearanceMeters*.4));
            const localB=otherDest.selected.polygon.map(r=>r.map(p=>meters(p,otherDest.origin))),xsB=localB[0].map(p=>p[0]),ysB=localB[0].map(p=>p[1]),bB=[Math.min(...xsB),Math.min(...ysB),Math.max(...xsB),Math.max(...ysB)],minB=Math.max(1.25,Math.min(6,otherDest.selected.clearanceMeters*.4));
            const rest=associations.filter((_,idx)=>idx!==i&&idx!==j);
            const ptsA=[],ptsB=[];
            for(let y=0;y<=12;y++)for(let x=0;x<=12;x++){
              const pA=[bA[0]+(bA[2]-bA[0])*x/12,bA[1]+(bA[3]-bA[1])*y/12],rA=clearance(pA,localA),oA=Math.hypot(...pA);
              if(rA+1e-7>=minA&&oA<=maximumDistance){const cA=geographic(pA,destination.origin);if(rest.every(r=>Math.hypot(...meters(cA,r.coordinates))+1e-7>=32))ptsA.push({coordinates:cA,clearanceMeters:rA,offset:oA});}
              const pB=[bB[0]+(bB[2]-bB[0])*x/12,bB[1]+(bB[3]-bB[1])*y/12],rB=clearance(pB,localB),oB=Math.hypot(...pB);
              if(rB+1e-7>=minB&&oB<=maximumDistance){const cB=geographic(pB,otherDest.origin);if(rest.every(r=>Math.hypot(...meters(cB,r.coordinates))+1e-7>=32))ptsB.push({coordinates:cB,clearanceMeters:rB,offset:oB});}
            }
            let bestPair=null;
            for(const a of ptsA)for(const b of ptsB){
              const d=Math.hypot(...meters(a.coordinates,b.coordinates));if(d+1e-7<32)continue;
              const minRoom=Math.min(a.clearanceMeters,b.clearanceMeters),totOff=a.offset+b.offset;
              if(!bestPair||minRoom>bestPair.minRoom+1e-7||Math.abs(minRoom-bestPair.minRoom)<=1e-7&&totOff<bestPair.totOff)bestPair={a,b,minRoom,totOff};
            }
            if(bestPair){
              reanchored={...destination.selected,coordinates:bestPair.a.coordinates,clearanceMeters:bestPair.a.clearanceMeters,distanceMeters:bestPair.a.offset};
              associations[j]={...associations[j],coordinates:bestPair.b.coordinates,clearanceMeters:bestPair.b.clearanceMeters,distanceMeters:bestPair.b.offset,insideRoof:inside(bestPair.b.coordinates,otherDest.selected.polygon)};
            }
          }
        }
        associations[i]={id:destination.id,...reanchored,sourceCoordinates:destination.origin.slice(),source:'actual-provider-footprint',insideRoof:inside(reanchored.coordinates,reanchored.polygon)};
      }
      for(let i=0;i<associations.length;i++){
        const prior=associations.slice(0,i),near=prior.length?Math.min(...prior.map(entry=>Math.hypot(...meters(associations[i].coordinates,entry.coordinates)))):Infinity;
        const crowdingWith=prior.filter(entry=>Math.hypot(...meters(associations[i].coordinates,entry.coordinates))+1e-7<32).map(entry=>entry.id);
        associations[i]={...associations[i],crowded:crowdingWith.length>0,crowdingWith,crowdingDistanceMeters:Number.isFinite(near)?near:null};
      }
    }
    return {associations,unbound,complete:unbound.length===0,source:'actual-provider-footprint',maximumDistance};
  }
  function apply(pins,result){const byId=new Map(result.associations.map(a=>[a.id,a]));for(const pin of pins||[]){const association=byId.get(pin.id);if(!association)continue;pin._buildingSource=association.sourceCoordinates.slice();pin._lngLat=association.coordinates.slice();pin._buildingAssociation={...association};}return result;}
  function summarizeAssociations(result){
    const associations=Array.isArray(result?.associations)?result.associations:[];
    const unbound=Array.isArray(result?.unbound)?result.unbound:[];
    return {
      boundCount:associations.length,
      unboundCount:unbound.length,
      complete:Boolean(result?.complete),
      insideRoofCount:associations.filter(a=>a?.insideRoof).length,
      crowdedCount:associations.filter(a=>a?.crowded).length,
      source:result?.source||'actual-provider-footprint'
    };
  }
  function serviceCount(){return SERVICES.length;}
  function serviceIds(){return [...SERVICES];}
  function crowdingTargetMeters(){return 32;}
  function earthRadiusMeters(){return EARTH;}
  function defaultMaximumDistanceMeters(){return 180;}
  function maxRoofSpanMeters(){return 200;}
  function footprintSearchRadiusMeters(){return 240;}
  function hasCrowding(result){return Array.isArray(result?.associations)&&result.associations.some(a=>Boolean(a?.crowded));}
  function isSupportedServiceId(id){return SERVICES.includes(String(id));}
  function unboundServiceIds(result){return Array.isArray(result?.unbound)?[...result.unbound]:[];}
  function boundServiceIds(result){return Array.isArray(result?.associations)?result.associations.map(a=>a?.id).filter(Boolean):[];}
  return {SERVICES,associate,apply,summarizeAssociations,serviceCount,serviceIds,crowdingTargetMeters,earthRadiusMeters,defaultMaximumDistanceMeters,maxRoofSpanMeters,footprintSearchRadiusMeters,hasCrowding,isSupportedServiceId,unboundServiceIds,boundServiceIds,inside,roofAnchor,meters};
});

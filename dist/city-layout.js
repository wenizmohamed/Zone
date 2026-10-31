/* Deterministic cosmetic placement only. Never creates or changes territory state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoneCityLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function inRing(point,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function insidePolygon(point,rings){return !!rings?.length&&inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r));}
  const CIRCUMFERENCE=2*Math.PI*6371008.8;
  function mercator(point){return [point[0]/360,(1-Math.log(Math.tan(Math.PI/4+point[1]*Math.PI/360))/Math.PI)/2];}
  function segmentDistance(point,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
    return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
  }
  function footprintFits(point,width,rings,latitudeLimit){
    if(!insidePolygon(point,rings))return false;
    // The renderer centers each model and normalizes its largest X/Z dimension.
    // This circle encloses that square at every rotation, plus 0.5m clearance.
    // The greatest input latitude bounds the renderer's shared Mercator scale.
    const radius=(width/Math.SQRT2+.5)/(CIRCUMFERENCE*Math.cos(latitudeLimit*Math.PI/180)),center=mercator(point);
    return rings.every(ring=>ring.every((a,i)=>segmentDistance(center,mercator(a),mercator(ring[(i+1)%ring.length]))>radius));
  }
  function hash(value){let result=2166136261;for(const ch of String(value))result=Math.imul(result^ch.charCodeAt(0),16777619);return result>>>0;}
  function validFeatures(features){return (Array.isArray(features)?features:[]).filter(feature=>feature?.geometry?.type==='Polygon'&&Array.isArray(feature.geometry.coordinates)&&feature.geometry.coordinates.length&&feature.geometry.coordinates.every(ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[1])<85.051129)));}
  function pointAt(ring,u,v){
    // All authored cells are convex quadrilaterals with shared corner vertices.
    const a=ring[0],b=ring[1],c=ring[2],d=ring[3];
    return [a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*u*v+d[0]*(1-u)*v,a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*u*v+d[1]*(1-u)*v];
  }
  function metersBetween(a,b){const p=mercator(a),q=mercator(b);return Math.hypot(q[0]-p[0],q[1]-p[1])*CIRCUMFERENCE*Math.cos((a[1]+b[1])*Math.PI/360);}
  function createPlacements(features){
    const output=[],models=['building_A_withoutBase','building_C_withoutBase','building_E_withoutBase','building_G_withoutBase'],valid=validFeatures(features);
    const latitudeLimit=valid.reduce((max,feature)=>feature.geometry.coordinates.reduce((max,ring)=>ring.reduce((max,p)=>Math.max(max,Math.abs(p[1])),max),max),0);
    for(const feature of valid){
      const rings=feature.geometry.coordinates,ring=rings[0],id=feature.id??feature.properties?.id;if(id==null||ring.length!==5)continue;
      const h=hash(id),span=Math.min(metersBetween(ring[0],ring[1]),metersBetween(ring[2],ring[3]));
      if(span<=1)continue;
      const width=Math.min(140,span*.17),start=mercator(ring[0]),end=mercator(ring[1]),rotation=-Math.atan2(end[1]-start[1],end[0]-start[0]);
      const candidates=[];
      [.12,.35,.65,.88].forEach((v,row)=>[.12,.28,.72,.88].forEach((u,column)=>{
        const seed=hash(id+':'+row+':'+column),variation=seed%4;
        candidates.push({u:u+((seed>>>4)%100/100-.5)*.035,v:v+((seed>>>11)%100/100-.5)*.05,model:models[variation],width:Math.min(140,width*(.86+(seed>>>18)%29/100)),heightScale:.6+(seed>>>8)%76/100,rotation:rotation+((seed>>>3)%2)*Math.PI/2,shade:variation});
      }));
      [.22,.39,.64,.81].forEach((v,i)=>candidates.push({u:i%2?.485:.515,v,model:'car_sedan',width:13,rotation:rotation+Math.PI/2}));
      [[.23,.24],[.76,.24],[.23,.76],[.76,.76]].forEach(([u,v])=>candidates.push({u,v,model:'bush',width:27,rotation}));
      candidates.push({u:.425,v:.28,model:'streetlight',width:10,rotation},{u:.575,v:.73,model:'streetlight',width:10,rotation});
      for(const candidate of candidates){
        const coordinates=pointAt(ring,candidate.u,candidate.v);
        if(footprintFits(coordinates,candidate.width,rings,latitudeLimit))output.push({blockId:id,model:candidate.model,coordinates,width:candidate.width,heightScale:candidate.heightScale||1,rotation:candidate.rotation,shade:candidate.shade||0});
      }
    }
    return output;
  }
  function createStreets(features){
    const output=[];
    for(const feature of validFeatures(features)){
      const rings=feature.geometry.coordinates,ring=rings[0],id=feature.id??feature.properties?.id;
      if(id==null||rings.length!==1||ring.length!==5)continue;
      const h=hash(id),bend=((h>>>5)%11-5)*.008,lane=.016+(h%3)*.004;
      const center=[[.5,.055],[.5+bend,.30],[.5-bend*.4,.67],[.5,.945]];
      const local=center.map(([u,v])=>[u-lane,v]).concat(center.slice().reverse().map(([u,v])=>[u+lane,v]));
      const points=local.map(([u,v])=>pointAt(ring,u,v));points.push(points[0]);
      // Quiet interior access lanes have no pavement edge and never touch a cell
      // boundary. Their varied bends cannot recreate the hidden territory grid.
      output.push({type:'Feature',properties:{blockId:id,kind:'street'},geometry:{type:'Polygon',coordinates:[points]}});
    }
    return {type:'FeatureCollection',features:output};
  }
  function selectVisiblePlacements(placements,view){
    const {width,height,project,mobile}=view;if(!width||!height||typeof project!=='function')return [];
    const visible=placements.map((item,index)=>({item,index,pixel:project(item.coordinates)})).filter(({pixel:p})=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>-width*.2&&p.x<width*1.2&&p.y>-height*.25&&p.y<height*1.2);
    visible.sort((a,b)=>Math.hypot(a.pixel.x-width/2,a.pixel.y-height/2)-Math.hypot(b.pixel.x-width/2,b.pixel.y-height/2)||a.index-b.index);
    let buildings=0,props=0;
    return visible.filter(({item})=>item.model.startsWith('building_')?++buildings<=(mobile?140:380):++props<=(mobile?80:180)).map(({item})=>item);
  }
  function summarizePlacements(placements){
    const list=Array.isArray(placements)?placements:[];
    const buildings=list.filter(item=>String(item?.model||'').startsWith('building_'));
    const avgWidth=buildings.length?Number((buildings.reduce((sum,item)=>sum+(Number(item.width)||0),0)/buildings.length).toFixed(2)):0;
    return {
      total:list.length,
      buildings:buildings.length,
      cars:list.filter(item=>item?.model==='car_sedan').length,
      bushes:list.filter(item=>item?.model==='bush').length,
      streetlights:list.filter(item=>item?.model==='streetlight').length,
      uniqueBlocks:new Set(list.map(item=>item?.blockId).filter(Boolean)).size,
      uniqueModels:new Set(list.map(item=>item?.model).filter(Boolean)).size,
      averageBuildingWidth:avgWidth
    };
  }
  return {createPlacements,insidePolygon,createStreets,selectVisiblePlacements,summarizePlacements};
});

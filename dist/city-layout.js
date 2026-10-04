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
  function createPlacements(features){
    const output=[],models=['building_A_withoutBase','building_C_withoutBase','building_E_withoutBase','building_G_withoutBase'];
    const valid=(Array.isArray(features)?features:[]).filter(feature=>feature?.geometry?.type==='Polygon'&&Array.isArray(feature.geometry.coordinates)&&feature.geometry.coordinates.length&&feature.geometry.coordinates.every(ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[1])<85.051129)));
    const latitudeLimit=valid.reduce((max,feature)=>feature.geometry.coordinates.reduce((max,ring)=>ring.reduce((max,p)=>Math.max(max,Math.abs(p[1])),max),max),0);
    for(const feature of valid){
      const rings=feature.geometry.coordinates,ring=rings?.[0];
      if(!Array.isArray(ring)||ring.length<4||ring.some(p=>!Array.isArray(p)||p.length<2||!p.every(Number.isFinite)))continue;
      const id=feature.id??feature.properties?.id;if(id==null)continue;
      const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const width=maxX-minX,height=maxY-minY;if(width<=0||height<=0)continue;
      const h=hash(id);
      const candidates=[
        {x:.27,y:.3,model:models[h%4],width:30+(h%9)},
        {x:.73,y:.69,model:models[(h+1)%4],width:25+(h%12)},
        {x:.66,y:.22,model:'car_sedan',width:5.2},
        {x:.17,y:.75,model:h%3===0?'watertower':'bush',width:h%3===0?8:6},
        {x:.82,y:.2,model:'streetlight',width:3.5}
      ];
      for(const candidate of candidates){
        const coordinates=[minX+width*candidate.x,minY+height*candidate.y];
        if(footprintFits(coordinates,candidate.width,rings,latitudeLimit))output.push({blockId:id,model:candidate.model,coordinates,width:candidate.width,rotation:(h%4)*Math.PI/2});
      }
    }
    return output;
  }
  return {createPlacements,insidePolygon};
});

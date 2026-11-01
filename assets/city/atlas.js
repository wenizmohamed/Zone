/* ZONE city atlas. Original procedural artwork, 2026. No third-party imagery.
 * The only inputs are immutable server polygons and display names. Cosmetic
 * roofs, traffic and lighting never create ownership or gameplay state.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ZoneCityAtlas=root.ZoneCityAtlas||api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SIZE=4096,MAX_BLOCKS=240,MAX_ROOFS=12000;
  const ROOFS=['#667078','#777c7d','#555f66','#7b756b','#625957','#84857b','#515961','#72665c'];
  const plans=new WeakMap();
  const mercator=p=>[p[0]/360,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2];
  const lngLat=p=>[p[0]*360,Math.atan(Math.sinh(Math.PI*(1-2*p[1])))*180/Math.PI];
  function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function valid(feature){return feature?.geometry?.type==='Polygon'&&feature.id!=null&&feature.geometry.coordinates?.length&&feature.geometry.coordinates.every(r=>Array.isArray(r)&&r.length>=4&&r.every(p=>p?.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[1])<85.051129));}
  function inRing(p,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  function inside(p,rings){return inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r));}
  function point(ring,u,v){const[a,b,c,d]=ring;return [a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*u*v+d[0]*(1-u)*v,a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*u*v+d[1]*(1-u)*v];}
  function rect(ring,u,v,w,h){return [[u-w/2,v-h/2],[u+w/2,v-h/2],[u+w/2,v+h/2],[u-w/2,v+h/2]].map(([x,y])=>point(ring,x,y));}
  function createPlan(input){
    const blocks=[],roofs=[],districts=new Map();
    for(const f of (Array.isArray(input)?input:[]).filter(valid).slice(0,MAX_BLOCKS).sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
      const rings=f.geometry.coordinates,ring=rings[0];if(ring.length!==5)continue;
      const seed=hash(f.id),industrial=seed%7===0,park=seed%17===0;
      const block={id:String(f.id),rings:rings.map(r=>r.map(p=>p.slice(0,2))),seed,industrial,park,roads:[{points:[point(ring,.5,0),point(ring,.5,.5),point(ring,.5,1)],width:.038},{points:[point(ring,0,.365),point(ring,.5,.365),point(ring,1,.365)],width:.025},{points:[point(ring,0,.655),point(ring,.5,.655),point(ring,1,.655)],width:.021}]};
      blocks.push(block);
      const did=f.properties?.districtId,name=f.properties?.districtName;
      if(did&&name){if(!districts.has(did))districts.set(did,{name,points:[]});districts.get(did).points.push(point(ring,.5,.5));}
      const columns=[.08,.22,.355,.645,.78,.92],rows=[.085,.215,.30,.435,.565,.73,.815,.935];
      rows.forEach((v,row)=>columns.forEach((u,column)=>{
        if((industrial||park)&&row>=5&&column>=3)return;
        const s=hash(f.id+':roof:'+row+':'+column),w=.09+(s%16)/1000,h=.065+((s>>>8)%20)/1000;
        const corners=rect(ring,u+((s>>>15)%7-3)*.001,v,w,h);
        // Sample every roof edge. Holes cannot receive buildings or invented
        // territory: the renderer also clips every stroke to the source rings.
        if(!corners.every((p,i)=>[0,.25,.5,.75].every(t=>inside([p[0]*(1-t)+corners[(i+1)%4][0]*t,p[1]*(1-t)+corners[(i+1)%4][1]*t],rings))))return;
        if(rings.slice(1).some(hole=>hole.some(p=>inRing(p,[...corners,corners[0]]))))return;
        if(roofs.length<MAX_ROOFS)roofs.push({blockId:block.id,corners,seed:s,color:ROOFS[s%ROOFS.length],floors:2+(s>>>6)%9,kind:s%6===0?'sawtooth':s%9===0?'glass':'flat'});
      }));
    }
    const all=blocks.flatMap(b=>b.rings[0].map(mercator));
    if(!all.length)return {blocks:[],roofs:[],labels:[],bounds:null};
    const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
    if(!(maxX>minX&&maxY>minY))return {blocks:[],roofs:[],labels:[],bounds:null};
    return {blocks,roofs,bounds:[minX,minY,maxX,maxY],labels:[...districts].map(([id,d])=>({type:'Feature',properties:{id,name:d.name},geometry:{type:'Point',coordinates:[d.points.reduce((n,p)=>n+p[0],0)/d.points.length,d.points.reduce((n,p)=>n+p[1],0)/d.points.length]}}))};
  }
  function render(plan,canvas,options={}){
    if(!plan.bounds)return null;
    const [minX,minY,maxX,maxY]=plan.bounds,aspect=(maxY-minY)/(maxX-minX);
    const size=options.size||(options.mobile?3072:SIZE);
    canvas.width=size;canvas.height=Math.max(1024,Math.min(size,Math.round(size*aspect)));
    const ctx=canvas.getContext('2d'),sx=canvas.width/(maxX-minX),sy=canvas.height/(maxY-minY);
    const project=p=>{const m=mercator(p);return [(m[0]-minX)*sx,(m[1]-minY)*sy];};
    function path(points,close=true){ctx.beginPath();points.forEach((p,i)=>{const[x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});if(close)ctx.closePath();}
    function poly(points,fill,stroke,width=1){path(points);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
    function road(road,scale){
      const width=road.width*scale;
      path(road.points,false);ctx.lineCap='butt';ctx.lineJoin='round';ctx.lineWidth=width+5;ctx.strokeStyle='#77776b';ctx.stroke();
      path(road.points,false);ctx.lineWidth=width+2;ctx.strokeStyle='#22292d';ctx.stroke();
      path(road.points,false);ctx.lineWidth=width;ctx.strokeStyle='#3f4547';ctx.stroke();
      path(road.points,false);ctx.lineWidth=.8;ctx.strokeStyle='#c5ae75';ctx.setLineDash([6,8]);ctx.stroke();ctx.setLineDash([]);
    }
    for(const block of plan.blocks){
      const ring=block.rings[0],a=project(ring[0]),b=project(ring[1]),d=project(ring[3]),scale=Math.min(Math.hypot(b[0]-a[0],b[1]-a[1]),Math.hypot(d[0]-a[0],d[1]-a[1]));
      ctx.save();ctx.beginPath();for(const r of block.rings){r.forEach((p,i)=>{const[x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.clip('evenodd');
      ctx.fillStyle='#343c3e';ctx.fillRect(0,0,canvas.width,canvas.height);
      // Grain is seeded surface wear, never an animation or external texture.
      for(let n=0;n<125;n++){const s=hash(block.id+':grain:'+n),p=project(point(ring,(s%997)/997,((s>>>10)%991)/991));ctx.fillStyle=n%3?'#b1ac9510':'#00000020';ctx.fillRect(p[0],p[1],1+(s%3),1+(s%2));}
      for(const r of block.roads)road(r,scale);
      // Service alleys break the large parcels into recognizable urban blocks.
      [.145,.275,.5,.785,.875].forEach(v=>{path([point(ring,.025,v),point(ring,.475,v)],false);ctx.lineWidth=Math.max(2,scale*.012);ctx.strokeStyle='#252b2d';ctx.stroke();path([point(ring,.525,v),point(ring,.975,v)],false);ctx.stroke();});
      if(block.industrial||block.park){
        const yard=rect(ring,.78,.82,.34,.26);poly(yard,block.park?'#3a4840':'#55574e','#767565',1);
        if(block.industrial){
          for(let n=0;n<8;n++){const strip=rect(ring,.64+n*.036,.78,.022,.09);poly(strip,n%3===0?'#7c685b':'#687276','#303c42',.8);}
          for(let n=0;n<9;n++){path([point(ring,.61+n*.036,.87),point(ring,.61+n*.036,.935)],false);ctx.strokeStyle='#c6bda082';ctx.lineWidth=1;ctx.stroke();}
        }else{
          path([point(ring,.61,.83),point(ring,.95,.83)],false);ctx.strokeStyle='#868170';ctx.lineWidth=scale*.012;ctx.stroke();
          for(let n=0;n<19;n++){const s=hash(block.id+':tree:'+n),p=project(point(ring,.63+(s%29)/100,.71+((s>>>8)%21)/100));ctx.beginPath();ctx.arc(p[0],p[1],scale*(.011+(s%4)*.002),0,Math.PI*2);ctx.fillStyle=n%2?'#52604a':'#465640';ctx.fill();ctx.strokeStyle='#283731';ctx.lineWidth=1;ctx.stroke();}
        }
      }
      // Crossings at junctions are visible in overhead view, with no territory
      // grid or ownership-colored roads. Lamps use a restrained static glow.
      [.365,.655].forEach(v=>{
        const p=project(point(ring,.5,v));ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));
        ctx.fillStyle='#c7c3a9';for(let n=-3;n<=3;n++){ctx.fillRect(n*2.4,scale*.035,1.2,scale*.015);ctx.fillRect(n*2.4,-scale*.05,1.2,scale*.015);}ctx.restore();
      });
      ctx.restore();
    }
    for(const roof of (options.groundOnly?[]:plan.roofs)){
      const p=roof.corners.map(project),[a,b,,d]=p,w=Math.hypot(b[0]-a[0],b[1]-a[1]),h=Math.hypot(d[0]-a[0],d[1]-a[1]);
      // Offset cast shadows, parapets and service machinery give each roof a
      // legible height and use without low-poly lawn parcels or heavy grading.
      const offset=1.5+roof.floors*.25;ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x+offset,y+offset):ctx.moveTo(x+offset,y+offset));ctx.closePath();ctx.fillStyle='#10181ca8';ctx.fill();
      poly(roof.corners,roof.color,'#242b2e',1.2);
      ctx.save();path(roof.corners);ctx.clip();ctx.translate(a[0],a[1]);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));
      ctx.strokeStyle='#afb2a675';ctx.lineWidth=1;ctx.strokeRect(2,2,w-4,h-4);
      ctx.strokeStyle='#2a32347a';ctx.lineWidth=.65;
      if(roof.kind==='sawtooth'){for(let x=4;x<w;x+=5){ctx.fillStyle='#bbc0b059';ctx.fillRect(x,2,2,h-4);ctx.beginPath();ctx.moveTo(x+2,2);ctx.lineTo(x+2,h-2);ctx.stroke();}}
      else if(roof.kind==='glass'){ctx.fillStyle='#63848d';ctx.fillRect(w*.18,h*.17,w*.62,h*.63);for(let x=w*.18;x<w*.8;x+=4){ctx.beginPath();ctx.moveTo(x,h*.17);ctx.lineTo(x,h*.8);ctx.stroke();}}
      else{
        ctx.fillStyle='#babbae';ctx.fillRect(w*.18,h*.2,Math.max(2,w*.2),Math.max(2,h*.2));ctx.fillStyle='#424c50';ctx.fillRect(w*.19,h*.22,Math.max(1,w*.16),Math.max(1,h*.12));
        ctx.fillStyle='#b5b2a291';ctx.fillRect(w*.57,h*.6,Math.max(2,w*.22),Math.max(1,h*.1));
        ctx.beginPath();ctx.moveTo(w*.47,2);ctx.lineTo(w*.47,h-2);ctx.stroke();
      }
      // Lit windows stay small; the map keeps its natural dark contrast.
      ctx.fillStyle='#deb479';for(let x=5;x<w-4;x+=6)if(((roof.seed+x)|0)%3===0)ctx.fillRect(x,h-1.2,2,1.2);
      ctx.restore();
    }
    for(const block of plan.blocks){
      const ring=block.rings[0];for(const v of [.17,.37,.53,.66,.83])for(const u of [.472,.528]){
        const p=project(point(ring,u,v)),g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],7);
        g.addColorStop(0,'#edc58a91');g.addColorStop(.25,'#dfa56430');g.addColorStop(1,'#d49d5100');ctx.fillStyle=g;ctx.fillRect(p[0]-7,p[1]-7,14,14);ctx.fillStyle='#d7c49b';ctx.fillRect(p[0]-.6,p[1]-.6,1.2,1.2);
      }
    }
    return {canvas,coordinates:[lngLat([minX,minY]),lngLat([maxX,minY]),lngLat([maxX,maxY]),lngLat([minX,maxY])],labels:{type:'FeatureCollection',features:plan.labels}};
  }
  function install(map,features){
    const plan=createPlan(features);if(!plan.bounds)return null;
    removePerspective(map);plans.set(map,plan);
    const canvas=document.createElement('canvas'),art=render(plan,canvas,{mobile:typeof innerWidth==='number'&&innerWidth<=760}),before='zone-ownership-fill';
    const existing=map.getSource('zone-city-atlas');
    // A geometry change replaces one GPU texture. Language changes only update
    // server district labels and do not redraw 5,000 roofs or grow allocations.
    if(existing){if(map.getLayer('zone-city-atlas'))map.removeLayer('zone-city-atlas');map.removeSource('zone-city-atlas');}
    map.addSource('zone-city-atlas',{type:'canvas',canvas:art.canvas,coordinates:art.coordinates,animate:false});
    map.addLayer({id:'zone-city-atlas',type:'raster',source:'zone-city-atlas',paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'linear'}},map.getLayer(before)?before:undefined);
    const labels=map.getSource('zone-city-districts');if(labels)labels.setData(art.labels);else map.addSource('zone-city-districts',{type:'geojson',data:art.labels});
    if(!map.getLayer('zone-city-district-labels'))map.addLayer({id:'zone-city-district-labels',type:'symbol',source:'zone-city-districts',maxzoom:15.5,layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],'text-size':['interpolate',['linear'],['zoom'],11,10,14,13,15.5,14],'text-letter-spacing':.12,'text-transform':'uppercase','text-max-width':16,'text-allow-overlap':false,'text-padding':18},paint:{'text-color':'#f0e5cb','text-halo-color':'#172125','text-halo-width':2,'text-opacity':.85}});
    return {blocks:plan.blocks.length,roofs:plan.roofs.length,pixels:canvas.width*canvas.height,source:'original-procedural-atlas',districts:plan.labels.length};
  }
  function preparePerspective(map){
    if(map.getSource('zone-city-ground-atlas'))return true;
    const plan=plans.get(map);if(!plan)return false;
    const mobile=typeof innerWidth==='number'&&innerWidth<=760;
    const canvas=document.createElement('canvas'),art=render(plan,canvas,{mobile,groundOnly:true,size:mobile?1536:2048});
    map.addSource('zone-city-ground-atlas',{type:'canvas',canvas:art.canvas,coordinates:art.coordinates,animate:false});
    map.addLayer({id:'zone-city-ground-atlas',type:'raster',source:'zone-city-ground-atlas',layout:{visibility:'none'},paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'linear'}},map.getLayer('zone-ownership-fill')?'zone-ownership-fill':undefined);
    return true;
  }
  function setPerspective(map,value){
    const prepared=!!map.getSource('zone-city-ground-atlas'),tilted=!!value&&prepared;
    if(map.getLayer('zone-city-atlas'))map.setLayoutProperty('zone-city-atlas','visibility',tilted?'none':'visible');
    if(map.getLayer('zone-city-ground-atlas'))map.setLayoutProperty('zone-city-ground-atlas','visibility',tilted?'visible':'none');
  }
  function removePerspective(map){if(map.getLayer('zone-city-ground-atlas'))map.removeLayer('zone-city-ground-atlas');if(map.getSource('zone-city-ground-atlas'))map.removeSource('zone-city-ground-atlas');}
  function remove(map){removePerspective(map);plans.delete(map);for(const id of ['zone-city-district-labels','zone-city-atlas'])if(map.getLayer(id))map.removeLayer(id);for(const id of ['zone-city-districts','zone-city-atlas'])if(map.getSource(id))map.removeSource(id);}
  function summarizePlan(plan){
    const blocks=Array.isArray(plan?.blocks)?plan.blocks:[],roofs=Array.isArray(plan?.roofs)?plan.roofs:[],labels=Array.isArray(plan?.labels)?plan.labels:[];
    return {
      blockCount:blocks.length,
      roofCount:roofs.length,
      districtCount:labels.length,
      industrialBlocks:blocks.filter(b=>b?.industrial).length,
      parkBlocks:blocks.filter(b=>b?.park).length,
      roofKinds:{
        flat:roofs.filter(r=>r?.kind==='flat').length,
        sawtooth:roofs.filter(r=>r?.kind==='sawtooth').length,
        glass:roofs.filter(r=>r?.kind==='glass').length
      }
    };
  }
  function atlasLimits(){
    return {size:SIZE,maxBlocks:MAX_BLOCKS,maxRoofs:MAX_ROOFS};
  }
  function roofPalette(){
    return ROOFS.slice();
  }
  return {createPlan,summarizePlan,atlasLimits,roofPalette,render,install,preparePerspective,setPerspective,remove,inside,SIZE};
});

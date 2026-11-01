/* Original aerial city artwork with a native local geometry fallback. Gameplay
 * stays in the server-authored block source. No remote basemap tiles, per-pan
 * model recreation or independent animation loop. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./atlas.js'),null);
  else root.ZoneNativeCity=factory(root.ZoneCityAtlas,typeof document==='object'?document.currentScript?.src:null);
})(typeof globalThis==='object'?globalThis:this,function(atlas,scriptUrl){
  'use strict';
  const entries=new WeakMap(),SOURCE='zone-city-atlas',ART_SOURCE='zone-city-original-art';
  const ART_REVISION='83';
  const ids=['zone-city-roads-case','zone-city-roads','zone-city-alleys','zone-city-road-marks','zone-city-yards','zone-city-roof-shadows','zone-city-roofs','zone-city-roof-parapets','zone-city-roof-details','zone-city-buildings-overview','zone-buildings-3d','zone-city-equipment-3d','zone-city-district-labels'];
  const roofColors=['#81898a','#939892','#727b80','#999183','#847b72','#a4a295','#707e84','#8d8275'];
  const empty=()=>({type:'FeatureCollection',features:[]});
  function point(ring,u,v){const[a,b,c,d]=ring;return [a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*u*v+d[0]*(1-u)*v,a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*u*v+d[1]*(1-u)*v];}
  function rect(ring,u,v,w,h){return [[u-w/2,v-h/2],[u+w/2,v-h/2],[u+w/2,v+h/2],[u-w/2,v+h/2]].map(([x,y])=>point(ring,x,y));}
  function closed(ring){return [...ring,ring[0].slice()];}
  function meters(a,b){const latitude=(a[1]+b[1])*Math.PI/360;return Math.hypot((a[0]-b[0])*Math.cos(latitude),a[1]-b[1])*111320;}
  function compile(plan){
    const features=[];
    function polygon(id,kind,ring,properties){features.push({type:'Feature',id,properties:{kind,...properties},geometry:{type:'Polygon',coordinates:[closed(ring)]}});}
    for(const block of plan.blocks){
      const ring=block.rings[0],span=Math.min(meters(ring[0],ring[1]),meters(ring[0],ring[3]));
      block.roads.forEach((road,i)=>features.push({type:'Feature',id:block.id+':road:'+i,properties:{kind:'road',alley:false,width:span*road.width},geometry:{type:'LineString',coordinates:road.points}}));
      // Detail alleys remain inside the original parcel, never ownership edges.
      [.145,.275,.5,.785,.875].forEach((v,i)=>[0,1].forEach(side=>features.push({type:'Feature',id:block.id+':alley:'+i+':'+side,properties:{kind:'road',alley:true,width:span*.010},geometry:{type:'LineString',coordinates:[point(ring,side?.525:.025,v),point(ring,side?.975:.475,v)]}})));
      if((block.park||block.industrial)&&block.rings.length===1)polygon(block.id+':yard','yard',rect(ring,.78,.82,.34,.26),{color:block.park?'#465449':'#6c7067'});
      // Overview masses represent groups of roofs. Close exploration retains
      // every original footprint; neither display layer changes territory.
      [.20,.79].forEach((u,column)=>[.18,.50,.83].forEach((v,row)=>{
        if((block.park||block.industrial)&&row===2&&column===1)return;
        const footprint=rect(ring,u,v,.28,.22);
        if(!footprint.every(p=>atlas.inside(p,block.rings)))return;
        polygon(block.id+':overview:'+column+':'+row,'overviewBuilding',footprint,{blockId:block.id,height:12+(block.seed+row*3+column)%12,color:roofColors[(block.seed+row+column)%roofColors.length]});
      }));
    }
    for(const roof of plan.roofs){
      const id=roof.blockId+':'+roof.seed,height=roof.floors*3.2,color=roofColors[roof.seed%roofColors.length];
      polygon(id,'building',roof.corners,{blockId:roof.blockId,height,color,kindRoof:roof.kind});
      const north=Math.max(...roof.corners.map(p=>Math.abs(p[1]))),dx=(height*.45)/(111320*Math.cos(north*Math.PI/180)),dy=-height*.35/111320;
      polygon(id+':shadow','shadow',roof.corners.map(p=>[p[0]+dx,p[1]+dy]),{});
      // Parapets, skylights and machinery preserve the reference's aerial detail.
      features.push({type:'Feature',id:id+':parapet',properties:{kind:'detail',color:'#b2b8ad',base:height,height:height+.6},geometry:{type:'Polygon',coordinates:[closed(rect(roof.corners,.5,.5,.95,.93)),closed(rect(roof.corners,.5,.5,.91,.87)).reverse()]}});
      polygon(id+':detail','detail',rect(roof.corners,.32,.34,.24,.20),{color:'#c1c2b8',base:height,height:height+1.8});
      polygon(id+':service','detail',rect(roof.corners,.70,.73,.18,.10),{color:'#48565d',base:height,height:height+1.2});
      if(roof.kind==='glass'||roof.kind==='sawtooth')for(let i=0;i<4;i++)polygon(id+':skylight:'+i,'detail',rect(roof.corners,.19+i*.20,.52,.075,.64),{color:roof.kind==='glass'?'#7d9fa5':'#b0bab4',base:height,height:height+.7});
    }
    return {data:{type:'FeatureCollection',features},labels:{type:'FeatureCollection',features:plan.labels},bounds:plan.bounds,stats:{blocks:plan.blocks.length,roofs:plan.roofs.length,overviewBuildings:features.filter(f=>f.properties.kind==='overviewBuilding').length,pixels:0,source:'native-city-geometry',districts:plan.labels.length,features:features.length}};
  }
  function addLayers(map){
    const before=map.getLayer('zone-ownership-fill')?'zone-ownership-fill':undefined;
    const roadWidth=['interpolate',['exponential',2],['zoom'],12,['*',['get','width'],.069],16,['*',['get','width'],1.104],20,['*',['get','width'],17.664]];
    const layers=[
      {id:'zone-city-roads-case',type:'line',minzoom:15.3,filter:['all',['==',['get','kind'],'road'],['==',['get','alley'],false]],paint:{'line-color':'#626a65','line-width':['interpolate',['exponential',2],['zoom'],12,['+',.4,['*',['get','width'],.069]],16,['+',1,['*',['get','width'],1.104]],20,['+',2,['*',['get','width'],17.664]]]}},
      {id:'zone-city-roads',type:'line',filter:['all',['==',['get','kind'],'road'],['==',['get','alley'],false]],paint:{'line-color':'#252c30','line-width':roadWidth}},
      {id:'zone-city-alleys',type:'line',minzoom:15.3,filter:['all',['==',['get','kind'],'road'],['==',['get','alley'],true]],paint:{'line-color':'#293135','line-width':roadWidth}},
      {id:'zone-city-road-marks',type:'line',minzoom:15.6,filter:['all',['==',['get','kind'],'road'],['==',['get','alley'],false],['>', ['get','width'],10]],paint:{'line-color':'#b9aa79','line-width':.65,'line-dasharray':[3,7],'line-opacity':.6}},
      {id:'zone-city-yards',type:'fill',filter:['==',['get','kind'],'yard'],paint:{'fill-color':['get','color'],'fill-opacity':1}},
      {id:'zone-city-roof-shadows',type:'fill',filter:['==',['get','kind'],'shadow'],paint:{'fill-color':'#0e1418','fill-opacity':['interpolate',['linear'],['zoom'],13,.08,15.3,.18,17,.4]}},
      // The same native extrusion shaders are used overhead and tilted. No
      // first-click shader swap, stretched roof image or alternate city layout.
    ];
    for(const layer of layers)if(!map.getLayer(layer.id))map.addLayer({...layer,source:SOURCE},before);
    ensureBuildings(map);
    if(!map.getLayer('zone-city-equipment-3d'))map.addLayer({id:'zone-city-equipment-3d',type:'fill-extrusion',source:SOURCE,minzoom:15.35,filter:['==',['get','kind'],'detail'],paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-opacity':1}},map.getLayer('zone-blocks-fill')?'zone-blocks-fill':undefined);
    if(!map.getLayer('zone-city-district-labels'))map.addLayer({id:'zone-city-district-labels',type:'symbol',source:'zone-city-districts',maxzoom:15.5,layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],'text-size':['interpolate',['linear'],['zoom'],12,11,15.5,14],'text-letter-spacing':.1,'text-transform':'uppercase','text-max-width':16,'text-allow-overlap':false,'text-padding':18},paint:{'text-color':'#f1eadc','text-halo-color':'#20292d','text-halo-width':2}});
  }
  function ensureBuildings(map){
    if(!map.getSource(SOURCE)||map.getLayer('zone-buildings-3d'))return;
    const paint={'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true,'fill-extrusion-ambient-occlusion-intensity':.35,'fill-extrusion-ambient-occlusion-radius':3};
    map.addLayer({id:'zone-city-buildings-overview',type:'fill-extrusion',source:SOURCE,maxzoom:15.3,filter:['==',['get','kind'],'overviewBuilding'],paint:{...paint}},map.getLayer('zone-blocks-fill')?'zone-blocks-fill':undefined);
    map.addLayer({id:'zone-buildings-3d',type:'fill-extrusion',source:SOURCE,minzoom:15.3,filter:['==',['get','kind'],'building'],paint:{...paint}},map.getLayer('zone-blocks-fill')?'zone-blocks-fill':undefined);
  }
  function tintColor(base,owner,amount){
    if(!/^#[0-9a-f]{6}$/i.test(owner||''))return base;
    const a=parseInt(base.slice(1),16),b=parseInt(owner.slice(1),16);
    return '#'+[16,8,0].map(shift=>Math.round(((a>>shift)&255)*(1-amount)+((b>>shift)&255)*amount).toString(16).padStart(2,'0')).join('');
  }
  function ownershipColors(features,focus,places){
    const groups=new Map();
    for(const feature of features||[]){const p=feature.properties||{};if(p.neutral||!p.ownerId||!/^#[0-9a-f]{6}$/i.test(p.renderColor||''))continue;
      const amount=places ? .10 : (focus&&focus!=='*'&&p.ownerId===focus ? .62 : .44),key=p.renderColor+':'+amount;
      if(!groups.has(key))groups.set(key,{color:p.renderColor,amount,ids:[]});groups.get(key).ids.push(String(feature.id));}
    if(!groups.size)return ['get','color'];
    const expression=['match',['get','blockId']];
    for(const group of groups.values()){const colors=['match',['get','color']];for(const base of roofColors)colors.push(base,tintColor(base,group.color,group.amount));colors.push(tintColor(roofColors[0],group.color,group.amount));expression.push(group.ids,colors);}
    expression.push(['get','color']);return expression;
  }
  function updateOwnership(map,features,focus,places){
    const entry=entries.get(map);if(!entry)return;
    const color=ownershipColors(features,focus,places),signature=JSON.stringify(color);if(entry.ownershipSignature===signature)return;
    for(const layer of ['zone-city-buildings-overview','zone-buildings-3d'])if(map.getLayer(layer))map.setPaintProperty(layer,'fill-extrusion-color',color);
    entry.ownershipSignature=signature;
  }
  function publish(map){
    const entry=entries.get(map);if(!entry||typeof document!=='object'||!document.body)return;
    document.body.dataset.zoneCityAtlas=JSON.stringify(entry.stats);
    document.body.dataset.zoneCityModels=JSON.stringify({status:entry.status,renderer:entry.artReady?'original-city-art':'native-city',buildings:entry.artReady?0:entry.stats.roofs,overviewBuildings:entry.artReady?0:entry.stats.overviewBuildings,detailLevel:entry.artReady?'aerial-city':map.getZoom&&map.getZoom()<15.3?'district':'individual-roofs',cityBlocks:entry.stats.blocks,view:map.getPitch()>1?(entry.artReady?'tilted-art':'3d'):'atlas',visible:entry.visible,worker:entry.workerUsed,pixels:entry.artReady?1122*1402:0});
    if(map.getStyle)document.body.dataset.zoneLayerCount=String((map.getStyle().layers||[]).filter(l=>l.id.startsWith('zone-')).length);
  }
  function setPerspective(map,value){
    const entry=entries.get(map);if(!entry)return;
    // The original aerial illustration is one continuous city surface. Its
    // visual streets never expose the rectangular engine interaction parcels.
    // Native roof geometry remains a bounded local fallback if art fails.
    if(entry.artReady&&!entry.artVisibilityApplied&&map.setLayoutProperty){
      for(const id of ids)if(id!=='zone-city-district-labels'&&map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
      entry.artVisibilityApplied=true;
    }
    publish(map);
  }
  function installArtwork(map,bounds,entry){
    if(!scriptUrl||!bounds||!map.setLayoutProperty)return;
    const [x0,y0,x1,y1]=bounds;
    const toLngLat=([x,y])=>[x*360,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];
    const coordinates=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(toLngLat);
    if(typeof document==='object'&&document.body)document.body.dataset.zoneCityArtBounds=JSON.stringify(coordinates);
    map.addSource(ART_SOURCE,{type:'image',url:new URL('./zone-harbor-city-v83.webp',scriptUrl).href,coordinates});
    map.addLayer({id:ART_SOURCE,type:'raster',source:ART_SOURCE,paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'linear'}},map.getLayer('zone-ownership-fill')?'zone-ownership-fill':undefined);
    entry.artPromise=new Promise(resolve=>{
      const cleanup=()=>{clearTimeout(timer);map.off('sourcedata',loaded);entry.cancelArt=null;};
      const loaded=e=>{if(e.sourceId!==ART_SOURCE||!map.isSourceLoaded(ART_SOURCE))return;entry.artReady=true;entry.stats.artwork='original-harbor-city-v83';entry.stats.artRevision=ART_REVISION;entry.stats.pixels=1122*1402;setPerspective(map,map.getPitch()>1);cleanup();resolve();};
      const timer=setTimeout(()=>{cleanup();entry.stats.artwork='native-fallback';publish(map);resolve();},10000);
      map.on('sourcedata',loaded);entry.cancelArt=()=>{cleanup();resolve();};
      loaded({sourceId:ART_SOURCE});
    });
  }
  function waitForPaint(map,entry){
    if(!map.triggerRepaint)return Promise.resolve();
    if(entry.paintReady)return entry.paintReady;
    entry.paintReady=new Promise((resolve,reject)=>{
      const listener=()=>{cleanup();resolve();};
      const cleanup=()=>{map.off('render',listener);clearTimeout(timer);entry.cancelPaintReady=null;entry.cancelPaint=null;entry.paintReady=null;};
      const timer=setTimeout(()=>{cleanup();reject(new Error('City geometry could not be drawn'));},15000);
      entry.cancelPaintReady=()=>{cleanup();reject(new Error('City geometry replaced'));};entry.cancelPaint=()=>{cleanup();resolve();};map.on('render',listener);map.triggerRepaint();
    });
    return entry.paintReady;
  }
  function waitForSource(map,entry){
    if(!map.isSourceLoaded||map.isSourceLoaded(SOURCE))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const listener=e=>{if(e.sourceId===SOURCE&&map.isSourceLoaded(SOURCE)){cleanup();resolve();}};
      let timer=null;
      const cleanup=()=>{map.off('sourcedata',listener);clearTimeout(timer);entry.cancelSource=null;entry.sourceVisibility=null;};
      entry.sourceVisibility=()=>{clearTimeout(timer);timer=null;if(map.isSourceLoaded(SOURCE)){cleanup();resolve();return;}if(entry.visible)timer=setTimeout(()=>{cleanup();reject(new Error('City geometry did not become ready'));},15000);};
      entry.cancelSource=()=>{cleanup();reject(new Error('City geometry replaced'));};map.on('sourcedata',listener);entry.sourceVisibility();
      // Source data can complete between the first check and listener installation.
      if(map.isSourceLoaded(SOURCE)){cleanup();resolve();}
    });
  }
  function build(features,entry){
    if(typeof Worker==='function'&&scriptUrl){
      return new Promise((resolve,reject)=>{
        let worker;
        try{worker=new Worker(new URL('./native-city-worker.js?v=84',scriptUrl));}catch(_){resolve(compile(atlas.createPlan(features)));return;}
        entry.worker=worker;entry.workerUsed=true;
        worker.onmessage=e=>{worker.terminate();entry.worker=null;e.data.error?reject(new Error(e.data.error)):resolve(e.data);};
        worker.onerror=e=>{worker.terminate();entry.worker=null;reject(new Error(e.message||'City geometry worker failed'));};
        entry.cancelBuild=()=>{worker.terminate();entry.worker=null;reject(new Error('City geometry replaced'));};worker.postMessage({features});
      });
    }
    return Promise.resolve().then(()=>compile(atlas.createPlan(features)));
  }
  function install(map,features){
    remove(map);
    const entry={stats:{blocks:features.length,roofs:0,pixels:0,source:'native-city-geometry',districts:0},status:'loading',visible:true,workerUsed:false};entries.set(map,entry);
    if(typeof document==='object'&&document.body)delete document.body.dataset.zoneCityModelsError;
    map.addSource(SOURCE,{type:'geojson',data:empty(),maxzoom:17,tolerance:.1,buffer:64});
    map.addSource('zone-city-districts',{type:'geojson',data:empty()});addLayers(map);publish(map);
    entry.ready=build(features,entry).then(result=>{
      if(entries.get(map)!==entry)return;entry.stats=result.stats;map.getSource(SOURCE).setData(result.data);map.getSource('zone-city-districts').setData(result.labels);installArtwork(map,result.bounds,entry);setPerspective(map,map.getPitch()>1);publish(map);return entry.artPromise;
    }).then(()=>{
      // Mapbox can stop preparing sources whose display layers are hidden.
      // Loaded artwork is the visible city; only a failed image needs the
      // native fallback source to finish before controls can prepare a paint.
      if(entries.get(map)===entry&&!entry.artReady)return waitForSource(map,entry);
    }).then(()=>{if(entries.get(map)!==entry)return;entry.status='ready';publish(map);}).catch(error=>{
      if(entries.get(map)!==entry)return;entry.status='error';publish(map);if(typeof document==='object'&&document.body)document.body.dataset.zoneCityModelsError=error.message;throw error;
    });entry.ready.catch(()=>{});return entry.stats;
  }
  function updateLabels(map,features){
    const groups=new Map();for(const f of features){const p=f.properties||{},ring=f.geometry?.coordinates?.[0];if(!p.districtId||!p.districtName||!ring?.length)continue;
      if(!groups.has(p.districtId))groups.set(p.districtId,{name:p.districtName,points:[]});groups.get(p.districtId).points.push(point(ring,.5,.5));}
    const labels=[...groups].map(([id,d])=>({type:'Feature',properties:{id,name:d.name},geometry:{type:'Point',coordinates:d.points.reduce((sum,p)=>[sum[0]+p[0]/d.points.length,sum[1]+p[1]/d.points.length],[0,0])}}));
    map.getSource('zone-city-districts')?.setData({type:'FeatureCollection',features:labels});
  }
  function controller(map){return {whenReady(){const entry=entries.get(map);if(!entry)return Promise.reject(new Error('City is loading'));return entry.ready.then(()=>{if(entries.get(map)===entry&&entry.visible)return waitForPaint(map,entry);});},diagnostics(){const entry=entries.get(map);return {status:entry?.status??'uninstalled',visible:Boolean(entry?.visible),artReady:Boolean(entry?.artReady),workerUsed:Boolean(entry?.workerUsed),stats:entry?.stats?{...entry.stats}:null};},setTerritories(){},setVisible(value){const entry=entries.get(map);if(entry){entry.visible=!!value;entry.sourceVisibility?.();if(!value){entry.cancelPaint?.();map.stop?.();}publish(map);}},dispose:()=>remove(map)};}
  function remove(map){
    const entry=entries.get(map);entries.delete(map);entry?.cancelBuild?.();entry?.cancelSource?.();entry?.cancelPaintReady?.();entry?.cancelArt?.();
    if(map.getLayer(ART_SOURCE))map.removeLayer(ART_SOURCE);if(map.getSource(ART_SOURCE))map.removeSource(ART_SOURCE);
    for(const id of ids.slice().reverse())if(map.getLayer(id))map.removeLayer(id);
    for(const id of ['zone-city-districts',SOURCE])if(map.getSource(id))map.removeSource(id);
  }
  function summarizeCompiled(compiled){
    const features=Array.isArray(compiled?.data?.features)?compiled.data.features:[],labels=Array.isArray(compiled?.labels?.features)?compiled.labels.features:[],stats=compiled?.stats||{};
    return {featureCount:features.length,buildingCount:features.filter(f=>f?.properties?.kind==='building').length,detailCount:features.filter(f=>f?.properties?.kind==='detail').length,overviewBuildingCount:features.filter(f=>f?.properties?.kind==='overviewBuilding').length,labelCount:labels.length,roofCount:Number(stats.roofs||0),blockCount:Number(stats.blocks||0),districtCount:Number(stats.districts||0)};
  }
  function layerIds(){
    return ids.slice();
  }
  function roofPalette(){
    return roofColors.slice();
  }
  return {compile,summarizeCompiled,layerIds,roofPalette,install,ensureBuildings,setPerspective,updateLabels,ownershipColors,updateOwnership,controller,remove};
});

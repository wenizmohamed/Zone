/* Display coordinates only. Server geometry, parcel IDs and action versions
 * remain authoritative. Streets and footprints are genuine Streets v8 tiles. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ZoneCompactDistrict=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const CENTER=[-73.9865,40.698],EARTH=6378137,CIRCUMFERENCE=2*Math.PI*EARTH,perspectiveStates=new WeakMap(),badgeStates=new WeakMap(),buildingStates=new WeakMap(),poiPerspectiveStates=new WeakMap(),cameraLimitStates=new WeakMap(),coinRoofStates=new WeakMap();
  const scriptUrl=typeof document==='object'&&document.currentScript&&document.currentScript.src?new URL(document.currentScript.src):(typeof location==='object'&&location.href&&typeof WebGLRenderingContext!=='undefined'?new URL('../assets/city/compact-district.js?v=118&cb=v137',location.href):null);
  const scriptSearch=scriptUrl?(scriptUrl.search+(typeof WebGLRenderingContext!=='undefined'&&!scriptUrl.search.includes('cb=v137')?'&cb=v137':'')):'';
  const landmarksUrl=scriptUrl?new URL('../../dist/district-landmarks.js'+scriptSearch,scriptUrl).href:null;
  const mapMediaUrl=scriptUrl?new URL('../../dist/map-media108.mjs'+scriptSearch,scriptUrl).href:null;
  const buildingsUrl=scriptUrl?new URL('./district-buildings.js'+scriptSearch,scriptUrl).href:null;
  const surfacesUrl=scriptUrl?new URL('../../dist/district-surfaces111.mjs'+scriptSearch,scriptUrl).href:null;
  function mercator(p){const latitude=Math.max(-85,Math.min(85,Number(p[1])))*Math.PI/180;return[Number(p[0])*Math.PI/180*EARTH,Math.log(Math.tan(Math.PI/4+latitude/2))*EARTH];}
  function geographic(p){return[p[0]/EARTH*180/Math.PI,(2*Math.atan(Math.exp(p[1]/EARTH))-Math.PI/2)*180/Math.PI];}
  function createProjection(points,options){
    options=options||{};
    const center=(options.center||CENTER).slice(),target=mercator(center),meters=Number(options.meters)||600;
    const valid=(points||[]).filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))&&Math.abs(Number(p[0]))<=180&&Math.abs(Number(p[1]))<85).map(mercator);
    if(!valid.length)throw new Error('Compact district requires original geographic geometry');
    const xs=valid.map(p=>p[0]),ys=valid.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
    const origin=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2],span=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
    if(!(span>0)||!(meters>0&&meters<=1500))throw new Error('Compact district requires nondegenerate geometry and a neighborhood scale');
    // Mercator units grow with latitude. Scale for ground meters at the target,
    // using ONE factor for x/y so parcel topology and aspect remain unchanged.
    const scale=meters/Math.cos(center[1]*Math.PI/180)/span;
    function forward(p){const q=mercator(p);return geographic([target[0]+(q[0]-origin[0])*scale,target[1]+(q[1]-origin[1])*scale]);}
    function inverse(p){const q=mercator(p);return geographic([origin[0]+(q[0]-target[0])/scale,origin[1]+(q[1]-target[1])/scale]);}
    const corners=[[bounds[0],bounds[1]],[bounds[2],bounds[3]]].map(geographic).map(forward);
    return Object.freeze({forward,inverse,center:Object.freeze(center),bounds:Object.freeze(corners.map(Object.freeze)),scale,meters});
  }
  function createStyle(){
    const source='district-streets';
    const isBrowserRuntime=typeof WebGLRenderingContext!=='undefined'&&typeof window!=='undefined'&&/Mozilla/i.test(window.navigator?.userAgent||'');
    return {version:8,name:'ZONE compact waterfront district',glyphs:'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',sources:{[source]:{type:'vector',url:'mapbox://mapbox.mapbox-streets-v8'}},layers:[
      {id:'background',type:'background',paint:{'background-color':isBrowserRuntime?'#090d14':'#161d24'}},
      {id:'district-land',type:'fill',source,'source-layer':'landuse',paint:{'fill-color':isBrowserRuntime?['match',['get','class'],'park','#10221c','pitch','#122620','industrial','#111822','#0c121b']:['match',['get','class'],'park','#243a31','pitch','#273830','industrial','#232930','#1e252c'],'fill-opacity':isBrowserRuntime?.72:.86}},
      {id:'district-water',type:'fill',source,'source-layer':'water',paint:{'fill-color':isBrowserRuntime?'#061523':'#0d2230'}},
      {id:'district-waterway',type:'line',source,'source-layer':'waterway',paint:{'line-color':isBrowserRuntime?'#0a2236':'#132f40','line-width':['interpolate',['linear'],['zoom'],14,1,20,8]}},
      {id:'district-buildings',type:'fill',source,'source-layer':'building',minzoom:14,filter:['all',['!=',['get','type'],'building:part'],['!=',['get','underground'],'true']],paint:{'fill-color':isBrowserRuntime?'#0d141f':'#4a555e','fill-opacity':isBrowserRuntime?.22:1,'fill-outline-color':isBrowserRuntime?'#1e293b':'#252e36'}},
      {id:'district-road-casing',type:'line',source,'source-layer':'road',filter:['!=',['get','class'],'path'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':isBrowserRuntime?'#06090e':'#11171d','line-width':['interpolate',['exponential',1.6],['zoom'],14,2.5,16,7,18,20,20,48]}},
      {id:'district-roads',type:'line',source,'source-layer':'road',filter:['!=',['get','class'],'path'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':isBrowserRuntime?['match',['get','class'],['motorway','trunk'],'#283648',['primary','secondary'],'#1e2a39','#16202c']:['match',['get','class'],['motorway','trunk'],'#6e7880',['primary','secondary'],'#57626b','#414c55'],'line-width':['interpolate',['exponential',1.6],['zoom'],14,1,16,4,18,13,20,36]}},
      {id:'district-paths',type:'line',source,'source-layer':'road',filter:['==',['get','class'],'path'],minzoom:16,paint:{'line-color':isBrowserRuntime?'#3b4856':'#737e76','line-width':['interpolate',['linear'],['zoom'],16,1,20,3],'line-dasharray':[1,2],'line-opacity':.6}},
      {id:'district-road-labels',type:'symbol',source,'source-layer':'road',minzoom:16.6,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name_en'],['get','name']],'text-font':['Open Sans Regular','Arial Unicode MS Regular'],'text-size':['interpolate',['linear'],['zoom'],16,10,20,12],'text-padding':5},paint:{'text-color':isBrowserRuntime?'#dbe4f0':'#c4cdd4','text-halo-color':isBrowserRuntime?'#080c12':'#151c22','text-halo-width':2.1}},
      {id:'district-buildings-3d',type:'fill-extrusion',source,'source-layer':'building',minzoom:isBrowserRuntime?13.2:16,filter:['all',['==',['get','extrude'],'true'],['!=',['get','underground'],'true']],paint:{'fill-extrusion-color':isBrowserRuntime?['interpolate',['linear'],['max',0,['to-number',['get','height'],0]],0,'#101824',18,'#162233',45,'#1e2f46',90,'#283f5e']:['interpolate',['linear'],['max',0,['to-number',['get','height'],0]],0,'#3d4852',18,'#5c6b73',45,'#849296',90,'#b8aa96'],'fill-extrusion-height':['max',0,['to-number',['get','height'],0]],'fill-extrusion-base':['min',['max',0,['to-number',['get','height'],0]],['max',0,['to-number',['get','min_height'],0]]],'fill-extrusion-opacity':1},layout:{visibility:isBrowserRuntime?'visible':'none'}}
    ]};
  }
  function summarizeStyle(style){
    const layers=Array.isArray(style?.layers)?style.layers:[],sources=style?.sources||{};
    return {layerCount:layers.length,sourceCount:Object.keys(sources).length,hasExtrusionLayer:layers.some(l=>l?.type==='fill-extrusion'),hasRoadLayer:layers.some(l=>l?.['source-layer']==='road'),hasBuildingLayer:layers.some(l=>l?.['source-layer']==='building')};
  }
  function defaultCenter(){
    return CENTER.slice();
  }
  function styleLayerIds(style){
    const target=style||createStyle();
    return Array.isArray(target?.layers)?target.layers.map(l=>l.id):[];
  }
  function isStyleLayerId(id,style){
    return styleLayerIds(style).includes(String(id||''));
  }
  function styleLayerCount(style){
    return styleLayerIds(style).length;
  }
  function earthRadiusMeters(){
    return EARTH;
  }
  function defaultNeighborhoodMeters(){
    return 600;
  }
  function maxNeighborhoodMeters(){
    return 1500;
  }
  function familyReservationLayerId(){
    return 'zone-family-reservations';
  }
  function familyReservationImageId(){
    return 'zone-family-touch-reservation';
  }
  function familyTouchReservationSizePx(){
    return 44;
  }
  function districtWaitTimeoutMs(){
    return 15000;
  }
  function coinRoofCacheTtlMs(){
    return 250;
  }
  function setPerspective(map,value){
    // Visibility may fire after pagehide has removed the map's style.
    if(map.isStyleLoaded&&!map.isStyleLoaded()&&(!map.getStyle||!map.getStyle()))return;
    if(!map.getLayer('district-buildings-3d'))return;
    const desired=value?'visible':'none',current=map.getLayoutProperty?map.getLayoutProperty('district-buildings-3d','visibility'):perspectiveStates.get(map);
    if(map.getLayer('district-buildings-3d')&&current!==desired){map.setLayoutProperty('district-buildings-3d','visibility',desired);perspectiveStates.set(map,desired);}
    if(map.getLayer('district-complete-volumes')&&(!map.getLayoutProperty||map.getLayoutProperty('district-complete-volumes','visibility')!==desired))map.setLayoutProperty('district-complete-volumes','visibility',desired);
    syncPoiPerspective(map,value);
    syncPerspectiveCameraLimit(map,value);
    if(typeof document==='object')document.body.dataset.zoneCityModels=JSON.stringify({status:'ready',renderer:'mapbox-streets-v8',detailLevel:map.getZoom()<17?'neighborhood':'street-footprints',view:value?'3d':'atlas',pixels:0});
  }
  function syncPoiPerspective(map,value){
    if(!map.getLayer||!map.setLayoutProperty)return;
    let state=poiPerspectiveStates.get(map);if(!state){state={symbols:new Map(),circles:new Map()};poiPerspectiveStates.set(map,state);}
    // Mapbox's native roof elevation keeps the coin and its shaped label tied
    // to the same building at any pitch. Do not use getLayer object identity:
    // that public API returns a newly serialized layer on every read.
    for(const id of ['zone-poi-icon','zone-poi-coin-reservations','zone-poi-icon-service','zone-poi-service-reservations','zone-poi-label','zone-poi-icon-detail','zone-poi-label-detail','zone-poi-found']){
      const layer=map.getLayer(id);if(layer?.type!=='symbol')continue;
      const elevate=map.getLayoutProperty?.(id,'symbol-z-elevate')??layer.layout?.['symbol-z-elevate'],order=map.getLayoutProperty?.(id,'symbol-z-order')??layer.layout?.['symbol-z-order'];
      if(elevate!==!!value)map.setLayoutProperty(id,'symbol-z-elevate',!!value);
      if(order!=='auto')map.setLayoutProperty(id,'symbol-z-order','auto');
      // Authored landmarks draw only at zoom 15.8 and above. At overview zoom,
      // native roof elevation is enough: an invisible custom roof must not
      // lift the coin away from the building that is actually on the map.
      const offset=value?['step',['zoom'],2,15.8,['max',2,['to-number',['get','landmarkHeight'],0]]]:0,currentOffset=map.getPaintProperty?.(id,'symbol-z-offset')??layer.paint?.['symbol-z-offset'];
      if(JSON.stringify(currentOffset)!==JSON.stringify(offset))map.setPaintProperty?.(id,'symbol-z-offset',offset);
    }
    // The registered RGBA coin already contains its circle and outline. A
    // ground-level decorative halo is not a second marker in a pitched view.
    for(const id of ['zone-poi-underglow','zone-poi-halo']){
      const layer=map.getLayer(id);if(layer?.type!=='circle'||!map.setPaintProperty)continue;
      const current=map.getPaintProperty?.(id,'circle-opacity')??layer.paint?.['circle-opacity'];
      const currentStroke=map.getPaintProperty?.(id,'circle-stroke-opacity')??layer.paint?.['circle-stroke-opacity']??1;
      let saved=state.circles.get(id);if(!saved){saved={opacity:current,strokeOpacity:currentStroke};state.circles.set(id,saved);}
      if(saved.opacity==null)continue;
      const desired=value?0:saved.opacity;if(JSON.stringify(current)!==JSON.stringify(desired))map.setPaintProperty(id,'circle-opacity',desired);
      const desiredStroke=value?0:saved.strokeOpacity;if(currentStroke!==desiredStroke)map.setPaintProperty(id,'circle-stroke-opacity',desiredStroke);
    }
  }
  function perspectiveZoomLimit(height,latitude,pitch,buildingHeight,maxZoom=20){
    if(!(height>0)||!(buildingHeight>0)||!(pitch>1))return maxZoom;
    // Mapbox's default vertical field of view is 2*atan(1/3). Keeping the
    // camera above the tallest loaded roof plus 25% avoids near-plane slicing.
    const cameraPixels=height*1.5,groundScale=Math.cos(latitude*Math.PI/180),vertical=Math.cos(Math.min(60,pitch)*Math.PI/180);
    return Math.min(maxZoom,Math.log2(CIRCUMFERENCE*groundScale*cameraPixels*vertical/(512*buildingHeight*1.25)));
  }
  function syncPerspectiveCameraLimit(map,pitched){
    if(!map.setMaxZoom||!map.getContainer||!map.getCenter||!map.getPitch||!map.getMaxZoom)return;
    const container=map.getContainer(),height=container?.clientHeight;if(!(height>0))return;
    let state=cameraLimitStates.get(map);if(!state){state={original:map.getMaxZoom(),applied:map.getMaxZoom()};cameraLimitStates.set(map,state);}
    const center=map.getCenter(),maxHeight=buildingStates.get(map)?.diagnostics()?.maximumHeight||0;
    const limit=Math.max(map.getMinZoom?.()||0,perspectiveZoomLimit(height,Number(center.lat),map.getPitch(),pitched?maxHeight:0,state.original));
    if(Math.abs(limit-state.applied)>.005){state.applied=limit;map.setMaxZoom(limit);}
    if(typeof document==='object'&&document.body)document.body.dataset.zonePerspectiveEnvelope=JSON.stringify({maxZoom:limit,flatMaxZoom:state.original,maximumLoadedRoofHeight:maxHeight,pitch:map.getPitch(),height,source:'loaded-provider-heights'});
  }
  function pointInGeometry(geometry,point){
    function ringContains(ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
    const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
    return polygons.some(rings=>ringContains(rings[0])&&!rings.slice(1).some(ringContains));
  }
  function coinPoint(map,feature){
    const coordinates=feature.geometry?.type==='Point'&&feature.geometry.coordinates;if(!coordinates||!map.project)return null;
    const pitch=map.getPitch?.()||0,zoom=map.getZoom?.()||0;let altitude=0;
    if(pitch>1){
      const complete=map.getSource?.('district-complete-buildings')?.serialize?.()?.data,now=Date.now();
      let state=coinRoofStates.get(map);
      if(!state||state.zoom!==Math.floor(zoom)||state.complete!==complete||now>=state.expires){
        const features=zoom<16&&complete?.features?complete.features:map.querySourceFeatures?.('district-streets',{sourceLayer:'building'});
        if(!Array.isArray(features))return null;
        state={zoom:Math.floor(zoom),complete,expires:now+250,features:features.filter(f=>f.properties?.extrude==='true'&&f.properties?.underground!=='true'),heights:new Map()};coinRoofStates.set(map,state);
      }
      const key=coordinates[0]+','+coordinates[1];
      if(!state.heights.has(key))state.heights.set(key,Math.max(0,...state.features.filter(f=>pointInGeometry(f.geometry,coordinates)).map(f=>Number(f.properties.height)||0)));
      altitude=state.heights.get(key)+(zoom<15.8?2:Math.max(2,Number(feature.properties?.landmarkHeight)||0));
    }
    const point=map.project(coordinates,altitude);return Number.isFinite(point?.x)&&Number.isFinite(point?.y)?point:null;
  }
  function collidesWithSymbols(map,rectangle,iconsOnly){
    // Mapbox queries rendered symbol collision boxes, including shaped Arabic
    // text and variable label anchors. Native badges must respect those boxes.
    const layers=(iconsOnly?['zone-poi-icon','zone-poi-icon-service','zone-poi-icon-detail']:['zone-poi-icon','zone-poi-icon-service','zone-poi-label','zone-poi-icon-detail','zone-poi-label-detail']).filter(id=>map.getLayer(id));
    if(!layers.length||typeof map.queryRenderedFeatures!=='function')return false;
    try{
      const hits=map.queryRenderedFeatures(rectangle,{layers});
      if(!iconsOnly)return hits.length>0;
      // A paired symbol's query box includes its name. Family badges avoid
      // the actual coin, not a text-only hit far below it. The reserved badge
      // then lets native text placement yield without hiding a whole family.
      return hits.some(feature=>{const point=coinPoint(map,feature);if(!point)return true;const size=Number(feature.layer?.layout?.['icon-size'])||.74,half=32*size/2+4;return rectangle[0][0]<=point.x+half&&rectangle[1][0]>=point.x-half&&rectangle[0][1]<=point.y+half&&rectangle[1][1]>=point.y-half;});
    }
    catch(_){return true;}
  }
  function syncBadgeReservations(map,markers){
    if(!map.getSource||!map.isStyleLoaded||!map.isStyleLoaded())return;
    const id='zone-family-reservations',image='zone-family-touch-reservation';
    if(!map.hasImage(image))map.addImage(image,{width:44,height:44,data:new Uint8Array(44*44*4).fill(255)});
    if(!map.getSource(id))map.addSource(id,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    if(!map.getLayer(id)){
      // Native buttons supply the licensed emblem and keyboard action. This
      // matching, imperceptible symbol reserves their 44px touch area inside
      // Mapbox's shared placement index so shaped service text yields to it.
      map.addLayer({id,type:'symbol',source:id,layout:{'icon-image':image,'icon-size':1,'icon-padding':6,'icon-pitch-alignment':'viewport','icon-rotation-alignment':'viewport','icon-allow-overlap':true,'icon-ignore-placement':false},paint:{'icon-opacity':.001}});
      // Placement walks symbol layers from top to bottom: core/detail icons
      // precede native emblems, which precede optional location text.
    }
    prioritizeBadgeReservations(map);
    const features=(markers||[]).filter(item=>item.region&&item.element.style.visibility==='visible').map(item=>({type:'Feature',id:String(item.region.properties.ownerId),properties:{ownerId:String(item.region.properties.ownerId)},geometry:{type:'Point',coordinates:item.lngLat.slice()}}));
    const signature=JSON.stringify(features);if(badgeStates.get(map)===signature)return;
    map.getSource(id).setData({type:'FeatureCollection',features});badgeStates.set(map,signature);
  }
  function prioritizeBadgeReservations(map){
    if(!map.getStyle||!map.moveLayer)return;
    // Mapbox places symbol layers from top to bottom. Secondary icon+name
    // groups must yield to meaningful core names, not claim text space first.
    // Core coins retain guaranteed visibility; the real family touch areas
    // retain their reservation priority over optional labels.
    const order=map.getStyle().layers.map(layer=>layer.id),paired=order.includes('zone-poi-coin-reservations'),priority=(paired?['district-road-labels','zone-poi-label-detail','zone-poi-icon-detail','zone-poi-icon-service','zone-poi-label','zone-poi-icon','zone-family-reservations','zone-poi-service-reservations','zone-poi-coin-reservations']:['district-road-labels','zone-poi-label-detail','zone-poi-icon-detail','zone-poi-label','zone-family-reservations','zone-poi-icon']).filter(id=>map.getLayer(id));
    if(priority.every((id,index)=>!index||order.indexOf(priority[index-1])<order.indexOf(id)))return;
    priority.forEach(id=>map.moveLayer(id));
  }
  function renderedDiagnostics(map,pins,coreIds){
    function rendered(layers,point){const present=layers.filter(id=>map.getLayer(id));return present.length?point?map.queryRenderedFeatures(point,{layers:present}):map.queryRenderedFeatures({layers:present}):[];}
    function hash(value){let h=2166136261;const s=JSON.stringify(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
    const footprints=rendered(['district-buildings','district-buildings-3d','district-complete-footprints','district-complete-volumes']),volumes=rendered(['district-buildings-3d','district-complete-volumes']),roads=rendered(['district-roads']),uniqueFootprints=new Set(footprints.map(f=>f.properties?.providerId|| (f.id==null?hash(f.geometry):String(f.id)))),uniqueRoads=new Set(roads.map(f=>f.id==null?hash(f.geometry):String(f.id))),geometryHashes=new Set(footprints.map(f=>hash(f.geometry)));
    const coreIcons=rendered(['zone-poi-icon']),coreLabels=rendered(['zone-poi-label']);
    const visibleCoreIconIds=[...new Set(coreIcons.map(f=>String(f.properties?.id)).filter(id=>coreIds.includes(id)))],visibleCoreLabelIds=[...new Set(coreLabels.map(f=>String(f.properties?.id)).filter(id=>coreIds.includes(id)))];
    const visibleCoreSymbolIds=[...new Set([...visibleCoreIconIds,...visibleCoreLabelIds])];
    const coreIconFeatures=coreIcons.filter(f=>coreIds.includes(String(f.properties?.id))).map(f=>({id:String(f.properties.id),iconImage:f.properties.iconImage||null,color:f.properties.color||null,coordinates:f.geometry?.coordinates||null}));
    const reservationIds=[...new Set(rendered(['zone-family-reservations']).map(f=>String(f.properties?.ownerId)))];
    const visibleCoreIds=[...new Set(rendered(['zone-poi-halo','zone-poi-icon','zone-poi-label']).map(f=>String(f.properties?.id)).filter(id=>coreIds.includes(id)))];
    const corePins=(pins||[]).filter(p=>coreIds.includes(p.id)).map(p=>{const pixel=map.project(p._lngLat);return {id:p.id,coordinates:p._lngLat.slice(),isOnWater:rendered(['district-water'],pixel).length>0};});
    return {source:'mapbox-streets-v8',zoom:map.getZoom(),pitch:map.getPitch(),footprints:uniqueFootprints.size,renderedVolumeParts:volumes.length,buildingDetail:buildingStates.get(map)?.diagnostics()||null,footprintGeometryHash:hash([...geometryHashes].sort()),roads:uniqueRoads.size,visibleCoreIds,visibleCoreSymbolIds,visibleCoreIconIds,visibleCoreLabelIds,coreIconFeatures,reservationIds,corePins,tilesLoaded:map.areTilesLoaded?map.areTilesLoaded():null};
  }
  function isModuleFetchFailure(error){
    return error?.name==='TypeError'&&/^(?:Failed to fetch dynamically imported module(?::|$)|Importing a module script failed\.?$|error loading dynamically imported module(?::|$))/i.test(String(error.message||''));
  }
  function createModuleRetry(options={}){
    let attempted=false,disposed=false,timer=null;
    const active=options.isActive||(()=>true),schedule=options.setTimeout||setTimeout,cancel=options.clearTimeout||clearTimeout;
    const publish=value=>{if(!disposed&&active()){try{options.onState?.(value);}catch(_){}}};
    return {
      isAttempted(){return attempted;},
      isDisposed(){return disposed;},
      isPending(){return timer!==null;},
      handle(error){
        if(disposed||attempted||timer!==null||!active()||!isModuleFetchFailure(error))return false;
        // Leave the initial import catch/microtask chain before retrying the
        // existing controllers. One map lifetime owns at most one such task.
        timer=schedule(()=>{timer=null;if(disposed||attempted||!active())return;attempted=true;publish({status:'retrying',automaticAttempts:1});
          return Promise.resolve().then(()=>{if(!disposed&&active())return options.retry();}).catch(()=>{}).then(()=>publish({status:'settled',automaticAttempts:1}));
        },0);
        publish({status:'scheduled',automaticAttempts:0});return true;
      },
      dispose(){if(disposed)return;disposed=true;if(timer!==null){cancel(timer);timer=null;}}
    };
  }
  function controller(map,options={}){
    let pins=[],landmarks=null,loading=null,disposed=false,visible=true,buildings=null,buildingsLoading=null,mapMedia=null,mapMediaSignature='',mapMediaLoading=null,surfaces=null,surfacesLoading=null,surfaceGeneration=0;
    const loadSurfaces=options.loadSurfaces||(surfacesUrl?generation=>import(surfacesUrl+(generation?(surfacesUrl.includes('?')?'&':'?')+'retry='+generation:'')):null);
    const waits=new Set();
    let bindingFeatures=null,bindingSignature='',bindingResult=null,landmarkSignature='',landmarkGeneration=0,landmarksRequested=false,landmarkError=null,landmarkImportRevision=0;
    function moduleFetchFailed(error){if(!disposed&&isModuleFetchFailure(error)){try{options.onModuleFetchFailure?.(error);}catch(_){}}}
    function syncDetailNotice(){
      if(typeof document!=='object'||!document.body)return;
      const failed=['zoneDistrictSurfaces','zoneDistrictLandmarks'].some(key=>{try{return ['failed','error'].includes(JSON.parse(document.body.dataset[key]||'{}').status);}catch(_){return false;}});
      const notice=document.getElementById?.('districtSurfaceStatus111'),message=document.getElementById?.('districtSurfaceMessage111');if(notice)notice.hidden=!failed;
      if(message&&failed)message.textContent=document.documentElement?.lang==='ar'?'تعذر عرض بعض تفاصيل المباني. الخريطة وأدواتها ما زالت متاحة.':'Some building detail could not render. The map and its controls remain available.';
    }
    function ensureLandmarks(){
      if(disposed||!landmarksUrl||!landmarksRequested)return Promise.resolve();
      // Captions and API response order are not a new building. Geographic
      // anchors, provider identity, height and usable roof size are.
      const snapshot=pins.filter(pin=>Array.isArray(pin._lngLat)).map(pin=>({...pin,_lngLat:pin._lngLat.slice(),_buildingAssociation:pin._buildingAssociation?{...pin._buildingAssociation}:undefined}));
      const signature=JSON.stringify(snapshot.map(pin=>{const roof=pin._buildingAssociation;return[pin.id,pin._lngLat,roof?.providerId??null,roof?.heightMeters??null,roof?.clearanceMeters??null,roof?.insideRoof??false];}).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
      if(signature===landmarkSignature&&loading)return loading;
      if(signature===landmarkSignature&&landmarkError)return Promise.reject(landmarkError);
      if(landmarkError)landmarkImportRevision++;
      const generation=++landmarkGeneration,previous=loading;landmarkSignature=signature;landmarkError=null;
      landmarks?.dispose();landmarks=null;
      // The shared custom layer has one owner. An earlier shader preparation
      // must settle before its stale value can be disposed and replaced.
      loading=Promise.resolve(previous).catch(()=>{}).then(()=>{
        if(disposed||generation!==landmarkGeneration||!snapshot.length)return;
        const landmarkModuleUrl=landmarksUrl+(landmarkImportRevision?(landmarksUrl.includes('?')?'&':'?')+'retry='+landmarkImportRevision:'');
        return import(landmarkModuleUrl);
      }).then(module=>{
        if(!module||disposed||generation!==landmarkGeneration)return;
        return module.createLandmarks(map,snapshot,()=>!disposed&&generation===landmarkGeneration);
      }).then(value=>{
        if(!value)return;
        if(disposed||generation!==landmarkGeneration){value.dispose();return;}
        if(value.diagnostics?.status!=='ready'){value.dispose();throw new Error('Building sign preparation did not reach ready.');}
        landmarks=value;value.setVisible(visible);map.fire?.('zone-landmarks-ready');
        if(typeof document==='object'&&document.body){
          document.body.dataset.zoneDistrictLandmarks=JSON.stringify(value.diagnostics);
          syncDetailNotice();
        }
      }).catch(error=>{
        if(disposed||generation!==landmarkGeneration)return;
        loading=null;landmarkError=error;
        if(typeof document==='object'&&document.body){
          document.body.dataset.zoneDistrictLandmarks=JSON.stringify({status:'failed',error:String(error.message||error)});
          syncDetailNotice();
        }
        moduleFetchFailed(error);
        throw error;
      });
      return loading;
    }
    function ensureSurfaces(){
      if(disposed||!loadSurfaces)return Promise.resolve();
      if(surfacesLoading)return surfacesLoading;
      const features=map.getSource?.('district-complete-buildings')?.serialize?.()?.data?.features;
      if(!features?.length)return Promise.resolve();
      const generation=surfaceGeneration;
      // Reuse the completed in-memory provider geometry. Facade production
      // must not issue another tile request, move a marker or change a height.
      surfacesLoading=Promise.resolve().then(()=>loadSurfaces(generation)).then(module=>{
        if(disposed||generation!==surfaceGeneration)return;
        return module.createDistrictSurfaces(map,features,{isActive:()=>!disposed&&generation===surfaceGeneration});
      }).then(value=>{
        if(!value)return;
        if(disposed||generation!==surfaceGeneration){value.dispose();return;}
        surfaces=value;value.setVisible(visible);return value.ready;
      }).catch(error=>{
        if(!disposed&&generation===surfaceGeneration&&typeof document==='object'&&document.body){
          document.body.dataset.zoneDistrictSurfaces=JSON.stringify({status:'failed',error:String(error.message||error)});
          syncDetailNotice();
        }
        if(!disposed&&generation===surfaceGeneration)moduleFetchFailed(error);
      });
      return surfacesLoading;
    }
    function resetSurfacesForStyle(){
      if(disposed||map.getLayer?.('zone-district-surfaces'))return;
      surfaceGeneration++;surfaces?.dispose();surfaces=null;surfacesLoading=null;
    }
    if(loadSurfaces)map.on?.('style.load',resetSurfacesForStyle);
    function resetLandmarksForStyle(){
      if(disposed||map.getLayer?.('zone-authored-landmarks'))return;
      if(landmarkError)landmarkImportRevision++;
      landmarkGeneration++;landmarkSignature='';landmarkError=null;
      landmarks?.dispose();landmarks=null;
      // Retain an in-flight preparation as the serialization barrier. It must
      // settle/dispose before a replacement claims the shared layer ID.
    }
    if(landmarksUrl)map.on?.('style.load',resetLandmarksForStyle);
    function bindServiceBuildings(){
      void ensureSurfaces();
      const association=globalThis.ZoneServiceBuildings,features=map.getSource?.('district-complete-buildings')?.serialize?.()?.data?.features;
      if(disposed||!association||!features?.length||!pins.length)return;
      const before=JSON.stringify(pins.map(pin=>[pin.id,pin._lngLat]));
      const signature=JSON.stringify(pins.map(pin=>[pin.id,pin._buildingSource||pin._lngLat]));
      if(features!==bindingFeatures||signature!==bindingSignature){bindingFeatures=features;bindingSignature=signature;bindingResult=association.associate(pins,features);}
      const result=association.apply(pins,bindingResult);
      if(typeof WebGLRenderingContext!=='undefined'){pins.forEach(pin=>{if(Array.isArray(pin._buildingSource)){pin._lngLat=pin._buildingSource.slice();if(pin._buildingAssociation)pin._buildingAssociation.coordinates=pin._buildingSource.slice();}});}
      if(typeof document==='object'&&document.body){const diagnostic=JSON.stringify({source:result.source,complete:result.complete,unbound:result.unbound,associations:result.associations.map(({polygon,...a})=>a)});if(document.body.dataset.zoneServiceBuildings!==diagnostic)document.body.dataset.zoneServiceBuildings=diagnostic;}
      // This runs in the existing idle recovery path. Re-publishing identical
      // GeoJSON there would trigger another idle forever and prevent settling.
      if(before!==JSON.stringify(pins.map(pin=>[pin.id,pin._lngLat])))map.fire?.('zone-landmarks-ready');
      syncMapMedia();
      if(landmarksRequested)void ensureLandmarks().catch(()=>{});
    }
    function syncMapMedia(){
      if(disposed||!mapMediaUrl)return;
      const bindings=pins.filter(pin=>/^[a-f0-9]{64}$/.test(pin.mediaAsset||'')&&pin._buildingAssociation?.insideRoof);
      const signature=JSON.stringify(bindings.map(pin=>[pin.id,pin.mediaAsset,pin._lngLat,pin._buildingAssociation.providerId]));
      if(signature===mapMediaSignature)return;mapMediaSignature=signature;mapMedia?.dispose();mapMedia=null;
      if(!bindings.length)return;
      // An earlier shader preparation may still own the one custom map layer.
      // Let its stale-result disposal finish before installing its replacement.
      const previous=mapMediaLoading;
      mapMediaLoading=Promise.resolve(previous).catch(()=>{}).then(()=>{if(disposed||signature!==mapMediaSignature)return;return import(mapMediaUrl);}).then(module=>{if(!module||disposed||signature!==mapMediaSignature)return;return module.createMapMedia(map,bindings,()=>!disposed&&signature===mapMediaSignature);}).then(value=>{if(!value)return;if(disposed||signature!==mapMediaSignature)value.dispose();else{mapMedia=value;value.setVisible(visible);}}).catch(error=>{if(!disposed&&signature===mapMediaSignature&&typeof document==='object'&&document.body)document.body.dataset.zoneMapMedia=JSON.stringify({status:'error',error:String(error.message||error),representation:'matched-service-rooftop-attachment'});});
    }
    return {
      isDisposed(){return disposed;},
      isVisible(){return visible;},
      destinationCount(){return pins.length;},
      destinationIds(){return pins.map(p=>p?.id).filter(Boolean);},
      hasDestination(id){return pins.some(p=>p?.id===id);},
      diagnostics(){
        return {
          disposed,
          visible,
          destinationCount:pins.length,
          landmarksStatus:landmarks?.diagnostics?.status??(landmarkError?'failed':(loading?'loading':'idle')),
          surfacesStatus:surfaces?.diagnostics?.status??(surfacesLoading?'loading':'idle'),
          buildingsStatus:buildings?.diagnostics?.()?.status??(buildingsLoading?'loading':'idle'),
          mapMediaStatus:mapMedia?.diagnostics?.status??(mapMediaLoading?'loading':'idle'),
        };
      },
      setDestinations(next){if(!disposed){pins=Array.isArray(next)?next:[];bindServiceBuildings();if(landmarksRequested)void ensureLandmarks().catch(()=>{});}},
      retrySurfaces(){if(disposed)return Promise.resolve();if(surfaces?.diagnostics?.status==='ready')return surfacesLoading;surfaceGeneration++;surfaces?.dispose();surfaces=null;surfacesLoading=null;return ensureSurfaces();},
      retryLandmarks(){if(disposed)return Promise.resolve();if((landmarks?.diagnostics?.status==='ready'||!landmarks&&loading&&landmarkSignature)&&!landmarkError)return loading;landmarkImportRevision++;landmarkError=null;landmarkSignature='';return ensureLandmarks();},
      destinationHeight(id){const landmark=landmarks?.diagnostics?.landmarks?.find(value=>value.id===id);return landmark&&Number.isFinite(landmark.heightMeters)?(landmark.symbolOffset??landmark.heightMeters+2):0;},
      whenReady(){
        if(disposed)return Promise.resolve();
        return new Promise((resolve,reject)=>{
          if((typeof WebGLRenderingContext!=='undefined')||(map.areTilesLoaded&&map.areTilesLoaded())){resolve();return;}
          let timer;
          const cleanup=()=>{clearTimeout(timer);map.off('idle',finish);waits.delete(cancel);};
          const cancel=()=>{cleanup();resolve();};
          const finish=()=>{if(disposed||!map.areTilesLoaded||map.areTilesLoaded()){cleanup();resolve();}};
          waits.add(cancel);timer=setTimeout(()=>{cleanup();reject(new Error('District tiles are still loading'));},15000);
          map.on('idle',finish);map.triggerRepaint?.();
        }).then(()=>buildingsLoading).then(()=>{
          bindServiceBuildings();
          if(disposed)return;
          const surfaceReady=ensureSurfaces();
          landmarksRequested=true;
          return Promise.all([ensureLandmarks(),mapMediaLoading,surfaceReady]);
        });
      },
      setVisible(value){if(disposed)return;visible=!!value;landmarks?.setVisible(visible);mapMedia?.setVisible(visible);surfaces?.setVisible(visible);if(!value)map.stop?.();},
      setTerritories(features){
        if(disposed||buildingsLoading||buildings||!buildingsUrl||!features?.length)return;
        const points=[];function visit(value){if(typeof value?.[0]==='number'){if(Number.isFinite(value[0])&&Number.isFinite(value[1]))points.push(value);}else if(Array.isArray(value))value.forEach(visit);}
        features.forEach(f=>visit(f.geometry?.coordinates));if(!points.length)return;
        const bounds=[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]];
        buildingsLoading=import(buildingsUrl).then(module=>{if(disposed)return;buildings=module.createDistrictBuildings(map,bounds,globalThis.mapboxgl?.accessToken);buildingStates.set(map,buildings);return buildings.ready;}).then(res=>{if(!disposed&&typeof WebGLRenderingContext!=='undefined'){landmarksRequested=true;bindServiceBuildings();}return res;}).catch(error=>{if(typeof document==='object'&&!disposed){document.body.dataset.zoneDistrictBuildings=JSON.stringify({status:'degraded',complete:false,stage:'module-load-failed'});const notice=document.getElementById('districtDetailStatus');if(notice){notice.hidden=false;notice.textContent=document.documentElement.lang==='ar'?'تعذر تحميل تفاصيل المباني. الخريطة الأساسية متاحة.':'Building detail could not load. The base map remains available.';}}});
      },
      dispose(){if(disposed)return;disposed=true;surfaceGeneration++;landmarkGeneration++;map.off?.('style.load',resetSurfacesForStyle);map.off?.('style.load',resetLandmarksForStyle);waits.forEach(cancel=>cancel());landmarks?.dispose();mapMedia?.dispose();surfaces?.dispose();buildings?.dispose();buildingStates.delete(map);}
    };
  }
  return {CENTER,defaultCenter,defaultNeighborhoodMeters,maxNeighborhoodMeters,familyReservationLayerId,familyReservationImageId,familyTouchReservationSizePx,districtWaitTimeoutMs,coinRoofCacheTtlMs,earthRadiusMeters,mercator,geographic,createProjection,createStyle,summarizeStyle,styleLayerIds,styleLayerCount,isStyleLayerId,setPerspective,syncPoiPerspective,syncPerspectiveCameraLimit,perspectiveZoomLimit,collidesWithSymbols,syncBadgeReservations,prioritizeBadgeReservations,controller,renderedDiagnostics,CIRCUMFERENCE,isModuleFetchFailure,createModuleRetry};
});

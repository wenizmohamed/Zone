/* Display coordinates only. Server geometry, parcel IDs and action versions
 * remain authoritative. Streets and footprints are genuine Streets v8 tiles. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ZoneCompactDistrict=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const CENTER=[-73.9865,40.698],EARTH=6378137,CIRCUMFERENCE=2*Math.PI*EARTH,perspectiveStates=new WeakMap(),badgeStates=new WeakMap(),buildingStates=new WeakMap(),poiPerspectiveStates=new WeakMap(),cameraLimitStates=new WeakMap(),coinRoofStates=new WeakMap();
  const scriptUrl=typeof document==='object'&&document.currentScript&&document.currentScript.src?new URL(document.currentScript.src):null;
  const landmarksUrl=scriptUrl?new URL('../../dist/district-landmarks.js'+scriptUrl.search,scriptUrl).href:null;
  const buildingsUrl=scriptUrl?new URL('./district-buildings.js'+scriptUrl.search,scriptUrl).href:null;
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
    return {version:8,name:'ZONE compact waterfront district',glyphs:'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',sources:{[source]:{type:'vector',url:'mapbox://mapbox.mapbox-streets-v8'}},layers:[
      {id:'background',type:'background',paint:{'background-color':'#20272c'}},
      {id:'district-land',type:'fill',source,'source-layer':'landuse',paint:{'fill-color':['match',['get','class'],'park','#334b41','pitch','#35433a','industrial','#31353a','#293034'],'fill-opacity':.82}},
      {id:'district-water',type:'fill',source,'source-layer':'water',paint:{'fill-color':'#142e3b'}},
      {id:'district-waterway',type:'line',source,'source-layer':'waterway',paint:{'line-color':'#193844','line-width':['interpolate',['linear'],['zoom'],14,1,20,8]}},
      {id:'district-buildings',type:'fill',source,'source-layer':'building',minzoom:14,filter:['all',['!=',['get','type'],'building:part'],['!=',['get','underground'],'true']],paint:{'fill-color':'#747c79','fill-opacity':1,'fill-outline-color':'#313b40'}},
      {id:'district-road-casing',type:'line',source,'source-layer':'road',filter:['!=',['get','class'],'path'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#171e24','line-width':['interpolate',['exponential',1.6],['zoom'],14,2.5,16,7,18,20,20,48]}},
      {id:'district-roads',type:'line',source,'source-layer':'road',filter:['!=',['get','class'],'path'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','class'],['motorway','trunk'],'#858985',['primary','secondary'],'#737b80','#59656d'],'line-width':['interpolate',['exponential',1.6],['zoom'],14,1,16,4,18,13,20,36]}},
      {id:'district-paths',type:'line',source,'source-layer':'road',filter:['==',['get','class'],'path'],minzoom:16,paint:{'line-color':'#8a9284','line-width':['interpolate',['linear'],['zoom'],16,1,20,3],'line-dasharray':[1,2],'line-opacity':.6}},
      {id:'district-road-labels',type:'symbol',source,'source-layer':'road',minzoom:16.6,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name_en'],['get','name']],'text-font':['Open Sans Regular','Arial Unicode MS Regular'],'text-size':['interpolate',['linear'],['zoom'],16,10,20,12],'text-padding':5},paint:{'text-color':'#b6bec2','text-halo-color':'#222b32','text-halo-width':1.8}},
      {id:'district-buildings-3d',type:'fill-extrusion',source,'source-layer':'building',minzoom:16,filter:['all',['==',['get','extrude'],'true'],['!=',['get','underground'],'true']],paint:{'fill-extrusion-color':['interpolate',['linear'],['max',0,['to-number',['get','height'],0]],0,'#68716f',18,'#838b81',60,'#9b9887'],'fill-extrusion-height':['max',0,['to-number',['get','height'],0]],'fill-extrusion-base':['min',['max',0,['to-number',['get','height'],0]],['max',0,['to-number',['get','min_height'],0]]],'fill-extrusion-opacity':1},layout:{visibility:'none'}}
    ]};
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
  function controller(map){
    let pins=[],landmarks=null,loading=null,disposed=false,visible=true,buildings=null,buildingsLoading=null;
    const waits=new Set();
    return {
      setDestinations(next){if(!disposed)pins=Array.isArray(next)?next:[];},
      destinationHeight(id){const landmark=landmarks?.diagnostics?.landmarks?.find(value=>value.id===id);return landmark&&Number.isFinite(landmark.heightMeters)?landmark.heightMeters+2:0;},
      whenReady(){
        if(disposed)return Promise.resolve();
        return new Promise((resolve,reject)=>{
          if(map.areTilesLoaded&&map.areTilesLoaded()){resolve();return;}
          let timer;
          const cleanup=()=>{clearTimeout(timer);map.off('idle',finish);waits.delete(cancel);};
          const cancel=()=>{cleanup();resolve();};
          const finish=()=>{if(disposed||!map.areTilesLoaded||map.areTilesLoaded()){cleanup();resolve();}};
          waits.add(cancel);timer=setTimeout(()=>{cleanup();reject(new Error('District tiles are still loading'));},15000);
          map.on('idle',finish);map.triggerRepaint?.();
        }).then(()=>buildingsLoading).then(()=>{
          if(disposed||!landmarksUrl||!pins.length||landmarks)return;
          if(!loading)loading=import(landmarksUrl).then(module=>{
            if(disposed)return;
            return module.createLandmarks(map,pins,()=>!disposed);
          }).then(value=>{
            if(!value)return;if(disposed)value.dispose();else{landmarks=value;value.setVisible(visible);map.fire?.('zone-landmarks-ready');}
          }).catch(error=>{loading=null;if(!disposed)throw error;});
          return loading;
        });
      },
      setVisible(value){if(disposed)return;visible=!!value;landmarks?.setVisible(visible);if(!value)map.stop?.();},
      setTerritories(features){
        if(disposed||buildingsLoading||buildings||!buildingsUrl||!features?.length)return;
        const points=[];function visit(value){if(typeof value?.[0]==='number'){if(Number.isFinite(value[0])&&Number.isFinite(value[1]))points.push(value);}else if(Array.isArray(value))value.forEach(visit);}
        features.forEach(f=>visit(f.geometry?.coordinates));if(!points.length)return;
        const bounds=[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]];
        buildingsLoading=import(buildingsUrl).then(module=>{if(disposed)return;buildings=module.createDistrictBuildings(map,bounds,globalThis.mapboxgl?.accessToken);buildingStates.set(map,buildings);return buildings.ready;}).catch(error=>{if(typeof document==='object'&&!disposed){document.body.dataset.zoneDistrictBuildings=JSON.stringify({status:'degraded',complete:false,stage:'module-load-failed'});const notice=document.getElementById('districtDetailStatus');if(notice){notice.hidden=false;notice.textContent=document.documentElement.lang==='ar'?'تعذر تحميل تفاصيل المباني. الخريطة الأساسية متاحة.':'Building detail could not load. The base map remains available.';}}});
      },
      dispose(){if(disposed)return;disposed=true;waits.forEach(cancel=>cancel());landmarks?.dispose();buildings?.dispose();buildingStates.delete(map);}
    };
  }
  return {CENTER,mercator,geographic,createProjection,createStyle,setPerspective,syncPoiPerspective,syncPerspectiveCameraLimit,perspectiveZoomLimit,collidesWithSymbols,syncBadgeReservations,prioritizeBadgeReservations,controller,renderedDiagnostics,CIRCUMFERENCE};
});

/* Licensed provider geometry is decoded for this map's lifetime only. No
 * persistence, export, offline archive or requests during pan/zoom. */
import {VectorTile} from './vendor/vector-tile.mjs?v=98';
import {PbfReader} from './vendor/pbf.mjs?v=98';

export const LIMITS=Object.freeze({sourceZoom:16,maxTiles:9,concurrency:2,maxTileBytes:1048576,maxBytes:4194304,maxFeatures:5000,maxCoordinates:160000,timeoutMs:15000});
export const SOURCE='district-complete-buildings';
export const FILL='district-complete-footprints',EXTRUSION='district-complete-volumes';
const height=['max',0,['to-number',['get','height'],0]];
export const BUILDING_PAINT=Object.freeze({'fill-extrusion-color':['interpolate',['linear'],height,0,'#68716f',18,'#838b81',60,'#9b9887'],'fill-extrusion-height':height,'fill-extrusion-base':['min',height,['max',0,['to-number',['get','min_height'],0]]],'fill-extrusion-opacity':1});
export const EXTRUDE_FILTER=['all',['==',['get','extrude'],'true'],['!=',['get','underground'],'true']];
export const FOOTPRINT_FILTER=['all',['!=',['get','type'],'building:part'],['!=',['get','underground'],'true']];

export function planTiles(bounds,limits=LIMITS){
  if(!Array.isArray(bounds)||bounds.length!==2||bounds.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))))throw new Error('District bounds are unavailable');
  const [[west,south],[east,north]]=bounds,z=limits.sourceZoom,n=2**z;
  if(!(west<east&&south<north&&west>=-180&&east<=180&&south>-85&&north<85))throw new Error('District bounds are invalid');
  const tx=lng=>Math.floor((lng+180)/360*n),ty=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
  const left=tx(west),right=tx(east),top=ty(north),bottom=ty(south),count=(right-left+1)*(bottom-top+1);
  if(count>limits.maxTiles)throw new Error('District detail exceeds the tile budget');
  const tiles=[];for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)tiles.push({x,y,z});
  return tiles;
}
function coordinatesCount(value){return typeof value[0]==='number'?1:value.reduce((n,child)=>n+coordinatesCount(child),0);}
export function decodeTile(bytes,tile){
  const vector=new VectorTile(new PbfReader(bytes)),layer=vector.layers.building,result=[];
  if(!layer)return result;
  for(let i=0;i<layer.length;i++){
    const original=layer.feature(i);if(original.type!==3)continue;
    const feature=original.toGeoJSON(tile.x,tile.y,tile.z);
    if(!['Polygon','MultiPolygon'].includes(feature.geometry.type))throw new Error('Unsupported building geometry');
    if(!coordinatesCount(feature.geometry.coordinates))continue;
    // A provider ID can occur in neighboring tile fragments. Keep both genuine
    // fragments. Deduplicating by ID alone would discard half a boundary building.
    feature.properties={...feature.properties,providerId:original.id==null?null:String(original.id),providerTile:tile.z+'/'+tile.x+'/'+tile.y};
    feature.id=feature.properties.providerTile+'/'+(original.id==null?'index-'+i:original.id);
    result.push(feature);
  }
  return result;
}
export function summarizeDecodedFeatures(features){
  const list=Array.isArray(features)?features:[];
  let extrudable=0,raisedParts=0,maximumHeight=0;
  const tiles=new Set();
  for(const f of list){
    const h=Number(f?.properties?.height)||0,b=Number(f?.properties?.min_height)||0;
    if(f?.properties?.extrude==='true'&&h>b){extrudable++;maximumHeight=Math.max(maximumHeight,h);}
    if(b>0)raisedParts++;
    if(f?.properties?.providerTile)tiles.add(String(f.properties.providerTile));
  }
  return {total:list.length,extrudable,raisedParts,maximumHeight,uniqueTiles:tiles.size};
}
async function readBounded(response,maxBytes){
  if(!response.ok)throw new Error('Provider district request failed (HTTP '+response.status+')');
  const declared=Number(response.headers?.get('content-length'));
  if(declared>maxBytes)throw new Error('Provider tile exceeds the byte budget');
  if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>maxBytes)throw new Error('Provider tile exceeds the byte budget');return bytes;}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Provider tile exceeds the byte budget');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}

export function createDistrictBuildings(map,bounds,token,options={}){
  const limits={...LIMITS,...options.limits},fetchTile=options.fetch||globalThis.fetch,doc=options.document||(typeof document==='object'?document:null),abort=new AbortController();
  const state={status:'loading',stage:'requesting',source:'mapbox-streets-v8',sourceZoom:limits.sourceZoom,expectedTiles:0,loadedTiles:0,requests:0,bytes:0,features:0,coordinates:0,extrudableFeatures:0,maximumHeight:0,raisedParts:0,collapsedRaisedParts:0,complete:false,persistence:'map-lifetime-memory-only',limits:{...limits}};
  let disposed=false,data=null,timer=null,renderTimer=null,resolveRender=null,installing=false,renderFailed=false;
  function publish(){
    if(doc?.body?.dataset)doc.body.dataset.zoneDistrictBuildings=JSON.stringify({...state,activeLOD:state.status==='ready'?(map.getZoom()<limits.sourceZoom?'complete-district':'native-provider'):'native-fallback',zoom:map.getZoom()});
    const notice=doc?.getElementById?.('districtDetailStatus');if(!notice)return;
    const ar=doc.documentElement?.lang==='ar';notice.hidden=state.status==='ready'||state.status==='disposed';notice.dataset.state=state.status;
    notice.textContent=state.status==='degraded'?(ar?'تفاصيل المباني الكاملة غير متاحة. الخريطة الأساسية وأدواتها ما زالت تعمل.':'Complete building detail is unavailable. The base map and its controls still work.'):(ar?'جارٍ تحميل تفاصيل مباني المنطقة...':'Loading district building detail...');
  }
  function setNativeRange(ready){if(map.getLayer('district-buildings')&&map.setLayerZoomRange)map.setLayerZoomRange('district-buildings',ready?limits.sourceZoom:14,24);}
  function installedContract(){
    if(!map.getSource(SOURCE))return false;
    const serialized=map.getStyle?.()?.layers;
    const layer=id=>Array.isArray(serialized)?serialized.find(value=>value.id===id):map.getLayer(id);
    const fill=layer(FILL),volume=layer(EXTRUSION),native=layer('district-buildings'),nativeVolume=layer('district-buildings-3d');
    return fill?.type==='fill'&&volume?.type==='fill-extrusion'&&fill.source===SOURCE&&volume.source===SOURCE&&
      fill.minzoom===13.2&&volume.minzoom===13.2&&fill.maxzoom===limits.sourceZoom&&volume.maxzoom===limits.sourceZoom&&
      native?.source==='district-streets'&&nativeVolume?.source==='district-streets'&&native.minzoom===limits.sourceZoom&&nativeVolume.minzoom===limits.sourceZoom;
  }
  function failRender(){
    // Latch failure before cleanup: removing a source can synchronously emit
    // sourcedata. Idle/source events must not hide a failed installation.
    renderFailed=true;clearTimeout(renderTimer);renderTimer=null;state.status='degraded';state.stage='render-failed';state.complete=false;
    cleanupLayers();publish();resolveRender?.();resolveRender=null;
  }
  function armRenderDeadline(){
    if(renderTimer||disposed)return;
    renderTimer=setTimeout(()=>{renderTimer=null;renderFailed=true;state.status='degraded';state.stage='render-timeout';state.complete=false;cleanupLayers();data=null;publish();resolveRender?.();resolveRender=null;},limits.timeoutMs);
  }
  function install(){
    // isStyleLoaded() also waits for unrelated basemap/glyph/source requests.
    // This controller starts after the style exists. Its native building layer
    // proves that the current style is available, without starving our source
    // installation behind pending work in that style.
    if(disposed||!data||renderFailed||installing||!map.getLayer('district-buildings')||installedContract())return;
    installing=true;state.status='loading';state.stage='rendering';state.complete=false;armRenderDeadline();publish();
    try{
      if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data,tolerance:0,buffer:128,maxzoom:limits.sourceZoom});
      const before=map.getLayer('district-road-casing')?'district-road-casing':undefined;
      if(!map.getLayer(FILL))map.addLayer({id:FILL,type:'fill',source:SOURCE,minzoom:13.2,maxzoom:limits.sourceZoom,filter:FOOTPRINT_FILTER,paint:{'fill-color':'#747c79','fill-opacity':1,'fill-outline-color':'#313b40'}},before);
      // Ground footprints stay below streets. Their raised provider volumes
      // belong beside native 3D buildings, after opaque ground surfaces.
      const beforeVolume=map.getLayer('district-buildings-3d')?'district-buildings-3d':undefined;
      if(!map.getLayer(EXTRUSION))map.addLayer({id:EXTRUSION,type:'fill-extrusion',source:SOURCE,minzoom:13.2,maxzoom:limits.sourceZoom,filter:EXTRUDE_FILTER,paint:{...BUILDING_PAINT},layout:{visibility:map.getPitch()>1?'visible':'none'}},beforeVolume);
      setNativeRange(true);
      if(!installedContract())throw new Error('District detail layer transaction is incomplete');
    }catch(_){failRender();}
    finally{installing=false;}
  }
  function cleanupLayers(){
    for(const id of [EXTRUSION,FILL])try{if(map.getLayer(id))map.removeLayer?.(id);}catch(_){}
    try{if(map.getSource(SOURCE))map.removeSource?.(SOURCE);}catch(_){}
    try{setNativeRange(false);}catch(_){}
  }
  function checkRendered(){
    if(disposed||!data||renderFailed||installing)return;
    if(!installedContract()){install();}
    if(renderFailed||!installedContract()||state.expectedTiles<1||state.loadedTiles!==state.expectedTiles)return;
    if(!map.isSourceLoaded||map.isSourceLoaded(SOURCE)){clearTimeout(renderTimer);renderTimer=null;state.status='ready';state.stage='rendered';state.complete=true;publish();resolveRender?.();resolveRender=null;}
  }
  function styleLoaded(){if(disposed||!data||installing)return;renderFailed=false;armRenderDeadline();try{install();checkRendered();}catch(_){failRender();}}
  function sourceData(event){if(event?.sourceId===SOURCE)checkRendered();}
  function cameraChanged(){if(!disposed)publish();}
  map.on?.('style.load',styleLoaded);map.on?.('idle',checkRendered);map.on?.('sourcedata',sourceData);map.on?.('moveend',cameraChanged);publish();
  const ready=(async()=>{
    try{
      if(!token||typeof fetchTile!=='function')throw new Error('Provider district access is unavailable');
      const tiles=planTiles(bounds,limits);state.expectedTiles=tiles.length;publish();
      timer=setTimeout(()=>abort.abort(new Error('District detail request timed out')),limits.timeoutMs);
      const features=[];let cursor=0;
      async function worker(){while(cursor<tiles.length&&!abort.signal.aborted){const tile=tiles[cursor++];state.requests++;
        const url='https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/'+tile.z+'/'+tile.x+'/'+tile.y+'.vector.pbf?access_token='+encodeURIComponent(token);
        const bytes=await readBounded(await fetchTile(url,{signal:abort.signal,credentials:'omit'}),limits.maxTileBytes);
        if(disposed||abort.signal.aborted)throw new Error('District detail request cancelled');
        state.bytes+=bytes.byteLength;if(state.bytes>limits.maxBytes)throw new Error('District detail exceeds the byte budget');
        const decoded=decodeTile(bytes,tile);state.features+=decoded.length;if(state.features>limits.maxFeatures)throw new Error('District detail exceeds the feature budget');
        for(const f of decoded){state.coordinates+=coordinatesCount(f.geometry.coordinates);if(state.coordinates>limits.maxCoordinates)throw new Error('District detail exceeds the geometry budget');
          const h=Number(f.properties.height)||0,b=Number(f.properties.min_height)||0;if(f.properties.extrude==='true'&&h>b){state.extrudableFeatures++;state.maximumHeight=Math.max(state.maximumHeight,h);}
          if(b>0){state.raisedParts++;if(h<=b)state.collapsedRaisedParts++;}features.push(f);
        }
        state.loadedTiles++;publish();
      }}
      await Promise.all(Array.from({length:Math.min(limits.concurrency,tiles.length)},worker));clearTimeout(timer);timer=null;
      if(disposed||abort.signal.aborted)return;
      if(state.loadedTiles!==tiles.length)throw new Error('District detail is incomplete');
      data={type:'FeatureCollection',features};state.stage='rendering';
      await new Promise(resolve=>{resolveRender=resolve;armRenderDeadline();install();publish();checkRendered();map.triggerRepaint?.();});
    }catch(_){abort.abort();data=null;if(!disposed){cleanupLayers();state.status='degraded';state.stage='load-failed';state.complete=false;publish();}}
    finally{clearTimeout(timer);timer=null;}
  })();
  return {ready,ensure:styleLoaded,diagnostics:()=>({...state}),dispose(){if(disposed)return;disposed=true;abort.abort();clearTimeout(timer);clearTimeout(renderTimer);resolveRender?.();resolveRender=null;map.off?.('style.load',styleLoaded);map.off?.('idle',checkRendered);map.off?.('sourcedata',sourceData);map.off?.('moveend',cameraChanged);cleanupLayers();data=null;state.status='disposed';state.complete=false;publish();}};
}

import * as THREE from '../lib/three184/three.module.js';
import {loadAsset,normalizeAssetObject} from './asset-loader.mjs';

const LAYER='zone-published-map-media',HASH=/^[a-f0-9]{64}$/;
// A map model is explicitly a service's rooftop attachment. It does not replace
// the provider's whole building, move territory parcels, or claim an arbitrary
// neighboring roof. The matching target ID must already have a measured roof.
export async function createMapMedia(map,pins,isActive=()=>true){
  const entries=pins.filter(pin=>HASH.test(pin.mediaAsset||'')&&pin._buildingAssociation?.insideRoof===true);
  if(!entries.length)return{setVisible(){},dispose(){},diagnostics:{status:'empty',bindings:[]},getDiagnostics(){return{status:'empty',bindings:[]};}};
  if(map.getLayer(LAYER))throw Error('Published map asset layer already exists');
  let disposed=false,visible=true,prepared=false,renderer,scene,camera,local,preparing;
  const records=[],controllers=[],diagnostics={status:'loading',representation:'matched-service-rooftop-attachment',bindings:[],calls:0,triangles:0,continuousAnimation:false};
  const publish=()=>{if(typeof document==='object'&&document.body)document.body.dataset.zoneMapMedia=JSON.stringify(diagnostics);};
  publish();
  function release(){for(const record of records)record.asset.dispose();records.length=0;controllers.forEach(c=>c.abort());}
  try{
    const results=await Promise.allSettled(entries.map(async pin=>{
      const abort=new AbortController();controllers.push(abort);
      const asset=await loadAsset(pin.mediaAsset,{signal:abort.signal});
      if(!asset.object){asset.dispose();throw Error('Map binding '+pin.id+' requires a 3D model; images/audio remain available in the asset library.');}
      const record={pin,asset};records.push(record);return record;
    }));
    const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  }catch(error){release();diagnostics.status='error';diagnostics.error=error.message;publish();throw error;}
  if(!isActive()){release();diagnostics.status='cancelled';publish();return{setVisible(){},dispose(){},diagnostics,getDiagnostics(){return{...diagnostics,bindings:diagnostics.bindings.map(b=>({...b}))};}};}
  const average=entries.reduce((s,p)=>[s[0]+p._lngLat[0]/entries.length,s[1]+p._lngLat[1]/entries.length],[0,0]);
  const origin=mapboxgl.MercatorCoordinate.fromLngLat(average,0),meter=origin.meterInMercatorCoordinateUnits();
  local=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(meter,-meter,meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  const layer={id:LAYER,type:'custom',renderingMode:'3d',onAdd(_map,gl){
    scene=new THREE.Scene();camera=new THREE.Camera();scene.add(new THREE.HemisphereLight('#d2ded7','#484d3b',2));const key=new THREE.DirectionalLight('#ffe5bf',2.7);key.position.set(-100,160,80);scene.add(key);
    for(const {pin,asset} of records){
      const roof=pin._buildingAssociation,point=mapboxgl.MercatorCoordinate.fromLngLat(pin._lngLat,0),group=normalizeAssetObject(asset.object,asset.transform,Math.max(1,Math.min(12,roof.clearanceMeters*1.35)));
      group.name='Published service attachment '+pin.id;group.position.set((point.x-origin.x)/meter,roof.heightMeters+.25,(point.y-origin.y)/meter);scene.add(group);
      diagnostics.bindings.push({targetId:pin.id,assetId:asset.asset.id,coordinates:pin._lngLat.slice(),providerId:roof.providerId,roofHeightMeters:roof.heightMeters,insideRoof:true,transform:asset.transform});
    }
    renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    const textures=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
    renderer.resetState();textures.forEach(t=>renderer.initTexture(t));diagnostics.status='preparing';publish();
    preparing=Promise.resolve(renderer.compileAsync?.(scene,camera)).then(()=>{if(disposed)return;prepared=true;renderer.resetState();diagnostics.status='ready';publish();map.triggerRepaint();});renderer.resetState();
  },render(_gl,input){
    if(disposed||!prepared||!visible||map.getPitch()<10||map.getZoom()<15.8)return;
    const projection=input?.defaultProjectionData?.mainMatrix||input;if(!projection||projection.length!==16)return;
    camera.projectionMatrix.fromArray(projection).multiply(local);renderer.resetState();renderer.render(scene,camera);renderer.resetState();diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;publish();
  },onRemove(){if(disposed)return;disposed=true;release();renderer?.dispose();diagnostics.status='disposed';publish();}};
  try{map.addLayer(layer,map.getLayer('zone-poi-halo')?'zone-poi-halo':undefined);await preparing;}catch(error){if(!disposed){if(map.getLayer(LAYER))map.removeLayer(LAYER);else layer.onRemove();}throw error;}
  return{diagnostics,getDiagnostics(){return{...diagnostics,bindings:diagnostics.bindings.map(b=>({...b}))};},setVisible(value){if(disposed)return;visible=!!value;map.triggerRepaint();},dispose(){if(disposed)return;if(map.getLayer(LAYER))map.removeLayer(LAYER);else layer.onRemove();}};
}

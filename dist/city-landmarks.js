import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import './city-layout.js?v=84';
import '../assets/city/atlas.js?v=84';

const ASSET_ROOT = new URL('../assets/city/kaykit/',import.meta.url);
const MODELS = ['building_A_withoutBase','building_C_withoutBase','building_E_withoutBase','building_G_withoutBase','car_sedan','streetlight','watertower','bush'];
const LAYER_ID = 'zone-city-landmarks';

// One renderer shares Mapbox's context. There is no independent animation loop.
export async function installCityLandmarks(map){
  if(map.getLayer(LAYER_ID))return null;
  const loader=new GLTFLoader(),catalog=new Map();
  const loaded=await Promise.all(MODELS.map(async name=>{
    const gltf=await loader.loadAsync(new URL(`${name}.gltf`,ASSET_ROOT).href);
    gltf.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),meshes=[];
    gltf.scene.traverse(o=>{if(o.isMesh){
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.translate(-center.x,-box.min.y,-center.z);
      const material=o.material.clone();material.roughness=name==='car_sedan'?.5:.82;material.metalness=name==='car_sedan'?.12:0;
      material.color.set('#d1d5cd');
      meshes.push({geometry,material});o.geometry.dispose();o.material.dispose();
    }});
    return [name,{meshes,width:Math.max(size.x,size.z,.01)}];
  }));
  loaded.forEach(([name,asset])=>catalog.set(name,asset));
  let renderer,scene,camera,origin,features=[],placements=[],instances=[],visible=true,disposed=false,lastSignature='',labelSignature='',nativeVisibility,queuedFrame=null,prepared=false,warmPromise=Promise.resolve(),lastTilted=false,lastCull=-Infinity;
  const pools=new Map(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),color=new THREE.Color();
  let shadowGeometry,shadowMaterial,shadowTexture;
  const nativeLayer='zone-buildings-3d';
  const diagnostics={status:'loading',models:MODELS.length,instances:0,buildings:0,visibleBlocks:0,calls:0,triangles:0,geometries:0,textures:0,renderMs:0,cityBlocks:0,poolAllocations:0,rebuilds:0,shadersReady:false};
  const publish=()=>{document.body.dataset.zoneCityModels=JSON.stringify(diagnostics);};
  function restoreNative(){if(map.getLayer(nativeLayer)&&nativeVisibility!==undefined){map.setLayoutProperty(nativeLayer,'visibility',nativeVisibility);nativeVisibility=undefined;}}
  function releaseInstances(){for(const mesh of instances){scene?.remove(mesh);mesh.dispose();}instances=[];}
  function pool(key,geometry,material,capacity){
    if(pools.has(key))return pools.get(key);
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(key!=='shadows')mesh.setColorAt(0,color.set('#ffffff'));mesh.count=1;scene.add(mesh);instances.push(mesh);pools.set(key,mesh);diagnostics.poolAllocations++;
    return mesh;
  }
  function prepareResources(){
    prepared=false;diagnostics.shadersReady=false;diagnostics.status='warming';publish();
    // All shader variants and textures are prepared outside the first camera
    // animation. These persistent pools survive pan, zoom and flat/3D toggles.
    globalThis.ZoneCityAtlas.preparePerspective(map);
    // Reserve the maximum capacity once so resizing from mobile to desktop
    // cannot overflow a pool. Actual rendered counts keep the mobile budgets.
    const buildingBudget=380,propBudget=180;
    for(const [name,asset] of catalog)asset.meshes.forEach((part,index)=>{const mesh=pool(name+':'+index,part.geometry,part.material,name.startsWith('building_')?buildingBudget:propBudget);mesh.visible=true;mesh.count=1;if(part.material.map)renderer.initTexture(part.material.map);});
    const shadows=pool('shadows',shadowGeometry,shadowMaterial,buildingBudget);shadows.visible=true;shadows.count=1;renderer.initTexture(shadowTexture);
    renderer.resetState();
    warmPromise=renderer.compileAsync(scene,camera).then(()=>{if(disposed)return;prepared=true;diagnostics.shadersReady=true;diagnostics.status='ready';renderer.resetState();rebuild();}).catch(error=>{diagnostics.status='error';document.body.dataset.zoneCityModelsError=String(error.message||error);publish();throw error;});
    // Failure stays visible in diagnostics; do not leave an unhandled rejection.
    warmPromise.catch(()=>{});
    return warmPromise;
  }
  function streets(){
    const geo=globalThis.ZoneCityLayout.createStreets(features),source=map.getSource('zone-city-streets');
    if(source)source.setData(geo);else map.addSource('zone-city-streets',{type:'geojson',data:geo});
    if(!map.getLayer('zone-city-streets'))map.addLayer({id:'zone-city-streets',type:'fill',source:'zone-city-streets',layout:{visibility:map.getPitch()>1?'visible':'none'},paint:{'fill-color':'#30383b','fill-opacity':.5,'fill-antialias':false,'fill-outline-color':'rgba(0,0,0,0)'}},'zone-block-feedback');
  }
  function rebuild(){
    if(!scene||disposed||!visible)return;
    if(!prepared)return;
    diagnostics.rebuilds++;
    for(const mesh of instances){mesh.count=0;mesh.visible=false;}
    const tilted=map.getPitch()>1;
    lastTilted=tilted;globalThis.ZoneCityAtlas.setPerspective(map,tilted);
    if(map.getLayer('zone-city-streets'))map.setLayoutProperty('zone-city-streets','visibility',tilted?'visible':'none');
    if(map.getLayer(nativeLayer)){if(nativeVisibility===undefined)nativeVisibility=map.getLayoutProperty(nativeLayer,'visibility')||'visible';map.setLayoutProperty(nativeLayer,'visibility','none');}
    // The original overhead texture owns the default atlas view. Keep the
    // licensed 3D kit for the explicitly requested perspective exploration.
    if(!tilted){diagnostics.instances=0;diagnostics.buildings=0;diagnostics.calls=0;diagnostics.triangles=0;diagnostics.status='ready';diagnostics.view='atlas';publish();map.triggerRepaint();return;}
    diagnostics.view='3d';
    const container=map.getContainer(),selected=globalThis.ZoneCityLayout.selectVisiblePlacements(placements,{width:container.clientWidth,height:container.clientHeight,mobile:innerWidth<=760,project:p=>map.project(p)});
    const buildings=selected.filter(p=>p.model.startsWith('building_'));
    diagnostics.instances=selected.length;diagnostics.buildings=buildings.length;diagnostics.visibleBlocks=new Set(selected.map(p=>p.blockId)).size;
    if(!selected.length){diagnostics.status='ready';publish();map.triggerRepaint();return;}
    // A stable world origin prevents every cull from shifting the scene.
    const meter=origin.meterInMercatorCoordinateUnits();
    function transform(p,width,height=1){const coord=mapboxgl.MercatorCoordinate.fromLngLat(p.coordinates,0);position.set((coord.x-origin.x)/meter,.35,(coord.y-origin.y)/meter);rotation.setFromAxisAngle(up,p.rotation);scale.set(width,width*height,width);matrix.compose(position,rotation,scale);}
    for(const [name,asset] of catalog){
      const group=selected.filter(p=>p.model===name);if(!group.length)continue;
      for(const [partIndex,part] of asset.meshes.entries()){
        const mesh=pools.get(name+':'+partIndex);mesh.count=group.length;mesh.visible=true;
        group.forEach((p,index)=>{transform(p,p.width/asset.width,p.heightScale);mesh.setMatrixAt(index,matrix);color.set(name.startsWith('building_')?['#6c7479','#819195','#897a6b','#a09782'][p.shade%4]:name==='bush'?'#506149':'#b6b2a2');mesh.setColorAt(index,color);});
        mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
      }
    }
    if(buildings.length){
      const shadows=pools.get('shadows');shadows.count=buildings.length;shadows.visible=true;
      buildings.forEach((p,index)=>{transform(p,p.width*1.17);position.y=.2;scale.set(p.width*1.17,1,p.width*1.17);matrix.compose(position,rotation,scale);shadows.setMatrixAt(index,matrix);});
      shadows.instanceMatrix.needsUpdate=true;shadows.computeBoundingSphere();
    }
    if(map.getLayer(nativeLayer)){if(nativeVisibility===undefined)nativeVisibility=map.getLayoutProperty(nativeLayer,'visibility')||'visible';map.setLayoutProperty(nativeLayer,'visibility','none');}
    diagnostics.status='ready';publish();map.triggerRepaint();
  }
  function scheduleRebuild(){if(disposed||!visible||queuedFrame!==null)return;queuedFrame=requestAnimationFrame(()=>{queuedFrame=null;rebuild();});}
  // Refresh the padded visible set during a drag, not only after release.
  // Batching at 80ms avoids rebuilding matrices on every camera frame.
  function onMove(){if(!visible||map.getPitch()<=1)return;const now=performance.now();if(now-lastCull<80)return;lastCull=now;scheduleRebuild();}
  function onPitch(){if((map.getPitch()>1)!==lastTilted)scheduleRebuild();}
  function makeShadows(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,32);gradient.addColorStop(0,'rgba(5,8,12,.82)');gradient.addColorStop(.6,'rgba(5,8,12,.48)');gradient.addColorStop(1,'rgba(5,8,12,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    shadowTexture=new THREE.CanvasTexture(canvas);shadowGeometry=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  }
  const customLayer={
    id:LAYER_ID,type:'custom',renderingMode:'3d',
    onAdd(_map,gl){
      camera=new THREE.Camera();scene=new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#d2e0e4','#29333d',1.2));
      const key=new THREE.DirectionalLight('#ffe3bb',2.1);key.position.set(-120,250,80);scene.add(key);
      const rim=new THREE.DirectionalLight('#afc8db',.7);rim.position.set(80,90,-120);scene.add(rim);
      renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
      makeShadows();map.on('move',onMove);map.on('moveend',scheduleRebuild);map.on('pitchend',scheduleRebuild);map.on('pitch',onPitch);map.on('resize',scheduleRebuild);
    },
    render(_gl,input){
      if(!visible||!origin||disposed||!prepared||map.getPitch()<=1||!diagnostics.instances)return;
      const started=performance.now(),projection=input?.defaultProjectionData?.mainMatrix||input;if(!projection||projection.length!==16)return;
      camera.projectionMatrix.fromArray(projection).multiply(local);
      renderer.resetState();renderer.render(scene,camera);renderer.resetState();
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;diagnostics.geometries=renderer.info.memory.geometries;diagnostics.textures=renderer.info.memory.textures;diagnostics.renderMs=Number((performance.now()-started).toFixed(2));publish();
    },
    onRemove(){
      disposed=true;if(queuedFrame!==null)cancelAnimationFrame(queuedFrame);map.off('move',onMove);map.off('moveend',scheduleRebuild);map.off('pitchend',scheduleRebuild);map.off('pitch',onPitch);map.off('resize',scheduleRebuild);releaseInstances();pools.clear();
      const textures=new Set(),images=new Set();for(const asset of catalog.values())for(const part of asset.meshes){part.geometry.dispose();if(part.material.map)textures.add(part.material.map);part.material.dispose();}
      textures.forEach(t=>{if(t.source?.data)images.add(t.source.data);t.dispose();});images.forEach(i=>i.close?.());shadowGeometry?.dispose();shadowMaterial?.dispose();shadowTexture?.dispose();renderer?.dispose();diagnostics.status='disposed';publish();
    }
  };
  if(!map.getStyle())return null;
  map.addLayer(customLayer,'zone-blocks-fill');
  return {
    setTerritories(next){
      const incoming=Array.isArray(next)?next:[],signature=JSON.stringify(incoming.map(f=>[f.id,f.geometry]));
      const labels=JSON.stringify(incoming.map(f=>[f.properties?.districtId,f.properties?.districtName]));
      if(signature===lastSignature){if(labels!==labelSignature){const source=map.getSource('zone-city-districts');source?.setData({type:'FeatureCollection',features:globalThis.ZoneCityAtlas.createPlan(incoming).labels});labelSignature=labels;}return;}lastSignature=signature;labelSignature=labels;
      features=incoming;
      diagnostics.cityBlocks=features.length;
      diagnostics.atlas=map.getSource('zone-city-atlas')?JSON.parse(document.body.dataset.zoneCityAtlas||'null'):globalThis.ZoneCityAtlas.install(map,features);
      document.body.dataset.zoneCityAtlas=JSON.stringify(diagnostics.atlas);
      placements=globalThis.ZoneCityLayout.createPlacements(features);streets();scheduleRebuild();
      if(placements.length){const center=placements.reduce((sum,p)=>[sum[0]+p.coordinates[0]/placements.length,sum[1]+p.coordinates[1]/placements.length],[0,0]);origin=mapboxgl.MercatorCoordinate.fromLngLat(center,0);const meter=origin.meterInMercatorCoordinateUnits();local.makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(meter,-meter,meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));prepareResources();}
    },
    whenReady(){return warmPromise;},
    setVisible(value){visible=!!value;diagnostics.visible=visible;publish();if(visible)scheduleRebuild();map.triggerRepaint();},
    dispose(){restoreNative();if(map.getLayer(LAYER_ID))map.removeLayer(LAYER_ID);if(map.getLayer('zone-city-streets'))map.removeLayer('zone-city-streets');if(map.getSource('zone-city-streets'))map.removeSource('zone-city-streets');globalThis.ZoneCityAtlas.remove(map);}
  };
}

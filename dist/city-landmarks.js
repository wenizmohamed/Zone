import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import './city-layout.js';

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
      material.color.set('#f0ece5');
      meshes.push({geometry,material});o.geometry.dispose();o.material.dispose();
    }});
    return [name,{meshes,width:Math.max(size.x,size.z,.01)}];
  }));
  loaded.forEach(([name,asset])=>catalog.set(name,asset));
  let renderer,scene,camera,origin,features=[],placements=[],instances=[],visible=true,disposed=false,lastSignature='',nativeVisibility,queuedFrame=null;
  let shadowGeometry,shadowMaterial,shadowTexture;
  const nativeLayer='zone-buildings-3d';
  const diagnostics={status:'loading',models:MODELS.length,instances:0,buildings:0,visibleBlocks:0,calls:0,triangles:0,geometries:0,textures:0,renderMs:0,cityBlocks:0};
  const publish=()=>{document.body.dataset.zoneCityModels=JSON.stringify(diagnostics);};
  function restoreNative(){if(map.getLayer(nativeLayer)&&nativeVisibility!==undefined){map.setLayoutProperty(nativeLayer,'visibility',nativeVisibility);nativeVisibility=undefined;}}
  function releaseInstances(){for(const mesh of instances){scene?.remove(mesh);mesh.dispose();}instances=[];}
  function streets(){
    const geo=globalThis.ZoneCityLayout.createStreets(features),source=map.getSource('zone-city-streets');
    if(source)source.setData(geo);else map.addSource('zone-city-streets',{type:'geojson',data:geo});
    if(!map.getLayer('zone-city-streets'))map.addLayer({id:'zone-city-streets',type:'fill',source:'zone-city-streets',paint:{'fill-color':'#2c3233','fill-opacity':.7,'fill-antialias':false,'fill-outline-color':'rgba(0,0,0,0)'}},'zone-block-feedback');
  }
  function rebuild(){
    if(!scene||disposed||!visible)return;
    releaseInstances();
    const container=map.getContainer(),selected=globalThis.ZoneCityLayout.selectVisiblePlacements(placements,{width:container.clientWidth,height:container.clientHeight,mobile:innerWidth<=760,project:p=>map.project(p)});
    const buildings=selected.filter(p=>p.model.startsWith('building_'));
    diagnostics.instances=selected.length;diagnostics.buildings=buildings.length;diagnostics.visibleBlocks=new Set(selected.map(p=>p.blockId)).size;
    if(!selected.length){diagnostics.status='ready';publish();map.triggerRepaint();return;}
    const center=[selected.reduce((a,p)=>a+p.coordinates[0],0)/selected.length,selected.reduce((a,p)=>a+p.coordinates[1],0)/selected.length];
    origin=mapboxgl.MercatorCoordinate.fromLngLat(center,0);
    const meter=origin.meterInMercatorCoordinateUnits(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),color=new THREE.Color();
    function transform(p,width,height=1){const coord=mapboxgl.MercatorCoordinate.fromLngLat(p.coordinates,0);position.set((coord.x-origin.x)/meter,.35,(coord.y-origin.y)/meter);rotation.setFromAxisAngle(up,p.rotation);scale.set(width,width*height,width);matrix.compose(position,rotation,scale);}
    for(const [name,asset] of catalog){
      const group=selected.filter(p=>p.model===name);if(!group.length)continue;
      for(const part of asset.meshes){
        const mesh=new THREE.InstancedMesh(part.geometry,part.material,group.length);
        group.forEach((p,index)=>{transform(p,p.width/asset.width,p.heightScale);mesh.setMatrixAt(index,matrix);color.set(name.startsWith('building_')?['#d9d4cb','#bac8ce','#c2b4a5','#d7c6aa'][p.shade%4]:'#ddd9d2');mesh.setColorAt(index,color);});
        mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);instances.push(mesh);
      }
    }
    if(buildings.length){
      const shadows=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,buildings.length);
      buildings.forEach((p,index)=>{transform(p,p.width*1.17);position.y=.2;scale.set(p.width*1.17,1,p.width*1.17);matrix.compose(position,rotation,scale);shadows.setMatrixAt(index,matrix);});
      shadows.instanceMatrix.needsUpdate=true;shadows.computeBoundingSphere();scene.add(shadows);instances.push(shadows);
    }
    if(map.getLayer(nativeLayer)){if(nativeVisibility===undefined)nativeVisibility=map.getLayoutProperty(nativeLayer,'visibility')||'visible';map.setLayoutProperty(nativeLayer,'visibility','none');}
    diagnostics.status='ready';publish();map.triggerRepaint();
  }
  function scheduleRebuild(){if(disposed||!visible||queuedFrame!==null)return;queuedFrame=requestAnimationFrame(()=>{queuedFrame=null;rebuild();});}
  function makeShadows(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,32);gradient.addColorStop(0,'rgba(5,8,12,.82)');gradient.addColorStop(.6,'rgba(5,8,12,.48)');gradient.addColorStop(1,'rgba(5,8,12,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    shadowTexture=new THREE.CanvasTexture(canvas);shadowGeometry=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  }
  const customLayer={
    id:LAYER_ID,type:'custom',renderingMode:'3d',
    onAdd(_map,gl){
      camera=new THREE.Camera();scene=new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#e5edf1','#343d49',1.35));
      const key=new THREE.DirectionalLight('#ffe2b6',2.6);key.position.set(-120,250,80);scene.add(key);
      const rim=new THREE.DirectionalLight('#afc8db',.7);rim.position.set(80,90,-120);scene.add(rim);
      renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
      makeShadows();map.on('moveend',scheduleRebuild);map.on('resize',scheduleRebuild);rebuild();
    },
    render(_gl,input){
      if(!visible||!origin||disposed||!instances.length)return;
      const started=performance.now(),projection=input?.defaultProjectionData?.mainMatrix||input;if(!projection||projection.length!==16)return;
      const meter=origin.meterInMercatorCoordinateUnits(),local=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(meter,-meter,meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      camera.projectionMatrix.fromArray(projection).multiply(local);
      renderer.resetState();renderer.render(scene,camera);renderer.resetState();
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;diagnostics.geometries=renderer.info.memory.geometries;diagnostics.textures=renderer.info.memory.textures;diagnostics.renderMs=Number((performance.now()-started).toFixed(2));publish();
    },
    onRemove(){
      disposed=true;if(queuedFrame!==null)cancelAnimationFrame(queuedFrame);map.off('moveend',scheduleRebuild);map.off('resize',scheduleRebuild);releaseInstances();
      const textures=new Set(),images=new Set();for(const asset of catalog.values())for(const part of asset.meshes){part.geometry.dispose();if(part.material.map)textures.add(part.material.map);part.material.dispose();}
      textures.forEach(t=>{if(t.source?.data)images.add(t.source.data);t.dispose();});images.forEach(i=>i.close?.());shadowGeometry?.dispose();shadowMaterial?.dispose();shadowTexture?.dispose();renderer?.dispose();diagnostics.status='disposed';publish();
    }
  };
  if(!map.getStyle())return null;
  map.addLayer(customLayer,'zone-blocks-fill');
  return {
    setTerritories(next){
      const incoming=Array.isArray(next)?next:[],signature=JSON.stringify(incoming.map(f=>[f.id,f.geometry]));if(signature===lastSignature)return;lastSignature=signature;
      features=incoming;
      diagnostics.cityBlocks=features.length;
      placements=globalThis.ZoneCityLayout.createPlacements(features);streets();scheduleRebuild();
    },
    setVisible(value){visible=!!value;diagnostics.visible=visible;publish();if(visible)scheduleRebuild();map.triggerRepaint();},
    dispose(){restoreNative();if(map.getLayer(LAYER_ID))map.removeLayer(LAYER_ID);if(map.getLayer('zone-city-streets'))map.removeLayer('zone-city-streets');if(map.getSource('zone-city-streets'))map.removeSource('zone-city-streets');}
  };
}

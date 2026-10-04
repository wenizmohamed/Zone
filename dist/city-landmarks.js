import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import './city-layout.js';

const ASSET_ROOT = new URL('../assets/city/kaykit/',import.meta.url);
const MODELS = ['building_A_withoutBase','building_C_withoutBase','building_E_withoutBase','building_G_withoutBase','car_sedan','streetlight','watertower','bush'];
const LAYER_ID = 'zone-city-landmarks';

// One renderer shares Mapbox's canvas/context. Static instances repaint only on map events.
export async function installCityLandmarks(map){
  if(map.getLayer(LAYER_ID))return null;
  const loader=new GLTFLoader(),catalog=new Map();
  const loaded=await Promise.all(MODELS.map(async name=>{
    const gltf=await loader.loadAsync(new URL(`${name}.gltf`,ASSET_ROOT).href);
    gltf.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const meshes=[];
    gltf.scene.traverse(o=>{if(o.isMesh){
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
      geometry.translate(-center.x,-box.min.y,-center.z);
      const material=o.material.clone();material.roughness=.88;material.metalness=0;
      // Desaturated stone lets faction areas retain the strongest color.
      material.color.set('#b1b3aa');
      meshes.push({geometry,material});
    }});
    return [name,{meshes,width:Math.max(size.x,size.z,.01)}];
  }));
  loaded.forEach(([name,asset])=>catalog.set(name,asset));
  let renderer,scene,camera,origin,features=[],instances=[],visible=true,disposed=false,lastSignature='',nativeFilter;
  const nativeLayer='zone-buildings-3d';
  const diagnostics={status:'loading',models:MODELS.length,instances:0,calls:0,triangles:0,geometries:0,textures:0,renderMs:0};
  const publish=()=>{document.body.dataset.zoneCityModels=JSON.stringify(diagnostics);};
  function restoreNative(){if(map.getLayer(nativeLayer)&&nativeFilter!==undefined){map.setFilter(nativeLayer,nativeFilter);nativeFilter=undefined;}}
  function releaseInstances(){for(const mesh of instances){scene?.remove(mesh);mesh.dispose();}instances=[];}
  function rebuild(){
    if(!scene||disposed)return;
    releaseInstances();
    const placements=globalThis.ZoneCityLayout.createPlacements(features);
    if(!placements.length){restoreNative();diagnostics.instances=0;publish();map.triggerRepaint();return;}
    const points=placements.map(p=>p.coordinates);
    const center=[points.reduce((a,p)=>a+p[0],0)/points.length,points.reduce((a,p)=>a+p[1],0)/points.length];
    origin=mapboxgl.MercatorCoordinate.fromLngLat(center,0);
    const meter=origin.meterInMercatorCoordinateUnits(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
    for(const [name,asset] of catalog){
      const group=placements.filter(p=>p.model===name);if(!group.length)continue;
      for(const part of asset.meshes){
        const mesh=new THREE.InstancedMesh(part.geometry,part.material,group.length);
        group.forEach((p,index)=>{
          const coord=mapboxgl.MercatorCoordinate.fromLngLat(p.coordinates,0),factor=p.width/asset.width;
          position.set((coord.x-origin.x)/meter,0,(coord.y-origin.y)/meter);
          rotation.setFromAxisAngle(up,p.rotation);scale.setScalar(factor);
          matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.frustumCulled=false;scene.add(mesh);instances.push(mesh);
      }
    }
    // Suppress duplicate real-world extrusions inside the authored game district.
    if(map.getLayer(nativeLayer)){
      if(nativeFilter===undefined)nativeFilter=map.getFilter(nativeLayer)||null;
      const coords=features.flatMap(f=>f.geometry?.coordinates?.[0]||[]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
      if(coords.length){
        const west=Math.min(...coords.map(p=>p[0])),east=Math.max(...coords.map(p=>p[0])),south=Math.min(...coords.map(p=>p[1])),north=Math.max(...coords.map(p=>p[1]));
        const polygon={type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]};
        map.setFilter(nativeLayer,['all',['==',['get','extrude'],'true'],['!',['within',polygon]]]);
      }
    }
    diagnostics.status='ready';diagnostics.instances=placements.length;publish();map.triggerRepaint();
  }
  const customLayer={
    id:LAYER_ID,type:'custom',renderingMode:'3d',
    onAdd(_map,gl){
      camera=new THREE.Camera();scene=new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#f1f3e7','#515b60',2.1));
      const key=new THREE.DirectionalLight('#fff0cf',2.4);key.position.set(-70,120,60);scene.add(key);
      const rim=new THREE.DirectionalLight('#bbd7e4',1.1);rim.position.set(60,50,-80);scene.add(rim);
      renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
      renderer.outputColorSpace=THREE.SRGBColorSpace;rebuild();
    },
    render(_gl,input){
      if(!visible||!origin||disposed||!instances.length)return;
      const started=performance.now(),matrix=input?.defaultProjectionData?.mainMatrix||input;
      if(!matrix||matrix.length!==16)return;
      const meter=origin.meterInMercatorCoordinateUnits();
      // Y-up glTF becomes Z-up Mercator; model Z follows map south.
      const local=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z)
        .scale(new THREE.Vector3(meter,-meter,meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      camera.projectionMatrix.fromArray(matrix).multiply(local);
      renderer.resetState();renderer.render(scene,camera);renderer.resetState();
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;
      diagnostics.geometries=renderer.info.memory.geometries;diagnostics.textures=renderer.info.memory.textures;
      diagnostics.renderMs=Number((performance.now()-started).toFixed(2));publish();
    },
    onRemove(){
      disposed=true;releaseInstances();
      const textures=new Set();for(const asset of catalog.values())for(const part of asset.meshes){part.geometry.dispose();if(part.material.map)textures.add(part.material.map);part.material.dispose();}
      textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});renderer?.dispose();diagnostics.status='disposed';publish();
    }
  };
  if(!map.getStyle())return null;
  const firstSymbol=map.getStyle().layers.find(l=>l.type==='symbol')?.id;
  map.addLayer(customLayer,firstSymbol);
  return {
    setTerritories(next){features=Array.isArray(next)?next:[];const signature=JSON.stringify(features.map(f=>[f.id,f.geometry]));if(signature!==lastSignature){lastSignature=signature;rebuild();}},
    setVisible(value){visible=!!value;diagnostics.visible=visible;publish();map.triggerRepaint();},
    dispose(){restoreNative();if(map.getLayer(LAYER_ID))map.removeLayer(LAYER_ID);}
  };
}

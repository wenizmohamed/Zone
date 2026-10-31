import * as THREE from '../lib/three184/three.module.js';
import {GLTFLoader} from '../lib/three184/GLTFLoader.js';

// A deliberately small authored kit at actual game destinations. These models
// are cosmetic service representations, never ownership/collision geometry.
const ROOT=new URL('../assets/city/kaykit/',import.meta.url);
const KIT={bank:{model:'building_E_withoutBase',width:24,rotation:0,color:'#c0b399'},hospital:{model:'building_G_withoutBase',width:24,rotation:Math.PI/2,color:'#d1c9bb'},gym:{model:'building_C_withoutBase',width:18,rotation:0,color:'#87957a'},hq:{model:'building_A_withoutBase',width:26,rotation:Math.PI/2,color:'#8c9295'},market:{model:'building_C_withoutBase',width:20,rotation:Math.PI/2,color:'#bd9f6a'},home:{model:'building_A_withoutBase',width:20,rotation:0,color:'#9b8872'},jail:{model:'building_E_withoutBase',width:22,rotation:0,color:'#7f8883'},alley:{model:'building_C_withoutBase',width:18,rotation:0,color:'#9b6d56'},shop:{model:'building_C_withoutBase',width:17,rotation:0,color:'#bd9f6a'}};
const ID='zone-authored-landmarks';

export async function createLandmarks(map,pins,isActive=()=>true,options={}){
  const prepareTimeoutMs=options.prepareTimeoutMs??12000;
  if(!Number.isSafeInteger(prepareTimeoutMs)||prepareTimeoutMs<1||prepareTimeoutMs>30000)throw Error('Landmark preparation timeout must be 1..30000 milliseconds.');
  const selected=pins.filter(pin=>KIT[pin.id]&&Array.isArray(pin._lngLat));
  if(!selected.length)throw Error('No published district destinations');
  if(map.getLayer(ID))throw Error('District landmark layer already installed');
  const loader=new GLTFLoader(),assets=new Map(),ownedGeometry=new Set(),ownedMaterial=new Set(),ownedTexture=new Set();
  const release=()=>{ownedGeometry.forEach(v=>v.dispose());ownedMaterial.forEach(v=>v.dispose());ownedTexture.forEach(v=>{v.source?.data?.close?.();v.dispose();});ownedGeometry.clear();ownedMaterial.clear();ownedTexture.clear();assets.clear();};
  // A provider-associated service already has its real building. Adding a
  // second kit building at ground level would overlap two roofs and make
  // native symbol elevation float the coin above both. Use only a roof sign.
  const names=selected.every(pin=>pin._buildingAssociation?.insideRoof)?[]:[...new Set([...Object.values(KIT).map(v=>v.model),'watertower','car_sedan','streetlight'])];
  let disposed=false,visible=true,prepared=false,preparing,cancelPreparation=null,shaderFailure=null,scene,camera,renderer,origin,local,groups=[];
  const diagnostics={status:'loading',license:'KayKit City Builder Bits CC0',landmarks:[],calls:0,triangles:0,geometries:0,textures:0,renderMs:0,shadows:0,postPasses:0,continuousAnimation:false,shaderPrograms:0,shaderLinked:null,firstFrameRendered:false};
  const publish=()=>{
    if(typeof document!=='object')return;
    if(document.body?.dataset)document.body.dataset.zoneDistrictLandmarks=JSON.stringify(diagnostics);
    const notice=document.getElementById?.('districtSurfaceStatus111'),message=document.getElementById?.('districtSurfaceMessage111');
    const failed=['zoneDistrictSurfaces','zoneDistrictLandmarks'].some(key=>{try{return ['failed','error'].includes(JSON.parse(document.body?.dataset?.[key]||'{}').status);}catch(_){return false;}});
    if(notice){notice.hidden=!failed;if(message&&failed)message.textContent=document.documentElement?.lang==='ar'?'تعذر عرض بعض تفاصيل المباني. الخريطة وأدواتها ما زالت متاحة.':'Some building detail could not render. The map and its controls remain available.';}
  };
  publish();
  try{
    const loads=await Promise.allSettled(names.map(async name=>{
      const gltf=await loader.loadAsync(new URL(name+'.gltf',ROOT).href);
      gltf.scene.traverse(object=>{if(!object.isMesh)return;ownedGeometry.add(object.geometry);object.castShadow=false;object.receiveShadow=false;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        materials.forEach(material=>{ownedMaterial.add(material);material.roughness=.82;material.metalness=.08;material.color.multiplyScalar(.88);Object.values(material).forEach(value=>{if(value?.isTexture)ownedTexture.add(value);});});
      });
      assets.set(name,gltf.scene);
    }));
    const failure=loads.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  }catch(error){release();diagnostics.status='failed';diagnostics.error=String(error.message);publish();throw error;}
  if(!isActive()) {release();diagnostics.status='cancelled';publish();return {setVisible(){},dispose(){},diagnostics,getDiagnostics(){return {...diagnostics,landmarks:diagnostics.landmarks.map(item=>({...item}))};}};}
  origin=mapboxgl.MercatorCoordinate.fromLngLat([-73.9865,40.698],0);
  const meter=origin.meterInMercatorCoordinateUnits();
  local=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(meter,-meter,meter)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  const contactGeometry=new THREE.PlaneGeometry(1,1),contactMaterial=new THREE.MeshBasicMaterial({color:'#141a1c',transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  ownedGeometry.add(contactGeometry);ownedMaterial.add(contactMaterial);
  function model(name,width,tint){
    const object=assets.get(name).clone(true),bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=width/Math.max(size.x,size.z);
    object.scale.setScalar(scale);object.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    if(tint)object.traverse(mesh=>{if(!mesh.isMesh)return;const adapt=material=>{const copy=material.clone();copy.color.multiply(new THREE.Color(tint));ownedMaterial.add(copy);return copy;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(adapt):adapt(mesh.material);});
    const wrapper=new THREE.Group();wrapper.add(object);return wrapper;
  }
  function addMark(parent,kind,width){
    // Service identity is a roof sign, not a decorative new game mechanic.
    const signGeometry=new THREE.BoxGeometry(width,.5,1.5),signMaterial=new THREE.MeshStandardMaterial({color:kind==='hospital'?'#dfded5':'#c4a16b',roughness:.8});
    ownedGeometry.add(signGeometry);ownedMaterial.add(signMaterial);
    const sign=new THREE.Mesh(signGeometry,signMaterial);const height=new THREE.Box3().setFromObject(parent).max.y;sign.position.set(0,height+.45,0);parent.add(sign);
    if(kind==='hospital'){
      const material=new THREE.MeshBasicMaterial({color:'#b44f40'});ownedMaterial.add(material);
      const g=new THREE.BoxGeometry(1.5,.2,5);ownedGeometry.add(g);const cross=new THREE.Mesh(g,material);cross.position.y=height+.85;parent.add(cross);const other=cross.clone();other.rotation.y=Math.PI/2;parent.add(other);
    }
  }
  function build(){
    selected.forEach(pin=>{
      const spec=KIT[pin.id],coord=mapboxgl.MercatorCoordinate.fromLngLat(pin._lngLat,0),group=new THREE.Group();
      group.name='service-'+pin.id;group.position.set((coord.x-origin.x)/meter,.3,(coord.y-origin.y)/meter);group.rotation.y=spec.rotation;
      if(pin._buildingAssociation?.insideRoof){
        const association=pin._buildingAssociation,roof=association.heightMeters,room=Math.max(1,Math.min(6,association.clearanceMeters*1.3));
        const signGeometry=new THREE.BoxGeometry(room,.35,room*.6),signMaterial=new THREE.MeshStandardMaterial({color:spec.color,roughness:.85,metalness:.1});
        ownedGeometry.add(signGeometry);ownedMaterial.add(signMaterial);
        const sign=new THREE.Mesh(signGeometry,signMaterial);sign.position.set(0,roof+.1,0);group.add(sign);
        if(pin.id==='hospital'){
          const crossGeometry=new THREE.BoxGeometry(room*.25,.09,room*.65),crossMaterial=new THREE.MeshBasicMaterial({color:'#b44f40'});ownedGeometry.add(crossGeometry);ownedMaterial.add(crossMaterial);
          const a=new THREE.Mesh(crossGeometry,crossMaterial);a.position.y=roof+.31;group.add(a);const b=a.clone();b.rotation.y=Math.PI/2;group.add(b);
        }
        scene.add(group);groups.push(group);
        diagnostics.landmarks.push({id:pin.id,coordinates:pin._lngLat.slice(),widthMeters:room,heightMeters:roof+.6,symbolOffset:2,
          nativeRoofHeight:roof,providerId:association.providerId,insideRoof:true,model:'actual-provider-building-with-roof-sign',cosmetic:true});
        return;
      }
      const building=model(spec.model,spec.width,spec.color);group.add(building);addMark(building,pin.id,spec.width*.55);
      const contact=new THREE.Mesh(contactGeometry,contactMaterial);contact.rotation.x=-Math.PI/2;contact.scale.set(spec.width*1.08,spec.width*1.04,1);contact.position.y=.02;group.add(contact);
      if(pin.id==='hq'){const tower=model('watertower',8);tower.position.set(-9,0,16);group.add(tower);}
      const car=model('car_sedan',4.5);car.position.set(spec.width*.65,0,-7);group.add(car);
      const lamp=model('streetlight',2);lamp.position.set(spec.width*.6,0,5);group.add(lamp);
      scene.add(group);groups.push(group);
      // Mapbox can elevate symbols onto provider extrusions, but this shared
      // Three.js custom layer is not part of that index. Publish the measured
      // top of the authored roof/sign instead of guessing a screen offset.
      group.updateWorldMatrix(true,true);
      const heightMeters=new THREE.Box3().setFromObject(building).max.y;
      diagnostics.landmarks.push({id:pin.id,coordinates:pin._lngLat.slice(),widthMeters:spec.width,heightMeters,model:spec.model,cosmetic:true});
    });
  }
  function shaderLinkFailure(gl,program,vertex,fragment){
    const logs=[gl.getProgramInfoLog?.(program),vertex&&gl.getShaderInfoLog?.(vertex),fragment&&gl.getShaderInfoLog?.(fragment)].filter(Boolean).join('\n').trim().slice(0,1600);
    diagnostics.shaderLinked=false;
    return Error('Landmark shader link failed'+(logs?': '+logs:'.'));
  }
  function prepareShaders(gl){
    // Own both timers. Cancel them synchronously before material properties or
    // GPU programs are disposed; no vendor material-readiness poller survives.
    return new Promise((resolve,reject)=>{
      let settled=false,pollTimer,deadlineTimer;
      function finish(error){if(settled)return;settled=true;clearTimeout(pollTimer);clearTimeout(deadlineTimer);cancelPreparation=null;if(error)reject(error);else resolve();}
      cancelPreparation=()=>finish();
      function check(){
        if(settled)return;if(disposed||!isActive()){finish();return;}
        try{
          const programs=renderer.info.programs||[];diagnostics.shaderPrograms=programs.length;
          if(!programs.length)throw Error('No compiled landmark shader programs.');
          if(shaderFailure)throw shaderFailure;
          for(const entry of programs){
            if(typeof entry.isReady!=='function'||!entry.program)throw Error('Landmark shader readiness contract differs from the vendored Three runtime.');
            if(!entry.isReady()){pollTimer=setTimeout(check,10);return;}
          }
          for(const entry of programs)if(gl.getProgramParameter(entry.program,gl.LINK_STATUS)===false)shaderFailure=shaderLinkFailure(gl,entry.program);
          if(shaderFailure)throw shaderFailure;
          diagnostics.shaderLinked=true;finish();
        }catch(error){finish(error);}
      }
      deadlineTimer=setTimeout(()=>finish(Error('Landmark preparation timed out.')),prepareTimeoutMs);
      pollTimer=setTimeout(check,10);
    });
  }
  function fail(error){
    if(disposed)return;
    if(map.getLayer(ID))map.removeLayer(ID);else layer.onRemove();
    diagnostics.status='failed';diagnostics.error=String(error.message||error).slice(0,1800);publish();
  }
  const layer={id:ID,type:'custom',renderingMode:'3d',
    onAdd(_map,gl){
      scene=new THREE.Scene();camera=new THREE.Camera();
      scene.add(new THREE.HemisphereLight('#d5dce2','#3a3933',1.7));
      const key=new THREE.DirectionalLight('#ffe4bb',2.5);key.position.set(-100,180,90);scene.add(key);
      const fill=new THREE.DirectionalLight('#a2bdd0',.6);fill.position.set(100,60,-90);scene.add(fill);
      renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
      build();diagnostics.status='preparing';publish();
      // Prepare shaders/textures while the flat vector district is usable,
      // not in the player's first animated Tilt frame. Never clear or draw
      // into Mapbox's shared canvas during this preparation.
      const started=performance.now();
      renderer.debug.checkShaderErrors=true;
      renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{shaderFailure=shaderLinkFailure(gl,program,vertex,fragment);};
      renderer.resetState();
      try{ownedTexture.forEach(texture=>renderer.initTexture?.(texture));renderer.compile(scene,camera);}
      finally{renderer.resetState();}
      preparing=prepareShaders(gl).then(()=>{
        if(disposed)return;
        if(!isActive()){if(map.getLayer(ID))map.removeLayer(ID);else layer.onRemove();return;}
        renderer.resetState();prepared=true;
        diagnostics.prepareMs=Number((performance.now()-started).toFixed(2));diagnostics.status='ready';publish();
        if(isActive())map.triggerRepaint();
      });
    },
    render(_gl,input){
      if(disposed||!prepared||!visible||!isActive()||map.getPitch()<10||map.getZoom()<15.8)return;
      const projection=input?.defaultProjectionData?.mainMatrix||input;if(!projection||projection.length!==16||!Array.from(projection).every(Number.isFinite))return;
      const started=performance.now();camera.projectionMatrix.fromArray(projection).multiply(local);
      let frameFailure=null;
      try{renderer.resetState();renderer.render(scene,camera);if(shaderFailure)throw shaderFailure;diagnostics.firstFrameRendered=true;}
      catch(error){frameFailure=error;}finally{renderer.resetState();}
      if(frameFailure){fail(frameFailure);return;}
      diagnostics.calls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;diagnostics.geometries=renderer.info.memory.geometries;diagnostics.textures=renderer.info.memory.textures;diagnostics.renderMs=Number((performance.now()-started).toFixed(2));publish();
    },
    onRemove(){
      if(disposed)return;disposed=true;prepared=false;cancelPreparation?.();cancelPreparation=null;groups=[];release();renderer?.dispose();diagnostics.status='disposed';publish();
    }
  };
  try{map.addLayer(layer,map.getLayer('zone-poi-halo')?'zone-poi-halo':undefined);await preparing;}catch(error){fail(error);throw error;}
  return {setVisible(value){if(disposed)return;visible=!!value;map.triggerRepaint();},dispose(){if(disposed)return;if(map.getLayer(ID))map.removeLayer(ID);else layer.onRemove();},diagnostics,getDiagnostics(){return {...diagnostics,landmarks:diagnostics.landmarks.map(item=>({...item}))};}};
}

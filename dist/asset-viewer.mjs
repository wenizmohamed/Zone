import * as THREE from '../lib/three184/three.module.js';
import { OrbitControls } from '../lib/three184/OrbitControls.js';
import { loadAsset, normalizeAssetObject } from './asset-loader.mjs';
import { installViewerRuntime } from './viewer-runtime108.mjs';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),id=query.get('asset'),lang=query.get('lang')==='ar'?'ar':'en',ar=lang==='ar';
document.documentElement.lang=lang;document.documentElement.dir=ar?'rtl':'ltr';
if(ar){$('tag').textContent='منشور / زون';$('hint').textContent='اسحب للتدوير. قرّب أو باعد بإصبعين.';$('fit').textContent='إعادة العرض';$('message').textContent='تحميل الأصل…';$('retry').textContent='إعادة المعاينة';}
const canvas=$('asset'),abort=new AbortController();let asset,renderer,scene,camera,controls,runtime,observer,root,disposed=false;
function fit(){if(!root)return;const box=new THREE.Box3().setFromObject(root,true),size=box.getSize(new THREE.Vector3()),target=box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(...asset.transform.cameraTarget));const half=Math.min(THREE.MathUtils.degToRad(36)/2,Math.atan(Math.tan(THREE.MathUtils.degToRad(36)/2)*camera.aspect));const distance=Math.max(.05,size.length()*.6/Math.sin(half));controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(.7,.35,1).normalize().multiplyScalar(distance));camera.near=Math.max(.001,distance/1000);camera.far=Math.max(100,distance*100);controls.minDistance=distance*.1;controls.maxDistance=distance*6;camera.updateProjectionMatrix();controls.update();}
function fail(error){$('status').hidden=false;$('message').textContent=ar?'تعذرت المعاينة. يمكنك مواصلة اللعب أو إعادة المحاولة.':'Preview unavailable. You can keep playing, or retry it.';$('retry').hidden=false;document.body.dataset.zoneAssetError=error?.message||String(error);document.body.dataset.zoneMediaState='error';}
$('retry').addEventListener('click',()=>location.reload());$('fit').addEventListener('click',fit);
addEventListener('pagehide',event=>{if(event.persisted||disposed)return;disposed=true;abort.abort();observer?.disconnect();runtime?.dispose();controls?.dispose();asset?.dispose();renderer?.dispose();});
try{
  // No draft flag: player view always asks for the immutable active-release
  // transform. A later authoring adjustment cannot mutate a published item.
  asset=await loadAsset(id,{signal:abort.signal,onProgress:p=>{$('message').textContent=(ar?'تحميل ':'Loading ')+Math.round(p.loaded/Math.max(1,p.total)*100)+'%';}});
  if(!disposed){$('name').textContent=asset.asset.name;
    if(asset.object){renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;scene=new THREE.Scene();scene.background=new THREE.Color('#252f28');scene.add(new THREE.HemisphereLight('#e5e9df','#48503b',2.5));const light=new THREE.DirectionalLight('#ffdcaa',3.2);light.position.set(3,5,4);scene.add(light);const rim=new THREE.DirectionalLight('#8db6bd',1.8);rim.position.set(-4,2,-3);scene.add(rim);root=normalizeAssetObject(asset.object,asset.transform,2.5);scene.add(root);camera=new THREE.PerspectiveCamera(36,1,.01,1000);controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.1;runtime=installViewerRuntime({canvas,render(){controls.update();renderer.render(scene,camera);},fail});const resize=()=>{renderer.setSize(canvas.clientWidth||innerWidth,canvas.clientHeight||innerHeight,false);camera.aspect=(canvas.clientWidth||innerWidth)/(canvas.clientHeight||innerHeight);fit();};observer=new ResizeObserver(resize);observer.observe(canvas);resize();runtime.start();}
    else{canvas.hidden=true;$('fit').hidden=true;$('hint').textContent='';const holder=$('media');holder.hidden=false;const media=document.createElement(asset.kind==='audio'?'audio':'img');media.src=asset.url;if(asset.kind==='audio'){media.controls=true;media.preload='metadata';}else{media.alt=asset.asset.name;await media.decode();}holder.append(media);document.body.dataset.zoneMediaState='ready';}
    $('status').hidden=true;document.body.dataset.zonePublishedAsset=JSON.stringify({id,kind:asset.kind,transform:asset.transform});parent.postMessage({type:'zone:asset-viewer-ready',assetId:id},location.origin);
  }
}catch(error){if(!disposed)fail(error);}

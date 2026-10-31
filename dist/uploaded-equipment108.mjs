import * as T from '../lib/three184/three.module.js';
import { loadAsset, normalizeAssetObject } from './asset-loader.mjs';
import { validateCharacterWardrobe } from './character-presentation.js';

const HASH = /^[a-f0-9]{64}$/;
export const uploadedAssetId = value => typeof value === 'string' && HASH.test(value) ? value : null;

// Publication selects identity; this adapter changes presentation only. No
// inventory grants, armor reduction, combat results or player resources live here.
export async function loadUploadedCharacter(id, fallback, { loader = loadAsset, publish = () => {}, signal, draft = false } = {}) {
  id = uploadedAssetId(id);
  if (!id) return fallback();
  let media;
  try {
    media = await loader(id, { signal, draft: draft === true });
    if (media.kind !== 'model' || !media.object) throw Error('Character media is not a model');
    validateCharacterWardrobe(T, { scene: media.object, animations: media.animations });
    const scene = normalizeAssetObject(media.object, media.transform, 1.82);
    scene.userData.zoneUploadedAsset = media; scene.userData.zoneCharacterMediaAsset = id;
    publish({ slot: 'character', assetId: id, status: 'ready', representation: 'uploaded-compatible-rig', itemExact: true });
    return { scene, animations: media.animations, uploadedMedia: media };
  } catch (error) {
    media?.dispose();
    if (signal?.aborted) throw error;
    publish({ slot: 'character', assetId: id, status: 'fallback', reason: 'uploaded-rig-unavailable-or-incompatible', itemExact: false });
    return fallback();
  }
}

export function uploadedWeaponFit(object, transform, key) {
  const melee = key === 'bat' || key === 'knife';
  const length = key === 'bat' ? .715 : key === 'knife' ? .22 : /(?:sniper|shotgun|rifle|ak|smg|bullpup)/i.test(key) ? .88 : .29;
  const root = normalizeAssetObject(object, transform, length);
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
  const gripPoint = key === 'bat' ? [center.x, box.min.y + size.y * .10, center.z]
    : key === 'knife' ? [box.min.x + size.x * .20, center.y, center.z]
    : [box.min.x + size.x * .20, box.min.y + size.y * .22, center.z];
  root.userData.zoneOwnedGeometry = true; root.userData.zoneOwnedMaterials = true;
  root.userData.zoneWeaponAsset = { id: 'uploaded', gripPoint, axis: key === 'knife' ? [1,0,0] : melee ? 1 : -1, forward: !melee,
    quality: 'uploaded-model', gripQuality: 'bounds-estimated', itemExact: true };
  return root;
}

export function createUploadedWeaponLoader(base, { loader = loadAsset, publish = () => {} } = {}) {
  let disposed = false;
  const active = new Set(), pending = new Set(), released = new WeakSet();
  return {
    descriptor(key, id) { return uploadedAssetId(id) ? { id: 'uploaded:' + id } : base.descriptor(key); },
    async load(key, id, { draft = false } = {}) {
      id = uploadedAssetId(id);
      if (!id || key === 'fists') return base.load(key);
      const controller = new AbortController(); pending.add(controller); let media;
      try {
        media = await loader(id, { signal: controller.signal, draft: draft === true });
        if (disposed) { media.dispose(); return null; }
        if (media.kind !== 'model' || !media.object) throw Error('Equipment media is not a model');
        const mesh = uploadedWeaponFit(media.object, media.transform, key);
        mesh.userData.zoneUploadHandle = media; mesh.userData.zoneWeaponAsset.id = 'uploaded:' + id;
        active.add(media);
        publish({ slot:'weapon', assetId:id, status:'ready', representation:'uploaded-model', gripQuality:'bounds-estimated', itemExact:true });
        return mesh;
      } catch (error) {
        media?.dispose();
        if (disposed) return null;
        publish({ slot:'weapon', assetId:id, status:'fallback', reason:'uploaded-weapon-unavailable', itemExact:false });
        return base.load(key);
      } finally { pending.delete(controller); }
    },
    release(mesh) {
      const owned = mesh?.userData?.zoneUploadHandle;
      if (owned) { if(released.has(mesh))return;released.add(mesh);mesh.removeFromParent();if(active.delete(owned))owned.dispose(); }
      else base.release(mesh);
    },
    diagnostics() {
      return { disposed, activeUploadCount: active.size, pendingUploadCount: pending.size };
    },
    dispose() { if (disposed) return; disposed=true; pending.forEach(controller=>controller.abort()); pending.clear(); active.forEach(media=>media.dispose()); active.clear(); base.dispose(); }
  };
}

export function createUploadedArmorController(base, { loader = loadAsset, publish = () => {}, queueFrame = () => {} } = {}) {
  let sequence=0, active=null, last='', lastReceipt=null, disposed=false, controller=null;
  const clear=()=>{ controller?.abort(); controller=null; if(active){active.root.removeFromParent();active.media.dispose();active=null;} };
  return {
    async update(packet={}, actor) {
      if(disposed)return;
      const id=uploadedAssetId(packet.armorMediaAsset), eligible=!!actor && !!packet.armorId && packet.armorOwned===true && !!id;
      const key=JSON.stringify([actor?.uuid,eligible?id:null,packet.armorId,packet.armorOwned,packet.draft === true]);
      if(last===key){if(lastReceipt)publish(lastReceipt);return;}
      const current=++sequence;clear();last=key;
      if(!eligible){lastReceipt=null;return base.update(packet,actor);}
      await base.update({...packet,armorId:null,armorOwned:false},actor);
      let media;
      try {
        controller=new AbortController();media=await loader(id,{signal:controller.signal,draft:packet.draft === true});
        if(disposed || current!==sequence){media.dispose();return;}
        if(media.kind!=='model'||!media.object)throw Error('Armor media is not a model');
        let chest;actor.traverse(node=>{if(node.isBone&&/^(chest|torso)$/i.test(node.name))chest??=node;});
        if(!chest)throw Error('Actor has no compatible chest attachment');
        const root=normalizeAssetObject(media.object,media.transform,.70);root.position.y=-.35;chest.add(root);active={root,media};
        lastReceipt={slot:'armor',armorId:packet.armorId,assetId:id,status:'ready',representation:'uploaded-rigid-chest-model',itemExact:true,rigging:'rigid-attachment-not-retargeted'};
        publish(lastReceipt);queueFrame();
      } catch(error) {
        media?.dispose();if(disposed||current!==sequence)return;
        lastReceipt={slot:'armor',armorId:packet.armorId,assetId:id,status:'fallback',reason:'uploaded-armor-unavailable',itemExact:false};publish(lastReceipt);
        await base.update(packet,actor);queueFrame();
      }
    },
    diagnostics(){return {disposed,sequence,hasActiveUpload:!!active,lastReceipt:lastReceipt?{...lastReceipt}:null};},
    dispose(){if(disposed)return;disposed=true;++sequence;clear();base.dispose();}
  };
}

import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { OBJLoader } from '../lib/three184/OBJLoader.js';
import { MTLLoader } from '../lib/three184/MTLLoader.js';
import { prepareCharacterArt, validateCharacterWardrobe, disposeCharacterResources } from './character-presentation.js?v=114';
import { prepareCharacterGrip, applyCharacterGrip, attachHeldWeapon } from './character-grip.js?v=114';
import { prepareWeaponPose, applyWeaponPose, weaponPoseProfile } from './character-poses.js?v=114';
import { createArmorController } from './character-armor.mjs?v=114';
import { createWeaponAssetLoader } from './weapon-assets.js?v=116';
import { loadAsset, normalizeAssetObject } from './asset-loader.mjs';

const OUTFITS = { suit: 'Suit', street: 'Casual_Hoodie', tactical: 'Swat' };
const HASH = /^[a-f0-9]{64}$/;

export function supportedSafehouseOutfits() {
  return Object.keys(OUTFITS);
}

export function isSupportedSafehouseOutfit(outfit) {
  return Object.prototype.hasOwnProperty.call(OUTFITS, outfit);
}

export function resolveSafehouseOutfitFile(outfit) {
  return OUTFITS[outfit] || 'Suit';
}

export function isSafehouseAssetHash(value) {
  return typeof value === 'string' && HASH.test(value);
}

export function defaultSafehouseOutfitFile() {
  return 'Suit';
}

export function supportedSafehouseOutfitCount() {
  return Object.keys(OUTFITS).length;
}

export function safehouseOutfitFileMap() {
  return { ...OUTFITS };
}

export function safehouseActorKey(player = {}, draft = false) {
  return JSON.stringify([player.outfit, player.weapon, player.weaponMediaAsset, player.armorId, player.armorOwned, player.armorMediaAsset, player.characterMediaAsset, Boolean(draft)]);
}

export function safehouseCustomCharacterTargetHeight() {
  return 1.8;
}

export function safehouseCustomWeaponTargetSize() {
  return .65;
}

export function safehouseCustomArmorTargetSize() {
  return .52;
}

export function safehouseCharacterDefaultYaw() {
  return -.15;
}

export function safehouseWeaponSupportPoint() {
  return [.24, .06, 0];
}

export function safehouseArmorTargetBoneName() {
  return 'Chest';
}

export function safehouseCustomArmorRepresentation() {
  return 'uploaded-chest-attachment';
}

export function safehouseCustomArmorTargetOffset() {
  return [0, 1.12, .04];
}

export function safehouseMaxTickDeltaSeconds() {
  return .05;
}

export function safehouseDefaultWeaponKey() {
  return 'fists';
}

export function safehouseDefaultArmorOutfitFile() {
  return 'Swat';
}

export function safehouseDefaultAnimationClipName() {
  return 'Idle';
}

export function safehouseInitialMixerWarmupSeconds() {
  return .01;
}

export function safehouseCustomWeaponGripDescriptor() {
  return { gripPoint: [0, 0, 0], axis: 1, forward: false };
}

export function safehouseMinCharacterHeightEpsilon() {
  return .01;
}

export function createSafehouseCharacter({ scene, catalog = {}, materials = {}, pack = {}, publish = () => {}, wardrobeLoader }) {
  const loader = new GLTFLoader(), wardrobe = wardrobeLoader || (file => loader.loadAsync(new URL(`../assets/character/quaternius/${file}.glb`, import.meta.url).href)), weaponAssets = createWeaponAssetLoader({ THREE, GLTFLoader, OBJLoader, MTLLoader,
    catalog, materials, pack, baseURL: new URL('../assets/weapons/', import.meta.url) });
  let disposed = false, sequence = 0, active = null, armorSource = null, armorPending = null;
  const armorController = createArmorController({ THREE, loadSource: async () => {
    if (armorSource) return armorSource;
    if (!armorPending) armorPending = wardrobe('Swat')
      .then(value => { if (disposed) { disposeCharacterResources([value.scene]); throw Error('Safehouse closed'); } armorSource = value; return value; })
      .finally(() => { armorPending = null; });
    return armorPending;
  }, publish: armor => publish({ armor }) });
  function release(actor) {
    if (!actor) return;
    actor.root?.removeFromParent(); actor.mixer?.stopAllAction(); actor.mixer?.uncacheRoot(actor.root);
    if (actor.held) { actor.held.removeFromParent(); if (!actor.customWeapon) weaponAssets.release(actor.held.userData.zoneGripMesh); }
    actor.customWeapon?.dispose(); actor.customArmor?.dispose();
    if (actor.upload) actor.upload.dispose(); else disposeCharacterResources([actor.root]);
  }
  async function update(player = {}, { draft = false } = {}) {
    const token = ++sequence;
    const key = JSON.stringify([player.outfit, player.weapon, player.weaponMediaAsset, player.armorId, player.armorOwned, player.armorMediaAsset, player.characterMediaAsset, draft]);
    if (active?.key === key) return active;
    const actor = { root: null, held: null, customWeapon: null, customArmor: null, upload: null, mixer: null, key, weapon: player.weapon || 'fists' };
    try {
      const customCharacter = HASH.test(player.characterMediaAsset || '');
      const source = customCharacter ? await loadAsset(player.characterMediaAsset, {draft}) : await wardrobe(OUTFITS[player.outfit] || 'Suit');
      actor.upload = customCharacter ? source : null;
      actor.root = customCharacter ? source.object : source.scene;
      if (!actor.root) throw Error('The character asset contains no 3D geometry');
      if (disposed || token !== sequence) { release(actor); return null; }
      actor.root.userData.outfit = customCharacter ? 'Custom' : OUTFITS[player.outfit] || 'Suit';
      actor.root.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false; } });
      const animations = source.animations;
      const clips = Object.fromEntries(animations.map(clip => [clip.name, clip]));
      if (!customCharacter) { validateCharacterWardrobe(THREE, source); prepareCharacterArt(THREE, actor.root); }
      actor.mixer = new THREE.AnimationMixer(actor.root);
      if (clips.Idle || animations[0]) actor.mixer.clipAction(clips.Idle || animations[0]).play();
      actor.mixer.update(.01); actor.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(actor.root), size = bounds.getSize(new THREE.Vector3());
      if (customCharacter) {
        const scale = 1.8 / Math.max(size.y, .01); actor.root.scale.multiplyScalar(scale);
        actor.root.position.set(-bounds.getCenter(new THREE.Vector3()).x * scale, -bounds.min.y * scale, -bounds.getCenter(new THREE.Vector3()).z * scale);
      } else actor.root.position.y = -bounds.min.y;
      actor.root.rotation.y = -.15;
      try {
        actor.grip = prepareCharacterGrip(THREE, actor.root, clips);
        actor.pose = prepareWeaponPose(THREE, actor.root, actor.grip);
      } catch (error) {
        if (!customCharacter) throw error;
        publish({ warning: 'Custom character is displayed, but has no compatible authored hand rig. Equipment is not falsely shown as held.' });
      }
      if (actor.grip && actor.weapon !== 'fists') {
        let model, descriptor;
        if (HASH.test(player.weaponMediaAsset || '')) {
          actor.customWeapon = await loadAsset(player.weaponMediaAsset, {draft});
          if (!actor.customWeapon.object) throw Error('The equipped weapon asset is not a 3D model');
          model = normalizeAssetObject(actor.customWeapon.object, actor.customWeapon.transform, .65);
          descriptor = { gripPoint: [0, 0, 0], axis: 1, forward: false };
        } else {
          if (!weaponAssets.descriptor(actor.weapon)) throw Error('No retained model for the equipped weapon');
          model = await weaponAssets.load(actor.weapon); descriptor = model.userData.zoneWeaponAsset;
        }
        actor.held = attachHeldWeapon(THREE, actor.grip, model, descriptor.gripPoint, descriptor.axis, descriptor.forward);
        actor.held.userData.zoneSupportPoint = [.24, .06, 0];
      }
      if (disposed || token !== sequence) { release(actor); return null; }
      // Keep the previously visible actor until its replacement and equipment
      // are fully decoded, then switch exactly once. A late upload cannot win.
      const prior = active;
      await armorController.update({armorId:null,armorOwned:false}, prior?.root);
      if (disposed || token !== sequence) { release(actor); return null; }
      active = actor; scene.add(actor.root); release(prior);
      await armorController.update(HASH.test(player.armorMediaAsset || '') ? { ...player, armorOwned:false } : player, actor.root);
      if (HASH.test(player.armorMediaAsset || '') && player.armorOwned === true) {
        const custom = await loadAsset(player.armorMediaAsset, {draft});
        if (disposed || token !== sequence || active !== actor) { custom.dispose(); return null; }
        if (!custom.object) { custom.dispose(); throw Error('The equipped armor asset is not a 3D model'); }
        actor.customArmor = custom;
        const garment = normalizeAssetObject(custom.object, custom.transform, .52);
        const chest = actor.root.getObjectByName('Chest');
        if (!chest) { custom.dispose(); actor.customArmor = null; publish({ warning: 'Custom armor requires a Chest attachment bone.' }); }
        else {
          actor.root.updateMatrixWorld(true);
          const target = new THREE.Vector3(0, 1.12, .04).applyMatrix4(actor.root.matrixWorld);
          garment.position.copy(chest.worldToLocal(target));
          garment.quaternion.copy(chest.getWorldQuaternion(new THREE.Quaternion()).invert());
          chest.add(garment);
          publish({ armor: { armorId: player.armorId, status: 'ready', representation: 'uploaded-chest-attachment', itemExact: true, skinned: false } });
        }
      }
      publish({ status: 'ready', outfit: actor.root.userData.outfit, weapon: actor.weapon,
        uploadedWeapon: actor.customWeapon?.asset.id || null, uploadedCharacter: actor.upload?.asset.id || null, meshInRoom: true });
      return actor;
    } catch (error) {
      if (actor !== active) release(actor);
      if (!disposed && token === sequence) publish({ status: active ? 'retained' : 'error', error: error.message });
      throw error;
    }
  }
  return { update, isDisposed() { return disposed; }, hasActiveActor() { return !!active && !disposed; }, currentSequence() { return sequence; }, activeOutfit() { return active?.root?.userData?.outfit || null; }, diagnostics() {
    return {
      disposed,
      sequence,
      hasActiveActor: !!active,
      activeOutfit: active?.root?.userData?.outfit || null,
      activeWeapon: active?.weapon || null,
      hasArmorSource: !!armorSource,
    };
  }, tick(dt, elapsed) {
    if (!active || disposed) return;
    active.mixer?.update(Math.min(dt, .05));
    if (active.held && active.grip && active.pose) {
      applyCharacterGrip(active.grip);
      applyWeaponPose(active.pose, active.held, { profile: weaponPoseProfile(active.weapon, catalog), action: 'idle', phase: 0, elapsed, dt });
    }
  }, dispose() { if (disposed) return; disposed = true; ++sequence; armorController.dispose(); release(active); active = null;
    weaponAssets.dispose(); if (armorSource) disposeCharacterResources([armorSource.scene]); armorSource = null; } };
}

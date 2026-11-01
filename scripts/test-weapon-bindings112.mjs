import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import {geometryGlb} from '../assets/weapons/source-tools/geometry-audit.mjs';
import {resolveWeaponAsset,weaponThumbnail,createWeaponAssetLoader,
  defaultWeaponRevision,supportedWeaponUpgradeRevisions,isSupportedWeaponUpgradeRevision,
  weaponGamePresentationKeys,weaponGamePresentationCount,supportedWeaponSourceCount,upgradedWeaponKeyCount,
  WEAPON_UPGRADE_SOURCES112,WEAPON_PRESENTATION_UPGRADES112} from '../dist/weapon-assets.js';

const root=new URL('../',import.meta.url),base=new URL('assets/weapons/',root);
const read=path=>readFileSync(new URL(path,root),'utf8');
const manifest=JSON.parse(read('assets/weapons/upgrades112/manifest.json'));
const previous=JSON.parse(read('assets/weapons/upgrades111/manifest.json'));
const historical=JSON.parse(read('assets/weapons/runtime-coverage.json'));
const context=vm.createContext({});vm.runInContext(read('assets/weapons/catalog.js'),context);
const catalog=context.ZONE_WEAPONS;
const expected={sniperrifle_2:'dragunov-detail112',sniperrifle_5:'dragunov-detail112',
  sniperrifle_3:'mosin9130-detail112',sniperrifle_6:'mosin9130-detail112'};

test('explicit112 sniper bindings use the two new sources while v99/v111 remain historical views',()=>{
  assert.deepEqual(WEAPON_PRESENTATION_UPGRADES112,expected);assert.deepEqual(manifest.bindings,expected);
  for(const record of historical.records){
    const current=resolveWeaponAsset(record.key,catalog,{revision:112}),v111=resolveWeaponAsset(record.key,catalog,{revision:111}),v99=resolveWeaponAsset(record.key,catalog,{revision:99});
    assert.equal(v99.id,record.sourceId);assert.equal(v99.thumbnail,record.thumbnail);
    assert.equal(current.category,v111.category);assert.equal(current.requestedKey,record.key);
    if(expected[record.key]){
      assert.equal(current.id,expected[record.key]);assert.equal(current.revision,112);assert.equal(current.originalSourceId,v99.id);
      assert.equal(v111.id,v99.id);assert.equal(v111.thumbnail,v99.thumbnail);
      const receipt=manifest.assets.find(asset=>asset.id===current.id);
      assert.equal(current.url,'upgrades112/'+current.id+'.glb');assert.equal(current.thumbnail,receipt.thumbnail);
      assert.equal(current.license,receipt.license);assert.equal(current.author,receipt.author);
      assert.deepEqual(current.grip,[0,0,0]);assert.deepEqual(current.rotation,[0,0,0]);assert.equal(current.scale,1);
      assert.equal(current.category,'sniper');assert.equal(current.quality,'adapted-pbr');
      assert.equal(current.thumbnailCapture,'offline-Blender-Cycles-exported-GLB');assert.equal(current.browserCaptureStatus,'pending-review');
      assert.match(current.materialLineage,/LonesomeDucky/);assert.match(current.materialLineage,/wood/);
      assert.equal(weaponThumbnail(record.key,{revision:111}),v99.thumbnail);
    }else assert.deepEqual(current,v111,record.key+' changed outside the four-key scope');
  }
  for(const [key,id]of Object.entries(previous.bindings))assert.equal(resolveWeaponAsset(key,catalog).id,id);
  assert.equal(Object.keys(WEAPON_UPGRADE_SOURCES112).length,2);
  assert.equal(defaultWeaponRevision(),116);
  assert.deepEqual(supportedWeaponUpgradeRevisions(),[111,112,116]);
  assert.equal(isSupportedWeaponUpgradeRevision(112),true);
  assert.equal(isSupportedWeaponUpgradeRevision(99),false);
  assert.equal(weaponGamePresentationCount(),40);
  assert.equal(weaponGamePresentationKeys().length,40);
  assert.equal(supportedWeaponSourceCount(),20);
  assert.equal(upgradedWeaponKeyCount(112),11);
  assert.equal(upgradedWeaponKeyCount(116),14);
});

test('classic game thumbnails and authored-model overrides match the actual current runtime, not the old source image',()=>{
  for(const record of historical.records){
    assert.equal(context.zoneWeaponThumbnail(record.key),weaponThumbnail(record.key));
    assert.equal(context.zoneWeaponThumbnail('owner-created-item',record.key),weaponThumbnail(record.key));
  }
  for(const key of ['constructor','__proto__','../private','unknown']){
    assert.equal(context.zoneWeaponThumbnail(key),null);
    for(const revision of [99,111,112])assert.equal(resolveWeaponAsset(key,catalog,{revision}),null);
  }
});

test('normal shared loader resolves four sniper selections into two actual GLBs with correct per-item identities',async()=>{
  const urls=[];
  const loader=createWeaponAssetLoader({THREE,catalog,baseURL:base.href,GLTFLoader:class{async loadAsync(url){urls.push(url);return geometryGlb(fileURLToPath(new URL(url)));}}});
  const objects=await Promise.all(Object.keys(expected).map(key=>loader.load(key)));
  assert.equal(urls.length,2);assert.ok(urls.every(url=>url.startsWith(base.href+'upgrades112/')));
  for(const [index,object]of objects.entries()){
    const key=Object.keys(expected)[index];assert.equal(object.userData.zoneWeaponAsset.requestedKey,key);
    assert.equal(object.userData.zoneWeaponAsset.id,expected[key]);assert.equal(object.userData.zoneWeaponAsset.thumbnail,weaponThumbnail(key));
    assert.ok(new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x>1.1);
    loader.release(object);
  }
  await loader.dispose();
});

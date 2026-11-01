import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { OBJLoader } from '../lib/three184/OBJLoader.js';
import { MTLLoader } from '../lib/three184/MTLLoader.js';
import { geometryGlb } from '../assets/weapons/source-tools/geometry-audit.mjs';
import { catalogMaterialProfile, createWeaponAssetLoader, inspectWeaponObject, resolveWeaponAsset, normalizeWeaponAsset, weaponCategory, weaponPresentationLabel } from '../dist/weapon-assets.js';
import { acceptedWeaponStudioIds, computeWeaponFrame, isAcceptedWeaponStudioId, isSupportedStudioProfileName, supportedStudioProfileNames, weaponStudioProfile } from '../dist/weapon-presentation.js';

const root = new URL('../', import.meta.url), context = vm.createContext({});
vm.runInContext(readFileSync(new URL('assets/weapons/catalog.js', root), 'utf8'), context);
vm.runInContext(readFileSync(new URL('assets/weapons/pack.js', root), 'utf8'), context);
const game = JSON.parse(readFileSync(new URL('engine/data/gameplay-catalog.json', root), 'utf8'));
const weapons = Object.entries(game.items).filter(([, item]) => item.type === 'weapon').map(([key]) => key);
const coverage = JSON.parse(readFileSync(new URL('assets/weapons/runtime-coverage.json', root), 'utf8'));
const upgrades111 = JSON.parse(readFileSync(new URL('assets/weapons/upgrades111/manifest.json', root), 'utf8'));
const upgrades112 = JSON.parse(readFileSync(new URL('assets/weapons/upgrades112/manifest.json', root), 'utf8'));
const upgrades116 = JSON.parse(readFileSync(new URL('assets/weapons/upgrades116/manifest.json', root), 'utf8'));
const currentAssets = [...upgrades111.assets,...upgrades112.assets,...upgrades116.assets];
const digest = data => createHash('sha256').update(data).digest('hex');

test('retained emergency fallback preserves registered metal, polymer, wood and glass palette properties',()=>{
  for(const name of ['Black','Black2','Plastic','Wood','DarkWood','Glass','Metal','LightMetal']) {
    const profile=catalogMaterialProfile(name,context.ZONE_WEAPON_MATS),original=context.ZONE_WEAPON_MATS[name];
    assert.equal(profile.color,original.color);assert.equal(profile.roughness,original.roughness);assert.equal(profile.metalness,original.metalness);
  }
  assert.ok(catalogMaterialProfile('Plastic',context.ZONE_WEAPON_MATS).metalness<.1);
  assert.ok(catalogMaterialProfile('Metal',context.ZONE_WEAPON_MATS).metalness>.8);
});

test('all 51 gameplay identities retain category and engine rules while source reuse is disclosed honestly', () => {
  assert.equal(weapons.length,51);
  const sources=new Set(),categories=new Set();
  for(const key of weapons) {
    const d=resolveWeaponAsset(key,context.ZONE_WEAPONS),record=coverage.records.find(r=>r.key===key);
    assert.ok(d?.url && !d.format, key+' must use a retained real GLB, not a raw OBJ default');
    assert.equal(d.requestedKey,key);assert.equal(d.category,weaponCategory(key,context.ZONE_WEAPONS));
    const historical=resolveWeaponAsset(key,context.ZONE_WEAPONS,{revision:99});
    assert.equal(historical.id,record.sourceId);assert.equal(historical.thumbnail,'/assets/weapons/thumbnails/'+key+'.png');
    const currentReceipt=Object.hasOwn(upgrades116.bindings,key)?upgrades116:Object.hasOwn(upgrades112.bindings,key)?upgrades112:upgrades111;
    if(Object.hasOwn(currentReceipt.bindings,key)){
      assert.equal(d.id,currentReceipt.bindings[key]);assert.equal(d.originalSourceId,historical.id);
      assert.ok(d.thumbnail.startsWith('/assets/weapons/upgrades'+currentReceipt.revision+'/'));
      assert.equal(d.thumbnailCapture,currentReceipt.revision>=112?'offline-Blender-Cycles-exported-GLB':'offline-Blender-Cycles');
    }else{assert.equal(d.id,historical.id);assert.equal(d.thumbnail,historical.thumbnail);}
    assert.ok(!d.aiAssisted && !d.id.startsWith('polyy-'),key);
    sources.add(d.id);categories.add(d.category);
  }
  assert.equal(sources.size,20);assert.equal(coverage.uniqueRenderedAssets,sources.size);assert.equal(categories.size,9);
});

test('accepted five use exact original studio profile, not the new material adaptation lighting', () => {
  assert.deepEqual(acceptedWeaponStudioIds(), ['old-wooden-bat', 'detective-special', 'akm', 'derringer', 'm9-knife']);
  assert.equal(isAcceptedWeaponStudioId('akm'), true);
  assert.equal(isAcceptedWeaponStudioId('mosin9130'), false);
  assert.deepEqual(supportedStudioProfileNames(), ['accepted-reference', 'realistic-readable']);
  assert.equal(isSupportedStudioProfileName('accepted-reference'), true);
  assert.equal(isSupportedStudioProfileName('realistic-readable'), true);
  assert.equal(isSupportedStudioProfileName('custom'), false);
  for(const key of ['revolver','pistol','ak','bat','knife']) {
    const profile=weaponStudioProfile(resolveWeaponAsset(key,context.ZONE_WEAPONS));
    assert.deepEqual(profile,{name:'accepted-reference',background:0x171b20,exposure:1.04,environment:.8,key:2.4,fill:.85,rim:2,hemisphere:0});
  }
});

test('retained v99 adapted Tabasco finishes preserve their exact reviewed material and CC0 wood lineage', () => {
  const representatives=['assaultrifle_2','bullpup_1','pistol_2','sniperrifle_2','sniperrifle_3'];
  for(const key of representatives) {
    const d=resolveWeaponAsset(key,context.ZONE_WEAPONS,{revision:99}),bytes=readFileSync(new URL('assets/weapons/'+d.url,root));
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.match(d.quality,/^adapted-/);assert.match(d.materialLineage,/ZONE/);
    assert.doesNotMatch(weaponPresentationLabel(d,'en'),/DETAILED MODEL|AUTHORED MODEL \/ COLOR MATERIALS/);
    const metal=gltf.materials.filter(m=>m.name.startsWith('ZONE_blued_steel_'));
    assert.ok(metal.length,key+' needs separated blued-metal material');
    for(const material of metal) {
      const pbr=material.pbrMetallicRoughness;
      for(const [index,target] of [.045,.060,.075].entries())assert.ok(Math.abs(pbr.baseColorFactor[index]-target)<1e-6,'Blued finish must remain readable midtone, not pale chrome or near-black');
      assert.ok(pbr.metallicFactor>=.8 && pbr.roughnessFactor>=.45);
    }
    if(['pistol_2','sniperrifle_2','sniperrifle_3'].includes(key)) {
      const wood=gltf.materials.filter(m=>m.name.startsWith('ZONE_adapted_walnut_'));
      assert.ok(wood.length);for(const material of wood) {
        assert.ok(material.normalTexture && material.pbrMetallicRoughness.baseColorTexture);
        assert.equal(material.pbrMetallicRoughness.metallicFactor,0);
        assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor,[.26,.20,.42,1],'Walnut factor neutralizes the original yellow ash tone without changing source detail');
      }
      assert.ok(gltf.images.every(image=>!/(TexturesCom|doubleBarrelD)/i.test(image.name||'')));
    } else {
      const polymer=gltf.materials.filter(m=>m.name.startsWith('ZONE_matte_polymer_'));
      assert.ok(polymer.length);
      for(const material of polymer) {
        assert.ok(Math.max(...material.pbrMetallicRoughness.baseColorFactor.slice(0,3))<=.032);
        assert.ok(material.pbrMetallicRoughness.roughnessFactor>=.8);
      }
    }
  }
});

test('actual retained meshes fit every gameplay identity in desktop, phone and 320x200 thumbnail framing',async()=>{
  for(const key of weapons) {
    const d=resolveWeaponAsset(key,context.ZONE_WEAPONS);
    const object=normalizeWeaponAsset(THREE,(await geometryGlb(fileURLToPath(new URL('assets/weapons/'+d.url,root)))).scene,d);
    const inspection=inspectWeaponObject(THREE,object),record=coverage.records.find(r=>r.key===key);
    assert.ok(inspection.meshes>0 && inspection.triangles>100,key);
    const upgraded=currentAssets.find(asset=>asset.id===d.id);
    assert.equal(inspection.meshes,upgraded?upgraded.primitives:record.meshes);assert.equal(inspection.triangles,upgraded?upgraded.triangles:record.triangles);
    if(key==='bat')object.rotation.z=-.95; // Actual thumbnail-only pose; normal viewer is untouched.
    const box=new THREE.Box3().setFromObject(object);
    for(const aspect of [1.9,390/330,320/200]) {
      const frame=computeWeaponFrame(THREE,box,aspect),camera=new THREE.PerspectiveCamera(38,aspect,frame.near,frame.far);
      camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
        const point=new THREE.Vector3(x,y,z).project(camera);
        assert.ok(Math.abs(point.x)<1 && Math.abs(point.y)<1 && Math.abs(point.z)<1,key+' clipped at '+aspect);
      }
    }
  }
});

test('all retained v99 PNGs are source-linked actual WebGL captures with exact historical pixels and diagnostics',()=>{
  assert.equal(coverage.status,'captured-local-review');
  assert.equal(coverage.thumbnailCapture,'actual-browser-WebGL-PNG');
  assert.equal(coverage.runtimeWeapons,51);assert.equal(coverage.pbrMapsBakedInThumbnails,true);
  assert.deepEqual(coverage.records.map(r=>r.key).sort(),weapons.slice().sort());
  for(const record of coverage.records) {
    const source=readFileSync(new URL(record.modelPath,root)),png=readFileSync(new URL(record.thumbnail.slice(1),root));
    assert.equal(digest(source),record.sourceSha256,record.key);assert.equal(source.length,record.sourceBytes);
    assert.equal(record.thumbnailStatus,'captured-from-real-viewer');
    assert.equal(digest(png),record.thumbnailSha256);assert.equal(png.length,record.thumbnailBytes);
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(png.readUInt32BE(16),320);assert.equal(png.readUInt32BE(20),200);
    assert.equal(record.thumbnailWidth,320);assert.equal(record.thumbnailHeight,200);
    assert.ok(record.browserFrame && record.browserLighting && record.browserInspection?.meshes>0);
    assert.equal(record.browserInspection.meshes,record.meshes);assert.equal(record.browserInspection.triangles,record.triangles);
    assert.ok(record.browserInspection.materials.length>0);
    assert.equal(record.browserLighting.environment,record.expectedLighting.environment);
    assert.equal(record.browserLighting.exposure,record.expectedLighting.exposure);
    if(record.quality==='authored-pbr')assert.ok(record.browserInspection.materials.some(m=>m.maps.includes('map')&&m.maps.includes('normalMap')));
    if(record.key==='bat') {
      const pose=typeof record.thumbnailPose==='string'?JSON.parse(record.thumbnailPose):record.thumbnailPose;
      assert.equal(pose.rotationZ,-.95);assert.equal(pose.scope,'thumbnail-only');assert.equal(pose.sourceId,'old-wooden-bat');
    }
    assert.equal(record.license,'CC0-1.0');assert.match(record.source,/^https:\/\//);
  }
});

test('shared-source aliases deduplicate network loads without copying the first gameplay identity',async()=>{
  let requests=0;
  const loader=createWeaponAssetLoader({THREE,catalog:context.ZONE_WEAPONS,GLTFLoader:class{
    async loadAsync(){requests++;return{scene:new THREE.Mesh(new THREE.BoxGeometry(.3,.1,.04),new THREE.MeshStandardMaterial())};}
  }});
  const [first,second]=await Promise.all([loader.load('pistol_1'),loader.load('pistol_5')]);
  assert.equal(requests,1);assert.equal(first.userData.zoneWeaponAsset.id,second.userData.zoneWeaponAsset.id);
  assert.equal(loader.diagnostics().cachedAssetCount,1);
  assert.equal(loader.diagnostics().disposed,false);
  assert.equal(first.userData.zoneWeaponAsset.requestedKey,'pistol_1');assert.equal(second.userData.zoneWeaponAsset.requestedKey,'pistol_5');
  assert.equal(first.userData.zoneWeaponAsset.thumbnail,'/assets/weapons/thumbnails/pistol_1.png');
  assert.equal(second.userData.zoneWeaponAsset.thumbnail,'/assets/weapons/thumbnails/pistol_5.png');
  loader.release(first);loader.release(second);await loader.dispose();
  assert.equal(loader.diagnostics().disposed,true);
  assert.equal(loader.diagnostics().cachedAssetCount,0);
});

test('classic helper supports owner model overrides and rejects prototype/path inputs',()=>{
  assert.equal(context.zoneWeaponThumbnail('shotgun'),'/assets/weapons/thumbnails/shotgun.png');
  assert.equal(context.zoneWeaponThumbnail('owner-created-item','sniperrifle_6'),'/assets/weapons/upgrades112/mosin9130-thumbnail.png');
  for(const key of ['unknown','constructor','__proto__','../private','https://other.test/image.png'])assert.equal(context.zoneWeaponThumbnail(key),null);
  assert.equal(Object.keys(context.ZONE_WEAPON_THUMBNAILS).length,51);
  for(const key of ['constructor','__proto__','toString','unknown'])assert.equal(resolveWeaponAsset(key,context.ZONE_WEAPONS),null);
});

test('serialized inspector exposes actual source diagnostics and thumbnail mode preserves normal viewer controls',()=>{
  const html=readFileSync(new URL('dist/weapon3d.html',root),'utf8');
  const template=JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  assert.match(template,/root.userData.zoneWeaponAsset = \{ \.\.\.g.userData.zoneWeaponAsset \}/);
  assert.match(template,/inspection:inspectAsset\(THREE, g\)/);assert.match(template,/requestedKey: String\(key\)/);
  assert.match(template,/weapon-assets\.js\?v=116/);
  assert.match(template,/stage.dataset.zoneThumbnail = 'true'/);
  assert.match(template,/\.toolbar,\.note\{display:none!important\}/);
  assert.match(template,/stage.dataset.zoneThumbnail === 'true' && id === 'bat'/);
  assert.match(template,/root.rotation.z = -0.95/);
});

test('narrow inspector credit badge stays above actual wrapped EN/AR export controls without moving the desktop badge', () => {
  const html = readFileSync(new URL('dist/weapon3d.html', root), 'utf8');
  const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  assert.match(template, /@media\(max-width:640px\)\{#asset-quality\{bottom:64px\}\}/);
  assert.match(template, /qualityLayoutObserver\.observe\(exportToolbar\)/);
  assert.match(template, /qualityLayoutObserver\.disconnect\(\)/);
  const start = template.indexOf('function assetQualityOffset('), end = template.indexOf('function paintAssetQuality(', start);
  assert.ok(start >= 0 && end > start);
  let width = 310, toolbarHeight = 44;
  const toolbar = { getBoundingClientRect: () => ({ top: 270 - 12 - toolbarHeight, bottom: 258, height: toolbarHeight }) };
  const stage = { isConnected: true, getBoundingClientRect: () => ({ width, bottom: 270 }), shadowRoot: { querySelector: selector => selector === '.toolbar' ? toolbar : null } };
  const qualityBadge = { isConnected: true, hidden: false, textContent: 'Author / CC0', style: {} };
  const ctx = vm.createContext({ stage, qualityBadge }); vm.runInContext(template.slice(start, end), ctx);
  for (const language of ['en', 'ar']) for (const [stageWidth, height] of [[310, 44], [280, 60], [220, 92], [640, 40]]) {
    width = stageWidth; toolbarHeight = height; ctx.positionAssetQuality();
    const badgeBottom = 270 - parseFloat(qualityBadge.style.bottom);
    assert.ok(toolbar.getBoundingClientRect().top - badgeBottom >= 8, `${language}/${stageWidth}/${height}: credit overlays an export target`);
    assert.equal(qualityBadge.hidden, false); assert.equal(qualityBadge.textContent, 'Author / CC0');
  }
  width = 1000; toolbarHeight = 44; ctx.positionAssetQuality(); assert.equal(qualityBadge.style.bottom, '12px');
  qualityBadge.style.bottom = 'unchanged'; stage.isConnected = false; ctx.positionAssetQuality(); assert.equal(qualityBadge.style.bottom, 'unchanged');
});



test('emergency fallback credits the shown OBJ and never links a PNG of a different detailed source',async t=>{
  t.mock.method(console,'warn',()=>{});
  const loader=createWeaponAssetLoader({THREE,OBJLoader,MTLLoader,catalog:context.ZONE_WEAPONS,
    materials:context.ZONE_WEAPON_MATS,pack:context.ZONE_WEAPON_PACK,
    GLTFLoader:class{async loadAsync(){throw new Error('injected unavailable detailed model');}}});
  const object=await loader.load('revolver'),d=object.userData.zoneWeaponAsset;
  assert.equal(d.id,'Revolver_1');assert.equal(d.author,'Quaternius');
  assert.equal(d.quality,'catalog-stylized');assert.equal(d.fallbackFor,'detective-special');
  assert.equal(d.thumbnail,null,'Detailed game PNG does not depict the emergency OBJ');
  assert.ok(inspectWeaponObject(THREE,object).triangles>100);
  loader.release(object);await loader.dispose();
});

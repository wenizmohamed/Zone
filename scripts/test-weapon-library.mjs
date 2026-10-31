import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { computeWeaponFrame } from '../dist/weapon-presentation.js';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('dist/weapon-library.html', root), 'utf8');
const source = html.match(/<script type="module" id="library-code">([\s\S]*?)<\/script>/)[1];
const manifest = JSON.parse(readFileSync(new URL('assets/weapons/library/manifest.json', root), 'utf8'));
function functionSource(name) {
  const start=source.indexOf('function '+name+'(');
  // The first brace can be a destructured parameter, not the function body.
  const signatureEnd=source.indexOf(')',start), open=source.indexOf('{',signatureEnd+1); let depth=0,quote='',escaped=false;
  assert.ok(start>=0,`Missing shipped function ${name}`);
  assert.ok(signatureEnd>start && open>signatureEnd,`Missing function body ${name}`);
  for(let i=open;i<source.length;i++) { const c=source[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}if(['"',"'",'`'].includes(c)){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(start,i+1); }
  throw new Error('Unterminated '+name);
}
const context = createContext({ console, THREE, AbortController });
runInContext(['isModernArmoryModel','initialLibrarySelection','filterModels','summarizeLibraryCollection','disposeModel','normalizeLibraryModel','createModelSelection'].map(functionSource).join('\n'), context);
function bytesFor(model) {
  assert.match(model.modelUrl,/^\/assets\/weapons\/library\/models\/[a-z0-9_-]+\.glb$/);
  return readFileSync(new URL(model.modelUrl.slice(1),root));
}
function dataFor(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let json,bin;
  for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);offset+=8;assert.equal(length%4,0);assert.ok(offset+length<=bytes.length);if(type===0x4e4f534a)json=JSON.parse(bytes.toString('utf8',offset,offset+length));else if(type===0x004e4942)bin=bytes.subarray(offset,offset+length);offset+=length;}
  assert.ok(json&&bin);return {json,bin};
}
function geometryBytes(bytes) {
  const data=dataFor(bytes).json;delete data.materials;delete data.textures;delete data.images;delete data.samplers;
  for(const mesh of data.meshes||[])for(const primitive of mesh.primitives)delete primitive.material;
  const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const tail=bytes.subarray(20+bytes.readUInt32LE(12)),result=Buffer.alloc(20+padded.length+tail.length);
  result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);tail.copy(result,20+padded.length);
  return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);
}

test('library source parses and all viewer imports resolve to retained local modules',()=>{
  new Function(source.replace(/^import .*;\r?$/gm,''));
  for(const [,ref]of source.matchAll(/^import .*?from ['"]([^'"]+)['"]/gm))assert.ok(existsSync(new URL(ref,new URL('dist/weapon-library.html',root))),ref);
  assert.match(html,/not automatically equipped, balanced, or hand-rigged/);
});

test('at least400 distinct retained models have matching bytes, hashes, attribution and self-contained resources',()=>{
  assert.ok(manifest.models.length>=400);assert.equal(manifest.models.length,manifest.counts.models);
  assert.equal(new Set(manifest.models.map(m=>m.id)).size,manifest.models.length);
  assert.equal(new Set(manifest.models.map(m=>m.geometryHash)).size,manifest.models.length);
  let bytesTotal=0;
  for(const model of manifest.models){
    const bytes=bytesFor(model);assert.equal(bytes.length,model.bytes,model.id);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256,model.id);bytesTotal+=bytes.length;
    assert.ok(model.name&&model.category&&model.author&&model.source?.title);assert.equal(model.license,'CC0-1.0');assert.match(model.sourceUrl,/^https:\/\//);assert.match(model.licenseUrl,/^https:\/\//);assert.match(model.geometryHash,/^[a-f0-9]{64}$/);
    const {json,bin}=dataFor(bytes);assert.ok((json.meshes||[]).length>0,model.id);
    for(const buffer of json.buffers||[]){assert.ok(!buffer.uri,`${model.id} external buffer`);assert.ok(buffer.byteLength<=bin.length);}
    for(const view of json.bufferViews||[])assert.ok((view.byteOffset||0)+view.byteLength<=bin.length,`${model.id} invalid buffer view`);
    for(const image of json.images||[]){assert.ok(!image.uri||image.uri.startsWith('data:'),`${model.id} external image`);if(!image.uri)assert.ok(json.bufferViews[image.bufferView]?.byteLength>0);}
    assert.ok(!(json.extensionsRequired||[]).some(name=>['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(name)),`${model.id} requires an unavailable decoder`);
  }
  assert.equal(bytesTotal,manifest.counts.bytes);
});

test('search/category/style/source filters use actual manifest records and combine correctly',()=>{
  const chosen=manifest.models[0],filters={query:chosen.name.toUpperCase(),category:chosen.category,style:chosen.styles[0],source:chosen.source.title};
  const found=context.filterModels(manifest.models,filters);assert.ok(found.some(m=>m.id===chosen.id));
  assert.ok(found.every(m=>m.category===filters.category&&m.styles.includes(filters.style)&&m.source.title===filters.source));
  assert.equal(context.filterModels(manifest.models,{query:'no_such_model_9487923'}).length,0);
  assert.equal(context.filterModels(manifest.models,{}).length,manifest.models.length);
});

test('default collection starts on a textured modern M4A1 while the full archive remains accessible',()=>{
  const initial=context.initialLibrarySelection(manifest.models,null);
  assert.equal(initial.id,'cc0-guns-explosives-pack-glb--m4a1');
  const actual=dataFor(bytesFor(initial)).json;
  assert.ok(initial.styles.includes('textured PBR'));assert.ok(actual.images.length>=3);
  assert.ok(actual.materials.some(material=>material.pbrMetallicRoughness?.baseColorTexture&&material.normalTexture));
  const curated=context.filterModels(manifest.models,{collection:'modern'});
  assert.ok(curated.length>20&&curated.length<manifest.models.length);
  assert.ok(curated.every(model=>model.styles.includes('textured PBR')));
  assert.equal(context.filterModels(manifest.models,{collection:'all'}).length,424);
  const fantasy=manifest.models.find(model=>model.id.startsWith('30-unique-lowpoly-swords'));
  assert.equal(context.initialLibrarySelection(manifest.models,fantasy.id).id,fantasy.id,'explicit advanced source URLs remain valid');
});

test('all actual model geometries normalize their mixed units and fit desktop plus phone cameras',async()=>{
  let triangles=0;
  for(const model of manifest.models){
    const gltf=await new GLTFLoader().parseAsync(geometryBytes(bytesFor(model)),'');
    const normalized=context.normalizeLibraryModel(THREE,gltf.scene),center=normalized.box.getCenter(new THREE.Vector3()),size=normalized.box.getSize(new THREE.Vector3());
    assert.ok(center.length()<1e-4,`${model.id} off-center`);assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-2.8)<1e-4,`${model.id} wrong normalized span`);
    let modelTriangles=0;normalized.root.traverse(object=>{if(object.isMesh)modelTriangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;});
    assert.ok(modelTriangles>0,`${model.id} blank geometry`);triangles+=modelTriangles;
    for(const aspect of [1.9,390/330]){
      const fit=computeWeaponFrame(THREE,normalized.box,aspect),camera=new THREE.PerspectiveCamera(38,aspect,fit.near,fit.far);camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld(true);
      for(const x of [normalized.box.min.x,normalized.box.max.x])for(const y of [normalized.box.min.y,normalized.box.max.y])for(const z of [normalized.box.min.z,normalized.box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,`${model.id} clipped at aspect${aspect}`);}
    }
    context.disposeModel(normalized.root);
  }
  assert.equal(triangles,manifest.counts.triangles);
});

test('rapid selection and teardown never display stale models and dispose every superseded result',async()=>{
  const pending=new Map(),displayed=[],disposed=[],states=[];
  const selection=context.createModelSelection({load:model=>new Promise(resolve=>pending.set(model,resolve)),dispose:object=>disposed.push(object),display:object=>displayed.push(object),state:state=>states.push(state)});
  const a=selection.select('A'),b=selection.select('B');pending.get('B')('objectB');await b;pending.get('A')('objectA');await a;
  assert.deepEqual(displayed,['objectB']);assert.deepEqual(disposed,['objectA']);
  const c=selection.select('C');assert.deepEqual(disposed,['objectA','objectB']);selection.dispose();pending.get('C')('objectC');await c;
  assert.deepEqual(disposed,['objectA','objectB','objectC']);assert.equal(await selection.select('D'),false);assert.equal(states.filter(s=>s==='ready').length,1);
});

test('failed loads expose error state and can be retried without keeping old resources',async()=>{
  let attempts=0;const states=[];
  const selection=context.createModelSelection({load:async()=>{if(++attempts===1)throw new Error('offline');return{};},dispose(){},display(){},state:state=>states.push(state)});
  assert.equal(await selection.select('A'),false);assert.equal(await selection.select('A'),true);
  assert.deepEqual(states,['loading','error','loading','ready']);selection.dispose();
});

test('owned shared geometry, PBR maps and decoded images dispose once each',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),image={close(){count.image++;}},texture=new THREE.Texture(image),material=new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture,metalnessMap:texture});
  const count={geometry:0,material:0,texture:0,image:0};geometry.addEventListener('dispose',()=>count.geometry++);material.addEventListener('dispose',()=>count.material++);texture.addEventListener('dispose',()=>count.texture++);
  root.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,[material,material]));context.disposeModel(root);assert.deepEqual(count,{geometry:1,material:1,texture:1,image:1});
});

test('summarizeLibraryCollection computes exact triangles, bytes, textured PBR count, and category histogram', () => {
  const summary = context.summarizeLibraryCollection(manifest.models);
  assert.equal(summary.count, manifest.counts.models);
  assert.equal(summary.totalTriangles, manifest.counts.triangles);
  assert.equal(summary.totalBytes, manifest.counts.bytes);
  assert.ok(summary.texturedCount > 20);
  assert.ok(summary.categories.firearm > 0 && summary.categories.melee > 0);
});

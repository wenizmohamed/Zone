import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import {normalizeAssetObject} from '../dist/asset-loader.mjs';
import {supportedSafehouseOutfits, isSupportedSafehouseOutfit, resolveSafehouseOutfitFile, isSafehouseAssetHash, defaultSafehouseOutfitFile, supportedSafehouseOutfitCount, safehouseOutfitFileMap, safehouseActorKey, safehouseCustomCharacterTargetHeight, safehouseCustomWeaponTargetSize, safehouseCustomArmorTargetSize, safehouseCharacterDefaultYaw, safehouseWeaponSupportPoint} from '../dist/safehouse-character.mjs';

const html=readFileSync(new URL('../dist/safehouse.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../dist/safehouse.mjs',import.meta.url),'utf8');
const HASH='a'.repeat(64),origin='http://safehouse.test';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
class Node {
  constructor(attrs={}){this.attrs={...attrs};this.style={};this.dataset={};this.handlers=new Map();this.disabled=attrs.disabled===true;this.hidden=attrs.hidden===true;this.textContent='';this.clientWidth=341;this.clientHeight=600;this.naturalWidth=88;this.children=new Map();this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);}
  removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of [...(this.handlers.get(type)||[])])fn(event);}
  click(){if(!this.disabled)this.emit('click');}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
  get offsetWidth(){return Math.min(this.naturalWidth,Number.parseFloat(this.style.maxWidth)||Infinity);}
  get offsetHeight(){return 44;}
  getBoundingClientRect(){const width=this.offsetWidth,height=this.offsetHeight,left=Number.parseFloat(this.style.left||0)-width/2,top=Number.parseFloat(this.style.top||0)-height/2;return{left,right:left+width,top,bottom:top+height,width,height};}
}
function attributes(tag){const result={};for(const m of tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g))result[m[1]]=m[2]??true;return result;}
function harness({rendererError=false,lang='en',standalone=false}={}){
  const nodes=new Map(),pins=[],posted=[],reloads=[],orbits=[],assetCalls=[],renderers=[],observers=[],updates=[],asset=deferred(),character=deferred();
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)){const attrs=attributes(match[2]);if(attrs.id)nodes.set(attrs.id,new Node(attrs));if(match[1]==='button'&&attrs['data-action']){const node=new Node(attrs);node.dataset.action=attrs['data-action'];node.naturalWidth=attrs['data-action']==='vault'?71.74:attrs['data-action']==='armory'?100.27:88.05;pins.push(node);}}
  const body=new Node(),window=new Node(),parent=standalone?window:{postMessage:(packet,target)=>posted.push({packet,target})};
  const document={body,documentElement:{lang:'en',dir:'ltr'},getElementById:id=>nodes.get(id),querySelectorAll:selector=>selector==='[data-action]'?pins:[],querySelector:selector=>pins.find(p=>selector===`[data-action="${p.dataset.action}"]`)};
  class Renderer {constructor(){if(rendererError)throw Error('isolated WebGL unavailable');this.shadowMap={};this.info={render:{calls:1,triangles:12}};this.disposals=0;renderers.push(this);}setPixelRatio(value){this.ratio=value;}getPixelRatio(){return this.ratio;}setSize(){}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}dispose(){this.disposals++;}}
  class Orbit extends Node {constructor(camera){super();this.camera=camera;this.target=new THREE.Vector3();this.disposals=0;orbits.push(this);}update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);}dispose(){this.disposals++;}}
  class Observer {constructor(fn){this.fn=fn;this.disposals=0;observers.push(this);}observe(){}disconnect(){this.disposals++;}}
  const actor={update(player,options){updates.push({player,options});return character.promise;},tick(){},disposals:0,dispose(){this.disposals++;}};
  let runtimeOptions;const runtime={starts:0,disposals:0,start(){this.starts++;},dispose(){this.disposals++;}};
  const scope=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},OrbitControls:Orbit,createSafehouseCharacter:()=>actor,normalizeAssetObject,
    loadAsset:(id,options)=>{assetCalls.push({id,options});return asset.promise;},installViewerRuntime:options=>{runtimeOptions=options;return runtime;},document,window,parent,URLSearchParams,ResizeObserver:Observer,
    location:{origin,search:'?lang='+lang,reload:()=>reloads.push(true)},innerWidth:390,innerHeight:600,devicePixelRatio:1,performance:{now:()=>0},matchMedia:()=>({matches:true})});
  return{nodes,pins,posted,reloads,asset,character,assetCalls,renderers,observers,actor,updates,runtime,scope,document,window,parent,orbits,
    run(){vm.runInContext(source.replace(/^import[^\n]*\n/gm,''),scope);},
    send(packet=validPacket(),extra={}){window.emit('message',{source:parent,origin,data:packet,...extra});},
    get rendering(){return runtimeOptions;},get readiness(){return JSON.parse(body.dataset.zoneSafehouseReadiness||'null');},get actions(){return posted.filter(p=>p.packet.type==='zone:safehouse-action').map(p=>p.packet);},dispose(){window.emit('pagehide',{persisted:false});}};
}
function validPacket(overrides={}){return{type:'zone:safehouse',property:{id:'v108-loft',owned:true,name:{en:'Canal loft',ar:'شقة القناة'}},player:{outfit:'suit',weapon:'fists'},lang:'en',...overrides};}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function uploaded(){const object=new THREE.Mesh(new THREE.BoxGeometry(4,3,3),new THREE.MeshStandardMaterial());return{object,transform:{scale:1,rotation:[0,0,0],floorOffset:0},disposals:0,dispose(){this.disposals++;}};}

test('initial HTML has no enabled action before module handlers and marks room initialization busy',()=>{
  const buttons=[...html.matchAll(/<button\b([^>]*)>/g)];assert.equal(buttons.length,7);assert.ok(buttons.every(m=>attributes(m[1]).disabled===true));
  assert.match(html,/<nav[^>]+id="room-pins"[^>]+aria-busy="true"/);assert.match(html,/<canvas[^>]+tabindex="-1"[^>]+aria-disabled="true"/);assert.match(html,/Property preview\. Your balance and ownership are unchanged\./);assert.match(html,/safehouse\.mjs\?v=116/);
});

test('actual module ignores early native and synthetic room clicks until a valid parent initialization',()=>{
  const h=harness(),armory=h.pins.find(p=>p.dataset.action==='armory');armory.click();assert.equal(h.actions.length,0);h.run();
  assert.equal(h.readiness.status,'waiting-parent');assert.equal(armory.disabled,true);armory.click();armory.emit('click');assert.equal(h.actions.length,0);
  assert.equal(h.nodes.get('room-pins').getAttribute('aria-busy'),'true');assert.equal(h.posted.filter(p=>p.packet.type==='zone:safehouse-ready').length,1);h.dispose();
});

test('accepted parent packet enables actual handlers without waiting for uploaded house or character bytes',()=>{
  const h=harness();h.run();h.send(validPacket({property:{id:'v108-loft',owned:true,mediaAsset:HASH}}));
  assert.equal(h.assetCalls.length,1);assert.equal(h.updates.length,1,'optional character starts independently of the pending house');assert.equal(h.readiness.status,'ready');assert.equal(h.nodes.get('loading').hidden,true);assert.equal(h.nodes.get('room-pins').getAttribute('aria-busy'),'false');
  for(const pin of h.pins){assert.equal(pin.disabled,false);pin.click();}
  assert.deepEqual(h.actions.map(a=>a.action),['armory','vault','lounge']);assert.ok(h.actions.every(a=>a.propertyId==='v108-loft'&&a.preview===false));assert.ok(h.posted.every(p=>p.target===origin));h.dispose();
});

test('wrong source, origin, type and incomplete ownership packets cannot unlock room controls',()=>{
  const h=harness();h.run();
  for(const [packet,extra]of[[validPacket(),{source:{}}],[validPacket(),{origin:'https://other.example'}],[{...validPacket(),type:'other'},{}],[validPacket({property:{owned:true}}),{}],[validPacket({property:{id:'x'}}),{}],[validPacket({player:[]}),{}]]){h.send(packet,extra);assert.equal(h.readiness.parentInitialized,false);}
  assert.ok(h.pins.every(p=>p.disabled));assert.equal(h.updates.length,0);h.send();assert.equal(h.readiness.servicesEnabled,true);h.dispose();
});

test('preview remains labeled and every Arabic room action is flagged for the authoritative parent guard',()=>{
  const h=harness({lang:'ar'});h.run();h.send(validPacket({lang:'ar',property:{id:'preview-home',owned:false,name:{ar:'معاينة الشقة'}}}));
  assert.equal(h.document.documentElement.dir,'rtl');assert.equal(h.nodes.get('room-pins').getAttribute('aria-label'),'غرف المخبأ');assert.match(h.nodes.get('house-mode').textContent,/معاينة العقار/);
  assert.deepEqual(h.pins.map(p=>p.querySelector('.pin-label').textContent),['خزانة السلاح','الخزنة','الاستراحة']);h.pins[1].click();assert.equal(h.actions[0].preview,true);assert.equal(h.actions[0].propertyId,'preview-home');h.dispose();
});

test('optional property and character failures retain the preview label and functioning base-room services',async()=>{
  const h=harness({lang:'ar'});h.run();h.send(validPacket({lang:'ar',property:{id:'preview-home',owned:false,mediaAsset:HASH}}));h.asset.reject(Error('isolated property bytes rejected'));h.character.reject(Error('isolated wardrobe rejected'));await settle();
  assert.equal(h.readiness.status,'ready');assert.match(h.nodes.get('house-mode').textContent,/معاينة العقار/);assert.match(h.nodes.get('house-mode').textContent,/تعذر فتح نموذج العقار/);assert.match(h.nodes.get('equipment-line').textContent,/خدمات الغرفة لا تزال متاحة/);assert.equal(h.nodes.get('error').hidden,true);
  h.pins[0].click();assert.equal(h.actions[0].action,'armory');assert.equal(h.actions[0].preview,true);h.dispose();
});

test('WebGL initialization failure still wires localized retry and the visible error-panel exit exactly once',()=>{
  const h=harness({rendererError:true,lang:'ar'});h.run();assert.equal(h.readiness.status,'error');assert.equal(h.nodes.get('error').hidden,false);assert.ok(h.pins.every(p=>p.disabled));assert.equal(h.nodes.get('room-pins').getAttribute('aria-busy'),'false');
  h.send(validPacket({lang:'ar'}));assert.equal(h.readiness.parentInitialized,true);assert.equal(h.readiness.servicesEnabled,false);assert.equal(h.nodes.get('error-exit').disabled,false);assert.equal(h.nodes.get('error-exit').textContent,'مغادرة المخبأ');h.nodes.get('error-exit').click();assert.equal(h.actions[0].action,'exit');h.nodes.get('retry').click();assert.equal(h.reloads.length,1);assert.equal(h.updates.length,0);h.dispose();
});

test('render failure disables scene actions while retry, exit and Escape remain real controls',async()=>{
  const h=harness();h.run();h.send(validPacket({property:{id:'v108-loft',owned:true,mediaAsset:HASH}}));h.rendering.fail('isolated context lost');
  assert.equal(h.readiness.status,'error');assert.ok(h.pins.every(p=>p.disabled));h.pins[0].emit('click');assert.equal(h.actions.length,0);h.nodes.get('error-exit').click();h.window.emit('keydown',{key:'Escape'});assert.deepEqual(h.actions.map(a=>a.action),['exit','exit']);
  const late=uploaded();h.asset.resolve(late);await settle();assert.equal(late.disposals,1);assert.equal(h.nodes.get('error').hidden,false);h.dispose();
});

test('disposal removes early listeners and late optional completion cannot revive the viewer or its actions',async()=>{
  const h=harness();h.run();h.send(validPacket({property:{id:'v108-loft',owned:true,mediaAsset:HASH}}));const starts=h.runtime.starts;h.window.emit('pagehide',{persisted:true});assert.equal(h.readiness.status,'ready');h.dispose();h.dispose();
  assert.equal(h.readiness.status,'disposed');assert.ok(h.pins.every(p=>p.disabled));assert.equal(h.renderers[0].disposals,1);assert.equal(h.actor.disposals,1);assert.equal(h.runtime.disposals,1);assert.equal(h.observers[0].disposals,1);assert.equal(h.orbits[0].disposals,1);
  const late=uploaded();h.asset.resolve(late);h.character.resolve();await settle();assert.equal(late.disposals,1);h.send();h.pins[0].click();h.nodes.get('exit').click();assert.equal(h.actions.length,0);assert.equal(h.runtime.starts,starts);assert.equal([...h.window.handlers.values()].reduce((n,set)=>n+set.size,0),0);
});

test('unrelated equipment updates cannot cancel the same pending uploaded property shell',async()=>{
  const h=harness();h.run();const property={id:'v108-loft',owned:true,mediaAsset:HASH};h.send(validPacket({property}));h.send(validPacket({property,player:{outfit:'tactical',weapon:'fists'}}));assert.equal(h.assetCalls.length,1);assert.equal(h.updates.length,2);
  const model=uploaded();h.asset.resolve(model);await settle();assert.equal(JSON.parse(h.document.body.dataset.zoneSafehouseRoom).source,'published-upload');assert.equal(model.disposals,0);assert.equal(h.readiness.servicesEnabled,true);h.dispose();assert.equal(model.disposals,1);
});

test('the reported Arabic phone Vault label and all three actual projected room labels fit their local canvas',()=>{
  const h=harness({lang:'ar'});h.run();h.send(validPacket({lang:'ar'}));const vault=h.pins.find(p=>p.dataset.action==='vault'),center=(291.26+363.01)/2;
  const placed=h.scope.placeRoomPin(vault,{x:center/341*2-1,y:0,z:.5},341,600);assert.equal(placed.action,'vault');let bounds=vault.getBoundingClientRect();assert.ok(bounds.left>=8&&bounds.right<=333.001,'the entire previously clipped 71.74px label is clamped inside the 341px canvas');
  h.rendering.render(.016,1);for(const pin of h.pins){bounds=pin.getBoundingClientRect();assert.ok(bounds.left>=7.99&&bounds.right<=333.01,pin.dataset.action+' horizontal bounds');assert.ok(bounds.top>=7.99&&bounds.bottom<=592.01,pin.dataset.action+' vertical bounds');assert.equal(pin.style.visibility,'visible');assert.equal(pin.disabled,false);assert.ok(pin.querySelector('.pin-label').textContent);}
  assert.deepEqual(h.pins.map(p=>p.dataset.action),['armory','vault','lounge']);h.dispose();
});

test('standalone safehouse cannot claim a parent handshake or offer a dead parent exit',()=>{
  const h=harness({standalone:true});h.run();h.send();assert.equal(h.readiness.parentInitialized,false);assert.equal(h.nodes.get('exit').disabled,true);assert.equal(h.nodes.get('error-exit').disabled,true);assert.ok(h.pins.every(p=>p.disabled));h.dispose();
});

test('safehouse property metadata includes happyMax and trainingBoost, and keyboard 1/2/3/0 shortcuts focus rooms when ready', () => {
  const h = harness(); h.run();
  h.send(validPacket({ property: { id: 'v108-loft', owned: true, happy: 500, name: { en: 'Canal loft', ar: 'شقة القناة' } } }));
  const propMeta = JSON.parse(h.document.body.dataset.zoneSafehouseProperty);
  assert.equal(propMeta.happyMax, 500);
  assert.ok(propMeta.trainingBoost.startsWith('×1.'));
  const canvas = h.nodes.get('room');
  let prevented = 0;
  for (const key of ['1', '2', '3', '0']) {
    canvas.emit('keydown', { key, preventDefault() { prevented++; } });
  }
  assert.equal(prevented, 4);
  const diag = h.window.ZoneSafehouse.diagnostics();
  assert.equal(diag.propertyId, 'v108-loft');
  assert.equal(diag.owned, true);
  assert.equal(diag.servicesReady, true);
  assert.equal(diag.hotspotCount, 3);
  assert.deepEqual(supportedSafehouseOutfits(), ['suit', 'street', 'tactical']);
  assert.equal(isSupportedSafehouseOutfit('street'), true);
  assert.equal(isSupportedSafehouseOutfit('unknown'), false);
  assert.equal(resolveSafehouseOutfitFile('street'), 'Casual_Hoodie');
  assert.equal(resolveSafehouseOutfitFile('unknown'), 'Suit');
  assert.equal(isSafehouseAssetHash(HASH), true);
  assert.equal(isSafehouseAssetHash('not-a-hash'), false);
  assert.equal(defaultSafehouseOutfitFile(), 'Suit');
  assert.equal(supportedSafehouseOutfitCount(), 3);
  assert.deepEqual(safehouseOutfitFileMap(), { suit: 'Suit', street: 'Casual_Hoodie', tactical: 'Swat' });
  assert.equal(typeof safehouseActorKey({ outfit: 'suit', weapon: 'glock' }, false), 'string');
  assert.equal(safehouseCustomCharacterTargetHeight(), 1.8);
  assert.equal(safehouseCustomWeaponTargetSize(), .65);
  assert.equal(safehouseCustomArmorTargetSize(), .52);
  assert.equal(safehouseCharacterDefaultYaw(), -.15);
  assert.deepEqual(safehouseWeaponSupportPoint(), [.24, .06, 0]);
  assert.deepEqual(Array.from(h.window.ZoneSafehouse.supportedHotspots()), ['armory', 'vault', 'lounge']);
  assert.equal(h.window.ZoneSafehouse.isSupportedAction('vault'), true);
  assert.equal(h.window.ZoneSafehouse.isSupportedAction('other'), false);
  assert.equal(h.window.ZoneSafehouse.isReady(), true);
  assert.equal(h.window.ZoneSafehouse.hasUploadedHouse(), false);
  assert.equal(h.window.ZoneSafehouse.isDisposed(), false);
  assert.equal(h.window.ZoneSafehouse.isPreview(), false);
  assert.equal(h.window.ZoneSafehouse.isOwned(), true);
  assert.equal(h.window.ZoneSafehouse.currentPropertyId(), 'v108-loft');
  assert.equal(h.window.ZoneSafehouse.currentLanguage(), 'en');
  assert.deepEqual(Array.from(h.window.ZoneSafehouse.supportedLanguages()), ['en', 'ar']);
  h.dispose();
  assert.equal(h.window.ZoneSafehouse.isReady(), false);
  assert.equal(h.window.ZoneSafehouse.isDisposed(), true);
});

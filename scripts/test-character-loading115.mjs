// Executes the actual decoded entry initializer with real rig/assets/modules.
// The GPU and browser network boundaries are controlled, not claimed as pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import * as T from '../lib/three184/three.module.js';
import {GLTFLoader as RealGLTFLoader} from '../lib/three184/GLTFLoader.js';
import {OBJLoader} from '../lib/three184/OBJLoader.js';
import {MTLLoader} from '../lib/three184/MTLLoader.js';
import * as presentation from '../dist/character-presentation.js';
import * as grip from '../dist/character-grip.js';
import * as poses from '../dist/character-poses.js';
import * as armor from '../dist/character-armor.mjs';
import * as uploaded from '../dist/uploaded-equipment108.mjs';
import * as weapons from '../dist/weapon-assets.js';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root));
const html=read('dist/character3d.html').toString();
const data=kind=>JSON.parse(html.match(new RegExp('<script type="__bundler/'+kind+'">([\\s\\S]*?)<\\/script>'))[1]);
const template=data('template'),manifest=data('manifest');
const entry=template.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const namespaces={'character-presentation.js':presentation,'character-grip.js':grip,'character-poses.js':poses,'character-armor.mjs':armor,'uploaded-equipment108.mjs':uploaded,'weapon-assets.js':weapons};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.hidden=false;this.value='';this.listeners=new Map();this.clientWidth=600;this.clientHeight=650;this.isConnected=true;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};}
 setAttribute(key,value){this[key]=String(value);} getAttribute(key){return this[key]??null;}
 appendChild(child){this.children.push(child);child.parentNode=this;return child;} append(...children){children.forEach(child=>this.appendChild(child));}
 addEventListener(name,fn){this.listeners.set(name,fn);} removeEventListener(name){this.listeners.delete(name);}
 querySelector(selector){return this.children.find(child=>child.tagName.toLowerCase()===selector)||null;}
 remove(){this.isConnected=false;}
}
async function boot({wardrobe='ready',texture='pending',failImport=null,href='https://zone.test/dist/character3d?v=115'}={}){
 const events=[],posted=[],timers=new Map(),listeners=new Map();let timerId=0;
 const nodes=Object.fromEntries(['c','tag','bar','rack','compact','cwep','canim','load','character-retry'].map(id=>[id,new Element(id==='c'?'canvas':'div')]));
 const document={hidden:false,body:new Element('body'),documentElement:new Element('html'),getElementById:id=>nodes[id]||null,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='canvas'?[nodes.c]:[],addEventListener(){},removeEventListener(){}};
 const bytes=read('assets/character/quaternius/Suit.glb');
 const wardrobeSource=await new RealGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 class GLTFLoader {loadAsync(url){events.push({type:'wardrobe-request',url});return wardrobe==='pending'?new Promise(()=>{}):wardrobe==='error'?Promise.reject(Error('controlled wardrobe error')):Promise.resolve(wardrobeSource);}}
 class TextureLoader {loadAsync(url){events.push({type:'optional-texture',url});return texture==='error'?Promise.reject(Error('controlled optional texture error')):new Promise(()=>{});}}
 class Renderer {constructor(){this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};}setPixelRatio(){}setSize(){}dispose(){}getPixelRatio(){return 1;}render(){events.push({type:'render'});}}
 class PMREM {fromScene(){return {texture:new T.Texture(),dispose(){}};}dispose(){}}
 class OrbitControls {constructor(){this.target=new T.Vector3();}update(){}saveState(){}dispose(){}}
 const THREE={...T,WebGLRenderer:Renderer,PMREMGenerator:PMREM,TextureLoader};
 const context=vm.createContext({THREE,OrbitControls,GLTFLoader,OBJLoader,MTLLoader,RoomEnvironment:class {dispose(){}},document,URL,URLSearchParams,AbortController,Promise,Map,Set,WeakSet,JSON,Math,Number,String,Object,Array,
  location:{href,origin:new URL(href).origin,search:new URL(href).search},devicePixelRatio:1,innerWidth:600,innerHeight:650,performance:{now:()=>0},
  matchMedia:()=>({matches:false}),console:{log(){},warn(){},error(...args){events.push({type:'error',args});}},parent:{document,postMessage:data=>posted.push(data)},
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},
  IntersectionObserver:class {constructor(callback){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}},
  addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
  __loadImport:async url=>{const file=new URL(url).pathname.split('/').at(-1);events.push({type:'import',file});if(failImport===file)throw Error('controlled import error: '+file);assert.ok(namespaces[file],'Unexpected import '+file);return namespaces[file];}
 });
 context.window=context;context.globalThis=context;
 context.ZoneMediaBoot={failed:false,ready(){document.body.dataset.zoneMediaState='ready';events.push({type:'bootstrap-ready'});return true;},fail(reason){this.failed=true;document.body.dataset.zoneMediaError=reason;}};
 for(const row of Object.values(manifest))if(/javascript/.test(row.mime)){const raw=Buffer.from(row.data,'base64');vm.runInContext((row.compressed?gunzipSync(raw):raw).toString(),context);}
 const transformed=entry.replace(/^import\s+[^;]+;\s*$/gm,'').replace(/\bimport\(/g,'__loadImport(');
 const result=vm.runInContext('(async function(){'+transformed+'\n})()',context);
 await result;for(let i=0;i<12;i++)await tick();
 return {context,document,nodes,events,posted,timers,listeners,dispose:async()=>{await listeners.get('pagehide')?.({persisted:false});}};
}

test('actual character initializer reaches a valid Suit while six optional stage maps remain pending',async()=>{
 const f=await boot();
 assert.equal(f.document.body.dataset.zoneCharacterAssetState,'ready');
 assert.equal(f.document.body.dataset.zoneCharacter,'Suit');
 assert.equal(f.events.filter(e=>e.type==='optional-texture').length,6);
 assert.ok(f.posted.some(m=>m.zoneCharacterReady===true));
 assert.equal(f.nodes['character-retry'].hidden,true);
 await f.dispose();
});

test('actual initializer reports a wardrobe failure and retains a usable character retry',async()=>{
 const f=await boot({wardrobe:'error'});
 assert.equal(f.document.body.dataset.zoneCharacterAssetState,'error');
 assert.equal(f.nodes['character-retry'].hidden,false);
 assert.match(f.nodes.load.textContent,/could not load/i);
 await f.dispose();
});

test('actual initializer starts the selected wardrobe without awaiting optional stage-map failures',async()=>{
 const f=await boot({texture:'error'});
 assert.equal(f.document.body.dataset.zoneCharacterAssetState,'ready');
 assert.ok(f.events.some(e=>e.type==='wardrobe-request'));
 await f.dispose();
});

function activateScript({type='module',src='',failure=true}={}){
 const start=html.indexOf('const dead = Array.from(document.scripts);');
 const end=html.indexOf('// Babel standalone auto-transforms',start);
 assert.ok(start>0&&end>start,'Use the shipping script activation loop');
 let inserted,settled=false;
 const attributes=[{name:'type',value:type},...(src?[{name:'src',value:src}]:[])];
 const old={attributes,textContent:type==='module'?entry:'',replaceWith(script){inserted=script;}};
 const ctx=vm.createContext({Promise,Error,URL,addEventListener(){},location:{href:'https://zone.test/dist/character3d?v=115'},document:{body:{dataset:{}},scripts:[old],createElement(){return {src:'',type:'',setAttribute(name,value){this[name]=value;}};}}});
 ctx.window=ctx;ctx.ZoneMediaBoot={failed:false};
 vm.runInContext(html.slice(html.indexOf('let characterRecoveryState'),html.indexOf('const FONT_MIME',html.indexOf('let characterRecoveryState'))),ctx);
 const result=vm.runInContext('(async function(){'+html.slice(start,end)+'\n})()',ctx);
 result.then(()=>{settled=true;},()=>{settled=true;});
 return {result,document:ctx.document,get settled(){return settled;},finish(){if(failure)inserted.onerror?.({target:inserted,type:'error'});else inserted.onload?.({target:inserted,type:'load'});}};
}

test('the actual bundler waits for an inline character module graph and rejects its resource failure',async()=>{
 const activation=activateScript();await tick();
 assert.equal(activation.settled,false,'A recreated inline module must not be treated as started before it loads');
 activation.finish();await assert.rejects(activation.result,/module|script|load/i);
 const receipt=JSON.parse(activation.document.body.dataset.zoneCharacterBootstrap);
 assert.equal(receipt.stage,'error');assert.equal(receipt.code,'character-module-load-failed');assert.equal(receipt.source,'inline-character-entry');
});

test('the actual bundler cannot continue after a required catalogue script resource fails',async()=>{
 const activation=activateScript({type:'',src:'blob:https://zone.test/catalogue'});await tick();
 assert.equal(activation.settled,false);activation.finish();await assert.rejects(activation.result,/script|load/i);
 assert.equal(JSON.parse(activation.document.body.dataset.zoneCharacterBootstrap).code,'character-script-load-failed');
});

test('successful inline module evaluation resolves the actual activation boundary once',async()=>{
 const activation=activateScript({failure:false});await tick();assert.equal(activation.settled,false);
 activation.finish();await activation.result;assert.equal(JSON.parse(activation.document.body.dataset.zoneCharacterBootstrap).stage,'ready');
});

test('actual parsed import map and complete startup ESM graph resolve to shipped r184 source, with no CDN dependency',()=>{
 const graph=spawnSync(process.execPath,['--experimental-vm-modules','--no-warnings','--input-type=module','-'],{cwd:fileURLToPath(root),encoding:'utf8',input:`
  import fs from 'node:fs';import vm from 'node:vm';
  const html=fs.readFileSync('dist/character3d.html','utf8');
  const template=JSON.parse(html.match(/<script type="__bundler\\/template">([\\s\\S]*?)<\\/script>/)[1]);
  const imports=JSON.parse(template.match(/<script type="importmap">([\\s\\S]*?)<\\/script>/)[1]).imports;
  const source=template.match(/<script type="module">([\\s\\S]*?)<\\/script>/)[1];
  const doc='https://zone.test/dist/character3d?v=114',base='https://zone.test';
  const resolve=(spec,parent)=>new URL(imports[spec]||spec,parent).href;
  const pending=[...new vm.SourceTextModule(source).dependencySpecifiers,...[...source.matchAll(/import\\(new URL\\('([^']+)'/g)].map(m=>m[1])].map(s=>resolve(s,doc));
  const seen=new Set(),modules=[];
  while(pending.length){const url=pending.shift();if(seen.has(url))continue;seen.add(url);if(!url.startsWith(base+'/'))throw Error('External module '+url);const path=new URL(url).pathname.slice(1);const bytes=fs.readFileSync(path),m=new vm.SourceTextModule(bytes.toString());const dependencies=m.dependencySpecifiers.map(spec=>resolve(spec,url));pending.push(...dependencies);modules.push({path,url,bytes:bytes.length,dependencies});}
  console.log(JSON.stringify({imports,modules}));
 `});
 assert.equal(graph.status,0,graph.stderr);
 const result=JSON.parse(graph.stdout);
 assert.ok(result.modules.length>=21,'Include asset-loader, FBX, fflate and NURBS dependencies');
 assert.ok(result.modules.some(m=>m.path==='lib/three184/three.core.js'));
 assert.ok(result.modules.some(m=>m.path==='lib/three184/curves/NURBSUtils.js'));
 for(const [name,url]of Object.entries(result.imports)){assert.match(url,/^\.\.\/lib\/three184\/[\w./]+\.js$/,'Unexpected '+name+' import '+url);}
 for(const module of result.modules)if(module.path.startsWith('lib/'))assert.ok(module.path.startsWith('lib/three184/'),module.path+' mixes vendor versions');
});

test('real unpack catch preserves module/script failure categories for the existing recovery UI',async()=>{
 const start=html.indexOf("const reason = err.code === 'character-module-load-failed'");
 const end=html.indexOf("console.error('Bundle unpack error:', err);",start)+"console.error('Bundle unpack error:', err);".length;
 assert.ok(start>0&&end>start);
 for(const [code,reason]of [['character-module-load-failed','preview-module-load-failed'],['character-script-load-failed','preview-script-load-failed'],['other','preview-unpack-failed']]){
  const calls=[];
  vm.runInNewContext(html.slice(start,end),{err:Object.assign(Error('controlled resource failure'),{code}),window:{ZoneMediaBoot:{fail:value=>calls.push(value)}},setStatus(){},console:{error(){}}});
  assert.deepEqual(calls,[reason]);
 }
});

function catchHarness({href='https://zone.test/dist/character3d?v=115&lang=ar&outfit=suit&weapon=fists&tag=x&tag=y#retained',embedded=true,mediaFailed=false,disposed=false,connected=true,postThrows=false}={}){
 const start=html.indexOf('let characterRecoveryState'),end=html.indexOf('const FONT_MIME',start);
 assert.ok(start>0&&end>start,'Use the shipping child recovery contract');
 const marker="console.error('Bundle unpack error:', err);",catchEnd=html.indexOf(marker)+marker.length,catchStart=html.lastIndexOf('} catch (err) {',catchEnd)+'} catch (err) {'.length;
 const messages=[],navigations=[],failures=[],timers=[],body={dataset:{}},originalName='retained frame اسم';
 const ctx=vm.createContext({URL,name:originalName,document:{body,documentElement:{isConnected:connected}},location:{href,origin:new URL(href).origin,reload(){navigations.push('reload');},replace(){navigations.push('replace');}},setTimeout(...args){timers.push(args);},setStatus(){},console:{error(){}}});
 ctx.window=ctx;ctx.parent=embedded?{postMessage(data,origin){messages.push({data,origin});if(postThrows)throw Error('controlled parent delivery failure');}}:ctx;
 ctx.ZoneMediaBoot={failed:mediaFailed,disposed,fail:reason=>failures.push(reason)};
 vm.runInContext(html.slice(start,end),ctx);
 const invoke=vm.runInContext('(function(err){'+html.slice(catchStart,catchEnd)+'\n})',ctx);
 return {ctx,body,messages,navigations,failures,timers,href,originalName,invoke:code=>invoke(Object.assign(Error('controlled activation error'),{code}))};
}

test('first activation failure requests exactly one parent remount with own-origin delivery and no child navigation/state mutation',()=>{
 const f=catchHarness();f.invoke('character-module-load-failed');
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].origin,'https://zone.test');
 assert.equal(JSON.stringify(f.messages[0].data),JSON.stringify({zoneCharacterRecover:1,reason:'character-module-load-failed'}));
 assert.deepEqual(f.navigations,[]);assert.deepEqual(f.timers,[]);assert.equal(f.ctx.location.href,f.href);assert.equal(f.ctx.name,f.originalName);assert.deepEqual(f.failures,[]);
 assert.equal(JSON.parse(f.body.dataset.zoneCharacterRecovery).method,'host-remount');
});

test('parallel module/script catches coalesce into one parent request and an exhausted remounted child falls back manually',()=>{
 const f=catchHarness();for(const code of ['character-module-load-failed','character-script-load-failed','character-module-load-failed'])f.invoke(code);
 assert.equal(f.messages.length,1);assert.deepEqual(f.navigations,[]);assert.deepEqual(f.failures,[]);
 const second=catchHarness({href:'https://zone.test/dist/character3d?v=115&__zone_character_boot_retry=1'});second.invoke('character-module-load-failed');
 assert.deepEqual(second.messages,[]);assert.deepEqual(second.navigations,[]);assert.deepEqual(second.failures,['preview-module-load-failed']);
});

test('nonactivation errors, failed/disposed/detached children and top-level documents never request a remount',()=>{
 for(const code of ['asset-timeout','asset-load-failed','webgl-context-lost','geometry-invalid','preview-startup-timeout','preview-runtime-error',undefined]){
  const f=catchHarness();f.invoke(code);assert.deepEqual(f.messages,[],String(code));assert.deepEqual(f.navigations,[]);assert.equal(f.failures.length,1);
 }
 for(const options of [{mediaFailed:true},{disposed:true},{connected:false},{embedded:false}]){
  const f=catchHarness(options);f.invoke('character-script-load-failed');assert.deepEqual(f.messages,[]);assert.deepEqual(f.navigations,[]);
 }
});

test('exhausted, malformed and duplicate legacy retry markers fail closed without a parent request',()=>{
 for(const value of ['1','2','-1','garbage','', '0&__zone_character_boot_retry=0']){
  const f=catchHarness({href:'https://zone.test/dist/character3d?v=115&__zone_character_boot_retry='+value});f.invoke('character-script-load-failed');
  assert.deepEqual(f.messages,[],value);assert.deepEqual(f.navigations,[]);
 }
});

test('failed parent delivery retains manual recovery and cannot send a second request',()=>{
 const f=catchHarness({postThrows:true});f.invoke('character-module-load-failed');f.invoke('character-module-load-failed');
 assert.equal(f.messages.length,1);assert.equal(f.failures.length,2);assert.deepEqual(f.navigations,[]);
});

test('a remounted child retains the original ready handshake without equipment or gameplay writes',async()=>{
 const f=await boot({href:'https://zone.test/dist/character3d?v=115&lang=ar&outfit=suit&weapon=fists&__zone_character_boot_retry=1'});
 assert.equal(f.document.body.dataset.zoneCharacterAssetState,'ready');assert.equal(f.document.documentElement.lang,'ar');
 assert.equal(f.posted.filter(m=>m.zoneCharacterReady===true).length,1);
 assert.ok(f.posted.every(m=>!('zoneEquip'in m)&&!('economy'in m)&&!('state'in m)));await f.dispose();
});

function errorOrderingHarness({href='http://127.0.0.3:4327/dist/character3d?v=115&lang=ar&outfit=suit&weapon=fists',captureFirst=true}={}){
 const listeners=new Map(),timers=new Map(),messages=[],navigations=[],body=new Element('body');let serial=0,inserted,settled=false;
 const document={body,documentElement:new Element('html'),scripts:[],getElementById:id=>body.children.find(n=>n.id===id)||null,querySelectorAll:()=>[],createElement:tag=>new Element(tag)};
 const addEventListener=(name,fn,options)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push({fn,capture:options===true||options?.capture===true});};
 const ctx=vm.createContext({URL,URLSearchParams,Error,TypeError,Promise,Set,Map,Object,JSON,String,document,console:{warn(){},error(){}},
  location:{href,origin:new URL(href).origin,search:new URL(href).search,replace(){navigations.push('replace');},reload(){navigations.push('reload');}},
  parent:{document:{documentElement:{lang:'ar'}},postMessage(data,origin){messages.push({data,origin});}},addEventListener,removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(row=>row.fn!==fn));},
  dispatchEvent(){},Event:class{constructor(type){this.type=type;}},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setStatus(){}});
 ctx.window=ctx;
 vm.runInContext(html.match(/<script id="zone-media-fallback">([\s\S]*?)<\/script>/)[1],ctx);
 const helperStart=html.indexOf('let characterRecoveryState'),helperEnd=html.indexOf('const FONT_MIME',helperStart);vm.runInContext(html.slice(helperStart,helperEnd),ctx);
 const captureStart=html.indexOf("window.addEventListener('error', function(e) {"),captureEnd=html.indexOf('}, true);',captureStart)+'}, true);'.length;
 vm.runInContext(html.slice(captureStart,captureEnd),ctx);
 document.scripts.push({attributes:[{name:'type',value:'module'}],textContent:entry,replaceWith(script){inserted=script;}});
 const loopStart=html.indexOf('const dead = Array.from(document.scripts);'),loopEnd=html.indexOf('// Babel standalone auto-transforms',loopStart);
 const marker="console.error('Bundle unpack error:', err);",catchEnd=html.indexOf(marker)+marker.length,catchStart=html.lastIndexOf('} catch (err) {',catchEnd)+'} catch (err) {'.length;
 const result=vm.runInContext('(async function(){try{'+html.slice(loopStart,loopEnd)+'}catch(err){'+html.slice(catchStart,catchEnd)+'}})()',ctx);
 result.then(()=>{settled=true;},()=>{settled=true;});
 const emit=(name,message)=>{
  const cause=new TypeError(message),event={type:name,target:ctx,message:name==='error'?'Uncaught TypeError: '+message:undefined,error:name==='error'?cause:undefined,reason:name==='unhandledrejection'?cause:undefined,preventDefault(){this.defaultPrevented=true;}};
  const rows=[...(listeners.get(name)||[])].sort((a,b)=>captureFirst?Number(b.capture)-Number(a.capture):Number(a.capture)-Number(b.capture));for(const row of rows)row.fn(event);return event;
 };
 return {ctx,document,messages,navigations,result,timers,get settled(){return settled;},emit,finish(){inserted.onload?.();},timeout(){for(const row of [...timers.values()])if(row.ms===15000)row.fn();}};
}
const failedGrip115='Failed to fetch dynamically imported module: http://127.0.0.3:4327/dist/character-grip.js?v=114';

for(const event of ['error','unhandledrejection'])test('actual activation and '+event+' ordering request one host remount without element.onerror',async()=>{
 const f=errorOrderingHarness();f.emit(event,failedGrip115);await tick();
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].data.zoneCharacterRecover,1);assert.equal(f.messages[0].data.reason,'character-module-load-failed');
 assert.equal(f.messages[0].origin,'http://127.0.0.3:4327');assert.deepEqual(f.navigations,[]);
 assert.equal(f.settled,true);assert.equal(f.ctx.ZoneMediaBoot.failed,false);
 assert.equal(JSON.parse(f.document.body.dataset.zoneCharacterBootstrap).stage,'error');
});

test('capture order and duplicate callbacks coalesce, while a second-realm failure shows localized manual Retry',async()=>{
 for(const captureFirst of [true,false]){
  const f=errorOrderingHarness({captureFirst});f.emit('error',failedGrip115);f.emit('unhandledrejection',failedGrip115);await tick();
  assert.equal(f.messages.length,1);assert.deepEqual(f.navigations,[]);assert.equal(f.ctx.ZoneMediaBoot.failed,false);
 }
 const second=errorOrderingHarness({href:'http://127.0.0.3:4327/dist/character3d?v=115&lang=ar&__zone_character_boot_retry=1'});
 second.emit('error',failedGrip115);await tick();assert.equal(second.settled,true);assert.deepEqual(second.messages,[]);assert.deepEqual(second.navigations,[]);
 assert.equal(second.document.body.dataset.zoneMediaError,'preview-module-load-failed');
 assert.ok(second.document.getElementById('zone-media-error').querySelector('button').textContent.includes('إعادة'));
});

test('the embedded manual Retry asks the owning host for a fresh viewer exactly once',()=>{
 const f=errorOrderingHarness();f.ctx.ZoneMediaBoot.fail('preview-module-load-failed');
 const button=f.document.getElementById('zone-media-error').querySelector('button');
 button.listeners.get('click')();button.listeners.get('click')();
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].data.zoneCharacterRecover,1);
 assert.equal(f.messages[0].data.reason,'preview-manual-retry');assert.equal(f.messages[0].data.manual,true);
 assert.deepEqual(f.navigations,[]);assert.equal(button.disabled,true);
});

test('ordinary runtime errors, foreign/non-graph imports and expired deadlines never request host recovery',async()=>{
 for(const message of ['Cannot read properties of undefined (reading geometry)','Failed to fetch dynamically imported module: https://foreign.test/character-grip.js?v=114','Failed to fetch dynamically imported module: http://127.0.0.3:4327/assets/character/quaternius/Suit.glb']){
  const f=errorOrderingHarness();f.emit('error',message);await tick();assert.deepEqual(f.messages,[]);assert.deepEqual(f.navigations,[]);assert.equal(f.ctx.ZoneMediaBoot.failed,true);
 }
 const late=errorOrderingHarness();late.timeout();late.emit('error',failedGrip115);await tick();assert.deepEqual(late.messages,[]);assert.deepEqual(late.navigations,[]);
});

test('genuine Boot.ready disarms transport recovery and completes activation without element.onload',async()=>{
 const f=errorOrderingHarness();assert.equal(f.ctx.ZoneMediaBoot.ready(),true);await tick();
 assert.equal(f.settled,true);assert.equal(JSON.parse(f.document.body.dataset.zoneCharacterBootstrap).stage,'ready');
 f.emit('error',failedGrip115);await tick();assert.deepEqual(f.messages,[]);assert.deepEqual(f.navigations,[]);assert.equal(f.document.body.dataset.zoneMediaError,'preview-runtime-error');
});

test('character wrapper contains no experimental name budget, automatic navigation, or queued recovery timer',()=>{
 const helper=html.slice(html.indexOf('let characterRecoveryState'),html.indexOf('const FONT_MIME',html.indexOf('let characterRecoveryState')));
 assert.doesNotMatch(helper,/window\.name|location\.(?:reload|replace)|setTimeout|sessionStorage/);
 assert.equal((html.split('<script type="__bundler/manifest">')[0].match(/location\.reload\(\)/g)||[]).length,1,'Only the existing manual Retry reload remains');
 assert.equal(presentation.characterArtLicense(),'CC0-1.0');
 assert.equal(presentation.characterArtAuthor(),'Quaternius');
 assert.equal(presentation.characterArtVersion(),'crime-wardrobe-1');
 assert.equal(presentation.requiredGripBoneCount(),19);
 assert.deepEqual(presentation.stageTextureAssets(),['concrete_floor_02','brick_wall_04']);
});

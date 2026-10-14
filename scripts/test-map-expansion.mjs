import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const mapHtml=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8'),parentHtml=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function mapFunction(name){const a=mapHtml.indexOf('  '+(name==='toggleMapExpanded'?'async ':'')+'function '+name+'('),b=mapHtml.indexOf('\n  '+(name==='requestMapExpanded'?'async function ':'function '),a+1);if(name==='toggleMapExpanded')return mapHtml.slice(a,mapHtml.indexOf('\n  el.mapExpand.onclick=',a));if(name==='handleMapMessage')return mapHtml.slice(a,mapHtml.indexOf("\n  window.addEventListener('message'",a));return mapHtml.slice(a,b);}
function node(){const attributes=new Map(),classes=new Set();return {attributes,classes,inert:false,children:[],parentElement:null,isConnected:true,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},getAttribute:name=>attributes.get(name)??null,setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name),focus(){this.focused=true;}};}
function parentHarness(){
  const root=node(),body=node(),main=node(),shell=node(),sidebar=node(),alreadyInert=node(),frame=node(),messages=[],listeners=new Map(),scroll=[];alreadyInert.inert=true;
  root.children=[body];body.parentElement=root;body.children=[main,sidebar];main.parentElement=body;sidebar.parentElement=body;main.children=[shell,alreadyInert];shell.parentElement=main;alreadyInert.parentElement=main;frame.parentElement=shell;frame.closest=()=>shell;frame.contentWindow={postMessage:(data,origin)=>messages.push({data,origin})};
  const character={contentWindow:{}},document={documentElement:root,body,activeElement:frame,getElementById:id=>id==='zone-city-map'?frame:id==='zone-char-3d'?character:null},window={location:{origin:'http://zone.test'},scrollX:7,scrollY:430,scrollTo:(x,y)=>scroll.push([x,y]),addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:name=>listeners.delete(name)};
  const a=parentHtml.indexOf('  setMapExpanded(expanded) {'),b=parentHtml.indexOf('  openFamilyTerritories()',a),msgA=parentHtml.indexOf('    this.onMsg = e => {'),msgB=parentHtml.indexOf("    window.addEventListener('message', this.onMsg);",msgA);
  const scope=vm.createContext({document,window});vm.runInContext('class Parent { constructor(){this.state={screen:"city",lang:"ar"};}\n'+parentHtml.slice(a,b)+'\nattach(){'+parentHtml.slice(msgA,msgB)+'}\n}\nglobalThis.instance=new Parent();',scope);scope.instance.attach();
  return {scope,instance:scope.instance,document,window,frame,character,body,shell,sidebar,alreadyInert,messages,listeners,scroll};
}
test('parent expansion accepts only the known same-origin map and restores focus, inertness, scroll and attributes',()=>{
  const h=parentHarness(),send=(source,origin,data)=>h.instance.onMsg({source,origin,data}),request={type:'ZONE_MAP_EXPAND',expanded:true};
  send(h.frame.contentWindow,'https://foreign.test',request);send({},'http://zone.test',request);send(h.character.contentWindow,'http://zone.test',request);send(h.frame.contentWindow,'http://zone.test',{...request,expanded:'yes'});assert.equal(h.instance._mapExpandedState,undefined);
  send(h.frame.contentWindow,'http://zone.test',request);assert.equal(h.shell.classes.has('zone-city-map-expanded'),true);assert.equal(h.body.classes.has('zone-map-expanded'),true);assert.equal(h.sidebar.inert,true);assert.equal(h.alreadyInert.inert,true);assert.equal(h.shell.getAttribute('aria-modal'),'true');assert.equal(h.shell.getAttribute('role'),'dialog');assert.equal(h.messages.at(-1).data.expanded,true);assert.equal(h.messages.at(-1).origin,'http://zone.test');
  const saved=h.instance._mapExpandedState;send(h.frame.contentWindow,'http://zone.test',request);assert.equal(h.instance._mapExpandedState,saved,'duplicate requests must not replace restoration state');
  h.listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(h.shell.classes.has('zone-city-map-expanded'),false);assert.equal(h.body.classes.has('zone-map-expanded'),false);assert.equal(h.sidebar.inert,false);assert.equal(h.alreadyInert.inert,true);assert.equal(h.shell.getAttribute('role'),null);assert.equal(h.shell.getAttribute('aria-modal'),null);assert.equal(h.frame.focused,true);assert.deepEqual(h.scroll,[[7,430]]);assert.equal(h.messages.at(-1).data.expanded,false);assert.equal(h.listeners.has('keydown'),false);
});
test('leaving City collapses fallback before hiding its existing iframe and blocks expansion on other routes',()=>{
  const h=parentHarness();h.instance.setMapExpanded(true);h.instance.mapVisibility(false);assert.equal(h.instance._mapExpandedState,null);assert.equal(h.messages.at(-1).data.type,'ON_HIDE');h.instance.state.screen='home';h.instance.setMapExpanded(true);assert.equal(h.instance._mapExpandedState,null);
});
function frameHarness(enabled=true){
  const sent=[],attributes=new Map(),button={setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),focus(){this.focused=true;}},parent={postMessage:(data,origin)=>sent.push({data,origin})};let resized=0;
  const document={fullscreenEnabled:enabled,fullscreenElement:null,documentElement:{requestFullscreen:async()=>{throw new TypeError('not granted');}},body:{dataset:{}}};
  const scope=vm.createContext({document,window:{},parent,location:{origin:'http://zone.test'},lang:'ar',parentExpanded:false,mapDisposed:false,el:{mapExpand:button},scheduleResize:()=>resized++});
  vm.runInContext(['syncMapExpandedControl','requestMapExpanded','toggleMapExpanded','handleMapMessage'].map(mapFunction).join('\n'),scope);
  return {scope,document,parent,sent,attributes,button,resized:()=>resized};
}
test('rejected or missing native fullscreen opens the parent fallback without an unhandled rejection',async()=>{
  for(const enabled of [true,false]){const h=frameHarness(enabled);await h.scope.toggleMapExpanded();assert.equal(h.sent.length,1);assert.equal(h.sent[0].data.type,'ZONE_MAP_EXPAND');assert.equal(h.sent[0].data.expanded,true);assert.equal(h.sent[0].origin,'http://zone.test');}
});
test('successful native fullscreen stays native and rejected native exit does not leak a promise rejection',async()=>{
  const h=frameHarness();h.document.documentElement.requestFullscreen=async()=>{h.document.fullscreenElement=h.document.documentElement;};await h.scope.toggleMapExpanded();assert.equal(h.sent.length,0);
  h.document.exitFullscreen=async()=>{throw new TypeError('not granted');};await h.scope.toggleMapExpanded();assert.equal(h.sent.length,0);assert.equal(h.attributes.get('aria-pressed'),'true');
  h.document.exitFullscreen=async()=>{h.document.fullscreenElement=null;};await h.scope.toggleMapExpanded();assert.equal(h.document.fullscreenElement,null);
});
test('expansion acknowledgement rejects foreign/sibling messages and keeps localized collapse control and focus restoration',async()=>{
  const h=frameHarness(),ack={type:'ZONE_MAP_EXPANDED',expanded:true};h.scope.handleMapMessage({source:{},origin:'http://zone.test',data:ack});h.scope.handleMapMessage({source:h.parent,origin:'https://foreign.test',data:ack});assert.equal(h.scope.parentExpanded,false);
  h.scope.handleMapMessage({source:h.parent,origin:'http://zone.test',data:ack});assert.equal(h.scope.parentExpanded,true);assert.equal(h.attributes.get('aria-pressed'),'true');assert.equal(h.attributes.get('aria-label'),'تصغير الخريطة');await h.scope.toggleMapExpanded();assert.equal(h.sent.at(-1).data.expanded,false);
  h.scope.handleMapMessage({source:h.parent,origin:'http://zone.test',data:{type:'ZONE_MAP_EXPANDED',expanded:false}});assert.equal(h.scope.parentExpanded,false);assert.equal(h.button.focused,true);assert.equal(h.attributes.get('aria-label'),'توسيع الخريطة');assert.ok(h.resized()>=2);
});
test('expanded iframe keyboard traversal wraps visible controls and Escape requests collapse',()=>{
  const h=frameHarness();let keydown;h.document.addEventListener=(type,handler)=>{if(type==='keydown')keydown=handler;};
  const first={tabIndex:0,closest:()=>null,getClientRects:()=>[{}],focus(){this.focused=true;}},last={...first,focused:false},disabled={...first,disabled:true},hidden={...first,getClientRects:()=>[]};h.document.querySelectorAll=()=>[first,disabled,hidden,last];
  const a=mapHtml.indexOf("  document.addEventListener('keydown',function(event){"),b=mapHtml.indexOf('\n  });',a)+7;vm.runInContext(mapHtml.slice(a,b),h.scope);
  h.scope.parentExpanded=true;let prevented=0;h.document.activeElement=last;keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(first.focused,true);
  h.document.activeElement=first;keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(last.focused,true);assert.equal(prevented,2);
  keydown({key:'Escape',preventDefault(){prevented++;}});assert.equal(h.sent.at(-1).data.expanded,false);assert.equal(prevented,3);h.scope.parentExpanded=false;keydown({key:'Escape',preventDefault(){throw new Error('inline mode must not trap Escape');}});
});

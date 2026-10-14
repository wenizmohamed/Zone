import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/city-map-torn.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('  function runPrepared3D('),html.indexOf('  function view3D('));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
  const ready=deferred(),moves=[],attrs=new Map(),error={style:{}},button={disabled:false,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
  const controller={whenReady:()=>ready.promise};
  const scope=vm.createContext({mapDisposed:false,preparedCameraRequest:0,landmarkController:controller,landmarkPending:null,mapVisible:true,document:{hidden:false,body:{dataset:{}},getElementById:()=>error},lang:'en',el:{streetView:button},map:{easeTo:o=>moves.push(o),flyTo:o=>moves.push(o)},sync3DControl(){}});
  vm.runInContext(code,scope);return {scope,ready,moves,attrs,error,button,controller};
}
test('camera responds immediately while optional landmarks prepare without locking the flat control',async()=>{
  const h=harness(),motion=h.scope.runPrepared3D({pitch:35},false);await Promise.resolve();assert.equal(h.moves.length,1);assert.equal(h.button.disabled,false);assert.equal(h.attrs.get('aria-busy'),'true');
  h.ready.resolve();await motion;assert.equal(h.moves.length,1);assert.equal(h.button.disabled,false);assert.equal(h.attrs.has('aria-busy'),false);assert.equal(h.error.style.display,'none');
});
test('an early click moves immediately and tracks optional module and shader preparation separately',async()=>{
  const h=harness(),loading=deferred();h.scope.landmarkController=null;h.scope.landmarkPending=loading.promise;const motion=h.scope.runPrepared3D({pitch:35},true);
  await Promise.resolve();assert.equal(h.moves.length,1);h.scope.landmarkController=h.controller;loading.resolve(h.controller);await Promise.resolve();assert.equal(h.moves.length,1);h.ready.resolve();await motion;assert.equal(h.moves.length,1);
});
test('reset or hiding the map cannot cause a late asynchronous camera jump',async()=>{
  for(const action of ['reset','hide']){const h=harness(),motion=h.scope.runPrepared3D({pitch:35},false);assert.equal(h.moves.length,1);if(action==='reset')h.scope.preparedCameraRequest++;else h.scope.mapVisible=false;h.ready.resolve();await motion;assert.equal(h.moves.length,1);}
});
test('a stale request cannot unlock controls owned by a newer request',async()=>{
  const h=harness(),first=h.scope.runPrepared3D({pitch:35},false);await Promise.resolve();const next=deferred();h.scope.landmarkController={whenReady:()=>next.promise};const second=h.scope.runPrepared3D({pitch:38},false);await Promise.resolve();h.ready.resolve();await first;assert.equal(h.attrs.get('aria-busy'),'true');next.resolve();await second;assert.equal(h.button.disabled,false);assert.equal(h.attrs.has('aria-busy'),false);assert.equal(h.moves.length,2);assert.equal(h.moves[1].pitch,38);
});
test('a model failure leaves vector camera navigation available and shows a recoverable message',async()=>{
  const h=harness(),motion=h.scope.runPrepared3D({pitch:35},false);h.ready.reject(new Error('shader failed'));await motion;assert.equal(h.moves.length,1);assert.equal(h.error.style.display,'block');assert.match(h.error.textContent,/map and its controls remain available/);assert.equal(h.button.disabled,false);
});

test('disposed or hidden maps never prepare or move and late failures cannot mutate the dead document',async()=>{
  const h=harness();h.scope.mapDisposed=true;await h.scope.runPrepared3D({pitch:35},false);assert.equal(h.moves.length,0);
  h.scope.mapDisposed=false;const task=h.scope.runPrepared3D({pitch:35},false);await Promise.resolve();await Promise.resolve();h.scope.mapDisposed=true;h.ready.reject(new Error('late shader failure'));await task;assert.equal(h.error.style.display,undefined);
});

test('explicit block perspective inspection reaches street detail without zooming past the inspection limit',()=>{
  const code=html.slice(html.indexOf('  function view3D('),html.indexOf('  function toggle3D(')),moves=[];
  let zoom=12,closed=0;
  const scope=vm.createContext({closeSide:()=>closed++,districtCameraZoom:()=>18.5,landmarkController:null,landmarkPending:null,RM:true,CAMERA_MS:440,map:{getZoom:()=>zoom,flyTo:options=>moves.push(options)}});
  vm.runInContext(code,scope);scope.view3D([-73.97,40.75]);zoom=20;scope.view3D([-73.96,40.76]);
  assert.equal(closed,2);assert.equal(moves[0].zoom,17.4);assert.equal(moves[1].zoom,18.5);assert.equal(moves[0].duration,0);assert.equal(moves[0].pitch,38);
});

test('automatic framing permits detailed vectors and has no raster pixel budget',()=>{
  const start=html.indexOf('  function districtCameraZoom('),end=html.indexOf('  var found;',start),code=html.slice(start,end),scope=vm.createContext({});
  vm.runInContext(code,scope);assert.equal(scope.districtCameraZoom(),18.5);
  assert.doesNotMatch(html,/artworkCameraZoom|1122\/w|1402\/h/);
  assert.match(html,/maxZoom:20/);assert.match(html,/fitCity\(territoryData,false\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import sampler from '../dist/map-frame-sample.js';
function harness(){
  let id=0,visible=true;const frames=new Map(),results=[];
  const sample=sampler.create({frames:120,request:fn=>{frames.set(++id,fn);return id;},cancel:key=>frames.delete(key),visible:()=>visible,publish:r=>results.push(r)});
  return {sample,frames,results,hide(){visible=false;},tick(time){const [key,fn]=frames.entries().next().value;frames.delete(key);fn(time);}};
}
test('bounded native frame samples calculate real intervals and stop after 120 frames',()=>{
  const h=harness();h.sample.start('3d');for(let i=0;i<=120;i++)h.tick(i*16.67+(i>=10?100:0));
  assert.equal(h.frames.size,0);assert.equal(h.results.length,1);const r=h.results[0];
  assert.equal(r.label,'3d');assert.equal(r.frames,120);assert.equal(r.over33ms,1);assert.ok(Math.abs(r.max-116.67)<.01);assert.ok(Math.abs(r.p95-16.67)<.01);
});
test('repeated camera events share a sample rather than creating concurrent loops',()=>{
  const h=harness();h.sample.start('camera');for(let i=0;i<30;i++)h.sample.start('zoom');assert.equal(h.frames.size,1);
  for(let i=0;i<=120;i++)h.tick(i*16.67);assert.equal(h.results.length,1);h.sample.start('next');assert.equal(h.frames.size,1);
});
test('hide, page teardown and cancellation discard incomplete samples',()=>{
  const h=harness();h.sample.start();h.tick(0);h.hide();h.tick(16.67);assert.equal(h.frames.size,0);assert.equal(h.results.length,0);h.sample.start();assert.equal(h.frames.size,0);
  const next=harness();next.sample.start();next.sample.cancel();assert.equal(next.frames.size,0);assert.equal(next.results.length,0);
});

test('camera watcher measures actual render intervals and wall-clock movement duration',()=>{
  const listeners=new Map(),results=[];let now=0;
  const map={on:(name,fn)=>listeners.set(name,fn),off:name=>listeners.delete(name)};
  const watch=sampler.watch(map,{now:()=>now,visible:()=>true,publish:r=>results.push(r)});
  listeners.get('movestart')();for(const t of [0,16,32,80,96,112,128,144,160,176]){now=t;listeners.get('render')();}now=180;listeners.get('moveend')();
  assert.equal(results[0].durationMs,180);assert.equal(results[0].renderFrames,10);assert.equal(results[0].maxIntervalMs,48);assert.equal(results[0].over33ms,1);watch.dispose();assert.equal(listeners.size,0);
});
test('camera watcher cancels hidden movements without creating any render loop',()=>{
  const listeners=new Map(),results=[];let visible=true,now=0;
  const map={on:(name,fn)=>listeners.set(name,fn),off:name=>listeners.delete(name)};
  const watch=sampler.watch(map,{now:()=>now,visible:()=>visible,publish:r=>results.push(r)});listeners.get('movestart')();visible=false;now=1000;listeners.get('render')();listeners.get('moveend')();assert.equal(results.length,0);watch.dispose();
});

test('camera watcher reports a first-frame stall separately from smooth later frames',()=>{
  const listeners=new Map(),results=[];let now=0;
  const map={on:(name,fn)=>listeners.set(name,fn),off:name=>listeners.delete(name)};
  const watch=sampler.watch(map,{now:()=>now,visible:()=>true,publish:r=>results.push(r)});
  listeners.get('movestart')();for(const t of [1000,1016,1032]){now=t;listeners.get('render')();}now=1048;listeners.get('moveend')();
  assert.equal(results[0].firstFrameMs,1000);assert.equal(results[0].maxIntervalMs,16);assert.equal(results[0].durationMs,1048);watch.dispose();
});

test('camera watcher retains the action label and supports a movement started during publish',()=>{
  const listeners=new Map(),results=[];let now=0;
  const map={on:(name,fn)=>listeners.set(name,fn),off:name=>listeners.delete(name)};
  const watch=sampler.watch(map,{now:()=>now,visible:()=>true,publish:r=>{results.push(r);if(results.length===1)listeners.get('movestart')({zoneCameraAction:'zoom-in'});}});
  listeners.get('movestart')({zoneCameraAction:'city-3d'});now=180;listeners.get('moveend')();now=360;listeners.get('moveend')();
  assert.equal(results.length,2);assert.equal(results[0].action,'city-3d');assert.equal(results[1].action,'zoom-in');assert.equal(results[1].durationMs,180);watch.dispose();
});

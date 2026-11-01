import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// The browser dist directory also contains legacy CommonJS/UMD helpers. Load
// these exact ESM bytes through an explicit module URL without changing that
// directory's module semantics. mountCombatPresentation is exercised in Chrome.
const combatSource=fs.readFileSync(new URL('../dist/combat-presentation.js',import.meta.url),'utf8');
const combatModuleUrl=new URL('../dist/combat-presentation.js',import.meta.url).href;
const { combatEvents, combatEventLabel, combatExchangeSummary, createCombatPlayback, attackMotion, combatCameraDistance, COMBAT_CLIPS, supportedCombatActions, supportedCombatActionCount, isSupportedCombatAction, resolvedEncounterPhases, isResolvedEncounterPhase, resolveCombatClipName, defaultCombatSpacingMs, defaultCombatFeedbackDelayMs, supportedCombatActors, isSupportedCombatActor, supportedCombatEventKinds, combatStageGroupName, combatCameraMinDistance, createCombatFeedbackTimeline, installCombatStage, clearCombatFeedback, combatFeedbackBoundary } = await import('data:text/javascript;base64,'+Buffer.from(combatSource.replaceAll('import.meta.url',JSON.stringify(combatModuleUrl))).toString('base64'));
function loadRuntimeModule(relative){const url=new URL(relative,import.meta.url),source=fs.readFileSync(url,'utf8');return import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('import.meta.url',JSON.stringify(url.href))).toString('base64'));}
const encounter = (version=1, log=[]) => ({ id:'actual-server-id', version, phase:'fighting', log });
const hit = { n:1, actor:'player', side:'opp', d:12, yl:900, ol:88 };
const miss = { n:1, actor:'opponent', side:null, d:0, yl:900, ol:88 };
function harness() { const emitted=[], pending=new Map(); let id=0; const playback=createCombatPlayback({ emit:event=>emitted.push(event),schedule:fn=>{pending.set(++id,fn);return id;},cancel:key=>pending.delete(key) });return {emitted,pending,playback,drain(){while(pending.size){const [key,fn]=pending.entries().next().value;pending.delete(key);fn();}}}; }
test('both sides and exact health/damage map from actual server exchange fields',()=>{const events=combatEvents(encounter(2,[hit,miss]));assert.deepEqual(events.map(e=>[e.actor,e.target,e.kind,e.damage,e.playerHp,e.enemyHp]),[['player','opponent','hit',12,900,88],['opponent','player','miss',0,900,88]]);assert.equal(events[0].turn,1);assert.notEqual(events[0].id,events[1].id);});
test('zero damage is never fabricated as a block; block requires explicit server field',()=>{assert.equal(combatEvents(encounter(2,[miss]))[0].kind,'miss');assert.equal(combatEvents(encounter(2,[{...miss,blocked:true}]))[0].kind,'block');});
test('malformed damage/health and unknown actor never produce visual combat events',()=>{assert.deepEqual(combatEvents(encounter(2,[{...hit,d:-1},{...hit,d:'50'},{...hit,yl:null},{...hit,actor:'invented'}])),[]);});
test('EN/AR labels preserve names and exact damage without inferred rewards',()=>{const event=combatEvents(encounter(2,[hit]))[0];assert.equal(combatEventLabel(event,{player:'Weni',opponent:'Real rival'}),'Weni hit Real rival: 12 damage');assert.match(combatEventLabel(event,{player:'وني',opponent:'خصم'},'ar'),/وني.*خصم.*12/);});
test('hydrated encounter history is silent; only appended exchanges play once',()=>{const h=harness();h.playback.ingest(encounter(3,[hit]));assert.equal(h.emitted.length,0);assert.equal(h.playback.diagnostics().identity,'actual-server-id');assert.equal(h.playback.diagnostics().version,3);assert.equal(h.playback.diagnostics().count,1);assert.equal(h.playback.diagnostics().hasLatest,true);h.playback.ingest(encounter(4,[hit,miss]));h.playback.ingest(encounter(4,[hit,miss]));assert.equal(h.emitted.length,1);assert.equal(h.emitted[0].actor,'opponent');assert.equal(h.emitted[0].replay,false);});
test('stale version cannot emit combat or replace replay truth',()=>{const h=harness();h.playback.ingest({...encounter(5,[hit]),phase:'won'});h.playback.ingest({...encounter(4,[hit,miss]),phase:'won'});h.playback.replay();h.drain();assert.equal(h.emitted.length,1);assert.equal(h.emitted[0].damage,12);});
test('replay only permits resolved encounters and marks every exchange as replay',()=>{const h=harness();h.playback.ingest(encounter(3,[hit,miss]));assert.equal(h.playback.replay(),false);h.playback.ingest({...encounter(4,[hit,miss]),phase:'won'});assert.equal(h.playback.replay(),true);h.drain();assert.equal(h.emitted.length,2);assert.ok(h.emitted.every(e=>e.replay));});
test('hidden route cancels queued feedback and never replays backlog on return',()=>{const h=harness();h.playback.ingest(encounter());h.playback.ingest(encounter(2,[hit,miss]));assert.equal(h.pending.size,1);h.playback.setActive(false);assert.equal(h.pending.size,0);h.playback.ingest(encounter(3,[hit,miss,{...hit,n:2}]));h.playback.setActive(true);h.drain();assert.equal(h.emitted.length,1);});
test('new encounter resets event identity; disposal is idempotent and cancels timers',()=>{const h=harness();h.playback.ingest(encounter());h.playback.ingest(encounter(2,[hit,miss]));h.playback.ingest({...encounter(1,[hit]),id:'second'});assert.equal(h.pending.size,0);h.playback.dispose();h.playback.dispose();h.playback.ingest(encounter(10,[hit,miss]));assert.equal(h.playback.replay(),false);assert.equal(h.emitted.length,1);});
test('weapon animation follows actual equipped model rather than enemy assumptions',()=>{assert.equal(attackMotion('knife'),'slash');assert.equal(attackMotion('fists'),'punch');assert.equal(attackMotion('bat'),'heavy');assert.equal(attackMotion('actual',{actual:{anim:'throw'}}),'throw');assert.deepEqual(supportedCombatActions(),['idle','guard','punch','slash','heavy','hit','down']);assert.equal(isSupportedCombatAction('slash'),true);assert.equal(isSupportedCombatAction('dance'),false);});
test('manifest assets are actual local files; all decoded audio is nonempty PCM with event provenance',()=>{const manifest=JSON.parse(fs.readFileSync(new URL('../assets/ui/combat-assets.json',import.meta.url)));for(const asset of manifest.assets){const p=new URL('../'+asset.path,import.meta.url);assert.ok(fs.statSync(p).size>0,asset.path);if(asset.path.endsWith('.wav')){const b=fs.readFileSync(p);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.ok(b.length>2000);}}assert.match(manifest.opponentAppearance,/representative/i);});


test('real licensed wardrobes retain combat clips, finger grip and portrait bounds on desktop and phone', async t => {
  const T=await import('../lib/three184/three.module.js');
  const {GLTFLoader}=await import('../lib/three184/GLTFLoader.js');
  const {prepareCharacterGrip,applyCharacterGrip}=await loadRuntimeModule('../dist/character-grip.js');
  const {prepareCharacterArt,disposeCharacterResources}=await loadRuntimeModule('../dist/character-presentation.js');
  for(const file of ['Suit','Casual_Hoodie','Swat']){
    const bytes=fs.readFileSync(new URL(`../assets/character/quaternius/${file}.glb`,import.meta.url));
    for(const side of ['player','opponent']){
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');prepareCharacterArt(T,gltf.scene);
      gltf.scene.position.x=side==='player'?-.75:.75;gltf.scene.rotation.y=side==='player'?.68:-.68;
      const clips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,clip]));for(const clip of Object.values(COMBAT_CLIPS))assert.ok(clips[clip],`${file}/${clip}`);
      const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(clips.Sword_Slash).play();mixer.update(.22);
      const grip=prepareCharacterGrip(T,gltf.scene,clips);applyCharacterGrip(grip);assert.equal(grip.pose.length,19);gltf.scene.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(gltf.scene);
      for(const aspect of [2,.81]){
        const camera=new T.PerspectiveCamera(36,aspect,.1,35);camera.position.set(0,1.6,combatCameraDistance(aspect));camera.lookAt(0,.95,0);camera.updateMatrixWorld(true);
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<.95 && Math.abs(p.y)<.95,`${file}/${side}/${aspect} clipped ${p.x},${p.y}`);
        }
      }
      mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);disposeCharacterResources([gltf.scene]);
    }
  }
  t.diagnostic('All three actual rigs: 19-finger-bone grip intact, all combat clips exist, both sides fit 2:1 and0.81:1 portrait bounds. Browser pixels still required.');
});

test('actual combat actor loading attaches a source-normalized detailed shotgun without subtracting its raw grip twice', async () => {
  const T = await import('../lib/three184/three.module.js');
  const { GLTFLoader } = await import('../lib/three184/GLTFLoader.js');
  const grip = await loadRuntimeModule('../dist/character-grip.js');
  const poses = await loadRuntimeModule('../dist/character-poses.js');
  const art = await loadRuntimeModule('../dist/character-presentation.js');
  const armor = await loadRuntimeModule('../dist/character-armor.mjs');
  const { createWeaponAssetLoader } = await loadRuntimeModule('../dist/weapon-assets.js');
  const geometryBuffer = bytes => {
    const length = bytes.readUInt32LE(12), data = JSON.parse(bytes.toString('utf8', 20, 20 + length));
    delete data.materials; delete data.textures; delete data.images; delete data.samplers;
    for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    const json = Buffer.from(JSON.stringify(data)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const tail = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + tail.length);
    output.write('glTF'); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); tail.copy(output, 20 + padded.length);
    return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  };
  class RetainedLoader {
    async loadAsync(url) {
      const marker = String(url).indexOf('/assets/'); assert.ok(marker >= 0);
      const bytes = fs.readFileSync(new URL('../' + String(url).slice(marker + 1), import.meta.url));
      return new GLTFLoader().parseAsync(geometryBuffer(bytes), '');
    }
  }
  const weaponLoader = createWeaponAssetLoader({ THREE: T, GLTFLoader: RetainedLoader });
  assert.ok(Math.hypot(...weaponLoader.descriptor('shotgun').grip) > .4, 'regression must use a large nonzero source grip');
  const actors = {}, scene = new T.Scene();
  const ctx = vm.createContext({ T, GLTFLoader: RetainedLoader, URL, art, grip, poses, armor, weaponLoader, actors, scene, packet: {player:{}}, doc: {body:{dataset:{}}}, loadArmorSource: () => new RetainedLoader().loadAsync(new URL('../assets/character/quaternius/Swat.glb',import.meta.url).href),
    loadSequence: 1, disposed: false, sources: new Set(), size() {},
    play(actor) { actor.mixer.clipAction(actor.clips.Idle).play(); } });
  const start = combatSource.indexOf('async function loadActor('), end = combatSource.indexOf('function releaseActor(', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(combatSource.slice(start, end).replaceAll('import.meta.url', JSON.stringify(combatModuleUrl)), ctx);
  await ctx.loadActor('player', 'suit', 'shotgun');
  const actor = actors.player; assert.ok(actor.mesh && actor.held);
  actor.root.updateMatrixWorld(true);
  const origin = actor.grip.hand.worldToLocal(actor.mesh.localToWorld(new T.Vector3()));
  assert.ok(origin.distanceTo(actor.grip.center) < 1e-5, 'normalized detailed model floated away through double grip subtraction');
  const axis = actor.grip.hand.worldToLocal(actor.mesh.localToWorld(new T.Vector3(1, 0, 0))).sub(origin).normalize();
  assert.ok(axis.dot(new T.Vector3(0, 1, 0).projectOnPlane(actor.grip.axis).normalize()) > .99999);
  actor.held.removeFromParent(); weaponLoader.release(actor.mesh); await weaponLoader.dispose();
  actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root); art.disposeCharacterResources([actor.root]);
});


test('authored attack precedes impact/audio at contact; hidden/disposed feedback cancels late effects',()=>{
  const calls=[],timers=new Map();let id=0;
  const timeline=createCombatFeedbackTimeline({attack:e=>calls.push(['attack',e.damage]),impact:e=>calls.push(['impact',e.damage]),schedule:(fn,ms)=>{assert.equal(ms,340);timers.set(++id,fn);return id;},cancel:key=>timers.delete(key)});
  timeline.play({damage:12});assert.deepEqual(calls,[['attack',12]]);const [key,fn]=timers.entries().next().value;timers.delete(key);fn();assert.deepEqual(calls,[['attack',12],['impact',12]]);
  timeline.play({damage:5});timeline.stop();assert.equal(timers.size,0);timeline.play({damage:7});timeline.dispose();assert.equal(timers.size,0);timeline.play({damage:100});assert.equal(calls.length,4);
});
test('reduced-motion exchange provides immediate exact feedback without initiating attack motion',()=>{
  const calls=[];const timeline=createCombatFeedbackTimeline({attack:()=>calls.push('attack'),impact:e=>calls.push(e.damage),schedule:()=>assert.fail('Reduced motion schedules no contact delay')});timeline.play({damage:14},true);assert.deepEqual(calls,[14]);
});


test('combat-only loading bay owns layered geometry, one shadow light and all material/texture cleanup',async()=>{
  const T=await import('../lib/three184/three.module.js');const loaded=[];
  class TextureLoader{async loadAsync(url){loaded.push(url);return new T.Texture();}}
  const scene=new T.Scene(),originalFog=scene.fog;const renderer={toneMapping:T.NoToneMapping,toneMappingExposure:1,capabilities:{getMaxAnisotropy:()=>4}};
  const stage=installCombatStage({...T,TextureLoader},{scene,renderer});await stage.ready;
  assert.equal(loaded.length,6);assert.ok(loaded.every(url=>url.includes('/assets/character/stage/')));
  const meshes=[],lights=[];stage.root.traverse(o=>{if(o.isMesh)meshes.push(o);if(o.isLight)lights.push(o);});
  assert.ok(meshes.some(o=>o.position.z>0),'foreground bollards');assert.ok(meshes.some(o=>o.position.z<-4.4),'recessed shutter/backwall');
  assert.ok(meshes.some(o=>Math.abs(o.position.x)>4),'return walls');assert.equal(lights.filter(o=>o.castShadow).length,1);
  assert.ok(meshes.length<65,'bounded background geometry');
  const resources=new Set();for(const mesh of meshes){resources.add(mesh.geometry);resources.add(mesh.material);for(const slot of ['map','normalMap','roughnessMap'])if(mesh.material[slot])resources.add(mesh.material[slot]);}
  const counts=new Map();for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  stage.dispose();stage.dispose();assert.equal(scene.children.includes(stage.root),false);assert.equal(scene.fog,originalFog);assert.ok([...resources].every(r=>counts.get(r)===1));
});


test('new encounter or settlement clears old replay text, damage cue and active visual animation',()=>{
  let cancelled=0;const impact={textContent:'−184',dataset:{side:'player'},getAnimations:()=>[{cancel(){cancelled++;}}]};const status={textContent:'Replay: previous rival hit previous player:184damage'};const doc={body:{dataset:{event:'hit'}},getElementById:id=>id==='combat-impact'?impact:status};
  clearCombatFeedback(doc,'Live encounter');assert.equal(impact.textContent,'');assert.equal(impact.dataset.side,undefined);assert.equal(status.textContent,'Live encounter');assert.equal(doc.body.dataset.event,undefined);assert.equal(cancelled,1);
  clearCombatFeedback(doc,'Encounter settled');assert.equal(status.textContent,'Encounter settled');assert.equal(impact.textContent,'');
});


test('PvP replay -> actual NPC turn0 and archive settlement reset feedback, ordinary version updates preserve contact timing',()=>{
  const prior={encounter:{id:'pvp-rayan',version:8,phase:'lost',log:[{...hit,actor:'opponent',d:184}]},result:null};
  const next={encounter:{id:'npc-dockside',version:2,phase:'fighting',turn:0,log:[]},result:null};
  const emitted=[],scheduled=new Map();let seq=0;const playback=createCombatPlayback({emit:event=>emitted.push(event),schedule:fn=>{scheduled.set(++seq,fn);return seq;},cancel:id=>scheduled.delete(id)});
  playback.ingest(prior.encounter);playback.replay();
  const status={textContent:'Replay: Rayan_Black hit BetaKeeper:184 damage'},impact={textContent:'−184',dataset:{side:'player'}};const doc={body:{dataset:{event:'hit'}},getElementById:id=>id==='combat-impact'?impact:status};
  assert.equal(combatFeedbackBoundary(prior,next),true);if(combatFeedbackBoundary(prior,next)){playback.stop();clearCombatFeedback(doc,'Live encounter');}playback.ingest(next.encounter);
  assert.equal(status.textContent,'Live encounter');assert.equal(impact.textContent,'');assert.equal(playback.pending,0);assert.equal(next.encounter.log.length,0);
  assert.equal(combatFeedbackBoundary(next,{...next,encounter:{...next.encounter,version:3,log:[hit]}}),false);
  assert.equal(combatFeedbackBoundary(prior,{...prior,result:{outcome:'lost',approach:'leave',cashDelta:0}}),true);
  assert.equal(combatFeedbackBoundary(prior,{encounter:null,result:null}),true);
});

test('combatExchangeSummary aggregates accuracy, damage, and bilingual tactical summary labels from server exchanges', () => {
  const sample = { id: 'enc-1', turn: 3, log: [
    { n: 1, actor: 'player', d: 15, yl: 95, ol: 85 },
    { n: 1, actor: 'opponent', d: 0, yl: 95, ol: 85 },
    { n: 2, actor: 'player', d: 20, yl: 95, ol: 65 },
    { n: 2, actor: 'opponent', d: 8, yl: 87, ol: 65 }
  ] };
  const en = combatExchangeSummary(sample, { player: 'Weni', opponent: 'Rival' }, 'en');
  assert.equal(en.turns, 3);
  assert.equal(en.exchanges, 4);
  assert.equal(en.playerHits, 2);
  assert.equal(en.playerDamageDealt, 35);
  assert.equal(en.playerAccuracyPct, 100);
  assert.equal(en.opponentHits, 1);
  assert.equal(en.opponentMisses, 1);
  assert.equal(en.opponentDamageDealt, 8);
  assert.equal(en.opponentAccuracyPct, 50);
  assert.equal(en.netDamage, 27);
  assert.match(en.summaryLabel, /Weni: 2\/2 \(35 dmg\).*Rival: 1\/2 \(8 dmg\)/);
  const ar = combatExchangeSummary(sample, { player: 'وني', opponent: 'خصم' }, 'ar');
  assert.match(ar.summaryLabel, /وني: 2\/2 \(35 ضرر\).*خصم: 1\/2 \(8 ضرر\)/);
  const timeline = createCombatFeedbackTimeline({ attack() {}, impact() {}, schedule: () => 42, cancel() {}, delay: 300 });
  assert.deepEqual(timeline.diagnostics(), { disposed: false, hasActiveTimer: false, delay: 300 });
  assert.equal(timeline.isDisposed(), false);
  assert.equal(timeline.hasActiveTimer(), false);
  timeline.play({ actor: 'player', target: 'opponent', kind: 'hit', damage: 10 }, false);
  assert.equal(timeline.diagnostics().hasActiveTimer, true);
  assert.equal(timeline.hasActiveTimer(), true);
  timeline.dispose();
  assert.deepEqual(timeline.diagnostics(), { disposed: true, hasActiveTimer: false, delay: 300 });
  assert.equal(timeline.isDisposed(), true);
  assert.equal(timeline.hasActiveTimer(), false);
  assert.equal(isResolvedEncounterPhase('won'), true);
  assert.equal(isResolvedEncounterPhase('fighting'), false);
  assert.deepEqual(resolvedEncounterPhases(), ['won', 'lost', 'fled', 'settled']);
  assert.equal(supportedCombatActionCount(), 7);
  assert.equal(defaultCombatSpacingMs(), 780);
  assert.equal(defaultCombatFeedbackDelayMs(), 340);
  assert.equal(resolveCombatClipName('slash'), 'Sword_Slash');
  assert.equal(resolveCombatClipName('unknown'), 'Idle');
  const h = harness();
  assert.equal(h.playback.isDisposed(), false);
  assert.equal(h.playback.isActive(), true);
  assert.equal(h.playback.hasLatest(), false);
  h.playback.ingest(encounter(2, [hit]));
  assert.equal(h.playback.hasLatest(), true);
  assert.equal(h.playback.currentIdentity(), 'actual-server-id');
  assert.equal(h.playback.currentVersion(), 2);
  h.playback.dispose();
  assert.equal(h.playback.isDisposed(), true);
  assert.deepEqual(supportedCombatActors(), ['player', 'opponent']);
  assert.equal(isSupportedCombatActor('player'), true);
  assert.equal(isSupportedCombatActor('spectator'), false);
  assert.deepEqual(supportedCombatEventKinds(), ['hit', 'block', 'miss']);
  assert.equal(combatStageGroupName(), 'ZONE staged loading bay');
  assert.equal(combatCameraMinDistance(), 4.3);
});

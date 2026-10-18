// Presentation only. Damage, turns, health and rewards belong to the server.
export function combatEvents(encounter) {
  return (encounter?.log || []).flatMap((row, index) => {
    if (!['player', 'opponent'].includes(row.actor) || !Number.isFinite(row.d) || row.d < 0 || !Number.isFinite(row.yl) || !Number.isFinite(row.ol)) return [];
    return [{ id: `${encounter.id}:${index}`, index, turn: row.n, actor: row.actor,
      target: row.actor === 'player' ? 'opponent' : 'player', damage: row.d,
      kind: row.d > 0 ? 'hit' : row.blocked === true ? 'block' : 'miss',
      playerHp: row.yl, enemyHp: row.ol }];
  });
}

export function combatEventLabel(event, names, lang = 'en') {
  const actor = names[event.actor] || event.actor, target = names[event.target] || event.target;
  if (event.kind === 'hit') return lang === 'ar' ? `${actor} أصاب ${target}: ${event.damage} ضرر` : `${actor} hit ${target}: ${event.damage} damage`;
  if (event.kind === 'block') return lang === 'ar' ? `${target} صدّ ضربة ${actor}` : `${target} blocked ${actor}`;
  return lang === 'ar' ? `${actor}: ضربة لم تصب` : `${actor} missed`;
}

// Appended events play once. Hydrated history is never silently replayed.
export function createCombatPlayback({ emit, schedule = setTimeout, cancel = clearTimeout, spacing = 780 }) {
  let identity = null, version = 0, count = 0, queue = [], timer = null, disposed = false, active = true, latest = null;
  const stop = () => { if (timer !== null) cancel(timer); timer = null; queue = []; };
  const pump = () => {
    if (disposed || !active || timer !== null || !queue.length) return;
    emit(queue.shift());
    if (queue.length) timer = schedule(() => { timer = null; pump(); }, spacing);
  };
  return {
    ingest(encounter) {
      if (disposed || !encounter) return;
      const nextVersion = Number(encounter.version || 0);
      if (identity === encounter.id && nextVersion < version) return;
      const events = combatEvents(encounter);
      if (identity !== encounter.id) { stop(); identity = encounter.id; count = events.length; }
      else if (events.length < count) { stop(); count = events.length; }
      else { queue.push(...events.slice(count).map(event => ({ ...event, replay: false }))); count = events.length; }
      version = nextVersion; latest = encounter;
      if (!active) stop(); else pump();
    },
    replay() { if (disposed || !active || !latest || latest.phase === 'fighting') return false; stop(); queue = combatEvents(latest).map(event => ({ ...event, replay: true })); pump(); return true; },
    setActive(value) { active = !!value; if (!active) stop(); },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); latest = null; },
    get pending() { return queue.length; }
  };
}

export const COMBAT_CLIPS = { idle: 'Idle', guard: 'Idle_Sword', punch: 'Punch_Right', slash: 'Sword_Slash', heavy: 'Kick_Right', hit: 'HitRecieve', down: 'Death' };
export function combatCameraDistance(aspect) { return Math.max(4.3, 1.65 / (Math.tan(36 * Math.PI/360) * Math.max(.3, aspect))); }
export function createCombatFeedbackTimeline({ attack, impact, schedule = setTimeout, cancel = clearTimeout, delay = 340 }) {
  let timer = null, disposed = false;
  const stop = () => { if (timer !== null) cancel(timer); timer = null; };
  return {
    play(event, reducedMotion = false) {
      if (disposed) return; stop();
      if (reducedMotion) { impact(event, false); return; }
      attack(event); timer = schedule(() => { timer = null; if (!disposed) impact(event, true); }, delay);
    }, stop, dispose() { disposed = true; stop(); }
  };
}
export function clearCombatFeedback(doc, statusText) {
  const impact = doc.getElementById('combat-impact');
  impact.getAnimations?.().forEach(animation => animation.cancel());
  impact.textContent = ''; delete impact.dataset.side;
  doc.getElementById('combat-status').textContent = statusText;
  delete doc.body.dataset.event;
}
export function combatFeedbackBoundary(previous, next) {
  return previous?.encounter?.id !== next?.encounter?.id || JSON.stringify(previous?.result || null) !== JSON.stringify(next?.result || null);
}
export function attackMotion(weapon, catalog = {}) {
  if (!weapon || weapon === 'fists') return 'punch';
  if (weapon === 'knife') return 'slash';
  if (weapon === 'bat') return 'heavy';
  return catalog[weapon]?.anim || 'punch';
}

// Original staging kit. It describes the encounter, not a simulated city location.
export function installCombatStage(T, { scene, renderer }) {
  const root = new T.Group(); root.name = 'ZONE staged loading bay'; scene.add(root);
  const materials = new Set(), geometries = new Set(), textures = new Set(); let disposed = false;
  const material = parameters => { const value = new T.MeshStandardMaterial(parameters); materials.add(value); return value; };
  const concrete = material({ color:0x757978, roughness:.94 }), brick = material({ color:0x666b69, roughness:.96 });
  const steel = material({ color:0x353f45, metalness:.7, roughness:.48 }), shutter = material({ color:0x52636b, metalness:.55, roughness:.72 });
  const paint = material({ color:0xa69163, roughness:.9 }), rubber = material({ color:0x1b2023, roughness:.94 });
  const lamp = material({ color:0xe9d9b5, emissive:0xe9c38a, emissiveIntensity:1.2, roughness:.4 });
  const mesh = (geometry, surface, position, rotation=[0,0,0]) => {
    geometries.add(geometry); const object = new T.Mesh(geometry,surface); object.position.set(...position); object.rotation.set(...rotation); object.castShadow=true; object.receiveShadow=true; root.add(object); return object;
  };
  const box = (size, surface, position) => mesh(new T.BoxGeometry(...size),surface,position);
  const floor = mesh(new T.PlaneGeometry(12,16),concrete,[0,-.012,-3],[-Math.PI/2,0,0]);
  const back = mesh(new T.PlaneGeometry(9,5),brick,[0,2.35,-4.8]);
  mesh(new T.PlaneGeometry(7,5),brick,[-4.5,2.35,-1.3],[0,Math.PI/2,0]);
  mesh(new T.PlaneGeometry(7,5),brick,[4.5,2.35,-1.3],[0,-Math.PI/2,0]);
  // Recessed freight shutter and lintel create an identifiable middle distance.
  box([2.6,2.95,.18],rubber,[0,1.46,-4.64]);
  for(let n=0;n<13;n++) box([2.38,.185,.055],shutter,[0,.17+n*.205,-4.48]);
  for(const x of [-1.32,1.32]) box([.11,3.1,.22],steel,[x,1.52,-4.38]);
  box([2.8,.18,.27],steel,[0,3.02,-4.36]); box([.34,.1,.05],rubber,[0,1.08,-4.42]);
  // Utility fittings, a shallow vent and conduit establish scale without noisy props.
  box([1.05,.5,.19],steel,[-2.7,2.46,-4.58]);
  for(let n=0;n<5;n++) box([.83,.027,.035],rubber,[-2.7,2.3+n*.08,-4.46]);
  for(const x of [-3.65,3.65]) {
    mesh(new T.CylinderGeometry(.045,.045,3.4,10),steel,[x,1.7,-4.38]);
    box([.34,.055,.08],steel,[x,.8,-4.32]); box([.34,.055,.08],steel,[x,2.5,-4.32]);
  }
  box([1.15,.12,.22],steel,[2.63,2.84,-4.38]); box([.95,.04,.04],lamp,[2.63,2.79,-4.25]);
  box([.62,.95,.08],steel,[2.68,1.45,-4.55]);
  for(const z of [-2.4,.32]) mesh(new T.PlaneGeometry(3.6,.045),paint,[0,.003,z],[-Math.PI/2,0,0]);
  for(const x of [-1.8,1.8]) mesh(new T.PlaneGeometry(.045,2.72),paint,[x,.003,-1.04],[-Math.PI/2,0,0]);
  for(const x of [-2.6,2.6]) {
    mesh(new T.CylinderGeometry(.12,.15,.58,12),rubber,[x,.29,.28]);
    mesh(new T.CylinderGeometry(.122,.122,.13,12),paint,[x,.42,.28]);
    box([.36,.045,.36],steel,[x,.018,.28]);
  }
  const key = new T.DirectionalLight(0xffdeb7,4.2); key.position.set(-3.1,4.4,2.4); key.castShadow=true;
  key.shadow.mapSize.set(1024,1024); key.shadow.normalBias=.015; key.shadow.bias=-.0002; key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4; root.add(key);
  const rim = new T.DirectionalLight(0xa4bcc8,2.4);rim.position.set(2.6,3.2,-2.8);root.add(rim);
  const fill = new T.HemisphereLight(0xa8b8c4,0x302a23,.9);root.add(fill);
  const practical = new T.PointLight(0xffd4a0,4,6);practical.position.set(2.6,2.65,-3.95);root.add(practical);
  const oldFog=scene.fog,oldTone=renderer.toneMapping,oldExposure=renderer.toneMappingExposure;
  scene.fog=new T.Fog(0x171d20,7,17);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  const loader=new T.TextureLoader();
  const surface=async(target,name,repeat)=>Promise.all([['map','Diffuse'],['normalMap','nor_gl'],['roughnessMap','Rough']].map(async([slot,channel])=>{
    const texture=await loader.loadAsync(new URL(`../assets/character/stage/${name}_${channel}_1k.jpg`,import.meta.url).href);
    if(disposed){texture.dispose();return;}texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(...repeat);texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(slot==='map')texture.colorSpace=T.SRGBColorSpace;textures.add(texture);target.material[slot]=texture;target.material.needsUpdate=true;target.material.normalScale.set(.4,.4);
  }));
  const ready=Promise.all([surface(floor,'concrete_floor_02',[4,5]),surface(back,'brick_wall_04',[3,1.8])]);
  // Return walls intentionally share the back wall material and its maps.
  return { root, ready, dispose(){if(disposed)return;disposed=true;scene.remove(root);scene.fog=oldFog;renderer.toneMapping=oldTone;renderer.toneMappingExposure=oldExposure;textures.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());geometries.forEach(value=>value.dispose());for(const light of [key,rim,fill,practical])light.dispose();} };
}

export async function mountCombatPresentation({ document: doc = document, window: win = window } = {}) {
  const [T, { GLTFLoader }, { OBJLoader }, { MTLLoader }, art, grip, poses, weapons, armor, uploaded] = await Promise.all([
    import('../lib/three184/three.module.js'), import('../lib/three184/GLTFLoader.js'), import('../lib/three184/OBJLoader.js'), import('../lib/three184/MTLLoader.js'),
    import('./character-presentation.js?v=114'), import('./character-grip.js?v=114'), import('./character-poses.js?v=114'), import('./weapon-assets.js?v=112'), import('./character-armor.mjs?v=114'), import('./uploaded-equipment108.mjs?v=108')
  ]);
  const $ = id => doc.getElementById(id), canvas = $('combat-canvas');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color(0x17191b);
  const camera = new T.PerspectiveCamera(36, 1, .1, 35);
  const stage = installCombatStage(T, { scene, renderer });
  stage.ready.catch(() => { if (!disposed) doc.body.dataset.stage = 'material-error'; });
  const publishUploaded = receipt => { doc.body.dataset['zoneUploaded' + receipt.slot[0].toUpperCase() + receipt.slot.slice(1)] = JSON.stringify(receipt); };
  const originalWeaponLoader = weapons.createWeaponAssetLoader({ THREE: T, GLTFLoader, OBJLoader, MTLLoader, catalog: win.ZONE_WEAPONS || {}, materials: win.ZONE_WEAPON_MATS || {}, pack: win.ZONE_WEAPON_PACK || {}, baseURL: new URL('../assets/weapons/', import.meta.url) });
  const weaponLoader = uploaded.createUploadedWeaponLoader(originalWeaponLoader, { publish: publishUploaded });
  const actors = {}, sources = new Set(), audioSources = new Set(), buffers = new Map();
  let packet = null, lang = 'en', frame = null, disposed = false, visible = true, inView = true, lastFrame = 0, elapsed = 0, lastMetrics = 0, audio = null, audioEnabled = false, loadSequence = 0, requestedSignature = null, lastFeedback = null;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const names = () => ({ player: packet?.player?.name || (lang === 'ar' ? 'أنت' : 'You'), opponent: packet?.opponentName || (lang === 'ar' ? 'الخصم' : 'Opponent') });
  let armorSource = null;
  const loadArmorSource = () => {
    if (armorSource) return armorSource;
    armorSource = new Promise((resolve, reject) => {
      let settled = false;
      const timer = win.setTimeout(() => { settled = true; armorSource = null; reject(new Error('Optional worn armor timed out')); }, 8000);
      new GLTFLoader().loadAsync(new URL('../assets/character/quaternius/Swat.glb', import.meta.url).href).then(gltf => {
        if (settled || disposed) { art.disposeCharacterResources([gltf.scene]); return; }
        settled = true; win.clearTimeout(timer); sources.add(gltf.scene); resolve(gltf);
      }, error => { if (settled) return; settled = true; win.clearTimeout(timer); armorSource = null; reject(error); });
    });
    return armorSource;
  };
  const status = text => { $('combat-status').textContent = text; };
  const play = (actor, motion) => {
    if (!actor) return;
    const profile = poses.weaponPoseProfile(actor.weapon, win.ZONE_WEAPONS);
    const attack = ['punch','slash','heavy','combo'].includes(motion);
    const clipName = attack && profile !== 'unarmed' ? (['handgun','longgun'].includes(profile) ? 'Gun_Shoot' : 'Sword_Slash') : COMBAT_CLIPS[motion];
    const clip = actor.clips[clipName] || actor.clips[motion] || actor.clips.Idle;
    if (!clip) return;
    const previous = actor.action; const action = actor.mixer.clipAction(clip); action.reset();
    action.setLoop(['idle','guard'].includes(motion) ? T.LoopRepeat : T.LoopOnce, Infinity); action.clampWhenFinished = true;
    action.play(); if (previous && previous !== action) { previous.fadeOut(.12); action.fadeIn(.12); }
    actor.action = action; actor.motion = motion;
  };
  async function loadActor(side, outfit, weapon, equipment = {}) {
    const file = ({ suit: 'Suit', street: 'Casual_Hoodie', tactical: 'Swat' })[outfit] || 'Suit';
    const token = loadSequence;
    const retained = () => new GLTFLoader().loadAsync(new URL(`../assets/character/quaternius/${file}.glb`, import.meta.url).href);
    const gltf = side === 'player' && equipment.characterMediaAsset ? await uploaded.loadUploadedCharacter(equipment.characterMediaAsset, retained, { publish: publishUploaded, draft: equipment.draft === true }) : await retained();
    if (disposed || token !== loadSequence) { if (gltf.uploadedMedia) gltf.uploadedMedia.dispose(); else art.disposeCharacterResources([gltf.scene]); return; }
    art.validateCharacterWardrobe(T, gltf); if (!gltf.uploadedMedia) art.prepareCharacterArt(T, gltf.scene);
    const root = gltf.scene, clips = Object.fromEntries(gltf.animations.map(clip => [clip.name, clip])); root.userData.outfit = file;
    root.traverse(object => { if (object.isMesh) { object.castShadow = true; object.frustumCulled = false; } });
    root.position.x = side === 'player' ? -.75 : .75; root.rotation.y = side === 'player' ? .68 : -.68;
    scene.add(root); sources.add(root);
    const actor = { root, clips, mixer: new T.AnimationMixer(root), weapon: weapon || 'fists', signature: `${outfit}:${weapon}`, materials: [], impact: 0, uploadedMedia: gltf.uploadedMedia };
    root.traverse(object => { for (const material of object.isMesh ? (Array.isArray(object.material) ? object.material : [object.material]) : []) if (material.emissive && !actor.materials.some(entry => entry.material === material)) actor.materials.push({ material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity }); });
    const nativeArmor = armor.createArmorController({ THREE: T, loadSource: loadArmorSource, publish: receipt => { if (side === 'player') doc.body.dataset.zoneCombatArmor = JSON.stringify(receipt); } });
    actor.armor = equipment.armorMediaAsset ? uploaded.createUploadedArmorController(nativeArmor, { publish: receipt => { if (side === 'player') { publishUploaded(receipt); doc.body.dataset.zoneCombatArmor = JSON.stringify(receipt); } } }) : nativeArmor;
    actors[side] = actor; play(actor, 'guard'); actor.mixer.update(.01); root.updateMatrixWorld(true);
    actor.grip = grip.prepareCharacterGrip(T, root, clips); actor.pose = poses.prepareWeaponPose(T, root, actor.grip);
    actor.mixer.addEventListener('finished', () => { if (!disposed && actor.motion !== 'down') play(actor, 'guard'); });
    if (side === 'player' && weapon && weapon !== 'fists') {
      const mesh = await weaponLoader.load(weapon, equipment.weaponMediaAsset, { draft: equipment.draft === true });
      if (disposed || token !== loadSequence || actors[side] !== actor) { weaponLoader.release(mesh); return; }
      if (mesh) { const fit = mesh.userData.zoneWeaponAsset; actor.mesh = mesh; actor.held = grip.attachHeldWeapon(T, actor.grip, mesh, fit.gripPoint, fit.axis, fit.forward); }
    }
    if (side === 'player') actor.armor.update(packet?.player || {}, root);
    size();
  }
  function releaseActor(actor) {
    if (!actor) return; actor.armor?.dispose(); actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root);
    if (actor.held) actor.held.parent?.remove(actor.held); weaponLoader.release(actor.mesh);
    scene.remove(actor.root); sources.delete(actor.root); if (actor.uploadedMedia) actor.uploadedMedia.dispose(); else art.disposeCharacterResources([actor.root]);
  }
  const sound = kind => {
    if (!audioEnabled || audio?.state !== 'running' || !buffers.has(kind) || !visible) return;
    const source = audio.createBufferSource(), gain = audio.createGain(); source.buffer = buffers.get(kind); gain.gain.value = .3;
    source.connect(gain).connect(audio.destination); source.onended = () => { audioSources.delete(source); source.disconnect(); gain.disconnect(); }; audioSources.add(source); source.start();
  };
  const impact = (event, motion) => {
    lastFeedback = event;
    status((event.replay ? (lang === 'ar' ? 'إعادة عرض: ' : 'Replay: ') : '') + combatEventLabel(event, names(), lang));
    doc.body.dataset.event = event.kind;
    if (motion) {
      const defeated = (event.target === 'player' ? event.playerHp : event.enemyHp) === 0;
      play(actors[event.target], defeated ? 'down' : event.kind === 'hit' ? 'hit' : 'guard');
      if (event.kind === 'hit' && actors[event.target]) actors[event.target].impact = .22;
      $('combat-impact').textContent = event.kind === 'hit' ? `−${event.damage}` : event.kind === 'block' ? (lang === 'ar' ? 'صدّ' : 'BLOCK') : (lang === 'ar' ? 'لم تصب' : 'MISS');
      $('combat-impact').dataset.side = event.target;
      $('combat-impact').getAnimations?.().forEach(animation => animation.cancel());
      $('combat-impact').animate?.([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-22px)' }], { duration: 620 });
    }
    sound(event.kind);
  };
  const feedback = createCombatFeedbackTimeline({
    attack: event => play(actors[event.actor], event.actor === 'player' ? attackMotion(packet?.player?.weapon, win.ZONE_WEAPONS) : 'punch'), impact
  });
  const playback = createCombatPlayback({ emit: event => feedback.play(event, reduced.matches) });
  function labels() {
    doc.documentElement.lang = lang; doc.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('combat-player-name').textContent = names().player; $('combat-opponent-name').textContent = names().opponent;
    $('combat-model-note').textContent = lang === 'ar' ? 'الخصم: نموذج توضيحي. المظهر والتجهيز غير منشورين.' : 'Opponent: representative rig. Appearance and equipment are not published.';
    $('combat-audio').textContent = audioEnabled ? (lang === 'ar' ? 'كتم الصوت' : 'Mute sound') : (lang === 'ar' ? 'تشغيل الصوت' : 'Enable sound');
    $('combat-audio').setAttribute('aria-pressed', String(audioEnabled));
    $('combat-retry').textContent = lang === 'ar' ? 'إعادة تحميل العرض' : 'Retry scene';
    $('combat-replay').textContent = lang === 'ar' ? 'إعادة عرض السجل' : 'Replay recorded exchanges';
    $('combat-replay').disabled = !packet?.encounter || packet.encounter.phase === 'fighting' || !packet.encounter.log?.length;
    canvas.setAttribute('aria-label', lang === 'ar' ? 'تصوير المواجهة. الصحة والضرر مصدرهما الخادم.' : 'Encounter presentation. Health and damage come from the server.');
  }
  async function receive(data) {
    if (disposed || !data || !['en','ar'].includes(data.lang)) return;
    const previousId = packet?.encounter?.id, resetFeedback = combatFeedbackBoundary(packet, data), languageChanged = lang !== data.lang;
    packet = data; lang = data.lang; labels();
    const identityChanged = previousId !== data.encounter?.id;
    if (identityChanged) { feedback.stop(); for (const actor of Object.values(actors)) { actor.impact = 0; play(actor, 'guard'); } }
    if (actors.opponent) actors.opponent.root.visible = !!data.encounter;
    const encounter = data.encounter;
    const title = data.result ? (lang === 'ar' ? 'تمت تسوية المواجهة' : 'Encounter settled') : encounter ? ({ fighting: lang === 'ar' ? 'مواجهة نشطة' : 'Live encounter', won: lang === 'ar' ? 'انتصار مسجل' : 'Victory recorded', lost: lang === 'ar' ? 'هزيمة مسجلة' : 'Defeat recorded', stalemate: lang === 'ar' ? 'تعادل مسجل' : 'Stalemate recorded' }[encounter.phase] || (lang === 'ar' ? 'نتيجة مسجلة' : 'Recorded outcome')) : (lang === 'ar' ? 'اختر خصماً لبدء مواجهة' : 'Choose an opponent to start an encounter');
    $('combat-state').textContent = title;
    if (resetFeedback) { playback.stop(); feedback.stop(); lastFeedback = null; clearCombatFeedback(doc, title); }
    else if (languageChanged) status(lastFeedback ? (lastFeedback.replay ? (lang === 'ar' ? 'إعادة عرض: ' : 'Replay: ') : '') + combatEventLabel(lastFeedback, names(), lang) : title);
    if (encounter) playback.ingest(encounter);
    actors.player?.armor?.update(data.player || {}, actors.player.root);
    const signature = JSON.stringify([data.player?.outfit || 'suit', data.player?.weapon || 'fists', data.player?.characterMediaAsset || null, data.player?.weaponMediaAsset || null, data.player?.armorMediaAsset || null]);
    if (requestedSignature !== signature) {
      requestedSignature = signature;
      loadSequence++; releaseActor(actors.player); releaseActor(actors.opponent); delete actors.player; delete actors.opponent;
      status(lang === 'ar' ? 'تحميل شخصيات المواجهة...' : 'Loading encounter rigs...');
      try { await Promise.all([loadActor('player', data.player?.outfit || 'suit', data.player?.weapon || 'fists', data.player || {}), loadActor('opponent', 'street', 'fists')]); if (!disposed && actors.opponent) { actors.opponent.root.visible = !!packet?.encounter; doc.body.dataset.ready = 'true'; $('combat-retry').hidden = true; status(title); } }
      catch (error) { if (!disposed) { doc.body.dataset.ready = 'error'; $('combat-retry').hidden = false; status(lang === 'ar' ? 'تعذر تحميل العرض. سجل القتال وأزراره ما زالت متاحة.' : 'Scene could not load. Combat log and controls remain available.'); } }
    }
    updateVisibility();
  }
  function size() {
    const width = canvas.clientWidth || 640, height = canvas.clientHeight || 330;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.position.set(0, 1.6, combatCameraDistance(camera.aspect)); camera.lookAt(0, .95, 0); camera.updateProjectionMatrix();
  }
  function tick(now) {
    frame = null; if (disposed || !visible) return;
    const dt = Math.min(.05, Math.max(0, (now-lastFrame)/1000)); lastFrame = now; elapsed += dt;
    for (const actor of Object.values(actors)) {
      if (!reduced.matches) actor.mixer.update(dt);
      actor.impact = reduced.matches ? 0 : Math.max(0, actor.impact-dt);
      for (const entry of actor.materials) { entry.material.emissive.copy(entry.emissive); entry.material.emissiveIntensity = entry.intensity; if (actor.impact) { entry.material.emissive.set(0x63332b); entry.material.emissiveIntensity = actor.impact*1.8; } }
      grip.applyCharacterGrip(actor.grip); actor.root.updateMatrixWorld(true);
      if (actor.held) poses.applyWeaponPose(actor.pose, actor.held, { profile: poses.weaponPoseProfile(actor.weapon, win.ZONE_WEAPONS), action: actor.motion, phase: actor.action.time/actor.action.getClip().duration });
    }
    renderer.render(scene, camera);
    if (now-lastMetrics>1000) { lastMetrics=now; doc.body.dataset.zoneCombatMetrics = JSON.stringify({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, dpr: renderer.getPixelRatio() }); }
    frame = win.requestAnimationFrame(tick);
  }
  function updateVisibility() {
    visible = !disposed && inView && doc.visibilityState !== 'hidden' && packet?.active !== false;
    playback.setActive(visible);
    if (!visible) { feedback.stop(); if (frame !== null) win.cancelAnimationFrame(frame); frame = null; for (const source of audioSources) source.stop(); audioSources.clear(); audio?.suspend(); }
    else { if (audioEnabled) audio?.resume(); if (frame === null) { lastFrame=win.performance.now(); frame=win.requestAnimationFrame(tick); } }
  }
  const onMessage = event => { if (event.source === win.parent && event.origin === win.location.origin && event.data?.zoneCombat) receive(event.data.zoneCombat); };
  win.addEventListener('message', onMessage); doc.addEventListener('visibilitychange', updateVisibility);
  const resize = new win.ResizeObserver(size); resize.observe(canvas); size();
  const intersection = win.IntersectionObserver ? new win.IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); updateVisibility(); }, { threshold: 0 }) : null;
  intersection?.observe(canvas);
  $('combat-replay').onclick = () => { feedback.stop(); playback.replay(); };
  $('combat-retry').onclick = () => { requestedSignature = null; receive(packet); };
  $('combat-audio').onclick = async () => {
    if (audioEnabled) { audioEnabled=false; for (const source of audioSources) source.stop(); audioSources.clear(); labels(); return; }
    try {
      if (!audio) audio = new (win.AudioContext || win.webkitAudioContext)(); await audio.resume();
      for (const kind of ['hit','miss','block']) if (!buffers.has(kind)) { const response = await fetch(new URL(`../assets/ui/combat-audio/${kind}.wav`, import.meta.url)); if (!response.ok) throw new Error('Audio unavailable'); buffers.set(kind, await audio.decodeAudioData(await response.arrayBuffer())); }
      if (disposed) return; audioEnabled=true; labels();
    } catch { status(lang === 'ar' ? 'الصوت غير متاح. التغذية البصرية مستمرة.' : 'Sound unavailable. Visual feedback remains active.'); }
  };
  function dispose() {
    if (disposed) return; disposed=true; playback.dispose(); feedback.dispose(); updateVisibility(); resize.disconnect(); intersection?.disconnect();
    win.removeEventListener('message', onMessage); doc.removeEventListener('visibilitychange', updateVisibility); win.removeEventListener('pagehide', dispose);
    for (const actor of Object.values(actors)) releaseActor(actor); art.disposeCharacterResources([...sources]); sources.clear(); weaponLoader.dispose(); stage.dispose();
    renderer.dispose(); renderer.forceContextLoss(); audio?.close(); buffers.clear();
  }
  win.addEventListener('pagehide', dispose, { once: true });
  win.parent.postMessage({ zoneCombatReady: true }, win.location.origin);
  return { receive, dispose, playback };
}

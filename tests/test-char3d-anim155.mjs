/* ==========================================================================
 * ZONE v155 - TRACK 1 VERIFICATION SUITE (`tests/test-char3d-anim155.mjs`)
 * Verifies:
 *   1. Articulated `createRiggedOperative3D` hierarchy & local r184-only imports
 *   2. All 3 outfits (`street`, `suit`, `tactical`) & all 6 role variants
 *   3. All 8 `THREE.AnimationClip`s (`InterpolateSmooth`) advancing bone
 *      quaternions via `mixer.update(0.1)` + ragdoll `ko_collapse` clamping
 *   4. Smooth `crossFadeTo` (`0.18s`) weight blending & auto-return on finish
 *   5. `zone-ecs-3d-bridge.js`: pre-engine `__ZoneRiggedOperative` registration,
 *      instant `0ms` `#zone-char-3d` `character-turntable` overlay, zero
 *      `MutationObserver` (<200ms) watchdog starvation, and smooth hide/restore
 *      when `dist/character3d.html` transitions to/from `ready`
 * ========================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three184/three.module.js';
import {
  createRiggedOperative3D,
  buildOperativeAnimationClips,
  OPERATIVE_OUTFITS,
  OPERATIVE_ROLES,
  OPERATIVE_CLIP_NAMES,
  OPERATIVE_BONE_NAMES,
} from '../assets/ui/zone-3d-rigged-operative.mjs';

const ROOT_URL = new URL('../', import.meta.url);

test('1. zone-3d-rigged-operative.mjs uses vendored Three.js r184 only and registers globalThis.__ZoneRiggedOperative', () => {
  const src = readFileSync(new URL('assets/ui/zone-3d-rigged-operative.mjs', ROOT_URL), 'utf8');
  assert.doesNotMatch(src, /https?:\/\//i, 'Must contain zero external CDN URLs');
  assert.match(src, /\.\.\/\.\.\/lib\/three184\/three\.module\.js/);
  assert.ok(globalThis.__ZoneRiggedOperative, 'globalThis.__ZoneRiggedOperative must be registered');
  assert.equal(globalThis.__ZoneRiggedOperative.createRiggedOperative3D, createRiggedOperative3D);
});

test('2. createRiggedOperative3D builds exact bone/pivot hierarchy, grounded soles, and prop mounting', () => {
  const op = createRiggedOperative3D(THREE, { outfit: 'street', role: 'player', weaponId: 'ak' });
  assert.ok(op.isGroup, 'Operative root must be a THREE.Group');
  const rig = op.userData.z3dRig;
  assert.ok(rig, 'group.userData.z3dRig must be attached');
  assert.ok(rig.mixer instanceof THREE.AnimationMixer, 'z3dRig.mixer must be THREE.AnimationMixer');

  for (const boneName of OPERATIVE_BONE_NAMES) {
    const found = op.getObjectByName(boneName);
    assert.ok(found, `Missing required bone/pivot: ${boneName}`);
    assert.equal(rig.bones[boneName], found);
  }

  // Verify exact anatomical parent -> child hierarchy
  assert.equal(rig.bones.Pelvis.parent, op);
  assert.equal(rig.bones.Torso.parent, rig.bones.Pelvis);
  assert.equal(rig.bones.Chest.parent, rig.bones.Torso);
  assert.equal(rig.bones.Neck.parent, rig.bones.Chest);
  assert.equal(rig.bones.Head.parent, rig.bones.Neck);

  assert.equal(rig.bones.ShoulderL.parent, rig.bones.Chest);
  assert.equal(rig.bones.ElbowL.parent, rig.bones.ShoulderL);
  assert.equal(rig.bones.WristL.parent, rig.bones.ElbowL);

  assert.equal(rig.bones.ShoulderR.parent, rig.bones.Chest);
  assert.equal(rig.bones.ElbowR.parent, rig.bones.ShoulderR);
  assert.equal(rig.bones.WristR.parent, rig.bones.ElbowR);
  assert.equal(rig.bones.WeaponMountR.parent, rig.bones.WristR);

  assert.equal(rig.bones.HipL.parent, rig.bones.Pelvis);
  assert.equal(rig.bones.KneeL.parent, rig.bones.HipL);
  assert.equal(rig.bones.AnkleL.parent, rig.bones.KneeL);

  assert.equal(rig.bones.HipR.parent, rig.bones.Pelvis);
  assert.equal(rig.bones.KneeR.parent, rig.bones.HipR);
  assert.equal(rig.bones.AnkleR.parent, rig.bones.KneeR);

  // Verify grounded feet & substantial detailed mesh geometry
  op.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(op);
  assert.ok(Math.abs(box.min.y) < 0.08, `Feet should rest near y=0, got min.y=${box.min.y}`);
  assert.ok(box.max.y > 1.35 && box.max.y < 1.75, `Expected realistic operative height, got max.y=${box.max.y}`);

  // Verify attachProp parents custom 3D mesh onto WeaponMountR
  const customBlade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.45), new THREE.MeshBasicMaterial());
  customBlade.name = 'CustomSyndicateKatana';
  rig.attachProp(customBlade);
  assert.equal(customBlade.parent, rig.bones.WeaponMountR);
  assert.equal(op.getObjectByName('CustomSyndicateKatana'), customBlade);

  rig.dispose();
});

test('3. All 3 outfits (street, suit, tactical) and all 6 role variants construct and hot-swap cleanly', () => {
  for (const role of OPERATIVE_ROLES) {
    const op = createRiggedOperative3D(THREE, { role });
    assert.equal(op.userData.role, role);
    assert.ok(OPERATIVE_OUTFITS.includes(op.userData.outfit));
    op.userData.z3dRig.dispose();
  }

  const op = createRiggedOperative3D({ outfit: 'street', role: 'player' }); // Also verifies 1-arg opts form
  const rig = op.userData.z3dRig;
  const streetChest = op.getObjectByName('OutfitStreetChest');
  const suitChest = op.getObjectByName('OutfitSuitChest');
  const tactChest = op.getObjectByName('OutfitTacticalChest');
  const tactHead = op.getObjectByName('OutfitTacticalHead');

  assert.equal(rig.outfit, 'street');
  assert.equal(streetChest.visible, true);
  assert.equal(suitChest.visible, false);
  assert.equal(tactChest.visible, false);

  assert.equal(rig.setOutfit('suit'), 'suit');
  assert.equal(op.userData.outfit, 'suit');
  assert.equal(streetChest.visible, false);
  assert.equal(suitChest.visible, true);
  assert.equal(tactChest.visible, false);

  assert.equal(rig.setOutfit('tactical'), 'tactical');
  assert.equal(op.userData.outfit, 'tactical');
  assert.equal(streetChest.visible, false);
  assert.equal(suitChest.visible, false);
  assert.equal(tactChest.visible, true);
  assert.equal(tactHead.visible, true);

  // Arabic keyword support
  assert.equal(rig.setOutfit('بدلة رسمية'), 'suit');
  assert.equal(suitChest.visible, true);

  rig.dispose();
});

test('4. All 8 AnimationClips use InterpolateSmooth, pass validate(), and advance bone quaternions on mixer.update(0.1)', () => {
  const clips = buildOperativeAnimationClips(THREE);
  assert.deepEqual(Object.keys(clips), [...OPERATIVE_CLIP_NAMES]);

  for (const clipName of OPERATIVE_CLIP_NAMES) {
    const clip = clips[clipName];
    assert.ok(clip instanceof THREE.AnimationClip, `${clipName} must be THREE.AnimationClip`);
    assert.equal(clip.validate(), true, `${clipName} failed clip.validate()`);

    let hasQuatTrack = false;
    let hasVecTrack = false;
    for (const track of clip.tracks) {
      assert.equal(
        track.getInterpolation(),
        THREE.InterpolateSmooth,
        `${clipName} track ${track.name} must use THREE.InterpolateSmooth`
      );
      if (track instanceof THREE.QuaternionKeyframeTrack) hasQuatTrack = true;
      if (track instanceof THREE.VectorKeyframeTrack) hasVecTrack = true;
    }
    assert.ok(hasQuatTrack, `${clipName} must contain QuaternionKeyframeTrack`);
    assert.ok(hasVecTrack, `${clipName} must contain VectorKeyframeTrack`);

    // Instantiate operative on this clip and verify mixer.update(0.1) advances bone quaternions
    const op = createRiggedOperative3D(THREE, { initialClip: clipName });
    const rig = op.userData.z3dRig;
    assert.equal(rig.currentClip, clipName);

    const trackedBones = ['Pelvis', 'Torso', 'Chest', 'Head', 'ShoulderR', 'ElbowR', 'HipL', 'KneeL'];
    const beforeQuats = trackedBones.map((b) => rig.bones[b].quaternion.clone());
    const beforePelvisPos = rig.bones.Pelvis.position.clone();

    rig.mixer.update(0.1);

    let totalQuatAngleDelta = 0;
    for (let i = 0; i < trackedBones.length; i++) {
      const qAfter = rig.bones[trackedBones[i]].quaternion;
      assert.ok(!Number.isNaN(qAfter.x) && !Number.isNaN(qAfter.w), `${clipName} produced NaN quaternion`);
      assert.ok(Math.abs(qAfter.length() - 1) < 1e-3, `${clipName} quaternion must stay normalized`);
      totalQuatAngleDelta += beforeQuats[i].angleTo(qAfter);
    }
    const posDelta = beforePelvisPos.distanceTo(rig.bones.Pelvis.position);
    assert.ok(
      totalQuatAngleDelta > 0.02,
      `${clipName} failed to advance bone quaternions on mixer.update(0.1): delta=${totalQuatAngleDelta}`
    );
    assert.ok(
      posDelta > 0.0005,
      `${clipName} failed to advance Pelvis.position on mixer.update(0.1): posDelta=${posDelta}`
    );

    rig.dispose();
  }
});

test('5. z3dRig.playState crossFadeTo(0.18s) blends weights smoothly, auto-returns from combat clips, and clamps ko_collapse', () => {
  const op = createRiggedOperative3D(THREE, { outfit: 'tactical', role: 'player', initialClip: 'idle_breathe' });
  const rig = op.userData.z3dRig;

  assert.equal(rig.currentClip, 'idle_breathe');
  assert.ok(Math.abs(rig.actions.idle_breathe.getEffectiveWeight() - 1) < 1e-4);

  // Trigger 0.18s crossFadeTo combat_stance
  rig.playState('combat_stance', 0.18);
  assert.equal(rig.currentClip, 'combat_stance');

  // Halfway through 0.18s crossfade (t = 0.09s): both clips have active ~0.5 blend weights
  rig.update(0.09);
  const wIdleMid = rig.actions.idle_breathe.getEffectiveWeight();
  const wCombatMid = rig.actions.combat_stance.getEffectiveWeight();
  assert.ok(wIdleMid > 0.25 && wIdleMid < 0.75, `Expected mid-fade idle weight ~0.5, got ${wIdleMid}`);
  assert.ok(wCombatMid > 0.25 && wCombatMid < 0.75, `Expected mid-fade combat weight ~0.5, got ${wCombatMid}`);

  // Complete crossfade (t = 0.22s): combat_stance reaches full weight 1.0, idle_breathe reaches 0.0
  rig.update(0.13);
  assert.ok(rig.actions.idle_breathe.getEffectiveWeight() < 0.01);
  assert.ok(Math.abs(rig.actions.combat_stance.getEffectiveWeight() - 1) < 0.01);

  // One-shot melee_slash auto-transitions back to base loop (combat_stance) upon finishing
  rig.playState('melee_slash', 0.18);
  assert.equal(rig.currentClip, 'melee_slash');
  for (let step = 0; step < 10; step++) rig.update(0.1);
  assert.equal(rig.currentClip, 'combat_stance', 'One-shot action should return to base stance on finish');

  // ko_collapse clamps collapsed ragdoll pose on floor
  rig.playState('ko_collapse', 0.18);
  assert.equal(rig.currentClip, 'ko_collapse');
  for (let step = 0; step < 15; step++) rig.update(0.1);
  assert.equal(rig.currentClip, 'ko_collapse', 'ko_collapse must stay clamped until revived');
  assert.ok(
    rig.bones.Pelvis.position.y < 0.22,
    `Expected collapsed Pelvis near floor (<0.22), got y=${rig.bones.Pelvis.position.y}`
  );

  rig.dispose();
});

test('6. zone-ecs-3d-bridge.js mounts #zone-char-3d character-turntable at 0ms without <200ms MutationObserver starvation and hides cleanly when native WebGL is ready', async () => {
  const bridgeSrc = readFileSync(new URL('assets/ui/zone-ecs-3d-bridge.js', ROOT_URL), 'utf8');

  class MockNode {
    constructor(tagName = 'DIV') {
      this.tagName = String(tagName).toUpperCase();
      this.id = '';
      this.className = '';
      this.textContent = '';
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.listeners = new Map();
      this.isConnected = true;
      const selfStyle = { display: '', opacity: '', pointerEvents: '', position: '', overflow: '' };
      Object.defineProperty(selfStyle, 'cssText', {
        get() {
          return this._raw || '';
        },
        set(v) {
          this._raw = String(v || '');
          if (/display\s*:\s*none/i.test(this._raw)) this.display = 'none';
          else this.display = '';
          const opMatch = this._raw.match(/opacity\s*:\s*([0-9.]+)/i);
          if (opMatch) this.opacity = opMatch[1];
          const peMatch = this._raw.match(/pointer-events\s*:\s*([a-z-]+)/i);
          if (peMatch) this.pointerEvents = peMatch[1];
        },
      });
      this.style = selfStyle;
    }

    setAttribute(k, v) {
      const val = String(v);
      this.attributes.set(k, val);
      if (k === 'id') this.id = val;
      if (k === 'class') this.className = val;
    }

    getAttribute(k) {
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }

    hasAttribute(k) {
      return this.attributes.has(k);
    }

    removeAttribute(k) {
      this.attributes.delete(k);
    }

    appendChild(child) {
      child.parentElement = this;
      child.isConnected = true;
      this.children.push(child);
      return child;
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }

    closest(selector) {
      let cur = this;
      while (cur) {
        if (matchesSelector(cur, selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
      const out = [];
      const visit = (node) => {
        for (const ch of node.children) {
          if (parts.some((p) => matchesSelector(ch, p))) out.push(ch);
          visit(ch);
        }
      };
      visit(this);
      return out;
    }
  }

  function matchesSelector(node, sel) {
    if (!node || !sel) return false;
    if (sel === 'canvas') return node.tagName === 'CANVAS';
    if (sel === 'button') return node.tagName === 'BUTTON';
    if (sel === 'canvas:not(.z3d-stage-webgl-canvas)') {
      return node.tagName === 'CANVAS' && !String(node.className).includes('z3d-stage-webgl-canvas');
    }
    if (sel.startsWith('#')) return node.id === sel.slice(1);
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return String(node.className || '').split(/\s+/).includes(cls);
    }
    const attrEq = sel.match(/^\[([a-z0-9_-]+)="([^"]+)"\]$/i);
    if (attrEq) return node.getAttribute(attrEq[1]) === attrEq[2];
    const attrOnly = sel.match(/^\[([a-z0-9_-]+)\]$/i);
    if (attrOnly) return node.hasAttribute(attrOnly[1]);
    return false;
  }

  let fakeNow = 100000;
  let nextTimerId = 1;
  const activeTimers = new Map();
  let clearTimeoutCalls = 0;
  const importOrder = [];
  const runtimeCalls = [];
  let observerCallback = null;
  const rafQueue = [];
  const winListeners = new Map();
  const docListeners = new Map();

  const htmlEl = new MockNode('HTML');
  htmlEl.dir = 'ltr';
  htmlEl.lang = 'en';
  const bodyEl = new MockNode('BODY');
  htmlEl.appendChild(bodyEl);

  const mainEl = new MockNode('MAIN');
  mainEl.setAttribute('id', 'zone-main');
  mainEl.setAttribute('data-zone-screen', 'home');
  bodyEl.appendChild(mainEl);

  const stageHost = new MockNode('DIV');
  stageHost.className = 'zone-character-stage';
  mainEl.appendChild(stageHost);

  const iframeEl = new MockNode('IFRAME');
  iframeEl.setAttribute('id', 'zone-char-3d');
  const iframeBody = new MockNode('BODY');
  iframeBody.dataset = { zoneMediaState: 'loading' };
  const iframeCanvas = new MockNode('CANVAS');
  iframeCanvas.width = 0;
  iframeCanvas.height = 0;
  iframeBody.appendChild(iframeCanvas);
  iframeEl.contentDocument = {
    body: iframeBody,
    getElementById: () => null,
    querySelector: (s) => iframeBody.querySelector(s),
  };
  stageHost.appendChild(iframeEl);

  const suitBtn = new MockNode('BUTTON');
  suitBtn.setAttribute('data-outfit', 'suit');
  suitBtn.setAttribute('aria-pressed', 'false');
  mainEl.appendChild(suitBtn);

  const mockDocument = {
    readyState: 'complete',
    documentElement: htmlEl,
    body: bodyEl,
    getElementById(id) {
      if (id === 'zone-main') return mainEl;
      if (id === 'zone-char-3d') return iframeEl;
      return htmlEl.querySelector('#' + id);
    },
    querySelector(sel) {
      if (sel.includes('[data-outfit][aria-pressed="true"]')) {
        return suitBtn.getAttribute('aria-pressed') === 'true' ? suitBtn : null;
      }
      return htmlEl.querySelector(sel);
    },
    querySelectorAll(sel) {
      if (sel === '.zone-home-character .zone-panel-heading button') return [];
      return htmlEl.querySelectorAll(sel);
    },
    createElement(tag) {
      return new MockNode(tag);
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
  };

  class MockMutationObserver {
    constructor(cb) {
      observerCallback = cb;
    }
    observe() {}
    disconnect() {}
  }

  let riggedWasReadyBeforeEngine = false;
  const mockGlobal = {
    Date: { now: () => fakeNow },
    WeakMap,
    Promise,
    String,
    Number,
    Math,
    Object,
    Array,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    MutationObserver: MockMutationObserver,
    document: mockDocument,
    console: { warn() {} },
    setTimeout(fn, ms) {
      const id = nextTimerId++;
      activeTimers.set(id, { fn, dueAt: fakeNow + ms, ms });
      return id;
    },
    clearTimeout(id) {
      clearTimeoutCalls++;
      activeTimers.delete(id);
    },
    requestAnimationFrame(fn) {
      rafQueue.push(fn);
      return rafQueue.length;
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent() {},
    __mockImport(specifier) {
      importOrder.push(specifier);
      if (specifier.includes('zone-3d-rigged-operative.mjs')) {
        mockGlobal.__ZoneRiggedOperative = { createRiggedOperative3D };
        return Promise.resolve({ createRiggedOperative3D });
      }
      if (specifier.includes('zone-ecs-3d-engine.mjs')) {
        riggedWasReadyBeforeEngine = Boolean(
          mockGlobal.__ZoneRiggedOperative &&
          typeof mockGlobal.__ZoneRiggedOperative.createRiggedOperative3D === 'function'
        );
        return Promise.resolve({
          createZoneEcs3DRuntime() {
            return {
              scan(root) {
                runtimeCalls.push({ method: 'scan', root });
                return 1;
              },
              updateStageState(kind, state) {
                runtimeCalls.push({ method: 'updateStageState', kind, state });
                return true;
              },
              triggerStageAction(kind, action, payload) {
                runtimeCalls.push({ method: 'triggerStageAction', kind, action, payload });
                return true;
              },
              startLoop() {
                runtimeCalls.push({ method: 'startLoop' });
              },
              diagnostics() {
                return { ready: true, webglContexts: 1 };
              },
            };
          },
        });
      }
      return Promise.reject(new Error('Unexpected import: ' + specifier));
    },
  };
  mockGlobal.window = mockGlobal;
  mockGlobal.globalThis = mockGlobal;

  const flushRaf = () => {
    while (rafQueue.length > 0) {
      const cb = rafQueue.shift();
      cb();
    }
  };
  const flushMicrotasks = async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setImmediate(r));
    }
  };

  const transformedBridge = bridgeSrc.replace(/\bimport\s*\(/g, '__mockImport(');
  vm.runInNewContext(transformedBridge, mockGlobal);

  // Immediately after synchronous startup + first rAF (t = 0ms elapsed):
  flushRaf();
  const initialState = mockGlobal.ZoneEcs3D.getChar3DWatchState();
  assert.equal(initialState.hasCharEl, true);
  assert.equal(initialState.mountTs, 100000);
  assert.equal(
    initialState.fallbackMounted,
    true,
    '#zone-char-3d must mount [data-z3d-stage="character-turntable"] immediately (0ms) so Home is never blank!'
  );
  assert.equal(initialState.fallbackVisible, true);
  assert.equal(iframeEl.style.opacity, '0');
  const firstWatchdogId = initialState.watchdogTimerId;
  assert.ok(firstWatchdogId > 0, 'Non-resetting 1600ms watchdog timer must be armed');

  await flushMicrotasks();
  assert.ok(importOrder[0].includes('zone-3d-rigged-operative.mjs'), 'Must import zone-3d-rigged-operative.mjs FIRST');
  assert.ok(importOrder[1].includes('zone-ecs-3d-engine.mjs'), 'Must import zone-ecs-3d-engine.mjs SECOND');
  assert.equal(riggedWasReadyBeforeEngine, true, '__ZoneRiggedOperative must exist before engine loads');

  // Simulate 15 rapid MutationObserver ticks every 120ms (<200ms intervals across 1800ms total!)
  const updateCallsBeforeTicks = runtimeCalls.filter((c) => c.method === 'updateStageState').length;
  let watchdogFired = false;

  for (let step = 1; step <= 15; step++) {
    fakeNow += 120;
    observerCallback([{ type: 'attributes', addedNodes: [] }]);
    flushRaf();

    // Fire any due timers
    for (const [tid, tEntry] of [...activeTimers.entries()]) {
      if (fakeNow >= tEntry.dueAt) {
        activeTimers.delete(tid);
        watchdogFired = true;
        tEntry.fn();
      }
    }
  }

  assert.equal(clearTimeoutCalls, 0, 'Rapid <200ms MutationObserver scans must NEVER clearTimeout/starve the watchdog');
  assert.equal(watchdogFired, true, '1600ms watchdog fired on schedule without starvation');
  const afterTicksState = mockGlobal.ZoneEcs3D.getChar3DWatchState();
  assert.equal(afterTicksState.mountTs, 100000, 'Mount timestamp must remain anchored and non-resetting');
  assert.equal(afterTicksState.fallbackVisible, true);
  assert.equal(
    runtimeCalls.filter((c) => c.method === 'updateStageState').length,
    updateCallsBeforeTicks,
    'Unchanged outfit across rapid MutationObserver scans must not reset/rebuild character stage'
  );

  // Simulate clicking [data-outfit="suit"] -> updates character-turntable outfit immediately
  suitBtn.setAttribute('aria-pressed', 'true');
  for (const fn of docListeners.get('click') || []) {
    fn({ target: suitBtn, preventDefault() {}, stopPropagation() {} });
  }
  const fallbackEl = stageHost.querySelector('[data-z3d-stage="character-turntable"]');
  assert.equal(fallbackEl.getAttribute('data-z3d-outfit'), 'suit');

  // Simulate dist/character3d.html later reaching `ready` with a valid non-zero WebGL canvas
  iframeCanvas.width = 480;
  iframeCanvas.height = 540;
  iframeBody.dataset.zoneMediaState = 'ready';
  for (const fn of winListeners.get('message') || []) {
    fn({ data: { zoneCharacterReady: true } });
  }
  assert.equal(fallbackEl.style.display, 'none', 'Fallback must hide smoothly once native character3d canvas is ready');
  assert.equal(iframeEl.style.opacity, '', 'Iframe opacity must be restored when healthy');

  // Simulate WebGL context loss / error recovery -> fallback re-engages immediately
  iframeBody.dataset.zoneMediaState = 'error';
  for (const fn of winListeners.get('message') || []) {
    fn({ data: { zoneCharacterRecover: 1 } });
  }
  assert.equal(fallbackEl.style.display, '', 'Fallback must immediately re-engage on WebGL recovery signal');
  assert.equal(iframeEl.style.opacity, '0');
});

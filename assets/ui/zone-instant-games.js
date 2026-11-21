/* ZONE v155 - Unified Sketchbook 60fps Demand-Driven Arcade Engine (80ms Input Buffer, Coyote Grace, Hit-Stop, Trauma^2 Shake, Combo Fever, Graze & 390px Touch Controls) */
(function () {
  'use strict';

  /* ---------------- Pure Deterministic Game-Feel & Input Engine (v155 Headless-Testable Core) ---------------- */
  var ARCADE_CONSTANTS = {
    INPUT_BUFFER_MS: 80,
    INPUT_BUFFER_SEC: 0.080,
    COYOTE_GRACE_MS: 55,
    COYOTE_GRACE_SEC: 0.055,
    HITSTOP_CRIT_MS: 35,
    HITSTOP_VAULT_MS: 55,
    HITSTOP_SLOW_SCALE: 0.05,
    TRAUMA_DECAY_PER_SEC: 1.85,
    MAX_SHAKE_OFFSET_X: 9.5,
    MAX_SHAKE_OFFSET_Y: 6.5,
    MAX_SHAKE_ROT_RAD: 0.022,
    GRAZE_LANE_MIN_RATIO: 0.52,
    GRAZE_LANE_MAX_RATIO: 1.18,
    GRAZE_DRIFT_Y_BAND: 26,
    GRAZE_JET_X_BAND: 30,
    GRAZE_JET_MAX_DIST: 48,
    TOUCH_SWIPE_MIN_PX: 22
  };

  var ARCADE_I18N = {
    en: {
      overdrive: 'OVERDRIVE',
      graze: '+GRAZE!',
      chain2: 'x2 CHAIN',
      rush4: 'x4 SYNDICATE RUSH',
      fever8: 'x8 OVERDRIVE',
      ready1: 'x1 READY',
      buffered: 'BUFFERED!',
      clutch: 'CLUTCH!',
      steerLeft: '\u25C0 Left',
      steerRight: 'Right \u25B6',
      nitroBoost: 'NITRO BOOST',
      climbUp: '\u25B2 Climb',
      diveDown: 'Dive \u25BC',
      stabilize: 'TRIM LEVEL',
      strikeBag: 'STRIKE BAG',
      crackVault: 'CRACK VAULT',
      focusBuffer: '80ms FOCUS',
      feverHit: 'FEVER HIT',
      hintDrift: 'Swipe lanes or tap thumb zones \u00B7 Hold Nitro',
      hintJet: 'Swipe Up/Down or tap Climb/Dive thumb zones',
      hintGym: '80ms Buffer + 55ms Grace \u00B7 Tap Strike or Space',
      hintHeist: '80ms Buffer + 55ms Grace \u00B7 Tap Crack or Space'
    },
    ar: {
      overdrive: '\u0630\u0631\u0648\u0629 \u0627\u0644\u0623\u0648\u0641\u0631\u062F\u0631\u0627\u064A\u0641',
      graze: '+\u0645\u0631\u0627\u0648\u063A\u0629 \u0648\u0634\u064A\u0643\u0629!',
      chain2: '\u0633\u0644\u0633\u0644\u0629 \u00D72',
      rush4: '\u0627\u0646\u062F\u0641\u0627\u0639 \u0627\u0644\u0646\u0642\u0627\u0628\u0629 \u00D74',
      fever8: '\u0623\u0648\u0641\u0631\u062F\u0631\u0627\u064A\u0641 \u00D78',
      ready1: '\u062C\u0627\u0647\u0632 \u00D71',
      buffered: '\u062A\u0648\u0642\u064A\u062A \u0645\u0633\u0628\u0642!',
      clutch: '\u0625\u0646\u0642\u0627\u0630 \u062E\u0627\u0637\u0641!',
      steerLeft: '\u25C0 \u064A\u0633\u0627\u0631',
      steerRight: '\u064A\u0645\u064A\u0646 \u25B6',
      nitroBoost: '\u062F\u0641\u0639 \u0646\u064A\u062A\u0631\u0648',
      climbUp: '\u25B2 \u0635\u0639\u0648\u062F',
      diveDown: '\u0647\u0628\u0648\u0637 \u25BC',
      stabilize: '\u062A\u0648\u0627\u0632\u0646 \u062C\u0648\u064A',
      strikeBag: '\u0633\u062F\u0651\u062F \u0627\u0644\u0644\u0643\u0645\u0629',
      crackVault: '\u0627\u0643\u0633\u0631 \u0627\u0644\u0642\u0641\u0644',
      focusBuffer: '\u062A\u0631\u0643\u064A\u0632 80ms',
      feverHit: '\u0636\u0631\u0628\u0629 \u0627\u0644\u0630\u0631\u0648\u0629',
      hintDrift: '\u0627\u0633\u062D\u0628 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062A \u0623\u0648 \u0627\u0644\u0645\u0633 \u0623\u0632\u0631\u0627\u0631 \u0627\u0644\u0625\u0628\u0647\u0627\u0645 \u00B7 \u0645\u0637\u0648\u0644\u0627\u064B \u0644\u0644\u0646\u064A\u062A\u0631\u0648',
      hintJet: '\u0627\u0633\u062D\u0628 \u0644\u0644\u0623\u0639\u0644\u0649/\u0627\u0644\u0623\u0633\u0641\u0644 \u0623\u0648 \u0627\u0644\u0645\u0633 \u0635\u0639\u0648\u062F/\u0647\u0628\u0648\u0637',
      hintGym: '\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0630\u0643\u064A\u0629 80ms \u00B7 \u0627\u0644\u0645\u0633 \u0644\u062A\u0633\u062F\u064A\u062F \u0627\u0644\u0644\u0643\u0645\u0629',
      hintHeist: '\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0630\u0643\u064A\u0629 80ms \u00B7 \u0627\u0644\u0645\u0633 \u0644\u0643\u0633\u0631 \u0627\u0644\u0642\u0641\u0644'
    }
  };

  function clampNum(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* camera-systems Pattern 2: Frame-rate-independent exponential smoothing 1 - exp(-rate * dt) */
  function expSmooth(current, target, rate, dt) {
    var safeDt = Math.max(0, Number(dt) || 0);
    var t = 1 - Math.exp(-Math.max(0, Number(rate) || 0) * safeDt);
    return current + (target - current) * t;
  }

  /* game-feel Pattern 3: Back-overshoot pop curve for floating popups & HUD badges */
  function easeOutBack(t) {
    var x = clampNum(Number(t) || 0, 0, 1);
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function getFeverTier(comboCount, ar) {
    var c = Math.max(0, Math.floor(Number(comboCount) || 0));
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;
    if (c >= 8) {
      return { tier: 3, mult: 8, code: 'OVERDRIVE', label: dict.fever8, labelEn: ARCADE_I18N.en.fever8, labelAr: ARCADE_I18N.ar.fever8, tone: 'gold', rings: 3 };
    }
    if (c >= 4) {
      return { tier: 2, mult: 4, code: 'SYNDICATE_RUSH', label: dict.rush4, labelEn: ARCADE_I18N.en.rush4, labelAr: ARCADE_I18N.ar.rush4, tone: 'gold', rings: 2 };
    }
    if (c >= 2) {
      return { tier: 1, mult: 2, code: 'CHAIN', label: dict.chain2, labelEn: ARCADE_I18N.en.chain2, labelAr: ARCADE_I18N.ar.chain2, tone: 'good', rings: 1 };
    }
    return { tier: 0, mult: 1, code: 'BASE', label: dict.ready1, labelEn: ARCADE_I18N.en.ready1, labelAr: ARCADE_I18N.ar.ready1, tone: 'good', rings: 0 };
  }

  /* input-systems Pattern 3: Game-clock action buffer so early discrete presses within 80ms still fire once */
  function createActionBuffer(windowSec) {
    var win = (typeof windowSec === 'number' && windowSec > 0) ? windowSec : ARCADE_CONSTANTS.INPUT_BUFFER_SEC;
    var store = Object.create(null);
    return {
      windowSec: win,
      press: function (action, clockSec, meta) {
        if (!action) return;
        store[action] = { at: Number(clockSec) || 0, meta: meta || null };
      },
      has: function (action, clockSec) {
        var rec = store[action];
        if (!rec) return false;
        var age = (Number(clockSec) || 0) - rec.at;
        return age >= -0.0001 && age <= win + 1e-6;
      },
      peek: function (action) {
        return store[action] || null;
      },
      consume: function (action, clockSec) {
        var rec = store[action];
        if (!rec) return null;
        var age = (Number(clockSec) || 0) - rec.at;
        delete store[action];
        if (age >= -0.0001 && age <= win + 1e-6) {
          return { accepted: true, ageMs: Math.max(0, age * 1000), meta: rec.meta };
        }
        return null;
      },
      popExpired: function (action, clockSec) {
        var rec = store[action];
        if (!rec) return null;
        var age = (Number(clockSec) || 0) - rec.at;
        if (age > win + 1e-6) {
          delete store[action];
          return rec;
        }
        return null;
      },
      clear: function (action) {
        if (action) {
          delete store[action];
          return;
        }
        var keys = Object.keys(store);
        for (var i = 0; i < keys.length; i++) delete store[keys[i]];
      }
    };
  }

  /* input-handling + platformer grace edge: 55ms Coyote Grace Window after leaving sweet-spot / gold arc */
  function createCoyoteTracker(graceSec) {
    var grace = (typeof graceSec === 'number' && graceSec > 0) ? graceSec : ARCADE_CONSTANTS.COYOTE_GRACE_SEC;
    var stamps = Object.create(null);
    return {
      graceSec: grace,
      markLegal: function (tag, clockSec, meta) {
        if (!tag) return;
        stamps[tag] = { at: Number(clockSec) || 0, meta: meta || null };
      },
      withinGrace: function (tag, clockSec) {
        var rec = stamps[tag];
        if (!rec) return false;
        var elapsed = (Number(clockSec) || 0) - rec.at;
        return elapsed >= -0.0001 && elapsed <= grace + 1e-6;
      },
      consumeGrace: function (tag, clockSec) {
        var rec = stamps[tag];
        if (!rec) return null;
        var elapsed = (Number(clockSec) || 0) - rec.at;
        delete stamps[tag];
        if (elapsed >= -0.0001 && elapsed <= grace + 1e-6) {
          return { saved: true, elapsedMs: Math.max(0, elapsed * 1000), meta: rec.meta };
        }
        return null;
      },
      clear: function (tag) {
        if (tag) {
          delete stamps[tag];
          return;
        }
        var keys = Object.keys(stamps);
        for (var i = 0; i < keys.length; i++) delete stamps[keys[i]];
      }
    };
  }

  function evaluateGymWindow(gaugePos, gaugeDir, gaugeSpeed, clockSec, coyote) {
    var pos = Number(gaugePos) || 0;
    var dir = Number(gaugeDir) >= 0 ? 1 : -1;
    var spd = Math.max(0.05, Number(gaugeSpeed) || 1.15);
    var dist = Math.abs(pos - 0.5);
    var inSweetSpot = dist <= 0.14;
    var inBullseye = dist <= 0.05;
    var coyoteSaved = !inSweetSpot && Boolean(coyote && coyote.withinGrace('gym_sweet', clockSec));
    var timeToSweetSec = Infinity;
    if (!inSweetSpot) {
      if (dir > 0 && pos < 0.36) {
        timeToSweetSec = (0.36 - pos) / spd;
      } else if (dir < 0 && pos > 0.64) {
        timeToSweetSec = (pos - 0.64) / spd;
      }
    }
    var shouldBuffer = !inSweetSpot && !coyoteSaved && timeToSweetSec <= ARCADE_CONSTANTS.INPUT_BUFFER_SEC + 1e-6;
    return {
      inSweetSpot: inSweetSpot,
      inBullseye: inBullseye,
      coyoteSaved: coyoteSaved,
      timeToSweetMs: Number.isFinite(timeToSweetSec) ? timeToSweetSec * 1000 : Infinity,
      shouldBuffer: shouldBuffer
    };
  }

  function normalizeAnglePositive(rad) {
    var twoPi = Math.PI * 2;
    return ((rad % twoPi) + twoPi) % twoPi;
  }

  function evaluateHeistWindow(angle, dir, speed, targetCenter, targetArc, clockSec, coyote) {
    var ang = Number(angle) || 0;
    var stepDir = Number(dir) >= 0 ? 1 : -1;
    var spd = Math.max(0.1, Math.abs(Number(speed) || 2.55));
    var center = Number(targetCenter) || 0;
    var halfArc = Math.max(0.05, Number(targetArc) || 0.78) * 0.5;
    var diff = Math.atan2(Math.sin(ang - center), Math.cos(ang - center));
    var absDiff = Math.abs(diff);
    var inArc = absDiff <= halfArc;
    var perfect = absDiff <= halfArc * 0.38;
    var coyoteSaved = !inArc && Boolean(coyote && coyote.withinGrace('heist_arc', clockSec));
    var timeToArcSec = Infinity;
    if (!inArc) {
      var leadingEdge = stepDir > 0 ? (center - halfArc) : (center + halfArc);
      var angularDist = stepDir > 0
        ? normalizeAnglePositive(leadingEdge - ang)
        : normalizeAnglePositive(ang - leadingEdge);
      timeToArcSec = angularDist / spd;
    }
    var shouldBuffer = !inArc && !coyoteSaved && timeToArcSec <= ARCADE_CONSTANTS.INPUT_BUFFER_SEC + 1e-6;
    return {
      inArc: inArc,
      perfect: perfect,
      coyoteSaved: coyoteSaved,
      timeToArcMs: Number.isFinite(timeToArcSec) ? timeToArcSec * 1000 : Infinity,
      shouldBuffer: shouldBuffer
    };
  }

  /* game-feel Patterns 1 & 2: Overlapping-safe unscaled Hit-Stop + Squirrel Eiserloh trauma^2 Camera Kick */
  function createJuiceRig() {
    var rig = {
      trauma: 0,
      kickX: 0,
      kickY: 0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      waveT: 0,
      timeScale: 1,
      hitStopId: 0,
      activeHitStopOwner: 0,
      hitStopUntilMs: 0,
      addTrauma: function (amount, dirX, dirY, reducedMotion) {
        if (reducedMotion) {
          rig.trauma = 0;
          rig.kickX = 0;
          rig.kickY = 0;
          rig.offsetX = 0;
          rig.offsetY = 0;
          rig.rotation = 0;
          return rig;
        }
        var amt = clampNum(Number(amount) || 0, 0, 1);
        rig.trauma = clampNum(rig.trauma + amt, 0, 1);
        rig.kickX = clampNum(rig.kickX + (Number(dirX) || 0) * amt * 7.5, -12, 12);
        rig.kickY = clampNum(rig.kickY + (Number(dirY) || 0) * amt * 5.5, -9, 9);
        var instantShake = rig.trauma * rig.trauma;
        rig.offsetX = rig.kickX + ARCADE_CONSTANTS.MAX_SHAKE_OFFSET_X * instantShake * Math.sin(rig.waveT * 1.7 + 0.6);
        rig.offsetY = rig.kickY + ARCADE_CONSTANTS.MAX_SHAKE_OFFSET_Y * instantShake * Math.sin(rig.waveT * 2.3 + 1.1);
        rig.rotation = ARCADE_CONSTANTS.MAX_SHAKE_ROT_RAD * instantShake * Math.sin(rig.waveT * 1.1 + 0.4);
        return rig;
      },
      triggerHitStop: function (durationMs, realNowMs, slowScale, reducedMotion) {
        var dur = Math.max(0, Math.min(150, Number(durationMs) || 0));
        var now = Number(realNowMs) || 0;
        rig.hitStopId += 1;
        var myId = rig.hitStopId;
        if (reducedMotion || dur <= 0) {
          rig.timeScale = 1;
          rig.hitStopUntilMs = now;
          rig.activeHitStopOwner = myId;
          return myId;
        }
        var targetUntil = now + dur;
        if (targetUntil >= rig.hitStopUntilMs) {
          rig.hitStopUntilMs = targetUntil;
          rig.activeHitStopOwner = myId;
        }
        rig.timeScale = clampNum(typeof slowScale === 'number' ? slowScale : ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, 0.01, 1);
        return myId;
      },
      stepReal: function (realDtSec, realNowMs, reducedMotion) {
        var rDt = clampNum(Number(realDtSec) || 0, 0, 0.1);
        var now = Number(realNowMs) || 0;
        if (reducedMotion) {
          rig.trauma = 0;
          rig.kickX = 0;
          rig.kickY = 0;
          rig.offsetX = 0;
          rig.offsetY = 0;
          rig.rotation = 0;
          rig.timeScale = 1;
          rig.hitStopUntilMs = now;
          return { realDt: rDt, scaledDt: rDt, inHitStop: false };
        }
        var inStop = now < rig.hitStopUntilMs;
        if (!inStop && rig.timeScale !== 1) {
          rig.timeScale = 1;
        }
        /* Decay camera trauma in REAL unscaled time so camera never freezes off-center during hit-stop */
        if (rig.trauma > 0 || Math.abs(rig.kickX) > 0.01 || Math.abs(rig.kickY) > 0.01) {
          rig.trauma = Math.max(0, rig.trauma - ARCADE_CONSTANTS.TRAUMA_DECAY_PER_SEC * rDt);
          rig.kickX = expSmooth(rig.kickX, 0, 18, rDt);
          rig.kickY = expSmooth(rig.kickY, 0, 18, rDt);
          rig.waveT += rDt * 32;
          var shake = rig.trauma * rig.trauma;
          rig.offsetX = rig.kickX + ARCADE_CONSTANTS.MAX_SHAKE_OFFSET_X * shake * Math.sin(rig.waveT * 1.7);
          rig.offsetY = rig.kickY + ARCADE_CONSTANTS.MAX_SHAKE_OFFSET_Y * shake * Math.sin(rig.waveT * 2.3);
          rig.rotation = ARCADE_CONSTANTS.MAX_SHAKE_ROT_RAD * shake * Math.sin(rig.waveT * 1.1);
          if (rig.trauma === 0 && Math.hypot(rig.kickX, rig.kickY) < 0.04) {
            rig.kickX = 0;
            rig.kickY = 0;
            rig.offsetX = 0;
            rig.offsetY = 0;
            rig.rotation = 0;
          }
        }
        var scaledDt = rDt * rig.timeScale;
        return { realDt: rDt, scaledDt: scaledDt, inHitStop: inStop };
      },
      isActive: function (realNowMs) {
        return rig.trauma > 0.001 || Math.abs(rig.kickX) > 0.04 || Math.abs(rig.kickY) > 0.04 || (Number(realNowMs) || 0) < rig.hitStopUntilMs;
      },
      reset: function () {
        rig.trauma = 0;
        rig.kickX = 0;
        rig.kickY = 0;
        rig.offsetX = 0;
        rig.offsetY = 0;
        rig.rotation = 0;
        rig.timeScale = 1;
        rig.hitStopUntilMs = 0;
      }
    };
    return rig;
  }

  function checkDriftGraze(ent, roadLeft, laneW, playerX, playerY) {
    if (!ent || ent.kind !== 'police' || ent.grazed) return null;
    var ex = roadLeft + (ent.lane + 0.5) * laneW;
    var dx = Math.abs(ex - playerX);
    var dy = Math.abs(ent.y - playerY);
    var collides = dx < laneW * ARCADE_CONSTANTS.GRAZE_LANE_MIN_RATIO && dy < 28;
    if (collides) return null;
    if (dy <= ARCADE_CONSTANTS.GRAZE_DRIFT_Y_BAND && dx >= laneW * ARCADE_CONSTANTS.GRAZE_LANE_MIN_RATIO && dx <= laneW * ARCADE_CONSTANTS.GRAZE_LANE_MAX_RATIO) {
      ent.grazed = true;
      return { grazed: true, ex: ex, ey: ent.y, dirX: playerX >= ex ? 1 : -1 };
    }
    return null;
  }

  function checkJetGraze(ent, planeX, planeY, canvasH) {
    if (!ent || ent.kind !== 'radar' || ent.grazed) return null;
    var ey = ent.yFrac * canvasH;
    var dx = Math.abs(ent.x - planeX);
    var dy = Math.abs(ey - planeY);
    var collides = dx < 26 && dy < 22;
    if (collides) return null;
    var dist = Math.hypot(ent.x - planeX, ey - planeY);
    if (dx <= ARCADE_CONSTANTS.GRAZE_JET_X_BAND && dist <= ARCADE_CONSTANTS.GRAZE_JET_MAX_DIST) {
      ent.grazed = true;
      return { grazed: true, ex: ent.x, ey: ey, dirY: planeY >= ey ? 1 : -1 };
    }
    return null;
  }

  /* Enforces CRITICAL HOME INVARIANT: #zig-home-arcade stays #1 right after .zone-home-brief, strictly above #zone-ascension-hub and #zone-char-3d */
  function ensureHomeArcadePlacement(mainEl, arcadeEl) {
    if (!mainEl || !arcadeEl) return false;
    var scr = mainEl.getAttribute ? (mainEl.getAttribute('data-zone-screen') || '') : '';
    if (scr !== 'home') return false;
    var anchor = mainEl.querySelector ? (mainEl.querySelector('.zone-home-brief') || mainEl.querySelector('.zone-page-heading')) : null;
    if (!anchor) return false;
    if (anchor.nextElementSibling !== arcadeEl) {
      anchor.insertAdjacentElement('afterend', arcadeEl);
      return true;
    }
    return false;
  }

  var ArcadeFeelEngine = {
    CONSTANTS: ARCADE_CONSTANTS,
    I18N: ARCADE_I18N,
    expSmooth: expSmooth,
    easeOutBack: easeOutBack,
    getFeverTier: getFeverTier,
    createActionBuffer: createActionBuffer,
    createCoyoteTracker: createCoyoteTracker,
    evaluateGymWindow: evaluateGymWindow,
    evaluateHeistWindow: evaluateHeistWindow,
    createJuiceRig: createJuiceRig,
    checkDriftGraze: checkDriftGraze,
    checkJetGraze: checkJetGraze,
    ensureHomeArcadePlacement: ensureHomeArcadePlacement
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.__ZoneArcadeFeel155 = ArcadeFeelEngine;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.ZoneArcadeFeel = ArcadeFeelEngine;
  if (window.__zoneInstantGamesLoaded) return;
  window.__zoneInstantGamesLoaded = true;

  var MOTION_STYLE_ID = 'zig-v155-motion-styles';

  var EU_WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var RED_POCKETS = {
    1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1,
    19: 1, 21: 1, 23: 1, 25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1
  };
  var SLOT_SYMS = [
    { id: 'DIAMOND', kind: 'diamond', color: '#3b6ea5', labelEn: 'DIAMOND', labelAr: 'ألماس' },
    { id: 'SEVEN', kind: 'seven', color: '#b83d28', labelEn: 'LUCKY 7', labelAr: 'سبعة' },
    { id: 'CROWN', kind: 'crown', color: '#c48425', labelEn: 'CROWN', labelAr: 'تاج' },
    { id: 'GOLD_BAR', kind: 'bullion', color: '#d99a38', labelEn: 'GOLD', labelAr: 'سبيكة' },
    { id: 'CHIP', kind: 'spade', color: '#4f7736', labelEn: 'SPADE', labelAr: 'سبيد' },
    { id: 'CHERRY', kind: 'ruby', color: '#a93522', labelEn: 'RUBY', labelAr: 'ياقوت' }
  ];

  /* ---------------- Hand-Inked Gouache Sketchbook SVGs (Zero Raw Emojis, Zero Dark-Navy) ---------------- */
  var SVG_ARCADE_CREST =
    '<svg class="zig-emblem-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-crest" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#6d9949"/>' +
          '<stop offset="52%" stop-color="#c89429"/>' +
          '<stop offset="100%" stop-color="#b8452d"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M12 2.2L20.6 7.1V16.9L12 21.8L3.4 16.9V7.1L12 2.2Z" fill="url(#zig-grad-crest)" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>' +
      '<path class="zig-emblem-play" d="M9.7 8.4L16.2 12L9.7 15.6V8.4Z" fill="#fcf8ee" stroke="#23201c" stroke-width="0.9" stroke-linejoin="round"/>' +
    '</svg>';

  var SVG_SPEAKER_ON =
    '<svg class="zig-inline-svg zig-speaker-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#5c8e3e" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path class="zig-sound-wave-1" d="M15.4 8.8C16.7 9.9 17.4 11.2 17.4 12C17.4 12.8 16.7 14.1 15.4 15.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '<path class="zig-sound-wave-2" d="M18.4 6.2C20.4 7.8 21.4 9.8 21.4 12C21.4 14.2 20.4 16.2 18.4 17.8" stroke="#c89429" stroke-width="1.9" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SPEAKER_OFF =
    '<svg class="zig-inline-svg zig-speaker-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#b8452d" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M15.8 9.4L20.8 14.4M20.8 9.4L15.8 14.4" stroke="#b8452d" stroke-width="2.1" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_CTA_CHEVRON =
    '<svg class="zig-cta-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var SVG_WHEEL_STEER =
    '<svg class="zig-inline-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" fill="#d99a38" fill-opacity="0.28" stroke="currentColor" stroke-width="1.7"/>' +
      '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
      '<path d="M4.2 11H9.5M14.5 11H19.8M12 14.5V20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_PLANE =
    '<svg class="zig-inline-svg zig-jet-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 2.2L14.4 8.8L21.6 11.2V13.2L14.4 12.1L13.6 18.1L16.4 19.9V21.6L12 20.4L7.6 21.6V19.9L10.4 18.1L9.6 12.1L2.4 13.2V11.2L9.6 8.8L12 2.2Z" fill="#4b7fb2" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>' +
    '</svg>';

  var SVG_LOCK =
    '<svg class="zig-inline-svg zig-lock-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M8.2 11V7.7C8.2 5.6 9.9 3.9 12 3.9C14.1 3.9 15.8 5.6 15.8 7.7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="5" y="10.6" width="14" height="10.4" rx="2.6" fill="#d99a38" stroke="currentColor" stroke-width="1.35"/>' +
      '<circle cx="12" cy="15.6" r="1.4" fill="#1e1b18"/>' +
    '</svg>';

  /* ---------------- Preloaded Key-Art Plates ---------------- */
  var artImages = {
    heavybag: null,
    heist: null
  };

  function preloadKeyArt() {
    try {
      if (typeof Image === 'function') {
        var bagImg = new Image();
        bagImg.decoding = 'async';
        bagImg.onload = function () { paintIdleVisibleCanvases(); };
        bagImg.src = '/assets/ui/watercolor-art/arcade-heavybag.webp';
        artImages.heavybag = bagImg;

        var heistImg = new Image();
        heistImg.decoding = 'async';
        heistImg.onload = function () { paintIdleVisibleCanvases(); };
        heistImg.src = '/assets/ui/watercolor-art/arcade-heist.webp';
        artImages.heist = heistImg;
      }
    } catch (_) {}
  }

  function drawCoverArt(ctx, img, w, h, offsetX, offsetY, zoom) {
    if (!img || !img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return false;
    try {
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var scale = Math.max(w / iw, h / ih) * (zoom || 1);
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = (w - dw) * 0.5 + (offsetX || 0);
      var dy = (h - dh) * 0.5 + (offsetY || 0);
      ctx.drawImage(img, dx, dy, dw, dh);
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureMotionStyles() {
    try {
      var oldStyle = document.getElementById('zig-v126-motion-styles');
      if (oldStyle) oldStyle.remove();
      var oldStyle127 = document.getElementById('zig-v127-motion-styles');
      if (oldStyle127) oldStyle127.remove();
      if (document.getElementById(MOTION_STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = MOTION_STYLE_ID;
      style.textContent = [
        '.zig-arcade-title{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;text-transform:none !important;letter-spacing:-0.01em !important;font-weight:700 !important;color:#f7f1e3 !important;}',
        '.zig-arcade-header .zig-arcade-title>span:first-child,.zig-arcade-header .zig-arcade-sub,.zig-world-flight-head,.zig-world-flight-head *:not(button):not(.zig-live-pill){color:#f7f1e3 !important;}',
        '.zig-live-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px !important;font-size:10.5px;font-weight:800;letter-spacing:0.02em;text-transform:none;background-color:#243b20 !important;background-image:none !important;border:1.4px solid rgba(196,240,175,0.72) !important;color:#e2f9d6 !important;line-height:1.3;box-shadow:1px 1.5px 0 rgba(0,0,0,0.45) !important;}',
        '.zig-live-pill::before{content:"";width:6px;height:6px;border-radius:50%;background-color:#9ef08a !important;flex:0 0 6px;}',
        '.zig-arcade-emblem{display:inline-grid;place-items:center;width:38px !important;height:38px !important;border:1.5px solid var(--zwc-border-strong,#23201c) !important;border-radius:var(--zwc-sketch-radius-sm,12px) !important;background-color:var(--zwc-btn-bg,#ede4cf) !important;color:var(--zwc-ink,#1e1b18) !important;box-shadow:1.5px 1.5px 0 rgba(0,0,0,0.38) !important;}',
        '.zig-emblem-svg{width:22px;height:22px;display:block;transition:transform 220ms cubic-bezier(0.22,1,0.36,1);}',
        '.zig-arcade-deck:hover .zig-emblem-svg{transform:scale(1.07) rotate(-4deg);}',
        '.zig-sound-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid var(--zwc-border-strong,#23201c) !important;border-radius:var(--zwc-sketch-radius-sm,10px) !important;background:var(--zwc-btn-bg,var(--zwc-surface-alt,#ede4cf)) !important;color:var(--zwc-ink,#1e1b18) !important;box-shadow:var(--zwc-shadow-sub,2px 2px 0 rgba(0,0,0,0.2)) !important;touch-action:manipulation;cursor:pointer;}',
        '.zig-sound-btn:hover{background:var(--zwc-btn-hover,var(--zwc-surface,#e3d7bd)) !important;}',
        '.zig-inline-svg{width:15px;height:15px;display:inline-block;flex:none;vertical-align:-2px;}',
        '.zig-sound-wave-1,.zig-sound-wave-2{transform-origin:12px 12px;transition:opacity 200ms ease,transform 200ms ease;}',
        '.zig-sound-btn:hover .zig-sound-wave-1{transform:scale(1.08);}',
        '.zig-sound-btn:hover .zig-sound-wave-2{transform:scale(1.12);}',
        '.zig-jet-svg{width:16px;height:16px;color:var(--zwc-ink,#1e1b18);transition:transform 220ms cubic-bezier(0.22,1,0.36,1);}',
        '#zig-world-flight-bar:hover .zig-jet-svg,.zig-city-chip:hover .zig-jet-svg{transform:translate(2px,-1px) rotate(-8deg);}',
        'html[dir="rtl"] #zig-world-flight-bar:hover .zig-jet-svg,html[dir="rtl"] .zig-city-chip:hover .zig-jet-svg{transform:translate(-2px,-1px) rotate(8deg);}',
        '.zig-lock-svg{width:12.5px;height:12.5px;margin-inline-end:2px;color:var(--zwc-ink,#1e1b18);}',
        '.zig-card-media{position:relative;aspect-ratio:16 / 10;min-height:110px;width:100%;overflow:hidden;background:var(--zwc-paper,var(--zwc-surface-alt,#f2ebdc));}',
        '@media (max-width:640px){.zig-card-media{min-height:84px;aspect-ratio:auto;}.zig-card-badge{top:6px;inset-inline-start:6px;font-size:9px;padding:2px 7px;}}',
        '.zig-card-art{width:100%;height:100%;object-fit:cover;display:block;transition:transform 460ms cubic-bezier(0.22,1,0.36,1),filter 280ms ease;}',
        '.zig-game-card:hover .zig-card-art{transform:scale(1.05);}',
        '.zig-card-shader{position:absolute;inset:0;width:100% !important;height:100% !important;pointer-events:none;z-index:2;display:block;background:transparent !important;border:0 !important;}',
        '.zig-card-badge{position:absolute;top:10px;inset-inline-start:10px;z-index:3;background:var(--zwc-tag-bg,var(--zwc-surface,#f8f3e6));border:1.4px solid var(--zwc-border-strong,#23201c);color:var(--zwc-ink,#1e1b18);font-size:10px;font-weight:700;letter-spacing:0.01em;padding:3px 9px;border-radius:999px !important;line-height:1.25;box-shadow:var(--zwc-shadow-sub,1px 2px 0 rgba(0,0,0,0.2));}',
        '.zig-game-card{touch-action:manipulation;}',
        '.zig-game-card-cta{display:inline-flex;align-items:center;gap:6px;text-transform:none !important;letter-spacing:0.01em !important;}',
        '.zig-cta-chevron{width:13px;height:13px;flex:none;transition:transform 200ms cubic-bezier(0.22,1,0.36,1);}',
        '.zig-game-card:hover .zig-cta-chevron{transform:translateX(2px);}',
        'html[dir="rtl"] body #zone-main .zig-game-card-cta .zig-cta-chevron,html[dir="rtl"] .zig-cta-chevron,[dir="rtl"] .zig-cta-chevron{transform:scaleX(-1) !important;}',
        'html[dir="rtl"] body #zone-main .zig-game-card:hover .zig-game-card-cta .zig-cta-chevron,html[dir="rtl"] .zig-game-card:hover .zig-cta-chevron,[dir="rtl"] .zig-game-card:hover .zig-cta-chevron{transform:scaleX(-1) translateX(2px) !important;}',
        '.zig-getaway-stage{background:var(--zwc-surface-alt,var(--zwc-paper-subcard,#fcf8ee)) !important;border:1.5px solid var(--zwc-border-strong,#23201c) !important;border-radius:var(--zwc-sketch-radius-sm,12px) !important;box-shadow:var(--zwc-shadow-sub) !important;padding:10px !important;margin-block-start:10px !important;color:var(--zwc-ink,#1e1b18) !important;}',
        '.zig-getaway-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-block-end:8px;}',
        '.zig-getaway-heading{display:inline-flex;align-items:center;gap:7px;color:var(--zwc-gold-ink,#9a6519);font-size:12.5px;font-weight:800;letter-spacing:0.01em;}',
        '.zig-stage-controls{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;}',
        '.zig-btn,.zig-btn-secondary{touch-action:manipulation;cursor:pointer;min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding-inline:12px;padding-block:6px;border-radius:var(--zwc-sketch-radius-sm,10px) !important;border:1.5px solid var(--zwc-border-strong,#23201c) !important;font-weight:700;box-shadow:var(--zwc-shadow-sub) !important;}',
        '.zig-btn{background:linear-gradient(180deg,#689448 0%,#496f30 100%) !important;color:var(--zwc-cream-ink,#fcf9f2) !important;}',
        '.zig-btn-secondary{background:var(--zwc-btn-bg,var(--zwc-surface,#ede4cf)) !important;color:var(--zwc-ink,#1e1b18) !important;}',
        /* Sketchbook World Flights Bar & Cards */
        '#zig-world-flight-bar{background:var(--zwc-surface,var(--zwc-paper-elevated,#f8f3e6)) !important;background-image:var(--zwc-card-bg,none) !important;border:1.6px solid var(--zwc-border,var(--zwc-border-panel,#25221e)) !important;border-radius:var(--zwc-sketch-radius,16px) !important;box-shadow:var(--zwc-shadow-card) !important;padding:12px 14px !important;color:var(--zwc-ink,#1e1b18) !important;}',
        '.zig-world-flight-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-block-end:10px;}',
        '.zig-world-flight-meta{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;}',
        '.zig-world-flight-title{display:inline-flex;align-items:center;gap:8px;text-transform:none !important;letter-spacing:-0.01em !important;font-size:14px !important;font-weight:700 !important;color:var(--zwc-title-ink,var(--zwc-ink,#1e1b18)) !important;}',
        '.zig-world-origin-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;background:var(--zwc-well-bg,rgba(39,82,138,0.12));color:var(--zwc-blue-ink,#27528a);border:1px solid var(--zwc-border-sub,var(--zwc-border));}',
        '.zig-world-lv-pill{display:inline-flex;align-items:center;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:var(--zwc-well-bg,rgba(34,30,25,0.08));color:var(--zwc-ink-soft,#3a342d);border:1px solid var(--zwc-border-sub,var(--zwc-border));}',
        '#zig-world-flight-bar .zig-city-chip,.zig-flight-card{background:var(--zwc-surface-alt,var(--zwc-paper-subcard,#fcf8ee)) !important;border:1.5px solid var(--zwc-border-sub,var(--zwc-border,#28241f)) !important;border-radius:var(--zwc-sketch-radius-sm,11px) !important;color:var(--zwc-ink,#1e1b18) !important;box-shadow:var(--zwc-shadow-sub) !important;touch-action:manipulation;cursor:pointer;text-align:start;transition:transform 180ms cubic-bezier(0.22,1,0.36,1),background-color 180ms ease !important;}',
        '#zig-world-flight-bar .zig-city-chip:hover{background:var(--zwc-paper-subcard-hover,var(--zwc-btn-hover,#f3ecda)) !important;transform:translateY(-1px);}',
        '#zig-world-flight-bar .zig-city-chip.is-active{background:var(--zwc-row-active,var(--zwc-surface)) !important;border-color:var(--zwc-row-active-bar,var(--zwc-border-strong)) !important;}',
        '.zig-city-chip-top{display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:700;color:var(--zwc-ink,#1e1b18);}',
        '.zig-city-chip-sub{font-size:11.5px;color:var(--zwc-ink-soft,#3a342d);margin-block-start:2px;}',
        '.zig-here-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--zwc-green-ink,#4f7736);border:1px solid var(--zwc-border-strong,#23201c);}',
        '.zig-chip-status{display:inline-flex;align-items:center;gap:3px;color:var(--zwc-gold-ink,#9a6519);font-weight:700;}',
        /* Sketchbook Street Brawl HUD (#zig-brawl-hud) */
        '#zig-brawl-hud,.zig-brawl-banner{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:10px 14px;margin-block-end:10px;background:var(--zwc-surface-alt,var(--zwc-paper-subcard,#fcf8ee)) !important;border:1.6px solid var(--zwc-border-strong,#23201c) !important;border-radius:var(--zwc-sketch-radius-sm,12px) !important;box-shadow:var(--zwc-shadow-sub) !important;color:var(--zwc-ink,#1e1b18) !important;box-sizing:border-box;}',
        '.zig-brawl-side{min-width:0;display:flex;flex-direction:column;gap:5px;}',
        '.zig-brawl-row{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;font-weight:800;color:var(--zwc-ink,#1e1b18);}',
        '.zig-brawl-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zwc-ink,#1e1b18);}',
        '.zig-brawl-you-pct{color:var(--zwc-green-ink,#27582e);font-weight:800;}',
        '.zig-brawl-opp-pct{color:var(--zwc-bad-ink,#a93522);font-weight:800;}',
        '.zig-brawl-center{text-align:center;flex:none;padding-inline:4px;}',
        '.zig-brawl-vs{font-size:13.5px;font-weight:900;color:var(--zwc-gold-ink,#9a6519);line-height:1.1;}',
        '.zig-brawl-status{font-size:10.5px;font-weight:700;color:var(--zwc-ink-soft,#3a342d);margin-block-start:2px;}',
        '.zig-brawl-bar{height:9px;border-radius:999px;overflow:hidden;background:var(--zwc-track-bg,rgba(34,30,25,0.14));border:1px solid var(--zwc-track-border,var(--zwc-border-sub));}',
        '.zig-brawl-fill-you{height:100%;background:linear-gradient(90deg,#3b6ea5 0%,#5c8e3e 100%);transition:width 240ms ease;}',
        '.zig-brawl-fill-opp{height:100%;background:linear-gradient(90deg,#b8452d 0%,#d99a38 100%);transition:width 240ms ease;}',
        /* Sketchbook Floating Reward Pill */
        '.zig-float-pop{position:fixed;z-index:9999;transform:translate(-50%,0);pointer-events:none;padding:4px 11px;border-radius:999px;background:var(--zwc-surface,var(--zwc-paper-elevated,#f8f3e6));border:1.5px solid var(--zwc-border-strong,#23201c);box-shadow:var(--zwc-shadow-sub);font-family:var(--zwc-font-hand,system-ui,sans-serif);font-size:13.5px;font-weight:800;color:var(--zwc-green-ink,#1b5428);animation:zigFloatUp 1.25s cubic-bezier(0.22,1,0.36,1) forwards;}',
        '.zig-float-pop[data-tone="gold"]{color:var(--zwc-gold-ink,#663f06);}',
        'html[data-zone-reduced-motion="true"] .zig-float-pop{animation:none !important;opacity:1;}',
        '@keyframes zigFloatUp{0%{opacity:0;transform:translate(-50%,6px) scale(0.94);}18%{opacity:1;transform:translate(-50%,-4px) scale(1);}100%{opacity:0;transform:translate(-50%,-34px) scale(0.98);}}',
        /* Fluid Canvas & 390px Ergonomic Touch Controls (touch-action: none on active game canvases!) */
        '.zig-gym-wrap,.zig-heist-wrap,.zig-casino-canvas-box,.zig-getaway-canvas-wrap{width:100% !important;max-width:100% !important;min-width:0 !important;overflow:hidden !important;box-sizing:border-box !important;background:var(--zwc-surface-alt,var(--zwc-paper-subcard,#fcf8ee));border:1.5px solid var(--zwc-border-strong,#23201c);border-radius:var(--zwc-sketch-radius-sm,10px);}',
        '#zig-gym-canvas,#zig-heist-canvas,#zig-getaway-canvas{display:block !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important;touch-action:none !important;cursor:pointer;user-select:none;-webkit-user-select:none;}',
        '#zig-roulette-canvas,#zig-slots-canvas{display:block !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important;touch-action:manipulation;cursor:pointer;user-select:none;-webkit-user-select:none;}',
        '.zig-touch-deck{display:none;flex-direction:column;gap:6px;margin-block-start:8px;width:100%;max-width:100%;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none;}',
        '.zig-touch-deck[data-zig-force-touch="1"]{display:flex;}',
        '@media (max-width:640px),(pointer:coarse){.zig-touch-deck{display:flex;}}',
        '.zig-touch-zones{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr);gap:6px;direction:ltr;width:100%;box-sizing:border-box;}',
        '.zig-touch-btn{min-height:46px !important;padding:6px 8px !important;border-radius:var(--zwc-sketch-radius-sm,10px) !important;border:1.5px solid var(--zwc-border-strong,#23201c) !important;background:var(--zwc-btn-bg,var(--zwc-surface,#ede4cf)) !important;color:var(--zwc-ink,#1e1b18) !important;font-size:11.5px;font-weight:800;line-height:1.15;display:inline-flex;align-items:center;justify-content:center;text-align:center;box-shadow:var(--zwc-shadow-sub) !important;touch-action:none !important;cursor:pointer;user-select:none;-webkit-user-select:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.zig-touch-btn[data-zig-touch="action"]{background:linear-gradient(180deg,#d99a38 0%,#a86f1a 100%) !important;color:#1e1b18 !important;border-color:#23201c !important;}',
        '.zig-touch-btn.is-pressed,.zig-touch-btn:active{transform:translateY(1px) scale(0.98);filter:brightness(0.95);}',
        '.zig-touch-hint{font-size:10.5px;font-weight:700;color:var(--zwc-ink-soft,#3a342d);text-align:center;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '@media (max-width:900px){.zig-btn,.zig-btn-secondary,.zig-sound-btn,#zig-world-flight-bar .zig-city-chip,.zig-flight-card{min-height:44px !important;touch-action:manipulation !important;}}',
        'html[lang="ar"] .zig-arcade-deck *,html[dir="rtl"] .zig-arcade-deck *,[dir="rtl"] .zig-arcade-deck *,html[lang="ar"] .zig-world-flight-bar *,html[dir="rtl"] .zig-world-flight-bar *,[dir="rtl"] .zig-world-flight-bar *,html[dir="rtl"] #zig-brawl-hud *{letter-spacing:0 !important;}'
      ].join('');
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  }

  function isReducedMotion() {
    var html = document.documentElement;
    return Boolean(html && html.dataset && html.dataset.zoneReducedMotion === 'true');
  }

  function isAr() {
    var html = document.documentElement;
    if (!html) return false;
    var lang = (html.lang || '').toLowerCase();
    var dir = (html.dir || '').toLowerCase();
    return lang.indexOf('ar') === 0 || dir === 'rtl';
  }

  function isLight() {
    var html = document.documentElement;
    return Boolean(html && html.getAttribute('data-theme') === 'light');
  }

  function isCompactMobile() {
    var vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1024;
    return vw <= 640;
  }

  function fontStack(weight, px) {
    if (isAr()) {
      return weight + ' ' + px + 'px "Noto Sans Arabic","Rubik","Cairo",system-ui,sans-serif';
    }
    return weight + ' ' + px + 'px "Patrick Hand","Rubik",system-ui,sans-serif';
  }

  /* Dynamic 4-Way Sketchbook Canvas Palette (Light Cream Paper + Sepia Ink vs Dark Charcoal Paper + Chalk Ink) */
  function getSketchPalette() {
    if (isLight()) {
      return {
        light: true,
        paper: '#f2ebdc',
        surface: '#f8f3e6',
        subcard: '#fcf8ee',
        well: '#e6dcc8',
        ink: '#1e1b18',
        inkSoft: '#3a342d',
        inkMuted: '#594f43',
        border: '#25221e',
        borderSub: 'rgba(37, 34, 30, 0.30)',
        hudBg: 'rgba(248, 243, 230, 0.94)',
        hudStroke: '#23201c',
        overlayBg: 'rgba(242, 235, 220, 0.92)',
        sage: '#4f7736',
        sageBright: '#27582e',
        gold: '#9a6519',
        goldFill: '#d99a38',
        crimson: '#a93522',
        blue: '#27528a',
        shoulderTop: '#e8dec9',
        shoulderBot: '#ddd1b8',
        bldgFill: '#efe6d2',
        bldgStroke: 'rgba(37, 34, 30, 0.28)',
        bldgWinA: 'rgba(196, 132, 37, 0.32)',
        bldgWinB: 'rgba(79, 119, 54, 0.26)',
        roadEdge: '#cbbda1',
        roadMid: '#d8ccb2',
        roadCenter: '#e2d7bf',
        laneDash: 'rgba(30, 27, 24, 0.36)',
        policeBody: '#2b2620',
        policeRoof: '#fcf8ee',
        policeTrim: '#594f43',
        cashFill: '#3b6b35',
        cashStroke: '#1e1b18',
        cashText: '#fcf8ee',
        artAlpha: 0.34,
        vaultCenter: 'rgba(248, 243, 230, 0.56)',
        vaultOuter: 'rgba(235, 226, 206, 0.92)',
        vaultFallback: '#e6dcc8',
        bezelRing: 'rgba(154, 101, 25, 0.36)',
        tickMajor: 'rgba(154, 101, 25, 0.80)',
        tickMinor: 'rgba(37, 34, 30, 0.28)',
        needle: '#1e1b18',
        hubFill: '#f8f3e6',
        rainStroke: 'rgba(39, 82, 138, 0.20)',
        gymFallbackTop: '#e8dec9',
        gymScrimTop: 'rgba(242, 235, 220, 0.16)',
        gymScrimMid: 'rgba(242, 235, 220, 0.12)',
        gymScrimLow: 'rgba(242, 235, 220, 0.78)',
        gymScrimBot: 'rgba(242, 235, 220, 0.95)',
        wheelRim: '#4a2b1d',
        blackPocket: '#2b2620',
        redPocket: '#a93522',
        greenPocket: '#3b6b35',
        centerCap: '#f8f3e6',
        centerText: '#1e1b18',
        ballFill: '#fcf8ee',
        ballStroke: '#23201c',
        cabFill: '#e8dec9',
        reelEdge: '#d9ccb2',
        reelCenter: '#fcf8ee',
        leverStroke: '#594f43'
      };
    }
    return {
      light: false,
      paper: '#141210',
      surface: '#1e1b17',
      subcard: '#25211c',
      well: '#171411',
      ink: '#f3ecdc',
      inkSoft: '#d8ccb6',
      inkMuted: '#aca08a',
      border: 'rgba(242, 234, 217, 0.44)',
      borderSub: 'rgba(242, 234, 217, 0.26)',
      hudBg: 'rgba(30, 27, 23, 0.92)',
      hudStroke: 'rgba(242, 234, 217, 0.44)',
      overlayBg: 'rgba(20, 18, 16, 0.88)',
      sage: '#6d9949',
      sageBright: '#92d17e',
      gold: '#f0c465',
      goldFill: '#ebb858',
      crimson: '#ef7d68',
      blue: '#8ab8e8',
      shoulderTop: '#181512',
      shoulderBot: '#12100d',
      bldgFill: '#211d18',
      bldgStroke: 'rgba(242, 234, 217, 0.18)',
      bldgWinA: 'rgba(240, 196, 101, 0.28)',
      bldgWinB: 'rgba(146, 209, 126, 0.22)',
      roadEdge: '#1c1915',
      roadMid: '#25211c',
      roadCenter: '#2e2922',
      laneDash: 'rgba(243, 236, 220, 0.30)',
      policeBody: '#1a1714',
      policeRoof: '#e8dec9',
      policeTrim: '#aca08a',
      cashFill: '#274723',
      cashStroke: '#92d17e',
      cashText: '#f3ecdc',
      artAlpha: 0.32,
      vaultCenter: 'rgba(37, 33, 28, 0.44)',
      vaultOuter: 'rgba(20, 18, 16, 0.90)',
      vaultFallback: '#25211c',
      bezelRing: 'rgba(240, 196, 101, 0.34)',
      tickMajor: 'rgba(240, 196, 101, 0.72)',
      tickMinor: 'rgba(216, 204, 182, 0.28)',
      needle: '#f3ecdc',
      hubFill: '#1e1b17',
      rainStroke: 'rgba(216, 204, 182, 0.16)',
      gymFallbackTop: '#2e2922',
      gymScrimTop: 'rgba(20, 18, 16, 0.22)',
      gymScrimMid: 'rgba(20, 18, 16, 0.16)',
      gymScrimLow: 'rgba(20, 18, 16, 0.78)',
      gymScrimBot: 'rgba(20, 18, 16, 0.94)',
      wheelRim: '#3a2218',
      blackPocket: '#1e1b17',
      redPocket: '#a93522',
      greenPocket: '#3b6b35',
      centerCap: '#191613',
      centerText: '#f3ecdc',
      ballFill: '#fcf8ee',
      ballStroke: '#141210',
      cabFill: '#1b1814',
      reelEdge: '#221e1a',
      reelCenter: '#f8f3e6',
      leverStroke: '#aca08a'
    };
  }

  function toneColorFromPalette(toneKey, pal) {
    if (toneKey === 'gold') return pal.gold;
    if (toneKey === 'bad') return pal.crimson;
    return pal.sageBright;
  }

  preloadKeyArt();

  /* ---------------- WebAudio Procedural Arcade Synth + ZoneAudioHaptics Bridge ---------------- */
  var audioCtx = null;
  var soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem('zig_muted') !== '1' && localStorage.getItem('zone_sfx_muted') !== '1';
  } catch (_) {}

  var _dispatchingMuteSync = false;
  function setSoundEnabled(flag) {
    var next = Boolean(flag);
    var changed = soundEnabled !== next;
    soundEnabled = next;
    try {
      localStorage.setItem('zig_muted', soundEnabled ? '0' : '1');
      localStorage.setItem('zone_sfx_muted', soundEnabled ? '0' : '1');
    } catch (_) {}
    window.__zoneMuted = !soundEnabled;
    if (changed && !_dispatchingMuteSync) {
      _dispatchingMuteSync = true;
      try {
        window.dispatchEvent(new CustomEvent('zone:mute-change', { detail: { muted: !soundEnabled, source: 'zig' } }));
      } catch (_) {}
      _dispatchingMuteSync = false;
    }
  }

  function ensureAudio() {
    try {
      if (localStorage.getItem('zig_muted') === '1' || localStorage.getItem('zone_sfx_muted') === '1') soundEnabled = false;
    } catch (_) {}
    if (!soundEnabled) return null;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (_) {
      return null;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol || 0.08, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  var sfx = {
    lockClick: function () { tone(920, 0.045, 'square', 0.045, 520, 0); },
    breachWin: function () {
      tone(523.25, 0.09, 'triangle', 0.09, 659.25, 0);
      tone(659.25, 0.11, 'triangle', 0.09, 783.99, 0.07);
      tone(1046.5, 0.22, 'sine', 0.11, 1318.5, 0.14);
    },
    sirenBuzz: function () {
      tone(220, 0.16, 'sawtooth', 0.06, 155, 0);
      tone(185, 0.18, 'sawtooth', 0.05, 130, 0.12);
    },
    wheelTick: function () { tone(1280, 0.028, 'triangle', 0.03, 780, 0); },
    reelClunk: function () { tone(190, 0.08, 'square', 0.07, 72, 0); },
    jackpot: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone(f, 0.16, 'triangle', 0.09, f * 1.04, i * 0.065);
      });
    },
    punch: function (heavy) {
      tone(heavy ? 135 : 98, 0.14, 'sine', heavy ? 0.15 : 0.1, 36, 0);
      if (heavy) tone(620, 0.09, 'triangle', 0.06, 980, 0.03);
    },
    pickup: function () {
      tone(740, 0.07, 'sine', 0.08, 1180, 0);
      tone(1180, 0.12, 'sine', 0.08, 1480, 0.06);
    },
    graze: function () {
      tone(980, 0.055, 'triangle', 0.07, 1560, 0);
    },
    fever: function (tier) {
      var base = tier >= 3 ? 659.25 : (tier === 2 ? 587.33 : 523.25);
      tone(base, 0.08, 'triangle', 0.08, base * 1.25, 0);
      tone(base * 1.5, 0.13, 'sine', 0.09, base * 1.8, 0.05);
    },
    crash: function () {
      tone(150, 0.24, 'sawtooth', 0.09, 42, 0);
    }
  };

  /* ---------------- Sizing Helper (Zero Overflow Safe, Mobile 104x92 Card Ready) ---------------- */
  function syncCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var isPreview = Boolean(canvas.hasAttribute && canvas.hasAttribute('data-zig-preview'));
    var cw = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 0;
    var ch = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 0;
    var rect = canvas.getBoundingClientRect();
    var rawW = cw > 0 ? cw : (rect.width || (isPreview ? 104 : 280));
    var minW = isPreview ? 72 : 150;
    var w = Math.max(minW, Math.round(rawW));
    var h = cssHeight || Math.max(isPreview ? 68 : 80, Math.round(ch || rect.height || (isPreview ? 92 : 160)));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = Math.round(w * dpr);
    var ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function spawnFloatingReward(text, toneKey) {
    try {
      var vw = Math.max(320, window.innerWidth || 360);
      var cashEl = document.getElementById('zone-cash');
      var r = cashEl ? cashEl.getBoundingClientRect() : null;
      if (!r || r.width < 8 || r.right <= 16 || r.left < 4 || r.left > vw - 16) {
        var hudEl = document.getElementById('zone-topbar-hud');
        var hr = hudEl ? hudEl.getBoundingClientRect() : null;
        r = (hr && hr.width > 16) ? hr : { left: vw * 0.5 - 20, top: 64, width: 40 };
      }
      var pop = document.createElement('div');
      pop.className = 'zig-float-pop';
      if (toneKey === 'gold') pop.setAttribute('data-tone', 'gold');
      var cx = Math.max(76, Math.min(vw - 76, Math.round(r.left + r.width * 0.5)));
      pop.style.left = cx + 'px';
      pop.style.top = Math.round(Math.max(54, r.top)) + 'px';
      pop.textContent = text;
      document.body.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 1300);
    } catch (_) {}
  }

  /* ---------------- Zero-GC Pooled Watercolor Burst Rings & Canvas Floating Popups (pixi-vector-arcade) ---------------- */
  function createZeroGcFxPool(ringCap, popupCap) {
    var rings = [];
    var popups = [];
    for (var i = 0; i < ringCap; i++) {
      rings.push({ active: false, x: 0, y: 0, r: 0, maxR: 56, life: 0, maxLife: 0.45, tone: 'gold', lineW: 2.8 });
    }
    for (var j = 0; j < popupCap; j++) {
      popups.push({ active: false, x: 0, y: 0, vy: -42, text: '', life: 0, maxLife: 0.78, tone: 'gold', size: 12 });
    }
    return {
      rings: rings,
      popups: popups,
      spawnRing: function (x, y, startR, maxR, toneKey, lineW) {
        for (var k = 0; k < rings.length; k++) {
          var rg = rings[k];
          if (!rg.active) {
            rg.active = true;
            rg.x = x;
            rg.y = y;
            rg.r = startR || 10;
            rg.maxR = maxR || 58;
            rg.maxLife = 0.46;
            rg.life = rg.maxLife;
            rg.tone = toneKey || 'gold';
            rg.lineW = lineW || 2.8;
            return rg;
          }
        }
        return null;
      },
      spawnFeverBurst: function (x, y, feverTierObj) {
        var count = Math.max(1, (feverTierObj && feverTierObj.rings) || 1);
        for (var n = 0; n < count; n++) {
          this.spawnRing(x, y, 10 + n * 8, 48 + n * 18, n === 0 ? 'gold' : (feverTierObj && feverTierObj.tone) || 'good', 3.0 - n * 0.45);
        }
      },
      spawnPopup: function (x, y, text, toneKey, size) {
        if (!text) return null;
        for (var k = 0; k < popups.length; k++) {
          var pp = popups[k];
          if (!pp.active) {
            pp.active = true;
            pp.x = x;
            pp.y = y;
            pp.vy = -38;
            pp.text = text;
            pp.maxLife = 0.82;
            pp.life = pp.maxLife;
            pp.tone = toneKey || 'gold';
            pp.size = size || 12;
            return pp;
          }
        }
        return null;
      },
      renderAndStep: function (ctx, w, h, dt, pal) {
        var step = Math.max(0, dt || 0);
        var reduced = isReducedMotion();
        for (var r = 0; r < rings.length; r++) {
          var rg = rings[r];
          if (!rg.active) continue;
          rg.life -= step;
          if (rg.life <= 0) {
            rg.active = false;
            continue;
          }
          var prog = 1 - (rg.life / rg.maxLife);
          var curR = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - prog, 2));
          ctx.save();
          ctx.strokeStyle = toneColorFromPalette(rg.tone, pal);
          ctx.globalAlpha = Math.max(0, (1 - prog) * (reduced ? 0.55 : 0.92));
          ctx.lineWidth = rg.lineW;
          ctx.beginPath();
          ctx.arc(rg.x, rg.y, curR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        for (var p = 0; p < popups.length; p++) {
          var pp = popups[p];
          if (!pp.active) continue;
          pp.life -= step;
          if (pp.life <= 0) {
            pp.active = false;
            continue;
          }
          if (!reduced) pp.y += pp.vy * step;
          var ageFrac = 1 - (pp.life / pp.maxLife);
          var popScale = reduced ? 1 : easeOutBack(Math.min(1, ageFrac * 4.2));
          var fadeAlpha = ageFrac > 0.68 ? Math.max(0, (1 - ageFrac) / 0.32) : 1;
          var clampedX = clampNum(pp.x, 46, Math.max(46, w - 46));
          var clampedY = clampNum(pp.y, 18, Math.max(22, h - 14));
          ctx.save();
          ctx.translate(clampedX, clampedY);
          ctx.scale(popScale, popScale);
          ctx.globalAlpha = fadeAlpha;
          ctx.font = fontStack(900, pp.size);
          ctx.textAlign = 'center';
          ctx.lineWidth = 2.8;
          ctx.strokeStyle = pal.paper;
          ctx.strokeText(pp.text, 0, 0);
          ctx.fillStyle = toneColorFromPalette(pp.tone, pal);
          ctx.fillText(pp.text, 0, 0);
          ctx.restore();
        }
      },
      clear: function () {
        for (var i = 0; i < rings.length; i++) rings[i].active = false;
        for (var j = 0; j < popups.length; j++) popups[j].active = false;
      }
    };
  }

  /* ---------------- Game State Containers ---------------- */
  var state = {
    t: 0,
    clockSec: 0,
    bootAt: Date.now(),
    lastCash: null,
    lastLang: '',
    lastDevice: 'pointer',
    hoveredPreviewId: null,
    rafId: 0,
    rafTicks: 0,
    canvasVisibility: {},
    inputBuffer: ArcadeFeelEngine.createActionBuffer(ARCADE_CONSTANTS.INPUT_BUFFER_SEC),
    coyote: ArcadeFeelEngine.createCoyoteTracker(ARCADE_CONSTANTS.COYOTE_GRACE_SEC),
    juice: ArcadeFeelEngine.createJuiceRig(),
    fxPool: createZeroGcFxPool(24, 24),
    touchSwipe: { active: false, startX: 0, startY: 0, lastLaneStepX: 0, pointerId: null },
    /* Atmospheric Preview Motes */
    previewFX: {
      rain: [],
      embers: [],
      motes: [],
      bokeh: [],
      chalk: []
    },
    arcadeMode: 'getaway',
    /* Nitro Getaway / Street Drift (Home Instant Game #1) */
    getaway: {
      open: false,
      running: false,
      lane: 1.5,
      targetLane: 1.5,
      speed: 260,
      score: 0,
      best: 0,
      bags: 0,
      grazes: 0,
      combo: 1,
      feverTier: 0,
      nitro: 100,
      boosting: false,
      flash: 0,
      gameOver: false,
      entities: [],
      spawnTimer: 0,
      particles: []
    },
    /* Smuggler Jet Air-Corridor Run (Home Instant Game #4) */
    jet: {
      running: false,
      gameOver: false,
      alt: 0.5,
      targetAlt: 0.5,
      speed: 250,
      score: 0,
      crates: 0,
      grazes: 0,
      combo: 1,
      feverTier: 0,
      entities: [],
      spawnTimer: 0,
      particles: []
    },
    /* Safe-Crack Reflex (Crimes & Home Instant Game #2) */
    heist: {
      angle: 0,
      speed: 2.55,
      dir: 1,
      targetCenter: 1.1,
      targetArc: 0.78,
      streak: 0,
      feverTier: 0,
      banner: '',
      bannerTone: 'gold',
      bannerUntil: 0,
      sirenUntil: 0,
      sparks: [],
      rain: []
    },
    /* Gym Heavy-Bag Overdrive */
    gym: {
      bagAngle: 0,
      bagVel: 0,
      gaugePos: 0.5,
      gaugeDir: 1,
      combo: 0,
      feverTier: 0,
      banner: '',
      bannerTone: 'good',
      bannerUntil: 0,
      sparks: [],
      rings: []
    },
    /* Casino Roulette */
    roulette: {
      wheelAngle: 0,
      wheelSpeed: 0.35,
      ballAngle: 0,
      ballSpeed: -0.9,
      ballRadiusFrac: 0.84,
      spinning: false,
      settling: false,
      lastPocket: null,
      lastTickIdx: -1,
      highlightUntil: 0,
      sparks: []
    },
    /* Casino Slots */
    slots: {
      spinning: false,
      spinStart: 0,
      offsets: [0, 2, 4],
      speeds: [0, 0, 0],
      locked: [true, true, true],
      targets: [1, 2, 0],
      lastSig: '',
      coins: [],
      leverPull: 0
    }
  };

  for (var ri = 0; ri < 38; ri++) {
    state.heist.rain.push({ x: Math.random(), y: Math.random(), len: 8 + Math.random() * 14, spd: 0.5 + Math.random() * 0.7 });
  }
  for (var pri = 0; pri < 22; pri++) {
    state.previewFX.rain.push({ x: Math.random(), y: Math.random(), len: 10 + Math.random() * 14, spd: 0.65 + Math.random() * 0.75 });
  }
  for (var pei = 0; pei < 12; pei++) {
    state.previewFX.embers.push({ x: Math.random(), y: Math.random(), r: 1.1 + Math.random() * 1.6, spd: 0.22 + Math.random() * 0.32, drift: (Math.random() - 0.5) * 0.25 });
    state.previewFX.motes.push({ x: Math.random(), y: Math.random(), r: 1.0 + Math.random() * 1.5, spd: 0.08 + Math.random() * 0.14, phase: Math.random() * Math.PI * 2 });
    state.previewFX.bokeh.push({ x: Math.random(), y: Math.random(), r: 2.5 + Math.random() * 5.5, spd: 0.06 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2 });
    state.previewFX.chalk.push({ x: Math.random(), y: Math.random(), r: 0.9 + Math.random() * 1.6, spd: 0.09 + Math.random() * 0.16, drift: (Math.random() - 0.5) * 0.18 });
  }

  function goScreen(id) {
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(id);
      return;
    }
    var btn = document.querySelector('#zone-area-navigation button[data-zone-screen="' + id + '"]');
    if (btn) btn.click();
  }

  function renderSoundBtnInner(ar) {
    var label = soundEnabled
      ? (ar ? 'الصوت: مفعل' : 'SFX: ON')
      : (ar ? 'الصوت: صامت' : 'SFX: OFF');
    return (soundEnabled ? SVG_SPEAKER_ON : SVG_SPEAKER_OFF) + '<span>' + label + '</span>';
  }

  /* ---------------- 1. HOME & CASINO: Poster Arcade Deck + 4 Playable 60fps Instant Games ---------------- */
  function emitArcadeBridge(gameKind, cue, comboCount, extra) {
    var combo = Math.max(1, Math.floor(Number(comboCount) || 1));
    var fever = getFeverTier(combo, isAr());
    var detail = Object.assign({
      cue: cue || 'heavy_bag_impact',
      game: gameKind || 'arcade',
      combo: combo,
      feverTier: fever.tier,
      feverCode: fever.code
    }, extra || {});

    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try {
        window.ZoneEcs3D.triggerStageAction('safehouse-empire', 'pulse', {
          game: detail.game,
          combo: combo,
          cue: detail.cue,
          feverCode: fever.code
        });
      } catch (_) {}
    }

    try {
      window.dispatchEvent(new CustomEvent('zone:audio-cue', { detail: detail }));
    } catch (_) {}

    if (window.ZoneAudioHaptics && typeof window.ZoneAudioHaptics.play === 'function') {
      try {
        window.ZoneAudioHaptics.play(detail.cue, detail);
      } catch (_) {}
    }
  }

  function notifySafehouseArcadeWin(gameKind, extra) {
    var combo = Number(extra && (extra.combo || extra.streak)) || 1;
    var cueMap = {
      gym: 'heavy_bag_impact',
      heist: 'vault_tumbler',
      getaway: 'cash_payout',
      'getaway-fence': 'cash_payout',
      jet: 'cash_payout',
      roulette: 'roulette_tick',
      slots: 'jackpot_fanfare'
    };
    emitArcadeBridge(gameKind || 'arcade', cueMap[gameKind] || 'cash_payout', combo, extra);
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try {
        window.ZoneEcs3D.triggerStageAction('safehouse-empire', 'arcade-win', Object.assign({ game: gameKind || 'arcade' }, extra || {}));
      } catch (_) {}
    }
  }

  function updateTouchDeckLabels(mode) {
    var ar = isAr();
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;
    var deck = document.getElementById('zig-touch-controls');
    if (!deck) return;
    deck.setAttribute('data-arcade-mode', mode || 'getaway');
    var leftBtn = deck.querySelector('[data-zig-touch="left"]');
    var actBtn = deck.querySelector('[data-zig-touch="action"]');
    var rightBtn = deck.querySelector('[data-zig-touch="right"]');
    var hintEl = document.getElementById('zig-touch-hint');
    if (mode === 'heist') {
      if (leftBtn) leftBtn.textContent = dict.focusBuffer;
      if (actBtn) actBtn.textContent = dict.crackVault;
      if (rightBtn) rightBtn.textContent = dict.feverHit;
      if (hintEl) hintEl.textContent = dict.hintHeist;
    } else if (mode === 'gym') {
      if (leftBtn) leftBtn.textContent = dict.focusBuffer;
      if (actBtn) actBtn.textContent = dict.strikeBag;
      if (rightBtn) rightBtn.textContent = dict.feverHit;
      if (hintEl) hintEl.textContent = dict.hintGym;
    } else if (mode === 'jet') {
      if (leftBtn) leftBtn.textContent = dict.climbUp;
      if (actBtn) actBtn.textContent = dict.stabilize;
      if (rightBtn) rightBtn.textContent = dict.diveDown;
      if (hintEl) hintEl.textContent = dict.hintJet;
    } else {
      if (leftBtn) leftBtn.textContent = dict.steerLeft;
      if (actBtn) actBtn.textContent = dict.nitroBoost;
      if (rightBtn) rightBtn.textContent = dict.steerRight;
      if (hintEl) hintEl.textContent = dict.hintDrift;
    }
  }

  function updateArcadeStageBar(mode) {
    var ar = isAr();
    var headSpan = document.getElementById('zig-stage-heading-text');
    var routeBtn = document.getElementById('zig-getaway-fence');
    if (headSpan) {
      if (mode === 'heist') {
        headSpan.textContent = ar
          ? 'اختراق خزنة الأزقة: المس داخل القوس الذهبي أو اضغط المسافة لكسر القفل'
          : 'Alley Heist · Safe-Crack: Tap inside the Gold Arc or press Space to breach';
      } else if (mode === 'gym') {
        headSpan.textContent = ar
          ? 'كيس الملاكمة التفاعلي: المس في منتصف عداد الذروة لتسديد ضربة قاضية'
          : 'Heavy Bag · Overdrive: Strike inside the Gold Sweet-Spot to chain combos';
      } else if (mode === 'jet') {
        headSpan.textContent = ar
          ? 'طائرة التهريب الليلية: المس للأعلى/الأسفل لمراوغة الرادار والتقاط الشحنات'
          : 'Smuggler Jet · Radar Run: Tap altitude or Up/Down Arrows to dodge radar & grab drops';
      } else {
        headSpan.textContent = ar
          ? 'سباق شوارع النيترو: المس المسارات أو استخدم الأسهم للمراوغة وجمع الحقائب'
          : 'Street Drift · Nitro Getaway: Tap Lanes or Arrows to dodge cruisers & grab loot';
      }
    }
    if (routeBtn) {
      if (mode === 'heist') {
        routeBtn.textContent = ar ? 'لوحة الجرائم 3D ←' : 'Open Crimes 3D →';
      } else if (mode === 'gym') {
        routeBtn.textContent = ar ? 'صالة الحديد 3D ←' : 'Open Gym 3D →';
      } else if (mode === 'jet') {
        routeBtn.textContent = ar ? 'الرحلات والكازينو ←' : 'Open Casino / Flights →';
      } else {
        routeBtn.textContent = ar ? 'تصريف الغنيمة (عملية شارع)' : 'Fence Loot (Run Street Op)';
      }
    }
    updateTouchDeckLabels(mode);
  }

  function startGetawayRun(modeOverride) {
    var mode = (typeof modeOverride === 'string' && modeOverride) ? modeOverride : (state.arcadeMode || 'getaway');
    state.arcadeMode = mode;
    state.inputBuffer.clear();
    state.coyote.clear();
    state.juice.reset();
    state.fxPool.clear();
    var gw = state.getaway;
    gw.open = true;

    if (mode === 'getaway') {
      gw.running = true;
      gw.gameOver = false;
      gw.lane = 1.5;
      gw.targetLane = 1.5;
      gw.speed = 275;
      gw.score = 0;
      gw.bags = 0;
      gw.grazes = 0;
      gw.combo = 1;
      gw.feverTier = 0;
      gw.nitro = 100;
      gw.boosting = false;
      gw.entities = [];
      gw.particles = [];
      gw.spawnTimer = 0.35;
      sfx.pickup();
    } else if (mode === 'jet') {
      var jt = state.jet;
      jt.running = true;
      jt.gameOver = false;
      jt.alt = 0.5;
      jt.targetAlt = 0.5;
      jt.speed = 255;
      jt.score = 0;
      jt.crates = 0;
      jt.grazes = 0;
      jt.combo = 1;
      jt.feverTier = 0;
      jt.entities = [];
      jt.particles = [];
      jt.spawnTimer = 0.35;
      sfx.pickup();
    } else if (mode === 'heist') {
      state.heist.streak = 0;
      state.heist.feverTier = 0;
      state.heist.speed = 2.55;
      sfx.lockClick();
    } else if (mode === 'gym') {
      state.gym.combo = 0;
      state.gym.feverTier = 0;
      state.gym.bagVel = -4.8;
      sfx.punch(true);
    }

    updateArcadeStageBar(mode);
    var stage = document.getElementById('zig-getaway-stage');
    if (stage) {
      stage.hidden = false;
      stage.setAttribute('data-arcade-mode', mode);
      if (typeof stage.scrollIntoView === 'function') {
        try { stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
      }
    }
    var gCv = document.getElementById('zig-getaway-canvas');
    if (gCv) observeInteractiveCanvas(gCv);
    renderActiveArcadeStage(0, (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(), 0);
    ensureLoopRunning();
  }

  function mountHomeArcade() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    var scr = main ? (main.getAttribute('data-zone-screen') || '') : '';
    if (!main || (scr !== 'home' && scr !== 'casino')) {
      state.hoveredPreviewId = null;
      state.getaway.open = false;
      state.getaway.running = false;
      state.jet.running = false;
      var stale = document.getElementById('zig-home-arcade');
      if (stale) stale.remove();
      return;
    }
    var anchor = scr === 'home'
      ? (main.querySelector('.zone-home-brief') || main.querySelector('.zone-page-heading'))
      : (main.querySelector('[data-zone-casino-pit="1"]') || main.querySelector('.zone-content-split') || main.querySelector('.zone-page-heading'));
    if (!anchor) return;
    var ar = isAr();
    var langKey = ar ? 'ar' : 'en';
    var existing = document.getElementById('zig-home-arcade');
    if (existing && existing.getAttribute('data-lang') === langKey && existing.getAttribute('data-mounted-screen') === scr && existing.parentElement === main) {
      /* On Home, guarantee #zig-home-arcade stays #1 right after .zone-home-brief and BEFORE #zone-ascension-hub & #zone-char-3d */
      if (scr === 'home') {
        ensureHomeArcadePlacement(main, existing);
      }
      return;
    }
    if (existing) existing.remove();
    state.hoveredPreviewId = null;

    var sec = document.createElement('section');
    sec.id = 'zig-home-arcade';
    sec.className = 'zig-arcade-deck zig-home-arcade';
    sec.setAttribute('data-lang', langKey);
    sec.setAttribute('data-mounted-screen', scr);

    var cards = [
      {
        id: 'gym',
        art: '/assets/ui/watercolor-art/arcade-heavybag.webp',
        alt: ar ? 'كيس الملاكمة التفاعلي' : 'Heavy Bag · Overdrive',
        badge: ar ? '60 إطاراً · قوة' : '60fps Reflex',
        name: ar ? 'كيس الملاكمة التفاعلي' : 'Heavy Bag',
        desc: ar ? 'سدّد اللكمة في النقطة الذهبية لمضاعفة زخم التدريب الفوري.' : 'Strike the gold sweet-spot meter to chain overdrive bag combos.',
        cta: ar ? 'العب فوراً' : 'Play Heavy Bag'
      },
      {
        id: 'heist',
        art: '/assets/ui/watercolor-art/arcade-heist.webp',
        alt: ar ? 'اختراق خزنة الأزقة' : 'Alley Heist · Safe-Crack',
        badge: ar ? 'توقيت دقيق' : 'Precision Lock',
        name: ar ? 'اختراق خزنة الأزقة' : 'Alley Heist',
        desc: ar ? 'اضرب القفل النحاسي في القوس الذهبي لاختراق الخزائن المصفحة.' : 'Crack rotating brass tumblers inside the gold arc for instant loot.',
        cta: ar ? 'اخترق الخزنة' : 'Crack Vault'
      },
      {
        id: 'getaway',
        art: '/assets/ui/watercolor-art/arcade-getaway.webp',
        alt: ar ? 'سباق شوارع النيترو' : 'Street Drift · Getaway',
        badge: ar ? 'جولة فورية' : 'Instant Drift',
        name: ar ? 'سباق شوارع النيترو' : 'Street Drift',
        desc: ar ? 'راوغ دوريات المطاردة واجمع حقائب الغنائم بسرعة 160 ميلاً.' : 'Thread pursuit cruisers across 4 lanes and grab cash drops at 160 MPH.',
        cta: ar ? 'ابدأ المطاردة' : 'Launch Drift'
      },
      {
        id: 'casino',
        art: '/assets/ui/watercolor-art/arcade-casino.webp',
        alt: ar ? 'طائرة التهريب الليلية' : 'Smuggler Jet · Radar Run',
        badge: ar ? 'ممر جوي سري' : 'Air Corridor',
        name: ar ? 'طائرة التهريب الليلية' : 'Smuggler Jet',
        desc: ar ? 'حلّق تحت الرادار، التقط صناديق المهربات وادخل صالون الكازينو.' : 'Fly low under radar rings, snag air-drop crates & hit the VIP salon.',
        cta: ar ? 'إقلاع فوري' : 'Fly Smuggler Jet'
      }
    ];

    sec.innerHTML =
      '<div class="zig-arcade-header">' +
        '<div class="zig-arcade-title-wrap">' +
          '<div class="zig-arcade-emblem">' + SVG_ARCADE_CREST + '</div>' +
          '<div>' +
            '<h2 class="zig-arcade-title">' +
              '<span>' + (ar ? 'أركيد النقابة' : 'Syndicate Arcade') + '</span>' +
              '<span class="zig-live-pill">' + (ar ? 'مباشر · 60fps' : 'Live · 60fps') + '</span>' +
            '</h2>' +
            '<p class="zig-arcade-sub">' +
              (ar
                ? '4 ألعاب فورية قابلة للعب مباشرة هنا ومتصلة بمقرك ثلاثي الأبعاد'
                : '4 instant 60fps games playable right here — synced live with your 3D Safehouse') +
            '</p>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="zig-sound-btn" id="zig-sound-toggle" data-zig-muted="' + (soundEnabled ? '0' : '1') + '" data-zig-sfx="' + (soundEnabled ? 'on' : 'off') + '">' +
          renderSoundBtnInner(ar) +
        '</button>' +
      '</div>' +
      '<div class="zig-arcade-grid">' +
        cards.map(function (c) {
          return (
            '<button type="button" class="zig-game-card" data-zig-launch="' + c.id + '">' +
              '<div class="zig-card-media">' +
                '<img class="zig-card-art" src="' + c.art + '" alt="' + c.alt + '" loading="eager" decoding="async">' +
                '<canvas class="zig-card-shader" data-zig-preview="' + c.id + '"></canvas>' +
                '<span class="zig-card-badge">' + c.badge + '</span>' +
              '</div>' +
              '<div class="zig-game-card-body">' +
                '<strong class="zig-game-card-name">' + c.name + '</strong>' +
                '<span class="zig-game-card-desc">' + c.desc + '</span>' +
                '<span class="zig-game-card-cta"><span>' + c.cta + '</span>' + SVG_CTA_CHEVRON + '</span>' +
              '</div>' +
            '</button>'
          );
        }).join('') +
      '</div>' +
      '<div class="zig-getaway-stage" id="zig-getaway-stage" data-arcade-mode="' + state.arcadeMode + '"' + (state.getaway.open ? '' : ' hidden') + '>' +
        '<div class="zig-getaway-bar">' +
          '<div class="zig-getaway-heading">' +
            SVG_WHEEL_STEER +
            '<span id="zig-stage-heading-text">' +
              (ar ? 'سباق شوارع النيترو: المس المسارات أو استخدم الأسهم للمراوغة' : 'Street Drift · Nitro Getaway: Tap Lanes or Arrows to Dodge') +
            '</span>' +
          '</div>' +
          '<div class="zig-stage-controls">' +
            '<button type="button" class="zig-btn" id="zig-getaway-restart">' + (ar ? 'جولة جديدة' : 'New Run') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-fence">' + (ar ? 'تصريف الغنيمة (عملية شارع)' : 'Fence Loot (Run Street Op)') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-close">' + (ar ? 'إغلاق' : 'Close') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="zig-getaway-canvas-wrap"><canvas id="zig-getaway-canvas" aria-label="' + (ar ? 'منصة ألعاب أركيد النقابة التفاعلية' : 'Syndicate Arcade Interactive Stage') + '"></canvas></div>' +
        '<div class="zig-touch-deck" id="zig-touch-controls" data-arcade-mode="' + state.arcadeMode + '"' + (isCompactMobile() ? ' data-zig-force-touch="1"' : '') + ' role="group" aria-label="' + (ar ? 'أزرار التحكم باللمس' : 'Arcade Touch Controls') + '">' +
          '<div class="zig-touch-zones">' +
            '<button type="button" class="zig-touch-btn" data-zig-touch="left">' + (ar ? ARCADE_I18N.ar.steerLeft : ARCADE_I18N.en.steerLeft) + '</button>' +
            '<button type="button" class="zig-touch-btn" data-zig-touch="action">' + (ar ? ARCADE_I18N.ar.nitroBoost : ARCADE_I18N.en.nitroBoost) + '</button>' +
            '<button type="button" class="zig-touch-btn" data-zig-touch="right">' + (ar ? ARCADE_I18N.ar.steerRight : ARCADE_I18N.en.steerRight) + '</button>' +
          '</div>' +
          '<div class="zig-touch-hint" id="zig-touch-hint">' + (ar ? ARCADE_I18N.ar.hintDrift : ARCADE_I18N.en.hintDrift) + '</div>' +
        '</div>' +
      '</div>';

    anchor.insertAdjacentElement('afterend', sec);
    if (scr === 'home') ensureHomeArcadePlacement(main, sec);
    updateArcadeStageBar(state.arcadeMode);

    var sndBtn = sec.querySelector('#zig-sound-toggle');
    if (sndBtn) {
      sndBtn.addEventListener('click', function () {
        setSoundEnabled(!soundEnabled);
        sndBtn.setAttribute('data-zig-muted', soundEnabled ? '0' : '1');
        sndBtn.setAttribute('data-zig-sfx', soundEnabled ? 'on' : 'off');
        if (soundEnabled) sfx.pickup();
        sndBtn.innerHTML = renderSoundBtnInner(isAr());
      });
    }

    sec.querySelectorAll('[data-zig-launch]').forEach(function (btn) {
      var cardId = btn.getAttribute('data-zig-launch');
      btn.addEventListener('pointerenter', function () {
        state.hoveredPreviewId = cardId;
        ensureLoopRunning();
      });
      btn.addEventListener('pointerleave', function () {
        if (state.hoveredPreviewId === cardId) {
          state.hoveredPreviewId = null;
          ensureLoopRunning();
        }
      });
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-zig-launch');
        ensureAudio();
        if (id === 'getaway') {
          startGetawayRun('getaway');
        } else if (id === 'heist') {
          startGetawayRun('heist');
        } else if (id === 'casino') {
          if (scr === 'casino') {
            var pitEl = document.querySelector('[data-zone-casino-pit="1"]');
            if (pitEl && typeof pitEl.scrollIntoView === 'function') {
              try { pitEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
            }
          }
          startGetawayRun('jet');
        } else if (id === 'gym') {
          startGetawayRun('gym');
        }
      });
    });

    var restartBtn = sec.querySelector('#zig-getaway-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        startGetawayRun(state.arcadeMode || 'getaway');
      });
    }

    var closeBtn = sec.querySelector('#zig-getaway-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        state.getaway.open = false;
        state.getaway.running = false;
        state.getaway.boosting = false;
        state.jet.running = false;
        state.inputBuffer.clear();
        state.coyote.clear();
        state.juice.reset();
        var st = document.getElementById('zig-getaway-stage');
        if (st) st.hidden = true;
        ensureLoopRunning();
      });
    }

    var fenceBtn = sec.querySelector('#zig-getaway-fence');
    if (fenceBtn) {
      fenceBtn.addEventListener('click', function () {
        var mode = state.arcadeMode || 'getaway';
        if (mode === 'gym') {
          sfx.punch(true);
          goScreen('gym');
          return;
        }
        if (mode === 'jet') {
          sfx.wheelTick();
          goScreen(scr === 'casino' ? 'city' : 'casino');
          return;
        }
        var v = window.__zoneLastView;
        var selectedCrime = v && v.crimeDesk && v.crimeDesk.selected && !v.crimeDesk.selected.disabled ? v.crimeDesk.selected : null;
        var readyCrime = selectedCrime || (v && Array.isArray(v.crimes) ? v.crimes.find(function (c) { return !c.disabled && typeof c.commit === 'function'; }) : null);
        if (mode === 'getaway' && readyCrime && typeof readyCrime.commit === 'function') {
          sfx.breachWin();
          readyCrime.commit();
          notifySafehouseArcadeWin('getaway-fence', {});
          spawnFloatingReward(isAr() ? 'جارٍ تصريف الغنيمة' : 'FENCING LOOT', 'gold');
        } else {
          sfx.lockClick();
          goScreen('crimes');
        }
      });
    }

    var touchDeck = sec.querySelector('#zig-touch-controls');
    if (touchDeck) {
      var handleTouchZoneDown = function (zone, ev) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        state.lastDevice = 'touch';
        ensureAudio();
        var mode = state.arcadeMode || 'getaway';
        if (mode === 'heist') {
          requestHeistAction('touch');
          return;
        }
        if (mode === 'gym') {
          requestGymAction('touch');
          return;
        }
        if (mode === 'jet') {
          if (state.jet.gameOver || !state.jet.running) {
            startGetawayRun('jet');
            return;
          }
          if (zone === 'left') {
            state.inputBuffer.press('climb_up', state.clockSec, { step: -0.17 });
            applyBufferedJetControls();
          } else if (zone === 'right') {
            state.inputBuffer.press('dive_down', state.clockSec, { step: 0.17 });
            applyBufferedJetControls();
          } else {
            state.jet.targetAlt = 0.5;
            sfx.lockClick();
          }
          emitArcadeBridge('jet', 'ui_nav', state.jet.combo, { zone: zone });
          return;
        }
        if (state.getaway.gameOver || !state.getaway.running) {
          startGetawayRun('getaway');
          return;
        }
        if (zone === 'left') {
          state.inputBuffer.press('steer_left', state.clockSec, { delta: -1 });
          applyBufferedDriftControls();
          emitArcadeBridge('getaway', 'ui_nav', state.getaway.combo, { zone: 'left' });
        } else if (zone === 'right') {
          state.inputBuffer.press('steer_right', state.clockSec, { delta: 1 });
          applyBufferedDriftControls();
          emitArcadeBridge('getaway', 'ui_nav', state.getaway.combo, { zone: 'right' });
        } else if (zone === 'action') {
          state.getaway.boosting = true;
          emitArcadeBridge('getaway', 'ui_nav', state.getaway.combo, { zone: 'nitro' });
        }
      };

      touchDeck.querySelectorAll('[data-zig-touch]').forEach(function (tBtn) {
        var zoneName = tBtn.getAttribute('data-zig-touch');
        tBtn.addEventListener('pointerdown', function (ev) {
          tBtn.classList.add('is-pressed');
          handleTouchZoneDown(zoneName, ev);
        });
        var releaseTouchZone = function () {
          tBtn.classList.remove('is-pressed');
          if (zoneName === 'action') state.getaway.boosting = false;
        };
        tBtn.addEventListener('pointerup', releaseTouchZone);
        tBtn.addEventListener('pointercancel', releaseTouchZone);
        tBtn.addEventListener('pointerleave', releaseTouchZone);
      });
    }

    var gCanvas = sec.querySelector('#zig-getaway-canvas');
    if (gCanvas) {
      /* Lock 2D context eagerly so #zig-getaway-canvas never consumes a WebGL slot */
      try { gCanvas.getContext('2d'); } catch (_) {}
      observeInteractiveCanvas(gCanvas);
      var readEventXY = function (e) {
        if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY, touch: true };
        if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, touch: true };
        return { x: Number(e.clientX) || 0, y: Number(e.clientY) || 0, touch: e.pointerType === 'touch' };
      };
      var interactFromEvent = function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        ensureAudio();
        var pt = readEventXY(e);
        state.lastDevice = pt.touch ? 'touch' : 'pointer';
        state.touchSwipe.active = true;
        state.touchSwipe.startX = pt.x;
        state.touchSwipe.startY = pt.y;
        state.touchSwipe.lastLaneStepX = pt.x;

        var mode = state.arcadeMode || 'getaway';
        if (mode === 'heist') {
          requestHeistAction(state.lastDevice);
          return;
        }
        if (mode === 'gym') {
          requestGymAction(state.lastDevice);
          return;
        }
        if (mode === 'jet') {
          if (state.jet.gameOver || !state.jet.running) {
            startGetawayRun('jet');
            return;
          }
          var jRect = gCanvas.getBoundingClientRect();
          var relY = (pt.y - jRect.top) / Math.max(1, jRect.height);
          state.jet.targetAlt = Math.max(0.14, Math.min(0.86, relY));
          sfx.lockClick();
          return;
        }
        if (state.getaway.gameOver || !state.getaway.running) {
          startGetawayRun('getaway');
          return;
        }
        var rect = gCanvas.getBoundingClientRect();
        var roadFrac = isCompactMobile() ? 0.88 : 0.74;
        var roadW = Math.min(rect.width * roadFrac, 380);
        var roadLeft = (rect.width - roadW) * 0.5;
        var rel = (pt.x - rect.left - roadLeft) / Math.max(1, roadW);
        if (rel < 0.02) {
          state.inputBuffer.press('steer_left', state.clockSec, { delta: -1 });
          applyBufferedDriftControls();
        } else if (rel > 0.98) {
          state.inputBuffer.press('steer_right', state.clockSec, { delta: 1 });
          applyBufferedDriftControls();
        } else {
          var lane = Math.max(0, Math.min(3, Math.floor(rel * 4)));
          state.getaway.targetLane = lane;
          sfx.lockClick();
        }
      };
      var moveFromEvent = function (e) {
        if (!state.touchSwipe.active) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        var pt = readEventXY(e);
        var mode = state.arcadeMode || 'getaway';
        if (mode === 'getaway' && state.getaway.running && !state.getaway.gameOver) {
          var dxStep = pt.x - state.touchSwipe.lastLaneStepX;
          var dyTotal = pt.y - state.touchSwipe.startY;
          if (Math.abs(dxStep) >= ARCADE_CONSTANTS.TOUCH_SWIPE_MIN_PX && Math.abs(dxStep) >= Math.abs(dyTotal) * 0.65) {
            var dir = dxStep > 0 ? 1 : -1;
            state.touchSwipe.lastLaneStepX = pt.x;
            state.inputBuffer.press(dir < 0 ? 'steer_left' : 'steer_right', state.clockSec, { delta: dir });
            applyBufferedDriftControls();
          } else if (dyTotal <= -28 && state.getaway.nitro > 5) {
            state.getaway.boosting = true;
          }
        } else if (mode === 'jet' && state.jet.running && !state.jet.gameOver) {
          var jRect = gCanvas.getBoundingClientRect();
          var relY = (pt.y - jRect.top) / Math.max(1, jRect.height);
          state.jet.targetAlt = Math.max(0.14, Math.min(0.86, relY));
        }
      };
      var endSwipeEvent = function () {
        state.touchSwipe.active = false;
        state.getaway.boosting = false;
      };
      gCanvas.addEventListener('pointerdown', interactFromEvent);
      gCanvas.addEventListener('pointermove', moveFromEvent);
      gCanvas.addEventListener('pointerup', endSwipeEvent);
      gCanvas.addEventListener('pointercancel', endSwipeEvent);
      gCanvas.addEventListener('touchstart', function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
      }, { passive: false });
      gCanvas.addEventListener('touchmove', function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
      }, { passive: false });
    }

    /* Render 1 crisp static atmospheric frame on all 4 cards at rest (0 continuous rAF loops!) */
    renderStaticHomePreviews();
    if (state.getaway.open) renderActiveArcadeStage(0, (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(), 0);
  }

  function applyBufferedDriftControls() {
    var gw = state.getaway;
    if (!gw.running || gw.gameOver) return false;
    var leftHit = state.inputBuffer.consume('steer_left', state.clockSec);
    if (leftHit) {
      gw.targetLane = Math.max(0, Math.round(gw.targetLane) - 1);
      sfx.lockClick();
      return true;
    }
    var rightHit = state.inputBuffer.consume('steer_right', state.clockSec);
    if (rightHit) {
      gw.targetLane = Math.min(3, Math.round(gw.targetLane) + 1);
      sfx.lockClick();
      return true;
    }
    return false;
  }

  function applyBufferedJetControls() {
    var jt = state.jet;
    if (!jt.running || jt.gameOver) return false;
    var upHit = state.inputBuffer.consume('climb_up', state.clockSec);
    if (upHit) {
      jt.targetAlt = Math.max(0.14, jt.targetAlt - 0.17);
      sfx.lockClick();
      return true;
    }
    var downHit = state.inputBuffer.consume('dive_down', state.clockSec);
    if (downHit) {
      jt.targetAlt = Math.min(0.86, jt.targetAlt + 0.17);
      sfx.lockClick();
      return true;
    }
    return false;
  }

  /* ---------------- 2. CRIMES: Safe-Crack Reflex Canvas (80ms Buffer + 55ms Coyote + 55ms Hit-Stop) ---------------- */
  function requestHeistAction(sourceDevice) {
    ensureAudio();
    var h = state.heist;
    var check = evaluateHeistWindow(h.angle, h.dir, h.speed, h.targetCenter, h.targetArc, state.clockSec, state.coyote);
    if (check.shouldBuffer) {
      state.inputBuffer.press('crack_vault', state.clockSec, { source: sourceDevice || state.lastDevice });
      ensureLoopRunning();
      return { status: 'buffered', timeToArcMs: check.timeToArcMs };
    }
    return triggerHeistStrike({ coyoteSaved: check.coyoteSaved, buffered: false });
  }

  function triggerHeistStrike(opts) {
    ensureAudio();
    var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var h = state.heist;
    var diff = Math.atan2(Math.sin(h.angle - h.targetCenter), Math.cos(h.angle - h.targetCenter));
    var absDiff = Math.abs(diff);
    var halfArc = h.targetArc * 0.5;
    var ar = isAr();
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;
    var coyoteClaim = (opts && opts.coyoteSaved) ? state.coyote.consumeGrace('heist_arc', state.clockSec) : null;
    var wasBuffered = Boolean(opts && opts.buffered);

    if (absDiff <= halfArc || coyoteClaim) {
      var perfect = absDiff <= halfArc * 0.38 || Boolean(coyoteClaim && coyoteClaim.meta && coyoteClaim.meta.perfect);
      h.streak += 1;
      var fever = getFeverTier(h.streak, ar);
      var tierUp = fever.tier > h.feverTier;
      h.feverTier = fever.tier;
      var tagPrefix = wasBuffered ? (dict.buffered + ' ') : (coyoteClaim ? (dict.clutch + ' ') : '');
      h.banner = tagPrefix + (perfect
        ? (ar ? 'اختراق ذهبي متقن! ' + fever.label : 'PERFECT BREACH! ' + fever.label)
        : (ar ? 'تم فتح القفل! ' + fever.label : 'TUMBLER CRACKED! ' + fever.label));
      h.bannerTone = (perfect || fever.tier >= 2) ? 'gold' : 'good';
      h.bannerUntil = nowMs + 2100;

      /* 55ms Unscaled Hit-Stop + Damped trauma^2 Directional Camera Kick */
      var reduced = isReducedMotion();
      state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_VAULT_MS, nowMs, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
      state.juice.addTrauma(perfect ? 0.54 : 0.38, Math.cos(h.angle), Math.sin(h.angle), reduced);

      if (tierUp && fever.tier >= 1) sfx.fever(fever.tier);
      else sfx.breachWin();

      var heistCv = (state.getaway.open && document.getElementById('zig-getaway-canvas')) || document.getElementById('zig-heist-canvas');
      var hFxX = heistCv ? Math.max(80, (heistCv.clientWidth || 280) * 0.5) : 140;
      var hFxY = heistCv ? Math.max(54, (heistCv.clientHeight || 168) * 0.52) : 88;
      state.fxPool.spawnFeverBurst(hFxX, hFxY, fever);
      state.fxPool.spawnPopup(hFxX, hFxY - 26, fever.tier >= 1 ? fever.label : (wasBuffered ? dict.buffered : '+BREACH'), 'gold', 12);

      var sparkCount = Math.min(28, 16 + fever.tier * 4);
      for (var i = 0; i < sparkCount; i++) {
        if (h.sparks.length >= 48) break;
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 170;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.55 + Math.random() * 0.35,
          tone: i % 2 ? 'gold' : 'good'
        });
      }
      h.dir *= -1;
      h.targetCenter = Math.random() * Math.PI * 2;
      h.speed = Math.min(4.2, 2.4 + h.streak * 0.16);
      state.coyote.clear('heist_arc');
      notifySafehouseArcadeWin('heist', { streak: h.streak, combo: h.streak, perfect: perfect, feverCode: fever.code });

      /* Trigger real authoritative crime commit if ready */
      var selected = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
      if (selected && !selected.disabled && typeof selected.commit === 'function') {
        selected.commit();
      } else {
        var btn = document.querySelector('.zone-crime-plan button[data-crime-attempt]:not([disabled])');
        if (btn) btn.click();
      }
      ensureLoopRunning();
      return { status: 'hit', perfect: perfect, streak: h.streak, fever: fever };
    } else {
      h.streak = 0;
      h.feverTier = 0;
      h.speed = 2.45;
      h.sirenUntil = nowMs + 950;
      h.banner = ar ? 'انزلق القفل! اضغط داخل القوس الذهبي' : 'TUMBLER SLIPPED: HIT THE GOLD ARC';
      h.bannerTone = 'bad';
      h.bannerUntil = nowMs + 1500;
      state.juice.addTrauma(0.28, 1, 0, isReducedMotion());
      sfx.sirenBuzz();
      emitArcadeBridge('heist', 'step_fail', 1, { miss: true });
      for (var j = 0; j < 14; j++) {
        if (h.sparks.length >= 48) break;
        var a2 = Math.random() * Math.PI * 2;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a2) * 90,
          vy: Math.sin(a2) * 90,
          life: 0.4,
          tone: 'bad'
        });
      }
      ensureLoopRunning();
      return { status: 'miss', streak: 0 };
    }
  }

  function mountCrimesGame() {
    ensureMotionStyles();
    var scene = document.querySelector('#zone-main[data-zone-screen="crimes"] .zone-crime-scene');
    if (!scene) return;
    var ar = isAr();
    var label = ar ? 'لعبة فتح الخزنة التفاعلية' : 'Safe-Crack Heist Mini-Game';
    var existingCv = scene.querySelector('#zig-heist-canvas');
    if (existingCv) {
      existingCv.setAttribute('aria-label', label);
      observeInteractiveCanvas(existingCv);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'zig-heist-wrap';
    wrap.innerHTML = '<canvas id="zig-heist-canvas" aria-label="' + label + '"></canvas>';
    scene.appendChild(wrap);
    var c = wrap.querySelector('canvas');
    observeInteractiveCanvas(c);
    c.addEventListener('pointerdown', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      requestHeistAction(e && e.pointerType === 'touch' ? 'touch' : 'pointer');
    });
    renderCrimesGame(0, (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
    ensureLoopRunning();
  }

  /* ---------------- 3. GYM: Heavy-Bag Overdrive Canvas (80ms Buffer + 55ms Coyote + 35ms Hit-Stop) ---------------- */
  function requestGymAction(sourceDevice) {
    ensureAudio();
    var gm = state.gym;
    var check = evaluateGymWindow(gm.gaugePos, gm.gaugeDir, 1.15, state.clockSec, state.coyote);
    if (check.shouldBuffer) {
      state.inputBuffer.press('strike_bag', state.clockSec, { source: sourceDevice || state.lastDevice });
      ensureLoopRunning();
      return { status: 'buffered', timeToSweetMs: check.timeToSweetMs };
    }
    return triggerGymStrike({ coyoteSaved: check.coyoteSaved, buffered: false });
  }

  function triggerGymStrike(opts) {
    ensureAudio();
    var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var gm = state.gym;
    var dist = Math.abs(gm.gaugePos - 0.5);
    var coyoteClaim = (opts && opts.coyoteSaved) ? state.coyote.consumeGrace('gym_sweet', state.clockSec) : null;
    var wasBuffered = Boolean(opts && opts.buffered);
    var overdrive = dist <= 0.14 || Boolean(coyoteClaim);
    var ar = isAr();
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;

    gm.bagVel = -(overdrive ? 6.8 : 4.1);
    gm.combo = overdrive ? gm.combo + 1 : 1;
    var fever = getFeverTier(overdrive ? gm.combo : 1, ar);
    var tierUp = overdrive && fever.tier > gm.feverTier;
    gm.feverTier = overdrive ? fever.tier : 0;

    var prefix = wasBuffered ? (dict.buffered + ' ') : (coyoteClaim ? (dict.clutch + ' ') : '');
    gm.banner = overdrive
      ? (prefix + (fever.tier >= 2
          ? fever.label
          : (ar ? dict.overdrive + ' ×' + gm.combo : dict.overdrive + ' SWEET-SPOT x' + gm.combo)))
      : (ar ? 'ضربة مباشرة، استمر' : 'SOLID BAG STRIKE');
    gm.bannerTone = overdrive ? 'gold' : 'good';
    gm.bannerUntil = nowMs + 1700;

    var reduced = isReducedMotion();
    if (overdrive) {
      state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_CRIT_MS, nowMs, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
      state.juice.addTrauma(Math.min(0.68, 0.38 + fever.tier * 0.08), -0.8, -0.45, reduced);
      state.coyote.clear('gym_sweet');
      if (tierUp && fever.tier >= 1) sfx.fever(fever.tier);
      else sfx.punch(true);
    } else {
      state.juice.addTrauma(0.16, -0.4, -0.2, reduced);
      sfx.punch(false);
    }

    notifySafehouseArcadeWin('gym', { combo: gm.combo, overdrive: overdrive, feverCode: fever.code });

    var ringLoops = overdrive ? Math.max(1, fever.rings) : 1;
    for (var rk = 0; rk < ringLoops; rk++) {
      if (gm.rings.length < 18) {
        gm.rings.push({ r: 13 + rk * 7, alpha: 0.92 - rk * 0.14, tone: overdrive ? 'gold' : 'good' });
      }
    }
    var dmgVal = (overdrive ? 120 : 45) * fever.mult;
    var gymCv = (state.getaway.open && document.getElementById('zig-getaway-canvas')) || document.getElementById('zig-gym-canvas');
    var gFxX = gymCv ? Math.max(80, (gymCv.clientWidth || 280) * 0.5) : 140;
    var gFxY = gymCv ? Math.max(46, (gymCv.clientHeight || 168) * 0.40) : 68;
    if (overdrive && fever.tier >= 2) state.fxPool.spawnFeverBurst(gFxX, gFxY, fever);
    state.fxPool.spawnPopup(gFxX, gFxY - 18, '+' + dmgVal + (fever.tier >= 1 ? (' ' + fever.label) : ''), overdrive ? 'gold' : 'good', 11.5);

    for (var i = 0; i < (overdrive ? 22 : 10); i++) {
      if (gm.sparks.length >= 48) break;
      var ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
      var spd = 60 + Math.random() * 140;
      gm.sparks.push({
        x: 0, y: 0,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.3,
        tone: overdrive ? 'gold' : 'good'
      });
    }

    var sess = window.__zoneLastView && window.__zoneLastView.gymSession;
    var trainBtn = document.querySelector('.zone-gym-session button[data-gym-train]:not([disabled])');
    if (sess && typeof sess.train === 'function' && trainBtn) {
      sess.train();
    } else if (trainBtn) {
      trainBtn.click();
    }
    ensureLoopRunning();
    return { status: overdrive ? 'overdrive' : 'solid', combo: gm.combo, fever: fever };
  }

  function mountGymGame() {
    ensureMotionStyles();
    var sessionBox = document.querySelector('#zone-main[data-zone-screen="gym"] .zone-gym-session');
    if (!sessionBox) return;
    var ar = isAr();
    var label = ar ? 'تحدي كيس الملاكمة التفاعلي' : 'Heavy-Bag Reflex Trainer';
    var existingCv = sessionBox.querySelector('#zig-gym-canvas');
    if (existingCv) {
      existingCv.setAttribute('aria-label', label);
      observeInteractiveCanvas(existingCv);
      return;
    }
    var trainBtn = sessionBox.querySelector('button[data-gym-train]');
    var wrap = document.createElement('div');
    wrap.className = 'zig-gym-wrap';
    wrap.innerHTML = '<canvas id="zig-gym-canvas" aria-label="' + label + '"></canvas>';
    if (trainBtn) {
      trainBtn.insertAdjacentElement('beforebegin', wrap);
    } else {
      sessionBox.appendChild(wrap);
    }
    var c = wrap.querySelector('canvas');
    observeInteractiveCanvas(c);
    c.addEventListener('pointerdown', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      requestGymAction(e && e.pointerType === 'touch' ? 'touch' : 'pointer');
    });
    renderGymGame(0, (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
    ensureLoopRunning();
  }

  /* ---------------- 4. CASINO: 3D Casino Royale Stage + Roulette Wheel + 3-Reel Jackpot Slots ---------------- */
  function startRouletteAnimation() {
    var rl = state.roulette;
    rl.spinning = true;
    rl.settling = false;
    rl.wheelSpeed = 2.6;
    rl.ballSpeed = -9.4;
    rl.ballRadiusFrac = 0.88;
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try { window.ZoneEcs3D.triggerStageAction('casino-royale', 'roulette-spin', {}); } catch (_) {}
    }
    notifySafehouseArcadeWin('roulette', {});
    ensureLoopRunning();
  }

  function startSlotsAnimation() {
    var sl = state.slots;
    sl.spinning = true;
    sl.spinStart = performance.now();
    sl.locked = [false, false, false];
    sl.speeds = [22, 25, 28];
    sl.leverPull = 1;
    sfx.lockClick();
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try { window.ZoneEcs3D.triggerStageAction('casino-royale', 'slots-spin', {}); } catch (_) {}
    }
    notifySafehouseArcadeWin('slots', {});
    ensureLoopRunning();
  }

  function mountCasinoGames() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'casino') {
      var stale3d = document.getElementById('zig-casino-3d-stage');
      if (stale3d) stale3d.remove();
      return;
    }
    var ar = isAr();
    var rouletteLabel = ar ? 'عجلة الروليت الأوروبية' : 'European Roulette Wheel';
    var slotsLabel = ar ? 'ماكينة الجائزة الكبرى ثلاثية البكرات' : '3-Reel Jackpot Slot Machine';

    /* Live 3D Casino Royale Interactive Stage */
    var casinoPit = main.querySelector('[data-zone-casino-pit="1"]') || main.querySelector('[data-casino-table="roulette"]') || main.querySelector('.zone-content-split');
    if (casinoPit && !document.getElementById('zig-casino-3d-stage')) {
      var cStage = document.createElement('div');
      cStage.id = 'zig-casino-3d-stage';
      cStage.className = 'z3d-action-stage zig-casino-3d-stage';
      cStage.setAttribute('data-z3d-stage', 'casino-royale');
      if (casinoPit.hasAttribute && casinoPit.hasAttribute('data-zone-casino-pit')) {
        casinoPit.insertBefore(cStage, casinoPit.firstChild);
      } else {
        casinoPit.insertAdjacentElement('beforebegin', cStage);
      }
      if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
        try { window.ZoneEcs3D.scan(main); } catch (_) {}
      }
    }

    /* Roulette Wheel Canvas */
    var rTable = main.querySelector('[data-casino-table="roulette"]');
    if (rTable && !rTable.querySelector('#zig-roulette-canvas')) {
      var rHeader = rTable.firstElementChild;
      var rBox = document.createElement('div');
      rBox.className = 'zig-casino-canvas-box';
      rBox.innerHTML = '<canvas id="zig-roulette-canvas" aria-label="' + rouletteLabel + '"></canvas>';
      if (rHeader) rHeader.insertAdjacentElement('afterend', rBox);
      else rTable.prepend(rBox);

      var rCv = rBox.querySelector('canvas');
      observeInteractiveCanvas(rCv);
      rCv.addEventListener('pointerdown', function () {
        ensureAudio();
        var betBtn = rTable.querySelector('[data-roulette-bet="red"]:not([disabled])') || rTable.querySelector('[data-roulette-bet]:not([disabled])');
        if (!betBtn) return;
        startRouletteAnimation();
        betBtn.click();
      });

      rTable.addEventListener('click', function (ev) {
        var betBtn = ev.target && ev.target.closest ? ev.target.closest('[data-roulette-bet]') : null;
        if (betBtn && !betBtn.disabled) {
          ensureAudio();
          startRouletteAnimation();
        }
      });
      renderRouletteCanvas(0, performance.now());
    } else if (rTable) {
      var existRCv = rTable.querySelector('#zig-roulette-canvas');
      if (existRCv) {
        existRCv.setAttribute('aria-label', rouletteLabel);
        observeInteractiveCanvas(existRCv);
      }
    }

    /* 3-Reel Jackpot Slots Canvas */
    var sTable = main.querySelector('[data-casino-table="slots"]');
    if (sTable && !sTable.querySelector('#zig-slots-canvas')) {
      sTable.classList.add('zig-slots-mounted');
      var jackpotBanner = sTable.children[1] || sTable.firstElementChild;
      var sBox = document.createElement('div');
      sBox.className = 'zig-casino-canvas-box';
      sBox.innerHTML = '<canvas id="zig-slots-canvas" aria-label="' + slotsLabel + '"></canvas>';
      if (jackpotBanner) jackpotBanner.insertAdjacentElement('afterend', sBox);
      else sTable.prepend(sBox);

      var triggerSpin = function () {
        ensureAudio();
        var spinBtn = sTable.querySelector('[data-slots-spin]:not([disabled])');
        if (spinBtn) {
          startSlotsAnimation();
          spinBtn.click();
          return;
        }
        var g = window.__zoneGame;
        if (g && typeof g.spinSlots === 'function' && !g.slotsBusy && !(typeof g.gameplayDisabled === 'function' && g.gameplayDisabled())) {
          startSlotsAnimation();
          g.spinSlots();
        }
      };

      var sCv = sBox.querySelector('canvas');
      observeInteractiveCanvas(sCv);
      sCv.addEventListener('pointerdown', triggerSpin);
      sTable.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (btn && btn.classList.contains('zone-action-primary') && !btn.disabled) {
          ensureAudio();
          startSlotsAnimation();
        }
      });
      renderSlotsCanvas(0, performance.now());
    } else if (sTable) {
      var existSCv = sTable.querySelector('#zig-slots-canvas');
      if (existSCv) {
        existSCv.setAttribute('aria-label', slotsLabel);
        observeInteractiveCanvas(existSCv);
      }
    }
    ensureLoopRunning();
  }

  function escapeHtml(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
  }

  /* ---------------- 5. ATTACK: Street Brawl Versus Banner ---------------- */
  function mountAttackBanner() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'attack') return;
    var frame = document.getElementById('zone-combat-frame');
    if (!frame) return;
    var banner = document.getElementById('zig-brawl-hud');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'zig-brawl-hud';
      banner.className = 'zig-brawl-banner';
      frame.insertAdjacentElement('beforebegin', banner);
    }
    var v = window.__zoneLastView;
    var f = v && v.fight;
    var ar = isAr();
    var youName = (v && v.t && v.t.player) || (ar ? 'العميل' : 'Operative');
    var oppName = f ? f.name : (v && v.opps && v.opps[0] ? v.opps[0].name : (ar ? 'خصم الشارع' : 'Street Rival'));
    var youPct = Math.max(0, Math.min(100, Number(f ? f.youPct : 100) || 0));
    var oppPct = Math.max(0, Math.min(100, Number(f ? f.oppPct : 100) || 0));
    var statusTxt = f ? (f.verdict + ' · ' + f.progress) : (ar ? 'اختر خصماً لبدء القتال' : 'Select a rival below to engage');

    banner.innerHTML =
      '<div class="zig-brawl-side">' +
        '<div class="zig-brawl-row"><span>' + escapeHtml(youName) + '</span><bdi class="zig-brawl-you-pct">' + youPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div class="zig-brawl-fill-you" style="width:' + youPct + '%"></div></div>' +
      '</div>' +
      '<div class="zig-brawl-center">' +
        '<div class="zig-brawl-vs">' + (ar ? 'ضد' : 'VS') + '</div>' +
        '<div class="zig-brawl-status">' + escapeHtml(statusTxt) + '</div>' +
      '</div>' +
      '<div class="zig-brawl-side">' +
        '<div class="zig-brawl-row"><span>' + escapeHtml(oppName) + '</span><bdi class="zig-brawl-opp-pct">' + oppPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div class="zig-brawl-fill-opp" style="width:' + oppPct + '%"></div></div>' +
      '</div>';

    /* Keep #zone-combat-frame nameplate synchronized with live catalog opponent (prevents stale Rayan_Black fallback) */
    var applyCombatDomName = function (expectedName) {
      try {
        var doc = frame.contentDocument;
        if (doc && expectedName) {
          var opEl = doc.getElementById('combat-opponent-name');
          if (opEl && opEl.textContent !== expectedName) {
            opEl.textContent = expectedName;
          }
        }
      } catch (_) {}
    };
    try {
      var g = window.__zoneGame;
      var sig = (f ? 'fight:' : 'idle:') + oppName + '|' + (ar ? 'ar' : 'en');
      if (!f && g && typeof g.pushCombatScene === 'function' && g._zigCombatOppSig !== sig) {
        g._zigCombatOppSig = sig;
        g._combatSceneSig = '';
        g.pushCombatScene();
        setTimeout(function () { applyCombatDomName(oppName); }, 60);
      }
      applyCombatDomName(oppName);
    } catch (_) {}
    if (!frame.__zigOppLoadBound) {
      frame.__zigOppLoadBound = true;
      frame.addEventListener('load', function () {
        setTimeout(mountAttackBanner, 80);
        setTimeout(mountAttackBanner, 360);
      });
    }
  }

  /* ---------------- Keyboard Controls (Named Actions + 80ms Buffer Routing) ---------------- */
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;

    var main = document.getElementById('zone-main');
    var scr = main ? main.getAttribute('data-zone-screen') : '';
    var interactiveFocus = e.target && e.target.closest ? Boolean(e.target.closest('button, a, [role="button"]')) : false;
    state.lastDevice = 'keyboard';

    if ((scr === 'home' || scr === 'casino') && state.getaway.open) {
      var mode = state.arcadeMode || 'getaway';
      if (mode === 'getaway') {
        if (!state.getaway.running || state.getaway.gameOver) {
          if ((e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !interactiveFocus) {
            e.preventDefault();
            startGetawayRun('getaway');
          }
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          state.inputBuffer.press('steer_left', state.clockSec, { delta: -1 });
          applyBufferedDriftControls();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          state.inputBuffer.press('steer_right', state.clockSec, { delta: 1 });
          applyBufferedDriftControls();
        } else if (e.key === ' ' && !interactiveFocus) {
          e.preventDefault();
          state.getaway.boosting = true;
        }
      } else if (mode === 'jet') {
        if (!state.jet.running || state.jet.gameOver) {
          if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !interactiveFocus) {
            e.preventDefault();
            startGetawayRun('jet');
          }
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          state.inputBuffer.press('climb_up', state.clockSec, { step: -0.17 });
          applyBufferedJetControls();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          state.inputBuffer.press('dive_down', state.clockSec, { step: 0.17 });
          applyBufferedJetControls();
        }
      } else if (mode === 'heist' && e.key === ' ' && !interactiveFocus) {
        e.preventDefault();
        requestHeistAction('keyboard');
      } else if (mode === 'gym' && e.key === ' ' && !interactiveFocus) {
        e.preventDefault();
        requestGymAction('keyboard');
      }
    } else if (scr === 'crimes' && e.key === ' ' && !interactiveFocus) {
      if (document.getElementById('zig-heist-canvas')) {
        e.preventDefault();
        requestHeistAction('keyboard');
      }
    } else if (scr === 'gym' && e.key === ' ' && !interactiveFocus) {
      if (document.getElementById('zig-gym-canvas')) {
        e.preventDefault();
        requestGymAction('keyboard');
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === ' ') state.getaway.boosting = false;
  });

  /* ---------------- Transparent Atmospheric Shader Previews (1 Static Frame at Rest, Animate Hovered Card Only!) ---------------- */
  function advancePreviewParticles(dt) {
    var pfx = state.previewFX;
    for (var i = 0; i < pfx.rain.length; i++) {
      var rn = pfx.rain[i];
      rn.y += rn.spd * dt * 1.45;
      rn.x -= rn.spd * dt * 0.28;
      if (rn.y > 1.08) { rn.y = -0.08; rn.x = Math.random() * 1.15; }
    }
    for (var j = 0; j < pfx.embers.length; j++) {
      var em = pfx.embers[j];
      em.y -= em.spd * dt;
      em.x += em.drift * dt;
      if (em.y < -0.06) { em.y = 1.06; em.x = 0.15 + Math.random() * 0.7; }
      var mt = pfx.motes[j];
      mt.y -= mt.spd * dt;
      if (mt.y < -0.05) { mt.y = 1.05; mt.x = Math.random(); }
      var bk = pfx.bokeh[j];
      bk.y -= bk.spd * dt;
      if (bk.y < -0.08) { bk.y = 1.08; bk.x = Math.random(); }
      var ck = pfx.chalk[j];
      ck.y -= ck.spd * dt;
      ck.x += ck.drift * dt;
      if (ck.y < -0.06) { ck.y = 1.06; ck.x = 0.15 + Math.random() * 0.7; }
    }
  }

  /* Shared Offscreen Atmospheric Preview Compositor -> Blitted to 2D .zig-card-shader Canvases
   * Preserves .zig-card-shader class & 60fps hover FX while freeing WebGL contexts for #zone-char-3d & ZoneEcs3D! */
  var sharedPreviewSurface = null;
  function ensureSharedPreviewSurface(pw, ph, dpr) {
    if (!sharedPreviewSurface && typeof document !== 'undefined' && document.createElement) {
      sharedPreviewSurface = document.createElement('canvas');
    }
    if (!sharedPreviewSurface) return null;
    if (sharedPreviewSurface.width !== pw || sharedPreviewSurface.height !== ph) {
      sharedPreviewSurface.width = pw;
      sharedPreviewSurface.height = ph;
    }
    var offCtx = sharedPreviewSurface.getContext('2d');
    if (!offCtx) return null;
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: sharedPreviewSurface, ctx: offCtx };
  }

  function paintSinglePreviewCanvas(cv, now) {
    if (!cv) return;
    cv.setAttribute('data-zig-ctx', '2d-shared-blit');
    var pfx = state.previewFX;
    var pal = getSketchPalette();
    var kind = cv.getAttribute('data-zig-preview');
    var rect = cv.getBoundingClientRect();
    var rawH = cv.clientHeight || (cv.parentElement && cv.parentElement.clientHeight) || rect.height || 92;
    var targetH = Math.max(68, Math.round(rawH));
    var dst = syncCanvas(cv, targetH);
    if (!dst) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var shared = ensureSharedPreviewSurface(cv.width, cv.height, dpr);
    var ctx = shared ? shared.ctx : dst.ctx;
    var w = dst.w, h = dst.h;

    ctx.clearRect(0, 0, w, h);

    if (kind === 'getaway') {
      var sirenPhase = Math.sin(now * 0.0085);
      var redAlpha = Math.max(0.05, sirenPhase * 0.18);
      var blueAlpha = Math.max(0.05, -sirenPhase * 0.18);
      var rg = ctx.createRadialGradient(w * 0.18, h * 0.78, 4, w * 0.18, h * 0.78, w * 0.52);
      rg.addColorStop(0, 'rgba(184, 61, 40, ' + redAlpha.toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(184, 61, 40, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      var bg = ctx.createRadialGradient(w * 0.82, h * 0.76, 4, w * 0.82, h * 0.76, w * 0.52);
      bg.addColorStop(0, 'rgba(63, 111, 158, ' + blueAlpha.toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(63, 111, 158, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = pal.rainStroke;
      ctx.lineWidth = 1;
      for (var rIdx = 0; rIdx < pfx.rain.length; rIdx++) {
        var rDrop = pfx.rain[rIdx];
        var rx = rDrop.x * w, ry = rDrop.y * h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4.5, ry + rDrop.len);
        ctx.stroke();
      }

      for (var eIdx = 0; eIdx < pfx.embers.length; eIdx++) {
        var emb = pfx.embers[eIdx];
        ctx.fillStyle = (eIdx % 3 === 0) ? 'rgba(217, 164, 65, 0.74)' : 'rgba(109, 153, 73, 0.78)';
        ctx.beginPath();
        ctx.arc(emb.x * w, emb.y * h, emb.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'heist') {
      var scanY = (0.18 + (Math.sin(now * 0.0022) * 0.5 + 0.5) * 0.64) * h;
      var laserGrad = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12);
      laserGrad.addColorStop(0, 'rgba(109, 153, 73, 0)');
      laserGrad.addColorStop(0.5, 'rgba(109, 153, 73, 0.22)');
      laserGrad.addColorStop(1, 'rgba(109, 153, 73, 0)');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, scanY - 12, w, 24);

      ctx.strokeStyle = pal.sageBright;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();

      for (var mIdx = 0; mIdx < pfx.motes.length; mIdx++) {
        var mt2 = pfx.motes[mIdx];
        var tw = 0.30 + 0.44 * (0.5 + 0.5 * Math.sin(now * 0.003 + mt2.phase));
        ctx.fillStyle = 'rgba(217, 164, 65, ' + tw.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc((mt2.x + Math.sin(now * 0.0012 + mt2.phase) * 0.03) * w, mt2.y * h, mt2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'casino') {
      var sweepX = ((now * 0.00028) % 1.6 - 0.3) * w;
      var sheen = ctx.createLinearGradient(sweepX - 42, 0, sweepX + 42, h);
      sheen.addColorStop(0, 'rgba(217, 164, 65, 0)');
      sheen.addColorStop(0.5, 'rgba(240, 196, 101, 0.16)');
      sheen.addColorStop(1, 'rgba(217, 164, 65, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      for (var bIdx = 0; bIdx < pfx.bokeh.length; bIdx++) {
        var bk2 = pfx.bokeh[bIdx];
        var alphaB = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(now * 0.0026 + bk2.phase));
        var bx = bk2.x * w, by = bk2.y * h;
        var bGrad = ctx.createRadialGradient(bx, by, 0.5, bx, by, bk2.r);
        bGrad.addColorStop(0, 'rgba(240, 196, 101, ' + (alphaB * 1.4).toFixed(3) + ')');
        bGrad.addColorStop(1, 'rgba(217, 164, 65, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bx, by, bk2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'gym') {
      var spotPulse = 0.14 + 0.08 * Math.sin(now * 0.0024);
      var spot = ctx.createRadialGradient(w * 0.5, -8, 6, w * 0.5, h * 0.25, w * 0.65);
      spot.addColorStop(0, 'rgba(248, 243, 230, ' + spotPulse.toFixed(3) + ')');
      spot.addColorStop(1, 'rgba(248, 243, 230, 0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);

      for (var cIdx = 0; cIdx < pfx.chalk.length; cIdx++) {
        var ck2 = pfx.chalk[cIdx];
        ctx.fillStyle = (cIdx % 4 === 0) ? 'rgba(217, 164, 65, 0.42)' : 'rgba(243, 236, 220, 0.38)';
        ctx.beginPath();
        ctx.arc(ck2.x * w, ck2.y * h, ck2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (shared && shared.canvas && dst.ctx !== ctx) {
      dst.ctx.setTransform(1, 0, 0, 1, 0, 0);
      dst.ctx.clearRect(0, 0, cv.width, cv.height);
      dst.ctx.drawImage(shared.canvas, 0, 0, cv.width, cv.height);
      dst.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function renderStaticHomePreviews() {
    var previews = document.querySelectorAll('canvas[data-zig-preview]');
    if (!previews.length) return;
    var snapNow = 1480;
    previews.forEach(function (cv) {
      paintSinglePreviewCanvas(cv, snapNow);
    });
  }

  function renderHoveredHomePreview(dt, now) {
    if (!state.hoveredPreviewId) return;
    var activeCv = document.querySelector('canvas[data-zig-preview="' + state.hoveredPreviewId + '"]');
    if (!activeCv) {
      state.hoveredPreviewId = null;
      return;
    }
    advancePreviewParticles(dt);
    paintSinglePreviewCanvas(activeCv, now);
  }

  function pushCameraShakeTransform(ctx, w, h) {
    ctx.save();
    if (!isReducedMotion() && (Math.abs(state.juice.offsetX) > 0.01 || Math.abs(state.juice.offsetY) > 0.01 || Math.abs(state.juice.rotation) > 0.0002)) {
      ctx.translate(w * 0.5 + state.juice.offsetX, h * 0.5 + state.juice.offsetY);
      ctx.rotate(state.juice.rotation);
      ctx.translate(-w * 0.5, -h * 0.5);
    }
  }

  function drawFeverHudBadge(ctx, x, y, comboCount, ar, pal) {
    var fever = getFeverTier(comboCount, ar);
    if (fever.tier <= 0) return;
    ctx.save();
    ctx.font = fontStack(900, 10.5);
    var txt = fever.label;
    var padX = 8;
    var bw = Math.min(168, Math.max(66, Math.ceil(ctx.measureText(txt).width) + padX * 2));
    var bh = 19;
    var bx = clampNum(x - bw * 0.5, 8, Math.max(8, (ctx.canvas ? (ctx.canvas.clientWidth || 320) : 320) - bw - 8));
    ctx.fillStyle = fever.tier >= 2 ? pal.goldFill : pal.hudBg;
    ctx.strokeStyle = '#23201c';
    ctx.lineWidth = 1.4;
    ctx.fillRect(bx, y, bw, bh);
    ctx.strokeRect(bx, y, bw, bh);
    ctx.fillStyle = fever.tier >= 2 ? '#1e1b18' : pal.sageBright;
    ctx.textAlign = 'center';
    ctx.fillText(txt, bx + bw * 0.5, y + 13.5, bw - 6);
    ctx.restore();
  }

  function renderGetawayGame(dt, now, realDt) {
    var cv = document.getElementById('zig-getaway-canvas');
    if (!cv || !state.getaway.open) return;
    var compact = isCompactMobile();
    var s = syncCanvas(cv, compact ? 168 : 220);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gw = state.getaway;
    var ar = isAr();
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;
    var pal = getSketchPalette();
    var reduced = isReducedMotion();

    var roadW = Math.min(w * (compact ? 0.88 : 0.74), 380);
    var roadLeft = (w - roadW) * 0.5;
    var laneW = roadW / 4;

    if (gw.running && !gw.gameOver) {
      applyBufferedDriftControls();
      var mult = gw.boosting && gw.nitro > 0 ? 1.55 : 1;
      if (gw.boosting && gw.nitro > 0) gw.nitro = Math.max(0, gw.nitro - dt * 42);
      else gw.nitro = Math.min(100, gw.nitro + dt * 14);

      var fever = getFeverTier(gw.combo, ar);
      var curSpeed = gw.speed * mult;
      gw.speed = Math.min(460, gw.speed + dt * 7.5);
      gw.score += Math.round(dt * curSpeed * 0.25 * fever.mult);
      /* Frame-rate-independent exponential smoothing (camera-systems Pattern 2) */
      gw.lane = expSmooth(gw.lane, gw.targetLane, 14, dt);

      gw.spawnTimer -= dt;
      if (gw.spawnTimer <= 0) {
        gw.spawnTimer = Math.max(0.34, 0.72 - (gw.speed - 270) * 0.0012);
        var spawnLane = Math.floor(Math.random() * 4);
        var isLoot = Math.random() < 0.36;
        gw.entities.push({
          lane: spawnLane,
          y: -36,
          kind: isLoot ? 'cash' : 'police',
          grazed: false,
          spd: isLoot ? curSpeed * 0.78 : curSpeed * 0.92
        });
      }

      var playerX = roadLeft + (gw.lane + 0.5) * laneW;
      var playerY = h - (compact ? 36 : 42);

      for (var i = gw.entities.length - 1; i >= 0; i--) {
        var ent = gw.entities[i];
        ent.y += (curSpeed * 0.85) * dt;
        var ex = roadLeft + (ent.lane + 0.5) * laneW;

        if (Math.abs(ex - playerX) < laneW * 0.52 && Math.abs(ent.y - playerY) < 28) {
          if (ent.kind === 'cash') {
            gw.bags += 1;
            gw.combo = Math.min(12, gw.combo + 1);
            var pickupFever = getFeverTier(gw.combo, ar);
            var tierUp = pickupFever.tier > gw.feverTier;
            gw.feverTier = pickupFever.tier;
            var bagBonus = 250 * pickupFever.mult;
            gw.score += bagBonus;
            if (tierUp && pickupFever.tier >= 1) {
              sfx.fever(pickupFever.tier);
              state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_CRIT_MS, now, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
            } else {
              sfx.pickup();
            }
            state.juice.addTrauma(tierUp ? 0.32 : 0.16, 0, -1, reduced);
            state.fxPool.spawnFeverBurst(ex, ent.y, pickupFever);
            state.fxPool.spawnPopup(ex, ent.y - 10, '+$' + bagBonus + (tierUp ? (' ' + pickupFever.label) : ''), 'gold', 11.5);
            notifySafehouseArcadeWin('getaway', { bags: gw.bags, combo: gw.combo, score: gw.score, feverCode: pickupFever.code });
            for (var p = 0; p < 10; p++) {
              if (gw.particles.length >= 44) break;
              gw.particles.push({
                x: ex, y: ent.y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                life: 0.45,
                tone: 'good'
              });
            }
            gw.entities.splice(i, 1);
            continue;
          } else {
            gw.gameOver = true;
            gw.running = false;
            gw.boosting = false;
            gw.best = Math.max(gw.best, gw.score);
            state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_CRIT_MS, now, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
            state.juice.addTrauma(0.76, playerX >= ex ? 1 : -1, 0.6, reduced);
            sfx.crash();
            emitArcadeBridge('getaway', 'step_fail', 1, { crash: true, score: gw.score });
            for (var c = 0; c < 20; c++) {
              if (gw.particles.length >= 52) break;
              gw.particles.push({
                x: playerX, y: playerY,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220,
                life: 0.65,
                tone: c % 2 ? 'bad' : 'gold'
              });
            }
          }
        } else {
          /* Near-Miss Graze Bonus (+GRAZE!) passing within tight lane proximity of pursuit cruisers */
          var grazeHit = checkDriftGraze(ent, roadLeft, laneW, playerX, playerY);
          if (grazeHit) {
            gw.grazes += 1;
            gw.combo = Math.min(12, gw.combo + 1);
            var gzFever = getFeverTier(gw.combo, ar);
            gw.feverTier = gzFever.tier;
            var gzPoints = 120 * gzFever.mult;
            gw.score += gzPoints;
            gw.nitro = Math.min(100, gw.nitro + 10);
            sfx.graze();
            state.juice.addTrauma(0.20, grazeHit.dirX, 0, reduced);
            state.fxPool.spawnRing(playerX, playerY, 12, 46, 'gold', 2.4);
            state.fxPool.spawnPopup(playerX, playerY - 18, dict.graze + ' +' + gzPoints, 'gold', 11.5);
            emitArcadeBridge('getaway', 'cash_payout', gw.combo, { graze: true, grazes: gw.grazes, score: gw.score });
          }
        }
        if (ent.y > h + 50) gw.entities.splice(i, 1);
      }
    }

    pushCameraShakeTransform(ctx, w, h);

    /* Sketchbook Gouache City Shoulders + Inked Highway */
    var shoulderGrad = ctx.createLinearGradient(0, 0, 0, h);
    shoulderGrad.addColorStop(0, pal.shoulderTop);
    shoulderGrad.addColorStop(1, pal.shoulderBot);
    ctx.fillStyle = shoulderGrad;
    ctx.fillRect(0, 0, w, h);

    var scrollPx = (now * (gw.running && !gw.gameOver ? gw.speed * 0.65 : 95) * 0.001) * 60;
    if (roadLeft > 22) {
      for (var sb = -1; sb < 5; sb++) {
        var by = ((sb * 68 + scrollPx * 2.2) % (h + 80)) - 68;
        var bwL = Math.max(14, roadLeft - 20);
        ctx.fillStyle = pal.bldgFill;
        ctx.strokeStyle = pal.bldgStroke;
        ctx.lineWidth = 1;
        ctx.fillRect(5, by, bwL, 54);
        ctx.strokeRect(5, by, bwL, 54);
        ctx.fillRect(roadLeft + roadW + 15, by + 18, bwL, 50);
        ctx.strokeRect(roadLeft + roadW + 15, by + 18, bwL, 50);
        ctx.fillStyle = (sb % 2 === 0) ? pal.bldgWinA : pal.bldgWinB;
        for (var wx = 11; wx < bwL - 6; wx += 14) {
          ctx.fillRect(wx, by + 10, 6, 8);
          ctx.fillRect(wx, by + 28, 6, 8);
          ctx.fillRect(roadLeft + roadW + 13 + wx, by + 28, 6, 8);
        }
      }
    }

    /* Highway Deck */
    var asphalt = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadW, 0);
    asphalt.addColorStop(0, pal.roadEdge);
    asphalt.addColorStop(0.22, pal.roadMid);
    asphalt.addColorStop(0.5, pal.roadCenter);
    asphalt.addColorStop(0.78, pal.roadMid);
    asphalt.addColorStop(1, pal.roadEdge);
    ctx.fillStyle = asphalt;
    ctx.fillRect(roadLeft, 0, roadW, h);

    /* Passing Ochre Streetlamps */
    for (var lp = -1; lp < 5; lp++) {
      var lampY = ((lp * 74 + scrollPx * 4.4) % (h + 74)) - 37;
      var lPoolL = ctx.createRadialGradient(roadLeft - 6, lampY, 2, roadLeft - 6, lampY, 30);
      lPoolL.addColorStop(0, 'rgba(217, 164, 65, 0.28)');
      lPoolL.addColorStop(1, 'rgba(217, 164, 65, 0)');
      ctx.fillStyle = lPoolL;
      ctx.beginPath(); ctx.arc(roadLeft - 6, lampY, 30, 0, Math.PI * 2); ctx.fill();

      var lPoolR = ctx.createRadialGradient(roadLeft + roadW + 6, lampY, 2, roadLeft + roadW + 6, lampY, 30);
      lPoolR.addColorStop(0, 'rgba(217, 164, 65, 0.28)');
      lPoolR.addColorStop(1, 'rgba(217, 164, 65, 0)');
      ctx.fillStyle = lPoolR;
      ctx.beginPath(); ctx.arc(roadLeft + roadW + 6, lampY, 30, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = pal.goldFill;
      ctx.fillRect(roadLeft - 8, lampY - 2, 4, 4);
      ctx.fillRect(roadLeft + roadW + 4, lampY - 2, 4, 4);
    }

    /* Curb Rumble Strips + Ochre Guardrails */
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, h);
    ctx.moveTo(roadLeft + roadW, 0); ctx.lineTo(roadLeft + roadW, h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(184, 61, 40, 0.52)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -(scrollPx * 4.4) % 24;
    ctx.beginPath();
    ctx.moveTo(roadLeft + 3, 0); ctx.lineTo(roadLeft + 3, h);
    ctx.moveTo(roadLeft + roadW - 3, 0); ctx.lineTo(roadLeft + roadW - 3, h);
    ctx.stroke();

    /* Lane Markers */
    ctx.strokeStyle = pal.laneDash;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    ctx.lineDashOffset = -(scrollPx * 4.4) % 32;
    for (var l = 1; l <= 3; l++) {
      ctx.beginPath();
      ctx.moveTo(roadLeft + laneW * l, 0);
      ctx.lineTo(roadLeft + laneW * l, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* Entities: Cash Briefcases & Police Interceptors */
    gw.entities.forEach(function (ent) {
      var ex = roadLeft + (ent.lane + 0.5) * laneW;
      if (ent.kind === 'cash') {
        var glow = ctx.createRadialGradient(ex, ent.y, 2, ex, ent.y, 20);
        glow.addColorStop(0, 'rgba(109, 153, 73, 0.34)');
        glow.addColorStop(1, 'rgba(109, 153, 73, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(ex, ent.y, 20, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = pal.goldFill;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(ex - 5, ent.y - 13, 10, 4);
        ctx.fillStyle = pal.cashFill;
        ctx.strokeStyle = pal.cashStroke;
        ctx.fillRect(ex - 13, ent.y - 9, 26, 18);
        ctx.strokeRect(ex - 13, ent.y - 9, 26, 18);
        ctx.fillStyle = pal.cashText;
        ctx.font = fontStack(900, 11.5);
        ctx.textAlign = 'center';
        ctx.fillText('$', ex, ent.y + 4);
      } else {
        var flashRed = Math.floor(now / 110) % 2 === 0;
        var siren = ctx.createRadialGradient(ex, ent.y, 4, ex, ent.y, 30);
        siren.addColorStop(0, flashRed ? 'rgba(184, 61, 40, 0.30)' : 'rgba(63, 111, 158, 0.30)');
        siren.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = siren;
        ctx.beginPath(); ctx.arc(ex, ent.y, 30, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(248, 243, 230, 0.22)';
        ctx.beginPath();
        ctx.moveTo(ex - 9, ent.y + 18); ctx.lineTo(ex - 16, ent.y + 38); ctx.lineTo(ex - 2, ent.y + 38);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ex + 9, ent.y + 18); ctx.lineTo(ex + 2, ent.y + 38); ctx.lineTo(ex + 16, ent.y + 38);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = pal.policeBody;
        ctx.strokeStyle = pal.policeTrim;
        ctx.lineWidth = 1.5;
        ctx.fillRect(ex - 13, ent.y - 19, 26, 38);
        ctx.strokeRect(ex - 13, ent.y - 19, 26, 38);
        ctx.fillStyle = pal.policeRoof;
        ctx.fillRect(ex - 11, ent.y - 7, 22, 14);
        ctx.fillStyle = '#23201c';
        ctx.fillRect(ex - 9, ent.y + 5, 18, 7);
        ctx.fillRect(ex - 9, ent.y - 14, 18, 5);
        ctx.fillStyle = flashRed ? '#b83d28' : '#3f6f9e';
        ctx.fillRect(ex - 10, ent.y - 3, 10, 4.5);
        ctx.fillStyle = flashRed ? '#3f6f9e' : '#b83d28';
        ctx.fillRect(ex, ent.y - 3, 10, 4.5);
      }
    });

    /* Player Inked Gouache GT Coupe */
    var px = roadLeft + (gw.lane + 0.5) * laneW;
    var py = h - (compact ? 38 : 44);
    var tilt = (gw.targetLane - gw.lane) * 0.14;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);

    var beamL = ctx.createLinearGradient(0, -20, 0, -72);
    beamL.addColorStop(0, 'rgba(240, 196, 101, 0.30)');
    beamL.addColorStop(1, 'rgba(240, 196, 101, 0)');
    ctx.fillStyle = beamL;
    ctx.beginPath();
    ctx.moveTo(-10, -20); ctx.lineTo(-22, -72); ctx.lineTo(-2, -72);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -20); ctx.lineTo(2, -72); ctx.lineTo(22, -72);
    ctx.closePath(); ctx.fill();

    var flameLen = (gw.boosting && gw.nitro > 0) ? (14 + Math.sin(now * 0.05) * 5) : (6 + Math.sin(now * 0.03) * 2);
    ctx.fillStyle = (gw.boosting && gw.nitro > 0) ? pal.blue : pal.goldFill;
    ctx.beginPath();
    ctx.moveTo(-8, 20); ctx.lineTo(-5.5, 20 + flameLen); ctx.lineTo(-3, 20);
    ctx.moveTo(3, 20); ctx.lineTo(5.5, 20 + flameLen); ctx.lineTo(8, 20);
    ctx.fill();

    var carGrad = ctx.createLinearGradient(-13, -20, 13, 20);
    carGrad.addColorStop(0, '#4f7736');
    carGrad.addColorStop(0.5, '#6d9949');
    carGrad.addColorStop(1, '#3b5c28');
    ctx.fillStyle = carGrad;
    ctx.strokeStyle = '#23201c';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-13, -20, 26, 40);
    ctx.strokeRect(-13, -20, 26, 40);

    ctx.fillStyle = '#23201c';
    ctx.fillRect(-15, -15, 2.5, 9);
    ctx.fillRect(12.5, -15, 2.5, 9);
    ctx.fillRect(-15, 7, 2.5, 9);
    ctx.fillRect(12.5, 7, 2.5, 9);

    ctx.fillStyle = pal.goldFill;
    ctx.fillRect(-2, -20, 4, 40);
    ctx.fillStyle = '#2a2621';
    ctx.fillRect(-9, -9, 18, 14);
    ctx.fillStyle = 'rgba(248, 243, 230, 0.34)';
    ctx.fillRect(-8, -8, 16, 4.5);

    ctx.fillStyle = '#f8f3e6';
    ctx.fillRect(-11, -20, 6, 3);
    ctx.fillRect(5, -20, 6, 3);
    ctx.fillStyle = '#b83d28';
    ctx.fillRect(-11, 17, 22, 3);
    ctx.restore();

    /* Particles */
    for (var pi = gw.particles.length - 1; pi >= 0; pi--) {
      var pt = gw.particles[pi];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) { gw.particles.splice(pi, 1); continue; }
      ctx.fillStyle = pt.tone ? toneColorFromPalette(pt.tone, pal) : (pt.color || pal.gold);
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Pooled Watercolor Ink Rings & Floating Popups */
    state.fxPool.renderAndStep(ctx, w, h, realDt != null ? realDt : dt, pal);
    ctx.restore();

    /* Sketchbook Paper-Chip HUD Overlays (Compact Full-Width Strip on <=390px Mobile, Dual Cards on >390px) */
    var mph = Math.round((gw.running && !gw.gameOver ? gw.speed : 0) * (gw.boosting ? 0.62 : 0.44));
    if (w <= 390) {
      ctx.fillStyle = pal.hudBg;
      ctx.fillRect(8, 8, w - 16, 34);
      ctx.strokeStyle = pal.hudStroke;
      ctx.lineWidth = 1.25;
      ctx.strokeRect(8, 8, w - 16, 34);

      ctx.font = fontStack(800, 10.5);
      ctx.textAlign = ar ? 'right' : 'left';
      ctx.fillStyle = pal.gold;
      var scoreTxt = (ar ? 'النقاط: ' : 'SCORE: ') + gw.score + ' · ' + (ar ? 'حقائب: ' : 'BAGS: ') + gw.bags + ' (' + getFeverTier(gw.combo, ar).label + ')';
      ctx.fillText(scoreTxt, ar ? (w - 14) : 14, 22, Math.max(120, w - 108));

      ctx.textAlign = ar ? 'left' : 'right';
      ctx.fillStyle = pal.ink;
      ctx.fillText(mph + (ar ? ' كم/س' : ' MPH'), ar ? 14 : (w - 14), 22);

      ctx.fillStyle = pal.well;
      ctx.fillRect(14, 30, w - 28, 6);
      ctx.fillStyle = gw.boosting ? pal.blue : pal.sage;
      ctx.fillRect(14, 30, Math.round((w - 28) * (gw.nitro / 100)), 6);
      drawFeverHudBadge(ctx, w * 0.5, 45, gw.combo, ar, pal);
    } else {
      ctx.fillStyle = pal.hudBg;
      ctx.fillRect(10, 10, 174, 52);
      ctx.strokeStyle = pal.hudStroke;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(10, 10, 174, 52);
      ctx.textAlign = ar ? 'right' : 'left';
      ctx.fillStyle = pal.gold;
      ctx.font = fontStack(800, 11);
      ctx.fillText((ar ? 'النقاط: ' : 'SCORE: ') + gw.score, ar ? 176 : 18, 28, 158);
      ctx.fillStyle = pal.sageBright;
      ctx.fillText((ar ? 'حقائب: ' : 'LOOT BAGS: ') + gw.bags + '  (' + getFeverTier(gw.combo, ar).label + ')', ar ? 176 : 18, 46, 158);

      ctx.fillStyle = pal.hudBg;
      ctx.fillRect(w - 146, 10, 136, 52);
      ctx.strokeStyle = pal.hudStroke;
      ctx.strokeRect(w - 146, 10, 136, 52);
      ctx.textAlign = 'right';
      ctx.fillStyle = pal.ink;
      ctx.font = fontStack(900, 12);
      ctx.fillText(mph + (ar ? ' كم/س' : ' MPH'), w - 18, 28);
      ctx.fillStyle = pal.well;
      ctx.fillRect(w - 136, 38, 118, 8);
      ctx.fillStyle = gw.boosting ? pal.blue : pal.sage;
      ctx.fillRect(w - 136, 38, Math.round(1.18 * gw.nitro), 8);
      drawFeverHudBadge(ctx, w * 0.5, 12, gw.combo, ar, pal);
    }

    if (gw.gameOver || !gw.running) {
      ctx.fillStyle = pal.overlayBg;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = gw.gameOver ? pal.crimson : pal.gold;
      ctx.font = fontStack(900, compact ? 16.5 : 19);
      ctx.fillText(
        gw.gameOver
          ? (ar ? 'طوّقتك الدوريات' : 'ROADBLOCK IMPACT')
          : (ar ? 'مطاردة النيترو الميدانية' : 'NITRO SYNDICATE GETAWAY'),
        w * 0.5,
        h * 0.44,
        Math.max(150, w - 28)
      );
      ctx.fillStyle = pal.ink;
      ctx.font = fontStack(700, compact ? 11.5 : 12);
      ctx.fillText(
        gw.gameOver
          ? (ar ? 'النتيجة: ' + gw.score + ' · الحقائب: ' + gw.bags + ' · المس للانطلاق مجدداً' : 'Score: ' + gw.score + ' · Bags: ' + gw.bags + ' · Tap canvas to ride again')
          : (ar ? 'المس أي مسار للانطلاق ومراوغة الدوريات' : 'Tap any lane or press Arrow Keys to launch'),
        w * 0.5,
        h * 0.60,
        Math.max(150, w - 28)
      );
    }
  }

  function drawVectorReticle(ctx, cx, cy, r, color, dotColor) {
    ctx.save();
    ctx.strokeStyle = color || '#d99a38';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r - 2.5, cy); ctx.lineTo(cx - r * 0.45, cy);
    ctx.moveTo(cx + r * 0.45, cy); ctx.lineTo(cx + r + 2.5, cy);
    ctx.moveTo(cx, cy - r - 2.5); ctx.lineTo(cx, cy - r * 0.45);
    ctx.moveTo(cx, cy + r * 0.45); ctx.lineTo(cx, cy + r + 2.5);
    ctx.stroke();
    ctx.fillStyle = dotColor || '#4f7736';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function renderSmugglerJetGame(dt, now, cv, realDt) {
    var targetCv = cv || document.getElementById('zig-getaway-canvas');
    if (!targetCv) return;
    var compact = isCompactMobile();
    var s = syncCanvas(targetCv, compact ? 164 : 214);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var jt = state.jet;
    var ar = isAr();
    var dict = ar ? ARCADE_I18N.ar : ARCADE_I18N.en;
    var pal = getSketchPalette();
    var reduced = isReducedMotion();

    if (jt.running && !jt.gameOver) {
      applyBufferedJetControls();
      var fever = getFeverTier(jt.combo, ar);
      jt.speed = Math.min(420, jt.speed + dt * 7);
      jt.score += Math.round(dt * jt.speed * 0.22 * fever.mult);
      /* Frame-rate-independent exponential smoothing (camera-systems Pattern 2) */
      jt.alt = expSmooth(jt.alt, jt.targetAlt, 11, dt);
      jt.spawnTimer -= dt;
      if (jt.spawnTimer <= 0) {
        jt.spawnTimer = Math.max(0.36, 0.78 - (jt.speed - 250) * 0.0012);
        var isCrate = Math.random() < 0.42;
        jt.entities.push({
          x: w + 34,
          yFrac: 0.18 + Math.random() * 0.64,
          kind: isCrate ? 'crate' : 'radar',
          grazed: false,
          spd: jt.speed * (isCrate ? 0.84 : 0.96)
        });
      }

      var planeX = compact ? 64 : 88;
      var planeY = jt.alt * h;
      for (var i = jt.entities.length - 1; i >= 0; i--) {
        var ent = jt.entities[i];
        ent.x -= ent.spd * dt;
        var ey = ent.yFrac * h;
        if (Math.abs(ent.x - planeX) < 26 && Math.abs(ey - planeY) < 22) {
          if (ent.kind === 'crate') {
            jt.crates += 1;
            jt.combo = Math.min(12, jt.combo + 1);
            var crateFever = getFeverTier(jt.combo, ar);
            var tierUp = crateFever.tier > jt.feverTier;
            jt.feverTier = crateFever.tier;
            var cratePts = 300 * crateFever.mult;
            jt.score += cratePts;
            if (tierUp && crateFever.tier >= 1) {
              sfx.fever(crateFever.tier);
              state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_CRIT_MS, now, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
            } else {
              sfx.pickup();
            }
            state.juice.addTrauma(tierUp ? 0.30 : 0.14, 0.6, 0, reduced);
            state.fxPool.spawnFeverBurst(ent.x, ey, crateFever);
            state.fxPool.spawnPopup(ent.x, ey - 12, '+' + cratePts + (tierUp ? (' ' + crateFever.label) : ''), 'gold', 11.5);
            notifySafehouseArcadeWin('jet', { crates: jt.crates, combo: jt.combo, score: jt.score, feverCode: crateFever.code });
            for (var p = 0; p < 10; p++) {
              if (jt.particles.length >= 44) break;
              jt.particles.push({
                x: ent.x, y: ey,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                life: 0.45,
                tone: 'gold'
              });
            }
            jt.entities.splice(i, 1);
            continue;
          } else {
            jt.gameOver = true;
            jt.running = false;
            state.juice.triggerHitStop(ARCADE_CONSTANTS.HITSTOP_CRIT_MS, now, ARCADE_CONSTANTS.HITSTOP_SLOW_SCALE, reduced);
            state.juice.addTrauma(0.72, -1, planeY >= ey ? 0.6 : -0.6, reduced);
            sfx.crash();
            emitArcadeBridge('jet', 'stealth_alert', 1, { crash: true, score: jt.score });
            for (var c = 0; c < 18; c++) {
              if (jt.particles.length >= 48) break;
              jt.particles.push({
                x: planeX, y: planeY,
                vx: (Math.random() - 0.5) * 210,
                vy: (Math.random() - 0.5) * 210,
                life: 0.6,
                tone: c % 2 ? 'bad' : 'gold'
              });
            }
          }
        } else {
          /* Near-Miss Graze Bonus (+GRAZE!) skimming radar rings */
          var jetGraze = checkJetGraze(ent, planeX, planeY, h);
          if (jetGraze) {
            jt.grazes += 1;
            jt.combo = Math.min(12, jt.combo + 1);
            var jgFever = getFeverTier(jt.combo, ar);
            jt.feverTier = jgFever.tier;
            var jgPts = 150 * jgFever.mult;
            jt.score += jgPts;
            sfx.graze();
            state.juice.addTrauma(0.18, 0, jetGraze.dirY, reduced);
            state.fxPool.spawnRing(planeX, planeY, 12, 44, 'gold', 2.4);
            state.fxPool.spawnPopup(planeX + 18, planeY - 16, dict.graze + ' +' + jgPts, 'gold', 11.5);
            emitArcadeBridge('jet', 'cash_payout', jt.combo, { graze: true, grazes: jt.grazes, score: jt.score });
          }
        }
        if (ent.x < -44) jt.entities.splice(i, 1);
      }
    }

    pushCameraShakeTransform(ctx, w, h);

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pal.shoulderTop);
    sky.addColorStop(1, pal.paper);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    /* Radar Horizon Grid */
    ctx.strokeStyle = pal.borderSub;
    ctx.lineWidth = 1;
    var scrollX = (now * 0.14) % 44;
    for (var gx = -scrollX; gx < w; gx += 44) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (var gy = 28; gy < h; gy += 36) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    jt.entities.forEach(function (ent) {
      var ey = ent.yFrac * h;
      if (ent.kind === 'crate') {
        ctx.fillStyle = pal.goldFill;
        ctx.strokeStyle = pal.cashStroke;
        ctx.lineWidth = 1.6;
        ctx.fillRect(ent.x - 11, ey - 10, 22, 20);
        ctx.strokeRect(ent.x - 11, ey - 10, 22, 20);
        ctx.fillStyle = '#1e1b18';
        ctx.font = fontStack(900, 11);
        ctx.textAlign = 'center';
        ctx.fillText('★', ent.x, ey + 4);
      } else {
        var pulse = 13 + Math.sin(now * 0.014) * 3;
        ctx.strokeStyle = pal.crimson;
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(ent.x, ey, pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = pal.crimson;
        ctx.beginPath(); ctx.arc(ent.x, ey, 4.5, 0, Math.PI * 2); ctx.fill();
      }
    });

    /* Smuggler Jet Silhouette */
    var jx = compact ? 64 : 88;
    var jy = jt.alt * h;
    var pitch = (jt.targetAlt - jt.alt) * 0.45;
    ctx.save();
    ctx.translate(jx, jy);
    ctx.rotate(pitch);
    ctx.fillStyle = pal.goldFill;
    ctx.beginPath();
    ctx.moveTo(-18, 0); ctx.lineTo(-28 - Math.sin(now * 0.04) * 5, -4); ctx.lineTo(-28 - Math.sin(now * 0.04) * 5, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.blue;
    ctx.strokeStyle = '#23201c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(-4, -13); ctx.lineTo(-15, -4); ctx.lineTo(-15, 4); ctx.lineTo(-4, 13);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    for (var pi = jt.particles.length - 1; pi >= 0; pi--) {
      var pt = jt.particles[pi];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) { jt.particles.splice(pi, 1); continue; }
      ctx.fillStyle = toneColorFromPalette(pt.tone || 'gold', pal);
      ctx.globalAlpha = Math.max(0, pt.life * 1.5);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    state.fxPool.renderAndStep(ctx, w, h, realDt != null ? realDt : dt, pal);
    ctx.restore();

    ctx.fillStyle = pal.hudBg;
    ctx.fillRect(10, 8, Math.min(256, w - 20), 28);
    ctx.strokeStyle = pal.hudStroke;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(10, 8, Math.min(256, w - 20), 28);
    ctx.fillStyle = pal.gold;
    ctx.font = fontStack(800, 11);
    ctx.textAlign = ar ? 'right' : 'left';
    var jetHudX = ar ? (10 + Math.min(256, w - 20) - 8) : 18;
    ctx.fillText((ar ? 'الشحنات: ' : 'AIR DROPS: ') + jt.crates + ' · ' + jt.score + ' (' + getFeverTier(jt.combo, ar).label + ')', jetHudX, 26, Math.min(240, w - 34));
    drawFeverHudBadge(ctx, w - 76, 12, jt.combo, ar, pal);

    if (jt.gameOver || !jt.running) {
      ctx.fillStyle = pal.overlayBg;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = jt.gameOver ? pal.crimson : pal.gold;
      ctx.font = fontStack(900, compact ? 16 : 18);
      ctx.fillText(
        jt.gameOver ? (ar ? 'كشفك الرادار الجوي!' : 'RADAR LOCK INTERCEPT!') : (ar ? 'طائرة التهريب الليلية' : 'SMUGGLER JET RADAR RUN'),
        w * 0.5,
        h * 0.46
      );
      ctx.fillStyle = pal.ink;
      ctx.font = fontStack(700, 12);
      ctx.fillText(
        ar ? 'المس للتحليق مجدداً ومراوغة حلقات الرادار' : 'Tap altitude or press Up/Down Arrows to fly again',
        w * 0.5,
        h * 0.62
      );
    }
  }

  function renderActiveArcadeStage(dt, now, realDt) {
    var gCv = document.getElementById('zig-getaway-canvas');
    if (!gCv || !state.getaway.open) return;
    var mode = state.arcadeMode || 'getaway';
    if (mode === 'heist') {
      renderCrimesGame(dt, now, gCv, realDt);
    } else if (mode === 'gym') {
      renderGymGame(dt, now, gCv, realDt);
    } else if (mode === 'jet') {
      renderSmugglerJetGame(dt, now, gCv, realDt);
    } else {
      renderGetawayGame(dt, now, realDt);
    }
  }

  function renderCrimesGame(dt, now, cvOverride, realDt) {
    var cv = cvOverride || document.getElementById('zig-heist-canvas');
    if (!cv) return;
    var compact = isCompactMobile();
    var s = syncCanvas(cv, compact ? 150 : 212);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var hs = state.heist;
    var ar = isAr();
    var pal = getSketchPalette();

    hs.angle = normalizeAnglePositive(hs.angle + hs.speed * hs.dir * dt);
    var curDiff = Math.atan2(Math.sin(hs.angle - hs.targetCenter), Math.cos(hs.angle - hs.targetCenter));
    var curAbsDiff = Math.abs(curDiff);
    var halfArc = hs.targetArc * 0.5;
    if (curAbsDiff <= halfArc) {
      state.coyote.markLegal('heist_arc', state.clockSec, { perfect: curAbsDiff <= halfArc * 0.38 });
      var bufferedCrack = state.inputBuffer.consume('crack_vault', state.clockSec);
      if (bufferedCrack) {
        triggerHeistStrike({ buffered: true });
      }
    } else if (state.inputBuffer.popExpired('crack_vault', state.clockSec)) {
      triggerHeistStrike({ buffered: false });
    }

    pushCameraShakeTransform(ctx, w, h);

    /* Sketchbook Cold-Press Vault Base + Gouache Safe-Crack Plate */
    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = pal.artAlpha;
    var drewHeistArt = drawCoverArt(ctx, artImages.heist, w, h, 0, 0, 1.04);
    ctx.restore();

    var grad = ctx.createRadialGradient(w * 0.5, h * 0.52, 16, w * 0.5, h * 0.52, w * 0.68);
    grad.addColorStop(0, drewHeistArt ? pal.vaultCenter : pal.vaultFallback);
    grad.addColorStop(1, pal.vaultOuter);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (now < hs.sirenUntil) {
      var redPulse = Math.floor(now / 110) % 2 === 0;
      ctx.fillStyle = redPulse ? 'rgba(184, 61, 40, 0.16)' : 'rgba(63, 111, 158, 0.16)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = pal.rainStroke;
    ctx.lineWidth = 1;
    hs.rain.forEach(function (r) {
      r.y += r.spd * dt * 1.3;
      if (r.y > 1) { r.y = -0.05; r.x = Math.random(); }
      var rx = r.x * w, ry = r.y * h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + r.len);
      ctx.stroke();
    });

    /* Vault Dial Geometry (Responsive Mobile Portrait Sizing) */
    var cx = w * 0.5, cy = h * 0.52, radius = Math.min(compact ? 48 : 68, h * 0.32);

    /* Outer brass bezel */
    ctx.strokeStyle = pal.bezelRing;
    ctx.lineWidth = compact ? 10 : 12;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

    /* Tick marks */
    for (var ti = 0; ti < 36; ti++) {
      var ta = (ti / 36) * Math.PI * 2;
      var inner = radius - (ti % 3 === 0 ? 13 : 9.5);
      ctx.strokeStyle = ti % 3 === 0 ? pal.tickMajor : pal.tickMinor;
      ctx.lineWidth = ti % 3 === 0 ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * inner, cy + Math.sin(ta) * inner);
      ctx.lineTo(cx + Math.cos(ta) * (radius - 6), cy + Math.sin(ta) * (radius - 6));
      ctx.stroke();
    }

    /* Target Sweet-Spot Arc */
    ctx.save();
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = compact ? 9 : 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.5, hs.targetCenter + hs.targetArc * 0.5);
    ctx.stroke();

    /* Bullseye Core */
    ctx.strokeStyle = pal.sage;
    ctx.lineWidth = compact ? 9 : 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.16, hs.targetCenter + hs.targetArc * 0.16);
    ctx.stroke();
    ctx.restore();

    /* Sweeping Lockpick Needle */
    var nx = cx + Math.cos(hs.angle) * (radius + 5);
    var ny = cy + Math.sin(hs.angle) * (radius + 5);
    ctx.strokeStyle = pal.needle;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    ctx.fillStyle = pal.sageBright;
    ctx.beginPath(); ctx.arc(nx, ny, 4.5, 0, Math.PI * 2); ctx.fill();

    /* Center Hub */
    var hubR = compact ? 17 : 21;
    ctx.fillStyle = pal.hubFill;
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.gold;
    ctx.font = fontStack(800, compact ? 10.5 : 11.5);
    ctx.textAlign = 'center';
    ctx.fillText('x' + hs.streak, cx, cy + 4);

    /* Sparks */
    for (var si = hs.sparks.length - 1; si >= 0; si--) {
      var sp = hs.sparks[si];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { hs.sparks.splice(si, 1); continue; }
      ctx.fillStyle = sp.tone ? toneColorFromPalette(sp.tone, pal) : (sp.color || pal.gold);
      ctx.globalAlpha = Math.max(0, sp.life * 1.4);
      ctx.fillRect(cx + sp.x - 2, cy + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    state.fxPool.renderAndStep(ctx, w, h, realDt != null ? realDt : dt, pal);
    ctx.restore();

    drawFeverHudBadge(ctx, w * 0.5, 24, hs.streak, ar, pal);

    /* Selected Crime Title + Vector Reticle (RTL-Aware & Mobile-Safe) */
    var sel = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
    var targetName = sel ? sel.name : (ar ? 'خزنة الهدف' : 'TARGET VAULT');
    if (ar) {
      drawVectorReticle(ctx, w - 18, 16, 5.2, pal.gold, pal.sage);
      ctx.textAlign = 'right';
      ctx.fillStyle = pal.gold;
      ctx.font = fontStack(800, 11);
      ctx.fillText('الهدف: ' + targetName, w - 30, 20, w > 380 ? Math.max(90, w * 0.52) : Math.max(120, w - 42));
      if (w > 380) {
        ctx.textAlign = 'left';
        ctx.fillStyle = pal.inkSoft;
        ctx.font = fontStack(700, 10.5);
        ctx.fillText(compact ? 'المس القوس الذهبي' : 'المس أو [Space] في القوس الذهبي', 12, 20, w * 0.42);
      }
    } else {
      drawVectorReticle(ctx, 18, 16, 5.2, pal.gold, pal.sage);
      ctx.textAlign = 'left';
      ctx.fillStyle = pal.gold;
      ctx.font = fontStack(800, 11);
      ctx.fillText('TARGET: ' + targetName, 30, 20, w > 380 ? Math.max(90, w * 0.52) : Math.max(120, w - 42));
      if (w > 380) {
        ctx.textAlign = 'right';
        ctx.fillStyle = pal.inkSoft;
        ctx.font = fontStack(700, 10.5);
        ctx.fillText(compact ? 'TAP GOLD ARC' : 'CLICK OR [SPACE] IN GOLD ARC', w - 12, 20, w * 0.42);
      }
    }

    if (now < hs.bannerUntil && hs.banner) {
      ctx.textAlign = 'center';
      ctx.fillStyle = toneColorFromPalette(hs.bannerTone || 'gold', pal);
      ctx.font = fontStack(800, compact ? 11.5 : 12.5);
      ctx.fillText(hs.banner, cx, h - 8, Math.max(140, w - 24));
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.inkSoft;
      ctx.font = fontStack(700, compact ? 11 : 11.5);
      ctx.fillText(
        ar ? 'المس داخل القوس الذهبي لفتح الخزنة' : 'Tap inside the golden arc to breach vault',
        cx,
        h - 8,
        Math.max(140, w - 24)
      );
    }
  }

  function renderGymGame(dt, now, cvOverride, realDt) {
    var cv = cvOverride || document.getElementById('zig-gym-canvas');
    if (!cv) return;
    var compact = isCompactMobile();
    var s = syncCanvas(cv, compact ? 132 : 184);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gm = state.gym;
    var ar = isAr();
    var pal = getSketchPalette();

    /* Pendulum spring physics for Heavy Bag recoil */
    var spring = -26 * gm.bagAngle - 4.2 * gm.bagVel;
    gm.bagVel += spring * dt;
    gm.bagAngle += gm.bagVel * dt;

    /* Oscillating Power Sweet-Spot Cursor + 80ms Buffer & 55ms Coyote Grace Resolution */
    gm.gaugePos += gm.gaugeDir * dt * 1.15;
    if (gm.gaugePos >= 1) { gm.gaugePos = 1; gm.gaugeDir = -1; }
    if (gm.gaugePos <= 0) { gm.gaugePos = 0; gm.gaugeDir = 1; }

    var curDist = Math.abs(gm.gaugePos - 0.5);
    if (curDist <= 0.14) {
      state.coyote.markLegal('gym_sweet', state.clockSec, { bullseye: curDist <= 0.05 });
      var bufferedStrike = state.inputBuffer.consume('strike_bag', state.clockSec);
      if (bufferedStrike) {
        triggerGymStrike({ buffered: true });
      }
    } else if (state.inputBuffer.popExpired('strike_bag', state.clockSec)) {
      triggerGymStrike({ buffered: false });
    }

    pushCameraShakeTransform(ctx, w, h);

    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, w, h);

    /* Heavy-Bag Plate with Physical Impact Recoil/Sway */
    var swayX = Math.sin(gm.bagAngle) * 18;
    var swayY = -Math.abs(Math.sin(gm.bagAngle)) * 3.5;
    var drewBagArt = drawCoverArt(ctx, artImages.heavybag, w, h, swayX, swayY, 1.10);

    if (!drewBagArt) {
      var bg = ctx.createRadialGradient(w * 0.5, 24, 10, w * 0.5, h * 0.55, w * 0.65);
      bg.addColorStop(0, pal.gymFallbackTop);
      bg.addColorStop(1, pal.paper);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    /* Sketchbook Paper/Charcoal Legibility Scrim for Power Gauge */
    var scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, pal.gymScrimTop);
    scrim.addColorStop(0.50, pal.gymScrimMid);
    scrim.addColorStop(0.74, pal.gymScrimLow);
    scrim.addColorStop(1, pal.gymScrimBot);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    /* Subtle Ochre Target Strike Crosshair on Bag Center */
    var impactX = w * 0.5 + swayX;
    var impactY = h * 0.40 + swayY;
    ctx.save();
    ctx.strokeStyle = pal.bezelRing;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(impactX, impactY, compact ? 12 : 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* Shockwave Rings */
    for (var ri = gm.rings.length - 1; ri >= 0; ri--) {
      var rg = gm.rings[ri];
      rg.r += dt * 150;
      rg.alpha -= dt * 1.9;
      if (rg.alpha <= 0) { gm.rings.splice(ri, 1); continue; }
      ctx.strokeStyle = rg.tone ? toneColorFromPalette(rg.tone, pal) : (rg.color || pal.sageBright);
      ctx.globalAlpha = Math.max(0, rg.alpha);
      ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.arc(impactX, impactY, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* Sparks */
    for (var si = gm.sparks.length - 1; si >= 0; si--) {
      var sp = gm.sparks[si];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { gm.sparks.splice(si, 1); continue; }
      ctx.fillStyle = sp.tone ? toneColorFromPalette(sp.tone, pal) : (sp.color || pal.sageBright);
      ctx.globalAlpha = Math.max(0, sp.life * 1.5);
      ctx.fillRect(impactX + sp.x - 2, impactY + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    state.fxPool.renderAndStep(ctx, w, h, realDt != null ? realDt : dt, pal);
    ctx.restore();

    drawFeverHudBadge(ctx, w * 0.5, 8, gm.combo, ar, pal);

    /* Power Sweet-Spot Gauge Bar */
    var barW = Math.min(300, Math.max(120, w - 28));
    var barX = (w - barW) * 0.5;
    var barY = h - (compact ? 31 : 35);
    ctx.fillStyle = pal.hudBg;
    ctx.fillRect(barX, barY, barW, 12);
    ctx.strokeStyle = pal.hudStroke;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(barX, barY, barW, 12);

    /* Center Overdrive Sweet-Spot */
    ctx.fillStyle = pal.goldFill;
    ctx.fillRect(barX + barW * 0.36, barY + 1.5, barW * 0.28, 9);
    ctx.fillStyle = pal.sage;
    ctx.fillRect(barX + barW * 0.45, barY + 1.5, barW * 0.10, 9);

    /* Moving Cursor (High-Contrast Ink + Surface Halo) */
    var curX = barX + gm.gaugePos * barW;
    ctx.fillStyle = pal.surface;
    ctx.fillRect(curX - 3, barY - 3.5, 6, 19);
    ctx.fillStyle = pal.needle;
    ctx.fillRect(curX - 2, barY - 2.5, 4, 17);

    /* Concise Clamped Prompt (Never Overflows Narrow Mobile Column) */
    var maxTxtW = Math.max(110, w - 20);
    ctx.textAlign = 'center';
    ctx.font = fontStack(800, compact ? 10.5 : 11.5);
    if (now < gm.bannerUntil && gm.banner) {
      ctx.fillStyle = toneColorFromPalette(gm.bannerTone || 'good', pal);
      ctx.fillText(gm.banner, w * 0.5, h - 6, maxTxtW);
    } else {
      ctx.fillStyle = pal.ink;
      ctx.fillText(
        ar ? 'المس عند المنطقة الذهبية' : 'Tap when needle hits gold zone',
        w * 0.5,
        h - 6,
        maxTxtW
      );
    }
  }

  function renderRouletteCanvas(dt, now) {
    var cv = document.getElementById('zig-roulette-canvas');
    if (!cv) return;
    var compact = isCompactMobile();
    var s = syncCanvas(cv, compact ? 152 : 180);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var rl = state.roulette;
    var pal = getSketchPalette();
    var g = window.__zoneGame;
    var rState = (g && g.rouletteTable) || {};
    var busy = Boolean(g && g.rouletteBusy);

    if (busy && !rl.spinning) startRouletteAnimation();

    var targetPocket = (rState.pocket !== undefined && rState.pocket !== null) ? Number(rState.pocket) : 0;
    var pocketIdx = Math.max(0, EU_WHEEL.indexOf(targetPocket));
    var slice = (Math.PI * 2) / 37;

    if (rl.spinning && !busy) {
      rl.spinning = false;
      rl.settling = true;
      rl.highlightUntil = now + 2600;
    }

    if (rl.spinning) {
      rl.wheelAngle = (rl.wheelAngle + rl.wheelSpeed * dt) % (Math.PI * 2);
      rl.ballAngle = (rl.ballAngle + rl.ballSpeed * dt) % (Math.PI * 2);
      var tickIdx = Math.floor((((rl.ballAngle - rl.wheelAngle) % (Math.PI * 2)) + Math.PI * 2) / slice);
      if (tickIdx !== rl.lastTickIdx) {
        rl.lastTickIdx = tickIdx;
        sfx.wheelTick();
      }
    } else if (rl.settling) {
      rl.wheelSpeed = Math.max(0.28, rl.wheelSpeed * (1 - dt * 1.8));
      rl.wheelAngle = (rl.wheelAngle + rl.wheelSpeed * dt) % (Math.PI * 2);
      var desiredBallAngle = rl.wheelAngle + (pocketIdx + 0.5) * slice;
      var delta = Math.atan2(Math.sin(desiredBallAngle - rl.ballAngle), Math.cos(desiredBallAngle - rl.ballAngle));
      rl.ballAngle += delta * Math.min(1, dt * 8.5);
      rl.ballRadiusFrac += (0.67 - rl.ballRadiusFrac) * Math.min(1, dt * 6);
      if (Math.abs(delta) < 0.03 && Math.abs(rl.ballRadiusFrac - 0.67) < 0.02) {
        rl.settling = false;
        sfx.breachWin();
      }
    } else {
      rl.wheelAngle = (rl.wheelAngle + 0.24 * dt) % (Math.PI * 2);
      rl.ballAngle = rl.wheelAngle + (pocketIdx + 0.5) * slice;
      rl.ballRadiusFrac = 0.67;
    }

    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.5, cy = h * 0.5, outerR = Math.min(compact ? 62 : 76, h * 0.42);

    /* Inked Mahogany Outer Bowl */
    ctx.fillStyle = pal.wheelRim;
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    /* 37 Numbered Pockets */
    for (var i = 0; i < 37; i++) {
      var num = EU_WHEEL[i];
      var a0 = rl.wheelAngle + i * slice;
      var a1 = a0 + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = num === 0 ? pal.greenPocket : (RED_POCKETS[num] ? pal.redPocket : pal.blackPocket);
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.48)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (i === pocketIdx && now < rl.highlightUntil) {
        ctx.save();
        ctx.strokeStyle = pal.sageBright;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, outerR - 2, a0, a1); ctx.stroke();
        ctx.restore();
      }
    }

    /* Inner Brass Cone */
    var coneGrad = ctx.createRadialGradient(cx - 4, cy - 4, 3, cx, cy, outerR * 0.52);
    coneGrad.addColorStop(0, '#f7d586');
    coneGrad.addColorStop(0.55, '#9b6b1b');
    coneGrad.addColorStop(1, '#2b2218');
    ctx.fillStyle = coneGrad;
    ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.50, 0, Math.PI * 2); ctx.fill();

    /* Center Winning Pocket Readout */
    var capR = compact ? 16 : 19;
    ctx.fillStyle = pal.centerCap;
    ctx.beginPath(); ctx.arc(cx, cy, capR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = pal.centerText;
    ctx.font = fontStack(900, compact ? 12 : 13);
    ctx.textAlign = 'center';
    ctx.fillText(rl.spinning ? '..' : String(targetPocket), cx, cy + 4.5);

    /* Ivory Ball with Sketchbook Ink Outline */
    var bx = cx + Math.cos(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    var by = cy + Math.sin(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    ctx.save();
    ctx.fillStyle = pal.ballFill;
    ctx.strokeStyle = pal.ballStroke;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(bx, by, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawSlotSymbol(ctx, sym, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    if (sym.kind === 'diamond') {
      ctx.fillStyle = '#3f6f9e';
      ctx.strokeStyle = '#23201c';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, -9); ctx.lineTo(8, -9); ctx.lineTo(12, -3); ctx.lineTo(0, 11); ctx.lineTo(-12, -3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#e8f1fa';
      ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.stroke();
    } else if (sym.kind === 'seven') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b83d28';
      ctx.font = fontStack(900, 18);
      ctx.fillText('777', 0, 6);
    } else if (sym.kind === 'crown') {
      ctx.fillStyle = '#d99a38';
      ctx.strokeStyle = '#5c3c10';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-11, 7); ctx.lineTo(-12, -6); ctx.lineTo(-5, 0); ctx.lineTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(12, -6); ctx.lineTo(11, 7);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (sym.kind === 'bullion') {
      ctx.fillStyle = '#e2ac48';
      ctx.strokeStyle = '#5c3c10';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, -6); ctx.lineTo(9, -6); ctx.lineTo(12, 6); ctx.lineTo(-12, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fcf8ee';
      ctx.fillRect(-6, -3, 12, 3);
    } else if (sym.kind === 'spade') {
      ctx.fillStyle = '#3b6b35';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.bezierCurveTo(10, -2, 11, 5, 4, 6);
      ctx.lineTo(2, 6); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-2, 6); ctx.lineTo(-4, 6);
      ctx.bezierCurveTo(-11, 5, -10, -2, 0, -10);
      ctx.fill();
    } else {
      ctx.fillStyle = '#b83d28';
      ctx.strokeStyle = '#5a1d12';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-4.5, 3, 5, 0, Math.PI * 2);
      ctx.arc(4.5, 4, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3b6b35';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, -2); ctx.quadraticCurveTo(0, -10, 3, -9);
      ctx.moveTo(4, -1); ctx.quadraticCurveTo(2, -8, 3, -9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderSlotsCanvas(dt, now) {
    var cv = document.getElementById('zig-slots-canvas');
    if (!cv) return;
    var compact = isCompactMobile();
    var s = syncCanvas(cv, compact ? 152 : 180);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var sl = state.slots;
    var pal = getSketchPalette();
    var g = window.__zoneGame;
    var sState = (g && g.slotsTable) || {};
    var busy = Boolean(g && g.slotsBusy);
    var reelsRaw = Array.isArray(sState.reels) && sState.reels.length === 3 ? sState.reels : ['SEVEN', 'CROWN', 'DIAMOND'];

    if (busy && !sl.spinning) startSlotsAnimation();

    for (var t = 0; t < 3; t++) {
      var idx = SLOT_SYMS.findIndex(function (x) { return x.id === reelsRaw[t]; });
      sl.targets[t] = idx >= 0 ? idx : 0;
    }

    var elapsed = (now - sl.spinStart) / 1000;
    if (sl.spinning) {
      for (var r = 0; r < 3; r++) {
        if (!sl.locked[r]) {
          sl.offsets[r] = (sl.offsets[r] + sl.speeds[r] * dt) % SLOT_SYMS.length;
          if (!busy && elapsed > 0.42 + r * 0.28) {
            sl.locked[r] = true;
            sl.offsets[r] = sl.targets[r];
            sfx.reelClunk();
            if (r === 2) {
              sl.spinning = false;
              if (sState.result === 'win') {
                sfx.jackpot();
                for (var ci = 0; ci < 26; ci++) {
                  sl.coins.push({
                    x: w * (0.2 + Math.random() * 0.6),
                    y: h * 0.5,
                    vx: (Math.random() - 0.5) * 180,
                    vy: -110 - Math.random() * 120,
                    life: 1.0
                  });
                }
              }
            }
          }
        }
      }
    } else {
      for (var k = 0; k < 3; k++) sl.offsets[k] = sl.targets[k];
    }

    sl.leverPull = Math.max(0, sl.leverPull - dt * 2.6);

    ctx.clearRect(0, 0, w, h);
    var cabW = Math.min(w - 34, 290);
    var cabX = (w - cabW) * 0.5 - 6;
    var cabY = 12, cabH = h - 24;

    /* Brass & Gouache Slot Cabinet */
    ctx.fillStyle = pal.cabFill;
    ctx.fillRect(cabX, cabY, cabW, cabH);
    ctx.strokeStyle = pal.goldFill;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(cabX, cabY, cabW, cabH);

    var reelGap = 8;
    var reelW = (cabW - reelGap * 4) / 3;
    var reelH = cabH - 18;

    for (var ri = 0; ri < 3; ri++) {
      var rx = cabX + reelGap + ri * (reelW + reelGap);
      var ry = cabY + 9;

      var drumGrad = ctx.createLinearGradient(rx, ry, rx, ry + reelH);
      drumGrad.addColorStop(0, pal.reelEdge);
      drumGrad.addColorStop(0.5, pal.reelCenter);
      drumGrad.addColorStop(1, pal.reelEdge);
      ctx.fillStyle = drumGrad;
      ctx.fillRect(rx, ry, reelW, reelH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, reelW, reelH);
      ctx.clip();

      var baseIdx = Math.floor(sl.offsets[ri]);
      var frac = sl.offsets[ri] - baseIdx;

      for (var row = -1; row <= 1; row++) {
        var symIdx = (baseIdx + row + SLOT_SYMS.length) % SLOT_SYMS.length;
        var sym = SLOT_SYMS[symIdx];
        var sy = ry + reelH * 0.5 + (row - frac) * (compact ? 38 : 44);
        drawSlotSymbol(ctx, sym, rx + reelW * 0.5, sy);
      }
      ctx.restore();

      ctx.strokeStyle = sl.locked[ri] ? pal.goldFill : pal.sage;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(rx, ry, reelW, reelH);
    }

    /* Inked Payline */
    ctx.strokeStyle = sState.result === 'win' && !sl.spinning ? pal.sage : 'rgba(184, 61, 40, 0.65)';
    ctx.lineWidth = sState.result === 'win' && !sl.spinning ? 2.8 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cabX + 3, cabY + cabH * 0.5);
    ctx.lineTo(cabX + cabW - 3, cabY + cabH * 0.5);
    ctx.stroke();

    /* Mechanical Side Lever */
    var lx = cabX + cabW + 10;
    var topY = cabY + 20 + sl.leverPull * 50;
    ctx.strokeStyle = pal.leverStroke;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(cabX + cabW, cabY + cabH * 0.65);
    ctx.lineTo(lx, cabY + cabH * 0.65);
    ctx.lineTo(lx, topY);
    ctx.stroke();
    ctx.fillStyle = '#b83d28';
    ctx.strokeStyle = '#23201c';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(lx, topY, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    /* Gold Coin Shower on Win */
    for (var cIdx = sl.coins.length - 1; cIdx >= 0; cIdx--) {
      var cn = sl.coins[cIdx];
      cn.vy += 320 * dt;
      cn.x += cn.vx * dt;
      cn.y += cn.vy * dt;
      cn.life -= dt;
      if (cn.life <= 0) { sl.coins.splice(cIdx, 1); continue; }
      ctx.fillStyle = pal.goldFill;
      ctx.strokeStyle = '#23201c';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cn.x, cn.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  /* ---------------- Global Syndicate Flight Bar & Map Bridge (Zero Emojis) ---------------- */
  var WORLD_FLIGHT_CITIES = [
    { id: 'zone', code: 'ZCT', minLevel: 1, fare: 0, en: 'Zone City', ar: 'مدينة زون', subEn: 'Home Turf · 5 Sectors', subAr: 'المركز الرئيسي · 5 قطاعات' },
    { id: 'riyadh', code: 'RUH', minLevel: 1, fare: 1200, en: 'Riyadh', ar: 'الرياض', subEn: 'Bullion Desk · $1,200', subAr: 'مكتب السبائك · $1,200' },
    { id: 'cairo', code: 'CAI', minLevel: 1, fare: 950, en: 'Cairo', ar: 'القاهرة', subEn: 'Shadow Bazaar · $950', subAr: 'بازار النيل · $950' },
    { id: 'dubai', code: 'DXB', minLevel: 3, fare: 2400, en: 'Dubai', ar: 'دبي', subEn: 'Sky-Vaults · Lv.3', subAr: 'خزائن المارينا · مستوى 3' },
    { id: 'istanbul', code: 'IST', minLevel: 6, fare: 3500, en: 'Istanbul', ar: 'إسطنبول', subEn: 'Bosphorus Hub · Lv.6', subAr: 'مضيق البسفور · مستوى 6' },
    { id: 'tokyo', code: 'TYO', minLevel: 10, fare: 6800, en: 'Neo-Tokyo', ar: 'نيو طوكيو', subEn: 'Cyber District · Lv.10', subAr: 'حي شيبويا · مستوى 10' },
    { id: 'montecarlo', code: 'MCO', minLevel: 15, fare: 12500, en: 'Monte Carlo', ar: 'مونت كارلو', subEn: 'Sovereign Salon · Lv.15', subAr: 'صالون النخبة · مستوى 15' }
  ];

  function getStoredWorldCity() {
    var g = window.__zoneGame;
    if (g && g.p && g.p.worldCityId) return g.p.worldCityId;
    try { return localStorage.getItem('zone_world_city') || 'zone'; } catch (_) { return 'zone'; }
  }

  function mountCityWorldFlightBar() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'city') return;
    var mapShell = main.querySelector('.zone-city-map-shell');
    if (!mapShell || !mapShell.parentElement) return;

    var ar = isAr();
    var g = window.__zoneGame;
    var lv = (g && g.p && Number(g.p.level)) ? Math.max(1, Math.floor(Number(g.p.level))) : 1;
    var activeCityId = getStoredWorldCity();
    var sig = (ar ? 'ar' : 'en') + ':' + lv + ':' + activeCityId;

    var workspace = mapShell.closest('.zone-city-workspace') || mapShell;
    if (!workspace.parentElement) return;

    var bar = document.getElementById('zig-world-flight-bar');
    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'zig-world-flight-bar';
      bar.className = 'zig-world-flight-bar';
      workspace.parentElement.insertBefore(bar, workspace);
    } else if (bar.parentElement !== workspace.parentElement) {
      workspace.parentElement.insertBefore(bar, workspace);
    }
    if (bar.getAttribute('data-sig') === sig) return;
    bar.setAttribute('data-sig', sig);

    var curObj = WORLD_FLIGHT_CITIES.find(function (c) { return c.id === activeCityId; }) || WORLD_FLIGHT_CITIES[0];

    bar.innerHTML =
      '<div class="zig-world-flight-top">' +
        '<div class="zig-world-flight-title">' +
          SVG_PLANE +
          '<span>' + (ar ? 'الرحلات العالمية' : 'World Flights') + '</span>' +
          '<span class="zig-world-origin-pill">' + (ar ? curObj.ar : curObj.en) + '</span>' +
        '</div>' +
        '<div class="zig-world-flight-meta">' +
          '<span class="zig-world-lv-pill">' + (ar ? 'مستوى ' : 'Lv.') + lv + '</span>' +
          '<button type="button" class="zig-btn" id="zigOpenRadarBtn">' + (ar ? 'رادار الرحلات' : 'Flight Radar') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zig-world-cities-row">' +
        WORLD_FLIGHT_CITIES.map(function (c) {
          var isHere = c.id === activeCityId;
          var locked = lv < c.minLevel;
          var rightBadge = isHere
            ? '<span class="zig-here-dot" aria-hidden="true"></span>'
            : locked
              ? ('<span class="zig-chip-status">' + SVG_LOCK + '<span>' + (ar ? 'م.' : 'Lv.') + c.minLevel + '</span></span>')
              : '<span>' + c.code + '</span>';
          return (
            '<button type="button" class="zig-city-chip zig-flight-card' + (isHere ? ' is-active' : '') + (locked ? ' is-locked' : '') + '" data-world-city="' + c.id + '">' +
              '<div class="zig-city-chip-top">' +
                '<span>' + (ar ? c.ar : c.en) + '</span>' +
                rightBadge +
              '</div>' +
              '<div class="zig-city-chip-sub">' + (ar ? c.subAr : c.subEn) + '</div>' +
            '</button>'
          );
        }).join('') +
      '</div>';

    function openWorldRadarIn3D() {
      var shell = document.querySelector('#zone-main .zone-city-map-shell');
      var needsSwitch = Boolean(shell && shell.getAttribute('data-zwc-view') !== '3d');
      if (needsSwitch) {
        var mode3d = document.querySelector('#zwc-city-panorama-stage [data-zwc-mode="3d"]');
        if (mode3d) mode3d.click();
      }
      var postOpen = function () {
        var frame = document.getElementById('zone-city-map');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'ZONE_OPEN_WORLD_CITIES' }, window.location.origin);
        }
      };
      if (needsSwitch) {
        setTimeout(postOpen, 160);
      } else {
        postOpen();
      }
    }

    var radarBtn = bar.querySelector('#zigOpenRadarBtn');
    if (radarBtn) {
      radarBtn.onclick = openWorldRadarIn3D;
    }

    Array.from(bar.querySelectorAll('[data-world-city]')).forEach(function (chip) {
      chip.onclick = function () {
        var cid = chip.getAttribute('data-world-city');
        var target = WORLD_FLIGHT_CITIES.find(function (c) { return c.id === cid; });
        if (!target) return;
        var frame = document.getElementById('zone-city-map');
        if (lv < target.minLevel || cid === activeCityId) {
          openWorldRadarIn3D();
          return;
        }
        if (g && g.p) {
          if (Number(g.p.cash || 0) < target.fare) {
            if (g.toast) g.toast(ar ? 'رصيدك غير كافٍ لتذكرة السفر.' : 'Not enough cash for charter ticket.', true);
            return;
          }
          g.p.cash = Math.max(0, Number(g.p.cash || 0) - target.fare);
          g.p.xp = Number(g.p.xp || 0) + 35;
          if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
          g.p.worldCityId = target.id;
          g.p.city = ar ? target.ar : target.en;
          try { localStorage.setItem('zone_world_city', target.id); } catch (_) {}
          if (g.playTacticalSfx) g.playTacticalSfx('good');
          if (g.save) g.save();
          g._mapSig = '';
          if (g.pushMap) g.pushMap();
          if (g.toast) g.toast((ar ? 'وصلت إلى ' : 'Landed in ') + (ar ? target.ar : target.en) + ' (' + target.code + ') · +35' + (ar ? ' خبرة' : ' XP'));
          if (g.forceUpdate) g.forceUpdate();
        } else {
          try { localStorage.setItem('zone_world_city', target.id); } catch (_) {}
        }
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'ZONE_SYNC_WORLD_CITY', cityId: target.id }, window.location.origin);
        }
        bar.removeAttribute('data-sig');
        mountCityWorldFlightBar();
      };
    });
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin || !ev.data || ev.data.type !== 'ZONE_WORLD_TRAVEL') return;
    var d = ev.data;
    var g = window.__zoneGame;
    var ar = isAr();
    if (d.action === 'fly' && d.cityId) {
      try { localStorage.setItem('zone_world_city', d.cityId); } catch (_) {}
      if (g && g.p) {
        g.p.cash = Math.max(0, Number(g.p.cash || 0) - Number(d.fare || 0));
        g.p.xp = Number(g.p.xp || 0) + Number(d.xpDelta || 35);
        if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
        g.p.worldCityId = d.cityId;
        g.p.city = d.cityName || d.cityId;
        if (g.playTacticalSfx) g.playTacticalSfx('good');
        if (g.save) g.save();
        g._mapSig = '';
        if (g.pushMap) g.pushMap();
        if (g.toast) g.toast((ar ? 'هبطت الطائرة في ' : 'Charter landed in ') + (d.cityName || d.cityId) + ' · +' + Number(d.xpDelta || 35) + (ar ? ' خبرة' : ' XP'));
        if (typeof window.ZoneSyncHudBars === 'function') window.ZoneSyncHudBars(g.p);
        if (g.forceUpdate) g.forceUpdate();
      }
      var bar = document.getElementById('zig-world-flight-bar');
      if (bar) bar.removeAttribute('data-sig');
      mountCityWorldFlightBar();
    } else if (d.action === 'contract') {
      if (g && g.p) {
        g.p.cash = Number(g.p.cash || 0) + Number(d.cashDelta || 0);
        g.p.xp = Number(g.p.xp || 0) + Number(d.xpDelta || 0);
        if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
        if (g.playTacticalSfx) g.playTacticalSfx('cash');
        if (g.save) g.save();
        g._mapSig = '';
        if (g.pushMap) g.pushMap();
        if (g.toast) g.toast((d.contractLabel || (ar ? 'عملية إقليمية' : 'Regional Op')) + ' · +$' + Number(d.cashDelta || 0).toLocaleString('en-US') + ' & +' + Number(d.xpDelta || 0) + (ar ? ' خبرة' : ' XP'));
        if (typeof window.ZoneSyncHudBars === 'function') window.ZoneSyncHudBars(g.p);
        if (g.forceUpdate) g.forceUpdate();
      }
    }
  });

  window.addEventListener('zone:mute-change', function (ev) {
    if (_dispatchingMuteSync) return;
    try {
      var muted = ev && ev.detail ? Boolean(ev.detail.muted) : (localStorage.getItem('zig_muted') === '1');
      soundEnabled = !muted;
      var sndBtn = document.getElementById('zig-sound-toggle');
      if (sndBtn) {
        sndBtn.setAttribute('data-zig-muted', soundEnabled ? '0' : '1');
        sndBtn.setAttribute('data-zig-sfx', soundEnabled ? 'on' : 'off');
        sndBtn.innerHTML = renderSoundBtnInner(isAr());
      }
    } catch (_) {}
  });

  /* ---------------- Demand-Driven 60fps Loop & Scoped #zone-main Observer ---------------- */
  var canvasIo = null;
  var observedCanvases = typeof WeakSet === 'function' ? new WeakSet() : null;

  function ensureCanvasIntersectionObserver() {
    if (canvasIo || typeof IntersectionObserver !== 'function') return canvasIo;
    try {
      canvasIo = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var ent = entries[i];
          var id = ent.target && ent.target.id;
          if (id) {
            state.canvasVisibility[id] = Boolean(ent.isIntersecting);
          }
        }
        ensureLoopRunning();
      }, { threshold: 0.01 });
    } catch (_) {
      canvasIo = null;
    }
    return canvasIo;
  }

  function observeInteractiveCanvas(cv) {
    if (!cv || !cv.id) return;
    if (!Object.prototype.hasOwnProperty.call(state.canvasVisibility, cv.id)) {
      state.canvasVisibility[cv.id] = !cv.closest('[hidden]');
    }
    if (observedCanvases && observedCanvases.has(cv)) return;
    if (observedCanvases) observedCanvases.add(cv);
    var io = ensureCanvasIntersectionObserver();
    if (io) {
      try { io.observe(cv); } catch (_) {}
    }
  }

  function isCanvasVisible(id) {
    var el = document.getElementById(id);
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    if (el.style && el.style.display === 'none') return false;
    if (Object.prototype.hasOwnProperty.call(state.canvasVisibility, id)) {
      return Boolean(state.canvasVisibility[id]);
    }
    return true;
  }

  function paintIdleVisibleCanvases() {
    if (document.hidden) return;
    var main = document.getElementById('zone-main');
    if (!main) return;
    var scr = main.getAttribute('data-zone-screen') || 'home';
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (scr === 'home') {
      renderStaticHomePreviews();
      if (state.getaway.open && document.getElementById('zig-getaway-canvas')) {
        renderActiveArcadeStage(0, now);
      }
    } else if (scr === 'crimes') {
      if (document.getElementById('zig-heist-canvas')) renderCrimesGame(0, now);
    } else if (scr === 'gym') {
      if (document.getElementById('zig-gym-canvas')) renderGymGame(0, now);
    } else if (scr === 'casino') {
      renderStaticHomePreviews();
      if (state.getaway.open && document.getElementById('zig-getaway-canvas')) {
        renderActiveArcadeStage(0, now);
      }
      if (document.getElementById('zig-roulette-canvas')) renderRouletteCanvas(0, now);
      if (document.getElementById('zig-slots-canvas')) renderSlotsCanvas(0, now);
    }
  }

  function shouldRunLoop() {
    if (document.hidden) return false;
    var main = document.getElementById('zone-main');
    if (!main) return false;
    var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var scr = main.getAttribute('data-zone-screen') || 'home';
    if (scr === 'home') {
      if (state.hoveredPreviewId) return true;
      return Boolean(state.getaway.open && isCanvasVisible('zig-getaway-canvas'));
    }
    if (scr === 'crimes') {
      return isCanvasVisible('zig-heist-canvas') || isCanvasVisible('zig-crimes-canvas') || state.juice.isActive(nowMs);
    }
    if (scr === 'gym') {
      return isCanvasVisible('zig-gym-canvas') || state.juice.isActive(nowMs);
    }
    if (scr === 'casino') {
      if (state.hoveredPreviewId) return true;
      if (state.getaway.open && isCanvasVisible('zig-getaway-canvas')) return true;
      return isCanvasVisible('zig-roulette-canvas') || isCanvasVisible('zig-slots-canvas');
    }
    return false;
  }

  var prevTime = 0;
  function frame(now) {
    state.rafId = 0;
    if (!shouldRunLoop()) {
      prevTime = 0;
      return;
    }
    var realDt = prevTime ? Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000)) : 0.016;
    prevTime = now;
    var step = state.juice.stepReal(realDt, now, isReducedMotion());
    var dt = step.scaledDt;
    state.clockSec += dt;
    state.rafTicks += 1;

    var main = document.getElementById('zone-main');
    var scr = main ? (main.getAttribute('data-zone-screen') || 'home') : 'home';

    if (scr === 'home') {
      if (state.hoveredPreviewId) renderHoveredHomePreview(realDt, now);
      if (state.getaway.open && isCanvasVisible('zig-getaway-canvas')) renderActiveArcadeStage(dt, now, realDt);
    } else if (scr === 'crimes') {
      renderCrimesGame(dt, now, null, realDt);
    } else if (scr === 'gym') {
      renderGymGame(dt, now, null, realDt);
    } else if (scr === 'casino') {
      if (state.hoveredPreviewId) renderHoveredHomePreview(realDt, now);
      if (state.getaway.open && isCanvasVisible('zig-getaway-canvas')) renderActiveArcadeStage(dt, now, realDt);
      if (isCanvasVisible('zig-roulette-canvas')) renderRouletteCanvas(realDt, now);
      if (isCanvasVisible('zig-slots-canvas')) renderSlotsCanvas(realDt, now);
    }

    if (shouldRunLoop()) {
      state.rafId = requestAnimationFrame(frame);
    } else {
      prevTime = 0;
    }
  }

  function ensureLoopRunning() {
    if (shouldRunLoop()) {
      if (!state.rafId) {
        prevTime = 0;
        state.rafId = requestAnimationFrame(frame);
      }
    } else if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
      prevTime = 0;
    }
  }

  var observedMainEl = null;
  var mainObserver = null;
  var bootObserver = null;
  var docAttrObserver = null;
  var obsTimer = null;
  var resizeTimer = null;

  function scheduleSyncMounts() {
    if (obsTimer) return;
    obsTimer = setTimeout(function () {
      obsTimer = null;
      syncMounts();
    }, 36);
  }

  function bindDocAttrObserver() {
    if (docAttrObserver || typeof MutationObserver !== 'function' || !document.documentElement) return;
    docAttrObserver = new MutationObserver(function () {
      if (isReducedMotion()) state.juice.reset();
      var bar = document.getElementById('zig-world-flight-bar');
      if (bar) bar.removeAttribute('data-sig');
      syncMounts();
      paintIdleVisibleCanvases();
    });
    docAttrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir', 'data-theme', 'data-zone-reduced-motion']
    });
  }

  function bindScopedMainObserver() {
    if (typeof MutationObserver !== 'function') return false;
    if (document.querySelector('x-dc')) return false;
    var main = document.getElementById('zone-main');
    if (!main) return false;
    if (main !== observedMainEl) {
      observedMainEl = main;
      if (mainObserver) {
        try { mainObserver.disconnect(); } catch (_) {}
      }
      mainObserver = new MutationObserver(function (records) {
        var screenChanged = false;
        for (var i = 0; i < records.length; i++) {
          if (records[i].type === 'attributes' && records[i].attributeName === 'data-zone-screen') {
            screenChanged = true;
            break;
          }
        }
        if (screenChanged) {
          if (obsTimer) {
            clearTimeout(obsTimer);
            obsTimer = null;
          }
          syncMounts();
          paintIdleVisibleCanvases();
        }
        scheduleSyncMounts();
      });
      mainObserver.observe(main, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['data-zone-screen']
      });
    }
    if (bootObserver) {
      try { bootObserver.disconnect(); } catch (_) {}
      bootObserver = null;
    }
    return true;
  }

  var hofHydrateState = { attempts: 0, lastTry: 0, timer: null };

  function syncHallOfFame() {
    var main = document.getElementById('zone-main');
    var scr = main ? main.getAttribute('data-zone-screen') : '';
    if (scr !== 'hof') {
      hofHydrateState.attempts = 0;
      if (hofHydrateState.timer) {
        clearTimeout(hofHydrateState.timer);
        hofHydrateState.timer = null;
      }
      return;
    }
    var g = window.__zoneGame;
    if (!g || typeof g.loadLeaderboards !== 'function') return;
    if (g.leaderboard || g.leaderboardBusy || g.leaderboardError) {
      hofHydrateState.attempts = 0;
      if (hofHydrateState.timer) {
        clearTimeout(hofHydrateState.timer);
        hofHydrateState.timer = null;
      }
      return;
    }
    var now = Date.now();
    if (hofHydrateState.attempts >= 6 || (now - hofHydrateState.lastTry) < 850) return;
    hofHydrateState.attempts++;
    hofHydrateState.lastTry = now;
    try {
      g.loadLeaderboards();
    } catch (_) {}
    /* If loadLeaderboards returned early before ZonePlatform/session finished booting, retry shortly */
    if (!g.leaderboardBusy && !g.leaderboard && !hofHydrateState.timer && hofHydrateState.attempts < 6) {
      hofHydrateState.timer = setTimeout(function () {
        hofHydrateState.timer = null;
        syncHallOfFame();
      }, 950);
    }
  }

  function syncMounts() {
    ensureMotionStyles();
    if (document.querySelector('x-dc')) return;
    bindDocAttrObserver();
    bindScopedMainObserver();
    mountHomeArcade();
    mountCrimesGame();
    mountGymGame();
    mountCasinoGames();
    mountAttackBanner();
    mountCityWorldFlightBar();
    syncHallOfFame();
    ensureLoopRunning();

    /* Detect cash reward deltas for arcade floating popups + Live 3D/Audio Bridge (ignore initial boot hydration 0 -> $2,500) */
    var g = window.__zoneGame;
    if (g && g.p && Number.isFinite(Number(g.p.cash))) {
      var curCash = Number(g.p.cash);
      if (state.lastCash !== null && state.lastCash > 0 && (Date.now() - state.bootAt) > 3500 && curCash > state.lastCash) {
        var diff = curCash - state.lastCash;
        if (diff > 0 && diff < 50000000) {
          spawnFloatingReward('+$' + diff.toLocaleString('en-US'), 'good');
          emitArcadeBridge('payout', 'cash_payout', 1, { cashDelta: diff });
        }
      }
      state.lastCash = curCash;
    }
  }

  window.addEventListener('zone:render', syncMounts);
  window.addEventListener('zone:ascension-updated', function () {
    var main = document.getElementById('zone-main');
    var arc = document.getElementById('zig-home-arcade');
    if (main && arc) ensureHomeArcadePlacement(main, arc);
  });
  document.addEventListener('visibilitychange', function () {
    ensureLoopRunning();
    if (!document.hidden) paintIdleVisibleCanvases();
  });
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      paintIdleVisibleCanvases();
    }, 120);
  });

  function boot() {
    bindDocAttrObserver();
    syncMounts();
    paintIdleVisibleCanvases();
    if (!bindScopedMainObserver() && document.body && typeof MutationObserver === 'function') {
      bootObserver = new MutationObserver(function () {
        if (bindScopedMainObserver()) {
          syncMounts();
          paintIdleVisibleCanvases();
        }
      });
      bootObserver.observe(document.body, { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.__zoneInstantGamesStats = {
    isLoopRunning: function () { return Boolean(state.rafId); },
    getTicks: function () { return state.rafTicks; },
    getHoveredPreviewId: function () { return state.hoveredPreviewId; },
    getArcadeState: function () { return state; },
    startRun: startGetawayRun,
    requestGymAction: requestGymAction,
    requestHeistAction: requestHeistAction
  };
})();

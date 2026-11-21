/* ==========================================================================
 * ZONE v155 - TRACK 4: UTILITY AI NEMESIS & PERCEPTION STEALTH UI BRIDGE
 * Exclusive Ownership: @ai-stealth-combat (assets/ui/zone-tactical-director.js)
 * Exposes: window.ZoneTacticalDirector
 * Mounts:
 *   - screen === 'crimes': #ztd-stealth-bar beside [data-z3d-stage="heist-breach"]
 *   - screen === 'attack' (and PvP/Boss stages): #ztd-combat-deck beside [data-z3d-stage="combat-arena"]
 * Fiber-Safe: Append/adjacent mount outside <x-dc>; zero Home clutter.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneTacticalDirectorBooted && window.ZoneTacticalDirector) return;
  window.__zoneTacticalDirectorBooted = true;

  var DISTRICTS = {
    pier_4: { id: 'pier_4', en: 'Pier 4 Docks', ar: 'أرصفة الميناء ٤', visionAngleDeg: 58, sweepHz: 0.16, ambientNoise: 10 },
    neon_alley: { id: 'neon_alley', en: 'Neon Alley', ar: 'زقاق النيون', visionAngleDeg: 64, sweepHz: 0.20, ambientNoise: 16 },
    foundry: { id: 'foundry', en: 'Industrial Foundry', ar: 'المسبك الصناعي', visionAngleDeg: 52, sweepHz: 0.14, ambientNoise: 20 },
    downtown: { id: 'downtown', en: 'Downtown Vaults', ar: 'خزائن وسط المدينة', visionAngleDeg: 72, sweepHz: 0.24, ambientNoise: 8 }
  };

  var STANCES = [
    {
      id: 'berserk_rush',
      counter: 'counter_parry',
      curve: 'Quadratic',
      en: 'Berserk Rush',
      ar: 'اندفاع دموي شرس',
      teleEn: 'Rival lowers shoulder for a reckless close-quarters blitz!',
      teleAr: 'الخصم يندفع بهجوم قريب متهور لاختراق دفاعك!'
    },
    {
      id: 'ballistic_guard',
      counter: 'armor_pierce',
      curve: 'Linear',
      en: 'Ballistic Guard',
      ar: 'تحصّن باليستي',
      teleEn: 'Rival braces behind Kevlar plating to absorb standard fire.',
      teleAr: 'الخصم يتحصن خلف درع كيفلر مقوّى لامتصاص الطلقات.'
    },
    {
      id: 'flank_ambush',
      counter: 'suppress_fire',
      curve: 'Logistic',
      en: 'Flank Ambush',
      ar: 'كمين التفافي خفي',
      teleEn: 'Rival slips into district smoke shadows for a flanking strike.',
      teleAr: 'الخصم يتسلل عبر دخان الزقاق للإطباق من الخاصرة.'
    },
    {
      id: 'stim_inject',
      counter: 'rush_interrupt',
      curve: 'Logistic',
      en: 'Stim Inject',
      ar: 'حقن منشط إسعافي',
      teleEn: 'Critical HP! Rival uncaps a combat trauma auto-injector.',
      teleAr: 'صحة حرجة! الخصم يجهز حاقن إسعاف قتالي لاستعادة صحته.'
    }
  ];

  var MANEUVERS = [
    { id: 'counter_parry', vs: 'berserk_rush', en: 'Counter Parry', ar: 'صدّ مرتد', vsEn: 'vs Berserk Rush', vsAr: 'ضد الاندفاع', cue: 'blade_slash' },
    { id: 'armor_pierce', vs: 'ballistic_guard', en: 'Armor Pierce', ar: 'اختراق الدرع', vsEn: 'vs Ballistic Guard', vsAr: 'ضد التحصّن', cue: 'gunshot_rifle' },
    { id: 'suppress_fire', vs: 'flank_ambush', en: 'Suppress Fire', ar: 'نيران قمعية', vsEn: 'vs Flank Ambush', vsAr: 'ضد الكمين', cue: 'gunshot_pistol' },
    { id: 'rush_interrupt', vs: 'stim_inject', en: 'Rush Interrupt', ar: 'كسر الإسعاف', vsEn: 'vs Stim Inject', vsAr: 'ضد المنشط', cue: 'heavy_bag_impact' }
  ];

  var store = {
    district: 'pier_4',
    approach: 'stealth',
    serverClockOffsetSec: 0,
    busy: false,
    lastSyncAt: 0,
    rafId: 0,
    stealth: {
      noiseLevel: 10,
      threatTier: 'CLEAR',
      cleanStreak: 0,
      cooldownUntilSec: 0,
      feedback: null
    },
    encounter: {
      nemesisNameEn: 'Malik "Razor" Vance',
      nemesisNameAr: 'مالك "الموس" فانس',
      rivalHp: 235,
      rivalMaxHp: 235,
      playerHp: 500,
      playerMaxHp: 500,
      districtHeat: 28,
      weaponClass: 'rifle',
      stimsRemaining: 2,
      comboChain: 0,
      turnCount: 0,
      fsmState: 'ENGAGED',
      btNode: 'RootSelector>UtilitySelector>Sequence[ballistic_guard]',
      activeStance: 'ballistic_guard',
      scores: { berserk_rush: 0.34, ballistic_guard: 0.74, flank_ambush: 0.38, stim_inject: 0.14 },
      cooldownUntilSec: 0,
      feedback: null
    },
    telemetry: {
      breachesTriggered: 0,
      maneuversTriggered: 0,
      apiCalls: 0,
      fallbackPreviews: 0
    }
  };

  function isAr() {
    var html = document.documentElement;
    if (!html) return false;
    return html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function isReducedMotion() {
    var html = document.documentElement;
    return Boolean(html && html.dataset && html.dataset.zoneReducedMotion === 'true');
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function nowSecFloat() {
    return (Date.now() / 1000) + store.serverClockOffsetSec;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  /* ---------------- Utility AI Response Curves (Client Mirror of PHP Engine) ---------------- */
  function evaluateCurve(kind, x, opts) {
    var u = clamp01(x);
    var p = opts || {};
    if (p.invert) u = 1 - u;
    var out = u;
    if (kind === 'linear') {
      out = (p.slope != null ? p.slope : 1) * u + (p.intercept || 0);
    } else if (kind === 'quadratic') {
      out = Math.pow(u, Math.max(0.25, p.exponent || 2));
    } else if (kind === 'logistic') {
      var k = Math.max(0.5, p.steepness || 10);
      var mid = Math.max(0.05, Math.min(0.95, p.midpoint != null ? p.midpoint : 0.5));
      var minV = 1 / (1 + Math.exp(-k * (0 - mid)));
      var maxV = 1 / (1 + Math.exp(-k * (1 - mid)));
      var sig = 1 / (1 + Math.exp(-k * (u - mid)));
      out = (sig - minV) / Math.max(1e-6, maxV - minV);
    }
    return Math.round(clamp01(out) * 10000) / 10000;
  }

  function scoreUtilityStances(bb) {
    var b = bb || {};
    var pHp = clamp01(b.playerHpPct != null ? b.playerHpPct : 1);
    var rHp = clamp01(b.rivalHpPct != null ? b.rivalHpPct : 1);
    var wCls = String(b.weaponClass || 'rifle').toLowerCase();
    var heat = clamp01((Number(b.districtHeat != null ? b.districtHeat : 28)) / 100);
    var stims = Math.max(0, Number(b.stimsRemaining != null ? b.stimsRemaining : 2));

    var heavy = wCls === 'rifle' || wCls === 'sniper' || wCls === 'shotgun' || wCls === 'smg';
    var longR = wCls === 'sniper' || wCls === 'rifle';
    var closeL = wCls === 'melee' || wCls === 'pistol' || wCls === 'unarmed';

    var berserk = Math.min(0.99,
      0.58 * evaluateCurve('quadratic', 1 - pHp, { exponent: 1.85 }) +
      0.26 * evaluateCurve('linear', rHp, { slope: 0.85, intercept: 0.15 }) +
      (longR ? 0.16 : 0)
    );
    var ballistic = Math.min(0.99,
      0.36 * evaluateCurve('linear', rHp, { slope: 0.70, intercept: 0.25 }) +
      0.24 * evaluateCurve('linear', 1 - heat, { slope: 0.65, intercept: 0.20 }) +
      (heavy ? 0.36 : 0.08)
    );
    var flank = Math.min(0.99,
      0.56 * evaluateCurve('logistic', heat, { steepness: 9.5, midpoint: 0.52 }) +
      0.24 * evaluateCurve('linear', pHp, { slope: 0.80, intercept: 0.15 }) +
      (closeL ? 0.18 : 0.04)
    );
    var stim = Math.min(0.99,
      (stims > 0 ? 1 : 0.04) * (0.88 * evaluateCurve('logistic', 1 - rHp, { steepness: 13.5, midpoint: 0.66 }) + 0.10)
    );

    var scores = {
      berserk_rush: Math.round(berserk * 10000) / 10000,
      ballistic_guard: Math.round(ballistic * 10000) / 10000,
      flank_ambush: Math.round(flank * 10000) / 10000,
      stim_inject: Math.round(stim * 10000) / 10000
    };

    var selected = 'ballistic_guard';
    var best = -1;
    for (var i = 0; i < STANCES.length; i++) {
      var sid = STANCES[i].id;
      if (scores[sid] > best) {
        best = scores[sid];
        selected = sid;
      }
    }

    var fsm = rHp <= 0 ? 'NEUTRALIZED' : (rHp <= 0.36 && stims > 0 ? 'DESPERATE' : (pHp <= 0.35 || heat >= 0.7 ? 'ENRAGED' : 'ENGAGED'));
    return { selectedStance: selected, scores: scores, fsmState: fsm };
  }

  /* ---------------- Deterministic Perception Guard Vision Cone ---------------- */
  function computeVisionCone(districtId, tsSec, noiseLevel) {
    var d = DISTRICTS[districtId] || DISTRICTS.pier_4;
    var noise = Math.max(0, Math.min(100, Number(noiseLevel) || 0));
    var tier = noise >= 70 ? 'HUNTED' : (noise >= 35 ? 'SUSPICIOUS' : 'CLEAR');
    var widen = tier === 'HUNTED' ? 16 : (tier === 'SUSPICIOUS' ? 8 : 0);
    var coneDeg = Math.min(110, d.visionAngleDeg + widen);

    var rawPhase = ((Math.max(0, tsSec) * d.sweepHz) % 1 + 1) % 1;
    var yawDeg = Math.sin(rawPhase * Math.PI * 2) * 90;

    var shrink = tier === 'HUNTED' ? 0.035 : (tier === 'SUSPICIOUS' ? 0.015 : 0);
    var s1 = 0.17 + shrink;
    var e1 = 0.33 - shrink;
    var s2 = 0.67 + shrink;
    var e2 = 0.83 - shrink;
    var inBlindSpot = (rawPhase >= s1 && rawPhase <= e1) || (rawPhase >= s2 && rawPhase <= e2);

    return {
      districtId: d.id,
      phase: rawPhase,
      yawDeg: yawDeg,
      coneDeg: coneDeg,
      sweepHz: d.sweepHz,
      inBlindSpot: inBlindSpot,
      threatTier: tier,
      windows: [[s1, e1], [s2, e2]]
    };
  }

  /* ---------------- Audio + 3D Stage Bridge Triggers ---------------- */
  function emitTacticalBridge(stageKind, stageAction, sfxCue, detail) {
    var payload = detail || {};
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try { window.ZoneEcs3D.triggerStageAction(stageKind, stageAction, payload); } catch (_) {}
    }
    if (window.ZoneAudioHaptics) {
      try {
        if (typeof window.ZoneAudioHaptics.play === 'function') {
          window.ZoneAudioHaptics.play(sfxCue, payload);
        } else if (typeof window.ZoneAudioHaptics.trigger === 'function') {
          window.ZoneAudioHaptics.trigger(sfxCue, payload);
        }
      } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('zone:tactical-event', { detail: { stage: stageKind, action: stageAction, cue: sfxCue, payload: payload } }));
      window.dispatchEvent(new CustomEvent('zone:audio-cue', { detail: { cue: sfxCue, stage: stageKind } }));
    } catch (_) {}
  }

  function syncPlayerBarsIfPresent(data) {
    if (!data || !data.player) return;
    if (typeof window.ZoneSyncHudBars === 'function') {
      try { window.ZoneSyncHudBars(data); } catch (_) {}
    }
    if (window.ZoneAscension && typeof window.ZoneAscension.syncHudBars === 'function') {
      try { window.ZoneAscension.syncHudBars(data.player); } catch (_) {}
    }
  }

  /* ---------------- Backend API Sync + Graceful Offline/Guest Fallback ---------------- */
  async function fetchTacticalState(force) {
    if (!force && (Date.now() - store.lastSyncAt) < 4000) return;
    store.lastSyncAt = Date.now();
    store.telemetry.apiCalls++;
    try {
      var res = await fetch('/api/v1/tactical?district=' + encodeURIComponent(store.district), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      var json = await res.json();
      applyServerPayload(json);
    } catch (_) {
      // Guest / static preview mode: deterministic client simulation stays active seamlessly.
    }
  }

  function applyServerPayload(json) {
    if (!json || typeof json !== 'object') return;
    var st = json.stealth;
    if (st && typeof st === 'object') {
      if (st.serverTimestamp) {
        store.serverClockOffsetSec = Number(st.serverTimestamp) - (Date.now() / 1000);
      }
      store.stealth.noiseLevel = Math.max(0, Math.min(100, Number(st.noiseLevel != null ? st.noiseLevel : store.stealth.noiseLevel)));
      store.stealth.threatTier = String(st.threatTier || store.stealth.threatTier);
      store.stealth.cleanStreak = Math.max(0, Number(st.cleanStreak || 0));
      var sRem = Math.max(0, Number(st.cooldownRemainingSec || 0));
      store.stealth.cooldownUntilSec = sRem > 0 ? (nowSecFloat() + sRem) : 0;
    }

    var enc = json.encounter;
    if (enc && typeof enc === 'object') {
      store.encounter.nemesisNameEn = String(enc.nemesisNameEn || store.encounter.nemesisNameEn);
      store.encounter.nemesisNameAr = String(enc.nemesisNameAr || store.encounter.nemesisNameAr);
      store.encounter.rivalHp = Math.max(0, Number(enc.rivalHp != null ? enc.rivalHp : store.encounter.rivalHp));
      store.encounter.rivalMaxHp = Math.max(1, Number(enc.rivalMaxHp != null ? enc.rivalMaxHp : store.encounter.rivalMaxHp));
      store.encounter.playerHp = Math.max(1, Number(enc.playerHp != null ? enc.playerHp : store.encounter.playerHp));
      store.encounter.playerMaxHp = Math.max(1, Number(enc.playerMaxHp != null ? enc.playerMaxHp : store.encounter.playerMaxHp));
      store.encounter.districtHeat = Math.max(0, Math.min(100, Number(enc.districtHeat != null ? enc.districtHeat : store.encounter.districtHeat)));
      store.encounter.weaponClass = String(enc.equippedWeaponClass || store.encounter.weaponClass);
      store.encounter.stimsRemaining = Math.max(0, Number(enc.stimsRemaining != null ? enc.stimsRemaining : store.encounter.stimsRemaining));
      store.encounter.comboChain = Math.max(0, Number(enc.comboChain || 0));
      store.encounter.turnCount = Math.max(0, Number(enc.turnCount || 0));
      store.encounter.fsmState = String(enc.fsmState || 'ENGAGED');
      store.encounter.btNode = String(enc.btNode || store.encounter.btNode);
      if (enc.enemyIntent && enc.enemyIntent.stanceId) {
        store.encounter.activeStance = String(enc.enemyIntent.stanceId);
      }
      if (enc.utilityScores && typeof enc.utilityScores === 'object') {
        store.encounter.scores = enc.utilityScores;
      }
      var mRem = Math.max(0, Number(enc.cooldownRemainingSec || 0));
      store.encounter.cooldownUntilSec = mRem > 0 ? (nowSecFloat() + mRem) : 0;
    }
    syncPlayerBarsIfPresent(json);
    renderActiveScreenMount();
  }

  async function executeStealthBreach(customOpts) {
    if (store.busy) return null;
    var now = nowSecFloat();
    if (now < store.stealth.cooldownUntilSec) return null;

    var approach = (customOpts && customOpts.approach) || store.approach || 'stealth';
    var cone = computeVisionCone(store.district, now, store.stealth.noiseLevel);
    var cue = (approach === 'stealth' && cone.inBlindSpot && cone.threatTier !== 'HUNTED') ? 'vault_tumbler' : 'stealth_alert';

    store.telemetry.breachesTriggered++;
    emitTacticalBridge('heist-breach', 'crack', cue, {
      district: store.district,
      approach: approach,
      inBlindSpot: cone.inBlindSpot
    });

    store.busy = true;
    renderActiveScreenMount();

    try {
      store.telemetry.apiCalls++;
      var res = await fetch('/api/v1/tactical/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'tactical.stealth_breach',
          district: store.district,
          approach: approach,
          clientPhaseTs: now
        })
      });

      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && data.result) {
        applyServerPayload(data);
        var r = data.result;
        store.stealth.feedback = {
          tone: r.cleanBreach ? 'sage' : (r.outcome === 'loud_forced_breach' ? 'gold' : 'crimson'),
          en: r.summaryEn,
          ar: r.summaryAr
        };
        if (r.cleanBreach) emitTacticalBridge('heist-breach', 'crack', 'cash_payout', r);
        return data;
      }
      if (res.status === 429 && data && data.retryAfter) {
        store.stealth.cooldownUntilSec = nowSecFloat() + Number(data.retryAfter);
        store.stealth.feedback = {
          tone: 'gold',
          en: 'Breach cooling down (' + data.retryAfter + 's remaining).',
          ar: 'الاختراق قيد التهدئة (' + data.retryAfter + ' ثانية متبقية).'
        };
        return data;
      }
    } catch (_) {
      // Fall through to deterministic client preview
    } finally {
      store.busy = false;
    }

    // Deterministic offline / guest preview fallback
    store.telemetry.fallbackPreviews++;
    store.stealth.cooldownUntilSec = now + 8;
    if (approach === 'stealth' && cone.inBlindSpot && cone.threatTier !== 'HUNTED') {
      var bonus = Math.min(35, 18 + Math.min(12, store.stealth.cleanStreak * 3));
      store.stealth.cleanStreak += 1;
      store.stealth.noiseLevel = Math.min(100, store.stealth.noiseLevel + 8);
      store.stealth.threatTier = computeVisionCone(store.district, now, store.stealth.noiseLevel).threatTier;
      store.stealth.feedback = {
        tone: 'sage',
        en: 'Ghost Breach in Blind Spot! +' + bonus + '% Stealth Bonus Window Verified.',
        ar: 'اختراق صامت في النقطة العمياء! تم تفعيل مكافأة تخفٍ +' + bonus + '%.'
      };
    } else if (approach === 'loud') {
      store.stealth.cleanStreak = 0;
      store.stealth.noiseLevel = Math.min(100, store.stealth.noiseLevel + 26);
      store.stealth.threatTier = computeVisionCone(store.district, now, store.stealth.noiseLevel).threatTier;
      store.stealth.feedback = {
        tone: 'gold',
        en: 'Loud Forced Breach! Vault cracked, acoustic noise rose to ' + store.stealth.noiseLevel + '/100.',
        ar: 'اقتحام صاخب! تم كسر الخزنة وارتفعت الضوضاء إلى ' + store.stealth.noiseLevel + '/100.'
      };
    } else {
      store.stealth.cleanStreak = 0;
      store.stealth.noiseLevel = Math.min(100, store.stealth.noiseLevel + 24);
      store.stealth.threatTier = computeVisionCone(store.district, now, store.stealth.noiseLevel).threatTier;
      store.stealth.feedback = {
        tone: 'crimson',
        en: 'Guard Vision Cone spotted movement! Wait for the green BLIND SPOT window.',
        ar: 'رصدك مخروط رؤية الحارس! انتظر وصول المؤشر إلى النقطة العمياء الخضراء.'
      };
    }
    renderActiveScreenMount();
    return { preview: true, stealth: store.stealth };
  }

  async function executeCounterManeuver(maneuverId) {
    if (store.busy) return null;
    var now = nowSecFloat();
    if (now < store.encounter.cooldownUntilSec) return null;

    var mSpec = null;
    for (var i = 0; i < MANEUVERS.length; i++) {
      if (MANEUVERS[i].id === maneuverId) { mSpec = MANEUVERS[i]; break; }
    }
    if (!mSpec) return null;

    store.telemetry.maneuversTriggered++;
    emitTacticalBridge('combat-arena', 'attack', mSpec.cue, {
      maneuver: mSpec.id,
      stanceFaced: store.encounter.activeStance
    });

    store.busy = true;
    renderActiveScreenMount();

    try {
      store.telemetry.apiCalls++;
      var res = await fetch('/api/v1/tactical/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'tactical.maneuver',
          maneuver: mSpec.id,
          district: store.district
        })
      });

      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && data.result) {
        applyServerPayload(data);
        var r = data.result;
        store.encounter.feedback = {
          tone: r.victory || r.perfectCounter ? 'sage' : 'gold',
          en: r.summaryEn,
          ar: r.summaryAr
        };
        renderActiveScreenMount();
        return data;
      }
      if (res.status === 429 && data && data.retryAfter) {
        store.encounter.cooldownUntilSec = nowSecFloat() + Number(data.retryAfter);
        store.encounter.feedback = {
          tone: 'gold',
          en: 'Maneuver recovering (' + data.retryAfter + 's).',
          ar: 'استعادة التوازن التكتيكي (' + data.retryAfter + ' ثانية).'
        };
        renderActiveScreenMount();
        return data;
      }
    } catch (_) {
      // Fall through to deterministic Utility AI client preview
    } finally {
      store.busy = false;
    }

    // Deterministic Utility AI client preview fallback
    store.telemetry.fallbackPreviews++;
    var faced = store.encounter.activeStance;
    var perfect = mSpec.vs === faced;
    store.encounter.cooldownUntilSec = now + 4;
    store.encounter.turnCount += 1;

    if (perfect) {
      store.encounter.comboChain += 1;
      var critDmg = 52 + store.encounter.comboChain * 8;
      store.encounter.rivalHp = Math.max(0, store.encounter.rivalHp - critDmg);
      if (faced === 'stim_inject' && store.encounter.stimsRemaining > 0) {
        store.encounter.stimsRemaining -= 1;
      }
      store.encounter.feedback = {
        tone: 'sage',
        en: 'PERFECT COUNTER (x' + store.encounter.comboChain + ')! ' + mSpec.en + ' crushed ' + faced.replace('_', ' ') + ' (-' + critDmg + ' HP).',
        ar: 'رد تكتيكي مثالي (x' + store.encounter.comboChain + ')! حركة «' + mSpec.ar + '» كسرت خطة الخصم (-' + critDmg + ' صحة).'
      };
    } else {
      store.encounter.comboChain = 0;
      var stdDmg = 24;
      var heal = (faced === 'stim_inject' && store.encounter.stimsRemaining > 0) ? 45 : 0;
      if (heal > 0) store.encounter.stimsRemaining -= 1;
      store.encounter.rivalHp = Math.max(0, Math.min(store.encounter.rivalMaxHp, store.encounter.rivalHp - stdDmg + heal));
      store.encounter.playerHp = Math.max(25, store.encounter.playerHp - 18);
      store.encounter.feedback = {
        tone: 'gold',
        en: 'Glancing exchange: ' + mSpec.en + ' (-' + stdDmg + ' Rival HP' + (heal ? ', Rival healed +' + heal : '') + ').',
        ar: 'اشتباك جانبي: «' + mSpec.ar + '» (-' + stdDmg + ' صحة الخصم' + (heal ? '، استعاد الخصم +' + heal : '') + ').'
      };
    }

    if (store.encounter.rivalHp <= 0) {
      store.encounter.rivalHp = store.encounter.rivalMaxHp;
      store.encounter.stimsRemaining = 2;
      store.encounter.feedback = {
        tone: 'sage',
        en: 'RIVAL NEUTRALIZED! Next Syndicate challenger entered the arena.',
        ar: 'تم تحييد الخصم بنجاح! دخل متحدٍ جديد إلى الساحة القتالية.'
      };
    }

    var nextEval = scoreUtilityStances({
      playerHpPct: store.encounter.playerHp / Math.max(1, store.encounter.playerMaxHp),
      rivalHpPct: store.encounter.rivalHp / Math.max(1, store.encounter.rivalMaxHp),
      weaponClass: store.encounter.weaponClass,
      districtHeat: store.encounter.districtHeat,
      stimsRemaining: store.encounter.stimsRemaining
    });
    store.encounter.activeStance = nextEval.selectedStance;
    store.encounter.scores = nextEval.scores;
    store.encounter.fsmState = nextEval.fsmState;
    renderActiveScreenMount();
    return { preview: true, encounter: store.encounter };
  }

  /* ---------------- Renderers (Bilingual EN + AR RTL Watercolor Cards) ---------------- */
  function renderStealthCardHtml() {
    var ar = isAr();
    var now = nowSecFloat();
    var cone = computeVisionCone(store.district, now, store.stealth.noiseLevel);
    var cdRem = Math.max(0, Math.ceil(store.stealth.cooldownUntilSec - now));
    var dist = DISTRICTS[store.district] || DISTRICTS.pier_4;

    var tierTone = cone.threatTier === 'HUNTED' ? 'crimson' : (cone.threatTier === 'SUSPICIOUS' ? 'gold' : 'sage');
    var tierLabel = ar
      ? (cone.threatTier === 'HUNTED' ? 'مطارد' : (cone.threatTier === 'SUSPICIOUS' ? 'اشتباه' : 'آمن'))
      : cone.threatTier;

    var windowTone = cone.inBlindSpot && cone.threatTier !== 'HUNTED' ? 'sage' : 'gold';
    var windowText = cone.inBlindSpot && cone.threatTier !== 'HUNTED'
      ? (ar ? 'النقطة العمياء متاحة · +15%..+35%' : 'BLIND SPOT OPEN · +15%..+35%')
      : (ar ? 'الحارس يمشّط القطاع' : 'GUARD CONE SWEEPING');

    var btnLabel = cdRem > 0
      ? (ar ? ('تهدئة الاختراق (' + cdRem + 'ث)') : ('Cooldown (' + cdRem + 's)'))
      : (store.approach === 'stealth'
          ? (ar ? 'نفّذ اختراق التخفي (3 جرأة)' : 'Execute Stealth Breach (3N)')
          : (ar ? 'نفّذ اقتحاماً صاخباً (3 جرأة)' : 'Execute Loud Breach (3N)'));

    var cursorPct = Math.round(cone.phase * 1000) / 10;
    var w1Left = Math.round(cone.windows[0][0] * 1000) / 10;
    var w1Width = Math.round((cone.windows[0][1] - cone.windows[0][0]) * 1000) / 10;
    var w2Left = Math.round(cone.windows[1][0] * 1000) / 10;
    var w2Width = Math.round((cone.windows[1][1] - cone.windows[1][0]) * 1000) / 10;

    var fbHtml = '';
    if (store.stealth.feedback) {
      fbHtml =
        '<div class="ztd-feedback" role="status" data-tone="' + esc(store.stealth.feedback.tone) + '">' +
          '<span>' + esc(ar ? store.stealth.feedback.ar : store.stealth.feedback.en) + '</span>' +
        '</div>';
    }

    return (
      '<div class="ztd-head">' +
        '<div class="ztd-title-wrap">' +
          '<span class="ztd-crest" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12C5.2 6.5 9.2 4.5 12 4.5C14.8 4.5 18.8 6.5 22 12C18.8 17.5 14.8 19.5 12 19.5C9.2 19.5 5.2 17.5 2 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="#5c8e3e" stroke="currentColor" stroke-width="1.5"/></svg>' +
          '</span>' +
          '<div>' +
            '<h3 class="ztd-title">' + esc(ar ? 'رادار مخروط الرؤية والضوضاء الصوتية' : 'Perception Vision-Cone & Acoustic Stealth') + '</h3>' +
            '<p class="ztd-sub">' + esc(ar ? (dist.ar + ' · زاوية الرؤية ') : (dist.en + ' · Cone ')) + '<bdi>' + Math.round(cone.coneDeg) + '°</bdi></p>' +
          '</div>' +
        '</div>' +
        '<div class="ztd-badges">' +
          '<span class="ztd-pill" data-ztd-blindspot-pill="1" data-tone="' + windowTone + '"><span class="ztd-dot"></span><span data-ztd-blindspot-txt="1">' + esc(windowText) + '</span></span>' +
          '<span class="ztd-pill" data-tone="' + tierTone + '">' + esc(ar ? 'التهديد: ' : 'Threat: ') + '<bdi>' + esc(tierLabel) + '</bdi></span>' +
        '</div>' +
      '</div>' +
      '<div class="ztd-stealth-grid">' +
        '<div class="ztd-cone-dial" aria-hidden="true">' +
          '<svg class="ztd-cone-svg" viewBox="0 0 84 64">' +
            '<circle cx="42" cy="54" r="44" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-dasharray="3 3"/>' +
            '<g data-ztd-svg-cone="1" transform="translate(42,54) rotate(' + Math.round(cone.yawDeg * 0.55) + ')">' +
              '<path d="M0,0 L-22,-46 A48,48 0 0,1 22,-46 Z" fill="' + (cone.inBlindSpot ? 'rgba(109,153,73,0.34)' : 'rgba(217,154,56,0.38)') + '" stroke="currentColor" stroke-width="1.3"/>' +
            '</g>' +
            '<circle cx="42" cy="54" r="4" fill="#d99a38" stroke="currentColor" stroke-width="1.4"/>' +
          '</svg>' +
        '</div>' +
        '<div class="ztd-stealth-meters">' +
          '<div class="ztd-sweep-track" title="BLIND SPOT Windows">' +
            '<div class="ztd-blind-zone" style="left:' + w1Left + '%;width:' + w1Width + '%"></div>' +
            '<div class="ztd-blind-zone" style="left:' + w2Left + '%;width:' + w2Width + '%"></div>' +
            '<div class="ztd-sweep-cursor' + (cone.inBlindSpot ? ' is-blindspot' : '') + '" data-ztd-cursor="1" style="left:' + cursorPct + '%"></div>' +
          '</div>' +
          '<div class="ztd-meter-row">' +
            '<span>' + esc(ar ? 'الضوضاء الصوتية' : 'Acoustic Noise') + ': <bdi>' + store.stealth.noiseLevel + '/100 dB</bdi></span>' +
            '<span>' + esc(ar ? 'سلسلة نظيفة' : 'Clean Streak') + ': <bdi>x' + store.stealth.cleanStreak + '</bdi></span>' +
          '</div>' +
          '<div class="ztd-noise-bar"><div class="ztd-noise-fill" style="width:' + store.stealth.noiseLevel + '%"></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="ztd-stealth-actions">' +
        '<div class="ztd-mode-switch" role="group" aria-label="' + esc(ar ? 'أسلوب الاختراق' : 'Breach Approach') + '">' +
          '<button type="button" class="ztd-mode-btn" data-ztd-act="set-approach" data-approach="stealth" aria-pressed="' + (store.approach === 'stealth' ? 'true' : 'false') + '">' + esc(ar ? 'صامت' : 'Stealth') + '</button>' +
          '<button type="button" class="ztd-mode-btn" data-ztd-act="set-approach" data-approach="loud" aria-pressed="' + (store.approach === 'loud' ? 'true' : 'false') + '">' + esc(ar ? 'صاخب' : 'Loud') + '</button>' +
        '</div>' +
        '<button type="button" class="ztd-primary-btn" data-ztd-act="stealth-breach" data-ready="' + (cone.inBlindSpot ? 'blindspot' : 'sweep') + '"' + ((store.busy || cdRem > 0) ? ' disabled' : '') + '>' +
          esc(btnLabel) +
        '</button>' +
      '</div>' +
      fbHtml
    );
  }

  function renderCombatDeckHtml() {
    var ar = isAr();
    var now = nowSecFloat();
    var cdRem = Math.max(0, Math.ceil(store.encounter.cooldownUntilSec - now));
    var enc = store.encounter;

    var activeSpec = STANCES[1];
    for (var s = 0; s < STANCES.length; s++) {
      if (STANCES[s].id === enc.activeStance) { activeSpec = STANCES[s]; break; }
    }

    var youPct = Math.max(0, Math.min(100, Math.round((enc.playerHp / Math.max(1, enc.playerMaxHp)) * 100)));
    var rivPct = Math.max(0, Math.min(100, Math.round((enc.rivalHp / Math.max(1, enc.rivalMaxHp)) * 100)));

    var barsHtml = '<div class="ztd-utility-bars">';
    for (var i = 0; i < STANCES.length; i++) {
      var st = STANCES[i];
      var sc = Math.round(clamp01(enc.scores[st.id] || 0) * 100);
      var sel = st.id === activeSpec.id;
      barsHtml +=
        '<div class="ztd-u-item' + (sel ? ' is-selected' : '') + '" data-ztd-stance-score="' + st.id + '">' +
          '<div class="ztd-u-head"><span class="ztd-u-label">' + esc(ar ? st.ar : st.en) + '</span><bdi>' + sc + '%</bdi></div>' +
          '<div class="ztd-u-track"><div class="ztd-u-fill" style="width:' + sc + '%"></div></div>' +
        '</div>';
    }
    barsHtml += '</div>';

    var deckHtml = '<div class="ztd-maneuver-grid">';
    for (var m = 0; m < MANEUVERS.length; m++) {
      var mv = MANEUVERS[m];
      var rec = mv.id === activeSpec.counter;
      deckHtml +=
        '<button type="button" class="ztd-maneuver-btn' + (rec ? ' is-recommended' : '') + '" data-ztd-act="maneuver" data-maneuver="' + mv.id + '"' + ((store.busy || cdRem > 0) ? ' disabled' : '') + '>' +
          '<span class="ztd-m-title">' + (rec ? '★ ' : '') + esc(ar ? mv.ar : mv.en) + '</span>' +
          '<span class="ztd-m-meta">' + esc(ar ? mv.vsAr : mv.vsEn) + ' · <bdi>5E</bdi></span>' +
        '</button>';
    }
    deckHtml += '</div>';

    var fbHtml = '';
    if (enc.feedback) {
      fbHtml =
        '<div class="ztd-feedback" role="status" data-tone="' + esc(enc.feedback.tone) + '">' +
          '<span>' + esc(ar ? enc.feedback.ar : enc.feedback.en) + '</span>' +
        '</div>';
    }

    return (
      '<div class="ztd-head">' +
        '<div class="ztd-title-wrap">' +
          '<span class="ztd-crest" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 12H15.5M12 8.5V15.5" stroke="#d99a38" stroke-width="2" stroke-linecap="round"/></svg>' +
          '</span>' +
          '<div>' +
            '<h3 class="ztd-title">' + esc(ar ? 'موجّه الذكاء التكتيكي والمناورات المضادة' : 'Utility AI Enemy Intent & Counter Deck') + '</h3>' +
            '<p class="ztd-sub">' + esc(ar ? enc.nemesisNameAr : enc.nemesisNameEn) + ' · <bdi>' + esc(enc.fsmState) + '</bdi></p>' +
          '</div>' +
        '</div>' +
        '<div class="ztd-badges">' +
          '<span class="ztd-pill" data-tone="crimson">' + esc(ar ? 'نية الخصم: ' : 'Intent: ') + '<strong>' + esc(ar ? activeSpec.ar : activeSpec.en) + '</strong></span>' +
          (enc.comboChain > 0 ? ('<span class="ztd-pill" data-tone="gold">Combo <bdi>x' + enc.comboChain + '</bdi></span>') : '') +
          (cdRem > 0 ? ('<span class="ztd-pill" data-tone="blue"><bdi>' + cdRem + 's</bdi></span>') : '') +
        '</div>' +
      '</div>' +
      '<div class="ztd-intent-callout">' +
        '<div class="ztd-intent-top">' +
          '<span class="ztd-intent-name">' + esc(ar ? activeSpec.teleAr : activeSpec.teleEn) + '</span>' +
          '<span class="ztd-pill" data-tone="sage">' + esc(ar ? 'المضاد الأمثل: ' : 'Counter: ') + esc(ar ? MANEUVERS.find(function (x) { return x.id === activeSpec.counter; }).ar : MANEUVERS.find(function (x) { return x.id === activeSpec.counter; }).en) + '</span>' +
        '</div>' +
        '<div class="ztd-hp-strip">' +
          '<div class="ztd-hp-cell"><span>' + esc(ar ? 'صحتك' : 'Your HP') + ': <bdi>' + youPct + '%</bdi></span><div class="ztd-hp-track"><div class="ztd-hp-fill-you" style="width:' + youPct + '%"></div></div></div>' +
          '<div class="ztd-hp-cell"><span>' + esc(ar ? 'صحة الخصم' : 'Rival HP') + ': <bdi>' + rivPct + '%</bdi> · Stims: <bdi>' + enc.stimsRemaining + '</bdi></span><div class="ztd-hp-track"><div class="ztd-hp-fill-rival" style="width:' + rivPct + '%"></div></div></div>' +
        '</div>' +
      '</div>' +
      barsHtml +
      deckHtml +
      fbHtml
    );
  }

  /* ---------------- 60fps Lightweight Sweep Indicator Loop (Crimes Only) ---------------- */
  function tickLiveStealthIndicator() {
    store.rafId = 0;
    var bar = document.getElementById('ztd-stealth-bar');
    if (!bar || !bar.isConnected) return;

    var ar = isAr();
    var now = nowSecFloat();
    var cone = computeVisionCone(store.district, now, store.stealth.noiseLevel);

    var cursor = bar.querySelector('[data-ztd-cursor="1"]');
    if (cursor) {
      cursor.style.left = (Math.round(cone.phase * 1000) / 10) + '%';
      if (cone.inBlindSpot) cursor.classList.add('is-blindspot');
      else cursor.classList.remove('is-blindspot');
    }

    var svgCone = bar.querySelector('[data-ztd-svg-cone="1"]');
    if (svgCone && !isReducedMotion()) {
      svgCone.setAttribute('transform', 'translate(42,54) rotate(' + Math.round(cone.yawDeg * 0.55) + ')');
      var path = svgCone.querySelector('path');
      if (path) {
        path.setAttribute('fill', cone.inBlindSpot ? 'rgba(109,153,73,0.36)' : 'rgba(217,154,56,0.40)');
      }
    }

    var pill = bar.querySelector('[data-ztd-blindspot-pill="1"]');
    var pillTxt = bar.querySelector('[data-ztd-blindspot-txt="1"]');
    if (pill && pillTxt) {
      var open = cone.inBlindSpot && cone.threatTier !== 'HUNTED';
      pill.setAttribute('data-tone', open ? 'sage' : 'gold');
      var nextTxt = open
        ? (ar ? 'النقطة العمياء متاحة · +15%..+35%' : 'BLIND SPOT OPEN · +15%..+35%')
        : (ar ? 'الحارس يمشّط القطاع' : 'GUARD CONE SWEEPING');
      if (pillTxt.textContent !== nextTxt) pillTxt.textContent = nextTxt;
    }

    var btn = bar.querySelector('[data-ztd-act="stealth-breach"]');
    if (btn) {
      btn.setAttribute('data-ready', cone.inBlindSpot ? 'blindspot' : 'sweep');
      var cdRem = Math.max(0, Math.ceil(store.stealth.cooldownUntilSec - now));
      if (cdRem === 0 && btn.disabled && !store.busy) {
        renderActiveScreenMount();
        return;
      }
    }

    if (!isReducedMotion() && typeof window.requestAnimationFrame === 'function') {
      store.rafId = window.requestAnimationFrame(tickLiveStealthIndicator);
    }
  }

  /* ---------------- Route-Scoped DOM Mounts ---------------- */
  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    return main ? String(main.getAttribute('data-zone-screen') || 'home').toLowerCase() : '';
  }

  function removeIfPresent(id) {
    var el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  function renderActiveScreenMount() {
    if (document.querySelector && document.querySelector('x-dc')) return;
    var main = document.getElementById('zone-main');
    if (!main) return;

    var screen = getActiveScreen();

    // 1. Crimes Screen -> Perception Vision-Cone & Acoustic Stealth Bar
    if (screen === 'crimes') {
      removeIfPresent('ztd-combat-deck');
      var heistStage = main.querySelector('[data-z3d-stage="heist-breach"]');
      var bar = document.getElementById('ztd-stealth-bar');
      if (!bar) {
        bar = document.createElement('section');
        bar.id = 'ztd-stealth-bar';
        bar.className = 'ztd-scope ztd-stealth-card';
        bar.setAttribute('data-ztd-mounted', 'crimes');
      }
      if (heistStage && heistStage.parentElement && heistStage.nextElementSibling !== bar) {
        heistStage.insertAdjacentElement('afterend', bar);
      } else if (!bar.parentElement) {
        main.insertBefore(bar, main.firstChild || null);
      }
      bar.innerHTML = renderStealthCardHtml();
      if (!store.rafId && !isReducedMotion() && typeof window.requestAnimationFrame === 'function') {
        store.rafId = window.requestAnimationFrame(tickLiveStealthIndicator);
      }
      return;
    }

    removeIfPresent('ztd-stealth-bar');

    // 2. Attack / Boss / PvP Arena Screens -> Utility AI Enemy Intent & Counter-Maneuver Deck
    var combatStage = main.querySelector('[data-z3d-stage="combat-arena"]');
    if (screen === 'attack' || ((screen === 'missions' || screen === 'faction') && combatStage)) {
      var deck = document.getElementById('ztd-combat-deck');
      if (!deck) {
        deck = document.createElement('section');
        deck.id = 'ztd-combat-deck';
        deck.className = 'ztd-scope ztd-combat-card';
        deck.setAttribute('data-ztd-mounted', screen);
      }
      deck.setAttribute('data-ztd-mounted', screen);
      var anchorAfter = combatStage || document.getElementById('ztl-attack-3d-stage');
      if (anchorAfter && anchorAfter.parentElement) {
        if (anchorAfter.nextElementSibling !== deck) {
          anchorAfter.insertAdjacentElement('afterend', deck);
        }
      } else if (!deck.parentElement) {
        var brawl = document.getElementById('zig-brawl-hud') || document.getElementById('zone-combat-frame');
        if (brawl && brawl.parentElement === main) {
          main.insertBefore(deck, brawl);
        } else {
          main.appendChild(deck);
        }
      }
      deck.innerHTML = renderCombatDeckHtml();
      return;
    }

    removeIfPresent('ztd-combat-deck');
  }

  /* ---------------- Delegated Click Listener & MutationObserver ---------------- */
  document.addEventListener('click', function (ev) {
    var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-ztd-act]') : null;
    if (!target || target.disabled) return;

    var act = target.getAttribute('data-ztd-act');
    if (act === 'set-approach') {
      ev.preventDefault();
      var nextApp = target.getAttribute('data-approach') === 'loud' ? 'loud' : 'stealth';
      store.approach = nextApp;
      emitTacticalBridge('heist-breach', 'pulse', 'ui_nav', { approach: nextApp });
      renderActiveScreenMount();
    } else if (act === 'stealth-breach') {
      ev.preventDefault();
      executeStealthBreach();
    } else if (act === 'maneuver') {
      ev.preventDefault();
      var mv = target.getAttribute('data-maneuver') || '';
      executeCounterManeuver(mv);
    }
  });

  var syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    var run = function () {
      syncScheduled = false;
      var scr = getActiveScreen();
      if (scr === 'crimes' || scr === 'attack' || scr === 'missions' || scr === 'faction') {
        fetchTacticalState(false);
      }
      renderActiveScreenMount();
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function boot() {
    var initEval = scoreUtilityStances({
      playerHpPct: 1,
      rivalHpPct: 1,
      weaponClass: store.encounter.weaponClass,
      districtHeat: store.encounter.districtHeat,
      stimsRemaining: store.encounter.stimsRemaining
    });
    store.encounter.activeStance = initEval.selectedStance;
    store.encounter.scores = initEval.scores;

    window.addEventListener('zone:render', scheduleSync);

    if (typeof MutationObserver === 'function' && document.documentElement) {
      var obs = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.target && r.target.closest && r.target.closest('.ztd-scope')) continue;
          scheduleSync();
          return;
        }
      });
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-zone-screen', 'data-theme', 'dir', 'lang', 'data-zone-reduced-motion', 'data-zone-contrast']
      });
    }

    scheduleSync();
  }

  window.ZoneTacticalDirector = {
    refresh: function () { return fetchTacticalState(true); },
    render: renderActiveScreenMount,
    executeStealthBreach: executeStealthBreach,
    executeCounterManeuver: executeCounterManeuver,
    evaluateCurve: evaluateCurve,
    scoreUtilityStances: scoreUtilityStances,
    computeVisionCone: computeVisionCone,
    getState: function () {
      return {
        district: store.district,
        approach: store.approach,
        stealth: store.stealth,
        encounter: store.encounter
      };
    },
    diagnostics: function () {
      return {
        ready: true,
        screen: getActiveScreen(),
        stealthMounted: Boolean(document.getElementById('ztd-stealth-bar')),
        combatMounted: Boolean(document.getElementById('ztd-combat-deck')),
        telemetry: store.telemetry
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

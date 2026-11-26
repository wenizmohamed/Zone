/* ==========================================================================
 * ZONE v159 - TRACK 16: 4-STAGE EVOLVING 3D SYNDICATE COMPANION SYSTEM UI
 * Exclusive Ownership: @companion-pet-3d (assets/ui/zone-companion-3d.js)
 * Exposes: window.ZoneCompanion3D
 * Mounts ONLY on:
 *   - screen === 'dossier':    #zcp-dossier-panel
 *   - screen === 'properties': #zcp-properties-panel
 * Zero mounts on 'home' or any other route. Fiber-Safe (skips inside <x-dc>).
 * Zero extra WebGL contexts (renders articulated 3D/2.5D isometric models on 2D Canvas).
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root || globalThis);
  } else {
    factory(root || (typeof window !== 'undefined' ? window : globalThis));
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root) {
  'use strict';

  if (root && root.__zoneCompanion3DBooted && root.ZoneCompanion3D) {
    return root.ZoneCompanion3D;
  }
  if (root) {
    root.__zoneCompanion3DBooted = true;
  }

  var TRAIN_ENERGY_COST = 5;
  var TRAIN_BASE_XP = 95;
  var PATROL_COOLDOWN_SEC = 180;

  var EVOLUTION_STAGES = [
    {
      stage: 1,
      roman: 'I',
      code: 'prototype_pup',
      nameEn: 'Stage I: Prototype/Pup',
      nameAr: 'المرحلة ١: نموذج أولي / جرو',
      shortEn: 'Stage I · Prototype',
      shortAr: 'المرحلة ١ · أولي',
      minXp: 0,
      nextXp: 100,
      scaleMultiplier: 1.00
    },
    {
      stage: 2,
      roman: 'II',
      code: 'street_scout',
      nameEn: 'Stage II: Street Scout',
      nameAr: 'المرحلة ٢: كشّاف الشوارع',
      shortEn: 'Stage II · Street Scout',
      shortAr: 'المرحلة ٢ · كشّاف',
      minXp: 100,
      nextXp: 300,
      scaleMultiplier: 1.18
    },
    {
      stage: 3,
      roman: 'III',
      code: 'tactical_vanguard',
      nameEn: 'Stage III: Tactical Vanguard',
      nameAr: 'المرحلة ٣: طليعة تكتيكية',
      shortEn: 'Stage III · Vanguard',
      shortAr: 'المرحلة ٣ · طليعة',
      minXp: 300,
      nextXp: 600,
      scaleMultiplier: 1.35
    },
    {
      stage: 4,
      roman: 'IV',
      code: 'sovereign_apex',
      nameEn: 'Stage IV: Sovereign Apex',
      nameAr: 'المرحلة ٤: الذروة السيادية',
      shortEn: 'Stage IV · Sovereign Apex',
      shortAr: 'المرحلة ٤ · الذروة',
      minXp: 600,
      nextXp: null,
      scaleMultiplier: 1.52
    }
  ];

  var COMPANION_UNITS = [
    {
      id: 'recon_drone',
      nameEn: 'Aegis-IX Recon Drone',
      nameAr: 'درون الاستطلاع إيجيس-٩',
      defaultCallsign: 'AEGIS-09',
      tone: 'sage',
      specialtyEn: '+Stealth & Vision-Cone Blind-Spot',
      specialtyAr: '+التخفي وتوسيع النقطة العمياء لمخروط الرؤية',
      stageBonuses: {
        1: { stealthPct: 8, visionBlindSpotDeg: 10, noiseReductionDb: 3 },
        2: { stealthPct: 13, visionBlindSpotDeg: 16, noiseReductionDb: 5 },
        3: { stealthPct: 19, visionBlindSpotDeg: 23, noiseReductionDb: 8 },
        4: { stealthPct: 26, visionBlindSpotDeg: 32, noiseReductionDb: 12 }
      },
      lootEn: 'Encrypted Sector Telemetry',
      lootAr: 'قياسات قطاع مشفّرة',
      primaryColor: '#5c8e3e',
      accentColor: '#a6f292'
    },
    {
      id: 'armored_k9',
      nameEn: 'Cerberus-K9 Cyber Hound',
      nameAr: 'الكلب المصفّح سيربيروس-K9',
      defaultCallsign: 'K9-VANGUARD',
      tone: 'crimson',
      specialtyEn: '+Combat Damage & Counter-Bleed',
      specialtyAr: '+ضرر الاشتباك ونزيف الرد المرتد',
      stageBonuses: {
        1: { combatDamagePct: 7, counterBleedPct: 6, armorMitigationPct: 4 },
        2: { combatDamagePct: 12, counterBleedPct: 10, armorMitigationPct: 7 },
        3: { combatDamagePct: 18, counterBleedPct: 15, armorMitigationPct: 11 },
        4: { combatDamagePct: 25, counterBleedPct: 22, armorMitigationPct: 16 }
      },
      lootEn: 'Confiscated Enforcer Cache',
      lootAr: 'مخبأ عتاد منفّذين مصادَر',
      primaryColor: '#c44933',
      accentColor: '#ff9c8a'
    },
    {
      id: 'smuggler_falcon',
      nameEn: 'Horus-V Smuggler Falcon',
      nameAr: 'صقر التهريب حورس-٥',
      defaultCallsign: 'HORUS-V',
      tone: 'gold',
      specialtyEn: '+Travel Speed & Contraband Capacity',
      specialtyAr: '+سرعة التنقل وسعة المهربات',
      stageBonuses: {
        1: { travelSpeedPct: 8, contrabandCapacity: 2, evasionPct: 5 },
        2: { travelSpeedPct: 13, contrabandCapacity: 4, evasionPct: 9 },
        3: { travelSpeedPct: 19, contrabandCapacity: 7, evasionPct: 13 },
        4: { travelSpeedPct: 27, contrabandCapacity: 11, evasionPct: 19 }
      },
      lootEn: 'Sealed Contraband Airdrop Pod',
      lootAr: 'كبسولة إنزال مهربات مختومة',
      primaryColor: '#d99a38',
      accentColor: '#f4cf78'
    },
    {
      id: 'cyber_raven',
      nameEn: 'Morrigan-X Cyber-Raven',
      nameAr: 'الغراب السيبراني مورغان-X',
      defaultCallsign: 'MORRIGAN-X',
      tone: 'blue',
      specialtyEn: '+Bazaar Fee Reduction & Vault Hack',
      specialtyAr: '+خفض عمولة البازار واختراق الخزائن',
      stageBonuses: {
        1: { bazaarFeeReductionPct: 6, vaultHackPct: 8, mugYieldPct: 5 },
        2: { bazaarFeeReductionPct: 10, vaultHackPct: 13, mugYieldPct: 9 },
        3: { bazaarFeeReductionPct: 15, vaultHackPct: 19, mugYieldPct: 14 },
        4: { bazaarFeeReductionPct: 22, vaultHackPct: 27, mugYieldPct: 20 }
      },
      lootEn: 'Siphoned Bazaar Brokerage Ledger',
      lootAr: 'دفتر وساطة بازار مسحوب',
      primaryColor: '#4f85c9',
      accentColor: '#93c5fd'
    }
  ];

  function createInitialUnitsState() {
    var map = {};
    for (var i = 0; i < COMPANION_UNITS.length; i++) {
      var u = COMPANION_UNITS[i];
      map[u.id] = {
        unitId: u.id,
        adopted: u.id === 'recon_drone',
        isActive: u.id === 'recon_drone',
        callsign: u.defaultCallsign,
        stage: 1,
        level: 1,
        guardianTitle: 'Spark',
        evolutionXp: 0,
        bond: 45,
        readiness: 90,
        careScore: 55,
        patrolCount: 0,
        drillCount: 0,
        patrolCooldownUntil: 0
      };
    }
    return map;
  }

  var store = {
    busy: false,
    lastSyncAt: 0,
    activeUnitId: 'recon_drone',
    units: createInitialUnitsState(),
    serverData: null,
    feedback: null,
    turntable: {
      yaw: 0.45,
      pitch: 0.36,
      phase: 0,
      lookX: 0,
      lookY: 0,
      petBounce: 0,
      dragging: false,
      lastClientX: 0,
      rafId: 0,
      lastFrameTs: 0,
      framesRendered: 0
    },
    telemetry: {
      apiCalls: 0,
      fallbackActions: 0,
      feedsTriggered: 0,
      drillsTriggered: 0,
      patrolsDispatched: 0,
      stageEvolutions: 0,
      turntablePets: 0
    }
  };

  function getDoc() {
    return typeof document !== 'undefined' ? document : null;
  }

  function isAr() {
    var doc = getDoc();
    if (!doc || !doc.documentElement) return false;
    var html = doc.documentElement;
    return html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function isReducedMotion() {
    var doc = getDoc();
    if (!doc || !doc.documentElement) return false;
    var html = doc.documentElement;
    return Boolean(html.dataset && html.dataset.zoneReducedMotion === 'true') ||
      (typeof html.getAttribute === 'function' && html.getAttribute('data-zone-reduced-motion') === 'true');
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function findUnitSpec(unitId) {
    for (var i = 0; i < COMPANION_UNITS.length; i++) {
      if (COMPANION_UNITS[i].id === unitId) return COMPANION_UNITS[i];
    }
    return COMPANION_UNITS[0];
  }

  function resolveStageForXp(xpVal) {
    var xp = Math.max(0, Number(xpVal) || 0);
    var st = EVOLUTION_STAGES[0];
    for (var i = 0; i < EVOLUTION_STAGES.length; i++) {
      if (xp >= EVOLUTION_STAGES[i].minXp) st = EVOLUTION_STAGES[i];
    }
    var progressPct = 100;
    var level = 40 + Math.min(10, Math.floor((xp - 600) / 40));
    if (st.nextXp != null) {
      var span = Math.max(1, st.nextXp - st.minXp);
      var into = Math.max(0, xp - st.minXp);
      progressPct = Math.min(100, Math.round((into / span) * 100));
      var baseLvl = st.stage === 1 ? 1 : (st.stage === 2 ? 11 : 25);
      var maxLvl = st.stage === 1 ? 10 : (st.stage === 2 ? 24 : 39);
      level = baseLvl + Math.min(maxLvl - baseLvl, Math.floor((into / span) * (maxLvl - baseLvl + 1)));
    }
    var title = 'Spark';
    if (level >= 45) title = 'Transcendent';
    else if (level >= 35) title = 'Oracle';
    else if (level >= 25) title = 'Collaborator';
    else if (level >= 15) title = 'Guide';
    else if (level >= 10) title = 'Companion';
    else if (level >= 5) title = 'Apprentice';

    return {
      stage: st.stage,
      roman: st.roman,
      code: st.code,
      nameEn: st.nameEn,
      nameAr: st.nameAr,
      shortEn: st.shortEn,
      shortAr: st.shortAr,
      minXp: st.minXp,
      nextXp: st.nextXp,
      progressPct: progressPct,
      level: Math.max(1, level),
      guardianTitle: title,
      scaleMultiplier: st.scaleMultiplier
    };
  }

  function computeUnitModifiers(unitId, stage, bond, readiness) {
    var spec = findUnitSpec(unitId);
    var st = Math.max(1, Math.min(4, Number(stage) || 1));
    var base = spec.stageBonuses[st] || spec.stageBonuses[1];
    var factor = 1.0;
    if (Number(bond) >= 75) factor += 0.08;
    if (Number(readiness) >= 60) factor += 0.07;
    else if (Number(readiness) < 20) factor -= 0.15;

    var out = {};
    for (var k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) {
        out[k] = Math.max(1, Math.round(base[k] * factor));
      }
    }
    return out;
  }

  function emitCompanionBridge(action, sfxCue, detail) {
    var payload = detail || {};
    var screen = getActiveScreen();
    var stageKind = screen === 'properties' ? 'safehouse-empire' : 'character-turntable';
    if (root && root.ZoneEcs3D && typeof root.ZoneEcs3D.triggerStageAction === 'function') {
      try { root.ZoneEcs3D.triggerStageAction(stageKind, action || 'pulse', payload); } catch (_) {}
    }
    if (root && root.ZoneAudioHaptics) {
      try {
        if (typeof root.ZoneAudioHaptics.play === 'function') {
          root.ZoneAudioHaptics.play(sfxCue, payload);
        } else if (typeof root.ZoneAudioHaptics.trigger === 'function') {
          root.ZoneAudioHaptics.trigger(sfxCue, payload);
        }
      } catch (_) {}
    }
    try {
      if (root && typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
        root.dispatchEvent(new root.CustomEvent('zone:companion-event', {
          detail: { stage: stageKind, action: action, cue: sfxCue, payload: payload }
        }));
      }
    } catch (_) {}
  }

  /* ==========================================================================
   * 3D / 2.5D Isometric Procedural Turntable Canvas Renderer (0 WebGL Contexts)
   * ========================================================================== */
  function projectIso3D(x, y, z, cx, cy, scale, yaw, pitch) {
    var cosY = Math.cos(yaw);
    var sinY = Math.sin(yaw);
    var rx = x * cosY - z * sinY;
    var rz = x * sinY + z * cosY;
    var cosP = Math.cos(pitch);
    var sinP = Math.sin(pitch);
    var ry = y * cosP - rz * sinP;
    var depth = y * sinP + rz * cosP;
    return {
      x: cx + rx * scale,
      y: cy - ry * scale,
      depth: depth
    };
  }

  function drawIsoBox(ctx, cx, cy, scale, yaw, pitch, bx, by, bz, sx, sy, sz, fillTop, fillSide, strokeCol) {
    var corners = [
      projectIso3D(bx - sx, by + sy, bz - sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx + sx, by + sy, bz - sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx + sx, by + sy, bz + sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx - sx, by + sy, bz + sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx - sx, by - sy, bz + sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx + sx, by - sy, bz + sz, cx, cy, scale, yaw, pitch),
      projectIso3D(bx + sx, by - sy, bz - sz, cx, cy, scale, yaw, pitch)
    ];

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.3;

    // Front-right / side face
    ctx.fillStyle = fillSide;
    ctx.beginPath();
    ctx.moveTo(corners[3].x, corners[3].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[4].x, corners[4].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.fillStyle = fillTop;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function renderTurntableFrame(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var o = opts || {};
    var unitId = o.unitId || store.activeUnitId || 'recon_drone';
    var unitState = store.units[unitId] || store.units.recon_drone;
    var spec = findUnitSpec(unitId);
    var stInfo = resolveStageForXp(o.evolutionXp != null ? o.evolutionXp : unitState.evolutionXp);
    var stage = o.stage != null ? Number(o.stage) : stInfo.stage;

    var w = Number(canvas.width) || 240;
    var h = Number(canvas.height) || 200;
    var cx = w * 0.5;
    var cy = h * 0.54 - store.turntable.petBounce * 10;
    var baseScale = Math.min(w, h) * 0.25 * (0.88 + stage * 0.07);
    var yaw = o.yaw != null ? Number(o.yaw) : store.turntable.yaw;
    var pitch = o.pitch != null ? Number(o.pitch) : store.turntable.pitch;
    var phase = o.phase != null ? Number(o.phase) : store.turntable.phase;
    var bob = Math.sin(phase * 2.2) * 0.08;

    ctx.clearRect(0, 0, w, h);

    // 1. Isometric Pedestal & Stage I..IV Evolution Holo-Rings
    ctx.save();
    for (var r = 1; r <= stage; r++) {
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.79, baseScale * (0.95 + r * 0.16), baseScale * (0.34 + r * 0.06), 0, 0, Math.PI * 2);
      ctx.strokeStyle = r === stage ? spec.accentColor : 'rgba(217, 154, 56, 0.34)';
      ctx.lineWidth = r === stage ? 1.8 : 1.1;
      ctx.stroke();
    }

    // 2. Unit-Specific Articulated 3D Procedural Geometry
    if (unitId === 'recon_drone') {
      // Central carbon core + gimbal optics pod + 4 articulated outrigger arms & spinning rotors
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0, bob, 0, 0.52, 0.22, 0.52, spec.primaryColor, '#2b3e22', spec.accentColor);
      var armOffsets = [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]];
      for (var a = 0; a < armOffsets.length; a++) {
        var ax = armOffsets[a][0];
        var az = armOffsets[a][1];
        var p0 = projectIso3D(0, bob, 0, cx, cy, baseScale, yaw, pitch);
        var p1 = projectIso3D(ax, bob + 0.14, az, cx, cy, baseScale, yaw, pitch);
        ctx.strokeStyle = spec.accentColor;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Spinning rotor disc + blade cross
        var rRadius = baseScale * (0.33 + stage * 0.03);
        ctx.beginPath();
        ctx.ellipse(p1.x, p1.y, rRadius, rRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.strokeStyle = spec.accentColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        var bladeAngle = phase * 9 + a * 1.57;
        ctx.beginPath();
        ctx.moveTo(p1.x - Math.cos(bladeAngle) * rRadius, p1.y - Math.sin(bladeAngle) * rRadius * 0.42);
        ctx.lineTo(p1.x + Math.cos(bladeAngle) * rRadius, p1.y + Math.sin(bladeAngle) * rRadius * 0.42);
        ctx.stroke();
      }
      // Gimbal optic scanner eye tracking cursor
      var eyePt = projectIso3D(store.turntable.lookX * 0.2, bob - 0.18, 0.48, cx, cy, baseScale, yaw, pitch);
      ctx.fillStyle = spec.accentColor;
      ctx.beginPath();
      ctx.arc(eyePt.x, eyePt.y, 4.5 + stage * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (unitId === 'armored_k9') {
      // Articulated 4 hydraulic legs + Kevlar dorsal spine armor plates + cyber-hound head & ears
      var legCoords = [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.45], [0.55, 0.45]];
      for (var l = 0; l < legCoords.length; l++) {
        drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, legCoords[l][0], -0.48 + bob * 0.5, legCoords[l][1], 0.14, 0.38, 0.14, '#47211a', '#2b1410', spec.accentColor);
      }
      // Armored torso & stage dorsal plates
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0, 0.05 + bob, 0, 0.68, 0.34, 0.42, spec.primaryColor, '#6e281c', spec.accentColor);
      for (var sp = 0; sp < stage; sp++) {
        drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, -0.32 + sp * 0.24, 0.42 + bob, 0, 0.12, 0.12, 0.36, spec.accentColor, spec.primaryColor, '#1e1b17');
      }
      // Cyber-jaw head tracking lookX/lookY
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0.68 + store.turntable.lookX * 0.12, 0.36 + bob - store.turntable.lookY * 0.1, 0, 0.32, 0.26, 0.28, '#361914', '#23100d', spec.accentColor);
    } else if (unitId === 'smuggler_falcon') {
      // Streamlined fuselage body + flapping articulated swept alloy wings + contraband talon pods
      var wingFlap = Math.sin(phase * 4.2) * 0.35;
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0, bob, 0, 0.38, 0.26, 0.66, spec.primaryColor, '#7a5216', spec.accentColor);
      // Left & Right articulated wings
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, -0.85, bob + wingFlap, -0.05, 0.56, 0.08, 0.36, spec.accentColor, spec.primaryColor, '#23201c');
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0.85, bob + wingFlap, -0.05, 0.56, 0.08, 0.36, spec.accentColor, spec.primaryColor, '#23201c');
      // Contraband cargo pods underneath at Stage II+
      if (stage >= 2) {
        drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, -0.42, bob - 0.28, 0.1, 0.14, 0.14, 0.28, '#2b2620', '#161310', spec.accentColor);
        drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0.42, bob - 0.28, 0.1, 0.14, 0.14, 0.28, '#2b2620', '#161310', spec.accentColor);
      }
    } else {
      // Cyber-Raven: Holo-feather cloak + neural decryption crest + orbital cipher nodes
      var ravenFlap = Math.cos(phase * 3.6) * 0.26;
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0, bob, 0, 0.42, 0.38, 0.48, spec.primaryColor, '#1f3b63', spec.accentColor);
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, -0.74, bob + ravenFlap, -0.1, 0.44, 0.1, 0.42, '#284c7e', '#182f52', spec.accentColor);
      drawIsoBox(ctx, cx, cy, baseScale, yaw, pitch, 0.74, bob + ravenFlap, -0.1, 0.44, 0.1, 0.42, '#284c7e', '#182f52', spec.accentColor);
      // Floating holo-feather cipher nodes around raven
      for (var hIdx = 0; hIdx < stage + 1; hIdx++) {
        var hAng = phase * 2.5 + hIdx * (Math.PI * 2 / (stage + 1));
        var hPt = projectIso3D(Math.cos(hAng) * 1.15, bob + 0.45, Math.sin(hAng) * 1.15, cx, cy, baseScale, yaw, pitch);
        ctx.fillStyle = spec.accentColor;
        ctx.beginPath();
        ctx.arc(hPt.x, hPt.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. HUD Stage & Callsign Watermark inside Turntable
    ctx.fillStyle = spec.accentColor;
    ctx.font = 'bold 10px "Rubik", system-ui, sans-serif';
    ctx.fillText('STAGE ' + stInfo.roman + ' · ' + (unitState.callsign || spec.defaultCallsign), 10, 16);
    ctx.restore();

    store.turntable.framesRendered += 1;
    return {
      unitId: unitId,
      stage: stage,
      framesRendered: store.turntable.framesRendered
    };
  }

  function stepTurntableAnimation(ts) {
    store.turntable.rafId = 0;
    var doc = getDoc();
    if (!doc) return;
    var screen = getActiveScreen();
    if (screen !== 'dossier' && screen !== 'properties') return;

    var canvas = doc.querySelector('.zcp-turntable-canvas');
    if (!canvas) return;

    var dt = store.turntable.lastFrameTs ? Math.min(0.064, (ts - store.turntable.lastFrameTs) / 1000) : 0.016;
    store.turntable.lastFrameTs = ts;

    if (!isReducedMotion()) {
      if (!store.turntable.dragging) {
        store.turntable.yaw = (store.turntable.yaw + dt * 0.75) % (Math.PI * 2);
      }
      store.turntable.phase += dt;
      if (store.turntable.petBounce > 0) {
        store.turntable.petBounce = Math.max(0, store.turntable.petBounce - dt * 2.5);
      }
    }

    renderTurntableFrame(canvas);

    if (!isReducedMotion() && root && typeof root.requestAnimationFrame === 'function') {
      store.turntable.rafId = root.requestAnimationFrame(stepTurntableAnimation);
    }
  }

  function ensureTurntableLoop() {
    var doc = getDoc();
    if (!doc) return;
    var canvas = doc.querySelector('.zcp-turntable-canvas');
    if (!canvas) return;
    renderTurntableFrame(canvas);
    if (!isReducedMotion() && !store.turntable.rafId && root && typeof root.requestAnimationFrame === 'function') {
      store.turntable.rafId = root.requestAnimationFrame(stepTurntableAnimation);
    }
  }

  function stopTurntableLoop() {
    if (store.turntable.rafId && root && typeof root.cancelAnimationFrame === 'function') {
      try { root.cancelAnimationFrame(store.turntable.rafId); } catch (_) {}
    }
    store.turntable.rafId = 0;
    store.turntable.lastFrameTs = 0;
  }

  /* ==========================================================================
   * Backend API Sync & Actions (`adopt_companion`, `switch_active`, `feed_maintain`, `train_drill`, `patrol_dispatch`)
   * ========================================================================== */
  function applyServerData(data) {
    if (!data || typeof data !== 'object') return;
    store.serverData = data;
    if (data.activeUnitId) {
      store.activeUnitId = String(data.activeUnitId);
    }
    if (Array.isArray(data.roster)) {
      for (var i = 0; i < data.roster.length; i++) {
        var r = data.roster[i];
        if (!r || !r.unitId) continue;
        store.units[r.unitId] = {
          unitId: r.unitId,
          adopted: Boolean(r.adopted),
          isActive: Boolean(r.isActive),
          callsign: String(r.callsign || findUnitSpec(r.unitId).defaultCallsign),
          stage: Number(r.stage || 1),
          level: Number(r.level || 1),
          guardianTitle: String(r.guardianTitle || 'Spark'),
          evolutionXp: Number(r.evolutionXp || 0),
          bond: Number(r.bond != null ? r.bond : 45),
          readiness: Number(r.readiness != null ? r.readiness : 90),
          careScore: Number(r.careScore != null ? r.careScore : 55),
          patrolCount: Number(r.patrolCount || 0),
          drillCount: Number(r.drillCount || 0),
          patrolCooldownUntil: Number(r.patrolCooldownUntil || 0)
        };
      }
    }
    renderActiveScreenMount();
  }

  async function fetchCompanions(force) {
    if (!force && (Date.now() - store.lastSyncAt) < 4000) return store.serverData;
    store.lastSyncAt = Date.now();
    store.telemetry.apiCalls += 1;
    try {
      if (typeof fetch !== 'function') return null;
      var res = await fetch('/api/v1/companions', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return null;
      var data = await res.json();
      if (data && data.ok) {
        applyServerData(data);
        return data;
      }
    } catch (_) {
      // Offline / guest fallback
    }
    return null;
  }

  async function postCompanionAction(actionName, payload, fallbackFn) {
    if (store.busy) return null;
    store.busy = true;
    renderActiveScreenMount();

    var bodyObj = Object.assign({ action: actionName }, payload || {});
    try {
      if (typeof fetch === 'function') {
        store.telemetry.apiCalls += 1;
        var res = await fetch('/api/v1/companions/action', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(bodyObj)
        });
        var data = await res.json().catch(function () { return null; });
        if (res.ok && data && data.ok) {
          store.busy = false;
          applyServerData(data);
          if (data.result) {
            store.feedback = {
              tone: data.result.evolved ? 'gold' : 'sage',
              en: data.result.summaryEn,
              ar: data.result.summaryAr
            };
            emitCompanionBridge(actionName, data.result.sfxCue || 'equip_snap', data.result);
          }
          renderActiveScreenMount();
          return data;
        }
      }
    } catch (_) {
      // Offline / static fallback
    } finally {
      store.busy = false;
    }

    store.telemetry.fallbackActions += 1;
    var fbResult = typeof fallbackFn === 'function' ? fallbackFn() : null;
    renderActiveScreenMount();
    return fbResult;
  }

  function adoptCompanion(unitId, callsign) {
    var spec = findUnitSpec(unitId);
    var uid = spec.id;
    return postCompanionAction('adopt_companion', { unitId: uid, callsign: callsign || spec.defaultCallsign, setActive: true }, function () {
      var u = store.units[uid];
      u.adopted = true;
      if (callsign) u.callsign = String(callsign);
      for (var k in store.units) {
        store.units[k].isActive = (k === uid);
      }
      store.activeUnitId = uid;
      store.feedback = {
        tone: 'sage',
        en: spec.nameEn + ' (' + u.callsign + ') commissioned and set active.',
        ar: 'تم اعتماد «' + spec.nameAr + '» (' + u.callsign + ') وتعيينه كمرافق نشط.'
      };
      emitCompanionBridge('adopt_companion', 'equip_snap', { unitId: uid });
      return { ok: true, preview: true, activeUnitId: uid, unit: u };
    });
  }

  function switchActive(unitId) {
    var spec = findUnitSpec(unitId);
    var uid = spec.id;
    var u = store.units[uid];
    if (!u.adopted) {
      return adoptCompanion(uid);
    }
    return postCompanionAction('switch_active', { unitId: uid }, function () {
      for (var k in store.units) {
        store.units[k].isActive = (k === uid);
      }
      store.activeUnitId = uid;
      store.feedback = {
        tone: 'sage',
        en: 'Active Syndicate companion switched to ' + spec.nameEn + ' (' + spec.specialtyEn + ').',
        ar: 'تم تبديل المرافق النشط إلى «' + spec.nameAr + '» (' + spec.specialtyAr + ').'
      };
      emitCompanionBridge('switch_active', 'equip_snap', { unitId: uid });
      return { ok: true, preview: true, activeUnitId: uid, unit: u };
    });
  }

  function feedMaintain(unitId) {
    var uid = unitId || store.activeUnitId;
    var spec = findUnitSpec(uid);
    store.telemetry.feedsTriggered += 1;
    store.turntable.petBounce = 0.9;
    return postCompanionAction('feed_maintain', { unitId: uid }, function () {
      var u = store.units[uid];
      var oldStage = resolveStageForXp(u.evolutionXp).stage;
      u.bond = Math.min(100, u.bond + 14);
      u.readiness = Math.min(100, u.readiness + 22);
      u.careScore = Math.min(100, u.careScore + 12);
      u.evolutionXp += 20;
      var stInfo = resolveStageForXp(u.evolutionXp);
      u.stage = stInfo.stage;
      u.level = stInfo.level;
      u.guardianTitle = stInfo.guardianTitle;
      var evolved = u.stage > oldStage;
      if (evolved) store.telemetry.stageEvolutions += 1;
      store.feedback = {
        tone: evolved ? 'gold' : 'sage',
        en: spec.nameEn + ' calibrated: Bond ' + u.bond + '%, Readiness ' + u.readiness + '% (+20 XP).' + (evolved ? (' Evolved to ' + stInfo.nameEn + '!') : ''),
        ar: 'تمت معايرة «' + spec.nameAr + '»: الترابط ' + u.bond + '%، الجاهزية ' + u.readiness + '% (+20 XP).' + (evolved ? (' تطوّر إلى «' + stInfo.nameAr + '»!') : '')
      };
      emitCompanionBridge('feed_maintain', evolved ? 'era_breakthrough' : 'equip_snap', { unitId: uid, bond: u.bond, readiness: u.readiness, stage: u.stage });
      return { ok: true, preview: true, evolved: evolved, unit: u };
    });
  }

  function trainDrill(unitId) {
    var uid = unitId || store.activeUnitId;
    var spec = findUnitSpec(uid);
    store.telemetry.drillsTriggered += 1;
    store.turntable.petBounce = 1.0;
    return postCompanionAction('train_drill', { unitId: uid, drillType: 'tactical' }, function () {
      var u = store.units[uid];
      var oldStage = resolveStageForXp(u.evolutionXp).stage;
      var xpGain = TRAIN_BASE_XP + Math.round((u.bond / 100) * 15) + (u.readiness >= 60 ? 10 : 0);
      u.evolutionXp += xpGain;
      u.bond = Math.min(100, u.bond + 6);
      u.readiness = Math.max(10, u.readiness - 8);
      u.drillCount += 1;
      var stInfo = resolveStageForXp(u.evolutionXp);
      u.stage = stInfo.stage;
      u.level = stInfo.level;
      u.guardianTitle = stInfo.guardianTitle;
      var evolved = u.stage > oldStage;
      if (evolved) store.telemetry.stageEvolutions += 1;
      store.feedback = {
        tone: evolved ? 'gold' : 'sage',
        en: spec.nameEn + ' completed Tactical Drill (-' + TRAIN_ENERGY_COST + 'E, +' + xpGain + ' Evolution XP).' + (evolved ? (' Evolved to ' + stInfo.nameEn + '!') : ''),
        ar: 'أكمل «' + spec.nameAr + '» التدريب التكتيكي (-' + TRAIN_ENERGY_COST + ' طاقة، +' + xpGain + ' XP).' + (evolved ? (' تطوّر إلى «' + stInfo.nameAr + '»!') : '')
      };
      emitCompanionBridge('train_drill', evolved ? 'era_breakthrough' : 'xp_gain', { unitId: uid, xpGain: xpGain, stage: u.stage, evolved: evolved });
      return { ok: true, preview: true, xpGain: xpGain, evolved: evolved, unit: u };
    });
  }

  function patrolDispatch(unitId, sector) {
    var uid = unitId || store.activeUnitId;
    var spec = findUnitSpec(uid);
    var sec = sector || 'center';
    store.telemetry.patrolsDispatched += 1;
    return postCompanionAction('patrol_dispatch', { unitId: uid, sector: sec }, function () {
      var u = store.units[uid];
      var nowSec = Math.floor(Date.now() / 1000);
      if (nowSec < u.patrolCooldownUntil) {
        var rem = u.patrolCooldownUntil - nowSec;
        store.feedback = {
          tone: 'crimson',
          en: spec.nameEn + ' is still on patrol cooldown (' + rem + 's remaining).',
          ar: '«' + spec.nameAr + '» في فترة تهدئة الدورية (' + rem + ' ثانية متبقية).'
        };
        emitCompanionBridge('patrol_dispatch', 'step_fail', { unitId: uid, cooldownRemainingSec: rem });
        return { ok: false, cooldownRemainingSec: rem };
      }
      var oldStage = resolveStageForXp(u.evolutionXp).stage;
      var cashEarned = 500 + (oldStage * 320) + (u.bond * 5);
      u.evolutionXp += 45;
      u.bond = Math.min(100, u.bond + 5);
      u.readiness = Math.max(0, u.readiness - 12);
      u.patrolCount += 1;
      u.patrolCooldownUntil = nowSec + PATROL_COOLDOWN_SEC;
      var stInfo = resolveStageForXp(u.evolutionXp);
      u.stage = stInfo.stage;
      u.level = stInfo.level;
      u.guardianTitle = stInfo.guardianTitle;
      var evolved = u.stage > oldStage;
      if (evolved) store.telemetry.stageEvolutions += 1;
      store.feedback = {
        tone: 'gold',
        en: spec.nameEn + ' returned from Sector ' + sec.toUpperCase() + ' patrol: +$' + cashEarned + ' & ' + spec.lootEn + '!',
        ar: 'عاد «' + spec.nameAr + '» من دورية القطاع ' + sec.toUpperCase() + ': +$' + cashEarned + ' و«' + spec.lootAr + '»!'
      };
      emitCompanionBridge('patrol_dispatch', 'cash_payout', { unitId: uid, cashEarned: cashEarned, loot: spec.lootEn });
      return { ok: true, preview: true, cashEarned: cashEarned, lootEn: spec.lootEn, unit: u };
    });
  }

  /* ==========================================================================
   * HTML Builder (EN + AR RTL + Light/Dark Sketchbook)
   * ========================================================================== */
  function renderUnitCrestSvg(tone) {
    if (tone === 'crimson') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 16L32 8L50 16V34C50 47 41 55 32 58C23 55 14 47 14 34V16Z" fill="rgba(198,83,58,0.22)" stroke="currentColor" stroke-width="2.2"/><path d="M22 26L32 38L42 26" stroke="#c44933" stroke-width="3" stroke-linecap="round"/></svg>';
    }
    if (tone === 'gold') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><polygon points="32,8 55,22 46,54 18,54 9,22" fill="rgba(240,196,101,0.22)" stroke="currentColor" stroke-width="2.2"/><path d="M16 34L32 20L48 34" stroke="#d99a38" stroke-width="3" stroke-linecap="round"/></svg>';
    }
    if (tone === 'blue') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="rgba(62,111,176,0.22)" stroke="currentColor" stroke-width="2.2"/><circle cx="32" cy="32" r="7" fill="#4f85c9"/></svg>';
    }
    return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 7L54 19V37C54 48 44 56 32 59C20 56 10 48 10 37V19L32 7Z" fill="rgba(109,153,73,0.2)" stroke="currentColor" stroke-width="2.2"/><circle cx="32" cy="32" r="6" fill="#5c8e3e"/></svg>';
  }

  function formatModifiersPillsHtml(unitId, stage, bond, readiness, ar) {
    var mods = computeUnitModifiers(unitId, stage, bond, readiness);
    var pills = [];
    if (mods.stealthPct) pills.push('<span class="zcp-pill" data-tone="sage"><bdi>+' + mods.stealthPct + '%</bdi> ' + esc(ar ? 'تخفٍ' : 'Stealth') + '</span>');
    if (mods.visionBlindSpotDeg) pills.push('<span class="zcp-pill" data-tone="sage"><bdi>+' + mods.visionBlindSpotDeg + '°</bdi> ' + esc(ar ? 'نقطة عمياء' : 'Blind-Spot') + '</span>');
    if (mods.noiseReductionDb) pills.push('<span class="zcp-pill" data-tone="blue"><bdi>-' + mods.noiseReductionDb + ' dB</bdi> ' + esc(ar ? 'ضوضاء' : 'Noise') + '</span>');
    if (mods.combatDamagePct) pills.push('<span class="zcp-pill" data-tone="crimson"><bdi>+' + mods.combatDamagePct + '%</bdi> ' + esc(ar ? 'ضرر قتالي' : 'Combat Dmg') + '</span>');
    if (mods.counterBleedPct) pills.push('<span class="zcp-pill" data-tone="crimson"><bdi>+' + mods.counterBleedPct + '%</bdi> ' + esc(ar ? 'نزيف مرتد' : 'Counter-Bleed') + '</span>');
    if (mods.armorMitigationPct) pills.push('<span class="zcp-pill" data-tone="gold"><bdi>+' + mods.armorMitigationPct + '%</bdi> ' + esc(ar ? 'امتصاص الدرع' : 'Armor') + '</span>');
    if (mods.travelSpeedPct) pills.push('<span class="zcp-pill" data-tone="gold"><bdi>+' + mods.travelSpeedPct + '%</bdi> ' + esc(ar ? 'سرعة السفر' : 'Travel Speed') + '</span>');
    if (mods.contrabandCapacity) pills.push('<span class="zcp-pill" data-tone="gold"><bdi>+' + mods.contrabandCapacity + '</bdi> ' + esc(ar ? 'سعة التهريب' : 'Contraband Cap') + '</span>');
    if (mods.evasionPct) pills.push('<span class="zcp-pill" data-tone="sage"><bdi>+' + mods.evasionPct + '%</bdi> ' + esc(ar ? 'مراوغة' : 'Evasion') + '</span>');
    if (mods.bazaarFeeReductionPct) pills.push('<span class="zcp-pill" data-tone="blue"><bdi>-' + mods.bazaarFeeReductionPct + '%</bdi> ' + esc(ar ? 'عمولة البازار' : 'Bazaar Fee') + '</span>');
    if (mods.vaultHackPct) pills.push('<span class="zcp-pill" data-tone="plum"><bdi>+' + mods.vaultHackPct + '%</bdi> ' + esc(ar ? 'اختراق الخزائن' : 'Vault Hack') + '</span>');
    if (mods.mugYieldPct) pills.push('<span class="zcp-pill" data-tone="gold"><bdi>+' + mods.mugYieldPct + '%</bdi> ' + esc(ar ? 'غنائم النشل' : 'Mug Yield') + '</span>');
    return pills.join('');
  }

  function renderCompanionPanelHtml() {
    var ar = isAr();
    var activeSpec = findUnitSpec(store.activeUnitId);
    var activeState = store.units[activeSpec.id] || store.units.recon_drone;
    var stInfo = resolveStageForXp(activeState.evolutionXp);
    var nowSec = Math.floor(Date.now() / 1000);
    var cooldownRem = Math.max(0, Number(activeState.patrolCooldownUntil || 0) - nowSec);

    // 1. Roster Tabs (4 Syndicate Units)
    var rosterHtml = '<div class="zcp-roster-grid">';
    for (var i = 0; i < COMPANION_UNITS.length; i++) {
      var uSpec = COMPANION_UNITS[i];
      var uState = store.units[uSpec.id];
      var uStage = resolveStageForXp(uState.evolutionXp);
      var isAct = uSpec.id === activeSpec.id;
      rosterHtml +=
        '<button type="button" class="zcp-unit-tab' + (isAct ? ' is-active' : '') + '" data-zcp-act="select-unit" data-unit="' + esc(uSpec.id) + '" aria-pressed="' + (isAct ? 'true' : 'false') + '">' +
          '<div class="zcp-unit-tab-top">' +
            '<span class="zcp-unit-name">' + esc(ar ? uSpec.nameAr : uSpec.nameEn) + '</span>' +
            '<span class="zcp-pill" data-tone="' + esc(uSpec.tone) + '"><bdi>St.' + uStage.roman + '</bdi></span>' +
          '</div>' +
          '<div class="zcp-unit-spec">' + esc(ar ? uSpec.specialtyAr : uSpec.specialtyEn) + '</div>' +
        '</button>';
    }
    rosterHtml += '</div>';

    // 2. 4-Stage Evolution Pipeline Track
    var stagesHtml = '<div class="zcp-stages-track">';
    for (var s = 0; s < EVOLUTION_STAGES.length; s++) {
      var st = EVOLUTION_STAGES[s];
      var cls = 'zcp-stage-step' + (stInfo.stage >= st.stage ? ' is-reached' : '') + (stInfo.stage === st.stage ? ' is-current' : '');
      stagesHtml += '<div class="' + cls + '" data-zcp-stage="' + st.stage + '">' + esc(ar ? st.shortAr : st.shortEn) + '</div>';
    }
    stagesHtml += '</div>';

    // 3. Bond, Readiness & Evolution XP Bars
    var xpLabelRight = stInfo.nextXp != null
      ? (activeState.evolutionXp + ' / ' + stInfo.nextXp + ' XP')
      : (activeState.evolutionXp + ' XP · APEX');

    var barsHtml =
      '<div class="zcp-bars-stack">' +
        '<div class="zcp-bar-row" data-zcp-bar="bond">' +
          '<div class="zcp-bar-label"><span>' + esc(ar ? 'الترابط العصبي (Bond)' : 'Neural Bond') + '</span><bdi>' + activeState.bond + '%</bdi></div>' +
          '<div class="zcp-bar-track"><div class="zcp-bar-fill" data-tone="sage" style="width:' + Math.min(100, Math.max(0, activeState.bond)) + '%"></div></div>' +
        '</div>' +
        '<div class="zcp-bar-row" data-zcp-bar="readiness">' +
          '<div class="zcp-bar-label"><span>' + esc(ar ? 'الجاهزية الميدانية (Readiness)' : 'Combat Readiness') + '</span><bdi>' + activeState.readiness + '%</bdi></div>' +
          '<div class="zcp-bar-track"><div class="zcp-bar-fill" data-tone="gold" style="width:' + Math.min(100, Math.max(0, activeState.readiness)) + '%"></div></div>' +
        '</div>' +
        '<div class="zcp-bar-row" data-zcp-bar="evolution">' +
          '<div class="zcp-bar-label"><span>' + esc(ar ? 'تطور المرحلة (Evolution XP)' : 'Stage Evolution XP') + '</span><bdi>' + esc(xpLabelRight) + '</bdi></div>' +
          '<div class="zcp-bar-track"><div class="zcp-bar-fill" data-tone="blue" style="width:' + stInfo.progressPct + '%"></div></div>' +
        '</div>' +
      '</div>';

    // 4. Action Buttons: Feed/Calibrate, Train Drill (5E), Dispatch Patrol
    var patrolBtnLabel = cooldownRem > 0
      ? (ar ? ('دورية (' + cooldownRem + 'ث)') : ('Patrol (' + cooldownRem + 's)'))
      : (ar ? 'إرسال دورية' : 'Dispatch Patrol');

    var actionsHtml =
      '<div class="zcp-actions-row">' +
        '<button type="button" class="zcp-btn" data-tone="sage" data-zcp-act="feed-maintain" data-unit="' + esc(activeSpec.id) + '"' + (store.busy ? ' disabled' : '') + '>' +
          esc(ar ? 'إطعام / معايرة' : 'Feed/Calibrate') +
        '</button>' +
        '<button type="button" class="zcp-btn" data-tone="gold" data-zcp-act="train-drill" data-unit="' + esc(activeSpec.id) + '"' + (store.busy ? ' disabled' : '') + '>' +
          esc(ar ? 'تدريب ميداني (5⚡)' : 'Train Drill (5E)') +
        '</button>' +
        '<button type="button" class="zcp-btn" data-tone="blue" data-zcp-act="patrol-dispatch" data-unit="' + esc(activeSpec.id) + '"' + (store.busy || cooldownRem > 0 ? ' disabled' : '') + '>' +
          esc(patrolBtnLabel) +
        '</button>' +
      '</div>';

    var fbHtml = store.feedback
      ? '<div class="zcp-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' + esc(ar ? store.feedback.ar : store.feedback.en) + '</div>'
      : '';

    return (
      '<div class="zcp-head">' +
        '<div class="zcp-title-wrap">' +
          '<span class="zcp-crest-badge" aria-hidden="true">' + renderUnitCrestSvg(activeSpec.tone) + '</span>' +
          '<div>' +
            '<h3 class="zcp-title">' + esc(ar ? 'نظام المرافق السيبراني والدرون ثلاثي الأبعاد (٤ مراحل)' : '4-Stage Evolving 3D Syndicate Companion & Cyber-Drone') + '</h3>' +
            '<p class="zcp-sub">' + esc(ar ? activeSpec.specialtyAr : activeSpec.specialtyEn) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zcp-pills">' +
          '<span class="zcp-pill" data-tone="gold">' + esc(ar ? stInfo.nameAr : stInfo.nameEn) + '</span>' +
          '<span class="zcp-pill" data-tone="plum"><bdi>Lv ' + stInfo.level + ' · ' + esc(stInfo.guardianTitle) + '</bdi></span>' +
        '</div>' +
      '</div>' +
      rosterHtml +
      '<div class="zcp-workbench">' +
        '<div class="zcp-turntable-card">' +
          '<div class="zcp-canvas-wrap">' +
            '<canvas class="zcp-turntable-canvas" width="230" height="190" data-zcp-canvas="' + esc(activeSpec.id) + '" aria-label="' + esc(ar ? activeSpec.nameAr : activeSpec.nameEn) + '"></canvas>' +
          '</div>' +
          '<div class="zcp-turntable-caption">' +
            '<span><bdi>' + esc(activeState.callsign) + '</bdi></span>' +
            '<button type="button" class="zcp-btn" data-tone="gold" data-z3d-inspect="' + esc(activeSpec.id) + '" data-z3d-cat="companion" data-z3d-title="' + esc(ar ? activeSpec.nameAr : activeSpec.nameEn) + '" style="margin-inline-start:8px;padding:3px 8px;font-size:10px">' +
              esc(ar ? 'معاينة 3D بزاوية ٣٦٠°' : '360° 3D Orbit') +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="zcp-telemetry-col">' +
          stagesHtml +
          barsHtml +
          '<div class="zcp-mods-strip">' + formatModifiersPillsHtml(activeSpec.id, stInfo.stage, activeState.bond, activeState.readiness, ar) + '</div>' +
          actionsHtml +
        '</div>' +
      '</div>' +
      fbHtml
    );
  }

  /* ==========================================================================
   * Route-Scoped Mount (`dossier` and `properties` ONLY; 0 mounts on `home`)
   * ========================================================================== */
  function getActiveScreen() {
    var doc = getDoc();
    if (!doc) return '';
    var main = doc.getElementById('zone-main');
    if (!main) return '';
    return String(main.getAttribute('data-zone-screen') || 'home').toLowerCase();
  }

  function removeIfPresent(id) {
    var doc = getDoc();
    if (!doc) return;
    var el = doc.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  function renderActiveScreenMount() {
    var doc = getDoc();
    if (!doc) return false;
    if (doc.querySelector && doc.querySelector('x-dc')) return false;
    var main = doc.getElementById('zone-main');
    if (!main) return false;

    var screen = getActiveScreen();
    if (screen !== 'dossier' && screen !== 'properties') {
      removeIfPresent('zcp-dossier-panel');
      removeIfPresent('zcp-properties-panel');
      stopTurntableLoop();
      return false;
    }

    var targetId = screen === 'dossier' ? 'zcp-dossier-panel' : 'zcp-properties-panel';
    removeIfPresent(screen === 'dossier' ? 'zcp-properties-panel' : 'zcp-dossier-panel');

    var panel = doc.getElementById(targetId);
    if (!panel) {
      panel = doc.createElement('section');
      panel.id = targetId;
      panel.className = 'zcp-scope';
      panel.setAttribute('data-zcp-mounted', screen);
    }

    if (screen === 'dossier') {
      var dossierAnchor = main.querySelector('#zls-dossier-panel, .zone-dossier-card, .zone-dossier-deck, [data-z3d-stage="character-turntable"]');
      if (dossierAnchor && dossierAnchor.parentElement) {
        if (dossierAnchor.nextElementSibling !== panel) {
          dossierAnchor.insertAdjacentElement('afterend', panel);
        }
      } else if (!panel.parentElement) {
        main.appendChild(panel);
      }
    } else {
      var propAnchor = main.querySelector('[data-z3d-stage="safehouse-empire"], .zone-properties-card, .zone-safehouse-card');
      if (propAnchor && propAnchor.parentElement) {
        if (propAnchor.nextElementSibling !== panel) {
          propAnchor.insertAdjacentElement('afterend', panel);
        }
      } else if (!panel.parentElement) {
        main.appendChild(panel);
      }
    }

    var html = renderCompanionPanelHtml();
    if (panel.__zcpLastHtml !== html) {
      panel.__zcpLastHtml = html;
      panel.innerHTML = html;
    }

    if (root && root.ZoneEcs3D && typeof root.ZoneEcs3D.updateStageState === 'function') {
      var activeUnit = store.units[store.activeUnitId] || store.units.recon_drone;
      root.ZoneEcs3D.updateStageState('safehouse-empire', {
        companionId: store.activeUnitId,
        companionStage: resolveStageForXp(activeUnit.evolutionXp).stage
      });
    }

    ensureTurntableLoop();
    return true;
  }

  /* ==========================================================================
   * Delegated Events & Observers
   * ========================================================================== */
  function attachEvents() {
    var doc = getDoc();
    if (!doc) return;

    doc.addEventListener('click', function (ev) {
      var canvasHit = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('.zcp-turntable-canvas') : null;
      if (canvasHit) {
        store.turntable.petBounce = 1.0;
        store.telemetry.turntablePets += 1;
        emitCompanionBridge('pet', 'ui_nav', { unitId: store.activeUnitId });
        ensureTurntableLoop();
        return;
      }

      var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zcp-act]') : null;
      if (!target || target.disabled) return;
      var act = target.getAttribute('data-zcp-act');
      var unitId = target.getAttribute('data-unit') || store.activeUnitId;

      if (act === 'select-unit') {
        ev.preventDefault();
        switchActive(unitId);
      } else if (act === 'feed-maintain') {
        ev.preventDefault();
        feedMaintain(unitId);
      } else if (act === 'train-drill') {
        ev.preventDefault();
        trainDrill(unitId);
      } else if (act === 'patrol-dispatch') {
        ev.preventDefault();
        patrolDispatch(unitId, 'center');
      }
    });

    doc.addEventListener('pointerdown', function (ev) {
      var canvas = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('.zcp-turntable-canvas') : null;
      if (!canvas) return;
      store.turntable.dragging = true;
      store.turntable.lastClientX = Number(ev.clientX || 0);
    });

    doc.addEventListener('pointermove', function (ev) {
      var canvas = doc.querySelector && doc.querySelector('.zcp-turntable-canvas');
      if (!canvas) return;
      var rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
      if (rect && rect.width > 0 && rect.height > 0) {
        store.turntable.lookX = Math.max(-1, Math.min(1, ((ev.clientX - rect.left) / rect.width) * 2 - 1));
        store.turntable.lookY = Math.max(-1, Math.min(1, ((ev.clientY - rect.top) / rect.height) * 2 - 1));
      }
      if (store.turntable.dragging) {
        var dx = Number(ev.clientX || 0) - store.turntable.lastClientX;
        store.turntable.lastClientX = Number(ev.clientX || 0);
        store.turntable.yaw += dx * 0.015;
        renderTurntableFrame(canvas);
      }
    });

    doc.addEventListener('pointerup', function () {
      store.turntable.dragging = false;
    });
  }

  var syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    var run = function () {
      syncScheduled = false;
      var scr = getActiveScreen();
      if (scr === 'dossier' || scr === 'properties') {
        fetchCompanions(false);
      }
      renderActiveScreenMount();
    };
    if (root && typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function boot() {
    attachEvents();
    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('zone:render', scheduleSync);
      root.addEventListener('zone:ecs-3d-ready', scheduleSync);
    }

    var doc = getDoc();
    if (doc && typeof MutationObserver === 'function' && doc.documentElement) {
      var rootObs = new MutationObserver(scheduleSync);
      rootObs.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'dir', 'lang', 'data-zone-reduced-motion', 'data-zone-contrast']
      });

      var mainObs = null;
      var observedMain = null;
      var attachMain = function () {
        var m = doc.getElementById('zone-main');
        if (!m || m === observedMain) return;
        if (mainObs) { try { mainObs.disconnect(); } catch (_) {} }
        observedMain = m;
        mainObs = new MutationObserver(function (records) {
          for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (r.type === 'attributes') { scheduleSync(); return; }
            if (r.type === 'childList' && r.target === m) {
              for (var n = 0; n < r.addedNodes.length; n++) {
                var nd = r.addedNodes[n];
                if (nd && nd.nodeType === 1 && nd.id !== 'zcp-dossier-panel' && nd.id !== 'zcp-properties-panel') {
                  scheduleSync();
                  return;
                }
              }
            }
          }
        });
        mainObs.observe(m, { attributes: true, attributeFilter: ['data-zone-screen'], childList: true });
      };
      attachMain();
      if (root && typeof root.addEventListener === 'function') {
        root.addEventListener('zone:render', attachMain);
      }
    }

    scheduleSync();
  }

  var api = {
    refresh: function () { return fetchCompanions(true); },
    render: renderActiveScreenMount,
    adoptCompanion: adoptCompanion,
    switchActive: switchActive,
    feedMaintain: feedMaintain,
    trainDrill: trainDrill,
    patrolDispatch: patrolDispatch,
    renderTurntableFrame: renderTurntableFrame,
    resolveStageForXp: resolveStageForXp,
    computeUnitModifiers: computeUnitModifiers,
    getUnitsCatalog: function () { return COMPANION_UNITS.slice(); },
    getStagesCatalog: function () { return EVOLUTION_STAGES.slice(); },
    getState: function () {
      var activeUnit = store.units[store.activeUnitId] || store.units.recon_drone;
      var stInfo = resolveStageForXp(activeUnit.evolutionXp);
      return {
        activeUnitId: store.activeUnitId,
        activeUnit: Object.assign({}, activeUnit, {
          stage: stInfo.stage,
          stageRoman: stInfo.roman,
          stageNameEn: stInfo.nameEn,
          stageNameAr: stInfo.nameAr,
          level: stInfo.level,
          guardianTitle: stInfo.guardianTitle,
          modifiers: computeUnitModifiers(store.activeUnitId, stInfo.stage, activeUnit.bond, activeUnit.readiness)
        }),
        units: store.units,
        turntable: {
          yaw: store.turntable.yaw,
          pitch: store.turntable.pitch,
          framesRendered: store.turntable.framesRendered
        }
      };
    },
    diagnostics: function () {
      var doc = getDoc();
      var activeUnit = store.units[store.activeUnitId] || store.units.recon_drone;
      var stInfo = resolveStageForXp(activeUnit.evolutionXp);
      return {
        ready: true,
        screen: getActiveScreen(),
        dossierMounted: Boolean(doc && doc.getElementById('zcp-dossier-panel')),
        propertiesMounted: Boolean(doc && doc.getElementById('zcp-properties-panel')),
        homeMounted: Boolean(doc && (doc.getElementById('zcp-dossier-panel') || doc.getElementById('zcp-properties-panel')) && getActiveScreen() === 'home'),
        activeUnitId: store.activeUnitId,
        stage: stInfo.stage,
        evolutionXp: activeUnit.evolutionXp,
        bond: activeUnit.bond,
        readiness: activeUnit.readiness,
        extraWebglContexts: 0,
        turntableFrames: store.turntable.framesRendered,
        telemetry: store.telemetry
      };
    }
  };

  if (root) {
    root.ZoneCompanion3D = api;
  }

  var doc = getDoc();
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  return api;
});

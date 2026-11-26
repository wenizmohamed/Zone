/* ==========================================================================
 * ZONE v157 - WAVE 2 TRACK 11: 3D STREET CRAPS, BLACKJACK EV & VIP PIT
 * Exclusive Ownership: @casino-3d-games (assets/ui/zone-casino-tables.js)
 * Exposes: window.ZoneCasinoTables
 * Mounts: ONLY on screen === 'casino' (0 mounts on 'home' or any other screen)
 * Skills Applied:
 *   - physics-system & tabletopkit (rigid-body 2d6 impulse/bounce & settling)
 *   - economy-balancing (1.36% - 1.41% Don't Pass / Pass Line equilibrium sink)
 *   - game-hud (live Tactical Odds, Expected-Value bar & Streak Guard)
 * ========================================================================== */
(function (root) {
  'use strict';

  var CSS_HREF = './assets/ui/zone-casino-tables.css?v=167';
  var CONTAINER_ID = 'zct-casino-pit';
  var CRAPS_CANVAS_ID = 'zct-craps-canvas';

  var EUROPEAN_ROULETTE_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var ROULETTE_RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function isRedPocket(n) {
    return ROULETTE_RED_NUMBERS.indexOf(Number(n)) !== -1;
  }

  function getPocketGlyph(n) {
    var num = Number(n);
    if (num === 0) return { symbol: '★', color: 'zero' };
    if (isRedPocket(num)) return { symbol: '◆', color: 'red' };
    return { symbol: '♠', color: 'black' };
  }

  function getNeighborSectorPockets(centerPocket, radius) {
    var r = Math.max(1, Math.min(8, Number(radius) || 2));
    var idx = EUROPEAN_ROULETTE_ORDER.indexOf(Number(centerPocket));
    if (idx < 0) idx = 0;
    var out = [];
    var len = EUROPEAN_ROULETTE_ORDER.length;
    for (var offset = -r; offset <= r; offset++) {
      out.push(EUROPEAN_ROULETTE_ORDER[(idx + offset + len) % len]);
    }
    return out;
  }

  var ROULETTE_CALL_BETS = {
    voisins_du_zero: {
      id: 'voisins_du_zero',
      en: 'Voisins du Zero (17)',
      ar: 'جيران الصفر (١٧ خانة)',
      pockets: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
      houseEdgePct: 2.70
    },
    tiers_du_cylindre: {
      id: 'tiers_du_cylindre',
      en: 'Tiers du Cylindre (12)',
      ar: 'ثلث الأسطوانة (١٢ خانة)',
      pockets: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
      houseEdgePct: 2.70
    },
    orphelins: {
      id: 'orphelins',
      en: 'Orphelins (8)',
      ar: 'الأيتام (٨ خانات)',
      pockets: [1, 20, 14, 31, 9, 17, 34, 6],
      houseEdgePct: 2.70
    },
    jeu_zero: {
      id: 'jeu_zero',
      en: 'Jeu Zero (7)',
      ar: 'لعبة الصفر (٧ خانات)',
      pockets: [12, 35, 3, 26, 0, 32, 15],
      houseEdgePct: 2.70
    },
    neighbors_5: {
      id: 'neighbors_5',
      en: '5-Pocket Neighbors',
      ar: 'قطاع ٥ خانات متجاورة',
      pockets: null, // dynamic around targetPocket
      houseEdgePct: 2.70
    },
    straight: {
      id: 'straight',
      en: 'Straight-Up (35:1)',
      ar: 'رقم مفرد مباشر (٣٥:١)',
      pockets: null, // [targetPocket]
      houseEdgePct: 2.70
    },
    red: {
      id: 'red',
      en: '◆ Ruby Red (1:1)',
      ar: '◆ أحمر ياقوتي (١:١)',
      pockets: ROULETTE_RED_NUMBERS.slice(),
      houseEdgePct: 2.70
    },
    black: {
      id: 'black',
      en: '♠ Obsidian Black (1:1)',
      ar: '♠ أسود أوبسيديان (١:١)',
      pockets: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
      houseEdgePct: 2.70
    }
  };

  /**
   * Evaluates any European Roulette bet with exact uniform 36/k gross return
   * so EV = (k/37) * (36/k) * stake - stake = -1/37 * stake (-2.7027% house edge).
   */
  function evaluateRouletteSpin(betId, pocket, stake, targetPocket) {
    var bKey = ROULETTE_CALL_BETS[betId] ? betId : 'voisins_du_zero';
    var p = Math.max(0, Math.min(36, Math.round(Number(pocket) || 0)));
    var w = Math.max(1, Math.round(Number(stake) || 1000));
    var tgt = Math.max(0, Math.min(36, Math.round(Number(targetPocket !== undefined ? targetPocket : 17))));

    var covered;
    if (bKey === 'straight') {
      covered = [tgt];
    } else if (bKey === 'neighbors_5') {
      covered = getNeighborSectorPockets(tgt, 2);
    } else {
      covered = ROULETTE_CALL_BETS[bKey].pockets;
    }

    var k = covered.length;
    var hit = covered.indexOf(p) !== -1;
    var grossReturnMult = 36 / k; // Exact uniform 36/k multiplier -> 2.7027% house edge
    var grossPayout = hit ? Math.round(w * grossReturnMult) : 0;
    var netDelta = grossPayout - w;
    var glyph = getPocketGlyph(p);

    return {
      betId: bKey,
      pocket: p,
      pocketColor: glyph.color,
      pocketGlyph: glyph.symbol,
      coveredCount: k,
      coveredPockets: covered.slice(),
      hit: hit,
      stake: w,
      grossMultiplier: Number(grossReturnMult.toFixed(4)),
      payout: grossPayout,
      netDelta: netDelta,
      houseEdgePct: Number(((1 / 37) * 100).toFixed(4)),
      bigWin: hit && k <= 7
    };
  }

  function computeRouletteCostCurve(opts) {
    var o = opts || {};
    var stake = Math.max(100, Number(o.stake) || 1000);
    var spinsPerMin = Math.max(1, Number(o.spinsPerMin) || 4);
    var edge = 1 / 37; // 0.027027027...
    var checkpoints = [5, 15, 30, 60].map(function (mins) {
      var spins = mins * spinsPerMin;
      var handle = spins * stake;
      var expectedSink = Math.round(handle * edge);
      return {
        minutes: mins,
        spins: spins,
        totalHandle: handle,
        expectedHouseSink: expectedSink
      };
    });
    return {
      pocketCount: 37,
      houseEdgeDecimal: Number(edge.toFixed(6)),
      houseEdgePct: 2.7027,
      expectedReturnPct: 97.2973,
      stake: stake,
      spinsPerMin: spinsPerMin,
      checkpoints: checkpoints
    };
  }

  var STANDARD_STAKES = [500, 1000, 5000, 25000];
  var VIP_STAKES = [5000, 25000, 50000, 100000];

  var CRAPS_BETS = {
    pass_line: {
      id: 'pass_line',
      en: 'Pass Line',
      ar: 'خط النجاح (Pass)',
      payoutEn: '1:1',
      payoutAr: '1:1',
      houseEdgePct: 1.41,
      exactHouseEdgePct: 1.4141
    },
    dont_pass: {
      id: 'dont_pass',
      en: "Don't Pass",
      ar: 'ضد الرامي (Don\'t Pass)',
      payoutEn: '1:1 (Bar 12)',
      payoutAr: '1:1 (12 تعادل)',
      houseEdgePct: 1.36,
      exactHouseEdgePct: 1.3636
    },
    field: {
      id: 'field',
      en: 'Field (1-Roll)',
      ar: 'الحقل (رمية واحدة)',
      payoutEn: '1:1 · 2x/3x',
      payoutAr: '1:1 · 2x/3x',
      houseEdgePct: 2.78,
      exactHouseEdgePct: 2.7778
    },
    hardways: {
      id: 'hardways',
      en: 'Hardways',
      ar: 'الأزواج الصلبة',
      payoutEn: '7:1 / 9:1',
      payoutAr: '7:1 / 9:1',
      houseEdgePct: 9.09,
      exactHouseEdgePct: 9.0909
    }
  };

  var HARDWAY_TARGETS = {
    4: { sum: 4, pair: 2, mult: 7, houseEdgePct: 11.11 },
    6: { sum: 6, pair: 3, mult: 9, houseEdgePct: 9.09 },
    8: { sum: 8, pair: 4, mult: 9, houseEdgePct: 9.09 },
    10: { sum: 10, pair: 5, mult: 7, houseEdgePct: 11.11 }
  };

  var POINT_NUMBERS = [4, 5, 6, 8, 9, 10];

  /* ---------------- Utility Helpers ---------------- */
  function isAr() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    var html = document.documentElement;
    return html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function isReducedMotion() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    var html = document.documentElement;
    return Boolean(html.dataset && html.dataset.zoneReducedMotion === 'true');
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function fmtMoney(n) {
    var num = Math.round(Number(n) || 0);
    var sign = num < 0 ? '-' : '';
    return sign + '$' + Math.abs(num).toLocaleString('en-US');
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---------------- Deterministic Provably-Fair PRNG & Hash ---------------- */
  function fnv1aHex(str) {
    var h1 = 0x811c9dc5;
    var h2 = 0x9e3779b9;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 ^= ch;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= (ch + i);
      h2 = Math.imul(h2, 0x85ebca6b);
    }
    var p1 = (h1 >>> 0).toString(16).padStart(8, '0');
    var p2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return p1 + p2;
  }

  function seededUint32(seedStr) {
    var h = 0x811c9dc5;
    var s = String(seedStr || 'zone-v157');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return function () {
      h += 0x6d2b79f5;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Audio / Haptics & 3D Stage Bridges ---------------- */
  function triggerAudioCue(cueName, detail) {
    if (typeof window === 'undefined') return false;
    var zah = window.ZoneAudioHaptics;
    if (!zah) return false;
    try {
      if (typeof zah.play === 'function') {
        zah.play(cueName, detail || {});
        return true;
      }
      if (typeof zah.trigger === 'function') {
        zah.trigger(cueName, detail || {});
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  function triggerCasino3D(actionName, payload) {
    if (typeof window === 'undefined') return false;
    var z3d = window.ZoneEcs3D;
    if (!z3d || typeof z3d.triggerStageAction !== 'function') return false;
    try {
      z3d.triggerStageAction('casino-royale', actionName || 'spin', payload || {});
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ==========================================================================
   * 1. PURE ECONOMY-BALANCING & CRAPS RULES ENGINE (1.36% - 1.41% SINK)
   * ========================================================================== */
  function computeCrapsOdds(betId, hardTarget) {
    var id = CRAPS_BETS[betId] ? betId : 'pass_line';
    var base = CRAPS_BETS[id];
    if (id === 'hardways') {
      var ht = HARDWAY_TARGETS[Number(hardTarget)] || HARDWAY_TARGETS[6];
      return {
        betId: 'hardways',
        hardTarget: ht.sum,
        payoutMultiplier: ht.mult,
        houseEdgePct: ht.houseEdgePct,
        equilibriumSinkTarget: '1.36% - 1.41%'
      };
    }
    return {
      betId: id,
      hardTarget: null,
      payoutMultiplier: 1,
      houseEdgePct: base.houseEdgePct,
      exactHouseEdgePct: base.exactHouseEdgePct,
      equilibriumSinkTarget: '1.36% - 1.41%'
    };
  }

  function evaluateCrapsRoll(crapsSnap, d1, d2) {
    var snap = crapsSnap || {};
    var betId = CRAPS_BETS[snap.betId] ? snap.betId : 'pass_line';
    var stake = Math.max(1, Math.round(Number(snap.stake) || 1000));
    var point = snap.point ? Number(snap.point) : null;
    var hardTarget = HARDWAY_TARGETS[Number(snap.hardTarget)] ? Number(snap.hardTarget) : 6;
    var sum = Number(d1) + Number(d2);
    var isHard = Number(d1) === Number(d2);

    var outcome = 'continue'; // win | lose | push | point_set | continue
    var nextPoint = point;
    var payout = 0; // total returned to player including stake on win/push
    var netDelta = 0;
    var reasonEn = '';
    var reasonAr = '';
    var bigWin = false;

    if (betId === 'pass_line') {
      if (!point) {
        if (sum === 7 || sum === 11) {
          outcome = 'win';
          payout = stake * 2;
          netDelta = stake;
          reasonEn = 'Come-out Natural ' + sum + '! Pass Line pays 1:1.';
          reasonAr = 'رمية افتتاحية طبيعية ' + sum + '! فوز خط النجاح 1:1.';
        } else if (sum === 2 || sum === 3 || sum === 12) {
          outcome = 'lose';
          payout = 0;
          netDelta = -stake;
          reasonEn = 'Craps ' + sum + ' on come-out. Pass Line loses.';
          reasonAr = 'كرابس ' + sum + ' في الافتتاح. خسارة خط النجاح.';
        } else {
          outcome = 'point_set';
          nextPoint = sum;
          payout = 0;
          netDelta = 0;
          reasonEn = 'Point established at ' + sum + '. Roll ' + sum + ' before 7!';
          reasonAr = 'تم تثبيت النقطة على ' + sum + '. أرمِ ' + sum + ' قبل الرقم 7!';
        }
      } else {
        if (sum === point) {
          outcome = 'win';
          nextPoint = null;
          payout = stake * 2;
          netDelta = stake;
          reasonEn = 'Point ' + point + ' hit! Pass Line wins 1:1.';
          reasonAr = 'أصبت النقطة ' + point + '! فوز خط النجاح 1:1.';
        } else if (sum === 7) {
          outcome = 'lose';
          nextPoint = null;
          payout = 0;
          netDelta = -stake;
          reasonEn = 'Seven-Out (7). Pass Line clears.';
          reasonAr = 'خروج بالرقم 7 (Seven-Out). خسارة الجولة.';
        } else {
          outcome = 'continue';
          reasonEn = 'Rolled ' + sum + ' — Point remains ON ' + point + '.';
          reasonAr = 'النتيجة ' + sum + ' - النقطة ما زالت على ' + point + '.';
        }
      }
    } else if (betId === 'dont_pass') {
      if (!point) {
        if (sum === 2 || sum === 3) {
          outcome = 'win';
          payout = stake * 2;
          netDelta = stake;
          reasonEn = 'Come-out ' + sum + '! Don\'t Pass wins 1:1.';
          reasonAr = 'الرقم ' + sum + ' في الافتتاح! فوز ضد الرامي 1:1.';
        } else if (sum === 12) {
          outcome = 'push';
          payout = stake;
          netDelta = 0;
          reasonEn = 'Bar 12 on come-out — Push, stake returned.';
          reasonAr = 'حظر 12 في الافتتاح - تعادل وإرجاع الرهان.';
        } else if (sum === 7 || sum === 11) {
          outcome = 'lose';
          payout = 0;
          netDelta = -stake;
          reasonEn = 'Natural ' + sum + ' on come-out. Don\'t Pass loses.';
          reasonAr = 'رقم طبيعي ' + sum + ' في الافتتاح. خسارة ضد الرامي.';
        } else {
          outcome = 'point_set';
          nextPoint = sum;
          reasonEn = 'Point ON ' + sum + '. Roll 7 before ' + sum + ' to win!';
          reasonAr = 'النقطة على ' + sum + '. أرمِ 7 قبل ' + sum + ' للفوز!';
        }
      } else {
        if (sum === 7) {
          outcome = 'win';
          nextPoint = null;
          payout = stake * 2;
          netDelta = stake;
          reasonEn = 'Seven-Out (7)! Don\'t Pass wins 1:1.';
          reasonAr = 'سقوط على 7! فوز رهان ضد الرامي 1:1.';
        } else if (sum === point) {
          outcome = 'lose';
          nextPoint = null;
          payout = 0;
          netDelta = -stake;
          reasonEn = 'Point ' + point + ' made. Don\'t Pass loses.';
          reasonAr = 'تم تحقيق النقطة ' + point + '. خسارة ضد الرامي.';
        } else {
          outcome = 'continue';
          reasonEn = 'Rolled ' + sum + ' — Point remains ON ' + point + '.';
          reasonAr = 'النتيجة ' + sum + ' - النقطة ما زالت على ' + point + '.';
        }
      }
    } else if (betId === 'field') {
      if (sum === 2) {
        outcome = 'win';
        payout = stake * 3;
        netDelta = stake * 2;
        bigWin = true;
        reasonEn = 'Snake Eyes (2)! Field pays 2:1.';
        reasonAr = 'عيون الأفعى (2)! رهان الحقل يدفع 2:1.';
      } else if (sum === 12) {
        outcome = 'win';
        payout = stake * 4;
        netDelta = stake * 3;
        bigWin = true;
        reasonEn = 'Boxcars (12)! Field pays 3:1!';
        reasonAr = 'عربات الصندوق (12)! رهان الحقل يدفع 3:1!';
      } else if (sum === 3 || sum === 4 || sum === 9 || sum === 10 || sum === 11) {
        outcome = 'win';
        payout = stake * 2;
        netDelta = stake;
        reasonEn = 'Field hit ' + sum + '! Pays 1:1.';
        reasonAr = 'أصبت الحقل ' + sum + '! الدفع 1:1.';
      } else {
        outcome = 'lose';
        payout = 0;
        netDelta = -stake;
        reasonEn = 'Rolled ' + sum + ' — Field loses (5/6/7/8).';
        reasonAr = 'النتيجة ' + sum + ' - خسارة الحقل (5/6/7/8).';
      }
    } else if (betId === 'hardways') {
      var spec = HARDWAY_TARGETS[hardTarget];
      if (sum === spec.sum && isHard) {
        outcome = 'win';
        payout = stake * (spec.mult + 1);
        netDelta = stake * spec.mult;
        bigWin = true;
        reasonEn = 'HARD ' + spec.sum + ' (' + d1 + '+' + d2 + ')! Pays ' + spec.mult + ':1!';
        reasonAr = 'زوج صلب ' + spec.sum + ' (' + d1 + '+' + d2 + ')! ربح ' + spec.mult + ':1!';
      } else if (sum === 7 || (sum === spec.sum && !isHard)) {
        outcome = 'lose';
        payout = 0;
        netDelta = -stake;
        reasonEn = sum === 7
          ? 'Seven-Out (7) wipes Hard ' + spec.sum + '.'
          : 'Easy ' + spec.sum + ' (' + d1 + '+' + d2 + ') downs Hard ' + spec.sum + '.';
        reasonAr = sum === 7
          ? 'الرقم 7 أسقط الزوج الصلب ' + spec.sum + '.'
          : 'مجموع سهل ' + spec.sum + ' (' + d1 + '+' + d2 + ') أنهى الرهان.';
      } else {
        outcome = 'continue';
        reasonEn = 'Rolled ' + sum + ' (' + d1 + '+' + d2 + ') — Hard ' + spec.sum + ' stays working!';
        reasonAr = 'النتيجة ' + sum + ' (' + d1 + '+' + d2 + ') - رهان الصلب ' + spec.sum + ' مستمر!';
      }
    }

    return {
      betId: betId,
      d1: d1,
      d2: d2,
      sum: sum,
      isHard: isHard,
      outcome: outcome,
      nextPoint: nextPoint,
      payout: payout,
      netDelta: netDelta,
      bigWin: bigWin,
      reasonEn: reasonEn,
      reasonAr: reasonAr
    };
  }

  /* ==========================================================================
   * 2. RIGID-BODY 3D DICE IMPULSE & BOUNCE PHYSICS (physics-system + tabletopkit)
   * ========================================================================== */
  function createDiceBodies(bounds, face1, face2) {
    var w = Math.max(220, Number(bounds && bounds.width) || 320);
    var h = Math.max(120, Number(bounds && bounds.height) || 152);
    return [
      {
        id: 'die1',
        x: w * 0.36,
        y: h * 0.52,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        avx: 0,
        avy: 0,
        avz: 0,
        size: 26,
        face: face1 || 5,
        resting: true
      },
      {
        id: 'die2',
        x: w * 0.62,
        y: h * 0.48,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        avx: 0,
        avy: 0,
        avz: 0,
        size: 26,
        face: face2 || 2,
        resting: true
      }
    ];
  }

  function applyDiceThrowImpulse(bodies, bounds, targetF1, targetF2, rng) {
    var r = rng || Math.random;
    var w = Math.max(220, Number(bounds && bounds.width) || 320);
    var h = Math.max(120, Number(bounds && bounds.height) || 152);
    var targets = [targetF1, targetF2];

    for (var i = 0; i < 2; i++) {
      var b = bodies[i];
      b.x = 34 + i * 28;
      b.y = h * (0.42 + i * 0.16);
      b.z = 26 + i * 10;
      b.vx = 250 + r() * 140 + (w * 0.35);
      b.vy = (r() - 0.5) * 210 + (i === 0 ? -55 : 55);
      b.vz = 175 + r() * 90;
      b.avx = (r() > 0.5 ? 1 : -1) * (10 + r() * 9);
      b.avy = (r() > 0.5 ? 1 : -1) * (11 + r() * 9);
      b.avz = (r() - 0.5) * 14;
      b.face = targets[i];
      b.resting = false;
    }
    return bodies;
  }

  function stepDicePhysics(bodies, dtRaw, bounds, onBounce) {
    var dt = clamp(Number(dtRaw) || 0.016, 0.001, 0.05);
    var w = Math.max(220, Number(bounds && bounds.width) || 320);
    var h = Math.max(120, Number(bounds && bounds.height) || 152);
    var gravity = -920;
    var floorRestitution = 0.58;
    var wallRestitution = 0.72;
    var pad = 22;
    var allResting = true;

    for (var i = 0; i < bodies.length; i++) {
      var d = bodies[i];
      if (d.resting) continue;

      d.vz += gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      d.rx += d.avx * dt;
      d.ry += d.avy * dt;
      d.rz += d.avz * dt;

      // Felt floor collision
      if (d.z <= 0) {
        d.z = 0;
        if (Math.abs(d.vz) > 48) {
          d.vz = -d.vz * floorRestitution;
          d.vx *= 0.86;
          d.vy *= 0.86;
          d.avx *= 0.78;
          d.avy *= 0.78;
          if (typeof onBounce === 'function') onBounce('floor', Math.abs(d.vz));
        } else {
          d.vz = 0;
        }
        // Surface friction when on felt
        d.vx *= Math.pow(0.22, dt);
        d.vy *= Math.pow(0.22, dt);
        d.avx *= Math.pow(0.14, dt);
        d.avy *= Math.pow(0.14, dt);
        d.avz *= Math.pow(0.16, dt);
      } else {
        // Air drag
        d.vx *= Math.pow(0.75, dt);
        d.vy *= Math.pow(0.75, dt);
      }

      // Padded diamond backboard wall collisions
      if (d.x < pad) {
        d.x = pad;
        d.vx = Math.abs(d.vx) * wallRestitution;
        if (typeof onBounce === 'function') onBounce('wall', Math.abs(d.vx));
      } else if (d.x > w - pad) {
        d.x = w - pad;
        d.vx = -Math.abs(d.vx) * wallRestitution;
        if (typeof onBounce === 'function') onBounce('wall', Math.abs(d.vx));
      }
      if (d.y < pad) {
        d.y = pad;
        d.vy = Math.abs(d.vy) * wallRestitution;
        if (typeof onBounce === 'function') onBounce('wall', Math.abs(d.vy));
      } else if (d.y > h - pad) {
        d.y = h - pad;
        d.vy = -Math.abs(d.vy) * wallRestitution;
        if (typeof onBounce === 'function') onBounce('wall', Math.abs(d.vy));
      }

      var speedSq = d.vx * d.vx + d.vy * d.vy + d.vz * d.vz;
      if (d.z <= 0.1 && speedSq < 196 && Math.abs(d.avx) < 0.8 && Math.abs(d.avy) < 0.8) {
        d.z = 0;
        d.vx = 0;
        d.vy = 0;
        d.vz = 0;
        d.rx = 0;
        d.ry = 0;
        d.avz = 0;
        d.resting = true;
      } else {
        allResting = false;
      }
    }

    // Die-to-die elastic impulse collision
    if (bodies.length >= 2) {
      var a = bodies[0];
      var b = bodies[1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dz = b.z - a.z;
      var minDist = 28;
      var distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 0.0001 && distSq < minDist * minDist) {
        var dist = Math.sqrt(distSq);
        var nx = dx / dist;
        var ny = dy / dist;
        var overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        var rvx = b.vx - a.vx;
        var rvy = b.vy - a.vy;
        var relNormal = rvx * nx + rvy * ny;
        if (relNormal < 0) {
          var imp = -(1 + 0.78) * relNormal * 0.5;
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;
          a.resting = false;
          b.resting = false;
          allResting = false;
          if (typeof onBounce === 'function') onBounce('die', Math.abs(imp));
        }
      }
    }

    return allResting;
  }

  /* ==========================================================================
   * 3. BLACKJACK ANALYTICAL EV & STRATEGY ENGINE (Dealer Stands All 17s)
   * ========================================================================== */
  var CARD_RANKS = [
    { rank: 'A', val: 11 },
    { rank: '2', val: 2 },
    { rank: '3', val: 3 },
    { rank: '4', val: 4 },
    { rank: '5', val: 5 },
    { rank: '6', val: 6 },
    { rank: '7', val: 7 },
    { rank: '8', val: 8 },
    { rank: '9', val: 9 },
    { rank: '10', val: 10 },
    { rank: 'J', val: 10 },
    { rank: 'Q', val: 10 },
    { rank: 'K', val: 10 }
  ];
  var SUITS = ['♠', '♥', '♦', '♣'];

  // Probability distribution of drawing card value v in {2..11} (where 11 = Ace)
  var DRAW_PROBS = [
    { val: 2, p: 1 / 13 },
    { val: 3, p: 1 / 13 },
    { val: 4, p: 1 / 13 },
    { val: 5, p: 1 / 13 },
    { val: 6, p: 1 / 13 },
    { val: 7, p: 1 / 13 },
    { val: 8, p: 1 / 13 },
    { val: 9, p: 1 / 13 },
    { val: 10, p: 4 / 13 },
    { val: 11, p: 1 / 13 }
  ];

  function normalizeCardVal(c) {
    if (typeof c === 'number') return c === 1 ? 11 : clamp(Math.round(c), 2, 11);
    var r = String((c && (c.rank || c.label || c.value || c)) || '').toUpperCase().replace(/[^A0-9JQK]/g, '');
    if (r === 'A' || r === '1' || r === '11') return 11;
    if (r === 'K' || r === 'Q' || r === 'J' || r === '10') return 10;
    var n = parseInt(r, 10);
    return isNaN(n) ? 10 : clamp(n, 2, 10);
  }

  function evaluateHand(cards) {
    var total = 0;
    var aces = 0;
    var list = Array.isArray(cards) ? cards : [];
    for (var i = 0; i < list.length; i++) {
      var v = normalizeCardVal(list[i]);
      if (v === 11) aces += 1;
      total += v;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return {
      total: total,
      isSoft: aces > 0,
      isBust: total > 21,
      isBlackjack: list.length === 2 && total === 21
    };
  }

  function addCardToTotal(total, isSoft, cardVal) {
    var nextTotal = total + cardVal;
    var nextSoft = isSoft || cardVal === 11;
    var aceCount = isSoft ? 1 : 0;
    if (cardVal === 11) aceCount += 1;
    while (nextTotal > 21 && aceCount > 0) {
      nextTotal -= 10;
      aceCount -= 1;
    }
    return {
      total: nextTotal,
      isSoft: aceCount > 0,
      isBust: nextTotal > 21
    };
  }

  var dealerDistCache = {};
  function computeDealerDistribution(upcardRaw) {
    var upVal = normalizeCardVal(upcardRaw);
    if (dealerDistCache[upVal]) return dealerDistCache[upVal];

    var memo = {};
    function solve(tot, soft) {
      if (tot > 21) return { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 1 };
      if (tot >= 17) {
        var out = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
        out[tot] = 1;
        return out;
      }
      var key = tot + ':' + (soft ? 1 : 0);
      if (memo[key]) return memo[key];
      var acc = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
      for (var i = 0; i < DRAW_PROBS.length; i++) {
        var dr = DRAW_PROBS[i];
        var nx = addCardToTotal(tot, soft, dr.val);
        var sub = solve(nx.total, nx.isSoft);
        acc[17] += dr.p * sub[17];
        acc[18] += dr.p * sub[18];
        acc[19] += dr.p * sub[19];
        acc[20] += dr.p * sub[20];
        acc[21] += dr.p * sub[21];
        acc.bust += dr.p * sub.bust;
      }
      memo[key] = acc;
      return acc;
    }

    var res = solve(upVal, upVal === 11);
    dealerDistCache[upVal] = res;
    return res;
  }

  function computeStandStats(playerTotal, dealerDist) {
    if (playerTotal > 21) return { ev: -1, winProb: 0, pushProb: 0, loseProb: 1 };
    var win = dealerDist.bust;
    var push = 0;
    var lose = 0;
    for (var dt = 17; dt <= 21; dt++) {
      if (playerTotal > dt) win += dealerDist[dt];
      else if (playerTotal === dt) push += dealerDist[dt];
      else lose += dealerDist[dt];
    }
    return {
      ev: win - lose,
      winProb: win,
      pushProb: push,
      loseProb: lose
    };
  }

  function computeBlackjackEV(playerCards, dealerUpcard, canDouble) {
    var hand = evaluateHand(playerCards);
    var dDist = computeDealerDistribution(dealerUpcard || 10);
    var allowDouble = canDouble !== false && (!Array.isArray(playerCards) || playerCards.length === 2);

    if (hand.isBust) {
      return {
        playerTotal: hand.total,
        isSoft: hand.isSoft,
        standEV: -1,
        hitEV: -1,
        doubleEV: -2,
        optimalAction: 'stand',
        winProbPct: 0,
        bustProbPct: 100,
        dealerBustPct: Math.round(dDist.bust * 1000) / 10
      };
    }

    var standStats = computeStandStats(hand.total, dDist);
    var hitMemo = {};

    function bestAfterHit(tot, soft) {
      if (tot > 21) return -1;
      var k = tot + ':' + (soft ? 1 : 0);
      if (hitMemo[k] !== undefined) return hitMemo[k];
      var sEv = computeStandStats(tot, dDist).ev;
      if (tot === 21) {
        hitMemo[k] = sEv;
        return sEv;
      }
      var hEv = 0;
      for (var i = 0; i < DRAW_PROBS.length; i++) {
        var dr = DRAW_PROBS[i];
        var nx = addCardToTotal(tot, soft, dr.val);
        hEv += dr.p * (nx.isBust ? -1 : bestAfterHit(nx.total, nx.isSoft));
      }
      var best = Math.max(sEv, hEv);
      hitMemo[k] = best;
      return best;
    }

    var hitEV = 0;
    var oneCardDoubleSum = 0;
    var immediateBustProb = 0;

    for (var i = 0; i < DRAW_PROBS.length; i++) {
      var dr = DRAW_PROBS[i];
      var nx = addCardToTotal(hand.total, hand.isSoft, dr.val);
      if (nx.isBust) {
        immediateBustProb += dr.p;
        hitEV += dr.p * (-1);
        oneCardDoubleSum += dr.p * (-1);
      } else {
        hitEV += dr.p * bestAfterHit(nx.total, nx.isSoft);
        oneCardDoubleSum += dr.p * computeStandStats(nx.total, dDist).ev;
      }
    }

    var doubleEV = 2 * oneCardDoubleSum;
    var standEV = standStats.ev;
    var optimalAction = 'stand';
    var bestEV = standEV;
    if (hitEV > bestEV + 1e-6) {
      bestEV = hitEV;
      optimalAction = 'hit';
    }
    if (allowDouble && doubleEV > bestEV + 1e-6) {
      bestEV = doubleEV;
      optimalAction = 'double';
    }

    return {
      playerTotal: hand.total,
      isSoft: hand.isSoft,
      standEV: Math.round(standEV * 1000) / 1000,
      hitEV: Math.round(hitEV * 1000) / 1000,
      doubleEV: Math.round(doubleEV * 1000) / 1000,
      canDouble: allowDouble,
      optimalAction: optimalAction,
      winProbPct: Math.round(standStats.winProb * 1000) / 10,
      bustProbPct: Math.round(immediateBustProb * 1000) / 10,
      dealerBustPct: Math.round(dDist.bust * 1000) / 10
    };
  }

  /* ==========================================================================
   * 4. INSTANCE FACTORY & LIVE STATE ENGINE
   * ========================================================================== */
  function buildShoe(serverSeed, clientSeed, nonce, numDecks) {
    var decks = Math.max(1, Number(numDecks) || 6);
    var shoe = [];
    for (var d = 0; d < decks; d++) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 0; r < CARD_RANKS.length; r++) {
          var cr = CARD_RANKS[r];
          shoe.push({
            rank: cr.rank,
            suit: SUITS[s],
            val: cr.val,
            label: cr.rank + SUITS[s],
            red: SUITS[s] === '♥' || SUITS[s] === '♦'
          });
        }
      }
    }
    var rng = seededUint32(serverSeed + ':' + clientSeed + ':' + nonce);
    for (var i = shoe.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = shoe[i];
      shoe[i] = shoe[j];
      shoe[j] = tmp;
    }
    return shoe;
  }

  function createZoneCasinoTablesRuntime() {
    var store = {
      vipMode: false,
      bankroll: 250000,
      initialBankroll: 250000,
      economy: {
        totalWagered: 0,
        totalReturned: 0,
        roundsPlayed: 0,
        crapsLineWagered: 0,
        crapsLineReturned: 0
      },
      streakGuard: {
        lossStreak: 0,
        maxLossStreak: 0,
        triggered: false,
        cooldownActive: false
      },
      roulette: {
        betId: 'voisins_du_zero',
        targetPocket: 17,
        stake: 1000,
        lastPocket: 17,
        spinCount: 0,
        history: [17, 0, 32, 26, 7, 23],
        statusTone: 'gold',
        statusEn: 'Monte-Carlo Noir 3D Wheel ready · 37 pockets · 2.70% uniform European house edge.',
        statusAr: 'عجلة مونت كارلو ثلاثية الأبعاد جاهزة · ٣٧ خانة · هامش أوروبي موحّد 2.70%.'
      },
      craps: {
        betId: 'pass_line',
        hardTarget: 6,
        hardwaysActive: false,
        stake: 1000,
        point: null,
        lastDice: [5, 2],
        rolling: false,
        rollCount: 0,
        statusTone: 'neutral',
        statusEn: 'Come-Out Roll ready. Pass Line (1.41% edge) or Don\'t Pass (1.36% edge).',
        statusAr: 'رمية الافتتاح جاهزة. خط النجاح (1.41%) أو ضد الرامي (1.36%).',
        bodies: createDiceBodies({ width: 320, height: 152 }, 5, 2)
      },
      bj: {
        stake: 1000,
        status: 'idle', // idle | playing | settled
        playerCards: [],
        dealerCards: [],
        bet: 0,
        canDouble: false,
        result: null,
        statusTone: 'neutral',
        statusEn: 'Provably-Fair 6-deck shoe ready. Deal a hand to inspect real-time EV.',
        statusAr: 'حذاء 6 مجموعات عادل وقابل للتحقق جاهز. وزّع يداً لفحص القيمة المتوقعة.',
        fair: {
          serverSeed: 'zone-velvet-2026-srv',
          clientSeed: 'operative-777',
          nonce: 1,
          serverSeedHash: fnv1aHex('zone-velvet-2026-srv:1'),
          shoe: []
        }
      },
      rafId: 0,
      lastFrameAt: 0,
      lastBounceCueAt: 0,
      mounted: false
    };

    store.bj.fair.shoe = buildShoe(store.bj.fair.serverSeed, store.bj.fair.clientSeed, store.bj.fair.nonce, 6);

    function syncLiveBankrollFromGame() {
      if (typeof window !== 'undefined' && window.__zoneGame && window.__zoneGame.p && typeof window.__zoneGame.p.cash === 'number') {
        store.bankroll = Math.max(0, Number(window.__zoneGame.p.cash));
      }
      return store.bankroll;
    }

    function applyBankrollDelta(delta) {
      var d = Math.round(Number(delta) || 0);
      if (typeof window !== 'undefined' && window.__zoneGame && window.__zoneGame.p && typeof window.__zoneGame.p.cash === 'number') {
        window.__zoneGame.p.cash = Math.max(0, Number(window.__zoneGame.p.cash) + d);
        store.bankroll = window.__zoneGame.p.cash;
      } else {
        store.bankroll = Math.max(0, store.bankroll + d);
      }
    }

    function recordEconomyAndStreak(wagered, returned) {
      var w = Math.max(0, Number(wagered) || 0);
      var r = Math.max(0, Number(returned) || 0);
      store.economy.totalWagered += w;
      store.economy.totalReturned += r;
      store.economy.roundsPlayed += 1;

      if (w > 0) {
        if (r > w) {
          store.streakGuard.lossStreak = 0;
          store.streakGuard.cooldownActive = false;
        } else if (r < w) {
          store.streakGuard.lossStreak += 1;
          if (store.streakGuard.lossStreak > store.streakGuard.maxLossStreak) {
            store.streakGuard.maxLossStreak = store.streakGuard.lossStreak;
          }
        }
      }
      var drawdown = store.initialBankroll - store.bankroll;
      if (store.streakGuard.lossStreak >= 3 || drawdown >= Math.max(25000, store.initialBankroll * 0.25)) {
        store.streakGuard.triggered = true;
      }
    }

    function resetStreakGuard() {
      store.streakGuard.lossStreak = 0;
      store.streakGuard.triggered = false;
      store.streakGuard.cooldownActive = true;
      store.craps.stake = 500;
      store.bj.stake = 500;
      store.roulette.stake = 500;
      triggerAudioCue('ui_nav', { source: 'streak_guard_reset' });
      renderActiveScreenMount();
    }

    function getVipTier() {
      var vol = store.economy.totalWagered;
      if (vol >= 250000 || store.vipMode) return { en: 'Syndicate Whale', ar: 'حوت النقابة VIP', tone: 'gold' };
      if (vol >= 50000) return { en: 'Velvet High-Roller', ar: 'كبار الشخصيات', tone: 'sage' };
      if (vol >= 10000) return { en: 'Salon Regular', ar: 'عضو الصالون', tone: 'blue' };
      return { en: 'Street Table', ar: 'طاولة الشارع', tone: 'neutral' };
    }

    /* ---------------- Canvas 3D Dice Renderer ---------------- */
    function drawPip(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawSingleDie(ctx, body) {
      var s = body.size || 26;
      var half = s * 0.5;
      var lift = clamp(body.z || 0, 0, 120);
      var scale = 1 + lift * 0.0032;
      var sx = body.x;
      var sy = body.y - lift * 0.34;

      // Ground shadow projected from Z height
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + clamp(0.42 - lift * 0.002, 0.14, 0.42).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(body.x + lift * 0.12, body.y + half * 0.65, half * (0.95 + lift * 0.004), half * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3D beveled die body
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      ctx.rotate((body.rz || 0) + Math.sin(body.rx || 0) * 0.12);

      var depthX = clamp(Math.sin(body.ry || 0.35) * 6, -6, 6);
      var depthY = 5;

      // Side bevel shadow face (3D depth extrusion)
      ctx.fillStyle = '#c8bea7';
      ctx.strokeStyle = '#1e1b18';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-half + depthX * 0.5, -half + depthY, s, s, 5) : ctx.rect(-half + depthX * 0.5, -half + depthY, s, s);
      ctx.fill();
      ctx.stroke();

      // Top ivory face
      ctx.fillStyle = '#fbf7ee';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-half, -half, s, s, 5) : ctx.rect(-half, -half, s, s);
      ctx.fill();
      ctx.stroke();

      // Dynamic face while tumbling, true settled face at rest
      var showFace = body.resting
        ? body.face
        : (Math.abs(Math.floor((body.rx + body.ry) * 3)) % 6) + 1;

      ctx.fillStyle = showFace === 1 ? '#b83227' : '#1e1b18';
      var off = s * 0.27;
      var pr = showFace === 1 ? 3.1 : 2.3;
      if (showFace === 1 || showFace === 3 || showFace === 5) drawPip(ctx, 0, 0, pr);
      if (showFace >= 2) {
        drawPip(ctx, -off, -off, pr);
        drawPip(ctx, off, off, pr);
      }
      if (showFace >= 4) {
        drawPip(ctx, off, -off, pr);
        drawPip(ctx, -off, off, pr);
      }
      if (showFace === 6) {
        drawPip(ctx, -off, 0, pr);
        drawPip(ctx, off, 0, pr);
      }
      ctx.restore();
    }

    function drawCrapsCanvas() {
      if (typeof document === 'undefined') return;
      var cv = document.getElementById(CRAPS_CANVAS_ID);
      if (!cv || typeof cv.getContext !== 'function') return;
      var ctx = cv.getContext('2d');
      if (!ctx) return;

      var w = Math.max(240, cv.clientWidth || cv.width || 320);
      var h = Math.max(130, cv.clientHeight || cv.height || 152);
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;

      ctx.clearRect(0, 0, w, h);

      // Felt base & inner rail lines
      ctx.fillStyle = '#123123';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(244, 207, 120, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      ctx.strokeStyle = 'rgba(244, 207, 120, 0.25)';
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.setLineDash([]);

      // Diamond backboard texture on right rail
      ctx.fillStyle = 'rgba(217, 154, 56, 0.24)';
      for (var py = 20; py < h - 20; py += 16) {
        ctx.beginPath();
        ctx.moveTo(w - 10, py);
        ctx.lineTo(w - 17, py + 6);
        ctx.lineTo(w - 10, py + 12);
        ctx.closePath();
        ctx.fill();
      }

      // Point puck drawn on felt
      ctx.save();
      var puckX = w - 42;
      var puckY = 30;
      ctx.fillStyle = store.craps.point ? '#f5ebd6' : '#18181b';
      ctx.strokeStyle = '#d99a38';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(puckX, puckY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = store.craps.point ? '#1e1b18' : '#f5ebd6';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(store.craps.point ? ('ON ' + store.craps.point) : 'OFF', puckX, puckY + 3.5);
      ctx.restore();

      // Draw both 3D dice
      var bodies = store.craps.bodies;
      for (var i = 0; i < bodies.length; i++) {
        drawSingleDie(ctx, bodies[i]);
      }
    }

    function runPhysicsLoop(ts) {
      store.rafId = 0;
      if (!store.craps.rolling) return;
      var cv = typeof document !== 'undefined' ? document.getElementById(CRAPS_CANVAS_ID) : null;
      var bounds = {
        width: cv ? (cv.clientWidth || cv.width || 320) : 320,
        height: cv ? (cv.clientHeight || cv.height || 152) : 152
      };
      var now = ts || Date.now();
      var dt = store.lastFrameAt ? (now - store.lastFrameAt) / 1000 : 0.016;
      store.lastFrameAt = now;

      var allResting = stepDicePhysics(store.craps.bodies, dt, bounds, function (kind) {
        var t = Date.now();
        if (t - store.lastBounceCueAt > 75) {
          store.lastBounceCueAt = t;
          triggerAudioCue('roulette_tick', { source: 'craps_' + kind });
        }
      });

      drawCrapsCanvas();

      if (allResting) {
        store.craps.rolling = false;
        renderActiveScreenMount();
      } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        store.rafId = window.requestAnimationFrame(runPhysicsLoop);
      }
    }

    /* ---------------- Craps Shoot Action (Server-Authoritative when Live + Offline Unit Fallback) ---------------- */
    function finalizeCrapsRoll(d1, d2, stake, alreadyCommitted, serverApplied) {
      var c = store.craps;
      if (!serverApplied && !alreadyCommitted) {
        applyBankrollDelta(-stake);
      }

      c.rollCount += 1;
      c.lastDice = [d1, d2];

      var res = evaluateCrapsRoll(c, d1, d2);
      c.point = res.nextPoint;
      if (c.betId === 'hardways') {
        c.hardwaysActive = res.outcome === 'continue';
      } else {
        c.hardwaysActive = false;
      }

      if (!serverApplied && res.payout > 0) {
        applyBankrollDelta(res.payout);
      }
      if (res.outcome === 'win' || res.outcome === 'lose' || res.outcome === 'push') {
        recordEconomyAndStreak(stake, res.payout);
        if (c.betId === 'pass_line' || c.betId === 'dont_pass') {
          store.economy.crapsLineWagered += stake;
          store.economy.crapsLineReturned += res.payout;
        }
      }

      c.statusEn = res.reasonEn;
      c.statusAr = res.reasonAr;
      c.statusTone = res.outcome === 'win' ? 'sage' : (res.outcome === 'lose' ? 'crimson' : (res.outcome === 'point_set' ? 'gold' : 'neutral'));

      var rng = seededUint32('craps-phys:' + d1 + ':' + d2 + ':' + c.rollCount);
      var cv = typeof document !== 'undefined' ? document.getElementById(CRAPS_CANVAS_ID) : null;
      var bounds = {
        width: cv ? (cv.clientWidth || cv.width || 320) : 320,
        height: cv ? (cv.clientHeight || cv.height || 152) : 152
      };
      applyDiceThrowImpulse(c.bodies, bounds, d1, d2, rng);

      if (isReducedMotion() || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        for (var step = 0; step < 260; step++) {
          if (stepDicePhysics(c.bodies, 0.016, bounds)) break;
        }
        c.bodies[0].resting = true;
        c.bodies[1].resting = true;
        c.rolling = false;
      } else {
        c.rolling = true;
        store.lastFrameAt = Date.now();
        if (!store.rafId) {
          store.rafId = window.requestAnimationFrame(runPhysicsLoop);
        }
      }

      triggerCasino3D('spin', { submode: 'craps', source: 'craps', dice: [d1, d2], sum: res.sum, point: c.point, betId: c.betId });
      triggerAudioCue('roulette_tick', { source: 'craps_shoot', sum: res.sum });
      if (res.outcome === 'win') {
        triggerAudioCue(res.bigWin ? 'jackpot_fanfare' : 'cash_payout', { source: 'craps', payout: res.payout });
      }
      if (typeof window !== 'undefined' && window.ZoneGameKit && typeof window.ZoneGameKit.recordEvent === 'function') {
        window.ZoneGameKit.recordEvent('craps_roll', { stake: stake, betId: c.betId, netDelta: res.payout - stake });
      }

      drawCrapsCanvas();
      renderActiveScreenMount();
      return { ok: true, result: res, dice: [d1, d2], bankroll: store.bankroll };
    }

    function shootCrapsDice(forcedDice) {
      syncLiveBankrollFromGame();
      var c = store.craps;
      var stake = Math.max(500, Math.round(Number(c.stake) || 1000));
      var alreadyCommitted = Boolean(
        (c.point && (c.betId === 'pass_line' || c.betId === 'dont_pass')) ||
        (c.hardwaysActive && c.betId === 'hardways')
      );
      if (!alreadyCommitted && store.bankroll < stake && stake > 500 && store.bankroll >= 500) {
        stake = store.bankroll >= 1000 ? 1000 : 500;
        c.stake = stake;
      }
      if (!alreadyCommitted && store.bankroll < stake) {
        c.statusTone = 'crimson';
        c.statusEn = 'Insufficient bankroll for ' + fmtMoney(stake) + ' wager.';
        c.statusAr = 'الرصيد غير كافٍ للرهان بمبلغ ' + fmtMoney(stake) + '.';
        renderActiveScreenMount();
        return { ok: false, error: 'insufficient_funds' };
      }

      var liveGame = (typeof window !== 'undefined' && window.__zoneGame && typeof window.fetch === 'function') ? window.__zoneGame : null;
      if (!forcedDice && liveGame && Boolean(typeof document !== 'undefined' && (document.getElementById('dc-root') || (document.querySelector && document.querySelector('x-dc'))))) {
        if (c.rolling) return { ok: false, error: 'busy' };
        c.rolling = true;
        renderActiveScreenMount();
        window.fetch('/api/v1/casino/craps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            bet: stake,
            betType: c.betId,
            hardTarget: c.hardTarget,
            point: c.point,
            alreadyCommitted: alreadyCommitted
          })
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (resp) {
            c.rolling = false;
            if (resp.ok && resp.data && Array.isArray(resp.data.dice)) {
              if (resp.data.player && typeof liveGame.applyServerPlayer === 'function') {
                liveGame.applyServerPlayer(resp.data.player);
                if (typeof liveGame.save === 'function') liveGame.save();
                if (typeof liveGame.forceUpdate === 'function') liveGame.forceUpdate();
              }
              syncLiveBankrollFromGame();
              finalizeCrapsRoll(resp.data.dice[0], resp.data.dice[1], stake, alreadyCommitted, true);
            } else {
              var rngFallback = seededUint32('craps:' + Date.now() + ':' + c.rollCount);
              finalizeCrapsRoll(Math.floor(rngFallback() * 6) + 1, Math.floor(rngFallback() * 6) + 1, stake, alreadyCommitted, false);
            }
          })
          .catch(function () {
            c.rolling = false;
            var rngErr = seededUint32('craps:' + Date.now() + ':' + c.rollCount);
            finalizeCrapsRoll(Math.floor(rngErr() * 6) + 1, Math.floor(rngErr() * 6) + 1, stake, alreadyCommitted, false);
          });
        return { ok: true, pendingServer: true };
      }

      var rng = seededUint32('craps:' + store.bj.fair.clientSeed + ':' + Date.now() + ':' + c.rollCount);
      var d1 = forcedDice && forcedDice[0] ? clamp(Math.round(forcedDice[0]), 1, 6) : (Math.floor(rng() * 6) + 1);
      var d2 = forcedDice && forcedDice[1] ? clamp(Math.round(forcedDice[1]), 1, 6) : (Math.floor(rng() * 6) + 1);
      return finalizeCrapsRoll(d1, d2, stake, alreadyCommitted, false);
    }

    /* ---------------- 37-Pocket 3D Monte-Carlo Roulette Spin ---------------- */
    function spinRouletteWheel(forcedPocket) {
      syncLiveBankrollFromGame();
      var rl = store.roulette;
      var stake = Math.max(500, Math.round(Number(rl.stake) || 1000));
      if (store.bankroll < stake) {
        rl.statusTone = 'crimson';
        rl.statusEn = 'Insufficient bankroll for ' + fmtMoney(stake) + ' roulette wager.';
        rl.statusAr = 'الرصيد غير كافٍ لرهان الروليت بقيمة ' + fmtMoney(stake) + '.';
        renderActiveScreenMount();
        return { ok: false, error: 'insufficient_funds' };
      }

      var rng = seededUint32('roulette:' + store.bj.fair.clientSeed + ':' + Date.now() + ':' + rl.spinCount);
      var pocket = forcedPocket !== undefined && forcedPocket !== null
        ? Math.max(0, Math.min(36, Math.round(Number(forcedPocket))))
        : EUROPEAN_ROULETTE_ORDER[Math.floor(rng() * EUROPEAN_ROULETTE_ORDER.length)];

      applyBankrollDelta(-stake);
      rl.spinCount += 1;
      rl.lastPocket = pocket;
      rl.history.unshift(pocket);
      if (rl.history.length > 8) rl.history.length = 8;

      var evalRes = evaluateRouletteSpin(rl.betId, pocket, stake, rl.targetPocket);
      if (evalRes.payout > 0) {
        applyBankrollDelta(evalRes.payout);
      }
      recordEconomyAndStreak(stake, evalRes.payout);

      var betMeta = ROULETTE_CALL_BETS[rl.betId] || ROULETTE_CALL_BETS.voisins_du_zero;
      if (evalRes.hit) {
        rl.statusTone = evalRes.bigWin ? 'gold' : 'sage';
        rl.statusEn = evalRes.pocketGlyph + ' Pocket ' + pocket + ' HIT on ' + betMeta.en + '! Returned ' + fmtMoney(evalRes.payout) + ' (Net +' + fmtMoney(evalRes.netDelta) + ').';
        rl.statusAr = evalRes.pocketGlyph + ' أصابت الخانة ' + pocket + ' في «' + betMeta.ar + '»! العائد ' + fmtMoney(evalRes.payout) + ' (صافي +' + fmtMoney(evalRes.netDelta) + ').';
      } else {
        rl.statusTone = 'crimson';
        rl.statusEn = evalRes.pocketGlyph + ' Ball settled in Pocket ' + pocket + ' — missed ' + betMeta.en + '.';
        rl.statusAr = evalRes.pocketGlyph + ' استقرت الكرة في الخانة ' + pocket + ' - خارج «' + betMeta.ar + '».';
      }

      if (typeof window !== 'undefined' && window.ZoneEcs3D) {
        if (typeof window.ZoneEcs3D.updateStageState === 'function') {
          window.ZoneEcs3D.updateStageState('casino-royale', { pocket: pocket });
        }
      }
      triggerCasino3D('spin', { source: 'roulette', pocket: pocket, betType: rl.betId, bigWin: evalRes.bigWin });
      triggerAudioCue(evalRes.hit ? (evalRes.bigWin ? 'jackpot_fanfare' : 'cash_payout') : 'roulette_tick', { source: 'roulette_3d', pocket: pocket });
      if (typeof window !== 'undefined' && window.ZoneGameKit && typeof window.ZoneGameKit.recordEvent === 'function') {
        window.ZoneGameKit.recordEvent('roulette_spin', { stake: stake, pocket: pocket, netDelta: evalRes.netDelta, betType: rl.betId });
      }

      renderActiveScreenMount();
      return { ok: true, pocket: pocket, result: evalRes, bankroll: store.bankroll };
    }

    /* ---------------- Blackjack Shoe Actions ---------------- */
    function drawShoeCard() {
      var fair = store.bj.fair;
      if (!fair.shoe || fair.shoe.length < 15) {
        fair.nonce += 1;
        fair.shoe = buildShoe(fair.serverSeed, fair.clientSeed, fair.nonce, 6);
        fair.serverSeedHash = fnv1aHex(fair.serverSeed + ':' + fair.nonce);
      }
      return fair.shoe.pop();
    }

    function settleBlackjackHand(outcome, msgEn, msgAr, payoutMult, isBig) {
      var bj = store.bj;
      var returned = Math.round(bj.bet * payoutMult);
      if (returned > 0) applyBankrollDelta(returned);
      recordEconomyAndStreak(bj.bet, returned);

      bj.status = 'settled';
      bj.canDouble = false;
      bj.result = outcome;
      bj.statusEn = msgEn;
      bj.statusAr = msgAr;
      bj.statusTone = outcome === 'win' ? 'sage' : (outcome === 'lose' ? 'crimson' : 'gold');

      if (outcome === 'win') {
        triggerAudioCue(isBig ? 'jackpot_fanfare' : 'cash_payout', { source: 'blackjack', payout: returned });
      }
      if (typeof window !== 'undefined' && window.ZoneGameKit && typeof window.ZoneGameKit.recordEvent === 'function') {
        window.ZoneGameKit.recordEvent('blackjack_hand', {
          stake: bj.bet,
          netDelta: returned - bj.bet,
          followedOptimal: Boolean(bj.lastFollowedOptimal)
        });
      }
    }

    function resolveDealerTurn() {
      var bj = store.bj;
      var pEval = evaluateHand(bj.playerCards);
      var dEval = evaluateHand(bj.dealerCards);
      while (!dEval.isBust && dEval.total < 17) {
        bj.dealerCards.push(drawShoeCard());
        dEval = evaluateHand(bj.dealerCards);
      }
      if (dEval.isBust) {
        settleBlackjackHand(
          'win',
          'Dealer busted (' + dEval.total + ')! You win ' + fmtMoney(bj.bet) + '.',
          'تجاوز الموزع 21 (' + dEval.total + ')! ربحت ' + fmtMoney(bj.bet) + '.',
          2,
          false
        );
      } else if (pEval.total > dEval.total) {
        settleBlackjackHand(
          'win',
          'Your ' + pEval.total + ' beats Dealer ' + dEval.total + '! Net +' + fmtMoney(bj.bet) + '.',
          'مجموعك ' + pEval.total + ' يهزم الموزع ' + dEval.total + '! ربح +' + fmtMoney(bj.bet) + '.',
          2,
          false
        );
      } else if (pEval.total < dEval.total) {
        settleBlackjackHand(
          'lose',
          'Dealer ' + dEval.total + ' beats your ' + pEval.total + '.',
          'الموزع ' + dEval.total + ' يتفوق على ' + pEval.total + '.',
          0,
          false
        );
      } else {
        settleBlackjackHand(
          'push',
          'Push at ' + pEval.total + ' — Full stake returned.',
          'تعادل عند ' + pEval.total + ' - تم إرجاع الرهان.',
          1,
          false
        );
      }
    }

    function blackjackAction(act) {
      syncLiveBankrollFromGame();
      var bj = store.bj;

      if (act === 'deal') {
        if (bj.status === 'playing') return { ok: false, error: 'hand_active' };
        var stake = Math.max(500, Math.round(Number(bj.stake) || 1000));
        if (store.bankroll < stake) {
          bj.statusTone = 'crimson';
          bj.statusEn = 'Insufficient bankroll to deal ' + fmtMoney(stake) + '.';
          bj.statusAr = 'الرصيد لا يكفي لتوزيع رهان ' + fmtMoney(stake) + '.';
          renderActiveScreenMount();
          return { ok: false, error: 'insufficient_funds' };
        }
        applyBankrollDelta(-stake);
        bj.fair.nonce += 1;
        bj.fair.serverSeedHash = fnv1aHex(bj.fair.serverSeed + ':' + bj.fair.nonce);
        bj.bet = stake;
        bj.status = 'playing';
        bj.result = null;
        bj.playerCards = [drawShoeCard(), drawShoeCard()];
        bj.dealerCards = [drawShoeCard(), drawShoeCard()];
        bj.canDouble = store.bankroll >= stake;

        triggerAudioCue('roulette_tick', { source: 'bj_deal' });
        triggerCasino3D('spin', { source: 'blackjack', action: 'deal' });

        var pEval = evaluateHand(bj.playerCards);
        var dEval = evaluateHand(bj.dealerCards);
        if (pEval.isBlackjack && dEval.isBlackjack) {
          settleBlackjackHand('push', 'Dual Blackjack — Push!', 'بلاك جاك مزدوج - تعادل!', 1, false);
        } else if (pEval.isBlackjack) {
          settleBlackjackHand('win', 'NATURAL BLACKJACK 3:2! +' + fmtMoney(bj.bet * 1.5), 'بلاك جاك طبيعي 3:2! +' + fmtMoney(bj.bet * 1.5), 2.5, true);
        } else if (dEval.isBlackjack) {
          settleBlackjackHand('lose', 'Dealer revealed Natural Blackjack.', 'كشف الموزع بلاك جاك طبيعي.', 0, false);
        } else {
          bj.statusTone = 'neutral';
          bj.statusEn = 'Hand live (' + pEval.total + ' vs ' + bj.dealerCards[0].rank + '). Check Tactical EV HUD!';
          bj.statusAr = 'اليد نشطة (' + pEval.total + ' ضد ' + bj.dealerCards[0].rank + '). راقب لوحة القيمة المتوقعة!';
        }
        renderActiveScreenMount();
        return { ok: true, status: bj.status, playerTotal: pEval.total };
      }

      if (bj.status !== 'playing') return { ok: false, error: 'no_active_hand' };

      if (act === 'hit') {
        bj.canDouble = false;
        bj.playerCards.push(drawShoeCard());
        triggerAudioCue('roulette_tick', { source: 'bj_hit' });
        var hEval = evaluateHand(bj.playerCards);
        if (hEval.isBust) {
          settleBlackjackHand('lose', 'Bust at ' + hEval.total + '.', 'تجاوزت 21 (' + hEval.total + ').', 0, false);
        } else if (hEval.total === 21) {
          resolveDealerTurn();
        } else {
          bj.statusEn = 'Drew to ' + hEval.total + '. Hit or Stand?';
          bj.statusAr = 'وصلت إلى ' + hEval.total + '. سحب أم وقوف؟';
        }
        renderActiveScreenMount();
        return { ok: true, status: bj.status, playerTotal: hEval.total };
      }

      if (act === 'stand') {
        triggerAudioCue('roulette_tick', { source: 'bj_stand' });
        resolveDealerTurn();
        renderActiveScreenMount();
        return { ok: true, status: bj.status };
      }

      if (act === 'double') {
        if (!bj.canDouble || store.bankroll < bj.bet) return { ok: false, error: 'cannot_double' };
        applyBankrollDelta(-bj.bet);
        bj.bet *= 2;
        bj.canDouble = false;
        bj.playerCards.push(drawShoeCard());
        triggerAudioCue('roulette_tick', { source: 'bj_double' });
        var dbEval = evaluateHand(bj.playerCards);
        if (dbEval.isBust) {
          settleBlackjackHand('lose', 'Double Down busted at ' + dbEval.total + '.', 'تجاوزت 21 بعد المضاعفة (' + dbEval.total + ').', 0, false);
        } else {
          resolveDealerTurn();
        }
        renderActiveScreenMount();
        return { ok: true, status: bj.status, playerTotal: dbEval.total };
      }

      return { ok: false, error: 'unknown_action' };
    }

    function getActiveBlackjackInspection() {
      // Sync live server Blackjack hand if playing inside index.html pit, else use local shoe hand
      var liveBj = (typeof window !== 'undefined' && window.__zoneGame && window.__zoneGame.blackjackTable) || null;
      if (liveBj && liveBj.status === 'playing' && Array.isArray(liveBj.playerCards) && liveBj.playerCards.length >= 2) {
        var up = (Array.isArray(liveBj.dealerCards) && liveBj.dealerCards[0]) || 10;
        return {
          source: 'live-pit',
          playerCards: liveBj.playerCards,
          dealerUpcard: up,
          canDouble: Boolean(liveBj.canDouble),
          ev: computeBlackjackEV(liveBj.playerCards, up, Boolean(liveBj.canDouble))
        };
      }
      var pCards = store.bj.playerCards.length ? store.bj.playerCards : [{ rank: '10', val: 10 }, { rank: 'A', val: 11 }];
      var dUp = store.bj.dealerCards.length ? store.bj.dealerCards[0] : { rank: '6', val: 6 };
      var dbl = store.bj.status === 'playing' ? store.bj.canDouble : true;
      return {
        source: 'vip-shoe',
        playerCards: pCards,
        dealerUpcard: dUp,
        canDouble: dbl,
        ev: computeBlackjackEV(pCards, dUp, dbl)
      };
    }

    function getEquilibriumSummary() {
      var w = store.economy.totalWagered;
      var r = store.economy.totalReturned;
      var observedEdgePct = w > 0 ? Math.round(((w - r) / w) * 10000) / 100 : 1.39;
      return {
        totalWagered: w,
        totalReturned: r,
        netHouseSink: w - r,
        observedEdgePct: observedEdgePct,
        coreLineTargetRange: '1.36% - 1.41%',
        passLineEdgePct: CRAPS_BETS.pass_line.houseEdgePct,
        dontPassEdgePct: CRAPS_BETS.dont_pass.houseEdgePct
      };
    }

    /* ---------------- DOM Rendering (Fiber-Safe, Casino Screen Only) ---------------- */
    function getActiveScreen() {
      if (typeof document === 'undefined') return '';
      var main = document.getElementById('zone-main');
      return main ? String(main.getAttribute('data-zone-screen') || '').toLowerCase() : '';
    }

    function ensureStylesheetLink() {
      if (typeof document === 'undefined' || !document.head) return;
      var existing = document.querySelector('link[href*="zone-casino-tables.css"]');
      if (existing) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }

    function removeIfPresent(id) {
      if (typeof document === 'undefined') return;
      var el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.removeChild(el);
    }

    function formatEvVal(ev) {
      var pct = Math.round(Number(ev) * 1000) / 10;
      return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    }

    function evBarWidth(ev) {
      // Map EV in [-0.6, +0.6] to [12%, 100%]
      return Math.round(clamp(((Number(ev) + 0.6) / 1.2) * 100, 8, 100));
    }

    function buildInnerHtml() {
      syncLiveBankrollFromGame();
      var ar = isAr();
      var vip = getVipTier();
      var eq = getEquilibriumSummary();
      var stakes = store.vipMode ? VIP_STAKES : STANDARD_STAKES;
      var c = store.craps;
      var cOdds = computeCrapsOdds(c.betId, c.hardTarget);
      var bj = store.bj;
      var bjPlaying = bj.status === 'playing';
      var bjPlayerEval = bj.playerCards.length ? evaluateHand(bj.playerCards) : null;
      var bjDealerEval = bj.dealerCards.length ? evaluateHand(bj.dealerCards) : null;
      var insp = getActiveBlackjackInspection();
      var ev = insp.ev;

      var optLabel = ev.optimalAction === 'hit'
        ? (ar ? 'سحب (HIT)' : 'HIT')
        : (ev.optimalAction === 'double' ? (ar ? 'مضاعفة (DOUBLE)' : 'DOUBLE') : (ar ? 'وقوف (STAND)' : 'STAND'));

      var html = [];
      // 1. VIP Pit Header
      html.push('<header class="zct-vip-head">');
      html.push('  <div class="zct-title-wrap">');
      html.push('    <span class="zct-crest" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/><path d="M14 6h7M17.5 3v6"/></svg></span>');
      html.push('    <div>');
      html.push('      <h3 class="zct-title">' + (ar ? 'قاعة كبار الشخصيات · الكرابس 3D ومحلل البلاك جاك' : 'High-Roller VIP Pit · 3D Street Craps & Blackjack EV') + '</h3>');
      html.push('      <p class="zct-sub">' + (ar ? 'فيزياء نرد ثلاثية الأبعاد · توازن اقتصادي 1.36% - 1.41% · حذاء عادل قابل للتحقق' : 'Rigid-Body 2d6 Physics · 1.36% - 1.41% Equilibrium Sink · Provably-Fair EV Inspector') + '</p>');
      html.push('    </div>');
      html.push('  </div>');
      html.push('  <div class="zct-badges">');
      html.push('    <span class="zct-pill" data-tone="' + vip.tone + '">' + esc(ar ? vip.ar : vip.en) + '</span>');
      html.push('    <button type="button" class="zct-chip-btn" data-zct-act="toggle-vip" aria-pressed="' + (store.vipMode ? 'true' : 'false') + '">' + (ar ? (store.vipMode ? 'وضع VIP: مفعل' : 'تفعيل VIP') : (store.vipMode ? 'VIP Stakes: ON' : 'VIP Stakes')) + '</button>');
      html.push('  </div>');
      html.push('</header>');

      // 2. VIP Telemetry Strip
      html.push('<div class="zct-vip-strip">');
      html.push('  <div class="zct-stat-cell"><span class="zct-stat-label">' + (ar ? 'رصيد الطاولة' : 'Pit Bankroll') + '</span><bdi class="zct-stat-val" data-zct-bankroll="1">' + esc(fmtMoney(store.bankroll)) + '</bdi></div>');
      html.push('  <div class="zct-stat-cell"><span class="zct-stat-label">' + (ar ? 'توازن الكازينو' : 'Equilibrium Sink') + '</span><bdi class="zct-stat-val">' + esc(eq.coreLineTargetRange) + '</bdi></div>');
      html.push('  <div class="zct-stat-cell"><span class="zct-stat-label">' + (ar ? 'الحجم المراهن' : 'Session Volume') + '</span><bdi class="zct-stat-val">' + esc(fmtMoney(eq.totalWagered)) + '</bdi></div>');
      html.push('  <div class="zct-stat-cell"><span class="zct-stat-label">' + (ar ? 'سلسلة الخسائر' : 'Streak Guard') + '</span><bdi class="zct-stat-val">' + (store.streakGuard.lossStreak >= 3 ? (ar ? 'تنبيه حماية' : 'PROTECTED') : (ar ? 'سليم (' + store.streakGuard.lossStreak + ')' : 'CLEAR (' + store.streakGuard.lossStreak + ')')) + '</bdi></div>');
      html.push('</div>');

      // Streak Protection Guard Banner
      if (store.streakGuard.triggered) {
        html.push('<div class="zct-guard-banner" data-zct-streak-guard="1" role="alert">');
        html.push('  <span>' + (ar
          ? 'تنبيه حماية السلسلة: تذبذب خاسر (' + store.streakGuard.lossStreak + ' جولات). الاحتمال الحقيقي ثابت (-0.49% بلاك جاك / 1.36% كرابس).'
          : 'Streak Protection Guard: ' + store.streakGuard.lossStreak + ' consecutive losses. True house odds stay fixed; cap risk to $500.') + '</span>');
        html.push('  <button type="button" class="zct-guard-btn" data-zct-act="reset-guard">' + (ar ? 'خفض الرهان إلى $500 وتهدئة' : 'Cap $500 & Cooldown') + '</button>');
        html.push('</div>');
      }

      // 2.5 LUNA HOUSE OF OBSIDIAN & CHAMPAGNE GOLD: 37-POCKET 3D MONTE-CARLO ROULETTE SALON
      // On live index.html (<x-dc>), Roulette + French Call Bets + Blackjack EV are integrated directly
      // into the primary server-authoritative Velvet Noir Pit above — avoid rendering duplicate client-only copies!
      var isLiveXdcHost = Boolean(typeof document !== 'undefined' && document.getElementById('dc-root'));
      var rl = store.roulette;
      var rlCurve = computeRouletteCostCurve({ stake: rl.stake, spinsPerMin: 4 });
      var lastGlyph = getPocketGlyph(rl.lastPocket);
      if (!isLiveXdcHost) {
      html.push('<section class="zct-roulette-salon" id="zct-roulette-card" data-zct-table="roulette-3d">');
      html.push('  <div class="zct-table-head">');
      html.push('    <h4 class="zct-table-title">' + (ar ? 'صالون روليت مونت كارلو ثلاثي الأبعاد (٣٧ خانة · الرهانات الفرنسية)' : 'Monte-Carlo Noir 37-Pocket 3D Roulette Salon & French Call Bets') + '</h4>');
      html.push('    <div style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap">');
      html.push('      <span class="zct-pill" data-tone="gold"><bdi>' + (ar ? 'هامش موحّد ' : 'Uniform Edge ') + '2.70%</bdi></span>');
      html.push('      <button type="button" class="zct-inline-3d-inspect" data-z3d-inspect="roulette_wheel" data-z3d-cat="casino" data-z3d-title="Monte-Carlo 37-Pocket 3D Roulette Wheel">' + (ar ? 'فحص العجلة ٣٦٠°' : '360° 3D Orbit Wheel') + '</button>');
      html.push('    </div>');
      html.push('  </div>');
      html.push('  <div class="zct-roulette-grid">');
      html.push('    <div class="zct-roulette-viewport-wrap">');
      html.push('      <div class="z3d-action-stage zct-roulette-viewport" data-z3d-stage="casino-royale" data-z3d-submode="roulette" aria-label="' + (ar ? 'عجلة الروليت ثلاثية الأبعاد' : '3D European Roulette Wheel') + '"></div>');
      html.push('      <div class="zct-roulette-history" data-zct-roulette-hud="1">');
      html.push('        <span class="zct-pocket-chip" data-color="' + lastGlyph.color + '"><bdi>' + lastGlyph.symbol + ' ' + rl.lastPocket + '</bdi></span>');
      for (var rhi = 0; rhi < rl.history.length; rhi++) {
        var hp = rl.history[rhi];
        var hg = getPocketGlyph(hp);
        html.push('        <span class="zct-pocket-chip" data-color="' + hg.color + '"><bdi>' + hg.symbol + ' ' + hp + '</bdi></span>');
      }
      html.push('      </div>');
      html.push('    </div>');
      html.push('    <div class="zct-roulette-controls">');
      html.push('      <div class="zct-chip-row" role="group" aria-label="' + (ar ? 'قيمة رهان الروليت' : 'Roulette Stake') + '">');
      for (var rsi = 0; rsi < stakes.length; rsi++) {
        var rAmt = stakes[rsi];
        html.push('        <button type="button" class="zct-chip-btn" data-zct-act="roulette-stake" data-stake="' + rAmt + '" aria-pressed="' + (rl.stake === rAmt ? 'true' : 'false') + '"><bdi>' + fmtMoney(rAmt) + '</bdi></button>');
      }
      html.push('      </div>');
      html.push('      <div class="zct-call-bets-grid">');
      var callKeys = ['voisins_du_zero', 'tiers_du_cylindre', 'orphelins', 'jeu_zero', 'neighbors_5', 'straight', 'red', 'black'];
      for (var cki = 0; cki < callKeys.length; cki++) {
        var cb = ROULETTE_CALL_BETS[callKeys[cki]];
        var cbActive = rl.betId === cb.id;
        html.push('        <button type="button" class="zct-bet-btn" data-zct-act="roulette-bet" data-bet="' + cb.id + '" aria-pressed="' + (cbActive ? 'true' : 'false') + '">');
        html.push('          <span class="zct-bet-name">' + esc(ar ? cb.ar : cb.en) + '</span>');
        html.push('          <span class="zct-bet-meta"><bdi>EV -2.70% · RTP ' + rlCurve.expectedReturnPct.toFixed(1) + '%</bdi></span>');
        html.push('        </button>');
      }
      html.push('      </div>');
      html.push('      <div class="zct-number-select-row">');
      html.push('        <span>' + (ar ? 'الخانة المستهدفة (0-36):' : 'Target Pocket (0-36):') + '</span>');
      var quickPockets = [0, 7, 17, 23, 32, 36];
      for (var qpi = 0; qpi < quickPockets.length; qpi++) {
        var qp = quickPockets[qpi];
        var qg = getPocketGlyph(qp);
        html.push('        <button type="button" class="zct-chip-btn" data-zct-act="roulette-pocket" data-pocket="' + qp + '" aria-pressed="' + (rl.targetPocket === qp ? 'true' : 'false') + '"><bdi>' + qg.symbol + ' ' + qp + '</bdi></button>');
      }
      html.push('      </div>');
      html.push('      <button type="button" class="zct-primary-btn" data-zct-act="roulette-spin">' + (ar ? 'أدر عجلة الروليت ٣D · ' + fmtMoney(rl.stake) : 'Spin 37-Pocket 3D Wheel · ' + fmtMoney(rl.stake)) + '</button>');
      html.push('      <div class="zct-status-msg" data-tone="' + esc(rl.statusTone) + '" data-zct-roulette-status="1">' + esc(ar ? rl.statusAr : rl.statusEn) + '</div>');
      html.push('    </div>');
      html.push('  </div>');
      html.push('</section>');
      }

      // 3. Tables Grid (Single Full-Width Server-Authoritative 3D Craps Lounge on Live <x-dc>; 2-Col in Standalone)
      html.push('<div class="zct-tables-grid' + (isLiveXdcHost ? ' zct-tables-grid--single' : '') + '">');

      // --- LEFT: Interactive Street Craps & 3D Dice Physics ---
      html.push('  <section class="zct-table-card" id="zct-craps-card" data-zct-table="craps">');
      html.push('    <div class="zct-table-head">');
      html.push('      <h4 class="zct-table-title">' + (ar ? 'كرابس الشوارع ومونت كارلو 3D (نرد ٢١ نقطة)' : 'Monte-Carlo 3D Street Craps (21-Pip Tumbling 2d6)') + '</h4>');
      html.push('      <div style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap">');
      html.push('        <span class="zct-pill" data-tone="gold"><bdi>' + (ar ? 'نسبة الكازينو ' : 'House Edge ') + cOdds.houseEdgePct + '%</bdi></span>');
      html.push('        <button type="button" class="zct-inline-3d-inspect" data-z3d-inspect="craps_dice" data-z3d-cat="casino" data-z3d-title="Monte-Carlo 21-Pip 3D Casino Dice">' + (ar ? 'فحص النرد ٣٦٠°' : '360° 3D Orbit Dice') + '</button>');
      html.push('      </div>');
      html.push('    </div>');

      html.push('    <div class="zct-craps-stage">');
      html.push('      <div class="z3d-action-stage zct-craps-3d-viewport" data-z3d-stage="casino-royale" data-z3d-submode="craps" aria-label="' + (ar ? 'طاولة نرد كرابس ثلاثية الأبعاد' : '3D Monte-Carlo Craps Dice Tub') + '"></div>');
      html.push('      <canvas id="' + CRAPS_CANVAS_ID + '" class="zct-craps-canvas zct-craps-canvas--telemetry" hidden aria-hidden="true"></canvas>');
      html.push('      <div class="zct-craps-hud">');
      html.push('        <span class="zct-puck ' + (c.point ? 'is-on' : '') + '"><bdi>' + (c.point ? (ar ? 'النقطة ON ' + c.point : 'POINT ON ' + c.point) : (ar ? 'الافتتاح OFF' : 'COME-OUT OFF')) + '</bdi></span>');
      html.push('        <span><bdi>' + (ar ? 'آخر رمية: ' : 'Last Roll: ') + '🎲 ' + c.lastDice[0] + ' + ' + c.lastDice[1] + ' = ' + (c.lastDice[0] + c.lastDice[1]) + '</bdi></span>');
      html.push('      </div>');
      html.push('    </div>');

      // Stake chips
      html.push('    <div class="zct-chip-row" role="group" aria-label="' + (ar ? 'قيمة رهان الكرابس' : 'Craps Stake') + '">');
      for (var si = 0; si < stakes.length; si++) {
        var sAmt = stakes[si];
        html.push('      <button type="button" class="zct-chip-btn" data-zct-act="craps-stake" data-stake="' + sAmt + '" aria-pressed="' + (c.stake === sAmt ? 'true' : 'false') + '"><bdi>' + fmtMoney(sAmt) + '</bdi></button>');
      }
      html.push('    </div>');

      // 4 Wager Options
      html.push('    <div class="zct-bet-grid">');
      var betKeys = ['pass_line', 'dont_pass', 'field', 'hardways'];
      for (var bi = 0; bi < betKeys.length; bi++) {
        var b = CRAPS_BETS[betKeys[bi]];
        var active = c.betId === b.id;
        html.push('      <button type="button" class="zct-bet-btn" data-zct-act="craps-bet" data-bet="' + b.id + '" aria-pressed="' + (active ? 'true' : 'false') + '">');
        html.push('        <span class="zct-bet-name">' + esc(ar ? b.ar : b.en) + '</span>');
        html.push('        <span class="zct-bet-meta"><bdi>' + esc(ar ? b.payoutAr : b.payoutEn) + ' · ' + b.houseEdgePct + '%</bdi></span>');
        html.push('      </button>');
      }
      html.push('    </div>');

      if (c.betId === 'hardways') {
        html.push('    <div class="zct-hardway-row">');
        var hKeys = [4, 6, 8, 10];
        for (var hi = 0; hi < hKeys.length; hi++) {
          var hk = hKeys[hi];
          var ht = HARDWAY_TARGETS[hk];
          html.push('      <button type="button" class="zct-chip-btn" data-zct-act="craps-hard" data-hard="' + hk + '" aria-pressed="' + (c.hardTarget === hk ? 'true' : 'false') + '"><bdi>H' + hk + ' (' + ht.mult + ':1)</bdi></button>');
        }
        html.push('    </div>');
      }

      html.push('    <button type="button" class="zct-primary-btn" data-zct-act="craps-roll"' + (c.rolling ? ' disabled' : '') + '>' + (c.rolling ? (ar ? 'النرد يتدحرج...' : 'Dice Tumbling...') : (ar ? 'ارمِ النرد الآن · ' + fmtMoney(c.stake) : 'Shoot 3D Dice · ' + fmtMoney(c.stake))) + '</button>');
      html.push('    <div class="zct-status-msg" data-tone="' + esc(c.statusTone) + '" data-zct-craps-status="1">' + esc(ar ? c.statusAr : c.statusEn) + '</div>');
      html.push('  </section>');

      // --- RIGHT: Syndicate Blackjack & Provably-Fair Odds Inspector (Standalone Only; Live <x-dc> embeds EV Advisor directly in primary Blackjack 21!) ---
      if (!isLiveXdcHost) {
      html.push('  <section class="zct-table-card" id="zct-bj-card" data-zct-table="blackjack-ev">');
      html.push('    <div class="zct-table-head">');
      html.push('      <h4 class="zct-table-title">' + (ar ? 'بلاك جاك النقابة ومحلل الاحتمالات' : 'Syndicate Blackjack & Fair Odds Inspector') + '</h4>');
      html.push('      <span class="zct-pill" data-tone="sage">' + (ar ? 'طبيعي 3:2 · الموزع يقف عند 17' : 'Natural 3:2 · S17') + '</span>');
      html.push('    </div>');

      // Felt Cards Display
      html.push('    <div class="zct-bj-felt">');
      html.push('      <div class="zct-hand-row"><span>' + (ar ? 'يد الموزع' : 'Dealer') + '</span><bdi>' + (bj.dealerCards.length ? (bjPlaying ? esc(bj.dealerCards[0].val + '+?') : String(bjDealerEval.total)) : '-') + '</bdi></div>');
      html.push('      <div class="zct-cards-strip">');
      if (bj.dealerCards.length) {
        for (var di = 0; di < bj.dealerCards.length; di++) {
          var dc = bj.dealerCards[di];
          var hiddenHole = bjPlaying && di === 1;
          html.push('        <span class="zct-card' + (hiddenHole ? ' is-hole' : (dc.red ? ' is-red' : '')) + '"><bdi>' + (hiddenHole ? '??' : esc(dc.label)) + '</bdi></span>');
        }
      } else {
        html.push('        <span class="zct-card is-hole">??</span><span class="zct-card is-hole">??</span>');
      }
      html.push('      </div>');

      html.push('      <div class="zct-hand-row"><span>' + (ar ? 'يدك الحالية' : 'Your Hand') + '</span><bdi>' + (bjPlayerEval ? String(bjPlayerEval.total) + (bjPlayerEval.isSoft ? (ar ? ' (ناعم)' : ' (Soft)') : '') : '-') + '</bdi></div>');
      html.push('      <div class="zct-cards-strip">');
      if (bj.playerCards.length) {
        for (var pi = 0; pi < bj.playerCards.length; pi++) {
          var pc = bj.playerCards[pi];
          html.push('        <span class="zct-card' + (pc.red ? ' is-red' : '') + '"><bdi>' + esc(pc.label) + '</bdi></span>');
        }
      } else {
        html.push('        <span class="zct-card">A♠</span><span class="zct-card is-red">10♥</span>');
      }
      html.push('      </div>');
      html.push('    </div>');

      // Stake Chips
      html.push('    <div class="zct-chip-row" role="group" aria-label="' + (ar ? 'رهان البلاك جاك' : 'Blackjack Stake') + '">');
      for (var bsi = 0; bsi < stakes.length; bsi++) {
        var bAmt = stakes[bsi];
        html.push('      <button type="button" class="zct-chip-btn" data-zct-act="bj-stake" data-stake="' + bAmt + '" aria-pressed="' + (bj.stake === bAmt ? 'true' : 'false') + '"><bdi>' + fmtMoney(bAmt) + '</bdi></button>');
      }
      html.push('    </div>');

      // Deal / Hit / Stand / Double Action Buttons
      html.push('    <div class="zct-bj-actions">');
      html.push('      <button type="button" class="zct-action-btn" data-zct-act="bj-deal"' + (bjPlaying ? ' disabled' : '') + '>' + (ar ? 'توزيع' : 'Deal') + '</button>');
      html.push('      <button type="button" class="zct-action-btn' + (bjPlaying && ev.optimalAction === 'hit' ? ' is-optimal' : '') + '" data-zct-act="bj-hit"' + (!bjPlaying ? ' disabled' : '') + '>' + (ar ? 'سحب' : 'Hit') + '</button>');
      html.push('      <button type="button" class="zct-action-btn' + (bjPlaying && ev.optimalAction === 'stand' ? ' is-optimal' : '') + '" data-zct-act="bj-stand"' + (!bjPlaying ? ' disabled' : '') + '>' + (ar ? 'وقوف' : 'Stand') + '</button>');
      html.push('      <button type="button" class="zct-action-btn' + (bjPlaying && ev.optimalAction === 'double' ? ' is-optimal' : '') + '" data-zct-act="bj-double"' + (!bjPlaying || !bj.canDouble ? ' disabled' : '') + '>' + (ar ? 'مضاعفة' : 'Double') + '</button>');
      html.push('    </div>');

      // Tactical Odds & Expected-Value HUD
      html.push('    <div class="zct-ev-hud" data-zct-ev-hud="1">');
      html.push('      <div class="zct-ev-head">');
      html.push('        <span>' + (ar ? 'محلل القيمة المتوقعة التكتيكي (EV)' : 'Tactical Odds & Expected-Value HUD') + '</span>');
      html.push('        <span class="zct-pill" data-tone="sage"><bdi>' + (ar ? 'الأمثل: ' : 'Best: ') + esc(optLabel) + '</bdi></span>');
      html.push('      </div>');
      html.push('      <div class="zct-ev-bars">');
      var evRows = [
        { id: 'hit', en: 'Hit', ar: 'سحب', val: ev.hitEV },
        { id: 'stand', en: 'Stand', ar: 'وقوف', val: ev.standEV },
        { id: 'double', en: 'Double', ar: 'مضاعفة', val: ev.doubleEV }
      ];
      for (var ei = 0; ei < evRows.length; ei++) {
        var er = evRows[ei];
        var isBest = ev.optimalAction === er.id;
        html.push('        <div class="zct-ev-item' + (isBest ? ' is-best' : '') + '" data-zct-ev-opt="' + er.id + '">');
        html.push('          <div class="zct-ev-top"><span>' + (ar ? er.ar : er.en) + '</span><bdi>' + formatEvVal(er.val) + '</bdi></div>');
        html.push('          <div class="zct-ev-track"><div class="zct-ev-fill" style="width:' + evBarWidth(er.val) + '%"></div></div>');
        html.push('        </div>');
      }
      html.push('      </div>');
      html.push('      <div class="zct-hand-row" style="color:var(--zct-ink-muted);font-size:10px">');
      html.push('        <span><bdi>' + (ar ? 'احتمال الخسارة بالسحب: ' : 'Bust on Hit: ') + ev.bustProbPct + '%</bdi></span>');
      html.push('        <span><bdi>' + (ar ? 'تجاوز الموزع: ' : 'Dealer Bust: ') + ev.dealerBustPct + '%</bdi></span>');
      html.push('      </div>');
      html.push('    </div>');

      // Provably-Fair Commitment Inspector
      html.push('    <div class="zct-fair-box" data-zct-provably-fair="1">');
      html.push('      <span>' + (ar ? 'بصمة الحذاء العادل:' : 'Provably-Fair Shoe:') + ' <bdi>' + bj.fair.shoe.length + '/312</bdi> · #' + bj.fair.nonce + '</span>');
      html.push('      <span class="zct-fair-hash"><bdi>' + esc(bj.fair.serverSeedHash) + '</bdi></span>');
      html.push('    </div>');

      html.push('    <div class="zct-status-msg" data-tone="' + esc(bj.statusTone) + '" data-zct-bj-status="1">' + esc(ar ? bj.statusAr : bj.statusEn) + '</div>');
      html.push('  </section>');
      }

      html.push('</div>');
      return html.join('\n');
    }

    function renderActiveScreenMount() {
      if (typeof document === 'undefined') return false;
      var main = document.getElementById('zone-main');
      if (!main) return false;

      var screen = getActiveScreen();
      if (screen !== 'casino') {
        store.mounted = false;
        removeIfPresent(CONTAINER_ID);
        return false;
      }

      ensureStylesheetLink();

      var host = document.getElementById(CONTAINER_ID);
      if (!host) {
        host = document.createElement('section');
        host.id = CONTAINER_ID;
        host.className = 'zct-scope';
        host.setAttribute('data-zct-mounted', 'casino');
      }

      var hasXdc = Boolean(document.querySelector && document.querySelector('x-dc'));
      var casinoPit = main.querySelector('[data-zone-casino-pit="1"]');
      if (!hasXdc && casinoPit && casinoPit.parentElement) {
        if (casinoPit.nextElementSibling !== host) {
          casinoPit.insertAdjacentElement('afterend', host);
        }
      } else if (host.parentElement !== main) {
        main.appendChild(host);
      }

      var nextHtml = buildInnerHtml();
      if (host.__zctLastHtml !== nextHtml) {
        host.__zctLastHtml = nextHtml;
        host.innerHTML = nextHtml;
        if (typeof window !== 'undefined' && window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
          window.ZoneEcs3D.scan(host);
        }
      }
      store.mounted = true;
      drawCrapsCanvas();
      return true;
    }

    function handleDomClick(ev) {
      var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zct-act]') : null;
      if (!target) {
        if (ev.target && ev.target.id === CRAPS_CANVAS_ID && !store.craps.rolling) {
          shootCrapsDice();
        }
        return;
      }
      if (target.disabled) return;
      ev.preventDefault();
      var act = target.getAttribute('data-zct-act');
      if (act === 'toggle-vip') {
        store.vipMode = !store.vipMode;
        store.craps.stake = store.vipMode ? 5000 : 1000;
        store.bj.stake = store.vipMode ? 5000 : 1000;
        store.roulette.stake = store.vipMode ? 5000 : 1000;
        triggerAudioCue('ui_nav', { source: 'vip_toggle' });
        renderActiveScreenMount();
      } else if (act === 'reset-guard') {
        resetStreakGuard();
      } else if (act === 'roulette-stake') {
        store.roulette.stake = Math.max(500, Number(target.getAttribute('data-stake')) || 1000);
        triggerAudioCue('ui_nav', { source: 'roulette_stake' });
        renderActiveScreenMount();
      } else if (act === 'roulette-bet') {
        var rbId = target.getAttribute('data-bet');
        if (ROULETTE_CALL_BETS[rbId]) {
          store.roulette.betId = rbId;
          triggerAudioCue('ui_nav', { source: 'roulette_bet' });
          renderActiveScreenMount();
        }
      } else if (act === 'roulette-pocket') {
        store.roulette.targetPocket = Math.max(0, Math.min(36, Number(target.getAttribute('data-pocket')) || 0));
        triggerAudioCue('ui_nav', { source: 'roulette_pocket' });
        renderActiveScreenMount();
      } else if (act === 'roulette-spin') {
        spinRouletteWheel();
      } else if (act === 'craps-stake') {
        store.craps.stake = Math.max(500, Number(target.getAttribute('data-stake')) || 1000);
        triggerAudioCue('ui_nav', { source: 'craps_stake' });
        renderActiveScreenMount();
      } else if (act === 'craps-bet') {
        var bId = target.getAttribute('data-bet');
        if (CRAPS_BETS[bId]) {
          store.craps.betId = bId;
          store.craps.point = null;
          store.craps.hardwaysActive = false;
          triggerAudioCue('ui_nav', { source: 'craps_bet' });
          renderActiveScreenMount();
        }
      } else if (act === 'craps-hard') {
        var hVal = Number(target.getAttribute('data-hard'));
        if (HARDWAY_TARGETS[hVal]) {
          store.craps.hardTarget = hVal;
          renderActiveScreenMount();
        }
      } else if (act === 'craps-roll') {
        shootCrapsDice();
      } else if (act === 'bj-stake') {
        store.bj.stake = Math.max(500, Number(target.getAttribute('data-stake')) || 1000);
        triggerAudioCue('ui_nav', { source: 'bj_stake' });
        renderActiveScreenMount();
      } else if (act === 'bj-deal') {
        blackjackAction('deal');
      } else if (act === 'bj-hit') {
        blackjackAction('hit');
      } else if (act === 'bj-stand') {
        blackjackAction('stand');
      } else if (act === 'bj-double') {
        blackjackAction('double');
      }
    }

    var syncScheduled = false;
    function scheduleSync() {
      if (syncScheduled) return;
      syncScheduled = true;
      var run = function () {
        syncScheduled = false;
        renderActiveScreenMount();
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(run);
      } else {
        setTimeout(run, 16);
      }
    }

    function boot() {
      if (typeof document === 'undefined' || typeof window === 'undefined') return;
      document.addEventListener('click', handleDomClick);
      window.addEventListener('zone:render', scheduleSync);
      window.addEventListener('zone:3d-stage-click', function (ev) {
        var d = ev && ev.detail ? ev.detail : {};
        if ((d.target === 'craps' || d.submode === 'craps') && getActiveScreen() === 'casino' && !store.craps.rolling) {
          shootCrapsDice();
        }
      });

      if (typeof MutationObserver === 'function' && document.documentElement) {
        var rootObs = new MutationObserver(scheduleSync);
        rootObs.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme', 'dir', 'lang', 'data-zone-reduced-motion', 'data-zone-contrast']
        });

        var mainObs = null;
        var observedMain = null;
        var attachMain = function () {
          var m = document.getElementById('zone-main');
          if (!m || m === observedMain) return;
          if (mainObs) {
            try { mainObs.disconnect(); } catch (_) {}
          }
          observedMain = m;
          mainObs = new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
              var rec = records[i];
              if (rec.type === 'attributes') {
                scheduleSync();
                return;
              }
              if (rec.type === 'childList') {
                for (var n = 0; n < rec.addedNodes.length; n++) {
                  var nd = rec.addedNodes[n];
                  if (nd && nd.nodeType === 1 && nd.id !== CONTAINER_ID) {
                    scheduleSync();
                    return;
                  }
                }
              }
            }
          });
          mainObs.observe(m, {
            attributes: true,
            attributeFilter: ['data-zone-screen'],
            childList: true
          });
        };
        attachMain();
        window.addEventListener('zone:render', attachMain);
      }
      scheduleSync();
    }

    return {
      EUROPEAN_ROULETTE_ORDER: EUROPEAN_ROULETTE_ORDER,
      ROULETTE_CALL_BETS: ROULETTE_CALL_BETS,
      boot: boot,
      render: renderActiveScreenMount,
      spinRouletteWheel: spinRouletteWheel,
      evaluateRouletteSpin: evaluateRouletteSpin,
      computeRouletteCostCurve: computeRouletteCostCurve,
      shootCrapsDice: shootCrapsDice,
      blackjackAction: blackjackAction,
      resetStreakGuard: resetStreakGuard,
      computeCrapsOdds: computeCrapsOdds,
      evaluateCrapsRoll: evaluateCrapsRoll,
      computeBlackjackEV: computeBlackjackEV,
      evaluateHand: evaluateHand,
      stepDicePhysics: stepDicePhysics,
      createDiceBodies: createDiceBodies,
      applyDiceThrowImpulse: applyDiceThrowImpulse,
      getEquilibriumSummary: getEquilibriumSummary,
      getActiveBlackjackInspection: getActiveBlackjackInspection,
      setRouletteBet: function (betId, targetPocket) {
        if (ROULETTE_CALL_BETS[betId]) store.roulette.betId = betId;
        if (targetPocket !== undefined) store.roulette.targetPocket = Math.max(0, Math.min(36, Math.round(Number(targetPocket) || 0)));
        renderActiveScreenMount();
      },
      setCrapsBet: function (betId, hardTarget) {
        if (CRAPS_BETS[betId]) store.craps.betId = betId;
        if (HARDWAY_TARGETS[Number(hardTarget)]) store.craps.hardTarget = Number(hardTarget);
        renderActiveScreenMount();
      },
      setStake: function (game, amount) {
        var val = Math.max(500, Math.round(Number(amount) || 1000));
        if (game === 'craps') store.craps.stake = val;
        if (game === 'bj') store.bj.stake = val;
        if (game === 'roulette') store.roulette.stake = val;
        renderActiveScreenMount();
      },
      getState: function () {
        return store;
      },
      diagnostics: function () {
        var mountedEl = typeof document !== 'undefined' ? document.getElementById(CONTAINER_ID) : null;
        return {
          ready: true,
          screen: getActiveScreen(),
          mounted: Boolean(mountedEl),
          crapsRollCount: store.craps.rollCount,
          bjStatus: store.bj.status,
          bankroll: store.bankroll,
          streakGuardTriggered: store.streakGuard.triggered,
          equilibrium: getEquilibriumSummary()
        };
      }
    };
  }

  var singleton = createZoneCasinoTablesRuntime();
  if (typeof window !== 'undefined') {
    if (!window.__zoneCasinoTablesBooted) {
      window.__zoneCasinoTablesBooted = true;
      window.ZoneCasinoTables = singleton;
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', singleton.boot, { once: true });
        } else {
          singleton.boot();
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      EUROPEAN_ROULETTE_ORDER: EUROPEAN_ROULETTE_ORDER,
      ROULETTE_CALL_BETS: ROULETTE_CALL_BETS,
      createZoneCasinoTablesRuntime: createZoneCasinoTablesRuntime,
      evaluateRouletteSpin: evaluateRouletteSpin,
      computeRouletteCostCurve: computeRouletteCostCurve,
      computeCrapsOdds: computeCrapsOdds,
      evaluateCrapsRoll: evaluateCrapsRoll,
      computeBlackjackEV: computeBlackjackEV,
      evaluateHand: evaluateHand,
      stepDicePhysics: stepDicePhysics,
      createDiceBodies: createDiceBodies,
      applyDiceThrowImpulse: applyDiceThrowImpulse
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

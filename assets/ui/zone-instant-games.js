/* ZONE v120 - Gemini-4 HTML5 Canvas Instant Games & Noir Arcade HUD Engine */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneInstantGamesLoaded) return;
  window.__zoneInstantGamesLoaded = true;

  var EU_WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var RED_POCKETS = {
    1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1,
    19: 1, 21: 1, 23: 1, 25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1
  };
  var SLOT_SYMS = [
    { id: 'DIAMOND', glyph: '💎', color: '#6ee7ff', labelEn: 'DIAMOND', labelAr: 'ألماس' },
    { id: 'SEVEN', glyph: '777', color: '#ff5d6c', labelEn: 'LUCKY 7', labelAr: 'سبعة' },
    { id: 'CROWN', glyph: '👑', color: '#ebb858', labelEn: 'CROWN', labelAr: 'تاج' },
    { id: 'GOLD_BAR', glyph: '🪙', color: '#fbbf24', labelEn: 'GOLD', labelAr: 'سبيكة' },
    { id: 'CHIP', glyph: '♠', color: '#39e7a3', labelEn: 'SPADE', labelAr: 'سبيد' },
    { id: 'CHERRY', glyph: '🍒', color: '#f43f5e', labelEn: 'CHERRY', labelAr: 'كرز' }
  ];

  function isAr() {
    return (document.documentElement.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function fontStack(weight, px) {
    return weight + ' ' + px + 'px "Rubik","Cairo",system-ui,sans-serif';
  }

  /* ---------------- WebAudio Procedural Arcade Synth ---------------- */
  var audioCtx = null;
  var soundEnabled = true;

  function ensureAudio() {
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
    crash: function () {
      tone(150, 0.24, 'sawtooth', 0.09, 42, 0);
    }
  };

  /* ---------------- Sizing Helper ---------------- */
  function syncCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(220, Math.round(rect.width || canvas.parentElement?.clientWidth || 320));
    var h = cssHeight || Math.max(80, Math.round(rect.height || 180));
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

  function spawnFloatingReward(text, color) {
    try {
      var cashEl = document.getElementById('zone-cash');
      var r = cashEl ? cashEl.getBoundingClientRect() : { left: window.innerWidth * 0.5, top: 80, width: 40 };
      var pop = document.createElement('div');
      pop.className = 'zig-float-pop';
      pop.style.left = Math.round(r.left + r.width * 0.5) + 'px';
      pop.style.top = Math.round(Math.max(48, r.top)) + 'px';
      pop.style.color = color || '#49f0a1';
      pop.textContent = text;
      document.body.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 1300);
    } catch (_) {}
  }

  /* ---------------- Game State Containers ---------------- */
  var state = {
    t: 0,
    lastCash: null,
    lastLang: '',
    /* Nitro Getaway (Home Instant Game) */
    getaway: {
      open: false,
      running: false,
      lane: 1.5,
      targetLane: 1.5,
      speed: 260,
      score: 0,
      best: 0,
      bags: 0,
      combo: 1,
      nitro: 100,
      boosting: false,
      flash: 0,
      gameOver: false,
      entities: [],
      spawnTimer: 0,
      particles: []
    },
    /* Safe-Crack Reflex (Crimes) */
    heist: {
      angle: 0,
      speed: 2.55,
      dir: 1,
      targetCenter: 1.1,
      targetArc: 0.78,
      streak: 0,
      banner: '',
      bannerColor: '#ebb858',
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
      banner: '',
      bannerColor: '#39e7a3',
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

  function goScreen(id) {
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(id);
      return;
    }
    var btn = document.querySelector('#zone-area-navigation button[data-zone-screen="' + id + '"]');
    if (btn) btn.click();
  }

  /* ---------------- 1. HOME: Arcade Portal + Playable Nitro Getaway ---------------- */
  function startGetawayRun() {
    var gw = state.getaway;
    gw.open = true;
    gw.running = true;
    gw.gameOver = false;
    gw.lane = 1.5;
    gw.targetLane = 1.5;
    gw.speed = 275;
    gw.score = 0;
    gw.bags = 0;
    gw.combo = 1;
    gw.nitro = 100;
    gw.boosting = false;
    gw.entities = [];
    gw.particles = [];
    gw.spawnTimer = 0.35;
    sfx.pickup();
    var stage = document.getElementById('zig-getaway-stage');
    if (stage) stage.hidden = false;
  }

  function mountHomeArcade() {
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'home') {
      var stale = document.getElementById('zig-home-arcade');
      if (stale) stale.remove();
      return;
    }
    var brief = main.querySelector('.zone-home-brief');
    if (!brief) return;
    var ar = isAr();
    var existing = document.getElementById('zig-home-arcade');
    if (existing && existing.getAttribute('data-lang') === (ar ? 'ar' : 'en')) return;
    if (existing) existing.remove();

    var sec = document.createElement('section');
    sec.id = 'zig-home-arcade';
    sec.className = 'zig-arcade-deck';
    sec.setAttribute('data-lang', ar ? 'ar' : 'en');

    var cards = [
      {
        id: 'getaway',
        kicker: ar ? 'لعبة فورية · العب هنا' : 'INSTANT GAME · PLAY NOW',
        name: ar ? 'مطاردة النيون الليلية' : 'Nitro Syndicate Getaway',
        desc: ar ? 'راوغ دوريات الشرطة واجمع حقائب الغنائم في شوارع زون.' : 'Dodge police cruisers & grab cash drops at 160 MPH.',
        cta: ar ? 'تشغيل فوري ▶' : 'Launch Run ▶'
      },
      {
        id: 'heist',
        kicker: ar ? 'مهارة وتوقيت' : 'REFLEX LOCKPICK',
        name: ar ? 'كسر الخزنة المصفحة' : 'Safe-Crack Heist',
        desc: ar ? 'اضرب القفل في النقطة الذهبية لتنفيذ عملياتك.' : 'Hit the brass tumbler sweet-spot to breach vaults.',
        cta: ar ? 'ادخل الجرائم ▶' : 'Crack Vaults ▶'
      },
      {
        id: 'casino',
        kicker: ar ? 'عجلة حية وسلوتس' : '3D FELT & REELS',
        name: ar ? 'كازينو المخمل السري' : 'Velvet Roulette & Slots',
        desc: ar ? 'عجلة روليت دوارة وماكينات جائزة كبرى وبلاك جاك.' : 'Spinning 37-pocket wheel, neon reels & 21 shoe.',
        cta: ar ? 'افتح الطاولات ▶' : 'Spin Wheel ▶'
      },
      {
        id: 'gym',
        kicker: ar ? 'عداد القوة' : 'POWER METER',
        name: ar ? 'تحدي كيس الملاكمة' : 'Heavy-Bag Overdrive',
        desc: ar ? 'سدّد اللكمة في ذروة العداد لمضاعفة زخم التمرين.' : 'Time heavy-bag strikes in the red zone to train.',
        cta: ar ? 'ادخل الحلبة ▶' : 'Hit The Bag ▶'
      }
    ];

    sec.innerHTML =
      '<div class="zig-arcade-header">' +
        '<div class="zig-arcade-title-wrap">' +
          '<div class="zig-arcade-emblem">⚡</div>' +
          '<div>' +
            '<h2 class="zig-arcade-title">' + (ar ? 'ألعاب زون الفورية · اللعب المباشر' : 'ZONE INSTANT ARCADE · LIVE PLAY') + '</h2>' +
            '<p class="zig-arcade-sub">' + (ar ? 'اختر وضعاً تفاعلياً للعب فوراً بدلاً من القوائم التقليدية' : 'Jump straight into interactive arcade action tied to your operative') + '</p>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="zig-sound-btn" id="zig-sound-toggle">' +
          (soundEnabled ? (ar ? '🔊 المؤثرات: مفعلة' : '🔊 SFX: ON') : (ar ? '🔇 المؤثرات: صامت' : '🔇 SFX: OFF')) +
        '</button>' +
      '</div>' +
      '<div class="zig-arcade-grid">' +
        cards.map(function (c) {
          return (
            '<button type="button" class="zig-game-card" data-zig-launch="' + c.id + '">' +
              '<canvas data-zig-preview="' + c.id + '"></canvas>' +
              '<div class="zig-game-card-body">' +
                '<span class="zig-game-card-kicker">' + c.kicker + '</span>' +
                '<strong class="zig-game-card-name">' + c.name + '</strong>' +
                '<span class="zig-game-card-desc">' + c.desc + '</span>' +
                '<span class="zig-game-card-cta"><span>' + c.cta + '</span><span>→</span></span>' +
              '</div>' +
            '</button>'
          );
        }).join('') +
      '</div>' +
      '<div class="zig-getaway-stage" id="zig-getaway-stage"' + (state.getaway.open ? '' : ' hidden') + '>' +
        '<div class="zig-getaway-bar">' +
          '<div>' +
            '<strong style="color:#ebb858;font-size:12.5px;text-transform:uppercase;letter-spacing:.05em">' +
              (ar ? '🏎️ مطاردة النيون الليلية · الأسهم أو اللمس للمراوغة' : '🏎️ NITRO SYNDICATE GETAWAY · ARROWS / TAP LANES TO DODGE') +
            '</strong>' +
          '</div>' +
          '<div class="zig-stage-controls">' +
            '<button type="button" class="zig-btn" id="zig-getaway-restart">' + (ar ? 'جولة جديدة' : 'New Run') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-fence">' + (ar ? 'تصريف الغنيمة (عملية شارع)' : 'Fence Loot (Run Street Op)') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-close">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="zig-getaway-canvas-wrap"><canvas id="zig-getaway-canvas"></canvas></div>' +
      '</div>';

    brief.insertAdjacentElement('afterend', sec);

    var sndBtn = sec.querySelector('#zig-sound-toggle');
    if (sndBtn) {
      sndBtn.addEventListener('click', function () {
        soundEnabled = !soundEnabled;
        if (soundEnabled) sfx.pickup();
        sndBtn.textContent = soundEnabled ? (isAr() ? '🔊 المؤثرات: مفعلة' : '🔊 SFX: ON') : (isAr() ? '🔇 المؤثرات: صامت' : '🔇 SFX: OFF');
      });
    }

    sec.querySelectorAll('[data-zig-launch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-zig-launch');
        ensureAudio();
        if (id === 'getaway') {
          startGetawayRun();
        } else if (id === 'heist') {
          sfx.lockClick();
          goScreen('crimes');
        } else if (id === 'casino') {
          sfx.wheelTick();
          goScreen('casino');
        } else if (id === 'gym') {
          sfx.punch(true);
          goScreen('gym');
        }
      });
    });

    var restartBtn = sec.querySelector('#zig-getaway-restart');
    if (restartBtn) restartBtn.addEventListener('click', startGetawayRun);

    var closeBtn = sec.querySelector('#zig-getaway-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        state.getaway.open = false;
        state.getaway.running = false;
        var st = document.getElementById('zig-getaway-stage');
        if (st) st.hidden = true;
      });
    }

    var fenceBtn = sec.querySelector('#zig-getaway-fence');
    if (fenceBtn) {
      fenceBtn.addEventListener('click', function () {
        sfx.breachWin();
        var v = window.__zoneLastView;
        var readyCrime = v && Array.isArray(v.crimes) ? v.crimes.find(function (c) { return !c.disabled; }) : null;
        if (readyCrime && typeof readyCrime.commit === 'function') {
          readyCrime.commit();
          spawnFloatingReward(isAr() ? '⚡ جارٍ تصريف الغنيمة!' : '⚡ FENCING LOOT!', '#ebb858');
        } else {
          goScreen('crimes');
        }
      });
    }

    var gCanvas = sec.querySelector('#zig-getaway-canvas');
    if (gCanvas) {
      var steerFromEvent = function (e) {
        ensureAudio();
        if (state.getaway.gameOver || !state.getaway.running) {
          startGetawayRun();
          return;
        }
        var rect = gCanvas.getBoundingClientRect();
        var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        var roadW = Math.min(rect.width * 0.72, 380);
        var roadLeft = (rect.width - roadW) * 0.5;
        var rel = (clientX - rect.left - roadLeft) / roadW;
        var lane = Math.max(0, Math.min(3, Math.floor(rel * 4)));
        state.getaway.targetLane = lane;
        sfx.lockClick();
      };
      gCanvas.addEventListener('pointerdown', steerFromEvent);
    }
  }

  /* ---------------- 2. CRIMES: Safe-Crack Reflex Canvas ---------------- */
  function triggerHeistStrike() {
    ensureAudio();
    var h = state.heist;
    var diff = Math.atan2(Math.sin(h.angle - h.targetCenter), Math.cos(h.angle - h.targetCenter));
    var absDiff = Math.abs(diff);
    var halfArc = h.targetArc * 0.5;
    var ar = isAr();

    if (absDiff <= halfArc) {
      var perfect = absDiff <= halfArc * 0.38;
      h.streak += 1;
      h.banner = perfect
        ? (ar ? '🔥 اختراق ذهبي متقن! سلسلة ×' + h.streak : '🔥 PERFECT BREACH! STREAK x' + h.streak)
        : (ar ? '✓ تم فتح القفل! سلسلة ×' + h.streak : '✓ TUMBLER CRACKED! STREAK x' + h.streak);
      h.bannerColor = perfect ? '#ebb858' : '#39e7a3';
      h.bannerUntil = performance.now() + 2000;
      sfx.breachWin();
      for (var i = 0; i < 28; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 170;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.55 + Math.random() * 0.35,
          color: i % 2 ? '#ebb858' : '#39e7a3'
        });
      }
      h.dir *= -1;
      h.targetCenter = Math.random() * Math.PI * 2;
      h.speed = Math.min(4.1, 2.4 + h.streak * 0.16);

      /* Trigger real authoritative crime commit if ready */
      var selected = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
      if (selected && !selected.disabled && typeof selected.commit === 'function') {
        selected.commit();
      } else {
        var btn = document.querySelector('.zone-crime-plan button[data-crime-attempt]:not([disabled])');
        if (btn) btn.click();
      }
    } else {
      h.streak = 0;
      h.speed = 2.45;
      h.sirenUntil = performance.now() + 950;
      h.banner = ar ? '🚨 انزلق القفل! اضغط داخل القوس الذهبي' : '🚨 TUMBLER SLIPPED! HIT THE GOLD ARC';
      h.bannerColor = '#ff6a55';
      h.bannerUntil = performance.now() + 1500;
      sfx.sirenBuzz();
      for (var j = 0; j < 14; j++) {
        var a2 = Math.random() * Math.PI * 2;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a2) * 90,
          vy: Math.sin(a2) * 90,
          life: 0.4,
          color: '#ff5d6c'
        });
      }
    }
  }

  function mountCrimesGame() {
    var scene = document.querySelector('#zone-main[data-zone-screen="crimes"] .zone-crime-scene');
    if (!scene) return;
    if (scene.querySelector('#zig-heist-canvas')) return;
    var wrap = document.createElement('div');
    wrap.className = 'zig-heist-wrap';
    wrap.innerHTML = '<canvas id="zig-heist-canvas" aria-label="Safe-Crack Heist Mini-Game"></canvas>';
    scene.appendChild(wrap);
    var c = wrap.querySelector('canvas');
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      triggerHeistStrike();
    });
  }

  /* ---------------- 3. GYM: Heavy-Bag Overdrive Canvas ---------------- */
  function triggerGymStrike() {
    ensureAudio();
    var gm = state.gym;
    var dist = Math.abs(gm.gaugePos - 0.5);
    var overdrive = dist <= 0.14;
    var ar = isAr();

    gm.bagVel = -(overdrive ? 6.8 : 4.1);
    gm.combo = overdrive ? gm.combo + 1 : 1;
    gm.banner = overdrive
      ? (ar ? '💥 ضربة قاضية في الذروة! ×' + gm.combo : '💥 OVERDRIVE SWEET-SPOT! x' + gm.combo)
      : (ar ? '🥊 ضربة مباشرة! استمر' : '🥊 SOLID BAG HIT!');
    gm.bannerColor = overdrive ? '#ebb858' : '#39e7a3';
    gm.bannerUntil = performance.now() + 1600;
    sfx.punch(overdrive);

    gm.rings.push({ r: 14, alpha: 0.9, color: overdrive ? '#ebb858' : '#39e7a3' });
    for (var i = 0; i < (overdrive ? 24 : 12); i++) {
      var ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
      var spd = 60 + Math.random() * 140;
      gm.sparks.push({
        x: 0, y: 0,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.3,
        color: overdrive ? '#ebb858' : '#39e7a3'
      });
    }

    var sess = window.__zoneLastView && window.__zoneLastView.gymSession;
    var trainBtn = document.querySelector('.zone-gym-session button[data-gym-train]:not([disabled])');
    if (sess && typeof sess.train === 'function' && trainBtn) {
      sess.train();
    } else if (trainBtn) {
      trainBtn.click();
    }
  }

  function mountGymGame() {
    var sessionBox = document.querySelector('#zone-main[data-zone-screen="gym"] .zone-gym-session');
    if (!sessionBox) return;
    if (sessionBox.querySelector('#zig-gym-canvas')) return;
    var trainBtn = sessionBox.querySelector('button[data-gym-train]');
    var wrap = document.createElement('div');
    wrap.className = 'zig-gym-wrap';
    wrap.innerHTML = '<canvas id="zig-gym-canvas" aria-label="Heavy-Bag Reflex Trainer"></canvas>';
    if (trainBtn) {
      trainBtn.insertAdjacentElement('beforebegin', wrap);
    } else {
      sessionBox.appendChild(wrap);
    }
    wrap.querySelector('canvas').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      triggerGymStrike();
    });
  }

  /* ---------------- 4. CASINO: Roulette Wheel + 3-Reel Neon Slots ---------------- */
  function startRouletteAnimation() {
    var rl = state.roulette;
    rl.spinning = true;
    rl.settling = false;
    rl.wheelSpeed = 2.6;
    rl.ballSpeed = -9.4;
    rl.ballRadiusFrac = 0.88;
  }

  function startSlotsAnimation() {
    var sl = state.slots;
    sl.spinning = true;
    sl.spinStart = performance.now();
    sl.locked = [false, false, false];
    sl.speeds = [22, 25, 28];
    sl.leverPull = 1;
    sfx.lockClick();
  }

  function mountCasinoGames() {
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'casino') return;

    /* Roulette Wheel Canvas */
    var rTable = main.querySelector('[data-casino-table="roulette"]');
    if (rTable && !rTable.querySelector('#zig-roulette-canvas')) {
      var rHeader = rTable.firstElementChild;
      var rBox = document.createElement('div');
      rBox.className = 'zig-casino-canvas-box';
      rBox.innerHTML = '<canvas id="zig-roulette-canvas" aria-label="European Roulette Wheel"></canvas>';
      if (rHeader) rHeader.insertAdjacentElement('afterend', rBox);
      else rTable.prepend(rBox);

      rBox.querySelector('canvas').addEventListener('pointerdown', function () {
        ensureAudio();
        var redBtn = rTable.querySelector('[data-roulette-bet="red"]:not([disabled])');
        startRouletteAnimation();
        if (redBtn) redBtn.click();
      });

      rTable.addEventListener('click', function (ev) {
        var betBtn = ev.target && ev.target.closest ? ev.target.closest('[data-roulette-bet]') : null;
        if (betBtn && !betBtn.disabled) {
          ensureAudio();
          startRouletteAnimation();
        }
      });
    }

    /* 3-Reel Jackpot Slots Canvas */
    var sTable = main.querySelector('[data-casino-table="slots"]');
    if (sTable && !sTable.querySelector('#zig-slots-canvas')) {
      sTable.classList.add('zig-slots-mounted');
      var jackpotBanner = sTable.children[1] || sTable.firstElementChild;
      var sBox = document.createElement('div');
      sBox.className = 'zig-casino-canvas-box';
      sBox.innerHTML = '<canvas id="zig-slots-canvas" aria-label="3-Reel Neon Slot Machine"></canvas>';
      if (jackpotBanner) jackpotBanner.insertAdjacentElement('afterend', sBox);
      else sTable.prepend(sBox);

      var triggerSpin = function () {
        ensureAudio();
        startSlotsAnimation();
        var g = window.__zoneGame;
        if (g && typeof g.spinSlots === 'function' && !g.slotsBusy) {
          g.spinSlots();
        }
      };

      sBox.querySelector('canvas').addEventListener('pointerdown', triggerSpin);
      sTable.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (btn && btn.classList.contains('zone-action-primary') && !btn.disabled) {
          ensureAudio();
          startSlotsAnimation();
        }
      });
    }
  }

  /* ---------------- 5. ATTACK: Street Brawl Versus Banner ---------------- */
  function mountAttackBanner() {
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
    var youName = (v && v.t && v.t.player) || 'Operative';
    var oppName = f ? f.name : (v && v.opps && v.opps[0] ? v.opps[0].name : (ar ? 'خصم الشارع' : 'Street Rival'));
    var youPct = f ? f.youPct : 100;
    var oppPct = f ? f.oppPct : 100;
    var statusTxt = f ? f.verdict + ' · ' + f.progress : (ar ? 'اختر خصماً لبدء القتال' : 'SELECT RIVAL BELOW TO ENGAGE');

    banner.innerHTML =
      '<div class="zig-brawl-side">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#e2e8f0"><span>' + youName + '</span><bdi style="color:#39e7a3">' + youPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div style="height:100%;width:' + youPct + '%;background:linear-gradient(90deg,#2563eb,#39e7a3);transition:width .25s"></div></div>' +
      '</div>' +
      '<div style="text-align:center;flex:none">' +
        '<div class="zig-brawl-vs">VS</div>' +
        '<div style="font-size:9.5px;color:#94a3b8;font-weight:700">' + statusTxt + '</div>' +
      '</div>' +
      '<div class="zig-brawl-side">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#e2e8f0"><span>' + oppName + '</span><bdi style="color:#ff6a55">' + oppPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div style="height:100%;width:' + oppPct + '%;background:linear-gradient(90deg,#ef4444,#f59e0b);transition:width .25s"></div></div>' +
      '</div>';
  }

  /* ---------------- Keyboard Controls ---------------- */
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    var main = document.getElementById('zone-main');
    var scr = main ? main.getAttribute('data-zone-screen') : '';

    if (scr === 'home' && state.getaway.open && state.getaway.running) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        state.getaway.targetLane = Math.max(0, Math.round(state.getaway.targetLane) - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        state.getaway.targetLane = Math.min(3, Math.round(state.getaway.targetLane) + 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        state.getaway.boosting = true;
      }
    } else if (scr === 'crimes' && e.key === ' ') {
      if (document.getElementById('zig-heist-canvas')) {
        e.preventDefault();
        triggerHeistStrike();
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === ' ') state.getaway.boosting = false;
  });

  /* ---------------- Renderers (60fps Canvas Loop) ---------------- */
  function renderHomePreviews(dt, now) {
    var previews = document.querySelectorAll('canvas[data-zig-preview]');
    if (!previews.length) return;
    previews.forEach(function (cv) {
      var kind = cv.getAttribute('data-zig-preview');
      var s = syncCanvas(cv, 98);
      if (!s) return;
      var ctx = s.ctx, w = s.w, h = s.h;
      ctx.clearRect(0, 0, w, h);

      var bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0b1220');
      bg.addColorStop(1, '#05080f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      if (kind === 'getaway') {
        /* Mini Neon Highway Preview */
        var rw = w * 0.56, rx = (w - rw) * 0.5;
        ctx.fillStyle = '#090f1d';
        ctx.fillRect(0, 0, w, h);

        /* Passing shoulder streetlamp glow */
        for (var sl = 0; sl < 3; sl++) {
          var ly = ((now * 0.14 + sl * 42) % (h + 36)) - 18;
          ctx.fillStyle = 'rgba(235,184,88,0.16)';
          ctx.beginPath(); ctx.arc(rx - 8, ly, 12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(rx + rw + 8, ly, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(rx - 9, ly - 1, 3, 3);
          ctx.fillRect(rx + rw + 6, ly - 1, 3, 3);
        }

        var roadGrad = ctx.createLinearGradient(rx, 0, rx + rw, 0);
        roadGrad.addColorStop(0, '#0d1526');
        roadGrad.addColorStop(0.5, '#131e35');
        roadGrad.addColorStop(1, '#0d1526');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(rx, 0, rw, h);
        ctx.strokeStyle = 'rgba(235,184,88,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, 0); ctx.lineTo(rx, h);
        ctx.moveTo(rx + rw, 0); ctx.lineTo(rx + rw, h);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(148,163,184,0.38)';
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = -(now * 0.14) % 20;
        for (var ln = 1; ln <= 2; ln++) {
          ctx.beginPath();
          ctx.moveTo(rx + (rw / 3) * ln, 0);
          ctx.lineTo(rx + (rw / 3) * ln, h);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        /* Police Interceptor with Siren Halo */
        var py = ((now * 0.085) % (h + 36)) - 18;
        var px = rx + rw * 0.24;
        var sRed = (Math.floor(now / 120) % 2) === 0;
        ctx.fillStyle = sRed ? 'rgba(239,68,68,0.22)' : 'rgba(59,130,246,0.22)';
        ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 8, py - 13, 16, 26);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(px - 7, py - 5, 14, 10);
        ctx.fillStyle = sRed ? '#ef4444' : '#3b82f6';
        ctx.fillRect(px - 7, py - 2, 7, 4);
        ctx.fillStyle = sRed ? '#3b82f6' : '#ef4444';
        ctx.fillRect(px, py - 2, 7, 4);

        /* Player Noir GT Coupe + Headlight Beams */
        var carX = rx + rw * (0.52 + Math.sin(now * 0.0032) * 0.25);
        ctx.fillStyle = 'rgba(254,240,138,0.16)';
        ctx.beginPath();
        ctx.moveTo(carX - 6, h - 32); ctx.lineTo(carX - 13, h - 56); ctx.lineTo(carX - 1, h - 56);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(carX + 6, h - 32); ctx.lineTo(carX + 1, h - 56); ctx.lineTo(carX + 13, h - 56);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#39e7a3';
        ctx.shadowColor = '#39e7a3';
        ctx.shadowBlur = 10;
        ctx.fillRect(carX - 8, h - 32, 16, 25);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ebb858';
        ctx.fillRect(carX - 1.5, h - 32, 3, 25);
        ctx.fillStyle = '#06120c';
        ctx.fillRect(carX - 6, h - 25, 12, 9);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(carX - 7, h - 9, 14, 2);
      } else if (kind === 'heist') {
        /* Mini Brass Safe Dial */
        var cx = w * 0.5, cy = h * 0.5, rad = 33;
        ctx.strokeStyle = 'rgba(235,184,88,0.28)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = '#ebb858';
        ctx.shadowColor = '#ebb858';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(cx, cy, rad, -0.7, 0.25); ctx.stroke();
        ctx.shadowBlur = 0;

        var a = now * 0.0036;
        ctx.strokeStyle = '#39e7a3';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * (rad + 4), cy + Math.sin(a) * (rad + 4));
        ctx.stroke();

        ctx.fillStyle = '#ebb858';
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'casino') {
        /* Mini Spinning Roulette Wheel */
        var rcx = w * 0.5, rcy = h * 0.5, rr = 36;
        var baseA = now * 0.0018;
        for (var i = 0; i < 18; i++) {
          var a0 = baseA + (i / 18) * Math.PI * 2;
          var a1 = baseA + ((i + 1) / 18) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(rcx, rcy);
          ctx.arc(rcx, rcy, rr, a0, a1);
          ctx.closePath();
          ctx.fillStyle = i === 0 ? '#158046' : (i % 2 ? '#b82921' : '#141b29');
          ctx.fill();
        }
        ctx.strokeStyle = '#ebb858';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
        var ba = -now * 0.0042;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rcx + Math.cos(ba) * (rr - 6), rcy + Math.sin(ba) * (rr - 6), 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'gym') {
        /* Mini Swinging Heavy Bag */
        var gx = w * 0.5, swing = Math.sin(now * 0.0045) * 0.28;
        ctx.save();
        ctx.translate(gx, 4);
        ctx.rotate(swing);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 18); ctx.stroke();
        var bagGrad = ctx.createLinearGradient(-14, 18, 14, 18);
        bagGrad.addColorStop(0, '#7f1d1d');
        bagGrad.addColorStop(0.5, '#dc2626');
        bagGrad.addColorStop(1, '#450a0a');
        ctx.fillStyle = bagGrad;
        ctx.fillRect(-13, 18, 26, 56);
        ctx.fillStyle = '#ebb858';
        ctx.fillRect(-13, 38, 26, 5);
        ctx.restore();
      }
    });
  }

  function renderGetawayGame(dt, now) {
    var cv = document.getElementById('zig-getaway-canvas');
    if (!cv || !state.getaway.open) return;
    var s = syncCanvas(cv, 230);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gw = state.getaway;
    var ar = isAr();

    var roadW = Math.min(w * 0.74, 380);
    var roadLeft = (w - roadW) * 0.5;
    var laneW = roadW / 4;

    if (gw.running && !gw.gameOver) {
      var mult = gw.boosting && gw.nitro > 0 ? 1.55 : 1;
      if (gw.boosting && gw.nitro > 0) gw.nitro = Math.max(0, gw.nitro - dt * 42);
      else gw.nitro = Math.min(100, gw.nitro + dt * 14);

      var curSpeed = gw.speed * mult;
      gw.speed = Math.min(460, gw.speed + dt * 7.5);
      gw.score += Math.round(dt * curSpeed * 0.25 * gw.combo);
      gw.lane += (gw.targetLane - gw.lane) * Math.min(1, dt * 14);

      gw.spawnTimer -= dt;
      if (gw.spawnTimer <= 0) {
        gw.spawnTimer = Math.max(0.34, 0.72 - (gw.speed - 270) * 0.0012);
        var spawnLane = Math.floor(Math.random() * 4);
        var isLoot = Math.random() < 0.36;
        gw.entities.push({
          lane: spawnLane,
          y: -36,
          kind: isLoot ? 'cash' : 'police',
          spd: isLoot ? curSpeed * 0.78 : curSpeed * 0.92
        });
      }

      var playerX = roadLeft + (gw.lane + 0.5) * laneW;
      var playerY = h - 42;

      for (var i = gw.entities.length - 1; i >= 0; i--) {
        var ent = gw.entities[i];
        ent.y += (curSpeed * 0.85) * dt;
        var ex = roadLeft + (ent.lane + 0.5) * laneW;

        if (Math.abs(ex - playerX) < laneW * 0.52 && Math.abs(ent.y - playerY) < 30) {
          if (ent.kind === 'cash') {
            gw.bags += 1;
            gw.combo = Math.min(8, gw.combo + 1);
            gw.score += 250 * gw.combo;
            sfx.pickup();
            for (var p = 0; p < 12; p++) {
              gw.particles.push({
                x: ex, y: ent.y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                life: 0.45,
                color: '#49f0a1'
              });
            }
            gw.entities.splice(i, 1);
            continue;
          } else {
            gw.gameOver = true;
            gw.running = false;
            gw.best = Math.max(gw.best, gw.score);
            sfx.crash();
            for (var c = 0; c < 22; c++) {
              gw.particles.push({
                x: playerX, y: playerY,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220,
                life: 0.65,
                color: c % 2 ? '#ff5d6c' : '#ebb858'
              });
            }
          }
        }
        if (ent.y > h + 50) gw.entities.splice(i, 1);
      }
    }

    /* Draw City Shoulders + Neon Highway */
    var shoulderGrad = ctx.createLinearGradient(0, 0, 0, h);
    shoulderGrad.addColorStop(0, '#070b16');
    shoulderGrad.addColorStop(1, '#04060c');
    ctx.fillStyle = shoulderGrad;
    ctx.fillRect(0, 0, w, h);

    /* Procedural Noir City Blocks & Lit Windows on Left/Right Shoulders */
    var scrollPx = (now * (gw.running && !gw.gameOver ? gw.speed * 0.65 : 95) * 0.001) * 60;
    if (roadLeft > 24) {
      for (var sb = -1; sb < 5; sb++) {
        var by = ((sb * 68 + scrollPx * 2.2) % (h + 80)) - 68;
        var bwL = Math.max(16, roadLeft - 22);
        ctx.fillStyle = '#0a101d';
        ctx.strokeStyle = 'rgba(56,189,248,0.12)';
        ctx.lineWidth = 1;
        ctx.fillRect(6, by, bwL, 56);
        ctx.strokeRect(6, by, bwL, 56);
        ctx.fillRect(roadLeft + roadW + 16, by + 18, bwL, 52);
        ctx.strokeRect(roadLeft + roadW + 16, by + 18, bwL, 52);
        /* Lit penthouse windows */
        ctx.fillStyle = (sb % 2 === 0) ? 'rgba(235,184,88,0.28)' : 'rgba(57,231,163,0.22)';
        for (var wx = 12; wx < bwL - 8; wx += 14) {
          ctx.fillRect(wx, by + 10, 6, 8);
          ctx.fillRect(wx, by + 28, 6, 8);
          ctx.fillRect(roadLeft + roadW + 14 + wx, by + 28, 6, 8);
        }
      }
    }

    /* Wet Asphalt Highway Deck */
    var asphalt = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadW, 0);
    asphalt.addColorStop(0, '#0b1220');
    asphalt.addColorStop(0.22, '#111b2f');
    asphalt.addColorStop(0.5, '#15223b');
    asphalt.addColorStop(0.78, '#111b2f');
    asphalt.addColorStop(1, '#0b1220');
    ctx.fillStyle = asphalt;
    ctx.fillRect(roadLeft, 0, roadW, h);

    /* Passing Golden Streetlamps Casting Light Pools onto Curbs */
    for (var lp = -1; lp < 5; lp++) {
      var lampY = ((lp * 74 + scrollPx * 4.4) % (h + 74)) - 37;
      var lPoolL = ctx.createRadialGradient(roadLeft - 6, lampY, 2, roadLeft - 6, lampY, 34);
      lPoolL.addColorStop(0, 'rgba(235,184,88,0.32)');
      lPoolL.addColorStop(1, 'rgba(235,184,88,0)');
      ctx.fillStyle = lPoolL;
      ctx.beginPath(); ctx.arc(roadLeft - 6, lampY, 34, 0, Math.PI * 2); ctx.fill();

      var lPoolR = ctx.createRadialGradient(roadLeft + roadW + 6, lampY, 2, roadLeft + roadW + 6, lampY, 34);
      lPoolR.addColorStop(0, 'rgba(235,184,88,0.32)');
      lPoolR.addColorStop(1, 'rgba(235,184,88,0)');
      ctx.fillStyle = lPoolR;
      ctx.beginPath(); ctx.arc(roadLeft + roadW + 6, lampY, 34, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(roadLeft - 9, lampY - 2, 4, 4);
      ctx.fillRect(roadLeft + roadW + 5, lampY - 2, 4, 4);
    }

    /* Curb Rumble Strips + Brass Guardrails */
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, h);
    ctx.moveTo(roadLeft + roadW, 0); ctx.lineTo(roadLeft + roadW, h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224,78,58,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -(scrollPx * 4.4) % 24;
    ctx.beginPath();
    ctx.moveTo(roadLeft + 3, 0); ctx.lineTo(roadLeft + 3, h);
    ctx.moveTo(roadLeft + roadW - 3, 0); ctx.lineTo(roadLeft + roadW - 3, h);
    ctx.stroke();

    /* Lane Markers */
    ctx.strokeStyle = 'rgba(148,163,184,0.38)';
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
        var glow = ctx.createRadialGradient(ex, ent.y, 2, ex, ent.y, 22);
        glow.addColorStop(0, 'rgba(73,240,161,0.36)');
        glow.addColorStop(1, 'rgba(73,240,161,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(ex, ent.y, 22, 0, Math.PI * 2); ctx.fill();

        /* Brass Briefcase Handle + Emerald Case */
        ctx.strokeStyle = '#ebb858';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex - 5, ent.y - 14, 10, 4);
        ctx.fillStyle = '#0f3d26';
        ctx.strokeStyle = '#49f0a1';
        ctx.fillRect(ex - 14, ent.y - 10, 28, 20);
        ctx.strokeRect(ex - 14, ent.y - 10, 28, 20);
        ctx.fillStyle = '#49f0a1';
        ctx.font = fontStack(900, 12);
        ctx.textAlign = 'center';
        ctx.fillText('$', ex, ent.y + 4);
      } else {
        /* Police Interceptor + Sweeping Siren Halo */
        var flashRed = Math.floor(now / 110) % 2 === 0;
        var siren = ctx.createRadialGradient(ex, ent.y, 4, ex, ent.y, 34);
        siren.addColorStop(0, flashRed ? 'rgba(239,68,68,0.32)' : 'rgba(59,130,246,0.32)');
        siren.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = siren;
        ctx.beginPath(); ctx.arc(ex, ent.y, 34, 0, Math.PI * 2); ctx.fill();

        /* Headlight cones facing downward */
        ctx.fillStyle = 'rgba(226,232,240,0.16)';
        ctx.beginPath();
        ctx.moveTo(ex - 10, ent.y + 20); ctx.lineTo(ex - 18, ent.y + 44); ctx.lineTo(ex - 2, ent.y + 44);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ex + 10, ent.y + 20); ctx.lineTo(ex + 2, ent.y + 44); ctx.lineTo(ex + 18, ent.y + 44);
        ctx.closePath(); ctx.fill();

        /* Cruiser Chassis */
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(ex - 14, ent.y - 21, 28, 42);
        ctx.strokeRect(ex - 14, ent.y - 21, 28, 42);
        /* White Interceptor Doors + Dark Glass */
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(ex - 12, ent.y - 8, 24, 16);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(ex - 10, ent.y + 6, 20, 8);
        ctx.fillRect(ex - 10, ent.y - 15, 20, 6);
        /* Roof Lightbar */
        ctx.fillStyle = flashRed ? '#ef4444' : '#3b82f6';
        ctx.fillRect(ex - 11, ent.y - 3, 11, 5);
        ctx.fillStyle = flashRed ? '#3b82f6' : '#ef4444';
        ctx.fillRect(ex, ent.y - 3, 11, 5);
      }
    });

    /* Player Noir GT Sports Coupe */
    var px = roadLeft + (gw.lane + 0.5) * laneW;
    var py = h - 44;
    var tilt = (gw.targetLane - gw.lane) * 0.14;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);

    /* Xenon Headlight Cones on Wet Asphalt */
    var beamL = ctx.createLinearGradient(0, -22, 0, -82);
    beamL.addColorStop(0, 'rgba(254,240,138,0.32)');
    beamL.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.fillStyle = beamL;
    ctx.beginPath();
    ctx.moveTo(-11, -22); ctx.lineTo(-24, -82); ctx.lineTo(-2, -82);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -22); ctx.lineTo(2, -82); ctx.lineTo(24, -82);
    ctx.closePath(); ctx.fill();

    /* Twin Nitro Exhaust Flames */
    var flameLen = (gw.boosting && gw.nitro > 0) ? (16 + Math.sin(now * 0.05) * 6) : (7 + Math.sin(now * 0.03) * 2.5);
    ctx.fillStyle = (gw.boosting && gw.nitro > 0) ? '#38bdf8' : '#ebb858';
    ctx.beginPath();
    ctx.moveTo(-9, 22); ctx.lineTo(-6, 22 + flameLen); ctx.lineTo(-3, 22);
    ctx.moveTo(3, 22); ctx.lineTo(6, 22 + flameLen); ctx.lineTo(9, 22);
    ctx.fill();

    /* GT Metallic Body + Gold Syndicate Stripe */
    ctx.shadowColor = '#39e7a3';
    ctx.shadowBlur = gw.boosting ? 20 : 10;
    var carGrad = ctx.createLinearGradient(-14, -22, 14, 22);
    carGrad.addColorStop(0, '#10b981');
    carGrad.addColorStop(0.5, '#39e7a3');
    carGrad.addColorStop(1, '#059669');
    ctx.fillStyle = carGrad;
    ctx.fillRect(-14, -22, 28, 44);
    ctx.shadowBlur = 0;

    /* Wheels */
    ctx.fillStyle = '#05070c';
    ctx.fillRect(-16, -16, 3, 10);
    ctx.fillRect(13, -16, 3, 10);
    ctx.fillRect(-16, 8, 3, 10);
    ctx.fillRect(13, 8, 3, 10);

    /* Gold Center Racing Stripe + Carbon Cockpit */
    ctx.fillStyle = '#ebb858';
    ctx.fillRect(-2, -22, 4, 44);
    ctx.fillStyle = '#06110c';
    ctx.fillRect(-10, -10, 20, 16);
    ctx.fillStyle = 'rgba(124,196,255,0.22)';
    ctx.fillRect(-9, -9, 18, 5);

    /* Xenon Lamps + Crimson LED Tailbar */
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-12, -22, 7, 3);
    ctx.fillRect(5, -22, 7, 3);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-12, 19, 24, 3);
    ctx.restore();

    /* Particles */
    for (var pi = gw.particles.length - 1; pi >= 0; pi--) {
      var pt = gw.particles[pi];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) { gw.particles.splice(pi, 1); continue; }
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Arcade HUD Overlays (Left: Score/Loot · Right: Speed/Nitro) */
    ctx.fillStyle = 'rgba(7,10,16,0.84)';
    ctx.fillRect(10, 10, 174, 54);
    ctx.strokeStyle = 'rgba(235,184,88,0.48)';
    ctx.strokeRect(10, 10, 174, 54);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.fillText((ar ? 'النقاط: ' : 'SCORE: ') + gw.score, 18, 28);
    ctx.fillStyle = '#49f0a1';
    ctx.fillText((ar ? 'حقائب: ' : 'LOOT BAGS: ') + gw.bags + '  (x' + gw.combo + ')', 18, 46);

    if (w > 360) {
      var mph = Math.round((gw.running && !gw.gameOver ? gw.speed : 0) * (gw.boosting ? 0.62 : 0.44));
      ctx.fillStyle = 'rgba(7,10,16,0.84)';
      ctx.fillRect(w - 146, 10, 136, 54);
      ctx.strokeStyle = 'rgba(57,231,163,0.42)';
      ctx.strokeRect(w - 146, 10, 136, 54);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontStack(900, 12);
      ctx.fillText(mph + (ar ? ' كم/س' : ' MPH'), w - 18, 28);
      /* Nitro Mini Bar */
      ctx.fillStyle = '#141e30';
      ctx.fillRect(w - 136, 38, 118, 8);
      ctx.fillStyle = gw.boosting ? '#38bdf8' : '#39e7a3';
      ctx.fillRect(w - 136, 38, Math.round(1.18 * gw.nitro), 8);
    }

    if (gw.gameOver || !gw.running) {
      ctx.fillStyle = 'rgba(5,8,14,0.78)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = gw.gameOver ? '#ff6a55' : '#ebb858';
      ctx.font = fontStack(900, 20);
      ctx.fillText(
        gw.gameOver
          ? (ar ? '🚨 طوّقتك الدوريات!' : '🚨 ROADBLOCK IMPACT!')
          : (ar ? '🏎️ مطاردة النيون الليلية' : '🏎️ NITRO SYNDICATE GETAWAY'),
        w * 0.5,
        h * 0.43
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontStack(700, 12.5);
      ctx.fillText(
        gw.gameOver
          ? (ar ? 'النتيجة: ' + gw.score + ' · حقائب: ' + gw.bags + ' · اضغط للانطلاق مجدداً' : 'Score: ' + gw.score + ' · Bags: ' + gw.bags + ' · Tap Canvas to Ride Again')
          : (ar ? 'اضغط على أي مسار للانطلاق ومراوغة الشرطة' : 'Tap any lane or press Arrow Keys to launch'),
        w * 0.5,
        h * 0.58
      );
    }
  }

  function renderCrimesGame(dt, now) {
    var cv = document.getElementById('zig-heist-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 228);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var hs = state.heist;
    var ar = isAr();

    hs.angle = (hs.angle + hs.speed * hs.dir * dt) % (Math.PI * 2);

    /* Noir Alley Rain Backdrop */
    var grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 16, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, '#131d2e');
    grad.addColorStop(1, '#060910');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (now < hs.sirenUntil) {
      var redPulse = Math.floor(now / 110) % 2 === 0;
      ctx.fillStyle = redPulse ? 'rgba(239,68,68,0.16)' : 'rgba(59,130,246,0.16)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = 'rgba(124,196,255,0.16)';
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

    /* Vault Dial Geometry */
    var cx = w * 0.5, cy = h * 0.52, radius = Math.min(72, h * 0.34);

    /* Outer brass bezel */
    ctx.strokeStyle = 'rgba(235,184,88,0.32)';
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

    /* Tick marks */
    for (var ti = 0; ti < 36; ti++) {
      var ta = (ti / 36) * Math.PI * 2;
      var inner = radius - (ti % 3 === 0 ? 15 : 11);
      ctx.strokeStyle = ti % 3 === 0 ? 'rgba(235,184,88,0.65)' : 'rgba(148,163,184,0.28)';
      ctx.lineWidth = ti % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * inner, cy + Math.sin(ta) * inner);
      ctx.lineTo(cx + Math.cos(ta) * (radius - 7), cy + Math.sin(ta) * (radius - 7));
      ctx.stroke();
    }

    /* Target Sweet-Spot Arc */
    ctx.save();
    ctx.strokeStyle = '#ebb858';
    ctx.shadowColor = '#ebb858';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.5, hs.targetCenter + hs.targetArc * 0.5);
    ctx.stroke();

    /* Bullseye Core */
    ctx.strokeStyle = '#49f0a1';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.16, hs.targetCenter + hs.targetArc * 0.16);
    ctx.stroke();
    ctx.restore();

    /* Sweeping Lockpick Needle */
    var nx = cx + Math.cos(hs.angle) * (radius + 6);
    var ny = cy + Math.sin(hs.angle) * (radius + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    ctx.fillStyle = '#39e7a3';
    ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();

    /* Center Hub */
    ctx.fillStyle = '#0d1422';
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.textAlign = 'center';
    ctx.fillText('x' + hs.streak, cx, cy + 4);

    /* Sparks */
    for (var si = hs.sparks.length - 1; si >= 0; si--) {
      var sp = hs.sparks[si];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { hs.sparks.splice(si, 1); continue; }
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life * 1.4);
      ctx.fillRect(cx + sp.x - 2, cy + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Selected Crime Title + Prompt HUD */
    var sel = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
    var targetName = sel ? sel.name : (ar ? 'خزنة الهدف' : 'TARGET VAULT');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.fillText((ar ? '🎯 الهدف: ' : '🎯 TARGET: ') + targetName, 12, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = fontStack(700, 10.5);
    ctx.fillText(ar ? 'اضغط أو [Space] في القوس الذهبي' : 'CLICK OR [SPACE] IN GOLD ARC', w - 12, 20);

    if (now < hs.bannerUntil && hs.banner) {
      ctx.textAlign = 'center';
      ctx.fillStyle = hs.bannerColor;
      ctx.font = fontStack(800, 13);
      ctx.fillText(hs.banner, cx, h - 10);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = fontStack(700, 11.5);
      ctx.fillText(
        ar ? 'اضرب القفل في اللحظة الذهبية لتنفيذ الجريمة المختارة فوراً' : 'Strike the lock in the golden zone to breach & execute crime',
        cx,
        h - 10
      );
    }
  }

  function renderGymGame(dt, now) {
    var cv = document.getElementById('zig-gym-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 196);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gm = state.gym;
    var ar = isAr();

    /* Pendulum spring physics for Heavy Bag */
    var spring = -26 * gm.bagAngle - 4.2 * gm.bagVel;
    gm.bagVel += spring * dt;
    gm.bagAngle += gm.bagVel * dt;

    /* Oscillating Power Sweet-Spot Cursor */
    gm.gaugePos += gm.gaugeDir * dt * 1.15;
    if (gm.gaugePos >= 1) { gm.gaugePos = 1; gm.gaugeDir = -1; }
    if (gm.gaugePos <= 0) { gm.gaugePos = 0; gm.gaugeDir = 1; }

    var bg = ctx.createRadialGradient(w * 0.5, 20, 10, w * 0.5, h * 0.6, w * 0.65);
    bg.addColorStop(0, '#1c2538');
    bg.addColorStop(1, '#070b12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var pivotX = w * 0.5, pivotY = 6;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(gm.bagAngle);

    /* Steel chains */
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(-14, 24);
    ctx.moveTo(10, 0); ctx.lineTo(14, 24);
    ctx.stroke();

    /* Leather Heavy Bag */
    var bagGrad = ctx.createLinearGradient(-24, 24, 24, 24);
    bagGrad.addColorStop(0, '#5c1414');
    bagGrad.addColorStop(0.42, '#dc2626');
    bagGrad.addColorStop(1, '#3b0a0a');
    ctx.fillStyle = bagGrad;
    ctx.fillRect(-23, 24, 46, 96);
    ctx.strokeStyle = 'rgba(235,184,88,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-23, 24, 46, 96);

    /* Strike Zone Tape */
    ctx.fillStyle = '#ebb858';
    ctx.fillRect(-23, 58, 46, 10);
    ctx.restore();

    /* Shockwave Rings */
    var impactX = pivotX + Math.sin(gm.bagAngle) * 72;
    var impactY = pivotY + Math.cos(gm.bagAngle) * 72;
    for (var ri = gm.rings.length - 1; ri >= 0; ri--) {
      var rg = gm.rings[ri];
      rg.r += dt * 150;
      rg.alpha -= dt * 1.9;
      if (rg.alpha <= 0) { gm.rings.splice(ri, 1); continue; }
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = Math.max(0, rg.alpha);
      ctx.lineWidth = 3;
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
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life * 1.5);
      ctx.fillRect(impactX + sp.x - 2, impactY + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Power Sweet-Spot Gauge Bar */
    var barW = Math.min(320, w - 36);
    var barX = (w - barW) * 0.5;
    var barY = h - 34;
    ctx.fillStyle = '#0d1320';
    ctx.fillRect(barX, barY, barW, 13);
    ctx.strokeStyle = '#33435e';
    ctx.strokeRect(barX, barY, barW, 13);

    /* Center Overdrive Sweet-Spot */
    ctx.fillStyle = 'rgba(235,184,88,0.88)';
    ctx.fillRect(barX + barW * 0.36, barY + 1, barW * 0.28, 11);
    ctx.fillStyle = '#39e7a3';
    ctx.fillRect(barX + barW * 0.45, barY + 1, barW * 0.10, 11);

    /* Moving Cursor */
    var curX = barX + gm.gaugePos * barW;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(curX - 2.5, barY - 3, 5, 19);

    ctx.textAlign = 'center';
    ctx.font = fontStack(800, 11.5);
    if (now < gm.bannerUntil && gm.banner) {
      ctx.fillStyle = gm.bannerColor;
      ctx.fillText(gm.banner, w * 0.5, h - 6);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        ar ? 'اضغط على الكيس عند مرور المؤشر في المنطقة الذهبية للتدريب' : 'Tap bag when power needle hits center gold zone to train',
        w * 0.5,
        h - 6
      );
    }
  }

  function renderRouletteCanvas(dt, now) {
    var cv = document.getElementById('zig-roulette-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 184);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var rl = state.roulette;
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
    var cx = w * 0.5, cy = h * 0.5, outerR = Math.min(78, h * 0.43);

    /* Mahogany Outer Bowl */
    ctx.fillStyle = '#2b140d';
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
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
      ctx.fillStyle = num === 0 ? '#158046' : (RED_POCKETS[num] ? '#b82921' : '#121824');
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,184,88,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (i === pocketIdx && now < rl.highlightUntil) {
        ctx.save();
        ctx.strokeStyle = '#49f0a1';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, outerR - 2, a0, a1); ctx.stroke();
        ctx.restore();
      }
    }

    /* Inner Brass Cone */
    var coneGrad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, outerR * 0.52);
    coneGrad.addColorStop(0, '#f7d586');
    coneGrad.addColorStop(0.55, '#9b6b1b');
    coneGrad.addColorStop(1, '#1a1209');
    ctx.fillStyle = coneGrad;
    ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.50, 0, Math.PI * 2); ctx.fill();

    /* Center Winning Pocket Readout */
    ctx.fillStyle = '#090d14';
    ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = fontStack(900, 13);
    ctx.textAlign = 'center';
    ctx.fillText(rl.spinning ? '..' : String(targetPocket), cx, cy + 5);

    /* Gleaming Ivory Ball */
    var bx = cx + Math.cos(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    var by = cy + Math.sin(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(bx, by, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function renderSlotsCanvas(dt, now) {
    var cv = document.getElementById('zig-slots-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 184);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var sl = state.slots;
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
    var cabY = 14, cabH = h - 28;

    /* Brass & Obsidian Slot Cabinet */
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cabX, cabY, cabW, cabH);
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cabX, cabY, cabW, cabH);

    var reelGap = 8;
    var reelW = (cabW - reelGap * 4) / 3;
    var reelH = cabH - 20;

    for (var ri = 0; ri < 3; ri++) {
      var rx = cabX + reelGap + ri * (reelW + reelGap);
      var ry = cabY + 10;

      var drumGrad = ctx.createLinearGradient(rx, ry, rx, ry + reelH);
      drumGrad.addColorStop(0, '#0f172a');
      drumGrad.addColorStop(0.5, '#f8fafc');
      drumGrad.addColorStop(1, '#0f172a');
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
        var sy = ry + reelH * 0.5 + (row - frac) * 44;
        ctx.textAlign = 'center';
        ctx.fillStyle = sym.color === '#6ee7ff' ? '#0f172a' : sym.color;
        ctx.font = fontStack(900, sym.glyph === '777' ? 19 : 24);
        ctx.fillText(sym.glyph, rx + reelW * 0.5, sy + 8);
      }
      ctx.restore();

      ctx.strokeStyle = sl.locked[ri] ? '#ebb858' : '#39e7a3';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(rx, ry, reelW, reelH);
    }

    /* Laser Payline */
    ctx.strokeStyle = sState.result === 'win' && !sl.spinning ? '#49f0a1' : 'rgba(239,68,68,0.65)';
    ctx.lineWidth = sState.result === 'win' && !sl.spinning ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cabX + 3, cabY + cabH * 0.5);
    ctx.lineTo(cabX + cabW - 3, cabY + cabH * 0.5);
    ctx.stroke();

    /* Mechanical Side Lever */
    var lx = cabX + cabW + 10;
    var topY = cabY + 22 + sl.leverPull * 56;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cabX + cabW, cabY + cabH * 0.65);
    ctx.lineTo(lx, cabY + cabH * 0.65);
    ctx.lineTo(lx, topY);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(lx, topY, 7, 0, Math.PI * 2); ctx.fill();

    /* Gold Coin Shower on Win */
    for (var cIdx = sl.coins.length - 1; cIdx >= 0; cIdx--) {
      var cn = sl.coins[cIdx];
      cn.vy += 320 * dt;
      cn.x += cn.vx * dt;
      cn.y += cn.vy * dt;
      cn.life -= dt;
      if (cn.life <= 0) { sl.coins.splice(cIdx, 1); continue; }
      ctx.fillStyle = '#ebb858';
      ctx.beginPath(); ctx.arc(cn.x, cn.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------------- Sync Hook & Unified 60fps Loop ---------------- */
  function syncMounts() {
    mountHomeArcade();
    mountCrimesGame();
    mountGymGame();
    mountCasinoGames();
    mountAttackBanner();

    /* Detect cash reward deltas for arcade floating popups */
    var g = window.__zoneGame;
    if (g && g.p && Number.isFinite(Number(g.p.cash))) {
      var curCash = Number(g.p.cash);
      if (state.lastCash !== null && curCash > state.lastCash) {
        var diff = curCash - state.lastCash;
        if (diff > 0 && diff < 50000000) {
          spawnFloatingReward('+$' + diff.toLocaleString('en-US'), '#49f0a1');
        }
      }
      state.lastCash = curCash;
    }
  }

  window.addEventListener('zone:render', syncMounts);

  var obsTimer = null;
  var observer = new MutationObserver(function () {
    if (obsTimer) return;
    obsTimer = setTimeout(function () {
      obsTimer = null;
      syncMounts();
    }, 60);
  });

  function boot() {
    syncMounts();
    var root = document.getElementById('zone-main') || document.body;
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-zone-screen'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  var prevTime = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;
    if (!document.hidden) {
      renderHomePreviews(dt, now);
      renderGetawayGame(dt, now);
      renderCrimesGame(dt, now);
      renderGymGame(dt, now);
      renderRouletteCanvas(dt, now);
      renderSlotsCanvas(dt, now);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

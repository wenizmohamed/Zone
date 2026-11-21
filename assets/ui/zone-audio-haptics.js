/* ==========================================================================
 * ZONE v155 - EVENT-DRIVEN PROCEDURAL WEBAUDIO ENGINE, ADAPTIVE NOIR
 *             SOUNDTRACK & CALIBRATED MOBILE HAPTICS
 * Exclusive Ownership: @audio-haptics (assets/ui/zone-audio-haptics.js)
 * Exposes: window.ZoneAudioHaptics (100% Real-Time Synthesis, Zero Binary Audio)
 *
 * Skills Applied:
 *   - audio-haptic-feedback (strict lazy gesture AudioContext, calibrated Hz,
 *     0.7 master headroom, event-driven dispatch, reduced-motion haptic guard)
 *   - audio-dsp & game-audio-engineer (SFX Submix + Sidechain-Ducked Music
 *     Submix -> Hospital/Jail Biquad Low-Pass -> DynamicsCompressor -> MasterGain,
 *     24-voice mobile polyphony budget & priority stealing)
 *   - procedural-audio (layered sub-bass + pink/white noise bursts + transients)
 *   - adaptive-music & generative-music-composer (Markov minor-9th noir stems,
 *     Pier 4 procedural rain, stealth-threat tempo/cutoff scaling, 0.6s route
 *     vertical crossfading)
 * ========================================================================== */
(function (root) {
  'use strict';

  var MASTER_HEADROOM_GAIN = 0.7;
  var SIDECHAIN_DUCK_DB = -5;
  var SIDECHAIN_DUCK_LINEAR = Math.pow(10, SIDECHAIN_DUCK_DB / 20); // ~0.562341
  var SIDECHAIN_DUCK_MS = 180;
  var CROSSFADE_SEC = 0.6;
  var OPEN_FILTER_HZ = 18000;
  var MUFFLED_FILTER_HZ = 680;
  var MAX_ACTIVE_VOICES = 24;
  var STYLE_ID = 'zone-audio-haptics-v155-styles';

  var HAPTIC_PATTERNS = {
    light: 12,
    snap: 12,
    crit: [18, 24, 35],
    breach: [18, 24, 35],
    damage: [40, 30, 40],
    warning: [40, 30, 40]
  };

  /* Calibrated Event Map & Voice Priority Tiers (0 = never stolen, 2 = UI/ambient) */
  var CUE_SPECS = {
    vault_tumbler:    { priority: 0, duck: true,  haptic: 'breach' },
    equip_snap:       { priority: 1, duck: false, haptic: 'light' },
    gunshot_pistol:   { priority: 1, duck: true,  haptic: 'crit' },
    gunshot_rifle:    { priority: 1, duck: true,  haptic: 'crit' },
    blade_slash:      { priority: 1, duck: true,  haptic: 'light' },
    heavy_bag_impact: { priority: 1, duck: true,  haptic: 'light' },
    cash_payout:      { priority: 1, duck: false, haptic: 'light' },
    roulette_tick:    { priority: 2, duck: false, haptic: 'light' },
    jackpot_fanfare:  { priority: 0, duck: true,  haptic: 'crit' },
    era_breakthrough: { priority: 0, duck: true,  haptic: 'crit' },
    stealth_alert:    { priority: 0, duck: true,  haptic: 'damage' },
    step_fail:        { priority: 1, duck: false, haptic: 'damage' },
    ui_nav:           { priority: 2, duck: false, haptic: 'light' },
    wrong_order:      { priority: 2, duck: false, haptic: 'light' },
    session_reset:    { priority: 2, duck: false, haptic: 'light' }
  };

  var CUE_ALIASES = {
    vault: 'vault_tumbler',
    crack: 'vault_tumbler',
    breach: 'vault_tumbler',
    lock: 'vault_tumbler',
    equip: 'equip_snap',
    outfit: 'equip_snap',
    pistol: 'gunshot_pistol',
    fire: 'gunshot_pistol',
    shoot: 'gunshot_pistol',
    attack: 'gunshot_pistol',
    rifle: 'gunshot_rifle',
    suppress_fire: 'gunshot_rifle',
    armor_pierce: 'gunshot_rifle',
    slash: 'blade_slash',
    melee: 'blade_slash',
    counter_parry: 'blade_slash',
    punch: 'heavy_bag_impact',
    hook: 'heavy_bag_impact',
    gym: 'heavy_bag_impact',
    hit: 'heavy_bag_impact',
    rush_interrupt: 'heavy_bag_impact',
    cash: 'cash_payout',
    payout: 'cash_payout',
    pickup: 'cash_payout',
    graze: 'cash_payout',
    combo: 'cash_payout',
    tick: 'roulette_tick',
    wheel: 'roulette_tick',
    spin: 'roulette_tick',
    jackpot: 'jackpot_fanfare',
    era: 'era_breakthrough',
    breakthrough: 'era_breakthrough',
    levelup: 'era_breakthrough',
    alert: 'stealth_alert',
    hunted: 'stealth_alert',
    detected: 'stealth_alert',
    fail: 'step_fail',
    crash: 'step_fail',
    damage: 'step_fail',
    nav: 'ui_nav',
    click: 'ui_nav'
  };

  /* Markov / Constraint-Based Dark-Noir Chord Vocabulary (D Minor 9th / Phrygian) */
  var NOIR_CHORDS = {
    Dm9:     [146.83, 174.61, 220.00, 261.63, 329.63],
    Bbmaj9:  [116.54, 146.83, 174.61, 220.00, 261.63],
    Gm9:     [98.00,  116.54, 146.83, 174.61, 220.00],
    A7alt:   [110.00, 138.59, 164.81, 196.00, 233.08]
  };

  var NOIR_MARKOV = {
    Dm9:    [{ next: 'Bbmaj9', w: 0.42 }, { next: 'Gm9', w: 0.38 }, { next: 'A7alt', w: 0.20 }],
    Bbmaj9: [{ next: 'Gm9',    w: 0.50 }, { next: 'A7alt', w: 0.30 }, { next: 'Dm9', w: 0.20 }],
    Gm9:    [{ next: 'A7alt',  w: 0.55 }, { next: 'Dm9',   w: 0.45 }],
    A7alt:  [{ next: 'Dm9',    w: 0.78 }, { next: 'Bbmaj9', w: 0.22 }]
  };

  var COMBAT_BASS_OSTINATO = [73.42, 73.42, 87.31, 73.42, 110.00, 103.83, 87.31, 65.41];
  var CRIMES_PULSE_NOTES = [36.71, 36.71, 73.42, 36.71, 41.20, 36.71, 55.00, 36.71];

  var STEM_TARGET_GAINS = {
    home_city: 0.22,
    crimes: 0.24,
    combat: 0.26
  };

  var SVG_MUSIC_ON =
    '<svg class="zig-inline-svg zah-note-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M9 17.5V6.2L19 4.2V15.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="6.5" cy="17.5" r="2.7" fill="#5c8e3e" stroke="currentColor" stroke-width="1.4"/>' +
      '<circle cx="16.5" cy="15.5" r="2.7" fill="#c89429" stroke="currentColor" stroke-width="1.4"/>' +
    '</svg>';

  var SVG_MUSIC_OFF =
    '<svg class="zig-inline-svg zah-note-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M9 17.5V6.2L19 4.2V15.5" stroke="currentColor" stroke-opacity="0.65" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="6.5" cy="17.5" r="2.7" fill="#b8452d" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M4.5 4.5L19.5 19.5" stroke="#b8452d" stroke-width="2.1" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SFX_ON =
    '<svg class="zig-inline-svg zah-sfx-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#5c8e3e" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M15.4 8.8C16.7 9.9 17.4 11.2 17.4 12C17.4 12.8 16.7 14.1 15.4 15.2" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SFX_OFF =
    '<svg class="zig-inline-svg zah-sfx-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#b8452d" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M15.8 9.4L20.6 14.4M20.6 9.4L15.8 14.4" stroke="#b8452d" stroke-width="2.05" stroke-linecap="round"/>' +
    '</svg>';

  function mapScreenToStem(screenName) {
    var scr = String(screenName || 'home').trim().toLowerCase();
    if (scr === 'crimes') return 'crimes';
    if (scr === 'attack' || scr === 'faction' || scr === 'missions' || scr === 'elimination') {
      return 'combat';
    }
    return 'home_city';
  }

  function pickMarkovNext(table, currentKey, randFn) {
    var list = table[currentKey] || table.Dm9;
    var r = (randFn || Math.random)();
    var acc = 0;
    for (var i = 0; i < list.length; i++) {
      acc += list[i].w;
      if (r <= acc) return list[i].next;
    }
    return list[list.length - 1].next;
  }

  function getWindowLocalStorage(winObj) {
    if (!winObj) return null;
    try {
      var desc = Object.getOwnPropertyDescriptor(winObj, 'localStorage');
      if (desc && typeof desc.get === 'function' && typeof process !== 'undefined' && winObj === globalThis) {
        return null;
      }
      return winObj.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function createZoneAudioHapticsEngine(envOverrides) {
    var env = envOverrides || {};
    var win = env.window || (typeof window !== 'undefined' ? window : null);
    var doc = env.document || (win && win.document) || (typeof document !== 'undefined' ? document : null);
    var nav = env.navigator || (win && win.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
    var storage = env.localStorage || getWindowLocalStorage(win);

    var audioCtx = null;
    var sfxSubmixGain = null;
    var musicMasterGain = null;
    var musicSubmixGain = null;
    var statusLowpassFilter = null;
    var masterCompressor = null;
    var masterGain = null;
    var stemGains = {
      home_city: null,
      crimes: null,
      combat: null
    };
    var rainNodes = null;
    var whiteNoiseBuf = null;
    var pinkNoiseBuf = null;

    var activeVoices = [];
    var voiceSeq = 0;
    var syncingMute = false;
    var schedulerTimer = null;
    var mainObserver = null;
    var bodyObserver = null;
    var domScanTimer = null;

    var state = {
      gestureUnlocked: false,
      muted: false,
      musicEnabled: true,
      masterVolume: MASTER_HEADROOM_GAIN,
      muffled: false,
      muffleReason: 'none',
      activeScreen: 'home',
      activeStem: 'home_city',
      stealthThreat: 0.15,
      chordState: 'Dm9',
      stepIndex: 0,
      duckCount: 0,
      lastDuckDb: 0,
      lastDuckDurationMs: 0,
      lastCrossfadeSec: CROSSFADE_SEC,
      stemTransitionCount: 0,
      cuesPlayed: 0,
      cueCounts: {},
      lastCue: null,
      lastFrequencies: [],
      hapticsTriggered: 0,
      lastHapticPattern: null,
      lastClickCueAt: 0,
      lastRouletteHapticAt: 0,
      destroyed: false
    };

    function safeGetStorage(key) {
      try {
        return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
      } catch (_) {
        return null;
      }
    }

    function safeSetStorage(key, val) {
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(key, String(val));
        }
      } catch (_) {}
    }

    function isArabic() {
      if (!doc || !doc.documentElement) return false;
      var lang = String(doc.documentElement.lang || '').toLowerCase();
      var dir = String(doc.documentElement.dir || '').toLowerCase();
      return lang.indexOf('ar') === 0 || dir === 'rtl';
    }

    function isReducedMotion() {
      try {
        if (doc && doc.documentElement) {
          if (doc.documentElement.dataset && doc.documentElement.dataset.zoneReducedMotion === 'true') {
            return true;
          }
          if (typeof doc.documentElement.getAttribute === 'function' &&
              doc.documentElement.getAttribute('data-zone-reduced-motion') === 'true') {
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    function readPersistedMute() {
      var zoneSfx = safeGetStorage('zone_sfx_muted');
      if (zoneSfx === '1') return true;
      if (zoneSfx === '0') return false;
      var zig = safeGetStorage('zig_muted');
      if (zig === '1') return true;
      if (zig === '0') return false;
      if (win && win.__zoneMuted === true) return true;
      return false;
    }

    function readPersistedMusicEnabled() {
      var raw = safeGetStorage('zone_music_enabled');
      if (raw === '0' || raw === 'false') return false;
      if (raw === '1' || raw === 'true') return true;
      return true;
    }

    state.muted = readPersistedMute();
    state.musicEnabled = readPersistedMusicEnabled();

    function resolveAudioContextCtor() {
      if (env.AudioContext) return env.AudioContext;
      if (win && (win.AudioContext || win.webkitAudioContext)) {
        return win.AudioContext || win.webkitAudioContext;
      }
      if (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
        return globalThis.AudioContext || globalThis.webkitAudioContext;
      }
      return null;
    }

    function canUnlockFromEvent(ev) {
      if (!ev) return true;
      /* In real browsers, ignore synthetic script-triggered clicks prior to first human activation
         so Chrome/Safari never emit an AudioContext autoplay warning on boot. */
      try {
        if (nav && nav.userActivation &&
            nav.userActivation.hasBeenActive === false &&
            nav.userActivation.isActive === false &&
            ev.isTrusted === false) {
          return false;
        }
      } catch (_) {}
      return true;
    }

    function setParamSmooth(param, targetValue, now, rampSec) {
      if (!param) return;
      try {
        if (typeof param.cancelScheduledValues === 'function') {
          param.cancelScheduledValues(now);
        }
        if (typeof param.setValueAtTime === 'function') {
          var cur = typeof param.value === 'number' ? param.value : targetValue;
          param.setValueAtTime(cur, now);
        }
        if (rampSec > 0 && typeof param.linearRampToValueAtTime === 'function') {
          param.linearRampToValueAtTime(targetValue, now + rampSec);
        } else if (typeof param.setValueAtTime === 'function') {
          param.setValueAtTime(targetValue, now);
        }
        param.value = targetValue;
      } catch (_) {
        try { param.value = targetValue; } catch (__) {}
      }
    }

    function buildNoiseBuffers(ctx) {
      if (!ctx || typeof ctx.createBuffer !== 'function') return;
      var sr = ctx.sampleRate || 44100;
      var len = Math.max(2048, Math.floor(sr * 1.5));

      if (!whiteNoiseBuf) {
        whiteNoiseBuf = ctx.createBuffer(1, len, sr);
        var wd = whiteNoiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) {
          wd[i] = (Math.random() * 2 - 1) * 0.35;
        }
      }

      if (!pinkNoiseBuf) {
        pinkNoiseBuf = ctx.createBuffer(1, len, sr);
        var pd = pinkNoiseBuf.getChannelData(0);
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var j = 0; j < len; j++) {
          var white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          pd[j] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;
        }
      }
    }

    function buildDspGraph(ctx) {
      /* DSP Chain:
       *   [SFX Voices]   -> sfxSubmixGain   \
       *   [Music Stems]  -> musicMasterGain -> musicSubmixGain (sidechain -5dB) -> statusLowpassFilter -> masterCompressor -> masterGain (0.7) -> destination
       */
      sfxSubmixGain = ctx.createGain();
      sfxSubmixGain.gain.value = 1.0;

      musicMasterGain = ctx.createGain();
      musicMasterGain.gain.value = (state.musicEnabled && !state.muted) ? 1.0 : 0.0;

      musicSubmixGain = ctx.createGain();
      musicSubmixGain.gain.value = 1.0;

      stemGains.home_city = ctx.createGain();
      stemGains.crimes = ctx.createGain();
      stemGains.combat = ctx.createGain();

      stemGains.home_city.gain.value = state.activeStem === 'home_city' ? STEM_TARGET_GAINS.home_city : 0.0001;
      stemGains.crimes.gain.value = state.activeStem === 'crimes' ? STEM_TARGET_GAINS.crimes : 0.0001;
      stemGains.combat.gain.value = state.activeStem === 'combat' ? STEM_TARGET_GAINS.combat : 0.0001;

      statusLowpassFilter = ctx.createBiquadFilter();
      statusLowpassFilter.type = 'lowpass';
      statusLowpassFilter.frequency.value = state.muffled ? MUFFLED_FILTER_HZ : OPEN_FILTER_HZ;
      if (statusLowpassFilter.Q) {
        statusLowpassFilter.Q.value = state.muffled ? 1.15 : 0.707;
      }

      masterCompressor = ctx.createDynamicsCompressor();
      if (masterCompressor.threshold) masterCompressor.threshold.value = -14;
      if (masterCompressor.knee) masterCompressor.knee.value = 18;
      if (masterCompressor.ratio) masterCompressor.ratio.value = 4;
      if (masterCompressor.attack) masterCompressor.attack.value = 0.004;
      if (masterCompressor.release) masterCompressor.release.value = 0.16;

      masterGain = ctx.createGain();
      masterGain.gain.value = state.muted ? 0.0 : state.masterVolume;

      stemGains.home_city.connect(musicMasterGain);
      stemGains.crimes.connect(musicMasterGain);
      stemGains.combat.connect(musicMasterGain);
      musicMasterGain.connect(musicSubmixGain);

      sfxSubmixGain.connect(statusLowpassFilter);
      musicSubmixGain.connect(statusLowpassFilter);
      statusLowpassFilter.connect(masterCompressor);
      masterCompressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      buildNoiseBuffers(ctx);
    }

    /* Strictly lazy: returns null until unlocked by a user gesture! */
    function getAudioContextIfUnlocked() {
      if (!state.gestureUnlocked || state.destroyed) return null;
      if (!audioCtx) {
        var Ctx = resolveAudioContextCtor();
        if (!Ctx) return null;
        try {
          audioCtx = new Ctx();
          buildDspGraph(audioCtx);
        } catch (_) {
          audioCtx = null;
          return null;
        }
      }
      if (audioCtx && audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        try {
          var p = audioCtx.resume();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        } catch (_) {}
      }
      return audioCtx;
    }

    function unlockFromGesture(ev) {
      if (state.destroyed) return false;
      if (!canUnlockFromEvent(ev)) return false;
      state.gestureUnlocked = true;
      var ctx = getAudioContextIfUnlocked();
      if (ctx) {
        syncEnvironmentMuffle();
        syncMusicEngineState();
      }
      return Boolean(ctx);
    }

    /* ---------------- Voice Polyphony Budget & Priority Stealing ---------------- */
    function registerVoice(cue, priority, durationSec, stopFn) {
      var nowMs = Date.now();
      for (var i = activeVoices.length - 1; i >= 0; i--) {
        if (nowMs >= activeVoices[i].expiresAt) {
          activeVoices.splice(i, 1);
        }
      }
      if (activeVoices.length >= MAX_ACTIVE_VOICES) {
        var victimIdx = -1;
        var highestPrioNum = -1;
        for (var j = 0; j < activeVoices.length; j++) {
          if (activeVoices[j].priority >= highestPrioNum) {
            highestPrioNum = activeVoices[j].priority;
            victimIdx = j;
          }
        }
        if (victimIdx >= 0) {
          var victim = activeVoices.splice(victimIdx, 1)[0];
          try { if (victim && victim.stopFn) victim.stopFn(); } catch (_) {}
        }
      }
      var id = ++voiceSeq;
      activeVoices.push({
        id: id,
        cue: cue,
        priority: priority,
        expiresAt: nowMs + Math.max(40, Math.ceil(durationSec * 1000)) + 25,
        stopFn: stopFn
      });
      return id;
    }

    /* ---------------- Sidechain Ducking (-5dB for 180ms on Music Submix) ---------------- */
    function triggerSidechainDuck(dbAmount, durationMs) {
      var db = typeof dbAmount === 'number' ? dbAmount : SIDECHAIN_DUCK_DB;
      var durMs = typeof durationMs === 'number' ? durationMs : SIDECHAIN_DUCK_MS;
      var linearDuck = Math.pow(10, db / 20);
      state.duckCount += 1;
      state.lastDuckDb = db;
      state.lastDuckDurationMs = durMs;

      if (!audioCtx || !musicSubmixGain || !musicSubmixGain.gain) return false;
      var g = musicSubmixGain.gain;
      var now = audioCtx.currentTime || 0;
      var attackSec = 0.012;
      var totalSec = Math.max(0.04, durMs / 1000);
      try {
        if (typeof g.cancelScheduledValues === 'function') g.cancelScheduledValues(now);
        if (typeof g.setValueAtTime === 'function') g.setValueAtTime(typeof g.value === 'number' ? g.value : 1.0, now);
        if (typeof g.linearRampToValueAtTime === 'function') {
          g.linearRampToValueAtTime(linearDuck, now + attackSec);
          g.linearRampToValueAtTime(1.0, now + totalSec);
        }
        g.value = linearDuck;
      } catch (_) {}
      return true;
    }

    /* ---------------- Core Synthesis Primitives (Oscillators & Filtered Noise) ---------------- */
    function synthTone(ctx, destNode, freqHz, durationMs, opts) {
      var o = opts || {};
      var delaySec = (o.delayMs || 0) / 1000;
      var durSec = Math.max(0.012, durationMs / 1000);
      var t0 = (ctx.currentTime || 0) + delaySec;
      var attackSec = Math.max(0.002, (o.attackMs || 4) / 1000);
      var peakGain = typeof o.peakGain === 'number' ? o.peakGain : 0.32;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var target = destNode || sfxSubmixGain || ctx.destination;

      osc.type = o.waveType || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freqHz), t0);

      if (o.freqEnd && o.freqEnd !== freqHz) {
        if (o.linearSweep && typeof osc.frequency.linearRampToValueAtTime === 'function') {
          osc.frequency.linearRampToValueAtTime(Math.max(20, o.freqEnd), t0 + durSec);
        } else if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + durSec);
        }
      }

      if (o.filterFreq && typeof ctx.createBiquadFilter === 'function') {
        var flt = ctx.createBiquadFilter();
        flt.type = o.filterType || 'lowpass';
        flt.frequency.setValueAtTime(o.filterFreq, t0);
        if (o.filterFreqEnd && typeof flt.frequency.exponentialRampToValueAtTime === 'function') {
          flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterFreqEnd), t0 + durSec);
        }
        if (flt.Q && typeof o.filterQ === 'number') flt.Q.value = o.filterQ;
        osc.connect(flt);
        flt.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(target);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(attackSec, durSec * 0.45));
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + durSec);

      osc.start(t0);
      osc.stop(t0 + durSec + 0.012);

      state.lastFrequencies.push(freqHz);
      if (state.lastFrequencies.length > 24) {
        state.lastFrequencies.shift();
      }

      registerVoice(o.cue || 'tone', typeof o.priority === 'number' ? o.priority : 1, delaySec + durSec, function () {
        try { osc.stop(); } catch (_) {}
      });
      return osc;
    }

    function synthChord(ctx, destNode, frequencies, durationMs, opts) {
      var o = opts || {};
      var staggerMs = typeof o.staggerMs === 'number' ? o.staggerMs : 5;
      for (var i = 0; i < frequencies.length; i++) {
        var noteOpts = {};
        for (var k in o) {
          if (Object.prototype.hasOwnProperty.call(o, k)) noteOpts[k] = o[k];
        }
        noteOpts.delayMs = (o.delayMs || 0) + i * staggerMs;
        synthTone(ctx, destNode, frequencies[i], durationMs, noteOpts);
      }
    }

    function synthNoiseBurst(ctx, destNode, durationMs, opts) {
      var o = opts || {};
      buildNoiseBuffers(ctx);
      var buf = o.pink ? pinkNoiseBuf : whiteNoiseBuf;
      if (!buf || typeof ctx.createBufferSource !== 'function') return null;

      var delaySec = (o.delayMs || 0) / 1000;
      var durSec = Math.max(0.015, durationMs / 1000);
      var t0 = (ctx.currentTime || 0) + delaySec;
      var peak = typeof o.peakGain === 'number' ? o.peakGain : 0.28;

      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filter = ctx.createBiquadFilter();
      filter.type = o.filterType || 'lowpass';
      filter.frequency.setValueAtTime(o.filterFreq || 1400, t0);
      if (o.filterFreqEnd && typeof filter.frequency.exponentialRampToValueAtTime === 'function') {
        filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.filterFreqEnd), t0 + durSec);
      }
      if (filter.Q && typeof o.Q === 'number') filter.Q.value = o.Q;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(peak, t0);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + durSec);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(destNode || sfxSubmixGain || ctx.destination);

      src.start(t0);
      src.stop(t0 + durSec + 0.01);

      registerVoice(o.cue || 'noise', typeof o.priority === 'number' ? o.priority : 1, delaySec + durSec, function () {
        try { src.stop(); } catch (_) {}
      });
      return src;
    }

    /* ---------------- Tactile Mobile Haptics (Reduced-Motion Guarded) ---------------- */
    function triggerHaptic(kindOrPattern) {
      if (state.destroyed || isReducedMotion()) return false;
      if (!nav || typeof nav.vibrate !== 'function') return false;

      var pattern = kindOrPattern;
      if (typeof kindOrPattern === 'string') {
        pattern = Object.prototype.hasOwnProperty.call(HAPTIC_PATTERNS, kindOrPattern)
          ? HAPTIC_PATTERNS[kindOrPattern]
          : HAPTIC_PATTERNS.light;
      }
      if (pattern == null) return false;

      try {
        var copyPattern = Array.isArray(pattern) ? pattern.slice() : pattern;
        nav.vibrate(copyPattern);
        state.hapticsTriggered += 1;
        state.lastHapticPattern = copyPattern;
        return true;
      } catch (_) {
        return false;
      }
    }

    /* ---------------- Calibrated Procedural SFX Cue Synthesis ---------------- */
    function normalizeCueName(rawName) {
      var key = String(rawName || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (Object.prototype.hasOwnProperty.call(CUE_SPECS, key)) return key;
      if (Object.prototype.hasOwnProperty.call(CUE_ALIASES, key)) return CUE_ALIASES[key];
      return 'ui_nav';
    }

    function play(rawCueName, options) {
      if (state.destroyed) return false;
      var opts = options || {};
      var cue = normalizeCueName(rawCueName);
      var spec = CUE_SPECS[cue] || CUE_SPECS.ui_nav;

      /* Haptics remain active when audio is muted unless reduced-motion is enabled (audio-haptic-feedback) */
      if (opts.haptic !== false) {
        if (cue === 'roulette_tick') {
          var nowMs = Date.now();
          if (nowMs - state.lastRouletteHapticAt >= 65) {
            state.lastRouletteHapticAt = nowMs;
            triggerHaptic(spec.haptic);
          }
        } else {
          var hapKey = opts.crit ? 'crit' : spec.haptic;
          triggerHaptic(hapKey);
        }
      }

      if (state.muted) return false;
      var ctx = getAudioContextIfUnlocked();
      if (!ctx) return false;

      state.cuesPlayed += 1;
      state.cueCounts[cue] = (state.cueCounts[cue] || 0) + 1;
      state.lastCue = cue;
      state.lastFrequencies = [];

      if (spec.duck && opts.duck !== false) {
        triggerSidechainDuck(SIDECHAIN_DUCK_DB, SIDECHAIN_DUCK_MS);
      }

      var prio = spec.priority;

      switch (cue) {
        case 'vault_tumbler': {
          /* 400Hz cast-iron tumbler decay + 800Hz creak burst + 4200Hz 40ms sharp torque snap on lock pass */
          synthNoiseBurst(ctx, sfxSubmixGain, 80, { filterFreq: 800, peakGain: 0.22, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 400, 80, { waveType: 'sawtooth', peakGain: 0.20, cue: cue, priority: prio });
          if (opts.pass !== false) {
            synthTone(ctx, sfxSubmixGain, 4200, 40, {
              waveType: 'square',
              peakGain: 0.30,
              attackMs: 2,
              delayMs: typeof opts.snapDelayMs === 'number' ? opts.snapDelayMs : 42,
              cue: cue,
              priority: prio
            });
          }
          break;
        }

        case 'equip_snap': {
          /* 1850Hz metallic connector click + 2400Hz secondary lock confirmation */
          synthTone(ctx, sfxSubmixGain, 1850, 60, { waveType: 'sine', peakGain: 0.38, attackMs: 3, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 2400, 50, { waveType: 'square', peakGain: 0.25, attackMs: 2, delayMs: 65, cue: cue, priority: prio });
          break;
        }

        case 'gunshot_pistol': {
          /* Layered sub-bass chest punch + filtered white/pink noise crack + slide transient click */
          synthTone(ctx, sfxSubmixGain, 135, 110, { waveType: 'sine', freqEnd: 42, peakGain: 0.48, attackMs: 2, cue: cue, priority: prio });
          synthNoiseBurst(ctx, sfxSubmixGain, 115, { pink: false, filterType: 'bandpass', filterFreq: 2200, filterFreqEnd: 750, Q: 0.9, peakGain: 0.36, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 3100, 22, { waveType: 'square', peakGain: 0.22, attackMs: 1, cue: cue, priority: prio });
          break;
        }

        case 'gunshot_rifle': {
          /* Heavy rifle sub-bass thump + sawtooth body + swept pink noise + bolt carrier transient */
          synthTone(ctx, sfxSubmixGain, 110, 155, { waveType: 'sine', freqEnd: 34, peakGain: 0.54, attackMs: 2, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 210, 95, { waveType: 'sawtooth', freqEnd: 65, filterFreq: 1400, peakGain: 0.28, attackMs: 2, cue: cue, priority: prio });
          synthNoiseBurst(ctx, sfxSubmixGain, 165, { pink: true, filterType: 'lowpass', filterFreq: 2800, filterFreqEnd: 620, Q: 1.1, peakGain: 0.42, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 3600, 25, { waveType: 'square', peakGain: 0.26, attackMs: 1, delayMs: 18, cue: cue, priority: prio });
          break;
        }

        case 'blade_slash': {
          /* Bandpass air-cut noise sweep + steel harmonic shimmer + sub-weight */
          synthTone(ctx, sfxSubmixGain, 160, 80, { waveType: 'sine', freqEnd: 58, peakGain: 0.26, attackMs: 3, cue: cue, priority: prio });
          synthNoiseBurst(ctx, sfxSubmixGain, 130, { pink: true, filterType: 'bandpass', filterFreq: 900, filterFreqEnd: 3800, Q: 2.1, peakGain: 0.32, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 1640, 75, { waveType: 'triangle', freqEnd: 2480, peakGain: 0.25, attackMs: 4, delayMs: 12, cue: cue, priority: prio });
          break;
        }

        case 'heavy_bag_impact': {
          /* Sub-bass leather thud + pink noise slap + transient impact click + chain ring */
          synthTone(ctx, sfxSubmixGain, 96, 160, { waveType: 'sine', freqEnd: 32, peakGain: 0.52, attackMs: 2, cue: cue, priority: prio });
          synthNoiseBurst(ctx, sfxSubmixGain, 95, { pink: true, filterType: 'lowpass', filterFreq: 1150, peakGain: 0.34, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 780, 28, { waveType: 'triangle', freqEnd: 340, peakGain: 0.22, attackMs: 2, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 2950, 38, { waveType: 'sine', peakGain: 0.14, attackMs: 2, delayMs: 28, cue: cue, priority: prio });
          break;
        }

        case 'cash_payout': {
          /* Calibrated 880Hz + 1320Hz confirmation chord + 1760Hz coin shimmer */
          synthChord(ctx, sfxSubmixGain, [880, 1320], 120, { waveType: 'sine', peakGain: 0.30, attackMs: 5, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 1760, 150, { waveType: 'triangle', peakGain: 0.20, attackMs: 5, delayMs: 55, cue: cue, priority: prio });
          break;
        }

        case 'roulette_tick': {
          /* Crisp ivory ball pocket fret click */
          synthTone(ctx, sfxSubmixGain, 1420, 26, { waveType: 'triangle', freqEnd: 820, peakGain: 0.20, attackMs: 1, cue: cue, priority: prio });
          synthNoiseBurst(ctx, sfxSubmixGain, 18, { filterType: 'highpass', filterFreq: 3200, peakGain: 0.12, cue: cue, priority: prio });
          break;
        }

        case 'jackpot_fanfare': {
          /* Exact calibrated 440Hz + 554Hz + 660Hz 600ms major chord swell + octave crown */
          synthChord(ctx, sfxSubmixGain, [440, 554, 660], 600, {
            waveType: 'sine',
            peakGain: 0.35,
            attackMs: 40,
            staggerMs: 5,
            cue: cue,
            priority: prio
          });
          synthTone(ctx, sfxSubmixGain, 880, 480, { waveType: 'triangle', peakGain: 0.22, attackMs: 35, delayMs: 110, cue: cue, priority: prio });
          break;
        }

        case 'era_breakthrough': {
          /* Sovereign ascension sub-drop + rising noir major/9th swell */
          synthTone(ctx, sfxSubmixGain, 110, 460, { waveType: 'sine', freqEnd: 55, peakGain: 0.42, attackMs: 12, cue: cue, priority: prio });
          synthChord(ctx, sfxSubmixGain, [440, 554, 660, 880], 680, {
            waveType: 'triangle',
            peakGain: 0.30,
            attackMs: 45,
            staggerMs: 8,
            cue: cue,
            priority: prio
          });
          synthTone(ctx, sfxSubmixGain, 1320, 420, { waveType: 'sine', peakGain: 0.22, attackMs: 30, delayMs: 160, cue: cue, priority: prio });
          break;
        }

        case 'stealth_alert': {
          /* Perception breach alert sting + dissonant tritone pulse */
          synthTone(ctx, sfxSubmixGain, 620, 110, { waveType: 'sawtooth', freqEnd: 880, filterFreq: 1850, peakGain: 0.28, attackMs: 3, cue: cue, priority: prio });
          synthTone(ctx, sfxSubmixGain, 465, 145, { waveType: 'sawtooth', filterFreq: 1500, peakGain: 0.24, attackMs: 4, delayMs: 95, cue: cue, priority: prio });
          break;
        }

        case 'step_fail': {
          /* Exact calibrated 220Hz 150ms decay thud (audio-haptic-feedback STEP_FAIL) */
          synthTone(ctx, sfxSubmixGain, 220, 150, { waveType: 'triangle', peakGain: 0.28, attackMs: 4, cue: cue, priority: prio });
          break;
        }

        case 'wrong_order': {
          /* Calibrated 330Hz 100ms neutral correction tone */
          synthTone(ctx, sfxSubmixGain, 330, 100, { waveType: 'sine', peakGain: 0.20, attackMs: 4, cue: cue, priority: prio });
          break;
        }

        case 'session_reset': {
          /* Calibrated 180Hz 80ms short decay */
          synthTone(ctx, sfxSubmixGain, 180, 80, { waveType: 'triangle', peakGain: 0.20, attackMs: 3, cue: cue, priority: prio });
          break;
        }

        case 'ui_nav':
        default: {
          synthTone(ctx, sfxSubmixGain, 520, 32, { waveType: 'sine', freqEnd: 760, peakGain: 0.14, attackMs: 2, cue: 'ui_nav', priority: 2 });
          break;
        }
      }

      return true;
    }

    /* ---------------- Hospital / Jail Low-Pass Muffle DSP ---------------- */
    function detectHospitalOrJailFromDom() {
      if (!doc) return { muffled: false, reason: 'none' };
      var main = doc.getElementById ? doc.getElementById('zone-main') : null;
      var scr = main && typeof main.getAttribute === 'function'
        ? String(main.getAttribute('data-zone-screen') || '').toLowerCase()
        : '';
      if (scr === 'hospital' || scr === 'jail') {
        return { muffled: true, reason: scr };
      }
      try {
        if (doc.documentElement && doc.documentElement.dataset) {
          var ps = String(doc.documentElement.dataset.zonePlayerStatus || '').toLowerCase();
          if (ps === 'hospital' || ps === 'jail') return { muffled: true, reason: ps };
        }
        var g = win && win.__zoneGame;
        if (g && g.p) {
          if (Number(g.p.hospitalUntil || 0) > Date.now() / 1000) return { muffled: true, reason: 'hospital' };
          if (Number(g.p.jailUntil || 0) > Date.now() / 1000) return { muffled: true, reason: 'jail' };
        }
      } catch (_) {}
      return { muffled: false, reason: 'none' };
    }

    function setMuffled(flag, reason) {
      var next = Boolean(flag);
      state.muffled = next;
      state.muffleReason = next ? (reason || 'status') : 'none';
      if (audioCtx && statusLowpassFilter && statusLowpassFilter.frequency) {
        var now = audioCtx.currentTime || 0;
        setParamSmooth(statusLowpassFilter.frequency, next ? MUFFLED_FILTER_HZ : OPEN_FILTER_HZ, now, 0.32);
        if (statusLowpassFilter.Q) {
          statusLowpassFilter.Q.value = next ? 1.15 : 0.707;
        }
      }
      return state.muffled;
    }

    function syncEnvironmentMuffle() {
      var det = detectHospitalOrJailFromDom();
      if (det.muffled !== state.muffled || (det.muffled && det.reason !== state.muffleReason)) {
        setMuffled(det.muffled, det.reason);
      }
    }

    /* ---------------- Adaptive Noir Soundtrack & Pier 4 Procedural Rain ---------------- */
    function ensurePierRainBed(ctx) {
      if (rainNodes || !ctx || !stemGains.home_city) return;
      buildNoiseBuffers(ctx);
      if (!pinkNoiseBuf || typeof ctx.createBufferSource !== 'function') return;
      try {
        var src = ctx.createBufferSource();
        src.buffer = pinkNoiseBuf;
        src.loop = true;

        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 960;
        if (filter.Q) filter.Q.value = 0.65;

        var gain = ctx.createGain();
        gain.gain.value = 0.24;

        src.connect(filter);
        filter.connect(gain);
        gain.connect(stemGains.home_city);
        src.start(ctx.currentTime || 0);

        rainNodes = { src: src, filter: filter, gain: gain };
      } catch (_) {
        rainNodes = null;
      }
    }

    function stopPierRainBed() {
      if (!rainNodes) return;
      try { rainNodes.src.stop(); } catch (_) {}
      try { rainNodes.src.disconnect(); } catch (_) {}
      rainNodes = null;
    }

    function applyStemCrossfade(targetStem, fadeSec) {
      var dur = typeof fadeSec === 'number' ? fadeSec : CROSSFADE_SEC;
      state.lastCrossfadeSec = dur;
      if (!audioCtx) return;
      var now = audioCtx.currentTime || 0;
      var keys = ['home_city', 'crimes', 'combat'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var node = stemGains[k];
        if (node && node.gain) {
          var goal = k === targetStem ? STEM_TARGET_GAINS[k] : 0.0001;
          setParamSmooth(node.gain, goal, now, dur);
        }
      }
    }

    function setScreenRoute(screenName) {
      var cleanScreen = String(screenName || 'home').trim().toLowerCase() || 'home';
      var nextStem = mapScreenToStem(cleanScreen);
      var stemChanged = nextStem !== state.activeStem;
      state.activeScreen = cleanScreen;
      state.activeStem = nextStem;

      if (cleanScreen === 'hospital' || cleanScreen === 'jail') {
        setMuffled(true, cleanScreen);
      } else {
        syncEnvironmentMuffle();
      }

      if (stemChanged) {
        state.stemTransitionCount += 1;
      }
      if (audioCtx) {
        applyStemCrossfade(nextStem, CROSSFADE_SEC);
      }
      return nextStem;
    }

    function setStealthThreat(threatValue) {
      var v = Number(threatValue);
      if (!Number.isFinite(v)) v = 0.15;
      state.stealthThreat = Math.max(0, Math.min(1, v));
      return state.stealthThreat;
    }

    function stepAdaptiveNoirSequencer() {
      if (state.destroyed || state.muted || !state.musicEnabled || !state.gestureUnlocked) return;
      if (doc && doc.hidden) return;
      var ctx = getAudioContextIfUnlocked();
      if (!ctx) return;

      ensurePierRainBed(ctx);

      var step = state.stepIndex++;
      var stem = state.activeStem;

      if (stem === 'home_city' && stemGains.home_city) {
        /* Stem 1 (Home / City): Warm minor-9th dark-noir Rhodes pad + Pier 4 rain */
        if (step % 8 === 0) {
          state.chordState = pickMarkovNext(NOIR_MARKOV, state.chordState);
          var chordNotes = NOIR_CHORDS[state.chordState] || NOIR_CHORDS.Dm9;
          for (var c = 0; c < chordNotes.length; c++) {
            synthTone(ctx, stemGains.home_city, chordNotes[c], 1450, {
              waveType: c === 0 ? 'sine' : 'triangle',
              filterFreq: 920,
              peakGain: c === 0 ? 0.18 : 0.09,
              attackMs: 140,
              delayMs: c * 18,
              cue: 'stem_home_pad',
              priority: 2
            });
          }
        } else if (step % 4 === 2) {
          var arpPool = NOIR_CHORDS[state.chordState] || NOIR_CHORDS.Dm9;
          var note = arpPool[(step >> 1) % arpPool.length] * 2;
          synthTone(ctx, stemGains.home_city, note, 420, {
            waveType: 'sine',
            filterFreq: 1400,
            peakGain: 0.06,
            attackMs: 35,
            cue: 'stem_home_rhodes',
            priority: 2
          });
        }
      } else if (stem === 'crimes' && stemGains.crimes) {
        /* Stem 2 (Crimes): Tense sub-pulse + high-hat tick scaling cutoff & tempo with stealthThreat */
        var threat = state.stealthThreat;
        var subFreq = CRIMES_PULSE_NOTES[step % CRIMES_PULSE_NOTES.length];
        var cutoff = Math.round(280 + threat * 1200);
        synthTone(ctx, stemGains.crimes, subFreq, 190, {
          waveType: 'sawtooth',
          filterFreq: cutoff,
          filterQ: 2.4,
          peakGain: 0.24 + threat * 0.10,
          attackMs: 8,
          cue: 'stem_crimes_sub',
          priority: 2
        });
        if (step % 2 === 1 || threat >= 0.55) {
          synthNoiseBurst(ctx, stemGains.crimes, 28, {
            filterType: 'highpass',
            filterFreq: 6200,
            peakGain: 0.08 + threat * 0.09,
            cue: 'stem_crimes_hat',
            priority: 2
          });
        }
      } else if (stem === 'combat' && stemGains.combat) {
        /* Stem 3 (Attack / Faction / Missions): Driving dark-synth bassline + percussion stem */
        var bassHz = COMBAT_BASS_OSTINATO[step % COMBAT_BASS_OSTINATO.length];
        synthTone(ctx, stemGains.combat, bassHz, 175, {
          waveType: 'sawtooth',
          filterFreq: 1180,
          filterFreqEnd: 320,
          filterQ: 1.8,
          peakGain: 0.26,
          attackMs: 5,
          cue: 'stem_combat_bass',
          priority: 2
        });
        if (step % 4 === 0) {
          /* Procedural Synth Kick */
          synthTone(ctx, stemGains.combat, 128, 110, {
            waveType: 'sine',
            freqEnd: 38,
            peakGain: 0.32,
            attackMs: 2,
            cue: 'stem_combat_kick',
            priority: 2
          });
        } else if (step % 4 === 2) {
          /* Procedural Noir Snare Rim */
          synthNoiseBurst(ctx, stemGains.combat, 85, {
            pink: true,
            filterType: 'bandpass',
            filterFreq: 1850,
            Q: 1.2,
            peakGain: 0.20,
            cue: 'stem_combat_snare',
            priority: 2
          });
        }
      }
    }

    function computeStepIntervalMs() {
      if (state.activeStem === 'crimes') {
        var bpm = 92 + state.stealthThreat * 40; // 92 BPM -> 132 BPM with stealth threat
        return Math.round((60 / bpm / 2) * 1000);
      }
      if (state.activeStem === 'combat') {
        return 220; // ~136 BPM driving eighth notes
      }
      return 310; // Relaxed noir lounge pulse
    }

    function scheduleNextMusicTick() {
      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }
      if (state.destroyed || !state.gestureUnlocked || !state.musicEnabled || state.muted) return;
      if (doc && doc.hidden) return;
      schedulerTimer = setTimeout(function () {
        schedulerTimer = null;
        stepAdaptiveNoirSequencer();
        scheduleNextMusicTick();
      }, computeStepIntervalMs());
    }

    function syncMusicEngineState() {
      var active = Boolean(state.gestureUnlocked && state.musicEnabled && !state.muted && !(doc && doc.hidden));
      if (audioCtx && musicMasterGain && musicMasterGain.gain) {
        var now = audioCtx.currentTime || 0;
        setParamSmooth(musicMasterGain.gain, active ? 1.0 : 0.0001, now, 0.18);
      }
      if (active) {
        ensurePierRainBed(audioCtx);
        if (!schedulerTimer) {
          stepAdaptiveNoirSequencer();
          scheduleNextMusicTick();
        }
      } else {
        if (schedulerTimer) {
          clearTimeout(schedulerTimer);
          schedulerTimer = null;
        }
        stopPierRainBed();
      }
    }

    /* ---------------- Bidirectional Mute & Music Toggle UI Sync ---------------- */
    function renderMusicBtnHtml(ar) {
      var label = state.musicEnabled && !state.muted
        ? (ar ? 'الموسيقى: مفعل' : 'Music: ON')
        : (ar ? 'الموسيقى: صامت' : 'Music: OFF');
      return (state.musicEnabled && !state.muted ? SVG_MUSIC_ON : SVG_MUSIC_OFF) + '<span>' + label + '</span>';
    }

    function renderSfxBtnHtml(ar) {
      var label = !state.muted
        ? (ar ? 'الصوت: مفعل' : 'SFX: ON')
        : (ar ? 'الصوت: صامت' : 'SFX: OFF');
      return (!state.muted ? SVG_SFX_ON : SVG_SFX_OFF) + '<span>' + label + '</span>';
    }

    function ensureAudioUiStyles() {
      if (!doc || !doc.createElement) return;
      try {
        if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
        var st = doc.createElement('style');
        st.id = STYLE_ID;
        st.textContent =
          '.zah-header-btn-group{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;box-sizing:border-box;}' +
          '.zah-sidebar-dock{display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:100%;max-width:100%;box-sizing:border-box;padding:4px 0;}' +
          '.zah-sidebar-dock .zig-sound-btn{flex:1 1 auto;min-height:36px;padding:6px 9px;font-size:11px;white-space:nowrap;}' +
          '@media (max-width:900px){.zah-sidebar-dock .zig-sound-btn{min-height:44px !important;}}';
        var target = doc.head || doc.documentElement;
        if (target && target.appendChild) target.appendChild(st);
      } catch (_) {}
    }

    function syncDomAudioButtons() {
      if (!doc || !doc.querySelectorAll) return;
      ensureAudioUiStyles();
      var ar = isArabic();

      /* 1. Sync existing #zig-sound-toggle & [data-zig-sfx] */
      var zigBtn = doc.getElementById ? doc.getElementById('zig-sound-toggle') : null;
      if (zigBtn) {
        zigBtn.setAttribute('data-zig-muted', state.muted ? '1' : '0');
        zigBtn.setAttribute('data-zig-sfx', state.muted ? 'off' : 'on');
        zigBtn.setAttribute('aria-pressed', state.muted ? 'false' : 'true');

        /* Mount compact Music: ON/OFF pill beside SFX: ON/OFF inside .zig-arcade-header */
        var hdr = zigBtn.parentElement;
        if (hdr && hdr.querySelector && !hdr.querySelector('[data-zah-music-toggle="1"]')) {
          var mBtn = doc.createElement('button');
          mBtn.type = 'button';
          mBtn.id = 'zah-music-toggle';
          mBtn.className = 'zig-sound-btn zah-music-btn';
          mBtn.setAttribute('data-zah-music-toggle', '1');
          mBtn.setAttribute('data-zah-music', state.musicEnabled ? 'on' : 'off');
          mBtn.setAttribute('aria-pressed', state.musicEnabled ? 'true' : 'false');
          mBtn.innerHTML = renderMusicBtnHtml(ar);
          hdr.appendChild(mBtn);
        }
      }

      /* 2. Mount compact audio dock at bottom of aside.zone-sidebar so all routes have SFX + Music pills */
      var sidebar = doc.querySelector ? doc.querySelector('aside.zone-sidebar') : null;
      if (sidebar && !sidebar.querySelector('#zah-sidebar-audio-dock')) {
        var dock = doc.createElement('div');
        dock.id = 'zah-sidebar-audio-dock';
        dock.className = 'zah-sidebar-dock';
        dock.innerHTML =
          '<button type="button" class="zig-sound-btn" data-zig-sfx="' + (state.muted ? 'off' : 'on') + '" data-zah-sfx-toggle="1">' +
            renderSfxBtnHtml(ar) +
          '</button>' +
          '<button type="button" class="zig-sound-btn zah-music-btn" data-zah-music-toggle="1" data-zah-music="' + (state.musicEnabled ? 'on' : 'off') + '">' +
            renderMusicBtnHtml(ar) +
          '</button>';
        sidebar.appendChild(dock);
      }

      var sfxBtns = doc.querySelectorAll('[data-zig-sfx], [data-zah-sfx-toggle]');
      for (var i = 0; i < sfxBtns.length; i++) {
        var sb = sfxBtns[i];
        sb.setAttribute('data-zig-sfx', state.muted ? 'off' : 'on');
        sb.setAttribute('data-zig-muted', state.muted ? '1' : '0');
        sb.setAttribute('aria-pressed', state.muted ? 'false' : 'true');
        if (sb.hasAttribute('data-zah-sfx-toggle') || sb.id !== 'zig-sound-toggle') {
          sb.innerHTML = renderSfxBtnHtml(ar);
        } else {
          var spanEl = sb.querySelector ? sb.querySelector('span') : null;
          if (spanEl) {
            spanEl.textContent = !state.muted
              ? (ar ? 'الصوت: مفعل' : 'SFX: ON')
              : (ar ? 'الصوت: صامت' : 'SFX: OFF');
          }
        }
      }

      var musicBtns = doc.querySelectorAll('[data-zah-music-toggle]');
      for (var m = 0; m < musicBtns.length; m++) {
        var mb = musicBtns[m];
        mb.setAttribute('data-zah-music', (state.musicEnabled && !state.muted) ? 'on' : 'off');
        mb.setAttribute('aria-pressed', (state.musicEnabled && !state.muted) ? 'true' : 'false');
        mb.innerHTML = renderMusicBtnHtml(ar);
      }
    }

    function setMuted(flag, silentEvent) {
      var next = Boolean(flag);
      state.muted = next;
      safeSetStorage('zone_sfx_muted', next ? '1' : '0');
      safeSetStorage('zig_muted', next ? '1' : '0');
      if (win) win.__zoneMuted = next;

      if (audioCtx && masterGain && masterGain.gain) {
        var now = audioCtx.currentTime || 0;
        setParamSmooth(masterGain.gain, next ? 0.0 : state.masterVolume, now, 0.025);
      }

      syncMusicEngineState();
      syncDomAudioButtons();

      if (!silentEvent && !syncingMute && win && typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        syncingMute = true;
        try {
          win.dispatchEvent(new CustomEvent('zone:mute-change', {
            detail: { muted: next, source: 'ZoneAudioHaptics' }
          }));
        } catch (_) {}
        syncingMute = false;
      }
      return state.muted;
    }

    function isMuted() {
      return Boolean(state.muted);
    }

    function toggleMute() {
      setMuted(!state.muted);
      if (!state.muted) {
        play('ui_nav');
      }
      return state.muted;
    }

    function setMusicEnabled(flag) {
      var next = Boolean(flag);
      state.musicEnabled = next;
      safeSetStorage('zone_music_enabled', next ? '1' : '0');
      syncMusicEngineState();
      syncDomAudioButtons();
      return state.musicEnabled;
    }

    function isMusicEnabled() {
      return Boolean(state.musicEnabled);
    }

    function toggleMusic() {
      if (state.muted && !state.musicEnabled) {
        setMuted(false);
      }
      return setMusicEnabled(!state.musicEnabled);
    }

    function setMasterVolume(vol) {
      var clamped = Math.max(0, Math.min(1, Number(vol)));
      if (!Number.isFinite(clamped)) clamped = MASTER_HEADROOM_GAIN;
      state.masterVolume = clamped;
      if (audioCtx && masterGain && masterGain.gain && !state.muted) {
        setParamSmooth(masterGain.gain, clamped, audioCtx.currentTime || 0, 0.03);
      }
      return state.masterVolume;
    }

    /* ---------------- Zero-Friction Auto-Listeners (3D, Tactical, AudioCue, DOM) ---------------- */
    function handle3DActionEvent(ev) {
      var d = (ev && ev.detail) || {};
      var stage = String(d.stageKind || d.stage || '').toLowerCase();
      var act = String(d.actionName || d.action || '').toLowerCase();
      var payload = d.payload || {};

      if (act.indexOf('crack') >= 0 || act.indexOf('vault') >= 0 || act.indexOf('breach') >= 0 || stage === 'heist-breach') {
        play('vault_tumbler', { pass: payload.pass !== false });
      } else if (act === 'outfit' || act === 'equip' || stage === 'character-turntable') {
        play('equip_snap');
      } else if (act === 'slash' || act === 'melee') {
        play('blade_slash', { crit: Boolean(payload.crit) });
      } else if (act === 'fire' || act === 'shoot' || (stage === 'combat-arena' && act === 'attack')) {
        var w = String(payload.weapon || payload.weaponId || '').toLowerCase();
        if (/rifle|ak|sniper|smg|bullpup|shotgun/.test(w)) {
          play('gunshot_rifle');
        } else {
          play('gunshot_pistol');
        }
      } else if (act === 'punch' || act === 'hook' || stage === 'gym-ironpit') {
        play('heavy_bag_impact', { crit: Boolean(payload.crit || payload.overdrive) });
      } else if (act === 'hit' || act === 'damage') {
        play('step_fail');
      } else if (act === 'jackpot') {
        play('jackpot_fanfare');
      } else if (act === 'spin' || act === 'tick') {
        play('roulette_tick');
      } else if (act === 'arcade-win' || act === 'pulse') {
        play('cash_payout');
      } else if (act) {
        play(act);
      }
    }

    function handleAudioCueEvent(ev) {
      var d = (ev && ev.detail) || {};
      var rawCue = d.cue || d.sound || d.type || 'ui_nav';
      play(rawCue, {
        crit: Boolean(d.crit || (Number(d.combo) >= 4)),
        pass: d.pass !== false
      });
    }

    function handleTacticalEvent(ev) {
      var d = (ev && ev.detail) || {};
      if (typeof d.threat === 'number') {
        setStealthThreat(d.threat);
      } else if (typeof d.threatTier === 'string') {
        var tier = d.threatTier.toUpperCase();
        if (tier === 'HUNTED') setStealthThreat(0.95);
        else if (tier === 'SUSPICIOUS') setStealthThreat(0.55);
        else if (tier === 'CLEAR') setStealthThreat(0.12);
      }

      var kind = String(d.type || d.event || d.maneuver || '').toLowerCase();
      if (kind === 'stealth_breach') {
        play(d.success === false ? 'stealth_alert' : 'vault_tumbler');
      } else if (kind === 'hunted' || kind === 'alert' || kind === 'detected') {
        play('stealth_alert');
      } else if (kind === 'counter_parry') {
        play('blade_slash', { crit: true });
      } else if (kind === 'suppress_fire' || kind === 'armor_pierce') {
        play('gunshot_rifle');
      } else if (kind === 'rush_interrupt') {
        play('heavy_bag_impact', { crit: true });
      } else if (kind === 'sink_purchased' || kind === 'payout') {
        play('cash_payout');
      } else if (kind === 'anti_cheat_flag' || kind === 'fail') {
        play('step_fail');
      }
    }

    function classifyDelegatedButtonCue(btn) {
      if (!btn || typeof btn.getAttribute !== 'function') return null;
      var txt = String(btn.textContent || '').toLowerCase();
      var cls = String(btn.className || '').toLowerCase();

      if (btn.hasAttribute('data-zab-claim-era') || /breakthrough|اختراق العصر/.test(txt)) {
        return 'era_breakthrough';
      }
      if (btn.hasAttribute('data-outfit') || btn.hasAttribute('data-equip') || cls.indexOf('equip') >= 0 || /\bequip\b|تجهيز/.test(txt)) {
        return 'equip_snap';
      }
      if (btn.hasAttribute('data-crime-attempt') || btn.hasAttribute('data-torn-crime') || /breach|crack|commit|اخترق|تنفيذ/.test(txt)) {
        return 'vault_tumbler';
      }
      if (btn.hasAttribute('data-gym-train') || cls.indexOf('gym-train') >= 0 || /\btrain\b|تدريب/.test(txt)) {
        return 'heavy_bag_impact';
      }
      if (state.activeScreen === 'attack' && (cls.indexOf('action-primary') >= 0 || cls.indexOf('action-danger') >= 0 || /attack|strike|fire|هجوم/.test(txt))) {
        return /slash|knife|blade|سيف|سكين/.test(txt) ? 'blade_slash' : 'gunshot_pistol';
      }
      if (state.activeScreen === 'casino' && (/spin|bet|deal|دوّر|رهان/.test(txt) || cls.indexOf('zig-btn') >= 0)) {
        return 'roulette_tick';
      }
      if (/claim|collect|deposit|fence|استلام|تحصيل/.test(txt)) {
        return 'cash_payout';
      }
      if (btn.hasAttribute('data-zone-screen') || cls.indexOf('zone-header-link') >= 0) {
        return 'ui_nav';
      }
      return null;
    }

    function bindDomAndWindowListeners() {
      if (!win) return;

      var onGesture = function (ev) {
        unlockFromGesture(ev);
      };

      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('pointerdown', onGesture, { passive: true, capture: true });
        doc.addEventListener('keydown', onGesture, { passive: true, capture: true });
        doc.addEventListener('click', function (ev) {
          unlockFromGesture(ev);
          var t = ev && ev.target;
          if (!t || typeof t.closest !== 'function') return;

          var musicToggle = t.closest('[data-zah-music-toggle]');
          if (musicToggle) {
            toggleMusic();
            play('ui_nav');
            return;
          }

          var sfxToggle = t.closest('[data-zah-sfx-toggle], [data-zig-sfx], #zig-sound-toggle, [data-zone-mute-toggle]');
          if (sfxToggle) {
            if (sfxToggle.hasAttribute('data-zah-sfx-toggle')) {
              toggleMute();
            } else {
              /* Allow #zig-sound-toggle native click handler to flip first, then sync */
              setTimeout(function () {
                var zigAttr = sfxToggle.getAttribute('data-zig-muted');
                if (zigAttr === '1' || zigAttr === '0') {
                  setMuted(zigAttr === '1');
                } else {
                  setMuted(!state.muted);
                }
              }, 0);
            }
            return;
          }

          var btn = t.closest('button:not(:disabled)');
          if (!btn) return;
          var now = Date.now();
          if (now - state.lastClickCueAt < 30) return;
          var cue = classifyDelegatedButtonCue(btn);
          if (cue) {
            state.lastClickCueAt = now;
            play(cue);
          }
        }, { passive: true });

        doc.addEventListener('visibilitychange', function () {
          syncMusicEngineState();
        });
      }

      if (typeof win.addEventListener === 'function') {
        win.addEventListener('pointerdown', onGesture, { passive: true, capture: true });
        win.addEventListener('keydown', onGesture, { passive: true, capture: true });
        win.addEventListener('zone:3d-action', handle3DActionEvent);
        win.addEventListener('zone:audio-cue', handleAudioCueEvent);
        win.addEventListener('zone:tactical-event', handleTacticalEvent);
        win.addEventListener('zone:mute-change', function (ev) {
          if (syncingMute) return;
          var d = ev && ev.detail;
          if (d && d.source === 'ZoneAudioHaptics') return;
          var nextMuted = d && typeof d.muted === 'boolean' ? d.muted : readPersistedMute();
          setMuted(nextMuted, true);
        });
      }

      /* Observe #zone-main [data-zone-screen] transitions for 0.6s adaptive stem crossfades */
      function attachRouteObserver() {
        if (!doc) return;
        var main = doc.getElementById ? doc.getElementById('zone-main') : null;
        if (main && typeof main.getAttribute === 'function') {
          var initialScr = main.getAttribute('data-zone-screen') || 'home';
          setScreenRoute(initialScr);
          if (typeof MutationObserver === 'function' && !mainObserver) {
            mainObserver = new MutationObserver(function () {
              var cur = main.getAttribute('data-zone-screen') || 'home';
              if (cur !== state.activeScreen) {
                setScreenRoute(cur);
              }
              if (!domScanTimer) {
                domScanTimer = setTimeout(function () {
                  domScanTimer = null;
                  syncDomAudioButtons();
                  syncEnvironmentMuffle();
                }, 60);
              }
            });
            mainObserver.observe(main, { attributes: true, attributeFilter: ['data-zone-screen'], childList: true });
          }
        }
        syncDomAudioButtons();
        syncEnvironmentMuffle();
      }

      attachRouteObserver();
      if (doc && doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
        doc.addEventListener('DOMContentLoaded', attachRouteObserver, { once: true });
      }
      if (doc && doc.body && typeof MutationObserver === 'function' && !bodyObserver) {
        bodyObserver = new MutationObserver(function () {
          if (!mainObserver && doc.getElementById && doc.getElementById('zone-main')) {
            attachRouteObserver();
          }
        });
        bodyObserver.observe(doc.body, { childList: true });
      }
    }

    function diagnostics() {
      return {
        version: '155.0',
        audioContextCreated: Boolean(audioCtx),
        audioContextState: audioCtx ? audioCtx.state : 'uninitialized',
        gestureUnlocked: state.gestureUnlocked,
        muted: state.muted,
        musicEnabled: state.musicEnabled,
        masterVolume: state.masterVolume,
        masterGainValue: masterGain && masterGain.gain ? masterGain.gain.value : null,
        muffled: state.muffled,
        muffleReason: state.muffleReason,
        lowpassFilterHz: statusLowpassFilter && statusLowpassFilter.frequency ? statusLowpassFilter.frequency.value : null,
        compressorActive: Boolean(masterCompressor),
        duckCount: state.duckCount,
        lastDuckDb: state.lastDuckDb,
        lastDuckDurationMs: state.lastDuckDurationMs,
        musicSubmixGainValue: musicSubmixGain && musicSubmixGain.gain ? musicSubmixGain.gain.value : null,
        activeScreen: state.activeScreen,
        activeStem: state.activeStem,
        stemTransitionCount: state.stemTransitionCount,
        lastCrossfadeSec: state.lastCrossfadeSec,
        stealthThreat: state.stealthThreat,
        chordState: state.chordState,
        activeVoiceCount: activeVoices.length,
        maxVoices: MAX_ACTIVE_VOICES,
        cuesPlayed: state.cuesPlayed,
        cueCounts: Object.assign({}, state.cueCounts),
        lastCue: state.lastCue,
        lastFrequencies: state.lastFrequencies.slice(),
        hapticsTriggered: state.hapticsTriggered,
        lastHapticPattern: Array.isArray(state.lastHapticPattern) ? state.lastHapticPattern.slice() : state.lastHapticPattern,
        reducedMotion: isReducedMotion(),
        availableCues: Object.keys(CUE_SPECS)
      };
    }

    function destroy() {
      state.destroyed = true;
      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }
      if (domScanTimer) {
        clearTimeout(domScanTimer);
        domScanTimer = null;
      }
      stopPierRainBed();
      if (mainObserver) {
        try { mainObserver.disconnect(); } catch (_) {}
        mainObserver = null;
      }
      if (bodyObserver) {
        try { bodyObserver.disconnect(); } catch (_) {}
        bodyObserver = null;
      }
      if (audioCtx && typeof audioCtx.close === 'function') {
        try { audioCtx.close(); } catch (_) {}
      }
      audioCtx = null;
    }

    bindDomAndWindowListeners();

    return {
      play: play,
      triggerHaptic: triggerHaptic,
      triggerSidechainDuck: triggerSidechainDuck,
      setMuted: setMuted,
      isMuted: isMuted,
      toggleMute: toggleMute,
      setMusicEnabled: setMusicEnabled,
      isMusicEnabled: isMusicEnabled,
      toggleMusic: toggleMusic,
      setMasterVolume: setMasterVolume,
      setScreenRoute: setScreenRoute,
      setStealthThreat: setStealthThreat,
      setMuffled: setMuffled,
      stepMusicNow: stepAdaptiveNoirSequencer,
      unlockFromGesture: unlockFromGesture,
      syncDomAudioButtons: syncDomAudioButtons,
      diagnostics: diagnostics,
      destroy: destroy,
      createInstance: createZoneAudioHapticsEngine
    };
  }

  /* Mount singleton automatically in browser / DOM environments */
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__zoneAudioHapticsLoaded) {
    window.__zoneAudioHapticsLoaded = true;
    var instance = createZoneAudioHapticsEngine();
    window.ZoneAudioHaptics = instance;
    if (root) root.ZoneAudioHaptics = instance;
  } else if (root && root.ZoneAudioHaptics && !root.ZoneAudioHaptics.createInstance) {
    root.ZoneAudioHaptics.createInstance = createZoneAudioHapticsEngine;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createZoneAudioHapticsEngine: createZoneAudioHapticsEngine,
      ZoneAudioHaptics: root ? root.ZoneAudioHaptics : null
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

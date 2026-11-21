/* ==========================================================================
 * ZONE v159 - TRACK 14: DETERMINISTIC COMBAT & HEIST COMMAND-LOG RECORDER
 *                       + INTERACTIVE 3D REPLAY VIEWER
 * Exclusive Ownership: @replay-determinism (assets/ui/zone-replay-viewer.js)
 * Exposes: window.ZoneReplayViewer
 * Mounts ONLY on: screen === 'attack' and screen === 'crimes' (0 mounts on home!)
 *
 * Skills Applied:
 *   - using-determinism-and-replay (Bit-exact integer state reducer, SplitMix32
 *     seed governance, isolated Mulberry32 per-channel PRNGs, per-tick canonical
 *     FNV-1a/SplitMix32 state hashing, binary-search divergence localisation)
 *   - replay-viewer (Interactive episode picker, Play/Pause, Step -1/+1 tick,
 *     Timeline Scrubber, 0.5x/1x/2x playback speed, seed export/import share)
 *   - game-development-time-source-and-tick-policy (Authoritative 100ms logical
 *     tick clock separated from presentation playback time-scale & pause rules)
 *   - game-development-command-flow (Serializable command contracts decoupled
 *     from input callbacks, deterministic replay execution & history log)
 *   - game-development-events-and-signals (Clean pub/sub capture of
 *     zone:tactical-event & zone:3d-action with re-entrancy feedback guard)
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneReplayViewerBooted && window.ZoneReplayViewer) return;
  window.__zoneReplayViewerBooted = true;

  var LOGICAL_TICK_MS = 100;
  var ALLOWED_SCREENS = { attack: true, crimes: true };
  var ALLOWED_SPEEDS = [0.5, 1, 2];

  /* ------------------------------------------------------------------------
   * 1. DETERMINISTIC SEED GOVERNANCE & ISOLATED PRNG HIERARCHY
   *    (using-determinism-and-replay: 02-seed-governance & 03-rng-isolation)
   * ------------------------------------------------------------------------ */
  function splitMix32(seed) {
    var z = ((Number(seed) >>> 0) + 0x9E3779B9) | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
    return ((z ^ (z >>> 16)) >>> 0);
  }

  function createMulberry32(seed) {
    var state = (Number(seed) >>> 0) || 0x15900001;
    var calls = 0;

    function nextUint32() {
      calls += 1;
      var t = (state = (state + 0x6D2B79F5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0);
    }

    return {
      nextUint32: nextUint32,
      nextFloat: function () {
        return nextUint32() / 4294967296;
      },
      nextInt: function (min, max) {
        var lo = Math.floor(Number(min) || 0);
        var hi = Math.floor(Number(max) || 0);
        if (hi <= lo) return lo;
        return lo + (nextUint32() % (hi - lo + 1));
      },
      getState: function () {
        return state >>> 0;
      },
      getCallCount: function () {
        return calls;
      },
      setState: function (nextState, nextCalls) {
        state = (Number(nextState) >>> 0) || 0x15900001;
        if (nextCalls != null) calls = Math.max(0, Number(nextCalls) || 0);
      }
    };
  }

  /**
   * Derives isolated per-subsystem RNG channels from the governed episode seed
   * so combat rolls, stealth vision noise, and loot calculations never pollute
   * one shared RNG stream ("one big RNG" anti-pattern prevention).
   */
  function createIsolatedRngRegistry(masterSeed) {
    var base = (Number(masterSeed) >>> 0) || 0x159A4F10;
    var combatSeed = splitMix32(base ^ 0xA11AC0DE);
    var stealthSeed = splitMix32(base ^ 0x57EA1740);
    var lootSeed = splitMix32(base ^ 0x1007BEEF);

    var combatRng = createMulberry32(combatSeed);
    var stealthRng = createMulberry32(stealthSeed);
    var lootRng = createMulberry32(lootSeed);

    return {
      masterSeed: base,
      combat: combatRng,
      stealth: stealthRng,
      loot: lootRng,
      snapshot: function () {
        return {
          combatState: combatRng.getState(),
          combatCalls: combatRng.getCallCount(),
          stealthState: stealthRng.getState(),
          stealthCalls: stealthRng.getCallCount(),
          lootState: lootRng.getState(),
          lootCalls: lootRng.getCallCount()
        };
      },
      restore: function (snap) {
        if (!snap) return;
        combatRng.setState(snap.combatState, snap.combatCalls);
        stealthRng.setState(snap.stealthState, snap.stealthCalls);
        lootRng.setState(snap.lootState, snap.lootCalls);
      }
    };
  }

  function formatHex32(val, prefix) {
    var hex = ((Number(val) >>> 0).toString(16)).toUpperCase().padStart(8, '0');
    return (prefix != null ? prefix : '0x') + hex;
  }

  function fnv1a32(str) {
    var s = String(str || '');
    var h = 0x811C9DC5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return splitMix32(h >>> 0);
  }

  /* ------------------------------------------------------------------------
   * 2. CANONICAL STATE ENCODING & DETERMINISTIC TICK SIMULATOR
   *    (11-canonical-state-encoding + 04-snapshot-strategy + 05-divergence)
   * ------------------------------------------------------------------------ */
  function encodeCanonicalTickState(st) {
    return [
      't=' + (st.tick | 0),
      'scr=' + String(st.screen || 'attack'),
      'dst=' + String(st.district || 'pier_4'),
      'php=' + (st.playerHp | 0),
      'rhp=' + (st.rivalHp | 0),
      'vlt=' + (st.vaultIntegrity | 0),
      'nse=' + (st.noiseLevel | 0),
      'cmb=' + (st.comboChain | 0),
      'gph=' + (st.guardPhasePermille | 0),
      'thr=' + String(st.threatTier || 'CLEAR'),
      'stn=' + String(st.activeStance || 'ballistic_guard'),
      'lut=' + (st.lootScore | 0),
      'act=' + String(st.lastAction || 'INIT'),
      'stg=' + String(st.lastStage || 'none'),
      'cue=' + String(st.lastCue || 'none'),
      'rc=' + (st.rngSnapshot.combatState >>> 0),
      'rs=' + (st.rngSnapshot.stealthState >>> 0),
      'rl=' + (st.rngSnapshot.lootState >>> 0)
    ].join('|');
  }

  function computeCanonicalStateHash(st) {
    return formatHex32(fnv1a32(encodeCanonicalTickState(st)), '0x');
  }

  function normalizeCommand(cmd, idx, fallbackScreen) {
    var c = cmd || {};
    var scr = c.screen || fallbackScreen || 'attack';
    var stage = c.stage || (scr === 'crimes' ? 'heist-breach' : 'combat-arena');
    var action = String(c.action || 'attack');
    var cue = String(c.cue || (stage === 'heist-breach' ? 'vault_tumbler' : 'gunshot_rifle'));
    return {
      tick: Math.max(0, Math.floor(Number(c.tick) || 0)),
      seq: idx != null ? idx : Math.max(0, Math.floor(Number(c.seq) || 0)),
      cmdId: String(c.cmdId || ('cmd_' + (c.tick || 0) + '_' + (idx || 0))),
      type: String(c.type || (stage === 'heist-breach' ? 'heist.command' : 'combat.command')),
      actor: String(c.actor || 'operative'),
      action: action,
      stage: stage,
      cue: cue,
      labelEn: String(c.labelEn || action.replace(/_/g, ' ').toUpperCase()),
      labelAr: String(c.labelAr || c.labelEn || action),
      payload: Object.assign({}, c.payload || {})
    };
  }

  /**
   * Executes a full deterministic simulation from tick 0..totalTicks using
   * fixed 100ms logical step semantics and isolated PRNG streams.
   */
  function runDeterministicSimulation(spec) {
    var raw = spec || {};
    var seed = (Number(raw.seed) >>> 0) || 0x159C8B22;
    var screen = raw.screen === 'crimes' ? 'crimes' : 'attack';
    var district = String(raw.district || 'pier_4');
    var rawCmds = Array.isArray(raw.commands) ? raw.commands : [];
    var commands = rawCmds.map(function (c, i) {
      return normalizeCommand(c, i, screen);
    }).sort(function (a, b) {
      return (a.tick - b.tick) || (a.seq - b.seq);
    });

    var maxCmdTick = 0;
    for (var cIdx = 0; cIdx < commands.length; cIdx++) {
      if (commands[cIdx].tick > maxCmdTick) maxCmdTick = commands[cIdx].tick;
    }
    var totalTicks = Math.max(maxCmdTick + 2, Math.min(120, Math.max(8, Number(raw.totalTicks) || 24)));

    var rng = createIsolatedRngRegistry(seed);
    var state = {
      tick: 0,
      screen: screen,
      district: district,
      playerHp: 500,
      rivalHp: 240,
      vaultIntegrity: 100,
      noiseLevel: screen === 'crimes' ? (10 + rng.stealth.nextInt(0, 6)) : 18,
      comboChain: 0,
      guardPhasePermille: rng.stealth.nextInt(120, 260),
      threatTier: 'CLEAR',
      activeStance: 'ballistic_guard',
      lootScore: 0,
      lastAction: 'EPISODE_START',
      lastStage: screen === 'crimes' ? 'heist-breach' : 'combat-arena',
      lastCue: 'ui_nav',
      lastLabelEn: 'Seed Initialized',
      lastLabelAr: 'تم تهيئة البذرة الحتمية',
      commandsAtTick: [],
      rngSnapshot: rng.snapshot()
    };

    var snapshots = [];
    var stateHashes = [];
    var stances = ['ballistic_guard', 'berserk_rush', 'flank_ambush', 'stim_inject'];

    for (var t = 0; t <= totalTicks; t++) {
      state.tick = t;
      state.commandsAtTick = [];

      if (t > 0) {
        // Fixed 100ms logical tick passive progression
        state.guardPhasePermille = (state.guardPhasePermille + 18) % 1000;
        if (t % 5 === 0 && state.noiseLevel > 8) {
          state.noiseLevel = Math.max(8, state.noiseLevel - 1);
        }
      }

      for (var k = 0; k < commands.length; k++) {
        var cmd = commands[k];
        if (cmd.tick !== t) continue;

        state.commandsAtTick.push(cmd);
        state.lastAction = cmd.action;
        state.lastStage = cmd.stage;
        state.lastCue = cmd.cue;
        state.lastLabelEn = cmd.labelEn;
        state.lastLabelAr = cmd.labelAr;

        if (cmd.stage === 'combat-arena') {
          var dmgRoll = rng.combat.nextInt(28, 56);
          var critBonus = rng.combat.nextInt(8, 22);
          if (cmd.actor === 'nemesis' || cmd.action === 'nemesis_shift') {
            var incoming = rng.combat.nextInt(12, 26);
            state.playerHp = Math.max(25, state.playerHp - incoming);
            state.activeStance = String(cmd.payload.stance || stances[rng.combat.nextInt(0, stances.length - 1)]);
          } else {
            state.comboChain += 1;
            var totalDmg = dmgRoll + (state.comboChain * 6) + (cmd.action === 'suppress_fire' ? critBonus : 0);
            state.rivalHp = Math.max(0, state.rivalHp - totalDmg);
            state.lootScore += rng.loot.nextInt(350, 950) * state.comboChain;
            if (state.rivalHp === 0) {
              state.activeStance = 'NEUTRALIZED';
            } else {
              state.activeStance = stances[(t + rng.combat.nextInt(0, 3)) % stances.length];
            }
          }
        } else {
          // heist-breach deterministic step
          var stealthDelta = rng.stealth.nextInt(18, 30);
          var noiseShift = cmd.payload && cmd.payload.approach === 'loud'
            ? rng.stealth.nextInt(14, 24)
            : rng.stealth.nextInt(2, 7);
          if (cmd.action === 'guard_cone_alert' || cmd.cue === 'stealth_alert') {
            state.noiseLevel = Math.min(100, state.noiseLevel + noiseShift + 14);
          } else {
            state.vaultIntegrity = Math.max(0, state.vaultIntegrity - stealthDelta);
            state.noiseLevel = Math.min(100, state.noiseLevel + noiseShift);
            state.comboChain += 1;
            state.lootScore += rng.loot.nextInt(1800, 5200);
          }
        }

        state.threatTier = state.noiseLevel >= 70 ? 'HUNTED' : (state.noiseLevel >= 35 ? 'SUSPICIOUS' : 'CLEAR');
      }

      state.rngSnapshot = rng.snapshot();
      var tickHash = computeCanonicalStateHash(state);
      stateHashes.push(tickHash);
      snapshots.push({
        tick: state.tick,
        screen: state.screen,
        district: state.district,
        playerHp: state.playerHp,
        rivalHp: state.rivalHp,
        vaultIntegrity: state.vaultIntegrity,
        noiseLevel: state.noiseLevel,
        comboChain: state.comboChain,
        guardPhasePermille: state.guardPhasePermille,
        threatTier: state.threatTier,
        activeStance: state.activeStance,
        lootScore: state.lootScore,
        lastAction: state.lastAction,
        lastStage: state.lastStage,
        lastCue: state.lastCue,
        lastLabelEn: state.lastLabelEn,
        lastLabelAr: state.lastLabelAr,
        commandsAtTick: state.commandsAtTick.slice(),
        rngSnapshot: Object.assign({}, state.rngSnapshot),
        stateHash: tickHash
      });
    }

    return Object.freeze({
      episodeId: String(raw.episodeId || ('ep_' + formatHex32(seed, '').toLowerCase())),
      titleEn: String(raw.titleEn || 'Tactical Combat & Heist Replay'),
      titleAr: String(raw.titleAr || 'إعادة عرض تكتيكية موثقة'),
      seed: seed,
      seedHex: formatHex32(seed, '#'),
      screen: screen,
      district: district,
      tickRateMs: LOGICAL_TICK_MS,
      totalTicks: totalTicks,
      commands: Object.freeze(commands),
      snapshots: Object.freeze(snapshots),
      stateHashes: Object.freeze(stateHashes),
      finalHash: stateHashes[stateHashes.length - 1],
      curated: Boolean(raw.curated),
      createdAt: Number(raw.createdAt || 1763740800000)
    });
  }

  /**
   * Binary-search divergence localisation (05-divergence-protocol).
   * Finds the exact first differing tick T₀ in O(log N) comparisons.
   */
  function detectDivergence(hashesA, hashesB) {
    var a = Array.isArray(hashesA) ? hashesA : [];
    var b = Array.isArray(hashesB) ? hashesB : [];
    var minLen = Math.min(a.length, b.length);

    if (a.length === b.length && minLen > 0 && a[minLen - 1] === b[minLen - 1]) {
      // Check all ticks quickly; if any middle tick diverged, binary search it
      var allMatch = true;
      for (var i = 0; i < minLen; i++) {
        if (a[i] !== b[i]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        return { diverged: false, firstDivergentTick: -1, expectedHash: a[minLen - 1], observedHash: b[minLen - 1] };
      }
    }

    // Binary search for first differing tick where a[t] !== b[t]
    var lo = 0;
    var hi = minLen - 1;
    var firstDiff = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >>> 1;
      var prefixMatches = true;
      for (var j = 0; j <= mid; j++) {
        if (a[j] !== b[j]) {
          prefixMatches = false;
          break;
        }
      }
      if (!prefixMatches) {
        firstDiff = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    if (firstDiff === -1 && a.length !== b.length) {
      firstDiff = minLen;
    }

    return {
      diverged: firstDiff !== -1,
      firstDivergentTick: firstDiff,
      expectedHash: firstDiff >= 0 ? (a[firstDiff] || null) : null,
      observedHash: firstDiff >= 0 ? (b[firstDiff] || null) : null
    };
  }

  function verifyEpisodeDeterminism(episode) {
    if (!episode) return { verified: false, firstDivergentTick: 0 };
    var rerun = runDeterministicSimulation({
      episodeId: episode.episodeId,
      titleEn: episode.titleEn,
      titleAr: episode.titleAr,
      seed: episode.seed,
      screen: episode.screen,
      district: episode.district,
      totalTicks: episode.totalTicks,
      commands: episode.commands
    });
    var diff = detectDivergence(episode.stateHashes, rerun.stateHashes);
    return {
      verified: !diff.diverged && episode.finalHash === rerun.finalHash,
      seedHex: episode.seedHex,
      expectedFinalHash: episode.finalHash,
      observedFinalHash: rerun.finalHash,
      totalTicks: episode.totalTicks,
      firstDivergentTick: diff.firstDivergentTick,
      rerunEpisode: rerun
    };
  }

  /* ------------------------------------------------------------------------
   * 3. THREE CURATED SAMPLE EPISODES READY IMMEDIATELY ON FIRST VISIT
   * ------------------------------------------------------------------------ */
  var CURATED_SPECS = [
    {
      episodeId: 'ep_razor_vance_duel',
      titleEn: 'Malik "Razor" Vance — Perfect Counter Chain',
      titleAr: 'مبارزة مالك «الموس» فانس — سلسلة الرد التكتيكي',
      seed: 0x159C8B22,
      screen: 'attack',
      district: 'pier_4',
      totalTicks: 24,
      curated: true,
      commands: [
        { tick: 2, type: 'combat.maneuver', actor: 'operative', action: 'armor_pierce', stage: 'combat-arena', cue: 'gunshot_rifle', labelEn: 'Armor Pierce vs Ballistic Guard', labelAr: 'اختراق الدرع ضد التحصّن الباليستي', payload: { maneuver: 'armor_pierce', vs: 'ballistic_guard' } },
        { tick: 6, type: 'combat.stance', actor: 'nemesis', action: 'nemesis_shift', stage: 'combat-arena', cue: 'gunshot_pistol', labelEn: 'Razor Shifts -> Berserk Rush', labelAr: 'اندفاع دموي شرس من الخصم', payload: { stance: 'berserk_rush' } },
        { tick: 10, type: 'combat.maneuver', actor: 'operative', action: 'counter_parry', stage: 'combat-arena', cue: 'blade_slash', labelEn: 'Counter Parry x2 Combo', labelAr: 'صدّ مرتد متسلسل x2', payload: { maneuver: 'counter_parry', vs: 'berserk_rush' } },
        { tick: 14, type: 'combat.stance', actor: 'nemesis', action: 'nemesis_shift', stage: 'combat-arena', cue: 'stealth_alert', labelEn: 'Critical HP! Rival Uncaps Stim', labelAr: 'الخصم يجهز حاقن إسعاف قتالي', payload: { stance: 'stim_inject' } },
        { tick: 18, type: 'combat.maneuver', actor: 'operative', action: 'rush_interrupt', stage: 'combat-arena', cue: 'heavy_bag_impact', labelEn: 'Rush Interrupt Shatters Stim', labelAr: 'كسر الإسعاف القتالي x3', payload: { maneuver: 'rush_interrupt', vs: 'stim_inject' } },
        { tick: 22, type: 'combat.finisher', actor: 'operative', action: 'suppress_fire', stage: 'combat-arena', cue: 'jackpot_fanfare', labelEn: 'Arena Knockout Finisher', labelAr: 'ضربة الحسم النهائية في الساحة', payload: { maneuver: 'suppress_fire', finisher: true } }
      ]
    },
    {
      episodeId: 'ep_pier4_ghost_vault',
      titleEn: 'Pier 4 Docks — Ghost Blind-Spot Vault Breach',
      titleAr: 'أرصفة الميناء ٤ — اختراق الخزنة الصامت في النقطة العمياء',
      seed: 0x159A4F10,
      screen: 'crimes',
      district: 'pier_4',
      totalTicks: 20,
      curated: true,
      commands: [
        { tick: 2, type: 'heist.scan', actor: 'operative', action: 'pulse', stage: 'heist-breach', cue: 'ui_nav', labelEn: 'Acoustic Cone Sweep Sync (58°)', labelAr: 'مزامنة مخروط الرؤية والضوضاء (58°)', payload: { approach: 'stealth', district: 'pier_4' } },
        { tick: 6, type: 'heist.breach', actor: 'operative', action: 'crack', stage: 'heist-breach', cue: 'vault_tumbler', labelEn: 'Blind-Spot Window Entry (+24%)', labelAr: 'دخول النقطة العمياء الخضراء (+24%)', payload: { approach: 'stealth', inBlindSpot: true } },
        { tick: 11, type: 'heist.lock', actor: 'operative', action: 'crack', stage: 'heist-breach', cue: 'vault_tumbler', labelEn: 'Tumbler Pin #3 Disengaged', labelAr: 'فكّ القفل التكتيكي الثالث بنجاح', payload: { approach: 'stealth', pin: 3 } },
        { tick: 15, type: 'heist.breach', actor: 'operative', action: 'stealth_breach', stage: 'heist-breach', cue: 'cash_payout', labelEn: 'Silent Vault Core Cracked', labelAr: 'فتح قلب الخزنة بصمت تام', payload: { approach: 'stealth', cleanBreach: true } },
        { tick: 19, type: 'heist.extract', actor: 'operative', action: 'win', stage: 'heist-breach', cue: 'cash_payout', labelEn: 'Ghost Contraband Extraction', labelAr: 'انسحاب الشبح مع الغنائم المهربة', payload: { approach: 'stealth', bonusPct: 32 } }
      ]
    },
    {
      episodeId: 'ep_downtown_syndicate_heist',
      titleEn: 'Downtown Vaults — Dual-Charge Syndicate Heist',
      titleAr: 'خزائن وسط المدينة — اقتحام النقابة المزدوج',
      seed: 0x159F3D99,
      screen: 'crimes',
      district: 'downtown',
      totalTicks: 22,
      curated: true,
      commands: [
        { tick: 3, type: 'heist.breach', actor: 'operative', action: 'crack', stage: 'heist-breach', cue: 'vault_tumbler', labelEn: 'Thermal Lance Vault Rigged', labelAr: 'تثبيت الحارق الحراري على الخزنة', payload: { approach: 'loud', district: 'downtown' } },
        { tick: 8, type: 'heist.alert', actor: 'guard_cone', action: 'guard_cone_alert', stage: 'heist-breach', cue: 'stealth_alert', labelEn: 'Acoustic Spike (42 dB · Suspicious)', labelAr: 'ارتفاع الضوضاء الصوتية (42 dB · اشتباه)', payload: { approach: 'loud', threatTier: 'SUSPICIOUS' } },
        { tick: 13, type: 'combat.maneuver', actor: 'operative', action: 'suppress_fire', stage: 'combat-arena', cue: 'gunshot_rifle', labelEn: 'Suppressive Cover Fire at Corridor', labelAr: 'نيران تغطية قمعية في الممر', payload: { maneuver: 'suppress_fire', cover: true } },
        { tick: 17, type: 'heist.breach', actor: 'operative', action: 'loud_breach', stage: 'heist-breach', cue: 'heavy_bag_impact', labelEn: 'Heavy Vault Door Blown Open', labelAr: 'نسف البوابة المصفحة للخزنة', payload: { approach: 'loud', cleanBreach: false } },
        { tick: 21, type: 'heist.extract', actor: 'operative', action: 'win', stage: 'heist-breach', cue: 'cash_payout', labelEn: 'Armored Van Syndicate Escape', labelAr: 'إخلاء النقابة بالمركبة المصفحة', payload: { approach: 'loud', payout: 48500 } }
      ]
    }
  ];

  var initialEpisodes = CURATED_SPECS.map(runDeterministicSimulation);

  /* ------------------------------------------------------------------------
   * 4. VIEWER & RECORDER STORE
   * ------------------------------------------------------------------------ */
  var store = {
    episodes: initialEpisodes.slice(),
    activeEpisodeId: initialEpisodes[0].episodeId,
    currentTick: 0,
    playing: false,
    speed: 1,
    timerId: 0,
    drawerOpen: true,
    autoReplay: true,
    muted: false,
    lastVerification: verifyEpisodeDeterminism(initialEpisodes[0]),
    shareToken: '',
    shareVisible: false,
    isReplayingDispatch: false,
    lastScreen: '',
    recording: {
      active: false,
      episodeId: '',
      seed: 0x159B7701,
      screen: 'attack',
      district: 'pier_4',
      startedAtMs: 0,
      lastEventTs: 0,
      commands: []
    },
    telemetry: {
      ticksPlayed: 0,
      stageTriggers: 0,
      audioTriggers: 0,
      liveCommandsRecorded: 0,
      verificationsRun: 1,
      exportsCreated: 0,
      importsLoaded: 0
    }
  };

  function isAr() {
    var html = document.documentElement;
    if (!html) return false;
    return html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function isMasterMuted() {
    if (window.__zoneMuted === true || store.muted === true) return true;
    try {
      if (window.localStorage && window.localStorage.getItem('zone_master_muted') === '1') return true;
    } catch (_) {}
    return false;
  }

  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    return main ? String(main.getAttribute('data-zone-screen') || 'home').toLowerCase() : '';
  }

  function getActiveEpisode() {
    for (var i = 0; i < store.episodes.length; i++) {
      if (store.episodes[i].episodeId === store.activeEpisodeId) return store.episodes[i];
    }
    return store.episodes[0];
  }

  /* ------------------------------------------------------------------------
   * 5. LIVE 3D STAGE & AUDIO DISPATCH DURING PLAYBACK
   * ------------------------------------------------------------------------ */
  function dispatchReplayTickEffects(ep, tickIndex) {
    if (!ep || !ep.snapshots || !ep.snapshots[tickIndex]) return;
    var snap = ep.snapshots[tickIndex];
    var cmds = snap.commandsAtTick || [];
    if (cmds.length === 0) return;

    store.isReplayingDispatch = true;
    try {
      for (var i = 0; i < cmds.length; i++) {
        var cmd = cmds[i];
        var stageKind = cmd.stage === 'heist-breach' ? 'heist-breach' : 'combat-arena';
        var stageAct = cmd.action || (stageKind === 'heist-breach' ? 'crack' : 'attack');
        var payload = Object.assign({}, cmd.payload, {
          replay: true,
          episodeId: ep.episodeId,
          seed: ep.seed,
          tick: tickIndex,
          stateHash: snap.stateHash
        });

        if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
          try {
            window.ZoneEcs3D.triggerStageAction(stageKind, stageAct, payload);
            store.telemetry.stageTriggers += 1;
          } catch (_) {}
        }

        if (!isMasterMuted() && window.ZoneAudioHaptics && typeof window.ZoneAudioHaptics.play === 'function') {
          try {
            window.ZoneAudioHaptics.play(cmd.cue || 'ui_nav', payload);
            store.telemetry.audioTriggers += 1;
          } catch (_) {}
        }
      }
    } finally {
      store.isReplayingDispatch = false;
    }
  }

  /* ------------------------------------------------------------------------
   * 6. PLAYBACK TRANSPORT ENGINE (100ms LOGICAL TICK * 0.5x / 1x / 2x)
   * ------------------------------------------------------------------------ */
  function stopPlaybackTimer() {
    if (store.timerId) {
      clearInterval(store.timerId);
      store.timerId = 0;
    }
    store.playing = false;
  }

  function getStepIntervalMs() {
    var spd = Number(store.speed) || 1;
    return Math.max(25, Math.round(LOGICAL_TICK_MS / spd));
  }

  function seekToTick(targetTick, emitEffects) {
    var ep = getActiveEpisode();
    if (!ep) return 0;
    var clamped = Math.max(0, Math.min(ep.totalTicks, Math.floor(Number(targetTick) || 0)));
    store.currentTick = clamped;
    if (emitEffects !== false) {
      dispatchReplayTickEffects(ep, clamped);
    }
    renderActiveScreenMount();
    return clamped;
  }

  function stepForward() {
    var ep = getActiveEpisode();
    if (!ep) return 0;
    var next = Math.min(ep.totalTicks, store.currentTick + 1);
    store.telemetry.ticksPlayed += 1;
    return seekToTick(next, true);
  }

  function stepBackward() {
    var ep = getActiveEpisode();
    if (!ep) return 0;
    var prev = Math.max(0, store.currentTick - 1);
    return seekToTick(prev, true);
  }

  function startPlayback() {
    stopPlaybackTimer();
    var ep = getActiveEpisode();
    if (!ep) return false;
    if (store.currentTick >= ep.totalTicks) {
      store.currentTick = 0;
    }
    store.playing = true;
    dispatchReplayTickEffects(ep, store.currentTick);
    store.timerId = setInterval(function () {
      var activeEp = getActiveEpisode();
      if (!activeEp || !store.playing) {
        stopPlaybackTimer();
        renderActiveScreenMount();
        return;
      }
      if (store.currentTick >= activeEp.totalTicks) {
        stopPlaybackTimer();
        renderActiveScreenMount();
        return;
      }
      stepForward();
      if (store.currentTick >= activeEp.totalTicks) {
        stopPlaybackTimer();
        renderActiveScreenMount();
      }
    }, getStepIntervalMs());
    renderActiveScreenMount();
    return true;
  }

  function pausePlayback() {
    stopPlaybackTimer();
    renderActiveScreenMount();
    return false;
  }

  function togglePlay() {
    if (store.playing) return pausePlayback();
    return startPlayback();
  }

  function setSpeed(nextSpeed) {
    var num = Number(nextSpeed);
    if (ALLOWED_SPEEDS.indexOf(num) === -1) num = 1;
    store.speed = num;
    if (store.playing) {
      startPlayback();
    } else {
      renderActiveScreenMount();
    }
    return store.speed;
  }

  function selectEpisode(episodeId) {
    for (var i = 0; i < store.episodes.length; i++) {
      if (store.episodes[i].episodeId === episodeId) {
        stopPlaybackTimer();
        store.activeEpisodeId = episodeId;
        store.currentTick = 0;
        store.lastVerification = verifyEpisodeDeterminism(store.episodes[i]);
        store.telemetry.verificationsRun += 1;
        store.shareVisible = false;
        renderActiveScreenMount();
        return store.episodes[i];
      }
    }
    return getActiveEpisode();
  }

  /* ------------------------------------------------------------------------
   * 7. LIVE COMMAND-FLOW RECORDER (zone:tactical-event & zone:3d-action)
   * ------------------------------------------------------------------------ */
  function startRecording(opts) {
    var o = opts || {};
    var scr = o.screen || getActiveScreen() || 'attack';
    if (!ALLOWED_SCREENS[scr]) scr = 'attack';
    var seed = (Number(o.seed) >>> 0) || splitMix32((store.episodes.length + 1) * 0x159001 + store.telemetry.liveCommandsRecorded);
    store.recording = {
      active: true,
      episodeId: String(o.episodeId || ('ep_live_' + formatHex32(seed, '').toLowerCase())),
      seed: seed,
      screen: scr,
      district: String(o.district || 'pier_4'),
      startedAtMs: Number(o.nowMs != null ? o.nowMs : Date.now()),
      lastEventTs: 0,
      commands: []
    };
    renderActiveScreenMount();
    return store.recording;
  }

  function recordCommand(rawCmd) {
    if (store.isReplayingDispatch) return null;
    if (!store.recording.active) {
      startRecording({ screen: (rawCmd && rawCmd.screen) || getActiveScreen() || 'attack' });
    }
    var rec = store.recording;
    var c = rawCmd || {};
    var explicitTick = c.tick != null
      ? Math.max(0, Math.floor(Number(c.tick) || 0))
      : Math.min(60, Math.max(1, rec.commands.length * 3 + 2));

    var cmd = normalizeCommand({
      tick: explicitTick,
      seq: rec.commands.length,
      type: c.type || (c.stage === 'heist-breach' ? 'heist.live' : 'combat.live'),
      actor: c.actor || 'operative',
      action: c.action || 'attack',
      stage: c.stage || (rec.screen === 'crimes' ? 'heist-breach' : 'combat-arena'),
      cue: c.cue || (rec.screen === 'crimes' ? 'vault_tumbler' : 'gunshot_rifle'),
      labelEn: c.labelEn || ('Live ' + String(c.action || 'Action').replace(/_/g, ' ')),
      labelAr: c.labelAr || ('حركة حية: ' + String(c.action || 'تكتيك')),
      payload: c.payload || {}
    }, rec.commands.length, rec.screen);

    rec.commands.push(cmd);
    store.telemetry.liveCommandsRecorded += 1;
    renderActiveScreenMount();
    return cmd;
  }

  function finalizeRecording(opts) {
    var o = opts || {};
    var rec = store.recording;
    if (!rec.active && rec.commands.length === 0) {
      startRecording(o);
      rec = store.recording;
    }
    if (rec.commands.length === 0) {
      recordCommand({
        tick: 2,
        stage: rec.screen === 'crimes' ? 'heist-breach' : 'combat-arena',
        action: rec.screen === 'crimes' ? 'stealth_breach' : 'armor_pierce',
        cue: rec.screen === 'crimes' ? 'vault_tumbler' : 'gunshot_rifle'
      });
    }

    var maxTick = 0;
    for (var i = 0; i < rec.commands.length; i++) {
      if (rec.commands[i].tick > maxTick) maxTick = rec.commands[i].tick;
    }

    var built = runDeterministicSimulation({
      episodeId: rec.episodeId,
      titleEn: o.titleEn || ('Recorded ' + (rec.screen === 'crimes' ? 'Heist Breach' : 'Combat Bout') + ' ' + formatHex32(rec.seed, '#')),
      titleAr: o.titleAr || ('تسجيل حتمي ' + (rec.screen === 'crimes' ? 'لاختراق الخزنة' : 'للاشتباك القتالي') + ' ' + formatHex32(rec.seed, '#')),
      seed: rec.seed,
      screen: rec.screen,
      district: rec.district,
      totalTicks: Math.max(12, maxTick + 2),
      commands: rec.commands,
      curated: false
    });

    store.recording.active = false;
    store.episodes.unshift(built);
    store.activeEpisodeId = built.episodeId;
    store.currentTick = 0;
    store.lastVerification = verifyEpisodeDeterminism(built);
    store.telemetry.verificationsRun += 1;
    renderActiveScreenMount();
    return built;
  }

  /* ------------------------------------------------------------------------
   * 8. EXPORT / IMPORT SEED SHARE PAYLOAD
   * ------------------------------------------------------------------------ */
  function exportReplayPayload(episodeId) {
    var ep = episodeId ? selectEpisode(episodeId) : getActiveEpisode();
    if (!ep) return '';
    var compact = {
      v: 159,
      id: ep.episodeId,
      titleEn: ep.titleEn,
      titleAr: ep.titleAr,
      seed: ep.seed,
      screen: ep.screen,
      district: ep.district,
      totalTicks: ep.totalTicks,
      finalHash: ep.finalHash,
      commands: ep.commands.map(function (c) {
        return {
          tick: c.tick,
          action: c.action,
          stage: c.stage,
          cue: c.cue,
          actor: c.actor,
          labelEn: c.labelEn,
          labelAr: c.labelAr,
          payload: c.payload
        };
      })
    };
    var jsonStr = JSON.stringify(compact);
    var token = 'ZRV1:' + jsonStr;
    store.shareToken = token;
    store.shareVisible = true;
    store.telemetry.exportsCreated += 1;
    renderActiveScreenMount();
    return token;
  }

  function importReplayPayload(tokenOrObject) {
    var parsed = null;
    if (typeof tokenOrObject === 'string') {
      var clean = tokenOrObject.trim();
      if (clean.indexOf('ZRV1:') === 0) clean = clean.slice(5);
      parsed = JSON.parse(clean);
    } else if (tokenOrObject && typeof tokenOrObject === 'object') {
      parsed = tokenOrObject;
    }
    if (!parsed || !parsed.seed) return null;

    var ep = runDeterministicSimulation({
      episodeId: parsed.id || parsed.episodeId || ('ep_import_' + formatHex32(parsed.seed, '').toLowerCase()),
      titleEn: parsed.titleEn || 'Imported Tactical Seed Replay',
      titleAr: parsed.titleAr || 'إعادة عرض مستوردة بالبذرة الحتمية',
      seed: parsed.seed,
      screen: parsed.screen || 'attack',
      district: parsed.district || 'pier_4',
      totalTicks: parsed.totalTicks || 24,
      commands: parsed.commands || []
    });

    var existingIdx = -1;
    for (var i = 0; i < store.episodes.length; i++) {
      if (store.episodes[i].episodeId === ep.episodeId) {
        existingIdx = i;
        break;
      }
    }
    if (existingIdx >= 0) store.episodes[existingIdx] = ep;
    else store.episodes.unshift(ep);

    store.activeEpisodeId = ep.episodeId;
    store.currentTick = 0;
    store.lastVerification = verifyEpisodeDeterminism(ep);
    if (parsed.finalHash && parsed.finalHash !== ep.finalHash) {
      store.lastVerification.verified = false;
    }
    store.telemetry.importsLoaded += 1;
    store.telemetry.verificationsRun += 1;
    renderActiveScreenMount();
    return ep;
  }

  /* ------------------------------------------------------------------------
   * 9. WATERCOLOR-SKETCHBOOK BILINGUAL HTML RENDERER
   * ------------------------------------------------------------------------ */
  function renderViewerHtml() {
    var ar = isAr();
    var ep = getActiveEpisode();
    var snap = (ep.snapshots && ep.snapshots[store.currentTick]) || ep.snapshots[0];
    var ver = store.lastVerification || verifyEpisodeDeterminism(ep);
    var pct = ep.totalTicks > 0 ? Math.round((store.currentTick / ep.totalTicks) * 1000) / 10 : 0;

    var verifyTone = ver.verified ? 'sage' : 'crimson';
    var verifyText = ver.verified
      ? (ar ? ('بذرة حتمية موثقة ' + ep.seedHex) : ('VERIFIED SEED ' + ep.seedHex))
      : (ar ? ('تباين عند النبضة ' + ver.firstDivergentTick) : ('DIVERGENCE @ T' + ver.firstDivergentTick));

    var recTone = store.recording.active ? 'crimson' : 'blue';
    var recBadge = store.recording.active
      ? (ar ? ('تسجيل حي ● (' + store.recording.commands.length + ')') : ('REC ● (' + store.recording.commands.length + ')'))
      : (ar ? 'مسجل الأوامر جاهز' : 'CMD LOG READY');

    var epButtonsHtml = '';
    for (var i = 0; i < store.episodes.length; i++) {
      var item = store.episodes[i];
      var isSelected = item.episodeId === ep.episodeId;
      var epTitle = ar ? item.titleAr : item.titleEn;
      epButtonsHtml +=
        '<button type="button" class="zrv-ep-btn" data-zrv-act="select-episode" data-episode-id="' + esc(item.episodeId) + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' +
          '<span class="zrv-ep-name">' + esc(epTitle) + '</span>' +
          '<span class="zrv-ep-meta"><bdi>' + esc(item.seedHex) + '</bdi> · <bdi>' + item.totalTicks + 't</bdi></span>' +
        '</button>';
    }

    var speedBtnsHtml = '';
    for (var s = 0; s < ALLOWED_SPEEDS.length; s++) {
      var spd = ALLOWED_SPEEDS[s];
      speedBtnsHtml +=
        '<button type="button" class="zrv-speed-btn" data-zrv-act="set-speed" data-speed="' + spd + '" aria-pressed="' + (store.speed === spd ? 'true' : 'false') + '">' +
          '<bdi>' + spd + 'x</bdi>' +
        '</button>';
    }

    var pipsHtml = '';
    for (var c = 0; c < ep.commands.length; c++) {
      var cmd = ep.commands[c];
      var leftPct = ep.totalTicks > 0 ? Math.round((cmd.tick / ep.totalTicks) * 1000) / 10 : 0;
      var activePip = cmd.tick === store.currentTick ? ' is-active' : '';
      pipsHtml +=
        '<button type="button" class="zrv-cmd-pip' + activePip + '" data-zrv-act="seek-tick" data-tick="' + cmd.tick + '" style="left:' + leftPct + '%" title="T' + cmd.tick + ': ' + esc(ar ? cmd.labelAr : cmd.labelEn) + '" aria-label="Tick ' + cmd.tick + '"></button>';
    }

    var cmdChipsHtml = '';
    for (var j = 0; j < ep.commands.length; j++) {
      var cm = ep.commands[j];
      var isCur = cm.tick === store.currentTick;
      cmdChipsHtml +=
        '<button type="button" class="zrv-cmd-chip' + (isCur ? ' is-current' : '') + '" data-zrv-act="seek-tick" data-tick="' + cm.tick + '">' +
          '<bdi>T' + cm.tick + '</bdi> · ' + esc(ar ? cm.labelAr : cm.labelEn) +
        '</button>';
    }

    var metric2Label = ep.screen === 'crimes'
      ? (ar ? 'سلامة الخزنة' : 'Vault Lock')
      : (ar ? 'صحة الخصم' : 'Rival HP');
    var metric2Val = ep.screen === 'crimes'
      ? (snap.vaultIntegrity + '%')
      : (snap.rivalHp + ' HP');

    var metric3Label = ep.screen === 'crimes'
      ? (ar ? 'الضوضاء الصوتية' : 'Acoustic dB')
      : (ar ? 'سلسلة الرد' : 'Combo Chain');
    var metric3Val = ep.screen === 'crimes'
      ? (snap.noiseLevel + ' dB · ' + snap.threatTier)
      : ('x' + snap.comboChain + ' · ' + snap.activeStance);

    var shareHtml = '';
    if (store.shareVisible && store.shareToken) {
      shareHtml =
        '<div class="zrv-share-box" data-zrv-share-output="1">' +
          '<strong>' + esc(ar ? 'رمز مشاركة البذرة الحتمية:' : 'Deterministic Replay Seed Share:') + '</strong> ' +
          '<bdi>' + esc(store.shareToken) + '</bdi>' +
        '</div>';
    }

    return (
      '<div class="zrv-header">' +
        '<div class="zrv-brand">' +
          '<span class="zrv-icon-badge" aria-hidden="true">🎬</span>' +
          '<div class="zrv-title-col">' +
            '<h3 class="zrv-title">' + esc(ar ? '🎬 إعادة العرض التكتيكي ٣D ومسجل الأوامر الحتمي' : '🎬 Tactical 3D Replay & Deterministic Command Recorder') + '</h3>' +
            '<p class="zrv-subtitle">' +
              esc(ar ? 'خطوة منطقية ثابتة ' : 'Fixed Logical Step ') +
              '<bdi>100ms</bdi> · ' +
              esc(ar ? 'تجزئة الحالة ' : 'State Hash ') +
              '<bdi data-zrv-current-hash="1">' + esc(snap.stateHash) + '</bdi>' +
            '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zrv-badges">' +
          '<span class="zrv-pill" data-zrv-verified-badge="1" data-tone="' + verifyTone + '"><span class="zrv-dot"></span><bdi>' + esc(verifyText) + '</bdi></span>' +
          '<span class="zrv-pill" data-tone="' + recTone + '"><bdi>' + esc(recBadge) + '</bdi></span>' +
          '<button type="button" class="zrv-drawer-btn" data-zrv-act="toggle-drawer" aria-expanded="' + (store.drawerOpen ? 'true' : 'false') + '">' +
            esc(store.drawerOpen ? (ar ? 'طيّ ▲' : 'Hide ▲') : (ar ? 'عرض ▼' : 'Expand ▼')) +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zrv-drawer"' + (store.drawerOpen ? '' : ' hidden') + '>' +
        '<div class="zrv-episodes-row" role="group" aria-label="' + esc(ar ? 'حلقات الإعادة' : 'Replay Episodes') + '">' +
          epButtonsHtml +
        '</div>' +
        '<div class="zrv-transport-bar">' +
          '<div class="zrv-transport-btns">' +
            '<button type="button" class="zrv-ctrl-btn ' + (store.playing ? 'is-playing' : 'is-primary') + '" data-zrv-act="toggle-play" aria-pressed="' + (store.playing ? 'true' : 'false') + '">' +
              esc(store.playing ? (ar ? '⏸ إيقاف مؤقت' : '⏸ Pause') : (ar ? '▶ تشغيل الإعادة' : '▶ Play Replay')) +
            '</button>' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="step-back"' + (store.currentTick <= 0 ? ' disabled' : '') + '>' +
              esc(ar ? '⏮ -1 نبضة' : '⏮ -1 Tick') +
            '</button>' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="step-forward"' + (store.currentTick >= ep.totalTicks ? ' disabled' : '') + '>' +
              esc(ar ? '⏭ +1 نبضة' : '⏭ +1 Tick') +
            '</button>' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="restart">' +
              esc(ar ? '↺ البداية' : '↺ T0') +
            '</button>' +
          '</div>' +
          '<div class="zrv-speed-group" role="group" aria-label="' + esc(ar ? 'سرعة التشغيل' : 'Playback Speed') + '">' +
            speedBtnsHtml +
          '</div>' +
        '</div>' +
        '<div class="zrv-scrubber-wrap">' +
          '<div class="zrv-scrubber-top">' +
            '<span>' + esc(ar ? 'النبضة المنطقية' : 'Logical Tick') + ': <bdi data-zrv-tick-readout="1">' + store.currentTick + ' / ' + ep.totalTicks + '</bdi> (<bdi>' + (store.currentTick * LOGICAL_TICK_MS) + 'ms</bdi>)</span>' +
            '<span>' + esc(ar ? 'الحدث الحالي: ' : 'Active Event: ') + '<strong>' + esc(ar ? snap.lastLabelAr : snap.lastLabelEn) + '</strong></span>' +
          '</div>' +
          '<input type="range" class="zrv-scrubber" data-zrv-scrubber="1" min="0" max="' + ep.totalTicks + '" step="1" value="' + store.currentTick + '" aria-label="' + esc(ar ? 'شريط تمرير الإعادة' : 'Replay Timeline Scrubber') + '"/>' +
          '<div class="zrv-pip-track">' +
            '<div class="zrv-pip-progress" style="width:' + pct + '%"></div>' +
            pipsHtml +
          '</div>' +
        '</div>' +
        '<div class="zrv-telemetry-grid">' +
          '<div class="zrv-stat-box">' +
            '<span class="zrv-stat-label">' + esc(ar ? 'صحة العميل' : 'Operative HP') + '</span>' +
            '<span class="zrv-stat-val"><bdi>' + snap.playerHp + ' HP</bdi></span>' +
          '</div>' +
          '<div class="zrv-stat-box">' +
            '<span class="zrv-stat-label">' + esc(metric2Label) + '</span>' +
            '<span class="zrv-stat-val"><bdi>' + esc(metric2Val) + '</bdi></span>' +
          '</div>' +
          '<div class="zrv-stat-box">' +
            '<span class="zrv-stat-label">' + esc(metric3Label) + '</span>' +
            '<span class="zrv-stat-val"><bdi>' + esc(metric3Val) + '</bdi></span>' +
          '</div>' +
          '<div class="zrv-stat-box">' +
            '<span class="zrv-stat-label">' + esc(ar ? 'التجزئة النهائية' : 'Final State Hash') + '</span>' +
            '<span class="zrv-stat-val"><bdi data-zrv-final-hash="1">' + esc(ep.finalHash) + '</bdi></span>' +
          '</div>' +
        '</div>' +
        '<div class="zrv-cmd-strip" data-zrv-cmd-list="1">' +
          cmdChipsHtml +
        '</div>' +
        '<div class="zrv-footer">' +
          '<div class="zrv-footer-btns">' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="toggle-record">' +
              esc(store.recording.active ? (ar ? '⏹ حفظ التسجيل الحتمي' : '⏹ Save Recorded Episode') : (ar ? '⏺ تسجيل جولة جديدة' : '⏺ Record Live Bout')) +
            '</button>' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="verify-seed">' +
              esc(ar ? '✔ فحص التطابق الحتمي' : '✔ Re-Verify Seed Hash') +
            '</button>' +
            '<button type="button" class="zrv-ctrl-btn" data-zrv-act="export-seed">' +
              esc(ar ? '📤 مشاركة / تصدير البذرة' : '📤 Export / Replay Seed Share') +
            '</button>' +
          '</div>' +
          '<span class="zrv-subtitle">' +
            esc(ar ? 'المولد: Mulberry32/SplitMix32 معزول' : 'PRNG: Isolated Mulberry32/SplitMix32') +
          '</span>' +
        '</div>' +
        shareHtml +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------------
   * 10. ROUTE-SCOPED DOM MOUNT (ONLY screen === 'attack' || screen === 'crimes')
   * ------------------------------------------------------------------------ */
  function removeIfPresent(id) {
    var el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  function syncDefaultEpisodeForScreen(screen) {
    if (store.lastScreen === screen) return;
    store.lastScreen = screen;
    var curEp = getActiveEpisode();
    if (curEp && curEp.curated && curEp.screen !== screen) {
      for (var i = 0; i < store.episodes.length; i++) {
        if (store.episodes[i].curated && store.episodes[i].screen === screen) {
          store.activeEpisodeId = store.episodes[i].episodeId;
          store.currentTick = 0;
          store.lastVerification = verifyEpisodeDeterminism(store.episodes[i]);
          break;
        }
      }
    }
  }

  function renderActiveScreenMount() {
    if (document.querySelector && document.querySelector('x-dc')) return false;
    var main = document.getElementById('zone-main');
    if (!main) return false;

    var screen = getActiveScreen();
    if (!ALLOWED_SCREENS[screen]) {
      stopPlaybackTimer();
      removeIfPresent('zrv-replay-viewer');
      return false;
    }

    syncDefaultEpisodeForScreen(screen);

    var viewer = document.getElementById('zrv-replay-viewer');
    if (!viewer) {
      viewer = document.createElement('section');
      viewer.id = 'zrv-replay-viewer';
      viewer.className = 'zrv-scope';
    }
    viewer.setAttribute('data-zrv-screen', screen);

    var anchor = screen === 'crimes'
      ? (document.getElementById('ztd-stealth-bar') || main.querySelector('[data-z3d-stage="heist-breach"]'))
      : (document.getElementById('ztd-combat-deck') || main.querySelector('[data-z3d-stage="combat-arena"]') || document.getElementById('ztl-attack-3d-stage'));

    if (anchor && anchor.parentElement) {
      if (anchor.nextElementSibling !== viewer) {
        anchor.insertAdjacentElement('afterend', viewer);
      }
    } else if (!viewer.parentElement) {
      main.appendChild(viewer);
    }

    var nextHtml = renderViewerHtml();
    if (viewer.__zrvLastHtml !== nextHtml || !viewer.firstElementChild) {
      viewer.__zrvLastHtml = nextHtml;
      viewer.innerHTML = nextHtml;
    }
    return true;
  }

  /* ------------------------------------------------------------------------
   * 11. EVENT LISTENERS (Click, Scrubber Input, Tactical/3D & Settings Signals)
   * ------------------------------------------------------------------------ */
  function bindEvents() {
    document.addEventListener('click', function (ev) {
      var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zrv-act]') : null;
      if (!target || target.disabled) return;

      var act = target.getAttribute('data-zrv-act');
      if (act === 'toggle-play') {
        ev.preventDefault();
        togglePlay();
      } else if (act === 'step-back') {
        ev.preventDefault();
        pausePlayback();
        stepBackward();
      } else if (act === 'step-forward') {
        ev.preventDefault();
        pausePlayback();
        stepForward();
      } else if (act === 'restart') {
        ev.preventDefault();
        pausePlayback();
        seekToTick(0, true);
      } else if (act === 'set-speed') {
        ev.preventDefault();
        setSpeed(target.getAttribute('data-speed'));
      } else if (act === 'select-episode') {
        ev.preventDefault();
        selectEpisode(target.getAttribute('data-episode-id'));
      } else if (act === 'seek-tick') {
        ev.preventDefault();
        pausePlayback();
        seekToTick(Number(target.getAttribute('data-tick') || 0), true);
      } else if (act === 'toggle-drawer') {
        ev.preventDefault();
        store.drawerOpen = !store.drawerOpen;
        renderActiveScreenMount();
      } else if (act === 'toggle-record') {
        ev.preventDefault();
        if (store.recording.active) finalizeRecording();
        else startRecording();
      } else if (act === 'verify-seed') {
        ev.preventDefault();
        store.lastVerification = verifyEpisodeDeterminism(getActiveEpisode());
        store.telemetry.verificationsRun += 1;
        renderActiveScreenMount();
      } else if (act === 'export-seed') {
        ev.preventDefault();
        exportReplayPayload();
      }
    });

    var onScrubberInput = function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute || el.getAttribute('data-zrv-scrubber') !== '1') return;
      pausePlayback();
      seekToTick(Number(el.value || 0), true);
    };
    document.addEventListener('input', onScrubberInput);
    document.addEventListener('change', onScrubberInput);

    // Live capture of zone:tactical-event & zone:3d-action
    window.addEventListener('zone:tactical-event', function (ev) {
      if (store.isReplayingDispatch) return;
      var scr = getActiveScreen();
      if (!ALLOWED_SCREENS[scr] && !store.recording.active) return;
      var d = (ev && ev.detail) || {};
      recordCommand({
        screen: scr || (d.stage === 'heist-breach' ? 'crimes' : 'attack'),
        stage: d.stage || (scr === 'crimes' ? 'heist-breach' : 'combat-arena'),
        action: d.action || (d.payload && d.payload.maneuver) || 'attack',
        cue: d.cue || 'gunshot_rifle',
        payload: d.payload || {}
      });
    });

    window.addEventListener('zone:3d-action', function (ev) {
      if (store.isReplayingDispatch) return;
      var scr = getActiveScreen();
      if (!ALLOWED_SCREENS[scr] && !store.recording.active) return;
      var d = (ev && ev.detail) || {};
      if (d.stage && d.stage !== 'combat-arena' && d.stage !== 'heist-breach') return;
      recordCommand({
        screen: scr || (d.stage === 'heist-breach' ? 'crimes' : 'attack'),
        stage: d.stage || (scr === 'crimes' ? 'heist-breach' : 'combat-arena'),
        action: d.action || 'attack',
        cue: d.cue || (d.stage === 'heist-breach' ? 'vault_tumbler' : 'gunshot_rifle'),
        payload: d.payload || {}
      });
    });

    window.addEventListener('zone:settings-changed', function (ev) {
      var d = (ev && ev.detail) || {};
      if (typeof d.muted === 'boolean') store.muted = d.muted;
      if (typeof d.masterMuted === 'boolean') store.muted = d.masterMuted;
      if (typeof d.autoReplay === 'boolean') store.autoReplay = d.autoReplay;
      if (typeof d.autoRecordReplays === 'boolean') store.autoReplay = d.autoRecordReplays;
      renderActiveScreenMount();
    });

    window.addEventListener('zone:audio-settings', function (ev) {
      var d = (ev && ev.detail) || {};
      if (typeof d.muted === 'boolean') store.muted = d.muted;
    });

    window.addEventListener('zone:render', function () {
      renderActiveScreenMount();
    });

    if (typeof MutationObserver === 'function' && document.documentElement) {
      var rootObs = new MutationObserver(function () {
        renderActiveScreenMount();
      });
      rootObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'dir', 'lang', 'data-zone-reduced-motion', 'data-zone-contrast']
      });

      var mainEl = document.getElementById('zone-main');
      if (mainEl) {
        var mainObs = new MutationObserver(function () {
          renderActiveScreenMount();
        });
        mainObs.observe(mainEl, {
          attributes: true,
          attributeFilter: ['data-zone-screen']
        });
      }
    }
  }

  function boot() {
    bindEvents();
    renderActiveScreenMount();
  }

  window.ZoneReplayViewer = {
    LOGICAL_TICK_MS: LOGICAL_TICK_MS,
    splitMix32: splitMix32,
    createMulberry32: createMulberry32,
    createIsolatedRngRegistry: createIsolatedRngRegistry,
    computeCanonicalStateHash: computeCanonicalStateHash,
    runDeterministicSimulation: runDeterministicSimulation,
    verifyEpisodeDeterminism: verifyEpisodeDeterminism,
    detectDivergence: detectDivergence,
    render: renderActiveScreenMount,
    play: startPlayback,
    pause: pausePlayback,
    togglePlay: togglePlay,
    stepForward: stepForward,
    stepBackward: stepBackward,
    seekToTick: seekToTick,
    setSpeed: setSpeed,
    selectEpisode: selectEpisode,
    startRecording: startRecording,
    recordCommand: recordCommand,
    finalizeRecording: finalizeRecording,
    exportReplayPayload: exportReplayPayload,
    importReplayPayload: importReplayPayload,
    getEpisodes: function () {
      return store.episodes.slice();
    },
    getActiveEpisode: getActiveEpisode,
    getState: function () {
      return {
        activeEpisodeId: store.activeEpisodeId,
        currentTick: store.currentTick,
        playing: store.playing,
        speed: store.speed,
        drawerOpen: store.drawerOpen,
        autoReplay: store.autoReplay,
        muted: isMasterMuted(),
        lastVerification: store.lastVerification,
        recording: store.recording,
        shareToken: store.shareToken
      };
    },
    diagnostics: function () {
      return {
        ready: true,
        screen: getActiveScreen(),
        mounted: Boolean(document.getElementById('zrv-replay-viewer')),
        episodeCount: store.episodes.length,
        activeEpisodeId: store.activeEpisodeId,
        currentTick: store.currentTick,
        verified: Boolean(store.lastVerification && store.lastVerification.verified),
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

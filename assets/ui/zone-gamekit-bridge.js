/* ==========================================================================
 * ZONE v163 - GAMEKIT / GAME CENTER ACHIEVEMENTS, LEADERBOARDS & CLOUD SAVE BRIDGE
 * Exclusive Ownership: @gamekit-bridge (assets/ui/zone-gamekit-bridge.js)
 * Skills Applied: /gamekit (100 max achievements, 1000 total pts, timestamp
 *   tiebreaker context, showsCompletionBanner toast, Capacitor iOS GameKit +
 *   Web /api/v1/achievements & /api/v1/leaderboards + Cloud Save snapshot)
 * Zero external CDNs · Bilingual EN/AR · WCAG 2.3.1 & Reduced-Motion safe
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root || globalThis);
  } else {
    factory(root || (typeof window !== 'undefined' ? window : globalThis));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  if (root && root.__zoneGameKitBooted && root.ZoneGameKit) {
    return root.ZoneGameKit;
  }

  var STORAGE_KEY = 'zone.gamekit.v163';
  var SAVE_SLOTS_KEY = 'zone.gamekit.icloud_saves.v163';

  /* 20 Syndicate Achievements x 50 pts = 1,000 total GameKit points */
  var ACHIEVEMENT_CATALOG = Object.freeze([
    { id: 'gk_first_spin', points: 50, titleEn: 'Monte-Carlo Initiate', titleAr: 'مبتدئ مونت كارلو', descEn: 'Spin the 37-pocket 3D European Roulette wheel.', descAr: 'أدر عجلة الروليت الأوروبية ثلاثية الأبعاد ذات ٣٧ خانة.' },
    { id: 'gk_straight_up_35', points: 50, titleEn: 'Sovereign 35:1 Sniper', titleAr: 'قناص الرقم المفرد ٣٥:١', descEn: 'Hit a Straight-Up or Zero pocket win on the 3D wheel.', descAr: 'حقق فوزاً مباشراً على رقم مفرد أو الصفر الأخضر.' },
    { id: 'gk_call_bet_savant', points: 50, titleEn: 'Voisins & Tiers Tactician', titleAr: 'خبير رهانات الجوار والأسطوانة', descEn: 'Win a French Call Bet (Voisins, Tiers, Orphelins, or Zero Game).', descAr: 'اربح رهاناً فرنسياً (جيران الصفر أو ثلث الأسطوانة أو الأيتام).' },
    { id: 'gk_craps_natural', points: 50, titleEn: 'Pier 4 Bones Natural', titleAr: 'رمية النرد الطبيعية', descEn: 'Win a Pass Line or Don\'t Pass roll on 3D Street Craps.', descAr: 'اربح جولة كرابس الشوارع ثلاثية الأبعاد.' },
    { id: 'gk_hardway_hit', points: 50, titleEn: 'Hardway Enforcer', titleAr: 'سيد الأزواج الصلبة', descEn: 'Land a Hard 4, 6, 8, or 10 on 3D Craps.', descAr: 'أصب زوجاً صلباً (٤ أو ٦ أو ٨ أو ١٠) على طاولة الكرابس.' },
    { id: 'gk_bj_natural_21', points: 50, titleEn: 'Velvet Natural 21', titleAr: 'بلاك جاك مخملي ٢١', descEn: 'Win a hand in Syndicate Blackjack.', descAr: 'اربح يداً في بلاك جاك النقابة.' },
    { id: 'gk_ev_disciplined', points: 50, titleEn: 'Actuary of the Pit', titleAr: 'خبير القيمة المتوقعة', descEn: 'Follow optimal Blackjack EV strategy 5 times.', descAr: 'اتبع القرار الأمثل للقيمة المتوقعة ٥ مرات.' },
    { id: 'gk_high_roller_100k', points: 50, titleEn: 'Obsidian Whale', titleAr: 'حوت الأوبسيديان', descEn: 'Reach $100,000 cumulative Casino wager volume.', descAr: 'بلوغ ١٠٠,٠٠٠ دولار إجمالي رهانات الكازينو.' },
    { id: 'gk_armory_curator', points: 50, titleEn: '360° Armory Curator', titleAr: 'أمين الترسانة ثلاثية الأبعاد', descEn: 'Inspect 3 distinct 3D models in the Orbit Studio.', descAr: 'افحص ٣ نماذج ثلاثية الأبعاد في استوديو الدوران.' },
    { id: 'gk_fleet_tuner', points: 50, titleEn: 'Midnight Wheelman', titleAr: 'سائق الأسطول الليلي', descEn: 'Inspect or tune a 3D Syndicate fleet vehicle.', descAr: 'افحص أو اضبط مركبة من أسطول النقابة ثلاثي الأبعاد.' },
    { id: 'gk_companion_bond', points: 50, titleEn: 'Apex Handler', titleAr: 'مروّض الذروة السيادية', descEn: 'Train or evolve a 3D Syndicate companion.', descAr: 'درّب أو طوّر مرافق النقابة ثلاثي الأبعاد.' },
    { id: 'gk_arcade_fever', points: 50, titleEn: 'x8 Overdrive Reflex', titleAr: 'ذروة الأوفردرايف ×٨', descEn: 'Reach combo fever in Syndicate Arcade.', descAr: 'بلوغ ذروة السلسلة في أركيد النقابة.' },
    { id: 'gk_heist_ghost', points: 50, titleEn: 'Zero-Trace Vault Ghost', titleAr: 'شبح الخزائن بلا أثر', descEn: 'Crack a vault door without tripping laser heat.', descAr: 'افتح باب الخزنة دون تفعيل إنذار الليزر.' },
    { id: 'gk_ironpit_titan', points: 50, titleEn: 'Ironpit Heavyweight', titleAr: 'بطل الحلبة الحديدية', descEn: 'Complete 10 strength/agility training reps in Gym.', descAr: 'أكمل ١٠ جلسات تدريب في النادي الرياضي.' },
    { id: 'gk_arena_victor', points: 50, titleEn: 'Alley Duelist', titleAr: 'مبارز الأزقة', descEn: 'Win a tactical combat encounter.', descAr: 'انتصر في مواجهة قتالية تكتيكية.' },
    { id: 'gk_faction_chain', points: 50, titleEn: 'Chain Multiplier', titleAr: 'مضاعف سلسلة العائلة', descEn: 'Contribute to an active Faction Chain.', descAr: 'ساهم في سلسلة عمليات العائلة.' },
    { id: 'gk_globe_smuggler', points: 50, titleEn: 'Contraband Aviator', titleAr: 'طيار المهربات الدولي', descEn: 'Complete a foreign market contraband run.', descAr: 'أكمل رحلة تجارة خارجية للمهربات.' },
    { id: 'gk_era_ascendant', points: 50, titleEn: 'Pier 4 Sovereign', titleAr: 'سيّد الرصيف الرابع', descEn: 'Advance your Safehouse Empire Era.', descAr: 'ارتقِ بعصر مقر عملياتك الإمبراطوري.' },
    { id: 'gk_merit_scholar', points: 50, titleEn: 'Honors & Medals Laureate', titleAr: 'حامل الأوسمة والنياشين', descEn: 'Allocate Merits or equip an Honor Bar.', descAr: 'خصّص نقاط الجدارة أو جهّز شريط شرف.' },
    { id: 'gk_master_of_zone', points: 50, titleEn: 'Legend of Zone City', titleAr: 'أسطورة مدينة الزون', descEn: 'Unlock 10 Syndicate GameKit achievements.', descAr: 'افتح ١٠ إنجازات في مركز ألعاب الزون.' }
  ]);

  var LEADERBOARD_IDS = Object.freeze({
    high_rollers: { id: 'zone_high_rollers_net', type: 'recurring', reset: 'daily', titleEn: 'Obsidian Salon Net Profit', titleAr: 'صافي أرباح صالون الأوبسيديان' },
    roulette_royale: { id: 'zone_roulette_royale', type: 'recurring', reset: 'weekly', titleEn: '3D Roulette Biggest Hit', titleAr: 'أعلى ضربة روليت ٣D' },
    syndicate_respect: { id: 'zone_syndicate_respect', type: 'classic', reset: 'allTime', titleEn: 'All-Time Syndicate Respect', titleAr: 'هيبة النقابة التاريخية' },
    arcade_overdrive: { id: 'zone_arcade_overdrive', type: 'recurring', reset: 'daily', titleEn: '60fps Arcade High Score', titleAr: 'أعلى نقاط أركيد ٦٠ إطاراً' }
  });

  function isAr() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    var h = document.documentElement;
    return h.dir === 'rtl' || String(h.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function createGameKitEngine(opts) {
    var options = opts || {};
    var achievements = Object.create(null);
    var leaderboards = Object.create(null);
    var counters = { inspectedItems: Object.create(null), optimalBjCount: 0, totalWagered: 0 };
    var authState = {
      isAuthenticated: true,
      playerId: 'local-operative',
      displayName: 'Operative',
      nativeGameCenter: false
    };

    for (var i = 0; i < ACHIEVEMENT_CATALOG.length; i++) {
      var spec = ACHIEVEMENT_CATALOG[i];
      achievements[spec.id] = {
        identifier: spec.id,
        points: spec.points,
        percentComplete: 0,
        unlocked: false,
        unlockedAt: 0,
        showsCompletionBanner: true
      };
    }

    var lbKeys = Object.keys(LEADERBOARD_IDS);
    for (var k = 0; k < lbKeys.length; k++) {
      var def = LEADERBOARD_IDS[lbKeys[k]];
      leaderboards[def.id] = {
        leaderboardID: def.id,
        type: def.type,
        entries: []
      };
    }

    function loadPersisted() {
      try {
        if (typeof localStorage === 'undefined') return;
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.achievements) {
          var ids = Object.keys(parsed.achievements);
          for (var j = 0; j < ids.length; j++) {
            var id = ids[j];
            if (achievements[id]) {
              achievements[id].percentComplete = Math.min(100, Math.max(0, Number(parsed.achievements[id].percentComplete) || 0));
              achievements[id].unlocked = achievements[id].percentComplete >= 100;
              achievements[id].unlockedAt = Number(parsed.achievements[id].unlockedAt) || 0;
            }
          }
        }
        if (parsed && parsed.leaderboards) {
          var lIds = Object.keys(parsed.leaderboards);
          for (var m = 0; m < lIds.length; m++) {
            var lid = lIds[m];
            if (leaderboards[lid] && Array.isArray(parsed.leaderboards[lid])) {
              leaderboards[lid].entries = parsed.leaderboards[lid].slice(0, 25);
            }
          }
        }
      } catch (_) { /* storage unavailable safe */ }
    }

    function persist() {
      try {
        if (typeof localStorage === 'undefined') return;
        var outAch = {};
        var ids = Object.keys(achievements);
        for (var i = 0; i < ids.length; i++) {
          var a = achievements[ids[i]];
          if (a.percentComplete > 0) {
            outAch[a.identifier] = {
              percentComplete: a.percentComplete,
              unlocked: a.unlocked,
              unlockedAt: a.unlockedAt
            };
          }
        }
        var outLb = {};
        var lIds = Object.keys(leaderboards);
        for (var k = 0; k < lIds.length; k++) {
          outLb[lIds[k]] = leaderboards[lIds[k]].entries.slice(0, 15);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ achievements: outAch, leaderboards: outLb }));
      } catch (_) { /* ignore */ }
    }

    function syncIdentity() {
      if (typeof window !== 'undefined') {
        var g = window.__zoneGame;
        if (g && g.p) {
          if (g.p.id) authState.playerId = String(g.p.id);
          if (g.p.username || g.p.name) authState.displayName = String(g.p.username || g.p.name);
        }
        var cap = window.Capacitor && window.Capacitor.Plugins && (window.Capacitor.Plugins.GameCenter || window.Capacitor.Plugins.GameKit);
        if (cap) authState.nativeGameCenter = true;
      }
      return authState;
    }

    function showCompletionBanner(spec) {
      if (options.headless || typeof document === 'undefined' || !document.body) return;
      var ar = isAr();
      var banner = document.getElementById('zgk-achievement-toast');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'zgk-achievement-toast';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.style.cssText = 'position:fixed;top:86px;inset-inline-end:14px;z-index:960;max-width:min(320px,88vw);padding:9px 13px;border-radius:10px;border:1.8px solid #f3c969;background:linear-gradient(145deg,#17130f,#0d0b09);color:#fbf6ea;box-shadow:3px 4px 0 rgba(0,0,0,0.68);font-family:var(--zwc-font-hand,system-ui,sans-serif);display:flex;align-items:center;gap:10px;pointer-events:none;transition:opacity 0.24s ease,transform 0.24s ease;';
        document.body.appendChild(banner);
      }
      var badgeTitle = ar ? spec.titleAr : spec.titleEn;
      var subText = ar ? ('إنجاز GameKit +' + spec.points + ' نقطة') : ('GameKit Unlocked · +' + spec.points + ' PTS');
      banner.innerHTML = '<span style="width:28px;height:28px;border-radius:50%;background:rgba(243,201,105,0.2);border:1.5px solid #f3c969;display:grid;place-items:center;color:#f3c969;font-weight:900;flex:none">★</span>' +
        '<div style="min-width:0"><div style="font-size:10.5px;color:#f3c969;font-weight:800">' + subText + '</div>' +
        '<div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + badgeTitle + '</div></div>';
      banner.style.opacity = '1';
      banner.style.transform = 'translateY(0)';
      if (banner.__hideTimer) clearTimeout(banner.__hideTimer);
      banner.__hideTimer = setTimeout(function () {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-8px)';
      }, 3200);
    }

    function forwardNativeGameCenter(method, payload) {
      if (typeof window === 'undefined') return false;
      var cap = window.Capacitor && window.Capacitor.Plugins && (window.Capacitor.Plugins.GameCenter || window.Capacitor.Plugins.GameKit);
      if (cap && typeof cap[method] === 'function') {
        try { cap[method](payload); return true; } catch (_) { return false; }
      }
      return false;
    }

    /* GameKit GKAchievement.report equivalent */
    function reportAchievement(id, percent, showsBanner) {
      syncIdentity();
      if (!authState.isAuthenticated || !achievements[id]) return null;
      var rec = achievements[id];
      var prevUnlocked = rec.unlocked;
      var clamped = Math.min(100, Math.max(rec.percentComplete, Number(percent) || 0));
      rec.percentComplete = Math.round(clamped * 10) / 10;
      if (showsBanner !== undefined) rec.showsCompletionBanner = Boolean(showsBanner);

      if (rec.percentComplete >= 100 && !prevUnlocked) {
        rec.unlocked = true;
        rec.unlockedAt = Date.now();
        var spec = null;
        for (var i = 0; i < ACHIEVEMENT_CATALOG.length; i++) {
          if (ACHIEVEMENT_CATALOG[i].id === id) { spec = ACHIEVEMENT_CATALOG[i]; break; }
        }
        if (spec && rec.showsCompletionBanner) showCompletionBanner(spec);
        forwardNativeGameCenter('reportAchievement', { identifier: id, percentComplete: 100.0 });
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('zone:gamekit-achievement', { detail: { id: id, points: rec.points, spec: spec } }));
        }
        // Check meta-achievement (10 unlocked)
        if (id !== 'gk_master_of_zone') {
          var unlockedCount = getSummary().unlockedCount;
          if (unlockedCount >= 10) reportAchievement('gk_master_of_zone', 100);
        }
      }
      persist();
      return rec;
    }

    /* GameKit GKLeaderboard.submitScore(score, context: timestamp) equivalent */
    function submitScore(score, leaderboardID, contextTimestamp) {
      syncIdentity();
      if (!authState.isAuthenticated) return false;
      var lid = leaderboards[leaderboardID] ? leaderboardID : LEADERBOARD_IDS.high_rollers.id;
      var intScore = Math.round(Number(score) || 0);
      var ctxTs = Number(contextTimestamp) || Math.floor(Date.now() / 1000);
      var bucket = leaderboards[lid];

      var existingIdx = -1;
      for (var i = 0; i < bucket.entries.length; i++) {
        if (bucket.entries[i].playerId === authState.playerId) { existingIdx = i; break; }
      }
      if (existingIdx >= 0) {
        if (intScore > bucket.entries[existingIdx].score) {
          bucket.entries[existingIdx].score = intScore;
          bucket.entries[existingIdx].context = ctxTs;
          bucket.entries[existingIdx].displayName = authState.displayName;
        }
      } else {
        bucket.entries.push({
          playerId: authState.playerId,
          displayName: authState.displayName,
          score: intScore,
          context: ctxTs
        });
      }

      /* Sort descending by score; break ties by earlier timestamp context */
      bucket.entries.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.context - b.context;
      });
      for (var r = 0; r < bucket.entries.length; r++) {
        bucket.entries[r].rank = r + 1;
      }

      forwardNativeGameCenter('submitScore', { leaderboardID: lid, score: intScore, context: ctxTs });
      persist();
      return bucket.entries[0] || null;
    }

    /* GameKit GKLocalPlayer.saveGameData / fetchSavedGames equivalent */
    function saveGameData(snapshotObj, slotName) {
      var name = String(slotName || 'autosave');
      var record = {
        name: name,
        savedAt: Date.now(),
        playerId: authState.playerId,
        data: snapshotObj || {}
      };
      try {
        if (typeof localStorage !== 'undefined') {
          var map = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY) || '{}');
          map[name] = record;
          localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(map));
        }
      } catch (_) { /* ignore */ }
      forwardNativeGameCenter('saveGameData', record);
      return record;
    }

    function fetchSavedGames() {
      try {
        if (typeof localStorage !== 'undefined') {
          var map = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY) || '{}');
          return Object.keys(map).map(function (k) { return map[k]; });
        }
      } catch (_) { /* ignore */ }
      return [];
    }

    function recordEvent(eventName, payload) {
      var ev = String(eventName || '').toLowerCase();
      var p = payload || {};
      if (ev === 'roulette_spin') {
        reportAchievement('gk_first_spin', 100);
        var wager = Math.max(0, Number(p.stake) || 0);
        counters.totalWagered += wager;
        if (counters.totalWagered > 0) {
          reportAchievement('gk_high_roller_100k', Math.min(100, (counters.totalWagered / 100000) * 100));
        }
        if (Number(p.netDelta) > 0) {
          submitScore(Number(p.netDelta), LEADERBOARD_IDS.roulette_royale.id);
          if (p.betType === 'straight' || p.betType === 'zero' || Number(p.pocket) === 0) {
            reportAchievement('gk_straight_up_35', 100);
          }
          if (/voisin|tier|orphelin|jeu_zero|call/.test(String(p.betType || ''))) {
            reportAchievement('gk_call_bet_savant', 100);
          }
        }
      } else if (ev === 'craps_roll') {
        counters.totalWagered += Math.max(0, Number(p.stake) || 0);
        reportAchievement('gk_high_roller_100k', Math.min(100, (counters.totalWagered / 100000) * 100));
        if (Number(p.netDelta) > 0) {
          if (p.betId === 'hardways') reportAchievement('gk_hardway_hit', 100);
          else reportAchievement('gk_craps_natural', 100);
        }
      } else if (ev === 'blackjack_hand') {
        counters.totalWagered += Math.max(0, Number(p.stake) || 0);
        reportAchievement('gk_high_roller_100k', Math.min(100, (counters.totalWagered / 100000) * 100));
        if (p.followedOptimal) {
          counters.optimalBjCount += 1;
          reportAchievement('gk_ev_disciplined', Math.min(100, counters.optimalBjCount * 20));
        }
        if (Number(p.netDelta) > 0) {
          reportAchievement('gk_bj_natural_21', 100);
          submitScore(Number(p.netDelta), LEADERBOARD_IDS.high_rollers.id);
        }
      } else if (ev === 'inspect_3d') {
        var itemId = String(p.itemId || 'item');
        counters.inspectedItems[itemId] = true;
        var count = Object.keys(counters.inspectedItems).length;
        reportAchievement('gk_armory_curator', Math.min(100, (count / 3) * 100));
        if (p.category === 'vehicle') reportAchievement('gk_fleet_tuner', 100);
        if (p.category === 'companion') reportAchievement('gk_companion_bond', 100);
      }
    }

    function getSummary() {
      var unlocked = 0;
      var earnedPoints = 0;
      var totalPoints = 0;
      for (var i = 0; i < ACHIEVEMENT_CATALOG.length; i++) {
        var spec = ACHIEVEMENT_CATALOG[i];
        totalPoints += spec.points;
        var rec = achievements[spec.id];
        if (rec && rec.unlocked) {
          unlocked += 1;
          earnedPoints += spec.points;
        }
      }
      return {
        authenticated: authState.isAuthenticated,
        nativeGameCenter: authState.nativeGameCenter,
        totalAchievements: ACHIEVEMENT_CATALOG.length,
        unlockedCount: unlocked,
        earnedPoints: earnedPoints,
        maxPoints: totalPoints,
        leaderboardsCount: Object.keys(leaderboards).length
      };
    }

    function resetDebugAchievements() {
      var ids = Object.keys(achievements);
      for (var i = 0; i < ids.length; i++) {
        achievements[ids[i]].percentComplete = 0;
        achievements[ids[i]].unlocked = false;
        achievements[ids[i]].unlockedAt = 0;
      }
      counters.inspectedItems = Object.create(null);
      counters.optimalBjCount = 0;
      counters.totalWagered = 0;
      persist();
    }

    loadPersisted();
    syncIdentity();

    return {
      ACHIEVEMENT_CATALOG: ACHIEVEMENT_CATALOG,
      LEADERBOARD_IDS: LEADERBOARD_IDS,
      reportAchievement: reportAchievement,
      submitScore: submitScore,
      loadEntries: function (leaderboardID, limit) {
        var b = leaderboards[leaderboardID];
        return b ? b.entries.slice(0, limit || 10) : [];
      },
      saveGameData: saveGameData,
      fetchSavedGames: fetchSavedGames,
      recordEvent: recordEvent,
      getSummary: getSummary,
      getAchievements: function () { return achievements; },
      resetDebugAchievements: resetDebugAchievements
    };
  }

  var singleton = createGameKitEngine();
  if (root) {
    root.__zoneGameKitBooted = true;
    root.ZoneGameKit = singleton;
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('zone:3d-action', function (ev) {
      var d = ev && ev.detail;
      if (!d) return;
      if (d.stageKind === 'casino-royale' && d.actionName === 'spin') {
        singleton.recordEvent('roulette_spin', d.payload || {});
      }
    });
  }

  return {
    createGameKitEngine: createGameKitEngine,
    ACHIEVEMENT_CATALOG: ACHIEVEMENT_CATALOG,
    LEADERBOARD_IDS: LEADERBOARD_IDS,
    singleton: singleton
  };
});

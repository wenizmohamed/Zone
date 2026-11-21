/* ==========================================================================
 * ZONE v157 - TRACK 9: 6-DISTRICT TERRITORY WARFARE, DELTA SYNC & RAID LOBBY
 * Exclusive Ownership: @faction-war-net (assets/ui/zone-faction-warfare.js)
 * Exposes: window.ZoneFactionWarfare
 * Mounts ONLY on screen === 'faction' and screen === 'family' (0 mounts on home!)
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneFactionWarfareBooted && window.ZoneFactionWarfare) return;
  window.__zoneFactionWarfareBooted = true;

  var FACTIONS = {
    vipers: { id: 'vipers', en: 'Sand Vipers', ar: 'أفاعي الرمل', color: '#78d628' },
    kings: { id: 'kings', en: 'Harbor Kings', ar: 'ملوك المرفأ', color: '#3d7cc9' },
    night: { id: 'night', en: 'Night Market', ar: 'السوق الليلي', color: '#b8529e' },
    oldguard: { id: 'oldguard', en: 'Old Guard', ar: 'الحرس القديم', color: '#d99332' }
  };

  var DEFAULT_DISTRICTS = [
    { id: 'north', en: 'Northern Heights', ar: 'المرتفعات الشمالية', x: 180, y: 52, neighbors: ['west', 'center', 'fin'], owner: 'oldguard', shield: 24, heat: 22, perkEn: '+8% Gym & Armor Supply', perkAr: '+8% تدريب النادي والدروع' },
    { id: 'west', en: 'West Pier & Docks', ar: 'الرصيف الغربي والميناء', x: 82, y: 112, neighbors: ['north', 'center', 'red'], owner: 'kings', shield: 24, heat: 26, perkEn: '+10% Contraband Corridor', perkAr: '+10% ممر التهريب البحري' },
    { id: 'center', en: 'Downtown Core', ar: 'قلب وسط المدينة', x: 180, y: 122, neighbors: ['north', 'west', 'fin', 'red', 'res'], owner: 'vipers', shield: 28, heat: 34, perkEn: '+12% Syndicate Respect Flow', perkAr: '+12% تدفق احترام النقابة' },
    { id: 'fin', en: 'Financial Spire', ar: 'الحي المالي', x: 278, y: 112, neighbors: ['north', 'center', 'res'], owner: 'oldguard', shield: 22, heat: 25, perkEn: '+9% Vault & Market Cut', perkAr: '+9% عوائد الخزائن والسوق' },
    { id: 'red', en: 'Neon Red District', ar: 'حي النيون الأحمر', x: 116, y: 192, neighbors: ['west', 'center', 'res'], owner: 'night', shield: 20, heat: 30, perkEn: '+10% Underworld Heist Cut', perkAr: '+10% حصة السوق الخفي' },
    { id: 'res', en: 'Residential Quarters', ar: 'الأحياء السكنية', x: 244, y: 192, neighbors: ['center', 'fin', 'red'], owner: 'vipers', shield: 24, heat: 18, perkEn: '+10% Safehouse Recovery', perkAr: '+10% تعافي الملاجئ' }
  ];

  var RAID_SLOTS = [
    { id: 'vanguard', en: 'Vanguard', ar: 'الطليعة' },
    { id: 'breacher', en: 'Breacher', ar: 'المقتحم' },
    { id: 'support', en: 'Support', ar: 'الإسناد' }
  ];

  function buildDefaultControl(owner) {
    var map = {};
    var others = [];
    var keys = Object.keys(FACTIONS);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === owner) map[keys[i]] = 58;
      else others.push(keys[i]);
    }
    var shares = [18, 14, 10];
    for (var j = 0; j < others.length; j++) map[others[j]] = shares[j] || 10;
    return map;
  }

  function makeInitialDistricts() {
    return DEFAULT_DISTRICTS.map(function (d) {
      return {
        id: d.id,
        nameEn: d.en,
        nameAr: d.ar,
        mapX: d.x,
        mapY: d.y,
        neighbors: d.neighbors.slice(),
        perkEn: d.perkEn,
        perkAr: d.perkAr,
        ownerFactionId: d.owner,
        ownerNameEn: FACTIONS[d.owner].en,
        ownerNameAr: FACTIONS[d.owner].ar,
        ownerColor: FACTIONS[d.owner].color,
        controlMap: buildDefaultControl(d.owner),
        ownerControlPct: 58,
        fortifyShield: d.shield,
        heatLevel: d.heat,
        contested: false,
        chainCount: 0,
        chainActive: false,
        chainRemainingSec: 0
      };
    });
  }

  var store = {
    selectedDistrict: 'center',
    playerFactionId: 'vipers',
    snapshotSeq: 1,
    deltaCompressed: false,
    serverClockOffsetSec: 0,
    offlineMode: false,
    busy: false,
    lastSyncAt: 0,
    districts: makeInitialDistricts(),
    eloStandings: [
      { factionId: 'oldguard', nameEn: 'Old Guard', nameAr: 'الحرس القديم', color: '#d99332', eloRating: 1260, mmrBand: 'Contender', wins: 4, losses: 2 },
      { factionId: 'vipers', nameEn: 'Sand Vipers', nameAr: 'أفاعي الرمل', color: '#78d628', eloRating: 1240, mmrBand: 'Contender', wins: 3, losses: 2 },
      { factionId: 'kings', nameEn: 'Harbor Kings', ar: 'ملوك المرفأ', nameAr: 'ملوك المرفأ', color: '#3d7cc9', eloRating: 1215, mmrBand: 'Contender', wins: 2, losses: 3 },
      { factionId: 'night', nameEn: 'Night Market', nameAr: 'السوق الليلي', color: '#b8529e', eloRating: 1185, mmrBand: 'Contender', wins: 1, losses: 3 }
    ],
    activeMatch: null,
    activeLobby: null,
    chainSummary: {
      count: 0,
      active: false,
      districtId: 'center',
      remainingSec: 0,
      expiresAt: 0,
      multiplier: 1.0,
      lagCompensationWindowMs: 350
    },
    cooldowns: {
      assaultUntilSec: 0,
      fortifyUntilSec: 0
    },
    feedback: null,
    telemetry: {
      apiCalls: 0,
      deltaSyncs: 0,
      offlineFallbacks: 0,
      assaults: 0,
      fortifies: 0,
      lobbiesCreated: 0
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

  function nowSecFloat() {
    return (Date.now() / 1000) + store.serverClockOffsetSec;
  }

  function fmtClock(sec) {
    var s = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function computeEloDelta(ratingA, ratingB, actualScoreA, kFactor) {
    var k = kFactor || 32;
    var expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    var deltaA = Math.round(k * (actualScoreA - expectedA));
    return {
      deltaA: deltaA,
      deltaB: -deltaA,
      expectedA: Math.round(expectedA * 10000) / 10000,
      nextRatingA: Math.max(100, ratingA + deltaA),
      nextRatingB: Math.max(100, ratingB - deltaA)
    };
  }

  function emitCue(cue, detail) {
    if (window.ZoneAudioHaptics && typeof window.ZoneAudioHaptics.play === 'function') {
      try { window.ZoneAudioHaptics.play(cue, detail || {}); } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('zone:faction-war-event', { detail: { cue: cue, payload: detail || {} } }));
    } catch (_) {}
  }

  function findDistrict(id) {
    for (var i = 0; i < store.districts.length; i++) {
      if (store.districts[i].id === id) return store.districts[i];
    }
    return store.districts[0];
  }

  function applyDeltaPayload(data) {
    if (!data || typeof data !== 'object') return;
    if (data.serverTimestamp) {
      store.serverClockOffsetSec = Number(data.serverTimestamp) - (Date.now() / 1000);
    }
    if (data.snapshotSeq) {
      store.snapshotSeq = Number(data.snapshotSeq);
    }
    store.deltaCompressed = Boolean(data.deltaCompressed);
    if (data.deltaCompressed) store.telemetry.deltaSyncs++;
    if (data.playerFactionId) store.playerFactionId = String(data.playerFactionId);

    if (Array.isArray(data.districts) && data.districts.length > 0) {
      var byId = {};
      for (var i = 0; i < store.districts.length; i++) byId[store.districts[i].id] = store.districts[i];
      for (var j = 0; j < data.districts.length; j++) {
        var inc = data.districts[j];
        if (inc && inc.id) byId[inc.id] = Object.assign(byId[inc.id] || {}, inc);
      }
      store.districts = DEFAULT_DISTRICTS.map(function (def) {
        return byId[def.id] || findDistrict(def.id);
      });
    } else if (data.district && data.district.id) {
      for (var k = 0; k < store.districts.length; k++) {
        if (store.districts[k].id === data.district.id) {
          store.districts[k] = Object.assign({}, store.districts[k], data.district);
          break;
        }
      }
    }

    if (Array.isArray(data.eloStandings) && data.eloStandings.length > 0) {
      var eloById = {};
      for (var e1 = 0; e1 < store.eloStandings.length; e1++) eloById[store.eloStandings[e1].factionId] = store.eloStandings[e1];
      for (var e2 = 0; e2 < data.eloStandings.length; e2++) {
        var er = data.eloStandings[e2];
        if (er && er.factionId) eloById[er.factionId] = Object.assign(eloById[er.factionId] || {}, er);
      }
      store.eloStandings = Object.keys(eloById).map(function (id) { return eloById[id]; }).sort(function (a, b) {
        return b.eloRating - a.eloRating;
      });
    }

    if (Array.isArray(data.lobbies) && data.lobbies.length > 0) {
      store.activeLobby = data.lobbies[0];
    } else if (data.lobby && data.lobby.lobbyId) {
      store.activeLobby = data.lobby;
    }

    if (data.match) store.activeMatch = data.match;
    if (data.chainSummary) store.chainSummary = Object.assign({}, store.chainSummary, data.chainSummary);
    if (data.cooldowns) {
      var now = nowSecFloat();
      var aRem = Math.max(0, Number(data.cooldowns.assaultRemainingSec || 0));
      var fRem = Math.max(0, Number(data.cooldowns.fortifyRemainingSec || 0));
      store.cooldowns.assaultUntilSec = aRem > 0 ? (now + aRem) : 0;
      store.cooldowns.fortifyUntilSec = fRem > 0 ? (now + fRem) : 0;
    }
    if (data.player && typeof window.ZoneSyncHudBars === 'function') {
      try { window.ZoneSyncHudBars(data); } catch (_) {}
    }
  }

  async function fetchWarState(force) {
    if (!force && (Date.now() - store.lastSyncAt) < 4000) return;
    store.lastSyncAt = Date.now();
    store.telemetry.apiCalls++;
    try {
      var url = '/api/v1/faction-war?sinceSeq=' + encodeURIComponent(store.snapshotSeq > 1 ? store.snapshotSeq : 0) +
        '&district=' + encodeURIComponent(store.selectedDistrict);
      var res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        store.offlineMode = true;
        return;
      }
      var json = await res.json();
      store.offlineMode = false;
      applyDeltaPayload(json);
      renderMount();
    } catch (_) {
      store.offlineMode = true;
    }
  }

  async function postWarAction(action, payload) {
    if (store.busy) return null;
    store.busy = true;
    renderMount();
    try {
      var body = Object.assign({ action: action, clientPhaseTs: nowSecFloat() }, payload || {});
      var res = await fetch('/api/v1/faction-war/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        var json = await res.json();
        store.offlineMode = false;
        applyDeltaPayload(json);
        if (json.result && json.result.summaryEn) {
          store.feedback = {
            tone: 'sage',
            en: json.result.summaryEn,
            ar: json.result.summaryAr || json.result.summaryEn
          };
        }
        return json;
      }
      var errJson = null;
      try { errJson = await res.json(); } catch (_) {}
      if (res.status === 400 || res.status === 429) {
        store.feedback = {
          tone: 'crimson',
          en: (errJson && errJson.message) || 'Action blocked by server cooldown or energy gate.',
          ar: (errJson && errJson.message) || 'تم رفض الإجراء مؤقتاً بسبب التهدئة أو الطاقة.'
        };
        return null;
      }
    } catch (_) {
      // Fall through to deterministic offline preview
    } finally {
      store.busy = false;
    }
    return runOfflineFallback(action, payload || {});
  }

  function runOfflineFallback(action, payload) {
    store.offlineMode = true;
    store.telemetry.offlineFallbacks++;
    store.snapshotSeq += 1;
    var now = nowSecFloat();
    var fid = store.playerFactionId || 'vipers';
    var dist = findDistrict(payload.district || store.selectedDistrict);

    if (action === 'matchmake') {
      var selfRow = store.eloStandings.filter(function (e) { return e.factionId === fid; })[0] || store.eloStandings[0];
      var rivals = store.eloStandings.filter(function (e) { return e.factionId !== fid; });
      rivals.sort(function (a, b) { return Math.abs(a.eloRating - selfRow.eloRating) - Math.abs(b.eloRating - selfRow.eloRating); });
      var opp = rivals[0] || store.eloStandings[1];
      var sim = computeEloDelta(selfRow.eloRating, opp.eloRating, 1, 32);
      store.activeMatch = {
        factionId: fid,
        factionNameEn: selfRow.nameEn,
        factionNameAr: selfRow.nameAr,
        selfElo: selfRow.eloRating,
        opponentFactionId: opp.factionId,
        opponentNameEn: opp.nameEn,
        opponentNameAr: opp.nameAr,
        opponentElo: opp.eloRating,
        eloGap: Math.abs(selfRow.eloRating - opp.eloRating),
        expectedWinProb: sim.expectedA,
        projectedWinDelta: sim.deltaA,
        kFactor: 32,
        recommendedDistrict: dist.id
      };
      store.feedback = {
        tone: 'gold',
        en: 'Matched vs ' + opp.nameEn + ' (ELO Gap ' + store.activeMatch.eloGap + ', Win +' + sim.deltaA + ')',
        ar: 'تمت المطابقة ضد ' + opp.nameAr + ' (فارق ELO ' + store.activeMatch.eloGap + ')'
      };
      emitCue('ui_nav', { action: 'matchmake' });
      renderMount();
      return { ok: true, offline: true, match: store.activeMatch };
    }

    if (action === 'create_raid_lobby') {
      store.telemetry.lobbiesCreated++;
      var oppId = (store.activeMatch && store.activeMatch.opponentFactionId) || (fid === 'vipers' ? 'oldguard' : 'vipers');
      var slotPick = payload.slot || 'vanguard';
      var slots = { vanguard: null, breacher: null, support: null };
      slots[slotPick] = { playerId: 'local-operative', username: 'Operative', level: 12, isNpc: false };
      if (payload.fillAlliedSquad) {
        if (!slots.vanguard) slots.vanguard = { playerId: 'npc-vanguard', username: 'Vanguard_Rex', level: 12, isNpc: true };
        if (!slots.breacher) slots.breacher = { playerId: 'npc-breacher', username: 'Cipher_Ghost', level: 12, isNpc: true };
        if (!slots.support) slots.support = { playerId: 'npc-support', username: 'Med_Tariq', level: 12, isNpc: true };
      }
      var filled = Object.keys(slots).filter(function (k) { return Boolean(slots[k]); }).length;
      store.activeLobby = {
        lobbyId: 'raid-preview-' + store.snapshotSeq,
        factionId: fid,
        opponentFactionId: oppId,
        opponentNameEn: FACTIONS[oppId].en,
        opponentNameAr: FACTIONS[oppId].ar,
        districtId: dist.id,
        status: filled >= 3 ? 'READY' : 'WAITING',
        matchEloGap: store.activeMatch ? store.activeMatch.eloGap : 20,
        slots: slots,
        filledSlots: filled,
        maxSlots: 3
      };
      store.feedback = {
        tone: 'sage',
        en: '3-Slot Raid Lobby opened for ' + dist.nameEn + ' (' + filled + '/3 ready).',
        ar: 'تم فتح غرفة غارة (3 مقاعد) في ' + dist.nameAr + ' (' + filled + '/3).'
      };
      emitCue('ui_nav', { action: 'create_raid_lobby' });
      renderMount();
      return { ok: true, offline: true, lobby: store.activeLobby };
    }

    if (action === 'join_raid_lobby' && store.activeLobby) {
      var targetSlot = payload.slot;
      if (!targetSlot) {
        for (var si = 0; si < RAID_SLOTS.length; si++) {
          if (!store.activeLobby.slots[RAID_SLOTS[si].id]) { targetSlot = RAID_SLOTS[si].id; break; }
        }
      }
      if (targetSlot && !store.activeLobby.slots[targetSlot]) {
        store.activeLobby.slots[targetSlot] = { playerId: 'ally-' + store.snapshotSeq, username: 'Squad_Ally', level: 11, isNpc: false };
      }
      var fCnt = Object.keys(store.activeLobby.slots).filter(function (k) { return Boolean(store.activeLobby.slots[k]); }).length;
      store.activeLobby.filledSlots = fCnt;
      store.activeLobby.status = fCnt >= 3 ? 'READY' : 'WAITING';
      store.feedback = {
        tone: 'sage',
        en: 'Squad member joined ' + (targetSlot || 'slot') + ' (' + fCnt + '/3).',
        ar: 'انضم عضو إلى مقعد ' + (targetSlot || '') + ' (' + fCnt + '/3).'
      };
      renderMount();
      return { ok: true, offline: true, lobby: store.activeLobby };
    }

    if (action === 'assault_sector') {
      store.telemetry.assaults++;
      var shift = 12;
      dist.fortifyShield = Math.max(0, dist.fortifyShield - 10);
      var map = dist.controlMap;
      var keys = Object.keys(map);
      var pulled = 0;
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki] === fid) continue;
        var take = Math.min(Math.max(0, map[keys[ki]] - 2), shift - pulled);
        map[keys[ki]] -= take;
        pulled += take;
      }
      map[fid] = Math.min(94, (map[fid] || 0) + pulled);
      var topOwner = dist.ownerFactionId;
      var topVal = map[topOwner] || 0;
      for (var oi = 0; oi < keys.length; oi++) {
        if (map[keys[oi]] > topVal) { topVal = map[keys[oi]]; topOwner = keys[oi]; }
      }
      var captured = topOwner !== dist.ownerFactionId && topOwner === fid;
      dist.ownerFactionId = topOwner;
      dist.ownerNameEn = FACTIONS[topOwner].en;
      dist.ownerNameAr = FACTIONS[topOwner].ar;
      dist.ownerColor = FACTIONS[topOwner].color;
      dist.ownerControlPct = map[topOwner];
      dist.heatLevel = Math.min(100, dist.heatLevel + 9);
      dist.contested = dist.ownerControlPct < 55;
      store.chainSummary.count += 1;
      store.chainSummary.active = true;
      store.chainSummary.districtId = dist.id;
      store.chainSummary.expiresAt = Math.floor(now) + 300;
      store.chainSummary.remainingSec = 300;
      store.chainSummary.multiplier = Math.round(Math.min(2.0, 1.0 + store.chainSummary.count * 0.04) * 100) / 100;
      store.cooldowns.assaultUntilSec = now + 8;
      store.feedback = {
        tone: 'sage',
        en: (captured ? 'Sector Captured! ' : 'Sector Assaulted! +') + pulled + '% influence in ' + dist.nameEn + ' (Offline Preview).',
        ar: (captured ? 'تمت السيطرة! ' : 'هجوم قطاع! +') + pulled + '% نفوذ في ' + dist.nameAr
      };
      emitCue('gunshot_rifle', { district: dist.id, captured: captured });
      renderMount();
      return { ok: true, offline: true, district: dist };
    }

    if (action === 'fortify_sector') {
      store.telemetry.fortifies++;
      dist.fortifyShield = Math.min(100, dist.fortifyShield + 16);
      dist.heatLevel = Math.max(8, dist.heatLevel - 6);
      store.chainSummary.active = true;
      store.chainSummary.expiresAt = Math.floor(now) + 300;
      store.chainSummary.remainingSec = 300;
      store.cooldowns.fortifyUntilSec = now + 8;
      store.feedback = {
        tone: 'gold',
        en: 'Fortified ' + dist.nameEn + ' shield to ' + dist.fortifyShield + '% (Offline Preview).',
        ar: 'تم تحصين درع ' + dist.nameAr + ' إلى ' + dist.fortifyShield + '%.'
      };
      emitCue('heavy_bag_impact', { district: dist.id });
      renderMount();
      return { ok: true, offline: true, district: dist };
    }

    return null;
  }

  function renderWargameSvgHtml(ar) {
    var byId = {};
    for (var i = 0; i < store.districts.length; i++) byId[store.districts[i].id] = store.districts[i];

    // Draw watercolor ink supply lines between neighboring districts
    var drawnEdges = {};
    var edgesHtml = '';
    for (var dIdx = 0; dIdx < store.districts.length; dIdx++) {
      var d = store.districts[dIdx];
      var nbrs = d.neighbors || [];
      for (var nIdx = 0; nIdx < nbrs.length; nIdx++) {
        var n = byId[nbrs[nIdx]];
        if (!n) continue;
        var key = d.id < n.id ? (d.id + ':' + n.id) : (n.id + ':' + d.id);
        if (drawnEdges[key]) continue;
        drawnEdges[key] = true;
        edgesHtml += '<line x1="' + d.mapX + '" y1="' + d.mapY + '" x2="' + n.mapX + '" y2="' + n.mapY + '" stroke="currentColor" stroke-opacity="0.28" stroke-width="2" stroke-dasharray="4 4"/>';
      }
    }

    var nodesHtml = '';
    for (var k = 0; k < store.districts.length; k++) {
      var dist = store.districts[k];
      var selected = dist.id === store.selectedDistrict;
      var cx = dist.mapX;
      var cy = dist.mapY;
      var r = 31;
      var pts = [];
      for (var p = 0; p < 6; p++) {
        var ang = (Math.PI / 3) * p - (Math.PI / 6);
        pts.push(Math.round(cx + r * Math.cos(ang)) + ',' + Math.round(cy + r * Math.sin(ang)));
      }
      var label = dist.id.toUpperCase();
      nodesHtml +=
        '<g class="zfw-hex-node" role="button" tabindex="0" data-zfw-act="select-district" data-district="' + esc(dist.id) + '" aria-label="' + esc(ar ? dist.nameAr : dist.nameEn) + '">' +
          '<polygon points="' + pts.join(' ') + '" fill="' + esc(dist.ownerColor || '#78d628') + '" fill-opacity="' + (selected ? '0.38' : '0.20') + '" stroke="' + (selected ? '#f4cf78' : 'currentColor') + '" stroke-width="' + (selected ? '2.8' : '1.6') + '"/>' +
          '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" fill="currentColor" font-size="10.5" font-weight="800">' + esc(label) + '</text>' +
          '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" fill="currentColor" font-size="10" font-weight="700">' + esc(dist.ownerControlPct + '%') + '</text>' +
        '</g>';
    }

    return (
      '<svg class="zfw-map-svg" viewBox="0 0 360 244" role="img" aria-label="' + esc(ar ? 'خريطة السيطرة على أحياء مدينة زون الستة' : 'Zone City 6-District Territory Control Map') + '">' +
        edgesHtml +
        nodesHtml +
      '</svg>'
    );
  }

  function renderHtml() {
    var ar = isAr();
    var now = nowSecFloat();
    var dist = findDistrict(store.selectedDistrict);
    var assCd = Math.max(0, Math.ceil(store.cooldowns.assaultUntilSec - now));
    var fortCd = Math.max(0, Math.ceil(store.cooldowns.fortifyUntilSec - now));

    var chainRem = store.chainSummary.expiresAt > 0
      ? Math.max(0, Math.ceil(store.chainSummary.expiresAt - now))
      : Math.max(0, Number(store.chainSummary.remainingSec || 0));
    var chainPct = store.chainSummary.active && chainRem > 0
      ? Math.min(100, Math.round((chainRem / 300) * 100))
      : 0;

    var distTabsHtml = '<div class="zfw-district-pills">';
    for (var i = 0; i < store.districts.length; i++) {
      var d = store.districts[i];
      distTabsHtml +=
        '<button type="button" class="zfw-dist-tab" data-zfw-act="select-district" data-district="' + esc(d.id) + '" aria-pressed="' + (d.id === dist.id ? 'true' : 'false') + '">' +
          esc(ar ? d.nameAr : d.nameEn) + ' (<bdi>' + d.ownerControlPct + '%</bdi>)' +
        '</button>';
    }
    distTabsHtml += '</div>';

    var ctrlHtml = '<div class="zfw-ctrl-list">';
    var fKeys = Object.keys(FACTIONS);
    for (var fi = 0; fi < fKeys.length; fi++) {
      var fid = fKeys[fi];
      var fMeta = FACTIONS[fid];
      var pct = Math.max(0, Math.min(100, Number((dist.controlMap && dist.controlMap[fid]) || 0)));
      ctrlHtml +=
        '<div class="zfw-ctrl-row">' +
          '<span>' + esc(ar ? fMeta.ar : fMeta.en) + '</span>' +
          '<bdi style="text-align:end">' + pct + '%</bdi>' +
          '<div class="zfw-ctrl-track"><div class="zfw-ctrl-fill" style="width:' + pct + '%;background:' + esc(fMeta.color) + '"></div></div>' +
        '</div>';
    }
    ctrlHtml += '</div>';

    var eloHtml = '<div class="zfw-elo-strip">';
    for (var ei = 0; ei < store.eloStandings.length; ei++) {
      var er = store.eloStandings[ei];
      eloHtml +=
        '<div class="zfw-elo-card">' +
          '<strong>' + esc(ar ? er.nameAr : er.nameEn) + '</strong>' +
          '<span>ELO <bdi>' + er.eloRating + '</bdi> · ' + esc(er.mmrBand) + '</span>' +
        '</div>';
    }
    eloHtml += '</div>';

    var lobby = store.activeLobby;
    var slotsHtml = '<div class="zfw-slots-grid">';
    for (var si = 0; si < RAID_SLOTS.length; si++) {
      var sl = RAID_SLOTS[si];
      var occupant = lobby && lobby.slots ? lobby.slots[sl.id] : null;
      slotsHtml +=
        '<div class="zfw-slot-card' + (occupant ? ' is-filled' : '') + '">' +
          '<strong>' + esc(ar ? sl.ar : sl.en) + '</strong>' +
          (occupant
            ? '<span>' + esc(occupant.username) + ' <bdi>Lv.' + (occupant.level || 1) + '</bdi></span>'
            : '<button type="button" class="zfw-btn" data-zfw-act="join-slot" data-slot="' + esc(sl.id) + '"' + (!lobby || store.busy ? ' disabled' : '') + '>' + esc(ar ? 'انضم للمقعد' : 'Take Slot') + '</button>') +
        '</div>';
    }
    slotsHtml += '</div>';

    var matchBanner = store.activeMatch
      ? '<span class="zfw-pill" data-tone="blue">' + esc(ar ? 'الخصم المطابق: ' : 'Matched: ') + esc(ar ? store.activeMatch.opponentNameAr : store.activeMatch.opponentNameEn) + ' · <bdi>Δ' + store.activeMatch.eloGap + '</bdi></span>'
      : '';

    var fbHtml = store.feedback
      ? '<div class="zfw-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' + esc(ar ? store.feedback.ar : store.feedback.en) + '</div>'
      : '';

    return (
      '<div class="zfw-head">' +
        '<div class="zfw-title-wrap">' +
          '<span class="zfw-crest" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L20 6.5V17.5L12 22L4 17.5V6.5L12 2Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="#d99332"/></svg>' +
          '</span>' +
          '<div>' +
            '<h3 class="zfw-title">' + esc(ar ? 'شبكة حرب الأحياء الستة ومطابقة الغارات' : '6-District Territory War Network & Raid Lobby') + '</h3>' +
            '<p class="zfw-sub">' + esc(ar ? 'مزامنة دلتا حية · تعويض التأخير ±350ms · تصنيف ELO K=32' : 'Live Delta Sync · ±350ms Lag-Compensated Chain · ELO K=32 Matchmaker') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zfw-badges">' +
          '<span class="zfw-pill" data-tone="gold">Seq <bdi>#' + store.snapshotSeq + '</bdi>' + (store.deltaCompressed ? ' Δ' : '') + '</span>' +
          '<span class="zfw-pill" data-tone="' + (store.offlineMode ? 'crimson' : 'sage') + '">' + esc(store.offlineMode ? (ar ? 'معاينة محلية' : 'Preview Sync') : (ar ? 'متصل بالسيرفر' : 'Server Live')) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="zfw-chain-strip">' +
        '<div class="zfw-chain-top">' +
          '<span>' + esc(ar ? 'سلسلة الحرب المتزامنة' : 'Synced War Chain') + ': <bdi>x' + store.chainSummary.count + '</bdi> · <bdi>×' + store.chainSummary.multiplier + '</bdi></span>' +
          '<span class="zfw-pill" data-tone="' + (chainRem > 0 ? 'sage' : 'gold') + '">⏱ <bdi>' + fmtClock(chainRem) + '</bdi> · ±350ms</span>' +
        '</div>' +
        '<div class="zfw-chain-track"><div class="zfw-chain-fill" style="width:' + chainPct + '%"></div></div>' +
      '</div>' +
      '<div class="zfw-war-grid">' +
        '<div class="zfw-map-box">' +
          renderWargameSvgHtml(ar) +
          distTabsHtml +
        '</div>' +
        '<div class="zfw-inspector-box">' +
          '<div class="zfw-insp-head">' +
            '<h4 class="zfw-insp-name">' + esc(ar ? dist.nameAr : dist.nameEn) + '</h4>' +
            '<span class="zfw-pill" data-tone="gold">' + esc(ar ? 'درع: ' : 'Shield: ') + '<bdi>' + dist.fortifyShield + '%</bdi></span>' +
          '</div>' +
          '<p class="zfw-insp-perk">' + esc(ar ? dist.ownerNameAr : dist.ownerNameEn) + ' · ' + esc(ar ? dist.perkAr : dist.perkEn) + '</p>' +
          ctrlHtml +
          '<div class="zfw-action-row">' +
            '<button type="button" class="zfw-btn" data-variant="danger" data-zfw-act="assault"' + (store.busy || assCd > 0 ? ' disabled' : '') + '>' +
              esc(assCd > 0 ? ((ar ? 'هجوم (' : 'Assault (') + assCd + 's)') : (ar ? 'هجوم القطاع (15E)' : 'Assault Sector (15E)')) +
            '</button>' +
            '<button type="button" class="zfw-btn" data-variant="sage" data-zfw-act="fortify"' + (store.busy || fortCd > 0 ? ' disabled' : '') + '>' +
              esc(fortCd > 0 ? ((ar ? 'تحصين (' : 'Fortify (') + fortCd + 's)') : (ar ? 'تحصين القطاع (10E)' : 'Fortify Sector (10E)')) +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="zfw-lobby-box">' +
        '<div class="zfw-lobby-head">' +
          '<h4 class="zfw-insp-name">' + esc(ar ? 'لوبي الغارة (3 مقاعد) وتصنيف ELO' : 'ELO Matchmaking & 3-Slot Raid Lobby') + '</h4>' +
          '<div class="zfw-badges">' + matchBanner + '</div>' +
        '</div>' +
        eloHtml +
        slotsHtml +
        '<div class="zfw-action-row">' +
          '<button type="button" class="zfw-btn" data-variant="gold" data-zfw-act="matchmake"' + (store.busy ? ' disabled' : '') + '>' + esc(ar ? 'مطابقة ELO عادلة' : 'Find Fair ELO Match') + '</button>' +
          '<button type="button" class="zfw-btn" data-variant="sage" data-zfw-act="create-lobby"' + (store.busy ? ' disabled' : '') + '>' + esc(ar ? 'فتح غارة 3 مقاعد' : 'Create 3-Slot Raid Lobby') + '</button>' +
        '</div>' +
      '</div>' +
      fbHtml
    );
  }

  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    return main ? String(main.getAttribute('data-zone-screen') || 'home').toLowerCase() : '';
  }

  function removeMount() {
    var el = document.getElementById('zfw-warfare-root');
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  function renderMount() {
    if (document.querySelector && document.querySelector('x-dc')) return;
    var main = document.getElementById('zone-main');
    if (!main) return;

    var screen = getActiveScreen();
    if (screen !== 'faction' && screen !== 'family') {
      removeMount();
      return;
    }

    var root = document.getElementById('zfw-warfare-root');
    if (!root) {
      root = document.createElement('section');
      root.id = 'zfw-warfare-root';
      root.className = 'zfw-scope';
      root.setAttribute('data-zfw-screen', screen);
      main.appendChild(root);
    } else if (root.getAttribute('data-zfw-screen') !== screen) {
      root.setAttribute('data-zfw-screen', screen);
    }

    var nextHtml = renderHtml();
    if (root.__zfwLastHtml !== nextHtml) {
      root.__zfwLastHtml = nextHtml;
      root.innerHTML = nextHtml;
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zfw-act]') : null;
    if (!btn || btn.disabled) return;
    var act = btn.getAttribute('data-zfw-act');
    if (act === 'select-district') {
      store.selectedDistrict = btn.getAttribute('data-district') || 'center';
      emitCue('ui_nav', { district: store.selectedDistrict });
      renderMount();
    } else if (act === 'assault') {
      postWarAction('assault_sector', {
        district: store.selectedDistrict,
        lobbyId: store.activeLobby ? store.activeLobby.lobbyId : ''
      });
    } else if (act === 'fortify') {
      postWarAction('fortify_sector', { district: store.selectedDistrict });
    } else if (act === 'matchmake') {
      postWarAction('matchmake', { district: store.selectedDistrict });
    } else if (act === 'create-lobby') {
      postWarAction('create_raid_lobby', { district: store.selectedDistrict, slot: 'vanguard' });
    } else if (act === 'join-slot') {
      postWarAction('join_raid_lobby', {
        lobbyId: store.activeLobby ? store.activeLobby.lobbyId : '',
        slot: btn.getAttribute('data-slot') || ''
      });
    }
  });

  var syncQueued = false;
  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    var run = function () {
      syncQueued = false;
      var scr = getActiveScreen();
      if (scr === 'faction' || scr === 'family') {
        fetchWarState(false);
      }
      renderMount();
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function boot() {
    window.addEventListener('zone:render', scheduleSync);
    if (typeof MutationObserver === 'function' && document.documentElement) {
      var rootObs = new MutationObserver(scheduleSync);
      rootObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'dir', 'lang'] });

      var observed = null;
      var mainObs = null;
      var attachMain = function () {
        var m = document.getElementById('zone-main');
        if (!m || m === observed) return;
        if (mainObs) { try { mainObs.disconnect(); } catch (_) {} }
        observed = m;
        mainObs = new MutationObserver(function (recs) {
          for (var i = 0; i < recs.length; i++) {
            if (recs[i].type === 'attributes') { scheduleSync(); return; }
          }
        });
        mainObs.observe(m, { attributes: true, attributeFilter: ['data-zone-screen'] });
      };
      attachMain();
      window.addEventListener('zone:render', attachMain);
    }
    scheduleSync();
  }

  window.ZoneFactionWarfare = {
    refresh: function () { return fetchWarState(true); },
    render: renderMount,
    assaultSector: function (district) { return postWarAction('assault_sector', { district: district || store.selectedDistrict }); },
    fortifySector: function (district) { return postWarAction('fortify_sector', { district: district || store.selectedDistrict }); },
    createRaidLobby: function (district, slot, fillAllied) {
      return postWarAction('create_raid_lobby', { district: district || store.selectedDistrict, slot: slot || 'vanguard', fillAlliedSquad: Boolean(fillAllied) });
    },
    joinRaidLobby: function (lobbyId, slot) { return postWarAction('join_raid_lobby', { lobbyId: lobbyId, slot: slot }); },
    findMatch: function () { return postWarAction('matchmake', { district: store.selectedDistrict }); },
    resolveMatch: function (lobbyId) { return postWarAction('resolve_match', { lobbyId: lobbyId }); },
    computeEloDelta: computeEloDelta,
    getState: function () {
      return {
        selectedDistrict: store.selectedDistrict,
        playerFactionId: store.playerFactionId,
        snapshotSeq: store.snapshotSeq,
        districts: store.districts,
        eloStandings: store.eloStandings,
        activeLobby: store.activeLobby,
        activeMatch: store.activeMatch,
        chainSummary: store.chainSummary
      };
    },
    diagnostics: function () {
      return {
        ready: true,
        screen: getActiveScreen(),
        mounted: Boolean(document.getElementById('zfw-warfare-root')),
        offlineMode: store.offlineMode,
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

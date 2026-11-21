/* ==========================================================================
 * ZONE v157 - TRACK 10: 9-SLOT SET SYNERGIES, PERK DECK & CHARACTER CARD UI
 * Exclusive Ownership: @rpg-synergy-kit (assets/ui/zone-loadout-synergies.js)
 * Exposes: window.ZoneLoadoutSynergies
 * Mounts ONLY on:
 *   - screen === 'items':   #zls-items-panel beside [data-z3d-stage="paperdoll-armory"]
 *   - screen === 'dossier': #zls-dossier-panel inside dossier view
 * Zero mounts on 'home' or other routes. Fiber-Safe (skips inside <x-dc>).
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneLoadoutSynergiesBooted && window.ZoneLoadoutSynergies) return;
  window.__zoneLoadoutSynergiesBooted = true;

  var DECK_SLOT_COUNT = 3;
  var BASE_ENERGY_CAP = 5;

  var SET_ARCHETYPES = [
    {
      id: 'ghost_operative',
      nameEn: 'Ghost Operative',
      nameAr: 'شبح العمليات',
      element: 'Shadow',
      role: 'Infiltrator',
      tone: 'sage',
      crestAssetId: 'crest_ghost_operative',
      focusEn: 'Stealth & Crit',
      focusAr: 'التخفي والضربات الحرجة',
      bonus2En: '2pc: +10% Stealth Window · +6% Crit · -4 dB Noise',
      bonus2Ar: 'قطعتان: +10% نافذة التخفي · +6% حرج · -4 dB ضوضاء',
      bonus4En: '4pc: +22% Stealth Window · +15% Crit · -10 dB Noise',
      bonus4Ar: '٤ قطع: +22% نافذة التخفي · +15% حرج · -10 dB ضوضاء',
      itemsBySlot: {
        primary: ['sniper', 'smg', 'bullpup_1', 'bullpup_2', 'bullpup_3', 'bullpup_4'],
        secondary: ['pistol_t', 'pistol'],
        melee: ['knife', 'cut_throat_razor'],
        temporary: ['smoke_grenade'],
        head: ['paint_mask'],
        hands: ['armor']
      }
    },
    {
      id: 'iron_enforcer',
      nameEn: 'Iron Enforcer',
      nameAr: 'منفّذ الحديد',
      element: 'Steel',
      role: 'Vanguard',
      tone: 'crimson',
      crestAssetId: 'crest_iron_enforcer',
      focusEn: 'Armor & Melee',
      focusAr: 'الدروع والاشتباك',
      bonus2En: '2pc: +8% Armor Mitigation · +12% Melee Damage',
      bonus2Ar: 'قطعتان: +8% امتصاص الدرع · +12% ضرر الاشتباك',
      bonus4En: '4pc: +18% Armor Mitigation · +28% Melee Damage · +8% Riposte',
      bonus4Ar: '٤ قطع: +18% امتصاص الدرع · +28% ضرر الاشتباك · +8% رد مرتد',
      itemsBySlot: {
        primary: ['shotgun', 'assaultrifle_1', 'assaultrifle_2', 'assaultrifle_3', 'assaultrifle_4'],
        secondary: ['sawedoff'],
        melee: ['bat'],
        temporary: ['flash_grenade'],
        head: ['tac_helmet'],
        body: ['tac_plate'],
        hands: ['tac_gloves'],
        legs: ['tac_greaves'],
        feet: ['tac_boots']
      }
    },
    {
      id: 'cartel_sovereign',
      nameEn: 'Cartel Sovereign',
      nameAr: 'سيّد الكارتل',
      element: 'Gold',
      role: 'Broker',
      tone: 'gold',
      crestAssetId: 'crest_cartel_sovereign',
      focusEn: 'Mug & Bazaar Yield',
      focusAr: 'عوائد النشل والبازار',
      bonus2En: '2pc: +12% Mug Yield · -10% Bazaar Fee',
      bonus2Ar: 'قطعتان: +12% غنائم النشل · -10% عمولة البازار',
      bonus4En: '4pc: +25% Mug Yield · -25% Bazaar Fee · +10% Plunder',
      bonus4Ar: '٤ قطع: +25% غنائم النشل · -25% عمولة البازار · +10% سلب',
      itemsBySlot: {
        primary: ['ak', 'assaultrifle2_1', 'assaultrifle2_2', 'assaultrifle2_3', 'assaultrifle2_4'],
        secondary: ['magnum', 'revolver'],
        melee: ['cut_throat_razor'],
        body: ['vest'],
        legs: ['vest'],
        feet: ['armor']
      }
    },
    {
      id: 'chem_alchemist',
      nameEn: 'Chem Alchemist',
      nameAr: 'خيميائي المنشطات',
      element: 'Bio',
      role: 'Tactician',
      tone: 'blue',
      crestAssetId: 'crest_chem_alchemist',
      focusEn: 'Booster & Med Mastery',
      focusAr: 'إتقان المنشطات والإسعاف',
      bonus2En: '2pc: +15% Med Heal · +12% Booster Potency',
      bonus2Ar: 'قطعتان: +15% شفاء طبي · +12% فعالية المنشطات',
      bonus4En: '4pc: +32% Med Heal · +25% Booster Potency · -25% OD Risk',
      bonus4Ar: '٤ قطع: +32% شفاء طبي · +25% فعالية المنشطات · -25% خطر الجرعة',
      itemsBySlot: {
        temporary: ['epinephrine', 'smoke_grenade'],
        head: ['paint_mask'],
        body: ['armor'],
        hands: ['tac_gloves'],
        legs: ['armor']
      }
    }
  ];

  var PERK_CARDS = [
    {
      id: 'double_tap',
      nameEn: 'Double Tap',
      nameAr: 'ضربة مزدوجة',
      energyCost: 2,
      cardType: 'Attack',
      rarity: 'rare',
      archetype: 'ghost_operative',
      summaryEn: '+14% Weapon Damage · +12% Critical Chance',
      summaryAr: '+14% ضرر السلاح · +12% فرصة الحرج'
    },
    {
      id: 'smoke_vanish',
      nameEn: 'Smoke Vanish',
      nameAr: 'تلاشي الدخان',
      energyCost: 1,
      cardType: 'Skill',
      rarity: 'uncommon',
      archetype: 'ghost_operative',
      summaryEn: '+16% Stealth · +12% Evasion · -6 dB Noise',
      summaryAr: '+16% تخفٍ · +12% مراوغة · -6 dB ضوضاء'
    },
    {
      id: 'adrenaline_surge',
      nameEn: 'Adrenaline Surge',
      nameAr: 'اندفاع الأدرينالين',
      energyCost: 2,
      cardType: 'Power',
      rarity: 'rare',
      archetype: 'chem_alchemist',
      summaryEn: '+18% Booster Potency · +15% Med Heal · +8% Tempo',
      summaryAr: '+18% منشطات · +15% إسعاف · +8% سرعة'
    },
    {
      id: 'kevlar_ricochet',
      nameEn: 'Kevlar Ricochet',
      nameAr: 'ارتداد الكيفلر',
      energyCost: 2,
      cardType: 'Skill',
      rarity: 'uncommon',
      archetype: 'iron_enforcer',
      summaryEn: '+10% Armor · +15% Riposte · +10% Melee',
      summaryAr: '+10% درع · +15% رد مرتد · +10% اشتباك'
    },
    {
      id: 'blood_money',
      nameEn: 'Blood Money',
      nameAr: 'مال الدم',
      energyCost: 2,
      cardType: 'Power',
      rarity: 'rare',
      archetype: 'cartel_sovereign',
      summaryEn: '+18% Mug Yield · +12% Plunder Cash',
      summaryAr: '+18% عائد النشل · +12% سلب نقدي'
    },
    {
      id: 'clean_getaway',
      nameEn: 'Clean Getaway',
      nameAr: 'انسحاب نظيف',
      energyCost: 1,
      cardType: 'Skill',
      rarity: 'common',
      archetype: 'cartel_sovereign',
      summaryEn: '-12% Bazaar Fee · +10% Stealth · +16% Escape',
      summaryAr: '-12% عمولة البازار · +10% تخفٍ · +16% هروب'
    }
  ];

  var CARD_COMBOS = [
    { id: 'phantom_volley', cards: ['double_tap', 'smoke_vanish'], nameEn: 'Phantom Volley', nameAr: 'رشقة الشبح', bonusEn: '+10% Ambush Crit', bonusAr: '+10% حرج كمين' },
    { id: 'overclocked_burst', cards: ['double_tap', 'adrenaline_surge'], nameEn: 'Overclocked Burst', nameAr: 'انفجار محفّز', bonusEn: '+8% Dmg · +6% Tempo', bonusAr: '+8% ضرر · +6% سرعة' },
    { id: 'ghost_extraction', cards: ['smoke_vanish', 'clean_getaway'], nameEn: 'Ghost Extraction', nameAr: 'إجلاء الشبح', bonusEn: '+12% Escape · -4 dB', bonusAr: '+12% هروب · -4 dB' },
    { id: 'stim_plated_reflex', cards: ['adrenaline_surge', 'kevlar_ricochet'], nameEn: 'Stim-Plated Reflex', nameAr: 'منعكس الدرع المحفز', bonusEn: '+6% Armor · +10% Heal', bonusAr: '+6% درع · +10% شفاء' },
    { id: 'enforcer_toll', cards: ['kevlar_ricochet', 'blood_money'], nameEn: 'Enforcer Toll', nameAr: 'ضريبة المنفّذ', bonusEn: '+8% Riposte · +8% Mug', bonusAr: '+8% صد · +8% نشل' },
    { id: 'syndicate_skim', cards: ['blood_money', 'clean_getaway'], nameEn: 'Syndicate Skim', nameAr: 'اقتطاع النقابة', bonusEn: '-8% Fee · +10% Plunder', bonusAr: '-8% عمولة · +10% سلب' }
  ];

  var store = {
    busy: false,
    lastSyncAt: 0,
    serverData: null,
    deckSlots: [null, null, null],
    energyCap: BASE_ENERGY_CAP,
    feedback: null,
    telemetry: {
      apiCalls: 0,
      fallbackActions: 0,
      cardsEquipped: 0,
      setsPulsed: 0
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

  function findCard(cardId) {
    for (var i = 0; i < PERK_CARDS.length; i++) {
      if (PERK_CARDS[i].id === cardId) return PERK_CARDS[i];
    }
    return null;
  }

  function findArchetype(archId) {
    for (var i = 0; i < SET_ARCHETYPES.length; i++) {
      if (SET_ARCHETYPES[i].id === archId) return SET_ARCHETYPES[i];
    }
    return null;
  }

  function emitPaperdollBridge(action, sfxCue, detail) {
    var payload = detail || {};
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try { window.ZoneEcs3D.triggerStageAction('paperdoll-armory', action, payload); } catch (_) {}
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
      window.dispatchEvent(new CustomEvent('zone:synergy-event', {
        detail: { stage: 'paperdoll-armory', action: action, cue: sfxCue, payload: payload }
      }));
    } catch (_) {}
  }

  function getClientSlotsFromContext() {
    if (store.serverData && store.serverData.loadout && store.serverData.loadout.slots) {
      return store.serverData.loadout.slots;
    }
    var lv = window.__zoneLastView;
    if (lv && lv.factionEmpire && lv.factionEmpire.loadout && lv.factionEmpire.loadout.slots) {
      return lv.factionEmpire.loadout.slots;
    }
    var slots = {};
    var domCards = document.querySelectorAll('[data-loadout-slot]');
    for (var i = 0; i < domCards.length; i++) {
      var sl = domCards[i].getAttribute('data-loadout-slot');
      var sel = domCards[i].querySelector('select[data-slot]');
      if (sl && sel && sel.value) slots[sl] = sel.value;
    }
    return slots;
  }

  function getClientInvFromContext() {
    var lv = window.__zoneLastView;
    if (lv && lv.progression && lv.progression.inv) return lv.progression.inv;
    if (lv && lv.player && lv.player.inv) return lv.player.inv;
    return {};
  }

  function evaluateSetSynergies(slotsMap, invMap, rwMap) {
    var slots = slotsMap || getClientSlotsFromContext();
    var inv = invMap || getClientInvFromContext();
    var rw = rwMap || {};
    var sets = [];
    var domId = 'none';
    var domTier = 0;
    var domPieces = 0;

    for (var i = 0; i < SET_ARCHETYPES.length; i++) {
      var spec = SET_ARCHETYPES[i];
      var matched = [];
      for (var slotKey in spec.itemsBySlot) {
        if (!Object.prototype.hasOwnProperty.call(spec.itemsBySlot, slotKey)) continue;
        var eq = slots[slotKey];
        if (eq && spec.itemsBySlot[slotKey].indexOf(eq) >= 0) {
          matched.push({ slot: slotKey, itemId: eq });
        }
      }
      if (spec.id === 'cartel_sovereign') {
        var wSlots = ['primary', 'secondary', 'melee', 'temporary'];
        for (var w = 0; w < wSlots.length; w++) {
          var weq = slots[wSlots[w]];
          if (weq && rw[weq]) {
            var already = matched.some(function (m) { return m.slot === wSlots[w]; });
            if (!already) matched.push({ slot: wSlots[w], itemId: weq });
          }
        }
      }
      if (spec.id === 'chem_alchemist') {
        var meds = ['medkit', 'smallkit', 'bloodbag', 'morphine', 'pills'];
        var boosts = ['drink', 'energydrink', 'xanax', 'vicodin', 'cannabis', 'lsd'];
        for (var m = 0; m < meds.length; m++) {
          if (Number(inv[meds[m]] || 0) >= 1) { matched.push({ slot: 'stock_med', itemId: meds[m] }); break; }
        }
        for (var b = 0; b < boosts.length; b++) {
          if (Number(inv[boosts[b]] || 0) >= 1) { matched.push({ slot: 'stock_booster', itemId: boosts[b] }); break; }
        }
      }

      var pieces = matched.length;
      var tier = pieces >= 4 ? 4 : (pieces >= 2 ? 2 : 0);
      sets.push({
        id: spec.id,
        nameEn: spec.nameEn,
        nameAr: spec.nameAr,
        element: spec.element,
        role: spec.role,
        tone: spec.tone,
        crestAssetId: spec.crestAssetId,
        focusEn: spec.focusEn,
        focusAr: spec.focusAr,
        piecesCount: pieces,
        maxPieces: 4,
        tier: tier,
        matchedItems: matched,
        bonus2En: spec.bonus2En,
        bonus2Ar: spec.bonus2Ar,
        bonus4En: spec.bonus4En,
        bonus4Ar: spec.bonus4Ar
      });

      if (tier > domTier || (tier === domTier && pieces > domPieces && pieces > 0)) {
        domTier = tier;
        domPieces = pieces;
        domId = spec.id;
      }
    }

    return { sets: sets, dominantArchetype: domId, dominantTier: domTier };
  }

  function computeDeckEnergy(slots) {
    var sum = 0;
    for (var i = 0; i < slots.length; i++) {
      var c = slots[i] ? findCard(slots[i]) : null;
      if (c) sum += c.energyCost;
    }
    return sum;
  }

  function computeActiveCombos(slots) {
    var equipped = slots.filter(Boolean);
    var active = [];
    for (var i = 0; i < CARD_COMBOS.length; i++) {
      var cb = CARD_COMBOS[i];
      if (equipped.indexOf(cb.cards[0]) >= 0 && equipped.indexOf(cb.cards[1]) >= 0) {
        active.push(cb);
      }
    }
    return active;
  }

  function buildLocalCharacterCard(synergies, slots, energyUsed) {
    if (store.serverData && store.serverData.characterCard) {
      return store.serverData.characterCard;
    }
    var lv = window.__zoneLastView || {};
    var pl = lv.player || {};
    var username = String(pl.username || 'Operative');
    var level = Math.max(1, Number(pl.level || 1));
    var arch = findArchetype(synergies.dominantArchetype);
    var equippedCount = slots.filter(Boolean).length;
    var combos = computeActiveCombos(slots);

    var rarity = 'operative';
    if (synergies.dominantTier >= 4 && equippedCount >= 3 && combos.length >= 1) rarity = 'mythic';
    else if (synergies.dominantTier >= 4 || combos.length >= 2) rarity = 'legendary';
    else if (synergies.dominantTier >= 2 && (equippedCount >= 2 || combos.length >= 1)) rarity = 'epic';
    else if (synergies.dominantTier >= 2 || equippedCount >= 3) rarity = 'rare';

    var taglineEn = 'Street-tested Zone operative building tactical readiness across nine loadout slots.';
    var taglineAr = 'عميل ميداني في مدينة زون يبني جاهزيته عبر تسع خانات عتاد.';
    if (arch && arch.id === 'ghost_operative') {
      taglineEn = 'Silent pier infiltrator striking from blind spots before alarms can trigger.';
      taglineAr = 'متسلل صامت يضرب من النقاط العمياء قبل انطلاق أي إنذار.';
    } else if (arch && arch.id === 'iron_enforcer') {
      taglineEn = 'Armored vanguard holding narrow alleys with reinforced Kevlar and heavy steel.';
      taglineAr = 'طليعة مصفحة تحكم الأزقة بدرع الكيفلر والضربات الحاسمة.';
    } else if (arch && arch.id === 'cartel_sovereign') {
      taglineEn = 'Syndicate broker turning street territory and bazaar margins into steady leverage.';
      taglineAr = 'وسيط نقابي يحوّل السيطرة الميدانية وهوامش البازار إلى نفوذ دائم.';
    } else if (arch && arch.id === 'chem_alchemist') {
      taglineEn = 'Back-alley tactician calibrating trauma kits and stimulants for prolonged operations.';
      taglineAr = 'خبير ميداني يضبط المنشطات وحقائب الإسعاف للعمليات الطويلة.';
    }

    var clientSlots = getClientSlotsFromContext();
    var assets = [arch ? arch.crestAssetId : 'crest_operative_neutral'];
    for (var sk in clientSlots) {
      if (clientSlots[sk] && assets.indexOf(clientSlots[sk]) < 0) assets.push(clientSlots[sk]);
    }
    for (var ci = 0; ci < slots.length; ci++) {
      if (slots[ci]) assets.push('card_' + slots[ci]);
    }

    return {
      id: 'op-' + String(pl.id || 'founder-player'),
      name: username,
      rarity: rarity,
      element: arch ? arch.element : 'Neutral',
      role: arch ? arch.role : 'Operative',
      taglineEn: taglineEn,
      taglineAr: taglineAr,
      loreEn: 'Level ' + level + ' operative synchronized with ' + (arch ? arch.nameEn : 'Unaligned Syndicate') + ' doctrine. Carries ' + equippedCount + ' active tactical perk cards (' + energyUsed + '/' + store.energyCap + ' Energy) and ' + combos.length + ' deck combos.',
      loreAr: 'عميل من المستوى ' + level + ' متناغم مع عقيدة ' + (arch ? arch.nameAr : 'النقابة الحرة') + '. يحمل ' + equippedCount + ' بطاقات تكتيكية نشطة (' + energyUsed + '/' + store.energyCap + ' طاقة) و' + combos.length + ' تناغمات.',
      asset_ids: assets,
      stats: {
        level: level,
        activeArchetype: synergies.dominantArchetype,
        activeSetTier: synergies.dominantTier,
        deckEnergyUsed: energyUsed,
        deckEnergyCap: store.energyCap,
        comboCount: combos.length
      }
    };
  }

  /* ---------------- Backend API Sync + Graceful Offline Fallback ---------------- */
  async function fetchSynergies(force) {
    if (!force && (Date.now() - store.lastSyncAt) < 4000) return;
    store.lastSyncAt = Date.now();
    store.telemetry.apiCalls++;
    try {
      var res = await fetch('/api/v1/synergies', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      var data = await res.json();
      applyServerData(data);
    } catch (_) {
      // Static / guest mode seamlessly preserves deterministic client evaluation.
    }
  }

  function applyServerData(data) {
    if (!data || typeof data !== 'object') return;
    store.serverData = data;
    if (data.perkDeck && Array.isArray(data.perkDeck.slots)) {
      store.deckSlots = [
        data.perkDeck.slots[0] || null,
        data.perkDeck.slots[1] || null,
        data.perkDeck.slots[2] || null
      ];
      store.energyCap = Math.max(1, Number(data.perkDeck.energyCap || BASE_ENERGY_CAP));
    }
    renderActiveScreenMount();
  }

  async function equipCard(cardId, slotIndex) {
    if (store.busy) return null;
    var card = findCard(cardId);
    if (!card) return null;

    var slots = store.deckSlots.slice();
    if (slots.indexOf(cardId) >= 0) {
      store.feedback = {
        tone: 'gold',
        en: card.nameEn + ' is already equipped in your 3-slot deck.',
        ar: 'البطاقة «' + card.nameAr + '» مجهزة بالفعل في مجموعتك.'
      };
      renderActiveScreenMount();
      return null;
    }

    var targetIdx = typeof slotIndex === 'number' ? slotIndex : slots.indexOf(null);
    if (targetIdx < 0 || targetIdx >= DECK_SLOT_COUNT) {
      store.feedback = {
        tone: 'crimson',
        en: 'All 3 Perk Deck slots are occupied. Unequip one card first.',
        ar: 'جميع الخانات الـ3 ممتلئة. أزل بطاقة أولاً.'
      };
      emitPaperdollBridge('pulse', 'step_fail', { cardId: cardId });
      renderActiveScreenMount();
      return null;
    }

    var nextSlots = slots.slice();
    nextSlots[targetIdx] = cardId;
    var nextEnergy = computeDeckEnergy(nextSlots);
    if (nextEnergy > store.energyCap) {
      store.feedback = {
        tone: 'crimson',
        en: 'Energy cap exceeded (' + nextEnergy + '/' + store.energyCap + '). Choose a 1-cost skill or free a slot.',
        ar: 'تجاوزت حد الطاقة (' + nextEnergy + '/' + store.energyCap + '). اختر مهارة بتكلفة ١ أو أخْلِ خانة.'
      };
      emitPaperdollBridge('pulse', 'step_fail', { cardId: cardId, energy: nextEnergy });
      renderActiveScreenMount();
      return null;
    }

    store.busy = true;
    store.telemetry.cardsEquipped++;
    emitPaperdollBridge('equip', 'equip_snap', { cardId: cardId, slot: targetIdx });
    renderActiveScreenMount();

    try {
      store.telemetry.apiCalls++;
      var res = await fetch('/api/v1/synergies/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'synergy.equip_card', cardId: cardId, slot: targetIdx })
      });
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && data.ok) {
        applyServerData(data);
        if (data.result) {
          store.feedback = { tone: 'sage', en: data.result.summaryEn, ar: data.result.summaryAr };
        }
        return data;
      }
    } catch (_) {
      // Guest / offline fallback
    } finally {
      store.busy = false;
    }

    store.telemetry.fallbackActions++;
    store.deckSlots = nextSlots;
    var combos = computeActiveCombos(nextSlots);
    if (combos.length > 0) emitPaperdollBridge('upgrade', 'era_breakthrough', { combo: combos[0].id });
    store.feedback = {
      tone: 'sage',
      en: card.nameEn + ' slotted into Slot ' + (targetIdx + 1) + ' (' + nextEnergy + '/' + store.energyCap + ' Energy).',
      ar: 'تم تجهيز «' + card.nameAr + '» في الخانة ' + (targetIdx + 1) + ' (' + nextEnergy + '/' + store.energyCap + ' طاقة).'
    };
    renderActiveScreenMount();
    return { preview: true, slots: nextSlots };
  }

  async function unequipCard(slotOrCard) {
    if (store.busy) return null;
    var idx = typeof slotOrCard === 'number' ? slotOrCard : store.deckSlots.indexOf(String(slotOrCard));
    if (idx < 0 || idx >= DECK_SLOT_COUNT || !store.deckSlots[idx]) return null;

    var removedId = store.deckSlots[idx];
    store.busy = true;
    emitPaperdollBridge('pulse', 'ui_nav', { cardId: removedId, slot: idx });
    renderActiveScreenMount();

    try {
      store.telemetry.apiCalls++;
      var res = await fetch('/api/v1/synergies/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'synergy.unequip_card', slot: idx })
      });
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && data.ok) {
        applyServerData(data);
        if (data.result) {
          store.feedback = { tone: 'gold', en: data.result.summaryEn, ar: data.result.summaryAr };
        }
        return data;
      }
    } catch (_) {
      // Guest fallback
    } finally {
      store.busy = false;
    }

    store.telemetry.fallbackActions++;
    store.deckSlots[idx] = null;
    var nextEnergy = computeDeckEnergy(store.deckSlots);
    store.feedback = {
      tone: 'gold',
      en: 'Cleared Deck Slot ' + (idx + 1) + ' (' + nextEnergy + '/' + store.energyCap + ' Energy).',
      ar: 'تم إخلاء خانة البطاقة ' + (idx + 1) + ' (' + nextEnergy + '/' + store.energyCap + ' طاقة).'
    };
    renderActiveScreenMount();
    return { preview: true, slots: store.deckSlots.slice() };
  }

  async function setDeck(cards) {
    var arr = Array.isArray(cards) ? cards.slice(0, DECK_SLOT_COUNT) : [];
    while (arr.length < DECK_SLOT_COUNT) arr.push(null);
    if (computeDeckEnergy(arr) > store.energyCap) return null;
    store.deckSlots = arr;
    emitPaperdollBridge('upgrade', 'era_breakthrough', { deck: arr });
    renderActiveScreenMount();
    try {
      var res = await fetch('/api/v1/synergies/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'synergy.set_deck', cards: arr })
      });
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && data.ok) applyServerData(data);
      return data;
    } catch (_) {
      return { preview: true, slots: arr };
    }
  }

  /* ---------------- SVG Archetype Crests (`character-card` illustration) ---------------- */
  function renderArchetypeSvg(element) {
    if (element === 'Shadow') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 6L54 18V36C54 48 44 56 32 59C20 56 10 48 10 36V18L32 6Z" fill="rgba(109,153,73,0.18)" stroke="currentColor" stroke-width="2.2"/><path d="M18 32C23 24 27 21 32 21C37 21 41 24 46 32C41 40 37 43 32 43C27 43 23 40 18 32Z" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="#5c8e3e" stroke="currentColor" stroke-width="1.6"/></svg>';
    }
    if (element === 'Steel') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 14L32 7L50 14V34C50 47 41 55 32 58C23 55 14 47 14 34V14Z" fill="rgba(198,83,58,0.2)" stroke="currentColor" stroke-width="2.2"/><path d="M23 23L41 41M41 23L23 41" stroke="#c44933" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="5" fill="currentColor"/></svg>';
    }
    if (element === 'Gold') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><polygon points="32,7 55,22 47,54 17,54 9,22" fill="rgba(240,196,101,0.22)" stroke="currentColor" stroke-width="2.2"/><path d="M20 40L24 24L32 31L40 24L44 40H20Z" fill="#d99a38" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    if (element === 'Bio') {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="rgba(62,111,176,0.2)" stroke="currentColor" stroke-width="2.2"/><path d="M32 17V47M17 32H47" stroke="#4f85c9" stroke-width="4.5" stroke-linecap="round"/><circle cx="32" cy="32" r="6" fill="currentColor"/></svg>';
    }
    return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="rgba(217,154,56,0.14)" stroke="currentColor" stroke-width="2.2"/><path d="M32 14L37 27L50 32L37 37L32 50L27 37L14 32L27 27Z" stroke="currentColor" stroke-width="2"/></svg>';
  }

  /* ---------------- Renderers (EN + AR RTL) ---------------- */
  function renderSetMeterHtml(synergies, ar) {
    var html = '<div class="zls-block"><div class="zls-block-head">' +
      '<h4 class="zls-block-title">' + esc(ar ? 'مقياس تناغم أطقم الـ9 خانات' : '9-Slot Syndicate Gear Set Synergy Meter') + '</h4>' +
      '<span class="zls-pill" data-tone="' + (synergies.dominantTier >= 4 ? 'gold' : (synergies.dominantTier >= 2 ? 'sage' : 'blue')) + '">' +
        (synergies.dominantTier >= 2
          ? esc((ar ? 'طقم نشط: ' : 'Active: ') + (ar ? findArchetype(synergies.dominantArchetype).nameAr : findArchetype(synergies.dominantArchetype).nameEn) + ' (' + synergies.dominantTier + 'pc)')
          : esc(ar ? 'جهّز قطعتين لتفعيل التناغم' : 'Equip 2pc or 4pc to activate')) +
      '</span></div><div class="zls-sets-grid">';

    for (var i = 0; i < synergies.sets.length; i++) {
      var s = synergies.sets[i];
      var pips = '';
      for (var p = 1; p <= 4; p++) {
        pips += '<span class="zls-meter-pip' + (p <= s.piecesCount ? ' is-filled' : '') + '" data-tone="' + esc(s.tone) + '"></span>';
      }
      var bonusTxt = s.tier >= 4
        ? (ar ? s.bonus4Ar : s.bonus4En)
        : (ar ? s.bonus2Ar : s.bonus2En);
      html +=
        '<button type="button" class="zls-set-card' + (s.tier >= 2 ? ' is-active' : '') + '" data-zls-act="pulse-set" data-set="' + esc(s.id) + '">' +
          '<div class="zls-set-top">' +
            '<span class="zls-set-name">' + esc(ar ? s.nameAr : s.nameEn) + '</span>' +
            '<span class="zls-pill" data-tone="' + esc(s.tier >= 2 ? s.tone : 'blue') + '"><bdi>' + s.piecesCount + '/4</bdi>' + (s.tier >= 2 ? (' · <bdi>' + s.tier + 'pc</bdi>') : '') + '</span>' +
          '</div>' +
          '<div class="zls-meter-track">' + pips + '</div>' +
          '<div class="zls-set-bonus' + (s.tier >= 2 ? ' is-unlocked' : '') + '">' + esc(bonusTxt) + '</div>' +
        '</button>';
    }
    html += '</div></div>';
    return html;
  }

  function renderDeckBuilderHtml(ar) {
    var used = computeDeckEnergy(store.deckSlots);
    var combos = computeActiveCombos(store.deckSlots);
    var ePips = '';
    for (var e = 1; e <= store.energyCap; e++) {
      ePips += '<span class="zls-e-pip' + (e <= used ? ' is-on' : '') + '"></span>';
    }

    var slotsHtml = '<div class="zls-deck-slots">';
    for (var s = 0; s < DECK_SLOT_COUNT; s++) {
      var cid = store.deckSlots[s];
      var card = cid ? findCard(cid) : null;
      if (card) {
        slotsHtml +=
          '<div class="zls-slot-box is-filled" data-zls-slot="' + s + '">' +
            '<div class="zls-slot-head"><span>' + esc(ar ? ('خانة ' + (s + 1)) : ('SLOT ' + (s + 1))) + '</span><span class="zls-pill" data-tone="gold"><bdi>' + card.energyCost + '⚡</bdi></span></div>' +
            '<div class="zls-slot-title">' + esc(ar ? card.nameAr : card.nameEn) + '</div>' +
            '<div class="zls-slot-meta">' + esc(ar ? card.summaryAr : card.summaryEn) + '</div>' +
            '<button type="button" class="zls-btn" data-tone="crimson" data-zls-act="unequip-card" data-slot="' + s + '"' + (store.busy ? ' disabled' : '') + '>' + esc(ar ? 'إزالة' : 'Unequip') + '</button>' +
          '</div>';
      } else {
        slotsHtml +=
          '<div class="zls-slot-box" data-zls-slot="' + s + '">' +
            '<div class="zls-slot-head"><span>' + esc(ar ? ('خانة ' + (s + 1)) : ('SLOT ' + (s + 1))) + '</span><span>0⚡</span></div>' +
            '<div class="zls-slot-meta">' + esc(ar ? 'اختر بطاقة تكتيكية من المجموعة أدناه' : 'Select a tactical perk card below') + '</div>' +
          '</div>';
      }
    }
    slotsHtml += '</div>';

    var combosHtml = '';
    if (combos.length) {
      combosHtml = '<div class="zls-combos-strip">';
      for (var cbi = 0; cbi < combos.length; cbi++) {
        var cb = combos[cbi];
        combosHtml += '<span class="zls-pill" data-tone="plum">★ ' + esc(ar ? cb.nameAr : cb.nameEn) + ' · ' + esc(ar ? cb.bonusAr : cb.bonusEn) + '</span>';
      }
      combosHtml += '</div>';
    }

    var poolHtml = '<div class="zls-pool-grid">';
    var full = store.deckSlots.indexOf(null) < 0;
    for (var i = 0; i < PERK_CARDS.length; i++) {
      var pc = PERK_CARDS[i];
      var isEq = store.deckSlots.indexOf(pc.id) >= 0;
      var wouldExceed = !isEq && ((used + pc.energyCost) > store.energyCap);
      var btnDisabled = store.busy || (!isEq && (full || wouldExceed));
      poolHtml +=
        '<div class="zls-card-tile' + (isEq ? ' is-equipped' : '') + '" data-zls-card="' + esc(pc.id) + '">' +
          '<div class="zls-card-head">' +
            '<div><div class="zls-card-name">' + esc(ar ? pc.nameAr : pc.nameEn) + '</div><div class="zls-card-type">' + esc(pc.cardType + ' · ' + pc.rarity) + '</div></div>' +
            '<span class="zls-pill" data-tone="gold"><bdi>' + pc.energyCost + '⚡</bdi></span>' +
          '</div>' +
          '<div class="zls-card-desc">' + esc(ar ? pc.summaryAr : pc.summaryEn) + '</div>' +
          (isEq
            ? '<button type="button" class="zls-btn" data-tone="crimson" data-zls-act="unequip-card" data-card="' + esc(pc.id) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(ar ? 'مجهّزة (إزالة)' : 'Equipped (Remove)') + '</button>'
            : '<button type="button" class="zls-btn" data-tone="sage" data-zls-act="equip-card" data-card="' + esc(pc.id) + '"' + (btnDisabled ? ' disabled' : '') + '>' + esc(wouldExceed ? (ar ? 'طاقة غير كافية' : 'Over Cap') : (ar ? 'تجهيز البطاقة' : 'Equip Card')) + '</button>') +
        '</div>';
    }
    poolHtml += '</div>';

    return '<div class="zls-block">' +
      '<div class="zls-block-head">' +
        '<h4 class="zls-block-title">' + esc(ar ? 'مجموعة البطاقات التكتيكية (٣ خانات)' : '3-Slot Roguelike Tactical Perk Deck') + '</h4>' +
        '<div class="zls-energy-bar"><span class="zls-energy-pips">' + ePips + '</span><span class="zls-pill" data-tone="gold"><bdi>' + used + '/' + store.energyCap + ' ⚡</bdi></span></div>' +
      '</div>' +
      slotsHtml + combosHtml + poolHtml +
    '</div>';
  }

  function renderCharacterCardHtml(card, ar) {
    var assetsHtml = '';
    var list = Array.isArray(card.asset_ids) ? card.asset_ids : [];
    for (var i = 0; i < Math.min(8, list.length); i++) {
      assetsHtml += '<span class="zls-asset-tag">' + esc(list[i]) + '</span>';
    }
    return (
      '<div class="zls-block">' +
        '<div class="zls-block-head">' +
          '<h4 class="zls-block-title">' + esc(ar ? 'بطاقة العميل المصوّرة' : 'Illustrated Operative Character Card') + '</h4>' +
          '<span class="zls-pill" data-tone="plum">' + esc(card.element + ' · ' + card.role) + '</span>' +
        '</div>' +
        '<div class="zls-op-card" data-zls-character-card="' + esc(card.id) + '">' +
          '<div class="zls-op-portrait">' +
            renderArchetypeSvg(card.element) +
            '<span class="zls-pill zls-op-rarity" data-tone="' + (card.rarity === 'mythic' || card.rarity === 'legendary' ? 'gold' : 'sage') + '">' + esc(card.rarity) + '</span>' +
          '</div>' +
          '<div class="zls-op-body">' +
            '<div class="zls-op-head">' +
              '<h5 class="zls-op-name">' + esc(card.name) + '</h5>' +
              '<span class="zls-pill" data-tone="blue">Lv <bdi>' + Number((card.stats && card.stats.level) || 1) + '</bdi> · Set <bdi>' + Number((card.stats && card.stats.activeSetTier) || 0) + 'pc</bdi></span>' +
            '</div>' +
            '<p class="zls-op-tagline">' + esc(ar ? card.taglineAr : card.taglineEn) + '</p>' +
            '<p class="zls-op-lore">' + esc(ar ? card.loreAr : card.loreEn) + '</p>' +
            '<div class="zls-op-assets">' + assetsHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPanelHtml(screen) {
    var ar = isAr();
    var synergies = (store.serverData && store.serverData.synergies)
      ? {
          sets: store.serverData.synergies.sets || evaluateSetSynergies().sets,
          dominantArchetype: store.serverData.synergies.dominantArchetype || 'none',
          dominantTier: Number(store.serverData.synergies.dominantTier || 0)
        }
      : evaluateSetSynergies();
    var used = computeDeckEnergy(store.deckSlots);
    var card = buildLocalCharacterCard(synergies, store.deckSlots, used);
    var fbHtml = store.feedback
      ? '<div class="zls-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' + esc(ar ? store.feedback.ar : store.feedback.en) + '</div>'
      : '';

    var body = screen === 'dossier'
      ? (renderCharacterCardHtml(card, ar) + renderSetMeterHtml(synergies, ar) + renderDeckBuilderHtml(ar))
      : (renderSetMeterHtml(synergies, ar) + renderDeckBuilderHtml(ar) + renderCharacterCardHtml(card, ar));

    return (
      '<div class="zls-head">' +
        '<div class="zls-title-wrap">' +
          '<span class="zls-crest-badge" aria-hidden="true">' + renderArchetypeSvg(card.element) + '</span>' +
          '<div>' +
            '<h3 class="zls-title">' + esc(ar ? 'تناغم الأطقم ومجموعة المزايا التكتيكية' : 'Set Synergies, Tactical Perk Deck & Operative Card') + '</h3>' +
            '<p class="zls-sub">' + esc(ar ? 'مربوطة بخانات الورق الـ9 مع محرك العتاد ثلاثي الأبعاد' : 'Synced across your 9-slot Paperdoll Armory & 3-Card Perk Deck') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zls-pills">' +
          '<span class="zls-pill" data-tone="gold"><bdi>' + used + '/' + store.energyCap + ' ⚡</bdi></span>' +
          '<span class="zls-pill" data-tone="sage">' + esc(card.rarity.toUpperCase()) + '</span>' +
        '</div>' +
      '</div>' +
      body + fbHtml
    );
  }

  /* ---------------- Route-Scoped Mounts (ONLY 'items' and 'dossier') ---------------- */
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
    if (screen !== 'items' && screen !== 'dossier') {
      removeIfPresent('zls-items-panel');
      removeIfPresent('zls-dossier-panel');
      return;
    }

    var targetId = screen === 'items' ? 'zls-items-panel' : 'zls-dossier-panel';
    removeIfPresent(screen === 'items' ? 'zls-dossier-panel' : 'zls-items-panel');

    var panel = document.getElementById(targetId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = targetId;
      panel.className = 'zls-scope';
      panel.setAttribute('data-zls-mounted', screen);
    }

    if (screen === 'items') {
      var armoryStage = main.querySelector('[data-z3d-stage="paperdoll-armory"]');
      if (armoryStage && armoryStage.parentElement) {
        if (armoryStage.nextElementSibling !== panel) {
          armoryStage.insertAdjacentElement('afterend', panel);
        }
      } else if (!panel.parentElement) {
        main.appendChild(panel);
      }
    } else {
      var dossierAnchor = main.querySelector('.zone-dossier-card, .zone-dossier-deck, .zone-dossier-actions');
      if (dossierAnchor && dossierAnchor.parentElement) {
        if (dossierAnchor.nextElementSibling !== panel) {
          dossierAnchor.insertAdjacentElement('afterend', panel);
        }
      } else if (!panel.parentElement) {
        main.appendChild(panel);
      }
    }

    var html = renderPanelHtml(screen);
    if (panel.__zlsLastHtml !== html) {
      panel.__zlsLastHtml = html;
      panel.innerHTML = html;
    }
  }

  /* ---------------- Delegated Clicks & Route Observer ---------------- */
  document.addEventListener('click', function (ev) {
    var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zls-act]') : null;
    if (!target || target.disabled) return;
    var act = target.getAttribute('data-zls-act');
    if (act === 'equip-card') {
      ev.preventDefault();
      equipCard(target.getAttribute('data-card') || '');
    } else if (act === 'unequip-card') {
      ev.preventDefault();
      var slotAttr = target.getAttribute('data-slot');
      var cardAttr = target.getAttribute('data-card');
      unequipCard(slotAttr !== null && slotAttr !== '' ? Number(slotAttr) : (cardAttr || ''));
    } else if (act === 'pulse-set') {
      ev.preventDefault();
      var setId = target.getAttribute('data-set') || 'ghost_operative';
      store.telemetry.setsPulsed++;
      emitPaperdollBridge('equip', 'equip_snap', { archetype: setId });
    }
  });

  var syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    var run = function () {
      syncScheduled = false;
      var scr = getActiveScreen();
      if (scr === 'items' || scr === 'dossier') {
        fetchSynergies(false);
      }
      renderActiveScreenMount();
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function boot() {
    window.addEventListener('zone:render', scheduleSync);
    window.addEventListener('zone:ecs-3d-ready', scheduleSync);

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
        if (mainObs) { try { mainObs.disconnect(); } catch (_) {} }
        observedMain = m;
        mainObs = new MutationObserver(function (records) {
          for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (r.type === 'attributes') { scheduleSync(); return; }
            if (r.type === 'childList' && r.target === m) {
              for (var n = 0; n < r.addedNodes.length; n++) {
                var nd = r.addedNodes[n];
                if (nd && nd.nodeType === 1 && nd.id !== 'zls-items-panel' && nd.id !== 'zls-dossier-panel') {
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
      if (!observedMain) {
        var tries = 0;
        var poll = setInterval(function () {
          tries += 1;
          attachMain();
          if (observedMain || tries >= 40) {
            clearInterval(poll);
            if (observedMain) scheduleSync();
          }
        }, 150);
      }
      window.addEventListener('zone:render', attachMain);
    }

    scheduleSync();
  }

  window.ZoneLoadoutSynergies = {
    refresh: function () { return fetchSynergies(true); },
    render: renderActiveScreenMount,
    equipCard: equipCard,
    unequipCard: unequipCard,
    setDeck: setDeck,
    evaluateSetSynergies: evaluateSetSynergies,
    getState: function () {
      return {
        deckSlots: store.deckSlots.slice(),
        energyCap: store.energyCap,
        energyUsed: computeDeckEnergy(store.deckSlots),
        serverData: store.serverData
      };
    },
    diagnostics: function () {
      var syn = evaluateSetSynergies();
      return {
        ready: true,
        screen: getActiveScreen(),
        itemsMounted: Boolean(document.getElementById('zls-items-panel')),
        dossierMounted: Boolean(document.getElementById('zls-dossier-panel')),
        energyUsed: computeDeckEnergy(store.deckSlots),
        energyCap: store.energyCap,
        dominantArchetype: syn.dominantArchetype,
        dominantTier: syn.dominantTier,
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

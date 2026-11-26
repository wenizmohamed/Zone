/* ==========================================================================
 * ZONE v156 - GEMINI BATCH API LIVEOPS, ITEM PROVENANCE & RUMOR WIRE BRIDGE
 * Exclusive Ownership: @batch-api-engine (assets/ui/zone-batch-liveops.js)
 * Global Public Handle: window.ZoneBatchLiveOps
 *
 * Zero-Clutter Bilingual (EN + AR RTL) Enhancement powered by
 * `assets/data/zone-batch-skill-pack.json` (40+ game-dev SKILL.md handbooks
 * synthesized via Gemini Batch API 50% discount):
 *   1. 3D Item Provenance & Black-Market Lore (item-provenance + loot-audit):
 *      Enriches `.z3d-inspector-modal` & `screen === 'items'` `.zone-item-inspector`.
 *   2. Underworld Rumor Wire & Factional Intel (rumor-weaver + newspaper + lore-link-audit):
 *      Enriches `screen === 'newspaper'` & `screen === 'city'` across all 6 districts.
 *   3. Quest Hub & Syndicate Flash Contracts (quest-hub-stitcher + dialogue-crafting + voice-bible):
 *      Enriches `screen === 'missions'` + Luna / Mayor Tariq tactical comms.
 *
 * Layout & Safety Invariants:
 *   - 0px impact on Home `#zig-home-arcade` #1 placement (never mounts on Home).
 *   - 0px horizontal overflow at 390px mobile in both LTR and RTL (dir="rtl").
 *   - 100% <x-dc> Fiber-safe: append-only mounts, never mutates or removes <x-dc> nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.ZoneBatchLiveOps && window.ZoneBatchLiveOps.__booted) return;

  var PACK_URL = './assets/data/zone-batch-skill-pack.json?v=156';
  var DISTRICTS = [
    { id: 'all', en: 'All Districts', ar: 'كل الأحياء' },
    { id: 'north', en: 'North Harbor', ar: 'المرفأ الشمالي' },
    { id: 'fin', en: 'Financial Citadel', ar: 'القلعة المالية' },
    { id: 'res', en: 'East Safehouse', ar: 'حي المخابئ' },
    { id: 'red', en: 'Crimson Foundry', ar: 'المسبك القرمزي' },
    { id: 'west', en: 'West Neon Strip', ar: 'شارع النيون' },
    { id: 'center', en: 'Syndicate Plaza', ar: 'ساحة النقابة' }
  ];

  var COPY = {
    en: {
      provBadge: 'SYNDICATE PROVENANCE',
      makerLabel: 'Maker',
      tierLabel: 'Craft Tier',
      synergyLabel: 'Tactical Synergy',
      rumorLabel: 'Street Whisper',
      wireTitle: 'Zone Observer · Underworld Rumor Wire',
      wireSub: 'Factional intel, heat advisories & smuggling windows across all 6 districts',
      heatLabel: 'Heat Advisory',
      smuggleLabel: 'Smuggling Window',
      nextRumorBtn: 'Next Wire',
      goBtn: 'Move Out',
      questTitle: 'Syndicate Flash Contracts & Tactical Comms',
      questSub: 'Multi-branch operational briefings from Luna & Mayor Tariq',
      speakerLuna: 'LUNA · TACTICAL OPS',
      speakerTariq: 'MAYOR TARIQ · THE OWL',
      branchHintLabel: 'Tactical Edge',
      nextCommBtn: 'Cycle Comms',
      batchTag: 'BATCH INTEL'
    },
    ar: {
      provBadge: 'أصل النقابة والسوق السوداء',
      makerLabel: 'المُصنّع',
      tierLabel: 'فئة الحرفة',
      synergyLabel: 'التآزر التكتيكي',
      rumorLabel: 'همس الشارع',
      wireTitle: 'مرصد زون · شبكة إشاعات العالم السفلي',
      wireSub: 'استخبارات الفصائل وتحذيرات الحرارة ونوافذ التهريب عبر الأحياء الستة',
      heatLabel: 'تحذير الحرارة',
      smuggleLabel: 'نافذة التهريب',
      nextRumorBtn: 'الخبر التالي',
      goBtn: 'تحرك الآن',
      questTitle: 'عقود النقابة الخاطفة والاتصالات التكتيكية',
      questSub: 'إيجازات عمليات متعددة المسارات من لونا والعمدة طارق',
      speakerLuna: 'لونا · العمليات التكتيكية',
      speakerTariq: 'العمدة طارق · البومة',
      branchHintLabel: 'الميزة التكتيكية',
      nextCommBtn: 'بدّل الإشارة',
      batchTag: 'استخبارات الدفعة'
    }
  };

  var state = {
    pack: null,
    loading: false,
    loaded: false,
    activeDistrict: 'all',
    rumorIndex: 0,
    commIndex: 0,
    selectedBranches: {},
    lastModalItemId: '',
    lastInspectorKey: '',
    mounts: {
      modalProvenance: false,
      itemInspector: false,
      rumorWire: false,
      questHub: false
    }
  };

  function isArabic() {
    var html = document.documentElement;
    if (html && (html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0)) {
      return true;
    }
    var g = window.__zoneGame;
    return Boolean(g && g.state && g.state.lang === 'ar');
  }

  function t() {
    return isArabic() ? COPY.ar : COPY.en;
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    if (main) {
      var attr = main.getAttribute('data-zone-screen');
      if (attr) return String(attr).toLowerCase();
    }
    var g = window.__zoneGame;
    if (g && g.state && g.state.screen) return String(g.state.screen).toLowerCase();
    return '';
  }

  function navigateScreen(screen) {
    if (!screen) return false;
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(screen);
      return true;
    }
    var navBtn = document.querySelector('button[data-zone-screen="' + screen + '"]');
    if (navBtn && typeof navBtn.click === 'function') {
      navBtn.click();
      return true;
    }
    return false;
  }

  var BESPOKE_PROVENANCE_V163 = {
    roulette_wheel: {
      originEn: 'Hand-turned mahogany & champagne-brass 37-pocket European cylinder commissioned by Luna for the House of Obsidian VIP Salon.',
      originAr: 'أسطوانة روليت أوروبية ذات ٣٧ خانة من الماهوغاني والنحاس الذهبي صممتها لونا لصالون الأوبسيديان.',
      makerEn: 'Atelier Monte-Carlo · Pier 4',
      makerAr: 'مشغل مونت كارلو · الرصيف ٤',
      craftTier: 'Sovereign-Salon',
      craftTierAr: 'صالون سيادي',
      auditTag: '2.70%-uniform-edge',
      synergyEn: 'Supports Voisins du Zero, Tiers du Cylindre, Orphelins, Jeu Zero & 35:1 Straight-Up.',
      synergyAr: 'يدعم جيران الصفر وثلث الأسطوانة والأيتام والرقم المباشر ٣٥:١.'
    },
    slot_machine: {
      originEn: 'Art-Deco mechanical 3-drum jackpot cabinet with ruby clearcoat pull-arm lever and progressive pool sync.',
      originAr: 'ماكينة الجائزة الكبرى الميكانيكية ثلاثية البكرات بذراع ياقوتي متصلة بالوعاء التراكمي.',
      makerEn: 'Obsidian Mint Works',
      makerAr: 'دار سك الأوبسيديان',
      craftTier: 'Sovereign-Salon',
      craftTierAr: 'صالون سيادي',
      auditTag: 'progressive-pool',
      synergyEn: 'Feeds 12% of every spin into the city-wide progressive jackpot.',
      synergyAr: 'تغذي الجائزة الكبرى التراكمية للمدينة مع كل دورة.'
    },
    armored_van: {
      originEn: 'Up-armored Pier 4 bullion carrier with ballistic cab plates, twin roof beacons, and reinforced ram bar.',
      originAr: 'ناقلة سبائك مدرعة من الرصيف ٤ بدروع باليستية ومنارات سقفية ومصد اقتحام ذهبي.',
      makerEn: 'Pier 4 Heavy Forge',
      makerAr: 'مسبك الرصيف ٤ الثقيل',
      craftTier: 'Armored-Fleet',
      craftTierAr: 'أسطول مصفح',
      auditTag: '94-armor-rating',
      synergyEn: 'Maximizes bullion cargo survival through high-heat police corridors.',
      synergyAr: 'أعلى تدريع لنقل الغنائم عبر الممرات عالية المراقبة.'
    },
    interceptor_sedan: {
      originEn: 'Twin-turbo AWD midnight pursuit sedan tuned for stealth corridor runs and high-speed intercept.',
      originAr: 'سيدان مطاردة دفع كلي مزدوجة التيربو مضبوطة للاختراق الليلي السريع.',
      makerEn: 'Apex Skunkworks',
      makerAr: 'مختبرات أبيكس',
      craftTier: 'Pursuit-Spec',
      craftTierAr: 'فئة مطاردة',
      auditTag: '760hp-awd',
      synergyEn: 'Cuts district transit times while holding 0.9G lateral grip.',
      synergyAr: 'تقلص زمن العبور بين الأحياء مع ثبات جانبي فائق.'
    },
    edu_bio: {
      originEn: 'Sovereign brass & sapphire compound microscope paired with an illuminated 8-rung DNA double-helix calibrator.',
      originAr: 'مجهر مركب من النحاس والياقوت الأزرق مقترن بمعاير شريط الحمض النووي المزدوج.',
      makerEn: 'Zone University · Bio-Lab',
      makerAr: 'جامعة زون · مختبر الأحياء',
      craftTier: 'Faculty-Masterpiece',
      craftTierAr: 'تحفة أكاديمية',
      auditTag: '+50-max-life-revive',
      synergyEn: 'Unlocks hospital blood-bag synthesis and cuts player revive cost to 25E.',
      synergyAr: 'يفتح تصنيع أكياس الدم ويخفض تكلفة إنعاش العملاء إلى ٢٥ طاقة.'
    },
    edu_cs: {
      originEn: 'Obsidian 4-blade quantum cyber-deck mainframe projecting an encrypted floating holographic keyspace.',
      originAr: 'منصة اختراق كمومية من الأوبسيديان بأربع شفرات تعرض مصفوفة تشفير ثلاثية الأبعاد.',
      makerEn: 'Citadel Cyber-Forensics',
      makerAr: 'مختبر الأدلة السيبرانية',
      craftTier: 'Quantum-Spec',
      craftTierAr: 'فئة كمومية',
      auditTag: '+10%-skimming-cracking',
      synergyEn: 'Boosts Card Skimming & Vault Cracking precision across Crimes 2.0.',
      synergyAr: 'يرفع نسبة نجاح نسخ البطاقات وكسر الشفرات في الجرائم المتقدمة.'
    },
    edu_law: {
      originEn: 'Hand-balanced 24K brass Scales of Justice paired with a clearcoat mahogany courtroom gavel.',
      originAr: 'ميزان عدالة من النحاس الذهبي عيار ٢٤ مع مطرقة محكمة من الماهوغاني المصقول.',
      makerEn: 'High Court Chambers',
      makerAr: 'دائرة القضاء الجنائي',
      craftTier: 'Juris-Sovereign',
      craftTierAr: 'سيادة قانونية',
      auditTag: '-15%-jail-duration',
      synergyEn: 'Slashes sentence duration and boosts high-tier Crimes 2.0 unique loot.',
      synergyAr: 'يقلص مدة الاحتجاز ويرفع فرص الغنائم النادرة في العمليات.'
    },
    edu_command: {
      originEn: 'Obsidian & 24K gold Sovereign Chess King sculpted for Faction Warlords and Organized Crime masterminds.',
      originAr: 'قطعة الملك السيادية من الأوبسيديان والذهب الخالص لقادة العائلات والعقول المدبرة.',
      makerEn: 'Syndicate War College',
      makerAr: 'كلية حرب النقابة',
      craftTier: 'Apex-Command',
      craftTierAr: 'قيادة عليا',
      auditTag: '+oc-payout-respect',
      synergyEn: 'Amplifies Organized Crime 2.0 payouts and Faction Respect yield.',
      synergyAr: 'يضاعف عوائد الجرائم المنظمة ونقاط احترام العائلة.'
    }
  };

  function inferItemId(rawName, rawMeta) {
    var direct = String(rawName || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
    if (BESPOKE_PROVENANCE_V163[direct]) return direct;
    if (state.pack && state.pack.itemProvenance && state.pack.itemProvenance[direct]) {
      return direct;
    }
    var hay = (String(rawName || '') + ' ' + String(rawMeta || '')).toLowerCase();
    if (/roulette|روليت/.test(hay)) return 'roulette_wheel';
    if (/slot|jackpot|ماكينة/.test(hay)) return 'slot_machine';
    if (/armored van|bullion.*van|فان الميناء/.test(hay)) return 'armored_van';
    if (/interceptor|أبيكس/.test(hay)) return 'interceptor_sedan';
    if (/شفرة|razor/.test(hay)) return 'cut_throat_razor';
    if (/عتلة|crowbar|pry/.test(hay)) return 'crowbar';
    if (/أقفال|lockpick/.test(hay)) return 'lockpick';
    if (/مثقاب|drill/.test(hay)) return 'drill';
    if (/اختراق|cyberdeck|hacking|laptop/.test(hay)) return 'hacking_rig';
    if (/مفتاح|بطاقة دخول|keycard|rfid/.test(hay)) return 'keycard';
    if (/ناسخ بطاقات|skimmer/.test(hay)) return 'skimmer';
    if (/كلاشنكوف|\bak\b/.test(hay)) return 'ak';
    if (/بولباب|bullpup/.test(hay)) return 'bullpup_2';
    if (/قنّاص|قناص|dragunov|sniper/.test(hay)) return 'sniper';
    if (/مقصوصة|sawed/.test(hay)) return 'sawedoff';
    if (/خرطوش|shotgun/.test(hay)) return 'shotgun';
    if (/رشاش|smg|submachine/.test(hay)) return 'smg';
    if (/دوّار|دوار|revolver|magnum/.test(hay)) return 'revolver';
    if (/مسدس|glock|pistol/.test(hay)) return 'pistol';
    if (/بندقية|m4|rifle/.test(hay)) return 'assaultrifle_1';
    if (/كاتانا|سيف|katana|sword/.test(hay)) return 'katana';
    if (/سكين|knife|blade|dagger/.test(hay)) return 'knife';
    if (/مضرب|هراوة|bat|club/.test(hay)) return 'bat';
    if (/خوذة|helmet/.test(hay)) return 'helmet';
    if (/درع|سترة|kevlar|vest|armor/.test(hay)) return 'kevlar';
    if (/زاناكس|xanax/.test(hay)) return 'xanax';
    if (/إكستاسي|ecstasy/.test(hay)) return 'ecstasy';
    if (/فيكودين|vicodin/.test(hay)) return 'vicodin';
    if (/قنب|cannabis/.test(hay)) return 'cannabis';
    if (/lsd|إل إس دي/.test(hay)) return 'lsd';
    if (/دم|blood/.test(hay)) return 'bloodbag';
    if (/مورفين|morphine|syringe/.test(hay)) return 'morphine';
    if (/صغيرة|small.*med|first aid/.test(hay)) return 'small_medkit';
    if (/إسعاف|طب|medkit|medical|heal/.test(hay)) return 'medkit';
    if (/فيذري|feathery|fhc|hotel/.test(hay)) return 'fhc';
    if (/قرص|dvd|edvd/.test(hay)) return 'edvd';
    if (/حلوى|candy|choc/.test(hay)) return 'candy';
    if (/طاقة|معزز|energy|drink|can|booster/.test(hay)) return 'edrink';
    if (/ذهب|سبيكة|gold|bullion/.test(hay)) return 'gold_bullion';
    if (/زهرة|أوركيد|flower|orchid/.test(hay)) return 'orchid';
    if (/دمية|تميمة|plush/.test(hay)) return 'plushie';
    return 'weapon_cache';
  }

  function getItemProvenance(itemIdOrName, metaText) {
    var key = inferItemId(itemIdOrName, metaText);
    if (BESPOKE_PROVENANCE_V163[key]) {
      return { id: key, data: BESPOKE_PROVENANCE_V163[key] };
    }
    if (!state.pack || !state.pack.itemProvenance) return null;
    var map = state.pack.itemProvenance;
    var entry = map[key] || map.weapon_cache || null;
    if (!entry) {
      var keys = Object.keys(map);
      if (keys.length) {
        key = keys[0];
        entry = map[key];
      }
    }
    return entry ? { id: key, data: entry } : null;
  }

  function getDistrictRumors(districtId) {
    var list = (state.pack && Array.isArray(state.pack.rumorWire)) ? state.pack.rumorWire : [];
    if (!districtId || districtId === 'all') return list;
    return list.filter(function (r) { return r && r.district === districtId; });
  }

  function getFlashContracts() {
    if (!state.pack || !state.pack.questHub || !Array.isArray(state.pack.questHub.flashContracts)) {
      return [];
    }
    return state.pack.questHub.flashContracts;
  }

  function getTacticalComms() {
    if (!state.pack || !state.pack.questHub || !Array.isArray(state.pack.questHub.tacticalComms)) {
      return [];
    }
    return state.pack.questHub.tacticalComms;
  }

  function injectStyles() {
    if (document.getElementById('zbl-liveops-styles') || !document.head) return;
    var style = document.createElement('style');
    style.id = 'zbl-liveops-styles';
    style.textContent = [
      '.zbl-card,.zbl-prov{box-sizing:border-box;max-width:100%;overflow-x:clip;word-break:break-word;font-family:inherit;}',
      '.zbl-prov{margin-top:8px;padding:9px 11px;border-radius:8px;border:1px solid rgba(214,167,86,.38);background:linear-gradient(180deg,rgba(24,20,16,.94),rgba(14,12,10,.98));color:#f3ecdc;display:flex;flex-direction:column;gap:5px;font-size:11.5px;line-height:1.45;}',
      '.zbl-prov-head{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;}',
      '.zbl-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;border:1px solid rgba(214,167,86,.45);background:rgba(214,167,86,.14);color:#f4cf78;}',
      '.zbl-pill--audit{border-color:rgba(57,231,163,.42);background:rgba(57,231,163,.12);color:#7cf2c4;}',
      '.zbl-pill--warn{border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.13);color:#fca5a5;}',
      '.zbl-prov-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:6px;}',
      '.zbl-kv{padding:5px 7px;border-radius:5px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);}',
      '.zbl-kv small{display:block;font-size:9.5px;opacity:.75;text-transform:uppercase;letter-spacing:.04em;}',
      '.zbl-kv strong{display:block;font-size:11px;color:#faf4e6;font-weight:600;margin-top:1px;}',
      '.zbl-card{margin-top:10px;padding:12px 13px;border-radius:7px;border:1px solid var(--border3,#3a332b);border-top:2px solid var(--gold,#d6a756);background:linear-gradient(180deg,var(--panel,#181512),var(--deep,#100e0c));color:var(--t1,#f3ecdc);display:flex;flex-direction:column;gap:9px;}',
      '.zbl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line,rgba(255,255,255,.08));padding-bottom:7px;}',
      '.zbl-title{font-size:12.5px;font-weight:700;letter-spacing:.04em;color:var(--gold,#f4cf78);}',
      '.zbl-sub{font-size:11px;color:var(--mu,#b8ae9c);margin-top:2px;}',
      '.zbl-filters{display:flex;gap:5px;flex-wrap:wrap;}',
      '.zbl-chip-btn{background:var(--btn,#24201b);color:var(--t2,#e5decb);border:1px solid var(--border3,#3c342b);border-radius:999px;padding:3px 9px;font:inherit;font-size:10.5px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '.zbl-chip-btn[aria-pressed="true"]{background:var(--activebg,rgba(214,167,86,.2));color:var(--gold,#f4cf78);border-color:var(--gold,#d6a756);}',
      '.zbl-body-box{padding:9px 10px;border-radius:6px;background:rgba(0,0,0,.22);border:1px solid var(--border,rgba(255,255,255,.08));display:flex;flex-direction:column;gap:6px;}',
      '.zbl-headline{font-size:13px;font-weight:700;color:var(--t1,#faf4e6);}',
      '.zbl-copy{margin:0;font-size:11.5px;line-height:1.5;color:var(--t2,#ddd5c3);}',
      '.zbl-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:2px;}',
      '.zbl-btn{background:var(--btn,#28231d);color:var(--t1,#f3ecdc);border:1px solid var(--border3,#473d33);border-radius:4px;padding:4px 10px;font:inherit;font-size:10.5px;font-weight:700;cursor:pointer;}',
      '.zbl-btn--primary{background:var(--activebg,rgba(214,167,86,.22));color:var(--activefg,#f4cf78);border-color:var(--gold,#d6a756);}',
      '.zbl-contracts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:8px;}',
      '.zbl-contract{padding:9px 10px;border-radius:6px;background:rgba(0,0,0,.24);border:1px solid var(--border,rgba(255,255,255,.09));display:flex;flex-direction:column;gap:6px;min-width:0;}',
      '.zbl-comm-strip{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 10px;border-radius:6px;background:rgba(57,231,163,.06);border:1px solid rgba(57,231,163,.24);}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderProvenanceHtml(itemId, prov) {
    var ar = isArabic();
    var c = t();
    var d = prov.data;
    var origin = ar ? (d.originAr || d.originEn) : (d.originEn || d.originAr);
    var maker = ar ? (d.makerAr || d.makerEn) : (d.makerEn || d.makerAr);
    var tier = ar ? (d.craftTierAr || d.craftTier) : (d.craftTier || d.craftTierAr);
    var synergy = ar ? (d.synergyAr || d.synergyEn) : (d.synergyEn || d.synergyAr);
    var rumor = ar ? (d.rumorHookAr || d.rumorHookEn) : (d.rumorHookEn || d.rumorHookAr);
    var auditTag = String(d.auditTag || 'balanced-core');

    return [
      '<div class="zbl-prov-head">',
      '  <span class="zbl-pill">' + esc(c.provBadge) + '</span>',
      '  <span class="zbl-pill zbl-pill--audit">' + esc(tier) + ' · ' + esc(auditTag) + '</span>',
      '</div>',
      '<div class="zbl-copy">' + esc(origin) + '</div>',
      '<div class="zbl-prov-grid">',
      '  <div class="zbl-kv"><small>' + esc(c.makerLabel) + '</small><strong>' + esc(maker) + '</strong></div>',
      '  <div class="zbl-kv"><small>' + esc(c.synergyLabel) + '</small><strong>' + esc(synergy) + '</strong></div>',
      '</div>',
      rumor ? '<div class="zbl-kv"><small>' + esc(c.rumorLabel) + '</small><strong>' + esc(rumor) + '</strong></div>' : ''
    ].join('');
  }

  function setHtmlMemoized(el, html) {
    if (!el) return;
    if (el.__zblLastHtml === html) return;
    el.__zblLastHtml = html;
    el.innerHTML = html;
  }

  function syncModalProvenance() {
    var modal = document.querySelector('.z3d-inspector-modal');
    if (!modal) {
      state.mounts.modalProvenance = false;
      return;
    }
    var card = modal.querySelector('.z3d-inspector-card');
    if (!card || !state.pack) return;
    var titleEl = modal.querySelector('.z3d-inspector-title');
    var eyebrowEl = modal.querySelector('.z3d-inspector-eyebrow');
    var titleText = titleEl ? titleEl.textContent.trim() : '';
    var eyebrowText = eyebrowEl ? eyebrowEl.textContent.trim() : '';
    var prov = getItemProvenance(titleText, eyebrowText);
    if (!prov) return;

    var box = card.querySelector('.zbl-modal-provenance');
    if (!box) {
      box = document.createElement('div');
      box.className = 'zbl-prov zbl-modal-provenance';
      box.setAttribute('data-zbl-scope', 'modal-provenance');
      var foot = card.querySelector('.z3d-inspector-foot');
      if (foot && foot.parentElement === card) {
        card.insertBefore(box, foot);
      } else {
        card.appendChild(box);
      }
    }
    box.setAttribute('data-zbl-item-id', prov.id);
    box.setAttribute('dir', isArabic() ? 'rtl' : 'ltr');
    setHtmlMemoized(box, renderProvenanceHtml(prov.id, prov));
    state.lastModalItemId = prov.id;
    state.mounts.modalProvenance = true;
  }

  function syncItemsInspector(main, screen) {
    if (screen !== 'items' || !state.pack) {
      state.mounts.itemInspector = false;
      return;
    }
    var inspector = main.querySelector('.zone-item-inspector');
    if (!inspector) {
      state.mounts.itemInspector = false;
      return;
    }
    var headSpans = inspector.querySelectorAll('.zone-panel-heading span');
    var titleText = headSpans[0] ? headSpans[0].textContent.trim() : '';
    var metaText = headSpans[headSpans.length - 1] ? headSpans[headSpans.length - 1].textContent.trim() : '';
    var prov = getItemProvenance(titleText, metaText);
    if (!prov) return;

    var box = inspector.querySelector('.zbl-inspector-provenance');
    if (!box) {
      box = document.createElement('div');
      box.className = 'zbl-prov zbl-inspector-provenance';
      box.setAttribute('data-zbl-scope', 'items-provenance');
      inspector.appendChild(box);
    }
    box.setAttribute('data-zbl-item-id', prov.id);
    box.setAttribute('dir', isArabic() ? 'rtl' : 'ltr');
    setHtmlMemoized(box, renderProvenanceHtml(prov.id, prov));
    state.lastInspectorKey = prov.id + ':' + (isArabic() ? 'ar' : 'en');
    state.mounts.itemInspector = true;
  }

  function removeEl(id) {
    var el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  function syncRumorWire(main, screen) {
    if ((screen !== 'newspaper' && screen !== 'city') || !state.pack) {
      removeEl('zbl-rumor-wire');
      state.mounts.rumorWire = false;
      return;
    }

    var host = screen === 'city'
      ? (main.querySelector('[data-zone-city-view="1"]') || main)
      : main;

    var card = document.getElementById('zbl-rumor-wire');
    if (!card) {
      card = document.createElement('section');
      card.id = 'zbl-rumor-wire';
      card.className = 'zbl-card';
      card.setAttribute('data-zbl-scope', 'rumor-wire');
      host.appendChild(card);
    } else if (card.parentElement !== host) {
      host.appendChild(card);
    }

    var ar = isArabic();
    var c = t();
    var filtered = getDistrictRumors(state.activeDistrict);
    if (!filtered.length) filtered = getDistrictRumors('all');
    var idx = filtered.length ? (state.rumorIndex % filtered.length) : 0;
    var active = filtered[idx];

    var filterHtml = DISTRICTS.map(function (d) {
      var pressed = state.activeDistrict === d.id ? 'true' : 'false';
      return '<button type="button" class="zbl-chip-btn" data-zbl-act="district" data-district="' + esc(d.id) + '" aria-pressed="' + pressed + '">' + esc(ar ? d.ar : d.en) + '</button>';
    }).join('');

    var bodyHtml = '';
    if (active) {
      var headline = ar ? (active.headlineAr || active.headlineEn) : (active.headlineEn || active.headlineAr);
      var body = ar ? (active.bodyAr || active.bodyEn) : (active.bodyEn || active.bodyAr);
      var heat = ar ? (active.heatWarningAr || active.heatWarningEn) : (active.heatWarningEn || active.heatWarningAr);
      var smuggle = ar ? (active.smugglingTipAr || active.smugglingTipEn) : (active.smugglingTipEn || active.smugglingTipAr);
      bodyHtml = [
        '<div class="zbl-body-box" data-zbl-rumor-id="' + esc(active.id) + '" data-zbl-district="' + esc(active.district) + '">',
        '  <div class="zbl-prov-head">',
        '    <span class="zbl-headline">' + esc(headline) + '</span>',
        '    <span class="zbl-pill">' + esc(active.biasTag || 'Street-Alert') + '</span>',
        '  </div>',
        '  <p class="zbl-copy">' + esc(body) + '</p>',
        '  <div class="zbl-prov-grid">',
        '    <div class="zbl-kv"><small>' + esc(c.heatLabel) + '</small><strong>' + esc(heat) + '</strong></div>',
        '    <div class="zbl-kv"><small>' + esc(c.smuggleLabel) + '</small><strong>' + esc(smuggle) + '</strong></div>',
        '  </div>',
        '  <div class="zbl-actions">',
        '    <button type="button" class="zbl-btn zbl-btn--primary" data-zbl-act="go-screen" data-screen="' + esc(active.linkedScreen || 'crimes') + '">' + esc(c.goBtn) + '</button>',
        '    <button type="button" class="zbl-btn" data-zbl-act="next-rumor">' + esc(c.nextRumorBtn) + ' (' + (idx + 1) + '/' + filtered.length + ')</button>',
        '  </div>',
        '</div>'
      ].join('');
    }

    card.setAttribute('dir', ar ? 'rtl' : 'ltr');
    card.setAttribute('data-zbl-screen', screen);
    setHtmlMemoized(card, [
      '<div class="zbl-head">',
      '  <div><div class="zbl-title">' + esc(c.wireTitle) + '</div><div class="zbl-sub">' + esc(c.wireSub) + '</div></div>',
      '  <span class="zbl-pill zbl-pill--audit">' + esc(c.batchTag) + '</span>',
      '</div>',
      '<div class="zbl-filters" role="group">' + filterHtml + '</div>',
      bodyHtml
    ].join(''));
    state.mounts.rumorWire = true;
  }

  function syncQuestHub(main, screen) {
    if (screen !== 'missions' || !state.pack) {
      removeEl('zbl-quest-hub');
      state.mounts.questHub = false;
      return;
    }

    var card = document.getElementById('zbl-quest-hub');
    if (!card) {
      card = document.createElement('section');
      card.id = 'zbl-quest-hub';
      card.className = 'zbl-card';
      card.setAttribute('data-zbl-scope', 'quest-hub');
      main.appendChild(card);
    } else if (card.parentElement !== main) {
      main.appendChild(card);
    }

    var ar = isArabic();
    var c = t();
    var contracts = getFlashContracts();
    var comms = getTacticalComms();
    var activeComm = comms.length ? comms[state.commIndex % comms.length] : null;

    var commHtml = '';
    if (activeComm) {
      var spLabel = activeComm.speaker === 'luna' ? c.speakerLuna : c.speakerTariq;
      var kicker = ar ? (activeComm.kickerAr || activeComm.kickerEn) : (activeComm.kickerEn || activeComm.kickerAr);
      var line = ar ? (activeComm.lineAr || activeComm.lineEn) : (activeComm.lineEn || activeComm.lineAr);
      commHtml = [
        '<div class="zbl-comm-strip" data-zbl-comm-speaker="' + esc(activeComm.speaker) + '">',
        '  <div style="flex:1;min-width:0">',
        '    <div class="zbl-prov-head"><span class="zbl-pill zbl-pill--audit">' + esc(spLabel) + '</span><span class="zbl-pill">' + esc(kicker) + '</span></div>',
        '    <p class="zbl-copy" style="margin-top:4px">' + esc(line) + '</p>',
        '  </div>',
        '  <button type="button" class="zbl-btn" data-zbl-act="next-comm">' + esc(c.nextCommBtn) + '</button>',
        '</div>'
      ].join('');
    }

    var contractsHtml = contracts.slice(0, 4).map(function (ct) {
      var branches = Array.isArray(ct.branches) ? ct.branches : [];
      var chosenId = state.selectedBranches[ct.id] || (branches[0] ? branches[0].id : '');
      var chosen = branches.find(function (b) { return b.id === chosenId; }) || branches[0];
      var speakerTag = ct.speaker === 'luna' ? c.speakerLuna : c.speakerTariq;
      var title = ar ? (ct.titleAr || ct.titleEn) : (ct.titleEn || ct.titleAr);
      var brief = ar ? (ct.briefingAr || ct.briefingEn) : (ct.briefingEn || ct.briefingAr);
      var branchBtns = branches.map(function (b) {
        var pressed = chosen && b.id === chosen.id ? 'true' : 'false';
        var bLabel = ar ? (b.labelAr || b.labelEn) : (b.labelEn || b.labelAr);
        return '<button type="button" class="zbl-chip-btn" data-zbl-act="branch" data-contract="' + esc(ct.id) + '" data-branch="' + esc(b.id) + '" aria-pressed="' + pressed + '">' + esc(bLabel) + '</button>';
      }).join('');
      var hintText = chosen ? (ar ? (chosen.hintAr || chosen.hintEn) : (chosen.hintEn || chosen.hintAr)) : '';
      var targetScreen = chosen ? (chosen.targetScreen || 'crimes') : 'crimes';

      return [
        '<article class="zbl-contract" data-zbl-contract-id="' + esc(ct.id) + '">',
        '  <div class="zbl-prov-head"><span class="zbl-pill">' + esc(speakerTag) + '</span><span class="zbl-pill zbl-pill--audit">' + esc(String(ct.district || 'center').toUpperCase()) + '</span></div>',
        '  <div class="zbl-headline">' + esc(title) + '</div>',
        '  <p class="zbl-copy">' + esc(brief) + '</p>',
        '  <div class="zbl-filters">' + branchBtns + '</div>',
        hintText ? '  <div class="zbl-kv"><small>' + esc(c.branchHintLabel) + '</small><strong>' + esc(hintText) + '</strong></div>' : '',
        '  <div class="zbl-actions"><button type="button" class="zbl-btn zbl-btn--primary" data-zbl-act="go-screen" data-screen="' + esc(targetScreen) + '">' + esc(c.goBtn) + '</button></div>',
        '</article>'
      ].join('');
    }).join('');

    card.setAttribute('dir', ar ? 'rtl' : 'ltr');
    setHtmlMemoized(card, [
      '<div class="zbl-head">',
      '  <div><div class="zbl-title">' + esc(c.questTitle) + '</div><div class="zbl-sub">' + esc(c.questSub) + '</div></div>',
      '  <span class="zbl-pill zbl-pill--audit">' + esc(c.batchTag) + '</span>',
      '</div>',
      commHtml,
      '<div class="zbl-contracts-grid">' + contractsHtml + '</div>'
    ].join(''));
    state.mounts.questHub = true;
  }

  function renderAll() {
    if (!state.pack) return false;
    injectStyles();
    syncModalProvenance();

    var main = document.getElementById('zone-main');
    if (!main) return true;
    var screen = getActiveScreen();

    // Strict Home Zero-Clutter Guard: NEVER mount anything on Home (#zig-home-arcade stays #1, 0px delta)
    if (screen === 'home') {
      removeEl('zbl-rumor-wire');
      removeEl('zbl-quest-hub');
      state.mounts.itemInspector = false;
      state.mounts.rumorWire = false;
      state.mounts.questHub = false;
      return true;
    }

    syncItemsInspector(main, screen);
    syncRumorWire(main, screen);
    syncQuestHub(main, screen);
    return true;
  }

  function loadPack(customUrl) {
    if (state.loading) return Promise.resolve(state.pack);
    if (typeof fetch !== 'function') return Promise.resolve(state.pack);
    state.loading = true;
    return fetch(customUrl || PACK_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.pack = data;
        state.loaded = true;
        state.loading = false;
        renderAll();
        return data;
      })
      .catch(function () {
        state.loading = false;
        return null;
      });
  }

  document.addEventListener('click', function (ev) {
    var target = ev.target && typeof ev.target.closest === 'function'
      ? ev.target.closest('[data-zbl-act]')
      : null;
    if (!target) return;
    var act = target.getAttribute('data-zbl-act');
    if (act === 'district') {
      ev.preventDefault();
      state.activeDistrict = target.getAttribute('data-district') || 'all';
      state.rumorIndex = 0;
      renderAll();
    } else if (act === 'next-rumor') {
      ev.preventDefault();
      state.rumorIndex += 1;
      renderAll();
    } else if (act === 'next-comm') {
      ev.preventDefault();
      state.commIndex += 1;
      renderAll();
    } else if (act === 'branch') {
      ev.preventDefault();
      var cid = target.getAttribute('data-contract') || '';
      var bid = target.getAttribute('data-branch') || '';
      if (cid && bid) {
        state.selectedBranches[cid] = bid;
        renderAll();
      }
    } else if (act === 'go-screen') {
      ev.preventDefault();
      navigateScreen(target.getAttribute('data-screen') || '');
    }
  });

  var rafPending = false;
  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    var run = function () {
      rafPending = false;
      renderAll();
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  function attachScopedObservers() {
    if (typeof MutationObserver !== 'function') return;
    if (document.documentElement && !document.documentElement.__zblDocObs) {
      document.documentElement.__zblDocObs = true;
      var docObs = new MutationObserver(scheduleRender);
      docObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dir', 'lang', 'data-theme']
      });
    }
    var main = document.getElementById('zone-main');
    if (main && !main.__zblMainObs) {
      main.__zblMainObs = true;
      var mainObs = new MutationObserver(scheduleRender);
      mainObs.observe(main, {
        attributes: true,
        attributeFilter: ['data-zone-screen']
      });
    }
    if (document.body && !document.body.__zblBodyObs) {
      document.body.__zblBodyObs = true;
      var bodyObs = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node && node.className && String(node.className).indexOf('z3d-inspector-modal') !== -1) {
              scheduleRender();
              return;
            }
          }
        }
      });
      bodyObs.observe(document.body, { childList: true });
    }
  }

  function boot() {
    window.addEventListener('zone:render', function () {
      attachScopedObservers();
      scheduleRender();
    });
    attachScopedObservers();
    setTimeout(attachScopedObservers, 500);
    loadPack();
  }

  window.ZoneBatchLiveOps = {
    __booted: true,
    loadPack: loadPack,
    setPack: function (packObj) {
      state.pack = packObj;
      state.loaded = Boolean(packObj);
      renderAll();
      return state.pack;
    },
    getPack: function () { return state.pack; },
    inferItemId: inferItemId,
    getItemProvenance: getItemProvenance,
    getDistrictRumors: getDistrictRumors,
    getFlashContracts: getFlashContracts,
    getTacticalComms: getTacticalComms,
    selectDistrict: function (d) {
      state.activeDistrict = d || 'all';
      state.rumorIndex = 0;
      renderAll();
    },
    nextRumor: function () {
      state.rumorIndex += 1;
      renderAll();
    },
    selectBranch: function (contractId, branchId) {
      if (contractId && branchId) {
        state.selectedBranches[contractId] = branchId;
        renderAll();
      }
    },
    nextComm: function () {
      state.commIndex += 1;
      renderAll();
    },
    render: renderAll,
    diagnostics: function () {
      var meta = (state.pack && state.pack.batchJobMeta) ? state.pack.batchJobMeta : null;
      return {
        ready: state.loaded,
        screen: getActiveScreen(),
        activeDistrict: state.activeDistrict,
        mounts: Object.assign({}, state.mounts),
        skillsDigested: meta ? meta.skillsDigestedCount : 0,
        batchState: meta ? meta.state : null,
        batchModel: meta ? meta.modelId : null
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

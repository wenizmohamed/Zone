(function () {
  'use strict';

  if (window.__zoneAscensionBooted) return;
  window.__zoneAscensionBooted = true;

  var RANK_LADDER = [
    { minLv: 1, en: 'Street Pickpocket', ar: 'نشال شارع' },
    { minLv: 2, en: 'Pier Scavenger', ar: 'منقّب الأرصفة' },
    { minLv: 3, en: 'Dockside Runner', ar: 'عدّاء الأرصفة' },
    { minLv: 5, en: 'Back-Alley Hustler', ar: 'محتال الأزقة' },
    { minLv: 7, en: 'Street Enforcer', ar: 'منفّذ الشوارع' },
    { minLv: 10, en: 'Syndicate Fixer', ar: 'وسيط النقابة' },
    { minLv: 12, en: 'District Capo', ar: 'كابو المقاطعة' },
    { minLv: 15, en: 'Cartel Smuggler', ar: 'مهرّب الكارتل' },
    { minLv: 20, en: 'Underboss Tactician', ar: 'نائب الزعيم' },
    { minLv: 25, en: 'City Sovereign', ar: 'سيّد المدينة الأعلى' }
  ];

  var SIDEBAR_NAV_LOCKS = {
    casino: { level: 3, featureEn: 'Casino & Daily Wheels', featureAr: 'الكازينو وعجلات الحظ' },
    market: { level: 5, featureEn: 'Personal Bazaars & Trades', featureAr: 'البازار والتبادل الآمن' },
    jobs: { level: 7, featureEn: 'Fixer & Company Contracts', featureAr: 'عقود الوكلاء والوظائف' },
    bank: { level: 10, featureEn: 'Bank CDs & Vaults', featureAr: 'شهادات البنك والخزائن' },
    faction: { level: 12, featureEn: 'Faction HQ & Respect Tree', featureAr: 'مقر العائلة وشجرة الاحترام' },
    elimination: { level: 15, featureEn: 'Global Flights & Syndicate Wars', featureAr: 'الرحلات الدولية وحروب النخبة' }
  };

  var LEVEL_UNLOCK_MILESTONES = [
    { level: 2, en: 'City Dump & Encrypted Mail', ar: 'مكب المدينة والبريد المشفر', route: 'city' },
    { level: 3, en: 'Casino Floor, Daily Spin Wheels & Wheelman', ar: 'صالة الكازينو وعجلات الحظ وسائق الهروب', route: 'casino' },
    { level: 5, en: 'Personal Bazaars, Direct Trades & Chemist', ar: 'البازار الشخصي والتبادل المباشر والكيميائي', route: 'market' },
    { level: 7, en: 'Hit Bounties & NPC Fixer Contracts', ar: 'عقود التصفية ووكلاء المهام', route: 'city' },
    { level: 8, en: 'Heavy Enforcer Street Crew Slot', ar: 'خانة المنفّذ المسلح في طاقم الشارع', route: 'home' },
    { level: 10, en: 'Player Companies, Bank CDs & Property Vaults', ar: 'شركات اللاعبين وشهادات البنك والخزائن', route: 'bank' },
    { level: 12, en: 'Faction Founding, Stock Exchange & Consigliere', ar: 'تأسيس العائلات وسوق الأسهم والمستشار', route: 'faction' },
    { level: 15, en: 'International Airport & Foreign Smuggling', ar: 'المطار الدولي والتهريب الخارجي', route: 'city' },
    { level: 20, en: 'Specialist Heavyweight Gyms', ar: 'الأندية الرياضية التخصصية', route: 'gym' },
    { level: 25, en: 'Era VI: City Sovereign Compound', ar: 'العصر السادس: مجمع سيّد المدينة', route: 'home' }
  ];

  var DEFAULT_ORIGINS = [
    {
      id: 'harbor_ghost',
      nameEn: 'Harbor Ghost',
      nameAr: 'شبح المرفأ',
      taglineEn: 'Silent dockside infiltrator raised between rusted Pier 4 containers.',
      taglineAr: 'متسلل صامت نشأ بين حاويات الرصيف الرابع الصدئة.',
      perksSummaryEn: '+8% Crime Success · +10% Stealth · Knife + $4,000',
      perksSummaryAr: '+8% نجاح الجرائم · +10% تخفٍ · سكين + 4,000$'
    },
    {
      id: 'cartel_bruiser',
      nameEn: 'Ex-Cartel Enforcer',
      nameAr: 'منفّذ الكارتل',
      taglineEn: 'Scarred heavy hitter collecting debts in blood and shattered bone.',
      taglineAr: 'مقاتل شرس يحصّل الديون بالقوة والضربات الحاسمة.',
      perksSummaryEn: '+10% Combat Damage · +50 Max Life · Bat + Medkit + $3,000',
      perksSummaryAr: '+10% ضرر قتالي · +50 أقصى صحة · مضرب + إسعاف + 3,000$'
    },
    {
      id: 'disgraced_banker',
      nameEn: 'Fallen Financier',
      nameAr: 'المصرفي الساقط',
      taglineEn: 'Blacklisted clearing-house prodigy laundering syndicate millions.',
      taglineAr: 'عبقري مالي يدير غسيل أموال النقابة وعوائد الخزائن.',
      perksSummaryEn: '+8% Bank & Vault APR · -20% Market/Stock Fee · $12,000 Seed',
      perksSummaryAr: '+8% عائد البنك والخزائن · -20% رسوم السوق · 12,000$ رأس مال'
    },
    {
      id: 'street_chemist',
      nameEn: 'Underground Chemist',
      nameAr: 'الخيميائي السري',
      taglineEn: 'Back-alley synthesist mastering pure stimulants and trauma triage.',
      taglineAr: 'خبير تركيبات سرية يتقن المنشطات النقية والإسعاف الميداني.',
      perksSummaryEn: '-20% Drug OD Risk · +10 Max Energy · 2x Medkit + 2x Drink + $3,500',
      perksSummaryAr: '-20% خطر الجرعة الزائدة · +10 أقصى طاقة · إسعافان + مشروبان + 3,500$'
    }
  ];

  var DEFAULT_ERAS = [
    { eraIndex: 1, roman: 'I', minLevel: 1, maxLevel: 2, breakthroughLevel: 2, nameEn: 'Gutter Rat', nameAr: 'جرذ الأزقة', titleEn: 'Era I: Gutter Rat', titleAr: 'العصر الأول: جرذ الأزقة', safehouseEn: 'Rusted Pier 4 Container', safehouseAr: 'حاوية الرصيف الرابع الصدئة', cashReward: 5000, spReward: 2, meritsReward: 2 },
    { eraIndex: 2, roman: 'II', minLevel: 3, maxLevel: 6, breakthroughLevel: 6, nameEn: 'Dockside Runner', nameAr: 'عدّاء الأرصفة', titleEn: 'Era II: Dockside Runner', titleAr: 'العصر الثاني: عدّاء الأرصفة', safehouseEn: 'Neon Alley Backroom', safehouseAr: 'غرفة زقاق النيون الخلفية', cashReward: 15000, spReward: 2, meritsReward: 2 },
    { eraIndex: 3, roman: 'III', minLevel: 7, maxLevel: 11, breakthroughLevel: 11, nameEn: 'Street Enforcer', nameAr: 'منفّذ الشوارع', titleEn: 'Era III: Street Enforcer', titleAr: 'العصر الثالث: منفّذ الشوارع', safehouseEn: 'Fortified Harbor Flat', safehouseAr: 'شقة المرفأ المحصنة', cashReward: 35000, spReward: 2, meritsReward: 2 },
    { eraIndex: 4, roman: 'IV', minLevel: 12, maxLevel: 14, breakthroughLevel: 14, nameEn: 'District Capo', nameAr: 'كابو المقاطعة', titleEn: 'Era IV: District Capo', titleAr: 'العصر الرابع: كابو المقاطعة', safehouseEn: 'Downtown War-Room', safehouseAr: 'غرفة حرب وسط المدينة', cashReward: 75000, spReward: 2, meritsReward: 2 },
    { eraIndex: 5, roman: 'V', minLevel: 15, maxLevel: 24, breakthroughLevel: 24, nameEn: 'Cartel Baron', nameAr: 'بارون الكارتل', titleEn: 'Era V: Cartel Baron', titleAr: 'العصر الخامس: بارون الكارتل', safehouseEn: 'Skyline Penthouse Vault', safehouseAr: 'خزنة البنتهاوس السماوية', cashReward: 175000, spReward: 2, meritsReward: 2 },
    { eraIndex: 6, roman: 'VI', minLevel: 25, maxLevel: 100, breakthroughLevel: 25, nameEn: 'City Sovereign', nameAr: 'سيّد المدينة الأعلى', titleEn: 'Era VI: City Sovereign', titleAr: 'العصر السادس: سيّد المدينة الأعلى', safehouseEn: 'Sovereign Private Island Compound', safehouseAr: 'مجمع الجزيرة السيادية الخاصة', cashReward: 500000, spReward: 2, meritsReward: 2 }
  ];

  var DEFAULT_CREW = [
    { id: 'lookout', slotId: 'lookout', unlockLevel: 1, nameEn: 'Dockside Lookout', nameAr: 'مراقب الأرصفة', perkEn: '+3% Crime Success / rank', perkAr: '+3% نجاح الجرائم / رتبة', baseHourlyRate: 150, recruitCost: 1500 },
    { id: 'wheelman', slotId: 'wheelman', unlockLevel: 3, nameEn: 'Getaway Wheelman', nameAr: 'سائق الهروب المحترف', perkEn: '-3% Flight & Escape Risk / rank', perkAr: '-3% مخاطر الطيران والهروب / رتبة', baseHourlyRate: 300, recruitCost: 4500 },
    { id: 'chemist', slotId: 'chemist', unlockLevel: 5, nameEn: 'Backroom Chemist', nameAr: 'كيميائي المختبر السري', perkEn: '-4% Drug OD & +5% Med Heal / rank', perkAr: '-4% خطر الجرعة و+5% شفاء / رتبة', baseHourlyRate: 500, recruitCost: 9500 },
    { id: 'enforcer', slotId: 'enforcer', unlockLevel: 8, nameEn: 'Heavy Enforcer', nameAr: 'المنفّذ المسلح', perkEn: '+4% Combat & Nemesis Damage / rank', perkAr: '+4% ضرر القتال والعدو اللدود / رتبة', baseHourlyRate: 900, recruitCost: 22000 },
    { id: 'consigliere', slotId: 'consigliere', unlockLevel: 12, nameEn: 'Syndicate Consigliere', nameAr: 'مستشار النقابة الأعلى', perkEn: '+4% Bank/Company/Vault Yield / rank', perkAr: '+4% عوائد البنك والشركات / رتبة', baseHourlyRate: 1600, recruitCost: 50000 }
  ];

  var state = {
    snap: null,
    loading: false,
    busyAction: '',
    lastFetchAt: 0,
    callsignDraft: '',
    modalOpen: false,
    feedback: null,
    feedbackTimer: null,
    baselineLevel: null,
    milestoneTimer: null,
    gameHooked: false
  };

  function isAr() {
    var doc = document.documentElement;
    if (doc && (doc.lang === 'ar' || doc.dir === 'rtl')) return true;
    var g = window.__zoneGame;
    return Boolean(g && g.state && g.state.lang === 'ar');
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
  }

  function fmtInt(n) {
    var v = Math.round(Number(n) || 0);
    return v.toLocaleString('en-US');
  }

  function fmtMoney(n) {
    var v = Math.round(Number(n) || 0);
    return '$' + Math.abs(v).toLocaleString('en-US');
  }

  function getAuthToken() {
    try {
      if (window.ZonePlatform && typeof window.ZonePlatform.getSession === 'function') {
        var s = window.ZonePlatform.getSession();
        if (s && s.token) return String(s.token);
      }
    } catch (_) {}
    try {
      var raw = localStorage.getItem('zone_platform_session_v1') || localStorage.getItem('zone_session');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.token) return String(parsed.token);
      }
    } catch (_) {}
    return '';
  }

  function computeShortOperativeId(rawId, fallbackName) {
    var s = String(rawId || '').trim();
    if (/^\d{3,6}$/.test(s) && s !== '1042') return s;
    var digits = s.replace(/\D+/g, '');
    if (digits.length >= 3) {
      var tail = digits.slice(-4);
      if (tail !== '1042' && Number(tail) >= 100) return String(Number(tail));
    }
    var seedStr = s || String(fallbackName || '');
    if (!seedStr) {
      try {
        var cached = localStorage.getItem('zone_real_short_id');
        if (cached && cached !== '1042') return cached;
      } catch (_) {}
      seedStr = 'operative-pier4';
    }
    var hash = 2166136261;
    for (var i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul ? Math.imul(hash, 16777619) : ((hash * 16777619) | 0);
    }
    var num = 2100 + (Math.abs(hash) % 7800);
    if (num === 1042) num = 2049;
    var out = String(num);
    try { localStorage.setItem('zone_real_short_id', out); } catch (_) {}
    return out;
  }

  function resolveUnifiedRankTitle(level, ar) {
    var lv = Math.max(1, Number(level) || 1);
    if (state.snap && state.snap.activeTitle) {
      var t = state.snap.activeTitle;
      var custom = ar ? (t.ar || t.titleAr) : (t.en || t.titleEn);
      if (custom) return String(custom);
    }
    try {
      if (window.ZoneRpgEmpire && typeof window.ZoneRpgEmpire.getState === 'function') {
        var rpgSt = window.ZoneRpgEmpire.getState();
        var pr = rpgSt && rpgSt.playerRpg;
        if (pr) {
          var rt = pr.rankTitle || pr.rank;
          if (rt && typeof rt === 'object' && (rt.en || rt.ar)) {
            return String(ar ? (rt.ar || rt.en) : (rt.en || rt.ar));
          }
          var flat = ar ? (pr.rankTitleAr || pr.titleAr) : (pr.rankTitleEn || pr.titleEn);
          if (flat) return String(flat);
        }
      }
    } catch (_) {}
    var chosen = RANK_LADDER[0];
    for (var i = 0; i < RANK_LADDER.length; i++) {
      if (lv >= RANK_LADDER[i].minLv) chosen = RANK_LADDER[i];
    }
    return ar ? chosen.ar : chosen.en;
  }

  /* ---------------- SVG Art: Luna Portrait, 4 Origins & 6 Safehouses ---------------- */
  function renderLunaPortraitSvg() {
    return (
      '<svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Luna">' +
        '<defs>' +
          '<radialGradient id="zabLunaGlow" cx="50%" cy="38%" r="58%">' +
            '<stop offset="0%" stop-color="#f5e6d0"/>' +
            '<stop offset="68%" stop-color="#dfcbb0"/>' +
            '<stop offset="100%" stop-color="#b99878"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<circle cx="36" cy="36" r="34" fill="url(#zabLunaGlow)"/>' +
        /* Dark brunette flowing waves (back) */
        '<path d="M14 36C14 18 23 10 36 10C49 10 58 18 58 36C58 50 53 61 48 66H24C19 61 14 50 14 36Z" fill="#2a1b15" stroke="#18110e" stroke-width="1.6"/>' +
        /* Jacket & collar */
        '<path d="M16 67C18 56 26 52 36 52C46 52 54 56 56 67" fill="#2b213a" stroke="#18110e" stroke-width="1.6"/>' +
        '<path d="M30 52L36 61L42 52" stroke="#d9a441" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        /* Neck & warm olive face */
        '<rect x="32" y="45" width="8" height="9" rx="3" fill="#cfa07a"/>' +
        '<path d="M24 31C24 22 29 17 36 17C43 17 48 22 48 31C48 40 42.5 47 36 47C29.5 47 24 40 24 31Z" fill="#d8ab84" stroke="#1e1714" stroke-width="1.5"/>' +
        /* Warm watercolor cheek blush */
        '<ellipse cx="28.5" cy="36.5" rx="3.2" ry="1.8" fill="#c96f5b" fill-opacity="0.34"/>' +
        '<ellipse cx="43.5" cy="36.5" rx="3.2" ry="1.8" fill="#c96f5b" fill-opacity="0.34"/>' +
        /*Sharp warm brown eyes & brows */
        '<path d="M27.5 28.2C29.3 27 31.6 27 33.2 28" stroke="#241712" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M38.8 28C40.4 27 42.7 27 44.5 28.2" stroke="#241712" stroke-width="1.5" stroke-linecap="round"/>' +
        '<ellipse cx="30.5" cy="31.2" rx="2.3" ry="1.8" fill="#3a2216"/>' +
        '<ellipse cx="41.5" cy="31.2" rx="2.3" ry="1.8" fill="#3a2216"/>' +
        '<circle cx="31.1" cy="30.7" r="0.7" fill="#fff8ec"/>' +
        '<circle cx="42.1" cy="30.7" r="0.7" fill="#fff8ec"/>' +
        /* Subtle nose & knowing slight smile */
        '<path d="M36 31.8V36.2L34.7 37" stroke="#8c5f41" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M32.2 40.5C34.4 42.2 38 42.1 40.2 40.1" stroke="#8f3b32" stroke-width="1.6" stroke-linecap="round"/>' +
        /* Brunette front side-swept bangs & encrypted earpiece */
        '<path d="M23 30C24 21 31 16 39 17C44 17.5 48 21 49 28C45 23 40 21.5 34 22.5C29 23.2 25.5 26 23 30Z" fill="#332019" stroke="#18110e" stroke-width="1.3"/>' +
        '<circle cx="48.5" cy="34.5" r="2.3" fill="#8b5cf6" stroke="#18110e" stroke-width="1.1"/>' +
      '</svg>'
    );
  }

  function renderOriginSvg(originId) {
    if (originId === 'cartel_bruiser') {
      return '<svg viewBox="0 0 36 36" fill="none"><path d="M8 28L27 9" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="27.5" cy="8.5" r="3" fill="#c98f27" stroke="currentColor" stroke-width="1.5"/><path d="M6 26L10 30" stroke="#8f2318" stroke-width="2.4" stroke-linecap="round"/></svg>';
    }
    if (originId === 'disgraced_banker') {
      return '<svg viewBox="0 0 36 36" fill="none"><rect x="6" y="10" width="24" height="17" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18.5" r="4.2" stroke="#c98f27" stroke-width="2"/><path d="M13 10V7.5C13 6.7 13.7 6 14.5 6H21.5C22.3 6 23 6.7 23 7.5V10" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    if (originId === 'street_chemist') {
      return '<svg viewBox="0 0 36 36" fill="none"><path d="M14 6H22M16 6V13L9 26C8.3 27.3 9.2 29 10.7 29H25.3C26.8 29 27.7 27.3 27 26L20 13V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.5 23H24.5" stroke="#3c7a33" stroke-width="2.4"/></svg>';
    }
    return '<svg viewBox="0 0 36 36" fill="none"><path d="M7 27L26 8L29 11L10 30H7V27Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M21 13L24 16" stroke="#c98f27" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function renderSafehouseSvg(eraIndex) {
    var idx = Math.max(1, Math.min(6, Number(eraIndex) || 1));
    if (idx === 1) {
      return '<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="18" width="36" height="20" rx="2" fill="#b87d4b" fill-opacity="0.28" stroke="currentColor" stroke-width="2"/><path d="M12 18V38M18 18V38M24 18V38M30 18V38M36 18V38" stroke="currentColor" stroke-width="1.4"/><path d="M4 39H44" stroke="#7a4f0d" stroke-width="2"/></svg>';
    }
    if (idx === 2) {
      return '<svg viewBox="0 0 48 48" fill="none"><path d="M8 39V15L24 9L40 15V39H8Z" fill="#c98f27" fill-opacity="0.2" stroke="currentColor" stroke-width="2"/><rect x="19" y="25" width="10" height="14" stroke="currentColor" stroke-width="1.8"/><circle cx="24" cy="18" r="3" stroke="#8f2318" stroke-width="1.8"/></svg>';
    }
    if (idx === 3) {
      return '<svg viewBox="0 0 48 48" fill="none"><rect x="9" y="11" width="30" height="28" rx="2" fill="#3c7a33" fill-opacity="0.18" stroke="currentColor" stroke-width="2"/><rect x="14" y="16" width="7" height="6" stroke="currentColor" stroke-width="1.6"/><rect x="27" y="16" width="7" height="6" stroke="currentColor" stroke-width="1.6"/><rect x="20" y="28" width="8" height="11" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    if (idx === 4) {
      return '<svg viewBox="0 0 48 48" fill="none"><path d="M7 39V17L24 8L41 17V39H7Z" fill="#4d2775" fill-opacity="0.16" stroke="currentColor" stroke-width="2"/><path d="M15 39V21M24 39V21M33 39V21" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="15" r="2.5" fill="#c98f27"/></svg>';
    }
    if (idx === 5) {
      return '<svg viewBox="0 0 48 48" fill="none"><rect x="13" y="7" width="22" height="33" fill="#c98f27" fill-opacity="0.24" stroke="currentColor" stroke-width="2"/><path d="M8 40H40M17 13H31M17 19H31M17 25H31" stroke="currentColor" stroke-width="1.6"/><path d="M24 3V7" stroke="#c98f27" stroke-width="2"/></svg>';
    }
    return '<svg viewBox="0 0 48 48" fill="none"><path d="M5 37C12 33 36 33 43 37" stroke="#3c7a33" stroke-width="2.4" stroke-linecap="round"/><path d="M14 35V20L24 12L34 20V35" fill="#c98f27" fill-opacity="0.28" stroke="currentColor" stroke-width="2"/><path d="M24 6L26.5 11H21.5L24 6Z" fill="#c98f27"/></svg>';
  }

  /* ---------------- D. Universal 0ms Topbar & Sidebar Bar Sync ---------------- */
  function syncSidebarLockBadges(level) {
    var lv = Math.max(1, Number(level) || 1);
    var ar = isAr();
    var nav = document.getElementById('zone-area-navigation');
    if (!nav || !nav.querySelectorAll) return;
    var buttons = nav.querySelectorAll('button[data-zone-screen]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var scr = btn.getAttribute('data-zone-screen') || '';
      var rule = SIDEBAR_NAV_LOCKS[scr];
      var existing = btn.querySelector ? btn.querySelector('.zab-nav-lock-pill') : null;
      if (rule && lv < rule.level) {
        var label = ar ? ('م ' + rule.level) : ('Lv ' + rule.level);
        var tip = ar
          ? ('يفتح عند المستوى ' + rule.level + ': ' + rule.featureAr)
          : ('Unlocks at Level ' + rule.level + ': ' + rule.featureEn);
        if (!existing) {
          existing = document.createElement('span');
          existing.className = 'zab-nav-lock-pill';
          existing.setAttribute('data-zab-lock-level', String(rule.level));
          btn.appendChild(existing);
        }
        if (existing.textContent !== label) existing.textContent = label;
        existing.setAttribute('title', tip);
      } else if (existing) {
        existing.remove();
      }
    }
  }

  function showLevelUpMilestoneBanner(oldLv, newLv) {
    var ar = isAr();
    var unlocked = [];
    for (var i = 0; i < LEVEL_UNLOCK_MILESTONES.length; i++) {
      var m = LEVEL_UNLOCK_MILESTONES[i];
      if (m.level > oldLv && m.level <= newLv) {
        unlocked.push(ar ? m.ar : m.en);
      }
    }
    var banner = document.getElementById('zone-levelup-milestone-banner');
    if (!banner && document.body) {
      banner = document.createElement('div');
      banner.id = 'zone-levelup-milestone-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      document.body.appendChild(banner);
    }
    if (!banner) return;

    var rankTitle = resolveUnifiedRankTitle(newLv, ar);
    var unlockText = unlocked.length
      ? ((ar ? 'تم فتح: ' : 'Newly Unlocked: ') + unlocked.join(' · '))
      : ((ar ? 'الرتبة الجديدة: ' : 'Operative Rank: ') + rankTitle);

    banner.hidden = false;
    banner.innerHTML =
      '<div class="zab-luna-avatar" style="width:46px;height:46px;flex:0 0 46px">' + renderLunaPortraitSvg() + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="zab-eyebrow">' + (ar ? 'اختراق مستوى جديد!' : 'UNDERWORLD MILESTONE UNLOCKED!') + '</div>' +
        '<div class="zab-title" style="font-size:18px">' +
          (ar ? ('المستوى ' + oldLv + ' ← المستوى ' + newLv + ' · ' + esc(rankTitle)) : ('Level ' + oldLv + ' -> Level ' + newLv + ' · ' + esc(rankTitle))) +
        '</div>' +
        '<div class="zab-sub" style="font-weight:700">' + esc(unlockText) + '</div>' +
      '</div>';

    if (state.milestoneTimer) clearTimeout(state.milestoneTimer);
    state.milestoneTimer = setTimeout(function () {
      state.milestoneTimer = null;
      var b = document.getElementById('zone-levelup-milestone-banner');
      if (b) b.hidden = true;
    }, 4500);
  }

  function checkLevelUpCelebration(level, isAuthoritative) {
    var lv = Math.max(1, Number(level) || 1);
    if (!isAuthoritative) return;
    if (state.baselineLevel === null) {
      state.baselineLevel = lv;
      return;
    }
    if (lv > state.baselineLevel) {
      var prev = state.baselineLevel;
      state.baselineLevel = lv;
      showLevelUpMilestoneBanner(prev, lv);
    } else if (lv < state.baselineLevel) {
      state.baselineLevel = lv;
    }
  }

  function updateResourceBarDom(key, curVal, maxVal) {
    var cur = Math.max(0, Math.round(Number(curVal) || 0));
    var max = Math.max(1, Math.round(Number(maxVal) || 1));
    var pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
    var txt = fmtInt(cur) + '/' + fmtInt(max);

    var row = document.querySelector ? document.querySelector('.zone-resource[data-zone-resource="' + key + '"]') : null;
    if (row) {
      var bdis = row.querySelectorAll ? row.querySelectorAll('bdi') : [];
      if (bdis.length > 0) bdis[0].textContent = txt;
      var fill = row.querySelector ? row.querySelector('.zone-resource-track > div, .zone-resource-track > span') : null;
      if (fill && fill.style) fill.style.width = pct + '%';
    }
  }

  function syncHudBars(rawPayload) {
    var ar = isAr();
    var g = window.__zoneGame;
    var pObj = rawPayload && rawPayload.player && typeof rawPayload.player === 'object'
      ? rawPayload.player
      : (rawPayload && typeof rawPayload === 'object' ? rawPayload : null);
    var stObj = rawPayload && rawPayload.state && typeof rawPayload.state === 'object'
      ? rawPayload.state
      : null;

    var gp = g && g.p ? g.p : null;
    if (gp && pObj && pObj !== gp) {
      if (pObj.cash !== undefined) gp.cash = Number(pObj.cash) || 0;
      if (pObj.bank_balance !== undefined) gp.bank = Number(pObj.bank_balance) || 0;
      else if (pObj.bank !== undefined) gp.bank = Number(pObj.bank) || 0;
      if (pObj.level !== undefined) gp.level = Math.max(1, Number(pObj.level) || 1);
      if (pObj.xp !== undefined) gp.xp = Math.max(0, Number(pObj.xp) || 0);
      if (pObj.city) gp.city = String(pObj.city);
      if (pObj.merits !== undefined) gp.merits = Math.max(0, Number(pObj.merits) || 0);
      if (pObj.points !== undefined) gp.points = Math.max(0, Number(pObj.points) || 0);
      if (stObj) {
        if (stObj.merits !== undefined) gp.merits = Math.max(0, Number(stObj.merits) || 0);
        if (stObj.points !== undefined) gp.points = Math.max(0, Number(stObj.points) || 0);
      }

      gp.max = gp.max || { energy: 100, nerve: 15, happy: 150, life: 100 };
      gp.used = gp.used || { energy: 0, nerve: 0, happy: 0, life: 0 };
      gp.regenAt = gp.regenAt || {};
      var nowMs = Date.now();

      if (pObj.max_energy !== undefined) gp.max.energy = Math.max(1, Number(pObj.max_energy) || 100);
      if (pObj.energy !== undefined) {
        gp.used.energy = Math.max(0, gp.max.energy - Number(pObj.energy));
        gp.regenAt.energy = nowMs;
      }
      if (pObj.max_nerve !== undefined) gp.max.nerve = Math.max(1, Number(pObj.max_nerve) || 15);
      if (pObj.nerve !== undefined) {
        gp.used.nerve = Math.max(0, gp.max.nerve - Number(pObj.nerve));
        gp.regenAt.nerve = nowMs;
      }
      if (pObj.max_happy !== undefined) gp.max.happy = Math.max(1, Number(pObj.max_happy) || 150);
      if (pObj.happy !== undefined) {
        gp.used.happy = Math.max(0, gp.max.happy - Number(pObj.happy));
        gp.regenAt.happy = nowMs;
      }
      if (pObj.max_life !== undefined) gp.max.life = Math.max(1, Number(pObj.max_life) || 100);
      if (pObj.life !== undefined) {
        gp.used.life = Math.max(0, gp.max.life - Number(pObj.life));
        gp.regenAt.life = nowMs;
      }
    }

    var sessionPlayer = null;
    try {
      if (window.ZonePlatform && typeof window.ZonePlatform.getSession === 'function') {
        var sess = window.ZonePlatform.getSession();
        if (sess && sess.player) sessionPlayer = sess.player;
      }
    } catch (_) {}

    var rawId = (pObj && (pObj.shortId || pObj.numericId || pObj.id)) ||
      (sessionPlayer && sessionPlayer.id) ||
      (gp && gp.numericId && gp.numericId !== '1042' ? gp.numericId : '');
    var username = (pObj && pObj.username) ||
      (sessionPlayer && sessionPlayer.username) ||
      (window.__zoneLastView && window.__zoneLastView.t && window.__zoneLastView.t.player) ||
      (ar ? 'العميل' : 'Operative');
    var shortId = computeShortOperativeId(rawId, username);

    if (gp) gp.numericId = shortId;
    if (g && pObj && pObj.username) {
      if (g.serverPlayer && typeof g.serverPlayer === 'object') {
        g.serverPlayer.username = String(pObj.username);
      }
      if (gp) gp.name = String(pObj.username);
    }
    var rankTitle = resolveUnifiedRankTitle(
      pObj && pObj.level !== undefined ? Math.max(1, Number(pObj.level) || 1) : (gp ? Math.max(1, Number(gp.level) || 1) : 1),
      ar
    );
    if (window.__zoneLastView) {
      window.__zoneLastView.levelTitle = rankTitle;
      if (window.__zoneLastView.t && pObj && pObj.username) {
        window.__zoneLastView.t.player = String(pObj.username);
      }
      if (window.__zoneLastView.omar) {
        window.__zoneLastView.omar.playerId = shortId;
        window.__zoneLastView.omar.idBadgeLabel = (ar ? 'معرف #' : 'ID #') + shortId;
      }
    }

    var cash = pObj && pObj.cash !== undefined ? Number(pObj.cash) : (gp ? Number(gp.cash || 0) : 0);
    var level = pObj && pObj.level !== undefined ? Math.max(1, Number(pObj.level) || 1) : (gp ? Math.max(1, Number(gp.level) || 1) : 1);
    var xp = pObj && pObj.xp !== undefined ? Math.max(0, Number(pObj.xp) || 0) : (gp ? Math.max(0, Number(gp.xp) || 0) : 0);
    var merits = (pObj && pObj.merits !== undefined)
      ? Number(pObj.merits)
      : (stObj && stObj.merits !== undefined ? Number(stObj.merits) : (gp ? Number(gp.merits || 0) : 0));

    var curE = pObj && pObj.energy !== undefined ? Number(pObj.energy) : (g && typeof g.cur === 'function' ? g.cur('energy') : 100);
    var maxE = pObj && pObj.max_energy !== undefined ? Number(pObj.max_energy) : (pObj && pObj.max && pObj.max.energy ? Number(pObj.max.energy) : (g && typeof g.maxOf === 'function' ? g.maxOf('energy') : 100));
    var curN = pObj && pObj.nerve !== undefined ? Number(pObj.nerve) : (g && typeof g.cur === 'function' ? g.cur('nerve') : 15);
    var maxN = pObj && pObj.max_nerve !== undefined ? Number(pObj.max_nerve) : (pObj && pObj.max && pObj.max.nerve ? Number(pObj.max.nerve) : (g && typeof g.maxOf === 'function' ? g.maxOf('nerve') : 15));
    var curH = pObj && pObj.happy !== undefined ? Number(pObj.happy) : (g && typeof g.cur === 'function' ? g.cur('happy') : 150);
    var maxH = pObj && pObj.max_happy !== undefined ? Number(pObj.max_happy) : (pObj && pObj.max && pObj.max.happy ? Number(pObj.max.happy) : (g && typeof g.maxOf === 'function' ? g.maxOf('happy') : 150));
    var curL = pObj && pObj.life !== undefined ? Number(pObj.life) : (g && typeof g.cur === 'function' ? g.cur('life') : 100);
    var maxL = pObj && pObj.max_life !== undefined ? Number(pObj.max_life) : (pObj && pObj.max && pObj.max.life ? Number(pObj.max.life) : (g && typeof g.maxOf === 'function' ? g.maxOf('life') : 100));
    var city = (pObj && pObj.city) || (gp && gp.city) || (ar ? 'مدينة زون' : 'Zone City');

    /* 1. Topbar HUD (#zone-topbar-hud) — 0ms instant update */
    var hud = document.getElementById('zone-topbar-hud');
    if (hud && hud.querySelector) {
      var hCash = hud.querySelector('.zaaa-hud-cash');
      if (hCash) hCash.textContent = fmtMoney(cash);
      var hE = hud.querySelector('.zaaa-hud-energy');
      if (hE) hE.textContent = fmtInt(curE) + '/' + fmtInt(maxE);
      var hN = hud.querySelector('.zaaa-hud-nerve');
      if (hN) hN.textContent = fmtInt(curN) + '/' + fmtInt(maxN);
      var hL = hud.querySelector('.zaaa-hud-life');
      if (hL) hL.textContent = fmtInt(curL) + '/' + fmtInt(maxL);
      var hCity = hud.querySelector('.zaaa-hud-city');
      if (hCity) hCity.textContent = city;
    }

    /* 2. Sidebar Cash & 4 Resource Bars — 0ms instant update */
    var sideCash = document.getElementById('zone-cash');
    if (sideCash) sideCash.textContent = fmtMoney(cash);
    updateResourceBarDom('energy', curE, maxE);
    updateResourceBarDom('nerve', curN, maxN);
    updateResourceBarDom('happy', curH, maxH);
    updateResourceBarDom('life', curL, maxL);

    /* 3. Sidebar Operative Crest (#zone-operative-crest) & Desktop Rows: Name + Short ID + Rank + Level + Merits */
    var crest = document.getElementById('zone-operative-crest');
    if (crest && crest.querySelector) {
      var opInfo = crest.querySelector('.zaaa-op-info');
      var opName = crest.querySelector('.zaaa-op-name');
      if (!opName && opInfo) {
        opName = document.createElement('strong');
        opName.className = 'zaaa-op-name';
        opInfo.insertBefore(opName, opInfo.firstChild);
      }
      if (opName && username) opName.textContent = username;
      var opLvl = crest.querySelector('.zaaa-op-lvl');
      if (opLvl) opLvl.textContent = (ar ? 'م.' : 'LV.') + level;
      var opRank = crest.querySelector('.zaaa-op-rank');
      if (opRank) opRank.textContent = rankTitle;
      var opId = crest.querySelector('.zaaa-op-id');
      if (opId) opId.textContent = '#' + shortId;
      var xpNeed = Math.max(100, level * 250);
      var xpPct = Math.max(8, Math.min(100, Math.round(((xp % xpNeed) / xpNeed) * 100)));
      var opXpVal = crest.querySelector('.zaaa-op-xp-val');
      if (opXpVal) opXpVal.textContent = fmtInt(xp) + ' / ' + fmtInt(Math.max(xpNeed, xp));
      if (crest.style && typeof crest.style.setProperty === 'function') {
        crest.style.setProperty('--zaaa-xp-pct', xpPct + '%');
      }
    }

    var deskRows = document.querySelectorAll ? document.querySelectorAll('aside.zone-sidebar .zone-profile-body > .zone-profile-desktop') : [];
    if (deskRows.length >= 3) {
      var lvBdi = deskRows[0].querySelector ? deskRows[0].querySelector('bdi') : null;
      if (lvBdi) lvBdi.innerHTML = fmtInt(level) + ' <span style="color:var(--mu);font-size:10px">' + esc(rankTitle) + '</span>';
      var ptsVal = (pObj && pObj.points !== undefined) ? Number(pObj.points) : (stObj && stObj.points !== undefined ? Number(stObj.points) : (gp ? Number(gp.points || 0) : 0));
      var ptsBdi = deskRows[1].querySelector ? deskRows[1].querySelector('bdi') : null;
      if (ptsBdi) ptsBdi.textContent = fmtInt(ptsVal);
      var merBdi = deskRows[2].querySelector ? deskRows[2].querySelector('bdi') : null;
      if (merBdi) merBdi.textContent = fmtInt(merits);
    }

    /* Replace any leftover #1042 badges in sidebar/header */
    var sideEl = document.querySelector ? document.querySelector('aside.zone-sidebar') : null;
    if (sideEl && sideEl.querySelectorAll) {
      var bdis = sideEl.querySelectorAll('bdi, span, small');
      for (var bi = 0; bi < bdis.length; bi++) {
        var node = bdis[bi];
        if (node.children && node.children.length === 0 && node.textContent && node.textContent.indexOf('#1042') !== -1) {
          node.textContent = node.textContent.replace(/#1042\b/g, '#' + shortId);
        }
      }
    }

    /* Update compact HUD story pill level/rank if mounted */
    var storyPill = document.getElementById('zre-hud-story-pill');
    if (storyPill && storyPill.querySelector) {
      var merBadge = storyPill.querySelector('[data-zab-merits]');
      if (merBadge) merBadge.textContent = fmtInt(merits);
    }

    syncSidebarLockBadges(level);
    checkLevelUpCelebration(level, Boolean(pObj));

    return {
      shortId: shortId,
      username: username,
      level: level,
      rankTitle: rankTitle,
      cash: cash,
      merits: merits,
      energy: curE,
      maxEnergy: maxE,
      nerve: curN,
      maxNerve: maxN,
      happy: curH,
      maxHappy: maxH,
      life: curL,
      maxLife: maxL
    };
  }

  window.ZoneSyncHudBars = syncHudBars;

  function hookCoreGameMethods() {
    var g = window.__zoneGame;
    if (!g || g.__zabHudHooked) return;
    g.__zabHudHooked = true;
    state.gameHooked = true;

    if (typeof g.applyServerPlayer === 'function') {
      var origApplyPlayer = g.applyServerPlayer;
      g.applyServerPlayer = function (sp) {
        var r = origApplyPlayer.apply(this, arguments);
        try { syncHudBars(sp || this.p); } catch (_) {}
        return r;
      };
    }
    if (typeof g.applyGameplay === 'function') {
      var origApplyGp = g.applyGameplay;
      g.applyGameplay = function (snap) {
        var r = origApplyGp.apply(this, arguments);
        try { syncHudBars(snap || this.p); } catch (_) {}
        return r;
      };
    }
  }

  /* ---------------- Snapshot Normalization & Resilient Offline Fallback ---------------- */
  function buildFallbackSnapshot() {
    var g = window.__zoneGame;
    var gp = (g && g.p) ? g.p : {};
    var lv = Math.max(1, Number(gp.level) || 1);
    var xp = Math.max(0, Number(gp.xp) || 0);
    var cash = Math.max(0, Number(gp.cash) || 2500);
    var eraIdx = lv >= 25 ? 6 : lv >= 15 ? 5 : lv >= 12 ? 4 : lv >= 7 ? 3 : lv >= 3 ? 2 : 1;
    var currentEra = Object.assign({}, DEFAULT_ERAS[eraIdx - 1], {
      progressPct: lv >= DEFAULT_ERAS[eraIdx - 1].breakthroughLevel ? 100 : 35,
      claimable: false,
      claimed: false
    });

    var nextGate = LEVEL_UNLOCK_MILESTONES[0];
    for (var i = 0; i < LEVEL_UNLOCK_MILESTONES.length; i++) {
      if (lv < LEVEL_UNLOCK_MILESTONES[i].level) {
        nextGate = LEVEL_UNLOCK_MILESTONES[i];
        break;
      }
    }

    return {
      originChosen: false,
      originId: null,
      origins: DEFAULT_ORIGINS,
      eraIndex: eraIdx,
      eraProgressPct: currentEra.progressPct,
      currentEra: currentEra,
      claimableEra: null,
      eras: DEFAULT_ERAS.map(function (e) {
        return Object.assign({}, e, {
          unlocked: lv >= e.minLevel,
          current: e.eraIndex === eraIdx,
          progressPct: lv >= e.breakthroughLevel ? 100 : (e.eraIndex === eraIdx ? 35 : 0),
          claimable: false,
          claimed: false
        });
      }),
      nextUnlock: {
        level: nextGate.level,
        currentLevel: lv,
        xpRemaining: Math.max(40, (nextGate.level - lv) * 150),
        progressPct: 30,
        featureEn: nextGate.en,
        featureAr: nextGate.ar,
        targetRoute: nextGate.route,
        allGatesUnlocked: lv >= 25
      },
      lunaOracle: {
        persona: 'Luna · Syndicate Architect',
        personaAr: 'لونا · مهندسة النقابة المشفرة',
        channel: 'ENCRYPTED // PIER-4-OMEGA',
        transmissionEn: "Rain on Pier 4, operative. I'm Luna — your encrypted Syndicate Architect. Choose your underworld origin below and I'll wire your starter kit and Directive #1 immediately.",
        transmissionAr: 'المطر يغمر الرصيف الرابع أيها العميل. أنا لونا — مهندسة النقابة المشفرة الخاصة بك. اختر أصلك الإجرامي بالأسفل وسأحوّل عتادك الأول والتوجيه رقم #1 فوراً.'
      },
      activeDirective: {
        directiveIndex: 1,
        titleEn: 'Awaken Your Underworld Origin',
        titleAr: 'أيقظ أصلك في العالم السفلي',
        descEn: 'Select one of the 4 Underworld Origins on Pier 4 to receive your starter kit and syndicate wiring.',
        descAr: 'اختر أحد الأصول الإجرامية الأربعة على الرصيف الرابع لاستلام عتادك الأولي.',
        targetRoute: 'home',
        completed: false,
        claimable: false,
        progressPct: 0,
        progressLabelEn: 'Select an origin on Home',
        progressLabelAr: 'اختر أصلك في الرئيسية',
        rewards: { cash: 1500, xp: 50, sp: 1, merits: 1 }
      },
      nemesis: {
        nameEn: 'Viktor "Ironjaw" Kael',
        nameAr: 'فيكتور "الفك الحديدي" كايل',
        titleEn: 'Pier 4 Racket Enforcer',
        titleAr: 'بلطجي إتاوات الرصيف الرابع',
        tier: 1,
        districtEn: 'Harbor Pier 4',
        districtAr: 'رصيف الميناء الرابع',
        heatTaxPct: 4,
        heatCleared: false,
        intel: 25,
        lastMemoryEn: 'My lookouts own every wet alley on Pier 4 — pay the cut or bleed for it.',
        lastMemoryAr: 'رجالي يسيطرون على كل زقاق في الرصيف الرابع — ادفع الإتاوة أو واجه المصير.',
        gatherIntelEnergyCost: 5,
        confrontEnergyCost: 15,
        nextBountyCash: 8000,
        canGatherIntel: true,
        canConfront: false
      },
      crew: {
        slots: DEFAULT_CREW.map(function (c) {
          var unl = lv >= c.unlockLevel;
          return Object.assign({}, c, {
            unlocked: unl,
            recruited: false,
            rank: 0,
            maxRank: 5,
            hourlyRate: 0,
            canRecruit: unl && cash >= c.recruitCost,
            canUpgrade: false
          });
        }),
        recruitedCount: 0,
        maxSlots: 5,
        totalHourlyRate: 0,
        pendingTribute: 0,
        canCollectTribute: false
      }
    };
  }

  function normalizeSnapshot(raw) {
    if (!raw || typeof raw !== 'object') return buildFallbackSnapshot();
    var root = (raw.origins || raw.eras || raw.lunaOracle || raw.nemesis)
      ? raw
      : (raw.ascension && typeof raw.ascension === 'object' ? raw.ascension : raw);
    var fb = buildFallbackSnapshot();

    var eras = Array.isArray(root.eras) && root.eras.length ? root.eras : fb.eras;
    var eraIdx = Math.max(1, Math.min(6, Number(root.eraIndex || (root.currentEra && root.currentEra.eraIndex) || fb.eraIndex)));
    var curEra = root.currentEra || eras[eraIdx - 1] || fb.currentEra;
    var claimableEra = root.claimableEra || eras.find(function (e) { return Boolean(e && e.claimable); }) || null;

    var crewObj = root.crew && typeof root.crew === 'object' && Array.isArray(root.crew.slots)
      ? root.crew
      : fb.crew;

    return {
      player: root.player || raw.player || null,
      originChosen: Boolean(root.originChosen),
      originId: root.originId || root.origin || null,
      activeOrigin: root.activeOrigin || null,
      origins: Array.isArray(root.origins) && root.origins.length ? root.origins : fb.origins,
      eraIndex: eraIdx,
      eraProgressPct: Number(root.eraProgressPct != null ? root.eraProgressPct : (curEra.progressPct || 0)),
      currentEra: curEra,
      claimableEra: claimableEra,
      safehouseStage: root.safehouseStage || { eraIndex: eraIdx, en: curEra.safehouseEn, ar: curEra.safehouseAr },
      eras: eras,
      activeTitle: root.activeTitle || null,
      nextUnlock: root.nextUnlock || fb.nextUnlock,
      lunaOracle: root.lunaOracle || fb.lunaOracle,
      activeDirective: root.activeDirective || (root.lunaOracle && root.lunaOracle.activeDirective) || fb.activeDirective,
      directivesCompletedCount: Number((root.lunaOracle && root.lunaOracle.directivesCompletedCount) || 0),
      directivesTotalCount: Number((root.lunaOracle && root.lunaOracle.directivesTotalCount) || 12),
      nemesis: root.nemesis || fb.nemesis,
      crew: crewObj,
      passiveBonuses: root.passiveBonuses || {}
    };
  }

  function setFeedback(text, isErr) {
    if (state.feedbackTimer) clearTimeout(state.feedbackTimer);
    state.feedback = { text: String(text || ''), isErr: Boolean(isErr) };
    renderHub();
    state.feedbackTimer = setTimeout(function () {
      state.feedback = null;
      state.feedbackTimer = null;
      renderHub();
    }, 4000);
  }

  /* ---------------- API Fetch & Action Dispatch ---------------- */
  function isPreviewMode() {
    try {
      var sp = new URLSearchParams(window.location.search || '');
      return sp.get('zone-preview') === '1' || sp.get('preview') === '1';
    } catch (_) {
      return false;
    }
  }

  async function ensurePlayerSession() {
    if (isPreviewMode()) return false;
    if (window.ZoneSession && typeof window.ZoneSession.ensure === 'function') {
      try {
        await window.ZoneSession.ensure();
        return typeof window.ZoneSession.isEstablished === 'function'
          ? Boolean(window.ZoneSession.isEstablished())
          : true;
      } catch (_) {
        return false;
      }
    }
    if (window.ZonePlatform && typeof window.ZonePlatform.ensureSession === 'function') {
      try { await window.ZonePlatform.ensureSession(); } catch (_) {}
    }
    return true;
  }

  function buildHeaders(jsonBody) {
    var h = { Accept: 'application/json' };
    if (jsonBody) h['Content-Type'] = 'application/json';
    var tok = getAuthToken();
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }

  async function refreshAscension(force) {
    if (isPreviewMode()) {
      if (!state.snap) state.snap = buildFallbackSnapshot();
      renderHub();
      return state.snap;
    }
    if (state.loading && !force) return state.snap;
    state.loading = true;
    state.lastFetchAt = Date.now();
    try {
      var sessionReady = await ensurePlayerSession();
      if (!sessionReady) {
        if (!state.snap) state.snap = buildFallbackSnapshot();
        syncHudBars();
        return state.snap;
      }
      var res = await fetch('/api/v1/ascension', {
        method: 'GET',
        headers: buildHeaders(false),
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data) {
        state.snap = normalizeSnapshot(data);
        if (state.snap.player) syncHudBars(data);
        else syncHudBars();
      } else if (!state.snap) {
        state.snap = buildFallbackSnapshot();
        syncHudBars();
      }
    } catch (_) {
      if (!state.snap) state.snap = buildFallbackSnapshot();
      syncHudBars();
    } finally {
      state.loading = false;
      renderHub();
      renderOriginModal();
    }
    return state.snap;
  }

  async function dispatchAscensionAction(action, payload) {
    if (state.busyAction) return null;
    state.busyAction = action;
    renderHub();
    renderOriginModal();
    var ar = isAr();
    try {
      await ensurePlayerSession();
      var body = Object.assign({ action: action }, payload || {});
      var res = await fetch('/api/v1/ascension/action', {
        method: 'POST',
        headers: buildHeaders(true),
        credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      var data = await res.json().catch(function () { return null; });
      if (!res.ok || (data && data.ok === false && data.error)) {
        var errMsg = (data && (data.error && (data.error.message || data.error))) ||
          (data && data.message) ||
          (ar ? 'تعذر تنفيذ العملية حالياً.' : 'Action could not be completed.');
        setFeedback(errMsg, true);
        return null;
      }
      state.snap = normalizeSnapshot(data);
      if (action === 'origin.select') {
        state.modalOpen = false;
      }
      /* 0ms Instant HUD Sync! */
      syncHudBars(data);

      var r = (data && data.result) || {};
      var msg = buildActionSuccessCopy(action, r, ar);
      setFeedback(msg, false);
      try {
        window.dispatchEvent(new CustomEvent('zone:ascension-updated', { detail: state.snap }));
      } catch (_) {}
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : (ar ? 'خطأ في الاتصال بالخادم.' : 'Network error reaching syndicate relay.'), true);
      return null;
    } finally {
      state.busyAction = '';
      renderHub();
      renderOriginModal();
    }
  }

  function buildActionSuccessCopy(action, r, ar) {
    if (action === 'origin.select') {
      var oname = ar ? (r.originNameAr || 'الأصل المختار') : (r.originNameEn || 'Selected Origin');
      return ar
        ? ('تم تفعيل الأصل: ' + oname + ' · +' + fmtMoney(r.cashAwarded || 0) + ' وفتح التوجيه #1!')
        : ('Origin Awakened: ' + oname + ' · +' + fmtMoney(r.cashAwarded || 0) + ' & Directive #1 live!');
    }
    if (action === 'era.claimBreakthrough') {
      return ar
        ? ('تم استلام اختراق العصر! +' + fmtMoney(r.cashAwarded || 0) + ' · +' + (r.spAwarded || 2) + ' مهارة · +' + (r.meritsAwarded || 2) + ' ميرت')
        : ('Era Breakthrough Claimed! +' + fmtMoney(r.cashAwarded || 0) + ' · +' + (r.spAwarded || 2) + ' SP · +' + (r.meritsAwarded || 2) + ' Merits');
    }
    if (action === 'nemesis.gatherIntel') {
      return ar
        ? ('تم تتبّع أثر الخصم: المعلومات الآن ' + (r.intelAfter != null ? r.intelAfter : 100) + '%!')
        : ('Nemesis tracks swept: Intel at ' + (r.intelAfter != null ? r.intelAfter : 100) + '%!');
    }
    if (action === 'nemesis.confront') {
      if (r.victory) {
        return ar
          ? ('انتصار ساحق على العدو اللدود! غنيمة +' + fmtMoney(r.bountyCash || r.cashAwarded || 0) + ' وإلغاء الإتاوة لمدة 12 ساعة!')
          : ('Nemesis Crushed! Bounty +' + fmtMoney(r.bountyCash || r.cashAwarded || 0) + ' & Heat Tax wiped for 12h!');
      }
      return ar
        ? 'انتهت المواجهة بإصابتك (5 دقائق مستشفى) — بقيت المعلومات عند 60% للثأر سريعاً!'
        : 'Showdown lost (5m Hospital) — Intel held at 60% so you can strike back after training!';
    }
    if (action === 'crew.recruit') {
      return ar
        ? ('تم تجنيد ' + (r.nameAr || 'عضو الطاقم') + ' (الرتبة 1)!')
        : ('Recruited ' + (r.nameEn || 'Crew Specialist') + ' (Rank 1)!');
    }
    if (action === 'crew.upgrade') {
      return ar
        ? ('تمت ترقية ' + (r.nameAr || 'عضو الطاقم') + ' إلى الرتبة ' + (r.rank || 2) + '!')
        : ('Upgraded ' + (r.nameEn || 'Crew Specialist') + ' to Rank ' + (r.rank || 2) + '!');
    }
    if (action === 'crew.collectTribute') {
      return ar
        ? ('تم تحصيل إتاوة الطاقم: +' + fmtMoney(r.cashAwarded || r.tributeCollected || 0) + '!')
        : ('Collected Street Crew Tribute: +' + fmtMoney(r.cashAwarded || r.tributeCollected || 0) + '!');
    }
    if (action === 'luna.claimDirective') {
      return ar
        ? ('لونا: تم استلام مكافأة التوجيه! +' + fmtMoney(r.cashAwarded || 0) + ' · +' + fmtInt(r.xpAwarded || 0) + ' خبرة')
        : ('Luna Directive Claimed! +' + fmtMoney(r.cashAwarded || 0) + ' · +' + fmtInt(r.xpAwarded || 0) + ' XP');
    }
    return ar ? 'تم التحديث بنجاح.' : 'Syndicate state updated.';
  }

  function navigateToRoute(route) {
    var target = String(route || 'home').trim() || 'home';
    var main = document.getElementById('zone-main');
    var cur = main ? main.getAttribute('data-zone-screen') : 'home';
    if (target === 'home' && cur === 'home') {
      var hub = document.getElementById('zone-ascension-hub');
      if (hub && typeof hub.scrollIntoView === 'function') {
        try { hub.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
      }
      return;
    }
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(target);
      return;
    }
    var btn = document.querySelector ? document.querySelector('#zone-area-navigation button[data-zone-screen="' + target + '"]') : null;
    if (btn && typeof btn.click === 'function') btn.click();
  }

  /* ---------------- Renderers: Origin Card, 6-Era Spine, Luna, Nemesis, Crew ---------------- */
  function buildOriginSelectionInnerHtml(snap, ar, isModal) {
    var origins = snap.origins || DEFAULT_ORIGINS;
    var inputId = isModal ? 'zab-callsign-modal-input' : 'zab-callsign-input';
    return (
      '<div class="zab-origin-top">' +
        '<div class="zab-origin-luna-greet">' +
          '<div class="zab-luna-avatar">' + renderLunaPortraitSvg() + '</div>' +
          '<div style="min-width:0;flex:1">' +
            '<span class="zab-eyebrow">' + (ar ? 'اليقظة في الدقيقة صفر · الرصيف الرابع' : 'MINUTE-0 AWAKENING · PIER 4 DOCKS') + '</span>' +
            '<h2 class="zab-title">' +
              (ar ? 'اليقظة على الرصيف الرابع — اختر أصلك في العالم السفلي' : 'Awakening on Pier 4 — Choose Your Underworld Origin') +
            '</h2>' +
            '<p class="zab-sub">' +
              esc(ar ? (snap.lunaOracle && snap.lunaOracle.transmissionAr) : (snap.lunaOracle && snap.lunaOracle.transmissionEn)) +
            '</p>' +
          '</div>' +
        '</div>' +
        (isModal
          ? '<button type="button" class="zab-btn" data-zab-close-modal="1">' + (ar ? 'إغلاق النافذة' : 'Close Dossier') + '</button>'
          : '<button type="button" class="zab-btn zab-btn-ochre" data-zab-open-modal="1">' + (ar ? 'فتح ملف الأصول التفاعلي الكامل' : 'Expand Full Origin Dossier') + '</button>') +
      '</div>' +
      '<div class="zab-callsign-row">' +
        '<label for="' + inputId + '">' + (ar ? 'الاسم الحركي (اختياري):' : 'Operative Callsign (Optional):') + '</label>' +
        '<input id="' + inputId + '" type="text" maxlength="24" class="zab-callsign-input" data-zab-callsign="1" value="' + esc(state.callsignDraft) + '" placeholder="' + (ar ? 'مثال: GhostPier4' : 'e.g. GhostPier4') + '">' +
        '<span class="zab-pill zab-pill-luna">' + (ar ? 'لونا · قناة مشفرة نشطة ❤️' : 'Luna · Encrypted Uplink Live ❤️') + '</span>' +
      '</div>' +
      '<div class="zab-origin-grid">' +
        origins.map(function (o) {
          var name = ar ? (o.nameAr || o.nameEn) : (o.nameEn || o.nameAr);
          var tagline = ar ? (o.taglineAr || o.taglineEn) : (o.taglineEn || o.taglineAr);
          var perksRaw = ar ? (o.perksSummaryAr || o.perksSummaryEn || '') : (o.perksSummaryEn || o.perksSummaryAr || '');
          var perkParts = String(perksRaw).split('·').map(function (s) { return s.trim(); }).filter(Boolean);
          return (
            '<article class="zab-origin-card" data-zab-origin-card="' + esc(o.id) + '">' +
              '<div>' +
                '<div class="zab-origin-card-head">' +
                  '<div class="zab-origin-illus">' + renderOriginSvg(o.id) + '</div>' +
                  '<div style="min-width:0">' +
                    '<div class="zab-origin-name">' + esc(name) + '</div>' +
                  '</div>' +
                '</div>' +
                '<p class="zab-sub" style="font-size:12.5px;margin-top:6px">' + esc(tagline) + '</p>' +
                '<ul class="zab-origin-perks" style="margin-top:6px">' +
                  perkParts.map(function (pk) { return '<li>' + esc(pk) + '</li>'; }).join('') +
                '</ul>' +
              '</div>' +
              '<button type="button" class="zab-btn zab-btn-primary" data-zab-action="origin.select" data-zab-origin-id="' + esc(o.id) + '"' + (state.busyAction ? ' disabled' : '') + '>' +
                (ar ? ('اختر ' + esc(name)) : ('Awaken as ' + esc(name))) +
              '</button>' +
            '</article>'
          );
        }).join('') +
      '</div>'
    );
  }

  function renderOriginModal() {
    var existing = document.getElementById('zone-origin-awakening-modal');
    if (!state.modalOpen || !state.snap || state.snap.originChosen) {
      if (existing) existing.hidden = true;
      return;
    }
    if (!existing && document.body) {
      existing = document.createElement('div');
      existing.id = 'zone-origin-awakening-modal';
      existing.setAttribute('role', 'dialog');
      existing.setAttribute('aria-modal', 'true');
      document.body.appendChild(existing);
      bindContainerDelegation(existing);
    }
    if (!existing) return;
    existing.hidden = false;
    existing.innerHTML =
      '<div class="zab-origin-modal-sheet">' +
        buildOriginSelectionInnerHtml(state.snap, isAr(), true) +
      '</div>';
  }

  function buildHubHtml(snap) {
    var ar = isAr();
    var eras = snap.eras || DEFAULT_ERAS;
    var curEra = snap.currentEra || eras[0];
    var claimableEra = snap.claimableEra;
    var eraPct = Math.max(0, Math.min(100, Math.round(Number(snap.eraProgressPct || curEra.progressPct || 0))));
    var nu = snap.nextUnlock || {};
    var nuPct = Math.max(0, Math.min(100, Math.round(Number(nu.progressPct || 0))));
    var nuCurLv = Math.max(1, Number(nu.currentLevel || (snap.player && snap.player.level) || 1));
    var nuTargetLv = Math.max(nuCurLv, Number(nu.level || nu.requiredLevel || 2));
    var nuFeature = ar ? (nu.featureAr || nu.featureEn || '') : (nu.featureEn || nu.featureAr || '');
    var nuXpLeft = Math.max(0, Number(nu.xpRemaining != null ? nu.xpRemaining : (nu.xpNeeded || 0)));

    var luna = snap.lunaOracle || {};
    var dir = snap.activeDirective || {};
    var dirIdx = Number(dir.directiveIndex || dir.index || 1);
    var dirTitle = ar ? (dir.titleAr || dir.titleEn || '') : (dir.titleEn || dir.titleAr || '');
    var dirDesc = ar ? (dir.descAr || dir.descEn || '') : (dir.descEn || dir.descAr || '');
    var dirProgLbl = ar ? (dir.progressLabelAr || dir.progressLabelEn || '') : (dir.progressLabelEn || dir.progressLabelAr || '');
    var dirPct = Math.max(0, Math.min(100, Math.round(Number(dir.progressPct || 0))));
    var dirRewards = dir.rewards || {};
    var dirCash = Number(dirRewards.cash != null ? dirRewards.cash : (dir.cashReward || 0));
    var dirXp = Number(dirRewards.xp != null ? dirRewards.xp : (dir.xpReward || 0));

    var nem = snap.nemesis || {};
    var nemName = ar ? (nem.nameAr || nem.nameEn || 'فيكتور كايل') : (nem.nameEn || nem.nameAr || 'Viktor Kael');
    var nemTitle = ar ? (nem.titleAr || nem.titleEn || '') : (nem.titleEn || nem.titleAr || '');
    var nemDistrict = ar ? (nem.districtAr || nem.district || nem.districtEn || '') : (nem.districtEn || nem.district || nem.districtAr || '');
    var nemMemory = ar ? (nem.lastMemoryAr || nem.lastMemoryEn || '') : (nem.lastMemoryEn || nem.lastMemoryAr || '');
    var nemIntel = Math.max(0, Math.min(100, Math.round(Number(nem.intel || 0))));
    var nemTax = Math.max(0, Number(nem.heatTaxPct || 0));
    var nemTier = Math.max(1, Number(nem.tier || 1));
    var intelCostE = Number(nem.gatherIntelEnergyCost || 5);
    var confrontCostE = Number(nem.confrontEnergyCost || 15);

    var crew = snap.crew || { slots: DEFAULT_CREW };
    var crewSlots = Array.isArray(crew.slots) ? crew.slots : DEFAULT_CREW;
    var pendingTribute = Math.max(0, Number(crew.pendingTribute || 0));
    var hourlyRate = Math.max(0, Number(crew.totalHourlyRate || 0));

    var feedbackHtml = '';
    if (state.feedback && state.feedback.text) {
      feedbackHtml =
        '<div class="zab-feedback-toast' + (state.feedback.isErr ? ' is-err' : '') + '" role="status">' +
          '<span>' + esc(state.feedback.text) + '</span>' +
        '</div>';
    }

    var originBannerHtml = '';
    if (!snap.originChosen) {
      originBannerHtml =
        '<section class="zab-card zab-origin-hero" data-zab-section="origin-awakening">' +
          buildOriginSelectionInnerHtml(snap, ar, false) +
        '</section>';
    }

    var activeOriginPill = '';
    if (snap.originChosen && snap.activeOrigin) {
      var aoName = ar ? (snap.activeOrigin.nameAr || snap.activeOrigin.nameEn) : (snap.activeOrigin.nameEn || snap.activeOrigin.nameAr);
      activeOriginPill = '<span class="zab-pill zab-pill-sage">' + (ar ? 'الأصل: ' : 'Origin: ') + esc(aoName) + '</span>';
    }

    /* 1. 6-Era Empire Ascension Spine */
    var eraSectionHtml =
      '<section class="zab-card" data-zab-section="era-spine">' +
        '<div class="zab-era-header">' +
          '<div>' +
            '<span class="zab-eyebrow">' + (ar ? 'مسار الصعود الإمبراطوري · 6 عصور' : '6-ERA UNDERWORLD ASCENSION SPINE') + '</span>' +
            '<h2 class="zab-title">' + esc(ar ? (curEra.titleAr || curEra.titleEn) : (curEra.titleEn || curEra.titleAr)) + '</h2>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
            activeOriginPill +
            '<span class="zab-pill zab-pill-ochre">' + (ar ? ('تقدم العصر: ' + eraPct + '%') : ('Era Progress: ' + eraPct + '%')) + '</span>' +
            (claimableEra
              ? '<button type="button" class="zab-btn zab-btn-ochre" data-zab-action="era.claimBreakthrough" data-zab-era-index="' + Number(claimableEra.eraIndex || snap.eraIndex) + '"' + (state.busyAction ? ' disabled' : '') + '>' +
                  (ar ? ('استلم اختراق العصر (+' + fmtMoney(claimableEra.cashReward || (claimableEra.rewards && claimableEra.rewards.cash) || 5000) + ')') : ('Claim Era Breakthrough (+' + fmtMoney(claimableEra.cashReward || (claimableEra.rewards && claimableEra.rewards.cash) || 5000) + ')')) +
                '</button>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="zab-era-hero-row">' +
          '<div class="zab-era-track">' +
            eras.map(function (e) {
              var idx = Number(e.eraIndex || 1);
              var cls = 'zab-era-step' + (idx === snap.eraIndex ? ' is-current' : (e.unlocked ? ' is-reached' : ''));
              var eName = ar ? (e.nameAr || e.nameEn) : (e.nameEn || e.nameAr);
              var lvlSpan = e.minLevel >= 25 ? 'Lv 25+' : ('Lv ' + e.minLevel + '-' + e.maxLevel);
              return (
                '<div class="' + cls + '" data-zab-era-step="' + idx + '">' +
                  '<span class="zab-era-roman">' + (ar ? ('العصر ' + e.roman) : ('Era ' + e.roman)) + (e.claimed ? ' ✓' : '') + '</span>' +
                  '<strong class="zab-era-name">' + esc(eName) + '</strong>' +
                  '<span class="zab-era-lvl"><bdi>' + esc(lvlSpan) + '</bdi></span>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
          '<div class="zab-safehouse-box" data-zab-safehouse="1">' +
            '<div class="zab-safehouse-art">' + renderSafehouseSvg(snap.eraIndex) + '</div>' +
            '<div style="min-width:0">' +
              '<span class="zab-eyebrow">' + (ar ? 'المقر الآمن المتطور' : 'EVOLVING SAFEHOUSE') + '</span>' +
              '<div class="zab-origin-name">' + esc(ar ? (curEra.safehouseAr || curEra.safehouseEn) : (curEra.safehouseEn || curEra.safehouseAr)) + '</div>' +
              '<div class="zab-sub" style="font-size:12px">' +
                (ar ? ('المرحلة ' + snap.eraIndex + ' من 6') : ('Stage ' + snap.eraIndex + ' of 6 Compound')) +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="zab-progress-stack">' +
          '<div class="zab-meter-card">' +
            '<div class="zab-meter-top">' +
              '<span>' + (ar ? 'اكتمال العصر الحالي' : 'Current Era Mastery') + '</span>' +
              '<bdi>' + eraPct + '%</bdi>' +
            '</div>' +
            '<div class="zab-bar-track"><div class="zab-bar-fill zab-bar-fill-ochre" style="width:' + eraPct + '%"></div></div>' +
          '</div>' +
          '<div class="zab-meter-card" data-zab-next-unlock="1">' +
            '<div class="zab-meter-top">' +
              '<span>' +
                (nu.allGatesUnlocked
                  ? (ar ? 'جميع أبواب المدينة مفتوحة!' : 'All World Systems Unlocked!')
                  : (ar
                      ? ('المستوى ' + nuCurLv + ' ← ' + nuTargetLv + ': يفتح ' + esc(nuFeature))
                      : ('Lv ' + nuCurLv + ' -> Lv ' + nuTargetLv + ': Unlocks ' + esc(nuFeature)))) +
              '</span>' +
              '<bdi>' +
                (nu.allGatesUnlocked
                  ? '100%'
                  : (ar ? ('متبقي ' + fmtInt(nuXpLeft) + ' XP') : (fmtInt(nuXpLeft) + ' XP remaining'))) +
              '</bdi>' +
            '</div>' +
            '<div class="zab-bar-track"><div class="zab-bar-fill" style="width:' + nuPct + '%"></div></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    /* 2. Mid Grid: Luna Live Encrypted Comms & Directive + Living Nemesis Wanted Poster */
    var midSectionHtml =
      '<div class="zab-mid-grid">' +
        '<section class="zab-card zab-card-luna" data-zab-section="luna-comms">' +
          '<div class="zab-luna-comms">' +
            '<div class="zab-luna-avatar">' + renderLunaPortraitSvg() + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">' +
                '<span class="zab-eyebrow" style="color:var(--zab-luna)">' +
                  esc(ar ? (luna.personaAr || 'لونا · مهندسة النقابة المشفرة') : (luna.persona || 'Luna · Syndicate Architect')) + ' ❤️' +
                '</span>' +
                '<span class="zab-pill zab-pill-luna"><bdi>' + esc(luna.channel || 'ENCRYPTED // PIER-4') + '</bdi></span>' +
              '</div>' +
              '<blockquote class="zab-luna-quote" data-zab-luna-line="1">' +
                esc(ar ? (luna.transmissionAr || luna.transmissionEn) : (luna.transmissionEn || luna.transmissionAr)) +
              '</blockquote>' +
            '</div>' +
          '</div>' +
          '<div class="zab-directive-box" data-zab-directive="' + dirIdx + '">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
              '<strong style="font-size:14.5px;color:var(--zab-ink)">' +
                (ar ? ('التوجيه النشط #' + dirIdx + '/12: ') : ('Directive #' + dirIdx + '/12: ')) + esc(dirTitle) +
              '</strong>' +
              '<span class="zab-pill zab-pill-sage"><bdi>' + esc(dirProgLbl) + '</bdi></span>' +
            '</div>' +
            '<div class="zab-sub" style="font-size:12.5px">' + esc(dirDesc) + '</div>' +
            '<div class="zab-bar-track"><div class="zab-bar-fill" style="width:' + dirPct + '%"></div></div>' +
            '<div class="zab-directive-actions">' +
              '<span class="zab-pill zab-pill-ochre">' +
                (ar ? 'المكافأة: ' : 'Reward: ') + '<bdi>+' + fmtMoney(dirCash) + ' · +' + fmtInt(dirXp) + ' XP</bdi>' +
              '</span>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                (dir.claimable
                  ? '<button type="button" class="zab-btn zab-btn-ochre" data-zab-action="luna.claimDirective" data-zab-directive-index="' + dirIdx + '"' + (state.busyAction ? ' disabled' : '') + '>' +
                      (ar ? 'استلم مكافأة التوجيه' : 'Claim Directive Reward') +
                    '</button>'
                  : '') +
                '<button type="button" class="zab-btn zab-btn-primary" data-zab-go-route="' + esc(dir.targetRoute || 'crimes') + '">' +
                  '<span>' + (ar ? 'انطلق للتنفيذ' : 'Go Execute') + '</span>' +
                  '<span class="zab-rtl-flip">→</span>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="zab-card zab-card-nemesis" data-zab-section="nemesis-rival">' +
          '<div class="zab-nemesis-head">' +
            '<div>' +
              '<span class="zab-eyebrow" style="color:var(--zab-crimson)">' +
                (ar ? ('مطلوب حي · العدو اللدود (الفئة ' + nemTier + ')') : ('LIVING NEMESIS WANTED · TIER ' + nemTier)) +
              '</span>' +
              '<h3 class="zab-title">' + esc(nemName) + '</h3>' +
              '<div class="zab-sub" style="font-size:12.5px">' + esc(nemTitle) + ' · ' + esc(nemDistrict) + '</div>' +
            '</div>' +
            (nem.heatCleared || nemTax <= 0
              ? '<span class="zab-pill zab-pill-sage">' + (ar ? 'الإتاوة ملغاة (12 ساعة)!' : 'Turf Tax Cleared (12h)!') + '</span>'
              : '<span class="zab-pill zab-pill-crimson" data-zab-heat-tax="1">' +
                  (ar ? ('إتاوة -' + nemTax + '% على جرائمك!') : ('Heat Tax -' + nemTax + '% skimming street crimes!')) +
                '</span>') +
          '</div>' +
          '<div class="zab-nemesis-grudge">"' + esc(nemMemory) + '"</div>' +
          '<div class="zab-meter-card">' +
            '<div class="zab-meter-top">' +
              '<span>' + (ar ? 'تتبّع مخبأ الخصم (المعلومات)' : 'Safehouse Exposure Intel') + '</span>' +
              '<bdi data-zab-nemesis-intel="1">' + nemIntel + '%</bdi>' +
            '</div>' +
            '<div class="zab-bar-track"><div class="zab-bar-fill zab-bar-fill-crimson" style="width:' + nemIntel + '%"></div></div>' +
          '</div>' +
          '<div class="zab-nemesis-actions">' +
            '<button type="button" class="zab-btn" data-zab-action="nemesis.gatherIntel"' + ((state.busyAction || nemIntel >= 100) ? ' disabled' : '') + '>' +
              (ar ? ('تتبّع الأثر (' + intelCostE + ' طاقة)') : ('Track Intel (' + intelCostE + 'E)')) +
            '</button>' +
            '<button type="button" class="zab-btn zab-btn-crimson" data-zab-action="nemesis.confront"' + ((state.busyAction || nemIntel < 100) ? ' disabled' : '') + '>' +
              (ar
                ? ('مواجهة الخصم (' + confrontCostE + ' طاقة · +' + fmtMoney(nem.nextBountyCash || 8000) + ')')
                : ('Confront Nemesis (' + confrontCostE + 'E · +' + fmtMoney(nem.nextBountyCash || 8000) + ')')) +
            '</button>' +
          '</div>' +
        '</section>' +
      '</div>';

    /* 3. 5-Slot Evolving Street Crew Strip */
    var crewSectionHtml =
      '<section class="zab-card" data-zab-section="street-crew">' +
        '<div class="zab-crew-header">' +
          '<div>' +
            '<span class="zab-eyebrow">' + (ar ? 'طاقم الشارع المتطور · 5 تخصصات' : '5-SLOT EVOLVING STREET CREW') + '</span>' +
            '<h3 class="zab-title" style="font-size:18px">' +
              (ar ? ('عائد السيطرة بالساعة: +' + fmtMoney(hourlyRate) + '/ساعة') : ('Syndicate Turf Cut: +' + fmtMoney(hourlyRate) + '/hr')) +
            '</h3>' +
          '</div>' +
          '<button type="button" class="zab-btn zab-btn-ochre" data-zab-action="crew.collectTribute"' + ((state.busyAction || !crew.canCollectTribute || pendingTribute <= 0) ? ' disabled' : '') + '>' +
            (ar
              ? ('تحصيل إتاوة المنطقة (' + fmtMoney(pendingTribute) + ')')
              : ('Collect Turf Tribute (' + fmtMoney(pendingTribute) + ')')) +
          '</button>' +
        '</div>' +
        '<div class="zab-crew-grid">' +
          crewSlots.map(function (slot) {
            var sid = slot.slotId || slot.id;
            var sName = ar ? (slot.nameAr || slot.nameEn) : (slot.nameEn || slot.nameAr);
            var sPerk = ar ? (slot.perkAr || slot.perkEn) : (slot.perkEn || slot.perkAr);
            var rank = Math.max(0, Number(slot.rank || 0));
            var maxRank = Math.max(1, Number(slot.maxRank || 5));
            var unlocked = Boolean(slot.unlocked);
            var cls = 'zab-crew-slot' + (rank > 0 ? ' is-recruited' : (!unlocked ? ' is-locked' : ''));

            var btnHtml = '';
            if (!unlocked) {
              btnHtml = '<button type="button" class="zab-btn" disabled>' +
                (ar ? ('يفتح عند م ' + slot.unlockLevel) : ('Unlocks Lv ' + slot.unlockLevel)) +
              '</button>';
            } else if (rank === 0) {
              var rCost = Number(slot.recruitCost || 1500);
              btnHtml = '<button type="button" class="zab-btn zab-btn-primary" data-zab-action="crew.recruit" data-zab-slot-id="' + esc(sid) + '"' + (state.busyAction ? ' disabled' : '') + '>' +
                (ar ? ('تجنيد (' + fmtMoney(rCost) + ')') : ('Recruit (' + fmtMoney(rCost) + ')')) +
              '</button>';
            } else if (rank < maxRank) {
              var uCost = Number(slot.upgradeCost || slot.nextCost || 3500);
              btnHtml = '<button type="button" class="zab-btn" data-zab-action="crew.upgrade" data-zab-slot-id="' + esc(sid) + '"' + (state.busyAction ? ' disabled' : '') + '>' +
                (ar ? ('ترقية (' + fmtMoney(uCost) + ')') : ('Upgrade (' + fmtMoney(uCost) + ')')) +
              '</button>';
            } else {
              btnHtml = '<button type="button" class="zab-btn" disabled>' + (ar ? 'الحد الأقصى ★5' : 'MAX RANK ★5') + '</button>';
            }

            return (
              '<article class="' + cls + '" data-zab-crew-slot="' + esc(sid) + '">' +
                '<div>' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px">' +
                    '<span class="zab-pill">' + (ar ? ('الرتبة ' + rank + '/' + maxRank) : ('Rank ' + rank + '/' + maxRank)) + '</span>' +
                    '<small style="font-weight:700;color:var(--zab-ochre)"><bdi>+$' + fmtInt(slot.hourlyRate || slot.baseHourlyRate || 0) + '/h</bdi></small>' +
                  '</div>' +
                  '<div class="zab-crew-role" style="margin-top:5px">' + esc(sName) + '</div>' +
                  '<div class="zab-crew-bonus" style="margin-top:3px">' + esc(sPerk) + '</div>' +
                '</div>' +
                btnHtml +
              '</article>'
            );
          }).join('') +
        '</div>' +
      '</section>';

    return feedbackHtml + originBannerHtml + eraSectionHtml + midSectionHtml + crewSectionHtml;
  }

  function bindContainerDelegation(container) {
    if (!container || container.__zabDelegated) return;
    container.__zabDelegated = true;

    container.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-zab-callsign') === '1') {
        state.callsignDraft = String(t.value || '');
      }
    });

    container.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      var openModalBtn = t.closest('[data-zab-open-modal="1"]');
      if (openModalBtn) {
        state.modalOpen = true;
        renderOriginModal();
        return;
      }

      var closeModalBtn = t.closest('[data-zab-close-modal="1"]');
      if (closeModalBtn || t.id === 'zone-origin-awakening-modal') {
        state.modalOpen = false;
        renderOriginModal();
        return;
      }

      var goBtn = t.closest('[data-zab-go-route]');
      if (goBtn) {
        var route = goBtn.getAttribute('data-zab-go-route') || 'crimes';
        navigateToRoute(route);
        return;
      }

      var actBtn = t.closest('[data-zab-action]');
      if (actBtn && !actBtn.disabled) {
        var action = actBtn.getAttribute('data-zab-action');
        if (action === 'origin.select') {
          var originId = actBtn.getAttribute('data-zab-origin-id') || 'harbor_ghost';
          var cs = String(state.callsignDraft || '').trim();
          var pl = { originId: originId };
          if (cs) pl.callsign = cs;
          dispatchAscensionAction('origin.select', pl);
        } else if (action === 'era.claimBreakthrough') {
          var eraIdx = Number(actBtn.getAttribute('data-zab-era-index') || (state.snap && state.snap.eraIndex) || 1);
          dispatchAscensionAction('era.claimBreakthrough', { eraIndex: eraIdx });
        } else if (action === 'luna.claimDirective') {
          var dIdx = Number(actBtn.getAttribute('data-zab-directive-index') || 1);
          dispatchAscensionAction('luna.claimDirective', { directiveIndex: dIdx });
        } else if (action === 'crew.recruit' || action === 'crew.upgrade') {
          var slotId = actBtn.getAttribute('data-zab-slot-id') || 'lookout';
          dispatchAscensionAction(action, { slotId: slotId, crewId: slotId, id: slotId });
        } else {
          dispatchAscensionAction(action, {});
        }
      }
    });
  }

  function scrubContradictoryFactionCard(main) {
    if (!main || main.getAttribute('data-zone-screen') !== 'faction') return;
    if (!main.children) return;
    for (var i = 0; i < main.children.length; i++) {
      var ch = main.children[i];
      if (
        ch.tagName === 'SECTION' &&
        ch.className === 'zone-panel' &&
        !ch.hasAttribute('data-torn-oc2-rackets') &&
        ch.id !== 'zone-rpg-route-section' &&
        ch.id !== 'zone-torn-route-section'
      ) {
        ch.setAttribute('data-zab-hidden-beta', '1');
      }
    }
  }

  function renderHub() {
    if (document.querySelector && document.querySelector('x-dc')) return;
    hookCoreGameMethods();
    var main = document.getElementById('zone-main');
    if (!main) return;

    var scr = main.getAttribute('data-zone-screen') || 'home';
    scrubContradictoryFactionCard(main);

    var existing = document.getElementById('zone-ascension-hub');
    if (scr !== 'home') {
      if (existing) existing.remove();
      return;
    }

    if (!state.snap) {
      state.snap = buildFallbackSnapshot();
    }

    if (!existing) {
      existing = document.createElement('section');
      existing.id = 'zone-ascension-hub';
      existing.setAttribute('data-zab-ready', '1');
      main.appendChild(existing);
      bindContainerDelegation(existing);
    } else if (existing.parentElement !== main) {
      main.appendChild(existing);
    }

    var activeEl = document.activeElement;
    if (activeEl && activeEl.getAttribute && activeEl.getAttribute('data-zab-callsign') === '1') {
      return;
    }

    existing.setAttribute('data-lang', isAr() ? 'ar' : 'en');
    existing.innerHTML = buildHubHtml(state.snap);
  }

  function onRouteOrDomSync() {
    if (document.querySelector && document.querySelector('x-dc')) return;
    hookCoreGameMethods();
    syncHudBars();
    var main = document.getElementById('zone-main');
    var scr = main ? (main.getAttribute('data-zone-screen') || 'home') : 'home';
    renderHub();
    if (scr === 'home' && (Date.now() - state.lastFetchAt) > 4500 && !state.loading) {
      refreshAscension(false);
    }
  }

  function boot() {
    hookCoreGameMethods();
    syncHudBars();
    renderHub();
    refreshAscension(true);

    window.addEventListener('zone:render', onRouteOrDomSync);

    if (typeof MutationObserver === 'function') {
      var mainObs = null;
      var attachMain = function () {
        var main = document.getElementById('zone-main');
        if (!main || mainObs) return Boolean(mainObs);
        mainObs = new MutationObserver(function () {
          onRouteOrDomSync();
        });
        mainObs.observe(main, { attributes: true, attributeFilter: ['data-zone-screen'] });
        return true;
      };
      if (!attachMain() && document.body) {
        var bodyBootObs = new MutationObserver(function () {
          if (attachMain()) {
            bodyBootObs.disconnect();
            onRouteOrDomSync();
          }
        });
        bodyBootObs.observe(document.body, { childList: true, subtree: false });
      }
      if (document.documentElement) {
        var docObs = new MutationObserver(function () {
          syncHudBars();
          renderHub();
          renderOriginModal();
        });
        docObs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'data-theme'] });
      }
    }
  }

  window.ZoneAscension = {
    refresh: refreshAscension,
    act: dispatchAscensionAction,
    syncHudBars: syncHudBars,
    getState: function () { return state.snap; },
    openOriginModal: function () { state.modalOpen = true; renderOriginModal(); },
    closeOriginModal: function () { state.modalOpen = false; renderOriginModal(); },
    render: renderHub
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

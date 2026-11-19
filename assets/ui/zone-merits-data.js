/* ==========================================================================
 * ZONE v145 - TORN-STYLE MERITS, HONORS & MEDALS DATA ENGINE
 * Pure, deterministic bilingual (EN + AR) catalog & gameplay bonus math.
 * Zero DOM dependencies: runs identically in browser (<script defer>) and
 * Node test environments (globalThis.ZoneMeritsData / module.exports).
 * ========================================================================== */
(function (root) {
  'use strict';

  var MAX_RANK = 10;
  var MAX_UPGRADE_COST = (MAX_RANK * (MAX_RANK + 1)) / 2; // 55
  var RESET_FEE = 25000;

  var CATEGORIES = [
    { id: 'core', en: 'Core Attributes', ar: 'السمات الأساسية' },
    { id: 'battle', en: 'Battle Stat Passives', ar: 'مضاعفات القتال' },
    { id: 'ops', en: 'Economy & Operations', ar: 'الاقتصاد والعمليات' },
    { id: 'mastery', en: 'Weapon Masteries & Gym', ar: 'إتقان الأسلحة والنادي' }
  ];

  var HONOR_CATEGORIES = [
    { id: 'starter', en: 'Starter', ar: 'البداية' },
    { id: 'crimes', en: 'Crimes', ar: 'الجرائم' },
    { id: 'combat', en: 'Combat', ar: 'القتال' },
    { id: 'gym', en: 'Gym', ar: 'النادي' },
    { id: 'economy', en: 'Economy', ar: 'الاقتصاد' },
    { id: 'city', en: 'City', ar: 'المدينة' },
    { id: 'syndicate', en: 'Syndicate', ar: 'النقابة' }
  ];

  var MEDAL_TIERS = [
    { index: 0, id: 'bronze', en: 'Bronze', ar: 'برونزي', roman: 'I', color: '#b87333', bg: '#f4e0cc' },
    { index: 1, id: 'silver', en: 'Silver', ar: 'فضي', roman: 'II', color: '#9aa5b1', bg: '#e5eaef' },
    { index: 2, id: 'gold', en: 'Gold', ar: 'ذهبي', roman: 'III', color: '#d4a238', bg: '#f9edcc' },
    { index: 3, id: 'platinum', en: 'Platinum', ar: 'بلاتيني', roman: 'IV', color: '#68b5d4', bg: '#d7eff8' }
  ];

  function fmtVal(n, decimals) {
    if (decimals && decimals > 0) return Number(n).toFixed(decimals);
    return String(Math.round(n));
  }

  function makeUpgrade(spec) {
    return Object.assign({}, spec, {
      maxRank: MAX_RANK,
      formatBonus: function (rank, lang) {
        var r = clampRank(rank);
        var ar = lang === 'ar';
        var val = r * spec.perRank;
        if (spec.id === 'emp') {
          var eff = r;
          var pay = r * 3;
          return ar
            ? ('+' + eff + ' كفاءة · +' + pay + '% أجر')
            : ('+' + eff + ' Eff · +' + pay + '% Pay');
        }
        var sign = spec.negative ? '-' : '+';
        var formatted = sign + fmtVal(val, spec.decimals || 0) + (spec.suffix || '');
        return ar ? (formatted + ' ' + spec.unitAr) : (formatted + ' ' + spec.unitEn);
      },
      formatNext: function (rank, lang) {
        var r = clampRank(rank);
        var ar = lang === 'ar';
        if (r >= MAX_RANK) return ar ? 'الحد الأقصى 10/10' : 'MAX 10/10';
        var nextVal = (r + 1) * spec.perRank;
        if (spec.id === 'emp') {
          return ar
            ? ('التالي: +' + (r + 1) + ' كفاءة و +' + ((r + 1) * 3) + '% أجر')
            : ('Next: +' + (r + 1) + ' Eff & +' + ((r + 1) * 3) + '% Pay');
        }
        var sign = spec.negative ? '-' : '+';
        var formatted = sign + fmtVal(nextVal, spec.decimals || 0) + (spec.suffix || '');
        return ar ? ('التالي: ' + formatted) : ('Next: ' + formatted);
      }
    });
  }

  var UPGRADES = [
    // Core Attributes (5)
    makeUpgrade({
      id: 'nerve', category: 'core', icon: 'nerve',
      en: 'Nerve Bar', ar: 'شريط الجرأة',
      descEn: 'Permanently increases your maximum Nerve bar capacity for street crimes.',
      descAr: 'يزيد السعة القصوى لشريط الجرأة بشكل دائم لتنفيذ مزيد من الجرائم.',
      stepEn: '+1 Max Nerve / rank', stepAr: '+1 جرأة قصوى / رتبة',
      unitEn: 'Max Nerve', unitAr: 'جرأة قصوى',
      perRank: 1, suffix: '', decimals: 0, bonusKey: 'nerveBonus'
    }),
    makeUpgrade({
      id: 'crit', category: 'core', icon: 'crit',
      en: 'Critical Hit Rate', ar: 'معدل الضربة الحرجة',
      descEn: 'Raises your chance to land devastating critical strikes in street combat.',
      descAr: 'يرفع فرصة توجيه ضربات حرجة قاتلة أثناء الاشتباكات الميدانية.',
      stepEn: '+0.5% Crit Rate / rank', stepAr: '+0.5% ضربة حرجة / رتبة',
      unitEn: 'Crit Rate', unitAr: 'حرج',
      perRank: 0.5, suffix: '%', decimals: 1, bonusKey: 'critPct'
    }),
    makeUpgrade({
      id: 'life', category: 'core', icon: 'life',
      en: 'Life Points', ar: 'نقاط الحياة القصوى',
      descEn: 'Boosts your maximum combat health pool by 5% per rank.',
      descAr: 'يرفع إجمالي نقاط الحياة القصوى في القتال بنسبة 5% لكل رتبة.',
      stepEn: '+5% Max Life / rank', stepAr: '+5% صحة قصوى / رتبة',
      unitEn: 'Max Life', unitAr: 'صحة قصوى',
      perRank: 5, suffix: '%', decimals: 0, bonusKey: 'lifePct'
    }),
    makeUpgrade({
      id: 'crime', category: 'core', icon: 'crime',
      en: 'Crime Progression', ar: 'تقدم ومهارة الجرائم',
      descEn: 'Improves crime success probability and earned Crime XP across all tiers.',
      descAr: 'يعزز نسبة نجاح الجرائم وخبرة الجريمة المكتسبة في جميع الفئات.',
      stepEn: '+3% Success & XP / rank', stepAr: '+3% نجاح وخبرة / رتبة',
      unitEn: 'Crime Boost', unitAr: 'نجاح وخبرة',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'crimePct'
    }),
    makeUpgrade({
      id: 'awareness', category: 'core', icon: 'awareness',
      en: 'Awareness', ar: 'الوعي الميداني',
      descEn: 'Increases the spawn rate of rare dropped items across Zone City.',
      descAr: 'يضاعف فرصة العثور على اللقى والعناصر النادرة في أحياء مدينة زون.',
      stepEn: '+20% City Finds / rank', stepAr: '+20% لقى المدينة / رتبة',
      unitEn: 'City Finds', unitAr: 'لقى المدينة',
      perRank: 20, suffix: '%', decimals: 0, bonusKey: 'awarenessPct'
    }),

    // Battle Stat Passives (4)
    makeUpgrade({
      id: 'brawn', category: 'battle', icon: 'brawn',
      en: 'Brawn', ar: 'القوة البدنية',
      descEn: 'Passive Strength multiplier applied directly during street encounters.',
      descAr: 'مضاعف سلبي لصفة القوة يطبّق مباشرة أثناء المواجهات القتالية.',
      stepEn: '+3% Strength / rank', stepAr: '+3% قوة / رتبة',
      unitEn: 'Strength', unitAr: 'قوة',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'brawnPct'
    }),
    makeUpgrade({
      id: 'protection', category: 'battle', icon: 'protection',
      en: 'Protection', ar: 'التحصين والدفاع',
      descEn: 'Passive Defense multiplier that mitigates incoming weapon damage.',
      descAr: 'مضاعف سلبي لصفة الدفاع لتقليل الضرر الوارد في المعارك.',
      stepEn: '+3% Defense / rank', stepAr: '+3% دفاع / رتبة',
      unitEn: 'Defense', unitAr: 'دفاع',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'protectionPct'
    }),
    makeUpgrade({
      id: 'sharpness', category: 'battle', icon: 'sharpness',
      en: 'Sharpness', ar: 'السرعة والدقة',
      descEn: 'Passive Speed multiplier boosting your hit rate against agile targets.',
      descAr: 'مضاعف سلبي للسرعة يرفع دقة إصاباتك ضد الخصوم السريعين.',
      stepEn: '+3% Speed / rank', stepAr: '+3% سرعة / رتبة',
      unitEn: 'Speed', unitAr: 'سرعة',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'sharpnessPct'
    }),
    makeUpgrade({
      id: 'evasion', category: 'battle', icon: 'evasion',
      en: 'Evasion', ar: 'المراوغة والرشاقة',
      descEn: 'Passive Dexterity multiplier helping you dodge enemy counter-strikes.',
      descAr: 'مضاعف سلبي للرشاقة يساعدك على تفادي هجمات الخصوم.',
      stepEn: '+3% Dexterity / rank', stepAr: '+3% رشاقة / رتبة',
      unitEn: 'Dexterity', unitAr: 'رشاقة',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'evasionPct'
    }),

    // Economy & Operations (6)
    makeUpgrade({
      id: 'bank', category: 'ops', icon: 'bank',
      en: 'Bank Interest', ar: 'فائدة خزينة البنك',
      descEn: 'Amplifies daily syndicate vault interest and timed deposit yields.',
      descAr: 'يضاعف عائد الفائدة اليومية للخزينة وشهادات الإيداع الزمنية.',
      stepEn: '+5% Interest / rank', stepAr: '+5% فائدة بنكية / رتبة',
      unitEn: 'Bank Interest', unitAr: 'فائدة بنكية',
      perRank: 5, suffix: '%', decimals: 0, bonusKey: 'bankInterestPct'
    }),
    makeUpgrade({
      id: 'edu', category: 'ops', icon: 'edu',
      en: 'Education Length', ar: 'تقصير مدة التعليم',
      descEn: 'Shortens university course completion timers across every major.',
      descAr: 'يقلّص مدة إتمام الدورات الجامعية الدائمة في مركز التعليم.',
      stepEn: '-2% Course Time / rank', stepAr: '-2% وقت الدراسة / رتبة',
      unitEn: 'Course Time', unitAr: 'مدة الدورة',
      perRank: 2, suffix: '%', decimals: 0, negative: true, bonusKey: 'eduReductionPct'
    }),
    makeUpgrade({
      id: 'emp', category: 'ops', icon: 'emp',
      en: 'Employee Effectiveness', ar: 'كفاءة الموظف والأجر',
      descEn: 'Adds +1 workplace effectiveness and +3% shift pay per rank.',
      descAr: 'يضيف +1 كفاءة مهنية و +3% زيادة على أجر الورديات لكل رتبة.',
      stepEn: '+1 Eff & +3% Pay / rank', stepAr: '+1 كفاءة و +3% أجر / رتبة',
      unitEn: 'Eff & Pay', unitAr: 'كفاءة وأجر',
      perRank: 3, suffix: '%', decimals: 0, bonusKey: 'empPayPct'
    }),
    makeUpgrade({
      id: 'looting', category: 'ops', icon: 'looting',
      en: 'Masterful Looting', ar: 'إتقان النشل والغنائم',
      descEn: 'Increases cash stolen when mugging defeated rivals on the street.',
      descAr: 'يرفع نسبة النقد المنهوب عند نشل الخصوم المهزومين في الشارع.',
      stepEn: '+5% Mug Loot / rank', stepAr: '+5% غنيمة النشل / رتبة',
      unitEn: 'Mug Loot', unitAr: 'غنيمة نشل',
      perRank: 5, suffix: '%', decimals: 0, bonusKey: 'mugPct'
    }),
    makeUpgrade({
      id: 'hosp', category: 'ops', icon: 'hosp',
      en: 'Hospitalizing', ar: 'إطالة وقت المستشفى',
      descEn: 'Extends outgoing hospital time inflicted on opponents you hospitalize.',
      descAr: 'يزيد مدة بقاء الخصوم في المستشفى عند إسقاطهم في القتال.',
      stepEn: '+5% Outgoing Hosp / rank', stepAr: '+5% مدة مستشفى الخصم / رتبة',
      unitEn: 'Hosp Time', unitAr: 'وقت المستشفى',
      perRank: 5, suffix: '%', decimals: 0, bonusKey: 'hospPct'
    }),
    makeUpgrade({
      id: 'stealth', category: 'ops', icon: 'stealth',
      en: 'Stealth', ar: 'التخفي والعمليات الصامتة',
      descEn: 'Hides your identity during street attacks and reduces heat trace.',
      descAr: 'يرفع معدل التخفي لإخفاء هويتك أثناء الهجمات وتقليل التتبع.',
      stepEn: '+0.2 Stealth / rank', stepAr: '+0.2 تخفي / رتبة',
      unitEn: 'Stealth', unitAr: 'تخفي',
      perRank: 0.2, suffix: '', decimals: 1, bonusKey: 'stealthBonus'
    }),

    // Weapon Masteries & Gym (5)
    makeUpgrade({
      id: 'gym', category: 'mastery', icon: 'gym',
      en: 'Gym Conditioning', ar: 'مضاعف تدريب النادي',
      descEn: 'Increases battle stat gains from every Gym training session.',
      descAr: 'يزيد مكاسب الصفات القتالية في كل جلسة تدريب داخل النادي الرياضي.',
      stepEn: '+2% Gym Gains / rank', stepAr: '+2% مكاسب النادي / رتبة',
      unitEn: 'Gym Gains', unitAr: 'مكاسب النادي',
      perRank: 2, suffix: '%', decimals: 0, bonusKey: 'gymPct'
    }),
    makeUpgrade({
      id: 'rifle', category: 'mastery', icon: 'rifle',
      en: 'Rifle & Heavy Mastery', ar: 'إتقان البنادق والأسلحة الثقيلة',
      descEn: 'Boosts damage and accuracy with rifles, carbines, and sniper systems.',
      descAr: 'يرفع الضرر والدقة عند استخدام البنادق الهجومية والقناصات.',
      stepEn: '+2% Dmg & Acc / rank', stepAr: '+2% ضرر ودقة / رتبة',
      unitEn: 'Rifle Dmg & Acc', unitAr: 'ضرر ودقة البنادق',
      perRank: 2, suffix: '%', decimals: 0, bonusKey: 'riflePct'
    }),
    makeUpgrade({
      id: 'smg', category: 'mastery', icon: 'smg',
      en: 'SMG & Shotgun Mastery', ar: 'إتقان الرشاشات والبنادق القصيرة',
      descEn: 'Boosts damage and accuracy with submachine guns and shotguns.',
      descAr: 'يرفع الضرر والدقة عند القتال بالرشاشات الخفيفة والخرطوش.',
      stepEn: '+2% Dmg & Acc / rank', stepAr: '+2% ضرر ودقة / رتبة',
      unitEn: 'SMG/Shotgun', unitAr: 'ضرر الرشاشات',
      perRank: 2, suffix: '%', decimals: 0, bonusKey: 'smgPct'
    }),
    makeUpgrade({
      id: 'pistol', category: 'mastery', icon: 'pistol',
      en: 'Pistol Mastery', ar: 'إتقان المسدسات',
      descEn: 'Boosts damage and accuracy with pistols, revolvers, and sidearms.',
      descAr: 'يرفع الضرر والدقة عند استخدام المسدسات التكتيكية والريفولفر.',
      stepEn: '+2% Dmg & Acc / rank', stepAr: '+2% ضرر ودقة / رتبة',
      unitEn: 'Pistol Dmg & Acc', unitAr: 'ضرر المسدسات',
      perRank: 2, suffix: '%', decimals: 0, bonusKey: 'pistolPct'
    }),
    makeUpgrade({
      id: 'melee', category: 'mastery', icon: 'melee',
      en: 'Melee Mastery', ar: 'إتقان الأسلحة البيضاء',
      descEn: 'Boosts damage and accuracy with knives, bats, blades, and fists.',
      descAr: 'يرفع الضرر والدقة عند استخدام الخناجر والمضارب والأسلحة اليدوية.',
      stepEn: '+2% Dmg & Acc / rank', stepAr: '+2% ضرر ودقة / رتبة',
      unitEn: 'Melee Dmg & Acc', unitAr: 'ضرر السلاح الأبيض',
      perRank: 2, suffix: '%', decimals: 0, bonusKey: 'meleePct'
    })
  ];

  var UPGRADE_MAP = {};
  for (var ui = 0; ui < UPGRADES.length; ui++) {
    UPGRADE_MAP[UPGRADES[ui].id] = UPGRADES[ui];
  }

  var HOME_UPGRADE_IDS = ['nerve', 'life', 'crit', 'gym', 'awareness', 'emp'];

  function clampRank(rank) {
    var n = Math.floor(Number(rank) || 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n > MAX_RANK ? MAX_RANK : n;
  }

  function normalizeMeritTree(rawTree) {
    var out = {};
    var src = rawTree && typeof rawTree === 'object' ? rawTree : {};
    for (var i = 0; i < UPGRADES.length; i++) {
      var id = UPGRADES[i].id;
      out[id] = clampRank(src[id]);
    }
    return out;
  }

  function upgradeCost(currentRank) {
    var r = clampRank(currentRank);
    return r >= MAX_RANK ? null : r + 1;
  }

  function spentOnUpgrade(rank) {
    var r = clampRank(rank);
    return (r * (r + 1)) / 2;
  }

  function totalSpent(meritTree) {
    var tree = normalizeMeritTree(meritTree);
    var sum = 0;
    for (var i = 0; i < UPGRADES.length; i++) {
      sum += spentOnUpgrade(tree[UPGRADES[i].id]);
    }
    return sum;
  }

  function resetCost(meritResets) {
    return (Number(meritResets) || 0) <= 0 ? 0 : RESET_FEE;
  }

  function computeBonuses(meritTree) {
    var t = normalizeMeritTree(meritTree);
    return {
      nerveBonus: t.nerve * 1,
      lifePct: t.life * 5,
      critPct: Number((t.crit * 0.5).toFixed(2)),
      crimePct: t.crime * 3,
      awarenessPct: t.awareness * 20,
      brawnPct: t.brawn * 3,
      protectionPct: t.protection * 3,
      sharpnessPct: t.sharpness * 3,
      evasionPct: t.evasion * 3,
      bankInterestPct: t.bank * 5,
      eduReductionPct: t.edu * 2,
      empEff: t.emp * 1,
      empPayPct: t.emp * 3,
      mugPct: t.looting * 5,
      hospPct: t.hosp * 5,
      stealthBonus: Number((t.stealth * 0.2).toFixed(2)),
      gymPct: t.gym * 2,
      riflePct: t.rifle * 2,
      smgPct: t.smg * 2,
      pistolPct: t.pistol * 2,
      meleePct: t.melee * 2
    };
  }

  /* ------------------------------------------------------------------------
   * PLAYER STAT EXTRACTORS (pure, safe against partial/fresh player objects)
   * ------------------------------------------------------------------------ */
  function safeNum(v) {
    var n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function playerTotalStats(player) {
    var s = (player && player.stats) || {};
    return safeNum(s.str) + safeNum(s.def) + safeNum(s.spd) + safeNum(s.dex);
  }

  function playerLiquidWealth(player) {
    return safeNum(player && player.cash) + safeNum(player && player.bankBalance);
  }

  function playerNetWorth(player) {
    if (player && Number.isFinite(Number(player.netWorth))) return Math.max(0, Number(player.netWorth));
    return playerLiquidWealth(player);
  }

  function playerHasWeapon(player) {
    if (!player) return false;
    if (player.equip && player.equip !== 'fists') return true;
    var inv = player.inv || {};
    var keys = Object.keys(inv);
    for (var i = 0; i < keys.length; i++) {
      if (safeNum(inv[keys[i]]) > 0 && !/^(smallkit|medkit|drink|pills|sand|armor|vest)$/i.test(keys[i])) {
        return true;
      }
    }
    return false;
  }

  function playerOwnedPropsCount(player) {
    if (!player) return 0;
    if (Array.isArray(player.ownedProperties)) return player.ownedProperties.length;
    if (player.ownedProperties && typeof player.ownedProperties === 'object') {
      return Object.keys(player.ownedProperties).filter(function (k) { return !!player.ownedProperties[k]; }).length;
    }
    return player.prop && player.prop !== 'shack' ? 2 : 1;
  }

  function playerEduDoneCount(player) {
    var done = (player && player.eduDone) || {};
    return Object.keys(done).filter(function (k) { return !!done[k]; }).length;
  }

  function playerClaimedSpawnsCount(player) {
    var sp = (player && player.claimedCitySpawns) || {};
    return Object.keys(sp).filter(function (k) { return !!sp[k]; }).length;
  }

  function playerMissionsAndShifts(player) {
    var claimed = (player && player.claimed) || {};
    var missionCount = Object.keys(claimed).filter(function (k) { return !!claimed[k]; }).length;
    var shifts = safeNum(player && player.ctr && player.ctr.shifts);
    return missionCount + shifts;
  }

  function mkProg(cur, target) {
    var c = Math.max(0, Math.floor(Number(cur) || 0));
    var t = Math.max(1, Math.floor(Number(target) || 1));
    return { cur: Math.min(c, t), raw: c, target: t, unlocked: c >= t };
  }

  /* ------------------------------------------------------------------------
   * 24 COLLECTIBLE HONORS (7 categories, custom watercolor Honor Bars)
   * ------------------------------------------------------------------------ */
  var HONORS = [
    // Starter (3) - first 2 immediately ready on fresh guest accounts!
    {
      id: 'h_first_steps', category: 'starter', merits: 1,
      en: 'Arrival in Zone City', ar: 'الوصول إلى مدينة زون',
      reqEn: 'Step onto the streets of Zone City and activate your dossier.',
      reqAr: 'ادخل شوارع مدينة زون وفعّل ملفك الميداني.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#2e6f5e', bg2: '#1a3f3a', accent: '#e5b84b', icon: 'compass' },
      progress: function () { return mkProg(1, 1); }
    },
    {
      id: 'h_cash_2500', category: 'starter', merits: 1,
      en: 'Street Bankroll', ar: 'رأس مال الشارع',
      reqEn: 'Hold $2,500 or more in cash and bank funds.',
      reqAr: 'امتلك 2,500$ أو أكثر بين النقد والبنك.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#3b7a44', bg2: '#1f4728', accent: '#f0c954', icon: 'cash' },
      progress: function (p) { return mkProg(playerLiquidWealth(p), 2500); }
    },
    {
      id: 'h_first_level', category: 'starter', merits: 1,
      en: 'Rising Initiate', ar: 'المبتدئ الصاعد',
      reqEn: 'Reach Operative Level 2 in Zone City.',
      reqAr: 'صل إلى المستوى 2 في مدينة زون.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#365b8c', bg2: '#1d3252', accent: '#80c7f2', icon: 'star' },
      progress: function (p) { return mkProg(safeNum(p && p.level), 2); }
    },

    // Crimes (4)
    {
      id: 'h_petty_thief', category: 'crimes', merits: 1,
      en: 'Petty Hustler', ar: 'محتال الشوارع',
      reqEn: 'Commit 5 street crimes across any category.',
      reqAr: 'نفّذ 5 جرائم شوارع في أي فئة.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#7d3430', bg2: '#421a18', accent: '#f2a444', icon: 'mask' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.crimes), 5); }
    },
    {
      id: 'h_crime_syndicate', category: 'crimes', merits: 1,
      en: 'Underworld Operator', ar: 'منفّذ العالم السفلي',
      reqEn: 'Commit 50 syndicate crimes.',
      reqAr: 'نفّذ 50 جريمة منظمة في المدينة.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#6e2538', bg2: '#33111c', accent: '#ef6b6b', icon: 'crowbar' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.crimes), 50); }
    },
    {
      id: 'h_crime_xp_250', category: 'crimes', merits: 1,
      en: 'Street Tactician', ar: 'تكتيكي الشوارع',
      reqEn: 'Accumulate 250 Crime Experience.',
      reqAr: 'اجمع 250 نقطة من خبرة الجرائم.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#533569', bg2: '#291738', accent: '#d89bf7', icon: 'cipher' },
      progress: function (p) { return mkProg(safeNum(p && p.crimeXp), 250); }
    },
    {
      id: 'h_crimes_1000', category: 'crimes', merits: 1,
      en: 'Mastermind of Zone', ar: 'العقل المدبر لزون',
      reqEn: 'Complete 1,000 crimes across Zone City.',
      reqAr: 'أكمل 1,000 جريمة عبر شوارع مدينة زون.',
      rarityEn: 'Mythic', rarityAr: 'أسطوري',
      banner: { bg1: '#4a1717', bg2: '#1a090c', accent: '#ffd166', icon: 'crown' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.crimes), 1000); }
    },

    // Combat (4)
    {
      id: 'h_first_blood', category: 'combat', merits: 1,
      en: 'First Blood', ar: 'أول دم',
      reqEn: 'Win your first street combat encounter.',
      reqAr: 'اربح أول مواجهة قتالية في الشارع.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#9c2d2d', bg2: '#4d1414', accent: '#ffb74d', icon: 'blade' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.wins), 1); }
    },
    {
      id: 'h_armed_ready', category: 'combat', merits: 1,
      en: 'Locked & Loaded', ar: 'مسلّح وجاهز',
      reqEn: 'Own or equip any weapon in your arsenal.',
      reqAr: 'امتلك أو جهّز أي سلاح في ترسانتك.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#4b5563', bg2: '#1f242b', accent: '#f5b82e', icon: 'crosshair' },
      progress: function (p) { return mkProg(playerHasWeapon(p) ? 1 : 0, 1); }
    },
    {
      id: 'h_enforcer_25', category: 'combat', merits: 1,
      en: 'Street Enforcer', ar: 'منفّذ الشوارع',
      reqEn: 'Defeat 25 rivals in street combat.',
      reqAr: 'اهزم 25 خصماً في مواجهات الشوارع.',
      rarityEn: 'Rare', rarityAr: 'نادر',
      banner: { bg1: '#85203b', bg2: '#380d1a', accent: '#ff7b89', icon: 'skull' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.wins), 25); }
    },
    {
      id: 'h_ipecac', category: 'combat', merits: 1,
      en: 'Bitter Medicine', ar: 'شراب الإيبيكاك المر',
      reqEn: 'Survive a hospitalization or trigger the Ipecac / Wrong Blood Bag ritual.',
      reqAr: 'انجُ من دخول المستشفى أو فعّل تحدي شراب الإيبيكاك.',
      rarityEn: 'Rare', rarityAr: 'نادر',
      banner: { bg1: '#2f6d7a', bg2: '#163840', accent: '#ff6b6b', icon: 'medcross' },
      progress: function (p) {
        var hit = Boolean((p && p.claimedHonors && p.claimedHonors.h_ipecac) || safeNum(p && p.hospUntil) > 0 || safeNum(p && p.ctr && p.ctr.hosp) >= 1);
        return mkProg(hit ? 1 : 0, 1);
      }
    },

    // Gym (3)
    {
      id: 'h_gym_rat', category: 'gym', merits: 1,
      en: 'Iron Discipline', ar: 'انضباط الحديد',
      reqEn: 'Complete 4 Gym training sessions.',
      reqAr: 'أتمم 4 جلسات تدريب في النادي الرياضي.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#9c5124', bg2: '#4f2610', accent: '#ffd06b', icon: 'dumbbell' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.trains), 4); }
    },
    {
      id: 'h_total_stats_500', category: 'gym', merits: 1,
      en: 'Heavy Hitter', ar: 'الضارب الثقيل',
      reqEn: 'Reach 500 Total Battle Stats.',
      reqAr: 'صل إلى مجموع 500 في الصفات القتالية.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#b5671f', bg2: '#59300e', accent: '#ffe184', icon: 'fist' },
      progress: function (p) { return mkProg(playerTotalStats(p), 500); }
    },
    {
      id: 'h_total_stats_5000', category: 'gym', merits: 1,
      en: 'Apex Contender', ar: 'منافس القمة',
      reqEn: 'Reach 5,000 Total Battle Stats.',
      reqAr: 'صل إلى مجموع 5,000 في الصفات القتالية.',
      rarityEn: 'Rare', rarityAr: 'نادر',
      banner: { bg1: '#7a2c16', bg2: '#331109', accent: '#ffae42', icon: 'flame' },
      progress: function (p) { return mkProg(playerTotalStats(p), 5000); }
    },

    // Economy (4)
    {
      id: 'h_vault_opener', category: 'economy', merits: 1,
      en: 'Vault Depositor', ar: 'عميل الخزينة',
      reqEn: 'Secure $10,000 or more inside the Central Bank vault.',
      reqAr: 'أودع 10,000$ أو أكثر داخل خزينة البنك المركزي.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#236b58', bg2: '#10362c', accent: '#7ae8b8', icon: 'vault' },
      progress: function (p) { return mkProg(safeNum(p && p.bankBalance), 10000); }
    },
    {
      id: 'h_high_roller', category: 'economy', merits: 1,
      en: 'High Roller', ar: 'صاحب الثروة',
      reqEn: 'Build an empire Net Worth of $100,000.',
      reqAr: 'ارفع صافي ثروتك الإجمالية إلى 100,000$.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#8f6c1e', bg2: '#42310c', accent: '#ffe07d', icon: 'diamond' },
      progress: function (p) { return mkProg(playerNetWorth(p), 100000); }
    },
    {
      id: 'h_millionaire', category: 'economy', merits: 1,
      en: 'Syndicate Millionaire', ar: 'مليونير النقابة',
      reqEn: 'Amass $1,000,000 in total Net Worth.',
      reqAr: 'اجمع صافي ثروة بقيمة 1,000,000$.',
      rarityEn: 'Epic', rarityAr: 'ملحمي',
      banner: { bg1: '#7c5812', bg2: '#2e1f06', accent: '#ffd75e', icon: 'goldbars' },
      progress: function (p) { return mkProg(playerNetWorth(p), 1000000); }
    },
    {
      id: 'h_working_class', category: 'economy', merits: 1,
      en: 'Honest Paycheck', ar: 'الراتب المنتظم',
      reqEn: 'Complete 5 work shifts at your city job.',
      reqAr: 'أكمل 5 ورديات عمل في وظيفتك بالمدينة.',
      rarityEn: 'Common', rarityAr: 'شائع',
      banner: { bg1: '#355c7d', bg2: '#1c3145', accent: '#f8b195', icon: 'briefcase' },
      progress: function (p) { return mkProg(safeNum(p && p.ctr && p.ctr.shifts), 5); }
    },

    // City (3)
    {
      id: 'h_property_owner', category: 'city', merits: 1,
      en: 'Moving On Up', ar: 'الانتقال لمسكن أرقى',
      reqEn: 'Upgrade or lease a residence beyond the starting Shack.',
      reqAr: 'اشترِ أو استأجر عقاراً أفضل من الكوخ الأساسي.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#2e7075', bg2: '#16383b', accent: '#f3c669', icon: 'key' },
      progress: function (p) {
        var upgraded = Boolean((p && p.prop && p.prop !== 'shack') || playerOwnedPropsCount(p) > 1 || (p && p.propertyLease && safeNum(p.propertyLease.daysLeft) > 0));
        return mkProg(upgraded ? 1 : 0, 1);
      }
    },
    {
      id: 'h_scholar', category: 'city', merits: 1,
      en: 'City Scholar', ar: 'خريج الأكاديمية',
      reqEn: 'Complete at least 1 permanent Education course.',
      reqAr: 'أنهِ دورة تعليمية دائمة واحدة على الأقل.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#3e4a89', bg2: '#1f254a', accent: '#a2d2ff', icon: 'cap' },
      progress: function (p) { return mkProg(playerEduDoneCount(p), 1); }
    },
    {
      id: 'h_treasure_hunter', category: 'city', merits: 1,
      en: 'Keen Eyes', ar: 'عين الصقر',
      reqEn: 'Spot and claim a dropped item on the City Map.',
      reqAr: 'اعثر على لقطة مرمية والتقطها من خريطة المدينة.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#4d6b3b', bg2: '#233619', accent: '#d8f37a', icon: 'eye' },
      progress: function (p) { return mkProg(playerClaimedSpawnsCount(p), 1); }
    },

    // Syndicate (3)
    {
      id: 'h_family_blood', category: 'syndicate', merits: 1,
      en: 'Made Operative', ar: 'عضو النقابة المعتمد',
      reqEn: 'Join a Syndicate Family or earn 100 Faction Respect.',
      reqAr: 'انضم إلى عائلة نقابية أو اجمع 100 احترام للعائلة.',
      rarityEn: 'Uncommon', rarityAr: 'غير شائع',
      banner: { bg1: '#2d5a42', bg2: '#122b1e', accent: '#7ce39c', icon: 'shield' },
      progress: function (p) {
        var respect = safeNum(p && p.fac && p.fac.respect);
        var inFac = Boolean(p && (p.playerFactionId || (p.sharedFamily && p.sharedFamily.id)));
        return mkProg(inFac ? 100 : respect, 100);
      }
    },
    {
      id: 'h_chain_10', category: 'syndicate', merits: 1,
      en: 'Chain Breaker', ar: 'قائد السلاسل',
      reqEn: 'Achieve a Faction Chain of 10 or more hits.',
      reqAr: 'حقق سلسلة هجمات للعائلة من 10 ضربات أو أكثر.',
      rarityEn: 'Rare', rarityAr: 'نادر',
      banner: { bg1: '#6e4522', bg2: '#331d0c', accent: '#f7b267', icon: 'chain' },
      progress: function (p) {
        var best = Math.max(safeNum(p && p.fac && p.fac.chain), safeNum(p && p.fac && p.fac.best));
        return mkProg(best, 10);
      }
    },
    {
      id: 'h_merit_investor', category: 'syndicate', merits: 1,
      en: 'Student of Power', ar: 'خبير الميرتس',
      reqEn: 'Invest 10 or more Merits into permanent character upgrades.',
      reqAr: 'استثمر 10 نقاط ميرت أو أكثر في ترقيات شخصيتك.',
      rarityEn: 'Rare', rarityAr: 'نادر',
      banner: { bg1: '#5c3c7a', bg2: '#28183b', accent: '#ffd166', icon: 'laurel' },
      progress: function (p) { return mkProg(totalSpent(p && p.meritTree), 10); }
    }
  ];

  var HONOR_MAP = {};
  for (var hi = 0; hi < HONORS.length; hi++) {
    HONOR_MAP[HONORS[hi].id] = HONORS[hi];
  }

  /* ------------------------------------------------------------------------
   * 8 PROGRESSIVE 4-TIER MEDALS (Bronze / Silver / Gold / Platinum = 32 tiers)
   * ------------------------------------------------------------------------ */
  var MEDALS = [
    {
      id: 'm_crimes', icon: 'crime',
      en: 'Syndicate Criminal', ar: 'مجرم النقابة',
      descEn: 'Commit street crimes across Zone City.',
      descAr: 'نفّذ جرائم الشوارع عبر أحياء مدينة زون.',
      unitEn: 'crimes', unitAr: 'جريمة',
      thresholds: [5, 25, 100, 500],
      value: function (p) { return safeNum(p && p.ctr && p.ctr.crimes); }
    },
    {
      id: 'm_combat', icon: 'combat',
      en: 'Street Gladiator', ar: 'مقاتل الشوارع',
      descEn: 'Win street combat encounters against rivals.',
      descAr: 'انتصر في مواجهات القتال ضد خصوم المدينة.',
      unitEn: 'wins', unitAr: 'انتصار',
      thresholds: [1, 10, 50, 250],
      value: function (p) { return safeNum(p && p.ctr && p.ctr.wins); }
    },
    {
      id: 'm_gym', icon: 'gym',
      en: 'Iron Athlete', ar: 'رياضي الحديد',
      descEn: 'Build your combined Battle Stats in the Gym.',
      descAr: 'طوّر مجموع صفاتك القتالية داخل النادي الرياضي.',
      unitEn: 'total stats', unitAr: 'إجمالي الصفات',
      thresholds: [100, 500, 2500, 10000],
      value: function (p) { return Math.floor(playerTotalStats(p)); }
    },
    {
      id: 'm_networth', icon: 'networth',
      en: 'Empire Tycoon', ar: 'قطب الإمبراطورية',
      descEn: 'Grow your total Net Worth across cash, bank, and assets.',
      descAr: 'نمّ صافي ثروتك بين النقد والبنك والأصول.',
      unitEn: '$ net worth', unitAr: '$ صافي ثروة',
      thresholds: [10000, 100000, 1000000, 10000000],
      value: function (p) { return Math.floor(playerNetWorth(p)); }
    },
    {
      id: 'm_level', icon: 'level',
      en: 'Rising Capo', ar: 'صعود الزعيم',
      descEn: 'Climb the Operative Level hierarchy.',
      descAr: 'ارتقِ في سلّم مستويات العميل داخل النقابة.',
      unitEn: 'level', unitAr: 'المستوى',
      thresholds: [2, 5, 15, 30],
      value: function (p) { return Math.floor(safeNum(p && p.level)); }
    },
    {
      id: 'm_bank', icon: 'bank',
      en: 'Vault Keeper', ar: 'أمين الخزينة',
      descEn: 'Hold protected capital inside the Central Bank vault.',
      descAr: 'احتفظ برصيد محمي داخل خزينة البنك المركزي.',
      unitEn: '$ vaulted', unitAr: '$ بالبنك',
      thresholds: [5000, 50000, 250000, 2000000],
      value: function (p) { return Math.floor(safeNum(p && p.bankBalance)); }
    },
    {
      id: 'm_casino', icon: 'casino',
      en: 'Velvet Shark', ar: 'قرش الكازينو',
      descEn: 'Rack up net winnings on Zone Casino tables.',
      descAr: 'حقق أرباحاً صافية على طاولات كازينو زون.',
      unitEn: '$ won', unitAr: '$ أرباح',
      thresholds: [1000, 10000, 100000, 500000],
      value: function (p) { return Math.floor(Math.max(0, Number(p && p.casinoNet) || 0)); }
    },
    {
      id: 'm_missions', icon: 'missions',
      en: 'Contract Finisher', ar: 'منجز العقود',
      descEn: 'Complete missions and work shifts for the syndicate.',
      descAr: 'أكمل المهام وورديات العمل لصالح النقابة.',
      unitEn: 'ops', unitAr: 'مهمة/وردية',
      thresholds: [1, 5, 15, 40],
      value: function (p) { return playerMissionsAndShifts(p); }
    }
  ];

  var MEDAL_MAP = {};
  for (var mi = 0; mi < MEDALS.length; mi++) {
    MEDAL_MAP[MEDALS[mi].id] = MEDALS[mi];
  }

  function evaluateHonors(player, claimedHonors) {
    var claimedMap = claimedHonors && typeof claimedHonors === 'object' ? claimedHonors : {};
    var results = [];
    for (var i = 0; i < HONORS.length; i++) {
      var h = HONORS[i];
      var prog = h.progress(player || {});
      var claimed = Boolean(claimedMap[h.id]);
      var unlocked = Boolean(prog.unlocked || claimed);
      var pct = Math.min(100, Math.round((prog.cur / Math.max(1, prog.target)) * 100));
      results.push({
        id: h.id,
        category: h.category,
        en: h.en,
        ar: h.ar,
        reqEn: h.reqEn,
        reqAr: h.reqAr,
        merits: h.merits || 1,
        rarityEn: h.rarityEn,
        rarityAr: h.rarityAr,
        banner: h.banner,
        cur: unlocked ? prog.target : prog.cur,
        raw: prog.raw,
        target: prog.target,
        pct: unlocked ? 100 : pct,
        unlocked: unlocked,
        claimed: claimed,
        ready: unlocked && !claimed
      });
    }
    return results;
  }

  function isMedalTierClaimed(claimedMedals, medalId, tierIndex) {
    if (!claimedMedals || typeof claimedMedals !== 'object') return false;
    var key = medalId + '_' + tierIndex;
    if (claimedMedals[key]) return true;
    var numeric = Number(claimedMedals[medalId]);
    if (Number.isFinite(numeric) && numeric >= tierIndex + 1) return true;
    return false;
  }

  function evaluateMedals(player, claimedMedals) {
    var claimedMap = claimedMedals && typeof claimedMedals === 'object' ? claimedMedals : {};
    var results = [];
    for (var i = 0; i < MEDALS.length; i++) {
      var m = MEDALS[i];
      var cur = m.value(player || {});
      var tiers = [];
      var unlockedCount = 0;
      var claimedCount = 0;
      var readyCount = 0;
      var nextTier = null;
      var nextClaimable = null;

      for (var tIdx = 0; tIdx < MEDAL_TIERS.length; tIdx++) {
        var meta = MEDAL_TIERS[tIdx];
        var target = m.thresholds[tIdx];
        var key = m.id + '_' + tIdx;
        var claimed = isMedalTierClaimed(claimedMap, m.id, tIdx);
        var unlocked = cur >= target || claimed;
        var ready = unlocked && !claimed;
        if (unlocked) unlockedCount++;
        if (claimed) claimedCount++;
        if (ready) readyCount++;
        var tierObj = {
          index: tIdx,
          key: key,
          id: meta.id,
          nameEn: meta.en,
          nameAr: meta.ar,
          roman: meta.roman,
          color: meta.color,
          bg: meta.bg,
          target: target,
          unlocked: unlocked,
          claimed: claimed,
          ready: ready,
          merits: 1
        };
        tiers.push(tierObj);
        if (!unlocked && !nextTier) nextTier = tierObj;
        if (ready && !nextClaimable) nextClaimable = tierObj;
      }

      var pctToNext = nextTier
        ? Math.min(100, Math.round((cur / Math.max(1, nextTier.target)) * 100))
        : 100;

      results.push({
        id: m.id,
        icon: m.icon,
        en: m.en,
        ar: m.ar,
        descEn: m.descEn,
        descAr: m.descAr,
        unitEn: m.unitEn,
        unitAr: m.unitAr,
        cur: cur,
        tiers: tiers,
        unlockedCount: unlockedCount,
        claimedCount: claimedCount,
        readyCount: readyCount,
        highestTierIndex: unlockedCount > 0 ? unlockedCount - 1 : -1,
        nextTier: nextTier,
        nextClaimable: nextClaimable,
        pctToNext: pctToNext
      });
    }
    return results;
  }

  function getSummary(player, meritTree, claimedHonors, claimedMedals) {
    var honors = evaluateHonors(player, claimedHonors);
    var medals = evaluateMedals(player, claimedMedals);
    var spent = totalSpent(meritTree);
    var available = Math.max(0, Math.floor(Number(player && player.merits) || 0));
    var honorsUnlocked = 0;
    var honorsClaimed = 0;
    var readyHonorsCount = 0;
    for (var i = 0; i < honors.length; i++) {
      if (honors[i].unlocked) honorsUnlocked++;
      if (honors[i].claimed) honorsClaimed++;
      if (honors[i].ready) readyHonorsCount++;
    }
    var medalsUnlocked = 0;
    var medalsClaimed = 0;
    var readyMedalsCount = 0;
    for (var j = 0; j < medals.length; j++) {
      medalsUnlocked += medals[j].unlockedCount;
      medalsClaimed += medals[j].claimedCount;
      readyMedalsCount += medals[j].readyCount;
    }
    return {
      availableMerits: available,
      spentMerits: spent,
      totalMeritsPool: available + spent,
      honorsUnlocked: honorsUnlocked,
      honorsClaimed: honorsClaimed,
      honorsTotal: HONORS.length,
      medalsUnlocked: medalsUnlocked,
      medalsClaimed: medalsClaimed,
      medalsTotal: MEDALS.length * MEDAL_TIERS.length,
      readyHonorsCount: readyHonorsCount,
      readyMedalsCount: readyMedalsCount,
      totalReadyCount: readyHonorsCount + readyMedalsCount,
      resetCost: resetCost(player && player.meritResets)
    };
  }

  var ZoneMeritsData = {
    VERSION: 145,
    MAX_RANK: MAX_RANK,
    MAX_UPGRADE_COST: MAX_UPGRADE_COST,
    RESET_FEE: RESET_FEE,
    CATEGORIES: CATEGORIES,
    HONOR_CATEGORIES: HONOR_CATEGORIES,
    MEDAL_TIERS: MEDAL_TIERS,
    UPGRADES: UPGRADES,
    UPGRADE_MAP: UPGRADE_MAP,
    HOME_UPGRADE_IDS: HOME_UPGRADE_IDS,
    HONORS: HONORS,
    HONOR_MAP: HONOR_MAP,
    MEDALS: MEDALS,
    MEDAL_MAP: MEDAL_MAP,
    clampRank: clampRank,
    normalizeMeritTree: normalizeMeritTree,
    upgradeCost: upgradeCost,
    spentOnUpgrade: spentOnUpgrade,
    totalSpent: totalSpent,
    resetCost: resetCost,
    computeBonuses: computeBonuses,
    evaluateHonors: evaluateHonors,
    evaluateMedals: evaluateMedals,
    getSummary: getSummary
  };

  if (typeof window !== 'undefined') window.ZoneMeritsData = ZoneMeritsData;
  if (typeof globalThis !== 'undefined') globalThis.ZoneMeritsData = ZoneMeritsData;
  if (typeof root !== 'undefined' && root) root.ZoneMeritsData = ZoneMeritsData;
  if (typeof module !== 'undefined' && module.exports) module.exports = ZoneMeritsData;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

/* ==========================================================================
 * ZONE v145 - TORN-STYLE AWARDS & MERITS HUB UI RUNTIME (SKETCHBOOK EDITION)
 * Authentic Torn page.php?sid=awards&tab=merits in Fountain-Pen Ink & Gouache
 * 100% 4-Way Parity: Light+EN, Dark+EN, Light+AR (RTL), Dark+AR (RTL)
 * Exclusive Ownership: merits-ui (assets/ui/zone-merits-awards.js / .css)
 * Consumes: window.ZoneMeritsData & window.ZoneMeritsBridge (from merits-engine)
 * Exposes:  window.ZoneMeritsUI = { open(tab), close(), refresh(), isOpen(), getActiveTab() }
 * Fiber-safe: append-only DOM integration, never mutates React/<x-dc> children.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneMeritsAwardsUILoaded) return;
  window.__zoneMeritsAwardsUILoaded = true;

  var hubOpen = false;
  var activeTab = 'merits';
  var meritFilter = 'all';
  var honorFilter = 'all';
  var resetConfirmOpen = false;
  var feedbackState = null; // { text, tone }
  var deepLinkHandled = false;
  var rafPending = false;
  var lastScreenObserved = '';
  var lastRenderSignature = '';

  /* ------------------------------------------------------------------------
   * 1. BILINGUAL COPY DICTIONARY (EN + AR)
   * ------------------------------------------------------------------------ */
  var COPY = {
    en: {
      hubTitle: 'Awards & Merits',
      hubSub: 'Permanent Torn-Style Upgrades, Collectible Honor Bars & Progressive Medals',
      backToGame: '← Back to Game',
      overviewTitle: 'Merit & Award Ledger',
      overviewTag: 'COST: 1 → 2 → … → 10 (55 MAX)',
      overviewBody:
        'Earn +1 Merit every time you claim an unlocked Honor Bar or Medal tier. Invest Merits into permanent 10-rank upgrades that apply live to Nerve, Life, Gym gains, Crimes, Combat, Bank interest, and more. Upgrading rank N costs N merits (1 to 10).',
      kpiAvailable: 'Available Merits',
      kpiAvailableSub: 'Ready to invest',
      kpiSpent: 'Merits Spent',
      kpiSpentSub: 'Across 20 upgrades',
      kpiHonors: 'Honors Unlocked',
      kpiHonorsSub: 'Claimable & earned',
      kpiMedals: 'Medal Tiers',
      kpiMedalsSub: 'Bronze → Platinum',
      claimAll: 'Claim All Ready',
      resetBtn: 'Reset Merits',
      resetConfirmFree: 'Refund all {spent} spent merits? (Free 1st reset)',
      resetConfirmPaid: 'Refund all {spent} spent merits for {cost}? (All upgrades reset to 0/10)',
      confirmReset: 'Confirm Reset',
      cancel: 'Cancel',
      tabMerits: 'Merits',
      tabHonors: 'Honors',
      tabMedals: 'Medals',
      awardsBtn: 'Awards',
      navAwards: 'Awards & Merits',
      sidebarTitle: 'Open Torn Awards & Merits Hub',
      catMerits: {
        all: 'All',
        core: 'Core Attributes',
        battle: 'Battle Stats',
        ops: 'Economy & Ops',
        mastery: 'Weapon Masteries'
      },
      catHonors: {
        all: 'All',
        starter: 'Starter',
        crimes: 'Crimes',
        combat: 'Combat',
        gym: 'Gym',
        economy: 'Economy',
        city: 'City',
        syndicate: 'Syndicate'
      },
      upgrade: 'Upgrade',
      needMerits: 'Need',
      maxed: 'MAX 10/10',
      nextCost: 'Next rank cost',
      meritUnit: 'Merit',
      meritsUnit: 'Merits',
      rank: 'Rank',
      nextBonus: 'next',
      currentBonus: 'Active',
      claimHonor: 'Claim (+1 Merit)',
      equipBanner: 'Equip Banner',
      equipped: 'Equipped ✓',
      unequipHint: 'Click to unequip',
      claimTier: 'Claim Tier (+1 Merit)',
      allTiersDone: 'Platinum Master ✓',
      nextTier: 'Next tier',
      tierLocked: 'Unranked',
      metals: {
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        platinum: 'Platinum'
      },
      honorBadgeTag: 'HONOR',
      readyTag: 'Ready',
      claimedTag: 'Claimed',
      msgUpgraded: 'Upgraded {name} to Rank {rank}/10!',
      msgReset: 'Merits refunded! All upgrades reset to 0/10.',
      msgClaimedAll: 'Claimed {count} awards (+{merits} Merits)!',
      msgClaimedOne: 'Claimed {name} (+1 Merit)!',
      msgEquipped: 'Equipped Honor Bar: {name}',
      msgUnequipped: 'Unequipped Honor Bar.',
      msgEngineLoading: 'Loading Awards & Merits ledger…'
    },
    ar: {
      hubTitle: 'الأوسمة والميرتس',
      hubSub: 'تطويرات دائمة بأسلوب تورن، شارات الشرف، والميداليات التراكمية',
      backToGame: 'العودة للعبة →',
      overviewTitle: 'دفتر الأوسمة ونقاط الميرتس',
      overviewTag: 'التكلفة: 1 ← 2 ← … ← 10 (55 كحد أقصى)',
      overviewBody:
        'اكسب +1 ميرتس عند استلام كل شارة شرف أو مستوى ميدالية جديد. استثمر الميرتس في 20 تطويراً دائماً من 10 مستويات تؤثر فوراً على الجرأة، الصحة، مكاسب النادي، الجرائم، القتال، وفوائد البنك. تكلفة المستوى N هي N ميرتس.',
      kpiAvailable: 'الميرتس المتاحة',
      kpiAvailableSub: 'جاهزة للاستثمار',
      kpiSpent: 'الميرتس المصروفة',
      kpiSpentSub: 'عبر 20 تطويراً',
      kpiHonors: 'شارات الشرف',
      kpiHonorsSub: 'مفتوحة ومكتسبة',
      kpiMedals: 'مستويات الميداليات',
      kpiMedalsSub: 'برونزي ← بلاتيني',
      claimAll: 'استلام الكل',
      resetBtn: 'إعادة تعيين الميرتس',
      resetConfirmFree: 'استرداد كل {spent} ميرتس مصروفة؟ (إعادة التعيين الأولى مجانية)',
      resetConfirmPaid: 'استرداد كل {spent} ميرتس مقابل {cost}؟ (تعود كل التطويرات إلى 0/10)',
      confirmReset: 'تأكيد الإعادة',
      cancel: 'إلغاء',
      tabMerits: 'الميرتس',
      tabHonors: 'شارات الشرف',
      tabMedals: 'الميداليات',
      awardsBtn: 'الأوسمة',
      navAwards: 'الأوسمة والميرتس',
      sidebarTitle: 'افتح مركز الأوسمة والميرتس',
      catMerits: {
        all: 'الكل',
        core: 'الصفات الأساسية',
        battle: 'مهارات القتال',
        ops: 'الاقتصاد والعمليات',
        mastery: 'إتقان الأسلحة'
      },
      catHonors: {
        all: 'الكل',
        starter: 'البداية',
        crimes: 'الجرائم',
        combat: 'القتال',
        gym: 'النادي',
        economy: 'الاقتصاد',
        city: 'المدينة',
        syndicate: 'النقابة'
      },
      upgrade: 'تطوير',
      needMerits: 'تحتاج',
      maxed: 'الحد الأقصى 10/10',
      nextCost: 'تكلفة المستوى التالي',
      meritUnit: 'ميرتس',
      meritsUnit: 'ميرتس',
      rank: 'المستوى',
      nextBonus: 'التالي',
      currentBonus: 'مفعّل',
      claimHonor: 'استلام (+1 ميرتس)',
      equipBanner: 'تجهيز الشارة',
      equipped: 'مجهّزة ✓',
      unequipHint: 'اضغط لإلغاء التجهيز',
      claimTier: 'استلام المستوى (+1 ميرتس)',
      allTiersDone: 'بلاتيني مكتمل ✓',
      nextTier: 'المستوى التالي',
      tierLocked: 'غير مصنّف',
      metals: {
        bronze: 'برونزي',
        silver: 'فضي',
        gold: 'ذهبي',
        platinum: 'بلاتيني'
      },
      honorBadgeTag: 'شرف',
      readyTag: 'جاهز',
      claimedTag: 'مُستلم',
      msgUpgraded: 'تم تطوير {name} إلى المستوى {rank}/10!',
      msgReset: 'تم استرداد جميع الميرتس وإعادة التطويرات إلى 0/10.',
      msgClaimedAll: 'تم استلام {count} وسام (+{merits} ميرتس)!',
      msgClaimedOne: 'تم استلام {name} (+1 ميرتس)!',
      msgEquipped: 'تم تجهيز شارة الشرف: {name}',
      msgUnequipped: 'تم إزالة شارة الشرف من ملفك.',
      msgEngineLoading: 'جاري تحميل سجل الأوسمة والميرتس…'
    }
  };

  function isArabic() {
    var d = document.documentElement;
    return Boolean(d && (d.lang === 'ar' || d.dir === 'rtl'));
  }

  function L() {
    return isArabic() ? COPY.ar : COPY.en;
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInt(n) {
    var num = Math.max(0, Math.round(Number(n) || 0));
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatMoney(n) {
    return '$' + formatInt(n);
  }

  function formatCompact(n) {
    var val = Math.max(0, Number(n) || 0);
    if (val >= 1000000000) return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 10000) return Math.round(val / 1000) + 'K';
    return formatInt(val);
  }

  function pickLoc(obj, keyEn, keyAr, fallback) {
    if (!obj) return fallback || '';
    var ar = isArabic();
    if (ar && obj[keyAr]) return obj[keyAr];
    if (!ar && obj[keyEn]) return obj[keyEn];
    if (obj.name && typeof obj.name === 'object') {
      return (ar ? obj.name.ar : obj.name.en) || obj.name.en || fallback || '';
    }
    if (obj.title && typeof obj.title === 'object') {
      return (ar ? obj.title.ar : obj.title.en) || obj.title.en || fallback || '';
    }
    return obj[keyEn] || obj[keyAr] || fallback || '';
  }

  /* ------------------------------------------------------------------------
   * 2. HAND-INKED WATERCOLOR SVG ICON LIBRARY (20 MERITS + TABS + MEDALS)
   * ------------------------------------------------------------------------ */
  function inkSvg(washMarkup, strokePath, extraClass) {
    return (
      '<svg class="zwc-sketch-ico' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        washMarkup +
        '<path class="zwc-ink-stroke" d="' + strokePath + '" fill="none" stroke="var(--zwc-svg-ink, currentColor)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  var MERIT_ICONS = {
    nerve: inkSvg(
      '<path class="zwc-wash-fill" d="M12 3.4C15.8 7.2 18.2 10.3 18.2 14A6.2 6.2 0 0 1 5.8 14C5.8 11 7.8 8.3 9.8 6.2L10.8 9.2L12 3.4Z" fill="#e63946"/><path class="zwc-accent-fill" d="M12 10.4C13.7 12.2 14.6 13.7 14.6 15.2A2.6 2.6 0 0 1 9.4 15.2C9.4 13.7 10.4 12.2 12 10.4Z" fill="#f5b82e"/>',
      'M12 3.4C15.8 7.2 18.2 10.3 18.2 14A6.2 6.2 0 0 1 5.8 14C5.8 11 7.8 8.3 9.8 6.2L10.8 9.2L12 3.4Z'
    ),
    crit: inkSvg(
      '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.2" fill="#f59e0b"/><circle class="zwc-accent-fill" cx="12" cy="12" r="3" fill="#e63946"/>',
      'M12 3V6.5M12 17.5V21M3 12H6.5M17.5 12H21M19.2 12A7.2 7.2 0 1 1 4.8 12A7.2 7.2 0 0 1 19.2 12ZM12 12H12.02'
    ),
    life: inkSvg(
      '<path class="zwc-wash-fill" d="M12 20.2C6.8 16.4 3.8 12.9 3.8 9.3A4.5 4.5 0 0 1 12 6.8A4.5 4.5 0 0 1 20.2 9.3C20.2 12.9 17.2 16.4 12 20.2Z" fill="#f43f6e"/>',
      'M12 20.2C6.8 16.4 3.8 12.9 3.8 9.3A4.5 4.5 0 0 1 12 6.8A4.5 4.5 0 0 1 20.2 9.3C20.2 12.9 17.2 16.4 12 20.2ZM7.4 12H9.9L11.2 9.6L12.8 14.3L14.1 12H16.6'
    ),
    crime: inkSvg(
      '<rect class="zwc-wash-fill" x="4.5" y="10" width="15" height="9.8" rx="2" fill="#ea7234"/><circle class="zwc-accent-fill" cx="12" cy="14.6" r="2.1" fill="#f5b82e"/>',
      'M8 10V7.2A4 4 0 0 1 16 7.2V10M4.5 10H19.5V19.8H4.5V10ZM12 13.2V16.2'
    ),
    awareness: inkSvg(
      '<path class="zwc-wash-fill" d="M2.8 12C5.2 7.6 8.3 5.6 12 5.6C15.7 5.6 18.8 7.6 21.2 12C18.8 16.4 15.7 18.4 12 18.4C8.3 18.4 5.2 16.4 2.8 12Z" fill="#2da4e8"/><circle class="zwc-accent-fill" cx="12" cy="12" r="3.2" fill="#f5b82e"/>',
      'M2.8 12C5.2 7.6 8.3 5.6 12 5.6C15.7 5.6 18.8 7.6 21.2 12C18.8 16.4 15.7 18.4 12 18.4C8.3 18.4 5.2 16.4 2.8 12ZM15.2 12A3.2 3.2 0 1 1 8.8 12A3.2 3.2 0 0 1 15.2 12Z'
    ),
    brawn: inkSvg(
      '<rect class="zwc-accent-fill" x="7.8" y="10.8" width="8.4" height="2.4" rx="0.8" fill="#2da4e8"/><rect class="zwc-wash-fill" x="4.2" y="7.4" width="3.8" height="9.2" rx="1" fill="#e63946"/><rect class="zwc-wash-fill" x="16" y="7.4" width="3.8" height="9.2" rx="1" fill="#e63946"/>',
      'M2.2 12H4.2M19.8 12H21.8M8 12H16M4.2 7.4H8V16.6H4.2V7.4ZM16 7.4H19.8V16.6H16V7.4Z'
    ),
    protection: inkSvg(
      '<path class="zwc-wash-fill" d="M12 3.2L19.4 6.2V12C19.4 16.5 16.2 19.6 12 20.8C7.8 19.6 4.6 16.5 4.6 12V6.2L12 3.2Z" fill="#3b82f6"/><path class="zwc-accent-fill" d="M12 6.5L16.2 8.2V11.8C16.2 14.5 14.4 16.4 12 17.4C9.6 16.4 7.8 14.5 7.8 11.8V8.2L12 6.5Z" fill="#f5b82e"/>',
      'M12 3.2L19.4 6.2V12C19.4 16.5 16.2 19.6 12 20.8C7.8 19.6 4.6 16.5 4.6 12V6.2L12 3.2ZM12 7.5V16.5M8.5 11.6H15.5'
    ),
    sharpness: inkSvg(
      '<path class="zwc-wash-fill" d="M13.4 3L5.4 13.2H11.5L10.4 21L18.6 10.6H12.5L13.4 3Z" fill="#f5b82e"/>',
      'M13.4 3L5.4 13.2H11.5L10.4 21L18.6 10.6H12.5L13.4 3Z'
    ),
    evasion: inkSvg(
      '<path class="zwc-wash-fill" d="M4.2 15.2C6.4 9.2 11.2 6.2 18.8 5.2C17.8 12.8 14.8 17.6 8.8 19.8L4.2 15.2Z" fill="#14b8a6"/><circle class="zwc-accent-fill" cx="13.8" cy="10.2" r="2.2" fill="#f5b82e"/>',
      'M4.2 15.2C6.4 9.2 11.2 6.2 18.8 5.2C17.8 12.8 14.8 17.6 8.8 19.8L4.2 15.2ZM4.2 19.8L9.6 14.4'
    ),
    bank: inkSvg(
      '<path class="zwc-wash-fill" d="M3.4 9.6L12 3.8L20.6 9.6H3.4Z" fill="#22b56b"/><rect class="zwc-accent-fill" x="5.4" y="9.8" width="13.2" height="7.4" fill="#f5b82e"/><rect class="zwc-wash-fill" x="3.6" y="17.2" width="16.8" height="2.6" fill="#22b56b"/>',
      'M3.4 9.6L12 3.8L20.6 9.6H3.4ZM6.6 9.6V17.2M10.2 9.6V17.2M13.8 9.6V17.2M17.4 9.6V17.2M3.6 17.2H20.4V19.8H3.6V17.2Z'
    ),
    edu: inkSvg(
      '<path class="zwc-wash-fill" d="M6.5 11.6V16.4C6.5 18 9 19.4 12 19.4C15 19.4 17.5 18 17.5 16.4V11.6H6.5Z" fill="#3b82f6"/><path class="zwc-wash-fill" d="M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5Z" fill="#5c7cfa"/><circle class="zwc-accent-fill" cx="20" cy="15.4" r="1.6" fill="#f5b82e"/>',
      'M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5ZM6.5 11.6V16.4C6.5 18 9 19.4 12 19.4C15 19.4 17.5 18 17.5 16.4V11.6M20 9.8V15'
    ),
    emp: inkSvg(
      '<rect class="zwc-wash-fill" x="3.8" y="7.8" width="16.4" height="12" rx="2" fill="#3b82f6"/><rect class="zwc-accent-fill" x="10.2" y="11" width="3.6" height="3.2" rx="0.8" fill="#f5b82e"/>',
      'M8.8 7.8V5.6C8.8 4.7 9.5 4 10.4 4H13.6C14.5 4 15.2 4.7 15.2 5.6V7.8M3.8 7.8H20.2V19.8H3.8V7.8ZM3.8 12.6H20.2'
    ),
    looting: inkSvg(
      '<path class="zwc-wash-fill" d="M6.2 9.4H17.8L19.4 19.4H4.6L6.2 9.4Z" fill="#f5b82e"/><circle class="zwc-accent-fill" cx="12" cy="14.5" r="2.7" fill="#22b56b"/>',
      'M8.6 9.4L7.2 5.2H16.8L15.4 9.4M6.2 9.4H17.8L19.4 19.4H4.6L6.2 9.4ZM12 12.2V16.8'
    ),
    hosp: inkSvg(
      '<rect class="zwc-wash-fill" x="4.4" y="5" width="15.2" height="14.4" rx="2.2" fill="#2da4e8"/><path class="zwc-accent-fill" d="M10.4 8.2H13.6V10.8H16.2V14H13.6V16.6H10.4V14H7.8V10.8H10.4V8.2Z" fill="#e63946"/>',
      'M4.4 5H19.6V19.4H4.4V5ZM12 8.6V16M8.4 12.3H15.6'
    ),
    stealth: inkSvg(
      '<path class="zwc-wash-fill" d="M4.2 13.8C4.8 9.2 8 6 12 6C16 6 19.2 9.2 19.8 13.8L17.4 18.8H6.6L4.2 13.8Z" fill="#688cb8"/><circle class="zwc-accent-fill" cx="9.2" cy="13.2" r="1.5" fill="#f5b82e"/><circle class="zwc-accent-fill" cx="14.8" cy="13.2" r="1.5" fill="#f5b82e"/>',
      'M4.2 13.8C4.8 9.2 8 6 12 6C16 6 19.2 9.2 19.8 13.8L17.4 18.8H6.6L4.2 13.8ZM8.4 13.2H10M14 13.2H15.6'
    ),
    gym: inkSvg(
      '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.4" fill="#22b56b"/><path class="zwc-accent-fill" d="M12 6.8L13.8 10.6L18 11.2L15 14.1L15.7 18.2L12 16.2L8.3 18.2L9 14.1L6 11.2L10.2 10.6L12 6.8Z" fill="#f5b82e"/>',
      'M19.4 12A7.4 7.4 0 1 1 4.6 12A7.4 7.4 0 0 1 19.4 12ZM12 7.2L13.5 10.4L17 10.9L14.5 13.4L15.1 16.8L12 15.2L8.9 16.8L9.5 13.4L7 10.9L10.5 10.4L12 7.2Z'
    ),
    rifle: inkSvg(
      '<path class="zwc-wash-fill" d="M3 10.5H15.5L17.5 13H13.5L12.5 16.5H10L10.5 13H6.5L4.5 16H2.5L3 10.5Z" fill="#ea7234"/><rect class="zwc-accent-fill" x="15" y="10.2" width="6.2" height="2" rx="0.6" fill="#3b82f6"/><rect class="zwc-accent-fill" x="8" y="8" width="4.8" height="2" rx="0.6" fill="#f5b82e"/>',
      'M2.8 10.6H21.2M15.4 10.6L17.2 13H13.4L12.4 17H9.8L10.4 13H6.4L4.4 16.2H2.5L3 10.6M8.2 8.2H12.8V10.6H8.2V8.2Z'
    ),
    smg: inkSvg(
      '<path class="zwc-wash-fill" d="M2.8 11.2H16.4V13.8H11.2L9.2 16.6H5.2L6.8 13.8H2.8V11.2Z" fill="#b85233"/><rect class="zwc-accent-fill" x="15.8" y="10.4" width="5.6" height="2.2" rx="0.6" fill="#688cb8"/><rect class="zwc-accent-fill" x="10.2" y="13.4" width="5" height="1.8" rx="0.6" fill="#f5b82e"/>',
      'M2.8 11.2H21.4M16 10.2H21.4V12.6H16M2.8 11.2V13.8H7L5 16.6H9.2L11.2 13.8H16.4V11.2'
    ),
    pistol: inkSvg(
      '<path class="zwc-wash-fill" d="M4.2 8.4H19.4V12.4H11.6L10.2 18.2H6.4L8.2 12.4H4.2V8.4Z" fill="#3b82f6"/><rect class="zwc-accent-fill" x="5.8" y="8.8" width="12.2" height="2.4" fill="#f5b82e"/>',
      'M4.2 8.4H19.6V12.4H11.6L10.2 18.2H6.4L8.2 12.4H4.2V8.4ZM11.6 12.4C11.6 14.2 13.2 14.6 14 13.4'
    ),
    melee: inkSvg(
      '<path class="zwc-wash-fill" d="M18.6 4.4L19.6 5.4L10.8 14.2L8.4 11.8L18.6 4.4Z" fill="#e63946"/><path class="zwc-accent-fill" d="M7.6 11.2L12.8 16.4L11.4 17.8L9.6 16L6.2 19.4L4.6 17.8L8 14.4L6.2 12.6L7.6 11.2Z" fill="#f5b82e"/>',
      'M19.4 4.6L10.6 13.8M19.4 4.6L14.2 5.4L8.4 11.6M7.4 11L13 16.6M8.8 14.6L5 18.4L6.2 19.6L10 15.8'
    ),
    star: inkSvg(
      '<path class="zwc-wash-fill" d="M12 3.2L14.7 8.7L20.8 9.6L16.4 13.8L17.4 19.9L12 17L6.6 19.9L7.6 13.8L3.2 9.6L9.3 8.7L12 3.2Z" fill="#f5b82e"/>',
      'M12 3.2L14.7 8.7L20.8 9.6L16.4 13.8L17.4 19.9L12 17L6.6 19.9L7.6 13.8L3.2 9.6L9.3 8.7L12 3.2Z'
    ),
    ribbon: inkSvg(
      '<rect class="zwc-wash-fill" x="3.5" y="6.2" width="17" height="11.6" rx="2" fill="#a855f7"/><path class="zwc-accent-fill" d="M12 8.4L13.3 11L16.2 11.4L14.1 13.4L14.6 16.2L12 14.9L9.4 16.2L9.9 13.4L7.8 11.4L10.7 11L12 8.4Z" fill="#f5b82e"/>',
      'M3.5 6.2H20.5V17.8H3.5V6.2ZM12 8.6L13.2 11L15.8 11.4L13.9 13.2L14.3 15.8L12 14.6L9.7 15.8L10.1 13.2L8.2 11.4L10.8 11L12 8.6Z'
    ),
    medal: inkSvg(
      '<path class="zwc-accent-fill" d="M7.5 3.5H16.5L14.5 9.8H9.5L7.5 3.5Z" fill="#e63946"/><circle class="zwc-wash-fill" cx="12" cy="15" r="5.6" fill="#f5b82e"/>',
      'M7.5 3.5H16.5L14.5 9.8H9.5L7.5 3.5ZM17.6 15A5.6 5.6 0 1 1 6.4 15A5.6 5.6 0 0 1 17.6 15ZM12 12.6V17.4M9.6 15H14.4'
    )
  };

  function getMeritIcon(id) {
    return MERIT_ICONS[id] || MERIT_ICONS.star;
  }

  function getHonorEmblemSvg(iconName) {
    var k = String(iconName || '').toLowerCase();
    if (k === 'mask' || k === 'crowbar' || k === 'cipher' || k.indexOf('crime') >= 0) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.2"/></svg>';
    }
    if (k === 'blade' || k === 'crosshair' || k === 'skull' || k.indexOf('combat') >= 0) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
    }
    if (k === 'medcross') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
    }
    if (k === 'dumbbell' || k === 'fist' || k === 'flame' || k.indexOf('gym') >= 0) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 10v4M21 10v4M6.5 12h11"/></svg>';
    }
    if (k === 'cash' || k === 'vault' || k === 'diamond' || k === 'goldbars' || k === 'briefcase') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2"/></svg>';
    }
    if (k === 'compass' || k === 'key' || k === 'eye' || k === 'cap') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
    }
    if (k === 'crown' || k === 'shield' || k === 'chain' || k === 'laurel') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3.5V12c0 4.5-3.3 7.8-8 9-4.7-1.2-8-4.5-8-9V6.5L12 3z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.8 8.6 21 9.5 16.5 13.9 17.6 20 12 17.1 6.4 20 7.5 13.9 3 9.5 9.2 8.6 12 3"/></svg>';
  }

  /* Custom Hand-Inked Metallic Gouache Medal Crest SVG (Bronze / Silver / Gold / Platinum) */
  function renderMedalCrestSvg(metalKey) {
    var palettes = {
      locked: { outer: '#6e6559', inner: '#8a8072', ribbon: '#4f4840', star: '#e6decb' },
      bronze: { outer: '#b87333', inner: '#d9985a', ribbon: '#8f2c1f', star: '#fff3dc' },
      silver: { outer: '#9aa5b1', inner: '#cfd8e3', ribbon: '#29578c', star: '#ffffff' },
      gold: { outer: '#d4a238', inner: '#f7d674', ribbon: '#9e2626', star: '#fffef5' },
      platinum: { outer: '#68b5d4', inner: '#b3e5f8', ribbon: '#4e3c82', star: '#ffffff' }
    };
    var pal = palettes[metalKey] || palettes.locked;
    return (
      '<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        /* Ribbon tails */
        '<path d="M15 4H26L23 22H18L15 4Z" fill="' + pal.ribbon + '" stroke="var(--zwc-svg-ink, #1e1b18)" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<path d="M41 4H30L33 22H38L41 4Z" fill="' + pal.ribbon + '" stroke="var(--zwc-svg-ink, #1e1b18)" stroke-width="1.8" stroke-linejoin="round"/>' +
        /* Scalloped outer medallion */
        '<circle cx="28" cy="35" r="17" fill="' + pal.outer + '" stroke="var(--zwc-svg-ink, #1e1b18)" stroke-width="2"/>' +
        '<circle cx="28" cy="35" r="12.5" fill="' + pal.inner + '" stroke="var(--zwc-svg-ink, #1e1b18)" stroke-width="1.3" stroke-dasharray="3 2"/>' +
        /* Gouache highlight arc */
        '<path d="M19.5 27.5A12 12 0 0 1 32 23.5" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>' +
        /* Center star */
        '<path d="M28 26.2L30.4 31.1L35.8 31.9L31.9 35.7L32.8 41.1L28 38.5L23.2 41.1L24.1 35.7L20.2 31.9L25.6 31.1L28 26.2Z" fill="' + pal.star + '" stroke="var(--zwc-svg-ink, #1e1b18)" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------------------
   * 3. ENGINE BRIDGE STATE ADAPTER (DEFENSIVE & LIVE)
   * ------------------------------------------------------------------------ */
  function readHubState() {
    var data = window.ZoneMeritsData || null;
    var bridge = window.ZoneMeritsBridge || null;
    var raw = null;

    if (bridge && typeof bridge.getState === 'function') {
      try {
        raw = bridge.getState();
      } catch (_) {
        raw = null;
      }
    }

    var game = window.__zoneGame || null;
    var player = (raw && raw.player) || (game && game.p) || {};

    var upgradesCatalog =
      (raw && Array.isArray(raw.upgrades) && raw.upgrades) ||
      (data && Array.isArray(data.UPGRADES) && data.UPGRADES) ||
      (data && Array.isArray(data.MERIT_UPGRADES) && data.MERIT_UPGRADES) ||
      (data && Array.isArray(data.upgrades) && data.upgrades) ||
      [];

    var meritTree = (raw && raw.meritTree) || (player && player.meritTree) || {};
    var availableMerits = Number(
      raw && raw.availableMerits != null ? raw.availableMerits :
      raw && raw.merits != null ? raw.merits :
      raw && raw.available != null ? raw.available :
      player && player.merits != null ? player.merits : 0
    ) || 0;

    var spentMerits = Number(
      raw && raw.spentMerits != null ? raw.spentMerits :
      raw && raw.spent != null ? raw.spent :
      (data && typeof data.totalSpent === 'function' ? data.totalSpent(meritTree) : 0)
    ) || 0;

    var meritResets = Number(
      raw && raw.meritResets != null ? raw.meritResets :
      player && player.meritResets != null ? player.meritResets : 0
    ) || 0;

    var resetCost = Number(
      raw && raw.resetCost != null ? raw.resetCost :
      (meritResets === 0 ? 0 : 25000)
    );

    var claimedHonors = (raw && raw.claimedHonors) || (player && player.claimedHonors) || {};
    var claimedMedals = (raw && raw.claimedMedals) || (player && player.claimedMedals) || {};
    var equippedHonor = (raw && raw.equippedHonor !== undefined ? raw.equippedHonor : player && player.equippedHonor) || null;

    var honorsEval = [];
    if (raw && Array.isArray(raw.honors)) {
      honorsEval = raw.honors;
    } else if (data && typeof data.evaluateHonors === 'function') {
      try {
        var hRes = data.evaluateHonors(player, claimedHonors);
        honorsEval = Array.isArray(hRes) ? hRes : (hRes && Array.isArray(hRes.list) ? hRes.list : []);
      } catch (_) {}
    }

    var medalsEval = [];
    if (raw && Array.isArray(raw.medals)) {
      medalsEval = raw.medals;
    } else if (data && typeof data.evaluateMedals === 'function') {
      try {
        var mRes = data.evaluateMedals(player, claimedMedals);
        medalsEval = Array.isArray(mRes) ? mRes : (mRes && Array.isArray(mRes.list) ? mRes.list : []);
      } catch (_) {}
    }

    /* Normalize Honors (matches ZoneMeritsData.evaluateHonors exact contract) */
    var readyHonors = 0;
    var claimedHonorsCount = 0;
    var honorsList = [];
    for (var i = 0; i < honorsEval.length; i++) {
      var h = honorsEval[i];
      if (!h) continue;
      var hClaimed = Boolean(h.claimed || (claimedHonors && claimedHonors[h.id]));
      var hUnlocked = Boolean(h.unlocked || hClaimed || (Number(h.cur) >= Number(h.target) && Number(h.target) > 0));
      var hReady = Boolean(h.ready != null ? h.ready : (h.claimable != null ? h.claimable : (hUnlocked && !hClaimed)));
      if (hReady) readyHonors++;
      if (hClaimed) claimedHonorsCount++;
      var hBanner = h.banner || h.palette || {};
      honorsList.push({
        id: h.id,
        category: h.category || 'starter',
        titleEn: h.en || h.titleEn || h.nameEn || h.id,
        titleAr: h.ar || h.titleAr || h.nameAr || h.en || h.id,
        descEn: h.reqEn || h.descEn || '',
        descAr: h.reqAr || h.descAr || h.reqEn || '',
        rarityEn: h.rarityEn || '',
        rarityAr: h.rarityAr || '',
        bg1: hBanner.bg1 || h.bg1 || '#2f5675',
        bg2: hBanner.bg2 || h.bg2 || '#593d68',
        accent: hBanner.accent || h.accent || '#f0c465',
        icon: hBanner.icon || h.icon || h.category || 'star',
        cur: Number(h.cur) || 0,
        target: Math.max(1, Number(h.target) || 1),
        unlocked: hUnlocked,
        claimed: hClaimed,
        claimable: hReady,
        equipped: Boolean(equippedHonor && equippedHonor === h.id)
      });
    }

    /* Normalize Medals (matches ZoneMeritsData.evaluateMedals exact contract) */
    var readyMedals = 0;
    var claimedMedalTiers = 0;
    var totalMedalTiers = 0;
    var metalOrder = ['bronze', 'silver', 'gold', 'platinum'];
    var medalsList = [];
    for (var j = 0; j < medalsEval.length; j++) {
      var m = medalsEval[j];
      if (!m) continue;
      var rawTiers = Array.isArray(m.tiers) ? m.tiers : [];
      var normTiers = [];
      var highestMetal = 'locked';
      var nextTierTarget = null;
      var firstClaimableIdx = -1;
      for (var ti = 0; ti < rawTiers.length; ti++) {
        var td = rawTiers[ti];
        totalMedalTiers++;
        var tTarget = typeof td === 'number' ? td : Number(td.target || td.threshold || 1);
        var tMetal = (td && (td.id || td.metal)) || metalOrder[ti] || 'gold';
        var tClaimed = Boolean(
          (td && td.claimed) ||
          (claimedMedals && claimedMedals[m.id + '_' + ti]) ||
          (claimedMedals && Number(claimedMedals[m.id]) > ti)
        );
        var mCur = Number(m.cur != null ? m.cur : m.value) || 0;
        var tUnlocked = Boolean((td && td.unlocked) || tClaimed || mCur >= tTarget);
        var tClaimable = Boolean(
          td && td.ready != null ? td.ready :
          (td && td.claimable != null ? td.claimable : (tUnlocked && !tClaimed))
        );
        if (tClaimed) {
          claimedMedalTiers++;
          highestMetal = tMetal;
        }
        if (tClaimable) {
          readyMedals++;
          if (firstClaimableIdx === -1) firstClaimableIdx = ti;
        }
        if (!tUnlocked && nextTierTarget === null) {
          nextTierTarget = tTarget;
        }
        normTiers.push({
          index: ti,
          metal: tMetal,
          roman: (td && td.roman) || ['I', 'II', 'III', 'IV'][ti] || String(ti + 1),
          target: tTarget,
          unlocked: tUnlocked,
          claimed: tClaimed,
          claimable: tClaimable
        });
      }
      var curVal = Number(m.cur != null ? m.cur : m.value) || 0;
      var maxTarget = normTiers.length ? normTiers[normTiers.length - 1].target : 1;
      var isMoneyMedal = String(m.unitEn || m.unit || '').trim().indexOf('$') === 0;
      medalsList.push({
        id: m.id,
        titleEn: m.en || m.titleEn || m.nameEn || m.id,
        titleAr: m.ar || m.titleAr || m.nameAr || m.en || m.id,
        descEn: m.descEn || '',
        descAr: m.descAr || m.descEn || '',
        unit: isMoneyMedal ? '$' : '',
        unitEn: m.unitEn || '',
        unitAr: m.unitAr || '',
        cur: curVal,
        nextTarget: nextTierTarget != null ? nextTierTarget : maxTarget,
        highestMetal: highestMetal,
        firstClaimableIdx: firstClaimableIdx,
        tiers: normTiers
      });
    }

    /* Normalize Upgrades (matches ZoneMeritsData.UPGRADES exact contract) */
    var upgradesList = [];
    for (var u = 0; u < upgradesCatalog.length; u++) {
      var up = upgradesCatalog[u];
      if (!up) continue;
      var rank = Math.max(0, Math.min(10, Number(meritTree[up.id]) || 0));
      var nextCost = rank >= 10 ? null : (
        data && typeof data.upgradeCost === 'function' ? data.upgradeCost(rank) : rank + 1
      );
      var spentOnThis =
        data && typeof data.spentOnUpgrade === 'function'
          ? data.spentOnUpgrade(rank)
          : (rank * (rank + 1)) / 2;
      upgradesList.push({
        id: up.id,
        category: up.category || 'core',
        nameEn: up.en || up.nameEn || up.titleEn || up.id,
        nameAr: up.ar || up.nameAr || up.titleAr || up.en || up.id,
        descEn: up.descEn || '',
        descAr: up.descAr || up.descEn || '',
        stepEn: up.stepEn || '',
        stepAr: up.stepAr || '',
        perRank: up.perRank != null ? up.perRank : 1,
        unit: up.suffix != null ? up.suffix : '%',
        prefix: up.negative ? '-' : '+',
        bonusLabelEn: up.unitEn || up.bonusLabelEn || '',
        bonusLabelAr: up.unitAr || up.bonusLabelAr || '',
        formatBonus: typeof up.formatBonus === 'function' ? up.formatBonus : null,
        formatNext: typeof up.formatNext === 'function' ? up.formatNext : null,
        rank: rank,
        nextCost: nextCost,
        spent: spentOnThis,
        affordable: nextCost !== null && availableMerits >= nextCost
      });
    }

    var equippedHonorObj = null;
    if (equippedHonor) {
      for (var k = 0; k < honorsList.length; k++) {
        if (honorsList[k].id === equippedHonor) {
          equippedHonorObj = honorsList[k];
          break;
        }
      }
    }

    return {
      ready: Boolean(data || bridge),
      availableMerits: availableMerits,
      spentMerits: spentMerits,
      meritResets: meritResets,
      resetCost: resetCost,
      upgrades: upgradesList,
      honors: honorsList,
      medals: medalsList,
      readyHonors: readyHonors,
      readyMedals: readyMedals,
      totalReady: readyHonors + readyMedals,
      claimedHonorsCount: claimedHonorsCount,
      totalHonorsCount: honorsList.length || 24,
      claimedMedalTiers: claimedMedalTiers,
      totalMedalTiers: totalMedalTiers || 32,
      equippedHonor: equippedHonor,
      equippedHonorObj: equippedHonorObj
    };
  }

  function formatBonusPill(up) {
    var lang = isArabic() ? 'ar' : 'en';
    if (typeof up.formatBonus === 'function') {
      var curStr = up.formatBonus(up.rank, lang);
      if (up.rank >= 10) return curStr;
      var nextStr = typeof up.formatNext === 'function' ? up.formatNext(up.rank, lang) : '';
      return nextStr ? (curStr + ' · ' + nextStr) : curStr;
    }
    var ar = lang === 'ar';
    var copy = L();
    var per = Number(up.perRank) || 0;
    var curVal = Math.round(per * up.rank * 100) / 100;
    var nextVal = Math.round(per * Math.min(10, up.rank + 1) * 100) / 100;
    var prefix = up.prefix || '+';
    var unit = up.unit || '';
    var statName = ar ? (up.bonusLabelAr || up.descAr) : (up.bonusLabelEn || up.descEn);

    if (up.rank === 0) {
      return '0' + unit + ' → ' + prefix + nextVal + unit + ' ' + copy.nextBonus + (statName ? ' · ' + statName : '');
    }
    if (up.rank >= 10) {
      return prefix + curVal + unit + (statName ? ' ' + statName : '');
    }
    return prefix + curVal + unit + ' → ' + prefix + nextVal + unit + (statName ? ' · ' + statName : '');
  }

  /* ------------------------------------------------------------------------
   * 4. ACTION DISPATCHERS (WIRED TO window.ZoneMeritsBridge)
   * ------------------------------------------------------------------------ */
  function setFeedback(text, tone) {
    feedbackState = text ? { text: text, tone: tone || 'sage' } : null;
  }

  function notifyLiveSync() {
    lastRenderSignature = '';
    try {
      window.dispatchEvent(new Event('zone:render'));
    } catch (_) {}
    renderHub();
    syncSidebarAndCrest();
  }

  function handleUpgradeMerit(id) {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.upgradeMerit !== 'function') return;
    resetConfirmOpen = false;
    var res = bridge.upgradeMerit(id);
    var copy = L();
    if (res && res.ok) {
      var st = readHubState();
      var item = null;
      for (var i = 0; i < st.upgrades.length; i++) {
        if (st.upgrades[i].id === id) { item = st.upgrades[i]; break; }
      }
      var name = item ? (isArabic() ? item.nameAr : item.nameEn) : id;
      var newRank = item ? item.rank : (res.rank || 1);
      setFeedback(
        copy.msgUpgraded.replace('{name}', name).replace('{rank}', String(newRank)),
        'sage'
      );
    } else if (res && (res.error || res.message)) {
      setFeedback(String(res.error || res.message), 'warn');
    }
    notifyLiveSync();
  }

  function handleConfirmReset() {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.resetMerits !== 'function') return;
    var res = bridge.resetMerits();
    resetConfirmOpen = false;
    var copy = L();
    if (res && res.ok) {
      setFeedback(copy.msgReset, 'gold');
    } else if (res && (res.error || res.message)) {
      setFeedback(String(res.error || res.message), 'warn');
    }
    notifyLiveSync();
  }

  function handleClaimHonor(id) {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.claimHonor !== 'function') return;
    var res = bridge.claimHonor(id);
    var copy = L();
    if (res && res.ok) {
      var st = readHubState();
      var item = null;
      for (var i = 0; i < st.honors.length; i++) {
        if (st.honors[i].id === id) { item = st.honors[i]; break; }
      }
      var name = item ? (isArabic() ? item.titleAr : item.titleEn) : id;
      setFeedback(copy.msgClaimedOne.replace('{name}', name), 'sage');
    } else if (res && (res.error || res.message)) {
      setFeedback(String(res.error || res.message), 'warn');
    }
    notifyLiveSync();
  }

  function handleEquipHonor(id) {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.equipHonor !== 'function') return;
    var stBefore = readHubState();
    var targetId = stBefore.equippedHonor === id ? null : id;
    var res = bridge.equipHonor(targetId);
    var copy = L();
    if (!res || res.ok !== false) {
      if (!targetId) {
        setFeedback(copy.msgUnequipped, 'gold');
      } else {
        var item = null;
        for (var i = 0; i < stBefore.honors.length; i++) {
          if (stBefore.honors[i].id === targetId) { item = stBefore.honors[i]; break; }
        }
        var name = item ? (isArabic() ? item.titleAr : item.titleEn) : targetId;
        setFeedback(copy.msgEquipped.replace('{name}', name), 'gold');
      }
    }
    notifyLiveSync();
  }

  function handleClaimMedalTier(medalId, tierIndex) {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.claimMedalTier !== 'function') return;
    var res = bridge.claimMedalTier(medalId, Number(tierIndex));
    var copy = L();
    if (res && res.ok) {
      var st = readHubState();
      var item = null;
      for (var i = 0; i < st.medals.length; i++) {
        if (st.medals[i].id === medalId) { item = st.medals[i]; break; }
      }
      var name = item ? (isArabic() ? item.titleAr : item.titleEn) : medalId;
      setFeedback(copy.msgClaimedOne.replace('{name}', name), 'sage');
    } else if (res && (res.error || res.message)) {
      setFeedback(String(res.error || res.message), 'warn');
    }
    notifyLiveSync();
  }

  function handleClaimAllReady() {
    var bridge = window.ZoneMeritsBridge;
    if (!bridge || typeof bridge.claimAllReady !== 'function') return;
    var res = bridge.claimAllReady();
    var copy = L();
    if (res && res.ok) {
      var hCount = Array.isArray(res.claimedHonors) ? res.claimedHonors.length : 0;
      var mCount = Array.isArray(res.claimedMedals) ? res.claimedMedals.length : 0;
      var earned = Number(res.meritsEarned || (hCount + mCount) || 0);
      var cnt = (hCount + mCount) || earned;
      if (cnt > 0) {
        setFeedback(
          copy.msgClaimedAll.replace('{count}', String(cnt)).replace('{merits}', String(earned)),
          'sage'
        );
      }
    }
    notifyLiveSync();
  }

  /* ------------------------------------------------------------------------
   * 5. HUB RENDERERS (HEADER, KPIS, TABS, MERITS, HONORS, MEDALS)
   * ------------------------------------------------------------------------ */
  function renderMeritsTab(st) {
    var ar = isArabic();
    var copy = L();

    /* Count per category */
    var counts = { all: st.upgrades.length, core: 0, battle: 0, ops: 0, mastery: 0 };
    for (var c = 0; c < st.upgrades.length; c++) {
      var cat = st.upgrades[c].category;
      if (counts[cat] != null) counts[cat]++;
    }

    var catOrder = ['all', 'core', 'battle', 'ops', 'mastery'];
    var filtersHtml = '<div class="zma-filters" role="group" aria-label="Merit categories">';
    for (var fi = 0; fi < catOrder.length; fi++) {
      var ck = catOrder[fi];
      var active = meritFilter === ck;
      filtersHtml +=
        '<button type="button" class="zma-filter-chip" data-zma-act="merit-filter" data-zma-val="' + ck + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          escHtml(copy.catMerits[ck] || ck) + ' <bdi>(' + counts[ck] + ')</bdi>' +
        '</button>';
    }
    filtersHtml += '</div>';

    var rowsHtml = '<div class="zma-merit-list">';
    for (var i = 0; i < st.upgrades.length; i++) {
      var up = st.upgrades[i];
      if (meritFilter !== 'all' && up.category !== meritFilter) continue;

      var name = ar ? up.nameAr : up.nameEn;
      var desc = ar ? up.descAr : up.descEn;
      var bonusText = formatBonusPill(up);
      var isMaxed = up.rank >= 10;

      /* Build 10 Torn Pips */
      var pipsHtml = '<div class="zma-pip-bar" aria-label="' + escHtml(name + ' ' + up.rank + '/10') + '">';
      for (var p = 1; p <= 10; p++) {
        var cls = 'zma-pip';
        if (isMaxed) {
          cls += ' is-filled is-maxed';
        } else if (p <= up.rank) {
          cls += ' is-filled';
        } else if (p === up.rank + 1) {
          cls += ' is-next' + (up.affordable ? ' is-affordable' : '');
        }
        var pipTitle = copy.rank + ' ' + p + ' (' + p + ' ' + (p === 1 ? copy.meritUnit : copy.meritsUnit) + ')';
        pipsHtml += '<span class="' + cls + '" title="' + escHtml(pipTitle) + '">' + p + '</span>';
      }
      pipsHtml += '</div>';

      var pipCaption = isMaxed
        ? '<span>' + escHtml(copy.maxed) + '</span><bdi>' + up.spent + ' / 55</bdi>'
        : '<span>' + escHtml(copy.nextCost) + ': <bdi>' + up.nextCost + ' ' + escHtml(up.nextCost === 1 ? copy.meritUnit : copy.meritsUnit) + '</bdi></span><bdi>' + up.spent + ' / 55</bdi>';

      var actionHtml = '';
      if (isMaxed) {
        actionHtml = '<span class="zma-max-badge">★ ' + escHtml(copy.maxed) + '</span>';
      } else if (up.affordable) {
        actionHtml =
          '<button type="button" class="zma-upgrade-btn is-affordable" data-zma-act="upgrade" data-zma-id="' + escHtml(up.id) + '">' +
            escHtml(copy.upgrade) + ' <bdi>(' + up.nextCost + ')</bdi>' +
          '</button>';
      } else {
        actionHtml =
          '<button type="button" class="zma-upgrade-btn is-locked" disabled aria-disabled="true" data-zma-id="' + escHtml(up.id) + '">' +
            escHtml(copy.needMerits) + ' <bdi>' + up.nextCost + '</bdi>' +
          '</button>';
      }

      rowsHtml +=
        '<article class="zma-merit-row" data-merit-id="' + escHtml(up.id) + '" data-rank="' + up.rank + '" data-maxed="' + (isMaxed ? '1' : '0') + '">' +
          '<div class="zma-merit-meta">' +
            '<div class="zma-merit-ico">' + getMeritIcon(up.id) + '</div>' +
            '<div class="zma-merit-text">' +
              '<div class="zma-merit-name-line">' +
                '<span class="zma-merit-name">' + escHtml(name) + '</span>' +
                '<bdi class="zma-merit-rank-tag">' + up.rank + '/10</bdi>' +
              '</div>' +
              '<span class="zma-merit-bonus-pill' + (up.rank === 0 ? ' is-zero' : '') + '">' + escHtml(bonusText) + '</span>' +
              (desc ? '<span class="zma-merit-desc">' + escHtml(desc) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="zma-pip-wrap">' +
            pipsHtml +
            '<div class="zma-pip-caption">' + pipCaption + '</div>' +
          '</div>' +
          '<div class="zma-merit-action">' + actionHtml + '</div>' +
        '</article>';
    }
    rowsHtml += '</div>';

    return filtersHtml + rowsHtml;
  }

  function renderHonorsTab(st) {
    var ar = isArabic();
    var copy = L();

    var catOrder = ['all', 'starter', 'crimes', 'combat', 'gym', 'economy', 'city', 'syndicate'];
    var counts = { all: st.honors.length };
    for (var c = 0; c < st.honors.length; c++) {
      var cat = st.honors[c].category || 'starter';
      counts[cat] = (counts[cat] || 0) + 1;
    }

    var filtersHtml = '<div class="zma-filters" role="group" aria-label="Honor categories">';
    for (var fi = 0; fi < catOrder.length; fi++) {
      var ck = catOrder[fi];
      var active = honorFilter === ck;
      filtersHtml +=
        '<button type="button" class="zma-filter-chip" data-zma-act="honor-filter" data-zma-val="' + ck + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          escHtml(copy.catHonors[ck] || ck) + ' <bdi>(' + (counts[ck] || 0) + ')</bdi>' +
        '</button>';
    }
    filtersHtml += '</div>';

    /* Sort: claimable first, then claimed/equipped, then highest progress */
    var list = st.honors.filter(function (h) {
      return honorFilter === 'all' || h.category === honorFilter;
    });
    list.sort(function (a, b) {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
      if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
      if (a.claimed !== b.claimed) return a.claimed ? -1 : 1;
      var pa = a.cur / a.target;
      var pb = b.cur / b.target;
      return pb - pa;
    });

    var gridHtml = '<div class="zma-honors-grid">';
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var title = ar ? h.titleAr : h.titleEn;
      var desc = ar ? h.descAr : h.descEn;
      var catLabel = copy.catHonors[h.category] || h.category;
      var pct = Math.max(0, Math.min(100, Math.round((h.cur / h.target) * 100)));
      var statusKey = h.claimable ? 'ready' : (h.claimed ? 'claimed' : 'locked');
      var stampText = h.claimed ? '✓ ' + copy.claimedTag : (h.claimable ? '★ +1' : '+1 ' + copy.meritUnit);

      var actionBtn = '';
      if (h.claimable) {
        actionBtn =
          '<button type="button" class="zma-claim-btn" data-zma-act="claim-honor" data-zma-id="' + escHtml(h.id) + '">' +
            escHtml(copy.claimHonor) +
          '</button>';
      } else if (h.claimed) {
        actionBtn =
          '<button type="button" class="zma-equip-btn' + (h.equipped ? ' is-equipped' : '') + '" data-zma-act="equip-honor" data-zma-id="' + escHtml(h.id) + '" title="' + escHtml(h.equipped ? copy.unequipHint : copy.equipBanner) + '">' +
            escHtml(h.equipped ? copy.equipped : copy.equipBanner) +
          '</button>';
      } else {
        actionBtn = '<span class="zma-locked-pill">' + formatCompact(h.cur) + ' / ' + formatCompact(h.target) + '</span>';
      }

      gridHtml +=
        '<article class="zma-honor-card" data-honor-id="' + escHtml(h.id) + '" data-status="' + statusKey + '" data-equipped="' + (h.equipped ? '1' : '0') + '">' +
          '<div class="zma-honor-banner" style="--h-bg1:' + escHtml(h.bg1) + ';--h-bg2:' + escHtml(h.bg2) + ';--h-accent:' + escHtml(h.accent) + '">' +
            '<span class="zma-honor-emblem" aria-hidden="true">' + getHonorEmblemSvg(h.icon) + '</span>' +
            '<div class="zma-honor-banner-copy">' +
              '<span class="zma-honor-title">' + escHtml(title) + '</span>' +
              '<span class="zma-honor-cat-pill">' + escHtml(catLabel) + '</span>' +
            '</div>' +
            '<span class="zma-honor-merit-stamp">' + escHtml(stampText) + '</span>' +
          '</div>' +
          '<p class="zma-honor-desc">' + escHtml(desc) + '</p>' +
          '<div class="zma-honor-footer">' +
            '<div class="zma-prog-block">' +
              '<div class="zma-prog-meta">' +
                '<span>' + escHtml(h.claimed ? copy.claimedTag : (h.claimable ? copy.readyTag : (pct + '%'))) + '</span>' +
                '<bdi>' + formatCompact(Math.min(h.cur, h.target)) + ' / ' + formatCompact(h.target) + '</bdi>' +
              '</div>' +
              '<div class="zma-prog-track"><div class="zma-prog-fill' + (h.claimed ? ' is-gold' : '') + '" style="width:' + pct + '%"></div></div>' +
            '</div>' +
            actionBtn +
          '</div>' +
        '</article>';
    }
    gridHtml += '</div>';

    return filtersHtml + gridHtml;
  }

  function renderMedalsTab(st) {
    var ar = isArabic();
    var copy = L();
    var romans = ['I', 'II', 'III', 'IV'];

    var gridHtml = '<div class="zma-medals-grid">';
    for (var i = 0; i < st.medals.length; i++) {
      var m = st.medals[i];
      var title = ar ? m.titleAr : m.titleEn;
      var desc = ar ? m.descAr : m.descEn;
      var hasReady = m.firstClaimableIdx >= 0;
      var allClaimed = m.tiers.length > 0 && m.tiers.every(function (t) { return t.claimed; });
      var highestLabel = m.highestMetal === 'locked' ? copy.tierLocked : (copy.metals[m.highestMetal] || m.highestMetal);
      var pct = Math.max(0, Math.min(100, Math.round((m.cur / Math.max(1, m.nextTarget)) * 100)));

      var stepsHtml = '<div class="zma-tier-steps">';
      for (var ti = 0; ti < m.tiers.length; ti++) {
        var td = m.tiers[ti];
        var stepCls = 'zma-tier-step' + (td.claimed ? ' is-claimed' : (td.claimable ? ' is-ready' : ''));
        var targetDisp = m.unit === '$' ? ('$' + formatCompact(td.target)) : formatCompact(td.target);
        stepsHtml +=
          '<div class="' + stepCls + '" data-metal="' + escHtml(td.metal) + '">' +
            '<span class="zma-tier-roman">' + (td.claimed ? '✓ ' : '') + (romans[ti] || (ti + 1)) + '</span>' +
            '<span class="zma-tier-metal">' + escHtml(copy.metals[td.metal] || td.metal) + '</span>' +
            '<bdi class="zma-tier-target">' + escHtml(targetDisp) + '</bdi>' +
          '</div>';
      }
      stepsHtml += '</div>';

      var curDisp = m.unit === '$' ? ('$' + formatCompact(m.cur)) : formatCompact(m.cur);
      var nextDisp = m.unit === '$' ? ('$' + formatCompact(m.nextTarget)) : formatCompact(m.nextTarget);

      var actionHtml = '';
      if (hasReady) {
        actionHtml =
          '<button type="button" class="zma-claim-btn" data-zma-act="claim-medal" data-zma-id="' + escHtml(m.id) + '" data-zma-tier="' + m.firstClaimableIdx + '">' +
            escHtml(copy.claimTier) +
          '</button>';
      } else if (allClaimed) {
        actionHtml = '<span class="zma-max-badge" style="width:auto">★ ' + escHtml(copy.allTiersDone) + '</span>';
      } else {
        actionHtml = '<span class="zma-locked-pill">' + escHtml(curDisp + ' / ' + nextDisp) + '</span>';
      }

      gridHtml +=
        '<article class="zma-medal-card" data-medal-id="' + escHtml(m.id) + '" data-ready="' + (hasReady ? '1' : '0') + '">' +
          '<div class="zma-medal-top">' +
            '<div class="zma-medal-crest">' + renderMedalCrestSvg(m.highestMetal) + '</div>' +
            '<div class="zma-medal-head">' +
              '<div class="zma-medal-title-row">' +
                '<span class="zma-medal-name">' + escHtml(title) + '</span>' +
                '<span class="zma-medal-tier-pill" data-tier="' + escHtml(m.highestMetal) + '">' + escHtml(highestLabel) + '</span>' +
              '</div>' +
              '<p class="zma-medal-desc">' + escHtml(desc) + '</p>' +
            '</div>' +
          '</div>' +
          stepsHtml +
          '<div class="zma-medal-footer">' +
            '<div class="zma-prog-block">' +
              '<div class="zma-prog-meta">' +
                '<span>' + escHtml(copy.nextTier) + '</span>' +
                '<bdi>' + escHtml(curDisp + ' / ' + nextDisp) + '</bdi>' +
              '</div>' +
              '<div class="zma-prog-track"><div class="zma-prog-fill' + (allClaimed ? ' is-gold' : '') + '" style="width:' + pct + '%"></div></div>' +
            '</div>' +
            actionHtml +
          '</div>' +
        '</article>';
    }
    gridHtml += '</div>';

    return gridHtml;
  }

  function ensureHubHost() {
    var main = document.getElementById('zone-main');
    if (!main) return null;

    var host = document.getElementById('zone-merits-hub');
    if (host && host.parentElement !== main) {
      if (host.parentElement) host.parentElement.removeChild(host);
      host = null;
    }

    if (!host) {
      host = document.createElement('section');
      host.id = 'zone-merits-hub';
      host.className = 'zma-hub';
      host.setAttribute('aria-label', 'Awards & Merits Hub');
      host.hidden = !hubOpen;

      host.addEventListener('click', function (ev) {
        var btn = ev.target && typeof ev.target.closest === 'function'
          ? ev.target.closest('[data-zma-act]')
          : null;
        if (!btn || btn.disabled) return;
        ev.preventDefault();
        var act = btn.getAttribute('data-zma-act');
        if (act === 'close') {
          closeHub();
        } else if (act === 'tab') {
          var nextTab = btn.getAttribute('data-zma-val');
          if (nextTab === 'merits' || nextTab === 'honors' || nextTab === 'medals') {
            activeTab = nextTab;
            resetConfirmOpen = false;
            lastRenderSignature = '';
            renderHub();
          }
        } else if (act === 'merit-filter') {
          meritFilter = btn.getAttribute('data-zma-val') || 'all';
          lastRenderSignature = '';
          renderHub();
        } else if (act === 'honor-filter') {
          honorFilter = btn.getAttribute('data-zma-val') || 'all';
          lastRenderSignature = '';
          renderHub();
        } else if (act === 'upgrade') {
          handleUpgradeMerit(btn.getAttribute('data-zma-id'));
        } else if (act === 'claim-all') {
          handleClaimAllReady();
        } else if (act === 'claim-honor') {
          handleClaimHonor(btn.getAttribute('data-zma-id'));
        } else if (act === 'equip-honor') {
          handleEquipHonor(btn.getAttribute('data-zma-id'));
        } else if (act === 'claim-medal') {
          handleClaimMedalTier(btn.getAttribute('data-zma-id'), btn.getAttribute('data-zma-tier'));
        } else if (act === 'reset-toggle') {
          resetConfirmOpen = !resetConfirmOpen;
          lastRenderSignature = '';
          renderHub();
        } else if (act === 'reset-cancel') {
          resetConfirmOpen = false;
          lastRenderSignature = '';
          renderHub();
        } else if (act === 'reset-confirm') {
          handleConfirmReset();
        } else if (act === 'dismiss-feedback') {
          feedbackState = null;
          lastRenderSignature = '';
          renderHub();
        }
      });

      /* Append at end of #zone-main so React/<x-dc> children stay intact */
      main.appendChild(host);
    }

    return host;
  }

  function renderHub() {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var host = ensureHubHost();
    if (!host) return;

    if (!hubOpen) {
      host.hidden = true;
      if (main.hasAttribute('data-zma-open')) main.removeAttribute('data-zma-open');
      if (document.documentElement.hasAttribute('data-zma-open')) {
        document.documentElement.removeAttribute('data-zma-open');
      }
      return;
    }

    host.hidden = false;
    if (main.getAttribute('data-zma-open') !== '1') {
      main.setAttribute('data-zma-open', '1');
    }
    if (document.documentElement.getAttribute('data-zma-open') !== '1') {
      document.documentElement.setAttribute('data-zma-open', '1');
    }

    var st = readHubState();
    var ar = isArabic();
    var copy = L();

    /* Avoid redundant innerHTML churn if nothing changed */
    var sig = JSON.stringify([
      ar ? 'ar' : 'en',
      activeTab,
      meritFilter,
      honorFilter,
      resetConfirmOpen,
      feedbackState ? feedbackState.text + '|' + feedbackState.tone : '',
      st.availableMerits,
      st.spentMerits,
      st.meritResets,
      st.readyHonors,
      st.readyMedals,
      st.claimedHonorsCount,
      st.claimedMedalTiers,
      st.equippedHonor || '',
      st.upgrades.map(function (u) { return u.rank; }).join(',')
    ]);
    if (sig === lastRenderSignature && host.childNodes.length > 0) return;
    lastRenderSignature = sig;

    var resetConfirmMsg = st.resetCost === 0
      ? copy.resetConfirmFree.replace('{spent}', String(st.spentMerits))
      : copy.resetConfirmPaid
          .replace('{spent}', String(st.spentMerits))
          .replace('{cost}', formatMoney(st.resetCost));

    var claimAllHtml = st.totalReady > 0
      ? '<button type="button" class="zma-btn-claim-all" data-zma-act="claim-all">' +
          '★ ' + escHtml(copy.claimAll) + ' <bdi>(+' + st.totalReady + ')</bdi>' +
        '</button>'
      : '';

    var resetBtnHtml =
      '<button type="button" class="zma-btn-reset" data-zma-act="reset-toggle"' + (st.spentMerits <= 0 ? ' disabled aria-disabled="true"' : '') + '>' +
        escHtml(copy.resetBtn) +
      '</button>';

    var resetConfirmHtml =
      '<div class="zma-reset-confirm" role="alertdialog" aria-label="' + escHtml(copy.resetBtn) + '"' + (resetConfirmOpen && st.spentMerits > 0 ? '' : ' hidden') + '>' +
        '<span class="zma-reset-confirm-msg">' + escHtml(resetConfirmMsg) + '</span>' +
        '<div class="zma-reset-confirm-btns">' +
          '<button type="button" class="zma-btn-danger-solid" data-zma-act="reset-confirm">' + escHtml(copy.confirmReset) + '</button>' +
          '<button type="button" class="zma-btn-cancel" data-zma-act="reset-cancel">' + escHtml(copy.cancel) + '</button>' +
        '</div>' +
      '</div>';

    var feedbackHtml = feedbackState
      ? '<div class="zma-feedback" role="status" data-tone="' + escHtml(feedbackState.tone) + '">' +
          '<span>' + escHtml(feedbackState.text) + '</span>' +
          '<button type="button" class="zma-feedback-close" data-zma-act="dismiss-feedback" aria-label="Close">✕</button>' +
        '</div>'
      : '';

    var tabBodyHtml = '';
    if (!st.ready && st.upgrades.length === 0) {
      tabBodyHtml = '<div class="zma-overview-card"><div class="zma-overview-body">' + escHtml(copy.msgEngineLoading) + '</div></div>';
    } else if (activeTab === 'honors') {
      tabBodyHtml = renderHonorsTab(st);
    } else if (activeTab === 'medals') {
      tabBodyHtml = renderMedalsTab(st);
    } else {
      tabBodyHtml = renderMeritsTab(st);
    }

    host.innerHTML =
      '<header class="zma-header">' +
        '<div class="zma-header-left">' +
          '<button type="button" class="zma-back-btn" data-zma-act="close">' + escHtml(copy.backToGame) + '</button>' +
          '<div class="zma-title-wrap">' +
            '<h1 class="zma-title">' + escHtml(copy.hubTitle) + '</h1>' +
            '<p class="zma-subtitle">' + escHtml(copy.hubSub) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zma-header-actions">' +
          claimAllHtml +
          resetBtnHtml +
        '</div>' +
      '</header>' +
      resetConfirmHtml +
      feedbackHtml +
      '<div class="zma-overview-card">' +
        '<div class="zma-overview-head">' +
          '<span>' + escHtml(copy.overviewTitle) + '</span>' +
          '<bdi class="zma-overview-head-tag">' + escHtml(copy.overviewTag) + '</bdi>' +
        '</div>' +
        '<div class="zma-overview-body">' + escHtml(copy.overviewBody) + '</div>' +
      '</div>' +
      '<div class="zma-kpi-grid">' +
        '<div class="zma-kpi-card" data-kpi="available">' +
          '<span class="zma-kpi-label">' + escHtml(copy.kpiAvailable) + '</span>' +
          '<bdi class="zma-kpi-val">' + formatInt(st.availableMerits) + '</bdi>' +
          '<span class="zma-kpi-sub">' + escHtml(copy.kpiAvailableSub) + '</span>' +
        '</div>' +
        '<div class="zma-kpi-card" data-kpi="spent">' +
          '<span class="zma-kpi-label">' + escHtml(copy.kpiSpent) + '</span>' +
          '<bdi class="zma-kpi-val">' + formatInt(st.spentMerits) + '</bdi>' +
          '<span class="zma-kpi-sub">' + escHtml(copy.kpiSpentSub) + '</span>' +
        '</div>' +
        '<div class="zma-kpi-card" data-kpi="honors">' +
          '<span class="zma-kpi-label">' + escHtml(copy.kpiHonors) + '</span>' +
          '<bdi class="zma-kpi-val">' + st.claimedHonorsCount + ' / ' + st.totalHonorsCount + '</bdi>' +
          '<span class="zma-kpi-sub">' + (st.readyHonors > 0 ? ('+' + st.readyHonors + ' ' + escHtml(copy.readyTag)) : escHtml(copy.kpiHonorsSub)) + '</span>' +
        '</div>' +
        '<div class="zma-kpi-card" data-kpi="medals">' +
          '<span class="zma-kpi-label">' + escHtml(copy.kpiMedals) + '</span>' +
          '<bdi class="zma-kpi-val">' + st.claimedMedalTiers + ' / ' + st.totalMedalTiers + '</bdi>' +
          '<span class="zma-kpi-sub">' + (st.readyMedals > 0 ? ('+' + st.readyMedals + ' ' + escHtml(copy.readyTag)) : escHtml(copy.kpiMedalsSub)) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="zma-tabs" role="tablist" aria-label="' + escHtml(copy.hubTitle) + '">' +
        '<button type="button" role="tab" class="zma-tab-btn" data-zma-act="tab" data-zma-val="merits" aria-selected="' + (activeTab === 'merits' ? 'true' : 'false') + '">' +
          '<span class="zma-tab-ico" aria-hidden="true">' + MERIT_ICONS.star + '</span>' +
          '<span>' + escHtml(copy.tabMerits) + '</span>' +
          '<bdi class="zma-tab-count">' + st.availableMerits + '</bdi>' +
        '</button>' +
        '<button type="button" role="tab" class="zma-tab-btn" data-zma-act="tab" data-zma-val="honors" aria-selected="' + (activeTab === 'honors' ? 'true' : 'false') + '">' +
          '<span class="zma-tab-ico" aria-hidden="true">' + MERIT_ICONS.ribbon + '</span>' +
          '<span>' + escHtml(copy.tabHonors) + '</span>' +
          '<bdi class="zma-tab-count' + (st.readyHonors > 0 ? ' is-ready' : '') + '">' + (st.readyHonors > 0 ? ('+' + st.readyHonors) : (st.claimedHonorsCount + '/' + st.totalHonorsCount)) + '</bdi>' +
        '</button>' +
        '<button type="button" role="tab" class="zma-tab-btn" data-zma-act="tab" data-zma-val="medals" aria-selected="' + (activeTab === 'medals' ? 'true' : 'false') + '">' +
          '<span class="zma-tab-ico" aria-hidden="true">' + MERIT_ICONS.medal + '</span>' +
          '<span>' + escHtml(copy.tabMedals) + '</span>' +
          '<bdi class="zma-tab-count' + (st.readyMedals > 0 ? ' is-ready' : '') + '">' + (st.readyMedals > 0 ? ('+' + st.readyMedals) : (st.claimedMedalTiers + '/' + st.totalMedalTiers)) + '</bdi>' +
        '</button>' +
      '</div>' +
      '<div class="zma-tab-panel" role="tabpanel">' +
        tabBodyHtml +
      '</div>';
  }

  /* ------------------------------------------------------------------------
   * 6. SIDEBAR MERITS TRIGGER, OPERATIVE CREST HONOR BAR & QUICK BUTTONS
   * ------------------------------------------------------------------------ */
  function closeMobileDrawerIfOpen() {
    var root = document.documentElement;
    if (root && root.classList && root.classList.contains('zaaa-rail-open')) {
      root.classList.remove('zaaa-rail-open');
    }
  }

  function findSidebarMeritsRows() {
    var rows = [];
    var profileBody = document.querySelector('aside.zone-sidebar .zone-profile-body');
    if (!profileBody) return rows;

    /* Desktop Merits row inside .zone-profile-body */
    var desktopRows = profileBody.querySelectorAll(':scope > .zone-profile-desktop');
    var matchedDesktop = null;
    for (var i = 0; i < desktopRows.length; i++) {
      var r = desktopRows[i];
      var lbl = r.querySelector('span');
      var txt = lbl ? String(lbl.textContent || '').trim() : '';
      if (/merit|ميرتس|أوسمة|نقاط التميز|مزايا/i.test(txt)) {
        matchedDesktop = r;
        break;
      }
    }
    if (!matchedDesktop && desktopRows.length >= 3 && desktopRows[2].querySelector('bdi')) {
      matchedDesktop = desktopRows[2];
    }
    if (matchedDesktop) rows.push(matchedDesktop);

    /* Mobile collapsible details Merits row */
    var mobileRows = profileBody.querySelectorAll('.zone-profile-mobile-details > div > div');
    for (var j = 0; j < mobileRows.length; j++) {
      var mr = mobileRows[j];
      var ml = mr.querySelector('span');
      var mt = ml ? String(ml.textContent || '').trim() : '';
      if (/merit|ميرتس|أوسمة|نقاط التميز|مزايا/i.test(mt) || (j === 2 && mr.querySelector('bdi'))) {
        rows.push(mr);
        break;
      }
    }
    return rows;
  }

  function syncSidebarMeritsTriggers(st) {
    var copy = L();
    var rows = findSidebarMeritsRows();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.getAttribute('data-zma-merits-trigger') !== '1') {
        row.setAttribute('data-zma-merits-trigger', '1');
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
      }
      row.setAttribute('title', copy.sidebarTitle);
      row.setAttribute('aria-label', copy.sidebarTitle);
      if (hubOpen) {
        row.setAttribute('data-zma-active', '1');
      } else if (row.hasAttribute('data-zma-active')) {
        row.removeAttribute('data-zma-active');
      }

      if (row.getAttribute('data-zma-bound') !== '1') {
        row.setAttribute('data-zma-bound', '1');
        row.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          closeMobileDrawerIfOpen();
          openHub('merits');
        });
        row.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            closeMobileDrawerIfOpen();
            openHub('merits');
          }
        });
      }

      /* Fiber-safe append-only gold star badge */
      var badge = row.querySelector('.zma-sidebar-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'zma-sidebar-badge';
        row.appendChild(badge);
      }
      if (st.totalReady > 0) {
        badge.hidden = false;
        badge.setAttribute('data-zma-ready', '1');
        var readyText = '★ +' + st.totalReady;
        if (badge.textContent !== readyText) badge.textContent = readyText;
      } else if (st.availableMerits > 0) {
        badge.hidden = false;
        badge.removeAttribute('data-zma-ready');
        var availText = '★';
        if (badge.textContent !== availText) badge.textContent = availText;
      } else {
        badge.hidden = true;
      }
    }
  }

  function syncOperativeCrestHonorBar(st) {
    var crest = document.getElementById('zone-operative-crest');
    if (!crest) return;

    var existing = document.getElementById('zma-crest-honor-bar');
    var h = st.equippedHonorObj;

    if (!h) {
      if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
      if (crest.hasAttribute('data-zma-has-honor')) crest.removeAttribute('data-zma-has-honor');
      return;
    }

    if (crest.getAttribute('data-zma-has-honor') !== '1') {
      crest.setAttribute('data-zma-has-honor', '1');
    }

    var ar = isArabic();
    var copy = L();
    var title = ar ? h.titleAr : h.titleEn;
    var sig = h.id + '|' + title + '|' + (ar ? 'ar' : 'en');

    if (!existing || existing.parentElement !== crest) {
      if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
      existing = document.createElement('div');
      existing.id = 'zma-crest-honor-bar';
      existing.className = 'zma-crest-honor-bar';
      existing.setAttribute('role', 'button');
      existing.setAttribute('tabindex', '0');
      existing.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        closeMobileDrawerIfOpen();
        openHub('honors');
      });
      existing.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          ev.stopPropagation();
          closeMobileDrawerIfOpen();
          openHub('honors');
        }
      });
      crest.appendChild(existing);
    }

    if (existing.getAttribute('data-sig') !== sig) {
      existing.setAttribute('data-sig', sig);
      existing.setAttribute('data-honor-id', h.id);
      existing.setAttribute('title', title);
      existing.style.setProperty('--h-bg1', h.bg1);
      existing.style.setProperty('--h-bg2', h.bg2);
      existing.style.setProperty('--h-accent', h.accent);
      existing.innerHTML =
        '<span class="zma-crest-honor-ico" aria-hidden="true">' + getHonorEmblemSvg(h.icon) + '</span>' +
        '<span class="zma-crest-honor-title">' + escHtml(title) + '</span>' +
        '<span class="zma-crest-honor-tag">' + escHtml(copy.honorBadgeTag) + '</span>';
    }
  }

  function syncQuickAwardsButtons(st) {
    var copy = L();

    /* 1. Page Heading quick button alongside City & Tutorial */
    var headingActionGroup = document.querySelector('#zone-main .zone-page-heading > div:last-child');
    if (headingActionGroup) {
      var qaBtn = document.getElementById('zma-quick-awards-btn');
      if (qaBtn && qaBtn.parentElement !== headingActionGroup) {
        if (qaBtn.parentElement) qaBtn.parentElement.removeChild(qaBtn);
        qaBtn = null;
      }
      if (!qaBtn) {
        qaBtn = document.createElement('button');
        qaBtn.type = 'button';
        qaBtn.id = 'zma-quick-awards-btn';
        qaBtn.innerHTML =
          '<span class="zma-qa-ico" aria-hidden="true">' + MERIT_ICONS.star + '</span>' +
          '<span class="zma-qa-lbl"></span>' +
          '<bdi class="zma-qa-pill" hidden></bdi>';
        qaBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          openHub('merits');
        });
        headingActionGroup.appendChild(qaBtn);
      }
      var qaLbl = qaBtn.querySelector('.zma-qa-lbl');
      if (qaLbl && qaLbl.textContent !== copy.awardsBtn) qaLbl.textContent = copy.awardsBtn;
      var qaPill = qaBtn.querySelector('.zma-qa-pill');
      if (qaPill) {
        if (st.totalReady > 0) {
          qaPill.hidden = false;
          qaPill.textContent = '+' + st.totalReady;
        } else {
          qaPill.hidden = true;
        }
      }
    }

    /* 2. Sidebar Areas Nav button (desktop sidebar + mobile drawer) */
    var navArea = document.getElementById('zone-area-navigation');
    if (navArea) {
      var navBtn = document.getElementById('zma-nav-awards-btn');
      if (navBtn && navBtn.parentElement !== navArea) {
        if (navBtn.parentElement) navBtn.parentElement.removeChild(navBtn);
        navBtn = null;
      }
      if (!navBtn) {
        navBtn = document.createElement('button');
        navBtn.type = 'button';
        navBtn.id = 'zma-nav-awards-btn';
        navBtn.innerHTML =
          '<span class="zma-nav-awards-ico" aria-hidden="true">' + MERIT_ICONS.star + '</span>' +
          '<span class="zma-nav-awards-lbl"></span>' +
          '<bdi class="zma-nav-awards-badge" hidden></bdi>';
        navBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          closeMobileDrawerIfOpen();
          openHub('merits');
        });
        navArea.appendChild(navBtn);
      }
      if (hubOpen) {
        navBtn.setAttribute('aria-current', 'page');
      } else if (navBtn.hasAttribute('aria-current')) {
        navBtn.removeAttribute('aria-current');
      }
      var navLbl = navBtn.querySelector('.zma-nav-awards-lbl');
      if (navLbl && navLbl.textContent !== copy.navAwards) navLbl.textContent = copy.navAwards;
      var navBadge = navBtn.querySelector('.zma-nav-awards-badge');
      if (navBadge) {
        if (st.totalReady > 0) {
          navBadge.hidden = false;
          navBadge.textContent = '+' + st.totalReady;
        } else {
          navBadge.hidden = true;
        }
      }
    }
  }

  function syncSidebarAndCrest() {
    if (document.querySelector('x-dc')) return;
    var st = readHubState();
    syncSidebarMeritsTriggers(st);
    syncOperativeCrestHonorBar(st);
    syncQuickAwardsButtons(st);
  }

  /* ------------------------------------------------------------------------
   * 7. OPEN / CLOSE / DEEP-LINK LIFECYCLE
   * ------------------------------------------------------------------------ */
  function openHub(tab) {
    var normalized = String(tab || 'merits').toLowerCase();
    if (normalized !== 'merits' && normalized !== 'honors' && normalized !== 'medals') {
      normalized = 'merits';
    }
    var wasClosed = !hubOpen;
    hubOpen = true;
    activeTab = normalized;
    resetConfirmOpen = false;
    lastRenderSignature = '';

    var main = document.getElementById('zone-main');
    if (main) {
      lastScreenObserved = main.getAttribute('data-zone-screen') || '';
    }

    renderHub();
    syncSidebarAndCrest();

    if (wasClosed) {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch (_) {
        try { window.scrollTo(0, 0); } catch (__) {}
      }
    }
  }

  function closeHub() {
    if (!hubOpen) return;
    hubOpen = false;
    resetConfirmOpen = false;
    feedbackState = null;
    lastRenderSignature = '';
    renderHub();
    syncSidebarAndCrest();
  }

  function refreshHub() {
    lastRenderSignature = '';
    renderHub();
    syncSidebarAndCrest();
  }

  function checkDeepLink() {
    if (deepLinkHandled) return;
    try {
      var params = new URLSearchParams(window.location.search || '');
      var sid = String(params.get('sid') || '').toLowerCase();
      var tab = String(params.get('tab') || '').toLowerCase();
      var hash = String(window.location.hash || '').replace(/^#/, '').toLowerCase();

      if (sid === 'awards' || tab === 'merits' || tab === 'honors' || tab === 'medals') {
        deepLinkHandled = true;
        openHub(tab === 'honors' || tab === 'medals' ? tab : 'merits');
      } else if (hash === 'awards' || hash === 'merits' || hash === 'honors' || hash === 'medals') {
        deepLinkHandled = true;
        openHub(hash === 'honors' || hash === 'medals' ? hash : 'merits');
      }
    } catch (_) {}
  }

  /* ------------------------------------------------------------------------
   * 8. GLOBAL SYNC & NAVIGATION LISTENERS
   * ------------------------------------------------------------------------ */
  function syncAll() {
    rafPending = false;
    if (document.querySelector('x-dc')) return;
    try {
      var main = document.getElementById('zone-main');
      if (main) {
        var curScreen = main.getAttribute('data-zone-screen') || '';
        if (hubOpen && lastScreenObserved && curScreen && curScreen !== lastScreenObserved) {
          lastScreenObserved = curScreen;
          closeHub();
        } else {
          lastScreenObserved = curScreen;
        }
      }
      checkDeepLink();
      syncSidebarAndCrest();
      if (hubOpen) renderHub();
    } catch (_) {
      /* Never emit console errors */
    }
  }

  function scheduleSync() {
    if (rafPending) return;
    rafPending = true;
    var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
    raf(syncAll);
  }

  function bindGlobalListeners() {
    /* Escape closes Awards & Merits Hub */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && hubOpen) {
        ev.preventDefault();
        closeHub();
      }
    });

    /* Clicking any primary nav button / topbar link / mobile bottom tab closes hub cleanly */
    document.addEventListener('click', function (ev) {
      if (!hubOpen) return;
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      if (t.closest('#zone-merits-hub') || t.closest('[data-zma-merits-trigger="1"]') || t.closest('#zma-nav-awards-btn') || t.closest('#zma-quick-awards-btn') || t.closest('#zma-crest-honor-bar')) {
        return;
      }
      if (
        t.closest('#zone-area-navigation button[data-zone-screen]') ||
        t.closest('.zone-topbar .zone-header-link') ||
        t.closest('.zone-topbar .zone-brand') ||
        t.closest('#zone-topbar-hud .zaaa-hud-pill') ||
        t.closest('.zone-mobile-tabbar button:not([data-zaaa-mob="menu"])')
      ) {
        closeHub();
      }
    }, true);

    window.addEventListener('zone:render', scheduleSync, { passive: true });
    window.addEventListener('zone:merits-updated', function () {
      lastRenderSignature = '';
      scheduleSync();
    }, { passive: true });
    window.addEventListener('popstate', function () {
      deepLinkHandled = false;
      scheduleSync();
    });

    try {
      var htmlObs = new MutationObserver(function () {
        lastRenderSignature = '';
        scheduleSync();
      });
      htmlObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
    } catch (_) {}

    /* Observe #zone-main screen changes */
    var attachMainObs = function () {
      var main = document.getElementById('zone-main');
      if (main && !main.__zmaMainObs) {
        main.__zmaMainObs = true;
        try {
          var mObs = new MutationObserver(scheduleSync);
          mObs.observe(main, { attributes: true, attributeFilter: ['data-zone-screen'] });
        } catch (_) {}
      }
    };
    attachMainObs();
    window.setTimeout(attachMainObs, 400);
    window.setTimeout(attachMainObs, 1200);
  }

  /* Expose Public API */
  window.ZoneMeritsUI = {
    open: openHub,
    close: closeHub,
    refresh: refreshHub,
    isOpen: function () { return hubOpen; },
    getActiveTab: function () { return activeTab; }
  };

  function boot() {
    bindGlobalListeners();
    scheduleSync();
    window.setTimeout(scheduleSync, 180);
    window.setTimeout(scheduleSync, 600);
    window.setTimeout(scheduleSync, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

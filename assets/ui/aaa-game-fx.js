/* ZONE v126 - MotionSites Duotone Icons, Cursor-Spotlight, Hero Atmosphere & HUD Telemetry Engine */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaGameFxLoaded) return;
  window.__zoneAaaGameFxLoaded = true;

  var STYLE_ID = 'zone-aaa-game-fx-styles';
  var LAYER_ID = 'zone-fx-layer';
  var MAX_FX_NODES = 28;

  /* ---------------- Inline Duotone Telemetry Chip Icons (Zero Raw Emojis) ---------------- */
  var DELTA_SVGS = {
    cashGain:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="6.5" fill="rgba(73,240,161,0.25)" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M8 4.2V11.8M10 6C10 5.1 9.1 4.6 8 4.6C6.9 4.6 6 5.1 6 5.9C6 7.5 10 6.9 10 8.9C10 9.8 9.1 10.4 8 10.4C6.8 10.4 6 9.8 5.9 9" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>' +
      '</svg>',
    cashSpend:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="6.5" fill="rgba(251,113,133,0.24)" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M5.2 8H10.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>',
    energy:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8.8 1.8L3.6 8.8H7.7L7.1 14.2L12.4 7.2H8.3L8.8 1.8Z" fill="rgba(110,231,183,0.28)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>',
    nerve:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8.3 2C9.8 4.3 12.2 5.9 12.2 9.1C12.2 11.7 10.3 13.8 8 13.8C5.7 13.8 3.8 11.7 3.8 9.1C3.8 7 5 5.3 6.2 4.3C6.1 5.6 6.8 6.4 7.5 6.8C7.1 4.9 7.5 3.2 8.3 2Z" fill="rgba(251,191,36,0.28)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>',
    happy:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8 2L9.7 6.3L14 8L9.7 9.7L8 14L6.3 9.7L2 8L6.3 6.3L8 2Z" fill="rgba(165,180,252,0.28)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>',
    life:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8 13.4C8 13.4 2.5 10.1 2.5 5.9C2.5 4.1 3.9 2.8 5.5 2.8C6.6 2.8 7.5 3.4 8 4.3C8.5 3.4 9.4 2.8 10.5 2.8C12.1 2.8 13.5 4.1 13.5 5.9C13.5 10.1 8 13.4 8 13.4Z" fill="rgba(251,113,133,0.28)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>',
    stat:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M2.2 6V10M4.2 4.5V11.5M11.8 4.5V11.5M13.8 6V10M4.2 8H11.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>',
    xp:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8 1.8L13.2 5V11L8 14.2L2.8 11V5L8 1.8Z" fill="rgba(235,184,88,0.28)" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>' +
        '<circle cx="8" cy="8" r="1.8" fill="currentColor"/>' +
      '</svg>',
    levelup:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M8 1.8L9.9 5.7L14.2 6.3L11.1 9.3L11.8 13.6L8 11.6L4.2 13.6L4.9 9.3L1.8 6.3L6.1 5.7L8 1.8Z" fill="rgba(250,204,21,0.34)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg>'
  };

  /* ---------------- MotionSites 2-Plane Duotone Quick-Action SVGs ---------------- */
  var QUICK_ACTION_DUOTONES = {
    crimes: {
      tone: 'rgba(235, 184, 88, 0.34)',
      svg:
        '<svg class="zfx-duotone-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<circle class="zfx-duo-tone" cx="12" cy="12" r="8.5"/>' +
          '<circle class="zfx-duo-stroke" cx="12" cy="12" r="8.2"/>' +
          '<circle class="zfx-duo-stroke" cx="12" cy="12" r="3.1"/>' +
          '<path class="zfx-duo-stroke" d="M12 2.2V5.2M12 18.8V21.8M2.2 12H5.2M18.8 12H21.8"/>' +
        '</svg>'
    },
    gym: {
      tone: 'rgba(57, 231, 163, 0.34)',
      svg:
        '<svg class="zfx-duotone-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path class="zfx-duo-tone" d="M5 7C5 5.9 5.9 5 7 5H8.5V19H7C5.9 19 5 18.1 5 17V7ZM15.5 5H17C18.1 5 19 5.9 19 7V17C19 18.1 18.1 19 17 19H15.5V5Z"/>' +
          '<path class="zfx-duo-stroke" d="M6.5 6V18M17.5 6V18"/>' +
          '<path class="zfx-duo-stroke" d="M3.2 8.5V15.5M20.8 8.5V15.5"/>' +
          '<path class="zfx-duo-stroke" d="M6.5 12H17.5"/>' +
        '</svg>'
    },
    attack: {
      tone: 'rgba(244, 63, 94, 0.35)',
      svg:
        '<svg class="zfx-duotone-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path class="zfx-duo-tone" d="M12 3.2L20.8 12L12 20.8L3.2 12L12 3.2Z"/>' +
          '<path class="zfx-duo-stroke" d="M14.5 6.5L19.5 4.5L17.5 9.5L9.2 17.8L6.2 14.8L14.5 6.5Z"/>' +
          '<path class="zfx-duo-stroke" d="M5 19L7.7 16.3M4.8 13.8L10.2 19.2"/>' +
          '<path class="zfx-duo-stroke" d="M9.5 6.5L4.5 4.5L6.5 9.5"/>' +
        '</svg>'
    },
    missions: {
      tone: 'rgba(96, 165, 250, 0.35)',
      svg:
        '<svg class="zfx-duotone-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<rect class="zfx-duo-tone" x="5" y="4.5" width="14" height="16.5" rx="2.5"/>' +
          '<path class="zfx-duo-stroke" d="M9 4.5H7C5.9 4.5 5 5.4 5 6.5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V6.5C19 5.4 18.1 4.5 17 4.5H15"/>' +
          '<rect class="zfx-duo-stroke" x="9" y="2.8" width="6" height="3.4" rx="1.2"/>' +
          '<path class="zfx-duo-stroke" d="M8.5 11.5L10.6 13.6L15.5 8.8M8.5 16.8H15.5"/>' +
        '</svg>'
    }
  };

  /* ---------------- Meaningful District Tags for City Directory ---------------- */
  var CITY_DISTRICT_TAGS = {
    gym:        { en: 'Combat Conditioning', ar: 'التأهيل البدني والقتالي' },
    hospital:   { en: 'Trauma & Recovery',   ar: 'الطوارئ والتعافي الطبي' },
    jail:       { en: 'Detention Block',     ar: 'جناح الاحتجاز والكفالة' },
    bank:       { en: 'Titanium Vaults',     ar: 'الخزائن والودائع المصفحة' },
    casino:     { en: 'High-Stakes Salon',   ar: 'صالون الرهانات الكبرى' },
    market:     { en: 'Black-Market Exchange', ar: 'بورصة السوق والبازار' },
    crimes:     { en: 'Covert Street Ops',   ar: 'عمليات الشوارع السرية' },
    missions:   { en: 'Syndicate Contracts', ar: 'عقود ومهمات النقابة' },
    properties: { en: 'Safehouses & Estates', ar: 'المخابئ والعقارات الخاصة' },
    education:  { en: 'Tactical Academy',    ar: 'الأكاديمية والدورات التكتيكية' },
    job:        { en: 'Syndicate Payroll',   ar: 'وظائف وعقود المدينة' },
    jobs:       { en: 'Syndicate Payroll',   ar: 'وظائف وعقود المدينة' },
    faction:    { en: 'Family Territory HQ', ar: 'مقر العائلة وحرب الأراضي' },
    newspaper:  { en: 'Underworld Wire',     ar: 'صحيفة وأخبار العالم السفلي' },
    hof:        { en: 'Apex Standings',      ar: 'لوحة الشرف وكبار الزعماء' },
    items:      { en: 'Armory & Gear',       ar: 'الترسانة ومخزن العتاد' },
    attack:     { en: 'Rival Encounters',    ar: 'مواجهات الشوارع المباشرة' },
    home:       { en: 'Command Safehouse',   ar: 'غرفة القيادة والمخبأ' },
    city:       { en: 'Metropolis Grid',     ar: 'خريطة القطاعات الحضرية' }
  };

  var RESOURCE_META = {
    energy: { en: 'ENERGY', ar: 'طاقة', svg: DELTA_SVGS.energy, posColor: '#6ee7b7', negColor: '#a3e635', glow: 'rgba(132, 204, 22, 0.42)' },
    nerve:  { en: 'NERVE',  ar: 'جرأة', svg: DELTA_SVGS.nerve,  posColor: '#fcd34d', negColor: '#fbbf24', glow: 'rgba(245, 158, 11, 0.44)' },
    happy:  { en: 'HAPPY',  ar: 'معنويات', svg: DELTA_SVGS.happy, posColor: '#a5b4fc', negColor: '#818cf8', glow: 'rgba(129, 140, 248, 0.42)' },
    life:   { en: 'LIFE',   ar: 'صحة',  svg: DELTA_SVGS.life,   posColor: '#4ade80', negColor: '#fb7185', glow: 'rgba(244, 63, 94, 0.45)' }
  };

  var STAT_META = {
    str: { en: 'STR', ar: 'قوة' },
    def: { en: 'DEF', ar: 'دفاع' },
    spd: { en: 'SPD', ar: 'سرعة' },
    dex: { en: 'DEX', ar: 'مراوغة' }
  };

  var state = {
    bootAt: Date.now(),
    hydrated: false,
    hydrationArmedAt: 0,
    hydrationTimer: null,
    lastPlayerId: null,
    baseline: null,
    lastScreen: null,
    lastActionAnchor: { x: 0, y: 0, at: 0, el: null },
    lastUserGestureAt: 0,
    gestureUnlocked: false,
    audioCtx: null,
    masterFilter: null,
    lastHoverAt: 0,
    lastHoverEl: null,
    lastClickSfxAt: 0,
    lastPointerDownPulseAt: 0,
    screenAnim: null,
    mainEl: null,
    mainAttrObserver: null,
    mainPolishObserver: null,
    polishPending: false,
    hudObserver: null,
    rootObserver: null,
    syncPending: false,
    /* Spotlight tracking */
    spotRaf: 0,
    spotEvent: null,
    /* Hero atmosphere particles */
    heroDrops: [],
    heroMotes: [],
    heroPrevAt: 0
  };

  for (var hi = 0; hi < 20; hi++) {
    state.heroDrops.push({
      x: 0.22 + Math.random() * 0.82,
      y: Math.random(),
      len: 10 + Math.random() * 14,
      spd: 0.45 + Math.random() * 0.55
    });
  }
  for (var mi = 0; mi < 14; mi++) {
    state.heroMotes.push({
      x: 0.18 + Math.random() * 0.80,
      y: Math.random(),
      r: 0.9 + Math.random() * 1.5,
      spd: 0.06 + Math.random() * 0.11,
      phase: Math.random() * Math.PI * 2
    });
  }

  /* ---------------- Locale, Theme & Motion Helpers ---------------- */
  function isAr() {
    try {
      var html = document.documentElement;
      if (!html) return false;
      var lang = (html.getAttribute('lang') || '').toLowerCase();
      var dir = (html.getAttribute('dir') || '').toLowerCase();
      return lang.indexOf('ar') === 0 || dir === 'rtl';
    } catch (_) {
      return false;
    }
  }

  function isLightTheme() {
    try {
      return document.documentElement && document.documentElement.getAttribute('data-theme') === 'light';
    } catch (_) {
      return false;
    }
  }

  function prefersReducedMotion() {
    try {
      return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
      return false;
    }
  }

  function normalizeDigits(raw) {
    return String(raw || '').replace(/[٠-٩]/g, function (d) {
      return String(d.charCodeAt(0) - 1632);
    }).replace(/[۰-۹]/g, function (d) {
      return String(d.charCodeAt(0) - 1776);
    });
  }

  function parseNumericText(raw) {
    if (raw === null || raw === undefined) return NaN;
    var s = normalizeDigits(raw).replace(/,/g, '').replace(/\u066C/g, '');
    var m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function formatInt(n) {
    return Math.round(Math.abs(n)).toLocaleString('en-US');
  }

  /* ---------------- Mute State & Persistence ---------------- */
  function isMuted() {
    try {
      if (window.__zoneMuted === true) return true;
      if (localStorage.getItem('zig_muted') === '1') return true;
      if (localStorage.getItem('zone_sfx_muted') === '1') return true;
    } catch (_) {}
    return false;
  }

  function setMuted(muted) {
    var flag = Boolean(muted);
    window.__zoneMuted = flag;
    try {
      localStorage.setItem('zig_muted', flag ? '1' : '0');
    } catch (_) {}
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('zone:mute-change', { detail: { muted: flag } }));
      }
    } catch (_) {}
  }

  /* ---------------- Scoped Styles & Non-Blocking FX Layer ---------------- */
  function ensureStyles() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent =
        '#' + LAYER_ID + '{' +
          'position:fixed;inset:0;' +
          'pointer-events:none !important;z-index:9992;overflow:hidden;' +
          'contain:layout style paint;user-select:none;-webkit-user-select:none;' +
        '}' +
        '#' + LAYER_ID + ' *{pointer-events:none !important;box-sizing:border-box;}' +
        '.zfx-delta-chip{' +
          'position:fixed;left:0;top:0;z-index:9995;' +
          'display:inline-flex;align-items:center;gap:5px;' +
          'padding:4px 9px;border-radius:4px;' +
          'font:800 12.5px/1.2 "Rubik","Noto Sans Arabic",system-ui,sans-serif;' +
          'font-variant-numeric:tabular-nums;white-space:nowrap;' +
          'letter-spacing:0.03em;' +
          'background:linear-gradient(180deg,rgba(14,21,35,0.95) 0%,rgba(7,11,19,0.97) 100%);' +
          'border:1px solid var(--zfx-border,rgba(235,184,88,0.55));' +
          'color:var(--zfx-fg,#49f0a1);' +
          'box-shadow:0 8px 20px rgba(0,0,0,0.58),0 0 14px var(--zfx-glow,rgba(73,240,161,0.22)),inset 0 1px 0 rgba(255,255,255,0.09);' +
          'transform:translate3d(-50%,0,0);will-change:transform,opacity;' +
          'animation:zfxDeltaFloat 1120ms cubic-bezier(0.16,1,0.3,1) var(--zfx-delay,0ms) both;' +
        '}' +
        'html[dir="rtl"] .zfx-delta-chip,html[lang="ar"] .zfx-delta-chip{letter-spacing:0 !important;}' +
        'html[data-theme="light"] .zfx-delta-chip{' +
          'background:linear-gradient(180deg,rgba(19,27,42,0.96) 0%,rgba(11,17,28,0.98) 100%);' +
          'box-shadow:0 8px 18px rgba(15,23,42,0.26),0 0 0 1px rgba(255,255,255,0.22),inset 0 1px 0 rgba(255,255,255,0.14);' +
        '}' +
        '.zfx-delta-chip.is-levelup{' +
          'padding:6px 13px;font-size:14px;border-width:1.5px;' +
          'background:linear-gradient(180deg,rgba(44,31,10,0.97) 0%,rgba(18,13,6,0.98) 100%);' +
        '}' +
        '.zfx-delta-icon{display:inline-grid;place-items:center;font-size:11.5px;line-height:1;opacity:0.96;}' +
        '.zfx-delta-icon svg{width:13px;height:13px;display:block;}' +
        '.zfx-delta-num{unicode-bidi:isolate;direction:ltr;display:inline-block;}' +
        '.zfx-click-pulse{' +
          'position:fixed;overflow:hidden;border-radius:4px;z-index:9993;' +
          'border:1px solid var(--zfx-rim,rgba(235,184,88,0.62));' +
          'animation:zfxButtonRim 320ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-click-pulse::after{' +
          'content:"";position:absolute;' +
          'left:var(--zfx-rx,50%);top:var(--zfx-ry,50%);' +
          'width:14px;height:14px;border-radius:50%;' +
          'background:radial-gradient(circle,var(--zfx-spot,rgba(255,255,255,0.52)) 0%,var(--zfx-spot2,rgba(235,184,88,0.24)) 48%,transparent 72%);' +
          'transform:translate(-50%,-50%) scale(0.35);' +
          'animation:zfxSpecularWave 340ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-bar-halo{' +
          'position:fixed;border-radius:4px;z-index:9993;' +
          'border:1px solid var(--zfx-halo,rgba(73,240,161,0.65));' +
          'box-shadow:0 0 14px var(--zfx-halo,rgba(73,240,161,0.45)),inset 0 0 8px var(--zfx-halo,rgba(73,240,161,0.25));' +
          'animation:zfxBarHalo 520ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-screen-sweep{' +
          'position:fixed;height:2px;z-index:9994;border-radius:2px;' +
          'background:linear-gradient(90deg,transparent 0%,#39e7a3 35%,#ebb858 70%,transparent 100%);' +
          'box-shadow:0 0 12px rgba(235,184,88,0.55);' +
          'transform-origin:left center;' +
          'animation:zfxSweepLine 200ms cubic-bezier(0.22,1,0.36,1) forwards;' +
        '}' +
        'html[dir="rtl"] .zfx-screen-sweep{transform-origin:right center;}' +
        'html[data-theme="light"] .zfx-screen-sweep{' +
          'background:linear-gradient(90deg,transparent 0%,#0d7a49 35%,#b4781e 70%,transparent 100%);' +
          'box-shadow:0 0 8px rgba(180,120,30,0.35);' +
        '}' +
        '#zone-main.zfx-screen-entering{' +
          'animation:zfxScreenReveal 180ms cubic-bezier(0.22,1,0.36,1) none;' +
        '}' +
        /* Hero Atmosphere Canvas inside .zone-page-heading */
        '#zone-main .zone-page-heading{position:relative;overflow:hidden;}' +
        '#zone-main .zone-page-heading > :not(.zaaa-hero-atmosphere){position:relative;z-index:2;}' +
        '.zaaa-hero-atmosphere{' +
          'position:absolute !important;inset:0 !important;width:100% !important;height:100% !important;' +
          'pointer-events:none !important;z-index:1 !important;display:block;border-radius:inherit;' +
        '}' +
        /* MotionSites Quick-Action Duotone Jewel Squircle (Dark & Day Mode) */
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon{' +
          'position:relative;width:42px !important;height:42px !important;min-width:42px !important;' +
          'display:inline-grid !important;place-items:center !important;flex:none !important;' +
          'background-color:#0b1220 !important;' +
          'background-image:linear-gradient(145deg,#18263c 0%,#0b1220 100%) !important;' +
          'border:1px solid rgba(235,184,88,0.46) !important;' +
          'color:#f8fafc !important;border-radius:10px !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.14),0 4px 10px rgba(0,0,0,0.32) !important;' +
          'transition:transform 220ms cubic-bezier(0.22,1,0.36,1),border-color 220ms ease !important;' +
        '}' +
        'html[data-theme="light"] body #zone-main .zone-quick-actions > button .zone-nav-icon{' +
          'background-color:#0d1524 !important;' +
          'background-image:linear-gradient(145deg,#162235 0%,#0d1524 100%) !important;' +
          'border:1px solid rgba(212,162,76,0.55) !important;' +
          'color:#f8fafc !important;border-radius:10px !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),0 3px 9px rgba(15,23,42,0.18) !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button:hover .zone-nav-icon{' +
          'transform:scale(1.07);border-color:rgba(235,184,88,0.78) !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon[data-zfx-duotone]::before{' +
          'content:none !important;display:none !important;width:0 !important;height:0 !important;' +
          'background:none !important;-webkit-mask-image:none !important;mask-image:none !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon[data-zfx-duotone] > svg:not(.zfx-duotone-svg){' +
          'display:none !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon[data-zfx-duotone] > svg.zfx-duotone-svg{' +
          'display:block !important;visibility:visible !important;' +
          'width:22px !important;height:22px !important;' +
          'fill:none !important;color:#f8fafc !important;overflow:visible;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon[data-zfx-duotone] > svg.zfx-duotone-svg .zfx-duo-tone{' +
          'fill:var(--zfx-tone,rgba(235,184,88,0.34)) !important;stroke:none !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon[data-zfx-duotone] > svg.zfx-duotone-svg .zfx-duo-stroke{' +
          'fill:none !important;stroke:currentColor !important;stroke-width:1.85 !important;' +
          'stroke-linecap:round !important;stroke-linejoin:round !important;' +
        '}' +
        '@keyframes zfxDeltaFloat{' +
          '0%{opacity:0;transform:translate3d(-50%,8px,0) scale(0.84);}' +
          '16%{opacity:1;transform:translate3d(-50%,-4px,0) scale(1.04);}' +
          '72%{opacity:1;transform:translate3d(-50%,-32px,0) scale(1);}' +
          '100%{opacity:0;transform:translate3d(-50%,-48px,0) scale(0.96);}' +
        '}' +
        '@keyframes zfxButtonRim{' +
          '0%{opacity:0.95;}' +
          '100%{opacity:0;}' +
        '}' +
        '@keyframes zfxSpecularWave{' +
          '0%{opacity:0.92;transform:translate(-50%,-50%) scale(0.35);}' +
          '100%{opacity:0;transform:translate(-50%,-50%) scale(15);}' +
        '}' +
        '@keyframes zfxBarHalo{' +
          '0%{opacity:0.95;transform:scale(0.99);}' +
          '100%{opacity:0;transform:scale(1.03);}' +
        '}' +
        '@keyframes zfxSweepLine{' +
          '0%{opacity:0.95;transform:scaleX(0.08);}' +
          '70%{opacity:0.9;transform:scaleX(1);}' +
          '100%{opacity:0;transform:scaleX(1);}' +
        '}' +
        '@keyframes zfxScreenReveal{' +
          '0%{opacity:0.74;transform:translate3d(0,4px,0);}' +
          '100%{opacity:1;transform:translate3d(0,0,0);}' +
        '}' +
        '@media (prefers-reduced-motion: reduce){' +
          '.zfx-delta-chip{animation-duration:450ms !important;}' +
          '#zone-main.zfx-screen-entering{animation:none !important;}' +
          '.zaaa-hero-atmosphere{display:none !important;}' +
        '}';
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  }

  function ensureLayer() {
    try {
      ensureStyles();
      var existing = document.getElementById(LAYER_ID);
      if (existing) return existing;
      if (!document.body) return null;
      var layer = document.createElement('div');
      layer.id = LAYER_ID;
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
      return layer;
    } catch (_) {
      return null;
    }
  }

  function appendFxNode(node, ttlMs) {
    var layer = ensureLayer();
    if (!layer || !node) return;
    try {
      while (layer.childNodes.length >= MAX_FX_NODES && layer.firstChild) {
        layer.removeChild(layer.firstChild);
      }
      layer.appendChild(node);
      var removed = false;
      var cleanup = function () {
        if (removed) return;
        removed = true;
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (_) {}
      };
      node.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, ttlMs || 1300);
    } catch (_) {}
  }

  /* ---------------- WebAudio Procedural Tactical Synth ---------------- */
  function getAudioContext() {
    if (!state.gestureUnlocked || isMuted()) return null;
    try {
      if (!state.audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        state.audioCtx = new Ctx();
        if (typeof state.audioCtx.createBiquadFilter === 'function') {
          state.masterFilter = state.audioCtx.createBiquadFilter();
          state.masterFilter.type = 'lowpass';
          state.masterFilter.frequency.value = 3400;
          state.masterFilter.Q.value = 0.7;
          state.masterFilter.connect(state.audioCtx.destination);
        }
      }
      if (state.audioCtx.state === 'suspended') {
        var p = state.audioCtx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
      return state.audioCtx;
    } catch (_) {
      return null;
    }
  }

  function synthVoice(type, fStart, fEnd, durSec, peakGain, delaySec) {
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (delaySec || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(24, fStart), t0);
      if (fEnd && fEnd !== fStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(24, fEnd), t0 + durSec);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), t0 + Math.min(0.008, durSec * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec + 0.012);
      osc.connect(gain);
      gain.connect(state.masterFilter || ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durSec + 0.018);
    } catch (_) {}
  }

  function playCue(kind) {
    if (!state.gestureUnlocked || isMuted()) return;
    try {
      if (kind === 'hover') {
        synthVoice('sine', 1520, 960, 0.016, 0.012, 0);
      } else if (kind === 'primary' || kind === 'crime') {
        synthVoice('triangle', 225, 88, 0.044, 0.038, 0);
        synthVoice('sine', 1360, 720, 0.028, 0.024, 0.006);
      } else if (kind === 'gym') {
        synthVoice('sine', 148, 58, 0.052, 0.044, 0);
        synthVoice('triangle', 520, 860, 0.034, 0.022, 0.01);
      } else if (kind === 'nav') {
        synthVoice('sine', 420, 670, 0.028, 0.022, 0);
      } else if (kind === 'cash') {
        synthVoice('triangle', 987.77, 1318.51, 0.075, 0.042, 0);
        synthVoice('sine', 1318.51, 1975.53, 0.135, 0.036, 0.055);
      } else if (kind === 'xp') {
        synthVoice('sine', 783.99, 1174.66, 0.07, 0.024, 0);
      } else if (kind === 'levelup') {
        synthVoice('triangle', 523.25, 659.25, 0.09, 0.045, 0);
        synthVoice('triangle', 659.25, 783.99, 0.10, 0.045, 0.075);
        synthVoice('sine', 1046.50, 1567.98, 0.20, 0.05, 0.15);
      } else {
        synthVoice('triangle', 700, 470, 0.022, 0.018, 0);
      }
    } catch (_) {}
  }

  function classifyButtonCue(btn) {
    if (!btn || !(btn instanceof Element)) return 'click';
    if (
      btn.classList.contains('zone-action-primary') ||
      btn.classList.contains('zone-action-danger') ||
      btn.classList.contains('zig-btn') ||
      btn.hasAttribute('data-crime-attempt') ||
      btn.hasAttribute('data-crime-select') ||
      btn.hasAttribute('data-zig-launch')
    ) {
      return 'primary';
    }
    if (
      btn.hasAttribute('data-gym-train') ||
      btn.classList.contains('zone-gym-train') ||
      btn.classList.contains('zone-gym-station')
    ) {
      return 'gym';
    }
    if (
      btn.hasAttribute('data-zone-screen') ||
      btn.classList.contains('zone-header-link') ||
      btn.hasAttribute('data-crime-category') ||
      btn.classList.contains('zig-city-chip') ||
      btn.closest('[data-znav], [data-ztabs], .zone-header-links, #zone-topbar-hud')
    ) {
      return 'nav';
    }
    return 'click';
  }

  /* ---------------- Specular Click Pulse (#zone-main button) ---------------- */
  function spawnButtonSpecularPulse(btn, clientX, clientY) {
    if (!btn || prefersReducedMotion()) return;
    try {
      var rect = btn.getBoundingClientRect();
      if (!rect || rect.width < 12 || rect.height < 12 || rect.width > 960) return;

      var pulse = document.createElement('div');
      pulse.className = 'zfx-click-pulse';
      pulse.style.left = Math.round(rect.left) + 'px';
      pulse.style.top = Math.round(rect.top) + 'px';
      pulse.style.width = Math.round(rect.width) + 'px';
      pulse.style.height = Math.round(rect.height) + 'px';

      var rx = clientX > 0 ? Math.max(4, Math.min(rect.width - 4, clientX - rect.left)) : rect.width * 0.5;
      var ry = clientY > 0 ? Math.max(4, Math.min(rect.height - 4, clientY - rect.top)) : rect.height * 0.5;
      pulse.style.setProperty('--zfx-rx', Math.round(rx) + 'px');
      pulse.style.setProperty('--zfx-ry', Math.round(ry) + 'px');

      var isDanger = btn.classList.contains('zone-action-danger');
      var isPrimary = btn.classList.contains('zone-action-primary') || btn.classList.contains('zig-btn');
      var light = isLightTheme();

      if (isDanger) {
        pulse.style.setProperty('--zfx-rim', 'rgba(248, 113, 113, 0.78)');
        pulse.style.setProperty('--zfx-spot', 'rgba(254, 202, 202, 0.52)');
        pulse.style.setProperty('--zfx-spot2', 'rgba(239, 68, 68, 0.25)');
      } else if (isPrimary) {
        pulse.style.setProperty('--zfx-rim', light ? 'rgba(13, 122, 73, 0.72)' : 'rgba(73, 240, 161, 0.78)');
        pulse.style.setProperty('--zfx-spot', light ? 'rgba(255, 255, 255, 0.65)' : 'rgba(209, 250, 229, 0.5)');
        pulse.style.setProperty('--zfx-spot2', light ? 'rgba(180, 120, 30, 0.24)' : 'rgba(57, 231, 163, 0.26)');
      } else {
        pulse.style.setProperty('--zfx-rim', light ? 'rgba(180, 120, 30, 0.62)' : 'rgba(235, 184, 88, 0.62)');
        pulse.style.setProperty('--zfx-spot', light ? 'rgba(180, 120, 30, 0.30)' : 'rgba(255, 255, 255, 0.38)');
        pulse.style.setProperty('--zfx-spot2', 'rgba(235, 184, 88, 0.18)');
      }

      appendFxNode(pulse, 380);
    } catch (_) {}
  }

  function spawnBarHalo(targetEl, glowColor) {
    if (!targetEl || prefersReducedMotion()) return;
    try {
      var rect = targetEl.getBoundingClientRect();
      if (!rect || rect.width < 10 || rect.height < 6 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      var halo = document.createElement('div');
      halo.className = 'zfx-bar-halo';
      halo.style.left = Math.round(rect.left - 2) + 'px';
      halo.style.top = Math.round(rect.top - 2) + 'px';
      halo.style.width = Math.round(rect.width + 4) + 'px';
      halo.style.height = Math.round(rect.height + 4) + 'px';
      if (glowColor) halo.style.setProperty('--zfx-halo', glowColor);
      appendFxNode(halo, 560);
    } catch (_) {}
  }

  /* ---------------- Floating RPG Stat Delta Chips ---------------- */
  function resolveAnchorPoint(preferredEl, stackIndex) {
    var vw = Math.max(320, window.innerWidth || 1280);
    var vh = Math.max(320, window.innerHeight || 800);
    var now = performance.now();
    var x = vw * 0.5;
    var y = 110;

    if (state.lastActionAnchor.at > 0 && (now - state.lastActionAnchor.at) < 2800 && state.lastActionAnchor.x > 0) {
      x = state.lastActionAnchor.x;
      y = state.lastActionAnchor.y - 14;
    } else {
      var placed = false;
      if (preferredEl) {
        try {
          var r = preferredEl.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0 && r.bottom > 8 && r.top < vh - 8) {
            x = r.left + r.width * 0.5;
            y = Math.max(52, r.top - 4);
            placed = true;
          }
        } catch (_) {}
      }
      if (!placed) {
        try {
          var topHud = document.getElementById('zone-topbar-hud');
          if (topHud) {
            var hr = topHud.getBoundingClientRect();
            if (hr && hr.width > 0 && hr.height > 0) {
              x = hr.left + hr.width * 0.5;
              y = Math.max(52, hr.bottom + 8);
            }
          }
        } catch (_) {}
      }
    }

    var padX = Math.min(84, Math.round(vw * 0.2));
    x = Math.max(padX, Math.min(vw - padX, Math.round(x)));
    y = Math.max(46, Math.min(vh - 64, Math.round(y - (stackIndex || 0) * 28)));
    return { x: x, y: y };
  }

  function spawnDelta(opts) {
    if (!opts || !opts.numText) return;
    try {
      var pt = resolveAnchorPoint(opts.anchorEl || null, opts.stackIndex || 0);
      var chip = document.createElement('div');
      chip.className = 'zfx-delta-chip' + (opts.levelUp ? ' is-levelup' : '');
      chip.style.left = pt.x + 'px';
      chip.style.top = pt.y + 'px';
      if (opts.fg) chip.style.setProperty('--zfx-fg', opts.fg);
      if (opts.border) chip.style.setProperty('--zfx-border', opts.border);
      if (opts.glow) chip.style.setProperty('--zfx-glow', opts.glow);
      if (opts.delayMs) chip.style.setProperty('--zfx-delay', opts.delayMs + 'ms');

      if (opts.iconSvg || opts.icon) {
        var ic = document.createElement('span');
        ic.className = 'zfx-delta-icon';
        if (opts.iconSvg) {
          ic.innerHTML = opts.iconSvg;
        } else {
          ic.textContent = opts.icon;
        }
        chip.appendChild(ic);
      }

      var numSpan = document.createElement('bdi');
      numSpan.className = 'zfx-delta-num';
      numSpan.textContent = opts.numText;
      chip.appendChild(numSpan);

      if (opts.label) {
        var lbl = document.createElement('span');
        lbl.textContent = opts.label;
        chip.appendChild(lbl);
      }

      appendFxNode(chip, 1280 + (opts.delayMs || 0));
    } catch (_) {}
  }

  /* ---------------- Snapshot Extraction & Delta Telemetry ---------------- */
  function readResourceValue(key, g) {
    try {
      var resEl = document.querySelector('.zone-resource[data-zone-resource="' + key + '"]');
      if (resEl) {
        var bar = resEl.querySelector('[role="progressbar"][aria-valuenow]');
        if (bar) {
          var vAttr = Number(bar.getAttribute('aria-valuenow'));
          if (Number.isFinite(vAttr)) return { val: vAttr, el: bar };
        }
        var fig = resEl.querySelector('[data-zfig]');
        if (fig) {
          var vFig = parseNumericText(fig.textContent);
          if (Number.isFinite(vFig)) return { val: vFig, el: resEl };
        }
      }
      if (g && typeof g.cur === 'function') {
        var vCur = Number(g.cur(key));
        if (Number.isFinite(vCur)) return { val: vCur, el: resEl || null };
      }
    } catch (_) {}
    return { val: NaN, el: null };
  }

  function captureSnapshot() {
    var g = window.__zoneGame || null;
    var p = (g && g.p) || null;
    var cashEl = document.getElementById('zone-cash');
    var domCash = cashEl ? parseNumericText(cashEl.textContent) : NaN;
    var cashVal = (p && Number.isFinite(Number(p.cash))) ? Number(p.cash) : domCash;

    var energy = readResourceValue('energy', g);
    var nerve = readResourceValue('nerve', g);
    var happy = readResourceValue('happy', g);
    var life = readResourceValue('life', g);

    var totalXp = p
      ? (Number(p.xp || 0) + Number(p.localXp || 0) + Number(p.crimeXp || 0) + Number(p.gymXp || 0))
      : NaN;
    var level = p && Number.isFinite(Number(p.level)) ? Number(p.level) : NaN;
    var stats = p && p.stats ? {
      str: Number(p.stats.str || 0),
      def: Number(p.stats.def || 0),
      spd: Number(p.stats.spd || 0),
      dex: Number(p.stats.dex || 0)
    } : null;

    return {
      playerId: p ? String(p.playerId || '') : '',
      gameplayReady: Boolean(g && (g.gameplayReady || g.state && g.state.gameplayReady)),
      cash: cashVal,
      cashEl: cashEl,
      bars: {
        energy: energy,
        nerve: nerve,
        happy: happy,
        life: life
      },
      totalXp: totalXp,
      level: level,
      stats: stats
    };
  }

  function evaluateTelemetryDeltas() {
    try {
      var snap = captureSnapshot();
      var now = Date.now();
      var bootElapsed = now - state.bootAt;

      if (snap.playerId && state.lastPlayerId && snap.playerId !== state.lastPlayerId) {
        state.lastPlayerId = snap.playerId;
        state.baseline = snap;
        state.hydrated = false;
        state.hydrationArmedAt = 0;
        if (state.hydrationTimer) {
          clearTimeout(state.hydrationTimer);
          state.hydrationTimer = null;
        }
        return;
      }
      if (snap.playerId) state.lastPlayerId = snap.playerId;

      if (!state.hydrated) {
        state.baseline = snap;
        var hasHydratedVitals =
          snap.gameplayReady ||
          (snap.bars && snap.bars.life && Number.isFinite(snap.bars.life.val) && snap.bars.life.val > 0);
        if (hasHydratedVitals || bootElapsed > 9000) {
          if (!state.hydrationArmedAt) {
            state.hydrationArmedAt = now + 260;
            if (!state.hydrationTimer) {
              state.hydrationTimer = setTimeout(function () {
                state.hydrationTimer = null;
                state.baseline = captureSnapshot();
                state.hydrated = true;
              }, 270);
            }
          } else if (now >= state.hydrationArmedAt) {
            if (state.hydrationTimer) {
              clearTimeout(state.hydrationTimer);
              state.hydrationTimer = null;
            }
            state.hydrated = true;
          }
        }
        return;
      }

      var prev = state.baseline;
      state.baseline = snap;
      if (!prev) return;

      /* Suppress cold-boot 0 -> initial vitals jump if server session finished after timeout */
      if (
        prev.bars &&
        prev.bars.life &&
        (!Number.isFinite(prev.bars.life.val) || prev.bars.life.val === 0) &&
        snap.bars &&
        snap.bars.life &&
        snap.bars.life.val > 0 &&
        (now - state.lastUserGestureAt) >= 2500
      ) {
        return;
      }

      var ar = isAr();
      var recentUserAct = (now - state.lastUserGestureAt) < 5500;
      var recentClickAnchor = (performance.now() - state.lastActionAnchor.at) < 2800;
      var queue = [];

      /* 1. Cash Delta (+$1,250 / -$950) */
      if (Number.isFinite(snap.cash) && Number.isFinite(prev.cash) && snap.cash !== prev.cash) {
        var dCash = Math.round(snap.cash - prev.cash);
        if (Math.abs(dCash) >= 1 && Math.abs(dCash) < 500000000) {
          var isGain = dCash > 0;
          if (isGain) playCue('cash');
          var zigPop = !recentClickAnchor && isGain && document.querySelector('.zig-float-pop');
          if (!zigPop) {
            queue.push({
              iconSvg: isGain ? DELTA_SVGS.cashGain : DELTA_SVGS.cashSpend,
              numText: (isGain ? '+$' : '-$') + formatInt(dCash),
              label: '',
              fg: isGain ? '#49f0a1' : '#fb7185',
              border: isGain ? 'rgba(73, 240, 161, 0.62)' : 'rgba(251, 113, 133, 0.62)',
              glow: isGain ? 'rgba(73, 240, 161, 0.28)' : 'rgba(244, 63, 94, 0.28)',
              anchorEl: snap.cashEl
            });
          }
          if (snap.cashEl) {
            spawnBarHalo(snap.cashEl, isGain ? 'rgba(73, 240, 161, 0.65)' : 'rgba(251, 113, 133, 0.65)');
          }
        }
      }

      /* 2. Resource Bars (Energy, Nerve, Happy, Life) */
      var keys = ['energy', 'nerve', 'happy', 'life'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var curB = snap.bars[k];
        var prvB = prev.bars[k];
        if (!curB || !prvB || !Number.isFinite(curB.val) || !Number.isFinite(prvB.val)) continue;
        var dBar = Math.round(curB.val - prvB.val);
        if (dBar === 0 || Math.abs(dBar) > 100000) continue;

        var shouldShowBar = false;
        if (k === 'energy' || k === 'nerve') {
          shouldShowBar = dBar < 0 || dBar >= 2 || (dBar > 0 && recentUserAct);
        } else {
          shouldShowBar = dBar <= -2 || dBar >= 5 || (Math.abs(dBar) >= 2 && recentUserAct);
        }
        if (!shouldShowBar) continue;

        var meta = RESOURCE_META[k];
        var pos = dBar > 0;
        queue.push({
          iconSvg: meta.svg,
          numText: (pos ? '+' : '-') + formatInt(dBar),
          label: ar ? meta.ar : meta.en,
          fg: pos ? meta.posColor : meta.negColor,
          border: meta.glow,
          glow: meta.glow,
          anchorEl: curB.el
        });
        if (curB.el) spawnBarHalo(curB.el, meta.glow);
      }

      /* 3. Gym Battle Stat Gains (+2.45 STR/DEF/SPD/DEX) */
      if (snap.stats && prev.stats && recentUserAct) {
        var sKeys = ['str', 'def', 'spd', 'dex'];
        for (var si = 0; si < sKeys.length; si++) {
          var sk = sKeys[si];
          var dStat = snap.stats[sk] - prev.stats[sk];
          if (Number.isFinite(dStat) && dStat >= 0.05 && dStat < 50000) {
            var sm = STAT_META[sk];
            queue.push({
              iconSvg: DELTA_SVGS.stat,
              numText: '+' + (dStat >= 10 ? Math.round(dStat).toLocaleString('en-US') : dStat.toFixed(2)),
              label: ar ? sm.ar : sm.en,
              fg: '#38bdf8',
              border: 'rgba(56, 189, 248, 0.58)',
              glow: 'rgba(56, 189, 248, 0.28)',
              anchorEl: snap.bars.energy.el
            });
          }
        }
      }

      /* 4. Unified XP Delta (+35 XP) */
      if (Number.isFinite(snap.totalXp) && Number.isFinite(prev.totalXp) && snap.totalXp > prev.totalXp) {
        var dXp = Math.round(snap.totalXp - prev.totalXp);
        if (dXp >= 1 && dXp < 1000000) {
          if (queue.length === 0) playCue('xp');
          queue.push({
            iconSvg: DELTA_SVGS.xp,
            numText: '+' + formatInt(dXp),
            label: ar ? 'خبرة' : 'XP',
            fg: '#ebb858',
            border: 'rgba(235, 184, 88, 0.68)',
            glow: 'rgba(235, 184, 88, 0.30)',
            anchorEl: snap.cashEl
          });
        }
      }

      /* 5. Level-Up Milestone */
      if (Number.isFinite(snap.level) && Number.isFinite(prev.level) && snap.level > prev.level && (snap.level - prev.level) <= 20) {
        playCue('levelup');
        queue.push({
          iconSvg: DELTA_SVGS.levelup,
          numText: String(snap.level),
          label: ar ? 'مستوى جديد!' : 'LEVEL UP!',
          fg: '#fde047',
          border: 'rgba(250, 204, 21, 0.85)',
          glow: 'rgba(250, 204, 21, 0.45)',
          levelUp: true,
          anchorEl: snap.cashEl
        });
      }

      for (var qi = 0; qi < queue.length && qi < 4; qi++) {
        queue[qi].stackIndex = qi;
        queue[qi].delayMs = qi * 55;
        spawnDelta(queue[qi]);
      }
    } catch (_) {}
  }

  function scheduleTelemetryCheck() {
    if (state.syncPending) return;
    state.syncPending = true;
    setTimeout(function () {
      state.syncPending = false;
      evaluateTelemetryDeltas();
    }, 36);
  }

  /* ---------------- v126: Duotone Quick-Actions, Subtitles & City Directory Polish ---------------- */
  function detectQuickActionKey(btn, index) {
    var styleStr = (btn.getAttribute('style') || '').toLowerCase();
    if (styleStr.indexOf('crime') >= 0) return 'crimes';
    if (styleStr.indexOf('gym') >= 0) return 'gym';
    if (styleStr.indexOf('attack') >= 0) return 'attack';
    if (styleStr.indexOf('mission') >= 0) return 'missions';

    var txt = (btn.textContent || '').toLowerCase();
    if (txt.indexOf('crime') >= 0 || txt.indexOf('جرائم') >= 0 || txt.indexOf('جريمة') >= 0) return 'crimes';
    if (txt.indexOf('gym') >= 0 || txt.indexOf('نادي') >= 0 || txt.indexOf('تمرين') >= 0) return 'gym';
    if (txt.indexOf('attack') >= 0 || txt.indexOf('هجوم') >= 0 || txt.indexOf('قتال') >= 0) return 'attack';
    if (txt.indexOf('mission') >= 0 || txt.indexOf('مهمات') >= 0 || txt.indexOf('عقود') >= 0) return 'missions';

    var fallback = ['crimes', 'gym', 'attack', 'missions'];
    return fallback[index % fallback.length] || 'crimes';
  }

  function humanizeQuickSubtitle(rawText, key, ar) {
    var raw = String(rawText || '').trim();
    if (!raw) return raw;

    /* Already humanized on this render pass */
    if (/Ready$|Active$|Open$|جاهزة$|نشطة$/i.test(raw) && raw.indexOf('·') < 0) {
      return raw;
    }

    var mNerveEn = raw.match(/^(\d[\d,]*)\s*nerve(?:\s*[·•|-]\s*.*)?$/i);
    if (mNerveEn) return mNerveEn[1] + ' Nerve Ready';

    var mEnergyEn = raw.match(/^(\d[\d,]*)\s*energy(?:\s*[·•|-]\s*.*)?$/i);
    if (mEnergyEn) return mEnergyEn[1] + ' Energy Ready';

    var mOpenEn = raw.match(/^(\d[\d,]*)\s*(?:open|active|available|contracts?|missions?)(?:\s*[·•|-]\s*.*)?$/i);
    if (mOpenEn) return mOpenEn[1] + ' Contracts Ready';

    var mNerveAr = raw.match(/^([\d,٠-٩]+)\s*جرأة(?:\s*[·•|-]\s*.*)?$/);
    if (mNerveAr) return mNerveAr[1] + ' جرأة جاهزة';

    var mEnergyAr = raw.match(/^([\d,٠-٩]+)\s*طاقة(?:\s*[·•|-]\s*.*)?$/);
    if (mEnergyAr) return mEnergyAr[1] + ' طاقة جاهزة';

    if (raw.indexOf('·') >= 0) {
      var parts = raw.split(/\s*·\s*/);
      var first = (parts[0] || '').trim();
      var second = (parts[1] || '').trim();
      if (/nerve/i.test(first)) return first.replace(/nerve/i, 'Nerve') + ' Ready';
      if (/energy/i.test(first)) return first.replace(/energy/i, 'Energy') + ' Ready';
      if (/جرأة/.test(first)) return first + ' جاهزة';
      if (/طاقة/.test(first)) return first + ' جاهزة';
      if (first && (!second || first.toLowerCase() === second.toLowerCase())) return first;
      if (first && second) {
        if (second.toLowerCase() === key) return first;
        return first + ', ' + second;
      }
    }

    if (key === 'missions' && (/^missions$/i.test(raw) || raw === 'المهمات')) {
      return ar ? 'عقود نشطة' : 'Contracts Active';
    }

    return raw;
  }

  function mutateTextNodeSafely(el, nextValue) {
    if (!el || typeof nextValue !== 'string') return;
    if (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) {
      if (el.firstChild.nodeValue !== nextValue) {
        el.firstChild.nodeValue = nextValue;
      }
    } else if (el.childNodes.length === 0) {
      el.textContent = nextValue;
    }
  }

  function enhanceQuickActions() {
    try {
      var btns = document.querySelectorAll('#zone-main .zone-quick-actions > button');
      if (!btns.length) return;
      var ar = isAr();

      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var key = detectQuickActionKey(btn, i);
        var spec = QUICK_ACTION_DUOTONES[key] || QUICK_ACTION_DUOTONES.crimes;
        var iconEl = btn.querySelector('.zone-nav-icon');

        if (iconEl) {
          iconEl.style.setProperty('--zfx-tone', spec.tone);
          var existingCustom = iconEl.querySelector('svg.zfx-duotone-svg');
          if (!existingCustom) {
            iconEl.setAttribute('data-zfx-duotone', key);
            var tmp = document.createElement('div');
            tmp.innerHTML = spec.svg;
            if (tmp.firstElementChild) {
              iconEl.appendChild(tmp.firstElementChild);
            }
          } else if (iconEl.getAttribute('data-zfx-duotone') !== key) {
            iconEl.setAttribute('data-zfx-duotone', key);
            var tmpNext = document.createElement('div');
            tmpNext.innerHTML = spec.svg;
            if (tmpNext.firstElementChild) {
              existingCustom.innerHTML = tmpNext.firstElementChild.innerHTML;
            }
          }
        }

        var bdi = btn.querySelector('bdi');
        if (bdi) {
          var curSub = bdi.textContent || '';
          var cleanSub = humanizeQuickSubtitle(curSub, key, ar);
          if (cleanSub && cleanSub !== curSub) {
            mutateTextNodeSafely(bdi, cleanSub);
          }
        }
      }
    } catch (_) {}
  }

  function enhanceCityDestinations() {
    try {
      var rows = document.querySelectorAll('#zone-main .zone-city-destinations button');
      if (!rows.length) return;
      var ar = isAr();

      for (var i = 0; i < rows.length; i++) {
        var btn = rows[i];
        var strong = btn.querySelector('strong');
        var small = btn.querySelector('small');
        if (!small) continue;

        var dest = (btn.getAttribute('data-zone-destination') || '').toLowerCase().trim();
        var loc = (btn.getAttribute('data-zone-location') || '').toLowerCase().trim();
        var strongTxt = strong ? (strong.textContent || '').trim() : '';
        var smallTxt = (small.textContent || '').trim();

        var tagObj = CITY_DISTRICT_TAGS[loc] || CITY_DISTRICT_TAGS[dest] || null;
        if (!tagObj && strongTxt) {
          var normStrong = strongTxt.toLowerCase();
          if (CITY_DISTRICT_TAGS[normStrong]) tagObj = CITY_DISTRICT_TAGS[normStrong];
        }
        if (!tagObj) continue;

        var desired = ar ? tagObj.ar : tagObj.en;
        if (!desired || smallTxt === desired) continue;

        /* Replace duplicate subtitles ("Gym" under "Gym") or generic raw screen names */
        var isDuplicate = strongTxt && smallTxt.toLowerCase() === strongTxt.toLowerCase();
        var isRawSlug = Boolean(CITY_DISTRICT_TAGS[smallTxt.toLowerCase()]) ||
          smallTxt.toLowerCase() === 'hall of fame' ||
          smallTxt === 'قاعة المشاهير';

        if (isDuplicate || isRawSlug) {
          mutateTextNodeSafely(small, desired);
        }
      }
    } catch (_) {}
  }

  /* ---------------- v126: Hero Atmosphere Canvas (.zaaa-hero-atmosphere) ---------------- */
  function ensureHeroAtmosphereCanvas() {
    if (prefersReducedMotion()) return;
    try {
      var heading = document.querySelector('#zone-main .zone-page-heading');
      if (!heading) return;
      if (heading.querySelector('canvas.zaaa-hero-atmosphere')) return;

      var cv = document.createElement('canvas');
      cv.className = 'zaaa-hero-atmosphere';
      cv.setAttribute('aria-hidden', 'true');
      heading.appendChild(cv);
    } catch (_) {}
  }

  function renderHeroAtmosphere(now) {
    if (prefersReducedMotion() || document.hidden) return;
    var cv = document.querySelector('#zone-main .zone-page-heading canvas.zaaa-hero-atmosphere');
    if (!cv) return;
    try {
      var rect = cv.getBoundingClientRect();
      if (!rect || rect.width < 80 || rect.height < 36 || rect.bottom < 0 || rect.top > window.innerHeight) return;

      var dt = state.heroPrevAt ? Math.min(0.05, Math.max(0.004, (now - state.heroPrevAt) / 1000)) : 0.016;
      state.heroPrevAt = now;

      var w = Math.round(rect.width);
      var h = Math.round(rect.height);
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var pw = Math.round(w * dpr);
      var ph = Math.round(h * dpr);
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw;
        cv.height = ph;
      }

      var ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var light = isLightTheme();
      var rainAlpha = light ? 0.09 : 0.18;
      ctx.strokeStyle = 'rgba(186, 230, 253, ' + rainAlpha + ')';
      ctx.lineWidth = 1;

      for (var i = 0; i < state.heroDrops.length; i++) {
        var d = state.heroDrops[i];
        d.y += d.spd * dt * 1.35;
        d.x -= d.spd * dt * 0.14;
        if (d.y > 1.12) {
          d.y = -0.12;
          d.x = 0.24 + Math.random() * 0.78;
        }
        var rx = d.x * w;
        var ry = d.y * h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3.5, ry + d.len);
        ctx.stroke();
      }

      for (var j = 0; j < state.heroMotes.length; j++) {
        var m = state.heroMotes[j];
        m.y -= m.spd * dt;
        if (m.y < -0.08) {
          m.y = 1.08;
          m.x = 0.20 + Math.random() * 0.76;
        }
        var pulse = 0.5 + 0.5 * Math.sin(now * 0.0024 + m.phase);
        var moteAlpha = (light ? 0.12 : 0.28) + pulse * (light ? 0.12 : 0.26);
        var mx = (m.x + Math.sin(now * 0.001 + m.phase) * 0.015) * w;
        var my = m.y * h;
        ctx.fillStyle = (j % 4 === 0)
          ? 'rgba(57, 231, 163, ' + (moteAlpha * 0.85).toFixed(3) + ')'
          : 'rgba(235, 184, 88, ' + moteAlpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(mx, my, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } catch (_) {}
  }

  function runSurfacePolish() {
    ensureStyles();
    if (document.querySelector('x-dc')) return;
    enhanceQuickActions();
    enhanceCityDestinations();
    ensureHeroAtmosphereCanvas();
  }

  function scheduleSurfacePolish() {
    if (state.polishPending) return;
    state.polishPending = true;
    setTimeout(function () {
      state.polishPending = false;
      runSurfacePolish();
    }, 24);
  }

  /* ---------------- v126: rAF-Throttled MotionSites Cursor-Spotlight ---------------- */
  function applySpotlightCoords(el, clientX, clientY) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;
    var sx = Math.round(clientX - r.left);
    var sy = Math.round(clientY - r.top);
    el.style.setProperty('--spot-x', sx + 'px');
    el.style.setProperty('--spot-y', sy + 'px');
  }

  function flushSpotlightMove() {
    state.spotRaf = 0;
    var ev = state.spotEvent;
    state.spotEvent = null;
    if (!ev) return;
    try {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var cardOrQuick = t.closest('.zig-game-card, .zone-quick-actions > button');
      if (cardOrQuick) {
        applySpotlightCoords(cardOrQuick, ev.clientX, ev.clientY);
      }
      var panel = t.closest('.zone-panel');
      if (panel && panel !== cardOrQuick) {
        applySpotlightCoords(panel, ev.clientX, ev.clientY);
      }
    } catch (_) {}
  }

  /* ---------------- Screen Transition Atmosphere (180ms) ---------------- */
  function triggerScreenReveal(mainEl) {
    var el = mainEl || document.getElementById('zone-main');
    if (!el || prefersReducedMotion()) return;
    try {
      var rect = el.getBoundingClientRect();
      if (rect && rect.width > 40 && rect.top >= -40 && rect.top < window.innerHeight) {
        var sweep = document.createElement('div');
        sweep.className = 'zfx-screen-sweep';
        sweep.style.left = Math.round(rect.left) + 'px';
        sweep.style.top = Math.round(Math.max(0, rect.top)) + 'px';
        sweep.style.width = Math.round(rect.width) + 'px';
        appendFxNode(sweep, 240);
      }

      if (state.screenAnim && typeof state.screenAnim.cancel === 'function') {
        try { state.screenAnim.cancel(); } catch (_) {}
        state.screenAnim = null;
      }

      if (typeof el.animate === 'function') {
        state.screenAnim = el.animate(
          [
            { opacity: 0.74, transform: 'translate3d(0, 4px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ],
          {
            duration: 180,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'none'
          }
        );
      } else {
        el.classList.remove('zfx-screen-entering');
        void el.offsetWidth;
        el.classList.add('zfx-screen-entering');
        setTimeout(function () {
          try { el.classList.remove('zfx-screen-entering'); } catch (_) {}
        }, 190);
      }
    } catch (_) {}
  }

  function bindMainScreenObserver() {
    try {
      if (document.querySelector('x-dc')) return;
      var main = document.getElementById('zone-main');
      if (!main || main === state.mainEl) return;
      state.mainEl = main;
      state.lastScreen = main.getAttribute('data-zone-screen') || 'home';

      if (state.mainAttrObserver) {
        try { state.mainAttrObserver.disconnect(); } catch (_) {}
      }
      state.mainAttrObserver = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].attributeName === 'data-zone-screen') {
            var next = main.getAttribute('data-zone-screen') || '';
            if (next && state.lastScreen !== null && next !== state.lastScreen) {
              state.lastScreen = next;
              triggerScreenReveal(main);
              scheduleSurfacePolish();
            } else if (next) {
              state.lastScreen = next;
            }
          }
        }
      });
      state.mainAttrObserver.observe(main, { attributes: true, attributeFilter: ['data-zone-screen'] });

      if (state.mainPolishObserver) {
        try { state.mainPolishObserver.disconnect(); } catch (_) {}
      }
      state.mainPolishObserver = new MutationObserver(function () {
        scheduleSurfacePolish();
      });
      state.mainPolishObserver.observe(main, { childList: true, subtree: true });
    } catch (_) {}
  }

  function bindHudObserver() {
    try {
      if (state.hudObserver) {
        try { state.hudObserver.disconnect(); } catch (_) {}
      }
      state.hudObserver = new MutationObserver(function () {
        scheduleTelemetryCheck();
      });
      var cashEl = document.getElementById('zone-cash');
      var barsWrap = document.querySelector('.zone-profile-bars');
      if (cashEl && cashEl.parentNode) {
        state.hudObserver.observe(cashEl.parentNode, { childList: true, characterData: true, subtree: true });
      }
      if (barsWrap) {
        state.hudObserver.observe(barsWrap, {
          childList: true,
          characterData: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-valuenow']
        });
      }
    } catch (_) {}
  }

  /* ---------------- Delegated Input Listeners ---------------- */
  function setupInputListeners() {
    try {
      /* 0. Cursor-Spotlight rAF Pointer Tracking */
      document.addEventListener('pointermove', function (ev) {
        if (ev.pointerType === 'touch') return;
        state.spotEvent = { target: ev.target, clientX: ev.clientX, clientY: ev.clientY };
        if (!state.spotRaf) {
          state.spotRaf = requestAnimationFrame(flushSpotlightMove);
        }
      }, { passive: true });

      /* 1. Soft Mechanical Hover Tick (mouse only, throttled) */
      document.addEventListener('pointerover', function (ev) {
        try {
          if (!state.gestureUnlocked || isMuted()) return;
          if (ev.pointerType && ev.pointerType !== 'mouse') return;
          var t = ev.target;
          if (!(t instanceof Element)) return;
          var ctrl = t.closest('button:not(:disabled), a.zone-header-link, [role="tab"]');
          if (!ctrl || ctrl === state.lastHoverEl) return;
          state.lastHoverEl = ctrl;
          var now = performance.now();
          if (now - state.lastHoverAt < 68) return;
          state.lastHoverAt = now;
          playCue('hover');
        } catch (_) {}
      }, { passive: true });

      document.addEventListener('pointerout', function (ev) {
        try {
          if (!state.lastHoverEl) return;
          var rel = ev.relatedTarget;
          if (!rel || !(rel instanceof Node) || !state.lastHoverEl.contains(rel)) {
            state.lastHoverEl = null;
          }
        } catch (_) {}
      }, { passive: true });

      /* 2. PointerDown: Unlock WebAudio on trusted gesture + instant tactile specular pulse */
      document.addEventListener('pointerdown', function (ev) {
        try {
          if (ev.isTrusted !== false) {
            state.gestureUnlocked = true;
            state.lastUserGestureAt = Date.now();
          }
          var t = ev.target;
          if (!(t instanceof Element)) return;
          var btn = t.closest('button:not(:disabled), a.zone-header-link');
          if (!btn) return;

          var rect = btn.getBoundingClientRect();
          state.lastActionAnchor = {
            x: ev.clientX > 0 ? ev.clientX : (rect.left + rect.width * 0.5),
            y: rect.top > 0 ? rect.top : ev.clientY,
            at: performance.now(),
            el: btn
          };

          if (btn.tagName === 'BUTTON' && btn.closest('#zone-main')) {
            state.lastPointerDownPulseAt = performance.now();
            spawnButtonSpecularPulse(btn, ev.clientX, ev.clientY);
          }
        } catch (_) {}
      }, { passive: true });

      /* 3. Click: Confirm Audio Cue + Keyboard Click Fallback + Mute Toggle Sync */
      document.addEventListener('click', function (ev) {
        try {
          if (ev.isTrusted !== false) {
            state.gestureUnlocked = true;
            state.lastUserGestureAt = Date.now();
          }
          var t = ev.target;
          if (!(t instanceof Element)) return;

          var muteBtn = t.closest('#zig-sound-toggle, [data-zone-mute-toggle]');
          if (muteBtn) {
            setTimeout(function () {
              try {
                var attrMuted = muteBtn.getAttribute('data-zig-muted');
                if (attrMuted === '1' || attrMuted === '0') {
                  setMuted(attrMuted === '1');
                  return;
                }
                var txt = (muteBtn.textContent || '').toUpperCase();
                var mutedNow = txt.indexOf('OFF') >= 0 || txt.indexOf('صامت') >= 0;
                setMuted(mutedNow);
              } catch (_) {}
            }, 0);
            return;
          }

          var btn = t.closest('button:not(:disabled), a.zone-header-link');
          if (!btn) return;

          var now = performance.now();
          var rect = btn.getBoundingClientRect();
          state.lastActionAnchor = {
            x: ev.clientX > 0 ? ev.clientX : (rect.left + rect.width * 0.5),
            y: rect.top > 0 ? rect.top : (rect.bottom || 120),
            at: now,
            el: btn
          };

          if (btn.tagName === 'BUTTON' && btn.closest('#zone-main') && (now - state.lastPointerDownPulseAt) > 260) {
            spawnButtonSpecularPulse(btn, ev.clientX, ev.clientY);
          }

          if (now - state.lastClickSfxAt >= 35) {
            state.lastClickSfxAt = now;
            playCue(classifyButtonCue(btn));
          }
        } catch (_) {}
      }, { passive: true });

      document.addEventListener('keydown', function (ev) {
        if (ev.isTrusted !== false) {
          state.gestureUnlocked = true;
          state.lastUserGestureAt = Date.now();
        }
      }, { passive: true });
    } catch (_) {}
  }

  /* ---------------- Lifecycle & Boot ---------------- */
  function boot() {
    try {
      ensureLayer();
      bindMainScreenObserver();
      bindHudObserver();
      runSurfacePolish();
      evaluateTelemetryDeltas();

      window.addEventListener('zone:render', function () {
        bindMainScreenObserver();
        runSurfacePolish();
        scheduleTelemetryCheck();
      });

      if (typeof MutationObserver === 'function' && document.body && !state.rootObserver) {
        var rebindTimer = null;
        state.rootObserver = new MutationObserver(function () {
          if (rebindTimer) return;
          rebindTimer = setTimeout(function () {
            rebindTimer = null;
            if (!document.getElementById(LAYER_ID)) ensureLayer();
            if (!state.mainEl || !state.mainEl.isConnected) bindMainScreenObserver();
            runSurfacePolish();
          }, 180);
        });
        state.rootObserver.observe(document.body, { childList: true });
      }

      setInterval(function () {
        if (document.hidden) return;
        if (!state.mainEl || !state.mainEl.isConnected) bindMainScreenObserver();
        scheduleTelemetryCheck();
      }, 900);

      function heroLoop(now) {
        renderHeroAtmosphere(now);
        requestAnimationFrame(heroLoop);
      }
      requestAnimationFrame(heroLoop);
    } catch (_) {}
  }

  setupInputListeners();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ZoneGameFX = {
    version: '126.0',
    isMuted: isMuted,
    setMuted: setMuted,
    spawnDelta: spawnDelta,
    triggerScreenReveal: triggerScreenReveal,
    playCue: playCue,
    runSurfacePolish: runSurfacePolish
  };
})();

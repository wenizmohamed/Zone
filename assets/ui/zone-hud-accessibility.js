/* ==========================================================================
 * ZONE v155 - WATERCOLOR TACTICAL THREAT RADAR, SYNDICATE SINKS & A11Y SUITE
 * Exclusive Ownership: @economy-hud-sec (assets/ui/zone-hud-accessibility.js)
 * Global Public Handle: window.ZoneHudAccessibility
 *
 * Features:
 *   1. Compact Non-Intrusive Tactical Utility Pill & Tabbed Popover mounted on
 *      document.body (100% <x-dc> Fiber-safe, 0px push on #zig-home-arcade,
 *      0px horizontal overflow at 390x844 mobile).
 *   2. District Threat Radar (game-hud): Live watercolor SVG compass of Zone
 *      City's 6 districts, Police/Rival Heat rings, Next Objective waypoint,
 *      and 1-click Syndicate Sinks (Bribe Heat, Hone Weapon +6%, Bribe Wardens).
 *   3. MMO Sink/Faucet Equilibrium Telemetry (game-economy-design): Live 24h
 *      ratio gauge against the 1.08 - 1.15 healthy equilibrium band + Era/Level
 *      scaled sink pricing and replay-nonce action envelopes.
 *   4. Accessibility & Remapping (accessibility-games):
 *      - Colorblind SVG matrix filters: Standard, Deuteranopia, Protanopia, Tritanopia
 *      - Reduced Motion & Camera Shake (data-zone-reduced-motion="true")
 *      - High-Contrast Ink (data-zone-contrast="high")
 *      - Remappable Alt+1..6 & non-input 1..6 quick-navigation hotkeys
 *        (Home, Items, City, Gym, Crimes, Attack)
 *   5. Full English + Arabic RTL (dir="rtl") parity.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.ZoneHudAccessibility && window.ZoneHudAccessibility.__booted) return;

  var STORAGE_PREFS_KEY = 'zone.a11y.prefs.v155';
  var STORAGE_HOTKEYS_KEY = 'zone.a11y.hotkeys.v155';
  var STORAGE_LOCAL_SINKS_KEY = 'zone.economy.localSinks.v155';

  var VALID_COLORBLIND = {
    standard: true,
    deuteranopia: true,
    protanopia: true,
    tritanopia: true
  };

  var DEFAULT_HOTKEYS = [
    { slot: 1, screen: 'home', key: '1', en: 'Home', ar: 'الرئيسية' },
    { slot: 2, screen: 'items', key: '2', en: 'Items', ar: 'العتاد' },
    { slot: 3, screen: 'city', key: '3', en: 'City', ar: 'المدينة' },
    { slot: 4, screen: 'gym', key: '4', en: 'Gym', ar: 'النادي' },
    { slot: 5, screen: 'crimes', key: '5', en: 'Crimes', ar: 'الجرائم' },
    { slot: 6, screen: 'attack', key: '6', en: 'Attack', ar: 'الهجوم' }
  ];

  var FALLBACK_DISTRICTS = [
    { id: 'north', code: 'NTH', compass: 'N', angleDeg: 0, radiusPct: 68, nameEn: 'North Harbor & Pier 4', nameAr: 'المرفأ الشمالي والرصيف ٤', route: 'crimes', heat: 42, threatTier: 'guarded' },
    { id: 'fin', code: 'FIN', compass: 'NE', angleDeg: 60, radiusPct: 62, nameEn: 'Financial Citadel', nameAr: 'القلعة المالية', route: 'bank', heat: 24, threatTier: 'calm' },
    { id: 'res', code: 'RES', compass: 'SE', angleDeg: 125, radiusPct: 64, nameEn: 'East Safehouse Quarter', nameAr: 'حي المخابئ الشرقي', route: 'properties', heat: 16, threatTier: 'calm' },
    { id: 'red', code: 'RED', compass: 'S', angleDeg: 185, radiusPct: 72, nameEn: 'Crimson Foundry & Arena', nameAr: 'المسبك القرمزي والساحة', route: 'attack', heat: 58, threatTier: 'elevated' },
    { id: 'west', code: 'WST', compass: 'SW', angleDeg: 245, radiusPct: 66, nameEn: 'West Neon Casino Strip', nameAr: 'شارع النيون والكازينو', route: 'casino', heat: 32, threatTier: 'guarded' },
    { id: 'center', code: 'CTR', compass: 'NW', angleDeg: 305, radiusPct: 42, nameEn: 'Central Syndicate Plaza', nameAr: 'ساحة النقابة المركزية', route: 'city', heat: 28, threatTier: 'guarded' }
  ];

  var COPY = {
    en: {
      pillShort: 'Radar',
      pillLong: 'Radar & A11y',
      drawerTitle: 'Tactical Radar & Accessibility',
      closeLabel: 'Close tactical radar drawer',
      tabRadar: 'Threat Radar',
      tabEconomy: 'Sinks & Ratio',
      tabA11y: 'A11y & Keys',
      nextObjKicker: 'Next Tactical Objective',
      goBtn: 'Go',
      bribeHeatShort: 'Bribe Heat',
      honeWeaponShort: 'Hone +6%',
      bribeWardensShort: 'Bribe Wardens',
      eqTitle: '24h Faucet / Sink Equilibrium',
      eqHealthyBand: 'Healthy Band: 1.08 - 1.15',
      faucetsLbl: '24h Faucets',
      sinksLbl: '24h Sinks',
      cbHeading: 'Colorblind Vision Mode',
      cbModes: {
        standard: 'Standard',
        deuteranopia: 'Deuteranopia',
        protanopia: 'Protanopia',
        tritanopia: 'Tritanopia'
      },
      motionLbl: 'Reduced Motion & Camera Shake',
      contrastLbl: 'High-Contrast Fountain Ink',
      bareKeysLbl: 'Single-key 1..6 nav outside inputs',
      hotkeysHeading: 'Quick-Nav Hotkeys (Alt+Key or Key)',
      pressKeyPrompt: 'Press key...',
      resetKeys: 'Reset Default Keys (1..6)',
      activeBuffTag: 'ACTIVE',
      onTxt: 'ON',
      offTxt: 'OFF'
    },
    ar: {
      pillShort: 'الرادار',
      pillLong: 'الرادار والوصول',
      drawerTitle: 'الرادار التكتيكي وإمكانية الوصول',
      closeLabel: 'إغلاق لوحة الرادار والوصول',
      tabRadar: 'رادار التهديد',
      tabEconomy: 'التوازن والمصارف',
      tabA11y: 'الوصول والاختصارات',
      nextObjKicker: 'الهدف التكتيكي التالي',
      goBtn: 'انتقل',
      bribeHeatShort: 'تبييض الحرارة',
      honeWeaponShort: 'صقل +6%',
      bribeWardensShort: 'رشوة الحراس',
      eqTitle: 'توازن التدفق والمصارف (24 ساعة)',
      eqHealthyBand: 'النطاق الصحي: 1.08 - 1.15',
      faucetsLbl: 'التدفقات 24س',
      sinksLbl: 'المصارف 24س',
      cbHeading: 'نمط عمى الألوان البصري',
      cbModes: {
        standard: 'قياسي',
        deuteranopia: 'عمى الأخضر',
        protanopia: 'عمى الأحمر',
        tritanopia: 'عمى الأزرق'
      },
      motionLbl: 'تقليل الحركة واهتزاز الكاميرا',
      contrastLbl: 'حبر عالي التباين',
      bareKeysLbl: 'تنقل سريع بالأزرار خارج الحقول',
      hotkeysHeading: 'اختصارات التنقل السريع (Alt+زر)',
      pressKeyPrompt: 'اضغط زراً...',
      resetKeys: 'استعادة الافتراضي (1..6)',
      activeBuffTag: 'مفعّل',
      onTxt: 'مفعّل',
      offTxt: 'معطّل'
    }
  };

  var state = {
    open: false,
    activeTab: 'radar',
    selectedDistrictId: 'north',
    listeningScreen: null,
    busySink: null,
    toast: null,
    prefs: {
      colorblind: 'standard',
      reducedMotion: false,
      highContrast: false,
      allowBareHotkeys: true
    },
    hotkeys: cloneHotkeys(DEFAULT_HOTKEYS),
    hudData: null,
    localSinks: {}
  };

  function cloneHotkeys(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      out.push({
        slot: list[i].slot,
        screen: list[i].screen,
        key: String(list[i].key),
        en: list[i].en,
        ar: list[i].ar
      });
    }
    return out;
  }

  function isArabic() {
    var doc = document.documentElement;
    if (doc && (doc.dir === 'rtl' || doc.lang === 'ar')) return true;
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

  function fmtMoney(val) {
    var n = Math.max(0, Math.round(Number(val) || 0));
    return '$' + n.toLocaleString('en-US');
  }

  function readPlayerSnapshot() {
    var level = 1;
    var cash = 4000;
    try {
      var g = window.__zoneGame;
      if (g && g.p) {
        if (Number.isFinite(Number(g.p.level))) level = Math.max(1, Math.round(Number(g.p.level)));
        if (Number.isFinite(Number(g.p.cash))) cash = Math.max(0, Math.round(Number(g.p.cash)));
      }
      var cashNode = document.getElementById('zone-cash');
      if (cashNode && cashNode.textContent) {
        var parsed = Number(cashNode.textContent.replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(parsed) && parsed >= 0) cash = Math.round(parsed);
      }
    } catch (_) {}
    return { level: level, cash: cash };
  }

  function computeClientSinkPrice(baseCost, level) {
    var lv = Math.max(1, level);
    var eraMult = lv <= 2 ? 1.0 : lv <= 6 ? 1.85 : lv <= 11 ? 3.6 : lv <= 14 ? 7.2 : lv <= 24 ? 15.5 : 34.0;
    var lvCurve = 1.0 + (lv - 1) * 0.06;
    return Math.max(100, Math.round((baseCost * eraMult * lvCurve) / 25) * 25);
  }

  /* ------------------------------------------------------------------------
   * 1. PERSISTENCE & DOM ATTRIBUTE SYNC
   * ------------------------------------------------------------------------ */
  function loadPersistedState() {
    var prefersReduced = false;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        prefersReduced = true;
      }
    } catch (_) {}

    state.prefs.reducedMotion = prefersReduced;

    try {
      var rawPrefs = localStorage.getItem(STORAGE_PREFS_KEY);
      if (rawPrefs) {
        var parsed = JSON.parse(rawPrefs);
        if (parsed && typeof parsed === 'object') {
          if (VALID_COLORBLIND[parsed.colorblind]) state.prefs.colorblind = parsed.colorblind;
          if (typeof parsed.reducedMotion === 'boolean') state.prefs.reducedMotion = parsed.reducedMotion;
          if (typeof parsed.highContrast === 'boolean') state.prefs.highContrast = parsed.highContrast;
          if (typeof parsed.allowBareHotkeys === 'boolean') state.prefs.allowBareHotkeys = parsed.allowBareHotkeys;
        }
      }
    } catch (_) {}

    try {
      var rawKeys = localStorage.getItem(STORAGE_HOTKEYS_KEY);
      if (rawKeys) {
        var parsedKeys = JSON.parse(rawKeys);
        if (Array.isArray(parsedKeys) && parsedKeys.length === 6) {
          for (var i = 0; i < state.hotkeys.length; i++) {
            var match = parsedKeys[i];
            if (match && typeof match.key === 'string' && /^[A-Za-z0-9]$/.test(match.key)) {
              state.hotkeys[i].key = match.key.toUpperCase();
            }
          }
        }
      }
    } catch (_) {}

    try {
      var rawSinks = localStorage.getItem(STORAGE_LOCAL_SINKS_KEY);
      if (rawSinks) {
        var parsedSinks = JSON.parse(rawSinks);
        if (parsedSinks && typeof parsedSinks === 'object') state.localSinks = parsedSinks;
      }
    } catch (_) {}

    applyDocumentA11yAttributes();
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(state.prefs));
    } catch (_) {}
  }

  function saveHotkeys() {
    try {
      localStorage.setItem(STORAGE_HOTKEYS_KEY, JSON.stringify(state.hotkeys));
    } catch (_) {}
  }

  function applyDocumentA11yAttributes() {
    var html = document.documentElement;
    if (!html) return;

    html.dataset.zoneColorblind = state.prefs.colorblind || 'standard';
    html.dataset.zoneReducedMotion = state.prefs.reducedMotion ? 'true' : 'false';
    if (state.prefs.highContrast) {
      html.setAttribute('data-zone-contrast', 'high');
    } else {
      html.removeAttribute('data-zone-contrast');
    }
  }

  /* ------------------------------------------------------------------------
   * 2. SCIENTIFICALLY CALIBRATED SVG COLORBLIND MATRICES
   * ------------------------------------------------------------------------ */
  function ensureSvgColorblindFilters() {
    if (!document.body || document.getElementById('zhud-svg-filters')) return;
    var holder = document.createElement('div');
    holder.id = 'zhud-svg-filters';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" focusable="false">' +
        '<defs>' +
          '<filter id="zhud-cb-deuteranopia" color-interpolation-filters="sRGB">' +
            '<feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.700 0.300 0 0 0  0 0.300 0.700 0 0  0 0 0 1 0"/>' +
          '</filter>' +
          '<filter id="zhud-cb-protanopia" color-interpolation-filters="sRGB">' +
            '<feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>' +
          '</filter>' +
          '<filter id="zhud-cb-tritanopia" color-interpolation-filters="sRGB">' +
            '<feColorMatrix type="matrix" values="0.950 0.050 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>' +
          '</filter>' +
        '</defs>' +
      '</svg>';
    document.body.appendChild(holder);
  }

  /* ------------------------------------------------------------------------
   * 3. HAND-INKED WATERCOLOR COMPASS & UI SVGS (ZERO EMOJIS)
   * ------------------------------------------------------------------------ */
  var SVG_RADAR_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" fill="#689448" fill-opacity="0.24"/>' +
      '<circle cx="12" cy="12" r="5" fill="#d99a38" fill-opacity="0.22"/>' +
      '<path d="M12 12L17.8 6.2"/>' +
      '<circle cx="12" cy="12" r="1.8" fill="currentColor"/>' +
    '</svg>';

  var SVG_CLOSE_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M6 6L18 18M18 6L6 18"/>' +
    '</svg>';

  function renderCompassRadarSvg(districts, waypointDistrictId, ar) {
    var blipsHtml = '';
    for (var i = 0; i < districts.length; i++) {
      var d = districts[i];
      var rad = ((Number(d.angleDeg) - 90) * Math.PI) / 180;
      var distPx = (Math.min(76, Math.max(28, Number(d.radiusPct) || 60)) / 100) * 62;
      var cx = (80 + Math.cos(rad) * distPx).toFixed(1);
      var cy = (80 + Math.sin(rad) * distPx).toFixed(1);
      var isSel = d.id === state.selectedDistrictId;
      var isWp = d.id === waypointDistrictId;
      var fill = d.heat >= 70 ? '#d94f38' : d.heat >= 45 ? '#e0a028' : d.heat >= 25 ? '#4a86c8' : '#5ca346';

      blipsHtml +=
        '<g class="zhud-radar-blip" data-dist-blip="' + esc(d.id) + '">' +
          (isWp ? '<circle cx="' + cx + '" cy="' + cy + '" r="10.5" fill="none" stroke="#e8b548" stroke-width="1.6" stroke-dasharray="2.5 2"/>' : '') +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isSel ? '7.2' : '5.8') + '" fill="' + fill + '" stroke="#1e1b18" stroke-width="1.5"/>' +
          '<text x="' + cx + '" y="' + (Number(cy) + 14).toFixed(1) + '" text-anchor="middle" font-size="8.5" font-weight="800" fill="currentColor">' +
            esc(d.code) +
          '</text>' +
        '</g>';
    }

    return (
      '<svg class="zhud-compass-svg" viewBox="0 0 160 160" role="img" aria-label="' + esc(ar ? 'رادار مقاطعات مدينة الزون' : 'Zone City 6-District Threat Radar') + '">' +
        '<circle cx="80" cy="80" r="68" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="1.2"/>' +
        '<circle cx="80" cy="80" r="46" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-dasharray="3 3" stroke-width="1.1"/>' +
        '<circle cx="80" cy="80" r="23" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"/>' +
        '<line x1="80" y1="8" x2="80" y2="152" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>' +
        '<line x1="8" y1="80" x2="152" y2="80" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>' +
        '<g class="zhud-radar-sweep">' +
          '<path d="M80 80 L80 12 A68 68 0 0 1 132 36 Z" fill="#6fa84e" fill-opacity="0.18"/>' +
        '</g>' +
        '<text x="80" y="15" text-anchor="middle" font-size="8.5" font-weight="800" fill="currentColor" opacity="0.65">N</text>' +
        '<text x="147" y="83" text-anchor="middle" font-size="8.5" font-weight="800" fill="currentColor" opacity="0.65">E</text>' +
        '<text x="80" y="154" text-anchor="middle" font-size="8.5" font-weight="800" fill="currentColor" opacity="0.65">S</text>' +
        '<text x="13" y="83" text-anchor="middle" font-size="8.5" font-weight="800" fill="currentColor" opacity="0.65">W</text>' +
        blipsHtml +
        '<circle cx="80" cy="80" r="3.2" fill="#e8b548" stroke="#1e1b18" stroke-width="1.2"/>' +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------------------
   * 4. NAVIGATION & CRYPTOGRAPHIC ACTION NONCE HELPERS
   * ------------------------------------------------------------------------ */
  function generateActionNonce() {
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
        var hex = '';
        for (var i = 0; i < bytes.length; i++) {
          hex += ('0' + bytes[i].toString(16)).slice(-2);
        }
        return 'zn155-' + Date.now().toString(36) + '-' + hex;
      }
    } catch (_) {}
    return 'zn155-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function attachActionEnvelope(payload, actionKey) {
    var base = payload && typeof payload === 'object' ? payload : {};
    base.nonce = base.nonce || generateActionNonce();
    base.actionKey = actionKey || base.action || 'mutation';
    return base;
  }

  function navigateToZoneScreen(screenId) {
    var target = String(screenId || 'home').trim().toLowerCase();
    try {
      var navBtn = document.querySelector(
        'aside.zone-sidebar #zone-area-navigation button[data-zone-screen="' + target + '"]'
      );
      if (navBtn) {
        navBtn.click();
        return true;
      }
      if (window.__zoneGame && typeof window.__zoneGame.go === 'function') {
        window.__zoneGame.go(target);
        return true;
      }
      if (window.ZoneRouteNavigation && typeof window.ZoneRouteNavigation.enter === 'function') {
        window.ZoneRouteNavigation.enter(target);
        return true;
      }
    } catch (_) {}
    return false;
  }

  /* ------------------------------------------------------------------------
   * 5. SERVER TELEMETRY & SYNDICATE SINK EXECUTION (WITH GRACEFUL FALLBACK)
   * ------------------------------------------------------------------------ */
  function buildEffectiveHudModel() {
    var snap = readPlayerSnapshot();
    var now = Date.now();
    var srv = state.hudData;

    var districts = (srv && srv.radar && Array.isArray(srv.radar.districts) && srv.radar.districts.length === 6)
      ? srv.radar.districts
      : FALLBACK_DISTRICTS.map(function (d) {
          var copy = Object.assign({}, d);
          var launder = state.localSinks.launder_heat;
          if (launder && launder.expiresAtMs > now && launder.districtId === d.id) {
            copy.heat = Math.max(0, copy.heat - 35);
            copy.threatTier = copy.heat >= 70 ? 'critical' : copy.heat >= 45 ? 'elevated' : copy.heat >= 25 ? 'guarded' : 'calm';
            copy.shielded = true;
          }
          return copy;
        });

    var waypoint = (srv && srv.radar && srv.radar.nextObjective) || {
      districtId: 'north',
      route: 'crimes',
      labelEn: 'Run Pier 4 Contraband Operation in North Harbor',
      labelAr: 'تنفيذ عملية تهريب في المرفأ الشمالي والرصيف ٤'
    };

    var globalEq = (srv && srv.equilibrium && srv.equilibrium.global) || {
      faucets24h: 14250,
      sinks24h: 12800,
      faucetSinkRatio: 1.1133,
      inHealthyBand: true,
      bandStatus: 'healthy_equilibrium'
    };

    var sinks = (srv && srv.syndicateSinks) || {
      launder_heat: {
        id: 'launder_heat',
        nameEn: 'Bribe & Launder District Heat',
        nameAr: 'رشوة وتبييض حرارة المقاطعة',
        descEn: 'Drops District Police Heat by -35 pts immediately and arms a 90m shield.',
        descAr: 'يخفض حرارة الشرطة بمقدار 35 نقطة فوراً ويفعّل درع تهدئة لـ90 دقيقة.',
        costCash: computeClientSinkPrice(450, snap.level),
        activeBuff: state.localSinks.launder_heat && state.localSinks.launder_heat.expiresAtMs > now ? state.localSinks.launder_heat : null
      },
      hone_weapon: {
        id: 'hone_weapon',
        nameEn: 'Syndicate Precision Hone (+6%)',
        nameAr: 'صقل السلاح التكتيكي (+6%)',
        descEn: 'Grants +6% weapon precision & hit edge for 2 hours.',
        descAr: 'يمنح +6% دقة إصابة وتفوّقاً تكتيكياً للسلاح لمدة ساعتين.',
        costCash: computeClientSinkPrice(600, snap.level),
        activeBuff: state.localSinks.hone_weapon && state.localSinks.hone_weapon.expiresAtMs > now ? state.localSinks.hone_weapon : null
      },
      bribe_wardens: {
        id: 'bribe_wardens',
        nameEn: 'Bribe Wardens & Trauma Triage',
        nameAr: 'رشوة الحراس وتسريع الإخلاء',
        descEn: 'Cuts active Jail & Hospital recovery timers by 50% + 2h retainer.',
        descAr: 'يقلص وقت السجن والمستشفى الحالي بنسبة 50% مع ضمان لساعتين.',
        costCash: computeClientSinkPrice(500, snap.level),
        activeBuff: state.localSinks.bribe_wardens && state.localSinks.bribe_wardens.expiresAtMs > now ? state.localSinks.bribe_wardens : null
      }
    };

    return {
      level: (srv && srv.player && srv.player.level) || snap.level,
      cash: (srv && srv.player && Number.isFinite(srv.player.cash)) ? srv.player.cash : snap.cash,
      districts: districts,
      waypoint: waypoint,
      equilibrium: globalEq,
      sinks: sinks
    };
  }

  function refreshEconomyState() {
    if (typeof window.fetch !== 'function') return Promise.resolve(null);
    return window.fetch('/api/v1/syndicate-economy', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (json) {
        if (json && json.equilibriumHud) {
          state.hudData = json.equilibriumHud;
        } else if (json && json.equilibrium && json.syndicateSinks) {
          state.hudData = json;
        }
        render();
        return state.hudData;
      })
      .catch(function () {
        return null;
      });
  }

  function executeSink(sinkKey, districtId) {
    if (state.busySink) return Promise.resolve(false);
    var targetDistrict = districtId || state.selectedDistrictId || 'north';
    state.busySink = sinkKey;
    render();

    var body = attachActionEnvelope(
      {
        action: 'economy.sink',
        sinkKey: sinkKey,
        id: sinkKey,
        districtId: targetDistrict
      },
      'economy.sink.' + sinkKey
    );

    var applyLocalFallback = function () {
      var durMs = sinkKey === 'launder_heat' ? 5400000 : 7200000;
      state.localSinks[sinkKey] = {
        sinkKey: sinkKey,
        districtId: targetDistrict,
        expiresAtMs: Date.now() + durMs,
        remainingSec: Math.round(durMs / 1000)
      };
      try {
        localStorage.setItem(STORAGE_LOCAL_SINKS_KEY, JSON.stringify(state.localSinks));
      } catch (_) {}
      state.toast = {
        tone: 'ok',
        msg: isArabic() ? 'تم تفعيل مصرف النقابة بنجاح.' : 'Syndicate Sink activated.'
      };
    };

    if (typeof window.fetch !== 'function') {
      applyLocalFallback();
      state.busySink = null;
      try {
        if (window.ZoneAudioHaptics && typeof window.ZoneAudioHaptics.play === 'function') {
          window.ZoneAudioHaptics.play('cash_register');
        } else if (typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('zone:audio-cue', { detail: { cue: 'cash_register', sinkKey: sinkKey } }));
        }
      } catch (_) {}
      render();
      return Promise.resolve(true);
    }

    return window.fetch('/api/v1/syndicate-economy/action', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (out) {
        state.busySink = null;
        if (out.ok && out.data && (out.data.hudState || out.data.equilibriumHud)) {
          state.hudData = out.data.hudState || out.data.equilibriumHud;
          state.toast = {
            tone: 'ok',
            msg: isArabic() ? 'تم خصم التكلفة وتفعيل الميزة بنجاح!' : 'Syndicate Sink settled on ledger!'
          };
        } else if (out.data && out.data.error && /insufficient|cash/i.test(out.data.error)) {
          state.toast = { tone: 'error', msg: out.data.error };
        } else {
          // Graceful client-side activation before Phase 2 route merge or offline mode
          applyLocalFallback();
        }
        render();
        return true;
      })
      .catch(function () {
        state.busySink = null;
        applyLocalFallback();
        render();
        return true;
      });
  }

  /* ------------------------------------------------------------------------
   * 6. RENDERING THE WATERCOLOR TACTICAL PILL & 3-TAB POPOVER
   * ------------------------------------------------------------------------ */
  function ensureRoot() {
    if (!document.body) return null;
    ensureSvgColorblindFilters();

    var root = document.getElementById('zhud-root');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'zhud-root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Tactical Radar & Accessibility');
    root.innerHTML =
      '<section id="zhud-popover" role="dialog" aria-modal="false" hidden></section>' +
      '<button type="button" id="zhud-trigger" aria-expanded="false" aria-controls="zhud-popover"></button>';

    document.body.appendChild(root);

    var trigger = root.querySelector('#zhud-trigger');
    trigger.addEventListener('click', function () {
      state.open = !state.open;
      state.listeningScreen = null;
      if (state.open && !state.hudData) {
        refreshEconomyState();
      }
      render();
    });

    root.addEventListener('click', handlePopoverClick);
    return root;
  }

  function handlePopoverClick(ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    var closeBtn = target.closest('[data-zhud-close]');
    if (closeBtn) {
      state.open = false;
      state.listeningScreen = null;
      render();
      return;
    }

    var tabBtn = target.closest('[data-zhud-tab]');
    if (tabBtn) {
      state.activeTab = tabBtn.getAttribute('data-zhud-tab') || 'radar';
      state.listeningScreen = null;
      state.toast = null;
      render();
      return;
    }

    var blip = target.closest('[data-dist-blip]');
    if (blip) {
      state.selectedDistrictId = blip.getAttribute('data-dist-blip') || 'north';
      render();
      return;
    }

    var distRow = target.closest('[data-dist-row]');
    if (distRow) {
      var distId = distRow.getAttribute('data-dist-row');
      if (state.selectedDistrictId === distId && distRow.getAttribute('data-route')) {
        navigateToZoneScreen(distRow.getAttribute('data-route'));
      } else {
        state.selectedDistrictId = distId;
        render();
      }
      return;
    }

    var goBtn = target.closest('[data-zhud-go]');
    if (goBtn) {
      navigateToZoneScreen(goBtn.getAttribute('data-zhud-go'));
      return;
    }

    var sinkBtn = target.closest('[data-zhud-sink]');
    if (sinkBtn) {
      executeSink(
        sinkBtn.getAttribute('data-zhud-sink'),
        sinkBtn.getAttribute('data-zhud-dist') || state.selectedDistrictId
      );
      return;
    }

    var cbBtn = target.closest('[data-zhud-cb]');
    if (cbBtn) {
      setColorblindMode(cbBtn.getAttribute('data-zhud-cb'));
      return;
    }

    var toggleBtn = target.closest('[data-zhud-toggle]');
    if (toggleBtn) {
      var kind = toggleBtn.getAttribute('data-zhud-toggle');
      if (kind === 'motion') setReducedMotion(!state.prefs.reducedMotion);
      else if (kind === 'contrast') setHighContrast(!state.prefs.highContrast);
      else if (kind === 'barekeys') {
        state.prefs.allowBareHotkeys = !state.prefs.allowBareHotkeys;
        savePrefs();
        render();
      }
      return;
    }

    var hkBtn = target.closest('[data-zhud-rebind]');
    if (hkBtn) {
      var scr = hkBtn.getAttribute('data-zhud-rebind');
      state.listeningScreen = state.listeningScreen === scr ? null : scr;
      render();
      return;
    }

    var resetBtn = target.closest('[data-zhud-reset-keys]');
    if (resetBtn) {
      resetHotkeys();
    }
  }

  function renderRadarTab(model, copy, ar) {
    var wp = model.waypoint;
    var distRows = '';
    var selectedDist = model.districts[0];

    for (var i = 0; i < model.districts.length; i++) {
      var d = model.districts[i];
      if (d.id === state.selectedDistrictId) selectedDist = d;
      distRows +=
        '<button type="button" class="zhud-dist-row" data-dist-row="' + esc(d.id) + '" data-route="' + esc(d.route) + '" data-active="' + (d.id === state.selectedDistrictId ? 'true' : 'false') + '">' +
          '<span class="zhud-dist-name">' + esc(ar ? d.nameAr : d.nameEn) + '</span>' +
          '<bdi class="zhud-heat-pill" data-tier="' + esc(d.threatTier) + '">' + Math.round(d.heat) + '%</bdi>' +
        '</button>';
    }

    var launderCost = model.sinks.launder_heat ? model.sinks.launder_heat.costCash : 450;
    var honeCost = model.sinks.hone_weapon ? model.sinks.hone_weapon.costCash : 600;

    return (
      '<div class="zhud-radar-grid">' +
        '<div class="zhud-compass-box">' +
          renderCompassRadarSvg(model.districts, wp.districtId, ar) +
        '</div>' +
        '<div class="zhud-district-list">' + distRows + '</div>' +
      '</div>' +
      '<div class="zhud-waypoint-card">' +
        '<div class="zhud-wp-copy">' +
          '<div class="zhud-wp-kicker">' + esc(copy.nextObjKicker) + '</div>' +
          '<div class="zhud-wp-title">' + esc(ar ? wp.labelAr : wp.labelEn) + '</div>' +
        '</div>' +
        '<button type="button" class="zhud-btn primary" data-zhud-go="' + esc(wp.route) + '">' + esc(copy.goBtn) + '</button>' +
      '</div>' +
      '<div class="zhud-sink-quick-row">' +
        '<button type="button" class="zhud-btn" data-zhud-sink="launder_heat" data-zhud-dist="' + esc(selectedDist ? selectedDist.id : 'north') + '"' + (state.busySink ? ' disabled' : '') + '>' +
          esc(copy.bribeHeatShort) + ' · <bdi>' + fmtMoney(launderCost) + '</bdi>' +
        '</button>' +
        '<button type="button" class="zhud-btn" data-zhud-sink="hone_weapon"' + (state.busySink ? ' disabled' : '') + '>' +
          esc(copy.honeWeaponShort) + ' · <bdi>' + fmtMoney(honeCost) + '</bdi>' +
        '</button>' +
      '</div>'
    );
  }

  function renderEconomyTab(model, copy, ar) {
    var eq = model.equilibrium;
    var ratio = Number(eq.faucetSinkRatio) || 1.115;
    // Map ratio [0.80 .. 1.50] to [4% .. 96%] along the gauge bar
    var markerPct = Math.max(4, Math.min(96, Math.round(((ratio - 0.8) / 0.7) * 100)));

    var sinkCards = '';
    var keys = ['launder_heat', 'hone_weapon', 'bribe_wardens'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = model.sinks[k];
      if (!s) continue;
      var activeTag = s.activeBuff
        ? ' <span class="zhud-trig-badge">' + esc(copy.activeBuffTag) + '</span>'
        : '';
      sinkCards +=
        '<div class="zhud-sink-card">' +
          '<div class="zhud-sink-head">' +
            '<span>' + esc(ar ? s.nameAr : s.nameEn) + activeTag + '</span>' +
            '<bdi>' + fmtMoney(s.costCash) + '</bdi>' +
          '</div>' +
          '<p class="zhud-sink-desc">' + esc(ar ? s.descAr : s.descEn) + '</p>' +
          '<button type="button" class="zhud-btn primary" data-zhud-sink="' + esc(k) + '"' + (state.busySink ? ' disabled' : '') + '>' +
            esc(ar ? s.nameAr : s.nameEn) + ' (' + fmtMoney(s.costCash) + ')' +
          '</button>' +
        '</div>';
    }

    return (
      '<div class="zhud-eq-card">' +
        '<div class="zhud-eq-top">' +
          '<span>' + esc(copy.eqTitle) + '</span>' +
          '<bdi class="zhud-trig-badge"' + (eq.inHealthyBand === false ? ' data-alert="high"' : '') + '>' + ratio.toFixed(2) + 'x</bdi>' +
        '</div>' +
        '<div class="zhud-eq-track" role="meter" aria-valuemin="0.8" aria-valuemax="1.5" aria-valuenow="' + ratio.toFixed(2) + '">' +
          '<div class="zhud-eq-band" title="' + esc(copy.eqHealthyBand) + '"></div>' +
          '<div class="zhud-eq-marker" style="left:' + markerPct + '%"></div>' +
        '</div>' +
        '<div class="zhud-eq-meta">' +
          '<span>' + esc(copy.faucetsLbl) + ': <bdi>' + fmtMoney(eq.faucets24h) + '</bdi></span>' +
          '<span>' + esc(copy.eqHealthyBand) + '</span>' +
          '<span>' + esc(copy.sinksLbl) + ': <bdi>' + fmtMoney(eq.sinks24h) + '</bdi></span>' +
        '</div>' +
      '</div>' +
      '<div class="zhud-sink-grid">' + sinkCards + '</div>'
    );
  }

  function renderA11yTab(copy, ar) {
    var cbModes = ['standard', 'deuteranopia', 'protanopia', 'tritanopia'];
    var cbHtml = '';
    for (var i = 0; i < cbModes.length; i++) {
      var m = cbModes[i];
      var pressed = state.prefs.colorblind === m;
      cbHtml +=
        '<button type="button" class="zhud-chip-btn" data-zhud-cb="' + m + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' +
          esc(copy.cbModes[m]) +
        '</button>';
    }

    var hkHtml = '';
    for (var j = 0; j < state.hotkeys.length; j++) {
      var hk = state.hotkeys[j];
      var listening = state.listeningScreen === hk.screen;
      hkHtml +=
        '<button type="button" class="zhud-hk-btn" data-zhud-rebind="' + esc(hk.screen) + '" data-listening="' + (listening ? 'true' : 'false') + '">' +
          '<span>' + esc(ar ? hk.ar : hk.en) + '</span>' +
          '<kbd class="zhud-kbd">' + esc(listening ? copy.pressKeyPrompt : ('Alt+' + hk.key)) + '</kbd>' +
        '</button>';
    }

    return (
      '<div class="zhud-a11y-section">' +
        '<div class="zhud-sec-label">' + esc(copy.cbHeading) + '</div>' +
        '<div class="zhud-cb-grid">' + cbHtml + '</div>' +
      '</div>' +
      '<div class="zhud-a11y-section">' +
        '<div class="zhud-toggle-row">' +
          '<span>' + esc(copy.motionLbl) + '</span>' +
          '<button type="button" class="zhud-chip-btn" data-zhud-toggle="motion" aria-pressed="' + (state.prefs.reducedMotion ? 'true' : 'false') + '">' +
            esc(state.prefs.reducedMotion ? copy.onTxt : copy.offTxt) +
          '</button>' +
        '</div>' +
        '<div class="zhud-toggle-row">' +
          '<span>' + esc(copy.contrastLbl) + '</span>' +
          '<button type="button" class="zhud-chip-btn" data-zhud-toggle="contrast" aria-pressed="' + (state.prefs.highContrast ? 'true' : 'false') + '">' +
            esc(state.prefs.highContrast ? copy.onTxt : copy.offTxt) +
          '</button>' +
        '</div>' +
        '<div class="zhud-toggle-row">' +
          '<span>' + esc(copy.bareKeysLbl) + '</span>' +
          '<button type="button" class="zhud-chip-btn" data-zhud-toggle="barekeys" aria-pressed="' + (state.prefs.allowBareHotkeys ? 'true' : 'false') + '">' +
            esc(state.prefs.allowBareHotkeys ? copy.onTxt : copy.offTxt) +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zhud-a11y-section">' +
        '<div class="zhud-sec-label">' + esc(copy.hotkeysHeading) + '</div>' +
        '<div class="zhud-hotkey-grid">' + hkHtml + '</div>' +
        '<button type="button" class="zhud-btn" data-zhud-reset-keys="1">' + esc(copy.resetKeys) + '</button>' +
      '</div>'
    );
  }

  function render() {
    var root = ensureRoot();
    if (!root) return;

    var ar = isArabic();
    var copy = t();
    var model = buildEffectiveHudModel();

    var maxHeat = 0;
    for (var i = 0; i < model.districts.length; i++) {
      if (model.districts[i].heat > maxHeat) maxHeat = model.districts[i].heat;
    }

    root.setAttribute('aria-label', copy.drawerTitle);

    var trigger = root.querySelector('#zhud-trigger');
    trigger.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    trigger.setAttribute('aria-label', copy.pillLong);
    trigger.title = copy.pillLong;
    trigger.innerHTML =
      '<span class="zhud-trig-ico">' + SVG_RADAR_ICON + '</span>' +
      '<span class="zhud-trig-label-long">' + esc(copy.pillLong) + '</span>' +
      '<bdi class="zhud-trig-badge"' + (maxHeat >= 70 ? ' data-alert="high"' : '') + '>' + Math.round(maxHeat) + '%</bdi>';

    var popover = root.querySelector('#zhud-popover');
    if (!state.open) {
      popover.setAttribute('hidden', '');
      return;
    }
    popover.removeAttribute('hidden');
    popover.setAttribute('aria-label', copy.drawerTitle);

    var tabBody = '';
    if (state.activeTab === 'economy') {
      tabBody = renderEconomyTab(model, copy, ar);
    } else if (state.activeTab === 'a11y') {
      tabBody = renderA11yTab(copy, ar);
    } else {
      tabBody = renderRadarTab(model, copy, ar);
    }

    var toastHtml = state.toast
      ? '<div class="zhud-status-toast" role="status"' + (state.toast.tone === 'error' ? ' data-tone="error"' : '') + '>' + esc(state.toast.msg) + '</div>'
      : '';

    popover.innerHTML =
      '<header class="zhud-head">' +
        '<div class="zhud-head-title">' +
          '<span class="zhud-trig-ico">' + SVG_RADAR_ICON + '</span>' +
          '<span>' + esc(copy.drawerTitle) + '</span>' +
        '</div>' +
        '<button type="button" class="zhud-close-btn" data-zhud-close="1" aria-label="' + esc(copy.closeLabel) + '">' +
          SVG_CLOSE_ICON +
        '</button>' +
      '</header>' +
      '<div class="zhud-tabs" role="tablist">' +
        '<button type="button" role="tab" class="zhud-tab" data-zhud-tab="radar" aria-selected="' + (state.activeTab === 'radar' ? 'true' : 'false') + '">' + esc(copy.tabRadar) + '</button>' +
        '<button type="button" role="tab" class="zhud-tab" data-zhud-tab="economy" aria-selected="' + (state.activeTab === 'economy' ? 'true' : 'false') + '">' + esc(copy.tabEconomy) + '</button>' +
        '<button type="button" role="tab" class="zhud-tab" data-zhud-tab="a11y" aria-selected="' + (state.activeTab === 'a11y' ? 'true' : 'false') + '">' + esc(copy.tabA11y) + '</button>' +
      '</div>' +
      '<div class="zhud-body">' +
        toastHtml +
        tabBody +
      '</div>';
  }

  /* ------------------------------------------------------------------------
   * 7. KEYBOARD NAVIGATION & REMAPPING LISTENER
   * ------------------------------------------------------------------------ */
  function isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
    return false;
  }

  function onGlobalKeyDown(ev) {
    if (!ev || ev.defaultPrevented) return;

    if (ev.key === 'Escape' && state.open) {
      if (state.listeningScreen) {
        state.listeningScreen = null;
      } else {
        state.open = false;
      }
      render();
      return;
    }

    // Active hotkey rebinding capture
    if (state.listeningScreen) {
      var rawKey = String(ev.key || '');
      if (/^[A-Za-z0-9]$/.test(rawKey)) {
        ev.preventDefault();
        rebindHotkey(state.listeningScreen, rawKey);
        state.listeningScreen = null;
        render();
      }
      return;
    }

    if (ev.ctrlKey || ev.metaKey) return;
    if (isEditableTarget(ev.target) || isEditableTarget(document.activeElement)) return;

    var pressed = String(ev.key || '').toUpperCase();
    if (!pressed || pressed.length !== 1) return;

    if (!ev.altKey && !state.prefs.allowBareHotkeys) return;
    if (!ev.altKey && ev.shiftKey) return;

    for (var i = 0; i < state.hotkeys.length; i++) {
      if (state.hotkeys[i].key.toUpperCase() === pressed) {
        ev.preventDefault();
        navigateToZoneScreen(state.hotkeys[i].screen);
        return;
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 8. PUBLIC API (window.ZoneHudAccessibility)
   * ------------------------------------------------------------------------ */
  function setColorblindMode(mode) {
    var m = String(mode || 'standard').toLowerCase();
    if (!VALID_COLORBLIND[m]) m = 'standard';
    state.prefs.colorblind = m;
    savePrefs();
    applyDocumentA11yAttributes();
    render();
    return m;
  }

  function setReducedMotion(enabled) {
    state.prefs.reducedMotion = Boolean(enabled);
    savePrefs();
    applyDocumentA11yAttributes();
    render();
    return state.prefs.reducedMotion;
  }

  function setHighContrast(enabled) {
    state.prefs.highContrast = Boolean(enabled);
    savePrefs();
    applyDocumentA11yAttributes();
    render();
    return state.prefs.highContrast;
  }

  function rebindHotkey(screenId, newKey) {
    var cleanKey = String(newKey || '').trim().toUpperCase();
    if (!/^[A-Z0-9]$/.test(cleanKey)) return false;

    var targetIdx = -1;
    var conflictIdx = -1;
    for (var i = 0; i < state.hotkeys.length; i++) {
      if (state.hotkeys[i].screen === screenId) targetIdx = i;
      else if (state.hotkeys[i].key.toUpperCase() === cleanKey) conflictIdx = i;
    }
    if (targetIdx < 0) return false;

    var prevKey = state.hotkeys[targetIdx].key;
    state.hotkeys[targetIdx].key = cleanKey;
    if (conflictIdx >= 0) {
      state.hotkeys[conflictIdx].key = prevKey;
    }
    saveHotkeys();
    render();
    return true;
  }

  function resetHotkeys() {
    state.hotkeys = cloneHotkeys(DEFAULT_HOTKEYS);
    state.listeningScreen = null;
    saveHotkeys();
    render();
    return cloneHotkeys(state.hotkeys);
  }

  function init() {
    loadPersistedState();
    ensureRoot();
    render();

    window.addEventListener('keydown', onGlobalKeyDown);

    // Observe <html lang/dir/data-theme> flips for instant EN <-> AR RTL & Light/Dark parity
    if (typeof MutationObserver === 'function' && document.documentElement) {
      var langObserver = new MutationObserver(function () {
        render();
      });
      langObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
    }
  }

  window.ZoneHudAccessibility = {
    __booted: true,
    version: '155.0.0',
    init: init,
    open: function (tabId) {
      if (tabId) state.activeTab = String(tabId);
      state.open = true;
      if (!state.hudData) refreshEconomyState();
      render();
    },
    close: function () {
      state.open = false;
      state.listeningScreen = null;
      render();
    },
    toggle: function (tabId) {
      if (tabId && !state.open) state.activeTab = String(tabId);
      state.open = !state.open;
      if (state.open && !state.hudData) refreshEconomyState();
      render();
    },
    getPreferences: function () {
      return Object.assign({}, state.prefs);
    },
    setColorblindMode: setColorblindMode,
    setReducedMotion: setReducedMotion,
    setHighContrast: setHighContrast,
    getHotkeys: function () {
      return cloneHotkeys(state.hotkeys);
    },
    rebindHotkey: rebindHotkey,
    resetHotkeys: resetHotkeys,
    refreshEconomyState: refreshEconomyState,
    executeSink: executeSink,
    generateActionNonce: generateActionNonce,
    attachActionEnvelope: attachActionEnvelope
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

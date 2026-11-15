/* ==========================================================================
 * ZONE — AAA SYNDICATE COMMAND TOPBAR & OPERATIVE SIDEBAR RUNTIME (v125)
 * Exclusive Ownership: carbon-hud-chrome
 * Scope: .zone-topbar, [data-zheaderbar], .zone-theme-indicator, aside.zone-sidebar
 * Guardrails: Idempotent, React-18/<x-dc> fiber-safe (append-only + CSS order),
 *             zero network calls, zero console errors, 600ms telemetry sync.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaTopbarSidebarLoaded) return;
  window.__zoneAaaTopbarSidebarLoaded = true;

  var isSyncing = false;

  /* ------------------------------------------------------------------------
   * INLINE VECTOR ASSETS (Crisp Tactical Syndicate Iconography)
   * ------------------------------------------------------------------------ */
  var BRAND_CREST_SVG =
    '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaaGoldGrad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#FFFBEB"/>' +
          '<stop offset="45%" stop-color="#FBBF24"/>' +
          '<stop offset="100%" stop-color="#B4781E"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<polygon points="16,2 30,16 16,30 2,16" fill="#0B101B" stroke="url(#zaaaGoldGrad)" stroke-width="1.8"/>' +
      '<polygon points="16,6.2 25.8,16 16,25.8 6.2,16" fill="rgba(235,184,88,0.12)" stroke="url(#zaaaGoldGrad)" stroke-width="1" stroke-opacity="0.72"/>' +
      '<line x1="16" y1="2" x2="16" y2="9" stroke="#FBBF24" stroke-width="1.3" stroke-linecap="round"/>' +
      '<line x1="16" y1="23" x2="16" y2="30" stroke="#FBBF24" stroke-width="1.3" stroke-linecap="round"/>' +
      '<line x1="2" y1="16" x2="9" y2="16" stroke="#FBBF24" stroke-width="1.3" stroke-linecap="round"/>' +
      '<line x1="23" y1="16" x2="30" y2="16" stroke="#FBBF24" stroke-width="1.3" stroke-linecap="round"/>' +
      '<polygon points="16,11.2 20.8,16 16,20.8 11.2,16" fill="url(#zaaaGoldGrad)"/>' +
      '<circle cx="16" cy="16" r="1.8" fill="#090D16"/>' +
    '</svg>';

  var LINK_ICONS = {
    education:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 10 12 5 2 10l10 5 10-5z"/>' +
        '<path d="M6 12.5v4.5c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>' +
        '<path d="M22 10v5"/>' +
      '</svg>',
    newspaper:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
        '<path d="M14 2v6h6"/>' +
        '<path d="M8 13h8"/>' +
        '<path d="M8 17h5"/>' +
      '</svg>',
    faction:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
        '<path d="m9 12 2 2 4-4"/>' +
      '</svg>',
    account:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
        '<circle cx="9" cy="11" r="2"/>' +
        '<path d="M15 10h3"/>' +
        '<path d="M15 14h3"/>' +
        '<path d="M6.5 16c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8"/>' +
      '</svg>',
    hof:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>' +
        '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
        '<path d="M4 22h16"/>' +
        '<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>' +
        '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>' +
        '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' +
      '</svg>'
  };

  var HUD_ICONS = {
    cash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
        '<circle cx="12" cy="12" r="2.5"/>' +
        '<path d="M6 12h.01M18 12h.01"/>' +
      '</svg>',
    energy:
      '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>' +
      '</svg>',
    nerve:
      '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<path d="M12.5 2.2c.6 3.3 4.5 5.4 4.5 10.3a5.5 5.5 0 0 1-11 0c0-2.6 1.5-4.4 2.7-5.7-.2 1.8.8 2.9 1.9 3.4-.3-2.5-.6-5.1 1.9-8z"/>' +
      '</svg>',
    city:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 21h18"/>' +
        '<path d="M5 21V8l6-4v17"/>' +
        '<path d="M11 10h8v11"/>' +
        '<path d="M8 10v.01M8 14v.01M15 14v.01M15 17v.01"/>' +
      '</svg>'
  };

  var THEME_SVGS =
    '<svg class="zaaa-moon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' +
    '</svg>' +
    '<svg class="zaaa-sun-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4.2" fill="currentColor"/>' +
      '<path d="M12 2v2.4M12 19.6V22M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M2 12h2.4M19.6 12H22M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7"/>' +
    '</svg>';

  var OPERATIVE_AVATAR_SVG =
    '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="18" cy="18" r="15" stroke="rgba(235,184,88,0.32)" stroke-width="1.2" stroke-dasharray="3 2"/>' +
      '<path d="M8 31c1.2-5.4 5-8.2 10-8.2s8.8 2.8 10 8.2" fill="rgba(235,184,88,0.2)" stroke="#FBBF24" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M12.2 15.2c0-3.6 2.5-6.4 5.8-6.4s5.8 2.8 5.8 6.4c0 3.1-2.4 5.6-5.8 5.6s-5.8-2.5-5.8-5.6z" fill="#0F172A" stroke="#FBBF24" stroke-width="1.5"/>' +
      '<path d="M14.5 14.8h7" stroke="#39E7A3" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  var CITY_CATALOG = {
    zone: { code: 'ZCT', en: 'Zone City', ar: 'مدينة الزون' },
    'zone city': { code: 'ZCT', en: 'Zone City', ar: 'مدينة الزون' },
    riyadh: { code: 'RUH', en: 'Riyadh', ar: 'الرياض' },
    dubai: { code: 'DXB', en: 'Dubai', ar: 'دبي' },
    cairo: { code: 'CAI', en: 'Cairo', ar: 'القاهرة' },
    beirut: { code: 'BEY', en: 'Beirut', ar: 'بيروت' },
    istanbul: { code: 'IST', en: 'Istanbul', ar: 'إسطنبول' },
    tokyo: { code: 'TYO', en: 'Neo-Tokyo', ar: 'نيو طوكيو' },
    'neo-tokyo': { code: 'TYO', en: 'Neo-Tokyo', ar: 'نيو طوكيو' },
    montecarlo: { code: 'MCO', en: 'Monte Carlo', ar: 'مونت كارلو' },
    'monte carlo': { code: 'MCO', en: 'Monte Carlo', ar: 'مونت كارلو' },
    london: { code: 'LDN', en: 'London', ar: 'لندن' },
    uk: { code: 'LDN', en: 'London', ar: 'لندن' },
    canada: { code: 'YYZ', en: 'Canada', ar: 'كندا' },
    zurich: { code: 'ZRH', en: 'Zurich', ar: 'زيورخ' }
  };

  var EN_TITLES = ['Rookie', 'Petty Thief', 'Hustler', 'Enforcer', 'Capo', 'Underboss', 'Boss'];
  var AR_TITLES = ['مستجد', 'نشّال مبتدئ', 'محتال شوارع', 'منفّذ ميداني', 'كابو', 'نائب الزعيم', 'زعيم النقابة'];

  /* ------------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------------ */
  function isArabic() {
    var html = document.documentElement;
    return html.lang === 'ar' || html.dir === 'rtl';
  }

  function formatMoney(n) {
    var val = Math.max(0, Math.round(Number(n) || 0));
    return '$' + String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatInt(n) {
    var val = Math.max(0, Math.round(Number(n) || 0));
    return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function navigateToScreen(screenId) {
    try {
      if (window.__zoneGame && typeof window.__zoneGame.go === 'function') {
        window.__zoneGame.go(screenId);
        return;
      }
      var navBtn = document.querySelector('[data-znav] button[data-zone-screen="' + screenId + '"]');
      if (navBtn) navBtn.click();
    } catch (_) {}
  }

  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    return (main && main.getAttribute('data-zone-screen')) || 'home';
  }

  function setTextIfChanged(el, nextText) {
    if (!el) return;
    var str = String(nextText == null ? '' : nextText);
    if (el.textContent !== str) {
      el.textContent = str;
    }
  }

  /* ------------------------------------------------------------------------
   * 1. BRAND EMBLEM (.zone-brand)
   * ------------------------------------------------------------------------ */
  function syncBrand() {
    var brand = document.querySelector('.zone-topbar .zone-brand');
    if (!brand) return;

    var crest = brand.querySelector('.zaaa-brand-crest');
    if (!crest) {
      crest = document.createElement('span');
      crest.className = 'zaaa-brand-crest';
      crest.setAttribute('aria-hidden', 'true');
      crest.innerHTML = BRAND_CREST_SVG;
      brand.appendChild(crest);
    }

    var meta = brand.querySelector('.zaaa-brand-meta');
    if (!meta) {
      meta = document.createElement('span');
      meta.className = 'zaaa-brand-meta';
      meta.setAttribute('aria-hidden', 'true');
      brand.appendChild(meta);
    }
    setTextIfChanged(meta, isArabic() ? 'نقابة الجريمة' : 'SYNDICATE MMO');

    if (brand.getAttribute('data-zaaa-ready') !== '1') {
      brand.setAttribute('data-zaaa-ready', '1');
      brand.setAttribute('role', 'button');
      brand.setAttribute('tabindex', '0');
      brand.addEventListener('click', function () {
        navigateToScreen('home');
      });
      brand.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          navigateToScreen('home');
        }
      });
    }

    var nextTitle = isArabic() ? 'العودة إلى قاعدة العمليات' : 'Return to Syndicate HQ';
    if (brand.getAttribute('title') !== nextTitle) {
      brand.setAttribute('title', nextTitle);
    }
  }

  /* ------------------------------------------------------------------------
   * 2. INTEGRATED GAME COMMAND DOCK (.zone-header-links)
   * ------------------------------------------------------------------------ */
  function classifyHeaderLink(rawText, index) {
    var lower = String(rawText || '').trim().toLowerCase();
    if (/education|academy|course|wiki|تعليم|ويكي/.test(lower)) {
      return { key: 'education', screen: 'education' };
    }
    if (/character record|dossier|newspaper|record|rules|سجل|صحيفة|قوانين/.test(lower)) {
      return { key: 'newspaper', screen: 'newspaper' };
    }
    if (/faction|family|syndicate|forums|عائل|فاكشن|منتد/.test(lower)) {
      return { key: 'faction', screen: 'faction' };
    }
    if (/account|vault|discord|community|حساب|ديسكورد/.test(lower)) {
      return { key: 'account', screen: 'account' };
    }
    if (/hall of fame|hof|standings|staff|مشاهير|إدارة/.test(lower)) {
      return { key: 'hof', screen: 'hof' };
    }
    var fallbackByIndex = [
      { key: 'education', screen: 'education' },
      { key: 'newspaper', screen: 'newspaper' },
      { key: 'faction', screen: 'faction' },
      { key: 'account', screen: 'account' },
      { key: 'hof', screen: 'hof' }
    ];
    return fallbackByIndex[index] || { key: 'newspaper', screen: '' };
  }

  function findPrimaryTextNode(rootEl) {
    for (var i = 0; i < rootEl.childNodes.length; i++) {
      var node = rootEl.childNodes[i];
      if (node.nodeType === 3 && String(node.nodeValue || '').trim().length > 0) {
        return node;
      }
      if (node.nodeType === 1 && !node.classList.contains('zaaa-link-icon')) {
        var nested = findPrimaryTextNode(node);
        if (nested) return nested;
      }
    }
    return null;
  }

  function syncHeaderLinks() {
    var linksWrap = document.querySelector('.zone-topbar .zone-header-links');
    if (!linksWrap) return;

    var activeScreen = getActiveScreen();
    var ar = isArabic();
    var buttons = linksWrap.querySelectorAll('.zone-header-link');

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var textNode = findPrimaryTextNode(btn);
      var rawLabel = textNode ? textNode.nodeValue : btn.textContent;

      // Shorten verbose English "Your character record" -> "Dossier" ONLY when lang === 'en'
      if (!ar && textNode && /^\s*your character record\s*$/i.test(textNode.nodeValue || '')) {
        textNode.nodeValue = 'Dossier';
        rawLabel = 'Dossier';
      }

      var meta = classifyHeaderLink(rawLabel, i);

      var iconEl = btn.querySelector('.zaaa-link-icon');
      if (!iconEl) {
        iconEl = document.createElement('span');
        iconEl.className = 'zaaa-link-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.innerHTML = LINK_ICONS[meta.key] || LINK_ICONS.newspaper;
        btn.appendChild(iconEl);
      } else if (iconEl.getAttribute('data-ico') !== meta.key) {
        iconEl.innerHTML = LINK_ICONS[meta.key] || LINK_ICONS.newspaper;
      }
      iconEl.setAttribute('data-ico', meta.key);

      var isActive = Boolean(meta.screen && meta.screen === activeScreen);
      if (isActive) {
        if (btn.getAttribute('data-zaaa-active') !== 'true') {
          btn.setAttribute('data-zaaa-active', 'true');
        }
      } else if (btn.hasAttribute('data-zaaa-active')) {
        btn.removeAttribute('data-zaaa-active');
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 3. CENTER-RIGHT LIVE SYNDICATE HUD STRIP (#zone-topbar-hud)
   * ------------------------------------------------------------------------ */
  function readBarTelemetry(barId, fallbackMax) {
    try {
      var g = window.__zoneGame;
      if (g && typeof g.cur === 'function' && typeof g.maxOf === 'function') {
        var curVal = Math.max(0, Math.round(Number(g.cur(barId)) || 0));
        var maxVal = Math.max(1, Math.round(Number(g.maxOf(barId)) || fallbackMax));
        return {
          cur: curVal,
          max: maxVal,
          pct: Math.max(0, Math.min(100, Math.round((curVal / maxVal) * 100)))
        };
      }
    } catch (_) {}

    var track = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="' + barId + '"] .zone-resource-track'
    );
    if (track) {
      var nowAttr = Number(track.getAttribute('aria-valuenow'));
      var maxAttr = Number(track.getAttribute('aria-valuemax'));
      if (Number.isFinite(nowAttr) && Number.isFinite(maxAttr) && maxAttr > 0) {
        return {
          cur: Math.max(0, Math.round(nowAttr)),
          max: Math.max(1, Math.round(maxAttr)),
          pct: Math.max(0, Math.min(100, Math.round((nowAttr / maxAttr) * 100)))
        };
      }
    }

    var fig = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="' + barId + '"] [data-zfig]'
    );
    if (fig && fig.textContent) {
      var m = fig.textContent.replace(/,/g, '').match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        var c = Number(m[1]) || 0;
        var mx = Math.max(1, Number(m[2]) || fallbackMax);
        return {
          cur: c,
          max: mx,
          pct: Math.max(0, Math.min(100, Math.round((c / mx) * 100)))
        };
      }
    }

    return { cur: fallbackMax, max: fallbackMax, pct: 100 };
  }

  function readCashTelemetry() {
    try {
      if (window.__zoneGame && window.__zoneGame.p && Number.isFinite(Number(window.__zoneGame.p.cash))) {
        return formatMoney(window.__zoneGame.p.cash);
      }
    } catch (_) {}
    var cashEl = document.getElementById('zone-cash');
    if (cashEl && cashEl.textContent && cashEl.textContent.trim()) {
      var raw = cashEl.textContent.trim();
      return raw.indexOf('$') >= 0 ? raw : '$' + raw;
    }
    return '$0';
  }

  function readCityTelemetry() {
    var rawCity = '';
    try {
      rawCity = localStorage.getItem('zone_world_city') || '';
    } catch (_) {}
    try {
      var g = window.__zoneGame;
      if (!rawCity && g && g.p) {
        rawCity = g.p.worldCityId || (g.p.travel && g.p.travel.destination) || g.p.city || '';
      }
    } catch (_) {}

    var norm = String(rawCity || 'zone').trim().toLowerCase();
    var entry = CITY_CATALOG[norm];
    if (entry) {
      return {
        code: entry.code,
        name: isArabic() ? entry.ar : entry.en
      };
    }
    if (rawCity && String(rawCity).trim()) {
      var clean = String(rawCity).trim();
      return {
        code: clean.slice(0, 3).toUpperCase(),
        name: clean
      };
    }
    return {
      code: 'ZCT',
      name: isArabic() ? 'مدينة الزون' : 'Zone City'
    };
  }

  function ensureTopbarHud() {
    var headerBar = document.querySelector('.zone-topbar [data-zheaderbar]');
    if (!headerBar) return null;

    var hud = document.getElementById('zone-topbar-hud');
    if (hud && hud.parentElement === headerBar) return hud;
    if (hud && hud.parentElement) hud.parentElement.removeChild(hud);

    hud = document.createElement('div');
    hud.id = 'zone-topbar-hud';
    hud.setAttribute('role', 'region');
    hud.setAttribute('aria-label', 'Syndicate Live Telemetry');

    hud.innerHTML =
      '<button type="button" class="zaaa-hud-pill zaaa-hud-cash" data-hud="cash">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + HUD_ICONS.cash + '</span>' +
        '<bdi class="zaaa-hud-val">$0</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-energy" data-hud="energy">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + HUD_ICONS.energy + '</span>' +
        '<bdi class="zaaa-hud-val">100/100</bdi>' +
        '<span class="zaaa-hud-rail" aria-hidden="true"><i></i></span>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-nerve" data-hud="nerve">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + HUD_ICONS.nerve + '</span>' +
        '<bdi class="zaaa-hud-val">15/15</bdi>' +
        '<span class="zaaa-hud-rail" aria-hidden="true"><i></i></span>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-city" data-hud="city">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + HUD_ICONS.city + '</span>' +
        '<span class="zaaa-hud-city-code">ZCT</span>' +
        '<span class="zaaa-hud-val">Zone City</span>' +
      '</button>';

    var routeMap = {
      cash: 'bank',
      energy: 'gym',
      nerve: 'crimes',
      city: 'city'
    };

    var pills = hud.querySelectorAll('.zaaa-hud-pill');
    for (var i = 0; i < pills.length; i++) {
      (function (pill) {
        var kind = pill.getAttribute('data-hud');
        pill.addEventListener('click', function () {
          navigateToScreen(routeMap[kind] || 'city');
        });
      })(pills[i]);
    }

    // Append at end of [data-zheaderbar]; CSS order:3 positions it before .zone-header-actions
    // while keeping React's 3 static children untouched at indices 0, 1, 2.
    headerBar.appendChild(hud);
    return hud;
  }

  function syncTopbarHud() {
    var hud = ensureTopbarHud();
    if (!hud) return;

    var ar = isArabic();
    var cashStr = readCashTelemetry();
    var energy = readBarTelemetry('energy', 100);
    var nerve = readBarTelemetry('nerve', 15);
    var city = readCityTelemetry();

    var cashPill = hud.querySelector('[data-hud="cash"]');
    if (cashPill) {
      setTextIfChanged(cashPill.querySelector('.zaaa-hud-val'), cashStr);
      cashPill.title = ar ? 'النقد المتاح · افتح الخزنة' : 'Liquid Cash · Open Bank Vault';
    }

    var energyPill = hud.querySelector('[data-hud="energy"]');
    if (energyPill) {
      setTextIfChanged(energyPill.querySelector('.zaaa-hud-val'), energy.cur + '/' + energy.max);
      energyPill.style.setProperty('--zaaa-pct', energy.pct + '%');
      energyPill.title = ar ? 'الطاقة القتالية · افتح النادي' : 'Energy · Open Gym';
    }

    var nervePill = hud.querySelector('[data-hud="nerve"]');
    if (nervePill) {
      setTextIfChanged(nervePill.querySelector('.zaaa-hud-val'), nerve.cur + '/' + nerve.max);
      nervePill.style.setProperty('--zaaa-pct', nerve.pct + '%');
      nervePill.title = ar ? 'الجرأة الميدانية · افتح الجرائم' : 'Nerve · Open Street Crimes';
    }

    var cityPill = hud.querySelector('[data-hud="city"]');
    if (cityPill) {
      setTextIfChanged(cityPill.querySelector('.zaaa-hud-city-code'), city.code);
      setTextIfChanged(cityPill.querySelector('.zaaa-hud-val'), city.name);
      cityPill.title = ar ? 'الموقع الحالي · انتقل إلى خريطة المدينة' : 'Active Sector · Open City Map';
    }
  }

  /* ------------------------------------------------------------------------
   * 4. THEME INDICATOR (.zone-theme-indicator) — Moon / Sunburst SVG
   * ------------------------------------------------------------------------ */
  function syncThemeIndicator() {
    var ind = document.querySelector('.zone-topbar .zone-header-actions .zone-theme-indicator');
    if (!ind) return;
    if (!ind.querySelector('.zaaa-theme-svg')) {
      var wrap = document.createElement('span');
      wrap.className = 'zaaa-theme-svg';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = THEME_SVGS;
      ind.appendChild(wrap);
    }
  }

  /* ------------------------------------------------------------------------
   * 5. OPERATIVE SYNDICATE DOSSIER HEADER (#zone-operative-crest)
   * ------------------------------------------------------------------------ */
  function readOperativeTelemetry() {
    var ar = isArabic();
    var level = 1;
    var xp = 40;
    var nextXp = 100;
    var rankTitle = '';
    var playerId = '1042';

    try {
      var g = window.__zoneGame;
      var lv = window.__zoneLastView;
      if (g && g.p) {
        level = Math.max(1, Math.round(Number(g.p.level) || 1));
        xp = Math.max(0, Math.round(Number(g.p.xp) || 0));
        nextXp = g.serverPlayer ? 50 * level * (level + 1) : Math.max(100, level * 100);
        if (g.p.numericId) playerId = String(g.p.numericId);
      }
      if (lv) {
        if (Number.isFinite(Number(lv.level)) && Number(lv.level) > 0) {
          level = Math.round(Number(lv.level));
        }
        if (lv.levelTitle) rankTitle = String(lv.levelTitle);
        if (lv.omar && lv.omar.playerId) playerId = String(lv.omar.playerId);
      }
    } catch (_) {}

    if (!rankTitle) {
      var idx = Math.min(6, Math.max(0, Math.floor(level / 8)));
      rankTitle = (ar ? AR_TITLES : EN_TITLES)[idx];
    }

    var pct = nextXp > 0 ? Math.max(8, Math.min(100, Math.round((xp / nextXp) * 100))) : 42;
    return {
      level: level,
      xp: xp,
      nextXp: nextXp,
      xpPct: pct,
      rankTitle: rankTitle,
      playerId: playerId
    };
  }

  function syncOperativeCrest() {
    var profileBody = document.querySelector('aside.zone-sidebar .zone-profile-body');
    if (!profileBody) return;

    var crest = document.getElementById('zone-operative-crest');
    if (crest && crest.parentElement !== profileBody) {
      if (crest.parentElement) crest.parentElement.removeChild(crest);
      crest = null;
    }

    if (!crest) {
      crest = document.createElement('div');
      crest.id = 'zone-operative-crest';
      crest.setAttribute('role', 'button');
      crest.setAttribute('tabindex', '0');
      crest.innerHTML =
        '<div class="zaaa-op-avatar" aria-hidden="true">' +
          OPERATIVE_AVATAR_SVG +
          '<bdi class="zaaa-op-lvl">LV.1</bdi>' +
        '</div>' +
        '<div class="zaaa-op-info">' +
          '<div class="zaaa-op-top">' +
            '<span class="zaaa-op-rank">Rookie</span>' +
            '<bdi class="zaaa-op-id">#1042</bdi>' +
          '</div>' +
          '<div class="zaaa-op-xp-meta">' +
            '<span class="zaaa-op-xp-lbl">SYNDICATE XP</span>' +
            '<bdi class="zaaa-op-xp-val">40 / 100</bdi>' +
          '</div>' +
          '<div class="zaaa-op-xp-track" aria-hidden="true">' +
            '<div class="zaaa-op-xp-fill"></div>' +
          '</div>' +
        '</div>';

      var openDossier = function () {
        try {
          if (
            window.__zoneLastView &&
            window.__zoneLastView.omar &&
            typeof window.__zoneLastView.omar.openOwnProfile === 'function'
          ) {
            window.__zoneLastView.omar.openOwnProfile();
            return;
          }
        } catch (_) {}
        navigateToScreen('home');
      };

      crest.addEventListener('click', openDossier);
      crest.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openDossier();
        }
      });

      // Append to end of .zone-profile-body; CSS order:-10 renders it at top
      // while leaving all React child node indices untouched.
      profileBody.appendChild(crest);
    }

    var ar = isArabic();
    var op = readOperativeTelemetry();
    setTextIfChanged(crest.querySelector('.zaaa-op-lvl'), (ar ? 'م.' : 'LV.') + op.level);
    setTextIfChanged(crest.querySelector('.zaaa-op-rank'), op.rankTitle);
    setTextIfChanged(crest.querySelector('.zaaa-op-id'), '#' + op.playerId);
    setTextIfChanged(crest.querySelector('.zaaa-op-xp-lbl'), ar ? 'خبرة النقابة' : 'SYNDICATE XP');
    setTextIfChanged(
      crest.querySelector('.zaaa-op-xp-val'),
      formatInt(op.xp) + ' / ' + formatInt(op.nextXp)
    );
    crest.style.setProperty('--zaaa-xp-pct', op.xpPct + '%');
    crest.title = ar ? 'فتح ملف العميل الشخصي' : 'Open Operative Dossier';
  }

  /* ------------------------------------------------------------------------
   * MASTER SYNC ORCHESTRATION (zone:render + html attr observer + 600ms poll)
   * ------------------------------------------------------------------------ */
  function syncAll() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      syncBrand();
      syncHeaderLinks();
      syncTopbarHud();
      syncThemeIndicator();
      syncOperativeCrest();
    } catch (_) {
      // Never emit console errors
    } finally {
      isSyncing = false;
    }
  }

  function boot() {
    syncAll();

    window.addEventListener('zone:render', syncAll);

    try {
      var htmlObs = new MutationObserver(function () {
        syncAll();
      });
      htmlObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
    } catch (_) {}

    window.setInterval(syncAll, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

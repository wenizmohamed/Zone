/* ==========================================================================
 * ZONE v137 - HAND-DRAWN INK & WATERCOLOR SKETCHBOOK RUNTIME (LIGHT + DARK)
 * Keeps 100% identical Hand-Drawn Sketchbook UI/UX in BOTH Light & Dark modes:
 *   1) Hand-inked + offset watercolor/gouache wash SVG icons (Areas, Quick, Legend)
 *      with automatic CSS-variable stroke adaptation (dark ink <-> warm chalk ink)
 *   2) Crosshatched "Current Mission:" strip & "City Tutorial" / District Guide box
 *   3) Interactive Hand-Painted Watercolor Zone City Panorama + Decluttered
 *      6 Primary / 12 Hover Teardrop Pins + Persistent 1-click 3D Block Map Bar
 *   4) Exact 6 Hand-Painted Watercolor Teardrop Pins in "Key of Symbols"
 *   5) Swaps Arcade cards to cohesive pen-and-ink watercolor illustrations
 *   6) Syncs Light/Dark Sketchbook theme across /, /account, and /admin
 * Fiber-safe: never mutates <x-dc> before hydration or removes React nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneWatercolorSketchbookLoaded) return;
  window.__zoneWatercolorSketchbookLoaded = true;

  var THEME_STORAGE_KEY = 'zone.sketch.theme';

  function isAr() {
    var d = document.documentElement;
    return (d && (d.lang === 'ar' || d.dir === 'rtl')) || false;
  }

  function safeGetStoredTheme() {
    try {
      var explicit = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (explicit === 'light' || explicit === 'dark') return explicit;
      var rawSave = window.localStorage.getItem('zone.v2.save');
      if (rawSave) {
        var parsed = JSON.parse(rawSave);
        if (parsed && (parsed.theme === 'light' || parsed.theme === 'dark')) {
          return parsed.theme;
        }
      }
    } catch (_) {}
    return '';
  }

  function safeStoreTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    var stored = safeGetStoredTheme();
    return stored === 'light' ? 'light' : 'dark';
  }

  /* Strip any legacy noir mode attribute so Sketchbook UI stays active in BOTH modes */
  if (document.documentElement && document.documentElement.hasAttribute('data-sketch-mode')) {
    document.documentElement.removeAttribute('data-sketch-mode');
  }

  /* Pre-seed data-theme on auxiliary pages (/account, /admin) before first paint */
  if (document.documentElement && !document.documentElement.getAttribute('data-theme')) {
    document.documentElement.setAttribute('data-theme', safeGetStoredTheme() || 'dark');
  }

  /* Hand-Drawn Fountain-Pen Teardrop Pin SVG (matches Key of Symbols & Map Pins) */
  function teardropPinSvg(washHex, glyphPath) {
    return (
      '<svg class="zwc-pin-svg" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        /* Offset organic watercolor bleed */
        '<path class="zwc-pin-wash" d="M15.2 3.2C20.8 3.2 24.8 7.6 24.6 13.4C24.4 19.8 16.4 29.4 14.8 32.8C13.1 29.5 5.4 19.9 5.3 13.4C5.2 7.6 9.5 3.2 15.2 3.2Z" fill="' + washHex + '" fill-opacity="0.9"/>' +
        '<ellipse cx="12.2" cy="11.2" rx="4.2" ry="5.2" fill="#ffffff" fill-opacity="0.28" transform="rotate(-18 12.2 11.2)"/>' +
        /* Hand-inked fountain-pen / chalk outline */
        '<path class="zwc-pin-outline" d="M14 2.4C19.7 2.2 24.1 6.8 23.9 12.8C23.7 19.4 15.7 29.1 14 33.2C12.3 29.1 4.3 19.4 4.1 12.8C3.9 6.8 8.3 2.6 14 2.4Z" stroke="var(--zwc-pin-stroke, #1e1b18)" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
        (glyphPath
          ? '<path d="' + glyphPath + '" stroke="#fcf9f2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<circle cx="14" cy="12.5" r="3.1" fill="#fcf9f2" fill-opacity="0.88" stroke="#1e1b18" stroke-width="1.3"/>') +
      '</svg>'
    );
  }

  /* Sovereign Architectural Metallic Vector Emblems (v169 - Global Defs + Zero Cartoon Crayon Blobs) */
  var ZWC_METALLIC_DEFS =
    '<defs>' +
      '<linearGradient id="zwm-gold" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fef08a"/><stop offset="48%" stop-color="#f3c969"/><stop offset="100%" stop-color="#a16207"/>' +
      '</linearGradient>' +
      '<linearGradient id="zwm-emerald" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#6ee7b7"/><stop offset="50%" stop-color="#10b981"/><stop offset="100%" stop-color="#065f46"/>' +
      '</linearGradient>' +
      '<linearGradient id="zwm-ruby" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fda4af"/><stop offset="50%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#881337"/>' +
      '</linearGradient>' +
      '<linearGradient id="zwm-cyan" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#a5f3fc"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/>' +
      '</linearGradient>' +
      '<linearGradient id="zwm-steel" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#f8fafc"/><stop offset="52%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#475569"/>' +
      '</linearGradient>' +
      '<linearGradient id="zwm-plate" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#2a2520"/><stop offset="100%" stop-color="#110f0d"/>' +
      '</linearGradient>' +
    '</defs>';

  function ensureGlobalMetallicDefs() {
    if (!document.body || document.getElementById('zwc-global-metallic-defs')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<svg id="zwc-global-metallic-defs" width="0" height="0" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;pointer-events:none">' +
        ZWC_METALLIC_DEFS +
      '</svg>';
    if (wrap.firstElementChild) {
      document.body.appendChild(wrap.firstElementChild);
    }
  }

  function sovereignCrestSvg(gradUrl, fillOverlay, strokeMarkup) {
    return (
      '<svg class="zwc-sketch-ico" data-zwc-color="v169" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<polygon points="12,1.6 21,6.4 21,17.6 12,22.4 3,17.6 3,6.4" fill="url(#zwm-plate)" stroke="' + gradUrl + '" stroke-width="1.35" stroke-opacity="0.92"/>' +
        fillOverlay +
        strokeMarkup +
      '</svg>'
    );
  }

  var SKETCH_AREA_ICONS = {
    home: sovereignCrestSvg('url(#zwm-gold)', '<path d="M6.4 11.2L12 6.2L17.6 11.2V17.4H6.4V11.2Z" fill="url(#zwm-gold)" fill-opacity="0.22"/>', '<path d="M5.4 11.4L12 5.6L18.6 11.4M6.8 10.6V17.4H17.2V10.6M10.4 17.4V13.4H13.6V17.4" stroke="url(#zwm-gold)" stroke-width="1.5"/>'),
    items: sovereignCrestSvg('url(#zwm-gold)', '<polygon points="12,5.6 17.8,8.6 17.8,15.4 12,18.4 6.2,15.4 6.2,8.6" fill="url(#zwm-gold)" fill-opacity="0.22"/>', '<polygon points="12,5.6 17.8,8.6 17.8,15.4 12,18.4 6.2,15.4 6.2,8.6" stroke="url(#zwm-gold)" stroke-width="1.45"/><path d="M6.2,8.6L12,11.8L17.8,8.6M12,11.8V18.4" stroke="url(#zwm-steel)" stroke-width="1.35"/>'),
    city: sovereignCrestSvg('url(#zwm-cyan)', '<path d="M6.4 17.2V9.6L10 7.8V17.2H6.4ZM10 17.2V6L14.4 7.6V17.2H10ZM14.4 17.2V10.8L17.6 12V17.2H14.4Z" fill="url(#zwm-cyan)" fill-opacity="0.25"/>', '<path d="M5.6 17.2H18.4M6.6 17.2V9.6L10 7.8V17.2M10 6L14.4 7.6V17.2M14.4 10.8L17.6 12V17.2" stroke="url(#zwm-cyan)" stroke-width="1.45"/>'),
    jobs: sovereignCrestSvg('url(#zwm-gold)', '<rect x="6.2" y="8.4" width="11.6" height="8.6" rx="1.4" fill="url(#zwm-gold)" fill-opacity="0.22"/>', '<rect x="6.2" y="8.4" width="11.6" height="8.6" rx="1.4" stroke="url(#zwm-gold)" stroke-width="1.45"/><path d="M9.5 8.4V6.8C9.5 6.1 10 5.6 10.7 5.6H13.3C14 5.6 14.5 6.1 14.5 6.8V8.4M6.2 12.4H17.8" stroke="url(#zwm-steel)" stroke-width="1.35"/>'),
    bank: sovereignCrestSvg('url(#zwm-emerald)', '<path d="M5.8 9.8L12 5.8L18.2 9.8H5.8Z" fill="url(#zwm-gold)" fill-opacity="0.32"/>', '<path d="M5.8 9.8L12 5.8L18.2 9.8H5.8ZM7.6 9.8V16.2M10.6 9.8V16.2M13.4 9.8V16.2M16.4 9.8V16.2M5.8 16.4H18.2" stroke="url(#zwm-emerald)" stroke-width="1.45"/>'),
    gym: sovereignCrestSvg('url(#zwm-emerald)', '<rect x="6.2" y="8.2" width="2.5" height="7.6" rx="0.8" fill="url(#zwm-emerald)"/><rect x="15.3" y="8.2" width="2.5" height="7.6" rx="0.8" fill="url(#zwm-emerald)"/>', '<path d="M4.8 12H19.2M6.2 8.2H8.7V15.8H6.2V8.2ZM15.3 8.2H17.8V15.8H15.3V8.2Z" stroke="url(#zwm-emerald)" stroke-width="1.45"/>'),
    properties: sovereignCrestSvg('url(#zwm-gold)', '<path d="M6.8 17.2V6.6L13.2 5V17.2H6.8ZM13.2 10.4L17.2 11.6V17.2H13.2V10.4Z" fill="url(#zwm-emerald)" fill-opacity="0.24"/>', '<path d="M5.8 17.2H18.2M6.8 17.2V6.6L13.2 5V17.2M13.2 10.4L17.2 11.6V17.2" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    education: sovereignCrestSvg('url(#zwm-cyan)', '<circle cx="12" cy="11.6" r="4.8" fill="url(#zwm-cyan)" fill-opacity="0.22"/>', '<circle cx="12" cy="11.6" r="4.8" stroke="url(#zwm-gold)" stroke-width="1.4"/><ellipse cx="12" cy="11.6" rx="2.1" ry="4.8" stroke="url(#zwm-cyan)" stroke-width="1.25"/><path d="M7.2 11.6H16.8M9.4 17.4H14.6" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    crimes: sovereignCrestSvg('url(#zwm-ruby)', '<circle cx="12" cy="12" r="5.2" fill="url(#zwm-ruby)" fill-opacity="0.24"/>', '<circle cx="12" cy="12" r="5.2" stroke="url(#zwm-ruby)" stroke-width="1.45"/><circle cx="12" cy="12" r="1.7" fill="url(#zwm-gold)"/><path d="M12 5V7.4M12 16.6V19M5 12H7.4M16.6 12H19" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    missions: sovereignCrestSvg('url(#zwm-gold)', '<rect x="7" y="6" width="10" height="12" rx="1.4" fill="url(#zwm-gold)" fill-opacity="0.22"/>', '<rect x="7" y="6" width="10" height="12" rx="1.4" stroke="url(#zwm-gold)" stroke-width="1.45"/><path d="M9.4 11.8L11.2 13.6L14.8 9.8M9.4 15.2H14.6" stroke="url(#zwm-emerald)" stroke-width="1.5"/>'),
    newspaper: sovereignCrestSvg('url(#zwm-steel)', '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="1.3" fill="url(#zwm-steel)" fill-opacity="0.18"/>', '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="1.3" stroke="url(#zwm-gold)" stroke-width="1.4"/><path d="M8.8 9.4H15.2M8.8 12.2H15.2M8.8 14.8H12.4" stroke="url(#zwm-steel)" stroke-width="1.4"/>'),
    jail: sovereignCrestSvg('url(#zwm-steel)', '<rect x="6.6" y="6.4" width="10.8" height="11.2" rx="1.2" fill="url(#zwm-steel)" fill-opacity="0.18"/>', '<rect x="6.6" y="6.4" width="10.8" height="11.2" rx="1.2" stroke="url(#zwm-steel)" stroke-width="1.4"/><path d="M9.6 6.4V17.6M12 6.4V17.6M14.4 6.4V17.6M6.6 11.8H17.4" stroke="url(#zwm-gold)" stroke-width="1.35"/>'),
    hospital: sovereignCrestSvg('url(#zwm-ruby)', '<polygon points="12,5.6 17.4,8.2 17.4,13.6 12,18.2 6.6,13.6 6.6,8.2" fill="url(#zwm-ruby)" fill-opacity="0.24"/>', '<polygon points="12,5.6 17.4,8.2 17.4,13.6 12,18.2 6.6,13.6 6.6,8.2" stroke="url(#zwm-emerald)" stroke-width="1.4"/><path d="M12 9V14.8M9.1 11.9H14.9" stroke="url(#zwm-ruby)" stroke-width="1.85"/>'),
    casino: sovereignCrestSvg('url(#zwm-gold)', '<circle cx="12" cy="12" r="5.4" fill="url(#zwm-ruby)" fill-opacity="0.28"/>', '<circle cx="12" cy="12" r="5.4" stroke="url(#zwm-gold)" stroke-width="1.45"/><polygon points="12,8.4 15,12 12,15.6 9,12" fill="url(#zwm-gold)"/>'),
    hof: sovereignCrestSvg('url(#zwm-gold)', '<path d="M8.2 6.4H15.8V10.2C15.8 12.5 14.1 14.2 12 14.2C9.9 14.2 8.2 12.5 8.2 10.2V6.4Z" fill="url(#zwm-gold)" fill-opacity="0.32"/>', '<path d="M8.2 6.4H15.8V10.2C15.8 12.5 14.1 14.2 12 14.2C9.9 14.2 8.2 12.5 8.2 10.2V6.4ZM12 14.2V17.4M9.4 17.6H14.6" stroke="url(#zwm-gold)" stroke-width="1.5"/>'),
    faction: sovereignCrestSvg('url(#zwm-gold)', '<path d="M12 5.4L17.4 7.8V12.2C17.4 15.5 15.1 17.8 12 19C8.9 17.8 6.6 15.5 6.6 12.2V7.8L12 5.4Z" fill="url(#zwm-gold)" fill-opacity="0.24"/>', '<path d="M12 5.4L17.4 7.8V12.2C17.4 15.5 15.1 17.8 12 19C8.9 17.8 6.6 15.5 6.6 12.2V7.8L12 5.4ZM9.4 13.4L10.2 10L12 11.8L13.8 10L14.6 13.4H9.4Z" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    elimination: sovereignCrestSvg('url(#zwm-ruby)', '<circle cx="12" cy="12" r="5.2" fill="url(#zwm-ruby)" fill-opacity="0.26"/>', '<circle cx="12" cy="12" r="5.2" stroke="url(#zwm-ruby)" stroke-width="1.45"/><path d="M9.4 9.4L14.6 14.6M14.6 9.4L9.4 14.6" stroke="url(#zwm-gold)" stroke-width="1.5"/>'),
    attack: sovereignCrestSvg('url(#zwm-ruby)', '<polygon points="12,5.4 18.6,12 12,18.6 5.4,12" fill="url(#zwm-ruby)" fill-opacity="0.26"/>', '<path d="M7.4 16.6L16.6 7.4M13.6 7.4H16.6V10.4M16.6 16.6L7.4 7.4M10.4 7.4H7.4V10.4" stroke="url(#zwm-gold)" stroke-width="1.5"/>'),
    market: sovereignCrestSvg('url(#zwm-gold)', '<path d="M6.6 9.6L8 6.4H16L17.4 9.6V17H6.6V9.6Z" fill="url(#zwm-gold)" fill-opacity="0.22"/>', '<path d="M6.6 9.6L8 6.4H16L17.4 9.6M7 9.6V17H17V9.6M10.4 17V13.4H13.6V17" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    account: sovereignCrestSvg('url(#zwm-gold)', '<circle cx="12" cy="9.2" r="2.8" fill="url(#zwm-gold)"/><path d="M7 17.2C8 14.4 9.7 13.2 12 13.2C14.3 13.2 16 14.4 17 17.2H7Z" fill="url(#zwm-steel)" fill-opacity="0.4"/>', '<circle cx="12" cy="9.2" r="2.8" stroke="url(#zwm-gold)" stroke-width="1.2"/><path d="M7 17.2C8 14.4 9.7 13.2 12 13.2C14.3 13.2 16 14.4 17 17.2" stroke="url(#zwm-gold)" stroke-width="1.35"/>')
  };

  /* 18 Precision Sovereign Faculty, Item & Career Medallions (Every Single Course Unique!) */
  var SKETCH_ITEM_ICONS = {
    rifle: sovereignCrestSvg('url(#zwm-gold)', '<path d="M5.4 11H16.2L17.6 13H13.4L12.6 16H10.4L11 13H7.4L5.8 15.4H4.6L5.4 11Z" fill="url(#zwm-gold)" fill-opacity="0.32"/>', '<path d="M4.8 11H19.2M15.4 11L17 13.2H13.4L12.6 16.4H10.4L11 13.2H7.2L5.6 15.6M9.2 9H13.4V11" stroke="url(#zwm-steel)" stroke-width="1.4"/>'),
    shotgun: sovereignCrestSvg('url(#zwm-ruby)', '<rect x="5" y="10.8" width="13.6" height="2.4" rx="0.8" fill="url(#zwm-ruby)" fill-opacity="0.32"/>', '<path d="M4.6 11H19.4M14.8 10H19.2V12.2H14.8M5 11V13.4H8.2L6.6 16H9.8L11.4 13.4H15.6" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    pistol: sovereignCrestSvg('url(#zwm-steel)', '<path d="M6.2 9.2H17.8V12.2H12.2L11 16.8H8L9.4 12.2H6.2V9.2Z" fill="url(#zwm-steel)" fill-opacity="0.3"/>', '<path d="M6.2 9.2H17.8V12.2H12.2L11 16.8H8L9.4 12.2H6.2V9.2Z" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    melee: sovereignCrestSvg('url(#zwm-ruby)', '<polygon points="17.6,6.4 18.4,7.2 10.6,15 9.2,13.6" fill="url(#zwm-steel)"/>', '<path d="M18 6L10.2 13.8M8.6 12.2L12.8 16.4M9.6 14.4L6.6 17.4" stroke="url(#zwm-gold)" stroke-width="1.5"/>'),
    medical: sovereignCrestSvg('url(#zwm-emerald)', '<rect x="6.4" y="7.6" width="11.2" height="9.6" rx="1.6" fill="url(#zwm-emerald)" fill-opacity="0.22"/>', '<rect x="6.4" y="7.6" width="11.2" height="9.6" rx="1.6" stroke="url(#zwm-emerald)" stroke-width="1.4"/><path d="M12 9.8V15M9.4 12.4H14.6" stroke="url(#zwm-ruby)" stroke-width="1.8"/>'),
    armor: sovereignCrestSvg('url(#zwm-steel)', '<path d="M12 5.4L17.6 7.8V12.2C17.6 15.6 15.2 18 12 19.2C8.8 18 6.4 15.6 6.4 12.2V7.8L12 5.4Z" fill="url(#zwm-steel)" fill-opacity="0.28"/>', '<path d="M12 5.4L17.6 7.8V12.2C17.6 15.6 15.2 18 12 19.2C8.8 18 6.4 15.6 6.4 12.2V7.8L12 5.4ZM12 8.2V16.2" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    booster: sovereignCrestSvg('url(#zwm-emerald)', '<path d="M10 6.2H14V9.4L16.8 15.2C17.2 16.2 16.5 17.6 15.2 17.6H8.8C7.5 17.6 6.8 16.2 7.2 15.2L10 9.4V6.2Z" fill="url(#zwm-emerald)" fill-opacity="0.28"/>', '<path d="M9.4 6.2H14.6M10.2 6.2V9.4L7.2 15.2C6.8 16.2 7.5 17.6 8.8 17.6H15.2C16.5 17.6 17.2 16.2 16.8 15.2L13.8 9.4V6.2M8.4 14H15.6" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    biology: sovereignCrestSvg('url(#zwm-emerald)', '<path d="M9 6.2C9 9.8 15 9.8 15 13.4C15 15.8 12 17.6 9 17.6" fill="none"/>', '<path d="M8.8 6C8.8 10 15.2 10 15.2 14C15.2 16.4 13.2 18 10.6 18M15.2 6C15.2 10 8.8 10 8.8 14C8.8 16.4 10.8 18 13.4 18" stroke="url(#zwm-cyan)" stroke-width="1.5"/><path d="M9.4 8.2H14.6M9.6 12H14.4M9.4 15.8H14.6" stroke="url(#zwm-gold)" stroke-width="1.25"/>'),
    sports: sovereignCrestSvg('url(#zwm-emerald)', '<circle cx="12" cy="12" r="5.2" fill="url(#zwm-emerald)" fill-opacity="0.18"/>', '<path d="M5.4 12H18.6M7.2 8.4V15.6M9.4 9.6V14.4M14.6 9.6V14.4M16.8 8.4V15.6" stroke="url(#zwm-emerald)" stroke-width="1.55"/><circle cx="12" cy="12" r="2.2" stroke="url(#zwm-gold)" stroke-width="1.25"/>'),
    law: sovereignCrestSvg('url(#zwm-gold)', '<polygon points="12,5.6 17,8.4 7,8.4" fill="url(#zwm-gold)" fill-opacity="0.28"/>', '<path d="M12 5.8V17.4M7.2 8.6H16.8M9.2 17.4H14.8M7.4 8.6L5.8 12.6H9L7.4 8.6ZM16.6 8.6L15 12.6H18.2L16.6 8.6Z" stroke="url(#zwm-gold)" stroke-width="1.35"/>'),
    business: sovereignCrestSvg('url(#zwm-gold)', '<rect x="6.8" y="12.6" width="2.6" height="4.8" fill="url(#zwm-emerald)"/><rect x="10.7" y="9.8" width="2.6" height="7.6" fill="url(#zwm-cyan)"/><rect x="14.6" y="6.8" width="2.6" height="10.6" fill="url(#zwm-gold)"/>', '<path d="M6 17.4H18M6.8 9.8L11.6 6.8L16.4 5.2M14.2 5.2H16.6V7.6" stroke="url(#zwm-gold)" stroke-width="1.35"/>'),
    combat: sovereignCrestSvg('url(#zwm-ruby)', '<path d="M12 5.4L17.2 7.8V12.2C17.2 15.4 15 17.8 12 19C9 17.8 6.8 15.4 6.8 12.2V7.8L12 5.4Z" fill="url(#zwm-ruby)" fill-opacity="0.25"/>', '<path d="M12 5.4L17.2 7.8V12.2C17.2 15.4 15 17.8 12 19C9 17.8 6.8 15.4 6.8 12.2V7.8L12 5.4ZM8.6 15.2L15.4 8.4M15.4 15.2L8.6 8.4" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    history: sovereignCrestSvg('url(#zwm-gold)', '<path d="M8.8 10C8.8 8 10.2 6.8 12 6.8C13.8 6.8 15.2 8 15.2 10C15.2 12.6 14 15.2 12 16.4C10 15.2 8.8 12.6 8.8 10Z" fill="url(#zwm-gold)" fill-opacity="0.32"/>', '<path d="M9.8 6.2H14.2M8.8 10C8.8 8 10.2 6.8 12 6.8C13.8 6.8 15.2 8 15.2 10C15.2 12.6 14 15.2 12 16.4C10 15.2 8.8 12.6 8.8 10ZM8.4 17.4H15.6" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    tech: sovereignCrestSvg('url(#zwm-cyan)', '<rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.4" fill="url(#zwm-cyan)" fill-opacity="0.24"/>', '<rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.4" stroke="url(#zwm-cyan)" stroke-width="1.45"/><rect x="10" y="10" width="4" height="4" fill="url(#zwm-gold)"/><path d="M10 5.4V7.4M14 5.4V7.4M10 16.6V18.6M14 16.6V18.6M5.4 10H7.4M5.4 14H7.4M16.6 10H18.6M16.6 14H18.6" stroke="url(#zwm-gold)" stroke-width="1.3"/>'),
    emergency: sovereignCrestSvg('url(#zwm-ruby)', '<circle cx="12" cy="12" r="5.4" fill="url(#zwm-ruby)" fill-opacity="0.24"/>', '<path d="M6.4 12.2H9.4L10.8 8.4L13 15.8L14.4 12.2H17.6" stroke="url(#zwm-emerald)" stroke-width="1.65"/><circle cx="12" cy="12" r="5.4" stroke="url(#zwm-ruby)" stroke-width="1.3"/>'),
    psychology: sovereignCrestSvg('url(#zwm-cyan)', '<circle cx="12" cy="11.4" r="4.6" fill="url(#zwm-cyan)" fill-opacity="0.22"/>', '<circle cx="12" cy="11.4" r="4.6" stroke="url(#zwm-gold)" stroke-width="1.35"/><circle cx="12" cy="11.4" r="1.7" fill="url(#zwm-cyan)"/><path d="M12 6.8V9.7M12 13.1V16M7.4 11.4H10.3M13.7 11.4H16.6M9.5 17.6H14.5" stroke="url(#zwm-steel)" stroke-width="1.3"/>'),
    math: sovereignCrestSvg('url(#zwm-gold)', '<path d="M7.2 16.4A6.8 6.8 0 0 1 16.8 9.2L7.2 16.4Z" fill="url(#zwm-gold)" fill-opacity="0.24"/>', '<path d="M6.8 16.8H17.2M6.8 16.8L15.8 7.2M14.8 16.8A6.4 6.4 0 0 0 11.4 10.6" stroke="url(#zwm-cyan)" stroke-width="1.5"/><circle cx="15.8" cy="7.2" r="1.4" fill="url(#zwm-gold)"/>'),
    pharma: sovereignCrestSvg('url(#zwm-emerald)', '<path d="M9.6 6.4H14.4V9.6L16.8 15.4C17.2 16.4 16.4 17.6 15.2 17.6H8.8C7.6 17.6 6.8 16.4 7.2 15.4L9.6 9.6V6.4Z" fill="url(#zwm-emerald)" fill-opacity="0.28"/>', '<path d="M9.2 6.4H14.8M10 6.4V9.6L7.2 15.4C6.8 16.4 7.6 17.6 8.8 17.6H15.2C16.4 17.6 17.2 16.4 16.8 15.4L14 9.6V6.4M8.4 13.8H15.6" stroke="url(#zwm-cyan)" stroke-width="1.4"/><circle cx="11" cy="15.6" r="0.9" fill="url(#zwm-gold)"/><circle cx="13.4" cy="15" r="0.8" fill="url(#zwm-gold)"/>'),
    motorsport: sovereignCrestSvg('url(#zwm-ruby)', '<circle cx="12" cy="12" r="5.4" fill="url(#zwm-ruby)" fill-opacity="0.22"/>', '<circle cx="12" cy="12" r="5.4" stroke="url(#zwm-steel)" stroke-width="1.45"/><circle cx="12" cy="12" r="1.8" fill="url(#zwm-gold)"/><path d="M12 12L15.6 8.8M8.2 15.4H15.8" stroke="url(#zwm-ruby)" stroke-width="1.55"/>'),
    command: sovereignCrestSvg('url(#zwm-gold)', '<path d="M7.2 15.8L8.6 9.4L12 12.2L15.4 9.4L16.8 15.8H7.2Z" fill="url(#zwm-gold)" fill-opacity="0.34"/>', '<path d="M7.2 15.8L8.6 9.4L12 12.2L15.4 9.4L16.8 15.8H7.2ZM12 6.2V8.4M10.8 7.2H13.2M7.6 17.6H16.4" stroke="url(#zwm-gold)" stroke-width="1.45"/>'),
    grocer: sovereignCrestSvg('url(#zwm-emerald)', '<path d="M6.8 10H17.2V17H6.8V10Z" fill="url(#zwm-emerald)" fill-opacity="0.22"/>', '<path d="M6.2 10L7.6 6.6H16.4L17.8 10H6.2ZM7 10V17.2H17V10M10.4 17.2V13.4H13.6V17.2" stroke="url(#zwm-gold)" stroke-width="1.4"/>'),
    army: sovereignCrestSvg('url(#zwm-gold)', '<polygon points="12,5.6 14,9.8 18.4,10.4 15.2,13.6 16,18 12,15.8 8,18 8.8,13.6 5.6,10.4 10,9.8" fill="url(#zwm-gold)" fill-opacity="0.32"/>', '<polygon points="12,5.6 14,9.8 18.4,10.4 15.2,13.6 16,18 12,15.8 8,18 8.8,13.6 5.6,10.4 10,9.8" stroke="url(#zwm-gold)" stroke-width="1.35"/>')
  };

  function resolveItemIconKey(nameText, typeText) {
    var s = String((nameText || '') + ' ' + (typeText || '')).toLowerCase();
    if (/painkiller|first aid|med|blood|morphine|bandage|إسعاف|دواء|طبي|مسكن/.test(s)) return 'medical';
    if (/armor|vest|kevlar|helmet|shield|درع|سترة|خوذة/.test(s)) return 'armor';
    if (/booster|energy|candy|xanax|ecstasy|drink|serum|منشط|طاقة|مشروب/.test(s)) return 'booster';
    if (/shotgun|pump|بندقية رش|شوزن/.test(s)) return 'shotgun';
    if (/pistol|magnum|glock|revolver|handgun|مسدس|ماغنوم/.test(s)) return 'pistol';
    if (/knife|blade|bat|crowbar|katana|melee|سكين|سيف|عصا|مضرب/.test(s)) return 'melee';
    if (/ak|rifle|m4|g3|l85|sniper|smg|weapon|gun|سلاح|رشاش|بندقية/.test(s)) return 'rifle';
    return 'armor';
  }

  function resolveRecordSpec(titleText) {
    var s = String(titleText || '').toLowerCase();
    if (/pharma|drug|compound|صيدل|كيمي|دوائ/.test(s)) return { icon: 'pharma', item3d: 'edu_pharma' };
    if (/emerg|trauma|revive|طوارئ|إسعاف|إنعاش/.test(s)) return { icon: 'emergency', item3d: 'edu_med' };
    if (/bio|med|health|doctor|nurse|أحياء|طب|صح/.test(s)) return { icon: 'biology', item3d: 'edu_bio' };
    if (/motor|race|engine|drive|محرك|سباق|سيار/.test(s)) return { icon: 'motorsport', item3d: 'edu_motorsport' };
    if (/sport|gym|fitness|biomech|رياض|لياق/.test(s)) return { icon: 'sports', item3d: 'edu_sports' };
    if (/psych|forensic|mental|نفس|جنائ.*نفس|سلوك/.test(s)) return { icon: 'psychology', item3d: 'edu_psych' };
    if (/law|legal|crim|judge|قانون|جنائ|محام/.test(s)) return { icon: 'law', item3d: 'edu_law' };
    if (/hist|museum|ancient|تاريخ|متحف|آثار/.test(s)) return { icon: 'history', item3d: 'edu_history' };
    if (/defense|tactical|combat|fight|دفاع|تكتيك|قتال/.test(s)) return { icon: 'combat', item3d: 'edu_combat' };
    if (/comp|tech|cyber|hack|code|حاسوب|تقني|برمج/.test(s)) return { icon: 'tech', item3d: 'edu_cs' };
    if (/math|ballistic|general stud|رياضيات|دراسات|باليست/.test(s)) return { icon: 'math', item3d: 'edu_math' };
    if (/command|syndicate|leader|قياد|نقاب|زعيم/.test(s)) return { icon: 'command', item3d: 'edu_command' };
    if (/busi|econ|finan|bank|market|تجار|أعمال|اقتصاد|مال/.test(s)) return { icon: 'business', item3d: 'edu_biz' };
    if (/grocer|shop|store|clerk|بقال|متجر/.test(s)) return { icon: 'grocer', item3d: 'edu_biz' };
    if (/casino|dealer|card|كازينو|موزع/.test(s)) return { icon: 'casino', item3d: 'roulette_wheel' };
    if (/army|military|guard|secur|جيش|عسكر|أمن/.test(s)) return { icon: 'army', item3d: 'edu_combat' };
    if (/edu|teach|univ|school|تعليم|أكاديم/.test(s)) return { icon: 'education', item3d: 'edu_math' };
    return { icon: 'command', item3d: 'edu_command' };
  }

  function resolveRecordIconKey(titleText) {
    return resolveRecordSpec(titleText).icon;
  }

  function resolveScreenKey(raw) {
    var k = String(raw || '').trim().toLowerCase();
    if (SKETCH_AREA_ICONS[k]) return k;
    if (k.indexOf('job') === 0 || /وظيف|عمل/.test(k)) return 'jobs';
    if (k.indexOf('crime') === 0 || /جرائم|جريم/.test(k)) return 'crimes';
    if (k.indexOf('item') === 0 || /عتاد|ترسان/.test(k)) return 'items';
    if (k.indexOf('prop') === 0 || /عقار|مسكن/.test(k)) return 'properties';
    if (k.indexOf('edu') === 0 || /تعليم|جامع/.test(k)) return 'education';
    if (k.indexOf('hosp') === 0 || /مستشف/.test(k)) return 'hospital';
    if (k.indexOf('fact') === 0 || /عائل|نقاب/.test(k)) return 'faction';
    if (k.indexOf('news') === 0 || /صحيف/.test(k)) return 'newspaper';
    if (k.indexOf('elim') === 0 || /تصفي/.test(k)) return 'elimination';
    if (k.indexOf('miss') === 0 || /مهام|عقود/.test(k)) return 'missions';
    if (k.indexOf('mark') === 0 || k.indexOf('bazaar') >= 0 || /سوق|بازار/.test(k)) return 'market';
    if (/بنك/.test(k)) return 'bank';
    if (/نادي|تمرين/.test(k)) return 'gym';
    if (/سجن/.test(k)) return 'jail';
    if (/كازينو/.test(k)) return 'casino';
    if (/هجوم|قتال/.test(k)) return 'attack';
    if (/مشاهير/.test(k)) return 'hof';
    if (/مدين/.test(k)) return 'city';
    return 'home';
  }

  function goToScreen(screenId) {
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(screenId);
      return;
    }
    var navBtn = document.querySelector('#zone-area-navigation button[data-zone-screen="' + screenId + '"]');
    if (navBtn) navBtn.click();
  }

  /* 0. Keep watercolor-sketchbook.css after runtime-injected <style> tags (debounced, zero thrash) */
  var headOrderRaf = false;
  function ensureStylesheetLast() {
    var head = document.head;
    if (!head) return;
    var link = head.querySelector('link[href*="watercolor-sketchbook.css"]');
    if (!link) return;
    var sibling = link.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === 'STYLE') {
        head.appendChild(link);
        break;
      }
      sibling = sibling.nextElementSibling;
    }
  }
  function scheduleHeadOrder() {
    if (headOrderRaf) return;
    headOrderRaf = true;
    var flush = function () {
      headOrderRaf = false;
      ensureStylesheetLast();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 16);
    }
  }

  /* 0B. Cross-Page Sketchbook Theme Persistence + Auxiliary Toggle (/account & /admin) */
  var restoredGameThemeOnce = false;

  function syncThemePersistenceAndAuxToggle() {
    if (document.documentElement.hasAttribute('data-sketch-mode')) {
      document.documentElement.removeAttribute('data-sketch-mode');
    }

    var isMainGame = Boolean(document.getElementById('dc-root') || document.querySelector('.zone-app'));
    if (isMainGame) {
      var stored = safeGetStoredTheme();
      if (!restoredGameThemeOnce) {
        var g = window.__zoneGame;
        if (g && g.state && typeof g.setState === 'function') {
          restoredGameThemeOnce = true;
          if (stored && g.state.theme !== stored) {
            document.documentElement.setAttribute('data-theme', stored);
            g.setState({ theme: stored });
            return;
          }
        }
      }
      var activeAttr = document.documentElement.getAttribute('data-theme');
      if (activeAttr === 'light' || activeAttr === 'dark') {
        safeStoreTheme(activeAttr);
      }
      return;
    }

    /* Auxiliary pages: /account and /admin */
    var th = currentTheme();
    if (document.documentElement.getAttribute('data-theme') !== th) {
      document.documentElement.setAttribute('data-theme', th);
    }

    var accountLangBtn = document.querySelector('body.zone-account > header > #languageToggle');
    var adminActions = document.querySelector('header.topbar[data-admin-shell] > .top-actions');
    var host = accountLangBtn ? accountLangBtn.parentElement : adminActions;
    if (!host) return;

    var btn = document.getElementById('zwc-aux-theme-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'zwc-aux-theme-toggle';
      btn.type = 'button';
      btn.className = adminActions ? 'button ghost zwc-aux-theme-btn' : 'zwc-aux-theme-btn';
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        safeStoreTheme(next);
        syncThemePersistenceAndAuxToggle();
        /* Force atomic style flush so 0ms paints/snapshots never see stale dark-mode transitions */
        void document.documentElement.offsetHeight;
      });
      if (accountLangBtn) {
        host.insertBefore(btn, accountLangBtn);
      } else if (adminActions) {
        adminActions.insertBefore(btn, adminActions.firstElementChild);
      }
    }

    var ar = isAr();
    var dotColor = th === 'dark' ? '#171411' : '#faf5e8';
    var labelText = th === 'dark' ? (ar ? 'داكن' : 'Dark') : (ar ? 'فاتح' : 'Light');
    var titleText = ar ? 'تبديل المظهر' : 'Toggle theme';
    var sig = th + '|' + (ar ? 'ar' : 'en');
    if (btn.getAttribute('data-sig') !== sig) {
      btn.setAttribute('data-sig', sig);
      btn.setAttribute('title', titleText);
      btn.innerHTML =
        '<span class="zwc-aux-theme-dot" style="background:' + dotColor + '"></span>' +
        '<span>' + labelText + '</span>';
    }
  }

  /* 1. Sync Bulletin -> "Current Mission:" & Sidebar "Information" Labels (Fiber-safe) */
  function syncMissionBulletin() {
    var badge = document.querySelector('.zone-topbar .zone-bulletin > span:first-child');
    var infoHead = document.querySelector('aside.zone-sidebar [data-zplayercard="1"] > .zone-panel-heading');
    var ar = isAr();
    if (badge) {
      var targetMission = ar ? 'المهمة الحالية:' : 'Current Mission:';
      if (badge.getAttribute('data-zwc-mission-label') !== targetMission) {
        badge.setAttribute('data-zwc-mission-label', targetMission);
      }
    }
    if (infoHead) {
      var targetInfo = ar ? 'المعلومات' : 'Information';
      if (infoHead.getAttribute('data-zwc-info-label') !== targetInfo) {
        infoHead.setAttribute('data-zwc-info-label', targetInfo);
      }
    }
  }

  /* 2. Sync Charcoal-Header "City Tutorial" / District Guide Card (All 19 Screens Bilingual) */
  var TUTORIAL_COPY = {
    home: {
      titleEn: 'Operative Sketchbook',
      titleAr: 'دفتر العميل',
      bodyEn: 'Your safehouse ledger, live Syndicate Arcade tables, and daily street contracts. Keep your Energy and Nerve bars active and claim your daily objective.',
      bodyAr: 'سجل مخبئك، وطاولات الأركيد المباشرة، وعقود الشارع اليومية. استثمر الطاقة والجرأة وأنجز هدفك اليومي.'
    },
    items: {
      titleEn: 'Items & Armory Guide',
      titleAr: 'دليل العتاد والترسانة',
      bodyEn: 'Inspect your weapons, body armor, medical kits, and boosters. Equip combat gear to raise battle multipliers or inspect 3D models.',
      bodyAr: 'افحص أسلحتك ودروعك وحقائب الإسعاف والمنشطات. جهّز عتاد القتال لرفع قوة الضرر أو استعرض النماذج ثلاثية الأبعاد.'
    },
    city: {
      titleEn: 'City Tutorial',
      titleAr: 'دليل المدينة',
      bodyEn: 'Here you can view all of the locations available to you in Zone City. Tap or pan across the illustrated city map below or open the 3D Tactical Grid to inspect block control.',
      bodyAr: 'هنا يمكنك استعراض جميع مواقع مدينة زون. اسحب أو اضغط على أي دبوس مرسوم على خريطة المدينة المائية أدناه للانتقال فوراً، أو افتح الشبكة ثلاثية الأبعاد لفحص سيطرة العائلات.'
    },
    jobs: {
      titleEn: 'Employment Guide',
      titleAr: 'دليل الوظائف',
      bodyEn: 'Work shifts to earn steady cash and job points. Higher levels unlock better-paying city careers and company specials.',
      bodyAr: 'اشتغل ورديات لكسب راتب ثابت ونقاط وظيفة. المستويات الأعلى تفتح وظائف أفضل ومزايا الشركات الخاصة.'
    },
    bank: {
      titleEn: 'Central Bank Guide',
      titleAr: 'دليل البنك المركزي',
      bodyEn: 'Protect your street cash from muggers by depositing into your vault, locking term CDs, or collecting stock block dividends.',
      bodyAr: 'احمِ أموالك من النشل عبر إيداعها في خزنة البنك، أو استثمارها في شهادات الإيداع وعوائد الأسهم.'
    },
    gym: {
      titleEn: 'Gym Training Guide',
      titleAr: 'دليل النادي الرياضي',
      bodyEn: 'Spend Energy to train Strength, Defense, Speed, and Dexterity. Higher Happiness boosts every rep and unlocks elite gyms.',
      bodyAr: 'اصرف الطاقة لتدريب القوة والدفاع والسرعة والرشاقة. المعنويات المرتفعة تضاعف مكاسب كل تمرين وتفتح أندية النخبة.'
    },
    properties: {
      titleEn: 'Properties & Estates Guide',
      titleAr: 'دليل العقارات والمساكن',
      bodyEn: 'Upgrade your residence to raise maximum Happiness, boost gym training efficiency, and hire estate staff.',
      bodyAr: 'طوّر مسكنك لرفع الحد الأقصى للمعنويات، وزيادة كفاءة التدريب في النادي، وتوظيف طاقم العقار.'
    },
    education: {
      titleEn: 'Education & Courses Guide',
      titleAr: 'دليل التعليم والدورات',
      bodyEn: 'Enroll in academic courses to unlock permanent passive bonuses across combat, medical care, crime, and income.',
      bodyAr: 'سجّل في الدورات الأكاديمية لفتح مزايا دائمة في القتال والإسعاف والجرائم ومضاعفة الدخل.'
    },
    crimes: {
      titleEn: 'Street Crimes Guide',
      titleAr: 'دليل جرائم الشوارع',
      bodyEn: 'Spend Nerve to run street operations. Successful hits build cash and Crime XP to unlock higher-stakes syndicate rackets.',
      bodyAr: 'اصرف الجرأة لتنفيذ عمليات الشارع. النجاح يمنحك النقود وخبرة الجريمة لفتح فئات أعلى خطورة وعائداً.'
    },
    missions: {
      titleEn: 'Missions & Contracts Guide',
      titleAr: 'دليل المهام والعقود',
      bodyEn: 'Complete street milestones across crimes, gym sessions, shifts, and combat to claim cash and points.',
      bodyAr: 'أنجز العقود الميدانية في الجرائم والتدريب والورديات والقتال لاستلام مكافآت النقد والنقاط.'
    },
    newspaper: {
      titleEn: 'City Newspaper Guide',
      titleAr: 'دليل صحيفة المدينة',
      bodyEn: 'Track live syndicate headlines, market movers, active bounties, encrypted mail, and street channels.',
      bodyAr: 'تابع عناوين المدينة المباشرة، وتحركات الأسعار، والمكافآت المرصودة، والرسائل، وقنوات المحادثة.'
    },
    jail: {
      titleEn: 'City Jail Guide',
      titleAr: 'دليل سجن المدينة',
      bodyEn: 'Spend Nerve to bust fellow operatives out of custody for XP, or pay cash bail for immediate release.',
      bodyAr: 'اصرف الجرأة لتهريب السجناء وكسب الخبرة، أو ادفع الكفالة النقدية للإفراج الفوري.'
    },
    hospital: {
      titleEn: 'Hospital Ward Guide',
      titleAr: 'دليل المستشفى',
      bodyEn: 'Recover Life after heavy firefights or failed heists using medical kits, blood bags, or ward care.',
      bodyAr: 'استعد صحتك بعد المعارك أو العمليات الفاشلة باستخدام حقائب الإسعاف أو أكياس الدم أو الرعاية الطبية.'
    },
    casino: {
      titleEn: 'Grand Casino Guide',
      titleAr: 'دليل الكازينو الكبير',
      bodyEn: 'Wager cash at High-Low, Blackjack 21, European Roulette, and progressive Jackpot Slots.',
      bodyAr: 'راهن بنقودك على طاولات أعلى-أدنى، وبلاك جاك 21، والروليت الأوروبي، وماكينات الجائزة الكبرى.'
    },
    hof: {
      titleEn: 'Hall of Fame Guide',
      titleAr: 'دليل قاعة المشاهير',
      bodyEn: 'Compare top Zone City operatives ranked by level, total battle stats, networth, and syndicate honors.',
      bodyAr: 'استعرض نخبة عملاء مدينة زون مرتّبين حسب المستوى ومجموع الصفات القتالية والثروة والأوسمة.'
    },
    faction: {
      titleEn: 'My Faction Guide',
      titleAr: 'دليل العائلة',
      bodyEn: 'Coordinate organized crimes, extend attack chains, claim territory rackets, and unlock shared family perks.',
      bodyAr: 'نسّق الجرائم المنظمة، ومدّد سلاسل الهجوم، وسيطر على عوائد الأراضي لفتح ترقيات العائلة المشتركة.'
    },
    elimination: {
      titleEn: 'Elimination Turf War Guide',
      titleAr: 'دليل حرب التصفيات',
      bodyEn: 'Hospitalize rival syndicate operatives to score points for your crew before the elimination round closes.',
      bodyAr: 'أدخل خصوم العائلات المنافسة إلى المستشفى لتسجيل النقاط لصالح فريقك قبل انتهاء الجولة.'
    },
    attack: {
      titleEn: 'Combat & Attack Guide',
      titleAr: 'دليل القتال والهجوم',
      bodyEn: 'Spend 25 Energy per fight. Tune ammo, weapon mods, and anatomical hitboxes to defeat rivals, mug cash, or build chain hits.',
      bodyAr: 'يستهلك كل هجوم 25 طاقة. اضبط الذخيرة وتعديلات السلاح ومناطق التصويب لهزيمة الخصوم أو النشل أو بناء السلسلة.'
    },
    market: {
      titleEn: 'Item Market Guide',
      titleAr: 'دليل سوق العتاد',
      bodyEn: 'Trade weapons, armor, medical supplies, and boosters across live street listings and player bazaars.',
      bodyAr: 'تاجر بالأسلحة والدروع والإمدادات الطبية والمنشطات عبر عروض السوق المباشرة وبازارات اللاعبين.'
    }
  };

  var SCREEN_TITLE_FALLBACK_EN = {
    hof: 'Hall of Fame Guide',
    items: 'Items & Armory Guide',
    jobs: 'Employment Guide',
    properties: 'Properties Guide',
    crimes: 'Crimes Guide',
    missions: 'Missions Guide',
    newspaper: 'Newspaper Guide',
    elimination: 'Elimination Guide',
    market: 'Item Market Guide'
  };

  function syncTutorialBanner() {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var heading = main.querySelector('.zone-page-heading');
    if (!heading) return;

    var screen = main.getAttribute('data-zone-screen') || 'home';
    var ar = isAr();
    var subP = heading.querySelector(':scope > p, :scope > span');
    var fallbackBody = subP ? subP.textContent.trim() : '';
    var spec = TUTORIAL_COPY[screen];
    var fallbackTitleEn =
      SCREEN_TITLE_FALLBACK_EN[screen] ||
      (screen.charAt(0).toUpperCase() + screen.slice(1).replace(/[-_]+/g, ' ') + ' Guide');
    var title = spec
      ? (ar ? spec.titleAr : spec.titleEn)
      : (ar ? 'دليل المنطقة' : fallbackTitleEn);
    var body = spec ? (ar ? spec.bodyAr : spec.bodyEn) : fallbackBody;
    if (!body) return;

    heading.setAttribute('data-zwc-enhanced', '1');
    var card = document.getElementById('zwc-tutorial-card');
    var sig = screen + '|' + (ar ? 'ar' : 'en') + '|' + body;
    if (card && card.getAttribute('data-sig') === sig && card.previousElementSibling === heading) {
      return;
    }
    if (card) card.remove();

    card = document.createElement('section');
    card.id = 'zwc-tutorial-card';
    card.className = 'zwc-tutorial-card';
    card.setAttribute('data-sig', sig);
    card.innerHTML =
      '<div class="zwc-tutorial-head">' +
        '<span class="zwc-tutorial-title">' +
          '<svg width="16" height="18" viewBox="0 0 18 20" fill="none" aria-hidden="true">' +
            '<path d="M9 2C5.7 2 3.2 4.5 3.2 7.6C3.2 9.7 4.4 11.4 6.1 12.4V14.8H11.9V12.4C13.6 11.4 14.8 9.7 14.8 7.6C14.8 4.5 12.3 2 9 2Z" fill="#f3cf7a" fill-opacity="0.38" stroke="#f7f1e3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M6.8 17.4H11.2" stroke="#f7f1e3" stroke-width="1.6" stroke-linecap="round"/>' +
          '</svg>' +
          '<span>' + title + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="zwc-tutorial-body">' + body + '</div>';

    heading.insertAdjacentElement('afterend', card);
  }

  /* 3. Sync Sidebar & Quick-Action Sovereign Metallic Crests + Education/Jobs 3D Turntables */
  function syncSketchIconsAndArt() {
    ensureGlobalMetallicDefs();
    /* Sidebar Areas (matches both zaaa-vivid-svg and zaaa-duotone-svg) */
    var navBtns = document.querySelectorAll('aside.zone-sidebar #zone-area-navigation button[data-zone-screen]');
    for (var i = 0; i < navBtns.length; i++) {
      var iconBox = navBtns[i].querySelector('.zone-nav-icon');
      if (!iconBox) continue;
      iconBox.setAttribute('data-zwc-icon', '1');
      var key = resolveScreenKey(navBtns[i].getAttribute('data-zone-screen'));
      var existing = iconBox.querySelector('svg.zaaa-vivid-svg, svg.zaaa-duotone-svg, svg.zwc-sketch-ico');
      if (existing && existing.getAttribute('data-zwc-ink') !== key) {
        var tmp = document.createElement('div');
        tmp.innerHTML = SKETCH_AREA_ICONS[key] || SKETCH_AREA_ICONS.home;
        var nextSvg = tmp.firstElementChild;
        if (nextSvg) {
          existing.setAttribute('data-zwc-ink', key);
          existing.setAttribute('data-zwc-icon', '1');
          existing.setAttribute('viewBox', '0 0 24 24');
          existing.innerHTML = nextSvg.innerHTML;
        }
      }
    }

    /* Home Quick Actions & City Directory Hand-Inked Watercolor Icons */
    var surfaceIcons = document.querySelectorAll(
      '#zone-main .zone-quick-actions > button .zone-nav-icon, #zone-main .zone-city-destinations button .zone-city-place-icon, #zone-main .zone-city-destinations button .zone-nav-icon'
    );
    for (var si = 0; si < surfaceIcons.length; si++) {
      var sBox = surfaceIcons[si];
      sBox.setAttribute('data-zwc-icon', '1');
      var hostBtn = sBox.closest('button');
      var rawKey =
        sBox.getAttribute('data-zfx-duotone') ||
        sBox.getAttribute('data-zfx-city-icon') ||
        (hostBtn && (hostBtn.getAttribute('data-zone-destination') || hostBtn.getAttribute('data-zone-location'))) ||
        (hostBtn && hostBtn.querySelector('strong') && hostBtn.querySelector('strong').textContent) ||
        'home';
      var sKey = resolveScreenKey(rawKey);
      var sSvg = sBox.querySelector('svg.zfx-duotone-svg, svg.zfx-city-svg, svg.zwc-sketch-ico');
      if (sSvg && sSvg.getAttribute('data-zwc-ink') !== sKey) {
        var sTmp = document.createElement('div');
        sTmp.innerHTML = SKETCH_AREA_ICONS[sKey] || SKETCH_AREA_ICONS.city;
        if (sTmp.firstElementChild) {
          sSvg.classList.add('zwc-sketch-ico');
          sSvg.setAttribute('data-zwc-ink', sKey);
          sSvg.setAttribute('data-zwc-icon', '1');
          sSvg.setAttribute('viewBox', '0 0 24 24');
          sSvg.innerHTML = sTmp.firstElementChild.innerHTML;
        }
      }
    }

    /* Item Market Hand-Inked Gouache Item Icons (replaces tiny monochrome 1px outlines) */
    var marketRows = document.querySelectorAll('#zone-main[data-zone-screen="market"] .zone-table-row');
    for (var mi = 0; mi < marketRows.length; mi++) {
      var mRow = marketRows[mi];
      var mIconSpan = mRow.querySelector(':scope > div:first-child > span:first-child');
      if (!mIconSpan) continue;
      var mTextWrap = mIconSpan.nextElementSibling;
      var mName = mTextWrap && mTextWrap.children[0] ? mTextWrap.children[0].textContent : '';
      var mType = mTextWrap && mTextWrap.children[1] ? mTextWrap.children[1].textContent : '';
      var mKey = resolveItemIconKey(mName, mType);
      var mExisting = mIconSpan.querySelector('svg.zwc-sketch-ico');
      if (!mExisting || mExisting.getAttribute('data-zwc-market-ico') !== mKey) {
        if (mExisting) mExisting.remove();
        var mTmp = document.createElement('div');
        mTmp.innerHTML = SKETCH_ITEM_ICONS[mKey] || SKETCH_ITEM_ICONS.rifle;
        var mSvg = mTmp.firstElementChild;
        if (mSvg) {
          mSvg.setAttribute('data-zwc-market-ico', mKey);
          mSvg.setAttribute('data-zwc-ink', mKey);
          mIconSpan.setAttribute('data-zwc-enhanced', '1');
          mIconSpan.appendChild(mSvg);
        }
      }
    }

    /* Items Inspector Category Artwork Stage (replaces harsh solid-black pixel cross on Light paper) */
    var stageImgs = document.querySelectorAll('#zone-main .zone-item-stage img[src*="assets/ui/icons/"]');
    for (var st = 0; st < stageImgs.length; st++) {
      var stImg = stageImgs[st];
      var stHost = stImg.parentElement;
      if (!stHost) continue;
      var inspector = stHost.closest('.zone-item-inspector');
      var selHeading = inspector ? inspector.querySelector('.zone-panel-heading') : null;
      var stKey = resolveItemIconKey(
        (selHeading ? selHeading.textContent : '') + ' ' + (stImg.getAttribute('src') || ''),
        stImg.getAttribute('alt') || ''
      );
      stImg.style.display = 'none';
      var emblem = stHost.querySelector('.zwc-stage-emblem');
      if (!emblem || emblem.getAttribute('data-zwc-stage-ico') !== stKey) {
        if (emblem) emblem.remove();
        emblem = document.createElement('span');
        emblem.className = 'zwc-stage-emblem';
        emblem.setAttribute('data-zwc-stage-ico', stKey);
        emblem.setAttribute('aria-hidden', 'true');
        emblem.innerHTML = SKETCH_ITEM_ICONS[stKey] || SKETCH_ITEM_ICONS.medical;
        stHost.insertBefore(emblem, stImg);
      }
    }

    /* Education Sovereign 3D University Hero Stage + 18 Live 3D Discipline Turntables & Jobs Medallions */
    var eduSchedule = document.querySelector('#zone-main[data-zone-screen="education"] .zone-course-schedule');
    if (eduSchedule) {
      var eduHero = document.getElementById('zwc-edu-3d-hero');
      var eduLang = isAr() ? 'ar' : 'en';
      if (!eduHero || eduHero.getAttribute('data-lang') !== eduLang) {
        if (eduHero) eduHero.remove();
        eduHero = document.createElement('div');
        eduHero.id = 'zwc-edu-3d-hero';
        eduHero.className = 'zwc-edu-3d-hero';
        eduHero.setAttribute('data-lang', eduLang);
        eduHero.innerHTML =
          '<div class="zwc-edu-hero-bar">' +
            '<div class="zwc-edu-hero-meta">' +
              '<span class="zwc-edu-hero-kicker">' + (eduLang === 'ar' ? 'الأكاديمية السيادية · مختبر الأبحاث ثلاثي الأبعاد' : 'SOVEREIGN UNIVERSITY · 3D RESEARCH SANCTUM') + '</span>' +
              '<strong class="zwc-edu-hero-title">' + (eduLang === 'ar' ? 'مدرّج العلوم الجنائية والتكتيك والمال' : 'Armillary Orrery, Cyber-Forensics & Syndicate Command Lab') + '</strong>' +
            '</div>' +
            '<div class="zwc-edu-hero-actions">' +
              '<button type="button" class="zwc-edu-3d-btn" data-zwc-inspect-3d="edu_bio">' + (eduLang === 'ar' ? 'فحص 3D: الأحياء' : '360° Bio-Helix') + '</button>' +
              '<button type="button" class="zwc-edu-3d-btn" data-zwc-inspect-3d="edu_cs">' + (eduLang === 'ar' ? 'فحص 3D: السيبراني' : '360° Cyber-Deck') + '</button>' +
              '<button type="button" class="zwc-edu-3d-btn" data-zwc-inspect-3d="edu_command">' + (eduLang === 'ar' ? 'فحص 3D: القيادة' : '360° Command Crown') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="z3d-action-stage zwc-edu-hero-viewport" data-z3d-stage="safehouse-empire" data-z3d-submode="academy" data-z3d-interactive="1" style="min-height:224px;height:224px"></div>';
        var recHead = eduSchedule.querySelector(':scope > header.zone-record-heading');
        if (recHead) {
          recHead.insertAdjacentElement('afterend', eduHero);
        } else {
          eduSchedule.insertBefore(eduHero, eduSchedule.firstChild);
        }
        if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
          window.ZoneEcs3D.scan(eduHero);
        }
      }
    }

    var recordArts = document.querySelectorAll(
      '#zone-main[data-zone-screen="education"] .zone-record-art, #zone-main[data-zone-screen="jobs"] .zone-record-art, #zone-main[data-zone-screen="job"] .zone-record-art'
    );
    var mountedNewEduSlots = false;
    for (var ri = 0; ri < recordArts.length; ri++) {
      var rArt = recordArts[ri];
      var rRow = rArt.closest('article, .zone-current-record, header');
      var rTitleEl = rRow ? rRow.querySelector('h2, h3') : null;
      var rTitleTxt = rTitleEl ? rTitleEl.textContent : '';
      var rSpec = resolveRecordSpec(rTitleTxt);
      var rKey = rSpec.icon;
      var rSvg = rArt.querySelector('svg.zwc-sketch-ico');
      if (!rSvg || rSvg.getAttribute('data-zwc-rec-ico') !== rKey) {
        if (rSvg) rSvg.remove();
        var rTmp = document.createElement('div');
        rTmp.innerHTML = SKETCH_ITEM_ICONS[rKey] || SKETCH_AREA_ICONS[rKey] || SKETCH_ITEM_ICONS.command;
        var nextRecSvg = rTmp.firstElementChild;
        if (nextRecSvg) {
          nextRecSvg.setAttribute('data-zwc-rec-ico', rKey);
          nextRecSvg.setAttribute('data-zwc-ink', rKey);
          rArt.setAttribute('data-zwc-enhanced', '1');
          rArt.appendChild(nextRecSvg);
        }
      }
      /* Inject live 3D rotating discipline/career turntable inside Education course rows & Jobs career rows */
      var interactiveRow = rArt.closest(
        '#zone-main[data-zone-screen="education"] article.zone-course-row, #zone-main[data-zone-screen="jobs"] article.zone-employment-row, #zone-main[data-zone-screen="job"] article.zone-employment-row'
      );
      if (interactiveRow) {
        var existingSlot = interactiveRow.querySelector('.zwc-edu-3d-wrap');
        if (!existingSlot || existingSlot.getAttribute('data-edu-item') !== rSpec.item3d) {
          if (existingSlot) existingSlot.remove();
          var wrap3d = document.createElement('div');
          wrap3d.className = 'zwc-edu-3d-wrap';
          wrap3d.setAttribute('data-edu-item', rSpec.item3d);
          wrap3d.innerHTML =
            '<div class="z3d-item-slot zwc-edu-3d-slot" data-z3d-item="' + rSpec.item3d + '" data-z3d-cat="enhancer"></div>' +
            '<button type="button" class="zwc-edu-3d-btn" data-zwc-inspect-3d="' + rSpec.item3d + '" data-zwc-label="' + rTitleTxt.replace(/"/g, '') + '">3D</button>';
          var actionCol = interactiveRow.querySelector('.zone-record-action');
          if (actionCol) {
            interactiveRow.insertBefore(wrap3d, actionCol);
          } else {
            interactiveRow.appendChild(wrap3d);
          }
          mountedNewEduSlots = true;
        }
      }
    }
    if (mountedNewEduSlots && window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
      window.ZoneEcs3D.scan(document.getElementById('zone-main') || document);
    }

    if (!document.__zwcEdu3dClickBound) {
      document.__zwcEdu3dClickBound = true;
      document.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-zwc-inspect-3d]') : null;
        if (!btn) return;
        ev.preventDefault();
        var itemId = btn.getAttribute('data-zwc-inspect-3d') || 'edu_command';
        var label = btn.getAttribute('data-zwc-label') || itemId;
        if (window.ZoneEcs3D && typeof window.ZoneEcs3D.inspectItem === 'function') {
          window.ZoneEcs3D.inspectItem(itemId, { category: 'enhancer', rarity: 'legendary', title: label });
        }
      });
    }

    /* Swap Arcade Key-Art Images to Hand-Drawn Ink & Watercolor Illustrations */
    var artMap = {
      'arcade-getaway.webp': '/assets/ui/watercolor-art/arcade-getaway.webp',
      'arcade-heist.webp': '/assets/ui/watercolor-art/arcade-heist.webp',
      'arcade-casino.webp': '/assets/ui/watercolor-art/arcade-casino.webp',
      'arcade-heavybag.webp': '/assets/ui/watercolor-art/arcade-heavybag.webp'
    };
    var imgs = document.querySelectorAll('#zone-main img.zig-card-art');
    for (var j = 0; j < imgs.length; j++) {
      var src = imgs[j].getAttribute('src') || '';
      for (var file in artMap) {
        if (src.indexOf(file) >= 0 && src !== artMap[file]) {
          imgs[j].setAttribute('src', artMap[file]);
        }
      }
    }

    /* Key of Symbols 6 Hand-Painted Watercolor Teardrop Pins (exact mockup palette) */
    var legendColors = [
      '#3e6fb0', /* Financial - Cobalt Blue */
      '#b85233', /* Administrative - Burnt Terracotta */
      '#dba83b', /* Shopping - Warm Ochre Gold */
      '#6c8c3c', /* Leisure - Olive Moss Green */
      '#2f8b7b', /* Real Estate - Verdigris Teal */
      '#7b4ca0'  /* Miscellaneous - Royal Plum */
    ];
    var legendItems = document.querySelectorAll('#zone-main .zone-city-legend > div');
    for (var li = 0; li < legendItems.length; li++) {
      var item = legendItems[li];
      var pinWrap = item.querySelector('.zwc-legend-teardrop');
      var color = legendColors[li % legendColors.length];
      if (!pinWrap) {
        /* Hide any existing icon span via inline display none without removing React child */
        var firstChild = item.firstElementChild;
        if (firstChild && !firstChild.classList.contains('zwc-legend-teardrop')) {
          firstChild.style.display = 'none';
        }
        var zfxWell = item.querySelector('.zfx-legend-icon-well');
        if (zfxWell) zfxWell.style.display = 'none';
        pinWrap = document.createElement('span');
        pinWrap.className = 'zwc-legend-teardrop';
        pinWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:30px;flex:0 0 24px;order:-1;';
        pinWrap.innerHTML = teardropPinSvg(color, '');
        item.appendChild(pinWrap);
      }
    }
  }

  /* 4. Mount Interactive Hand-Painted Watercolor Panorama Stage on City Screen (ALL 18 Districts) */
  var PRIMARY_CITY_PINS = {
    bank: true,
    gym: true,
    crimes: true,
    hospital: true,
    market: true,
    properties: true
  };

  var CITY_PINS = [
    { id: 'bank', screen: 'bank', x: 45, y: 34, color: '#3e6fb0', en: 'Central Bank', ar: 'البنك المركزي', minLv: 1 },
    { id: 'gym', screen: 'gym', x: 28, y: 50, color: '#6c8c3c', en: 'Ironworks Gym', ar: 'النادي الرياضي', minLv: 1 },
    { id: 'crimes', screen: 'crimes', x: 17, y: 70, color: '#b85233', en: 'Harbor Docks', ar: 'مرافئ العمليات', minLv: 1 },
    { id: 'hospital', screen: 'hospital', x: 64, y: 43, color: '#b85233', en: 'City Hospital', ar: 'المستشفى', minLv: 1 },
    { id: 'market', screen: 'market', x: 71, y: 67, color: '#dba83b', en: 'Old Town Market', ar: 'سوق البلدة القديمة', minLv: 1 },
    { id: 'properties', screen: 'properties', x: 86, y: 35, color: '#2f8b7b', en: 'Citadel Estates', ar: 'عقارات القلعة', minLv: 1 },
    { id: 'casino', screen: 'casino', x: 42, y: 27, color: '#7b4ca0', en: 'Grand Casino', ar: 'الكازينو الكبير', minLv: 1 },
    { id: 'education', screen: 'education', x: 64, y: 17, color: '#3e6fb0', en: 'University Hill', ar: 'تلة الجامعة', minLv: 1 },
    { id: 'jail', screen: 'jail', x: 26, y: 18, color: '#b85233', en: 'Fortress Bastion', ar: 'سجن الحصن', minLv: 1 },
    { id: 'jobs', screen: 'jobs', x: 52, y: 61, color: '#dba83b', en: 'River Exchange', ar: 'بورصة الأعمال', minLv: 1 },
    { id: 'home', screen: 'home', x: 76, y: 50, color: '#2f8b7b', en: 'Safehouse', ar: 'المخبأ الآمن', minLv: 1 },
    { id: 'items', screen: 'items', x: 16, y: 47, color: '#dba83b', en: 'Armory Depot', ar: 'مخزن الترسانة', minLv: 1 },
    { id: 'missions', screen: 'missions', x: 33, y: 36, color: '#7b4ca0', en: 'Fixer Contracts', ar: 'عقود العمدة', minLv: 1 },
    { id: 'newspaper', screen: 'newspaper', x: 62, y: 34, color: '#7b4ca0', en: 'City Gazette', ar: 'صحيفة المدينة', minLv: 1 },
    { id: 'faction', screen: 'faction', x: 82, y: 66, color: '#3e6fb0', en: 'Syndicate Hall', ar: 'مقر العائلة', minLv: 1 },
    { id: 'attack', screen: 'attack', x: 31, y: 74, color: '#b85233', en: 'Combat Wharf', ar: 'رصيف القتال', minLv: 1 },
    { id: 'hof', screen: 'hof', x: 54, y: 12, color: '#dba83b', en: 'Hall of Fame', ar: 'قاعة المشاهير', minLv: 1 },
    { id: 'elimination', screen: 'elimination', x: 13, y: 32, color: '#6c8c3c', en: 'Turf Arena', ar: 'ساحة التصفيات', minLv: 1 }
  ];

  var preferredCityView = 'illustrated';

  function upsertThemeParam(rawUrl, theme) {
    if (!rawUrl) return rawUrl;
    var clean = String(rawUrl);
    if (/([?&])theme=[^&#]*/i.test(clean)) {
      return clean.replace(/([?&])theme=[^&#]*/i, '$1theme=' + encodeURIComponent(theme));
    }
    var hashIdx = clean.indexOf('#');
    var base = hashIdx >= 0 ? clean.slice(0, hashIdx) : clean;
    var hash = hashIdx >= 0 ? clean.slice(hashIdx) : '';
    var sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base + sep + 'theme=' + encodeURIComponent(theme) + hash;
  }

  function postThemeToMapIframe(mapFrame, theme) {
    if (!mapFrame || !mapFrame.contentWindow) return;
    try {
      mapFrame.contentWindow.postMessage({ type: 'ZONE_THEME_SYNC', theme: theme }, '*');
    } catch (_) {}
  }

  function syncMapIframeTheme(forceTheme) {
    var theme = (forceTheme === 'light' || forceTheme === 'dark') ? forceTheme : currentTheme();
    var mapFrame = document.getElementById('zone-city-map');
    if (!mapFrame) return;

    var dataSrc = mapFrame.getAttribute('data-map-src');
    if (dataSrc) {
      var nextDataSrc = upsertThemeParam(dataSrc, theme);
      if (nextDataSrc !== dataSrc) {
        mapFrame.setAttribute('data-map-src', nextDataSrc);
      }
    }

    var curSrc = mapFrame.getAttribute('src') || '';
    if (curSrc && curSrc !== 'about:blank' && !/([?&])theme=/i.test(curSrc) && mapFrame.getAttribute('data-zwc-loaded') !== '1') {
      mapFrame.setAttribute('src', upsertThemeParam(curSrc, theme));
    }

    if (!mapFrame.__zwcThemeLoadBound) {
      mapFrame.__zwcThemeLoadBound = true;
      mapFrame.addEventListener('load', function () {
        mapFrame.setAttribute('data-zwc-loaded', '1');
        var liveTheme = currentTheme();
        postThemeToMapIframe(mapFrame, liveTheme);
        setTimeout(function () { postThemeToMapIframe(mapFrame, currentTheme()); }, 140);
        setTimeout(function () { postThemeToMapIframe(mapFrame, currentTheme()); }, 480);
      });
    }

    postThemeToMapIframe(mapFrame, theme);
  }

  function syncModeBarState(stage, view) {
    if (!stage) return;
    var active = view === '3d' ? '3d' : 'illustrated';
    var btns = stage.querySelectorAll('[data-zwc-mode]');
    for (var b = 0; b < btns.length; b++) {
      var mode = btns[b].getAttribute('data-zwc-mode');
      btns[b].setAttribute('aria-pressed', mode === active ? 'true' : 'false');
    }
  }

  function syncCityPanoramaStage() {
    var shell = document.querySelector('#zone-main .zone-city-map-shell');
    if (!shell) return;
    syncMapIframeTheme();

    var ar = isAr();
    var activeView = shell.getAttribute('data-zwc-view');
    if (activeView !== 'illustrated' && activeView !== '3d') {
      activeView = preferredCityView;
      shell.setAttribute('data-zwc-view', activeView);
    }

    var existing = document.getElementById('zwc-city-panorama-stage');
    var langKey = ar ? 'ar' : 'en';
    if (existing && existing.getAttribute('data-lang') === langKey && existing.parentElement === shell) {
      syncModeBarState(existing, activeView);
      return;
    }
    if (existing) existing.remove();

    var stage = document.createElement('div');
    stage.id = 'zwc-city-panorama-stage';
    stage.setAttribute('data-lang', langKey);

    var pinsHtml = '';
    for (var i = 0; i < CITY_PINS.length; i++) {
      var p = CITY_PINS[i];
      var label = ar ? p.ar : p.en;
      var primaryAttr = PRIMARY_CITY_PINS[p.id] ? ' data-zwc-primary="1"' : '';
      pinsHtml +=
        '<button type="button" class="zwc-map-pin" data-zwc-go="' + p.screen + '"' + primaryAttr + ' style="left:' + p.x + '%;top:' + p.y + '%" title="' + label + '" aria-label="' + label + '">' +
          teardropPinSvg(p.color, '') +
          '<span class="zwc-map-pin-tag">' + label + '</span>' +
        '</button>';
    }

    var isIll = activeView !== '3d';
    stage.innerHTML =
      '<div class="zwc-map-mode-bar" role="group" aria-label="' + (ar ? 'وضع الخريطة' : 'Map view mode') + '">' +
        '<button type="button" class="zwc-mode-btn" data-zwc-mode="illustrated" aria-pressed="' + (isIll ? 'true' : 'false') + '">' +
          (ar ? 'خريطة مرسومة' : 'Illustrated Atlas') +
        '</button>' +
        '<button type="button" class="zwc-mode-btn" data-zwc-mode="3d" aria-pressed="' + (!isIll ? 'true' : 'false') + '">' +
          (ar ? 'خريطة 3D' : '3D Block Map') +
        '</button>' +
      '</div>' +
      '<div class="zwc-panorama-viewport" dir="ltr">' +
        '<div class="zwc-panorama-art-wrap">' +
          '<img class="zwc-panorama-img" src="/assets/ui/watercolor-art/city-panorama.webp" alt="' + (ar ? 'خريطة مدينة زون المرسومة' : 'Hand-drawn watercolor map of Zone City') + '" loading="eager" decoding="async">' +
          pinsHtml +
        '</div>' +
      '</div>';

    stage.addEventListener('click', function (ev) {
      var modeBtn = ev.target.closest('[data-zwc-mode]');
      if (modeBtn) {
        ev.preventDefault();
        preferredCityView = modeBtn.getAttribute('data-zwc-mode') === '3d' ? '3d' : 'illustrated';
        shell.setAttribute('data-zwc-view', preferredCityView);
        syncModeBarState(stage, preferredCityView);
        if (preferredCityView === '3d') {
          syncMapIframeTheme();
          if (window.ZoneGameFX && typeof window.ZoneGameFX.syncWebglIframeThrottle === 'function') {
            window.ZoneGameFX.syncWebglIframeThrottle();
          }
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            try {
              syncMapIframeTheme();
              window.dispatchEvent(new Event('resize'));
              var mapFrame = shell.querySelector('iframe#zone-city-map');
              if (mapFrame && mapFrame.contentWindow) {
                mapFrame.contentWindow.dispatchEvent(new Event('resize'));
              }
            } catch (_) {}
          }, 90);
          setTimeout(function () { syncMapIframeTheme(); }, 350);
        }
        return;
      }
      var pinBtn = ev.target.closest('[data-zwc-go]');
      if (pinBtn) {
        ev.preventDefault();
        goToScreen(pinBtn.getAttribute('data-zwc-go'));
      }
    });

    shell.appendChild(stage);

    /* Center panorama scroll smoothly on mobile portrait viewports */
    if (window.innerWidth <= 640) {
      var vp = stage.querySelector('.zwc-panorama-viewport');
      if (vp && vp.scrollWidth > vp.clientWidth) {
        vp.scrollLeft = Math.round((vp.scrollWidth - vp.clientWidth) * 0.42);
      }
    }
  }

  /* Prevent programmatic focus on #zone-main from scrolling H1/sidebar under sticky .zone-topbar */
  if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype && typeof HTMLElement.prototype.focus === 'function' && !HTMLElement.prototype.__zwcFocusGuarded) {
    var origFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.__zwcFocusGuarded = true;
    HTMLElement.prototype.focus = function (opts) {
      if (this && (this.id === 'zone-main' || (this.tagName === 'H1' && typeof this.closest === 'function' && this.closest('#zone-main')))) {
        try {
          return origFocus.call(this, Object.assign({}, opts || {}, { preventScroll: true }));
        } catch (_) {
          return origFocus.call(this);
        }
      }
      return arguments.length > 0 ? origFocus.call(this, opts) : origFocus.call(this);
    };
  }

  /* Neutralize route-navigation.js:43 top = mainRect.top - 12 (87px desktop / 50px mobile) scroll jump
     that tucks #zone-main H1 behind sticky .zone-topbar on route changes, async re-renders & theme toggles */
  var origWindowScrollTo = typeof window.scrollTo === 'function' ? window.scrollTo.bind(window) : null;
  if (origWindowScrollTo && !window.__zwcScrollToGuarded) {
    window.__zwcScrollToGuarded = true;
    var guardedScrollTo = function () {
      var main = document.getElementById('zone-main');
      if (main && arguments.length > 0) {
        var first = arguments[0];
        var routeTop = Math.max(0, (window.scrollY || 0) + main.getBoundingClientRect().top - 12);
        if (first && typeof first === 'object' && typeof first.top === 'number') {
          if (first.top > 0 && first.top <= 150 && Math.abs(first.top - routeTop) <= 32) {
            return origWindowScrollTo(Object.assign({}, first, { top: 0 }));
          }
        } else if (typeof first === 'number' && typeof arguments[1] === 'number') {
          var targetY = arguments[1];
          if (targetY > 0 && targetY <= 150 && Math.abs(targetY - routeTop) <= 32) {
            return origWindowScrollTo(first, 0);
          }
        }
      }
      return origWindowScrollTo.apply(window, arguments);
    };
    window.scrollTo = guardedScrollTo;
    if (typeof window.scroll === 'function') {
      window.scroll = guardedScrollTo;
    }
  }

  /* Guard Element.prototype.scrollIntoView on #zone-main / .zone-page-heading so H1 never slips behind .zone-topbar */
  if (typeof Element !== 'undefined' && Element.prototype && typeof Element.prototype.scrollIntoView === 'function' && !Element.prototype.__zwcScrollIntoViewGuarded) {
    var origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.__zwcScrollIntoViewGuarded = true;
    Element.prototype.scrollIntoView = function () {
      if (this && (this.id === 'zone-main' || (typeof this.closest === 'function' && (this.closest('.zone-page-heading') || (this.tagName === 'H1' && this.closest('#zone-main')))))) {
        if (origWindowScrollTo) {
          try {
            origWindowScrollTo({ top: 0, left: 0, behavior: 'instant' });
          } catch (_) {
            origWindowScrollTo(0, 0);
          }
        }
        return;
      }
      return origScrollIntoView.apply(this, arguments);
    };
  }

  var lastObservedScreen = '';
  var rafScheduled = false;
  var userScrolledSinceRoute = false;

  function instantScrollTop() {
    if (userScrolledSinceRoute) return;
    if (window.scrollY > 0 && window.scrollY <= 180) {
      try {
        (origWindowScrollTo || window.scrollTo)({ top: 0, left: 0, behavior: 'instant' });
      } catch (_) {
        (origWindowScrollTo || window.scrollTo)(0, 0);
      }
    }
  }

  function scheduleRouteTopSnap() {
    userScrolledSinceRoute = false;
    instantScrollTop();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(instantScrollTop);
    }
    setTimeout(instantScrollTop, 50);
    setTimeout(instantScrollTop, 160);
    setTimeout(instantScrollTop, 380);
  }

  function syncAll() {
    rafScheduled = false;
    ensureStylesheetLast();
    if (document.querySelector('x-dc')) return;
    try {
      syncThemePersistenceAndAuxToggle();
      var main = document.getElementById('zone-main');
      var curScreen = main ? (main.getAttribute('data-zone-screen') || '') : '';
      if (curScreen && curScreen !== lastObservedScreen) {
        lastObservedScreen = curScreen;
        scheduleRouteTopSnap();
      }
      syncMissionBulletin();
      syncTutorialBanner();
      syncSketchIconsAndArt();
      syncCityPanoramaStage();
    } catch (_) {}
  }

  function scheduleSync() {
    if (rafScheduled) return;
    rafScheduled = true;
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(syncAll);
    } else {
      setTimeout(syncAll, 16);
    }
  }

  function boot() {
    ensureStylesheetLast();
    window.addEventListener('wheel', function () { userScrolledSinceRoute = true; }, { passive: true });
    window.addEventListener('touchmove', function () { userScrolledSinceRoute = true; }, { passive: true });
    scheduleRouteTopSnap();
    syncAll();
    setTimeout(syncAll, 180);
    setTimeout(syncAll, 520);

    window.addEventListener('zone:render', scheduleSync);
    window.addEventListener('storage', function (ev) {
      if (!ev || ev.key === THEME_STORAGE_KEY) {
        var next = safeGetStoredTheme();
        if (next === 'light' || next === 'dark') {
          document.documentElement.setAttribute('data-theme', next);
          if (window.__zoneGame && window.__zoneGame.state && window.__zoneGame.state.theme !== next) {
            window.__zoneGame.setState({ theme: next });
          }
          syncAll();
        }
      }
    });

    if (typeof MutationObserver === 'function') {
      if (document.head) {
        var headObs = new MutationObserver(function () {
          scheduleHeadOrder();
        });
        headObs.observe(document.head, { childList: true });
      }
      var obs = new MutationObserver(function () {
        if (!userScrolledSinceRoute) {
          instantScrollTop();
          if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(instantScrollTop);
          }
          setTimeout(instantScrollTop, 60);
          setTimeout(instantScrollTop, 180);
        }
        syncMapIframeTheme();
        syncAll();
      });
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
      var attachMain = function () {
        var main = document.getElementById('zone-main');
        if (main && !main.__zwcObserved) {
          main.__zwcObserved = true;
          var mObs = new MutationObserver(function () {
            scheduleSync();
          });
          mObs.observe(main, { childList: true, attributes: true, attributeFilter: ['data-zone-screen'] });
        }
      };
      attachMain();
      setTimeout(attachMain, 450);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

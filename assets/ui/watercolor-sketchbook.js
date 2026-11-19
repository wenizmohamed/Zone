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

  /* Vibrant Multi-Color Hand-Inked Gouache Icons for Sidebar Areas & Surface Actions */
  function sketchAreaSvg(washColor, washShape, inkPath) {
    return (
      '<svg class="zwc-sketch-ico" data-zwc-color="v140" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        washShape.replace(/__WASH__/g, washColor) +
        '<path class="zwc-ink-stroke" d="' + inkPath + '" fill="none" stroke="var(--zwc-svg-ink, #221e1a)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  var SKETCH_AREA_ICONS = {
    home: sketchAreaSvg('#f5b82e', '<path class="zwc-wash-fill" d="M5.5 11.2L12 5L18.5 11.2V19.6H5.5V11.2Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M3.5 11.4L12 4L20.5 11.4H18.2L12 6L5.8 11.4H3.5Z" fill="#e63946"/><rect class="zwc-accent-fill" x="10" y="14.2" width="4" height="5.4" fill="#14b8a6"/>', 'M3.5 11.5L12 4L20.5 11.5M6 10.2V19.8H18V10.2M10 19.8V14.2H14V19.8'),
    items: sketchAreaSvg('#ea7234', '<path class="zwc-wash-fill" d="M4.2 8.2L12 4.4L19.8 8.2V17.4L12 20.6L4.2 17.4V8.2Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M4.2 8.2L12 4.4L19.8 8.2L12 11.8L4.2 8.2Z" fill="#f5b82e"/>', 'M4.2 8.2L12 4.4L19.8 8.2V17.4L12 20.6L4.2 17.4V8.2ZM4.2 8.2L12 11.8L19.8 8.2M12 11.8V20.6'),
    city: sketchAreaSvg('#2da4e8', '<path class="zwc-wash-fill" d="M12 20.6C12 20.6 18 14.3 18 9.8A6 6 0 1 0 6 9.8C6 14.3 12 20.6 12 20.6Z" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="9.8" r="2.6" fill="#f5b82e"/>', 'M12 21C12 21 18.2 14.4 18.2 9.8A6.2 6.2 0 1 0 5.8 9.8C5.8 14.4 12 21 12 21ZM12 12.2A2.4 2.4 0 1 0 12 7.4A2.4 2.4 0 0 0 12 12.2Z'),
    jobs: sketchAreaSvg('#3b82f6', '<rect class="zwc-wash-fill" x="4" y="8" width="16" height="11.2" rx="1.8" fill="__WASH__"/><rect class="zwc-accent-fill" x="10.2" y="11" width="3.6" height="3.2" rx="0.7" fill="#f5b82e"/>', 'M9 7.8V5.6C9 4.8 9.7 4.2 10.5 4.2H13.5C14.3 4.2 15 4.8 15 5.6V7.8M4 8H20V19.2H4V8ZM4 12.8H20'),
    bank: sketchAreaSvg('#22b56b', '<path class="zwc-wash-fill" d="M3.5 9.5L12 4L20.5 9.5H3.5Z" fill="__WASH__"/><rect class="zwc-accent-fill" x="5.4" y="9.8" width="13.2" height="7.4" fill="#f5b82e"/><rect class="zwc-wash-fill" x="4" y="17.2" width="16" height="2.4" fill="__WASH__"/>', 'M3.5 9.5L12 4L20.5 9.5H3.5ZM4 19.5H20M6.8 9.5V17M10.4 9.5V17M13.8 9.5V17M17.2 9.5V17'),
    gym: sketchAreaSvg('#ef4c4c', '<rect class="zwc-accent-fill" x="8" y="10.8" width="8" height="2.4" rx="0.8" fill="#2da4e8"/><circle class="zwc-wash-fill" cx="6.8" cy="12" r="3.4" fill="__WASH__"/><circle class="zwc-wash-fill" cx="17.2" cy="12" r="3.4" fill="__WASH__"/>', 'M2.8 12H21.2M5.5 7.8V16.2M8.2 9.2V14.8M15.8 9.2V14.8M18.5 7.8V16.2'),
    properties: sketchAreaSvg('#14b8a6', '<circle class="zwc-wash-fill" cx="8.8" cy="9.6" r="4.3" fill="__WASH__"/><path class="zwc-accent-fill" d="M12.2 11.4L19.6 18.8L17.4 20.6L11 14.2Z" fill="#f5b82e"/>', 'M12.4 11.6L19.8 19M17 16.2L15 18.2M19.2 18.4L17.2 20.4M12.8 9.4A4.2 4.2 0 1 1 4.4 9.4A4.2 4.2 0 0 1 12.8 9.4Z'),
    education: sketchAreaSvg('#5c7cfa', '<path class="zwc-wash-fill" d="M6.5 12V16.6C6.5 18.1 9 19.4 12 19.4C15 19.4 17.5 18.1 17.5 16.6V12H6.5Z" fill="#3b82f6"/><path class="zwc-wash-fill" d="M3.2 9.5L12 4.8L20.8 9.5L12 14.2L3.2 9.5Z" fill="__WASH__"/><circle class="zwc-accent-fill" cx="19.6" cy="14.2" r="1.5" fill="#f5b82e"/>', 'M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5ZM6.5 12V16.6C6.5 18.1 9 19.4 12 19.4C15 19.4 17.5 18.1 17.5 16.6V12'),
    crimes: sketchAreaSvg('#e63946', '<circle class="zwc-wash-fill" cx="12" cy="12" r="6.8" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="12" r="2.8" fill="#f5b82e"/>', 'M19 12A7 7 0 1 1 5 12A7 7 0 0 1 19 12ZM12 3V6.5M12 17.5V21M3 12H6.5M17.5 12H21M12 12H12.02'),
    missions: sketchAreaSvg('#f59e0b', '<rect class="zwc-wash-fill" x="6" y="4.8" width="12" height="15" rx="1.8" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="11.2" r="3.4" fill="#22b56b"/>', 'M6 4.8H18V19.8H6V4.8ZM9 10.8L11.2 13L15.4 8.8M9 15.8H15'),
    newspaper: sketchAreaSvg('#f5b82e', '<rect class="zwc-wash-fill" x="4.5" y="5" width="15.5" height="14.2" rx="1.5" fill="__WASH__"/><rect class="zwc-accent-fill" x="5" y="5.4" width="12.2" height="4" fill="#2da4e8"/>', 'M4.5 5H17.5V19.2H4.5V5ZM17.5 8.5H20V18C20 18.7 19.4 19.2 18.7 19.2H17.5M7.5 8.8H14.5M7.5 12.2H14.5M7.5 15.5H12.5'),
    jail: sketchAreaSvg('#688cb8', '<rect class="zwc-wash-fill" x="4.5" y="4.5" width="15" height="15" rx="1.4" fill="__WASH__"/><rect class="zwc-accent-fill" x="9.6" y="9.8" width="4.8" height="4.4" rx="0.9" fill="#f59e0b"/>', 'M4.5 4.5H19.5V19.5H4.5V4.5ZM8.2 4.5V19.5M12 4.5V19.5M15.8 4.5V19.5M4.5 9.5H19.5M4.5 14.5H19.5'),
    hospital: sketchAreaSvg('#2da4e8', '<rect class="zwc-wash-fill" x="5" y="4.8" width="14" height="14.4" rx="2" fill="__WASH__"/><path class="zwc-accent-fill" d="M10.4 7.6H13.6V10.4H16.4V13.6H13.6V16.4H10.4V13.6H7.6V10.4H10.4V7.6Z" fill="#e63946"/>', 'M12 7.2V16.8M7.2 12H16.8M5 4.8H19V19.2H5V4.8Z'),
    casino: sketchAreaSvg('#a855f7', '<rect class="zwc-wash-fill" x="5" y="5" width="14" height="14" rx="2.6" fill="__WASH__"/><circle class="zwc-accent-fill" cx="8.8" cy="8.8" r="1.4" fill="#fde047"/><circle class="zwc-accent-fill" cx="15.2" cy="8.8" r="1.4" fill="#fde047"/><circle class="zwc-accent-fill" cx="12" cy="12" r="1.4" fill="#fde047"/><circle class="zwc-accent-fill" cx="8.8" cy="15.2" r="1.4" fill="#fde047"/><circle class="zwc-accent-fill" cx="15.2" cy="15.2" r="1.4" fill="#fde047"/>', 'M5 5H19V19H5V5Z'),
    hof: sketchAreaSvg('#f5b82e', '<path class="zwc-wash-fill" d="M7.2 4.5H16.8V9.8C16.8 12.5 14.6 14.6 12 14.6C9.4 14.6 7.2 12.5 7.2 9.8V4.5Z" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="9.2" r="2.1" fill="#e63946"/>', 'M7.2 4.5H16.8V9.8C16.8 12.5 14.6 14.6 12 14.6C9.4 14.6 7.2 12.5 7.2 9.8V4.5ZM12 14.6V18.8M8.2 19.8H15.8M7.2 6.5H4.5V8.8C4.5 10.2 5.6 11.2 7.2 11.2M16.8 6.5H19.5V8.8C19.5 10.2 18.4 11.2 16.8 11.2'),
    faction: sketchAreaSvg('#3b82f6', '<path class="zwc-wash-fill" d="M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M8.8 13.8L9.8 9.6L12 11.6L14.2 9.6L15.2 13.8H8.8Z" fill="#f5b82e"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8Z'),
    elimination: sketchAreaSvg('#ea7234', '<path class="zwc-wash-fill" d="M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8Z" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="12.2" r="3" fill="#e63946"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8ZM9.2 9.6L14.8 15.2M14.8 9.6L9.2 15.2'),
    attack: sketchAreaSvg('#f43f6e', '<circle class="zwc-wash-fill" cx="12" cy="12" r="6.8" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="12" r="2.8" fill="#f5b82e"/>', 'M5.2 18.8L18.8 5.2M14.2 5.2H18.8V9.8M5.2 14.2L9.8 18.8'),
    market: sketchAreaSvg('#f5b82e', '<rect class="zwc-wash-fill" x="5.2" y="9.5" width="13.6" height="10" fill="__WASH__"/><path class="zwc-accent-fill" d="M4.2 9.5L6 4.8H18L19.8 9.5H4.2Z" fill="#e63946"/><rect class="zwc-accent-fill" x="9.8" y="14.5" width="4.4" height="5" fill="#22b56b"/>', 'M4.2 9.5L6 4.8H18L19.8 9.5M5.2 9.5V19.5H18.8V9.5M9.8 19.5V14.5H14.2V19.5'),
    account: sketchAreaSvg('#2da4e8', '<circle class="zwc-wash-fill" cx="12" cy="8.6" r="3.6" fill="__WASH__"/><path class="zwc-accent-fill" d="M5.5 19.5C6.4 16.2 8.8 14.6 12 14.6C15.2 14.6 17.6 16.2 18.5 19.5H5.5Z" fill="#f59e0b"/>', 'M12 12.2A3.6 3.6 0 1 0 12 5A3.6 3.6 0 0 0 12 12.2ZM5.5 19.5C6.4 16.2 8.8 14.6 12 14.6C15.2 14.6 17.6 16.2 18.5 19.5')
  };

  /* Vibrant Hand-Inked Gouache Icons for Market Items, Item Inspector Stage, Education & Jobs */
  var SKETCH_ITEM_ICONS = {
    rifle: sketchAreaSvg('#ea7234', '<path class="zwc-wash-fill" d="M3 10.5H15.5L17.5 13H13.5L12.5 16.5H10L10.5 13H6.5L4.5 16H2.5L3 10.5Z" fill="__WASH__"/><rect class="zwc-accent-fill" x="15" y="10.2" width="6.2" height="2" rx="0.6" fill="#3b82f6"/><rect class="zwc-accent-fill" x="8" y="8" width="4.8" height="2" rx="0.6" fill="#f5b82e"/>', 'M2.8 10.6H21.2M15.4 10.6L17.2 13H13.4L12.4 17H9.8L10.4 13H6.4L4.4 16.2H2.5L3 10.6M8.2 8.2H12.8V10.6H8.2V8.2Z'),
    shotgun: sketchAreaSvg('#b85233', '<path class="zwc-wash-fill" d="M2.6 11.4H16.4V13.8H11.2L9.2 16.4H5.2L6.8 13.8H2.6V11.4Z" fill="__WASH__"/><rect class="zwc-accent-fill" x="15.8" y="10.4" width="5.6" height="2.2" rx="0.6" fill="#688cb8"/><rect class="zwc-accent-fill" x="10.2" y="13.4" width="5" height="1.8" rx="0.6" fill="#f5b82e"/>', 'M2.6 11.2H21.4M16 10.2H21.4V12.6H16M2.6 11.2V13.8H7L5 16.6H9.2L11.2 13.8H16.4V11.2M10.4 13.8H15.2'),
    pistol: sketchAreaSvg('#3b82f6', '<path class="zwc-wash-fill" d="M4.2 8.4H19.4V12.4H11.6L10.2 18.2H6.4L8.2 12.4H4.2V8.4Z" fill="__WASH__"/><rect class="zwc-accent-fill" x="5.8" y="8.8" width="12.2" height="2.4" fill="#f5b82e"/>', 'M4.2 8.4H19.6V12.4H11.6L10.2 18.2H6.4L8.2 12.4H4.2V8.4ZM11.6 12.4C11.6 14.2 13.2 14.6 14 13.4'),
    melee: sketchAreaSvg('#e63946', '<path class="zwc-wash-fill" d="M18.6 4.4L19.6 5.4L10.8 14.2L8.4 11.8L18.6 4.4Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M7.6 11.2L12.8 16.4L11.4 17.8L9.6 16L6.2 19.4L4.6 17.8L8 14.4L6.2 12.6L7.6 11.2Z" fill="#f5b82e"/>', 'M19.4 4.6L10.6 13.8M19.4 4.6L14.2 5.4L8.4 11.6M7.4 11L13 16.6M8.8 14.6L5 18.4L6.2 19.6L10 15.8'),
    medical: sketchAreaSvg('#2da4e8', '<rect class="zwc-wash-fill" x="3.8" y="6.8" width="16.4" height="12.6" rx="2.4" fill="__WASH__"/><path class="zwc-accent-fill" d="M10.4 9.2H13.6V11.6H16V14.8H13.6V17.2H10.4V14.8H8V11.6H10.4V9.2Z" fill="#e63946"/>', 'M9 6.8V5C9 4.2 9.6 3.6 10.4 3.6H13.6C14.4 3.6 15 4.2 15 5V6.8M3.8 6.8H20.2V19.4H3.8V6.8ZM12 9.6V16.8M8.4 13.2H15.6'),
    armor: sketchAreaSvg('#3b82f6', '<path class="zwc-wash-fill" d="M12 3.4L19.4 6.4V12C19.4 16.4 16.2 19.5 12 20.8C7.8 19.5 4.6 16.4 4.6 12V6.4L12 3.4Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M12 6.4L16.4 8.2V11.8C16.4 14.5 14.5 16.5 12 17.5C9.5 16.5 7.6 14.5 7.6 11.8V8.2L12 6.4Z" fill="#f5b82e"/>', 'M12 3.4L19.4 6.4V12C19.4 16.4 16.2 19.5 12 20.8C7.8 19.5 4.6 16.4 4.6 12V6.4L12 3.4ZM12 7.5V16.5M8.5 11.5H15.5'),
    booster: sketchAreaSvg('#22b56b', '<path class="zwc-wash-fill" d="M9.4 4.4H14.6V8.4L18.2 15.6C18.8 17 17.8 19.4 16 19.4H8C6.2 19.4 5.2 17 5.8 15.6L9.4 8.4V4.4Z" fill="__WASH__"/><path class="zwc-accent-fill" d="M7.2 14.2H16.8L17.8 16.6C18 17.8 17.1 19 15.8 19H8.2C6.9 19 6 17.8 6.2 16.6L7.2 14.2Z" fill="#f5b82e"/>', 'M8.5 4.2H15.5M9.6 4.2V8.6L5.8 15.8C5.2 17.2 6.2 19.4 8 19.4H16C17.8 19.4 18.8 17.2 18.2 15.8L14.4 8.6V4.2M7.6 14H16.4'),
    biology: sketchAreaSvg('#22b56b', '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.4" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="12" r="3" fill="#e63946"/>', 'M12 4.6A7.4 7.4 0 1 0 12 19.4A7.4 7.4 0 1 0 12 4.6ZM12 8.8A3.2 3.2 0 1 0 12 15.2A3.2 3.2 0 1 0 12 8.8ZM6.5 7.5L9.5 10M17.5 16.5L14.5 14M17.5 7.5L14.5 10M6.5 16.5L9.5 14'),
    sports: sketchAreaSvg('#ef4c4c', '<rect class="zwc-accent-fill" x="7.8" y="10.8" width="8.4" height="2.4" rx="0.8" fill="#2da4e8"/><rect class="zwc-wash-fill" x="4.2" y="7.4" width="3.8" height="9.2" rx="1" fill="__WASH__"/><rect class="zwc-wash-fill" x="16" y="7.4" width="3.8" height="9.2" rx="1" fill="__WASH__"/>', 'M2.2 12H4.2M19.8 12H21.8M8 12H16M4.2 7.4H8V16.6H4.2V7.4ZM16 7.4H19.8V16.6H16V7.4Z'),
    law: sketchAreaSvg('#f5b82e', '<rect class="zwc-wash-fill" x="9.6" y="4.2" width="7.2" height="4.4" rx="1" transform="rotate(35 13.2 6.4)" fill="__WASH__"/><rect class="zwc-accent-fill" x="4.2" y="17.2" width="11.6" height="2.8" rx="0.8" fill="#ea7234"/>', 'M10.4 4.2L17.4 9.2L15 12.6L8 7.6L10.4 4.2ZM11.8 10.6L6.4 17.2M4.2 17.4H16V20H4.2V17.4Z'),
    business: sketchAreaSvg('#2da4e8', '<rect class="zwc-wash-fill" x="4.5" y="13" width="3.6" height="6.6" rx="0.7" fill="#22b56b"/><rect class="zwc-wash-fill" x="10.2" y="9.4" width="3.6" height="10.2" rx="0.7" fill="__WASH__"/><rect class="zwc-accent-fill" x="15.9" y="5.6" width="3.6" height="14" rx="0.7" fill="#f5b82e"/>', 'M3.2 19.6H20.8M4.5 13H8.1V19.6H4.5V13ZM10.2 9.4H13.8V19.6H10.2V9.4ZM15.9 5.6H19.5V19.6H15.9V5.6ZM4.8 10.2L10.4 6.6L16.2 4.2'),
    tech: sketchAreaSvg('#5c7cfa', '<rect class="zwc-wash-fill" x="5.4" y="5.4" width="13.2" height="13.2" rx="2" fill="__WASH__"/><rect class="zwc-accent-fill" x="9" y="9" width="6" height="6" rx="1" fill="#f5b82e"/>', 'M5.4 5.4H18.6V18.6H5.4V5.4ZM9 9H15V15H9V9ZM9 2.6V5.4M15 2.6V5.4M9 18.6V21.4M15 18.6V21.4M2.6 9H5.4M2.6 15H5.4M18.6 9H21.4M18.6 15H21.4'),
    grocer: sketchAreaSvg('#22b56b', '<rect class="zwc-wash-fill" x="4.6" y="10" width="14.8" height="9.6" rx="1.2" fill="#f5b82e"/><path class="zwc-accent-fill" d="M3.6 5H20.4L21.4 10H2.6L3.6 5Z" fill="#e63946"/><rect class="zwc-accent-fill" x="9.6" y="14" width="4.8" height="5.6" fill="__WASH__"/>', 'M3.6 5H20.4L21.4 10H2.6L3.6 5ZM4.6 10V19.6H19.4V10M9.6 19.6V14H14.4V19.6'),
    army: sketchAreaSvg('#6c8c3c', '<path class="zwc-wash-fill" d="M12 3.8L14.4 8.8L19.8 9.6L15.8 13.4L16.8 18.8L12 16.2L7.2 18.8L8.2 13.4L4.2 9.6L9.6 8.8L12 3.8Z" fill="__WASH__"/><circle class="zwc-accent-fill" cx="12" cy="12" r="2.4" fill="#f5b82e"/>', 'M12 3.8L14.4 8.8L19.8 9.6L15.8 13.4L16.8 18.8L12 16.2L7.2 18.8L8.2 13.4L4.2 9.6L9.6 8.8L12 3.8Z')
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

  function resolveRecordIconKey(titleText) {
    var s = String(titleText || '').toLowerCase();
    if (/bio|med|health|doctor|nurse|أحياء|طب|صح/.test(s)) return 'biology';
    if (/sport|gym|fitness|combat|fight|رياض|لياق|قتال/.test(s)) return 'sports';
    if (/law|legal|crim|judge|قانون|جنائ|محام/.test(s)) return 'law';
    if (/busi|econ|finan|bank|market|تجار|أعمال|اقتصاد|مال/.test(s)) return 'business';
    if (/comp|tech|cyber|hack|code|science|حاسوب|تقني|برمج/.test(s)) return 'tech';
    if (/grocer|shop|store|clerk|بقال|متجر/.test(s)) return 'grocer';
    if (/casino|dealer|card|كازينو|موزع/.test(s)) return 'casino';
    if (/army|military|guard|secur|جيش|عسكر|أمن/.test(s)) return 'army';
    if (/edu|teach|univ|school|تعليم|أكاديم/.test(s)) return 'education';
    return 'jobs';
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

  /* 0. Keep watercolor-sketchbook.css after runtime-injected <style> tags */
  function ensureStylesheetLast() {
    var head = document.head;
    if (!head) return;
    var link = head.querySelector('link[href*="watercolor-sketchbook.css"]');
    if (!link) return;
    var sibling = link.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === 'STYLE' || sibling.tagName === 'LINK') {
        head.appendChild(link);
        break;
      }
      sibling = sibling.nextElementSibling;
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

  /* 3. Sync Sidebar & Quick-Action Hand-Inked Watercolor Icons + Arcade Watercolor Art */
  function syncSketchIconsAndArt() {
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

    /* Education & Jobs Hand-Inked Medallions (replaces harsh dark-mode black squares on Light cream) */
    var recordArts = document.querySelectorAll(
      '#zone-main[data-zone-screen="education"] .zone-record-art, #zone-main[data-zone-screen="jobs"] .zone-record-art, #zone-main[data-zone-screen="job"] .zone-record-art'
    );
    for (var ri = 0; ri < recordArts.length; ri++) {
      var rArt = recordArts[ri];
      var rRow = rArt.closest('article, .zone-current-record, header');
      var rTitleEl = rRow ? rRow.querySelector('h2, h3') : null;
      var rKey = resolveRecordIconKey(rTitleEl ? rTitleEl.textContent : '');
      var rSvg = rArt.querySelector('svg.zwc-sketch-ico');
      if (!rSvg || rSvg.getAttribute('data-zwc-rec-ico') !== rKey) {
        if (rSvg) rSvg.remove();
        var rTmp = document.createElement('div');
        rTmp.innerHTML = SKETCH_ITEM_ICONS[rKey] || SKETCH_AREA_ICONS[rKey] || SKETCH_AREA_ICONS.jobs;
        var nextRecSvg = rTmp.firstElementChild;
        if (nextRecSvg) {
          nextRecSvg.setAttribute('data-zwc-rec-ico', rKey);
          nextRecSvg.setAttribute('data-zwc-ink', rKey);
          rArt.setAttribute('data-zwc-enhanced', '1');
          rArt.appendChild(nextRecSvg);
        }
      }
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
          if (window.ZoneGameFX && typeof window.ZoneGameFX.syncWebglIframeThrottle === 'function') {
            window.ZoneGameFX.syncWebglIframeThrottle();
          }
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            try {
              window.dispatchEvent(new Event('resize'));
              var mapFrame = shell.querySelector('iframe#zone-city-map');
              if (mapFrame && mapFrame.contentWindow) {
                mapFrame.contentWindow.dispatchEvent(new Event('resize'));
              }
            } catch (_) {}
          }, 90);
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
          ensureStylesheetLast();
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

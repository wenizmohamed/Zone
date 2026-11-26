/* ==========================================================================
 * ZONE v135 - HAND-DRAWN SKETCHBOOK TOPBAR, DRAWER & MOBILE SHELL RUNTIME
 * 100% 4-Way Parity: Light+EN, Dark+EN, Light+AR (RTL), Dark+AR (RTL)
 * Exclusive Ownership: mobile-shell (aaa-topbar-sidebar.css / .js)
 * Scope: .zone-topbar, [data-zheaderbar], #zone-topbar-hud,
 *        #zaaa-mobile-rail-toggle, #zaaa-drawer-backdrop, #zaaa-drawer-header,
 *        aside.zone-sidebar, #zone-operative-crest, .zone-mobile-tabbar
 * Guardrails: Idempotent, React-18/<x-dc> fiber-safe (append-only + CSS order),
 *             respects [data-zwc-icon="1"] / [data-zwc-ink] from watercolor-sketchbook.js,
 *             rAF-coalesced observers, zero network calls, zero console errors.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaTopbarSidebarLoaded) return;
  window.__zoneAaaTopbarSidebarLoaded = true;

  var isSyncing = false;
  var rafPending = false;
  var svgParserHost = null;
  var lastObservedNavOpen = 'false';

  /* ------------------------------------------------------------------------
   * 1. SOVEREIGN NOIR-GOLD & METALLIC ARCHITECTURAL EMBLEM CATALOG (v168)
   *    Precision chamfered escutcheons, multi-stop 24K champagne-brass,
   *    emerald-bullion, ruby-clearcoat & brushed-platinum vector crests.
   *    Zero cartoon crayon blobs, zero stick-person icons.
   * ------------------------------------------------------------------------ */
  var SOVEREIGN_GRADS =
    '<defs>' +
      '<linearGradient id="zsv-gold" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fef08a"/>' +
        '<stop offset="48%" stop-color="#f3c969"/>' +
        '<stop offset="100%" stop-color="#a16207"/>' +
      '</linearGradient>' +
      '<linearGradient id="zsv-emerald" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#6ee7b7"/>' +
        '<stop offset="50%" stop-color="#10b981"/>' +
        '<stop offset="100%" stop-color="#065f46"/>' +
      '</linearGradient>' +
      '<linearGradient id="zsv-ruby" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fda4af"/>' +
        '<stop offset="50%" stop-color="#f43f5e"/>' +
        '<stop offset="100%" stop-color="#881337"/>' +
      '</linearGradient>' +
      '<linearGradient id="zsv-cyan" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#a5f3fc"/>' +
        '<stop offset="50%" stop-color="#38bdf8"/>' +
        '<stop offset="100%" stop-color="#0369a1"/>' +
      '</linearGradient>' +
      '<linearGradient id="zsv-steel" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#f8fafc"/>' +
        '<stop offset="52%" stop-color="#cbd5e1"/>' +
        '<stop offset="100%" stop-color="#475569"/>' +
      '</linearGradient>' +
      '<linearGradient id="zsv-plate" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#262320"/>' +
        '<stop offset="100%" stop-color="#12100e"/>' +
      '</linearGradient>' +
    '</defs>';

  var PLATE_HEX = '<polygon points="12,1.8 20.8,6.6 20.8,17.4 12,22.2 3.2,17.4 3.2,6.6" fill="url(#zsv-plate)" stroke="url(#zsv-gold)" stroke-width="1.15" stroke-opacity="0.72"/>';

  var SKETCH_ICONS = {
    home: {
      wash: PLATE_HEX + '<path d="M6.2 11.2L12 6.2L17.8 11.2V17.6H13.8V13.4H10.2V17.6H6.2V11.2Z" fill="url(#zsv-gold)" fill-opacity="0.26"/>',
      ink: '<path d="M5.2 11.4L12 5.6L18.8 11.4M6.8 10.6V17.6H17.2V10.6M10.4 17.6V13.4H13.6V17.6" stroke="url(#zsv-gold)" stroke-width="1.55"/>'
    },
    items: {
      wash: PLATE_HEX + '<polygon points="12,5.4 18,8.6 18,15.4 12,18.6 6,15.4 6,8.6" fill="url(#zsv-gold)" fill-opacity="0.24"/>',
      ink: '<polygon points="12,5.4 18,8.6 18,15.4 12,18.6 6,15.4 6,8.6" stroke="url(#zsv-gold)" stroke-width="1.45"/><path d="M6,8.6L12,11.8L18,8.6M12,11.8V18.6" stroke="url(#zsv-steel)" stroke-width="1.35"/>'
    },
    city: {
      wash: PLATE_HEX + '<path d="M6.2 17.4V9.6L10 7.8V17.4H6.2ZM10 17.4V5.8L14.4 7.4V17.4H10ZM14.4 17.4V10.8L17.8 12V17.4H14.4Z" fill="url(#zsv-cyan)" fill-opacity="0.28"/>',
      ink: '<path d="M5.4 17.4H18.6M6.4 17.4V9.6L10 7.8V17.4M10 5.8L14.4 7.4V17.4M14.4 10.8L17.8 12V17.4M12 9.4H12.4M12 12.2H12.4" stroke="url(#zsv-cyan)" stroke-width="1.45"/>'
    },
    jobs: {
      wash: PLATE_HEX + '<rect x="6" y="8.4" width="12" height="8.8" rx="1.4" fill="url(#zsv-gold)" fill-opacity="0.22"/>',
      ink: '<rect x="6" y="8.4" width="12" height="8.8" rx="1.4" stroke="url(#zsv-gold)" stroke-width="1.45"/><path d="M9.4 8.4V6.8C9.4 6.1 9.9 5.6 10.6 5.6H13.4C14.1 5.6 14.6 6.1 14.6 6.8V8.4M6 12.4H18M11.2 12.4H12.8" stroke="url(#zsv-steel)" stroke-width="1.35"/>'
    },
    gym: {
      wash: PLATE_HEX + '<rect x="6" y="8.2" width="2.6" height="7.6" rx="0.8" fill="url(#zsv-emerald)"/><rect x="15.4" y="8.2" width="2.6" height="7.6" rx="0.8" fill="url(#zsv-emerald)"/>',
      ink: '<path d="M4.6 12H19.4M6.2 8.2H8.6V15.8H6.2V8.2ZM15.4 8.2H17.8V15.8H15.4V8.2Z" stroke="url(#zsv-emerald)" stroke-width="1.45"/>'
    },
    properties: {
      wash: PLATE_HEX + '<path d="M6.6 17.4V6.4L13.2 4.8V17.4H6.6ZM13.2 10.2L17.4 11.4V17.4H13.2V10.2Z" fill="url(#zsv-emerald)" fill-opacity="0.25"/>',
      ink: '<path d="M5.6 17.4H18.4M6.8 17.4V6.4L13.2 5V17.4M13.2 10.2L17.4 11.4V17.4M9.4 8.8H11M9.4 11.8H11M9.4 14.6H11" stroke="url(#zsv-gold)" stroke-width="1.45"/>'
    },
    education: {
      wash: PLATE_HEX + '<circle cx="12" cy="11.6" r="4.8" fill="url(#zsv-cyan)" fill-opacity="0.22"/>',
      ink: '<circle cx="12" cy="11.6" r="4.8" stroke="url(#zsv-gold)" stroke-width="1.4"/><ellipse cx="12" cy="11.6" rx="2.2" ry="4.8" stroke="url(#zsv-cyan)" stroke-width="1.25"/><path d="M7.2 11.6H16.8M9.2 17.6H14.8M12 16.4V17.6" stroke="url(#zsv-gold)" stroke-width="1.4"/>'
    },
    crimes: {
      wash: PLATE_HEX + '<circle cx="12" cy="12" r="5.4" fill="url(#zsv-ruby)" fill-opacity="0.24"/>',
      ink: '<circle cx="12" cy="12" r="5.4" stroke="url(#zsv-ruby)" stroke-width="1.45"/><circle cx="12" cy="12" r="1.8" fill="url(#zsv-gold)"/><path d="M12 4.8V7.4M12 16.6V19.2M4.8 12H7.4M16.6 12H19.2" stroke="url(#zsv-gold)" stroke-width="1.4"/>'
    },
    missions: {
      wash: PLATE_HEX + '<rect x="6.8" y="5.8" width="10.4" height="12.4" rx="1.4" fill="url(#zsv-gold)" fill-opacity="0.22"/>',
      ink: '<rect x="6.8" y="5.8" width="10.4" height="12.4" rx="1.4" stroke="url(#zsv-gold)" stroke-width="1.45"/><path d="M9.4 11.8L11.2 13.6L14.8 9.8M9.4 15.4H14.6" stroke="url(#zsv-emerald)" stroke-width="1.5"/>'
    },
    newspaper: {
      wash: PLATE_HEX + '<rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.4" fill="url(#zsv-steel)" fill-opacity="0.2"/>',
      ink: '<rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.4" stroke="url(#zsv-gold)" stroke-width="1.4"/><path d="M8.6 9.4H15.4M8.6 12.2H15.4M8.6 15H12.6" stroke="url(#zsv-steel)" stroke-width="1.4"/>'
    },
    jail: {
      wash: PLATE_HEX + '<rect x="6.4" y="6.2" width="11.2" height="11.6" rx="1.2" fill="url(#zsv-steel)" fill-opacity="0.18"/>',
      ink: '<rect x="6.4" y="6.2" width="11.2" height="11.6" rx="1.2" stroke="url(#zsv-steel)" stroke-width="1.4"/><path d="M9.6 6.2V17.8M12 6.2V17.8M14.4 6.2V17.8M6.4 11.8H17.6" stroke="url(#zsv-gold)" stroke-width="1.35"/>'
    },
    hospital: {
      wash: PLATE_HEX + '<polygon points="12,5.4 17.6,8.2 17.6,13.6 12,18.4 6.4,13.6 6.4,8.2" fill="url(#zsv-ruby)" fill-opacity="0.24"/>',
      ink: '<polygon points="12,5.4 17.6,8.2 17.6,13.6 12,18.4 6.4,13.6 6.4,8.2" stroke="url(#zsv-emerald)" stroke-width="1.4"/><path d="M12 8.8V14.8M9 11.8H15" stroke="url(#zsv-ruby)" stroke-width="1.85"/>'
    },
    casino: {
      wash: PLATE_HEX + '<circle cx="12" cy="12" r="5.6" fill="url(#zsv-ruby)" fill-opacity="0.28"/>',
      ink: '<circle cx="12" cy="12" r="5.6" stroke="url(#zsv-gold)" stroke-width="1.45"/><polygon points="12,8.4 15.2,12 12,15.6 8.8,12" fill="url(#zsv-gold)"/>'
    },
    hof: {
      wash: PLATE_HEX + '<path d="M8 6.2H16V10.2C16 12.6 14.2 14.4 12 14.4C9.8 14.4 8 12.6 8 10.2V6.2Z" fill="url(#zsv-gold)" fill-opacity="0.32"/>',
      ink: '<path d="M8 6.2H16V10.2C16 12.6 14.2 14.4 12 14.4C9.8 14.4 8 12.6 8 10.2V6.2ZM12 14.4V17.4M9.2 17.6H14.8" stroke="url(#zsv-gold)" stroke-width="1.5"/>'
    },
    faction: {
      wash: PLATE_HEX + '<path d="M12 5.2L17.6 7.6V12.2C17.6 15.6 15.2 18 12 19.2C8.8 18 6.4 15.6 6.4 12.2V7.6L12 5.2Z" fill="url(#zsv-gold)" fill-opacity="0.24"/>',
      ink: '<path d="M12 5.2L17.6 7.6V12.2C17.6 15.6 15.2 18 12 19.2C8.8 18 6.4 15.6 6.4 12.2V7.6L12 5.2ZM9.4 13.6L10.2 10L12 11.8L13.8 10L14.6 13.6H9.4Z" stroke="url(#zsv-gold)" stroke-width="1.45"/>'
    },
    elimination: {
      wash: PLATE_HEX + '<circle cx="12" cy="12" r="5.4" fill="url(#zsv-ruby)" fill-opacity="0.26"/>',
      ink: '<circle cx="12" cy="12" r="5.4" stroke="url(#zsv-ruby)" stroke-width="1.45"/><path d="M9.2 9.2L14.8 14.8M14.8 9.2L9.2 14.8" stroke="url(#zsv-gold)" stroke-width="1.55"/>'
    },
    bank: {
      wash: PLATE_HEX + '<path d="M5.6 9.8L12 5.8L18.4 9.8H5.6Z" fill="url(#zsv-gold)" fill-opacity="0.32"/>',
      ink: '<path d="M5.6 9.8L12 5.8L18.4 9.8H5.6ZM7.6 9.8V16.2M10.6 9.8V16.2M13.4 9.8V16.2M16.4 9.8V16.2M5.8 16.4H18.2" stroke="url(#zsv-emerald)" stroke-width="1.45"/>'
    },
    market: {
      wash: PLATE_HEX + '<path d="M6.4 9.6L7.8 6.2H16.2L17.6 9.6V17.2H6.4V9.6Z" fill="url(#zsv-gold)" fill-opacity="0.22"/>',
      ink: '<path d="M6.4 9.6L7.8 6.2H16.2L17.6 9.6M6.8 9.6V17.2H17.2V9.6M10.4 17.2V13.4H13.6V17.2" stroke="url(#zsv-gold)" stroke-width="1.45"/>'
    },
    attack: {
      wash: PLATE_HEX + '<polygon points="12,5.2 18.8,12 12,18.8 5.2,12" fill="url(#zsv-ruby)" fill-opacity="0.26"/>',
      ink: '<path d="M7.2 16.8L16.8 7.2M13.6 7.2H16.8V10.4M16.8 16.8L7.2 7.2M10.4 7.2H7.2V10.4" stroke="url(#zsv-gold)" stroke-width="1.5"/>'
    },
    cash: {
      wash: '<rect x="2.6" y="6" width="18.8" height="12" rx="2" fill="url(#zsv-plate)" stroke="url(#zsv-emerald)" stroke-width="1.35"/>',
      ink: '<circle cx="12" cy="12" r="2.8" fill="url(#zsv-emerald)"/><path d="M5.8 9.2H6.4M17.6 14.8H18.2" stroke="url(#zsv-gold)" stroke-width="1.5"/>'
    },
    energy: {
      wash: '<polygon points="13.2,2.6 5.8,12.8 11.4,12.8 10.6,21.4 18.2,11.2 12.6,11.2" fill="url(#zsv-emerald)"/>',
      ink: '<polygon points="13.2,2.6 5.8,12.8 11.4,12.8 10.6,21.4 18.2,11.2 12.6,11.2" stroke="#ecfdf5" stroke-width="0.9"/>'
    },
    nerve: {
      wash: '<path d="M12 3.2C15.6 6.8 18 9.8 18 13.6C18 17.2 15.3 20 12 20C8.7 20 6 17.2 6 13.6C6 10.6 7.8 8 9.8 5.8L10.8 9L12 3.2Z" fill="url(#zsv-ruby)"/>',
      ink: '<circle cx="12" cy="14.6" r="2.1" fill="url(#zsv-gold)"/>'
    },
    life: {
      wash: '<path d="M12 19.6C7 16 4 12.6 4 9.2C4 6.6 6 4.8 8.4 4.8C10 4.8 11.3 5.6 12 6.8C12.7 5.6 14 4.8 15.6 4.8C18 4.8 20 6.6 20 9.2C20 12.6 17 16 12 19.6Z" fill="url(#zsv-ruby)"/>',
      ink: '<path d="M8.2 11.8H10.4L11.4 9.8L12.6 13.8L13.6 11.8H15.8" stroke="#fff1f2" stroke-width="1.35"/>'
    },
    account: {
      wash: PLATE_HEX + '<circle cx="12" cy="9.2" r="2.9" fill="url(#zsv-gold)"/><path d="M6.8 17.4C7.8 14.4 9.6 13.2 12 13.2C14.4 13.2 16.2 14.4 17.2 17.4H6.8Z" fill="url(#zsv-steel)" fill-opacity="0.45"/>',
      ink: '<circle cx="12" cy="9.2" r="2.9" stroke="url(#zsv-gold)" stroke-width="1.2"/><path d="M6.8 17.4C7.8 14.4 9.6 13.2 12 13.2C14.4 13.2 16.2 14.4 17.2 17.4" stroke="url(#zsv-gold)" stroke-width="1.35"/>'
    },
    admin: {
      wash: PLATE_HEX + '<rect x="6.4" y="6.8" width="11.2" height="10.4" rx="1.4" fill="url(#zsv-cyan)" fill-opacity="0.18"/>',
      ink: '<path d="M7.6 9.8H16.4M7.6 14.2H16.4" stroke="url(#zsv-steel)" stroke-width="1.4"/><circle cx="10.2" cy="9.8" r="1.6" fill="url(#zsv-gold)"/><circle cx="13.8" cy="14.2" r="1.6" fill="url(#zsv-emerald)"/>'
    },
    menu: {
      wash: PLATE_HEX,
      ink: '<path d="M7.2 8.6H16.8M7.2 12H16.8M7.2 15.4H16.8" stroke="url(#zsv-gold)" stroke-width="1.6"/>'
    },
    close: {
      wash: '',
      ink: '<path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="url(#zsv-gold)" stroke-width="1.8"/>'
    },
    chrono: {
      wash: PLATE_HEX,
      ink: '<circle cx="12" cy="12.4" r="5.4" stroke="url(#zsv-cyan)" stroke-width="1.4"/><path d="M12 9.4V12.4L14.2 13.8" stroke="url(#zsv-gold)" stroke-width="1.5"/>'
    },
    search: {
      wash: PLATE_HEX + '<circle cx="11" cy="11" r="4.3" fill="url(#zsv-gold)" fill-opacity="0.22"/>',
      ink: '<circle cx="11" cy="11" r="4.3" stroke="url(#zsv-gold)" stroke-width="1.55"/><path d="M14.2 14.2L17.8 17.8" stroke="url(#zsv-cyan)" stroke-width="1.75"/>'
    },
    bolt: {
      wash: PLATE_HEX + '<polygon points="13,5.2 7.6,12.6 11.6,12.6 10.8,18.8 16.4,11.4 12.4,11.4" fill="url(#zsv-gold)" fill-opacity="0.34"/>',
      ink: '<polygon points="13,5.2 7.6,12.6 11.6,12.6 10.8,18.8 16.4,11.4 12.4,11.4" stroke="url(#zsv-gold)" stroke-width="1.4"/>'
    },
    star: {
      wash: '',
      ink: '<polygon points="12,3.4 14.6,8.8 20.5,9.6 16.2,13.8 17.3,19.7 12,16.9 6.7,19.7 7.8,13.8 3.5,9.6 9.4,8.8" fill="url(#zsv-gold)" fill-opacity="0.28" stroke="url(#zsv-gold)" stroke-width="1.5"/>'
    },
    back: {
      wash: '',
      ink: '<path d="M15.2 6.2L9.2 12L15.2 17.8M9.6 12H18.4" stroke="url(#zsv-gold)" stroke-width="1.85"/>'
    },
    up: {
      wash: '',
      ink: '<path d="M6.4 14.2L12 8.4L17.6 14.2M12 8.8V18.2" stroke="url(#zsv-gold)" stroke-width="1.85"/>'
    }
  };

  function renderSketchIcon(iconKey, extraClass) {
    var key = SKETCH_ICONS[iconKey] ? iconKey : 'home';
    var spec = SKETCH_ICONS[key];
    var cls = 'zaaa-vivid-svg zaaa-duotone-svg zwc-sketch-ico' + (extraClass ? ' ' + extraClass : '');
    return (
      '<svg class="' + cls + '" data-zwc-ink="' + key + '" data-zwc-color="v168" viewBox="0 0 24 24" fill="none" ' +
      'stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        SOVEREIGN_GRADS +
        (spec.wash || '') +
        spec.ink +
      '</svg>'
    );
  }

  /* Precision Metallic Crescent & Solar Theme Icons */
  var THEME_SVGS =
    '<svg class="zaaa-vivid-svg zwc-sketch-ico zaaa-moon-svg" data-zwc-color="v168" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      SOVEREIGN_GRADS +
      '<path d="M19.4 13.8A7.4 7.4 0 1 1 10.2 4.6A5.8 5.8 0 0 0 19.4 13.8Z" fill="url(#zsv-gold)" stroke="url(#zsv-gold)"/>' +
    '</svg>' +
    '<svg class="zaaa-vivid-svg zwc-sketch-ico zaaa-sun-svg" data-zwc-color="v168" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      SOVEREIGN_GRADS +
      '<circle cx="12" cy="12" r="4.4" fill="url(#zsv-gold)" stroke="url(#zsv-gold)"/>' +
      '<path d="M12 3V5.2M12 18.8V21M5.6 5.6L7.2 7.2M16.8 16.8L18.4 18.4M3 12H5.2M18.8 12H21M5.6 18.4L7.2 16.8M16.8 7.2L18.4 5.6" stroke="url(#zsv-gold)"/>' +
    '</svg>';

  /* Sovereign Tactical Operative Crest (#zone-operative-crest) */
  var OPERATIVE_AVATAR_SVG =
    '<svg class="zaaa-vivid-svg zaaa-duotone-svg zwc-sketch-ico" data-zwc-color="v168" viewBox="0 0 36 36" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      SOVEREIGN_GRADS +
      '<polygon points="18,2 32,9.5 32,26.5 18,34 4,26.5 4,9.5" fill="url(#zsv-plate)" stroke="url(#zsv-gold)" stroke-width="1.5"/>' +
      '<path d="M18 7.6L23.2 11.4V16.8C23.2 19.8 20.9 22 18 22C15.1 22 12.8 19.8 12.8 16.8V11.4L18 7.6Z" fill="url(#zsv-steel)" fill-opacity="0.35" stroke="url(#zsv-gold)" stroke-width="1.35"/>' +
      '<rect x="14.2" y="13.2" width="7.6" height="2.4" rx="1" fill="url(#zsv-cyan)"/>' +
      '<path d="M8.6 28.4C10.2 24.2 13.6 22.4 18 22.4C22.4 22.4 25.8 24.2 27.4 28.4" fill="url(#zsv-gold)" fill-opacity="0.22" stroke="url(#zsv-gold)" stroke-width="1.45"/>' +
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

  var hudCache = {
    hudEl: null,
    cashSrcEl: null,
    energyTrackEl: null,
    energyFigEl: null,
    nerveTrackEl: null,
    nerveFigEl: null,
    lifeTrackEl: null,
    lifeFigEl: null,
    cashValEl: null,
    energyPillEl: null,
    energyValEl: null,
    nervePillEl: null,
    nerveValEl: null,
    lifePillEl: null,
    lifeValEl: null,
    cityCodeEl: null,
    cityValEl: null,
    timerEls: [],
    lastCash: '',
    lastEnergy: '',
    lastEnergyPct: -1,
    lastNerve: '',
    lastNervePct: -1,
    lastLife: '',
    lastLifePct: -1,
    lastCityCode: '',
    lastCityName: ''
  };

  /* ------------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------------ */
  function isArabic() {
    var html = document.documentElement;
    return html.lang === 'ar' || html.dir === 'rtl';
  }

  function isMobileViewport() {
    return (window.innerWidth || document.documentElement.clientWidth || 1024) <= 900;
  }

  function formatMoney(n, compact) {
    var val = Math.max(0, Math.round(Number(n) || 0));
    if (compact) {
      if (val >= 1000000000) return '$' + (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
      if (val >= 1000000) return '$' + (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (val >= 100000) return '$' + Math.round(val / 1000) + 'K';
    }
    return '$' + String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatInt(n) {
    var val = Math.max(0, Math.round(Number(n) || 0));
    return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function parseSvgElement(svgMarkup) {
    if (!svgParserHost) {
      svgParserHost = document.createElement('div');
    }
    svgParserHost.innerHTML = svgMarkup;
    return svgParserHost.firstElementChild || svgParserHost.firstChild;
  }

  function isDrawerOpen() {
    var root = document.documentElement;
    return Boolean(root && root.classList && root.classList.contains('zaaa-rail-open'));
  }

  function setMobileDrawerOpen(nextOpen) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    var open = Boolean(nextOpen) && isMobileViewport();
    if (open) {
      root.classList.add('zaaa-rail-open');
    } else {
      root.classList.remove('zaaa-rail-open');
      /* Keep React navOpen state clean if it had been toggled externally */
      var navArea = document.getElementById('zone-area-navigation');
      if (navArea && navArea.getAttribute('data-zone-nav-open') === 'true') {
        var nativeToggle = document.querySelector('.zone-topbar .zone-nav-toggle');
        if (nativeToggle && typeof nativeToggle.click === 'function') {
          lastObservedNavOpen = 'false';
          try { nativeToggle.click(); } catch (_) {}
        }
      }
    }
    updateDrawerTriggerAttributes();
  }

  function navigateToScreen(screenId) {
    if (isDrawerOpen()) {
      setMobileDrawerOpen(false);
    }
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
   * 2. DESKTOP HEADER LINKS (.zone-header-links)
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
        iconEl.innerHTML = renderSketchIcon(meta.key);
        btn.appendChild(iconEl);
      } else if (iconEl.getAttribute('data-ico') !== meta.key) {
        iconEl.innerHTML = renderSketchIcon(meta.key);
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
   * 3. UNIFIED LIVE SKETCHBOOK HUD CAPSULE (#zone-topbar-hud)
   *    Desktop (>900px): Cash, Energy, Nerve, City
   *    Mobile (<=900px): Compact 44px-tall Cash, Energy, Nerve (+ City >720px)
   * ------------------------------------------------------------------------ */
  function readBarFromCachedNodes(barId, fallbackMax, trackEl, figEl) {
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

    if (trackEl) {
      var nowAttr = Number(trackEl.getAttribute('aria-valuenow'));
      var maxAttr = Number(trackEl.getAttribute('aria-valuemax'));
      if (Number.isFinite(nowAttr) && Number.isFinite(maxAttr) && maxAttr > 0) {
        return {
          cur: Math.max(0, Math.round(nowAttr)),
          max: Math.max(1, Math.round(maxAttr)),
          pct: Math.max(0, Math.min(100, Math.round((nowAttr / maxAttr) * 100)))
        };
      }
    }

    if (figEl && figEl.textContent) {
      var m = figEl.textContent.replace(/,/g, '').match(/(\d+)\s*\/\s*(\d+)/);
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

  function readCashFromCachedNode(cashEl) {
    var compact = (window.innerWidth || 1024) <= 520;
    try {
      if (window.__zoneGame && window.__zoneGame.p && Number.isFinite(Number(window.__zoneGame.p.cash))) {
        return formatMoney(window.__zoneGame.p.cash, compact);
      }
    } catch (_) {}
    if (cashEl && cashEl.textContent && cashEl.textContent.trim()) {
      var raw = cashEl.textContent.trim();
      if (compact) {
        var digits = Number(raw.replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(digits) && digits >= 0) {
          return formatMoney(digits, true);
        }
      }
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
    hud.setAttribute('aria-label', isArabic() ? 'مؤشرات النقابة المباشرة' : 'Syndicate Live Telemetry');

    hud.innerHTML =
      '<button type="button" class="zaaa-hud-pill zaaa-hud-cash" data-hud="cash">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderSketchIcon('cash') + '</span>' +
        '<bdi class="zaaa-hud-val">$0</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-energy" data-hud="energy">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderSketchIcon('energy') + '</span>' +
        '<bdi class="zaaa-hud-val">100/100</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-nerve" data-hud="nerve">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderSketchIcon('nerve') + '</span>' +
        '<bdi class="zaaa-hud-val">15/15</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-life" data-hud="life">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderSketchIcon('life') + '</span>' +
        '<bdi class="zaaa-hud-val">100/100</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-city" data-hud="city">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderSketchIcon('city') + '</span>' +
        '<span class="zaaa-hud-city-code">ZCT</span>' +
        '<span class="zaaa-hud-val">Zone City</span>' +
      '</button>';

    var routeMap = {
      cash: 'bank',
      energy: 'gym',
      nerve: 'crimes',
      life: 'hospital',
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

    /* Append at end of [data-zheaderbar]; CSS order positions cleanly */
    headerBar.appendChild(hud);
    return hud;
  }

  function refreshHudDomCache(hud) {
    hudCache.hudEl = hud;
    hudCache.cashSrcEl = document.getElementById('zone-cash');
    hudCache.energyTrackEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="energy"] .zone-resource-track'
    );
    hudCache.energyFigEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="energy"] [data-zfig]'
    );
    hudCache.nerveTrackEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="nerve"] .zone-resource-track'
    );
    hudCache.nerveFigEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="nerve"] [data-zfig]'
    );
    hudCache.lifeTrackEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="life"] .zone-resource-track'
    );
    hudCache.lifeFigEl = document.querySelector(
      'aside.zone-sidebar .zone-resource[data-zone-resource="life"] [data-zfig]'
    );

    var cashPill = hud.querySelector('[data-hud="cash"]');
    var energyPill = hud.querySelector('[data-hud="energy"]');
    var nervePill = hud.querySelector('[data-hud="nerve"]');
    var lifePill = hud.querySelector('[data-hud="life"]');
    var cityPill = hud.querySelector('[data-hud="city"]');

    hudCache.cashValEl = cashPill ? cashPill.querySelector('.zaaa-hud-val') : null;
    hudCache.energyPillEl = energyPill;
    hudCache.energyValEl = energyPill ? energyPill.querySelector('.zaaa-hud-val') : null;
    hudCache.nervePillEl = nervePill;
    hudCache.nerveValEl = nervePill ? nervePill.querySelector('.zaaa-hud-val') : null;
    hudCache.lifePillEl = lifePill;
    hudCache.lifeValEl = lifePill ? lifePill.querySelector('.zaaa-hud-val') : null;
    hudCache.cityCodeEl = cityPill ? cityPill.querySelector('.zaaa-hud-city-code') : null;
    hudCache.cityValEl = cityPill ? cityPill.querySelector('.zaaa-hud-val') : null;

    var ar = isArabic();
    var regionLabel = ar ? 'مؤشرات النقابة المباشرة' : 'Syndicate Live Telemetry';
    if (hud.getAttribute('aria-label') !== regionLabel) {
      hud.setAttribute('aria-label', regionLabel);
    }
    if (cashPill) cashPill.title = ar ? 'النقد المتاح - افتح البنك' : 'Liquid Cash - Open Bank';
    if (energyPill) energyPill.title = ar ? 'الطاقة - افتح النادي' : 'Energy - Open Gym';
    if (nervePill) nervePill.title = ar ? 'الجرأة - افتح الجرائم' : 'Nerve - Open Crimes';
    if (lifePill) lifePill.title = ar ? 'الصحة - افتح المستشفى' : 'Life - Open Hospital';
    if (cityPill) cityPill.title = ar ? 'الموقع الحالي - خريطة المدينة' : 'Active Sector - City Map';
  }

  function applyCachedHudValues() {
    if (!hudCache.hudEl) return;

    var cashStr = readCashFromCachedNode(hudCache.cashSrcEl);
    if (cashStr !== hudCache.lastCash) {
      hudCache.lastCash = cashStr;
      setTextIfChanged(hudCache.cashValEl, cashStr);
    }

    var energy = readBarFromCachedNodes('energy', 100, hudCache.energyTrackEl, hudCache.energyFigEl);
    var energyStr = energy.cur + '/' + energy.max;
    if (energyStr !== hudCache.lastEnergy) {
      hudCache.lastEnergy = energyStr;
      setTextIfChanged(hudCache.energyValEl, energyStr);
    }
    if (energy.pct !== hudCache.lastEnergyPct && hudCache.energyPillEl) {
      hudCache.lastEnergyPct = energy.pct;
      hudCache.energyPillEl.style.setProperty('--zaaa-pct', energy.pct + '%');
      hudCache.energyPillEl.style.setProperty('--zaaa-pct-num', String(energy.pct / 100));
    }

    var nerve = readBarFromCachedNodes('nerve', 15, hudCache.nerveTrackEl, hudCache.nerveFigEl);
    var nerveStr = nerve.cur + '/' + nerve.max;
    if (nerveStr !== hudCache.lastNerve) {
      hudCache.lastNerve = nerveStr;
      setTextIfChanged(hudCache.nerveValEl, nerveStr);
    }
    if (nerve.pct !== hudCache.lastNervePct && hudCache.nervePillEl) {
      hudCache.lastNervePct = nerve.pct;
      hudCache.nervePillEl.style.setProperty('--zaaa-pct', nerve.pct + '%');
      hudCache.nervePillEl.style.setProperty('--zaaa-pct-num', String(nerve.pct / 100));
    }

    var life = readBarFromCachedNodes('life', 100, hudCache.lifeTrackEl, hudCache.lifeFigEl);
    var lifeStr = life.cur + '/' + life.max;
    if (lifeStr !== hudCache.lastLife) {
      hudCache.lastLife = lifeStr;
      setTextIfChanged(hudCache.lifeValEl, lifeStr);
    }
    if (life.pct !== hudCache.lastLifePct && hudCache.lifePillEl) {
      hudCache.lastLifePct = life.pct;
      hudCache.lifePillEl.style.setProperty('--zaaa-pct', life.pct + '%');
      hudCache.lifePillEl.style.setProperty('--zaaa-pct-num', String(life.pct / 100));
    }

    var city = readCityTelemetry();
    if (city.code !== hudCache.lastCityCode) {
      hudCache.lastCityCode = city.code;
      setTextIfChanged(hudCache.cityCodeEl, city.code);
    }
    if (city.name !== hudCache.lastCityName) {
      hudCache.lastCityName = city.name;
      setTextIfChanged(hudCache.cityValEl, city.name);
    }
  }

  function syncTopbarHud() {
    var hud = ensureTopbarHud();
    if (!hud) return;
    refreshHudDomCache(hud);
    applyCachedHudValues();
  }

  /* ------------------------------------------------------------------------
   * 4. HEADER ACTIONS (.zone-header-actions) - Clock, Sun/Moon, Admin Studio
   * ------------------------------------------------------------------------ */
  function syncHeaderActions() {
    var actions = document.querySelector('.zone-topbar .zone-header-actions');
    if (!actions) return;

    var ar = isArabic();
    var clockSpan = actions.querySelector(':scope > span:first-child');
    if (clockSpan && !clockSpan.querySelector('.zaaa-chrono-ico')) {
      var chronoWrap = document.createElement('span');
      chronoWrap.className = 'zaaa-chrono-ico';
      chronoWrap.setAttribute('aria-hidden', 'true');
      chronoWrap.innerHTML = renderSketchIcon('chrono');
      clockSpan.appendChild(chronoWrap);
    }

    var ind = actions.querySelector('.zone-theme-indicator');
    if (ind && !ind.querySelector('.zaaa-theme-svg')) {
      var themeWrap = document.createElement('span');
      themeWrap.className = 'zaaa-theme-svg';
      themeWrap.setAttribute('aria-hidden', 'true');
      themeWrap.innerHTML = THEME_SVGS;
      ind.appendChild(themeWrap);
    }

    var themeBtn = actions.querySelector(':scope > button:first-of-type');
    if (themeBtn) {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      var themeAria = ar
        ? (isLight ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح')
        : (isLight ? 'Switch to Dark Sketchbook' : 'Switch to Light Sketchbook');
      if (themeBtn.getAttribute('aria-label') !== themeAria) {
        themeBtn.setAttribute('aria-label', themeAria);
      }
      themeBtn.title = themeAria;
    }

    var adminLink = actions.querySelector(':scope > a');
    if (adminLink && !adminLink.querySelector('.zaaa-admin-ico')) {
      var adminWrap = document.createElement('span');
      adminWrap.className = 'zaaa-admin-ico';
      adminWrap.setAttribute('aria-hidden', 'true');
      adminWrap.innerHTML = renderSketchIcon('admin');
      adminLink.appendChild(adminWrap);
    }

    var qjBtn = document.getElementById('zaaa-quick-jump-btn');
    if (qjBtn && qjBtn.parentElement !== actions) {
      if (qjBtn.parentElement) qjBtn.parentElement.removeChild(qjBtn);
      qjBtn = null;
    }
    if (!qjBtn) {
      qjBtn = document.createElement('button');
      qjBtn.type = 'button';
      qjBtn.id = 'zaaa-quick-jump-btn';
      qjBtn.className = 'zaaa-quick-jump-btn';
      qjBtn.innerHTML =
        '<span class="zaaa-qj-ico" aria-hidden="true">' + renderSketchIcon('search') + '</span>' +
        '<span class="zaaa-qj-lbl">Jump</span>' +
        '<kbd class="zaaa-qj-kbd">Ctrl+K</kbd>';
      qjBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        openQuickSwitcher();
      });
      actions.appendChild(qjBtn);
    }
    var qjLabel = ar ? 'انتقال سريع' : 'Quick Jump';
    var qjAria = ar ? 'البحث والانتقال السريع بين كل الأقسام (Ctrl+K)' : 'Quick Jump & Search all 19 areas (Ctrl+K)';
    setTextIfChanged(qjBtn.querySelector('.zaaa-qj-lbl'), qjLabel);
    if (qjBtn.getAttribute('aria-label') !== qjAria) {
      qjBtn.setAttribute('aria-label', qjAria);
      qjBtn.title = qjAria;
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
            '<span class="zaaa-op-xp-lbl">Syndicate XP</span>' +
            '<bdi class="zaaa-op-xp-val">40 / 100</bdi>' +
          '</div>' +
          '<div class="zaaa-op-xp-track" aria-hidden="true">' +
            '<div class="zaaa-op-xp-fill"></div>' +
          '</div>' +
        '</div>';

      var openDossier = function () {
        if (isDrawerOpen()) setMobileDrawerOpen(false);
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

      profileBody.appendChild(crest);
    }

    var ar = isArabic();
    var op = readOperativeTelemetry();
    setTextIfChanged(crest.querySelector('.zaaa-op-lvl'), (ar ? 'م.' : 'LV.') + op.level);
    setTextIfChanged(crest.querySelector('.zaaa-op-rank'), op.rankTitle);
    setTextIfChanged(crest.querySelector('.zaaa-op-id'), '#' + op.playerId);
    setTextIfChanged(crest.querySelector('.zaaa-op-xp-lbl'), ar ? 'خبرة النقابة' : 'Syndicate XP');
    setTextIfChanged(
      crest.querySelector('.zaaa-op-xp-val'),
      formatInt(op.xp) + ' / ' + formatInt(op.nextXp)
    );
    crest.style.setProperty('--zaaa-xp-pct', op.xpPct + '%');
    crest.title = ar ? 'فتح ملف العميل الشخصي' : 'Open Operative Dossier';
  }

  /* ------------------------------------------------------------------------
   * 6. SIDEBAR VITALS TIMER SYNC (Eliminates Overlapping "FULL" Collision)
   * ------------------------------------------------------------------------ */
  function updateTimerAttr(timerEl) {
    if (!timerEl) return;
    var raw = String(timerEl.textContent || '').trim();
    var isFullOrEmpty = !raw || /^(full|ممتلئ|كامل)$/i.test(raw);
    if (isFullOrEmpty) {
      if (timerEl.hasAttribute('data-zaaa-timer')) {
        timerEl.removeAttribute('data-zaaa-timer');
      }
    } else if (timerEl.getAttribute('data-zaaa-timer') !== 'countdown') {
      timerEl.setAttribute('data-zaaa-timer', 'countdown');
    }
  }

  function syncSidebarVitals() {
    var timers = document.querySelectorAll('aside.zone-sidebar .zone-resource .zone-resource-timer');
    var list = [];
    for (var i = 0; i < timers.length; i++) {
      var timerEl = timers[i];
      list.push(timerEl);
      updateTimerAttr(timerEl);
    }
    hudCache.timerEls = list;
  }

  /* ------------------------------------------------------------------------
   * 7. DOCKED TOPBAR MENU TRIGGER (#zaaa-mobile-rail-toggle) & MOBILE DRAWER
   *    Dock trigger cleanly inside [data-zheaderbar] (order: 0 on <=900px),
   *    mount #zaaa-drawer-backdrop + #zaaa-drawer-header, and sync with Menu tab.
   * ------------------------------------------------------------------------ */
  function updateDrawerTriggerAttributes() {
    var ar = isArabic();
    var open = isDrawerOpen();

    var toggleBtn = document.getElementById('zaaa-mobile-rail-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var lblText = open
        ? (ar ? 'طي تفاصيل الملف' : 'Compact Side Menu')
        : (ar ? 'توسيع ملف العميل' : 'Expand Full Dossier');
      setTextIfChanged(toggleBtn.querySelector('.zaaa-rail-toggle-lbl'), lblText);
      toggleBtn.setAttribute('aria-label', lblText);
      toggleBtn.title = lblText;
    }

    var menuTabBtn = document.querySelector('.zone-mobile-tabbar button[data-zaaa-mob="menu"]');
    if (menuTabBtn) {
      menuTabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function ensureDrawerBackdrop() {
    if (!document.body) return;
    var backdrop = document.getElementById('zaaa-drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'zaaa-drawer-backdrop';
      backdrop.setAttribute('tabindex', '-1');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', function () {
        setMobileDrawerOpen(false);
      });
      document.body.appendChild(backdrop);
    }
  }

  function syncMobileDrawerHeader() {
    var sidebar = document.querySelector('aside.zone-sidebar');
    if (!sidebar) return;

    var header = document.getElementById('zaaa-drawer-header');
    if (header && header.parentElement !== sidebar) {
      if (header.parentElement) header.parentElement.removeChild(header);
      header = null;
    }

    if (!header) {
      header = document.createElement('div');
      header.id = 'zaaa-drawer-header';
      header.innerHTML =
        '<div class="zaaa-drawer-toprow">' +
          '<span class="zaaa-drawer-title">District Ledger</span>' +
          '<button type="button" class="zaaa-drawer-close" aria-label="Close Menu">' +
            renderSketchIcon('close') +
          '</button>' +
        '</div>' +
        '<div class="zaaa-drawer-quicklinks">' +
          '<a class="zaaa-drawer-qlink zaaa-drawer-account" href="/account">' +
            renderSketchIcon('account') +
            '<span class="zaaa-drawer-qlink-lbl">Account</span>' +
          '</a>' +
          '<a class="zaaa-drawer-qlink zaaa-drawer-admin" href="/admin">' +
            renderSketchIcon('admin') +
            '<span class="zaaa-drawer-qlink-lbl">Admin</span>' +
          '</a>' +
        '</div>';

      var closeBtn = header.querySelector('.zaaa-drawer-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          setMobileDrawerOpen(false);
        });
      }

      /* Append at end of aside.zone-sidebar; CSS order:-30 renders at top of drawer */
      sidebar.appendChild(header);
    }

    var ar = isArabic();
    var langParam = ar ? '?lang=ar' : '?lang=en';
    setTextIfChanged(header.querySelector('.zaaa-drawer-title'), ar ? 'دفتر المناطق' : 'District Ledger');

    var closeEl = header.querySelector('.zaaa-drawer-close');
    if (closeEl) {
      var closeLabel = ar ? 'إغلاق القائمة' : 'Close Menu';
      closeEl.setAttribute('aria-label', closeLabel);
      closeEl.title = closeLabel;
    }

    var accLink = header.querySelector('.zaaa-drawer-account');
    if (accLink) {
      var liveAcc = sidebar.querySelector('.zone-profile-account[href]');
      accLink.setAttribute('href', (liveAcc && liveAcc.getAttribute('href')) || ('/account' + langParam));
      setTextIfChanged(accLink.querySelector('.zaaa-drawer-qlink-lbl'), ar ? 'الحساب' : 'Account');
    }

    var admLink = header.querySelector('.zaaa-drawer-admin');
    if (admLink) {
      var liveAdm = document.querySelector('.zone-topbar .zone-header-actions > a[href]');
      admLink.setAttribute('href', (liveAdm && liveAdm.getAttribute('href')) || ('/admin' + langParam));
      setTextIfChanged(admLink.querySelector('.zaaa-drawer-qlink-lbl'), ar ? 'الإدارة' : 'Admin');
    }
  }

  function syncMobileRailToggle() {
    var headerBar = document.querySelector('.zone-topbar [data-zheaderbar]');
    if (!headerBar) return;

    ensureDrawerBackdrop();
    syncMobileDrawerHeader();

    var toggleBtn = document.getElementById('zaaa-mobile-rail-toggle');
    if (toggleBtn && toggleBtn.parentElement !== headerBar) {
      if (toggleBtn.parentElement) toggleBtn.parentElement.removeChild(toggleBtn);
      toggleBtn = null;
    }

    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'zaaa-mobile-rail-toggle';
      toggleBtn.className = 'zaaa-mobile-rail-toggle';
      toggleBtn.setAttribute('aria-controls', 'zone-area-navigation');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.innerHTML =
        '<span class="zaaa-rail-toggle-ico zaaa-ico-burger" aria-hidden="true">' + renderSketchIcon('menu') + '</span>' +
        '<span class="zaaa-rail-toggle-ico zaaa-ico-close" aria-hidden="true">' + renderSketchIcon('close') + '</span>' +
        '<span class="zaaa-rail-toggle-lbl">Menu</span>';

      toggleBtn.addEventListener('click', function () {
        setMobileDrawerOpen(!isDrawerOpen());
      });

      /* Append at end of [data-zheaderbar]; CSS order:0 docks it first on <=900px */
      headerBar.appendChild(toggleBtn);
    }

    var navArea = document.getElementById('zone-area-navigation');
    if (navArea) {
      var navOpenAttr = navArea.getAttribute('data-zone-nav-open') || 'false';
      if (navOpenAttr !== lastObservedNavOpen) {
        lastObservedNavOpen = navOpenAttr;
        if (navOpenAttr === 'true' && isMobileViewport() && !isDrawerOpen()) {
          setMobileDrawerOpen(true);
        }
      }

      if (navArea.getAttribute('data-zaaa-rail-bound') !== '1') {
        navArea.setAttribute('data-zaaa-rail-bound', '1');
        navArea.addEventListener('click', function (ev) {
          try {
            var target = ev.target;
            var btn = target && typeof target.closest === 'function'
              ? target.closest('button[data-zone-screen]')
              : null;
            if (btn && isMobileViewport()) {
              setMobileDrawerOpen(false);
            }
          } catch (_) {}
        });
      }
    }

    updateDrawerTriggerAttributes();
  }

  /* ------------------------------------------------------------------------
   * 8. SIDEBAR DISTRICT HAND-INKED ICONS (#zone-area-navigation .zone-nav-icon)
   *    Respects [data-zwc-icon="1"] and [data-zwc-ink] injected by watercolor-sketchbook.js!
   * ------------------------------------------------------------------------ */
  function resolveNavIconKey(screenId) {
    var key = String(screenId || '').trim().toLowerCase();
    if (SKETCH_ICONS[key]) return key;
    if (key.indexOf('job') === 0) return 'jobs';
    if (key.indexOf('crime') === 0) return 'crimes';
    if (key.indexOf('item') === 0) return 'items';
    if (key.indexOf('prop') === 0) return 'properties';
    if (key.indexOf('edu') === 0) return 'education';
    if (key.indexOf('hosp') === 0) return 'hospital';
    if (key.indexOf('fact') === 0) return 'faction';
    if (key.indexOf('news') === 0) return 'newspaper';
    if (key.indexOf('elim') === 0) return 'elimination';
    if (key.indexOf('miss') === 0) return 'missions';
    if (key.indexOf('mark') === 0 || key.indexOf('bazaar') >= 0) return 'market';
    return 'home';
  }

  function syncSidebarNavIcons() {
    var buttons = document.querySelectorAll(
      'aside.zone-sidebar #zone-area-navigation button[data-zone-screen]'
    );

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var iconBox = btn.querySelector('.zone-nav-icon');
      if (!iconBox) continue;

      var key = resolveNavIconKey(btn.getAttribute('data-zone-screen'));

      /* Respect watercolor-sketchbook.js icons: never overwrite [data-zwc-icon="1"] or matching [data-zwc-ink] */
      var zwcIcon = iconBox.querySelector('[data-zwc-icon="1"], svg[data-zwc-ink]');
      if (zwcIcon && (zwcIcon.getAttribute('data-zwc-icon') === '1' || zwcIcon.getAttribute('data-zwc-ink') === key)) {
        continue;
      }

      var existing = iconBox.querySelector('svg.zaaa-vivid-svg, svg.zwc-sketch-ico');
      if (!existing) {
        var svgEl = parseSvgElement(renderSketchIcon(key));
        if (svgEl) {
          svgEl.setAttribute('data-ico', key);
          iconBox.appendChild(svgEl);
        }
      } else if (existing.getAttribute('data-ico') !== key && existing.getAttribute('data-zwc-ink') !== key) {
        var nextSvg = parseSvgElement(renderSketchIcon(key));
        if (nextSvg) {
          existing.setAttribute('data-ico', key);
          existing.setAttribute('data-zwc-ink', key);
          existing.innerHTML = nextSvg.innerHTML;
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 9. THUMB-ZONE 5-TAB SKETCHBOOK BOTTOM BAR (.zone-mobile-tabbar)
   *    Tabs: Home, City, Crimes, Gym, Menu (6th "attack" hidden cleanly via CSS)
   * ------------------------------------------------------------------------ */
  function classifyMobileTab(btn, index) {
    var spans = btn.children;
    var sym = spans && spans[0] ? String(spans[0].textContent || '').trim() : '';
    if (sym === '◆') return 'home';
    if (sym === '◈') return 'city';
    if (sym === '▲') return 'crimes';
    if (sym === '■') return 'gym';
    if (sym === '✕') return 'attack';
    if (sym === '☰') return 'menu';

    var fallback = ['home', 'city', 'crimes', 'gym', 'attack', 'menu'];
    return fallback[index] || 'home';
  }

  function syncMobileTabbarIcons() {
    var tabbar = document.querySelector('.zone-mobile-tabbar');
    if (!tabbar) return;

    var ar = isArabic();
    if (tabbar.getAttribute('aria-label') !== (ar ? 'التنقل السريع' : 'Primary Navigation')) {
      tabbar.setAttribute('aria-label', ar ? 'التنقل السريع' : 'Primary Navigation');
    }

    if (tabbar.getAttribute('data-zaaa-tabbar-bound') !== '1') {
      tabbar.setAttribute('data-zaaa-tabbar-bound', '1');
      tabbar.addEventListener('click', function (ev) {
        try {
          var target = ev.target;
          var btn = target && typeof target.closest === 'function'
            ? target.closest('button[data-zaaa-mob]')
            : null;
          if (!btn) return;
          var tabKey = btn.getAttribute('data-zaaa-mob');
          if (tabKey === 'menu') {
            ev.preventDefault();
            ev.stopPropagation();
            setMobileDrawerOpen(!isDrawerOpen());
          } else if (isDrawerOpen()) {
            setMobileDrawerOpen(false);
          }
        } catch (_) {}
      }, true);
    }

    var buttons = tabbar.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var key = classifyMobileTab(btn, i);
      var mobIco = btn.querySelector('.zaaa-mob-ico');

      if (!mobIco) {
        mobIco = document.createElement('span');
        mobIco.className = 'zaaa-mob-ico';
        mobIco.setAttribute('aria-hidden', 'true');
        mobIco.setAttribute('data-ico', key);
        mobIco.innerHTML = renderSketchIcon(key);
        btn.appendChild(mobIco);
      } else if (mobIco.getAttribute('data-ico') !== key) {
        mobIco.setAttribute('data-ico', key);
        mobIco.innerHTML = renderSketchIcon(key);
      }

      if (btn.getAttribute('data-zaaa-mob') !== key) {
        btn.setAttribute('data-zaaa-mob', key);
      }
    }

    updateDrawerTriggerAttributes();
  }

  /* ------------------------------------------------------------------------
   * 10. v175 EASY-ACCESS NAVIGATION SUITE (WEB + MOBILE + BACKEND UIUX SYNC)
   *     - Universal 1-Tap Quick-Switcher & Bilingual Search (#zas-quick-switcher)
   *     - Live 19-Area Sidebar/Drawer Filter + Docked Rail Quick-Jump Tile
   *     - Pinned Favorites Synced with localStorage & PostgreSQL /api/v1/settings
   *     - Contextual Thumb-Zone Back & Scroll-Top Assist (#zaaa-thumb-assist)
   * ------------------------------------------------------------------------ */
  var UIUX_STORAGE_KEY = 'zone.uiux.prefs.v175';
  var DEFAULT_PINNED_ROUTES = ['home', 'crimes', 'gym', 'city', 'items', 'casino'];

  var DISTRICT_DIRECTORY = [
    { id: 'home', en: 'Home HQ', ar: 'المقر الرئيسي', subEn: 'Operative dossier & base', subAr: 'ملف العميل وقاعدة العمليات', kw: 'hq base character suit overview home المقر الرئيسية' },
    { id: 'crimes', en: 'Crimes & Heists', ar: 'الجرائم والسطو', subEn: 'Spend Nerve for street cash & XP', subAr: 'استهلك الجرأة لكسب المال والخبرة', kw: 'crime heist steal nerve street جرائم سرقة سطو جرأة' },
    { id: 'gym', en: 'Iron Pit Gym', ar: 'نادي الحديد', subEn: 'Train Str, Def, Spd & Dex', subAr: 'تدريب القوة والدفاع والسرعة والمهارة', kw: 'gym workout train stats energy نادي تدريب رياضة طاقة' },
    { id: 'city', en: 'City Map & Travel', ar: 'خريطة المدينة والسفر', subEn: '3D district map, airport & turf', subAr: 'خريطة ثلاثية الأبعاد ومطار ومناطق', kw: 'city map travel airport world خريطة مدينة سفر مطار' },
    { id: 'items', en: 'Items & Armory', ar: 'العتاد والمخزون', subEn: 'Weapons, Kevlar, meds & boosters', subAr: 'أسلحة ودروع وأدوية ومحفزات', kw: 'items inventory loadout weapon armor xanax مخزون عتاد سلاح درع' },
    { id: 'properties', en: 'Properties & Safehouses', ar: 'العقارات والمخابئ', subEn: '7 safehouse tiers + 3D interiors', subAr: '٧ عقارات مع معاينة داخلية ثلاثية الأبعاد', kw: 'properties safehouse shack apartment villa island vault عقارات مخبأ فيلا شقة جزيرة خزنة' },
    { id: 'casino', en: 'Velvet Casino', ar: 'كازينو المخمل', subEn: 'Blackjack, Roulette, Slots, Craps', subAr: 'بلاك جاك وروليت وسلوتس وكرابس', kw: 'casino gamble blackjack roulette slots wheel racing كازينو قمار روليت بلاك جاك عجلة' },
    { id: 'education', en: 'Academy & Skill Tree', ar: 'الأكاديمية وشجرة المهارات', subEn: 'Courses & 4-branch passive perks', subAr: 'الدورات الأكاديمية وشجرة المهارات', kw: 'education school course degree skill tree تعليم اكاديمية دورات مهارات' },
    { id: 'jobs', en: 'Jobs & Companies', ar: 'الوظائف والشركات', subEn: 'Work shifts & player companies', subAr: 'نوبات العمل وإدارة الشركات', kw: 'jobs work career salary company وظائف عمل شركات راتب' },
    { id: 'missions', en: 'Missions & Story', ar: 'المهام والقصة', subEn: 'Contracts & Dockside campaign', subAr: 'عقود المهام وفصول القصة', kw: 'missions contracts duke story campaign مهام عقود قصة' },
    { id: 'bank', en: 'Syndicate Bank', ar: 'بنك النقابة', subEn: 'Vault deposits & stock exchange', subAr: 'إيداع الأموال وسوق الأسهم', kw: 'bank deposit withdraw vault interest stocks بنك ايداع سحب اسهم' },
    { id: 'market', en: 'Black Market & Bazaar', ar: 'السوق السوداء والبازار', subEn: 'Buy gear, bazaars & safe trades', subAr: 'شراء العتاد والبازار والتجارة الآمنة', kw: 'market shop buy sell bazaar trade سوق متجر شراء بيع تجارة' },
    { id: 'hospital', en: 'Emergency Hospital', ar: 'مستشفى الطوارئ', subEn: 'Heal life & revive operatives', subAr: 'علاج الصحة وإنعاش العملاء', kw: 'hospital heal revive doctor medkit مستشفى علاج اسعاف صحة' },
    { id: 'jail', en: 'Central Precinct Jail', ar: 'السجن المركزي', subEn: 'Bail out or bust syndicate crew', subAr: 'دفع الكفالة أو تهريب السجناء', kw: 'jail prison bail bust inmates سجن كفالة تهريب' },
    { id: 'faction', en: 'Faction & Family HQ', ar: 'مقر العائلة والفصيل', subEn: 'Organized crimes, wars & respect', subAr: 'الجرائم المنظمة والحروب والاحترام', kw: 'faction family gang war respect chain فصيل عائلة عصابة حرب' },
    { id: 'attack', en: 'Combat Arena', ar: 'ساحة القتال', subEn: 'PvP/NPC tactical street fights', subAr: 'قتال الشوارع والمواجهات المباشرة', kw: 'attack fight combat pvp mug arena قتال هجوم مواجهة' },
    { id: 'newspaper', en: 'Street Chronicle', ar: 'صحيفة الشارع', subEn: 'Live underworld news & bounties', subAr: 'أخبار العالم السفلي والأحداث', kw: 'newspaper news chronicle bulletin صحيفة اخبار جريدة' },
    { id: 'hof', en: 'Hall of Fame', ar: 'قاعة المشاهير', subEn: 'Top bosses, networth & rankings', subAr: 'ترتيب الزعماء والأغنى والأقوى', kw: 'hof hall of fame leaderboard rank top متصدرين مشاهير ترتيب' },
    { id: 'elimination', en: 'Elimination War', ar: 'حرب الإقصاء', subEn: 'Syndicate seasonal elimination', subAr: 'بطولة الإقصاء الموسمية للنقابات', kw: 'elimination tournament war season اقصاء بطولة حرب' }
  ];

  var DISTRICT_BY_ID = {};
  for (var dIdx = 0; dIdx < DISTRICT_DIRECTORY.length; dIdx++) {
    DISTRICT_BY_ID[DISTRICT_DIRECTORY[dIdx].id] = DISTRICT_DIRECTORY[dIdx];
  }

  var uiUxState = {
    pinnedRoutes: DEFAULT_PINNED_ROUTES.slice(),
    recentRoutes: ['home'],
    quickAssistVisible: true,
    hydratedFromServer: false,
    syncTimer: 0,
    qsOpen: false,
    qsQuery: '',
    qsActiveIdx: 0,
    filteredIds: [],
    sidebarFilter: '',
    lastTrackedScreen: ''
  };

  function loadLocalUiUxPrefs() {
    try {
      var raw = localStorage.getItem(UIUX_STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (Array.isArray(parsed.pinnedRoutes) && parsed.pinnedRoutes.length > 0) {
        var validPins = [];
        for (var i = 0; i < parsed.pinnedRoutes.length; i++) {
          var id = String(parsed.pinnedRoutes[i] || '').toLowerCase();
          if (DISTRICT_BY_ID[id] && validPins.indexOf(id) < 0) validPins.push(id);
        }
        if (validPins.length > 0) uiUxState.pinnedRoutes = validPins.slice(0, 8);
      }
      if (Array.isArray(parsed.recentRoutes) && parsed.recentRoutes.length > 0) {
        var validRec = [];
        for (var j = 0; j < parsed.recentRoutes.length; j++) {
          var rid = String(parsed.recentRoutes[j] || '').toLowerCase();
          if (DISTRICT_BY_ID[rid] && validRec.indexOf(rid) < 0) validRec.push(rid);
        }
        if (validRec.length > 0) uiUxState.recentRoutes = validRec.slice(0, 6);
      }
      if (typeof parsed.quickAssistVisible === 'boolean') {
        uiUxState.quickAssistVisible = parsed.quickAssistVisible;
      }
    } catch (_) {}
  }

  function saveLocalUiUxPrefs() {
    try {
      localStorage.setItem(UIUX_STORAGE_KEY, JSON.stringify({
        pinnedRoutes: uiUxState.pinnedRoutes,
        recentRoutes: uiUxState.recentRoutes,
        quickAssistVisible: uiUxState.quickAssistVisible
      }));
    } catch (_) {}
  }

  function scheduleServerUiUxSync() {
    saveLocalUiUxPrefs();
    if (uiUxState.syncTimer) window.clearTimeout(uiUxState.syncTimer);
    uiUxState.syncTimer = window.setTimeout(function () {
      uiUxState.syncTimer = 0;
      try {
        if (typeof window.fetch !== 'function') return;
        window.fetch('/api/v1/settings/action', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            action: 'uiux.save',
            uiUx: {
              pinnedRoutes: uiUxState.pinnedRoutes,
              recentRoutes: uiUxState.recentRoutes,
              quickAssistVisible: uiUxState.quickAssistVisible
            }
          })
        }).catch(function () {});
      } catch (_) {}
    }, 650);
  }

  function hydrateServerUiUxPrefsOnce() {
    if (uiUxState.hydratedFromServer || typeof window.fetch !== 'function') return;
    uiUxState.hydratedFromServer = true;
    try {
      window.fetch('/api/v1/settings', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.uiUx || typeof data.uiUx !== 'object') return;
          var hasLocal = false;
          try { hasLocal = Boolean(localStorage.getItem(UIUX_STORAGE_KEY)); } catch (_) {}
          if (!hasLocal && Array.isArray(data.uiUx.pinnedRoutes) && data.uiUx.pinnedRoutes.length > 0) {
            uiUxState.pinnedRoutes = data.uiUx.pinnedRoutes.filter(function (id) { return Boolean(DISTRICT_BY_ID[id]); }).slice(0, 8);
            saveLocalUiUxPrefs();
            if (uiUxState.qsOpen) renderQuickSwitcherBody();
          }
        })
        .catch(function () {});
    } catch (_) {}
  }

  function togglePinRoute(screenId) {
    if (!DISTRICT_BY_ID[screenId]) return false;
    var idx = uiUxState.pinnedRoutes.indexOf(screenId);
    if (idx >= 0) {
      if (uiUxState.pinnedRoutes.length > 1) {
        uiUxState.pinnedRoutes.splice(idx, 1);
      }
    } else {
      if (uiUxState.pinnedRoutes.length >= 8) uiUxState.pinnedRoutes.pop();
      uiUxState.pinnedRoutes.push(screenId);
    }
    scheduleServerUiUxSync();
    if (uiUxState.qsOpen) renderQuickSwitcherBody();
    return uiUxState.pinnedRoutes.indexOf(screenId) >= 0;
  }

  function trackScreenVisit(screenId) {
    if (!screenId || !DISTRICT_BY_ID[screenId] || screenId === uiUxState.lastTrackedScreen) return;
    uiUxState.lastTrackedScreen = screenId;
    var next = [screenId];
    for (var i = 0; i < uiUxState.recentRoutes.length; i++) {
      if (uiUxState.recentRoutes[i] !== screenId && DISTRICT_BY_ID[uiUxState.recentRoutes[i]]) {
        next.push(uiUxState.recentRoutes[i]);
      }
      if (next.length >= 6) break;
    }
    uiUxState.recentRoutes = next;
    saveLocalUiUxPrefs();
    syncThumbAssist();
  }

  function getPreviousScreen() {
    var active = getActiveScreen();
    for (var i = 0; i < uiUxState.recentRoutes.length; i++) {
      var cand = uiUxState.recentRoutes[i];
      if (cand && cand !== active && DISTRICT_BY_ID[cand]) return cand;
    }
    return active === 'home' ? '' : 'home';
  }

  /* ---- Live Sidebar & Drawer Filter + Compact Rail Quick-Jump Tile ---- */
  function applySidebarFilter(query) {
    uiUxState.sidebarFilter = String(query || '');
    var q = uiUxState.sidebarFilter.trim().toLowerCase();
    var navArea = document.getElementById('zone-area-navigation');
    if (!navArea) return;

    var buttons = navArea.querySelectorAll('button[data-zone-screen]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var sid = btn.getAttribute('data-zone-screen') || '';
      var meta = DISTRICT_BY_ID[sid];
      var hay = (sid + ' ' + (btn.textContent || '') + ' ' + (meta ? (meta.en + ' ' + meta.ar + ' ' + meta.kw) : '')).toLowerCase();
      var match = !q || hay.indexOf(q) >= 0;
      if (match) {
        btn.removeAttribute('data-zaaa-filtered-out');
      } else {
        btn.setAttribute('data-zaaa-filtered-out', '1');
      }
    }

    var groups = navArea.querySelectorAll('.zone-nav-group');
    for (var g = 0; g < groups.length; g++) {
      if (q) {
        groups[g].setAttribute('data-zaaa-filtered-out', '1');
      } else {
        groups[g].removeAttribute('data-zaaa-filtered-out');
      }
    }

    var clearBtn = document.getElementById('zaaa-sidebar-filter-clear');
    if (clearBtn) {
      if (q) clearBtn.removeAttribute('hidden');
      else clearBtn.setAttribute('hidden', '');
    }
  }

  function syncSidebarQuickbar() {
    var navArea = document.getElementById('zone-area-navigation');
    if (!navArea) return;

    var bar = document.getElementById('zaaa-sidebar-quickbar');
    if (bar && bar.parentElement !== navArea) {
      if (bar.parentElement) bar.parentElement.removeChild(bar);
      bar = null;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'zaaa-sidebar-quickbar';
      bar.className = 'zaaa-sidebar-quickbar';
      bar.innerHTML =
        '<button type="button" id="zaaa-rail-jump-btn" class="zaaa-rail-jump-btn">' +
          '<span class="zaaa-rail-jump-ico" aria-hidden="true">' + renderSketchIcon('bolt') + '</span>' +
          '<span class="zaaa-rail-jump-lbl">Quick Jump</span>' +
        '</button>' +
        '<div class="zaaa-sidebar-filter-box">' +
          '<span class="zaaa-sf-ico" aria-hidden="true">' + renderSketchIcon('search') + '</span>' +
          '<input type="search" id="zaaa-sidebar-filter-input" class="zaaa-sidebar-filter-input" autocomplete="off" spellcheck="false" />' +
          '<button type="button" id="zaaa-sidebar-filter-clear" class="zaaa-sidebar-filter-clear" hidden aria-label="Clear">✕</button>' +
        '</div>';

      var rjBtn = bar.querySelector('#zaaa-rail-jump-btn');
      if (rjBtn) {
        rjBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          openQuickSwitcher();
        });
      }

      var inputEl = bar.querySelector('#zaaa-sidebar-filter-input');
      var clearEl = bar.querySelector('#zaaa-sidebar-filter-clear');
      if (inputEl) {
        inputEl.addEventListener('input', function () {
          applySidebarFilter(inputEl.value);
        });
        inputEl.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') {
            inputEl.value = '';
            applySidebarFilter('');
            inputEl.blur();
          } else if (ev.key === 'Enter') {
            var firstVisible = navArea.querySelector('button[data-zone-screen]:not([data-zaaa-filtered-out="1"])');
            if (firstVisible) {
              var targetScr = firstVisible.getAttribute('data-zone-screen');
              inputEl.value = '';
              applySidebarFilter('');
              if (targetScr) navigateToScreen(targetScr);
            }
          }
        });
      }
      if (clearEl && inputEl) {
        clearEl.addEventListener('click', function () {
          inputEl.value = '';
          applySidebarFilter('');
          inputEl.focus();
        });
      }

      navArea.appendChild(bar);
    }

    var ar = isArabic();
    var rjLbl = bar.querySelector('.zaaa-rail-jump-lbl');
    var rjBtnEl = bar.querySelector('#zaaa-rail-jump-btn');
    setTextIfChanged(rjLbl, ar ? 'انتقال' : 'Jump');
    if (rjBtnEl) {
      var rjTitle = ar ? 'البحث والانتقال السريع بين الأقسام' : 'Quick Jump to any game area';
      rjBtnEl.setAttribute('aria-label', rjTitle);
      rjBtnEl.title = rjTitle;
    }

    var filterInp = bar.querySelector('#zaaa-sidebar-filter-input');
    if (filterInp) {
      var ph = ar ? 'تصفية ١٩ قسماً...' : 'Filter 19 areas...';
      if (filterInp.getAttribute('placeholder') !== ph) {
        filterInp.setAttribute('placeholder', ph);
        filterInp.setAttribute('aria-label', ph);
      }
    }
    if (uiUxState.sidebarFilter) {
      applySidebarFilter(uiUxState.sidebarFilter);
    }
  }

  /* ---- Smart Contextual Suggestions (Reads Live Vitals) ---- */
  function buildContextualSuggestions(ar) {
    var suggestions = [];
    var energy = readBarFromCachedNodes('energy', 100, hudCache.energyTrackEl, hudCache.energyFigEl);
    var nerve = readBarFromCachedNodes('nerve', 15, hudCache.nerveTrackEl, hudCache.nerveFigEl);
    var life = readBarFromCachedNodes('life', 100, hudCache.lifeTrackEl, hudCache.lifeFigEl);
    var cashNum = 0;
    try {
      if (window.__zoneGame && window.__zoneGame.p) cashNum = Number(window.__zoneGame.p.cash) || 0;
      else if (hudCache.cashSrcEl) cashNum = Number(String(hudCache.cashSrcEl.textContent || '').replace(/[^0-9.-]/g, '')) || 0;
    } catch (_) {}

    if (life.cur < life.max) {
      suggestions.push({
        screen: 'hospital',
        icon: 'hospital',
        label: ar ? ('علاج الصحة (' + life.cur + '/' + life.max + ')') : ('Heal Life (' + life.cur + '/' + life.max + ')')
      });
    }
    if (nerve.cur >= 2) {
      suggestions.push({
        screen: 'crimes',
        icon: 'crimes',
        label: ar ? ('تنفيذ جريمة (' + nerve.cur + ' جرأة)') : ('Run Street Crime (' + nerve.cur + ' Nerve)')
      });
    }
    if (energy.cur >= 5) {
      suggestions.push({
        screen: 'gym',
        icon: 'gym',
        label: ar ? ('تدريب بالنادي (' + energy.cur + ' طاقة)') : ('Train at Gym (' + energy.cur + ' Energy)')
      });
    }
    if (cashNum >= 10000) {
      suggestions.push({
        screen: 'bank',
        icon: 'bank',
        label: ar ? ('تأمين النقد بالبنك (' + formatMoney(cashNum, true) + ')') : ('Vault Cash in Bank (' + formatMoney(cashNum, true) + ')')
      });
    }
    if (suggestions.length < 3) {
      suggestions.push({
        screen: 'properties',
        icon: 'properties',
        label: ar ? 'معاينة المخابئ 3D' : 'Inspect 3D Safehouses'
      });
    }
    return suggestions.slice(0, 4);
  }

  /* ---- Universal 1-Tap Quick-Switcher Modal (#zas-quick-switcher) ---- */
  function ensureQuickSwitcherDom() {
    if (!document.body) return null;
    var modal = document.getElementById('zas-quick-switcher');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'zas-quick-switcher';
    modal.className = 'zas-quick-switcher';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'zas-qs-title');
    modal.setAttribute('hidden', '');

    modal.innerHTML =
      '<div class="zas-qs-sheet" role="document">' +
        '<div class="zas-qs-head">' +
          '<div class="zas-qs-title-wrap">' +
            '<span class="zas-qs-title-ico" aria-hidden="true">' + renderSketchIcon('bolt') + '</span>' +
            '<h2 id="zas-qs-title" class="zas-qs-title">Syndicate Quick Jump</h2>' +
          '</div>' +
          '<button type="button" id="zas-qs-close" class="zas-qs-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="zas-qs-search-row">' +
          '<span class="zas-qs-search-ico" aria-hidden="true">' + renderSketchIcon('search') + '</span>' +
          '<input type="search" id="zas-qs-input" class="zas-qs-input" autocomplete="off" spellcheck="false" />' +
        '</div>' +
        '<div id="zas-qs-smart" class="zas-qs-smart"></div>' +
        '<div id="zas-qs-pins" class="zas-qs-pins"></div>' +
        '<div id="zas-qs-list" class="zas-qs-list" role="listbox"></div>' +
        '<div id="zas-qs-foot" class="zas-qs-foot"></div>' +
      '</div>';

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) {
        closeQuickSwitcher();
        return;
      }
      var t = ev.target;
      if (!(t instanceof Element)) return;

      var pinBtn = t.closest('[data-qs-pin]');
      if (pinBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        togglePinRoute(pinBtn.getAttribute('data-qs-pin') || '');
        return;
      }

      var cmdBtn = t.closest('[data-qs-cmd]');
      if (cmdBtn) {
        ev.preventDefault();
        var cmd = cmdBtn.getAttribute('data-qs-cmd');
        closeQuickSwitcher();
        if (cmd === 'settings' && window.ZonePlayerSettings && typeof window.ZonePlayerSettings.open === 'function') {
          window.ZonePlayerSettings.open();
        } else if (cmd === 'theme') {
          var tbBtn = document.querySelector('.zone-topbar .zone-header-actions > button:first-of-type');
          if (tbBtn) tbBtn.click();
        } else if (cmd === 'lang') {
          var lgBtn = document.querySelector('.zone-topbar .zone-header-actions > button:nth-of-type(2)');
          if (lgBtn) lgBtn.click();
        }
        return;
      }

      var goBtn = t.closest('[data-qs-go]');
      if (goBtn) {
        ev.preventDefault();
        var dest = goBtn.getAttribute('data-qs-go');
        closeQuickSwitcher();
        if (dest) navigateToScreen(dest);
      }
    });

    var closeBtn = modal.querySelector('#zas-qs-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeQuickSwitcher();
      });
    }

    var inp = modal.querySelector('#zas-qs-input');
    if (inp) {
      inp.addEventListener('input', function () {
        uiUxState.qsQuery = inp.value || '';
        uiUxState.qsActiveIdx = 0;
        renderQuickSwitcherBody();
      });
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          closeQuickSwitcher();
        } else if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          if (uiUxState.filteredIds.length > 0) {
            uiUxState.qsActiveIdx = (uiUxState.qsActiveIdx + 1) % uiUxState.filteredIds.length;
            highlightQuickSwitcherOption();
          }
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          if (uiUxState.filteredIds.length > 0) {
            uiUxState.qsActiveIdx = (uiUxState.qsActiveIdx - 1 + uiUxState.filteredIds.length) % uiUxState.filteredIds.length;
            highlightQuickSwitcherOption();
          }
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          var chosen = uiUxState.filteredIds[uiUxState.qsActiveIdx] || uiUxState.filteredIds[0];
          if (chosen) {
            closeQuickSwitcher();
            navigateToScreen(chosen);
          }
        }
      });
    }

    document.body.appendChild(modal);
    return modal;
  }

  function highlightQuickSwitcherOption() {
    var listEl = document.getElementById('zas-qs-list');
    if (!listEl) return;
    var rows = listEl.querySelectorAll('.zas-qs-item');
    for (var i = 0; i < rows.length; i++) {
      if (i === uiUxState.qsActiveIdx) {
        rows[i].setAttribute('data-qs-selected', '1');
        try { rows[i].scrollIntoView({ block: 'nearest' }); } catch (_) {}
      } else {
        rows[i].removeAttribute('data-qs-selected');
      }
    }
  }

  function renderQuickSwitcherBody() {
    var modal = ensureQuickSwitcherDom();
    if (!modal) return;

    var ar = isArabic();
    var activeScr = getActiveScreen();
    var q = String(uiUxState.qsQuery || '').trim().toLowerCase();

    setTextIfChanged(modal.querySelector('#zas-qs-title'), ar ? 'الانتقال السريع والبحث الشامل' : 'Syndicate Quick Jump & Search');
    var inp = modal.querySelector('#zas-qs-input');
    if (inp) {
      var ph = ar ? 'ابحث عن أي قسم أو ميزة (مثال: بنك، مستشفى، فيلا، كازينو)...' : 'Jump to any area or action (e.g. bank, heal, villa, casino)...';
      if (inp.getAttribute('placeholder') !== ph) inp.setAttribute('placeholder', ph);
    }

    var smartEl = modal.querySelector('#zas-qs-smart');
    if (smartEl) {
      if (q) {
        smartEl.setAttribute('hidden', '');
      } else {
        var smartList = buildContextualSuggestions(ar);
        var smartHtml = '<span class="zas-qs-sec-lbl">' + (ar ? 'مقترح الآن:' : 'Suggested Now:') + '</span><div class="zas-qs-chip-row">';
        for (var s = 0; s < smartList.length; s++) {
          var sm = smartList[s];
          smartHtml +=
            '<button type="button" class="zas-qs-smart-chip" data-qs-go="' + sm.screen + '">' +
              '<span class="zas-qs-chip-ico" aria-hidden="true">' + renderSketchIcon(sm.icon) + '</span>' +
              '<span>' + sm.label + '</span>' +
            '</button>';
        }
        smartHtml += '</div>';
        smartEl.innerHTML = smartHtml;
        smartEl.removeAttribute('hidden');
      }
    }

    var pinsEl = modal.querySelector('#zas-qs-pins');
    if (pinsEl) {
      if (q) {
        pinsEl.setAttribute('hidden', '');
      } else {
        var pinHtml = '<span class="zas-qs-sec-lbl">' + (ar ? 'المثبّتة:' : 'Pinned:') + '</span><div class="zas-qs-chip-row">';
        for (var p = 0; p < uiUxState.pinnedRoutes.length; p++) {
          var pid = uiUxState.pinnedRoutes[p];
          var pMeta = DISTRICT_BY_ID[pid];
          if (!pMeta) continue;
          var isCurPin = pid === activeScr ? ' data-qs-current="1"' : '';
          pinHtml +=
            '<button type="button" class="zas-qs-pin-chip"' + isCurPin + ' data-qs-go="' + pid + '">' +
              '<span class="zas-qs-chip-ico" aria-hidden="true">' + renderSketchIcon(resolveNavIconKey(pid)) + '</span>' +
              '<span>' + (ar ? pMeta.ar : pMeta.en) + '</span>' +
            '</button>';
        }
        pinHtml += '</div>';
        pinsEl.innerHTML = pinHtml;
        pinsEl.removeAttribute('hidden');
      }
    }

    var matched = [];
    for (var i = 0; i < DISTRICT_DIRECTORY.length; i++) {
      var d = DISTRICT_DIRECTORY[i];
      if (!q) {
        matched.push(d);
      } else {
        var hay = (d.id + ' ' + d.en + ' ' + d.ar + ' ' + d.subEn + ' ' + d.subAr + ' ' + d.kw).toLowerCase();
        if (hay.indexOf(q) >= 0) matched.push(d);
      }
    }

    uiUxState.filteredIds = matched.map(function (m) { return m.id; });
    if (uiUxState.qsActiveIdx >= uiUxState.filteredIds.length) uiUxState.qsActiveIdx = 0;

    var listEl = modal.querySelector('#zas-qs-list');
    if (listEl) {
      if (matched.length === 0) {
        listEl.innerHTML = '<div class="zas-qs-empty">' + (ar ? 'لا توجد نتائج مطابقة. جرّب كلمة أخرى.' : 'No matching district found. Try another keyword.') + '</div>';
      } else {
        var rowsHtml = '';
        for (var r = 0; r < matched.length; r++) {
          var item = matched[r];
          var isPinned = uiUxState.pinnedRoutes.indexOf(item.id) >= 0;
          var isCurrent = item.id === activeScr;
          var selAttr = r === uiUxState.qsActiveIdx ? ' data-qs-selected="1"' : '';
          var curBadge = isCurrent
            ? '<span class="zas-qs-cur-badge">' + (ar ? 'الحالي' : 'Current') + '</span>'
            : '';
          rowsHtml +=
            '<div class="zas-qs-item" role="option"' + selAttr + (isCurrent ? ' data-qs-active="1"' : '') + '>' +
              '<button type="button" class="zas-qs-item-main" data-qs-go="' + item.id + '">' +
                '<span class="zas-qs-item-ico" aria-hidden="true">' + renderSketchIcon(resolveNavIconKey(item.id)) + '</span>' +
                '<span class="zas-qs-item-copy">' +
                  '<span class="zas-qs-item-title">' + (ar ? item.ar : item.en) + curBadge + '</span>' +
                  '<span class="zas-qs-item-sub">' + (ar ? item.subAr : item.subEn) + '</span>' +
                '</span>' +
              '</button>' +
              '<button type="button" class="zas-qs-pin-toggle" data-qs-pin="' + item.id + '"' +
                ' data-pinned="' + (isPinned ? '1' : '0') + '"' +
                ' aria-label="' + (isPinned ? (ar ? 'إلغاء التثبيت' : 'Unpin area') : (ar ? 'تثبيت في المفضلة' : 'Pin area')) + '"' +
                ' title="' + (isPinned ? (ar ? 'مثبّت' : 'Pinned') : (ar ? 'تثبيت' : 'Pin')) + '">' +
                renderSketchIcon('star') +
              '</button>' +
            '</div>';
        }
        listEl.innerHTML = rowsHtml;
      }
    }

    var footEl = modal.querySelector('#zas-qs-foot');
    if (footEl) {
      footEl.innerHTML =
        '<div class="zas-qs-utils">' +
          '<button type="button" class="zas-qs-util-btn" data-qs-cmd="settings">' + (ar ? '⚙ الإعدادات' : '⚙ Settings') + '</button>' +
          '<button type="button" class="zas-qs-util-btn" data-qs-cmd="theme">' + (ar ? '◐ المظهر' : '◐ Theme') + '</button>' +
          '<button type="button" class="zas-qs-util-btn" data-qs-cmd="lang">' + (ar ? 'EN اللغة' : 'عربي RTL') + '</button>' +
        '</div>' +
        '<span class="zas-qs-hint">' + (ar ? '↑↓ للتنقل · Enter للفتح · Esc للإغلاق' : '↑↓ Navigate · Enter Open · ★ Pin · Esc Close') + '</span>';
    }
  }

  function openQuickSwitcher(initialQuery) {
    hydrateServerUiUxPrefsOnce();
    var modal = ensureQuickSwitcherDom();
    if (!modal) return;
    if (isDrawerOpen()) setMobileDrawerOpen(false);
    uiUxState.qsOpen = true;
    uiUxState.qsQuery = typeof initialQuery === 'string' ? initialQuery : '';
    uiUxState.qsActiveIdx = 0;
    modal.removeAttribute('hidden');
    document.documentElement.setAttribute('data-zas-qs-open', '1');
    renderQuickSwitcherBody();
    var inp = modal.querySelector('#zas-qs-input');
    if (inp) {
      inp.value = uiUxState.qsQuery;
      window.setTimeout(function () {
        try { inp.focus({ preventScroll: true }); } catch (_) { try { inp.focus(); } catch (__) {} }
      }, 20);
    }
  }

  function closeQuickSwitcher() {
    uiUxState.qsOpen = false;
    document.documentElement.removeAttribute('data-zas-qs-open');
    var modal = document.getElementById('zas-quick-switcher');
    if (modal) modal.setAttribute('hidden', '');
  }

  /* ---- Floating Thumb-Zone Back & Scroll-Top Assist (#zaaa-thumb-assist) ---- */
  function syncThumbAssist() {
    if (!document.body || !uiUxState.quickAssistVisible) return;
    var bar = document.getElementById('zaaa-thumb-assist');
    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'zaaa-thumb-assist';
      bar.className = 'zaaa-thumb-assist';
      bar.setAttribute('aria-label', 'Quick Back and Top');
      bar.setAttribute('hidden', '');
      bar.innerHTML =
        '<button type="button" id="zaaa-assist-back" class="zaaa-assist-btn zaaa-assist-back" hidden>' +
          '<span class="zaaa-assist-ico" data-rtl-flip="1" aria-hidden="true">' + renderSketchIcon('back') + '</span>' +
          '<span class="zaaa-assist-lbl">HQ</span>' +
        '</button>' +
        '<button type="button" id="zaaa-assist-top" class="zaaa-assist-btn zaaa-assist-top" hidden>' +
          '<span class="zaaa-assist-ico" aria-hidden="true">' + renderSketchIcon('up') + '</span>' +
          '<span class="zaaa-assist-top-lbl">Top</span>' +
        '</button>';

      var backBtn = bar.querySelector('#zaaa-assist-back');
      var topBtn = bar.querySelector('#zaaa-assist-top');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          var prev = getPreviousScreen() || 'home';
          navigateToScreen(prev);
        });
      }
      if (topBtn) {
        topBtn.addEventListener('click', function () {
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
        });
      }
      document.body.appendChild(bar);
    }

    var ar = isArabic();
    var activeScr = getActiveScreen();
    var prevScr = getPreviousScreen();
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var showBack = Boolean(activeScr && activeScr !== 'home' && prevScr);
    var showTop = scrollY > 260;

    var backEl = bar.querySelector('#zaaa-assist-back');
    var topEl = bar.querySelector('#zaaa-assist-top');

    if (backEl) {
      if (showBack) {
        var prevMeta = DISTRICT_BY_ID[prevScr] || DISTRICT_BY_ID.home;
        var shortName = ar ? prevMeta.ar : prevMeta.en.split('&')[0].trim();
        setTextIfChanged(backEl.querySelector('.zaaa-assist-lbl'), shortName);
        var backAria = (ar ? 'العودة إلى ' : 'Back to ') + (ar ? prevMeta.ar : prevMeta.en);
        backEl.setAttribute('aria-label', backAria);
        backEl.title = backAria;
        backEl.removeAttribute('hidden');
      } else {
        backEl.setAttribute('hidden', '');
      }
    }

    if (topEl) {
      if (showTop) {
        setTextIfChanged(topEl.querySelector('.zaaa-assist-top-lbl'), ar ? 'أعلى' : 'Top');
        var topAria = ar ? 'العودة لأعلى الصفحة' : 'Scroll back to top';
        topEl.setAttribute('aria-label', topAria);
        topEl.title = topAria;
        topEl.removeAttribute('hidden');
      } else {
        topEl.setAttribute('hidden', '');
      }
    }

    if (showBack || showTop) {
      bar.removeAttribute('hidden');
    } else {
      bar.setAttribute('hidden', '');
    }
  }

  loadLocalUiUxPrefs();

  window.ZoneQuickNav = {
    version: '175.0',
    open: openQuickSwitcher,
    close: closeQuickSwitcher,
    toggle: function () {
      if (uiUxState.qsOpen) closeQuickSwitcher();
      else openQuickSwitcher();
    },
    isOpen: function () { return Boolean(uiUxState.qsOpen); },
    togglePin: togglePinRoute,
    goBack: function () {
      var prev = getPreviousScreen() || 'home';
      navigateToScreen(prev);
      return prev;
    },
    filterSidebar: applySidebarFilter,
    getDiagnostics: function () {
      return {
        version: '175.0',
        open: Boolean(uiUxState.qsOpen),
        activeScreen: getActiveScreen(),
        previousScreen: getPreviousScreen(),
        pinnedRoutes: uiUxState.pinnedRoutes.slice(),
        recentRoutes: uiUxState.recentRoutes.slice(),
        districtCount: DISTRICT_DIRECTORY.length
      };
    }
  };

  /* ------------------------------------------------------------------------
   * MASTER SYNC ORCHESTRATION (rAF-Coalesced for 60fps Mobile Performance)
   * ------------------------------------------------------------------------ */
  /* Prevent Web Animations API (`el.animate` with `transform`) on `#zone-main` from
     creating a fixed-positioning containing block that traps `nav.zone-mobile-tabbar` on mobile */
  if (typeof Element !== 'undefined' && Element.prototype && typeof Element.prototype.animate === 'function' && !Element.prototype.__zaaaZoneMainGuarded) {
    var origElemAnimate = Element.prototype.animate;
    Element.prototype.__zaaaZoneMainGuarded = true;
    Element.prototype.animate = function (keyframes, options) {
      if (this && this.id === 'zone-main' && isMobileViewport()) {
        return {
          cancel: function () {},
          finish: function () {},
          play: function () {},
          pause: function () {},
          finished: typeof Promise !== 'undefined' ? Promise.resolve() : null
        };
      }
      return origElemAnimate.apply(this, arguments);
    };
  }

  function guardMainFixedContainingBlock() {
    if (!isMobileViewport()) return;
    var main = document.getElementById('zone-main');
    if (!main || typeof main.getAnimations !== 'function') return;
    try {
      var anims = main.getAnimations();
      for (var i = 0; i < anims.length; i++) {
        anims[i].cancel();
      }
    } catch (_) {}
  }

  var lastScrolledScreen = '';
  function syncActiveSidebarScroll() {
    if (!isMobileViewport()) return;
    var activeScreen = getActiveScreen();
    if (activeScreen === lastScrolledScreen) return;
    lastScrolledScreen = activeScreen;
    var sidebar = document.querySelector('aside.zone-sidebar');
    if (!sidebar) return;
    var activeBtn = sidebar.querySelector(
      '#zone-area-navigation button[data-zone-screen="' + activeScreen + '"], #zone-area-navigation button[aria-current="page"]'
    );
    if (!activeBtn) return;
    try {
      var sRect = sidebar.getBoundingClientRect();
      var bRect = activeBtn.getBoundingClientRect();
      if (sRect.height > 0 && (bRect.top < sRect.top + 16 || bRect.bottom > sRect.bottom - 16)) {
        sidebar.scrollTop += (bRect.top - sRect.top) - (sRect.height * 0.35);
      }
    } catch (_) {}
  }

  function syncAll() {
    if (isSyncing) return;
    if (document.querySelector('x-dc')) return;
    isSyncing = true;
    try {
      guardMainFixedContainingBlock();
      syncBrand();
      syncHeaderLinks();
      syncTopbarHud();
      syncHeaderActions();
      syncOperativeCrest();
      syncSidebarVitals();
      syncMobileRailToggle();
      syncSidebarQuickbar();
      syncSidebarNavIcons();
      syncMobileTabbarIcons();
      syncActiveSidebarScroll();
      trackScreenVisit(getActiveScreen());
      syncThumbAssist();
    } catch (_) {
      /* Never emit console errors */
    } finally {
      isSyncing = false;
    }
  }

  function scheduleSync() {
    if (rafPending) return;
    rafPending = true;
    var runner = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
    runner(function () {
      rafPending = false;
      syncAll();
    });
  }

  function syncCachedHudDiff() {
    if (document.hidden || isSyncing) return;
    try {
      if (!hudCache.hudEl || !hudCache.hudEl.isConnected) {
        scheduleSync();
        return;
      }
      applyCachedHudValues();
      for (var i = 0; i < hudCache.timerEls.length; i++) {
        updateTimerAttr(hudCache.timerEls[i]);
      }
    } catch (_) {}
  }

  function armHydratedRewardPopups() {
    try {
      document.documentElement.setAttribute('data-zaaa-hydrated', '1');
    } catch (_) {}
  }

  function boot() {
    syncAll();
    window.setTimeout(scheduleSync, 180);
    window.setTimeout(scheduleSync, 650);

    document.addEventListener('pointerdown', armHydratedRewardPopups, { capture: true, once: true, passive: true });
    document.addEventListener('keydown', armHydratedRewardPopups, { capture: true, once: true, passive: true });

    window.addEventListener('zone:render', scheduleSync, { passive: true });

    window.addEventListener('resize', function () {
      if (!isMobileViewport() && isDrawerOpen()) {
        setMobileDrawerOpen(false);
      }
      scheduleSync();
    }, { passive: true });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (uiUxState.qsOpen) {
          ev.preventDefault();
          closeQuickSwitcher();
          return;
        }
        if (isDrawerOpen()) {
          setMobileDrawerOpen(false);
        }
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        if (uiUxState.qsOpen) closeQuickSwitcher();
        else openQuickSwitcher();
        return;
      }

      if (ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !uiUxState.qsOpen) {
        var activeEl = document.activeElement;
        var tag = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
        var isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(activeEl && activeEl.isContentEditable);
        if (!isEditable) {
          ev.preventDefault();
          openQuickSwitcher();
        }
      }
    });

    var scrollTick = false;
    window.addEventListener('scroll', function () {
      if (scrollTick) return;
      scrollTick = true;
      var runner = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 32); };
      runner(function () {
        scrollTick = false;
        syncThumbAssist();
      });
    }, { passive: true });

    window.setTimeout(hydrateServerUiUxPrefsOnce, 900);

    try {
      var htmlObs = new MutationObserver(function () {
        scheduleSync();
      });
      htmlObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
    } catch (_) {}

    window.setInterval(syncCachedHudDiff, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

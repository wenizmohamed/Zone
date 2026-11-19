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
   * 1. VIBRANT MULTI-COLOR HAND-INKED GOUACHE ICON CATALOG (LIGHT + DARK)
   *    Every icon pairs crisp fountain-pen/chalk ink outlines (.zwc-ink-stroke)
   *    with rich, unmistakable multi-color gouache fills (.zwc-wash-fill &
   *    .zwc-accent-fill) that pop equally on cream paper and dark charcoal.
   * ------------------------------------------------------------------------ */
  var WASH = {
    emerald: '#22b56b',
    lime: '#65c438',
    gold: '#f5b82e',
    amber: '#f59e0b',
    sienna: '#ea7234',
    coral: '#ef4c4c',
    crimson: '#e63946',
    rose: '#f43f6e',
    cerulean: '#2da4e8',
    cobalt: '#3b82f6',
    indigo: '#5c7cfa',
    teal: '#14b8a6',
    plum: '#a855f7',
    slate: '#688cb8',
    cream: '#fff6df'
  };

  var SKETCH_ICONS = {
    home: {
      wash:
        '<path class="zwc-wash-fill" d="M5.2 10.6L12 4.6L18.8 10.6V19.6H5.2V10.6Z" fill="' + WASH.gold + '"/>' +
        '<path class="zwc-accent-fill" d="M3.4 11.4L12 3.8L20.6 11.4H18.4L12 5.8L5.6 11.4H3.4Z" fill="' + WASH.crimson + '"/>' +
        '<rect class="zwc-accent-fill" x="9.8" y="13.8" width="4.4" height="5.8" rx="0.6" fill="' + WASH.teal + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M3.2 11.6L12 3.8L20.8 11.6M5.2 10.2V19.8H18.8V10.2M9.8 19.8V13.8H14.2V19.8"/>'
    },
    items: {
      wash:
        '<rect class="zwc-wash-fill" x="4" y="7.2" width="16" height="12.4" rx="2" fill="' + WASH.sienna + '"/>' +
        '<rect class="zwc-accent-fill" x="4.4" y="7.6" width="15.2" height="4.4" rx="1.4" fill="' + WASH.gold + '"/>' +
        '<rect class="zwc-accent-fill" x="10.4" y="10.6" width="3.2" height="3.2" rx="0.7" fill="' + WASH.cream + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4" y="7.2" width="16" height="12.4" rx="2"/><path class="zwc-ink-stroke" d="M9 7.2V5.2C9 4.4 9.6 3.8 10.4 3.8H13.6C14.4 3.8 15 4.4 15 5.2V7.2M4 12.2H20M12 10.8V13.8"/>'
    },
    city: {
      wash:
        '<path class="zwc-wash-fill" d="M4.5 19.6V8.5L9.5 6.5V19.6H4.5Z" fill="' + WASH.teal + '"/>' +
        '<path class="zwc-wash-fill" d="M9.5 19.6V4.5L15 6.3V19.6H9.5Z" fill="' + WASH.cerulean + '"/>' +
        '<path class="zwc-wash-fill" d="M15 19.6V10.2L19.5 11.6V19.6H15Z" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M3.2 19.8H20.8M4.5 19.8V8.4L9.5 6.4V19.8M9.5 4.4L15 6.2V19.8M15 10.2L19.5 11.6V19.8M7 10.5H7.2M12 9.2H12.2M12 12.8H12.2M17 14.2H17.2"/>'
    },
    jobs: {
      wash:
        '<rect class="zwc-wash-fill" x="3.8" y="7.8" width="16.4" height="12" rx="2" fill="' + WASH.cobalt + '"/>' +
        '<rect class="zwc-accent-fill" x="4.2" y="8.2" width="15.6" height="4.4" rx="1.4" fill="' + WASH.cerulean + '"/>' +
        '<rect class="zwc-accent-fill" x="10.2" y="11" width="3.6" height="3.2" rx="0.8" fill="' + WASH.gold + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="3.8" y="7.8" width="16.4" height="12" rx="2"/><path class="zwc-ink-stroke" d="M8.8 7.8V5.6C8.8 4.7 9.5 4 10.4 4H13.6C14.5 4 15.2 4.7 15.2 5.6V7.8M3.8 12.6H20.2"/>'
    },
    gym: {
      wash:
        '<rect class="zwc-accent-fill" x="7.6" y="10.8" width="8.8" height="2.4" rx="0.8" fill="' + WASH.cerulean + '"/>' +
        '<rect class="zwc-wash-fill" x="4.2" y="7.6" width="3.6" height="8.8" rx="1" fill="' + WASH.coral + '"/>' +
        '<rect class="zwc-wash-fill" x="16.2" y="7.6" width="3.6" height="8.8" rx="1" fill="' + WASH.coral + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M2.2 12H4.2M19.8 12H21.8M7.8 12H16.2"/><rect class="zwc-ink-stroke" x="4.2" y="7.6" width="3.6" height="8.8" rx="1"/><rect class="zwc-ink-stroke" x="16.2" y="7.6" width="3.6" height="8.8" rx="1"/>'
    },
    properties: {
      wash:
        '<rect class="zwc-wash-fill" x="4.5" y="4.5" width="9.5" height="15.3" rx="1.2" fill="' + WASH.teal + '"/>' +
        '<rect class="zwc-wash-fill" x="14" y="10" width="5.5" height="9.8" rx="1" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M3 19.8H21M4.5 19.8V4.4H14V19.8M14 10H19.5V19.8M7.5 8H11M7.5 11.5H11M7.5 15H11M16.2 13.5H17.5"/>'
    },
    education: {
      wash:
        '<path class="zwc-wash-fill" d="M6.5 11.6V16.4C6.5 18 9 19.4 12 19.4C15 19.4 17.5 18 17.5 16.4V11.6H6.5Z" fill="' + WASH.cobalt + '"/>' +
        '<path class="zwc-wash-fill" d="M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5Z" fill="' + WASH.indigo + '"/>' +
        '<circle class="zwc-accent-fill" cx="20.2" cy="15.8" r="1.7" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5ZM6.5 11.6V16.4C6.5 18 9 19.4 12 19.4C15 19.4 17.5 18 17.5 16.4V11.6M20.2 9.8V15.5"/>'
    },
    crimes: {
      wash:
        '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.2" fill="' + WASH.crimson + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="3" fill="' + WASH.gold + '"/>',
      ink: '<circle class="zwc-ink-stroke" cx="12" cy="12" r="7.2"/><path class="zwc-ink-stroke" d="M12 2.8V6.4M12 17.6V21.2M2.8 12H6.4M17.6 12H21.2M12 12H12.02"/>'
    },
    missions: {
      wash:
        '<rect class="zwc-wash-fill" x="5" y="4.6" width="14" height="15.4" rx="1.8" fill="' + WASH.amber + '"/>' +
        '<rect class="zwc-accent-fill" x="9" y="3.4" width="6" height="2.8" rx="0.8" fill="' + WASH.sienna + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="3.4" fill="' + WASH.emerald + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="5" y="4.6" width="14" height="15.4" rx="1.8"/><path class="zwc-ink-stroke" d="M9 3.4H15V6H9V3.4ZM8.5 11.8L10.8 14L15.6 9.4M8.5 16.6H15.5"/>'
    },
    newspaper: {
      wash:
        '<rect class="zwc-wash-fill" x="4" y="4.8" width="16" height="14.8" rx="1.6" fill="' + WASH.gold + '"/>' +
        '<rect class="zwc-accent-fill" x="4.4" y="5.2" width="15.2" height="4.2" rx="1" fill="' + WASH.cerulean + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4" y="4.8" width="16" height="14.8" rx="1.6"/><path class="zwc-ink-stroke" d="M7.2 8.4H16.8M7.2 12H12.2M7.2 15.4H16.8"/>'
    },
    jail: {
      wash:
        '<rect class="zwc-wash-fill" x="4.2" y="4.2" width="15.6" height="15.6" rx="1.6" fill="' + WASH.slate + '"/>' +
        '<rect class="zwc-accent-fill" x="9.6" y="9.8" width="4.8" height="4.4" rx="1" fill="' + WASH.amber + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4.2" y="4.2" width="15.6" height="15.6" rx="1.6"/><path class="zwc-ink-stroke" d="M8.5 4.2V19.8M12 4.2V19.8M15.5 4.2V19.8M4.2 11.5H19.8"/>'
    },
    hospital: {
      wash:
        '<rect class="zwc-wash-fill" x="4.2" y="5.2" width="15.6" height="14.4" rx="2.2" fill="' + WASH.cerulean + '"/>' +
        '<path class="zwc-accent-fill" d="M10.4 8.2H13.6V10.8H16.2V14H13.6V16.6H10.4V14H7.8V10.8H10.4V8.2Z" fill="' + WASH.crimson + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4.2" y="5.2" width="15.6" height="14.4" rx="2.2"/><path class="zwc-ink-stroke" d="M12 8.8V16M8.4 12.4H15.6"/>'
    },
    casino: {
      wash:
        '<rect class="zwc-wash-fill" x="4.5" y="4.5" width="15" height="15" rx="2.6" fill="' + WASH.plum + '"/>' +
        '<circle class="zwc-accent-fill" cx="8.6" cy="8.6" r="1.4" fill="' + WASH.gold + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="1.4" fill="' + WASH.gold + '"/>' +
        '<circle class="zwc-accent-fill" cx="15.4" cy="15.4" r="1.4" fill="' + WASH.gold + '"/>' +
        '<circle class="zwc-accent-fill" cx="15.4" cy="8.6" r="1.4" fill="' + WASH.gold + '"/>' +
        '<circle class="zwc-accent-fill" cx="8.6" cy="15.4" r="1.4" fill="' + WASH.gold + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4.5" y="4.5" width="15" height="15" rx="2.6"/>'
    },
    hof: {
      wash:
        '<path class="zwc-wash-fill" d="M6.8 4.2H17.2V9.4C17.2 12.4 14.9 14.8 12 14.8C9.1 14.8 6.8 12.4 6.8 9.4V4.2Z" fill="' + WASH.gold + '"/>' +
        '<rect class="zwc-accent-fill" x="8.2" y="17.8" width="7.6" height="2.2" rx="0.8" fill="' + WASH.sienna + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="9.2" r="2.1" fill="' + WASH.crimson + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M6.8 4.2H17.2V9.4C17.2 12.4 14.9 14.8 12 14.8C9.1 14.8 6.8 12.4 6.8 9.4V4.2ZM6.8 6.2H4.4C4.4 9 5.5 10.4 6.8 10.6M17.2 6.2H19.6C19.6 9 18.5 10.4 17.2 10.6M12 14.8V18.6M8.2 19.2H15.8"/>'
    },
    faction: {
      wash:
        '<path class="zwc-wash-fill" d="M12 3.2L19.5 6.2V11.8C19.5 16.4 16.2 19.5 12 21C7.8 19.5 4.5 16.4 4.5 11.8V6.2L12 3.2Z" fill="' + WASH.cobalt + '"/>' +
        '<path class="zwc-accent-fill" d="M8.6 13.8L9.6 9.2L12 11.6L14.4 9.2L15.4 13.8H8.6Z" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M12 3.2L19.5 6.2V11.8C19.5 16.4 16.2 19.5 12 21C7.8 19.5 4.5 16.4 4.5 11.8V6.2L12 3.2ZM8.6 13.6L9.6 9.4L12 11.6L14.4 9.4L15.4 13.6H8.6Z"/>'
    },
    elimination: {
      wash:
        '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.5" fill="' + WASH.sienna + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="3.4" fill="' + WASH.crimson + '"/>',
      ink: '<circle class="zwc-ink-stroke" cx="12" cy="12" r="7.5"/><circle class="zwc-ink-stroke" cx="12" cy="12" r="3"/><path class="zwc-ink-stroke" d="M12 2.4V5.4M12 18.6V21.6M2.4 12H5.4M18.6 12H21.6"/>'
    },
    bank: {
      wash:
        '<path class="zwc-wash-fill" d="M3.4 9.6L12 3.8L20.6 9.6H3.4Z" fill="' + WASH.emerald + '"/>' +
        '<rect class="zwc-accent-fill" x="5.4" y="9.8" width="13.2" height="7.4" fill="' + WASH.gold + '"/>' +
        '<rect class="zwc-wash-fill" x="3.6" y="17.2" width="16.8" height="2.6" fill="' + WASH.emerald + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M3.4 9.6L12 3.8L20.6 9.6H3.4ZM6.5 9.6V17.2M10.2 9.6V17.2M13.8 9.6V17.2M17.5 9.6V17.2M3.6 17.2H20.4V19.8H3.6V17.2Z"/>'
    },
    market: {
      wash:
        '<rect class="zwc-wash-fill" x="5.2" y="10.4" width="13.6" height="9.2" fill="' + WASH.gold + '"/>' +
        '<path class="zwc-accent-fill" d="M4.2 4.8H19.8L21.2 10.4H2.8L4.2 4.8Z" fill="' + WASH.crimson + '"/>' +
        '<rect class="zwc-accent-fill" x="9.8" y="14" width="4.4" height="5.6" fill="' + WASH.emerald + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M4.2 4.8H19.8L21.2 10.4H2.8L4.2 4.8ZM5.2 10.4V19.6H18.8V10.4M9.8 19.6V14H14.2V19.6"/>'
    },
    attack: {
      wash:
        '<circle class="zwc-wash-fill" cx="12" cy="12" r="7.2" fill="' + WASH.rose + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="3" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M4.8 19.2L18.8 5.2M14.5 4.8H19.2V9.5M19.2 19.2L5.2 5.2M9.5 4.8H4.8V9.5"/>'
    },
    cash: {
      wash:
        '<rect class="zwc-wash-fill" x="3" y="6.4" width="18" height="11.2" rx="2" fill="' + WASH.emerald + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="12" r="2.8" fill="' + WASH.gold + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="3" y="6.4" width="18" height="11.2" rx="2"/><circle class="zwc-ink-stroke" cx="12" cy="12" r="2.6"/><path class="zwc-ink-stroke" d="M6.2 9.5H6.4M17.6 14.5H17.8"/>'
    },
    energy: {
      wash: '<path class="zwc-wash-fill" d="M13.2 3L5.6 13.2H11.5L10.5 21L18.4 10.6H12.5L13.2 3Z" fill="' + WASH.lime + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M13.2 3L5.6 13.2H11.5L10.5 21L18.4 10.6H12.5L13.2 3Z"/>'
    },
    nerve: {
      wash:
        '<path class="zwc-wash-fill" d="M12 3.5C15.6 7.2 18.2 10.3 18.2 14C18.2 17.5 15.4 20.2 12 20.2C8.6 20.2 5.8 17.5 5.8 14C5.8 11 7.7 8.4 9.8 6.2L10.8 9.4L12 3.5Z" fill="' + WASH.crimson + '"/>' +
        '<path class="zwc-accent-fill" d="M12 10.2C13.8 12.2 14.8 13.8 14.8 15.4C14.8 17 13.5 18.2 12 18.2C10.5 18.2 9.2 17 9.2 15.4C9.2 13.8 10.4 12.1 12 10.2Z" fill="' + WASH.gold + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M12 3.5C15.6 7.2 18.2 10.3 18.2 14C18.2 17.5 15.4 20.2 12 20.2C8.6 20.2 5.8 17.5 5.8 14C5.8 11 7.7 8.4 9.8 6.2L10.8 9.4L12 3.5Z"/>'
    },
    life: {
      wash: '<path class="zwc-wash-fill" d="M12 20C6.8 16.3 3.8 12.8 3.8 9.2C3.8 6.5 5.9 4.6 8.4 4.6C10 4.6 11.3 5.4 12 6.7C12.7 5.4 14 4.6 15.6 4.6C18.1 4.6 20.2 6.5 20.2 9.2C20.2 12.8 17.2 16.3 12 20Z" fill="' + WASH.rose + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M12 20C6.8 16.3 3.8 12.8 3.8 9.2C3.8 6.5 5.9 4.6 8.4 4.6C10 4.6 11.3 5.4 12 6.7C12.7 5.4 14 4.6 15.6 4.6C18.1 4.6 20.2 6.5 20.2 9.2C20.2 12.8 17.2 16.3 12 20ZM7.5 12H10L11.2 9.8L12.8 14.2L14 12H16.5"/>'
    },
    account: {
      wash:
        '<circle class="zwc-wash-fill" cx="12" cy="8.4" r="3.6" fill="' + WASH.cerulean + '"/>' +
        '<path class="zwc-wash-fill" d="M5.2 19.6C6.4 15.6 8.9 14 12 14C15.1 14 17.6 15.6 18.8 19.6H5.2Z" fill="' + WASH.amber + '"/>',
      ink: '<circle class="zwc-ink-stroke" cx="12" cy="8.4" r="3.6"/><path class="zwc-ink-stroke" d="M5.2 19.6C6.4 15.6 8.9 14 12 14C15.1 14 17.6 15.6 18.8 19.6"/>'
    },
    admin: {
      wash:
        '<rect class="zwc-wash-fill" x="4" y="4.8" width="16" height="14.4" rx="2.4" fill="' + WASH.plum + '"/>' +
        '<circle class="zwc-accent-fill" cx="10.2" cy="9.4" r="1.9" fill="' + WASH.cerulean + '"/>' +
        '<circle class="zwc-accent-fill" cx="14.2" cy="14.6" r="1.9" fill="' + WASH.emerald + '"/>',
      ink: '<rect class="zwc-ink-stroke" x="4" y="4.8" width="16" height="14.4" rx="2.4"/><path class="zwc-ink-stroke" d="M7.2 9.4H16.8M7.2 14.6H16.8"/><circle class="zwc-ink-stroke" cx="10.2" cy="9.4" r="1.6"/><circle class="zwc-ink-stroke" cx="14.2" cy="14.6" r="1.6"/>'
    },
    menu: {
      wash: '<rect class="zwc-wash-fill" x="4" y="5.5" width="16" height="13" rx="2" fill="' + WASH.amber + '"/>',
      ink: '<path class="zwc-ink-stroke" d="M4.2 7.2H19.8M4.2 12H19.8M4.2 16.8H19.8"/>'
    },
    close: {
      wash: '',
      ink: '<path class="zwc-ink-stroke" d="M6 6L18 18M18 6L6 18"/>'
    },
    chrono: {
      wash:
        '<circle class="zwc-wash-fill" cx="12" cy="13" r="7.4" fill="' + WASH.cerulean + '"/>' +
        '<circle class="zwc-accent-fill" cx="12" cy="13" r="2.2" fill="' + WASH.gold + '"/>',
      ink: '<circle class="zwc-ink-stroke" cx="12" cy="13" r="7.6"/><path class="zwc-ink-stroke" d="M9.5 3.2H14.5M12 3.2V5.4M12 9.2V13.2L14.8 14.8"/>'
    }
  };

  function renderSketchIcon(iconKey, extraClass) {
    var key = SKETCH_ICONS[iconKey] ? iconKey : 'home';
    var spec = SKETCH_ICONS[key];
    var cls = 'zaaa-vivid-svg zaaa-duotone-svg zwc-sketch-ico' + (extraClass ? ' ' + extraClass : '');
    return (
      '<svg class="' + cls + '" data-zwc-ink="' + key + '" data-zwc-color="v140" viewBox="0 0 24 24" fill="none" ' +
      'stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        (spec.wash || '') +
        spec.ink +
      '</svg>'
    );
  }

  /* Hand-Inked Sun & Crescent Moon Theme Icons */
  var THEME_SVGS =
    '<svg class="zaaa-vivid-svg zwc-sketch-ico zaaa-moon-svg" data-zwc-color="v140" viewBox="0 0 24 24" fill="none" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path class="zwc-wash-fill" d="M19.8 13.6A7.8 7.8 0 1 1 10.4 4.2A6.2 6.2 0 0 0 19.8 13.6Z" fill="' + WASH.gold + '"/>' +
      '<circle class="zwc-accent-fill" cx="16.8" cy="6.6" r="1.4" fill="' + WASH.cerulean + '"/>' +
      '<path class="zwc-ink-stroke" d="M19.8 13.6A7.8 7.8 0 1 1 10.4 4.2A6.2 6.2 0 0 0 19.8 13.6Z"/>' +
    '</svg>' +
    '<svg class="zaaa-vivid-svg zwc-sketch-ico zaaa-sun-svg" data-zwc-color="v140" viewBox="0 0 24 24" fill="none" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle class="zwc-wash-fill" cx="12" cy="12" r="4.8" fill="' + WASH.amber + '"/>' +
      '<circle class="zwc-ink-stroke" cx="12" cy="12" r="4.6"/>' +
      '<path class="zwc-ink-stroke" d="M12 2.8V5M12 19V21.2M5.5 5.5L7.1 7.1M16.9 16.9L18.5 18.5M2.8 12H5M19 12H21.2M5.5 18.5L7.1 16.9M16.9 7.1L18.5 5.5"/>' +
    '</svg>';

  /* Hand-Inked Operative Portrait Avatar (#zone-operative-crest) */
  var OPERATIVE_AVATAR_SVG =
    '<svg class="zaaa-vivid-svg zaaa-duotone-svg zwc-sketch-ico" data-zwc-color="v140" viewBox="0 0 36 36" fill="none" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle class="zwc-wash-fill" cx="18" cy="13.2" r="5.6" fill="' + WASH.gold + '"/>' +
      '<path class="zwc-wash-fill" d="M7.8 30.2C9.4 24.4 13.1 21.8 18 21.8C22.9 21.8 26.6 24.4 28.2 30.2H7.8Z" fill="' + WASH.emerald + '"/>' +
      '<path class="zwc-accent-fill" d="M15.4 22.2L18 26.8L20.6 22.2H15.4Z" fill="' + WASH.crimson + '"/>' +
      '<circle class="zwc-ink-stroke" cx="18" cy="13.2" r="5.6"/>' +
      '<path class="zwc-ink-stroke" d="M7.8 30.2C9.4 24.4 13.1 21.8 18 21.8C22.9 21.8 26.6 24.4 28.2 30.2"/>' +
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
      var lblText = open ? (ar ? 'إغلاق القائمة' : 'Close Menu') : (ar ? 'القائمة' : 'Menu');
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
      syncSidebarNavIcons();
      syncMobileTabbarIcons();
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
      if (ev.key === 'Escape' && isDrawerOpen()) {
        setMobileDrawerOpen(false);
      }
    });

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

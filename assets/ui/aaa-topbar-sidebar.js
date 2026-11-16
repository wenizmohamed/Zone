/* ==========================================================================
 * ZONE - AAA SYNDICATE COMMAND TOPBAR & OPERATIVE SIDEBAR RUNTIME (v127)
 * MotionSites (/icons & /sections/header) 3D Frosted Jewel & Borderless Edition
 * Exclusive Ownership: carbon-hud-chrome
 * Scope: .zone-topbar, [data-zheaderbar], .zone-theme-indicator,
 *        aside.zone-sidebar, .zone-mobile-tabbar
 * Guardrails: Idempotent, React-18/<x-dc> fiber-safe (append-only + CSS order),
 *             zero network calls, zero console errors, zero 600ms DOM polling.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaTopbarSidebarLoaded) return;
  window.__zoneAaaTopbarSidebarLoaded = true;

  var isSyncing = false;
  var svgParserHost = null;

  /* ------------------------------------------------------------------------
   * MOTIONSITES 3D FROSTED-GLASS MULTI-COLOR VECTOR ENGINE (/icons)
   * Every mounted SVG receives deterministic, slot-scoped <linearGradient> IDs
   * (e.g. zaaa-ig-home-a in sidebar, zaaa-ig-top-education-a in topbar,
   * zaaa-ig-hud-cash-a in HUD, zaaa-ig-mob-home-a in mobile tabbar) so
   * hidden/responsive containers NEVER collide or blank out url(#id) fills.
   * ------------------------------------------------------------------------ */
  var PALETTES = {
    gold: {
      a1: '#fef08a', a2: '#f59e0b', a3: '#d97706',
      b1: '#ffffff', b2: '#fbbf24'
    },
    emerald: {
      a1: '#6ee7b7', a2: '#10b981', a3: '#059669',
      b1: '#d1fae5', b2: '#34d399'
    },
    crimson: {
      a1: '#fda4af', a2: '#f43f5e', a3: '#e11d48',
      b1: '#ffe4e6', b2: '#fb7185'
    },
    nerve: {
      a1: '#fda4af', a2: '#f43f5e', a3: '#e11d48',
      b1: '#ffffff', b2: '#fde047'
    },
    cyan: {
      a1: '#67e8f9', a2: '#3b82f6', a3: '#6366f1',
      b1: '#cffafe', b2: '#38bdf8'
    },
    casino: {
      a1: '#f0abfc', a2: '#8b5cf6', a3: '#6d28d9',
      b1: '#fef08a', b2: '#fbbf24'
    },
    copper: {
      a1: '#fcd34d', a2: '#f97316', a3: '#ea580c',
      b1: '#fef3c7', b2: '#fbbf24'
    },
    studio: {
      a1: '#67e8f9', a2: '#8b5cf6', a3: '#ec4899',
      b1: '#fef08a', b2: '#f59e0b'
    }
  };

  var ICON_SPECS = {
    home: {
      pal: 'gold',
      body: function (a, b) {
        return (
          '<path d="M4.5 10.8L12 4.2L19.5 10.8V19.2C19.5 20.2 18.7 21 17.7 21H6.3C5.3 21 4.5 20.2 4.5 19.2V10.8Z" fill="url(#' + a + ')"/>' +
          '<path class="zaaa-stroke-only" d="M2.7 11.4L12 3.2L21.3 11.4" fill="none" stroke="url(#' + b + ')" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M9.6 21V14.9C9.6 13.5 10.7 12.4 12 12.4C13.3 12.4 14.4 13.5 14.4 14.9V21H9.6Z" fill="#ffffff" fill-opacity="0.95"/>' +
          '<polygon points="12,7.1 13.7,8.8 12,10.5 10.3,8.8" fill="#ffffff" fill-opacity="0.95"/>'
        );
      }
    },
    properties: {
      pal: 'gold',
      body: function (a, b) {
        return (
          '<rect x="12.6" y="9.4" width="7.4" height="11.6" rx="2" fill="url(#' + b + ')" fill-opacity="0.92"/>' +
          '<rect x="4" y="3.4" width="10.6" height="17.6" rx="2.4" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="6.6" y="6.6" width="5.4" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.96"/>' +
          '<rect x="6.6" y="10.1" width="5.4" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.92"/>' +
          '<rect x="6.6" y="13.6" width="3.4" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.88"/>' +
          '<rect x="15.2" y="12.6" width="2.6" height="1.6" rx="0.8" fill="#ffffff" fill-opacity="0.92"/>' +
          '<rect x="15.2" y="15.8" width="2.6" height="1.6" rx="0.8" fill="#ffffff" fill-opacity="0.92"/>'
        );
      }
    },
    hof: {
      pal: 'gold',
      body: function (a, b) {
        return (
          '<path class="zaaa-stroke-only" d="M6.6 6H4.7C3.7 6 3 6.8 3 7.8C3 9.4 4.2 10.6 5.8 10.6H6.8M17.4 6H19.3C20.3 6 21 6.8 21 7.8C21 9.4 19.8 10.6 18.2 10.6H17.2" fill="none" stroke="url(#' + b + ')" stroke-width="1.95" stroke-linecap="round"/>' +
          '<path d="M6.4 3.6H17.6V9.4C17.6 12.5 15.1 15 12 15C8.9 15 6.4 12.5 6.4 9.4V3.6Z" fill="url(#' + a + ')"/>' +
          '<rect x="10.8" y="14.4" width="2.4" height="4" rx="0.8" fill="url(#' + b + ')"/>' +
          '<rect x="7.8" y="18" width="8.4" height="2.8" rx="1.3" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M12 5.9L12.95 8.1L15.15 9.05L12.95 10L12 12.2L11.05 10L8.85 9.05L11.05 8.1L12 5.9Z" fill="#ffffff" fill-opacity="0.97"/>'
        );
      }
    },
    missions: {
      pal: 'gold',
      body: function (a) {
        return '<rect x="4.4" y="4.4" width="15.2" height="16.6" rx="3" fill="url(#' + a + ')"/>';
      },
      kinetic: function () {
        return (
          '<rect x="8.5" y="2.6" width="7" height="3.5" rx="1.4" fill="#ffffff" fill-opacity="0.96"/>' +
          '<path class="zaaa-stroke-only" d="M8.4 12.3L10.8 14.7L15.6 9.9" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<rect x="8.4" y="16.8" width="7.2" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.9"/>'
        );
      }
    },
    faction: {
      pal: 'gold',
      body: function (a, b) {
        return (
          '<path d="M12 2.7L20 5.9V11.8C20 16.8 16.5 20.1 12 21.6C7.5 20.1 4 16.8 4 11.8V5.9L12 2.7Z" fill="url(#' + a + ')" stroke="url(#' + b + ')" stroke-width="0.9"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M8.1 13.6L9.3 8.8L12 11.2L14.7 8.8L15.9 13.6H8.1Z" fill="#ffffff" fill-opacity="0.96"/>' +
          '<rect x="8.5" y="14.9" width="7" height="1.6" rx="0.8" fill="#ffffff" fill-opacity="0.92"/>'
        );
      }
    },
    cash: {
      pal: 'emerald',
      body: function (a, b) {
        return (
          '<rect x="3.6" y="4.6" width="17.2" height="11.2" rx="2.6" transform="rotate(-5 12 10)" fill="url(#' + b + ')" fill-opacity="0.62"/>' +
          '<rect x="2.4" y="6.6" width="19.2" height="12.2" rx="2.8" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<circle cx="12" cy="12.7" r="3.1" fill="#ffffff" fill-opacity="0.96"/>' +
          '<circle cx="6" cy="12.7" r="1.15" fill="#ffffff" fill-opacity="0.88"/>' +
          '<circle cx="18" cy="12.7" r="1.15" fill="#ffffff" fill-opacity="0.88"/>'
        );
      }
    },
    bank: {
      pal: 'emerald',
      body: function (a, b) {
        return (
          '<rect x="5" y="9.4" width="14" height="8.2" rx="1" fill="url(#' + b + ')" fill-opacity="0.38"/>' +
          '<path d="M3 9.6L12 3.4L21 9.6H3Z" fill="url(#' + a + ')"/>' +
          '<rect x="3.4" y="17.4" width="17.2" height="3.2" rx="1.3" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="6.1" y="10.3" width="2.2" height="6.4" rx="0.8" fill="#ffffff" fill-opacity="0.95"/>' +
          '<rect x="10.9" y="10.3" width="2.2" height="6.4" rx="0.8" fill="#ffffff" fill-opacity="0.95"/>' +
          '<rect x="15.7" y="10.3" width="2.2" height="6.4" rx="0.8" fill="#ffffff" fill-opacity="0.95"/>' +
          '<circle cx="12" cy="7.1" r="1.15" fill="#ffffff" fill-opacity="0.96"/>'
        );
      }
    },
    gym: {
      pal: 'emerald',
      body: function (a, b) {
        return (
          '<rect x="1.9" y="8.6" width="2.3" height="6.8" rx="1.1" fill="url(#' + b + ')"/>' +
          '<rect x="19.8" y="8.6" width="2.3" height="6.8" rx="1.1" fill="url(#' + b + ')"/>' +
          '<rect x="4.2" y="6" width="4.3" height="12" rx="1.7" fill="url(#' + a + ')"/>' +
          '<rect x="15.5" y="6" width="4.3" height="12" rx="1.7" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="8.1" y="10.5" width="7.8" height="3" rx="1.1" fill="#ffffff" fill-opacity="0.96"/>' +
          '<rect x="5.7" y="7.8" width="1.15" height="4.2" rx="0.55" fill="#ffffff" fill-opacity="0.88"/>' +
          '<rect x="17.15" y="7.8" width="1.15" height="4.2" rx="0.55" fill="#ffffff" fill-opacity="0.88"/>'
        );
      }
    },
    energy: {
      pal: 'emerald',
      body: function (a, b) {
        return (
          '<circle cx="12" cy="12" r="8.8" fill="url(#' + b + ')" fill-opacity="0.22"/>' +
          '<path d="M13.6 2.3L4.5 13.4H11.1L9.7 21.7L19.5 10.6H12.9L13.6 2.3Z" fill="url(#' + a + ')" stroke="url(#' + b + ')" stroke-width="0.7" stroke-linejoin="round"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M12.9 6.3L7.9 12.4H11.6L10.9 17.4L16.1 11.4H12.4L12.9 6.3Z" fill="#ffffff" fill-opacity="0.95"/>'
        );
      }
    },
    market: {
      pal: 'emerald',
      body: function (a, b) {
        return (
          '<rect x="4.8" y="10" width="14.4" height="10.6" rx="2.3" fill="url(#' + a + ')"/>' +
          '<path d="M3.4 9.6L5.3 4.1H18.7L20.6 9.6C19.3 11.3 16.9 11.3 15.6 9.6C14.4 11.3 12.6 11.3 12 9.6C11.4 11.3 9.6 11.3 8.4 9.6C7.1 11.3 4.7 11.3 3.4 9.6Z" fill="url(#' + b + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="9.6" y="14" width="4.8" height="6.6" rx="1.2" fill="#ffffff" fill-opacity="0.95"/>' +
          '<path class="zaaa-stroke-only" d="M9.1 4.6L8.4 9.1M14.9 4.6L15.6 9.1" fill="none" stroke="#064e3b" stroke-opacity="0.45" stroke-width="1.5" stroke-linecap="round"/>'
        );
      }
    },
    crimes: {
      pal: 'crimson',
      body: function (a, b) {
        return (
          '<rect x="9" y="2.6" width="6" height="3.1" rx="1.3" fill="url(#' + b + ')"/>' +
          '<circle cx="12" cy="13" r="8" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<circle class="zaaa-stroke-only" cx="12" cy="13" r="4.6" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5"/>' +
          '<path class="zaaa-stroke-only" d="M12 9.9V13.2L14.5 14.8" fill="none" stroke="#ffffff" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle cx="16.9" cy="4.2" r="1.25" fill="#fde047"/>'
        );
      }
    },
    attack: {
      pal: 'crimson',
      body: function (a, b) {
        return (
          '<circle cx="12" cy="12" r="8.2" fill="url(#' + a + ')"/>' +
          '<path class="zaaa-stroke-only" d="M12 2.2V5.4M12 18.6V21.8M2.2 12H5.4M18.6 12H21.8" fill="none" stroke="url(#' + b + ')" stroke-width="2" stroke-linecap="round"/>'
        );
      },
      kinetic: function () {
        return (
          '<circle class="zaaa-stroke-only" cx="12" cy="12" r="4.4" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="1.75"/>' +
          '<polygon points="12,9.7 14.3,12 12,14.3 9.7,12" fill="#ffffff"/>'
        );
      }
    },
    elimination: {
      pal: 'crimson',
      body: function (a, b) {
        return (
          '<path d="M12 2.7L20 5.9V11.8C20 16.7 16.5 20.1 12 21.6C7.5 20.1 4 16.7 4 11.8V5.9L12 2.7Z" fill="url(#' + a + ')" stroke="url(#' + b + ')" stroke-width="0.9"/>'
        );
      },
      kinetic: function () {
        return (
          '<path class="zaaa-stroke-only" d="M8.8 8.9L15.2 15.3M15.2 8.9L8.8 15.3" fill="none" stroke="#ffffff" stroke-width="2.35" stroke-linecap="round"/>' +
          '<circle cx="12" cy="6.1" r="1.1" fill="#fde047"/>'
        );
      }
    },
    hospital: {
      pal: 'crimson',
      body: function (a, b) {
        return (
          '<path class="zaaa-stroke-only" d="M8.8 6.4V4.7C8.8 3.8 9.5 3.1 10.4 3.1H13.6C14.5 3.1 15.2 3.8 15.2 4.7V6.4" fill="none" stroke="url(#' + b + ')" stroke-width="2.1" stroke-linecap="round"/>' +
          '<rect x="3.2" y="6.2" width="17.6" height="14" rx="3.2" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M10.6 9.6H13.4V11.8H15.6V14.6H13.4V16.8H10.6V14.6H8.4V11.8H10.6V9.6Z" fill="#ffffff" fill-opacity="0.97"/>'
        );
      }
    },
    nerve: {
      pal: 'nerve',
      body: function (a) {
        return (
          '<path d="M12.6 2.2C13.7 5.9 18.5 8.2 18.5 13.5C18.5 17.5 15.6 21 12 21C8.4 21 5.5 17.6 5.5 13.7C5.5 10.6 7.2 8.4 8.9 6.9C8.7 8.9 9.7 10.1 10.9 10.6C10.5 7.7 10.3 5 12.6 2.2Z" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function (a, b) {
        return (
          '<path d="M12.2 10.3C12.9 12.1 14.9 13.2 14.9 15.7C14.9 17.4 13.6 18.8 12 18.8C10.4 18.8 9.2 17.4 9.2 15.7C9.2 14 10.5 12.6 12.2 10.3Z" fill="url(#' + b + ')"/>'
        );
      }
    },
    city: {
      pal: 'cyan',
      body: function (a, b) {
        return (
          '<path d="M12.4 20.6V10H18.4C19.6 10 20.5 10.9 20.5 12.1V20.6H12.4Z" fill="url(#' + b + ')" fill-opacity="0.9"/>' +
          '<path d="M3.8 20.6V6.1C3.8 4.9 4.7 4 5.9 4H11.5C12.7 4 13.6 4.9 13.6 6.1V20.6H3.8Z" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="6.4" y="6.9" width="4.6" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.96"/>' +
          '<rect x="6.4" y="10.4" width="4.6" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.92"/>' +
          '<rect x="6.4" y="13.9" width="2.6" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.88"/>' +
          '<rect x="15.2" y="13" width="2.8" height="1.6" rx="0.8" fill="#ffffff" fill-opacity="0.94"/>' +
          '<rect x="15.2" y="16.2" width="2.8" height="1.6" rx="0.8" fill="#ffffff" fill-opacity="0.94"/>'
        );
      }
    },
    items: {
      pal: 'cyan',
      body: function (a, b) {
        return (
          '<path class="zaaa-stroke-only" d="M8.8 7.2V5.3C8.8 4.4 9.5 3.7 10.4 3.7H13.6C14.5 3.7 15.2 4.4 15.2 5.3V7.2" fill="none" stroke="url(#' + b + ')" stroke-width="2" stroke-linecap="round"/>' +
          '<rect x="3.2" y="7" width="17.6" height="13.2" rx="3" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<rect x="3.2" y="12.2" width="17.6" height="1.5" fill="#ffffff" fill-opacity="0.46"/>' +
          '<rect x="9.8" y="10.6" width="4.4" height="4.6" rx="1.3" fill="#ffffff" fill-opacity="0.96"/>'
        );
      }
    },
    education: {
      pal: 'cyan',
      body: function (a, b) {
        return (
          '<path d="M6.2 11.7V16.6C6.2 18.5 8.8 20 12 20C15.2 20 17.8 18.5 17.8 16.6V11.7L12 14.8L6.2 11.7Z" fill="url(#' + b + ')" fill-opacity="0.9"/>' +
          '<path d="M12 4.1L21.8 9.1L12 14.1L2.2 9.1L12 4.1Z" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<circle cx="12" cy="9.1" r="1.45" fill="#ffffff"/>' +
          '<path class="zaaa-stroke-only" d="M12 9.1L19.7 11.1V15.7" fill="none" stroke="#fde047" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle cx="19.7" cy="16.4" r="1.2" fill="#fde047"/>'
        );
      }
    },
    newspaper: {
      pal: 'cyan',
      body: function (a) {
        return (
          '<path d="M5 5.6C5 4.4 6 3.4 7.2 3.4H14.3L19.6 8.7V18.4C19.6 19.6 18.6 20.6 17.4 20.6H7.2C6 20.6 5 19.6 5 18.4V5.6Z" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<path d="M14.1 3.4V7.5C14.1 8.2 14.7 8.8 15.4 8.8H19.6L14.1 3.4Z" fill="#ffffff" fill-opacity="0.93"/>' +
          '<rect x="8" y="11.6" width="8.2" height="1.8" rx="0.9" fill="#ffffff" fill-opacity="0.96"/>' +
          '<rect x="8" y="15.2" width="5.6" height="1.8" rx="0.9" fill="#ffffff" fill-opacity="0.88"/>'
        );
      }
    },
    account: {
      pal: 'cyan',
      body: function (a) {
        return '<rect x="2.6" y="4.8" width="18.8" height="14.4" rx="3.2" fill="url(#' + a + ')"/>';
      },
      kinetic: function () {
        return (
          '<circle cx="8.8" cy="10.2" r="2.2" fill="#ffffff" fill-opacity="0.96"/>' +
          '<path d="M5.6 16.2C6.2 14.4 7.3 13.5 8.8 13.5C10.3 13.5 11.4 14.4 12 16.2H5.6Z" fill="#ffffff" fill-opacity="0.95"/>' +
          '<rect x="14" y="8.8" width="4.4" height="2.8" rx="0.8" fill="#fde047"/>' +
          '<rect x="14" y="13.6" width="4.4" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.9"/>'
        );
      }
    },
    casino: {
      pal: 'casino',
      body: function (a, b) {
        return (
          '<circle cx="12" cy="12" r="8.8" fill="url(#' + a + ')"/>' +
          '<circle class="zaaa-stroke-only" cx="12" cy="12" r="7" fill="none" stroke="url(#' + b + ')" stroke-width="1.75" stroke-dasharray="2.5 2.5"/>'
        );
      },
      kinetic: function () {
        return '<polygon points="12,7.5 16.2,12 12,16.5 7.8,12" fill="#ffffff" fill-opacity="0.97"/>';
      }
    },
    jobs: {
      pal: 'copper',
      body: function (a, b) {
        return (
          '<path class="zaaa-stroke-only" d="M9 7.3V5.3C9 4.4 9.7 3.7 10.6 3.7H13.4C14.3 3.7 15 4.4 15 5.3V7.3" fill="none" stroke="url(#' + b + ')" stroke-width="2" stroke-linecap="round"/>' +
          '<rect x="3.2" y="7.1" width="17.6" height="12.9" rx="2.9" fill="url(#' + a + ')"/>'
        );
      },
      kinetic: function () {
        return (
          '<path class="zaaa-stroke-only" d="M3.5 12.2C7.6 14 16.4 14 20.5 12.2" fill="none" stroke="#ffffff" stroke-opacity="0.68" stroke-width="1.55" stroke-linecap="round"/>' +
          '<rect x="10.2" y="10.8" width="3.6" height="3.6" rx="1" fill="#ffffff" fill-opacity="0.97"/>'
        );
      }
    },
    jail: {
      pal: 'copper',
      body: function (a) {
        return '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.2" fill="url(#' + a + ')"/>';
      },
      kinetic: function () {
        return (
          '<rect x="7.3" y="5.8" width="1.7" height="12.4" rx="0.85" fill="#ffffff" fill-opacity="0.88"/>' +
          '<rect x="15" y="5.8" width="1.7" height="12.4" rx="0.85" fill="#ffffff" fill-opacity="0.88"/>' +
          '<rect x="9.6" y="9.4" width="4.8" height="5.2" rx="1.2" fill="#ffffff" fill-opacity="0.97"/>' +
          '<circle cx="12" cy="12" r="1" fill="#ea580c"/>'
        );
      }
    },
    menu: {
      pal: 'studio',
      body: function (a, b) {
        return (
          '<rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2.2" fill="url(#' + a + ')"/>' +
          '<rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2.2" fill="url(#' + b + ')"/>' +
          '<rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2.2" fill="url(#' + a + ')" fill-opacity="0.88"/>'
        );
      },
      kinetic: function () {
        return '<rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2.2" fill="#ffffff" fill-opacity="0.96"/>';
      }
    }
  };
  ICON_SPECS.job = ICON_SPECS.jobs;

  function renderVividIcon(iconKey, slotPrefix) {
    var specKey = ICON_SPECS[iconKey] ? iconKey : 'home';
    var spec = ICON_SPECS[specKey];
    var pal = PALETTES[spec.pal] || PALETTES.gold;
    var safeKey = String(iconKey || specKey).replace(/[^a-z0-9_-]/gi, '');
    var prefix = slotPrefix ? String(slotPrefix) + '-' : '';
    var idA = 'zaaa-ig-' + prefix + safeKey + '-a';
    var idB = 'zaaa-ig-' + prefix + safeKey + '-b';

    return (
      '<svg class="zaaa-vivid-svg zaaa-duotone-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="' + idA + '" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">' +
            '<stop offset="0%" stop-color="' + pal.a1 + '"/>' +
            '<stop offset="52%" stop-color="' + pal.a2 + '"/>' +
            '<stop offset="100%" stop-color="' + pal.a3 + '"/>' +
          '</linearGradient>' +
          '<linearGradient id="' + idB + '" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">' +
            '<stop offset="0%" stop-color="' + pal.b1 + '"/>' +
            '<stop offset="100%" stop-color="' + pal.b2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        spec.body(idA, idB) +
        '<g class="zaaa-ico-kinetic">' + spec.kinetic(idA, idB) + '</g>' +
      '</svg>'
    );
  }

  /* Bespoke Multi-Color 3D Brand Prism Crest */
  var BRAND_CREST_SVG =
    '<svg class="zaaa-vivid-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-brand-a" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fef08a"/>' +
          '<stop offset="48%" stop-color="#f59e0b"/>' +
          '<stop offset="100%" stop-color="#d97706"/>' +
        '</linearGradient>' +
        '<linearGradient id="zaaa-ig-brand-b" x1="8" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#6ee7b7"/>' +
          '<stop offset="55%" stop-color="#10b981"/>' +
          '<stop offset="100%" stop-color="#047857"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect x="6" y="6" width="20" height="20" rx="5.5" transform="rotate(45 16 16)" fill="url(#zaaa-ig-brand-a)"/>' +
      '<polygon points="16,4.5 27.5,16 16,16" fill="#ffffff" fill-opacity="0.24"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<polygon points="16,8.8 23.2,16 16,23.2 8.8,16" fill="url(#zaaa-ig-brand-b)"/>' +
        '<polygon points="16,11.8 20.2,16 16,20.2 11.8,16" fill="#ffffff" fill-opacity="0.96"/>' +
        '<circle cx="16" cy="16" r="1.65" fill="#0f172a"/>' +
      '</g>' +
    '</svg>';

  /* Bespoke 3D Cyan-Emerald Chronometer Icon (Zone City Time) */
  var CHRONO_SVG =
    '<svg class="zaaa-vivid-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-chrono-a" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#67e8f9"/>' +
          '<stop offset="52%" stop-color="#10b981"/>' +
          '<stop offset="100%" stop-color="#2563eb"/>' +
        '</linearGradient>' +
        '<linearGradient id="zaaa-ig-chrono-b" x1="8" y1="2" x2="16" y2="6" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fef08a"/>' +
          '<stop offset="100%" stop-color="#f59e0b"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect x="9.2" y="2" width="5.6" height="2.6" rx="1.2" fill="url(#zaaa-ig-chrono-b)"/>' +
      '<circle cx="12" cy="13.2" r="8.2" fill="url(#zaaa-ig-chrono-a)"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<circle class="zaaa-stroke-only" cx="12" cy="13.2" r="5.6" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.3"/>' +
        '<path class="zaaa-stroke-only" d="M12 9.8V13.3L14.6 15" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</g>' +
    '</svg>';

  /* Bespoke 3D Sunburst & Royal Crescent Moon Theme Icons */
  var THEME_SVGS =
    '<svg class="zaaa-vivid-svg zaaa-moon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-moon-a" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fef08a"/>' +
          '<stop offset="55%" stop-color="#fbbf24"/>' +
          '<stop offset="100%" stop-color="#d97706"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M20.6 13.4A8.6 8.6 0 1 1 10.6 3.4A6.7 6.7 0 0 0 20.6 13.4Z" fill="url(#zaaa-ig-moon-a)"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<path d="M17.5 4.2L18.1 5.7L19.6 6.3L18.1 6.9L17.5 8.4L16.9 6.9L15.4 6.3L16.9 5.7L17.5 4.2Z" fill="#67e8f9"/>' +
        '<circle cx="14.2" cy="9.2" r="1.05" fill="#ffffff"/>' +
      '</g>' +
    '</svg>' +
    '<svg class="zaaa-vivid-svg zaaa-sun-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-sun-a" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fef08a"/>' +
          '<stop offset="55%" stop-color="#f59e0b"/>' +
          '<stop offset="100%" stop-color="#ea580c"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="12" cy="12" r="5.2" fill="url(#zaaa-ig-sun-a)"/>' +
      '<circle cx="10.6" cy="10.5" r="1.6" fill="#ffffff" fill-opacity="0.65"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<path class="zaaa-stroke-only" d="M12 2.2V4.6M12 19.4V21.8M4.9 4.9L6.6 6.6M17.4 17.4L19.1 19.1M2.2 12H4.6M19.4 12H21.8M4.9 19.1L6.6 17.4M17.4 6.6L19.1 4.9" fill="none" stroke="#f59e0b" stroke-width="2.1" stroke-linecap="round"/>' +
      '</g>' +
    '</svg>';

  /* Bespoke 3D Engine Studio Sliders & Spark Icon (Admin Pill) */
  var ADMIN_STUDIO_SVG =
    '<svg class="zaaa-vivid-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-admin-a" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#67e8f9"/>' +
          '<stop offset="50%" stop-color="#8b5cf6"/>' +
          '<stop offset="100%" stop-color="#ec4899"/>' +
        '</linearGradient>' +
        '<linearGradient id="zaaa-ig-admin-b" x1="12" y1="2" x2="22" y2="12" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fef08a"/>' +
          '<stop offset="100%" stop-color="#f59e0b"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect x="3" y="4" width="18" height="16" rx="4" fill="url(#zaaa-ig-admin-a)"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<rect x="6.5" y="8.4" width="11" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.72"/>' +
        '<rect x="6.5" y="13.9" width="11" height="1.7" rx="0.85" fill="#ffffff" fill-opacity="0.72"/>' +
        '<circle cx="10.2" cy="9.25" r="2.1" fill="#ffffff"/>' +
        '<circle cx="14.2" cy="14.75" r="2.1" fill="url(#zaaa-ig-admin-b)"/>' +
      '</g>' +
    '</svg>';

  /* Bespoke 3D Noir Syndicate Operative Avatar (#zone-operative-crest) */
  var OPERATIVE_AVATAR_SVG =
    '<svg class="zaaa-vivid-svg zaaa-duotone-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zaaa-ig-avatar-a" x1="6" y1="6" x2="30" y2="32" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fde047"/>' +
          '<stop offset="52%" stop-color="#f59e0b"/>' +
          '<stop offset="100%" stop-color="#d97706"/>' +
        '</linearGradient>' +
        '<linearGradient id="zaaa-ig-avatar-b" x1="11" y1="8" x2="25" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#67e8f9"/>' +
          '<stop offset="100%" stop-color="#3b82f6"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="18" cy="18" r="15" fill="url(#zaaa-ig-avatar-b)" fill-opacity="0.16"/>' +
      '<path d="M7.6 31C9.1 25.1 12.9 22.4 18 22.4C23.1 22.4 26.9 25.1 28.4 31H7.6Z" fill="url(#zaaa-ig-avatar-a)"/>' +
      '<path d="M15.6 22.6L18 27.8L20.4 22.6H15.6Z" fill="#ffffff" fill-opacity="0.92"/>' +
      '<g class="zaaa-ico-kinetic">' +
        '<circle cx="18" cy="14.4" r="5.8" fill="url(#zaaa-ig-avatar-b)"/>' +
        '<rect x="13.6" y="13" width="8.8" height="2.6" rx="1.3" fill="#ffffff" fill-opacity="0.96"/>' +
        '<rect x="14.8" y="13.6" width="6.4" height="1.4" rx="0.7" fill="#10b981"/>' +
      '</g>' +
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

  /* Cached DOM references for zero-querySelectorAll 2000ms telemetry diff */
  var hudCache = {
    hudEl: null,
    cashSrcEl: null,
    energyTrackEl: null,
    energyFigEl: null,
    nerveTrackEl: null,
    nerveFigEl: null,
    cashValEl: null,
    energyPillEl: null,
    energyValEl: null,
    nervePillEl: null,
    nerveValEl: null,
    cityCodeEl: null,
    cityValEl: null,
    timerEls: [],
    lastCash: '',
    lastEnergy: '',
    lastEnergyPct: -1,
    lastNerve: '',
    lastNervePct: -1,
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

  function formatMoney(n) {
    var val = Math.max(0, Math.round(Number(n) || 0));
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

      if (!ar && textNode && /^\s*your character record\s*$/i.test(textNode.nodeValue || '')) {
        textNode.nodeValue = 'Dossier';
        rawLabel = 'Dossier';
      }

      var meta = classifyHeaderLink(rawLabel, i);
      var slotId = 'top-' + i;

      var iconEl = btn.querySelector('.zaaa-link-icon');
      if (!iconEl) {
        iconEl = document.createElement('span');
        iconEl.className = 'zaaa-link-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.innerHTML = renderVividIcon(meta.key, slotId);
        btn.appendChild(iconEl);
      } else if (iconEl.getAttribute('data-ico') !== meta.key) {
        iconEl.innerHTML = renderVividIcon(meta.key, slotId);
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
   * 3. UNIFIED LIVE SYNDICATE HUD CAPSULE (#zone-topbar-hud)
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
    try {
      if (window.__zoneGame && window.__zoneGame.p && Number.isFinite(Number(window.__zoneGame.p.cash))) {
        return formatMoney(window.__zoneGame.p.cash);
      }
    } catch (_) {}
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
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderVividIcon('cash', 'hud') + '</span>' +
        '<bdi class="zaaa-hud-val">$0</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-energy" data-hud="energy">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderVividIcon('energy', 'hud') + '</span>' +
        '<bdi class="zaaa-hud-val">100/100</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-nerve" data-hud="nerve">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderVividIcon('nerve', 'hud') + '</span>' +
        '<bdi class="zaaa-hud-val">15/15</bdi>' +
      '</button>' +
      '<button type="button" class="zaaa-hud-pill zaaa-hud-city" data-hud="city">' +
        '<span class="zaaa-hud-ico" aria-hidden="true">' + renderVividIcon('city', 'hud') + '</span>' +
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

    var cashPill = hud.querySelector('[data-hud="cash"]');
    var energyPill = hud.querySelector('[data-hud="energy"]');
    var nervePill = hud.querySelector('[data-hud="nerve"]');
    var cityPill = hud.querySelector('[data-hud="city"]');

    hudCache.cashValEl = cashPill ? cashPill.querySelector('.zaaa-hud-val') : null;
    hudCache.energyPillEl = energyPill;
    hudCache.energyValEl = energyPill ? energyPill.querySelector('.zaaa-hud-val') : null;
    hudCache.nervePillEl = nervePill;
    hudCache.nerveValEl = nervePill ? nervePill.querySelector('.zaaa-hud-val') : null;
    hudCache.cityCodeEl = cityPill ? cityPill.querySelector('.zaaa-hud-city-code') : null;
    hudCache.cityValEl = cityPill ? cityPill.querySelector('.zaaa-hud-val') : null;

    var ar = isArabic();
    if (cashPill) cashPill.title = ar ? 'النقد المتاح - افتح الخزنة' : 'Liquid Cash - Open Bank Vault';
    if (energyPill) energyPill.title = ar ? 'الطاقة القتالية - افتح النادي' : 'Energy - Open Gym';
    if (nervePill) nervePill.title = ar ? 'الجرأة الميدانية - افتح الجرائم' : 'Nerve - Open Street Crimes';
    if (cityPill) cityPill.title = ar ? 'الموقع الحالي - انتقل إلى خريطة المدينة' : 'Active Sector - Open City Map';
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

    var clockSpan = actions.querySelector(':scope > span:first-child');
    if (clockSpan && !clockSpan.querySelector('.zaaa-chrono-ico')) {
      var chronoWrap = document.createElement('span');
      chronoWrap.className = 'zaaa-chrono-ico';
      chronoWrap.setAttribute('aria-hidden', 'true');
      chronoWrap.innerHTML = CHRONO_SVG;
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

    var adminLink = actions.querySelector(':scope > a');
    if (adminLink && !adminLink.querySelector('.zaaa-admin-ico')) {
      var adminWrap = document.createElement('span');
      adminWrap.className = 'zaaa-admin-ico';
      adminWrap.setAttribute('aria-hidden', 'true');
      adminWrap.innerHTML = ADMIN_STUDIO_SVG;
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
   * 7. SIDEBAR DISTRICT 3D FROSTED ICONS (#zone-area-navigation .zone-nav-icon)
   * ------------------------------------------------------------------------ */
  function resolveNavIconKey(screenId) {
    var key = String(screenId || '').trim().toLowerCase();
    if (ICON_SPECS[key]) return key;
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
    var seenKeys = {};

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var iconBox = btn.querySelector('.zone-nav-icon');
      if (!iconBox) continue;

      var key = resolveNavIconKey(btn.getAttribute('data-zone-screen'));
      var slotPrefix = seenKeys[key] ? 'nav' + i : '';
      seenKeys[key] = true;

      var existing = iconBox.querySelector('svg.zaaa-vivid-svg');
      if (!existing) {
        var svgEl = parseSvgElement(renderVividIcon(key, slotPrefix));
        if (svgEl) {
          svgEl.setAttribute('data-ico', key);
          iconBox.appendChild(svgEl);
        }
      } else if (existing.getAttribute('data-ico') !== key) {
        var nextSvg = parseSvgElement(renderVividIcon(key, slotPrefix));
        if (nextSvg) {
          existing.setAttribute('data-ico', key);
          existing.innerHTML = nextSvg.innerHTML;
        }
      }

      if (iconBox.getAttribute('data-zaaa-duotone') !== '1') {
        iconBox.setAttribute('data-zaaa-duotone', '1');
      }
      if (iconBox.getAttribute('data-zaaa-vivid') !== '1') {
        iconBox.setAttribute('data-zaaa-vivid', '1');
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 8. MOBILE BOTTOM-BAR 3D FROSTED ICONS (.zone-mobile-tabbar)
   *    Replaces plain monochrome text symbols (◆ ◈ ▲ ■ ✕ ☰) with vibrant
   *    multi-color SVGs while keeping React's 2 <span> children untouched.
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
        mobIco.innerHTML = renderVividIcon(key, 'mob-' + i);
        btn.appendChild(mobIco);
      } else if (mobIco.getAttribute('data-ico') !== key) {
        mobIco.setAttribute('data-ico', key);
        mobIco.innerHTML = renderVividIcon(key, 'mob-' + i);
      }

      if (btn.getAttribute('data-zaaa-mob') !== key) {
        btn.setAttribute('data-zaaa-mob', key);
      }
    }
  }

  /* ------------------------------------------------------------------------
   * MASTER SYNC ORCHESTRATION
   * Zero 600ms full-DOM polling! Runs syncAll() ONLY on boot, zone:render,
   * and html lang/dir/data-theme changes, plus a 2000ms cached-node text diff.
   * ------------------------------------------------------------------------ */
  function syncAll() {
    if (isSyncing) return;
    if (document.querySelector('x-dc')) return;
    isSyncing = true;
    try {
      syncBrand();
      syncHeaderLinks();
      syncTopbarHud();
      syncHeaderActions();
      syncOperativeCrest();
      syncSidebarVitals();
      syncSidebarNavIcons();
      syncMobileTabbarIcons();
    } catch (_) {
      /* Never emit console errors */
    } finally {
      isSyncing = false;
    }
  }

  function syncCachedHudDiff() {
    if (document.hidden || isSyncing) return;
    try {
      if (!hudCache.hudEl || !hudCache.hudEl.isConnected) {
        syncAll();
        return;
      }
      applyCachedHudValues();
      for (var i = 0; i < hudCache.timerEls.length; i++) {
        updateTimerAttr(hudCache.timerEls[i]);
      }
    } catch (_) {}
  }

  function boot() {
    syncAll();
    window.setTimeout(syncAll, 180);
    window.setTimeout(syncAll, 650);

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

    window.setInterval(syncCachedHudDiff, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

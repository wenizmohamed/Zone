/* ==========================================================================
 * ZONE - AAA SYNDICATE COMMAND TOPBAR & OPERATIVE SIDEBAR RUNTIME (v126)
 * MotionSites (/icons & /sections/header) Human Studio Craft Edition
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
   * MOTIONSITES TRANSLUCENT DUOTONE VECTOR PACK (/icons)
   * 2-plane construction:
   *   1) Tinted translucent back-plane (.zaaa-duo-back, fill-opacity 0.32-0.36)
   *      matched to district domain (#39e7a3 emerald, #ebb858 gold,
   *      #f43f5e crimson, #60a5fa ice)
   *   2) Crisp foreground stroke (.zaaa-duo-stroke, stroke="currentColor",
   *      stroke-width="1.85", round caps & joins)
   * ------------------------------------------------------------------------ */
  function duotoneSvg(backMarkup, strokeMarkup) {
    return (
      '<svg class="zaaa-duotone-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        backMarkup +
        strokeMarkup +
      '</svg>'
    );
  }

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
      '<polygon points="16,6.2 25.8,16 16,25.8 6.2,16" fill="#EBB858" fill-opacity="0.22" stroke="url(#zaaaGoldGrad)" stroke-width="1" stroke-opacity="0.76"/>' +
      '<line x1="16" y1="2" x2="16" y2="9" stroke="#FBBF24" stroke-width="1.35" stroke-linecap="round"/>' +
      '<line x1="16" y1="23" x2="16" y2="30" stroke="#FBBF24" stroke-width="1.35" stroke-linecap="round"/>' +
      '<line x1="2" y1="16" x2="9" y2="16" stroke="#FBBF24" stroke-width="1.35" stroke-linecap="round"/>' +
      '<line x1="23" y1="16" x2="30" y2="16" stroke="#FBBF24" stroke-width="1.35" stroke-linecap="round"/>' +
      '<polygon points="16,11.2 20.8,16 16,20.8 11.2,16" fill="url(#zaaaGoldGrad)"/>' +
      '<circle cx="16" cy="16" r="1.8" fill="#090D16"/>' +
    '</svg>';

  /* Header Command Dock Duotone Icons (.zone-header-links) */
  var LINK_ICONS = {
    education: duotoneSvg(
      '<path class="zaaa-duo-back" d="M12 5L21 9.5L12 14L3 9.5L12 5ZM6.5 12.2V16.5C6.5 18.2 9 19.5 12 19.5C15 19.5 17.5 18.2 17.5 16.5V12.2L12 15L6.5 12.2Z" fill="#60a5fa" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M21.5 9.5L12 4.8L2.5 9.5L12 14.2L21.5 9.5ZM6.5 12V16.5C6.5 18.2 9 19.5 12 19.5C15 19.5 17.5 18.2 17.5 16.5V12M21.5 9.5V14.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    newspaper: duotoneSvg(
      '<path class="zaaa-duo-back" d="M5 5.5C5 4.67 5.67 4 6.5 4H14.5L19.5 9V18.5C19.5 19.33 18.83 20 18 20H6.5C5.67 20 5 19.33 5 18.5V5.5Z" fill="#60a5fa" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M14.5 4H6.5C5.67 4 5 4.67 5 5.5V18.5C5 19.33 5.67 20 6.5 20H18C18.83 20 19.5 19.33 19.5 18.5V9L14.5 4ZM14.5 4V9H19.5M8.5 13H16M8.5 16.5H13" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    faction: duotoneSvg(
      '<path class="zaaa-duo-back" d="M12 3.5L19.5 6.5V12.2C19.5 16.8 16.2 19.8 12 21.2C7.8 19.8 4.5 16.8 4.5 12.2V6.5L12 3.5Z" fill="#ebb858" fill-opacity="0.35"/>',
      '<path class="zaaa-duo-stroke" d="M12 3.5L19.5 6.5V12.2C19.5 16.8 16.2 19.8 12 21.2C7.8 19.8 4.5 16.8 4.5 12.2V6.5L12 3.5ZM9.2 12.2L11.2 14.2L15.2 10.2" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    account: duotoneSvg(
      '<rect class="zaaa-duo-back" x="3" y="5" width="18" height="14" rx="2.2" fill="#60a5fa" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M5.2 5H18.8C20 5 21 6 21 7.2V16.8C21 18 20 19 18.8 19H5.2C4 19 3 18 3 16.8V7.2C3 6 4 5 5.2 5ZM9 11.2A2 2 0 1 0 9 7.2A2 2 0 0 0 9 11.2ZM6.3 15.8C6.9 14.5 7.8 13.8 9 13.8C10.2 13.8 11.1 14.5 11.7 15.8M14.8 9.8H18M14.8 13.5H18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    hof: duotoneSvg(
      '<path class="zaaa-duo-back" d="M7 4H17V9.5C17 12.26 14.76 14.5 12 14.5C9.24 14.5 7 12.26 7 9.5V4Z" fill="#ebb858" fill-opacity="0.36"/>',
      '<path class="zaaa-duo-stroke" d="M7 4H17V9.5C17 12.26 14.76 14.5 12 14.5C9.24 14.5 7 12.26 7 9.5V4ZM7 6H4.8C3.8 6 3 6.8 3 7.8C3 9.2 4.1 10.3 5.5 10.3H7M17 6H19.2C20.2 6 21 6.8 21 7.8C21 9.2 19.9 10.3 18.5 10.3H17M12 14.5V18.5M8 20.5H16" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    )
  };

  /* Live Topbar Telemetry Duotone Icons (#zone-topbar-hud) */
  var HUD_ICONS = {
    cash: duotoneSvg(
      '<rect class="zaaa-duo-back" x="2.5" y="6" width="19" height="12" rx="2.2" fill="#39e7a3" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M4.7 6H19.3C20.5 6 21.5 7 21.5 8.2V15.8C21.5 17 20.5 18 19.3 18H4.7C3.5 18 2.5 17 2.5 15.8V8.2C2.5 7 3.5 6 4.7 6ZM14.5 12A2.5 2.5 0 1 1 9.5 12A2.5 2.5 0 0 1 14.5 12ZM6 12H6.01M18 12H18.01" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    energy: duotoneSvg(
      '<path class="zaaa-duo-back" d="M13.2 2.8L4.8 13.6H11L9.8 21.2L19.2 10.4H13L13.2 2.8Z" fill="#39e7a3" fill-opacity="0.36"/>',
      '<path class="zaaa-duo-stroke" d="M13.2 2.8L4.8 13.6H11L9.8 21.2L19.2 10.4H13L13.2 2.8Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    nerve: duotoneSvg(
      '<path class="zaaa-duo-back" d="M12.4 2.8C13.2 6 17.5 8.1 17.5 13A5.5 5.5 0 0 1 6.5 13C6.5 10.3 8 8.4 9.3 7.1C9.1 8.9 10.1 10 11.2 10.5C10.9 8 10.4 5.5 12.4 2.8Z" fill="#f43f5e" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M12.4 2.8C13.2 6 17.5 8.1 17.5 13A5.5 5.5 0 0 1 6.5 13C6.5 10.3 8 8.4 9.3 7.1C9.1 8.9 10.1 10 11.2 10.5C10.9 8 10.4 5.5 12.4 2.8Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    city: duotoneSvg(
      '<path class="zaaa-duo-back" d="M4.5 20V8L11.5 4V20H4.5ZM11.5 10.5H19.5V20H11.5V10.5Z" fill="#ebb858" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M3 20H21M4.5 20V8L11.5 4V20M11.5 10.5H19.5V20M8 10V10.01M8 14V14.01M15.5 14V14.01M15.5 17V17.01" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    )
  };

  /* Sidebar District Navigation Duotone Icons (all 19+ screens) */
  var JOB_DUOTONE = duotoneSvg(
    '<rect class="zaaa-duo-back" x="3.5" y="7.5" width="17" height="12.5" rx="2" fill="#ebb858" fill-opacity="0.34"/>',
    '<path class="zaaa-duo-stroke" d="M9 7.5V5.5C9 4.67 9.67 4 10.5 4H13.5C14.33 4 15 4.67 15 5.5V7.5M3.5 13C7.2 14.6 16.8 14.6 20.5 13M5.5 7.5H18.5C19.6 7.5 20.5 8.4 20.5 9.5V18C20.5 19.1 19.6 20 18.5 20H5.5C4.4 20 3.5 19.1 3.5 18V9.5C3.5 8.4 4.4 7.5 5.5 7.5Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
  );

  var NAV_DUOTONE_ICONS = {
    home: duotoneSvg(
      '<path class="zaaa-duo-back" d="M5 10.5L12 4.5L19 10.5V19.5C19 20.05 18.55 20.5 18 20.5H6C5.45 20.5 5 20.05 5 19.5V10.5Z" fill="#ebb858" fill-opacity="0.35"/>',
      '<path class="zaaa-duo-stroke" d="M3 11L12 3.5L21 11M5.5 9.8V19.5C5.5 20.05 5.95 20.5 6.5 20.5H17.5C18.05 20.5 18.5 20.05 18.5 19.5V9.8M9.75 20.5V14.5H14.25V20.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    items: duotoneSvg(
      '<rect class="zaaa-duo-back" x="3.5" y="7.5" width="17" height="12" rx="2.2" fill="#60a5fa" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M8.5 7.5V5.8C8.5 4.8 9.3 4 10.3 4H13.7C14.7 4 15.5 4.8 15.5 5.8V7.5M3.5 12.5H20.5M12 10.8V14.2M5.5 7.5H18.5C19.6 7.5 20.5 8.4 20.5 9.5V17.5C20.5 18.6 19.6 19.5 18.5 19.5H5.5C4.4 19.5 3.5 18.6 3.5 17.5V9.5C3.5 8.4 4.4 7.5 5.5 7.5Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    city: duotoneSvg(
      '<path class="zaaa-duo-back" d="M4.5 20V8L11.5 4V20H4.5ZM11.5 10.5H19.5V20H11.5V10.5Z" fill="#60a5fa" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M3 20H21M4.5 20V8L11.5 4V20M11.5 10.5H19.5V20M7.8 10V10.01M7.8 13.5V13.51M7.8 17V17.01M15.5 13.5V13.51M15.5 17V17.01" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    job: JOB_DUOTONE,
    jobs: JOB_DUOTONE,
    bank: duotoneSvg(
      '<path class="zaaa-duo-back" d="M4 9.5L12 4L20 9.5H4ZM5.5 9.5H18.5V18H5.5V9.5Z" fill="#39e7a3" fill-opacity="0.33"/>',
      '<path class="zaaa-duo-stroke" d="M3.5 9.5L12 3.8L20.5 9.5H3.5ZM4 20H20M6.5 9.5V17M10.2 9.5V17M13.8 9.5V17M17.5 9.5V17M4.5 17H19.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    gym: duotoneSvg(
      '<path class="zaaa-duo-back" d="M5 7.5H8V16.5H5V7.5ZM16 7.5H19V16.5H16V7.5Z" fill="#39e7a3" fill-opacity="0.36"/>',
      '<path class="zaaa-duo-stroke" d="M2.5 12H5M19 12H21.5M8 12H16M5 7.5H8V16.5H5V7.5ZM16 7.5H19V16.5H16V7.5ZM3 9.5V14.5M21 9.5V14.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    crimes: duotoneSvg(
      '<circle class="zaaa-duo-back" cx="12" cy="13" r="7.5" fill="#f43f5e" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M8.5 6.3V4.8C8.5 3.8 9.3 3 10.3 3H13.7C14.7 3 15.5 3.8 15.5 4.8V6.3M19.5 13A7.5 7.5 0 1 1 4.5 13A7.5 7.5 0 0 1 19.5 13ZM12 13L15.2 9.8M12 13V16.2" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    missions: duotoneSvg(
      '<rect class="zaaa-duo-back" x="5" y="4.5" width="14" height="16" rx="2" fill="#ebb858" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M9 4.5H7C5.9 4.5 5 5.4 5 6.5V18.5C5 19.6 5.9 20.5 7 20.5H17C18.1 20.5 19 19.6 19 18.5V6.5C19 5.4 18.1 4.5 17 4.5H15M9 3.5H15V6H9V3.5ZM8.5 11.5L10.8 13.8L15.5 9.2M8.5 16.8H15.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    attack: duotoneSvg(
      '<circle class="zaaa-duo-back" cx="12" cy="12" r="7.2" fill="#f43f5e" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M19.2 12A7.2 7.2 0 1 1 4.8 12A7.2 7.2 0 0 1 19.2 12ZM12 2.5V6.2M12 17.8V21.5M2.5 12H6.2M17.8 12H21.5M13.8 12A1.8 1.8 0 1 1 10.2 12A1.8 1.8 0 0 1 13.8 12Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    elimination: duotoneSvg(
      '<path class="zaaa-duo-back" d="M12 3.5L19.5 6.5V12C19.5 16.5 16.2 19.6 12 21C7.8 19.6 4.5 16.5 4.5 12V6.5L12 3.5Z" fill="#f43f5e" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M12 3.5L19.5 6.5V12C19.5 16.5 16.2 19.6 12 21C7.8 19.6 4.5 16.5 4.5 12V6.5L12 3.5ZM9 9.5L15 15.5M15 9.5L9 15.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    properties: duotoneSvg(
      '<path class="zaaa-duo-back" d="M5 20V5.5C5 4.67 5.67 4 6.5 4H14.5C15.33 4 16 4.67 16 5.5V20H5Z" fill="#ebb858" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M3 20H21M5 20V5.5C5 4.67 5.67 4 6.5 4H14.5C15.33 4 16 4.67 16 5.5V20M16 11H19.5C20.05 11 20.5 11.45 20.5 12V20M8.5 8H12.5M8.5 11.5H12.5M9.5 20V15.5H11.5V20" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    education: LINK_ICONS.education,
    hospital: duotoneSvg(
      '<rect class="zaaa-duo-back" x="3.5" y="6.5" width="17" height="13" rx="2.4" fill="#f43f5e" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M8.5 6.5V5C8.5 4.17 9.17 3.5 10 3.5H14C14.83 3.5 15.5 4.17 15.5 5V6.5M12 10V16M9 13H15M5.9 6.5H18.1C19.4 6.5 20.5 7.6 20.5 8.9V17.1C20.5 18.4 19.4 19.5 18.1 19.5H5.9C4.6 19.5 3.5 18.4 3.5 17.1V8.9C3.5 7.6 4.6 6.5 5.9 6.5Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    jail: duotoneSvg(
      '<rect class="zaaa-duo-back" x="4" y="4" width="16" height="16" rx="2" fill="#ebb858" fill-opacity="0.32"/>',
      '<path class="zaaa-duo-stroke" d="M4 4H20V20H4V4ZM8 4V20M12 4V9.5M12 14.5V20M16 4V20M9.8 10H14.2V14.2H9.8V10Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    casino: duotoneSvg(
      '<circle class="zaaa-duo-back" cx="12" cy="12" r="8.2" fill="#ebb858" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M20.2 12A8.2 8.2 0 1 1 3.8 12A8.2 8.2 0 0 1 20.2 12ZM12 8.2L15.8 12L12 15.8L8.2 12L12 8.2ZM12 3.8V6M12 18V20.2M3.8 12H6M18 12H20.2" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    market: duotoneSvg(
      '<path class="zaaa-duo-back" d="M4.5 9.5L6 5H18L19.5 9.5V19C19.5 19.83 18.83 20.5 18 20.5H6C5.17 20.5 4.5 19.83 4.5 19V9.5Z" fill="#39e7a3" fill-opacity="0.34"/>',
      '<path class="zaaa-duo-stroke" d="M4 9.5L5.8 4.5H18.2L20 9.5M4 9.5C4 11 5.1 12 6.5 12C7.9 12 9 11 9 9.5C9 11 10.3 12 12 12C13.7 12 15 11 15 9.5C15 11 16.1 12 17.5 12C18.9 12 20 11 20 9.5M5 11.5V19C5 19.83 5.67 20.5 6.5 20.5H17.5C18.33 20.5 19 19.83 19 19V11.5M9.5 20.5V15.5H14.5V20.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    faction: LINK_ICONS.faction,
    newspaper: LINK_ICONS.newspaper,
    hof: LINK_ICONS.hof,
    account: LINK_ICONS.account
  };

  var THEME_SVGS =
    '<svg class="zaaa-moon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#fbbf24" fill-opacity="0.34" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
    '<svg class="zaaa-sun-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4.4" fill="#f59e0b" fill-opacity="0.36" stroke="currentColor" stroke-width="1.85"/>' +
      '<path d="M12 2v2.4M12 19.6V22M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M2 12h2.4M19.6 12H22M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  var OPERATIVE_AVATAR_SVG =
    '<svg class="zaaa-duotone-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle class="zaaa-duo-back" cx="18" cy="18" r="14.5" fill="#ebb858" fill-opacity="0.14"/>' +
      '<path class="zaaa-duo-back" d="M8.2 30.8C9.5 25.4 13.1 22.8 18 22.8C22.9 22.8 26.5 25.4 27.8 30.8H8.2Z" fill="#ebb858" fill-opacity="0.34"/>' +
      '<path class="zaaa-duo-back" d="M12.3 15.1C12.3 11.5 14.8 8.8 18 8.8C21.2 8.8 23.7 11.5 23.7 15.1C23.7 18.2 21.3 20.6 18 20.6C14.7 20.6 12.3 18.2 12.3 15.1Z" fill="#60a5fa" fill-opacity="0.28"/>' +
      '<circle cx="18" cy="18" r="15" stroke="rgba(235,184,88,0.42)" stroke-width="1.25" stroke-dasharray="3 2.2"/>' +
      '<path class="zaaa-duo-stroke" d="M8.2 30.8C9.5 25.4 13.1 22.8 18 22.8C22.9 22.8 26.5 25.4 27.8 30.8" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path class="zaaa-duo-stroke" d="M12.3 15.1C12.3 11.5 14.8 8.8 18 8.8C21.2 8.8 23.7 11.5 23.7 15.1C23.7 18.2 21.3 20.6 18 20.6C14.7 20.6 12.3 18.2 12.3 15.1Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M14.5 14.8H21.5" stroke="#39E7A3" stroke-width="2" stroke-linecap="round"/>' +
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

  var svgParserHost = null;

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
      cashPill.title = ar ? 'النقد المتاح - افتح الخزنة' : 'Liquid Cash - Open Bank Vault';
    }

    var energyPill = hud.querySelector('[data-hud="energy"]');
    if (energyPill) {
      setTextIfChanged(energyPill.querySelector('.zaaa-hud-val'), energy.cur + '/' + energy.max);
      energyPill.style.setProperty('--zaaa-pct', energy.pct + '%');
      energyPill.title = ar ? 'الطاقة القتالية - افتح النادي' : 'Energy - Open Gym';
    }

    var nervePill = hud.querySelector('[data-hud="nerve"]');
    if (nervePill) {
      setTextIfChanged(nervePill.querySelector('.zaaa-hud-val'), nerve.cur + '/' + nerve.max);
      nervePill.style.setProperty('--zaaa-pct', nerve.pct + '%');
      nervePill.title = ar ? 'الجرأة الميدانية - افتح الجرائم' : 'Nerve - Open Street Crimes';
    }

    var cityPill = hud.querySelector('[data-hud="city"]');
    if (cityPill) {
      setTextIfChanged(cityPill.querySelector('.zaaa-hud-city-code'), city.code);
      setTextIfChanged(cityPill.querySelector('.zaaa-hud-val'), city.name);
      cityPill.title = ar ? 'الموقع الحالي - انتقل إلى خريطة المدينة' : 'Active Sector - Open City Map';
    }
  }

  /* ------------------------------------------------------------------------
   * 4. THEME INDICATOR (.zone-theme-indicator) - Duotone Moon / Sunburst SVG
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
   * 6. SIDEBAR VITALS TIMER SYNC (Eliminates Overlapping "FULL" Collision)
   * ------------------------------------------------------------------------ */
  function syncSidebarVitals() {
    var timers = document.querySelectorAll('aside.zone-sidebar .zone-resource .zone-resource-timer');
    for (var i = 0; i < timers.length; i++) {
      var timerEl = timers[i];
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
  }

  /* ------------------------------------------------------------------------
   * 7. SIDEBAR DISTRICT DUOTONE ICONS (#zone-area-navigation .zone-nav-icon)
   *    React-18 Fiber safe: keeps React's original svg:first-child intact
   *    (hidden via CSS) and appends svg.zaaa-duotone-svg at the end.
   * ------------------------------------------------------------------------ */
  function resolveNavIconKey(screenId) {
    var key = String(screenId || '').trim().toLowerCase();
    if (NAV_DUOTONE_ICONS[key]) return key;
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
      var markup = NAV_DUOTONE_ICONS[key] || NAV_DUOTONE_ICONS.home;
      var existing = iconBox.querySelector('svg.zaaa-duotone-svg');

      if (!existing) {
        var svgEl = parseSvgElement(markup);
        if (svgEl) {
          svgEl.setAttribute('data-ico', key);
          iconBox.appendChild(svgEl);
        }
      } else if (existing.getAttribute('data-ico') !== key) {
        var nextSvg = parseSvgElement(markup);
        if (nextSvg) {
          existing.setAttribute('data-ico', key);
          existing.innerHTML = nextSvg.innerHTML;
        }
      }

      if (iconBox.getAttribute('data-zaaa-duotone') !== '1') {
        iconBox.setAttribute('data-zaaa-duotone', '1');
      }
    }
  }

  /* ------------------------------------------------------------------------
   * MASTER SYNC ORCHESTRATION (zone:render + html attr observer + 600ms poll)
   * ------------------------------------------------------------------------ */
  function syncAll() {
    if (isSyncing) return;
    // Never mutate raw <x-dc> template DOM before dc-runtime parses dc.innerHTML
    if (document.querySelector('x-dc')) return;
    isSyncing = true;
    try {
      syncBrand();
      syncHeaderLinks();
      syncTopbarHud();
      syncThemeIndicator();
      syncOperativeCrest();
      syncSidebarVitals();
      syncSidebarNavIcons();
    } catch (_) {
      // Never emit console errors
    } finally {
      isSyncing = false;
    }
  }

  function boot() {
    syncAll();
    window.setTimeout(syncAll, 160);
    window.setTimeout(syncAll, 380);
    window.setTimeout(syncAll, 820);

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

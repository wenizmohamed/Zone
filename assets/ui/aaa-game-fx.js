/* ZONE v129 - 60fps Demand-Driven FX Engine, Vibrant Multi-Color MotionSites Icons, Session Auto-Heal, Live Version Sync & WebGL Throttling */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaGameFxLoaded) return;
  window.__zoneAaaGameFxLoaded = true;

  var STYLE_ID = 'zone-aaa-game-fx-styles';
  var LAYER_ID = 'zone-fx-layer';
  var MAX_FX_NODES = 28;

  /* ---------------- Vibrant Multi-Color 3D Telemetry Chip Icons (Zero Raw Emojis) ---------------- */
  var DELTA_SVGS = {
    cashGain:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-cashgain" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
        '<circle cx="8" cy="8" r="6.8" fill="url(#zfx-dg-cashgain)"/>' +
        '<path d="M8 4V12M9.9 5.9C9.9 5.1 9.1 4.6 8 4.6C6.9 4.6 6.1 5.1 6.1 5.9C6.1 7.4 9.9 6.9 9.9 8.9C9.9 9.8 9.1 10.4 8 10.4C6.8 10.4 6 9.8 5.9 9" stroke="#ffffff" stroke-width="1.45" stroke-linecap="round"/>' +
      '</svg>',
    cashSpend:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-cashspend" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#e11d48"/></linearGradient></defs>' +
        '<circle cx="8" cy="8" r="6.8" fill="url(#zfx-dg-cashspend)"/>' +
        '<path d="M5.1 8H10.9" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>' +
      '</svg>',
    energy:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-energy" x1="3" y1="1.5" x2="13" y2="14.5" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#a3e635"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>' +
        '<path d="M8.9 1.5L3.4 8.8H7.6L7.0 14.5L12.6 7.2H8.4L8.9 1.5Z" fill="url(#zfx-dg-energy)"/>' +
        '<path d="M8.5 3.6L5.2 8.2H7.9L7.6 11.8L10.8 7.6H8.1L8.5 3.6Z" fill="#ffffff" fill-opacity="0.55"/>' +
      '</svg>',
    nerve:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-nerve" x1="4" y1="2" x2="12" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fde047"/><stop offset="55%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs>' +
        '<path d="M8.3 1.8C9.9 4.2 12.4 5.9 12.4 9.1C12.4 11.9 10.4 14 8 14C5.6 14 3.6 11.9 3.6 9.1C3.6 6.9 4.9 5.2 6.2 4.1C6.1 5.5 6.8 6.3 7.5 6.7C7.1 4.8 7.5 3.1 8.3 1.8Z" fill="url(#zfx-dg-nerve)"/>' +
        '<circle cx="8" cy="10.4" r="1.7" fill="#ffffff" fill-opacity="0.88"/>' +
      '</svg>',
    happy:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-happy" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs>' +
        '<path d="M8 1.6L9.9 6.1L14.4 8L9.9 9.9L8 14.4L6.1 9.9L1.6 8L6.1 6.1L8 1.6Z" fill="url(#zfx-dg-happy)"/>' +
        '<circle cx="8" cy="8" r="1.6" fill="#ffffff"/>' +
      '</svg>',
    life:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-life" x1="2.5" y1="2.8" x2="13.5" y2="13.6" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#e11d48"/></linearGradient></defs>' +
        '<path d="M8 13.6C8 13.6 2.3 10.2 2.3 5.9C2.3 4 3.8 2.6 5.5 2.6C6.6 2.6 7.5 3.2 8 4.2C8.5 3.2 9.4 2.6 10.5 2.6C12.2 2.6 13.7 4 13.7 5.9C13.7 10.2 8 13.6 8 13.6Z" fill="url(#zfx-dg-life)"/>' +
        '<path d="M8 5.7V9.7M6 7.7H10" stroke="#ffffff" stroke-width="1.45" stroke-linecap="round"/>' +
      '</svg>',
    stat:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-stat" x1="2" y1="4" x2="14" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>' +
        '<rect x="2" y="4.5" width="2.8" height="7" rx="1" fill="url(#zfx-dg-stat)"/>' +
        '<rect x="11.2" y="4.5" width="2.8" height="7" rx="1" fill="url(#zfx-dg-stat)"/>' +
        '<path d="M4.8 8H11.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    xp:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-xp" x1="2.5" y1="1.8" x2="13.5" y2="14.2" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs>' +
        '<path d="M8 1.6L13.4 4.8V11.2L8 14.4L2.6 11.2V4.8L8 1.6Z" fill="url(#zfx-dg-xp)"/>' +
        '<circle cx="8" cy="8" r="2.1" fill="#ffffff"/>' +
      '</svg>',
    levelup:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zfx-dg-lvl" x1="2" y1="1.8" x2="14" y2="13.8" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fef08a"/><stop offset="55%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f97316"/></linearGradient></defs>' +
        '<path d="M8 1.5L10 5.6L14.5 6.2L11.2 9.4L12 13.9L8 11.8L4 13.9L4.8 9.4L1.5 6.2L6 5.6L8 1.5Z" fill="url(#zfx-dg-lvl)"/>' +
        '<circle cx="8" cy="8.2" r="1.5" fill="#ffffff"/>' +
      '</svg>'
  };

  /* ---------------- Vibrant Multi-Color 3D MotionSites Quick-Action SVGs ---------------- */
  var QUICK_ACTION_DUOTONES = {
    crimes: {
      glow: 'rgba(255, 59, 92, 0.28)',
      svg:
        '<svg class="zfx-duotone-svg zfx-qa-crimes" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="zfx-grad-qa-crimes" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="#ff3b5c"/>' +
              '<stop offset="100%" stop-color="#fb923c"/>' +
            '</linearGradient>' +
            '<linearGradient id="zfx-grad-qa-crimes-sweep" x1="12" y1="3" x2="20" y2="12" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.72"/>' +
              '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<circle cx="12" cy="12" r="9.2" fill="url(#zfx-grad-qa-crimes)" fill-opacity="0.96"/>' +
          '<path class="zfx-qa-radar-sweep" d="M12 12L12 3.1A8.9 8.9 0 0 1 20.1 8.4L12 12Z" fill="url(#zfx-grad-qa-crimes-sweep)"/>' +
          '<circle cx="12" cy="12" r="5.6" stroke="#ffffff" stroke-opacity="0.78" stroke-width="1.4"/>' +
          '<path d="M12 2.4V5.2M12 18.8V21.6M2.4 12H5.2M18.8 12H21.6" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round"/>' +
          '<circle cx="12" cy="12" r="2.1" fill="#ffffff"/>' +
        '</svg>'
    },
    gym: {
      glow: 'rgba(16, 185, 129, 0.28)',
      svg:
        '<svg class="zfx-duotone-svg zfx-qa-gym" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="zfx-grad-qa-gym" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="#10b981"/>' +
              '<stop offset="100%" stop-color="#a3e635"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<g class="zfx-qa-barbell">' +
            '<rect x="8.2" y="10.7" width="7.6" height="2.6" rx="1.1" fill="#ffffff"/>' +
            '<rect x="4.6" y="5.2" width="3.8" height="13.6" rx="1.6" fill="url(#zfx-grad-qa-gym)"/>' +
            '<rect x="15.6" y="5.2" width="3.8" height="13.6" rx="1.6" fill="url(#zfx-grad-qa-gym)"/>' +
            '<rect x="2.1" y="7.6" width="2.2" height="8.8" rx="1" fill="#34d399"/>' +
            '<rect x="19.7" y="7.6" width="2.2" height="8.8" rx="1" fill="#a3e635"/>' +
            '<path d="M5.7 6.8V11.2M16.7 6.8V11.2" stroke="#ffffff" stroke-opacity="0.82" stroke-width="1.2" stroke-linecap="round"/>' +
          '</g>' +
        '</svg>'
    },
    attack: {
      glow: 'rgba(244, 63, 94, 0.30)',
      svg:
        '<svg class="zfx-duotone-svg zfx-qa-attack" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="zfx-grad-qa-attack" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="#f43f5e"/>' +
              '<stop offset="100%" stop-color="#fbbf24"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<path d="M12 2.4L21.2 12L12 21.6L2.8 12L12 2.4Z" fill="url(#zfx-grad-qa-attack)" fill-opacity="0.95"/>' +
          '<g class="zfx-qa-blades">' +
            '<path d="M7.2 16.8L16.8 7.2M14.2 6.8H17.2V9.8" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M16.8 16.8L7.2 7.2M9.8 6.8H6.8V9.8" stroke="#ffffff" stroke-opacity="0.88" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="12" cy="12" r="1.8" fill="#fef08a"/>' +
          '</g>' +
        '</svg>'
    },
    missions: {
      glow: 'rgba(139, 92, 246, 0.28)',
      svg:
        '<svg class="zfx-duotone-svg zfx-qa-missions" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="zfx-grad-qa-missions" x1="4" y1="3.5" x2="20" y2="21" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="#fbbf24"/>' +
              '<stop offset="100%" stop-color="#8b5cf6"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<rect x="4.6" y="4.4" width="14.8" height="16.8" rx="3.2" fill="url(#zfx-grad-qa-missions)" fill-opacity="0.96"/>' +
          '<rect x="8.6" y="2.6" width="6.8" height="3.4" rx="1.4" fill="#ffffff"/>' +
          '<circle cx="12" cy="12.6" r="4.3" fill="#10b981"/>' +
          '<path class="zfx-qa-check" d="M9.9 12.6L11.4 14.1L14.3 11.1" stroke="#ffffff" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M8.4 18.2H15.6" stroke="#ffffff" stroke-opacity="0.78" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>'
    }
  };

  /* ---------------- Vibrant Multi-Color 3D City Destinations Directory Icons ---------------- */
  function buildCityIconSvg(gradId, c1, c2, innerMarkup) {
    return (
      '<svg class="zfx-city-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="' + gradId + '" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
            '<stop offset="0%" stop-color="' + c1 + '"/>' +
            '<stop offset="100%" stop-color="' + c2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        innerMarkup +
      '</svg>'
    );
  }

  var CITY_DESTINATION_SVGS = {
    bank: buildCityIconSvg(
      'zfx-grad-city-bank', '#fde047', '#d97706',
      '<path d="M12 2.6L21 7.6V9.8H3V7.6L12 2.6Z" fill="url(#zfx-grad-city-bank)"/>' +
      '<rect x="3.5" y="18.2" width="17" height="2.8" rx="1.1" fill="url(#zfx-grad-city-bank)"/>' +
      '<path d="M6.2 10.2V17.8M10.1 10.2V17.8M13.9 10.2V17.8M17.8 10.2V17.8" stroke="#ffffff" stroke-width="2.05" stroke-linecap="round"/>' +
      '<circle cx="12" cy="6.8" r="1.25" fill="#ffffff"/>'
    ),
    job: buildCityIconSvg(
      'zfx-grad-city-job', '#38bdf8', '#2563eb',
      '<path d="M9 6.5V4.8C9 3.9 9.7 3.2 10.6 3.2H13.4C14.3 3.2 15 3.9 15 4.8V6.5" stroke="#7dd3fc" stroke-width="1.9" stroke-linecap="round"/>' +
      '<rect x="3.2" y="6.4" width="17.6" height="13.6" rx="3" fill="url(#zfx-grad-city-job)"/>' +
      '<path d="M3.6 12.2H20.4" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.4"/>' +
      '<rect x="10.2" y="10.6" width="3.6" height="3.2" rx="0.9" fill="#ffffff"/>'
    ),
    gym: buildCityIconSvg(
      'zfx-grad-city-gym', '#10b981', '#a3e635',
      '<rect x="8" y="10.8" width="8" height="2.4" rx="1" fill="#ffffff"/>' +
      '<rect x="4.5" y="5.5" width="3.7" height="13" rx="1.5" fill="url(#zfx-grad-city-gym)"/>' +
      '<rect x="15.8" y="5.5" width="3.7" height="13" rx="1.5" fill="url(#zfx-grad-city-gym)"/>' +
      '<rect x="2.2" y="8" width="2" height="8" rx="0.9" fill="#34d399"/>' +
      '<rect x="19.8" y="8" width="2" height="8" rx="0.9" fill="#a3e635"/>'
    ),
    education: buildCityIconSvg(
      'zfx-grad-city-edu', '#6366f1', '#22d3ee',
      '<path d="M12 3.4L21.6 8.2L12 13L2.4 8.2L12 3.4Z" fill="url(#zfx-grad-city-edu)"/>' +
      '<path d="M6.2 10.8V15.8C6.2 17.8 8.8 19.4 12 19.4C15.2 19.4 17.8 17.8 17.8 15.8V10.8L12 13.8L6.2 10.8Z" fill="url(#zfx-grad-city-edu)" fill-opacity="0.82"/>' +
      '<path d="M20.2 8.9V14.8" stroke="#fde047" stroke-width="1.9" stroke-linecap="round"/>' +
      '<circle cx="20.2" cy="15.5" r="1.3" fill="#fde047"/>' +
      '<circle cx="12" cy="8.2" r="1.4" fill="#ffffff"/>'
    ),
    hospital: buildCityIconSvg(
      'zfx-grad-city-hosp', '#ff3b5c', '#fb7185',
      '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.4" fill="url(#zfx-grad-city-hosp)"/>' +
      '<path d="M12 7.4V16.6M7.4 12H16.6" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>'
    ),
    jail: buildCityIconSvg(
      'zfx-grad-city-jail', '#fbbf24', '#ea580c',
      '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" fill="url(#zfx-grad-city-jail)"/>' +
      '<path d="M8.2 6.4V17.6M12 6.4V17.6M15.8 6.4V17.6M6 10.2H18" stroke="#ffffff" stroke-width="1.85" stroke-linecap="round"/>'
    ),
    casino: buildCityIconSvg(
      'zfx-grad-city-casino', '#a855f7', '#fbbf24',
      '<circle cx="12" cy="12" r="9.2" fill="url(#zfx-grad-city-casino)"/>' +
      '<circle cx="12" cy="12" r="6.3" stroke="#ffffff" stroke-opacity="0.72" stroke-width="1.3" stroke-dasharray="2.4 2"/>' +
      '<path d="M12 7.5L15.6 12L12 16.5L8.4 12L12 7.5Z" fill="#ffffff"/>'
    ),
    market: buildCityIconSvg(
      'zfx-grad-city-market', '#10b981', '#2dd4bf',
      '<path d="M5.4 7.6H18.6L19.8 19.2C19.9 20.1 19.2 20.8 18.3 20.8H5.7C4.8 20.8 4.1 20.1 4.2 19.2L5.4 7.6Z" fill="url(#zfx-grad-city-market)"/>' +
      '<path d="M8.8 7.6V6C8.8 4.2 10.2 2.8 12 2.8C13.8 2.8 15.2 4.2 15.2 6V7.6" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>' +
      '<path d="M9.2 13.8L11.2 15.8L15 11.8" stroke="#ffffff" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    properties: buildCityIconSvg(
      'zfx-grad-city-prop', '#facc15', '#10b981',
      '<path d="M4 20.4V9.8L12 3.4L20 9.8V20.4H4Z" fill="url(#zfx-grad-city-prop)"/>' +
      '<rect x="9.8" y="13.6" width="4.4" height="6.8" rx="1" fill="#ffffff"/>' +
      '<circle cx="12" cy="9.4" r="1.6" fill="#ffffff"/>'
    ),
    faction: buildCityIconSvg(
      'zfx-grad-city-fac', '#fbbf24', '#e11d48',
      '<path d="M12 2.5L19.6 5.6V11.8C19.6 16.5 16.3 19.9 12 21.5C7.7 19.9 4.4 16.5 4.4 11.8V5.6L12 2.5Z" fill="url(#zfx-grad-city-fac)"/>' +
      '<path d="M12 7.1L13.4 10.1L16.6 10.5L14.2 12.8L14.8 16L12 14.4L9.2 16L9.8 12.8L7.4 10.5L10.6 10.1L12 7.1Z" fill="#ffffff"/>'
    ),
    crimes: buildCityIconSvg(
      'zfx-grad-city-crimes', '#ff3b5c', '#fb923c',
      '<circle cx="12" cy="12" r="9" fill="url(#zfx-grad-city-crimes)"/>' +
      '<circle cx="12" cy="12" r="4.8" stroke="#ffffff" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="1.8" fill="#ffffff"/>'
    ),
    missions: buildCityIconSvg(
      'zfx-grad-city-miss', '#fbbf24', '#8b5cf6',
      '<rect x="4.8" y="4.2" width="14.4" height="16.6" rx="3" fill="url(#zfx-grad-city-miss)"/>' +
      '<path d="M9.2 12.4L11.2 14.4L15.2 10.2" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    newspaper: buildCityIconSvg(
      'zfx-grad-city-news', '#38bdf8', '#6366f1',
      '<rect x="3.8" y="4.2" width="16.4" height="15.6" rx="3" fill="url(#zfx-grad-city-news)"/>' +
      '<path d="M7.5 8.8H16.5M7.5 12.4H16.5M7.5 15.8H13" stroke="#ffffff" stroke-width="1.85" stroke-linecap="round"/>'
    ),
    hof: buildCityIconSvg(
      'zfx-grad-city-hof', '#fde047', '#f59e0b',
      '<path d="M7 4.2H17V10.2C17 13 14.8 15.2 12 15.2C9.2 15.2 7 13 7 10.2V4.2Z" fill="url(#zfx-grad-city-hof)"/>' +
      '<path d="M12 15.2V18.8M8.5 19.4H15.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="12" cy="9.2" r="1.8" fill="#ffffff"/>'
    ),
    items: buildCityIconSvg(
      'zfx-grad-city-items', '#06b6d4', '#10b981',
      '<path d="M12 2.8L20.2 7.3V16.7L12 21.2L3.8 16.7V7.3L12 2.8Z" fill="url(#zfx-grad-city-items)"/>' +
      '<path d="M4.4 7.7L12 12L19.6 7.7M12 12V20.6" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    attack: buildCityIconSvg(
      'zfx-grad-city-atk', '#f43f5e', '#fbbf24',
      '<path d="M12 2.8L20.8 12L12 21.2L3.2 12L12 2.8Z" fill="url(#zfx-grad-city-atk)"/>' +
      '<path d="M8 16L16 8M13.2 8H16V10.8M16 16L8 8" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    defaultPin: buildCityIconSvg(
      'zfx-grad-city-def', '#38bdf8', '#8b5cf6',
      '<path d="M12 2.6C7.9 2.6 4.6 5.9 4.6 10C4.6 15.2 12 21.4 12 21.4C12 21.4 19.4 15.2 19.4 10C19.4 5.9 16.1 2.6 12 2.6Z" fill="url(#zfx-grad-city-def)"/>' +
      '<circle cx="12" cy="10" r="3" fill="#ffffff"/>'
    )
  };
  CITY_DESTINATION_SVGS.jobs = CITY_DESTINATION_SVGS.job;
  CITY_DESTINATION_SVGS.elimination = CITY_DESTINATION_SVGS.attack;

  /* ---------------- Vibrant Multi-Color Crime Category Icons (.zone-crime-activity-nav) ---------------- */
  var CRIME_CAT_PALETTES = [
    ['#ff3b5c', '#fb923c'],
    ['#fbbf24', '#f97316'],
    ['#22d3ee', '#3b82f6'],
    ['#a855f7', '#ec4899'],
    ['#10b981', '#14b8a6'],
    ['#f43f5e', '#eab308']
  ];

  function buildCrimeCategorySvg(idx) {
    var pair = CRIME_CAT_PALETTES[idx % CRIME_CAT_PALETTES.length];
    var gid = 'zfx-grad-cc-' + (idx % CRIME_CAT_PALETTES.length);
    var shapeIdx = idx % 4;
    var glyph = '';
    if (shapeIdx === 0) {
      glyph =
        '<circle cx="12" cy="12" r="8.8" fill="url(#' + gid + ')"/>' +
        '<circle cx="12" cy="12" r="4.2" stroke="#ffffff" stroke-width="1.6"/>' +
        '<circle cx="12" cy="12" r="1.6" fill="#ffffff"/>';
    } else if (shapeIdx === 1) {
      glyph =
        '<rect x="4.5" y="9.5" width="15" height="10.5" rx="2.8" fill="url(#' + gid + ')"/>' +
        '<path d="M8.5 9.5V6.8C8.5 4.9 10.1 3.4 12 3.4C13.9 3.4 15.5 4.9 15.5 6.8V9.5" stroke="' + pair[0] + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="12" cy="14.6" r="1.7" fill="#ffffff"/>';
    } else if (shapeIdx === 2) {
      glyph =
        '<path d="M12 2.6L20.4 7.4V16.6L12 21.4L3.6 16.6V7.4L12 2.6Z" fill="url(#' + gid + ')"/>' +
        '<path d="M9 12.2L11.2 14.4L15.4 9.8" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    } else {
      glyph =
        '<path d="M12 2.6L21 12L12 21.4L3 12L12 2.6Z" fill="url(#' + gid + ')"/>' +
        '<path d="M12.6 6.8L8.8 12.4H12.2L11.4 17.2L15.2 11.6H11.8L12.6 6.8Z" fill="#ffffff"/>';
    }
    return (
      '<svg class="zfx-crime-cat-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="' + gid + '" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="' + pair[0] + '"/>' +
          '<stop offset="100%" stop-color="' + pair[1] + '"/>' +
        '</linearGradient></defs>' +
        glyph +
      '</svg>'
    );
  }

  /* ---------------- Vibrant Multi-Color 3D City Key of Symbols Icons (.zone-city-legend) ---------------- */
  function buildLegendIconSvg(gradId, c1, c2, c3, innerMarkup) {
    return (
      '<svg class="zfx-legend-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="' + gradId + '" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">' +
            '<stop offset="0%" stop-color="' + c1 + '"/>' +
            '<stop offset="52%" stop-color="' + c2 + '"/>' +
            '<stop offset="100%" stop-color="' + c3 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        innerMarkup +
      '</svg>'
    );
  }

  var CITY_LEGEND_KEYS = ['fin', 'admin', 'shop', 'leisure', 'estate', 'misc'];
  var CITY_LEGEND_SVGS = {
    fin: buildLegendIconSvg(
      'zfx-grad-leg-fin', '#fef08a', '#f59e0b', '#d97706',
      '<path d="M12 2.6L21 7.5V9.8H3V7.5L12 2.6Z" fill="url(#zfx-grad-leg-fin)"/>' +
      '<rect x="3.5" y="18.2" width="17" height="2.8" rx="1.1" fill="url(#zfx-grad-leg-fin)"/>' +
      '<path d="M6.3 10.2V17.8M10.1 10.2V17.8M13.9 10.2V17.8M17.7 10.2V17.8" stroke="#ffffff" stroke-width="2.05" stroke-linecap="round"/>' +
      '<circle cx="12" cy="6.8" r="1.3" fill="#ffffff"/>'
    ),
    admin: buildLegendIconSvg(
      'zfx-grad-leg-admin', '#38bdf8', '#3b82f6', '#4f46e5',
      '<path d="M12 2.5L19.8 5.7V11.8C19.8 16.6 16.4 20.1 12 21.6C7.6 20.1 4.2 16.6 4.2 11.8V5.7L12 2.5Z" fill="url(#zfx-grad-leg-admin)"/>' +
      '<path d="M12 6.9L13.4 9.8L16.6 10.2L14.2 12.5L14.8 15.7L12 14.1L9.2 15.7L9.8 12.5L7.4 10.2L10.6 9.8L12 6.9Z" fill="#ffffff"/>'
    ),
    shop: buildLegendIconSvg(
      'zfx-grad-leg-shop', '#6ee7b7', '#10b981', '#0d9488',
      '<path d="M5.3 7.8H18.7L19.9 19.2C20 20.1 19.3 20.8 18.4 20.8H5.6C4.7 20.8 4 20.1 4.1 19.2L5.3 7.8Z" fill="url(#zfx-grad-leg-shop)"/>' +
      '<path d="M8.8 7.8V6.1C8.8 4.3 10.2 2.9 12 2.9C13.8 2.9 15.2 4.3 15.2 6.1V7.8" stroke="#ffffff" stroke-width="1.95" stroke-linecap="round"/>' +
      '<circle cx="9.6" cy="11.2" r="1.15" fill="#ffffff"/>' +
      '<circle cx="14.4" cy="11.2" r="1.15" fill="#ffffff"/>'
    ),
    leisure: buildLegendIconSvg(
      'zfx-grad-leg-leis', '#f5d0fe', '#d946ef', '#7c3aed',
      '<circle cx="12" cy="12" r="9.2" fill="url(#zfx-grad-leg-leis)"/>' +
      '<circle cx="12" cy="12" r="6.2" stroke="#ffffff" stroke-opacity="0.74" stroke-width="1.35" stroke-dasharray="2.4 2"/>' +
      '<path d="M12 7.4L15.6 12L12 16.6L8.4 12L12 7.4Z" fill="#ffffff"/>'
    ),
    estate: buildLegendIconSvg(
      'zfx-grad-leg-est', '#fde047', '#34d399', '#059669',
      '<path d="M4 20.5V9.6L12 3.2L20 9.6V20.5H4Z" fill="url(#zfx-grad-leg-est)"/>' +
      '<rect x="9.8" y="13.5" width="4.4" height="7" rx="1" fill="#ffffff"/>' +
      '<circle cx="12" cy="9.3" r="1.65" fill="#ffffff"/>'
    ),
    misc: buildLegendIconSvg(
      'zfx-grad-leg-misc', '#fda4af', '#fb7185', '#38bdf8',
      '<circle cx="12" cy="12" r="9.1" fill="url(#zfx-grad-leg-misc)"/>' +
      '<path d="M15.6 8.4L13.5 13.5L8.4 15.6L10.5 10.5L15.6 8.4Z" fill="#ffffff"/>' +
      '<circle cx="12" cy="12" r="1.4" fill="#0f172a"/>'
    )
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
    subListObserver: null,
    subListEl: null,
    polishPending: false,
    hudObserver: null,
    hudCashNode: null,
    hudBarsNode: null,
    rootObserver: null,
    syncPending: false,
    /* Spotlight tracking (strictly gated to interactive spotlight cards) */
    spotRaf: 0,
    spotEvent: null,
    /* Demand-driven 24fps Hero Atmosphere (0 rAF ticks when idle!) */
    heroDrops: [],
    heroMotes: [],
    heroPrevAt: 0,
    heroLastPaintAt: 0,
    heroRaf: 0,
    heroTicks: 0,
    heroVisible: true,
    heroHovered: false,
    heroIo: null,
    heroBoundHeading: null,
    /* Offscreen WebGL iframe throttling */
    iframeIo: null,
    iframeIntersecting: { char3d: true, cityMap: true },
    iframePaused: { char3d: false, cityMap: false },
    /* Instant Session Auto-Heal & Reconnect Rescue */
    sessionHealing: false,
    accessObserver: null
  };

  for (var hi = 0; hi < 18; hi++) {
    state.heroDrops.push({
      x: 0.22 + Math.random() * 0.76,
      y: Math.random(),
      len: 10 + Math.random() * 13,
      spd: 0.45 + Math.random() * 0.50
    });
  }
  for (var mi = 0; mi < 12; mi++) {
    state.heroMotes.push({
      x: 0.18 + Math.random() * 0.78,
      y: Math.random(),
      r: 0.9 + Math.random() * 1.5,
      spd: 0.06 + Math.random() * 0.10,
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
      return Boolean(document.documentElement && document.documentElement.getAttribute('data-theme') === 'light');
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
          'display:inline-flex;align-items:center;gap:6px;' +
          'padding:4px 10px;border-radius:999px;' +
          'font:800 12.5px/1.2 "Rubik","Noto Sans Arabic",system-ui,sans-serif;' +
          'font-variant-numeric:tabular-nums;white-space:nowrap;' +
          'letter-spacing:0.02em;' +
          'background:linear-gradient(180deg,rgba(14,21,35,0.96) 0%,rgba(7,11,19,0.98) 100%);' +
          'border:1px solid var(--zfx-border,rgba(255,255,255,0.14));' +
          'color:var(--zfx-fg,#49f0a1);' +
          'box-shadow:0 8px 22px rgba(0,0,0,0.55),0 0 14px var(--zfx-glow,rgba(73,240,161,0.22)),inset 0 1px 0 rgba(255,255,255,0.10);' +
          'transform:translate3d(-50%,0,0);will-change:transform,opacity;' +
          'animation:zfxDeltaFloat 1120ms cubic-bezier(0.16,1,0.3,1) var(--zfx-delay,0ms) both;' +
        '}' +
        'html[dir="rtl"] .zfx-delta-chip,html[lang="ar"] .zfx-delta-chip{letter-spacing:0 !important;}' +
        'html[data-theme="light"] .zfx-delta-chip{' +
          'background:linear-gradient(180deg,rgba(19,27,42,0.96) 0%,rgba(11,17,28,0.98) 100%);' +
          'box-shadow:0 8px 18px rgba(15,23,42,0.24),0 0 0 1px rgba(255,255,255,0.22),inset 0 1px 0 rgba(255,255,255,0.14);' +
        '}' +
        '.zfx-delta-chip.is-levelup{' +
          'padding:6px 14px;font-size:14px;border-width:1.5px;' +
          'background:linear-gradient(180deg,rgba(44,31,10,0.97) 0%,rgba(18,13,6,0.98) 100%);' +
        '}' +
        '.zfx-delta-icon{display:inline-grid;place-items:center;font-size:11.5px;line-height:1;}' +
        '.zfx-delta-icon svg{width:14px;height:14px;display:block;}' +
        '.zfx-delta-num{unicode-bidi:isolate;direction:ltr;display:inline-block;}' +
        '.zfx-click-pulse{' +
          'position:fixed;overflow:hidden;border-radius:8px;z-index:9993;' +
          'border:1px solid var(--zfx-rim,rgba(235,184,88,0.55));' +
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
          'position:fixed;border-radius:6px;z-index:9993;' +
          'border:1px solid var(--zfx-halo,rgba(73,240,161,0.65));' +
          'box-shadow:0 0 14px var(--zfx-halo,rgba(73,240,161,0.45)),inset 0 0 8px var(--zfx-halo,rgba(73,240,161,0.25));' +
          'animation:zfxBarHalo 520ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-screen-sweep{' +
          'position:fixed;height:2px;z-index:9994;border-radius:2px;' +
          'background:linear-gradient(90deg,transparent 0%,#39e7a3 35%,#38bdf8 70%,transparent 100%);' +
          'box-shadow:0 0 12px rgba(56,189,248,0.45);' +
          'transform-origin:left center;' +
          'animation:zfxSweepLine 200ms cubic-bezier(0.22,1,0.36,1) forwards;' +
        '}' +
        'html[dir="rtl"] .zfx-screen-sweep{transform-origin:right center;}' +
        'html[data-theme="light"] .zfx-screen-sweep{' +
          'background:linear-gradient(90deg,transparent 0%,#0d7a49 35%,#0284c7 70%,transparent 100%);' +
          'box-shadow:0 0 8px rgba(2,132,199,0.30);' +
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
        /* Borderless Frosted Squircles for Quick-Actions (Zero Gold Box Outlines!) */
        'html body #zone-main .zone-quick-actions > button .zone-nav-icon{' +
          'position:relative;width:44px !important;height:44px !important;min-width:44px !important;' +
          'display:inline-grid !important;place-items:center !important;flex:none !important;' +
          'background:rgba(255,255,255,0.052) !important;' +
          'border:0 !important;' +
          'border-radius:12px !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 6px 16px rgba(0,0,0,0.26) !important;' +
          'transition:transform 240ms cubic-bezier(0.22,1,0.36,1),background-color 220ms ease,box-shadow 220ms ease !important;' +
        '}' +
        'html[data-theme="light"] body #zone-main .zone-quick-actions > button .zone-nav-icon{' +
          'background:rgba(15,23,42,0.058) !important;' +
          'border:0 !important;' +
          'border-radius:12px !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.82),0 4px 12px rgba(15,23,42,0.08) !important;' +
        '}' +
        'html body #zone-main .zone-quick-actions > button:hover .zone-nav-icon{' +
          'transform:translateY(-1px) scale(1.07);' +
          'background:rgba(255,255,255,0.085) !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),0 8px 20px var(--zfx-qa-glow,rgba(56,189,248,0.24)) !important;' +
        '}' +
        'html[data-theme="light"] body #zone-main .zone-quick-actions > button:hover .zone-nav-icon{' +
          'background:rgba(15,23,42,0.09) !important;' +
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
          'width:24px !important;height:24px !important;' +
          'overflow:visible;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.28));' +
        '}' +
        /* Quick-Action Kinetic Hover Micro-Animations (GPU transform only) */
        '.zfx-qa-radar-sweep{transform-origin:12px 12px;transition:transform 520ms cubic-bezier(0.22,1,0.36,1);}' +
        '#zone-main .zone-quick-actions > button:hover .zfx-qa-radar-sweep{transform:rotate(140deg);}' +
        '.zfx-qa-barbell{transform-origin:12px 12px;transition:transform 240ms cubic-bezier(0.22,1,0.36,1);}' +
        '#zone-main .zone-quick-actions > button:hover .zfx-qa-barbell{transform:translateY(-1.8px) scale(1.06);}' +
        '.zfx-qa-blades{transform-origin:12px 12px;transition:transform 220ms cubic-bezier(0.22,1,0.36,1);}' +
        '#zone-main .zone-quick-actions > button:hover .zfx-qa-blades{transform:scale(1.1) rotate(-8deg);}' +
        '.zfx-qa-check{transform-origin:12px 12.6px;transition:transform 220ms cubic-bezier(0.22,1,0.36,1);}' +
        '#zone-main .zone-quick-actions > button:hover .zfx-qa-check{transform:scale(1.14);}' +
        /* City Destinations Directory Vibrant Icons (.zone-city-place-icon & .zone-nav-icon) */
        'html body #zone-main .zone-city-destinations button .zone-city-place-icon,' +
        'html body #zone-main .zone-city-destinations button .zone-nav-icon{' +
          'position:relative;width:36px !important;height:36px !important;min-width:36px !important;' +
          'display:inline-grid !important;place-items:center !important;flex:none !important;' +
          'background:rgba(255,255,255,0.048) !important;' +
          'border:0 !important;border-radius:11px !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.10),0 4px 10px rgba(0,0,0,0.22) !important;' +
          'transition:transform 200ms cubic-bezier(0.22,1,0.36,1),background-color 200ms ease !important;' +
        '}' +
        'html[data-theme="light"] body #zone-main .zone-city-destinations button .zone-city-place-icon,' +
        'html[data-theme="light"] body #zone-main .zone-city-destinations button .zone-nav-icon{' +
          'background:rgba(15,23,42,0.055) !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.82),0 3px 8px rgba(15,23,42,0.07) !important;' +
        '}' +
        'html body #zone-main .zone-city-destinations button:hover .zone-city-place-icon,' +
        'html body #zone-main .zone-city-destinations button:hover .zone-nav-icon{' +
          'transform:scale(1.08) translateY(-1px);background:rgba(255,255,255,0.085) !important;' +
        '}' +
        'html body #zone-main .zone-city-destinations button [data-zfx-city-icon] > svg:not(.zfx-city-svg){' +
          'display:none !important;' +
        '}' +
        'html body #zone-main .zone-city-destinations button [data-zfx-city-icon] > svg.zfx-city-svg{' +
          'display:block !important;visibility:visible !important;width:20px !important;height:20px !important;' +
          'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.24));' +
        '}' +
        /* Crimes Category Activity Nav Vibrant Icons (Fiber-safe append + order: -1) */
        'html body #zone-main .zone-crime-activity-nav button[data-zfx-crime-cat] > svg:not(.zfx-crime-cat-svg){' +
          'display:none !important;' +
        '}' +
        'html body #zone-main .zone-crime-activity-nav button[data-zfx-crime-cat] > svg.zfx-crime-cat-svg{' +
          'display:block !important;width:20px !important;height:20px !important;flex:none !important;' +
          'order:-1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25));' +
          'transition:transform 200ms cubic-bezier(0.22,1,0.36,1);' +
        '}' +
        'html body #zone-main .zone-crime-activity-nav button[data-zfx-crime-cat]:hover > svg.zfx-crime-cat-svg{' +
          'transform:scale(1.1) rotate(-4deg);' +
        '}' +
        /* City Key of Symbols Vibrant 3D Frosted Legend Icons (.zone-city-legend) */
        'html body #zone-main .zone-city-legend > div > span[data-zfx-legend-icon]{' +
          'position:relative;width:30px !important;height:30px !important;min-width:30px !important;' +
          'display:inline-grid !important;place-items:center !important;flex:none !important;' +
          'background:rgba(255,255,255,0.052) !important;' +
          'border:0 !important;border-radius:9px !important;filter:none !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 4px 10px rgba(0,0,0,0.22) !important;' +
          'transition:transform 200ms cubic-bezier(0.22,1,0.36,1),background-color 200ms ease !important;' +
        '}' +
        'html[data-theme="light"] body #zone-main .zone-city-legend > div > span[data-zfx-legend-icon]{' +
          'background:rgba(15,23,42,0.055) !important;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.84),0 3px 8px rgba(15,23,42,0.07) !important;' +
        '}' +
        'html body #zone-main .zone-city-legend > div:hover > span[data-zfx-legend-icon]{' +
          'transform:scale(1.09) rotate(-3deg);background:rgba(255,255,255,0.088) !important;' +
        '}' +
        'html body #zone-main .zone-city-legend [data-zfx-legend-icon] > svg:not(.zfx-legend-svg){' +
          'display:none !important;' +
        '}' +
        'html body #zone-main .zone-city-legend [data-zfx-legend-icon] > svg.zfx-legend-svg{' +
          'display:block !important;visibility:visible !important;width:18px !important;height:18px !important;' +
          'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.24));' +
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
        pulse.style.setProperty('--zfx-spot2', light ? 'rgba(2, 132, 199, 0.22)' : 'rgba(57, 231, 163, 0.26)');
      } else {
        pulse.style.setProperty('--zfx-rim', light ? 'rgba(15, 23, 42, 0.25)' : 'rgba(148, 163, 184, 0.45)');
        pulse.style.setProperty('--zfx-spot', light ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.36)');
        pulse.style.setProperty('--zfx-spot2', 'rgba(56, 189, 248, 0.18)');
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

  /* ---------------- Snapshot Extraction & Delta Telemetry (Zero Polling!) ---------------- */
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
      gameplayReady: Boolean(g && (g.gameplayReady || (g.state && g.state.gameplayReady))),
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
              border: isGain ? 'rgba(73, 240, 161, 0.55)' : 'rgba(251, 113, 133, 0.55)',
              glow: isGain ? 'rgba(73, 240, 161, 0.26)' : 'rgba(244, 63, 94, 0.26)',
              anchorEl: snap.cashEl
            });
          }
          if (snap.cashEl) {
            spawnBarHalo(snap.cashEl, isGain ? 'rgba(73, 240, 161, 0.65)' : 'rgba(251, 113, 133, 0.65)');
          }
        }
      }

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
              border: 'rgba(56, 189, 248, 0.55)',
              glow: 'rgba(56, 189, 248, 0.28)',
              anchorEl: snap.bars.energy.el
            });
          }
        }
      }

      if (Number.isFinite(snap.totalXp) && Number.isFinite(prev.totalXp) && snap.totalXp > prev.totalXp) {
        var dXp = Math.round(snap.totalXp - prev.totalXp);
        if (dXp >= 1 && dXp < 1000000) {
          if (queue.length === 0) playCue('xp');
          queue.push({
            iconSvg: DELTA_SVGS.xp,
            numText: '+' + formatInt(dXp),
            label: ar ? 'خبرة' : 'XP',
            fg: '#fbbf24',
            border: 'rgba(251, 191, 36, 0.60)',
            glow: 'rgba(251, 191, 36, 0.28)',
            anchorEl: snap.cashEl
          });
        }
      }

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

  /* ---------------- Fiber-Safe Text Mutation & Surface Icon Enhancement ---------------- */
  function mutateTextNodeSafely(el, nextValue) {
    if (!el || typeof nextValue !== 'string') return;
    if (el.childNodes.length === 0) {
      el.textContent = nextValue;
      return;
    }
    var primaryText = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var child = el.childNodes[i];
      if (child && child.nodeType === 3) {
        if (!primaryText) {
          primaryText = child;
          if (child.nodeValue !== nextValue) child.nodeValue = nextValue;
        } else if (child.nodeValue !== '') {
          child.nodeValue = '';
        }
      }
    }
  }

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

    if (/Ready$|Active$|Open$|جاهزة$|نشطة$/i.test(raw) && raw.indexOf('·') < 0 && !/^0\s+/i.test(raw)) {
      return raw;
    }

    var mNerveEn = raw.match(/^(\d[\d,]*)\s*nerve(?:\s*[·•|-]\s*.*)?$/i);
    if (mNerveEn) return mNerveEn[1] + ' Nerve Ready';

    var mEnergyEn = raw.match(/^(\d[\d,]*)\s*energy(?:\s*[·•|-]\s*.*)?$/i);
    if (mEnergyEn) return mEnergyEn[1] + ' Energy Ready';

    var mOpenEn = raw.match(/^(\d[\d,]*)\s*(?:open|active|available|contracts?|missions?)(?:\s*(?:ready|open|active))?(?:\s*[·•|-]\s*.*)?$/i);
    if (mOpenEn) {
      var nOpen = Number(String(mOpenEn[1]).replace(/,/g, ''));
      if (nOpen === 0) return ar ? 'عقود نشطة' : 'Contracts Active';
      return mOpenEn[1] + ' Contracts Ready';
    }

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
          iconEl.style.setProperty('--zfx-qa-glow', spec.glow);
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

  function resolveCityIconKey(loc, dest, strongTxt) {
    if (loc && CITY_DESTINATION_SVGS[loc]) return loc;
    if (dest && CITY_DESTINATION_SVGS[dest]) return dest;
    var probe = (loc + ' ' + dest + ' ' + strongTxt).toLowerCase();
    if (probe.indexOf('bank') >= 0 || probe.indexOf('بنك') >= 0 || probe.indexOf('مصرف') >= 0) return 'bank';
    if (probe.indexOf('job') >= 0 || probe.indexOf('وظائ') >= 0 || probe.indexOf('عمل') >= 0) return 'job';
    if (probe.indexOf('gym') >= 0 || probe.indexOf('نادي') >= 0) return 'gym';
    if (probe.indexOf('educat') >= 0 || probe.indexOf('univer') >= 0 || probe.indexOf('تعليم') >= 0 || probe.indexOf('أكاديم') >= 0) return 'education';
    if (probe.indexOf('hosp') >= 0 || probe.indexOf('med') >= 0 || probe.indexOf('مستشف') >= 0) return 'hospital';
    if (probe.indexOf('jail') >= 0 || probe.indexOf('prison') >= 0 || probe.indexOf('سجن') >= 0) return 'jail';
    if (probe.indexOf('casin') >= 0 || probe.indexOf('كازينو') >= 0) return 'casino';
    if (probe.indexOf('market') >= 0 || probe.indexOf('bazaar') >= 0 || probe.indexOf('سوق') >= 0) return 'market';
    if (probe.indexOf('propert') >= 0 || probe.indexOf('estate') >= 0 || probe.indexOf('عقار') >= 0) return 'properties';
    if (probe.indexOf('faction') >= 0 || probe.indexOf('عائل') >= 0 || probe.indexOf('فصيل') >= 0) return 'faction';
    if (probe.indexOf('crime') >= 0 || probe.indexOf('جرائ') >= 0) return 'crimes';
    if (probe.indexOf('mission') >= 0 || probe.indexOf('مهم') >= 0) return 'missions';
    if (probe.indexOf('news') >= 0 || probe.indexOf('صحيف') >= 0) return 'newspaper';
    if (probe.indexOf('hall') >= 0 || probe.indexOf('hof') >= 0 || probe.indexOf('مشاهير') >= 0) return 'hof';
    if (probe.indexOf('item') >= 0 || probe.indexOf('armor') >= 0 || probe.indexOf('عتاد') >= 0) return 'items';
    if (probe.indexOf('attack') >= 0 || probe.indexOf('قتال') >= 0) return 'attack';
    return 'defaultPin';
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
        var dest = (btn.getAttribute('data-zone-destination') || '').toLowerCase().trim();
        var loc = (btn.getAttribute('data-zone-location') || '').toLowerCase().trim();
        var strongTxt = strong ? (strong.textContent || '').trim() : '';

        var iconWrap = btn.querySelector('.zone-city-place-icon, .zone-nav-icon');
        if (iconWrap) {
          var iconKey = resolveCityIconKey(loc, dest, strongTxt);
          var svgMarkup = CITY_DESTINATION_SVGS[iconKey] || CITY_DESTINATION_SVGS.defaultPin;
          var curSvg = iconWrap.querySelector('svg.zfx-city-svg');
          if (!curSvg) {
            iconWrap.setAttribute('data-zfx-city-icon', iconKey);
            var holder = document.createElement('div');
            holder.innerHTML = svgMarkup;
            if (holder.firstElementChild) iconWrap.appendChild(holder.firstElementChild);
          } else if (iconWrap.getAttribute('data-zfx-city-icon') !== iconKey) {
            iconWrap.setAttribute('data-zfx-city-icon', iconKey);
            var holderNext = document.createElement('div');
            holderNext.innerHTML = svgMarkup;
            if (holderNext.firstElementChild) {
              curSvg.innerHTML = holderNext.firstElementChild.innerHTML;
            }
          }
        }

        if (!small) continue;
        var smallTxt = (small.textContent || '').trim();
        var tagObj = CITY_DISTRICT_TAGS[loc] || CITY_DISTRICT_TAGS[dest] || null;
        if (!tagObj && strongTxt) {
          var normStrong = strongTxt.toLowerCase();
          if (CITY_DISTRICT_TAGS[normStrong]) tagObj = CITY_DISTRICT_TAGS[normStrong];
        }
        if (!tagObj) continue;

        var desired = ar ? tagObj.ar : tagObj.en;
        if (!desired || smallTxt === desired) continue;

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

  function resolveLegendIconKey(labelText, fallbackIndex) {
    var probe = String(labelText || '').toLowerCase().trim();
    if (probe.indexOf('financ') >= 0 || probe.indexOf('مالي') >= 0) return 'fin';
    if (probe.indexOf('admin') >= 0 || probe.indexOf('إدار') >= 0 || probe.indexOf('ادار') >= 0) return 'admin';
    if (probe.indexOf('shop') >= 0 || probe.indexOf('تسو') >= 0) return 'shop';
    if (probe.indexOf('leisur') >= 0 || probe.indexOf('ترفي') >= 0) return 'leisure';
    if (probe.indexOf('estat') >= 0 || probe.indexOf('عقار') >= 0) return 'estate';
    if (probe.indexOf('misc') >= 0 || probe.indexOf('متنو') >= 0) return 'misc';
    return CITY_LEGEND_KEYS[fallbackIndex % CITY_LEGEND_KEYS.length] || 'misc';
  }

  function enhanceCityLegendIcons() {
    try {
      var rows = document.querySelectorAll('#zone-main .zone-city-legend > div');
      if (!rows.length) return;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var iconSpan = row.firstElementChild;
        if (!iconSpan || iconSpan.tagName !== 'SPAN') continue;
        var labelEl = row.children && row.children.length > 1 ? row.children[1] : null;
        var labelTxt = labelEl ? (labelEl.textContent || '') : (row.textContent || '');
        var key = resolveLegendIconKey(labelTxt, i);
        var svgMarkup = CITY_LEGEND_SVGS[key] || CITY_LEGEND_SVGS.misc;
        var curSvg = iconSpan.querySelector('svg.zfx-legend-svg');
        if (!curSvg) {
          iconSpan.setAttribute('data-zfx-legend-icon', key);
          var holder = document.createElement('div');
          holder.innerHTML = svgMarkup;
          if (holder.firstElementChild) {
            iconSpan.appendChild(holder.firstElementChild);
          }
        } else if (iconSpan.getAttribute('data-zfx-legend-icon') !== key) {
          iconSpan.setAttribute('data-zfx-legend-icon', key);
          var nextHolder = document.createElement('div');
          nextHolder.innerHTML = svgMarkup;
          if (nextHolder.firstElementChild) {
            curSvg.innerHTML = nextHolder.firstElementChild.innerHTML;
          }
        }
      }
    } catch (_) {}
  }

  function enhanceCrimeCategoryNav() {
    try {
      var catBtns = document.querySelectorAll('#zone-main .zone-crime-activity-nav button[data-crime-category]');
      if (!catBtns.length) return;
      for (var i = 0; i < catBtns.length; i++) {
        var btn = catBtns[i];
        if (!btn.querySelector('svg.zfx-crime-cat-svg')) {
          btn.setAttribute('data-zfx-crime-cat', String(i));
          var wrap = document.createElement('div');
          wrap.innerHTML = buildCrimeCategorySvg(i);
          if (wrap.firstElementChild) {
            btn.appendChild(wrap.firstElementChild);
          }
        }
      }
    } catch (_) {}
  }

  /* ---------------- Demand-Driven Hero Atmosphere (.zaaa-hero-atmosphere: 1 Static Frame at Rest, 24fps on Hover Only!) ---------------- */
  function shouldRunHeroLoop() {
    return Boolean(!prefersReducedMotion() && !document.hidden && state.heroVisible && state.heroHovered);
  }

  function renderHeroAtmosphereFrame(now, isStaticPass) {
    if (prefersReducedMotion()) return;
    var cv = document.querySelector('#zone-main .zone-page-heading canvas.zaaa-hero-atmosphere');
    if (!cv) return;
    try {
      var rect = cv.getBoundingClientRect();
      if (!rect || rect.width < 80 || rect.height < 36) return;

      var dt = isStaticPass
        ? 0
        : (state.heroPrevAt ? Math.min(0.08, Math.max(0.016, (now - state.heroPrevAt) / 1000)) : 0.041);
      if (!isStaticPass) state.heroPrevAt = now;

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
      var rainAlpha = light ? 0.08 : 0.16;
      ctx.strokeStyle = 'rgba(186, 230, 253, ' + rainAlpha + ')';
      ctx.lineWidth = 1;

      for (var i = 0; i < state.heroDrops.length; i++) {
        var d = state.heroDrops[i];
        if (!isStaticPass) {
          d.y += d.spd * dt * 1.25;
          d.x -= d.spd * dt * 0.12;
          if (d.y > 1.12) {
            d.y = -0.12;
            d.x = 0.24 + Math.random() * 0.74;
          }
        }
        var rx = d.x * w;
        var ry = d.y * h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3.2, ry + d.len);
        ctx.stroke();
      }

      for (var j = 0; j < state.heroMotes.length; j++) {
        var m = state.heroMotes[j];
        if (!isStaticPass) {
          m.y -= m.spd * dt;
          if (m.y < -0.08) {
            m.y = 1.08;
            m.x = 0.20 + Math.random() * 0.76;
          }
        }
        var pulse = 0.5 + 0.5 * Math.sin(now * 0.0022 + m.phase);
        var moteAlpha = (light ? 0.10 : 0.24) + pulse * (light ? 0.10 : 0.22);
        var mx = (m.x + Math.sin(now * 0.001 + m.phase) * 0.014) * w;
        var my = m.y * h;
        ctx.fillStyle = (j % 3 === 0)
          ? 'rgba(56, 189, 248, ' + (moteAlpha * 0.85).toFixed(3) + ')'
          : (j % 2 === 0)
            ? 'rgba(57, 231, 163, ' + (moteAlpha * 0.85).toFixed(3) + ')'
            : 'rgba(251, 191, 36, ' + moteAlpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(mx, my, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } catch (_) {}
  }

  function heroLoopStep(now) {
    state.heroRaf = 0;
    if (!shouldRunHeroLoop()) {
      state.heroPrevAt = 0;
      return;
    }
    /* Cap hero hover atmosphere at ~24fps (41ms) for whisper-quiet GPU load */
    if (!state.heroLastPaintAt || (now - state.heroLastPaintAt) >= 41) {
      state.heroLastPaintAt = now;
      state.heroTicks += 1;
      renderHeroAtmosphereFrame(now, false);
    }
    if (shouldRunHeroLoop()) {
      state.heroRaf = requestAnimationFrame(heroLoopStep);
    }
  }

  function syncHeroLoop() {
    if (shouldRunHeroLoop()) {
      if (!state.heroRaf) {
        state.heroPrevAt = 0;
        state.heroRaf = requestAnimationFrame(heroLoopStep);
      }
    } else if (state.heroRaf) {
      cancelAnimationFrame(state.heroRaf);
      state.heroRaf = 0;
      state.heroPrevAt = 0;
    }
  }

  function ensureHeroAtmosphereCanvas() {
    if (prefersReducedMotion()) return;
    try {
      var heading = document.querySelector('#zone-main .zone-page-heading');
      if (!heading) {
        state.heroHovered = false;
        syncHeroLoop();
        return;
      }

      if (heading !== state.heroBoundHeading) {
        state.heroBoundHeading = heading;
        state.heroHovered = false;
        heading.addEventListener('pointerenter', function () {
          state.heroHovered = true;
          syncHeroLoop();
        }, { passive: true });
        heading.addEventListener('pointerleave', function () {
          state.heroHovered = false;
          syncHeroLoop();
        }, { passive: true });
      }

      var cv = heading.querySelector('canvas.zaaa-hero-atmosphere');
      var created = false;
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'zaaa-hero-atmosphere';
        cv.setAttribute('aria-hidden', 'true');
        heading.appendChild(cv);
        created = true;
        if (!state.heroIo && typeof IntersectionObserver === 'function') {
          state.heroIo = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              state.heroVisible = Boolean(entries[i].isIntersecting);
            }
            syncHeroLoop();
          }, { threshold: 0.01 });
        }
        if (state.heroIo) {
          try {
            state.heroIo.disconnect();
            state.heroIo.observe(cv);
          } catch (_) {}
        }
      }

      /* Draw 1 crisp static atmospheric frame at rest (0 continuous rAF loops!) */
      if (created || !state.heroRaf) {
        renderHeroAtmosphereFrame(1480, true);
      }
    } catch (_) {}
  }

  /* ---------------- Offscreen WebGL Iframe Throttling (#zone-char-3d & #zone-city-map) ---------------- */
  function setIframePauseState(frame, key, shouldPause) {
    if (!frame) return;
    var nextPause = Boolean(shouldPause);
    var prevPause = state.iframePaused[key];
    frame.style.contentVisibility = nextPause ? 'hidden' : 'visible';
    frame.setAttribute('data-zfx-throttled', nextPause ? '1' : '0');
    if (prevPause !== nextPause) {
      state.iframePaused[key] = nextPause;
      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage(
            { type: 'ZONE_RENDER_PAUSE', zonePauseRender: nextPause },
            window.location.origin
          );
        }
      } catch (_) {}
    }
  }

  function syncWebglIframeThrottle() {
    try {
      var main = document.getElementById('zone-main');
      var scr = main ? (main.getAttribute('data-zone-screen') || 'home') : 'home';
      var hiddenDoc = Boolean(document.hidden);

      var charFrame = document.getElementById('zone-char-3d');
      var mapFrame = document.getElementById('zone-city-map');

      if (!state.iframeIo && typeof IntersectionObserver === 'function') {
        state.iframeIo = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var ent = entries[i];
            if (!ent.target) continue;
            if (ent.target.id === 'zone-char-3d') {
              state.iframeIntersecting.char3d = Boolean(ent.isIntersecting);
            } else if (ent.target.id === 'zone-city-map') {
              state.iframeIntersecting.cityMap = Boolean(ent.isIntersecting);
            }
          }
          syncWebglIframeThrottle();
        }, { threshold: 0.01 });
      }

      if (charFrame) {
        if (state.iframeIo && !charFrame.hasAttribute('data-zfx-io')) {
          charFrame.setAttribute('data-zfx-io', '1');
          try { state.iframeIo.observe(charFrame); } catch (_) {}
        }
        var pauseChar = hiddenDoc || scr !== 'home' || state.iframeIntersecting.char3d === false;
        setIframePauseState(charFrame, 'char3d', pauseChar);
      }

      if (mapFrame) {
        if (state.iframeIo && !mapFrame.hasAttribute('data-zfx-io')) {
          mapFrame.setAttribute('data-zfx-io', '1');
          try { state.iframeIo.observe(mapFrame); } catch (_) {}
        }
        var pauseMap = hiddenDoc || scr !== 'city' || state.iframeIntersecting.cityMap === false;
        setIframePauseState(mapFrame, 'cityMap', pauseMap);
      }
    } catch (_) {}
  }

  function bindDynamicSubListObserver() {
    try {
      var target = document.querySelector('#zone-main .zone-city-destinations, #zone-main .zone-crime-activity-nav, #zone-main .zone-city-legend');
      if (target === state.subListEl) return;
      state.subListEl = target || null;
      if (state.subListObserver) {
        try { state.subListObserver.disconnect(); } catch (_) {}
      }
      if (target && typeof MutationObserver === 'function') {
        state.subListObserver = new MutationObserver(function () {
          scheduleSurfacePolish();
        });
        state.subListObserver.observe(target, { childList: true, subtree: false });
      }
    } catch (_) {}
  }

  /* ---------------- Instant Session Auto-Heal & [Reconnect] Rescue ---------------- */
  function isRealBrowserRuntime() {
    try {
      if (typeof window.fetch !== 'function') return false;
      if (typeof location !== 'object' || !location) return false;
      var proto = String(location.protocol || '');
      if (proto !== 'http:' && proto !== 'https:') return false;
      if (document.querySelector('x-dc')) return false;
      if (typeof URLSearchParams === 'function') {
        var params = new URLSearchParams(location.search || '');
        if (params.get('zone-preview') === '1') return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function isReconnectControl(btn) {
    if (!btn || !(btn instanceof Element)) return false;
    if (btn.closest('.zone-connection-recovery, [data-zone-connection]')) return true;
    if (!btn.closest('#zone-main')) return false;
    var label = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(reconnect|reconnecting\.{0,3}|أعد الاتصال|إعادة الاتصال|جارٍ إعادة الاتصال\.{0,3})$/i.test(label);
  }

  async function healExpiredPlayerSession(isManualClick) {
    if (!isRealBrowserRuntime()) return false;
    if (state.sessionHealing) return false;
    if (!isManualClick) {
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('zaaa_session_healed_v128') === '1') {
          return false;
        }
      } catch (_) {}
    }

    state.sessionHealing = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('zaaa_session_healed_v128', '1');
      }
    } catch (_) {}

    try {
      var acctRes = await window.fetch('/api/v1/auth/account', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      var acct = null;
      try { acct = await acctRes.json(); } catch (_) {}

      /* If the cookie belongs to a valid claimed permanent account, let ZoneSession.recover() restore it without logout */
      if (acctRes && acctRes.ok && acct && acct.claimed === true && typeof acct.playerId === 'string') {
        if (window.ZoneSession && typeof window.ZoneSession.recover === 'function') {
          try { await window.ZoneSession.recover(); } catch (_) {}
        }
        return true;
      }

      /* Dead or unclaimed stale HttpOnly cookie: clear via POST /api/v1/auth/logout, mint fresh session, reload cleanly */
      try {
        await window.fetch('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: '{}'
        });
      } catch (_) {}

      var sessRes = await window.fetch('/api/v1/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}'
      });
      var sess = null;
      try { sess = await sessRes.json(); } catch (_) {}

      if (sessRes && sessRes.ok && sess && typeof sess.playerId === 'string') {
        try {
          var prevId = localStorage.getItem('zone.player.id');
          if (prevId && prevId !== sess.playerId) {
            localStorage.removeItem('zone.v2.save');
          }
          localStorage.setItem('zone.player.id', sess.playerId);
        } catch (_) {}
        if (location && typeof location.reload === 'function') {
          location.reload();
        }
        return true;
      }
    } catch (_) {
      return false;
    } finally {
      state.sessionHealing = false;
    }
    return false;
  }

  function checkAutoSessionHeal() {
    try {
      var rootEl = document.documentElement;
      if (!rootEl) return;
      var accessState = (rootEl.dataset && rootEl.dataset.zonePlayerAccess) || rootEl.getAttribute('data-zone-player-access') || '';
      if (accessState === 'expired') {
        healExpiredPlayerSession(false);
      }
    } catch (_) {}
  }

  function bindSessionAccessObserver() {
    try {
      var rootEl = document.documentElement;
      if (!rootEl || state.accessObserver || typeof MutationObserver !== 'function') return;
      state.accessObserver = new MutationObserver(function () {
        checkAutoSessionHeal();
      });
      state.accessObserver.observe(rootEl, {
        attributes: true,
        attributeFilter: ['data-zone-player-access']
      });
      checkAutoSessionHeal();
    } catch (_) {}
  }

  function runSurfacePolish() {
    ensureStyles();
    if (document.querySelector('x-dc')) return;
    enhanceQuickActions();
    enhanceCityDestinations();
    enhanceCityLegendIcons();
    enhanceCrimeCategoryNav();
    ensureHeroAtmosphereCanvas();
    syncWebglIframeThrottle();
    bindDynamicSubListObserver();
    checkAutoSessionHeal();
  }

  function scheduleSurfacePolish() {
    if (state.polishPending) return;
    state.polishPending = true;
    setTimeout(function () {
      state.polishPending = false;
      runSurfacePolish();
    }, 24);
  }

  /* ---------------- Strictly Gated rAF Cursor-Spotlight ---------------- */
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
    if (!ev || !(ev.target instanceof Element)) return;
    try {
      var cardOrQuick = ev.target.closest('.zig-game-card, .zone-quick-actions > button');
      if (!cardOrQuick) return;
      applySpotlightCoords(cardOrQuick, ev.clientX, ev.clientY);
      var panel = cardOrQuick.closest('.zone-panel');
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
              syncWebglIframeThrottle();
              scheduleSurfacePolish();
            } else if (next) {
              state.lastScreen = next;
              syncWebglIframeThrottle();
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
      /* Observe direct children swaps of #zone-main only (subtree: false avoids 1-sec clock mutations!) */
      state.mainPolishObserver.observe(main, { childList: true, subtree: false });
    } catch (_) {}
  }

  function bindHudObserver() {
    try {
      var cashEl = document.getElementById('zone-cash');
      var cashHost = cashEl && cashEl.parentNode ? cashEl.parentNode : null;
      var barsWrap = document.querySelector('.zone-profile-bars');
      if (cashHost === state.hudCashNode && barsWrap === state.hudBarsNode && state.hudObserver) {
        return;
      }
      state.hudCashNode = cashHost;
      state.hudBarsNode = barsWrap;
      if (state.hudObserver) {
        try { state.hudObserver.disconnect(); } catch (_) {}
      }
      state.hudObserver = new MutationObserver(function () {
        scheduleTelemetryCheck();
      });
      if (cashHost) {
        state.hudObserver.observe(cashHost, { childList: true, characterData: true, subtree: true });
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
      /* 0. Strictly Gated Cursor-Spotlight rAF Pointer Tracking */
      document.addEventListener('pointermove', function (ev) {
        if (ev.pointerType === 'touch') return;
        if (!(ev.target instanceof Element) || !ev.target.closest('.zig-game-card, .zone-quick-actions > button')) return;
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

          var rawBtn = t.closest('button');
          if (rawBtn && isReconnectControl(rawBtn)) {
            healExpiredPlayerSession(true);
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

      var lastVCheck = Date.now();
      var vCheckInFlight = false;
      function checkLiveBundleVersion(forceCheck) {
        try {
          if (typeof navigator !== 'undefined' && navigator.webdriver) return;
          if (document.hidden || vCheckInFlight) return;
          if (!location || (location.protocol !== 'https:' && location.protocol !== 'http:')) return;
          var now = Date.now();
          if (!forceCheck && now - lastVCheck <= 60000) return;
          var curScript = document.querySelector('script[src*="aaa-game-fx.js?v="]');
          var curSrc = curScript ? curScript.getAttribute('src') || '' : '';
          var curMatch = curSrc.match(/aaa-game-fx\.js\?v=(\d+)/);
          if (!curMatch) return;
          lastVCheck = now;
          vCheckInFlight = true;
          fetch('/?__vc=' + now, { cache: 'no-store', credentials: 'same-origin' })
            .then(function (res) {
              return res && res.ok ? res.text() : '';
            })
            .then(function (html) {
              vCheckInFlight = false;
              if (!html) return;
              var liveMatch = html.match(/aaa-game-fx\.js\?v=(\d+)/);
              if (liveMatch && liveMatch[1] && liveMatch[1] !== curMatch[1]) {
                window.location.reload();
              }
            })
            .catch(function () {
              vCheckInFlight = false;
            });
        } catch (_) {
          vCheckInFlight = false;
        }
      }

      document.addEventListener('visibilitychange', function () {
        syncHeroLoop();
        syncWebglIframeThrottle();
        if (!document.hidden) {
          checkLiveBundleVersion(false);
        }
      });

      window.addEventListener('pageshow', function (ev) {
        if (ev && ev.persisted) {
          checkLiveBundleVersion(true);
        }
      });
    } catch (_) {}
  }

  /* ---------------- Lifecycle & Boot (Zero setInterval Polling, Zero Idle rAF!) ---------------- */
  function boot() {
    try {
      ensureLayer();
      bindSessionAccessObserver();
      bindMainScreenObserver();
      bindHudObserver();
      runSurfacePolish();
      evaluateTelemetryDeltas();

      window.addEventListener('zone:render', function () {
        bindMainScreenObserver();
        bindHudObserver();
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
            bindHudObserver();
            runSurfacePolish();
          }, 120);
        });
        state.rootObserver.observe(document.body, { childList: true, subtree: false });
      }
    } catch (_) {}
  }

  setupInputListeners();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ZoneGameFX = {
    version: '129.0',
    isMuted: isMuted,
    setMuted: setMuted,
    spawnDelta: spawnDelta,
    triggerScreenReveal: triggerScreenReveal,
    playCue: playCue,
    runSurfacePolish: runSurfacePolish,
    syncWebglIframeThrottle: syncWebglIframeThrottle,
    healExpiredPlayerSession: healExpiredPlayerSession,
    getPerfStats: function () {
      return {
        heroLoopRunning: Boolean(state.heroRaf),
        heroTicks: state.heroTicks,
        iframePaused: { char3d: state.iframePaused.char3d, cityMap: state.iframePaused.cityMap }
      };
    }
  };
})();

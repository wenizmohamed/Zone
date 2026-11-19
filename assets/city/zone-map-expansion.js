/* ZONE v137 - Expansive 3.2km Coastal Island & Peninsula Metropolis, Organic Waterways,
   Turquoise Shallows, Cove Beaches, Parks & 3D Tree Canopy, 3 Real 3D Bridges,
   Sculpted Unique Architecture, Living Traffic/Boats/Beacons & Sketchbook HUD */
(function (root) {
  "use strict";
  if (root && root.__zoneMapExpansionVersion && root.__zoneMapExpansionVersion >= 137) return;

  var EXTRA_ICONS = {
    airport: "M12 2l2.2 6.8L22 11v2l-7.8-1.2L13.5 18l2.5 1.8V21l-4-1-4 1v-1.2L10.5 18l-.7-6.2L2 13v-2l7.8-2.2L12 2z",
    heliport: "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0M9 8v8M15 8v8M9 12h6M6 5h12",
    nightclub: "M5 4h14l-7 8v7M8 19h8M9.5 7.5h5",
    velvet: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8zM5 21h14",
    chopshop: "M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z",
    smuggler: "M12 3v15M8 7h8M5 14c0 4 3.2 7 7 7s7-3 7-7M4 14h3M17 14h3",
    fightclub: "M7 6a4 4 0 0 1 4 4v5H6a3 3 0 0 1-3-3v-2a4 4 0 0 1 4-4zm10 0a4 4 0 0 1 4 4v2a3 3 0 0 1-3 3h-5v-5a4 4 0 0 1 4-4zM6 18h5M13 18h5",
    crypto: "M12 2l8 4.6v9.8L12 21l-8-4.6V6.6L12 2zm0 5v10M8.5 9.5L12 7l3.5 2.5v5L12 17l-3.5-2.5v-5z",
    exchange: "M4 19h16M6 15l4-4 3 3 5-6M14 8h4v4",
    jeweler: "M6 4h12l4 5-10 12L2 9l4-5zM2 9h20M9 4L7 9l5 12 5-12-2-5",
    auction: "M14 4l6 6-2.5 2.5-6-6L14 4zM5 19l7.5-7.5M3 21h9M10 8l6 6",
    stadium: "M3 10c0-3.3 4-6 9-6s9 2.7 9 6v5c0 3.3-4 6-9 6s-9-2.7-9-6v-5zm0 0c0 2.8 4 5 9 5s9-2.2 9-5M12 4v3M7 5v2.5M17 5v2.5",
    racetrack: "M5 3v18M5 4h11l-2 3.5L16 11H5M9 4v7M13 4v7",
    arcade: "M6 8h12a4 4 0 0 1 4 4v4a3 3 0 0 1-3 3c-1.5 0-2.4-.8-3.4-2H8.4c-1 1.2-1.9 2-3.4 2a3 3 0 0 1-3-3v-4a4 4 0 0 1 4-4zm2 3v4M6 13h4M15.5 12h.01M17.5 14h.01",
    cinema: "M4 7h16v13H4V7zm0 0l2-4h12l2 4M8 3l2 4M14 3l2 4M10 11l5 2.5-5 2.5v-5z",
    marina: "M12 3v13M12 4l7 9h-7M12 6L7 13h5M3 18c2.5 2 5.5 2.5 9 2.5s6.5-.5 9-2.5L19 16H5l-2 2z",
    docks: "M3 16l2-6h14l2 6M6 10V6h12v4M2 19c2.5 1.5 5 1.5 7.5 0 2.5 1.5 5 1.5 7.5 0 1.8 1 3.5 1.2 5 .5M12 6V3",
    pharmacy: "M7 3h10v4H7V3zm-2 4h14v14H5V7zm7 3v8M8 14h8",
    clinic: "M3 5h18v14H3V5zm3 7h3l2-4 3 8 2-4h2",
    boxinggym: "M12 2v3M8 5h8v11a4 4 0 0 1-8 0V5zm0 4h8M8 13h8",
    courthouse: "M12 3l9 5H3l9-5zM5 8v9M9 8v9M15 8v9M19 8v9M3 17h18M2 20h20",
    police: "M12 2l7 3v6c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V5l7-3zm0 5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4L12 7z",
    pawnshop: "M12 4v3M7.5 14a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm9 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 5l-4.5 2m4.5-2l4.5 2",
    university: "M12 3L2 8l10 5 10-5-10-5zm-6 7.5V16c0 1.8 2.7 3.5 6 3.5s6-1.7 6-3.5v-5.5M22 8v6",
    penthouse: "M4 21V9l8-6 8 6v12H4zm5-12v12m6-12v12M8 9h8M8 13h8",
    corptower: "M4 21V5l6-2v18M10 9h10v12M7 8h.01M7 12h.01M7 16h.01M14 13h2M14 17h2",
    subway: "M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm-3 8h18M8 15h.01M16 15h.01M8 18l-2 3M16 18l2 3",
    radio: "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 4l-4 7m4-7l4 7M9.5 18h5M7.5 7.5a6.5 6.5 0 0 1 9 0M5 5a10 10 0 0 1 14 0"
  };

  var WORLD_CITIES = [
    {
      id: "zone",
      code: "ZCT",
      minLevel: 1,
      fare: 0,
      tzOffset: null,
      mapX: 255,
      mapY: 108,
      accent: "#39e7a3",
      name: { en: "Zone City", ar: "مدينة زون" },
      region: { en: "Atlantic Syndicate Hub", ar: "المركز الرئيسي للعصابات" },
      perk: { en: "Home Turf · All 5 Sectors & Territory Wars", ar: "أرضك الأساسية · 5 قطاعات وحروب العائلات" },
      contract: { en: "Collect Downtown Protection Cut", ar: "تحصيل حصة الحماية المحلية", cash: 1850, xp: 30 }
    },
    {
      id: "riyadh",
      code: "RUH",
      minLevel: 1,
      fare: 1200,
      tzOffset: 3,
      mapX: 505,
      mapY: 128,
      accent: "#ebb858",
      name: { en: "Riyadh", ar: "الرياض" },
      region: { en: "Sovereign Capital Exchange", ar: "بورصة العاصمة السيادية" },
      perk: { en: "Bullion Arbitrage & Luxury Convoy Contracts", ar: "تجارة السبائك وعقود القوافل الفاخرة" },
      contract: { en: "Olaya Gold Bullion Arbitrage", ar: "صفقة سبائك ذهب العليا", cash: 4600, xp: 55 }
    },
    {
      id: "cairo",
      code: "CAI",
      minLevel: 1,
      fare: 950,
      tzOffset: 2,
      mapX: 468,
      mapY: 124,
      accent: "#f59e0b",
      name: { en: "Cairo", ar: "القاهرة" },
      region: { en: "Nile Shadow Bazaar", ar: "بازار النيل السري" },
      perk: { en: "Antiquities Relay & Encrypted Courier Runs", ar: "تهريب الآثار ورسائل التشفير السريعة" },
      contract: { en: "Zamalek Encrypted Courier Drop", ar: "تسليم مشفر في الزمالك", cash: 3900, xp: 48 }
    },
    {
      id: "dubai",
      code: "DXB",
      minLevel: 3,
      fare: 2400,
      tzOffset: 4,
      mapX: 534,
      mapY: 130,
      accent: "#38bdf8",
      name: { en: "Dubai", ar: "دبي" },
      region: { en: "Marina Sky-Vaults & Supercars", ar: "خزائن المارينا والسيارات الخارقة" },
      perk: { en: "Offshore Diamond Clearing & Exotic Exports", ar: "تصفية الألماس وتصدير السيارات النادرة" },
      contract: { en: "Marina Supercar Container Flip", ar: "شحنة سيارات خارقة من المارينا", cash: 8200, xp: 85 }
    },
    {
      id: "istanbul",
      code: "IST",
      minLevel: 6,
      fare: 3500,
      tzOffset: 3,
      mapX: 462,
      mapY: 102,
      accent: "#f43f5e",
      name: { en: "Istanbul", ar: "إسطنبول" },
      region: { en: "Bosphorus Strait Transit", ar: "معبر مضيق البسفور" },
      perk: { en: "Two-Continent Arms & Contraband Broker", ar: "وساطة السلاح والبضائع عبر القارتين" },
      contract: { en: "Bosphorus Midnight Freight Relay", ar: "عبور شحنة منتصف الليل بالبسفور", cash: 12800, xp: 120 }
    },
    {
      id: "tokyo",
      code: "TYO",
      minLevel: 10,
      fare: 6800,
      tzOffset: 9,
      mapX: 702,
      mapY: 110,
      accent: "#a855f7",
      name: { en: "Neo-Tokyo", ar: "نيو طوكيو" },
      region: { en: "Shibuya Zero-Day Syndicate", ar: "نقابة شيبويا السيبرانية" },
      perk: { en: "Prototype Cyber-Deck & Yakuza High Stakes", ar: "رقائق إلكترونية وطاولات الياكوزا العليا" },
      contract: { en: "Shinjuku Dark-Fiber Ledger Heist", ar: "اختراق خزنة الألياف في شينجوكو", cash: 22500, xp: 190 }
    },
    {
      id: "montecarlo",
      code: "MCO",
      minLevel: 15,
      fare: 12500,
      tzOffset: 1,
      mapX: 412,
      mapY: 98,
      accent: "#facc15",
      name: { en: "Monte Carlo", ar: "مونت كارلو" },
      region: { en: "Grand Prix Sovereign Salon", ar: "صالون الجائزة الكبرى السيادي" },
      perk: { en: "Private Yacht Baccarat & Sovereign Bonds", ar: "طاولات اليخوت الخاصة والسندات السيادية" },
      contract: { en: "Harbor Yacht High-Table Sweep", ar: "تصفية طاولة اليخت الملكي", cash: 38000, xp: 310 }
    }
  ];

  var ZMX_SVGS = {
    dawn:
      '<svg class="zmx-svg-ico zmx-ico-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-dawn" x1="6" y1="7" x2="18" y2="18" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fda4af"/><stop offset="55%" stop-color="#fb923c"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient></defs>' +
        '<path class="zmx-sun-rays" d="M12 4.8V8M5.8 8.8L8 11M18.2 8.8L16 11" stroke="#fde047" stroke-width="1.9" stroke-linecap="round"/>' +
        '<path d="M6.2 17A5.8 5.8 0 0 1 17.8 17H6.2Z" fill="url(#zmx-g-dawn)"/>' +
        '<path d="M3.5 17.5H20.5" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    day:
      '<svg class="zmx-svg-ico zmx-ico-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-day" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs>' +
        '<g class="zmx-sun-rays" stroke="#f59e0b" stroke-width="1.9" stroke-linecap="round">' +
          '<path d="M12 2.5V5.2M12 18.8V21.5M2.5 12H5.2M18.8 12H21.5M5.3 5.3L7.2 7.2M16.8 16.8L18.7 18.7M18.7 5.3L16.8 7.2M7.2 16.8L5.3 18.7"/>' +
        '</g>' +
        '<circle cx="12" cy="12" r="5.1" fill="url(#zmx-g-day)"/>' +
        '<circle cx="10.6" cy="10.6" r="1.4" fill="#ffffff" fill-opacity="0.72"/>' +
      '</svg>',
    afternoon:
      '<svg class="zmx-svg-ico zmx-ico-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="zmx-g-aft-sun" x1="5" y1="5" x2="15" y2="15" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#f97316"/></linearGradient>' +
          '<linearGradient id="zmx-g-aft-cld" x1="8" y1="10" x2="20" y2="19" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#bae6fd"/></linearGradient>' +
        '</defs>' +
        '<circle cx="9.6" cy="9.6" r="4.4" fill="url(#zmx-g-aft-sun)"/>' +
        '<path d="M8.8 18.4H18.4A3.4 3.4 0 0 0 18.4 11.6C18.1 11.6 17.8 11.65 17.5 11.72A4.4 4.4 0 0 0 9.1 13A2.8 2.8 0 0 0 8.8 18.4Z" fill="url(#zmx-g-aft-cld)" fill-opacity="0.95"/>' +
      '</svg>',
    dusk:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-dusk" x1="5" y1="6" x2="19" y2="19" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>' +
        '<circle cx="17.2" cy="6.8" r="2.8" fill="#fde047"/>' +
        '<path d="M5.5 18.5V9.2L11.2 6V18.5H5.5ZM11.2 11.2H17.8V18.5H11.2V11.2Z" fill="url(#zmx-g-dusk)"/>' +
        '<path d="M3 18.5H21" stroke="#ffffff" stroke-opacity="0.82" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    night:
      '<svg class="zmx-svg-ico zmx-ico-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-night" x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#38bdf8"/><stop offset="55%" stop-color="#818cf8"/><stop offset="100%" stop-color="#c084fc"/></linearGradient></defs>' +
        '<path d="M19.6 14.6A7.6 7.6 0 0 1 9.4 4.4A7.6 7.6 0 1 0 19.6 14.6Z" fill="url(#zmx-g-night)"/>' +
        '<circle cx="16.8" cy="6.4" r="1.25" fill="#ffffff"/>' +
        '<circle cx="19.4" cy="9.4" r="0.85" fill="#bae6fd"/>' +
      '</svg>',
    plane:
      '<svg class="zmx-svg-ico zmx-ico-jet" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-jet" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs>' +
        '<path d="M12 2.2L14.4 8.8L21.6 11.2V13.2L14.4 12.1L13.6 18.1L16.4 19.9V21.6L12 20.4L7.6 21.6V19.9L10.4 18.1L9.6 12.1L2.4 13.2V11.2L9.6 8.8L12 2.2Z" fill="url(#zmx-g-jet)"/>' +
        '<path d="M12 3.8L13.1 9.6L12 18.6L10.9 9.6L12 3.8Z" fill="#ffffff" fill-opacity="0.9"/>' +
      '</svg>',
    lock:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-lock" x1="5" y1="10" x2="19" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs>' +
        '<path d="M8.2 11V7.7C8.2 5.6 9.9 3.9 12 3.9C14.1 3.9 15.8 5.6 15.8 7.7V11" stroke="#b45309" stroke-width="2" stroke-linecap="round"/>' +
        '<rect x="5" y="10.6" width="14" height="10.4" rx="2.8" fill="url(#zmx-g-lock)"/>' +
        '<circle cx="12" cy="15.4" r="1.45" fill="#ffffff"/>' +
      '</svg>',
    unlock:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-unlock" x1="5" y1="10" x2="19" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
        '<path d="M8.2 11V7.5C8.2 5.4 9.9 3.7 12 3.7C13.8 3.7 15.2 4.8 15.7 6.4" stroke="#059669" stroke-width="2" stroke-linecap="round"/>' +
        '<rect x="5" y="10.6" width="14" height="10.4" rx="2.8" fill="url(#zmx-g-unlock)"/>' +
        '<circle cx="12" cy="15.4" r="1.45" fill="#ffffff"/>' +
      '</svg>',
    recon:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-recon" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>' +
        '<circle cx="12" cy="12" r="8.8" fill="url(#zmx-g-recon)"/>' +
        '<circle cx="12" cy="12" r="4.4" stroke="#ffffff" stroke-width="1.5"/>' +
        '<circle cx="12" cy="12" r="1.8" fill="#ffffff"/>' +
      '</svg>',
    bolt:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-bolt" x1="5" y1="2.5" x2="19" y2="21.5" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#f97316"/></linearGradient></defs>' +
        '<path d="M13.2 2.2L5.2 13.2H11.4L10.4 21.8L18.8 10.8H12.6L13.2 2.2Z" fill="url(#zmx-g-bolt)"/>' +
      '</svg>',
    check:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-check" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
        '<circle cx="12" cy="12" r="9.2" fill="url(#zmx-g-check)"/>' +
        '<path d="M8 12.3L10.8 15.1L16.3 9.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>',
    alert:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-alert" x1="3" y1="3.5" x2="21" y2="19.5" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f43f5e"/></linearGradient></defs>' +
        '<path d="M12 3.2L21.2 19.6H2.8L12 3.2Z" fill="url(#zmx-g-alert)"/>' +
        '<path d="M12 9.4V13.8M12 16.8H12.01" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round"/>' +
      '</svg>'
  };

  var TIME_PHASES = {
    dawn: {
      id: "dawn",
      icon: ZMX_SVGS.dawn,
      label: { en: "Dawn", ar: "الفجر" },
      fog: { color: "#e5bfd1", "high-color": "#5876a8", "space-color": "#263659", "horizon-blend": 0.12, range: [1.8, 16], "star-intensity": 0.05 },
      ambient: { color: "#eeddf6", intensity: 0.72 },
      sun: { color: "#ffb88c", intensity: 0.85, direction: [96, 28] },
      land: "#e0d6df",
      landInd: "#d1c6d2",
      water: "#3f7b9e",
      shallows: "#63aebc",
      beach: "#e2cdb8",
      park: "#6a9d74",
      pitch: "#49a861",
      tree: ["#437352", "#588d64", "#6ea675"],
      roadMain: "#f5edf7",
      road: "#b5a9ba",
      roadCase: "#7d7284",
      roadCenter: "#e2b870",
      pier: "#cfc4ce",
      asphalt: "#363b47",
      bldg: ["#b9b2c4", "#cbc4d6", "#e4dce9"],
      lockFill: "#0f172a",
      lockOpacity: 0.09,
      isLightUi: true
    },
    day: {
      id: "day",
      icon: ZMX_SVGS.day,
      label: { en: "Day", ar: "النهار" },
      fog: { color: "#e6f2fc", "high-color": "#7ec0f6", "space-color": "#4ea1e8", "horizon-blend": 0.1, range: [2.0, 17], "star-intensity": 0 },
      ambient: { color: "#eef4fa", intensity: 0.60 },
      sun: { color: "#fff6e0", intensity: 0.88, direction: [148, 52] },
      land: "#efe6d4",
      landInd: "#e2d7c0",
      water: "#3681a8",
      shallows: "#5bc8cf",
      beach: "#ecd9ae",
      park: "#74a55b",
      pitch: "#46b859",
      tree: ["#3e7340", "#558f4e", "#6ea85c"],
      roadMain: "#fcf7ec",
      road: "#d6cab2",
      roadCase: "#9d9079",
      roadCenter: "#e0b354",
      pier: "#dcd2be",
      asphalt: "#343b45",
      bldg: ["#c9bea9", "#dcd2bf", "#efe6d6"],
      lockFill: "#0f172a",
      lockOpacity: 0.09,
      isLightUi: true
    },
    afternoon: {
      id: "afternoon",
      icon: ZMX_SVGS.afternoon,
      label: { en: "Afternoon", ar: "العصر" },
      fog: { color: "#f3dec0", "high-color": "#74a6d4", "space-color": "#437ab0", "horizon-blend": 0.12, range: [1.8, 16.5], "star-intensity": 0 },
      ambient: { color: "#f8e8ce", intensity: 0.58 },
      sun: { color: "#ffc978", intensity: 0.88, direction: [232, 38] },
      land: "#e6d8c0",
      landInd: "#d8c7ad",
      water: "#2d80a3",
      shallows: "#4db8be",
      beach: "#e5cb98",
      park: "#689f5c",
      pitch: "#43a852",
      tree: ["#3a6b3b", "#4e8546", "#669c52"],
      roadMain: "#fbf1df",
      road: "#c4b59d",
      roadCase: "#8d806b",
      roadCenter: "#d9a043",
      pier: "#d2c3aa",
      asphalt: "#333842",
      bldg: ["#b9a790", "#d1bfa7", "#e6d5be"],
      lockFill: "#0f172a",
      lockOpacity: 0.09,
      isLightUi: true
    },
    dusk: {
      id: "dusk",
      icon: ZMX_SVGS.dusk,
      label: { en: "Dusk", ar: "الغسق" },
      fog: { color: "#683c5d", "high-color": "#233056", "space-color": "#0e152b", "horizon-blend": 0.11, range: [1.6, 15.5], "star-intensity": 0.25 },
      ambient: { color: "#9ba9d6", intensity: 0.58 },
      sun: { color: "#ff8c59", intensity: 0.86, direction: [268, 21] },
      land: "#25293b",
      landInd: "#1e2233",
      water: "#163552",
      shallows: "#205570",
      beach: "#54474e",
      park: "#254038",
      pitch: "#246644",
      tree: ["#1b3a30", "#264e3e", "#32624c"],
      roadMain: "#636b87",
      road: "#3f465e",
      roadCase: "#202536",
      roadCenter: "#d98b4e",
      pier: "#343b4f",
      asphalt: "#1e2330",
      bldg: ["#3b455e", "#4f5c7a", "#687799"],
      lockFill: "#090d16",
      lockOpacity: 0.11,
      isLightUi: false
    },
    night: {
      id: "night",
      icon: ZMX_SVGS.night,
      label: { en: "Night", ar: "الليل" },
      fog: { color: "#0e182c", "high-color": "#080e1d", "space-color": "#040710", "horizon-blend": 0.08, range: [1.6, 15.5], "star-intensity": 0.55 },
      ambient: { color: "#a5c0e5", intensity: 0.58 },
      sun: { color: "#ffe5bd", intensity: 0.72, direction: [210, 38] },
      land: "#0f1522",
      landInd: "#0c111c",
      water: "#071a2d",
      shallows: "#0d3047",
      beach: "#242c3b",
      park: "#122a22",
      pitch: "#184f34",
      tree: ["#0e251e", "#16382b", "#1f4b38"],
      roadMain: "#384963",
      road: "#243044",
      roadCase: "#111724",
      roadCenter: "#eab308",
      pier: "#1d2738",
      asphalt: "#121824",
      bldg: ["#1c283d", "#283956", "#364d73"],
      lockFill: "#060a12",
      lockOpacity: 0.11,
      isLightUi: false
    }
  };

  function createExpansionController(ctx) {
    var map = ctx.map;
    var CENTER = ctx.CENTER || [-73.9865, 40.698];
    var ICON_PATHS = ctx.ICON_PATHS || {};
    var ensurePoiImage = ctx.ensurePoiImage;

    Object.keys(EXTRA_ICONS).forEach(function (k) {
      ICON_PATHS[k] = EXTRA_ICONS[k];
    });

    var prefersReducedMotion = false;
    try {
      prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {}

    var state = {
      lang: document.documentElement.lang === "ar" ? "ar" : "en",
      dark: true,
      timeMode: "auto",
      lastThemeDark: null,
      activePhase: "",
      playerLevel: 1,
      playerXp: 0,
      playerCash: 2500,
      activeCityId: "zone",
      transitBusy: false,
      lastData: null,
      gateMarkers: [],
      clockTimer: null,
      livingTimer: null,
      livingTick: 0,
      metroInstalled: false,
      didMetroFrame: false,
      styleReadyLatch: false,
      hostPaused: false,
      reducedMotion: prefersReducedMotion
    };

    try {
      var savedCity = localStorage.getItem("zone_world_city");
      if (savedCity && WORLD_CITIES.some(function (c) { return c.id === savedCity; })) {
        state.activeCityId = savedCity;
      }
      var savedTimeMode = sessionStorage.getItem("zone_map_time_mode");
      if (savedTimeMode && (savedTimeMode === "auto" || TIME_PHASES[savedTimeMode])) {
        state.timeMode = savedTimeMode;
      }
    } catch (_) {}

    function isMapStyleReady() {
      if (!map) return false;
      if (state.styleReadyLatch) return true;
      try {
        if (map.isStyleLoaded && map.isStyleLoaded()) {
          state.styleReadyLatch = true;
          return true;
        }
        var st = map.getStyle && map.getStyle();
        if (st && Array.isArray(st.layers) && st.layers.length > 0 && map.getLayer && map.getLayer("background")) {
          state.styleReadyLatch = true;
          return true;
        }
      } catch (_) {}
      return false;
    }

    function pt(dx, dy) {
      return [+(CENTER[0] + dx).toFixed(6), +(CENTER[1] + dy).toFixed(6)];
    }

    function rectPoly(dx0, dy0, dx1, dy1) {
      return [[
        pt(dx0, dy0),
        pt(dx1, dy0),
        pt(dx1, dy1),
        pt(dx0, dy1),
        pt(dx0, dy0)
      ]];
    }

    function closedRing(pairs) {
      var ring = pairs.map(function (p) { return pt(p[0], p[1]); });
      if (ring.length > 0) {
        var first = ring[0];
        var last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }
      }
      return [ring];
    }

    function smoothClosedPoly(pairs, iterations) {
      var pts = pairs.slice();
      var iters = iterations || 1;
      for (var k = 0; k < iters; k++) {
        var next = [];
        for (var i = 0; i < pts.length; i++) {
          var a = pts[i];
          var b = pts[(i + 1) % pts.length];
          next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
          next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        pts = next;
      }
      return closedRing(pts);
    }

    function ellipseRing(dx, dy, rx, ry, sides, rotRad, reverse) {
      var n = sides || 16;
      var rot = rotRad || 0;
      var cosR = Math.cos(rot);
      var sinR = Math.sin(rot);
      var ring = [];
      for (var i = 0; i < n; i++) {
        var idx = reverse ? (n - i) % n : i;
        var a = (idx / n) * Math.PI * 2 + Math.PI / n;
        var lx = Math.cos(a) * rx;
        var ly = Math.sin(a) * ry;
        ring.push(pt(dx + lx * cosR - ly * sinR, dy + lx * sinR + ly * cosR));
      }
      ring.push([ring[0][0], ring[0][1]]);
      return ring;
    }

    function ellipsePoly(dx, dy, rx, ry, sides, rotRad) {
      return [ellipseRing(dx, dy, rx, ry, sides, rotRad, false)];
    }

    function hollowEllipsePoly(dx, dy, rxOut, ryOut, rxIn, ryIn, sides) {
      return [
        ellipseRing(dx, dy, rxOut, ryOut, sides || 16, 0, false),
        ellipseRing(dx, dy, rxIn, ryIn, sides || 16, 0, true)
      ];
    }

    function arcBandPoly(dx, dy, rxIn, ryIn, rxOut, ryOut, a0, a1, steps) {
      var n = steps || 14;
      var outer = [];
      var inner = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        var a = a0 + (a1 - a0) * t;
        outer.push(pt(dx + Math.cos(a) * rxOut, dy + Math.sin(a) * ryOut));
        inner.push(pt(dx + Math.cos(a) * rxIn, dy + Math.sin(a) * ryIn));
      }
      inner.reverse();
      var ring = outer.concat(inner);
      ring.push([ring[0][0], ring[0][1]]);
      return [ring];
    }

    function lineCoords(pairs) {
      return pairs.map(function (p) { return pt(p[0], p[1]); });
    }

    /* =========================================================================
       EXPANSIVE 3.2KM ZONE CITY SECTORS (~2.1x WIDER BREATHING ARCHIPELAGO)
       ========================================================================= */
    var SECTORS = [
      {
        id: "sector-core",
        minLevel: 1,
        color: "#39e7a3",
        anchor: pt(0.0000, 0.0000),
        gatePos: pt(0.0000, 0.0033),
        bounds: [-0.0048, -0.0034, 0.0048, 0.0034],
        name: { en: "Central Starter Turf", ar: "القطاع المركزي الأساسي" },
        desc: { en: "Downtown heritage core, Safehouse, Ironworks Gym, Hospital, Missions & Charter Heliport.", ar: "قلب المدينة، المخبأ، النادي، المستشفى، المهمات، ومهبط الطيران." },
        unlocks: { en: ["Safehouse & Armory", "Ironworks Gym & Back Alley", "Charter Flight Terminal (World Cities)"], ar: ["المخبأ ومخزن السلاح", "النادي الرياضي والأزقة", "محطة رحلات مدن العالم"] }
      },
      {
        id: "sector-neon",
        minLevel: 3,
        color: "#c084fc",
        anchor: pt(-0.0122, 0.0018),
        gatePos: pt(-0.0086, 0.0032),
        bounds: [-0.0175, -0.0038, -0.0068, 0.0072],
        name: { en: "West Neon & Riviera Peninsula", ar: "شبه جزيرة النيون والريفييرا" },
        desc: { en: "Across Riviera Arch Bridge: Grand Velvet Palace Casino, Mirage Lounge, Fight Pit & Biotech University.", ar: "عبر جسر الريفييرا: قصر كازينو المخمل، نادي السراب، حلبة القتال والجامعة." },
        unlocks: { en: ["Grand Velvet Palace Casino & Mirage Lounge", "Bloodsport Fight Pit & Pro Boxing", "Biotech University Quad & Riviera Cove"], ar: ["قصر كازينو المخمل ونادي السراب", "حلبة القتال السرية والملاكمة", "حرم جامعة التقنية الحيوية وكورنيش الريفييرا"] }
      },
      {
        id: "sector-harbor",
        minLevel: 5,
        color: "#f97316",
        anchor: pt(-0.0086, -0.0080),
        gatePos: pt(-0.0088, -0.0062),
        bounds: [-0.0175, -0.0122, 0.0018, -0.0048],
        northBounds: [-0.0065, 0.0052, 0.0068, 0.0128],
        name: { en: "Deepwater Port & Coliseum Park", ar: "الميناء العميق وحديقة الكولوسيوم" },
        desc: { en: "Jutting container piers, Harbor Lighthouse, Chop Shop, North Coliseum Arena & Nitro Motor Speedway.", ar: "أرصفة الحاويات العميقة، منارة الميناء، ورشة التعديل، استاد الكولوسيوم وحلبة السباق." },
        unlocks: { en: ["Deepwater Shipping Piers & Smuggler Cove", "Zone Coliseum Stadium & Nitro Speedway", "Redline Chop Shop & Harbor Lighthouse"], ar: ["أرصفة الشحن العميقة ومرسى المهربين", "استاد الكولوسيوم وحلبة نيترو", "ورشة التعديل ومنارة الميناء"] }
      },
      {
        id: "sector-citadel",
        minLevel: 10,
        color: "#eab308",
        anchor: pt(0.0128, 0.0028),
        gatePos: pt(0.0094, 0.0038),
        bounds: [0.0072, -0.0028, 0.0185, 0.0085],
        name: { en: "East Sovereign Financial Island", ar: "جزيرة القلعة المالية السيادية" },
        desc: { en: "Island skyscraper hub across Al-Noor Suspension Bridge: 310m Pinnacle, Crescent Spires & Federal Court.", ar: "جزيرة الأبراج عبر جسر النور المعلق: برج السيادة، البرجان التوأم والمحكمة الفيدرالية." },
        unlocks: { en: ["310m Sovereign Pinnacle & Crescent Spires", "Zero-Knowledge Crypto Vault & Diamond Bourse", "Federal High Courthouse & Waterfront Corniche"], ar: ["برج السيادة 310م والبرجان الهلاليان", "خزنة الكريبتو وبورصة الألماس", "المحكمة الفيدرالية وكورنيش الجزيرة"] }
      },
      {
        id: "sector-airport",
        minLevel: 15,
        color: "#38bdf8",
        anchor: pt(0.0124, -0.0084),
        gatePos: pt(0.0114, -0.0064),
        bounds: [0.0045, -0.0128, 0.0195, -0.0042],
        name: { en: "Airport Peninsula & Emerald Marina", ar: "شبه جزيرة المطار ومرسى اليخوت" },
        desc: { en: "Dual-runway International Airport, Flared ATC Tower, Crescent Superyacht Marina & Waterfront Villas.", ar: "مطار دولي بمدرجين، برج مراقبة، مرسى اليخوت الزمردي وفيلات الواجهة البحرية." },
        unlocks: { en: ["Dual-Runway Zone Int'l Terminal", "Crescent Superyacht Marina & Yacht Club", "Waterfront Luxury Villas & Diplomatic Hangar"], ar: ["صالة مطار الزون الدولي والمدرجان", "مرسى اليخوت الزمردي ونادي اليخوت", "فيلات الواجهة البحرية وحظيرة الطائرات"] }
      }
    ];

    var METRO_POIS = [
      /* Core Sector Lv.1 - Spaciously framing Central Starter Turf */
      { id: "charter_heli", sector: "sector-core", minLevel: 1, icon: "heliport", color: "#38bdf8", dx: 0.0034, dy: 0.0024, screen: "__world_travel__", name: { en: "World Charter Heliport", ar: "مهبط رحلات العالم" }, cat: { en: "Global Transit", ar: "السفر العالمي" } },
      { id: "metro_central", sector: "sector-core", minLevel: 1, icon: "subway", color: "#38bdf8", dx: -0.0031, dy: -0.0004, screen: "city", name: { en: "Central Metro Hub", ar: "محطة المترو المركزية" }, cat: { en: "Transit", ar: "المواصلات" } },
      { id: "pawn_central", sector: "sector-core", minLevel: 1, icon: "pawnshop", color: "#ebb858", dx: 0.0021, dy: -0.0021, screen: "market", name: { en: "Gold & Pawn Brokers", ar: "متجر الرهن والذهب" }, cat: { en: "Trade", ar: "التجارة" } },
      { id: "street_pharmacy", sector: "sector-core", minLevel: 1, icon: "pharmacy", color: "#fb7185", dx: -0.0014, dy: 0.0020, screen: "items", name: { en: "Night Owl Med-Supply", ar: "صيدلية الإمداد الليلي" }, cat: { en: "Medical", ar: "إمدادات طبية" } },
      { id: "precinct_one", sector: "sector-core", minLevel: 1, icon: "police", color: "#f87171", dx: 0.0037, dy: -0.0010, screen: "jail", name: { en: "Central Police Precinct", ar: "مديرية الشرطة المركزية" }, cat: { en: "Law & Custody", ar: "الأمن والاحتجاز" } },
      { id: "gun_armory", sector: "sector-core", minLevel: 1, icon: "chopshop", color: "#f59e0b", dx: -0.0036, dy: -0.0022, screen: "items", name: { en: "Big Al's Tactical Armory", ar: "ترسانة السلاح التكتيكي" }, cat: { en: "Armory", ar: "التسليح" } },

      /* Sector 2: West Neon & Riviera Peninsula (Lv.3) */
      { id: "velvet_vip", sector: "sector-neon", minLevel: 3, icon: "velvet", color: "#ebb858", dx: -0.0102, dy: 0.0008, screen: "casino", name: { en: "Grand Velvet Palace Casino", ar: "قصر كازينو المخمل" }, cat: { en: "High Stakes", ar: "رهانات كبرى" } },
      { id: "neon_mirage", sector: "sector-neon", minLevel: 3, icon: "nightclub", color: "#e879f9", dx: -0.0132, dy: 0.0024, screen: "casino", name: { en: "Club Mirage Lounge", ar: "نادي السراب الليلي" }, cat: { en: "Nightlife", ar: "الحياة الليلية" } },
      { id: "pit_fightclub", sector: "sector-neon", minLevel: 3, icon: "fightclub", color: "#ef4444", dx: -0.0150, dy: -0.0014, screen: "attack", name: { en: "Bloodsport Fight Pit", ar: "حلبة القتال السرية" }, cat: { en: "Combat Pit", ar: "قتال الشوارع" } },
      { id: "cyber_arcade", sector: "sector-neon", minLevel: 3, icon: "arcade", color: "#39e7a3", dx: -0.0092, dy: 0.0052, screen: "home", name: { en: "Neon Pulse Arcade", ar: "صالة أركيد النيون" }, cat: { en: "Instant Games", ar: "ألعاب فورية" } },
      { id: "noir_cinema", sector: "sector-neon", minLevel: 3, icon: "cinema", color: "#c084fc", dx: -0.0114, dy: -0.0024, screen: "newspaper", name: { en: "Grand Noir Theater", ar: "مسرح وسينما نوار" }, cat: { en: "Entertainment", ar: "ترفيه" } },
      { id: "pro_boxing", sector: "sector-neon", minLevel: 3, icon: "boxinggym", color: "#38bdf8", dx: -0.0158, dy: 0.0016, screen: "gym", name: { en: "Kronk Championship Gym", ar: "نادي أبطال الملاكمة" }, cat: { en: "Training", ar: "تدريب القوة" } },
      { id: "biotech_uni", sector: "sector-neon", minLevel: 3, icon: "university", color: "#60a5fa", dx: -0.0144, dy: 0.0052, screen: "education", name: { en: "Zone Biotech University", ar: "جامعة الزون للتقنية الحيوية" }, cat: { en: "Academy", ar: "التعليم الأكاديمي" } },

      /* Sector 3: North Coliseum Park & SW Deepwater Port (Lv.5) */
      { id: "nitro_speedway", sector: "sector-harbor", minLevel: 5, icon: "racetrack", color: "#f97316", dx: -0.0026, dy: 0.0092, screen: "home", name: { en: "Nitro Motor Speedway", ar: "حلبة نيترو لسباقات السرعة" }, cat: { en: "Street Racing", ar: "سباقات الشوارع" } },
      { id: "grand_stadium", sector: "sector-harbor", minLevel: 5, icon: "stadium", color: "#eab308", dx: 0.0032, dy: 0.0088, screen: "hof", name: { en: "Zone Coliseum Arena", ar: "استاد الكولوسيوم الكبير" }, cat: { en: "Championships", ar: "البطولات" } },
      { id: "pirate_radio", sector: "sector-harbor", minLevel: 5, icon: "radio", color: "#38bdf8", dx: -0.0056, dy: 0.0072, screen: "newspaper", name: { en: "Signal Syndicate Tower", ar: "برج إذاعة النقابة" }, cat: { en: "Intel", ar: "استخبارات" } },
      { id: "custom_chopshop", sector: "sector-harbor", minLevel: 5, icon: "chopshop", color: "#fb923c", dx: -0.0146, dy: -0.0064, screen: "crimes", name: { en: "Redline Chop Shop", ar: "ورشة تفكيك وتعديل السيارات" }, cat: { en: "Black Market", ar: "سوق سوداء" } },
      { id: "container_docks", sector: "sector-harbor", minLevel: 5, icon: "docks", color: "#38bdf8", dx: -0.0102, dy: -0.0092, screen: "crimes", name: { en: "Deepwater Container Port", ar: "ميناء الحاويات العميقة" }, cat: { en: "Cargo Heists", ar: "عمليات الميناء" } },
      { id: "smuggler_berth", sector: "sector-harbor", minLevel: 5, icon: "smuggler", color: "#f43f5e", dx: -0.0046, dy: -0.0096, screen: "market", name: { en: "Smuggler's Cove Pier 9", ar: "رصيف المهربين رقم 9" }, cat: { en: "Contraband", ar: "تهريب البضائع" } },
      { id: "harbor_trauma", sector: "sector-harbor", minLevel: 5, icon: "clinic", color: "#ef4444", dx: -0.0010, dy: -0.0064, screen: "hospital", name: { en: "Back-Alley Trauma Dock", ar: "عيادة جراحة الميناء" }, cat: { en: "Underground Med", ar: "طب سري" } },

      /* Sector 4: East Sovereign Financial Island (Lv.10) */
      { id: "sovereign_exchange", sector: "sector-citadel", minLevel: 10, icon: "exchange", color: "#eab308", dx: 0.0104, dy: 0.0018, screen: "bank", name: { en: "Sovereign Crescent Bourse", ar: "بورصة الهلال السيادية" }, cat: { en: "High Finance", ar: "المال والأعمال" } },
      { id: "crypto_vault", sector: "sector-citadel", minLevel: 10, icon: "crypto", color: "#39e7a3", dx: 0.0156, dy: 0.0046, screen: "bank", name: { en: "Zero-Knowledge Crypto Vault", ar: "خزنة العملات المشفرة" }, cat: { en: "Dark Pool", ar: "خزائن رقمية" } },
      { id: "diamond_bourse", sector: "sector-citadel", minLevel: 10, icon: "jeweler", color: "#67e8f9", dx: 0.0106, dy: -0.0012, screen: "market", name: { en: "Imperial Diamond Exchange", ar: "بورصة الألماس الإمبراطورية" }, cat: { en: "Luxury Jewels", ar: "مجوهرات فاخرة" } },
      { id: "syndicate_auction", sector: "sector-citadel", minLevel: 10, icon: "auction", color: "#f59e0b", dx: 0.0158, dy: 0.0006, screen: "market", name: { en: "Black-Tie Auction House", ar: "دار مزادات النخبة" }, cat: { en: "Rare Assets", ar: "مقتنيات نادرة" } },
      { id: "supreme_court", sector: "sector-citadel", minLevel: 10, icon: "courthouse", color: "#cbd5e1", dx: 0.0100, dy: 0.0066, screen: "jail", name: { en: "Federal High Courthouse", ar: "المحكمة العليا الفيدرالية" }, cat: { en: "Tribunal", ar: "القضاء" } },
      { id: "corp_citadel", sector: "sector-citadel", minLevel: 10, icon: "corptower", color: "#818cf8", dx: 0.0134, dy: 0.0032, screen: "jobs", name: { en: "Sovereign Pinnacle Tower", ar: "برج السيادة الأعلى" }, cat: { en: "Executive Ops", ar: "إدارة الشركات" } },

      /* Sector 5: Airport Peninsula & Emerald Marina (Lv.15) */
      { id: "intl_airport", sector: "sector-airport", minLevel: 15, icon: "airport", color: "#38bdf8", dx: 0.0138, dy: -0.0076, screen: "__world_travel__", name: { en: "Zone International Airport", ar: "مطار الزون الدولي" }, cat: { en: "Global Flights", ar: "الرحلات الدولية" } },
      { id: "vip_marina", sector: "sector-airport", minLevel: 15, icon: "marina", color: "#39e7a3", dx: 0.0072, dy: -0.0098, screen: "properties", name: { en: "Emerald Superyacht Marina", ar: "مرسى اليخوت الزمردي" }, cat: { en: "VIP Fleet", ar: "أسطول اليخوت" } },
      { id: "island_penthouse", sector: "sector-airport", minLevel: 15, icon: "penthouse", color: "#facc15", dx: 0.0082, dy: -0.0058, screen: "properties", name: { en: "Sovereign Waterfront Villas", ar: "فيلات وبنتهاوس الواجهة" }, cat: { en: "Estates", ar: "عقارات فاخرة" } },
      { id: "exec_jet_pad", sector: "sector-airport", minLevel: 15, icon: "heliport", color: "#f472b6", dx: 0.0172, dy: -0.0062, screen: "__world_travel__", name: { en: "Diplomatic Jet Hangar", ar: "حظيرة الطائرات الدبلوماسية" }, cat: { en: "Private Charter", ar: "طيران خاص" } }
    ];

    function getActiveCity() {
      return WORLD_CITIES.find(function (c) { return c.id === state.activeCityId; }) || WORLD_CITIES[0];
    }

    function getCityDate(city) {
      var now = new Date();
      if (!city || city.tzOffset === null || city.tzOffset === undefined) return now;
      var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      return new Date(utcMs + city.tzOffset * 3600000);
    }

    function phaseFromHour(h) {
      if (h >= 5 && h < 8) return "dawn";
      if (h >= 8 && h < 13) return "day";
      if (h >= 13 && h < 17) return "afternoon";
      if (h >= 17 && h < 20) return "dusk";
      return "night";
    }

    function formatClock(d) {
      var hh = String(d.getHours()).padStart(2, "0");
      var mm = String(d.getMinutes()).padStart(2, "0");
      var ss = String(d.getSeconds()).padStart(2, "0");
      return hh + ":" + mm + ":" + ss;
    }

    function computeDesiredPhase() {
      if (state.timeMode !== "auto" && TIME_PHASES[state.timeMode]) {
        return state.timeMode;
      }
      var city = getActiveCity();
      var d = getCityDate(city);
      var clockPhase = phaseFromHour(d.getHours());
      if (state.dark === false && (clockPhase === "night" || clockPhase === "dusk")) {
        return "day";
      }
      return clockPhase;
    }

    function injectStyles() {
      if (document.getElementById("zone-map-expansion-css")) return;
      var style = document.createElement("style");
      style.id = "zone-map-expansion-css";
      style.textContent = [
        /* Compact floating Chrono HUD: charcoal artist paper (Dark) + warm Sketchbook parchment (Light) */
        ".zmx-chrono-bar{position:absolute;top:8px;right:48px;left:auto;width:fit-content;transform:none;z-index:18;display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:rgba(20,22,28,0.92);border:1px solid rgba(244,236,220,0.16);box-shadow:0 8px 22px rgba(0,0,0,0.46),inset 0 1px 0 rgba(255,255,255,0.06);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f5efe2;font:600 9.5px/1.15 Rubik,system-ui,sans-serif;max-width:calc(100% - 240px);flex-wrap:nowrap;white-space:nowrap;justify-content:flex-end}",
        "[dir='rtl'] .zmx-chrono-bar{right:auto;left:8px;justify-content:flex-start}",
        "body[data-zmx-light='1'] .zmx-chrono-bar{background:rgba(250,244,230,0.94);border:1.5px solid #1e1b18;color:#1e1b18;box-shadow:0 4px 14px rgba(30,27,24,0.14),2px 2px 0 rgba(30,27,24,0.18)}",
        "body[data-zmx-light='1'] .mgrade{background:radial-gradient(ellipse 75% 60% at 50% 35%,rgba(255,248,220,0.14) 0%,rgba(255,248,220,0) 68%)!important}",
        ".zmx-clock-box{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,0.07);border:0;font-variant-numeric:tabular-nums}",
        "body[data-zmx-light='1'] .zmx-clock-box{background:rgba(30,27,24,0.07)}",
        ".zmx-city-tag{font-weight:800;color:#38bdf8;letter-spacing:0.04em;font-size:9.5px}",
        "body[data-zmx-light='1'] .zmx-city-tag{color:#1d4ed8}",
        ".zmx-clock-digits{font-weight:800;font-size:10.5px;color:#49f0a1;letter-spacing:0.02em}",
        "body[data-zmx-light='1'] .zmx-clock-digits{color:#0f766e}",
        ".zmx-phase-badge{display:inline-flex;align-items:center;gap:3px;font-weight:700;font-size:9.5px;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,0.07);color:#f5efe2;border:0}",
        "body[data-zmx-light='1'] .zmx-phase-badge{background:rgba(30,27,24,0.07);color:#1e1b18}",
        ".zmx-sun-rays{transform-origin:12px 12px;transition:transform .24s cubic-bezier(.22,1,.36,1)}",
        ".zmx-phase-badge:hover .zmx-sun-rays{transform:rotate(24deg)}",
        ".zmx-ico-jet{transition:transform .2s cubic-bezier(.22,1,.36,1)}",
        ".zmx-pills{display:inline-flex;align-items:center;gap:1px;padding:1.5px;border-radius:999px;background:rgba(255,255,255,0.05)}",
        "body[data-zmx-light='1'] .zmx-pills{background:rgba(30,27,24,0.07)}",
        ".zmx-pill{background:transparent;border:0;color:#cbd5e1;border-radius:999px;padding:2.5px 6px;font:700 9.5px/1.1 inherit;cursor:pointer;transition:background-color .16s ease,color .16s ease,transform .16s ease}",
        ".zmx-pill:hover{background:rgba(255,255,255,0.10);color:#fff}",
        ".zmx-pill.active{background:linear-gradient(180deg,#38bdf8,#0284c7);color:#04131d;font-weight:800}",
        "body[data-zmx-light='1'] .zmx-pill{color:#3f3a34}",
        "body[data-zmx-light='1'] .zmx-pill:hover{background:rgba(30,27,24,0.10);color:#1e1b18}",
        "body[data-zmx-light='1'] .zmx-pill.active{background:#1e1b18;color:#faf4e6}",
        ".zmx-world-btn{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(180deg,#10b981,#059669);color:#04131d;border:0;border-radius:999px;padding:3px 8px;font:800 9.5px/1.1 inherit;letter-spacing:0.01em;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.26);transition:transform .16s ease,opacity .16s ease}",
        "body[data-zmx-light='1'] .zmx-world-btn{background:#0f766e;color:#faf4e6;border:1px solid #1e1b18;box-shadow:1px 1px 0 rgba(30,27,24,0.22)}",
        ".zmx-world-btn:hover{transform:translateY(-1px)}",
        ".zmx-world-btn:hover .zmx-ico-jet{transform:translate(1.5px,-1.5px) scale(1.08)}",
        ".zmx-lv-pill{display:inline-flex;align-items:center;gap:2px;padding:2px 6px;border-radius:999px;background:rgba(57,231,163,0.15);border:0;color:#6ef7c0;font-weight:800;font-size:9.5px}",
        "body[data-zmx-light='1'] .zmx-lv-pill{background:rgba(15,118,110,0.12);color:#0f766e}",
        /* Compact Sector Gate Markers */
        ".zmx-gate-marker{display:inline-flex;align-items:center;gap:3.5px;padding:2.5px 7px;border-radius:999px;font:700 9px/1.1 Rubik,system-ui,sans-serif;letter-spacing:0.01em;cursor:pointer;box-shadow:0 5px 14px rgba(0,0,0,0.52);border:1px solid rgba(244,236,220,0.20);background:rgba(20,22,28,0.90);backdrop-filter:blur(6px);color:#f5efe2;white-space:nowrap;transition:transform .16s ease,background-color .16s ease}",
        ".zmx-gate-marker:hover{transform:scale(1.05);background:rgba(28,32,42,0.96)}",
        ".zmx-gate-marker.unlocked{border-color:rgba(56,189,248,0.46);color:#bae6fd;background:rgba(12,24,36,0.90)}",
        "body[data-zmx-light='1'] .zmx-gate-marker{background:rgba(250,244,230,0.94);border:1.5px solid #1e1b18;color:#1e1b18;box-shadow:0 3px 10px rgba(30,27,24,0.16),1.5px 1.5px 0 rgba(30,27,24,0.18)}",
        "body[data-zmx-light='1'] .zmx-gate-marker:hover{background:#fffaf0}",
        "body[data-zmx-light='1'] .zmx-gate-marker.unlocked{border-color:#0f766e;color:#0f766e;background:rgba(242,252,248,0.95)}",
        ".zmx-poi-hover{position:absolute;z-index:22;pointer-events:none;padding:4px 9px;border-radius:8px;background:rgba(18,20,26,0.94);border:1px solid rgba(244,236,220,0.18);box-shadow:0 8px 20px rgba(0,0,0,0.56);color:#f5efe2;font:700 10.5px/1.2 Rubik,system-ui,sans-serif;white-space:nowrap;transform:translate(-50%,13px);transition:opacity .12s ease}",
        "body[data-zmx-light='1'] .zmx-poi-hover{background:rgba(250,244,230,0.96);border:1.5px solid #1e1b18;color:#1e1b18;box-shadow:0 4px 12px rgba(30,27,24,0.18)}",
        ".zmx-poi-hover[hidden]{display:none!important}",
        ".zmx-modal-backdrop{position:fixed;inset:0;z-index:60;background:rgba(4,7,14,0.74);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:14px}",
        ".zmx-modal-backdrop[hidden]{display:none!important}",
        ".zmx-modal{width:min(760px,100%);max-height:90vh;overflow:auto;border-radius:16px;background:linear-gradient(180deg,#171a22 0%,#101218 100%);border:1px solid rgba(244,236,220,0.14);box-shadow:0 28px 64px rgba(0,0,0,0.78);color:#f5efe2;padding:18px;font:500 12.5px/1.45 Rubik,system-ui,sans-serif}",
        "body[data-zmx-light='1'] .zmx-modal{background:linear-gradient(180deg,#fbf6ea 0%,#f2e8d4 100%);border:1.5px solid #1e1b18;color:#1e1b18;box-shadow:0 20px 50px rgba(30,27,24,0.28)}",
        ".zmx-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.20)}",
        "body[data-zmx-light='1'] .zmx-modal-head{border-bottom-color:rgba(30,27,24,0.16)}",
        ".zmx-modal-title{margin:2px 0 0;font-size:17px;font-weight:800;letter-spacing:-0.01em}",
        ".zmx-close{background:rgba(255,255,255,0.08);border:0;color:inherit;border-radius:8px;padding:6px 11px;font:700 11px/1 inherit;cursor:pointer}",
        "body[data-zmx-light='1'] .zmx-close{background:rgba(30,27,24,0.08);border:1px solid rgba(30,27,24,0.22)}",
        ".zmx-world-svg{width:100%;height:168px;border-radius:12px;background:radial-gradient(circle at 50% 45%,#13253e 0%,#08111e 85%);border:1px solid rgba(56,189,248,0.22);margin-bottom:12px;display:block}",
        ".zmx-city-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:9px}",
        ".zmx-city-card{border-radius:12px;border:1px solid rgba(255,255,255,0.07);background:rgba(22,26,36,0.82);padding:11px;display:flex;flex-direction:column;gap:6px}",
        "body[data-zmx-light='1'] .zmx-city-card{background:#fffbf2;border:1.5px solid rgba(30,27,24,0.22)}",
        ".zmx-city-card.active{border-color:rgba(57,231,163,0.55);box-shadow:0 0 0 1px rgba(57,231,163,0.25)}",
        "body[data-zmx-light='1'] .zmx-city-card.active{border-color:#0f766e;box-shadow:0 0 0 1px rgba(15,118,110,0.25)}",
        ".zmx-city-card.locked{opacity:0.78}",
        ".zmx-cta{background:linear-gradient(180deg,#10b981,#059669);color:#04131d;border:0;border-radius:8px;padding:7px 11px;font:800 11px/1.1 inherit;cursor:pointer;letter-spacing:0.01em}",
        ".zmx-cta:disabled{opacity:0.45;cursor:not-allowed}",
        ".zmx-cta-sec{background:rgba(56,189,248,0.14);color:#7dd3fc;border:0;border-radius:8px;padding:7px 11px;font:700 11px/1.1 inherit;cursor:pointer}",
        "body[data-zmx-light='1'] .zmx-cta-sec{background:#e0f2fe;color:#075985;border:1px solid rgba(7,89,133,0.24)}",
        ".zmx-svg-ico{display:inline-block;width:12px;height:12px;flex:none;vertical-align:-1.5px}",
        ".zmx-cta,.zmx-cta-sec{display:inline-flex;align-items:center;justify-content:center;gap:5px}",
        ".zmx-chrono-bar>*{flex:none}",
        ".zmx-chrono-bar::-webkit-scrollbar{display:none}",
        /* Harmonize Family Rail & Floating Controls cleanly across Dark charcoal & Light Sketchbook */
        "body:not([data-zmx-light='1']) .familyRail{overflow:hidden!important;border-bottom:1px solid rgba(244,236,220,0.09)!important;background:rgba(18,20,26,0.94)!important}",
        "body[data-zmx-light='1'] .familyRail{overflow:hidden!important;border-bottom:1.5px solid #1e1b18!important;background:rgba(250,244,230,0.96)!important;color:#1e1b18!important}",
        "body[data-zmx-light='1'] .familyRail *{color:#1e1b18}",
        ".familyRail button.familyStat{height:26px!important;min-height:26px!important;padding:2px 9px!important;border-radius:9px!important;border:1px solid rgba(234,179,8,0.42)!important;background:rgba(234,179,8,0.16)!important;display:inline-flex!important;flex-direction:row!important;align-items:baseline!important;justify-content:center!important;gap:5px!important;white-space:nowrap!important;transition:background-color .16s ease,transform .16s ease}",
        ".familyRail button.familyStat:disabled{opacity:0.92!important;border-color:rgba(148,163,184,0.38)!important;background:rgba(30,36,46,0.84)!important}",
        ".familyRail button.familyStat:disabled b{color:#f3d285!important;font-size:13px!important}",
        ".familyRail button.familyStat:disabled span{color:#e2e8f0!important;font-size:10px!important;margin-top:0!important}",
        "body[data-zmx-light='1'] .familyRail button.familyStat{background:#efe5ce!important;border:1.4px solid rgba(46,37,26,0.38)!important;color:#1e1b18!important}",
        "body[data-zmx-light='1'] .familyRail button.familyStat:disabled{opacity:0.94!important;background:#e6dbc2!important;border-color:rgba(46,37,26,0.34)!important}",
        "body[data-zmx-light='1'] .familyRail button.familyStat:disabled b{color:#7c4d12!important}",
        "body[data-zmx-light='1'] .familyRail button.familyStat:disabled span{color:#2e261d!important;font-weight:700!important}",
        ".familyRail button.familyStat:not(:disabled):hover{background:rgba(234,179,8,0.20)!important;border-color:rgba(234,179,8,0.42)!important;transform:translateY(-1px)}",
        "body:not([data-zmx-light='1']) .familyRail .factionSelectLabel select{min-height:28px!important;padding:3px 8px!important;border-radius:8px!important;border:1px solid rgba(244,236,220,0.14)!important;background:rgba(24,27,36,0.90)!important}",
        "body[data-zmx-light='1'] .familyRail .factionSelectLabel select{min-height:28px!important;padding:3px 8px!important;border-radius:8px!important;border:1.5px solid #1e1b18!important;background:#fffbf2!important;color:#1e1b18!important}",
        "body:not([data-zmx-light='1']) .sideToggle,body:not([data-zmx-light='1']) .cityReset,body:not([data-zmx-light='1']) .mapExpand,body:not([data-zmx-light='1']) .streetView{border-radius:9px!important;border:1px solid rgba(244,236,220,0.14)!important;background:rgba(20,22,28,0.88)!important}",
        "@media (prefers-reduced-motion:reduce){.zmx-sun-rays,.zmx-ico-jet,.zmx-pill,.zmx-world-btn,.zmx-gate-marker,.familyRail button.familyStat{transition:none!important}}",
        "[dir='rtl'] .zmx-chrono-bar,[dir='rtl'] .zmx-chrono-bar *,[dir='rtl'] .zmx-gate-marker,.zmx-modal[dir='rtl'],.zmx-modal[dir='rtl'] *{letter-spacing:0!important}",
        "@media (max-width:1120px){.zmx-pills .zmx-pill[data-phase='dawn'],.zmx-pills .zmx-pill[data-phase='dusk']{display:none}}",
        "@media (max-width:780px){.zmx-chrono-bar,[dir='rtl'] .zmx-chrono-bar{top:42px;left:8px;right:44px;width:auto;max-width:calc(100% - 52px);justify-content:flex-start;overflow-x:auto;scrollbar-width:none}}",
        "@media (max-width:680px){",
        "  #sideToggle,#cityReset,#mapExpand,#streetView{top:6px!important;height:27px!important;min-height:27px!important;padding:0 7px!important;font-size:10px!important;border-radius:8px!important}",
        "  #sideToggle{left:8px!important;width:28px!important;padding:0!important}",
        "  #sideToggle b{display:none!important}",
        "  #cityReset{left:40px!important;width:auto!important}",
        "  #mapExpand{left:106px!important;width:27px!important;padding:0!important;font-size:13px!important}",
        "  #streetView{left:137px!important;width:auto!important}",
        "  [dir='rtl'] #sideToggle{left:auto!important;right:8px!important}",
        "  [dir='rtl'] #cityReset{left:auto!important;right:40px!important}",
        "  [dir='rtl'] #mapExpand{left:auto!important;right:106px!important}",
        "  [dir='rtl'] #streetView{left:auto!important;right:137px!important}",
        "  .mapboxgl-ctrl-top-right .mapboxgl-ctrl{margin:6px 6px 0 0!important}",
        "  [dir='rtl'] .mapboxgl-ctrl-top-right .mapboxgl-ctrl{margin:6px 0 0 6px!important}",
        "  .mapboxgl-ctrl-group button,.mapboxgl-ctrl-group button:disabled{width:29px!important;height:29px!important}",
        "  .zmx-chrono-bar{top:39px!important;left:8px!important;right:42px!important;transform:none!important;width:auto!important;max-width:calc(100% - 50px)!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;padding:3px 7px!important;gap:4px!important;font-size:9.5px!important;justify-content:flex-start!important}",
        "  [dir='rtl'] .zmx-chrono-bar{right:8px!important;left:42px!important;justify-content:flex-start!important}",
        "  #panel,[dir='rtl'] #panel{top:auto!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:48%!important;overflow-y:auto!important;border-radius:14px 14px 0 0!important;border-left:0!important;border-right:0!important;border-top:1px solid rgba(255,255,255,0.14)!important;z-index:30!important;padding:10px 12px 12px!important;box-shadow:0 -12px 32px rgba(0,0,0,0.72)!important;transform:translate3d(0,105%,0)!important;pointer-events:none!important}",
        "  #panel.on,[dir='rtl'] #panel.on{transform:translate3d(0,0,0)!important;pointer-events:auto!important}",
        "  #panel .x{height:30px!important;min-height:30px!important;min-width:56px!important;top:8px!important;font-size:11px!important;padding:0 8px!important}",
        "  #panel h2{font-size:14.5px!important;margin-bottom:2px!important;padding-inline-end:64px!important}",
        "  #panel .pcat{font-size:9.5px!important;margin-bottom:4px!important}",
        "  #panel .pmeta{flex:none!important;overflow:visible!important;margin-bottom:6px!important;font-size:11px!important}",
        "  #panel .pActions button{min-height:34px!important;padding:6px 10px!important;font-size:11px!important}",
        "  .mapLegend,.legend{bottom:6px!important;inset-inline-end:6px!important;font-size:9.5px!important;padding:3px 7px!important;gap:6px!important;border-radius:8px!important;max-width:calc(100% - 88px)!important}",
        "  .familyHome,#familyHome{bottom:6px!important;inset-inline-start:6px!important;min-height:26px!important;height:26px!important;padding:0 8px!important;font-size:9.5px!important;border-radius:8px!important}",
        "  .detailsOpen .mapLegend,.detailsOpen .legend,.detailsOpen #familyHome{visibility:hidden!important}",
        "  .zmx-modal{padding:12px!important;border-radius:14px!important;max-height:86vh!important}",
        "  .zmx-world-svg{height:112px!important}",
        "  .zmx-city-grid{grid-template-columns:1fr!important}",
        "}"
      ].join("\n");
      document.head.appendChild(style);
    }

    var chronoEl = null;
    var modalBackdrop = null;
    var hoverTipEl = null;

    function buildChronoHud() {
      if (chronoEl) return;
      var host = document.querySelector(".mapcol") || document.body;
      chronoEl = document.createElement("div");
      chronoEl.className = "zmx-chrono-bar";
      chronoEl.id = "zoneMapChronoHud";
      host.appendChild(chronoEl);

      hoverTipEl = document.createElement("div");
      hoverTipEl.className = "zmx-poi-hover";
      hoverTipEl.hidden = true;
      host.appendChild(hoverTipEl);

      modalBackdrop = document.createElement("div");
      modalBackdrop.className = "zmx-modal-backdrop";
      modalBackdrop.hidden = true;
      modalBackdrop.addEventListener("click", function (ev) {
        if (ev.target === modalBackdrop && !state.transitBusy) {
          modalBackdrop.hidden = true;
        }
      });
      document.body.appendChild(modalBackdrop);

      var resetBtn = document.getElementById("cityReset");
      if (resetBtn && !resetBtn.dataset.zmxBound) {
        resetBtn.dataset.zmxBound = "1";
        resetBtn.addEventListener("click", function () {
          setTimeout(function () {
            widenMetroBounds();
            try {
              var container = map.getContainer && map.getContainer();
              var mobile = !!(container && container.clientWidth <= 760);
              map.easeTo({
                center: CENTER,
                zoom: mobile ? 13.05 : 13.55,
                pitch: 52,
                bearing: -22,
                duration: 320,
                essential: true
              });
            } catch (_) {}
          }, 40);
        });
      }

      renderChronoHud();
    }

    function renderChronoHud() {
      if (!chronoEl) return;
      var ar = state.lang === "ar";
      var city = getActiveCity();
      var cityDate = getCityDate(city);
      var phaseKey = computeDesiredPhase();
      var phaseObj = TIME_PHASES[phaseKey] || TIME_PHASES.day;

      chronoEl.innerHTML =
        '<span class="zmx-clock-box" title="' + (ar ? "توقيت المدينة المباشر" : "Live City Clock") + '">' +
          '<span class="zmx-city-tag">' + city.code + '</span>' +
          '<bdi class="zmx-clock-digits" id="zmxClockText">' + formatClock(cityDate) + '</bdi>' +
        '</span>' +
        '<span class="zmx-phase-badge" id="zmxPhaseBadge">' +
          '<span>' + phaseObj.icon + '</span>' +
          '<span id="zmxPhaseLabel">' + phaseObj.label[ar ? "ar" : "en"] + '</span>' +
        '</span>' +
        '<span class="zmx-lv-pill" title="' + (ar ? "مستواك الحالي لفتح قطاعات الخريطة" : "Your level for unlocking map sectors") + '">' +
          (ar ? "م." : "LV.") + state.playerLevel +
        '</span>' +
        '<div class="zmx-pills" role="group" aria-label="' + (ar ? "الوقت والإضاءة" : "Map time of day") + '">' +
          [
            ["auto", ar ? "تلقائي" : "Auto"],
            ["day", ar ? "نهار" : "Day"],
            ["afternoon", ar ? "عصر" : "Afternoon"],
            ["dusk", ar ? "غسق" : "Dusk"],
            ["night", ar ? "ليل" : "Night"]
          ].map(function (pair) {
            var active = state.timeMode === pair[0] ? " active" : "";
            return '<button type="button" class="zmx-pill' + active + '" data-phase="' + pair[0] + '">' + pair[1] + '</button>';
          }).join("") +
        '</div>' +
        '<button type="button" class="zmx-world-btn" id="zmxWorldBtn">' +
          ZMX_SVGS.plane + '<span>' + (ar ? "مدن العالم" : "World Cities") + '</span>' +
        '</button>';

      Array.from(chronoEl.querySelectorAll(".zmx-pill")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.timeMode = btn.getAttribute("data-phase") || "auto";
          try { sessionStorage.setItem("zone_map_time_mode", state.timeMode); } catch (_) {}
          applyAtmosphere(true);
          renderChronoHud();
        });
      });

      var worldBtn = chronoEl.querySelector("#zmxWorldBtn");
      if (worldBtn) {
        worldBtn.addEventListener("click", function () {
          openWorldCitiesModal();
        });
      }
    }

    function tickClock() {
      if (document.hidden || state.hostPaused) return;
      var city = getActiveCity();
      var d = getCityDate(city);
      var nextClock = formatClock(d);
      var clockNode = document.getElementById("zmxClockText");
      if (clockNode) {
        if (clockNode.firstChild && clockNode.firstChild.nodeType === 3) {
          if (clockNode.firstChild.nodeValue !== nextClock) {
            clockNode.firstChild.nodeValue = nextClock;
          }
        } else {
          clockNode.textContent = nextClock;
        }
      }
      var desired = computeDesiredPhase();
      if (desired !== state.activePhase) {
        applyAtmosphere(true);
        renderChronoHud();
      }
    }

    function parseHexRgb(hex) {
      var raw = String(hex || "#38bdf8").replace("#", "").trim();
      if (raw.length === 3) raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
      var num = parseInt(raw, 16);
      if (!Number.isFinite(num)) return [56, 189, 248];
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    function mixRgbCss(rgbA, rgbB, weightB) {
      var wA = 1 - weightB;
      return "rgb(" +
        Math.round(rgbA[0] * wA + rgbB[0] * weightB) + "," +
        Math.round(rgbA[1] * wA + rgbB[1] * weightB) + "," +
        Math.round(rgbA[2] * wA + rgbB[2] * weightB) + ")";
    }

    function ensureMetroCoinImage(poi, locked) {
      var imgId = "zmx-coin-" + poi.id + (locked ? "-lock" : "-open");
      if (!map || !map.hasImage || map.hasImage(imgId)) return imgId;
      try {
        var canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        var c = canvas.getContext("2d");
        c.clearRect(0, 0, 64, 64);

        c.save();
        c.scale(64 / 24, 64 / 24);

        var baseRgb = parseHexRgb(poi.color || "#38bdf8");
        var topStop = locked ? mixRgbCss(baseRgb, [148, 163, 184], 0.36) : mixRgbCss(baseRgb, [255, 255, 255], 0.3);
        var midStop = locked ? mixRgbCss(baseRgb, [30, 41, 59], 0.38) : mixRgbCss(baseRgb, [15, 23, 42], 0.12);
        var deepStop = locked ? mixRgbCss(baseRgb, [8, 13, 24], 0.68) : mixRgbCss(baseRgb, [6, 10, 20], 0.52);

        var grad = c.createRadialGradient(10.5, 8.2, 1.2, 12, 12, 11.2);
        grad.addColorStop(0, topStop);
        grad.addColorStop(0.56, midStop);
        grad.addColorStop(1, deepStop);
        c.beginPath();
        c.arc(12, 12, 10.5, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();

        c.beginPath();
        c.arc(12, 12, 8.1, 0, Math.PI * 2);
        c.fillStyle = locked ? "rgba(8, 13, 24, 0.34)" : "rgba(6, 10, 20, 0.24)";
        c.fill();

        if (!locked) {
          c.beginPath();
          c.arc(12, 12, 11.25, 0, Math.PI * 2);
          c.strokeStyle = "rgba(56, 189, 248, 0.55)";
          c.lineWidth = 1.1;
          c.stroke();
        }
        c.beginPath();
        c.arc(12, 12, 10.45, 0, Math.PI * 2);
        c.strokeStyle = locked ? "rgba(226, 232, 240, 0.42)" : "rgba(255, 255, 255, 0.82)";
        c.lineWidth = 1.55;
        c.stroke();

        c.save();
        c.shadowColor = "rgba(4, 8, 16, 0.58)";
        c.shadowBlur = 2.2;
        c.strokeStyle = locked ? "rgba(248, 250, 252, 0.86)" : "#ffffff";
        c.lineWidth = 2.25;
        c.lineCap = "round";
        c.lineJoin = "round";
        var pathStr = ICON_PATHS[poi.icon] || EXTRA_ICONS[poi.icon] || ICON_PATHS.missions || "";
        if (pathStr) c.stroke(new Path2D(pathStr));
        c.restore();

        if (locked) {
          c.beginPath();
          c.arc(18.6, 5.4, 3.8, 0, Math.PI * 2);
          c.fillStyle = "#0f172a";
          c.fill();
          c.strokeStyle = "rgba(226, 232, 240, 0.62)";
          c.lineWidth = 1.05;
          c.stroke();

          c.beginPath();
          c.rect(17.1, 5.3, 3.0, 2.2);
          c.fillStyle = "#e2e8f0";
          c.fill();
          c.beginPath();
          c.arc(18.6, 5.2, 1.0, Math.PI, 0);
          c.strokeStyle = "#e2e8f0";
          c.lineWidth = 0.9;
          c.stroke();
        }

        c.restore();
        map.addImage(imgId, c.getImageData(0, 0, 64, 64), { pixelRatio: 2, sdf: false });
      } catch (_) {}
      return imgId;
    }

    /* =========================================================================
       BREATHING, SCULPTED UNIQUE ARCHITECTURE + 3 REAL 3D BRIDGES
       ========================================================================= */
    function buildOuterSkylineGeo() {
      var features = [];
      var facadeFeatures = [];
      var idSeq = 1;

      function polyRing(dx, dy, w, h) {
        return rectPoly(dx - w / 2, dy - h / 2, dx + w / 2, dy + h / 2);
      }

      function pushPoly(coords, minZ, maxZ, tone, districtTag, accentColor, withFacade) {
        var fid = 9000 + (idSeq++);
        var pid = "outer-" + (districtTag || "metro") + "-" + fid;
        var feat = {
          type: "Feature",
          id: fid,
          properties: {
            providerId: pid,
            providerTile: "outer/" + (districtTag || "metro"),
            district: districtTag || "metro",
            extrude: "true",
            height: maxZ,
            min_height: minZ || 0,
            tone: tone !== undefined ? tone : 1,
            accent: accentColor || ""
          },
          geometry: { type: "Polygon", coordinates: coords }
        };
        features.push(feat);
        if (withFacade !== false) facadeFeatures.push(feat);
      }

      function pushBox(dx, dy, w, h, minZ, maxZ, tone, districtTag, accentColor, withFacade) {
        pushPoly(polyRing(dx, dy, w, h), minZ, maxZ, tone, districtTag, accentColor, withFacade);
      }

      function pushOct(dx, dy, rx, ry, minZ, maxZ, tone, districtTag, accentColor, sides, withFacade) {
        pushPoly(ellipsePoly(dx, dy, rx, ry, sides || 8, 0), minZ, maxZ, tone, districtTag, accentColor, withFacade);
      }

      /* Sculpted multi-tier architectural building generator (never a bare single cube) */
      function pushSculptedBlock(dx, dy, w, h, totalH, seed, districtTag) {
        var style = Math.abs(seed) % 6;
        var podH = Math.max(10, Math.round(totalH * 0.26));
        if (style === 0) {
          /* Art-Deco 3-tier setback skyscraper + crown */
          pushBox(dx, dy, w, h, 0, podH, 0, districtTag);
          pushBox(dx, dy, w * 0.76, h * 0.76, podH, Math.round(totalH * 0.84), 1, districtTag);
          pushBox(dx, dy, w * 0.46, h * 0.46, Math.round(totalH * 0.84), totalH, 2, districtTag);
          if (totalH >= 90) pushOct(dx, dy, w * 0.12, h * 0.12, totalH, totalH + 16, 2, districtTag, "#dba83b", 8, false);
        } else if (style === 1) {
          /* L-shaped courtyard podium + offset slender high-rise */
          pushBox(dx, dy - h * 0.18, w, h * 0.58, 0, podH, 0, districtTag);
          pushBox(dx - w * 0.22, dy + h * 0.18, w * 0.54, h * 0.54, 0, Math.round(totalH * 0.60), 1, districtTag);
          pushBox(dx + w * 0.18, dy - h * 0.10, w * 0.48, h * 0.50, podH, totalH, 2, districtTag);
        } else if (style === 2) {
          /* Twin courtyard wings + elevated sky-gallery */
          pushBox(dx - w * 0.28, dy, w * 0.38, h * 0.90, 0, Math.round(totalH * 0.86), 1, districtTag);
          pushBox(dx + w * 0.28, dy, w * 0.38, h * 0.90, 0, totalH, 2, districtTag);
          pushBox(dx, dy, w * 0.36, h * 0.28, Math.round(totalH * 0.48), Math.round(totalH * 0.60), 0, districtTag, "#dba83b", false);
        } else if (style === 3) {
          /* Tapered octagonal glass tower on colonnade plinth */
          pushBox(dx, dy, w * 0.94, h * 0.94, 0, podH, 0, districtTag);
          pushOct(dx, dy, w * 0.40, h * 0.40, podH, Math.round(totalH * 0.86), 1, districtTag, "", 8);
          pushOct(dx, dy, w * 0.24, h * 0.24, Math.round(totalH * 0.86), totalH + 8, 2, districtTag, "", 8, false);
        } else if (style === 4) {
          /* Terraced Mediterranean / Coastal slab with recessed sky-garden penthouse */
          pushBox(dx, dy, w, h * 0.90, 0, Math.round(totalH * 0.52), 0, districtTag);
          pushBox(dx, dy + h * 0.08, w * 0.70, h * 0.62, Math.round(totalH * 0.52), Math.round(totalH * 0.88), 1, districtTag);
          pushBox(dx - w * 0.08, dy + h * 0.08, w * 0.34, h * 0.34, Math.round(totalH * 0.88), totalH, 2, districtTag);
        } else {
          /* Stepped U-shaped avenue palazzo with corner tower */
          pushBox(dx, dy - h * 0.28, w, h * 0.36, 0, Math.round(totalH * 0.45), 0, districtTag);
          pushBox(dx - w * 0.32, dy + h * 0.08, w * 0.34, h * 0.72, 0, Math.round(totalH * 0.58), 1, districtTag);
          pushBox(dx + w * 0.26, dy + h * 0.06, w * 0.42, h * 0.48, 0, totalH, 2, districtTag);
        }
      }

      /* =====================================================================
         1. THREE REAL 3D BRIDGES + CENTRAL MONUMENT ROUNDABOUT OBELISK
         ===================================================================== */

      /* Bridge A: Al-Noor Suspension Bridge (Core 0.0046 -> Financial Island 0.0074 at dy=0.0004) */
      pushBox(0.0060, 0.0004, 0.0031, 0.00042, 11, 14, 0, "citadel", "#4b5563", false);
      pushBox(0.0060, 0.00063, 0.0031, 0.00005, 13.5, 15.6, 2, "citadel", "#f2c96b", false);
      pushBox(0.0060, 0.00017, 0.0031, 0.00005, 13.5, 15.6, 2, "citadel", "#f2c96b", false);
      /* Bridge A Twin Suspension Pylons (0..64m) + Crossbeams */
      [0.00535, 0.00665].forEach(function (px) {
        pushBox(px, 0.00068, 0.00012, 0.00011, 0, 64, 2, "citadel", "#e5dcc8", false);
        pushBox(px, 0.00012, 0.00012, 0.00011, 0, 64, 2, "citadel", "#e5dcc8", false);
        pushBox(px, 0.00040, 0.00010, 0.00062, 34, 38, 2, "citadel", "#dba83b", false);
        pushBox(px, 0.00040, 0.00010, 0.00062, 56, 60, 2, "citadel", "#dba83b", false);
      });
      /* Bridge A Illuminated Suspension Cables (catenary steps between pylons & approaches) */
      [
        [0.00495, 22], [0.00515, 38], [0.00560, 44], [0.00580, 28],
        [0.00600, 22], [0.00620, 28], [0.00640, 44], [0.00685, 38], [0.00705, 22]
      ].forEach(function (seg) {
        pushBox(seg[0], 0.00065, 0.00022, 0.00004, seg[1], seg[1] + 2.4, 2, "citadel", "#fde68a", false);
        pushBox(seg[0], 0.00015, 0.00022, 0.00004, seg[1], seg[1] + 2.4, 2, "citadel", "#fde68a", false);
      });

      /* Bridge B: Riviera Arch Bridge (Core -0.0046 -> West Neon -0.0070 at dy=0.0004) */
      pushBox(-0.0058, 0.0004, 0.0027, 0.00040, 11, 14, 0, "neon", "#4b5563", false);
      pushBox(-0.0058, 0.00062, 0.0027, 0.00005, 13.5, 15.4, 2, "neon", "#d8b4fe", false);
      pushBox(-0.0058, 0.00018, 0.0027, 0.00005, 13.5, 15.4, 2, "neon", "#d8b4fe", false);
      /* Bridge B Stone Abutments & Twin Sculpted Arch Ribs (peaking at 48m) */
      [-0.00475, -0.00685].forEach(function (ax) {
        pushBox(ax, 0.0004, 0.00024, 0.00058, 0, 24, 1, "neon", "#d9cdb8", false);
      });
      [
        [-0.00655, 22], [-0.00630, 34], [-0.00605, 43], [-0.00580, 47],
        [-0.00555, 43], [-0.00530, 34], [-0.00505, 22]
      ].forEach(function (arch) {
        pushBox(arch[0], 0.00062, 0.00027, 0.00006, arch[1], arch[1] + 3.5, 2, "neon", "#e9d5ff", false);
        pushBox(arch[0], 0.00018, 0.00027, 0.00006, arch[1], arch[1] + 3.5, 2, "neon", "#e9d5ff", false);
      });
      pushBox(-0.00580, 0.00040, 0.00012, 0.00048, 45, 48, 2, "neon", "#dba83b", false);

      /* Bridge C: Airport Causeway Bridge (Citadel dy=-0.0026 -> Airport Island dy=-0.0045 at dx=0.0126) */
      pushBox(0.0126, -0.00355, 0.00046, 0.0023, 11, 14, 0, "airport", "#4b5563", false);
      pushBox(0.01235, -0.00355, 0.00005, 0.0023, 13.5, 15.5, 2, "airport", "#7dd3fc", false);
      pushBox(0.01285, -0.00355, 0.00005, 0.0023, 13.5, 15.5, 2, "airport", "#7dd3fc", false);
      /* Bridge C Cable-Stayed Pylons (0..56m) + Diagonal Cable Trim */
      [-0.00315, -0.00395].forEach(function (py) {
        pushBox(0.01233, py, 0.00011, 0.00012, 0, 56, 2, "airport", "#f1f5f9", false);
        pushBox(0.01287, py, 0.00011, 0.00012, 0, 56, 2, "airport", "#f1f5f9", false);
        pushBox(0.01260, py, 0.00060, 0.00010, 46, 50, 2, "airport", "#38bdf8", false);
      });
      [
        [-0.00285, 26], [-0.00300, 40], [-0.00335, 36], [-0.00355, 24],
        [-0.00375, 36], [-0.00410, 40], [-0.00425, 26]
      ].forEach(function (cSeg) {
        pushBox(0.01234, cSeg[0], 0.00004, 0.00018, cSeg[1], cSeg[1] + 2.2, 2, "airport", "#bae6fd", false);
        pushBox(0.01286, cSeg[0], 0.00004, 0.00018, cSeg[1], cSeg[1] + 2.2, 2, "airport", "#bae6fd", false);
      });

      /* Central Monument Roundabout: Reflecting Plinth & Syndicate Obelisk at (0.0000, 0.0043) */
      pushOct(0.0000, 0.0043, 0.00032, 0.00026, 0, 5, 0, "harbor", "#e4dac6", 12, false);
      pushOct(0.0000, 0.0043, 0.00018, 0.00015, 5, 11, 1, "harbor", "#cfc3ab", 8, false);
      pushOct(0.0000, 0.0043, 0.00009, 0.00008, 11, 46, 2, "harbor", "#f2ead8", 4, false);
      pushOct(0.0000, 0.0043, 0.00006, 0.00005, 46, 54, 2, "harbor", "#dba83b", 4, false);

      /* =====================================================================
         2. SECTOR 2: WEST NEON & RIVIERA PENINSULA (Breathing Curated Clusters)
         ===================================================================== */
      /* Hero: Grand Velvet Palace Casino (-0.0102, 0.0008) — Curved Arrival Plaza + Fountain Terrace + Stepped Golden Dome */
      pushOct(-0.0102, 0.0008, 0.00125, 0.00096, 0, 12, 0, "neon", "#e0d4be", 12, false);
      pushBox(-0.0102, 0.0008, 0.00165, 0.00125, 12, 34, 0, "neon");
      pushBox(-0.0102, 0.0008, 0.00124, 0.00094, 34, 92, 1, "neon");
      pushOct(-0.0102, 0.0008, 0.00054, 0.00044, 92, 134, 2, "neon", "", 12);
      pushOct(-0.0102, 0.0008, 0.00040, 0.00032, 134, 152, 2, "neon", "#dba83b", 12, false);
      pushOct(-0.0102, 0.0008, 0.00022, 0.00018, 152, 168, 2, "neon", "#f4ca5c", 12, false);
      pushBox(-0.01105, 0.0008, 0.00020, 0.00020, 34, 156, 2, "neon", "#c084fc", false);
      pushBox(-0.00935, 0.0008, 0.00020, 0.00020, 34, 156, 2, "neon", "#c084fc", false);
      /* Fountain Terrace Bowl on east arrival plaza */
      pushOct(-0.0087, 0.0008, 0.00026, 0.00022, 0, 4, 2, "neon", "#7dd3fc", 12, false);

      /* Hero: Zone Biotech University Quad (-0.0144, 0.0052) inside green campus lawns */
      pushBox(-0.0144, 0.0058, 0.00185, 0.00034, 0, 36, 1, "neon");
      pushBox(-0.0144, 0.0046, 0.00185, 0.00034, 0, 36, 1, "neon");
      pushBox(-0.0153, 0.0052, 0.00036, 0.00105, 0, 32, 0, "neon");
      pushBox(-0.0135, 0.0052, 0.00036, 0.00105, 0, 32, 0, "neon");
      pushOct(-0.0144, 0.0052, 0.00030, 0.00025, 0, 62, 2, "neon", "#3e6fb0", 12);
      pushOct(-0.0144, 0.0052, 0.00016, 0.00014, 62, 74, 2, "neon", "#f3ead8", 12, false);

      /* Hero: Bloodsport Fight Pit (-0.0150, -0.0014) — Stepped 12-sided Octagonal Arena */
      pushOct(-0.0150, -0.0014, 0.00080, 0.00064, 0, 26, 0, "neon", "", 12);
      pushOct(-0.0150, -0.0014, 0.00060, 0.00048, 26, 44, 2, "neon", "#b85233", 12, false);

      /* Curated Breathing Neon & Riviera Clusters (wide avenues & plazas between buildings) */
      var neonBlocks = [
        /* Riviera Waterfront Promenade mid/high-rises */
        [-0.0080, 0.0028, 0.00105, 0.00086, 86, 0],
        [-0.0080, -0.0014, 0.00105, 0.00084, 74, 4],
        [-0.0082, 0.0054, 0.00110, 0.00082, 68, 2],
        /* Club Mirage Lounge & Entertainment Plaza */
        [-0.0132, 0.0024, 0.00125, 0.00095, 114, 3],
        [-0.0114, 0.0036, 0.00108, 0.00084, 82, 1],
        [-0.0092, 0.0052, 0.00115, 0.00088, 94, 5],
        /* Grand Noir Theater & South Boulevard */
        [-0.0114, -0.0024, 0.00125, 0.00090, 64, 4],
        [-0.0132, -0.0022, 0.00100, 0.00080, 56, 0],
        /* Kronk Championship Gym & Western Riviera */
        [-0.0158, 0.0016, 0.00118, 0.00092, 72, 2],
        [-0.0160, 0.0036, 0.00100, 0.00080, 58, 1],
        [-0.0118, 0.0060, 0.00105, 0.00078, 62, 5],
        [-0.0124, 0.0006, 0.00096, 0.00078, 96, 3]
      ];
      neonBlocks.forEach(function (b) {
        pushSculptedBlock(b[0], b[1], b[2], b[3], b[4], b[5], "neon");
      });

      /* =====================================================================
         3. SECTOR 4: EAST SOVEREIGN FINANCIAL ISLAND (True Island Skyline)
         ===================================================================== */
      /* Hero: 310m Sovereign Pinnacle (0.0134, 0.0032) — 7-Tier Super-Tall Tapered Landmark */
      pushBox(0.0134, 0.0032, 0.00180, 0.00148, 0, 38, 0, "citadel");
      pushOct(0.0134, 0.0032, 0.00074, 0.00062, 38, 134, 1, "citadel", "", 8);
      pushOct(0.0134, 0.0032, 0.00058, 0.00048, 134, 206, 2, "citadel", "", 8);
      pushOct(0.0134, 0.0032, 0.00042, 0.00035, 206, 256, 2, "citadel", "", 8);
      pushOct(0.0134, 0.0032, 0.00024, 0.00020, 256, 286, 2, "citadel", "#dba83b", 8, false);
      pushOct(0.0134, 0.0032, 0.00010, 0.00009, 286, 310, 2, "citadel", "#f4ca5c", 6, false);

      /* Hero: Sovereign Crescent Twin Spires (0.0104, 0.0018) + Golden Sky-Bridge */
      pushBox(0.0104, 0.0018, 0.00185, 0.00110, 0, 24, 0, "citadel");
      pushOct(0.0098, 0.0018, 0.00044, 0.00040, 24, 186, 1, "citadel", "", 8);
      pushOct(0.0098, 0.0018, 0.00028, 0.00026, 186, 215, 2, "citadel", "#dba83b", 8, false);
      pushOct(0.0110, 0.0018, 0.00044, 0.00040, 24, 172, 1, "citadel", "", 8);
      pushOct(0.0110, 0.0018, 0.00028, 0.00026, 172, 198, 2, "citadel", "#dba83b", 8, false);
      pushBox(0.0104, 0.0018, 0.00105, 0.00032, 112, 126, 2, "citadel", "#f4ca5c", false);

      /* Hero: Federal High Courthouse (0.0100, 0.0066) — Neoclassical Plinth + Wings + Gilded Dome */
      pushBox(0.0100, 0.0066, 0.00190, 0.00115, 0, 16, 0, "citadel");
      pushBox(0.0100, 0.0066, 0.00154, 0.00086, 16, 52, 1, "citadel");
      pushOct(0.0100, 0.0066, 0.00044, 0.00036, 52, 76, 2, "citadel", "#dfd5c2", 12, false);
      pushOct(0.0100, 0.0066, 0.00024, 0.00020, 76, 90, 2, "citadel", "#dba83b", 12, false);

      /* Curated Breathing Financial Island Towers (generous boulevards, sculpture parks & water views) */
      var citadelBlocks = [
        [0.0086, -0.0008, 0.00112, 0.00090, 132, 0],
        [0.0106, -0.0012, 0.00118, 0.00092, 148, 3],
        [0.0132, -0.0012, 0.00116, 0.00090, 118, 1],
        [0.0158, 0.0006, 0.00124, 0.00096, 164, 2],
        [0.0160, -0.0014, 0.00106, 0.00084, 108, 4],
        [0.0156, 0.0046, 0.00128, 0.00098, 192, 0],
        [0.0162, 0.0068, 0.00112, 0.00088, 138, 3],
        [0.0132, 0.0066, 0.00118, 0.00092, 156, 5],
        [0.0086, 0.0044, 0.00110, 0.00086, 126, 1],
        [0.0112, 0.0044, 0.00105, 0.00084, 144, 2],
        [0.0168, 0.0026, 0.00104, 0.00086, 124, 4]
      ];
      citadelBlocks.forEach(function (b) {
        pushSculptedBlock(b[0], b[1], b[2], b[3], b[4], b[5], "citadel");
      });

      /* =====================================================================
         4. SECTOR 3 NORTH: ZONE COLISEUM ARENA, NITRO SPEEDWAY & BROADCAST SPIRE
         ===================================================================== */
      /* Hero: Zone Coliseum Stadium (0.0032, 0.0088) — REAL 16-sided Hollow Tiered Bowl + 4 Floodlight Towers */
      pushPoly(hollowEllipsePoly(0.0032, 0.0088, 0.00185, 0.00142, 0.00108, 0.00080, 16), 0, 26, 0, "harbor", "", true);
      pushPoly(hollowEllipsePoly(0.0032, 0.0088, 0.00168, 0.00128, 0.00116, 0.00086, 16), 26, 48, 1, "harbor", "", true);
      pushPoly(hollowEllipsePoly(0.0032, 0.0088, 0.00156, 0.00118, 0.00122, 0.00092, 16), 48, 56, 2, "harbor", "#dba83b", false);
      /* 4 Corner Floodlight Towers */
      [
        [0.0015, 0.0076], [0.0049, 0.0076],
        [0.0015, 0.0100], [0.0049, 0.0100]
      ].forEach(function (fl) {
        pushBox(fl[0], fl[1], 0.00014, 0.00014, 0, 82, 2, "harbor", "#e2e8f0", false);
        pushBox(fl[0], fl[1], 0.00024, 0.00018, 76, 84, 2, "harbor", "#fef08a", false);
      });

      /* Hero: Nitro Motor Speedway (-0.0026, 0.0092) — Twin Grandstands + Elevated Start/Finish Gantry + Pit Paddocks */
      /* North Main Tiered Grandstand */
      pushBox(-0.0026, 0.01095, 0.0030, 0.00046, 0, 18, 0, "harbor");
      pushBox(-0.0026, 0.01105, 0.0028, 0.00030, 18, 34, 2, "harbor", "#b85233", false);
      /* South Paddock Grandstand */
      pushBox(-0.0026, 0.00745, 0.0028, 0.00042, 0, 14, 1, "harbor");
      pushBox(-0.0026, 0.00735, 0.0025, 0.00026, 14, 26, 2, "harbor");
      /* Start/Finish Bridge Gantry spanning the South Straight */
      pushBox(-0.0026, 0.00805, 0.00026, 0.00086, 14, 22, 2, "harbor", "#dba83b", false);
      pushBox(-0.0026, 0.00842, 0.00014, 0.00014, 0, 22, 1, "harbor", "#334155", false);
      pushBox(-0.0026, 0.00768, 0.00014, 0.00014, 0, 22, 1, "harbor", "#334155", false);
      /* Infield Race Control Pavilion */
      pushOct(-0.0026, 0.0092, 0.00036, 0.00024, 0, 16, 2, "harbor", "#f3ead8", 10, false);

      /* Hero: Signal Syndicate Broadcast Tower (-0.0056, 0.0072) — 172m Spire */
      pushBox(-0.0056, 0.0072, 0.00072, 0.00062, 0, 30, 0, "harbor");
      pushOct(-0.0056, 0.0072, 0.00028, 0.00024, 30, 102, 1, "harbor", "", 8);
      pushOct(-0.0056, 0.0072, 0.00040, 0.00034, 102, 118, 2, "harbor", "#3e6fb0", 12, false);
      pushOct(-0.0056, 0.0072, 0.00010, 0.00009, 118, 172, 2, "harbor", "#c25232", 6, false);

      /* Civic Park Edge Pavilions (sparse so the North Belt stays wide & green!) */
      pushSculptedBlock(-0.0052, 0.0112, 0.00105, 0.00076, 48, 4, "harbor");
      pushSculptedBlock(0.0004, 0.0064, 0.00100, 0.00074, 54, 1, "harbor");
      pushSculptedBlock(0.0056, 0.0064, 0.00098, 0.00074, 62, 5, "harbor");

      /* =====================================================================
         5. SECTOR 3 SOUTH-WEST: DEEPWATER PORT (3 Piers, 3 Moored Ships, Cranes, Lighthouse)
         ===================================================================== */
      var containerColors = ["#c25232", "#3e6fb0", "#dba83b", "#5d8c42"];

      /* Back-Quay Pitched Industrial Warehouses & Redline Chop Shop */
      [-0.0156, -0.0128, -0.0098, -0.0068, -0.0036, -0.0010].forEach(function (wx, wIdx) {
        pushBox(wx, -0.0062, 0.00155, 0.00072, 0, 18, 0, "harbor");
        pushBox(wx, -0.0062, 0.00120, 0.00040, 18, 26, 1, "harbor");
        if (wIdx % 2 === 0) {
          pushBox(wx, -0.0073, 0.00056, 0.00024, 0, 11, 2, "harbor", containerColors[wIdx % 4], false);
          pushBox(wx + 0.00064, -0.0073, 0.00048, 0.00024, 0, 16, 2, "harbor", containerColors[(wIdx + 1) % 4], false);
        }
      });

      /* Cylindrical Industrial Fuel Silos on West Industrial Quay */
      [-0.0166, -0.0157, -0.0148].forEach(function (sx) {
        pushOct(sx, -0.0076, 0.00032, 0.00027, 0, 30, 1, "harbor", "#e4dac6", 12, false);
      });

      /* Container Yards + 6 Terracotta Gantry Cranes on the 3 Jutting Shipping Piers */
      [-0.0146, -0.0102, -0.0058].forEach(function (pierX, pIdx) {
        /* Stacked Freight Containers along each pier */
        pushBox(pierX - 0.00024, -0.0086, 0.00036, 0.00086, 0, 12, 2, "harbor", containerColors[pIdx % 4], false);
        pushBox(pierX + 0.00024, -0.0096, 0.00034, 0.00078, 0, 16, 2, "harbor", containerColors[(pIdx + 2) % 4], false);
        /* 2 Terracotta Gantry Cranes per Pier overhanging the adjacent water slip */
        [-0.0087, -0.0101].forEach(function (cy) {
          pushBox(pierX + 0.00042, cy - 0.00018, 0.00011, 0.00010, 0, 44, 2, "harbor", "#c25232", false);
          pushBox(pierX + 0.00042, cy + 0.00018, 0.00011, 0.00010, 0, 44, 2, "harbor", "#c25232", false);
          pushBox(pierX + 0.00072, cy, 0.00095, 0.00044, 39, 44, 2, "harbor", "#c25232", false);
        });
      });

      /* 3 Deepwater Cargo Ships moored IN the actual water slips between/beside the piers */
      [-0.0124, -0.0080, -0.0036].forEach(function (slipX, sIdx) {
        /* Dark steel hull floating in the water slip */
        pushBox(slipX, -0.0095, 0.00052, 0.0022, 0, 9, 0, "harbor", "#2c3e50", false);
        /* White aft bridge superstructure */
        pushBox(slipX, -0.00875, 0.00044, 0.00042, 9, 27, 2, "harbor", "#f5efe2", false);
        /* Deck cargo container stacks */
        pushBox(slipX, -0.00975, 0.00040, 0.00115, 9, 17, 2, "harbor", containerColors[sIdx % 4], false);
        pushBox(slipX, -0.00985, 0.00032, 0.00074, 17, 23, 2, "harbor", containerColors[(sIdx + 1) % 4], false);
      });

      /* Hero: Harbor Lighthouse on the curving stone breakwater jetty (-0.0018, -0.0112) */
      pushOct(-0.0018, -0.0112, 0.00034, 0.00028, 0, 10, 0, "harbor", "#cfc3ab", 10, false);
      pushOct(-0.0018, -0.0112, 0.00020, 0.00017, 10, 28, 2, "harbor", "#faf4e6", 10, false);
      pushOct(-0.0018, -0.0112, 0.00018, 0.00015, 28, 37, 2, "harbor", "#c25232", 10, false);
      pushOct(-0.0018, -0.0112, 0.00016, 0.00014, 37, 46, 2, "harbor", "#faf4e6", 10, false);
      pushOct(-0.0018, -0.0112, 0.00022, 0.00019, 46, 54, 2, "harbor", "#fde047", 10, false);
      pushOct(-0.0018, -0.0112, 0.00012, 0.00010, 54, 60, 2, "harbor", "#c25232", 8, false);

      /* =====================================================================
         6. SECTOR 5 SOUTH-EAST: AIRPORT PENINSULA & EMERALD SUPERYACHT MARINA
         ===================================================================== */
      /* Hero: Curved Winged International Airport Terminal (0.0138, -0.0076) */
      pushPoly(arcBandPoly(0.0138, -0.0064, 0.0016, 0.00085, 0.0024, 0.00140, Math.PI * 1.15, Math.PI * 1.85, 14), 0, 24, 1, "airport", "", true);
      pushPoly(arcBandPoly(0.0138, -0.0064, 0.00175, 0.00095, 0.00225, 0.00130, Math.PI * 1.18, Math.PI * 1.82, 14), 24, 34, 2, "airport", "#e8e0cf", false);
      /* 3 Boarding Concourse Piers extending toward the Apron */
      [0.0122, 0.0138, 0.0154].forEach(function (px) {
        pushBox(px, -0.0080, 0.00026, 0.00085, 0, 15, 0, "airport");
      });

      /* Hero: Flared Air Traffic Control Tower (0.0168, -0.0068) */
      pushOct(0.0168, -0.0068, 0.00022, 0.00019, 0, 92, 1, "airport", "", 8);
      pushOct(0.0168, -0.0068, 0.00040, 0.00034, 92, 108, 2, "airport", "#38bdf8", 12, false);
      pushOct(0.0168, -0.0068, 0.00022, 0.00019, 108, 122, 2, "airport", "#f5efe2", 10, false);

      /* Diplomatic Jet Hangar (0.0176, -0.0056) */
      pushBox(0.0176, -0.0056, 0.00145, 0.00088, 0, 22, 1, "airport");
      pushBox(0.0176, -0.0056, 0.00118, 0.00060, 22, 30, 2, "airport", "#e4dac6", false);

      /* 4 Parked Jets on the Terminal Apron */
      [0.0114, 0.0130, 0.0146, 0.0162].forEach(function (jx) {
        pushBox(jx, -0.00865, 0.00012, 0.00052, 2, 8, 2, "airport", "#f8fafc", false);
        pushBox(jx, -0.00860, 0.00052, 0.00012, 2, 7, 2, "airport", "#f8fafc", false);
        pushBox(jx, -0.00885, 0.00022, 0.00008, 2, 11, 2, "airport", "#38bdf8", false);
      });

      /* Hero: Emerald Superyacht Marina Yacht Club + 5 Moored Superyachts */
      pushOct(0.0072, -0.0082, 0.00058, 0.00044, 0, 24, 1, "airport", "#ece3d0", 12);
      pushOct(0.0072, -0.0082, 0.00034, 0.00026, 24, 34, 2, "airport", "#38bdf8", 12, false);
      /* 5 Moored Superyachts inside the Crescent Marina Lagoon */
      [
        [0.0058, -0.0096], [0.0066, -0.0099], [0.0074, -0.0100],
        [0.0082, -0.0098], [0.0089, -0.0093]
      ].forEach(function (y) {
        pushBox(y[0], y[1], 0.00018, 0.00068, 0, 6, 2, "airport", "#faf4e6", false);
        pushBox(y[0], y[1] + 0.00005, 0.00012, 0.00034, 6, 13, 2, "airport", "#3e6fb0", false);
      });

      /* Low-Density Waterfront Luxury Villas & Sovereign Sky Penthouses */
      pushSculptedBlock(0.0082, -0.0058, 0.00106, 0.00086, 128, 4, "airport");
      pushSculptedBlock(0.0102, -0.0056, 0.00102, 0.00082, 108, 3, "airport");
      /* Sunlit low-rise coastal villas overlooking Emerald Marina */
      [
        [0.0058, -0.0056], [0.0066, -0.0064], [0.0056, -0.0070],
        [0.0094, -0.0068], [0.0104, -0.0070]
      ].forEach(function (v, vIdx) {
        pushBox(v[0], v[1], 0.00058, 0.00046, 0, 14 + (vIdx % 3) * 4, 0, "airport");
        pushBox(v[0] + 0.00006, v[1], 0.00034, 0.00028, 14 + (vIdx % 3) * 4, 22 + (vIdx % 3) * 4, 2, "airport", "#f3ead8", false);
      });

      /* Publish ALL architectural wall polygons to district-surfaces111.mjs! */
      if (typeof window !== "undefined") {
        window.__zoneOuterArchitecturalFeatures = facadeFeatures;
      }

      return { type: "FeatureCollection", features: features };
    }

    /* =========================================================================
       3D LAYERED TREE-CANOPY GENERATOR (Corniche, Parks, Campus & Villas)
       ========================================================================= */
    function buildMetroTreesGeo() {
      var features = [];
      var tid = 8400;

      function addTree(dx, dy, r, h, tone) {
        features.push({
          type: "Feature",
          id: tid++,
          properties: {
            height: h,
            min_height: 3,
            tone: tone % 3
          },
          geometry: {
            type: "Polygon",
            coordinates: ellipsePoly(dx, dy, r, r * 0.82, 7, (tid % 5) * 0.4)
          }
        });
      }

      function addTreeCluster(cx, cy, count, spreadX, spreadY, seed) {
        for (var i = 0; i < count; i++) {
          var a = (i / Math.max(1, count)) * Math.PI * 2 + seed * 0.7;
          var rad = 0.45 + ((seed * 13 + i * 7) % 10) * 0.065;
          var tx = cx + Math.cos(a) * spreadX * rad;
          var ty = cy + Math.sin(a) * spreadY * rad;
          var r = 0.00018 + ((seed + i * 3) % 4) * 0.00004;
          var h = 9 + ((seed * 5 + i * 3) % 8);
          addTree(tx, ty, r, h, seed + i);
        }
      }

      /* 1. Central Civic Park Belt & Monument Roundabout (between Core & North Park) */
      [-0.0044, -0.0032, -0.0018, 0.0018, 0.0032, 0.0044].forEach(function (x, i) {
        addTreeCluster(x, 0.0043, 4, 0.00055, 0.00038, i + 1);
      });

      /* 2. Coliseum Civic Park (framing Stadium & Nitro Speedway) */
      [
        [-0.0058, 0.0092], [-0.0048, 0.0118], [-0.0004, 0.0114],
        [0.0004, 0.0088], [0.0012, 0.0112], [0.0052, 0.0110],
        [0.0056, 0.0088], [-0.0026, 0.0062], [0.0030, 0.0062]
      ].forEach(function (p, i) {
        addTreeCluster(p[0], p[1], 5, 0.00062, 0.00048, i + 11);
      });

      /* 3. West Riviera Corniche Promenade & Biotech University Green Campus */
      [-0.0030, -0.0012, 0.0016, 0.0034, 0.0052].forEach(function (y, i) {
        addTreeCluster(-0.0072, y, 3, 0.00028, 0.00042, i + 25);
      });
      addTreeCluster(-0.0144, 0.0066, 5, 0.00085, 0.00035, 33);
      addTreeCluster(-0.0166, 0.0052, 4, 0.00042, 0.00068, 37);
      addTreeCluster(-0.0124, 0.0044, 4, 0.00052, 0.00040, 41);

      /* 4. Financial Island Waterfront Corniche & Pinnacle Sculpture Park */
      [-0.0016, 0.0018, 0.0042, 0.0066].forEach(function (y, i) {
        addTreeCluster(0.0076, y, 3, 0.00026, 0.00044, i + 45);
      });
      [0.0002, 0.0028, 0.0054].forEach(function (y, i) {
        addTreeCluster(0.0178, y, 3, 0.00030, 0.00048, i + 52);
      });
      addTreeCluster(0.0124, 0.0012, 4, 0.00052, 0.00036, 59);
      addTreeCluster(0.0142, 0.0054, 4, 0.00054, 0.00038, 63);

      /* 5. Emerald Marina Promenade & Waterfront Villa Gardens */
      addTreeCluster(0.0062, -0.0050, 4, 0.00055, 0.00034, 71);
      addTreeCluster(0.0086, -0.0048, 4, 0.00055, 0.00032, 75);
      addTreeCluster(0.0074, -0.0070, 4, 0.00058, 0.00034, 79);
      addTreeCluster(0.0108, -0.0074, 3, 0.00042, 0.00032, 83);

      return { type: "FeatureCollection", features: features };
    }

    /* =========================================================================
       NATURAL COASTAL GEOGRAPHY: ORGANIC BAY, WINDING CANALS, SHALLOWS,
       SANDY COVE BEACHES, LUSH PARKS, DUAL RUNWAYS, SPEEDWAY & GRAND BOULEVARDS
       ========================================================================= */
    function buildMetroLandAndRoadsGeo() {
      /* Organic sculpted sector land silhouettes (matching island/peninsula geography) */
      var landFeatures = [
        {
          type: "Feature",
          id: 7101,
          properties: { id: "sector-neon", color: "#c084fc" },
          geometry: {
            type: "Polygon",
            coordinates: smoothClosedPoly([
              [-0.0174, -0.0026], [-0.0150, -0.0038], [-0.0110, -0.0037],
              [-0.0072, -0.0034], [-0.0067, -0.0008], [-0.0069, 0.0024],
              [-0.0067, 0.0062], [-0.0092, 0.0073], [-0.0148, 0.0073],
              [-0.0175, 0.0054], [-0.0176, 0.0012]
            ], 2)
          }
        },
        {
          type: "Feature",
          id: 7102,
          properties: { id: "sector-citadel", color: "#eab308" },
          geometry: {
            type: "Polygon",
            coordinates: smoothClosedPoly([
              [0.0074, -0.0024], [0.0114, -0.0028], [0.0164, -0.0026],
              [0.0185, -0.0006], [0.0186, 0.0044], [0.0178, 0.0080],
              [0.0132, 0.0086], [0.0082, 0.0081], [0.0071, 0.0048],
              [0.0073, 0.0012]
            ], 2)
          }
        },
        {
          type: "Feature",
          id: 7103,
          properties: { id: "sector-harbor-north", color: "#f97316" },
          geometry: {
            type: "Polygon",
            coordinates: smoothClosedPoly([
              [-0.0064, 0.0052], [0.0062, 0.0052], [0.0068, 0.0084],
              [0.0058, 0.0125], [0.0002, 0.0129], [-0.0058, 0.0124],
              [-0.0066, 0.0086]
            ], 2)
          }
        },
        {
          type: "Feature",
          id: 7104,
          properties: { id: "sector-harbor", color: "#f97316" },
          geometry: {
            type: "Polygon",
            coordinates: smoothClosedPoly([
              [-0.0174, -0.0048], [0.0016, -0.0048], [0.0014, -0.0076],
              [-0.0022, -0.0082], [-0.0168, -0.0082], [-0.0176, -0.0066]
            ], 1)
          }
        },
        {
          type: "Feature",
          id: 7105,
          properties: { id: "sector-airport", color: "#38bdf8" },
          geometry: {
            type: "Polygon",
            coordinates: smoothClosedPoly([
              [0.0048, -0.0058], [0.0086, -0.0042], [0.0164, -0.0043],
              [0.0196, -0.0060], [0.0197, -0.0112], [0.0176, -0.0127],
              [0.0102, -0.0126], [0.0064, -0.0114], [0.0045, -0.0084]
            ], 2)
          }
        },
        /* Mainland North Civic Connector (seamlessly links Central Core to North Coliseum Parkland) */
        {
          type: "Feature",
          id: 7106,
          properties: { id: "sector-core-north", color: "#94a3b8" },
          geometry: {
            type: "Polygon",
            coordinates: closedRing([
              [-0.0048, 0.0033], [0.0048, 0.0033], [0.0052, 0.0056], [-0.0052, 0.0056]
            ])
          }
        },
        /* Mainland South Waterfront Connector (links Central Core seamlessly to South Port Promenade) */
        {
          type: "Feature",
          id: 7107,
          properties: { id: "sector-core-south", color: "#94a3b8" },
          geometry: {
            type: "Polygon",
            coordinates: closedRing([
              [-0.0048, -0.0052], [0.0018, -0.0052], [0.0028, -0.0033], [-0.0048, -0.0033]
            ])
          }
        }
      ];

      /* Opaque Full-World Ocean Mask with Exact Central Core Cutout Hole:
         Completely hides outer Brooklyn/NYC vector streets, East River water & bridges
         while keeping Central Core's real Streets v8 grid & 120 territory blocks 100% live! */
      var oceanMask = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 7200,
            properties: { kind: "ocean-mask" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  pt(-0.14, -0.10), pt(0.14, -0.10), pt(0.14, 0.10),
                  pt(-0.14, 0.10), pt(-0.14, -0.10)
                ],
                [
                  pt(-0.00475, -0.00345), pt(-0.00475, 0.00345),
                  pt(0.00475, 0.00345), pt(0.00475, -0.00345),
                  pt(-0.00475, -0.00345)
                ]
              ]
            }
          }
        ]
      };

      /* Internal Sheltered Water Basins carved cleanly inside our sculpted islands */
      var bayWater = {
        type: "FeatureCollection",
        features: [
          /* Emerald Superyacht Marina Sheltered Basin */
          {
            type: "Feature",
            id: 7205,
            properties: { kind: "marina" },
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(0.0073, -0.0097, 0.0022, 0.00125, 18, 0)
            }
          },
          /* Central Monument Roundabout Reflecting Pool */
          {
            type: "Feature",
            id: 7206,
            properties: { kind: "pool" },
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(0.0000, 0.0043, 0.00056, 0.00044, 16, 0)
            }
          }
        ]
      };

      /* Turquoise Shallow Coastal Shelf hugging shorelines & lagoons */
      var shallows = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 7231,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0036, -0.0080], [0.0046, -0.0052], [0.0074, -0.0044],
                [0.0110, -0.0032], [0.0196, -0.0032], [0.0218, -0.0058],
                [0.0218, -0.0126], [0.0180, -0.0146], [0.0086, -0.0144],
                [0.0042, -0.0120]
              ], 2)
            }
          },
          {
            type: "Feature",
            id: 7232,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0180, -0.0022], [0.0208, -0.0016], [0.0212, 0.0054],
                [0.0196, 0.0092], [0.0172, 0.0084], [0.0182, 0.0038]
              ], 2)
            }
          },
          {
            type: "Feature",
            id: 7233,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0188, -0.0076], [-0.0010, -0.0076], [0.0026, -0.0086],
                [0.0012, -0.0128], [-0.0064, -0.0132], [-0.0168, -0.0128],
                [-0.0196, -0.0102]
              ], 2)
            }
          },
          {
            type: "Feature",
            id: 7234,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(0.0073, -0.0097, 0.0020, 0.0011, 16, 0)
            }
          }
        ]
      };

      /* Warm Sandy Corniche Cove Beaches */
      var beaches = {
        type: "FeatureCollection",
        features: [
          /* West Riviera South Cove Beach */
          {
            type: "Feature",
            id: 7251,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0164, -0.0032], [-0.0128, -0.0036], [-0.0114, -0.0042],
                [-0.0148, -0.0044], [-0.0170, -0.0038]
              ], 2)
            }
          },
          /* East Financial Island Sunrise Corniche Beach */
          {
            type: "Feature",
            id: 7252,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0181, 0.0004], [0.0191, 0.0012], [0.0192, 0.0056],
                [0.0184, 0.0074], [0.0177, 0.0068], [0.0182, 0.0032]
              ], 2)
            }
          },
          /* Emerald Marina Crescent Sand Beach */
          {
            type: "Feature",
            id: 7253,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: arcBandPoly(0.0073, -0.0092, 0.0016, 0.00075, 0.0022, 0.00118, Math.PI * 0.15, Math.PI * 0.85, 12)
            }
          },
          /* Airport Peninsula South Lagoon Beach */
          {
            type: "Feature",
            id: 7254,
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0092, -0.0122], [0.0144, -0.0123], [0.0150, -0.0129],
                [0.0102, -0.0130], [0.0086, -0.0125]
              ], 2)
            }
          }
        ]
      };

      /* Lush Green Urban Parks, Waterfront Corniche Promenades & Coliseum Pitch */
      var parks = {
        type: "FeatureCollection",
        features: [
          /* North Coliseum Civic Park (wide verdant civic belt) */
          {
            type: "Feature",
            id: 7261,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0062, 0.0054], [0.0060, 0.0054], [0.0065, 0.0088],
                [0.0054, 0.0122], [-0.0054, 0.0122], [-0.0064, 0.0086]
              ], 2)
            }
          },
          /* Central Civic Parkway & Monument Roundabout Green Belt */
          {
            type: "Feature",
            id: 7262,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0046, 0.0036], [0.0046, 0.0036], [0.0046, 0.0050],
                [-0.0046, 0.0050]
              ], 1)
            }
          },
          /* West Riviera Waterfront Corniche Promenade */
          {
            type: "Feature",
            id: 7263,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0076, -0.0032], [-0.0068, -0.0032], [-0.0067, 0.0064],
                [-0.0077, 0.0064]
              ], 1)
            }
          },
          /* Biotech University Green Campus Grounds */
          {
            type: "Feature",
            id: 7264,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [-0.0168, 0.0038], [-0.0122, 0.0038], [-0.0122, 0.0070],
                [-0.0168, 0.0070]
              ], 2)
            }
          },
          /* Financial Island West & East Waterfront Corniche Parks + Pinnacle Garden */
          {
            type: "Feature",
            id: 7265,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0072, -0.0022], [0.0080, -0.0022], [0.0080, 0.0076],
                [0.0072, 0.0076]
              ], 1)
            }
          },
          {
            type: "Feature",
            id: 7266,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(0.0134, 0.0032, 0.00175, 0.00145, 14, 0)
            }
          },
          /* Waterfront Villa Gardens overlooking Emerald Marina */
          {
            type: "Feature",
            id: 7267,
            properties: { kind: "park" },
            geometry: {
              type: "Polygon",
              coordinates: smoothClosedPoly([
                [0.0050, -0.0048], [0.0108, -0.0046], [0.0108, -0.0076],
                [0.0052, -0.0076]
              ], 2)
            }
          },
          /* Zone Coliseum Stadium Bright Emerald Inner Playing Field */
          {
            type: "Feature",
            id: 7268,
            properties: { kind: "pitch" },
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(0.0032, 0.0088, 0.00112, 0.00084, 16, 0)
            }
          },
          /* Nitro Speedway Infield Lawn */
          {
            type: "Feature",
            id: 7269,
            properties: { kind: "pitch" },
            geometry: {
              type: "Polygon",
              coordinates: ellipsePoly(-0.0026, 0.0092, 0.00172, 0.00085, 24, 0)
            }
          }
        ]
      };

      /* Paved Infrastructure: Dual Runways, Taxiways, Apron, Speedway Oval Track, 3 Concrete Piers & Breakwaters */
      var pavedFeatures = [
        /* Main Runway 09L/27R */
        { type: "Feature", id: 7401, properties: { kind: "asphalt" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0098, -0.0101, 0.0190, -0.0092) } },
        /* Parallel Runway 09R/27L */
        { type: "Feature", id: 7402, properties: { kind: "asphalt" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0104, -0.0117, 0.0186, -0.0109) } },
        /* Terminal Apron & Parallel Taxiway */
        { type: "Feature", id: 7403, properties: { kind: "asphalt" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0108, -0.0089, 0.0174, -0.0076) } },
        { type: "Feature", id: 7404, properties: { kind: "asphalt" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0112, -0.0112, 0.0118, -0.0087) } },
        { type: "Feature", id: 7405, properties: { kind: "asphalt" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0168, -0.0112, 0.0174, -0.0087) } },
        /* Nitro Motor Speedway Curved Oval Paved Asphalt Track */
        {
          type: "Feature",
          id: 7406,
          properties: { kind: "asphalt" },
          geometry: {
            type: "Polygon",
            coordinates: hollowEllipsePoly(-0.0026, 0.0092, 0.00255, 0.00148, 0.00176, 0.00088, 32)
          }
        },
        /* 3 Concrete Deepwater Shipping Piers jutting into the Bay (separated by real water slips!) */
        { type: "Feature", id: 7407, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(-0.0154, -0.0110, -0.0138, -0.0078) } },
        { type: "Feature", id: 7408, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(-0.0110, -0.0110, -0.0094, -0.0078) } },
        { type: "Feature", id: 7409, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(-0.0066, -0.0110, -0.0050, -0.0078) } },
        /* Stone Breakwater Jetty curving out to Harbor Lighthouse (-0.0018, -0.0112) */
        {
          type: "Feature",
          id: 7410,
          properties: { kind: "pier" },
          geometry: {
            type: "Polygon",
            coordinates: closedRing([
              [-0.0024, -0.0078], [-0.0014, -0.0078], [-0.0011, -0.0100],
              [-0.0014, -0.0115], [-0.0023, -0.0115], [-0.0021, -0.0098]
            ])
          }
        },
        /* Crescent Superyacht Marina Stone Breakwater */
        {
          type: "Feature",
          id: 7411,
          properties: { kind: "pier" },
          geometry: {
            type: "Polygon",
            coordinates: arcBandPoly(0.0073, -0.0096, 0.0019, 0.00110, 0.00235, 0.00142, Math.PI * 1.05, Math.PI * 1.92, 16)
          }
        },
        /* Marina Yacht Pier Fingers */
        { type: "Feature", id: 7412, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0061, -0.0099, 0.0063, -0.0085) } },
        { type: "Feature", id: 7413, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0073, -0.0101, 0.0075, -0.0085) } },
        { type: "Feature", id: 7414, properties: { kind: "pier" }, geometry: { type: "Polygon", coordinates: rectPoly(0.0085, -0.0098, 0.0087, -0.0085) } }
      ];

      /* Runway & Speedway Painted Markings */
      var runwayCenter = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: 7451, properties: {}, geometry: { type: "LineString", coordinates: [pt(0.0100, -0.00965), pt(0.0188, -0.00965)] } },
          { type: "Feature", id: 7452, properties: {}, geometry: { type: "LineString", coordinates: [pt(0.0106, -0.01130), pt(0.0184, -0.01130)] } },
          /* Speedway Center Racing Line Oval */
          { type: "Feature", id: 7453, properties: {}, geometry: { type: "LineString", coordinates: ellipseRing(-0.0026, 0.0092, 0.00215, 0.00118, 32, 0, false) } }
        ]
      };

      /* Wide Dual-Carriageway Grand Boulevards, Curved Corniche Highway & Central Monument Roundabout */
      var roadPaths = [
        /* Grand East-West Boulevard (West Riviera -> Riviera Arch Bridge -> Core -> Al-Noor Bridge -> Financial Island) */
        [[-0.0170, 0.0004], [-0.0124, 0.0004], [-0.0070, 0.0004], [-0.0046, 0.0004], [0.0046, 0.0004], [0.0074, 0.0004], [0.0134, 0.0004], [0.0178, 0.0004]],
        /* North Civic Boulevard & Coliseum Parkway (sweeping through Central Monument Roundabout) */
        [[-0.0164, 0.0042], [-0.0092, 0.0042], [-0.0064, 0.0043], [-0.0008, 0.0043]],
        [[0.0008, 0.0043], [0.0052, 0.0043], [0.0080, 0.0042], [0.0134, 0.0042], [0.0178, 0.0042]],
        /* Central Monument Roundabout Ring (0.0000, 0.0043) */
        null,
        /* Grand North-South Spine (Port Corniche -> Core -> Monument Roundabout -> Coliseum Park) */
        [[0.0000, -0.0074], [0.0000, -0.0034], [0.0000, 0.0036]],
        [[0.0000, 0.0050], [0.0000, 0.0122]],
        /* Curved Southern Coastal Corniche Highway (West Port -> Core Waterfront -> Emerald Bay overlook) */
        [[-0.0170, -0.0048], [-0.0120, -0.0046], [-0.0064, -0.0044], [-0.0012, -0.0042], [0.0032, -0.0040]],
        /* West Riviera Curved Corniche & Casino Avenue */
        [[-0.0164, -0.0028], [-0.0138, -0.0034], [-0.0096, -0.0032], [-0.0074, -0.0018], [-0.0074, 0.0022], [-0.0076, 0.0062], [-0.0114, 0.0068], [-0.0160, 0.0064]],
        [[-0.0124, -0.0032], [-0.0124, 0.0066]],
        /* Financial Island Waterfront Loop */
        [[0.0080, -0.0022], [0.0080, 0.0074], [0.0134, 0.0078], [0.0176, 0.0070], [0.0178, 0.0012], [0.0172, -0.0022], [0.0126, -0.0024], [0.0080, -0.0022]],
        /* Financial Island Spine -> Airport Causeway Bridge -> Terminal Loop & Marina Drive */
        [[0.0126, 0.0078], [0.0126, 0.0004], [0.0126, -0.0024], [0.0126, -0.0046], [0.0126, -0.0068]],
        [[0.0056, -0.0058], [0.0086, -0.0048], [0.0126, -0.0048], [0.0168, -0.0048], [0.0188, -0.0062]],
        [[0.0072, -0.0078], [0.0108, -0.0072], [0.0148, -0.0072], [0.0174, -0.0068]],
        /* Port Quay Industrial Drive */
        [[-0.0166, -0.0074], [-0.0102, -0.0075], [-0.0038, -0.0075], [0.0010, -0.0072]]
      ];

      var roads = roadPaths.map(function (path, rIdx) {
        var coords = path === null
          ? ellipseRing(0.0000, 0.0043, 0.00084, 0.00068, 20, 0, false)
          : lineCoords(path);
        return {
          type: "Feature",
          id: 7300 + rIdx,
          properties: { major: rIdx <= 6 || rIdx === 9 || rIdx === 10 ? 1 : 0 },
          geometry: { type: "LineString", coordinates: coords }
        };
      });

      return {
        oceanMask: oceanMask,
        land: { type: "FeatureCollection", features: landFeatures },
        water: bayWater,
        shallows: shallows,
        beaches: beaches,
        parks: parks,
        roads: { type: "FeatureCollection", features: roads },
        runway: { type: "FeatureCollection", features: pavedFeatures },
        runwayCenter: runwayCenter
      };
    }

    /* =========================================================================
       LIVING CITY ATMOSPHERE: 18 BOULEVARD/BRIDGE VEHICLES, 6 HARBOR BOATS,
       4 PULSING AVIATION/MARITIME BEACONS (Lightweight ~12fps, Auto-Paused)
       ========================================================================= */
    var VEHICLE_ROUTES = [
      /* 0-5: Grand East-West Boulevard across Riviera Bridge & Al-Noor Bridge */
      { pts: [[-0.0168, 0.00046], [0.0176, 0.00046]], speed: 0.0048, phase: 0.02, dir: 1 },
      { pts: [[-0.0168, 0.00046], [0.0176, 0.00046]], speed: 0.0044, phase: 0.34, dir: 1 },
      { pts: [[-0.0168, 0.00046], [0.0176, 0.00046]], speed: 0.0051, phase: 0.68, dir: 1 },
      { pts: [[0.0176, 0.00034], [-0.0168, 0.00034]], speed: 0.0046, phase: 0.14, dir: -1 },
      { pts: [[0.0176, 0.00034], [-0.0168, 0.00034]], speed: 0.0049, phase: 0.49, dir: -1 },
      { pts: [[0.0176, 0.00034], [-0.0168, 0.00034]], speed: 0.0042, phase: 0.82, dir: -1 },
      /* 6-9: Financial Island -> Airport Causeway Bridge -> Terminal Loop */
      { pts: [[0.01266, 0.0074], [0.01266, -0.0048], [0.0168, -0.0048], [0.0168, -0.0068]], speed: 0.0055, phase: 0.08, dir: 1 },
      { pts: [[0.01266, 0.0074], [0.01266, -0.0048], [0.0168, -0.0048], [0.0168, -0.0068]], speed: 0.0050, phase: 0.54, dir: 1 },
      { pts: [[0.0168, -0.0068], [0.01254, -0.0048], [0.01254, 0.0074]], speed: 0.0053, phase: 0.28, dir: -1 },
      { pts: [[0.0168, -0.0068], [0.01254, -0.0048], [0.01254, 0.0074]], speed: 0.0047, phase: 0.76, dir: -1 },
      /* 10-13: Grand North-South Spine & Coliseum Parkway */
      { pts: [[0.00006, -0.0072], [0.00006, 0.0035], [0.00075, 0.0043], [0.00006, 0.0051], [0.00006, 0.0120]], speed: 0.0056, phase: 0.11, dir: 1 },
      { pts: [[0.00006, -0.0072], [0.00006, 0.0035], [0.00075, 0.0043], [0.00006, 0.0051], [0.00006, 0.0120]], speed: 0.0052, phase: 0.61, dir: 1 },
      { pts: [[-0.00006, 0.0120], [-0.00006, 0.0051], [-0.00075, 0.0043], [-0.00006, 0.0035], [-0.00006, -0.0072]], speed: 0.0054, phase: 0.36, dir: -1 },
      { pts: [[-0.00006, 0.0120], [-0.00006, 0.0051], [-0.00075, 0.0043], [-0.00006, 0.0035], [-0.00006, -0.0072]], speed: 0.0049, phase: 0.85, dir: -1 },
      /* 14-15: Southern Coastal Corniche Highway */
      { pts: [[-0.0168, -0.0047], [-0.0080, -0.0044], [0.0030, -0.0040]], speed: 0.0052, phase: 0.22, dir: 1 },
      { pts: [[0.0030, -0.0041], [-0.0080, -0.0045], [-0.0168, -0.0048]], speed: 0.0050, phase: 0.71, dir: -1 },
      /* 16-17: Financial Island Waterfront Loop & West Riviera Loop */
      { pts: [[0.0080, -0.0020], [0.0080, 0.0072], [0.0176, 0.0070], [0.0176, -0.0020], [0.0080, -0.0020]], speed: 0.0038, phase: 0.18, dir: 1 },
      { pts: [[-0.0074, -0.0022], [-0.0074, 0.0062], [-0.0160, 0.0062], [-0.0160, -0.0024], [-0.0074, -0.0022]], speed: 0.0036, phase: 0.64, dir: -1 }
    ];

    var BOAT_ROUTES = [
      /* 2 Ferries gliding up & down the winding Grand Canal */
      { pts: [[0.0059, -0.0078], [0.0060, -0.0018], [0.0059, 0.0038], [0.0068, 0.0108]], speed: 0.0022, phase: 0.10 },
      { pts: [[0.0068, 0.0108], [0.0059, 0.0038], [0.0060, -0.0018], [0.0059, -0.0078]], speed: 0.0020, phase: 0.58 },
      /* 2 Harbor Ferries crossing Southern Bay past the Lighthouse & Marina */
      { pts: [[-0.0165, -0.0132], [-0.0070, -0.0126], [0.0024, -0.0124], [0.0072, -0.0132]], speed: 0.0019, phase: 0.25 },
      { pts: [[0.0135, -0.0144], [0.0040, -0.0136], [-0.0030, -0.0126], [-0.0135, -0.0136]], speed: 0.0021, phase: 0.72 },
      /* 1 Riviera River Water Taxi */
      { pts: [[-0.0058, -0.0048], [-0.0058, 0.0016], [-0.0060, 0.0056], [-0.0076, 0.0102]], speed: 0.0024, phase: 0.42 },
      /* 1 Yacht cruising through Airport Strait into Emerald Bay */
      { pts: [[0.0205, -0.0036], [0.0140, -0.0035], [0.0078, -0.0037], [0.0036, -0.0076]], speed: 0.0023, phase: 0.88 }
    ];

    var BEACONS = [
      { id: "beacon-pinnacle", dx: 0.0134, dy: 0.0032, color: "#ff3b5c", phaseOff: 0.0 },
      { id: "beacon-atc", dx: 0.0168, dy: -0.0068, color: "#fbbf24", phaseOff: 1.6 },
      { id: "beacon-radio", dx: -0.0056, dy: 0.0072, color: "#ff3b5c", phaseOff: 3.1 },
      { id: "beacon-lighthouse", dx: -0.0018, dy: -0.0112, color: "#fde047", phaseOff: 4.5 }
    ];

    function samplePolyline(pts, tNorm) {
      var t = ((tNorm % 1) + 1) % 1;
      var n = pts.length - 1;
      if (n <= 0) return pts[0] || [0, 0];
      var segLengths = [];
      var total = 0;
      for (var i = 0; i < n; i++) {
        var len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        segLengths.push(len);
        total += len;
      }
      var target = t * total;
      var acc = 0;
      for (var j = 0; j < n; j++) {
        if (acc + segLengths[j] >= target || j === n - 1) {
          var frac = segLengths[j] > 0 ? (target - acc) / segLengths[j] : 0;
          return [
            pts[j][0] + (pts[j + 1][0] - pts[j][0]) * frac,
            pts[j][1] + (pts[j + 1][1] - pts[j][1]) * frac
          ];
        }
        acc += segLengths[j];
      }
      return pts[0];
    }

    function buildLivingGeo(tick) {
      var features = [];
      var phaseKey = state.activePhase || computeDesiredPhase();
      var isNightLike = phaseKey === "night" || phaseKey === "dusk";
      var id = 8800;

      /* 18 Vehicles */
      VEHICLE_ROUTES.forEach(function (r, idx) {
        var pos = samplePolyline(r.pts, r.phase + tick * r.speed);
        var isHeadlight = r.dir > 0 || idx % 2 === 0;
        var col = isNightLike
          ? (isHeadlight ? "#fde68a" : "#fb7185")
          : (idx % 3 === 0 ? "#1e293b" : idx % 3 === 1 ? "#dc2626" : "#f8fafc");
        features.push({
          type: "Feature",
          id: id++,
          properties: {
            kind: "vehicle",
            color: col,
            glowColor: isNightLike ? col : "#94a3b8",
            radius: isNightLike ? 2.6 : 2.3,
            glowRadius: isNightLike ? 7.2 : 3.2,
            opacity: isNightLike ? 0.96 : 0.78,
            glowOpacity: isNightLike ? 0.48 : 0.14
          },
          geometry: { type: "Point", coordinates: pt(pos[0], pos[1]) }
        });
      });

      /* 6 Harbor Boats / Ferries */
      BOAT_ROUTES.forEach(function (b) {
        var pos = samplePolyline(b.pts, b.phase + tick * b.speed);
        features.push({
          type: "Feature",
          id: id++,
          properties: {
            kind: "boat",
            color: isNightLike ? "#e0f2fe" : "#ffffff",
            glowColor: "#38bdf8",
            radius: 3.1,
            glowRadius: isNightLike ? 8.5 : 5.6,
            opacity: 0.95,
            glowOpacity: isNightLike ? 0.44 : 0.30
          },
          geometry: { type: "Point", coordinates: pt(pos[0], pos[1]) }
        });
      });

      /* 4 Pulsing Aviation & Maritime Beacons */
      BEACONS.forEach(function (bc) {
        var pulse = state.reducedMotion ? 0.85 : (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(tick * 0.28 + bc.phaseOff), 2));
        features.push({
          type: "Feature",
          id: id++,
          properties: {
            kind: "beacon",
            color: bc.color,
            glowColor: bc.color,
            radius: 2.8 + pulse * 1.8,
            glowRadius: 7.5 + pulse * 7.5,
            opacity: 0.45 + pulse * 0.55,
            glowOpacity: (isNightLike ? 0.62 : 0.34) * pulse
          },
          geometry: { type: "Point", coordinates: pt(bc.dx, bc.dy) }
        });
      });

      return { type: "FeatureCollection", features: features };
    }

    function tickLivingCity() {
      if (document.hidden || state.hostPaused || state.reducedMotion) return;
      if (!isMapStyleReady()) return;
      try {
        var src = map.getSource("metro-living-src");
        if (!src) return;
        state.livingTick += 1;
        src.setData(buildLivingGeo(state.livingTick));
      } catch (_) {}
    }

    function buildSectorLocksGeo() {
      var features = [];
      var seq = 1;
      SECTORS.forEach(function (s) {
        var locked = state.playerLevel < s.minLevel;
        if (!locked) return;
        features.push({
          type: "Feature",
          id: 7500 + (seq++),
          properties: { id: s.id, minLevel: s.minLevel, color: s.color },
          geometry: { type: "Polygon", coordinates: rectPoly(s.bounds[0], s.bounds[1], s.bounds[2], s.bounds[3]) }
        });
        if (s.northBounds) {
          features.push({
            type: "Feature",
            id: 7500 + (seq++),
            properties: { id: s.id, minLevel: s.minLevel, color: s.color },
            geometry: { type: "Polygon", coordinates: rectPoly(s.northBounds[0], s.northBounds[1], s.northBounds[2], s.northBounds[3]) }
          });
        }
      });
      return { type: "FeatureCollection", features: features };
    }

    function buildMetroPoiGeo() {
      var ar = state.lang === "ar";
      return {
        type: "FeatureCollection",
        features: METRO_POIS.map(function (p, idx) {
          var locked = state.playerLevel < p.minLevel;
          var title = p.name[ar ? "ar" : "en"];
          var coinImg = ensureMetroCoinImage(p, locked);
          return {
            type: "Feature",
            id: 5000 + idx,
            properties: {
              id: p.id,
              sector: p.sector,
              minLevel: p.minLevel,
              locked: locked,
              iconImage: coinImg,
              color: p.color,
              strokeColor: locked ? "rgba(148, 163, 184, 0.38)" : "#38bdf8",
              label: (locked ? "Lv." + p.minLevel + " · " : "") + title
            },
            geometry: {
              type: "Point",
              coordinates: pt(p.dx, p.dy)
            }
          };
        })
      };
    }

    function safeAddSource(id, spec) {
      try {
        if (!map.getSource(id)) map.addSource(id, spec);
      } catch (_) {}
    }

    function safeAddLayer(spec, beforeId) {
      try {
        if (!map.getLayer(spec.id)) {
          if (beforeId && map.getLayer(beforeId)) map.addLayer(spec, beforeId);
          else map.addLayer(spec);
        }
      } catch (err) {
        try { document.body.dataset.zmxLayerErr = spec.id + ":" + String((err && err.message) || err); } catch (_) {}
      }
    }

    function installMetroLayers() {
      if (!isMapStyleReady()) return;

      Object.keys(EXTRA_ICONS).forEach(function (iconKey) {
        try {
          if (typeof ensurePoiImage === "function") ensurePoiImage(iconKey);
        } catch (_) {}
      });

      /* Keep secondary service & detail POIs tucked until zoomed into Central Core so overview stays clean,
         scale core POI coins proportionally at overview zoom, and hide raw Brooklyn street names */
      ["zone-poi-icon-service", "zone-poi-service-reservations", "zone-poi-icon-detail", "zone-poi-halo-detail", "zone-poi-hitbox-detail"].forEach(function (lid) {
        if (map.getLayer(lid)) {
          try { map.setLayerZoomRange(lid, 15.15, 20); } catch (_) {}
        }
      });
      if (map.getLayer("zone-poi-icon")) {
        try {
          map.setLayoutProperty("zone-poi-icon", "icon-size", ["interpolate", ["linear"], ["zoom"], 12.6, 0.36, 14.6, 0.54, 16.5, 0.78]);
          map.setLayoutProperty("zone-poi-icon", "icon-allow-overlap", false);
          map.setLayoutProperty("zone-poi-icon", "icon-padding", 2);
        } catch (_) {}
      }
      if (map.getLayer("district-road-labels")) {
        try { map.setLayoutProperty("district-road-labels", "visibility", "none"); } catch (_) {}
      }

      var base = buildMetroLandAndRoadsGeo();
      /* Place our opaque Ocean Mask + Sculpted Archipelago Islands ABOVE district-road-labels / district-roads /
         district-buildings so zero Brooklyn grids, East River water, or ferry lines ever bleed into our ocean or islands,
         while keeping Central Core's cutout hole 100% open to real Streets v8 roads, 120 blocks & 3D buildings! */
      var beforeOverlay = map.getLayer("district-buildings-3d")
        ? "district-buildings-3d"
        : (map.getLayer("zone-blocks-fill") ? "zone-blocks-fill" : undefined);
      var beforeCoins = map.getLayer("zone-poi-underglow") ? "zone-poi-underglow" : undefined;

      /* 1. Opaque Full-World Ocean Mask (cutout hole exposes ONLY Central Core Streets v8) */
      safeAddSource("metro-ocean-mask-src", { type: "geojson", data: base.oceanMask });
      safeAddLayer({
        id: "metro-ocean-mask",
        type: "fill",
        source: "metro-ocean-mask-src",
        paint: { "fill-color": "#071a2d", "fill-opacity": 1 }
      }, beforeOverlay);

      /* 2. Subtle Coastal Shallow Reef Shimmer hugging sculpted island coastlines */
      safeAddSource("metro-shallows-src", { type: "geojson", data: base.shallows });
      safeAddLayer({
        id: "metro-shallows",
        type: "fill",
        source: "metro-shallows-src",
        paint: { "fill-color": "#5bc8cf", "fill-opacity": 0.20 }
      }, beforeOverlay);

      /* 3. Opaque Sculpted Archipelago Islands & Mainland Connectors + Subtle Sector Tint + Seawall Rim */
      safeAddSource("metro-land-src", { type: "geojson", data: base.land });
      safeAddLayer({
        id: "metro-land-sectors",
        type: "fill",
        source: "metro-land-src",
        paint: { "fill-color": "#0f1522", "fill-opacity": 1 }
      }, beforeOverlay);
      safeAddLayer({
        id: "metro-land-tint",
        type: "fill",
        source: "metro-land-src",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.08 }
      }, beforeOverlay);
      safeAddLayer({
        id: "metro-coastline-rim",
        type: "line",
        source: "metro-land-src",
        layout: { "line-join": "round" },
        paint: { "line-color": "#334c66", "line-width": ["interpolate", ["linear"], ["zoom"], 12.4, 1.4, 16, 3.0], "line-opacity": 0.82 }
      }, beforeOverlay);

      /* 3b. Internal Sheltered Water Basins (Emerald Marina & Monument Roundabout Reflecting Pool) */
      safeAddSource("metro-water-src", { type: "geojson", data: base.water });
      safeAddLayer({
        id: "metro-bay-water",
        type: "fill",
        source: "metro-water-src",
        paint: { "fill-color": "#071a2d", "fill-opacity": 0.98 }
      }, beforeOverlay);

      /* 4. Warm Sandy Corniche Cove Beaches */
      safeAddSource("metro-beaches-src", { type: "geojson", data: base.beaches });
      safeAddLayer({
        id: "metro-beaches",
        type: "fill",
        source: "metro-beaches-src",
        paint: { "fill-color": "#ecd9ae", "fill-opacity": 0.96 }
      }, beforeOverlay);

      /* 5. Lush Green Urban Parks, Waterfront Promenades & Stadium Pitch */
      safeAddSource("metro-parks-src", { type: "geojson", data: base.parks });
      safeAddLayer({
        id: "metro-parks",
        type: "fill",
        source: "metro-parks-src",
        paint: {
          "fill-color": ["case", ["==", ["get", "kind"], "pitch"], "#46b859", "#74a55b"],
          "fill-opacity": 0.95
        }
      }, beforeOverlay);

      /* 6. Paved Dual Runways, Speedway Oval Asphalt Track, Concrete Piers & Breakwaters */
      safeAddSource("metro-runway-src", { type: "geojson", data: base.runway });
      safeAddLayer({
        id: "metro-runway",
        type: "fill",
        source: "metro-runway-src",
        paint: {
          "fill-color": ["case", ["==", ["get", "kind"], "pier"], "#dcd2be", "#2c3440"],
          "fill-outline-color": ["case", ["==", ["get", "kind"], "pier"], "#9d9079", "#475569"],
          "fill-opacity": 0.98
        }
      }, beforeOverlay);

      safeAddSource("metro-runway-line-src", { type: "geojson", data: base.runwayCenter });
      safeAddLayer({
        id: "metro-runway-marks",
        type: "line",
        source: "metro-runway-line-src",
        paint: { "line-color": "#f8fafc", "line-width": 1.9, "line-dasharray": [3, 3], "line-opacity": 0.94 }
      }, beforeOverlay);

      /* 7. Wide Dual-Carriageway Grand Boulevards, Curved Corniche Highway & Roundabout */
      safeAddSource("metro-roads-src", { type: "geojson", data: base.roads });
      safeAddLayer({
        id: "metro-arterials-casing",
        type: "line",
        source: "metro-roads-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#131926",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12.4, ["case", ["==", ["get", "major"], 1], 4.8, 3.0], 16, ["case", ["==", ["get", "major"], 1], 11.5, 7.2]],
          "line-opacity": 0.94
        }
      }, beforeOverlay);
      safeAddLayer({
        id: "metro-arterials",
        type: "line",
        source: "metro-roads-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#2b384e",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12.4, ["case", ["==", ["get", "major"], 1], 3.0, 1.8], 16, ["case", ["==", ["get", "major"], 1], 8.2, 4.8]],
          "line-opacity": 0.98
        }
      }, beforeOverlay);
      safeAddLayer({
        id: "metro-arterials-center",
        type: "line",
        source: "metro-roads-src",
        filter: ["==", ["get", "major"], 1],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#e0b354",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12.5, 0.7, 16, 1.5],
          "line-dasharray": [4, 4],
          "line-opacity": 0.82
        }
      }, beforeOverlay);

      /* 8. 3D Layered Tree-Canopy Layer (Corniche, Parks, University & Villa Gardens) */
      safeAddSource("metro-trees-src", { type: "geojson", data: buildMetroTreesGeo() });
      safeAddLayer({
        id: "metro-trees-3d",
        type: "fill-extrusion",
        source: "metro-trees-src",
        paint: {
          "fill-extrusion-color": ["match", ["to-number", ["get", "tone"], 1], 0, "#3e7340", 1, "#558f4e", "#6ea85c"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true
        }
      }, beforeCoins);

      /* 9. Sculpted Unique Architecture + 3 Real 3D Bridges */
      safeAddSource("metro-skyline-src", { type: "geojson", data: buildOuterSkylineGeo() });
      safeAddLayer({
        id: "metro-outer-skyline-3d",
        type: "fill-extrusion",
        source: "metro-skyline-src",
        paint: {
          "fill-extrusion-color": [
            "case",
            ["!=", ["coalesce", ["get", "accent"], ""], ""],
            ["get", "accent"],
            ["match", ["to-number", ["get", "tone"], 1], 0, "#1e2a3f", 1, "#293954", "#354a6b"]
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.96,
          "fill-extrusion-vertical-gradient": true
        }
      }, beforeCoins);
      if (typeof ctx.onOuterBuildingsReady === "function") {
        try { ctx.onOuterBuildingsReady(); } catch (_) {}
      }

      /* 10. Living City Atmosphere: Vehicles, Harbor Ferries & Pulsing Beacons */
      safeAddSource("metro-living-src", { type: "geojson", data: buildLivingGeo(state.livingTick) });
      safeAddLayer({
        id: "metro-living-glow",
        type: "circle",
        source: "metro-living-src",
        paint: {
          "circle-pitch-alignment": "map",
          "circle-radius": ["get", "glowRadius"],
          "circle-color": ["get", "glowColor"],
          "circle-blur": 0.72,
          "circle-opacity": ["get", "glowOpacity"]
        }
      }, beforeCoins);
      safeAddLayer({
        id: "metro-living-dots",
        type: "circle",
        source: "metro-living-src",
        paint: {
          "circle-pitch-alignment": "viewport",
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"]
        }
      }, beforeCoins);

      /* 11. Sector Locks & Metro POIs */
      safeAddSource("sector-locks-src", { type: "geojson", data: buildSectorLocksGeo() });
      safeAddLayer({
        id: "sector-lock-fill",
        type: "fill",
        source: "sector-locks-src",
        paint: { "fill-color": "#090d16", "fill-opacity": 0.11 }
      }, beforeCoins);
      safeAddLayer({
        id: "sector-lock-border",
        type: "line",
        source: "sector-locks-src",
        paint: { "line-color": "#94a3b8", "line-width": 1.1, "line-dasharray": [4, 3], "line-opacity": 0.30 }
      }, beforeCoins);

      safeAddSource("metro-pois-src", { type: "geojson", data: buildMetroPoiGeo() });
      safeAddLayer({
        id: "metro-poi-underglow",
        type: "circle",
        source: "metro-pois-src",
        paint: {
          "circle-pitch-alignment": "viewport",
          "circle-pitch-scale": "viewport",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.4, 13, 15.5, 19, 18, 25],
          "circle-color": ["case", ["boolean", ["get", "locked"], false], ["get", "color"], "#38bdf8"],
          "circle-blur": 0.85,
          "circle-opacity": 0
        }
      });
      safeAddLayer({
        id: "metro-poi-halo",
        type: "circle",
        source: "metro-pois-src",
        paint: {
          "circle-pitch-alignment": "viewport",
          "circle-pitch-scale": "viewport",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.4, 9, 15.5, 13, 18, 17],
          "circle-color": "rgba(8, 13, 23, 0.88)",
          "circle-stroke-color": ["get", "strokeColor"],
          "circle-stroke-width": ["case", ["boolean", ["get", "locked"], false], 1.2, 2.1],
          "circle-opacity": 0,
          "circle-stroke-opacity": 0
        }
      });
      safeAddLayer({
        id: "metro-poi-icon",
        type: "symbol",
        source: "metro-pois-src",
        layout: {
          "icon-image": ["get", "iconImage"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12.4, 0.48, 14.5, 0.60, 17, 0.80],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
          "symbol-z-elevate": true,
          "text-field": ["get", "label"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12.4, 10, 15.5, 11.5],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.85],
          "text-anchor": "top",
          "text-max-width": 11,
          "text-optional": true,
          "text-allow-overlap": false,
          "text-padding": 10
        },
        paint: {
          "icon-opacity": 1,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.35, 0, 14.85, 1],
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(4, 8, 15, 0.96)",
          "text-halo-width": 1.6
        }
      });

      if (!state.metroInstalled && map.getLayer("metro-poi-icon")) {
        state.metroInstalled = true;
        map.on("click", "metro-poi-icon", handleMetroPoiClick);
        map.on("click", "metro-poi-halo", handleMetroPoiClick);
        map.on("click", "sector-lock-fill", function (ev) {
          var feat = ev && ev.features && ev.features[0];
          var secId = feat && feat.properties && feat.properties.id;
          var sec = SECTORS.find(function (s) { return s.id === secId; });
          if (sec) openSectorModal(sec);
        });
        var showPoiHover = function (ev) {
          map.getCanvas().style.cursor = "pointer";
          if (!hoverTipEl || !ev || !ev.features || !ev.features[0] || !ev.point) return;
          var lbl = ev.features[0].properties && ev.features[0].properties.label;
          if (!lbl) return;
          hoverTipEl.textContent = lbl;
          hoverTipEl.style.left = Math.round(ev.point.x) + "px";
          hoverTipEl.style.top = Math.round(ev.point.y) + "px";
          hoverTipEl.hidden = false;
        };
        var hidePoiHover = function () {
          map.getCanvas().style.cursor = "";
          if (hoverTipEl) hoverTipEl.hidden = true;
        };
        map.on("mousemove", "metro-poi-icon", showPoiHover);
        map.on("mouseleave", "metro-poi-icon", hidePoiHover);
        map.on("mousemove", "metro-poi-halo", showPoiHover);
        map.on("mouseleave", "metro-poi-halo", hidePoiHover);
      }

      widenMetroBounds();
      syncGateMarkers();
      applyAtmosphere(true);
      syncZmxReadyDataset();
    }

    function syncZmxReadyDataset() {
      try {
        document.body.dataset.zmxReady = JSON.stringify({
          version: 139,
          oceanMaskLayer: !!map.getLayer("metro-ocean-mask"),
          metroIconLayer: !!map.getLayer("metro-poi-icon"),
          skylineLayer: !!map.getLayer("metro-outer-skyline-3d"),
          treesLayer: !!map.getLayer("metro-trees-3d"),
          livingLayer: !!map.getLayer("metro-living-dots"),
          poiCount: METRO_POIS.length,
          phase: state.activePhase || computeDesiredPhase()
        });
      } catch (_) {}
    }

    function widenMetroBounds() {
      if (!map) return;
      try {
        map.setMinZoom(12.4);
        map.setMaxBounds([
          [CENTER[0] - 0.036, CENTER[1] - 0.025],
          [CENTER[0] + 0.036, CENTER[1] + 0.025]
        ]);
      } catch (_) {}
    }

    function ensureInitialMetroFraming() {
      if (state.didMetroFrame || !map) return;
      if (!document.body.classList.contains("cityOverviewMode")) return;
      var container = map.getContainer && map.getContainer();
      if (!container || container.clientWidth < 120 || container.clientHeight < 120) return;
      state.didMetroFrame = true;
      setTimeout(function () {
        widenMetroBounds();
        try {
          var mobile = container.clientWidth <= 760;
          map.jumpTo({
            center: CENTER,
            zoom: mobile ? 13.05 : 13.55,
            pitch: 52,
            bearing: -22
          });
        } catch (_) {}
      }, 90);
    }

    function syncGateMarkers() {
      state.gateMarkers.forEach(function (m) { try { m.remove(); } catch (_) {} });
      state.gateMarkers = [];
      if (!window.mapboxgl) return;
      var ar = state.lang === "ar";
      var shortSectorNames = {
        "sector-neon": { en: "West Riviera", ar: "النيون والريفييرا" },
        "sector-harbor": { en: "Port & Coliseum", ar: "الميناء والكولوسيوم" },
        "sector-citadel": { en: "Financial Island", ar: "الجزيرة المالية" },
        "sector-airport": { en: "Airport & Marina", ar: "المطار والمرسى" }
      };
      SECTORS.forEach(function (s) {
        if (s.minLevel <= 1) return;
        var unlocked = state.playerLevel >= s.minLevel;
        var el = document.createElement("button");
        el.type = "button";
        el.className = "zmx-gate-marker" + (unlocked ? " unlocked" : "");
        var shortPair = shortSectorNames[s.id] || s.name;
        var title = shortPair[ar ? "ar" : "en"];
        el.innerHTML = (unlocked ? ZMX_SVGS.unlock : ZMX_SVGS.lock) + '<span>' + (ar ? "م." : "LV.") + s.minLevel + " · " + title + '</span>';
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          openSectorModal(s);
        });
        var marker = new window.mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(s.gatePos)
          .addTo(map);
        state.gateMarkers.push(marker);
      });
    }

    function handleMetroPoiClick(ev) {
      var feat = ev && ev.features && ev.features[0];
      if (!feat) return;
      var poiId = feat.properties && feat.properties.id;
      var poi = METRO_POIS.find(function (item) { return item.id === poiId; });
      if (!poi) return;
      if (ev.originalEvent) ev.originalEvent.stopPropagation();

      if (state.playerLevel < poi.minLevel) {
        var sec = SECTORS.find(function (s) { return s.id === poi.sector; }) || SECTORS[1];
        openSectorModal(sec, poi);
        return;
      }
      if (poi.screen === "__world_travel__") {
        openWorldCitiesModal();
        return;
      }
      if (poi.screen && window.parent && window.parent !== window) {
        window.parent.postMessage({ zoneGo: poi.screen, MARKER_CLICK: poi.id, v: 1 }, window.location.origin);
      }
    }

    function openSectorModal(sector, clickedPoi) {
      if (!modalBackdrop) return;
      var ar = state.lang === "ar";
      var unlocked = state.playerLevel >= sector.minLevel;
      var pct = Math.min(100, Math.round((state.playerLevel / Math.max(1, sector.minLevel)) * 100));
      var poiLine = clickedPoi
        ? '<p style="margin:0 0 8px;font-weight:800;color:#d97706">' +
          (ar ? "الموقع المحدد: " : "Target Venue: ") + clickedPoi.name[ar ? "ar" : "en"] + "</p>"
        : "";

      modalBackdrop.innerHTML =
        '<div class="zmx-modal" dir="' + (ar ? "rtl" : "ltr") + '">' +
          '<div class="zmx-modal-head">' +
            '<div>' +
              '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:' + (unlocked ? "#10b981" : "#d97706") + '">' +
                (unlocked ? ZMX_SVGS.unlock + '<span>' + (ar ? "قطاع مفتوح للعمليات" : "Sector Clearance Active") + '</span>' : ZMX_SVGS.lock + '<span>' + (ar ? "قطاع مقفل بالمستوى" : "Restricted District") + '</span>') +
              '</div>' +
              '<h3 class="zmx-modal-title">' + sector.name[ar ? "ar" : "en"] + '</h3>' +
            '</div>' +
            '<button type="button" class="zmx-close" id="zmxModalClose">' + (ar ? "إغلاق" : "Close") + '</button>' +
          '</div>' +
          poiLine +
          '<p style="margin:0 0 12px;opacity:0.9">' + sector.desc[ar ? "ar" : "en"] + '</p>' +
          '<div style="padding:10px 12px;border-radius:6px;background:rgba(15,23,42,0.10);border:1px solid rgba(148,163,184,0.32);margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:6px">' +
              '<span>' + (ar ? "المستوى المطلوب: " : "Required Level: ") + "Lv." + sector.minLevel + '</span>' +
              '<span>' + (ar ? "مستواك الحالي: " : "Your Level: ") + "Lv." + state.playerLevel + '</span>' +
            '</div>' +
            '<div style="height:9px;border-radius:4px;background:rgba(0,0,0,0.22);overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#f59e0b,#39e7a3)"></div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:14px">' +
            '<strong style="display:block;margin-bottom:6px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em">' +
              (ar ? "المواقع والمزايا داخل هذا القطاع:" : "Locations & Rackets Inside This Sector:") +
            '</strong>' +
            '<ul style="margin:0;padding-inline-start:18px;display:grid;gap:4px">' +
              sector.unlocks[ar ? "ar" : "en"].map(function (u) { return "<li>" + u + "</li>"; }).join("") +
            '</ul>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="zmx-cta-sec" id="zmxReconBtn">' + ZMX_SVGS.recon + '<span>' + (ar ? "استطلاع ثلاثي الأبعاد" : "3D Recon Flyover") + '</span></button>' +
            (!unlocked
              ? '<button type="button" class="zmx-cta" data-go="crimes">' + ZMX_SVGS.bolt + '<span>' + (ar ? "اكسب خبرة من الجرائم" : "Earn XP in Crimes") + '</span></button>' +
                '<button type="button" class="zmx-cta-sec" data-go="missions">' + (ar ? "لوحة المهمات" : "Missions Board") + '</button>'
              : '<button type="button" class="zmx-cta" id="zmxExploreUnlocked">' + (ar ? "استكشف القطاع الآن" : "Explore Sector Now") + '</button>') +
          '</div>' +
        '</div>';

      modalBackdrop.hidden = false;
      modalBackdrop.querySelector("#zmxModalClose").onclick = function () { modalBackdrop.hidden = true; };
      modalBackdrop.querySelector("#zmxReconBtn").onclick = function () {
        modalBackdrop.hidden = true;
        widenMetroBounds();
        map.flyTo({ center: sector.anchor, zoom: 14.85, pitch: 54, bearing: -22, duration: 850, essential: true });
      };
      var expBtn = modalBackdrop.querySelector("#zmxExploreUnlocked");
      if (expBtn) {
        expBtn.onclick = function () {
          modalBackdrop.hidden = true;
          widenMetroBounds();
          map.flyTo({ center: sector.anchor, zoom: 15.1, pitch: 52, bearing: -22, duration: 700, essential: true });
        };
      }
      Array.from(modalBackdrop.querySelectorAll("[data-go]")).forEach(function (b) {
        b.onclick = function () {
          modalBackdrop.hidden = true;
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ zoneGo: b.getAttribute("data-go"), v: 1 }, window.location.origin);
          }
        };
      });
    }

    function openWorldCitiesModal() {
      if (!modalBackdrop) return;
      var ar = state.lang === "ar";
      var curCity = getActiveCity();

      var arcsSvg = WORLD_CITIES.filter(function (c) { return c.id !== curCity.id; }).map(function (c) {
        var unlocked = state.playerLevel >= c.minLevel;
        var midX = (curCity.mapX + c.mapX) / 2;
        var midY = Math.min(curCity.mapY, c.mapY) - 34;
        return '<path d="M' + curCity.mapX + ' ' + curCity.mapY + ' Q ' + midX + ' ' + midY + ' ' + c.mapX + ' ' + c.mapY + '" fill="none" stroke="' + (unlocked ? c.accent : "#64748b") + '" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.82"/>';
      }).join("");

      var nodesSvg = WORLD_CITIES.map(function (c) {
        var isHere = c.id === curCity.id;
        var unlocked = state.playerLevel >= c.minLevel;
        return (
          '<g transform="translate(' + c.mapX + ',' + c.mapY + ')">' +
            '<circle r="' + (isHere ? 7 : 5) + '" fill="' + (isHere ? "#39e7a3" : unlocked ? c.accent : "#475569") + '" stroke="#fff" stroke-width="1.4"/>' +
            '<text y="-10" text-anchor="middle" fill="#f8fafc" font-size="9.5" font-weight="800">' + c.code + '</text>' +
          '</g>'
        );
      }).join("");

      modalBackdrop.innerHTML =
        '<div class="zmx-modal" dir="' + (ar ? "rtl" : "ltr") + '">' +
          '<div class="zmx-modal-head">' +
            '<div>' +
              '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#38bdf8">' +
                ZMX_SVGS.plane + '<span>' + (ar ? "شبكة الطيران العالمية" : "Global Flight Network") + '</span>' +
              '</div>' +
              '<h3 class="zmx-modal-title">' +
                (ar ? "الرحلات العالمية · " : "World Flights · ") + curCity.name[ar ? "ar" : "en"] +
              '</h3>' +
            '</div>' +
            '<button type="button" class="zmx-close" id="zmxWorldClose">' + (ar ? "إغلاق" : "Close") + '</button>' +
          '</div>' +
          '<svg class="zmx-world-svg" viewBox="0 0 820 200" aria-label="World Flight Radar">' +
            '<g fill="rgba(148,163,184,0.16)" stroke="rgba(148,163,184,0.28)" stroke-width="0.8">' +
              '<path d="M95 52 L285 46 L310 112 L245 178 L185 170 L135 118 Z"/>' +
              '<path d="M368 48 L565 42 L748 64 L760 142 L635 162 L510 146 L440 168 L378 135 Z"/>' +
            '</g>' +
            arcsSvg +
            nodesSvg +
          '</svg>' +
          '<div id="zmxTransitStatus" hidden style="padding:10px 12px;margin-bottom:10px;border-radius:6px;background:rgba(56,189,248,0.16);border:1px solid #38bdf8;font-weight:800;text-align:center"></div>' +
          '<div class="zmx-city-grid">' +
            WORLD_CITIES.map(function (c) {
              var isHere = c.id === curCity.id;
              var unlocked = state.playerLevel >= c.minLevel;
              var cDate = getCityDate(c);
              var cPhase = TIME_PHASES[phaseFromHour(cDate.getHours())] || TIME_PHASES.day;
              return (
                '<div class="zmx-city-card' + (isHere ? " active" : "") + (!unlocked ? " locked" : "") + '">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center">' +
                    '<strong style="font-size:13.5px">' + c.name[ar ? "ar" : "en"] + " (" + c.code + ')</strong>' +
                    '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;color:' + (unlocked ? "#059669" : "#d97706") + '">' +
                      (unlocked ? cPhase.icon + '<span>' + formatClock(cDate).slice(0, 5) + '</span>' : ZMX_SVGS.lock + '<span>Lv.' + c.minLevel + '</span>') +
                    '</span>' +
                  '</div>' +
                  '<div style="font-size:11px;opacity:0.84">' + c.region[ar ? "ar" : "en"] + '</div>' +
                  '<div style="font-size:10.5px;color:#b4781e;font-weight:800">' + c.perk[ar ? "ar" : "en"] + '</div>' +
                  '<div style="margin-top:auto;padding-top:6px;display:flex;gap:6px;align-items:center;justify-content:space-between">' +
                    (isHere
                      ? '<button type="button" class="zmx-cta" data-contract="' + c.id + '" style="width:100%">' +
                          (ar ? "تنفيذ عملية محلية (+$" : "Run Regional Op (+$") + c.contract.cash.toLocaleString("en-US") + ")" +
                        '</button>'
                      : !unlocked
                        ? '<span style="font-size:10.5px;font-weight:800;color:#d97706">' + (ar ? "يتطلب المستوى " : "Requires Level ") + c.minLevel + '</span>'
                        : '<span style="font-size:11px;font-weight:800">' + (c.fare ? "$" + c.fare.toLocaleString("en-US") : (ar ? "مجاناً" : "Free")) + '</span>' +
                          '<button type="button" class="zmx-cta-sec" data-fly="' + c.id + '">' + ZMX_SVGS.plane + '<span>' + (ar ? "سافر الآن" : "Fly Now") + '</span></button>') +
                  '</div>' +
                '</div>'
              );
            }).join("") +
          '</div>' +
        '</div>';

      modalBackdrop.hidden = false;
      modalBackdrop.querySelector("#zmxWorldClose").onclick = function () {
        if (!state.transitBusy) modalBackdrop.hidden = true;
      };

      Array.from(modalBackdrop.querySelectorAll("[data-fly]")).forEach(function (btn) {
        btn.onclick = function () {
          var targetId = btn.getAttribute("data-fly");
          triggerCityFlight(targetId);
        };
      });

      Array.from(modalBackdrop.querySelectorAll("[data-contract]")).forEach(function (btn) {
        btn.onclick = function () {
          var c = getActiveCity();
          state.playerCash += c.contract.cash;
          state.playerXp += c.contract.xp;
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: "ZONE_WORLD_TRAVEL",
              action: "contract",
              cityId: c.id,
              cityName: c.name[state.lang === "ar" ? "ar" : "en"],
              cashDelta: c.contract.cash,
              xpDelta: c.contract.xp,
              contractLabel: c.contract[state.lang === "ar" ? "ar" : "en"]
            }, window.location.origin);
          }
          var banner = modalBackdrop.querySelector("#zmxTransitStatus");
          if (banner) {
            banner.hidden = false;
            banner.innerHTML = ZMX_SVGS.check + " <span>" +
              (state.lang === "ar" ? "تمت العملية بنجاح: +$" : "Syndicate Op Complete: +$") +
              c.contract.cash.toLocaleString("en-US") + " & +" + c.contract.xp + " XP!</span>";
          }
        };
      });
    }

    function triggerCityFlight(targetId) {
      if (state.transitBusy) return;
      var dest = WORLD_CITIES.find(function (c) { return c.id === targetId; });
      if (!dest || state.playerLevel < dest.minLevel) return;
      var ar = state.lang === "ar";
      var statusEl = modalBackdrop && modalBackdrop.querySelector("#zmxTransitStatus");
      if (state.playerCash < dest.fare) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.innerHTML = ZMX_SVGS.alert + " <span>" +
            (ar ? "رصيدك النقدي غير كافٍ لتذكرة الطيران." : "Insufficient cash for charter flight fare.") + "</span>";
        }
        return;
      }

      state.transitBusy = true;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.innerHTML = ZMX_SVGS.plane + " <span>" +
          (ar ? "الطائرة الخاصة في الجو نحو " : "Syndicate Jet in transit to ") + dest.name[ar ? "ar" : "en"] + " (" + dest.code + ")...</span>";
      }

      setTimeout(function () {
        state.transitBusy = false;
        state.activeCityId = dest.id;
        state.playerCash = Math.max(0, state.playerCash - dest.fare);
        try { localStorage.setItem("zone_world_city", dest.id); } catch (_) {}

        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "ZONE_WORLD_TRAVEL",
            action: "fly",
            cityId: dest.id,
            cityCode: dest.code,
            cityName: dest.name[ar ? "ar" : "en"],
            fare: dest.fare,
            xpDelta: 35
          }, window.location.origin);
        }

        applyAtmosphere(true);
        renderChronoHud();
        openWorldCitiesModal();
      }, 1050);
    }

    function applyAtmosphere(force) {
      var phaseKey = computeDesiredPhase();
      var cfg = TIME_PHASES[phaseKey] || TIME_PHASES.day;

      document.body.dataset.timePhase = phaseKey;
      document.body.dataset.zmxLight = cfg.isLightUi ? "1" : "0";

      if (!isMapStyleReady()) return;
      if (!force && phaseKey === state.activePhase) return;
      state.activePhase = phaseKey;

      try { map.setFog(cfg.fog); } catch (_) {}
      try {
        if (map.setLights) {
          map.setLights([
            { id: "zone-ambient", type: "ambient", properties: { color: cfg.ambient.color, intensity: cfg.ambient.intensity } },
            { id: "zone-sun", type: "directional", properties: { color: cfg.sun.color, intensity: cfg.sun.intensity, direction: cfg.sun.direction, "cast-shadows": false } }
          ]);
        } else if (map.setLight) {
          map.setLight({ anchor: "viewport", color: cfg.sun.color, intensity: cfg.sun.intensity, position: [1.3, cfg.sun.direction[0], cfg.sun.direction[1]] });
        }
      } catch (_) {}

      var setPaint = function (layerId, prop, val) {
        if (map.getLayer(layerId)) {
          try { map.setPaintProperty(layerId, prop, val); } catch (_) {}
        }
      };

      setPaint("background", "background-color", cfg.land);
      setPaint("district-land", "fill-color", ["match", ["get", "class"], "park", cfg.park, "pitch", cfg.pitch, "industrial", cfg.landInd, cfg.land]);
      setPaint("district-land", "fill-opacity", 0.92);
      setPaint("district-water", "fill-color", cfg.water);
      setPaint("metro-ocean-mask", "fill-color", cfg.water);
      setPaint("metro-land-sectors", "fill-color", cfg.land);
      setPaint("metro-land-tint", "fill-opacity", cfg.isLightUi ? 0.06 : 0.10);
      setPaint("metro-coastline-rim", "line-color", cfg.isLightUi ? "#8e7f67" : "#385572");
      setPaint("metro-bay-water", "fill-color", cfg.water);
      setPaint("metro-shallows", "fill-color", cfg.shallows);
      setPaint("metro-shallows", "fill-opacity", cfg.isLightUi ? 0.22 : 0.16);
      setPaint("metro-beaches", "fill-color", cfg.beach);
      setPaint("metro-parks", "fill-color", ["case", ["==", ["get", "kind"], "pitch"], cfg.pitch, cfg.park]);
      setPaint("district-waterway", "line-color", cfg.water);

      setPaint("metro-runway", "fill-color", ["case", ["==", ["get", "kind"], "pier"], cfg.pier, cfg.asphalt]);
      setPaint("metro-runway", "fill-outline-color", ["case", ["==", ["get", "kind"], "pier"], cfg.roadCase, cfg.isLightUi ? "#64748b" : "#38bdf8"]);

      setPaint("district-road-casing", "line-color", cfg.roadCase);
      setPaint("district-roads", "line-color", ["match", ["get", "class"], ["motorway", "trunk"], cfg.roadMain, ["primary", "secondary"], cfg.road, cfg.road]);
      setPaint("metro-arterials-casing", "line-color", cfg.roadCase);
      setPaint("metro-arterials", "line-color", cfg.roadMain);
      setPaint("metro-arterials-center", "line-color", cfg.roadCenter);

      setPaint("metro-trees-3d", "fill-extrusion-color", ["match", ["to-number", ["get", "tone"], 1], 0, cfg.tree[0], 1, cfg.tree[1], cfg.tree[2]]);

      setPaint("district-buildings", "fill-color", cfg.bldg[0]);
      setPaint("district-buildings", "fill-outline-color", cfg.roadCase);

      var hExpr = ["max", 0, ["to-number", ["get", "height"], 0]];
      var heightGrad = ["interpolate", ["linear"], hExpr, 0, cfg.bldg[0], 24, cfg.bldg[1], 75, cfg.bldg[2]];
      setPaint("district-buildings-3d", "fill-extrusion-color", heightGrad);
      setPaint("district-complete-volumes", "fill-extrusion-color", heightGrad);
      if (map.getLayer("district-buildings-3d") && map.setLayoutProperty) {
        try { map.setLayoutProperty("district-buildings-3d", "visibility", "visible"); } catch (_) {}
      }

      setPaint("district-skyline-3d", "fill-extrusion-color", ["match", ["to-string", ["get", "tone"]], "#162234", cfg.bldg[0], "#1c2b42", cfg.bldg[1], cfg.bldg[2]]);
      setPaint("metro-outer-skyline-3d", "fill-extrusion-color", [
        "case",
        ["!=", ["coalesce", ["get", "accent"], ""], ""],
        ["get", "accent"],
        ["match", ["to-number", ["get", "tone"], 1], 0, cfg.bldg[0], 1, cfg.bldg[1], cfg.bldg[2]]
      ]);

      setPaint("sector-lock-fill", "fill-color", cfg.lockFill);
      setPaint("sector-lock-fill", "fill-opacity", cfg.lockOpacity);
      setPaint("sector-lock-border", "line-color", cfg.isLightUi ? "#475569" : "#94a3b8");
      setPaint("sector-lock-border", "line-opacity", 0.30);

      /* Refresh living traffic/ferry/beacon colors immediately for day vs dusk/night */
      try {
        var livingSrc = map.getSource("metro-living-src");
        if (livingSrc) livingSrc.setData(buildLivingGeo(state.livingTick));
      } catch (_) {}

      /* Keep Three.js architectural window/roof custom layers VISIBLE in BOTH Day and Night,
         feeding the live daylight blend factor so buildings always show real windows, mullions & crowns! */
      var daylightFactor = phaseKey === "day" || phaseKey === "afternoon" ? 1.0 : phaseKey === "dawn" ? 0.78 : phaseKey === "dusk" ? 0.25 : 0.0;
      if (typeof window !== "undefined") {
        window.__zoneMapAtmosphere = { phase: phaseKey, isLightUi: !!cfg.isLightUi, daylight: daylightFactor };
      }
      try {
        var allLayers = (map.getStyle && map.getStyle() && map.getStyle().layers) || [];
        allLayers.forEach(function (ly) {
          if (ly && ly.type === "custom" && map.setLayoutProperty) {
            try { map.setLayoutProperty(ly.id, "visibility", "visible"); } catch (_) {}
          }
        });
        if (map.triggerRepaint) map.triggerRepaint();
      } catch (_) {}

      var textCol = cfg.isLightUi ? "#1e1b18" : "#f8fafc";
      var haloCol = cfg.isLightUi ? "rgba(250,244,230,0.96)" : "rgba(4,8,15,0.96)";
      ["zone-poi-icon", "zone-poi-icon-service", "zone-poi-icon-detail", "metro-poi-icon", "district-road-labels"].forEach(function (lid) {
        setPaint(lid, "text-color", textCol);
        setPaint(lid, "text-halo-color", haloCol);
      });
      syncZmxReadyDataset();
    }

    function onMapReadyPass() {
      state.styleReadyLatch = true;
      installMetroLayers();
      widenMetroBounds();
      ensureInitialMetroFraming();
      applyAtmosphere(true);
    }

    function onRender(data) {
      if (!data) return;
      state.lastData = data;
      if (data.lang) state.lang = data.lang === "ar" ? "ar" : "en";
      var nextDark = data.dark !== false;
      if (state.lastThemeDark !== nextDark) {
        state.lastThemeDark = nextDark;
        state.dark = nextDark;
      }
      if (Number.isFinite(Number(data.playerLevel)) && Number(data.playerLevel) >= 1) {
        state.playerLevel = Math.floor(Number(data.playerLevel));
      }
      if (Number.isFinite(Number(data.playerXp))) state.playerXp = Number(data.playerXp);
      if (Number.isFinite(Number(data.playerCash))) state.playerCash = Number(data.playerCash);
      if (typeof data.currentCityId === "string" && WORLD_CITIES.some(function (c) { return c.id === data.currentCityId; })) {
        state.activeCityId = data.currentCityId;
      }

      installMetroLayers();
      widenMetroBounds();

      try {
        var lockSrc = map.getSource("sector-locks-src");
        if (lockSrc) lockSrc.setData(buildSectorLocksGeo());
        var poiSrc = map.getSource("metro-pois-src");
        if (poiSrc) poiSrc.setData(buildMetroPoiGeo());
      } catch (_) {}

      syncGateMarkers();
      applyAtmosphere(true);
      renderChronoHud();
    }

    injectStyles();
    buildChronoHud();
    /* Pre-seed sculpted outer architectural polygons immediately so district-surfaces111 wraps ALL 5 sectors on its very first pass */
    try { buildOuterSkylineGeo(); } catch (_) {}
    if (isMapStyleReady()) onMapReadyPass();
    map.on("style.load", onMapReadyPass);
    map.on("load", onMapReadyPass);
    map.on("idle", function () {
      if (!map.getLayer("metro-poi-icon") || !map.getLayer("metro-outer-skyline-3d")) {
        installMetroLayers();
      }
      widenMetroBounds();
      ensureInitialMetroFraming();
      applyAtmosphere(false);
    });
    map.on("resize", function () {
      setTimeout(widenMetroBounds, 30);
    });

    window.addEventListener("message", function (ev) {
      if (ev.origin !== window.location.origin || !ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "ZONE_RENDER_PAUSE" || ev.data.zonePauseRender !== undefined) {
        state.hostPaused = Boolean(ev.data.zonePauseRender);
        if (!state.hostPaused) {
          tickClock();
          tickLivingCity();
        }
        return;
      }
      if (ev.data.type === "ZONE_OPEN_WORLD_CITIES") {
        openWorldCitiesModal();
      } else if (ev.data.type === "ZONE_SYNC_WORLD_CITY" && ev.data.cityId) {
        state.activeCityId = ev.data.cityId;
        try { localStorage.setItem("zone_world_city", ev.data.cityId); } catch (_) {}
        applyAtmosphere(true);
        renderChronoHud();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !state.hostPaused) {
        tickClock();
        tickLivingCity();
      }
    });

    window.addEventListener("pagehide", function () {
      if (state.clockTimer) { clearInterval(state.clockTimer); state.clockTimer = null; }
      if (state.livingTimer) { clearInterval(state.livingTimer); state.livingTimer = null; }
    });

    state.clockTimer = setInterval(tickClock, 1000);
    if (!state.reducedMotion) {
      state.livingTimer = setInterval(tickLivingCity, 85);
    }

    return {
      onRender: onRender,
      openWorldCitiesModal: openWorldCitiesModal,
      applyAtmosphere: applyAtmosphere
    };
  }

  var expansionApi = {
    version: "139.0",
    WORLD_CITIES: WORLD_CITIES,
    EXTRA_ICONS: EXTRA_ICONS,
    init: function (ctx) {
      if (typeof WebGLRenderingContext === "undefined") return null;
      if (!root.__zoneMapExpansionInstance) {
        root.__zoneMapExpansionInstance = createExpansionController(ctx);
      }
      return root.__zoneMapExpansionInstance;
    },
    onRender: function (data) {
      if (root.__zoneMapExpansionInstance) {
        root.__zoneMapExpansionInstance.onRender(data);
      }
    }
  };
  root.__zoneMapExpansionVersion = 139;
  try {
    Object.defineProperty(root, "ZoneMapExpansion", {
      value: expansionApi,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (_) {
    root.ZoneMapExpansion = expansionApi;
  }
})(typeof window !== "undefined" ? window : globalThis);

/* ZONE v127 - Expanded 3D Metropolis, Demand-Throttled Live Clock,
   Atmospheric Hairline Sectors, Torn-Style Color Jewel Pins & Global World Flights */
(function (root) {
  "use strict";

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
        '<g class="zmx-sun-rays" stroke="#fde047" stroke-width="1.9" stroke-linecap="round">' +
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
        '<path d="M8.2 11V7.7C8.2 5.6 9.9 3.9 12 3.9C14.1 3.9 15.8 5.6 15.8 7.7V11" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/>' +
        '<rect x="5" y="10.6" width="14" height="10.4" rx="2.8" fill="url(#zmx-g-lock)"/>' +
        '<circle cx="12" cy="15.4" r="1.45" fill="#ffffff"/>' +
      '</svg>',
    unlock:
      '<svg class="zmx-svg-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<defs><linearGradient id="zmx-g-unlock" x1="5" y1="10" x2="19" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
        '<path d="M8.2 11V7.5C8.2 5.4 9.9 3.7 12 3.7C13.8 3.7 15.2 4.8 15.7 6.4" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round"/>' +
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
      fog: { color: "#e5bfd1", "high-color": "#5876a8", "space-color": "#263659", "horizon-blend": 0.12, range: [1.5, 14], "star-intensity": 0.05 },
      ambient: { color: "#eeddf6", intensity: 0.72 },
      sun: { color: "#ffb88c", intensity: 0.85, direction: [96, 28] },
      land: "#dcd2dd",
      landInd: "#cec3d0",
      water: "#467fa3",
      park: "#6c9c78",
      roadMain: "#f5edf7",
      road: "#b0a4b5",
      roadCase: "#7c7282",
      bldg: ["#b9b2c4", "#cbc4d6", "#e4dce9"],
      lockFill: "#0f172a",
      lockOpacity: 0.10,
      isLightUi: true
    },
    day: {
      id: "day",
      icon: ZMX_SVGS.day,
      label: { en: "Day", ar: "النهار" },
      fog: { color: "#e6f2fc", "high-color": "#7ec0f6", "space-color": "#4ea1e8", "horizon-blend": 0.1, range: [1.8, 15], "star-intensity": 0 },
      ambient: { color: "#eef4fa", intensity: 0.58 },
      sun: { color: "#fff6e0", intensity: 0.86, direction: [148, 52] },
      land: "#ebe4d4",
      landInd: "#dfd6c3",
      water: "#3ba3cc",
      park: "#77b970",
      roadMain: "#ffffff",
      road: "#cfc6b4",
      roadCase: "#9e9481",
      bldg: ["#b8c2cf", "#cfd6df", "#e6e2d8"],
      lockFill: "#0f172a",
      lockOpacity: 0.10,
      isLightUi: true
    },
    afternoon: {
      id: "afternoon",
      icon: ZMX_SVGS.afternoon,
      label: { en: "Afternoon", ar: "العصر" },
      fog: { color: "#f3dec0", "high-color": "#74a6d4", "space-color": "#437ab0", "horizon-blend": 0.12, range: [1.6, 14.5], "star-intensity": 0 },
      ambient: { color: "#f8e8ce", intensity: 0.56 },
      sun: { color: "#ffc978", intensity: 0.88, direction: [232, 38] },
      land: "#e4d5be",
      landInd: "#d6c5ab",
      water: "#3289ab",
      park: "#6ca664",
      roadMain: "#fbf1df",
      road: "#bfb19a",
      roadCase: "#8d806b",
      bldg: ["#b9a790", "#d1bfa7", "#e6d5be"],
      lockFill: "#0f172a",
      lockOpacity: 0.10,
      isLightUi: true
    },
    dusk: {
      id: "dusk",
      icon: ZMX_SVGS.dusk,
      label: { en: "Dusk", ar: "الغسق" },
      fog: { color: "#683c5d", "high-color": "#233056", "space-color": "#0e152b", "horizon-blend": 0.11, range: [1.4, 13.5], "star-intensity": 0.25 },
      ambient: { color: "#9ba9d6", intensity: 0.58 },
      sun: { color: "#ff8c59", intensity: 0.86, direction: [268, 21] },
      land: "#25293b",
      landInd: "#1e2233",
      water: "#1a3956",
      park: "#263e37",
      roadMain: "#636b87",
      road: "#3f465e",
      roadCase: "#202536",
      bldg: ["#3b455e", "#4f5c7a", "#687799"],
      lockFill: "#090d16",
      lockOpacity: 0.12,
      isLightUi: false
    },
    night: {
      id: "night",
      icon: ZMX_SVGS.night,
      label: { en: "Night", ar: "الليل" },
      fog: { color: "#0e182c", "high-color": "#080e1d", "space-color": "#040710", "horizon-blend": 0.08, range: [1.4, 13.5], "star-intensity": 0.55 },
      ambient: { color: "#a5c0e5", intensity: 0.58 },
      sun: { color: "#ffe5bd", intensity: 0.72, direction: [210, 38] },
      land: "#0f1522",
      landInd: "#0c111c",
      water: "#081b2e",
      park: "#122621",
      roadMain: "#384963",
      road: "#243044",
      roadCase: "#111724",
      bldg: ["#1c283d", "#283956", "#364d73"],
      lockFill: "#060a12",
      lockOpacity: 0.12,
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
      metroInstalled: false,
      didMetroFrame: false,
      styleReadyLatch: false,
      hostPaused: false
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

    var SECTORS = [
      {
        id: "sector-core",
        minLevel: 1,
        color: "#39e7a3",
        anchor: pt(0.0002, 0.0002),
        gatePos: pt(-0.0002, 0.0031),
        bounds: [-0.0044, -0.0031, 0.0044, 0.0031],
        name: { en: "Central Starter Turf", ar: "القطاع المركزي الأساسي" },
        desc: { en: "Downtown core, Safehouse, Ironworks Gym, Hospital, Missions & Charter Heliport.", ar: "قلب المدينة، المخبأ، النادي، المستشفى، المهمات، ومهبط الطيران." },
        unlocks: { en: ["Safehouse & Armory", "Ironworks Gym & Back Alley", "Charter Flight Terminal (World Cities)"], ar: ["المخبأ ومخزن السلاح", "النادي الرياضي والأزقة", "محطة رحلات مدن العالم"] }
      },
      {
        id: "sector-neon",
        minLevel: 3,
        color: "#c084fc",
        anchor: pt(-0.0079, 0.0012),
        gatePos: pt(-0.0078, 0.0029),
        bounds: [-0.0114, -0.0022, -0.0047, 0.0052],
        name: { en: "West Neon & Casino Strip", ar: "شارع النيون والكازينو الغربي" },
        desc: { en: "High-roller Velvet Casino, Nightclubs, Cyber Arcade, Underground Fight Pit & Biotech Campus.", ar: "كازينو النخبة، الملاهي الليلية، صالة الأركيد، حلبة القتال السرية والجامعة." },
        unlocks: { en: ["Velvet VIP Casino & Mirage Club", "Underground Fight Club & Pro Boxing", "Biotech University & Cyber Arcade"], ar: ["كازينو المخمل ونادي السراب", "حلبة القتال السرية والملاكمة", "جامعة التكنولوجيا وصالة الأركيد"] }
      },
      {
        id: "sector-harbor",
        minLevel: 5,
        color: "#f97316",
        anchor: pt(-0.0068, -0.0056),
        gatePos: pt(-0.0068, -0.0052),
        bounds: [-0.0114, -0.0080, 0.0018, -0.0034],
        northBounds: [-0.0044, 0.0034, 0.0046, 0.0078],
        name: { en: "Smuggler Docks & North Speedway", ar: "مرافئ التهريب وحلبة السباق الشمالية" },
        desc: { en: "Deepwater container docks, contraband piers, Chop Shop customs, Coliseum Stadium & Motor Speedway.", ar: "أرصفة الحاويات العميقة، مرسى المهربين، ورشة التعديل، الاستاد وحلبة السباق." },
        unlocks: { en: ["Deepwater Container Port & Smuggler Berth", "Nitro Motor Speedway & Coliseum Stadium", "Chop Shop Customs & Arms Depot"], ar: ["ميناء الحاويات ومرسى التهريب", "حلبة نيترو واستاد الكولوسيوم", "ورشة التعديل ومستودع التسليح"] }
      },
      {
        id: "sector-citadel",
        minLevel: 10,
        color: "#eab308",
        anchor: pt(0.0080, 0.0018),
        gatePos: pt(0.0079, 0.0028),
        bounds: [0.0047, -0.0018, 0.0115, 0.0066],
        name: { en: "East Sovereign Financial Citadel", ar: "القلعة المالية السيادية الشرقية" },
        desc: { en: "Skyscraper banking district, Global Stock & FX Exchange, Crypto Dark-Pool, Diamond Bourse & Courthouse.", ar: "حي الأبراج المصرفية، البورصة العالمية، خزنة الكريبتو، بورصة الألماس والمحكمة." },
        unlocks: { en: ["Stock & FX Exchange + Crypto Vault", "Diamond Jeweler & High-Roller Auction", "Executive Syndicate Tower & Courthouse"], ar: ["البورصة وخزنة العملات المشفرة", "بورصة الألماس ومزاد النخبة", "برج النقابة التنفيذي والمحكمة"] }
      },
      {
        id: "sector-airport",
        minLevel: 15,
        color: "#38bdf8",
        anchor: pt(0.0078, -0.0056),
        gatePos: pt(0.0076, -0.0050),
        bounds: [0.0022, -0.0082, 0.0118, -0.0021],
        name: { en: "Zone Int'l Airport & VIP Marina Island", ar: "مطار الزون الدولي وجزيرة اليخوت" },
        desc: { en: "Private jet runway, International Terminal, Superyacht Marina & Sovereign Island Penthouses.", ar: "مدرج الطائرات الخاصة، صالة المطار الدولي، مرسى اليخوت، وبنتهاوس الجزيرة." },
        unlocks: { en: ["Zone International Jet Terminal", "Superyacht Marina & Offshore Vault", "Sovereign Penthouse Island"], ar: ["مطار الزون للطائرات الخاصة", "مرسى اليخوت الفاخرة والخزنة البحرية", "جزيرة البنتهاوس السيادية"] }
      }
    ];

    var METRO_POIS = [
      /* Core Sector Lv.1 - Spread cleanly across Central Turf */
      { id: "charter_heli", sector: "sector-core", minLevel: 1, icon: "heliport", color: "#38bdf8", dx: 0.0028, dy: 0.0021, screen: "__world_travel__", name: { en: "World Charter Heliport", ar: "مهبط رحلات العالم" }, cat: { en: "Global Transit", ar: "السفر العالمي" } },
      { id: "metro_central", sector: "sector-core", minLevel: 1, icon: "subway", color: "#38bdf8", dx: -0.0029, dy: -0.0003, screen: "city", name: { en: "Central Metro Hub", ar: "محطة المترو المركزية" }, cat: { en: "Transit", ar: "المواصلات" } },
      { id: "pawn_central", sector: "sector-core", minLevel: 1, icon: "pawnshop", color: "#ebb858", dx: 0.0019, dy: -0.0018, screen: "market", name: { en: "Gold & Pawn Brokers", ar: "متجر الرهن والذهب" }, cat: { en: "Trade", ar: "التجارة" } },
      { id: "street_pharmacy", sector: "sector-core", minLevel: 1, icon: "pharmacy", color: "#fb7185", dx: -0.0011, dy: 0.0018, screen: "items", name: { en: "Night Owl Med-Supply", ar: "صيدلية الإمداد الليلي" }, cat: { en: "Medical", ar: "إمدادات طبية" } },
      { id: "precinct_one", sector: "sector-core", minLevel: 1, icon: "police", color: "#f87171", dx: 0.0033, dy: -0.0007, screen: "jail", name: { en: "Central Police Precinct", ar: "مديرية الشرطة المركزية" }, cat: { en: "Law & Custody", ar: "الأمن والاحتجاز" } },
      { id: "gun_armory", sector: "sector-core", minLevel: 1, icon: "chopshop", color: "#f59e0b", dx: -0.0033, dy: -0.0020, screen: "items", name: { en: "Big Al's Tactical Armory", ar: "ترسانة السلاح التكتيكي" }, cat: { en: "Armory", ar: "التسليح" } },

      /* Sector 2: West Neon & Casino Strip (Lv.3) */
      { id: "velvet_vip", sector: "sector-neon", minLevel: 3, icon: "velvet", color: "#ebb858", dx: -0.0064, dy: 0.0006, screen: "casino", name: { en: "Velvet Underground VIP", ar: "كازينو المخمل لكبار الشخصيات" }, cat: { en: "High Stakes", ar: "رهانات كبرى" } },
      { id: "neon_mirage", sector: "sector-neon", minLevel: 3, icon: "nightclub", color: "#e879f9", dx: -0.0086, dy: 0.0020, screen: "casino", name: { en: "Club Mirage Lounge", ar: "نادي السراب الليلي" }, cat: { en: "Nightlife", ar: "الحياة الليلية" } },
      { id: "pit_fightclub", sector: "sector-neon", minLevel: 3, icon: "fightclub", color: "#ef4444", dx: -0.0098, dy: -0.0006, screen: "attack", name: { en: "Bloodsport Fight Pit", ar: "حلبة القتال السرية" }, cat: { en: "Combat Pit", ar: "قتال الشوارع" } },
      { id: "cyber_arcade", sector: "sector-neon", minLevel: 3, icon: "arcade", color: "#39e7a3", dx: -0.0060, dy: 0.0038, screen: "home", name: { en: "Neon Pulse Arcade", ar: "صالة أركيد النيون" }, cat: { en: "Instant Games", ar: "ألعاب فورية" } },
      { id: "noir_cinema", sector: "sector-neon", minLevel: 3, icon: "cinema", color: "#c084fc", dx: -0.0080, dy: -0.0015, screen: "newspaper", name: { en: "Grand Noir Theater", ar: "مسرح وسينما نوار" }, cat: { en: "Entertainment", ar: "ترفيه" } },
      { id: "pro_boxing", sector: "sector-neon", minLevel: 3, icon: "boxinggym", color: "#38bdf8", dx: -0.0104, dy: 0.0015, screen: "gym", name: { en: "Kronk Championship Gym", ar: "نادي أبطال الملاكمة" }, cat: { en: "Training", ar: "تدريب القوة" } },
      { id: "biotech_uni", sector: "sector-neon", minLevel: 3, icon: "university", color: "#60a5fa", dx: -0.0095, dy: 0.0042, screen: "education", name: { en: "Zone Biotech University", ar: "جامعة الزون للتقنية الحيوية" }, cat: { en: "Academy", ar: "التعليم الأكاديمي" } },

      /* Sector 3: Smuggler Docks & North Speedway (Lv.5) */
      { id: "nitro_speedway", sector: "sector-harbor", minLevel: 5, icon: "racetrack", color: "#f97316", dx: -0.0016, dy: 0.0058, screen: "home", name: { en: "Nitro Motor Speedway", ar: "حلبة نيترو لسباقات السرعة" }, cat: { en: "Street Racing", ar: "سباقات الشوارع" } },
      { id: "grand_stadium", sector: "sector-harbor", minLevel: 5, icon: "stadium", color: "#eab308", dx: 0.0024, dy: 0.0056, screen: "hof", name: { en: "Zone Coliseum Arena", ar: "استاد الكولوسيوم الكبير" }, cat: { en: "Championships", ar: "البطولات" } },
      { id: "pirate_radio", sector: "sector-harbor", minLevel: 5, icon: "radio", color: "#38bdf8", dx: -0.0038, dy: 0.0046, screen: "newspaper", name: { en: "Signal Syndicate Tower", ar: "برج إذاعة النقابة" }, cat: { en: "Intel", ar: "استخبارات" } },
      { id: "custom_chopshop", sector: "sector-harbor", minLevel: 5, icon: "chopshop", color: "#fb923c", dx: -0.0095, dy: -0.0044, screen: "crimes", name: { en: "Redline Chop Shop", ar: "ورشة تفكيك وتعديل السيارات" }, cat: { en: "Black Market", ar: "سوق سوداء" } },
      { id: "container_docks", sector: "sector-harbor", minLevel: 5, icon: "docks", color: "#38bdf8", dx: -0.0082, dy: -0.0068, screen: "crimes", name: { en: "Deepwater Container Port", ar: "ميناء الحاويات العميقة" }, cat: { en: "Cargo Heists", ar: "عمليات الميناء" } },
      { id: "smuggler_berth", sector: "sector-harbor", minLevel: 5, icon: "smuggler", color: "#f43f5e", dx: -0.0044, dy: -0.0066, screen: "market", name: { en: "Smuggler's Cove Pier 9", ar: "رصيف المهربين رقم 9" }, cat: { en: "Contraband", ar: "تهريب البضائع" } },
      { id: "harbor_trauma", sector: "sector-harbor", minLevel: 5, icon: "clinic", color: "#ef4444", dx: -0.0012, dy: -0.0046, screen: "hospital", name: { en: "Back-Alley Trauma Dock", ar: "عيادة جراحة الميناء" }, cat: { en: "Underground Med", ar: "طب سري" } },

      /* Sector 4: East Sovereign Financial Citadel (Lv.10) */
      { id: "sovereign_exchange", sector: "sector-citadel", minLevel: 10, icon: "exchange", color: "#eab308", dx: 0.0064, dy: 0.0016, screen: "bank", name: { en: "Sovereign Stock & FX Bourse", ar: "بورصة الأسهم والعملات" }, cat: { en: "High Finance", ar: "المال والأعمال" } },
      { id: "crypto_vault", sector: "sector-citadel", minLevel: 10, icon: "crypto", color: "#39e7a3", dx: 0.0098, dy: 0.0038, screen: "bank", name: { en: "Zero-Knowledge Crypto Vault", ar: "خزنة العملات المشفرة" }, cat: { en: "Dark Pool", ar: "خزائن رقمية" } },
      { id: "diamond_bourse", sector: "sector-citadel", minLevel: 10, icon: "jeweler", color: "#67e8f9", dx: 0.0068, dy: -0.0006, screen: "market", name: { en: "Imperial Diamond Exchange", ar: "بورصة الألماس الإمبراطورية" }, cat: { en: "Luxury Jewels", ar: "مجوهرات فاخرة" } },
      { id: "syndicate_auction", sector: "sector-citadel", minLevel: 10, icon: "auction", color: "#f59e0b", dx: 0.0101, dy: 0.0008, screen: "market", name: { en: "Black-Tie Auction House", ar: "دار مزادات النخبة" }, cat: { en: "Rare Assets", ar: "مقتنيات نادرة" } },
      { id: "supreme_court", sector: "sector-citadel", minLevel: 10, icon: "courthouse", color: "#cbd5e1", dx: 0.0062, dy: 0.0052, screen: "jail", name: { en: "Federal High Courthouse", ar: "المحكمة العليا الفيدرالية" }, cat: { en: "Tribunal", ar: "القضاء" } },
      { id: "corp_citadel", sector: "sector-citadel", minLevel: 10, icon: "corptower", color: "#818cf8", dx: 0.0102, dy: 0.0054, screen: "jobs", name: { en: "Apex Conglomerate Tower", ar: "برج الشركات السيادي" }, cat: { en: "Executive Ops", ar: "إدارة الشركات" } },

      /* Sector 5: Zone Int'l Airport & VIP Marina Island (Lv.15) */
      { id: "intl_airport", sector: "sector-airport", minLevel: 15, icon: "airport", color: "#38bdf8", dx: 0.0091, dy: -0.0061, screen: "__world_travel__", name: { en: "Zone International Airport", ar: "مطار الزون الدولي" }, cat: { en: "Global Flights", ar: "الرحلات الدولية" } },
      { id: "vip_marina", sector: "sector-airport", minLevel: 15, icon: "marina", color: "#39e7a3", dx: 0.0042, dy: -0.0064, screen: "properties", name: { en: "Emerald Superyacht Marina", ar: "مرسى اليخوت الزمردي" }, cat: { en: "VIP Fleet", ar: "أسطول اليخوت" } },
      { id: "island_penthouse", sector: "sector-airport", minLevel: 15, icon: "penthouse", color: "#facc15", dx: 0.0055, dy: -0.0036, screen: "properties", name: { en: "Sovereign Sky Penthouses", ar: "أبراج البنتهاوس الملكية" }, cat: { en: "Estates", ar: "عقارات فاخرة" } },
      { id: "exec_jet_pad", sector: "sector-airport", minLevel: 15, icon: "heliport", color: "#f472b6", dx: 0.0108, dy: -0.0034, screen: "__world_travel__", name: { en: "Diplomatic Jet Hangar", ar: "حظيرة الطائرات الدبلوماسية" }, cat: { en: "Private Charter", ar: "طيران خاص" } }
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
        ".zmx-chrono-bar{position:absolute;top:10px;right:50px;left:auto;width:fit-content;transform:none;z-index:18;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:rgba(9,13,22,0.84);border:1px solid rgba(255,255,255,0.08);box-shadow:0 12px 32px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.08);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#f8fafc;font:600 10px/1.2 Rubik,system-ui,sans-serif;max-width:calc(100% - 260px);flex-wrap:nowrap;white-space:nowrap;justify-content:flex-end}",
        "[dir='rtl'] .zmx-chrono-bar{right:auto;left:10px;justify-content:flex-start}",
        "body[data-zmx-light='1'] .zmx-chrono-bar{background:rgba(11,16,27,0.86);border-color:rgba(255,255,255,0.12);color:#f8fafc;box-shadow:0 12px 32px rgba(15,23,42,0.34),inset 0 1px 0 rgba(255,255,255,0.10)}",
        "body[data-zmx-light='1'] .mgrade{background:radial-gradient(ellipse 75% 60% at 50% 35%,rgba(255,248,220,0.16) 0%,rgba(255,248,220,0) 68%)!important}",
        ".zmx-clock-box{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.06);border:0;font-variant-numeric:tabular-nums}",
        ".zmx-city-tag{font-weight:800;color:#38bdf8;letter-spacing:0.04em;font-size:10.5px}",
        ".zmx-clock-digits{font-weight:800;font-size:11.5px;color:#49f0a1;letter-spacing:0.03em}",
        ".zmx-phase-badge{display:inline-flex;align-items:center;gap:4px;font-weight:700;font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.06);color:#f1f5f9;border:0}",
        ".zmx-sun-rays{transform-origin:12px 12px;transition:transform .24s cubic-bezier(.22,1,.36,1)}",
        ".zmx-phase-badge:hover .zmx-sun-rays{transform:rotate(24deg)}",
        ".zmx-ico-jet{transition:transform .2s cubic-bezier(.22,1,.36,1)}",
        ".zmx-pills{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:rgba(255,255,255,0.04)}",
        ".zmx-pill{background:transparent;border:0;color:#cbd5e1;border-radius:999px;padding:3px 7px;font:700 10px/1.1 inherit;cursor:pointer;transition:background-color .16s ease,color .16s ease,transform .16s ease}",
        ".zmx-pill:hover{background:rgba(255,255,255,0.08);color:#fff}",
        ".zmx-pill.active{background:linear-gradient(180deg,#38bdf8,#0284c7);color:#04131d;font-weight:800}",
        ".zmx-world-btn{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(180deg,#10b981,#059669);color:#04131d;border:0;border-radius:999px;padding:4px 10px;font:800 10px/1.1 inherit;letter-spacing:0.01em;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.28);transition:transform .16s ease,opacity .16s ease}",
        ".zmx-world-btn:hover{transform:translateY(-1px)}",
        ".zmx-world-btn:hover .zmx-ico-jet{transform:translate(1.5px,-1.5px) scale(1.08)}",
        ".zmx-lv-pill{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:999px;background:rgba(57,231,163,0.14);border:0;color:#6ef7c0;font-weight:800;font-size:10px}",
        ".zmx-gate-marker{display:inline-flex;align-items:center;gap:4px;padding:3.5px 8px;border-radius:999px;font:700 9.5px/1.1 Rubik,system-ui,sans-serif;letter-spacing:0.01em;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,0.58);border:1px solid rgba(255,255,255,0.14);background:rgba(9,13,22,0.88);backdrop-filter:blur(6px);color:#e2e8f0;white-space:nowrap;transition:transform .16s ease,background-color .16s ease}",
        ".zmx-gate-marker:hover{transform:scale(1.05);background:rgba(15,23,42,0.95)}",
        ".zmx-gate-marker.unlocked{border-color:rgba(56,189,248,0.42);color:#bae6fd;background:rgba(8,20,32,0.88)}",
        ".zmx-poi-hover{position:absolute;z-index:22;pointer-events:none;padding:5px 10px;border-radius:8px;background:rgba(8,12,20,0.92);border:1px solid rgba(255,255,255,0.12);box-shadow:0 10px 24px rgba(0,0,0,0.62);color:#f8fafc;font:700 11px/1.2 Rubik,system-ui,sans-serif;white-space:nowrap;transform:translate(-50%,14px);transition:opacity .12s ease}",
        ".zmx-poi-hover[hidden]{display:none!important}",
        ".zmx-modal-backdrop{position:fixed;inset:0;z-index:60;background:rgba(4,7,14,0.76);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:14px}",
        ".zmx-modal-backdrop[hidden]{display:none!important}",
        ".zmx-modal{width:min(760px,100%);max-height:90vh;overflow:auto;border-radius:16px;background:linear-gradient(180deg,#0f172a 0%,#090e18 100%);border:1px solid rgba(255,255,255,0.08);box-shadow:0 28px 64px rgba(0,0,0,0.78);color:#f8fafc;padding:18px;font:500 12.5px/1.45 Rubik,system-ui,sans-serif}",
        "body[data-zmx-light='1'] .zmx-modal{background:linear-gradient(180deg,#ffffff 0%,#f1f5f9 100%);border-color:rgba(15,23,42,0.08);color:#0f172a}",
        ".zmx-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.16)}",
        ".zmx-modal-title{margin:2px 0 0;font-size:17px;font-weight:800;letter-spacing:-0.01em}",
        ".zmx-close{background:rgba(255,255,255,0.07);border:0;color:inherit;border-radius:8px;padding:6px 11px;font:700 11px/1 inherit;cursor:pointer}",
        ".zmx-world-svg{width:100%;height:168px;border-radius:12px;background:radial-gradient(circle at 50% 45%,#13253e 0%,#08111e 85%);border:1px solid rgba(56,189,248,0.22);margin-bottom:12px;display:block}",
        ".zmx-city-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:9px}",
        ".zmx-city-card{border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(15,23,42,0.78);padding:11px;display:flex;flex-direction:column;gap:6px}",
        "body[data-zmx-light='1'] .zmx-city-card{background:#ffffff;border-color:rgba(15,23,42,0.08)}",
        ".zmx-city-card.active{border-color:rgba(57,231,163,0.5);box-shadow:0 0 0 1px rgba(57,231,163,0.25)}",
        ".zmx-city-card.locked{opacity:0.78}",
        ".zmx-cta{background:linear-gradient(180deg,#10b981,#059669);color:#04131d;border:0;border-radius:8px;padding:7px 11px;font:800 11px/1.1 inherit;cursor:pointer;letter-spacing:0.01em}",
        ".zmx-cta:disabled{opacity:0.45;cursor:not-allowed}",
        ".zmx-cta-sec{background:rgba(56,189,248,0.14);color:#7dd3fc;border:0;border-radius:8px;padding:7px 11px;font:700 11px/1.1 inherit;cursor:pointer}",
        "body[data-zmx-light='1'] .zmx-cta-sec{background:#e0f2fe;color:#075985}",
        ".zmx-svg-ico{display:inline-block;width:13px;height:13px;flex:none;vertical-align:-2px}",
        ".zmx-cta,.zmx-cta-sec{display:inline-flex;align-items:center;justify-content:center;gap:5px}",
        ".familyRail{border-bottom:1px solid rgba(255,255,255,0.07)!important;background:rgba(9,13,22,0.94)!important}",
        ".familyRail button.familyStat{min-height:32px!important;padding:3px 10px!important;border-radius:10px!important;border:1px solid rgba(234,179,8,0.22)!important;background:rgba(234,179,8,0.10)!important;display:inline-flex!important;flex-direction:column!important;justify-content:center!important;transition:background-color .16s ease,transform .16s ease}",
        ".familyRail button.familyStat:not(:disabled):hover{background:rgba(234,179,8,0.16)!important;border-color:rgba(234,179,8,0.34)!important;transform:translateY(-1px)}",
        ".familyRail .factionSelectLabel select{min-height:32px!important;padding:4px 10px!important;border-radius:8px!important;border:1px solid rgba(255,255,255,0.08)!important;background:rgba(15,23,42,0.84)!important}",
        ".sideToggle,.cityReset,.mapExpand,.streetView{border-radius:10px!important;border:1px solid rgba(255,255,255,0.10)!important;background:rgba(9,13,22,0.86)!important}",
        "@media (prefers-reduced-motion:reduce){.zmx-sun-rays,.zmx-ico-jet,.zmx-pill,.zmx-world-btn,.zmx-gate-marker,.familyRail button.familyStat{transition:none!important}}",
        "[dir='rtl'] .zmx-chrono-bar,[dir='rtl'] .zmx-chrono-bar *,[dir='rtl'] .zmx-gate-marker,.zmx-modal[dir='rtl'],.zmx-modal[dir='rtl'] *{letter-spacing:0!important}",
        "@media (max-width:1120px){.zmx-pills .zmx-pill[data-phase='dawn'],.zmx-pills .zmx-pill[data-phase='dusk']{display:none}}",
        "@media (max-width:780px){.zmx-chrono-bar,[dir='rtl'] .zmx-chrono-bar{top:50px;left:10px;right:auto;width:fit-content;max-width:calc(100% - 56px);justify-content:flex-start}}"
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
              map.easeTo({ center: CENTER, zoom: 14.32, pitch: 50, bearing: -16, duration: 280, essential: true });
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
          (ar ? "مستوى " : "LV.") + state.playerLevel +
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

        var grad = c.createRadialGradient(10.5, 8.2, 1.2, 12, 12, 11.4);
        grad.addColorStop(0, topStop);
        grad.addColorStop(0.56, midStop);
        grad.addColorStop(1, deepStop);
        c.beginPath();
        c.arc(12, 12, 11.1, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();

        /* Subtle inner contrast core so white vector glyphs pop cleanly on bright gold/cyan jewels */
        c.beginPath();
        c.arc(12, 12, 8.4, 0, Math.PI * 2);
        c.fillStyle = locked ? "rgba(8, 13, 24, 0.34)" : "rgba(6, 10, 20, 0.24)";
        c.fill();

        /* Crisp frosted jewel rim */
        c.beginPath();
        c.arc(12, 12, 11.0, 0, Math.PI * 2);
        c.strokeStyle = locked ? "rgba(226, 232, 240, 0.38)" : "rgba(255, 255, 255, 0.78)";
        c.lineWidth = 1.65;
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

    function buildOuterSkylineGeo() {
      var features = [];
      var idSeq = 1;

      function pushBox(dx, dy, w, h, minZ, maxZ, tone) {
        features.push({
          type: "Feature",
          id: 9000 + (idSeq++),
          properties: { height: maxZ, min_height: minZ || 0, tone: tone || 1 },
          geometry: { type: "Polygon", coordinates: rectPoly(dx - w / 2, dy - h / 2, dx + w / 2, dy + h / 2) }
        });
      }

      /* West Neon & Casino Strip (Lv.3) */
      for (var ny = -0.0018; ny <= 0.0046; ny += 0.0011) {
        for (var nx = -0.0108; nx <= -0.0052; nx += 0.0012) {
          var hNeon = 38 + ((Math.abs(Math.round(nx * 10000)) * 13 + Math.abs(Math.round(ny * 10000)) * 7) % 72);
          pushBox(nx, ny, 0.00072, 0.00062, 0, hNeon, (idSeq % 3));
        }
      }
      pushBox(-0.0064, 0.0006, 0.0011, 0.0009, 0, 138, 2);
      pushBox(-0.0064, 0.0006, 0.0006, 0.0005, 138, 174, 0);

      /* East Sovereign Financial Citadel (Lv.10) - Supertall Skyscraper Cluster */
      for (var ey = -0.0014; ey <= 0.0060; ey += 0.0011) {
        for (var ex = 0.0052; ex <= 0.0109; ex += 0.0012) {
          var hFin = 72 + ((Math.round(ex * 10000) * 19 + Math.round((ey + 0.02) * 10000) * 11) % 140);
          pushBox(ex, ey, 0.00074, 0.00064, 0, hFin, (idSeq % 3));
        }
      }
      pushBox(0.0081, 0.0024, 0.0011, 0.00095, 0, 220, 2);
      pushBox(0.0081, 0.0024, 0.00058, 0.0005, 220, 270, 0);

      /* North Motor Speedway & Grand Coliseum Stadium (Lv.5) */
      for (var sx = -0.0038; sx <= 0.0040; sx += 0.0013) {
        pushBox(sx, 0.0042, 0.0008, 0.0006, 0, 40 + (idSeq % 4) * 12, 1);
        pushBox(sx, 0.0068, 0.00085, 0.0006, 0, 34 + (idSeq % 3) * 14, 0);
      }
      pushBox(0.0024, 0.0056, 0.0018, 0.0013, 0, 50, 2);
      pushBox(-0.0016, 0.0062, 0.0022, 0.00042, 0, 30, 1);
      pushBox(-0.0016, 0.0051, 0.0022, 0.00036, 0, 24, 2);

      /* South-West Deepwater Port, Cranes & Warehouses (Lv.5) */
      for (var wx = -0.0106; wx <= -0.0014; wx += 0.0014) {
        pushBox(wx, -0.0043, 0.00095, 0.00058, 0, 26 + (idSeq % 3) * 10, 0);
        pushBox(wx, -0.0059, 0.00105, 0.00052, 0, 20 + (idSeq % 4) * 9, 1);
      }

      /* South-East Zone International Airport Terminal, Control Tower & VIP Marina Penthouses (Lv.15) */
      pushBox(0.0084, -0.0044, 0.0026, 0.00072, 0, 38, 2);
      pushBox(0.0098, -0.0040, 0.00038, 0.00038, 0, 104, 0);
      pushBox(0.0055, -0.0037, 0.00088, 0.00074, 0, 134, 2);
      pushBox(0.0042, -0.0046, 0.00078, 0.00068, 0, 102, 1);
      pushBox(0.0066, -0.0046, 0.00076, 0.00064, 0, 116, 0);

      return { type: "FeatureCollection", features: features };
    }

    function buildMetroLandAndRoadsGeo() {
      var landFeatures = SECTORS.filter(function (s) { return s.id !== "sector-core"; }).map(function (s, idx) {
        var b = s.bounds;
        return {
          type: "Feature",
          id: 7100 + idx,
          properties: { id: s.id, color: s.color },
          geometry: { type: "Polygon", coordinates: rectPoly(b[0], b[1], b[2], b[3]) }
        };
      });
      landFeatures.push({
        type: "Feature",
        id: 7199,
        properties: { id: "sector-harbor-north", color: "#f97316" },
        geometry: { type: "Polygon", coordinates: rectPoly(-0.0044, 0.0033, 0.0046, 0.0078) }
      });

      var bayWater = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: 7201, properties: {}, geometry: { type: "Polygon", coordinates: rectPoly(-0.0132, -0.0102, 0.0136, -0.0065) } },
          { type: "Feature", id: 7202, properties: {}, geometry: { type: "Polygon", coordinates: rectPoly(0.0115, -0.0102, 0.0140, 0.0084) } }
        ]
      };

      var roads = [
        [pt(-0.0115, 0.0002), pt(0.0115, 0.0002)],
        [pt(-0.0115, 0.0026), pt(0.0115, 0.0026)],
        [pt(-0.0115, -0.0024), pt(0.0115, -0.0024)],
        [pt(-0.0108, -0.0052), pt(0.0112, -0.0052)],
        [pt(-0.0038, 0.0054), pt(0.0042, 0.0054)],
        [pt(0.0000, -0.0074), pt(0.0000, 0.0076)],
        [pt(-0.0045, -0.0074), pt(-0.0045, 0.0074)],
        [pt(0.0045, -0.0074), pt(0.0045, 0.0074)],
        [pt(-0.0082, -0.0070), pt(-0.0082, 0.0050)],
        [pt(0.0082, -0.0070), pt(0.0082, 0.0064)]
      ].map(function (line, rIdx) {
        return { type: "Feature", id: 7300 + rIdx, properties: {}, geometry: { type: "LineString", coordinates: line } };
      });

      var runway = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 7401,
            properties: { kind: "strip" },
            geometry: { type: "Polygon", coordinates: rectPoly(0.0062, -0.0063, 0.0116, -0.0054) }
          }
        ]
      };

      var runwayCenter = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 7402,
            properties: {},
            geometry: { type: "LineString", coordinates: [pt(0.0064, -0.00585), pt(0.0114, -0.00585)] }
          }
        ]
      };

      return {
        land: { type: "FeatureCollection", features: landFeatures },
        water: bayWater,
        roads: { type: "FeatureCollection", features: roads },
        runway: runway,
        runwayCenter: runwayCenter
      };
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

      /* Make core district service & detail POIs visible at city overview zooms too */
      ["zone-poi-icon-service", "zone-poi-service-reservations", "zone-poi-icon-detail", "zone-poi-halo-detail", "zone-poi-hitbox-detail"].forEach(function (lid) {
        if (map.getLayer(lid)) {
          try { map.setLayerZoomRange(lid, 12.8, 20); } catch (_) {}
        }
      });

      var base = buildMetroLandAndRoadsGeo();
      var beforeGround = map.getLayer("district-buildings") ? "district-buildings" : (map.getLayer("zone-blocks-fill") ? "zone-blocks-fill" : undefined);
      var beforeCoins = map.getLayer("zone-poi-underglow") ? "zone-poi-underglow" : undefined;

      safeAddSource("metro-water-src", { type: "geojson", data: base.water });
      safeAddLayer({
        id: "metro-bay-water",
        type: "fill",
        source: "metro-water-src",
        paint: { "fill-color": "#0a1c2e", "fill-opacity": 0.92 }
      }, beforeGround);

      safeAddSource("metro-land-src", { type: "geojson", data: base.land });
      safeAddLayer({
        id: "metro-land-sectors",
        type: "fill",
        source: "metro-land-src",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.1 }
      }, beforeGround);

      safeAddSource("metro-roads-src", { type: "geojson", data: base.roads });
      safeAddLayer({
        id: "metro-arterials-casing",
        type: "line",
        source: "metro-roads-src",
        paint: { "line-color": "#131926", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 16, 8], "line-opacity": 0.9 }
      }, beforeGround);
      safeAddLayer({
        id: "metro-arterials",
        type: "line",
        source: "metro-roads-src",
        paint: { "line-color": "#2b384e", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.8, 16, 4.5], "line-opacity": 0.92 }
      }, beforeGround);

      safeAddSource("metro-runway-src", { type: "geojson", data: base.runway });
      safeAddLayer({
        id: "metro-runway",
        type: "fill",
        source: "metro-runway-src",
        paint: { "fill-color": "#1e293b", "fill-outline-color": "#38bdf8", "fill-opacity": 0.95 }
      }, beforeGround);

      safeAddSource("metro-runway-line-src", { type: "geojson", data: base.runwayCenter });
      safeAddLayer({
        id: "metro-runway-marks",
        type: "line",
        source: "metro-runway-line-src",
        paint: { "line-color": "#f8fafc", "line-width": 2, "line-dasharray": [3, 3], "line-opacity": 0.92 }
      }, beforeGround);

      safeAddSource("metro-skyline-src", { type: "geojson", data: buildOuterSkylineGeo() });
      safeAddLayer({
        id: "metro-outer-skyline-3d",
        type: "fill-extrusion",
        source: "metro-skyline-src",
        paint: {
          "fill-extrusion-color": ["match", ["to-number", ["get", "tone"], 1], 0, "#1e2a3f", 1, "#293954", "#354a6b"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true
        }
      }, beforeCoins);

      safeAddSource("sector-locks-src", { type: "geojson", data: buildSectorLocksGeo() });
      safeAddLayer({
        id: "sector-lock-fill",
        type: "fill",
        source: "sector-locks-src",
        paint: { "fill-color": "#090d16", "fill-opacity": 0.12 }
      }, beforeCoins);
      safeAddLayer({
        id: "sector-lock-border",
        type: "line",
        source: "sector-locks-src",
        paint: { "line-color": "#94a3b8", "line-width": 1.2, "line-dasharray": [4, 3], "line-opacity": 0.32 }
      }, beforeCoins);

      safeAddSource("metro-pois-src", { type: "geojson", data: buildMetroPoiGeo() });
      safeAddLayer({
        id: "metro-poi-underglow",
        type: "circle",
        source: "metro-pois-src",
        paint: {
          "circle-pitch-alignment": "viewport",
          "circle-pitch-scale": "viewport",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 14, 15.5, 19, 18, 25],
          "circle-color": ["case", ["boolean", ["get", "locked"], false], ["get", "color"], "#38bdf8"],
          "circle-blur": 0.85,
          "circle-opacity": ["case", ["boolean", ["get", "locked"], false], 0.14, 0.38]
        }
      });
      safeAddLayer({
        id: "metro-poi-halo",
        type: "circle",
        source: "metro-pois-src",
        paint: {
          "circle-pitch-alignment": "viewport",
          "circle-pitch-scale": "viewport",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 9.5, 15.5, 13, 18, 17],
          "circle-color": "rgba(8, 13, 23, 0.88)",
          "circle-stroke-color": ["get", "strokeColor"],
          "circle-stroke-width": ["case", ["boolean", ["get", "locked"], false], 1.2, 2.1],
          "circle-opacity": 0.96
        }
      });
      safeAddLayer({
        id: "metro-poi-icon",
        type: "symbol",
        source: "metro-pois-src",
        layout: {
          "icon-image": ["get", "iconImage"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.52, 15.2, 0.64, 17, 0.8],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
          "symbol-z-elevate": true,
          "text-field": ["get", "label"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.2, 15.5, 11.5],
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
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.55, 0, 14.95, 1],
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

      try {
        document.body.dataset.zmxReady = JSON.stringify({
          metroIconLayer: !!map.getLayer("metro-poi-icon"),
          skylineLayer: !!map.getLayer("metro-outer-skyline-3d"),
          poiCount: METRO_POIS.length,
          phase: state.activePhase
        });
      } catch (_) {}
    }

    function widenMetroBounds() {
      if (!map) return;
      try {
        map.setMinZoom(13.0);
        map.setMaxBounds([
          [CENTER[0] - 0.026, CENTER[1] - 0.019],
          [CENTER[0] + 0.026, CENTER[1] + 0.019]
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
            zoom: mobile ? 13.82 : 14.36,
            pitch: 50,
            bearing: -16
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
        "sector-neon": { en: "West Neon", ar: "شارع النيون" },
        "sector-harbor": { en: "Smuggler Docks", ar: "مرافئ التهريب" },
        "sector-citadel": { en: "East Citadel", ar: "القلعة المالية" },
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
        ? '<p style="margin:0 0 8px;font-weight:800;color:#ebb858">' +
          (ar ? "الموقع المحدد: " : "Target Venue: ") + clickedPoi.name[ar ? "ar" : "en"] + "</p>"
        : "";

      modalBackdrop.innerHTML =
        '<div class="zmx-modal" dir="' + (ar ? "rtl" : "ltr") + '">' +
          '<div class="zmx-modal-head">' +
            '<div>' +
              '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:' + (unlocked ? "#39e7a3" : "#fbbf24") + '">' +
                (unlocked ? ZMX_SVGS.unlock + '<span>' + (ar ? "قطاع مفتوح للعمليات" : "Sector Clearance Active") + '</span>' : ZMX_SVGS.lock + '<span>' + (ar ? "قطاع مقفل بالمستوى" : "Restricted District") + '</span>') +
              '</div>' +
              '<h3 class="zmx-modal-title">' + sector.name[ar ? "ar" : "en"] + '</h3>' +
            '</div>' +
            '<button type="button" class="zmx-close" id="zmxModalClose">' + (ar ? "إغلاق" : "Close") + '</button>' +
          '</div>' +
          poiLine +
          '<p style="margin:0 0 12px;opacity:0.9">' + sector.desc[ar ? "ar" : "en"] + '</p>' +
          '<div style="padding:10px 12px;border-radius:6px;background:rgba(15,23,42,0.12);border:1px solid rgba(148,163,184,0.32);margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:6px">' +
              '<span>' + (ar ? "المستوى المطلوب: " : "Required Level: ") + "Lv." + sector.minLevel + '</span>' +
              '<span>' + (ar ? "مستواك الحالي: " : "Your Level: ") + "Lv." + state.playerLevel + '</span>' +
            '</div>' +
            '<div style="height:9px;border-radius:4px;background:rgba(0,0,0,0.28);overflow:hidden">' +
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
        map.flyTo({ center: sector.anchor, zoom: 15.35, pitch: 54, bearing: -22, duration: 850, essential: true });
      };
      var expBtn = modalBackdrop.querySelector("#zmxExploreUnlocked");
      if (expBtn) {
        expBtn.onclick = function () {
          modalBackdrop.hidden = true;
          widenMetroBounds();
          map.flyTo({ center: sector.anchor, zoom: 15.6, pitch: 50, bearing: -16, duration: 700, essential: true });
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
      setPaint("district-land", "fill-color", ["match", ["get", "class"], "park", cfg.park, "pitch", cfg.park, "industrial", cfg.landInd, cfg.land]);
      setPaint("district-land", "fill-opacity", 0.92);
      setPaint("district-water", "fill-color", cfg.water);
      setPaint("metro-bay-water", "fill-color", cfg.water);
      setPaint("district-waterway", "line-color", cfg.water);

      setPaint("district-road-casing", "line-color", cfg.roadCase);
      setPaint("district-roads", "line-color", ["match", ["get", "class"], ["motorway", "trunk"], cfg.roadMain, ["primary", "secondary"], cfg.road, cfg.road]);
      setPaint("metro-arterials-casing", "line-color", cfg.roadCase);
      setPaint("metro-arterials", "line-color", cfg.roadMain);

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
      setPaint("metro-outer-skyline-3d", "fill-extrusion-color", ["match", ["to-number", ["get", "tone"], 1], 0, cfg.bldg[0], 1, cfg.bldg[1], cfg.bldg[2]]);

      setPaint("sector-lock-fill", "fill-color", cfg.lockFill);
      setPaint("sector-lock-fill", "fill-opacity", cfg.lockOpacity);
      setPaint("sector-lock-border", "line-color", cfg.isLightUi ? "#475569" : "#94a3b8");
      setPaint("sector-lock-border", "line-opacity", 0.32);

      /* Toggle Three.js dark noir window custom layers off in sunlit Day/Afternoon/Dawn so 3D walls are sunlit, and on in Dusk/Night */
      try {
        var allLayers = (map.getStyle && map.getStyle() && map.getStyle().layers) || [];
        allLayers.forEach(function (ly) {
          if (ly && ly.type === "custom" && map.setLayoutProperty) {
            try { map.setLayoutProperty(ly.id, "visibility", cfg.isLightUi ? "none" : "visible"); } catch (_) {}
          }
        });
      } catch (_) {}

      var textCol = cfg.isLightUi ? "#0f172a" : "#f8fafc";
      var haloCol = cfg.isLightUi ? "rgba(255,255,255,0.96)" : "rgba(4,8,15,0.96)";
      ["zone-poi-icon", "zone-poi-icon-service", "zone-poi-icon-detail", "metro-poi-icon", "district-road-labels"].forEach(function (lid) {
        setPaint(lid, "text-color", textCol);
        setPaint(lid, "text-halo-color", haloCol);
      });
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
        if (!state.hostPaused) tickClock();
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
      if (!document.hidden && !state.hostPaused) tickClock();
    });

    state.clockTimer = setInterval(tickClock, 1000);

    return {
      onRender: onRender,
      openWorldCitiesModal: openWorldCitiesModal,
      applyAtmosphere: applyAtmosphere
    };
  }

  root.ZoneMapExpansion = {
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
})(typeof window !== "undefined" ? window : globalThis);

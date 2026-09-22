(function (global) {
  'use strict';

  // One semantic, 24-unit icon set for every ZONE map surface. These paths are
  // intentionally simple strokes so they remain legible inside a 34px pin.
  global.ZONE_MAP_ICONS = Object.freeze({
    cash: 'M3 21h18M4 21V10M20 21V10M3 10l9-5 9 5M9 21v-7M15 21v-7',
    market: 'M4 9h16l-1 11H5zM5 9l1-4h12l1 4M9 13h6',
    jobs: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
    attack: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    newspaper: 'M4 5h16v14H4zM8 9h8M8 13h8M8 17h5',
    hof: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M10 16h4M8 20h8M12 13v3',
    casino: 'M5 5h14v14H5zM9 9h.01M15 15h.01M12 12h.01',
    crimes: 'M7 11a5 5 0 0 1 10 0v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM10 20v-2M14 20v-2M9 12h.01M15 12h.01',
    faction: 'M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z',
    hospital: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    jail: 'M5 4v16M10 4v16M15 4v16M20 4v16M4 4h17M4 20h17',
    properties: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6',
    items: 'M7 8V6a5 5 0 0 1 10 0v2M5 8h14l-1 12H6zM9 12h6',
    education: 'M3 8l9-4 9 4-9 4zM7 10v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5M21 8v5',
    elimination: 'M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 8v11M5 12H3a9 9 0 0 0 18 0h-2M8 15l-3-2M16 15l3-2',
    missions: 'M7 4h8l3 3v13H7zM10 9h5M10 13h5M10 17h3',
    gym: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10'
  });

  global.ZONE_MAP_CATEGORY_COLORS = Object.freeze({
    fin: '#4f8fd8',
    admin: '#d45d3d',
    shop: '#d8a62e',
    leisure: '#78a83e',
    estate: '#35a79b',
    misc: '#8b63bd'
  });
})(window);

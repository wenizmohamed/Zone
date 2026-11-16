/* ==========================================================================
 * ZONE v130 - HAND-DRAWN INK & WATERCOLOR SKETCHBOOK RUNTIME
 * Mounts:
 *   1) Hand-inked + offset watercolor wash SVG icons (Areas, Header, Legend)
 *   2) Charcoal-crosshatch "Current Mission:" banner & "City Tutorial" box
 *   3) Interactive Hand-Painted Watercolor Zone City Panorama + Teardrop Pins
 *      with 1-click toggle to the Live 3D Tactical Block Map
 *   4) Exact 6 Hand-Painted Watercolor Teardrop Pins in "Key of Symbols"
 *   5) Swaps Arcade cards to cohesive pen-and-ink watercolor illustrations
 * Fiber-safe: never mutates <x-dc> before hydration or removes React nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneWatercolorSketchbookLoaded) return;
  window.__zoneWatercolorSketchbookLoaded = true;

  function isAr() {
    var d = document.documentElement;
    return (d && (d.lang === 'ar' || d.dir === 'rtl')) || false;
  }

  function isNoirMode() {
    return document.documentElement.getAttribute('data-sketch-mode') === 'noir';
  }

  /* Hand-Drawn Fountain-Pen Teardrop Pin SVG (matches Key of Symbols & Map Pins) */
  function teardropPinSvg(washHex, glyphPath) {
    return (
      '<svg class="zwc-pin-svg" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        /* Offset organic watercolor bleed */
        '<path d="M15.2 3.2C20.8 3.2 24.8 7.6 24.6 13.4C24.4 19.8 16.4 29.4 14.8 32.8C13.1 29.5 5.4 19.9 5.3 13.4C5.2 7.6 9.5 3.2 15.2 3.2Z" fill="' + washHex + '" fill-opacity="0.86"/>' +
        '<ellipse cx="12.2" cy="11.2" rx="4.2" ry="5.2" fill="#ffffff" fill-opacity="0.28" transform="rotate(-18 12.2 11.2)"/>' +
        /* Hand-inked fountain-pen outline */
        '<path d="M14 2.4C19.7 2.2 24.1 6.8 23.9 12.8C23.7 19.4 15.7 29.1 14 33.2C12.3 29.1 4.3 19.4 4.1 12.8C3.9 6.8 8.3 2.6 14 2.4Z" stroke="#1e1b18" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
        (glyphPath
          ? '<path d="' + glyphPath + '" stroke="#fcf9f2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<circle cx="14" cy="12.5" r="3.1" fill="#fcf9f2" fill-opacity="0.78" stroke="#1e1b18" stroke-width="1.3"/>') +
      '</svg>'
    );
  }

  /* Hand-Inked + Watercolor Dab Mini Icons for Sidebar Areas (18x18) */
  function sketchAreaSvg(washColor, washShape, inkPath) {
    return (
      '<svg class="zwc-sketch-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        washShape.replace('__WASH__', washColor) +
        '<path d="' + inkPath + '" stroke="#221e1a" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  var SKETCH_AREA_ICONS = {
    home: sketchAreaSvg('#8ea86c', '<path d="M5.5 11.5L12.5 5.5L19.5 11.5V19.5H5.5V11.5Z" fill="__WASH__" fill-opacity="0.55"/>', 'M3.5 11.5L12 4L20.5 11.5M6 10.2V19.8H18V10.2M10 19.8V14.2H14V19.8'),
    items: sketchAreaSvg('#d4a64a', '<rect x="4.8" y="7.8" width="15" height="11.5" rx="2" fill="__WASH__" fill-opacity="0.55"/>', 'M4.2 8.2L12 4.4L19.8 8.2V17.4L12 20.6L4.2 17.4V8.2ZM4.2 8.2L12 11.8L19.8 8.2M12 11.8V20.6'),
    city: sketchAreaSvg('#7da6c4', '<circle cx="12.6" cy="10.4" r="5.5" fill="__WASH__" fill-opacity="0.6"/>', 'M12 21C12 21 18.2 14.4 18.2 9.8A6.2 6.2 0 1 0 5.8 9.8C5.8 14.4 12 21 12 21ZM12 12.2A2.4 2.4 0 1 0 12 7.4A2.4 2.4 0 0 0 12 12.2Z'),
    jobs: sketchAreaSvg('#c78c52', '<rect x="4.2" y="8" width="16" height="11.5" rx="1.8" fill="__WASH__" fill-opacity="0.55"/>', 'M9 7.8V5.6C9 4.8 9.7 4.2 10.5 4.2H13.5C14.3 4.2 15 4.8 15 5.6V7.8M4 8H20V19.2H4V8ZM4 12.8H20'),
    bank: sketchAreaSvg('#78a365', '<path d="M4.5 9.5L12.5 4.5L20 9.5H4.5Z" fill="__WASH__" fill-opacity="0.58"/>', 'M3.5 9.5L12 4L20.5 9.5H3.5ZM4 19.5H20M6.8 9.5V17M10.4 9.5V17M13.8 9.5V17M17.2 9.5V17'),
    gym: sketchAreaSvg('#8ea86c', '<circle cx="6.8" cy="12.4" r="3.4" fill="__WASH__" fill-opacity="0.58"/><circle cx="17.8" cy="12.4" r="3.4" fill="__WASH__" fill-opacity="0.58"/>', 'M2.8 12H21.2M5.5 7.8V16.2M8.2 9.2V14.8M15.8 9.2V14.8M18.5 7.8V16.2'),
    properties: sketchAreaSvg('#d4a64a', '<circle cx="9.2" cy="10.2" r="4.4" fill="__WASH__" fill-opacity="0.58"/>', 'M12.4 11.6L19.8 19M17 16.2L15 18.2M19.2 18.4L17.2 20.4M12.8 9.4A4.2 4.2 0 1 1 4.4 9.4A4.2 4.2 0 0 1 12.8 9.4Z'),
    education: sketchAreaSvg('#7da6c4', '<path d="M4 9.8L12.4 5.4L20.4 9.8L12.4 14.2L4 9.8Z" fill="__WASH__" fill-opacity="0.58"/>', 'M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5ZM6.5 12V16.6C6.5 18.1 9 19.4 12 19.4C15 19.4 17.5 18.1 17.5 16.6V12'),
    crimes: sketchAreaSvg('#c9644a', '<circle cx="12.4" cy="12.4" r="6.8" fill="__WASH__" fill-opacity="0.56"/>', 'M19 12A7 7 0 1 1 5 12A7 7 0 0 1 19 12ZM12 3V6.5M12 17.5V21M3 12H6.5M17.5 12H21M12 12H12.02'),
    missions: sketchAreaSvg('#d4a64a', '<rect x="5.5" y="4.8" width="13.5" height="15.2" rx="1.8" fill="__WASH__" fill-opacity="0.55"/>', 'M6 4.8H18V19.8H6V4.8ZM9 10.8L11.2 13L15.4 8.8M9 15.8H15'),
    newspaper: sketchAreaSvg('#9aa3ad', '<rect x="4.5" y="5" width="15.5" height="14.5" rx="1.5" fill="__WASH__" fill-opacity="0.5"/>', 'M4.5 5H17.5V19.2H4.5V5ZM17.5 8.5H20V18C20 18.7 19.4 19.2 18.7 19.2H17.5M7.5 8.8H14.5M7.5 12.2H14.5M7.5 15.5H12.5'),
    jail: sketchAreaSvg('#a6957c', '<rect x="4.8" y="4.8" width="14.8" height="14.8" fill="__WASH__" fill-opacity="0.48"/>', 'M4.5 4.5H19.5V19.5H4.5V4.5ZM8.2 4.5V19.5M12 4.5V19.5M15.8 4.5V19.5M4.5 9.5H19.5M4.5 14.5H19.5'),
    hospital: sketchAreaSvg('#c9644a', '<rect x="5" y="5" width="14.5" height="14.5" rx="2" fill="__WASH__" fill-opacity="0.52"/>', 'M12 7.2V16.8M7.2 12H16.8M5 4.8H19V19.2H5V4.8Z'),
    casino: sketchAreaSvg('#9b78b8', '<rect x="5.2" y="5.2" width="14" height="14" rx="2.6" fill="__WASH__" fill-opacity="0.55"/>', 'M5 5H19V19H5V5ZM8.8 8.8H8.82M15.2 8.8H15.22M12 12H12.02M8.8 15.2H8.82M15.2 15.2H15.22'),
    hof: sketchAreaSvg('#d4a64a', '<path d="M7.5 4.8H17V10C17 12.6 14.8 14.6 12.2 14.6C9.6 14.6 7.5 12.6 7.5 10V4.8Z" fill="__WASH__" fill-opacity="0.62"/>', 'M7.2 4.5H16.8V9.8C16.8 12.5 14.6 14.6 12 14.6C9.4 14.6 7.2 12.5 7.2 9.8V4.5ZM12 14.6V18.8M8.2 19.8H15.8M7.2 6.5H4.5V8.8C4.5 10.2 5.6 11.2 7.2 11.2M16.8 6.5H19.5V8.8C19.5 10.2 18.4 11.2 16.8 11.2'),
    faction: sketchAreaSvg('#7da6c4', '<path d="M12.4 4L19.4 7V12.4C19.4 16.6 16.2 19.5 12.4 20.8C8.6 19.5 5.4 16.6 5.4 12.4V7L12.4 4Z" fill="__WASH__" fill-opacity="0.56"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8Z'),
    elimination: sketchAreaSvg('#c9644a', '<path d="M12.4 4L19.4 7V12.4C19.4 16.6 16.2 19.5 12.4 20.8C8.6 19.5 5.4 16.6 5.4 12.4V7L12.4 4Z" fill="__WASH__" fill-opacity="0.56"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8ZM9.2 9.6L14.8 15.2M14.8 9.6L9.2 15.2'),
    attack: sketchAreaSvg('#c9644a', '<circle cx="12.4" cy="12.4" r="6.4" fill="__WASH__" fill-opacity="0.56"/>', 'M5.2 18.8L18.8 5.2M14.2 5.2H18.8V9.8M5.2 14.2L9.8 18.8'),
    market: sketchAreaSvg('#78a365', '<path d="M4.8 9.5L6.5 5H18L19.6 9.5V19.5H4.8V9.5Z" fill="__WASH__" fill-opacity="0.55"/>', 'M4.2 9.5L6 4.8H18L19.8 9.5M5.2 9.5V19.5H18.8V9.5M9.8 19.5V14.5H14.2V19.5'),
    account: sketchAreaSvg('#7da6c4', '<circle cx="12.4" cy="9" r="3.8" fill="__WASH__" fill-opacity="0.56"/>', 'M12 12.2A3.6 3.6 0 1 0 12 5A3.6 3.6 0 0 0 12 12.2ZM5.5 19.5C6.4 16.2 8.8 14.6 12 14.6C15.2 14.6 17.6 16.2 18.5 19.5')
  };

  function resolveScreenKey(raw) {
    var k = String(raw || '').trim().toLowerCase();
    if (SKETCH_AREA_ICONS[k]) return k;
    if (k.indexOf('job') === 0) return 'jobs';
    if (k.indexOf('crime') === 0) return 'crimes';
    if (k.indexOf('item') === 0) return 'items';
    if (k.indexOf('prop') === 0) return 'properties';
    if (k.indexOf('edu') === 0) return 'education';
    if (k.indexOf('hosp') === 0) return 'hospital';
    if (k.indexOf('fact') === 0) return 'faction';
    if (k.indexOf('news') === 0) return 'newspaper';
    if (k.indexOf('elim') === 0) return 'elimination';
    if (k.indexOf('miss') === 0) return 'missions';
    if (k.indexOf('mark') === 0 || k.indexOf('bazaar') >= 0) return 'market';
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

  /* 1. Sync Bulletin -> "Current Mission:" Crosshatch Strip */
  function syncMissionBulletin() {
    if (isNoirMode()) return;
    var badge = document.querySelector('.zone-topbar .zone-bulletin > span:first-child');
    if (!badge) return;
    var ar = isAr();
    var targetText = ar ? 'المهمة الحالية:' : 'Current Mission:';
    if (badge.firstChild && badge.firstChild.nodeType === 3) {
      if (badge.firstChild.nodeValue !== targetText) badge.firstChild.nodeValue = targetText;
    }
  }

  /* 2. Sync Charcoal-Header "City Tutorial" / District Guide Card */
  var TUTORIAL_COPY = {
    city: {
      titleEn: 'City Tutorial',
      titleAr: 'دليل المدينة',
      bodyEn: 'Here you can view all of the locations available to you in Zone City. Click any painted district pin on the illustrated city map below or open the 3D Tactical Grid to inspect block control. As you go up levels, you will unlock new sectors and global flights.',
      bodyAr: 'هنا يمكنك استعراض جميع مواقع مدينة زون. اضغط على أي دبوس مرسوم على خريطة المدينة المائية أدناه للانتقال فوراً، أو افتح الشبكة ثلاثية الأبعاد لفحص سيطرة العائلات. كلما ارتفع مستواك ستفتح قطاعات ورحلات جديدة.'
    },
    home: {
      titleEn: 'Operative Sketchbook',
      titleAr: 'دفتر العميل',
      bodyEn: 'Your safehouse ledger, live Syndicate Arcade tables, and daily street contracts. Keep your Energy and Nerve bars active and claim your daily objective.',
      bodyAr: 'سجل مخبئك، وطاولات الأركيد المباشرة، وعقود الشارع اليومية. استثمر الطاقة والجرأة وأنجز هدفك اليومي.'
    }
  };

  function syncTutorialBanner() {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var heading = main.querySelector('.zone-page-heading');
    if (!heading) return;
    if (isNoirMode()) {
      var oldCard = document.getElementById('zwc-tutorial-card');
      if (oldCard) oldCard.remove();
      heading.removeAttribute('data-zwc-enhanced');
      return;
    }

    var screen = main.getAttribute('data-zone-screen') || 'home';
    var ar = isAr();
    var subP = heading.querySelector('p');
    var fallbackBody = subP ? subP.textContent.trim() : '';
    var spec = TUTORIAL_COPY[screen];
    var title = spec
      ? (ar ? spec.titleAr : spec.titleEn)
      : (ar ? 'دليل المنطقة' : (screen.charAt(0).toUpperCase() + screen.slice(1) + ' Guide'));
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
            '<path d="M9 2C5.7 2 3.2 4.5 3.2 7.6C3.2 9.7 4.4 11.4 6.1 12.4V14.8H11.9V12.4C13.6 11.4 14.8 9.7 14.8 7.6C14.8 4.5 12.3 2 9 2Z" fill="#f3cf7a" fill-opacity="0.35" stroke="#f7f1e3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
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
    if (isNoirMode()) return;

    /* Sidebar Areas (matches both zaaa-vivid-svg and zaaa-duotone-svg) */
    var navBtns = document.querySelectorAll('aside.zone-sidebar #zone-area-navigation button[data-zone-screen]');
    for (var i = 0; i < navBtns.length; i++) {
      var iconBox = navBtns[i].querySelector('.zone-nav-icon');
      if (!iconBox) continue;
      var key = resolveScreenKey(navBtns[i].getAttribute('data-zone-screen'));
      var existing = iconBox.querySelector('svg.zaaa-vivid-svg, svg.zaaa-duotone-svg');
      if (existing && existing.getAttribute('data-zwc-ink') !== key) {
        var tmp = document.createElement('div');
        tmp.innerHTML = SKETCH_AREA_ICONS[key] || SKETCH_AREA_ICONS.home;
        var nextSvg = tmp.firstElementChild;
        if (nextSvg) {
          existing.setAttribute('data-zwc-ink', key);
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
      var hostBtn = sBox.closest('button');
      var rawKey =
        sBox.getAttribute('data-zfx-duotone') ||
        sBox.getAttribute('data-zfx-city-icon') ||
        (hostBtn && (hostBtn.getAttribute('data-zone-destination') || hostBtn.getAttribute('data-zone-location'))) ||
        (hostBtn && hostBtn.querySelector('strong') && hostBtn.querySelector('strong').textContent) ||
        'home';
      var sKey = resolveScreenKey(rawKey);
      var sSvg = sBox.querySelector('svg.zfx-duotone-svg, svg.zfx-city-svg');
      if (sSvg && sSvg.getAttribute('data-zwc-ink') !== sKey) {
        var sTmp = document.createElement('div');
        sTmp.innerHTML = SKETCH_AREA_ICONS[sKey] || SKETCH_AREA_ICONS.city;
        if (sTmp.firstElementChild) {
          sSvg.setAttribute('data-zwc-ink', sKey);
          sSvg.setAttribute('viewBox', '0 0 24 24');
          sSvg.innerHTML = sTmp.firstElementChild.innerHTML;
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

  /* 4. Mount Interactive Hand-Painted Watercolor Panorama Stage on City Screen */
  var CITY_PINS = [
    { id: 'bank', screen: 'bank', x: 46, y: 42, color: '#3e6fb0', en: 'Central Bank', ar: 'البنك المركزي', minLv: 1 },
    { id: 'gym', screen: 'gym', x: 37, y: 50, color: '#6c8c3c', en: 'Gym', ar: 'النادي الرياضي', minLv: 1 },
    { id: 'crimes', screen: 'crimes', x: 24, y: 63, color: '#b85233', en: 'Harbor Docks', ar: 'مرافئ العمليات', minLv: 1 },
    { id: 'hospital', screen: 'hospital', x: 54, y: 47, color: '#b85233', en: 'Hospital', ar: 'المستشفى', minLv: 1 },
    { id: 'market', screen: 'market', x: 70, y: 58, color: '#dba83b', en: 'Old Town Market', ar: 'سوق البلدة القديمة', minLv: 1 },
    { id: 'properties', screen: 'properties', x: 83, y: 44, color: '#2f8b7b', en: 'Citadel Estates', ar: 'عقارات القلعة', minLv: 1 },
    { id: 'casino', screen: 'casino', x: 43, y: 31, color: '#7b4ca0', en: 'Grand Casino', ar: 'الكازينو الكبير', minLv: 1 },
    { id: 'education', screen: 'education', x: 61, y: 24, color: '#3e6fb0', en: 'University Hill', ar: 'تلة الجامعة', minLv: 1 },
    { id: 'jail', screen: 'jail', x: 28, y: 26, color: '#b85233', en: 'Fortress Bastion', ar: 'سجن الحصن', minLv: 1 },
    { id: 'jobs', screen: 'jobs', x: 50, y: 61, color: '#dba83b', en: 'River Exchange', ar: 'بورصة الأعمال', minLv: 1 }
  ];

  var preferredCityView = 'illustrated';

  function syncCityPanoramaStage() {
    var shell = document.querySelector('#zone-main .zone-city-map-shell');
    if (!shell) return;
    if (isNoirMode()) {
      shell.removeAttribute('data-zwc-view');
      return;
    }

    var ar = isAr();
    if (!shell.getAttribute('data-zwc-view')) {
      shell.setAttribute('data-zwc-view', preferredCityView);
    }

    var existing = document.getElementById('zwc-city-panorama-stage');
    var langKey = ar ? 'ar' : 'en';
    if (existing && existing.getAttribute('data-lang') === langKey && existing.parentElement === shell) {
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
      pinsHtml +=
        '<button type="button" class="zwc-map-pin" data-zwc-go="' + p.screen + '" style="left:' + p.x + '%;top:' + p.y + '%" title="' + label + '">' +
          teardropPinSvg(p.color, '') +
          '<span class="zwc-map-pin-tag">' + label + '</span>' +
        '</button>';
    }

    var isIll = shell.getAttribute('data-zwc-view') !== '3d';
    stage.innerHTML =
      '<div class="zwc-map-mode-bar">' +
        '<button type="button" class="zwc-mode-btn" data-zwc-mode="illustrated" aria-pressed="' + (isIll ? 'true' : 'false') + '">' +
          (ar ? 'خريطة مرسومة' : 'Illustrated Atlas') +
        '</button>' +
        '<button type="button" class="zwc-mode-btn" data-zwc-mode="3d" aria-pressed="' + (!isIll ? 'true' : 'false') + '">' +
          (ar ? 'خريطة 3D' : '3D Block Map') +
        '</button>' +
      '</div>' +
      '<div class="zwc-panorama-art-wrap">' +
        '<img class="zwc-panorama-img" src="/assets/ui/watercolor-art/city-panorama.webp" alt="' + (ar ? 'خريطة مدينة زون المرسومة' : 'Hand-drawn watercolor map of Zone City') + '" loading="eager" decoding="async">' +
        pinsHtml +
      '</div>';

    stage.addEventListener('click', function (ev) {
      var modeBtn = ev.target.closest('[data-zwc-mode]');
      if (modeBtn) {
        ev.preventDefault();
        preferredCityView = modeBtn.getAttribute('data-zwc-mode') || 'illustrated';
        shell.setAttribute('data-zwc-view', preferredCityView);
        var btns = stage.querySelectorAll('[data-zwc-mode]');
        for (var b = 0; b < btns.length; b++) {
          btns[b].setAttribute('aria-pressed', btns[b] === modeBtn ? 'true' : 'false');
        }
        if (preferredCityView === '3d') {
          if (window.ZoneGameFX && typeof window.ZoneGameFX.syncWebglIframeThrottle === 'function') {
            window.ZoneGameFX.syncWebglIframeThrottle();
          }
          window.dispatchEvent(new Event('resize'));
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
  }

  function syncAll() {
    if (document.querySelector('x-dc')) return;
    try {
      syncMissionBulletin();
      syncTutorialBanner();
      syncSketchIconsAndArt();
      syncCityPanoramaStage();
    } catch (_) {}
  }

  function boot() {
    syncAll();
    setTimeout(syncAll, 180);
    setTimeout(syncAll, 520);

    window.addEventListener('zone:render', syncAll);

    /* Hook theme toggle button so clicking it toggles Sketchbook <-> Noir Ink */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var themeBtn = t.closest('.zone-header-actions > button:first-of-type');
      if (themeBtn) {
        var nextNoir = document.documentElement.getAttribute('data-sketch-mode') !== 'noir';
        if (nextNoir) {
          document.documentElement.setAttribute('data-sketch-mode', 'noir');
        } else {
          document.documentElement.removeAttribute('data-sketch-mode');
        }
        setTimeout(syncAll, 30);
      }
    }, true);

    if (typeof MutationObserver === 'function') {
      var obs = new MutationObserver(function () {
        syncAll();
      });
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme', 'data-sketch-mode']
      });
      var attachMain = function () {
        var main = document.getElementById('zone-main');
        if (main && !main.__zwcObserved) {
          main.__zwcObserved = true;
          var mObs = new MutationObserver(function () {
            syncAll();
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

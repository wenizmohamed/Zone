/* ==========================================================================
 * ZONE v133 - HAND-DRAWN INK & WATERCOLOR SKETCHBOOK RUNTIME (LIGHT + DARK)
 * Keeps 100% identical Hand-Drawn Sketchbook UI/UX in BOTH Light & Dark modes:
 *   1) Hand-inked + offset watercolor/gouache wash SVG icons (Areas, Quick, Legend)
 *      with automatic CSS-variable stroke adaptation (dark ink <-> warm chalk ink)
 *   2) Crosshatched "Current Mission:" strip & "City Tutorial" / District Guide box
 *   3) Interactive Hand-Painted Watercolor Zone City Panorama + Teardrop Pins
 *      with 1-click toggle to the Live 3D Tactical Block Map
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

  /* Hand-Inked + Watercolor Dab Mini Icons for Sidebar Areas & Surface Actions */
  function sketchAreaSvg(washColor, washShape, inkPath) {
    return (
      '<svg class="zwc-sketch-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        washShape.replace(/__WASH__/g, washColor) +
        '<path class="zwc-ink-stroke" d="' + inkPath + '" stroke="var(--zwc-svg-ink, #221e1a)" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  var SKETCH_AREA_ICONS = {
    home: sketchAreaSvg('#8ea86c', '<path class="zwc-wash-fill" d="M5.5 11.5L12.5 5.5L19.5 11.5V19.5H5.5V11.5Z" fill="__WASH__" fill-opacity="0.58"/>', 'M3.5 11.5L12 4L20.5 11.5M6 10.2V19.8H18V10.2M10 19.8V14.2H14V19.8'),
    items: sketchAreaSvg('#d4a64a', '<rect class="zwc-wash-fill" x="4.8" y="7.8" width="15" height="11.5" rx="2" fill="__WASH__" fill-opacity="0.58"/>', 'M4.2 8.2L12 4.4L19.8 8.2V17.4L12 20.6L4.2 17.4V8.2ZM4.2 8.2L12 11.8L19.8 8.2M12 11.8V20.6'),
    city: sketchAreaSvg('#7da6c4', '<circle class="zwc-wash-fill" cx="12.6" cy="10.4" r="5.5" fill="__WASH__" fill-opacity="0.62"/>', 'M12 21C12 21 18.2 14.4 18.2 9.8A6.2 6.2 0 1 0 5.8 9.8C5.8 14.4 12 21 12 21ZM12 12.2A2.4 2.4 0 1 0 12 7.4A2.4 2.4 0 0 0 12 12.2Z'),
    jobs: sketchAreaSvg('#c78c52', '<rect class="zwc-wash-fill" x="4.2" y="8" width="16" height="11.5" rx="1.8" fill="__WASH__" fill-opacity="0.58"/>', 'M9 7.8V5.6C9 4.8 9.7 4.2 10.5 4.2H13.5C14.3 4.2 15 4.8 15 5.6V7.8M4 8H20V19.2H4V8ZM4 12.8H20'),
    bank: sketchAreaSvg('#78a365', '<path class="zwc-wash-fill" d="M4.5 9.5L12.5 4.5L20 9.5H4.5Z" fill="__WASH__" fill-opacity="0.6"/>', 'M3.5 9.5L12 4L20.5 9.5H3.5ZM4 19.5H20M6.8 9.5V17M10.4 9.5V17M13.8 9.5V17M17.2 9.5V17'),
    gym: sketchAreaSvg('#8ea86c', '<circle class="zwc-wash-fill" cx="6.8" cy="12.4" r="3.4" fill="__WASH__" fill-opacity="0.6"/><circle class="zwc-wash-fill" cx="17.8" cy="12.4" r="3.4" fill="__WASH__" fill-opacity="0.6"/>', 'M2.8 12H21.2M5.5 7.8V16.2M8.2 9.2V14.8M15.8 9.2V14.8M18.5 7.8V16.2'),
    properties: sketchAreaSvg('#d4a64a', '<circle class="zwc-wash-fill" cx="9.2" cy="10.2" r="4.4" fill="__WASH__" fill-opacity="0.6"/>', 'M12.4 11.6L19.8 19M17 16.2L15 18.2M19.2 18.4L17.2 20.4M12.8 9.4A4.2 4.2 0 1 1 4.4 9.4A4.2 4.2 0 0 1 12.8 9.4Z'),
    education: sketchAreaSvg('#7da6c4', '<path class="zwc-wash-fill" d="M4 9.8L12.4 5.4L20.4 9.8L12.4 14.2L4 9.8Z" fill="__WASH__" fill-opacity="0.6"/>', 'M2.8 9.5L12 4.8L21.2 9.5L12 14.2L2.8 9.5ZM6.5 12V16.6C6.5 18.1 9 19.4 12 19.4C15 19.4 17.5 18.1 17.5 16.6V12'),
    crimes: sketchAreaSvg('#c9644a', '<circle class="zwc-wash-fill" cx="12.4" cy="12.4" r="6.8" fill="__WASH__" fill-opacity="0.58"/>', 'M19 12A7 7 0 1 1 5 12A7 7 0 0 1 19 12ZM12 3V6.5M12 17.5V21M3 12H6.5M17.5 12H21M12 12H12.02'),
    missions: sketchAreaSvg('#d4a64a', '<rect class="zwc-wash-fill" x="5.5" y="4.8" width="13.5" height="15.2" rx="1.8" fill="__WASH__" fill-opacity="0.58"/>', 'M6 4.8H18V19.8H6V4.8ZM9 10.8L11.2 13L15.4 8.8M9 15.8H15'),
    newspaper: sketchAreaSvg('#9aa3ad', '<rect class="zwc-wash-fill" x="4.5" y="5" width="15.5" height="14.5" rx="1.5" fill="__WASH__" fill-opacity="0.54"/>', 'M4.5 5H17.5V19.2H4.5V5ZM17.5 8.5H20V18C20 18.7 19.4 19.2 18.7 19.2H17.5M7.5 8.8H14.5M7.5 12.2H14.5M7.5 15.5H12.5'),
    jail: sketchAreaSvg('#a6957c', '<rect class="zwc-wash-fill" x="4.8" y="4.8" width="14.8" height="14.8" fill="__WASH__" fill-opacity="0.52"/>', 'M4.5 4.5H19.5V19.5H4.5V4.5ZM8.2 4.5V19.5M12 4.5V19.5M15.8 4.5V19.5M4.5 9.5H19.5M4.5 14.5H19.5'),
    hospital: sketchAreaSvg('#c9644a', '<rect class="zwc-wash-fill" x="5" y="5" width="14.5" height="14.5" rx="2" fill="__WASH__" fill-opacity="0.56"/>', 'M12 7.2V16.8M7.2 12H16.8M5 4.8H19V19.2H5V4.8Z'),
    casino: sketchAreaSvg('#9b78b8', '<rect class="zwc-wash-fill" x="5.2" y="5.2" width="14" height="14" rx="2.6" fill="__WASH__" fill-opacity="0.58"/>', 'M5 5H19V19H5V5ZM8.8 8.8H8.82M15.2 8.8H15.22M12 12H12.02M8.8 15.2H8.82M15.2 15.2H15.22'),
    hof: sketchAreaSvg('#d4a64a', '<path class="zwc-wash-fill" d="M7.5 4.8H17V10C17 12.6 14.8 14.6 12.2 14.6C9.6 14.6 7.5 12.6 7.5 10V4.8Z" fill="__WASH__" fill-opacity="0.64"/>', 'M7.2 4.5H16.8V9.8C16.8 12.5 14.6 14.6 12 14.6C9.4 14.6 7.2 12.5 7.2 9.8V4.5ZM12 14.6V18.8M8.2 19.8H15.8M7.2 6.5H4.5V8.8C4.5 10.2 5.6 11.2 7.2 11.2M16.8 6.5H19.5V8.8C19.5 10.2 18.4 11.2 16.8 11.2'),
    faction: sketchAreaSvg('#7da6c4', '<path class="zwc-wash-fill" d="M12.4 4L19.4 7V12.4C19.4 16.6 16.2 19.5 12.4 20.8C8.6 19.5 5.4 16.6 5.4 12.4V7L12.4 4Z" fill="__WASH__" fill-opacity="0.58"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8Z'),
    elimination: sketchAreaSvg('#c9644a', '<path class="zwc-wash-fill" d="M12.4 4L19.4 7V12.4C19.4 16.6 16.2 19.5 12.4 20.8C8.6 19.5 5.4 16.6 5.4 12.4V7L12.4 4Z" fill="__WASH__" fill-opacity="0.58"/>', 'M12 3.8L19 6.8V12.2C19 16.5 15.9 19.4 12 20.8C8.1 19.4 5 16.5 5 12.2V6.8L12 3.8ZM9.2 9.6L14.8 15.2M14.8 9.6L9.2 15.2'),
    attack: sketchAreaSvg('#c9644a', '<circle class="zwc-wash-fill" cx="12.4" cy="12.4" r="6.4" fill="__WASH__" fill-opacity="0.58"/>', 'M5.2 18.8L18.8 5.2M14.2 5.2H18.8V9.8M5.2 14.2L9.8 18.8'),
    market: sketchAreaSvg('#78a365', '<path class="zwc-wash-fill" d="M4.8 9.5L6.5 5H18L19.6 9.5V19.5H4.8V9.5Z" fill="__WASH__" fill-opacity="0.58"/>', 'M4.2 9.5L6 4.8H18L19.8 9.5M5.2 9.5V19.5H18.8V9.5M9.8 19.5V14.5H14.2V19.5'),
    account: sketchAreaSvg('#7da6c4', '<circle class="zwc-wash-fill" cx="12.4" cy="9" r="3.8" fill="__WASH__" fill-opacity="0.58"/>', 'M12 12.2A3.6 3.6 0 1 0 12 5A3.6 3.6 0 0 0 12 12.2ZM5.5 19.5C6.4 16.2 8.8 14.6 12 14.6C15.2 14.6 17.6 16.2 18.5 19.5')
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
          sSvg.setAttribute('data-zwc-ink', sKey);
          sSvg.setAttribute('data-zwc-icon', '1');
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

    /* Center panorama scroll smoothly on mobile portrait viewports */
    if (window.innerWidth <= 640) {
      var vp = stage.querySelector('.zwc-panorama-viewport');
      if (vp && vp.scrollWidth > vp.clientWidth) {
        vp.scrollLeft = Math.round((vp.scrollWidth - vp.clientWidth) * 0.42);
      }
    }
  }

  var lastObservedScreen = '';
  var rafScheduled = false;

  function snapRouteTopIfNeeded() {
    if (window.scrollY > 0 && window.scrollY < 240) {
      window.scrollTo(0, 0);
    }
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
        snapRouteTopIfNeeded();
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(snapRouteTopIfNeeded);
        }
        setTimeout(snapRouteTopIfNeeded, 50);
        setTimeout(snapRouteTopIfNeeded, 130);
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

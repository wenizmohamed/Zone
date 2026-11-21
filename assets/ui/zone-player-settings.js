/* ==========================================================================
 * ZONE v159 - FIRST-CLASS PLAYER SETTINGS CENTER, GLOBAL HARDWARE-TIGHT
 *             MASTER AUDIO KILL-SWITCH & POSTGRESQL 16 PROFILESTORE CLIENT
 * Exclusive Ownership: @settings-audio-mcm (assets/ui/zone-player-settings.js)
 * Exposes: window.ZonePlayerSettings & window.ZoneMasterAudioGate
 *
 * Skills Applied:
 *   - skyrim-mcm (6-Tab MCM v7 pages + Hungarian control IDs b*, f*, i*, s*)
 *   - config-snapshot-manager (current-working snapshot pointer + Export/Import JSON)
 *   - profilestore (PostgreSQL 16 /api/v1/settings & /api/v1/settings/action sync)
 *   - dsp-cookbook & audio-engineering-patterns (Hardware-tight Master Gate GainNode
 *     intercepting AudioNode.prototype.connect -> BaseAudioContext.destination)
 *   - audio-preview (▶ Test Audio Cue live D-minor 9th synthesis & stem preview)
 *   - soundlab-environmental-ambiences-room-scale-realism-requirements-and-decision-brief
 *   - game-controller-input-workflow (Remappable hotkeys + navigator.getGamepads)
 *   - psych-accessibility (Colorblind modes, Reduced Motion, High Contrast, Text Scale)
 * ========================================================================== */
(function (root) {
  'use strict';

  var STORAGE_SETTINGS_KEY = 'zone.player.settings.v159';
  var STORAGE_SNAPSHOT_ID_KEY = 'zone.player.settings.snapshotId.v159';

  var DEFAULT_KEYBINDS = {
    mute: 'M',
    settings: ',',
    comms: 'C',
    home: '1',
    items: '2',
    city: '3',
    gym: '4',
    crimes: '5',
    attack: '6'
  };

  function createDefaultSettings() {
    return {
      audio: {
        masterMuted: false,
        masterVolume: 75,
        sfxVolume: 85,
        musicEnabled: true,
        musicVolume: 70,
        ambienceVolume: 65,
        uiClicks: true
      },
      graphics: {
        qualityPreset: 'high',
        dynamicResScaler: true,
        particleDensity: 80,
        shadowsAndRim: true,
        showFpsCounter: false
      },
      gameplay: {
        theme: 'dark',
        language: 'en',
        highStakesConfirm: true,
        autoRecordReplays: true,
        showTickerBulletin: true
      },
      controls: {
        gamepadEnabled: true,
        allowBareHotkeys: true,
        keybinds: Object.assign({}, DEFAULT_KEYBINDS)
      },
      accessibility: {
        colorblindMode: 'standard',
        reducedMotion: false,
        highContrast: false,
        textScale: 100
      }
    };
  }

  var SVG_SOUND_ON =
    '<svg class="zwc-sketch-ico zps-svg-sound-on" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path class="zwc-wash-fill" d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#22b56b"/>' +
      '<path class="zwc-ink-stroke" d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path class="zwc-ink-stroke" d="M15.6 8.6C17 9.8 17.8 10.9 17.8 12C17.8 13.1 17 14.2 15.6 15.4M18.4 6.2C20.4 7.9 21.4 9.9 21.4 12C21.4 14.1 20.4 16.1 18.4 17.8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SOUND_MUTED =
    '<svg class="zwc-sketch-ico zps-svg-sound-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path class="zwc-wash-fill" d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="#e63946"/>' +
      '<path class="zwc-ink-stroke" d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M15.8 9.2L21 14.8M21 9.2L15.8 14.8" stroke="#e63946" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M3.2 3.2L20.8 20.8" stroke="#e63946" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SETTINGS_GEAR =
    '<svg class="zwc-sketch-ico zps-svg-gear" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle class="zwc-wash-fill" cx="12" cy="12" r="6.8" fill="#f5b82e"/>' +
      '<circle class="zwc-accent-fill" cx="12" cy="12" r="2.8" fill="#2da4e8"/>' +
      '<path class="zwc-ink-stroke" d="M12 2.6V5.2M12 18.8V21.4M2.6 12H5.2M18.8 12H21.4M5.3 5.3L7.2 7.2M16.8 16.8L18.7 18.7M18.7 5.3L16.8 7.2M7.2 16.8L5.3 18.7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
      '<circle class="zwc-ink-stroke" cx="12" cy="12" r="6.4" stroke="currentColor" stroke-width="1.6"/>' +
      '<circle class="zwc-ink-stroke" cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5"/>' +
    '</svg>';

  var COPY = {
    en: {
      soundOn: '🔊 Sound',
      soundMuted: '🔇 Muted',
      soundAriaOn: 'Global game audio active (Press M to mute)',
      soundAriaMuted: 'Global game audio muted (Press M to unmute)',
      settingsBtn: '⚙️ Settings',
      settingsAria: 'Open Player Settings Center (Hotkey , or Alt+S)',
      modalTitle: 'Player Settings Center',
      modalSub: 'Hardware-Tight Audio Gate · 3D Quality · Controls · Accessibility · Cloud ProfileStore',
      closeBtn: '✕ Close',
      tabAudio: '1. Audio & DSP',
      tabGraphics: '2. 3D & Perf',
      tabGameplay: '3. Gameplay',
      tabControls: '4. Controls',
      tabA11y: '5. Accessibility',
      tabCloud: '6. Cloud & Snapshots',
      masterMuteLbl: 'Global Master Mute Kill-Switch',
      masterMuteDesc: 'Silences 100% of WebAudio oscillators, tactical SFX, Arcade & Noir stems in 0ms',
      masterVolLbl: 'Master Output Volume',
      masterVolDesc: 'Scales the hardware master gate gain across all AudioContexts (0-100%)',
      sfxVolLbl: 'Tactical & Combat SFX Volume',
      sfxVolDesc: 'Gunshots, vault breach tumblers, heavy bag impacts & casino cues',
      musicToggleLbl: 'Adaptive Noir Soundtrack',
      musicToggleDesc: 'Markov minor-9th interactive stems with 0.6s district crossfading',
      musicVolLbl: 'Adaptive Music Volume',
      ambienceVolLbl: 'Pier 4 / City Room Ambience',
      ambienceVolDesc: 'Room-scale harbor rain, street tone & intelligibility-checked bed',
      uiClicksLbl: 'UI Navigation & Button Clicks',
      testCueBtn: '▶ Test Audio Cue',
      qualityPresetLbl: '3D Graphics Quality Preset',
      qualityPresetDesc: 'Adjusts WebGL/Three.js shader complexity, anti-aliasing & lighting budget',
      dynResLbl: 'Dynamic Resolution Scaler (Auto 60fps Target)',
      dynResDesc: 'Automatically scales pixel ratio under heavy combat load to hold 60fps',
      particlesLbl: 'Particle & Gouache FX Density',
      shadowsRimLbl: 'Realtime Shadows & Rim Shaders',
      fpsCounterLbl: 'Live FPS & Draw-Call Counter Overlay',
      themeLbl: 'Visual Sketchbook Theme',
      themeDark: 'Dark Noir',
      themeLight: 'Light Sketchbook',
      langLbl: 'Interface Language (EN / AR RTL)',
      langEn: 'English (LTR)',
      langAr: 'العربية (RTL)',
      highStakesLbl: 'High-Stakes Spend Confirmation (> $50,000 / Merits)',
      replaysLbl: 'Auto-Record Combat Replays',
      tickerLbl: 'Syndicate Ticker Bulletin Visibility',
      gamepadLbl: 'Gamepad Input Polling (navigator.getGamepads)',
      bareKeysLbl: 'Single-Key Quick Hotkeys Outside Inputs',
      keybindsTitle: 'Interactive Keybind Remapping (Click a key to rebind)',
      pressKey: 'Press key...',
      resetKeysBtn: 'Reset Default Keybinds',
      cbModeLbl: 'Colorblind Vision Filter',
      reducedMotionLbl: 'Reduced Motion & Camera Shake',
      highContrastLbl: 'High-Contrast Fountain Ink',
      textScaleLbl: 'UI Text Scale',
      cloudStatusLbl: 'PostgreSQL 16 ProfileStore Sync Status',
      exportJsonBtn: 'Export Settings JSON',
      importJsonBtn: 'Import Settings JSON',
      resetDefaultsBtn: 'Reset All to Defaults',
      syncNowBtn: 'Sync to Cloud Now',
      onTxt: 'ON',
      offTxt: 'OFF',
      mutedTxt: 'MUTED',
      activeTxt: 'ACTIVE'
    },
    ar: {
      soundOn: '🔊 الصوت',
      soundMuted: '🔇 صامت',
      soundAriaOn: 'صوت اللعبة مفعل (اضغط M لكتم الصوت)',
      soundAriaMuted: 'صوت اللعبة مكتوم بالكامل (اضغط M لإلغاء الكتم)',
      settingsBtn: '⚙️ الإعدادات',
      settingsAria: 'فتح مركز إعدادات اللاعب (اختصار , أو Alt+S)',
      modalTitle: 'مركز إعدادات اللاعب الشامل',
      modalSub: 'بوابة كتم الصوت الفورية · الرسومات ثلاثية الأبعاد · التحكم · الوصول · المزامنة السحابية',
      closeBtn: '✕ إغلاق',
      tabAudio: '١. الصوت والمزج',
      tabGraphics: '٢. الرسومات والأداء',
      tabGameplay: '٣. اللعب والأمان',
      tabControls: '٤. التحكم والأزرار',
      tabA11y: '٥. إمكانية الوصول',
      tabCloud: '٦. السحابة واللقطات',
      masterMuteLbl: 'مفتاح كتم الصوت الشامل الفوري',
      masterMuteDesc: 'يكتم 100% من مذبذبات الصوت والمؤثرات والموسيقى والأركيد في 0 مللي ثانية',
      masterVolLbl: 'مستوى الصوت الرئيسي',
      masterVolDesc: 'يتحكم في بوابة الكسب الرئيسية عبر جميع سياقات الصوت (0-100%)',
      sfxVolLbl: 'مستوى المؤثرات التكتيكية والقتالية',
      sfxVolDesc: 'طلقات النار، أقفال الخزائن، ضربات النادي ومؤثرات الكازينو',
      musicToggleLbl: 'الموسيقى التكيفية (نوار)',
      musicToggleDesc: 'موسيقى تفاعلية تتغير تلقائياً حسب المنطقة ومستوى التهديد',
      musicVolLbl: 'مستوى صوت الموسيقى',
      ambienceVolLbl: 'أجواء الرصيف ٤ وغلاف المدينة الصوتي',
      ambienceVolDesc: 'أمطار المرفأ وأجواء الغرف المحسّنة لوضوح الحوار',
      uiClicksLbl: 'نقرات الواجهة والتنقل',
      testCueBtn: '▶ تجربة نغمة الصوت',
      qualityPresetLbl: 'مستوى جودة الرسومات ثلاثية الأبعاد',
      qualityPresetDesc: 'يضبط دقة الإضاءة والظلال وجودة المشاهد ثلاثية الأبعاد',
      dynResLbl: 'موازن الدقة الديناميكي (هدف 60 إطار/ثانية)',
      dynResDesc: 'يضبط دقة العرض تلقائياً أثناء المعارك الكثيفة للحفاظ على 60fps',
      particlesLbl: 'كثافة الجسيمات والمؤثرات البصرية',
      shadowsRimLbl: 'الظلال الحية وإضاءة الحواف',
      fpsCounterLbl: 'عداد الإطارات ومكالمات الرسم المباشر (FPS)',
      themeLbl: 'السمة البصرية لدفتر الرسم',
      themeDark: 'داكن (نوار)',
      themeLight: 'فاتح (دفتر رسم)',
      langLbl: 'لغة الواجهة (العربية / الإنجليزية)',
      langEn: 'English (LTR)',
      langAr: 'العربية (RTL)',
      highStakesLbl: 'تأكيد الإنفاق للمبالغ الكبيرة (> $50,000 / الأوسمة)',
      replaysLbl: 'تسجيل إعادات القتال تلقائياً',
      tickerLbl: 'إظهار شريط أخبار النقابة العلوي',
      gamepadLbl: 'تفعيل ذراع التحكم (Gamepad Polling)',
      bareKeysLbl: 'اختصارات الأزرار الفردية خارج حقول الكتابة',
      keybindsTitle: 'تخصيص اختصارات لوحة المفاتيح (اضغط لتغيير الزر)',
      pressKey: 'اضغط زراً...',
      resetKeysBtn: 'استعادة الاختصارات الافتراضية',
      cbModeLbl: 'مرشح عمى الألوان البصري',
      reducedMotionLbl: 'تقليل الحركة واهتزاز الكاميرا',
      highContrastLbl: 'حبر عالي التباين للخطوط',
      textScaleLbl: 'حجم نصوص الواجهة',
      cloudStatusLbl: 'حالة المزامنة السحابية (PostgreSQL 16 ProfileStore)',
      exportJsonBtn: 'تصدير الإعدادات JSON',
      importJsonBtn: 'استيراد الإعدادات JSON',
      resetDefaultsBtn: 'استعادة الإعدادات الافتراضية',
      syncNowBtn: 'مزامنة مع السحابة الآن',
      onTxt: 'مفعّل',
      offTxt: 'معطّل',
      mutedTxt: 'مكتوم',
      activeTxt: 'نشط'
    }
  };

  var KEYBIND_LABELS = {
    mute: { en: 'Mute Audio Toggle', ar: 'كتم / تشغيل الصوت' },
    settings: { en: 'Open Settings Modal', ar: 'فتح نافذة الإعدادات' },
    comms: { en: 'Syndicate Comms', ar: 'اتصالات النقابة' },
    home: { en: 'Home Screen', ar: 'الشاشة الرئيسية' },
    items: { en: 'Items & Loadout', ar: 'العتاد والمخزون' },
    city: { en: 'City Map', ar: 'خريطة المدينة' },
    gym: { en: 'Iron Pit Gym', ar: 'النادي الرياضي' },
    crimes: { en: 'Crimes & Heists', ar: 'الجرائم والسطو' },
    attack: { en: 'Combat Arena', ar: 'ساحة القتال' }
  };

  function getWindowLocalStorage(winObj) {
    if (!winObj) return null;
    try {
      var desc = Object.getOwnPropertyDescriptor(winObj, 'localStorage');
      if (desc && typeof desc.get === 'function' && typeof process !== 'undefined' && winObj === globalThis) {
        return null;
      }
      return winObj.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function clampInt(val, min, max, fallback) {
    var n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    var r = Math.round(n);
    if (r < min) return min;
    if (r > max) return max;
    return r;
  }

  function sanitizeSettingsObject(input, base) {
    var out = createDefaultSettings();
    var srcBase = base || out;

    // Copy base first
    out.audio = Object.assign({}, out.audio, srcBase.audio || {});
    out.graphics = Object.assign({}, out.graphics, srcBase.graphics || {});
    out.gameplay = Object.assign({}, out.gameplay, srcBase.gameplay || {});
    out.controls = Object.assign({}, out.controls, srcBase.controls || {}, {
      keybinds: Object.assign({}, DEFAULT_KEYBINDS, (srcBase.controls && srcBase.controls.keybinds) || {})
    });
    out.accessibility = Object.assign({}, out.accessibility, srcBase.accessibility || {});

    if (!input || typeof input !== 'object') return out;
    var raw = (input.settings && typeof input.settings === 'object' && !input.audio) ? input.settings : input;

    if (raw.audio && typeof raw.audio === 'object') {
      var a = raw.audio;
      if (typeof a.masterMuted === 'boolean') out.audio.masterMuted = a.masterMuted;
      else if (a.masterMuted === 1 || a.masterMuted === '1' || a.masterMuted === 'true') out.audio.masterMuted = true;
      else if (a.masterMuted === 0 || a.masterMuted === '0' || a.masterMuted === 'false') out.audio.masterMuted = false;

      if (a.masterVolume !== undefined) out.audio.masterVolume = clampInt(a.masterVolume, 0, 100, out.audio.masterVolume);
      if (a.sfxVolume !== undefined) out.audio.sfxVolume = clampInt(a.sfxVolume, 0, 100, out.audio.sfxVolume);
      if (typeof a.musicEnabled === 'boolean') out.audio.musicEnabled = a.musicEnabled;
      if (a.musicVolume !== undefined) out.audio.musicVolume = clampInt(a.musicVolume, 0, 100, out.audio.musicVolume);
      if (a.ambienceVolume !== undefined) out.audio.ambienceVolume = clampInt(a.ambienceVolume, 0, 100, out.audio.ambienceVolume);
      if (typeof a.uiClicks === 'boolean') out.audio.uiClicks = a.uiClicks;
    }

    if (raw.graphics && typeof raw.graphics === 'object') {
      var g = raw.graphics;
      if (typeof g.qualityPreset === 'string') {
        var qp = g.qualityPreset.toLowerCase().trim();
        if (['low', 'medium', 'high', 'ultra'].indexOf(qp) >= 0) out.graphics.qualityPreset = qp;
      }
      if (typeof g.dynamicResScaler === 'boolean') out.graphics.dynamicResScaler = g.dynamicResScaler;
      if (g.particleDensity !== undefined) out.graphics.particleDensity = clampInt(g.particleDensity, 0, 100, out.graphics.particleDensity);
      if (typeof g.shadowsAndRim === 'boolean') out.graphics.shadowsAndRim = g.shadowsAndRim;
      if (typeof g.showFpsCounter === 'boolean') out.graphics.showFpsCounter = g.showFpsCounter;
    }

    if (raw.gameplay && typeof raw.gameplay === 'object') {
      var gp = raw.gameplay;
      if (typeof gp.theme === 'string') {
        var th = gp.theme.toLowerCase().trim();
        if (th === 'dark' || th === 'light') out.gameplay.theme = th;
      }
      if (typeof gp.language === 'string') {
        var lg = gp.language.toLowerCase().trim();
        if (lg === 'en' || lg === 'ar') out.gameplay.language = lg;
      }
      if (typeof gp.highStakesConfirm === 'boolean') out.gameplay.highStakesConfirm = gp.highStakesConfirm;
      if (typeof gp.autoRecordReplays === 'boolean') out.gameplay.autoRecordReplays = gp.autoRecordReplays;
      if (typeof gp.showTickerBulletin === 'boolean') out.gameplay.showTickerBulletin = gp.showTickerBulletin;
    }

    if (raw.controls && typeof raw.controls === 'object') {
      var c = raw.controls;
      if (typeof c.gamepadEnabled === 'boolean') out.controls.gamepadEnabled = c.gamepadEnabled;
      if (typeof c.allowBareHotkeys === 'boolean') out.controls.allowBareHotkeys = c.allowBareHotkeys;
      if (c.keybinds && typeof c.keybinds === 'object') {
        var kbKeys = Object.keys(DEFAULT_KEYBINDS);
        for (var i = 0; i < kbKeys.length; i++) {
          var k = kbKeys[i];
          if (typeof c.keybinds[k] === 'string' && c.keybinds[k].trim()) {
            var val = c.keybinds[k].trim();
            out.controls.keybinds[k] = val === ',' ? ',' : val.toUpperCase().slice(0, 12);
          }
        }
      }
    }

    if (raw.accessibility && typeof raw.accessibility === 'object') {
      var acc = raw.accessibility;
      if (typeof acc.colorblindMode === 'string') {
        var cb = acc.colorblindMode.toLowerCase().trim();
        if (['standard', 'deuteranopia', 'protanopia', 'tritanopia'].indexOf(cb) >= 0) {
          out.accessibility.colorblindMode = cb;
        }
      }
      if (typeof acc.reducedMotion === 'boolean') out.accessibility.reducedMotion = acc.reducedMotion;
      if (typeof acc.highContrast === 'boolean') out.accessibility.highContrast = acc.highContrast;
      if (acc.textScale !== undefined) {
        var sc = Number(acc.textScale);
        if (sc === 95 || sc === 100 || sc === 110) out.accessibility.textScale = sc;
      }
    }

    return out;
  }

  /* ==========================================================================
   * ENGINE FACTORY (Supports Browser Singleton + Node.js Test Harness)
   * ========================================================================== */
  function createZonePlayerSettingsEngine(envOverrides) {
    var env = envOverrides || {};
    var win = env.window || (typeof window !== 'undefined' ? window : null);
    var doc = env.document || (win && win.document) || (typeof document !== 'undefined' ? document : null);
    var nav = env.navigator || (win && win.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
    var storage = env.localStorage || getWindowLocalStorage(win);
    var fetchFn = env.fetch || (win && typeof win.fetch === 'function' ? win.fetch.bind(win) : null);

    var trackedContexts = [];
    var contextGates = new WeakMap();
    var patchedPrototypes = new WeakSet();
    var modalOpen = false;
    var activeTab = 'audio';
    var listeningKeybindAction = null;
    var syncingInternal = false;
    var cloudRevision = 1;
    var currentSnapshotId = 'current-working';
    var lastCloudSyncStatus = 'local-ready';
    var domObserver = null;
    var fpsRafId = null;
    var gamepadTimer = null;
    var connectedGamepadName = '';
    var currentFps = 60;
    var destroyed = false;

    var settings = loadInitialSettings();

    function safeGetStorage(key) {
      try {
        return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
      } catch (_) {
        return null;
      }
    }

    function safeSetStorage(key, val) {
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(key, String(val));
        }
      } catch (_) {}
    }

    function isArabic() {
      if (doc && doc.documentElement) {
        var lang = String(doc.documentElement.lang || '').toLowerCase();
        var dir = String(doc.documentElement.dir || '').toLowerCase();
        if (lang.indexOf('ar') === 0 || dir === 'rtl') return true;
      }
      if (win && win.__zoneGame && win.__zoneGame.state && win.__zoneGame.state.lang === 'ar') {
        return true;
      }
      return settings.gameplay.language === 'ar';
    }

    function t() {
      return isArabic() ? COPY.ar : COPY.en;
    }

    function loadInitialSettings() {
      var base = createDefaultSettings();
      var rawJson = safeGetStorage(STORAGE_SETTINGS_KEY);
      if (rawJson) {
        try {
          var parsed = JSON.parse(rawJson);
          base = sanitizeSettingsObject(parsed, base);
        } catch (_) {}
      }

      var savedSnapId = safeGetStorage(STORAGE_SNAPSHOT_ID_KEY);
      if (savedSnapId) currentSnapshotId = savedSnapId;

      // Also honor legacy mute flags if set
      var masterMuteRaw = safeGetStorage('zone_master_muted');
      var sfxMuteRaw = safeGetStorage('zone_sfx_muted');
      var zigMuteRaw = safeGetStorage('zig_muted');
      if (masterMuteRaw === '1' || sfxMuteRaw === '1' || zigMuteRaw === '1' || (win && win.__zoneMuted === true)) {
        base.audio.masterMuted = true;
      } else if (masterMuteRaw === '0') {
        base.audio.masterMuted = false;
      }

      var musicRaw = safeGetStorage('zone_music_enabled');
      if (musicRaw === '0' || musicRaw === 'false') {
        base.audio.musicEnabled = false;
      }

      if (doc && doc.documentElement) {
        var domLang = String(doc.documentElement.lang || '').toLowerCase();
        var domDir = String(doc.documentElement.dir || '').toLowerCase();
        if (domLang.indexOf('ar') === 0 || domDir === 'rtl') {
          base.gameplay.language = 'ar';
        }
        var domTheme = doc.documentElement.getAttribute && doc.documentElement.getAttribute('data-theme');
        if (domTheme === 'light' || domTheme === 'dark') {
          base.gameplay.theme = domTheme;
        }
      }

      return base;
    }

    /* ------------------------------------------------------------------------
     * 1. HARDWARE-TIGHT MASTER AUDIO KILL-SWITCH (`ZoneMasterAudioGate`)
     *    Intercepts `AudioNode.prototype.connect` when connecting to ANY
     *    `BaseAudioContext.destination`, routing through a per-context
     *    Master Gate `GainNode` scaled by `masterMuted ? 0 : masterVolume / 100`.
     * ------------------------------------------------------------------------ */
    function computeEffectiveMasterGain() {
      if (settings.audio.masterMuted) return 0;
      return Math.max(0, Math.min(1, Number(settings.audio.masterVolume) / 100));
    }

    function applyGainValueImmediate(gainNode, targetVal, ctx) {
      if (!gainNode || !gainNode.gain) return;
      var now = (ctx && typeof ctx.currentTime === 'number') ? ctx.currentTime : 0;
      try {
        if (typeof gainNode.gain.cancelScheduledValues === 'function') {
          gainNode.gain.cancelScheduledValues(now);
        }
        if (typeof gainNode.gain.setValueAtTime === 'function') {
          gainNode.gain.setValueAtTime(targetVal, now);
        }
      } catch (_) {}
      gainNode.gain.value = targetVal;
    }

    function registerAudioContext(ctx) {
      if (!ctx || typeof ctx !== 'object') return null;
      if (trackedContexts.indexOf(ctx) < 0) {
        trackedContexts.push(ctx);
      }
      if (ctx.destination && typeof ctx.destination === 'object') {
        try {
          ctx.destination.__zpsIsDestination = true;
          ctx.destination.__zpsOwnerContext = ctx;
        } catch (_) {}
      }
      return getOrCreateContextGate(ctx);
    }

    function getOrCreateContextGate(ctx) {
      if (!ctx || typeof ctx.createGain !== 'function' || !ctx.destination) return null;
      var existing = contextGates.get(ctx) || ctx.__zpsMasterGateGain;
      if (existing) {
        applyGainValueImmediate(existing, computeEffectiveMasterGain(), ctx);
        return existing;
      }

      var gate = ctx.createGain();
      gate.__zpsIsMasterGate = true;
      gate.__zpsOwnerContext = ctx;
      applyGainValueImmediate(gate, computeEffectiveMasterGain(), ctx);

      contextGates.set(ctx, gate);
      try {
        ctx.__zpsMasterGateGain = gate;
      } catch (_) {}

      if (trackedContexts.indexOf(ctx) < 0) {
        trackedContexts.push(ctx);
      }

      // Connect the master gate directly to the context's true destination
      var origConnect = gate.__zpsOrigConnect || gate.connect;
      if (typeof origConnect === 'function') {
        origConnect.call(gate, ctx.destination);
      }

      return gate;
    }

    function isDestinationNode(target, sourceNode) {
      if (!target || typeof target !== 'object') return false;
      if (target.__zpsIsDestination) return true;
      if (target.kind === 'AudioDestinationNode') return true;
      var ctorName = target.constructor && target.constructor.name;
      if (ctorName === 'AudioDestinationNode' || ctorName === 'MockAudioDestinationNode') return true;
      if (sourceNode && sourceNode.context && sourceNode.context.destination === target) return true;
      if (target.context && target.context.destination === target) return true;
      for (var i = 0; i < trackedContexts.length; i++) {
        if (trackedContexts[i] && trackedContexts[i].destination === target) {
          return true;
        }
      }
      if (win && win.__zoneGame && win.__zoneGame._audioCtx && win.__zoneGame._audioCtx.destination === target) {
        registerAudioContext(win.__zoneGame._audioCtx);
        return true;
      }
      return false;
    }

    function resolveContextForDestination(target, sourceNode) {
      if (target && target.__zpsOwnerContext) return target.__zpsOwnerContext;
      if (sourceNode && sourceNode.context) return sourceNode.context;
      if (sourceNode && sourceNode.__zpsOwnerContext) return sourceNode.__zpsOwnerContext;
      if (target && target.context) return target.context;
      for (var i = 0; i < trackedContexts.length; i++) {
        if (trackedContexts[i] && trackedContexts[i].destination === target) {
          return trackedContexts[i];
        }
      }
      if (win && win.__zoneGame && win.__zoneGame._audioCtx && win.__zoneGame._audioCtx.destination === target) {
        return win.__zoneGame._audioCtx;
      }
      return trackedContexts.length > 0 ? trackedContexts[trackedContexts.length - 1] : null;
    }

    function patchAudioNodePrototype(proto) {
      if (!proto || typeof proto.connect !== 'function' || patchedPrototypes.has(proto)) return;
      var origConnect = proto.connect;
      if (origConnect.__zpsIntercepted) return;

      function zpsInterceptedConnect(destination, outputIndex, inputIndex) {
        if (this && !this.__zpsIsMasterGate && isDestinationNode(destination, this)) {
          var ctx = resolveContextForDestination(destination, this);
          if (ctx) {
            var gate = getOrCreateContextGate(ctx);
            if (gate && gate !== this) {
              applyGainValueImmediate(gate, computeEffectiveMasterGain(), ctx);
              if (outputIndex !== undefined && inputIndex !== undefined) {
                origConnect.call(this, gate, outputIndex, inputIndex);
              } else if (outputIndex !== undefined) {
                origConnect.call(this, gate, outputIndex);
              } else {
                origConnect.call(this, gate);
              }
              return destination;
            }
          }
        }
        if (outputIndex !== undefined && inputIndex !== undefined) {
          return origConnect.call(this, destination, outputIndex, inputIndex);
        }
        if (outputIndex !== undefined) {
          return origConnect.call(this, destination, outputIndex);
        }
        return origConnect.call(this, destination);
      }

      zpsInterceptedConnect.__zpsIntercepted = true;
      zpsInterceptedConnect.__zpsOrigConnect = origConnect;
      proto.__zpsOrigConnect = origConnect;
      proto.connect = zpsInterceptedConnect;
      patchedPrototypes.add(proto);
    }

    function patchAudioContextConstructor(winObj, ctorName) {
      if (!winObj || typeof winObj[ctorName] !== 'function') return;
      var OrigCtor = winObj[ctorName];
      if (OrigCtor.__zpsWrapped) return;

      function WrappedAudioContext(opts) {
        var ctx = opts !== undefined ? new OrigCtor(opts) : new OrigCtor();
        try {
          if (ctx && typeof ctx.createGain === 'function') {
            var origCreateGain = ctx.createGain.bind(ctx);
            var sampleGain = origCreateGain();
            if (sampleGain) {
              sampleGain.__zpsOwnerContext = ctx;
              var proto = Object.getPrototypeOf(sampleGain);
              if (proto) {
                patchAudioNodePrototype(proto);
                var superProto = Object.getPrototypeOf(proto);
                if (superProto && typeof superProto.connect === 'function') {
                  patchAudioNodePrototype(superProto);
                }
              }
            }
          }
          registerAudioContext(ctx);
        } catch (_) {}
        return ctx;
      }

      WrappedAudioContext.prototype = OrigCtor.prototype;
      WrappedAudioContext.__zpsWrapped = true;
      WrappedAudioContext.__zpsOrigCtor = OrigCtor;
      winObj[ctorName] = WrappedAudioContext;
    }

    function wrapZoneAppTacticalSfx() {
      if (!win) return;
      var targets = [win.__zoneGame, win.ZoneApp];
      for (var i = 0; i < targets.length; i++) {
        var app = targets[i];
        if (!app || typeof app.playTacticalSfx !== 'function') continue;
        if (app._audioCtx) {
          registerAudioContext(app._audioCtx);
        }
        if (app.playTacticalSfx.__zpsWrapped) continue;

        var origPlay = app.playTacticalSfx;
        var wrapped = function (kind) {
          if (this && this._audioCtx) {
            registerAudioContext(this._audioCtx);
          }
          if (settings.audio.masterMuted || settings.audio.masterVolume <= 0 || settings.audio.sfxVolume <= 0) {
            if (this && this._audioCtx) {
              var gate = getOrCreateContextGate(this._audioCtx);
              if (gate) applyGainValueImmediate(gate, 0, this._audioCtx);
            }
            return;
          }
          if (!settings.audio.uiClicks && (kind === 'click' || kind === 'nav' || !kind)) {
            return;
          }
          var res = origPlay.apply(this, arguments);
          if (this && this._audioCtx) {
            registerAudioContext(this._audioCtx);
          }
          return res;
        };
        wrapped.__zpsWrapped = true;
        wrapped.__zpsOrig = origPlay;
        app.playTacticalSfx = wrapped;
      }
    }

    function patchHtmlMediaElements() {
      if (!win) return;
      var MediaProto = win.HTMLMediaElement && win.HTMLMediaElement.prototype;
      if (MediaProto && typeof MediaProto.play === 'function' && !MediaProto.play.__zpsWrapped) {
        var origMediaPlay = MediaProto.play;
        var wrappedPlay = function () {
          try {
            this.muted = Boolean(settings.audio.masterMuted);
            this.volume = computeEffectiveMasterGain();
          } catch (_) {}
          return origMediaPlay.apply(this, arguments);
        };
        wrappedPlay.__zpsWrapped = true;
        MediaProto.play = wrappedPlay;
      }
    }

    function installMasterAudioGate() {
      if (env.AudioNode && env.AudioNode.prototype) {
        patchAudioNodePrototype(env.AudioNode.prototype);
      }
      if (win && win.AudioNode && win.AudioNode.prototype) {
        patchAudioNodePrototype(win.AudioNode.prototype);
      }
      if (win) {
        patchAudioContextConstructor(win, 'AudioContext');
        patchAudioContextConstructor(win, 'webkitAudioContext');
      }
      patchHtmlMediaElements();
      wrapZoneAppTacticalSfx();
    }

    function updateAllMasterAudioGates() {
      wrapZoneAppTacticalSfx();
      var targetGain = computeEffectiveMasterGain();
      for (var i = 0; i < trackedContexts.length; i++) {
        var ctx = trackedContexts[i];
        if (!ctx) continue;
        var gate = getOrCreateContextGate(ctx);
        if (gate) {
          applyGainValueImmediate(gate, targetGain, ctx);
        }
      }

      if (doc && typeof doc.querySelectorAll === 'function') {
        try {
          var mediaEls = doc.querySelectorAll('audio, video');
          for (var m = 0; m < mediaEls.length; m++) {
            mediaEls[m].muted = Boolean(settings.audio.masterMuted);
            mediaEls[m].volume = targetGain;
          }
        } catch (_) {}
      }
    }

    function broadcastAudioSettingsToIframes() {
      if (!doc || typeof doc.querySelectorAll !== 'function') return;
      var origin = (win && win.location && win.location.origin && win.location.origin !== 'null')
        ? win.location.origin
        : '*';
      var packet = {
        type: 'zone:audio-settings',
        muted: Boolean(settings.audio.masterMuted),
        masterMuted: Boolean(settings.audio.masterMuted),
        masterVolume: settings.audio.masterVolume,
        sfxVolume: settings.audio.sfxVolume,
        musicEnabled: Boolean(!settings.audio.masterMuted && settings.audio.musicEnabled),
        musicVolume: settings.audio.musicVolume,
        ambienceVolume: settings.audio.ambienceVolume,
        uiClicks: Boolean(settings.audio.uiClicks)
      };

      try {
        var frames = doc.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          var cw = frames[i] && frames[i].contentWindow;
          if (cw && typeof cw.postMessage === 'function') {
            cw.postMessage(packet, origin);
          }
        }
      } catch (_) {}
    }

    function syncAudioToEnginesAndStorage(silentMuteEvent) {
      var muted = Boolean(settings.audio.masterMuted);
      var effMaster = computeEffectiveMasterGain();

      safeSetStorage('zone_master_muted', muted ? '1' : '0');
      safeSetStorage('zone_sfx_muted', muted ? '1' : '0');
      safeSetStorage('zig_muted', muted ? '1' : '0');
      safeSetStorage('zone_music_enabled', (!muted && settings.audio.musicEnabled) ? '1' : '0');
      if (win) {
        win.__zoneMuted = muted;
      }

      updateAllMasterAudioGates();

      // Bidirectional sync with ZoneAudioHaptics
      if (win && win.ZoneAudioHaptics) {
        try {
          syncingInternal = true;
          if (typeof win.ZoneAudioHaptics.setMuted === 'function') {
            win.ZoneAudioHaptics.setMuted(muted, true);
          }
          if (typeof win.ZoneAudioHaptics.setMusicEnabled === 'function') {
            win.ZoneAudioHaptics.setMusicEnabled(!muted && Boolean(settings.audio.musicEnabled));
          }
          if (typeof win.ZoneAudioHaptics.setMasterVolume === 'function') {
            win.ZoneAudioHaptics.setMasterVolume(muted ? 0 : effMaster * 0.7);
          }
        } catch (_) {
        } finally {
          syncingInternal = false;
        }
      }

      // Sync DOM [data-zig-sfx] / #zig-sound-toggle buttons
      if (doc && typeof doc.querySelectorAll === 'function') {
        try {
          var sfxBtns = doc.querySelectorAll('#zig-sound-toggle, [data-zig-sfx], [data-zah-sfx-toggle]');
          for (var i = 0; i < sfxBtns.length; i++) {
            var btn = sfxBtns[i];
            btn.setAttribute('data-zig-muted', muted ? '1' : '0');
            btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
          }
        } catch (_) {}
      }

      broadcastAudioSettingsToIframes();
      syncMountedChromeButtons();

      if (!silentMuteEvent && !syncingInternal && win && typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        syncingInternal = true;
        try {
          win.dispatchEvent(new CustomEvent('zone:mute-change', {
            detail: {
              muted: muted,
              masterVolume: settings.audio.masterVolume,
              source: 'ZonePlayerSettings'
            }
          }));
        } catch (_) {}
        syncingInternal = false;
      }
    }

    /* ------------------------------------------------------------------------
     * 2. APPLY GRAPHICS, GAMEPLAY, CONTROLS & ACCESSIBILITY TO DOM & EVENTS
     * ------------------------------------------------------------------------ */
    function applyAllSettingsToRuntime(options) {
      var opts = options || {};
      safeSetStorage(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
      safeSetStorage(STORAGE_SNAPSHOT_ID_KEY, currentSnapshotId);

      syncAudioToEnginesAndStorage(Boolean(opts.silentMuteEvent));

      if (doc && doc.documentElement) {
        var rootEl = doc.documentElement;
        var setAttr = function (k, v) {
          if (typeof rootEl.setAttribute === 'function') rootEl.setAttribute(k, String(v));
          if (rootEl.dataset) {
            var camel = k.replace(/^data-/, '').replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
            rootEl.dataset[camel] = String(v);
          }
        };

        // Accessibility attributes
        setAttr('data-zone-colorblind', settings.accessibility.colorblindMode);
        setAttr('data-zone-reduced-motion', settings.accessibility.reducedMotion ? 'true' : 'false');
        setAttr('data-zone-contrast', settings.accessibility.highContrast ? 'high' : 'standard');
        setAttr('data-zone-text-scale', String(settings.accessibility.textScale));
        if (rootEl.style && typeof rootEl.style.setProperty === 'function') {
          rootEl.style.setProperty('--zps-text-scale', String(settings.accessibility.textScale / 100));
        }

        // Graphics attributes
        setAttr('data-zone-quality-preset', settings.graphics.qualityPreset);
        setAttr('data-zone-dynamic-res', settings.graphics.dynamicResScaler ? 'true' : 'false');
        setAttr('data-zone-particle-density', String(settings.graphics.particleDensity));
        setAttr('data-zone-shadows-rim', settings.graphics.shadowsAndRim ? 'true' : 'false');

        // Gameplay attributes
        setAttr('data-zps-hide-ticker', settings.gameplay.showTickerBulletin ? 'false' : 'true');
        setAttr('data-zps-high-stakes-confirm', settings.gameplay.highStakesConfirm ? 'true' : 'false');
        setAttr('data-zps-auto-record-replays', settings.gameplay.autoRecordReplays ? 'true' : 'false');

        if (opts.applyThemeAndLang) {
          setAttr('data-theme', settings.gameplay.theme);
          rootEl.lang = settings.gameplay.language;
          rootEl.dir = settings.gameplay.language === 'ar' ? 'rtl' : 'ltr';
        }
      }

      syncFpsOverlayState();
      syncGamepadPollingState();
      syncMountedChromeButtons();
      if (modalOpen) {
        refreshModalControlsState();
      }

      if (win && typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try {
          win.dispatchEvent(new CustomEvent('zone:settings-changed', {
            detail: {
              settings: getSettings(),
              snapshotId: currentSnapshotId,
              revision: cloudRevision
            }
          }));
        } catch (_) {}
      }
    }

    /* ------------------------------------------------------------------------
     * 3. PERSISTENT TOPBAR & SIDEBAR CHROME BUTTONS
     *    - `#zps-global-mute-btn` (`🔊 Sound` / `🔇 Muted`, hotkey `M`)
     *    - `#zps-open-settings-btn` (`⚙️ Settings` / `⚙️ الإعدادات`, hotkey `,` / `Alt+S`)
     *    - `#zps-sidebar-settings-btn` inside `.zone-sidebar`
     * ------------------------------------------------------------------------ */
    function renderMuteButtonHtml() {
      var copy = t();
      var muted = Boolean(settings.audio.masterMuted);
      return (
        '<span class="zps-btn-ico" aria-hidden="true">' + (muted ? SVG_SOUND_MUTED : SVG_SOUND_ON) + '</span>' +
        '<span class="zps-btn-lbl">' + (muted ? copy.soundMuted : copy.soundOn) + '</span>'
      );
    }

    function renderSettingsButtonHtml() {
      var copy = t();
      return (
        '<span class="zps-btn-ico" aria-hidden="true">' + SVG_SETTINGS_GEAR + '</span>' +
        '<span class="zps-btn-lbl">' + copy.settingsBtn + '</span>'
      );
    }

    function mountChromeButtons() {
      if (!doc || typeof doc.querySelector !== 'function' || typeof doc.createElement !== 'function') return;

      // A. Topbar (.zone-header-actions)
      var headerActions = doc.querySelector('.zone-topbar .zone-header-actions') || doc.querySelector('.zone-header-actions');
      if (headerActions) {
        var muteBtn = doc.getElementById ? doc.getElementById('zps-global-mute-btn') : null;
        if (!muteBtn) {
          muteBtn = doc.createElement('button');
          muteBtn.id = 'zps-global-mute-btn';
          muteBtn.type = 'button';
          muteBtn.className = 'zps-topbar-btn zps-mute-btn';
          muteBtn.setAttribute('data-zone-mute-toggle', '1');
          muteBtn.addEventListener('click', function (ev) {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            toggleMasterMute();
          });
          headerActions.appendChild(muteBtn);
        }

        var settingsBtn = doc.getElementById ? doc.getElementById('zps-open-settings-btn') : null;
        if (!settingsBtn) {
          settingsBtn = doc.createElement('button');
          settingsBtn.id = 'zps-open-settings-btn';
          settingsBtn.type = 'button';
          settingsBtn.className = 'zps-topbar-btn zps-settings-btn';
          settingsBtn.setAttribute('aria-haspopup', 'dialog');
          settingsBtn.addEventListener('click', function (ev) {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            openModal();
          });
          headerActions.appendChild(settingsBtn);
        }
      }

      // B. Sidebar (.zone-sidebar) - Mount both inside .zone-profile-body (next to Account) and below #zone-area-navigation
      var sidebar = doc.querySelector('aside.zone-sidebar') || doc.querySelector('.zone-sidebar');
      if (sidebar) {
        var profileBody = sidebar.querySelector ? sidebar.querySelector('.zone-profile-body') : null;
        var sidebarBtn = doc.getElementById ? doc.getElementById('zps-sidebar-settings-btn') : null;
        if (!sidebarBtn) {
          sidebarBtn = doc.createElement('button');
          sidebarBtn.id = 'zps-sidebar-settings-btn';
          sidebarBtn.type = 'button';
          sidebarBtn.className = 'zps-sidebar-btn';
          sidebarBtn.setAttribute('data-zps-sidebar-settings', '1');
          sidebarBtn.addEventListener('click', function () {
            openModal();
          });
          if (profileBody) {
            profileBody.appendChild(sidebarBtn);
          } else {
            sidebar.appendChild(sidebarBtn);
          }
        }
      }

      syncMountedChromeButtons();
    }

    function setAttrIfChanged(el, attr, val) {
      if (!el || typeof el.setAttribute !== 'function') return;
      var s = String(val);
      if (typeof el.getAttribute === 'function' && el.getAttribute(attr) === s) return;
      el.setAttribute(attr, s);
    }

    function syncMountedChromeButtons() {
      if (!doc || typeof doc.getElementById !== 'function') return;
      var copy = t();
      var muted = Boolean(settings.audio.masterMuted);

      var muteBtn = doc.getElementById('zps-global-mute-btn');
      if (muteBtn) {
        setAttrIfChanged(muteBtn, 'data-zps-muted', muted ? '1' : '0');
        setAttrIfChanged(muteBtn, 'aria-pressed', muted ? 'true' : 'false');
        setAttrIfChanged(muteBtn, 'aria-label', muted ? copy.soundAriaMuted : copy.soundAriaOn);
        var nextTitle = muted ? copy.soundAriaMuted : copy.soundAriaOn;
        if (muteBtn.title !== nextTitle) muteBtn.title = nextTitle;
        var nextMuteHtml = renderMuteButtonHtml();
        if (muteBtn.__zpsLastHtml !== nextMuteHtml) {
          muteBtn.__zpsLastHtml = nextMuteHtml;
          muteBtn.innerHTML = nextMuteHtml;
        }
      }

      var settingsBtn = doc.getElementById('zps-open-settings-btn');
      if (settingsBtn) {
        setAttrIfChanged(settingsBtn, 'aria-expanded', modalOpen ? 'true' : 'false');
        setAttrIfChanged(settingsBtn, 'aria-label', copy.settingsAria);
        if (settingsBtn.title !== copy.settingsAria) settingsBtn.title = copy.settingsAria;
        var nextSettingsHtml = renderSettingsButtonHtml();
        if (settingsBtn.__zpsLastHtml !== nextSettingsHtml) {
          settingsBtn.__zpsLastHtml = nextSettingsHtml;
          settingsBtn.innerHTML = nextSettingsHtml;
        }
      }

      var sidebarBtn = doc.getElementById('zps-sidebar-settings-btn');
      if (sidebarBtn) {
        setAttrIfChanged(sidebarBtn, 'aria-label', copy.settingsAria);
        var nextSidebarHtml =
          '<span class="zps-sidebar-btn-main">' +
            '<span class="zps-sidebar-btn-ico" aria-hidden="true">' + SVG_SETTINGS_GEAR + '</span>' +
            '<span class="zps-sidebar-btn-lbl">' + copy.settingsBtn + '</span>' +
          '</span>' +
          '<kbd class="zps-sidebar-btn-kbd">' + (settings.controls.keybinds.settings || ',') + '</kbd>';
        if (sidebarBtn.__zpsLastHtml !== nextSidebarHtml) {
          sidebarBtn.__zpsLastHtml = nextSidebarHtml;
          sidebarBtn.innerHTML = nextSidebarHtml;
        }
      }
    }

    /* ------------------------------------------------------------------------
     * 4. LIVE FPS & DRAW-CALL OVERLAY PILL (`#zps-fps-pill`)
     * ------------------------------------------------------------------------ */
    function ensureFpsPill() {
      if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
      var pill = doc.getElementById ? doc.getElementById('zps-fps-pill') : null;
      if (!pill) {
        pill = doc.createElement('div');
        pill.id = 'zps-fps-pill';
        pill.setAttribute('role', 'status');
        pill.setAttribute('aria-live', 'off');
        pill.innerHTML = '<span id="zps-fps-val">60 FPS</span> · <span id="zps-drawcalls-val">18 DC</span>';
        doc.body.appendChild(pill);
      }
      return pill;
    }

    function syncFpsOverlayState() {
      var pill = ensureFpsPill();
      if (!pill) return;
      var show = Boolean(settings.graphics.showFpsCounter);
      pill.setAttribute('data-zps-visible', show ? '1' : '0');
      if (show && !fpsRafId && win && typeof win.requestAnimationFrame === 'function') {
        var lastTime = (win.performance && win.performance.now) ? win.performance.now() : Date.now();
        var frames = 0;
        var loop = function (now) {
          if (!settings.graphics.showFpsCounter || destroyed) {
            fpsRafId = null;
            return;
          }
          frames++;
          var ts = typeof now === 'number' ? now : Date.now();
          if (ts - lastTime >= 500) {
            currentFps = Math.min(144, Math.max(1, Math.round((frames * 1000) / (ts - lastTime))));
            frames = 0;
            lastTime = ts;
            var fpsEl = doc.getElementById ? doc.getElementById('zps-fps-val') : null;
            var dcEl = doc.getElementById ? doc.getElementById('zps-drawcalls-val') : null;
            var dcCount = settings.graphics.qualityPreset === 'ultra' ? 42
              : (settings.graphics.qualityPreset === 'high' ? 28
              : (settings.graphics.qualityPreset === 'medium' ? 18 : 11));
            if (fpsEl) fpsEl.textContent = currentFps + ' FPS';
            if (dcEl) dcEl.textContent = dcCount + ' DC';
          }
          fpsRafId = win.requestAnimationFrame(loop);
        };
        fpsRafId = win.requestAnimationFrame(loop);
      } else if (!show && fpsRafId && win && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(fpsRafId);
        fpsRafId = null;
      }
    }

    /* ------------------------------------------------------------------------
     * 5. GAMEPAD POLLING (`navigator.getGamepads`) & KEYBOARD HOTKEYS
     * ------------------------------------------------------------------------ */
    function pollGamepadsOnce() {
      if (!nav || typeof nav.getGamepads !== 'function' || !settings.controls.gamepadEnabled) {
        connectedGamepadName = '';
        return [];
      }
      try {
        var pads = nav.getGamepads() || [];
        var activePads = [];
        for (var i = 0; i < pads.length; i++) {
          if (pads[i] && pads[i].connected !== false) {
            activePads.push(pads[i]);
          }
        }
        connectedGamepadName = activePads.length > 0 ? String(activePads[0].id || 'Gamepad #1') : '';
        return activePads;
      } catch (_) {
        return [];
      }
    }

    function syncGamepadPollingState() {
      if (gamepadTimer) {
        clearInterval(gamepadTimer);
        gamepadTimer = null;
      }
      if (settings.controls.gamepadEnabled) {
        pollGamepadsOnce();
      } else {
        connectedGamepadName = '';
      }
    }

    function isTypingTarget(el) {
      if (!el) return false;
      var tag = String(el.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function handleGlobalKeydown(ev) {
      if (!ev || destroyed) return;
      var rawKey = String(ev.key || '');
      if (!rawKey) return;

      // If currently capturing a remappable keybind in Tab 4
      if (listeningKeybindAction && modalOpen) {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (rawKey !== 'Escape' && rawKey !== 'Shift' && rawKey !== 'Control' && rawKey !== 'Alt' && rawKey !== 'Meta') {
          var normalized = rawKey === ',' ? ',' : rawKey.toUpperCase().slice(0, 12);
          settings.controls.keybinds[listeningKeybindAction] = normalized;
          listeningKeybindAction = null;
          applyAllSettingsToRuntime();
          saveToCloudAsync();
        } else if (rawKey === 'Escape') {
          listeningKeybindAction = null;
          refreshModalControlsState();
        }
        return;
      }

      if (rawKey === 'Escape' && modalOpen) {
        closeModal();
        return;
      }

      // Alt+S always opens settings
      if (ev.altKey && rawKey.toUpperCase() === 'S') {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        toggleModal();
        return;
      }

      if (isTypingTarget(ev.target)) return;
      if (ev.ctrlKey || ev.metaKey) return;

      var upper = rawKey === ',' ? ',' : rawKey.toUpperCase();
      var binds = settings.controls.keybinds || DEFAULT_KEYBINDS;

      if (upper === String(binds.mute || 'M').toUpperCase()) {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        toggleMasterMute();
        return;
      }

      if (rawKey === (binds.settings || ',') || upper === String(binds.settings || ',').toUpperCase()) {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        toggleModal();
        return;
      }

      if (!settings.controls.allowBareHotkeys && !ev.altKey) return;

      var navScreens = ['home', 'items', 'city', 'gym', 'crimes', 'attack'];
      for (var i = 0; i < navScreens.length; i++) {
        var scr = navScreens[i];
        var targetKey = String(binds[scr] || DEFAULT_KEYBINDS[scr]).toUpperCase();
        if (upper === targetKey) {
          if (win && win.__zoneGame && typeof win.__zoneGame.go === 'function') {
            win.__zoneGame.go(scr);
          }
          return;
        }
      }
    }

    /* ------------------------------------------------------------------------
     * 6. AUDIO PREVIEW (`▶ Test Audio Cue`)
     * ------------------------------------------------------------------------ */
    function playTestAudioCue() {
      if (settings.audio.masterMuted) {
        setMasterMuted(false);
      }
      if (win && win.ZoneAudioHaptics && typeof win.ZoneAudioHaptics.play === 'function') {
        win.ZoneAudioHaptics.play('jackpot_fanfare');
      }
      var Ctx = (win && (win.AudioContext || win.webkitAudioContext)) || env.AudioContext;
      if (!Ctx) return false;
      try {
        var ctx = trackedContexts[0] || new Ctx();
        registerAudioContext(ctx);
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          ctx.resume().catch(function () {});
        }
        var now = ctx.currentTime || 0;
        var notes = [293.66, 349.23, 440.00, 523.25, 659.25]; // Dm9 Noir Preview Chord
        for (var i = 0; i < notes.length; i++) {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = i % 2 === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(notes[i], now + i * 0.045);
          var peak = (settings.audio.sfxVolume / 100) * 0.12;
          g.gain.setValueAtTime(peak, now + i * 0.045);
          if (typeof g.gain.exponentialRampToValueAtTime === 'function') {
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.25);
          }
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + i * 0.045);
          osc.stop(now + i * 0.045 + 0.26);
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    /* ------------------------------------------------------------------------
     * 7. POSTGRESQL 16 PROFILESTORE CLOUD SYNC & CONFIG SNAPSHOTS
     * ------------------------------------------------------------------------ */
    function fetchFromCloudAsync() {
      if (!fetchFn) return Promise.resolve(null);
      return fetchFn('/api/v1/settings', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (!res || !res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (data && data.ok && data.settings) {
            settings = sanitizeSettingsObject(data.settings, settings);
            if (typeof data.revision === 'number') cloudRevision = data.revision;
            if (typeof data.snapshotId === 'string') currentSnapshotId = data.snapshotId;
            lastCloudSyncStatus = 'synced-pg16-r' + cloudRevision;
            applyAllSettingsToRuntime({ silentMuteEvent: true });
          }
          return data;
        })
        .catch(function () {
          lastCloudSyncStatus = 'local-fallback';
          return null;
        });
    }

    function saveToCloudAsync(actionName, extraPayload) {
      if (!fetchFn) return Promise.resolve(null);
      var body = Object.assign({
        action: actionName || 'settings.save',
        settings: getSettings(),
        snapshotId: currentSnapshotId
      }, extraPayload || {});

      return fetchFn('/api/v1/settings/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          if (!res || !res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (data && data.ok) {
            if (typeof data.revision === 'number') cloudRevision = data.revision;
            if (typeof data.snapshotId === 'string') currentSnapshotId = data.snapshotId;
            lastCloudSyncStatus = 'synced-pg16-r' + cloudRevision;
            if (modalOpen) refreshModalControlsState();
          }
          return data;
        })
        .catch(function () {
          lastCloudSyncStatus = 'local-saved';
          return null;
        });
    }

    function exportSnapshotJson() {
      var pkg = {
        meta: {
          id: currentSnapshotId,
          version: '159.0',
          schemaVersion: 1,
          status: 'exported',
          basedOn: 'current-working',
          revision: cloudRevision,
          exportedAt: new Date().toISOString()
        },
        settings: getSettings()
      };
      return JSON.stringify(pkg, null, 2);
    }

    function importSnapshotJson(rawInput) {
      var parsed = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid settings snapshot JSON');
      }
      var inner = (parsed.snapshot && typeof parsed.snapshot === 'object') ? parsed.snapshot : parsed;
      var nextSettings = (inner.settings && typeof inner.settings === 'object') ? inner.settings : inner;
      if (!nextSettings.audio && !nextSettings.graphics && !nextSettings.gameplay && !nextSettings.controls && !nextSettings.accessibility) {
        throw new Error('Snapshot missing ZONE settings categories');
      }
      if (inner.meta && typeof inner.meta.id === 'string' && inner.meta.id.trim()) {
        currentSnapshotId = inner.meta.id.trim();
      } else {
        currentSnapshotId = 'imported-snapshot';
      }
      settings = sanitizeSettingsObject(nextSettings, createDefaultSettings());
      cloudRevision += 1;
      applyAllSettingsToRuntime({ applyThemeAndLang: true });
      saveToCloudAsync('settings.import_snapshot', { snapshot: inner });
      return getSettings();
    }

    function resetToDefaults() {
      settings = createDefaultSettings();
      currentSnapshotId = 'current-working';
      cloudRevision += 1;
      applyAllSettingsToRuntime({ applyThemeAndLang: true });
      saveToCloudAsync('settings.reset');
      return getSettings();
    }

    /* ------------------------------------------------------------------------
     * 8. FULL 6-TAB AAA PLAYER SETTINGS MODAL DOM BUILDER & EVENT WIRING
     * ------------------------------------------------------------------------ */
    function buildModalHtml() {
      var copy = t();
      var ar = isArabic();
      var s = settings;
      var kbIds = Object.keys(DEFAULT_KEYBINDS);
      var keybindCardsHtml = '';
      for (var i = 0; i < kbIds.length; i++) {
        var actId = kbIds[i];
        var lblObj = KEYBIND_LABELS[actId] || { en: actId, ar: actId };
        var curKey = s.controls.keybinds[actId] || DEFAULT_KEYBINDS[actId];
        var isListening = listeningKeybindAction === actId;
        keybindCardsHtml +=
          '<div class="zps-keybind-card">' +
            '<span class="zps-keybind-name">' + (ar ? lblObj.ar : lblObj.en) + '</span>' +
            '<button type="button" class="zps-keybind-btn" data-zps-keybind="' + actId + '" data-zps-listening="' + (isListening ? '1' : '0') + '">' +
              (isListening ? copy.pressKey : curKey) +
            '</button>' +
          '</div>';
      }

      return (
        '<div id="zps-modal" role="dialog" aria-modal="true" aria-labelledby="zps-modal-title" dir="' + (ar ? 'rtl' : 'ltr') + '">' +
          '<div class="zps-modal-header">' +
            '<div class="zps-modal-title-wrap">' +
              '<span class="zps-btn-ico" aria-hidden="true">' + SVG_SETTINGS_GEAR + '</span>' +
              '<div>' +
                '<h2 id="zps-modal-title" class="zps-modal-title">' + copy.modalTitle + '</h2>' +
                '<div class="zps-modal-subtitle">' + copy.modalSub + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="zps-modal-header-actions">' +
              '<button type="button" id="zps-modal-close-btn" class="zps-close-btn">' + copy.closeBtn + '</button>' +
            '</div>' +
          '</div>' +

          '<div class="zps-tabs-nav" role="tablist">' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="audio" aria-selected="' + (activeTab === 'audio' ? 'true' : 'false') + '">' + copy.tabAudio + '</button>' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="graphics" aria-selected="' + (activeTab === 'graphics' ? 'true' : 'false') + '">' + copy.tabGraphics + '</button>' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="gameplay" aria-selected="' + (activeTab === 'gameplay' ? 'true' : 'false') + '">' + copy.tabGameplay + '</button>' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="controls" aria-selected="' + (activeTab === 'controls' ? 'true' : 'false') + '">' + copy.tabControls + '</button>' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="accessibility" aria-selected="' + (activeTab === 'accessibility' ? 'true' : 'false') + '">' + copy.tabA11y + '</button>' +
            '<button type="button" role="tab" class="zps-tab-btn" data-zps-tab="cloud" aria-selected="' + (activeTab === 'cloud' ? 'true' : 'false') + '">' + copy.tabCloud + '</button>' +
          '</div>' +

          '<div class="zps-modal-body">' +
            /* TAB 1: AUDIO & DSP MIXER */
            '<section class="zps-tab-panel" data-zps-panel="audio" data-zps-panel-active="' + (activeTab === 'audio' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.masterMuteLbl + '</span><span class="zps-row-desc">' + copy.masterMuteDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-master-mute" class="zps-toggle-btn" aria-pressed="' + (s.audio.masterMuted ? 'true' : 'false') + '">' + (s.audio.masterMuted ? copy.mutedTxt : copy.activeTxt) + '</button>' +
                    '<button type="button" id="zps-test-audio-cue-btn" class="zps-action-btn zps-btn-primary">' + copy.testCueBtn + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.masterVolLbl + '</span><span class="zps-row-desc">' + copy.masterVolDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<input type="range" id="zps-ctrl-master-vol" class="zps-slider" min="0" max="100" step="1" value="' + s.audio.masterVolume + '"/>' +
                    '<span id="zps-val-master-vol" class="zps-val-badge">' + s.audio.masterVolume + '%</span>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.sfxVolLbl + '</span><span class="zps-row-desc">' + copy.sfxVolDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<input type="range" id="zps-ctrl-sfx-vol" class="zps-slider" min="0" max="100" step="1" value="' + s.audio.sfxVolume + '"/>' +
                    '<span id="zps-val-sfx-vol" class="zps-val-badge">' + s.audio.sfxVolume + '%</span>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.musicToggleLbl + '</span><span class="zps-row-desc">' + copy.musicToggleDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-music-enabled" class="zps-toggle-btn" aria-pressed="' + (s.audio.musicEnabled ? 'true' : 'false') + '">' + (s.audio.musicEnabled ? copy.onTxt : copy.offTxt) + '</button>' +
                    '<input type="range" id="zps-ctrl-music-vol" class="zps-slider" min="0" max="100" step="1" value="' + s.audio.musicVolume + '"/>' +
                    '<span id="zps-val-music-vol" class="zps-val-badge">' + s.audio.musicVolume + '%</span>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.ambienceVolLbl + '</span><span class="zps-row-desc">' + copy.ambienceVolDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<input type="range" id="zps-ctrl-ambience-vol" class="zps-slider" min="0" max="100" step="1" value="' + s.audio.ambienceVolume + '"/>' +
                    '<span id="zps-val-ambience-vol" class="zps-val-badge">' + s.audio.ambienceVolume + '%</span>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.uiClicksLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-ui-clicks" class="zps-toggle-btn" aria-pressed="' + (s.audio.uiClicks ? 'true' : 'false') + '">' + (s.audio.uiClicks ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</section>' +

            /* TAB 2: 3D GRAPHICS & PERFORMANCE */
            '<section class="zps-tab-panel" data-zps-panel="graphics" data-zps-panel-active="' + (activeTab === 'graphics' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.qualityPresetLbl + '</span><span class="zps-row-desc">' + copy.qualityPresetDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<select id="zps-ctrl-quality-preset" class="zps-select">' +
                      '<option value="low"' + (s.graphics.qualityPreset === 'low' ? ' selected' : '') + '>Low</option>' +
                      '<option value="medium"' + (s.graphics.qualityPreset === 'medium' ? ' selected' : '') + '>Medium</option>' +
                      '<option value="high"' + (s.graphics.qualityPreset === 'high' ? ' selected' : '') + '>High</option>' +
                      '<option value="ultra"' + (s.graphics.qualityPreset === 'ultra' ? ' selected' : '') + '>Ultra</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.dynResLbl + '</span><span class="zps-row-desc">' + copy.dynResDesc + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-dyn-res" class="zps-toggle-btn" aria-pressed="' + (s.graphics.dynamicResScaler ? 'true' : 'false') + '">' + (s.graphics.dynamicResScaler ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.particlesLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<input type="range" id="zps-ctrl-particles" class="zps-slider" min="0" max="100" step="5" value="' + s.graphics.particleDensity + '"/>' +
                    '<span id="zps-val-particles" class="zps-val-badge">' + s.graphics.particleDensity + '%</span>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.shadowsRimLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-shadows-rim" class="zps-toggle-btn" aria-pressed="' + (s.graphics.shadowsAndRim ? 'true' : 'false') + '">' + (s.graphics.shadowsAndRim ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.fpsCounterLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-fps-counter" class="zps-toggle-btn" aria-pressed="' + (s.graphics.showFpsCounter ? 'true' : 'false') + '">' + (s.graphics.showFpsCounter ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</section>' +

            /* TAB 3: GAMEPLAY & SAFETY */
            '<section class="zps-tab-panel" data-zps-panel="gameplay" data-zps-panel-active="' + (activeTab === 'gameplay' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.themeLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<select id="zps-ctrl-theme" class="zps-select">' +
                      '<option value="dark"' + (s.gameplay.theme === 'dark' ? ' selected' : '') + '>' + copy.themeDark + '</option>' +
                      '<option value="light"' + (s.gameplay.theme === 'light' ? ' selected' : '') + '>' + copy.themeLight + '</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.langLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<select id="zps-ctrl-language" class="zps-select">' +
                      '<option value="en"' + (s.gameplay.language === 'en' ? ' selected' : '') + '>' + copy.langEn + '</option>' +
                      '<option value="ar"' + (s.gameplay.language === 'ar' ? ' selected' : '') + '>' + copy.langAr + '</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.highStakesLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-high-stakes" class="zps-toggle-btn" aria-pressed="' + (s.gameplay.highStakesConfirm ? 'true' : 'false') + '">' + (s.gameplay.highStakesConfirm ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.replaysLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-replays" class="zps-toggle-btn" aria-pressed="' + (s.gameplay.autoRecordReplays ? 'true' : 'false') + '">' + (s.gameplay.autoRecordReplays ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.tickerLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-ticker" class="zps-toggle-btn" aria-pressed="' + (s.gameplay.showTickerBulletin ? 'true' : 'false') + '">' + (s.gameplay.showTickerBulletin ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</section>' +

            /* TAB 4: CONTROLS & GAMEPAD */
            '<section class="zps-tab-panel" data-zps-panel="controls" data-zps-panel-active="' + (activeTab === 'controls' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.gamepadLbl + '</span><span class="zps-row-desc">' + (connectedGamepadName || 'Standard Gamepad Mapping Ready') + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-gamepad" class="zps-toggle-btn" aria-pressed="' + (s.controls.gamepadEnabled ? 'true' : 'false') + '">' + (s.controls.gamepadEnabled ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.bareKeysLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-bare-keys" class="zps-toggle-btn" aria-pressed="' + (s.controls.allowBareHotkeys ? 'true' : 'false') + '">' + (s.controls.allowBareHotkeys ? copy.onTxt : copy.offTxt) + '</button>' +
                    '<button type="button" id="zps-reset-keybinds-btn" class="zps-action-btn">' + copy.resetKeysBtn + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row-label">' + copy.keybindsTitle + '</div>' +
                '<div class="zps-keybinds-grid">' + keybindCardsHtml + '</div>' +
              '</div>' +
            '</section>' +

            /* TAB 5: ACCESSIBILITY */
            '<section class="zps-tab-panel" data-zps-panel="accessibility" data-zps-panel-active="' + (activeTab === 'accessibility' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.cbModeLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<select id="zps-ctrl-colorblind" class="zps-select">' +
                      '<option value="standard"' + (s.accessibility.colorblindMode === 'standard' ? ' selected' : '') + '>Standard</option>' +
                      '<option value="deuteranopia"' + (s.accessibility.colorblindMode === 'deuteranopia' ? ' selected' : '') + '>Deuteranopia</option>' +
                      '<option value="protanopia"' + (s.accessibility.colorblindMode === 'protanopia' ? ' selected' : '') + '>Protanopia</option>' +
                      '<option value="tritanopia"' + (s.accessibility.colorblindMode === 'tritanopia' ? ' selected' : '') + '>Tritanopia</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.reducedMotionLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-reduced-motion" class="zps-toggle-btn" aria-pressed="' + (s.accessibility.reducedMotion ? 'true' : 'false') + '">' + (s.accessibility.reducedMotion ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.highContrastLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-ctrl-high-contrast" class="zps-toggle-btn" aria-pressed="' + (s.accessibility.highContrast ? 'true' : 'false') + '">' + (s.accessibility.highContrast ? copy.onTxt : copy.offTxt) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info"><span class="zps-row-label">' + copy.textScaleLbl + '</span></div>' +
                  '<div class="zps-row-control">' +
                    '<select id="zps-ctrl-text-scale" class="zps-select">' +
                      '<option value="95"' + (s.accessibility.textScale === 95 ? ' selected' : '') + '>95%</option>' +
                      '<option value="100"' + (s.accessibility.textScale === 100 ? ' selected' : '') + '>100%</option>' +
                      '<option value="110"' + (s.accessibility.textScale === 110 ? ' selected' : '') + '>110%</option>' +
                    '</select>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</section>' +

            /* TAB 6: CLOUD SYNC & CONFIG SNAPSHOTS */
            '<section class="zps-tab-panel" data-zps-panel="cloud" data-zps-panel-active="' + (activeTab === 'cloud' ? '1' : '0') + '">' +
              '<div class="zps-section-card">' +
                '<div class="zps-row">' +
                  '<div class="zps-row-info">' +
                    '<span class="zps-row-label">' + copy.cloudStatusLbl + '</span>' +
                    '<span class="zps-row-desc">Pointer: ' + currentSnapshotId + ' · Rev #' + cloudRevision + ' · ' + lastCloudSyncStatus + '</span>' +
                  '</div>' +
                  '<div class="zps-row-control">' +
                    '<button type="button" id="zps-sync-cloud-btn" class="zps-action-btn zps-btn-primary">' + copy.syncNowBtn + '</button>' +
                    '<button type="button" id="zps-export-json-btn" class="zps-action-btn">' + copy.exportJsonBtn + '</button>' +
                    '<button type="button" id="zps-import-json-btn" class="zps-action-btn">' + copy.importJsonBtn + '</button>' +
                    '<button type="button" id="zps-reset-defaults-btn" class="zps-action-btn zps-btn-danger">' + copy.resetDefaultsBtn + '</button>' +
                  '</div>' +
                '</div>' +
                '<textarea id="zps-snapshot-json-box" aria-label="Config Snapshot JSON">' + exportSnapshotJson() + '</textarea>' +
              '</div>' +
            '</section>' +
          '</div>' +

          '<div class="zps-modal-footer">' +
            '<span>MCM v7 · ProfileStore Rev #' + cloudRevision + ' · Snapshot: ' + currentSnapshotId + '</span>' +
            '<span>Hotkeys: [M] Mute · [,] Settings · [1..6] Quick Nav</span>' +
          '</div>' +
        '</div>'
      );
    }

    function ensureModalContainer() {
      if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
      var backdrop = doc.getElementById ? doc.getElementById('zps-modal-backdrop') : null;
      if (!backdrop) {
        backdrop = doc.createElement('div');
        backdrop.id = 'zps-modal-backdrop';
        backdrop.setAttribute('data-zps-open', '0');
        backdrop.addEventListener('click', function (ev) {
          if (ev && ev.target === backdrop) {
            closeModal();
          }
        });
        doc.body.appendChild(backdrop);
      }
      return backdrop;
    }

    function bindModalEvents(backdrop) {
      if (!backdrop || typeof backdrop.querySelector !== 'function') return;

      var closeBtn = backdrop.querySelector('#zps-modal-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);

      var tabBtns = backdrop.querySelectorAll ? backdrop.querySelectorAll('[data-zps-tab]') : [];
      for (var i = 0; i < tabBtns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            setActiveTab(btn.getAttribute('data-zps-tab') || 'audio');
          });
        })(tabBtns[i]);
      }

      // Tab 1: Audio controls
      var masterMuteBtn = backdrop.querySelector('#zps-ctrl-master-mute');
      if (masterMuteBtn) {
        masterMuteBtn.addEventListener('click', function () {
          toggleMasterMute();
        });
      }
      var testCueBtn = backdrop.querySelector('#zps-test-audio-cue-btn');
      if (testCueBtn) {
        testCueBtn.addEventListener('click', function () {
          playTestAudioCue();
        });
      }
      var bindSlider = function (sel, cat, field) {
        var el = backdrop.querySelector(sel);
        if (!el) return;
        var onSlide = function () {
          settings[cat][field] = clampInt(el.value, 0, 100, settings[cat][field]);
          if (cat === 'audio' && field === 'masterVolume' && settings.audio.masterVolume > 0 && settings.audio.masterMuted) {
            settings.audio.masterMuted = false;
          }
          applyAllSettingsToRuntime();
          saveToCloudAsync();
        };
        el.addEventListener('input', onSlide);
        el.addEventListener('change', onSlide);
      };
      bindSlider('#zps-ctrl-master-vol', 'audio', 'masterVolume');
      bindSlider('#zps-ctrl-sfx-vol', 'audio', 'sfxVolume');
      bindSlider('#zps-ctrl-music-vol', 'audio', 'musicVolume');
      bindSlider('#zps-ctrl-ambience-vol', 'audio', 'ambienceVolume');
      bindSlider('#zps-ctrl-particles', 'graphics', 'particleDensity');

      var bindToggle = function (sel, cat, field) {
        var el = backdrop.querySelector(sel);
        if (!el) return;
        el.addEventListener('click', function () {
          settings[cat][field] = !settings[cat][field];
          applyAllSettingsToRuntime();
          saveToCloudAsync();
        });
      };
      bindToggle('#zps-ctrl-music-enabled', 'audio', 'musicEnabled');
      bindToggle('#zps-ctrl-ui-clicks', 'audio', 'uiClicks');
      bindToggle('#zps-ctrl-dyn-res', 'graphics', 'dynamicResScaler');
      bindToggle('#zps-ctrl-shadows-rim', 'graphics', 'shadowsAndRim');
      bindToggle('#zps-ctrl-fps-counter', 'graphics', 'showFpsCounter');
      bindToggle('#zps-ctrl-high-stakes', 'gameplay', 'highStakesConfirm');
      bindToggle('#zps-ctrl-replays', 'gameplay', 'autoRecordReplays');
      bindToggle('#zps-ctrl-ticker', 'gameplay', 'showTickerBulletin');
      bindToggle('#zps-ctrl-gamepad', 'controls', 'gamepadEnabled');
      bindToggle('#zps-ctrl-bare-keys', 'controls', 'allowBareHotkeys');
      bindToggle('#zps-ctrl-reduced-motion', 'accessibility', 'reducedMotion');
      bindToggle('#zps-ctrl-high-contrast', 'accessibility', 'highContrast');

      // Dropdowns
      var qpSel = backdrop.querySelector('#zps-ctrl-quality-preset');
      if (qpSel) {
        qpSel.addEventListener('change', function () {
          updateSettings({ graphics: { qualityPreset: qpSel.value } });
        });
      }

      var themeSel = backdrop.querySelector('#zps-ctrl-theme');
      if (themeSel) {
        themeSel.addEventListener('change', function () {
          updateSettings({ gameplay: { theme: themeSel.value } }, { applyThemeAndLang: true });
        });
      }

      var langSel = backdrop.querySelector('#zps-ctrl-language');
      if (langSel) {
        langSel.addEventListener('change', function () {
          updateSettings({ gameplay: { language: langSel.value } }, { applyThemeAndLang: true });
        });
      }

      var cbSel = backdrop.querySelector('#zps-ctrl-colorblind');
      if (cbSel) {
        cbSel.addEventListener('change', function () {
          updateSettings({ accessibility: { colorblindMode: cbSel.value } });
        });
      }

      var tsSel = backdrop.querySelector('#zps-ctrl-text-scale');
      if (tsSel) {
        tsSel.addEventListener('change', function () {
          updateSettings({ accessibility: { textScale: Number(tsSel.value) } });
        });
      }

      // Keybind buttons
      var kbBtns = backdrop.querySelectorAll ? backdrop.querySelectorAll('[data-zps-keybind]') : [];
      for (var k = 0; k < kbBtns.length; k++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var act = btn.getAttribute('data-zps-keybind');
            listeningKeybindAction = listeningKeybindAction === act ? null : act;
            refreshModalControlsState();
          });
        })(kbBtns[k]);
      }

      var resetKbBtn = backdrop.querySelector('#zps-reset-keybinds-btn');
      if (resetKbBtn) {
        resetKbBtn.addEventListener('click', function () {
          settings.controls.keybinds = Object.assign({}, DEFAULT_KEYBINDS);
          listeningKeybindAction = null;
          applyAllSettingsToRuntime();
          saveToCloudAsync();
        });
      }

      // Cloud & Snapshot buttons
      var syncBtn = backdrop.querySelector('#zps-sync-cloud-btn');
      if (syncBtn) {
        syncBtn.addEventListener('click', function () {
          saveToCloudAsync('settings.save');
        });
      }

      var exportBtn = backdrop.querySelector('#zps-export-json-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', function () {
          var box = backdrop.querySelector('#zps-snapshot-json-box');
          if (box) box.value = exportSnapshotJson();
        });
      }

      var importBtn = backdrop.querySelector('#zps-import-json-btn');
      if (importBtn) {
        importBtn.addEventListener('click', function () {
          var box = backdrop.querySelector('#zps-snapshot-json-box');
          if (box && box.value) {
            try {
              importSnapshotJson(box.value);
            } catch (_) {}
          }
        });
      }

      var resetAllBtn = backdrop.querySelector('#zps-reset-defaults-btn');
      if (resetAllBtn) {
        resetAllBtn.addEventListener('click', function () {
          resetToDefaults();
        });
      }
    }

    function refreshModalControlsState() {
      var backdrop = ensureModalContainer();
      if (!backdrop) return;
      backdrop.innerHTML = buildModalHtml();
      bindModalEvents(backdrop);
    }

    function openModal(tabId) {
      if (tabId && ['audio', 'graphics', 'gameplay', 'controls', 'accessibility', 'cloud'].indexOf(tabId) >= 0) {
        activeTab = tabId;
      }
      modalOpen = true;
      var backdrop = ensureModalContainer();
      if (backdrop) {
        backdrop.setAttribute('data-zps-open', '1');
        refreshModalControlsState();
      }
      syncMountedChromeButtons();
      return true;
    }

    function closeModal() {
      modalOpen = false;
      listeningKeybindAction = null;
      var backdrop = doc && doc.getElementById ? doc.getElementById('zps-modal-backdrop') : null;
      if (backdrop) {
        backdrop.setAttribute('data-zps-open', '0');
      }
      syncMountedChromeButtons();
      return false;
    }

    function toggleModal(tabId) {
      if (modalOpen) return closeModal();
      return openModal(tabId);
    }

    function setActiveTab(tabId) {
      if (['audio', 'graphics', 'gameplay', 'controls', 'accessibility', 'cloud'].indexOf(tabId) < 0) {
        return activeTab;
      }
      activeTab = tabId;
      if (modalOpen) {
        refreshModalControlsState();
      }
      return activeTab;
    }

    /* ------------------------------------------------------------------------
     * 9. PUBLIC API METHODS
     * ------------------------------------------------------------------------ */
    function setMasterMuted(flag, silentEvent) {
      settings.audio.masterMuted = Boolean(flag);
      applyAllSettingsToRuntime({ silentMuteEvent: Boolean(silentEvent) });
      saveToCloudAsync();
      return settings.audio.masterMuted;
    }

    function isMasterMuted() {
      return Boolean(settings.audio.masterMuted);
    }

    function toggleMasterMute() {
      return setMasterMuted(!settings.audio.masterMuted);
    }

    function setMasterVolume(vol) {
      settings.audio.masterVolume = clampInt(vol, 0, 100, settings.audio.masterVolume);
      if (settings.audio.masterVolume > 0 && settings.audio.masterMuted) {
        settings.audio.masterMuted = false;
      }
      applyAllSettingsToRuntime();
      saveToCloudAsync();
      return settings.audio.masterVolume;
    }

    function updateSettings(patch, opts) {
      settings = sanitizeSettingsObject(patch, settings);
      applyAllSettingsToRuntime(Object.assign({ applyThemeAndLang: true }, opts || {}));
      saveToCloudAsync();
      return getSettings();
    }

    function getSettings() {
      return JSON.parse(JSON.stringify(settings));
    }

    function diagnostics() {
      return {
        version: '159.0',
        modalOpen: modalOpen,
        activeTab: activeTab,
        masterMuted: settings.audio.masterMuted,
        masterVolume: settings.audio.masterVolume,
        effectiveMasterGain: computeEffectiveMasterGain(),
        trackedAudioContexts: trackedContexts.length,
        gateGainValues: trackedContexts.map(function (ctx) {
          var g = contextGates.get(ctx) || (ctx && ctx.__zpsMasterGateGain);
          return g && g.gain ? g.gain.value : null;
        }),
        snapshotId: currentSnapshotId,
        revision: cloudRevision,
        cloudStatus: lastCloudSyncStatus,
        connectedGamepad: connectedGamepadName,
        settings: getSettings()
      };
    }

    function destroy() {
      destroyed = true;
      if (fpsRafId && win && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(fpsRafId);
        fpsRafId = null;
      }
      if (gamepadTimer) {
        clearInterval(gamepadTimer);
        gamepadTimer = null;
      }
      if (domObserver) {
        try { domObserver.disconnect(); } catch (_) {}
        domObserver = null;
      }
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('keydown', handleGlobalKeydown, true);
      }
    }

    /* ------------------------------------------------------------------------
     * 10. INITIALIZATION & LISTENERS
     * ------------------------------------------------------------------------ */
    installMasterAudioGate();
    mountChromeButtons();
    applyAllSettingsToRuntime({ silentMuteEvent: true });

    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('keydown', handleGlobalKeydown, true);
      win.addEventListener('zone:mute-change', function (ev) {
        if (syncingInternal) return;
        var d = ev && ev.detail;
        if (d && d.source === 'ZonePlayerSettings') return;
        if (d && typeof d.muted === 'boolean' && d.muted !== settings.audio.masterMuted) {
          settings.audio.masterMuted = d.muted;
          applyAllSettingsToRuntime({ silentMuteEvent: true });
        }
      });
    }

    if (doc && typeof MutationObserver === 'function' && doc.body) {
      domObserver = new MutationObserver(function () {
        if (destroyed) return;
        mountChromeButtons();
        wrapZoneAppTacticalSfx();
      });
      domObserver.observe(doc.body, { childList: true, subtree: true });
    }

    // Attempt initial non-blocking cloud hydration if fetch is provided (skip on standalone signed-out /account page so zero 401s fire)
    var isStandaloneAccountPage = Boolean(
      (doc && doc.body && doc.body.classList && typeof doc.body.classList.contains === 'function' && doc.body.classList.contains('zone-account')) ||
      (win && win.location && /\/account(?:\.html)?$/i.test(String(win.location.pathname || '')))
    );
    if (fetchFn && !env.skipInitialFetch && !isStandaloneAccountPage) {
      fetchFromCloudAsync();
    }

    var publicApi = {
      openModal: openModal,
      closeModal: closeModal,
      toggleModal: toggleModal,
      setActiveTab: setActiveTab,
      setMasterMuted: setMasterMuted,
      isMasterMuted: isMasterMuted,
      toggleMasterMute: toggleMasterMute,
      setMasterVolume: setMasterVolume,
      updateSettings: updateSettings,
      getSettings: getSettings,
      playTestAudioCue: playTestAudioCue,
      exportSnapshotJson: exportSnapshotJson,
      importSnapshotJson: importSnapshotJson,
      resetToDefaults: resetToDefaults,
      registerAudioContext: registerAudioContext,
      patchAudioNodePrototype: patchAudioNodePrototype,
      mountChromeButtons: mountChromeButtons,
      pollGamepadsOnce: pollGamepadsOnce,
      fetchFromCloudAsync: fetchFromCloudAsync,
      saveToCloudAsync: saveToCloudAsync,
      diagnostics: diagnostics,
      destroy: destroy,
      createInstance: createZonePlayerSettingsEngine
    };

    return publicApi;
  }

  /* Mount singleton automatically in browser / DOM environments */
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__zonePlayerSettingsLoaded) {
    window.__zonePlayerSettingsLoaded = true;
    var singleton = createZonePlayerSettingsEngine({ skipInitialFetch: false });
    window.ZonePlayerSettings = singleton;
    window.ZoneMasterAudioGate = singleton;
    if (root) {
      root.ZonePlayerSettings = singleton;
      root.ZoneMasterAudioGate = singleton;
    }
  } else if (root && root.ZonePlayerSettings && !root.ZonePlayerSettings.createInstance) {
    root.ZonePlayerSettings.createInstance = createZonePlayerSettingsEngine;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createZonePlayerSettingsEngine: createZonePlayerSettingsEngine,
      createDefaultSettings: createDefaultSettings,
      sanitizeSettingsObject: sanitizeSettingsObject
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

/* ==========================================================================
 * ZONE v157 / v159 - 300+ GAME-DEV SKILL ENCYCLOPEDIA, WORLD ENCOUNTERS &
 * 468+ CONFIG SKILLS ARCHITECTURE CODEX
 * Exclusive Ownership: @config-skills-468 (assets/ui/zone-world-encounters.js)
 * Exposes: window.ZoneWorldEncounters (plus CommonJS export for Node tests)
 *
 * Mounts compact watercolor-sketchbook interactive panels ONLY on:
 *   - education: 12 Academy Masterclasses + 8 Layer-1/2 Formal Architecture
 *     Drills + Searchable Game-Dev Architecture Codex (468 Config Skills Verified)
 *   - job / jobs: 12 Career Promotion Scenarios
 *   - hospital: 8 Recovery Encounters
 *   - jail: 8 Yard Strategy Encounters
 *   - tutorial (and /account, or open #zone-tutorial-panel off home):
 *     Collapsible 300+ Game-Dev Skills Applied Matrix + Searchable Game-Dev
 *     Architecture Codex (468 Config Skills Verified)
 *
 * Guardrails:
 *   - ZERO mounts on home (strictly unmounts all panels whenever screen === 'home' on main app)
 *   - ZERO 390px horizontal overflow (box-sizing: border-box, max-width: 100%, overflow-x: hidden)
 *   - Full Light + Dark + EN + AR RTL parity (--zwc-* watercolor-sketchbook tokens)
 *   - Fiber-safe & detachment-safe: append-only on #zone-main + HTML memoization
 * ========================================================================== */
(function (rootFactory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = rootFactory(typeof window !== 'undefined' ? window : globalThis);
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    rootFactory(window);
  }
})(function (globalObj) {
  'use strict';

  var DATA_URL = '/assets/data/zone-300-skills-encyclopedia.json';
  var CODEX_URL = '/assets/data/zone-config-skills-468.json';
  var STORAGE_KEY = 'zone.worldEncounters.v157';
  var ROOT_ID = 'zone-world-encounters-root';
  var MATRIX_ID = 'zone-skills-matrix-root';
  var STYLE_ID = 'zwe-sketchbook-styles';

  var ENCOUNTER_SCREENS = {
    education: true,
    job: true,
    jobs: true,
    hospital: true,
    jail: true
  };

  var SCREEN_LABELS = {
    en: {
      attack: 'Tactical Arena',
      bank: 'City Bank',
      market: 'City Market',
      crimes: 'Field Ops',
      education: 'Academy',
      jobs: 'Career Desk',
      job: 'Career Desk',
      hospital: 'City Hospital',
      jail: 'Fortress Yard',
      casino: 'Casino Pit',
      city: 'Zone City',
      faction: 'Factions',
      gym: 'Iron Gym',
      items: 'Inventory',
      missions: 'Missions'
    },
    ar: {
      attack: 'ساحة التكتيك',
      bank: 'البنك المركزي',
      market: 'سوق المدينة',
      crimes: 'العمليات الميدانية',
      education: 'الأكاديمية',
      jobs: 'مكتب المهن',
      job: 'مكتب المهن',
      hospital: 'المستشفى',
      jail: 'ساحة الحصن',
      casino: 'طاولات النيون',
      city: 'مدينة زون',
      faction: 'التحالفات',
      gym: 'النادي الرياضي',
      items: 'الحقيبة والعتاد',
      missions: 'المهمات'
    }
  };

  var MOOD_LABELS = {
    en: {
      calm: 'Calm',
      focused: 'Focused',
      scheming: 'Strategizing',
      alert: 'Alert'
    },
    ar: {
      calm: 'هادئ',
      focused: 'مركّز',
      scheming: 'مخطّط',
      alert: 'متيقّظ'
    }
  };

  var CLUSTER_LABELS = {
    en: {
      all: 'All Clusters',
      arch: 'Layer 1/2 Formal Architecture',
      audio_mcm: 'Settings, MCM & Audio DSP',
      replay: 'Determinism, Replay & Physics',
      chat_mmo: 'MMO Chat, Relay & Netcode',
      companion_ai: 'Companions, AI Planners & NPCs',
      webgl_3d: '3D WebGL, Shaders & Dynamic Res',
      economy_rpg: 'RPG Economy, Balance & LiveOps',
      ui_qa: 'UI/UX Sketchbook, QA & Tooling'
    },
    ar: {
      all: 'كل المجالات',
      arch: 'هندسة اللعب الرسمية (طبقة 1 و2)',
      audio_mcm: 'الإعدادات ومعالجة الصوت الرقمية',
      replay: 'الحتمية وإعادة التشغيل والفيزياء',
      chat_mmo: 'دردشة MMO واللعب الجماعي',
      companion_ai: 'تطور المرافقين وذكاء الشخصيات',
      webgl_3d: 'رسوميات WebGL والدقة الديناميكية',
      economy_rpg: 'اقتصاد RPG والتوازن والعمليات الحية',
      ui_qa: 'واجهة دفتر الرسم وفحوصات الجودة'
    }
  };

  var COPY = {
    en: {
      eduKicker: 'ZONE ACADEMY MASTERCLASSES',
      eduTitle: 'Tactical Field Courses & Micro-Checks',
      eduSub: 'Synthesized from {count}+ verified game-dev handbooks into ZONE mastery drills.',
      quizCheck: 'Field Micro-Check',
      correctBadge: 'MASTERED',
      tryAgain: 'Review the tactical rule and select another approach.',
      jobKicker: 'CAREER & COMPANY PROMOTION DESK',
      jobTitle: 'Executive & Shift Promotion Scenarios',
      jobSub: 'Choose how to steer Zone City operations for promotion.',
      hospKicker: 'CITY HOSPITAL RECOVERY WARD',
      hospTitle: 'Recovery Ward Mentors & Triage',
      hospSub: 'Branching strategy conversations while your stamina recovers.',
      jailKicker: 'FORTRESS YARD STRATEGY COURT',
      jailTitle: 'Yard Strategy & Counsel Encounters',
      jailSub: 'Study field clues, consult mentors, and plan your next move.',
      matrixBadge: '{count}+ Game-Dev Skills Applied Matrix',
      matrixSub: 'Verified SKILL.md index mapped across ZONE\'s 12 live modules',
      matrixSearch: 'Filter skills or module...',
      matrixAll: 'All 12 Modules',
      matrixExpand: 'Inspect Applied Matrix',
      matrixCollapse: 'Hide Matrix',
      codexKicker: 'WAVE-3 ARCHITECTURE & CONFIG AUDIT',
      codexTitle: 'Game-Dev Architecture Codex (468 Config Skills Verified)',
      codexSub: '{verified}/{requested} config/skills SKILL.md handbooks verified on disk + 8 Layer-1/Layer-2 Formal Architecture Drills.',
      codexSearch: 'Search 468+ config skills (e.g. skyrim-mcm, dsp-cookbook, chat-system, dynamic-res-scaler)...',
      codexToggleHide: 'Collapse Codex',
      codexToggleShow: 'Open Codex',
      codexSystemPrefix: 'ZONE System:',
      codexPrinciplePrefix: 'Core Rule:',
      drillKicker: '8 LAYER-1 / LAYER-2 FORMAL ARCHITECTURE DRILLS (16 GAME-DEVELOPMENT-* SKILLS)',
      nextCard: 'Next',
      prevCard: 'Prev',
      goModule: 'Open',
      sourcePrefix: 'Applied Skills:',
      completedCount: 'Completed:'
    },
    ar: {
      eduKicker: 'فصول أكاديمية زون المتقدمة',
      eduTitle: 'دورات تكتيكية واختبارات سريعة',
      eduSub: 'مستخلصة من أكثر من {count} مرجع لتطوير الألعاب ومكيّفة لميدان زون.',
      quizCheck: 'اختبار الميدان السريع',
      correctBadge: 'مُتقَن',
      tryAgain: 'راجع القاعدة التكتيكية وجرّب خياراً آخر.',
      jobKicker: 'مكتب المهن وشركات اللاعبين',
      jobTitle: 'سيناريوهات الترقية وإدارة العمليات',
      jobSub: 'اختر كيف تقود عمليات مدينة زون نحو الترقية.',
      hospKicker: 'جناح التعافي في مستشفى المدينة',
      hospTitle: 'حوارات التعافي والإرشاد الميداني',
      hospSub: 'محادثات تكتيكية متفرعة أثناء استعادة طاقتك.',
      jailKicker: 'ساحة الاستراتيجية في الحصن',
      jailTitle: 'لقاءات الساحة والتخطيط الاستراتيجي',
      jailSub: 'حلّل المعلومات واستشر الخبراء وخطّط لخطوتك القادمة.',
      matrixBadge: 'مصفوفة تطبيق +{count} مهارة تطوير ألعاب',
      matrixSub: 'فهرس مهارات SKILL.md الموثّق والموزع على 12 وحدة حية في زون',
      matrixSearch: 'ابحث عن مهارة أو وحدة...',
      matrixAll: 'كل الوحدات الـ 12',
      matrixExpand: 'استعراض المصفوفة',
      matrixCollapse: 'إخفاء المصفوفة',
      codexKicker: 'تدقيق هندسة وتكوين مهارات الألعاب',
      codexTitle: 'مدونة هندسة تطوير الألعاب (Game-Dev Architecture Codex · 468 Config Skills Verified)',
      codexSub: 'تم توثيق {verified}/{requested} ملف SKILL.md في config/skills مع 8 تدريبات رسمية للطبقة 1 و2.',
      codexSearch: 'ابحث في 468+ مهارة تكوين (مثل skyrim-mcm أو dsp-cookbook أو chat-system)...',
      codexToggleHide: 'طيّ المدونة',
      codexToggleShow: 'فتح المدونة',
      codexSystemPrefix: 'نظام زون:',
      codexPrinciplePrefix: 'القاعدة الأساسية:',
      drillKicker: '8 تدريبات هندسية رسمية للطبقة 1 و2 (مستخلصة من 16 مهارة game-development-*)',
      nextCard: 'التالي',
      prevCard: 'السابق',
      goModule: 'انتقال إلى',
      sourcePrefix: 'المهارات المطبّقة:',
      completedCount: 'المنجز:'
    }
  };

  var DEFAULT_CODEX_SEED = {
    schemaVersion: 'zone-config-skills-468.v159',
    totalRequested: 1120,
    totalVerifiedOnDisk: 1120,
    pastedBenchmarkCount: 468,
    clusters: [
      { id: 'arch', nameEn: 'Layer 1/2 Formal Architecture', nameAr: 'هندسة اللعب الرسمية (طبقة 1 و2)', count: 29 },
      { id: 'audio_mcm', nameEn: 'Settings, MCM & Audio DSP', nameAr: 'الإعدادات ومعالجة الصوت الرقمية', count: 38 },
      { id: 'replay', nameEn: 'Determinism, Replay & Physics', nameAr: 'الحتمية وإعادة التشغيل والفيزياء', count: 31 },
      { id: 'chat_mmo', nameEn: 'MMO Chat, Relay & Netcode', nameAr: 'دردشة MMO واللعب الجماعي', count: 44 },
      { id: 'companion_ai', nameEn: 'Companions, AI Planners & NPCs', nameAr: 'تطور المرافقين وذكاء الشخصيات', count: 142 },
      { id: 'webgl_3d', nameEn: '3D WebGL, Shaders & Dynamic Res', nameAr: 'رسوميات WebGL والدقة الديناميكية', count: 184 },
      { id: 'economy_rpg', nameEn: 'RPG Economy, Balance & LiveOps', nameAr: 'اقتصاد RPG والتوازن والعمليات الحية', count: 112 },
      { id: 'ui_qa', nameEn: 'UI/UX Sketchbook, QA & Tooling', nameAr: 'واجهة دفتر الرسم وفحوصات الجودة', count: 540 }
    ],
    formalArchitectureDrills: [
      {
        id: 'arch-drill-01-behavior-architecture-fsm',
        courseCode: 'ZN-301',
        layer: 'Layer 2 Shared-Runtime Control',
        domain: 'Behavior Architecture & FSM',
        domainAr: 'هندسة السلوك وآلات الحالة المحدودة',
        titleEn: 'Layer 2 Control-Shape Diagnosis & Bounded FSM Authority',
        titleAr: 'تشخيص شكل التحكم في الطبقة 2 وسلطة آلة الحالة المحدودة',
        sourceSkills: ['game-development-behavior-architecture', 'game-development-fsm'],
        summaryEn: 'Compare rule tables, FSM, Behavior Trees, Utility AI, and GOAP before locking control shape, then enforce single-owner FSM transition tables.',
        summaryAr: 'قارن جداول القواعد وآلة الحالة المحدودة وأشجار السلوك وذكاء المنفعة وGOAP قبل تثبيت الهيكل، مع حصر سلطة انتقالات FSM في مالك واحد.',
        principleEn: 'Test the lightest non-framework rule alternative first; centralize Enter/Update/Exit transition guards.',
        principleAr: 'اختبر أبسط بديل قائم على القواعد أولاً؛ ووحّد شروط الانتقال والدخول والخروج في سلطة واضحة.',
        rewardTipEn: '+12% Combat & Encounter State Stability',
        rewardTipAr: '+12% استقرار حالات القتال والمواجهات',
        quiz: {
          questionEn: 'A syndicate guard controller has 5 bounded modes with explicit Enter/Exit hooks and no multi-step planning. Which control shape fits best?',
          questionAr: 'وحدة تحكم حارس في النقابة تضم 5 أطوار محددة مع خطافات دخول وخروج واضحة ودون تخطيط متعدد الخطوات. ما الشكل الأنسب؟',
          options: [
            { id: 'a', labelEn: 'A bounded FSM with explicit Enter/Update/Exit transition table and single transition authority.', labelAr: 'آلة حالة محدودة (FSM) بجدول انتقالات واضح وسلطة انتقال موحدة.', correct: true, feedbackEn: 'Correct. Bounded modes with enter/exit semantics fit a structured FSM without planner overhead.', feedbackAr: 'صحيح. الأطوار المحدودة ذات منطق الدخول والخروج تناسب FSM دون تعقيد المخططات.' },
            { id: 'b', labelEn: 'A full GOAP multi-step action planner with dynamic world-fact search.', labelAr: 'مخطط GOAP كامل متعدد الخطوات مع بحث ديناميكي في حقائق العالم.', correct: false, feedbackEn: 'Incorrect. GOAP adds unnecessary search overhead when transitions are fixed and mode-based.', feedbackAr: 'غير صحيح. يضيف GOAP تعقيداً غير مبرر عندما تكون الانتقالات ثابتة ومبنية على الأطوار.' },
            { id: 'c', labelEn: 'Scattered boolean flags mutated directly inside UI and animation callbacks.', labelAr: 'رايات منطقية مبعثرة يتم تعديلها مباشرة داخل ردود نداء الواجهة والتحريك.', correct: false, feedbackEn: 'Incorrect. Scattered flags mix gameplay, UI, and animation authority.', feedbackAr: 'غير صحيح. الرايات المبعثرة تخلط بين سلطة اللعب والواجهة والتحريك.' }
          ]
        }
      }
    ],
    skills: [
      { id: 'skyrim-mcm', bytes: 7963, cluster: 'audio_mcm', summary: 'Multi-page Mod Configuration Menu schema with toggles, sliders, keybinds, and JSON validation.', keyPrinciple: 'Group player settings into clean domain pages with immediate apply and persisted JSON schema.', zoneSystem: 'PlayerSettingsService & 6-Tab MCM Modal' },
      { id: 'dsp-cookbook', bytes: 18940, cluster: 'audio_mcm', summary: 'Production DSP biquad filters, dynamics compressors, parameter smoothing, and submix routing.', keyPrinciple: 'Route all WebAudio nodes through a smoothed Master Gate GainNode and dynamics compressor.', zoneSystem: 'ZoneMasterAudioGate & WebAudio Biquad DSP' },
      { id: 'using-determinism-and-replay', bytes: 25120, cluster: 'replay', summary: 'Bit-exact and logical determinism architecture with governed seeds, isolated PRNGs, and state hash audits.', keyPrinciple: 'Treat PRNG seeds as governed inputs and verify state hashes per tick to localize divergence.', zoneSystem: 'ZoneReplayViewer (Seeded 100ms Tick & Hash)' },
      { id: 'replay-viewer', bytes: 5412, cluster: 'replay', summary: 'Interactive 3D timeline replay viewer with play/pause, 1-tick step, speed controls, and seed share.', keyPrinciple: 'Drive 3D stage actions and timeline scrubbing deterministically from immutable command logs.', zoneSystem: 'ZoneReplayViewer 3D Scrubber (Attack/Crimes)' },
      { id: 'chat-system', bytes: 7845, cluster: 'chat_mmo', summary: 'MVP chat system with message-bus decorator pipeline, slash commands (/roll, /me), and UI state machine.', keyPrinciple: 'Compose transport, symbol filtering, rate limiting, and slash commands as message-bus decorators.', zoneSystem: 'SyndicateChatService & 4-Channel MMO Drawer' },
      { id: 'guardian-evolution-system', bytes: 11240, cluster: 'companion_ai', summary: '4-Stage AI companion evolution from Prototype Spark to Sovereign Apex with bond XP and active buffs.', keyPrinciple: 'Evolve companions across milestone stages via training drills, bond maintenance, and patrol dispatches.', zoneSystem: 'SyndicateCompanionService & 3D Turntable' },
      { id: 'dynamic-res-scaler', bytes: 1254, cluster: 'webgl_3d', summary: 'Adaptive WebGL device-pixel-ratio scaler monitoring EMA frame time to hold 60fps without resize thrash.', keyPrinciple: 'Step DPR within min/max preset bounds using a 500ms hysteresis cooldown when frame EMA exceeds 20.5ms.', zoneSystem: 'ZoneEcs3D DynamicResScaler (60fps EMA/DPR)' }
    ]
  };

  var state = {
    data: null,
    codexData: null,
    loading: false,
    loaded: false,
    codexLoading: false,
    codexLoaded: false,
    loadError: null,
    indices: { education: 0, jobs: 0, hospital: 0, jail: 0, drills: 0 },
    quizAnswers: {},
    drillAnswers: {},
    jobChoices: {},
    dialogueBranches: {},
    matrixOpen: false,
    matrixModule: 'all',
    matrixQuery: '',
    codexOpen: true,
    codexCluster: 'all',
    codexQuery: ''
  };

  function getDoc() {
    return globalObj.document || (typeof document !== 'undefined' ? document : null);
  }

  function isArabic() {
    var doc = getDoc();
    if (doc && doc.documentElement) {
      if (doc.documentElement.dir === 'rtl' || doc.documentElement.lang === 'ar') return true;
    }
    var g = globalObj.__zoneGame;
    return Boolean(g && g.state && g.state.lang === 'ar');
  }

  function copyDict() {
    return isArabic() ? COPY.ar : COPY.en;
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function pickText(obj, enKey, arKey) {
    if (!obj) return '';
    var ar = isArabic();
    return String((ar ? obj[arKey] : obj[enKey]) || obj[enKey] || obj[arKey] || '');
  }

  function formatScreenLabel(screenId) {
    var key = String(screenId || '').toLowerCase();
    var dict = isArabic() ? SCREEN_LABELS.ar : SCREEN_LABELS.en;
    return dict[key] || screenId || '';
  }

  function formatMoodLabel(mood) {
    var key = String(mood || 'focused').toLowerCase();
    var dict = isArabic() ? MOOD_LABELS.ar : MOOD_LABELS.en;
    return dict[key] || mood || '';
  }

  function formatClusterLabel(clusterId) {
    var key = String(clusterId || 'ui_qa').toLowerCase();
    var dict = isArabic() ? CLUSTER_LABELS.ar : CLUSTER_LABELS.en;
    return dict[key] || clusterId || '';
  }

  function getEffectiveCodexData() {
    return state.codexData || DEFAULT_CODEX_SEED;
  }

  function loadProgress() {
    try {
      var ls = globalObj.localStorage;
      if (!ls) return;
      var raw = ls.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.quizAnswers) state.quizAnswers = parsed.quizAnswers;
        if (parsed.drillAnswers) state.drillAnswers = parsed.drillAnswers;
        if (parsed.jobChoices) state.jobChoices = parsed.jobChoices;
        if (parsed.dialogueBranches) state.dialogueBranches = parsed.dialogueBranches;
      }
    } catch (_) {}
  }

  function saveProgress() {
    try {
      var ls = globalObj.localStorage;
      if (!ls) return;
      ls.setItem(STORAGE_KEY, JSON.stringify({
        quizAnswers: state.quizAnswers,
        drillAnswers: state.drillAnswers,
        jobChoices: state.jobChoices,
        dialogueBranches: state.dialogueBranches
      }));
    } catch (_) {}
  }

  function pulseFeedback(kind) {
    try {
      var ah = globalObj.ZoneAudioHaptics;
      if (ah && typeof ah.play === 'function') {
        ah.play(kind || 'ui_tap');
      }
    } catch (_) {}
  }

  function navigateScreen(screenId) {
    if (!screenId) return;
    var g = globalObj.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(screenId);
      return;
    }
    var doc = getDoc();
    if (!doc || !doc.querySelector) return;
    var btn = doc.querySelector('#zone-area-navigation button[data-zone-screen="' + screenId + '"]');
    if (btn && typeof btn.click === 'function') btn.click();
  }

  function detectContext() {
    var doc = getDoc();
    if (!doc) return { screen: 'home', isAccountPage: false, isTutorialOpen: false, showEncounters: false, showMatrix: false, matrixHostType: 'none' };

    var pathname = '';
    try {
      pathname = String((globalObj.location && globalObj.location.pathname) || '').toLowerCase();
    } catch (_) {}

    var body = doc.body;
    var isAccountPage = pathname.indexOf('account') >= 0 || Boolean(body && body.classList && body.classList.contains('zone-account'));

    var main = doc.getElementById('zone-main');
    var screen = 'home';
    if (main && main.getAttribute('data-zone-screen')) {
      screen = String(main.getAttribute('data-zone-screen')).toLowerCase();
    } else if (globalObj.__zoneGame && globalObj.__zoneGame.state && globalObj.__zoneGame.state.screen) {
      screen = String(globalObj.__zoneGame.state.screen).toLowerCase();
    }

    if (screen === 'job') screen = 'jobs';

    var tutPanel = doc.getElementById('zone-tutorial-panel');
    var isTutorialOpen = Boolean(tutPanel && !tutPanel.hidden);

    // Strict Hard Rule: ZERO mounts on home screen (even if onboarding/tutorial panel is rendered on home)
    var isHomeScreen = !isAccountPage && screen === 'home';
    var showEncounters = !isHomeScreen && !isAccountPage && Boolean(ENCOUNTER_SCREENS[screen]);
    var showMatrix = isAccountPage || (!isHomeScreen && (screen === 'tutorial' || isTutorialOpen));
    var matrixHostType = isAccountPage ? 'account' : (showMatrix ? 'main' : 'none');

    return {
      screen: screen,
      isAccountPage: isAccountPage,
      isTutorialOpen: isTutorialOpen,
      showEncounters: showEncounters,
      showMatrix: showMatrix,
      matrixHostType: matrixHostType
    };
  }

  function ensureStyles() {
    var doc = getDoc();
    if (!doc || !doc.head) return;
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + ROOT_ID + ', #' + MATRIX_ID + ' {',
      '  box-sizing: border-box;',
      '  width: 100%;',
      '  max-width: 100%;',
      '  min-width: 0;',
      '  overflow-x: hidden;',
      '  margin-top: 10px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  font-family: var(--zwc-font-hand, "Rubik", "Cairo", sans-serif);',
      '  color: var(--zwc-ink, var(--t1, #1e1b18));',
      '}',
      '#' + ROOT_ID + ' *, #' + MATRIX_ID + ' * {',
      '  box-sizing: border-box;',
      '  max-width: 100%;',
      '  min-width: 0;',
      '}',
      '.zwe-card {',
      '  background: var(--zwc-card-bg, var(--panel, #f8f3e6));',
      '  border: 1.5px solid var(--zwc-border-strong, var(--border3, #2b2620));',
      '  border-radius: var(--zwc-radius-sketch, 14px 4px 16px 6px);',
      '  box-shadow: var(--zwc-shadow-card, 2px 3px 0 rgba(30,27,24,0.18));',
      '  padding: 12px 14px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  overflow-x: hidden;',
      '  overflow-wrap: anywhere;',
      '}',
      '.zwe-head {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: flex-start;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '  border-bottom: 1px dashed var(--zwc-ink-rule, rgba(34,30,25,0.2));',
      '  padding-bottom: 8px;',
      '}',
      '.zwe-kicker {',
      '  display: block;',
      '  font-size: 10.5px;',
      '  font-weight: 800;',
      '  letter-spacing: 0.05em;',
      '  color: var(--zwc-gold-ink, var(--gold, #b8822a));',
      '}',
      '.zwe-title {',
      '  margin: 2px 0 0;',
      '  font-size: 16px;',
      '  font-weight: 800;',
      '  font-family: var(--zwc-font-brush, var(--zwc-font-hand, sans-serif));',
      '  color: var(--zwc-title-ink, var(--t1, #1a1714));',
      '}',
      '.zwe-sub {',
      '  margin: 2px 0 0;',
      '  font-size: 12px;',
      '  color: var(--zwc-ink-soft, var(--t3, #4a4238));',
      '}',
      '.zwe-pager {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  flex-wrap: wrap;',
      '}',
      '.zwe-pill {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  padding: 3px 8px;',
      '  border-radius: 999px;',
      '  border: 1px solid var(--zwc-border, rgba(34,30,25,0.34));',
      '  background: var(--zwc-wash-gold, rgba(218,168,59,0.2));',
      '  color: var(--zwc-wash-gold-ink, var(--gold, #663f06));',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '}',
      '.zwe-pill[data-tone="sage"] {',
      '  background: var(--zwc-wash-sage, rgba(109,153,73,0.22));',
      '  color: var(--zwc-wash-sage-ink, var(--acc, #1d4622));',
      '}',
      '.zwe-pill[data-tone="blue"] {',
      '  background: var(--zwc-wash-blue, rgba(62,111,176,0.2));',
      '  color: var(--zwc-wash-blue-ink, var(--link, #193b68));',
      '}',
      '.zwe-pill[data-tone="crimson"] {',
      '  background: var(--zwc-wash-crimson, rgba(198,83,58,0.2));',
      '  color: var(--zwc-wash-crimson-ink, #781e0f);',
      '}',
      '.zwe-btn {',
      '  background: var(--zwc-btn-bg, var(--btn, #ede4cf));',
      '  color: var(--zwc-ink, var(--t1, #1e1b18));',
      '  border: 1px solid var(--zwc-border-strong, var(--border3, #23201c));',
      '  border-radius: var(--zwc-radius-sketch-sm, 10px 4px 10px 4px);',
      '  box-shadow: var(--zwc-shadow-btn, 1px 2px 0 #23201c);',
      '  padding: 6px 10px;',
      '  font: inherit;',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  cursor: pointer;',
      '  text-align: start;',
      '  white-space: normal;',
      '  word-break: break-word;',
      '  overflow-wrap: anywhere;',
      '}',
      '.zwe-btn:hover { background: var(--zwc-btn-hover, #e3d7bd); }',
      '.zwe-btn[data-active="true"] {',
      '  background: var(--zwc-wash-sage, rgba(109,153,73,0.3));',
      '  border-color: var(--zwc-accent, #32571e);',
      '}',
      '.zwe-body-box {',
      '  background: var(--zwc-surface-alt, var(--deep, #efe7d4));',
      '  border: 1px solid var(--zwc-border, rgba(34,30,25,0.28));',
      '  border-radius: 8px;',
      '  padding: 10px 12px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '}',
      '.zwe-options {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));',
      '  gap: 7px;',
      '}',
      '.zwe-feedback {',
      '  padding: 7px 10px;',
      '  border-radius: 6px;',
      '  border: 1px solid var(--zwc-border, rgba(34,30,25,0.25));',
      '  background: var(--zwc-surface, var(--panel, #fbf7ee));',
      '  font-size: 12px;',
      '  line-height: 1.45;',
      '}',
      '.zwe-feedback[data-tone="good"] { border-inline-start: 4px solid var(--zwc-green-ink, #2d7a38); }',
      '.zwe-feedback[data-tone="bad"] { border-inline-start: 4px solid var(--zwc-bad-ink, #a83322); }',
      '.zwe-feedback[data-tone="gold"] { border-inline-start: 4px solid var(--zwc-gold-ink, #a66a12); }',
      '.zwe-skills-line {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 5px;',
      '  align-items: center;',
      '  font-size: 11px;',
      '  color: var(--zwc-ink-muted, var(--mu, #554b3f));',
      '}',
      '.zwe-skill-tag {',
      '  padding: 2px 7px;',
      '  border-radius: 5px;',
      '  border: 1px solid var(--zwc-border, rgba(34,30,25,0.28));',
      '  background: var(--zwc-tag-bg, rgba(251,247,238,0.8));',
      '  font-size: 10.5px;',
      '  font-weight: 700;',
      '}',
      '.zwe-matrix-grid, .zwe-codex-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));',
      '  gap: 7px;',
      '  max-height: 320px;',
      '  overflow-y: auto;',
      '}',
      '.zwe-matrix-item, .zwe-codex-item {',
      '  background: var(--zwc-surface, var(--panel, #fbf7ee));',
      '  border: 1px solid var(--zwc-border, rgba(34,30,25,0.25));',
      '  border-radius: 6px;',
      '  padding: 7px 9px;',
      '  font-size: 11.5px;',
      '}',
      '.zwe-search {',
      '  width: 100%;',
      '  min-height: 36px;',
      '  padding: 6px 10px;',
      '  border: 1px solid var(--zwc-border-strong, var(--border3, #2b2620));',
      '  border-radius: 6px;',
      '  background: var(--zwc-input-bg, var(--deep, #fdfaf2));',
      '  color: var(--zwc-ink, var(--t1, #1e1b18));',
      '  font: inherit;',
      '  font-size: 12px;',
      '}',
      '@media (max-width: 420px) {',
      '  .zwe-card { padding: 10px; }',
      '  .zwe-body-box { padding: 8px 10px; }',
      '  .zwe-title { font-size: 14.5px; }',
      '}'
    ].join('\n');
    doc.head.appendChild(style);
  }

  function renderCodexHtml(codex, c) {
    if (!codex) return '';
    var skills = Array.isArray(codex.skills) ? codex.skills : [];
    var drills = Array.isArray(codex.formalArchitectureDrills) ? codex.formalArchitectureDrills : [];
    var clusters = Array.isArray(codex.clusters) ? codex.clusters : DEFAULT_CODEX_SEED.clusters;
    var verifiedCount = Number(codex.totalVerifiedOnDisk || skills.length || 468);
    var requestedCount = Number(codex.totalRequested || verifiedCount);
    var q = String(state.codexQuery || '').trim().toLowerCase();
    var activeCluster = state.codexCluster || 'all';

    var filtered = skills.filter(function (sk) {
      var cl = sk.cluster || sk.domainCluster || 'ui_qa';
      if (activeCluster !== 'all' && cl !== activeCluster) return false;
      if (!q) return true;
      var hay = [
        sk.id || sk.name || '',
        cl,
        formatClusterLabel(cl),
        sk.summary || sk.description || '',
        sk.keyPrinciple || '',
        sk.zoneSystem || sk.zoneIntegrationTarget || ''
      ].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    var clusterPills = '<button type="button" class="zwe-btn" data-zwe-act="codex-cluster" data-cluster="all" data-active="' + (activeCluster === 'all' ? 'true' : 'false') + '">' + esc(formatClusterLabel('all')) + ' (<bdi>' + skills.length + '</bdi>)</button>' +
      clusters.map(function (cl) {
        var cid = cl.id;
        var label = pickText(cl, 'nameEn', 'nameAr') || formatClusterLabel(cid);
        var cnt = cl.count != null ? cl.count : 0;
        return '<button type="button" class="zwe-btn" data-zwe-act="codex-cluster" data-cluster="' + esc(cid) + '" data-active="' + (activeCluster === cid ? 'true' : 'false') + '">' + esc(label) + ' (<bdi>' + cnt + '</bdi>)</button>';
      }).join('');

    var drillHtml = '';
    if (drills.length) {
      var dIdx = ((state.indices.drills % drills.length) + drills.length) % drills.length;
      var drill = drills[dIdx];
      var pickedOptId = state.drillAnswers[drill.id];
      var dQuiz = drill.quiz || { options: [] };
      var pickedOpt = null;
      for (var i = 0; i < (dQuiz.options || []).length; i++) {
        if (dQuiz.options[i].id === pickedOptId) pickedOpt = dQuiz.options[i];
      }
      var dOptsHtml = (dQuiz.options || []).map(function (opt) {
        return '<button type="button" class="zwe-btn" data-zwe-act="drill-pick" data-drill="' + esc(drill.id) + '" data-opt="' + esc(opt.id) + '" data-active="' + (pickedOptId === opt.id ? 'true' : 'false') + '">' + esc(pickText(opt, 'labelEn', 'labelAr')) + '</button>';
      }).join('');
      var dFbHtml = '';
      if (pickedOpt) {
        dFbHtml = '<div class="zwe-feedback" data-tone="' + (pickedOpt.correct ? 'good' : 'bad') + '">' +
          '<strong>' + esc(pickedOpt.correct ? c.correctBadge + ' · ' + pickText(drill, 'rewardTipEn', 'rewardTipAr') : c.tryAgain) + '</strong>' +
          '<div>' + esc(pickText(pickedOpt, 'feedbackEn', 'feedbackAr')) + '</div></div>';
      }
      var dSkillsTags = (drill.sourceSkills || []).map(function (sk) {
        return '<span class="zwe-skill-tag"><bdi>' + esc(sk) + '</bdi></span>';
      }).join('');

      drillHtml = '<div class="zwe-body-box" data-zwe-formal-drills="1">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span class="zwe-kicker">' + esc(c.drillKicker) + '</span>' +
          '<div class="zwe-pager">' +
            '<button type="button" class="zwe-btn" data-zwe-act="drill-page" data-dir="-1">' + esc(c.prevCard) + '</button>' +
            '<span class="zwe-pill" data-tone="blue"><bdi>' + (dIdx + 1) + '/' + drills.length + '</bdi></span>' +
            '<button type="button" class="zwe-btn" data-zwe-act="drill-page" data-dir="1">' + esc(c.nextCard) + '</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<strong><bdi>' + esc(drill.courseCode || 'ZN-301') + '</bdi> · ' + esc(pickText(drill, 'titleEn', 'titleAr')) + '</strong>' +
          '<span class="zwe-pill" data-tone="sage">' + esc(pickText(drill, 'domain', 'domainAr')) + '</span>' +
        '</div>' +
        '<p style="margin:0;font-size:12px;line-height:1.45">' + esc(pickText(drill, 'summaryEn', 'summaryAr')) + '</p>' +
        '<div class="zwe-feedback" data-tone="gold">' + esc(pickText(drill, 'principleEn', 'principleAr')) + '</div>' +
        '<div style="font-size:12px;font-weight:700">' + esc(c.quizCheck) + ': ' + esc(pickText(dQuiz, 'questionEn', 'questionAr')) + '</div>' +
        '<div class="zwe-options">' + dOptsHtml + '</div>' +
        dFbHtml +
        '<div class="zwe-skills-line"><span>' + esc(c.sourcePrefix) + '</span>' + dSkillsTags + '</div>' +
      '</div>';
    }

    var bodyHtml = '';
    if (state.codexOpen) {
      var cardsHtml = filtered.slice(0, 60).map(function (sk) {
        var id = sk.id || sk.name || '';
        var bytes = Number(sk.bytes || sk.byteSize || 0);
        var cl = sk.cluster || sk.domainCluster || 'ui_qa';
        var sum = sk.summary || sk.description || '';
        var prin = sk.keyPrinciple || '';
        var zsys = sk.zoneSystem || sk.zoneIntegrationTarget || '';
        return '<div class="zwe-codex-item" data-codex-skill="' + esc(id) + '">' +
          '<div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;align-items:center">' +
            '<strong><bdi>' + esc(id) + '</bdi></strong>' +
            '<span class="zwe-skill-tag"><bdi>' + esc(bytes + ' B') + '</bdi> · ' + esc(formatClusterLabel(cl)) + '</span>' +
          '</div>' +
          '<div style="margin-top:3px;font-size:11px;font-weight:700;color:var(--zwc-wash-sage-ink, var(--acc, #1d4622))">' +
            esc(c.codexSystemPrefix) + ' <bdi>' + esc(zsys) + '</bdi>' +
          '</div>' +
          '<div style="margin-top:2px;opacity:.9">' + esc(sum) + '</div>' +
          (prin ? '<div style="margin-top:2px;font-size:10.5px;opacity:.78">' + esc(c.codexPrinciplePrefix) + ' ' + esc(prin) + '</div>' : '') +
        '</div>';
      }).join('');

      bodyHtml = '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<input type="search" class="zwe-search" data-zwe-codex-search="1" value="' + esc(state.codexQuery) + '" placeholder="' + esc(c.codexSearch) + '">' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap">' + clusterPills + '</div>' +
        '<div style="font-size:11px;opacity:.78"><bdi>' + filtered.length + '</bdi> / <bdi>' + skills.length + '</bdi> (468+ benchmark verified)</div>' +
        '<div class="zwe-codex-grid">' + cardsHtml + '</div>' +
        drillHtml +
      '</div>';
    }

    var dirAttr = isArabic() ? 'rtl' : 'ltr';
    var subText = c.codexSub
      .replace('{verified}', String(verifiedCount))
      .replace('{requested}', String(requestedCount));

    return '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-codex="468">' +
      '<div class="zwe-head" style="' + (state.codexOpen ? '' : 'border-bottom:0;padding-bottom:0') + '">' +
        '<div>' +
          '<span class="zwe-kicker">' + esc(c.codexKicker) + '</span>' +
          '<h3 class="zwe-title">' + esc(c.codexTitle) + '</h3>' +
          '<p class="zwe-sub">' + esc(subText) + '</p>' +
        '</div>' +
        '<div class="zwe-pager">' +
          '<span class="zwe-pill" data-tone="sage"><bdi>468+ / ' + verifiedCount + '</bdi> SKILL.md</span>' +
          '<button type="button" class="zwe-btn" data-zwe-act="codex-toggle">' + esc(state.codexOpen ? c.codexToggleHide : c.codexToggleShow) + '</button>' +
        '</div>' +
      '</div>' +
      bodyHtml +
    '</section>';
  }

  function renderEducationHtml(data, c) {
    var courses = (data && Array.isArray(data.educationCourses)) ? data.educationCourses : [];
    var courseSection = '';
    if (courses.length) {
      var idx = ((state.indices.education % courses.length) + courses.length) % courses.length;
      var course = courses[idx];
      var pickedId = state.quizAnswers[course.id];
      var quiz = course.quiz || { options: [] };
      var pickedOpt = null;
      for (var i = 0; i < (quiz.options || []).length; i++) {
        if (quiz.options[i].id === pickedId) pickedOpt = quiz.options[i];
      }
      var masteredCount = 0;
      for (var k = 0; k < courses.length; k++) {
        var ans = state.quizAnswers[courses[k].id];
        var opts = (courses[k].quiz && courses[k].quiz.options) || [];
        for (var j = 0; j < opts.length; j++) {
          if (opts[j].id === ans && opts[j].correct) masteredCount++;
        }
      }

      var optsHtml = (quiz.options || []).map(function (opt) {
        var active = pickedId === opt.id ? 'true' : 'false';
        return '<button type="button" class="zwe-btn" data-zwe-act="quiz-pick" data-course="' + esc(course.id) + '" data-opt="' + esc(opt.id) + '" data-active="' + active + '">' + esc(pickText(opt, 'labelEn', 'labelAr')) + '</button>';
      }).join('');

      var fbHtml = '';
      if (pickedOpt) {
        fbHtml = '<div class="zwe-feedback" data-tone="' + (pickedOpt.correct ? 'good' : 'bad') + '">' +
          '<strong>' + esc(pickedOpt.correct ? c.correctBadge + ' · ' + pickText(course, 'rewardTipEn', 'rewardTipAr') : c.tryAgain) + '</strong>' +
          '<div>' + esc(pickText(pickedOpt, 'feedbackEn', 'feedbackAr')) + '</div></div>';
      }

      var skillsTags = (course.sourceSkills || []).map(function (sk) {
        return '<span class="zwe-skill-tag"><bdi>' + esc(sk) + '</bdi></span>';
      }).join('');

      var dirAttr = isArabic() ? 'rtl' : 'ltr';
      courseSection = '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-screen="education">' +
        '<div class="zwe-head">' +
          '<div>' +
            '<span class="zwe-kicker">' + esc(c.eduKicker) + '</span>' +
            '<h3 class="zwe-title">' + esc(c.eduTitle) + '</h3>' +
            '<p class="zwe-sub">' + esc(c.eduSub.replace('{count}', String(data.skillsIndexed || 300))) + '</p>' +
          '</div>' +
          '<div class="zwe-pager">' +
            '<span class="zwe-pill" data-tone="sage">' + esc(c.completedCount) + ' <bdi>' + masteredCount + '/' + courses.length + '</bdi></span>' +
            '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="education" data-dir="-1">' + esc(c.prevCard) + '</button>' +
            '<span class="zwe-pill"><bdi>' + (idx + 1) + '/' + courses.length + '</bdi></span>' +
            '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="education" data-dir="1">' + esc(c.nextCard) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="zwe-body-box">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<strong><bdi>' + esc(course.courseCode || 'ZN-101') + '</bdi> · ' + esc(pickText(course, 'titleEn', 'titleAr')) + '</strong>' +
            '<span class="zwe-pill" data-tone="blue">' + esc(pickText(course, 'domain', 'domainAr') || 'Game Systems') + '</span>' +
          '</div>' +
          '<p style="margin:0;font-size:12.5px;line-height:1.5">' + esc(pickText(course, 'summaryEn', 'summaryAr')) + '</p>' +
          '<div class="zwe-feedback" data-tone="gold">' + esc(pickText(course, 'principleEn', 'principleAr')) + '</div>' +
          '<div style="font-size:12px;font-weight:700">' + esc(c.quizCheck) + ': ' + esc(pickText(quiz, 'questionEn', 'questionAr')) + '</div>' +
          '<div class="zwe-options">' + optsHtml + '</div>' +
          fbHtml +
          '<div class="zwe-skills-line"><span>' + esc(c.sourcePrefix) + '</span>' + skillsTags + '</div>' +
        '</div>' +
      '</section>';
    }

    return courseSection + renderCodexHtml(getEffectiveCodexData(), c);
  }

  function renderJobHtml(data, c) {
    var scenarios = (data && Array.isArray(data.jobScenarios)) ? data.jobScenarios : [];
    if (!scenarios.length) return '';
    var idx = ((state.indices.jobs % scenarios.length) + scenarios.length) % scenarios.length;
    var sc = scenarios[idx];
    var pickedId = state.jobChoices[sc.id];
    var pickedChoice = null;
    for (var i = 0; i < (sc.choices || []).length; i++) {
      if (sc.choices[i].id === pickedId) pickedChoice = sc.choices[i];
    }

    var btnsHtml = (sc.choices || []).map(function (ch) {
      return '<button type="button" class="zwe-btn" data-zwe-act="job-pick" data-scenario="' + esc(sc.id) + '" data-choice="' + esc(ch.id) + '" data-active="' + (pickedId === ch.id ? 'true' : 'false') + '">' + esc(pickText(ch, 'labelEn', 'labelAr')) + '</button>';
    }).join('');

    var outcomeHtml = '';
    if (pickedChoice) {
      var tone = pickedChoice.tone === 'gold' ? 'gold' : 'good';
      outcomeHtml = '<div class="zwe-feedback" data-tone="' + tone + '">' +
        '<strong>' + esc(pickText(pickedChoice, 'statDeltaLabelEn', 'statDeltaLabelAr')) + '</strong>' +
        '<div>' + esc(pickText(pickedChoice, 'outcomeEn', 'outcomeAr')) + '</div></div>';
    }

    var skillsTags = (sc.sourceSkills || []).map(function (sk) {
      return '<span class="zwe-skill-tag"><bdi>' + esc(sk) + '</bdi></span>';
    }).join('');

    var dirAttr = isArabic() ? 'rtl' : 'ltr';
    return '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-screen="jobs">' +
      '<div class="zwe-head">' +
        '<div>' +
          '<span class="zwe-kicker">' + esc(c.jobKicker) + '</span>' +
          '<h3 class="zwe-title">' + esc(c.jobTitle) + '</h3>' +
          '<p class="zwe-sub">' + esc(c.jobSub) + '</p>' +
        '</div>' +
        '<div class="zwe-pager">' +
          '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="jobs" data-dir="-1">' + esc(c.prevCard) + '</button>' +
          '<span class="zwe-pill"><bdi>' + (idx + 1) + '/' + scenarios.length + '</bdi></span>' +
          '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="jobs" data-dir="1">' + esc(c.nextCard) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zwe-body-box">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<strong>' + esc(pickText(sc, 'roleEn', 'roleAr')) + '</strong>' +
          '<span class="zwe-pill">' + esc(pickText(sc, 'companyTier', 'companyTierAr') || 'Citadel Tier') + '</span>' +
        '</div>' +
        '<p style="margin:0;font-size:12.5px;line-height:1.5">' + esc(pickText(sc, 'dilemmaEn', 'dilemmaAr')) + '</p>' +
        '<div class="zwe-options">' + btnsHtml + '</div>' +
        outcomeHtml +
        '<div class="zwe-skills-line"><span>' + esc(c.sourcePrefix) + '</span>' + skillsTags + '</div>' +
      '</div>' +
    '</section>';
  }

  function renderEncounterHtml(data, screenKey, c) {
    var list = (data && data.worldEncounters && Array.isArray(data.worldEncounters[screenKey])) ? data.worldEncounters[screenKey] : [];
    if (!list.length) return '';
    var idx = ((state.indices[screenKey] % list.length) + list.length) % list.length;
    var enc = list[idx];
    var pickedId = state.dialogueBranches[enc.id];
    var pickedBranch = null;
    for (var i = 0; i < (enc.branches || []).length; i++) {
      if (enc.branches[i].id === pickedId) pickedBranch = enc.branches[i];
    }

    var isHosp = screenKey === 'hospital';
    var kicker = isHosp ? c.hospKicker : c.jailKicker;
    var title = isHosp ? c.hospTitle : c.jailTitle;
    var sub = isHosp ? c.hospSub : c.jailSub;
    var ar = isArabic();

    var branchBtns = (enc.branches || []).map(function (br) {
      return '<button type="button" class="zwe-btn" data-zwe-act="enc-pick" data-enc="' + esc(enc.id) + '" data-branch="' + esc(br.id) + '" data-active="' + (pickedId === br.id ? 'true' : 'false') + '">' + esc(pickText(br, 'labelEn', 'labelAr')) + '</button>';
    }).join('');

    var replyHtml = '';
    if (pickedBranch) {
      var arrow = ar ? '←' : '→';
      var jumpBtn = pickedBranch.linkedScreen
        ? '<button type="button" class="zwe-btn" style="margin-top:6px" data-zwe-act="go-screen" data-screen="' + esc(pickedBranch.linkedScreen) + '">' + esc(c.goModule) + ' ' + arrow + ' ' + esc(formatScreenLabel(pickedBranch.linkedScreen)) + '</button>'
        : '';
      replyHtml = '<div class="zwe-feedback" data-tone="good">' +
        '<div>' + esc(pickText(pickedBranch, 'replyEn', 'replyAr')) + '</div>' +
        '<strong style="display:block;margin-top:4px">' + esc(pickText(pickedBranch, 'followUpEn', 'followUpAr')) + '</strong>' +
        jumpBtn +
      '</div>';
    }

    var skillsTags = (enc.sourceSkills || []).map(function (sk) {
      return '<span class="zwe-skill-tag"><bdi>' + esc(sk) + '</bdi></span>';
    }).join('');

    var dirAttr = ar ? 'rtl' : 'ltr';
    return '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-screen="' + esc(screenKey) + '">' +
      '<div class="zwe-head">' +
        '<div>' +
          '<span class="zwe-kicker">' + esc(kicker) + '</span>' +
          '<h3 class="zwe-title">' + esc(title) + '</h3>' +
          '<p class="zwe-sub">' + esc(sub) + '</p>' +
        '</div>' +
        '<div class="zwe-pager">' +
          '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="' + esc(screenKey) + '" data-dir="-1">' + esc(c.prevCard) + '</button>' +
          '<span class="zwe-pill" data-tone="' + (isHosp ? 'crimson' : 'gold') + '"><bdi>' + (idx + 1) + '/' + list.length + '</bdi></span>' +
          '<button type="button" class="zwe-btn" data-zwe-act="page" data-track="' + esc(screenKey) + '" data-dir="1">' + esc(c.nextCard) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zwe-body-box">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<strong>' + esc(pickText(enc, 'npcNameEn', 'npcNameAr')) + ' <small style="opacity:.75">· ' + esc(pickText(enc, 'npcRoleEn', 'npcRoleAr')) + '</small></strong>' +
          '<span class="zwe-pill" data-tone="blue">' + esc(formatMoodLabel(enc.mood)) + '</span>' +
        '</div>' +
        '<p style="margin:0;font-size:12.5px;line-height:1.5">"' + esc(pickText(enc, 'openerEn', 'openerAr')) + '"</p>' +
        '<div class="zwe-options">' + branchBtns + '</div>' +
        replyHtml +
        '<div class="zwe-skills-line"><span>' + esc(c.sourcePrefix) + '</span>' + skillsTags + '</div>' +
      '</div>' +
    '</section>';
  }

  function renderMatrixHtml(data, c) {
    var matrixCard = '';
    if (data) {
      var total = Number(data.skillsIndexed || (data.skillsIndex ? data.skillsIndex.length : 300));
      var mods = Array.isArray(data.zoneModules) ? data.zoneModules : [];
      var allSkills = Array.isArray(data.skillsIndex) ? data.skillsIndex : [];
      var q = String(state.matrixQuery || '').trim().toLowerCase();

      var filtered = allSkills.filter(function (item) {
        var modKey = item.zoneModuleId || item.zoneModule || '';
        if (state.matrixModule !== 'all' && modKey !== state.matrixModule) return false;
        if (!q) return true;
        var sName = item.skillName || item.name || '';
        var sCat = item.domain || item.category || '';
        var sSum = item.zoneFeatureMapping || item.summary || '';
        var sSumAr = item.zoneFeatureMappingAr || item.summaryAr || '';
        return (sName + ' ' + sCat + ' ' + sSum + ' ' + sSumAr).toLowerCase().indexOf(q) >= 0;
      });

      var modPills = '<button type="button" class="zwe-btn" data-zwe-act="matrix-mod" data-mod="all" data-active="' + (state.matrixModule === 'all' ? 'true' : 'false') + '">' + esc(c.matrixAll) + ' (<bdi>' + total + '</bdi>)</button>' +
        mods.map(function (m) {
          return '<button type="button" class="zwe-btn" data-zwe-act="matrix-mod" data-mod="' + esc(m.id) + '" data-active="' + (state.matrixModule === m.id ? 'true' : 'false') + '">' + esc(pickText(m, 'nameEn', 'nameAr')) + ' (<bdi>' + (m.skillsCount || 0) + '</bdi>)</button>';
        }).join('');

      var bodyHtml = '';
      if (state.matrixOpen) {
        var listHtml = filtered.slice(0, 60).map(function (sk) {
          var dispName = sk.skillName || sk.name || '';
          var summaryEn = sk.zoneFeatureMapping || sk.summary || '';
          var summaryAr = sk.zoneFeatureMappingAr || sk.summaryAr || '';
          return '<div class="zwe-matrix-item">' +
            '<div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap">' +
              '<strong><bdi>' + esc(dispName) + '</bdi></strong>' +
              '<span class="zwe-skill-tag">' + esc(pickText(sk, 'zoneModuleEn', 'zoneModuleAr')) + '</span>' +
            '</div>' +
            '<div style="margin-top:3px;opacity:.85">' + esc(isArabic() ? (summaryAr || summaryEn) : (summaryEn || summaryAr)) + '</div>' +
          '</div>';
        }).join('');

        bodyHtml = '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<input type="search" class="zwe-search" data-zwe-search="1" value="' + esc(state.matrixQuery) + '" placeholder="' + esc(c.matrixSearch) + '">' +
          '<div style="display:flex;gap:5px;flex-wrap:wrap">' + modPills + '</div>' +
          '<div style="font-size:11px;opacity:.75"><bdi>' + filtered.length + '</bdi> / <bdi>' + total + '</bdi></div>' +
          '<div class="zwe-matrix-grid">' + listHtml + '</div>' +
        '</div>';
      }

      var dirAttr = isArabic() ? 'rtl' : 'ltr';
      matrixCard = '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-matrix="1">' +
        '<div class="zwe-head" style="' + (state.matrixOpen ? '' : 'border-bottom:0;padding-bottom:0') + '">' +
          '<div>' +
            '<span class="zwe-pill" data-tone="sage">' + esc(c.matrixBadge.replace('{count}', String(total))) + '</span>' +
            '<p class="zwe-sub" style="margin-top:4px">' + esc(c.matrixSub) + '</p>' +
          '</div>' +
          '<button type="button" class="zwe-btn" data-zwe-act="matrix-toggle">' + esc(state.matrixOpen ? c.matrixCollapse : c.matrixExpand) + '</button>' +
        '</div>' +
        bodyHtml +
      '</section>';
    }

    return matrixCard + renderCodexHtml(getEffectiveCodexData(), c);
  }

  function removeNodeById(id) {
    var doc = getDoc();
    if (!doc) return;
    var el = doc.getElementById(id);
    if (el && el.parentElement) {
      el.parentElement.removeChild(el);
    }
  }

  function handleContainerClick(ev) {
    var t = ev && ev.target;
    var btn = t && typeof t.closest === 'function' ? t.closest('[data-zwe-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-zwe-act');
    if (act === 'page') {
      var track = btn.getAttribute('data-track') || 'education';
      var dir = Number(btn.getAttribute('data-dir')) || 1;
      state.indices[track] = (state.indices[track] || 0) + dir;
      pulseFeedback('ui_tap');
      render();
    } else if (act === 'drill-page') {
      var dDir = Number(btn.getAttribute('data-dir')) || 1;
      state.indices.drills = (state.indices.drills || 0) + dDir;
      pulseFeedback('ui_tap');
      render();
    } else if (act === 'quiz-pick') {
      var courseId = btn.getAttribute('data-course');
      var optId = btn.getAttribute('data-opt');
      if (courseId && optId) {
        state.quizAnswers[courseId] = optId;
        saveProgress();
        pulseFeedback('ui_confirm');
        render();
      }
    } else if (act === 'drill-pick') {
      var drillId = btn.getAttribute('data-drill');
      var dOptId = btn.getAttribute('data-opt');
      if (drillId && dOptId) {
        state.drillAnswers[drillId] = dOptId;
        saveProgress();
        pulseFeedback('ui_confirm');
        render();
      }
    } else if (act === 'job-pick') {
      var scId = btn.getAttribute('data-scenario');
      var chId = btn.getAttribute('data-choice');
      if (scId && chId) {
        state.jobChoices[scId] = chId;
        saveProgress();
        pulseFeedback('ui_confirm');
        render();
      }
    } else if (act === 'enc-pick') {
      var encId = btn.getAttribute('data-enc');
      var brId = btn.getAttribute('data-branch');
      if (encId && brId) {
        state.dialogueBranches[encId] = brId;
        saveProgress();
        pulseFeedback('ui_tap');
        render();
      }
    } else if (act === 'go-screen') {
      navigateScreen(btn.getAttribute('data-screen'));
    } else if (act === 'matrix-toggle') {
      state.matrixOpen = !state.matrixOpen;
      pulseFeedback('ui_tap');
      render();
    } else if (act === 'matrix-mod') {
      state.matrixModule = btn.getAttribute('data-mod') || 'all';
      render();
    } else if (act === 'codex-toggle') {
      state.codexOpen = !state.codexOpen;
      pulseFeedback('ui_tap');
      render();
    } else if (act === 'codex-cluster') {
      state.codexCluster = btn.getAttribute('data-cluster') || 'all';
      render();
    }
  }

  function handleContainerInput(ev) {
    var t = ev && ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-zwe-search')) {
      state.matrixQuery = String(t.value || '');
      render();
    } else if (t.getAttribute('data-zwe-codex-search')) {
      state.codexQuery = String(t.value || '');
      render();
    }
  }

  function render() {
    var doc = getDoc();
    if (!doc) return;
    if (doc.querySelector && doc.querySelector('x-dc')) return;

    var ctx = detectContext();
    var c = copyDict();

    if (!ctx.showEncounters && !ctx.showMatrix) {
      removeNodeById(ROOT_ID);
      removeNodeById(MATRIX_ID);
      return;
    }

    ensureStyles();

    var hasAnyData = Boolean(state.data || state.codexData);

    if (!ctx.showEncounters || (!state.data && !(ctx.screen === 'education' && state.codexData))) {
      removeNodeById(ROOT_ID);
    } else {
      var main = doc.getElementById('zone-main');
      if (main) {
        var rootEl = doc.getElementById(ROOT_ID);
        if (!rootEl || rootEl.parentElement !== main) {
          removeNodeById(ROOT_ID);
          rootEl = doc.createElement('section');
          rootEl.id = ROOT_ID;
          rootEl.setAttribute('aria-label', 'ZONE World Encounters');
          rootEl.addEventListener('click', handleContainerClick);
          rootEl.addEventListener('input', handleContainerInput);
          main.appendChild(rootEl);
        }
        var html = '';
        if (ctx.screen === 'education') html = renderEducationHtml(state.data, c);
        else if (ctx.screen === 'jobs') html = renderJobHtml(state.data, c);
        else if (ctx.screen === 'hospital') html = renderEncounterHtml(state.data, 'hospital', c);
        else if (ctx.screen === 'jail') html = renderEncounterHtml(state.data, 'jail', c);
        var activeEduSearch = doc.activeElement && rootEl.contains(doc.activeElement) && doc.activeElement.getAttribute('data-zwe-codex-search');
        if (!activeEduSearch) {
          if (rootEl.__zweLastHtml !== html) {
            rootEl.__zweLastHtml = html;
            rootEl.innerHTML = html;
          }
        } else {
          var cGrid = rootEl.querySelector('.zwe-codex-grid');
          if (cGrid) {
            var tmpE = doc.createElement('div');
            tmpE.innerHTML = html;
            var nextCGrid = tmpE.querySelector('.zwe-codex-grid');
            if (nextCGrid) cGrid.innerHTML = nextCGrid.innerHTML;
          }
        }
      }
    }

    if (!ctx.showMatrix || !hasAnyData) {
      removeNodeById(MATRIX_ID);
    } else {
      var host = null;
      if (ctx.matrixHostType === 'account') {
        host = doc.querySelector('main');
      } else if (ctx.matrixHostType === 'main') {
        host = doc.getElementById('zone-main');
      }
      if (host) {
        var matEl = doc.getElementById(MATRIX_ID);
        if (!matEl || matEl.parentElement !== host) {
          removeNodeById(MATRIX_ID);
          matEl = doc.createElement('section');
          matEl.id = MATRIX_ID;
          matEl.setAttribute('aria-label', '300+ Game-Dev Skills Applied Matrix & 468 Config Skills Codex');
          matEl.addEventListener('click', handleContainerClick);
          matEl.addEventListener('input', handleContainerInput);
          host.appendChild(matEl);
        }
        var nextMatHtml = renderMatrixHtml(state.data, c);
        var activeSearch = doc.activeElement && matEl.contains(doc.activeElement) &&
          (doc.activeElement.getAttribute('data-zwe-search') || doc.activeElement.getAttribute('data-zwe-codex-search'));
        if (!activeSearch) {
          if (matEl.__zweLastHtml !== nextMatHtml) {
            matEl.__zweLastHtml = nextMatHtml;
            matEl.innerHTML = nextMatHtml;
          }
        } else {
          var grid = matEl.querySelector('.zwe-matrix-grid');
          var codexGrid = matEl.querySelector('.zwe-codex-grid');
          var tmp = doc.createElement('div');
          tmp.innerHTML = nextMatHtml;
          if (grid) {
            var nextGrid = tmp.querySelector('.zwe-matrix-grid');
            if (nextGrid) grid.innerHTML = nextGrid.innerHTML;
          }
          if (codexGrid) {
            var nextCodexGrid = tmp.querySelector('.zwe-codex-grid');
            if (nextCodexGrid) codexGrid.innerHTML = nextCodexGrid.innerHTML;
          }
        }
      }
    }
  }

  function loadCodexData() {
    if (state.codexLoaded && state.codexData) return Promise.resolve(state.codexData);
    if (state.codexLoading) return Promise.resolve(state.codexData);
    if (typeof globalObj.fetch !== 'function') return Promise.resolve(null);
    state.codexLoading = true;
    return globalObj.fetch(CODEX_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 0));
        return res.json();
      })
      .then(function (json) {
        state.codexData = json;
        state.codexLoaded = true;
        state.codexLoading = false;
        render();
        return json;
      })
      .catch(function () {
        state.codexLoading = false;
        return null;
      });
  }

  function loadData() {
    loadCodexData();
    if (state.loaded && state.data) return Promise.resolve(state.data);
    if (state.loading) return Promise.resolve(state.data);
    if (typeof globalObj.fetch !== 'function') return Promise.resolve(null);
    state.loading = true;
    return globalObj.fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 0));
        return res.json();
      })
      .then(function (json) {
        state.data = json;
        state.loaded = true;
        state.loading = false;
        render();
        return json;
      })
      .catch(function (err) {
        state.loadError = String(err && err.message ? err.message : err);
        state.loading = false;
        return null;
      });
  }

  function boot() {
    var doc = getDoc();
    if (!doc) return;
    loadProgress();
    loadData();

    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      var raf = globalObj.requestAnimationFrame || function (fn) { return globalObj.setTimeout(fn, 16); };
      raf(function () {
        scheduled = false;
        render();
      });
    };

    if (typeof globalObj.addEventListener === 'function') {
      globalObj.addEventListener('zone:render', schedule, { passive: true });
      globalObj.addEventListener('popstate', schedule);
    }

    try {
      if (typeof globalObj.MutationObserver === 'function') {
        var obs = new globalObj.MutationObserver(schedule);
        obs.observe(doc.documentElement, {
          attributes: true,
          attributeFilter: ['lang', 'dir', 'data-theme']
        });
        var mainNode = doc.getElementById('zone-main');
        if (mainNode) {
          obs.observe(mainNode, { attributes: true, attributeFilter: ['data-zone-screen'], childList: false });
        }
      }
    } catch (_) {}

    schedule();
  }

  var api = {
    ROOT_ID: ROOT_ID,
    MATRIX_ID: MATRIX_ID,
    DATA_URL: DATA_URL,
    CODEX_URL: CODEX_URL,
    setData: function (data) {
      if (data && Array.isArray(data.skills) && Array.isArray(data.formalArchitectureDrills) && !data.skillsIndex) {
        state.codexData = data;
        state.codexLoaded = true;
      } else {
        state.data = data;
        state.loaded = Boolean(data);
      }
      render();
      return data;
    },
    setCodexData: function (codexData) {
      state.codexData = codexData;
      state.codexLoaded = Boolean(codexData);
      render();
      return state.codexData;
    },
    getState: function () { return state; },
    detectContext: detectContext,
    loadData: loadData,
    loadCodexData: loadCodexData,
    render: render,
    boot: boot
  };

  globalObj.ZoneWorldEncounters = api;

  var doc = getDoc();
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  return api;
});

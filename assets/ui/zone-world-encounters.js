/* ==========================================================================
 * ZONE v157 - 300+ GAME-DEV SKILL ENCYCLOPEDIA & LIVE WORLD ENCOUNTERS
 * Exclusive Ownership: @batch-300-v2 (assets/ui/zone-world-encounters.js)
 * Exposes: window.ZoneWorldEncounters (plus CommonJS export for Node tests)
 *
 * Mounts compact watercolor-sketchbook interactive panels ONLY on:
 *   - education: 12 Academy Masterclasses with interactive quiz micro-checks
 *   - job / jobs: 12 Career Promotion Scenarios
 *   - hospital: 8 Recovery Encounters
 *   - jail: 8 Yard Strategy Encounters
 *   - tutorial (and /account, or open #zone-tutorial-panel off home):
 *     Collapsible 300+ Game-Dev Skills Applied Matrix across ZONE's 12 modules
 *
 * Guardrails:
 *   - ZERO mounts on home (strictly unmounts both panels whenever screen === 'home' on main app)
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
      nextCard: 'التالي',
      prevCard: 'السابق',
      goModule: 'انتقال إلى',
      sourcePrefix: 'المهارات المطبّقة:',
      completedCount: 'المنجز:'
    }
  };

  var state = {
    data: null,
    loading: false,
    loaded: false,
    loadError: null,
    indices: { education: 0, jobs: 0, hospital: 0, jail: 0 },
    quizAnswers: {},
    jobChoices: {},
    dialogueBranches: {},
    matrixOpen: false,
    matrixModule: 'all',
    matrixQuery: ''
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

  function loadProgress() {
    try {
      var ls = globalObj.localStorage;
      if (!ls) return;
      var raw = ls.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.quizAnswers) state.quizAnswers = parsed.quizAnswers;
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
      '.zwe-matrix-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));',
      '  gap: 7px;',
      '  max-height: 310px;',
      '  overflow-y: auto;',
      '}',
      '.zwe-matrix-item {',
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

  function renderEducationHtml(data, c) {
    var courses = Array.isArray(data.educationCourses) ? data.educationCourses : [];
    if (!courses.length) return '';
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
    return '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-screen="education">' +
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

  function renderJobHtml(data, c) {
    var scenarios = Array.isArray(data.jobScenarios) ? data.jobScenarios : [];
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
    var list = (data.worldEncounters && Array.isArray(data.worldEncounters[screenKey])) ? data.worldEncounters[screenKey] : [];
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
    var total = Number(data.skillsIndexed || (data.skillsIndex ? data.skillsIndex.length : 0));
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
    return '<section class="zwe-card" dir="' + dirAttr + '" data-zwe-matrix="1">' +
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
    } else if (act === 'quiz-pick') {
      var courseId = btn.getAttribute('data-course');
      var optId = btn.getAttribute('data-opt');
      if (courseId && optId) {
        state.quizAnswers[courseId] = optId;
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
    }
  }

  function handleContainerInput(ev) {
    var t = ev && ev.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-zwe-search')) return;
    state.matrixQuery = String(t.value || '');
    render();
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

    if (!ctx.showEncounters || !state.data) {
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
          main.appendChild(rootEl);
        }
        var html = '';
        if (ctx.screen === 'education') html = renderEducationHtml(state.data, c);
        else if (ctx.screen === 'jobs') html = renderJobHtml(state.data, c);
        else if (ctx.screen === 'hospital') html = renderEncounterHtml(state.data, 'hospital', c);
        else if (ctx.screen === 'jail') html = renderEncounterHtml(state.data, 'jail', c);
        if (rootEl.__zweLastHtml !== html) {
          rootEl.__zweLastHtml = html;
          rootEl.innerHTML = html;
        }
      }
    }

    if (!ctx.showMatrix || !state.data) {
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
          matEl.setAttribute('aria-label', '300+ Game-Dev Skills Applied Matrix');
          matEl.addEventListener('click', handleContainerClick);
          matEl.addEventListener('input', handleContainerInput);
          host.appendChild(matEl);
        }
        var nextMatHtml = renderMatrixHtml(state.data, c);
        var activeSearch = doc.activeElement && matEl.contains(doc.activeElement) && doc.activeElement.getAttribute('data-zwe-search');
        if (!activeSearch) {
          if (matEl.__zweLastHtml !== nextMatHtml) {
            matEl.__zweLastHtml = nextMatHtml;
            matEl.innerHTML = nextMatHtml;
          }
        } else {
          var grid = matEl.querySelector('.zwe-matrix-grid');
          if (grid) {
            var tmp = doc.createElement('div');
            tmp.innerHTML = nextMatHtml;
            var nextGrid = tmp.querySelector('.zwe-matrix-grid');
            if (nextGrid) grid.innerHTML = nextGrid.innerHTML;
          }
        }
      }
    }
  }

  function loadData() {
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
    setData: function (data) {
      state.data = data;
      state.loaded = Boolean(data);
      render();
      return state.data;
    },
    getState: function () { return state; },
    detectContext: detectContext,
    loadData: loadData,
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

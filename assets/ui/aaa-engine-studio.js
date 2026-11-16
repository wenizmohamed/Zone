/* ZONE Open Engine Studio v129 - MotionSites Iconography, Bilingual Sync & 60fps WebGL Gate */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const PALETTES = {
    emerald: ['#10b981', '#34d399', '#6ee7b7'],
    cyan: ['#06b6d4', '#22d3ee', '#3b82f6'],
    gold: ['#fbbf24', '#f59e0b', '#fb923c'],
    crimson: ['#f43f5e', '#fb7185', '#f97316'],
    violet: ['#8b5cf6', '#a855f7', '#c084fc'],
    royal: ['#38bdf8', '#6366f1', '#c084fc']
  };

  function buildMotionIcon(uid, paletteKey, innerPaths, size) {
    const stops = PALETTES[paletteKey] || PALETTES.emerald;
    const bgId = 'aes-bg-' + uid;
    const rimId = 'aes-rim-' + uid;
    const dim = size || 28;
    return (
      '<svg viewBox="0 0 28 28" width="' + dim + '" height="' + dim + '" fill="none" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="' + bgId + '" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="' + stops[0] + '"></stop>' +
      '<stop offset="55%" stop-color="' + stops[1] + '"></stop>' +
      '<stop offset="100%" stop-color="' + stops[2] + '"></stop>' +
      '</linearGradient>' +
      '<linearGradient id="' + rimId + '" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"></stop>' +
      '<stop offset="100%" stop-color="#ffffff" stop-opacity="0.08"></stop>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect x="2" y="2" width="24" height="24" rx="7.5" fill="url(#' + bgId + ')" fill-opacity="0.22" stroke="url(#' + bgId + ')" stroke-width="1.35"></rect>' +
      '<rect x="3.2" y="3.2" width="21.6" height="21.6" rx="6.4" stroke="url(#' + rimId + ')" stroke-width="0.75"></rect>' +
      innerPaths(bgId) +
      '</svg>'
    );
  }

  const NAV_ICONS = {
    overview: ['emerald', function (g) {
      return '<path d="M14 6.5 21 12v8.8a1.2 1.2 0 0 1-1.2 1.2h-3.6v-5.2h-4.4V22H8.2A1.2 1.2 0 0 1 7 20.8V12l7-5.5Z" fill="url(#' + g + ')" fill-opacity="0.45" stroke="#f8fafc" stroke-width="1.5" stroke-linejoin="round"></path><circle cx="14" cy="12.2" r="1.7" fill="#ffffff"></circle>';
    }],
    content: ['crimson', function (g) {
      return '<rect x="7.5" y="6.5" width="13" height="15" rx="2.4" fill="url(#' + g + ')" fill-opacity="0.4" stroke="#f8fafc" stroke-width="1.5"></rect><path d="M10.5 10.5h7M10.5 14h7M10.5 17.5h4.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"></path>';
    }],
    builder: ['cyan', function (g) {
      return '<rect x="6.5" y="6.5" width="15" height="15" rx="2.6" fill="url(#' + g + ')" fill-opacity="0.35" stroke="#f8fafc" stroke-width="1.5"></rect><path d="M6.5 11.2h15M11.6 11.2v10.3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path>';
    }],
    territories: ['gold', function (g) {
      return '<path d="M6.5 8.6 11.5 6.4l5 2.2 5-2.2v12.8l-5 2.2-5-2.2-5 2.2V8.6Z" fill="url(#' + g + ')" fill-opacity="0.42" stroke="#f8fafc" stroke-width="1.45" stroke-linejoin="round"></path><path d="M11.5 6.4v12.8M16.5 8.6v12.8" stroke="#ffffff" stroke-width="1.35"></path>';
    }],
    modules: ['violet', function (g) {
      return '<path d="M11 6.5h6v3.8h3.8v6H17v5.2h-6v-5.2H7.2v-6H11V6.5Z" fill="url(#' + g + ')" fill-opacity="0.45" stroke="#f8fafc" stroke-width="1.45" stroke-linejoin="round"></path>';
    }],
    themes: ['royal', function (g) {
      return '<circle cx="14" cy="14" r="7.2" fill="url(#' + g + ')" fill-opacity="0.42" stroke="#f8fafc" stroke-width="1.5"></circle><circle cx="11.5" cy="12" r="1.3" fill="#ffffff"></circle><circle cx="16.3" cy="11.6" r="1.3" fill="#fde68a"></circle><circle cx="15.8" cy="16.2" r="1.4" fill="#6ee7b7"></circle>';
    }],
    assets: ['cyan', function (g) {
      return '<path d="M14 6.3 20.8 10.2v7.6L14 21.7 7.2 17.8v-7.6L14 6.3Z" fill="url(#' + g + ')" fill-opacity="0.42" stroke="#f8fafc" stroke-width="1.5" stroke-linejoin="round"></path><path d="M7.2 10.2 14 14l6.8-3.8M14 14v7.7" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"></path>';
    }],
    releases: ['emerald', function (g) {
      return '<path d="M14 6.5v9.8m-3.6-3.4L14 16.5l3.6-3.6" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path><rect x="7" y="18" width="14" height="3.5" rx="1.5" fill="url(#' + g + ')" stroke="#f8fafc" stroke-width="1.3"></rect>';
    }],
    economy: ['gold', function (g) {
      return '<circle cx="14" cy="14" r="7" fill="url(#' + g + ')" fill-opacity="0.45" stroke="#f8fafc" stroke-width="1.5"></circle><path d="M14 9.6v8.8M16.2 11.4c0-1-1-1.6-2.2-1.6s-2.2.6-2.2 1.6 1 1.4 2.2 1.7 2.2.7 2.2 1.8-1 1.7-2.2 1.7-2.2-.6-2.2-1.6" stroke="#ffffff" stroke-width="1.45" stroke-linecap="round"></path>';
    }],
    events: ['crimson', function (g) {
      return '<path d="M6.5 14.2h3.4l2.2-5.4 3.6 10.4 2.3-5h3.5" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="14" cy="14" r="2.2" fill="url(#' + g + ')"></circle>';
    }]
  };

  const TASK_ICONS = {
    item: ['crimson', function (g) {
      return '<path d="M9 18.8 18.8 9m-2.6-.5 3.3.2.2 3.3" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><rect x="7.2" y="14.5" width="6.3" height="6.3" rx="1.6" fill="url(#' + g + ')" fill-opacity="0.6" stroke="#f8fafc" stroke-width="1.35"></rect>';
    }],
    page: ['cyan', function (g) {
      return '<rect x="6.8" y="7" width="14.4" height="14" rx="2.6" fill="url(#' + g + ')" fill-opacity="0.45" stroke="#f8fafc" stroke-width="1.5"></rect><path d="M6.8 11.4h14.4M11.5 11.4V21" stroke="#ffffff" stroke-width="1.5"></path>';
    }],
    look: ['violet', function (g) {
      return '<path d="M14 6.6 20.4 13 14 21.4 7.6 13 14 6.6Z" fill="url(#' + g + ')" fill-opacity="0.52" stroke="#f8fafc" stroke-width="1.5" stroke-linejoin="round"></path><path d="M7.6 13h12.8M14 6.6 11.6 13 14 21.4 16.4 13 14 6.6Z" stroke="#ffffff" stroke-width="1.2"></path>';
    }],
    system: ['emerald', function (g) {
      return '<rect x="8.2" y="8.2" width="11.6" height="11.6" rx="2.8" fill="url(#' + g + ')" fill-opacity="0.5" stroke="#f8fafc" stroke-width="1.5"></rect><path d="M11.5 5.6v2.6M16.5 5.6v2.6M11.5 19.8v2.6M16.5 19.8v2.6M5.6 11.5h2.6M5.6 16.5h2.6M19.8 11.5h2.6M19.8 16.5h2.6" stroke="#ffffff" stroke-width="1.45" stroke-linecap="round"></path>';
    }]
  };

  const PIPE_PALETTES = ['cyan', 'violet', 'gold', 'emerald', 'crimson'];
  const METRIC_PALETTES = ['emerald', 'gold', 'violet', 'crimson', 'cyan'];

  function voiceWaveSvg() {
    return (
      '<svg class="aes-btn-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">' +
      '<defs><linearGradient id="aesRuntimeVoiceGrad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#10b981"></stop><stop offset="55%" stop-color="#22d3ee"></stop><stop offset="100%" stop-color="#3b82f6"></stop>' +
      '</linearGradient></defs>' +
      '<rect x="2" y="2" width="20" height="20" rx="6" fill="url(#aesRuntimeVoiceGrad)" fill-opacity="0.22" stroke="url(#aesRuntimeVoiceGrad)" stroke-width="1.4"></rect>' +
      '<path d="M7 10.5v3M10.3 8v8M13.7 6.5v11M17 9.5v5" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"></path>' +
      '</svg>'
    );
  }

  function arrowSvg(uid) {
    return (
      '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">' +
      '<defs><linearGradient id="aes-arr-' + uid + '" x1="4" y1="4" x2="16" y2="16" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#38bdf8"></stop><stop offset="100%" stop-color="#34d399"></stop>' +
      '</linearGradient></defs>' +
      '<path d="M7.5 4.5 13 10l-5.5 5.5" stroke="url(#aes-arr-' + uid + ')" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
      '</svg>'
    );
  }

  function currentLang() {
    if (typeof state === 'object' && state && state.language === 'ar') {
      return 'ar';
    }
    return document.documentElement.lang === 'ar' ? 'ar' : 'en';
  }

  let decorating = false;

  function decorateNav() {
    const nav = document.getElementById('adminNav');
    if (!nav || decorating) return;
    decorating = true;
    try {
      const buttons = nav.querySelectorAll('button.nav-button[data-nav]');
      buttons.forEach(function (btn) {
        if (btn.getAttribute('data-aes-decorated') === '1') return;
        const key = btn.getAttribute('data-nav') || (btn.dataset && btn.dataset.nav) || 'overview';
        const spec = NAV_ICONS[key] || NAV_ICONS.overview;
        const oldIcon = btn.querySelector('svg, span:first-child');
        const wrapper = document.createElement('span');
        wrapper.className = 'aes-ms-icon aes-ms-nav-icon';
        wrapper.setAttribute('aria-hidden', 'true');
        wrapper.innerHTML = buildMotionIcon('nav-' + key, spec[0], spec[1], 24);
        const firstNavChild = btn.firstElementChild || (btn.children && btn.children[0]) || null;
        if (oldIcon && oldIcon.tagName.toUpperCase() !== 'B') {
          oldIcon.replaceWith(wrapper);
        } else if (firstNavChild) {
          btn.insertBefore(wrapper, firstNavChild);
        } else {
          btn.appendChild(wrapper);
        }
        btn.setAttribute('data-aes-decorated', '1');
      });
    } finally {
      decorating = false;
    }
  }

  function decorateTasks() {
    const container = document.getElementById('studioTasks');
    if (!container || decorating) return;
    decorating = true;
    try {
      const buttons = container.querySelectorAll('button.studio-task[data-studio-action]');
      buttons.forEach(function (btn, idx) {
        if (btn.getAttribute('data-aes-decorated') === '1') return;
        const action = btn.getAttribute('data-studio-action') || (btn.dataset && btn.dataset.studioAction) || 'item';
        const spec = TASK_ICONS[action] || TASK_ICONS.item;
        const iconSlot = btn.querySelector('.studio-task-icon');
        if (iconSlot) {
          iconSlot.innerHTML = buildMotionIcon('task-' + action + '-' + idx, spec[0], spec[1], 44);
        }
        const arrowSlot = btn.querySelector('.studio-task-arrow');
        if (arrowSlot) {
          arrowSlot.innerHTML = arrowSvg('task-' + idx);
        }
        btn.setAttribute('data-aes-decorated', '1');
      });
    } finally {
      decorating = false;
    }
  }

  function decoratePipeline() {
    const container = document.getElementById('pipeline');
    if (!container || decorating) return;
    decorating = true;
    try {
      const steps = container.querySelectorAll('.pipeline-step');
      steps.forEach(function (step, idx) {
        if (step.getAttribute('data-aes-decorated') === '1') return;
        const palette = PIPE_PALETTES[idx % PIPE_PALETTES.length];
        const badge = document.createElement('div');
        badge.className = 'aes-ms-icon aes-ms-pipe-icon';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = buildMotionIcon('pipe-' + idx, palette, function (g) {
          if (idx === 0) return '<path d="M9 9.5h10M9 14h10M9 18.5h6" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"></path>';
          if (idx === 1) return '<path d="m9.5 14.2 3 3 6-6.4" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>';
          if (idx === 2) return '<rect x="7.5" y="9" width="13" height="10" rx="2" fill="url(#' + g + ')" fill-opacity="0.45" stroke="#ffffff" stroke-width="1.5"></rect>';
          if (idx === 3) return '<path d="M14 8v9m-3.4-5.6L14 8l3.4 3.4M8.5 19.5h11" stroke="#ffffff" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"></path>';
          return '<polygon points="11,9 20,14 11,19" fill="#ffffff"></polygon>';
        }, 36);
        const firstStepChild = step.firstElementChild || (step.children && step.children[0]) || null;
        if (firstStepChild) {
          step.insertBefore(badge, firstStepChild);
        } else {
          step.appendChild(badge);
        }
        step.setAttribute('data-aes-decorated', '1');
      });
    } finally {
      decorating = false;
    }
  }

  function decorateMetrics() {
    const container = document.getElementById('metrics');
    if (!container || decorating) return;
    decorating = true;
    try {
      const cards = container.querySelectorAll('.metric');
      cards.forEach(function (card, idx) {
        if (card.getAttribute('data-aes-decorated') === '1') return;
        const palette = METRIC_PALETTES[idx % METRIC_PALETTES.length];
        const badge = document.createElement('div');
        badge.className = 'aes-ms-icon aes-ms-metric-icon';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = buildMotionIcon('metric-' + idx, palette, function () {
          if (idx === 0) return '<circle cx="14" cy="14" r="4.5" stroke="#ffffff" stroke-width="1.7"></circle><circle cx="14" cy="14" r="1.6" fill="#ffffff"></circle>';
          if (idx === 1) return '<path d="M8.5 17.5 14 8.5l5.5 9H8.5Z" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"></path>';
          if (idx === 2) return '<rect x="8.5" y="8.5" width="11" height="11" rx="2.4" stroke="#ffffff" stroke-width="1.6"></rect>';
          if (idx === 3) return '<path d="M9 18V12M14 18V9M19 18v-5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"></path>';
          return '<path d="M7.5 14.5h3l2-4.5 3 9 2-4.5h3" stroke="#ffffff" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"></path>';
        }, 36);
        const firstCardChild = card.firstElementChild || (card.children && card.children[0]) || null;
        if (firstCardChild) {
          card.insertBefore(badge, firstCardChild);
        } else {
          card.appendChild(badge);
        }
        card.setAttribute('data-aes-decorated', '1');
      });
    } finally {
      decorating = false;
    }
  }

  function upgradeOutputLog() {
    const out = document.getElementById('agiStudioOutput');
    if (!out) return;
    const text = out.textContent || '';
    if (text.includes('3.6') || text.includes('(v127)') || text.includes('(v128)')) {
      out.textContent = text
        .replace(/OPEN ENGINE 3\.6/g, 'OPEN ENGINE 3.8 LIVE (v129)')
        .replace(/Syndicate 3\.6/g, 'Syndicate 3.8 (v129)')
        .replace(/\(v12[78]\)/g, '(v129)');
    }
  }

  function syncStudioV127Copy() {
    const ar = currentLang() === 'ar';

    if (typeof translations === 'object' && translations) {
      if (translations.en) translations.en.engineVersion = 'ENGINE 3.8 LIVE (v129)';
      if (translations.ar) translations.ar.engineVersion = 'المحرك 3.8 المباشر (v129)';
    }

    document.querySelectorAll('[data-copy="engineVersion"]').forEach(function (el) {
      el.textContent = ar ? 'المحرك 3.8 المباشر (v129)' : 'ENGINE 3.8 LIVE (v129)';
    });

    const setById = function (id, enText, arText) {
      const el = document.getElementById(id);
      if (el) el.textContent = ar ? arText : enText;
    };

    setById(
      'agiBannerTitle',
      'OPEN ENGINE 3.8 LIVE (v129) - SYNDICATE GAME ARCHITECT & 3D HOLODECK',
      'محرك OPEN ENGINE 3.8 المباشر (v129) - مهندس النقابة والهولوديك ثلاثي الأبعاد'
    );
    setById(
      'agiBannerSub',
      'Live Content Synthesis · Monte-Carlo Combat Simulation · 5-Sector 120-Block 3D Metropolis · 7-City Charter · 4 Instant Arcades · 51 Weapons · EN/AR',
      'توليد المسودات الفوري · محاكاة مونت كارلو · مدينة ثلاثية الأبعاد من 5 قطاعات و120 مربعاً · 7 مدن عالمية · 4 ألعاب فورية · 51 سلاحاً'
    );
    setById(
      'agiBannerStatus',
      'ENGINE 3.8 LIVE (v129)',
      'المحرك 3.8 متصل (v129)'
    );
    setById(
      'agiPromptLabel',
      'Open Engine 3.8 Architect Directive (Populates Engine Drafts in EN / AR)',
      'أمر مهندس المحرك 3.8 (ينشئ مسودات حية بالعربية والإنجليزية)'
    );
    setById('agiDepthLabel', 'Simulation Depth:', 'عمق المحاكاة:');
    setById('agiExecuteButton', 'Synthesize Engine Draft', 'توليد مسودة المحرك');

    const voiceBtn = document.getElementById('agiVoiceButton');
    if (voiceBtn) {
      const voiceLabel = ar ? 'إيجاز صوتي' : 'Audio Dispatch';
      let labelSpan = voiceBtn.querySelector('.aes-btn-label');
      if (!labelSpan || !voiceBtn.querySelector('svg')) {
        voiceBtn.innerHTML = voiceWaveSvg() + '<span class="aes-btn-label" data-aes-en="Audio Dispatch" data-aes-ar="إيجاز صوتي"></span>';
        labelSpan = voiceBtn.querySelector('.aes-btn-label');
      }
      if (labelSpan) labelSpan.textContent = voiceLabel;
    }

    document.querySelectorAll('[data-aes-en]').forEach(function (el) {
      const nextText = ar ? (el.getAttribute('data-aes-ar') || el.getAttribute('data-aes-en')) : el.getAttribute('data-aes-en');
      if (nextText !== null && el.textContent !== nextText) {
        el.textContent = nextText;
      }
    });

    upgradeOutputLog();
  }

  function setupHolodeckPerformanceGate() {
    const holoFrame = document.getElementById('agiCharacterHolodeckFrame');
    if (!holoFrame) return null;

    const viewport = holoFrame.parentElement;
    const overviewSection = document.querySelector('.view[data-view="overview"]');
    const defaultSrc = holoFrame.getAttribute('data-character-src') || '/dist/character3d.html?v=116';

    let inViewport = typeof IntersectionObserver === 'undefined';
    let tabVisible = document.visibilityState !== 'hidden';
    let overviewActive = overviewSection ? overviewSection.classList.contains('active') : true;
    let deferredSrc = holoFrame.getAttribute('src') || defaultSrc;

    let fpsPill = viewport ? viewport.querySelector('.aes-holodeck-fps-pill') : null;
    if (viewport && !fpsPill) {
      fpsPill = document.createElement('span');
      fpsPill.className = 'aes-holodeck-fps-pill';
      fpsPill.setAttribute('aria-hidden', 'true');
      viewport.appendChild(fpsPill);
    }

    const nativeSetAttribute = holoFrame.setAttribute.bind(holoFrame);
    const nativeRemoveAttribute = holoFrame.removeAttribute.bind(holoFrame);

    const shouldRun = function () {
      return Boolean(inViewport && tabVisible && overviewActive);
    };

    const updateStatusBadge = function (active) {
      const ar = currentLang() === 'ar';
      if (viewport) viewport.setAttribute('data-holo-paused', active ? '0' : '1');
      if (fpsPill) {
        fpsPill.textContent = active
          ? (ar ? 'WebGL نشط · 60fps' : '3D WebGL · 60fps')
          : (ar ? 'WebGL متوقف مؤقتاً' : '3D WebGL · Paused');
      }
    };

    const applyLifecycle = function () {
      const active = shouldRun();
      updateStatusBadge(active);
      if (active) {
        holoFrame.style.display = 'block';
        if (!holoFrame.getAttribute('src')) {
          nativeSetAttribute('src', deferredSrc || defaultSrc);
        }
        try {
          holoFrame.contentWindow?.postMessage({ type: 'zone:holodeck-lifecycle', paused: false }, window.location.origin);
        } catch (_) {}
      } else {
        try {
          holoFrame.contentWindow?.postMessage({ type: 'zone:holodeck-lifecycle', paused: true }, window.location.origin);
        } catch (_) {}
        if (!tabVisible || !overviewActive) {
          const liveSrc = holoFrame.getAttribute('src');
          if (liveSrc) deferredSrc = liveSrc;
          nativeRemoveAttribute('src');
        } else {
          holoFrame.style.display = 'none';
        }
      }
    };

    holoFrame.setAttribute = function (name, value) {
      if (String(name).toLowerCase() === 'src') {
        deferredSrc = String(value || defaultSrc);
        if (!shouldRun()) {
          updateStatusBadge(false);
          return;
        }
      }
      nativeSetAttribute(name, value);
    };

    if (!shouldRun() && holoFrame.getAttribute('src')) {
      deferredSrc = holoFrame.getAttribute('src') || defaultSrc;
      nativeRemoveAttribute('src');
    }

    if (typeof IntersectionObserver !== 'undefined' && viewport) {
      const io = new IntersectionObserver(function (entries) {
        for (const entry of entries) {
          inViewport = Boolean(entry.isIntersecting || entry.intersectionRatio > 0);
        }
        applyLifecycle();
      }, { rootMargin: '160px 0px', threshold: 0.01 });
      io.observe(viewport);
    }

    document.addEventListener('visibilitychange', function () {
      tabVisible = document.visibilityState !== 'hidden';
      applyLifecycle();
    });

    if (overviewSection && typeof MutationObserver !== 'undefined') {
      const viewObserver = new MutationObserver(function () {
        overviewActive = overviewSection.classList.contains('active');
        applyLifecycle();
      });
      viewObserver.observe(overviewSection, { attributes: true, attributeFilter: ['class'] });
    }

    document.querySelectorAll('[data-agi-holodeck], #agiHolodeckFireButton').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (tabVisible && overviewActive) {
          inViewport = true;
          applyLifecycle();
        }
      });
    });

    applyLifecycle();
    return {
      isRunning: shouldRun,
      refresh: applyLifecycle
    };
  }

  function wireDynamicObservers(holoController) {
    if (typeof MutationObserver === 'undefined') return;

    const watchContainer = function (id, fn) {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new MutationObserver(function () {
        if (!decorating) fn();
      });
      obs.observe(el, { childList: true });
    };

    watchContainer('adminNav', decorateNav);
    watchContainer('studioTasks', decorateTasks);
    watchContainer('pipeline', decoratePipeline);
    watchContainer('metrics', decorateMetrics);

    const out = document.getElementById('agiStudioOutput');
    if (out) {
      let syncingOut = false;
      const outObs = new MutationObserver(function () {
        if (syncingOut) return;
        syncingOut = true;
        try {
          upgradeOutputLog();
        } finally {
          syncingOut = false;
        }
      });
      outObs.observe(out, { childList: true, characterData: true, subtree: true });
    }

    const htmlObs = new MutationObserver(function () {
      syncStudioV127Copy();
      decorateNav();
      decorateTasks();
      decoratePipeline();
      decorateMetrics();
      if (holoController) holoController.refresh();
    });
    htmlObs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

    document.querySelectorAll('.view').forEach(function (viewEl) {
      const vObs = new MutationObserver(function () {
        decorateNav();
        decorateTasks();
        decoratePipeline();
        decorateMetrics();
      });
      vObs.observe(viewEl, { attributes: true, attributeFilter: ['class'] });
    });

    ['languageButton', 'sessionLanguageButton'].forEach(function (id) {
      document.getElementById(id)?.addEventListener('click', function () {
        setTimeout(function () {
          syncStudioV127Copy();
          decorateNav();
          decorateTasks();
          decoratePipeline();
          decorateMetrics();
          if (holoController) holoController.refresh();
        }, 0);
      });
    });

    document.querySelectorAll('[data-go="media"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (typeof setView === 'function') setView('assets');
      });
    });
  }

  function initEngineStudioV127() {
    syncStudioV127Copy();
    decorateNav();
    decorateTasks();
    decoratePipeline();
    decorateMetrics();
    const holoController = setupHolodeckPerformanceGate();
    wireDynamicObservers(holoController);

    const studioApi = {
      version: '129.0.0',
      engineLabel: 'ENGINE 3.8 LIVE (v129)',
      refresh: function () {
        syncStudioV127Copy();
        decorateNav();
        decorateTasks();
        decoratePipeline();
        decorateMetrics();
        if (holoController) holoController.refresh();
      },
      isHolodeckRunning: function () {
        return holoController ? holoController.isRunning() : false;
      }
    };
    window.ZoneEngineStudioV127 = studioApi;
    window.ZoneEngineStudioV129 = studioApi;
  }

  initEngineStudioV127();
})();

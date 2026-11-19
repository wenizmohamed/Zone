/* ==========================================================================
 * ZONE v146 - NATIVE MOBILE APP SHELL RUNTIME & PERFORMANCE OPTIMIZER
 * Features:
 *   1) Dynamic <meta name="theme-color"> sync (#f2ebdc Light <-> #141210 Dark)
 *   2) Safe Service Worker registration (./sw.js) on https/localhost without mid-action reload
 *   3) Standalone detection (PWA / iOS / Capacitor) + 14-day dismissible Install Pill & iOS Guide Modal
 *   4) Mobile GPU & Battery Optimizer (low-power flags, WebGL iframe IntersectionObserver +
 *      visibilitychange throttling via ZONE_APP_VISIBILITY, and lazy non-hero <img> optimization)
 *   5) Tactile Haptic Feedback via navigator.vibrate(8) on primary game CTAs
 *   6) Bilingual Sketchbook Offline / Online Resilience Pill
 *   7) Public diagnostics API: window.ZoneAppShell
 * Fiber-safe: mounts outside <x-dc> directly on document.body.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAppShellLoaded) return;
  window.__zoneAppShellLoaded = true;

  var VERSION = '146.0';
  var THEME_LIGHT_COLOR = '#f2ebdc';
  var THEME_DARK_COLOR = '#141210';
  var THEME_STORAGE_KEY = 'zone.sketch.theme';
  var DISMISS_STORAGE_KEY = 'zone.app.installDismissedAt';
  var DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  var WEBGL_IFRAME_SELECTOR =
    '#zone-city-map, #zone-char-3d, #zone-combat-frame, #zone-safehouse-frame, ' +
    'iframe[src*="weapon3d"], iframe[src*="city-map"], iframe[src*="character3d"]';

  var HAPTIC_CTA_SELECTOR =
    'button.zone-action-primary, button.zone-action-danger, button[type="submit"], ' +
    '#reconnectGuestButton, .zma-upgrade-btn, .zma-claim-btn, .zma-equip-btn, ' +
    '.zma-btn-claim-all, nav.zone-mobile-tabbar > button, #zaaa-mobile-rail-toggle, ' +
    '#zmw-avatar-btn, .zmw-action-btn, .zas-install-cta, [data-zone-haptic="1"]';

  var COPY = {
    en: {
      installCta: 'Install ZONE App',
      installAria: 'Install ZONE App to home screen',
      dismissAria: 'Dismiss install prompt',
      offlineText: 'Offline Mode - Cached Sketchbook active',
      onlineText: 'Back Online - Reconnected to Zone City',
      iosTitle: 'Install ZONE App',
      iosLead: 'Add ZONE to your Home Screen for full-screen 60fps play, instant launch, and offline access.',
      iosStep1: 'Tap the Share icon in Safari\'s toolbar',
      iosStep2: 'Scroll down and tap "Add to Home Screen"',
      iosStep3: 'Tap "Add" in the top corner to launch ZONE like a native app',
      iosDone: 'Got it',
      closeAria: 'Close install guide'
    },
    ar: {
      installCta: 'تثبيت تطبيق زون',
      installAria: 'تثبيت تطبيق زون على الشاشة الرئيسية',
      dismissAria: 'إخفاء شريط التثبيت',
      offlineText: 'وضع عدم الاتصال - النسخة المحفوظة نشطة',
      onlineText: 'عاد الاتصال - تم الربط مع مدينة زون',
      iosTitle: 'تثبيت تطبيق زون',
      iosLead: 'أضف زون إلى شاشتك الرئيسية لتشغيل بملء الشاشة بسرعة 60 إطاراً واللعب السريع.',
      iosStep1: 'اضغط على أيقونة المشاركة في شريط متصفح سفاري',
      iosStep2: 'مرّر للأسفل واضغط «إضافة إلى الشاشة الرئيسية»',
      iosStep3: 'اضغط «إضافة» في الأعلى لتشغيل زون كتطبيق أصلي',
      iosDone: 'حسناً',
      closeAria: 'إغلاق دليل التثبيت'
    }
  };

  var deferredInstallPrompt = null;
  var appInstalled = false;
  var lastHapticTs = 0;
  var wasOffline = false;
  var onlineToastTimer = null;
  var domScanRaf = 0;

  var swState = {
    supported: false,
    eligible: false,
    registered: false,
    scope: null,
    state: 'idle',
    updateAvailable: false,
    error: null
  };

  var observedIframes = new Set();
  var iframeInViewMap = new WeakMap();
  var iframeObserver = null;
  var visibilityMessagesSent = 0;
  var lazyImagesOptimized = 0;

  /* ------------------------------------------------------------------------
   * 1. ENVIRONMENT & CAPABILITY DETECTORS
   * ------------------------------------------------------------------------ */
  function isAr() {
    var root = document.documentElement;
    return Boolean(root && (root.lang === 'ar' || root.dir === 'rtl'));
  }

  function copy() {
    return isAr() ? COPY.ar : COPY.en;
  }

  function safeMatchMedia(query) {
    try {
      return Boolean(window.matchMedia && window.matchMedia(query).matches);
    } catch (_) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return safeMatchMedia('(prefers-reduced-motion: reduce)');
  }

  function isStandalone() {
    return Boolean(
      safeMatchMedia('(display-mode: standalone)') ||
      safeMatchMedia('(display-mode: fullscreen)') ||
      window.navigator.standalone === true ||
      Boolean(window.Capacitor)
    );
  }

  function isIosDevice() {
    var ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
  }

  function isIosSafari() {
    if (!isIosDevice()) return false;
    var ua = navigator.userAgent || '';
    return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  }

  function isMobile() {
    var narrow = window.innerWidth > 0 && window.innerWidth <= 900;
    var coarse = safeMatchMedia('(pointer: coarse)');
    var mobileUa = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    return Boolean(narrow || coarse || mobileUa);
  }

  function isLowPower() {
    var mem = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
    var saveData = Boolean(navigator.connection && navigator.connection.saveData);
    var reduced = prefersReducedMotion();
    var cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
    var lowMem = mem !== null && mem <= 4;
    var lowMobileCpu = cores !== null && cores > 0 && cores <= 4 && isMobile();
    return Boolean(lowMem || saveData || reduced || lowMobileCpu);
  }

  function getDprCap() {
    var dpr = Number(window.devicePixelRatio) || 1;
    if (isLowPower()) return Math.min(dpr, 1.25);
    if (isMobile()) return Math.min(dpr, 1.5);
    return Math.min(dpr, 2);
  }

  function isInstallDismissed() {
    try {
      var raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return false;
      var ts = Number(raw);
      if (!Number.isFinite(ts) || ts <= 0) return false;
      return (Date.now() - ts) < DISMISS_TTL_MS;
    } catch (_) {
      return false;
    }
  }

  function markInstallDismissed() {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch (_) {}
  }

  function readStoredTheme() {
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

  function getCurrentTheme() {
    var root = document.documentElement;
    var attr = root ? root.getAttribute('data-theme') : '';
    if (attr === 'light' || attr === 'dark') return attr;
    return readStoredTheme() === 'light' ? 'light' : 'dark';
  }

  /* ------------------------------------------------------------------------
   * 2. DYNAMIC <meta name="theme-color"> SYNC
   * ------------------------------------------------------------------------ */
  function syncThemeColor(explicitTheme) {
    var theme = (explicitTheme === 'light' || explicitTheme === 'dark')
      ? explicitTheme
      : getCurrentTheme();
    var color = theme === 'light' ? THEME_LIGHT_COLOR : THEME_DARK_COLOR;
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return color;

    var metas = head.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      var meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', color);
      head.appendChild(meta);
    } else {
      for (var i = 0; i < metas.length; i++) {
        if (metas[i].getAttribute('content') !== color) {
          metas[i].setAttribute('content', color);
        }
      }
    }
    return color;
  }

  function getCurrentMetaThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    return meta ? meta.getAttribute('content') : null;
  }

  /* ------------------------------------------------------------------------
   * 3. ROOT ENVIRONMENT FLAGS (STANDALONE / MOBILE / LOW-POWER)
   * ------------------------------------------------------------------------ */
  function syncEnvironmentAttributes() {
    var root = document.documentElement;
    if (!root) return;

    if (isStandalone()) {
      root.setAttribute('data-zone-standalone', '1');
    } else {
      root.removeAttribute('data-zone-standalone');
    }

    if (isMobile()) {
      root.setAttribute('data-zone-mobile-app', '1');
    } else {
      root.removeAttribute('data-zone-mobile-app');
    }

    if (isLowPower()) {
      root.setAttribute('data-zone-low-power', '1');
    } else {
      root.removeAttribute('data-zone-low-power');
    }
  }

  /* ------------------------------------------------------------------------
   * 4. SERVICE WORKER REGISTRATION (./sw.js, ZERO FORCE-RELOAD)
   * ------------------------------------------------------------------------ */
  function isSwEligibleOrigin() {
    var loc = window.location;
    if (!loc) return false;
    var proto = loc.protocol;
    var host = loc.hostname;
    return (
      proto === 'https:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]'
    );
  }

  function registerServiceWorker() {
    swState.supported = Boolean('serviceWorker' in navigator);
    swState.eligible = isSwEligibleOrigin();
    if (!swState.supported || !swState.eligible) return;

    try {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then(function (registration) {
          swState.registered = true;
          swState.scope = registration.scope || './';
          var worker = registration.active || registration.waiting || registration.installing;
          swState.state = worker ? worker.state : 'registered';

          if (registration.waiting && navigator.serviceWorker.controller) {
            swState.updateAvailable = true;
          }

          registration.addEventListener('updatefound', function () {
            var nextWorker = registration.installing;
            if (!nextWorker) return;
            swState.state = nextWorker.state;
            nextWorker.addEventListener('statechange', function () {
              swState.state = nextWorker.state;
              if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
                /* Graceful update marker: never force-reload mid-action */
                swState.updateAvailable = true;
              }
            });
          });
        })
        .catch(function (err) {
          swState.registered = false;
          swState.state = 'error';
          swState.error = err ? String(err.message || err) : 'registration_failed';
        });
    } catch (err) {
      swState.registered = false;
      swState.state = 'error';
      swState.error = err ? String(err.message || err) : 'registration_exception';
    }
  }

  /* ------------------------------------------------------------------------
   * 5. WEBGL IFRAME VISIBILITY THROTTLING & LAZY IMAGE OPTIMIZER
   * ------------------------------------------------------------------------ */
  function postVisibilityToIframe(iframe, inView) {
    if (!iframe || !iframe.contentWindow) return;
    var payload = {
      type: 'ZONE_APP_VISIBILITY',
      hidden: Boolean(document.hidden),
      inView: Boolean(inView),
      mobile: isMobile(),
      lowPower: isLowPower(),
      dprCap: getDprCap()
    };
    try {
      var targetOrigin = (window.location && window.location.origin && window.location.origin !== 'null')
        ? window.location.origin
        : '*';
      iframe.contentWindow.postMessage(payload, targetOrigin);
      visibilityMessagesSent += 1;
    } catch (_) {
      try {
        iframe.contentWindow.postMessage(payload, '*');
        visibilityMessagesSent += 1;
      } catch (__) {}
    }
  }

  function broadcastAllIframeVisibility() {
    observedIframes.forEach(function (iframe) {
      if (!document.contains(iframe)) {
        observedIframes.delete(iframe);
        return;
      }
      var inView = iframeInViewMap.has(iframe) ? iframeInViewMap.get(iframe) : true;
      postVisibilityToIframe(iframe, inView);
    });
  }

  function ensureIframeObserver() {
    if (iframeObserver || typeof IntersectionObserver !== 'function') return;
    iframeObserver = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var iframe = entry.target;
          var inView = Boolean(entry.isIntersecting && entry.intersectionRatio > 0);
          iframeInViewMap.set(iframe, inView);
          postVisibilityToIframe(iframe, inView);
        }
      },
      { root: null, rootMargin: '80px 0px', threshold: [0, 0.05] }
    );
  }

  function scanWebglIframes() {
    ensureIframeObserver();
    var nodes = document.querySelectorAll(WEBGL_IFRAME_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var iframe = nodes[i];
      if (iframe.tagName !== 'IFRAME') continue;
      if (observedIframes.has(iframe)) continue;
      observedIframes.add(iframe);
      iframeInViewMap.set(iframe, true);
      if (iframeObserver) {
        iframeObserver.observe(iframe);
      }
      (function (frame) {
        frame.addEventListener('load', function () {
          var currentInView = iframeInViewMap.has(frame) ? iframeInViewMap.get(frame) : true;
          postVisibilityToIframe(frame, currentInView);
        });
      })(iframe);
      postVisibilityToIframe(iframe, true);
    }

    /* Prune detached iframes */
    observedIframes.forEach(function (frame) {
      if (!document.contains(frame)) {
        if (iframeObserver) iframeObserver.unobserve(frame);
        observedIframes.delete(frame);
      }
    });
  }

  function optimizeMainImages() {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var imgs = main.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.getAttribute('data-zas-img-opt') === '1') continue;
      /* Keep priority hero artwork eager */
      var isHero = Boolean(
        img.getAttribute('fetchpriority') === 'high' ||
        img.getAttribute('data-zone-hero') === '1' ||
        (img.closest && img.closest('.zone-page-heading, .zwc-city-pano, .zwc-hero'))
      );
      img.setAttribute('data-zas-img-opt', '1');
      if (isHero) continue;

      var changed = false;
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
        changed = true;
      }
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
        changed = true;
      }
      if (changed) lazyImagesOptimized += 1;
    }
  }

  function scheduleDomOptimization() {
    if (domScanRaf) return;
    domScanRaf = window.requestAnimationFrame(function () {
      domScanRaf = 0;
      scanWebglIframes();
      optimizeMainImages();
    });
  }

  /* ------------------------------------------------------------------------
   * 6. INSTALL APP BANNER & iOS ADD-TO-HOME-SCREEN GUIDE MODAL
   * ------------------------------------------------------------------------ */
  function hideInstallBanner() {
    var banner = document.getElementById('zas-install-banner');
    if (banner) banner.setAttribute('hidden', '');
  }

  function closeIosModal() {
    var modal = document.getElementById('zas-ios-modal');
    if (modal) modal.setAttribute('hidden', '');
  }

  function openIosModal() {
    if (!document.body || isStandalone()) return;
    var c = copy();
    var modal = document.getElementById('zas-ios-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'zas-ios-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'zas-ios-title');
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeIosModal();
      });
      document.body.appendChild(modal);
    }

    var shareSvg =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3v12"/>' +
        '<path d="M7.5 7.5L12 3l4.5 4.5"/>' +
        '<path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>' +
      '</svg>';

    var plusSvg =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="4" y="4" width="16" height="16" rx="3"/>' +
        '<path d="M12 8v8M8 12h8"/>' +
      '</svg>';

    var checkSvg =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 13l4 4L19 7"/>' +
      '</svg>';

    modal.innerHTML =
      '<div class="zas-ios-card">' +
        '<div class="zas-ios-head">' +
          '<h2 id="zas-ios-title" class="zas-ios-title">' + c.iosTitle + '</h2>' +
          '<button type="button" class="zas-close-btn" id="zas-ios-close" aria-label="' + c.closeAria + '">✕</button>' +
        '</div>' +
        '<p class="zas-ios-lead">' + c.iosLead + '</p>' +
        '<ol class="zas-ios-steps">' +
          '<li class="zas-ios-step"><span class="zas-step-badge">1</span><span class="zas-step-ico">' + shareSvg + '</span><span>' + c.iosStep1 + '</span></li>' +
          '<li class="zas-ios-step"><span class="zas-step-badge">2</span><span class="zas-step-ico">' + plusSvg + '</span><span>' + c.iosStep2 + '</span></li>' +
          '<li class="zas-ios-step"><span class="zas-step-badge">3</span><span class="zas-step-ico">' + checkSvg + '</span><span>' + c.iosStep3 + '</span></li>' +
        '</ol>' +
        '<div class="zas-ios-actions">' +
          '<button type="button" class="zas-ios-btn" id="zas-ios-done">' + c.iosDone + '</button>' +
        '</div>' +
      '</div>';

    modal.removeAttribute('hidden');

    var closeBtn = modal.querySelector('#zas-ios-close');
    var doneBtn = modal.querySelector('#zas-ios-done');
    if (closeBtn) closeBtn.addEventListener('click', closeIosModal);
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        markInstallDismissed();
        hideInstallBanner();
        closeIosModal();
      });
    }
  }

  function triggerInstall(options) {
    var opts = options || {};
    if (isStandalone() || appInstalled) {
      hideInstallBanner();
      return Promise.resolve({ outcome: 'standalone' });
    }

    if (deferredInstallPrompt) {
      var promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      try {
        promptEvent.prompt();
        return Promise.resolve(promptEvent.userChoice).then(function (choice) {
          var outcome = (choice && choice.outcome) ? choice.outcome : 'dismissed';
          if (outcome === 'accepted') {
            appInstalled = true;
            hideInstallBanner();
          } else {
            markInstallDismissed();
            hideInstallBanner();
          }
          return { outcome: outcome };
        });
      } catch (err) {
        return Promise.resolve({ outcome: 'error', error: String(err && err.message || err) });
      }
    }

    if (isIosDevice() || opts.forceModal) {
      openIosModal();
      return Promise.resolve({ outcome: 'ios-guide' });
    }

    return Promise.resolve({ outcome: 'unavailable' });
  }

  function renderInstallBanner() {
    if (!document.body) return;
    if (isStandalone() || appInstalled || isInstallDismissed()) {
      hideInstallBanner();
      return;
    }

    var shouldShow = Boolean(deferredInstallPrompt || isIosSafari());
    var banner = document.getElementById('zas-install-banner');
    if (!shouldShow) {
      if (banner) banner.setAttribute('hidden', '');
      return;
    }

    var c = copy();
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'zas-install-banner';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', c.installAria);
      document.body.appendChild(banner);
    }

    var appIconSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3v12"/>' +
        '<path d="M7.5 10.5L12 15l4.5-4.5"/>' +
        '<path d="M5 18.5h14"/>' +
      '</svg>';

    var sig = (isAr() ? 'ar' : 'en') + '|' + (deferredInstallPrompt ? 'bip' : 'ios');
    if (banner.getAttribute('data-sig') !== sig) {
      banner.setAttribute('data-sig', sig);
      banner.setAttribute('aria-label', c.installAria);
      banner.innerHTML =
        '<span class="zas-install-ico" aria-hidden="true">' + appIconSvg + '</span>' +
        '<button type="button" class="zas-install-cta" id="zas-install-btn">' + c.installCta + '</button>' +
        '<button type="button" class="zas-dismiss-btn" id="zas-install-dismiss" aria-label="' + c.dismissAria + '">✕</button>';

      var installBtn = banner.querySelector('#zas-install-btn');
      var dismissBtn = banner.querySelector('#zas-install-dismiss');
      if (installBtn) {
        installBtn.addEventListener('click', function () {
          triggerInstall();
        });
      }
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          markInstallDismissed();
          hideInstallBanner();
        });
      }
    }

    banner.removeAttribute('hidden');
  }

  /* ------------------------------------------------------------------------
   * 7. OFFLINE / ONLINE RESILIENCE PILL
   * ------------------------------------------------------------------------ */
  function syncNetworkBanner(forceShowOnline) {
    if (!document.body) return;
    var offline = navigator.onLine === false;
    var pill = document.getElementById('zas-offline-banner');
    var c = copy();

    if (onlineToastTimer) {
      clearTimeout(onlineToastTimer);
      onlineToastTimer = null;
    }

    if (offline) {
      wasOffline = true;
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'zas-offline-banner';
        pill.setAttribute('role', 'status');
        pill.setAttribute('aria-live', 'polite');
        document.body.appendChild(pill);
      }
      pill.setAttribute('data-state', 'offline');
      pill.innerHTML =
        '<span class="zas-status-dot" aria-hidden="true"></span>' +
        '<span class="zas-status-text">' + c.offlineText + '</span>';
      pill.removeAttribute('hidden');
      return;
    }

    if (wasOffline || forceShowOnline) {
      wasOffline = false;
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'zas-offline-banner';
        pill.setAttribute('role', 'status');
        pill.setAttribute('aria-live', 'polite');
        document.body.appendChild(pill);
      }
      pill.setAttribute('data-state', 'online');
      pill.innerHTML =
        '<span class="zas-status-dot" aria-hidden="true"></span>' +
        '<span class="zas-status-text">' + c.onlineText + '</span>';
      pill.removeAttribute('hidden');
      onlineToastTimer = setTimeout(function () {
        if (pill && navigator.onLine !== false) {
          pill.setAttribute('hidden', '');
        }
      }, 2200);
      return;
    }

    if (pill) {
      pill.setAttribute('hidden', '');
    }
  }

  /* ------------------------------------------------------------------------
   * 8. TACTILE HAPTIC FEEDBACK (ANDROID / WEB VIBRATION API)
   * ------------------------------------------------------------------------ */
  function triggerHapticPulse() {
    if (prefersReducedMotion()) return;
    if (typeof navigator.vibrate !== 'function') return;
    var now = Date.now();
    if (now - lastHapticTs < 40) return;
    lastHapticTs = now;
    try {
      navigator.vibrate(8);
    } catch (_) {}
  }

  function setupHaptics() {
    document.addEventListener(
      'click',
      function (ev) {
        if (!ev || !ev.target || typeof ev.target.closest !== 'function') return;
        var target = ev.target.closest(HAPTIC_CTA_SELECTOR);
        if (!target) return;
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') return;
        triggerHapticPulse();
      },
      { capture: true, passive: true }
    );
  }

  /* ------------------------------------------------------------------------
   * 9. DIAGNOSTICS & PUBLIC API
   * ------------------------------------------------------------------------ */
  function getDiagnostics() {
    return {
      version: VERSION,
      standalone: isStandalone(),
      mobile: isMobile(),
      lowPower: isLowPower(),
      ios: isIosDevice(),
      iosSafari: isIosSafari(),
      online: navigator.onLine !== false,
      theme: getCurrentTheme(),
      themeColor: getCurrentMetaThemeColor(),
      dpr: Number(window.devicePixelRatio) || 1,
      dprCap: getDprCap(),
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0
      },
      hapticsSupported: typeof navigator.vibrate === 'function',
      reducedMotion: prefersReducedMotion(),
      installPromptReady: Boolean(deferredInstallPrompt),
      installDismissed: isInstallDismissed(),
      sw: {
        supported: swState.supported,
        eligible: swState.eligible,
        registered: swState.registered,
        scope: swState.scope,
        state: swState.state,
        updateAvailable: swState.updateAvailable,
        error: swState.error
      },
      webglIframesObserved: observedIframes.size,
      visibilityMessagesSent: visibilityMessagesSent,
      lazyImagesOptimized: lazyImagesOptimized
    };
  }

  window.ZoneAppShell = {
    version: VERSION,
    isStandalone: isStandalone,
    isMobile: isMobile,
    isLowPower: isLowPower,
    syncThemeColor: syncThemeColor,
    triggerInstall: triggerInstall,
    getDiagnostics: getDiagnostics
  };

  /* ------------------------------------------------------------------------
   * 10. BOOTSTRAP & EVENT WIRING
   * ------------------------------------------------------------------------ */
  syncEnvironmentAttributes();
  syncThemeColor();

  /* Observe data-theme, dir, and lang mutations on <html> */
  if (document.documentElement && typeof MutationObserver === 'function') {
    var rootObserver = new MutationObserver(function (records) {
      var themeChanged = false;
      var langChanged = false;
      for (var i = 0; i < records.length; i++) {
        var attr = records[i].attributeName;
        if (attr === 'data-theme') themeChanged = true;
        if (attr === 'dir' || attr === 'lang') langChanged = true;
      }
      if (themeChanged) syncThemeColor();
      if (langChanged) {
        renderInstallBanner();
        if (navigator.onLine === false) syncNetworkBanner(false);
        var iosModal = document.getElementById('zas-ios-modal');
        if (iosModal && !iosModal.hasAttribute('hidden')) openIosModal();
      }
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'dir', 'lang']
    });
  }

  /* Native PWA Install Prompt Capture */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    appInstalled = true;
    deferredInstallPrompt = null;
    hideInstallBanner();
    closeIosModal();
  });

  /* Network Online / Offline Resilience */
  window.addEventListener('offline', function () {
    syncNetworkBanner(false);
  });

  window.addEventListener('online', function () {
    syncNetworkBanner(true);
  });

  /* Visibility & Viewport/Display-Mode Changes */
  document.addEventListener('visibilitychange', function () {
    broadcastAllIframeVisibility();
  });

  window.addEventListener('pagehide', function () {
    broadcastAllIframeVisibility();
  });

  window.addEventListener('pageshow', function () {
    syncEnvironmentAttributes();
    syncThemeColor();
    broadcastAllIframeVisibility();
  });

  var resizeTimer = null;
  window.addEventListener(
    'resize',
    function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        syncEnvironmentAttributes();
        broadcastAllIframeVisibility();
      }, 120);
    },
    { passive: true }
  );

  document.addEventListener('keydown', function (ev) {
    if (ev && ev.key === 'Escape') {
      var modal = document.getElementById('zas-ios-modal');
      if (modal && !modal.hasAttribute('hidden')) {
        closeIosModal();
      }
    }
  });

  try {
    if (window.matchMedia) {
      var standaloneMq = window.matchMedia('(display-mode: standalone)');
      var motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var onMediaChange = function () {
        syncEnvironmentAttributes();
        renderInstallBanner();
        broadcastAllIframeVisibility();
      };
      if (typeof standaloneMq.addEventListener === 'function') {
        standaloneMq.addEventListener('change', onMediaChange);
        motionMq.addEventListener('change', onMediaChange);
      }
    }
    if (navigator.connection && typeof navigator.connection.addEventListener === 'function') {
      navigator.connection.addEventListener('change', function () {
        syncEnvironmentAttributes();
        broadcastAllIframeVisibility();
      });
    }
  } catch (_) {}

  function onDomReady() {
    syncEnvironmentAttributes();
    syncThemeColor();
    setupHaptics();
    renderInstallBanner();
    syncNetworkBanner(false);
    scanWebglIframes();
    optimizeMainImages();

    if (document.body && typeof MutationObserver === 'function') {
      var bodyObserver = new MutationObserver(function () {
        scheduleDomOptimization();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    onDomReady();
  }

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }
})();

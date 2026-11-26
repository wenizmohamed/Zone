/* ==========================================================================
 * ZONE v155 - SYNCHRONOUS 3D ECS BRIDGE, AUTO-SCANNER & ZERO-BLANK #zone-char-3d
 * Exclusive Ownership: @char-3d-anim (assets/ui/zone-ecs-3d-bridge.js)
 * Exposes: window.ZoneEcs3D synchronously (1 Shared WebGL Context Runtime)
 * Fiber-safe: append-only DOM mounts; never mutates or removes <x-dc> nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneEcs3DBridgeLoaded && window.ZoneEcs3D) return;
  window.__zoneEcs3DBridgeLoaded = true;

  var runtime = null;
  var pendingCalls = [];
  var scanScheduled = false;
  var readyResolvers = [];
  var charWatchTimer = 0;
  var charWatchEl = null;
  var charMountTimestamps = typeof WeakMap === 'function' ? new WeakMap() : null;
  var currentCharOutfit = 'street';
  var CHAR_WATCHDOG_MS = 1600;

  function enqueue(method, args) {
    if (runtime && typeof runtime[method] === 'function') {
      return runtime[method].apply(runtime, args);
    }
    pendingCalls.push({ method: method, args: args });
    return false;
  }

  /**
   * Anchors a non-resetting mount timestamp per `#zone-char-3d` element instance
   * so rapid MutationObserver scans (<200ms) never reset or starve the 1600ms clock.
   */
  function getCharMountTimestamp(charEl) {
    if (!charEl) return 0;
    if (charMountTimestamps && charMountTimestamps.has(charEl)) {
      return charMountTimestamps.get(charEl);
    }
    if (typeof charEl.__z3dMountTs === 'number' && charEl.__z3dMountTs > 0) {
      return charEl.__z3dMountTs;
    }
    var now = Date.now();
    if (charMountTimestamps) charMountTimestamps.set(charEl, now);
    try {
      charEl.__z3dMountTs = now;
    } catch (_) { /* frozen mock safe */ }
    return now;
  }

  function inferNativeItemSpec(nameText, metaText, thumbSrc) {
    var src = String(thumbSrc || '').toLowerCase();
    var mThumb = src.match(/\/thumbnails\/([a-z0-9_]+)\.png/);
    if (mThumb && mThumb[1]) {
      var tk = mThumb[1];
      return { id: tk, cat: (tk === 'knife' || tk === 'bat') ? 'melee' : 'weapon' };
    }
    if (src.indexOf('m4-thumbnail') !== -1) return { id: 'assaultrifle_1', cat: 'weapon' };
    if (src.indexOf('g3a3-thumbnail') !== -1) return { id: 'assaultrifle_2', cat: 'weapon' };
    if (src.indexOf('l85-thumbnail') !== -1) return { id: 'bullpup_1', cat: 'weapon' };
    if (src.indexOf('glock18-thumbnail') !== -1) return { id: 'pistol_2', cat: 'weapon' };
    if (src.indexOf('dragunov-thumbnail') !== -1) return { id: 'sniperrifle_2', cat: 'weapon' };
    if (src.indexOf('mosin9130-thumbnail') !== -1) return { id: 'sniperrifle_3', cat: 'weapon' };

    var hay = (String(nameText || '') + ' ' + String(metaText || '')).toLowerCase();
    // Crime Enhancers & Bespoke Syndicate Tools
    if (/شفرة|razor/.test(hay)) return { id: 'cut_throat_razor', cat: 'melee' };
    if (/عتلة|crowbar|pry/.test(hay)) return { id: 'crowbar', cat: 'enhancer' };
    if (/أقفال|lockpick/.test(hay)) return { id: 'lockpick', cat: 'enhancer' };
    if (/مثقاب|drill/.test(hay)) return { id: 'drill', cat: 'enhancer' };
    if (/اختراق|cyberdeck|hacking|laptop/.test(hay)) return { id: 'hacking_rig', cat: 'enhancer' };
    if (/مفتاح|بطاقة دخول|keycard|rfid/.test(hay)) return { id: 'keycard', cat: 'enhancer' };
    if (/ناسخ بطاقات|skimmer/.test(hay)) return { id: 'skimmer', cat: 'enhancer' };
    if (/شريط لاصق|duct tape|\btape\b/.test(hay)) return { id: 'duct_tape', cat: 'enhancer' };
    if (/كشاف|flashlight|torch/.test(hay)) return { id: 'flashlight', cat: 'enhancer' };
    if (/مكبر صوت|megaphone|bullhorn/.test(hay)) return { id: 'megaphone', cat: 'enhancer' };
    if (/قناع طلاء|paint mask|respirator/.test(hay)) return { id: 'paint_mask', cat: 'enhancer' };
    if (/قفازات لاتكس|latex gloves|nitrile/.test(hay)) return { id: 'latex_gloves', cat: 'enhancer' };
    if (/كرسي|office chair|\bchair\b/.test(hay)) return { id: 'office_chair', cat: 'enhancer' };
    if (/عدسة|magnifying|loupe/.test(hay)) return { id: 'magnifying_glass', cat: 'enhancer' };
    if (/لوحة مفاتيح|keyboard/.test(hay)) return { id: 'ergonomic_keyboard', cat: 'enhancer' };
    if (/قداحة|lighter|zippo/.test(hay)) return { id: 'windproof_lighter', cat: 'enhancer' };
    if (/محرك نسخ|high-speed drive|nvme/.test(hay)) return { id: 'high_speed_drive', cat: 'enhancer' };
    if (/دراجة|mountain bike|\bbike\b/.test(hay)) return { id: 'mountain_bike', cat: 'vehicle' };
    if (/نظارات|glasses|goggles/.test(hay)) return { id: 'glasses', cat: 'enhancer' };

    // Weapons & Melee
    if (/كلاشنكوف|\bak\b/.test(hay)) return { id: 'ak', cat: 'weapon' };
    if (/بولباب|bullpup/.test(hay)) return { id: 'bullpup_2', cat: 'weapon' };
    if (/قنّاص|قناص|sniper/.test(hay)) return { id: 'sniper', cat: 'weapon' };
    if (/مقصوصة|sawed/.test(hay)) return { id: 'sawedoff', cat: 'weapon' };
    if (/خرطوش|shotgun/.test(hay)) return { id: 'shotgun', cat: 'weapon' };
    if (/رشاش|smg|submachine/.test(hay)) return { id: 'smg', cat: 'weapon' };
    if (/دوّار|دوار|revolver|magnum/.test(hay)) return { id: 'revolver', cat: 'weapon' };
    if (/مسدس|pistol/.test(hay)) return { id: 'pistol', cat: 'weapon' };
    if (/بندقية|rifle/.test(hay)) return { id: 'assaultrifle_1', cat: 'weapon' };
    if (/قبضة|براجم|knuckle/.test(hay)) return { id: 'knuckles', cat: 'melee' };
    if (/صاعق|stun.*baton|taser/.test(hay)) return { id: 'stun_baton', cat: 'melee' };
    if (/مطرقة|hammer|sledge/.test(hay)) return { id: 'hammer', cat: 'melee' };
    if (/سكين|knife|blade|dagger/.test(hay)) return { id: 'knife', cat: 'melee' };
    if (/كاتانا|سيف|katana|sword/.test(hay)) return { id: 'katana', cat: 'melee' };
    if (/مضرب|هراوة|bat|club/.test(hay)) return { id: 'bat', cat: 'melee' };

    // Armor, Drugs, Medical, Boosters, Contraband, Casino & Companions
    if (/خوذة|helmet/.test(hay)) return { id: 'helmet', cat: 'armor' };
    if (/حذاء|أحذية|boots/.test(hay)) return { id: 'boots', cat: 'armor' };
    if (/قفاز|قفازات تكتيكية|gloves/.test(hay)) return { id: 'gloves', cat: 'armor' };
    if (/بنطال|سروال|pants|trousers/.test(hay)) return { id: 'pants', cat: 'armor' };
    if (/درع|سترة|kevlar|vest|armor/.test(hay)) return { id: 'kevlar', cat: 'armor' };
    if (/زاناكس|xanax/.test(hay)) return { id: 'xanax', cat: 'drug' };
    if (/إكستاسي|ecstasy/.test(hay)) return { id: 'ecstasy', cat: 'drug' };
    if (/فيكودين|vicodin/.test(hay)) return { id: 'vicodin', cat: 'drug' };
    if (/قنب|cannabis/.test(hay)) return { id: 'cannabis', cat: 'drug' };
    if (/lsd|إل إس دي/.test(hay)) return { id: 'lsd', cat: 'drug' };
    if (/دم|blood/.test(hay)) return { id: 'bloodbag', cat: 'medical' };
    if (/مورفين|morphine|syringe/.test(hay)) return { id: 'morphine', cat: 'medical' };
    if (/صغيرة|small.*med|first aid/.test(hay)) return { id: 'small_medkit', cat: 'medical' };
    if (/إسعاف|طب|medkit|medical|heal/.test(hay)) return { id: 'medkit', cat: 'medical' };
    if (/فيذري|feathery|fhc|hotel/.test(hay)) return { id: 'fhc', cat: 'booster' };
    if (/قرص|dvd|edvd/.test(hay)) return { id: 'edvd', cat: 'booster' };
    if (/كحول|ويسكي|نبيد|alcohol|whisky|champagne|bourbon/.test(hay)) return { id: 'alcohol', cat: 'booster' };
    if (/حلوى|candy|choc/.test(hay)) return { id: 'candy', cat: 'booster' };
    if (/طاقة|معزز|energy|drink|can|booster/.test(hay)) return { id: 'edrink', cat: 'booster' };
    if (/ذهب|سبيكة|gold|bullion/.test(hay)) return { id: 'gold_bullion', cat: 'contraband' };
    if (/زهرة|أوركيد|flower|orchid/.test(hay)) return { id: 'orchid', cat: 'contraband' };
    if (/دمية|تميمة|plush/.test(hay)) return { id: 'plushie', cat: 'contraband' };
    if (/روليت|roulette/.test(hay)) return { id: 'roulette_wheel', cat: 'casino' };
    if (/سلوت|ماكينة|slot/.test(hay)) return { id: 'slot_machine', cat: 'casino' };
    if (/مدرعة|شاحنة|van|armored/.test(hay)) return { id: 'armored_van', cat: 'vehicle' };
    if (/اعتراض|سيدان|interceptor|sedan/.test(hay)) return { id: 'interceptor_sedan', cat: 'vehicle' };
    if (/سيارة|car|racer/.test(hay)) return { id: 'sports_car', cat: 'vehicle' };
    return { id: 'weapon_cache', cat: 'cache' };
  }

  function parseOutfitKeyword(raw, fallbackIdx) {
    var s = String(raw || '').toLowerCase();
    if (/suit|بدلة|رسمي|exec/.test(s)) return 'suit';
    if (/tact|تكتيك|درع|قتال|armor/.test(s)) return 'tactical';
    if (/street|شارع|casual/.test(s)) return 'street';
    if (fallbackIdx === 1) return 'suit';
    if (fallbackIdx === 2) return 'tactical';
    return 'street';
  }

  function detectActiveOutfit() {
    var explicit = document.querySelector('[data-outfit][aria-pressed="true"], [data-outfit].is-active, [data-outfit].active');
    if (explicit) return parseOutfitKeyword(explicit.getAttribute('data-outfit'), 0);
    var btns = document.querySelectorAll('.zone-home-character .zone-panel-heading button');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('aria-pressed') === 'true') {
        return parseOutfitKeyword(btns[i].getAttribute('data-outfit') || btns[i].textContent, i);
      }
    }
    return currentCharOutfit || 'street';
  }

  /**
   * Inspects `#zone-char-3d` (both `<iframe>` and standalone container modes).
   * Mounts `[data-z3d-stage="character-turntable"]` immediately (`0ms`) as an
   * instant 3D overlay whenever `#zone-char-3d` does not yet have a `ready`
   * non-zero WebGL canvas (`hasHealthyCanvas === false`), so `Home` NEVER shows
   * a blank silver-grey rectangle! If `dist/character3d.html` later reaches
   * `ready` with a non-zero canvas, smoothly hides the fallback overlay.
   */
  function evaluateChar3DFallback(allowInstantOverlay) {
    var charEl = document.getElementById('zone-char-3d');
    if (!charEl) return false;

    var mountTs = getCharMountTimestamp(charEl);
    var hostEl = charEl.tagName === 'IFRAME' ? (charEl.parentElement || charEl) : charEl;
    var existingFallback = hostEl && hostEl.querySelector
      ? hostEl.querySelector('[data-z3d-stage="character-turntable"]')
      : null;

    var explicitFail = false;
    var hasHealthyCanvas = false;

    var outerUnavail = hostEl && hostEl.querySelector
      ? hostEl.querySelector('.zone-preview-unavailable, #zone-media-error')
      : null;
    if (outerUnavail) explicitFail = true;

    if (charEl.tagName === 'IFRAME') {
      if (!charEl.__z3dLoadBound && typeof charEl.addEventListener === 'function') {
        charEl.__z3dLoadBound = true;
        charEl.addEventListener('load', function () {
          evaluateChar3DFallback(true);
        });
      }
      try {
        var doc = charEl.contentDocument;
        if (doc && doc.body) {
          var errEl = doc.getElementById('zone-media-error') || doc.querySelector('.zone-preview-unavailable');
          if (errEl || (doc.body.dataset && doc.body.dataset.zoneMediaState === 'error')) {
            explicitFail = true;
            if (errEl && errEl.style) errEl.style.display = 'none';
          } else {
            var stageRoot = doc.getElementById('stage');
            var c = doc.querySelector('canvas') || (stageRoot && stageRoot.shadowRoot && stageRoot.shadowRoot.querySelector('canvas'));
            if (c && c.width > 0 && c.height > 0 && doc.body.dataset && doc.body.dataset.zoneMediaState === 'ready') {
              hasHealthyCanvas = true;
            }
          }
        }
      } catch (_) {
        // Cross-origin safety fallback
      }
    } else {
      if (/unavailable|غير متاحة/i.test(charEl.textContent || '')) {
        explicitFail = true;
      }
      var nativeCanvas = charEl.querySelector ? charEl.querySelector('canvas:not(.z3d-stage-webgl-canvas)') : null;
      if (nativeCanvas && nativeCanvas.width > 0 && nativeCanvas.height > 0 && !explicitFail) {
        hasHealthyCanvas = true;
      }
    }

    if (hasHealthyCanvas && !explicitFail) {
      if (existingFallback && existingFallback.style) {
        existingFallback.style.opacity = '0';
        existingFallback.style.pointerEvents = 'none';
        existingFallback.style.display = 'none';
        existingFallback.setAttribute('data-z3d-fallback-hidden', '1');
      }
      if (charEl.tagName === 'IFRAME' && charEl.style) {
        charEl.style.opacity = '';
        charEl.style.pointerEvents = '';
      }
      return false;
    }

    // Default to instant 0ms overlay whenever healthy WebGL canvas is absent
    var shouldMount = allowInstantOverlay !== false || explicitFail || (Date.now() - mountTs >= CHAR_WATCHDOG_MS);
    if (!shouldMount) return false;

    // Hide any "3D preview is unavailable" message without removing Fiber-managed nodes
    if (hostEl && hostEl.querySelectorAll) {
      var unavailNodes = hostEl.querySelectorAll('.zone-preview-unavailable, #zone-media-error');
      for (var u = 0; u < unavailNodes.length; u++) {
        if (unavailNodes[u] && unavailNodes[u].style) {
          unavailNodes[u].style.display = 'none';
        }
      }
    }
    if (charEl.tagName === 'IFRAME' && charEl.style) {
      charEl.style.opacity = '0';
      charEl.style.pointerEvents = 'none';
    }
    if (hostEl && hostEl.style && hostEl.tagName !== 'X-DC') {
      hostEl.style.position = 'relative';
      hostEl.style.overflow = 'hidden';
    }

    currentCharOutfit = detectActiveOutfit();
    var overlayCss = 'position:absolute;inset:0;width:100%;height:100%;min-height:100%;z-index:2;opacity:1;pointer-events:auto;transition:opacity 0.22s ease;';
    if (!existingFallback) {
      var stageDiv = document.createElement('div');
      stageDiv.className = 'z3d-action-stage z3d-char-turntable-stage';
      stageDiv.style.cssText = overlayCss;
      stageDiv.setAttribute('data-z3d-stage', 'character-turntable');
      stageDiv.setAttribute('data-z3d-outfit', currentCharOutfit);
      stageDiv.setAttribute('data-z3d-mount-ts', String(mountTs));
      hostEl.appendChild(stageDiv);
      enqueue('scan', [hostEl]);
    } else {
      var wasHidden = existingFallback.style.display === 'none' || existingFallback.getAttribute('data-z3d-fallback-hidden') === '1';
      var prevOutfit = existingFallback.getAttribute('data-z3d-outfit');
      if (wasHidden) {
        existingFallback.style.cssText = overlayCss;
        if (typeof existingFallback.removeAttribute === 'function') {
          existingFallback.removeAttribute('data-z3d-fallback-hidden');
        } else {
          existingFallback.setAttribute('data-z3d-fallback-hidden', '0');
        }
      }
      if (prevOutfit !== currentCharOutfit || wasHidden) {
        existingFallback.setAttribute('data-z3d-outfit', currentCharOutfit);
        enqueue('updateStageState', ['character-turntable', { outfit: currentCharOutfit }]);
      }
    }
    return true;
  }

  function armChar3DWatchdog() {
    var charEl = document.getElementById('zone-char-3d');
    if (!charEl) {
      if (charWatchTimer) {
        clearTimeout(charWatchTimer);
        charWatchTimer = 0;
      }
      charWatchEl = null;
      return;
    }

    var mountTs = getCharMountTimestamp(charEl);
    // Mount character-turntable immediately (0ms) when no healthy canvas is ready yet
    evaluateChar3DFallback(true);

    // Non-resetting watchdog: never clearTimeout an active timer for the same #zone-char-3d node!
    if (charWatchEl !== charEl) {
      if (charWatchTimer) {
        clearTimeout(charWatchTimer);
        charWatchTimer = 0;
      }
      charWatchEl = charEl;
    }

    var elapsed = Date.now() - mountTs;
    if (!charWatchTimer && elapsed < CHAR_WATCHDOG_MS) {
      var remaining = Math.max(16, CHAR_WATCHDOG_MS - elapsed);
      charWatchTimer = window.setTimeout(function () {
        charWatchTimer = 0;
        evaluateChar3DFallback(true);
      }, remaining);
    }
  }

  function upgradeNativeScreens(rootEl) {
    var main = document.getElementById('zone-main');
    if (main && main.querySelectorAll) {
      var staleClutter = main.querySelectorAll('.z3d-native-row-addon, .z3d-native-inspector-addon, .z3d-gym-stage-wrap');
      for (var s = 0; s < staleClutter.length; s++) {
        if (staleClutter[s] && staleClutter[s].parentElement) {
          staleClutter[s].parentElement.removeChild(staleClutter[s]);
        }
      }
    }

    // Mount instant `#zone-char-3d` 3D turntable & non-resetting watchdog whenever present
    if (document.getElementById('zone-char-3d')) {
      armChar3DWatchdog();
    }

    var scope = rootEl || document;
    if (scope.querySelectorAll) {
      var chips = scope.querySelectorAll('.z3d-stage-chip');
      for (var c = 0; c < chips.length; c++) {
        chips[c].textContent = '';
      }
    }
  }

  function performScan(rootEl) {
    upgradeNativeScreens(rootEl);
    return enqueue('scan', [rootEl]);
  }

  function scheduleDebouncedScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.requestAnimationFrame(function () {
      scanScheduled = false;
      performScan(document);
    });
  }

  var api = {
    scan: function (root) {
      return performScan(root || document);
    },
    inspectItem: function (itemId, opts) {
      return enqueue('inspectItem', [itemId, opts || {}]);
    },
    closeInspector: function () {
      return enqueue('closeInspector', []);
    },
    triggerStageAction: function (stageKind, actionName, payload) {
      return enqueue('triggerStageAction', [stageKind, actionName || 'pulse', payload || {}]);
    },
    updateStageState: function (stageKind, stateObj) {
      return enqueue('updateStageState', [stageKind, stateObj || {}]);
    },
    checkCharacterFallback: function (forceTimeout) {
      return evaluateChar3DFallback(forceTimeout === undefined ? true : !!forceTimeout);
    },
    getChar3DWatchState: function () {
      var charEl = document.getElementById('zone-char-3d');
      var hostEl = charEl && charEl.tagName === 'IFRAME' ? (charEl.parentElement || charEl) : charEl;
      var fb = hostEl && hostEl.querySelector ? hostEl.querySelector('[data-z3d-stage="character-turntable"]') : null;
      return {
        hasCharEl: !!charEl,
        mountTs: charEl ? getCharMountTimestamp(charEl) : 0,
        watchdogTimerId: charWatchTimer,
        fallbackMounted: !!fb,
        fallbackVisible: !!(fb && fb.style.display !== 'none'),
        outfit: currentCharOutfit,
      };
    },
    diagnostics: function () {
      if (runtime) return runtime.diagnostics();
      return {
        ready: false,
        ecsEntities: 0,
        activeStages: 0,
        renderedItems: 0,
        webglContexts: 0,
        drawCalls: 0,
        triangles: 0,
        contextLost: false,
      };
    },
    whenReady: function () {
      if (runtime) return Promise.resolve(runtime);
      return new Promise(function (resolve) {
        readyResolvers.push(resolve);
      });
    },
  };

  window.ZoneEcs3D = api;

  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    var inspectBtn = target.closest('[data-z3d-inspect]');
    if (inspectBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      var itemId = inspectBtn.getAttribute('data-z3d-inspect');
      var cat = inspectBtn.getAttribute('data-z3d-cat') || '';
      var title = inspectBtn.getAttribute('data-z3d-title') || '';
      api.inspectItem(itemId, { category: cat, title: title });
      if (window.ZoneGameKit && typeof window.ZoneGameKit.recordEvent === 'function') {
        window.ZoneGameKit.recordEvent('inspect_3d', { itemId: itemId, category: cat });
      }
      return;
    }

    // Sync [data-outfit] & Home Character outfit switcher clicks to `character-turntable`
    var outfitBtn = target.closest('[data-outfit]') || target.closest('.zone-home-character .zone-panel-heading button');
    if (outfitBtn) {
      var idx = 0;
      if (outfitBtn.parentElement) {
        var sibs = outfitBtn.parentElement.querySelectorAll('button');
        for (var s = 0; s < sibs.length; s++) {
          if (sibs[s] === outfitBtn) { idx = s; break; }
        }
      }
      currentCharOutfit = parseOutfitKeyword(outfitBtn.getAttribute('data-outfit') || outfitBtn.textContent, idx);
      var charStage = document.querySelector('[data-z3d-stage="character-turntable"]');
      if (charStage) charStage.setAttribute('data-z3d-outfit', currentCharOutfit);
      api.updateStageState('character-turntable', { outfit: currentCharOutfit });
      api.triggerStageAction('character-turntable', 'outfit', { outfit: currentCharOutfit });
      armChar3DWatchdog();
      return;
    }

    var gymStation = target.closest('.zone-gym-station[data-gym-station]');
    if (gymStation) {
      var stId = gymStation.getAttribute('data-gym-station') || 'str';
      api.updateStageState('gym-ironpit', { activeStation: stId });
      api.triggerStageAction('gym-ironpit', stId, { stat: stId });
      return;
    }

    var gymTrain = target.closest('.zone-gym-train[data-gym-train]');
    if (gymTrain && !gymTrain.disabled) {
      var trId = gymTrain.getAttribute('data-gym-train') || 'str';
      api.triggerStageAction('gym-ironpit', 'train', { stat: trId });
    }
  }, true);

  window.addEventListener('zone:3d-stage-click', function (ev) {
    var d = ev && ev.detail;
    if (!d || d.stage !== 'gym-ironpit' || !d.stationId) return;
    var btn = document.querySelector('.zone-gym-station[data-gym-station="' + d.stationId + '"]');
    if (btn && typeof btn.click === 'function') {
      btn.click();
    }
  });

  window.addEventListener('message', function (ev) {
    if (!ev || !ev.data) return;
    if (ev.data.zoneCharacterRecover || ev.data.zoneCharacterReady) {
      evaluateChar3DFallback(true);
    }
  });

  function startObserver() {
    if (!document.body) return;
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes' || (r.addedNodes && r.addedNodes.length > 0)) {
          scheduleDebouncedScan();
          return;
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-zone-screen',
        'data-z3d-item',
        'data-z3d-stage',
        'data-z3d-submode',
        'data-z3d-companion',
        'data-z3d-era',
        'data-z3d-origin',
        'data-z3d-origin-chosen',
        'data-z3d-outfit',
        'data-theme',
        'dir',
        'lang',
      ],
    });
    scheduleDebouncedScan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  // Import articulated rigged operative & 3D architectural stage environments FIRST
  // so globalThis.__ZoneRiggedOperative and globalThis.__Zone3DEnvironments are live before stages build!
  function loadRiggedOperativeModule() {
    return import('./zone-3d-rigged-operative.mjs?v=164')
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=163');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=161');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=160');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=158');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=157');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=156');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs?v=155');
      })
      .catch(function () {
        return import('./zone-3d-rigged-operative.mjs');
      })
      .then(function (rigMod) {
        if (rigMod && typeof rigMod.createRiggedOperative3D === 'function' && !globalThis.__ZoneRiggedOperative) {
          globalThis.__ZoneRiggedOperative = {
            createRiggedOperative3D: rigMod.createRiggedOperative3D,
          };
        }
        return rigMod;
      })
      .catch(function () {
        return null;
      });
  }

  function loadEnvironmentsModule() {
    return import('./zone-3d-environments.mjs?v=164')
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=163');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=161');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=160');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=158');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=157');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs?v=156');
      })
      .catch(function () {
        return import('./zone-3d-environments.mjs');
      })
      .then(function (envMod) {
        if (envMod && typeof envMod.dressStageEnvironment3D === 'function' && !globalThis.__Zone3DEnvironments) {
          globalThis.__Zone3DEnvironments = {
            dressStageEnvironment3D: envMod.dressStageEnvironment3D,
          };
        }
        return envMod;
      })
      .catch(function () {
        return null;
      });
  }

  function loadEngineModule() {
    return import('./zone-ecs-3d-engine.mjs?v=164')
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=163');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=161');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=160');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=158');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=157');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=156');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=155');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=154');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=153');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs?v=152');
      })
      .catch(function () {
        return import('./zone-ecs-3d-engine.mjs');
      });
  }

  Promise.all([loadRiggedOperativeModule(), loadEnvironmentsModule()])
    .then(function () {
      return loadEngineModule();
    })
    .then(function (mod) {
      if (!mod || typeof mod.createZoneEcs3DRuntime !== 'function') return;
      runtime = mod.createZoneEcs3DRuntime();
      var queued = pendingCalls.splice(0, pendingCalls.length);
      for (var i = 0; i < queued.length; i++) {
        var item = queued[i];
        if (typeof runtime[item.method] === 'function') {
          try {
            runtime[item.method].apply(runtime, item.args);
          } catch (_) { /* ignore */ }
        }
      }
      performScan(document);
      runtime.startLoop();
      for (var r = 0; r < readyResolvers.length; r++) {
        try { readyResolvers[r](runtime); } catch (_) { /* ignore */ }
      }
      readyResolvers.length = 0;
      window.dispatchEvent(new CustomEvent('zone:ecs-3d-ready', { detail: runtime.diagnostics() }));
    })
    .catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[ZoneEcs3D] Engine bootstrap warning:', err && err.message ? err.message : err);
      }
    });
})();

/* ==========================================================================
 * ZONE v152 - SYNCHRONOUS 3D ECS BRIDGE, AUTO-SCANNER & NATIVE UPGRADER
 * Exclusive Ownership: @ecs-3d-engine (assets/ui/zone-ecs-3d-bridge.js)
 * Exposes: window.ZoneEcs3D synchronously (queues calls until ESM engine ready)
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

  function enqueue(method, args) {
    if (runtime && typeof runtime[method] === 'function') {
      return runtime[method].apply(runtime, args);
    }
    pendingCalls.push({ method: method, args: args });
    return false;
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
    if (/كلاشنكوف|\bak\b/.test(hay)) return { id: 'ak', cat: 'weapon' };
    if (/بولباب|bullpup/.test(hay)) return { id: 'bullpup_2', cat: 'weapon' };
    if (/قنّاص|قناص|sniper/.test(hay)) return { id: 'sniper', cat: 'weapon' };
    if (/مقصوصة|sawed/.test(hay)) return { id: 'sawedoff', cat: 'weapon' };
    if (/خرطوش|shotgun/.test(hay)) return { id: 'shotgun', cat: 'weapon' };
    if (/رشاش|smg|submachine/.test(hay)) return { id: 'smg', cat: 'weapon' };
    if (/دوّار|دوار|revolver|magnum/.test(hay)) return { id: 'revolver', cat: 'weapon' };
    if (/مسدس|pistol/.test(hay)) return { id: 'pistol', cat: 'weapon' };
    if (/بندقية|rifle/.test(hay)) return { id: 'assaultrifle_1', cat: 'weapon' };
    if (/سكين|شفرة|knife|blade|dagger/.test(hay)) return { id: 'knife', cat: 'melee' };
    if (/كاتانا|سيف|katana|sword/.test(hay)) return { id: 'katana', cat: 'melee' };
    if (/مضرب|هراوة|bat|club/.test(hay)) return { id: 'bat', cat: 'melee' };
    if (/خوذة|helmet/.test(hay)) return { id: 'helmet', cat: 'armor' };
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
    if (/حلوى|candy|choc/.test(hay)) return { id: 'candy', cat: 'booster' };
    if (/طاقة|معزز|energy|drink|can|booster/.test(hay)) return { id: 'edrink', cat: 'booster' };
    if (/ذهب|سبيكة|gold|bullion/.test(hay)) return { id: 'gold_bullion', cat: 'contraband' };
    if (/زهرة|أوركيد|flower|orchid/.test(hay)) return { id: 'orchid', cat: 'contraband' };
    if (/دمية|تميمة|plush/.test(hay)) return { id: 'plushie', cat: 'contraband' };
    if (/سيارة|car|racer/.test(hay)) return { id: 'sports_car', cat: 'vehicle' };
    return { id: 'weapon_cache', cat: 'cache' };
  }

  function upgradeNativeScreens(rootEl) {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var screen = main.getAttribute('data-zone-screen') || '';
    var isAr = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';

    // 1. Auto-upgrade native Items screen rows & inspector (100% Fiber-safe append-only)
    if (screen === 'items') {
      var rows = main.querySelectorAll('.zone-inventory-row[data-zrow="1"]');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.querySelector('[data-z3d-item]') && !row.querySelector('.z3d-native-row-addon')) continue;
        var img = row.querySelector('.zone-item-thumbnail img');
        var thumbSrc = img ? (img.getAttribute('src') || '') : '';
        var spans = row.querySelectorAll('button span span');
        var nameText = spans[0] ? spans[0].textContent.trim() : row.textContent.trim();
        var metaText = spans[1] ? spans[1].textContent.trim() : '';
        var spec = inferNativeItemSpec(nameText, metaText, thumbSrc);

        var addon = row.querySelector('.z3d-native-row-addon');
        if (!addon) {
          addon = document.createElement('div');
          addon.className = 'z3d-native-row-addon';
          var slot = document.createElement('div');
          slot.className = 'z3d-item-slot z3d-item-slot--compact';
          slot.setAttribute('data-z3d-item', spec.id);
          slot.setAttribute('data-z3d-cat', spec.cat);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'z3d-inspect-btn';
          btn.setAttribute('data-z3d-inspect', spec.id);
          btn.setAttribute('data-z3d-cat', spec.cat);
          btn.setAttribute('data-z3d-title', nameText);
          btn.textContent = '3D';
          addon.appendChild(slot);
          addon.appendChild(btn);
          row.appendChild(addon);
        } else {
          var existingSlot = addon.querySelector('.z3d-item-slot');
          var existingBtn = addon.querySelector('.z3d-inspect-btn');
          if (existingSlot && existingSlot.getAttribute('data-z3d-item') !== spec.id) {
            existingSlot.setAttribute('data-z3d-item', spec.id);
            existingSlot.setAttribute('data-z3d-cat', spec.cat);
          }
          if (existingBtn) {
            existingBtn.setAttribute('data-z3d-inspect', spec.id);
            existingBtn.setAttribute('data-z3d-cat', spec.cat);
            existingBtn.setAttribute('data-z3d-title', nameText);
          }
        }
      }

      // Also upgrade native right-hand .zone-item-inspector if item lacks iframe #zone-item-3d
      var inspector = main.querySelector('.zone-item-inspector');
      if (inspector && !inspector.querySelector('#zone-item-3d')) {
        var headSpans = inspector.querySelectorAll('.zone-panel-heading span');
        var selTitle = headSpans[0] ? headSpans[0].textContent.trim() : '';
        var selType = headSpans[headSpans.length - 1] ? headSpans[headSpans.length - 1].textContent.trim() : '';
        var selSpec = inferNativeItemSpec(selTitle, selType, '');
        var inspAddon = inspector.querySelector('.z3d-native-inspector-addon');
        if (!inspAddon) {
          inspAddon = document.createElement('div');
          inspAddon.className = 'z3d-native-inspector-addon';
          var iSlot = document.createElement('div');
          iSlot.className = 'z3d-item-slot';
          iSlot.setAttribute('data-z3d-item', selSpec.id);
          iSlot.setAttribute('data-z3d-cat', selSpec.cat);
          var iBtn = document.createElement('button');
          iBtn.type = 'button';
          iBtn.className = 'z3d-inspect-btn';
          iBtn.setAttribute('data-z3d-inspect', selSpec.id);
          iBtn.setAttribute('data-z3d-cat', selSpec.cat);
          iBtn.setAttribute('data-z3d-title', selTitle);
          iBtn.textContent = isAr ? 'معاينة ٣D كاملة' : '3D Orbit Inspect';
          inspAddon.appendChild(iSlot);
          inspAddon.appendChild(iBtn);
          inspector.appendChild(inspAddon);
        } else {
          var sEl = inspAddon.querySelector('.z3d-item-slot');
          var bEl = inspAddon.querySelector('.z3d-inspect-btn');
          if (sEl && sEl.getAttribute('data-z3d-item') !== selSpec.id) {
            sEl.setAttribute('data-z3d-item', selSpec.id);
            sEl.setAttribute('data-z3d-cat', selSpec.cat);
          }
          if (bEl) {
            bEl.setAttribute('data-z3d-inspect', selSpec.id);
            bEl.setAttribute('data-z3d-title', selTitle);
            bEl.textContent = isAr ? 'معاينة ٣D كاملة' : '3D Orbit Inspect';
          }
        }
      }
    }

    // 2. Auto-mount interactive 3D Gym Ironpit stage on Gym screen (Fiber-safe append inside .zone-gym-floor)
    if (screen === 'gym') {
      var gymFloor = main.querySelector('.zone-gym-floor');
      if (gymFloor && !main.querySelector('[data-z3d-stage="gym-ironpit"]')) {
        var gymHost = document.createElement('div');
        gymHost.className = 'z3d-gym-stage-wrap';
        var stageDiv = document.createElement('div');
        stageDiv.className = 'z3d-action-stage z3d-gym-stage';
        stageDiv.setAttribute('data-z3d-stage', 'gym-ironpit');
        gymHost.appendChild(stageDiv);
        gymFloor.appendChild(gymHost);
      }
    }

    // Refresh bilingual stage HUD labels when dir/lang flips
    var scope = rootEl || document;
    if (scope.querySelectorAll) {
      var chips = scope.querySelectorAll('.z3d-stage-chip');
      for (var c = 0; c < chips.length; c++) {
        chips[c].textContent = isAr ? '٣D تفاعلي · اسحب للدوران' : '3D LIVE · DRAG TO ORBIT';
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

  // Global synchronous API contract
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

  // Delegated click handlers for [data-z3d-inspect] and Gym stations/train buttons
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

  // Sync 3D Gym Ironpit rig clicks back to native Gym station selector buttons
  window.addEventListener('zone:3d-stage-click', function (ev) {
    var d = ev && ev.detail;
    if (!d || d.stage !== 'gym-ironpit' || !d.stationId) return;
    var btn = document.querySelector('.zone-gym-station[data-gym-station="' + d.stationId + '"]');
    if (btn && typeof btn.click === 'function') {
      btn.click();
    }
  });

  function startObserver() {
    if (!document.body) return;
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes') {
          scheduleDebouncedScan();
          return;
        }
        if (r.addedNodes && r.addedNodes.length > 0) {
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
        'data-z3d-era',
        'data-z3d-origin',
        'data-z3d-origin-chosen',
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

  // Boot ES Module Engine
  import('./zone-ecs-3d-engine.mjs?v=152')
    .catch(function () {
      return import('./zone-ecs-3d-engine.mjs');
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

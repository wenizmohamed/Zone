/* ZONE v125 - Tactical HUD Telemetry, Micro-Interactions & Procedural Game Feel Engine */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneAaaGameFxLoaded) return;
  window.__zoneAaaGameFxLoaded = true;

  var STYLE_ID = 'zone-aaa-game-fx-styles';
  var LAYER_ID = 'zone-fx-layer';
  var MAX_FX_NODES = 28;

  var RESOURCE_META = {
    energy: { en: 'ENERGY', ar: 'طاقة', icon: '⚡', posColor: '#6ee7b7', negColor: '#a3e635', glow: 'rgba(132, 204, 22, 0.42)' },
    nerve:  { en: 'NERVE',  ar: 'جرأة', icon: '🔥', posColor: '#fcd34d', negColor: '#fbbf24', glow: 'rgba(245, 158, 11, 0.44)' },
    happy:  { en: 'HAPPY',  ar: 'معنويات', icon: '✦', posColor: '#a5b4fc', negColor: '#818cf8', glow: 'rgba(129, 140, 248, 0.42)' },
    life:   { en: 'LIFE',   ar: 'صحة',  icon: '♥', posColor: '#4ade80', negColor: '#fb7185', glow: 'rgba(244, 63, 94, 0.45)' }
  };

  var STAT_META = {
    str: { en: 'STR', ar: 'قوة' },
    def: { en: 'DEF', ar: 'دفاع' },
    spd: { en: 'SPD', ar: 'سرعة' },
    dex: { en: 'DEX', ar: 'مراوغة' }
  };

  var state = {
    bootAt: Date.now(),
    hydrated: false,
    hydrationArmedAt: 0,
    hydrationTimer: null,
    lastPlayerId: null,
    baseline: null,
    lastScreen: null,
    lastActionAnchor: { x: 0, y: 0, at: 0, el: null },
    lastUserGestureAt: 0,
    gestureUnlocked: false,
    audioCtx: null,
    masterFilter: null,
    lastHoverAt: 0,
    lastHoverEl: null,
    lastClickSfxAt: 0,
    lastPointerDownPulseAt: 0,
    screenAnim: null,
    mainEl: null,
    mainAttrObserver: null,
    hudObserver: null,
    rootObserver: null,
    syncPending: false
  };

  /* ---------------- Locale, Theme & Motion Helpers ---------------- */
  function isAr() {
    try {
      var html = document.documentElement;
      if (!html) return false;
      var lang = (html.getAttribute('lang') || '').toLowerCase();
      var dir = (html.getAttribute('dir') || '').toLowerCase();
      return lang.indexOf('ar') === 0 || dir === 'rtl';
    } catch (_) {
      return false;
    }
  }

  function isLightTheme() {
    try {
      return document.documentElement && document.documentElement.getAttribute('data-theme') === 'light';
    } catch (_) {
      return false;
    }
  }

  function prefersReducedMotion() {
    try {
      return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
      return false;
    }
  }

  function normalizeDigits(raw) {
    return String(raw || '').replace(/[٠-٩]/g, function (d) {
      return String(d.charCodeAt(0) - 1632);
    }).replace(/[۰-۹]/g, function (d) {
      return String(d.charCodeAt(0) - 1776);
    });
  }

  function parseNumericText(raw) {
    if (raw === null || raw === undefined) return NaN;
    var s = normalizeDigits(raw).replace(/,/g, '').replace(/\u066C/g, '');
    var m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function formatInt(n) {
    return Math.round(Math.abs(n)).toLocaleString('en-US');
  }

  /* ---------------- Mute State & Persistence ---------------- */
  function isMuted() {
    try {
      if (window.__zoneMuted === true) return true;
      if (localStorage.getItem('zig_muted') === '1') return true;
      if (localStorage.getItem('zone_sfx_muted') === '1') return true;
    } catch (_) {}
    return false;
  }

  function setMuted(muted) {
    var flag = Boolean(muted);
    window.__zoneMuted = flag;
    try {
      localStorage.setItem('zig_muted', flag ? '1' : '0');
    } catch (_) {}
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('zone:mute-change', { detail: { muted: flag } }));
      }
    } catch (_) {}
  }

  /* ---------------- Scoped Styles & Non-Blocking FX Layer ---------------- */
  function ensureStyles() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent =
        '#' + LAYER_ID + '{' +
          'position:fixed;inset:0;' +
          'pointer-events:none !important;z-index:9992;overflow:hidden;' +
          'contain:layout style paint;user-select:none;-webkit-user-select:none;' +
        '}' +
        '#' + LAYER_ID + ' *{pointer-events:none !important;box-sizing:border-box;}' +
        '.zfx-delta-chip{' +
          'position:fixed;left:0;top:0;z-index:9995;' +
          'display:inline-flex;align-items:center;gap:5px;' +
          'padding:4px 9px;border-radius:4px;' +
          'font:800 12.5px/1.2 "Rubik","Noto Sans Arabic",system-ui,sans-serif;' +
          'font-variant-numeric:tabular-nums;white-space:nowrap;' +
          'letter-spacing:0.03em;' +
          'background:linear-gradient(180deg,rgba(14,21,35,0.95) 0%,rgba(7,11,19,0.97) 100%);' +
          'border:1px solid var(--zfx-border,rgba(235,184,88,0.55));' +
          'color:var(--zfx-fg,#49f0a1);' +
          'box-shadow:0 8px 20px rgba(0,0,0,0.58),0 0 14px var(--zfx-glow,rgba(73,240,161,0.22)),inset 0 1px 0 rgba(255,255,255,0.09);' +
          'transform:translate3d(-50%,0,0);will-change:transform,opacity;' +
          'animation:zfxDeltaFloat 1120ms cubic-bezier(0.16,1,0.3,1) var(--zfx-delay,0ms) both;' +
        '}' +
        'html[dir="rtl"] .zfx-delta-chip{letter-spacing:0 !important;}' +
        'html[data-theme="light"] .zfx-delta-chip{' +
          'background:linear-gradient(180deg,rgba(19,27,42,0.96) 0%,rgba(11,17,28,0.98) 100%);' +
          'box-shadow:0 8px 18px rgba(15,23,42,0.26),0 0 0 1px rgba(255,255,255,0.22),inset 0 1px 0 rgba(255,255,255,0.14);' +
        '}' +
        '.zfx-delta-chip.is-levelup{' +
          'padding:6px 13px;font-size:14px;border-width:1.5px;' +
          'background:linear-gradient(180deg,rgba(44,31,10,0.97) 0%,rgba(18,13,6,0.98) 100%);' +
        '}' +
        '.zfx-delta-icon{font-size:11.5px;line-height:1;opacity:0.95;}' +
        '.zfx-delta-num{unicode-bidi:isolate;direction:ltr;display:inline-block;}' +
        '.zfx-click-pulse{' +
          'position:fixed;overflow:hidden;border-radius:4px;z-index:9993;' +
          'border:1px solid var(--zfx-rim,rgba(235,184,88,0.62));' +
          'animation:zfxButtonRim 320ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-click-pulse::after{' +
          'content:"";position:absolute;' +
          'left:var(--zfx-rx,50%);top:var(--zfx-ry,50%);' +
          'width:14px;height:14px;border-radius:50%;' +
          'background:radial-gradient(circle,var(--zfx-spot,rgba(255,255,255,0.52)) 0%,var(--zfx-spot2,rgba(235,184,88,0.24)) 48%,transparent 72%);' +
          'transform:translate(-50%,-50%) scale(0.35);' +
          'animation:zfxSpecularWave 340ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-bar-halo{' +
          'position:fixed;border-radius:4px;z-index:9993;' +
          'border:1px solid var(--zfx-halo,rgba(73,240,161,0.65));' +
          'box-shadow:0 0 14px var(--zfx-halo,rgba(73,240,161,0.45)),inset 0 0 8px var(--zfx-halo,rgba(73,240,161,0.25));' +
          'animation:zfxBarHalo 520ms cubic-bezier(0.16,1,0.3,1) forwards;' +
        '}' +
        '.zfx-screen-sweep{' +
          'position:fixed;height:2px;z-index:9994;border-radius:2px;' +
          'background:linear-gradient(90deg,transparent 0%,#39e7a3 35%,#ebb858 70%,transparent 100%);' +
          'box-shadow:0 0 12px rgba(235,184,88,0.55);' +
          'transform-origin:left center;' +
          'animation:zfxSweepLine 200ms cubic-bezier(0.22,1,0.36,1) forwards;' +
        '}' +
        'html[dir="rtl"] .zfx-screen-sweep{transform-origin:right center;}' +
        'html[data-theme="light"] .zfx-screen-sweep{' +
          'background:linear-gradient(90deg,transparent 0%,#0d7a49 35%,#b4781e 70%,transparent 100%);' +
          'box-shadow:0 0 8px rgba(180,120,30,0.35);' +
        '}' +
        '#zone-main.zfx-screen-entering{' +
          'animation:zfxScreenReveal 180ms cubic-bezier(0.22,1,0.36,1) none;' +
        '}' +
        '@keyframes zfxDeltaFloat{' +
          '0%{opacity:0;transform:translate3d(-50%,8px,0) scale(0.84);}' +
          '16%{opacity:1;transform:translate3d(-50%,-4px,0) scale(1.04);}' +
          '72%{opacity:1;transform:translate3d(-50%,-32px,0) scale(1);}' +
          '100%{opacity:0;transform:translate3d(-50%,-48px,0) scale(0.96);}' +
        '}' +
        '@keyframes zfxButtonRim{' +
          '0%{opacity:0.95;}' +
          '100%{opacity:0;}' +
        '}' +
        '@keyframes zfxSpecularWave{' +
          '0%{opacity:0.92;transform:translate(-50%,-50%) scale(0.35);}' +
          '100%{opacity:0;transform:translate(-50%,-50%) scale(15);}' +
        '}' +
        '@keyframes zfxBarHalo{' +
          '0%{opacity:0.95;transform:scale(0.99);}' +
          '100%{opacity:0;transform:scale(1.03);}' +
        '}' +
        '@keyframes zfxSweepLine{' +
          '0%{opacity:0.95;transform:scaleX(0.08);}' +
          '70%{opacity:0.9;transform:scaleX(1);}' +
          '100%{opacity:0;transform:scaleX(1);}' +
        '}' +
        '@keyframes zfxScreenReveal{' +
          '0%{opacity:0.74;transform:translate3d(0,4px,0);}' +
          '100%{opacity:1;transform:translate3d(0,0,0);}' +
        '}' +
        '@media (prefers-reduced-motion: reduce){' +
          '.zfx-delta-chip{animation-duration:450ms !important;}' +
          '#zone-main.zfx-screen-entering{animation:none !important;}' +
        '}';
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  }

  function ensureLayer() {
    try {
      ensureStyles();
      var existing = document.getElementById(LAYER_ID);
      if (existing) return existing;
      if (!document.body) return null;
      var layer = document.createElement('div');
      layer.id = LAYER_ID;
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
      return layer;
    } catch (_) {
      return null;
    }
  }

  function appendFxNode(node, ttlMs) {
    var layer = ensureLayer();
    if (!layer || !node) return;
    try {
      while (layer.childNodes.length >= MAX_FX_NODES && layer.firstChild) {
        layer.removeChild(layer.firstChild);
      }
      layer.appendChild(node);
      var removed = false;
      var cleanup = function () {
        if (removed) return;
        removed = true;
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (_) {}
      };
      node.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, ttlMs || 1300);
    } catch (_) {}
  }

  /* ---------------- WebAudio Procedural Tactical Synth ---------------- */
  function getAudioContext() {
    if (!state.gestureUnlocked || isMuted()) return null;
    try {
      if (!state.audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        state.audioCtx = new Ctx();
        if (typeof state.audioCtx.createBiquadFilter === 'function') {
          state.masterFilter = state.audioCtx.createBiquadFilter();
          state.masterFilter.type = 'lowpass';
          state.masterFilter.frequency.value = 3400;
          state.masterFilter.Q.value = 0.7;
          state.masterFilter.connect(state.audioCtx.destination);
        }
      }
      if (state.audioCtx.state === 'suspended') {
        var p = state.audioCtx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
      return state.audioCtx;
    } catch (_) {
      return null;
    }
  }

  function synthVoice(type, fStart, fEnd, durSec, peakGain, delaySec) {
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (delaySec || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(24, fStart), t0);
      if (fEnd && fEnd !== fStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(24, fEnd), t0 + durSec);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), t0 + Math.min(0.008, durSec * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec + 0.012);
      osc.connect(gain);
      gain.connect(state.masterFilter || ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durSec + 0.018);
    } catch (_) {}
  }

  function playCue(kind) {
    if (!state.gestureUnlocked || isMuted()) return;
    try {
      if (kind === 'hover') {
        synthVoice('sine', 1520, 960, 0.016, 0.012, 0);
      } else if (kind === 'primary' || kind === 'crime') {
        synthVoice('triangle', 225, 88, 0.044, 0.038, 0);
        synthVoice('sine', 1360, 720, 0.028, 0.024, 0.006);
      } else if (kind === 'gym') {
        synthVoice('sine', 148, 58, 0.052, 0.044, 0);
        synthVoice('triangle', 520, 860, 0.034, 0.022, 0.01);
      } else if (kind === 'nav') {
        synthVoice('sine', 420, 670, 0.028, 0.022, 0);
      } else if (kind === 'cash') {
        synthVoice('triangle', 987.77, 1318.51, 0.075, 0.042, 0);
        synthVoice('sine', 1318.51, 1975.53, 0.135, 0.036, 0.055);
      } else if (kind === 'xp') {
        synthVoice('sine', 783.99, 1174.66, 0.07, 0.024, 0);
      } else if (kind === 'levelup') {
        synthVoice('triangle', 523.25, 659.25, 0.09, 0.045, 0);
        synthVoice('triangle', 659.25, 783.99, 0.10, 0.045, 0.075);
        synthVoice('sine', 1046.50, 1567.98, 0.20, 0.05, 0.15);
      } else {
        synthVoice('triangle', 700, 470, 0.022, 0.018, 0);
      }
    } catch (_) {}
  }

  function classifyButtonCue(btn) {
    if (!btn || !(btn instanceof Element)) return 'click';
    if (
      btn.classList.contains('zone-action-primary') ||
      btn.classList.contains('zone-action-danger') ||
      btn.classList.contains('zig-btn') ||
      btn.hasAttribute('data-crime-attempt') ||
      btn.hasAttribute('data-crime-select') ||
      btn.hasAttribute('data-zig-launch')
    ) {
      return 'primary';
    }
    if (
      btn.hasAttribute('data-gym-train') ||
      btn.classList.contains('zone-gym-train') ||
      btn.classList.contains('zone-gym-station')
    ) {
      return 'gym';
    }
    if (
      btn.hasAttribute('data-zone-screen') ||
      btn.classList.contains('zone-header-link') ||
      btn.hasAttribute('data-crime-category') ||
      btn.classList.contains('zig-city-chip') ||
      btn.closest('[data-znav], [data-ztabs], .zone-header-links, #zone-topbar-hud')
    ) {
      return 'nav';
    }
    return 'click';
  }

  /* ---------------- Specular Click Pulse (#zone-main button) ---------------- */
  function spawnButtonSpecularPulse(btn, clientX, clientY) {
    if (!btn || prefersReducedMotion()) return;
    try {
      var rect = btn.getBoundingClientRect();
      if (!rect || rect.width < 12 || rect.height < 12 || rect.width > 960) return;

      var pulse = document.createElement('div');
      pulse.className = 'zfx-click-pulse';
      pulse.style.left = Math.round(rect.left) + 'px';
      pulse.style.top = Math.round(rect.top) + 'px';
      pulse.style.width = Math.round(rect.width) + 'px';
      pulse.style.height = Math.round(rect.height) + 'px';

      var rx = clientX > 0 ? Math.max(4, Math.min(rect.width - 4, clientX - rect.left)) : rect.width * 0.5;
      var ry = clientY > 0 ? Math.max(4, Math.min(rect.height - 4, clientY - rect.top)) : rect.height * 0.5;
      pulse.style.setProperty('--zfx-rx', Math.round(rx) + 'px');
      pulse.style.setProperty('--zfx-ry', Math.round(ry) + 'px');

      var isDanger = btn.classList.contains('zone-action-danger');
      var isPrimary = btn.classList.contains('zone-action-primary') || btn.classList.contains('zig-btn');
      var light = isLightTheme();

      if (isDanger) {
        pulse.style.setProperty('--zfx-rim', 'rgba(248, 113, 113, 0.78)');
        pulse.style.setProperty('--zfx-spot', 'rgba(254, 202, 202, 0.52)');
        pulse.style.setProperty('--zfx-spot2', 'rgba(239, 68, 68, 0.25)');
      } else if (isPrimary) {
        pulse.style.setProperty('--zfx-rim', light ? 'rgba(13, 122, 73, 0.72)' : 'rgba(73, 240, 161, 0.78)');
        pulse.style.setProperty('--zfx-spot', light ? 'rgba(255, 255, 255, 0.65)' : 'rgba(209, 250, 229, 0.5)');
        pulse.style.setProperty('--zfx-spot2', light ? 'rgba(180, 120, 30, 0.24)' : 'rgba(57, 231, 163, 0.26)');
      } else {
        pulse.style.setProperty('--zfx-rim', light ? 'rgba(180, 120, 30, 0.62)' : 'rgba(235, 184, 88, 0.62)');
        pulse.style.setProperty('--zfx-spot', light ? 'rgba(180, 120, 30, 0.30)' : 'rgba(255, 255, 255, 0.38)');
        pulse.style.setProperty('--zfx-spot2', 'rgba(235, 184, 88, 0.18)');
      }

      appendFxNode(pulse, 380);
    } catch (_) {}
  }

  function spawnBarHalo(targetEl, glowColor) {
    if (!targetEl || prefersReducedMotion()) return;
    try {
      var rect = targetEl.getBoundingClientRect();
      if (!rect || rect.width < 10 || rect.height < 6 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      var halo = document.createElement('div');
      halo.className = 'zfx-bar-halo';
      halo.style.left = Math.round(rect.left - 2) + 'px';
      halo.style.top = Math.round(rect.top - 2) + 'px';
      halo.style.width = Math.round(rect.width + 4) + 'px';
      halo.style.height = Math.round(rect.height + 4) + 'px';
      if (glowColor) halo.style.setProperty('--zfx-halo', glowColor);
      appendFxNode(halo, 560);
    } catch (_) {}
  }

  /* ---------------- Floating RPG Stat Delta Chips ---------------- */
  function resolveAnchorPoint(preferredEl, stackIndex) {
    var vw = Math.max(320, window.innerWidth || 1280);
    var vh = Math.max(320, window.innerHeight || 800);
    var now = performance.now();
    var x = vw * 0.5;
    var y = 110;

    if (state.lastActionAnchor.at > 0 && (now - state.lastActionAnchor.at) < 2800 && state.lastActionAnchor.x > 0) {
      x = state.lastActionAnchor.x;
      y = state.lastActionAnchor.y - 14;
    } else {
      var placed = false;
      if (preferredEl) {
        try {
          var r = preferredEl.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0 && r.bottom > 8 && r.top < vh - 8) {
            x = r.left + r.width * 0.5;
            y = Math.max(52, r.top - 4);
            placed = true;
          }
        } catch (_) {}
      }
      if (!placed) {
        try {
          var topHud = document.getElementById('zone-topbar-hud');
          if (topHud) {
            var hr = topHud.getBoundingClientRect();
            if (hr && hr.width > 0 && hr.height > 0) {
              x = hr.left + hr.width * 0.5;
              y = Math.max(52, hr.bottom + 8);
            }
          }
        } catch (_) {}
      }
    }

    var padX = Math.min(84, Math.round(vw * 0.2));
    x = Math.max(padX, Math.min(vw - padX, Math.round(x)));
    y = Math.max(46, Math.min(vh - 64, Math.round(y - (stackIndex || 0) * 28)));
    return { x: x, y: y };
  }

  function spawnDelta(opts) {
    if (!opts || !opts.numText) return;
    try {
      var pt = resolveAnchorPoint(opts.anchorEl || null, opts.stackIndex || 0);
      var chip = document.createElement('div');
      chip.className = 'zfx-delta-chip' + (opts.levelUp ? ' is-levelup' : '');
      chip.style.left = pt.x + 'px';
      chip.style.top = pt.y + 'px';
      if (opts.fg) chip.style.setProperty('--zfx-fg', opts.fg);
      if (opts.border) chip.style.setProperty('--zfx-border', opts.border);
      if (opts.glow) chip.style.setProperty('--zfx-glow', opts.glow);
      if (opts.delayMs) chip.style.setProperty('--zfx-delay', opts.delayMs + 'ms');

      if (opts.icon) {
        var ic = document.createElement('span');
        ic.className = 'zfx-delta-icon';
        ic.textContent = opts.icon;
        chip.appendChild(ic);
      }

      var numSpan = document.createElement('bdi');
      numSpan.className = 'zfx-delta-num';
      numSpan.textContent = opts.numText;
      chip.appendChild(numSpan);

      if (opts.label) {
        var lbl = document.createElement('span');
        lbl.textContent = opts.label;
        chip.appendChild(lbl);
      }

      appendFxNode(chip, 1280 + (opts.delayMs || 0));
    } catch (_) {}
  }

  /* ---------------- Snapshot Extraction & Delta Telemetry ---------------- */
  function readResourceValue(key, g) {
    try {
      var resEl = document.querySelector('.zone-resource[data-zone-resource="' + key + '"]');
      if (resEl) {
        var bar = resEl.querySelector('[role="progressbar"][aria-valuenow]');
        if (bar) {
          var vAttr = Number(bar.getAttribute('aria-valuenow'));
          if (Number.isFinite(vAttr)) return { val: vAttr, el: bar };
        }
        var fig = resEl.querySelector('[data-zfig]');
        if (fig) {
          var vFig = parseNumericText(fig.textContent);
          if (Number.isFinite(vFig)) return { val: vFig, el: resEl };
        }
      }
      if (g && typeof g.cur === 'function') {
        var vCur = Number(g.cur(key));
        if (Number.isFinite(vCur)) return { val: vCur, el: resEl || null };
      }
    } catch (_) {}
    return { val: NaN, el: null };
  }

  function captureSnapshot() {
    var g = window.__zoneGame || null;
    var p = (g && g.p) || null;
    var cashEl = document.getElementById('zone-cash');
    var domCash = cashEl ? parseNumericText(cashEl.textContent) : NaN;
    var cashVal = (p && Number.isFinite(Number(p.cash))) ? Number(p.cash) : domCash;

    var energy = readResourceValue('energy', g);
    var nerve = readResourceValue('nerve', g);
    var happy = readResourceValue('happy', g);
    var life = readResourceValue('life', g);

    var totalXp = p
      ? (Number(p.xp || 0) + Number(p.localXp || 0) + Number(p.crimeXp || 0) + Number(p.gymXp || 0))
      : NaN;
    var level = p && Number.isFinite(Number(p.level)) ? Number(p.level) : NaN;
    var stats = p && p.stats ? {
      str: Number(p.stats.str || 0),
      def: Number(p.stats.def || 0),
      spd: Number(p.stats.spd || 0),
      dex: Number(p.stats.dex || 0)
    } : null;

    return {
      playerId: p ? String(p.playerId || '') : '',
      gameplayReady: Boolean(g && (g.gameplayReady || g.state && g.state.gameplayReady)),
      cash: cashVal,
      cashEl: cashEl,
      bars: {
        energy: energy,
        nerve: nerve,
        happy: happy,
        life: life
      },
      totalXp: totalXp,
      level: level,
      stats: stats
    };
  }

  function evaluateTelemetryDeltas() {
    try {
      var snap = captureSnapshot();
      var now = Date.now();
      var bootElapsed = now - state.bootAt;

      /* Reset baseline on player/session switch so hydration never fakes rewards */
      if (snap.playerId && state.lastPlayerId && snap.playerId !== state.lastPlayerId) {
        state.lastPlayerId = snap.playerId;
        state.baseline = snap;
        state.hydrated = false;
        state.hydrationArmedAt = 0;
        if (state.hydrationTimer) {
          clearTimeout(state.hydrationTimer);
          state.hydrationTimer = null;
        }
        return;
      }
      if (snap.playerId) state.lastPlayerId = snap.playerId;

      /* Wait for authoritative session hydration (or static preview settle) */
      if (!state.hydrated) {
        state.baseline = snap;
        if (snap.gameplayReady || bootElapsed > 2000) {
          if (!state.hydrationArmedAt) {
            state.hydrationArmedAt = now + 260;
            if (!state.hydrationTimer) {
              state.hydrationTimer = setTimeout(function () {
                state.hydrationTimer = null;
                state.baseline = captureSnapshot();
                state.hydrated = true;
              }, 270);
            }
          } else if (now >= state.hydrationArmedAt) {
            if (state.hydrationTimer) {
              clearTimeout(state.hydrationTimer);
              state.hydrationTimer = null;
            }
            state.hydrated = true;
          }
        }
        return;
      }

      var prev = state.baseline;
      state.baseline = snap;
      if (!prev) return;

      var ar = isAr();
      var recentUserAct = (now - state.lastUserGestureAt) < 5500;
      var recentClickAnchor = (performance.now() - state.lastActionAnchor.at) < 2800;
      var queue = [];

      /* 1. Cash Delta (+$1,250 / -$950) */
      if (Number.isFinite(snap.cash) && Number.isFinite(prev.cash) && snap.cash !== prev.cash) {
        var dCash = Math.round(snap.cash - prev.cash);
        if (Math.abs(dCash) >= 1 && Math.abs(dCash) < 500000000) {
          var isGain = dCash > 0;
          if (isGain) playCue('cash');
          var zigPop = !recentClickAnchor && isGain && document.querySelector('.zig-float-pop');
          if (!zigPop) {
            queue.push({
              icon: isGain ? '💰' : '💸',
              numText: (isGain ? '+$' : '-$') + formatInt(dCash),
              label: '',
              fg: isGain ? '#49f0a1' : '#fb7185',
              border: isGain ? 'rgba(73, 240, 161, 0.62)' : 'rgba(251, 113, 133, 0.62)',
              glow: isGain ? 'rgba(73, 240, 161, 0.28)' : 'rgba(244, 63, 94, 0.28)',
              anchorEl: snap.cashEl
            });
          }
          if (snap.cashEl) {
            spawnBarHalo(snap.cashEl, isGain ? 'rgba(73, 240, 161, 0.65)' : 'rgba(251, 113, 133, 0.65)');
          }
        }
      }

      /* 2. Resource Bars (Energy, Nerve, Happy, Life) */
      var keys = ['energy', 'nerve', 'happy', 'life'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var curB = snap.bars[k];
        var prvB = prev.bars[k];
        if (!curB || !prvB || !Number.isFinite(curB.val) || !Number.isFinite(prvB.val)) continue;
        var dBar = Math.round(curB.val - prvB.val);
        if (dBar === 0 || Math.abs(dBar) > 100000) continue;

        /* Filter out silent +1 natural regen ticks while idle so HUD stays deliberate */
        var shouldShowBar = false;
        if (k === 'energy' || k === 'nerve') {
          shouldShowBar = dBar < 0 || dBar >= 2 || (dBar > 0 && recentUserAct);
        } else {
          shouldShowBar = dBar <= -2 || dBar >= 5 || (Math.abs(dBar) >= 2 && recentUserAct);
        }
        if (!shouldShowBar) continue;

        var meta = RESOURCE_META[k];
        var pos = dBar > 0;
        queue.push({
          icon: meta.icon,
          numText: (pos ? '+' : '-') + formatInt(dBar),
          label: ar ? meta.ar : meta.en,
          fg: pos ? meta.posColor : meta.negColor,
          border: meta.glow,
          glow: meta.glow,
          anchorEl: curB.el
        });
        if (curB.el) spawnBarHalo(curB.el, meta.glow);
      }

      /* 3. Gym Battle Stat Gains (+2.45 STR/DEF/SPD/DEX) */
      if (snap.stats && prev.stats && recentUserAct) {
        var sKeys = ['str', 'def', 'spd', 'dex'];
        for (var si = 0; si < sKeys.length; si++) {
          var sk = sKeys[si];
          var dStat = snap.stats[sk] - prev.stats[sk];
          if (Number.isFinite(dStat) && dStat >= 0.05 && dStat < 50000) {
            var sm = STAT_META[sk];
            queue.push({
              icon: '🏋️',
              numText: '+' + (dStat >= 10 ? Math.round(dStat).toLocaleString('en-US') : dStat.toFixed(2)),
              label: ar ? sm.ar : sm.en,
              fg: '#38bdf8',
              border: 'rgba(56, 189, 248, 0.58)',
              glow: 'rgba(56, 189, 248, 0.28)',
              anchorEl: snap.bars.energy.el
            });
          }
        }
      }

      /* 4. Unified XP Delta (+35 XP) */
      if (Number.isFinite(snap.totalXp) && Number.isFinite(prev.totalXp) && snap.totalXp > prev.totalXp) {
        var dXp = Math.round(snap.totalXp - prev.totalXp);
        if (dXp >= 1 && dXp < 1000000) {
          if (queue.length === 0) playCue('xp');
          queue.push({
            icon: '✦',
            numText: '+' + formatInt(dXp),
            label: ar ? 'خبرة' : 'XP',
            fg: '#ebb858',
            border: 'rgba(235, 184, 88, 0.68)',
            glow: 'rgba(235, 184, 88, 0.30)',
            anchorEl: snap.cashEl
          });
        }
      }

      /* 5. Level-Up Milestone */
      if (Number.isFinite(snap.level) && Number.isFinite(prev.level) && snap.level > prev.level && (snap.level - prev.level) <= 20) {
        playCue('levelup');
        queue.push({
          icon: '★',
          numText: String(snap.level),
          label: ar ? 'مستوى جديد!' : 'LEVEL UP!',
          fg: '#fde047',
          border: 'rgba(250, 204, 21, 0.85)',
          glow: 'rgba(250, 204, 21, 0.45)',
          levelUp: true,
          anchorEl: snap.cashEl
        });
      }

      for (var qi = 0; qi < queue.length && qi < 4; qi++) {
        queue[qi].stackIndex = qi;
        queue[qi].delayMs = qi * 55;
        spawnDelta(queue[qi]);
      }
    } catch (_) {}
  }

  function scheduleTelemetryCheck() {
    if (state.syncPending) return;
    state.syncPending = true;
    setTimeout(function () {
      state.syncPending = false;
      evaluateTelemetryDeltas();
    }, 36);
  }

  /* ---------------- Screen Transition Atmosphere (180ms) ---------------- */
  function triggerScreenReveal(mainEl) {
    var el = mainEl || document.getElementById('zone-main');
    if (!el || prefersReducedMotion()) return;
    try {
      var rect = el.getBoundingClientRect();
      if (rect && rect.width > 40 && rect.top >= -40 && rect.top < window.innerHeight) {
        var sweep = document.createElement('div');
        sweep.className = 'zfx-screen-sweep';
        sweep.style.left = Math.round(rect.left) + 'px';
        sweep.style.top = Math.round(Math.max(0, rect.top)) + 'px';
        sweep.style.width = Math.round(rect.width) + 'px';
        appendFxNode(sweep, 240);
      }

      if (state.screenAnim && typeof state.screenAnim.cancel === 'function') {
        try { state.screenAnim.cancel(); } catch (_) {}
        state.screenAnim = null;
      }

      if (typeof el.animate === 'function') {
        state.screenAnim = el.animate(
          [
            { opacity: 0.74, transform: 'translate3d(0, 4px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ],
          {
            duration: 180,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'none'
          }
        );
      } else {
        el.classList.remove('zfx-screen-entering');
        void el.offsetWidth;
        el.classList.add('zfx-screen-entering');
        setTimeout(function () {
          try { el.classList.remove('zfx-screen-entering'); } catch (_) {}
        }, 190);
      }
    } catch (_) {}
  }

  function bindMainScreenObserver() {
    try {
      var main = document.getElementById('zone-main');
      if (!main || main === state.mainEl) return;
      state.mainEl = main;
      state.lastScreen = main.getAttribute('data-zone-screen') || 'home';

      if (state.mainAttrObserver) {
        try { state.mainAttrObserver.disconnect(); } catch (_) {}
      }
      state.mainAttrObserver = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].attributeName === 'data-zone-screen') {
            var next = main.getAttribute('data-zone-screen') || '';
            if (next && state.lastScreen !== null && next !== state.lastScreen) {
              state.lastScreen = next;
              triggerScreenReveal(main);
            } else if (next) {
              state.lastScreen = next;
            }
          }
        }
      });
      state.mainAttrObserver.observe(main, { attributes: true, attributeFilter: ['data-zone-screen'] });
    } catch (_) {}
  }

  function bindHudObserver() {
    try {
      if (state.hudObserver) {
        try { state.hudObserver.disconnect(); } catch (_) {}
      }
      state.hudObserver = new MutationObserver(function () {
        scheduleTelemetryCheck();
      });
      var cashEl = document.getElementById('zone-cash');
      var barsWrap = document.querySelector('.zone-profile-bars');
      if (cashEl && cashEl.parentNode) {
        state.hudObserver.observe(cashEl.parentNode, { childList: true, characterData: true, subtree: true });
      }
      if (barsWrap) {
        state.hudObserver.observe(barsWrap, {
          childList: true,
          characterData: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-valuenow']
        });
      }
    } catch (_) {}
  }

  /* ---------------- Delegated Input Listeners ---------------- */
  function setupInputListeners() {
    try {
      /* 1. Soft Mechanical Hover Tick (mouse only, throttled) */
      document.addEventListener('pointerover', function (ev) {
        try {
          if (!state.gestureUnlocked || isMuted()) return;
          if (ev.pointerType && ev.pointerType !== 'mouse') return;
          var t = ev.target;
          if (!(t instanceof Element)) return;
          var ctrl = t.closest('button:not(:disabled), a.zone-header-link, [role="tab"]');
          if (!ctrl || ctrl === state.lastHoverEl) return;
          state.lastHoverEl = ctrl;
          var now = performance.now();
          if (now - state.lastHoverAt < 68) return;
          state.lastHoverAt = now;
          playCue('hover');
        } catch (_) {}
      }, { passive: true });

      document.addEventListener('pointerout', function (ev) {
        try {
          if (!state.lastHoverEl) return;
          var rel = ev.relatedTarget;
          if (!rel || !(rel instanceof Node) || !state.lastHoverEl.contains(rel)) {
            state.lastHoverEl = null;
          }
        } catch (_) {}
      }, { passive: true });

      /* 2. PointerDown: Unlock WebAudio on trusted gesture + instant tactile specular pulse */
      document.addEventListener('pointerdown', function (ev) {
        try {
          if (ev.isTrusted !== false) {
            state.gestureUnlocked = true;
            state.lastUserGestureAt = Date.now();
          }
          var t = ev.target;
          if (!(t instanceof Element)) return;
          var btn = t.closest('button:not(:disabled), a.zone-header-link');
          if (!btn) return;

          var rect = btn.getBoundingClientRect();
          state.lastActionAnchor = {
            x: ev.clientX > 0 ? ev.clientX : (rect.left + rect.width * 0.5),
            y: rect.top > 0 ? rect.top : ev.clientY,
            at: performance.now(),
            el: btn
          };

          if (btn.tagName === 'BUTTON' && btn.closest('#zone-main')) {
            state.lastPointerDownPulseAt = performance.now();
            spawnButtonSpecularPulse(btn, ev.clientX, ev.clientY);
          }
        } catch (_) {}
      }, { passive: true });

      /* 3. Click: Confirm Audio Cue + Keyboard Click Fallback + Mute Toggle Sync */
      document.addEventListener('click', function (ev) {
        try {
          if (ev.isTrusted !== false) {
            state.gestureUnlocked = true;
            state.lastUserGestureAt = Date.now();
          }
          var t = ev.target;
          if (!(t instanceof Element)) return;

          /* Sync with zone-instant-games.js #zig-sound-toggle button */
          var muteBtn = t.closest('#zig-sound-toggle, [data-zone-mute-toggle]');
          if (muteBtn) {
            setTimeout(function () {
              try {
                var txt = (muteBtn.textContent || '').toUpperCase();
                var mutedNow = txt.indexOf('OFF') >= 0 || txt.indexOf('🔇') >= 0 || txt.indexOf('صامت') >= 0;
                setMuted(mutedNow);
              } catch (_) {}
            }, 0);
            return;
          }

          var btn = t.closest('button:not(:disabled), a.zone-header-link');
          if (!btn) return;

          var now = performance.now();
          var rect = btn.getBoundingClientRect();
          state.lastActionAnchor = {
            x: ev.clientX > 0 ? ev.clientX : (rect.left + rect.width * 0.5),
            y: rect.top > 0 ? rect.top : (rect.bottom || 120),
            at: now,
            el: btn
          };

          /* Keyboard activation (Enter/Space) where pointerdown did not fire */
          if (btn.tagName === 'BUTTON' && btn.closest('#zone-main') && (now - state.lastPointerDownPulseAt) > 260) {
            spawnButtonSpecularPulse(btn, ev.clientX, ev.clientY);
          }

          if (now - state.lastClickSfxAt >= 35) {
            state.lastClickSfxAt = now;
            playCue(classifyButtonCue(btn));
          }
        } catch (_) {}
      }, { passive: true });

      document.addEventListener('keydown', function (ev) {
        if (ev.isTrusted !== false) {
          state.gestureUnlocked = true;
          state.lastUserGestureAt = Date.now();
        }
      }, { passive: true });
    } catch (_) {}
  }

  /* ---------------- Lifecycle & Boot ---------------- */
  function boot() {
    try {
      ensureLayer();
      bindMainScreenObserver();
      bindHudObserver();
      evaluateTelemetryDeltas();

      window.addEventListener('zone:render', function () {
        bindMainScreenObserver();
        scheduleTelemetryCheck();
      });

      if (typeof MutationObserver === 'function' && document.body && !state.rootObserver) {
        var rebindTimer = null;
        state.rootObserver = new MutationObserver(function () {
          if (rebindTimer) return;
          rebindTimer = setTimeout(function () {
            rebindTimer = null;
            if (!document.getElementById(LAYER_ID)) ensureLayer();
            if (!state.mainEl || !state.mainEl.isConnected) bindMainScreenObserver();
          }, 180);
        });
        state.rootObserver.observe(document.body, { childList: true });
      }

      setInterval(function () {
        if (document.hidden) return;
        if (!state.mainEl || !state.mainEl.isConnected) bindMainScreenObserver();
        scheduleTelemetryCheck();
      }, 900);
    } catch (_) {}
  }

  setupInputListeners();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ZoneGameFX = {
    version: '125.0',
    isMuted: isMuted,
    setMuted: setMuted,
    spawnDelta: spawnDelta,
    triggerScreenReveal: triggerScreenReveal,
    playCue: playCue
  };
})();

/* ZONE v127 - 60fps Demand-Driven Arcade Engine, Vibrant Multi-Color MotionSites Icons & Tonal Surfaces */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneInstantGamesLoaded) return;
  window.__zoneInstantGamesLoaded = true;

  var MOTION_STYLE_ID = 'zig-v127-motion-styles';

  var EU_WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var RED_POCKETS = {
    1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1,
    19: 1, 21: 1, 23: 1, 25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1
  };
  var SLOT_SYMS = [
    { id: 'DIAMOND', kind: 'diamond', color: '#38bdf8', labelEn: 'DIAMOND', labelAr: 'ألماس' },
    { id: 'SEVEN', kind: 'seven', color: '#f43f5e', labelEn: 'LUCKY 7', labelAr: 'سبعة' },
    { id: 'CROWN', kind: 'crown', color: '#ebb858', labelEn: 'CROWN', labelAr: 'تاج' },
    { id: 'GOLD_BAR', kind: 'bullion', color: '#fbbf24', labelEn: 'GOLD', labelAr: 'سبيكة' },
    { id: 'CHIP', kind: 'spade', color: '#39e7a3', labelEn: 'SPADE', labelAr: 'سبيد' },
    { id: 'CHERRY', kind: 'ruby', color: '#fb7185', labelEn: 'RUBY', labelAr: 'ياقوت' }
  ];

  /* ---------------- Vibrant Multi-Color 3D Frosted-Glass SVGs (Zero Raw Emojis) ---------------- */
  var SVG_ARCADE_CREST =
    '<svg class="zig-emblem-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-crest" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#a855f7"/>' +
          '<stop offset="52%" stop-color="#22d3ee"/>' +
          '<stop offset="100%" stop-color="#fbbf24"/>' +
        '</linearGradient>' +
        '<linearGradient id="zig-grad-crest-core" x1="8" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#ffffff"/>' +
          '<stop offset="100%" stop-color="#bae6fd"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M12 2.2L20.6 7.1V16.9L12 21.8L3.4 16.9V7.1L12 2.2Z" fill="url(#zig-grad-crest)" fill-opacity="0.96"/>' +
      '<path d="M12 3.4L19.4 7.7V16.3L12 20.6L4.6 16.3V7.7L12 3.4Z" stroke="rgba(255,255,255,0.46)" stroke-width="1.05" stroke-linejoin="round"/>' +
      '<path class="zig-emblem-play" d="M9.7 8.4L16.2 12L9.7 15.6V8.4Z" fill="url(#zig-grad-crest-core)"/>' +
    '</svg>';

  var SVG_SPEAKER_ON =
    '<svg class="zig-inline-svg zig-speaker-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-spk-on" x1="3" y1="5" x2="13" y2="19" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#34d399"/>' +
          '<stop offset="100%" stop-color="#059669"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="url(#zig-grad-spk-on)"/>' +
      '<path d="M6.6 9.2H4.2V14.8H6.6L11 18.1V5.9L6.6 9.2Z" fill="#ffffff" fill-opacity="0.24"/>' +
      '<path class="zig-sound-wave-1" d="M15.4 8.8C16.7 9.9 17.4 11.2 17.4 12C17.4 12.8 16.7 14.1 15.4 15.2" stroke="#34d399" stroke-width="2" stroke-linecap="round"/>' +
      '<path class="zig-sound-wave-2" d="M18.4 6.2C20.4 7.8 21.4 9.8 21.4 12C21.4 14.2 20.4 16.2 18.4 17.8" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_SPEAKER_OFF =
    '<svg class="zig-inline-svg zig-speaker-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-spk-off" x1="3" y1="5" x2="13" y2="19" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fb7185"/>' +
          '<stop offset="100%" stop-color="#e11d48"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M11.2 4.8L6.4 8.7H3.4C2.9 8.7 2.5 9.1 2.5 9.6V14.4C2.5 14.9 2.9 15.3 3.4 15.3H6.4L11.2 19.2C11.8 19.7 12.6 19.2 12.6 18.5V5.5C12.6 4.8 11.8 4.3 11.2 4.8Z" fill="url(#zig-grad-spk-off)" fill-opacity="0.92"/>' +
      '<path d="M15.8 9.4L20.8 14.4M20.8 9.4L15.8 14.4" stroke="#fda4af" stroke-width="2.1" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_CTA_CHEVRON =
    '<svg class="zig-cta-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var SVG_WHEEL_STEER =
    '<svg class="zig-inline-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-steer" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fde047"/>' +
          '<stop offset="100%" stop-color="#f97316"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="12" cy="12" r="9" fill="url(#zig-grad-steer)" fill-opacity="0.95"/>' +
      '<circle cx="12" cy="12" r="6.2" fill="#090d16" fill-opacity="0.72"/>' +
      '<circle cx="12" cy="12" r="2.3" fill="#ffffff"/>' +
      '<path d="M5.4 10.8H9.8M14.2 10.8H18.6M12 14.2V18.8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  var SVG_PLANE =
    '<svg class="zig-inline-svg zig-jet-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-jet" x1="3" y1="2.5" x2="21" y2="21.5" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#38bdf8"/>' +
          '<stop offset="55%" stop-color="#0ea5e9"/>' +
          '<stop offset="100%" stop-color="#2563eb"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M12 2.2L14.4 8.8L21.6 11.2V13.2L14.4 12.1L13.6 18.1L16.4 19.9V21.6L12 20.4L7.6 21.6V19.9L10.4 18.1L9.6 12.1L2.4 13.2V11.2L9.6 8.8L12 2.2Z" fill="url(#zig-grad-jet)"/>' +
      '<path d="M12 3.8L13.1 9.6L12 18.6L10.9 9.6L12 3.8Z" fill="#ffffff" fill-opacity="0.88"/>' +
    '</svg>';

  var SVG_LOCK =
    '<svg class="zig-inline-svg zig-lock-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="zig-grad-lock" x1="5" y1="10" x2="19" y2="21" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fde047"/>' +
          '<stop offset="100%" stop-color="#d97706"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M8.2 11V7.7C8.2 5.6 9.9 3.9 12 3.9C14.1 3.9 15.8 5.6 15.8 7.7V11" stroke="#fde68a" stroke-width="2.1" stroke-linecap="round"/>' +
      '<rect x="5" y="10.6" width="14" height="10.4" rx="2.8" fill="url(#zig-grad-lock)"/>' +
      '<circle cx="12" cy="15.4" r="1.4" fill="#ffffff"/>' +
    '</svg>';

  /* ---------------- Preloaded Key-Art Plates ---------------- */
  var artImages = {
    heavybag: null,
    heist: null
  };

  function preloadKeyArt() {
    try {
      if (typeof Image === 'function') {
        var bagImg = new Image();
        bagImg.decoding = 'async';
        bagImg.src = '/assets/ui/watercolor-art/arcade-heavybag.webp';
        artImages.heavybag = bagImg;

        var heistImg = new Image();
        heistImg.decoding = 'async';
        heistImg.src = '/assets/ui/watercolor-art/arcade-heist.webp';
        artImages.heist = heistImg;
      }
    } catch (_) {}
  }

  preloadKeyArt();

  function drawCoverArt(ctx, img, w, h, offsetX, offsetY, zoom) {
    if (!img || !img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return false;
    try {
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var scale = Math.max(w / iw, h / ih) * (zoom || 1);
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = (w - dw) * 0.5 + (offsetX || 0);
      var dy = (h - dh) * 0.5 + (offsetY || 0);
      ctx.drawImage(img, dx, dy, dw, dh);
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureMotionStyles() {
    try {
      var oldStyle = document.getElementById('zig-v126-motion-styles');
      if (oldStyle) oldStyle.remove();
      if (document.getElementById(MOTION_STYLE_ID)) return;
      var style = document.createElement('style');
      style.id = MOTION_STYLE_ID;
      style.textContent = [
        '.zig-arcade-title{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;text-transform:none !important;letter-spacing:-0.015em !important;font-weight:700 !important;}',
        '.zig-live-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px !important;font-size:9.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;background:rgba(57,231,163,0.14);border:0 !important;color:#39e7a3;line-height:1.3;}',
        '.zig-live-pill::before{content:"";width:5px;height:5px;border-radius:50%;background:#39e7a3;box-shadow:0 0 6px #39e7a3;}',
        'html[data-theme="light"] .zig-live-pill{background:rgba(13,122,73,0.12);color:#065f46;}',
        'html[data-theme="light"] .zig-live-pill::before{background:#059669;box-shadow:none;}',
        '.zig-arcade-emblem{display:inline-grid;place-items:center;width:38px !important;height:38px !important;border:0 !important;border-radius:12px !important;background:rgba(255,255,255,0.048) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.10) !important;}',
        'html[data-theme="light"] .zig-arcade-emblem{background:rgba(15,23,42,0.055) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.7) !important;}',
        '.zig-emblem-svg{width:22px;height:22px;display:block;filter:drop-shadow(0 2px 6px rgba(34,211,238,0.28));transition:transform 240ms cubic-bezier(0.22,1,0.36,1);}',
        '.zig-arcade-deck:hover .zig-emblem-svg{transform:scale(1.07) rotate(-4deg);}',
        '.zig-sound-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.07) !important;border-radius:10px !important;background:rgba(255,255,255,0.045) !important;}',
        'html[data-theme="light"] .zig-sound-btn{background:rgba(15,23,42,0.05) !important;border-color:rgba(15,23,42,0.08) !important;}',
        '.zig-inline-svg{width:15px;height:15px;display:inline-block;flex:none;vertical-align:-2px;}',
        '.zig-sound-wave-1,.zig-sound-wave-2{transform-origin:12px 12px;transition:opacity 200ms ease,transform 200ms ease;}',
        '.zig-sound-btn:hover .zig-sound-wave-1{transform:scale(1.08);}',
        '.zig-sound-btn:hover .zig-sound-wave-2{transform:scale(1.12);}',
        '.zig-jet-svg{width:16px;height:16px;filter:drop-shadow(0 2px 5px rgba(56,189,248,0.32));transition:transform 220ms cubic-bezier(0.22,1,0.36,1);}',
        '#zig-world-flight-bar:hover .zig-jet-svg,.zig-city-chip:hover .zig-jet-svg{transform:translate(2px,-1px) rotate(-8deg);}',
        '.zig-lock-svg{width:12.5px;height:12.5px;margin-inline-end:2px;}',
        '.zig-card-media{position:relative;aspect-ratio:16 / 10;min-height:110px;width:100%;overflow:hidden;background:#070b13;}',
        '@media (max-width:640px){.zig-card-media{min-height:84px;aspect-ratio:auto;}.zig-card-badge{top:6px;inset-inline-start:6px;font-size:9px;padding:2px 7px;}}',
        '.zig-card-art{width:100%;height:100%;object-fit:cover;display:block;transition:transform 460ms cubic-bezier(0.22,1,0.36,1),filter 280ms ease;}',
        '.zig-game-card:hover .zig-card-art{transform:scale(1.06);filter:brightness(1.07);}',
        '.zig-card-shader{position:absolute;inset:0;width:100% !important;height:100% !important;pointer-events:none;z-index:2;display:block;background:transparent !important;border:0 !important;}',
        '.zig-card-badge{position:absolute;top:10px;inset-inline-start:10px;z-index:3;background:rgba(8,13,23,0.88);border:1px solid rgba(255,255,255,0.12);color:#f8fafc;font-size:10px;font-weight:700;letter-spacing:0.03em;padding:3px 9px;border-radius:999px !important;line-height:1.25;}',
        '.zig-game-card-cta{display:inline-flex;align-items:center;gap:6px;text-transform:none !important;letter-spacing:0.01em !important;}',
        '.zig-cta-chevron{width:13px;height:13px;flex:none;transition:transform 200ms cubic-bezier(0.22,1,0.36,1);}',
        '.zig-game-card:hover .zig-cta-chevron{transform:translateX(2px);}',
        'html[dir="rtl"] .zig-cta-chevron,[dir="rtl"] .zig-cta-chevron{transform:scaleX(-1);}',
        'html[dir="rtl"] .zig-game-card:hover .zig-cta-chevron,[dir="rtl"] .zig-game-card:hover .zig-cta-chevron{transform:scaleX(-1) translateX(2px);}',
        '.zig-getaway-heading{display:inline-flex;align-items:center;gap:7px;color:#ebb858;font-size:12px;font-weight:800;letter-spacing:0.02em;}',
        /* Borderless Tonal World Flights Bar & Cards */
        '#zig-world-flight-bar{background:#0d1320 !important;border:1px solid rgba(255,255,255,0.05) !important;border-radius:14px !important;box-shadow:0 10px 28px rgba(0,0,0,0.26) !important;padding:12px 14px !important;}',
        'html[data-theme="light"] #zig-world-flight-bar{background:#ffffff !important;border:1px solid rgba(15,23,42,0.06) !important;box-shadow:0 8px 24px rgba(15,23,42,0.06) !important;}',
        '.zig-world-flight-title{display:inline-flex;align-items:center;gap:8px;text-transform:none !important;letter-spacing:-0.01em !important;font-size:13.5px !important;font-weight:700 !important;color:#f8fafc;}',
        'html[data-theme="light"] .zig-world-flight-title{color:#0f172a !important;}',
        '.zig-world-origin-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(56,189,248,0.12);color:#7dd3fc;border:0;}',
        'html[data-theme="light"] .zig-world-origin-pill{background:rgba(2,132,199,0.10);color:#0369a1;}',
        '.zig-world-lv-pill{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10.5px;font-weight:700;background:rgba(255,255,255,0.05);color:#cbd5e1;}',
        'html[data-theme="light"] .zig-world-lv-pill{background:rgba(15,23,42,0.06);color:#334155;}',
        '#zig-world-flight-bar .zig-city-chip,.zig-flight-card{background:rgba(255,255,255,0.035) !important;border:1px solid rgba(255,255,255,0.045) !important;border-radius:11px !important;box-shadow:none !important;transition:transform 180ms cubic-bezier(0.22,1,0.36,1),background-color 180ms ease !important;}',
        '#zig-world-flight-bar .zig-city-chip:hover{background:rgba(255,255,255,0.065) !important;transform:translateY(-1px);}',
        '#zig-world-flight-bar .zig-city-chip.is-active{background:rgba(57,231,163,0.10) !important;border-color:rgba(57,231,163,0.28) !important;}',
        'html[data-theme="light"] #zig-world-flight-bar .zig-city-chip{background:#f8fafc !important;border:1px solid rgba(15,23,42,0.06) !important;}',
        'html[data-theme="light"] #zig-world-flight-bar .zig-city-chip:hover{background:#f1f5f9 !important;}',
        'html[data-theme="light"] #zig-world-flight-bar .zig-city-chip.is-active{background:rgba(16,185,129,0.10) !important;border-color:rgba(16,185,129,0.30) !important;}',
        '.zig-here-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#39e7a3;box-shadow:0 0 6px rgba(57,231,163,0.8);}',
        '.zig-chip-status{display:inline-flex;align-items:center;gap:3px;}',
        '.zig-gym-wrap,.zig-heist-wrap,.zig-casino-canvas-box,.zig-getaway-canvas-wrap{width:100% !important;max-width:100% !important;min-width:0 !important;overflow:hidden !important;box-sizing:border-box !important;}',
        '#zig-gym-canvas,#zig-heist-canvas,#zig-roulette-canvas,#zig-slots-canvas,#zig-getaway-canvas{display:block !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important;}',
        'html[lang="ar"] .zig-arcade-deck *,html[dir="rtl"] .zig-arcade-deck *,[dir="rtl"] .zig-arcade-deck *,html[lang="ar"] .zig-world-flight-bar *,html[dir="rtl"] .zig-world-flight-bar *,[dir="rtl"] .zig-world-flight-bar *{letter-spacing:0 !important;}'
      ].join('');
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}
  }

  function isAr() {
    var html = document.documentElement;
    if (!html) return false;
    var lang = (html.lang || '').toLowerCase();
    var dir = (html.dir || '').toLowerCase();
    return lang.indexOf('ar') === 0 || dir === 'rtl';
  }

  function fontStack(weight, px) {
    return weight + ' ' + px + 'px "Rubik","Cairo",system-ui,sans-serif';
  }

  /* ---------------- WebAudio Procedural Arcade Synth ---------------- */
  var audioCtx = null;
  var soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem('zig_muted') !== '1';
  } catch (_) {}

  function setSoundEnabled(flag) {
    soundEnabled = Boolean(flag);
    try {
      localStorage.setItem('zig_muted', soundEnabled ? '0' : '1');
    } catch (_) {}
    window.__zoneMuted = !soundEnabled;
  }

  function ensureAudio() {
    try {
      if (localStorage.getItem('zig_muted') === '1') soundEnabled = false;
    } catch (_) {}
    if (!soundEnabled) return null;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (_) {
      return null;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol || 0.08, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  var sfx = {
    lockClick: function () { tone(920, 0.045, 'square', 0.045, 520, 0); },
    breachWin: function () {
      tone(523.25, 0.09, 'triangle', 0.09, 659.25, 0);
      tone(659.25, 0.11, 'triangle', 0.09, 783.99, 0.07);
      tone(1046.5, 0.22, 'sine', 0.11, 1318.5, 0.14);
    },
    sirenBuzz: function () {
      tone(220, 0.16, 'sawtooth', 0.06, 155, 0);
      tone(185, 0.18, 'sawtooth', 0.05, 130, 0.12);
    },
    wheelTick: function () { tone(1280, 0.028, 'triangle', 0.03, 780, 0); },
    reelClunk: function () { tone(190, 0.08, 'square', 0.07, 72, 0); },
    jackpot: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone(f, 0.16, 'triangle', 0.09, f * 1.04, i * 0.065);
      });
    },
    punch: function (heavy) {
      tone(heavy ? 135 : 98, 0.14, 'sine', heavy ? 0.15 : 0.1, 36, 0);
      if (heavy) tone(620, 0.09, 'triangle', 0.06, 980, 0.03);
    },
    pickup: function () {
      tone(740, 0.07, 'sine', 0.08, 1180, 0);
      tone(1180, 0.12, 'sine', 0.08, 1480, 0.06);
    },
    crash: function () {
      tone(150, 0.24, 'sawtooth', 0.09, 42, 0);
    }
  };

  /* ---------------- Sizing Helper (Zero Overflow Safe, Mobile 104x92 Card Ready) ---------------- */
  function syncCanvas(canvas, cssHeight) {
    if (!canvas) return null;
    var isPreview = Boolean(canvas.hasAttribute && canvas.hasAttribute('data-zig-preview'));
    var cw = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 0;
    var ch = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 0;
    var rect = canvas.getBoundingClientRect();
    var rawW = cw > 0 ? cw : (rect.width || (isPreview ? 104 : 280));
    var minW = isPreview ? 72 : 150;
    var w = Math.max(minW, Math.round(rawW));
    var h = cssHeight || Math.max(isPreview ? 68 : 80, Math.round(ch || rect.height || (isPreview ? 92 : 160)));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = Math.round(w * dpr);
    var ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function spawnFloatingReward(text, color) {
    try {
      var cashEl = document.getElementById('zone-cash');
      var r = cashEl ? cashEl.getBoundingClientRect() : { left: window.innerWidth * 0.5, top: 80, width: 40 };
      var pop = document.createElement('div');
      pop.className = 'zig-float-pop';
      pop.style.left = Math.round(r.left + r.width * 0.5) + 'px';
      pop.style.top = Math.round(Math.max(48, r.top)) + 'px';
      pop.style.color = color || '#49f0a1';
      pop.textContent = text;
      document.body.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 1300);
    } catch (_) {}
  }

  /* ---------------- Game State Containers ---------------- */
  var state = {
    t: 0,
    lastCash: null,
    lastLang: '',
    hoveredPreviewId: null,
    rafId: 0,
    rafTicks: 0,
    canvasVisibility: {},
    /* Atmospheric Preview Motes */
    previewFX: {
      rain: [],
      embers: [],
      motes: [],
      bokeh: [],
      chalk: []
    },
    /* Nitro Getaway (Home Instant Game) */
    getaway: {
      open: false,
      running: false,
      lane: 1.5,
      targetLane: 1.5,
      speed: 260,
      score: 0,
      best: 0,
      bags: 0,
      combo: 1,
      nitro: 100,
      boosting: false,
      flash: 0,
      gameOver: false,
      entities: [],
      spawnTimer: 0,
      particles: []
    },
    /* Safe-Crack Reflex (Crimes) */
    heist: {
      angle: 0,
      speed: 2.55,
      dir: 1,
      targetCenter: 1.1,
      targetArc: 0.78,
      streak: 0,
      banner: '',
      bannerColor: '#ebb858',
      bannerUntil: 0,
      sirenUntil: 0,
      sparks: [],
      rain: []
    },
    /* Gym Heavy-Bag Overdrive */
    gym: {
      bagAngle: 0,
      bagVel: 0,
      gaugePos: 0.5,
      gaugeDir: 1,
      combo: 0,
      banner: '',
      bannerColor: '#39e7a3',
      bannerUntil: 0,
      sparks: [],
      rings: []
    },
    /* Casino Roulette */
    roulette: {
      wheelAngle: 0,
      wheelSpeed: 0.35,
      ballAngle: 0,
      ballSpeed: -0.9,
      ballRadiusFrac: 0.84,
      spinning: false,
      settling: false,
      lastPocket: null,
      lastTickIdx: -1,
      highlightUntil: 0,
      sparks: []
    },
    /* Casino Slots */
    slots: {
      spinning: false,
      spinStart: 0,
      offsets: [0, 2, 4],
      speeds: [0, 0, 0],
      locked: [true, true, true],
      targets: [1, 2, 0],
      lastSig: '',
      coins: [],
      leverPull: 0
    }
  };

  for (var ri = 0; ri < 38; ri++) {
    state.heist.rain.push({ x: Math.random(), y: Math.random(), len: 8 + Math.random() * 14, spd: 0.5 + Math.random() * 0.7 });
  }
  for (var pri = 0; pri < 22; pri++) {
    state.previewFX.rain.push({ x: Math.random(), y: Math.random(), len: 10 + Math.random() * 14, spd: 0.65 + Math.random() * 0.75 });
  }
  for (var pei = 0; pei < 12; pei++) {
    state.previewFX.embers.push({ x: Math.random(), y: Math.random(), r: 1.1 + Math.random() * 1.6, spd: 0.22 + Math.random() * 0.32, drift: (Math.random() - 0.5) * 0.25 });
    state.previewFX.motes.push({ x: Math.random(), y: Math.random(), r: 1.0 + Math.random() * 1.5, spd: 0.08 + Math.random() * 0.14, phase: Math.random() * Math.PI * 2 });
    state.previewFX.bokeh.push({ x: Math.random(), y: Math.random(), r: 2.5 + Math.random() * 5.5, spd: 0.06 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2 });
    state.previewFX.chalk.push({ x: Math.random(), y: Math.random(), r: 0.9 + Math.random() * 1.6, spd: 0.09 + Math.random() * 0.16, drift: (Math.random() - 0.5) * 0.18 });
  }

  function goScreen(id) {
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(id);
      return;
    }
    var btn = document.querySelector('#zone-area-navigation button[data-zone-screen="' + id + '"]');
    if (btn) btn.click();
  }

  function renderSoundBtnInner(ar) {
    var label = soundEnabled
      ? (ar ? 'الصوت: مفعل' : 'SFX: ON')
      : (ar ? 'الصوت: صامت' : 'SFX: OFF');
    return (soundEnabled ? SVG_SPEAKER_ON : SVG_SPEAKER_OFF) + '<span>' + label + '</span>';
  }

  /* ---------------- 1. HOME: Poster Arcade Deck + Playable Nitro Getaway ---------------- */
  function startGetawayRun() {
    var gw = state.getaway;
    gw.open = true;
    gw.running = true;
    gw.gameOver = false;
    gw.lane = 1.5;
    gw.targetLane = 1.5;
    gw.speed = 275;
    gw.score = 0;
    gw.bags = 0;
    gw.combo = 1;
    gw.nitro = 100;
    gw.boosting = false;
    gw.entities = [];
    gw.particles = [];
    gw.spawnTimer = 0.35;
    sfx.pickup();
    var stage = document.getElementById('zig-getaway-stage');
    if (stage) stage.hidden = false;
    var gCv = document.getElementById('zig-getaway-canvas');
    if (gCv) observeInteractiveCanvas(gCv);
    ensureLoopRunning();
  }

  function mountHomeArcade() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'home') {
      state.hoveredPreviewId = null;
      var stale = document.getElementById('zig-home-arcade');
      if (stale) stale.remove();
      return;
    }
    var brief = main.querySelector('.zone-home-brief');
    if (!brief) return;
    var ar = isAr();
    var existing = document.getElementById('zig-home-arcade');
    if (existing && existing.getAttribute('data-lang') === (ar ? 'ar' : 'en')) return;
    if (existing) existing.remove();
    state.hoveredPreviewId = null;

    var sec = document.createElement('section');
    sec.id = 'zig-home-arcade';
    sec.className = 'zig-arcade-deck';
    sec.setAttribute('data-lang', ar ? 'ar' : 'en');

    var cards = [
      {
        id: 'getaway',
        art: '/assets/ui/watercolor-art/arcade-getaway.webp',
        alt: ar ? 'مطاردة النيون الليلية' : 'Nitro Syndicate Getaway',
        badge: ar ? 'جولة فورية' : 'Instant Run',
        name: ar ? 'مطاردة النيون الليلية' : 'Nitro Syndicate Getaway',
        desc: ar ? 'راوغ دوريات المطاردة واجمع حقائب الغنائم في شوارع زون.' : 'Thread pursuit cruisers and secure cash drops at 160 MPH.',
        cta: ar ? 'ابدأ الجولة' : 'Launch Run'
      },
      {
        id: 'heist',
        art: '/assets/ui/watercolor-art/arcade-heist.webp',
        alt: ar ? 'اختراق الخزنة المصفحة' : 'Safe-Crack Heist',
        badge: ar ? 'توقيت دقيق' : 'Precision Lock',
        name: ar ? 'اختراق الخزنة المصفحة' : 'Safe-Crack Heist',
        desc: ar ? 'اضرب القفل في النقطة الذهبية لاختراق الخزائن وتنفيذ العمليات.' : 'Strike the brass tumbler sweet-spot to breach reinforced vaults.',
        cta: ar ? 'اخترق الخزنة' : 'Crack Vault'
      },
      {
        id: 'casino',
        art: '/assets/ui/watercolor-art/arcade-casino.webp',
        alt: ar ? 'كازينو المخمل السري' : 'Velvet Roulette & Slots',
        badge: ar ? 'طاولات النخبة' : 'High-Limit Salon',
        name: ar ? 'كازينو المخمل السري' : 'Velvet Roulette & Slots',
        desc: ar ? 'عجلة روليت أوروبية دوارة وماكينات الجائزة الكبرى.' : '37-pocket European wheel, jackpot reels, and private shoe.',
        cta: ar ? 'ادخل الصالون' : 'Enter Salon'
      },
      {
        id: 'gym',
        art: '/assets/ui/watercolor-art/arcade-heavybag.webp',
        alt: ar ? 'تحدي كيس الملاكمة' : 'Heavy-Bag Overdrive',
        badge: ar ? 'عداد القوة' : 'Reflex Meter',
        name: ar ? 'تحدي كيس الملاكمة' : 'Heavy-Bag Overdrive',
        desc: ar ? 'سدّد اللكمة في المنطقة الذهبية لمضاعفة زخم التمرين.' : 'Time heavy-bag strikes inside the gold zone to boost training.',
        cta: ar ? 'ادخل الحلبة' : 'Enter Ring'
      }
    ];

    sec.innerHTML =
      '<div class="zig-arcade-header">' +
        '<div class="zig-arcade-title-wrap">' +
          '<div class="zig-arcade-emblem">' + SVG_ARCADE_CREST + '</div>' +
          '<div>' +
            '<h2 class="zig-arcade-title">' +
              '<span>' + (ar ? 'أركيد النقابة' : 'Syndicate Arcade') + '</span>' +
              '<span class="zig-live-pill">' + (ar ? 'مباشر' : 'Live') + '</span>' +
            '</h2>' +
            '<p class="zig-arcade-sub">' +
              (ar
                ? 'تحديات تفاعلية مباشرة مرتبطة بعميلك ورصيدك الفعلي'
                : 'Interactive runs, vault lockpicking, high-limit tables, and reflex drills') +
            '</p>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="zig-sound-btn" id="zig-sound-toggle" data-zig-muted="' + (soundEnabled ? '0' : '1') + '">' +
          renderSoundBtnInner(ar) +
        '</button>' +
      '</div>' +
      '<div class="zig-arcade-grid">' +
        cards.map(function (c) {
          return (
            '<button type="button" class="zig-game-card" data-zig-launch="' + c.id + '">' +
              '<div class="zig-card-media">' +
                '<img class="zig-card-art" src="' + c.art + '" alt="' + c.alt + '" loading="eager" decoding="async">' +
                '<canvas class="zig-card-shader" data-zig-preview="' + c.id + '"></canvas>' +
                '<span class="zig-card-badge">' + c.badge + '</span>' +
              '</div>' +
              '<div class="zig-game-card-body">' +
                '<strong class="zig-game-card-name">' + c.name + '</strong>' +
                '<span class="zig-game-card-desc">' + c.desc + '</span>' +
                '<span class="zig-game-card-cta"><span>' + c.cta + '</span>' + SVG_CTA_CHEVRON + '</span>' +
              '</div>' +
            '</button>'
          );
        }).join('') +
      '</div>' +
      '<div class="zig-getaway-stage" id="zig-getaway-stage"' + (state.getaway.open ? '' : ' hidden') + '>' +
        '<div class="zig-getaway-bar">' +
          '<div class="zig-getaway-heading">' +
            SVG_WHEEL_STEER +
            '<span>' +
              (ar ? 'مطاردة النيون الليلية: الأسهم أو اللمس للمراوغة' : 'Nitro Syndicate Getaway: Arrows or Tap Lanes to Dodge') +
            '</span>' +
          '</div>' +
          '<div class="zig-stage-controls">' +
            '<button type="button" class="zig-btn" id="zig-getaway-restart">' + (ar ? 'جولة جديدة' : 'New Run') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-fence">' + (ar ? 'تصريف الغنيمة (عملية شارع)' : 'Fence Loot (Run Street Op)') + '</button>' +
            '<button type="button" class="zig-btn-secondary" id="zig-getaway-close">' + (ar ? 'إغلاق' : 'Close') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="zig-getaway-canvas-wrap"><canvas id="zig-getaway-canvas"></canvas></div>' +
      '</div>';

    brief.insertAdjacentElement('afterend', sec);

    var sndBtn = sec.querySelector('#zig-sound-toggle');
    if (sndBtn) {
      sndBtn.addEventListener('click', function () {
        setSoundEnabled(!soundEnabled);
        sndBtn.setAttribute('data-zig-muted', soundEnabled ? '0' : '1');
        if (soundEnabled) sfx.pickup();
        sndBtn.innerHTML = renderSoundBtnInner(isAr());
      });
    }

    sec.querySelectorAll('[data-zig-launch]').forEach(function (btn) {
      var cardId = btn.getAttribute('data-zig-launch');
      btn.addEventListener('pointerenter', function () {
        state.hoveredPreviewId = cardId;
        ensureLoopRunning();
      });
      btn.addEventListener('pointerleave', function () {
        if (state.hoveredPreviewId === cardId) {
          state.hoveredPreviewId = null;
          ensureLoopRunning();
        }
      });
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-zig-launch');
        ensureAudio();
        if (id === 'getaway') {
          startGetawayRun();
        } else if (id === 'heist') {
          sfx.lockClick();
          goScreen('crimes');
        } else if (id === 'casino') {
          sfx.wheelTick();
          goScreen('casino');
        } else if (id === 'gym') {
          sfx.punch(true);
          goScreen('gym');
        }
      });
    });

    var restartBtn = sec.querySelector('#zig-getaway-restart');
    if (restartBtn) restartBtn.addEventListener('click', startGetawayRun);

    var closeBtn = sec.querySelector('#zig-getaway-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        state.getaway.open = false;
        state.getaway.running = false;
        var st = document.getElementById('zig-getaway-stage');
        if (st) st.hidden = true;
        ensureLoopRunning();
      });
    }

    var fenceBtn = sec.querySelector('#zig-getaway-fence');
    if (fenceBtn) {
      fenceBtn.addEventListener('click', function () {
        sfx.breachWin();
        var v = window.__zoneLastView;
        var readyCrime = v && Array.isArray(v.crimes) ? v.crimes.find(function (c) { return !c.disabled; }) : null;
        if (readyCrime && typeof readyCrime.commit === 'function') {
          readyCrime.commit();
          spawnFloatingReward(isAr() ? 'جارٍ تصريف الغنيمة' : 'FENCING LOOT', '#ebb858');
        } else {
          goScreen('crimes');
        }
      });
    }

    var gCanvas = sec.querySelector('#zig-getaway-canvas');
    if (gCanvas) {
      observeInteractiveCanvas(gCanvas);
      var steerFromEvent = function (e) {
        ensureAudio();
        if (state.getaway.gameOver || !state.getaway.running) {
          startGetawayRun();
          return;
        }
        var rect = gCanvas.getBoundingClientRect();
        var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        var roadW = Math.min(rect.width * 0.72, 380);
        var roadLeft = (rect.width - roadW) * 0.5;
        var rel = (clientX - rect.left - roadLeft) / roadW;
        var lane = Math.max(0, Math.min(3, Math.floor(rel * 4)));
        state.getaway.targetLane = lane;
        sfx.lockClick();
      };
      gCanvas.addEventListener('pointerdown', steerFromEvent);
    }

    /* Render 1 crisp static atmospheric frame on all 4 cards at rest (0 continuous rAF loops!) */
    renderStaticHomePreviews();
  }

  /* ---------------- 2. CRIMES: Safe-Crack Reflex Canvas ---------------- */
  function triggerHeistStrike() {
    ensureAudio();
    var h = state.heist;
    var diff = Math.atan2(Math.sin(h.angle - h.targetCenter), Math.cos(h.angle - h.targetCenter));
    var absDiff = Math.abs(diff);
    var halfArc = h.targetArc * 0.5;
    var ar = isAr();

    if (absDiff <= halfArc) {
      var perfect = absDiff <= halfArc * 0.38;
      h.streak += 1;
      h.banner = perfect
        ? (ar ? 'اختراق ذهبي متقن! سلسلة ×' + h.streak : 'PERFECT BREACH! STREAK x' + h.streak)
        : (ar ? 'تم فتح القفل! سلسلة ×' + h.streak : 'TUMBLER CRACKED! STREAK x' + h.streak);
      h.bannerColor = perfect ? '#ebb858' : '#39e7a3';
      h.bannerUntil = performance.now() + 2000;
      sfx.breachWin();
      for (var i = 0; i < 28; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 170;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.55 + Math.random() * 0.35,
          color: i % 2 ? '#ebb858' : '#39e7a3'
        });
      }
      h.dir *= -1;
      h.targetCenter = Math.random() * Math.PI * 2;
      h.speed = Math.min(4.1, 2.4 + h.streak * 0.16);

      /* Trigger real authoritative crime commit if ready */
      var selected = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
      if (selected && !selected.disabled && typeof selected.commit === 'function') {
        selected.commit();
      } else {
        var btn = document.querySelector('.zone-crime-plan button[data-crime-attempt]:not([disabled])');
        if (btn) btn.click();
      }
    } else {
      h.streak = 0;
      h.speed = 2.45;
      h.sirenUntil = performance.now() + 950;
      h.banner = ar ? 'انزلق القفل! اضغط داخل القوس الذهبي' : 'TUMBLER SLIPPED: HIT THE GOLD ARC';
      h.bannerColor = '#ff6a55';
      h.bannerUntil = performance.now() + 1500;
      sfx.sirenBuzz();
      for (var j = 0; j < 14; j++) {
        var a2 = Math.random() * Math.PI * 2;
        h.sparks.push({
          x: 0, y: 0,
          vx: Math.cos(a2) * 90,
          vy: Math.sin(a2) * 90,
          life: 0.4,
          color: '#ff5d6c'
        });
      }
    }
  }

  function mountCrimesGame() {
    ensureMotionStyles();
    var scene = document.querySelector('#zone-main[data-zone-screen="crimes"] .zone-crime-scene');
    if (!scene) return;
    var existingCv = scene.querySelector('#zig-heist-canvas');
    if (existingCv) {
      observeInteractiveCanvas(existingCv);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'zig-heist-wrap';
    wrap.innerHTML = '<canvas id="zig-heist-canvas" aria-label="Safe-Crack Heist Mini-Game"></canvas>';
    scene.appendChild(wrap);
    var c = wrap.querySelector('canvas');
    observeInteractiveCanvas(c);
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      triggerHeistStrike();
    });
    ensureLoopRunning();
  }

  /* ---------------- 3. GYM: Heavy-Bag Overdrive Canvas ---------------- */
  function triggerGymStrike() {
    ensureAudio();
    var gm = state.gym;
    var dist = Math.abs(gm.gaugePos - 0.5);
    var overdrive = dist <= 0.14;
    var ar = isAr();

    gm.bagVel = -(overdrive ? 6.8 : 4.1);
    gm.combo = overdrive ? gm.combo + 1 : 1;
    gm.banner = overdrive
      ? (ar ? 'ضربة قاضية في الذروة ×' + gm.combo : 'OVERDRIVE SWEET-SPOT x' + gm.combo)
      : (ar ? 'ضربة مباشرة، استمر' : 'SOLID BAG STRIKE');
    gm.bannerColor = overdrive ? '#ebb858' : '#39e7a3';
    gm.bannerUntil = performance.now() + 1600;
    sfx.punch(overdrive);

    gm.rings.push({ r: 14, alpha: 0.9, color: overdrive ? '#ebb858' : '#39e7a3' });
    for (var i = 0; i < (overdrive ? 24 : 12); i++) {
      var ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
      var spd = 60 + Math.random() * 140;
      gm.sparks.push({
        x: 0, y: 0,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.3,
        color: overdrive ? '#ebb858' : '#39e7a3'
      });
    }

    var sess = window.__zoneLastView && window.__zoneLastView.gymSession;
    var trainBtn = document.querySelector('.zone-gym-session button[data-gym-train]:not([disabled])');
    if (sess && typeof sess.train === 'function' && trainBtn) {
      sess.train();
    } else if (trainBtn) {
      trainBtn.click();
    }
  }

  function mountGymGame() {
    ensureMotionStyles();
    var sessionBox = document.querySelector('#zone-main[data-zone-screen="gym"] .zone-gym-session');
    if (!sessionBox) return;
    var existingCv = sessionBox.querySelector('#zig-gym-canvas');
    if (existingCv) {
      observeInteractiveCanvas(existingCv);
      return;
    }
    var trainBtn = sessionBox.querySelector('button[data-gym-train]');
    var wrap = document.createElement('div');
    wrap.className = 'zig-gym-wrap';
    wrap.innerHTML = '<canvas id="zig-gym-canvas" aria-label="Heavy-Bag Reflex Trainer"></canvas>';
    if (trainBtn) {
      trainBtn.insertAdjacentElement('beforebegin', wrap);
    } else {
      sessionBox.appendChild(wrap);
    }
    var c = wrap.querySelector('canvas');
    observeInteractiveCanvas(c);
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      triggerGymStrike();
    });
    ensureLoopRunning();
  }

  /* ---------------- 4. CASINO: Roulette Wheel + 3-Reel Neon Slots ---------------- */
  function startRouletteAnimation() {
    var rl = state.roulette;
    rl.spinning = true;
    rl.settling = false;
    rl.wheelSpeed = 2.6;
    rl.ballSpeed = -9.4;
    rl.ballRadiusFrac = 0.88;
    ensureLoopRunning();
  }

  function startSlotsAnimation() {
    var sl = state.slots;
    sl.spinning = true;
    sl.spinStart = performance.now();
    sl.locked = [false, false, false];
    sl.speeds = [22, 25, 28];
    sl.leverPull = 1;
    sfx.lockClick();
    ensureLoopRunning();
  }

  function mountCasinoGames() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'casino') return;

    /* Roulette Wheel Canvas */
    var rTable = main.querySelector('[data-casino-table="roulette"]');
    if (rTable && !rTable.querySelector('#zig-roulette-canvas')) {
      var rHeader = rTable.firstElementChild;
      var rBox = document.createElement('div');
      rBox.className = 'zig-casino-canvas-box';
      rBox.innerHTML = '<canvas id="zig-roulette-canvas" aria-label="European Roulette Wheel"></canvas>';
      if (rHeader) rHeader.insertAdjacentElement('afterend', rBox);
      else rTable.prepend(rBox);

      var rCv = rBox.querySelector('canvas');
      observeInteractiveCanvas(rCv);
      rCv.addEventListener('pointerdown', function () {
        ensureAudio();
        var redBtn = rTable.querySelector('[data-roulette-bet="red"]:not([disabled])');
        startRouletteAnimation();
        if (redBtn) redBtn.click();
      });

      rTable.addEventListener('click', function (ev) {
        var betBtn = ev.target && ev.target.closest ? ev.target.closest('[data-roulette-bet]') : null;
        if (betBtn && !betBtn.disabled) {
          ensureAudio();
          startRouletteAnimation();
        }
      });
    } else if (rTable) {
      observeInteractiveCanvas(rTable.querySelector('#zig-roulette-canvas'));
    }

    /* 3-Reel Jackpot Slots Canvas */
    var sTable = main.querySelector('[data-casino-table="slots"]');
    if (sTable && !sTable.querySelector('#zig-slots-canvas')) {
      sTable.classList.add('zig-slots-mounted');
      var jackpotBanner = sTable.children[1] || sTable.firstElementChild;
      var sBox = document.createElement('div');
      sBox.className = 'zig-casino-canvas-box';
      sBox.innerHTML = '<canvas id="zig-slots-canvas" aria-label="3-Reel Neon Slot Machine"></canvas>';
      if (jackpotBanner) jackpotBanner.insertAdjacentElement('afterend', sBox);
      else sTable.prepend(sBox);

      var triggerSpin = function () {
        ensureAudio();
        startSlotsAnimation();
        var g = window.__zoneGame;
        if (g && typeof g.spinSlots === 'function' && !g.slotsBusy) {
          g.spinSlots();
        }
      };

      var sCv = sBox.querySelector('canvas');
      observeInteractiveCanvas(sCv);
      sCv.addEventListener('pointerdown', triggerSpin);
      sTable.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (btn && btn.classList.contains('zone-action-primary') && !btn.disabled) {
          ensureAudio();
          startSlotsAnimation();
        }
      });
    } else if (sTable) {
      observeInteractiveCanvas(sTable.querySelector('#zig-slots-canvas'));
    }
    ensureLoopRunning();
  }

  /* ---------------- 5. ATTACK: Street Brawl Versus Banner ---------------- */
  function mountAttackBanner() {
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'attack') return;
    var frame = document.getElementById('zone-combat-frame');
    if (!frame) return;
    var banner = document.getElementById('zig-brawl-hud');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'zig-brawl-hud';
      banner.className = 'zig-brawl-banner';
      frame.insertAdjacentElement('beforebegin', banner);
    }
    var v = window.__zoneLastView;
    var f = v && v.fight;
    var ar = isAr();
    var youName = (v && v.t && v.t.player) || 'Operative';
    var oppName = f ? f.name : (v && v.opps && v.opps[0] ? v.opps[0].name : (ar ? 'خصم الشارع' : 'Street Rival'));
    var youPct = f ? f.youPct : 100;
    var oppPct = f ? f.oppPct : 100;
    var statusTxt = f ? (f.verdict + ' · ' + f.progress) : (ar ? 'اختر خصماً لبدء القتال' : 'Select a rival below to engage');

    banner.innerHTML =
      '<div class="zig-brawl-side">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#e2e8f0"><span>' + youName + '</span><bdi style="color:#39e7a3">' + youPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div style="height:100%;width:' + youPct + '%;background:linear-gradient(90deg,#2563eb,#39e7a3);transition:width .25s"></div></div>' +
      '</div>' +
      '<div style="text-align:center;flex:none">' +
        '<div class="zig-brawl-vs">VS</div>' +
        '<div style="font-size:9.5px;color:#94a3b8;font-weight:700">' + statusTxt + '</div>' +
      '</div>' +
      '<div class="zig-brawl-side">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#e2e8f0"><span>' + oppName + '</span><bdi style="color:#ff6a55">' + oppPct + '%</bdi></div>' +
        '<div class="zig-brawl-bar"><div style="height:100%;width:' + oppPct + '%;background:linear-gradient(90deg,#ef4444,#f59e0b);transition:width .25s"></div></div>' +
      '</div>';
  }

  /* ---------------- Keyboard Controls ---------------- */
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    var main = document.getElementById('zone-main');
    var scr = main ? main.getAttribute('data-zone-screen') : '';

    if (scr === 'home' && state.getaway.open && state.getaway.running) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        state.getaway.targetLane = Math.max(0, Math.round(state.getaway.targetLane) - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        state.getaway.targetLane = Math.min(3, Math.round(state.getaway.targetLane) + 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        state.getaway.boosting = true;
      }
    } else if (scr === 'crimes' && e.key === ' ') {
      if (document.getElementById('zig-heist-canvas')) {
        e.preventDefault();
        triggerHeistStrike();
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === ' ') state.getaway.boosting = false;
  });

  /* ---------------- Transparent Atmospheric Shader Previews (1 Static Frame at Rest, Animate Hovered Card Only!) ---------------- */
  function advancePreviewParticles(dt) {
    var pfx = state.previewFX;
    for (var i = 0; i < pfx.rain.length; i++) {
      var rn = pfx.rain[i];
      rn.y += rn.spd * dt * 1.45;
      rn.x -= rn.spd * dt * 0.28;
      if (rn.y > 1.08) { rn.y = -0.08; rn.x = Math.random() * 1.15; }
    }
    for (var j = 0; j < pfx.embers.length; j++) {
      var em = pfx.embers[j];
      em.y -= em.spd * dt;
      em.x += em.drift * dt;
      if (em.y < -0.06) { em.y = 1.06; em.x = 0.15 + Math.random() * 0.7; }
      var mt = pfx.motes[j];
      mt.y -= mt.spd * dt;
      if (mt.y < -0.05) { mt.y = 1.05; mt.x = Math.random(); }
      var bk = pfx.bokeh[j];
      bk.y -= bk.spd * dt;
      if (bk.y < -0.08) { bk.y = 1.08; bk.x = Math.random(); }
      var ck = pfx.chalk[j];
      ck.y -= ck.spd * dt;
      ck.x += ck.drift * dt;
      if (ck.y < -0.06) { ck.y = 1.06; ck.x = 0.15 + Math.random() * 0.7; }
    }
  }

  function paintSinglePreviewCanvas(cv, now) {
    if (!cv) return;
    var pfx = state.previewFX;
    var kind = cv.getAttribute('data-zig-preview');
    var rect = cv.getBoundingClientRect();
    var rawH = cv.clientHeight || (cv.parentElement && cv.parentElement.clientHeight) || rect.height || 92;
    var targetH = Math.max(68, Math.round(rawH));
    var s = syncCanvas(cv, targetH);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;

    /* Transparent canvas: real UE5 WebP key-art shines underneath! */
    ctx.clearRect(0, 0, w, h);

    if (kind === 'getaway') {
      var sirenPhase = Math.sin(now * 0.0085);
      var redAlpha = Math.max(0.06, sirenPhase * 0.22);
      var blueAlpha = Math.max(0.06, -sirenPhase * 0.22);
      var rg = ctx.createRadialGradient(w * 0.18, h * 0.78, 4, w * 0.18, h * 0.78, w * 0.52);
      rg.addColorStop(0, 'rgba(239, 68, 68, ' + redAlpha.toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      var bg = ctx.createRadialGradient(w * 0.82, h * 0.76, 4, w * 0.82, h * 0.76, w * 0.52);
      bg.addColorStop(0, 'rgba(59, 130, 246, ' + blueAlpha.toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
      ctx.lineWidth = 1;
      for (var rIdx = 0; rIdx < pfx.rain.length; rIdx++) {
        var rDrop = pfx.rain[rIdx];
        var rx = rDrop.x * w, ry = rDrop.y * h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4.5, ry + rDrop.len);
        ctx.stroke();
      }

      for (var eIdx = 0; eIdx < pfx.embers.length; eIdx++) {
        var emb = pfx.embers[eIdx];
        ctx.fillStyle = (eIdx % 3 === 0) ? 'rgba(235, 184, 88, 0.72)' : 'rgba(57, 231, 163, 0.76)';
        ctx.beginPath();
        ctx.arc(emb.x * w, emb.y * h, emb.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'heist') {
      var scanY = (0.18 + (Math.sin(now * 0.0022) * 0.5 + 0.5) * 0.64) * h;
      var laserGrad = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12);
      laserGrad.addColorStop(0, 'rgba(57, 231, 163, 0)');
      laserGrad.addColorStop(0.5, 'rgba(57, 231, 163, 0.22)');
      laserGrad.addColorStop(1, 'rgba(57, 231, 163, 0)');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, scanY - 12, w, 24);

      ctx.strokeStyle = 'rgba(73, 240, 161, 0.58)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();

      for (var mIdx = 0; mIdx < pfx.motes.length; mIdx++) {
        var mt2 = pfx.motes[mIdx];
        var tw = 0.32 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.003 + mt2.phase));
        ctx.fillStyle = 'rgba(235, 184, 88, ' + tw.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc((mt2.x + Math.sin(now * 0.0012 + mt2.phase) * 0.03) * w, mt2.y * h, mt2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'casino') {
      var sweepX = ((now * 0.00028) % 1.6 - 0.3) * w;
      var sheen = ctx.createLinearGradient(sweepX - 42, 0, sweepX + 42, h);
      sheen.addColorStop(0, 'rgba(235, 184, 88, 0)');
      sheen.addColorStop(0.5, 'rgba(253, 230, 138, 0.14)');
      sheen.addColorStop(1, 'rgba(235, 184, 88, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      for (var bIdx = 0; bIdx < pfx.bokeh.length; bIdx++) {
        var bk2 = pfx.bokeh[bIdx];
        var alphaB = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(now * 0.0026 + bk2.phase));
        var bx = bk2.x * w, by = bk2.y * h;
        var bGrad = ctx.createRadialGradient(bx, by, 0.5, bx, by, bk2.r);
        bGrad.addColorStop(0, 'rgba(254, 240, 138, ' + (alphaB * 1.4).toFixed(3) + ')');
        bGrad.addColorStop(1, 'rgba(235, 184, 88, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bx, by, bk2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'gym') {
      var spotPulse = 0.14 + 0.08 * Math.sin(now * 0.0024);
      var spot = ctx.createRadialGradient(w * 0.5, -8, 6, w * 0.5, h * 0.25, w * 0.65);
      spot.addColorStop(0, 'rgba(255, 248, 220, ' + spotPulse.toFixed(3) + ')');
      spot.addColorStop(1, 'rgba(255, 248, 220, 0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);

      for (var cIdx = 0; cIdx < pfx.chalk.length; cIdx++) {
        var ck2 = pfx.chalk[cIdx];
        ctx.fillStyle = (cIdx % 4 === 0) ? 'rgba(235, 184, 88, 0.42)' : 'rgba(241, 245, 249, 0.36)';
        ctx.beginPath();
        ctx.arc(ck2.x * w, ck2.y * h, ck2.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function renderStaticHomePreviews() {
    var previews = document.querySelectorAll('canvas[data-zig-preview]');
    if (!previews.length) return;
    var snapNow = 1480;
    previews.forEach(function (cv) {
      paintSinglePreviewCanvas(cv, snapNow);
    });
  }

  function renderHoveredHomePreview(dt, now) {
    if (!state.hoveredPreviewId) return;
    var activeCv = document.querySelector('canvas[data-zig-preview="' + state.hoveredPreviewId + '"]');
    if (!activeCv) {
      state.hoveredPreviewId = null;
      return;
    }
    advancePreviewParticles(dt);
    paintSinglePreviewCanvas(activeCv, now);
  }

  function renderGetawayGame(dt, now) {
    var cv = document.getElementById('zig-getaway-canvas');
    if (!cv || !state.getaway.open) return;
    var s = syncCanvas(cv, 230);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gw = state.getaway;
    var ar = isAr();

    var roadW = Math.min(w * 0.74, 380);
    var roadLeft = (w - roadW) * 0.5;
    var laneW = roadW / 4;

    if (gw.running && !gw.gameOver) {
      var mult = gw.boosting && gw.nitro > 0 ? 1.55 : 1;
      if (gw.boosting && gw.nitro > 0) gw.nitro = Math.max(0, gw.nitro - dt * 42);
      else gw.nitro = Math.min(100, gw.nitro + dt * 14);

      var curSpeed = gw.speed * mult;
      gw.speed = Math.min(460, gw.speed + dt * 7.5);
      gw.score += Math.round(dt * curSpeed * 0.25 * gw.combo);
      gw.lane += (gw.targetLane - gw.lane) * Math.min(1, dt * 14);

      gw.spawnTimer -= dt;
      if (gw.spawnTimer <= 0) {
        gw.spawnTimer = Math.max(0.34, 0.72 - (gw.speed - 270) * 0.0012);
        var spawnLane = Math.floor(Math.random() * 4);
        var isLoot = Math.random() < 0.36;
        gw.entities.push({
          lane: spawnLane,
          y: -36,
          kind: isLoot ? 'cash' : 'police',
          spd: isLoot ? curSpeed * 0.78 : curSpeed * 0.92
        });
      }

      var playerX = roadLeft + (gw.lane + 0.5) * laneW;
      var playerY = h - 42;

      for (var i = gw.entities.length - 1; i >= 0; i--) {
        var ent = gw.entities[i];
        ent.y += (curSpeed * 0.85) * dt;
        var ex = roadLeft + (ent.lane + 0.5) * laneW;

        if (Math.abs(ex - playerX) < laneW * 0.52 && Math.abs(ent.y - playerY) < 30) {
          if (ent.kind === 'cash') {
            gw.bags += 1;
            gw.combo = Math.min(8, gw.combo + 1);
            gw.score += 250 * gw.combo;
            sfx.pickup();
            for (var p = 0; p < 12; p++) {
              gw.particles.push({
                x: ex, y: ent.y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                life: 0.45,
                color: '#49f0a1'
              });
            }
            gw.entities.splice(i, 1);
            continue;
          } else {
            gw.gameOver = true;
            gw.running = false;
            gw.best = Math.max(gw.best, gw.score);
            sfx.crash();
            for (var c = 0; c < 22; c++) {
              gw.particles.push({
                x: playerX, y: playerY,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220,
                life: 0.65,
                color: c % 2 ? '#ff5d6c' : '#ebb858'
              });
            }
          }
        }
        if (ent.y > h + 50) gw.entities.splice(i, 1);
      }
    }

    /* Draw City Shoulders + Neon Highway */
    var shoulderGrad = ctx.createLinearGradient(0, 0, 0, h);
    shoulderGrad.addColorStop(0, '#070b16');
    shoulderGrad.addColorStop(1, '#04060c');
    ctx.fillStyle = shoulderGrad;
    ctx.fillRect(0, 0, w, h);

    var scrollPx = (now * (gw.running && !gw.gameOver ? gw.speed * 0.65 : 95) * 0.001) * 60;
    if (roadLeft > 24) {
      for (var sb = -1; sb < 5; sb++) {
        var by = ((sb * 68 + scrollPx * 2.2) % (h + 80)) - 68;
        var bwL = Math.max(16, roadLeft - 22);
        ctx.fillStyle = '#0a101d';
        ctx.strokeStyle = 'rgba(56,189,248,0.12)';
        ctx.lineWidth = 1;
        ctx.fillRect(6, by, bwL, 56);
        ctx.strokeRect(6, by, bwL, 56);
        ctx.fillRect(roadLeft + roadW + 16, by + 18, bwL, 52);
        ctx.strokeRect(roadLeft + roadW + 16, by + 18, bwL, 52);
        ctx.fillStyle = (sb % 2 === 0) ? 'rgba(235,184,88,0.28)' : 'rgba(57,231,163,0.22)';
        for (var wx = 12; wx < bwL - 8; wx += 14) {
          ctx.fillRect(wx, by + 10, 6, 8);
          ctx.fillRect(wx, by + 28, 6, 8);
          ctx.fillRect(roadLeft + roadW + 14 + wx, by + 28, 6, 8);
        }
      }
    }

    /* Wet Asphalt Highway Deck */
    var asphalt = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadW, 0);
    asphalt.addColorStop(0, '#0b1220');
    asphalt.addColorStop(0.22, '#111b2f');
    asphalt.addColorStop(0.5, '#15223b');
    asphalt.addColorStop(0.78, '#111b2f');
    asphalt.addColorStop(1, '#0b1220');
    ctx.fillStyle = asphalt;
    ctx.fillRect(roadLeft, 0, roadW, h);

    /* Passing Golden Streetlamps */
    for (var lp = -1; lp < 5; lp++) {
      var lampY = ((lp * 74 + scrollPx * 4.4) % (h + 74)) - 37;
      var lPoolL = ctx.createRadialGradient(roadLeft - 6, lampY, 2, roadLeft - 6, lampY, 34);
      lPoolL.addColorStop(0, 'rgba(235,184,88,0.32)');
      lPoolL.addColorStop(1, 'rgba(235,184,88,0)');
      ctx.fillStyle = lPoolL;
      ctx.beginPath(); ctx.arc(roadLeft - 6, lampY, 34, 0, Math.PI * 2); ctx.fill();

      var lPoolR = ctx.createRadialGradient(roadLeft + roadW + 6, lampY, 2, roadLeft + roadW + 6, lampY, 34);
      lPoolR.addColorStop(0, 'rgba(235,184,88,0.32)');
      lPoolR.addColorStop(1, 'rgba(235,184,88,0)');
      ctx.fillStyle = lPoolR;
      ctx.beginPath(); ctx.arc(roadLeft + roadW + 6, lampY, 34, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(roadLeft - 9, lampY - 2, 4, 4);
      ctx.fillRect(roadLeft + roadW + 5, lampY - 2, 4, 4);
    }

    /* Curb Rumble Strips + Brass Guardrails */
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, h);
    ctx.moveTo(roadLeft + roadW, 0); ctx.lineTo(roadLeft + roadW, h);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224,78,58,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -(scrollPx * 4.4) % 24;
    ctx.beginPath();
    ctx.moveTo(roadLeft + 3, 0); ctx.lineTo(roadLeft + 3, h);
    ctx.moveTo(roadLeft + roadW - 3, 0); ctx.lineTo(roadLeft + roadW - 3, h);
    ctx.stroke();

    /* Lane Markers */
    ctx.strokeStyle = 'rgba(148,163,184,0.38)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    ctx.lineDashOffset = -(scrollPx * 4.4) % 32;
    for (var l = 1; l <= 3; l++) {
      ctx.beginPath();
      ctx.moveTo(roadLeft + laneW * l, 0);
      ctx.lineTo(roadLeft + laneW * l, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* Entities: Cash Briefcases & Police Interceptors */
    gw.entities.forEach(function (ent) {
      var ex = roadLeft + (ent.lane + 0.5) * laneW;
      if (ent.kind === 'cash') {
        var glow = ctx.createRadialGradient(ex, ent.y, 2, ex, ent.y, 22);
        glow.addColorStop(0, 'rgba(73,240,161,0.36)');
        glow.addColorStop(1, 'rgba(73,240,161,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(ex, ent.y, 22, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#ebb858';
        ctx.lineWidth = 2;
        ctx.strokeRect(ex - 5, ent.y - 14, 10, 4);
        ctx.fillStyle = '#0f3d26';
        ctx.strokeStyle = '#49f0a1';
        ctx.fillRect(ex - 14, ent.y - 10, 28, 20);
        ctx.strokeRect(ex - 14, ent.y - 10, 28, 20);
        ctx.fillStyle = '#49f0a1';
        ctx.font = fontStack(900, 12);
        ctx.textAlign = 'center';
        ctx.fillText('$', ex, ent.y + 4);
      } else {
        var flashRed = Math.floor(now / 110) % 2 === 0;
        var siren = ctx.createRadialGradient(ex, ent.y, 4, ex, ent.y, 34);
        siren.addColorStop(0, flashRed ? 'rgba(239,68,68,0.32)' : 'rgba(59,130,246,0.32)');
        siren.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = siren;
        ctx.beginPath(); ctx.arc(ex, ent.y, 34, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(226,232,240,0.16)';
        ctx.beginPath();
        ctx.moveTo(ex - 10, ent.y + 20); ctx.lineTo(ex - 18, ent.y + 44); ctx.lineTo(ex - 2, ent.y + 44);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ex + 10, ent.y + 20); ctx.lineTo(ex + 2, ent.y + 44); ctx.lineTo(ex + 18, ent.y + 44);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(ex - 14, ent.y - 21, 28, 42);
        ctx.strokeRect(ex - 14, ent.y - 21, 28, 42);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(ex - 12, ent.y - 8, 24, 16);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(ex - 10, ent.y + 6, 20, 8);
        ctx.fillRect(ex - 10, ent.y - 15, 20, 6);
        ctx.fillStyle = flashRed ? '#ef4444' : '#3b82f6';
        ctx.fillRect(ex - 11, ent.y - 3, 11, 5);
        ctx.fillStyle = flashRed ? '#3b82f6' : '#ef4444';
        ctx.fillRect(ex, ent.y - 3, 11, 5);
      }
    });

    /* Player Noir GT Sports Coupe */
    var px = roadLeft + (gw.lane + 0.5) * laneW;
    var py = h - 44;
    var tilt = (gw.targetLane - gw.lane) * 0.14;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);

    var beamL = ctx.createLinearGradient(0, -22, 0, -82);
    beamL.addColorStop(0, 'rgba(254,240,138,0.32)');
    beamL.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.fillStyle = beamL;
    ctx.beginPath();
    ctx.moveTo(-11, -22); ctx.lineTo(-24, -82); ctx.lineTo(-2, -82);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -22); ctx.lineTo(2, -82); ctx.lineTo(24, -82);
    ctx.closePath(); ctx.fill();

    var flameLen = (gw.boosting && gw.nitro > 0) ? (16 + Math.sin(now * 0.05) * 6) : (7 + Math.sin(now * 0.03) * 2.5);
    ctx.fillStyle = (gw.boosting && gw.nitro > 0) ? '#38bdf8' : '#ebb858';
    ctx.beginPath();
    ctx.moveTo(-9, 22); ctx.lineTo(-6, 22 + flameLen); ctx.lineTo(-3, 22);
    ctx.moveTo(3, 22); ctx.lineTo(6, 22 + flameLen); ctx.lineTo(9, 22);
    ctx.fill();

    ctx.shadowColor = '#39e7a3';
    ctx.shadowBlur = gw.boosting ? 20 : 10;
    var carGrad = ctx.createLinearGradient(-14, -22, 14, 22);
    carGrad.addColorStop(0, '#10b981');
    carGrad.addColorStop(0.5, '#39e7a3');
    carGrad.addColorStop(1, '#059669');
    ctx.fillStyle = carGrad;
    ctx.fillRect(-14, -22, 28, 44);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#05070c';
    ctx.fillRect(-16, -16, 3, 10);
    ctx.fillRect(13, -16, 3, 10);
    ctx.fillRect(-16, 8, 3, 10);
    ctx.fillRect(13, 8, 3, 10);

    ctx.fillStyle = '#ebb858';
    ctx.fillRect(-2, -22, 4, 44);
    ctx.fillStyle = '#06110c';
    ctx.fillRect(-10, -10, 20, 16);
    ctx.fillStyle = 'rgba(124,196,255,0.22)';
    ctx.fillRect(-9, -9, 18, 5);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-12, -22, 7, 3);
    ctx.fillRect(5, -22, 7, 3);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-12, 19, 24, 3);
    ctx.restore();

    /* Particles */
    for (var pi = gw.particles.length - 1; pi >= 0; pi--) {
      var pt = gw.particles[pi];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) { gw.particles.splice(pi, 1); continue; }
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Arcade HUD Overlays */
    ctx.fillStyle = 'rgba(7,10,16,0.84)';
    ctx.fillRect(10, 10, 174, 54);
    ctx.strokeStyle = 'rgba(235,184,88,0.48)';
    ctx.strokeRect(10, 10, 174, 54);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.fillText((ar ? 'النقاط: ' : 'SCORE: ') + gw.score, 18, 28);
    ctx.fillStyle = '#49f0a1';
    ctx.fillText((ar ? 'حقائب: ' : 'LOOT BAGS: ') + gw.bags + '  (x' + gw.combo + ')', 18, 46);

    if (w > 360) {
      var mph = Math.round((gw.running && !gw.gameOver ? gw.speed : 0) * (gw.boosting ? 0.62 : 0.44));
      ctx.fillStyle = 'rgba(7,10,16,0.84)';
      ctx.fillRect(w - 146, 10, 136, 54);
      ctx.strokeStyle = 'rgba(57,231,163,0.42)';
      ctx.strokeRect(w - 146, 10, 136, 54);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontStack(900, 12);
      ctx.fillText(mph + (ar ? ' كم/س' : ' MPH'), w - 18, 28);
      ctx.fillStyle = '#141e30';
      ctx.fillRect(w - 136, 38, 118, 8);
      ctx.fillStyle = gw.boosting ? '#38bdf8' : '#39e7a3';
      ctx.fillRect(w - 136, 38, Math.round(1.18 * gw.nitro), 8);
    }

    if (gw.gameOver || !gw.running) {
      ctx.fillStyle = 'rgba(5,8,14,0.78)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = gw.gameOver ? '#ff6a55' : '#ebb858';
      ctx.font = fontStack(900, 19);
      ctx.fillText(
        gw.gameOver
          ? (ar ? 'طوّقتك الدوريات' : 'ROADBLOCK IMPACT')
          : (ar ? 'مطاردة النيون الليلية' : 'NITRO SYNDICATE GETAWAY'),
        w * 0.5,
        h * 0.43,
        Math.max(160, w - 28)
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.font = fontStack(700, 12);
      ctx.fillText(
        gw.gameOver
          ? (ar ? 'النتيجة: ' + gw.score + ' · الحقائب: ' + gw.bags + ' · اضغط للانطلاق مجدداً' : 'Score: ' + gw.score + ' · Bags: ' + gw.bags + ' · Tap canvas to ride again')
          : (ar ? 'اضغط على أي مسار للانطلاق ومراوغة الشرطة' : 'Tap any lane or press Arrow Keys to launch'),
        w * 0.5,
        h * 0.58,
        Math.max(160, w - 28)
      );
    }
  }

  function drawVectorReticle(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color || '#ebb858';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r - 2.5, cy); ctx.lineTo(cx - r * 0.45, cy);
    ctx.moveTo(cx + r * 0.45, cy); ctx.lineTo(cx + r + 2.5, cy);
    ctx.moveTo(cx, cy - r - 2.5); ctx.lineTo(cx, cy - r * 0.45);
    ctx.moveTo(cx, cy + r * 0.45); ctx.lineTo(cx, cy + r + 2.5);
    ctx.stroke();
    ctx.fillStyle = '#39e7a3';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function renderCrimesGame(dt, now) {
    var cv = document.getElementById('zig-heist-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 228);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var hs = state.heist;
    var ar = isAr();

    hs.angle = (hs.angle + hs.speed * hs.dir * dt) % (Math.PI * 2);

    /* Deep Noir Vault Base + Darkened UE5 Safe-Crack Key-Art (0.28 alpha) */
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.28;
    var drewHeistArt = drawCoverArt(ctx, artImages.heist, w, h, 0, 0, 1.04);
    ctx.restore();

    var grad = ctx.createRadialGradient(w * 0.5, h * 0.52, 18, w * 0.5, h * 0.52, w * 0.68);
    grad.addColorStop(0, drewHeistArt ? 'rgba(13, 20, 34, 0.38)' : '#131d2e');
    grad.addColorStop(1, 'rgba(6, 9, 16, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (now < hs.sirenUntil) {
      var redPulse = Math.floor(now / 110) % 2 === 0;
      ctx.fillStyle = redPulse ? 'rgba(239,68,68,0.16)' : 'rgba(59,130,246,0.16)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = 'rgba(124,196,255,0.16)';
    ctx.lineWidth = 1;
    hs.rain.forEach(function (r) {
      r.y += r.spd * dt * 1.3;
      if (r.y > 1) { r.y = -0.05; r.x = Math.random(); }
      var rx = r.x * w, ry = r.y * h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + r.len);
      ctx.stroke();
    });

    /* Vault Dial Geometry */
    var cx = w * 0.5, cy = h * 0.52, radius = Math.min(72, h * 0.34);

    /* Outer brass bezel */
    ctx.strokeStyle = 'rgba(235,184,88,0.34)';
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

    /* Tick marks */
    for (var ti = 0; ti < 36; ti++) {
      var ta = (ti / 36) * Math.PI * 2;
      var inner = radius - (ti % 3 === 0 ? 15 : 11);
      ctx.strokeStyle = ti % 3 === 0 ? 'rgba(235,184,88,0.68)' : 'rgba(148,163,184,0.30)';
      ctx.lineWidth = ti % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * inner, cy + Math.sin(ta) * inner);
      ctx.lineTo(cx + Math.cos(ta) * (radius - 7), cy + Math.sin(ta) * (radius - 7));
      ctx.stroke();
    }

    /* Target Sweet-Spot Arc */
    ctx.save();
    ctx.strokeStyle = '#ebb858';
    ctx.shadowColor = '#ebb858';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.5, hs.targetCenter + hs.targetArc * 0.5);
    ctx.stroke();

    /* Bullseye Core */
    ctx.strokeStyle = '#49f0a1';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, hs.targetCenter - hs.targetArc * 0.16, hs.targetCenter + hs.targetArc * 0.16);
    ctx.stroke();
    ctx.restore();

    /* Sweeping Lockpick Needle */
    var nx = cx + Math.cos(hs.angle) * (radius + 6);
    var ny = cy + Math.sin(hs.angle) * (radius + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    ctx.fillStyle = '#39e7a3';
    ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();

    /* Center Hub */
    ctx.fillStyle = '#0d1422';
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.textAlign = 'center';
    ctx.fillText('x' + hs.streak, cx, cy + 4);

    /* Sparks */
    for (var si = hs.sparks.length - 1; si >= 0; si--) {
      var sp = hs.sparks[si];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { hs.sparks.splice(si, 1); continue; }
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life * 1.4);
      ctx.fillRect(cx + sp.x - 2, cy + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Selected Crime Title + Vector Reticle (Zero Emoji) */
    var sel = window.__zoneLastView && window.__zoneLastView.crimeDesk && window.__zoneLastView.crimeDesk.selected;
    var targetName = sel ? sel.name : (ar ? 'خزنة الهدف' : 'TARGET VAULT');
    drawVectorReticle(ctx, 18, 16, 5.2, '#ebb858');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ebb858';
    ctx.font = fontStack(800, 11);
    ctx.fillText((ar ? 'الهدف: ' : 'TARGET: ') + targetName, 30, 20, Math.max(90, w * 0.52));

    if (w > 340) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = fontStack(700, 10.5);
      ctx.fillText(ar ? 'اضغط أو [Space] في القوس الذهبي' : 'CLICK OR [SPACE] IN GOLD ARC', w - 12, 20, w * 0.44);
    }

    if (now < hs.bannerUntil && hs.banner) {
      ctx.textAlign = 'center';
      ctx.fillStyle = hs.bannerColor;
      ctx.font = fontStack(800, 12.5);
      ctx.fillText(hs.banner, cx, h - 10, Math.max(140, w - 24));
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = fontStack(700, 11.5);
      ctx.fillText(
        ar ? 'اضرب القفل في القوس الذهبي لتنفيذ العملية' : 'Strike inside the golden arc to breach vault',
        cx,
        h - 10,
        Math.max(140, w - 24)
      );
    }
  }

  function renderGymGame(dt, now) {
    var cv = document.getElementById('zig-gym-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 196);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var gm = state.gym;
    var ar = isAr();

    /* Pendulum spring physics for Heavy Bag recoil */
    var spring = -26 * gm.bagAngle - 4.2 * gm.bagVel;
    gm.bagVel += spring * dt;
    gm.bagAngle += gm.bagVel * dt;

    /* Oscillating Power Sweet-Spot Cursor */
    gm.gaugePos += gm.gaugeDir * dt * 1.15;
    if (gm.gaugePos >= 1) { gm.gaugePos = 1; gm.gaugeDir = -1; }
    if (gm.gaugePos <= 0) { gm.gaugePos = 0; gm.gaugeDir = 1; }

    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, w, h);

    /* Photorealistic UE5 Heavy-Bag Plate with Physical Impact Recoil/Sway */
    var swayX = Math.sin(gm.bagAngle) * 20;
    var swayY = -Math.abs(Math.sin(gm.bagAngle)) * 4;
    var drewBagArt = drawCoverArt(ctx, artImages.heavybag, w, h, swayX, swayY, 1.10);

    if (!drewBagArt) {
      var bg = ctx.createRadialGradient(w * 0.5, 24, 10, w * 0.5, h * 0.55, w * 0.65);
      bg.addColorStop(0, '#1c2538');
      bg.addColorStop(1, '#070b12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    /* Studio Rim + Bottom Legibility Scrim for Power Gauge */
    var scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, 'rgba(6, 9, 15, 0.24)');
    scrim.addColorStop(0.54, 'rgba(6, 9, 15, 0.18)');
    scrim.addColorStop(0.78, 'rgba(6, 9, 15, 0.78)');
    scrim.addColorStop(1, 'rgba(5, 8, 14, 0.95)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    /* Subtle Golden Target Strike Crosshair on Bag Center */
    var impactX = w * 0.5 + swayX;
    var impactY = h * 0.42 + swayY;
    ctx.save();
    ctx.strokeStyle = 'rgba(235, 184, 88, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* Shockwave Rings */
    for (var ri = gm.rings.length - 1; ri >= 0; ri--) {
      var rg = gm.rings[ri];
      rg.r += dt * 150;
      rg.alpha -= dt * 1.9;
      if (rg.alpha <= 0) { gm.rings.splice(ri, 1); continue; }
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = Math.max(0, rg.alpha);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(impactX, impactY, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* Sparks */
    for (var si = gm.sparks.length - 1; si >= 0; si--) {
      var sp = gm.sparks[si];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) { gm.sparks.splice(si, 1); continue; }
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life * 1.5);
      ctx.fillRect(impactX + sp.x - 2, impactY + sp.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    /* Power Sweet-Spot Gauge Bar */
    var barW = Math.min(300, Math.max(120, w - 32));
    var barX = (w - barW) * 0.5;
    var barY = h - 35;
    ctx.fillStyle = 'rgba(11, 17, 29, 0.92)';
    ctx.fillRect(barX, barY, barW, 12);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 12);

    /* Center Overdrive Sweet-Spot */
    ctx.fillStyle = 'rgba(235, 184, 88, 0.88)';
    ctx.fillRect(barX + barW * 0.36, barY + 1, barW * 0.28, 10);
    ctx.fillStyle = '#39e7a3';
    ctx.fillRect(barX + barW * 0.45, barY + 1, barW * 0.10, 10);

    /* Moving Cursor */
    var curX = barX + gm.gaugePos * barW;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(curX - 2, barY - 3, 4, 18);

    /* Concise Clamped Prompt (Never Overflows Narrow 300px Gym Column) */
    var maxTxtW = Math.max(110, w - 24);
    ctx.textAlign = 'center';
    ctx.font = fontStack(700, 11);
    if (now < gm.bannerUntil && gm.banner) {
      ctx.fillStyle = gm.bannerColor;
      ctx.fillText(gm.banner, w * 0.5, h - 7, maxTxtW);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(
        ar ? 'اضغط عند المنطقة الذهبية' : 'Tap when needle hits gold zone',
        w * 0.5,
        h - 7,
        maxTxtW
      );
    }
  }

  function renderRouletteCanvas(dt, now) {
    var cv = document.getElementById('zig-roulette-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 184);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var rl = state.roulette;
    var g = window.__zoneGame;
    var rState = (g && g.rouletteTable) || {};
    var busy = Boolean(g && g.rouletteBusy);

    if (busy && !rl.spinning) startRouletteAnimation();

    var targetPocket = (rState.pocket !== undefined && rState.pocket !== null) ? Number(rState.pocket) : 0;
    var pocketIdx = Math.max(0, EU_WHEEL.indexOf(targetPocket));
    var slice = (Math.PI * 2) / 37;

    if (rl.spinning && !busy) {
      rl.spinning = false;
      rl.settling = true;
      rl.highlightUntil = now + 2600;
    }

    if (rl.spinning) {
      rl.wheelAngle = (rl.wheelAngle + rl.wheelSpeed * dt) % (Math.PI * 2);
      rl.ballAngle = (rl.ballAngle + rl.ballSpeed * dt) % (Math.PI * 2);
      var tickIdx = Math.floor((((rl.ballAngle - rl.wheelAngle) % (Math.PI * 2)) + Math.PI * 2) / slice);
      if (tickIdx !== rl.lastTickIdx) {
        rl.lastTickIdx = tickIdx;
        sfx.wheelTick();
      }
    } else if (rl.settling) {
      rl.wheelSpeed = Math.max(0.28, rl.wheelSpeed * (1 - dt * 1.8));
      rl.wheelAngle = (rl.wheelAngle + rl.wheelSpeed * dt) % (Math.PI * 2);
      var desiredBallAngle = rl.wheelAngle + (pocketIdx + 0.5) * slice;
      var delta = Math.atan2(Math.sin(desiredBallAngle - rl.ballAngle), Math.cos(desiredBallAngle - rl.ballAngle));
      rl.ballAngle += delta * Math.min(1, dt * 8.5);
      rl.ballRadiusFrac += (0.67 - rl.ballRadiusFrac) * Math.min(1, dt * 6);
      if (Math.abs(delta) < 0.03 && Math.abs(rl.ballRadiusFrac - 0.67) < 0.02) {
        rl.settling = false;
        sfx.breachWin();
      }
    } else {
      rl.wheelAngle = (rl.wheelAngle + 0.24 * dt) % (Math.PI * 2);
      rl.ballAngle = rl.wheelAngle + (pocketIdx + 0.5) * slice;
      rl.ballRadiusFrac = 0.67;
    }

    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.5, cy = h * 0.5, outerR = Math.min(78, h * 0.43);

    /* Mahogany Outer Bowl */
    ctx.fillStyle = '#2b140d';
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* 37 Numbered Pockets */
    for (var i = 0; i < 37; i++) {
      var num = EU_WHEEL[i];
      var a0 = rl.wheelAngle + i * slice;
      var a1 = a0 + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = num === 0 ? '#158046' : (RED_POCKETS[num] ? '#b82921' : '#121824');
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,184,88,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (i === pocketIdx && now < rl.highlightUntil) {
        ctx.save();
        ctx.strokeStyle = '#49f0a1';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, outerR - 2, a0, a1); ctx.stroke();
        ctx.restore();
      }
    }

    /* Inner Brass Cone */
    var coneGrad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, outerR * 0.52);
    coneGrad.addColorStop(0, '#f7d586');
    coneGrad.addColorStop(0.55, '#9b6b1b');
    coneGrad.addColorStop(1, '#1a1209');
    ctx.fillStyle = coneGrad;
    ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.50, 0, Math.PI * 2); ctx.fill();

    /* Center Winning Pocket Readout */
    ctx.fillStyle = '#090d14';
    ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = fontStack(900, 13);
    ctx.textAlign = 'center';
    ctx.fillText(rl.spinning ? '..' : String(targetPocket), cx, cy + 5);

    /* Gleaming Ivory Ball */
    var bx = cx + Math.cos(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    var by = cy + Math.sin(rl.ballAngle) * (outerR * rl.ballRadiusFrac);
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(bx, by, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSlotSymbol(ctx, sym, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    if (sym.kind === 'diamond') {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, -9); ctx.lineTo(8, -9); ctx.lineTo(12, -3); ctx.lineTo(0, 11); ctx.lineTo(-12, -3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#bae6fd';
      ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.stroke();
    } else if (sym.kind === 'seven') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#dc2626';
      ctx.font = fontStack(900, 18);
      ctx.fillText('777', 0, 6);
    } else if (sym.kind === 'crown') {
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-11, 7); ctx.lineTo(-12, -6); ctx.lineTo(-5, 0); ctx.lineTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(12, -6); ctx.lineTo(11, 7);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (sym.kind === 'bullion') {
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, -6); ctx.lineTo(9, -6); ctx.lineTo(12, 6); ctx.lineTo(-12, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-6, -3, 12, 3);
    } else if (sym.kind === 'spade') {
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.bezierCurveTo(10, -2, 11, 5, 4, 6);
      ctx.lineTo(2, 6); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-2, 6); ctx.lineTo(-4, 6);
      ctx.bezierCurveTo(-11, 5, -10, -2, 0, -10);
      ctx.fill();
    } else {
      ctx.fillStyle = '#e11d48';
      ctx.strokeStyle = '#881337';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-4.5, 3, 5, 0, Math.PI * 2);
      ctx.arc(4.5, 4, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, -2); ctx.quadraticCurveTo(0, -10, 3, -9);
      ctx.moveTo(4, -1); ctx.quadraticCurveTo(2, -8, 3, -9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderSlotsCanvas(dt, now) {
    var cv = document.getElementById('zig-slots-canvas');
    if (!cv) return;
    var s = syncCanvas(cv, 184);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var sl = state.slots;
    var g = window.__zoneGame;
    var sState = (g && g.slotsTable) || {};
    var busy = Boolean(g && g.slotsBusy);
    var reelsRaw = Array.isArray(sState.reels) && sState.reels.length === 3 ? sState.reels : ['SEVEN', 'CROWN', 'DIAMOND'];

    if (busy && !sl.spinning) startSlotsAnimation();

    for (var t = 0; t < 3; t++) {
      var idx = SLOT_SYMS.findIndex(function (x) { return x.id === reelsRaw[t]; });
      sl.targets[t] = idx >= 0 ? idx : 0;
    }

    var elapsed = (now - sl.spinStart) / 1000;
    if (sl.spinning) {
      for (var r = 0; r < 3; r++) {
        if (!sl.locked[r]) {
          sl.offsets[r] = (sl.offsets[r] + sl.speeds[r] * dt) % SLOT_SYMS.length;
          if (!busy && elapsed > 0.42 + r * 0.28) {
            sl.locked[r] = true;
            sl.offsets[r] = sl.targets[r];
            sfx.reelClunk();
            if (r === 2) {
              sl.spinning = false;
              if (sState.result === 'win') {
                sfx.jackpot();
                for (var ci = 0; ci < 26; ci++) {
                  sl.coins.push({
                    x: w * (0.2 + Math.random() * 0.6),
                    y: h * 0.5,
                    vx: (Math.random() - 0.5) * 180,
                    vy: -110 - Math.random() * 120,
                    life: 1.0
                  });
                }
              }
            }
          }
        }
      }
    } else {
      for (var k = 0; k < 3; k++) sl.offsets[k] = sl.targets[k];
    }

    sl.leverPull = Math.max(0, sl.leverPull - dt * 2.6);

    ctx.clearRect(0, 0, w, h);
    var cabW = Math.min(w - 34, 290);
    var cabX = (w - cabW) * 0.5 - 6;
    var cabY = 14, cabH = h - 28;

    /* Brass & Obsidian Slot Cabinet */
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cabX, cabY, cabW, cabH);
    ctx.strokeStyle = '#ebb858';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cabX, cabY, cabW, cabH);

    var reelGap = 8;
    var reelW = (cabW - reelGap * 4) / 3;
    var reelH = cabH - 20;

    for (var ri = 0; ri < 3; ri++) {
      var rx = cabX + reelGap + ri * (reelW + reelGap);
      var ry = cabY + 10;

      var drumGrad = ctx.createLinearGradient(rx, ry, rx, ry + reelH);
      drumGrad.addColorStop(0, '#0f172a');
      drumGrad.addColorStop(0.5, '#f8fafc');
      drumGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = drumGrad;
      ctx.fillRect(rx, ry, reelW, reelH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, reelW, reelH);
      ctx.clip();

      var baseIdx = Math.floor(sl.offsets[ri]);
      var frac = sl.offsets[ri] - baseIdx;

      for (var row = -1; row <= 1; row++) {
        var symIdx = (baseIdx + row + SLOT_SYMS.length) % SLOT_SYMS.length;
        var sym = SLOT_SYMS[symIdx];
        var sy = ry + reelH * 0.5 + (row - frac) * 44;
        drawSlotSymbol(ctx, sym, rx + reelW * 0.5, sy);
      }
      ctx.restore();

      ctx.strokeStyle = sl.locked[ri] ? '#ebb858' : '#39e7a3';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(rx, ry, reelW, reelH);
    }

    /* Laser Payline */
    ctx.strokeStyle = sState.result === 'win' && !sl.spinning ? '#49f0a1' : 'rgba(239,68,68,0.65)';
    ctx.lineWidth = sState.result === 'win' && !sl.spinning ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cabX + 3, cabY + cabH * 0.5);
    ctx.lineTo(cabX + cabW - 3, cabY + cabH * 0.5);
    ctx.stroke();

    /* Mechanical Side Lever */
    var lx = cabX + cabW + 10;
    var topY = cabY + 22 + sl.leverPull * 56;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cabX + cabW, cabY + cabH * 0.65);
    ctx.lineTo(lx, cabY + cabH * 0.65);
    ctx.lineTo(lx, topY);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(lx, topY, 7, 0, Math.PI * 2); ctx.fill();

    /* Gold Coin Shower on Win */
    for (var cIdx = sl.coins.length - 1; cIdx >= 0; cIdx--) {
      var cn = sl.coins[cIdx];
      cn.vy += 320 * dt;
      cn.x += cn.vx * dt;
      cn.y += cn.vy * dt;
      cn.life -= dt;
      if (cn.life <= 0) { sl.coins.splice(cIdx, 1); continue; }
      ctx.fillStyle = '#ebb858';
      ctx.beginPath(); ctx.arc(cn.x, cn.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------------- Global Syndicate Flight Bar & Map Bridge (Zero Emojis) ---------------- */
  var WORLD_FLIGHT_CITIES = [
    { id: 'zone', code: 'ZCT', minLevel: 1, fare: 0, en: 'Zone City', ar: 'مدينة زون', subEn: 'Home Turf · 5 Sectors', subAr: 'المركز الرئيسي · 5 قطاعات' },
    { id: 'riyadh', code: 'RUH', minLevel: 1, fare: 1200, en: 'Riyadh', ar: 'الرياض', subEn: 'Bullion Desk · $1,200', subAr: 'مكتب السبائك · $1,200' },
    { id: 'cairo', code: 'CAI', minLevel: 1, fare: 950, en: 'Cairo', ar: 'القاهرة', subEn: 'Shadow Bazaar · $950', subAr: 'بازار النيل · $950' },
    { id: 'dubai', code: 'DXB', minLevel: 3, fare: 2400, en: 'Dubai', ar: 'دبي', subEn: 'Sky-Vaults · Lv.3', subAr: 'خزائن المارينا · مستوى 3' },
    { id: 'istanbul', code: 'IST', minLevel: 6, fare: 3500, en: 'Istanbul', ar: 'إسطنبول', subEn: 'Bosphorus Hub · Lv.6', subAr: 'مضيق البسفور · مستوى 6' },
    { id: 'tokyo', code: 'TYO', minLevel: 10, fare: 6800, en: 'Neo-Tokyo', ar: 'نيو طوكيو', subEn: 'Cyber District · Lv.10', subAr: 'حي شيبويا · مستوى 10' },
    { id: 'montecarlo', code: 'MCO', minLevel: 15, fare: 12500, en: 'Monte Carlo', ar: 'مونت كارلو', subEn: 'Sovereign Salon · Lv.15', subAr: 'صالون النخبة · مستوى 15' }
  ];

  function getStoredWorldCity() {
    var g = window.__zoneGame;
    if (g && g.p && g.p.worldCityId) return g.p.worldCityId;
    try { return localStorage.getItem('zone_world_city') || 'zone'; } catch (_) { return 'zone'; }
  }

  function mountCityWorldFlightBar() {
    ensureMotionStyles();
    var main = document.getElementById('zone-main');
    if (!main || main.getAttribute('data-zone-screen') !== 'city') return;
    var mapShell = main.querySelector('.zone-city-map-shell');
    if (!mapShell || !mapShell.parentElement) return;

    var ar = isAr();
    var g = window.__zoneGame;
    var lv = (g && g.p && Number(g.p.level)) ? Math.max(1, Math.floor(Number(g.p.level))) : 1;
    var activeCityId = getStoredWorldCity();
    var sig = (ar ? 'ar' : 'en') + ':' + lv + ':' + activeCityId;

    var workspace = mapShell.closest('.zone-city-workspace') || mapShell;
    if (!workspace.parentElement) return;

    var bar = document.getElementById('zig-world-flight-bar');
    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'zig-world-flight-bar';
      bar.className = 'zig-world-flight-bar';
      workspace.parentElement.insertBefore(bar, workspace);
    } else if (bar.parentElement !== workspace.parentElement) {
      workspace.parentElement.insertBefore(bar, workspace);
    }
    if (bar.getAttribute('data-sig') === sig) return;
    bar.setAttribute('data-sig', sig);

    var curObj = WORLD_FLIGHT_CITIES.find(function (c) { return c.id === activeCityId; }) || WORLD_FLIGHT_CITIES[0];

    bar.innerHTML =
      '<div class="zig-world-flight-top">' +
        '<div class="zig-world-flight-title">' +
          SVG_PLANE +
          '<span>' + (ar ? 'الرحلات العالمية' : 'World Flights') + '</span>' +
          '<span class="zig-world-origin-pill">' + (ar ? curObj.ar : curObj.en) + '</span>' +
        '</div>' +
        '<div class="zig-world-flight-meta">' +
          '<span class="zig-world-lv-pill">' + (ar ? 'مستوى ' : 'Lv.') + lv + '</span>' +
          '<button type="button" class="zig-btn" id="zigOpenRadarBtn">' + (ar ? 'رادار الرحلات' : 'Flight Radar') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="zig-world-cities-row">' +
        WORLD_FLIGHT_CITIES.map(function (c) {
          var isHere = c.id === activeCityId;
          var locked = lv < c.minLevel;
          var rightBadge = isHere
            ? '<span class="zig-here-dot" aria-hidden="true"></span>'
            : locked
              ? ('<span class="zig-chip-status">' + SVG_LOCK + '<span>Lv.' + c.minLevel + '</span></span>')
              : '<span>' + c.code + '</span>';
          return (
            '<button type="button" class="zig-city-chip zig-flight-card' + (isHere ? ' is-active' : '') + (locked ? ' is-locked' : '') + '" data-world-city="' + c.id + '">' +
              '<div class="zig-city-chip-top">' +
                '<span>' + (ar ? c.ar : c.en) + '</span>' +
                rightBadge +
              '</div>' +
              '<div class="zig-city-chip-sub">' + (ar ? c.subAr : c.subEn) + '</div>' +
            '</button>'
          );
        }).join('') +
      '</div>';

    var radarBtn = bar.querySelector('#zigOpenRadarBtn');
    if (radarBtn) {
      radarBtn.onclick = function () {
        var frame = document.getElementById('zone-city-map');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'ZONE_OPEN_WORLD_CITIES' }, window.location.origin);
        }
      };
    }

    Array.from(bar.querySelectorAll('[data-world-city]')).forEach(function (chip) {
      chip.onclick = function () {
        var cid = chip.getAttribute('data-world-city');
        var target = WORLD_FLIGHT_CITIES.find(function (c) { return c.id === cid; });
        if (!target) return;
        var frame = document.getElementById('zone-city-map');
        if (lv < target.minLevel || cid === activeCityId) {
          if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'ZONE_OPEN_WORLD_CITIES' }, window.location.origin);
          }
          return;
        }
        if (g && g.p) {
          if (Number(g.p.cash || 0) < target.fare) {
            if (g.toast) g.toast(ar ? 'رصيدك غير كافٍ لتذكرة السفر.' : 'Not enough cash for charter ticket.', true);
            return;
          }
          g.p.cash = Math.max(0, Number(g.p.cash || 0) - target.fare);
          g.p.xp = Number(g.p.xp || 0) + 35;
          if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
          g.p.worldCityId = target.id;
          g.p.city = ar ? target.ar : target.en;
          try { localStorage.setItem('zone_world_city', target.id); } catch (_) {}
          if (g.playTacticalSfx) g.playTacticalSfx('good');
          if (g.save) g.save();
          g._mapSig = '';
          if (g.pushMap) g.pushMap();
          if (g.toast) g.toast((ar ? 'وصلت إلى ' : 'Landed in ') + (ar ? target.ar : target.en) + ' (' + target.code + ') · +35 XP');
          if (g.forceUpdate) g.forceUpdate();
        } else {
          try { localStorage.setItem('zone_world_city', target.id); } catch (_) {}
        }
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'ZONE_SYNC_WORLD_CITY', cityId: target.id }, window.location.origin);
        }
        bar.removeAttribute('data-sig');
        mountCityWorldFlightBar();
      };
    });
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin || !ev.data || ev.data.type !== 'ZONE_WORLD_TRAVEL') return;
    var d = ev.data;
    var g = window.__zoneGame;
    var ar = isAr();
    if (d.action === 'fly' && d.cityId) {
      try { localStorage.setItem('zone_world_city', d.cityId); } catch (_) {}
      if (g && g.p) {
        g.p.cash = Math.max(0, Number(g.p.cash || 0) - Number(d.fare || 0));
        g.p.xp = Number(g.p.xp || 0) + Number(d.xpDelta || 35);
        if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
        g.p.worldCityId = d.cityId;
        g.p.city = d.cityName || d.cityId;
        if (g.playTacticalSfx) g.playTacticalSfx('good');
        if (g.save) g.save();
        g._mapSig = '';
        if (g.pushMap) g.pushMap();
        if (g.toast) g.toast((ar ? 'هبطت الطائرة في ' : 'Charter landed in ') + (d.cityName || d.cityId) + ' · +' + Number(d.xpDelta || 35) + ' XP');
        if (g.forceUpdate) g.forceUpdate();
      }
      var bar = document.getElementById('zig-world-flight-bar');
      if (bar) bar.removeAttribute('data-sig');
      mountCityWorldFlightBar();
    } else if (d.action === 'contract') {
      if (g && g.p) {
        g.p.cash = Number(g.p.cash || 0) + Number(d.cashDelta || 0);
        g.p.xp = Number(g.p.xp || 0) + Number(d.xpDelta || 0);
        if (g.p.xp >= Number(g.p.level || 1) * 250) g.p.level = Number(g.p.level || 1) + 1;
        if (g.playTacticalSfx) g.playTacticalSfx('cash');
        if (g.save) g.save();
        g._mapSig = '';
        if (g.pushMap) g.pushMap();
        if (g.toast) g.toast((d.contractLabel || 'Regional Op') + ' · +$' + Number(d.cashDelta || 0).toLocaleString('en-US') + ' & +' + Number(d.xpDelta || 0) + ' XP');
        if (g.forceUpdate) g.forceUpdate();
      }
    }
  });

  window.addEventListener('zone:mute-change', function (ev) {
    try {
      var muted = ev && ev.detail ? Boolean(ev.detail.muted) : (localStorage.getItem('zig_muted') === '1');
      soundEnabled = !muted;
      var sndBtn = document.getElementById('zig-sound-toggle');
      if (sndBtn) {
        sndBtn.setAttribute('data-zig-muted', soundEnabled ? '0' : '1');
        sndBtn.innerHTML = renderSoundBtnInner(isAr());
      }
    } catch (_) {}
  });

  /* ---------------- Demand-Driven 60fps Loop & Scoped #zone-main Observer ---------------- */
  var canvasIo = null;
  var observedCanvases = typeof WeakSet === 'function' ? new WeakSet() : null;

  function ensureCanvasIntersectionObserver() {
    if (canvasIo || typeof IntersectionObserver !== 'function') return canvasIo;
    try {
      canvasIo = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var ent = entries[i];
          var id = ent.target && ent.target.id;
          if (id) {
            state.canvasVisibility[id] = Boolean(ent.isIntersecting);
          }
        }
        ensureLoopRunning();
      }, { threshold: 0.01 });
    } catch (_) {
      canvasIo = null;
    }
    return canvasIo;
  }

  function observeInteractiveCanvas(cv) {
    if (!cv || !cv.id) return;
    if (!Object.prototype.hasOwnProperty.call(state.canvasVisibility, cv.id)) {
      state.canvasVisibility[cv.id] = !cv.closest('[hidden]');
    }
    if (observedCanvases && observedCanvases.has(cv)) return;
    if (observedCanvases) observedCanvases.add(cv);
    var io = ensureCanvasIntersectionObserver();
    if (io) {
      try { io.observe(cv); } catch (_) {}
    }
  }

  function isCanvasVisible(id) {
    var el = document.getElementById(id);
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    if (Object.prototype.hasOwnProperty.call(state.canvasVisibility, id)) {
      return Boolean(state.canvasVisibility[id]);
    }
    return true;
  }

  function shouldRunLoop() {
    if (document.hidden) return false;
    var main = document.getElementById('zone-main');
    if (!main) return false;
    var scr = main.getAttribute('data-zone-screen') || 'home';
    if (scr === 'home') {
      if (state.hoveredPreviewId) return true;
      if (state.getaway.open && isCanvasVisible('zig-getaway-canvas')) return true;
      return false;
    }
    if (scr === 'crimes') {
      return isCanvasVisible('zig-heist-canvas') || isCanvasVisible('zig-crimes-canvas');
    }
    if (scr === 'gym') {
      return isCanvasVisible('zig-gym-canvas');
    }
    if (scr === 'casino') {
      return isCanvasVisible('zig-roulette-canvas') || isCanvasVisible('zig-slots-canvas');
    }
    return false;
  }

  var prevTime = 0;
  function frame(now) {
    state.rafId = 0;
    if (!shouldRunLoop()) {
      prevTime = 0;
      return;
    }
    var dt = prevTime ? Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000)) : 0.016;
    prevTime = now;
    state.rafTicks += 1;

    var main = document.getElementById('zone-main');
    var scr = main ? (main.getAttribute('data-zone-screen') || 'home') : 'home';

    if (scr === 'home') {
      if (state.hoveredPreviewId) renderHoveredHomePreview(dt, now);
      if (state.getaway.open && isCanvasVisible('zig-getaway-canvas')) renderGetawayGame(dt, now);
    } else if (scr === 'crimes') {
      renderCrimesGame(dt, now);
    } else if (scr === 'gym') {
      renderGymGame(dt, now);
    } else if (scr === 'casino') {
      if (isCanvasVisible('zig-roulette-canvas')) renderRouletteCanvas(dt, now);
      if (isCanvasVisible('zig-slots-canvas')) renderSlotsCanvas(dt, now);
    }

    if (shouldRunLoop()) {
      state.rafId = requestAnimationFrame(frame);
    } else {
      prevTime = 0;
    }
  }

  function ensureLoopRunning() {
    if (shouldRunLoop()) {
      if (!state.rafId) {
        prevTime = 0;
        state.rafId = requestAnimationFrame(frame);
      }
    } else if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
      prevTime = 0;
    }
  }

  var observedMainEl = null;
  var mainObserver = null;
  var bootObserver = null;
  var obsTimer = null;

  function scheduleSyncMounts() {
    if (obsTimer) return;
    obsTimer = setTimeout(function () {
      obsTimer = null;
      syncMounts();
    }, 36);
  }

  function bindScopedMainObserver() {
    if (document.querySelector('x-dc')) return false;
    var main = document.getElementById('zone-main');
    if (!main) return false;
    if (main !== observedMainEl) {
      observedMainEl = main;
      if (mainObserver) {
        try { mainObserver.disconnect(); } catch (_) {}
      }
      mainObserver = new MutationObserver(scheduleSyncMounts);
      mainObserver.observe(main, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['data-zone-screen']
      });
    }
    if (bootObserver) {
      try { bootObserver.disconnect(); } catch (_) {}
      bootObserver = null;
    }
    return true;
  }

  function syncMounts() {
    ensureMotionStyles();
    if (document.querySelector('x-dc')) return;
    bindScopedMainObserver();
    mountHomeArcade();
    mountCrimesGame();
    mountGymGame();
    mountCasinoGames();
    mountAttackBanner();
    mountCityWorldFlightBar();
    ensureLoopRunning();

    /* Detect cash reward deltas for arcade floating popups */
    var g = window.__zoneGame;
    if (g && g.p && Number.isFinite(Number(g.p.cash))) {
      var curCash = Number(g.p.cash);
      if (state.lastCash !== null && curCash > state.lastCash) {
        var diff = curCash - state.lastCash;
        if (diff > 0 && diff < 50000000) {
          spawnFloatingReward('+$' + diff.toLocaleString('en-US'), '#49f0a1');
        }
      }
      state.lastCash = curCash;
    }
  }

  window.addEventListener('zone:render', syncMounts);
  document.addEventListener('visibilitychange', ensureLoopRunning);

  function boot() {
    syncMounts();
    if (!bindScopedMainObserver() && document.body && typeof MutationObserver === 'function') {
      bootObserver = new MutationObserver(function () {
        if (bindScopedMainObserver()) {
          syncMounts();
        }
      });
      bootObserver.observe(document.body, { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.__zoneInstantGamesStats = {
    isLoopRunning: function () { return Boolean(state.rafId); },
    getTicks: function () { return state.rafTicks; },
    getHoveredPreviewId: function () { return state.hoveredPreviewId; }
  };
})();

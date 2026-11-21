/* ==========================================================================
 * ZONE v152 — PLAYER PROFILE PHOTO STUDIO & 0ms LIVE AVATAR SYNC
 * Runs cleanly on BOTH index.html AND account.html!
 * Exposes: window.ZoneProfileAvatar
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneProfileAvatarLoaded) return;
  window.__zoneProfileAvatarLoaded = true;

  var STORAGE_PREFIX = 'zone.v152.avatar.';
  var MAX_EXPORT_BYTES = 245000;

  /* ------------------------------------------------------------------------
   * 1. 8 CURATED ILLUSTRATED SYNDICATE PORTRAIT PRESETS (GOUACHE + INK SVGS)
   * ------------------------------------------------------------------------ */
  var PRESET_DEFS = [
    { id: 'pier4_ghost', nameEn: 'Pier 4 Ghost', nameAr: 'شبح الرصيف ٤', bg1: '#162836', bg2: '#0d1720', accent: '#38bdf8', coat: '#1e293b', skin: '#d6a887', hair: '#111827', detail: 'hood' },
    { id: 'neon_enforcer', nameEn: 'Neon Enforcer', nameAr: 'منفّذ النيون', bg1: '#2b152d', bg2: '#140c18', accent: '#f43f5e', coat: '#3f1d2b', skin: '#c68b63', hair: '#1c1917', detail: 'visor' },
    { id: 'velvet_queen', nameEn: 'Velvet Queen', nameAr: 'ملكة المخمل', bg1: '#31152b', bg2: '#170b16', accent: '#f59e0b', coat: '#581c4a', skin: '#dfb191', hair: '#27141d', detail: 'crown' },
    { id: 'crimson_viper', nameEn: 'Crimson Viper', nameAr: 'الأفعى القرمزية', bg1: '#321414', bg2: '#160909', accent: '#ef4444', coat: '#291515', skin: '#cfa07d', hair: '#0f172a', detail: 'scar' },
    { id: 'gold_financier', nameEn: 'Gold Financier', nameAr: 'المموّل الذهبي', bg1: '#2d2310', bg2: '#151108', accent: '#eab308', coat: '#1f242d', skin: '#d8aa86', hair: '#292524', detail: 'glasses' },
    { id: 'iron_chemist', nameEn: 'Iron Chemist', nameAr: 'الخيميائي الحديدي', bg1: '#102a22', bg2: '#081612', accent: '#22c55e', coat: '#1e3a2f', skin: '#ceb094', hair: '#334155', detail: 'goggles' },
    { id: 'harbor_captain', nameEn: 'Harbor Captain', nameAr: 'قبطان المرفأ', bg1: '#152438', bg2: '#0b131e', accent: '#60a5fa', coat: '#1e3a5f', skin: '#bf8a62', hair: '#3f3f46', detail: 'cap' },
    { id: 'shadow_architect', nameEn: 'Shadow Architect', nameAr: 'مهندس الظلال', bg1: '#1f1b2e', bg2: '#100e18', accent: '#a855f7', coat: '#27203d', skin: '#dab08f', hair: '#18181b', detail: 'collar' }
  ];

  function encodeSvgBase64(svg) {
    try {
      if (typeof window.btoa === 'function') {
        return 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svg)));
      }
    } catch (_) {}
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function buildPresetSvg(spec) {
    var detail = '';
    if (spec.detail === 'hood') {
      detail = '<path d="M52 118 C52 54 104 42 128 42 C152 42 204 54 204 118 L192 152 L176 92 C160 72 96 72 80 92 L64 152 Z" fill="' + spec.coat + '" stroke="#12100e" stroke-width="4.5" stroke-linejoin="round"/>';
    } else if (spec.detail === 'visor') {
      detail = '<rect x="86" y="98" width="84" height="20" rx="9" fill="' + spec.accent + '" stroke="#12100e" stroke-width="4"/><path d="M92 105 H164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>';
    } else if (spec.detail === 'crown') {
      detail = '<path d="M88 68 L104 44 L128 60 L152 44 L168 68 Z" fill="' + spec.accent + '" stroke="#12100e" stroke-width="4" stroke-linejoin="round"/>';
    } else if (spec.detail === 'scar') {
      detail = '<path d="M144 90 L154 126 M145 104 L156 101" stroke="' + spec.accent + '" stroke-width="3.6" stroke-linecap="round"/>';
    } else if (spec.detail === 'glasses') {
      detail = '<rect x="88" y="98" width="34" height="20" rx="5" fill="#1e293b" stroke="' + spec.accent + '" stroke-width="3.5"/><rect x="134" y="98" width="34" height="20" rx="5" fill="#1e293b" stroke="' + spec.accent + '" stroke-width="3.5"/><path d="M122 107 H134" stroke="' + spec.accent + '" stroke-width="3.5"/>';
    } else if (spec.detail === 'goggles') {
      detail = '<circle cx="106" cy="107" r="15" fill="#064e3b" stroke="' + spec.accent + '" stroke-width="4"/><circle cx="150" cy="107" r="15" fill="#064e3b" stroke="' + spec.accent + '" stroke-width="4"/><path d="M121 107 H135" stroke="#12100e" stroke-width="4"/>';
    } else if (spec.detail === 'cap') {
      detail = '<path d="M76 84 C84 54 172 54 180 84 Z" fill="' + spec.coat + '" stroke="#12100e" stroke-width="4.5"/><path d="M72 84 H184" stroke="' + spec.accent + '" stroke-width="6" stroke-linecap="round"/>';
    } else {
      detail = '<path d="M74 176 L96 146 L128 168 L160 146 L182 176" fill="none" stroke="' + spec.accent + '" stroke-width="4.5" stroke-linejoin="round"/>';
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">' +
      '<defs><radialGradient id="g" cx="50%" cy="38%" r="68%"><stop offset="0%" stop-color="' + spec.bg1 + '"/><stop offset="100%" stop-color="' + spec.bg2 + '"/></radialGradient></defs>' +
      '<rect width="256" height="256" rx="28" fill="url(#g)"/>' +
      '<circle cx="128" cy="116" r="86" fill="none" stroke="' + spec.accent + '" stroke-width="2.5" stroke-dasharray="10 7" opacity="0.48"/>' +
      '<path d="M44 244 C54 184 88 164 128 164 C168 164 202 184 212 244 Z" fill="' + spec.coat + '" stroke="#12100e" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M108 166 L128 214 L148 166 Z" fill="' + spec.accent + '" stroke="#12100e" stroke-width="3.8" stroke-linejoin="round"/>' +
      '<rect x="114" y="138" width="28" height="34" rx="10" fill="' + spec.skin + '" stroke="#12100e" stroke-width="4"/>' +
      '<ellipse cx="128" cy="110" rx="44" ry="50" fill="' + spec.skin + '" stroke="#12100e" stroke-width="5"/>' +
      '<path d="M84 102 C84 62 172 62 172 102 C164 82 146 76 128 76 C110 76 92 82 84 102 Z" fill="' + spec.hair + '" stroke="#12100e" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="109" cy="109" r="4.6" fill="#12100e"/><circle cx="147" cy="109" r="4.6" fill="#12100e"/>' +
      '<path d="M100 97 Q109 92 118 96 M138 96 Q147 92 156 97" fill="none" stroke="#12100e" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M114 134 Q128 141 142 133" fill="none" stroke="#12100e" stroke-width="3.8" stroke-linecap="round"/>' +
      detail +
      '<rect x="6" y="6" width="244" height="244" rx="24" fill="none" stroke="' + spec.accent + '" stroke-width="3.5" opacity="0.82"/>' +
      '</svg>'
    );
  }

  var PRESET_MAP = {};
  var PRESETS = PRESET_DEFS.map(function (spec) {
    var svg = buildPresetSvg(spec);
    var entry = {
      id: spec.id,
      nameEn: spec.nameEn,
      nameAr: spec.nameAr,
      accent: spec.accent,
      svg: svg,
      dataUrl: encodeSvgBase64(svg)
    };
    PRESET_MAP[spec.id] = entry;
    return entry;
  });

  var CAMERA_ICON_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>' +
    '<circle cx="12" cy="13" r="3.5"/>' +
    '</svg>';

  var DEFAULT_CREST_SVG =
    '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect width="64" height="64" rx="12" fill="#231f1b"/>' +
    '<circle cx="32" cy="24" r="10.5" fill="#f5b82e" stroke="#12100e" stroke-width="2.6"/>' +
    '<path d="M13 54C16 43 23 38 32 38C41 38 48 43 51 54H13Z" fill="#22b56b" stroke="#12100e" stroke-width="2.6" stroke-linejoin="round"/>' +
    '<path d="M27.5 38.5L32 47L36.5 38.5H27.5Z" fill="#e63946"/>' +
    '</svg>';

  var COPY = {
    en: {
      cameraAria: 'Upload Profile Picture',
      uploadPhoto: 'Upload Photo',
      changePhoto: 'Change Photo',
      homeTitle: 'Operative Dossier Portrait',
      homeSubCustom: 'Custom syndicate photo active across Zone City',
      homeSubPreset: 'Illustrated syndicate portrait active',
      homeSubDefault: 'Upload your custom photo or select an illustrated portrait',
      omarOwnSub: 'Visible on your Dossier, Faction Roster & PvP Directory',
      omarOtherSub: 'Verified Zone City Operative Portrait',
      accountHeading: 'Player Profile Picture',
      accountDesc: 'Upload a custom square photo (PNG, JPEG, WebP) or choose one of 8 illustrated syndicate portraits. Saved permanently to PostgreSQL.',
      accountSignedOutDesc: 'Sign in or start a guest character first to upload and save a persistent profile photo.',
      accountOpenBtn: 'Upload / Change Profile Photo',
      accountRemoveBtn: 'Remove Photo',
      modalTitle: 'Profile Photo Studio',
      modalLead: 'Crop & zoom your custom photo (256×256) or pick an illustrated Syndicate Portrait.',
      zoomLabel: 'Zoom',
      cropHint: 'Drag on canvas to pan · Use slider to zoom (1.0× – 3.0×)',
      dropTitle: 'Drop an image here or choose a photo',
      dropSub: 'PNG, JPEG, WebP or GIF · Auto-cropped to crisp 256×256 (< 250 KB)',
      chooseFile: 'Choose Photo File',
      presetsTitle: 'Or Choose an Illustrated Syndicate Portrait',
      saveBtn: 'Save Profile Photo',
      savingBtn: 'Saving...',
      removeBtn: 'Remove Photo',
      cancelBtn: 'Cancel',
      statusReady: 'Select a photo or portrait preset, then click Save Profile Photo.',
      statusSavedUpload: 'Custom profile photo saved and synced live!',
      statusSavedPreset: 'Syndicate portrait saved and synced live!',
      statusRemoved: 'Profile photo reset to default operative crest.',
      statusNeedAuth: 'Start or sign in to a character first so your photo can be saved to the server.',
      statusBadFile: 'Unsupported image file. Choose a PNG, JPEG, WebP, or GIF image.',
      statusSaveFailed: 'Could not save profile photo. Please try another image.'
    },
    ar: {
      cameraAria: 'رفع صورة الملف الشخصي',
      uploadPhoto: 'رفع صورة الشخصية',
      changePhoto: 'تغيير الصورة',
      homeTitle: 'صورة العميل في النقابة',
      homeSubCustom: 'صورة مخصصة نشطة في كافة شاشات مدينة زون',
      homeSubPreset: 'بورتريه النقابة المرسوم نشط حالياً',
      homeSubDefault: 'ارفع صورتك الخاصة أو اختر بورتريه مرسوماً للعميل',
      omarOwnSub: 'تظهر في ملفك الشخصي وقائمة الفصيل ودليل اللاعبين',
      omarOtherSub: 'صورة عميل موثقة في مدينة زون',
      accountHeading: 'صورة الملف الشخصي للاعب',
      accountDesc: 'ارفع صورة مربعة مخصصة (PNG أو JPEG أو WebP) أو اختر من 8 بورتريهات مرسومة للنقابة. تُحفظ مباشرة على الخادم.',
      accountSignedOutDesc: 'سجّل الدخول أو ابدأ شخصية ضيف أولاً لرفع وحفظ صورة ملفك الشخصي.',
      accountOpenBtn: 'رفع / تغيير صورة الملف الشخصي',
      accountRemoveBtn: 'إزالة الصورة',
      modalTitle: 'استوديو صورة الملف الشخصي',
      modalLead: 'اسحب وكبّر صورتك داخل إطار 256×256 أو اختر بورتريه النقابة المرسوم.',
      zoomLabel: 'تكبير',
      cropHint: 'اسحب الصورة للتحريك · استخدم المؤشر للتكبير (1.0× – 3.0×)',
      dropTitle: 'أفلت صورة هنا أو اختر ملف صورة',
      dropSub: 'PNG أو JPEG أو WebP · قص تلقائي بدقة 256×256 (< 250 ك.ب)',
      chooseFile: 'اختيار ملف صورة',
      presetsTitle: 'أو اختر بورتريه مرسوماً من النقابة',
      saveBtn: 'حفظ صورة الملف الشخصي',
      savingBtn: 'جارٍ الحفظ...',
      removeBtn: 'إزالة الصورة',
      cancelBtn: 'إلغاء',
      statusReady: 'اختر صورة من جهازك أو بورتريه جاهز ثم اضغط حفظ.',
      statusSavedUpload: 'تم حفظ صورة الملف الشخصي ومزامنتها فوراً!',
      statusSavedPreset: 'تم حفظ بورتريه النقابة ومزامنته فوراً!',
      statusRemoved: 'تمت إعادة صورة الملف الشخصي إلى الشارة الافتراضية.',
      statusNeedAuth: 'ابدأ جلسة ضيف أو سجّل الدخول أولاً لحفظ صورتك على الخادم.',
      statusBadFile: 'ملف غير مدعوم. اختر صورة بصيغة PNG أو JPEG أو WebP.',
      statusSaveFailed: 'تعذر حفظ الصورة. جرّب صورة أخرى.'
    }
  };

  /* ------------------------------------------------------------------------
   * 2. STATE STORE & HELPERS
   * ------------------------------------------------------------------------ */
  var store = {
    initialized: false,
    authenticated: false,
    playerId: null,
    hasCustomAvatar: false,
    presetId: '',
    avatarUrl: null,
    dataUrl: null,
    updatedAt: null,
    otherAvatars: {},
    pendingLookups: {},
    modalOpen: false,
    busy: false,
    draftMode: 'none', // 'none' | 'crop' | 'preset' | 'directDataUrl'
    draftPresetId: '',
    draftDirectDataUrl: null,
    cropImg: null,
    cropZoom: 1,
    cropPanX: 0,
    cropPanY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginPanX: 0,
    dragOriginPanY: 0,
    statusText: '',
    statusKind: 'info'
  };

  function isAr() {
    var root = document.documentElement;
    if (root && (root.lang === 'ar' || root.dir === 'rtl')) return true;
    try {
      if (window.ZoneAccount && typeof window.ZoneAccount.currentLanguage === 'function') {
        return window.ZoneAccount.currentLanguage() === 'ar';
      }
    } catch (_) {}
    return false;
  }

  function L() {
    return isAr() ? COPY.ar : COPY.en;
  }

  function isPreviewMode() {
    try {
      return new URLSearchParams(window.location.search || '').get('zone-preview') === '1';
    } catch (_) {
      return false;
    }
  }

  function isAccountPage() {
    if (document.body && document.body.classList && document.body.classList.contains('zone-account')) return true;
    return Boolean(document.getElementById('claimPanel') && !document.getElementById('zone-main'));
  }

  function activeSelfSrc() {
    if (store.dataUrl) return store.dataUrl;
    if (store.avatarUrl) return store.avatarUrl;
    if (store.presetId && PRESET_MAP[store.presetId]) return PRESET_MAP[store.presetId].dataUrl;
    return null;
  }

  function saveLocalCache(playerId) {
    if (!playerId) return;
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + playerId,
        JSON.stringify({
          playerId: playerId,
          hasCustomAvatar: Boolean(store.hasCustomAvatar),
          presetId: store.presetId || '',
          avatarUrl: store.avatarUrl || null,
          dataUrl: store.dataUrl || null,
          updatedAt: store.updatedAt || null
        })
      );
    } catch (_) {}
  }

  function hydrateLocalCache(playerId) {
    if (!playerId) return false;
    try {
      var raw = window.localStorage.getItem(STORAGE_PREFIX + playerId);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.playerId !== playerId) return false;
      store.playerId = playerId;
      store.hasCustomAvatar = Boolean(parsed.hasCustomAvatar);
      store.presetId = String(parsed.presetId || '');
      store.avatarUrl = parsed.avatarUrl || null;
      store.dataUrl = parsed.dataUrl || null;
      store.updatedAt = parsed.updatedAt || null;
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyServerAvatarPayload(res) {
    if (!res || typeof res !== 'object') return;
    if (typeof res.playerId === 'string' && res.playerId !== '') {
      store.playerId = res.playerId;
      store.authenticated = true;
    }
    store.hasCustomAvatar = Boolean(res.hasCustomAvatar);
    store.presetId = typeof res.presetId === 'string' ? res.presetId : '';
    store.dataUrl = typeof res.dataUrl === 'string' && res.dataUrl !== '' ? res.dataUrl : null;
    store.avatarUrl = typeof res.avatarUrl === 'string' && res.avatarUrl !== '' ? res.avatarUrl : null;
    if (!store.avatarUrl && store.presetId && PRESET_MAP[store.presetId]) {
      store.avatarUrl = PRESET_MAP[store.presetId].dataUrl;
    }
    store.updatedAt = res.updatedAt || null;

    if (store.playerId) {
      var src = activeSelfSrc();
      store.otherAvatars[store.playerId] = {
        hasCustomAvatar: store.hasCustomAvatar,
        presetId: store.presetId,
        src: src
      };
      saveLocalCache(store.playerId);
    }

    syncMounts();
    emitAvatarUpdated();
  }

  function emitAvatarUpdated() {
    try {
      if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('zone:avatar-updated', {
          detail: {
            playerId: store.playerId,
            hasCustomAvatar: store.hasCustomAvatar,
            presetId: store.presetId,
            avatarUrl: store.avatarUrl,
            dataUrl: store.dataUrl
          }
        }));
      }
    } catch (_) {}
  }

  function matchesSelfId(candidate) {
    if (!candidate) return false;
    var clean = String(candidate).replace(/^#/, '').trim();
    if (!clean) return false;
    if (store.playerId && clean === store.playerId) return true;
    try {
      var g = window.__zoneGame;
      if (g && g.p) {
        if (g.p.playerId && String(g.p.playerId) === clean) return true;
        if (g.p.numericId && String(g.p.numericId) === clean) return true;
        if (g.p.username && String(g.p.username).toLowerCase() === clean.toLowerCase()) return true;
      }
      var lv = window.__zoneLastView;
      if (lv && lv.omar && lv.omar.playerId && String(lv.omar.playerId) === clean) return true;
    } catch (_) {}
    return false;
  }

  /* ------------------------------------------------------------------------
   * 3. SESSION-AWARE API CLIENT (ZERO CONSOLE 401 NOISE)
   * ------------------------------------------------------------------------ */
  async function resolveSessionPlayerId() {
    if (isPreviewMode()) return null;

    if (window.ZoneSession && typeof window.ZoneSession.ensure === 'function') {
      try {
        var s = await window.ZoneSession.ensure();
        if (s && typeof s.playerId === 'string' && s.playerId !== '') {
          store.authenticated = true;
          store.playerId = s.playerId;
          return s.playerId;
        }
      } catch (_) {
        store.authenticated = false;
        return null;
      }
    }

    if (window.ZoneAccount && typeof window.ZoneAccount.current === 'function') {
      for (var waitIdx = 0; waitIdx < 12; waitIdx++) {
        if (typeof window.ZoneAccount.isReady === 'function' && window.ZoneAccount.isReady()) break;
        var curImmediate = window.ZoneAccount.current();
        if (curImmediate && typeof curImmediate === 'object') break;
        await new Promise(function (r) { setTimeout(r, 35); });
      }
      var acct = window.ZoneAccount.current();
      if (acct && typeof acct.playerId === 'string' && acct.playerId !== '') {
        store.authenticated = true;
        store.playerId = acct.playerId;
        return acct.playerId;
      }
      if (acct && typeof acct === 'object' && !acct.playerId) {
        store.authenticated = false;
        store.playerId = null;
        return null;
      }
    }

    try {
      var acctRes = await fetch('/api/v1/auth/account', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!acctRes || !acctRes.ok) {
        store.authenticated = false;
        return null;
      }
      var acctJson = await acctRes.json();
      if (acctJson && typeof acctJson.playerId === 'string' && acctJson.playerId !== '') {
        store.authenticated = true;
        store.playerId = acctJson.playerId;
        return acctJson.playerId;
      }
    } catch (_) {}

    store.authenticated = false;
    return null;
  }

  async function refreshSelfAvatar() {
    if (isPreviewMode()) return store;
    var pid = await resolveSessionPlayerId();
    if (!pid) {
      store.hasCustomAvatar = false;
      store.presetId = '';
      store.avatarUrl = null;
      store.dataUrl = null;
      syncMounts();
      return store;
    }

    hydrateLocalCache(pid);
    syncMounts();

    try {
      var resp = await fetch('/api/v1/player-profile/avatar', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (resp && resp.status === 401) {
        store.authenticated = false;
        syncMounts();
        return store;
      }
      if (resp && resp.ok) {
        var json = await resp.json();
        if (json && json.ok) {
          applyServerAvatarPayload(json);
        }
      }
    } catch (_) {}

    store.initialized = true;
    return store;
  }

  async function postAvatarAction(body) {
    var pid = await resolveSessionPlayerId();
    if (!pid) {
      var needAuthErr = new Error(L().statusNeedAuth);
      needAuthErr.code = 'UNAUTHENTICATED';
      throw needAuthErr;
    }

    var resp = await fetch('/api/v1/player-profile/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    var data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = null;
    }
    if (!resp || !resp.ok || !data || !data.ok) {
      var err = new Error((data && data.error) ? String(data.error) : L().statusSaveFailed);
      err.status = resp ? resp.status : 0;
      throw err;
    }
    applyServerAvatarPayload(data);
    return data;
  }

  async function fetchPlayerAvatar(targetPlayerId) {
    var clean = String(targetPlayerId || '').replace(/^#/, '').trim();
    if (!clean || !/^[A-Za-z0-9_-]{1,64}$/.test(clean)) return null;
    if (matchesSelfId(clean)) {
      return {
        hasCustomAvatar: store.hasCustomAvatar,
        presetId: store.presetId,
        src: activeSelfSrc()
      };
    }
    if (Object.prototype.hasOwnProperty.call(store.otherAvatars, clean)) {
      return store.otherAvatars[clean];
    }
    if (store.pendingLookups[clean]) {
      return store.pendingLookups[clean];
    }
    if (isPreviewMode()) return null;

    store.pendingLookups[clean] = fetch('/api/v1/player-profile/avatar?id=' + encodeURIComponent(clean), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (json) {
        delete store.pendingLookups[clean];
        if (!json || !json.ok) {
          store.otherAvatars[clean] = { hasCustomAvatar: false, presetId: '', src: null };
          return store.otherAvatars[clean];
        }
        var src = json.dataUrl || json.avatarUrl || (json.presetId && PRESET_MAP[json.presetId] ? PRESET_MAP[json.presetId].dataUrl : null);
        var record = {
          hasCustomAvatar: Boolean(json.hasCustomAvatar),
          presetId: json.presetId || '',
          src: src || null
        };
        store.otherAvatars[clean] = record;
        if (json.playerId && json.playerId !== clean) {
          store.otherAvatars[json.playerId] = record;
        }
        syncInlineBadges();
        syncOmarModal();
        return record;
      })
      .catch(function () {
        delete store.pendingLookups[clean];
        return null;
      });

    return store.pendingLookups[clean];
  }

  function ingestDirectory(entries) {
    if (!Array.isArray(entries)) return;
    for (var i = 0; i < entries.length; i++) {
      var row = entries[i];
      if (!row || typeof row !== 'object' || !row.id) continue;
      var pid = String(row.id);
      var src = row.avatarDataUrl || row.avatarUrl || (row.avatarPresetId && PRESET_MAP[row.avatarPresetId] ? PRESET_MAP[row.avatarPresetId].dataUrl : null);
      if (src || row.hasCustomAvatar === false) {
        store.otherAvatars[pid] = {
          hasCustomAvatar: Boolean(row.hasCustomAvatar),
          presetId: String(row.avatarPresetId || ''),
          src: src || null
        };
        if (row.username) {
          store.otherAvatars[String(row.username)] = store.otherAvatars[pid];
        }
      }
    }
  }

  function harvestZoneTornDirectory() {
    try {
      if (window.ZoneTornLive && typeof window.ZoneTornLive.getStore === 'function') {
        var ztlStore = window.ZoneTornLive.getStore();
        if (ztlStore) {
          if (Array.isArray(ztlStore.directory) && ztlStore.directory.length > 0) {
            ingestDirectory(ztlStore.directory);
          }
          if (ztlStore.selectedProfile && ztlStore.selectedProfile.id) {
            ingestDirectory([ztlStore.selectedProfile]);
          }
        }
      }
    } catch (_) {}
  }

  /* ------------------------------------------------------------------------
   * 4. LIVE MOUNT POINTS (0ms INSTANT SYNC ACROSS ALL 5 SURFACES)
   * ------------------------------------------------------------------------ */

  /* Mount 1: Sidebar #zone-operative-crest .zaaa-op-avatar */
  function syncSidebarCrest() {
    var crest = document.getElementById('zone-operative-crest');
    if (!crest) return;
    var avatarWrap = crest.querySelector('.zaaa-op-avatar');
    if (!avatarWrap) return;

    var copy = L();
    var img = avatarWrap.querySelector('img.zpa-crest-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'zpa-crest-img';
      img.alt = '';
      img.hidden = true;
      avatarWrap.appendChild(img);
    }

    var src = activeSelfSrc();
    if (src) {
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.hidden = false;
    } else {
      img.hidden = true;
      img.removeAttribute('src');
    }

    var camBtn = avatarWrap.querySelector('button.zpa-camera-badge');
    if (!camBtn) {
      camBtn = document.createElement('button');
      camBtn.type = 'button';
      camBtn.className = 'zpa-camera-badge';
      camBtn.innerHTML = CAMERA_ICON_SVG;
      camBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openModal();
      });
      camBtn.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          ev.stopPropagation();
          openModal();
        }
      });
      avatarWrap.appendChild(camBtn);
    }
    if (camBtn.title !== copy.cameraAria) {
      camBtn.title = copy.cameraAria;
      camBtn.setAttribute('aria-label', copy.cameraAria);
    }
  }

  function queryAllOutsideXdc(selector) {
    var list = document.querySelectorAll(selector);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el.closest || !el.closest('x-dc')) out.push(el);
    }
    return out;
  }

  /* Mount 2: Home .zone-home-brief & .zone-dossier-actions */
  function syncHomeSurfaces() {
    var copy = L();
    var src = activeSelfSrc();

    var homeBriefs = queryAllOutsideXdc('section.zone-home-brief, .zone-home-brief');
    for (var hbIdx = 0; hbIdx < homeBriefs.length; hbIdx++) {
      var homeBrief = homeBriefs[hbIdx];
      var briefWidget = homeBrief.querySelector('[data-zpa-mount="home-brief"]');
      if (!briefWidget) {
        briefWidget = document.createElement('div');
        briefWidget.className = 'zpa-home-brief-widget';
        briefWidget.setAttribute('data-zpa-mount', 'home-brief');
        briefWidget.innerHTML =
          '<div class="zpa-home-brief-lead">' +
            '<div class="zpa-avatar-box" role="button" tabindex="0" data-zpa-open="1"></div>' +
            '<div class="zpa-home-brief-copy">' +
              '<span class="zpa-home-brief-title"></span>' +
              '<span class="zpa-home-brief-sub"></span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="zpa-upload-btn" data-zpa-open="1">' +
            CAMERA_ICON_SVG +
            '<span class="zpa-upload-btn-lbl"></span>' +
          '</button>';
        briefWidget.addEventListener('click', function (ev) {
          var trigger = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zpa-open="1"]') : null;
          if (trigger) {
            ev.preventDefault();
            openModal();
          }
        });
        homeBrief.appendChild(briefWidget);
      }

      var box = briefWidget.querySelector('.zpa-avatar-box');
      if (box) {
        var desiredKey = src || 'default';
        if (box.getAttribute('data-zpa-rendered') !== desiredKey) {
          box.setAttribute('data-zpa-rendered', desiredKey);
          box.innerHTML = src ? ('<img src="' + escapeAttr(src) + '" alt="">') : DEFAULT_CREST_SVG;
        }
        box.title = copy.cameraAria;
      }
      var titleEl = briefWidget.querySelector('.zpa-home-brief-title');
      if (titleEl && titleEl.textContent !== copy.homeTitle) titleEl.textContent = copy.homeTitle;
      var subEl = briefWidget.querySelector('.zpa-home-brief-sub');
      var subText = store.hasCustomAvatar ? copy.homeSubCustom : (store.presetId ? copy.homeSubPreset : copy.homeSubDefault);
      if (subEl && subEl.textContent !== subText) subEl.textContent = subText;
      var btnLbl = briefWidget.querySelector('.zpa-upload-btn-lbl');
      var ctaText = src ? copy.changePhoto : copy.uploadPhoto;
      if (btnLbl && btnLbl.textContent !== ctaText) btnLbl.textContent = ctaText;
    }

    var dossierContainers = queryAllOutsideXdc('.zone-dossier-actions');
    for (var daIdx = 0; daIdx < dossierContainers.length; daIdx++) {
      var dossierActions = dossierContainers[daIdx];
      var dosBtn = dossierActions.querySelector('button.zpa-dossier-upload-btn');
      if (!dosBtn) {
        dosBtn = document.createElement('button');
        dosBtn.type = 'button';
        dosBtn.className = 'zone-compact-btn zpa-dossier-upload-btn';
        dosBtn.setAttribute('data-zpa-mount', 'dossier-btn');
        dosBtn.innerHTML = CAMERA_ICON_SVG + '<span class="zpa-dossier-btn-lbl"></span>';
        dosBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          openModal();
        });
        dossierActions.appendChild(dosBtn);
      }
      var dosLbl = dosBtn.querySelector('.zpa-dossier-btn-lbl');
      if (dosLbl && dosLbl.textContent !== copy.uploadPhoto) {
        dosLbl.textContent = copy.uploadPhoto;
      }
    }
  }

  /* Mount 3: Omar Profile Modal ([data-omar-profile-modal]) */
  function syncOmarModal() {
    var modals = queryAllOutsideXdc('[data-omar-profile-modal]');
    for (var mIdx = 0; mIdx < modals.length; mIdx++) {
      var modalSec = modals[mIdx];
      var card = modalSec.querySelector('.zone-modal-card') || modalSec;

      var targetId = '';
      var targetName = 'Operative';
      var isSelf = true;
      try {
        var lv = window.__zoneLastView;
        var attrPid = String(modalSec.getAttribute('data-player-id') || '').trim();
        if (attrPid) {
          targetId = attrPid;
          isSelf = matchesSelfId(attrPid);
        } else if (lv && lv.omar && lv.omar.activeProfile) {
          var ap = lv.omar.activeProfile;
          targetId = String(ap.playerId || ap.id || '');
          targetName = String(ap.name || 'Operative');
          isSelf = Boolean(
            ap.isSelf ||
            matchesSelfId(targetId) ||
            (lv.omar.playerId && String(ap.id) === String(lv.omar.playerId))
          );
        } else {
          var strong = card.querySelector('strong:not(.zpa-omar-name)');
          if (strong) {
            var rawTxt = String(strong.textContent || '');
            var m = /\[#([^\]]+)\]/.exec(rawTxt);
            if (m) targetId = m[1].trim();
            targetName = rawTxt.replace(/\[#[^\]]+\]/, '').trim() || 'Operative';
            isSelf = matchesSelfId(targetId) || matchesSelfId(targetName);
          }
        }
      } catch (_) {}

      var bar = card.querySelector('[data-zpa-mount="omar-modal"]');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'zpa-omar-avatar-bar';
        bar.setAttribute('data-zpa-mount', 'omar-modal');
        bar.innerHTML =
          '<div class="zpa-omar-avatar-lead">' +
            '<div class="zpa-omar-avatar-frame"></div>' +
            '<div class="zpa-omar-avatar-meta">' +
              '<strong class="zpa-omar-name"></strong>' +
              '<span class="zpa-omar-sub"></span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="zpa-upload-btn zpa-omar-change-btn">' +
            CAMERA_ICON_SVG +
            '<span class="zpa-omar-btn-lbl"></span>' +
          '</button>';
        var changeBtn = bar.querySelector('.zpa-omar-change-btn');
        if (changeBtn) {
          changeBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            openModal();
          });
        }
        if (card.firstChild) card.insertBefore(bar, card.firstChild);
        else card.appendChild(bar);
      }

      var copy = L();
      var resolvedSrc = null;
      if (isSelf) {
        resolvedSrc = activeSelfSrc();
      } else if (targetId || targetName) {
        var key = targetId || targetName;
        var cached = store.otherAvatars[key] || store.otherAvatars[targetName];
        if (cached) resolvedSrc = cached.src;
        else fetchPlayerAvatar(targetName || targetId);
      }

      var frame = bar.querySelector('.zpa-omar-avatar-frame');
      if (frame) {
        var renderKey = resolvedSrc || 'default';
        if (frame.getAttribute('data-zpa-rendered') !== renderKey) {
          frame.setAttribute('data-zpa-rendered', renderKey);
          frame.innerHTML = resolvedSrc ? ('<img src="' + escapeAttr(resolvedSrc) + '" alt="">') : DEFAULT_CREST_SVG;
        }
      }

      var nameNode = bar.querySelector('.zpa-omar-name');
      if (nameNode && nameNode.textContent !== targetName) nameNode.textContent = targetName;
      var subNode = bar.querySelector('.zpa-omar-sub');
      var subTxt = isSelf ? copy.omarOwnSub : copy.omarOtherSub;
      if (subNode && subNode.textContent !== subTxt) subNode.textContent = subTxt;

      var btn = bar.querySelector('.zpa-omar-change-btn');
      if (btn) {
        btn.hidden = !isSelf;
        var lbl = btn.querySelector('.zpa-omar-btn-lbl');
        if (lbl && lbl.textContent !== copy.changePhoto) lbl.textContent = copy.changePhoto;
      }
    }
  }

  /* Mount 4: Any [data-zpa-avatar="<playerId>"] badge */
  function syncInlineBadges(root) {
    harvestZoneTornDirectory();
    var scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    var badges = scope.querySelectorAll('[data-zpa-avatar]');
    for (var i = 0; i < badges.length; i++) {
      var el = badges[i];
      if (el.closest && el.closest('x-dc')) continue;
      var pid = String(el.getAttribute('data-zpa-avatar') || '').trim();
      if (!pid) continue;

      var src = null;
      if (matchesSelfId(pid)) {
        src = activeSelfSrc();
      } else if (Object.prototype.hasOwnProperty.call(store.otherAvatars, pid)) {
        src = store.otherAvatars[pid] ? store.otherAvatars[pid].src : null;
      } else {
        fetchPlayerAvatar(pid);
      }

      var key = src || ('default:' + pid);
      if (el.getAttribute('data-zpa-rendered') !== key) {
        el.setAttribute('data-zpa-rendered', key);
        if (src) {
          el.innerHTML = '<img class="zpa-inline-avatar-img" src="' + escapeAttr(src) + '" alt="">';
        } else {
          el.innerHTML = DEFAULT_CREST_SVG;
        }
      }
    }
  }

  /* Mount 5: account.html -> #zone-account-avatar-section above #claimPanel */
  function syncAccountSection() {
    if (!isAccountPage()) return;
    var claimPanel = document.getElementById('claimPanel');
    var main = (claimPanel && claimPanel.parentElement) || document.querySelector('main');
    if (!main) return;

    var sec = document.getElementById('zone-account-avatar-section');
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'zone-account-avatar-section';
      sec.className = 'zpa-account-section';
      sec.innerHTML =
        '<div class="zpa-account-lead">' +
          '<div class="zpa-account-preview" id="zpa-account-preview" role="button" tabindex="0"></div>' +
          '<div class="zpa-account-copy">' +
            '<h2 id="zpa-account-heading"></h2>' +
            '<p id="zpa-account-desc"></p>' +
          '</div>' +
        '</div>' +
        '<div class="zpa-account-actions">' +
          '<button type="button" id="zpa-account-open-btn">' +
            CAMERA_ICON_SVG +
            '<span id="zpa-account-open-lbl"></span>' +
          '</button>' +
          '<button type="button" id="zpa-account-remove-btn" hidden></button>' +
        '</div>';

      var openTrigger = sec.querySelector('#zpa-account-open-btn');
      if (openTrigger) openTrigger.addEventListener('click', function () { openModal(); });
      var previewTrigger = sec.querySelector('#zpa-account-preview');
      if (previewTrigger) {
        previewTrigger.addEventListener('click', function () { openModal(); });
        previewTrigger.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openModal();
          }
        });
      }
      var remTrigger = sec.querySelector('#zpa-account-remove-btn');
      if (remTrigger) {
        remTrigger.addEventListener('click', function () { removeAvatar(); });
      }

      if (claimPanel && claimPanel.parentElement === main) {
        main.insertBefore(sec, claimPanel);
      } else {
        main.appendChild(sec);
      }
    }

    var copy = L();
    var src = activeSelfSrc();
    var prev = sec.querySelector('#zpa-account-preview');
    if (prev) {
      var rKey = src || 'default';
      if (prev.getAttribute('data-zpa-rendered') !== rKey) {
        prev.setAttribute('data-zpa-rendered', rKey);
        prev.innerHTML = src ? ('<img src="' + escapeAttr(src) + '" alt="">') : DEFAULT_CREST_SVG;
      }
      prev.title = copy.accountOpenBtn;
    }

    var h2 = sec.querySelector('#zpa-account-heading');
    if (h2 && h2.textContent !== copy.accountHeading) h2.textContent = copy.accountHeading;

    var hasActiveAccount = store.authenticated;
    try {
      if (window.ZoneAccount && typeof window.ZoneAccount.current === 'function') {
        var cur = window.ZoneAccount.current();
        if (cur && typeof cur === 'object') hasActiveAccount = Boolean(cur.playerId);
      }
    } catch (_) {}

    var p = sec.querySelector('#zpa-account-desc');
    var descTxt = hasActiveAccount ? copy.accountDesc : copy.accountSignedOutDesc;
    if (p && p.textContent !== descTxt) p.textContent = descTxt;

    var openLbl = sec.querySelector('#zpa-account-open-lbl');
    if (openLbl && openLbl.textContent !== copy.accountOpenBtn) openLbl.textContent = copy.accountOpenBtn;

    var remBtn = sec.querySelector('#zpa-account-remove-btn');
    if (remBtn) {
      remBtn.textContent = copy.accountRemoveBtn;
      remBtn.hidden = !Boolean(src && hasActiveAccount);
    }
  }

  function syncMounts(root) {
    syncSidebarCrest();
    syncHomeSurfaces();
    syncOmarModal();
    syncInlineBadges(root);
    syncAccountSection();
    if (store.modalOpen) renderStudioModalState();
  }

  /* ------------------------------------------------------------------------
   * 5. INTERACTIVE 256x256 CROP & ZOOM STUDIO MODAL
   * ------------------------------------------------------------------------ */
  function escapeAttr(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(val) {
    return escapeAttr(val).replace(/'/g, '&#39;');
  }

  function ensureStudioModal() {
    if (!document.body) return null;
    var backdrop = document.getElementById('zone-profile-avatar-backdrop');
    if (backdrop) return backdrop;

    var presetsHtml = '';
    for (var i = 0; i < PRESETS.length; i++) {
      var pr = PRESETS[i];
      presetsHtml +=
        '<button type="button" class="zpa-preset-card" data-zpa-preset="' + pr.id + '" aria-pressed="false">' +
          '<img src="' + escapeAttr(pr.dataUrl) + '" alt="">' +
          '<span data-zpa-preset-lbl="' + pr.id + '">' + escapeHtml(pr.nameEn) + '</span>' +
        '</button>';
    }

    backdrop = document.createElement('div');
    backdrop.id = 'zone-profile-avatar-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<div id="zone-profile-avatar-modal" role="dialog" aria-modal="true" aria-labelledby="zpa-modal-title">' +
        '<div class="zpa-modal-header">' +
          '<div class="zpa-modal-title-wrap">' +
            '<h2 id="zpa-modal-title"></h2>' +
            '<p id="zpa-modal-lead"></p>' +
          '</div>' +
          '<button type="button" class="zpa-modal-close" id="zpa-modal-close-btn" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="zpa-studio-grid">' +
          '<div class="zpa-crop-column">' +
            '<div class="zpa-canvas-stage" id="zpa-canvas-stage">' +
              '<canvas id="zpa-crop-canvas" width="256" height="256"></canvas>' +
              '<div class="zpa-canvas-guide" aria-hidden="true"></div>' +
            '</div>' +
            '<div class="zpa-zoom-controls">' +
              '<label for="zpa-zoom-slider" id="zpa-zoom-lbl">Zoom</label>' +
              '<input type="range" id="zpa-zoom-slider" min="1" max="3" step="0.02" value="1">' +
              '<bdi id="zpa-zoom-val">1.00×</bdi>' +
            '</div>' +
            '<div class="zpa-crop-hint" id="zpa-crop-hint"></div>' +
          '</div>' +
          '<div class="zpa-picker-column">' +
            '<div class="zpa-dropzone" id="zpa-dropzone" role="button" tabindex="0">' +
              '<input type="file" id="zpa-file-input" accept="image/png,image/jpeg,image/webp,image/gif">' +
              '<strong id="zpa-drop-title"></strong>' +
              '<small id="zpa-drop-sub"></small>' +
              '<button type="button" class="zpa-choose-file-btn" id="zpa-choose-file-btn"></button>' +
            '</div>' +
            '<div class="zpa-presets-heading" id="zpa-presets-heading"></div>' +
            '<div class="zpa-presets-grid" id="zpa-presets-grid">' + presetsHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="zpa-status-banner" id="zpa-status-banner" role="status" aria-live="polite"></div>' +
        '<div class="zpa-modal-footer">' +
          '<button type="button" class="zpa-remove-btn" id="zpa-modal-remove-btn"></button>' +
          '<div class="zpa-footer-right">' +
            '<button type="button" class="zpa-cancel-btn" id="zpa-modal-cancel-btn"></button>' +
            '<button type="button" class="zpa-save-btn" id="zpa-modal-save-btn"></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closeModal();
    });

    var closeBtn = backdrop.querySelector('#zpa-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    var cancelBtn = backdrop.querySelector('#zpa-modal-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    var fileInput = backdrop.querySelector('#zpa-file-input');
    var dropzone = backdrop.querySelector('#zpa-dropzone');
    var chooseBtn = backdrop.querySelector('#zpa-choose-file-btn');

    var triggerFilePicker = function (ev) {
      if (ev) ev.stopPropagation();
      if (fileInput && typeof fileInput.click === 'function') fileInput.click();
    };
    if (chooseBtn) chooseBtn.addEventListener('click', triggerFilePicker);
    if (dropzone) {
      dropzone.addEventListener('click', function (ev) {
        if (ev.target === fileInput) return;
        if (fileInput && typeof fileInput.click === 'function') fileInput.click();
      });
      dropzone.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          if (fileInput && typeof fileInput.click === 'function') fileInput.click();
        }
      });
      dropzone.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (ev) {
        ev.preventDefault();
        dropzone.classList.remove('is-dragover');
        var files = ev.dataTransfer && ev.dataTransfer.files;
        if (files && files[0]) handleSelectedFile(files[0]);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          handleSelectedFile(fileInput.files[0]);
        }
      });
    }

    var zoomSlider = backdrop.querySelector('#zpa-zoom-slider');
    if (zoomSlider) {
      zoomSlider.addEventListener('input', function () {
        store.cropZoom = Math.max(1, Math.min(3, Number(zoomSlider.value) || 1));
        clampCropPan();
        drawStudioCanvas();
        var zVal = backdrop.querySelector('#zpa-zoom-val');
        if (zVal) zVal.textContent = store.cropZoom.toFixed(2) + '×';
      });
    }

    var stage = backdrop.querySelector('#zpa-canvas-stage');
    if (stage) {
      stage.addEventListener('pointerdown', function (ev) {
        if (store.draftMode !== 'crop' || !store.cropImg) return;
        store.dragging = true;
        store.dragStartX = ev.clientX || 0;
        store.dragStartY = ev.clientY || 0;
        store.dragOriginPanX = store.cropPanX;
        store.dragOriginPanY = store.cropPanY;
        if (typeof stage.setPointerCapture === 'function' && ev.pointerId != null) {
          try { stage.setPointerCapture(ev.pointerId); } catch (_) {}
        }
      });
      stage.addEventListener('pointermove', function (ev) {
        if (!store.dragging || store.draftMode !== 'crop' || !store.cropImg) return;
        var rect = typeof stage.getBoundingClientRect === 'function' ? stage.getBoundingClientRect() : { width: 256, height: 256 };
        var ratioX = rect.width > 0 ? (256 / rect.width) : 1;
        var ratioY = rect.height > 0 ? (256 / rect.height) : 1;
        store.cropPanX = store.dragOriginPanX + ((ev.clientX || 0) - store.dragStartX) * ratioX;
        store.cropPanY = store.dragOriginPanY + ((ev.clientY || 0) - store.dragStartY) * ratioY;
        clampCropPan();
        drawStudioCanvas();
      });
      var endDrag = function () { store.dragging = false; };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);
    }

    var presetsGrid = backdrop.querySelector('#zpa-presets-grid');
    if (presetsGrid) {
      presetsGrid.addEventListener('click', function (ev) {
        var btn = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zpa-preset]') : null;
        if (!btn) return;
        var pid = btn.getAttribute('data-zpa-preset');
        if (pid && PRESET_MAP[pid]) {
          store.draftMode = 'preset';
          store.draftPresetId = pid;
          store.cropImg = null;
          drawStudioCanvas();
          renderStudioModalState();
        }
      });
    }

    var saveBtn = backdrop.querySelector('#zpa-modal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveFromStudioModal);

    var removeBtn = backdrop.querySelector('#zpa-modal-remove-btn');
    if (removeBtn) removeBtn.addEventListener('click', function () { removeAvatar(); });

    document.body.appendChild(backdrop);
    return backdrop;
  }

  function clampCropPan() {
    if (!store.cropImg) {
      store.cropPanX = 0;
      store.cropPanY = 0;
      return;
    }
    var iw = Math.max(1, Number(store.cropImg.naturalWidth || store.cropImg.width || 256));
    var ih = Math.max(1, Number(store.cropImg.naturalHeight || store.cropImg.height || 256));
    var baseScale = Math.max(256 / iw, 256 / ih);
    var scale = baseScale * store.cropZoom;
    var maxX = Math.max(0, (iw * scale - 256) * 0.5);
    var maxY = Math.max(0, (ih * scale - 256) * 0.5);
    store.cropPanX = Math.max(-maxX, Math.min(maxX, store.cropPanX));
    store.cropPanY = Math.max(-maxY, Math.min(maxY, store.cropPanY));
  }

  function drawStudioCanvas() {
    var canvas = document.getElementById('zpa-crop-canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#161310';
    ctx.fillRect(0, 0, 256, 256);

    if (store.draftMode === 'crop' && store.cropImg) {
      var iw = Math.max(1, Number(store.cropImg.naturalWidth || store.cropImg.width || 256));
      var ih = Math.max(1, Number(store.cropImg.naturalHeight || store.cropImg.height || 256));
      var baseScale = Math.max(256 / iw, 256 / ih);
      var scale = baseScale * store.cropZoom;
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = (256 - dw) * 0.5 + store.cropPanX;
      var dy = (256 - dh) * 0.5 + store.cropPanY;
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(store.cropImg, dx, dy, dw, dh);
      return;
    }

    var previewSrc = null;
    if (store.draftMode === 'preset' && store.draftPresetId && PRESET_MAP[store.draftPresetId]) {
      previewSrc = PRESET_MAP[store.draftPresetId].dataUrl;
    } else if (store.draftMode === 'directDataUrl' && store.draftDirectDataUrl) {
      previewSrc = store.draftDirectDataUrl;
    } else {
      previewSrc = activeSelfSrc();
    }

    if (previewSrc && typeof Image === 'function') {
      var img = new Image();
      img.onload = function () {
        try {
          ctx.clearRect(0, 0, 256, 256);
          ctx.drawImage(img, 0, 0, 256, 256);
        } catch (_) {}
      };
      img.src = previewSrc;
    } else {
      ctx.fillStyle = '#231f1b';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#f5b82e';
      ctx.beginPath();
      ctx.arc(128, 96, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22b56b';
      ctx.beginPath();
      ctx.arc(128, 224, 78, Math.PI, 0);
      ctx.fill();
    }
  }

  function exportCroppedDataUrl() {
    var canvas = document.getElementById('zpa-crop-canvas');
    if (!canvas || typeof canvas.toDataURL !== 'function') {
      return store.draftDirectDataUrl || null;
    }
    drawStudioCanvas();

    var qualities = [0.86, 0.74, 0.62, 0.5];
    for (var i = 0; i < qualities.length; i++) {
      var q = qualities[i];
      try {
        var webp = canvas.toDataURL('image/webp', q);
        if (typeof webp === 'string' && webp.indexOf('data:image/webp;base64,') === 0) {
          var approxBytes = Math.ceil((webp.length - 23) * 0.75);
          if (approxBytes <= MAX_EXPORT_BYTES) return webp;
        }
      } catch (_) {}
    }

    for (var j = 0; j < qualities.length; j++) {
      var qJpg = qualities[j];
      try {
        var jpeg = canvas.toDataURL('image/jpeg', qJpg);
        if (typeof jpeg === 'string' && jpeg.indexOf('data:image/jpeg;base64,') === 0) {
          var approxJpgBytes = Math.ceil((jpeg.length - 23) * 0.75);
          if (approxJpgBytes <= MAX_EXPORT_BYTES) return jpeg;
        }
      } catch (_) {}
    }

    return canvas.toDataURL('image/jpeg', 0.5);
  }

  function handleSelectedFile(file) {
    var copy = L();
    if (!file || typeof file.type !== 'string' || !/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      setModalStatus(copy.statusBadFile, 'error');
      return;
    }
    if (typeof FileReader !== 'function' || typeof Image !== 'function') {
      setModalStatus(copy.statusBadFile, 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      if (!result || result.indexOf('data:image/') !== 0) {
        setModalStatus(copy.statusBadFile, 'error');
        return;
      }
      var img = new Image();
      img.onload = function () {
        store.cropImg = img;
        store.draftMode = 'crop';
        store.draftPresetId = '';
        store.draftDirectDataUrl = result;
        store.cropZoom = 1;
        store.cropPanX = 0;
        store.cropPanY = 0;
        var slider = document.getElementById('zpa-zoom-slider');
        if (slider) slider.value = '1';
        var zVal = document.getElementById('zpa-zoom-val');
        if (zVal) zVal.textContent = '1.00×';
        setModalStatus(copy.statusReady, 'info');
        drawStudioCanvas();
        renderStudioModalState();
      };
      img.onerror = function () {
        setModalStatus(copy.statusBadFile, 'error');
      };
      img.src = result;
    };
    reader.onerror = function () {
      setModalStatus(copy.statusBadFile, 'error');
    };
    reader.readAsDataURL(file);
  }

  function setModalStatus(text, kind) {
    store.statusText = String(text || '');
    store.statusKind = kind || 'info';
    renderStudioModalState();
  }

  function renderStudioModalState() {
    var backdrop = document.getElementById('zone-profile-avatar-backdrop');
    if (!backdrop) return;
    var ar = isAr();
    var copy = L();

    backdrop.hidden = !store.modalOpen;
    if (!store.modalOpen) return;

    var setText = function (sel, val) {
      var el = backdrop.querySelector(sel);
      if (el && el.textContent !== val) el.textContent = val;
    };

    setText('#zpa-modal-title', copy.modalTitle);
    setText('#zpa-modal-lead', copy.modalLead);
    setText('#zpa-zoom-lbl', copy.zoomLabel);
    setText('#zpa-crop-hint', copy.cropHint);
    setText('#zpa-drop-title', copy.dropTitle);
    setText('#zpa-drop-sub', copy.dropSub);
    setText('#zpa-choose-file-btn', copy.chooseFile);
    setText('#zpa-presets-heading', copy.presetsTitle);
    setText('#zpa-modal-cancel-btn', copy.cancelBtn);
    setText('#zpa-modal-remove-btn', copy.removeBtn);
    setText('#zpa-modal-save-btn', store.busy ? copy.savingBtn : copy.saveBtn);

    for (var i = 0; i < PRESETS.length; i++) {
      var pr = PRESETS[i];
      var lblEl = backdrop.querySelector('[data-zpa-preset-lbl="' + pr.id + '"]');
      var pName = ar ? pr.nameAr : pr.nameEn;
      if (lblEl && lblEl.textContent !== pName) lblEl.textContent = pName;
      var cardBtn = backdrop.querySelector('[data-zpa-preset="' + pr.id + '"]');
      if (cardBtn) {
        var activePreset = (store.draftMode === 'preset' && store.draftPresetId === pr.id) ||
          (store.draftMode === 'none' && !store.hasCustomAvatar && store.presetId === pr.id);
        cardBtn.setAttribute('aria-pressed', activePreset ? 'true' : 'false');
      }
    }

    var slider = backdrop.querySelector('#zpa-zoom-slider');
    if (slider) slider.disabled = store.draftMode !== 'crop' || store.busy;

    var saveBtn = backdrop.querySelector('#zpa-modal-save-btn');
    if (saveBtn) {
      var canSave = !store.busy && (store.draftMode === 'crop' || store.draftMode === 'preset' || store.draftMode === 'directDataUrl');
      saveBtn.disabled = !canSave;
    }

    var remBtn = backdrop.querySelector('#zpa-modal-remove-btn');
    if (remBtn) {
      remBtn.disabled = store.busy || (!store.hasCustomAvatar && !store.presetId);
    }

    var banner = backdrop.querySelector('#zpa-status-banner');
    if (banner) {
      var msg = store.statusText || copy.statusReady;
      banner.textContent = msg;
      banner.setAttribute('data-error', store.statusKind === 'error' ? 'true' : 'false');
      banner.setAttribute('data-ok', store.statusKind === 'ok' ? 'true' : 'false');
    }
  }

  function openModal() {
    ensureStudioModal();
    store.modalOpen = true;
    store.draftMode = store.presetId && !store.hasCustomAvatar ? 'preset' : 'none';
    store.draftPresetId = store.presetId || '';
    store.cropImg = null;
    store.cropZoom = 1;
    store.cropPanX = 0;
    store.cropPanY = 0;
    store.statusText = L().statusReady;
    store.statusKind = 'info';
    renderStudioModalState();
    drawStudioCanvas();
    return true;
  }

  function closeModal() {
    if (!store.modalOpen) return false;
    store.modalOpen = false;
    var backdrop = document.getElementById('zone-profile-avatar-backdrop');
    if (backdrop) backdrop.hidden = true;
    return true;
  }

  async function saveFromStudioModal() {
    if (store.busy) return null;
    var copy = L();
    store.busy = true;
    renderStudioModalState();
    try {
      var res = null;
      if (store.draftMode === 'preset' && store.draftPresetId) {
        res = await postAvatarAction({ action: 'preset', presetId: store.draftPresetId });
        setModalStatus(copy.statusSavedPreset, 'ok');
      } else if (store.draftMode === 'crop' || store.draftMode === 'directDataUrl') {
        var exported = store.draftMode === 'crop' ? exportCroppedDataUrl() : store.draftDirectDataUrl;
        res = await postAvatarAction({ action: 'upload', dataUrl: exported });
        setModalStatus(copy.statusSavedUpload, 'ok');
      }
      store.draftMode = 'none';
      return res;
    } catch (err) {
      setModalStatus((err && err.message) ? err.message : copy.statusSaveFailed, 'error');
      return null;
    } finally {
      store.busy = false;
      renderStudioModalState();
    }
  }

  async function uploadDataUrl(dataUrl) {
    store.busy = true;
    if (store.modalOpen) renderStudioModalState();
    try {
      var res = await postAvatarAction({ action: 'upload', dataUrl: String(dataUrl || '') });
      if (store.modalOpen) {
        setModalStatus(L().statusSavedUpload, 'ok');
        drawStudioCanvas();
      }
      return res;
    } finally {
      store.busy = false;
      if (store.modalOpen) renderStudioModalState();
    }
  }

  async function selectPreset(presetId) {
    store.busy = true;
    if (store.modalOpen) renderStudioModalState();
    try {
      var res = await postAvatarAction({ action: 'preset', presetId: String(presetId || '') });
      if (store.modalOpen) {
        store.draftMode = 'preset';
        store.draftPresetId = String(presetId || '');
        setModalStatus(L().statusSavedPreset, 'ok');
        drawStudioCanvas();
      }
      return res;
    } finally {
      store.busy = false;
      if (store.modalOpen) renderStudioModalState();
    }
  }

  async function removeAvatar() {
    store.busy = true;
    if (store.modalOpen) renderStudioModalState();
    try {
      var res = await postAvatarAction({ action: 'remove' });
      store.draftMode = 'none';
      store.draftPresetId = '';
      store.cropImg = null;
      if (store.modalOpen) {
        setModalStatus(L().statusRemoved, 'ok');
        drawStudioCanvas();
      }
      return res;
    } catch (err) {
      if (store.modalOpen) {
        setModalStatus((err && err.message) ? err.message : L().statusSaveFailed, 'error');
      }
      throw err;
    } finally {
      store.busy = false;
      if (store.modalOpen) renderStudioModalState();
    }
  }

  /* ------------------------------------------------------------------------
   * 6. LIFECYCLE, OBSERVERS & PUBLIC API
   * ------------------------------------------------------------------------ */
  function boot() {
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && store.modalOpen) {
        ev.preventDefault();
        closeModal();
      }
    });

    var langBtn = document.getElementById('languageToggle');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        setTimeout(function () { syncMounts(); }, 0);
      });
    }

    if (isAccountPage()) {
      ['loginForm', 'claimForm', 'recoverForm'].forEach(function (fid) {
        var f = document.getElementById(fid);
        if (f) {
          f.addEventListener('submit', function () {
            setTimeout(function () { refreshSelfAvatar(); }, 250);
          });
        }
      });
      var logoutBtn = document.getElementById('logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          setTimeout(function () { refreshSelfAvatar(); }, 200);
        });
      }
    }

    var rafPending = false;
    var scheduleSync = function () {
      if (rafPending) return;
      rafPending = true;
      var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
      raf(function () {
        rafPending = false;
        syncMounts();
      });
    };

    window.addEventListener('zone:render', scheduleSync, { passive: true });
    window.addEventListener('popstate', scheduleSync);

    if (typeof MutationObserver === 'function') {
      try {
        var rootObs = new MutationObserver(scheduleSync);
        rootObs.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['lang', 'dir', 'data-theme']
        });
        if (document.body) {
          var bodyObs = new MutationObserver(scheduleSync);
          bodyObs.observe(document.body, { childList: true, subtree: true });
        }
      } catch (_) {}
    }

    syncMounts();
    refreshSelfAvatar();
  }

  window.ZoneProfileAvatar = {
    openModal: openModal,
    closeModal: closeModal,
    isOpen: function () { return Boolean(store.modalOpen); },
    uploadDataUrl: uploadDataUrl,
    selectPreset: selectPreset,
    removeAvatar: removeAvatar,
    refresh: refreshSelfAvatar,
    syncMounts: syncMounts,
    fetchPlayerAvatar: fetchPlayerAvatar,
    ingestDirectory: ingestDirectory,
    exportCroppedDataUrl: exportCroppedDataUrl,
    getPresets: function () { return PRESETS.slice(); },
    getState: function () {
      return {
        initialized: store.initialized,
        authenticated: store.authenticated,
        playerId: store.playerId,
        hasCustomAvatar: store.hasCustomAvatar,
        presetId: store.presetId,
        avatarUrl: store.avatarUrl,
        dataUrl: store.dataUrl,
        updatedAt: store.updatedAt
      };
    },
    diagnostics: function () {
      return {
        ready: true,
        initialized: store.initialized,
        authenticated: store.authenticated,
        playerId: store.playerId,
        hasCustomAvatar: store.hasCustomAvatar,
        presetId: store.presetId,
        modalOpen: store.modalOpen,
        presetCount: PRESETS.length,
        cachedPlayers: Object.keys(store.otherAvatars).length
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

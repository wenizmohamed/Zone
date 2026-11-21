/* ==========================================================================
 * ZONE v159 — Wave-3 Track 15: Live MMO Syndicate Chat, Radio Channels & /roll
 * Hand-Drawn Watercolor Sketchbook Edition (Light + Dark + EN + AR RTL)
 * Exclusive Ownership: chat-comms-mmo (assets/ui/zone-chat-system.js)
 * Exposes: window.ZoneChatSystem
 *
 * Skills Applied:
 *   - chat-system: MVP + ChatStateMachine (Init/Default/Focused/Members/Minimized/Hidden)
 *                  + IChatMessagesBus decorator chain + TranslationService EN/AR Gloss
 *   - dice-roller: Server-authoritative & client-verified `/roll 2d6+3`, `1d20+5`, `4dF`, `d100`
 *   - mmo-zone-architecture & mmo-action-relay: 4 AoI radio channels (global, district, faction, trade)
 *   - realtime-multiplayer: Delta-seq polling (`sinceId`), optimistic UI echo, anti-flood 1.5s rate guard
 *
 * Strictly Inline HUD Docking:
 *   - Docks compact `💬 Chat` (`الدردشة`) pill inside `#ztl-hud-inner` right beside `Players` / `Events`.
 *   - NEVER mounts floating `position: fixed` widgets over bottom content cards.
 *   - 0px impact on Home `#zig-home-arcade` and 0px 390px horizontal overflow.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneChatSystemLoaded && window.ZoneChatSystem) return;
  window.__zoneChatSystemLoaded = true;

  var MAX_MESSAGE_LENGTH = 280;
  var RATE_LIMIT_MS = 1500;
  var POLL_INTERVAL_MS = 12000;

  var CHANNELS = [
    { id: 'global', icon: '🌐', en: 'Global', ar: 'العامة', subEn: 'City-Wide Radio', subAr: 'راديو المدينة العام' },
    { id: 'district', icon: '📍', en: 'District', ar: 'الحي', subEn: 'Local Sector AoI', subAr: 'شبكة القطاع المحلي' },
    { id: 'faction', icon: '🛡', en: 'Faction', ar: 'النقابة', subEn: 'Encrypted Family Relay', subAr: 'تردد العائلة المشفر' },
    { id: 'trade', icon: '⚖', en: 'Trade', ar: 'التجارة', subEn: 'Bazaar & Contraband', subAr: 'سوق البازار والمهربات' }
  ];

  var COPY = {
    en: {
      hudBtn: 'Chat',
      drawerTitle: 'Syndicate MMO Radio & Comms',
      drawerSub: '4-Channel AoI Relay · /roll Dice · Bilingual Gloss',
      glossBtn: 'EN/AR Gloss',
      mutedBtn: 'Muted',
      closeBtn: 'Close',
      mutePlayerTitle: 'Mute Operative',
      unmuteBtn: 'Unmute',
      noMuted: 'No operatives muted.',
      inputPlaceholder: 'Transmit message or /roll 2d6+3, /me, /help...',
      sendBtn: 'Send',
      rollTotal: 'Total',
      rateWait: 'Rate guard: wait 1.5s between transmissions.',
      msgMutedToast: 'Operative muted from your radio feed.',
      msgUnmutedToast: 'Operative restored to your radio feed.',
      hotkeyHint: 'Hotkey: [C] Toggle · [/roll 2d6+3] Cryptographic Dice'
    },
    ar: {
      hudBtn: 'الدردشة',
      drawerTitle: 'راديو واتصالات النقابة الحية',
      drawerSub: '4 قنوات ميدانية · رمي النرد /roll · ترجمة فورية',
      glossBtn: 'ترجمة EN/AR',
      mutedBtn: 'المكتومون',
      closeBtn: 'إغلاق',
      mutePlayerTitle: 'كتم العميل',
      unmuteBtn: 'إلغاء الكتم',
      noMuted: 'لا يوجد عملاء في قائمة الكتم.',
      inputPlaceholder: 'أرسل رسالة أو /roll 2d6+3 أو /me أو /help...',
      sendBtn: 'إرسال',
      rollTotal: 'المجموع',
      rateWait: 'حماية الإغراق: انتظر 1.5 ثانية بين الرسائل.',
      msgMutedToast: 'تم كتم العميل من موجز الراديو الخاص بك.',
      msgUnmutedToast: 'تمت إعادة العميل إلى موجز الراديو.',
      hotkeyHint: 'اختصار: [C] فتح/إغلاق · [/roll 2d6+3] رمي النرد'
    }
  };

  var EN_AR_GLOSS_TERMS = [
    ['pier 4', 'الرصيف الرابع'],
    ['downtown', 'وسط المدينة'],
    ['financial spire', 'الحي المالي'],
    ['xanax', 'زاناكس'],
    ['blood bag', 'كيس دم'],
    ['chain', 'السلسلة'],
    ['bounty', 'مكافأة'],
    ['faction', 'النقابة'],
    ['syndicate', 'النقابة'],
    ['vault', 'الخزنة'],
    ['mayor tariq', 'العمدة طارق'],
    ['luna', 'لونا']
  ];

  /* Seeded atmospheric Syndicate chatter from Luna, Mayor Tariq & rivals */
  var SEEDED_MESSAGES = [
    {
      id: 1,
      messageId: 1,
      channel: 'global',
      scopeKey: 'global',
      senderPlayerId: 'npc-luna',
      senderUsername: 'Luna',
      senderFactionId: 'vipers',
      senderFactionNameEn: 'Sand Vipers',
      senderFactionNameAr: 'أفاعي الرمل',
      senderRole: 'oracle',
      messageType: 'relay',
      bodyEn: '📡 [LUNA OVERWATCH] Encrypted Syndicate frequencies online. Use /roll 2d6+3 for high-stakes street checks or switch channels above.',
      bodyAr: '📡 [مراقبة لونا] ترددات النقابة المشفرة متصلة الآن. استخدم /roll 2d6+3 لرميات الحظ الميدانية أو بدّل القنوات أعلاه.',
      roll: null,
      createdAt: 'Just now'
    },
    {
      id: 2,
      messageId: 2,
      channel: 'global',
      scopeKey: 'global',
      senderPlayerId: 'npc-mayor-tariq',
      senderUsername: 'Mayor Tariq',
      senderFactionId: 'oldguard',
      senderFactionNameEn: 'Old Guard',
      senderFactionNameAr: 'الحرس القديم',
      senderRole: 'directorate',
      messageType: 'chat',
      bodyEn: 'City Hall reminds all syndicates: Pier 4 customs sweeps rotate on the quarter-hour. Keep your ledgers clean.',
      bodyAr: 'تذكّر البلدية جميع النقابات: دوريات جمارك الرصيف الرابع تتناوب كل ربع ساعة. حافظوا على نظافة دفاتركم.',
      roll: null,
      createdAt: '1m ago'
    },
    {
      id: 3,
      messageId: 3,
      channel: 'global',
      scopeKey: 'global',
      senderPlayerId: 'npc-syndicate-apex',
      senderUsername: 'Duke_X',
      senderFactionId: 'oldguard',
      senderFactionNameEn: 'Old Guard',
      senderFactionNameAr: 'الحرس القديم',
      senderRole: 'officer',
      messageType: 'roll',
      bodyEn: '🎲 Duke_X rolled 2d6+3 → [5, 4] +3 = 12',
      bodyAr: '🎲 Duke_X رمى النرد 2d6+3 ← [5, 4] +3 = 12',
      roll: { expression: '2d6+3', count: 2, sides: 6, rolls: [5, 4], modifier: 3, total: 12 },
      createdAt: '1m ago'
    },
    {
      id: 4,
      messageId: 4,
      channel: 'district',
      scopeKey: 'center',
      senderPlayerId: 'npc-luna',
      senderUsername: 'Luna',
      senderFactionId: 'vipers',
      senderFactionNameEn: 'Sand Vipers',
      senderFactionNameAr: 'أفاعي الرمل',
      senderRole: 'oracle',
      messageType: 'chat',
      bodyEn: 'Downtown Core heat is rising near Financial Spire. Watch the rooftop zip-lines before breaching.',
      bodyAr: 'ترتفع حرارة قلب وسط المدينة قرب الحي المالي. راقبوا خطوط الانزلاق على الأسطح قبل الاقتحام.',
      roll: null,
      createdAt: '2m ago'
    },
    {
      id: 5,
      messageId: 5,
      channel: 'district',
      scopeKey: 'west',
      senderPlayerId: 'npc-harbor-king',
      senderUsername: 'Rayan_Black',
      senderFactionId: 'kings',
      senderFactionNameEn: 'Harbor Kings',
      senderFactionNameAr: 'ملوك المرفأ',
      senderRole: 'leader',
      messageType: 'emote',
      bodyEn: '* Rayan_Black signals the Pier 4 crane crew to lower container #09.',
      bodyAr: '* Rayan_Black يشير لطاقم رافعة الرصيف الرابع بإنزال الحاوية رقم 09.',
      roll: null,
      createdAt: '2m ago'
    },
    {
      id: 6,
      messageId: 6,
      channel: 'faction',
      scopeKey: 'vipers',
      senderPlayerId: 'npc-iron-enforcer',
      senderUsername: 'Marrow',
      senderFactionId: 'vipers',
      senderFactionNameEn: 'Sand Vipers',
      senderFactionNameAr: 'أفاعي الرمل',
      senderRole: 'officer',
      messageType: 'chat',
      bodyEn: 'Chain timer is hot! Stack Xanax, check armory blood bags, and hold the central sector wall.',
      bodyAr: 'مؤقت السلسلة مشتعل! جهزوا الزاناكس، وافحصوا أكياس الدم في الترسانة، واثبتوا على جدار القطاع المركزي.',
      roll: null,
      createdAt: '3m ago'
    },
    {
      id: 7,
      messageId: 7,
      channel: 'faction',
      scopeKey: 'vipers',
      senderPlayerId: 'npc-mayor-tariq',
      senderUsername: 'Mayor Tariq',
      senderFactionId: 'vipers',
      senderFactionNameEn: 'Sand Vipers',
      senderFactionNameAr: 'أفاعي الرمل',
      senderRole: 'directorate',
      messageType: 'chat',
      bodyEn: 'Municipal immunity vouchers are staged in the vault for whichever squad locks down the 100-hit chain bonus.',
      bodyAr: 'تصاريح الحصانة البلدية جاهزة في الخزنة للفرقة التي تحسم مكافأة السلسلة عند 100 ضربة.',
      roll: null,
      createdAt: '3m ago'
    },
    {
      id: 8,
      messageId: 8,
      channel: 'trade',
      scopeKey: 'trade',
      senderPlayerId: 'npc-velvet-queen',
      senderUsername: 'Lady_Vega',
      senderFactionId: 'night',
      senderFactionNameEn: 'Night Market',
      senderFactionNameAr: 'السوق الليلي',
      senderRole: 'officer',
      messageType: 'chat',
      bodyEn: 'WTS Johannesburg Xanax bricks ($740k) + full Exotic Flower Set for Museum Points. 0% Bazaar tax active.',
      bodyAr: 'للبيع شحنات زاناكس جوهانسبرغ ($740k) + مجموعة الزهور النادرة الكاملة لنقاط المتحف. ضريبة البازار 0% نشطة.',
      roll: null,
      createdAt: '4m ago'
    },
    {
      id: 9,
      messageId: 9,
      channel: 'trade',
      scopeKey: 'trade',
      senderPlayerId: 'npc-night-broker',
      senderUsername: 'NadiaQuick',
      senderFactionId: 'night',
      senderFactionNameEn: 'Night Market',
      senderFactionNameAr: 'السوق الليلي',
      senderRole: 'leader',
      messageType: 'chat',
      bodyEn: 'WTB Lawyer Business Cards & Feathery Hotel Coupons — paying instant escrow cash at Financial Spire.',
      bodyAr: 'مطلوب شراء بطاقات المحامي وقسائم فندق فيذري — دفع نقدي فوري عبر الضمان في الحي المالي.',
      roll: null,
      createdAt: '4m ago'
    }
  ];

  /* ------------------------------------------------------------------------
   * 1. STATE MACHINE & STORE (`chat-system` ChatStateMachine)
   * ------------------------------------------------------------------------ */
  var store = {
    uiState: 'Minimized', // Init | Default | Focused | Members | Minimized | Hidden
    open: false,
    activeChannel: 'global',
    activeDistrict: 'center',
    autoGloss: false,
    expandedGlossIds: {},
    showMutePanel: false,
    mutedPlayers: {},
    messages: SEEDED_MESSAGES.slice(),
    latestSeq: 9,
    unreadByChannel: {
      global: 2,
      district: 1,
      faction: 1,
      trade: 1
    },
    draftText: '',
    lastSentAtMs: 0,
    busy: false,
    feedback: null
  };

  function isAr() {
    var html = document.documentElement;
    if (!html) return false;
    var lang = String(html.getAttribute('lang') || '').toLowerCase();
    var dir = String(html.getAttribute('dir') || '').toLowerCase();
    return lang.indexOf('ar') === 0 || dir === 'rtl';
  }

  function L() {
    return isAr() ? COPY.ar : COPY.en;
  }

  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPlayerProfile() {
    var st = window.__zoneState || (window.ZoneEngine && window.ZoneEngine.state) || {};
    var p = st.player || {};
    return {
      id: String(p.id || 'founder-player'),
      username: String(p.username || p.name || 'Founder'),
      factionId: String((p.faction && p.faction.id) || p.factionId || 'vipers'),
      factionNameEn: 'Sand Vipers',
      factionNameAr: 'أفاعي الرمل'
    };
  }

  function getTotalUnread() {
    var map = store.unreadByChannel;
    return Math.max(0, Number(map.global || 0) + Number(map.district || 0) + Number(map.faction || 0) + Number(map.trade || 0));
  }

  function setFeedback(text, tone) {
    store.feedback = text ? { text: String(text), tone: tone || 'sage' } : null;
    renderDrawer();
  }

  /* ------------------------------------------------------------------------
   * 2. MESSAGE-BUS DECORATOR PIPELINE & CRYPTOGRAPHIC DICE ROLLER
   * ------------------------------------------------------------------------ */
  function sanitizeMessageText(raw) {
    var cleaned = String(raw == null ? '' : raw)
      .replace(/[\u2410\u2406\u2411\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/<(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on[a-z]+\s*=/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      throw new Error('Chat message cannot be empty.');
    }
    if (cleaned.length > MAX_MESSAGE_LENGTH) {
      throw new Error('Chat message exceeds 280 character limit.');
    }
    return cleaned;
  }

  function cryptoRandomInt(min, max) {
    var range = max - min + 1;
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  function rollDiceExpression(expression) {
    var clean = String(expression == null ? '' : expression).trim().toLowerCase().replace(/\s+/g, '');
    if (!clean) clean = '1d20';
    var m = /^(\d{0,2})d(f|\d{1,4})([+-]\d{1,4})?$/i.exec(clean);
    if (!m) {
      throw new Error('Invalid dice expression: ' + expression);
    }
    var count = m[1] === '' ? 1 : parseInt(m[1], 10);
    var sidesRaw = m[2].toLowerCase();
    var modifier = m[3] ? parseInt(m[3], 10) : 0;

    if (count < 1 || count > 20) throw new Error('Dice count must be 1..20.');
    if (modifier < -1000 || modifier > 1000) throw new Error('Modifier must be -1000..1000.');

    var rolls = [];
    var sides = sidesRaw === 'f' ? 'F' : parseInt(sidesRaw, 10);
    if (sides !== 'F' && (sides < 2 || sides > 1000)) {
      throw new Error('Dice sides must be 2..1000.');
    }

    var sum = 0;
    for (var i = 0; i < count; i++) {
      var r = sides === 'F' ? cryptoRandomInt(-1, 1) : cryptoRandomInt(1, sides);
      rolls.push(r);
      sum += r;
    }

    var total = sum + modifier;
    var canonical = count + 'd' + sides + (modifier > 0 ? '+' + modifier : (modifier < 0 ? String(modifier) : ''));
    return {
      expression: canonical,
      count: count,
      sides: sides,
      rolls: rolls,
      modifier: modifier,
      total: total
    };
  }

  function buildBilingualGloss(text, targetLang) {
    var out = String(text || '');
    for (var i = 0; i < EN_AR_GLOSS_TERMS.length; i++) {
      var en = EN_AR_GLOSS_TERMS[i][0];
      var ar = EN_AR_GLOSS_TERMS[i][1];
      if (targetLang === 'ar') {
        out = out.replace(new RegExp(en, 'gi'), ar);
      } else {
        out = out.split(ar).join(en);
      }
    }
    return targetLang === 'ar' ? ('«' + out + '»') : ('[' + out + ']');
  }

  /* ------------------------------------------------------------------------
   * 3. INLINE HUD PILL MOUNT INSIDE #ztl-hud-inner (0px Footprint on Home)
   * ------------------------------------------------------------------------ */
  function mountHudPill() {
    if (document.querySelector('x-dc')) return null;
    var hudInner = document.getElementById('ztl-hud-inner');
    if (!hudInner) return null;

    var slot = document.getElementById('zcs-hud-chat-slot');
    if (slot && slot.parentElement !== hudInner) {
      if (slot.parentElement) slot.parentElement.removeChild(slot);
      slot = null;
    }

    if (!slot) {
      slot = document.createElement('span');
      slot.id = 'zcs-hud-chat-slot';
      slot.className = 'zcs-hud-chat-slot';
      slot.addEventListener('click', function (ev) {
        var btn = ev.target && typeof ev.target.closest === 'function'
          ? ev.target.closest('#zcs-hud-chat-btn')
          : null;
        if (btn) {
          ev.preventDefault();
          ev.stopPropagation();
          toggleDrawer();
        }
      });
      hudInner.appendChild(slot);
    } else if (hudInner.lastElementChild !== slot) {
      hudInner.appendChild(slot);
    }

    var copy = L();
    var unread = getTotalUnread();
    slot.innerHTML =
      '<button type="button" id="zcs-hud-chat-btn" class="ztl-hud-pill zcs-hud-pill" data-open="' + (store.open ? '1' : '0') + '" aria-label="Syndicate Chat (Hotkey C)">' +
        '<span>💬 ' + esc(copy.hudBtn) + '</span>' +
        '<bdi id="zcs-hud-unread-badge" class="ztl-bell-badge zcs-unread-badge"' + (unread > 0 ? '' : ' hidden') + '>' + unread + '</bdi>' +
      '</button>';

    return slot;
  }

  /* ------------------------------------------------------------------------
   * 4. 4-CHANNEL MMO CHAT DRAWER DOM & RENDERING
   * ------------------------------------------------------------------------ */
  function ensureDrawerDom() {
    if (!document.body || document.querySelector('x-dc')) return null;

    var backdrop = document.getElementById('zone-chat-drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'zone-chat-drawer-backdrop';
      backdrop.hidden = true;
      backdrop.addEventListener('click', closeDrawer);
      document.body.appendChild(backdrop);
    }

    var drawer = document.getElementById('zone-chat-drawer');
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'zone-chat-drawer';
      drawer.className = 'ztl-scope zcs-drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Syndicate MMO Chat Drawer');
      drawer.hidden = true;
      drawer.addEventListener('click', handleDrawerClick);
      drawer.addEventListener('input', handleDrawerInput);
      drawer.addEventListener('keydown', handleDrawerKeydown);
      document.body.appendChild(drawer);
    }

    return { backdrop: backdrop, drawer: drawer };
  }

  function renderDiceBadgeHtml(roll) {
    if (!roll || !Array.isArray(roll.rolls)) return '';
    var copy = L();
    var pips = '';
    for (var i = 0; i < roll.rolls.length; i++) {
      pips += '<bdi class="zcs-die-pip">[' + esc(roll.rolls[i]) + ']</bdi>';
    }
    var modStr = Number(roll.modifier || 0) > 0
      ? ('+' + roll.modifier)
      : (Number(roll.modifier || 0) < 0 ? String(roll.modifier) : '');

    return (
      '<div class="zcs-dice-badge" data-zcs-roll-badge="1" data-expression="' + esc(roll.expression) + '" data-total="' + esc(roll.total) + '">' +
        '<span>🎲 <bdi>' + esc(roll.expression) + '</bdi></span>' +
        pips +
        (modStr ? ('<bdi>' + esc(modStr) + '</bdi>') : '') +
        '<span class="zcs-dice-total">' + esc(copy.rollTotal) + ': <bdi>' + esc(roll.total) + '</bdi></span>' +
      '</div>'
    );
  }

  function renderDrawer() {
    mountHudPill();
    var nodes = ensureDrawerDom();
    if (!nodes) return;

    if (!store.open) {
      nodes.backdrop.hidden = true;
      nodes.drawer.hidden = true;
      return;
    }

    nodes.backdrop.hidden = false;
    nodes.drawer.hidden = false;

    var ar = isAr();
    var copy = L();
    var me = getPlayerProfile();
    var mutedKeys = Object.keys(store.mutedPlayers);

    var tabsHtml = '<nav class="zcs-channel-tabs" aria-label="Chat Channels">';
    for (var ci = 0; ci < CHANNELS.length; ci++) {
      var ch = CHANNELS[ci];
      var isAct = store.activeChannel === ch.id;
      var unreadCnt = Math.max(0, Number(store.unreadByChannel[ch.id] || 0));
      tabsHtml +=
        '<button type="button" class="zcs-channel-tab' + (isAct ? ' is-active' : '') + '" data-zcs-act="switch-channel" data-channel="' + ch.id + '">' +
          '<span>' + ch.icon + ' ' + esc(ar ? ch.ar : ch.en) + '</span>' +
          (unreadCnt > 0 ? ('<bdi class="zcs-tab-unread">' + unreadCnt + '</bdi>') : '') +
        '</button>';
    }
    tabsHtml += '</nav>';

    var mutePanelHtml = '';
    if (store.showMutePanel) {
      mutePanelHtml = '<div class="zcs-mute-panel" data-zcs-mute-panel="1">';
      if (mutedKeys.length === 0) {
        mutePanelHtml += '<div class="zcs-mute-row"><span>' + esc(copy.noMuted) + '</span></div>';
      } else {
        for (var mi = 0; mi < mutedKeys.length; mi++) {
          var mpid = mutedKeys[mi];
          var mName = store.mutedPlayers[mpid] || mpid;
          mutePanelHtml +=
            '<div class="zcs-mute-row" data-zcs-muted-player="' + esc(mpid) + '">' +
              '<span>🔇 <strong>' + esc(mName) + '</strong></span>' +
              '<button type="button" class="zcs-msg-tool-btn" data-zcs-act="unmute-player" data-player-id="' + esc(mpid) + '">🔊 ' + esc(copy.unmuteBtn) + '</button>' +
            '</div>';
        }
      }
      mutePanelHtml += '</div>';
    }

    var feedbackHtml = store.feedback
      ? '<div class="zcs-feedback-strip" data-tone="' + esc(store.feedback.tone) + '">' +
          '<span>' + esc(store.feedback.text) + '</span>' +
          '<button type="button" class="zcs-msg-tool-btn" data-zcs-act="clear-feedback">✕</button>' +
        '</div>'
      : '';

    var channelMsgs = store.messages.filter(function (m) {
      return m && m.channel === store.activeChannel && !store.mutedPlayers[m.senderPlayerId];
    });

    var feedHtml = '<div class="zcs-feed" id="zcs-feed">';
    for (var i = 0; i < channelMsgs.length; i++) {
      var msg = channelMsgs[i];
      var msgId = String(msg.id || msg.messageId || (i + 1));
      var primaryBody = ar ? (msg.bodyAr || msg.bodyEn) : (msg.bodyEn || msg.bodyAr);
      var secondaryGloss = ar ? (msg.bodyEn || msg.bodyAr) : (msg.bodyAr || msg.bodyEn);
      var showGloss = Boolean(store.autoGloss || store.expandedGlossIds[msgId]);
      var factionLabel = ar
        ? (msg.senderFactionNameAr || 'النقابة')
        : (msg.senderFactionNameEn || 'Syndicate');
      var canMute = String(msg.senderPlayerId) !== String(me.id);

      feedHtml +=
        '<article class="zcs-msg-card" data-zcs-msg-id="' + esc(msgId) + '" data-msg-type="' + esc(msg.messageType || 'chat') + '">' +
          '<div class="zcs-msg-head">' +
            '<div class="zcs-sender-wrap">' +
              '<span class="zcs-sender-name">' + esc(msg.senderUsername || msg.senderPlayerId) + '</span>' +
              '<span class="zcs-faction-tag">' + esc(factionLabel) + '</span>' +
            '</div>' +
            '<div class="zcs-msg-tools">' +
              '<button type="button" class="zcs-msg-tool-btn" data-zcs-act="toggle-msg-gloss" data-id="' + esc(msgId) + '" title="Toggle EN/AR Gloss">🌐 EN/AR</button>' +
              (canMute
                ? '<button type="button" class="zcs-msg-tool-btn" data-zcs-act="mute-player" data-player-id="' + esc(msg.senderPlayerId) + '" data-username="' + esc(msg.senderUsername) + '" title="' + esc(copy.mutePlayerTitle) + '">🔇</button>'
                : '') +
            '</div>' +
          '</div>' +
          '<div class="zcs-msg-body">' + esc(primaryBody) + '</div>' +
          (msg.roll ? renderDiceBadgeHtml(msg.roll) : '') +
          '<div class="zcs-msg-gloss"' + (showGloss ? '' : ' hidden') + ' data-zcs-gloss-for="' + esc(msgId) + '">' +
            '🌐 <bdi>' + esc(secondaryGloss) + '</bdi>' +
          '</div>' +
        '</article>';
    }
    feedHtml += '</div>';

    var draftLen = String(store.draftText || '').length;

    nodes.drawer.innerHTML =
      '<header class="zcs-drawer-head">' +
        '<div class="zcs-drawer-title-wrap">' +
          '<h2 class="zcs-drawer-title">💬 ' + esc(copy.drawerTitle) + '</h2>' +
          '<span class="zcs-drawer-sub">' + esc(copy.drawerSub) + '</span>' +
        '</div>' +
        '<div class="zcs-head-actions">' +
          '<button type="button" class="zcs-icon-btn" data-zcs-act="toggle-all-gloss" data-active="' + (store.autoGloss ? '1' : '0') + '">🌐 ' + esc(copy.glossBtn) + '</button>' +
          '<button type="button" class="zcs-icon-btn" data-zcs-act="toggle-mute-panel" data-active="' + (store.showMutePanel ? '1' : '0') + '">🔇 ' + esc(copy.mutedBtn) + ' <bdi>(' + mutedKeys.length + ')</bdi></button>' +
          '<button type="button" class="zcs-icon-btn" data-zcs-act="close-drawer">' + esc(copy.closeBtn) + ' ✕</button>' +
        '</div>' +
      '</header>' +
      tabsHtml +
      mutePanelHtml +
      feedbackHtml +
      feedHtml +
      '<footer class="zcs-composer">' +
        '<div class="zcs-quick-bar">' +
          '<button type="button" class="zcs-quick-chip" data-zcs-act="quick-cmd" data-cmd="/roll 2d6+3">🎲 /roll 2d6+3</button>' +
          '<button type="button" class="zcs-quick-chip" data-zcs-act="quick-cmd" data-cmd="/roll 1d20+5">🎲 /roll 1d20+5</button>' +
          '<button type="button" class="zcs-quick-chip" data-zcs-act="quick-cmd" data-cmd="/me checks the sector perimeter.">✋ /me</button>' +
          '<button type="button" class="zcs-quick-chip" data-zcs-act="quick-cmd" data-cmd="/help">❓ /help</button>' +
        '</div>' +
        '<div class="zcs-input-row">' +
          '<input type="text" id="zcs-chat-input" class="zcs-input" maxlength="280" value="' + esc(store.draftText) + '" placeholder="' + esc(copy.inputPlaceholder) + '" aria-label="Chat message input">' +
          '<button type="button" id="zcs-chat-send-btn" class="zcs-send-btn" data-zcs-act="send-msg"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.sendBtn) + '</button>' +
        '</div>' +
        '<div class="zcs-meta-row">' +
          '<span>' + esc(copy.hotkeyHint) + '</span>' +
          '<bdi id="zcs-char-counter">' + draftLen + ' / ' + MAX_MESSAGE_LENGTH + '</bdi>' +
        '</div>' +
      '</footer>';
  }

  /* ------------------------------------------------------------------------
   * 5. COMMANDS, SEND FLOW, MUTE/UNMUTE & SERVER DELTA SYNC
   * ------------------------------------------------------------------------ */
  function openDrawer(channel) {
    if (channel && /^(global|district|faction|trade)$/.test(channel)) {
      store.activeChannel = channel;
    }
    store.open = true;
    store.uiState = 'Default';
    store.unreadByChannel[store.activeChannel] = 0;
    renderDrawer();
    pollServerSnapshot();
  }

  function closeDrawer() {
    store.open = false;
    store.uiState = 'Minimized';
    renderDrawer();
  }

  function toggleDrawer(channel) {
    if (store.open) closeDrawer();
    else openDrawer(channel);
    return store.open;
  }

  function switchChannel(channel) {
    var clean = String(channel || 'global').toLowerCase();
    if (!/^(global|district|faction|trade)$/.test(clean)) clean = 'global';
    store.activeChannel = clean;
    store.unreadByChannel[clean] = 0;
    renderDrawer();
    pollServerSnapshot();
    return clean;
  }

  function toggleAutoGloss() {
    store.autoGloss = !store.autoGloss;
    renderDrawer();
    return store.autoGloss;
  }

  function toggleMessageGloss(msgId) {
    var key = String(msgId || '');
    if (!key) return false;
    store.expandedGlossIds[key] = !store.expandedGlossIds[key];
    renderDrawer();
    return Boolean(store.expandedGlossIds[key]);
  }

  function mutePlayer(playerId, username) {
    var pid = String(playerId || '').trim();
    var me = getPlayerProfile();
    if (!pid || pid === me.id) return false;
    store.mutedPlayers[pid] = String(username || pid);
    setFeedback(L().msgMutedToast, 'warn');

    if (typeof window.fetch === 'function') {
      try {
        window.fetch('/api/v1/syndicate-chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mute_sender',
            mutedPlayerId: pid,
            mutedUsername: String(username || pid)
          })
        }).catch(function () {});
      } catch (_) {}
    }
    return true;
  }

  function unmutePlayer(playerId) {
    var pid = String(playerId || '').trim();
    if (!pid) return false;
    delete store.mutedPlayers[pid];
    setFeedback(L().msgUnmutedToast, 'sage');

    if (typeof window.fetch === 'function') {
      try {
        window.fetch('/api/v1/syndicate-chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unmute_sender',
            mutedPlayerId: pid
          })
        }).catch(function () {});
      } catch (_) {}
    }
    return true;
  }

  function sendMessage(rawText, channelOverride) {
    var text = rawText != null ? String(rawText) : String(store.draftText || '');
    var clean;
    try {
      clean = sanitizeMessageText(text);
    } catch (err) {
      setFeedback(err.message, 'bad');
      return null;
    }

    var nowMs = Date.now();
    if (store.lastSentAtMs > 0 && (nowMs - store.lastSentAtMs) < RATE_LIMIT_MS) {
      setFeedback(L().rateWait, 'warn');
      return null;
    }
    store.lastSentAtMs = nowMs;

    var ch = channelOverride || store.activeChannel || 'global';
    var me = getPlayerProfile();
    var msgType = 'chat';
    var bodyEn = clean;
    var bodyAr = buildBilingualGloss(clean, 'ar');
    var rollData = null;

    if (clean.charAt(0) === '/') {
      var parts = clean.split(/\s+/);
      var cmd = parts[0].toLowerCase();
      var argStr = clean.slice(parts[0].length).trim();

      if (cmd === '/roll' || cmd === '/dice' || cmd === '/r') {
        try {
          rollData = rollDiceExpression(argStr || '1d20');
        } catch (rollErr) {
          setFeedback(rollErr.message, 'bad');
          return null;
        }
        msgType = 'roll';
        var modPart = rollData.modifier > 0 ? (' +' + rollData.modifier) : (rollData.modifier < 0 ? (' ' + rollData.modifier) : '');
        bodyEn = '🎲 ' + me.username + ' rolled ' + rollData.expression + ' → [' + rollData.rolls.join(', ') + ']' + modPart + ' = ' + rollData.total;
        bodyAr = '🎲 ' + me.username + ' رمى النرد ' + rollData.expression + ' ← [' + rollData.rolls.join(', ') + ']' + modPart + ' = ' + rollData.total;
      } else if (cmd === '/me' || cmd === '/emote') {
        if (!argStr) {
          setFeedback('Usage: /me <action>', 'bad');
          return null;
        }
        msgType = 'emote';
        bodyEn = '* ' + me.username + ' ' + argStr;
        bodyAr = '* ' + me.username + ' ' + buildBilingualGloss(argStr, 'ar');
      } else if (cmd === '/help' || cmd === '/?') {
        msgType = 'system';
        bodyEn = '⚙ Commands: /roll <NdM+K> (2d6+3, 1d20+5, 4dF), /me <emote>, /help';
        bodyAr = '⚙ الأوامر: /roll <NdM+K> (مثل 2d6+3 أو 1d20+5)، /me <حركة>، /help';
      } else {
        setFeedback('Unknown command: ' + cmd, 'bad');
        return null;
      }
    }

    store.latestSeq += 1;
    var msgObj = {
      id: store.latestSeq,
      messageId: store.latestSeq,
      channel: ch,
      scopeKey: ch,
      senderPlayerId: me.id,
      senderUsername: me.username,
      senderFactionId: me.factionId,
      senderFactionNameEn: me.factionNameEn,
      senderFactionNameAr: me.factionNameAr,
      senderRole: 'operative',
      messageType: msgType,
      bodyEn: bodyEn,
      bodyAr: bodyAr,
      roll: rollData,
      createdAt: 'Just now'
    };

    store.messages.push(msgObj);
    store.draftText = '';
    store.feedback = null;
    renderDrawer();

    if (typeof window.fetch === 'function') {
      try {
        window.fetch('/api/v1/syndicate-chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_message',
            channel: ch,
            district: store.activeDistrict,
            message: clean
          })
        })
          .then(function (r) { return r && r.ok ? r.json() : null; })
          .then(function (res) {
            if (res && res.ok && res.message) {
              msgObj.id = res.message.id || msgObj.id;
              msgObj.messageId = res.message.messageId || msgObj.messageId;
              msgObj.bodyEn = res.message.bodyEn || msgObj.bodyEn;
              msgObj.bodyAr = res.message.bodyAr || msgObj.bodyAr;
              if (res.message.roll) msgObj.roll = res.message.roll;
              renderDrawer();
            }
          })
          .catch(function () {});
      } catch (_) {}
    }

    return msgObj;
  }

  function pollServerSnapshot() {
    if (typeof window.fetch !== 'function') return;
    try {
      var url = '/api/v1/syndicate-chat?channel=' + encodeURIComponent(store.activeChannel) + '&sinceId=' + encodeURIComponent(String(store.latestSeq));
      window.fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.ok || !Array.isArray(data.messages)) return;
          var added = false;
          for (var i = 0; i < data.messages.length; i++) {
            var m = data.messages[i];
            var mid = Number(m.messageId || m.id || 0);
            if (mid > store.latestSeq) {
              store.latestSeq = mid;
              store.messages.push(m);
              if (!store.open || m.channel !== store.activeChannel) {
                store.unreadByChannel[m.channel] = (store.unreadByChannel[m.channel] || 0) + 1;
              }
              added = true;
            }
          }
          if (added) renderDrawer();
        })
        .catch(function () {});
    } catch (_) {}
  }

  /* ------------------------------------------------------------------------
   * 6. DOM EVENT HANDLERS & HOTKEY `C`
   * ------------------------------------------------------------------------ */
  function handleDrawerClick(ev) {
    var target = ev.target && typeof ev.target.closest === 'function'
      ? ev.target.closest('[data-zcs-act]')
      : null;
    if (!target || target.disabled) return;
    ev.preventDefault();

    var act = target.getAttribute('data-zcs-act');
    if (act === 'close-drawer') {
      closeDrawer();
    } else if (act === 'switch-channel') {
      switchChannel(target.getAttribute('data-channel') || 'global');
    } else if (act === 'toggle-all-gloss') {
      toggleAutoGloss();
    } else if (act === 'toggle-msg-gloss') {
      toggleMessageGloss(target.getAttribute('data-id'));
    } else if (act === 'toggle-mute-panel') {
      store.showMutePanel = !store.showMutePanel;
      renderDrawer();
    } else if (act === 'mute-player') {
      mutePlayer(target.getAttribute('data-player-id'), target.getAttribute('data-username'));
    } else if (act === 'unmute-player') {
      unmutePlayer(target.getAttribute('data-player-id'));
    } else if (act === 'clear-feedback') {
      setFeedback(null);
    } else if (act === 'quick-cmd') {
      var cmd = target.getAttribute('data-cmd') || '/roll 2d6+3';
      sendMessage(cmd);
    } else if (act === 'send-msg') {
      var inp = document.getElementById('zcs-chat-input');
      if (inp) store.draftText = inp.value;
      sendMessage(store.draftText);
    }
  }

  function handleDrawerInput(ev) {
    var el = ev.target;
    if (el && el.id === 'zcs-chat-input') {
      store.draftText = String(el.value || '');
      store.uiState = 'Focused';
      var counter = document.getElementById('zcs-char-counter');
      if (counter) {
        counter.textContent = store.draftText.length + ' / ' + MAX_MESSAGE_LENGTH;
      }
    }
  }

  function handleDrawerKeydown(ev) {
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'zcs-chat-input') {
      ev.preventDefault();
      store.draftText = String(ev.target.value || '');
      sendMessage(store.draftText);
    }
  }

  function isTypingInField(el) {
    if (!el) return false;
    var tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  window.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented) return;
    if (ev.key === 'Escape' && store.open) {
      closeDrawer();
      return;
    }
    if ((ev.key === 'c' || ev.key === 'C') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (isTypingInField(document.activeElement) || isTypingInField(ev.target)) return;
      ev.preventDefault();
      toggleDrawer();
    }
  });

  /* Re-verify inline HUD pill docking when DOM mutates or language switches */
  function initChatSystem() {
    mountHudPill();
    ensureDrawerDom();
    setInterval(function () {
      mountHudPill();
    }, 1500);
    setInterval(function () {
      if (store.open) pollServerSnapshot();
    }, POLL_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatSystem);
  } else {
    initChatSystem();
  }

  /* Public API exposed on window.ZoneChatSystem */
  window.ZoneChatSystem = {
    version: '159.0.0',
    open: openDrawer,
    close: closeDrawer,
    toggle: toggleDrawer,
    switchChannel: switchChannel,
    sendMessage: sendMessage,
    rollDice: rollDiceExpression,
    sanitizeText: sanitizeMessageText,
    toggleAutoGloss: toggleAutoGloss,
    toggleMessageGloss: toggleMessageGloss,
    mutePlayer: mutePlayer,
    unmutePlayer: unmutePlayer,
    getUnreadCount: getTotalUnread,
    getState: function () { return store; },
    mountHudPill: mountHudPill,
    render: renderDrawer
  };
})();

/* ==========================================================================
 * ZONE v136 - MAYOR TARIQ "THE OWL" MANSOUR INTERACTIVE CHARACTER WIDGET
 * Torn-inspired recurring charismatic city fixer & shadow-mayor who pops in
 * as a floating hand-drawn sketchbook speech bubble with live player state
 * awareness, 3 watercolor expressions, EN/AR banter, 1-click moves & rumors.
 * Fiber-safe: mounts outside <x-dc> directly on document.body.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneMayorWidgetLoaded) return;
  window.__zoneMayorWidgetLoaded = true;

  var STORAGE_MIN_KEY = 'zone.mayor.minimized';
  var STORAGE_SEEN_KEY = 'zone.mayor.seenScreens';

  var PORTRAITS = {
    idle: '/assets/ui/watercolor-art/mayor-tariq-idle.webp',
    scheming: '/assets/ui/watercolor-art/mayor-tariq-scheming.webp',
    alert: '/assets/ui/watercolor-art/mayor-tariq-alert.webp'
  };

  var MAYOR_META = {
    en: {
      name: 'Mayor Tariq "The Owl"',
      shortTag: 'THE MAYOR',
      moods: { idle: 'CITY BRIEF', scheming: 'STREET DEAL', alert: 'RED ALERT' },
      tabs: { smart: 'Smart Move', district: 'District Tip', rumor: 'City Rumor' },
      nextTitle: 'Another line from the Mayor',
      closeTitle: 'Minimize Mayor',
      openLabel: 'Open Mayor Tariq briefing bubble'
    },
    ar: {
      name: 'العمدة طارق «البومة»',
      shortTag: 'العمدة طارق',
      moods: { idle: 'إيجاز المدينة', scheming: 'صفقة شارع', alert: 'إنذار عاجل' },
      tabs: { smart: 'الخطوة الذكية', district: 'نصيحة المنطقة', rumor: 'إشاعة المدينة' },
      nextTitle: 'جملة أخرى من العمدة',
      closeTitle: 'تصغير العمدة',
      openLabel: 'افتح فقاعة العمدة طارق'
    }
  };

  /* All 19 District Briefings (Bilingual, witty Torn-style street personality) */
  var DISTRICT_LINES = {
    home: [
      {
        mood: 'idle',
        kickerEn: 'SAFEHOUSE CHECK-IN', kickerAr: 'تفقد المخبأ',
        en: 'Welcome back to your desk, kid. Every empire in Zone City starts with two habits: burn your Energy at the Gym, and never let Nerve sit capped.',
        ar: 'أهلاً بعودتك يا بطل. كل إمبراطورية في مدينة زون تبدأ بعادتين: احرق طاقتك في النادي الرياضي، ولا تترك الجرأة ممتلئة بلا عمل.',
        actions: [
          { labelEn: 'Run Street Crime', labelAr: 'نفّذ عملية', screen: 'crimes', primary: true },
          { labelEn: 'Hit the Gym', labelAr: 'تدرّب بالنادي', screen: 'gym' }
        ]
      },
      {
        mood: 'scheming',
        kickerEn: 'SYNDICATE ARCADE', kickerAr: 'طاولات الأركيد',
        en: 'Need a quick adrenaline warm-up between contracts? Test your hands on the Safe-Crack Heist or Velvet Roulette right here on your Safehouse table.',
        ar: 'تريد تسخيناً سريعاً بين العقود؟ جرّب كسر الخزنة أو روليت المخمل مباشرة هنا على طاولة مخبئك.',
        actions: [
          { labelEn: 'Open City Map', labelAr: 'افتح خريطة المدينة', screen: 'city', primary: true },
          { labelEn: 'Check Missions', labelAr: 'لوحة المهمات', screen: 'missions' }
        ]
      }
    ],
    city: [
      {
        mood: 'idle',
        kickerEn: 'ZONE CITY ATLAS', kickerAr: 'أطلس مدينة زون',
        en: 'Look at that skyline, kid - eighteen districts, five sectors, and four syndicate families fighting over every block. Tap any teardrop pin or flip to the 3D Block Map.',
        ar: 'تأمل هذا الأفق يا صاحبي: ثمانية عشر حياً وخمسة قطاعات وأربع عائلات تتقاتل على كل شارع. اضغط أي دبوس أو بدّل إلى خريطة المباني ثلاثية الأبعاد.',
        actions: [
          { labelEn: 'Toggle 3D Map', labelAr: 'افتح خريطة 3D', action: 'toggle3d', primary: true },
          { labelEn: 'My Faction', labelAr: 'عائلتي', screen: 'faction' }
        ]
      },
      {
        mood: 'scheming',
        kickerEn: 'OUTER SECTORS', kickerAr: 'القطاعات الخارجية',
        en: 'Once you level up, the real money waits past the river: West Neon Casino Strip at Lv.3, Smuggler Docks at Lv.5, and the Sovereign Financial Citadel at Lv.10.',
        ar: 'مع ارتفاع مستواك، المال الحقيقي ينتظرك خلف النهر: شارع النيون بالمستوى 3، مرافئ التهريب بالمستوى 5، والقلعة المالية بالمستوى 10.',
        actions: [
          { labelEn: 'Earn XP in Crimes', labelAr: 'اجمع خبرة بالجرائم', screen: 'crimes', primary: true }
        ]
      }
    ],
    crimes: [
      {
        mood: 'scheming',
        kickerEn: 'CLEAN HANDS, DIRTY CASH', kickerAr: 'أيدٍ نظيفة ونقد ساخن',
        en: 'Start with Search for Cash and Graffiti to build your Nerve ceiling cleanly. Pushing big heists with low Crime XP is how rookies meet my friends at the Jail.',
        ar: 'ابدأ بالبحث عن النقود والكتابة على الجدران لرفع سقف الجرأة بأمان. القفز لعمليات كبرى مبكراً هو أسرع تذكرة إلى السجن.',
        actions: [
          { labelEn: 'Stash Cash at Bank', labelAr: 'أودع النقود بالبنك', screen: 'bank' },
          { labelEn: 'Claim Missions', labelAr: 'استلم المهمات', screen: 'missions', primary: true }
        ]
      },
      {
        mood: 'idle',
        kickerEn: 'HEAT MANAGEMENT', kickerAr: 'إدارة حرارة الشارع',
        en: 'Watch your street heat, kid. When a racket pays out big, sweep your cash into the Central Bank vault before rival scouts smell it.',
        ar: 'راقب حرارة الشارع جيداً. عندما تخرج بغنيمة سمينة، حوّلها فوراً لخزنة البنك المركزي قبل أن يشمّ الخصوم رائحتها.',
        actions: [
          { labelEn: 'Central Bank', labelAr: 'البنك المركزي', screen: 'bank', primary: true }
        ]
      }
    ],
    gym: [
      {
        mood: 'idle',
        kickerEn: 'IRON & DISCIPLINE', kickerAr: 'الحديد والانضباط',
        en: 'A sharp gun buys one round; high Strength, Speed, and Dexterity win the whole war. Raise your Happiness with a better Property before burning Energy here.',
        ar: 'السلاح الجيد يكسب جولة واحدة، لكن القوة والسرعة والرشاقة تحسم الحرب كلها. ارفع معنوياتك بتطوير مسكنك قبل حرق الطاقة هنا.',
        actions: [
          { labelEn: 'Upgrade Property', labelAr: 'طوّر مسكنك', screen: 'properties', primary: true },
          { labelEn: 'Test in Combat', labelAr: 'جرّب القتال', screen: 'attack' }
        ]
      }
    ],
    bank: [
      {
        mood: 'idle',
        kickerEn: 'VAULT PROTOCOL', kickerAr: 'بروتوكول الخزنة',
        en: 'Smartest room in Zone City. Street cash gets mugged in alleys; vaulted cash compounds quietly in term CDs while you sleep.',
        ar: 'أذكى غرفة في مدينة زون. النقود في جيبك مطمع للنشالين، أما نقود الخزنة فتتضاعف بهدوء في شهادات الإيداع بينما تنام.',
        actions: [
          { labelEn: 'Item Market', labelAr: 'سوق العتاد', screen: 'market' },
          { labelEn: 'Properties', labelAr: 'العقارات', screen: 'properties', primary: true }
        ]
      }
    ],
    casino: [
      {
        mood: 'scheming',
        kickerEn: 'VELVET TABLES', kickerAr: 'طاولات المخمل',
        en: 'I own three chairs in this room and I still tell my favorites the same rule: pocket half your winnings the second you hit a hot Blackjack streak.',
        ar: 'أملك ثلاثة مقاعد في هذه القاعة وما زلت أنصح المقرّبين بنفس القاعدة: خبّئ نصف أرباحك في البنك فور أول سلسلة فوز في البلاك جاك.',
        actions: [
          { labelEn: 'Lock Gains in Bank', labelAr: 'احفظ الأرباح بالبنك', screen: 'bank', primary: true }
        ]
      }
    ],
    attack: [
      {
        mood: 'alert',
        kickerEn: 'STREET CLASH BRIEF', kickerAr: 'إيجاز الاشتباك',
        en: 'Every fight costs 25 Energy. Check your equipped primary weapon and body armor in Items first - going in bare-handed makes for a very short newspaper headline.',
        ar: 'كل اشتباك يستهلك 25 طاقة. راجع سلاحك الأساسي ودرعك في العتاد أولاً، فالدخول بيدين فارغتين يصنع خبراً قصيراً جداً في الصحيفة.',
        actions: [
          { labelEn: 'Equip Loadout', labelAr: 'جهّز العتاد', screen: 'items', primary: true },
          { labelEn: 'Hospital Ward', labelAr: 'المستشفى', screen: 'hospital' }
        ]
      }
    ],
    items: [
      {
        mood: 'idle',
        kickerEn: 'ARMORY & GEAR', kickerAr: 'الترسانة والعتاد',
        en: 'Inspect your hardware in 3D, keep a pair of First Aid Kits on standby, and upgrade to a high-accuracy rifle the minute your bankroll allows.',
        ar: 'افحص أسلحتك، واحتفظ دائماً بحقيبتي إسعاف للطوارئ، وانتقل إلى بندقية عالية الدقة فور أن يسمح رصيدك.',
        actions: [
          { labelEn: 'Browse Market', labelAr: 'تصفح السوق', screen: 'market', primary: true },
          { labelEn: 'Combat Arena', labelAr: 'ساحة القتال', screen: 'attack' }
        ]
      }
    ],
    jobs: [
      {
        mood: 'idle',
        kickerEn: 'DAYTIME COVER', kickerAr: 'الغطاء الرسمي',
        en: 'Even the biggest bosses keep a clean payroll on paper. Clock your shifts for steady cash, job points, and company specials that stack permanently.',
        ar: 'حتى أكبر زعماء المدينة يحتفظون بوظيفة رسمية على الورق. أنجز وردياتك لراتب ثابت ونقاط وظيفة ومزايا شركات تراكمية.',
        actions: [
          { labelEn: 'Enroll in Education', labelAr: 'سجّل في التعليم', screen: 'education', primary: true }
        ]
      }
    ],
    properties: [
      {
        mood: 'scheming',
        kickerEn: 'REAL ESTATE LEVERAGE', kickerAr: 'قوة العقار',
        en: 'Better roof, higher Happiness ceiling, faster Gym gains. Moving from a Shack to a Villa or Private Island multiplies every single Energy point you spend.',
        ar: 'سقف أفخم يعني معنويات أعلى وتدريباً أسرع. الانتقال من الكوخ إلى الفيلا أو الجزيرة الخاصة يضاعف قيمة كل نقطة طاقة تصرفها.',
        actions: [
          { labelEn: 'Train at Gym', labelAr: 'تدرّب بالنادي', screen: 'gym', primary: true }
        ]
      }
    ],
    education: [
      {
        mood: 'idle',
        kickerEn: 'UNIVERSITY HILL', kickerAr: 'تلة الجامعة',
        en: 'Never leave your course slot empty, kid. Education perks never expire and they cannot be mugged off you - pure permanent edge.',
        ar: 'لا تترك مقعدك الدراسي فارغاً أبداً. مزايا التعليم دائمة ولا يمكن لأحد سرقتها منك - تفوّق صافي مدى الحياة.',
        actions: [
          { labelEn: 'View Jobs', labelAr: 'استعرض الوظائف', screen: 'jobs' }
        ]
      }
    ],
    missions: [
      {
        mood: 'scheming',
        kickerEn: 'FIXER CONTRACTS', kickerAr: 'عقود العمدة',
        en: 'These are my personal street contracts. Knock them out while doing your regular Crimes and Gym runs for bonus cash, XP, and Merits.',
        ar: 'هذه عقودي الشخصية في الشارع. أنجزها بالتوازي مع جرائمك وتدريبك لتجمع نقوداً إضافية وخبرة وأوسمة.',
        actions: [
          { labelEn: 'Street Crimes', labelAr: 'جرائم الشوارع', screen: 'crimes', primary: true }
        ]
      }
    ],
    newspaper: [
      {
        mood: 'idle',
        kickerEn: 'CITY GAZETTE & INTEL', kickerAr: 'صحيفة المدينة والاستخبارات',
        en: 'Read the Gazette like a broker, not a tourist. Bounties tell you who has enemies, and market movers tell you where the smart money is flowing.',
        ar: 'اقرأ الصحيفة بعين سمسار لا سائح. المكافآت تكشف من لديه أعداء، وتحركات السوق تكشف أين تتدفق الأموال الذكية.',
        actions: [
          { labelEn: 'Item Market', labelAr: 'سوق العتاد', screen: 'market', primary: true }
        ]
      }
    ],
    jail: [
      {
        mood: 'alert',
        kickerEn: 'FORTRESS BASTION', kickerAr: 'سجن الحصن',
        en: 'Iron bars are just a temporary inconvenience. Bust out fellow operatives for quick XP - or if you are inside, pay bail and vanish.',
        ar: 'القضبان مجرد عطلة مؤقتة. هرّب العملاء الآخرين لكسب خبرة سريعة، وإذا كنت بالداخل ادفع الكفالة واختفِ.',
        actions: [
          { labelEn: 'Back to City', labelAr: 'العودة للمدينة', screen: 'city' }
        ]
      }
    ],
    hospital: [
      {
        mood: 'alert',
        kickerEn: 'TRAUMA WARD', kickerAr: 'قسم الطوارئ',
        en: 'Patch yourself up fast and get back on your feet. Keep spare Blood Bags and First Aid Kits stocked so rival crews never catch you flat-footed.',
        ar: 'داوِ جراحك بسرعة وعُد للشارع. احتفظ دائماً بأكياس دم وحقائب إسعاف حتى لا يستغلك الخصوم وأنت طريح الفراش.',
        actions: [
          { labelEn: 'Check Medical Kits', labelAr: 'افحص حقائب الإسعاف', screen: 'items', primary: true }
        ]
      }
    ],
    hof: [
      {
        mood: 'idle',
        kickerEn: 'HALL OF FAME', kickerAr: 'قاعة المشاهير',
        en: 'Every name on that board started at Level 1 with $2,500 and a dream. Stay consistent every day and I will carve your name near the top.',
        ar: 'كل اسم على هذه اللوحة بدأ بالمستوى الأول و2,500 دولار فقط. استمر كل يوم وسأحفر اسمك قرب القمة بنفسي.',
        actions: [
          { labelEn: 'Train Stats', labelAr: 'ارفع صفاتك', screen: 'gym', primary: true }
        ]
      }
    ],
    faction: [
      {
        mood: 'scheming',
        kickerEn: 'SYNDICATE COUNCIL', kickerAr: 'مجلس العائلة',
        en: 'Lone wolves survive; Factions own the skyline. Coordinate attack chains and claim adjacent City blocks to unlock shared family perks.',
        ar: 'الذئب المنفرد ينجو، لكن العائلات تملك الأفق. نسّق سلاسل الهجوم واستحوذ على قطاعات المدينة لفتح مزايا العائلة.',
        actions: [
          { labelEn: 'Inspect Territory Map', labelAr: 'افحص خريطة الأراضي', screen: 'city', primary: true }
        ]
      }
    ],
    elimination: [
      {
        mood: 'alert',
        kickerEn: 'TURF ELIMINATION', kickerAr: 'حرب التصفيات',
        en: 'High-stakes syndicate knockout. Hospitalize rival targets before the clock runs out and stack points for your crew.',
        ar: 'تصفية عالية المخاطر بين العصابات. أدخل أهداف الخصم إلى المستشفى قبل انتهاء الوقت واجمع النقاط لفريقك.',
        actions: [
          { labelEn: 'Launch Attack', labelAr: 'ابدأ الهجوم', screen: 'attack', primary: true }
        ]
      }
    ],
    market: [
      {
        mood: 'scheming',
        kickerEn: 'OLD TOWN MARKET', kickerAr: 'سوق البلدة القديمة',
        en: 'Buy low when rookies panic-sell, stock up on boosters and armor, and flip rare gear when Turf Wars heat up.',
        ar: 'اشترِ بسعر منخفض حين يبيع المبتدئون بذعر، وخزّن المنشطات والدروع، وبِع العتاد النادر حين تشتعل حروب الأراضي.',
        actions: [
          { labelEn: 'View Armory', labelAr: 'استعرض عتادك', screen: 'items', primary: true }
        ]
      }
    ]
  };

  var CITY_RUMORS = [
    {
      mood: 'scheming',
      en: 'Word from Pier 9: two freighters just docked under Vipers banners, and half the crates are not on any customs manifest.',
      ar: 'خبر طازج من الرصيف 9: سفينتا شحن رست للتو تحت راية الأفاعي، ونصف الحاويات غير مسجلة في أي كشف جمركي.'
    },
    {
      mood: 'idle',
      en: 'They call me "The Owl" because I never sleep and I know which lights stay on in the Sovereign Financial Citadel past 3 AM.',
      ar: 'يلقبونني بـ«البومة» لأنني لا أنام وأعرف تماماً أي الأضواء تبقى مشتعلة في القلعة المالية بعد الثالثة فجراً.'
    },
    {
      mood: 'scheming',
      en: 'Rumor at Velvet Underground VIP: a high-roller from Monte Carlo dropped $40,000 on red and tipped the dealer with a vintage Rolex.',
      ar: 'إشاعة من كازينو المخمل: مقامر من مونت كارلو راهن بـ40 ألف دولار على الأحمر وأعطى الموزّع ساعة رولكس إكرامية.'
    },
    {
      mood: 'alert',
      en: 'The Old Guard and Night Syndicate have been trading punches near University Hill. Great time to sell First Aid Kits on the Market.',
      ar: 'الحرس القديم ونقابة الليل يتبادلان الضربات قرب تلة الجامعة. وقت ذهبي لبيع حقائب الإسعاف في السوق.'
    },
    {
      mood: 'idle',
      en: 'Secret between us: the fastest way to climb early levels is chaining quick Crimes + Gym sets + Missions before touching the Casino.',
      ar: 'سر بيني وبينك: أسرع طريقة لصعود المستويات الأولى هي الجمع بين الجرائم السريعة وتدريب النادي والمهمات قبل لمس الكازينو.'
    },
    {
      mood: 'scheming',
      en: 'Charter flights out of Zone International Airport connect straight to Riyadh, Cairo, Dubai, Istanbul, Neo-Tokyo, and Monte Carlo.',
      ar: 'رحلات الطيران الخاص من مطار زون الدولي تنطلق مباشرة نحو الرياض والقاهرة ودبي وإسطنبول ونيو طوكيو ومونت كارلو.'
    },
    {
      mood: 'idle',
      en: 'Look closely at the 3D Block Map at dusk: every glowing penthouse window in the Citadel belongs to someone who started with one lucky heist.',
      ar: 'تأمل خريطة 3D وقت الغسق: كل نافذة مضيئة في أبراج القلعة يملكها شخص بدأ بعملية واحدة ناجحة.'
    }
  ];

  function isAr() {
    var d = document.documentElement;
    return Boolean(d && (d.lang === 'ar' || d.dir === 'rtl'));
  }

  function currentScreen() {
    var m = document.getElementById('zone-main');
    return (m && m.getAttribute('data-zone-screen')) || 'home';
  }

  function parseCash() {
    var g = window.__zoneGame;
    if (g && g.state && typeof g.state.cash === 'number') return g.state.cash;
    var el = document.getElementById('zone-cash');
    if (!el) return 0;
    var num = Number(String(el.textContent || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  function parseVital(id) {
    var box = document.querySelector('.zone-resource[data-zone-resource="' + id + '"] .zone-resource-track');
    if (!box) return { val: 0, max: 100 };
    return {
      val: Number(box.getAttribute('aria-valuenow')) || 0,
      max: Number(box.getAttribute('aria-valuemax')) || 100
    };
  }

  function isBlockedStatus() {
    var g = window.__zoneGame;
    if (g && g.state) {
      if (g.state.hospitalUntil && g.state.hospitalUntil > Date.now()) return 'hospital';
      if (g.state.jailUntil && g.state.jailUntil > Date.now()) return 'jail';
    }
    return '';
  }

  function goToScreen(screenId) {
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      g.go(screenId);
      return;
    }
    var btn = document.querySelector('#zone-area-navigation button[data-zone-screen="' + screenId + '"]');
    if (btn) btn.click();
  }

  function trigger3DMap() {
    var mode3d = document.querySelector('#zwc-city-panorama-stage [data-zwc-mode="3d"]');
    if (mode3d) {
      mode3d.click();
      return;
    }
    goToScreen('city');
    setTimeout(function () {
      var btn = document.querySelector('#zwc-city-panorama-stage [data-zwc-mode="3d"]');
      if (btn) btn.click();
    }, 220);
  }

  var state = {
    open: true,
    tab: 'smart', /* 'smart' | 'district' | 'rumor' */
    lineIdx: 0,
    rumorIdx: 0,
    lastScreen: '',
    hasUnread: false,
    userClosed: false
  };

  try {
    var savedMin = window.localStorage.getItem(STORAGE_MIN_KEY);
    if (savedMin === '1') {
      state.open = false;
      state.userClosed = true;
    } else if (savedMin === null && typeof window.innerWidth === 'number' && window.innerWidth <= 860) {
      /* On narrow screens, start neatly docked as medallion with unread badge so map controls stay 100% clear */
      state.open = false;
      state.hasUnread = true;
    }
  } catch (_) {}

  function computeBriefing() {
    var ar = isAr();
    var screen = currentScreen();
    var cash = parseCash();
    var energy = parseVital('energy');
    var nerve = parseVital('nerve');
    var blocked = isBlockedStatus();

    if (state.tab === 'rumor') {
      var r = CITY_RUMORS[state.rumorIdx % CITY_RUMORS.length];
      return {
        mood: r.mood,
        kicker: ar ? 'إشاعة من شوارع زون' : 'WORD ON THE STREET',
        text: ar ? r.ar : r.en,
        actions: [
          { label: ar ? 'إشاعة أخرى ↻' : 'Another Rumor ↻', action: 'next', primary: true },
          { label: ar ? 'خريطة المدينة' : 'City Map', screen: 'city' }
        ]
      };
    }

    if (state.tab === 'smart') {
      if (blocked === 'hospital') {
        return {
          mood: 'alert',
          kicker: ar ? 'أنت في المستشفى!' : 'TRAUMA ALERT',
          text: ar
            ? 'أنت في قسم الطوارئ يا بطل! استخدم حقيبة إسعاف أو كيس دم للعودة فوراً للشارع.'
            : 'You are laid up in the Trauma Ward, kid! Pop a First Aid Kit or Blood Bag to get back on the street fast.',
          actions: [
            { label: ar ? 'اذهب للمستشفى' : 'Open Hospital', screen: 'hospital', alert: true },
            { label: ar ? 'حقائب الإسعاف' : 'Med Kits', screen: 'items' }
          ]
        };
      }
      if (blocked === 'jail') {
        return {
          mood: 'alert',
          kicker: ar ? 'قيد الاحتجاز!' : 'CUSTODY ALERT',
          text: ar
            ? 'الشرطة أمسكت بك في الحصن! ادفع الكفالة أو انتظر فزعة من عائلتك.'
            : 'The Precinct picked you up, kid! Pay quick bail to walk clean or signal your Faction for a bust.',
          actions: [
            { label: ar ? 'افتح السجن' : 'Open Jail', screen: 'jail', alert: true },
            { label: ar ? 'عائلتي' : 'My Faction', screen: 'faction' }
          ]
        };
      }
      if (cash >= 2500 && screen !== 'bank') {
        var fmtCash = '$' + Math.round(cash).toLocaleString('en-US');
        return {
          mood: 'scheming',
          kicker: ar ? 'تنبيه نقدي ذكي' : 'SMART STREET MOVE',
          text: ar
            ? 'تحمل ' + fmtCash + ' نقداً في جيبك يا صاحبي؟ عصابة الأفاعي تعشق السياح مثلك! أودعها في خزنة البنك المركزي الآن.'
            : 'Walking around with ' + fmtCash + ' loose in your coat, kid? The Vipers love tourists like you. Stash it in the Central Bank vault.',
          actions: [
            { label: ar ? 'أودع في البنك' : 'Stash at Bank', screen: 'bank', primary: true },
            { label: ar ? 'نصيحة المنطقة' : 'District Tip', action: 'tab:district' }
          ]
        };
      }
      if (nerve.val >= Math.max(15, nerve.max * 0.8) && screen !== 'crimes') {
        return {
          mood: 'scheming',
          kicker: ar ? 'الجرأة ممتلئة!' : 'NERVE READY',
          text: ar
            ? 'مؤشر الجرأة لديك جاهز للعمل (' + nerve.val + '/' + nerve.max + '). لا تضيعه — نفّذ عملية سريعة وارفع خبرة الجريمة!'
            : 'Your Nerve bar is loaded (' + nerve.val + '/' + nerve.max + '). Do not let it sit idle - run a quick street op and stack Crime XP.',
          actions: [
            { label: ar ? 'نفّذ جريمة' : 'Run Crimes', screen: 'crimes', primary: true },
            { label: ar ? 'لوحة المهمات' : 'Missions', screen: 'missions' }
          ]
        };
      }
      if (energy.val >= Math.max(50, energy.max * 0.8) && screen !== 'gym') {
        return {
          mood: 'idle',
          kicker: ar ? 'الطاقة جاهزة!' : 'ENERGY LOADED',
          text: ar
            ? 'طاقتك مرتفعة (' + energy.val + '/' + energy.max + '). استثمرها الآن في النادي الرياضي لرفع القوة والدفاع قبل الاشتباكات!'
            : 'Your Energy tank is full (' + energy.val + '/' + energy.max + '). Burn a few sets at Ironworks Gym to outscale street rivals.',
          actions: [
            { label: ar ? 'تدرّب بالنادي' : 'Train at Gym', screen: 'gym', primary: true },
            { label: ar ? 'افتح خريطة 3D' : 'Open 3D Map', action: 'toggle3d' }
          ]
        };
      }
    }

    /* Fallback or explicit 'district' tab: screen-tailored briefing */
    var list = DISTRICT_LINES[screen] || DISTRICT_LINES.home;
    var item = list[state.lineIdx % list.length];
    return {
      mood: item.mood || 'idle',
      kicker: ar ? item.kickerAr : item.kickerEn,
      text: ar ? item.ar : item.en,
      actions: (item.actions || []).map(function (a) {
        return {
          label: ar ? a.labelAr : a.labelEn,
          screen: a.screen,
          action: a.action,
          primary: a.primary,
          alert: a.alert
        };
      })
    };
  }

  var rootEl = null;
  var bubbleEl = null;
  var avatarBtn = null;

  function ensureDom() {
    if (rootEl && document.body && rootEl.parentElement === document.body) return;
    if (!document.body) return;
    var existing = document.getElementById('zmw-root');
    if (existing) existing.remove();

    rootEl = document.createElement('aside');
    rootEl.id = 'zmw-root';
    rootEl.setAttribute('aria-label', 'Mayor Tariq Guide');

    bubbleEl = document.createElement('section');
    bubbleEl.id = 'zmw-bubble';
    bubbleEl.setAttribute('role', 'region');
    bubbleEl.setAttribute('aria-live', 'polite');

    var launcherWrap = document.createElement('div');
    launcherWrap.className = 'zmw-launcher-wrap';

    avatarBtn = document.createElement('button');
    avatarBtn.id = 'zmw-avatar-btn';
    avatarBtn.type = 'button';
    avatarBtn.innerHTML =
      '<span class="zmw-avatar-frame"><img id="zmw-avatar-img" src="' + PORTRAITS.idle + '" alt="Mayor Tariq"></span>' +
      '<span class="zmw-unread-pip" id="zmw-unread-pip" hidden>!</span>';

    var tag = document.createElement('span');
    tag.className = 'zmw-avatar-tag';
    tag.id = 'zmw-avatar-tag';
    tag.textContent = 'THE MAYOR';

    launcherWrap.appendChild(avatarBtn);
    launcherWrap.appendChild(tag);
    rootEl.appendChild(bubbleEl);
    rootEl.appendChild(launcherWrap);
    document.body.appendChild(rootEl);

    avatarBtn.addEventListener('click', function () {
      state.open = !state.open;
      state.userClosed = !state.open;
      if (state.open) state.hasUnread = false;
      try { window.localStorage.setItem(STORAGE_MIN_KEY, state.open ? '0' : '1'); } catch (_) {}
      render();
    });

    bubbleEl.addEventListener('click', function (ev) {
      var closeBtn = ev.target.closest('[data-zmw-close]');
      if (closeBtn) {
        state.open = false;
        state.userClosed = true;
        try { window.localStorage.setItem(STORAGE_MIN_KEY, '1'); } catch (_) {}
        render();
        return;
      }
      var nextBtn = ev.target.closest('[data-zmw-next]');
      if (nextBtn) {
        if (state.tab === 'rumor') state.rumorIdx++;
        else {
          state.tab = 'district';
          state.lineIdx++;
        }
        render();
        return;
      }
      var tabBtn = ev.target.closest('[data-zmw-tab]');
      if (tabBtn) {
        var nextTab = tabBtn.getAttribute('data-zmw-tab');
        if (nextTab === state.tab) {
          if (nextTab === 'rumor') state.rumorIdx++;
          else state.lineIdx++;
        } else {
          state.tab = nextTab;
        }
        render();
        return;
      }
      var actBtn = ev.target.closest('[data-zmw-action], [data-zmw-screen]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-zmw-action');
        var scr = actBtn.getAttribute('data-zmw-screen');
        if (act === 'toggle3d') {
          trigger3DMap();
        } else if (act === 'next') {
          state.rumorIdx++;
          render();
        } else if (act && act.indexOf('tab:') === 0) {
          state.tab = act.slice(4);
          render();
        } else if (scr) {
          goToScreen(scr);
        }
      }
    });
  }

  function render() {
    ensureDom();
    if (!rootEl || !bubbleEl || !avatarBtn) return;

    var ar = isAr();
    var meta = ar ? MAYOR_META.ar : MAYOR_META.en;
    var brief = computeBriefing();
    var portraitUrl = PORTRAITS[brief.mood] || PORTRAITS.idle;

    var avatarImg = document.getElementById('zmw-avatar-img');
    if (avatarImg && avatarImg.getAttribute('src') !== portraitUrl) {
      avatarImg.setAttribute('src', portraitUrl);
    }
    var tagEl = document.getElementById('zmw-avatar-tag');
    if (tagEl && tagEl.textContent !== meta.shortTag) {
      tagEl.textContent = meta.shortTag;
    }
    avatarBtn.setAttribute('aria-label', meta.openLabel);
    avatarBtn.setAttribute('aria-expanded', state.open ? 'true' : 'false');

    var pip = document.getElementById('zmw-unread-pip');
    if (pip) {
      pip.hidden = state.open || !state.hasUnread;
    }

    bubbleEl.hidden = !state.open;
    if (!state.open) return;

    bubbleEl.setAttribute('data-mood', brief.mood);
    bubbleEl.setAttribute('dir', ar ? 'rtl' : 'ltr');

    var actionsHtml = (brief.actions || []).map(function (a) {
      var cls = 'zmw-action-btn' + (a.alert ? ' alert' : a.primary ? ' primary' : '');
      var attr = a.action ? ' data-zmw-action="' + a.action + '"' : ' data-zmw-screen="' + a.screen + '"';
      return '<button type="button" class="' + cls + '"' + attr + '>' + a.label + '</button>';
    }).join('');

    bubbleEl.innerHTML =
      '<div class="zmw-head">' +
        '<div class="zmw-head-id">' +
          '<span class="zmw-name">' + meta.name + '</span>' +
          '<span class="zmw-mood-pill">' + (meta.moods[brief.mood] || meta.moods.idle) + '</span>' +
        '</div>' +
        '<div class="zmw-head-controls">' +
          '<button type="button" class="zmw-icon-btn" data-zmw-next="1" title="' + meta.nextTitle + '" aria-label="' + meta.nextTitle + '">&#x21bb;</button>' +
          '<button type="button" class="zmw-icon-btn" data-zmw-close="1" title="' + meta.closeTitle + '" aria-label="' + meta.closeTitle + '">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="zmw-body">' +
        '<div class="zmw-mini-portrait"><img src="' + portraitUrl + '" alt="' + meta.name + '"></div>' +
        '<div class="zmw-copy-wrap">' +
          '<div class="zmw-kicker">' + brief.kicker + '</div>' +
          '<p class="zmw-line">' + brief.text + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="zmw-actions">' + actionsHtml + '</div>' +
      '<div class="zmw-tabs" role="tablist">' +
        '<button type="button" class="zmw-tab-btn" role="tab" data-zmw-tab="smart" aria-selected="' + (state.tab === 'smart' ? 'true' : 'false') + '">' + meta.tabs.smart + '</button>' +
        '<button type="button" class="zmw-tab-btn" role="tab" data-zmw-tab="district" aria-selected="' + (state.tab === 'district' ? 'true' : 'false') + '">' + meta.tabs.district + '</button>' +
        '<button type="button" class="zmw-tab-btn" role="tab" data-zmw-tab="rumor" aria-selected="' + (state.tab === 'rumor' ? 'true' : 'false') + '">' + meta.tabs.rumor + '</button>' +
      '</div>';
  }

  function onStateUpdate() {
    if (document.querySelector('x-dc')) return;
    var scr = currentScreen();
    if (scr && scr !== state.lastScreen) {
      var firstBoot = state.lastScreen === '';
      state.lastScreen = scr;
      state.lineIdx = 0;
      if (!firstBoot && !state.open) {
        /* Mark unread pip gently when entering a new district while minimized */
        try {
          var seen = JSON.parse(window.localStorage.getItem(STORAGE_SEEN_KEY) || '[]');
          if (seen.indexOf(scr) === -1) {
            seen.push(scr);
            window.localStorage.setItem(STORAGE_SEEN_KEY, JSON.stringify(seen));
            state.hasUnread = true;
          }
        } catch (_) {
          state.hasUnread = true;
        }
      }
    }
    render();
  }

  function boot() {
    /* Mount only on the main player game shell (not /account or /admin) */
    if (!document.getElementById('dc-root') && !document.querySelector('x-dc') && !document.querySelector('.zone-app')) {
      return;
    }
    /* Wait briefly for <x-dc> hydration so Mayor pops in smoothly right after first paint */
    setTimeout(onStateUpdate, 380);
    setTimeout(onStateUpdate, 1100);

    window.addEventListener('zone:render', function () {
      setTimeout(onStateUpdate, 40);
    });

    if (typeof MutationObserver === 'function') {
      var docObs = new MutationObserver(function () {
        onStateUpdate();
      });
      docObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme']
      });
      var attachMain = function () {
        var m = document.getElementById('zone-main');
        if (m && !m.__zmwObserved) {
          m.__zmwObserved = true;
          var mObs = new MutationObserver(function () {
            onStateUpdate();
          });
          mObs.observe(m, { attributes: true, attributeFilter: ['data-zone-screen'] });
        }
      };
      setTimeout(attachMain, 500);
      setTimeout(attachMain, 1400);
    }

    window.ZoneMayorWidget = {
      open: function (tab) {
        if (tab) state.tab = tab;
        state.open = true;
        state.hasUnread = false;
        render();
      },
      close: function () {
        state.open = false;
        render();
      },
      refresh: render
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

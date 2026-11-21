/* ==========================================================================
 * ZONE v150 - WHISPER-CLEAN TORN STATUS BAR, ROUTE-SCOPED SECTIONS & DRAWER
 * Hand-Drawn Watercolor Sketchbook Edition (Light + Dark + EN + AR RTL)
 * Exclusive Ownership: ux-shell-torn148 (assets/ui/zone-torn-live.js)
 * Exposes: window.ZoneTornLive
 * Fiber-safe: append-only DOM mounts (.zone-topbar, #zone-main, document.body);
 *             never mutates or removes <x-dc> / React managed child nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneTornLiveLoaded) return;
  window.__zoneTornLiveLoaded = true;

  var FEEDBACK_TTL_MS = 4000;

  /* ------------------------------------------------------------------------
   * 1. STATIC TORN CATALOG DEFINITIONS (BILINGUAL EN + AR)
   * ------------------------------------------------------------------------ */
  var CRIMES_2_CATALOG = [
    { id: '1', slug: 'search_for_cash', altKey: 'search', nerve: 2, enhancerId: 'glasses', en: 'Search for Cash', ar: 'البحث عن النقد', enhEn: 'Glasses', enhAr: 'نظارات مكبرة' },
    { id: '2', slug: 'bootlegging', altKey: 'bootleg', nerve: 3, enhancerId: 'high_speed_drive', en: 'Bootlegging', ar: 'قرصنة الأقراص', enhEn: 'High-Speed Drive', enhAr: 'محرك نسخ سريع' },
    { id: '3', slug: 'graffiti', altKey: 'graffiti', nerve: 3, enhancerId: 'paint_mask', en: 'Graffiti', ar: 'طلاء الجدران', enhEn: 'Paint Mask', enhAr: 'قناع طلاء' },
    { id: '4', slug: 'shoplifting', altKey: 'shoplift', nerve: 4, enhancerId: 'mountain_bike', en: 'Shoplifting', ar: 'سرقة المتاجر', enhEn: 'Mountain Bike', enhAr: 'دراجة جبلية' },
    { id: '5', slug: 'pickpocketing', altKey: 'pickpocket', nerve: 5, enhancerId: 'cut_throat_razor', en: 'Pickpocketing', ar: 'النشل الميداني', enhEn: 'Cut-Throat Razor', enhAr: 'شفرة دقيقة' },
    { id: '6', slug: 'card_skimming', altKey: 'skimmer', nerve: 6, enhancerId: 'duct_tape', en: 'Card Skimming', ar: 'نسخ البطاقات', enhEn: 'Duct Tape', enhAr: 'شريط لاصق' },
    { id: '7', slug: 'burglary', altKey: 'burglary', nerve: 6, enhancerId: 'flashlight', en: 'Burglary', ar: 'السطو على العقارات', enhEn: 'Flashlight', enhAr: 'كشاف تكتيكي' },
    { id: '8', slug: 'hustling', altKey: 'hustling', nerve: 4, enhancerId: 'megaphone', en: 'Hustling', ar: 'خداع الجمهور', enhEn: 'Megaphone', enhAr: 'مكبر صوت' },
    { id: '9', slug: 'disposal', altKey: 'disposal', nerve: 6, enhancerId: 'latex_gloves', en: 'Disposal', ar: 'إتلاف الأدلة', enhEn: 'Latex Gloves', enhAr: 'قفازات لاتكس' },
    { id: '10', slug: 'cracking', altKey: 'cracking', nerve: 7, enhancerId: 'office_chair', en: 'Cracking', ar: 'كسر التشفير', enhEn: 'Office Chair', enhAr: 'كرسي مكتبي' },
    { id: '11', slug: 'forgery', altKey: 'forgery', nerve: 5, enhancerId: 'magnifying_glass', en: 'Forgery', ar: 'تزوير الوثائق', enhEn: 'Magnifying Glass', enhAr: 'عدسة فحص' },
    { id: '12', slug: 'scamming', altKey: 'scamming', nerve: 7, enhancerId: 'ergonomic_keyboard', en: 'Scamming', ar: 'الاحتيال السيبراني', enhEn: 'Ergonomic Keyboard', enhAr: 'لوحة مفاتيح مريحة' },
    { id: '13', slug: 'arson', altKey: 'arson', nerve: 9, enhancerId: 'windproof_lighter', en: 'Arson', ar: 'الحرق الجنائي', enhEn: 'Windproof Lighter', enhAr: 'قداحة مقاومة للرياح' }
  ];

  /* 9 Consumables for `items` route (+ happyJump Conditioning Protocol) */
  var ITEMS_PHARMACY_CATALOG = [
    { id: 'xanax', kind: 'drug', action: 'drug.use', odPct: '2.5%', cdEn: '7h Drug CD', cdAr: '٧س تهدئة مخدر', effEn: '+250 Energy', effAr: '+250 طاقة', en: 'Xanax', ar: 'زاناكس', price: 840000 },
    { id: 'ecstasy', kind: 'drug', action: 'drug.use', odPct: '4.0%', cdEn: '4h Drug CD', cdAr: '٤س تهدئة مخدر', effEn: '2x Happiness', effAr: 'مضاعفة المعنويات ×2', en: 'Ecstasy', ar: 'إكستاسي', price: 48000 },
    { id: 'vicodin', kind: 'drug', action: 'drug.use', odPct: '1.5%', cdEn: '5h Drug CD', cdAr: '٥س تهدئة مخدر', effEn: '+200 Life', effAr: '+200 صحة', en: 'Vicodin', ar: 'فيكودين', price: 35000 },
    { id: 'cannabis', kind: 'drug', action: 'drug.use', odPct: '0.5%', cdEn: '1h Drug CD', cdAr: '١س تهدئة مخدر', effEn: '+8 Nerve', effAr: '+8 جرأة', en: 'Cannabis', ar: 'قنب طبي', price: 8500 },
    { id: 'lsd', kind: 'drug', action: 'drug.use', odPct: '3.0%', cdEn: '6h Drug CD', cdAr: '٦س تهدئة مخدر', effEn: '+50E · +5N · +500H', effAr: '+50 طاقة · +5 جرأة · +500 معنويات', en: 'LSD', ar: 'إل إس دي', price: 45000 },
    { id: 'edvd', kind: 'booster', action: 'item.use', odPct: '0%', cdEn: '6h Booster CD', cdAr: '٦س تهدئة معزز', effEn: '+2,500 Happiness', effAr: '+2,500 معنويات', en: 'Erotic DVD', ar: 'قرص معنويات فائق', price: 3200000 },
    { id: 'fhc', kind: 'booster', action: 'item.use', odPct: '0%', cdEn: '6h Booster CD', cdAr: '٦س تهدئة معزز', effEn: '+150E · +500 Happy', effAr: '+150 طاقة · +500 معنويات', en: 'Feathery Hotel Coupon', ar: 'قسيمة فندق فيذري', price: 13500000 },
    { id: 'bloodbag', kind: 'medical', action: 'torn.bloodBag', actionArg: 'use', odPct: '0%', cdEn: '1h Med CD', cdAr: '١س تهدئة طبية', effEn: '+300 Life · -1h Hosp', effAr: '+300 صحة · -١س مستشفى', en: 'Blood Bag', ar: 'كيس دم وريدي', price: 22000 },
    { id: 'morphine', kind: 'medical', action: 'item.use', odPct: '0%', cdEn: '1.5h Med CD', cdAr: '١.٥س تهدئة طبية', effEn: '+500 Life · -2h Hosp', effAr: '+500 صحة · -٢س مستشفى', en: 'Morphine', ar: 'مورفين طبي', price: 42000 }
  ];

  var HOSPITAL_MED_ITEMS = [
    ITEMS_PHARMACY_CATALOG[7],
    ITEMS_PHARMACY_CATALOG[8]
  ];

  var LAWYER_CARD_SPEC = {
    id: 'lawyer_card',
    action: 'torn.lawyerCard',
    actionArg: 'release',
    cdEn: 'Instant Release',
    cdAr: 'إفراج فوري',
    effEn: 'Clears remaining Jail sentence immediately (100% legal immunity)',
    effAr: 'إسقاط حكم السجن المتبقي فوراً بحصانة قانونية كاملة',
    en: 'Lawyer Business Card',
    ar: 'بطاقة المحامي المعتمد',
    price: 95000
  };

  var STOCK_CATALOG = [
    { ticker: 'SYM', blockShares: 500, basePrice: 680, en: 'Symbiotic Ltd.', ar: 'مجموعة سيمبيوتيك', perkEn: '1x Xanax / Drug Pack (7d)', perkAr: 'حزمة زاناكس طبية / 7 أيام' },
    { ticker: 'FHG', blockShares: 1000, basePrice: 12400, en: 'Feathery Hotels', ar: 'فنادق فيذري', perkEn: '1x Feathery Hotel Coupon (7d)', perkAr: 'قسيمة فندق فيذري / 7 أيام' },
    { ticker: 'MCS', blockShares: 1000, basePrice: 1650, en: 'Mc Smoogle Corp', ar: 'ماك سموغل للطاقة', perkEn: '+300 Energy Dividend (7d)', perkAr: '+300 طاقة مجانية / 7 أيام' },
    { ticker: 'LAG', blockShares: 750, basePrice: 920, en: 'Legal Authorities', ar: 'هيئة الدفاع القانوني', perkEn: '1x Lawyer Business Card (7d)', perkAr: 'بطاقة محامٍ معتمد / 7 أيام' },
    { ticker: 'TCT', blockShares: 500, basePrice: 310, en: 'Torn City Times', ar: 'صحيفة المدينة', perkEn: '$100,000 Cash Dividend (7d)', perkAr: 'عائد نقدي $100,000 / 7 أيام' },
    { ticker: 'GRN', blockShares: 1000, basePrice: 540, en: 'Grain Holdings', ar: 'مؤسسة الحبوب', perkEn: '$250,000 Cash Dividend (7d)', perkAr: 'عائد نقدي $250,000 / 7 أيام' },
    { ticker: 'IOU', blockShares: 1500, basePrice: 780, en: 'IOU Bank Corp', ar: 'مصرف الاستثمار الموحد', perkEn: '$400,000 Cash Dividend (7d)', perkAr: 'عائد نقدي $400,000 / 7 أيام' },
    { ticker: 'PRN', blockShares: 1000, basePrice: 2950, en: 'Ribaldry Media', ar: 'ميديا الترفيه', perkEn: '1x Erotic DVD (7d)', perkAr: 'قرص معنويات eDVD / 7 أيام' }
  ];

  var DESTINATIONS_11 = [
    { id: 'mexico', mins: 3, fare: 6500, tagEn: 'Plushies & Arms', tagAr: 'دمى وسلاح', en: 'Mexico', ar: 'المكسيك', goodsEn: 'Camel Plushie, Cherry Blossom, Pistol', goodsAr: 'دمية الجمل، زهرة الكرز، مسدس' },
    { id: 'cayman', mins: 4, fare: 10000, tagEn: 'Offshore Hub', tagAr: 'ملاذ مصرفي', en: 'Cayman Islands', ar: 'جزر كايمان', goodsEn: 'Bear Plushie, Peony Flower', goodsAr: 'دمية الدب، زهرة الفاوانيا' },
    { id: 'toronto', mins: 4, fare: 9500, tagEn: 'Medical & Plush', tagAr: 'طب ودمى', en: 'Toronto', ar: 'تورونتو', goodsEn: 'Moose Plushie, Orchid, Morphine', goodsAr: 'دمية الموظ، أوركيد، مورفين' },
    { id: 'hawaii', mins: 6, fare: 18000, tagEn: 'Boosters & Lotus', tagAr: 'معززات ولوتس', en: 'Hawaii', ar: 'هاواي', goodsEn: 'Lotus Flower, Energy Drink', goodsAr: 'زهرة اللوتس، مشروب طاقة' },
    { id: 'london', mins: 7, fare: 18000, tagEn: 'Blood & Plush', tagAr: 'أكياس دم ودمى', en: 'London', ar: 'لندن', goodsEn: 'Lion Plushie, Violet, Blood Bag', goodsAr: 'دمية الأسد، بنفسج، كيس دم' },
    { id: 'zurich', mins: 8, fare: 22000, tagEn: 'Rehab Clinic', tagAr: 'عيادة التأهيل', en: 'Zurich [Rehab]', ar: 'زيورخ [تأهيل]', goodsEn: 'Clinical Rehab, Medkit, Snow Globe', goodsAr: 'علاج الإدمان، حقيبة طبية' },
    { id: 'cairo', mins: 8, fare: 24000, tagEn: 'Antiquities', tagAr: 'آثار نادرة', en: 'Cairo', ar: 'القاهرة', goodsEn: 'Pharaoh Plushie, Revolver', goodsAr: 'دمية الفرعون، مسدس دوار' },
    { id: 'dubai', mins: 9, fare: 28000, tagEn: 'Gold & Falcon', tagAr: 'صقر وسلاح', en: 'Dubai', ar: 'دبي', goodsEn: 'Falcon Plushie, Tribulus, AK Rifle', goodsAr: 'دمية الصقر، تريبولوس، كلاشنكوف' },
    { id: 'tokyo', mins: 10, fare: 32000, tagEn: 'eDVD & Sniper', tagAr: 'إلكترونيات وقنص', en: 'Tokyo', ar: 'طوكيو', goodsEn: 'Erotic DVD, Sniper, Flash Grenade', goodsAr: 'قرص eDVD، قناصة، قنبلة ضوئية' },
    { id: 'beijing', mins: 10, fare: 32000, tagEn: 'Peony & Smoke', tagAr: 'فاوانيا ودخان', en: 'Beijing', ar: 'بكين', goodsEn: 'Peony Flower, Smoke Grenade', goodsAr: 'زهرة الفاوانيا، قنبلة دخانية' },
    { id: 'johannesburg', mins: 12, fare: 35000, tagEn: 'Xanax Import', tagAr: 'زاناكس مخفض', en: 'Johannesburg [Xanax]', ar: 'جوهانسبرغ [زاناكس]', goodsEn: 'Xanax ($740k), Lion Plushie, Epinephrine', goodsAr: 'زاناكس ($740k)، دمية الأسد، إبينفرين' }
  ];

  var PLUSHIE_SET = [
    { id: 'plush_camel', en: 'Camel', ar: 'الجمل' },
    { id: 'plush_bear', en: 'Bear', ar: 'الدب' },
    { id: 'plush_moose', en: 'Moose', ar: 'الموظ' },
    { id: 'plush_pharaoh', en: 'Pharaoh', ar: 'الفرعون' },
    { id: 'plush_falcon', en: 'Falcon', ar: 'الصقر' },
    { id: 'plush_lion', en: 'Lion', ar: 'الأسد' }
  ];

  var FLOWER_SET = [
    { id: 'flower_orchid', en: 'Orchid', ar: 'أوركيد' },
    { id: 'flower_lotus', en: 'Lotus', ar: 'لوتس' },
    { id: 'flower_cherry', en: 'Cherry', ar: 'كرز' },
    { id: 'flower_peony', en: 'Peony', ar: 'فاوانيا' },
    { id: 'flower_tribulus', en: 'Tribulus', ar: 'تريبولوس' },
    { id: 'flower_violet', en: 'Violet', ar: 'بنفسج' }
  ];

  var ISLAND_STAFF = [
    { id: 'pilot', cost: 150000, en: 'Airstrip Pilot', ar: 'طيار المدرج الخاص', perkEn: '-30% Flight Time & $0 Airfare +10 Luggage', perkAr: '-30% وقت الطيران وإعفاء التذكرة +10 أمتعة' },
    { id: 'doctor', cost: 65000, en: 'Estate Physician', ar: 'طبيب القصر المقيم', perkEn: 'Faster Hospital Recovery & Blood Care', perkAr: 'تسريع التعافي الطبي والعناية الوريدية' },
    { id: 'vault_guard', cost: 95000, en: 'Vault Security Detail', ar: 'حرس الخزنة المسلح', perkEn: 'Unlocks Vault Access & Anti-Mug Guard', perkAr: 'فتح وتأمين الخزنة ضد النشل' },
    { id: 'butler', cost: 35000, en: 'Senior Butler', ar: 'كبير الخدم', perkEn: '+Max Happiness & Upkeep Care', perkAr: 'رفع سقف المعنويات وخدمة العقار' }
  ];

  var CHAIN_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

  /* Strict 1-Route-1-Purpose Mounting Table (ONLY these 9 routes mount a Torn card;
   * home, gym, attack, education, jobs, casino, missions, hof, newspaper, elimination mount ZERO!) */
  var ROUTE_SECTIONS = {
    crimes: true,
    items: true,
    bank: true,
    market: true,
    properties: true,
    city: true,
    hospital: true,
    jail: true,
    faction: true
  };

  var LEGACY_TAB_TO_ROUTE = {
    crimes: 'crimes',
    pharmacy: 'items',
    items: 'items',
    points: 'market',
    market: 'market',
    economy: 'bank',
    stocks: 'bank',
    bank: 'bank',
    vault: 'properties',
    properties: 'properties',
    travel: 'city',
    airport: 'city',
    museum: 'city',
    city: 'city',
    hospital: 'hospital',
    jail: 'jail',
    faction: 'faction'
  };

  /* ------------------------------------------------------------------------
   * 2. BILINGUAL UI DICTIONARY (EN + AR)
   * ------------------------------------------------------------------------ */
  var COPY = {
    en: {
      drugCd: 'Drug',
      medCd: 'Med',
      boostCd: 'Booster',
      ready: 'Ready',
      addictWarn: 'Addiction',
      chainLbl: 'Chain',
      playersBtn: 'Players',
      eventsBtn: 'Events',
      crimesTitle: 'Crimes 2.0 Live Board (13 Archetypes · Server 4-Tier Rolls)',
      crimesNote: 'Spends real Nerve, scales 0-100 Skill, checks owned Enhancers (+12%), and settles Critical Fail / Fail / Success / Unique Loot.',
      skillLbl: 'Skill',
      enhOwned: 'Enhancer Owned (+12%)',
      enhMissing: 'No Enhancer',
      buyEnh: 'Buy Tool',
      commitCrime: 'Commit',
      shopliftSecTitle: 'Live Rotating Shoplifting Security (15m Cycle)',
      camOff: 'Cam OFF',
      camOn: 'Cam ON',
      guardOff: 'Guard Away',
      guardOn: 'Guard Active',
      shopliftAct: 'Shoplift',
      searchModTitle: 'Search for Cash Live Street Modifiers',
      searchAct: 'Search (2N)',
      pharmTitle: 'Pharmacy & Medical Consumables',
      pharmNote: 'Enforces server Drug, Medical (6h cap), and Booster (24h cap) cooldowns plus Overdose & Addiction.',
      addictionMeter: 'Clinical Addiction & Overdose Rehabilitation',
      rehabBtn: 'Clinical Rehab',
      happyJumpTitle: 'Happy Jump Conditioning Protocol',
      happyJumpDesc: 'Consumes owned Xanax + eDVD + Ecstasy (or $120k stack pack) when Drug CD is clear.',
      happyJumpBtn: 'Run Happy Jump',
      pointsTitle: 'Points Building Refills (1 / UTC Day)',
      pointsNote: 'Instant 25-Point Energy & Nerve refills settled directly on the server.',
      refillEnergyBtn: 'Refill Energy (25 pts)',
      refillNerveBtn: 'Refill Nerve (25 pts)',
      ownedLbl: 'Owned',
      useBtn: 'Use',
      buyMarketBtn: 'Buy',
      drawBloodBtn: 'Draw Blood (-15% HP)',
      stocksTitle: 'Zone Stock Exchange (8 Tickers & 7-Day Benefit Blocks)',
      stocksNote: 'Prices update live every 5 minutes. Own the full Benefit Block and wait for maturity to claim dividends.',
      blockProg: 'Benefit Block',
      buyShares: 'Buy Shares',
      sellShares: 'Sell (-1%)',
      collectDiv: 'Collect Benefit',
      needBlock: 'Need Block',
      maturing: 'Maturing',
      bankCdTitle: 'Bank Term Certificates of Deposit (Principal Locked)',
      principalLbl: 'Principal ($5k - $2B)',
      lockCdBtn: 'Lock Term CD',
      claimCdBtn: 'Claim Matured CD',
      cdActiveLbl: 'Active Term CD',
      vaultTitle: 'Property Cash Vault (100% PvP Mug-Protected) & Private Island Staff',
      vaultNote: 'Cash stored in your Property Vault cannot be mugged in PvP combat.',
      depositVault: 'Deposit to Vault',
      withdrawVault: 'Withdraw Cash',
      hireStaff: 'Hire Staff',
      hiredTag: 'Hired ✓',
      airportTitle: 'Zone International Airport & 11 Foreign Markets',
      airstripActive: 'Private Airstrip Active (-30% Flight Time · $0 Fare · +10 Cargo)',
      airstripNone: 'Standard Commercial Charter (5 Base Luggage)',
      luggageLbl: 'Luggage Capacity',
      flyBtn: 'Fly',
      flyHomeBtn: 'Fly Home to Zone City',
      foreignShopTitle: 'Foreign City Market Inventory (Global 15m Restock)',
      stockLeft: 'In Stock',
      zurichTitle: 'Zurich Switzerland Addiction Rehabilitation Clinic',
      zurichBtn: 'Undergo Zurich Rehab',
      museumTitle: 'Zone Antiquities Museum (Set -> +10 Points)',
      plushieSetTitle: 'Plushie Collection (6 Unique)',
      flowerSetTitle: 'Exotic Flower Collection (6 Unique)',
      exchangePlushBtn: 'Exchange Plushies (+10 pts)',
      exchangeFlowerBtn: 'Exchange Flowers (+10 pts)',
      histUnlocked: 'History (hist) Course Completed ✓',
      histRequired: 'Requires University History (hist) Course',
      enrollHistBtn: 'Enroll History (hist)',
      hospWardTitle: 'Live Ward Player Revives (25E Bio / 75E Base)',
      hospWardEmpty: 'No hospitalized players waiting in the ward right now.',
      hospMedTitle: 'Blood Bags & Field Medical Supplies',
      openDirBtn: 'Open Player Directory',
      jailLegalTitle: 'Lawyer Business Card — Instant Legal Release',
      jailLegalNote: 'Use an owned Lawyer Business Card to clear active Jail time immediately without Nerve risk.',
      releaseNowBtn: 'Use Lawyer Card (Release)',
      chainTitle: 'Shared Faction 5-Minute Chain Bar',
      armoryTitle: 'Shared Faction Armory (Deposit & Loan)',
      depositArmory: 'Deposit +1',
      useArmory: 'Use / Loan',
      wallTitle: 'Territory Wall Live Tug-of-War',
      joinWallBtn: 'Join Wall (5E)',
      assaultWallBtn: 'Assault Wall (25E)',
      dirTitle: 'Player Directory & Searchable Profiles',
      searchPlaceholder: 'Search player name or ID...',
      searchGo: 'Search',
      hospPlayersTitle: 'Hospitalized Operatives (Live Revive)',
      attackBtn: 'Attack (25E)',
      reviveBtn: 'Revive',
      bountyBtn: 'Place Bounty',
      sendCashBtn: 'Send Cash',
      sendMailBtn: 'Send Mail',
      recentAttacksTitle: 'Recent Combat Log',
      eventsTitle: 'Chronological Events Feed (Latest 40)',
      drawerTitleEvents: 'Events Feed & Player Directory',
      closeLbl: 'Close',
      freeAirstrip: 'FREE (Airstrip)',
      kvLevelCity: 'Level / City',
      kvNetworth: 'Networth',
      kvFaction: 'Faction',
      kvAwardsWins: 'Awards / Wins',
      mailPlaceholder: 'Write mail to ',
      noEvents: 'No recent events logged yet.',
      loadOperativesHint: 'Click Search to load active operatives.'
    },
    ar: {
      drugCd: 'مخدر',
      medCd: 'طبي',
      boostCd: 'معزز',
      ready: 'جاهز',
      addictWarn: 'إدمان',
      chainLbl: 'السلسلة',
      playersBtn: 'اللاعبون',
      eventsBtn: 'الأحداث',
      crimesTitle: 'لوحة الجرائم 2.0 الحية (13 تخصصاً · نتائج خادم رباعية)',
      crimesNote: 'تستهلك الجرأة الفعلية، وترفع المهارة 0-100، وتفحص أداة التعزيز (+12%)، وتحسب الفشل الحرج / النجاح / الغنيمة النادرة.',
      skillLbl: 'المهارة',
      enhOwned: 'المعزز مملوك (+12%)',
      enhMissing: 'بدون معزز',
      buyEnh: 'شراء الأداة',
      commitCrime: 'تنفيذ',
      shopliftSecTitle: 'حالة كاميرات وحراسة المتاجر المتغيرة (كل 15 دقيقة)',
      camOff: 'الكاميرا معطلة',
      camOn: 'الكاميرا نشطة',
      guardOff: 'الحارس غائب',
      guardOn: 'الحارس متواجد',
      shopliftAct: 'سرقة متجر',
      searchModTitle: 'مؤشرات البحث عن النقد الميدانية الحية',
      searchAct: 'بحث (2 جرأة)',
      pharmTitle: 'الصيدلية والمستهلكات الطبية والمعززات',
      pharmNote: 'تطبق أوقات تهدئة المخدرات والطب (سقف 6س) والمعززات (سقف 24س) ومخاطر الجرعة الزائدة والإدمان.',
      addictionMeter: 'عيادة تأهيل الإدمان والجرعات الزائدة',
      rehabBtn: 'علاج الإدمان',
      happyJumpTitle: 'بروتوكول قفزة المعنويات (Happy Jump)',
      happyJumpDesc: 'يستهلك زاناكس + eDVD + إكستاسي (أو حزمة السوق بـ $120k) عند خلو تهدئة المخدرات.',
      happyJumpBtn: 'تنفيذ قفزة المعنويات',
      pointsTitle: 'مبنى النقاط للتعبئة الفورية (مرة يومياً)',
      pointsNote: 'تعبئة فورية للطاقة والجرأة مقابل 25 نقطة مباشرة عبر الخادم.',
      refillEnergyBtn: 'تعبئة الطاقة (25 نقطة)',
      refillNerveBtn: 'تعبئة الجرأة (25 نقطة)',
      ownedLbl: 'مملوك',
      useBtn: 'استخدام',
      buyMarketBtn: 'شراء',
      drawBloodBtn: 'سحب كيس دم (-15% صحة)',
      stocksTitle: 'بورصة زون الحية (8 أسهم وحزم عوائد أسبوعية)',
      stocksNote: 'تتحدث الأسعار كل 5 دقائق. امتلك الحزمة الكاملة وانتظر الاستحقاق لتحصيل العائد.',
      blockProg: 'حزمة العائد',
      buyShares: 'شراء أسهم',
      sellShares: 'بيع (-1%)',
      collectDiv: 'تحصيل العائد',
      needBlock: 'أكمل الحزمة',
      maturing: 'قيد الاستحقاق',
      bankCdTitle: 'ودائع البنك لأجل (حجز أصل المبلغ الفعلي)',
      principalLbl: 'المبلغ ($5k - $2B)',
      lockCdBtn: 'ربط وديعة لأجل',
      claimCdBtn: 'صرف الوديعة المستحقة',
      cdActiveLbl: 'الوديعة النشطة',
      vaultTitle: 'خزنة العقار المحصنة من النشل وطاقم الجزيرة الخاصة',
      vaultNote: 'الأموال المودعة في خزنة العقار محمية بنسبة 100% من النشل.',
      depositVault: 'إيداع في الخزنة',
      withdrawVault: 'سحب من الخزنة',
      hireStaff: 'تعيين الطاقم',
      hiredTag: 'مُعيّن ✓',
      airportTitle: 'مطار زون الدولي و 11 سوقاً خارجياً للتهريب',
      airstripActive: 'المدرج الخاص مفعل (-30% وقت الطيران · تذكرة مجانية · +10 أمتعة)',
      airstripNone: 'رحلات تجارية قياسية (سعة أساسية 5)',
      luggageLbl: 'سعة الأمتعة',
      flyBtn: 'سفر',
      flyHomeBtn: 'العودة إلى مدينة زون',
      foreignShopTitle: 'مخزون السوق الخارجي (تحديث عالمي كل 15 دقيقة)',
      stockLeft: 'المتوفر',
      zurichTitle: 'عيادة زيورخ السويسرية لعلاج الإدمان',
      zurichBtn: 'بدء جلسة تأهيل زيورخ',
      museumTitle: 'متحف النوادر (استبدال المجموعة مقابل +10 نقاط)',
      plushieSetTitle: 'مجموعة الدمى الإقليمية (6 قطع)',
      flowerSetTitle: 'مجموعة الزهور النادرة (6 قطع)',
      exchangePlushBtn: 'استبدال الدمى (+10 نقاط)',
      exchangeFlowerBtn: 'استبدال الزهور (+10 نقاط)',
      histUnlocked: 'مساق التاريخ (hist) مكتمل ✓',
      histRequired: 'يتطلب إتمام مساق التاريخ (hist) في الجامعة',
      enrollHistBtn: 'التسجيل في مساق التاريخ',
      hospWardTitle: 'إنعاش مصابي الجناح الطبي المباشر (25 أو 75 طاقة)',
      hospWardEmpty: 'لا يوجد مصابون في جناح المستشفى حالياً.',
      hospMedTitle: 'أكياس الدم والإمدادات الطبية الوريدية',
      openDirBtn: 'فتح دليل اللاعبين',
      jailLegalTitle: 'بطاقة المحامي المعتمد — إفراج قانوني فوري',
      jailLegalNote: 'استخدم بطاقة المحامي لإسقاط عقوبة السجن فوراً دون مخاطرة بالجرأة.',
      releaseNowBtn: 'استخدام بطاقة المحامي (إفراج)',
      chainTitle: 'سلسلة ضربات العائلة المشتركة (عداد 5 دقائق)',
      armoryTitle: 'مخزن أسلحة وإمدادات العائلة المشترك',
      depositArmory: 'إيداع +1',
      useArmory: 'استعارة / استخدام',
      wallTitle: 'جدار حرب القطاع المباشر',
      joinWallBtn: 'التمركز بالجدار (5 طاقة)',
      assaultWallBtn: 'اقتحام الجدار (25 طاقة)',
      dirTitle: 'دليل اللاعبين والملفات الشخصية التفاعلية',
      searchPlaceholder: 'ابحث باسم اللاعب أو رقمه...',
      searchGo: 'بحث',
      hospPlayersTitle: 'مصابو المستشفى المتاحون للإنعاش',
      attackBtn: 'هجوم (25 طاقة)',
      reviveBtn: 'إنعاش طبي',
      bountyBtn: 'رصد مكافأة',
      sendCashBtn: 'إرسال نقد',
      sendMailBtn: 'إرسال بريد',
      recentAttacksTitle: 'سجل المواجهات الأخير',
      eventsTitle: 'سجل الأحداث الزمني المباشر (آخر 40 حدثاً)',
      drawerTitleEvents: 'سجل الأحداث ودليل اللاعبين',
      closeLbl: 'إغلاق',
      freeAirstrip: 'مجاناً (مدرج خاص)',
      kvLevelCity: 'المستوى / المدينة',
      kvNetworth: 'صافي الثروة',
      kvFaction: 'العائلة',
      kvAwardsWins: 'الأوسمة / الانتصارات',
      mailPlaceholder: 'اكتب برقية إلى ',
      noEvents: 'لا توجد أحداث مسجلة بعد.',
      loadOperativesHint: 'اضغط بحث لتحميل قائمة العملاء النشطين.'
    }
  };

  /* ------------------------------------------------------------------------
   * 3. RUNTIME STORE & DRAFT INPUT PRESERVATION
   * ------------------------------------------------------------------------ */
  var feedbackTimer = null;
  var store = {
    gameplay: null,
    foreignMarket: null,
    factionChain: null,
    eventsFeed: [],
    directory: [],
    selectedProfile: null,
    hospitalPatients: [],
    busy: false,
    feedback: null, // { text, tone } — strictly null on boot, auto-dismisses after 4000ms
    feedbackAt: 0,
    lastCrimeOutcome: null, // { crimeId, tier, text, loot, at }
    drawerOpen: false,
    drawerMode: 'both', // 'events' | 'directory' | 'both'
    lastScreen: '',
    unreadCount: 0,
    lastSeenEventTs: 0,
    drafts: {
      stockQty: {},
      cdPrincipal: '50000',
      cdTerm: '7d',
      vaultAmount: '25000',
      foreignQty: {},
      playerQuery: '',
      statusFilter: 'all',
      bountyAmount: '25000',
      bountyReason: 'Syndicate contract',
      sendCashAmount: '5000',
      mailSubject: 'Syndicate Wire',
      mailBody: ''
    }
  };

  try {
    store.lastSeenEventTs = Number(window.localStorage.getItem('zone.v148.eventsSeenTs') || 0) || 0;
  } catch (_) {}

  function isAr() {
    var d = document.documentElement;
    return Boolean(d && (d.lang === 'ar' || d.dir === 'rtl'));
  }

  function L() {
    return isAr() ? COPY.ar : COPY.en;
  }

  function isPreview() {
    try {
      return new URLSearchParams(window.location.search || '').get('zone-preview') === '1';
    } catch (_) {
      return false;
    }
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtInt(n) {
    var v = Math.round(Number(n) || 0);
    var sign = v < 0 ? '-' : '';
    return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtMoney(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-$' : '$') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtClock(sec) {
    var s = Math.max(0, Math.ceil(Number(sec) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    if (h > 0) return pad(h) + ':' + pad(m) + ':' + pad(r);
    return pad(m) + ':' + pad(r);
  }

  function getActiveScreen() {
    var main = document.getElementById('zone-main');
    if (main) {
      var attr = main.getAttribute('data-zone-screen');
      if (attr) return String(attr).toLowerCase();
    }
    try {
      var qp = new URLSearchParams(window.location.search || '').get('screen');
      if (qp) return String(qp).toLowerCase();
    } catch (_) {}
    return 'home';
  }

  /* ------------------------------------------------------------------------
   * 4. NETWORK & SESSION HELPERS (AUTHORITATIVE API INTEGRATION)
   * ------------------------------------------------------------------------ */
  async function ensurePlayerSession() {
    if (isPreview()) return;
    if (window.ZoneSession && typeof window.ZoneSession.ensure === 'function') {
      try {
        await window.ZoneSession.ensure();
      } catch (_) {}
    }
  }

  async function apiGet(path) {
    if (isPreview() || typeof window.fetch !== 'function') return null;
    await ensurePlayerSession();
    var res = await window.fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    var json = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var err = new Error((json && json.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async function apiPost(path, body) {
    if (isPreview() || typeof window.fetch !== 'function') {
      throw new Error('Preview mode active.');
    }
    await ensurePlayerSession();
    var res = await window.fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body || {})
    });
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error((json && json.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  }

  function applyGameplaySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    store.gameplay = snap;
    var g = window.__zoneGame;
    if (g && typeof g.applyGameplay === 'function' && snap.state) {
      try {
        g.applyGameplay(snap);
      } catch (_) {}
    } else if (g && snap.player && typeof g.applyServerPlayer === 'function') {
      try {
        g.applyServerPlayer(snap.player);
        g.forceUpdate();
      } catch (_) {}
    }
    if (typeof window.ZoneSyncHudBars === 'function') {
      try { window.ZoneSyncHudBars(snap); } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('zone:torn-gameplay-synced', { detail: snap }));
    } catch (_) {}
  }

  async function loadGameplayState() {
    try {
      var snap = await apiGet('/api/v1/gameplay');
      if (snap) applyGameplaySnapshot(snap);
      return snap;
    } catch (_) {
      return null;
    }
  }

  async function loadForeignMarketState() {
    try {
      var data = await apiGet('/api/v1/foreign-market');
      if (data) store.foreignMarket = data;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function loadFactionChainState() {
    try {
      var data = await apiGet('/api/v1/faction-chain');
      if (data) store.factionChain = data;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function loadEventsFeedState() {
    try {
      var data = await apiGet('/api/v1/events-feed');
      var list = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.events) ? data.events : (data && Array.isArray(data.items) ? data.items : []));
      store.eventsFeed = list;
      if (data && typeof data.unreadCount === 'number' && store.lastSeenEventTs === 0) {
        store.unreadCount = Math.max(0, data.unreadCount);
      } else {
        computeUnreadEvents();
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  async function loadPlayerDirectory(query, targetId) {
    try {
      var qStr = query != null ? String(query).trim() : store.drafts.playerQuery.trim();
      var url = '/api/v1/player-profile';
      if (targetId) {
        url += '?id=' + encodeURIComponent(String(targetId));
      } else if (qStr) {
        url += '?q=' + encodeURIComponent(qStr);
      }
      var data = await apiGet(url);
      if (!data) return null;
      if (Array.isArray(data.players) || Array.isArray(data.directory)) {
        store.directory = data.players || data.directory || [];
        if (data.profile) store.selectedProfile = data.profile;
        else if (!store.selectedProfile && store.directory.length > 0) {
          store.selectedProfile = store.directory[0];
        }
      } else if (data.profile && typeof data.profile === 'object') {
        store.selectedProfile = data.profile;
        if (Array.isArray(data.results)) store.directory = data.results;
      } else if (data.id || data.username) {
        store.selectedProfile = data;
        var exists = store.directory.some(function (p) { return String(p.id) === String(data.id); });
        if (!exists) store.directory = [data].concat(store.directory);
      }
      if (window.ZoneProfileAvatar && typeof window.ZoneProfileAvatar.ingestDirectory === 'function') {
        try { window.ZoneProfileAvatar.ingestDirectory(store.directory); } catch (_) {}
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  async function loadHospitalPatients() {
    try {
      var data = await apiGet('/api/v1/hospital/patients');
      var list = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.patients) ? data.patients : []);
      store.hospitalPatients = list;
      return list;
    } catch (_) {
      return [];
    }
  }

  function computeUnreadEvents() {
    var count = 0;
    for (var i = 0; i < store.eventsFeed.length; i++) {
      var ev = store.eventsFeed[i];
      if (!ev) continue;
      if (ev.unread === true || ev.read === false) {
        count++;
        continue;
      }
      var ts = ev.occurredAt || ev.createdAt || ev.at || ev.time;
      var parsed = ts ? Date.parse(ts) : 0;
      if (parsed && store.lastSeenEventTs > 0 && parsed > store.lastSeenEventTs) {
        count++;
      } else if (store.lastSeenEventTs === 0 && i < 3) {
        count++;
      }
    }
    store.unreadCount = count;
  }

  function markEventsRead() {
    store.lastSeenEventTs = Date.now();
    store.unreadCount = 0;
    try {
      window.localStorage.setItem('zone.v148.eventsSeenTs', String(store.lastSeenEventTs));
    } catch (_) {}
  }

  /* ------------------------------------------------------------------------
   * 5. NORMALIZED STATE READERS (RESILIENT ACROSS BACKEND VARIATIONS)
   * ------------------------------------------------------------------------ */
  function getPlayerAndState() {
    var g = window.__zoneGame;
    var snap = store.gameplay || {};
    var state = snap.state || (g && g.p) || {};
    var player = snap.player || (g && g.p) || {};
    var tornV2 = snap.tornV2 || state.tornV2 || {};
    var inv = state.inv || (g && g.p && g.p.inv) || {};
    var plushies = state.plushies || (g && g.p && g.p.plushies) || {};
    var eduDone = state.eduDone || (g && g.p && g.p.eduDone) || {};
    var skill = state.skill || (g && g.p && g.p.skill) || {};
    return {
      game: g,
      snap: snap,
      state: state,
      player: player,
      tornV2: tornV2,
      inv: inv,
      plushies: plushies,
      eduDone: eduDone,
      skill: skill
    };
  }

  function getLiveCooldowns() {
    var ctx = getPlayerAndState();
    var nowMs = Date.now();
    var rawCds = ctx.state.cooldowns || (ctx.game && ctx.game.p && ctx.game.p.cooldowns) || {};
    var v2Cds = ctx.tornV2.cooldowns || {};

    var drugUntil = Number(rawCds.drugUntil || 0);
    var medUntil = Number(rawCds.medicalUntil || 0);
    var boostUntil = Number(rawCds.boosterUntil || 0);

    var drugSec = drugUntil > nowMs
      ? Math.ceil((drugUntil - nowMs) / 1000)
      : Math.max(0, Number(v2Cds.drugSeconds || 0));
    var medSec = medUntil > nowMs
      ? Math.ceil((medUntil - nowMs) / 1000)
      : Math.max(0, Number(v2Cds.medicalSeconds || 0));
    var boostSec = boostUntil > nowMs
      ? Math.ceil((boostUntil - nowMs) / 1000)
      : Math.max(0, Number(v2Cds.boosterSeconds || 0));

    var addiction = Math.max(
      0,
      Number(
        ctx.tornV2.addiction != null ? ctx.tornV2.addiction :
        ctx.state.addiction != null ? ctx.state.addiction :
        (ctx.state.tornState && ctx.state.tornState.addiction != null ? ctx.state.tornState.addiction : 0)
      ) || 0
    );
    var odCount = Math.max(0, Number(rawCds.overdoseCount || v2Cds.overdoseCount || 0));

    return {
      drugSec: drugSec,
      medSec: medSec,
      boostSec: boostSec,
      addiction: addiction,
      odCount: odCount
    };
  }

  function getLiveChainInfo() {
    var nowSec = Math.floor(Date.now() / 1000);
    var fc = store.factionChain;
    var chainObj = (fc && fc.chain) || fc || null;
    var ctx = getPlayerAndState();
    var v2Chain = ctx.tornV2.factionChain || ctx.tornV2.chain || null;
    var src = chainObj || v2Chain || {};

    var count = Number(src.count != null ? src.count : (ctx.state.fac && ctx.state.fac.chain) || 0) || 0;
    var best = Number(src.best != null ? src.best : (ctx.state.fac && ctx.state.fac.best) || count) || 0;
    var expiresAt = Number(src.expiresAt || 0);
    if (expiresAt > 1e11) expiresAt = Math.floor(expiresAt / 1000);
    var remSec = expiresAt > nowSec
      ? (expiresAt - nowSec)
      : Math.max(0, Number(src.remainingSeconds || 0));
    if (count <= 0) remSec = 0;

    var nextMilestone = 10;
    for (var i = 0; i < CHAIN_MILESTONES.length; i++) {
      if (count < CHAIN_MILESTONES[i]) {
        nextMilestone = CHAIN_MILESTONES[i];
        break;
      }
      nextMilestone = 1000;
    }

    return {
      hasFaction: fc ? Boolean(fc.hasFaction) : Boolean(ctx.snap.family || (ctx.game && ctx.game.sharedFamily)),
      factionName: fc && fc.factionName
        ? (typeof fc.factionName === 'object' ? (isAr() ? fc.factionName.ar : fc.factionName.en) : String(fc.factionName))
        : '',
      count: count,
      best: best,
      nextMilestone: Number(src.nextMilestone || nextMilestone),
      remSec: remSec,
      multiplier: Number(src.multiplier || 1).toFixed(2)
    };
  }

  function getLiveFlightInfo() {
    var fm = store.foreignMarket || {};
    var ctx = getPlayerAndState();
    var travel = fm.travel || ctx.snap.travel || (ctx.game && ctx.game.p && ctx.game.p.travel) || {};
    var status = String(travel.status || fm.status || 'home').toLowerCase();
    var dest = String(
      (status === 'traveling' ? travel.destination : (fm.currentCity || fm.activeHubId || travel.destination)) ||
      ctx.player.city ||
      'Zone City'
    );
    var origin = String(travel.origin || 'Zone City');

    var remSec = 0;
    var totalSec = Math.max(1, Number(travel.totalSeconds || 180));
    if (travel.arrivesAt) {
      var arrMs = Date.parse(travel.arrivesAt);
      if (Number.isFinite(arrMs)) {
        remSec = Math.max(0, Math.ceil((arrMs - Date.now()) / 1000));
      }
    } else if (travel.remainingSeconds != null) {
      remSec = Math.max(0, Number(travel.remainingSeconds) || 0);
    }

    if (status === 'traveling' && remSec <= 0 && travel.arrivesAt) {
      status = 'arrived';
    }

    var pct = status === 'traveling'
      ? Math.max(4, Math.min(99, Math.round(((totalSec - remSec) / totalSec) * 100)))
      : 100;

    var isHome = fm.isHomeCity != null
      ? Boolean(fm.isHomeCity)
      : (!dest || /^zone city$|^harbor$|^center$/i.test(dest));
    var isAbroad = fm.isAbroad != null
      ? Boolean(fm.isAbroad)
      : (status !== 'traveling' && !isHome);

    var staff = (ctx.tornV2.islandStaff && ctx.tornV2.islandStaff.hired) || (ctx.state.tornState && ctx.state.tornState.staff) || {};
    var hasAirstrip = Boolean(
      (fm.perks && fm.perks.hasAirstrip) ||
      fm.hasAirstrip ||
      fm.airstrip ||
      ctx.state.prop === 'island' ||
      staff.pilot
    );

    var lugUsed = Number(
      (fm.luggage && fm.luggage.used != null ? fm.luggage.used : null) != null ? fm.luggage.used :
      fm.luggageUsed != null ? fm.luggageUsed :
      (fm.capacity && fm.capacity.used) || 0
    );
    var lugMax = Number(
      (fm.luggage && fm.luggage.capacity != null ? fm.luggage.capacity : null) != null ? fm.luggage.capacity :
      fm.luggageMax != null ? fm.luggageMax :
      (fm.perks && fm.perks.capacity) != null ? fm.perks.capacity :
      (fm.capacity && fm.capacity.max) != null ? fm.capacity.max :
      (hasAirstrip ? 15 : 5) + (Number(ctx.inv.travel_cap || ctx.inv.large_suitcase || 0) > 0 ? 4 : 0)
    );

    return {
      status: status,
      origin: origin,
      destination: dest,
      remSec: remSec,
      totalSec: totalSec,
      pct: pct,
      isHome: isHome,
      isAbroad: isAbroad,
      hasAirstrip: hasAirstrip,
      lugUsed: lugUsed,
      lugMax: lugMax
    };
  }

  /* ------------------------------------------------------------------------
   * 6. MUTATION DISPATCHERS & 4,000MS AUTO-DISMISSING FEEDBACK TOAST
   * ------------------------------------------------------------------------ */
  function dismissFeedback() {
    if (feedbackTimer) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    store.feedback = null;
    store.feedbackAt = 0;
    store.lastCrimeOutcome = null;
    renderAll();
  }

  function setFeedback(text, tone) {
    if (feedbackTimer) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    if (!text) {
      store.feedback = null;
      store.feedbackAt = 0;
      renderAll();
      return;
    }
    var stampedAt = Date.now();
    store.feedback = { text: String(text), tone: tone || 'sage' };
    store.feedbackAt = stampedAt;
    renderAll();

    feedbackTimer = window.setTimeout(function () {
      if (store.feedback && store.feedbackAt === stampedAt && (Date.now() - stampedAt >= 3900)) {
        store.feedback = null;
        store.feedbackAt = 0;
        store.lastCrimeOutcome = null;
        renderAll();
      }
    }, FEEDBACK_TTL_MS);
  }

  async function execGameplayAction(action, id, expectedPrice) {
    if (store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var ctx = getPlayerAndState();
      var ver = Number((ctx.game && ctx.game.gameplayVersion) || (ctx.state && ctx.state.version) || 0);
      if (!ver) {
        var initSnap = await loadGameplayState();
        ver = Number((initSnap && initSnap.state && initSnap.state.version) || 1);
      }
      var req = { action: action, id: String(id == null ? '' : id), expectedVersion: ver };
      if (expectedPrice !== undefined) req.expectedPrice = Number(expectedPrice);

      var snap;
      try {
        snap = await apiPost('/api/v1/gameplay/action', req);
      } catch (err) {
        if (err && err.status === 409) {
          var fresh = await loadGameplayState();
          req.expectedVersion = Number((fresh && fresh.state && fresh.state.version) || ver + 1);
          snap = await apiPost('/api/v1/gameplay/action', req);
        } else {
          throw err;
        }
      }

      applyGameplaySnapshot(snap);
      var res = (snap && snap.result) || {};

      if (action === 'torn.crime2Execute' || action === 'torn.shoplift' || action === 'torn.searchCash') {
        var rawTier = String(res.crimeTier || res.tier || res.outcome || (res.success === false ? 'FAIL' : 'SUCCESS')).toUpperCase().replace(/_/g, ' ');
        var loot = res.lootItem || res.itemGranted || res.loot || '';
        var delta = Number(res.cashDelta || 0);
        var skDelta = res.skillDelta != null ? Number(res.skillDelta) : null;
        var xpGain = Number(res.xpAwarded || res.xpDelta || 0);
        var skimmed = Number(res.nemesisSkimmed || 0);
        var summary = rawTier + (delta ? (' · ' + (delta > 0 ? '+' : '') + fmtMoney(delta)) : '') +
          (xpGain > 0 ? (' · +' + xpGain + ' XP') : '') +
          (skDelta !== null ? (' · Skill ' + (skDelta >= 0 ? '+' : '') + skDelta) : '') +
          (skimmed > 0 ? (' · Nemesis Tax -' + fmtMoney(skimmed)) : '') +
          (loot ? (' · Loot: ' + loot) : '');
        store.lastCrimeOutcome = { crimeId: String(id), tier: rawTier, text: summary, loot: loot, at: Date.now() };
        var tone = rawTier.indexOf('UNIQUE') >= 0 ? 'unique' : (rawTier.indexOf('CRITICAL') >= 0 ? 'bad' : (rawTier === 'FAIL' ? 'warn' : 'sage'));
        setFeedback(summary, tone);
        if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
          try { window.ZoneEcs3D.triggerStageAction('heist-breach', 'crime', res); } catch (_) {}
        }
        if (window.ZoneAscension && typeof window.ZoneAscension.refresh === 'function') {
          try { window.ZoneAscension.refresh(false); } catch (_) {}
        }
      } else {
        var msgParts = [res.message || res.summary || (action + (id ? ' (' + id + ')' : ''))];
        if (res.overdosed || res.overdose || res.outcome === 'overdose') {
          setFeedback('OVERDOSE! ' + (res.message || 'Sent to Hospital · Energy drained.'), 'bad');
        } else {
          if (Number(res.cashDelta)) msgParts.push((res.cashDelta > 0 ? '+' : '') + fmtMoney(res.cashDelta));
          if (Number(res.bankDelta)) msgParts.push('Bank ' + (res.bankDelta > 0 ? '+' : '') + fmtMoney(res.bankDelta));
          var ptsDelta = Number(
            res.pointsDelta != null ? res.pointsDelta :
            (res.pointsAwarded ? Number(res.pointsAwarded) : (res.pointsSpent ? -Number(res.pointsSpent) : 0))
          );
          if (ptsDelta) msgParts.push((ptsDelta > 0 ? '+' : '') + ptsDelta + ' pts');
          setFeedback(msgParts.join(' · '), res.success === false ? 'warn' : 'sage');
        }
      }
      return snap;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Action rejected by server.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execForeignAction(payload) {
    if (store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var data = await apiPost('/api/v1/foreign-market/action', payload);
      if (data) {
        if (typeof window.ZoneSyncHudBars === 'function' && data.player) {
          try { window.ZoneSyncHudBars(data); } catch (_) {}
        }
        if (data.market || data.destinations || data.travel || data.status) {
          store.foreignMarket = data.market || data;
        } else {
          await loadForeignMarketState();
        }
      }
      await loadGameplayState();
      var act = payload.action;
      var msg = data && data.message
        ? data.message
        : (act === 'depart' ? ('Departed for ' + payload.destination) :
           act === 'return' ? 'Flight home departed for Zone City.' :
           act === 'buy' ? ('Purchased ' + (payload.quantity || 1) + 'x ' + payload.itemId) :
           'Zurich rehabilitation complete!');
      setFeedback(msg, 'sage');
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Travel action failed.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execFactionAction(payload) {
    if (store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var data = await apiPost('/api/v1/faction-chain/action', payload);
      if (data && typeof window.ZoneSyncHudBars === 'function' && data.player) {
        try { window.ZoneSyncHudBars(data); } catch (_) {}
      }
      if (data && data.chain) store.factionChain = data;
      else await loadFactionChainState();
      await loadGameplayState();
      var r = (data && data.result) || {};
      if ((payload.action === 'wall.join' || payload.action === 'wall.assault') && window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
        try { window.ZoneEcs3D.triggerStageAction('combat-arena', payload.action, r); } catch (_) {}
      }
      var note = (data && data.message) ||
        (payload.action + (r.scoreDelta ? (' · +' + r.scoreDelta + ' Wall') : '') + (r.respectAwarded ? (' · +' + r.respectAwarded + ' Respect') : ''));
      setFeedback(note, 'sage');
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Faction action failed.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execRevivePlayer(targetPlayerId) {
    if (!targetPlayerId || store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var data = await apiPost('/api/v1/hospital/revive-player', { targetPlayerId: String(targetPlayerId) });
      await Promise.all([loadGameplayState(), loadHospitalPatients(), loadPlayerDirectory(null, targetPlayerId), loadEventsFeedState()]);
      setFeedback((data && data.message) || ('Revived operative ' + targetPlayerId + '!'), 'sage');
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Revive failed.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execPlaceBounty(target) {
    var amt = Math.max(1000, Math.round(Number(store.drafts.bountyAmount) || 25000));
    var reason = String(store.drafts.bountyReason || 'Syndicate contract').trim();
    if (store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var data = await apiPost('/api/v1/social/action', {
        action: 'bounty.place',
        target: String(target),
        rewardCash: amt,
        reason: reason
      });
      await Promise.all([loadGameplayState(), loadEventsFeedState()]);
      setFeedback('Bounty placed on ' + target + ' (' + fmtMoney(amt) + ')!', 'gold');
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Bounty placement failed.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execSendMail(recipient) {
    var subj = String(store.drafts.mailSubject || 'Syndicate Wire').trim();
    var body = String(store.drafts.mailBody || '').trim() || 'Greetings from Zone City Syndicate.';
    if (store.busy) return null;
    store.busy = true;
    renderAll();
    try {
      var data = await apiPost('/api/v1/social/action', {
        action: 'mail.send',
        recipient: String(recipient),
        subject: subj,
        body: body
      });
      store.drafts.mailBody = '';
      setFeedback('Encrypted mail delivered to ' + recipient + '.', 'sage');
      return data;
    } catch (err) {
      setFeedback(err && err.message ? err.message : 'Mail dispatch failed.', 'bad');
      return null;
    } finally {
      store.busy = false;
      renderAll();
    }
  }

  async function execSendCash(targetId, targetName) {
    var amt = Math.max(100, Math.round(Number(store.drafts.sendCashAmount) || 5000));
    try {
      var socialRes = await apiPost('/api/v1/social/action', {
        action: 'cash.send',
        recipient: String(targetName || targetId),
        amount: amt
      });
      await loadGameplayState();
      setFeedback('Wired ' + fmtMoney(amt) + ' to ' + (targetName || targetId) + '.', 'sage');
      return socialRes;
    } catch (_) {
      return execGameplayAction('social.sendCash', String(targetId), amt);
    }
  }

  function navigateToScreen(screen) {
    var target = String(screen || 'home').toLowerCase();
    if (window.ZoneMeritsUI && typeof window.ZoneMeritsUI.isOpen === 'function' && window.ZoneMeritsUI.isOpen()) {
      try { window.ZoneMeritsUI.close(); } catch (_) {}
    }
    var g = window.__zoneGame;
    if (g && typeof g.go === 'function') {
      try { g.go(target); } catch (_) {}
    }
    var main = document.getElementById('zone-main');
    if (main && (!g || String(main.getAttribute('data-zone-screen') || '').toLowerCase() !== target)) {
      main.setAttribute('data-zone-screen', target);
    }
    if (target === 'city') loadForeignMarketState();
    else if (target === 'faction') loadFactionChainState();
    else if (target === 'hospital') loadHospitalPatients();
    renderAll();
  }

  function execAttackPlayer(profile) {
    if (!profile) return;
    closeDrawer();
    var g = window.__zoneGame;
    if (g && typeof g.setCombatMode === 'function') {
      try { g.setCombatMode('players'); } catch (_) {}
    }
    navigateToScreen('attack');
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
      try { window.ZoneEcs3D.triggerStageAction('combat-arena', 'attack', { targetId: profile.id, targetName: profile.username }); } catch (_) {}
    }
    setFeedback('Opened PvP Combat Arena targeting ' + (profile.username || profile.id) + '.', 'gold');
  }

  /* ------------------------------------------------------------------------
   * 7. 3D ITEM SHOWCASE, AVATAR BADGES & ROUTE-SCOPED WATERCOLOR RENDERERS
   * ------------------------------------------------------------------------ */
  function inferZtlItemCategory(itemId, fallbackCat) {
    var k = String(itemId || '').toLowerCase();
    if (/xanax|ecstasy|vicodin|cannabis|lsd|epinephrine/.test(k)) return 'drug';
    if (/bloodbag|blood_bag|morphine|medkit|smallkit|small_medkit|first_aid/.test(k)) return 'medical';
    if (/edvd|fhc|energy_drink|edrink|candy/.test(k)) return 'booster';
    if (/kevlar|helmet|vest|armor|boots|gloves_tac|pants_tac/.test(k)) return 'armor';
    if (/pistol|revolver|ak|sniper|shotgun|smg|rifle|flash_grenade|smoke_grenade|knife|bat|katana/.test(k)) return 'weapon';
    if (/glasses|high_speed_drive|paint_mask|mountain_bike|cut_throat_razor|duct_tape|flashlight|megaphone|latex_gloves|office_chair|magnifying_glass|ergonomic_keyboard|windproof_lighter|lawyer_card/.test(k)) return 'enhancer';
    if (/plush|flower|orchid|lotus|peony|cherry|violet|tribulus|gold_bullion|snow_globe/.test(k)) return 'contraband';
    return fallbackCat || 'contraband';
  }

  function render3dItemShowcase(itemId, cat, title) {
    var idStr = String(itemId || 'medkit');
    var resolvedCat = inferZtlItemCategory(idStr, cat);
    var lbl = String(title || idStr);
    return (
      '<div class="ztl-item-3d-row">' +
        '<div class="z3d-item-slot" data-z3d-item="' + esc(idStr) + '" data-z3d-cat="' + esc(resolvedCat) + '"></div>' +
        '<button type="button" class="ztl-btn ztl-3d-inspect-btn" data-ztl-act="inspect-3d" data-z3d-inspect="' + esc(idStr) + '" data-z3d-cat="' + esc(resolvedCat) + '" data-z3d-title="' + esc(lbl) + '" aria-label="3D ' + esc(lbl) + '">3D</button>' +
      '</div>'
    );
  }

  function renderInlineAvatar(playerId) {
    return '<span class="zpa-inline-avatar" data-zpa-avatar="' + esc(playerId || '') + '"></span>';
  }
  function renderFeedbackHtml() {
    if (!store.feedback) return '';
    return (
      '<div class="ztl-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' +
        '<span>' + esc(store.feedback.text) + '</span>' +
        '<button type="button" class="ztl-btn" data-ztl-act="clear-feedback" aria-label="Dismiss">✕</button>' +
      '</div>'
    );
  }

  /* Route 1: `crimes` ONLY -> Unified 13-Tier Crime Progression Ladder (#1..#13 + Nemesis Heat-Tax Warning) */
  function crimeRequiredLevel(crimeId, srv) {
    if (srv && Number(srv.requiredLevel || srv.unlockLevel) > 0) {
      return Number(srv.requiredLevel || srv.unlockLevel);
    }
    var n = Number(crimeId) || 1;
    if (n <= 3) return 1;
    if (n <= 6) return 3;
    if (n <= 9) return 6;
    if (n <= 12) return 10;
    return 14;
  }

  function renderCrimesSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var playerLv = Math.max(1, Number((ctx.player && ctx.player.level) || (ctx.game && ctx.game.p && ctx.game.p.level) || 1));
    var v2List = Array.isArray(ctx.tornV2.crimes2CatalogWithSkill) ? ctx.tornV2.crimes2CatalogWithSkill : [];
    var v2ById = {};
    for (var vi = 0; vi < v2List.length; vi++) {
      var row = v2List[vi];
      if (row && row.id != null) v2ById[String(row.id)] = row;
    }

    var ascSnap = (window.ZoneAscension && typeof window.ZoneAscension.getState === 'function')
      ? window.ZoneAscension.getState()
      : null;
    var rawAsc = (ctx.state && ctx.state.ascension) || {};
    var nem = (ascSnap && ascSnap.nemesis) || rawAsc.nemesis || null;
    var heatTaxPct = nem && !nem.heatCleared ? Math.max(0, Number(nem.heatTaxPct || 0)) : 0;
    var nemesisBannerHtml = '';
    if (heatTaxPct > 0 && nem) {
      var nemName = ar ? (nem.nameAr || nem.nameEn || 'العدو اللدود') : (nem.nameEn || nem.nameAr || 'Rival Nemesis');
      var nemDist = ar ? (nem.districtAr || nem.district || nem.districtEn || '') : (nem.districtEn || nem.district || '');
      nemesisBannerHtml =
        '<div class="zab-crimes-nemesis-banner" data-zab-crimes-nemesis="1">' +
          '<span>' +
            (ar
              ? ('⚠ إتاوة العدو اللدود: ' + esc(nemName) + (nemDist ? (' (' + esc(nemDist) + ')') : '') + ' يقتطع -' + heatTaxPct + '% من عوائد جرائم الشارع!')
              : ('⚠ Nemesis Heat Tax: ' + esc(nemName) + (nemDist ? (' (' + esc(nemDist) + ')') : '') + ' is skimming -' + heatTaxPct + '% off your street crimes!')) +
          '</span>' +
          '<button type="button" class="ztl-btn" data-ztl-act="go-screen" data-screen="home">' +
            (ar ? 'تتبّع وواجه الخصم ←' : 'Track & Confront on Home →') +
          '</button>' +
        '</div>';
    }

    var outcomeHtml = '';
    if (store.lastCrimeOutcome) {
      var oc = store.lastCrimeOutcome;
      var ocTone = oc.tier.indexOf('UNIQUE') >= 0 ? 'gold' : (oc.tier.indexOf('CRITICAL') >= 0 ? 'crimson' : (oc.tier === 'FAIL' ? 'gold' : 'sage'));
      outcomeHtml =
        '<div class="ztl-card" data-ztl-crime-outcome="' + esc(oc.tier) + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-chip" data-tone="' + ocTone + '">★ ' + esc(oc.tier) + '</span>' +
            '<bdi class="ztl-card-meta">#' + esc(oc.crimeId) + '</bdi>' +
          '</div>' +
          '<div class="ztl-card-title">' + esc(oc.text) + '</div>' +
        '</div>';
    }

    var cardsHtml = '<div class="ztl-grid-cards">';
    for (var i = 0; i < CRIMES_2_CATALOG.length; i++) {
      var c = CRIMES_2_CATALOG[i];
      var srv = v2ById[c.id] || {};
      var reqLv = crimeRequiredLevel(c.id, srv);
      var isTierOpen = playerLv >= reqLv;
      var skillVal = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number(
              srv.skill != null ? srv.skill :
              ctx.skill['crime2_' + c.id] != null ? ctx.skill['crime2_' + c.id] :
              ctx.skill['crime2_' + c.slug] != null ? ctx.skill['crime2_' + c.slug] :
              ctx.skill[c.altKey] != null ? ctx.skill[c.altKey] : 0
            ) || 0
          )
        )
      );
      var enhId = srv.enhancerId || c.enhancerId;
      var hasEnh = Boolean(srv.enhancerOwned || srv.hasEnhancer || Number(ctx.inv[enhId] || 0) > 0);
      var nerveCost = Number(srv.nerve || c.nerve);
      var title = ar ? c.ar : c.en;
      var enhLabel = ar ? c.enhAr : c.enhEn;
      var gateBadge = isTierOpen
        ? (ar ? ('مفتوح · م ' + reqLv) : ('Tier Lv ' + reqLv))
        : (ar ? ('مقفل · م ' + reqLv) : ('Unlocks Lv ' + reqLv));

      var commitBtnHtml = isTierOpen
        ? (
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="crime2" data-id="' + c.id + '"' + (store.busy ? ' disabled' : '') + '>' +
              esc(copy.commitCrime) + ' <bdi>(' + nerveCost + 'N)</bdi>' +
            '</button>'
          )
        : (
            '<button type="button" class="ztl-btn ztl-btn-locked" data-ztl-act="crime2" data-id="' + c.id + '" disabled aria-disabled="true">' +
              esc(ar ? ('مقفل · م ' + reqLv) : ('Locked · Lv ' + reqLv)) +
            '</button>'
          );

      cardsHtml +=
        '<article class="ztl-card" data-ztl-crime-card="' + c.id + '" data-ztl-crime-unlocked="' + (isTierOpen ? '1' : '0') + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title"><bdi>#' + c.id + '</bdi> ' + esc(title) + '</span>' +
            '<bdi class="ztl-chip" data-tone="crimson">' + nerveCost + 'N</bdi>' +
          '</div>' +
          render3dItemShowcase(enhId, 'enhancer', enhLabel) +
          '<div class="ztl-row-actions">' +
            '<span class="ztl-chip" data-tone="' + (isTierOpen ? 'sage' : 'crimson') + '">' + esc(gateBadge) + '</span>' +
            '<span class="ztl-chip" data-tone="' + (hasEnh ? 'sage' : 'gold') + '">' +
              esc(enhLabel) + ' · ' + esc(hasEnh ? copy.enhOwned : copy.enhMissing) +
            '</span>' +
          '</div>' +
          '<div class="ztl-meter">' +
            '<div class="ztl-meter-row"><span>' + esc(copy.skillLbl) + '</span><bdi>' + skillVal + ' / 100</bdi></div>' +
            '<div class="ztl-meter-track"><div class="ztl-meter-fill" style="width:' + skillVal + '%"></div></div>' +
          '</div>' +
          '<div class="ztl-row-actions">' +
            commitBtnHtml +
            (!hasEnh
              ? '<button type="button" class="ztl-btn" data-ztl-act="buy-item" data-id="' + esc(enhId) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.buyEnh) + '</button>'
              : '') +
          '</div>' +
        '</article>';
    }
    cardsHtml += '</div>';

    return (
      '<div class="ztl-workspace" data-workspace="crimes">' +
        '<div class="z3d-action-stage ztl-3d-stage" data-z3d-stage="heist-breach"></div>' +
        outcomeHtml +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.crimesTitle) + '</h3><span class="ztl-section-note">' + esc(copy.crimesNote) + '</span></div>' +
          nemesisBannerHtml +
          cardsHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route 2: `items` ONLY -> Pharmacy & Medical Consumables (xanax..morphine + happyJump) */
  function renderItemsPharmacySection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var cds = getLiveCooldowns();

    var itemsHtml = '<div class="ztl-grid-cards">';
    for (var i = 0; i < ITEMS_PHARMACY_CATALOG.length; i++) {
      var it = ITEMS_PHARMACY_CATALOG[i];
      var owned = Math.max(0, Number(ctx.inv[it.id] || 0));
      var cdBlocked =
        (it.kind === 'drug' && cds.drugSec > 0) ||
        (it.kind === 'medical' && cds.medSec >= 21600) ||
        (it.kind === 'booster' && cds.boostSec >= 86400);

      itemsHtml +=
        '<article class="ztl-card" data-ztl-pharm-item="' + it.id + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(ar ? it.ar : it.en) + '</span>' +
            '<bdi class="ztl-chip" data-tone="' + (owned > 0 ? 'sage' : 'gold') + '">' + esc(copy.ownedLbl) + ': ' + owned + '</bdi>' +
          '</div>' +
          render3dItemShowcase(it.id, it.kind, ar ? it.ar : it.en) +
          '<div class="ztl-card-meta">' + esc(ar ? it.effAr : it.effEn) + ' · ' + esc(ar ? it.cdAr : it.cdEn) + (it.odPct !== '0%' ? (' · OD ' + it.odPct) : '') + '</div>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="use-pharm" data-action="' + it.action + '" data-id="' + (it.actionArg || it.id) + '"' + ((owned <= 0 || cdBlocked || store.busy) ? ' disabled' : '') + '>' +
              esc(copy.useBtn) +
            '</button>' +
            '<button type="button" class="ztl-btn" data-ztl-act="buy-item" data-id="' + it.id + '"' + (store.busy ? ' disabled' : '') + '>' +
              esc(copy.buyMarketBtn) + ' <bdi>(' + fmtMoney(it.price) + ')</bdi>' +
            '</button>' +
            (it.id === 'bloodbag'
              ? '<button type="button" class="ztl-btn" data-ztl-act="blood-draw"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.drawBloodBtn) + '</button>'
              : '') +
          '</div>' +
        '</article>';
    }
    itemsHtml += '</div>';

    return (
      '<div class="ztl-workspace" data-workspace="items">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.pharmTitle) + '</h3>' +
            '<div class="ztl-row-actions">' +
              '<span class="ztl-chip" data-tone="' + (cds.drugSec > 0 ? 'crimson' : 'sage') + '">' + esc(copy.drugCd) + ': <bdi data-ztl-cd="drug">' + (cds.drugSec > 0 ? fmtClock(cds.drugSec) : copy.ready) + '</bdi></span>' +
              '<span class="ztl-chip" data-tone="' + (cds.medSec > 0 ? 'gold' : 'sage') + '">' + esc(copy.medCd) + ': <bdi data-ztl-cd="med">' + (cds.medSec > 0 ? fmtClock(cds.medSec) : copy.ready) + '</bdi></span>' +
              '<span class="ztl-chip" data-tone="' + (cds.boostSec > 0 ? 'blue' : 'sage') + '">' + esc(copy.boostCd) + ': <bdi data-ztl-cd="boost">' + (cds.boostSec > 0 ? fmtClock(cds.boostSec) : copy.ready) + '</bdi></span>' +
            '</div>' +
          '</div>' +
          '<span class="ztl-section-note">' + esc(copy.pharmNote) + '</span>' +
          itemsHtml +
          '<div class="ztl-card" data-ztl-happy-jump="1">' +
            '<div class="ztl-card-top">' +
              '<span class="ztl-card-title">' + esc(copy.happyJumpTitle) + '</span>' +
              '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="happy-jump"' + (cds.drugSec > 0 || store.busy ? ' disabled' : '') + '>' + esc(copy.happyJumpBtn) + '</button>' +
            '</div>' +
            '<span class="ztl-card-meta">' + esc(copy.happyJumpDesc) + '</span>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 3: `bank` ONLY -> Zone Stock Exchange (8 Tickers & Benefit Blocks) + Bank Term CDs */
  function renderBankEconomySection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var nowMs = Date.now();
    var v2Stocks = ctx.tornV2.stocks || {};
    var stateStocks = ctx.state.stocks || {};

    var stockRowsHtml = '<div class="ztl-stock-list">';
    for (var i = 0; i < STOCK_CATALOG.length; i++) {
      var sc = STOCK_CATALOG[i];
      var srvS = (Array.isArray(v2Stocks)
        ? v2Stocks.find(function (x) { return x && x.ticker === sc.ticker; })
        : v2Stocks[sc.ticker]) || {};
      var hold = stateStocks[sc.ticker] || srvS.holding || {};
      var price = Math.max(1, Math.round(Number(srvS.price || srvS.livePrice || sc.basePrice)));
      var owned = Math.max(0, Math.round(Number(hold.shares != null ? hold.shares : (srvS.shares || srvS.ownedShares || 0))));
      var blockShares = Math.max(1, Number(srvS.blockShares || sc.blockShares));
      var readyAt = Number(hold.blockReadyAt != null ? hold.blockReadyAt : (srvS.blockReadyAt || 0));
      if (readyAt > 0 && readyAt < 1e11) readyAt = readyAt * 1000;
      var hasBlock = owned >= blockShares;
      var matured = hasBlock && nowMs >= readyAt;
      var progPct = Math.min(100, Math.round((owned / blockShares) * 100));
      var draftQty = store.drafts.stockQty[sc.ticker] || String(Math.max(10, Math.min(blockShares, blockShares - owned || 100)));

      var divLabel = !hasBlock
        ? copy.needBlock
        : (matured ? copy.collectDiv : (copy.maturing + ' ' + fmtClock((readyAt - nowMs) / 1000)));

      stockRowsHtml +=
        '<div class="ztl-stock-row" data-ztl-ticker="' + sc.ticker + '">' +
          '<div>' +
            '<div class="ztl-card-title"><bdi>[' + sc.ticker + ']</bdi> ' + esc(ar ? sc.ar : sc.en) + ' · <bdi>' + fmtMoney(price) + '/sh</bdi></div>' +
            '<div class="ztl-card-meta">' + esc(ar ? sc.perkAr : sc.perkEn) + '</div>' +
          '</div>' +
          '<div class="ztl-meter">' +
            '<div class="ztl-meter-row"><span>' + esc(copy.blockProg) + '</span><bdi>' + fmtInt(owned) + ' / ' + fmtInt(blockShares) + ' sh</bdi></div>' +
            '<div class="ztl-meter-track"><div class="ztl-meter-fill" data-tone="' + (hasBlock ? 'gold' : 'sage') + '" style="width:' + progPct + '%"></div></div>' +
          '</div>' +
          '<div class="ztl-stock-controls">' +
            '<input type="number" min="1" step="10" class="ztl-input ztl-stock-qty" data-ztl-draft="stockQty" data-ticker="' + sc.ticker + '" value="' + esc(draftQty) + '" aria-label="' + sc.ticker + ' shares">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="stock-buy" data-ticker="' + sc.ticker + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.buyShares) + '</button>' +
            '<button type="button" class="ztl-btn" data-ztl-act="stock-sell" data-ticker="' + sc.ticker + '"' + (owned <= 0 || store.busy ? ' disabled' : '') + '>' + esc(copy.sellShares) + '</button>' +
            '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="stock-div" data-ticker="' + sc.ticker + '"' + (!matured || store.busy ? ' disabled aria-disabled="true"' : '') + '>' + esc(divLabel) + '</button>' +
          '</div>' +
        '</div>';
    }
    stockRowsHtml += '</div>';

    var activeCd = ctx.tornV2.activeCd || ctx.state.activeCd || (ctx.state.tornState && ctx.state.tornState.activeCd) || null;
    var cdMaturesAt = activeCd ? Number(activeCd.maturesAt || 0) : 0;
    if (cdMaturesAt > 0 && cdMaturesAt < 1e11) cdMaturesAt *= 1000;
    var cdRemSec = activeCd && cdMaturesAt > nowMs ? Math.ceil((cdMaturesAt - nowMs) / 1000) : 0;
    var cdMatured = Boolean(activeCd && cdMaturesAt > 0 && nowMs >= cdMaturesAt);

    var cdActiveHtml = '';
    if (activeCd && (activeCd.principal || activeCd.payout || activeCd.yield)) {
      cdActiveHtml =
        '<div class="ztl-card" data-ztl-active-cd="1">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(copy.cdActiveLbl) + ': <bdi>' + esc(activeCd.term || '7d') + '</bdi></span>' +
            '<bdi class="ztl-chip" data-tone="' + (cdMatured ? 'sage' : 'gold') + '" data-ztl-cd="bankcd">' + (cdMatured ? copy.ready : fmtClock(cdRemSec)) + '</bdi>' +
          '</div>' +
          '<div class="ztl-card-meta">Principal: <bdi>' + fmtMoney(activeCd.principal || 0) + '</bdi> → Payout: <bdi>' + fmtMoney(activeCd.payout || activeCd.yield || 0) + '</bdi></div>' +
          '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="bank-claim-cd"' + (!cdMatured || store.busy ? ' disabled' : '') + '>' + esc(copy.claimCdBtn) + '</button>' +
        '</div>';
    }

    var terms = ['1h', '7d', '14d', '30d', '90d'];
    var termOpts = '';
    for (var ti = 0; ti < terms.length; ti++) {
      var tm = terms[ti];
      termOpts += '<option value="' + tm + '"' + (store.drafts.cdTerm === tm ? ' selected' : '') + '>' + tm + '</option>';
    }

    return (
      '<div class="ztl-workspace" data-workspace="bank">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.stocksTitle) + '</h3><span class="ztl-section-note">' + esc(copy.stocksNote) + '</span></div>' +
          stockRowsHtml +
        '</section>' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.bankCdTitle) + '</h3></div>' +
          cdActiveHtml +
          '<div class="ztl-row-actions">' +
            '<input type="number" min="5000" step="5000" class="ztl-input" data-ztl-draft="cdPrincipal" value="' + esc(store.drafts.cdPrincipal) + '" placeholder="' + esc(copy.principalLbl) + '" aria-label="CD Principal">' +
            '<select class="ztl-select" data-ztl-draft="cdTerm" aria-label="CD Term">' + termOpts + '</select>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="bank-lock-cd"' + (Boolean(activeCd && !cdMatured) || store.busy ? ' disabled' : '') + '>' + esc(copy.lockCdBtn) + '</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 4: `market` ONLY -> Points Building Refills (25 pts Energy / Nerve) */
  function renderMarketPointsSection() {
    var copy = L();
    var ctx = getPlayerAndState();
    var pointsNow = Number(ctx.state.points != null ? ctx.state.points : ctx.player.points || 0);
    var refillsUsed = ctx.tornV2.pointsRefillsUsedToday || {};

    return (
      '<div class="ztl-workspace" data-workspace="market">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.pointsTitle) + '</h3>' +
            '<bdi class="ztl-chip" data-tone="gold">Points: ' + fmtInt(pointsNow) + '</bdi>' +
          '</div>' +
          '<span class="ztl-section-note">' + esc(copy.pointsNote) + '</span>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="points-energy"' + (pointsNow < 25 || refillsUsed.energy || store.busy ? ' disabled' : '') + '>' +
              esc(copy.refillEnergyBtn) +
            '</button>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="points-nerve"' + (pointsNow < 25 || refillsUsed.nerve || store.busy ? ' disabled' : '') + '>' +
              esc(copy.refillNerveBtn) +
            '</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 5: `properties` ONLY -> Property Mug-Proof Cash Vault & Private Island Staff */
  function renderPropertiesVaultSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var vaultBal = Math.max(0, Number(ctx.tornV2.vaultBalance != null ? ctx.tornV2.vaultBalance : ctx.state.vaultBalance || 0));
    var vaultCap = Math.max(
      0,
      Number(
        ctx.tornV2.vaultCap != null
          ? ctx.tornV2.vaultCap
          : (ctx.state.prop === 'island' ? 1000000000 : ctx.state.prop === 'villa' ? 100000000 : ctx.state.prop === 'house' ? 25000000 : ctx.state.prop === 'semi' ? 5000000 : ctx.state.prop === 'apt' ? 1000000 : 0)
      )
    );
    var vaultPct = vaultCap > 0 ? Math.min(100, Math.round((vaultBal / vaultCap) * 100)) : 0;
    var hiredStaff = (ctx.tornV2.islandStaff && ctx.tornV2.islandStaff.hired) || (ctx.state.tornState && ctx.state.tornState.staff) || {};
    var staffCat = (ctx.tornV2.islandStaff && ctx.tornV2.islandStaff.catalog) || {};

    var staffHtml = '<div class="ztl-grid-compact">';
    for (var si = 0; si < ISLAND_STAFF.length; si++) {
      var stf = ISLAND_STAFF[si];
      var isHired = Boolean(hiredStaff[stf.id]);
      var stfCost = (staffCat[stf.id] && staffCat[stf.id].cost != null) ? Number(staffCat[stf.id].cost) : stf.cost;
      staffHtml +=
        '<div class="ztl-card">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(ar ? stf.ar : stf.en) + '</span>' +
            '<bdi class="ztl-chip" data-tone="' + (isHired ? 'sage' : 'gold') + '">' + (isHired ? esc(copy.hiredTag) : fmtMoney(stfCost)) + '</bdi>' +
          '</div>' +
          '<span class="ztl-card-meta">' + esc(ar ? stf.perkAr : stf.perkEn) + '</span>' +
          '<button type="button" class="ztl-btn" data-ztl-act="hire-staff" data-id="' + stf.id + '"' + (isHired || store.busy ? ' disabled' : '') + '>' + esc(isHired ? copy.hiredTag : copy.hireStaff) + '</button>' +
        '</div>';
    }
    staffHtml += '</div>';

    return (
      '<div class="ztl-workspace" data-workspace="properties">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.vaultTitle) + '</h3><bdi class="ztl-chip" data-tone="sage">' + fmtMoney(vaultBal) + ' / ' + fmtMoney(vaultCap) + '</bdi></div>' +
          '<span class="ztl-section-note">' + esc(copy.vaultNote) + '</span>' +
          '<div class="ztl-meter-track"><div class="ztl-meter-fill" style="width:' + vaultPct + '%"></div></div>' +
          '<div class="ztl-row-actions">' +
            '<input type="number" min="100" step="1000" class="ztl-input" data-ztl-draft="vaultAmount" value="' + esc(store.drafts.vaultAmount) + '" aria-label="Vault amount">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="vault-deposit"' + (vaultCap <= 0 || store.busy ? ' disabled' : '') + '>' + esc(copy.depositVault) + '</button>' +
            '<button type="button" class="ztl-btn" data-ztl-act="vault-withdraw"' + (vaultBal <= 0 || store.busy ? ' disabled' : '') + '>' + esc(copy.withdrawVault) + '</button>' +
          '</div>' +
          staffHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route 6: `city` ONLY -> Airport (11 Foreign Markets) & History Museum (STRICTLY BELOW 3D City Map!) */
  function renderCityTravelSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var fl = getLiveFlightInfo();
    var fm = store.foreignMarket || {};

    var flightCardHtml = '';
    if (fl.status === 'traveling') {
      flightCardHtml =
        '<div class="ztl-card" data-ztl-inflight-card="1">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">✈ ' + esc(fl.origin) + ' → ' + esc(fl.destination) + '</span>' +
            '<bdi class="ztl-chip" data-tone="blue" data-ztl-cd="flight">' + fmtClock(fl.remSec) + '</bdi>' +
          '</div>' +
          '<div class="ztl-meter-track"><div class="ztl-meter-fill" data-tone="blue" data-ztl-flight-fill="1" style="width:' + fl.pct + '%"></div></div>' +
        '</div>';
    }

    var abroadHtml = '';
    if (fl.isAbroad) {
      var rawInventory = (fm.currentShop && Array.isArray(fm.currentShop.items))
        ? fm.currentShop.items
        : (Array.isArray(fm.inventory)
            ? fm.inventory
            : (Array.isArray(fm.items) ? fm.items : (Array.isArray(fm.stock) ? fm.stock : [])));
      var shopRows = '<div class="ztl-grid-compact">';
      for (var gi = 0; gi < rawInventory.length; gi++) {
        var gItem = rawInventory[gi];
        var itemId = gItem.itemId || gItem.id;
        var itemName = (gItem.name && (ar ? gItem.name.ar : gItem.name.en)) || (ar ? gItem.nameAr : gItem.nameEn) || gItem.nameEn || itemId;
        var stockQty = Math.max(0, Number(gItem.stock != null ? gItem.stock : gItem.qty || 0));
        var unitPrice = Math.max(0, Number(gItem.price || 0));
        var fQty = store.drafts.foreignQty[itemId] || '1';
        shopRows +=
          '<div class="ztl-card" data-ztl-foreign-item="' + esc(itemId) + '">' +
            '<div class="ztl-card-top">' +
              '<span class="ztl-card-title">' + esc(itemName) + '</span>' +
              '<bdi class="ztl-chip" data-tone="' + (stockQty > 0 ? 'sage' : 'crimson') + '">' + esc(copy.stockLeft) + ': ' + stockQty + '</bdi>' +
            '</div>' +
            render3dItemShowcase(itemId, 'contraband', itemName) +
            '<div class="ztl-card-meta"><bdi>' + fmtMoney(unitPrice) + '</bdi></div>' +
            '<div class="ztl-row-actions">' +
              '<input type="number" min="1" max="19" class="ztl-input ztl-stock-qty" data-ztl-draft="foreignQty" data-item="' + esc(itemId) + '" value="' + esc(fQty) + '" aria-label="Quantity">' +
              '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="foreign-buy" data-id="' + esc(itemId) + '"' + (stockQty <= 0 || fl.lugUsed >= fl.lugMax || store.busy ? ' disabled' : '') + '>' + esc(copy.buyMarketBtn) + '</button>' +
            '</div>' +
          '</div>';
      }
      shopRows += '</div>';

      var inZurich = Boolean((fm.rehabClinic && fm.rehabClinic.availableHere) || fm.activeHubId === 'zurich' || /zurich/i.test(fl.destination));
      var zurichBox = inZurich
        ? '<div class="ztl-card"><div class="ztl-card-title">' + esc(copy.zurichTitle) + (fm.rehabClinic && fm.rehabClinic.cost ? (' · ' + fmtMoney(fm.rehabClinic.cost)) : '') + '</div><button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="foreign-rehab"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.zurichBtn) + '</button></div>'
        : '';

      abroadHtml =
        '<section class="ztl-section-box" data-ztl-abroad-shop="1">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.foreignShopTitle) + ' · ' + esc(fl.destination) + '</h3>' +
            '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="foreign-return"' + (store.busy ? ' disabled' : '') + '>✈ ' + esc(copy.flyHomeBtn) + '</button>' +
          '</div>' +
          zurichBox +
          shopRows +
        '</section>';
    }

    var destHtml = '<div class="ztl-grid-cards">';
    for (var di = 0; di < DESTINATIONS_11.length; di++) {
      var d = DESTINATIONS_11[di];
      var effMins = fl.hasAirstrip ? Math.max(1, Math.round(d.mins * 0.7 * 10) / 10) : d.mins;
      var effFare = fl.hasAirstrip ? 0 : d.fare;
      var atThisCity = fl.isAbroad && fl.destination.toLowerCase() === d.id;
      destHtml +=
        '<article class="ztl-card" data-ztl-dest="' + d.id + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(ar ? d.ar : d.en) + '</span>' +
            '<span class="ztl-chip" data-tone="blue">' + esc(ar ? d.tagAr : d.tagEn) + '</span>' +
          '</div>' +
          '<div class="ztl-card-meta">✈ <bdi>' + effMins + 'm</bdi> · <bdi>' + (effFare === 0 ? esc(copy.freeAirstrip) : fmtMoney(effFare)) + '</bdi></div>' +
          '<div class="ztl-card-meta">' + esc(ar ? d.goodsAr : d.goodsEn) + '</div>' +
          '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="foreign-depart" data-dest="' + d.id + '"' + (fl.status === 'traveling' || !fl.isHome || atThisCity || store.busy ? ' disabled' : '') + '>' +
            '✈ ' + esc(copy.flyBtn) +
          '</button>' +
        '</article>';
    }
    destHtml += '</div>';

    var hasHist = Boolean(ctx.eduDone.hist);
    var plushCount = 0;
    var plushChips = '';
    for (var pi = 0; pi < PLUSHIE_SET.length; pi++) {
      var pl = PLUSHIE_SET[pi];
      var pQty = Math.max(0, Number(ctx.inv[pl.id] || 0) + Number(ctx.plushies[pl.id] || 0));
      if (pQty > 0) plushCount++;
      plushChips += '<span class="ztl-chip" data-tone="' + (pQty > 0 ? 'sage' : '') + '">' + esc(ar ? pl.ar : pl.en) + ' <bdi>(' + pQty + ')</bdi></span>';
    }

    var flowerCount = 0;
    var flowerChips = '';
    for (var fi = 0; fi < FLOWER_SET.length; fi++) {
      var flw = FLOWER_SET[fi];
      var fOwned = Math.max(0, Number(ctx.inv[flw.id] || 0));
      if (fOwned > 0) flowerCount++;
      flowerChips += '<span class="ztl-chip" data-tone="' + (fOwned > 0 ? 'sage' : '') + '">' + esc(ar ? flw.ar : flw.en) + ' <bdi>(' + fOwned + ')</bdi></span>';
    }

    var lugPct = Math.min(100, Math.round((fl.lugUsed / Math.max(1, fl.lugMax)) * 100));

    return (
      '<div class="ztl-workspace" data-workspace="city">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.airportTitle) + '</h3>' +
            '<span class="ztl-chip" data-tone="' + (fl.hasAirstrip ? 'sage' : 'gold') + '">' + esc(fl.hasAirstrip ? copy.airstripActive : copy.airstripNone) + '</span>' +
          '</div>' +
          '<div class="ztl-meter">' +
            '<div class="ztl-meter-row"><span>' + esc(copy.luggageLbl) + '</span><bdi>' + fl.lugUsed + ' / ' + fl.lugMax + '</bdi></div>' +
            '<div class="ztl-meter-track"><div class="ztl-meter-fill" data-tone="blue" style="width:' + lugPct + '%"></div></div>' +
          '</div>' +
          flightCardHtml +
          (!fl.isHome && fl.status !== 'traveling'
            ? '<div class="ztl-row-actions"><button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="foreign-return"' + (store.busy ? ' disabled' : '') + '>✈ ' + esc(copy.flyHomeBtn) + '</button></div>'
            : '') +
          destHtml +
        '</section>' +
        abroadHtml +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.museumTitle) + '</h3>' +
            '<span class="ztl-chip" data-tone="' + (hasHist ? 'sage' : 'crimson') + '">' + esc(hasHist ? copy.histUnlocked : copy.histRequired) + '</span>' +
          '</div>' +
          (!hasHist
            ? '<div class="ztl-row-actions"><button type="button" class="ztl-btn" data-ztl-act="enroll-hist">' + esc(copy.enrollHistBtn) + '</button></div>'
            : '') +
          '<div class="ztl-grid-cards">' +
            '<div class="ztl-card">' +
              '<div class="ztl-card-top"><span class="ztl-card-title">' + esc(copy.plushieSetTitle) + '</span><bdi class="ztl-chip" data-tone="gold">' + plushCount + ' / 6</bdi></div>' +
              render3dItemShowcase('plush_lion', 'contraband', copy.plushieSetTitle) +
              '<div class="ztl-row-actions">' + plushChips + '</div>' +
              '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="museum-exchange" data-id="plushies"' + (!hasHist || plushCount < 6 || store.busy ? ' disabled' : '') + '>' + esc(copy.exchangePlushBtn) + '</button>' +
            '</div>' +
            '<div class="ztl-card">' +
              '<div class="ztl-card-top"><span class="ztl-card-title">' + esc(copy.flowerSetTitle) + '</span><bdi class="ztl-chip" data-tone="gold">' + flowerCount + ' / 6</bdi></div>' +
              render3dItemShowcase('flower_orchid', 'contraband', copy.flowerSetTitle) +
              '<div class="ztl-row-actions">' + flowerChips + '</div>' +
              '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="museum-exchange" data-id="flowers"' + (!hasHist || flowerCount < 6 || store.busy ? ' disabled' : '') + '>' + esc(copy.exchangeFlowerBtn) + '</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 7: `hospital` ONLY -> Live Ward Player Revives (25E/75E), Blood Bags & Rehab */
  function renderHospitalWardSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var cds = getLiveCooldowns();
    var revCost = (ctx.eduDone.bio || ctx.eduDone.med) ? 25 : 75;
    var rehabCost = Math.max(10000, cds.addiction * 15000);
    var addPct = Math.min(100, cds.addiction * 5);

    var realPatients = store.hospitalPatients.filter(function (pt) { return pt && pt.npc === false; });
    var patientsHtml = '';
    if (realPatients.length === 0) {
      patientsHtml =
        '<div class="ztl-row-actions">' +
          '<span class="ztl-card-meta">' + esc(copy.hospWardEmpty) + '</span>' +
          '<button type="button" class="ztl-btn" data-ztl-act="open-drawer" data-mode="directory">' + esc(copy.openDirBtn) + '</button>' +
        '</div>';
    } else {
      patientsHtml = '<div class="ztl-grid-compact">';
      for (var hi = 0; hi < realPatients.length; hi++) {
        var hp = realPatients[hi];
        patientsHtml +=
          '<div class="ztl-card" data-ztl-ward-patient="' + esc(hp.id) + '">' +
            '<div class="ztl-card-title">' + renderInlineAvatar(hp.id) + esc(hp.username || hp.name || hp.id) + ' <bdi>Lv.' + (hp.level || hp.lvl || 1) + '</bdi></div>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="revive-player" data-id="' + esc(hp.id) + '"' + (store.busy ? ' disabled' : '') + '>' +
              esc(copy.reviveBtn) + ' <bdi>(' + revCost + 'E)</bdi>' +
            '</button>' +
          '</div>';
      }
      patientsHtml += '</div>';
    }

    var medHtml = '<div class="ztl-grid-cards">';
    for (var mi = 0; mi < HOSPITAL_MED_ITEMS.length; mi++) {
      var it = HOSPITAL_MED_ITEMS[mi];
      var owned = Math.max(0, Number(ctx.inv[it.id] || 0));
      var medBlocked = cds.medSec >= 21600;
      medHtml +=
        '<article class="ztl-card" data-ztl-hosp-item="' + it.id + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(ar ? it.ar : it.en) + '</span>' +
            '<bdi class="ztl-chip" data-tone="' + (owned > 0 ? 'sage' : 'gold') + '">' + esc(copy.ownedLbl) + ': ' + owned + '</bdi>' +
          '</div>' +
          render3dItemShowcase(it.id, 'medical', ar ? it.ar : it.en) +
          '<div class="ztl-card-meta">' + esc(ar ? it.effAr : it.effEn) + ' · ' + esc(ar ? it.cdAr : it.cdEn) + '</div>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="use-pharm" data-action="' + it.action + '" data-id="' + (it.actionArg || it.id) + '"' + ((owned <= 0 || medBlocked || store.busy) ? ' disabled' : '') + '>' + esc(copy.useBtn) + '</button>' +
            '<button type="button" class="ztl-btn" data-ztl-act="buy-item" data-id="' + it.id + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.buyMarketBtn) + ' <bdi>(' + fmtMoney(it.price) + ')</bdi></button>' +
            (it.id === 'bloodbag'
              ? '<button type="button" class="ztl-btn" data-ztl-act="blood-draw"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.drawBloodBtn) + '</button>'
              : '') +
          '</div>' +
        '</article>';
    }
    medHtml += '</div>';

    return (
      '<div class="ztl-workspace" data-workspace="hospital">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.hospWardTitle) + '</h3>' +
            '<span class="ztl-chip" data-tone="' + (cds.medSec > 0 ? 'gold' : 'sage') + '">' + esc(copy.medCd) + ': <bdi data-ztl-cd="med">' + (cds.medSec > 0 ? fmtClock(cds.medSec) : copy.ready) + '</bdi></span>' +
          '</div>' +
          patientsHtml +
        '</section>' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.hospMedTitle) + '</h3></div>' +
          medHtml +
        '</section>' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.addictionMeter) + '</h3></div>' +
          '<div class="ztl-meter">' +
            '<div class="ztl-meter-row"><span>' + esc(copy.addictWarn) + ': <bdi>' + cds.addiction + '%</bdi> · OD: <bdi>' + cds.odCount + '</bdi></span><bdi>' + fmtMoney(rehabCost) + '</bdi></div>' +
            '<div class="ztl-meter-track"><div class="ztl-meter-fill" data-tone="crimson" style="width:' + addPct + '%"></div></div>' +
          '</div>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="rehab"' + ((cds.addiction <= 0 && cds.odCount <= 0) || store.busy ? ' disabled' : '') + '>' +
              esc(copy.rehabBtn) + ' <bdi>(' + fmtMoney(rehabCost) + ')</bdi>' +
            '</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 8: `jail` ONLY -> Lawyer Business Card Release */
  function renderJailLegalSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var owned = Math.max(0, Number(ctx.inv[LAWYER_CARD_SPEC.id] || 0));

    return (
      '<div class="ztl-workspace" data-workspace="jail">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.jailLegalTitle) + '</h3>' +
            '<bdi class="ztl-chip" data-tone="' + (owned > 0 ? 'sage' : 'gold') + '">' + esc(copy.ownedLbl) + ': ' + owned + '</bdi>' +
          '</div>' +
          render3dItemShowcase(LAWYER_CARD_SPEC.id, 'enhancer', ar ? LAWYER_CARD_SPEC.ar : LAWYER_CARD_SPEC.en) +
          '<span class="ztl-section-note">' + esc(ar ? LAWYER_CARD_SPEC.effAr : LAWYER_CARD_SPEC.effEn) + '</span>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="use-pharm" data-action="torn.lawyerCard" data-id="release"' + (owned <= 0 || store.busy ? ' disabled' : '') + '>' +
              esc(copy.releaseNowBtn) +
            '</button>' +
            '<button type="button" class="ztl-btn" data-ztl-act="buy-item" data-id="lawyer_card"' + (store.busy ? ' disabled' : '') + '>' +
              esc(copy.buyMarketBtn) + ' <bdi>(' + fmtMoney(LAWYER_CARD_SPEC.price) + ')</bdi>' +
            '</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route 9: `faction` ONLY -> Shared 5-Minute Faction Chain, Faction Armory & Territory Wall */
  function renderFactionChainSection() {
    var ar = isAr();
    var copy = L();
    var ctx = getPlayerAndState();
    var ch = getLiveChainInfo();
    var fc = store.factionChain || {};
    var armoryStock = (fc.armory && fc.armory.stock) || { smallkit: 4, medkit: 2, xanax: 1, bloodbag: 2 };
    var wall = fc.wall || { territoryId: 'ZC-046', attackerScore: 240, defenderScore: 200, targetScore: 1000 };

    var pipsHtml = '<div class="ztl-chain-milestones">';
    var foundNext = false;
    for (var i = 0; i < CHAIN_MILESTONES.length; i++) {
      var ms = CHAIN_MILESTONES[i];
      var cls = 'ztl-milestone-pip';
      if (ch.count >= ms) cls += ' is-reached';
      else if (!foundNext) { cls += ' is-next'; foundNext = true; }
      pipsHtml += '<div class="' + cls + '"><bdi>' + ms + '</bdi></div>';
    }
    pipsHtml += '</div>';

    var chainPct = Math.min(100, Math.round((ch.count / Math.max(1, ch.nextMilestone)) * 100));

    var armoryDefs = [
      { id: 'smallkit', en: 'First Aid Kit', ar: 'حقيبة إسعاف أولي' },
      { id: 'medkit', en: 'Field Medkit', ar: 'حقيبة طبية ميدانية' },
      { id: 'xanax', en: 'Xanax (250E)', ar: 'زاناكس (+250 طاقة)' },
      { id: 'bloodbag', en: 'Blood Bag', ar: 'كيس دم طبي' }
    ];
    var armoryHtml = '<div class="ztl-grid-compact">';
    for (var ai = 0; ai < armoryDefs.length; ai++) {
      var ad = armoryDefs[ai];
      var fStock = Math.max(0, Number(armoryStock[ad.id] || 0));
      var pOwned = Math.max(0, Number(ctx.inv[ad.id] || 0));
      armoryHtml +=
        '<div class="ztl-card">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title">' + esc(ar ? ad.ar : ad.en) + '</span>' +
            '<bdi class="ztl-chip" data-tone="blue">Armory: ' + fStock + '</bdi>' +
          '</div>' +
          render3dItemShowcase(ad.id, inferZtlItemCategory(ad.id, 'medical'), ar ? ad.ar : ad.en) +
          '<span class="ztl-card-meta">' + esc(copy.ownedLbl) + ': <bdi>' + pOwned + '</bdi></span>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-ztl-act="armory-deposit" data-id="' + ad.id + '"' + (pOwned < 1 || store.busy ? ' disabled' : '') + '>' + esc(copy.depositArmory) + '</button>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="armory-use" data-id="' + ad.id + '"' + (fStock < 1 || store.busy ? ' disabled' : '') + '>' + esc(copy.useArmory) + '</button>' +
          '</div>' +
        '</div>';
    }
    armoryHtml += '</div>';

    var att = Math.max(0, Number(wall.attackerScore || 0));
    var def = Math.max(0, Number(wall.defenderScore || 0));
    var totalWall = Math.max(1, att + def);
    var attPct = Math.round((att / totalWall) * 100);

    return (
      '<div class="ztl-workspace" data-workspace="faction">' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.chainTitle) + (ch.factionName ? (' · ' + esc(ch.factionName)) : '') + '</h3>' +
            '<div class="ztl-row-actions">' +
              '<bdi class="ztl-chip" data-tone="gold">×' + ch.multiplier + ' Respect</bdi>' +
              '<bdi class="ztl-chip" data-tone="' + (ch.remSec > 0 ? 'crimson' : 'sage') + '" data-ztl-cd="chain">' + fmtClock(ch.remSec) + '</bdi>' +
            '</div>' +
          '</div>' +
          '<div class="ztl-meter">' +
            '<div class="ztl-meter-row"><span>Chain <bdi>' + ch.count + ' / ' + ch.nextMilestone + '</bdi></span><span>Best: <bdi>' + ch.best + '</bdi></span></div>' +
            '<div class="ztl-meter-track"><div class="ztl-meter-fill" data-tone="gold" style="width:' + chainPct + '%"></div></div>' +
          '</div>' +
          pipsHtml +
        '</section>' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.armoryTitle) + '</h3></div>' +
          armoryHtml +
        '</section>' +
        '<section class="ztl-section-box">' +
          '<div class="ztl-section-head">' +
            '<h3 class="ztl-section-title">' + esc(copy.wallTitle) + ' · <bdi>' + esc(wall.territoryId || 'ZC-046') + '</bdi></h3>' +
            '<bdi class="ztl-chip" data-tone="gold">' + fmtInt(att) + ' vs ' + fmtInt(def) + ' (Target ' + fmtInt(wall.targetScore || 1000) + ')</bdi>' +
          '</div>' +
          '<div class="ztl-wall-bar"><div class="ztl-wall-def-fill" style="width:' + attPct + '%"></div></div>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="wall-join"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.joinWallBtn) + '</button>' +
            '<button type="button" class="ztl-btn" data-variant="danger" data-ztl-act="wall-assault"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.assaultWallBtn) + '</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Slide-Over Drawer Content: Player Directory, Profiles & Chronological Events */
  function renderDirectoryAndEventsHtml(compactMode) {
    var copy = L();
    var ctx = getPlayerAndState();
    var revCost = (ctx.eduDone.bio || ctx.eduDone.med) ? 25 : 75;

    var dirList = store.directory;
    var dirRowsHtml = '<div class="ztl-dir-list">';
    if (dirList.length === 0) {
      dirRowsHtml += '<div class="ztl-card-meta">' + esc(copy.loadOperativesHint) + '</div>';
    } else {
      for (var i = 0; i < dirList.length; i++) {
        var p = dirList[i];
        var st = String(p.status || 'Okay');
        if (store.drafts.statusFilter !== 'all' && st.toLowerCase() !== store.drafts.statusFilter) continue;
        var stTone = /hosp/i.test(st) ? 'crimson' : (/jail/i.test(st) ? 'gold' : (/travel/i.test(st) ? 'blue' : 'sage'));
        var isSel = store.selectedProfile && String(store.selectedProfile.id) === String(p.id);
        dirRowsHtml +=
          '<button type="button" class="ztl-dir-item' + (isSel ? ' is-selected' : '') + '" data-ztl-act="select-profile" data-id="' + esc(p.id) + '">' +
            '<span class="ztl-player-inline">' + renderInlineAvatar(p.id) + '<strong>' + esc(p.username || p.name || p.id) + '</strong> <bdi>Lv.' + (p.level || 1) + '</bdi></span>' +
            '<span class="ztl-chip" data-tone="' + stTone + '">' + esc(st) + '</span>' +
          '</button>';
      }
    }
    dirRowsHtml += '</div>';

    var prof = store.selectedProfile;
    var profHtml = '';
    if (prof) {
      var pStatus = String(prof.status || 'Okay');
      var inHosp = /hosp/i.test(pStatus);
      var pTone = inHosp ? 'crimson' : (/jail/i.test(pStatus) ? 'gold' : (/travel/i.test(pStatus) ? 'blue' : 'sage'));
      var attacks = Array.isArray(prof.recentAttacks) ? prof.recentAttacks : [];
      var attHtml = '';
      for (var ai = 0; ai < Math.min(4, attacks.length); ai++) {
        var a = attacks[ai];
        var attName = (a.stealthed && isAr() && a.attackerName === 'Someone')
          ? 'مجهول'
          : (a.attackerName || a.attacker || 'Operative');
        var defName = a.defenderName || a.defender || prof.username || prof.id;
        var outStr = [a.approach, a.result || a.outcome].filter(Boolean).join(' · ') || 'Hit';
        attHtml += '<div class="ztl-card-meta">• ' + esc(a.summary || a.headline || (attName + ' → ' + defName + ' (' + outStr + ')')) + '</div>';
      }

      profHtml =
        '<div class="ztl-card" data-ztl-profile-card="' + esc(prof.id) + '">' +
          '<div class="ztl-card-top">' +
            '<span class="ztl-card-title ztl-player-inline">' + renderInlineAvatar(prof.id) + esc(prof.username || prof.name || prof.id) + ' <bdi>[#' + esc(prof.numericId || prof.id) + ']</bdi></span>' +
            '<span class="ztl-chip" data-tone="' + pTone + '">' + esc(pStatus) + '</span>' +
          '</div>' +
          '<div class="ztl-profile-kv">' +
            '<div class="ztl-kv-cell"><span>' + esc(copy.kvLevelCity) + '</span><strong><bdi>Lv.' + (prof.level || 1) + '</bdi> · ' + esc(prof.city || 'Zone City') + '</strong></div>' +
            '<div class="ztl-kv-cell"><span>' + esc(copy.kvNetworth) + '</span><strong><bdi>' + (prof.netWorth != null ? fmtMoney(prof.netWorth) : esc(prof.cashTier || '$50k+')) + '</bdi></strong></div>' +
            '<div class="ztl-kv-cell"><span>' + esc(copy.kvFaction) + '</span><strong>' + esc((prof.faction && (prof.faction.name || prof.faction)) || 'Independent') + '</strong></div>' +
            '<div class="ztl-kv-cell"><span>' + esc(copy.kvAwardsWins) + '</span><strong><bdi>' + Number(prof.honorsCount || 0) + 'H · ' + Number(prof.medalsCount || 0) + 'M · ' + Number((prof.combatStats && prof.combatStats.wins) || prof.wins || 0) + 'W</bdi></strong></div>' +
          '</div>' +
          '<div class="ztl-row-actions">' +
            '<button type="button" class="ztl-btn" data-variant="danger" data-ztl-act="attack-player">' + esc(copy.attackBtn) + '</button>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="revive-player" data-id="' + esc(prof.id) + '"' + (!inHosp || store.busy ? ' disabled' : '') + '>' + esc(copy.reviveBtn) + ' <bdi>(' + revCost + 'E)</bdi></button>' +
          '</div>' +
          '<div class="ztl-row-actions">' +
            '<input type="number" min="1000" step="5000" class="ztl-input ztl-stock-qty" data-ztl-draft="bountyAmount" value="' + esc(store.drafts.bountyAmount) + '" aria-label="Bounty cash">' +
            '<button type="button" class="ztl-btn" data-variant="gold" data-ztl-act="place-bounty" data-target="' + esc(prof.username || prof.id) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.bountyBtn) + '</button>' +
            '<input type="number" min="100" step="1000" class="ztl-input ztl-stock-qty" data-ztl-draft="sendCashAmount" value="' + esc(store.drafts.sendCashAmount) + '" aria-label="Send cash">' +
            '<button type="button" class="ztl-btn" data-ztl-act="send-cash" data-id="' + esc(prof.id) + '" data-name="' + esc(prof.username || '') + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.sendCashBtn) + '</button>' +
          '</div>' +
          '<div class="ztl-row-actions">' +
            '<input type="text" class="ztl-input" style="flex:1" data-ztl-draft="mailBody" value="' + esc(store.drafts.mailBody) + '" placeholder="' + esc(copy.mailPlaceholder + (prof.username || 'player')) + '..." aria-label="Mail message">' +
            '<button type="button" class="ztl-btn" data-ztl-act="send-mail" data-target="' + esc(prof.username || prof.id) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.sendMailBtn) + '</button>' +
          '</div>' +
          (attHtml ? ('<div><strong>' + esc(copy.recentAttacksTitle) + '</strong>' + attHtml + '</div>') : '') +
        '</div>';
    }

    var realPatients = store.hospitalPatients.filter(function (pt) { return pt && pt.npc === false; });
    var hospStrip = '';
    if (realPatients.length > 0) {
      hospStrip = '<div class="ztl-section-box"><div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.hospPlayersTitle) + '</h3></div><div class="ztl-grid-compact">';
      for (var hi = 0; hi < realPatients.length; hi++) {
        var hp = realPatients[hi];
        hospStrip +=
          '<div class="ztl-card">' +
            '<div class="ztl-card-title ztl-player-inline">' + renderInlineAvatar(hp.id) + esc(hp.username || hp.name || hp.id) + ' <bdi>Lv.' + (hp.level || hp.lvl || 1) + '</bdi></div>' +
            '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="revive-player" data-id="' + esc(hp.id) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.reviveBtn) + ' <bdi>(' + revCost + 'E)</bdi></button>' +
          '</div>';
      }
      hospStrip += '</div></div>';
    }

    var evHtml = '<div class="ztl-events-list">';
    if (store.eventsFeed.length === 0) {
      evHtml += '<div class="ztl-card-meta">' + esc(copy.noEvents) + '</div>';
    } else {
      for (var ei = 0; ei < store.eventsFeed.length; ei++) {
        var ev = store.eventsFeed[ei];
        var evTitle = (isAr()
          ? (ev.messageAr || ev.message || ev.messageEn)
          : (ev.messageEn || ev.message || ev.messageAr)
        ) || ev.headline || ev.text || ev.summary || ev.type || 'Syndicate Event';
        var evTime = ev.timeLabel || ev.occurredAt || ev.createdAt || ev.time || '';
        var evCat = String(ev.type || ev.category || 'event').replace(/_/g, ' ');
        evHtml +=
          '<div class="ztl-event-item">' +
            '<div><span class="ztl-chip" data-tone="gold">' + esc(evCat) + '</span> ' + esc(evTitle) + '</div>' +
            '<bdi class="ztl-card-meta">' + esc(String(evTime).slice(0, 19)) + '</bdi>' +
          '</div>';
      }
    }
    evHtml += '</div>';

    return (
      '<div class="ztl-workspace" data-workspace="directory">' +
        hospStrip +
        '<div class="' + (compactMode ? 'ztl-workspace' : 'ztl-split-2') + '">' +
          '<section class="ztl-section-box">' +
            '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.dirTitle) + '</h3></div>' +
            '<div class="ztl-row-actions">' +
              '<input type="search" class="ztl-input" style="flex:1" data-ztl-draft="playerQuery" value="' + esc(store.drafts.playerQuery) + '" placeholder="' + esc(copy.searchPlaceholder) + '" aria-label="Search player">' +
              '<button type="button" class="ztl-btn" data-variant="primary" data-ztl-act="search-players">' + esc(copy.searchGo) + '</button>' +
            '</div>' +
            dirRowsHtml +
            profHtml +
          '</section>' +
          '<section class="ztl-section-box">' +
            '<div class="ztl-section-head"><h3 class="ztl-section-title">' + esc(copy.eventsTitle) + '</h3></div>' +
            evHtml +
          '</section>' +
        '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------------
   * 8. DOM MOUNTS: WHISPER-CLEAN HUD STRIP, ROUTE SECTION, TOAST & DRAWER
   * ------------------------------------------------------------------------ */
  function ensureHudStrip() {
    if (document.querySelector('x-dc')) return null;
    var topbar = document.querySelector('.zone-topbar');
    if (!topbar) return null;

    var strip = document.getElementById('zone-torn-hud-strip');
    if (strip && strip.parentElement !== topbar) {
      if (strip.parentElement) strip.parentElement.removeChild(strip);
      strip = null;
    }
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'zone-torn-hud-strip';
      strip.className = 'ztl-scope';
      strip.setAttribute('role', 'region');
      strip.setAttribute('aria-label', 'Live Torn Status Strip');
      strip.addEventListener('click', handleActionClick);

      var inner = document.createElement('div');
      inner.id = 'ztl-hud-inner';
      inner.className = 'ztl-hud-inner';

      /* Persistent slot for zone-rpg-empire.js (Story & Rank pills) — NEVER overwritten */
      var storySlot = document.createElement('span');
      storySlot.id = 'ztl-hud-story-slot';
      storySlot.className = 'ztl-hud-story-slot';

      var statusGroup = document.createElement('div');
      statusGroup.id = 'ztl-hud-status-group';
      statusGroup.className = 'ztl-hud-status-group';

      var rightGroup = document.createElement('div');
      rightGroup.id = 'ztl-hud-right-group';
      rightGroup.className = 'ztl-hud-spacer';

      inner.appendChild(storySlot);
      inner.appendChild(statusGroup);
      inner.appendChild(rightGroup);
      strip.appendChild(inner);
      topbar.appendChild(strip);
    }
    return strip;
  }

  function renderHudStrip() {
    var strip = ensureHudStrip();
    if (!strip) return;
    var statusGroup = document.getElementById('ztl-hud-status-group');
    var rightGroup = document.getElementById('ztl-hud-right-group');
    if (!statusGroup || !rightGroup) return;

    var copy = L();
    var cds = getLiveCooldowns();
    var ch = getLiveChainInfo();
    var fl = getLiveFlightInfo();

    var addHtml = (cds.addiction > 0 || cds.odCount > 0)
      ? '<button type="button" class="ztl-hud-pill" data-tone="danger" data-ztl-act="go-screen" data-screen="hospital">' +
          '⚠ <span class="ztl-pill-lbl">' + esc(copy.addictWarn) + '</span> <bdi>' + cds.addiction + '%</bdi>' +
        '</button>'
      : '';

    var chainTimerPart = ch.remSec > 0
      ? (' · <span data-ztl-cd="chain">' + fmtClock(ch.remSec) + '</span>')
      : '';

    /* Flight pill ONLY shown when travel.status === 'traveling' */
    var flightPillHtml = fl.status === 'traveling'
      ? '<button type="button" id="ztl-hud-flight-pill" class="ztl-hud-pill" data-tone="blue" data-ztl-act="go-screen" data-screen="city">' +
          '✈ <bdi>' + esc(fl.destination) + ' <span data-ztl-cd="flight">' + fmtClock(fl.remSec) + '</span></bdi>' +
        '</button>'
      : '';

    statusGroup.innerHTML =
      '<button type="button" class="ztl-hud-pill" data-tone="' + (cds.drugSec > 0 ? 'danger' : 'ready') + '" data-ztl-act="go-screen" data-screen="items">' +
        '<span class="ztl-pill-lbl">' + esc(copy.drugCd) + '</span> <bdi data-ztl-cd="drug">' + (cds.drugSec > 0 ? fmtClock(cds.drugSec) : copy.ready) + '</bdi>' +
      '</button>' +
      '<button type="button" class="ztl-hud-pill" data-tone="' + (cds.medSec > 0 ? 'warn' : 'ready') + '" data-ztl-act="go-screen" data-screen="items">' +
        '<span class="ztl-pill-lbl">' + esc(copy.medCd) + '</span> <bdi data-ztl-cd="med">' + (cds.medSec > 0 ? fmtClock(cds.medSec) : copy.ready) + '</bdi>' +
      '</button>' +
      '<button type="button" class="ztl-hud-pill" data-tone="' + (cds.boostSec > 0 ? 'blue' : 'ready') + '" data-ztl-act="go-screen" data-screen="items">' +
        '<span class="ztl-pill-lbl">' + esc(copy.boostCd) + '</span> <bdi data-ztl-cd="boost">' + (cds.boostSec > 0 ? fmtClock(cds.boostSec) : copy.ready) + '</bdi>' +
      '</button>' +
      addHtml +
      '<button type="button" id="ztl-hud-chain-pill" class="ztl-hud-pill" data-tone="' + (ch.count > 0 ? 'warn' : 'ready') + '" data-ztl-act="go-screen" data-screen="faction">' +
        '⛓ <span>' + esc(copy.chainLbl) + '</span> <bdi>' + ch.count + '/' + ch.nextMilestone + chainTimerPart + '</bdi>' +
      '</button>' +
      flightPillHtml;

    rightGroup.innerHTML =
      '<button type="button" id="ztl-hud-search-btn" class="ztl-hud-pill" data-ztl-act="open-drawer" data-mode="directory">' +
        '<span>' + esc(copy.playersBtn) + '</span>' +
      '</button>' +
      '<button type="button" id="ztl-hud-events-btn" class="ztl-hud-pill" data-ztl-act="open-drawer" data-mode="events">' +
        '<span>' + esc(copy.eventsBtn) + '</span>' +
        '<bdi class="ztl-bell-badge"' + (store.unreadCount > 0 ? '' : ' hidden') + '>' + store.unreadCount + '</bdi>' +
      '</button>';
  }

  function removeRouteSection() {
    var existing = document.getElementById('zone-torn-route-section');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
    var legacy = document.getElementById('zone-torn-ops-deck');
    if (legacy && legacy.parentElement) {
      legacy.parentElement.removeChild(legacy);
    }
  }

  function ensureRouteSection(main, screen) {
    var sec = document.getElementById('zone-torn-route-section');
    if (sec && sec.parentElement !== main) {
      if (sec.parentElement) sec.parentElement.removeChild(sec);
      sec = null;
    }
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'zone-torn-route-section';
      sec.className = 'ztl-scope ztl-route-section';
      sec.addEventListener('click', handleActionClick);
      sec.addEventListener('input', handleDraftInput);
      sec.addEventListener('change', handleDraftInput);
      main.appendChild(sec);
    } else if (main.children && main.children.length > 0 && main.children[main.children.length - 1] !== sec) {
      /* Always keep #zone-torn-route-section AFTER newly mounted native screen nodes */
      main.appendChild(sec);
    }
    sec.setAttribute('data-ztl-route', screen);
    return sec;
  }

  function renderRouteSection() {
    if (document.querySelector('x-dc')) return;
    var main = document.getElementById('zone-main');
    if (!main) return;

    var screen = getActiveScreen();
    if (screen && screen !== store.lastScreen) {
      store.lastScreen = screen;
      if (screen === 'hospital') loadHospitalPatients();
      else if (screen === 'city') loadForeignMarketState();
      else if (screen === 'faction') loadFactionChainState();
    }

    if (!ROUTE_SECTIONS[screen]) {
      removeRouteSection();
      return;
    }

    var sec = ensureRouteSection(main, screen);
    if (!sec) return;

    /* Preserve focused input/select inside route section across background ticks */
    var activeEl = document.activeElement;
    if (activeEl && sec.contains(activeEl) && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') && !store.busy) {
      return;
    }

    var bodyHtml = '';
    if (screen === 'crimes') bodyHtml = renderCrimesSection();
    else if (screen === 'items') bodyHtml = renderItemsPharmacySection();
    else if (screen === 'bank') bodyHtml = renderBankEconomySection();
    else if (screen === 'market') bodyHtml = renderMarketPointsSection();
    else if (screen === 'properties') bodyHtml = renderPropertiesVaultSection();
    else if (screen === 'city') bodyHtml = renderCityTravelSection();
    else if (screen === 'hospital') bodyHtml = renderHospitalWardSection();
    else if (screen === 'jail') bodyHtml = renderJailLegalSection();
    else if (screen === 'faction') bodyHtml = renderFactionChainSection();

    var prevStage = sec.querySelector ? sec.querySelector('.z3d-action-stage') : null;
    var prevStageKind = prevStage && prevStage.getAttribute ? prevStage.getAttribute('data-z3d-stage') : '';
    var keepLiveStage = Boolean(prevStage && prevStage.querySelector && prevStage.querySelector('canvas'));

    sec.innerHTML = renderFeedbackHtml() + bodyHtml;

    if (keepLiveStage && sec.querySelector) {
      var nextStage = sec.querySelector('.z3d-action-stage');
      if (nextStage && nextStage.getAttribute('data-z3d-stage') === prevStageKind && typeof nextStage.replaceWith === 'function') {
        nextStage.replaceWith(prevStage);
      }
    }
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
      try { window.ZoneEcs3D.scan(sec); } catch (_) {}
    }
  }

  var attackCombatBound = null;
  function syncAttackArenaStage() {
    if (document.querySelector('x-dc')) return;
    var main = document.getElementById('zone-main');
    if (!main) return;
    var screen = getActiveScreen();
    var existing = document.getElementById('ztl-attack-3d-stage');

    if (screen !== 'attack') {
      if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
      }
      return;
    }

    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'ztl-attack-3d-stage';
      existing.className = 'ztl-scope z3d-action-stage ztl-3d-stage ztl-attack-3d-stage';
      existing.setAttribute('data-z3d-stage', 'combat-arena');
      var anchor = document.getElementById('zig-brawl-hud') || document.getElementById('zone-combat-frame');
      if (anchor && anchor.parentElement === main && typeof main.insertBefore === 'function') {
        main.insertBefore(existing, anchor);
      } else if (main.children && main.children.length > 1 && typeof main.insertBefore === 'function') {
        main.insertBefore(existing, main.children[1]);
      } else {
        main.appendChild(existing);
      }
    }

    if (main !== attackCombatBound && typeof main.addEventListener === 'function') {
      attackCombatBound = main;
      main.addEventListener('click', function (ev) {
        if (getActiveScreen() !== 'attack') return;
        var btn = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('button') : null;
        if (!btn || btn.disabled) return;
        var txt = String(btn.textContent || '').toLowerCase();
        var act = btn.getAttribute('data-combat-act') || btn.getAttribute('data-zig-brawl') || '';
        if (act || /attack|hit|strike|mug|hosp|leave|بادر|اضرب|هاجم|سرقة|مستشفى/.test(txt)) {
          if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
            try { window.ZoneEcs3D.triggerStageAction('combat-arena', 'attack', { trigger: act || 'hit' }); } catch (_) {}
          }
        }
      });
    }

    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
      try { window.ZoneEcs3D.scan(existing); } catch (_) {}
    }
  }

  function renderFloatingToast() {
    if (!document.body || document.querySelector('x-dc')) return;
    var screen = getActiveScreen();
    var hasInlineFeedback = Boolean(ROUTE_SECTIONS[screen] || store.drawerOpen);
    var toast = document.getElementById('zone-torn-toast');

    if (!store.feedback || hasInlineFeedback) {
      if (toast) toast.hidden = true;
      return;
    }

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'zone-torn-toast';
      toast.className = 'ztl-scope';
      toast.addEventListener('click', handleActionClick);
      document.body.appendChild(toast);
    }
    toast.hidden = false;
    toast.innerHTML = renderFeedbackHtml();
  }

  function ensureDrawer() {
    if (!document.body || document.querySelector('x-dc')) return null;
    var backdrop = document.getElementById('zone-torn-drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'zone-torn-drawer-backdrop';
      backdrop.hidden = true;
      backdrop.addEventListener('click', closeDrawer);
      document.body.appendChild(backdrop);
    }

    var drawer = document.getElementById('zone-torn-drawer');
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'zone-torn-drawer';
      drawer.className = 'ztl-scope';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Events Feed & Player Directory');
      drawer.hidden = true;
      drawer.addEventListener('click', handleActionClick);
      drawer.addEventListener('input', handleDraftInput);
      drawer.addEventListener('change', handleDraftInput);
      document.body.appendChild(drawer);
    }
    return { backdrop: backdrop, drawer: drawer };
  }

  function renderDrawer() {
    var nodes = ensureDrawer();
    if (!nodes) return;
    if (!store.drawerOpen) {
      nodes.backdrop.hidden = true;
      nodes.drawer.hidden = true;
      return;
    }
    nodes.backdrop.hidden = false;
    nodes.drawer.hidden = false;

    var activeEl = document.activeElement;
    if (activeEl && nodes.drawer.contains(activeEl) && activeEl.tagName === 'INPUT' && !store.busy) {
      return;
    }

    var copy = L();
    nodes.drawer.innerHTML =
      '<header class="ztl-drawer-head">' +
        '<h2 class="ztl-drawer-title">' + esc(copy.drawerTitleEvents) + '</h2>' +
        '<button type="button" class="ztl-btn" data-ztl-act="close-drawer">' + esc(copy.closeLbl) + ' ✕</button>' +
      '</header>' +
      '<div class="ztl-drawer-body">' +
        renderFeedbackHtml() +
        renderDirectoryAndEventsHtml(true) +
      '</div>';
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
      try { window.ZoneEcs3D.scan(nodes.drawer); } catch (_) {}
    }
  }

  /* ------------------------------------------------------------------------
   * 9. EVENT DELEGATION, LIVE 1S TICKER & LIFECYCLE
   * ------------------------------------------------------------------------ */
  function handleDraftInput(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var key = el.getAttribute('data-ztl-draft');
    if (!key) return;
    if (key === 'stockQty') {
      var ticker = el.getAttribute('data-ticker');
      if (ticker) store.drafts.stockQty[ticker] = el.value;
    } else if (key === 'foreignQty') {
      var item = el.getAttribute('data-item');
      if (item) store.drafts.foreignQty[item] = el.value;
    } else {
      store.drafts[key] = el.value;
    }
  }

  function openLegacyTabOrRoute(tabOrRoute) {
    var key = String(tabOrRoute || 'crimes').toLowerCase();
    if (key === 'directory' || key === 'events') {
      openDrawer(key === 'events' ? 'events' : 'directory');
      return;
    }
    var mappedRoute = LEGACY_TAB_TO_ROUTE[key] || key;
    navigateToScreen(mappedRoute);
  }

  function openDrawer(mode) {
    store.drawerOpen = true;
    store.drawerMode = mode || 'both';
    markEventsRead();
    loadEventsFeedState();
    loadPlayerDirectory();
    loadHospitalPatients();
    renderAll();
  }

  function closeDrawer() {
    if (!store.drawerOpen) return;
    store.drawerOpen = false;
    renderAll();
  }

  function handleActionClick(ev) {
    var inspectBtn = ev.target && typeof ev.target.closest === 'function'
      ? ev.target.closest('[data-z3d-inspect]')
      : null;
    if (inspectBtn) {
      ev.preventDefault();
      var inspId = inspectBtn.getAttribute('data-z3d-inspect');
      var inspCat = inspectBtn.getAttribute('data-z3d-cat') || '';
      var inspTitle = inspectBtn.getAttribute('data-z3d-title') || inspId;
      if (window.ZoneEcs3D && typeof window.ZoneEcs3D.inspectItem === 'function') {
        try { window.ZoneEcs3D.inspectItem(inspId, { category: inspCat, title: inspTitle }); } catch (_) {}
      }
      return;
    }

    var target = ev.target && typeof ev.target.closest === 'function'
      ? ev.target.closest('[data-ztl-act]')
      : null;
    if (!target || target.disabled) return;
    ev.preventDefault();

    var act = target.getAttribute('data-ztl-act');
    if (act === 'inspect-3d') {
      var iId = target.getAttribute('data-z3d-inspect') || target.getAttribute('data-id');
      var iTitle = target.getAttribute('data-z3d-title') || iId;
      if (window.ZoneEcs3D && typeof window.ZoneEcs3D.inspectItem === 'function') {
        try { window.ZoneEcs3D.inspectItem(iId, { title: iTitle }); } catch (_) {}
      }
      return;
    }
    if (act === 'go-screen') {
      navigateToScreen(target.getAttribute('data-screen') || 'home');
    } else if (act === 'open-tab' || act === 'switch-tab') {
      openLegacyTabOrRoute(target.getAttribute('data-tab') || 'crimes');
    } else if (act === 'clear-feedback') {
      dismissFeedback();
    } else if (act === 'open-drawer') {
      openDrawer(target.getAttribute('data-mode') || 'both');
    } else if (act === 'close-drawer') {
      closeDrawer();
    } else if (act === 'crime2') {
      execGameplayAction('torn.crime2Execute', target.getAttribute('data-id'));
    } else if (act === 'shoplift') {
      execGameplayAction('torn.shoplift', target.getAttribute('data-id'));
    } else if (act === 'search-cash') {
      execGameplayAction('torn.searchCash', target.getAttribute('data-id'));
    } else if (act === 'buy-item') {
      execGameplayAction('item.buy', target.getAttribute('data-id'));
    } else if (act === 'use-pharm') {
      execGameplayAction(target.getAttribute('data-action') || 'item.use', target.getAttribute('data-id'));
    } else if (act === 'blood-draw') {
      execGameplayAction('torn.bloodBag', 'draw');
    } else if (act === 'rehab') {
      execGameplayAction('torn.rehab', 'clinic');
    } else if (act === 'happy-jump') {
      execGameplayAction('torn.happyJump', 'stack');
    } else if (act === 'points-energy') {
      execGameplayAction('points.refillEnergy', 'energy');
    } else if (act === 'points-nerve') {
      execGameplayAction('points.refillNerve', 'nerve');
    } else if (act === 'stock-buy') {
      var bTicker = target.getAttribute('data-ticker');
      var bQty = Math.max(1, Math.round(Number(store.drafts.stockQty[bTicker] || 100)));
      execGameplayAction('stock.buy', bTicker + ':' + bQty);
    } else if (act === 'stock-sell') {
      var sTicker = target.getAttribute('data-ticker');
      var sQty = Math.max(1, Math.round(Number(store.drafts.stockQty[sTicker] || 100)));
      execGameplayAction('stock.sell', sTicker + ':' + sQty);
    } else if (act === 'stock-div') {
      execGameplayAction('torn.stockDividend', target.getAttribute('data-ticker'));
    } else if (act === 'bank-lock-cd') {
      var term = store.drafts.cdTerm || '7d';
      var princ = Math.max(5000, Math.round(Number(store.drafts.cdPrincipal || 50000)));
      execGameplayAction('torn.bankCd', term + ':' + princ);
    } else if (act === 'bank-claim-cd') {
      execGameplayAction('bank.claimCd', 'claim');
    } else if (act === 'vault-deposit') {
      execGameplayAction('property.vaultDeposit', String(Math.max(100, Math.round(Number(store.drafts.vaultAmount || 25000)))));
    } else if (act === 'vault-withdraw') {
      execGameplayAction('property.vaultWithdraw', String(Math.max(100, Math.round(Number(store.drafts.vaultAmount || 25000)))));
    } else if (act === 'hire-staff') {
      execGameplayAction('torn.islandStaff', target.getAttribute('data-id'));
    } else if (act === 'foreign-depart') {
      execForeignAction({ action: 'depart', destination: target.getAttribute('data-dest') });
    } else if (act === 'foreign-return') {
      execForeignAction({ action: 'return' });
    } else if (act === 'foreign-buy') {
      var fItem = target.getAttribute('data-id');
      var fq = Math.max(1, Math.round(Number(store.drafts.foreignQty[fItem] || 1)));
      execForeignAction({ action: 'buy', itemId: fItem, quantity: fq });
    } else if (act === 'foreign-rehab') {
      execForeignAction({ action: 'rehab' });
    } else if (act === 'museum-exchange') {
      execGameplayAction('museum.exchange', target.getAttribute('data-id'));
    } else if (act === 'enroll-hist') {
      execGameplayAction('course.enroll', 'hist');
    } else if (act === 'armory-deposit') {
      execFactionAction({ action: 'armory.deposit', itemId: target.getAttribute('data-id'), quantity: 1 });
    } else if (act === 'armory-use') {
      execFactionAction({ action: 'armory.use', itemId: target.getAttribute('data-id'), quantity: 1 });
    } else if (act === 'wall-join') {
      execFactionAction({ action: 'wall.join' });
    } else if (act === 'wall-assault') {
      execFactionAction({ action: 'wall.assault' });
    } else if (act === 'search-players') {
      loadPlayerDirectory(store.drafts.playerQuery).then(renderAll);
    } else if (act === 'select-profile') {
      loadPlayerDirectory(null, target.getAttribute('data-id')).then(renderAll);
    } else if (act === 'revive-player') {
      execRevivePlayer(target.getAttribute('data-id'));
    } else if (act === 'place-bounty') {
      execPlaceBounty(target.getAttribute('data-target'));
    } else if (act === 'send-cash') {
      execSendCash(target.getAttribute('data-id'), target.getAttribute('data-name'));
    } else if (act === 'send-mail') {
      execSendMail(target.getAttribute('data-target'));
    } else if (act === 'attack-player') {
      execAttackPlayer(store.selectedProfile);
    }
  }

  /* Focus-safe 1s live countdown & 4000ms feedback TTL ticker */
  var arrivalPollTriggered = false;
  function tickLiveTimers() {
    if (document.visibilityState === 'hidden') return;

    if (store.feedback && store.feedbackAt > 0 && (Date.now() - store.feedbackAt >= FEEDBACK_TTL_MS)) {
      dismissFeedback();
      return;
    }

    var copy = L();
    var cds = getLiveCooldowns();
    var ch = getLiveChainInfo();
    var fl = getLiveFlightInfo();

    var nodes = document.querySelectorAll('[data-ztl-cd]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var kind = el.getAttribute('data-ztl-cd');
      var txt = '';
      if (kind === 'drug') txt = cds.drugSec > 0 ? fmtClock(cds.drugSec) : copy.ready;
      else if (kind === 'med') txt = cds.medSec > 0 ? fmtClock(cds.medSec) : copy.ready;
      else if (kind === 'boost') txt = cds.boostSec > 0 ? fmtClock(cds.boostSec) : copy.ready;
      else if (kind === 'chain') txt = fmtClock(ch.remSec);
      else if (kind === 'flight') txt = fmtClock(fl.remSec);
      if (txt && el.textContent !== txt) el.textContent = txt;
    }

    var fills = document.querySelectorAll('[data-ztl-flight-fill="1"]');
    for (var f = 0; f < fills.length; f++) {
      fills[f].style.width = fl.pct + '%';
    }

    if (fl.status === 'traveling' && fl.remSec <= 1 && !arrivalPollTriggered) {
      arrivalPollTriggered = true;
      window.setTimeout(function () {
        arrivalPollTriggered = false;
        refreshAll();
      }, 1100);
    }
  }

  var mainObserved = null;
  var mainObserver = null;
  function attachMainObserver(scheduleRender) {
    var main = document.getElementById('zone-main');
    if (!main || main === mainObserved || typeof MutationObserver !== 'function') return;
    mainObserved = main;
    try {
      if (mainObserver) mainObserver.disconnect();
      mainObserver = new MutationObserver(scheduleRender);
      mainObserver.observe(main, {
        attributes: true,
        attributeFilter: ['data-zone-screen', 'data-zma-open']
      });
    } catch (_) {}
  }

  function renderAll() {
    if (document.querySelector('x-dc')) return;
    try {
      renderHudStrip();
      renderRouteSection();
      syncAttackArenaStage();
      renderDrawer();
      renderFloatingToast();
      if (window.ZoneProfileAvatar && typeof window.ZoneProfileAvatar.syncMounts === 'function') {
        window.ZoneProfileAvatar.syncMounts();
      }
    } catch (_) {}
  }

  async function refreshAll() {
    var screen = getActiveScreen();
    var tasks = [
      loadGameplayState(),
      loadForeignMarketState(),
      loadFactionChainState(),
      loadEventsFeedState()
    ];
    if (screen === 'hospital' || store.drawerOpen) {
      tasks.push(loadHospitalPatients());
    }
    if (store.drawerOpen) {
      tasks.push(loadPlayerDirectory());
    }
    await Promise.all(tasks);
    renderAll();
    return store;
  }

  function boot() {
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && store.drawerOpen) {
        ev.preventDefault();
        closeDrawer();
      }
    });

    var rafScheduled = false;
    var scheduleRender = function () {
      attachMainObserver(scheduleRender);
      if (rafScheduled) return;
      rafScheduled = true;
      var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
      raf(function () {
        rafScheduled = false;
        renderAll();
      });
    };

    window.addEventListener('zone:render', scheduleRender, { passive: true });
    window.addEventListener('popstate', scheduleRender);

    try {
      var obs = new MutationObserver(scheduleRender);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme', 'data-zma-open']
      });
    } catch (_) {}

    window.setInterval(tickLiveTimers, 1000);
    window.setInterval(function () {
      if (document.visibilityState !== 'hidden' && !store.busy) {
        refreshAll();
      }
    }, 20000);

    scheduleRender();
    window.setTimeout(function () {
      attachMainObserver(scheduleRender);
      refreshAll();
      loadPlayerDirectory();
      loadHospitalPatients();
    }, 250);
    window.setTimeout(scheduleRender, 900);
  }

  window.ZoneTornLive = {
    openRoute: navigateToScreen,
    openTab: openLegacyTabOrRoute,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    dismissFeedback: dismissFeedback,
    refreshAll: refreshAll,
    renderAll: renderAll,
    execGameplayAction: execGameplayAction,
    execForeignAction: execForeignAction,
    execFactionAction: execFactionAction,
    revivePlayer: execRevivePlayer,
    getStore: function () { return store; },
    applySnapshot: function (snap) {
      applyGameplaySnapshot(snap);
      renderAll();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

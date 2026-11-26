/* ==========================================================================
 * ZONE v150 - ROUTE-SCOPED NATIVE TORN RPG, STORY, ACTIVITIES, ECONOMY & EMPIRE
 * Hand-Drawn Watercolor Sketchbook Edition (Light + Dark + EN + AR RTL)
 * Exclusive Ownership: ux-rpg-routes149 (assets/ui/zone-rpg-empire.js)
 * Exposes: window.ZoneRpgEmpire
 * Fiber-safe: append-only DOM mounts (#ztl-hud-story-slot, aside.zone-sidebar,
 *             #zone-main); never removes or mutates <x-dc> / React child nodes.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__zoneRpgEmpireLoaded) return;
  window.__zoneRpgEmpireLoaded = true;

  /* ------------------------------------------------------------------------
   * 1. STATIC BILINGUAL CATALOGS & FALLBACK DEFINITIONS (EN + AR)
   * ------------------------------------------------------------------------ */
  var STORY_ACTS = [
    {
      act: 1, minLv: 1, npc: 'duke', bossEn: 'Pier 4 Enforcer', bossAr: 'منفّذ الرصيف الرابع',
      en: 'Act I: Gutter of the Harbor', ar: 'الفصل الأول: أزقة المرفأ',
      chapters: [
        { id: 'act1_ch1', num: 1, npc: 'duke', en: 'Dockside Blood', ar: 'دماء الرصيف', dlgEn: 'Duke taps his ledger: "Every legend in Zone City crawled out of Pier 4. Run street rackets, build your nerve, and pay what you owe."', dlgAr: 'يطرق ديوك دفتره: «كل أسطورة في مدينة زون خرجت من الرصيف الرابع. نفّذ عمليات الشارع وابنِ جرأتك وسدّد ديونك.»' },
        { id: 'act1_ch2', num: 2, npc: 'layla', en: 'Layla\'s Dead-Drop', ar: 'مخبأ ليلى السري', dlgEn: 'Layla slides you a brass lockpick: "The harbor patrol changes shifts on the quarter-hour. Hit the alleys fast and stash your cut."', dlgAr: 'تمرر لك ليلى أداة فتح أقفال نحاسية: «دورية الميناء تتبدل كل ربع ساعة. اضرب الأزقة بسرعة وخبئ حصتك.»' },
        { id: 'act1_ch3', num: 3, npc: 'duke', en: 'Iron & Vigorish', ar: 'الحديد والفائدة', dlgEn: 'Duke grins through cigar smoke: "Skinny kids get rolled outside the bank. Put in gym reps before my collector tests your jaw."', dlgAr: 'يبتسم ديوك خلف دخان السيجار: «الضعفاء يُسرقون أمام البنك. ارفع قوتك في النادي قبل أن يختبر رجالي فكّك.»' },
        { id: 'act1_ch4', num: 4, npc: 'layla', en: 'Rust & Contraband', ar: 'الصدأ والمهربات', dlgEn: 'Layla points toward Container Row: "Gear up with real steel and body armor. Tonight we audit the dock foreman\'s safe."', dlgAr: 'تشير ليلى نحو صف الحاويات: «تسلّح بالحديد الحقيقي والدرع. الليلة نفتح خزنة مشرف الرصيف.»' },
        { id: 'act1_ch5', num: 5, npc: 'duke', boss: true, choice: true, en: 'Showdown at Pier 4', ar: 'مواجهة الرصيف الرابع', dlgEn: 'The Pier 4 Enforcer blocks the gangway. Choose whether to hand the harbor manifest to the Outlaw Syndicate or City Hall\'s Directorate, then break him.', dlgAr: 'يغلق منفّذ الرصيف الرابع الممر. اختر تسليم سجلات المرفأ لنقابة الخارجين أو لمديرية البلدية، ثم اسحقه في القتال.' }
      ]
    },
    {
      act: 2, minLv: 5, npc: 'tariq', bossEn: 'Chief Inspector Haddad', bossAr: 'المفتش العام حداد',
      en: 'Act II: Mayor Tariq\'s Shadow Ledger', ar: 'الفصل الثاني: دفتر ظل العمدة طارق',
      chapters: [
        { id: 'act2_ch1', num: 1, npc: 'tariq', en: 'The Owl\'s Summons', ar: 'استدعاء البومة', dlgEn: 'Mayor Tariq pours cardamom coffee: "You made noise at the docks, kid. Now let\'s turn street cash into municipal leverage."', dlgAr: 'يصب العمدة طارق القهوة بالهيل: «أحدثت ضجة في المرفأ يا بطل. حان وقت تحويل نقد الشارع إلى نفوذ بلدي.»' },
        { id: 'act2_ch2', num: 2, npc: 'tariq', en: 'Municipal Forgery', ar: 'تزوير الأختام البلدية', dlgEn: 'Tariq opens a sealed folder: "Stamp these zoning permits and sweep the proceeds into a term vault before Inspector Haddad sniffs the ink."', dlgAr: 'يفتح طارق ملفاً مختوماً: «اختم تصاريح البناء هذه وحوّل العوائد إلى خزنة البنك قبل أن يشم المفتش حداد رائحة الحبر.»' },
        { id: 'act2_ch3', num: 3, npc: 'layla', en: 'Wiretaps on Boulevard', ar: 'تنصت الجادة الكبرى', dlgEn: 'Layla patches into the precinct switchboard: "Haddad\'s squad is raiding the bazaar strip. Move clean inventory and cut their informants."', dlgAr: 'تخترق ليلى مقسم المخفر: «فرقة حداد تداهم شارع البازار. انقل البضاعة النظيفة واقطع خط مخبريهم.»' },
        { id: 'act2_ch4', num: 4, npc: 'tariq', en: 'Vault Immunity', ar: 'حصانة الخزنة', dlgEn: 'Tariq adjusts his cufflinks: "Buy property, study the law, and build a balance sheet that survives an indictment."', dlgAr: 'يعدّل طارق أزرار قميصه: «امتلك عقاراً، وادرس القانون، وابنِ ميزانية تصمد أمام أي لائحة اتهام.»' },
        { id: 'act2_ch5', num: 5, npc: 'tariq', boss: true, choice: true, en: 'The Haddad Tribunal', ar: 'محكمة المفتش حداد', dlgEn: 'Chief Inspector Haddad corners your convoy under the viaduct. Burn his warrant or flip his badge onto Tariq\'s payroll.', dlgAr: 'يحاصر المفتش العام حداد موكبك تحت الجسر. احرق مذكرته أو اقلب شارته لصالح خزينة العمدة طارق.' }
      ]
    },
    {
      act: 3, minLv: 10, npc: 'vega', bossEn: 'Cartel Sicario', bossAr: 'قاتل الكارتل المأجور',
      en: 'Act III: The Cartel Airlift', ar: 'الفصل الثالث: الجسر الجوي للكارتل',
      chapters: [
        { id: 'act3_ch1', num: 1, npc: 'vega', en: 'Runway Zero', ar: 'المدرج صفر', dlgEn: 'Madame Vega lowers her sunglasses: "Local alleys pay pennies, darling. My charters fly eleven capitals if you can hold the cargo."', dlgAr: 'تخفض مدام فيغا نظارتها الشمسية: «الأزقة المحلية تدفع الفتات يا عزيزي. طائراتي تعبر إحدى عشرة عاصمة لمن يحمل البضاعة.»' },
        { id: 'act3_ch2', num: 2, npc: 'vega', en: 'Customs Grease', ar: 'رشوة الجمارك', dlgEn: 'Vega taps a diplomatic pouch: "Plushies on top, Johannesburg pharmaceutical bricks underneath. Keep your addiction clean in Zurich."', dlgAr: 'تنقر فيغا على حقيبة دبلوماسية: «الدمى في الأعلى، وشحنات جوهانسبرغ في الأسفل. وحافظ على صفاء دمك في زيورخ.»' },
        { id: 'act3_ch3', num: 3, npc: 'layla', en: 'Chemist Supply Line', ar: 'خط إمداد الكيميائيين', dlgEn: 'Layla checks the cold-chain crates: "Rival hijackers hit our tarmac courier. Intercept them and reclaim the synthesis precursors."', dlgAr: 'تفحص ليلى صناديق التبريد: «قطّاع طرق هاجموا ناقل المدرج. اعترضهم واسترجع المواد الأولية فوراً.»' },
        { id: 'act3_ch4', num: 4, npc: 'vega', en: 'Museum Laundromat', ar: 'مغسلة المتحف', dlgEn: 'Vega smiles: "Curators ask zero questions when complete antiquities sets arrive. Turn foreign runs into untraceable Points."', dlgAr: 'تبتسم فيغا: «أمناء المتحف لا يطرحون الأسئلة حين تكتمل المجموعات النادرة. حوّل رحلاتك الخارجية إلى نقاط صافية.»' },
        { id: 'act3_ch5', num: 5, npc: 'vega', boss: true, choice: true, en: 'Hangar 9 Ambush', ar: 'كمين الحظيرة التاسعة', dlgEn: 'A Cartel Sicario seizes Hangar 9 to monopolize the air corridor. Decide who controls the skies and put him down.', dlgAr: 'يستولي قاتل الكارتل على الحظيرة التاسعة لاحتكار الممر الجوي. احسم سيادة السماء وأسقطه أرضاً.' }
      ]
    },
    {
      act: 4, minLv: 15, npc: 'marrow', bossEn: 'The Iron Colonel', bossAr: 'العقيد الحديدي',
      en: 'Act IV: Blood on the 120 Blocks', ar: 'الفصل الرابع: دماء المربعات الـ120',
      chapters: [
        { id: 'act4_ch1', num: 1, npc: 'marrow', en: 'War Drums', ar: 'طبول الحرب', dlgEn: 'Viktor Marrow slams a tactical map onto steel: "120 blocks, four syndicates, zero truces. Rally a faction chain or get erased."', dlgAr: 'يضرب فيكتور مارو الخريطة التكتيكية على الفولاذ: «120 مربعاً وأربع عائلات ولا هدنة. أشعل سلسلة الفاكشن أو امحَ من الخريطة.»' },
        { id: 'act4_ch2', num: 2, npc: 'marrow', en: 'Armory Mobilization', ar: 'تعبئة الترسانة', dlgEn: 'Marrow racks a bullpup rifle: "Stock medical kits, coordinate four-man crew heists, and hold the central sector wall."', dlgAr: 'يلقّم مارو بندقيته: «خزّن الحقائب الطبية، ونسّق سطو الطاقم الرباعي، واثبت على جدار القطاع المركزي.»' },
        { id: 'act4_ch3', num: 3, npc: 'duke', en: 'Bounty Harvest', ar: 'حصاد المكافآت', dlgEn: 'Duke counts blood-stained tags: "Every hospitalized rival weakens their wall score. Collect the open bounties before dawn."', dlgAr: 'يعدّ ديوك الشارات الملطخة: «كل خصم في المستشفى يضعف جدارهم. احصد المكافآت المرصودة قبل الفجر.»' },
        { id: 'act4_ch4', num: 4, npc: 'marrow', en: 'Siege of Citadel Bridge', ar: 'حصار جسر القلعة', dlgEn: 'Marrow points to the river crossing: "The Iron Colonel\'s mercenaries locked down Citadel Bridge. Break their vanguard."', dlgAr: 'يشير مارو إلى معبر النهر: «مرتزقة العقيد الحديدي أغلقوا جسر القلعة. حطّم طليعتهم المسلحة.»' },
        { id: 'act4_ch5', num: 5, npc: 'marrow', boss: true, choice: true, en: 'Fall of the Iron Colonel', ar: 'سقوط العقيد الحديدي', dlgEn: 'Armored floodlights sweep the plaza as the Iron Colonel steps forward. Claim the 120 Blocks for the Syndicate or the Directorate!', dlgAr: 'تغمر الكشافات المدرعة الساحة مع تقدم العقيد الحديدي. انتزع سيادة المربعات الـ120 للنقابة أو للمديرية!' }
      ]
    },
    {
      act: 5, minLv: 25, npc: 'tariq', bossEn: 'The Shadow Regent', bossAr: 'الوصي الخفي',
      en: 'Act V: The Sovereign Crown', ar: 'الفصل الخامس: التاج السيادي',
      chapters: [
        { id: 'act5_ch1', num: 1, npc: 'tariq', en: 'The Broken Seal', ar: 'الختم المكسور', dlgEn: 'Mayor Tariq\'s voice drops to a whisper: "The Underworld Council just put both our names on the liquidation slate."', dlgAr: 'يهمس العمدة طارق بصوت خافت: «مجلس العالم السفلي وضع اسمينا معاً على قائمة التصفية الكبرى.»' },
        { id: 'act5_ch2', num: 2, npc: 'vega', en: 'Offshore Sovereign', ar: 'السيادة العابرة', dlgEn: 'Madame Vega locks the flight deck: "Liquidate weak positions, arm your finest Ranked War cache weapons, and rally your inner circle."', dlgAr: 'تغلق مدام فيغا قمرة القيادة: «صفِّ المراكز الضعيفة، وجهّز أسلحة صناديق الحرب المصنّفة، واجمع نخبتك.»' },
        { id: 'act5_ch3', num: 3, npc: 'marrow', en: 'Night of Long Knives', ar: 'ليلة الخناجر الطويلة', dlgEn: 'Marrow clears the spire lobby: "Council assassins hold the upper floors. Climb floor by floor, no mercy."', dlgAr: 'يطهّر مارو بهو البرج: «قتلة المجلس يمسكون الطوابق العليا. اصعد طابقاً بعد طابق بلا رحمة.»' },
        { id: 'act5_ch4', num: 4, npc: 'layla', en: 'The Master Vault Key', ar: 'مفتاح الخزنة السيادية', dlgEn: 'Layla cracks the biometric cipher: "One door left between you and the Sovereign Crown of Zone City."', dlgAr: 'تفك ليلى الشفرة البيومترية: «باب واحد فقط يفصلك عن التاج السيادي لمدينة زون.»' },
        { id: 'act5_ch5', num: 5, npc: 'tariq', boss: true, choice: true, en: 'Coronation in Blood', ar: 'تتويج بالدم', dlgEn: 'The Shadow Regent awaits atop Sovereign Tower. Seal your eternal destiny and claim the Crown of Zone City!', dlgAr: 'ينتظرك الوصي الخفي في قمة البرج السيادي. اختم مصيرك الأبدي وانتزع تاج مدينة زون!' }
      ]
    }
  ];

  var RANKS_26 = [
    { idx: 1, en: 'Absolute Beginner', ar: 'مبتدئ مطلق' },
    { idx: 2, en: 'Beginner', ar: 'مبتدئ' },
    { idx: 3, en: 'Inexperienced', ar: 'قليل الخبرة' },
    { idx: 4, en: 'Rookie', ar: 'مستجد' },
    { idx: 5, en: 'Novice', ar: 'ناشئ' },
    { idx: 6, en: 'Below Average', ar: 'دون المتوسط' },
    { idx: 7, en: 'Average', ar: 'متوسط' },
    { idx: 8, en: 'Reasonable', ar: 'مقبول' },
    { idx: 9, en: 'Above Average', ar: 'فوق المتوسط' },
    { idx: 10, en: 'Competent', ar: 'كفؤ' },
    { idx: 11, en: 'Highly Competent', ar: 'عالي الكفاءة' },
    { idx: 12, en: 'Veteran', ar: 'مخضرم' },
    { idx: 13, en: 'Distinguished', ar: 'متميّز' },
    { idx: 14, en: 'Highly Distinguished', ar: 'رفيع التميّز' },
    { idx: 15, en: 'Professional', ar: 'محترف' },
    { idx: 16, en: 'Star', ar: 'نجم' },
    { idx: 17, en: 'Master', ar: 'أستاذ' },
    { idx: 18, en: 'Outstanding', ar: 'بارز' },
    { idx: 19, en: 'Celebrity', ar: 'مشهور' },
    { idx: 20, en: 'Supreme', ar: 'أسمى' },
    { idx: 21, en: 'Idolized', ar: 'مهيب' },
    { idx: 22, en: 'Champion', ar: 'بطل' },
    { idx: 23, en: 'Heroic', ar: 'بطولي' },
    { idx: 24, en: 'Legendary', ar: 'أسطوري' },
    { idx: 25, en: 'Elite', ar: 'نخبوي' },
    { idx: 26, en: 'Invincible', ar: 'لا يُقهر' }
  ];

  var LEVEL_ROADMAP = [
    { lv: 2, en: 'City Dump & Encrypted Mail', ar: 'مكب المدينة والبريد المشفر' },
    { lv: 3, en: 'Casino Tables & 3 Spin Wheels', ar: 'طاولات الكازينو وعجلات الحظ' },
    { lv: 5, en: 'Item Market & 0%-Tax Bazaars', ar: 'سوق العتاد والبازارات بلا ضريبة' },
    { lv: 7, en: 'Bounty Board & NPC Mission Agents', ar: 'لوحة المكافآت ووكلاء المهمات' },
    { lv: 10, en: 'Player Companies & Property Vaults', ar: 'شركات اللاعبين وخزائن العقار' },
    { lv: 12, en: 'Faction Founding ($1M) & Ranked Wars', ar: 'تأسيس الفاكشن والحروب المصنفة' },
    { lv: 15, en: 'International Airport & 11-City Smuggling', ar: 'المطار الدولي وتهريب 11 مدينة' },
    { lv: 20, en: 'Specialist Heavy Conditioning Gyms', ar: 'أندية التدريب التخصصية' },
    { lv: 25, en: 'Act V Endgame & RW Bonus Caches', ar: 'نهاية الفصل الخامس وصناديق الحرب' },
    { lv: 50, en: 'Syndicate Inner Circle Perks', ar: 'مزايا الدائرة العليا للنقابة' },
    { lv: 100, en: 'Immortal Sovereign Crown', ar: 'تاج السيادة الخالدة' }
  ];

  var SKILL_BRANCHES = [
    {
      id: 'shadow', tone: 'plum', en: 'Shadow Mastermind', ar: 'العقل المدبر الخفي',
      nodes: [
        { id: 'street_instinct', tier: 1, sp: 1, en: 'Street Instinct', ar: 'غريزة الشارع', effEn: '+4% Crime Success', effAr: '+4% نجاح الجرائم' },
        { id: 'silent_footsteps', tier: 2, sp: 1, parent: 'street_instinct', en: 'Silent Footsteps', ar: 'خطوات صامتة', effEn: '+6% Stealth Attack', effAr: '+6% تخفي الهجوم' },
        { id: 'wiretapper', tier: 3, sp: 1, parent: 'silent_footsteps', en: 'Wiretapper', ar: 'خبير التنصت', effEn: '-15% Jail Duration', effAr: '-15% مدة السجن' },
        { id: 'master_burglar', tier: 4, sp: 2, parent: 'wiretapper', en: 'Master Burglar', ar: 'لص محترف', effEn: '+12% Crime Cash & Loot', effAr: '+12% غنائم الجرائم' },
        { id: 'nerve_overclock', tier: 5, sp: 2, parent: 'master_burglar', en: 'Nerve Overclock', ar: 'شحن الجرأة', effEn: '+3 Max Nerve', effAr: '+3 سقف الجرأة' },
        { id: 'ghost_protocol', tier: 6, sp: 3, parent: 'nerve_overclock', capstone: true, en: '★ Ghost Protocol', ar: '★ بروتوكول الشبح', effEn: '+15% Crime, +20% Stealth, +5 Max Nerve', effAr: '+15% جرائم، +20% تخفي، +5 جرأة' }
      ]
    },
    {
      id: 'warlord', tone: 'crimson', en: 'Warlord Enforcer', ar: 'قائد الحرب الميداني',
      nodes: [
        { id: 'iron_knuckles', tier: 1, sp: 1, en: 'Iron Knuckles', ar: 'قبضة حديدية', effEn: '+5% Melee & Unarmed Dmg', effAr: '+5% ضرر الاشتباك' },
        { id: 'hollow_point_drill', tier: 2, sp: 1, parent: 'iron_knuckles', en: 'Hollow-Point Drill', ar: 'ذخيرة خارقة', effEn: '+6% Firearm Accuracy', effAr: '+6% دقة الأسلحة' },
        { id: 'arterial_strike', tier: 3, sp: 1, parent: 'hollow_point_drill', en: 'Arterial Strike', ar: 'ضربة شريانية', effEn: '+8% Critical Hit Chance', effAr: '+8% فرصة الضربة الحرجة' },
        { id: 'kevlar_weave', tier: 4, sp: 2, parent: 'arterial_strike', en: 'Kevlar Weave', ar: 'نسيج كيفلر', effEn: '+8% Armor Mitigation', effAr: '+8% صد الدروع' },
        { id: 'blood_frenzy', tier: 5, sp: 2, parent: 'kevlar_weave', en: 'Blood Frenzy', ar: 'هيجان الدم', effEn: '+100 Max Life', effAr: '+100 سقف الصحة' },
        { id: 'executioner', tier: 6, sp: 3, parent: 'blood_frenzy', capstone: true, en: '★ Executioner', ar: '★ الجلاد الحاسم', effEn: '+18% Combat Dmg, +15% Mug, +250 Max Life', effAr: '+18% ضرر، +15% نشل، +250 صحة' }
      ]
    },
    {
      id: 'mogul', tone: 'gold', en: 'Syndicate Mogul', ar: 'قطب المال والنقابة',
      nodes: [
        { id: 'compound_ledger', tier: 1, sp: 1, en: 'Compound Ledger', ar: 'دفتر الفائدة المركبة', effEn: '+5% Bank Term APR', effAr: '+5% عائد شهادات البنك' },
        { id: 'insider_tape', tier: 2, sp: 1, parent: 'compound_ledger', en: 'Insider Tape', ar: 'شريط المطلعين', effEn: '-25% Stock Broker Fee', effAr: '-25% عمولة الأسهم' },
        { id: 'offshore_vault', tier: 3, sp: 1, parent: 'insider_tape', en: 'Offshore Vault', ar: 'خزنة عابرة للحدود', effEn: '+25% Vault Cap & Anti-Mug', effAr: '+25% سعة الخزنة وحماية النشل' },
        { id: 'airstrip_logistics', tier: 4, sp: 2, parent: 'offshore_vault', en: 'Airstrip Logistics', ar: 'لوجستيات المدرج', effEn: '+2 Travel Luggage', effAr: '+2 سعة حقائب السفر' },
        { id: 'tax_shelter', tier: 5, sp: 2, parent: 'airstrip_logistics', en: 'Tax Shelter', ar: 'ملاذ ضريبي', effEn: '+12% Company & Job Pay', effAr: '+12% رواتب الشركات' },
        { id: 'central_banker', tier: 6, sp: 3, parent: 'tax_shelter', capstone: true, en: '★ Central Banker', ar: '★ المصرفي المركزي', effEn: '+15% APR, -50% Stock Fee, +3 Luggage, +20% Pay', effAr: '+15% فائدة، -50% عمولة، +3 أمتعة، +20% راتب' }
      ]
    },
    {
      id: 'alchemist', tone: 'sage', en: 'Bio-Alchemist', ar: 'الخيميائي الحيوي',
      nodes: [
        { id: 'micro_dosing', tier: 1, sp: 1, en: 'Micro-Dosing', ar: 'الجرعات الدقيقة', effEn: '-12% Drug Overdose Risk', effAr: '-12% خطر الجرعة الزائدة' },
        { id: 'pure_synthesis', tier: 2, sp: 1, parent: 'micro_dosing', en: 'Pure Synthesis', ar: 'تركيب نقي', effEn: '-15% Addiction Gain', effAr: '-15% تراكم الإدمان' },
        { id: 'field_triage', tier: 3, sp: 1, parent: 'pure_synthesis', en: 'Field Triage', ar: 'إسعاف ميداني', effEn: '+15% Medical Item Heal', effAr: '+15% فعالية العلاج الطبي' },
        { id: 'endorphin_lock', tier: 4, sp: 2, parent: 'field_triage', en: 'Endorphin Lock', ar: 'قفل الإندورفين', effEn: '+8% Gym Happy Efficiency', effAr: '+8% كفاءة المعنويات بالنادي' },
        { id: 'adrenal_surge', tier: 5, sp: 2, parent: 'endorphin_lock', en: 'Adrenal Surge', ar: 'اندفاع الأدرينالين', effEn: '+5 Max Energy', effAr: '+5 سقف الطاقة' },
        { id: 'bio_synthetic', tier: 6, sp: 3, parent: 'adrenal_surge', capstone: true, en: '★ Bio-Synthetic', ar: '★ التخليق الحيوي', effEn: '-35% OD Risk, +20% Heal, -5E Revive, +10 Energy', effAr: '-35% خطر OD، +20% شفاء، -5 طاقة إنعاش، +10 طاقة' }
      ]
    }
  ];

  var MASTERY_SKILLS = [
    { key: 'hunting', en: 'Hunting', ar: 'الصيد البري' },
    { key: 'racing', en: 'Street Racing', ar: 'سباق الشوارع' },
    { key: 'reviving', en: 'Reviving', ar: 'الإنعاش الطبي' },
    { key: 'busting', en: 'Jail Busting', ar: 'تهريب السجناء' },
    { key: 'smuggling', en: 'Smuggling', ar: 'التهريب الدولي' },
    { key: 'forging', en: 'Forgery', ar: 'التزوير المتقدم' },
    { key: 'hacking', en: 'Cyber Hacking', ar: 'الاختراق السيبراني' },
    { key: 'weapon_mastery', en: 'Weapon Mastery', ar: 'إتقان السلاح' },
    { key: 'crime_mastery', en: 'Crime Mastery', ar: 'إتقان الجرائم' }
  ];

  var MISSION_SHOP_REWARDS = [
    { id: 'xanax', cost: 45, en: 'Xanax (+250E)', ar: 'زاناكس (+250 طاقة)' },
    { id: 'edvd', cost: 60, en: 'Erotic DVD (+2,500H)', ar: 'قرص eDVD (+2,500 معنويات)' },
    { id: 'bloodbag', cost: 18, en: 'Filled Blood Bag', ar: 'كيس دم وريدي' },
    { id: 'lawyer_card', cost: 30, en: 'Lawyer Business Card', ar: 'بطاقة المحامي' },
    { id: 'flash_grenade', cost: 20, en: 'Flashbang Grenade', ar: 'قنبلة ضوئية' },
    { id: 'epinephrine', cost: 28, en: 'Epinephrine Injector', ar: 'حاقن إبينفرين' },
    { id: 'skill_xp_book', cost: 50, en: '+25 Skill XP Tome', ar: 'مجلد +25 خبرة مهارة' }
  ];

  var SPIN_WHEELS = [
    { id: 'lame', cost: 1000, tone: 'sage', en: 'Wheel of Lame', ar: 'عجلة المبتدئين', prizeEn: 'Up to $25k, Plushies, Meds', prizeAr: 'حتى $25k، دمى، إسعافات' },
    { id: 'mediocre', cost: 50000, tone: 'gold', en: 'Wheel of Mediocrity', ar: 'عجلة المحترفين', prizeEn: 'Up to $500k, Points, Xanax', prizeAr: 'حتى $500k، نقاط، زاناكس' },
    { id: 'awesome', cost: 1000000, tone: 'plum', en: 'Wheel of Awesome', ar: 'عجلة الأساطير', prizeEn: 'Up to $10M, eDVD, Rare Gear', prizeAr: 'حتى $10M، أقراص eDVD، عتاد نادر' }
  ];

  var HUNT_MODES = [
    { id: 'beginner', energy: 10, fee: 500, minSkill: 0, en: 'Harbor Marsh Hunt', ar: 'صيد مستنقعات المرفأ' },
    { id: 'standard', energy: 15, fee: 2000, minSkill: 15, en: 'Dune Ridge Safari', ar: 'سفاري كثبان الصحراء' },
    { id: 'master', energy: 25, fee: 5000, minSkill: 50, en: 'Apex Predator Expedition', ar: 'بعثة المفترسات الكبرى (50+)' }
  ];

  var RACING_CARS = [
    { id: 'civic_e', cls: 'E', price: 18000, en: 'Kanjo Hatch [Class E]', ar: 'هاتشباك كانجو [فئة E]' },
    { id: 'silvia_d', cls: 'D', price: 55000, en: 'Drift Coupe S15 [Class D]', ar: 'كوبيه دريفت S15 [فئة D]' },
    { id: 'evo_c', cls: 'C', price: 145000, en: 'Rally Evo IX [Class C]', ar: 'رالي إيفو IX [فئة C]' },
    { id: 'gtr_b', cls: 'B', price: 380000, en: 'Skyline GT-R [Class B]', ar: 'سكايلاين GT-R [فئة B]' },
    { id: 'gt3_a', cls: 'A', price: 950000, en: 'Apex GT3 RS [Class A]', ar: 'أبيكس GT3 RS [فئة A]' },
    { id: 'valkyrie_s', cls: 'A+', price: 2400000, en: 'Valkyrie Hypercar [Class A+]', ar: 'فالكيري الخارقة [فئة A+]' }
  ];

  var TUNING_PARTS = [
    { id: 'turbo', pts: 5, en: 'Twin-Scroll Turbo', ar: 'تيربو مزدوج' },
    { id: 'ecu', pts: 4, en: 'Race ECU Remap', ar: 'برمجة وحدة ECU' },
    { id: 'tires', pts: 3, en: 'Semi-Slick Tires', ar: 'إطارات سيمي سليك' },
    { id: 'suspension', pts: 4, en: 'Coilover Suspension', ar: 'نظام تعليق رياضي' },
    { id: 'weight_reduction', pts: 6, en: 'Carbon Weight Strip', ar: 'تخفيف وزن كربوني' }
  ];

  var RACING_TRACKS = [
    { id: 'docks_sprint', en: 'Docks Sprint (10E)', ar: 'سباق المرفأ السريع (10 طاقة)' },
    { id: 'corniche_circuit', en: 'Corniche Circuit (10E)', ar: 'حلبة الكورنيش (10 طاقة)' },
    { id: 'industrial_drift', en: 'Industrial Drift (10E)', ar: 'دريفت المنطقة الصناعية (10 طاقة)' },
    { id: 'airport_runway', en: 'Airport Runway (10E)', ar: 'مدرج المطار (10 طاقة)' },
    { id: 'mountain_pass', en: 'Mountain Pass (10E)', ar: 'الممر الجبلي (10 طاقة)' },
    { id: 'zone_gp', en: 'Zone Grand Prix (10E)', ar: 'جائزة زون الكبرى (10 طاقة)' }
  ];

  var COMPANY_TYPES = [
    { id: 'oil_rig', en: 'Offshore Oil Rig', ar: 'منصة نفط بحرية' },
    { id: 'adult_novelties', en: 'Velvet Media & Novelties', ar: 'مؤسسة المخمل للترفيه' },
    { id: 'sweet_shop', en: 'Confectionery & Boosters', ar: 'متجر الحلويات والمنشطات' },
    { id: 'logistics_corp', en: 'Harbor Freight Logistics', ar: 'شركة الشحن اللوجستي' },
    { id: 'private_security', en: 'Aegis Private Security', ar: 'شركة الحراسة الخاصة' },
    { id: 'cyber_defense', en: 'Zero-Day Cyber Defense', ar: 'شركة الأمن السيبراني' },
    { id: 'tv_network', en: 'Zone Broadcast Network', ar: 'شبكة بث المدينة' },
    { id: 'fitness_center', en: 'Titan Fitness Center', ar: 'مركز تايتن الرياضي' }
  ];

  var COMPANY_SPECIALS = [
    { star: 1, cost: 3, id: 'sp_1', en: '1★ Shift Bonus (+50E / Cash)', ar: 'ميزة 1★ (+50 طاقة / نقد)' },
    { star: 3, cost: 8, id: 'sp_3', en: '3★ Supply Crate (Booster/Med)', ar: 'ميزة 3★ (صندوق إمداد)' },
    { star: 5, cost: 15, id: 'sp_5', en: '5★ Cooldown Cut (-2h Drug/Med)', ar: 'ميزة 5★ (-2س تهدئة)' },
    { star: 7, cost: 25, id: 'sp_7', en: '7★ Stat Conditioning (+Battle/Work)', ar: 'ميزة 7★ (تطوير الإحصاءات)' },
    { star: 10, cost: 40, id: 'sp_10', en: '10★ Sovereign Dividend (eDVD/Xanax/$)', ar: 'ميزة 10★ (عائد النخبة)' }
  ];

  var FACTION_RESPECT_BRANCHES = [
    { id: 'criminality', en: 'Criminality', ar: 'الإجرام المنظم', nodes: [
      { id: 'crime_skill', en: '+Crime Skill', ar: '+مهارة الجرائم' },
      { id: 'max_nerve', en: '+Max Nerve', ar: '+سقف الجرأة' },
      { id: 'oc_payout', en: '+OC Payout', ar: '+عائد السطو المنظم' },
      { id: 'jail_bust', en: '+Jail Bust Skill', ar: '+مهارة التهريب' }
    ] },
    { id: 'fortitude', en: 'Fortitude', ar: 'الصمود الطبي', nodes: [
      { id: 'hosp_time', en: '-Hospital Time', ar: '-وقت المستشفى' },
      { id: 'max_life', en: '+Max Life', ar: '+سقف الصحة' },
      { id: 'med_effectiveness', en: '+Med Effectiveness', ar: '+فعالية الإسعاف' },
      { id: 'revive_skill', en: '+Revive Mastery', ar: '+مهارة الإنعاش' }
    ] },
    { id: 'voracity', en: 'Voracity', ar: 'النهم والمعززات', nodes: [
      { id: 'booster_cd_cap', en: '+Booster CD Cap', ar: '+سقف تهدئة المعزز' },
      { id: 'energy_can_gain', en: '+Energy Can Gain', ar: '+طاقة المشروبات' },
      { id: 'candy_happy', en: '+Candy Happiness', ar: '+سعادة الحلوى' },
      { id: 'booster_nerve', en: '+Booster Nerve', ar: '+جرأة إضافية' }
    ] },
    { id: 'toleration', en: 'Toleration', ar: 'التحمل الدوائي', nodes: [
      { id: 'drug_od_risk', en: '-Drug OD Risk', ar: '-خطر الجرعة الزائدة' },
      { id: 'addiction_gain', en: '-Addiction Gain', ar: '-اكتساب الإدمان' },
      { id: 'rehab_cost', en: '-Rehab Cost', ar: '-تكلفة المصحة' },
      { id: 'drug_cd_reduce', en: '-Drug Cooldown', ar: '-تهدئة الدواء' }
    ] },
    { id: 'excursion', en: 'Excursion', ar: 'السفر والرحلات', nodes: [
      { id: 'travel_luggage', en: '+Travel Luggage (+1..5)', ar: '+حقائب السفر (+1..5)' },
      { id: 'rehab_fee', en: '-Zurich Clinic Fee', ar: '-رسوم مصحة الخارج' },
      { id: 'hunting_gain', en: '+Hunting Payout', ar: '+عوائد الصيد' },
      { id: 'airfare_discount', en: '-Airfare Cost', ar: '-رسوم الطيران' }
    ] },
    { id: 'steadfast', en: 'Steadfast', ar: 'الثبات الرياضي', nodes: [
      { id: 'str_gym_gain', en: '+Strength Gym Gains', ar: '+تدريب القوة بالنادي' },
      { id: 'def_gym_gain', en: '+Defense Gym Gains', ar: '+تدريب الدفاع بالنادي' },
      { id: 'spd_gym_gain', en: '+Speed Gym Gains', ar: '+تدريب السرعة بالنادي' },
      { id: 'dex_gym_gain', en: '+Dexterity Gym Gains', ar: '+تدريب الرشاقة بالنادي' }
    ] },
    { id: 'aggression', en: 'Aggression', ar: 'الضراوة القتالية', nodes: [
      { id: 'combat_damage', en: '+Combat Damage', ar: '+ضرر القتال' },
      { id: 'combat_accuracy', en: '+Hit Accuracy', ar: '+دقة الإصابة' },
      { id: 'combat_speed', en: '+Combat Speed', ar: '+سرعة القتال' },
      { id: 'hosp_duration', en: '+Hospitalize Duration', ar: '+مدة تنويم الخصم' }
    ] }
  ];

  var CREW_OC_HEISTS = [
    { id: 'armored_van', diff: 1, en: 'Armored Transit Van', ar: 'شاحنة نقل الأموال المدرعة', reward: '$180k + 15 Respect' },
    { id: 'harbor_customs_vault', diff: 2, en: 'Harbor Customs Vault', ar: 'خزنة جمارك المرفأ', reward: '$420k + 35 Respect' },
    { id: 'embassy_black_box', diff: 3, en: 'Embassy Black-Box Raid', ar: 'عملية الصندوق الأسود للسفارة', reward: '$850k + 70 Respect' },
    { id: 'central_bank_bullion', diff: 4, en: 'Central Bank Bullion', ar: 'سبائك البنك المركزي', reward: '$1.8M + 140 Respect' },
    { id: 'sovereign_airfield', diff: 5, en: 'Sovereign Airfield Heist', ar: 'سطو المدرج السيادي', reward: '$4.0M + 300 Respect' }
  ];

  var CREW_ROLES = [
    { id: 'mastermind', en: 'Mastermind', ar: 'العقل المدبر' },
    { id: 'hacker', en: 'Hacker', ar: 'المخترق' },
    { id: 'muscle', en: 'Muscle', ar: 'المنفذ المسلح' },
    { id: 'driver', en: 'Getaway Driver', ar: 'سائق الهروب' }
  ];

  var LOADOUT_SLOTS_9 = [
    { slot: 'primary', group: 'weapon', en: 'Primary Rifle', ar: 'سلاح رئيسي', defaults: ['ak', 'sniper', 'shotgun', 'bullpup_3', 'assaultrifle2_4', 'smg'] },
    { slot: 'secondary', group: 'weapon', en: 'Secondary Sidearm', ar: 'سلاح ثانوي', defaults: ['magnum', 'pistol_t', 'revolver', 'pistol', 'sawedoff'] },
    { slot: 'melee', group: 'weapon', en: 'Melee Blade/Club', ar: 'سلاح اشتباك', defaults: ['knife', 'bat', 'cut_throat_razor'] },
    { slot: 'temporary', group: 'weapon', en: 'Temporary Tactical', ar: 'تكتيكي مؤقت', defaults: ['flash_grenade', 'smoke_grenade', 'epinephrine'] },
    { slot: 'head', group: 'armor', en: 'Head Ballistic', ar: 'خوذة الرأس', defaults: ['vest', 'armor', 'paint_mask'] },
    { slot: 'body', group: 'armor', en: 'Body Kevlar', ar: 'درع الصدر', defaults: ['vest', 'armor'] },
    { slot: 'hands', group: 'armor', en: 'Tactical Gloves', ar: 'قفازات القتال', defaults: ['armor', 'vest'] },
    { slot: 'legs', group: 'armor', en: 'Leg Greaves', ar: 'درع الساقين', defaults: ['vest', 'armor'] },
    { slot: 'feet', group: 'armor', en: 'Combat Boots', ar: 'حذاء قتالي', defaults: ['armor', 'vest'] }
  ];

  /* Strict 1-Route-1-Purpose Mapping (ONLY these 10 routes mount a native card below native content) */
  var ROUTE_DOMAINS = {
    missions: ['story', 'activities'],
    education: ['rpg'],
    home: ['story', 'rpg'],
    casino: ['activities'],
    city: ['activities'],
    market: ['economy'],
    jobs: ['economy'],
    properties: ['economy'],
    items: ['empire'],
    faction: ['empire']
  };

  var LEGACY_TAB_TO_ROUTE = {
    story: 'missions',
    rpg: 'education',
    activities: 'casino',
    economy: 'market',
    empire: 'faction'
  };

  var ACTION_HUMAN_LABELS = {
    'chapter.start': { en: 'Chapter started', ar: 'تم بدء الفصل' },
    'chapter.choice': { en: 'Alignment updated', ar: 'تم تحديث التحالف' },
    'chapter.bossFight': { en: 'Boss encounter settled', ar: 'حُسمت مواجهة الزعيم' },
    'chapter.claim': { en: 'Chapter reward claimed', ar: 'تم استلام مكافأة الفصل' },
    'agent.accept': { en: 'Contract accepted', ar: 'تم قبول العقد' },
    'agent.complete': { en: 'Contract completed', ar: 'تم إنجاز العقد' },
    'agent.refresh': { en: 'Contracts refreshed', ar: 'تم تحديث العقود' },
    'agent.buyReward': { en: 'Armory reward redeemed', ar: 'تم استبدال مكافأة المتجر' },
    'level.toggleHold': { en: 'Hold-Level updated', ar: 'تم تحديث تجميد المستوى' },
    'level.promote': { en: 'Level promoted', ar: 'تمت ترقية المستوى' },
    'rank.claimPromotion': { en: 'Rank promotion claimed', ar: 'تم استلام ترقية الرتبة' },
    'skillTree.unlock': { en: 'Skill node unlocked', ar: 'تم فتح المهارة' },
    'skillTree.respec': { en: 'Skill tree reset', ar: 'تمت إعادة توزيع المهارات' },
    'workStats.train': { en: 'Working stats trained', ar: 'تم تدريب إحصاءات العمل' },
    'wheel.spin': { en: 'Wheel spun', ar: 'تم تدوير العجلة' },
    'dump.search': { en: 'Dump searched', ar: 'تم البحث في المكب' },
    'dump.toss': { en: 'Item tossed into dump', ar: 'تم رمي الغرض في المكب' },
    'loan.borrow': { en: 'Loan disbursed', ar: 'تم استلام القرض' },
    'loan.repay': { en: 'Loan payment recorded', ar: 'تم سداد القرض' },
    'hunt.expedition': { en: 'Hunting expedition completed', ar: 'اكتملت رحلة الصيد' },
    'race.buyCar': { en: 'Vehicle acquired', ar: 'تم شراء السيارة' },
    'race.selectCar': { en: 'Active race car selected', ar: 'تم اختيار سيارة السباق' },
    'race.upgradeCar': { en: 'Part installed', ar: 'تم تركيب قطعة التعديل' },
    'race.enterTrack': { en: 'Race completed', ar: 'اكتمل السباق' },
    'trade.create': { en: 'Safe trade opened', ar: 'تم فتح مقايضة آمنة' },
    'trade.addCash': { en: 'Cash added to escrow', ar: 'تم إيداع النقد بالضمان' },
    'trade.addItem': { en: 'Item added to escrow', ar: 'تم إيداع الغرض بالضمان' },
    'trade.accept': { en: 'Trade accepted', ar: 'تم تأكيد المقايضة' },
    'trade.cancel': { en: 'Trade cancelled & refunded', ar: 'تم إلغاء المقايضة واسترداد الضمان' },
    'bazaar.toggle': { en: 'Bazaar status updated', ar: 'تم تحديث حالة البازار' },
    'bazaar.listItem': { en: 'Item listed at 0% tax', ar: 'تم عرض الغرض بضريبة 0%' },
    'bazaar.unlistItem': { en: 'Listing removed', ar: 'تم سحب العرض' },
    'bazaar.buy': { en: 'Bazaar purchase completed', ar: 'تم الشراء من البازار' },
    'company.found': { en: 'Company founded', ar: 'تم تأسيس الشركة' },
    'company.join': { en: 'Joined company', ar: 'تم الانضمام للشركة' },
    'company.leave': { en: 'Left company', ar: 'تمت مغادرة الشركة' },
    'company.workShift': { en: 'Company shift completed', ar: 'اكتملت وردية الشركة' },
    'company.manage': { en: 'Company settings saved', ar: 'تم حفظ إعدادات الشركة' },
    'company.redeemSpecial': { en: 'Company special redeemed', ar: 'تم تفعيل ميزة الشركة' },
    'marriage.propose': { en: 'Proposal sent', ar: 'تم إرسال طلب الزواج' },
    'marriage.accept': { en: 'Marriage sealed', ar: 'تم قبول الزواج' },
    'marriage.divorce': { en: 'Divorce finalized', ar: 'تم إنهاء الزواج' },
    'faction.create': { en: 'Faction founded', ar: 'تم تأسيس الفاكشن' },
    'faction.join': { en: 'Joined faction', ar: 'تم الانضمام للفاكشن' },
    'faction.leave': { en: 'Left faction cleanly', ar: 'تمت مغادرة الفاكشن' },
    'faction.setRole': { en: 'Member role updated', ar: 'تم تحديث رتبة العضو' },
    'faction.kick': { en: 'Member removed from faction', ar: 'تم إبعاد العضو من الفاكشن' },
    'faction.vaultDeposit': { en: 'Deposited into faction vault', ar: 'تم الإيداع في خزنة الفاكشن' },
    'faction.vaultGrant': { en: 'Vault grant sent', ar: 'تم منح النقد من الخزنة' },
    'tree.upgrade': { en: 'Respect branch upgraded', ar: 'تمت ترقية شجرة الاحترام' },
    'oc.create': { en: 'Organized heist planned', ar: 'تم تخطيط العملية المنظمة' },
    'oc.claimSlot': { en: 'Crew role claimed', ar: 'تم حجز دور الطاقم' },
    'oc.execute': { en: 'Crew heist executed', ar: 'تم تنفيذ السطو الرباعي' },
    'war.enlist': { en: 'Enlisted in Ranked War', ar: 'تم التسجيل في الحرب المصنفة' },
    'war.challenge': { en: 'Ranked War challenge issued', ar: 'تم توجيه تحدي الحرب المصنفة' },
    'war.scoreHit': { en: 'Ranked War hit scored', ar: 'تم تسجيل ضربة حرب' },
    'war.claimCache': { en: 'Ranked War cache opened', ar: 'تم فتح صندوق الحرب' },
    'loadout.equipSlot': { en: 'Loadout slot equipped', ar: 'تم تجهيز خانة العتاد' }
  };

  /* ------------------------------------------------------------------------
   * 2. HAND-INKED WATERCOLOR PORTRAITS (.webp + GOUACHE SVG CAST)
   * ------------------------------------------------------------------------ */
  function renderNpcPortrait(npcKey) {
    var k = String(npcKey || 'tariq').toLowerCase();
    if (k.indexOf('tariq') >= 0 || k === 'mayor') {
      return '<img src="./assets/ui/watercolor-art/mayor-tariq-scheming.webp" alt="Mayor Tariq" loading="lazy">';
    }
    if (k.indexOf('duke') >= 0) {
      return (
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="32" cy="32" r="30" fill="#3a271c"/>' +
          '<path d="M12 58C15 44 23 39 32 39C41 39 49 44 52 58Z" fill="#b86b2b"/>' +
          '<circle cx="32" cy="25" r="12" fill="#e5b88b" stroke="#1e1b18" stroke-width="2"/>' +
          '<path d="M18 19H46L42 12H22Z" fill="#23201c" stroke="#f0c465" stroke-width="1.5"/>' +
          '<path d="M35 30L47 33" stroke="#d94f38" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="28" cy="24" r="1.6" fill="#1e1b18"/><circle cx="36" cy="24" r="1.6" fill="#1e1b18"/>' +
        '</svg>'
      );
    }
    if (k.indexOf('layla') >= 0) {
      return (
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="32" cy="32" r="30" fill="#1b2d36"/>' +
          '<path d="M13 58C16 43 24 38 32 38C40 38 48 43 51 58Z" fill="#c93b4b"/>' +
          '<path d="M18 27C18 14 25 10 32 10C39 10 46 14 46 27L42 36H22Z" fill="#183f4a" stroke="#1e1b18" stroke-width="1.8"/>' +
          '<circle cx="32" cy="26" r="10.5" fill="#dfb18b" stroke="#1e1b18" stroke-width="1.8"/>' +
          '<circle cx="28.5" cy="25" r="1.5" fill="#1e1b18"/><circle cx="35.5" cy="25" r="1.5" fill="#1e1b18"/>' +
          '<path d="M29 30Q32 32.5 35 30" stroke="#8f2414" stroke-width="1.6" fill="none"/>' +
        '</svg>'
      );
    }
    if (k.indexOf('vega') >= 0) {
      return (
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="32" cy="32" r="30" fill="#2d1c3b"/>' +
          '<path d="M13 58C17 43 24 39 32 39C40 39 47 43 51 58Z" fill="#228b62"/>' +
          '<circle cx="32" cy="25" r="11" fill="#e7be9a" stroke="#1e1b18" stroke-width="1.8"/>' +
          '<rect x="23" y="21" width="8" height="5" rx="2" fill="#141210" stroke="#f0c465" stroke-width="1.2"/>' +
          '<rect x="33" y="21" width="8" height="5" rx="2" fill="#141210" stroke="#f0c465" stroke-width="1.2"/>' +
          '<path d="M28 31Q32 33 36 31" stroke="#b8293d" stroke-width="1.8" fill="none"/>' +
        '</svg>'
      );
    }
    return (
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="32" cy="32" r="30" fill="#1d2636"/>' +
        '<path d="M11 58C15 42 23 38 32 38C41 38 49 42 53 58Z" fill="#354d73"/>' +
        '<circle cx="32" cy="25" r="11.5" fill="#d4a887" stroke="#1e1b18" stroke-width="2"/>' +
        '<path d="M26 20L30 29" stroke="#9a2917" stroke-width="1.8"/>' +
        '<circle cx="28" cy="24.5" r="1.6" fill="#1e1b18"/><circle cx="36" cy="24.5" r="1.6" fill="#1e1b18"/>' +
        '<path d="M27 31H37" stroke="#1e1b18" stroke-width="2"/>' +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------------------
   * 3. BILINGUAL UI DICTIONARY (EN + AR)
   * ------------------------------------------------------------------------ */
  var COPY = {
    en: {
      rankLbl: 'Rank',
      spUnit: 'SP',
      promoteNow: 'Promote Lv',
      holdOn: 'Hold Lv ON',
      holdOff: 'Hold Lv OFF',
      homeStoryLink: 'Missions',
      homePerksLink: 'Ranks & Perks',
      missionsHeading: '5-Act Story Campaign & Fixer Contracts',
      missionsSub: '25 bilingual chapters across 5 acts, moral alignment choices, 15E Act Boss encounters & Mission Credits Armory.',
      educationHeading: 'Player Progression, 26-Rank Matrix & 4-Branch Skill Tree',
      educationSub: 'Hold-Level banking, 1→100 unlock milestones, Torn 26-Rank dual triggers, 24 skill nodes & Working Stats.',
      casinoHeading: 'Leslie\'s Spin Wheels & Street Racing Garage',
      casinoSub: '3 daily fortune wheels and 5-class street racing telemetry (Class E → A+).',
      cityHeading: 'City Underworld Spots',
      citySub: 'Zone City Dump scavenging, Duke\'s Harbor Loan Shark & Safari Hunting expeditions.',
      marketHeading: 'Direct Safe Trade Escrow & 0%-Tax Personal Bazaars',
      marketSub: 'Atomic 2-player escrow trades and mug-shielded 0%-fee player storefronts.',
      jobsHeading: 'Player-Directed Companies (1★–10★) & Job Specials',
      jobsSub: 'Found or join player companies, run 15E shifts, manage ad budgets & redeem star specials.',
      propertiesHeading: 'Marriage & Shared Estate Happiness',
      propertiesSub: 'Propose marriage, share top residence happiness & manage spouse estate access.',
      itemsHeading: '9-Slot Tactical Loadout Paperdoll (4 Weapons + 5 Armor)',
      itemsSub: 'Equip Primary, Secondary, Melee, Temporary & 5 ballistic armor slots.',
      factionHeading: 'Faction Empire, Respect Tree, 4-Role Crew OCs & Ranked Wars',
      factionSub: 'Found a $1M faction, upgrade 7 Respect branches, run 4-role heists & fight 48h Ranked Wars.',
      startChap: 'Start Chapter',
      chooseSyndicate: 'Align: Syndicate (Outlaw)',
      chooseDirectorate: 'Align: Directorate (Insider)',
      fightBoss: 'Fight Act Boss (15E)',
      claimChap: 'Claim Chapter Reward',
      agentsTitle: 'NPC Mission Agents & Rotating Contracts',
      acceptContract: 'Accept',
      completeContract: 'Complete & Claim',
      refreshContracts: 'Refresh Agents (10E)',
      armoryShopTitle: 'Mission Credits Armory Shop',
      buyWithCredits: 'Redeem',
      levelHoldTitle: 'Leveling 2.0, Hold-Level Protocol & 1→100 Unlock Roadmap',
      promoteBtn: 'Promote Banked Levels',
      rankMatrixTitle: 'Torn 26-Rank Dual-Trigger Progression Matrix',
      claimRankBtn: 'Claim Rank Promotion',
      skillTreeTitle: '4-Branch Player Skill Tree (24 Nodes & 4 Capstones)',
      unlockNodeBtn: 'Unlock',
      respecTreeBtn: 'Respec Skill Tree',
      masteryTitle: '0-100 Mastery Skills & Working Stats (MAN / INT / END) Trainer',
      trainWorkBtn: 'Train (10E)',
      wheelsTitle: '3 Torn Spin Wheels (Leslie\'s Wheelhouse)',
      spinBtn: 'Spin Wheel',
      dumpTitle: 'Zone City Dump',
      searchDumpBtn: 'Search Dump (5E)',
      tossDumpBtn: 'Toss Item',
      loanTitle: 'Duke\'s Harbor Loan Shark',
      borrowBtn: 'Borrow',
      repayBtn: 'Repay',
      huntTitle: 'Harbor & Safari Hunting',
      huntBtn: 'Launch Hunt',
      racingTitle: 'Garage & 5-Class Street Racing League (Class E → A+)',
      buyCarBtn: 'Buy Car',
      raceTrackBtn: 'Enter Race (10E)',
      tradesTitle: 'Direct 2-Player Safe Trade Escrow',
      openTradeBtn: 'Open Safe Trade',
      escrowCashBtn: 'Escrow Cash',
      escrowItemBtn: 'Escrow Item',
      acceptTradeBtn: 'Accept Trade',
      cancelTradeBtn: 'Cancel & Refund',
      bazaarTitle: '0%-Tax Personal Bazaar & Player Shops',
      toggleBazaarBtn: 'Toggle Open/Closed',
      listBazaarBtn: 'List @ 0% Tax',
      unlistBtn: 'Unlist',
      buyBazaarBtn: 'Buy (0% Tax)',
      companyTitle: 'Player-Directed Companies (1★–10★) & Specials',
      foundCompBtn: 'Found Company ($500k)',
      joinCompBtn: 'Join',
      leaveCompBtn: 'Leave',
      workShiftBtn: 'Work Shift (15E)',
      manageCompBtn: 'Save Ad/Price',
      marriageTitle: 'Marriage & Spouse Property Happiness Sharing',
      proposeBtn: 'Propose ($25k Ring)',
      acceptMarriageBtn: 'Accept Proposal',
      divorceBtn: 'Divorce',
      factionFoundTitle: 'Found Faction ($1,000,000), Directory, Roster & Vault',
      createFactionBtn: 'Found Faction ($1M)',
      joinFactionBtn: 'Join Faction',
      leaveFactionBtn: 'Leave Faction',
      depositVaultBtn: 'Vault Deposit',
      grantVaultBtn: 'Grant Cash',
      setRoleBtn: 'Set Role',
      kickMemberBtn: 'Kick',
      respectTreeTitle: '7-Branch Faction Respect Skill Tree (28 Upgrades)',
      ocTitle: '4-Role Crew Organized Crimes 2.0 Lobby',
      createOcBtn: 'Plan Heist',
      claimSlotBtn: 'Claim Slot',
      executeOcBtn: 'Execute Crew Heist',
      warTitle: '48h Scheduled Ranked Wars & Bonus Weapon Caches',
      enlistWarBtn: 'Enlist Ranked War',
      challengeWarBtn: 'Challenge',
      assaultWarBtn: 'Score War Hit (25E)',
      claimCacheBtn: 'Open RW Cache',
      loadoutTitle: '9-Slot Tactical Loadout Paperdoll (4 Weapons + 5 Armor)',
      equipSlotBtn: 'Equip Slot'
    },
    ar: {
      rankLbl: 'الرتبة',
      spUnit: 'ن.م',
      promoteNow: 'ترقية المستوى',
      holdOn: 'تجميد المستوى مفعّل',
      holdOff: 'تجميد المستوى متوقف',
      homeStoryLink: 'المهمات',
      homePerksLink: 'الرتب والمزايا',
      missionsHeading: 'طور القصة الدرامي (5 فصول) وعقود الوكلاء',
      missionsSub: '25 فصلاً ثنائي اللغة، قرارات التحالف، مواجهات الزعماء ومتجر رصيد المهمات.',
      educationHeading: 'تقدم اللاعب، مصفوفة الـ26 رتبة وشجرة المهارات',
      educationSub: 'تجميد وترقية المستوى، خارطة المزايا 1←100، شجرة المهارات الرباعية وتدريب العمل.',
      casinoHeading: 'عجلات الحظ اليومية وكراج سباقات الشوارع',
      casinoSub: '3 عجلات جوائز يومية ودوري سباقات من 5 فئات (E ← A+).',
      cityHeading: 'مواقع العالم السفلي في المدينة',
      citySub: 'البحث في مكب المدينة، قروض ديوك بالمرفأ ورحلات الصيد والسفاري.',
      marketHeading: 'المقايضة الآمنة والبازارات الشخصية بلا ضريبة (0%)',
      marketSub: 'ضمان مقايضة مباشر بين لاعبين ومتاجر شخصية معفاة من الضرائب.',
      jobsHeading: 'شركات اللاعبين (1★–10★) والمزايا المهنية',
      jobsSub: 'تأسيس أو الانضمام لشركات اللاعبين، ورديات العمل وتفعيل مزايا النجوم.',
      propertiesHeading: 'الزواج ومشاركة معنويات العقار',
      propertiesSub: 'طلب الزواج ومشاركة سقف السعادة لأفضل عقار بين الزوجين.',
      itemsHeading: 'تجهيز العتاد التكتيكي ذو الـ9 خانات (4 أسلحة + 5 دروع)',
      itemsSub: 'تجهيز السلاح الرئيسي والثانوي والاشتباك والمؤقت وخمس خانات دروع.',
      factionHeading: 'إمبراطورية الفاكشن، شجرة الاحترام، السطو الرباعي والحروب المصنفة',
      factionSub: 'تأسيس فاكشن بـ$1M، ترقية 7 فروع احترام، الجرائم المنظمة وحروب الـ48 ساعة.',
      startChap: 'بدء الفصل',
      chooseSyndicate: 'تحالف: النقابة (خارج القانون)',
      chooseDirectorate: 'تحالف: المديرية (نفوذ الدولة)',
      fightBoss: 'قتال زعيم الفصل (15 طاقة)',
      claimChap: 'استلام مكافأة الفصل',
      agentsTitle: 'وكلاء المهمات والعقود المتجددة',
      acceptContract: 'قبول العقد',
      completeContract: 'إنجاز واستلام',
      refreshContracts: 'تحديث العقود (10 طاقة)',
      armoryShopTitle: 'متجر رصيد المهمات الخاص',
      buyWithCredits: 'استبدال',
      levelHoldTitle: 'المستويات 2.0، تجميد المستوى وخارطة فتح المزايا 1←100',
      promoteBtn: 'ترقية المستويات المحفوظة',
      rankMatrixTitle: 'سلم رتب تورن الـ26 ومصفوفة المحفزات المزدوجة',
      claimRankBtn: 'استلام ترقية الرتبة',
      skillTreeTitle: 'شجرة مهارات اللاعب (4 فروع · 24 عقدة · 4 قمم)',
      unlockNodeBtn: 'فتح المهارة',
      respecTreeBtn: 'إعادة توزيع المهارات',
      masteryTitle: 'مهارات الإتقان (0-100) وتدريب إحصاءات العمل (MAN / INT / END)',
      trainWorkBtn: 'تدريب (10 طاقة)',
      wheelsTitle: 'عجلات الحظ الثلاث اليومية',
      spinBtn: 'تدوير العجلة',
      dumpTitle: 'مكب المدينة',
      searchDumpBtn: 'بحث في المكب (5 طاقة)',
      tossDumpBtn: 'رمي في المكب',
      loanTitle: 'قروض القرش ديوك',
      borrowBtn: 'اقتراض',
      repayBtn: 'سداد',
      huntTitle: 'رحلات الصيد البري والسفاري',
      huntBtn: 'انطلاق للصيد',
      racingTitle: 'الكراج ودوري سباقات الشوارع (فئة E ← A+)',
      buyCarBtn: 'شراء السيارة',
      raceTrackBtn: 'دخول السباق (10 طاقة)',
      tradesTitle: 'ضمان المقايضة الآمنة بين لاعبين',
      openTradeBtn: 'فتح مقايضة آمنة',
      escrowCashBtn: 'إيداع نقد بالضمان',
      escrowItemBtn: 'إيداع غرض بالضمان',
      acceptTradeBtn: 'تأكيد المقايضة',
      cancelTradeBtn: 'إلغاء واسترداد',
      bazaarTitle: 'البازار الشخصي (0% ضريبة) ومتاجر اللاعبين',
      toggleBazaarBtn: 'فتح / إغلاق البازار',
      listBazaarBtn: 'عرض بضريبة 0%',
      unlistBtn: 'سحب العرض',
      buyBazaarBtn: 'شراء (0% ضريبة)',
      companyTitle: 'شركات اللاعبين (1★–10★) والمزايا الخاصة',
      foundCompBtn: 'تأسيس شركة ($500k)',
      joinCompBtn: 'انضمام',
      leaveCompBtn: 'مغادرة',
      workShiftBtn: 'عمل وردية (15 طاقة)',
      manageCompBtn: 'حفظ الإعلان والسعر',
      marriageTitle: 'الزواج ومشاركة معنويات العقار',
      proposeBtn: 'طلب زواج (خاتم $25k)',
      acceptMarriageBtn: 'قبول الزواج',
      divorceBtn: 'طلاق',
      factionFoundTitle: 'تأسيس فاكشن ($1,000,000)، الدليل، الرتب والخزنة',
      createFactionBtn: 'تأسيس فاكشن ($1M)',
      joinFactionBtn: 'انضمام للفاكشن',
      leaveFactionBtn: 'مغادرة الفاكشن',
      depositVaultBtn: 'إيداع بالخزنة',
      grantVaultBtn: 'منح نقد لعضو',
      setRoleBtn: 'تعيين رتبة',
      kickMemberBtn: 'طرد',
      respectTreeTitle: 'شجرة احترام الفاكشن السباعية (28 ترقية)',
      ocTitle: 'غرفة الجرائم المنظمة الرباعية 2.0',
      createOcBtn: 'تخطيط عملية',
      claimSlotBtn: 'حجز الدور',
      executeOcBtn: 'تنفيذ السطو الرباعي',
      warTitle: 'الحروب المصنفة (48 ساعة) وصناديق الأسلحة النادرة',
      enlistWarBtn: 'التسجيل بالحرب المصنفة',
      challengeWarBtn: 'تحدي فاكشن',
      assaultWarBtn: 'ضربة حرب (25 طاقة)',
      claimCacheBtn: 'فتح صندوق الحرب',
      loadoutTitle: 'تجهيز العتاد التكتيكي ذو الـ9 خانات (4 أسلحة + 5 دروع)',
      equipSlotBtn: 'تجهيز الخانة'
    }
  };

  /* ------------------------------------------------------------------------
   * 4. RUNTIME STATE STORE & HELPERS
   * ------------------------------------------------------------------------ */
  var feedbackTimer = null;

  var store = {
    activeRoute: '',
    selectedAct: 1,
    selectedChapterId: 'act1_ch1',
    lastScreen: '',
    busy: false,
    spinningWheel: '',
    feedback: null,
    storyCampaign: null,
    playerRpg: null,
    cityActivities: null,
    syndicateEconomy: null,
    factionEmpire: null,
    drafts: {
      dumpItemId: 'glasses',
      dumpQty: '1',
      loanAmount: '25000',
      selectedCarId: 'civic_e',
      tradePartner: 'p-2',
      tradeCash: '10000',
      tradeItemId: 'xanax',
      tradeItemQty: '1',
      bazaarTagline: '0% Tax Syndicate Surplus',
      bazaarItemId: 'xanax',
      bazaarQty: '1',
      bazaarPrice: '800000',
      bazaarBuyQty: '1',
      companyType: 'logistics_corp',
      companyName: 'Harbor Sovereign Corp',
      companyAdBudget: '25000',
      companyPrice: '150',
      spouseTarget: 'p-2',
      facNameEn: 'Iron Lotus Syndicate',
      facNameAr: 'نقابة اللوتس الحديدي',
      facTag: 'ILTS',
      facColor: '#c99227',
      facManifesto: 'Rule the 120 blocks through steel, nerve, and loyalty.',
      facVaultAmt: '50000',
      facTargetMember: '',
      facTargetRole: 'officer',
      ocHeistId: 'armored_van',
      slotItem: {}
    }
  };

  function isAr() {
    var html = document.documentElement;
    return Boolean(html && (html.lang === 'ar' || html.dir === 'rtl'));
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

  function fmtInt(n) {
    var v = Math.round(Number(n) || 0);
    var sign = v < 0 ? '-' : '';
    return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtMoney(n) {
    var v = Math.round(Number(n) || 0);
    if (v < 0) return '-$' + fmtInt(Math.abs(v));
    return '$' + fmtInt(v);
  }

  function fmtClock(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function clearFeedbackTimer() {
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
  }

  function setFeedback(text, tone) {
    clearFeedbackTimer();
    if (!text) {
      store.feedback = null;
      renderAll();
      return;
    }
    store.feedback = { text: String(text), tone: tone || 'sage' };
    renderAll();
    feedbackTimer = window.setTimeout(function () {
      feedbackTimer = null;
      if (store.feedback) {
        store.feedback = null;
        renderRouteSection();
      }
    }, 4000);
  }

  function humanActionLabel(action) {
    var entry = ACTION_HUMAN_LABELS[action];
    if (entry) return isAr() ? entry.ar : entry.en;
    return String(action || '').replace(/[._]/g, ' ');
  }

  async function ensurePlayerSession() {
    if (window.ZoneSession && typeof window.ZoneSession.ensure === 'function') {
      try { await window.ZoneSession.ensure(); } catch (_) {}
    }
  }

  async function apiGet(path) {
    await ensurePlayerSession();
    var res = await window.fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function apiPost(path, body) {
    await ensurePlayerSession();
    var res = await window.fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body || {})
    });
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error((json && (json.error || json.message)) || ('HTTP ' + res.status));
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  }

  function syncGlobalPlayerSnapshot(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (window.ZoneTornLive && typeof window.ZoneTornLive.applySnapshot === 'function' && (payload.player || payload.state)) {
      try { window.ZoneTornLive.applySnapshot(payload); } catch (_) {}
    } else if (window.__zoneGame && payload.player && typeof window.__zoneGame.applyServerPlayer === 'function') {
      try {
        window.__zoneGame.applyServerPlayer(payload.player);
        window.__zoneGame.forceUpdate();
      } catch (_) {}
    }
    if (typeof window.ZoneSyncHudBars === 'function') {
      try {
        window.ZoneSyncHudBars((payload.snapshot && payload.snapshot.player ? payload.snapshot : null) || payload);
      } catch (_) {}
    }
  }

  /* ------------------------------------------------------------------------
   * 5. LOADERS & MUTATION DISPATCHERS FOR ALL 5 BACKEND ENDPOINTS
   * ------------------------------------------------------------------------ */
  async function loadStoryCampaign() {
    try {
      var data = await apiGet('/api/v1/story-campaign');
      if (data) store.storyCampaign = data.snapshot || data;
      return store.storyCampaign;
    } catch (_) { return null; }
  }

  async function loadPlayerRpg() {
    try {
      var data = await apiGet('/api/v1/player-rpg');
      if (data) {
        store.playerRpg = data.snapshot || data;
        if (typeof window.ZoneSyncHudBars === 'function') {
          try { window.ZoneSyncHudBars(store.playerRpg); } catch (_) {}
        }
      }
      return store.playerRpg;
    } catch (_) { return null; }
  }

  async function loadCityActivities() {
    try {
      var data = await apiGet('/api/v1/city-activities');
      if (data) store.cityActivities = data.snapshot || data;
      return store.cityActivities;
    } catch (_) { return null; }
  }

  async function loadSyndicateEconomy() {
    try {
      var data = await apiGet('/api/v1/syndicate-economy');
      if (data) store.syndicateEconomy = data.snapshot || data;
      return store.syndicateEconomy;
    } catch (_) { return null; }
  }

  async function loadFactionEmpire() {
    try {
      var data = await apiGet('/api/v1/faction-empire');
      if (data) store.factionEmpire = data.snapshot || data;
      return store.factionEmpire;
    } catch (_) { return null; }
  }

  function ensureRouteDomainsLoaded(screen) {
    var domains = ROUTE_DOMAINS[screen];
    if (!domains) return;
    for (var i = 0; i < domains.length; i++) {
      var d = domains[i];
      if (d === 'story' && !store.storyCampaign) loadStoryCampaign().then(renderAll);
      else if (d === 'rpg' && !store.playerRpg) loadPlayerRpg().then(renderAll);
      else if (d === 'activities' && !store.cityActivities) loadCityActivities().then(renderAll);
      else if (d === 'economy' && !store.syndicateEconomy) loadSyndicateEconomy().then(renderAll);
      else if (d === 'empire' && !store.factionEmpire) loadFactionEmpire().then(renderAll);
    }
  }

  async function dispatchDomainAction(domain, action, extraPayload) {
    if (store.busy) return null;
    store.busy = true;
    renderAll();

    var endpointMap = {
      story: '/api/v1/story-campaign/action',
      rpg: '/api/v1/player-rpg/action',
      activities: '/api/v1/city-activities/action',
      economy: '/api/v1/syndicate-economy/action',
      empire: '/api/v1/faction-empire/action'
    };
    var url = endpointMap[domain] || '/api/v1/player-rpg/action';
    var reqBody = Object.assign({ action: action }, extraPayload || {});

    try {
      var res = await apiPost(url, reqBody);
      var snap = (res && (res.snapshot || res.data)) || res;
      if (snap && typeof snap === 'object') {
        if (domain === 'story') store.storyCampaign = snap.story || snap.campaign ? snap : (res.storyCampaign || snap);
        else if (domain === 'rpg') store.playerRpg = snap.rank || snap.skillTree || snap.leveling ? snap : (res.playerRpg || snap);
        else if (domain === 'activities') store.cityActivities = snap;
        else if (domain === 'economy') store.syndicateEconomy = snap;
        else if (domain === 'empire') store.factionEmpire = snap;
      }

      if (domain === 'story') await loadStoryCampaign();
      else if (domain === 'rpg') await loadPlayerRpg();
      else if (domain === 'activities') await loadCityActivities();
      else if (domain === 'economy') await loadSyndicateEconomy();
      else if (domain === 'empire') await loadFactionEmpire();

      syncGlobalPlayerSnapshot(res);
      if (window.ZoneAscension && typeof window.ZoneAscension.refresh === 'function') {
        try { window.ZoneAscension.refresh(false); } catch (_) {}
      }

      var r = (res && res.result) || res || {};
      if (window.ZoneEcs3D && typeof window.ZoneEcs3D.triggerStageAction === 'function') {
        try {
          if (domain === 'story') {
            window.ZoneEcs3D.triggerStageAction('combat-arena', action, r);
          } else if (domain === 'activities') {
            if (action === 'wheel.spin') {
              window.ZoneEcs3D.triggerStageAction('casino-royale', action, r);
              window.ZoneEcs3D.triggerStageAction('city-wheels-race', action, r);
            } else if (/^race\.|^hunt\.|^dump\./.test(action)) {
              window.ZoneEcs3D.triggerStageAction('city-wheels-race', action, r);
            }
          } else if (domain === 'empire') {
            if (action === 'loadout.equipSlot') {
              window.ZoneEcs3D.triggerStageAction('paperdoll-armory', action, r);
            } else if (/^oc\.|^war\.|^faction\./.test(action)) {
              window.ZoneEcs3D.triggerStageAction('combat-arena', action, r);
            }
          }
        } catch (_) {}
      }
      var rawMsg = isAr()
        ? (r.messageAr || r.summaryAr || r.message || r.summary || '')
        : (r.messageEn || r.message || r.summary || '');
      if (!rawMsg || rawMsg === action) {
        rawMsg = humanActionLabel(action);
      }
      var extras = [];
      if (Number(r.cashDelta)) extras.push((r.cashDelta > 0 ? '+' : '') + fmtMoney(r.cashDelta));
      if (Number(r.cashAwarded)) extras.push('+' + fmtMoney(r.cashAwarded));
      if (Number(r.spAwarded || r.spDelta)) {
        var spd = Number(r.spAwarded || r.spDelta);
        extras.push((spd > 0 ? '+' : '') + spd + ' SP');
      }
      if (r.prizeLabel || r.prize) {
        extras.push(typeof r.prize === 'object' ? (r.prize.label || r.prize.type || '') : String(r.prizeLabel || r.prize));
      }
      if (r.foundItem || r.itemId) {
        if (action === 'dump.search') extras.push('Found: ' + (r.foundItem || r.itemId));
      }
      var tone = (r.defeat || r.hospitalized || r.success === false) ? 'bad' : (r.capstone || r.promoted || r.cacheOpened ? 'gold' : 'sage');
      setFeedback([rawMsg].concat(extras.filter(Boolean)).join(' · '), tone);
      return res;
    } catch (err) {
      setFeedback((err && err.message) || 'Action rejected by server.', 'bad');
      return null;
    } finally {
      store.busy = false;
      store.spinningWheel = '';
      renderAll();
    }
  }

  /* ------------------------------------------------------------------------
   * 6. NORMALIZED READERS (RESILIENT TO LIVE PHP SNAPSHOT VARIATIONS)
   * ------------------------------------------------------------------------ */
  function getOwnedInventory() {
    var tl = window.ZoneTornLive && typeof window.ZoneTornLive.getStore === 'function' ? window.ZoneTornLive.getStore() : null;
    var snap = (tl && tl.gameplay) || {};
    var g = window.__zoneGame;
    return (snap.state && snap.state.inv) || (g && g.p && g.p.inv) || { xanax: 1, glasses: 1, vest: 1, ak: 1, pistol: 1, knife: 1 };
  }

  function getStorySummary() {
    var ar = isAr();
    var sc = store.storyCampaign || {};
    var chaptersRaw = Array.isArray(sc.chapters) ? sc.chapters : [];
    var actsRaw = Array.isArray(sc.acts) ? sc.acts : [];
    if (!chaptersRaw.length && actsRaw.length) {
      for (var a = 0; a < actsRaw.length; a++) {
        if (Array.isArray(actsRaw[a].chapters)) {
          chaptersRaw = chaptersRaw.concat(actsRaw[a].chapters);
        }
      }
    }
    var byId = {};
    for (var i = 0; i < chaptersRaw.length; i++) {
      var ch = chaptersRaw[i];
      if (ch && ch.id) byId[String(ch.id)] = ch;
    }

    var activeId = String(
      sc.activeChapterId ||
      (sc.banner && sc.banner.activeChapterId) ||
      (sc.activeChapter && sc.activeChapter.id) ||
      sc.currentChapterId ||
      store.selectedChapterId ||
      'act1_ch1'
    );

    var fallbackAct = STORY_ACTS[0];
    var fallbackCh = STORY_ACTS[0].chapters[0];
    for (var ai = 0; ai < STORY_ACTS.length; ai++) {
      for (var ci = 0; ci < STORY_ACTS[ai].chapters.length; ci++) {
        if (STORY_ACTS[ai].chapters[ci].id === activeId) {
          fallbackAct = STORY_ACTS[ai];
          fallbackCh = STORY_ACTS[ai].chapters[ci];
        }
      }
    }

    var srvCh = byId[activeId] || (sc.activeChapter && sc.activeChapter.id === activeId ? sc.activeChapter : null) || {};
    var objs = Array.isArray(srvCh.objectives) ? srvCh.objectives : [
      { id: 'obj_crimes', labelEn: 'Complete street crime operations', labelAr: 'إنجاز عمليات جرائم الشارع', progress: Number(srvCh.objectivesDone || 1), target: 2, done: Boolean(srvCh.completed) }
    ];
    var doneCount = 0;
    for (var oi = 0; oi < objs.length; oi++) {
      var o = objs[oi];
      if (o.done || o.completed || (Number(o.progress || 0) >= Number(o.target || 1))) doneCount++;
    }
    if (srvCh.objectivesDone != null) doneCount = Number(srvCh.objectivesDone);
    var totalCount = Number(srvCh.objectivesTotal || objs.length || 2);

    var actNum = Number(srvCh.act || fallbackAct.act || 1);
    var chNum = Number(srvCh.chapterNumber || srvCh.number || fallbackCh.num || 1);
    var chTitle = ar
      ? (srvCh.titleAr || srvCh.nameAr || fallbackCh.ar)
      : (srvCh.titleEn || srvCh.nameEn || srvCh.title || fallbackCh.en);
    var alignment = String(sc.alignment || (sc.story && sc.story.alignment) || 'unaligned');
    var romanAct = ['I', 'II', 'III', 'IV', 'V'][Math.max(0, Math.min(4, actNum - 1))];

    return {
      byId: byId,
      activeId: activeId,
      actNum: actNum,
      romanAct: romanAct,
      chNum: chNum,
      chTitle: chTitle,
      doneCount: doneCount,
      totalCount: totalCount,
      alignment: alignment,
      compactPill: ar
        ? ('فصل ' + actNum + ' · ف' + chNum + ' (' + doneCount + '/' + totalCount + ')')
        : ('Act ' + romanAct + ' · Ch.' + chNum + ' (' + doneCount + '/' + totalCount + ')'),
      fullLabel: ar
        ? ('الفصل ' + actNum + ' · ف' + chNum + ': ' + chTitle + ' (' + doneCount + '/' + totalCount + ')')
        : ('Act ' + romanAct + ' · Ch.' + chNum + ': ' + chTitle + ' (' + doneCount + '/' + totalCount + ')')
    };
  }

  function getRpgSummary() {
    var ar = isAr();
    var r = store.playerRpg || {};
    var g = window.__zoneGame;
    var tl = window.ZoneTornLive && typeof window.ZoneTornLive.getStore === 'function' ? window.ZoneTornLive.getStore() : null;
    var pRow = r.player || (tl && tl.gameplay && tl.gameplay.player) || (g && g.p) || {};

    var levelObj = r.leveling || r.levelInfo || {};
    var level = Math.max(1, Number(levelObj.level || r.level || pRow.level || 1));
    var potentialLevel = Math.max(level, Number(levelObj.potentialLevel || levelObj.xpLevel || r.potentialLevel || level));
    var pendingLevels = Math.max(0, Number(levelObj.pendingLevels != null ? levelObj.pendingLevels : (r.pendingLevels != null ? r.pendingLevels : (potentialLevel - level))));
    var holdLevel = Boolean(levelObj.holdLevel != null ? levelObj.holdLevel : r.holdLevel);

    var rankObj = r.rank || r.rankLadder || {};
    var rankIndex = Math.max(1, Math.min(26, Number(rankObj.rankNumber || rankObj.index || rankObj.id || r.rankNumber || 1)));
    var defCur = RANKS_26[rankIndex - 1] || RANKS_26[0];
    var defNext = RANKS_26[Math.min(25, rankIndex)] || RANKS_26[25];
    var rankTitle = ar
      ? (rankObj.titleAr || rankObj.nameAr || defCur.ar)
      : (rankObj.titleEn || rankObj.nameEn || rankObj.title || defCur.en);
    var nextRankTitle = ar
      ? (rankObj.nextTitleAr || defNext.ar)
      : (rankObj.nextTitleEn || rankObj.nextTitle || defNext.en);
    var claimableRank = Boolean(rankObj.claimable || Number(rankObj.unclaimedPromotions || rankObj.claimableCount || 0) > 0);
    var triggersTotal = Number(rankObj.totalTriggers != null ? rankObj.totalTriggers : (rankObj.triggers || Math.max(0, rankIndex - 1)));
    var triggerBreakdown = rankObj.breakdown || rankObj.triggerBreakdown || {};

    var stObj = r.skillTree || {};
    var unlockedRaw = stObj.unlockedNodes || stObj.unlocked || r.unlockedSkills || {};
    var unlockedMap = {};
    if (Array.isArray(unlockedRaw)) {
      for (var i = 0; i < unlockedRaw.length; i++) unlockedMap[String(unlockedRaw[i])] = true;
    } else if (unlockedRaw && typeof unlockedRaw === 'object') {
      for (var k in unlockedRaw) {
        if (unlockedRaw[k]) unlockedMap[k] = true;
      }
    }
    var availableSp = Math.max(0, Number(
      stObj.availableSp != null ? stObj.availableSp :
      r.availableSp != null ? r.availableSp :
      r.skillPoints != null ? r.skillPoints : 0
    ));
    var spentSp = Math.max(0, Number(stObj.spentSp != null ? stObj.spentSp : (r.spentSp || Object.keys(unlockedMap).length)));
    var respecCount = Math.max(0, Number(stObj.respecCount || r.respecCount || 0));

    var mastery = r.masterySkills || r.skills || {};
    var workStats = r.workStats || r.workingStats || { man: 25, int: 25, end: 25 };

    return {
      level: level,
      potentialLevel: potentialLevel,
      pendingLevels: pendingLevels,
      holdLevel: holdLevel,
      rankIndex: rankIndex,
      rankTitle: rankTitle,
      nextRankIndex: Math.min(26, rankIndex + 1),
      nextRankTitle: nextRankTitle,
      claimableRank: claimableRank,
      triggersTotal: triggersTotal,
      triggerBreakdown: triggerBreakdown,
      unlockedMap: unlockedMap,
      availableSp: availableSp,
      spentSp: spentSp,
      respecCount: respecCount,
      mastery: mastery,
      workStats: workStats
    };
  }

  /* ------------------------------------------------------------------------
   * 7. COMPACT HUD SLOT (#ztl-hud-story-slot) & SIDEBAR NATIVE STAT ROW
   * ------------------------------------------------------------------------ */
  function removeLegacyClutter() {
    var legacyIds = [
      'zre-mission-banner',
      'zre-sidebar-rank-card',
      'zre-sidebar-rpg-btn',
      'zre-sidebar-empire-btn',
      'zre-quick-rpg-btn',
      'zone-rpg-empire-deck'
    ];
    for (var i = 0; i < legacyIds.length; i++) {
      var el = document.getElementById(legacyIds[i]);
      if (el && el.parentElement) el.parentElement.removeChild(el);
    }
  }

  function ensureHudStorySlot() {
    if (document.querySelector('x-dc')) return null;
    var slot = document.getElementById('ztl-hud-story-slot');
    if (slot) {
      var existingStrip = document.getElementById('zone-torn-hud-strip');
      if (existingStrip && existingStrip.className && existingStrip.className.indexOf('ztl-scope') >= 0) {
        existingStrip.removeAttribute('data-zre-fallback-strip');
      }
      return slot;
    }

    var topbar = document.querySelector('.zone-topbar');
    if (!topbar) return null;

    var strip = document.getElementById('zone-torn-hud-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'zone-torn-hud-strip';
      strip.setAttribute('data-zre-fallback-strip', '1');
      topbar.appendChild(strip);
    } else if (strip.className && strip.className.indexOf('ztl-scope') >= 0) {
      strip.removeAttribute('data-zre-fallback-strip');
    }

    var inner = strip.querySelector('.ztl-hud-inner') || strip;
    slot = document.createElement('span');
    slot.id = 'ztl-hud-story-slot';
    slot.className = 'zre-scope';
    if (inner.children && inner.children.length > 0 && typeof inner.insertBefore === 'function') {
      inner.insertBefore(slot, inner.children[0]);
    } else {
      inner.appendChild(slot);
    }
    return slot;
  }

  function renderHudAndSidebar() {
    removeLegacyClutter();
    var copy = L();
    var st = getStorySummary();
    var rpg = getRpgSummary();

    /* 1) Compact HUD Story + Rank Pills inside #ztl-hud-story-slot */
    var slot = ensureHudStorySlot();
    if (slot) {
      var dotHtml = '';
      if (rpg.availableSp > 0) {
        dotHtml = '<bdi class="zre-hud-sp-dot">+' + rpg.availableSp + ' ' + esc(copy.spUnit) + '</bdi>';
      } else if (rpg.pendingLevels > 0) {
        dotHtml = '<bdi class="zre-hud-sp-dot">+' + rpg.pendingLevels + ' Lv</bdi>';
      } else if (rpg.claimableRank) {
        dotHtml = '<bdi class="zre-hud-sp-dot">★</bdi>';
      }

      var sig = [isAr() ? 'ar' : 'en', st.compactPill, rpg.rankIndex, rpg.rankTitle, rpg.availableSp, rpg.pendingLevels, rpg.claimableRank ? 1 : 0].join('|');
      if (slot.getAttribute('data-zre-sig') !== sig) {
        slot.setAttribute('data-zre-sig', sig);
        slot.innerHTML =
          '<button type="button" id="zre-hud-story-pill" class="zre-hud-pill" data-tone="story" data-zre-act="go-route" data-route="missions" title="' + esc(st.fullLabel) + '">' +
            '<span>' + esc(st.compactPill) + '</span>' +
          '</button>' +
          '<button type="button" id="zre-hud-rank-pill" class="zre-hud-pill" data-tone="rank" data-zre-act="go-route" data-route="education">' +
            '<bdi>#' + rpg.rankIndex + ' ' + esc(rpg.rankTitle) + '</bdi>' +
            dotHtml +
          '</button>';
      }
    }

    /* 2) Whisper-Clean Native Torn Stat Row inside aside.zone-sidebar .zone-profile-body */
    var profileBody = document.querySelector('aside.zone-sidebar .zone-profile-body');
    if (profileBody) {
      var rankRow = document.getElementById('zre-sidebar-rank-row');
      if (!rankRow || rankRow.parentElement !== profileBody) {
        if (rankRow && rankRow.parentElement) rankRow.parentElement.removeChild(rankRow);
        rankRow = document.createElement('div');
        rankRow.id = 'zre-sidebar-rank-row';
        rankRow.className = 'zre-scope';
        profileBody.appendChild(rankRow);
      }
      var sideSig = [isAr() ? 'ar' : 'en', rpg.rankTitle, rpg.availableSp].join('|');
      if (rankRow.getAttribute('data-zre-sig') !== sideSig) {
        rankRow.setAttribute('data-zre-sig', sideSig);
        rankRow.innerHTML =
          '<span class="zre-sidebar-stat-lbl">' + esc(copy.rankLbl) + '</span>' +
          '<button type="button" class="zre-sidebar-stat-link" data-zre-act="go-route" data-route="education">' +
            '<bdi>' + esc(rpg.rankTitle) + '</bdi> · <bdi class="zre-sidebar-sp">' + esc(copy.spUnit) + ': ' + rpg.availableSp + '</bdi>' +
          '</button>';
      }
    }
  }

  /* ------------------------------------------------------------------------
   * 8. 3D ITEM SHOWCASES, AVATARS & ROUTE RENDERERS (1 SECTION PER ROUTE)
   * ------------------------------------------------------------------------ */
  function inferZreItemCategory(itemId, fallbackCat) {
    var k = String(itemId || '').toLowerCase();
    if (/xanax|ecstasy|vicodin|cannabis|lsd|epinephrine/.test(k)) return 'drug';
    if (/bloodbag|blood_bag|morphine|medkit|smallkit|small_medkit|first_aid/.test(k)) return 'medical';
    if (/edvd|fhc|energy_drink|edrink|candy|skill_xp_book/.test(k)) return 'booster';
    if (/kevlar|helmet|vest|armor|boots|gloves|greaves/.test(k)) return 'armor';
    if (/ak|sniper|shotgun|bullpup|assaultrifle|smg|magnum|pistol|revolver|sawedoff|knife|bat|katana|flash_grenade|smoke_grenade|weapon_cache/.test(k)) return 'weapon';
    if (/glasses|lawyer_card|cut_throat_razor|paint_mask|flashlight|duct_tape|high_speed_drive/.test(k)) return 'enhancer';
    if (/plush|flower|orchid|gold_bullion|sports_car|civic|silvia|evo|gtr|gt3|valkyrie/.test(k)) return 'contraband';
    return fallbackCat || 'weapon';
  }

  function render3dItemShowcase(itemId, cat, title) {
    var idStr = String(itemId || 'weapon_cache');
    var resolvedCat = inferZreItemCategory(idStr, cat);
    var lbl = String(title || idStr);
    return (
      '<div class="zre-item-3d-row">' +
        '<div class="z3d-item-slot" data-z3d-item="' + esc(idStr) + '" data-z3d-cat="' + esc(resolvedCat) + '"></div>' +
        '<button type="button" class="zre-btn zre-3d-inspect-btn" data-zre-act="inspect-3d" data-z3d-inspect="' + esc(idStr) + '" data-z3d-cat="' + esc(resolvedCat) + '" data-z3d-title="' + esc(lbl) + '" aria-label="3D ' + esc(lbl) + '">3D</button>' +
      '</div>'
    );
  }

  function renderInlineAvatar(playerId) {
    return '<span class="zpa-inline-avatar" data-zpa-avatar="' + esc(playerId || '') + '"></span>';
  }

  /* Route: home -> Compact 1-Row Character Rank & Hold-Level Summary Strip */
  function renderHomeRoute() {
    var ar = isAr();
    var copy = L();
    var st = getStorySummary();
    var rpg = getRpgSummary();
    var arrow = ar ? '←' : '→';

    return (
      '<div class="zre-home-summary-strip" data-zre-feature="home-rank-strip">' +
        '<div class="zre-home-summary-stats">' +
          '<span class="zre-chip" data-tone="blue">🎖 <bdi>#' + rpg.rankIndex + ' ' + esc(rpg.rankTitle) + '</bdi>' +
            (rpg.rankIndex < 26 ? (' ' + arrow + ' <bdi>#' + rpg.nextRankIndex + ' ' + esc(rpg.nextRankTitle) + '</bdi>') : '') +
          '</span>' +
          '<span class="zre-chip" data-tone="gold">Lv <bdi>' + rpg.level + '</bdi> · ' + esc(rpg.holdLevel ? copy.holdOn : copy.holdOff) + '</span>' +
          '<span class="zre-chip" data-tone="plum"><bdi>' + rpg.availableSp + ' ' + esc(copy.spUnit) + '</bdi></span>' +
          (rpg.pendingLevels > 0
            ? '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="level-promote">⬆ +' + rpg.pendingLevels + ' Lv</button>'
            : '') +
        '</div>' +
        '<div class="zre-home-summary-links">' +
          '<button type="button" class="zre-btn" data-zre-act="go-route" data-route="missions">📖 ' + esc(st.compactPill) + ' ' + arrow + '</button>' +
          '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="go-route" data-route="education">' + esc(copy.homePerksLink) + ' ' + arrow + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* Route: missions -> Story Campaign (Acts I-V · 25 Chapters) + NPC Mission Agents & Armory */
  function renderMissionsRoute() {
    var ar = isAr();
    var copy = L();
    var st = getStorySummary();
    var actSpec = STORY_ACTS[Math.max(0, Math.min(4, store.selectedAct - 1))] || STORY_ACTS[0];

    var actRibbon = '<div class="zre-act-ribbon">';
    for (var a = 0; a < STORY_ACTS.length; a++) {
      var actObj = STORY_ACTS[a];
      var pressed = actObj.act === actSpec.act;
      actRibbon +=
        '<button type="button" class="zre-act-pill" data-zre-act="select-act" data-act="' + actObj.act + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' +
          '<strong style="font-size:13px">' + esc(ar ? actObj.ar : actObj.en) + '</strong>' +
          '<span style="font-size:11px;opacity:0.85">Lv ' + actObj.minLv + '+ · ' + esc(ar ? actObj.bossAr : actObj.bossEn) + '</span>' +
        '</button>';
    }
    actRibbon += '</div>';

    var activeChSpec = actSpec.chapters[0];
    for (var c = 0; c < actSpec.chapters.length; c++) {
      if (actSpec.chapters[c].id === store.selectedChapterId) {
        activeChSpec = actSpec.chapters[c];
        break;
      }
    }

    var chapStrip = '<div class="zre-chapter-strip">';
    for (var ci = 0; ci < actSpec.chapters.length; ci++) {
      var chItem = actSpec.chapters[ci];
      var srvItem = st.byId[chItem.id] || {};
      var isClaimed = Boolean(srvItem.claimed);
      var isSel = chItem.id === activeChSpec.id;
      chapStrip +=
        '<button type="button" class="zre-btn" data-variant="' + (isSel ? 'gold' : '') + '" data-zre-act="select-chapter" data-chapter="' + chItem.id + '">' +
          '<span>' + (isClaimed ? '✓ ' : '') + 'Ch.' + chItem.num + ': ' + esc(ar ? chItem.ar : chItem.en) + '</span>' +
        '</button>';
    }
    chapStrip += '</div>';

    var srvCh = st.byId[activeChSpec.id] || {};
    var npcKey = srvCh.npc || activeChSpec.npc || actSpec.npc;
    var dialogue = ar
      ? (srvCh.dialogueAr || srvCh.storyAr || activeChSpec.dlgAr)
      : (srvCh.dialogueEn || srvCh.dialogue || srvCh.storyEn || activeChSpec.dlgEn);
    var bossName = ar
      ? (srvCh.bossNameAr || actSpec.bossAr)
      : (srvCh.bossNameEn || srvCh.bossName || actSpec.bossEn);
    var bossDefeated = Boolean(srvCh.bossDefeated);
    var hasBoss = Boolean(srvCh.hasBoss != null ? srvCh.hasBoss : activeChSpec.boss);
    var hasChoice = Boolean(srvCh.hasChoice != null ? srvCh.hasChoice : activeChSpec.choice);
    var chosenBranch = srvCh.choice || (st.alignment !== 'unaligned' ? st.alignment : '');

    var objs = Array.isArray(srvCh.objectives) && srvCh.objectives.length
      ? srvCh.objectives
      : [
          { labelEn: 'Run street operations & build heat', labelAr: 'تنفيذ عمليات ميدانية في الشارع', progress: st.doneCount, target: st.totalCount, done: st.doneCount >= st.totalCount },
          { labelEn: 'Prepare combat kit & syndicate reserves', labelAr: 'تجهيز العتاد القتالي واحتياطي النقابة', progress: 1, target: 1, done: true }
        ];
    var objHtml = '<div class="zre-obj-list">';
    for (var oi = 0; oi < objs.length; oi++) {
      var ob = objs[oi];
      var obDone = Boolean(ob.done || ob.completed || Number(ob.progress || 0) >= Number(ob.target || 1));
      var obLbl = ar ? (ob.labelAr || ob.descriptionAr || ob.labelEn || ob.label) : (ob.labelEn || ob.descriptionEn || ob.label || 'Objective');
      objHtml +=
        '<div class="zre-obj-item" data-done="' + (obDone ? 'true' : 'false') + '">' +
          '<span>' + (obDone ? '✓ ' : '○ ') + esc(obLbl) + '</span>' +
          '<bdi>' + Number(ob.progress != null ? ob.progress : (obDone ? 1 : 0)) + ' / ' + Number(ob.target || 1) + '</bdi>' +
        '</div>';
    }
    objHtml += '</div>';

    var choiceHtml = hasChoice
      ? '<div class="zre-row-actions">' +
          '<button type="button" class="zre-btn" data-variant="' + (chosenBranch === 'syndicate' ? 'danger' : '') + '" data-zre-act="story-choice" data-chapter="' + esc(activeChSpec.id) + '" data-choice="syndicate"' + (store.busy ? ' disabled' : '') + '>⚔ ' + esc(copy.chooseSyndicate) + '</button>' +
          '<button type="button" class="zre-btn" data-variant="' + (chosenBranch === 'directorate' ? 'primary' : '') + '" data-zre-act="story-choice" data-chapter="' + esc(activeChSpec.id) + '" data-choice="directorate"' + (store.busy ? ' disabled' : '') + '>🏛 ' + esc(copy.chooseDirectorate) + '</button>' +
          (chosenBranch ? '<span class="zre-chip" data-tone="gold">Alignment: ' + esc(String(chosenBranch).toUpperCase()) + '</span>' : '') +
        '</div>'
      : '';

    var stageHtml =
      '<div class="zre-story-stage" data-chapter-stage="' + esc(activeChSpec.id) + '">' +
        '<div class="zre-npc-frame">' +
          '<div class="zre-npc-portrait">' + renderNpcPortrait(npcKey) + '</div>' +
          '<strong style="font-size:12.5px">' + esc(String(npcKey).toUpperCase()) + '</strong>' +
          '<span class="zre-chip" data-tone="gold">Act ' + actSpec.act + ' · Ch.' + activeChSpec.num + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<div class="zre-card-top">' +
            '<h4 class="zre-card-title" style="margin:0">' + esc(ar ? activeChSpec.ar : activeChSpec.en) + '</h4>' +
            '<span class="zre-chip" data-tone="plum">+Cash · +XP · +SP · +Merit</span>' +
          '</div>' +
          '<div class="zre-dialogue-bubble">' + esc(dialogue) + '</div>' +
          objHtml +
          choiceHtml +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-zre-act="story-start" data-chapter="' + esc(activeChSpec.id) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.startChap) + '</button>' +
            (hasBoss
              ? '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="story-boss" data-chapter="' + esc(activeChSpec.id) + '"' + (store.busy ? ' disabled' : '') + '>⚔ ' + esc(copy.fightBoss) + ' · ' + esc(bossName) + (bossDefeated ? ' ✓' : '') + '</button>'
              : '') +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="story-claim" data-chapter="' + esc(activeChSpec.id) + '"' + (store.busy || srvCh.claimed ? ' disabled' : '') + '>' +
              (srvCh.claimed ? '✓ Claimed' : ('★ ' + esc(copy.claimChap))) +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var ca = store.cityActivities || {};
    var ma = ca.missionAgents || ca.agents || {};
    var credits = Math.max(0, Number(ma.missionCredits != null ? ma.missionCredits : (ca.missionCredits || 0)));
    var contracts = Array.isArray(ma.contracts) ? ma.contracts : (Array.isArray(ca.contracts) ? ca.contracts : [
      { id: 'ag_easy', tier: 'Easy', agent: 'Duke', titleEn: 'Harbor Shakedown (3 Crimes)', titleAr: 'ابتزاز المرفأ (3 جرائم)', progress: 2, target: 3, credits: 18, cash: 15000, accepted: true },
      { id: 'ag_med', tier: 'Medium', agent: 'Layla', titleEn: 'Iron Conditioning (5 Gym Reps)', titleAr: 'تدريب الحديد (5 تمارين)', progress: 3, target: 5, credits: 35, cash: 40000, accepted: false },
      { id: 'ag_hard', tier: 'Hard', agent: 'Mayor Tariq', titleEn: 'Syndicate Enforcer (2 PvP/NPC Wins)', titleAr: 'منفذ النقابة (انتصاران)', progress: 1, target: 2, credits: 65, cash: 95000, accepted: false }
    ]);

    var contractsHtml = '<div class="zre-grid-3">';
    for (var k = 0; k < contracts.length; k++) {
      var ct = contracts[k];
      var cid = String(ct.id || ct.contractId || ('c_' + k));
      var cTitle = ar ? (ct.titleAr || ct.nameAr || ct.titleEn || ct.title || cid) : (ct.titleEn || ct.nameEn || ct.title || cid);
      var cProg = Math.max(0, Number(ct.progress || 0));
      var cTarg = Math.max(1, Number(ct.target || 1));
      var cPct = Math.min(100, Math.round((cProg / cTarg) * 100));
      var cCred = Number(ct.credits || ct.missionCredits || 25);
      contractsHtml +=
        '<article class="zre-card">' +
          '<div class="zre-card-top">' +
            '<span class="zre-chip" data-tone="gold">' + esc(ct.tier || 'Contract') + ' · ' + esc(ct.agent || 'Fixer') + '</span>' +
            '<bdi class="zre-chip" data-tone="plum">+' + cCred + ' Credits</bdi>' +
          '</div>' +
          '<div class="zre-card-title">' + esc(cTitle) + '</div>' +
          '<div class="zre-meter">' +
            '<div class="zre-meter-row"><span>' + fmtMoney(ct.cash || ct.rewardCash || 20000) + '</span><bdi>' + cProg + ' / ' + cTarg + '</bdi></div>' +
            '<div class="zre-meter-track"><div class="zre-meter-fill" style="width:' + cPct + '%"></div></div>' +
          '</div>' +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-zre-act="agent-accept" data-id="' + esc(cid) + '"' + (store.busy || ct.accepted || ct.completed ? ' disabled' : '') + '>' + esc(ct.accepted ? 'Accepted ✓' : copy.acceptContract) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="agent-complete" data-id="' + esc(cid) + '"' + (store.busy || ct.completed ? ' disabled' : '') + '>' + esc(ct.completed ? 'Done ✓' : copy.completeContract) + '</button>' +
          '</div>' +
        '</article>';
    }
    contractsHtml += '</div>';

    var shopItems = Array.isArray(ma.armoryShop || ma.shop) && (ma.armoryShop || ma.shop).length
      ? (ma.armoryShop || ma.shop)
      : MISSION_SHOP_REWARDS;
    var shopHtml = '<div class="zre-grid-auto">';
    for (var si = 0; si < shopItems.length; si++) {
      var sh = shopItems[si];
      var sid = String(sh.id || sh.rewardId || sh.itemId);
      var scost = Number(sh.cost || sh.credits || 25);
      var shTitle = ar ? (sh.ar || sh.nameAr || sh.nameEn || sh.en || sid) : (sh.en || sh.nameEn || sh.name || sid);
      shopHtml +=
        '<div class="zre-card" data-zre-armory-item="' + esc(sid) + '">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(shTitle) + '</span>' +
            '<bdi class="zre-chip" data-tone="plum">' + scost + ' Cr</bdi>' +
          '</div>' +
          render3dItemShowcase(sid, null, shTitle) +
          '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="agent-buy" data-id="' + esc(sid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.buyWithCredits) + ' (' + scost + ' Cr)</button>' +
        '</div>';
    }
    shopHtml += '</div>';

    return (
      '<div class="zre-workspace" data-zre-feature="story-campaign">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.missionsHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.missionsSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="gold">' + esc(st.compactPill) + '</span>' +
        '</header>' +
        '<section class="zre-section">' +
          actRibbon +
          chapStrip +
          '<div class="z3d-action-stage zre-3d-stage" data-z3d-stage="combat-arena" style="height:210px;margin-bottom:10px"></div>' +
          stageHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.agentsTitle) + '</h3>' +
            '<div class="zre-row-actions">' +
              '<span class="zre-chip" data-tone="plum">Mission Credits: <bdi>' + fmtInt(credits) + '</bdi></span>' +
              '<button type="button" class="zre-btn" data-zre-act="agent-refresh"' + (store.busy ? ' disabled' : '') + '>↻ ' + esc(copy.refreshContracts) + '</button>' +
            '</div>' +
          '</div>' +
          contractsHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.armoryShopTitle) + '</h3></div>' +
          shopHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route: education -> Skill Tree, 26-Rank Matrix, Hold-Level, Mastery & Working Stats */
  function renderEducationRoute() {
    var ar = isAr();
    var copy = L();
    var rpg = getRpgSummary();

    var roadHtml = '<div class="zre-roadmap-grid">';
    for (var ri = 0; ri < LEVEL_ROADMAP.length; ri++) {
      var rm = LEVEL_ROADMAP[ri];
      var unlocked = rpg.level >= rm.lv;
      roadHtml +=
        '<div class="zre-card" data-highlight="' + (unlocked ? 'sage' : '') + '">' +
          '<div class="zre-card-top">' +
            '<bdi class="zre-chip" data-tone="' + (unlocked ? 'sage' : 'gold') + '">Lv ' + rm.lv + '</bdi>' +
            '<span>' + (unlocked ? '✓' : '🔒') + '</span>' +
          '</div>' +
          '<div class="zre-card-meta">' + esc(ar ? rm.ar : rm.en) + '</div>' +
        '</div>';
    }
    roadHtml += '</div>';

    var treeHtml = '<div class="zre-skill-branches">';
    for (var bi = 0; bi < SKILL_BRANCHES.length; bi++) {
      var br = SKILL_BRANCHES[bi];
      treeHtml +=
        '<div class="zre-branch-col" data-branch="' + br.id + '">' +
          '<div class="zre-branch-head">' +
            '<span class="zre-chip" data-tone="' + br.tone + '">' + esc(ar ? br.ar : br.en) + '</span>' +
          '</div>';
      for (var ni = 0; ni < br.nodes.length; ni++) {
        var nd = br.nodes[ni];
        var isUnlocked = Boolean(rpg.unlockedMap[nd.id]);
        var parentOk = !nd.parent || Boolean(rpg.unlockedMap[nd.parent]);
        var nodeState = isUnlocked ? 'unlocked' : (parentOk ? 'available' : 'locked');
        if (ni > 0) {
          treeHtml += '<div class="zre-node-connector" data-lit="' + (isUnlocked || parentOk ? 'true' : 'false') + '"></div>';
        }
        treeHtml +=
          '<div class="zre-skill-node" data-node="' + nd.id + '" data-state="' + nodeState + '" data-capstone="' + (nd.capstone ? 'true' : 'false') + '">' +
            '<div class="zre-card-top">' +
              '<strong style="font-size:13px">' + esc(ar ? nd.ar : nd.en) + '</strong>' +
              '<bdi class="zre-chip" data-tone="' + (isUnlocked ? 'sage' : 'plum') + '">' + (isUnlocked ? '✓' : (nd.sp + ' SP')) + '</bdi>' +
            '</div>' +
            '<span class="zre-card-meta">' + esc(ar ? nd.effAr : nd.effEn) + '</span>' +
            (!isUnlocked
              ? '<button type="button" class="zre-btn" data-variant="' + (parentOk && rpg.availableSp >= nd.sp ? 'primary' : '') + '" data-zre-act="skill-unlock" data-node="' + nd.id + '" data-branch="' + br.id + '"' + (!parentOk || rpg.availableSp < nd.sp || store.busy ? ' disabled' : '') + '>' + esc(copy.unlockNodeBtn) + ' (' + nd.sp + ' SP)</button>'
              : '') +
          '</div>';
      }
      treeHtml += '</div>';
    }
    treeHtml += '</div>';

    var mastHtml = '<div class="zre-grid-3">';
    for (var mi = 0; mi < MASTERY_SKILLS.length; mi++) {
      var ms = MASTERY_SKILLS[mi];
      var mVal = Math.max(0, Math.min(100, Math.round(Number(rpg.mastery[ms.key] || 0))));
      mastHtml +=
        '<div class="zre-card">' +
          '<div class="zre-meter-row"><span>' + esc(ar ? ms.ar : ms.en) + '</span><bdi>' + mVal + ' / 100</bdi></div>' +
          '<div class="zre-meter-track"><div class="zre-meter-fill" data-tone="blue" style="width:' + mVal + '%"></div></div>' +
        '</div>';
    }
    mastHtml += '</div>';

    var wsList = [
      { id: 'man', en: 'MAN · Manual Labor', ar: 'MAN · العمل اليدوي', val: Number(rpg.workStats.man || 0) },
      { id: 'int', en: 'INT · Intelligence', ar: 'INT · الذكاء التحليلي', val: Number(rpg.workStats.int || 0) },
      { id: 'end', en: 'END · Endurance', ar: 'END · التحمّل المهني', val: Number(rpg.workStats.end || 0) }
    ];
    var workHtml = '<div class="zre-grid-3">';
    for (var wi = 0; wi < wsList.length; wi++) {
      var ws = wsList[wi];
      workHtml +=
        '<div class="zre-card">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(ar ? ws.ar : ws.en) + '</span>' +
            '<bdi class="zre-chip" data-tone="gold">' + fmtInt(ws.val) + '</bdi>' +
          '</div>' +
          '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="work-train" data-stat="' + ws.id + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.trainWorkBtn) + '</button>' +
        '</div>';
    }
    workHtml += '</div>';

    var tb = rpg.triggerBreakdown;
    return (
      '<div class="zre-workspace" data-zre-feature="skill-tree">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.educationHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.educationSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="plum"><bdi>' + rpg.availableSp + ' ' + esc(copy.spUnit) + '</bdi></span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.skillTreeTitle) + '</h3>' +
            '<div class="zre-row-actions">' +
              '<span class="zre-chip" data-tone="plum">Available: <bdi>' + rpg.availableSp + ' SP</bdi> · Spent: <bdi>' + rpg.spentSp + ' SP</bdi></span>' +
              '<button type="button" class="zre-btn" data-zre-act="skill-respec"' + (rpg.spentSp <= 0 || store.busy ? ' disabled' : '') + '>↺ ' + esc(copy.respecTreeBtn) + ' (' + (rpg.respecCount === 0 ? 'FREE' : '100 pts') + ')</button>' +
            '</div>' +
          '</div>' +
          treeHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.rankMatrixTitle) + '</h3>' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="rank-claim"' + (store.busy ? ' disabled' : '') + '>🎖 ' + esc(copy.claimRankBtn) + '</button>' +
          '</div>' +
          '<div class="zre-card" data-highlight="gold">' +
            '<div class="zre-card-top">' +
              '<span class="zre-card-title">#' + rpg.rankIndex + ' ' + esc(rpg.rankTitle) + ' → #' + rpg.nextRankIndex + ' ' + esc(rpg.nextRankTitle) + '</span>' +
              '<bdi class="zre-chip" data-tone="blue">Triggers: ' + rpg.triggersTotal + ' / 25</bdi>' +
            '</div>' +
            '<div class="zre-row-actions">' +
              '<span class="zre-chip">Level Triggers: <bdi>' + Number(tb.level || tb.levelTriggers || 0) + '</bdi></span>' +
              '<span class="zre-chip">Battle Triggers: <bdi>' + Number(tb.battleStats || tb.battleStatTriggers || 0) + '</bdi></span>' +
              '<span class="zre-chip">Networth Triggers: <bdi>' + Number(tb.networth || tb.networthTriggers || 0) + '</bdi></span>' +
              '<span class="zre-chip">Crime Triggers: <bdi>' + Number(tb.crimes || tb.crimeTriggers || 0) + '</bdi></span>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.levelHoldTitle) + '</h3>' +
            '<div class="zre-row-actions">' +
              '<span class="zre-chip" data-tone="gold">Lv <bdi>' + rpg.level + '</bdi> (Banked: <bdi>+' + rpg.pendingLevels + '</bdi>)</span>' +
              '<button type="button" class="zre-btn" data-variant="' + (rpg.holdLevel ? 'gold' : '') + '" data-zre-act="level-toggle-hold" data-enabled="' + (rpg.holdLevel ? '0' : '1') + '"' + (store.busy ? ' disabled' : '') + '>⏸ ' + esc(rpg.holdLevel ? copy.holdOn : copy.holdOff) + '</button>' +
              '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="level-promote"' + (rpg.pendingLevels <= 0 || store.busy ? ' disabled' : '') + '>⬆ ' + esc(copy.promoteBtn) + ' (+' + rpg.pendingLevels + ')</button>' +
            '</div>' +
          '</div>' +
          roadHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.masteryTitle) + '</h3></div>' +
          workHtml +
          mastHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route: casino -> 3 Daily Spin Wheels & Street Racing Garage */
  function renderCasinoRoute() {
    var ar = isAr();
    var copy = L();
    var ca = store.cityActivities || {};

    var wheelsHtml = '<div class="zre-grid-3">';
    for (var wi = 0; wi < SPIN_WHEELS.length; wi++) {
      var wh = SPIN_WHEELS[wi];
      var isSpin = store.spinningWheel === wh.id;
      wheelsHtml +=
        '<article class="zre-card" data-highlight="gold">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(ar ? wh.ar : wh.en) + '</span>' +
            '<bdi class="zre-chip" data-tone="' + wh.tone + '">' + fmtMoney(wh.cost) + '</bdi>' +
          '</div>' +
          '<div class="zre-wheel-disc' + (isSpin ? ' is-spinning' : '') + '">' +
            '<svg width="52" height="52" viewBox="0 0 54 54" aria-hidden="true">' +
              '<circle cx="27" cy="27" r="24" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
              '<path d="M27 3V51M3 27H51M10 10L44 44M44 10L10 44" stroke="currentColor" stroke-width="1.4"/>' +
              '<circle cx="27" cy="27" r="6" fill="#f0c465" stroke="#1e1b18" stroke-width="1.5"/>' +
            '</svg>' +
          '</div>' +
          '<span class="zre-card-meta">' + esc(ar ? wh.prizeAr : wh.prizeEn) + '</span>' +
          '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="wheel-spin" data-wheel="' + wh.id + '"' + (store.busy ? ' disabled' : '') + '>🎡 ' + esc(copy.spinBtn) + ' (' + fmtMoney(wh.cost) + ')</button>' +
        '</article>';
    }
    wheelsHtml += '</div>';

    var rc = ca.racing || {};
    var racingPts = Math.max(0, Number(rc.racingPoints != null ? rc.racingPoints : (ca.racingPoints || 0)));
    var ownedCars = rc.ownedCars || rc.cars || {};
    var activeCar = String(rc.activeCarId || store.drafts.selectedCarId || 'civic_e');

    var carsHtml = '<div class="zre-grid-3">';
    for (var ci = 0; ci < RACING_CARS.length; ci++) {
      var car = RACING_CARS[ci];
      var hasCar = Boolean(Array.isArray(ownedCars) ? ownedCars.some(function (x) { return (x.id || x) === car.id; }) : ownedCars[car.id]);
      carsHtml +=
        '<div class="zre-card" data-highlight="' + (activeCar === car.id ? 'gold' : '') + '">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(ar ? car.ar : car.en) + '</span>' +
            '<bdi class="zre-chip" data-tone="' + (hasCar ? 'sage' : 'gold') + '">' + (hasCar ? 'Owned ✓' : fmtMoney(car.price)) + '</bdi>' +
          '</div>' +
          render3dItemShowcase('sports_car', 'contraband', ar ? car.ar : car.en) +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-variant="' + (hasCar ? '' : 'primary') + '" data-zre-act="race-buy-car" data-car="' + car.id + '" data-owned="' + (hasCar ? '1' : '0') + '"' + (store.busy ? ' disabled' : '') + '>' + esc(hasCar ? 'Select Car' : copy.buyCarBtn) + '</button>' +
          '</div>' +
        '</div>';
    }
    carsHtml += '</div>';

    var partsHtml = '<div class="zre-row-actions">';
    for (var pi = 0; pi < TUNING_PARTS.length; pi++) {
      var pt = TUNING_PARTS[pi];
      partsHtml +=
        '<button type="button" class="zre-btn" data-zre-act="race-upgrade" data-car="' + esc(activeCar) + '" data-part="' + pt.id + '"' + (store.busy ? ' disabled' : '') + '>🔧 ' + esc(ar ? pt.ar : pt.en) + ' (' + pt.pts + ' RP)</button>';
    }
    partsHtml += '</div>';

    var tracksHtml = '<div class="zre-grid-3">';
    for (var ti = 0; ti < RACING_TRACKS.length; ti++) {
      var tr = RACING_TRACKS[ti];
      tracksHtml +=
        '<div class="zre-card">' +
          '<span class="zre-card-title">🏁 ' + esc(ar ? tr.ar : tr.en) + '</span>' +
          '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="race-track" data-track="' + tr.id + '" data-car="' + esc(activeCar) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.raceTrackBtn) + '</button>' +
        '</div>';
    }
    tracksHtml += '</div>';

    return (
      '<div class="zre-workspace" data-zre-feature="wheels-racing">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.casinoHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.casinoSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="plum">RP: <bdi>' + fmtInt(racingPts) + '</bdi></span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.wheelsTitle) + '</h3></div>' +
          '<div class="z3d-action-stage zre-3d-stage" data-z3d-stage="' + (typeof document !== 'undefined' && document.getElementById('dc-root') ? 'city-wheels-race' : 'casino-royale') + '" style="height:200px;margin-bottom:10px"></div>' +
          wheelsHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.racingTitle) + '</h3>' +
            '<span class="zre-chip" data-tone="plum">Active Car: <bdi>' + esc(activeCar) + '</bdi> · Racing Pts: <bdi>' + fmtInt(racingPts) + ' RP</bdi></span>' +
          '</div>' +
          carsHtml +
          partsHtml +
          tracksHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route: city -> Sleek 3-Card City Underworld Spots BELOW 3D City Map */
  function renderCityRoute() {
    var ar = isAr();
    var copy = L();
    var ca = store.cityActivities || {};
    var inv = getOwnedInventory();
    var invKeys = Object.keys(inv).filter(function (k) { return Number(inv[k]) > 0; });
    if (!invKeys.length) invKeys = ['glasses', 'xanax', 'bloodbag', 'pistol'];

    var loan = ca.loanShark || ca.loan || {};
    var owed = Math.max(0, Number(loan.totalOwed != null ? loan.totalOwed : (loan.principal || loan.owed || loan.balance || 0)));
    var maxLoan = Math.max(25000, Number(loan.maxLoan || loan.creditLimit || 250000));
    var dukeHeat = Boolean(ca.dukeEnforcerHeat || loan.dukeEnforcerHeat || loan.overdue);
    var dumpPoolCount = Number((ca.dump && ca.dump.poolSize) || ca.dumpCount || 18);

    var invOpts = '';
    for (var ii = 0; ii < invKeys.length; ii++) {
      var ik = invKeys[ii];
      invOpts += '<option value="' + esc(ik) + '"' + (store.drafts.dumpItemId === ik ? ' selected' : '') + '>' + esc(ik) + ' (x' + Number(inv[ik] || 1) + ')</option>';
    }

    var rpg = getRpgSummary();
    var huntSkill = Math.max(0, Math.min(100, Math.round(Number((ca.hunting && ca.hunting.skill) != null ? ca.hunting.skill : (rpg.mastery.hunting || 0)))));
    var huntBtns = '<div class="zre-row-actions">';
    for (var hi = 0; hi < HUNT_MODES.length; hi++) {
      var hm = HUNT_MODES[hi];
      var locked = huntSkill < hm.minSkill;
      huntBtns +=
        '<button type="button" class="zre-btn" data-variant="' + (hi === 0 ? 'primary' : '') + '" data-zre-act="hunt-go" data-mode="' + hm.id + '"' + (locked || store.busy ? ' disabled' : '') + '>🏹 ' + esc(ar ? hm.ar : hm.en) + ' (' + hm.energy + 'E)</button>';
    }
    huntBtns += '</div>';

    return (
      '<div class="zre-workspace" data-zre-feature="city-underworld">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.cityHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.citySub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="sage">3 Spots</span>' +
        '</header>' +
        '<div class="z3d-action-stage zre-3d-stage" data-z3d-stage="city-wheels-race" style="height:210px;margin-bottom:10px"></div>' +
        '<div class="zre-grid-3">' +
          '<section class="zre-section">' +
            '<div class="zre-section-head">' +
              '<h3 class="zre-section-title">' + esc(copy.dumpTitle) + '</h3>' +
              '<bdi class="zre-chip" data-tone="gold">Pool: ' + dumpPoolCount + '</bdi>' +
            '</div>' +
            render3dItemShowcase(store.drafts.dumpItemId || invKeys[0] || 'glasses', null, copy.dumpTitle) +
            '<div class="zre-row-actions">' +
              '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="dump-search"' + (store.busy ? ' disabled' : '') + '>🗑 ' + esc(copy.searchDumpBtn) + '</button>' +
            '</div>' +
            '<div class="zre-row-actions">' +
              '<select class="zre-select" data-zre-draft="dumpItemId">' + invOpts + '</select>' +
              '<input type="number" min="1" class="zre-input zre-input-sm" data-zre-draft="dumpQty" value="' + esc(store.drafts.dumpQty) + '">' +
              '<button type="button" class="zre-btn" data-zre-act="dump-toss"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.tossDumpBtn) + '</button>' +
            '</div>' +
          '</section>' +
          '<section class="zre-section">' +
            '<div class="zre-section-head">' +
              '<h3 class="zre-section-title">' + esc(copy.loanTitle) + '</h3>' +
              '<span class="zre-chip" data-tone="' + (dukeHeat ? 'crimson' : 'gold') + '">' + (dukeHeat ? '🔥 HEAT!' : ('Owed: ' + fmtMoney(owed))) + '</span>' +
            '</div>' +
            '<span class="zre-section-note">Cap: <bdi>' + fmtMoney(maxLoan) + '</bdi> · 5% Vigorish</span>' +
            '<div class="zre-row-actions">' +
              '<input type="number" min="1000" step="5000" class="zre-input zre-input-sm" data-zre-draft="loanAmount" value="' + esc(store.drafts.loanAmount) + '">' +
              '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="loan-borrow"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.borrowBtn) + '</button>' +
              '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="loan-repay"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.repayBtn) + '</button>' +
            '</div>' +
          '</section>' +
          '<section class="zre-section">' +
            '<div class="zre-section-head">' +
              '<h3 class="zre-section-title">' + esc(copy.huntTitle) + '</h3>' +
              '<span class="zre-chip" data-tone="sage">Skill: <bdi>' + huntSkill + '/100</bdi></span>' +
            '</div>' +
            '<div class="zre-meter-track"><div class="zre-meter-fill" style="width:' + huntSkill + '%"></div></div>' +
            huntBtns +
          '</section>' +
        '</div>' +
      '</div>'
    );
  }

  /* Route: market -> Direct 2-Player Safe Trade Escrow & 0%-Tax Personal Bazaars */
  function renderMarketRoute() {
    var copy = L();
    var se = store.syndicateEconomy || {};
    var inv = getOwnedInventory();
    var invKeys = Object.keys(inv).filter(function (k) { return Number(inv[k]) > 0; });
    if (!invKeys.length) invKeys = ['xanax', 'edvd', 'bloodbag', 'glasses'];

    var itemOpts = '';
    for (var ii = 0; ii < invKeys.length; ii++) {
      var ik = invKeys[ii];
      itemOpts += '<option value="' + esc(ik) + '">' + esc(ik) + ' (x' + Number(inv[ik] || 1) + ')</option>';
    }

    var trades = Array.isArray(se.trades) ? se.trades : (se.trades && Array.isArray(se.trades.active) ? se.trades.active : []);
    var tradesListHtml = '';
    for (var tj = 0; tj < trades.length; tj++) {
      var tr2 = trades[tj];
      var tid2 = String(tr2.id || tr2.tradeId || ('tr_' + tj));
      tradesListHtml +=
        '<div class="zre-card" data-highlight="gold">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">Escrow #' + esc(tid2.slice(0, 8)) + ' ↔ ' + esc(tr2.partnerId || tr2.partnerName || 'Operative') + '</span>' +
            '<span class="zre-chip" data-tone="sage">' + esc(tr2.status || 'open') + '</span>' +
          '</div>' +
          render3dItemShowcase(store.drafts.tradeItemId || invKeys[0] || 'xanax', null, store.drafts.tradeItemId || invKeys[0] || 'xanax') +
          '<div class="zre-row-actions">' +
            '<input type="number" min="100" class="zre-input zre-input-sm" data-zre-draft="tradeCash" value="' + esc(store.drafts.tradeCash) + '">' +
            '<button type="button" class="zre-btn" data-zre-act="trade-add-cash" data-trade="' + esc(tid2) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.escrowCashBtn) + '</button>' +
            '<select class="zre-select" data-zre-draft="tradeItemId">' + itemOpts + '</select>' +
            '<button type="button" class="zre-btn" data-zre-act="trade-add-item" data-trade="' + esc(tid2) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.escrowItemBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="trade-accept" data-trade="' + esc(tid2) + '"' + (store.busy ? ' disabled' : '') + '>✓ ' + esc(copy.acceptTradeBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="trade-cancel" data-trade="' + esc(tid2) + '"' + (store.busy ? ' disabled' : '') + '>✕ ' + esc(copy.cancelTradeBtn) + '</button>' +
          '</div>' +
        '</div>';
    }

    var bz = se.bazaar || se.myBazaar || {};
    var bzOpen = Boolean(bz.open);
    var listings = Array.isArray(se.bazaarListings)
      ? se.bazaarListings
      : (Array.isArray(bz.listings) ? bz.listings : (Array.isArray(se.publicListings) ? se.publicListings : []));
    var listHtml = '<div class="zre-grid-auto">';
    for (var li = 0; li < listings.length; li++) {
      var ls = listings[li];
      var lid = String(ls.id || ls.listingId || ('lst_' + li));
      var lItemId = String(ls.itemId || ls.name || 'xanax');
      listHtml +=
        '<div class="zre-card" data-zre-bazaar-item="' + esc(lItemId) + '">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(ls.itemId || ls.name || lid) + ' (x' + Number(ls.quantity || 1) + ')</span>' +
            '<bdi class="zre-chip" data-tone="gold">' + fmtMoney(ls.unitPrice || ls.price || 1000) + '</bdi>' +
          '</div>' +
          render3dItemShowcase(lItemId, null, ls.name || lItemId) +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="bazaar-buy" data-listing="' + esc(lid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.buyBazaarBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-zre-act="bazaar-unlist" data-listing="' + esc(lid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.unlistBtn) + '</button>' +
          '</div>' +
        '</div>';
    }
    listHtml += '</div>';

    var draftBazItem = store.drafts.bazaarItemId || invKeys[0] || 'xanax';

    return (
      '<div class="zre-workspace" data-zre-feature="bazaars-trades">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.marketHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.marketSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="' + (bzOpen ? 'sage' : 'gold') + '">' + (bzOpen ? 'Bazaar OPEN' : '0% Tax') + '</span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.tradesTitle) + '</h3></div>' +
          '<div class="zre-row-actions">' +
            '<input type="text" class="zre-input" placeholder="Partner ID or username" data-zre-draft="tradePartner" value="' + esc(store.drafts.tradePartner) + '">' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="trade-create"' + (store.busy ? ' disabled' : '') + '>🤝 ' + esc(copy.openTradeBtn) + '</button>' +
          '</div>' +
          tradesListHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.bazaarTitle) + '</h3>' +
            '<span class="zre-chip" data-tone="' + (bzOpen ? 'sage' : 'gold') + '">' + (bzOpen ? 'OPEN · 0% Tax' : 'CLOSED') + '</span>' +
          '</div>' +
          '<div class="zre-row-actions">' +
            '<input type="text" class="zre-input" data-zre-draft="bazaarTagline" value="' + esc(store.drafts.bazaarTagline) + '">' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="bazaar-toggle" data-open="' + (bzOpen ? '0' : '1') + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.toggleBazaarBtn) + '</button>' +
          '</div>' +
          render3dItemShowcase(draftBazItem, null, draftBazItem) +
          '<div class="zre-row-actions">' +
            '<select class="zre-select" data-zre-draft="bazaarItemId">' + itemOpts + '</select>' +
            '<input type="number" min="1" class="zre-input zre-input-sm" data-zre-draft="bazaarQty" value="' + esc(store.drafts.bazaarQty) + '">' +
            '<input type="number" min="1" class="zre-input zre-input-sm" data-zre-draft="bazaarPrice" value="' + esc(store.drafts.bazaarPrice) + '">' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="bazaar-list"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.listBazaarBtn) + '</button>' +
          '</div>' +
          listHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route: jobs -> Player-Directed Companies (1★-10★) */
  function renderJobsRoute() {
    var ar = isAr();
    var copy = L();
    var se = store.syndicateEconomy || {};
    var comp = se.company || se.myCompany || null;
    var compDir = Array.isArray(se.companies) ? se.companies : [];

    var compTypeOpts = '';
    for (var cti = 0; cti < COMPANY_TYPES.length; cti++) {
      var ct = COMPANY_TYPES[cti];
      compTypeOpts += '<option value="' + ct.id + '"' + (store.drafts.companyType === ct.id ? ' selected' : '') + '>' + esc(ar ? ct.ar : ct.en) + '</option>';
    }

    var specialsHtml = '<div class="zre-row-actions">';
    for (var spi = 0; spi < COMPANY_SPECIALS.length; spi++) {
      var sp = COMPANY_SPECIALS[spi];
      specialsHtml +=
        '<button type="button" class="zre-btn" data-zre-act="company-special" data-star="' + sp.star + '" data-id="' + sp.id + '"' + (store.busy ? ' disabled' : '') + '>★ ' + esc(ar ? sp.ar : sp.en) + ' (' + sp.cost + ' JP)</button>';
    }
    specialsHtml += '</div>';

    var dirCompHtml = '';
    for (var dci = 0; dci < compDir.length; dci++) {
      var dc = compDir[dci];
      var dcid = String(dc.id || dc.companyId);
      dirCompHtml +=
        '<div class="zre-card">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(dc.name || dcid) + '</span>' +
            '<bdi class="zre-chip" data-tone="gold">' + Number(dc.stars || dc.rating || 1) + '★</bdi>' +
          '</div>' +
          '<button type="button" class="zre-btn" data-zre-act="company-join" data-company="' + esc(dcid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.joinCompBtn) + '</button>' +
        '</div>';
    }

    return (
      '<div class="zre-workspace" data-zre-feature="player-companies">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.jobsHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.jobsSub) + '</p>' +
          '</div>' +
          (comp ? '<span class="zre-chip" data-tone="gold">' + esc(comp.name || 'My Company') + ' · ' + Number(comp.stars || 1) + '★ · JP: ' + Number(comp.jobPts || se.jobPts || 0) + '</span>' : '<span class="zre-chip" data-tone="gold">1★–10★</span>') +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.companyTitle) + '</h3></div>' +
          '<div class="zre-row-actions">' +
            '<select class="zre-select" data-zre-draft="companyType">' + compTypeOpts + '</select>' +
            '<input type="text" class="zre-input" data-zre-draft="companyName" value="' + esc(store.drafts.companyName) + '">' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="company-found"' + (store.busy ? ' disabled' : '') + '>🏢 ' + esc(copy.foundCompBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="company-work"' + (store.busy ? ' disabled' : '') + '>⚡ ' + esc(copy.workShiftBtn) + '</button>' +
            (comp ? '<button type="button" class="zre-btn" data-zre-act="company-leave"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.leaveCompBtn) + '</button>' : '') +
          '</div>' +
          '<div class="zre-row-actions">' +
            '<input type="number" min="0" class="zre-input zre-input-sm" data-zre-draft="companyAdBudget" value="' + esc(store.drafts.companyAdBudget) + '">' +
            '<input type="number" min="1" class="zre-input zre-input-sm" data-zre-draft="companyPrice" value="' + esc(store.drafts.companyPrice) + '">' +
            '<button type="button" class="zre-btn" data-zre-act="company-manage"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.manageCompBtn) + '</button>' +
          '</div>' +
          specialsHtml +
          (dirCompHtml ? ('<div class="zre-grid-auto">' + dirCompHtml + '</div>') : '') +
        '</section>' +
      '</div>'
    );
  }

  /* Route: properties -> Marriage & Spouse Property Sharing */
  function renderPropertiesRoute() {
    var copy = L();
    var se = store.syndicateEconomy || {};
    var mar = se.marriage || {};
    var spouseId = mar.spouseId || mar.spouseName || null;
    var proposals = Array.isArray(mar.proposals) ? mar.proposals : (Array.isArray(mar.incomingProposals) ? mar.incomingProposals : []);
    var propHtml = '';
    for (var pri = 0; pri < proposals.length; pri++) {
      var pr = proposals[pri];
      var pid = String(pr.id || pr.proposalId || ('prop_' + pri));
      propHtml +=
        '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="marriage-accept" data-proposal="' + esc(pid) + '"' + (store.busy ? ' disabled' : '') + '>💍 ' + esc(copy.acceptMarriageBtn) + ' (' + esc(pr.fromId || pr.proposerId || pid) + ')</button>';
    }

    return (
      '<div class="zre-workspace" data-zre-feature="marriage-sharing">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.propertiesHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.propertiesSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="plum">' + (spouseId ? ('💍 Spouse: ' + esc(spouseId) + ' · Shared Max Happy ✓') : 'Single Operative') + '</span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.marriageTitle) + '</h3></div>' +
          '<div class="zre-row-actions">' +
            '<input type="text" class="zre-input" placeholder="Target player ID" data-zre-draft="spouseTarget" value="' + esc(store.drafts.spouseTarget) + '">' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="marriage-propose"' + (store.busy ? ' disabled' : '') + '>💍 ' + esc(copy.proposeBtn) + '</button>' +
            propHtml +
            (spouseId ? '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="marriage-divorce"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.divorceBtn) + '</button>' : '') +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* Route: items -> 9-Slot Tactical Loadout Paperdoll (4 Weapons + 5 Armor) */
  function renderItemsRoute() {
    var ar = isAr();
    var copy = L();
    var fe = store.factionEmpire || {};
    var loadout = fe.loadout || {};
    var slotsMap = loadout.slots || loadout.loadoutSlots || {};
    var availBySlot = loadout.availableBySlot || {};
    var inv = getOwnedInventory();

    var paperdollHtml = '<div class="zre-paperdoll-grid">';
    for (var si = 0; si < LOADOUT_SLOTS_9.length; si++) {
      var sl = LOADOUT_SLOTS_9[si];
      var equippedId = String(slotsMap[sl.slot] || '');
      var cands = [];
      var srvSlotItems = Array.isArray(availBySlot[sl.slot]) ? availBySlot[sl.slot] : [];
      for (var svi = 0; svi < srvSlotItems.length; svi++) {
        if (srvSlotItems[svi] && srvSlotItems[svi].id && cands.indexOf(srvSlotItems[svi].id) < 0) {
          cands.push(srvSlotItems[svi].id);
        }
      }
      for (var dfi = 0; dfi < sl.defaults.length; dfi++) {
        if (cands.indexOf(sl.defaults[dfi]) < 0) cands.push(sl.defaults[dfi]);
      }
      for (var ik in inv) {
        if (Number(inv[ik]) > 0 && cands.indexOf(ik) < 0) cands.push(ik);
      }
      var chosenDraft = store.drafts.slotItem[sl.slot] || equippedId || cands[0] || sl.defaults[0];
      var selOpts = '';
      for (var ci = 0; ci < cands.length; ci++) {
        var cid = cands[ci];
        selOpts += '<option value="' + esc(cid) + '"' + (chosenDraft === cid ? ' selected' : '') + '>' + esc(cid) + (inv[cid] ? (' (x' + inv[cid] + ')') : '') + '</option>';
      }
      paperdollHtml +=
        '<div class="zre-card" data-loadout-slot="' + sl.slot + '">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">' + esc(ar ? sl.ar : sl.en) + '</span>' +
            '<span class="zre-chip" data-tone="' + (equippedId ? 'sage' : 'gold') + '">' + esc(equippedId || 'Empty') + '</span>' +
          '</div>' +
          render3dItemShowcase(chosenDraft, sl.group === 'armor' ? 'armor' : 'weapon', ar ? sl.ar : sl.en) +
          '<div class="zre-row-actions">' +
            '<select class="zre-select" data-zre-draft="slotItem" data-slot="' + sl.slot + '">' + selOpts + '</select>' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="loadout-equip" data-slot="' + sl.slot + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.equipSlotBtn) + '</button>' +
          '</div>' +
        '</div>';
    }
    paperdollHtml += '</div>';

    return (
      '<div class="zre-workspace" data-zre-feature="tactical-loadout">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.itemsHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.itemsSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="sage">Armor: <bdi>' + Number(loadout.armorMitigationPct || 25) + '%</bdi> · Mult: <bdi>×' + Number(loadout.weaponMultiplier || 1).toFixed(2) + '</bdi></span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.loadoutTitle) + '</h3></div>' +
          '<div class="z3d-action-stage zre-paperdoll-stage" data-z3d-stage="paperdoll-armory" style="height:220px;margin-bottom:10px"></div>' +
          paperdollHtml +
        '</section>' +
      '</div>'
    );
  }

  /* Route: faction -> Found Faction, Directory, Vault, 7-Branch Respect Tree, 4-Role OC & 48h Ranked Wars */
  function renderFactionRoute() {
    var ar = isAr();
    var copy = L();
    var fe = store.factionEmpire || {};
    var myFac = fe.faction || fe.myFaction || null;
    var directory = Array.isArray(fe.directory) ? fe.directory : (Array.isArray(fe.factions) ? fe.factions : []);
    var roster = (myFac && Array.isArray(myFac.members)) ? myFac.members : (Array.isArray(fe.members) ? fe.members : []);
    var vaultCash = Number((myFac && (myFac.vaultBalance != null ? myFac.vaultBalance : myFac.vaultCash)) != null ? (myFac.vaultBalance != null ? myFac.vaultBalance : myFac.vaultCash) : (fe.vaultBalance || 0));
    var respectPool = Number((myFac && myFac.respect) != null ? myFac.respect : (fe.respect || 0));

    var dirHtml = '<div class="zre-grid-auto">';
    for (var di = 0; di < directory.length; di++) {
      var df = directory[di];
      var dfId = String(df.id || df.factionId);
      dirHtml +=
        '<div class="zre-card">' +
          '<div class="zre-card-top">' +
            '<span class="zre-card-title">[' + esc(df.tag || 'SYN') + '] ' + esc(ar ? (df.nameAr || df.nameEn || df.name) : (df.nameEn || df.name)) + '</span>' +
            '<bdi class="zre-chip" data-tone="gold">Respect: ' + fmtInt(df.respect || 0) + '</bdi>' +
          '</div>' +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="faction-join" data-faction="' + esc(dfId) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.joinFactionBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="war-challenge" data-faction="' + esc(dfId) + '"' + (store.busy ? ' disabled' : '') + '>⚔ ' + esc(copy.challengeWarBtn) + '</button>' +
          '</div>' +
        '</div>';
    }
    dirHtml += '</div>';

    var rosterHtml = '';
    if (roster.length) {
      rosterHtml = '<div class="zre-grid-auto">';
      for (var mbi = 0; mbi < roster.length; mbi++) {
        var mb = roster[mbi];
        var mid = String(mb.playerId || mb.id);
        rosterHtml +=
          '<div class="zre-card">' +
            '<div class="zre-card-top">' +
              '<strong class="zre-player-inline">' + renderInlineAvatar(mid) + esc(mb.username || mid) + '</strong>' +
              '<span class="zre-chip" data-tone="blue">' + esc(mb.role || 'member') + '</span>' +
            '</div>' +
            '<div class="zre-row-actions">' +
              '<button type="button" class="zre-btn" data-zre-act="faction-role" data-member="' + esc(mid) + '" data-role="officer"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.setRoleBtn) + ': Officer</button>' +
              '<button type="button" class="zre-btn" data-zre-act="faction-grant" data-member="' + esc(mid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.grantVaultBtn) + '</button>' +
              '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="faction-kick" data-member="' + esc(mid) + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.kickMemberBtn) + '</button>' +
            '</div>' +
          '</div>';
      }
      rosterHtml += '</div>';
    }

    var treeState = (fe.respectTree && fe.respectTree.upgrades) || fe.respectTree || {};
    var srvBranchesById = {};
    if (fe.respectTree && Array.isArray(fe.respectTree.branches)) {
      for (var sbi = 0; sbi < fe.respectTree.branches.length; sbi++) {
        var sb = fe.respectTree.branches[sbi];
        if (sb && sb.id && Array.isArray(sb.nodes)) {
          var nMap = {};
          for (var sni = 0; sni < sb.nodes.length; sni++) {
            if (sb.nodes[sni] && sb.nodes[sni].id) nMap[sb.nodes[sni].id] = Number(sb.nodes[sni].tier || 0);
          }
          srvBranchesById[sb.id] = nMap;
        }
      }
    }
    var respTreeHtml = '<div class="zre-grid-auto">';
    for (var bi = 0; bi < FACTION_RESPECT_BRANCHES.length; bi++) {
      var rb = FACTION_RESPECT_BRANCHES[bi];
      var bNodes = '';
      for (var rni = 0; rni < rb.nodes.length; rni++) {
        var rn = rb.nodes[rni];
        var tierNow = Number(
          (srvBranchesById[rb.id] && srvBranchesById[rb.id][rn.id] != null) ? srvBranchesById[rb.id][rn.id] :
          (treeState[rb.id] && treeState[rb.id][rn.id] != null) ? treeState[rb.id][rn.id] :
          (treeState[rn.id] || 0)
        );
        bNodes +=
          '<div class="zre-side-row" style="padding:3px 0;border-top:1px dashed var(--zre-rule)">' +
            '<span>' + esc(ar ? rn.ar : rn.en) + ' (<bdi>' + tierNow + '/5</bdi>)</span>' +
            '<button type="button" class="zre-btn" data-zre-act="respect-upgrade" data-branch="' + rb.id + '" data-node="' + rn.id + '"' + (tierNow >= 5 || store.busy ? ' disabled' : '') + '>+1</button>' +
          '</div>';
      }
      respTreeHtml +=
        '<div class="zre-card">' +
          '<div class="zre-card-title">' + esc(ar ? rb.ar : rb.en) + '</div>' +
          bNodes +
        '</div>';
    }
    respTreeHtml += '</div>';

    var activeOc = (fe.organizedCrimes && fe.organizedCrimes.activeOc) || fe.organizedCrime || (Array.isArray(fe.organizedCrimes) && fe.organizedCrimes[0]) || { id: 'oc_default', heistId: store.drafts.ocHeistId, slots: {} };
    var ocId = String(activeOc.id || activeOc.ocId || 'oc_1');
    var ocSlots = activeOc.slots || {};
    var ocOpts = '';
    for (var hi = 0; hi < CREW_OC_HEISTS.length; hi++) {
      var ch = CREW_OC_HEISTS[hi];
      ocOpts += '<option value="' + ch.id + '"' + (store.drafts.ocHeistId === ch.id ? ' selected' : '') + '>' + esc(ar ? ch.ar : ch.en) + ' (' + ch.reward + ')</option>';
    }
    var rolesHtml = '<div class="zre-grid-4">';
    for (var rli = 0; rli < CREW_ROLES.length; rli++) {
      var rl = CREW_ROLES[rli];
      var holder = ocSlots[rl.id];
      var holderTxt = holder ? (typeof holder === 'object' ? (holder.username || holder.playerId || 'Filled') : String(holder)) : 'Open Slot';
      rolesHtml +=
        '<div class="zre-card">' +
          '<div class="zre-card-top">' +
            '<strong>' + esc(ar ? rl.ar : rl.en) + '</strong>' +
            '<span class="zre-chip" data-tone="' + (holder ? 'sage' : 'gold') + '">' + esc(holderTxt) + '</span>' +
          '</div>' +
          '<button type="button" class="zre-btn" data-zre-act="oc-claim-slot" data-oc="' + esc(ocId) + '" data-role="' + rl.id + '"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.claimSlotBtn) + '</button>' +
        '</div>';
    }
    rolesHtml += '</div>';

    var rwRoot = fe.rankedWar || {};
    var war = rwRoot.activeWar || fe.activeWar || rwRoot || {};
    var ourScore = Number(war.ourScore || 0);
    var theirScore = Number(war.theirScore || 0);
    var totalScore = Math.max(1, ourScore + theirScore);
    var ourPct = Math.round((ourScore / totalScore) * 100);
    if (ourScore === 0 && theirScore === 0) ourPct = 50;
    var caches = rwRoot.caches || fe.warCaches || fe.caches || { bronze: 0, silver: 0, gold: 0 };

    return (
      '<div class="zre-workspace" data-zre-feature="faction-respect-tree">' +
        '<header class="zre-route-head">' +
          '<div>' +
            '<h2 class="zre-route-title">' + esc(copy.factionHeading) + '</h2>' +
            '<p class="zre-route-sub">' + esc(copy.factionSub) + '</p>' +
          '</div>' +
          '<span class="zre-chip" data-tone="gold">Vault: <bdi>' + fmtMoney(vaultCash) + '</bdi> · Respect: <bdi>' + fmtInt(respectPool) + '</bdi></span>' +
        '</header>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.factionFoundTitle) + '</h3></div>' +
          '<div class="zre-row-actions">' +
            '<input type="text" class="zre-input" placeholder="Faction Name (EN)" data-zre-draft="facNameEn" value="' + esc(store.drafts.facNameEn) + '">' +
            '<input type="text" class="zre-input" placeholder="اسم الفاكشن (AR)" data-zre-draft="facNameAr" value="' + esc(store.drafts.facNameAr) + '">' +
            '<input type="text" maxlength="5" class="zre-input zre-input-sm" placeholder="[TAG]" data-zre-draft="facTag" value="' + esc(store.drafts.facTag) + '">' +
            '<input type="color" class="zre-input zre-input-sm" data-zre-draft="facColor" value="' + esc(store.drafts.facColor) + '">' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="faction-create"' + (store.busy ? ' disabled' : '') + '>👑 ' + esc(copy.createFactionBtn) + '</button>' +
            (myFac ? '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="faction-leave"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.leaveFactionBtn) + '</button>' : '') +
          '</div>' +
          '<div class="zre-row-actions">' +
            '<input type="number" min="1000" class="zre-input zre-input-sm" data-zre-draft="facVaultAmt" value="' + esc(store.drafts.facVaultAmt) + '">' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="faction-vault-deposit"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.depositVaultBtn) + '</button>' +
          '</div>' +
          dirHtml +
          rosterHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.respectTreeTitle) + '</h3></div>' +
          respTreeHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head"><h3 class="zre-section-title">' + esc(copy.ocTitle) + '</h3></div>' +
          '<div class="zre-row-actions">' +
            '<select class="zre-select" data-zre-draft="ocHeistId">' + ocOpts + '</select>' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="oc-create"' + (store.busy ? ' disabled' : '') + '>' + esc(copy.createOcBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="primary" data-zre-act="oc-execute" data-oc="' + esc(ocId) + '"' + (store.busy ? ' disabled' : '') + '>💥 ' + esc(copy.executeOcBtn) + '</button>' +
          '</div>' +
          rolesHtml +
        '</section>' +
        '<section class="zre-section">' +
          '<div class="zre-section-head">' +
            '<h3 class="zre-section-title">' + esc(copy.warTitle) + '</h3>' +
            '<span class="zre-chip" data-tone="crimson">Our Score: <bdi>' + ourScore + '</bdi> vs Rival: <bdi>' + theirScore + '</bdi></span>' +
          '</div>' +
          '<div class="zre-war-bar"><div class="zre-war-bar-our" style="width:' + ourPct + '%"></div></div>' +
          '<div class="z3d-action-stage zre-3d-stage" data-z3d-stage="combat-arena" style="height:210px;margin-bottom:10px"></div>' +
          render3dItemShowcase('weapon_cache', 'weapon', copy.claimCacheBtn) +
          '<div class="zre-row-actions">' +
            '<button type="button" class="zre-btn" data-zre-act="war-enlist"' + (store.busy ? ' disabled' : '') + '>🚩 ' + esc(copy.enlistWarBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="danger" data-zre-act="war-assault"' + (store.busy ? ' disabled' : '') + '>⚔ ' + esc(copy.assaultWarBtn) + '</button>' +
            '<button type="button" class="zre-btn" data-variant="gold" data-zre-act="war-cache" data-tier="gold"' + (store.busy ? ' disabled' : '') + '>🎁 ' + esc(copy.claimCacheBtn) + ' (Caches: ' + Number(caches.gold || caches.silver || caches.bronze || 0) + ')</button>' +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------------
   * 9. ROUTE-SCOPED SECTION CONTAINER MOUNT & EVENT DELEGATION
   * ------------------------------------------------------------------------ */
  var ROUTE_RENDERERS = {
    home: renderHomeRoute,
    missions: renderMissionsRoute,
    education: renderEducationRoute,
    casino: renderCasinoRoute,
    city: renderCityRoute,
    market: renderMarketRoute,
    jobs: renderJobsRoute,
    properties: renderPropertiesRoute,
    items: renderItemsRoute,
    faction: renderFactionRoute
  };

  function ensureRouteSection() {
    if (document.querySelector('x-dc')) return null;
    var main = document.getElementById('zone-main');
    if (!main) return null;

    var sec = document.getElementById('zone-rpg-route-section');
    if (sec && sec.parentElement !== main) {
      if (sec.parentElement) sec.parentElement.removeChild(sec);
      sec = null;
    }
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'zone-rpg-route-section';
      sec.className = 'zre-scope';
      sec.addEventListener('click', handleActionClick);
      sec.addEventListener('input', handleDraftInput);
      sec.addEventListener('change', handleDraftInput);
      main.appendChild(sec);
    }
    return sec;
  }

  function renderRouteSection() {
    var main = document.getElementById('zone-main');
    if (!main) return;
    var screen = String(main.getAttribute('data-zone-screen') || 'home').toLowerCase();

    if (screen !== store.lastScreen) {
      store.lastScreen = screen;
      store.activeRoute = screen;
      clearFeedbackTimer();
      store.feedback = null;
      ensureRouteDomainsLoaded(screen);
    }

    var renderer = ROUTE_RENDERERS[screen];
    if (!renderer) {
      var existing = document.getElementById('zone-rpg-route-section');
      if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
      }
      return;
    }

    var sec = ensureRouteSection();
    if (!sec) return;

    sec.setAttribute('data-zre-route', screen);
    sec.hidden = false;

    /* Preserve focused input/select across background timer ticks */
    var activeEl = document.activeElement;
    if (activeEl && sec.contains(activeEl) && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') && !store.busy) {
      return;
    }

    var fbHtml = store.feedback
      ? '<div class="zre-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' +
          '<span>' + esc(store.feedback.text) + '</span>' +
          '<button type="button" class="zre-btn" data-zre-act="clear-feedback" aria-label="Dismiss">✕</button>' +
        '</div>'
      : '';

    var prevStage = sec.querySelector ? sec.querySelector('.z3d-action-stage') : null;
    var prevStageKind = prevStage && prevStage.getAttribute ? prevStage.getAttribute('data-z3d-stage') : '';
    var keepLiveStage = Boolean(prevStage && prevStage.querySelector && prevStage.querySelector('canvas'));

    sec.innerHTML = fbHtml + renderer();

    if (keepLiveStage && sec.querySelector) {
      var nextStage = sec.querySelector('.z3d-action-stage[data-z3d-stage="' + prevStageKind + '"]');
      if (nextStage && typeof nextStage.replaceWith === 'function') {
        nextStage.replaceWith(prevStage);
      }
    }
    if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
      try { window.ZoneEcs3D.scan(sec); } catch (_) {}
    }
    if (window.ZoneProfileAvatar && typeof window.ZoneProfileAvatar.syncMounts === 'function') {
      try { window.ZoneProfileAvatar.syncMounts(); } catch (_) {}
    }
  }

  function handleDraftInput(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var key = el.getAttribute('data-zre-draft');
    if (!key) return;
    if (key === 'slotItem') {
      var slot = el.getAttribute('data-slot');
      if (slot) {
        store.drafts.slotItem[slot] = el.value;
        var slotCard = typeof el.closest === 'function' ? el.closest('[data-loadout-slot]') : null;
        if (slotCard && slotCard.querySelector) {
          var sSlot = slotCard.querySelector('.z3d-item-slot');
          var sBtn = slotCard.querySelector('[data-z3d-inspect]');
          var sCat = inferZreItemCategory(el.value, 'weapon');
          if (sSlot) {
            sSlot.setAttribute('data-z3d-item', el.value);
            sSlot.setAttribute('data-z3d-cat', sCat);
          }
          if (sBtn) {
            sBtn.setAttribute('data-z3d-inspect', el.value);
            sBtn.setAttribute('data-z3d-cat', sCat);
            sBtn.setAttribute('data-z3d-title', el.value);
          }
          if (window.ZoneEcs3D && typeof window.ZoneEcs3D.scan === 'function') {
            try { window.ZoneEcs3D.scan(slotCard); } catch (_) {}
          }
        }
      }
    } else {
      store.drafts[key] = el.value;
    }
  }

  function navigateToRoute(routeOrTab) {
    var targetRoute = LEGACY_TAB_TO_ROUTE[routeOrTab] || routeOrTab || 'missions';
    if (window.ZoneMeritsUI && typeof window.ZoneMeritsUI.isOpen === 'function' && window.ZoneMeritsUI.isOpen()) {
      window.ZoneMeritsUI.close();
    }
    if (document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.remove('zaaa-rail-open');
    }

    if (window.__zoneGame && typeof window.__zoneGame.go === 'function') {
      try { window.__zoneGame.go(targetRoute); } catch (_) {}
    } else {
      var main = document.getElementById('zone-main');
      if (main) main.setAttribute('data-zone-screen', targetRoute);
    }

    ensureRouteDomainsLoaded(targetRoute);
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
      ? ev.target.closest('[data-zre-act]')
      : null;
    if (!target || target.disabled) return;
    ev.preventDefault();

    var act = target.getAttribute('data-zre-act');
    if (act === 'inspect-3d') {
      var iId = target.getAttribute('data-z3d-inspect') || target.getAttribute('data-id');
      var iTitle = target.getAttribute('data-z3d-title') || iId;
      if (window.ZoneEcs3D && typeof window.ZoneEcs3D.inspectItem === 'function') {
        try { window.ZoneEcs3D.inspectItem(iId, { title: iTitle }); } catch (_) {}
      }
      return;
    }
    if (act === 'go-route') {
      navigateToRoute(target.getAttribute('data-route') || 'missions');
    } else if (act === 'open-tab' || act === 'switch-tab') {
      navigateToRoute(target.getAttribute('data-tab') || 'missions');
    } else if (act === 'clear-feedback') {
      clearFeedbackTimer();
      store.feedback = null;
      renderRouteSection();
    } else if (act === 'refresh-all') {
      refreshAll();
    } else if (act === 'select-act') {
      var nextAct = Math.max(1, Math.min(5, Number(target.getAttribute('data-act') || 1)));
      store.selectedAct = nextAct;
      store.selectedChapterId = STORY_ACTS[nextAct - 1].chapters[0].id;
      renderRouteSection();
    } else if (act === 'select-chapter') {
      store.selectedChapterId = target.getAttribute('data-chapter') || 'act1_ch1';
      renderRouteSection();
    } else if (act === 'story-start') {
      var sCh = target.getAttribute('data-chapter');
      dispatchDomainAction('story', 'chapter.start', { chapterId: sCh, id: sCh });
    } else if (act === 'story-choice') {
      var cCh = target.getAttribute('data-chapter');
      var chVal = target.getAttribute('data-choice') || 'syndicate';
      dispatchDomainAction('story', 'chapter.choice', { chapterId: cCh, choice: chVal, alignment: chVal });
    } else if (act === 'story-boss') {
      var bCh = target.getAttribute('data-chapter');
      dispatchDomainAction('story', 'chapter.bossFight', { chapterId: bCh, id: bCh });
    } else if (act === 'story-claim') {
      var clCh = target.getAttribute('data-chapter');
      dispatchDomainAction('story', 'chapter.claim', { chapterId: clCh, id: clCh });
    } else if (act === 'agent-accept') {
      var aId = target.getAttribute('data-id');
      dispatchDomainAction('activities', 'agent.accept', { contractId: aId, id: aId });
    } else if (act === 'agent-complete') {
      var cmId = target.getAttribute('data-id');
      dispatchDomainAction('activities', 'agent.complete', { contractId: cmId, id: cmId });
    } else if (act === 'agent-refresh') {
      dispatchDomainAction('activities', 'agent.refresh', {});
    } else if (act === 'agent-buy') {
      var rwId = target.getAttribute('data-id');
      dispatchDomainAction('activities', 'agent.buyReward', { rewardId: rwId, itemId: rwId, id: rwId });
    } else if (act === 'level-toggle-hold') {
      var en = target.getAttribute('data-enabled') === '1';
      dispatchDomainAction('rpg', 'level.toggleHold', { enabled: en, holdLevel: en });
    } else if (act === 'level-promote') {
      dispatchDomainAction('rpg', 'level.promote', {});
    } else if (act === 'rank-claim') {
      dispatchDomainAction('rpg', 'rank.claimPromotion', {});
    } else if (act === 'skill-unlock') {
      var nId = target.getAttribute('data-node');
      var bId = target.getAttribute('data-branch');
      dispatchDomainAction('rpg', 'skillTree.unlock', { nodeId: nId, id: nId, branch: bId });
    } else if (act === 'skill-respec') {
      dispatchDomainAction('rpg', 'skillTree.respec', {});
    } else if (act === 'work-train') {
      var stKey = target.getAttribute('data-stat') || 'man';
      dispatchDomainAction('rpg', 'workStats.train', { stat: stKey, mode: 'energy' });
    } else if (act === 'wheel-spin') {
      var whId = target.getAttribute('data-wheel') || 'lame';
      store.spinningWheel = whId;
      dispatchDomainAction('activities', 'wheel.spin', { wheel: whId, wheelId: whId, tier: whId });
    } else if (act === 'dump-search') {
      dispatchDomainAction('activities', 'dump.search', {});
    } else if (act === 'dump-toss') {
      var dItem = store.drafts.dumpItemId || 'glasses';
      var dQty = Math.max(1, Math.round(Number(store.drafts.dumpQty || 1)));
      dispatchDomainAction('activities', 'dump.toss', { itemId: dItem, quantity: dQty });
    } else if (act === 'loan-borrow') {
      var lAmt = Math.max(1000, Math.round(Number(store.drafts.loanAmount || 25000)));
      dispatchDomainAction('activities', 'loan.borrow', { amount: lAmt });
    } else if (act === 'loan-repay') {
      var rAmt = Math.max(1000, Math.round(Number(store.drafts.loanAmount || 25000)));
      dispatchDomainAction('activities', 'loan.repay', { amount: rAmt });
    } else if (act === 'hunt-go') {
      var hMode = target.getAttribute('data-mode') || 'beginner';
      dispatchDomainAction('activities', 'hunt.expedition', { mode: hMode, tier: hMode });
    } else if (act === 'race-buy-car') {
      var cId = target.getAttribute('data-car') || 'civic_e';
      store.drafts.selectedCarId = cId;
      var carAct = target.getAttribute('data-owned') === '1' ? 'race.selectCar' : 'race.buyCar';
      dispatchDomainAction('activities', carAct, { carId: cId, id: cId });
    } else if (act === 'race-upgrade') {
      var uCar = target.getAttribute('data-car') || store.drafts.selectedCarId;
      var uPart = target.getAttribute('data-part') || 'turbo';
      dispatchDomainAction('activities', 'race.upgradeCar', { carId: uCar, partId: uPart, upgradeId: uPart, part: uPart });
    } else if (act === 'race-track') {
      var tId = target.getAttribute('data-track') || 'docks_sprint';
      var tCar = target.getAttribute('data-car') || store.drafts.selectedCarId;
      dispatchDomainAction('activities', 'race.enterTrack', { trackId: tId, track: tId, carId: tCar });
    } else if (act === 'trade-create') {
      var pId = String(store.drafts.tradePartner || '').trim();
      dispatchDomainAction('economy', 'trade.create', { partnerId: pId, targetPlayerId: pId });
    } else if (act === 'trade-add-cash') {
      var tcId = target.getAttribute('data-trade');
      var tcAmt = Math.max(1, Math.round(Number(store.drafts.tradeCash || 10000)));
      dispatchDomainAction('economy', 'trade.addCash', { tradeId: tcId, amount: tcAmt });
    } else if (act === 'trade-add-item') {
      var tiId = target.getAttribute('data-trade');
      dispatchDomainAction('economy', 'trade.addItem', {
        tradeId: tiId,
        itemId: store.drafts.tradeItemId || 'xanax',
        quantity: Math.max(1, Math.round(Number(store.drafts.tradeItemQty || 1)))
      });
    } else if (act === 'trade-accept') {
      dispatchDomainAction('economy', 'trade.accept', { tradeId: target.getAttribute('data-trade') });
    } else if (act === 'trade-cancel') {
      dispatchDomainAction('economy', 'trade.cancel', { tradeId: target.getAttribute('data-trade') });
    } else if (act === 'bazaar-toggle') {
      var bOpen = target.getAttribute('data-open') === '1';
      dispatchDomainAction('economy', 'bazaar.toggle', { open: bOpen, tagline: store.drafts.bazaarTagline });
    } else if (act === 'bazaar-list') {
      dispatchDomainAction('economy', 'bazaar.listItem', {
        itemId: store.drafts.bazaarItemId || 'xanax',
        quantity: Math.max(1, Math.round(Number(store.drafts.bazaarQty || 1))),
        unitPrice: Math.max(1, Math.round(Number(store.drafts.bazaarPrice || 1000)))
      });
    } else if (act === 'bazaar-unlist') {
      var ulId = target.getAttribute('data-listing');
      dispatchDomainAction('economy', 'bazaar.unlistItem', { listingId: ulId, id: ulId });
    } else if (act === 'bazaar-buy') {
      var blId = target.getAttribute('data-listing');
      dispatchDomainAction('economy', 'bazaar.buy', { listingId: blId, quantity: Math.max(1, Math.round(Number(store.drafts.bazaarBuyQty || 1))) });
    } else if (act === 'company-found') {
      dispatchDomainAction('economy', 'company.found', {
        type: store.drafts.companyType || 'logistics_corp',
        name: String(store.drafts.companyName || 'Syndicate Corp').trim()
      });
    } else if (act === 'company-join') {
      var jcId = target.getAttribute('data-company');
      dispatchDomainAction('economy', 'company.join', { companyId: jcId, id: jcId });
    } else if (act === 'company-leave') {
      dispatchDomainAction('economy', 'company.leave', {});
    } else if (act === 'company-work') {
      dispatchDomainAction('economy', 'company.workShift', {});
    } else if (act === 'company-manage') {
      dispatchDomainAction('economy', 'company.manage', {
        adBudget: Math.max(0, Math.round(Number(store.drafts.companyAdBudget || 0))),
        servicePrice: Math.max(1, Math.round(Number(store.drafts.companyPrice || 100)))
      });
    } else if (act === 'company-special') {
      var stTier = Number(target.getAttribute('data-star') || 1);
      var spId = target.getAttribute('data-id') || ('sp_' + stTier);
      dispatchDomainAction('economy', 'company.redeemSpecial', { star: stTier, specialStar: stTier, tier: stTier, starTier: stTier + '★', specialId: spId });
    } else if (act === 'marriage-propose') {
      var mpTarget = String(store.drafts.spouseTarget || '').trim();
      dispatchDomainAction('economy', 'marriage.propose', { targetPlayerId: mpTarget, partnerId: mpTarget });
    } else if (act === 'marriage-accept') {
      var prId = target.getAttribute('data-proposal');
      dispatchDomainAction('economy', 'marriage.accept', { proposalId: prId, id: prId });
    } else if (act === 'marriage-divorce') {
      dispatchDomainAction('economy', 'marriage.divorce', {});
    } else if (act === 'faction-create') {
      dispatchDomainAction('empire', 'faction.create', {
        nameEn: String(store.drafts.facNameEn || 'Iron Lotus').trim(),
        nameAr: String(store.drafts.facNameAr || 'اللوتس الحديدي').trim(),
        tag: String(store.drafts.facTag || 'ILTS').trim().toUpperCase(),
        color: store.drafts.facColor || '#c99227',
        manifesto: String(store.drafts.facManifesto || '').trim()
      });
    } else if (act === 'faction-join') {
      var fjId = target.getAttribute('data-faction');
      dispatchDomainAction('empire', 'faction.join', { factionId: fjId, id: fjId });
    } else if (act === 'faction-leave') {
      dispatchDomainAction('empire', 'faction.leave', {});
    } else if (act === 'faction-role') {
      dispatchDomainAction('empire', 'faction.setRole', {
        targetPlayerId: target.getAttribute('data-member'),
        role: target.getAttribute('data-role') || 'officer'
      });
    } else if (act === 'faction-kick') {
      dispatchDomainAction('empire', 'faction.kick', { targetPlayerId: target.getAttribute('data-member') });
    } else if (act === 'faction-vault-deposit') {
      dispatchDomainAction('empire', 'faction.vaultDeposit', {
        amount: Math.max(100, Math.round(Number(store.drafts.facVaultAmt || 50000)))
      });
    } else if (act === 'faction-grant') {
      dispatchDomainAction('empire', 'faction.vaultGrant', {
        targetPlayerId: target.getAttribute('data-member'),
        amount: Math.max(100, Math.round(Number(store.drafts.facVaultAmt || 50000)))
      });
    } else if (act === 'respect-upgrade') {
      dispatchDomainAction('empire', 'tree.upgrade', {
        branch: target.getAttribute('data-branch'),
        nodeId: target.getAttribute('data-node')
      });
    } else if (act === 'oc-create') {
      var hId = store.drafts.ocHeistId || 'armored_van';
      dispatchDomainAction('empire', 'oc.create', { heistId: hId, crimeId: hId, type: hId });
    } else if (act === 'oc-claim-slot') {
      var roleKey = target.getAttribute('data-role') || 'mastermind';
      dispatchDomainAction('empire', 'oc.claimSlot', {
        ocId: target.getAttribute('data-oc'),
        role: roleKey,
        slot: roleKey
      });
    } else if (act === 'oc-execute') {
      dispatchDomainAction('empire', 'oc.execute', {
        ocId: target.getAttribute('data-oc'),
        autoHireNpc: true,
        hireNpc: true,
        fillWithNpc: true
      });
    } else if (act === 'war-enlist') {
      dispatchDomainAction('empire', 'war.enlist', {});
    } else if (act === 'war-challenge') {
      var rvId = target.getAttribute('data-faction');
      dispatchDomainAction('empire', 'war.challenge', { rivalFactionId: rvId, targetFactionId: rvId, factionId: rvId });
    } else if (act === 'war-assault') {
      dispatchDomainAction('empire', 'war.scoreHit', { points: 1 });
    } else if (act === 'war-cache') {
      var cTier = target.getAttribute('data-tier') || 'gold';
      dispatchDomainAction('empire', 'war.claimCache', { tier: cTier, cacheType: cTier });
    } else if (act === 'loadout-equip') {
      var eqSlot = target.getAttribute('data-slot') || 'primary';
      var eqItem = store.drafts.slotItem[eqSlot] || 'ak';
      dispatchDomainAction('empire', 'loadout.equipSlot', { slot: eqSlot, itemId: eqItem });
    }
  }

  function renderAll() {
    if (document.querySelector('x-dc')) return;
    try {
      renderHudAndSidebar();
      renderRouteSection();
    } catch (_) {}
  }

  async function refreshAll() {
    await Promise.all([
      loadStoryCampaign(),
      loadPlayerRpg(),
      loadCityActivities(),
      loadSyndicateEconomy(),
      loadFactionEmpire()
    ]);
    renderAll();
    return store;
  }

  async function refreshBootDomains() {
    var main = document.getElementById('zone-main');
    var scr = String((main && main.getAttribute('data-zone-screen')) || 'home').toLowerCase();
    var tasks = [loadStoryCampaign(), loadPlayerRpg()];
    var domains = ROUTE_DOMAINS[scr] || [];
    if (domains.indexOf('activities') >= 0) tasks.push(loadCityActivities());
    if (domains.indexOf('economy') >= 0) tasks.push(loadSyndicateEconomy());
    if (domains.indexOf('empire') >= 0) tasks.push(loadFactionEmpire());
    await Promise.all(tasks);
    renderAll();
  }

  function boot() {
    /* Delegated click listener for HUD story slot & sidebar stat row */
    document.addEventListener('click', function (ev) {
      var t = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zre-act]') : null;
      if (!t) return;
      var inRouteSec = typeof t.closest === 'function' ? t.closest('#zone-rpg-route-section') : null;
      if (inRouteSec) return; /* Handled by section's own listener */
      handleActionClick(ev);
    });

    var rafScheduled = false;
    var scheduleRender = function () {
      if (rafScheduled) return;
      rafScheduled = true;
      var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
      raf(function () {
        rafScheduled = false;
        renderAll();
      });
    };

    window.addEventListener('zone:render', scheduleRender, { passive: true });
    window.addEventListener('zone:torn-gameplay-synced', scheduleRender, { passive: true });
    window.addEventListener('popstate', scheduleRender);

    try {
      var obs = new MutationObserver(scheduleRender);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang', 'dir', 'data-theme', 'data-zma-open']
      });
    } catch (_) {}

    try {
      var observedMain = null;
      var mainObs = null;
      var attachMainObs = function () {
        var m = document.getElementById('zone-main');
        if (!m || m === observedMain) return;
        observedMain = m;
        if (mainObs) {
          try { mainObs.disconnect(); } catch (_) {}
        }
        mainObs = new MutationObserver(scheduleRender);
        mainObs.observe(m, {
          attributes: true,
          attributeFilter: ['data-zone-screen']
        });
      };
      attachMainObs();
      window.addEventListener('zone:render', attachMainObs, { passive: true });
      window.setTimeout(function () { attachMainObs(); scheduleRender(); }, 320);
      window.setTimeout(function () { attachMainObs(); scheduleRender(); }, 1100);
    } catch (_) {}

    /* Re-populate #ztl-hud-story-slot whenever #zone-torn-hud-strip re-renders */
    try {
      var topbarObsAttached = false;
      var tryObserveTopbar = function () {
        if (topbarObsAttached) return;
        var tb = document.querySelector('.zone-topbar');
        if (!tb) return;
        topbarObsAttached = true;
        var tbObs = new MutationObserver(function () {
          var slot = document.getElementById('ztl-hud-story-slot');
          if (!slot || !slot.getAttribute('data-zre-sig')) {
            scheduleRender();
          }
        });
        tbObs.observe(tb, { childList: true, subtree: true });
      };
      tryObserveTopbar();
      window.setTimeout(tryObserveTopbar, 400);
    } catch (_) {}

    window.setInterval(function () {
      if (document.visibilityState !== 'hidden' && !store.busy) {
        refreshBootDomains();
      }
    }, 30000);

    scheduleRender();
    window.setTimeout(refreshBootDomains, 220);
    window.setTimeout(scheduleRender, 850);
  }

  window.ZoneRpgEmpire = {
    navigateTo: navigateToRoute,
    openTab: navigateToRoute,
    refreshAll: refreshAll,
    renderAll: renderAll,
    dispatchDomainAction: dispatchDomainAction,
    getStore: function () { return store; },
    fmtClock: fmtClock
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Server-authoritative 5-Act, 25-Chapter Zone City Narrative Crime Drama (EN + AR).
 *
 * Replaces the legacy 5-counter dead-end with live objective tracking, moral
 * alignment branching (Syndicate Outlaw Kingpin vs Directorate Corrupt State Insider),
 * real 15-Energy multi-round Act Boss clashes, and authoritative Cash/XP/SP/Merit/Relic
 * chapter rewards.
 */
final class StoryCampaignService
{
    public const BOSS_FIGHT_ENERGY_COST = 15;
    public const BOSS_DEFEAT_HOSPITAL_SECONDS = 300; // 5m hospital on defeat

    /** @var array<string, array<string, mixed>> */
    public const NPCS = [
        'duke' => [
            'id' => 'duke',
            'nameEn' => 'Duke (Loan Shark)',
            'nameAr' => 'ديوك (مرابي الميناء)',
            'roleEn' => 'Harbor Loan Shark & Enforcer Boss',
            'roleAr' => 'مرابي الأرصفة وزعيم التحصيل',
            'portrait' => './assets/ui/watercolor-art/arcade-heavybag.webp',
        ],
        'layla' => [
            'id' => 'layla',
            'nameEn' => 'Layla Al-Harbi',
            'nameAr' => 'ليلى الحربي',
            'roleEn' => 'Harbor Street Fixer & Wire-Runner',
            'roleAr' => 'وسيطة الشوارع ومهربة الشيفرات',
            'portrait' => './assets/ui/watercolor-art/arcade-getaway.webp',
        ],
        'mayor_tariq' => [
            'id' => 'mayor_tariq',
            'nameEn' => 'Mayor Tariq',
            'nameAr' => 'العمدة طارق',
            'roleEn' => 'Corrupt Mayor of Zone City',
            'roleAr' => 'عمدة مدينة الزون وصاحب دفتر الظل',
            'portrait' => './assets/ui/watercolor-art/mayor-tariq-scheming.webp',
        ],
        'inspector_haddad' => [
            'id' => 'inspector_haddad',
            'nameEn' => 'Chief Inspector Haddad',
            'nameAr' => 'كبير المفتشين حداد',
            'roleEn' => 'Internal Affairs Taskforce Commander',
            'roleAr' => 'قائد فرقة التحقيقات الخاصة',
            'portrait' => './assets/ui/watercolor-art/mayor-tariq-alert.webp',
        ],
        'madame_vega' => [
            'id' => 'madame_vega',
            'nameEn' => 'Madame Vega',
            'nameAr' => 'مدام فيغا',
            'roleEn' => 'International Airlift Broker',
            'roleAr' => 'سيدة الجسر الجوي والتهريب الدولي',
            'portrait' => './assets/ui/watercolor-art/arcade-casino.webp',
        ],
        'viktor_marrow' => [
            'id' => 'viktor_marrow',
            'nameEn' => 'Viktor Marrow',
            'nameAr' => 'فيكتور مارو',
            'roleEn' => 'Iron Syndicate War Marshal',
            'roleAr' => 'مارشال حرب النقابة الحديدية',
            'portrait' => './assets/ui/motion-art/hero-syndicate-turf.webp',
        ],
        'general_k1ng' => [
            'id' => 'general_k1ng',
            'nameEn' => 'General K1ng',
            'nameAr' => 'الجنرال كينغ',
            'roleEn' => 'Viper Block Commander',
            'roleAr' => 'قائد مربعات الأفاعي الميداني',
            'portrait' => './assets/ui/watercolor-art/arcade-heist.webp',
        ],
        'shadow_regent' => [
            'id' => 'shadow_regent',
            'nameEn' => 'The Shadow Regent',
            'nameAr' => 'الوصي الخفي',
            'roleEn' => 'Chairman of the Underworld Council',
            'roleAr' => 'رئيس مجلس العالم السفلي الأعلى',
            'portrait' => './assets/ui/watercolor-art/mayor-tariq-idle.webp',
        ],
    ];

    /** @var list<array<string, mixed>> */
    public const ACTS = [
        [
            'id' => 'act_1',
            'actNumber' => 1,
            'minLevel' => 1,
            'titleEn' => 'Act I: Gutter of the Harbor',
            'titleAr' => 'الفصل الأول: قاع الميناء',
            'subtitleEn' => 'Duke\'s debt hooks, Layla\'s dockside routes, and blood on Pier 4.',
            'subtitleAr' => 'ديون ديوك القاتلة ومسارات ليلى السرية ودماء الرصيف الرابع.',
            'portrait' => './assets/ui/watercolor-art/arcade-getaway.webp',
            'relic' => [
                'id' => 'harbor_brass_ledger',
                'nameEn' => 'Duke\'s Brass Ledger',
                'nameAr' => 'دفتر ديوك النحاسي',
                'titleEn' => 'Dockside Survivor',
                'titleAr' => 'ناجي الأرصفة',
                'bonusItemId' => 'revolver_2',
            ],
            'boss' => [
                'id' => 'pier4_enforcer',
                'nameEn' => 'Pier 4 Enforcer',
                'nameAr' => 'جلاد الرصيف الرابع',
                'level' => 3,
                'hp' => 160,
                'strength' => 16,
                'defense' => 12,
                'speed' => 15,
                'dexterity' => 12,
                'weaponNameEn' => 'Dockworker Crowbar',
                'weaponNameAr' => 'عتلة الرصيف الفولاذية',
            ],
        ],
        [
            'id' => 'act_2',
            'actNumber' => 2,
            'minLevel' => 5,
            'titleEn' => 'Act II: Mayor Tariq\'s Shadow Ledger',
            'titleAr' => 'الفصل الثاني: دفتر الظل للعمدة طارق',
            'subtitleEn' => 'Municipal blackmail, forged zoning seals, and Internal Affairs warrants.',
            'subtitleAr' => 'ابتزاز القصر البلدي وتزوير الأختام ومواجهة الشؤون الداخلية.',
            'portrait' => './assets/ui/watercolor-art/mayor-tariq-scheming.webp',
            'relic' => [
                'id' => 'tariq_wax_seal',
                'nameEn' => 'Mayor Tariq\'s Signet Seal',
                'nameAr' => 'ختم العمدة طارق السري',
                'titleEn' => 'Shadow Alderman',
                'titleAr' => 'مستشار الظل',
                'bonusItemId' => 'vest',
            ],
            'boss' => [
                'id' => 'chief_inspector_haddad',
                'nameEn' => 'Chief Inspector Haddad',
                'nameAr' => 'كبير المفتشين حداد',
                'level' => 8,
                'hp' => 440,
                'strength' => 85,
                'defense' => 78,
                'speed' => 82,
                'dexterity' => 75,
                'weaponNameEn' => 'Issued Tactical Sidearm',
                'weaponNameAr' => 'مسدس المهمات الرسمية',
            ],
        ],
        [
            'id' => 'act_3',
            'actNumber' => 3,
            'minLevel' => 10,
            'titleEn' => 'Act III: The Cartel Airlift',
            'titleAr' => 'الفصل الثالث: الجسر الجوي للكارتل',
            'subtitleEn' => 'Madame Vega\'s international smuggling runways, plushie couriers, and Hangar 9.',
            'subtitleAr' => 'مدارج مدام فيغا الدولية وخطوط الكيميائيين وكمين الحظيرة التاسعة.',
            'portrait' => './assets/ui/watercolor-art/arcade-casino.webp',
            'relic' => [
                'id' => 'vega_cartel_compass',
                'nameEn' => 'Madame Vega\'s Gold Compass',
                'nameAr' => 'بوصلة مدام فيغا الذهبية',
                'titleEn' => 'Skyline Smuggler',
                'titleAr' => 'مهرب الأجواء',
                'bonusItemId' => 'xanax',
            ],
            'boss' => [
                'id' => 'cartel_sicario',
                'nameEn' => 'Cartel Sicario',
                'nameAr' => 'قاتل الكارتل المأجور',
                'level' => 15,
                'hp' => 1050,
                'strength' => 260,
                'defense' => 230,
                'speed' => 290,
                'dexterity' => 245,
                'weaponNameEn' => 'Gold-Plated Carbine',
                'weaponNameAr' => 'بندقية الكارتل المذهبة',
            ],
        ],
        [
            'id' => 'act_4',
            'actNumber' => 4,
            'minLevel' => 15,
            'titleEn' => 'Act IV: Blood on the 120 Blocks',
            'titleAr' => 'الفصل الرابع: دماء على المئة وعشرين مربعاً',
            'subtitleEn' => 'Viktor Marrow & General K1ng ignite all-out faction warfare across Zone City.',
            'subtitleAr' => 'فيكتور مارو والجنرال كينغ يشعلان حرب العصابات الشاملة في أحياء المدينة.',
            'portrait' => './assets/ui/motion-art/hero-syndicate-turf.webp',
            'relic' => [
                'id' => 'iron_colonel_dogtags',
                'nameEn' => 'Iron Colonel\'s Bloodied Tags',
                'nameAr' => 'قلادة العقيد الحديدي',
                'titleEn' => 'Warlord of the 120',
                'titleAr' => 'سيد المئة وعشرين مربعاً',
                'bonusItemId' => 'bullpup_3',
            ],
            'boss' => [
                'id' => 'iron_colonel',
                'nameEn' => 'Iron Colonel',
                'nameAr' => 'العقيد الحديدي',
                'level' => 20,
                'hp' => 2400,
                'strength' => 780,
                'defense' => 840,
                'speed' => 740,
                'dexterity' => 700,
                'weaponNameEn' => 'Armored Siege Bullpup',
                'weaponNameAr' => 'رشاش الحصار المدرع',
            ],
        ],
        [
            'id' => 'act_5',
            'actNumber' => 5,
            'minLevel' => 25,
            'titleEn' => 'Act V: The Sovereign Crown',
            'titleAr' => 'الفصل الخامس: التاج السيادي',
            'subtitleEn' => 'Mayor Tariq betrays the Underworld Council — claim the throne of Zone City.',
            'subtitleAr' => 'الخيانة الكبرى بين العمدة طارق ومجلس العالم السفلي على عرش مدينة الزون.',
            'portrait' => './assets/ui/watercolor-art/mayor-tariq-idle.webp',
            'relic' => [
                'id' => 'sovereign_crown_signet',
                'nameEn' => 'The Sovereign Crown of Zone City',
                'nameAr' => 'التاج السيادي لمدينة الزون',
                'titleEn' => 'Zone Sovereign',
                'titleAr' => 'عاهل مدينة الزون',
                'bonusItemId' => 'sniperrifle_6',
            ],
            'boss' => [
                'id' => 'the_shadow_regent',
                'nameEn' => 'The Shadow Regent',
                'nameAr' => 'الوصي الخفي',
                'level' => 30,
                'hp' => 5500,
                'strength' => 2400,
                'defense' => 2300,
                'speed' => 2500,
                'dexterity' => 2200,
                'weaponNameEn' => 'Sovereign Custom Sniper',
                'weaponNameAr' => 'قناصة الوصي السيادية',
            ],
        ],
    ];

    /** @var list<array<string, mixed>> */
    private const CHAPTERS = [
        // ==================== ACT I (Lv 1+) ====================
        [
            'id' => 'act1_ch1', 'actId' => 'act_1', 'actNumber' => 1, 'chapterNumber' => 1, 'chapterInAct' => 1, 'minLevel' => 1,
            'npcId' => 'layla',
            'titleEn' => 'Dockside Blood', 'titleAr' => 'دماء الرصيف',
            'synopsisEn' => 'Fresh off the rusted ferry with Duke\'s IOU in your pocket, Layla shows you how survivors eat at the Harbor.',
            'synopsisAr' => 'وصلت للتو إلى الميناء وفي جيبك صك دين لديوك؛ ليلى تريك كيف يعيش الدهاة بين المستودعات.',
            'dialogueEn' => 'Layla: "Keep your head low, rookie. Duke owns every crane on Pier 4. Pull your first clean score before his collectors come knocking."',
            'dialogueAr' => 'ليلى: "اخفض رأسك يا مبتدئ. ديوك يملك كل رافعة في الرصيف الرابع. نفّذ أول عملية نظيفة قبل أن يطرق رجاله بابك."',
            'objectives' => [
                ['metric' => 'level', 'target' => 1, 'labelEn' => 'Reach Level 1', 'labelAr' => 'الوصول إلى المستوى 1'],
                ['metric' => 'crimes', 'target' => 1, 'labelEn' => 'Succeed in 1 street crime', 'labelAr' => 'النجاح في جريمة شارع واحدة'],
            ],
            'rewards' => ['cash' => 3500, 'xp' => 120, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act1_ch2', 'actId' => 'act_1', 'actNumber' => 1, 'chapterNumber' => 2, 'chapterInAct' => 2, 'minLevel' => 1,
            'npcId' => 'duke',
            'titleEn' => 'Iron & Vigorish', 'titleAr' => 'الحديد وفوائد الدين',
            'synopsisEn' => 'Duke doubles the vigorish on late harbor debtors. Harden your fists at the starter gym and stack emergency cash.',
            'synopsisAr' => 'ديوك يضاعف الفائدة على المتأخرين. درّب قبضتيك في النادي الأول واجمع السيولة اللازمة.',
            'dialogueEn' => 'Duke: "Soft knuckles don\'t last forty-eight hours in Zone City. Hit the heavy bag and show me $2,500 in liquid worth."',
            'dialogueAr' => 'ديوك: "القبضات الضعيفة لا تصمد ثمانياً وأربعين ساعة في مدينة الزون. اضرب كيس الرمل وأرني 2,500 دولار من الثروة."',
            'objectives' => [
                ['metric' => 'trains', 'target' => 2, 'labelEn' => 'Complete 2 Gym training sessions', 'labelAr' => 'إتمام جلستي تدريب في النادي'],
                ['metric' => 'netWorth', 'target' => 2500, 'labelEn' => 'Hold $2,500 Net Worth', 'labelAr' => 'امتلاك صافي ثروة 2,500$'],
            ],
            'rewards' => ['cash' => 5000, 'xp' => 160, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act1_ch3', 'actId' => 'act_1', 'actNumber' => 1, 'chapterNumber' => 3, 'chapterInAct' => 3, 'minLevel' => 1,
            'npcId' => 'layla',
            'titleEn' => 'Back-Alley Contraband', 'titleAr' => 'مهربات الأزقة الخلفية',
            'synopsisEn' => 'Layla routes unmarked harbor crates past the night watchmen. Gear up from the city market and run three clean jobs.',
            'synopsisAr' => 'ليلى تمرر صناديق غير مسجلة خلف الحراس الليليين. اشترِ معداتك من السوق ونفّذ ثلاث عمليات ناجحة.',
            'dialogueEn' => 'Layla: "Never work bare-handed. Pick up supplies on the market strip and clear three dockside scores."',
            'dialogueAr' => 'ليلى: "لا تعمل بيدين فارغتين أبداً. اشترِ مؤونتك من السوق وأنجز ثلاث عمليات في الميناء."',
            'objectives' => [
                ['metric' => 'crimes', 'target' => 3, 'labelEn' => 'Complete 3 successful crimes', 'labelAr' => 'إتمام 3 جرائم ناجحة'],
                ['metric' => 'buys', 'target' => 1, 'labelEn' => 'Purchase 1 item from Market/Shop', 'labelAr' => 'شراء أداة واحدة من السوق'],
            ],
            'rewards' => ['cash' => 7500, 'xp' => 220, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act1_ch4', 'actId' => 'act_1', 'actNumber' => 1, 'chapterNumber' => 4, 'chapterInAct' => 4, 'minLevel' => 1,
            'npcId' => 'duke',
            'titleEn' => 'Collectors at Dawn', 'titleAr' => 'محصلو الفجر',
            'synopsisEn' => 'Duke\'s Pier 4 crew corners Layla\'s courier. Build real street grit and gym conditioning before the showdown.',
            'synopsisAr' => 'طاقم الرصيف الرابع يحاصر رسول ليلى. ارفع خبرتك الإجرامية والبدنية قبل المواجهة الحاسمة.',
            'dialogueEn' => 'Duke: "Someone skimmed twenty grand off Container 19. Either you bring me the thief, or you pay in teeth."',
            'dialogueAr' => 'ديوك: "أحدهم سرق عشرين ألفاً من الحاوية 19. إما أن تأتيني بالسارق أو تدفع الثمن من عظامك."',
            'objectives' => [
                ['metric' => 'crimeXp', 'target' => 20, 'labelEn' => 'Reach 20 Crime XP', 'labelAr' => 'الوصول إلى 20 خبرة جريمة'],
                ['metric' => 'gymXp', 'target' => 20, 'labelEn' => 'Reach 20 Gym XP', 'labelAr' => 'الوصول إلى 20 خبرة نادي'],
            ],
            'rewards' => ['cash' => 10000, 'xp' => 300, 'sp' => 2, 'merits' => 1],
        ],
        [
            'id' => 'act1_ch5', 'actId' => 'act_1', 'actNumber' => 1, 'chapterNumber' => 5, 'chapterInAct' => 5, 'minLevel' => 1,
            'isFinale' => true, 'npcId' => 'duke',
            'titleEn' => 'Shakedown at Pier 4', 'titleAr' => 'تصفية الحساب في الرصيف الرابع',
            'synopsisEn' => 'Choose whether Duke\'s brass ledger goes to the Syndicate streets or City Hall\'s Directorate, then crush the Pier 4 Enforcer.',
            'synopsisAr' => 'اختر لمن يذهب دفتر ديوك السري: عصابات النقابة أم إدارة القصر البلدي، ثم اهزم جلاد الرصيف الرابع.',
            'dialogueEn' => 'Layla: "The Enforcer is blocking the pier gate with steel in hand. Pick your allegiance and put him on the concrete!"',
            'dialogueAr' => 'ليلى: "الجلاد يغلق بوابة الرصيف والحديد في يده. اختر ولاءك وأسقطه أرضاً!"',
            'choicePromptEn' => 'What do you do with Duke\'s seized Harbor Debt Ledger?',
            'choicePromptAr' => 'ماذا ستفعل بدفتر ديون الميناء المصادر من ديوك؟',
            'choices' => [
                'syndicate' => [
                    'labelEn' => 'Burn the debts & rally Layla\'s Outlaws (+Syndicate)',
                    'labelAr' => 'إحراق الديون وتوحيد رجال الشوارع مع ليلى (+النقابة)',
                    'outcomeEn' => 'You torched Duke\'s IOUs on Pier 4 — dockworkers whisper your name in every smuggling alley.',
                    'outcomeAr' => 'أحرقت صكوك ديوك أمام عمال الرصيف؛ اسمك بات يتردد في كل زقاق تهريب.',
                ],
                'directorate' => [
                    'labelEn' => 'Sell the ledger to City Hall auditors (+Directorate)',
                    'labelAr' => 'بيع الدفتر لمفتشي القصر البلدي (+الإدارة)',
                    'outcomeEn' => 'Mayor Tariq\'s clerks quietly wire hush-funds and grant you municipal cover at the docks.',
                    'outcomeAr' => 'مكتب العمدة طارق حوّل لك مكافأة سرية ومنحك غطاءً رسمياً في الميناء.',
                ],
            ],
            'objectives' => [
                ['metric' => 'choice', 'target' => 1, 'labelEn' => 'Choose Syndicate or Directorate alignment', 'labelAr' => 'اختيار مسار النقابة أو الإدارة الفاسدة'],
                ['metric' => 'boss', 'target' => 1, 'labelEn' => 'Defeat Boss: Pier 4 Enforcer (15E)', 'labelAr' => 'هزيمة الزعيم: جلاد الرصيف الرابع (15 طاقة)'],
            ],
            'rewards' => ['cash' => 18000, 'xp' => 500, 'sp' => 3, 'merits' => 2],
        ],

        // ==================== ACT II (Lv 5+) ====================
        [
            'id' => 'act2_ch1', 'actId' => 'act_2', 'actNumber' => 2, 'chapterNumber' => 6, 'chapterInAct' => 1, 'minLevel' => 5,
            'npcId' => 'mayor_tariq',
            'titleEn' => 'The Municipal Envelope', 'titleAr' => 'مظروف القصر البلدي',
            'synopsisEn' => 'Mayor Tariq summons you to the marble balcony overlooking Zone City. Entry into his circle requires Level 5 and capital.',
            'synopsisAr' => 'العمدة طارق يستدعيك إلى شرفة القصر الرخامية. دخول دائرته يتطلب المستوى الخامس ورأس مال محترم.',
            'dialogueEn' => 'Mayor Tariq: "Street thugs steal pennies; city zoning steals millions. Prove you can hold $25,000 without blinking."',
            'dialogueAr' => 'العمدة طارق: "لصوص الشوارع يسرقون الفتات، أما تخطيط المدن فيحصد الملايين. أثبت أنك تملك 25,000 دولار."',
            'objectives' => [
                ['metric' => 'level', 'target' => 5, 'labelEn' => 'Reach Level 5', 'labelAr' => 'الوصول إلى المستوى 5'],
                ['metric' => 'netWorth', 'target' => 25000, 'labelEn' => 'Accumulate $25,000 Net Worth', 'labelAr' => 'جمع صافي ثروة 25,000$'],
            ],
            'rewards' => ['cash' => 22000, 'xp' => 600, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act2_ch2', 'actId' => 'act_2', 'actNumber' => 2, 'chapterNumber' => 7, 'chapterInAct' => 2, 'minLevel' => 5,
            'npcId' => 'mayor_tariq',
            'titleEn' => 'Forged Zoning Seals', 'titleAr' => 'أختام التنظيم المزورة',
            'synopsisEn' => 'Tariq needs harbor warehouses rezoned overnight using forged magistrate stamps and seasoned crime craft.',
            'synopsisAr' => 'طارق يحتاج لتمرير تراخيص مستودعات الميناء ليلاً عبر أختام قضائية مزورة وخبرة إجرامية عالية.',
            'dialogueEn' => 'Mayor Tariq: "Stamp folio 44-B before sunrise and half the waterfront customs fees flow through our shell accounts."',
            'dialogueAr' => 'العمدة طارق: "اختم الملف 44-ب قبل الفجر وستمر نصف رسوم الواجهة البحرية عبر حساباتنا الوهمية."',
            'objectives' => [
                ['metric' => 'crimeXp', 'target' => 90, 'labelEn' => 'Reach 90 Crime XP', 'labelAr' => 'الوصول إلى 90 خبرة جريمة'],
                ['metric' => 'crimes', 'target' => 5, 'labelEn' => 'Succeed in 5 total crimes', 'labelAr' => 'النجاح في 5 جرائم إجمالاً'],
            ],
            'rewards' => ['cash' => 28000, 'xp' => 750, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act2_ch3', 'actId' => 'act_2', 'actNumber' => 2, 'chapterNumber' => 8, 'chapterInAct' => 3, 'minLevel' => 5,
            'npcId' => 'mayor_tariq',
            'titleEn' => 'City Hall Laundromat', 'titleAr' => 'مغسلة أموال البلدية',
            'synopsisEn' => 'Dirty municipal kickbacks need real-estate cover. Own at least two properties and expand your net worth.',
            'synopsisAr' => 'أموال الرشاوى البلدية تحتاج لغطاء عقاري. امتلك عقارين على الأقل وارفع ثروتك.',
            'dialogueEn' => 'Mayor Tariq: "Cash in a mattress is evidence; cash in deeds and vaults is statesmanship."',
            'dialogueAr' => 'العمدة طارق: "النقد تحت الفراش دليل إدانة، أما النقد في الصكوك والخزائن فهو حنكة دولة."',
            'objectives' => [
                ['metric' => 'ownedPropertiesCount', 'target' => 2, 'labelEn' => 'Own at least 2 Properties', 'labelAr' => 'امتلاك عقارين على الأقل'],
                ['metric' => 'netWorth', 'target' => 60000, 'labelEn' => 'Reach $60,000 Net Worth', 'labelAr' => 'الوصول إلى صافي ثروة 60,000$'],
            ],
            'rewards' => ['cash' => 35000, 'xp' => 900, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act2_ch4', 'actId' => 'act_2', 'actNumber' => 2, 'chapterNumber' => 9, 'chapterInAct' => 4, 'minLevel' => 5,
            'npcId' => 'inspector_haddad',
            'titleEn' => 'Internal Affairs Wiretap', 'titleAr' => 'تنصت الشؤون الداخلية',
            'synopsisEn' => 'Chief Inspector Haddad plants bugs inside City Hall. Complete a University course and win a combat clash to silence his informant.',
            'synopsisAr' => 'كبير المفتشين حداد يزرع أجهزة تنصت في البلدية. أكمل دورة جامعية وانتصر في قتال لإسكات مخبره.',
            'dialogueEn' => 'Inspector Haddad: "Tell Tariq his marble office won\'t save him when the grand jury hears this tape."',
            'dialogueAr' => 'المفتش حداد: "أبلغ طارق أن مكتبه الرخامي لن ينقذه حين تسمع المحكمة هذا التسجيل."',
            'objectives' => [
                ['metric' => 'eduCount', 'target' => 1, 'labelEn' => 'Complete 1 University course', 'labelAr' => 'إتمام دورة جامعية واحدة'],
                ['metric' => 'wins', 'target' => 1, 'labelEn' => 'Win 1 Combat encounter', 'labelAr' => 'الفوز في مواجهة قتالية واحدة'],
            ],
            'rewards' => ['cash' => 45000, 'xp' => 1100, 'sp' => 2, 'merits' => 1],
        ],
        [
            'id' => 'act2_ch5', 'actId' => 'act_2', 'actNumber' => 2, 'chapterNumber' => 10, 'chapterInAct' => 5, 'minLevel' => 5,
            'isFinale' => true, 'npcId' => 'mayor_tariq',
            'titleEn' => 'Warrant in Blood', 'titleAr' => 'مذكرة توقيف بالدم',
            'synopsisEn' => 'Haddad storms the Municipal Archive at midnight. Decide the fate of Tariq\'s Shadow Ledger and defeat Chief Inspector Haddad.',
            'synopsisAr' => 'حداد يقتحم الأرشيف البلدي منتصف الليل. حسم مصير دفتر ظل طارق واهزم كبير المفتشين حداد.',
            'dialogueEn' => 'Mayor Tariq: "Haddad came without backup — he wants the Shadow Ledger for himself! Take him down!"',
            'dialogueAr' => 'العمدة طارق: "جاء حداد بلا تعزيزات.. يريد دفتر الظل لنفسه! اقضِ عليه الآن!"',
            'choicePromptEn' => 'Who controls the City Hall wiretap tapes after Haddad falls?',
            'choicePromptAr' => 'من يسيطر على أشرطة التنصت بعد سقوط المفتش حداد؟',
            'choices' => [
                'syndicate' => [
                    'labelEn' => 'Leak patrol schedules to Syndicate crews (+Syndicate)',
                    'labelAr' => 'تسريب جداول الدوريات لعصابات النقابة (+النقابة)',
                    'outcomeEn' => 'Police blind spots open across every district — street crews cut you in on every midnight heist.',
                    'outcomeAr' => 'انكشفت نقاط ضعف الدوريات في كل الأحياء وباتت العصابات تمنحك حصة من كل عملية ليلية.',
                ],
                'directorate' => [
                    'labelEn' => 'Lock the tapes inside Tariq\'s private vault (+Directorate)',
                    'labelAr' => 'حفظ الأشرطة في خزنة طارق الخاصة (+الإدارة)',
                    'outcomeEn' => 'Mayor Tariq appoints you Shadow Alderman — municipal banks and vaults bend to your signature.',
                    'outcomeAr' => 'عيّنك العمدة طارق مستشار الظل؛ المصارف والخزائن البلدية تفتح أبوابها بتوقيعك.',
                ],
            ],
            'objectives' => [
                ['metric' => 'choice', 'target' => 1, 'labelEn' => 'Choose fate of the Shadow Ledger', 'labelAr' => 'اختيار مصير أشرطة دفتر الظل'],
                ['metric' => 'boss', 'target' => 1, 'labelEn' => 'Defeat Boss: Chief Inspector Haddad (15E)', 'labelAr' => 'هزيمة الزعيم: كبير المفتشين حداد (15 طاقة)'],
            ],
            'rewards' => ['cash' => 75000, 'xp' => 1600, 'sp' => 3, 'merits' => 2],
        ],

        // ==================== ACT III (Lv 10+ / Lv 15 Finale) ====================
        [
            'id' => 'act3_ch1', 'actId' => 'act_3', 'actNumber' => 3, 'chapterNumber' => 11, 'chapterInAct' => 1, 'minLevel' => 10,
            'npcId' => 'madame_vega',
            'titleEn' => 'Runway Whisper', 'titleAr' => 'همس المدرج السري',
            'synopsisEn' => 'Madame Vega opens Hangar 9 to operators with Level 10 clearance and international working capital.',
            'synopsisAr' => 'مدام فيغا تفتح الحظيرة التاسعة لأصحاب المستوى العاشر ورؤوس الأموال العابرة للحدود.',
            'dialogueEn' => 'Madame Vega: "Local streets are a cage, darling. With $120,000 and a clean passport, the world is your warehouse."',
            'dialogueAr' => 'مدام فيغا: "الشوارع المحلية قفص ضيق يا عزيزي. بـ 120,000 دولار وجواز نظيف يصبح العالم مستودعك."',
            'objectives' => [
                ['metric' => 'level', 'target' => 10, 'labelEn' => 'Reach Level 10', 'labelAr' => 'الوصول إلى المستوى 10'],
                ['metric' => 'netWorth', 'target' => 120000, 'labelEn' => 'Hold $120,000 Net Worth', 'labelAr' => 'امتلاك صافي ثروة 120,000$'],
            ],
            'rewards' => ['cash' => 80000, 'xp' => 1800, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act3_ch2', 'actId' => 'act_3', 'actNumber' => 3, 'chapterNumber' => 12, 'chapterInAct' => 2, 'minLevel' => 10,
            'npcId' => 'madame_vega',
            'titleEn' => 'Plushie Contraband', 'titleAr' => 'تهريب الدمى النادرة',
            'synopsisEn' => 'Vega hides microchips and uncut gems inside collector plushies. Acquire at least one Plushie and sharpen your crime XP.',
            'synopsisAr' => 'فيغا تخفي الشرائح والأحجار النفيسة داخل الدمى المحشوة. احصل على دمية نادرة وارفع خبرة الجريمة.',
            'dialogueEn' => 'Madame Vega: "Customs x-rays look for steel, never stitched velvet. Bring me your first exotic plushie courier."',
            'dialogueAr' => 'مدام فيغا: "أشعة الجمارك تبحث عن المعدن لا المخمل المحشو. أحضر لي أول دمية مهربة."',
            'objectives' => [
                ['metric' => 'plushiesCount', 'target' => 1, 'labelEn' => 'Own or collect 1 Plushie', 'labelAr' => 'امتلاك أو جمع دمية نادرة واحدة'],
                ['metric' => 'crimeXp', 'target' => 150, 'labelEn' => 'Reach 150 Crime XP', 'labelAr' => 'الوصول إلى 150 خبرة جريمة'],
            ],
            'rewards' => ['cash' => 95000, 'xp' => 2100, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act3_ch3', 'actId' => 'act_3', 'actNumber' => 3, 'chapterNumber' => 13, 'chapterInAct' => 3, 'minLevel' => 10,
            'npcId' => 'madame_vega',
            'titleEn' => 'Chemist Supply Chains', 'titleAr' => 'سلاسل إمداد الكيميائيين',
            'synopsisEn' => 'Cartel chemists demand disciplined couriers backed by academic study and gym stamina.',
            'synopsisAr' => 'كيميائيو الكارتل يشترطون وسطاء ذوي دراسة علمية ولياقة قتالية عالية.',
            'dialogueEn' => 'Madame Vega: "One drop spilled in transit ruins a million-dollar batch. Train hard and know your formulas."',
            'dialogueAr' => 'مدام فيغا: "قطرة واحدة ضائعة في الجو تفسد شحنة بمليون دولار. تدرّب جيداً وأتقن معادلاتك."',
            'objectives' => [
                ['metric' => 'gymXp', 'target' => 200, 'labelEn' => 'Reach 200 Gym XP', 'labelAr' => 'الوصول إلى 200 خبرة نادي'],
                ['metric' => 'eduCount', 'target' => 1, 'labelEn' => 'Complete at least 1 University course', 'labelAr' => 'إتمام دورة جامعية واحدة على الأقل'],
            ],
            'rewards' => ['cash' => 115000, 'xp' => 2500, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act3_ch4', 'actId' => 'act_3', 'actNumber' => 3, 'chapterNumber' => 14, 'chapterInAct' => 4, 'minLevel' => 10,
            'npcId' => 'madame_vega',
            'titleEn' => 'Customs Radar Blackout', 'titleAr' => 'إظلام رادار الجمارك',
            'synopsisEn' => 'A rival cartel tips off airport customs. Pull 10 successful crimes and build $250,000 in war-chest reserves.',
            'synopsisAr' => 'كارتل منافس يشي بموعد الطائرة للجمارك. أنجز 10 جرائم ناجحة واجمع 250,000 دولار لتأمين المهبط.',
            'dialogueEn' => 'Madame Vega: "Juarez sent a hitman on the red-eye flight. Clear the tarmac before touchdown."',
            'dialogueAr' => 'مدام فيغا: "أرسل كارتل خواريز قاتلاً محترفاً على الرحلة الليلية. أمّن المدرج قبل الهبوط."',
            'objectives' => [
                ['metric' => 'crimes', 'target' => 10, 'labelEn' => 'Succeed in 10 total crimes', 'labelAr' => 'النجاح في 10 جرائم إجمالاً'],
                ['metric' => 'netWorth', 'target' => 250000, 'labelEn' => 'Hold $250,000 Net Worth', 'labelAr' => 'امتلاك صافي ثروة 250,000$'],
            ],
            'rewards' => ['cash' => 140000, 'xp' => 3000, 'sp' => 2, 'merits' => 1],
        ],
        [
            'id' => 'act3_ch5', 'actId' => 'act_3', 'actNumber' => 3, 'chapterNumber' => 15, 'chapterInAct' => 5, 'minLevel' => 15,
            'isFinale' => true, 'npcId' => 'madame_vega',
            'titleEn' => 'Hangar 9 Ambush', 'titleAr' => 'كمين الحظيرة التاسعة',
            'synopsisEn' => 'Unlock Level 15 Airport clearance, choose who controls the international airlift lanes, and survive the Cartel Sicario.',
            'synopsisAr' => 'افتح تصريح المطار في المستوى 15، وحدد من يهيمن على خطوط التهريب الجوي، واهزم قاتل الكارتل.',
            'dialogueEn' => 'Madame Vega: "The Sicario just breached Hangar 9! End him and the skies over Zone City belong to us!"',
            'dialogueAr' => 'مدام فيغا: "قاتل الكارتل اقتحم الحظيرة التاسعة! اقضِ عليه وستصبح سماء الزون ملكاً لنا!"',
            'choicePromptEn' => 'How do you route Hangar 9\'s international smuggling corridors?',
            'choicePromptAr' => 'كيف ستوجّه خطوط التهريب الدولية في الحظيرة التاسعة؟',
            'choices' => [
                'syndicate' => [
                    'labelEn' => 'Open untaxed black-flight lanes for Outlaw crews (+Syndicate)',
                    'labelAr' => 'فتح رحلات مظلمة بلا رسوم لعصابات النقابة (+النقابة)',
                    'outcomeEn' => 'Untraceable night flights flood your crews with contraband, boosting stealth and plunder.',
                    'outcomeAr' => 'الرحلات الليلية تغرق عصاباتك بالبضائع المهربة وترفع كفاءة التخفي والغنائم.',
                ],
                'directorate' => [
                    'labelEn' => 'Grant Diplomatic Pouch immunity via City Hall (+Directorate)',
                    'labelAr' => 'تمرير الشحنات تحت الحصانة الدبلوماسية للبلدية (+الإدارة)',
                    'outcomeEn' => 'Diplomatic seals protect offshore transfers, amplifying bank interest and executive pay.',
                    'outcomeAr' => 'الأختام الدبلوماسية تحمي التحويلات الخارجية وتضاعف عوائد البنوك والرواتب.',
                ],
            ],
            'objectives' => [
                ['metric' => 'level', 'target' => 15, 'labelEn' => 'Reach Level 15 (Airport Clearance)', 'labelAr' => 'الوصول إلى المستوى 15 (تصريح المطار)'],
                ['metric' => 'choice', 'target' => 1, 'labelEn' => 'Choose Airlift Corridor Allegiance', 'labelAr' => 'اختيار ولاء الجسر الجوي'],
                ['metric' => 'boss', 'target' => 1, 'labelEn' => 'Defeat Boss: Cartel Sicario (15E)', 'labelAr' => 'هزيمة الزعيم: قاتل الكارتل المأجور (15 طاقة)'],
            ],
            'rewards' => ['cash' => 220000, 'xp' => 4200, 'sp' => 3, 'merits' => 2],
        ],

        // ==================== ACT IV (Lv 15+) ====================
        [
            'id' => 'act4_ch1', 'actId' => 'act_4', 'actNumber' => 4, 'chapterNumber' => 16, 'chapterInAct' => 1, 'minLevel' => 15,
            'npcId' => 'viktor_marrow',
            'titleEn' => 'Sirens in Sector 7', 'titleAr' => 'صفارات القطاع السابع',
            'synopsisEn' => 'Viktor Marrow\'s armored trucks roll across the 120 Blocks. Prove your combat teeth with 3 real victories.',
            'synopsisAr' => 'شاحنات فيكتور مارو المصفحة تجتاح المئة وعشرين مربعاً. أثبت قوتك بثلاثة انتصارات قتالية.',
            'dialogueEn' => 'Viktor Marrow: "Talk is over. Every block from the Harbor to the Hills pays tribute in blood or lead."',
            'dialogueAr' => 'فيكتور مارو: "انتهى زمن الكلام. كل مربع من الميناء حتى التلال يدفع الجزية بالدم أو الرصاص."',
            'objectives' => [
                ['metric' => 'level', 'target' => 15, 'labelEn' => 'Reach Level 15', 'labelAr' => 'الوصول إلى المستوى 15'],
                ['metric' => 'wins', 'target' => 3, 'labelEn' => 'Win 3 Combat clashes', 'labelAr' => 'الفوز في 3 مواجهات قتالية'],
            ],
            'rewards' => ['cash' => 180000, 'xp' => 3800, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act4_ch2', 'actId' => 'act_4', 'actNumber' => 4, 'chapterNumber' => 17, 'chapterInAct' => 2, 'minLevel' => 15,
            'npcId' => 'general_k1ng',
            'titleEn' => 'Chain of Skulls', 'titleAr' => 'سلسلة الضربات القاضية',
            'synopsisEn' => 'General K1ng rallies street captains to build faction attack chains and relentless gym conditioning.',
            'synopsisAr' => 'الجنرال كينغ يحشد القادة الميدانيين لبناء سلاسل هجومية متتالية ولياقة قتالية حديدية.',
            'dialogueEn' => 'General K1ng: "One hit is a brawl; a coordinated chain breaks a rival family\'s spine."',
            'dialogueAr' => 'الجنرال كينغ: "الضربة الواحدة شجار عابر، أما السلسلة المتصلة فتكسر ظهر العائلة المنافسة."',
            'objectives' => [
                ['metric' => 'facBest', 'target' => 5, 'labelEn' => 'Reach a Best Combat Chain of 5+', 'labelAr' => 'تحقيق سلسلة قتالية من 5 ضربات أو أكثر'],
                ['metric' => 'gymXp', 'target' => 400, 'labelEn' => 'Reach 400 Gym XP', 'labelAr' => 'الوصول إلى 400 خبرة نادي'],
            ],
            'rewards' => ['cash' => 220000, 'xp' => 4400, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act4_ch3', 'actId' => 'act_4', 'actNumber' => 4, 'chapterNumber' => 18, 'chapterInAct' => 3, 'minLevel' => 15,
            'npcId' => 'viktor_marrow',
            'titleEn' => 'The Bounty Ledger', 'titleAr' => 'سجل الرؤوس المطلوبة',
            'synopsisEn' => 'Hit squads hunt every lieutenant on the 120 Blocks. Push total battle stats past 1,000 and Crime XP past 350.',
            'synopsisAr' => 'فرق الاغتيال تطارد القادة في كل حي. ارفع مجموع إحصاءاتك القتالية فوق 1,000 وخبرة الجريمة فوق 350.',
            'dialogueEn' => 'Viktor Marrow: "Your name is third on the Iron Colonel\'s kill sheet. Outgrow the hunter."',
            'dialogueAr' => 'فيكتور مارو: "اسمك الثالث في قائمة اغتيالات العقيد الحديدي. كن أقوى من الصياد."',
            'objectives' => [
                ['metric' => 'totalBattleStats', 'target' => 1000, 'labelEn' => 'Reach 1,000 Total Battle Stats', 'labelAr' => 'الوصول إلى 1,000 مجموع إحصاءات قتالية'],
                ['metric' => 'crimeXp', 'target' => 350, 'labelEn' => 'Reach 350 Crime XP', 'labelAr' => 'الوصول إلى 350 خبرة جريمة'],
            ],
            'rewards' => ['cash' => 275000, 'xp' => 5200, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act4_ch4', 'actId' => 'act_4', 'actNumber' => 4, 'chapterNumber' => 19, 'chapterInAct' => 4, 'minLevel' => 15,
            'npcId' => 'general_k1ng',
            'titleEn' => 'Siege of the Iron Wall', 'titleAr' => 'حصار الجدار الحديدي',
            'synopsisEn' => 'Fortify safehouses across Zone City and amass $750,000 to fund heavy munitions against the Iron Colonel.',
            'synopsisAr' => 'حصّن المخابئ الآمنة في المدينة واجمع 750,000 دولار لتمويل الذخيرة الثقيلة ضد العقيد الحديدي.',
            'dialogueEn' => 'General K1ng: "Stockpile ammo and lock the safehouse shutters — tonight the barricades burn."',
            'dialogueAr' => 'الجنرال كينغ: "خزّن الذخيرة وأوصد المخابئ الآمنة؛ الليلة ستحترق المتاريس."',
            'objectives' => [
                ['metric' => 'ownedPropertiesCount', 'target' => 2, 'labelEn' => 'Control at least 2 Safehouse Properties', 'labelAr' => 'امتلاك مخبأين عقاريين على الأقل'],
                ['metric' => 'netWorth', 'target' => 750000, 'labelEn' => 'Hold $750,000 Net Worth', 'labelAr' => 'امتلاك صافي ثروة 750,000$'],
            ],
            'rewards' => ['cash' => 340000, 'xp' => 6200, 'sp' => 2, 'merits' => 1],
        ],
        [
            'id' => 'act4_ch5', 'actId' => 'act_4', 'actNumber' => 4, 'chapterNumber' => 20, 'chapterInAct' => 5, 'minLevel' => 15,
            'isFinale' => true, 'npcId' => 'viktor_marrow',
            'titleEn' => 'Warlord\'s Reckoning', 'titleAr' => 'حساب أمراء الحرب',
            'synopsisEn' => 'Decide how the 120 Blocks will be ruled after the ceasefire and crush the Rogue Iron Colonel in single combat.',
            'synopsisAr' => 'قرر كيف ستُحكم المربعات المئة والعشرون بعد المعركة، واسحق العقيد الحديدي في نزال حاسم.',
            'dialogueEn' => 'Viktor Marrow: "The Iron Colonel brought a siege squad to Central Bridge. Break his armor and take the blocks!"',
            'dialogueAr' => 'فيكتور مارو: "العقيد الحديدي جلب فرقة حصار إلى الجسر المركزي. حطّم درعه وانتزع السيطرة!"',
            'choicePromptEn' => 'Who claims tribute over the conquered 120 Territory Blocks?',
            'choicePromptAr' => 'لمن تؤول عوائد وجزية المئة وعشرين مربعاً بعد النصر؟',
            'choices' => [
                'syndicate' => [
                    'labelEn' => 'Divide rackets among Faction Warlords (+Syndicate)',
                    'labelAr' => 'تقسيم الإتاوات بين قادة عصابات الميدان (+النقابة)',
                    'outcomeEn' => 'Faction captains swear blood-fealty to your banner, sharpening ambush and plunder lethality.',
                    'outcomeAr' => 'قادة الفصائل يقسمون لك بالولاء الميداني، مما يضاعف غنائم الهجوم والتمويه.',
                ],
                'directorate' => [
                    'labelEn' => 'Place blocks under Municipal Security Martial Law (+Directorate)',
                    'labelAr' => 'إخضاع الأحياء لإدارة الأمن البلدي الخاصة (+الإدارة)',
                    'outcomeEn' => 'Private security checkpoints funnel steady protection taxes straight into your vaults.',
                    'outcomeAr' => 'نقاط التفتيش الخاصة تضخ عوائد الحماية مباشرة إلى خزائنك المحصنة.',
                ],
            ],
            'objectives' => [
                ['metric' => 'choice', 'target' => 1, 'labelEn' => 'Choose Territory Governance Charter', 'labelAr' => 'اختيار ميثاق حكم الأحياء'],
                ['metric' => 'boss', 'target' => 1, 'labelEn' => 'Defeat Boss: Iron Colonel (15E)', 'labelAr' => 'هزيمة الزعيم: العقيد الحديدي (15 طاقة)'],
            ],
            'rewards' => ['cash' => 500000, 'xp' => 8500, 'sp' => 3, 'merits' => 2],
        ],

        // ==================== ACT V (Lv 25+) ====================
        [
            'id' => 'act5_ch1', 'actId' => 'act_5', 'actNumber' => 5, 'chapterNumber' => 21, 'chapterInAct' => 1, 'minLevel' => 25,
            'npcId' => 'mayor_tariq',
            'titleEn' => 'The Council Fractures', 'titleAr' => 'انشقاق المجلس السري',
            'synopsisEn' => 'At Level 25, Mayor Tariq freezes the Underworld Council\'s offshore accounts. Enter the endgame with $2,000,000 net worth.',
            'synopsisAr' => 'عند المستوى 25 يجمّد العمدة طارق حسابات المجلس السري. ادخل معركة النهاية بثروة مليوني دولار.',
            'dialogueEn' => 'Mayor Tariq: "The Shadow Regent thinks elected mayors kneel forever. Tonight we rewrite the constitution in gunpowder."',
            'dialogueAr' => 'العمدة طارق: "الوصي الخفي يظن أن العمد ينحنون للأبد. الليلة نعيد كتابة الدستور بالبارود."',
            'objectives' => [
                ['metric' => 'level', 'target' => 25, 'labelEn' => 'Reach Level 25', 'labelAr' => 'الوصول إلى المستوى 25'],
                ['metric' => 'netWorth', 'target' => 2000000, 'labelEn' => 'Hold $2,000,000 Net Worth', 'labelAr' => 'امتلاك صافي ثروة 2,000,000$'],
            ],
            'rewards' => ['cash' => 450000, 'xp' => 9000, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act5_ch2', 'actId' => 'act_5', 'actNumber' => 5, 'chapterNumber' => 22, 'chapterInAct' => 2, 'minLevel' => 25,
            'npcId' => 'layla',
            'titleEn' => 'Tariq\'s Black Vault', 'titleAr' => 'خزنة طارق السوداء',
            'synopsisEn' => 'Layla decodes the biometric locks beneath Sovereign Tower — requiring academic mastery and elite criminal experience.',
            'synopsisAr' => 'ليلى تفك الأقفال البيومترية تحت البرج السيادي؛ المهمة تتطلب علوماً جامعية وخبرة إجرامية فائقة.',
            'dialogueEn' => 'Layla: "Remember Pier 4? Look how far we climbed. Crack this cipher and every secret in Zone City is ours."',
            'dialogueAr' => 'ليلى: "أتذكر الرصيف الرابع؟ انظر إلى أين وصلنا. افكك هذه الشيفرة وستصبح كل أسرار المدينة في قبضتنا."',
            'objectives' => [
                ['metric' => 'eduCount', 'target' => 2, 'labelEn' => 'Complete at least 2 University courses', 'labelAr' => 'إتمام دورتين جامعيتين على الأقل'],
                ['metric' => 'crimeXp', 'target' => 750, 'labelEn' => 'Reach 750 Crime XP', 'labelAr' => 'الوصول إلى 750 خبرة جريمة'],
            ],
            'rewards' => ['cash' => 550000, 'xp' => 11000, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act5_ch3', 'actId' => 'act_5', 'actNumber' => 5, 'chapterNumber' => 23, 'chapterInAct' => 3, 'minLevel' => 25,
            'npcId' => 'shadow_regent',
            'titleEn' => 'Night of Long Knives', 'titleAr' => 'ليلة الخناجر الطويلة',
            'synopsisEn' => 'The Shadow Regent dispatches elite assassins across all 7 sectors. Hold 10 combat wins and a 15+ best chain.',
            'synopsisAr' => 'الوصي الخفي يرسل نخبة القتلة عبر القطاعات السبعة. حقق 10 انتصارات وسلسلة قتالية من 15 ضربة.',
            'dialogueEn' => 'The Shadow Regent: "Mayors come and go. Fixers bleed out. Only the Council endures."',
            'dialogueAr' => 'الوصي الخفي: "العمد يرحلون، والوسطاء ينزفون، وحدها إرادة المجلس تبقى."',
            'objectives' => [
                ['metric' => 'facBest', 'target' => 15, 'labelEn' => 'Achieve a Best Chain of 15+', 'labelAr' => 'تحقيق أفضل سلسلة قتالية من 15+'],
                ['metric' => 'wins', 'target' => 10, 'labelEn' => 'Win 10 total Combat clashes', 'labelAr' => 'الفوز في 10 مواجهات قتالية إجمالاً'],
            ],
            'rewards' => ['cash' => 700000, 'xp' => 13500, 'sp' => 1, 'merits' => 1],
        ],
        [
            'id' => 'act5_ch4', 'actId' => 'act_5', 'actNumber' => 5, 'chapterNumber' => 24, 'chapterInAct' => 4, 'minLevel' => 25,
            'npcId' => 'madame_vega',
            'titleEn' => 'Central Reserve Breach', 'titleAr' => 'اختراق الاحتياطي المركزي',
            'synopsisEn' => 'Breach the Sovereign Reserve penthouse with 3,500+ total battle stats and 900+ Gym XP.',
            'synopsisAr' => 'اقتحم طابق الخزانة السيادية بإجمالي إحصاءات قتالية يتجاوز 3,500 وخبرة نادي تفوق 900.',
            'dialogueEn' => 'Madame Vega: "The elevator stops on Floor 88. Only one sovereign walks back down."',
            'dialogueAr' => 'مدام فيغا: "المصعد يتوقف في الطابق الثامن والثمانين. عاهل واحد فقط سينزل حياً."',
            'objectives' => [
                ['metric' => 'totalBattleStats', 'target' => 3500, 'labelEn' => 'Reach 3,500 Total Battle Stats', 'labelAr' => 'الوصول إلى 3,500 مجموع إحصاءات قتالية'],
                ['metric' => 'gymXp', 'target' => 900, 'labelEn' => 'Reach 900 Gym XP', 'labelAr' => 'الوصول إلى 900 خبرة نادي'],
            ],
            'rewards' => ['cash' => 900000, 'xp' => 16500, 'sp' => 2, 'merits' => 1],
        ],
        [
            'id' => 'act5_ch5', 'actId' => 'act_5', 'actNumber' => 5, 'chapterNumber' => 25, 'chapterInAct' => 5, 'minLevel' => 25,
            'isFinale' => true, 'npcId' => 'shadow_regent',
            'titleEn' => 'Crown of Zone City', 'titleAr' => 'التاج السيادي لمدينة الزون',
            'synopsisEn' => 'Make the ultimate sovereign choice between Outlaw Kingpin rule or Corrupt State Directorate, and dethrone The Shadow Regent.',
            'synopsisAr' => 'اتخذ القرار السيادي الأخير بين عرش النقابة الخارج عن القانون أو دولة الظل، وأسقط الوصي الخفي.',
            'dialogueEn' => 'The Shadow Regent: "Draw your weapon, pretender — let us see who truly owns Zone City!"',
            'dialogueAr' => 'الوصي الخفي: "أشهر سلاحك أيها الطامح.. لنرَ من يملك مدينة الزون حقاً!"',
            'choicePromptEn' => 'How will you rule Zone City from Floor 88 of Sovereign Tower?',
            'choicePromptAr' => 'كيف ستحكم مدينة الزون من قمة البرج السيادي؟',
            'choices' => [
                'syndicate' => [
                    'labelEn' => 'Crown the Outlaw Syndicate Council (+Syndicate Apex)',
                    'labelAr' => 'تتويج مجلس النقابة الخارج عن القانون (+ذروة النقابة)',
                    'outcomeEn' => 'Mayor Tariq kneels before the Outlaw Crown — every street, dock, and heist answers to you.',
                    'outcomeAr' => 'انحنى العمدة طارق أمام تاج النقابة؛ كل شارع وميناء وعملية بات بأمرك.',
                ],
                'directorate' => [
                    'labelEn' => 'Seize the Sovereign State Directorate (+Directorate Apex)',
                    'labelAr' => 'إحكام قبضة الدولة العميقة والخزانة السيادية (+ذروة الإدارة)',
                    'outcomeEn' => 'You absorb both City Hall and the Central Reserve — banks, vaults, and corporations pay sovereign tribute.',
                    'outcomeAr' => 'أخضعت القصر البلدي والاحتياطي المركزي معاً؛ البنوك والشركات تدفع لك الجزية السيادية.',
                ],
            ],
            'objectives' => [
                ['metric' => 'choice', 'target' => 1, 'labelEn' => 'Declare Sovereign Rule (Syndicate vs Directorate)', 'labelAr' => 'إعلان الحكم السيادي (النقابة أو الإدارة)'],
                ['metric' => 'boss', 'target' => 1, 'labelEn' => 'Defeat Final Boss: The Shadow Regent (15E)', 'labelAr' => 'هزيمة الزعيم الأخير: الوصي الخفي (15 طاقة)'],
            ],
            'rewards' => ['cash' => 1500000, 'xp' => 25000, 'sp' => 3, 'merits' => 2],
        ],
    ];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?\Closure $random = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
    }

    public function snapshot(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $story = $this->normalizeStoryState($state);
            if ($story !== ($state['story'] ?? null)) {
                $state['story'] = $story;
                $this->saveProgression($playerId, $state, $version);
            }
            return $this->buildView($player, $state);
        });
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $action = trim($action);
        if ($action === '') {
            throw new InvalidArgumentException('Story campaign action is required.');
        }

        // Ensure player_progression row is seeded before opening our transaction.
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId, $action, $payload): array {
            $this->resources->regenerate($playerId);
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $nowMs = $this->nowMs();

            if ((int) ($state['jailUntil'] ?? 0) > $nowMs || (int) ($state['hospUntil'] ?? 0) > $nowMs) {
                throw new RuntimeException('You must leave jail or hospital before advancing Story Campaign actions.');
            }

            $story = $this->normalizeStoryState($state);
            $correlationId = bin2hex(random_bytes(16));
            $chapterId = trim((string) ($payload['chapterId'] ?? $payload['id'] ?? $story['activeChapterId'] ?? ''));

            switch ($action) {
                case 'chapter.start':
                    $chapter = $this->requireChapter($chapterId);
                    $this->assertChapterUnlocked($chapter, $player, $story);
                    $story['activeChapterId'] = $chapter['id'];
                    $story['startedChapters'][$chapter['id']] ??= $nowMs;
                    $state['story'] = $story;
                    $this->saveProgression($playerId, $state, $version);
                    $this->events->publish(new DomainEvent('StoryChapterStarted', [
                        'playerId' => $playerId,
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'correlationId' => $correlationId,
                    ]));
                    $result = [
                        'action' => 'chapter.start',
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'titleEn' => $chapter['titleEn'],
                        'titleAr' => $chapter['titleAr'],
                        'dialogueEn' => $chapter['dialogueEn'],
                        'dialogueAr' => $chapter['dialogueAr'],
                    ];
                    break;

                case 'chapter.choice':
                    $chapter = $this->requireChapter($chapterId);
                    $this->assertChapterUnlocked($chapter, $player, $story);
                    if (empty($chapter['isFinale']) || empty($chapter['choices'])) {
                        throw new InvalidArgumentException('Only Act Finale chapters present a Syndicate vs Directorate moral choice.');
                    }
                    $choice = strtolower(trim((string) ($payload['choice'] ?? $payload['alignment'] ?? '')));
                    if (!in_array($choice, ['syndicate', 'directorate'], true)) {
                        throw new InvalidArgumentException("Alignment choice must be 'syndicate' or 'directorate'.");
                    }
                    $story['startedChapters'][$chapter['id']] ??= $nowMs;
                    $story['activeChapterId'] = $chapter['id'];
                    $story['choices'][$chapter['id']] = $choice;
                    $story['actChoices'][$chapter['actId']] = $choice;
                    $this->recomputeAlignment($story, $choice);
                    $state['story'] = $story;
                    $this->saveProgression($playerId, $state, $version);

                    $choiceMeta = $chapter['choices'][$choice];
                    $this->events->publish(new DomainEvent('StoryAlignmentChosen', [
                        'playerId' => $playerId,
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'choice' => $choice,
                        'alignment' => $story['alignment'],
                        'correlationId' => $correlationId,
                    ]));
                    $result = [
                        'action' => 'chapter.choice',
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'choice' => $choice,
                        'alignment' => $story['alignment'],
                        'bonuses' => $story['alignmentBonuses'],
                        'outcomeEn' => $choiceMeta['outcomeEn'],
                        'outcomeAr' => $choiceMeta['outcomeAr'],
                    ];
                    break;

                case 'chapter.bossFight':
                    $chapter = $this->requireChapter($chapterId);
                    $this->assertChapterUnlocked($chapter, $player, $story);
                    if (empty($chapter['isFinale'])) {
                        throw new InvalidArgumentException('This chapter does not have an Act Boss encounter.');
                    }
                    if (!empty($story['bossVictories'][$chapter['id']])) {
                        throw new RuntimeException('Act Boss has already been defeated for this chapter.');
                    }
                    if ((int) $player['energy'] < self::BOSS_FIGHT_ENERGY_COST) {
                        throw new RuntimeException('Need ' . self::BOSS_FIGHT_ENERGY_COST . ' Energy to challenge the Act Boss.');
                    }

                    $actDef = $this->requireAct($chapter['actId']);
                    $boss = $actDef['boss'];

                    $newEnergy = (int) $player['energy'] - self::BOSS_FIGHT_ENERGY_COST;
                    $this->database->execute(
                        'UPDATE players SET energy = :energy WHERE id = :id',
                        ['energy' => $newEnergy, 'id' => $playerId],
                    );

                    $story['startedChapters'][$chapter['id']] ??= $nowMs;
                    $story['activeChapterId'] = $chapter['id'];
                    $story['bossAttempts'] = (int) ($story['bossAttempts'] ?? 0) + 1;

                    $combat = $this->resolveBossCombat($player, $state, $story, $boss);
                    $story['lastBossLog'] = $combat;

                    if ($combat['victory']) {
                        $story['bossVictories'][$chapter['id']] = [
                            'bossId' => $boss['id'],
                            'bossNameEn' => $boss['nameEn'],
                            'bossNameAr' => $boss['nameAr'],
                            'rounds' => $combat['roundsCount'],
                            'damageDealt' => $combat['damageDealt'],
                            'damageTaken' => $combat['damageTaken'],
                            'defeatedAt' => $nowMs,
                        ];
                        $remainingLife = max(1, (int) $combat['playerHpRemaining']);
                        $this->database->execute(
                            'UPDATE players SET life = :life WHERE id = :id',
                            ['life' => $remainingLife, 'id' => $playerId],
                        );
                        $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
                        $state['skill']['weapon_mastery'] = min(100, (int) ($state['skill']['weapon_mastery'] ?? 0) + 2);
                        $state['story'] = $story;
                        $this->saveProgression($playerId, $state, $version);

                        $this->events->publish(new DomainEvent('StoryBossDefeated', [
                            'playerId' => $playerId,
                            'chapterId' => $chapter['id'],
                            'bossId' => $boss['id'],
                            'rounds' => $combat['roundsCount'],
                            'energySpent' => self::BOSS_FIGHT_ENERGY_COST,
                            'correlationId' => $correlationId,
                        ]));
                    } else {
                        $hospMs = self::BOSS_DEFEAT_HOSPITAL_SECONDS * 1000;
                        $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + $hospMs);
                        $this->database->execute(
                            'UPDATE players SET life = 1 WHERE id = :id',
                            ['id' => $playerId],
                        );
                        $state['story'] = $story;
                        $this->saveProgression($playerId, $state, $version);

                        $this->events->publish(new DomainEvent('StoryBossDefeatHospitalized', [
                            'playerId' => $playerId,
                            'chapterId' => $chapter['id'],
                            'bossId' => $boss['id'],
                            'hospitalSeconds' => self::BOSS_DEFEAT_HOSPITAL_SECONDS,
                            'energySpent' => self::BOSS_FIGHT_ENERGY_COST,
                            'correlationId' => $correlationId,
                        ]));
                    }

                    $player = $this->loadPlayer($playerId);
                    $result = [
                        'action' => 'chapter.bossFight',
                        'chapterId' => $chapter['id'],
                        'energySpent' => self::BOSS_FIGHT_ENERGY_COST,
                        ...$combat,
                        'hospitalSeconds' => $combat['victory'] ? 0 : self::BOSS_DEFEAT_HOSPITAL_SECONDS,
                    ];
                    break;

                case 'chapter.claim':
                    $chapter = $this->requireChapter($chapterId);
                    $this->assertChapterUnlocked($chapter, $player, $story);
                    if (!empty($story['claimedChapters'][$chapter['id']])) {
                        throw new RuntimeException('This chapter reward has already been claimed.');
                    }

                    $metrics = $this->collectPlayerMetrics($player, $state);
                    $evaluated = $this->evaluateChapterObjectives($chapter, $metrics, $story);
                    if (!$evaluated['allComplete']) {
                        throw new RuntimeException('Complete all chapter objectives before claiming rewards.');
                    }

                    $cashReward = (int) $chapter['rewards']['cash'];
                    $xpReward = (int) $chapter['rewards']['xp'];
                    $spReward = (int) $chapter['rewards']['sp'];
                    $meritReward = (int) $chapter['rewards']['merits'];

                    $newCash = (int) $player['cash'] + $cashReward;
                    $newXp = (int) $player['xp'] + $xpReward;
                    $this->database->execute(
                        'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
                        ['cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
                    );
                    if ($cashReward > 0) {
                        $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'story.chapter.claim', $correlationId);
                    }

                    $story['startedChapters'][$chapter['id']] ??= $nowMs;
                    $story['claimedChapters'][$chapter['id']] = $nowMs;
                    $story['spEarned'] = (int) ($story['spEarned'] ?? 0) + $spReward;
                    $story['meritsEarned'] = (int) ($story['meritsEarned'] ?? 0) + $meritReward;

                    $state['merits'] = (int) ($state['merits'] ?? 0) + $meritReward;
                    $state['rpg'] = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
                    $state['rpg']['storySpEarned'] = $story['spEarned'];

                    $awardedRelic = null;
                    $awardedItem = null;
                    if (!empty($chapter['isFinale'])) {
                        $actDef = $this->requireAct($chapter['actId']);
                        $relic = $actDef['relic'];
                        $awardedRelic = [
                            ...$relic,
                            'actId' => $chapter['actId'],
                            'actNumber' => $chapter['actNumber'],
                            'awardedAt' => $nowMs,
                        ];
                        $story['relics'][$relic['id']] = $awardedRelic;
                        $story['activeTitle'] = [
                            'en' => $relic['titleEn'],
                            'ar' => $relic['titleAr'],
                        ];

                        $bonusItemId = (string) ($relic['bonusItemId'] ?? '');
                        if ($bonusItemId !== '') {
                            $state['inv'] = is_array($state['inv'] ?? null) ? $state['inv'] : [];
                            $state['inv'][$bonusItemId] = (int) ($state['inv'][$bonusItemId] ?? 0) + 1;
                            $this->ledger->record(
                                $playerId,
                                'item:' . $bonusItemId,
                                1,
                                (int) $state['inv'][$bonusItemId],
                                'story.act.relic',
                                $correlationId,
                            );
                            $awardedItem = $bonusItemId;
                        }
                    }

                    $story['activeChapterId'] = $this->nextActiveChapterId($story);
                    $state['story'] = $story;
                    $this->saveProgression($playerId, $state, $version);

                    // Trigger LevelingService::sync AFTER saving progression so level-ups (or held levels) reconcile cleanly.
                    $levelUp = (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);
                    $player = $this->loadPlayer($playerId);
                    [$state] = $this->loadProgression($playerId);

                    $this->events->publish(new DomainEvent('StoryChapterClaimed', [
                        'playerId' => $playerId,
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'cashReward' => $cashReward,
                        'xpReward' => $xpReward,
                        'spReward' => $spReward,
                        'meritReward' => $meritReward,
                        'relicId' => $awardedRelic['id'] ?? null,
                        'bonusItemId' => $awardedItem,
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'chapter.claim',
                        'chapterId' => $chapter['id'],
                        'actId' => $chapter['actId'],
                        'cashAwarded' => $cashReward,
                        'xpAwarded' => $xpReward,
                        'spAwarded' => $spReward,
                        'meritsAwarded' => $meritReward,
                        'relicAwarded' => $awardedRelic,
                        'bonusItemId' => $awardedItem,
                        'levelUp' => $levelUp,
                        'nextChapterId' => $story['activeChapterId'],
                    ];
                    break;

                default:
                    throw new InvalidArgumentException("Unsupported story campaign action: {$action}");
            }

            return [
                ...$this->buildView($player, $state),
                'result' => $result,
            ];
        });
    }

    private function resolveBossCombat(array $player, array $state, array $story, array $boss): array
    {
        $catalog = (new GameplayCatalog($this->database, $this->events))->active();
        $loadout = LoadoutService::resolve($state, $catalog['items'] ?? []);

        $weaponMult = max(1.0, (float) ($loadout['weaponMultiplier'] ?? 1.0));
        $armorRed = min(0.85, max(0.0, (float) ($loadout['armorReduction'] ?? 0.0)));

        $skillBonuses = is_array($state['rpg']['bonuses'] ?? null) ? $state['rpg']['bonuses'] : [];
        $combatDmgBonusPct = (int) ($skillBonuses['combatDamagePct'] ?? 0);
        $directorateDefBonusPct = (int) ($story['alignmentBonuses']['defensePct'] ?? 0);

        $playerStr = max(5.0, (float) $player['strength']) * $weaponMult * (1.0 + $combatDmgBonusPct / 100.0);
        $playerDef = max(5.0, (float) $player['defense']) * (1.0 + $directorateDefBonusPct / 100.0);
        $playerSpd = max(5.0, (float) $player['speed']);
        $playerDex = max(5.0, (float) $player['dexterity']);

        $bossStr = max(5.0, (float) $boss['strength']);
        $bossDef = max(5.0, (float) $boss['defense']);
        $bossSpd = max(5.0, (float) $boss['speed']);
        $bossDex = max(5.0, (float) $boss['dexterity']);

        $playerHp = max(1, (int) $player['life']);
        $playerMaxHp = max(1, (int) $player['max_life']);
        $bossHp = (int) $boss['hp'];
        $bossMaxHp = (int) $boss['hp'];

        $rounds = [];
        $damageDealt = 0;
        $damageTaken = 0;

        for ($round = 1; $round <= 12 && $playerHp > 0 && $bossHp > 0; $round++) {
            $playerHitChance = (int) min(96, max(25, round(68 + ($playerSpd / max(1.0, $playerSpd + $bossDex)) * 30 - 12)));
            $playerHit = $this->roll(1, 100) <= $playerHitChance;
            $pDmg = 0;
            if ($playerHit) {
                $ratio = max(0.28, min(4.5, $playerStr / max(1.0, $bossDef)));
                $variance = $this->roll(90, 112) / 100.0;
                $pDmg = max(6, (int) round((18.0 + sqrt($playerStr) * 3.8) * $ratio * $variance));
                $bossHp = max(0, $bossHp - $pDmg);
                $damageDealt += $pDmg;
            }

            $bDmg = 0;
            $bossHit = false;
            if ($bossHp > 0) {
                $bossHitChance = (int) min(92, max(20, round(62 + ($bossSpd / max(1.0, $bossSpd + $playerDex)) * 28 - 12)));
                $bossHit = $this->roll(1, 100) <= $bossHitChance;
                if ($bossHit) {
                    $bRatio = max(0.20, min(3.8, $bossStr / max(1.0, $playerDef)));
                    $bVar = $this->roll(88, 110) / 100.0;
                    $rawBossDmg = (14.0 + sqrt($bossStr) * 3.1) * $bRatio * $bVar * (1.0 - $armorRed);
                    $bDmg = max(3, (int) round($rawBossDmg));
                    $playerHp = max(0, $playerHp - $bDmg);
                    $damageTaken += $bDmg;
                }
            }

            $rounds[] = [
                'round' => $round,
                'playerHit' => $playerHit,
                'playerDamage' => $pDmg,
                'bossHit' => $bossHit,
                'bossDamage' => $bDmg,
                'playerHp' => $playerHp,
                'bossHp' => $bossHp,
            ];
        }

        // If 12 rounds elapsed without a KO, winner is decided by remaining HP share only if boss <= 0 or player dealt decisive >85% damage while staying healthy.
        $victory = $bossHp <= 0 || ($playerHp > 0 && ($playerHp / $playerMaxHp) > ($bossHp / $bossMaxHp) && $bossHp <= (int) round($bossMaxHp * 0.15));

        return [
            'bossId' => $boss['id'],
            'bossNameEn' => $boss['nameEn'],
            'bossNameAr' => $boss['nameAr'],
            'victory' => $victory,
            'outcome' => $victory ? 'victory' : 'defeat',
            'roundsCount' => count($rounds),
            'damageDealt' => $damageDealt,
            'damageTaken' => $damageTaken,
            'playerHpRemaining' => $victory ? max(1, $playerHp) : 0,
            'bossHpRemaining' => $victory ? 0 : max(1, $bossHp),
            'weaponUsed' => $loadout['weaponId'] ?? 'fists',
            'armorUsed' => $loadout['armorId'] ?? null,
            'rounds' => $rounds,
        ];
    }

    private function buildView(array $player, array $state): array
    {
        $story = $this->normalizeStoryState($state);
        $metrics = $this->collectPlayerMetrics($player, $state);
        $activeChapterId = $this->resolveActiveChapterId($story, $player);

        $flatChapters = [];
        $chaptersByAct = [];
        foreach (self::CHAPTERS as $chapter) {
            $unlocked = $this->isChapterUnlocked($chapter, $player, $story);
            $claimed = !empty($story['claimedChapters'][$chapter['id']]);
            $started = !empty($story['startedChapters'][$chapter['id']]) || $chapter['id'] === $activeChapterId;
            $eval = $this->evaluateChapterObjectives($chapter, $metrics, $story);
            $actDef = $this->requireAct($chapter['actId']);
            $npc = self::NPCS[$chapter['npcId']] ?? self::NPCS['layla'];

            $uiNpcKey = match ($chapter['npcId']) {
                'mayor_tariq', 'inspector_haddad' => 'tariq',
                'madame_vega' => 'vega',
                'viktor_marrow', 'general_k1ng', 'shadow_regent' => 'marrow',
                default => $chapter['npcId'],
            };

            $bossInfo = null;
            $bossDefeated = false;
            $bossNameEn = null;
            $bossNameAr = null;
            if (!empty($chapter['isFinale'])) {
                $boss = $actDef['boss'];
                $victoryRecord = $story['bossVictories'][$chapter['id']] ?? null;
                $bossDefeated = $victoryRecord !== null;
                $bossNameEn = $boss['nameEn'];
                $bossNameAr = $boss['nameAr'];
                $bossInfo = [
                    ...$boss,
                    'name' => ['en' => $boss['nameEn'], 'ar' => $boss['nameAr']],
                    'energyCost' => self::BOSS_FIGHT_ENERGY_COST,
                    'defeated' => $bossDefeated,
                    'victoryRecord' => $victoryRecord,
                    'canFight' => $unlocked && !$claimed && !$bossDefeated && (int) $player['energy'] >= self::BOSS_FIGHT_ENERGY_COST,
                ];
            }

            $selectedChoice = isset($story['choices'][$chapter['id']]) ? (string) $story['choices'][$chapter['id']] : null;
            $choiceOptions = null;
            if (!empty($chapter['choices'])) {
                $choiceOptions = [
                    'promptEn' => $chapter['choicePromptEn'] ?? '',
                    'promptAr' => $chapter['choicePromptAr'] ?? '',
                    'selected' => $selectedChoice,
                    'syndicate' => $chapter['choices']['syndicate'],
                    'directorate' => $chapter['choices']['directorate'],
                ];
            }

            $enriched = [
                'id' => $chapter['id'],
                'act' => $chapter['actNumber'],
                'actId' => $chapter['actId'],
                'actNumber' => $chapter['actNumber'],
                'number' => $chapter['chapterInAct'],
                'chapterNumber' => $chapter['chapterInAct'],
                'globalChapterNumber' => $chapter['chapterNumber'],
                'chapterInAct' => $chapter['chapterInAct'],
                'minLevel' => $chapter['minLevel'],
                'isFinale' => !empty($chapter['isFinale']),
                'hasBoss' => !empty($chapter['isFinale']),
                'hasChoice' => !empty($chapter['choices']),
                'bossNameEn' => $bossNameEn,
                'bossNameAr' => $bossNameAr,
                'bossDefeated' => $bossDefeated,
                'titleEn' => $chapter['titleEn'],
                'titleAr' => $chapter['titleAr'],
                'title' => ['en' => $chapter['titleEn'], 'ar' => $chapter['titleAr']],
                'synopsisEn' => $chapter['synopsisEn'],
                'synopsisAr' => $chapter['synopsisAr'],
                'dialogueEn' => $chapter['dialogueEn'],
                'dialogueAr' => $chapter['dialogueAr'],
                'npc' => $uiNpcKey,
                'npcMeta' => $npc,
                'unlocked' => $unlocked,
                'started' => $started,
                'claimed' => $claimed,
                'completed' => $claimed,
                'active' => $chapter['id'] === $activeChapterId,
                'claimable' => $unlocked && !$claimed && $eval['allComplete'],
                'objectives' => $eval['objectives'],
                'objectivesDone' => $eval['completedCount'],
                'objectivesCompleted' => $eval['completedCount'],
                'objectivesTotal' => $eval['totalCount'],
                'progressPct' => $eval['progressPct'],
                'choice' => $selectedChoice,
                'choiceOptions' => $choiceOptions,
                'boss' => $bossInfo,
                'rewards' => [
                    ...$chapter['rewards'],
                    'relic' => !empty($chapter['isFinale']) ? $actDef['relic'] : null,
                ],
            ];

            $flatChapters[] = $enriched;
            $chaptersByAct[$chapter['actId']][] = $enriched;
        }

        $actsView = [];
        foreach (self::ACTS as $act) {
            $actChapters = $chaptersByAct[$act['id']] ?? [];
            $claimedInAct = count(array_filter($actChapters, static fn (array $c): bool => $c['claimed']));
            $actsView[] = [
                'id' => $act['id'],
                'actNumber' => $act['actNumber'],
                'minLevel' => $act['minLevel'],
                'titleEn' => $act['titleEn'],
                'titleAr' => $act['titleAr'],
                'title' => ['en' => $act['titleEn'], 'ar' => $act['titleAr']],
                'subtitleEn' => $act['subtitleEn'],
                'subtitleAr' => $act['subtitleAr'],
                'portrait' => $act['portrait'],
                'unlocked' => (int) $player['level'] >= (int) $act['minLevel'] || !empty($story['claimedChapters']['act' . ($act['actNumber'] - 1) . '_ch5']),
                'completed' => $claimedInAct === count($actChapters),
                'claimedCount' => $claimedInAct,
                'totalCount' => count($actChapters),
                'alignmentChoice' => $story['actChoices'][$act['id']] ?? null,
                'relic' => $act['relic'],
                'boss' => $act['boss'],
                'chapters' => $actChapters,
            ];
        }

        $activeChapterView = $flatChapters[0];
        foreach ($flatChapters as $c) {
            if ($c['id'] === $activeChapterId) {
                $activeChapterView = $c;
                break;
            }
        }

        $claimedTotal = count($story['claimedChapters']);
        $totalChapters = count(self::CHAPTERS);

        $alignmentCurrent = (string) ($story['alignment'] ?? 'neutral');
        $alignmentLabels = match ($alignmentCurrent) {
            'syndicate' => ['en' => 'Syndicate Outlaw Kingpin', 'ar' => 'ملك الجريمة الخارج عن القانون (النقابة)'],
            'directorate' => ['en' => 'Corrupt State Insider', 'ar' => 'رجل الدولة الفاسد (الإدارة)'],
            default => ['en' => 'Unaligned Freelancer', 'ar' => 'مستقل غير منحاز'],
        };

        return [
            'player' => [
                'id' => $player['id'],
                'username' => $player['username'],
                'level' => $player['level'],
                'xp' => $player['xp'],
                'cash' => $player['cash'],
                'energy' => $player['energy'],
                'max_energy' => $player['max_energy'],
                'life' => $player['life'],
                'max_life' => $player['max_life'],
                'net_worth' => $player['net_worth'],
                'total_battle_stats' => $player['total_battle_stats'],
            ],
            'banner' => [
                'activeChapterId' => $activeChapterView['id'],
                'actNumber' => $activeChapterView['actNumber'],
                'chapterInAct' => $activeChapterView['chapterInAct'],
                'chapterNumber' => $activeChapterView['chapterNumber'],
                'headlineEn' => sprintf(
                    'Act %s · Ch.%d: %s — %d/%d Objectives',
                    $this->romanAct((int) $activeChapterView['actNumber']),
                    (int) $activeChapterView['chapterInAct'],
                    $activeChapterView['titleEn'],
                    (int) $activeChapterView['objectivesCompleted'],
                    (int) $activeChapterView['objectivesTotal'],
                ),
                'headlineAr' => sprintf(
                    'الفصل %d · ج%d: %s — %d/%d أهداف',
                    (int) $activeChapterView['actNumber'],
                    (int) $activeChapterView['chapterInAct'],
                    $activeChapterView['titleAr'],
                    (int) $activeChapterView['objectivesCompleted'],
                    (int) $activeChapterView['objectivesTotal'],
                ),
                'objectivesCompleted' => $activeChapterView['objectivesCompleted'],
                'objectivesTotal' => $activeChapterView['objectivesTotal'],
                'progressPct' => $activeChapterView['progressPct'],
                'claimable' => $activeChapterView['claimable'],
                'campaignCompleted' => $claimedTotal >= $totalChapters,
                'claimedChaptersCount' => $claimedTotal,
                'totalChaptersCount' => $totalChapters,
                'campaignProgressPct' => (int) round(($claimedTotal / max(1, $totalChapters)) * 100),
            ],
            'activeChapterId' => $activeChapterView['id'],
            'activeChapter' => $activeChapterView,
            'alignment' => $alignmentCurrent === 'neutral' ? 'unaligned' : $alignmentCurrent,
            'alignmentDetails' => [
                'current' => $alignmentCurrent,
                'labelEn' => $alignmentLabels['en'],
                'labelAr' => $alignmentLabels['ar'],
                'points' => $story['alignmentPoints'],
                'bonuses' => $story['alignmentBonuses'],
                'actChoices' => $story['actChoices'],
            ],
            'story' => $story,
            'totals' => [
                'claimedChapters' => $claimedTotal,
                'totalChapters' => $totalChapters,
                'spEarned' => (int) ($story['spEarned'] ?? 0),
                'meritsEarned' => (int) ($story['meritsEarned'] ?? 0),
                'bossesDefeated' => count($story['bossVictories']),
            ],
            'relics' => array_values($story['relics']),
            'activeTitle' => $story['activeTitle'],
            'metrics' => $metrics,
            'lastBossLog' => $story['lastBossLog'],
            'acts' => $actsView,
            'chapters' => $flatChapters,
        ];
    }

    private function collectPlayerMetrics(array $player, array $state): array
    {
        $ctr = is_array($state['ctr'] ?? null) ? $state['ctr'] : [];
        $eduDone = is_array($state['eduDone'] ?? null) ? array_filter($state['eduDone']) : [];
        $ownedProps = is_array($state['ownedProperties'] ?? null) ? array_filter($state['ownedProperties']) : [];
        $inv = is_array($state['inv'] ?? null) ? $state['inv'] : [];

        $plushiesOwned = count(is_array($state['plushies'] ?? null) ? array_filter($state['plushies']) : []);
        foreach ($inv as $itemId => $qty) {
            if ((int) $qty > 0 && str_starts_with((string) $itemId, 'plush_')) {
                $plushiesOwned += (int) $qty;
            }
        }

        $netWorth = (int) $player['cash']
            + (int) $player['bank_balance']
            + (int) ($state['vaultBalance'] ?? 0)
            + (int) ($state['activeCd']['principal'] ?? 0);

        return [
            'level' => (int) $player['level'],
            'crimes' => (int) ($ctr['crimes'] ?? 0),
            'trains' => (int) ($ctr['trains'] ?? 0),
            'wins' => (int) ($ctr['wins'] ?? 0),
            'shifts' => (int) ($ctr['shifts'] ?? 0),
            'buys' => (int) ($ctr['buys'] ?? 0),
            'netWorth' => $netWorth,
            'crimeXp' => (int) ($state['crimeXp'] ?? 0),
            'gymXp' => (int) ($state['gymXp'] ?? 0),
            'eduCount' => count($eduDone),
            'ownedPropertiesCount' => max(1, count($ownedProps)),
            'plushiesCount' => $plushiesOwned,
            'facBest' => (int) ($state['fac']['best'] ?? 0),
            'totalBattleStats' => (int) $player['total_battle_stats'],
        ];
    }

    /**
     * @return array{objectives: list<array<string, mixed>>, completedCount: int, totalCount: int, progressPct: int, allComplete: bool}
     */
    private function evaluateChapterObjectives(array $chapter, array $metrics, array $story): array
    {
        $rows = [];
        $completedCount = 0;
        foreach ($chapter['objectives'] as $obj) {
            $metricKey = (string) $obj['metric'];
            $target = max(1, (int) $obj['target']);
            if ($metricKey === 'choice') {
                $current = isset($story['choices'][$chapter['id']]) ? 1 : 0;
            } elseif ($metricKey === 'boss') {
                $current = isset($story['bossVictories'][$chapter['id']]) ? 1 : 0;
            } else {
                $current = (int) ($metrics[$metricKey] ?? 0);
            }
            $complete = $current >= $target;
            if ($complete) {
                $completedCount++;
            }
            $rows[] = [
                'id' => 'obj_' . $metricKey,
                'metric' => $metricKey,
                'target' => $target,
                'current' => $current,
                'progress' => $current,
                'remaining' => max(0, $target - $current),
                'progressPct' => (int) min(100, round((min($current, $target) / $target) * 100)),
                'complete' => $complete,
                'completed' => $complete,
                'done' => $complete,
                'labelEn' => $obj['labelEn'],
                'labelAr' => $obj['labelAr'],
            ];
        }
        $totalCount = max(1, count($rows));
        return [
            'objectives' => $rows,
            'completedCount' => $completedCount,
            'totalCount' => $totalCount,
            'progressPct' => (int) round(($completedCount / $totalCount) * 100),
            'allComplete' => $completedCount === count($rows),
        ];
    }

    private function isChapterUnlocked(array $chapter, array $player, array $story): bool
    {
        if (!empty($story['claimedChapters'][$chapter['id']])) {
            return true;
        }
        if ((int) $player['level'] < (int) $chapter['minLevel']) {
            return false;
        }
        $inAct = (int) $chapter['chapterInAct'];
        if ($inAct > 1) {
            $prevId = sprintf('act%d_ch%d', (int) $chapter['actNumber'], $inAct - 1);
            return !empty($story['claimedChapters'][$prevId]);
        }
        return true;
    }

    private function assertChapterUnlocked(array $chapter, array $player, array $story): void
    {
        if ((int) $player['level'] < (int) $chapter['minLevel']) {
            throw new RuntimeException("Requires Player Level {$chapter['minLevel']} to access {$chapter['titleEn']}.");
        }
        if (!$this->isChapterUnlocked($chapter, $player, $story)) {
            $prevId = sprintf('act%d_ch%d', (int) $chapter['actNumber'], (int) $chapter['chapterInAct'] - 1);
            throw new RuntimeException("Claim previous chapter ({$prevId}) in this Act first.");
        }
    }

    private function recomputeAlignment(array &$story, string $latestChoice): void
    {
        $syn = 0;
        $dir = 0;
        foreach ($story['actChoices'] as $pick) {
            if ($pick === 'syndicate') {
                $syn++;
            } elseif ($pick === 'directorate') {
                $dir++;
            }
        }
        $story['alignmentPoints'] = ['syndicate' => $syn, 'directorate' => $dir];
        if ($syn > $dir) {
            $story['alignment'] = 'syndicate';
        } elseif ($dir > $syn) {
            $story['alignment'] = 'directorate';
        } else {
            $story['alignment'] = ($syn === 0 && $dir === 0) ? 'neutral' : $latestChoice;
        }
        $story['alignmentBonuses'] = [
            'crimeSuccessPct' => $syn * 3,
            'stealthPct' => $syn * 4,
            'mugPlunderPct' => $syn * 4,
            'bankAprPct' => $dir * 3,
            'vaultCapacityPct' => $dir * 5,
            'jobPayPct' => $dir * 4,
            'defensePct' => $dir * 3,
        ];
    }

    private function normalizeStoryState(array $state): array
    {
        $raw = is_array($state['story'] ?? null) ? $state['story'] : [];
        $story = [
            'activeChapterId' => is_string($raw['activeChapterId'] ?? null) && $raw['activeChapterId'] !== ''
                ? $raw['activeChapterId']
                : 'act1_ch1',
            'startedChapters' => is_array($raw['startedChapters'] ?? null) ? $raw['startedChapters'] : ['act1_ch1' => $this->nowMs()],
            'claimedChapters' => is_array($raw['claimedChapters'] ?? null) ? $raw['claimedChapters'] : [],
            'choices' => is_array($raw['choices'] ?? null) ? $raw['choices'] : [],
            'actChoices' => is_array($raw['actChoices'] ?? null) ? $raw['actChoices'] : [],
            'alignment' => is_string($raw['alignment'] ?? null) ? $raw['alignment'] : 'neutral',
            'alignmentPoints' => is_array($raw['alignmentPoints'] ?? null)
                ? ['syndicate' => (int) ($raw['alignmentPoints']['syndicate'] ?? 0), 'directorate' => (int) ($raw['alignmentPoints']['directorate'] ?? 0)]
                : ['syndicate' => 0, 'directorate' => 0],
            'alignmentBonuses' => is_array($raw['alignmentBonuses'] ?? null) ? $raw['alignmentBonuses'] : [
                'crimeSuccessPct' => 0,
                'stealthPct' => 0,
                'mugPlunderPct' => 0,
                'bankAprPct' => 0,
                'vaultCapacityPct' => 0,
                'jobPayPct' => 0,
                'defensePct' => 0,
            ],
            'bossVictories' => is_array($raw['bossVictories'] ?? null) ? $raw['bossVictories'] : [],
            'bossAttempts' => (int) ($raw['bossAttempts'] ?? 0),
            'spEarned' => (int) ($raw['spEarned'] ?? 0),
            'meritsEarned' => (int) ($raw['meritsEarned'] ?? 0),
            'relics' => is_array($raw['relics'] ?? null) ? $raw['relics'] : [],
            'activeTitle' => is_array($raw['activeTitle'] ?? null) ? $raw['activeTitle'] : null,
            'lastBossLog' => is_array($raw['lastBossLog'] ?? null) ? $raw['lastBossLog'] : null,
        ];
        return $story;
    }

    private function resolveActiveChapterId(array $story, array $player): string
    {
        $candidate = (string) ($story['activeChapterId'] ?? 'act1_ch1');
        foreach (self::CHAPTERS as $chapter) {
            if ($chapter['id'] === $candidate && empty($story['claimedChapters'][$candidate])) {
                return $candidate;
            }
        }
        foreach (self::CHAPTERS as $chapter) {
            if (empty($story['claimedChapters'][$chapter['id']]) && $this->isChapterUnlocked($chapter, $player, $story)) {
                return $chapter['id'];
            }
        }
        return $this->nextActiveChapterId($story);
    }

    private function nextActiveChapterId(array $story): string
    {
        foreach (self::CHAPTERS as $chapter) {
            if (empty($story['claimedChapters'][$chapter['id']])) {
                return $chapter['id'];
            }
        }
        return 'act5_ch5';
    }

    private function requireChapter(string $chapterId): array
    {
        foreach (self::CHAPTERS as $chapter) {
            if ($chapter['id'] === $chapterId) {
                return $chapter;
            }
        }
        throw new InvalidArgumentException("Unknown story chapter: {$chapterId}");
    }

    private function requireAct(string $actId): array
    {
        foreach (self::ACTS as $act) {
            if ($act['id'] === $actId) {
                return $act;
            }
        }
        throw new InvalidArgumentException("Unknown story act: {$actId}");
    }

    private function romanAct(int $act): string
    {
        return match ($act) {
            1 => 'I',
            2 => 'II',
            3 => 'III',
            4 => 'IV',
            5 => 'V',
            default => (string) $act,
        };
    }

    private function loadPlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        return $this->resources->normalize($row);
    }

    /** @return array{0: array<string, mixed>, 1: int} */
    private function loadProgression(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Player progression is not initialized.');
        }
        $state = json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR);
        return [$state, (int) $row['version']];
    }

    private function saveProgression(string $playerId, array &$state, int &$version): void
    {
        $version++;
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
            [
                'state' => json_encode($state, JSON_THROW_ON_ERROR),
                'version' => $version,
                'updated' => gmdate('c'),
                'id' => $playerId,
            ],
        );
    }

    private function roll(int $min, int $max): int
    {
        if ($this->random !== null) {
            return (int) ($this->random)($min, $max);
        }
        return random_int($min, $max);
    }

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}

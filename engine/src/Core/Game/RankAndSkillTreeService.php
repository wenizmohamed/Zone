<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Server-authoritative Leveling 2.0 (Hold-Level & Promote), Torn 26-Rank Dual-Trigger
 * Matrix (#1 Absolute Beginner -> #26 Invincible), 4-Branch Player Skill Tree (24 Nodes
 * including 4 Capstones), Working Stats Trainer, and Unified 0-100 Mastery Skills.
 */
final class RankAndSkillTreeService
{
    public const RESPEC_POINTS_COST = 100;
    public const WORK_TRAIN_ENERGY_COST = 10;
    public const WORK_TRAIN_JOB_POINTS_COST = 5;

    /** @var list<int> */
    public const LEVEL_TRIGGERS = [2, 6, 11, 16, 21, 26, 31, 36, 41, 51, 61, 71, 81, 91, 100];
    /** @var list<int> */
    public const BATTLE_STAT_TRIGGERS = [500, 2500, 10000, 50000, 250000, 1000000, 10000000, 50000000, 250000000, 1000000000];
    /** @var list<int> */
    public const NETWORTH_TRIGGERS = [25000, 250000, 2500000, 25000000, 250000000, 2500000000, 25000000000];
    /** @var list<int> */
    public const CRIME_TRIGGERS = [25, 100, 500, 1500, 5000, 15000, 50000];

    /** @var array<int, array{rankIndex: int, id: string, triggersRequired: int, titleEn: string, titleAr: string, promotionCash: int}> */
    public const RANKS = [
        1 => ['rankIndex' => 1, 'id' => 'absolute_beginner', 'triggersRequired' => 0, 'titleEn' => 'Absolute Beginner', 'titleAr' => 'مبتدئ مطلق', 'promotionCash' => 0],
        2 => ['rankIndex' => 2, 'id' => 'beginner', 'triggersRequired' => 1, 'titleEn' => 'Beginner', 'titleAr' => 'مبتدئ', 'promotionCash' => 5000],
        3 => ['rankIndex' => 3, 'id' => 'inexperienced', 'triggersRequired' => 2, 'titleEn' => 'Inexperienced', 'titleAr' => 'قليل الخبرة', 'promotionCash' => 7500],
        4 => ['rankIndex' => 4, 'id' => 'rookie', 'triggersRequired' => 3, 'titleEn' => 'Rookie', 'titleAr' => 'مستجد', 'promotionCash' => 10000],
        5 => ['rankIndex' => 5, 'id' => 'novice', 'triggersRequired' => 4, 'titleEn' => 'Novice', 'titleAr' => 'ناشئ', 'promotionCash' => 15000],
        6 => ['rankIndex' => 6, 'id' => 'below_average', 'triggersRequired' => 5, 'titleEn' => 'Below Average', 'titleAr' => 'دون المتوسط', 'promotionCash' => 20000],
        7 => ['rankIndex' => 7, 'id' => 'average', 'triggersRequired' => 6, 'titleEn' => 'Average', 'titleAr' => 'متوسط', 'promotionCash' => 27500],
        8 => ['rankIndex' => 8, 'id' => 'reasonable', 'triggersRequired' => 7, 'titleEn' => 'Reasonable', 'titleAr' => 'معقول', 'promotionCash' => 35000],
        9 => ['rankIndex' => 9, 'id' => 'above_average', 'triggersRequired' => 8, 'titleEn' => 'Above Average', 'titleAr' => 'فوق المتوسط', 'promotionCash' => 45000],
        10 => ['rankIndex' => 10, 'id' => 'competent', 'triggersRequired' => 9, 'titleEn' => 'Competent', 'titleAr' => 'كفؤ', 'promotionCash' => 60000],
        11 => ['rankIndex' => 11, 'id' => 'highly_competent', 'triggersRequired' => 10, 'titleEn' => 'Highly Competent', 'titleAr' => 'عالي الكفاءة', 'promotionCash' => 80000],
        12 => ['rankIndex' => 12, 'id' => 'veteran', 'triggersRequired' => 11, 'titleEn' => 'Veteran', 'titleAr' => 'مخضرم', 'promotionCash' => 105000],
        13 => ['rankIndex' => 13, 'id' => 'distinguished', 'triggersRequired' => 12, 'titleEn' => 'Distinguished', 'titleAr' => 'متميز', 'promotionCash' => 135000],
        14 => ['rankIndex' => 14, 'id' => 'highly_distinguished', 'triggersRequired' => 13, 'titleEn' => 'Highly Distinguished', 'titleAr' => 'رفيع التميز', 'promotionCash' => 175000],
        15 => ['rankIndex' => 15, 'id' => 'professional', 'triggersRequired' => 14, 'titleEn' => 'Professional', 'titleAr' => 'محترف', 'promotionCash' => 225000],
        16 => ['rankIndex' => 16, 'id' => 'star', 'triggersRequired' => 15, 'titleEn' => 'Star', 'titleAr' => 'نجم', 'promotionCash' => 290000],
        17 => ['rankIndex' => 17, 'id' => 'master', 'triggersRequired' => 16, 'titleEn' => 'Master', 'titleAr' => 'خبير متمرس', 'promotionCash' => 375000],
        18 => ['rankIndex' => 18, 'id' => 'outstanding', 'triggersRequired' => 17, 'titleEn' => 'Outstanding', 'titleAr' => 'بارز', 'promotionCash' => 475000],
        19 => ['rankIndex' => 19, 'id' => 'celebrity', 'triggersRequired' => 18, 'titleEn' => 'Celebrity', 'titleAr' => 'ذائع الصيت', 'promotionCash' => 600000],
        20 => ['rankIndex' => 20, 'id' => 'supreme', 'triggersRequired' => 19, 'titleEn' => 'Supreme', 'titleAr' => 'أعلى', 'promotionCash' => 750000],
        21 => ['rankIndex' => 21, 'id' => 'idolized', 'triggersRequired' => 20, 'titleEn' => 'Idolized', 'titleAr' => 'أسطوري المكانة', 'promotionCash' => 950000],
        22 => ['rankIndex' => 22, 'id' => 'champion', 'triggersRequired' => 21, 'titleEn' => 'Champion', 'titleAr' => 'بطل', 'promotionCash' => 1200000],
        23 => ['rankIndex' => 23, 'id' => 'heroic', 'triggersRequired' => 22, 'titleEn' => 'Heroic', 'titleAr' => 'بطولي', 'promotionCash' => 1500000],
        24 => ['rankIndex' => 24, 'id' => 'legendary', 'triggersRequired' => 23, 'titleEn' => 'Legendary', 'titleAr' => 'أسطوري', 'promotionCash' => 1850000],
        25 => ['rankIndex' => 25, 'id' => 'elite', 'triggersRequired' => 24, 'titleEn' => 'Elite', 'titleAr' => 'نخبوي', 'promotionCash' => 2200000],
        26 => ['rankIndex' => 26, 'id' => 'invincible', 'triggersRequired' => 25, 'titleEn' => 'Invincible', 'titleAr' => 'لا يُقهر', 'promotionCash' => 2750000],
    ];

    /** @var array<string, array{id: string, nameEn: string, nameAr: string, themeEn: string, themeAr: string, capstoneId: string}> */
    public const BRANCHES = [
        'shadow' => [
            'id' => 'shadow',
            'nameEn' => 'Shadow Mastermind',
            'nameAr' => 'سيد الظلال',
            'themeEn' => '+15% Crime Success · +20% Stealth · +5 Max Nerve',
            'themeAr' => '+15% نجاح الجرائم · +20% التخفي · +5 أقصى جرأة',
            'capstoneId' => 'ghost_protocol',
        ],
        'warlord' => [
            'id' => 'warlord',
            'nameEn' => 'Warlord Enforcer',
            'nameAr' => 'قائد الحرب',
            'themeEn' => '+18% Combat Dmg · +15% Mug Plunder · +250 Max Life',
            'themeAr' => '+18% ضرر قتالي · +15% غنائم السلب · +250 أقصى صحة',
            'capstoneId' => 'executioner',
        ],
        'mogul' => [
            'id' => 'mogul',
            'nameEn' => 'Syndicate Mogul',
            'nameAr' => 'قطب النقابة',
            'themeEn' => '+15% Bank APR · -50% Stock Fee · +3 Luggage · +20% Job Pay',
            'themeAr' => '+15% عائد البنك · -50% عمولة الأسهم · +3 سعة سفر · +20% راتب',
            'capstoneId' => 'central_banker',
        ],
        'alchemist' => [
            'id' => 'alchemist',
            'nameEn' => 'Bio-Alchemist',
            'nameAr' => 'الخيميائي الحيوي',
            'themeEn' => '-35% OD Risk · +20% Med Heal · -5E Revive · +10 Max Energy',
            'themeAr' => '-35% خطر الجرعة الزائدة · +20% شفاء طبي · -5 طاقة إنعاش · +10 أقصى طاقة',
            'capstoneId' => 'bio_synthetic',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const SKILL_NODES = [
        // 1) Shadow Mastermind (total: +15% crimeSuccess, +20% stealth, +5 maxNerve)
        'street_instinct' => [
            'id' => 'street_instinct', 'branch' => 'shadow', 'tier' => 1, 'spCost' => 1, 'parentId' => null, 'isCapstone' => false,
            'nameEn' => 'Street Instinct', 'nameAr' => 'غريزة الشارع',
            'descEn' => '+3% Crime Success across street & Crimes 2.0 ops.',
            'descAr' => '+3% نسبة نجاح الجرائم الميدانية.',
            'effects' => ['crimeSuccessPct' => 3],
        ],
        'silent_footsteps' => [
            'id' => 'silent_footsteps', 'branch' => 'shadow', 'tier' => 2, 'spCost' => 1, 'parentId' => 'street_instinct', 'isCapstone' => false,
            'nameEn' => 'Silent Footsteps', 'nameAr' => 'خطوات صامتة',
            'descEn' => '+6% Stealth rating during ambushes and night operations.',
            'descAr' => '+6% قدرة التخفي أثناء الكمائن والعمليات الليلية.',
            'effects' => ['stealthPct' => 6],
        ],
        'wiretapper' => [
            'id' => 'wiretapper', 'branch' => 'shadow', 'tier' => 3, 'spCost' => 1, 'parentId' => 'silent_footsteps', 'isCapstone' => false,
            'nameEn' => 'Wiretapper', 'nameAr' => 'مخترق الاتصالات',
            'descEn' => '+4% Crime Success via police scanner intercepts.',
            'descAr' => '+4% نجاح الجرائم عبر اعتراض موجات الدوريات.',
            'effects' => ['crimeSuccessPct' => 4],
        ],
        'master_burglar' => [
            'id' => 'master_burglar', 'branch' => 'shadow', 'tier' => 4, 'spCost' => 2, 'parentId' => 'wiretapper', 'isCapstone' => false,
            'nameEn' => 'Master Burglar', 'nameAr' => 'لص الخزائن المحترف',
            'descEn' => '+6% Stealth rating when cracking locks and vaults.',
            'descAr' => '+6% تخفٍ إضافي عند كسر الأقفال والخزائن.',
            'effects' => ['stealthPct' => 6],
        ],
        'nerve_overclock' => [
            'id' => 'nerve_overclock', 'branch' => 'shadow', 'tier' => 5, 'spCost' => 2, 'parentId' => 'master_burglar', 'isCapstone' => false,
            'nameEn' => 'Nerve Overclock', 'nameAr' => 'فرط الأعصاب الباردة',
            'descEn' => '+2 Permanent Max Nerve.',
            'descAr' => '+2 زيادة دائمة في الحد الأقصى للجرأة.',
            'effects' => ['maxNerve' => 2],
        ],
        'ghost_protocol' => [
            'id' => 'ghost_protocol', 'branch' => 'shadow', 'tier' => 5, 'step' => 6, 'spCost' => 3, 'parentId' => 'nerve_overclock', 'isCapstone' => true,
            'nameEn' => 'Capstone: Ghost Protocol', 'nameAr' => 'الذروة: بروتوكول الشبح',
            'descEn' => '+8% Crime Success, +8% Stealth, and +3 Permanent Max Nerve (Branch Total: +15% Crime, +20% Stealth, +5 Max Nerve).',
            'descAr' => '+8% نجاح الجرائم و+8% تخفٍ و+3 أقصى جرأة (إجمالي الفرع: +15% جرائم، +20% تخفٍ، +5 جرأة).',
            'effects' => ['crimeSuccessPct' => 8, 'stealthPct' => 8, 'maxNerve' => 3],
        ],

        // 2) Warlord Enforcer (total: +18% combatDmg, +15% mugPlunder, +250 maxLife)
        'iron_knuckles' => [
            'id' => 'iron_knuckles', 'branch' => 'warlord', 'tier' => 1, 'spCost' => 1, 'parentId' => null, 'isCapstone' => false,
            'nameEn' => 'Iron Knuckles', 'nameAr' => 'قبضات فولاذية',
            'descEn' => '+3% Combat Damage in PvE, Boss, and PvP clashes.',
            'descAr' => '+3% ضرر قتالي في المواجهات ومعارك الزعماء.',
            'effects' => ['combatDamagePct' => 3],
        ],
        'hollow_point_drill' => [
            'id' => 'hollow_point_drill', 'branch' => 'warlord', 'tier' => 2, 'spCost' => 1, 'parentId' => 'iron_knuckles', 'isCapstone' => false,
            'nameEn' => 'Hollow-Point Drill', 'nameAr' => 'ذخيرة الرؤوس المتفجرة',
            'descEn' => '+4% Mug Plunder yielded from defeated targets.',
            'descAr' => '+4% زيادة غنائم السلب النقدي بعد الفوز.',
            'effects' => ['mugPlunderPct' => 4],
        ],
        'arterial_strike' => [
            'id' => 'arterial_strike', 'branch' => 'warlord', 'tier' => 3, 'spCost' => 1, 'parentId' => 'hollow_point_drill', 'isCapstone' => false,
            'nameEn' => 'Arterial Strike', 'nameAr' => 'الضربة الشريانية',
            'descEn' => '+5% Combat Damage on vital hitboxes.',
            'descAr' => '+5% ضرر قتالي إضافي على النقاط الحيوية.',
            'effects' => ['combatDamagePct' => 5],
        ],
        'kevlar_weave' => [
            'id' => 'kevlar_weave', 'branch' => 'warlord', 'tier' => 4, 'spCost' => 2, 'parentId' => 'arterial_strike', 'isCapstone' => false,
            'nameEn' => 'Kevlar Sub-Weave', 'nameAr' => 'نسيج الكيفلار المدرع',
            'descEn' => '+75 Permanent Max Life.',
            'descAr' => '+75 زيادة دائمة في الحد الأقصى للصحة.',
            'effects' => ['maxLife' => 75],
        ],
        'blood_frenzy' => [
            'id' => 'blood_frenzy', 'branch' => 'warlord', 'tier' => 5, 'spCost' => 2, 'parentId' => 'kevlar_weave', 'isCapstone' => false,
            'nameEn' => 'Blood Frenzy', 'nameAr' => 'هياج المعركة',
            'descEn' => '+4% Combat Damage and +4% Mug Plunder.',
            'descAr' => '+4% ضرر قتالي و+4% غنائم سلب.',
            'effects' => ['combatDamagePct' => 4, 'mugPlunderPct' => 4],
        ],
        'executioner' => [
            'id' => 'executioner', 'branch' => 'warlord', 'tier' => 5, 'step' => 6, 'spCost' => 3, 'parentId' => 'blood_frenzy', 'isCapstone' => true,
            'nameEn' => 'Capstone: Executioner', 'nameAr' => 'الذروة: الجلاد الحاسم',
            'descEn' => '+6% Combat Damage, +7% Mug Plunder, and +175 Permanent Max Life (Branch Total: +18% Dmg, +15% Mug, +250 Max Life).',
            'descAr' => '+6% ضرر قتالي و+7% غنائم سلب و+175 أقصى صحة (إجمالي الفرع: +18% ضرر، +15% سلب، +250 صحة).',
            'effects' => ['combatDamagePct' => 6, 'mugPlunderPct' => 7, 'maxLife' => 175],
        ],

        // 3) Syndicate Mogul (total: +15% bankApr, -50% stockFee, +3 travelLuggage, +20% jobPay)
        'compound_ledger' => [
            'id' => 'compound_ledger', 'branch' => 'mogul', 'tier' => 1, 'spCost' => 1, 'parentId' => null, 'isCapstone' => false,
            'nameEn' => 'Compound Ledger', 'nameAr' => 'دفتر الفائدة المركبة',
            'descEn' => '+5% Bank CD APR yield.',
            'descAr' => '+5% عائد شهادات الإيداع البنكية.',
            'effects' => ['bankAprPct' => 5],
        ],
        'insider_tape' => [
            'id' => 'insider_tape', 'branch' => 'mogul', 'tier' => 2, 'spCost' => 1, 'parentId' => 'compound_ledger', 'isCapstone' => false,
            'nameEn' => 'Insider Tape', 'nameAr' => 'شريط التداول الداخلي',
            'descEn' => '-20% Stock Exchange brokerage fee.',
            'descAr' => '-20% خصم على عمولة تداول الأسهم.',
            'effects' => ['stockFeeReductionPct' => 20],
        ],
        'offshore_vault' => [
            'id' => 'offshore_vault', 'branch' => 'mogul', 'tier' => 3, 'spCost' => 1, 'parentId' => 'insider_tape', 'isCapstone' => false,
            'nameEn' => 'Offshore Payroll', 'nameAr' => 'خزائن الرواتب الخارجية',
            'descEn' => '+8% Job & Company shift pay.',
            'descAr' => '+8% زيادة في أجور الوظائف والشركات.',
            'effects' => ['jobPayPct' => 8],
        ],
        'airstrip_logistics' => [
            'id' => 'airstrip_logistics', 'branch' => 'mogul', 'tier' => 4, 'spCost' => 2, 'parentId' => 'offshore_vault', 'isCapstone' => false,
            'nameEn' => 'Airstrip Logistics', 'nameAr' => 'لوجستيات المهبط الخاص',
            'descEn' => '+1 Foreign Travel Luggage capacity.',
            'descAr' => '+1 سعة حقيبة السفر والتهريب الدولي.',
            'effects' => ['travelLuggage' => 1],
        ],
        'tax_shelter' => [
            'id' => 'tax_shelter', 'branch' => 'mogul', 'tier' => 5, 'spCost' => 2, 'parentId' => 'airstrip_logistics', 'isCapstone' => false,
            'nameEn' => 'Cayman Tax Shelter', 'nameAr' => 'الملاذ الضريبي الخارجي',
            'descEn' => '+4% Bank APR and -10% Stock fee.',
            'descAr' => '+4% عائد بنكي و-10% عمولة أسهم.',
            'effects' => ['bankAprPct' => 4, 'stockFeeReductionPct' => 10],
        ],
        'central_banker' => [
            'id' => 'central_banker', 'branch' => 'mogul', 'tier' => 5, 'step' => 6, 'spCost' => 3, 'parentId' => 'tax_shelter', 'isCapstone' => true,
            'nameEn' => 'Capstone: Central Banker', 'nameAr' => 'الذروة: محافظ المصرف المركزي',
            'descEn' => '+6% Bank APR, -20% Stock Fee, +2 Travel Luggage, +12% Job Pay (Branch Total: +15% APR, -50% Fee, +3 Luggage, +20% Job Pay).',
            'descAr' => '+6% عائد بنكي، -20% عمولة أسهم، +2 سعة سفر، +12% راتب (إجمالي الفرع: +15% بنك، -50% عمولة، +3 سفر، +20% راتب).',
            'effects' => ['bankAprPct' => 6, 'stockFeeReductionPct' => 20, 'travelLuggage' => 2, 'jobPayPct' => 12],
        ],

        // 4) Bio-Alchemist (total: -35% odRisk, +20% medHeal, -5E reviveCost, +10 maxEnergy)
        'micro_dosing' => [
            'id' => 'micro_dosing', 'branch' => 'alchemist', 'tier' => 1, 'spCost' => 1, 'parentId' => null, 'isCapstone' => false,
            'nameEn' => 'Micro-Dosing Protocol', 'nameAr' => 'بروتوكول الجرعات الدقيقة',
            'descEn' => '-10% Drug Overdose risk.',
            'descAr' => '-10% تقليل خطر الجرعة الزائدة.',
            'effects' => ['odRiskReductionPct' => 10],
        ],
        'pure_synthesis' => [
            'id' => 'pure_synthesis', 'branch' => 'alchemist', 'tier' => 2, 'spCost' => 1, 'parentId' => 'micro_dosing', 'isCapstone' => false,
            'nameEn' => 'Pure Synthesis', 'nameAr' => 'التنقية الكيميائية الفائقة',
            'descEn' => '-10% Drug Overdose risk via pharmaceutical filtration.',
            'descAr' => '-10% تقليل إضافي لخطر الجرعة الزائدة.',
            'effects' => ['odRiskReductionPct' => 10],
        ],
        'field_triage' => [
            'id' => 'field_triage', 'branch' => 'alchemist', 'tier' => 3, 'spCost' => 1, 'parentId' => 'pure_synthesis', 'isCapstone' => false,
            'nameEn' => 'Field Triage', 'nameAr' => 'الإسعاف التكتيكي الميداني',
            'descEn' => '+8% Medical item healing and -2E Revive energy cost.',
            'descAr' => '+8% فعالية العلاج الطبي و-2 طاقة لتكلفة الإنعاش.',
            'effects' => ['medHealPct' => 8, 'reviveEnergyReduction' => 2],
        ],
        'endorphin_lock' => [
            'id' => 'endorphin_lock', 'branch' => 'alchemist', 'tier' => 4, 'spCost' => 2, 'parentId' => 'field_triage', 'isCapstone' => false,
            'nameEn' => 'Endorphin Lock', 'nameAr' => 'تثبيت الإندورفين',
            'descEn' => '+4 Permanent Max Energy.',
            'descAr' => '+4 زيادة دائمة في الحد الأقصى للطاقة.',
            'effects' => ['maxEnergy' => 4],
        ],
        'adrenal_surge' => [
            'id' => 'adrenal_surge', 'branch' => 'alchemist', 'tier' => 5, 'spCost' => 2, 'parentId' => 'endorphin_lock', 'isCapstone' => false,
            'nameEn' => 'Adrenal Surge', 'nameAr' => 'اندفاع الأدرينالين',
            'descEn' => '+5% Medical item healing and -5% Overdose risk.',
            'descAr' => '+5% شفاء طبي و-5% خطر الجرعة الزائدة.',
            'effects' => ['medHealPct' => 5, 'odRiskReductionPct' => 5],
        ],
        'bio_synthetic' => [
            'id' => 'bio_synthetic', 'branch' => 'alchemist', 'tier' => 5, 'step' => 6, 'spCost' => 3, 'parentId' => 'adrenal_surge', 'isCapstone' => true,
            'nameEn' => 'Capstone: Bio-Synthetic Sovereign', 'nameAr' => 'الذروة: الكيميائي الحيوي الفائق',
            'descEn' => '-10% OD Risk, +7% Med Heal, -3E Revive Cost, and +6 Permanent Max Energy (Branch Total: -35% OD, +20% Med, -5E Revive, +10 Max Energy).',
            'descAr' => '-10% خطر جرعة، +7% شفاء، -3 طاقة إنعاش، و+6 أقصى طاقة (إجمالي الفرع: -35% جرعة، +20% شفاء، -5 إنعاش، +10 طاقة).',
            'effects' => ['odRiskReductionPct' => 10, 'medHealPct' => 7, 'reviveEnergyReduction' => 3, 'maxEnergy' => 6],
        ],
    ];

    /** @var array<string, array{nameEn: string, nameAr: string, category: string}> */
    public const MASTERY_DEFINITIONS = [
        'hunting' => ['nameEn' => 'Hunting Mastery', 'nameAr' => 'مهارة الصيد البري', 'category' => 'activities'],
        'racing' => ['nameEn' => 'Street Racing', 'nameAr' => 'مهارة سباقات الشوارع', 'category' => 'activities'],
        'reviving' => ['nameEn' => 'Trauma Reviving', 'nameAr' => 'مهارة الإنعاش الطبي', 'category' => 'support'],
        'busting' => ['nameEn' => 'Jail Busting', 'nameAr' => 'مهارة تهريب السجناء', 'category' => 'underworld'],
        'smuggling' => ['nameEn' => 'Air Smuggling', 'nameAr' => 'مهارة التهريب الدولي', 'category' => 'economy'],
        'forging' => ['nameEn' => 'Document Forging', 'nameAr' => 'مهارة تزوير الوثائق', 'category' => 'underworld'],
        'hacking' => ['nameEn' => 'Cyber Intrusion', 'nameAr' => 'مهارة الاختراق السيبراني', 'category' => 'underworld'],
        'weapon_mastery' => ['nameEn' => 'Weapon Mastery', 'nameAr' => 'إتقان الأسلحة القتالية', 'category' => 'combat'],
        'crime_mastery' => ['nameEn' => 'Crime Mastery', 'nameAr' => 'إتقان الجرائم المنظمة', 'category' => 'underworld'],
    ];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly LevelingService $leveling;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
    }

    public function snapshot(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $changed = $this->reconcileRpgState($player, $state);
            if ($changed) {
                $this->saveProgression($playerId, $state, $version);
            }
            return $this->buildView($player, $state);
        });
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $action = trim($action);
        if ($action === '') {
            throw new InvalidArgumentException('Player RPG action is required.');
        }

        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId, $action, $payload): array {
            $this->resources->regenerate($playerId);
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $this->reconcileRpgState($player, $state);
            $rpg = $state['rpg'];
            $nowMs = $this->nowMs();
            $correlationId = bin2hex(random_bytes(16));

            switch ($action) {
                case 'skillTree.unlock':
                    $nodeId = trim((string) ($payload['nodeId'] ?? $payload['id'] ?? ''));
                    if (!isset(self::SKILL_NODES[$nodeId])) {
                        throw new InvalidArgumentException("Unknown skill tree node: {$nodeId}");
                    }
                    $node = self::SKILL_NODES[$nodeId];
                    if (isset($rpg['unlockedNodes'][$nodeId])) {
                        throw new RuntimeException('This skill node is already unlocked.');
                    }
                    $parentId = $node['parentId'];
                    if ($parentId !== null && !isset($rpg['unlockedNodes'][$parentId])) {
                        $parentName = self::SKILL_NODES[$parentId]['nameEn'] ?? $parentId;
                        throw new RuntimeException("Unlock prerequisite node '{$parentName}' ({$parentId}) first.");
                    }

                    $spLedger = $this->computeSkillPointLedger($player, $state);
                    $cost = (int) $node['spCost'];
                    if ($spLedger['availableSp'] < $cost) {
                        throw new RuntimeException("Need {$cost} Skill Point(s); you have {$spLedger['availableSp']} SP available.");
                    }

                    $rpg['unlockedNodes'][$nodeId] = $nowMs;
                    $effects = $node['effects'];

                    $addMaxNerve = (int) ($effects['maxNerve'] ?? 0);
                    $addMaxEnergy = (int) ($effects['maxEnergy'] ?? 0);
                    $addMaxLife = (int) ($effects['maxLife'] ?? 0);

                    if ($addMaxNerve > 0 || $addMaxEnergy > 0 || $addMaxLife > 0) {
                        $newMaxNerve = (int) $player['max_nerve'] + $addMaxNerve;
                        $newMaxEnergy = (int) $player['max_energy'] + $addMaxEnergy;
                        $newMaxLife = (int) $player['max_life'] + $addMaxLife;
                        $newLife = (int) $player['life'] + $addMaxLife;

                        $this->database->execute(
                            'UPDATE players SET max_nerve = :maxNerve, max_energy = :maxEnergy, max_life = :maxLife, life = :life WHERE id = :id',
                            [
                                'maxNerve' => $newMaxNerve,
                                'maxEnergy' => $newMaxEnergy,
                                'maxLife' => $newMaxLife,
                                'life' => min($newMaxLife, $newLife),
                                'id' => $playerId,
                            ],
                        );
                        $rpg['appliedCaps']['max_nerve'] = (int) ($rpg['appliedCaps']['max_nerve'] ?? 0) + $addMaxNerve;
                        $rpg['appliedCaps']['max_energy'] = (int) ($rpg['appliedCaps']['max_energy'] ?? 0) + $addMaxEnergy;
                        $rpg['appliedCaps']['max_life'] = (int) ($rpg['appliedCaps']['max_life'] ?? 0) + $addMaxLife;
                    }

                    $rpg['bonuses'] = $this->computeTreeBonuses($rpg['unlockedNodes']);
                    $state['rpg'] = $rpg;
                    $this->saveProgression($playerId, $state, $version);
                    $player = $this->loadPlayer($playerId);

                    $this->events->publish(new DomainEvent('SkillNodeUnlocked', [
                        'playerId' => $playerId,
                        'nodeId' => $nodeId,
                        'branch' => $node['branch'],
                        'spCost' => $cost,
                        'isCapstone' => $node['isCapstone'],
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'skillTree.unlock',
                        'nodeId' => $nodeId,
                        'branch' => $node['branch'],
                        'spSpent' => $cost,
                        'isCapstone' => $node['isCapstone'],
                        'bonuses' => $rpg['bonuses'],
                    ];
                    break;

                case 'skillTree.respec':
                    if (empty($rpg['unlockedNodes'])) {
                        throw new RuntimeException('No unlocked skill tree nodes to respec.');
                    }
                    $freeUsed = !empty($rpg['skillFreeRespecUsed']);
                    $pointsCost = $freeUsed ? self::RESPEC_POINTS_COST : 0;
                    $currentPoints = (int) ($state['points'] ?? 0);
                    if ($pointsCost > 0 && $currentPoints < $pointsCost) {
                        throw new RuntimeException("Need {$pointsCost} Points to respec your Skill Tree (you have {$currentPoints} Points).");
                    }

                    $refundedSp = $this->computeSpentSp($rpg['unlockedNodes']);
                    $removedNerve = (int) ($rpg['appliedCaps']['max_nerve'] ?? 0);
                    $removedEnergy = (int) ($rpg['appliedCaps']['max_energy'] ?? 0);
                    $removedLife = (int) ($rpg['appliedCaps']['max_life'] ?? 0);

                    if ($removedNerve > 0 || $removedEnergy > 0 || $removedLife > 0) {
                        $newMaxNerve = max(10, (int) $player['max_nerve'] - $removedNerve);
                        $newMaxEnergy = max(50, (int) $player['max_energy'] - $removedEnergy);
                        $newMaxLife = max(100, (int) $player['max_life'] - $removedLife);
                        $clampedNerve = min((int) $player['nerve'], $newMaxNerve);
                        $clampedEnergy = min((int) $player['energy'], $newMaxEnergy);
                        $clampedLife = min((int) $player['life'], $newMaxLife);

                        $this->database->execute(
                            'UPDATE players SET max_nerve = :maxNerve, max_energy = :maxEnergy, max_life = :maxLife, '
                            . 'nerve = :nerve, energy = :energy, life = :life WHERE id = :id',
                            [
                                'maxNerve' => $newMaxNerve,
                                'maxEnergy' => $newMaxEnergy,
                                'maxLife' => $newMaxLife,
                                'nerve' => $clampedNerve,
                                'energy' => $clampedEnergy,
                                'life' => $clampedLife,
                                'id' => $playerId,
                            ],
                        );
                    }

                    if ($pointsCost > 0) {
                        $state['points'] = $currentPoints - $pointsCost;
                        $this->ledger->record($playerId, 'points', -$pointsCost, (int) $state['points'], 'skillTree.respec', $correlationId);
                    }

                    $rpg['skillFreeRespecUsed'] = true;
                    $rpg['respecCount'] = (int) ($rpg['respecCount'] ?? 0) + 1;
                    $rpg['unlockedNodes'] = [];
                    $rpg['appliedCaps'] = ['max_nerve' => 0, 'max_energy' => 0, 'max_life' => 0];
                    $rpg['bonuses'] = $this->computeTreeBonuses([]);
                    $state['rpg'] = $rpg;
                    $this->saveProgression($playerId, $state, $version);
                    $player = $this->loadPlayer($playerId);

                    $this->events->publish(new DomainEvent('SkillTreeRespecced', [
                        'playerId' => $playerId,
                        'refundedSp' => $refundedSp,
                        'pointsCost' => $pointsCost,
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'skillTree.respec',
                        'refundedSp' => $refundedSp,
                        'pointsCost' => $pointsCost,
                        'freeRespecUsed' => !$freeUsed,
                    ];
                    break;

                case 'level.toggleHold':
                    $enabled = array_key_exists('enabled', $payload)
                        ? filter_var($payload['enabled'], FILTER_VALIDATE_BOOLEAN)
                        : empty($rpg['holdLevel']);
                    $eligibleLevel = min(100, $this->leveling->levelForXp((int) $player['xp']));
                    $rpg['holdLevel'] = $enabled;
                    $rpg['eligibleLevel'] = $eligibleLevel;
                    $rpg['pendingLevels'] = max(0, $eligibleLevel - (int) $player['level']);
                    $state['rpg'] = $rpg;
                    $this->saveProgression($playerId, $state, $version);

                    $this->events->publish(new DomainEvent('PlayerLevelHoldToggled', [
                        'playerId' => $playerId,
                        'holdLevel' => $enabled,
                        'currentLevel' => (int) $player['level'],
                        'pendingLevels' => $rpg['pendingLevels'],
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'level.toggleHold',
                        'holdLevel' => $enabled,
                        'currentLevel' => (int) $player['level'],
                        'eligibleLevel' => $eligibleLevel,
                        'pendingLevels' => $rpg['pendingLevels'],
                    ];
                    break;

                case 'level.promote':
                    $maxLevels = isset($payload['levels']) && is_numeric($payload['levels'])
                        ? max(1, (int) $payload['levels'])
                        : null;
                    $promotion = $this->leveling->promote($playerId, $correlationId, $maxLevels);
                    $player = $this->loadPlayer($playerId);
                    [$state, $version] = $this->loadProgression($playerId);
                    $this->reconcileRpgState($player, $state);
                    $this->saveProgression($playerId, $state, $version);

                    $result = [
                        'action' => 'level.promote',
                        ...$promotion,
                    ];
                    break;

                case 'rank.claimPromotion':
                    $rankEval = $this->evaluateRanks($player, $state);
                    $claimedRankIndex = (int) ($rpg['claimedRankIndex'] ?? 1);
                    $earnedRankIndex = (int) $rankEval['currentRankIndex'];

                    if ($earnedRankIndex <= $claimedRankIndex) {
                        throw new RuntimeException('No unclaimed rank promotions available. Hit another Rank trigger first.');
                    }

                    $requestedTarget = isset($payload['rankIndex']) && is_numeric($payload['rankIndex'])
                        ? min($earnedRankIndex, max($claimedRankIndex + 1, (int) $payload['rankIndex']))
                        : (!empty($payload['single']) ? $claimedRankIndex + 1 : $earnedRankIndex);

                    $ranksPromoted = $requestedTarget - $claimedRankIndex;
                    $cashAwarded = 0;
                    $claimedTitles = [];
                    for ($r = $claimedRankIndex + 1; $r <= $requestedTarget; $r++) {
                        $cashAwarded += (int) (self::RANKS[$r]['promotionCash'] ?? 0);
                        $claimedTitles[] = self::RANKS[$r]['titleEn'];
                    }

                    $spAwarded = $ranksPromoted;
                    $meritsAwarded = $ranksPromoted;

                    if ($cashAwarded > 0) {
                        $newCash = (int) $player['cash'] + $cashAwarded;
                        $this->database->execute(
                            'UPDATE players SET cash = :cash WHERE id = :id',
                            ['cash' => $newCash, 'id' => $playerId],
                        );
                        $this->ledger->record($playerId, 'cash', $cashAwarded, $newCash, 'rank.promotion', $correlationId);
                    }

                    $rpg['claimedRankIndex'] = $requestedTarget;
                    $rpg['rankSpEarned'] = (int) ($rpg['rankSpEarned'] ?? 0) + $spAwarded;
                    $rpg['rankMeritsEarned'] = (int) ($rpg['rankMeritsEarned'] ?? 0) + $meritsAwarded;
                    $state['merits'] = (int) ($state['merits'] ?? 0) + $meritsAwarded;
                    $state['rpg'] = $rpg;
                    $this->saveProgression($playerId, $state, $version);
                    $player = $this->loadPlayer($playerId);

                    $this->events->publish(new DomainEvent('PlayerRankPromoted', [
                        'playerId' => $playerId,
                        'fromRankIndex' => $claimedRankIndex,
                        'toRankIndex' => $requestedTarget,
                        'rankTitleEn' => self::RANKS[$requestedTarget]['titleEn'],
                        'cashAwarded' => $cashAwarded,
                        'spAwarded' => $spAwarded,
                        'meritsAwarded' => $meritsAwarded,
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'rank.claimPromotion',
                        'fromRankIndex' => $claimedRankIndex,
                        'toRankIndex' => $requestedTarget,
                        'ranksPromoted' => $ranksPromoted,
                        'newRankTitleEn' => self::RANKS[$requestedTarget]['titleEn'],
                        'newRankTitleAr' => self::RANKS[$requestedTarget]['titleAr'],
                        'claimedTitles' => $claimedTitles,
                        'cashAwarded' => $cashAwarded,
                        'spAwarded' => $spAwarded,
                        'meritsAwarded' => $meritsAwarded,
                    ];
                    break;

                case 'workStats.train':
                    if ((int) ($state['jailUntil'] ?? 0) > $nowMs || (int) ($state['hospUntil'] ?? 0) > $nowMs) {
                        throw new RuntimeException('You must leave jail or hospital before training Working Stats.');
                    }
                    $rawStat = strtolower(trim((string) ($payload['stat'] ?? $payload['id'] ?? 'man')));
                    $stat = match ($rawStat) {
                        'man', 'manual', 'manual_labor' => 'man',
                        'int', 'intelligence' => 'int',
                        'end', 'endurance' => 'end',
                        default => throw new InvalidArgumentException("Working stat must be 'man', 'int', or 'end'."),
                    };

                    $costMode = strtolower(trim((string) ($payload['costType'] ?? $payload['mode'] ?? 'auto')));
                    $energySpent = 0;
                    $jobPtsSpent = 0;
                    $currentJobPts = (int) ($state['jobPts'] ?? 0);

                    if ($costMode === 'jobpts' || $costMode === 'job_points' || ($costMode === 'auto' && (int) $player['energy'] < self::WORK_TRAIN_ENERGY_COST && $currentJobPts >= self::WORK_TRAIN_JOB_POINTS_COST)) {
                        if ($currentJobPts < self::WORK_TRAIN_JOB_POINTS_COST) {
                            throw new RuntimeException('Need ' . self::WORK_TRAIN_JOB_POINTS_COST . ' Job Points to train Working Stats.');
                        }
                        $jobPtsSpent = self::WORK_TRAIN_JOB_POINTS_COST;
                        $state['jobPts'] = $currentJobPts - $jobPtsSpent;
                    } else {
                        if ((int) $player['energy'] < self::WORK_TRAIN_ENERGY_COST) {
                            throw new RuntimeException('Need ' . self::WORK_TRAIN_ENERGY_COST . ' Energy (or ' . self::WORK_TRAIN_JOB_POINTS_COST . ' Job Points) to train Working Stats.');
                        }
                        $energySpent = self::WORK_TRAIN_ENERGY_COST;
                    }

                    $eduBonus = (!empty($state['eduDone']['gen']) ? 4 : 0) + (!empty($state['eduDone']['lead']) ? 4 : 0);
                    $happyBonus = (int) min(10, floor(((int) $player['happy']) / 250));
                    $gain = 12 + $eduBonus + $happyBonus;
                    $xpGain = 5;

                    $workStats = is_array($state['workStats'] ?? null)
                        ? $state['workStats']
                        : ['man' => 0, 'int' => 0, 'end' => 0];
                    $workStats['man'] = (int) ($workStats['man'] ?? 0);
                    $workStats['int'] = (int) ($workStats['int'] ?? 0);
                    $workStats['end'] = (int) ($workStats['end'] ?? 0);
                    $workStats[$stat] += $gain;
                    $state['workStats'] = $workStats;

                    $newEnergy = (int) $player['energy'] - $energySpent;
                    $newXp = (int) $player['xp'] + $xpGain;
                    $this->database->execute(
                        'UPDATE players SET energy = :energy, xp = :xp WHERE id = :id',
                        ['energy' => $newEnergy, 'xp' => $newXp, 'id' => $playerId],
                    );

                    $this->saveProgression($playerId, $state, $version);
                    $levelUp = $this->leveling->sync($playerId, $correlationId);
                    $player = $this->loadPlayer($playerId);
                    [$state] = $this->loadProgression($playerId);

                    $this->events->publish(new DomainEvent('WorkStatTrained', [
                        'playerId' => $playerId,
                        'stat' => $stat,
                        'gain' => $gain,
                        'energySpent' => $energySpent,
                        'jobPtsSpent' => $jobPtsSpent,
                        'correlationId' => $correlationId,
                    ]));

                    $result = [
                        'action' => 'workStats.train',
                        'stat' => $stat,
                        'gain' => $gain,
                        'newValue' => $state['workStats'][$stat],
                        'energySpent' => $energySpent,
                        'jobPtsSpent' => $jobPtsSpent,
                        'xpAwarded' => $xpGain,
                        'levelUp' => $levelUp,
                    ];
                    break;

                default:
                    throw new InvalidArgumentException("Unsupported player RPG action: {$action}");
            }

            return [
                ...$this->buildView($player, $state),
                'result' => $result,
            ];
        });
    }

    private function buildView(array $player, array $state): array
    {
        $rpg = $state['rpg'];
        $holdLevel = !empty($rpg['holdLevel']);
        $xpProgress = $this->leveling->xpProgressForPlayer((int) $player['level'], (int) $player['xp'], $holdLevel);
        $roadmap = LevelingService::roadmapForLevel((int) $player['level']);

        $rankEval = $this->evaluateRanks($player, $state);
        $spLedger = $this->computeSkillPointLedger($player, $state);
        $unlockedNodes = is_array($rpg['unlockedNodes'] ?? null) ? $rpg['unlockedNodes'] : [];
        $treeBonuses = $this->computeTreeBonuses($unlockedNodes);

        $branchesView = [];
        $flatNodes = [];
        foreach (self::BRANCHES as $branchId => $branchDef) {
            $branchNodes = [];
            $unlockedInBranch = 0;
            foreach (self::SKILL_NODES as $node) {
                if ($node['branch'] !== $branchId) {
                    continue;
                }
                $isUnlocked = isset($unlockedNodes[$node['id']]);
                if ($isUnlocked) {
                    $unlockedInBranch++;
                }
                $parentUnlocked = $node['parentId'] === null || isset($unlockedNodes[$node['parentId']]);
                $canUnlock = !$isUnlocked && $parentUnlocked && $spLedger['availableSp'] >= (int) $node['spCost'];

                $nodeView = [
                    ...$node,
                    'name' => ['en' => $node['nameEn'], 'ar' => $node['nameAr']],
                    'description' => ['en' => $node['descEn'], 'ar' => $node['descAr']],
                    'unlocked' => $isUnlocked,
                    'unlockedAt' => $isUnlocked ? (int) $unlockedNodes[$node['id']] : null,
                    'parentUnlocked' => $parentUnlocked,
                    'canUnlock' => $canUnlock,
                    'lockReason' => $isUnlocked
                        ? 'unlocked'
                        : (!$parentUnlocked ? 'prerequisite_locked' : ($spLedger['availableSp'] < (int) $node['spCost'] ? 'insufficient_sp' : null)),
                ];
                $branchNodes[] = $nodeView;
                $flatNodes[] = $nodeView;
            }
            $branchesView[] = [
                ...$branchDef,
                'name' => ['en' => $branchDef['nameEn'], 'ar' => $branchDef['nameAr']],
                'theme' => ['en' => $branchDef['themeEn'], 'ar' => $branchDef['themeAr']],
                'unlockedCount' => $unlockedInBranch,
                'totalCount' => count($branchNodes),
                'capstoneUnlocked' => isset($unlockedNodes[$branchDef['capstoneId']]),
                'nodes' => $branchNodes,
            ];
        }

        $masteryMap = $this->computeMasterySkills($state);
        $masteryList = [];
        foreach (self::MASTERY_DEFINITIONS as $key => $meta) {
            $val = $masteryMap[$key] ?? 0;
            $masteryList[] = [
                'id' => $key,
                'nameEn' => $meta['nameEn'],
                'nameAr' => $meta['nameAr'],
                'category' => $meta['category'],
                'value' => $val,
                'max' => 100,
                'tierEn' => $val >= 80 ? 'Grandmaster' : ($val >= 50 ? 'Expert' : ($val >= 25 ? 'Adept' : 'Novice')),
                'tierAr' => $val >= 80 ? 'أستاذ كبير' : ($val >= 50 ? 'خبير' : ($val >= 25 ? 'متمرس' : 'مبتدئ')),
            ];
        }

        $rawWork = is_array($state['workStats'] ?? null) ? $state['workStats'] : [];
        $workStats = [
            'man' => max(0, (int) ($rawWork['man'] ?? 0)),
            'int' => max(0, (int) ($rawWork['int'] ?? 0)),
            'end' => max(0, (int) ($rawWork['end'] ?? 0)),
        ];
        $workStats['total'] = $workStats['man'] + $workStats['int'] + $workStats['end'];

        $freeRespecAvailable = empty($rpg['skillFreeRespecUsed']);

        return [
            'player' => [
                'id' => $player['id'],
                'username' => $player['username'],
                'level' => $player['level'],
                'xp' => $player['xp'],
                'cash' => $player['cash'],
                'bank_balance' => $player['bank_balance'],
                'net_worth' => $player['net_worth'],
                'energy' => $player['energy'],
                'max_energy' => $player['max_energy'],
                'nerve' => $player['nerve'],
                'max_nerve' => $player['max_nerve'],
                'life' => $player['life'],
                'max_life' => $player['max_life'],
                'happy' => $player['happy'],
                'max_happy' => $player['max_happy'],
                'strength' => $player['strength'],
                'defense' => $player['defense'],
                'speed' => $player['speed'],
                'dexterity' => $player['dexterity'],
                'total_battle_stats' => $player['total_battle_stats'],
                'points' => (int) ($state['points'] ?? 0),
                'merits' => (int) ($state['merits'] ?? 0),
                'jobPts' => (int) ($state['jobPts'] ?? 0),
            ],
            'leveling' => [
                ...$xpProgress,
                'level' => $xpProgress['currentLevel'],
                'potentialLevel' => $xpProgress['eligibleLevel'],
                'canPromote' => $xpProgress['pendingLevels'] > 0,
                'grantsPerLevel' => [
                    'nerve' => LevelingService::NERVE_PER_LEVEL,
                    'energy' => LevelingService::ENERGY_PER_LEVEL,
                    'life' => LevelingService::LIFE_PER_LEVEL,
                    'cashPerLevelMultiplier' => LevelingService::CASH_PER_LEVEL,
                    'skillPoints' => LevelingService::SP_PER_LEVEL,
                    'merits' => LevelingService::MERITS_PER_LEVEL,
                ],
                'roadmap' => $roadmap,
            ],
            'rank' => $rankEval,
            'ranks' => $rankEval,
            'skillTree' => [
                ...$spLedger,
                'unlockedNodes' => $unlockedNodes,
                'unlockedCount' => count($unlockedNodes),
                'totalNodesCount' => count(self::SKILL_NODES),
                'respecCount' => (int) ($rpg['respecCount'] ?? 0),
                'freeRespecAvailable' => $freeRespecAvailable,
                'respecCostPoints' => $freeRespecAvailable ? 0 : self::RESPEC_POINTS_COST,
                'appliedCaps' => $rpg['appliedCaps'],
                'bonuses' => $treeBonuses,
                'branches' => $branchesView,
                'nodes' => $flatNodes,
            ],
            'masterySkills' => $masteryMap,
            'masterySkillList' => $masteryList,
            'workStats' => [
                ...$workStats,
                'trainEnergyCost' => self::WORK_TRAIN_ENERGY_COST,
                'trainJobPtsCost' => self::WORK_TRAIN_JOB_POINTS_COST,
            ],
        ];
    }

    private function evaluateRanks(array $player, array $state): array
    {
        $level = (int) $player['level'];
        $battleStats = (int) $player['total_battle_stats'];
        $netWorth = (int) $player['cash']
            + (int) $player['bank_balance']
            + (int) ($state['vaultBalance'] ?? 0)
            + (int) ($state['activeCd']['principal'] ?? 0);
        $crimes = (int) ($state['ctr']['crimes'] ?? 0);

        $levelInfo = $this->countTriggers($level, self::LEVEL_TRIGGERS);
        $battleInfo = $this->countTriggers($battleStats, self::BATTLE_STAT_TRIGGERS);
        $networthInfo = $this->countTriggers($netWorth, self::NETWORTH_TRIGGERS);
        $crimeInfo = $this->countTriggers($crimes, self::CRIME_TRIGGERS);

        $totalTriggers = $levelInfo['earned'] + $battleInfo['earned'] + $networthInfo['earned'] + $crimeInfo['earned'];
        $claimedRankIndex = max(1, min(26, (int) ($state['rpg']['claimedRankIndex'] ?? 1)));
        $currentRankIndex = max($claimedRankIndex, min(26, 1 + $totalTriggers));
        $nextRankIndex = min(26, $currentRankIndex + 1);

        $currentRank = self::RANKS[$currentRankIndex];
        $claimedRank = self::RANKS[$claimedRankIndex];
        $nextRank = $currentRankIndex < 26 ? self::RANKS[$nextRankIndex] : null;

        $unclaimedCount = max(0, $currentRankIndex - $claimedRankIndex);
        $pendingPromotionCash = 0;
        for ($r = $claimedRankIndex + 1; $r <= $currentRankIndex; $r++) {
            $pendingPromotionCash += (int) self::RANKS[$r]['promotionCash'];
        }

        $ladder = [];
        foreach (self::RANKS as $idx => $def) {
            $ladder[] = [
                ...$def,
                'title' => ['en' => $def['titleEn'], 'ar' => $def['titleAr']],
                'unlocked' => $idx <= $currentRankIndex,
                'claimed' => $idx <= $claimedRankIndex,
                'current' => $idx === $currentRankIndex,
            ];
        }

        return [
            'rankNumber' => $currentRankIndex,
            'index' => $currentRankIndex,
            'currentRankIndex' => $currentRankIndex,
            'claimedRankIndex' => $claimedRankIndex,
            'titleEn' => $currentRank['titleEn'],
            'titleAr' => $currentRank['titleAr'],
            'nextTitleEn' => $nextRank['titleEn'] ?? $currentRank['titleEn'],
            'nextTitleAr' => $nextRank['titleAr'] ?? $currentRank['titleAr'],
            'currentRank' => [
                ...$currentRank,
                'title' => ['en' => $currentRank['titleEn'], 'ar' => $currentRank['titleAr']],
            ],
            'displayedBadgeEn' => sprintf('#%d %s', $currentRankIndex, $currentRank['titleEn']),
            'displayedBadgeAr' => sprintf('#%d %s', $currentRankIndex, $currentRank['titleAr']),
            'claimedRank' => $claimedRank,
            'nextRank' => $nextRank,
            'totalTriggers' => $totalTriggers,
            'maxRankTriggers' => 25,
            'claimable' => $unclaimedCount > 0,
            'unclaimedPromotions' => $unclaimedCount,
            'canClaimPromotion' => $unclaimedCount > 0,
            'pendingPromotionRewards' => [
                'cash' => $pendingPromotionCash,
                'sp' => $unclaimedCount,
                'merits' => $unclaimedCount,
            ],
            'breakdown' => [
                'level' => $levelInfo['earned'],
                'battleStats' => $battleInfo['earned'],
                'networth' => $networthInfo['earned'],
                'crimes' => $crimeInfo['earned'],
            ],
            'triggers' => [
                'level' => ['labelEn' => 'Level Milestones', 'labelAr' => 'محطات المستوى', 'currentValue' => $level, ...$levelInfo],
                'battleStats' => ['labelEn' => 'Total Battle Stats', 'labelAr' => 'إجمالي القوة القتالية', 'currentValue' => $battleStats, ...$battleInfo],
                'networth' => ['labelEn' => 'Total Net Worth', 'labelAr' => 'إجمالي صافي الثروة', 'currentValue' => $netWorth, ...$networthInfo],
                'crimes' => ['labelEn' => 'Crimes Committed', 'labelAr' => 'الجرائم الناجحة', 'currentValue' => $crimes, ...$crimeInfo],
            ],
            'ladder' => $ladder,
        ];
    }

    /**
     * @param list<int> $thresholds
     * @return array{earned: int, total: int, nextThreshold: ?int, remaining: int, progressPct: int, thresholds: list<int>}
     */
    private function countTriggers(int $value, array $thresholds): array
    {
        $earned = 0;
        $next = null;
        $prev = 0;
        foreach ($thresholds as $t) {
            if ($value >= $t) {
                $earned++;
                $prev = $t;
            } elseif ($next === null) {
                $next = $t;
            }
        }
        $span = $next !== null ? max(1, $next - $prev) : 1;
        $pct = $next === null ? 100 : (int) min(100, max(0, round((($value - $prev) / $span) * 100)));

        return [
            'earned' => $earned,
            'total' => count($thresholds),
            'nextThreshold' => $next,
            'remaining' => $next === null ? 0 : max(0, $next - $value),
            'progressPct' => $pct,
            'thresholds' => $thresholds,
        ];
    }

    /** @return array{totalSpEarned: int, spentSp: int, availableSp: int, sources: array<string, int>} */
    private function computeSkillPointLedger(array $player, array $state): array
    {
        $rpg = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
        $levelSp = max(0, (int) $player['level'] - 1) * LevelingService::SP_PER_LEVEL;
        $storySp = max((int) ($state['story']['spEarned'] ?? 0), (int) ($rpg['storySpEarned'] ?? 0));
        $rankSp = (int) ($rpg['rankSpEarned'] ?? 0);
        $bonusSp = (int) ($rpg['bonusSp'] ?? 0);

        $totalSpEarned = $levelSp + $storySp + $rankSp + $bonusSp;
        $spentSp = $this->computeSpentSp(is_array($rpg['unlockedNodes'] ?? null) ? $rpg['unlockedNodes'] : []);
        $availableSp = max(0, $totalSpEarned - $spentSp);

        return [
            'totalSpEarned' => $totalSpEarned,
            'spentSp' => $spentSp,
            'availableSp' => $availableSp,
            'sources' => [
                'levels' => $levelSp,
                'story' => $storySp,
                'ranks' => $rankSp,
                'bonus' => $bonusSp,
            ],
        ];
    }

    private function computeSpentSp(array $unlockedNodes): int
    {
        $spent = 0;
        foreach (array_keys($unlockedNodes) as $nodeId) {
            if (isset(self::SKILL_NODES[$nodeId])) {
                $spent += (int) self::SKILL_NODES[$nodeId]['spCost'];
            }
        }
        return $spent;
    }

    /** @return array<string, int> */
    private function computeTreeBonuses(array $unlockedNodes): array
    {
        $totals = [
            'crimeSuccessPct' => 0,
            'stealthPct' => 0,
            'maxNerve' => 0,
            'combatDamagePct' => 0,
            'mugPlunderPct' => 0,
            'maxLife' => 0,
            'bankAprPct' => 0,
            'stockFeeReductionPct' => 0,
            'travelLuggage' => 0,
            'jobPayPct' => 0,
            'odRiskReductionPct' => 0,
            'medHealPct' => 0,
            'reviveEnergyReduction' => 0,
            'maxEnergy' => 0,
        ];
        foreach (array_keys($unlockedNodes) as $nodeId) {
            if (!isset(self::SKILL_NODES[$nodeId])) {
                continue;
            }
            foreach (self::SKILL_NODES[$nodeId]['effects'] as $effectKey => $delta) {
                $totals[$effectKey] = (int) ($totals[$effectKey] ?? 0) + (int) $delta;
            }
        }
        return $totals;
    }

    /** @return array<string, int> */
    private function computeMasterySkills(array $state): array
    {
        $skill = is_array($state['skill'] ?? null) ? $state['skill'] : [];
        $ctr = is_array($state['ctr'] ?? null) ? $state['ctr'] : [];
        $plushiesCount = count(is_array($state['plushies'] ?? null) ? array_filter($state['plushies']) : []);

        return [
            'hunting' => min(100, max(0, (int) ($skill['hunting'] ?? 0))),
            'racing' => min(100, max(0, (int) ($skill['racing'] ?? 0))),
            'reviving' => min(100, max((int) ($skill['reviving'] ?? 0), (int) ($skill['revive'] ?? 0))),
            'busting' => min(100, max((int) ($skill['busting'] ?? 0), (int) ($skill['bust'] ?? 0))),
            'smuggling' => min(100, max((int) ($skill['smuggling'] ?? 0), $plushiesCount * 5)),
            'forging' => min(100, max((int) ($skill['forging'] ?? 0), (int) ($skill['bootlegging'] ?? 0))),
            'hacking' => min(100, max((int) ($skill['hacking'] ?? 0), (int) ($skill['cardskimming'] ?? 0), (int) ($skill['cracking'] ?? 0))),
            'weapon_mastery' => min(100, max((int) ($skill['weapon_mastery'] ?? 0), ((int) ($ctr['wins'] ?? 0)) * 2)),
            'crime_mastery' => min(100, max((int) ($skill['crime_mastery'] ?? 0), intdiv(max(0, (int) ($state['crimeXp'] ?? 0)), 25))),
        ];
    }

    private function reconcileRpgState(array $player, array &$state): bool
    {
        $before = $state['rpg'] ?? null;
        $raw = is_array($before) ? $before : [];
        $currentLevel = max(1, (int) $player['level']);
        $eligibleLevel = min(100, $this->leveling->levelForXp((int) $player['xp']));

        $unlockedNodes = is_array($raw['unlockedNodes'] ?? null) ? $raw['unlockedNodes'] : [];
        $storySp = max((int) ($state['story']['spEarned'] ?? 0), (int) ($raw['storySpEarned'] ?? 0));

        $rpg = [
            'holdLevel' => !empty($raw['holdLevel']),
            'eligibleLevel' => $eligibleLevel,
            'pendingLevels' => max(0, $eligibleLevel - $currentLevel),
            'syncedMeritLevel' => max($currentLevel, (int) ($raw['syncedMeritLevel'] ?? $currentLevel)),
            'levelSpEarned' => max(0, $currentLevel - 1) * LevelingService::SP_PER_LEVEL,
            'storySpEarned' => $storySp,
            'rankSpEarned' => (int) ($raw['rankSpEarned'] ?? 0),
            'rankMeritsEarned' => (int) ($raw['rankMeritsEarned'] ?? 0),
            'bonusSp' => (int) ($raw['bonusSp'] ?? 0),
            'bonusLifeFromLevels' => (int) ($raw['bonusLifeFromLevels'] ?? 0),
            'claimedRankIndex' => max(1, (int) ($raw['claimedRankIndex'] ?? 1)),
            'unlockedNodes' => $unlockedNodes,
            'skillFreeRespecUsed' => !empty($raw['skillFreeRespecUsed']),
            'respecCount' => (int) ($raw['respecCount'] ?? 0),
            'appliedCaps' => [
                'max_nerve' => (int) ($raw['appliedCaps']['max_nerve'] ?? 0),
                'max_energy' => (int) ($raw['appliedCaps']['max_energy'] ?? 0),
                'max_life' => (int) ($raw['appliedCaps']['max_life'] ?? 0),
            ],
            'bonuses' => $this->computeTreeBonuses($unlockedNodes),
        ];

        $state['rpg'] = $rpg;
        return $before !== $rpg;
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

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}

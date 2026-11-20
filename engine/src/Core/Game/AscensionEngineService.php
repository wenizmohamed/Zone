<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v151 Breakthrough Progression & Living World Ascension Engine:
 * 1. Minute-0 Origin Awakening (`origin.select`) — 4 bilingual underworld origins
 * 2. 6-Era Underworld Ascension Spine (`era.claimBreakthrough`) + Next World Unlock radar
 * 3. Living Personal Nemesis System (`nemesis.gatherIntel`, `nemesis.confront`)
 * 4. 5-Slot Evolving Street Crew (`crew.recruit`, `crew.upgrade`, `crew.collectTribute`)
 * 5. Luna · Syndicate Architect live reactive comms & 12-Step Guided Directives (`luna.claimDirective`)
 */
final class AscensionEngineService
{
    public const NEMESIS_INTEL_ENERGY_COST = 5;
    public const NEMESIS_CONFRONT_ENERGY_COST = 15;
    public const NEMESIS_DEFEAT_HOSPITAL_SECONDS = 300; // 5m hospital
    public const NEMESIS_HEAT_CLEAR_SECONDS = 43200;    // 12h turf tax immunity
    public const CREW_MAX_RANK = 5;
    public const CREW_TRIBUTE_MIN_SECONDS = 300;        // 5m minimum accrual
    public const CREW_TRIBUTE_MAX_SECONDS = 43200;      // 12h accrual cap

    /** @var array<string, array<string, mixed>> */
    public const ORIGINS = [
        'harbor_ghost' => [
            'id' => 'harbor_ghost',
            'nameEn' => 'Harbor Ghost',
            'nameAr' => 'شبح المرفأ',
            'taglineEn' => 'Silent dockside infiltrator raised between rusted Pier 4 containers.',
            'taglineAr' => 'متسلل صامت نشأ بين حاويات الرصيف الرابع الصدئة.',
            'perksSummaryEn' => '+8% Crime Success · +10% Stealth · Knife + $4,000',
            'perksSummaryAr' => '+8% نجاح الجرائم · +10% تخفٍ · سكين + 4,000$',
            'starterCash' => 4000,
            'starterItems' => ['knife' => 1],
            'maxLifeBonus' => 0,
            'maxEnergyBonus' => 0,
            'bonuses' => [
                'crimeSuccessPct' => 8,
                'stealthPct' => 10,
                'combatDamagePct' => 0,
                'maxLife' => 0,
                'bankAprPct' => 0,
                'vaultAprPct' => 0,
                'marketFeeReductionPct' => 0,
                'stockFeeReductionPct' => 0,
                'odRiskReductionPct' => 0,
                'maxEnergy' => 0,
            ],
        ],
        'cartel_bruiser' => [
            'id' => 'cartel_bruiser',
            'nameEn' => 'Ex-Cartel Enforcer',
            'nameAr' => 'منفّذ الكارتل',
            'taglineEn' => 'Scarred heavy hitter who collects debts in blood and shattered bone.',
            'taglineAr' => 'مقاتل شرس يحصّل الديون بالقوة والضربات الحاسمة.',
            'perksSummaryEn' => '+10% Combat Damage · +50 Max Life · Bat + Small Medkit + $3,000',
            'perksSummaryAr' => '+10% ضرر قتالي · +50 أقصى صحة · مضرب + إسعاف أولي + 3,000$',
            'starterCash' => 3000,
            'starterItems' => ['bat' => 1, 'smallkit' => 1],
            'maxLifeBonus' => 50,
            'maxEnergyBonus' => 0,
            'bonuses' => [
                'crimeSuccessPct' => 0,
                'stealthPct' => 0,
                'combatDamagePct' => 10,
                'maxLife' => 50,
                'bankAprPct' => 0,
                'vaultAprPct' => 0,
                'marketFeeReductionPct' => 0,
                'stockFeeReductionPct' => 0,
                'odRiskReductionPct' => 0,
                'maxEnergy' => 0,
            ],
        ],
        'disgraced_banker' => [
            'id' => 'disgraced_banker',
            'nameEn' => 'Fallen Financier',
            'nameAr' => 'المصرفي الساقط',
            'taglineEn' => 'Blacklisted clearing-house prodigy laundering syndicate millions.',
            'taglineAr' => 'عبقري مالي مطرود يدير غسيل أموال النقابة وعوائد الخزائن.',
            'perksSummaryEn' => '+8% Bank & Vault APR · -20% Market/Stock Fee · $12,000 Seed Capital',
            'perksSummaryAr' => '+8% عائد البنك والخزائن · -20% رسوم السوق والأسهم · 12,000$ رأس مال',
            'starterCash' => 12000,
            'starterItems' => [],
            'maxLifeBonus' => 0,
            'maxEnergyBonus' => 0,
            'bonuses' => [
                'crimeSuccessPct' => 0,
                'stealthPct' => 0,
                'combatDamagePct' => 0,
                'maxLife' => 0,
                'bankAprPct' => 8,
                'vaultAprPct' => 8,
                'marketFeeReductionPct' => 20,
                'stockFeeReductionPct' => 20,
                'odRiskReductionPct' => 0,
                'maxEnergy' => 0,
            ],
        ],
        'street_chemist' => [
            'id' => 'street_chemist',
            'nameEn' => 'Underground Chemist',
            'nameAr' => 'الخيميائي السري',
            'taglineEn' => 'Back-alley synthesist mastering pure stimulants and trauma triage.',
            'taglineAr' => 'خبير تركيبات سرية يتقن المنشطات النقية والإسعاف الميداني.',
            'perksSummaryEn' => '-20% Drug Overdose Risk · +10 Max Energy · 2x Medkit + 2x Drink + $3,500',
            'perksSummaryAr' => '-20% خطر الجرعة الزائدة · +10 أقصى طاقة · حقيبتا إسعاف + مشروبان + 3,500$',
            'starterCash' => 3500,
            'starterItems' => ['smallkit' => 2, 'drink' => 2],
            'maxLifeBonus' => 0,
            'maxEnergyBonus' => 10,
            'bonuses' => [
                'crimeSuccessPct' => 0,
                'stealthPct' => 0,
                'combatDamagePct' => 0,
                'maxLife' => 0,
                'bankAprPct' => 0,
                'vaultAprPct' => 0,
                'marketFeeReductionPct' => 0,
                'stockFeeReductionPct' => 0,
                'odRiskReductionPct' => 20,
                'maxEnergy' => 10,
            ],
        ],
    ];

    /** @var array<int, array<string, mixed>> */
    public const ERAS = [
        1 => [
            'eraIndex' => 1,
            'id' => 'gutter_rat',
            'roman' => 'I',
            'minLevel' => 1,
            'maxLevel' => 2,
            'breakthroughLevel' => 2,
            'nameEn' => 'Gutter Rat',
            'nameAr' => 'جرذ الأزقة',
            'titleEn' => 'Era I: Gutter Rat',
            'titleAr' => 'العصر الأول: جرذ الأزقة',
            'safehouseEn' => 'Rusted Pier 4 Container',
            'safehouseAr' => 'حاوية الرصيف الرابع الصدئة',
            'cashReward' => 5000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'Pier 4 Survivor',
            'rewardTitleAr' => 'ناجي الرصيف الرابع',
        ],
        2 => [
            'eraIndex' => 2,
            'id' => 'dockside_runner',
            'roman' => 'II',
            'minLevel' => 3,
            'maxLevel' => 6,
            'breakthroughLevel' => 6,
            'nameEn' => 'Dockside Runner',
            'nameAr' => 'عدّاء الأرصفة',
            'titleEn' => 'Era II: Dockside Runner',
            'titleAr' => 'العصر الثاني: عدّاء الأرصفة',
            'safehouseEn' => 'Neon Alley Backroom',
            'safehouseAr' => 'غرفة زقاق النيون الخلفية',
            'cashReward' => 15000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'Neon Alley Runner',
            'rewardTitleAr' => 'عدّاء زقاق النيون',
        ],
        3 => [
            'eraIndex' => 3,
            'id' => 'street_enforcer',
            'roman' => 'III',
            'minLevel' => 7,
            'maxLevel' => 11,
            'breakthroughLevel' => 11,
            'nameEn' => 'Street Enforcer',
            'nameAr' => 'منفّذ الشوارع',
            'titleEn' => 'Era III: Street Enforcer',
            'titleAr' => 'العصر الثالث: منفّذ الشوارع',
            'safehouseEn' => 'Fortified Harbor Flat',
            'safehouseAr' => 'شقة المرفأ المحصنة',
            'cashReward' => 35000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'Harbor Iron Fist',
            'rewardTitleAr' => 'قبضة المرفأ الحديدية',
        ],
        4 => [
            'eraIndex' => 4,
            'id' => 'district_capo',
            'roman' => 'IV',
            'minLevel' => 12,
            'maxLevel' => 14,
            'breakthroughLevel' => 14,
            'nameEn' => 'District Capo',
            'nameAr' => 'كابو المقاطعة',
            'titleEn' => 'Era IV: District Capo',
            'titleAr' => 'العصر الرابع: كابو المقاطعة',
            'safehouseEn' => 'Downtown War-Room',
            'safehouseAr' => 'غرفة حرب وسط المدينة',
            'cashReward' => 75000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'War-Room Tactician',
            'rewardTitleAr' => 'مهندس غرفة الحرب',
        ],
        5 => [
            'eraIndex' => 5,
            'id' => 'cartel_baron',
            'roman' => 'V',
            'minLevel' => 15,
            'maxLevel' => 24,
            'breakthroughLevel' => 24,
            'nameEn' => 'Cartel Baron',
            'nameAr' => 'بارون الكارتل',
            'titleEn' => 'Era V: Cartel Baron',
            'titleAr' => 'العصر الخامس: بارون الكارتل',
            'safehouseEn' => 'Skyline Penthouse Vault',
            'safehouseAr' => 'خزنة البنتهاوس السماوية',
            'cashReward' => 175000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'Skyline Cartel Baron',
            'rewardTitleAr' => 'بارون الأبراج والكارتل',
        ],
        6 => [
            'eraIndex' => 6,
            'id' => 'city_sovereign',
            'roman' => 'VI',
            'minLevel' => 25,
            'maxLevel' => 100,
            'breakthroughLevel' => 25,
            'nameEn' => 'City Sovereign',
            'nameAr' => 'سيّد المدينة الأعلى',
            'titleEn' => 'Era VI: City Sovereign',
            'titleAr' => 'العصر السادس: سيّد المدينة الأعلى',
            'safehouseEn' => 'Sovereign Private Island Compound',
            'safehouseAr' => 'مجمع الجزيرة السيادية الخاصة',
            'cashReward' => 500000,
            'spReward' => 2,
            'meritsReward' => 2,
            'rewardTitleEn' => 'Immortal Sovereign of Zone City',
            'rewardTitleAr' => 'السيّد الخالد لمدينة الزون',
        ],
    ];

    /** @var list<array<string, mixed>> */
    public const LEVEL_GATES = [
        [
            'level' => 2,
            'id' => 'city_dump',
            'featureEn' => 'City Dump & Syndicate Mail',
            'featureAr' => 'مكب المدينة والبريد المشفر',
            'descEn' => 'Scavenge discarded contraband at the City Dump and unlock encrypted syndicate mail.',
            'descAr' => 'التنقيب عن الغنائم الملقاة في مكب المدينة وفتح البريد المشفر.',
            'targetRoute' => 'city',
        ],
        [
            'level' => 3,
            'id' => 'casino_wheels',
            'featureEn' => 'Casino Floor & Daily Spin Wheels',
            'featureAr' => 'صالة الكازينو وعجلات الحظ اليومية',
            'descEn' => 'Spin Lame, Mediocre & Awesome wheels, play Syndicate Arcade, and unlock Wheelman crew.',
            'descAr' => 'تدوير عجلات الحظ الثلاث وصالة الكازينو وتجنيد سائق الهروب.',
            'targetRoute' => 'casino',
        ],
        [
            'level' => 5,
            'id' => 'market_bazaar',
            'featureEn' => 'Personal Bazaars, Direct Trades & Chemist',
            'featureAr' => 'البازارات الشخصية والتبادل المباشر والكيميائي',
            'descEn' => 'Open 0%-tax Personal Bazaars, 2-player Safe Trades, Act II, and Chemist crew.',
            'descAr' => 'فتح البازار الشخصي بدون ضريبة والتبادل الآمن والفصل الثاني.',
            'targetRoute' => 'market',
        ],
        [
            'level' => 7,
            'id' => 'bounties_agents',
            'featureEn' => 'Hit Bounties & NPC Fixer Contracts',
            'featureAr' => 'عقود التصفية ووكلاء المهام',
            'descEn' => 'Run fixer contracts for Duke, Layla, Mayor Tariq & Madame Vega for Mission Armory credits.',
            'descAr' => 'تنفيذ عقود الوكلاء لكسب رصيد ترسانة المهام التكتيكية.',
            'targetRoute' => 'city',
        ],
        [
            'level' => 10,
            'id' => 'companies_bank_vaults',
            'featureEn' => 'Player Companies, Bank CDs & Property Vaults',
            'featureAr' => 'شركات اللاعبين وشهادات البنك والخزائن',
            'descEn' => 'Lock high-APR Bank Term CDs, Property Vaults, and 1★-10★ Player Companies.',
            'descAr' => 'ربط شهادات الإيداع البنكية وخزائن العقارات وشركات اللاعبين.',
            'targetRoute' => 'bank',
        ],
        [
            'level' => 12,
            'id' => 'factions_stocks',
            'featureEn' => 'Faction Founding, Ranked Wars & Stock Exchange',
            'featureAr' => 'تأسيس العائلات وحروب التصنيف وسوق الأسهم',
            'descEn' => 'Found or command Factions, 7-branch Respect Trees, Stock benefit blocks & Consigliere.',
            'descAr' => 'تأسيس العائلات وشجرة الاحترام وسوق الأسهم وتجنيد المستشار.',
            'targetRoute' => 'faction',
        ],
        [
            'level' => 15,
            'id' => 'international_airport',
            'featureEn' => 'International Airport & Foreign Smuggling',
            'featureAr' => 'المطار الدولي والتهريب الخارجي',
            'descEn' => 'Fly to 9 global hubs for plushies, exotic flowers, heavy arms, and Swiss rehab.',
            'descAr' => 'السفر عبر المطار الدولي لتجارة الدمى والزهور النادرة والأسلحة الثقيلة.',
            'targetRoute' => 'city',
        ],
        [
            'level' => 20,
            'id' => 'specialist_gyms',
            'featureEn' => 'Heavyweight & Specialist Gyms',
            'featureAr' => 'الأندية الرياضية التخصصية',
            'descEn' => 'Unlock apex heavyweight training facilities for massive battle stat multipliers.',
            'descAr' => 'فتح الأندية التخصصية المتقدمة لمضاعفة مكاسب القوة القتالية.',
            'targetRoute' => 'gym',
        ],
        [
            'level' => 25,
            'id' => 'sovereign_endgame',
            'featureEn' => 'City Sovereign Compound & Act V Finale',
            'featureAr' => 'مجمع السيادة والفصل الخامس الأخير',
            'descEn' => 'Ascend to Era VI City Sovereign, challenge The Shadow Regent, and claim Gold War Caches.',
            'descAr' => 'الصعود إلى عصر سيّد المدينة ومواجهة الوصي الخفي في الفصل الخامس.',
            'targetRoute' => 'home',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const CREW_SLOTS = [
        'lookout' => [
            'id' => 'lookout',
            'unlockLevel' => 1,
            'nameEn' => 'Dockside Lookout',
            'nameAr' => 'مراقب الأرصفة',
            'perkEn' => '+3% Crime Success / rank',
            'perkAr' => '+3% نجاح الجرائم لكل رتبة',
            'hourlyRateBase' => 150,
            'costsByRank' => [1 => 1500, 2 => 3500, 3 => 7500, 4 => 15000, 5 => 30000],
        ],
        'wheelman' => [
            'id' => 'wheelman',
            'unlockLevel' => 3,
            'nameEn' => 'Getaway Wheelman',
            'nameAr' => 'سائق الهروب المحترف',
            'perkEn' => '-3% Flight & Escape Risk / rank',
            'perkAr' => '-3% مخاطر الطيران والهروب لكل رتبة',
            'hourlyRateBase' => 300,
            'costsByRank' => [1 => 4500, 2 => 9500, 3 => 19000, 4 => 38000, 5 => 75000],
        ],
        'chemist' => [
            'id' => 'chemist',
            'unlockLevel' => 5,
            'nameEn' => 'Backroom Chemist',
            'nameAr' => 'كيميائي المختبر السري',
            'perkEn' => '-4% Drug OD & +5% Med Heal / rank',
            'perkAr' => '-4% خطر الجرعة الزائدة و+5% شفاء طبي لكل رتبة',
            'hourlyRateBase' => 500,
            'costsByRank' => [1 => 9500, 2 => 20000, 3 => 42000, 4 => 85000, 5 => 165000],
        ],
        'enforcer' => [
            'id' => 'enforcer',
            'unlockLevel' => 8,
            'nameEn' => 'Heavy Enforcer',
            'nameAr' => 'المنفّذ المسلح',
            'perkEn' => '+4% Combat & Nemesis Damage / rank',
            'perkAr' => '+4% ضرر القتال والعدو اللدود لكل رتبة',
            'hourlyRateBase' => 900,
            'costsByRank' => [1 => 22000, 2 => 46000, 3 => 95000, 4 => 190000, 5 => 375000],
        ],
        'consigliere' => [
            'id' => 'consigliere',
            'unlockLevel' => 12,
            'nameEn' => 'Syndicate Consigliere',
            'nameAr' => 'مستشار النقابة الأعلى',
            'perkEn' => '+4% Bank/Company/Vault Yield / rank',
            'perkAr' => '+4% عوائد البنك والشركات والخزائن لكل رتبة',
            'hourlyRateBase' => 1600,
            'costsByRank' => [1 => 50000, 2 => 105000, 3 => 215000, 4 => 430000, 5 => 850000],
        ],
    ];

    /** @var array<int, array<string, mixed>> */
    public const DIRECTIVES = [
        1 => [
            'index' => 1,
            'id' => 'choose_origin',
            'titleEn' => 'Awaken Your Underworld Origin',
            'titleAr' => 'اختر أصلك الإجرامي على الرصيف الرابع',
            'descEn' => 'Lock in your background archetype on Home to wire your starter cash, gear, and permanent perk.',
            'descAr' => 'حدّد خلفيتك الإجرامية في الصفحة الرئيسية لاستلام أموال البداية والعتاد والميزة الدائمة.',
            'targetRoute' => 'home',
            'rewards' => ['xp' => 45, 'cash' => 1500, 'sp' => 1, 'merits' => 0],
        ],
        2 => [
            'index' => 2,
            'id' => 'first_crime',
            'titleEn' => 'Execute Your First Street Crime',
            'titleAr' => 'نفّذ جريمتك الميدانية الأولى',
            'descEn' => 'Spend Nerve on Crimes to earn street cash, Crime Mastery, and real leveling XP.',
            'descAr' => 'استخدم الجرأة في قسم الجرائم لكسب المال والخبرة الميدانية.',
            'targetRoute' => 'crimes',
            'rewards' => ['xp' => 60, 'cash' => 2000, 'sp' => 0, 'merits' => 1],
        ],
        3 => [
            'index' => 3,
            'id' => 'first_gym',
            'titleEn' => 'Complete Your First Gym Session',
            'titleAr' => 'أكمل أول حصة تدريبية في النادي',
            'descEn' => 'Burn Energy in the Gym to build permanent Strength, Defense, Speed, or Dexterity.',
            'descAr' => 'احرق طاقتك في النادي الرياضي لرفع صفاتك القتالية الدائمة.',
            'targetRoute' => 'gym',
            'rewards' => ['xp' => 65, 'cash' => 2500, 'sp' => 1, 'merits' => 0],
        ],
        4 => [
            'index' => 4,
            'id' => 'lv2_scavenge_dump',
            'titleEn' => 'Reach Lv 2 & Scavenge the City Dump',
            'titleAr' => 'بلوغ المستوى 2 والتنقيب في مكب المدينة',
            'descEn' => 'Hit Level 2 and search or toss contraband in the City Dump district.',
            'descAr' => 'اصعد للمستوى 2 ونقّب عن الغنائم في مكب المدينة.',
            'targetRoute' => 'city',
            'rewards' => ['xp' => 85, 'cash' => 3500, 'sp' => 0, 'merits' => 1],
        ],
        5 => [
            'index' => 5,
            'id' => 'recruit_lookout',
            'titleEn' => 'Recruit Your Dockside Lookout',
            'titleAr' => 'جنّد مراقب الأرصفة في طاقمك',
            'descEn' => 'Hire a Lookout in your Street Crew for +3% Crime Success and $150/hr passive turf tribute.',
            'descAr' => 'وظّف مراقب الأرصفة ضمن طاقمك لكسب +3% نجاح الجرائم و150$/ساعة إتاوة.',
            'targetRoute' => 'home',
            'rewards' => ['xp' => 95, 'cash' => 4000, 'sp' => 1, 'merits' => 0],
        ],
        6 => [
            'index' => 6,
            'id' => 'lv3_spin_wheel',
            'titleEn' => 'Reach Lv 3 & Spin the Daily Wheel',
            'titleAr' => 'بلوغ المستوى 3 وتدوير عجلة الحظ',
            'descEn' => 'Unlock Level 3 and spin any Torn fortune wheel in City Activities.',
            'descAr' => 'افتح المستوى 3 وقم بتدوير إحدى عجلات الحظ اليومية.',
            'targetRoute' => 'city',
            'rewards' => ['xp' => 125, 'cash' => 5000, 'sp' => 0, 'merits' => 1],
        ],
        7 => [
            'index' => 7,
            'id' => 'gather_nemesis_intel',
            'titleEn' => 'Gather 100% Nemesis Safehouse Intel',
            'titleAr' => 'اجمع 100% من معلومات مخبأ عدوك اللدود',
            'descEn' => 'Sweep the streets (5E) until you pinpoint your personal Nemesis rival at 100% Intel.',
            'descAr' => 'مشّط الشوارع (5 طاقة) حتى تكشف موقع عدوك اللدود بنسبة 100%.',
            'targetRoute' => 'home',
            'rewards' => ['xp' => 150, 'cash' => 6500, 'sp' => 1, 'merits' => 0],
        ],
        8 => [
            'index' => 8,
            'id' => 'defeat_first_nemesis',
            'titleEn' => 'Defeat Your Personal Nemesis',
            'titleAr' => 'اهزم عدوك اللدود في مواجهة مباشرة',
            'descEn' => 'Confront your Nemesis (15E) to seize their $8,000+ bounty, trophy weapon, and 12h heat immunity.',
            'descAr' => 'واجه عدوك اللدود (15 طاقة) لانتزاع المكافأة وسلاح الغنيمة وإلغاء الإتاوة لـ12 ساعة.',
            'targetRoute' => 'home',
            'rewards' => ['xp' => 230, 'cash' => 10000, 'sp' => 1, 'merits' => 1],
        ],
        9 => [
            'index' => 9,
            'id' => 'lv5_open_market_bazaar',
            'titleEn' => 'Reach Lv 5 & Trade on Market / Bazaar',
            'titleAr' => 'بلوغ المستوى 5 وفتح السوق أو البازار',
            'descEn' => 'Reach Level 5 and open your Personal 0%-Tax Bazaar, list contraband, or buy gear on Market.',
            'descAr' => 'اصعد للمستوى 5 وافتح بازارك الشخصي أو تداول في سوق الأدوات.',
            'targetRoute' => 'market',
            'rewards' => ['xp' => 360, 'cash' => 15000, 'sp' => 1, 'merits' => 1],
        ],
        10 => [
            'index' => 10,
            'id' => 'lv10_lock_bank_vault',
            'titleEn' => 'Reach Lv 10 & Lock Bank / Vault Capital',
            'titleAr' => 'بلوغ المستوى 10 وتأمين رأس المال بالبنك أو الخزنة',
            'descEn' => 'Reach Level 10 and secure capital inside the City Bank, a Term CD, or a Property Vault.',
            'descAr' => 'اصعد للمستوى 10 واحفظ أموالك في البنك أو شهادة إيداع أو خزنة عقارية.',
            'targetRoute' => 'bank',
            'rewards' => ['xp' => 600, 'cash' => 30000, 'sp' => 1, 'merits' => 1],
        ],
        11 => [
            'index' => 11,
            'id' => 'lv12_join_found_faction',
            'titleEn' => 'Reach Lv 12 & Join or Found a Faction',
            'titleAr' => 'بلوغ المستوى 12 والانضمام أو تأسيس عائلة',
            'descEn' => 'Reach Level 12 and pledge to or found an underworld Faction HQ.',
            'descAr' => 'اصعد للمستوى 12 وانضم إلى عائلة إجرامية أو أسّس عائلتك الخاصة.',
            'targetRoute' => 'faction',
            'rewards' => ['xp' => 900, 'cash' => 50000, 'sp' => 2, 'merits' => 1],
        ],
        12 => [
            'index' => 12,
            'id' => 'lv15_first_flight',
            'titleEn' => 'Reach Lv 15 & Board First International Flight',
            'titleAr' => 'بلوغ المستوى 15 والصعود لأول رحلة دولية',
            'descEn' => 'Unlock the International Airport at Level 15 and depart on your first foreign smuggling run.',
            'descAr' => 'افتح المطار الدولي عند المستوى 15 وانطلق في أول رحلة تهريب خارجية.',
            'targetRoute' => 'city',
            'rewards' => ['xp' => 1500, 'cash' => 100000, 'sp' => 2, 'merits' => 2],
        ],
    ];

    /** @var list<array<string, string>> */
    private const NEMESIS_ROSTER = [
        [
            'nameEn' => 'Malik "Razor" Vance',
            'nameAr' => 'مالك "الموس" فانس',
            'archetype' => 'shadow_stalker',
            'archetypeEn' => 'Harbor Cutthroat',
            'archetypeAr' => 'سفاح المرافئ',
            'districtId' => 'pier_4',
            'districtEn' => 'Pier 4 Docks',
            'districtAr' => 'أرصفة الميناء ٤',
        ],
        [
            'nameEn' => 'Soraia "Hollow-Point" Kouri',
            'nameAr' => 'ثريا "الرصاصة" خوري',
            'archetype' => 'cartel_enforcer',
            'archetypeEn' => 'Rogue Sicaria',
            'archetypeAr' => 'قاتلة الكارتل المتمردة',
            'districtId' => 'neon_alley',
            'districtEn' => 'Neon Alley',
            'districtAr' => 'زقاق النيون',
        ],
        [
            'nameEn' => 'Drago "Dock-Breaker" Petrov',
            'nameAr' => 'دراغو "محطم الأرصفة" بتروف',
            'archetype' => 'cartel_enforcer',
            'archetypeEn' => 'Foundry Bruiser',
            'archetypeAr' => 'جلاد المسبك الصناعي',
            'districtId' => 'foundry',
            'districtEn' => 'Industrial Foundry',
            'districtAr' => 'المسبك الصناعي',
        ],
        [
            'nameEn' => 'Zayd "Ash-Lung" Al-Masri',
            'nameAr' => 'زيد "رئة الرماد" المصري',
            'archetype' => 'chem_raider',
            'archetypeEn' => 'Lab Hijacker',
            'archetypeAr' => 'قرصان المختبرات',
            'districtId' => 'old_harbor',
            'districtEn' => 'Pier 4 Warehouses',
            'districtAr' => 'مستودعات الرصيف الرابع',
        ],
        [
            'nameEn' => 'Valeria "Glass-Eye" Costa',
            'nameAr' => 'فاليريا "العين الزجاجية" كوستا',
            'archetype' => 'corrupt_fixer',
            'archetypeEn' => 'Extortion Broker',
            'archetypeAr' => 'سمسارة الابتزاز',
            'districtId' => 'downtown',
            'districtEn' => 'Downtown Financial',
            'districtAr' => 'الحي المالي بوسط المدينة',
        ],
        [
            'nameEn' => 'Hector "Rust-Hook" Salazar',
            'nameAr' => 'هيكتور "الخطاف الصدئ" سالازار',
            'archetype' => 'shadow_stalker',
            'archetypeEn' => 'Smuggler Hunter',
            'archetypeAr' => 'صائد المهربين',
            'districtId' => 'cargo_bay',
            'districtEn' => 'Pier 4 Cargo Bay',
            'districtAr' => 'رصيف الشحن الرابع',
        ],
    ];

    /** @var array<int, array{en: string, ar: string}> */
    private const NEMESIS_TITLES_BY_TIER = [
        1 => ['en' => 'Corner Extortionist', 'ar' => 'مبتز الزوايا'],
        2 => ['en' => 'Scarred Street Hound', 'ar' => 'كلب الشوارع المندوب'],
        3 => ['en' => 'Bloodied Block Lieutenant', 'ar' => 'ملازم الأحياء الدموي'],
        4 => ['en' => 'Vengeful Turf Hunter', 'ar' => 'صائد المناطق المنتقم'],
        5 => ['en' => 'Hollow-Point Stalker', 'ar' => 'مطارد الرصاص المتفجر'],
        6 => ['en' => 'Syndicate Hit-Commander', 'ar' => 'قائد فرق التصفية'],
        7 => ['en' => 'Iron-Jawed Warlord', 'ar' => 'أمير الحرب الفولاذي'],
        8 => ['en' => 'Phantom of the 120 Blocks', 'ar' => 'شبح المئة وعشرين مربعاً'],
        9 => ['en' => 'Dread Underboss', 'ar' => 'نائب الزعيم المرعب'],
        10 => ['en' => 'Blood-Sworn Arch-Nemesis', 'ar' => 'العدو اللدود المقسم بالدم'],
    ];

    /** @var list<array{en: string, ar: string}> */
    private const NEMESIS_SCARS = [
        ['en' => 'Stitched blade gash across left cheekbone', 'ar' => 'ندبة نصل مخيطة على عظمة الخد الأيسر'],
        ['en' => 'Shattered collarbone & scorched kevlar collar', 'ar' => 'ترقوة مهشمة وياقة كيفلار محترقة'],
        ['en' => 'Grazed temple & silver dermal staples', 'ar' => 'صدغ مخدوش بالرصاص ومشابك جراحية فضية'],
        ['en' => 'Crushed knuckles & Pier 4 Dockyard burns', 'ar' => 'مفاصل مهشمة وحروق من رصيف الميناء الرابع'],
        ['en' => 'Clouded glass eye & titanium jaw-plate', 'ar' => 'عين زجاجية معتمة وصفيحة فك من التيتانيوم'],
    ];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly LevelingService $leveling;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $random = null,
        private readonly ?Closure $clock = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
    }

    public function snapshot(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $nowSec = $this->nowSec();

            $before = $state['ascension'] ?? null;
            $ascension = $this->normalizeAscensionState($playerId, $state, $nowSec);
            $state['ascension'] = $ascension;
            if ($before !== $ascension) {
                $this->saveProgression($playerId, $state, $version);
            }

            return $this->buildView($player, $state, $nowSec);
        });
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $action = trim($action);
        if ($action === '') {
            throw new InvalidArgumentException('Ascension action is required.');
        }

        (new ProgressionService($this->database, $this->events))->snapshot($playerId);

        return $this->database->playerTransaction($playerId, function () use ($playerId, $action, $payload): array {
            $this->resources->regenerate($playerId);
            $player = $this->loadPlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $nowSec = $this->nowSec();
            $nowMs = $nowSec * 1000;
            $correlationId = bin2hex(random_bytes(16));

            $ascension = $this->normalizeAscensionState($playerId, $state, $nowSec);

            switch ($action) {
                case 'origin.select':
                    $result = $this->handleOriginSelect(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $payload,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                case 'era.claimBreakthrough':
                    $result = $this->handleClaimEraBreakthrough(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $payload,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                case 'nemesis.gatherIntel':
                    $result = $this->handleNemesisGatherIntel(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $nowSec,
                        $nowMs,
                        $correlationId,
                    );
                    break;

                case 'nemesis.confront':
                    $result = $this->handleNemesisConfront(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $nowSec,
                        $nowMs,
                        $correlationId,
                    );
                    break;

                case 'crew.recruit':
                    $result = $this->handleCrewRecruit(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $payload,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                case 'crew.upgrade':
                    $result = $this->handleCrewUpgrade(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $payload,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                case 'crew.collectTribute':
                    $result = $this->handleCrewCollectTribute(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                case 'luna.claimDirective':
                    $result = $this->handleClaimDirective(
                        $playerId,
                        $player,
                        $state,
                        $ascension,
                        $version,
                        $payload,
                        $nowSec,
                        $correlationId,
                    );
                    break;

                default:
                    throw new InvalidArgumentException("Unsupported ascension action: {$action}");
            }

            $freshPlayer = $this->loadPlayer($playerId);
            [$freshState] = $this->loadProgression($playerId);

            return [
                ...$this->buildView($freshPlayer, $freshState, $nowSec),
                'result' => $result,
            ];
        });
    }

    /**
     * Pure static helper computing live Origin + Street Crew + Nemesis modifiers from progression state.
     *
     * @return array<string, int>
     */
    public static function computePassiveBonuses(array $state, ?int $nowSec = null): array
    {
        $now = $nowSec ?? time();
        $asc = is_array($state['ascension'] ?? null) ? $state['ascension'] : [];
        $originId = is_string($asc['origin'] ?? null) ? $asc['origin'] : null;
        $originBonuses = ($originId !== null && isset(self::ORIGINS[$originId]))
            ? self::ORIGINS[$originId]['bonuses']
            : [];

        $crew = is_array($asc['crew'] ?? null) ? $asc['crew'] : [];
        $lookoutRank = self::crewRankFromRaw($crew['lookout'] ?? 0);
        $wheelmanRank = self::crewRankFromRaw($crew['wheelman'] ?? 0);
        $chemistRank = self::crewRankFromRaw($crew['chemist'] ?? 0);
        $enforcerRank = self::crewRankFromRaw($crew['enforcer'] ?? 0);
        $consigliereRank = self::crewRankFromRaw($crew['consigliere'] ?? 0);

        $nemesis = is_array($asc['nemesis'] ?? null) ? $asc['nemesis'] : [];
        $clearedUntil = (int) ($nemesis['heatClearedUntil'] ?? 0);
        $heatTaxPct = $clearedUntil > $now ? 0 : max(0, min(10, (int) ($nemesis['heatTaxPct'] ?? 0)));

        return [
            'crimeSuccessPct' => (int) ($originBonuses['crimeSuccessPct'] ?? 0) + ($lookoutRank * 3),
            'stealthPct' => (int) ($originBonuses['stealthPct'] ?? 0),
            'combatDamagePct' => (int) ($originBonuses['combatDamagePct'] ?? 0) + ($enforcerRank * 4),
            'nemesisDamagePct' => ($enforcerRank * 4) + (int) ($originBonuses['combatDamagePct'] ?? 0),
            'flightRiskReductionPct' => $wheelmanRank * 3,
            'escapeBoostPct' => $wheelmanRank * 3,
            'odRiskReductionPct' => (int) ($originBonuses['odRiskReductionPct'] ?? 0) + ($chemistRank * 4),
            'medHealPct' => $chemistRank * 5,
            'bankAprPct' => (int) ($originBonuses['bankAprPct'] ?? 0) + ($consigliereRank * 4),
            'vaultYieldPct' => (int) ($originBonuses['vaultAprPct'] ?? 0) + ($consigliereRank * 4),
            'companyYieldPct' => $consigliereRank * 4,
            'marketFeeReductionPct' => (int) ($originBonuses['marketFeeReductionPct'] ?? 0),
            'stockFeeReductionPct' => (int) ($originBonuses['stockFeeReductionPct'] ?? 0),
            'nemesisHeatTaxPct' => $heatTaxPct,
        ];
    }

    private function handleOriginSelect(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        array $payload,
        int $nowSec,
        string $correlationId,
    ): array {
        if (!empty($ascension['originChosen'])) {
            throw new RuntimeException('Underworld origin has already been awakened for this operative.');
        }

        $originId = strtolower(trim((string) ($payload['originId'] ?? $payload['origin'] ?? $payload['id'] ?? '')));
        if (!isset(self::ORIGINS[$originId])) {
            throw new InvalidArgumentException("Unknown underworld origin: {$originId}");
        }
        $origin = self::ORIGINS[$originId];

        $updatedUsername = (string) $player['username'];
        $callsignApplied = false;
        $rawCallsign = trim((string) ($payload['callsign'] ?? ''));
        if ($rawCallsign !== '') {
            if (
                !preg_match('/^[A-Za-z][A-Za-z0-9_]{2,23}$/D', $rawCallsign)
                || in_array(strtolower($rawCallsign), ['admin', 'system', 'moderator', 'zone', 'luna'], true)
                || str_starts_with(strtolower($rawCallsign), 'player_')
            ) {
                throw new InvalidArgumentException('Callsign must be 3-24 Latin letters, digits, or underscores starting with a letter.');
            }
            $claimedAccount = $this->database->fetchOne(
                'SELECT player_id FROM player_credentials WHERE player_id = :id',
                ['id' => $playerId],
            );
            if ($claimedAccount === null) {
                $lowerCallsign = strtolower($rawCallsign);
                $takenPlayer = $this->database->fetchOne(
                    'SELECT id FROM players WHERE LOWER(username) = :uname AND id <> :pid',
                    ['uname' => $lowerCallsign, 'pid' => $playerId],
                );
                $takenCred = $this->database->fetchOne(
                    'SELECT player_id FROM player_credentials WHERE login_name = :uname',
                    ['uname' => $lowerCallsign],
                );
                if ($takenPlayer !== null || $takenCred !== null) {
                    throw new RuntimeException('That callsign is already claimed by another operative in Zone City.');
                }
                $updatedUsername = $rawCallsign;
                $callsignApplied = true;
            }
        }

        $starterCash = (int) $origin['starterCash'];
        $bonusLife = (int) $origin['maxLifeBonus'];
        $bonusEnergy = (int) $origin['maxEnergyBonus'];

        $newCash = (int) $player['cash'] + $starterCash;
        $newMaxLife = (int) $player['max_life'] + $bonusLife;
        $newLife = min($newMaxLife, (int) $player['life'] + $bonusLife);
        $newMaxEnergy = (int) $player['max_energy'] + $bonusEnergy;
        $newEnergy = min($newMaxEnergy, (int) $player['energy'] + $bonusEnergy);

        $this->database->execute(
            'UPDATE players SET username = :username, cash = :cash, max_life = :maxLife, life = :life, max_energy = :maxEnergy, energy = :energy WHERE id = :id',
            [
                'username' => $updatedUsername,
                'cash' => $newCash,
                'maxLife' => $newMaxLife,
                'life' => $newLife,
                'maxEnergy' => $newMaxEnergy,
                'energy' => $newEnergy,
                'id' => $playerId,
            ],
        );

        if ($starterCash > 0) {
            $this->ledger->record($playerId, 'cash', $starterCash, $newCash, 'ascension.origin.' . $originId, $correlationId);
        }

        $state['inv'] = is_array($state['inv'] ?? null) ? $state['inv'] : [];
        $itemsGranted = [];
        foreach ($origin['starterItems'] as $itemId => $qty) {
            $grantQty = (int) $qty;
            if ($grantQty <= 0) {
                continue;
            }
            $state['inv'][$itemId] = max(0, (int) ($state['inv'][$itemId] ?? 0)) + $grantQty;
            $this->ledger->record(
                $playerId,
                'item:' . $itemId,
                $grantQty,
                (int) $state['inv'][$itemId],
                'ascension.origin.' . $originId,
                $correlationId,
            );
            $itemsGranted[$itemId] = $grantQty;
        }

        $ascension['originChosen'] = true;
        $ascension['origin'] = $originId;
        $ascension['originId'] = $originId;
        $ascension['originSelectedAt'] = $nowSec;
        $ascension['originBonuses'] = $origin['bonuses'];
        $ascension['directiveIndex'] = max(1, (int) ($ascension['directiveIndex'] ?? 1));

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $this->events->publish(new DomainEvent('PlayerOriginSelected', [
            'playerId' => $playerId,
            'originId' => $originId,
            'callsign' => $updatedUsername,
            'callsignApplied' => $callsignApplied,
            'starterCash' => $starterCash,
            'itemsGranted' => $itemsGranted,
            'maxLifeBonus' => $bonusLife,
            'maxEnergyBonus' => $bonusEnergy,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'origin.select',
            'originId' => $originId,
            'originNameEn' => $origin['nameEn'],
            'originNameAr' => $origin['nameAr'],
            'username' => $updatedUsername,
            'callsignApplied' => $callsignApplied,
            'cashAwarded' => $starterCash,
            'itemsGranted' => $itemsGranted,
            'maxLifeBonus' => $bonusLife,
            'maxEnergyBonus' => $bonusEnergy,
            'directiveUnlocked' => 1,
        ];
    }

    private function handleClaimEraBreakthrough(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        array $payload,
        int $nowSec,
        string $correlationId,
    ): array {
        $requestedIndex = (int) ($payload['eraIndex'] ?? $payload['era'] ?? $payload['index'] ?? 0);
        if ($requestedIndex === 0) {
            foreach (self::ERAS as $idx => $eraDef) {
                if (empty($ascension['claimedEras'][$idx]) && (int) $player['level'] >= (int) $eraDef['breakthroughLevel']) {
                    $requestedIndex = $idx;
                    break;
                }
            }
            if ($requestedIndex === 0) {
                $requestedIndex = $this->resolveCurrentEraIndex((int) $player['level']);
            }
        }

        if (!isset(self::ERAS[$requestedIndex])) {
            throw new InvalidArgumentException("Unknown ascension era index: {$requestedIndex}");
        }

        $era = self::ERAS[$requestedIndex];
        if (!empty($ascension['claimedEras'][$requestedIndex])) {
            throw new RuntimeException("Era {$requestedIndex} ({$era['nameEn']}) breakthrough has already been claimed.");
        }

        $breakthroughLevel = (int) $era['breakthroughLevel'];
        if ((int) $player['level'] < $breakthroughLevel) {
            throw new RuntimeException(
                "Locked: Reach Level {$breakthroughLevel} (100% Era progress) to claim {$era['titleEn']} breakthrough (Current: Lv {$player['level']})."
            );
        }

        $cashReward = (int) $era['cashReward'];
        $spReward = (int) $era['spReward'];
        $meritsReward = (int) $era['meritsReward'];

        $newCash = (int) $player['cash'] + $cashReward;
        $this->database->execute(
            'UPDATE players SET cash = :cash WHERE id = :id',
            ['cash' => $newCash, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'ascension.era.claim.' . $requestedIndex, $correlationId);

        $state['rpg'] = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
        $state['rpg']['bonusSp'] = (int) ($state['rpg']['bonusSp'] ?? 0) + $spReward;
        $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + $meritsReward;
        $this->ledger->record($playerId, 'merits', $meritsReward, (int) $state['merits'], 'ascension.era.merits.' . $requestedIndex, $correlationId);

        $titleGrant = [
            'eraIndex' => $requestedIndex,
            'id' => $era['id'],
            'en' => $era['rewardTitleEn'],
            'ar' => $era['rewardTitleAr'],
            'claimedAt' => $nowSec,
        ];

        $ascension['claimedEras'][$requestedIndex] = $nowSec;
        $ascension['eraTitles'][$requestedIndex] = $titleGrant;
        $ascension['activeTitle'] = $titleGrant;
        $ascension['spEarned'] = (int) ($ascension['spEarned'] ?? 0) + $spReward;
        $ascension['meritsEarned'] = (int) ($ascension['meritsEarned'] ?? 0) + $meritsReward;

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $this->events->publish(new DomainEvent('AscensionEraBreakthroughClaimed', [
            'playerId' => $playerId,
            'eraIndex' => $requestedIndex,
            'eraId' => $era['id'],
            'cashAwarded' => $cashReward,
            'spAwarded' => $spReward,
            'meritsAwarded' => $meritsReward,
            'titleEn' => $era['rewardTitleEn'],
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'era.claimBreakthrough',
            'eraIndex' => $requestedIndex,
            'eraId' => $era['id'],
            'cashAwarded' => $cashReward,
            'spAwarded' => $spReward,
            'meritsAwarded' => $meritsReward,
            'titleAwarded' => $titleGrant,
        ];
    }

    private function handleNemesisGatherIntel(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        int $nowSec,
        int $nowMs,
        string $correlationId,
    ): array {
        $this->assertOperativeFree($state, $nowMs);

        $nemesis = $ascension['nemesis'];
        $currentIntel = (int) ($nemesis['intel'] ?? 0);
        if ($currentIntel >= 100) {
            throw new RuntimeException("Nemesis safehouse is already at 100% Intel — confront {$nemesis['nameEn']} now!");
        }
        if ((int) $player['energy'] < self::NEMESIS_INTEL_ENERGY_COST) {
            throw new RuntimeException('Need ' . self::NEMESIS_INTEL_ENERGY_COST . ' Energy to sweep the streets for Nemesis intel.');
        }

        $tier = max(1, min(10, (int) ($nemesis['tier'] ?? 1)));
        $intelGain = $this->roll(25, 35);
        $newIntel = min(100, $currentIntel + $intelGain);
        $cashClue = $this->roll(350, 650) + ($tier * 120);
        $xpGain = 15 + ($tier * 3);

        $newEnergy = (int) $player['energy'] - self::NEMESIS_INTEL_ENERGY_COST;
        $newCash = (int) $player['cash'] + $cashClue;
        $newXp = (int) $player['xp'] + $xpGain;

        $this->database->execute(
            'UPDATE players SET energy = :energy, cash = :cash, xp = :xp WHERE id = :id',
            [
                'energy' => $newEnergy,
                'cash' => $newCash,
                'xp' => $newXp,
                'id' => $playerId,
            ],
        );
        $this->ledger->record($playerId, 'cash', $cashClue, $newCash, 'ascension.nemesis.intel', $correlationId);

        $nemesis['intel'] = $newIntel;
        $ascension['nemesis'] = $nemesis;
        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $levelUp = $this->leveling->sync($playerId, $correlationId);

        $this->events->publish(new DomainEvent('NemesisIntelGathered', [
            'playerId' => $playerId,
            'nemesisId' => $nemesis['id'],
            'intelGain' => $intelGain,
            'intelAfter' => $newIntel,
            'cashAwarded' => $cashClue,
            'xpAwarded' => $xpGain,
            'energySpent' => self::NEMESIS_INTEL_ENERGY_COST,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'nemesis.gatherIntel',
            'energySpent' => self::NEMESIS_INTEL_ENERGY_COST,
            'intelGained' => $intelGain,
            'intel' => $newIntel,
            'safehouseExposed' => $newIntel >= 100,
            'cashAwarded' => $cashClue,
            'xpAwarded' => $xpGain,
            'levelUp' => $levelUp,
            'messageEn' => $newIntel >= 100
                ? "Safehouse exposed! {$nemesis['nameEn']} is cornered in {$nemesis['districtEn']}."
                : "Tracked dead-drops in {$nemesis['districtEn']} (+{$intelGain}% Intel, +$" . number_format($cashClue) . ").",
            'messageAr' => $newIntel >= 100
                ? "تم كشف المخبأ! {$nemesis['nameAr']} محاصر الآن في {$nemesis['districtAr']}."
                : "تمت مصادرة شيفرات في {$nemesis['districtAr']} (+{$intelGain}% معلومات، +" . number_format($cashClue) . "$).",
        ];
    }

    private function handleNemesisConfront(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        int $nowSec,
        int $nowMs,
        string $correlationId,
    ): array {
        $this->assertOperativeFree($state, $nowMs);

        $nemesis = $ascension['nemesis'];
        $currentIntel = (int) ($nemesis['intel'] ?? 0);
        if ($currentIntel < 100) {
            throw new RuntimeException("Gather 100% Nemesis Intel before confronting {$nemesis['nameEn']} (Current: {$currentIntel}%).");
        }
        if ((int) $player['energy'] < self::NEMESIS_CONFRONT_ENERGY_COST) {
            throw new RuntimeException('Need ' . self::NEMESIS_CONFRONT_ENERGY_COST . ' Energy to launch a Nemesis showdown.');
        }

        $newEnergy = (int) $player['energy'] - self::NEMESIS_CONFRONT_ENERGY_COST;
        $this->database->execute(
            'UPDATE players SET energy = :energy WHERE id = :id',
            ['energy' => $newEnergy, 'id' => $playerId],
        );

        $oldTier = max(1, min(10, (int) ($nemesis['tier'] ?? 1)));
        $combat = $this->resolveNemesisCombat($player, $state, $ascension, $nemesis);
        $nemesis['lastCombatLog'] = $combat;
        $nemesis['grudgeCount'] = (int) ($nemesis['grudgeCount'] ?? 0) + 1;

        if ($combat['victory']) {
            $bountyCash = 8000 * $oldTier;
            $xpReward = 85 + ($oldTier * 45);
            $meritReward = 1;
            $trophyItemId = $this->nemesisTrophyForTier($oldTier);
            $remainingLife = max(1, (int) $combat['playerHpRemaining']);

            $newCash = (int) $player['cash'] + $bountyCash;
            $newXp = (int) $player['xp'] + $xpReward;

            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, life = :life WHERE id = :id',
                [
                    'cash' => $newCash,
                    'xp' => $newXp,
                    'life' => $remainingLife,
                    'id' => $playerId,
                ],
            );
            $this->ledger->record($playerId, 'cash', $bountyCash, $newCash, 'ascension.nemesis.bounty', $correlationId);

            $state['inv'] = is_array($state['inv'] ?? null) ? $state['inv'] : [];
            $state['inv'][$trophyItemId] = max(0, (int) ($state['inv'][$trophyItemId] ?? 0)) + 1;
            $this->ledger->record(
                $playerId,
                'item:' . $trophyItemId,
                1,
                (int) $state['inv'][$trophyItemId],
                'ascension.nemesis.trophy',
                $correlationId,
            );

            $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + $meritReward;
            $this->ledger->record($playerId, 'merits', $meritReward, (int) $state['merits'], 'ascension.nemesis.merit', $correlationId);

            $state['ctr'] = is_array($state['ctr'] ?? null) ? $state['ctr'] : [];
            $state['ctr']['wins'] = (int) ($state['ctr']['wins'] ?? 0) + 1;

            $newTier = min(10, $oldTier + 1);
            $winsAgainst = (int) ($nemesis['winsAgainst'] ?? 0) + 1;
            $scar = self::NEMESIS_SCARS[($winsAgainst - 1) % count(self::NEMESIS_SCARS)];
            $titlePair = self::NEMESIS_TITLES_BY_TIER[$newTier] ?? self::NEMESIS_TITLES_BY_TIER[10];

            $nemesis['winsAgainst'] = $winsAgainst;
            $nemesis['tier'] = $newTier;
            $nemesis['titleEn'] = $titlePair['en'];
            $nemesis['titleAr'] = $titlePair['ar'];
            $nemesis['scarEn'] = $scar['en'];
            $nemesis['scarAr'] = $scar['ar'];
            $nemesis['intel'] = 0;
            $nemesis['baseHeatTaxPct'] = min(10, 2 + ($newTier - 1));
            $nemesis['heatClearedUntil'] = $nowSec + self::NEMESIS_HEAT_CLEAR_SECONDS;
            $nemesis['heatTaxPct'] = 0;
            $nemesis['lastMemoryEn'] = "You left me bleeding at {$nemesis['districtEn']} — next time I bring hollow-points!";
            $nemesis['lastMemoryAr'] = "تركتني أنزف عند {$nemesis['districtAr']} — في المرة القادمة سأحضر رصاصاً متفجراً!";

            $ascension['meritsEarned'] = (int) ($ascension['meritsEarned'] ?? 0) + $meritReward;
            $ascension['nemesis'] = $nemesis;
            $state['ascension'] = $ascension;
            $this->saveProgression($playerId, $state, $version);

            $levelUp = $this->leveling->sync($playerId, $correlationId);

            $this->events->publish(new DomainEvent('NemesisDefeated', [
                'playerId' => $playerId,
                'nemesisId' => $nemesis['id'],
                'defeatedTier' => $oldTier,
                'promotedTier' => $newTier,
                'bountyCash' => $bountyCash,
                'xpAwarded' => $xpReward,
                'meritsAwarded' => $meritReward,
                'trophyItemId' => $trophyItemId,
                'heatClearedSeconds' => self::NEMESIS_HEAT_CLEAR_SECONDS,
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'nemesis.confront',
                'victory' => true,
                'energySpent' => self::NEMESIS_CONFRONT_ENERGY_COST,
                'defeatedTier' => $oldTier,
                'newTier' => $newTier,
                'cashAwarded' => $bountyCash,
                'bountyCash' => $bountyCash,
                'xpAwarded' => $xpReward,
                'meritsAwarded' => $meritReward,
                'trophyItemId' => $trophyItemId,
                'heatClearedSeconds' => self::NEMESIS_HEAT_CLEAR_SECONDS,
                'hospitalSeconds' => 0,
                'scarEn' => $nemesis['scarEn'],
                'scarAr' => $nemesis['scarAr'],
                'grudgeLineEn' => $nemesis['lastMemoryEn'],
                'grudgeLineAr' => $nemesis['lastMemoryAr'],
                'levelUp' => $levelUp,
                ...$combat,
            ];
        }

        $hospMs = self::NEMESIS_DEFEAT_HOSPITAL_SECONDS * 1000;
        $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + $hospMs);
        $this->database->execute(
            'UPDATE players SET life = 1 WHERE id = :id',
            ['id' => $playerId],
        );

        $nemesis['lossesAgainst'] = (int) ($nemesis['lossesAgainst'] ?? 0) + 1;
        $nemesis['intel'] = 60;
        $nemesis['baseHeatTaxPct'] = min(10, max((int) ($nemesis['baseHeatTaxPct'] ?? 2), 2 + $oldTier));
        if ((int) ($nemesis['heatClearedUntil'] ?? 0) <= $nowSec) {
            $nemesis['heatTaxPct'] = $nemesis['baseHeatTaxPct'];
        }
        $nemesis['lastMemoryEn'] = "You kissed the wet asphalt in {$nemesis['districtEn']} on Round {$combat['roundsCount']}. Hit the Gym before stepping to my crew again!";
        $nemesis['lastMemoryAr'] = "سقطت على إسفلت {$nemesis['districtAr']} في الجولة {$combat['roundsCount']}. ارفع قوتك في النادي قبل أن تتحداني مجدداً!";

        $ascension['nemesis'] = $nemesis;
        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $this->events->publish(new DomainEvent('NemesisShowdownLost', [
            'playerId' => $playerId,
            'nemesisId' => $nemesis['id'],
            'tier' => $oldTier,
            'hospitalSeconds' => self::NEMESIS_DEFEAT_HOSPITAL_SECONDS,
            'intelRetained' => 60,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'nemesis.confront',
            'victory' => false,
            'energySpent' => self::NEMESIS_CONFRONT_ENERGY_COST,
            'defeatedTier' => $oldTier,
            'newTier' => $oldTier,
            'cashAwarded' => 0,
            'bountyCash' => 0,
            'xpAwarded' => 0,
            'meritsAwarded' => 0,
            'trophyItemId' => null,
            'heatClearedSeconds' => 0,
            'hospitalSeconds' => self::NEMESIS_DEFEAT_HOSPITAL_SECONDS,
            'intelAfter' => 60,
            'grudgeLineEn' => $nemesis['lastMemoryEn'],
            'grudgeLineAr' => $nemesis['lastMemoryAr'],
            ...$combat,
        ];
    }

    private function handleCrewRecruit(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        array $payload,
        int $nowSec,
        string $correlationId,
    ): array {
        $slotId = strtolower(trim((string) ($payload['slotId'] ?? $payload['roleId'] ?? $payload['crewId'] ?? $payload['id'] ?? '')));
        if (!isset(self::CREW_SLOTS[$slotId])) {
            throw new InvalidArgumentException("Unknown street crew specialist: {$slotId}");
        }

        $slotDef = self::CREW_SLOTS[$slotId];
        $unlockLevel = (int) $slotDef['unlockLevel'];
        if ((int) $player['level'] < $unlockLevel) {
            throw new RuntimeException("Locked: Reach Level {$unlockLevel} to recruit {$slotDef['nameEn']} (Current: Lv {$player['level']}).");
        }

        $currentRank = (int) ($ascension['crew'][$slotId] ?? 0);
        if ($currentRank >= 1) {
            throw new RuntimeException("{$slotDef['nameEn']} is already recruited (Rank {$currentRank}). Use crew.upgrade instead.");
        }

        $cost = (int) $slotDef['costsByRank'][1];
        if ((int) $player['cash'] < $cost) {
            throw new RuntimeException("Need $" . number_format($cost) . " cash to recruit {$slotDef['nameEn']}.");
        }

        $this->bankAccruedCrewTribute($ascension, $nowSec);

        $newCash = (int) $player['cash'] - $cost;
        $this->database->execute(
            'UPDATE players SET cash = :cash WHERE id = :id',
            ['cash' => $newCash, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'ascension.crew.recruit.' . $slotId, $correlationId);

        $ascension['crew'][$slotId] = 1;
        $signingBonus = (int) $slotDef['hourlyRateBase'];
        $ascension['crewTribute']['signingBonusPending'] = (int) ($ascension['crewTribute']['signingBonusPending'] ?? 0) + $signingBonus;
        $ascension['crewTribute']['lastCollectedAt'] = $nowSec;

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $this->events->publish(new DomainEvent('StreetCrewRecruited', [
            'playerId' => $playerId,
            'slotId' => $slotId,
            'rank' => 1,
            'costCash' => $cost,
            'hourlyRateAdded' => $signingBonus,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'crew.recruit',
            'slotId' => $slotId,
            'nameEn' => $slotDef['nameEn'],
            'nameAr' => $slotDef['nameAr'],
            'rank' => 1,
            'costPaid' => $cost,
            'signingBonusQueued' => $signingBonus,
            'hourlyRate' => $signingBonus,
        ];
    }

    private function handleCrewUpgrade(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        array $payload,
        int $nowSec,
        string $correlationId,
    ): array {
        $slotId = strtolower(trim((string) ($payload['slotId'] ?? $payload['roleId'] ?? $payload['crewId'] ?? $payload['id'] ?? '')));
        if (!isset(self::CREW_SLOTS[$slotId])) {
            throw new InvalidArgumentException("Unknown street crew specialist: {$slotId}");
        }

        $slotDef = self::CREW_SLOTS[$slotId];
        $currentRank = (int) ($ascension['crew'][$slotId] ?? 0);
        if ($currentRank < 1) {
            throw new RuntimeException("Recruit {$slotDef['nameEn']} first before upgrading.");
        }
        if ($currentRank >= self::CREW_MAX_RANK) {
            throw new RuntimeException("{$slotDef['nameEn']} has already reached maximum Rank " . self::CREW_MAX_RANK . '.');
        }

        $nextRank = $currentRank + 1;
        $cost = (int) $slotDef['costsByRank'][$nextRank];
        if ((int) $player['cash'] < $cost) {
            throw new RuntimeException("Need $" . number_format($cost) . " cash to upgrade {$slotDef['nameEn']} to Rank {$nextRank}.");
        }

        $this->bankAccruedCrewTribute($ascension, $nowSec);

        $newCash = (int) $player['cash'] - $cost;
        $this->database->execute(
            'UPDATE players SET cash = :cash WHERE id = :id',
            ['cash' => $newCash, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'ascension.crew.upgrade.' . $slotId, $correlationId);

        $ascension['crew'][$slotId] = $nextRank;
        $ascension['crewTribute']['lastCollectedAt'] = $nowSec;

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $newHourly = (int) $slotDef['hourlyRateBase'] * $nextRank;

        $this->events->publish(new DomainEvent('StreetCrewUpgraded', [
            'playerId' => $playerId,
            'slotId' => $slotId,
            'fromRank' => $currentRank,
            'toRank' => $nextRank,
            'costCash' => $cost,
            'hourlyRate' => $newHourly,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'crew.upgrade',
            'slotId' => $slotId,
            'nameEn' => $slotDef['nameEn'],
            'nameAr' => $slotDef['nameAr'],
            'fromRank' => $currentRank,
            'rank' => $nextRank,
            'costPaid' => $cost,
            'hourlyRate' => $newHourly,
        ];
    }

    private function handleCrewCollectTribute(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        int $nowSec,
        string $correlationId,
    ): array {
        $tributeCalc = $this->calculateCrewTributeState($ascension, $nowSec);
        if ($tributeCalc['totalHourlyRate'] <= 0) {
            throw new RuntimeException('Recruit at least one Street Crew specialist before collecting turf tribute.');
        }
        if (!$tributeCalc['canCollectTribute'] || $tributeCalc['pendingTribute'] <= 0) {
            $waitSec = max(1, self::CREW_TRIBUTE_MIN_SECONDS - $tributeCalc['elapsedSeconds']);
            throw new RuntimeException("Crew turf tribute requires at least 5 minutes of street collection ({$waitSec}s remaining).");
        }

        $payout = (int) $tributeCalc['pendingTribute'];
        $newCash = (int) $player['cash'] + $payout;

        $this->database->execute(
            'UPDATE players SET cash = :cash WHERE id = :id',
            ['cash' => $newCash, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', $payout, $newCash, 'ascension.crew.tribute', $correlationId);

        $ascension['crewTribute']['lastCollectedAt'] = $nowSec;
        $ascension['crewTribute']['bankedTribute'] = 0;
        $ascension['crewTribute']['signingBonusPending'] = 0;
        $ascension['crewTribute']['totalCollected'] = (int) ($ascension['crewTribute']['totalCollected'] ?? 0) + $payout;

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $this->events->publish(new DomainEvent('StreetCrewTributeCollected', [
            'playerId' => $playerId,
            'cashCollected' => $payout,
            'elapsedSeconds' => $tributeCalc['elapsedSeconds'],
            'cappedSeconds' => $tributeCalc['cappedSeconds'],
            'totalHourlyRate' => $tributeCalc['totalHourlyRate'],
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'crew.collectTribute',
            'cashAwarded' => $payout,
            'tributeCollected' => $payout,
            'elapsedSeconds' => $tributeCalc['elapsedSeconds'],
            'cappedSeconds' => $tributeCalc['cappedSeconds'],
            'hourlyRate' => $tributeCalc['totalHourlyRate'],
        ];
    }

    private function handleClaimDirective(
        string $playerId,
        array $player,
        array &$state,
        array &$ascension,
        int &$version,
        array $payload,
        int $nowSec,
        string $correlationId,
    ): array {
        $activeIdx = $this->resolveActiveDirectiveIndex($ascension);
        $requestedIdx = isset($payload['directiveIndex']) || isset($payload['index'])
            ? (int) ($payload['directiveIndex'] ?? $payload['index'])
            : $activeIdx;

        if (!isset(self::DIRECTIVES[$requestedIdx])) {
            throw new InvalidArgumentException("Unknown Luna directive index: {$requestedIdx}");
        }
        if (!empty($ascension['claimedDirectives'][$requestedIdx])) {
            throw new RuntimeException("Directive #{$requestedIdx} has already been claimed.");
        }
        if ($requestedIdx !== $activeIdx) {
            throw new RuntimeException("Complete and claim Directive #{$activeIdx} before Directive #{$requestedIdx}.");
        }

        $directiveDef = self::DIRECTIVES[$requestedIdx];
        $eval = $this->evaluateDirective($requestedIdx, $player, $state, $ascension);
        if (!$eval['completed']) {
            throw new RuntimeException("Directive #{$requestedIdx} ({$directiveDef['titleEn']}) is not yet complete: {$eval['progressLabelEn']}.");
        }

        $xpReward = (int) $directiveDef['rewards']['xp'];
        $cashReward = (int) $directiveDef['rewards']['cash'];
        $spReward = (int) $directiveDef['rewards']['sp'];
        $meritsReward = (int) $directiveDef['rewards']['merits'];

        $newCash = (int) $player['cash'] + $cashReward;
        $newXp = (int) $player['xp'] + $xpReward;

        $this->database->execute(
            'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
            [
                'cash' => $newCash,
                'xp' => $newXp,
                'id' => $playerId,
            ],
        );
        if ($cashReward > 0) {
            $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'ascension.luna.directive.' . $requestedIdx, $correlationId);
        }

        if ($spReward > 0) {
            $state['rpg'] = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
            $state['rpg']['bonusSp'] = (int) ($state['rpg']['bonusSp'] ?? 0) + $spReward;
            $ascension['spEarned'] = (int) ($ascension['spEarned'] ?? 0) + $spReward;
        }
        if ($meritsReward > 0) {
            $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + $meritsReward;
            $ascension['meritsEarned'] = (int) ($ascension['meritsEarned'] ?? 0) + $meritsReward;
            $this->ledger->record($playerId, 'merits', $meritsReward, (int) $state['merits'], 'ascension.luna.merits.' . $requestedIdx, $correlationId);
        }

        $ascension['claimedDirectives'][$requestedIdx] = $nowSec;
        $nextIdx = $this->resolveActiveDirectiveIndex($ascension);
        $ascension['directiveIndex'] = $nextIdx;

        $state['ascension'] = $ascension;
        $this->saveProgression($playerId, $state, $version);

        $levelUp = $this->leveling->sync($playerId, $correlationId);

        $this->events->publish(new DomainEvent('LunaDirectiveClaimed', [
            'playerId' => $playerId,
            'directiveIndex' => $requestedIdx,
            'directiveId' => $directiveDef['id'],
            'xpAwarded' => $xpReward,
            'cashAwarded' => $cashReward,
            'spAwarded' => $spReward,
            'meritsAwarded' => $meritsReward,
            'nextDirectiveIndex' => $nextIdx,
            'correlationId' => $correlationId,
        ]));

        return [
            'action' => 'luna.claimDirective',
            'directiveIndex' => $requestedIdx,
            'directiveId' => $directiveDef['id'],
            'xpAwarded' => $xpReward,
            'cashAwarded' => $cashReward,
            'spAwarded' => $spReward,
            'meritsAwarded' => $meritsReward,
            'nextDirectiveIndex' => $nextIdx,
            'allDirectivesCompleted' => count($ascension['claimedDirectives']) >= count(self::DIRECTIVES),
            'levelUp' => $levelUp,
        ];
    }

    private function buildView(array $player, array $state, int $nowSec): array
    {
        $playerId = (string) $player['id'];
        $ascension = $this->normalizeAscensionState($playerId, $state, $nowSec);
        $level = max(1, (int) $player['level']);
        $xp = max(0, (int) $player['xp']);
        $nowMs = $nowSec * 1000;

        // 1. Origins
        $originChosen = !empty($ascension['originChosen']);
        $selectedOriginId = $originChosen && is_string($ascension['origin'] ?? null) ? $ascension['origin'] : null;
        $originsList = [];
        $activeOrigin = null;
        foreach (self::ORIGINS as $oid => $odef) {
            $isSelected = $selectedOriginId === $oid;
            $entry = [
                ...$odef,
                'name' => ['en' => $odef['nameEn'], 'ar' => $odef['nameAr']],
                'tagline' => ['en' => $odef['taglineEn'], 'ar' => $odef['taglineAr']],
                'perksSummary' => ['en' => $odef['perksSummaryEn'], 'ar' => $odef['perksSummaryAr']],
                'selected' => $isSelected,
                'canSelect' => !$originChosen,
            ];
            if ($isSelected) {
                $activeOrigin = $entry;
            }
            $originsList[] = $entry;
        }

        // 2. 6-Era Ascension Spine
        $currentEraIndex = $this->resolveCurrentEraIndex($level);
        $erasList = [];
        $claimableEra = null;
        foreach (self::ERAS as $idx => $eraDef) {
            $eraFloorXp = $this->leveling->totalXpForLevel((int) $eraDef['minLevel']);
            $eraCeilXp = $this->leveling->totalXpForLevel((int) $eraDef['breakthroughLevel']);
            if ($level >= (int) $eraDef['breakthroughLevel']) {
                $eraPct = 100;
            } elseif ($level < (int) $eraDef['minLevel']) {
                $eraPct = 0;
            } else {
                $span = max(1, $eraCeilXp - $eraFloorXp);
                $eraPct = (int) min(99, max(0, round((($xp - $eraFloorXp) / $span) * 100)));
            }

            $claimed = !empty($ascension['claimedEras'][$idx]);
            $completed = $eraPct >= 100;
            $claimable = $completed && !$claimed;

            $eraView = [
                ...$eraDef,
                'name' => ['en' => $eraDef['nameEn'], 'ar' => $eraDef['nameAr']],
                'title' => ['en' => $eraDef['titleEn'], 'ar' => $eraDef['titleAr']],
                'safehouse' => ['en' => $eraDef['safehouseEn'], 'ar' => $eraDef['safehouseAr']],
                'unlocked' => $level >= (int) $eraDef['minLevel'],
                'current' => $idx === $currentEraIndex,
                'progressPct' => $eraPct,
                'completed' => $completed,
                'claimed' => $claimed,
                'claimable' => $claimable,
                'rewards' => [
                    'cash' => $eraDef['cashReward'],
                    'sp' => $eraDef['spReward'],
                    'merits' => $eraDef['meritsReward'],
                    'titleEn' => $eraDef['rewardTitleEn'],
                    'titleAr' => $eraDef['rewardTitleAr'],
                ],
            ];
            if ($claimable && $claimableEra === null) {
                $claimableEra = $eraView;
            }
            $erasList[] = $eraView;
        }
        $currentEraView = $erasList[$currentEraIndex - 1];

        // 3. Next Level Gate Unlock
        $nextUnlock = $this->computeNextUnlock($level, $xp);
        $unlockGatesView = array_map(function (array $g) use ($level): array {
            return [
                ...$g,
                'xpRequired' => $this->leveling->totalXpForLevel((int) $g['level']),
                'unlocked' => $level >= (int) $g['level'],
                'levelsRemaining' => max(0, (int) $g['level'] - $level),
            ];
        }, self::LEVEL_GATES);

        // 4. Nemesis Rival
        $nemesis = $ascension['nemesis'];
        $nemesisTier = max(1, min(10, (int) $nemesis['tier']));
        $heatClearedRem = max(0, (int) ($nemesis['heatClearedUntil'] ?? 0) - $nowSec);
        $isBlocked = ((int) ($state['hospUntil'] ?? 0) > $nowMs) || ((int) ($state['jailUntil'] ?? 0) > $nowMs);
        $nemesisStats = $this->nemesisCombatStats($nemesisTier);

        $nemesisView = [
            ...$nemesis,
            'name' => ['en' => $nemesis['nameEn'], 'ar' => $nemesis['nameAr']],
            'title' => ['en' => $nemesis['titleEn'], 'ar' => $nemesis['titleAr']],
            'scar' => ['en' => $nemesis['scarEn'], 'ar' => $nemesis['scarAr']],
            'lastMemory' => ['en' => $nemesis['lastMemoryEn'], 'ar' => $nemesis['lastMemoryAr']],
            'intelMax' => 100,
            'gatherIntelEnergyCost' => self::NEMESIS_INTEL_ENERGY_COST,
            'confrontEnergyCost' => self::NEMESIS_CONFRONT_ENERGY_COST,
            'canGatherIntel' => !$isBlocked && (int) $nemesis['intel'] < 100 && (int) $player['energy'] >= self::NEMESIS_INTEL_ENERGY_COST,
            'canConfront' => !$isBlocked && (int) $nemesis['intel'] >= 100 && (int) $player['energy'] >= self::NEMESIS_CONFRONT_ENERGY_COST,
            'heatCleared' => $heatClearedRem > 0,
            'heatClearedRemainingSeconds' => $heatClearedRem,
            'nextBountyCash' => 8000 * $nemesisTier,
            'nextXpReward' => 85 + ($nemesisTier * 45),
            'nextTrophyItemId' => $this->nemesisTrophyForTier($nemesisTier),
            'combatStats' => $nemesisStats,
        ];

        // 5. 5-Slot Street Crew
        $tributeCalc = $this->calculateCrewTributeState($ascension, $nowSec);
        $crewSlotsList = [];
        $crewById = [];
        $recruitedCount = 0;
        foreach (self::CREW_SLOTS as $slotId => $slotDef) {
            $rank = (int) ($ascension['crew'][$slotId] ?? 0);
            if ($rank > 0) {
                $recruitedCount++;
            }
            $unlocked = $level >= (int) $slotDef['unlockLevel'];
            $nextRank = $rank < self::CREW_MAX_RANK ? $rank + 1 : null;
            $nextCost = $nextRank !== null ? (int) $slotDef['costsByRank'][$nextRank] : null;
            $hourlyRate = $rank > 0 ? ((int) $slotDef['hourlyRateBase'] * $rank) : 0;

            $slotEntry = [
                'id' => $slotId,
                'slotId' => $slotId,
                'nameEn' => $slotDef['nameEn'],
                'nameAr' => $slotDef['nameAr'],
                'name' => ['en' => $slotDef['nameEn'], 'ar' => $slotDef['nameAr']],
                'unlockLevel' => $slotDef['unlockLevel'],
                'unlocked' => $unlocked,
                'recruited' => $rank > 0,
                'rank' => $rank,
                'maxRank' => self::CREW_MAX_RANK,
                'perkEn' => $slotDef['perkEn'],
                'perkAr' => $slotDef['perkAr'],
                'baseHourlyRate' => $slotDef['hourlyRateBase'],
                'hourlyRate' => $hourlyRate,
                'recruitCost' => (int) $slotDef['costsByRank'][1],
                'upgradeCost' => ($rank > 0 && $nextCost !== null) ? $nextCost : null,
                'nextCost' => $nextCost,
                'canRecruit' => $unlocked && $rank === 0 && (int) $player['cash'] >= (int) $slotDef['costsByRank'][1],
                'canUpgrade' => $unlocked && $rank > 0 && $rank < self::CREW_MAX_RANK && $nextCost !== null && (int) $player['cash'] >= $nextCost,
            ];
            $crewSlotsList[] = $slotEntry;
            $crewById[$slotId] = $slotEntry;
        }

        $crewView = [
            'slots' => $crewSlotsList,
            'byId' => $crewById,
            'ranks' => $ascension['crew'],
            'recruitedCount' => $recruitedCount,
            'maxSlots' => count(self::CREW_SLOTS),
            ...$tributeCalc,
        ];

        // 6. Luna · Syndicate Architect & 12 Guided Directives
        $activeDirectiveIndex = $this->resolveActiveDirectiveIndex($ascension);
        $directivesView = [];
        $activeDirectiveView = null;
        foreach (self::DIRECTIVES as $idx => $dirDef) {
            $claimed = !empty($ascension['claimedDirectives'][$idx]);
            $eval = $claimed
                ? ['completed' => true, 'current' => 1, 'target' => 1, 'progressPct' => 100, 'progressLabelEn' => 'Claimed', 'progressLabelAr' => 'تم الاستلام']
                : $this->evaluateDirective($idx, $player, $state, $ascension);
            $isActive = !$claimed && $idx === $activeDirectiveIndex;

            $dirEntry = [
                ...$dirDef,
                'directiveIndex' => $idx,
                'title' => ['en' => $dirDef['titleEn'], 'ar' => $dirDef['titleAr']],
                'description' => ['en' => $dirDef['descEn'], 'ar' => $dirDef['descAr']],
                'active' => $isActive,
                'completed' => $eval['completed'],
                'claimed' => $claimed,
                'claimable' => $isActive && $eval['completed'] && !$claimed,
                'current' => $eval['current'],
                'target' => $eval['target'],
                'progressPct' => $eval['progressPct'],
                'progressLabelEn' => $eval['progressLabelEn'],
                'progressLabelAr' => $eval['progressLabelAr'],
            ];
            if ($idx === $activeDirectiveIndex) {
                $activeDirectiveView = $dirEntry;
            }
            $directivesView[] = $dirEntry;
        }
        if ($activeDirectiveView === null) {
            $activeDirectiveView = $directivesView[count($directivesView) - 1];
        }

        $lunaOracle = $this->buildLunaOracle(
            $player,
            $state,
            $ascension,
            $nextUnlock,
            $nemesisView,
            $activeDirectiveView,
            $directivesView,
            $nowMs,
        );

        $netWorth = (int) $player['cash']
            + (int) $player['bank_balance']
            + (int) ($state['vaultBalance'] ?? 0)
            + (int) ($state['activeCd']['principal'] ?? 0);

        return [
            'player' => [
                'id' => $player['id'],
                'username' => $player['username'],
                'level' => $player['level'],
                'xp' => $player['xp'],
                'cash' => $player['cash'],
                'bank_balance' => $player['bank_balance'],
                'net_worth' => $netWorth,
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
                'city' => $player['city'],
            ],
            'originChosen' => $originChosen,
            'origin' => $selectedOriginId,
            'originId' => $selectedOriginId,
            'activeOrigin' => $activeOrigin,
            'origins' => $originsList,
            'eraIndex' => $currentEraIndex,
            'eraProgressPct' => $currentEraView['progressPct'],
            'currentEra' => $currentEraView,
            'claimableEra' => $claimableEra,
            'safehouseStage' => [
                'eraIndex' => $currentEraIndex,
                'en' => $currentEraView['safehouseEn'],
                'ar' => $currentEraView['safehouseAr'],
            ],
            'eras' => $erasList,
            'activeTitle' => $ascension['activeTitle'],
            'eraTitles' => array_values($ascension['eraTitles']),
            'nextUnlock' => $nextUnlock,
            'unlockGates' => $unlockGatesView,
            'nemesis' => $nemesisView,
            'crew' => $crewView,
            'lunaOracle' => $lunaOracle,
            'directiveIndex' => $activeDirectiveView['directiveIndex'],
            'activeDirective' => $activeDirectiveView,
            'directives' => $directivesView,
            'passiveBonuses' => self::computePassiveBonuses($state, $nowSec),
            'ascension' => $ascension,
            'serverTime' => gmdate('c', $nowSec),
        ];
    }

    private function buildLunaOracle(
        array $player,
        array $state,
        array $ascension,
        array $nextUnlock,
        array $nemesisView,
        array $activeDirectiveView,
        array $directivesView,
        int $nowMs,
    ): array {
        $originChosen = !empty($ascension['originChosen']);
        $hospUntil = (int) ($state['hospUntil'] ?? 0);
        $jailUntil = (int) ($state['jailUntil'] ?? 0);
        $energy = (int) $player['energy'];
        $maxEnergy = max(1, (int) $player['max_energy']);
        $intel = (int) $nemesisView['intel'];

        $routeLabelsEn = [
            'home' => 'Command Dossier (Home)',
            'crimes' => 'Street Crimes',
            'gym' => 'Combat Gym',
            'city' => 'City District',
            'market' => 'Market & Bazaars',
            'bank' => 'Syndicate Bank',
            'faction' => 'Faction HQ',
            'casino' => 'Casino Floor',
        ];
        $routeLabelsAr = [
            'home' => 'ملف القيادة (الرئيسية)',
            'crimes' => 'قسم الجرائم',
            'gym' => 'النادي الرياضي',
            'city' => 'أحياء المدينة',
            'market' => 'السوق والبازارات',
            'bank' => 'البنك والخزائن',
            'faction' => 'مقر العائلة',
            'casino' => 'صالة الكازينو',
        ];

        if (!$originChosen) {
            $mood = 'awakening';
            $transmissionEn = "Rain on Pier 4, operative. I'm Luna — your encrypted Syndicate Architect. Choose your underworld origin below and I'll wire your starter kit and Directive #1 immediately.";
            $transmissionAr = "المطر يغمر الرصيف الرابع أيها العميل. أنا لونا — مهندسة النقابة المشفرة الخاصة بك. اختر أصلك الإجرامي بالأسفل وسأحوّل عتادك الأول والتوجيه رقم #1 فوراً.";
        } elseif ($hospUntil > $nowMs) {
            $remSec = max(1, (int) ceil(($hospUntil - $nowMs) / 1000));
            $mood = 'hospital_triage';
            $transmissionEn = "Easy, breathe — I've got eyes on your trauma bay ({$remSec}s left). Pop a Small First Aid Kit from inventory to hit the street now, or plan your Skill Tree while your stitches set.";
            $transmissionAr = "تمهّل والتقط أنفاسك — أراقب جناح الطوارئ الخاص بك ({$remSec} ثانية متبقية). استخدم حقيبة إسعاف أولي للعودة إلى الشارع فوراً، أو راجع شجرة مهاراتك.";
        } elseif ($jailUntil > $nowMs) {
            $remSec = max(1, (int) ceil(($jailUntil - $nowMs) / 1000));
            $mood = 'jail_extraction';
            $transmissionEn = "Precinct lockup has your prints ({$remSec}s left). Let my wiretappers scrub the docket, then stick to high-mastery street ops.";
            $transmissionAr = "زنازين المخفر تحتجزك حالياً ({$remSec} ثانية متبقية). انتظر ريثما يمسح رجالي سجل التوقيف، ثم ركّز على الجرائم المتقنة.";
        } elseif ($intel >= 100) {
            $mood = 'nemesis_exposed';
            $tax = (int) $nemesisView['baseHeatTaxPct'];
            $transmissionEn = "Signal locked: {$nemesisView['nameEn']}'s safehouse in {$nemesisView['districtEn']} is 100% exposed! Spend 15 Energy to crush them, claim $" . number_format((int) $nemesisView['nextBountyCash']) . ", and wipe their {$tax}% street heat tax.";
            $transmissionAr = "تم تثبيت الإشارة: مخبأ {$nemesisView['nameAr']} في {$nemesisView['districtAr']} مكشوف بنسبة 100%! استثمر 15 طاقة لسحقه وانتزاع المكافأة وإلغاء إتاوته البالغة {$tax}%.";
        } elseif (!empty($activeDirectiveView['claimable'])) {
            $mood = 'directive_ready';
            $idx = (int) $activeDirectiveView['directiveIndex'];
            $transmissionEn = "Clean execution on Directive #{$idx} ({$activeDirectiveView['titleEn']}). Claim your syndicate drop right now so I can upload your next assignment.";
            $transmissionAr = "تنفيذ متقن للتوجيه رقم #{$idx} ({$activeDirectiveView['titleAr']}). استلم مكافأة النقابة الآن لأرفع لك المهمة التالية فوراً.";
        } elseif ((int) $nextUnlock['xpRemaining'] > 0 && ((int) $nextUnlock['progressPct'] >= 65 || (int) $nextUnlock['xpRemaining'] <= 120)) {
            $mood = 'level_imminent';
            $xpLeft = (int) $nextUnlock['xpRemaining'];
            $gateLv = (int) $nextUnlock['level'];
            $transmissionEn = "You're only {$xpLeft} XP away from Level {$gateLv} — that unlocks {$nextUnlock['featureEn']}! Execute a couple more street ops or claim a directive to break through.";
            $transmissionAr = "يفصلك {$xpLeft} نقطة خبرة فقط عن المستوى {$gateLv} لفتح {$nextUnlock['featureAr']}! نفّذ عمليتين إضافيتين أو استلم توجيهاً لكسر الحاجز.";
        } elseif ($energy >= 80) {
            $mood = 'high_energy';
            $transmissionEn = "Energy reserves sitting high at {$energy}/{$maxEnergy}. Never let natural regen cap out — burn Energy in the Gym for permanent battle stats or sweep 5E tracks on {$nemesisView['nameEn']}.";
            $transmissionAr = "طاقتك مرتفعة عند {$energy}/{$maxEnergy}. لا تدع التجدد الطبيعي يضيع — احرق الطاقة في النادي لرفع قوتك القتالية أو تتبّع أثر {$nemesisView['nameAr']}.";
        } else {
            $mood = 'tactical_focus';
            $idx = (int) $activeDirectiveView['directiveIndex'];
            $routeKey = (string) $activeDirectiveView['targetRoute'];
            $rEn = $routeLabelsEn[$routeKey] ?? ucfirst($routeKey);
            $rAr = $routeLabelsAr[$routeKey] ?? $routeKey;
            $transmissionEn = "Encrypted channel live. Active Directive #{$idx}: {$activeDirectiveView['titleEn']} — move to {$rEn} and keep building momentum.";
            $transmissionAr = "القناة المشفرة نشطة. التوجيه الحالي #{$idx}: {$activeDirectiveView['titleAr']} — توجّه إلى {$rAr} وواصل الصعود.";
        }

        $claimedCount = count($ascension['claimedDirectives']);
        $totalCount = count(self::DIRECTIVES);

        return [
            'persona' => 'Luna · Syndicate Architect',
            'personaAr' => 'لونا · مهندسة النقابة المشفرة',
            'channel' => 'ENCRYPTED // PIER-4-OMEGA',
            'mood' => $mood,
            'transmissionEn' => $transmissionEn,
            'transmissionAr' => $transmissionAr,
            'messageEn' => $transmissionEn,
            'messageAr' => $transmissionAr,
            'lineEn' => $transmissionEn,
            'lineAr' => $transmissionAr,
            'directiveIndex' => (int) $activeDirectiveView['directiveIndex'],
            'activeDirective' => $activeDirectiveView,
            'directivesCompletedCount' => $claimedCount,
            'directivesTotalCount' => $totalCount,
            'allDirectivesCompleted' => $claimedCount >= $totalCount,
            'directives' => $directivesView,
        ];
    }

    /**
     * Evaluates real DB & progression state for each of the 12 Guided Directives.
     *
     * @return array{completed: bool, current: int, target: int, progressPct: int, progressLabelEn: string, progressLabelAr: string}
     */
    private function evaluateDirective(int $index, array $player, array $state, array $ascension): array
    {
        $playerId = (string) $player['id'];
        $level = (int) $player['level'];
        $ctr = is_array($state['ctr'] ?? null) ? $state['ctr'] : [];

        switch ($index) {
            case 1: // Choose Origin
                $done = !empty($ascension['originChosen']);
                return $this->directiveStatus($done ? 1 : 0, 1, $done ? 'Origin chosen' : 'Select an origin on Home', $done ? 'تم اختيار الأصل' : 'اختر أصلك في الرئيسية');

            case 2: // First Crime
                $crimes = (int) ($ctr['crimes'] ?? 0);
                $hasCrime2 = !empty($state['tornState']['lastCrime2']);
                $cur = ($crimes >= 1 || $hasCrime2) ? max(1, $crimes) : 0;
                return $this->directiveStatus($cur, 1, "{$cur}/1 Crime executed", "{$cur}/1 جريمة منفذة");

            case 3: // First Gym Session
                $trains = (int) ($ctr['trains'] ?? 0);
                $gymXp = (int) ($state['gymXp'] ?? 0);
                $cur = ($trains >= 1 || $gymXp > 0) ? max(1, $trains) : 0;
                return $this->directiveStatus($cur, 1, "{$cur}/1 Gym session", "{$cur}/1 تدريب في النادي");

            case 4: // Reach Lv 2 & Scavenge Dump
                $dumpSearches = (int) ($state['cityActivities']['dump']['searchCount'] ?? 0)
                    + (int) ($state['cityActivities']['dump']['tossedCount'] ?? 0);
                $steps = ($level >= 2 ? 1 : 0) + ($dumpSearches >= 1 ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/2 · Dump %d/1', min(2, $level), min(1, $dumpSearches)),
                    sprintf('المستوى %d/2 · المكب %d/1', min(2, $level), min(1, $dumpSearches)),
                );

            case 5: // Recruit Lookout
                $lookoutRank = (int) ($ascension['crew']['lookout'] ?? 0);
                $cur = $lookoutRank >= 1 ? 1 : 0;
                return $this->directiveStatus($cur, 1, $cur >= 1 ? 'Lookout recruited' : '0/1 Lookout recruited', $cur >= 1 ? 'تم تجنيد المراقب' : '0/1 تجنيد المراقب');

            case 6: // Reach Lv 3 & Spin Wheel
                $wheels = is_array($state['cityActivities']['wheels'] ?? null) ? $state['cityActivities']['wheels'] : [];
                $totalSpins = 0;
                foreach ($wheels as $w) {
                    $totalSpins += (int) ($w['totalSpins'] ?? 0);
                }
                $steps = ($level >= 3 ? 1 : 0) + ($totalSpins >= 1 ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/3 · Wheel spins %d/1', min(3, $level), min(1, $totalSpins)),
                    sprintf('المستوى %d/3 · عجلة الحظ %d/1', min(3, $level), min(1, $totalSpins)),
                );

            case 7: // Gather 100% Nemesis Intel
                $intel = (int) ($ascension['nemesis']['intel'] ?? 0);
                $wins = (int) ($ascension['nemesis']['winsAgainst'] ?? 0);
                $effectiveIntel = $wins >= 1 ? 100 : min(100, max(0, $intel));
                return $this->directiveStatus($effectiveIntel, 100, "{$effectiveIntel}/100% Intel", "{$effectiveIntel}/100% معلومات");

            case 8: // Defeat First Nemesis
                $wins = (int) ($ascension['nemesis']['winsAgainst'] ?? 0);
                return $this->directiveStatus(min(1, $wins), 1, "{$wins}/1 Nemesis defeated", "{$wins}/1 هزيمة العدو اللدود");

            case 9: // Reach Lv 5 & Open Market/Bazaar
                $marketAct = ((int) ($ctr['buys'] ?? 0) >= 1) || ((int) ($ctr['sells'] ?? 0) >= 1);
                if (!$marketAct) {
                    $listingRow = $this->database->fetchOne(
                        'SELECT id FROM player_market_listings WHERE seller_id = :id LIMIT 1',
                        ['id' => $playerId],
                    );
                    if ($listingRow !== null) {
                        $marketAct = true;
                    }
                }
                if (!$marketAct) {
                    $bazaarMeta = $this->database->fetchOne(
                        'SELECT value FROM engine_metadata WHERE name = :name',
                        ['name' => TradeBazaarCompanyService::BAZAARS_META_KEY],
                    );
                    if ($bazaarMeta !== null && is_string($bazaarMeta['value'] ?? null)) {
                        $decoded = json_decode($bazaarMeta['value'], true);
                        if (!empty($decoded['shops'][$playerId])) {
                            $marketAct = true;
                        }
                    }
                }
                $steps = ($level >= 5 ? 1 : 0) + ($marketAct ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/5 · Market/Bazaar %d/1', min(5, $level), $marketAct ? 1 : 0),
                    sprintf('المستوى %d/5 · السوق/البازار %d/1', min(5, $level), $marketAct ? 1 : 0),
                );

            case 10: // Reach Lv 10 & Lock Bank/Vault
                $lockedCapital = (int) $player['bank_balance']
                    + (int) ($state['vaultBalance'] ?? 0)
                    + (int) ($state['activeCd']['principal'] ?? 0)
                    + (int) ($state['tornState']['activeCd']['principal'] ?? 0);
                $hasLock = $lockedCapital > 0;
                $steps = ($level >= 10 ? 1 : 0) + ($hasLock ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/10 · Vault/Bank %s', min(10, $level), $hasLock ? 'Locked' : '$0'),
                    sprintf('المستوى %d/10 · البنك/الخزنة %s', min(10, $level), $hasLock ? 'مؤمّن' : '0$'),
                );

            case 11: // Reach Lv 12 & Join/Found Faction
                $facRow = $this->database->fetchOne(
                    'SELECT faction_id FROM faction_members WHERE player_id = :id',
                    ['id' => $playerId],
                );
                $inFaction = $facRow !== null || !empty($state['factionId']) || !empty($state['fac']['id']);
                $steps = ($level >= 12 ? 1 : 0) + ($inFaction ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/12 · Faction %d/1', min(12, $level), $inFaction ? 1 : 0),
                    sprintf('المستوى %d/12 · العائلة %d/1', min(12, $level), $inFaction ? 1 : 0),
                );

            case 12: // Reach Lv 15 & Board First International Flight
            default:
                $cityLower = strtolower(trim((string) ($player['city'] ?? 'zone city')));
                $hasFlight = $cityLower !== '' && $cityLower !== 'zone city';
                if (!$hasFlight) {
                    $travelRow = $this->database->fetchOne(
                        'SELECT status FROM player_travel WHERE player_id = :id',
                        ['id' => $playerId],
                    );
                    if ($travelRow !== null) {
                        $hasFlight = true;
                    }
                }
                if (!$hasFlight) {
                    $fareLedger = $this->database->fetchOne(
                        "SELECT id FROM economy_ledger WHERE player_id = :id AND reason LIKE 'foreign-market.fare:%' LIMIT 1",
                        ['id' => $playerId],
                    );
                    if ($fareLedger !== null) {
                        $hasFlight = true;
                    }
                }
                $steps = ($level >= 15 ? 1 : 0) + ($hasFlight ? 1 : 0);
                return $this->directiveStatus(
                    $steps,
                    2,
                    sprintf('Lv %d/15 · International Flight %d/1', min(15, $level), $hasFlight ? 1 : 0),
                    sprintf('المستوى %d/15 · رحلة دولية %d/1', min(15, $level), $hasFlight ? 1 : 0),
                );
        }
    }

    /**
     * @return array{completed: bool, current: int, target: int, progressPct: int, progressLabelEn: string, progressLabelAr: string}
     */
    private function directiveStatus(int $current, int $target, string $labelEn, string $labelAr): array
    {
        $safeTarget = max(1, $target);
        $clamped = min($safeTarget, max(0, $current));
        return [
            'completed' => $clamped >= $safeTarget,
            'current' => $clamped,
            'target' => $safeTarget,
            'progressPct' => (int) round(($clamped / $safeTarget) * 100),
            'progressLabelEn' => $labelEn,
            'progressLabelAr' => $labelAr,
        ];
    }

    private function resolveNemesisCombat(array $player, array $state, array $ascension, array $nemesis): array
    {
        $catalog = (new GameplayCatalog($this->database, $this->events))->active();
        $loadout = LoadoutService::resolve($state, $catalog['items'] ?? []);

        $weaponMult = max(1.0, (float) ($loadout['weaponMultiplier'] ?? 1.0));
        $armorRed = min(0.85, max(0.0, (float) ($loadout['armorReduction'] ?? 0.0)));

        $skillBonuses = is_array($state['rpg']['bonuses'] ?? null) ? $state['rpg']['bonuses'] : [];
        $passive = self::computePassiveBonuses(['ascension' => $ascension]);
        $totalDmgBoostPct = (int) ($skillBonuses['combatDamagePct'] ?? 0) + (int) ($passive['nemesisDamagePct'] ?? 0);

        $playerStr = max(1.0, (float) $player['strength']) * $weaponMult * (1.0 + ($totalDmgBoostPct / 100.0));
        $playerDef = max(1.0, (float) $player['defense']);
        $playerSpd = max(1.0, (float) $player['speed']);
        $playerDex = max(1.0, (float) $player['dexterity']);

        $tier = max(1, min(10, (int) ($nemesis['tier'] ?? 1)));
        $rivalStats = $this->nemesisCombatStats($tier);

        $rivalStr = (float) $rivalStats['strength'];
        $rivalDef = (float) $rivalStats['defense'];
        $rivalSpd = (float) $rivalStats['speed'];
        $rivalDex = (float) $rivalStats['dexterity'];

        $playerHp = max(1, (int) $player['life']);
        $playerMaxHp = max(1, (int) $player['max_life']);
        $rivalHp = (int) $rivalStats['hp'];
        $rivalMaxHp = $rivalHp;

        $rounds = [];
        $damageDealt = 0;
        $damageTaken = 0;

        for ($round = 1; $round <= 12 && $playerHp > 0 && $rivalHp > 0; $round++) {
            $playerHitChance = (int) min(96, max(28, round(66 + ($playerSpd / max(1.0, $playerSpd + $rivalDex)) * 32 - 10)));
            $playerHit = $this->roll(1, 100) <= $playerHitChance;
            $pDmg = 0;
            if ($playerHit) {
                $ratio = max(0.25, min(4.8, $playerStr / max(1.0, $rivalDef)));
                $variance = $this->roll(92, 110) / 100.0;
                $pDmg = max(5, (int) round((16.0 + sqrt($playerStr) * 3.9) * $ratio * $variance));
                $rivalHp = max(0, $rivalHp - $pDmg);
                $damageDealt += $pDmg;
            }

            $rDmg = 0;
            $rivalHit = false;
            if ($rivalHp > 0) {
                $rivalHitChance = (int) min(90, max(22, round(58 + ($rivalSpd / max(1.0, $rivalSpd + $playerDex)) * 28 - 10)));
                $rivalHit = $this->roll(1, 100) <= $rivalHitChance;
                if ($rivalHit) {
                    $rRatio = max(0.20, min(4.0, $rivalStr / max(1.0, $playerDef)));
                    $rVar = $this->roll(88, 108) / 100.0;
                    $rawDmg = (12.0 + sqrt($rivalStr) * 3.0) * $rRatio * $rVar * (1.0 - $armorRed);
                    $rDmg = max(3, (int) round($rawDmg));
                    $playerHp = max(0, $playerHp - $rDmg);
                    $damageTaken += $rDmg;
                }
            }

            $rounds[] = [
                'round' => $round,
                'playerHit' => $playerHit,
                'playerDamage' => $pDmg,
                'nemesisHit' => $rivalHit,
                'nemesisDamage' => $rDmg,
                'playerHp' => $playerHp,
                'nemesisHp' => $rivalHp,
            ];
        }

        $victory = $rivalHp <= 0 || (
            $playerHp > 0
            && ($playerHp / $playerMaxHp) > ($rivalHp / $rivalMaxHp)
            && $rivalHp <= (int) round($rivalMaxHp * 0.15)
        );

        return [
            'nemesisId' => $nemesis['id'],
            'nemesisNameEn' => $nemesis['nameEn'],
            'nemesisNameAr' => $nemesis['nameAr'],
            'victory' => $victory,
            'outcome' => $victory ? 'victory' : 'defeat',
            'roundsCount' => count($rounds),
            'damageDealt' => $damageDealt,
            'damageTaken' => $damageTaken,
            'playerHpRemaining' => $victory ? max(1, $playerHp) : 0,
            'nemesisHpRemaining' => $victory ? 0 : max(1, $rivalHp),
            'weaponUsed' => $loadout['weaponId'] ?? 'fists',
            'armorUsed' => $loadout['armorId'] ?? null,
            'rounds' => $rounds,
        ];
    }

    /** @return array{hp: int, strength: int, defense: int, speed: int, dexterity: int} */
    private function nemesisCombatStats(int $tier): array
    {
        $t = max(1, min(10, $tier));
        if ($t === 1) {
            return [
                'hp' => 145,
                'strength' => 11,
                'defense' => 9,
                'speed' => 11,
                'dexterity' => 9,
            ];
        }
        $baseStat = 8 + ($t * 9) + ($t * $t * 6);
        return [
            'hp' => 120 + ($t * 65) + ($t * $t * 22),
            'strength' => $baseStat,
            'defense' => (int) round($baseStat * 0.92),
            'speed' => (int) round($baseStat * 0.96),
            'dexterity' => (int) round($baseStat * 0.90),
        ];
    }

    private function nemesisTrophyForTier(int $tier): string
    {
        return match (true) {
            $tier <= 1 => 'revolver',
            $tier === 2 => 'shotgun',
            $tier === 3 => 'vest',
            $tier === 4 => 'ak',
            default => 'sniper',
        };
    }

    private function computeNextUnlock(int $level, int $xp): array
    {
        $chosenGate = null;
        foreach (self::LEVEL_GATES as $gate) {
            if ($level < (int) $gate['level']) {
                $chosenGate = $gate;
                break;
            }
        }

        $allUnlocked = $chosenGate === null;
        if ($chosenGate === null) {
            $chosenGate = self::LEVEL_GATES[count(self::LEVEL_GATES) - 1];
        }

        $targetLevel = (int) $chosenGate['level'];
        $floorLevel = $this->previousGateFloorLevel($targetLevel, $level);
        $floorXp = $this->leveling->totalXpForLevel($floorLevel);
        $targetXp = $this->leveling->totalXpForLevel($targetLevel);

        if ($allUnlocked || $xp >= $targetXp) {
            $xpRemaining = 0;
            $pct = 100;
        } else {
            $xpRemaining = max(0, $targetXp - $xp);
            $span = max(1, $targetXp - $floorXp);
            $pct = (int) min(99, max(0, round((($xp - $floorXp) / $span) * 100)));
        }

        return [
            'id' => $chosenGate['id'],
            'level' => $targetLevel,
            'requiredLevel' => $targetLevel,
            'currentLevel' => $level,
            'levelsRemaining' => $allUnlocked ? 0 : max(0, $targetLevel - $level),
            'xpRequired' => $targetXp,
            'currentXp' => $xp,
            'xpNeeded' => $xpRemaining,
            'xpRemaining' => $xpRemaining,
            'progressPct' => $pct,
            'featureEn' => $chosenGate['featureEn'],
            'featureAr' => $chosenGate['featureAr'],
            'titleEn' => $chosenGate['featureEn'],
            'titleAr' => $chosenGate['featureAr'],
            'descEn' => $chosenGate['descEn'],
            'descAr' => $chosenGate['descAr'],
            'targetRoute' => $chosenGate['targetRoute'],
            'allGatesUnlocked' => $allUnlocked,
        ];
    }

    private function previousGateFloorLevel(int $targetGateLevel, int $currentLevel): int
    {
        $prev = 1;
        foreach (self::LEVEL_GATES as $g) {
            $gl = (int) $g['level'];
            if ($gl >= $targetGateLevel) {
                break;
            }
            if ($currentLevel >= $gl) {
                $prev = $gl;
            }
        }
        return $prev;
    }

    private function resolveCurrentEraIndex(int $level): int
    {
        return match (true) {
            $level >= 25 => 6,
            $level >= 15 => 5,
            $level >= 12 => 4,
            $level >= 7 => 3,
            $level >= 3 => 2,
            default => 1,
        };
    }

    private function resolveActiveDirectiveIndex(array $ascension): int
    {
        $claimed = is_array($ascension['claimedDirectives'] ?? null) ? $ascension['claimedDirectives'] : [];
        foreach (array_keys(self::DIRECTIVES) as $idx) {
            if (empty($claimed[$idx])) {
                return (int) $idx;
            }
        }
        return 12;
    }

    private function calculateCrewTributeState(array $ascension, int $nowSec): array
    {
        $totalHourly = 0;
        foreach (self::CREW_SLOTS as $slotId => $def) {
            $rank = (int) ($ascension['crew'][$slotId] ?? 0);
            if ($rank > 0) {
                $totalHourly += (int) $def['hourlyRateBase'] * $rank;
            }
        }

        $tributeMeta = is_array($ascension['crewTribute'] ?? null) ? $ascension['crewTribute'] : [];
        $lastAt = (int) ($tributeMeta['lastCollectedAt'] ?? $nowSec);
        $banked = max(0, (int) ($tributeMeta['bankedTribute'] ?? 0));
        $signingBonus = max(0, (int) ($tributeMeta['signingBonusPending'] ?? 0));
        $totalCollected = max(0, (int) ($tributeMeta['totalCollected'] ?? 0));

        if ($totalHourly <= 0) {
            return [
                'totalHourlyRate' => 0,
                'pendingTribute' => 0,
                'signingBonusPending' => 0,
                'bankedTribute' => 0,
                'elapsedSeconds' => 0,
                'cappedSeconds' => 0,
                'minCollectSeconds' => self::CREW_TRIBUTE_MIN_SECONDS,
                'maxCapSeconds' => self::CREW_TRIBUTE_MAX_SECONDS,
                'canCollectTribute' => false,
                'totalCollected' => $totalCollected,
            ];
        }

        $elapsed = max(0, $nowSec - $lastAt);
        $capped = min(self::CREW_TRIBUTE_MAX_SECONDS, $elapsed);
        $accruedFromElapsed = (int) floor(($totalHourly * $capped) / 3600);

        $eligibleByTime = $elapsed >= self::CREW_TRIBUTE_MIN_SECONDS;
        $collectableNow = ($eligibleByTime ? $accruedFromElapsed : 0) + $banked + $signingBonus;
        $displayPending = $accruedFromElapsed + $banked + $signingBonus;

        return [
            'totalHourlyRate' => $totalHourly,
            'pendingTribute' => $collectableNow > 0 ? $collectableNow : $displayPending,
            'collectableTribute' => $collectableNow,
            'signingBonusPending' => $signingBonus,
            'bankedTribute' => $banked,
            'elapsedSeconds' => $elapsed,
            'cappedSeconds' => $capped,
            'minCollectSeconds' => self::CREW_TRIBUTE_MIN_SECONDS,
            'maxCapSeconds' => self::CREW_TRIBUTE_MAX_SECONDS,
            'canCollectTribute' => ($eligibleByTime || $signingBonus > 0 || $banked > 0) && $collectableNow > 0,
            'totalCollected' => $totalCollected,
        ];
    }

    private function bankAccruedCrewTribute(array &$ascension, int $nowSec): void
    {
        $totalHourly = 0;
        foreach (self::CREW_SLOTS as $slotId => $def) {
            $rank = (int) ($ascension['crew'][$slotId] ?? 0);
            if ($rank > 0) {
                $totalHourly += (int) $def['hourlyRateBase'] * $rank;
            }
        }
        if ($totalHourly <= 0) {
            $ascension['crewTribute']['lastCollectedAt'] = $nowSec;
            return;
        }
        $lastAt = (int) ($ascension['crewTribute']['lastCollectedAt'] ?? $nowSec);
        $elapsed = min(self::CREW_TRIBUTE_MAX_SECONDS, max(0, $nowSec - $lastAt));
        $earned = (int) floor(($totalHourly * $elapsed) / 3600);
        if ($earned > 0) {
            $ascension['crewTribute']['bankedTribute'] = (int) ($ascension['crewTribute']['bankedTribute'] ?? 0) + $earned;
        }
        $ascension['crewTribute']['lastCollectedAt'] = $nowSec;
    }

    private function normalizeAscensionState(string $playerId, array $state, int $nowSec): array
    {
        $raw = is_array($state['ascension'] ?? null) ? $state['ascension'] : [];
        $originChosen = !empty($raw['originChosen']);
        $originId = $originChosen && is_string($raw['origin'] ?? $raw['originId'] ?? null)
            ? (string) ($raw['origin'] ?? $raw['originId'])
            : null;
        if ($originId !== null && !isset(self::ORIGINS[$originId])) {
            $originId = null;
            $originChosen = false;
        }

        $crew = [];
        $rawCrew = is_array($raw['crew'] ?? null) ? $raw['crew'] : [];
        foreach (array_keys(self::CREW_SLOTS) as $slotId) {
            $crew[$slotId] = self::crewRankFromRaw($rawCrew[$slotId] ?? 0);
        }

        $nemesis = $this->normalizeNemesis($playerId, is_array($raw['nemesis'] ?? null) ? $raw['nemesis'] : [], $nowSec);

        $rawTribute = is_array($raw['crewTribute'] ?? null) ? $raw['crewTribute'] : [];
        $crewTribute = [
            'lastCollectedAt' => isset($rawTribute['lastCollectedAt']) ? (int) $rawTribute['lastCollectedAt'] : $nowSec,
            'bankedTribute' => max(0, (int) ($rawTribute['bankedTribute'] ?? 0)),
            'signingBonusPending' => max(0, (int) ($rawTribute['signingBonusPending'] ?? 0)),
            'totalCollected' => max(0, (int) ($rawTribute['totalCollected'] ?? 0)),
        ];

        $claimedDirectives = [];
        if (is_array($raw['claimedDirectives'] ?? null)) {
            foreach ($raw['claimedDirectives'] as $k => $v) {
                $idx = (int) $k;
                if (isset(self::DIRECTIVES[$idx]) && $v) {
                    $claimedDirectives[$idx] = (int) $v;
                }
            }
        }

        $claimedEras = [];
        if (is_array($raw['claimedEras'] ?? null)) {
            foreach ($raw['claimedEras'] as $k => $v) {
                $idx = (int) $k;
                if (isset(self::ERAS[$idx]) && $v) {
                    $claimedEras[$idx] = (int) $v;
                }
            }
        }

        $asc = [
            'originChosen' => $originChosen,
            'origin' => $originId,
            'originId' => $originId,
            'originSelectedAt' => isset($raw['originSelectedAt']) ? (int) $raw['originSelectedAt'] : null,
            'originBonuses' => $originId !== null ? self::ORIGINS[$originId]['bonuses'] : [],
            'claimedEras' => $claimedEras,
            'eraTitles' => is_array($raw['eraTitles'] ?? null) ? $raw['eraTitles'] : [],
            'activeTitle' => is_array($raw['activeTitle'] ?? null) ? $raw['activeTitle'] : null,
            'nemesis' => $nemesis,
            'crew' => $crew,
            'crewTribute' => $crewTribute,
            'claimedDirectives' => $claimedDirectives,
            'directiveIndex' => 1,
            'spEarned' => max(0, (int) ($raw['spEarned'] ?? 0)),
            'meritsEarned' => max(0, (int) ($raw['meritsEarned'] ?? 0)),
        ];
        $asc['directiveIndex'] = $this->resolveActiveDirectiveIndex($asc);

        return $asc;
    }

    private function normalizeNemesis(string $playerId, array $raw, int $nowSec): array
    {
        $seedHash = hash('sha256', 'zone-nemesis-v151:' . $playerId);
        $rosterIdx = hexdec(substr($seedHash, 0, 8)) % count(self::NEMESIS_ROSTER);
        $seedDef = self::NEMESIS_ROSTER[$rosterIdx];

        $tier = max(1, min(10, (int) ($raw['tier'] ?? 1)));
        $titlePair = self::NEMESIS_TITLES_BY_TIER[$tier] ?? self::NEMESIS_TITLES_BY_TIER[1];

        $defaultBaseHeat = min(10, 2 + ($tier - 1) + (hexdec(substr($seedHash, 8, 2)) % 2));
        $baseHeat = max(2, min(10, (int) ($raw['baseHeatTaxPct'] ?? $defaultBaseHeat)));
        $clearedUntil = max(0, (int) ($raw['heatClearedUntil'] ?? 0));
        $effectiveHeat = $clearedUntil > $nowSec ? 0 : $baseHeat;

        $districtEn = is_string($raw['districtEn'] ?? null) && $raw['districtEn'] !== ''
            ? $raw['districtEn']
            : $seedDef['districtEn'];
        $districtAr = is_string($raw['districtAr'] ?? null) && $raw['districtAr'] !== ''
            ? $raw['districtAr']
            : $seedDef['districtAr'];

        return [
            'id' => is_string($raw['id'] ?? null) && $raw['id'] !== ''
                ? $raw['id']
                : ('nem-' . substr($seedHash, 0, 10)),
            'nameEn' => is_string($raw['nameEn'] ?? null) && $raw['nameEn'] !== '' ? $raw['nameEn'] : $seedDef['nameEn'],
            'nameAr' => is_string($raw['nameAr'] ?? null) && $raw['nameAr'] !== '' ? $raw['nameAr'] : $seedDef['nameAr'],
            'titleEn' => is_string($raw['titleEn'] ?? null) && $raw['titleEn'] !== '' ? $raw['titleEn'] : $titlePair['en'],
            'titleAr' => is_string($raw['titleAr'] ?? null) && $raw['titleAr'] !== '' ? $raw['titleAr'] : $titlePair['ar'],
            'tier' => $tier,
            'archetype' => is_string($raw['archetype'] ?? null) && $raw['archetype'] !== '' ? $raw['archetype'] : $seedDef['archetype'],
            'archetypeEn' => is_string($raw['archetypeEn'] ?? null) && $raw['archetypeEn'] !== '' ? $raw['archetypeEn'] : $seedDef['archetypeEn'],
            'archetypeAr' => is_string($raw['archetypeAr'] ?? null) && $raw['archetypeAr'] !== '' ? $raw['archetypeAr'] : $seedDef['archetypeAr'],
            'district' => $districtEn,
            'districtId' => is_string($raw['districtId'] ?? null) && $raw['districtId'] !== '' ? $raw['districtId'] : $seedDef['districtId'],
            'districtEn' => $districtEn,
            'districtAr' => $districtAr,
            'intel' => max(0, min(100, (int) ($raw['intel'] ?? 0))),
            'grudgeCount' => max(0, (int) ($raw['grudgeCount'] ?? 0)),
            'winsAgainst' => max(0, (int) ($raw['winsAgainst'] ?? 0)),
            'lossesAgainst' => max(0, (int) ($raw['lossesAgainst'] ?? 0)),
            'scarEn' => is_string($raw['scarEn'] ?? null) && $raw['scarEn'] !== ''
                ? $raw['scarEn']
                : 'Unscarred — Fresh Turf Feud',
            'scarAr' => is_string($raw['scarAr'] ?? null) && $raw['scarAr'] !== ''
                ? $raw['scarAr']
                : 'بلا ندوب — عداوة ميدانية جديدة',
            'heatTaxPct' => $effectiveHeat,
            'baseHeatTaxPct' => $baseHeat,
            'heatClearedUntil' => $clearedUntil,
            'lastMemoryEn' => is_string($raw['lastMemoryEn'] ?? null) && $raw['lastMemoryEn'] !== ''
                ? $raw['lastMemoryEn']
                : "Word on {$districtEn} says you're fresh meat — my crew is skimming {$baseHeat}% off your corners until you stop me.",
            'lastMemoryAr' => is_string($raw['lastMemoryAr'] ?? null) && $raw['lastMemoryAr'] !== ''
                ? $raw['lastMemoryAr']
                : "الأخبار في {$districtAr} تقول إنك صيد جديد — رجالي يقتطعون {$baseHeat}% من عملياتك حتى تجرؤ على مواجهتي.",
            'lastCombatLog' => is_array($raw['lastCombatLog'] ?? null) ? $raw['lastCombatLog'] : null,
        ];
    }

    private static function crewRankFromRaw(mixed $entry): int
    {
        if (is_array($entry)) {
            return max(0, min(self::CREW_MAX_RANK, (int) ($entry['rank'] ?? 0)));
        }
        return max(0, min(self::CREW_MAX_RANK, (int) $entry));
    }

    private function assertOperativeFree(array $state, int $nowMs): void
    {
        if ((int) ($state['jailUntil'] ?? 0) > $nowMs || (int) ($state['hospUntil'] ?? 0) > $nowMs) {
            throw new RuntimeException('You must leave jail or hospital before executing street operations.');
        }
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
                'updated' => gmdate('c', $this->nowSec()),
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

    private function nowSec(): int
    {
        if ($this->clock !== null) {
            return (int) ($this->clock)();
        }
        return time();
    }
}

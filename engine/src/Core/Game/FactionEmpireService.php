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
use Zone\Modules\Gangs\FactionService;

/**
 * Full Faction Empire, 7-Branch Respect Skill Tree (28 Upgrades), 4-Role Crew OCs,
 * 48h Scheduled Ranked Wars, Bonus Weapon Caches, and 9-Slot Tactical Loadout.
 */
final class FactionEmpireService
{
    public const WAR_DURATION_SECONDS = 172800; // 48 hours
    public const WAR_TARGET_LEAD = 500;
    public const WAR_ASSAULT_ENERGY = 25;
    public const NPC_FILLER_CUT_PCT = 20;

    private const META_PREFIX = 'fac-emp:';

    private const SEED_DEFAULTS = [
        'vipers' => [
            'tag' => 'VIPR',
            'manifesto' => 'Strike fast from the dunes. Control the harbor corridors and gym circuits.',
        ],
        'kings' => [
            'tag' => 'KING',
            'manifesto' => 'Sovereigns of the docks, shipping manifests, and heavy artillery.',
        ],
        'night' => [
            'tag' => 'NGHT',
            'manifesto' => 'Shadow brokers ruling after-hours bazaars, smuggling lanes, and black-box intel.',
        ],
        'oldguard' => [
            'tag' => 'OLDG',
            'manifesto' => 'Iron-code veterans holding the northern blocks with discipline and steel.',
        ],
    ];

    /** 7 Branches x 4 Upgrades = 28 Upgrades, max tier 5 each. */
    public const RESPECT_TREE = [
        'criminality' => [
            'nameEn' => 'Criminality',
            'nameAr' => 'الإجرام المنظم',
            'descEn' => 'Boosts street crime mastery, nerve capacity, and crew heist payouts.',
            'descAr' => 'يعزز مهارة الجرائم، الحد الأقصى للجرأة، وعوائد السطو الجماعي.',
            'nodes' => [
                'crime_skill' => ['nameEn' => 'Shadow Trade', 'nameAr' => 'حرفة الظل', 'effectEn' => '+3% Crime Skill per tier', 'effectAr' => '+3% مهارة الجرائم لكل مستوى', 'perTier' => 3, 'unit' => '%', 'baseCost' => 100],
                'max_nerve' => ['nameEn' => 'Iron Nerves', 'nameAr' => 'أعصاب فولاذية', 'effectEn' => '+2 Max Nerve per tier', 'effectAr' => '+2 أقصى جرأة لكل مستوى', 'perTier' => 2, 'unit' => 'nerve', 'baseCost' => 150],
                'oc_payout' => ['nameEn' => 'Syndicate Cut', 'nameAr' => 'حصة النقابة', 'effectEn' => '+5% Organized Crime Payout per tier', 'effectAr' => '+5% عوائد الجرائم المنظمة لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 150],
                'jail_bust' => ['nameEn' => 'Keymaster Network', 'nameAr' => 'شبكة التهريب من السجن', 'effectEn' => '+5% Jail Bust Skill per tier', 'effectAr' => '+5% مهارة تهريب السجناء لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 120],
            ],
        ],
        'fortitude' => [
            'nameEn' => 'Fortitude',
            'nameAr' => 'الصمود الطبي',
            'descEn' => 'Reduces hospital recovery timers and elevates maximum life and trauma care.',
            'descAr' => 'يقلل وقت المستشفى ويرفع الصحة القصوى وكفاءة الإسعاف.',
            'nodes' => [
                'hosp_time' => ['nameEn' => 'Rapid Triage', 'nameAr' => 'فرز طبي سريع', 'effectEn' => '-5% Hospital Time per tier', 'effectAr' => '-5% وقت المستشفى لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 120],
                'max_life' => ['nameEn' => 'Reinforced Vitality', 'nameAr' => 'حيوية معززة', 'effectEn' => '+50 Max Life per tier', 'effectAr' => '+50 أقصى صحة لكل مستوى', 'perTier' => 50, 'unit' => 'life', 'baseCost' => 150],
                'med_effectiveness' => ['nameEn' => 'Field Surgeons', 'nameAr' => 'جراحو الميدان', 'effectEn' => '+6% Medical Effectiveness per tier', 'effectAr' => '+6% كفاءة العلاج الطبي لكل مستوى', 'perTier' => 6, 'unit' => '%', 'baseCost' => 120],
                'revive_skill' => ['nameEn' => 'Defibrillator Rig', 'nameAr' => 'وحدة الإنعاش الفوري', 'effectEn' => '+5% Revive Mastery per tier', 'effectAr' => '+5% مهارة الإنعاش لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 140],
            ],
        ],
        'voracity' => [
            'nameEn' => 'Voracity',
            'nameAr' => 'النهم والمعززات',
            'descEn' => 'Expands booster cooldown capacity and amplifies energy cans and candy.',
            'descAr' => 'يرفع سقف تهدئة المعززات ويضاعف طاقة العبوات وسعادة الحلوى.',
            'nodes' => [
                'booster_cd_cap' => ['nameEn' => 'Gluttonous Reserve', 'nameAr' => 'مخزون المعززات', 'effectEn' => '+2h Booster Cooldown Cap per tier', 'effectAr' => '+2 ساعة سقف المعززات لكل مستوى', 'perTier' => 2, 'unit' => 'hours', 'baseCost' => 140],
                'energy_can_gain' => ['nameEn' => 'Taurine Surge', 'nameAr' => 'اندفاع التورين', 'effectEn' => '+10% Energy Can Gain per tier', 'effectAr' => '+10% طاقة العبوات لكل مستوى', 'perTier' => 10, 'unit' => '%', 'baseCost' => 160],
                'candy_happy' => ['nameEn' => 'Sugar Rush', 'nameAr' => 'نشوة الحلوى', 'effectEn' => '+10% Candy Happiness per tier', 'effectAr' => '+10% سعادة الحلوى لكل مستوى', 'perTier' => 10, 'unit' => '%', 'baseCost' => 100],
                'booster_nerve' => ['nameEn' => 'Liquid Courage', 'nameAr' => 'شجاعة مركزة', 'effectEn' => '+1 Booster Nerve Gain per tier', 'effectAr' => '+1 جرأة إضافية لكل مستوى', 'perTier' => 1, 'unit' => 'nerve', 'baseCost' => 130],
            ],
        ],
        'toleration' => [
            'nameEn' => 'Toleration',
            'nameAr' => 'التحمل الدوائي',
            'descEn' => 'Mitigates drug overdose risk, addiction buildup, and rehabilitation fees.',
            'descAr' => 'يخفض خطر الجرعة الزائدة وتراكم الإدمان وتكلفة المصحة.',
            'nodes' => [
                'drug_od_risk' => ['nameEn' => 'Metabolic Shield', 'nameAr' => 'درع الأيض الحيوي', 'effectEn' => '-6% Drug Overdose Risk per tier', 'effectAr' => '-6% خطر الجرعة الزائدة لكل مستوى', 'perTier' => 6, 'unit' => '%', 'baseCost' => 160],
                'addiction_gain' => ['nameEn' => 'Clean Receptors', 'nameAr' => 'مقاومة الإدمان', 'effectEn' => '-8% Addiction Gain per tier', 'effectAr' => '-8% اكتساب الإدمان لكل مستوى', 'perTier' => 8, 'unit' => '%', 'baseCost' => 150],
                'rehab_cost' => ['nameEn' => 'Clinic Retainer', 'nameAr' => 'تعاقد المصحة', 'effectEn' => '-6% Rehab Cost per tier', 'effectAr' => '-6% تكلفة العلاج لكل مستوى', 'perTier' => 6, 'unit' => '%', 'baseCost' => 140],
                'drug_cd_reduce' => ['nameEn' => 'Rapid Clearance', 'nameAr' => 'تصفية سريعة', 'effectEn' => '-3% Drug Cooldown per tier', 'effectAr' => '-3% تهدئة الدواء لكل مستوى', 'perTier' => 3, 'unit' => '%', 'baseCost' => 180],
            ],
        ],
        'excursion' => [
            'nameEn' => 'Excursion',
            'nameAr' => 'السفر والرحلات',
            'descEn' => 'Increases international smuggling luggage, hunting yields, and overseas savings.',
            'descAr' => 'يزيد سعة حقائب التهريب الدولي وعوائد الصيد وخصومات السفر.',
            'nodes' => [
                'travel_luggage' => ['nameEn' => 'Smuggler Compartments', 'nameAr' => 'مخابئ التهريب الجوي', 'effectEn' => '+1 Travel Luggage per tier', 'effectAr' => '+1 سعة حقيبة السفر لكل مستوى', 'perTier' => 1, 'unit' => 'items', 'baseCost' => 200],
                'rehab_fee' => ['nameEn' => 'Zurich Envoy', 'nameAr' => 'مبعوث زيورخ', 'effectEn' => '-5% Overseas Rehab Fee per tier', 'effectAr' => '-5% رسوم مصحة الخارج لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 130],
                'hunting_gain' => ['nameEn' => 'Safari Trackers', 'nameAr' => 'خبراء السفاري', 'effectEn' => '+6% Hunting Gain per tier', 'effectAr' => '+6% عوائد الصيد لكل مستوى', 'perTier' => 6, 'unit' => '%', 'baseCost' => 120],
                'airfare_discount' => ['nameEn' => 'Chartered Runway', 'nameAr' => 'مدرج طيران مستأجر', 'effectEn' => '-5% Airfare Cost per tier', 'effectAr' => '-5% رسوم الطيران لكل مستوى', 'perTier' => 5, 'unit' => '%', 'baseCost' => 110],
            ],
        ],
        'steadfast' => [
            'nameEn' => 'Steadfast',
            'nameAr' => 'الثبات الرياضي',
            'descEn' => 'Multiplies Strength, Defense, Speed, and Dexterity gym training gains.',
            'descAr' => 'يضاعف مكاسب تدريب القوة والدفاع والسرعة والرشاقة في النادي.',
            'nodes' => [
                'str_gym_gain' => ['nameEn' => 'Heavy Iron', 'nameAr' => 'الحديد الثقيل (قوة)', 'effectEn' => '+2% Strength Gym Gain per tier', 'effectAr' => '+2% تدريب القوة لكل مستوى', 'perTier' => 2, 'unit' => '%', 'baseCost' => 150],
                'def_gym_gain' => ['nameEn' => 'Granite Guard', 'nameAr' => 'دفاع الجرانيت', 'effectEn' => '+2% Defense Gym Gain per tier', 'effectAr' => '+2% تدريب الدفاع لكل مستوى', 'perTier' => 2, 'unit' => '%', 'baseCost' => 150],
                'spd_gym_gain' => ['nameEn' => 'Kinetic Tempo', 'nameAr' => 'إيقاع السرعة', 'effectEn' => '+2% Speed Gym Gain per tier', 'effectAr' => '+2% تدريب السرعة لكل مستوى', 'perTier' => 2, 'unit' => '%', 'baseCost' => 150],
                'dex_gym_gain' => ['nameEn' => 'Razor Reflex', 'nameAr' => 'ردود فعل حادة (رشاقة)', 'effectEn' => '+2% Dexterity Gym Gain per tier', 'effectAr' => '+2% تدريب الرشاقة لكل مستوى', 'perTier' => 2, 'unit' => '%', 'baseCost' => 150],
            ],
        ],
        'aggression' => [
            'nameEn' => 'Aggression',
            'nameAr' => 'الضراوة القتالية',
            'descEn' => 'Sharpens weapon lethality, hit accuracy, combat speed, and hospitalization impact.',
            'descAr' => 'يرفع ضرر الأسلحة ودقة الإصابة وسرعة القتال ومدة تنويم الخصوم.',
            'nodes' => [
                'combat_damage' => ['nameEn' => 'Hollow-Point Doctrine', 'nameAr' => 'عقيدة الضرر القاتل', 'effectEn' => '+3% Weapon Damage per tier', 'effectAr' => '+3% ضرر القتال لكل مستوى', 'perTier' => 3, 'unit' => '%', 'baseCost' => 160],
                'combat_accuracy' => ['nameEn' => 'Crosshair Discipline', 'nameAr' => 'انضباط التصويب', 'effectEn' => '+3% Combat Accuracy per tier', 'effectAr' => '+3% دقة الإصابة لكل مستوى', 'perTier' => 3, 'unit' => '%', 'baseCost' => 160],
                'combat_speed' => ['nameEn' => 'Blitz Initiative', 'nameAr' => 'مبادرة الهجوم الخاطف', 'effectEn' => '+3% Combat Speed per tier', 'effectAr' => '+3% سرعة القتال لكل مستوى', 'perTier' => 3, 'unit' => '%', 'baseCost' => 150],
                'hosp_duration' => ['nameEn' => 'Brutal Trauma', 'nameAr' => 'إصابة بالغة', 'effectEn' => '+6% Hospitalize Duration per tier', 'effectAr' => '+6% مدة تنويم الخصم لكل مستوى', 'perTier' => 6, 'unit' => '%', 'baseCost' => 140],
            ],
        ],
    ];

    /** 5 Torn Crew Organized Crime Heists with 4 Named Roles. */
    public const CREW_SLOTS = [
        'mastermind' => ['id' => 'mastermind', 'nameEn' => 'Mastermind', 'nameAr' => 'العقل المدبر', 'npcName' => 'Architect_Zero'],
        'hacker' => ['id' => 'hacker', 'nameEn' => 'Hacker', 'nameAr' => 'المخترق الرقمي', 'npcName' => 'Cipher_Ghost'],
        'muscle' => ['id' => 'muscle', 'nameEn' => 'Muscle', 'nameAr' => 'القوة الضاربة', 'npcName' => 'Vanguard_Rex'],
        'driver' => ['id' => 'driver', 'nameEn' => 'Driver', 'nameAr' => 'سائق الهروب', 'npcName' => 'Nitro_Layla'],
    ];

    public const CREW_HEISTS = [
        'armored_van' => [
            'id' => 'armored_van',
            'tier' => 1,
            'nameEn' => 'Armored Van Intercept',
            'nameAr' => 'اعتراض الشاحنة المصفحة',
            'planningSeconds' => 60,
            'cashBase' => 120000,
            'respectReward' => 35,
        ],
        'harbor_customs_vault' => [
            'id' => 'harbor_customs_vault',
            'tier' => 2,
            'nameEn' => 'Harbor Customs Vault',
            'nameAr' => 'خزنة جمارك المرفأ',
            'planningSeconds' => 180,
            'cashBase' => 320000,
            'respectReward' => 75,
        ],
        'embassy_black_box' => [
            'id' => 'embassy_black_box',
            'tier' => 3,
            'nameEn' => 'Embassy Black-Box',
            'nameAr' => 'الصندوق الأسود للسفارة',
            'planningSeconds' => 300,
            'cashBase' => 680000,
            'respectReward' => 140,
        ],
        'central_bank_bullion' => [
            'id' => 'central_bank_bullion',
            'tier' => 4,
            'nameEn' => 'Central Bank Bullion',
            'nameAr' => 'سبائك البنك المركزي',
            'planningSeconds' => 600,
            'cashBase' => 1500000,
            'respectReward' => 280,
        ],
        'sovereign_airfield' => [
            'id' => 'sovereign_airfield',
            'tier' => 5,
            'nameEn' => 'Sovereign Airfield Heist',
            'nameAr' => 'سطو مطار السيادة الخاص',
            'planningSeconds' => 900,
            'cashBase' => 3200000,
            'respectReward' => 550,
        ],
    ];

    public const RW_CACHE_DEFINITIONS = [
        'bronze' => [
            'id' => 'bronze',
            'nameEn' => 'Bronze Arms Cache',
            'nameAr' => 'صندوق تسليح برونزي',
            'odds' => ['yellow' => 75, 'orange' => 25, 'red' => 0],
        ],
        'silver' => [
            'id' => 'silver',
            'nameEn' => 'Silver Arms Cache',
            'nameAr' => 'صندوق تسليح فضي',
            'odds' => ['yellow' => 30, 'orange' => 50, 'red' => 20],
        ],
        'gold' => [
            'id' => 'gold',
            'nameEn' => 'Gold Arms Cache',
            'nameAr' => 'صندوق تسليح ذهبي',
            'odds' => ['yellow' => 0, 'orange' => 40, 'red' => 60],
        ],
    ];

    public const RW_BONUS_PERKS = [
        'plunder' => [
            'id' => 'plunder',
            'valuePct' => 20,
            'labelEn' => 'Plunder +20%',
            'labelAr' => 'نهب +20%',
        ],
        'warlord' => [
            'id' => 'warlord',
            'valuePct' => 25,
            'labelEn' => 'Warlord +25% Respect',
            'labelAr' => 'أمير الحرب +25% احترام',
        ],
        'execute' => [
            'id' => 'execute',
            'valuePct' => 15,
            'labelEn' => 'Execute 15% HP',
            'labelAr' => 'إعدام فوري 15% صحة',
        ],
        'bloodlust' => [
            'id' => 'bloodlust',
            'valuePct' => 10,
            'labelEn' => 'Bloodlust +10% Life',
            'labelAr' => 'عطش الدماء +10% صحة',
        ],
    ];

    private const RW_WEAPON_ARCHETYPES = [
        ['baseItemId' => 'ak', 'slot' => 'primary', 'baseMult' => 3.8, 'nameEn' => 'AK-47 Assault Rifle', 'nameAr' => 'بندقية هجومية AK-47'],
        ['baseItemId' => 'sniperrifle_6', 'slot' => 'primary', 'baseMult' => 5.0, 'nameEn' => 'Heavy .50 Anti-Materiel Rifle', 'nameAr' => 'قناصة ثقيلة عيار 50'],
        ['baseItemId' => 'bullpup_3', 'slot' => 'primary', 'baseMult' => 3.9, 'nameEn' => 'Tactical Bullpup Carbine', 'nameAr' => 'بندقية بولباب تكتيكية'],
        ['baseItemId' => 'revolver_5', 'slot' => 'secondary', 'baseMult' => 2.4, 'nameEn' => 'Custom .44 Syndicate Magnum', 'nameAr' => 'مسدس ماغنوم النقابة'],
        ['baseItemId' => 'knife', 'slot' => 'melee', 'baseMult' => 1.85, 'nameEn' => 'Damascus Combat Karambit', 'nameAr' => 'خنجر قتالي دمشقي'],
    ];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?\Closure $clock = null,
        private readonly ?\Closure $random = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
    }

    public function snapshot(string $playerId): array
    {
        $player = $this->requirePlayer($playerId);
        $now = $this->now();
        $progRow = $this->loadProgressionRow($playerId);
        $progState = $progRow['state'];
        $catalogItems = $this->catalogItems();

        $membership = $this->playerMembership($playerId);
        $directory = $this->buildDirectory($now);

        if ($membership === null) {
            $emptyOc = $this->formatOrganizedCrimes(null, [], $now);
            $emptyCaches = ['bronze' => 0, 'silver' => 0, 'gold' => 0];
            $emptyWar = $this->formatRankedWar(false, null, $emptyCaches, [], $now);
            return [
                'ok' => true,
                'serverTime' => gmdate('c', $now),
                'serverTimeEpoch' => $now,
                'createCost' => FactionService::CREATE_COST_CASH,
                'hasFaction' => false,
                'faction' => null,
                'members' => [],
                'vaultBalance' => 0,
                'respect' => 0,
                'directory' => $directory,
                'respectTree' => $this->formatRespectTree([], 0, false),
                'organizedCrimes' => $emptyOc,
                'organizedCrime' => null,
                'rankedWar' => $emptyWar,
                'activeWar' => null,
                'warCaches' => $emptyCaches,
                'caches' => $emptyCaches,
                'loadout' => $this->formatLoadoutPayload($progState, $catalogItems),
                'player' => $player,
            ];
        }

        $factionId = (string) $membership['faction_id'];
        $role = (string) $membership['role'];
        $state = $this->loadEmpireState($factionId);
        $this->settleExpiredWarIfNeeded($factionId, $state, $playerId, $now);

        // Sync permanent member cap perks (max_nerve / max_life) cleanly if faction tree upgraded.
        if ($this->syncMemberTreeCapPerks($playerId, $factionId, $state['tree'], $progState)) {
            $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
            $player = $this->requirePlayer($playerId);
        }

        $famAccount = $this->ensureFamilyProgression($factionId);
        $respect = (int) $famAccount['respect'];
        $canManageRoles = in_array($role, ['leader', 'co-leader'], true);
        $canOfficerAct = in_array($role, ['leader', 'co-leader', 'officer'], true);

        $rosterRows = $this->database->fetchAll(
            "SELECT m.player_id, m.role, m.joined_at, p.username, p.level, p.city
             FROM faction_members m
             JOIN players p ON p.id = m.player_id
             WHERE m.faction_id = :faction
             ORDER BY CASE m.role WHEN 'leader' THEN 1 WHEN 'co-leader' THEN 2 WHEN 'officer' THEN 3 WHEN 'enforcer' THEN 4 ELSE 5 END ASC,
                      m.joined_at ASC, p.username ASC",
            ['faction' => $factionId],
        );
        $roster = [];
        foreach ($rosterRows as $r) {
            $pid = (string) $r['player_id'];
            $roster[] = [
                'playerId' => $pid,
                'username' => (string) $r['username'],
                'level' => (int) $r['level'],
                'role' => (string) $r['role'],
                'joinedAt' => (string) $r['joined_at'],
                'city' => (string) $r['city'],
                'vaultContributed' => (int) ($state['vaultContributed'][$pid] ?? 0),
                'warHits' => (int) ($state['warHitsByPlayer'][$pid] ?? 0),
            ];
        }

        $ledgerRows = $this->database->fetchAll(
            'SELECT l.player_id, p.username, l.delta, l.balance, l.reason, l.created_at
             FROM family_respect_ledger l
             JOIN players p ON p.id = l.player_id
             WHERE l.faction_id = :faction
             ORDER BY l.created_at DESC, l.id DESC LIMIT 15',
            ['faction' => $factionId],
        );
        $respectLedger = array_map(static fn (array $r): array => [
            'playerId' => (string) $r['player_id'],
            'username' => (string) $r['username'],
            'delta' => (int) $r['delta'],
            'balance' => (int) $r['balance'],
            'reason' => (string) $r['reason'],
            'at' => (string) $r['created_at'],
        ], $ledgerRows);

        $terrRow = $this->database->fetchOne(
            "SELECT COUNT(*) AS total FROM territory_control WHERE faction_id = :faction AND state IN ('owned', 'contested')",
            ['faction' => $factionId],
        );
        $territoryCount = (int) ($terrRow['total'] ?? 0);
        $treeFormatted = $this->formatRespectTree($state['tree'], $respect, $canOfficerAct);
        $maxMembers = 20 + ((int) ($state['tree']['crime_skill'] ?? 0) * 2);
        $ocFormatted = $this->formatOrganizedCrimes($state['activeOc'] ?? null, $state['ocHistory'] ?? [], $now);
        $warFormatted = $this->formatRankedWar(
            (bool) ($state['enlisted'] ?? false),
            is_array($state['activeWar'] ?? null) ? $state['activeWar'] : null,
            is_array($state['caches'] ?? null) ? $state['caches'] : ['bronze' => 0, 'silver' => 0, 'gold' => 0],
            is_array($state['warHistory'] ?? null) ? $state['warHistory'] : [],
            $now,
        );
        $vaultCash = (int) $state['vaultCash'];

        return [
            'ok' => true,
            'serverTime' => gmdate('c', $now),
            'serverTimeEpoch' => $now,
            'createCost' => FactionService::CREATE_COST_CASH,
            'hasFaction' => true,
            'members' => $roster,
            'vaultBalance' => $vaultCash,
            'respect' => $respect,
            'faction' => [
                'id' => $factionId,
                'factionId' => $factionId,
                'nameEn' => (string) $membership['name_en'],
                'nameAr' => (string) $membership['name_ar'],
                'name' => ['en' => (string) $membership['name_en'], 'ar' => (string) $membership['name_ar']],
                'tag' => (string) $state['tag'],
                'tagFormatted' => '[' . $state['tag'] . ']',
                'color' => (string) $membership['color'],
                'manifesto' => (string) $state['manifesto'],
                'recruitmentOpen' => (bool) $state['recruitmentOpen'],
                'isPlayerCreated' => (bool) $state['isPlayerCreated'],
                'role' => $role,
                'respect' => $respect,
                'territoryCount' => $territoryCount,
                'memberCount' => count($roster),
                'maxMembers' => $maxMembers,
                'vaultCash' => $vaultCash,
                'vaultBalance' => $vaultCash,
                'vaultLog' => array_slice(is_array($state['vaultLog'] ?? null) ? $state['vaultLog'] : [], 0, 15),
                'permissions' => [
                    'manageRoles' => $canManageRoles,
                    'kick' => $canManageRoles,
                    'vaultGrant' => $canManageRoles,
                    'upgradeTree' => $canOfficerAct,
                    'startOc' => $canOfficerAct,
                    'manageWar' => $canOfficerAct,
                ],
                'roster' => $roster,
                'members' => $roster,
                'respectLedger' => $respectLedger,
            ],
            'directory' => $directory,
            'respectTree' => $treeFormatted,
            'organizedCrimes' => $ocFormatted,
            'organizedCrime' => $ocFormatted['activeOc'],
            'rankedWar' => $warFormatted,
            'activeWar' => $warFormatted['activeWar'],
            'warCaches' => $warFormatted['caches'],
            'caches' => $warFormatted['caches'],
            'loadout' => $this->formatLoadoutPayload($progState, $catalogItems),
            'player' => $player,
        ];
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Faction Empire action is required.');
        }

        $this->resources->regenerate($playerId);
        $factionSvc = new FactionService($this->database, $this->events);

        // 1. Directory read-through action
        if ($cleanAction === 'faction.directory') {
            $snap = $this->snapshot($playerId);
            return [...$snap, 'result' => ['action' => 'faction.directory', 'count' => count($snap['directory'])]];
        }

        // 2. Loadout actions (available whether affiliated with a faction or solo)
        if (in_array($cleanAction, ['loadout.equipslot', 'loadout.unequipslot', 'loadout.buytacticalarmor'], true)) {
            $res = $this->handleLoadoutAction($playerId, $cleanAction, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        // 3. Faction Founding, Joining, Leaving, Roster Rank & Kick
        if ($cleanAction === 'faction.create') {
            $this->assertActionAvailable($playerId);
            $res = $factionSvc->createFaction(
                $playerId,
                (string) ($payload['nameEn'] ?? $payload['name'] ?? ''),
                (string) ($payload['nameAr'] ?? ''),
                (string) ($payload['tag'] ?? ''),
                (string) ($payload['color'] ?? '#c93b2b'),
                (string) ($payload['manifesto'] ?? $payload['description'] ?? ''),
            );
            return [...$this->snapshot($playerId), 'result' => ['action' => 'faction.create', ...$res]];
        }

        if ($cleanAction === 'faction.join') {
            $this->assertActionAvailable($playerId);
            $targetFactionId = strtolower(trim((string) ($payload['factionId'] ?? $payload['id'] ?? '')));
            $factionSvc->join($playerId, $targetFactionId);
            return [...$this->snapshot($playerId), 'result' => ['action' => 'faction.join', 'factionId' => $targetFactionId]];
        }

        if ($cleanAction === 'faction.leave') {
            $this->assertActionAvailable($playerId);
            $prevFactionId = $factionSvc->playerFactionId($playerId);
            $res = $factionSvc->leave($playerId);
            if ($prevFactionId !== null) {
                $this->clearMemberTreeCapPerks($playerId, $prevFactionId);
            }
            return [...$this->snapshot($playerId), 'result' => ['action' => 'faction.leave', ...$res]];
        }

        if ($cleanAction === 'faction.setrole') {
            $targetId = trim((string) ($payload['targetPlayerId'] ?? $payload['playerId'] ?? $payload['memberId'] ?? ''));
            $newRole = (string) ($payload['role'] ?? '');
            $res = $factionSvc->setRole($playerId, $targetId, $newRole);
            return [...$this->snapshot($playerId), 'result' => ['action' => 'faction.setRole', ...$res]];
        }

        if ($cleanAction === 'faction.kick') {
            $targetId = trim((string) ($payload['targetPlayerId'] ?? $payload['playerId'] ?? $payload['memberId'] ?? ''));
            $res = $factionSvc->kick($playerId, $targetId);
            $this->clearMemberTreeCapPerks($targetId, (string) $res['factionId']);
            return [...$this->snapshot($playerId), 'result' => ['action' => 'faction.kick', ...$res]];
        }

        if ($cleanAction === 'faction.togglerecruitment') {
            $res = $this->handleToggleRecruitment($playerId, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        // 4. Faction Vault Deposit & Grant
        if ($cleanAction === 'faction.vaultdeposit') {
            $this->assertActionAvailable($playerId);
            $res = $this->handleVaultDeposit($playerId, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        if (in_array($cleanAction, ['faction.vaultgrant', 'faction.vaultwithdraw'], true)) {
            $this->assertActionAvailable($playerId);
            $res = $this->handleVaultGrant($playerId, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        // 5. 7-Branch Faction Respect Skill Tree
        if ($cleanAction === 'tree.upgrade') {
            $res = $this->handleTreeUpgrade($playerId, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        // 6. 4-Role Crew Organized Crimes 2.0
        if (in_array($cleanAction, ['oc.create', 'oc.claimslot', 'oc.hirenpc', 'oc.cancel', 'oc.execute'], true)) {
            $res = $this->handleOrganizedCrimeAction($playerId, $cleanAction, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        // 7. Scheduled 48h Ranked Wars & Bonus Weapon Caches
        if (in_array($cleanAction, ['war.enlist', 'war.challenge', 'war.assault', 'war.scorehit', 'war.claimcache', 'war.opencache'], true)) {
            $res = $this->handleRankedWarAction($playerId, $cleanAction, $payload);
            return [...$this->snapshot($playerId), 'result' => $res];
        }

        throw new InvalidArgumentException('Unsupported Faction Empire action: ' . $action);
    }

    public function activeTreeBonusesForPlayer(string $playerId): array
    {
        $membership = $this->playerMembership($playerId);
        if ($membership === null) {
            return [];
        }
        $state = $this->loadEmpireState((string) $membership['faction_id']);
        return $this->computeTreeBonuses(is_array($state['tree'] ?? null) ? $state['tree'] : []);
    }

    /**
     * Automatically called after a real PvP win so warring syndicates score live Ranked War points.
     */
    public function recordPvpWarHit(
        string $attackerId,
        string $defenderId,
        string $approach,
        float $fairFight,
        string $correlationId,
    ): ?array {
        $attMem = $this->playerMembership($attackerId);
        if ($attMem === null) {
            return null;
        }
        $attFactionId = (string) $attMem['faction_id'];
        $defMem = $this->playerMembership($defenderId);
        $defFactionId = $defMem !== null ? (string) $defMem['faction_id'] : null;
        if ($defFactionId !== null && $defFactionId === $attFactionId) {
            return null;
        }

        $now = $this->now();
        return $this->database->transaction(function () use ($attFactionId, $defFactionId, $attackerId, $defenderId, $approach, $fairFight, $correlationId, $now): ?array {
            $this->lockMetaKey(self::META_PREFIX . $attFactionId);
            $state = $this->loadEmpireState($attFactionId);
            $war = $state['activeWar'] ?? null;
            if (!is_array($war) || ($war['status'] ?? '') !== 'active') {
                return null;
            }
            if ((int) ($war['endsAt'] ?? 0) <= $now) {
                $this->settleExpiredWarLocked($attFactionId, $state, $attackerId, $now);
                return null;
            }
            if ($defFactionId !== null && $defFactionId !== (string) ($war['rivalFactionId'] ?? '')) {
                return null;
            }

            $attRow = $this->database->fetchOne('SELECT username FROM players WHERE id = :id', ['id' => $attackerId]);
            $defRow = $this->database->fetchOne('SELECT username FROM players WHERE id = :id', ['id' => $defenderId]);
            $points = max(15, (int) round(($approach === 'hosp' ? 50 : 30) * max(1.0, $fairFight)));

            return $this->applyWarScoreLocked(
                $attFactionId,
                $state,
                $attackerId,
                (string) ($attRow['username'] ?? 'Operative'),
                (string) ($defRow['username'] ?? 'Rival'),
                $points,
                0,
                'pvp.' . $approach,
                $correlationId,
                $now,
            );
        });
    }

    private function handleLoadoutAction(string $playerId, string $cleanAction, array $payload): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $cleanAction, $payload): array {
            $this->assertActionAvailable($playerId);
            $progRow = $this->loadProgressionRow($playerId);
            $progState = $progRow['state'];
            $catalogItems = $this->catalogItems();
            $correlationId = bin2hex(random_bytes(16));

            if ($cleanAction === 'loadout.buytacticalarmor') {
                $pieceId = strtolower(trim((string) ($payload['pieceId'] ?? $payload['itemId'] ?? $payload['id'] ?? 'full_set')));
                $player = $this->requirePlayer($playerId);
                $progState['tacticalArmor'] = is_array($progState['tacticalArmor'] ?? null) ? $progState['tacticalArmor'] : [];

                if ($pieceId === 'full_set' || $pieceId === 'all') {
                    $totalCost = array_sum(array_map(static fn (array $p): int => (int) $p['price'], LoadoutService::TACTICAL_ARMOR_CATALOG));
                    if ((int) $player['cash'] < $totalCost) {
                        throw new RuntimeException('Need $' . number_format($totalCost) . ' cash to purchase the full 5-piece Tactical Armor Set.');
                    }
                    $newCash = (int) $player['cash'] - $totalCost;
                    $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
                    $this->ledger->record($playerId, 'cash', -$totalCost, $newCash, 'loadout.buyTacticalSet', $correlationId);
                    foreach (LoadoutService::TACTICAL_ARMOR_CATALOG as $tid => $spec) {
                        $progState['tacticalArmor'][$tid] = (int) ($progState['tacticalArmor'][$tid] ?? 0) + 1;
                        LoadoutService::equipSlot($progState, $catalogItems, $spec['slot'], $tid);
                    }
                    $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
                    return [
                        'action' => 'loadout.buyTacticalArmor',
                        'purchased' => array_keys(LoadoutService::TACTICAL_ARMOR_CATALOG),
                        'cashDelta' => -$totalCost,
                        'correlationId' => $correlationId,
                    ];
                }

                if (!isset(LoadoutService::TACTICAL_ARMOR_CATALOG[$pieceId])) {
                    throw new InvalidArgumentException('Unknown tactical armor piece: ' . $pieceId);
                }
                $spec = LoadoutService::TACTICAL_ARMOR_CATALOG[$pieceId];
                $cost = (int) $spec['price'];
                if ((int) $player['cash'] < $cost) {
                    throw new RuntimeException('Not enough cash for ' . $spec['nameEn'] . '.');
                }
                $newCash = (int) $player['cash'] - $cost;
                $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
                $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'loadout.buyTactical:' . $pieceId, $correlationId);
                $progState['tacticalArmor'][$pieceId] = (int) ($progState['tacticalArmor'][$pieceId] ?? 0) + 1;
                $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);

                return [
                    'action' => 'loadout.buyTacticalArmor',
                    'pieceId' => $pieceId,
                    'slot' => $spec['slot'],
                    'cashDelta' => -$cost,
                    'correlationId' => $correlationId,
                ];
            }

            $slot = (string) ($payload['slot'] ?? '');
            $itemId = $cleanAction === 'loadout.unequipslot'
                ? null
                : (array_key_exists('itemId', $payload) ? ($payload['itemId'] === null ? null : (string) $payload['itemId']) : (isset($payload['id']) ? (string) $payload['id'] : null));

            $resolved = LoadoutService::equipSlot($progState, $catalogItems, $slot, $itemId);
            if (!empty($payload['makeActive']) && in_array(strtolower(trim($slot)), LoadoutService::WEAPON_SLOTS, true)) {
                $progState['tornCombat'] = is_array($progState['tornCombat'] ?? null) ? $progState['tornCombat'] : ['hitbox' => 'head', 'ammo' => 'hp', 'slot' => 'primary'];
                $progState['tornCombat']['slot'] = strtolower(trim($slot)) === 'temporary' ? 'temp' : strtolower(trim($slot));
                $resolved = LoadoutService::resolve($progState, $catalogItems);
            }
            $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);

            $this->events->publish(new DomainEvent('LoadoutSlotChanged', [
                'playerId' => $playerId,
                'slot' => strtolower(trim($slot)),
                'itemId' => $itemId,
                'weaponMultiplier' => $resolved['weaponMultiplier'],
                'armorReduction' => $resolved['armorReduction'],
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'loadout.equipSlot',
                'slot' => strtolower(trim($slot)),
                'itemId' => $itemId,
                'weaponMultiplier' => $resolved['weaponMultiplier'],
                'armorReduction' => $resolved['armorReduction'],
                'equippedSlotsCount' => $resolved['equippedSlotsCount'],
                'correlationId' => $correlationId,
            ];
        });
    }

    private function handleToggleRecruitment(string $playerId, array $payload): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $payload): array {
            $membership = $this->requireFactionMembership($playerId);
            if (!in_array((string) $membership['role'], ['leader', 'co-leader'], true)) {
                throw new RuntimeException('Only the Faction Leader or Co-Leader can toggle open recruitment.');
            }
            $factionId = (string) $membership['faction_id'];
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $open = array_key_exists('open', $payload) ? (bool) $payload['open'] : !(bool) ($state['recruitmentOpen'] ?? true);
            $state['recruitmentOpen'] = $open;
            if (isset($payload['manifesto']) && is_string($payload['manifesto'])) {
                $chars = preg_split('//u', trim($payload['manifesto']), -1, PREG_SPLIT_NO_EMPTY);
                $cleanManifesto = is_array($chars) ? implode('', array_slice($chars, 0, 280)) : substr(trim($payload['manifesto']), 0, 280);
                if ($cleanManifesto !== '') {
                    $state['manifesto'] = $cleanManifesto;
                }
            }
            $this->saveEmpireState($factionId, $state);
            return ['action' => 'faction.toggleRecruitment', 'factionId' => $factionId, 'recruitmentOpen' => $open];
        });
    }

    private function handleVaultDeposit(string $playerId, array $payload): array
    {
        $amount = $this->parsePositiveAmount($payload['amount'] ?? null, 1_000_000_000, 'Vault deposit amount');
        return $this->database->playerTransaction($playerId, function () use ($playerId, $amount): array {
            $membership = $this->requireFactionMembership($playerId);
            $factionId = (string) $membership['faction_id'];
            $player = $this->requirePlayer($playerId);
            if ((int) $player['cash'] < $amount) {
                throw new RuntimeException('Not enough cash on hand to deposit into the Faction Vault.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $amount;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
            $this->ledger->record($playerId, 'cash', -$amount, $newCash, 'faction.vault.deposit', $correlationId);

            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $state['vaultCash'] = (int) ($state['vaultCash'] ?? 0) + $amount;
            $state['vaultContributed'][$playerId] = (int) ($state['vaultContributed'][$playerId] ?? 0) + $amount;
            $this->prependLog($state, 'vaultLog', [
                'type' => 'deposit',
                'playerId' => $playerId,
                'username' => (string) $player['username'],
                'amount' => $amount,
                'vaultBalanceAfter' => $state['vaultCash'],
                'at' => gmdate('c', $this->now()),
            ]);
            $this->saveEmpireState($factionId, $state);

            $this->events->publish(new DomainEvent('FactionVaultDeposited', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                'amount' => $amount,
                'vaultBalance' => $state['vaultCash'],
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'faction.vaultDeposit',
                'factionId' => $factionId,
                'amount' => $amount,
                'cashDelta' => -$amount,
                'vaultCash' => $state['vaultCash'],
                'correlationId' => $correlationId,
            ];
        });
    }

    private function handleVaultGrant(string $playerId, array $payload): array
    {
        $amount = $this->parsePositiveAmount($payload['amount'] ?? null, 1_000_000_000, 'Vault grant amount');
        $targetPlayerId = trim((string) ($payload['targetPlayerId'] ?? $payload['playerId'] ?? $playerId));
        if ($targetPlayerId === '') {
            $targetPlayerId = $playerId;
        }
        $ids = array_values(array_unique([$playerId, $targetPlayerId]));
        sort($ids, SORT_STRING);

        return $this->database->playersTransaction($ids, function () use ($playerId, $targetPlayerId, $amount): array {
            $membership = $this->requireFactionMembership($playerId);
            if (!in_array((string) $membership['role'], ['leader', 'co-leader'], true)) {
                throw new RuntimeException('Only the Faction Leader or Co-Leader can grant funds from the Faction Vault.');
            }
            $factionId = (string) $membership['faction_id'];
            $targetMem = $this->database->fetchOne(
                'SELECT faction_id FROM faction_members WHERE player_id = :id',
                ['id' => $targetPlayerId],
            );
            if ($targetMem === null || (string) $targetMem['faction_id'] !== $factionId) {
                throw new RuntimeException('Vault funds can only be granted to an active member of your faction.');
            }
            $recipient = $this->requirePlayer($targetPlayerId);
            $actor = $this->requirePlayer($playerId);

            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $vaultCash = (int) ($state['vaultCash'] ?? 0);
            if ($vaultCash < $amount) {
                throw new RuntimeException('Insufficient funds in the Faction Vault.');
            }

            $correlationId = bin2hex(random_bytes(16));
            $state['vaultCash'] = $vaultCash - $amount;
            $newRecipientCash = (int) $recipient['cash'] + $amount;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newRecipientCash, 'id' => $targetPlayerId]);
            $this->ledger->record($targetPlayerId, 'cash', $amount, $newRecipientCash, 'faction.vault.grant', $correlationId);

            $this->prependLog($state, 'vaultLog', [
                'type' => 'grant',
                'actorId' => $playerId,
                'actorName' => (string) $actor['username'],
                'targetPlayerId' => $targetPlayerId,
                'targetName' => (string) $recipient['username'],
                'amount' => $amount,
                'vaultBalanceAfter' => $state['vaultCash'],
                'at' => gmdate('c', $this->now()),
            ]);
            $this->saveEmpireState($factionId, $state);

            $this->events->publish(new DomainEvent('FactionVaultGranted', [
                'factionId' => $factionId,
                'actorId' => $playerId,
                'targetPlayerId' => $targetPlayerId,
                'amount' => $amount,
                'vaultBalance' => $state['vaultCash'],
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'faction.vaultGrant',
                'factionId' => $factionId,
                'targetPlayerId' => $targetPlayerId,
                'amount' => $amount,
                'vaultCash' => $state['vaultCash'],
                'correlationId' => $correlationId,
            ];
        });
    }

    private function handleTreeUpgrade(string $playerId, array $payload): array
    {
        $rawBranch = strtolower(trim((string) ($payload['branch'] ?? '')));
        $rawNode = strtolower(trim((string) ($payload['nodeId'] ?? $payload['upgradeId'] ?? $payload['id'] ?? '')));
        if (str_contains($rawNode, '.')) {
            [$prefixBranch, $suffixNode] = explode('.', $rawNode, 2);
            if ($rawBranch === '') {
                $rawBranch = $prefixBranch;
            }
            $rawNode = $suffixNode;
        }
        [$branch, $nodeId, $nodeDef] = $this->resolveTreeNode($rawBranch, $rawNode);

        return $this->database->playerTransaction($playerId, function () use ($playerId, $branch, $nodeId, $nodeDef): array {
            $membership = $this->requireFactionMembership($playerId);
            $role = (string) $membership['role'];
            if (!in_array($role, ['leader', 'co-leader', 'officer'], true)) {
                throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can upgrade the Respect Skill Tree.');
            }
            $factionId = (string) $membership['faction_id'];
            $this->ensureFamilyProgression($factionId);
            $famRow = $this->database->fetchOne(
                'SELECT * FROM family_progression WHERE faction_id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);

            $currentTier = max(0, min(5, (int) ($state['tree'][$nodeId] ?? 0)));
            if ($currentTier >= 5) {
                throw new RuntimeException($nodeDef['nameEn'] . ' is already at maximum Tier 5.');
            }
            $cost = (int) ($nodeDef['baseCost'] * ($currentTier + 1));
            $availableRespect = (int) ($famRow['respect'] ?? 0);
            if ($availableRespect < $cost) {
                throw new RuntimeException(sprintf('Need %d shared Faction Respect to unlock %s Tier %d (have %d).', $cost, $nodeDef['nameEn'], $currentTier + 1, $availableRespect));
            }

            $newTier = $currentTier + 1;
            $newRespect = $availableRespect - $cost;
            $upgrades = json_decode((string) ($famRow['upgrades_json'] ?? '{}'), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($upgrades)) {
                $upgrades = [];
            }
            $upgrades['tree:' . $nodeId] = $newTier;

            $correlationId = bin2hex(random_bytes(16));
            $nowIso = gmdate('c', $this->now());
            $this->database->execute(
                'UPDATE family_progression SET respect = :respect, upgrades_json = :upgrades, version = version + 1, updated_at = :at WHERE faction_id = :id',
                [
                    'respect' => $newRespect,
                    'upgrades' => json_encode($upgrades, JSON_THROW_ON_ERROR),
                    'at' => $nowIso,
                    'id' => $factionId,
                ],
            );
            $this->database->execute(
                'INSERT INTO family_respect_ledger (id, faction_id, player_id, delta, balance, reason, correlation_id, created_at)
                 VALUES (:id, :family, :player, :delta, :balance, :reason, :correlation, :at)',
                [
                    'id' => bin2hex(random_bytes(16)),
                    'family' => $factionId,
                    'player' => $playerId,
                    'delta' => -$cost,
                    'balance' => $newRespect,
                    'reason' => 'tree.' . $branch . '.' . $nodeId,
                    'correlation' => $correlationId,
                    'at' => $nowIso,
                ],
            );

            $state['tree'][$nodeId] = $newTier;
            $this->saveEmpireState($factionId, $state);

            // Immediately sync max_nerve / max_life onto the acting officer/leader.
            $progRow = $this->loadProgressionRow($playerId);
            $progState = $progRow['state'];
            if ($this->syncMemberTreeCapPerks($playerId, $factionId, $state['tree'], $progState)) {
                $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
            }

            $this->events->publish(new DomainEvent('FactionTreeUpgraded', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                'branch' => $branch,
                'nodeId' => $nodeId,
                'tier' => $newTier,
                'costRespect' => $cost,
                'respectAfter' => $newRespect,
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'tree.upgrade',
                'factionId' => $factionId,
                'branch' => $branch,
                'nodeId' => $nodeId,
                'tier' => $newTier,
                'costRespect' => $cost,
                'respectAfter' => $newRespect,
                'correlationId' => $correlationId,
            ];
        });
    }

    private function handleOrganizedCrimeAction(string $playerId, string $cleanAction, array $payload): array
    {
        if ($cleanAction === 'oc.execute') {
            return $this->executeOrganizedCrime($playerId, $payload);
        }

        return $this->database->playerTransaction($playerId, function () use ($playerId, $cleanAction, $payload): array {
            $this->assertActionAvailable($playerId);
            $membership = $this->requireFactionMembership($playerId);
            $factionId = (string) $membership['faction_id'];
            $role = (string) $membership['role'];
            $isOfficer = in_array($role, ['leader', 'co-leader', 'officer'], true);
            $player = $this->requirePlayer($playerId);
            $now = $this->now();

            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);

            if ($cleanAction === 'oc.create') {
                if (!$isOfficer) {
                    throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can plan a Crew Organized Crime.');
                }
                if (is_array($state['activeOc'] ?? null)) {
                    throw new RuntimeException('Complete or cancel the active Crew Organized Crime before planning a new one.');
                }
                $heistId = strtolower(trim((string) ($payload['heistId'] ?? $payload['crimeId'] ?? $payload['id'] ?? 'armored_van')));
                if (!isset(self::CREW_HEISTS[$heistId])) {
                    throw new InvalidArgumentException('Unknown Crew Organized Crime heist: ' . $heistId);
                }
                $def = self::CREW_HEISTS[$heistId];
                $oc = [
                    'id' => 'oc-' . bin2hex(random_bytes(6)),
                    'heistId' => $heistId,
                    'nameEn' => $def['nameEn'],
                    'nameAr' => $def['nameAr'],
                    'createdBy' => $playerId,
                    'createdAt' => $now,
                    'readyAt' => $now + (int) $def['planningSeconds'],
                    'slots' => [
                        'mastermind' => null,
                        'hacker' => null,
                        'muscle' => null,
                        'driver' => null,
                    ],
                ];
                if (!empty($payload['hireNpcFillers'])) {
                    $oc['slots']['mastermind'] = [
                        'playerId' => $playerId,
                        'username' => (string) $player['username'],
                        'level' => (int) $player['level'],
                        'isNpc' => false,
                        'cutPct' => 0,
                    ];
                    foreach (['hacker', 'muscle', 'driver'] as $npcSlot) {
                        $oc['slots'][$npcSlot] = $this->makeNpcFiller($npcSlot);
                    }
                }
                $state['activeOc'] = $oc;
                $this->saveEmpireState($factionId, $state);
                return [
                    'action' => 'oc.create',
                    'ocId' => $oc['id'],
                    'heistId' => $heistId,
                    'readyAt' => $oc['readyAt'],
                ];
            }

            if ($cleanAction === 'oc.cancel') {
                if (!$isOfficer) {
                    throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can cancel an active Organized Crime.');
                }
                if (!is_array($state['activeOc'] ?? null)) {
                    throw new RuntimeException('No active Crew Organized Crime to cancel.');
                }
                $cancelledId = (string) $state['activeOc']['id'];
                $state['activeOc'] = null;
                $this->saveEmpireState($factionId, $state);
                return ['action' => 'oc.cancel', 'cancelledOcId' => $cancelledId];
            }

            // oc.claimSlot or oc.hireNpc
            if (!is_array($state['activeOc'] ?? null)) {
                throw new RuntimeException('Plan a Crew Organized Crime first before claiming crew slots.');
            }
            $oc = $state['activeOc'];
            $slot = strtolower(trim((string) ($payload['slot'] ?? $payload['role'] ?? '')));
            $hireNpc = $cleanAction === 'oc.hirenpc' || !empty($payload['npc']) || !empty($payload['hireNpc']);

            if ($hireNpc) {
                if (!$isOfficer) {
                    throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can hire NPC Crew Specialists.');
                }
                $targetSlots = ($slot === '' || $slot === 'all') ? array_keys(self::CREW_SLOTS) : [$slot];
                $hired = [];
                foreach ($targetSlots as $ts) {
                    if (!isset(self::CREW_SLOTS[$ts])) {
                        throw new InvalidArgumentException('Invalid crew slot: ' . $ts);
                    }
                    if ($oc['slots'][$ts] === null) {
                        $oc['slots'][$ts] = $this->makeNpcFiller($ts);
                        $hired[] = $ts;
                    }
                }
                if ($hired === []) {
                    throw new RuntimeException('Requested crew slot(s) are already filled.');
                }
                $state['activeOc'] = $oc;
                $this->saveEmpireState($factionId, $state);
                return [
                    'action' => 'oc.claimSlot',
                    'ocId' => $oc['id'],
                    'hiredNpcSlots' => $hired,
                    'npcCutPerSlotPct' => self::NPC_FILLER_CUT_PCT,
                ];
            }

            if (!isset(self::CREW_SLOTS[$slot])) {
                throw new InvalidArgumentException('Choose a valid crew slot: mastermind, hacker, muscle, or driver.');
            }
            $existing = $oc['slots'][$slot] ?? null;
            if (is_array($existing) && empty($existing['isNpc']) && ($existing['playerId'] ?? '') !== $playerId) {
                throw new RuntimeException('That crew slot is already claimed by ' . ($existing['username'] ?? 'another member') . '.');
            }

            // Clear any previous human slot held by this same player so 1 human = 1 role.
            foreach (array_keys(self::CREW_SLOTS) as $sKey) {
                $holder = $oc['slots'][$sKey] ?? null;
                if (is_array($holder) && empty($holder['isNpc']) && ($holder['playerId'] ?? '') === $playerId) {
                    $oc['slots'][$sKey] = null;
                }
            }

            $oc['slots'][$slot] = [
                'playerId' => $playerId,
                'username' => (string) $player['username'],
                'level' => (int) $player['level'],
                'isNpc' => false,
                'cutPct' => 0,
            ];
            $state['activeOc'] = $oc;
            $this->saveEmpireState($factionId, $state);

            return [
                'action' => 'oc.claimSlot',
                'ocId' => $oc['id'],
                'slot' => $slot,
                'playerId' => $playerId,
            ];
        });
    }

    private function executeOrganizedCrime(string $playerId, array $payload): array
    {
        $membershipHint = $this->requireFactionMembership($playerId);
        $factionIdHint = (string) $membershipHint['faction_id'];
        $stateHint = $this->loadEmpireState($factionIdHint);
        $ocHint = $stateHint['activeOc'] ?? null;
        if (!is_array($ocHint)) {
            throw new RuntimeException('No active Crew Organized Crime to execute.');
        }

        $participantIds = [$playerId];
        foreach (($ocHint['slots'] ?? []) as $holder) {
            if (is_array($holder) && empty($holder['isNpc']) && !empty($holder['playerId'])) {
                $participantIds[] = (string) $holder['playerId'];
            }
        }
        $participantIds = array_values(array_unique($participantIds));
        sort($participantIds, SORT_STRING);

        return $this->database->playersTransaction($participantIds, function () use ($playerId, $payload, $participantIds): array {
            $this->assertActionAvailable($playerId);
            $membership = $this->requireFactionMembership($playerId);
            $factionId = (string) $membership['faction_id'];
            $role = (string) $membership['role'];
            $isOfficer = in_array($role, ['leader', 'co-leader', 'officer'], true);
            $now = $this->now();

            $this->ensureFamilyProgression($factionId);
            $famRow = $this->database->fetchOne(
                'SELECT * FROM family_progression WHERE faction_id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $oc = $state['activeOc'] ?? null;
            if (!is_array($oc)) {
                throw new RuntimeException('No active Crew Organized Crime to execute.');
            }

            if ((!empty($payload['autoHireNpc']) || !empty($payload['hireNpc']) || !empty($payload['fillWithNpc'])) && $isOfficer) {
                foreach (array_keys(self::CREW_SLOTS) as $sKey) {
                    if ($oc['slots'][$sKey] === null) {
                        $oc['slots'][$sKey] = $this->makeNpcFiller($sKey);
                    }
                }
            }

            $humanCrewIds = [];
            $npcCount = 0;
            foreach (array_keys(self::CREW_SLOTS) as $sKey) {
                $holder = $oc['slots'][$sKey] ?? null;
                if (!is_array($holder)) {
                    throw new RuntimeException('All 4 crew roles (mastermind, hacker, muscle, driver) must be filled before executing.');
                }
                if (!empty($holder['isNpc'])) {
                    $npcCount++;
                } else {
                    $hid = (string) $holder['playerId'];
                    if (!in_array($hid, $participantIds, true)) {
                        throw new RuntimeException('Crew roster changed while locking participants. Refresh and execute again.');
                    }
                    $stillMember = $this->database->fetchOne(
                        'SELECT faction_id FROM faction_members WHERE player_id = :id',
                        ['id' => $hid],
                    );
                    if ($stillMember === null || (string) $stillMember['faction_id'] !== $factionId) {
                        throw new RuntimeException('A human crew member left the faction before heist execution.');
                    }
                    $humanCrewIds[] = $hid;
                }
            }

            if (!$isOfficer && !in_array($playerId, $humanCrewIds, true)) {
                throw new RuntimeException('Only a Faction Officer+ or assigned Crew Member can trigger heist execution.');
            }

            $readyAt = (int) ($oc['readyAt'] ?? 0);
            if ($now < $readyAt) {
                throw new RuntimeException(sprintf('Crew heist planning is still in progress (%ds remaining).', $readyAt - $now));
            }

            $heistId = (string) $oc['heistId'];
            $def = self::CREW_HEISTS[$heistId] ?? self::CREW_HEISTS['armored_van'];
            $bonuses = $this->computeTreeBonuses($state['tree']);
            $payoutMult = 1.0 + (((float) ($bonuses['ocPayoutPct'] ?? 0)) / 100.0);

            $grossCash = (int) round($def['cashBase'] * $payoutMult);
            $npcCutPct = min(80, $npcCount * self::NPC_FILLER_CUT_PCT);
            $npcCutCash = (int) floor($grossCash * $npcCutPct / 100);
            $netCash = max(0, $grossCash - $npcCutCash);

            $vaultSplitPct = array_key_exists('vaultSplitPct', $payload)
                ? max(0, min(100, (int) $payload['vaultSplitPct']))
                : ($humanCrewIds === [] ? 100 : 40);
            $vaultShare = (int) floor($netCash * $vaultSplitPct / 100);
            $crewPool = $netCash - $vaultShare;

            $correlationId = bin2hex(random_bytes(16));
            $memberPayouts = [];
            if ($humanCrewIds !== [] && $crewPool > 0) {
                $uniqueHumans = array_values(array_unique($humanCrewIds));
                $perMember = intdiv($crewPool, count($uniqueHumans));
                $remainder = $crewPool - ($perMember * count($uniqueHumans));
                $vaultShare += $remainder;

                foreach ($uniqueHumans as $hid) {
                    if ($perMember <= 0) {
                        continue;
                    }
                    $this->database->execute('UPDATE players SET cash = cash + :share WHERE id = :id', ['share' => $perMember, 'id' => $hid]);
                    $pRow = $this->database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => $hid]);
                    $this->ledger->record($hid, 'cash', $perMember, (int) ($pRow['cash'] ?? 0), 'faction.oc.payout', $correlationId);
                    $memberPayouts[$hid] = $perMember;
                }
            } else {
                $vaultShare = $netCash;
            }

            $state['vaultCash'] = (int) ($state['vaultCash'] ?? 0) + $vaultShare;
            $respectEarned = max(1, (int) round($def['respectReward'] * $payoutMult));
            $newRespect = (int) ($famRow['respect'] ?? 0) + $respectEarned;
            $nowIso = gmdate('c', $now);

            $this->database->execute(
                'UPDATE family_progression SET respect = :respect, version = version + 1, updated_at = :at WHERE faction_id = :id',
                ['respect' => $newRespect, 'at' => $nowIso, 'id' => $factionId],
            );
            $this->database->execute(
                'INSERT INTO family_respect_ledger (id, faction_id, player_id, delta, balance, reason, correlation_id, created_at)
                 VALUES (:id, :family, :player, :delta, :balance, :reason, :correlation, :at)',
                [
                    'id' => bin2hex(random_bytes(16)),
                    'family' => $factionId,
                    'player' => $playerId,
                    'delta' => $respectEarned,
                    'balance' => $newRespect,
                    'reason' => 'oc.' . $heistId,
                    'correlation' => $correlationId,
                    'at' => $nowIso,
                ],
            );

            $historyEntry = [
                'ocId' => $oc['id'],
                'heistId' => $heistId,
                'nameEn' => $def['nameEn'],
                'nameAr' => $def['nameAr'],
                'grossCash' => $grossCash,
                'npcSlotsCount' => $npcCount,
                'npcCutCash' => $npcCutCash,
                'vaultCashAdded' => $vaultShare,
                'memberPayouts' => $memberPayouts,
                'respectAwarded' => $respectEarned,
                'executedAt' => $nowIso,
            ];
            $this->prependLog($state, 'ocHistory', $historyEntry);
            $state['activeOc'] = null;
            $this->saveEmpireState($factionId, $state);

            $this->events->publish(new DomainEvent('FactionOrganizedCrimeExecuted', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                ...$historyEntry,
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'oc.execute',
                'success' => true,
                ...$historyEntry,
                'correlationId' => $correlationId,
            ];
        });
    }

    private function handleRankedWarAction(string $playerId, string $cleanAction, array $payload): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $cleanAction, $payload): array {
            $this->assertActionAvailable($playerId);
            $membership = $this->requireFactionMembership($playerId);
            $factionId = (string) $membership['faction_id'];
            $role = (string) $membership['role'];
            $isOfficer = in_array($role, ['leader', 'co-leader', 'officer'], true);
            $player = $this->requirePlayer($playerId);
            $now = $this->now();
            $correlationId = bin2hex(random_bytes(16));

            $this->ensureFamilyProgression($factionId);
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $this->settleExpiredWarLocked($factionId, $state, $playerId, $now);

            if ($cleanAction === 'war.enlist') {
                if (!$isOfficer) {
                    throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can enlist in Ranked Wars.');
                }
                $enlisted = array_key_exists('enlisted', $payload) ? (bool) $payload['enlisted'] : true;
                $state['enlisted'] = $enlisted;
                $this->saveEmpireState($factionId, $state);
                return [
                    'action' => 'war.enlist',
                    'factionId' => $factionId,
                    'enlisted' => $enlisted,
                    'correlationId' => $correlationId,
                ];
            }

            if ($cleanAction === 'war.challenge') {
                if (!$isOfficer) {
                    throw new RuntimeException('Only a Faction Leader, Co-Leader, or Officer can declare a Ranked War.');
                }
                if (is_array($state['activeWar'] ?? null) && ($state['activeWar']['status'] ?? '') === 'active') {
                    throw new RuntimeException('Your faction is already engaged in an active Ranked War.');
                }

                $rivalId = strtolower(trim((string) ($payload['rivalFactionId'] ?? $payload['targetFactionId'] ?? $payload['factionId'] ?? '')));
                if ($rivalId === '' || $rivalId === $factionId) {
                    $candidate = $this->database->fetchOne(
                        'SELECT f.id, f.name_en, f.name_ar FROM factions f
                         LEFT JOIN family_progression fp ON fp.faction_id = f.id
                         WHERE f.enabled = 1 AND f.id <> :own
                         ORDER BY COALESCE(fp.respect, 0) DESC, f.id ASC LIMIT 1',
                        ['own' => $factionId],
                    );
                    if ($candidate === null) {
                        throw new RuntimeException('No rival active faction is available to challenge.');
                    }
                    $rivalRow = $candidate;
                } else {
                    $rivalRow = $this->database->fetchOne(
                        'SELECT id, name_en, name_ar FROM factions WHERE id = :id AND enabled = 1',
                        ['id' => $rivalId],
                    );
                    if ($rivalRow === null) {
                        throw new InvalidArgumentException('Unknown rival faction: ' . $rivalId);
                    }
                }

                $resolvedRivalId = (string) $rivalRow['id'];
                $rivalState = $this->loadEmpireState($resolvedRivalId);
                $targetLead = isset($payload['targetLead'])
                    ? max(100, min(2000, (int) $payload['targetLead']))
                    : self::WAR_TARGET_LEAD;

                $war = [
                    'warId' => 'rw-' . bin2hex(random_bytes(6)),
                    'status' => 'active',
                    'ourFactionId' => $factionId,
                    'rivalFactionId' => $resolvedRivalId,
                    'rivalNameEn' => (string) $rivalRow['name_en'],
                    'rivalNameAr' => (string) $rivalRow['name_ar'],
                    'rivalTag' => (string) ($rivalState['tag'] ?? strtoupper(substr($resolvedRivalId, 0, 4))),
                    'ourScore' => 0,
                    'theirScore' => 0,
                    'targetLead' => $targetLead,
                    'startedAt' => $now,
                    'endsAt' => $now + self::WAR_DURATION_SECONDS,
                    'milestonesAwarded' => [],
                    'recentHits' => [],
                ];
                $state['enlisted'] = true;
                $state['activeWar'] = $war;
                $this->saveEmpireState($factionId, $state);

                $this->events->publish(new DomainEvent('RankedWarDeclared', [
                    'warId' => $war['warId'],
                    'factionId' => $factionId,
                    'rivalFactionId' => $resolvedRivalId,
                    'targetLead' => $targetLead,
                    'endsAt' => $war['endsAt'],
                    'correlationId' => $correlationId,
                ]));

                return [
                    'action' => 'war.challenge',
                    ...$war,
                    'correlationId' => $correlationId,
                ];
            }

            if (in_array($cleanAction, ['war.assault', 'war.scorehit'], true)) {
                $war = $state['activeWar'] ?? null;
                if (!is_array($war) || ($war['status'] ?? '') !== 'active') {
                    throw new RuntimeException('Enlist and challenge a rival syndicate to start an active Ranked War first.');
                }
                if ((int) $player['energy'] < self::WAR_ASSAULT_ENERGY) {
                    throw new RuntimeException('Need 25 Energy to launch a Ranked War assault.');
                }
                if ((int) $player['life'] < 1) {
                    throw new RuntimeException('Recover Life before entering a Ranked War assault.');
                }

                $progRow = $this->loadProgressionRow($playerId);
                $progState = $progRow['state'];
                $loadout = LoadoutService::resolve($progState, $this->catalogItems());
                $treeBonuses = $this->computeTreeBonuses($state['tree']);
                $perks = $loadout['perkModifiers'];

                $totalStats = max(10, (int) $player['strength'] + (int) $player['defense'] + (int) $player['speed'] + (int) $player['dexterity']);
                $dmgMult = $loadout['weaponMultiplier'] * (1.0 + ((float) ($treeBonuses['combatDamagePct'] ?? 0)) / 100.0);
                $baseWarPoints = max(45, min(180, (int) round(45 + log10($totalStats) * 20 + ($dmgMult - 1.0) * 14)));
                if ($perks['executeHpPct'] > 0) {
                    $baseWarPoints += 20;
                }
                $rivalCounter = $this->roll(5, 22);

                $plunderCash = (int) round((3500 + (int) $player['level'] * 250) * (1.0 + ($perks['plunderPct'] / 100.0)));
                $healLife = $perks['bloodlustHealPct'] > 0
                    ? min((int) $player['max_life'] - (int) $player['life'], max(0, (int) round((int) $player['max_life'] * ($perks['bloodlustHealPct'] / 100.0))))
                    : 0;

                $newEnergy = (int) $player['energy'] - self::WAR_ASSAULT_ENERGY;
                $newCash = (int) $player['cash'] + $plunderCash;
                $newLife = min((int) $player['max_life'], (int) $player['life'] + $healLife);
                $xpGain = 20 + (int) $player['level'];

                $this->database->execute(
                    'UPDATE players SET energy = :energy, cash = :cash, life = :life, xp = xp + :xp WHERE id = :id',
                    ['energy' => $newEnergy, 'cash' => $newCash, 'life' => $newLife, 'xp' => $xpGain, 'id' => $playerId],
                );
                $this->ledger->record($playerId, 'cash', $plunderCash, $newCash, 'faction.war.assault', $correlationId);
                (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);

                $scored = $this->applyWarScoreLocked(
                    $factionId,
                    $state,
                    $playerId,
                    (string) $player['username'],
                    (string) ($war['rivalNameEn'] ?? 'Rival Vanguard'),
                    $baseWarPoints,
                    $rivalCounter,
                    'war.assault',
                    $correlationId,
                    $now,
                    $perks['warlordRespectPct'],
                );

                return [
                    'action' => $cleanAction === 'war.scorehit' ? 'war.scoreHit' : 'war.assault',
                    'energySpent' => self::WAR_ASSAULT_ENERGY,
                    'cashDelta' => $plunderCash,
                    'lifeHealed' => $healLife,
                    'activePerksApplied' => $perks,
                    ...$scored,
                    'correlationId' => $correlationId,
                ];
            }

            // war.claimCache / war.openCache
            $requestedTier = strtolower(trim((string) ($payload['cacheType'] ?? $payload['tier'] ?? $payload['id'] ?? '')));
            if ($requestedTier !== '' && !isset(self::RW_CACHE_DEFINITIONS[$requestedTier])) {
                throw new InvalidArgumentException('Choose a valid Ranked War Cache: bronze, silver, or gold.');
            }
            if ($requestedTier === '' || ((int) ($state['caches'][$requestedTier] ?? 0) < 1 && empty($payload['strict']))) {
                foreach (['gold', 'silver', 'bronze'] as $candidateTier) {
                    if ((int) ($state['caches'][$candidateTier] ?? 0) > 0) {
                        $requestedTier = $candidateTier;
                        break;
                    }
                }
            }
            if ($requestedTier === '' || !isset(self::RW_CACHE_DEFINITIONS[$requestedTier])) {
                throw new RuntimeException('No Ranked War Caches available to claim.');
            }
            if ((int) ($state['caches'][$requestedTier] ?? 0) < 1) {
                throw new RuntimeException('No ' . self::RW_CACHE_DEFINITIONS[$requestedTier]['nameEn'] . ' available to claim.');
            }

            $state['caches'][$requestedTier] = (int) $state['caches'][$requestedTier] - 1;
            $bonusWeapon = $this->rollBonusWeapon($requestedTier, $now);

            $progRow = $this->loadProgressionRow($playerId);
            $progState = $progRow['state'];
            $progState['rwWeapons'] = is_array($progState['rwWeapons'] ?? null) ? $progState['rwWeapons'] : [];
            $progState['rwWeapons'][$bonusWeapon['id']] = $bonusWeapon;
            $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
            $this->ledger->record($playerId, 'rw:' . $bonusWeapon['id'], 1, 1, 'faction.war.cache:' . $requestedTier, $correlationId);

            $this->saveEmpireState($factionId, $state);

            $this->events->publish(new DomainEvent('RankedWarCacheClaimed', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                'cacheType' => $requestedTier,
                'bonusWeapon' => $bonusWeapon,
                'correlationId' => $correlationId,
            ]));

            return [
                'action' => 'war.claimCache',
                'cacheType' => $requestedTier,
                'cachesRemaining' => $state['caches'],
                'bonusWeapon' => $bonusWeapon,
                'correlationId' => $correlationId,
            ];
        });
    }

    private function applyWarScoreLocked(
        string $factionId,
        array &$state,
        string $playerId,
        string $username,
        string $targetLabel,
        int $ourDelta,
        int $theirDelta,
        string $source,
        string $correlationId,
        int $now,
        int $warlordBonusPct = 0,
    ): array {
        $war = $state['activeWar'];
        $war['ourScore'] = (int) ($war['ourScore'] ?? 0) + $ourDelta;
        $war['theirScore'] = max(0, (int) ($war['theirScore'] ?? 0) + $theirDelta);
        $lead = $war['ourScore'] - $war['theirScore'];
        $targetLead = max(100, (int) ($war['targetLead'] ?? self::WAR_TARGET_LEAD));

        $state['warHitsByPlayer'][$playerId] = (int) ($state['warHitsByPlayer'][$playerId] ?? 0) + 1;
        $hitRecord = [
            'playerId' => $playerId,
            'username' => $username,
            'target' => $targetLabel,
            'points' => $ourDelta,
            'source' => $source,
            'at' => gmdate('c', $now),
        ];
        $recentHits = is_array($war['recentHits'] ?? null) ? $war['recentHits'] : [];
        array_unshift($recentHits, $hitRecord);
        $war['recentHits'] = array_slice($recentHits, 0, 15);

        $cachesAwarded = [];
        $milestones = is_array($war['milestonesAwarded'] ?? null) ? $war['milestonesAwarded'] : [];
        if ($war['ourScore'] >= 100 && !in_array('bronze_100', $milestones, true)) {
            $milestones[] = 'bronze_100';
            $state['caches']['bronze'] = (int) ($state['caches']['bronze'] ?? 0) + 1;
            $cachesAwarded[] = 'bronze';
        }
        if ($war['ourScore'] >= 250 && !in_array('silver_250', $milestones, true)) {
            $milestones[] = 'silver_250';
            $state['caches']['silver'] = (int) ($state['caches']['silver'] ?? 0) + 1;
            $cachesAwarded[] = 'silver';
        }
        $war['milestonesAwarded'] = $milestones;

        $baseRespect = max(12, (int) round($ourDelta * 0.4));
        $respectAwarded = (int) round($baseRespect * (1.0 + ($warlordBonusPct / 100.0)));
        $warWon = false;

        if ($lead >= $targetLead) {
            $warWon = true;
            $respectAwarded += 250;
            $state['caches']['gold'] = (int) ($state['caches']['gold'] ?? 0) + 1;
            $state['caches']['silver'] = (int) ($state['caches']['silver'] ?? 0) + 1;
            $state['caches']['bronze'] = (int) ($state['caches']['bronze'] ?? 0) + 1;
            array_push($cachesAwarded, 'gold', 'silver', 'bronze');

            $completed = [
                'warId' => $war['warId'],
                'rivalFactionId' => $war['rivalFactionId'],
                'rivalNameEn' => $war['rivalNameEn'],
                'rivalNameAr' => $war['rivalNameAr'],
                'ourScore' => $war['ourScore'],
                'theirScore' => $war['theirScore'],
                'outcome' => 'victory',
                'cachesRewarded' => ['gold' => 1, 'silver' => 1, 'bronze' => 1],
                'completedAt' => gmdate('c', $now),
            ];
            $this->prependLog($state, 'warHistory', $completed);
            $state['activeWar'] = null;
            $state['enlisted'] = false;
        } else {
            $state['activeWar'] = $war;
        }

        $famRow = $this->database->fetchOne(
            'SELECT respect FROM family_progression WHERE faction_id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
            ['id' => $factionId],
        );
        $newRespect = (int) ($famRow['respect'] ?? 0) + $respectAwarded;
        $nowIso = gmdate('c', $now);
        $this->database->execute(
            'UPDATE family_progression SET respect = :respect, version = version + 1, updated_at = :at WHERE faction_id = :id',
            ['respect' => $newRespect, 'at' => $nowIso, 'id' => $factionId],
        );
        $this->database->execute(
            'INSERT INTO family_respect_ledger (id, faction_id, player_id, delta, balance, reason, correlation_id, created_at)
             VALUES (:id, :family, :player, :delta, :balance, :reason, :correlation, :at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'family' => $factionId,
                'player' => $playerId,
                'delta' => $respectAwarded,
                'balance' => $newRespect,
                'reason' => $warWon ? 'war.victory' : 'war.hit',
                'correlation' => bin2hex(random_bytes(16)),
                'at' => $nowIso,
            ],
        );

        $this->saveEmpireState($factionId, $state);

        return [
            'warPointsScored' => $ourDelta,
            'ourScore' => $war['ourScore'],
            'theirScore' => $war['theirScore'],
            'lead' => $lead,
            'targetLead' => $targetLead,
            'warWon' => $warWon,
            'respectAwarded' => $respectAwarded,
            'cachesAwarded' => $cachesAwarded,
        ];
    }

    private function settleExpiredWarIfNeeded(string $factionId, array &$state, string $actorId, int $now): void
    {
        $war = $state['activeWar'] ?? null;
        if (!is_array($war) || ($war['status'] ?? '') !== 'active' || (int) ($war['endsAt'] ?? 0) > $now) {
            return;
        }
        $this->database->transaction(function () use ($factionId, &$state, $actorId, $now): void {
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadEmpireState($factionId);
            $this->settleExpiredWarLocked($factionId, $state, $actorId, $now);
        });
    }

    private function settleExpiredWarLocked(string $factionId, array &$state, string $actorId, int $now): void
    {
        $war = $state['activeWar'] ?? null;
        if (!is_array($war) || ($war['status'] ?? '') !== 'active' || (int) ($war['endsAt'] ?? 0) > $now) {
            return;
        }
        $won = (int) ($war['ourScore'] ?? 0) >= (int) ($war['theirScore'] ?? 0);
        if ($won) {
            $state['caches']['silver'] = (int) ($state['caches']['silver'] ?? 0) + 1;
            $state['caches']['bronze'] = (int) ($state['caches']['bronze'] ?? 0) + 1;
        } else {
            $state['caches']['bronze'] = (int) ($state['caches']['bronze'] ?? 0) + 1;
        }
        $this->prependLog($state, 'warHistory', [
            'warId' => $war['warId'],
            'rivalFactionId' => $war['rivalFactionId'],
            'rivalNameEn' => $war['rivalNameEn'],
            'rivalNameAr' => $war['rivalNameAr'],
            'ourScore' => (int) ($war['ourScore'] ?? 0),
            'theirScore' => (int) ($war['theirScore'] ?? 0),
            'outcome' => $won ? 'victory' : 'defeat',
            'completedAt' => gmdate('c', $now),
        ]);
        $state['activeWar'] = null;
        $state['enlisted'] = false;
        $this->saveEmpireState($factionId, $state);
    }

    private function rollBonusWeapon(string $cacheTier, int $now): array
    {
        $odds = self::RW_CACHE_DEFINITIONS[$cacheTier]['odds'];
        $roll = $this->roll(1, 100);
        if ($roll <= $odds['yellow']) {
            $rarity = 'yellow';
            $multBoost = 0.45;
            $prefixEn = 'Yellow';
            $prefixAr = 'أصفر';
        } elseif ($roll <= ($odds['yellow'] + $odds['orange'])) {
            $rarity = 'orange';
            $multBoost = 0.85;
            $prefixEn = 'Orange';
            $prefixAr = 'برتقالي';
        } else {
            $rarity = 'red';
            $multBoost = 1.35;
            $prefixEn = 'Red';
            $prefixAr = 'أحمر';
        }

        $archIndex = $this->roll(0, count(self::RW_WEAPON_ARCHETYPES) - 1);
        $arch = self::RW_WEAPON_ARCHETYPES[$archIndex];
        $perkKeys = array_keys(self::RW_BONUS_PERKS);
        $perkKey = $perkKeys[$this->roll(0, count($perkKeys) - 1)];
        $perk = self::RW_BONUS_PERKS[$perkKey];

        $rarityBonusPct = $rarity === 'red' ? 5 : ($rarity === 'orange' ? 2 : 0);
        $perkValuePct = (int) $perk['valuePct'] + $rarityBonusPct;
        $uid = 'rw_' . $rarity . '_' . $arch['baseItemId'] . '_' . bin2hex(random_bytes(3));

        return [
            'id' => $uid,
            'baseItemId' => $arch['baseItemId'],
            'slot' => $arch['slot'],
            'rarity' => $rarity,
            'mult' => round((float) $arch['baseMult'] + $multBoost, 2),
            'perk' => $perkKey,
            'perkValuePct' => $perkValuePct,
            'perkLabelEn' => str_replace((string) $perk['valuePct'], (string) $perkValuePct, $perk['labelEn']),
            'perkLabelAr' => str_replace((string) $perk['valuePct'], (string) $perkValuePct, $perk['labelAr']),
            'nameEn' => sprintf('[%s] %s (%s)', strtoupper($prefixEn), $arch['nameEn'], $perk['labelEn']),
            'nameAr' => sprintf('[%s] %s (%s)', $prefixAr, $arch['nameAr'], $perk['labelAr']),
            'unboxedFrom' => $cacheTier,
            'unboxedAt' => gmdate('c', $now),
        ];
    }

    private function buildDirectory(int $now): array
    {
        $rows = $this->database->fetchAll(
            "SELECT f.id, f.name_en, f.name_ar, f.color,
                    COALESCE(fp.respect, 0) AS respect,
                    (SELECT COUNT(*) FROM faction_members m WHERE m.faction_id = f.id) AS member_count,
                    (SELECT COUNT(*) FROM territory_control tc WHERE tc.faction_id = f.id AND tc.state IN ('owned', 'contested')) AS territory_count,
                    (SELECT p.username FROM faction_members lm JOIN players p ON p.id = lm.player_id WHERE lm.faction_id = f.id AND lm.role = 'leader' ORDER BY lm.joined_at ASC LIMIT 1) AS leader_name
             FROM factions f
             LEFT JOIN family_progression fp ON fp.faction_id = f.id
             WHERE f.enabled = 1
             ORDER BY COALESCE(fp.respect, 0) DESC, f.id ASC",
        );

        $directory = [];
        foreach ($rows as $row) {
            $fid = (string) $row['id'];
            $eState = $this->loadEmpireState($fid);
            $activeWar = $eState['activeWar'] ?? null;
            $inWar = is_array($activeWar) && ($activeWar['status'] ?? '') === 'active' && (int) ($activeWar['endsAt'] ?? 0) > $now;
            $warStatus = $inWar ? 'at_war' : (!empty($eState['enlisted']) ? 'enlisted' : 'peace');
            $maxMembers = 20 + ((int) ($eState['tree']['crime_skill'] ?? 0) * 2);

            $directory[] = [
                'id' => $fid,
                'factionId' => $fid,
                'nameEn' => (string) $row['name_en'],
                'nameAr' => (string) $row['name_ar'],
                'name' => ['en' => (string) $row['name_en'], 'ar' => (string) $row['name_ar']],
                'tag' => (string) $eState['tag'],
                'tagFormatted' => '[' . $eState['tag'] . ']',
                'color' => (string) $row['color'],
                'manifesto' => (string) $eState['manifesto'],
                'memberCount' => (int) $row['member_count'],
                'maxMembers' => $maxMembers,
                'respect' => (int) $row['respect'],
                'territoryCount' => (int) $row['territory_count'],
                'warStatus' => $warStatus,
                'recruitmentOpen' => (bool) $eState['recruitmentOpen'],
                'isPlayerCreated' => (bool) $eState['isPlayerCreated'],
                'leaderName' => $row['leader_name'] !== null ? (string) $row['leader_name'] : null,
            ];
        }
        return $directory;
    }

    private const UI_NODE_ALIASES = [
        'crim_skill' => 'crime_skill',
        'crim_nerve' => 'max_nerve',
        'crim_oc' => 'oc_payout',
        'crim_bust' => 'jail_bust',
        'fort_hosp' => 'hosp_time',
        'fort_life' => 'max_life',
        'fort_med' => 'med_effectiveness',
        'fort_revive' => 'revive_skill',
        'vor_cap' => 'booster_cd_cap',
        'vor_can' => 'energy_can_gain',
        'vor_candy' => 'candy_happy',
        'vor_alc' => 'booster_nerve',
        'tol_od' => 'drug_od_risk',
        'tol_addict' => 'addiction_gain',
        'tol_rehab' => 'rehab_cost',
        'tol_side' => 'drug_cd_reduce',
        'exc_luggage' => 'travel_luggage',
        'exc_zurich' => 'rehab_fee',
        'exc_hunt' => 'hunting_gain',
        'exc_abroad' => 'airfare_discount',
        'std_str' => 'str_gym_gain',
        'std_def' => 'def_gym_gain',
        'std_spd' => 'spd_gym_gain',
        'std_dex' => 'dex_gym_gain',
        'agg_dmg' => 'combat_damage',
        'agg_acc' => 'combat_accuracy',
        'agg_spd' => 'combat_speed',
        'agg_hosp' => 'hosp_duration',
    ];

    private function formatRespectTree(array $treeState, int $availableRespect, bool $canUpgrade): array
    {
        $branches = [];
        $upgradesMap = [];
        $reverseAliases = array_flip(self::UI_NODE_ALIASES);
        $totalUnlocked = 0;
        foreach (self::RESPECT_TREE as $bKey => $bDef) {
            $nodes = [];
            $branchTiers = 0;
            $upgradesMap[$bKey] = [];
            foreach ($bDef['nodes'] as $nKey => $nDef) {
                $tier = max(0, min(5, (int) ($treeState[$nKey] ?? 0)));
                $branchTiers += $tier;
                $totalUnlocked += $tier;
                $upgradesMap[$nKey] = $tier;
                $upgradesMap[$bKey][$nKey] = $tier;
                if (isset($reverseAliases[$nKey])) {
                    $aliasKey = $reverseAliases[$nKey];
                    $upgradesMap[$aliasKey] = $tier;
                    $upgradesMap[$bKey][$aliasKey] = $tier;
                }
                $nextCost = $tier < 5 ? (int) ($nDef['baseCost'] * ($tier + 1)) : null;
                $nodes[] = [
                    'id' => $nKey,
                    'branch' => $bKey,
                    'nameEn' => $nDef['nameEn'],
                    'nameAr' => $nDef['nameAr'],
                    'effectEn' => $nDef['effectEn'],
                    'effectAr' => $nDef['effectAr'],
                    'tier' => $tier,
                    'maxTier' => 5,
                    'nextCost' => $nextCost,
                    'perTierValue' => $nDef['perTier'],
                    'currentValue' => $tier * $nDef['perTier'],
                    'unit' => $nDef['unit'],
                    'canUpgrade' => $canUpgrade && $nextCost !== null && $availableRespect >= $nextCost,
                ];
            }
            $branches[] = [
                'id' => $bKey,
                'nameEn' => $bDef['nameEn'],
                'nameAr' => $bDef['nameAr'],
                'descEn' => $bDef['descEn'],
                'descAr' => $bDef['descAr'],
                'totalTiers' => $branchTiers,
                'maxTiers' => 20,
                'nodes' => $nodes,
            ];
        }

        return [
            'availableRespect' => $availableRespect,
            'totalUpgradesUnlocked' => $totalUnlocked,
            'totalNodes' => 28,
            'maxTierPerNode' => 5,
            'upgrades' => $upgradesMap,
            'activeBonuses' => $this->computeTreeBonuses($treeState),
            'branches' => $branches,
        ];
    }

    private function computeTreeBonuses(array $tree): array
    {
        $t = static fn (string $k): int => max(0, min(5, (int) ($tree[$k] ?? 0)));
        return [
            'crimeSkillPct' => $t('crime_skill') * 3,
            'maxNerveBonus' => $t('max_nerve') * 2,
            'ocPayoutPct' => $t('oc_payout') * 5,
            'jailBustPct' => $t('jail_bust') * 5,
            'hospTimeReducePct' => $t('hosp_time') * 5,
            'maxLifeBonus' => $t('max_life') * 50,
            'medEffectivenessPct' => $t('med_effectiveness') * 6,
            'reviveSkillPct' => $t('revive_skill') * 5,
            'boosterCdCapHours' => $t('booster_cd_cap') * 2,
            'energyCanGainPct' => $t('energy_can_gain') * 10,
            'candyHappyPct' => $t('candy_happy') * 10,
            'boosterNerveBonus' => $t('booster_nerve') * 1,
            'drugOdRiskReducePct' => $t('drug_od_risk') * 6,
            'addictionGainReducePct' => $t('addiction_gain') * 8,
            'rehabCostReducePct' => $t('rehab_cost') * 6,
            'drugCdReducePct' => $t('drug_cd_reduce') * 3,
            'travelLuggageBonus' => $t('travel_luggage') * 1,
            'rehabFeeReducePct' => $t('rehab_fee') * 5,
            'huntingGainPct' => $t('hunting_gain') * 6,
            'airfareDiscountPct' => $t('airfare_discount') * 5,
            'strGymGainPct' => $t('str_gym_gain') * 2,
            'defGymGainPct' => $t('def_gym_gain') * 2,
            'spdGymGainPct' => $t('spd_gym_gain') * 2,
            'dexGymGainPct' => $t('dex_gym_gain') * 2,
            'combatDamagePct' => $t('combat_damage') * 3,
            'combatAccuracyPct' => $t('combat_accuracy') * 3,
            'combatSpeedPct' => $t('combat_speed') * 3,
            'hospDurationPct' => $t('hosp_duration') * 6,
        ];
    }

    private function formatOrganizedCrimes(?array $activeOc, array $history, int $now): array
    {
        $defs = [];
        foreach (self::CREW_HEISTS as $h) {
            $defs[] = [
                ...$h,
                'slots' => array_keys(self::CREW_SLOTS),
                'npcCutPerSlotPct' => self::NPC_FILLER_CUT_PCT,
            ];
        }

        $formattedActive = null;
        if (is_array($activeOc)) {
            $filled = 0;
            $npcs = 0;
            foreach (array_keys(self::CREW_SLOTS) as $sKey) {
                if (is_array($activeOc['slots'][$sKey] ?? null)) {
                    $filled++;
                    if (!empty($activeOc['slots'][$sKey]['isNpc'])) {
                        $npcs++;
                    }
                }
            }
            $readyAt = (int) ($activeOc['readyAt'] ?? 0);
            $remaining = max(0, $readyAt - $now);
            $status = $filled < 4 ? 'recruiting' : ($remaining > 0 ? 'planning' : 'ready');

            $formattedActive = [
                'id' => (string) $activeOc['id'],
                'heistId' => (string) $activeOc['heistId'],
                'nameEn' => (string) $activeOc['nameEn'],
                'nameAr' => (string) $activeOc['nameAr'],
                'status' => $status,
                'createdAt' => (int) ($activeOc['createdAt'] ?? $now),
                'readyAt' => $readyAt,
                'remainingSeconds' => $remaining,
                'slots' => $activeOc['slots'],
                'filledSlotsCount' => $filled,
                'npcSlotsCount' => $npcs,
                'npcCutTotalPct' => min(80, $npcs * self::NPC_FILLER_CUT_PCT),
                'canExecute' => $filled === 4 && $remaining === 0,
            ];
        }

        return [
            'definitions' => $defs,
            'slotsMeta' => self::CREW_SLOTS,
            'activeOc' => $formattedActive,
            'recentHistory' => array_slice($history, 0, 10),
        ];
    }

    private function formatRankedWar(bool $enlisted, ?array $activeWar, array $caches, array $history, int $now): array
    {
        $formattedWar = null;
        if ($activeWar !== null && ($activeWar['status'] ?? '') === 'active') {
            $endsAt = (int) ($activeWar['endsAt'] ?? $now);
            $ourScore = (int) ($activeWar['ourScore'] ?? 0);
            $theirScore = (int) ($activeWar['theirScore'] ?? 0);
            $formattedWar = [
                'warId' => (string) $activeWar['warId'],
                'status' => 'active',
                'ourFactionId' => (string) $activeWar['ourFactionId'],
                'rivalFactionId' => (string) $activeWar['rivalFactionId'],
                'rivalNameEn' => (string) $activeWar['rivalNameEn'],
                'rivalNameAr' => (string) $activeWar['rivalNameAr'],
                'rivalTag' => (string) ($activeWar['rivalTag'] ?? 'RIVL'),
                'ourScore' => $ourScore,
                'theirScore' => $theirScore,
                'lead' => $ourScore - $theirScore,
                'targetLead' => (int) ($activeWar['targetLead'] ?? self::WAR_TARGET_LEAD),
                'startedAt' => (int) ($activeWar['startedAt'] ?? $now),
                'endsAt' => $endsAt,
                'remainingSeconds' => max(0, $endsAt - $now),
                'assaultEnergyCost' => self::WAR_ASSAULT_ENERGY,
                'recentHits' => array_slice(is_array($activeWar['recentHits'] ?? null) ? $activeWar['recentHits'] : [], 0, 12),
            ];
        }

        return [
            'enlisted' => $enlisted,
            'activeWar' => $formattedWar,
            'ourScore' => (int) ($formattedWar['ourScore'] ?? 0),
            'theirScore' => (int) ($formattedWar['theirScore'] ?? 0),
            'caches' => [
                'bronze' => max(0, (int) ($caches['bronze'] ?? 0)),
                'silver' => max(0, (int) ($caches['silver'] ?? 0)),
                'gold' => max(0, (int) ($caches['gold'] ?? 0)),
            ],
            'cacheDefinitions' => array_values(self::RW_CACHE_DEFINITIONS),
            'warHistory' => array_slice($history, 0, 10),
        ];
    }

    private function formatLoadoutPayload(array $progState, array $catalogItems): array
    {
        $resolved = LoadoutService::resolve($progState, $catalogItems);
        $rwWeapons = is_array($progState['rwWeapons'] ?? null) ? array_values($progState['rwWeapons']) : [];
        $tacInv = is_array($progState['tacticalArmor'] ?? null) ? $progState['tacticalArmor'] : [];
        $inv = is_array($progState['inv'] ?? null) ? $progState['inv'] : [];

        $ownedTac = [];
        foreach (LoadoutService::TACTICAL_ARMOR_CATALOG as $tid => $spec) {
            $ownedTac[] = [...$spec, 'ownedQty' => max(0, (int) ($tacInv[$tid] ?? 0))];
        }

        $availableBySlot = array_fill_keys(LoadoutService::ALL_SLOTS, []);
        foreach ($rwWeapons as $rw) {
            if (!is_array($rw) || empty($rw['id'])) {
                continue;
            }
            foreach (['primary', 'secondary', 'melee'] as $ws) {
                $availableBySlot[$ws][] = [
                    'id' => (string) $rw['id'],
                    'nameEn' => (string) $rw['nameEn'],
                    'nameAr' => (string) $rw['nameAr'],
                    'mult' => (float) $rw['mult'],
                    'rarity' => (string) $rw['rarity'],
                    'preferredSlot' => (string) ($rw['slot'] ?? 'primary'),
                ];
            }
        }
        foreach ($inv as $itemId => $qty) {
            if ((int) $qty < 1 || !isset($catalogItems[$itemId])) {
                continue;
            }
            $def = $catalogItems[$itemId];
            $type = (string) ($def['type'] ?? '');
            $nameEn = is_array($def['name'] ?? null) ? (string) ($def['name']['en'] ?? $itemId) : ucfirst(str_replace('_', ' ', (string) $itemId));
            $nameAr = is_array($def['name'] ?? null) ? (string) ($def['name']['ar'] ?? $nameEn) : $nameEn;

            if ($type === 'weapon') {
                $pref = LoadoutService::naturalWeaponSlot((string) $itemId, $def);
                foreach (['primary', 'secondary', 'melee'] as $ws) {
                    $availableBySlot[$ws][] = [
                        'id' => (string) $itemId,
                        'nameEn' => $nameEn,
                        'nameAr' => $nameAr,
                        'mult' => (float) ($def['mult'] ?? 1.0),
                        'qty' => (int) $qty,
                        'rarity' => 'standard',
                        'preferredSlot' => $pref,
                    ];
                }
            } elseif (isset(LoadoutService::TEMPORARY_TACTICAL_ITEMS[$itemId])) {
                $availableBySlot['temporary'][] = [
                    'id' => (string) $itemId,
                    'nameEn' => $nameEn,
                    'nameAr' => $nameAr,
                    'mult' => (float) LoadoutService::TEMPORARY_TACTICAL_ITEMS[$itemId]['mult'],
                    'qty' => (int) $qty,
                    'rarity' => 'tactical',
                ];
            } elseif ($type === 'armor') {
                foreach (LoadoutService::ARMOR_SLOTS as $as) {
                    $availableBySlot[$as][] = [
                        'id' => (string) $itemId,
                        'nameEn' => $nameEn,
                        'nameAr' => $nameAr,
                        'red' => (float) ($def['red'] ?? 0.0),
                        'qty' => (int) $qty,
                        'rarity' => 'standard',
                    ];
                }
            }
        }
        foreach (LoadoutService::TACTICAL_ARMOR_CATALOG as $tid => $spec) {
            if ((int) ($tacInv[$tid] ?? 0) >= 1) {
                $availableBySlot[$spec['slot']][] = [
                    'id' => $tid,
                    'nameEn' => $spec['nameEn'],
                    'nameAr' => $spec['nameAr'],
                    'red' => (float) $spec['red'],
                    'qty' => (int) $tacInv[$tid],
                    'rarity' => 'tactical',
                ];
            }
        }

        return [
            ...$resolved,
            'ownedBonusWeapons' => $rwWeapons,
            'ownedTacticalArmor' => $ownedTac,
            'tacticalShop' => array_values(LoadoutService::TACTICAL_ARMOR_CATALOG),
            'availableBySlot' => $availableBySlot,
        ];
    }

    private function syncMemberTreeCapPerks(string $playerId, string $factionId, array $tree, array &$progState): bool
    {
        $applied = is_array($progState['factionEmpireApplied'] ?? null)
            ? $progState['factionEmpireApplied']
            : ['factionId' => null, 'nerve' => 0, 'life' => 0];

        if (($applied['factionId'] ?? null) !== null && $applied['factionId'] !== $factionId) {
            $oldNerve = (int) ($applied['nerve'] ?? 0);
            $oldLife = (int) ($applied['life'] ?? 0);
            if ($oldNerve > 0 || $oldLife > 0) {
                $p = $this->database->fetchOne('SELECT max_nerve, nerve, max_life, life FROM players WHERE id = :id', ['id' => $playerId]);
                if ($p !== null) {
                    $nextMaxNerve = max(10, (int) $p['max_nerve'] - $oldNerve);
                    $nextMaxLife = max(100, (int) $p['max_life'] - $oldLife);
                    $this->database->execute(
                        'UPDATE players SET max_nerve = :mn, nerve = :n, max_life = :ml, life = :l WHERE id = :id',
                        [
                            'mn' => $nextMaxNerve,
                            'n' => min((int) $p['nerve'], $nextMaxNerve),
                            'ml' => $nextMaxLife,
                            'l' => min((int) $p['life'], $nextMaxLife),
                            'id' => $playerId,
                        ],
                    );
                }
            }
            $applied = ['factionId' => $factionId, 'nerve' => 0, 'life' => 0];
        }

        $targetNerve = max(0, min(5, (int) ($tree['max_nerve'] ?? 0))) * 2;
        $targetLife = max(0, min(5, (int) ($tree['max_life'] ?? 0))) * 50;
        $deltaNerve = $targetNerve - (int) ($applied['nerve'] ?? 0);
        $deltaLife = $targetLife - (int) ($applied['life'] ?? 0);

        if ($deltaNerve === 0 && $deltaLife === 0 && ($applied['factionId'] ?? null) === $factionId) {
            return false;
        }

        if ($deltaNerve !== 0 || $deltaLife !== 0) {
            $this->database->execute(
                'UPDATE players SET max_nerve = max_nerve + :dn, max_life = max_life + :dl WHERE id = :id',
                ['dn' => $deltaNerve, 'dl' => $deltaLife, 'id' => $playerId],
            );
        }
        $progState['factionEmpireApplied'] = [
            'factionId' => $factionId,
            'nerve' => $targetNerve,
            'life' => $targetLife,
        ];
        return true;
    }

    private function clearMemberTreeCapPerks(string $playerId, string $leftFactionId): void
    {
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) {
            return;
        }
        $state = json_decode((string) $row['state_json'], true);
        if (!is_array($state) || !is_array($state['factionEmpireApplied'] ?? null)) {
            return;
        }
        if (($state['factionEmpireApplied']['factionId'] ?? '') !== $leftFactionId) {
            return;
        }
        $oldNerve = (int) ($state['factionEmpireApplied']['nerve'] ?? 0);
        $oldLife = (int) ($state['factionEmpireApplied']['life'] ?? 0);
        if ($oldNerve > 0 || $oldLife > 0) {
            $p = $this->database->fetchOne('SELECT max_nerve, nerve, max_life, life FROM players WHERE id = :id', ['id' => $playerId]);
            if ($p !== null) {
                $nextMaxNerve = max(10, (int) $p['max_nerve'] - $oldNerve);
                $nextMaxLife = max(100, (int) $p['max_life'] - $oldLife);
                $this->database->execute(
                    'UPDATE players SET max_nerve = :mn, nerve = :n, max_life = :ml, life = :l WHERE id = :id',
                    [
                        'mn' => $nextMaxNerve,
                        'n' => min((int) $p['nerve'], $nextMaxNerve),
                        'ml' => $nextMaxLife,
                        'l' => min((int) $p['life'], $nextMaxLife),
                        'id' => $playerId,
                    ],
                );
            }
        }
        unset($state['factionEmpireApplied']);
        $this->saveProgressionRow($playerId, $state, (int) $row['version'] + 1);
    }

    /** @return array{0: string, 1: string, 2: array<string, mixed>} */
    private function resolveTreeNode(string $branch, string $nodeId): array
    {
        if (isset(self::UI_NODE_ALIASES[$nodeId])) {
            $nodeId = self::UI_NODE_ALIASES[$nodeId];
        }
        if ($branch !== '' && isset(self::RESPECT_TREE[$branch]['nodes'][$nodeId])) {
            return [$branch, $nodeId, self::RESPECT_TREE[$branch]['nodes'][$nodeId]];
        }
        if ($nodeId !== '') {
            foreach (self::RESPECT_TREE as $bKey => $bDef) {
                if (isset($bDef['nodes'][$nodeId])) {
                    if ($branch !== '' && $branch !== $bKey) {
                        throw new InvalidArgumentException("Upgrade node {$nodeId} belongs to branch {$bKey}, not {$branch}.");
                    }
                    return [$bKey, $nodeId, $bDef['nodes'][$nodeId]];
                }
            }
        }
        if ($branch !== '' && isset(self::RESPECT_TREE[$branch]) && $nodeId === '') {
            $firstNodeKey = array_key_first(self::RESPECT_TREE[$branch]['nodes']);
            return [$branch, (string) $firstNodeKey, self::RESPECT_TREE[$branch]['nodes'][$firstNodeKey]];
        }
        throw new InvalidArgumentException('Unknown Faction Respect Tree upgrade node.');
    }

    private function makeNpcFiller(string $slot): array
    {
        $meta = self::CREW_SLOTS[$slot];
        return [
            'playerId' => 'npc-' . $slot,
            'username' => $meta['npcName'] . ' (NPC)',
            'level' => 25,
            'isNpc' => true,
            'cutPct' => self::NPC_FILLER_CUT_PCT,
        ];
    }

    private function defaultEmpireState(string $factionId): array
    {
        $seed = self::SEED_DEFAULTS[$factionId] ?? null;
        $fallbackTag = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $factionId) ?: 'SYND', 0, 4));
        if (strlen($fallbackTag) < 2) {
            $fallbackTag = 'SYND';
        }
        return [
            'factionId' => $factionId,
            'tag' => $seed['tag'] ?? $fallbackTag,
            'manifesto' => $seed['manifesto'] ?? 'Independent Zone City syndicate.',
            'recruitmentOpen' => true,
            'isPlayerCreated' => $seed === null,
            'createdBy' => null,
            'createdAt' => null,
            'vaultCash' => 0,
            'vaultContributed' => [],
            'vaultLog' => [],
            'tree' => [],
            'activeOc' => null,
            'ocHistory' => [],
            'enlisted' => false,
            'activeWar' => null,
            'warHistory' => [],
            'warHitsByPlayer' => [],
            'caches' => ['bronze' => 0, 'silver' => 0, 'gold' => 0],
        ];
    }

    private function loadEmpireState(string $factionId): array
    {
        $defaults = $this->defaultEmpireState($factionId);
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => self::META_PREFIX . $factionId]);
        if ($row === null || !isset($row['value'])) {
            return $defaults;
        }
        $decoded = json_decode((string) $row['value'], true);
        if (!is_array($decoded)) {
            return $defaults;
        }
        $merged = array_replace($defaults, $decoded);
        $merged['tree'] = is_array($decoded['tree'] ?? null) ? $decoded['tree'] : [];
        $merged['caches'] = array_replace(['bronze' => 0, 'silver' => 0, 'gold' => 0], is_array($decoded['caches'] ?? null) ? $decoded['caches'] : []);
        return $merged;
    }

    private function saveEmpireState(string $factionId, array $state): void
    {
        $key = self::META_PREFIX . $factionId;
        $encoded = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :val) ON CONFLICT (name) DO UPDATE SET value = :upd',
            ['name' => $key, 'val' => $encoded, 'upd' => $encoded],
        );
    }

    private function ensureFamilyProgression(string $factionId): array
    {
        $this->database->insertIgnore(
            'family_progression',
            ['faction_id', 'respect', 'upgrades_json', 'version', 'updated_at'],
            [$factionId, 0, '{}', 1, gmdate('c', $this->now())],
        );
        return $this->database->fetchOne('SELECT * FROM family_progression WHERE faction_id = :id', ['id' => $factionId]) ?? ['respect' => 0, 'upgrades_json' => '{}', 'version' => 1];
    }

    private function playerMembership(string $playerId): ?array
    {
        return $this->database->fetchOne(
            'SELECT m.faction_id, m.role, f.name_en, f.name_ar, f.color
             FROM faction_members m
             JOIN factions f ON f.id = m.faction_id
             WHERE m.player_id = :id AND f.enabled = 1',
            ['id' => $playerId],
        );
    }

    private function requireFactionMembership(string $playerId): array
    {
        $mem = $this->playerMembership($playerId);
        if ($mem === null) {
            throw new RuntimeException('Join or found a faction first.');
        }
        return $mem;
    }

    private function requirePlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Unknown player: ' . $playerId);
        }
        return $this->resources->normalize($row);
    }

    private function assertActionAvailable(string $playerId): void
    {
        (new TravelService($this->database, $this->events, $this->clock))->assertAvailable($playerId);
        $progression = new ProgressionService($this->database, $this->events);
        $progression->assertNotInPlayerCombat($playerId);
        $progression->assertAvailable($playerId, 'faction-empire');
    }

    private function catalogItems(): array
    {
        return (new GameplayCatalog($this->database, $this->events))->active()['items'] ?? [];
    }

    /** @return array{state: array<string, mixed>, version: int} */
    private function loadProgressionRow(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Progression state missing for player: ' . $playerId);
        }
        return [
            'state' => json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR),
            'version' => (int) $row['version'],
        ];
    }

    private function saveProgressionRow(string $playerId, array $state, int $version): void
    {
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
            [
                'state' => json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'version' => $version,
                'updated' => gmdate('c', $this->now()),
                'id' => $playerId,
            ],
        );
    }

    private function prependLog(array &$state, string $key, array $entry, int $max = 20): void
    {
        $list = is_array($state[$key] ?? null) ? $state[$key] : [];
        array_unshift($list, $entry);
        $state[$key] = array_slice($list, 0, $max);
    }

    private function parsePositiveAmount(mixed $raw, int $max, string $label): int
    {
        if (is_int($raw)) {
            $val = $raw;
        } elseif (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
            $val = (int) trim($raw);
        } else {
            throw new InvalidArgumentException($label . ' must be a positive whole integer.');
        }
        if ($val < 1 || $val > $max) {
            throw new InvalidArgumentException(sprintf('%s must be between 1 and %s.', $label, number_format($max)));
        }
        return $val;
    }

    private function lockMetaKey(string $name, string $defaultRaw = '{}'): void
    {
        $this->database->insertIgnore('engine_metadata', ['name', 'value'], [$name, $defaultRaw]);
        if ($this->database->driver() === 'sqlite') {
            $this->database->execute('UPDATE engine_metadata SET value = value WHERE name = :name', ['name' => $name]);
        } else {
            $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name FOR UPDATE', ['name' => $name]);
        }
    }

    private function now(): int
    {
        return $this->clock === null ? time() : (int) ($this->clock)();
    }

    private function roll(int $min, int $max): int
    {
        return $this->random === null ? random_int($min, $max) : (int) ($this->random)($min, $max);
    }
}
